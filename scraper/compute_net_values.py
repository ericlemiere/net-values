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

PRODUCTION uses bref's VORP. That choice is empirical, not a preference —
scraper/validate_value.py tests the candidates against actual team wins, and
box-based above-replacement measures win:

    Win Shares          r=0.964 level, 0.931 year-over-year   (but circular:
                                                               WS is allocated
                                                               FROM team results)
    VORP                r=0.954 level, 0.904 year-over-year
    (BPM-repl) x poss   r=0.949 level, 0.901 year-over-year
    NET_RATING x poss   r=0.928 level, 0.839 year-over-year
    PIE x poss          r=0.735 level, 0.713 year-over-year

Blending nba.com's on-court NET_RATING into the box estimate made it
monotonically WORSE (0.948 down to 0.940 as its weight rose), because raw
net rating is mostly a measure of the team a player happens to be on. So it is
deliberately not used here. The upgrade path is on-off differential, which
strips out team quality and only exists from 2007-08 — worth testing against
this same harness before adopting.

Known limit: summing a metric over a team and correlating with wins mostly
validates the metric's COEFFICIENTS, since any linear box metric summed over a
roster equals that metric applied to the team's own box totals. It says much
less about whether credit is split correctly BETWEEN teammates. Nothing free
and historical can settle that; RAPM-style data would.

Idempotent: truncates and rewrites, so re-running can't double-count.

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

COLUMNS = [
    "team", "salary", "production", "minutes", "full_workload", "availability",
    "expected_production",
    "net_value_score", "value_dollars", "net_value",
    "net_value_pct_cap", "season_rank", "salary_rank", "has_stats", "source",
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


def load(cur, season_filter):
    """Every paid player-season, with the production figure and the season cap.

    One row per (player, season): salaries are collapsed by the rule above, and
    a traded player is attributed to whichever team paid him most, so he lands
    on exactly one team's books.
    """
    sql = f"""
        SELECT s.player_id,
               s.season,
               (ARRAY_AGG(s.team ORDER BY s.salary DESC NULLS LAST, s.team))[1] AS team,
               {SALARY_FOR_SEASON} AS salary,
               MAX(adv.vorp) AS vorp,
               MAX(adv.mp) AS minutes,
               BOOL_OR(adv.player_id IS NOT NULL) AS has_stats,
               MAX(se.league_cap) AS league_cap,
               COUNT(DISTINCT s.team) > 1 AS multi_team
        FROM salaries s
        JOIN seasons se ON se.season = s.season
        LEFT JOIN advanced_stats adv
               ON adv.player_id = s.player_id AND adv.season = s.season
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


def compute(rows, games_by_season):
    """rows -> [(player_id, season, values...)], one per player-season."""
    by_season = {}
    for player_id, season, team, salary, vorp, minutes, has_stats, cap, _multi in rows:
        prod = max(float(vorp), FLOOR) if vorp is not None else 0.0
        by_season.setdefault(season, []).append(
            {
                "player_id": player_id, "season": season, "team": team,
                "salary": int(salary), "production": prod,
                "minutes": float(minutes) if minutes is not None else 0.0,
                "has_stats": bool(has_stats), "cap": int(cap),
            }
        )

    out = []
    for season, players in sorted(by_season.items()):
        pool = sum(p["salary"] for p in players)
        total_prod = sum(p["production"] for p in players)

        # Pay rank is league-wide within the season: 1 is the highest-paid
        # player in the NBA that year, regardless of team. It depends on
        # nothing but the salaries, so it is set for every season on file,
        # including one nobody has played yet.
        for rank, p in enumerate(sorted(players, key=lambda p: -p["salary"]), start=1):
            p["salary_rank"] = rank

        if total_prod <= 0:
            # Salaries are signed long before the games are played. There is no
            # production to price yet, so the value columns stay empty, but the
            # contracts and their ranks are real and worth showing.
            for p in players:
                out.append(
                    (
                        p["player_id"], season, p["team"], p["salary"],
                        # production, full_workload, availability, expected,
                        # score, value, net_value, pct_of_cap, season_rank all
                        # wait on games being played.
                        None, p["minutes"], None, None, None, None, None,
                        None, None, None, p["salary_rank"], p["has_stats"],
                        "vorp",
                    )
                )
            print(f"  {season}: {len(players):4} players, salaries only (no games played yet)")
            continue

        price = pool / total_prod

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

        # Expectation is what his pay buys at the league's going rate, over the
        # part of the season he was available for. Without the availability
        # term an injured star is charged twice: once because production is a
        # counting stat that stops when he does, and again against a salary
        # that doesn't.
        for p in players:
            p["availability"] = min(p["minutes"] / full_workload, 1.0)
            p["claim"] = (p["salary"] / pool) * p["availability"]

        for p in players:
            p["expected"] = p["claim"] * total_prod
            p["score"] = p["production"] - p["expected"]

        # Because availability is at most 1, expectations fall a little short of
        # what the league actually produced, which would leave the average score
        # slightly positive and stop zero meaning "paid the going rate". Shifting
        # every score by the season mean fixes that. A constant shift, so it
        # re-centres the scale without touching the order.
        drift = sum(p["score"] for p in players) / len(players)
        for p in players:
            p["score"] -= drift
            p["expected"] += drift
            p["value"] = price * p["production"]
            p["net_value"] = p["score"] * price

        players.sort(key=lambda p: -p["score"])
        for rank, p in enumerate(players, start=1):
            out.append(
                (
                    p["player_id"], season,
                    p["team"], p["salary"], round(p["production"], 3),
                    round(p["minutes"], 1), round(full_workload, 1),
                    round(p["availability"], 3), round(p["expected"], 3),
                    round(p["score"], 2),
                    round(p["value"], 2), round(p["net_value"], 2),
                    round(100.0 * p["net_value"] / p["cap"], 3),
                    rank, p["salary_rank"], p["has_stats"], "vorp",
                )
            )
        print(
            f"  {season}: {len(players):4} players, "
            f"${price:,.0f} per win, full workload {full_workload:,.0f} min"
        )
    return out


def main():
    season_filter = sys.argv[1] if len(sys.argv) > 1 else None
    conn = connect()
    cur = conn.cursor()

    rows = compute(load(cur, season_filter), load_games(cur))
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
    else:
        cur.execute("TRUNCATE net_values RESTART IDENTITY")

    # execute_values batches into a handful of round trips; executemany would
    # send ~17,000 separate INSERTs, which over a hosted database takes minutes.
    execute_values(
        cur,
        f"INSERT INTO net_values (player_id, season, {', '.join(COLUMNS)}) VALUES %s",
        rows,
        page_size=1000,
    )
    conn.commit()
    cur.close()
    conn.close()
    print(f"\nwrote {len(rows)} player-seasons")


if __name__ == "__main__":
    main()
