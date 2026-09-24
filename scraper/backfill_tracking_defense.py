"""Backfills `player_tracking_defense` from nba_api's two tracking endpoints.

This is the only data in the project that can see a perimeter defender.

Box-score defense is three counting stats — steals, blocks, defensive rebounds
— and they describe rim protection reasonably and wing defense not at all. A
model fitted to 36 seasons of All-Defensive voting on box stats alone puts
Jaden McDaniels in the 5th percentile of defenders and Draymond Green in the
67th, because neither gambles for steals. The same model with these columns
added puts Green in the 98th, and identifies All-Defensive selections at AUC
0.915 against 0.866 for the box alone.

Two endpoints, two start dates, which is why the columns are nullable in
blocks rather than together:

  leaguedashptdefend       2013-14+  shots the player defended, what those
                                     shooters shot against him, and what they
                                     shoot normally
  leaguehustlestatsplayer  2015-16+  deflections, contested shots, loose balls
                                     recovered, charges drawn

The single most useful figure is the first one's difference: how much worse
shooters were with this man defending them, times how many shots he defended.
Deflections add most of the rest.

A note on what this is NOT allowed to do. The model uses these columns only to
weight how a team's defensive performance is divided among its own players,
never to change the size of what is being divided. A season with cameras and a
season without therefore still produce numbers on the same scale — it is the
split that gets sharper, not the total.

Idempotent: upserts on (player_id, season), and the two endpoints write
disjoint column sets, so either can run without clobbering the other.

Usage:
  python backfill_tracking_defense.py             # 2013-14 .. current
  python backfill_tracking_defense.py 2024-25     # one nba_api season string
"""
import sys
import time

from nba_api.stats.endpoints import leaguedashptdefend, leaguehustlestatsplayer

from db import connect, to_season_label
from backfill_stats import current_season

SLEEP_SECONDS = 1.4

# Tracking cameras were installed league-wide for 2013-14; the hustle box score
# is a later product built on the same feed.
FIRST_DEFEND_SEASON = 2013
FIRST_HUSTLE_SEASON = 2015

DEFEND_COLUMNS = ["team", "d_fga", "d_fgm", "d_fg_pct", "normal_fg_pct", "source"]
HUSTLE_COLUMNS = [
    "deflections", "contested_shots", "loose_balls_recovered", "charges_drawn",
    "source",
]


def num(x):
    if x is None:
        return None
    try:
        import math

        f = float(x)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def retrying(fn, what):
    for attempt in range(5):
        try:
            return fn()
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  {what} failed ({e}), retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {what} after 5 attempts")


def fetch_defend(season):
    return retrying(
        lambda: leaguedashptdefend.LeagueDashPtDefend(
            season=season,
            season_type_all_star="Regular Season",
            defense_category="Overall",
            per_mode_simple="Totals",
            timeout=90,
        ).get_data_frames()[0],
        f"ptdefend {season}",
    )


def fetch_hustle(season):
    return retrying(
        lambda: leaguehustlestatsplayer.LeagueHustleStatsPlayer(
            season=season,
            season_type_all_star="Regular Season",
            per_mode_time="Totals",
            timeout=90,
        ).get_data_frames()[0],
        f"hustle {season}",
    )


def upsert(cur, player_id, season, columns, values):
    """Write one endpoint's columns, leaving the other endpoint's alone."""
    cur.execute(
        f"""
        INSERT INTO player_tracking_defense (player_id, season, {", ".join(columns)})
        VALUES ({", ".join(["%s"] * (len(columns) + 2))})
        ON CONFLICT (player_id, season) DO UPDATE SET
            {", ".join(f"{c} = EXCLUDED.{c}" for c in columns)}
        """,
        [player_id, season] + [values[c] for c in columns],
    )


def seasons_from(first):
    last = int(current_season()[:4])
    return [f"{y}-{str(y + 1)[2:]}" for y in range(first, last + 1)]


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None

    conn = connect()
    cur = conn.cursor()
    cur.execute("SELECT nba_person_id, id FROM players WHERE nba_person_id IS NOT NULL")
    player_ids = dict(cur.fetchall())

    defend_seasons = [only] if only else seasons_from(FIRST_DEFEND_SEASON)
    hustle_seasons = [only] if only else seasons_from(FIRST_HUSTLE_SEASON)
    if only and int(only[:4]) < FIRST_HUSTLE_SEASON:
        hustle_seasons = []
    if only and int(only[:4]) < FIRST_DEFEND_SEASON:
        defend_seasons = []

    defended = hustled = missing = 0
    for season in defend_seasons:
        df = fetch_defend(season)
        label = to_season_label(season)
        for r in df.to_dict("records"):
            player_id = player_ids.get(int(r["CLOSE_DEF_PERSON_ID"]))
            if player_id is None:
                missing += 1
                continue
            pct = lambda k: (None if num(r.get(k)) is None else round(100.0 * num(r[k]), 2))
            upsert(
                cur, player_id, label, DEFEND_COLUMNS,
                {
                    "team": r.get("PLAYER_LAST_TEAM_ABBREVIATION"),
                    "d_fga": int(r["D_FGA"]) if num(r.get("D_FGA")) is not None else None,
                    "d_fgm": int(r["D_FGM"]) if num(r.get("D_FGM")) is not None else None,
                    "d_fg_pct": pct("D_FG_PCT"),
                    "normal_fg_pct": pct("NORMAL_FG_PCT"),
                    "source": "nba_api",
                },
            )
            defended += 1
        conn.commit()
        print(f"{label}: {len(df)} defenders")
        time.sleep(SLEEP_SECONDS)

    for season in hustle_seasons:
        df = fetch_hustle(season)
        label = to_season_label(season)
        for r in df.to_dict("records"):
            player_id = player_ids.get(int(r["PLAYER_ID"]))
            if player_id is None:
                missing += 1
                continue
            upsert(
                cur, player_id, label, HUSTLE_COLUMNS,
                {
                    "deflections": num(r.get("DEFLECTIONS")),
                    "contested_shots": num(r.get("CONTESTED_SHOTS")),
                    "loose_balls_recovered": num(r.get("LOOSE_BALLS_RECOVERED")),
                    "charges_drawn": num(r.get("CHARGES_DRAWN")),
                    "source": "nba_api",
                },
            )
            hustled += 1
        conn.commit()
        print(f"{label}: {len(df)} hustle rows")
        time.sleep(SLEEP_SECONDS)

    cur.close()
    conn.close()
    print(
        f"\nwrote {defended} defended-shot rows, {hustled} hustle rows "
        f"({missing} skipped, no player row)"
    )


if __name__ == "__main__":
    main()
