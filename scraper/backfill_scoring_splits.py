"""Backfills `player_scoring_splits` from nba_api's "Scoring" measure type.

One column here does real work in the production model: PCT_AST_FGM, the share
of a player's made field goals that a team-mate assisted.

Shooting credit in the model is efficiency above league average times volume,
and without this column that credit lands entirely on whoever finished the
play. Centers living on lobs and dunks then price out as elite offensive
players — in testing, Ivica Zubac, Jalen Duren and Luke Kornet all turned up
in a season's top fifteen. Scaling the credit by how much of it the player
created for himself is the correction, and nothing in a box score can stand in
for it.

The points splits (paint, three, free throw, fast break) are along for the
ride: they arrive on the same request, cost nothing to store, and are the
obvious thing to show on a player page later.

Rates arrive as 0-1 fractions and are stored 0-100 to match the rest of the
schema.

Coverage is 1996-97 onward. Earlier seasons fall back to the league mean in
compute_production.py, which is the honest treatment — the split is genuinely
unknown then, not zero.

Idempotent: upserts on (player_id, season).

Usage:
  python backfill_scoring_splits.py               # 1996-97 .. current
  python backfill_scoring_splits.py 2024-25       # one nba_api season string
"""
import sys
import time

from nba_api.stats.endpoints import leaguedashplayerstats

from db import connect, NBA_API_SEASONS, to_season_label
from backfill_stats import current_season

SLEEP_SECONDS = 1.4

# endpoint column -> our column, for 0-1 fractions stored 0-100.
PERCENTS = {
    "PCT_AST_FGM": "pct_ast_fgm",
    "PCT_PTS_PAINT": "pct_pts_paint",
    "PCT_PTS_3PT": "pct_pts_3pt",
    "PCT_PTS_FT": "pct_pts_ft",
    "PCT_PTS_FB": "pct_pts_fb",
}
COLUMNS = ["team"] + list(PERCENTS.values()) + ["source"]


def num(x):
    """numpy/pandas scalar (incl. NaN) -> a plain float psycopg2 can adapt."""
    if x is None:
        return None
    try:
        import math

        f = float(x)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def fetch(season):
    for attempt in range(5):
        try:
            return leaguedashplayerstats.LeagueDashPlayerStats(
                season=season,
                season_type_all_star="Regular Season",
                measure_type_detailed_defense="Scoring",
                per_mode_detailed="Totals",
                timeout=60,
            ).get_data_frames()[0]
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  fetch failed ({e}), retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {season} after 5 attempts")


def seasons_through_current():
    last = current_season()
    return [s for s in NBA_API_SEASONS if s <= last]


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    seasons = [only] if only else seasons_through_current()

    conn = connect()
    cur = conn.cursor()
    cur.execute("SELECT nba_person_id, id FROM players WHERE nba_person_id IS NOT NULL")
    player_ids = dict(cur.fetchall())

    written = missing = 0
    for season in seasons:
        df = fetch(season)
        label = to_season_label(season)
        for r in df.to_dict("records"):
            player_id = player_ids.get(int(r["PLAYER_ID"]))
            if player_id is None:
                # A player nobody has imported yet. backfill_stats.py owns
                # creating player rows; this script only annotates them.
                missing += 1
                continue
            values = {"team": r.get("TEAM_ABBREVIATION"), "source": "nba_api"}
            for src, dest in PERCENTS.items():
                v = num(r.get(src))
                values[dest] = None if v is None else round(100.0 * v, 2)
            cur.execute(
                f"""
                INSERT INTO player_scoring_splits (player_id, season, {", ".join(COLUMNS)})
                VALUES ({", ".join(["%s"] * (len(COLUMNS) + 2))})
                ON CONFLICT (player_id, season) DO UPDATE SET
                    {", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS)}
                """,
                [player_id, label] + [values[c] for c in COLUMNS],
            )
            written += 1
        conn.commit()
        print(f"{label}: {len(df)} players")
        time.sleep(SLEEP_SECONDS)

    cur.close()
    conn.close()
    print(f"\nwrote {written} player-seasons ({missing} skipped, no player row)")


if __name__ == "__main__":
    main()
