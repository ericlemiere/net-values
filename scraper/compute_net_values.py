"""Computes Net Value for every player-season and rewrites the net_values table.

    Net Value  =  what the player produced, priced in that season's dollars
                  -  what he was actually paid

Two decisions do all the work:

1. SUBTRACT, DON'T DIVIDE. Production per dollar would rank every minimum
   contract above every star — a small number over a tiny number is huge. The
   subtraction asks the question people mean by "value": how much more was he
   worth than he cost?

2. PRICE WITHIN THE SEASON. Each season's entire salary pool buys that season's
   entire production, which sets a price per unit of production in that
   season's own dollars. A 1994 bargain and a 2026 bargain then land on the
   same scale with no inflation adjustment, and the column sums to about zero
   league-wide, so zero means "paid the going rate".

PRODUCTION comes from `player_production` — see compute_production.py, which
starts from the points each team's offense and defense actually generated above
league average and splits them between the players.

It replaced bref's VORP, which is still priced alongside into the `_vorp`
columns for comparison and is wired to nothing. VORP sees defense through
steals, blocks and defensive rebounds, and those describe a rim protector
poorly and a wing not at all: Rudy Gobert anchored the league's best defense in
2023-24 and priced 464th of 486. The replacement beats it against team wins
(0.967 against 0.956, and 0.925 against 0.900 on year-over-year change) and on
All-NBA, MVP and DPOY voting.

Known limit, and it is a real one: because production is now anchored to each
team's own rating, summing a roster and correlating with wins is close to
guaranteed to pass and says nothing about whether credit is split correctly
BETWEEN team-mates. Every possible split scores the same. Award voting is the
only independent read on the split that exists, which is why the defensive
model is fitted to it — see fit_defense_model.py.

PAY IS CHARGED EVEN WHEN THE PLAYER ISN'T THERE. Expectation scales with how
much of the season a player was available for, but only down to
AVAILABILITY_FLOOR, never to nothing — otherwise a salary multiplied by zero
availability leaves the arithmetic entirely and a max contract that never
suited up scores the same as a minimum one.

A SEASON IS FILED UNDER THE TEAM HE PLAYED FOR, not the team that paid most.
Those differ on every bought-out contract, where the old team keeps owing the
money and the player is somewhere else. The money is still charged in full —
it was really spent — but net_value_shares splits it back across the teams that
each paid part of it, so the old team wears its own mistake.

TWO PRODUCTION METRICS ARE PRICED, NOT ONE. Every headline column has a twin
ending `_vorp`, which is this same arithmetic run on bref's VORP. The pricing
rule is identical for both, so any difference between a pair is a difference in
the production metric and nothing else. Nothing on the site reads the `_vorp`
columns; they are kept so the change stays auditable.

Idempotent: truncates and rewrites both tables, so re-running can't
double-count.

Usage:
  python compute_net_values.py
  python compute_net_values.py 2024-2025      # one season
"""
import sys

from psycopg2.extras import execute_values

from db import connect

# Below-replacement production counts as zero, not as a negative: a team gets
# nothing back from those minutes, but it doesn't get paid either. Flooring
# here is also what makes the season's net values sum to ~0.
FLOOR = 0.0

# A full season's workload, against which availability is measured: a starter's
# minutes per night, times the games in the season.
STARTER_MINUTES = 30
DEFAULT_GAMES = 82

# How much of a contract is charged no matter how little the player appeared.
#
# Expectation used to scale by availability alone, which multiplied the salary
# out of the arithmetic entirely for anyone who never took the floor. Tyrese
# Haliburton missing all of 2025-26 on $45.6M and Mamadi Diakite missing it on
# $464K both scored exactly -0.28, because both expectations were
# (share x 0 x production) = 0. Seventeen players that season shared the
# identical number for the same reason.
#
# Charging a floor of the pay regardless fixes that: availability becomes
# FLOOR + (1 - FLOOR) x availability, which runs 0.5 to 1.0 instead of 0 to 1,
# so what a player was paid always reaches the result. A full season still
# comes out at 1.0, so nobody who played one is affected — only the players
# who missed time move.
#
# 0.5 reads as: half of what a contract buys is being available, half is what
# you do once you are. It puts Haliburton 483rd of 486 and leaves Diakite
# 234th, which is the distinction the old formula could not draw.
AVAILABILITY_FLOOR = 0.5


COLUMNS = [
    "team", "salary", "production", "minutes", "full_workload", "availability",
    "expected_production",
    "net_value_score", "value_dollars", "net_value",
    "net_value_pct_cap", "season_rank", "salary_rank", "has_stats", "source",
    # The same five figures under the production model. `minutes`,
    # `full_workload`, `availability` and the salary columns are shared: they
    # are properties of the contract and the schedule, not of either metric.
    "production_vorp", "expected_production_vorp",
    "net_value_score_vorp", "net_value_vorp", "season_rank_vorp",
]

# net_value_shares, in the order split_shares builds them.
SHARE_COLUMNS = [
    "team", "salary", "production_credit", "charge", "score", "played_here",
    "source", "score_vorp",
]


# A player traded mid-season has one salary row per team, and the two sources
# mean different things by that:
#
#   sqlite_migration : a FULL-SEASON figure, repeated against each team he was
#                      on. Summing it multiplies his pay.
#   bref             : the part that team actually paid, so the rows add up to
#                      his season salary.
#
# So the rule keys on source, not on whether the figures happen to match.
# Comparing them is not enough: Andre Drummond's two 2019-20 rows differ by one
# dollar and are the same full-season salary from two sources, while Chauncey
# Billups' 2011-12 rows ($2.0M + $12.2M) are genuinely two halves of one.
# Mixed rows take the legacy figure, which is already the whole season.
#
# Checked against the league totals this produces: 1.16x-1.31x the cap across
# eras, which is where NBA payrolls actually sit.
SALARY_FOR_SEASON = """
    CASE WHEN BOOL_OR(s.source = 'sqlite_migration') THEN MAX(s.salary)
         ELSE SUM(s.salary) END
"""


# Which team a player-season belongs to.
#
# Not whoever paid the most, which was the old rule and which named the wrong
# team every time a contract was bought out: Portland owed Deandre Ayton $25.6M
# after waiving him in 2025-26, the Lakers paid $8.1M, and he played all 72
# games in Los Angeles — so the worst net value of the season was filed under
# Portland. That is 168 buyouts across the data, every one of them labeled
# with a team the player never suited up for.
#
# advanced_stats already knows. It is unique on (player, season) and holds the
# multi-team summary row with a NULL team for anyone who genuinely split a
# season, so a non-NULL team there means "played for exactly this team" and a
# NULL means "played for several".
PLAYED_TEAM = "MAX(adv.team)"

# Where the stat line names no team, which is either a player who split the
# season or one who never took the floor at all. Paid-the-most is only a guess,
# and `signing_team` gets first refusal on it.
PAID_TEAM = "(ARRAY_AGG(s.team ORDER BY s.salary DESC NULLS LAST, s.team))[1]"


def load(cur, season_filter):
    """Every paid player-season, with the production figure and the season cap.

    One row per (player, season): salaries are collapsed by the rule above, and
    the season is filed under the team he actually played for.
    """
    sql = f"""
        SELECT s.player_id,
               s.season,
               {PLAYED_TEAM} AS played_team,
               {PAID_TEAM} AS paid_team,
               {SALARY_FOR_SEASON} AS salary,
               MAX(adv.vorp) AS vorp,
               MAX(pp.production) AS produced,
               MAX(adv.mp) AS minutes,
               BOOL_OR(adv.player_id IS NOT NULL) AS has_stats,
               MAX(se.league_cap) AS league_cap,
               BOOL_OR(s.source = 'sqlite_migration') AS legacy_salary
        FROM salaries s
        JOIN seasons se ON se.season = s.season
        LEFT JOIN advanced_stats adv
               ON adv.player_id = s.player_id AND adv.season = s.season
        LEFT JOIN player_production pp
               ON pp.player_id = s.player_id AND pp.season = s.season
        WHERE s.salary IS NOT NULL
          AND se.league_cap IS NOT NULL
    """
    params = []
    if season_filter:
        sql += " AND s.season = %s"
        params.append(season_filter)
    sql += " GROUP BY s.player_id, s.season"
    cur.execute(sql, params)
    return cur.fetchall()


def load_games(cur):
    """Games in each season, from the longest schedule any team played."""
    cur.execute("SELECT season, MAX(wins + losses) FROM team_seasons GROUP BY season")
    return {season: games for season, games in cur.fetchall() if games}


def load_salary_rows(cur, season_filter):
    """{(player_id, season): [(team, salary), ...]} — the unaggregated rows.

    What each team paid, kept separate, so the charge can be split back out
    across them. `load` collapses these into one figure per player-season; this
    is the same data before that happens.
    """
    sql = """
        SELECT s.player_id, s.season, s.team, s.salary
        FROM salaries s
        JOIN seasons se ON se.season = s.season
        WHERE s.salary IS NOT NULL
          AND s.team IS NOT NULL
          AND se.league_cap IS NOT NULL
    """
    params = []
    if season_filter:
        sql += " AND s.season = %s"
        params.append(season_filter)
    cur.execute(sql + " ORDER BY s.salary DESC, s.team", params)
    out = {}
    for player_id, season, team, salary in cur.fetchall():
        out.setdefault((player_id, season), []).append((team, int(salary)))
    return out


def load_teams_by_season(cur):
    """{player_id: {season: {team, ...}}} across every season on file.

    Unfiltered on purpose, even for a single-season run: `signing_team` has to
    look at the season before the one being computed.
    """
    cur.execute(
        """
        SELECT player_id, season, team FROM salaries
        WHERE team IS NOT NULL AND salary IS NOT NULL
        """
    )
    out = {}
    for player_id, season, team in cur.fetchall():
        out.setdefault(player_id, {}).setdefault(season, set()).add(team)
    return out


def signing_team(player_id, season, teams, teams_by_season):
    """Which of several teams actually signed a player who never played.

    A player with a salary but no stat line leaves no evidence of where he
    was, and for a bought-out contract the team owed the most money is the one
    team he certainly wasn't with. Damian Lillard in 2025-26 is the case: $22.5M
    from Milwaukee, who had waived him, and $14.1M from Portland, who signed
    him and watched him rehab.

    The contracts themselves say which is which. Dead money continues an
    obligation to a team that was already paying him last season; the team that
    signed him is the one new to his ledger. So where exactly one team is new
    and at least one is carried over, the new team is where he signed.

    Returns None when that reading isn't available — every team new (a player
    returning from outside the league), or none new (Lillard's 2026-27, where
    both teams owe him again). The caller falls back to paid-the-most, which is
    a guess, but there is genuinely nothing better for a player who never
    appeared in a game.
    """
    seasons = teams_by_season.get(player_id, {})
    prior = max((s for s in seasons if s < season), default=None)
    if prior is None:
        return None
    previous = seasons[prior]
    new = [t for t in teams if t not in previous]
    carried = [t for t in teams if t in previous]
    return new[0] if len(new) == 1 and carried else None


def split_shares(p, salary_rows, prod_key="production", prefix=""):
    """How one player-season's score divides among the teams that paid him.

    The charge follows the money and the production follows the player, so a
    bought-out contract lands on the team that owes it while the team he
    actually played for is judged on what it actually spent.

    Two cases never split. A legacy season repeats one full-season figure
    against each team rather than dividing it, so splitting by those rows would
    invent money that was never paid; and a season with no score yet has
    nothing to divide. Both fall back to the whole figure on one team.

    Returns [(team, salary, production_credit, charge, score, played_here)],
    whose scores sum to the player's own.
    """
    rows = salary_rows.get((p["player_id"], p["season"]), [])
    expected = p.get(f"{prefix}expected")
    production = p.get(prod_key)
    total = sum(salary for _, salary in rows)

    if p["legacy_salary"] or expected is None or total <= 0 or not rows:
        return [
            (
                p["team"], p["salary"], production, expected,
                p.get(f"{prefix}score"), True,
            )
        ]

    shares = []
    for team, salary in rows:
        played_here = team == p["team"]
        charge = expected * salary / total
        credit = production if played_here else 0.0
        shares.append((team, salary, credit, charge, credit - charge, played_here))

    # The team on his stat line with no contract on file. It happens while a
    # midseason trade is still settling on the source pages — the acquiring
    # team carries the salary before the player has played a game for them, so
    # his minutes sit under a team our salary data doesn't have paying him.
    # Carrying a zero-salary row keeps the shares summing to his score instead
    # of quietly dropping the production.
    if p["team"] is not None and not any(s[5] for s in shares):
        shares.append((p["team"], 0, production, 0.0, production, True))

    return shares


def price_metric(players, pool, prod_key, prefix):
    """Price one production metric for one season, in place.

    Writes `{prefix}expected`, `{prefix}score`, `{prefix}value`,
    `{prefix}net_value` and `{prefix}rank` onto each player, and returns the
    price per unit of production — or None where the season has produced
    nothing yet, in which case every figure is left null.

    Called once per metric with identical arithmetic, so the only thing that can
    differ between the two sets of columns is the production that went in.

    Expectation is what his pay buys at the league's going rate, over the part
    of the season he was available for. Scaling by availability at all is what
    stops an injured star being charged twice: once because production is a
    counting stat that stops when he does, and again against a salary that
    doesn't. It is floored rather than applied raw, though, because scaling all
    the way to zero charged him nothing at all — see AVAILABILITY_FLOOR. A
    player who was there every night still lands on 1.0.
    """
    total = sum(p[prod_key] for p in players)
    if total <= 0:
        for p in players:
            for suffix in ("expected", "score", "value", "net_value", "rank"):
                p[f"{prefix}{suffix}"] = None
        return None

    price = pool / total
    for p in players:
        charged = AVAILABILITY_FLOOR + (1.0 - AVAILABILITY_FLOOR) * p["availability"]
        claim = (p["salary"] / pool) * charged
        p[f"{prefix}expected"] = claim * total
        p[f"{prefix}score"] = p[prod_key] - p[f"{prefix}expected"]

    # Because the charged share is at most 1, expectations fall a little short
    # of what the league actually produced, which would leave the average score
    # slightly positive and stop zero meaning "paid the going rate". Shifting
    # every score by the season mean fixes that. A constant shift, so it
    # re-centers the scale without touching the order.
    drift = sum(p[f"{prefix}score"] for p in players) / len(players)
    for p in players:
        p[f"{prefix}score"] -= drift
        p[f"{prefix}expected"] += drift
        p[f"{prefix}value"] = price * p[prod_key]
        p[f"{prefix}net_value"] = p[f"{prefix}score"] * price

    ordered = sorted(players, key=lambda q: -q[f"{prefix}score"])
    for rank, p in enumerate(ordered, start=1):
        p[f"{prefix}rank"] = rank
    return price


def compute(rows, games_by_season, salary_rows, teams_by_season):
    """rows -> ([net_values row], [net_value_shares row]).

    One net_values row per player-season, and one share row per team that paid
    him that season.
    """
    by_season = {}
    for (player_id, season, played_team, paid_team, salary, vorp, produced,
         minutes, has_stats, cap, legacy) in rows:
        paid_teams = [t for t, _ in salary_rows.get((player_id, season), [])]
        # Where he played, else where he signed, else where the money was.
        team = played_team or signing_team(
            player_id, season, paid_teams, teams_by_season
        ) or paid_team
        by_season.setdefault(season, []).append(
            {
                "player_id": player_id, "season": season, "team": team,
                "salary": int(salary),
                "production": (
                    max(float(produced), FLOOR) if produced is not None else 0.0
                ),
                "production_vorp": max(float(vorp), FLOOR) if vorp is not None else 0.0,
                "minutes": float(minutes) if minutes is not None else 0.0,
                "has_stats": bool(has_stats), "cap": int(cap),
                "legacy_salary": bool(legacy),
            }
        )

    out = []
    shares = []

    def emit_shares(p):
        """One row per team that paid him, carrying both metrics' scores.

        The two passes walk the same contracts in the same order, so they line
        up team for team and can be zipped.
        """
        main_shares = split_shares(p, salary_rows)
        vorp_shares = split_shares(
            p, salary_rows, prod_key="production_vorp", prefix="vorp_"
        )
        for (team, salary, credit, charge, score, played_here), legacy in zip(
            main_shares, vorp_shares
        ):
            if team is None:
                continue
            vorp_score = legacy[4]
            shares.append(
                (
                    p["player_id"], p["season"], team, salary,
                    None if credit is None else round(credit, 3),
                    None if charge is None else round(charge, 3),
                    None if score is None else round(score, 2),
                    played_here, "production",
                    None if vorp_score is None else round(vorp_score, 2),
                )
            )

    def figure(p, key, digits):
        value = p.get(key)
        return None if value is None else round(value, digits)

    for season, players in sorted(by_season.items()):
        pool = sum(p["salary"] for p in players)

        # Pay rank is league-wide within the season: 1 is the highest-paid
        # player in the NBA that year, regardless of team. It depends on
        # nothing but the salaries, so it is set for every season on file,
        # including one nobody has played yet.
        for rank, p in enumerate(sorted(players, key=lambda p: -p["salary"]), start=1):
            p["salary_rank"] = rank

        # A full season's work: a starter playing STARTER_MINUTES a night, every
        # game. Taken from the season's actual game count, so lockout and
        # suspended seasons (1998-99, 2011-12, 2019-20) size themselves.
        #
        # This used to be the 95th percentile of the season's minutes, which was
        # worse in two ways: it moved with how many fringe players happened to
        # get paid that year rather than with anything about basketball, and
        # "the 25th busiest player in the league" is not a thing anyone can
        # picture. Rankings are almost identical either way.
        full_workload = games_by_season.get(season, DEFAULT_GAMES) * STARTER_MINUTES
        for p in players:
            p["availability"] = min(p["minutes"] / full_workload, 1.0)

        price = price_metric(players, pool, "production", "")
        price_metric(players, pool, "production_vorp", "vorp_")

        if price is None:
            # Salaries are signed long before the games are played. There is no
            # production to price yet, so the value columns stay empty, but the
            # contracts and their ranks are real and worth showing.
            print(
                f"  {season}: {len(players):4} players, salaries only "
                f"(no games played yet)"
            )

        # Ordered by the metric in service, so `season_rank` and the row order
        # agree. The second metric carries its own rank in its own column.
        players.sort(key=lambda p: (p["score"] is None, -(p["score"] or 0.0)))
        for p in players:
            net_value = p.get("net_value")
            out.append(
                (
                    p["player_id"], season, p["team"], p["salary"],
                    figure(p, "production", 3) if price is not None else None,
                    round(p["minutes"], 1),
                    round(full_workload, 1) if price is not None else None,
                    round(p["availability"], 3) if price is not None else None,
                    figure(p, "expected", 3),
                    figure(p, "score", 2),
                    figure(p, "value", 2),
                    figure(p, "net_value", 2),
                    None if net_value is None else round(100.0 * net_value / p["cap"], 3),
                    p.get("rank"), p["salary_rank"], p["has_stats"], "production",
                    figure(p, "production_vorp", 3)
                    if p.get("vorp_expected") is not None else None,
                    figure(p, "vorp_expected", 3),
                    figure(p, "vorp_score", 2),
                    figure(p, "vorp_net_value", 2),
                    p.get("vorp_rank"),
                )
            )
            emit_shares(p)

        if price is not None:
            print(
                f"  {season}: {len(players):4} players, "
                f"${price:,.0f} per win, full workload {full_workload:,.0f} min"
            )
    return out, shares


def main():
    season_filter = sys.argv[1] if len(sys.argv) > 1 else None
    conn = connect()
    cur = conn.cursor()

    rows, shares = compute(
        load(cur, season_filter),
        load_games(cur),
        load_salary_rows(cur, season_filter),
        load_teams_by_season(cur),
    )
    # Cheap guard: a column added to COLUMNS without updating every branch that
    # builds a row would otherwise fail deep inside the insert.
    expected_width = len(COLUMNS) + 2
    bad = next((r for r in rows if len(r) != expected_width), None)
    if bad is not None:
        raise SystemExit(
            f"row has {len(bad)} values, expected {expected_width}: {bad[:4]}"
        )

    if season_filter:
        cur.execute("DELETE FROM net_values WHERE season = %s", (season_filter,))
        cur.execute("DELETE FROM net_value_shares WHERE season = %s", (season_filter,))
    else:
        cur.execute("TRUNCATE net_values RESTART IDENTITY")
        cur.execute("TRUNCATE net_value_shares RESTART IDENTITY")

    # execute_values batches into a handful of round trips; executemany would
    # send ~17,000 separate INSERTs, which over a hosted database takes minutes.
    execute_values(
        cur,
        f"INSERT INTO net_values (player_id, season, {', '.join(COLUMNS)}) VALUES %s",
        rows,
        page_size=1000,
    )
    execute_values(
        cur,
        f"INSERT INTO net_value_shares (player_id, season, {', '.join(SHARE_COLUMNS)}) VALUES %s",
        shares,
        page_size=1000,
    )
    conn.commit()
    cur.close()
    conn.close()
    print(f"\nwrote {len(rows)} player-seasons, {len(shares)} team shares")


if __name__ == "__main__":
    main()
