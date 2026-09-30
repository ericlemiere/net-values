"""Backfills `player_on_off` from nba_api's teamplayeronoffsummary.

For every player on a roster: the team's offensive, defensive and net rating
with him on the floor, and the same three with him off it, with the minutes
behind each. One request per team per season, so a traded player comes back
once for each team he played for, which is the only way on/off means anything
— it is a comparison against the rest of one roster.

Coverage starts at 2007-08. nba.com has play-by-play from 1996-97 (which is
where nba_advanced starts), but this endpoint returns empty player frames for
every season before 2007-08 — checked 1996-97, 2000-01, 2005-06 and 2006-07.
Which teams to ask for comes from team_seasons, so a
franchise is only requested for seasons it actually played.

Player identity is nba_person_id off the endpoint, as in
backfill_nba_advanced.py. Players we have no row for are skipped, never
created: backfill_stats owns the players table.

Nothing reads this table yet. It is the raw material for a possible on/off
tilt to how compute_production.py splits a team's credit between its players.

Idempotent: upserts on (player_id, season, team).

Usage:
  python backfill_on_off.py                 # 2007-08 .. current
  python backfill_on_off.py 2024-25         # one or more nba_api season strings
"""
import sys
import time

from nba_api.stats.endpoints import teamplayeronoffsummary

from db import connect, NBA_API_SEASONS, to_season_label
from backfill_nba_advanced import num
from backfill_stats import current_season

SLEEP_SECONDS = 1.5

# The first season the endpoint has player on/off for.
FIRST_SEASON = "2007-08"

# Per side of the court: our column suffix -> endpoint column.
SIDE_COLUMNS = {
    "min": "MIN", "off_rating": "OFF_RATING",
    "def_rating": "DEF_RATING", "net_rating": "NET_RATING",
}
COLUMNS = [
    "gp_on",
    "min_on", "off_rating_on", "def_rating_on", "net_rating_on",
    "min_off", "off_rating_off", "def_rating_off", "net_rating_off",
    "source",
]


def fetch(nba_team_id, season):
    """(on rows, off rows) as DataFrames, whichever order the endpoint sends."""
    for attempt in range(5):
        try:
            frames = teamplayeronoffsummary.TeamPlayerOnOffSummary(
                team_id=nba_team_id,
                season=season,
                season_type_all_star="Regular Season",
                timeout=60,
            ).get_data_frames()
            players = [f for f in frames[1:] if "COURT_STATUS" in f.columns]
            on = next((f for f in players if (f["COURT_STATUS"] == "On").all()), None)
            off = next((f for f in players if (f["COURT_STATUS"] == "Off").all()), None)
            return on, off
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  fetch failed ({e}), retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch team {nba_team_id} {season} after 5 attempts")


def run(seasons):
    # Nothing is held open while nba.com is being fetched. A season's thirty
    # requests can take several minutes when the endpoint is slow, and Neon
    # closes an idle connection long before that — the first full run died on
    # its commit after a 60-second read timeout. So: read what's needed, close,
    # fetch every team, then reconnect just to write.
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT nba_person_id, id FROM players WHERE nba_person_id IS NOT NULL")
        player_by_nba_id = dict(cur.fetchall())
        cur.execute(
            """
            SELECT ts.season, t.nba_team_id, t.abbr
            FROM team_seasons ts JOIN teams t ON t.id = ts.team_id
            WHERE t.nba_team_id IS NOT NULL
            ORDER BY t.abbr
            """
        )
        teams_by_season = {}
        for label, nba_team_id, abbr in cur.fetchall():
            teams_by_season.setdefault(label, []).append((nba_team_id, abbr))
    conn.close()

    placeholders = ", ".join(["%s"] * (len(COLUMNS) + 3))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS)
    total = unknown = 0

    for season in seasons:
        label = to_season_label(season)
        teams = teams_by_season.get(label, [])

        rows = []
        miss = 0
        for nba_team_id, abbr in teams:
            on, off = fetch(nba_team_id, season)
            time.sleep(SLEEP_SECONDS)
            if on is None or on.empty:
                continue
            off_by_player = (
                {int(r["VS_PLAYER_ID"]): r for _, r in off.iterrows()}
                if off is not None else {}
            )
            for _, r in on.iterrows():
                player_id = player_by_nba_id.get(int(r["VS_PLAYER_ID"]))
                if player_id is None:
                    miss += 1
                    continue
                o = off_by_player.get(int(r["VS_PLAYER_ID"]))
                values = {"gp_on": int(num(r["GP"])) if num(r["GP"]) is not None else None,
                          "source": "nba_api"}
                for col, src in SIDE_COLUMNS.items():
                    values[f"{col}_on"] = num(r[src])
                    values[f"{col}_off"] = num(o[src]) if o is not None else None
                rows.append([player_id, label, abbr] + [values[c] for c in COLUMNS])

        if rows:
            conn = connect()
            with conn, conn.cursor() as cur:
                cur.executemany(
                    f"""
                    INSERT INTO player_on_off (player_id, season, team, {", ".join(COLUMNS)})
                    VALUES ({placeholders})
                    ON CONFLICT (player_id, season, team) DO UPDATE SET {updates}
                    """,
                    rows,
                )
            conn.close()
        total += len(rows)
        unknown += miss
        print(f"=== {label} === {len(teams)} teams, upserted {len(rows)}"
              + (f", {miss} unknown players skipped" if miss else ""), flush=True)

    print(f"\ntotal rows upserted: {total}"
          + (f"   skipped (no player row): {unknown}" if unknown else ""))


def main():
    args = sys.argv[1:]
    seasons = args or [s for s in NBA_API_SEASONS if FIRST_SEASON <= s <= current_season()]
    run(seasons)


if __name__ == "__main__":
    main()
