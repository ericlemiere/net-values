"""Backfills `nba_advanced` from nba_api's leaguedashplayerstats "Advanced" view.

These are nba.com's possession-based numbers — offensive/defensive/net rating,
possessions played, PIE and the rate stats — and they are the intended input to
the net-value model. They are deliberately NOT written into `advanced_stats`,
which holds basketball-reference's box-score formulas (PER, WS, BPM, VORP);
mixing measured and box-estimated numbers in one table would make "advanced"
mean two different things depending on the row.

Coverage starts at 1996-97. Earlier seasons have no play-by-play on nba.com, so
there is nothing to fetch (verified: the endpoint returns an empty frame).

Player identity is nba_person_id straight off the endpoint — no name matching,
so none of the homonym risk the bref backfills carry.

Rate stats arrive as 0-1 fractions and are stored 0-100 like the rest of the
schema. PIE is left as a fraction, which is how it is normally quoted.

Idempotent: upserts on (player_id, season).

Usage:
  python backfill_nba_advanced.py                 # 1996-97 .. current
  python backfill_nba_advanced.py 2024-25         # one nba_api season string
"""
import sys
import time

from nba_api.stats.endpoints import leaguedashplayerstats

from db import connect, NBA_API_SEASONS, to_season_label
from backfill_stats import current_season

SLEEP_SECONDS = 1.5

# endpoint column -> our column, for values stored as-is.
#
# TM_TOV_PCT belongs here, not in PERCENTS: alone among the endpoint's *_PCT
# columns it already arrives as 0-100 (it ranges to ~57 in a full season, and
# to 100 for a player with a single turnover in a single possession). Scaling
# it like the others both corrupted the value and overflowed the column.
DIRECT = {
    "GP": "gp", "MIN": "minutes", "POSS": "poss",
    "OFF_RATING": "off_rating", "DEF_RATING": "def_rating", "NET_RATING": "net_rating",
    "TM_TOV_PCT": "tov_pct", "AST_TO": "ast_to", "PACE": "pace", "PIE": "pie",
}
# endpoint column -> our column, for 0-1 fractions stored 0-100.
PERCENTS = {
    "AST_PCT": "ast_pct", "OREB_PCT": "oreb_pct", "DREB_PCT": "dreb_pct",
    "REB_PCT": "reb_pct", "EFG_PCT": "efg_pct",
    "TS_PCT": "ts_pct", "USG_PCT": "usg_pct",
}
COLUMNS = [
    "team", "gp", "minutes", "poss", "off_rating", "def_rating", "net_rating",
    "ast_pct", "ast_to", "oreb_pct", "dreb_pct", "reb_pct", "tov_pct",
    "efg_pct", "ts_pct", "usg_pct", "pace", "pie", "source",
]


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
                measure_type_detailed_defense="Advanced",
                per_mode_detailed="Totals",
                timeout=60,
            ).get_data_frames()[0]
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  fetch failed ({e}), retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {season} after 5 attempts")


def build_values(r, team_abbr):
    values = {"team": team_abbr, "source": "nba_api"}
    for src, col in DIRECT.items():
        v = num(r.get(src))
        values[col] = int(v) if col in ("gp", "poss") and v is not None else v
    for src, col in PERCENTS.items():
        v = num(r.get(src))
        values[col] = v * 100 if v is not None else None
    return values


def run(seasons):
    conn = connect()
    cur = conn.cursor()

    cur.execute("SELECT nba_team_id, abbr FROM teams WHERE nba_team_id IS NOT NULL")
    team_by_nba_id = dict(cur.fetchall())
    cur.execute("SELECT nba_person_id, id FROM players WHERE nba_person_id IS NOT NULL")
    player_by_nba_id = dict(cur.fetchall())

    placeholders = ", ".join(["%s"] * (len(COLUMNS) + 2))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS)
    total = unknown = 0

    for season in seasons:
        label = to_season_label(season)
        df = fetch(season)
        time.sleep(SLEEP_SECONDS)

        n = miss = 0
        for _, r in df.iterrows():
            player_id = player_by_nba_id.get(int(r["PLAYER_ID"]))
            if player_id is None:
                # Never create players here: this endpoint is a companion to
                # backfill_stats, which owns the players table for this era.
                miss += 1
                continue
            values = build_values(r, team_by_nba_id.get(int(r["TEAM_ID"])))
            cur.execute(
                f"""
                INSERT INTO nba_advanced (player_id, season, {", ".join(COLUMNS)})
                VALUES ({placeholders})
                ON CONFLICT (player_id, season) DO UPDATE SET {updates}
                """,
                [player_id, label] + [values[c] for c in COLUMNS],
            )
            n += 1

        conn.commit()
        total += n
        unknown += miss
        print(f"=== {label} === upserted {n}" + (f", {miss} unknown players skipped" if miss else ""))

    cur.close()
    conn.close()
    print(f"\ntotal rows upserted: {total}" + (f"   skipped (no player row): {unknown}" if unknown else ""))


def main():
    args = sys.argv[1:]
    seasons = args or [s for s in NBA_API_SEASONS if s <= current_season()]
    run(seasons)


if __name__ == "__main__":
    main()
