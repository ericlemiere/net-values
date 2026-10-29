"""Adds every player on a current NBA roster who isn't in `players` yet.

Players are otherwise created by backfill_stats.py, the first time nba.com has
a box score for them. That leaves a rookie (or anyone signed who hasn't played)
out of `players` entirely, so his contract can't be matched and he's missing
from the salaries pages until his debut. nba.com's current-season player list
(commonallplayers, one request) has everyone on a roster, games or not.

Each one is created under his nba.com person id, the same key backfill_stats
looks players up by, so his debut finds this row instead of making a second
one. backfill_salaries.py then matches his contract to him by name.

Idempotent: a player already on file is left alone.

Usage:
  python seed_rosters.py             # the season now in progress
  python seed_rosters.py 2026-27     # an explicit nba_api season string
"""
import sys

from nba_api.stats.endpoints import commonallplayers

import nba

from backfill_stats import current_season
from db import connect


def fetch(season: str):
    return nba.frames(
        commonallplayers.CommonAllPlayers,
        f"{season} rosters",
        is_only_current_season=1,
        season=season,
        timeout=60,
    )[0]


def main():
    season = sys.argv[1] if len(sys.argv) > 1 else current_season()
    df = fetch(season)
    # ROSTERSTATUS is 1 for a player on a team today; the list also carries
    # anyone who appeared this season and has since been let go.
    rostered = df[df["ROSTERSTATUS"] == 1]

    conn = connect()
    with conn, conn.cursor() as cur:
        cur.execute("SELECT nba_person_id FROM players WHERE nba_person_id IS NOT NULL")
        known = {row[0] for row in cur.fetchall()}

        added = []
        for _, r in rostered.iterrows():
            nba_id = int(r["PERSON_ID"])
            if nba_id in known:
                continue
            name = r["DISPLAY_FIRST_LAST"]
            cur.execute(
                """
                INSERT INTO players (name, nba_person_id) VALUES (%s, %s)
                ON CONFLICT (nba_person_id) DO NOTHING
                """,
                (name, nba_id),
            )
            added.append(f"{name} ({r['TEAM_ABBREVIATION']})")
    conn.close()

    print(f"{len(rostered)} rostered players, {len(added)} new")
    for name in added:
        print(f"  + {name}")


if __name__ == "__main__":
    main()
