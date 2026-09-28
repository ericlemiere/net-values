"""Backfills `player_team_splits`: a traded player's season, one row per team.

The season stat tables keep one row per player-season, so a traded player's
row there covers the whole year. This writes the pieces, for multi-team seasons
only, in the order he played for each team.

Where each column comes from:

  box score, dates   1996-97 on: nba.com's game logs, summed per team. One
                     request returns every game of a season, so the stints fall
                     out of it directly, dated, and they sum back to the
                     nba.com season row exactly.
                     Before that: bref's per-team rows on the totals page.
  gs, pos, age       bref's per-team rows on the totals page. The game logs
                     carry none of them.
  advanced           bref's per-team rows on the advanced page.
  roster window      1996-97 on: days on each roster and the games that team
                     played in them, for apportioning salary and measuring
                     availability (see add_windows).
  production         not written here. compute_production.py fills it, and a
                     rebuild carries the old figure across until it runs again.

On bref a traded player is a "2TM"/"3TM" summary row followed by one row per
team, in the order he played for them. The summary is what the season tables
already hold; this reads the rows after it.

Each season is rebuilt whole — deleted and reinserted — so a re-run is
idempotent and the season in progress picks up a trade the day after the
player's first game with his new team. update_season.py runs it for that
season every morning.

Usage:
  python backfill_team_splits.py              # every season, 1990 on
  python backfill_team_splits.py 2026         # one bref end-year (2025-26)
  python backfill_team_splits.py 1997 2026    # a range of end-years
"""
import sys
import time
from collections import defaultdict

from nba_api.stats.endpoints import playergamelogs

import bref
from backfill_advanced import load_team_resolver, num, intnum
from backfill_stats import _num, current_season
from db import connect

FIRST_END_YEAR = 1990
# The first season nba.com has game logs for.
FIRST_GAMELOG_END_YEAR = 1997
SLEEP_SECONDS = 1.2

# bref totals data-stat -> column, for the seasons bref supplies the box score.
BREF_BOX = {
    "mp": "mp", "fg": "fgm", "fga": "fga", "fg3": "fg3m", "fg3a": "fg3a",
    "fg2": "fg2m", "fg2a": "fg2a", "ft": "ftm", "fta": "fta", "orb": "orb",
    "drb": "drb", "trb": "reb", "ast": "ast", "stl": "stl", "blk": "blk",
    "tov": "tov", "pf": "pf", "pts": "pts",
}
# nba.com game log column -> column. Summed across a stint's games.
GAMELOG_BOX = {
    "MIN": "mp", "FGM": "fgm", "FGA": "fga", "FG3M": "fg3m", "FG3A": "fg3a",
    "FTM": "ftm", "FTA": "fta", "OREB": "orb", "DREB": "drb", "REB": "reb",
    "AST": "ast", "STL": "stl", "BLK": "blk", "TOV": "tov", "PF": "pf",
    "PTS": "pts",
}
ADVANCED = ["per", "ts_pct", "usg_pct", "ows", "dws", "ws", "obpm", "dbpm", "bpm", "vorp"]

COLUMNS = [
    "team", "stint", "first_game", "last_game", "roster_days", "team_games", "pos", "age", "gp", "gs", "mp",
    "fgm", "fga", "fg_pct", "fg3m", "fg3a", "fg3_pct", "fg2m", "fg2a", "fg2_pct",
    "efg_pct", "ftm", "fta", "ft_pct", "orb", "drb", "reb", "ast", "stl", "blk",
    "tov", "pf", "pts", "source",
] + ADVANCED


def bref_splits(rows, resolve_team):
    """{slug: [(team, row), ...]} for every player with a multi-team summary row.

    The per-team rows follow the summary in the order he played for them.
    """
    by_slug = defaultdict(list)
    traded = set()
    for r in rows:
        slug = r.get("slug")
        if not slug:
            continue
        raw = (r.get("team_name_abbr") or "").strip()
        if raw.endswith("TM") or raw == "TOT":
            traded.add(slug)
            continue
        by_slug[slug].append((resolve_team(raw), r))
    return {slug: by_slug[slug] for slug in traded if len(by_slug[slug]) > 1}


def fetch_gamelogs(season):
    for attempt in range(5):
        try:
            return playergamelogs.PlayerGameLogs(
                season_nullable=season,
                season_type_nullable="Regular Season",
                timeout=90,
            ).get_data_frames()[0]
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  fetch failed ({e}), retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {season} game logs after 5 attempts")


def gamelog_splits(df, player_by_nba_id, team_by_nba_id):
    """{player_id: [stint, ...]} for every player who played for 2+ teams.

    A stint is a dict of summed box-score columns plus team, gp and dates.
    Stints are ordered by first game. A player who goes back to a team he
    already left is folded into that team's one row: the table is keyed by
    team, and bref lists it the same way.
    """
    df = df.sort_values(["PLAYER_ID", "GAME_DATE"])
    out = {}
    skipped = set()
    for nba_id, games in df.groupby("PLAYER_ID"):
        if games["TEAM_ID"].nunique() < 2:
            continue
        pid = player_by_nba_id.get(int(nba_id))
        if pid is None:
            skipped.add(games["PLAYER_NAME"].iloc[0])
            continue
        stints = {}
        for _, g in games.iterrows():
            team = team_by_nba_id.get(int(g["TEAM_ID"]))
            if team not in stints:
                stints[team] = {
                    "team": team, "gp": 0, "first_game": g["GAME_DATE"][:10],
                    **{col: 0.0 for col in GAMELOG_BOX.values()},
                }
            s = stints[team]
            s["gp"] += 1
            s["last_game"] = g["GAME_DATE"][:10]
            for src, col in GAMELOG_BOX.items():
                s[col] += _num(g[src]) or 0.0
        out[pid] = list(stints.values())
    if skipped:
        print(f"  no player row for {len(skipped)} traded players: {sorted(skipped)[:5]}")
    return out


def add_windows(stints_by_player, df, team_by_nba_id):
    """Fill roster_days and team_games on each stint.

    A trade is taken to fall midway between his last game for one team and his
    first for the next. The first stint opens on the season's first game day and
    the last closes on its final one, whether or not he played either night, so
    a stint's window covers the games he missed with that team too.
    """
    from datetime import date, timedelta

    day = date.fromisoformat
    team_days = defaultdict(set)
    for team_id, game_date in df[["TEAM_ID", "GAME_DATE"]].drop_duplicates().itertuples(index=False):
        team_days[team_by_nba_id.get(int(team_id))].add(day(game_date[:10]))
    all_days = set().union(*team_days.values())
    opening, closing = min(all_days), max(all_days)

    for stints in stints_by_player.values():
        start = opening
        for i, s in enumerate(stints):
            if i + 1 < len(stints):
                last, nxt = day(s["last_game"]), day(stints[i + 1]["first_game"])
                end = last + timedelta(days=(nxt - last).days // 2)
            else:
                end = closing
            s["roster_days"] = (end - start).days + 1
            s["team_games"] = sum(1 for d in team_days[s["team"]] if start <= d <= end)
            start = end + timedelta(days=1)


def with_rates(s):
    """Fills the derived columns from the counting ones."""
    fgm, fga, fg3m, fg3a = s["fgm"], s["fga"], s["fg3m"], s["fg3a"]
    if s.get("fg2m") is None and fgm is not None and fg3m is not None:
        s["fg2m"], s["fg2a"] = fgm - fg3m, fga - fg3a

    def pct(made, att):
        return made / att * 100 if made is not None and att else None

    s["fg_pct"] = pct(fgm, fga)
    s["fg3_pct"] = pct(fg3m, fg3a)
    s["fg2_pct"] = pct(s.get("fg2m"), s.get("fg2a"))
    s["ft_pct"] = pct(s["ftm"], s["fta"])
    s["efg_pct"] = (
        (fgm + 0.5 * fg3m) / fga * 100 if fga and fgm is not None and fg3m is not None else None
    )
    return s


def advanced_values(r):
    if r is None:
        return {col: None for col in ADVANCED}
    values = {col: num(r.get(col)) for col in ADVANCED}
    # bref writes TS% as a fraction; the schema stores 0-100.
    if values["ts_pct"] is not None:
        values["ts_pct"] *= 100
    return values


def build_season(end_year, cur, resolve_team, slug_to_id, lookups):
    season = bref.season_label(end_year)
    base = "https://www.basketball-reference.com/leagues"
    totals = bref_splits(
        bref.parse_table(bref.fetch(f"{base}/NBA_{end_year}_totals.html"), "totals_stats"),
        resolve_team,
    )
    advanced = bref_splits(
        bref.parse_table(bref.fetch(f"{base}/NBA_{end_year}_advanced.html"), "advanced"),
        resolve_team,
    )

    # (player_id, team) -> bref row, for the columns only bref has.
    bref_totals, bref_adv, unmatched = {}, {}, set()
    bref_stints = defaultdict(list)
    for source, into in ((totals, bref_totals), (advanced, bref_adv)):
        for slug, rows in source.items():
            pid = slug_to_id.get(slug)
            if pid is None:
                unmatched.add(slug)
                continue
            for team, r in rows:
                into.setdefault((pid, team), r)
                if source is totals and team not in bref_stints[pid]:
                    bref_stints[pid].append(team)
    if unmatched:
        print(f"  {len(unmatched)} bref slugs with no player row: {sorted(unmatched)[:5]}")

    stints_by_player = {}
    if end_year >= FIRST_GAMELOG_END_YEAR:
        player_by_nba_id, team_by_nba_id = lookups
        df = fetch_gamelogs(f"{end_year - 1}-{str(end_year)[2:]}")
        time.sleep(SLEEP_SECONDS)
        for pid, stints in gamelog_splits(df, player_by_nba_id, team_by_nba_id).items():
            for s in stints:
                s["source"] = "nba_api"
            stints_by_player[pid] = stints
        add_windows(stints_by_player, df, team_by_nba_id)
    else:
        for pid, teams in bref_stints.items():
            stints = []
            for team in teams:
                r = bref_totals[(pid, team)]
                s = {col: num(r.get(src)) for src, col in BREF_BOX.items()}
                s.update(team=team, gp=intnum(r.get("games")), source="bref",
                         first_game=None, last_game=None,
                         roster_days=None, team_games=None)
                stints.append(s)
            stints_by_player[pid] = stints

    rows = []
    for pid, stints in stints_by_player.items():
        for i, s in enumerate(stints, start=1):
            if s["team"] is None:
                print(f"  player {pid}: a stint with an unknown team, skipped")
                continue
            r = bref_totals.get((pid, s["team"]))
            s.update(
                stint=i,
                pos=(r.get("pos") or None) if r else None,
                age=intnum(r.get("age")) if r else None,
                gs=intnum(r.get("games_started")) if r else None,
                **advanced_values(bref_adv.get((pid, s["team"]))),
            )
            with_rates(s)
            rows.append([pid, season] + [s.get(c) for c in COLUMNS])

    # production is compute_production.py's column, not this script's. Carry
    # it across the rebuild so a morning run that refreshes the splits before
    # production is recomputed doesn't leave the stints without it.
    cur.execute(
        "SELECT player_id, team, production FROM player_team_splits WHERE season = %s",
        (season,),
    )
    production = {(pid, team): p for pid, team, p in cur.fetchall()}
    cur.execute("DELETE FROM player_team_splits WHERE season = %s", (season,))
    if rows:
        cols = COLUMNS + ["production"]
        rows = [row + [production.get((row[0], row[2]))] for row in rows]
        placeholders = ", ".join(["%s"] * (len(cols) + 2))
        cur.executemany(
            f"""
            INSERT INTO player_team_splits (player_id, season, {", ".join(cols)})
            VALUES ({placeholders})
            """,
            rows,
        )
    missing_adv = sum(1 for row in rows if row[2 + COLUMNS.index("per")] is None)
    print(
        f"  {len(stints_by_player)} traded players, {len(rows)} stints"
        + (f", {missing_adv} without bref advanced" if missing_adv else "")
    )


def main():
    args = [int(a) for a in sys.argv[1:]]
    last = int(current_season()[:4]) + 1
    start, end = (FIRST_END_YEAR, last) if not args else (
        (args[0], args[0]) if len(args) == 1 else (args[0], args[1])
    )

    conn = connect()
    cur = conn.cursor()
    resolve_team = load_team_resolver(cur)
    cur.execute("SELECT bbref_slug, id FROM players WHERE bbref_slug IS NOT NULL")
    slug_to_id = dict(cur.fetchall())
    cur.execute("SELECT nba_person_id, id FROM players WHERE nba_person_id IS NOT NULL")
    player_by_nba_id = dict(cur.fetchall())
    cur.execute("SELECT nba_team_id, abbr FROM teams WHERE nba_team_id IS NOT NULL")
    team_by_nba_id = dict(cur.fetchall())

    for end_year in range(start, end + 1):
        print(f"=== {bref.season_label(end_year)} ===")
        build_season(end_year, cur, resolve_team, slug_to_id, (player_by_nba_id, team_by_nba_id))
        conn.commit()

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
