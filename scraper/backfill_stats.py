"""
Phase 1: backfill player_stats_totals and player_stats_per_game for every
season 1996-97 through 2025-26 from nba_api's leaguedashplayerstats endpoint.
Also populates players.nba_person_id (creating player rows as needed).

Idempotent: upserts on (player_id, season) so re-running never duplicates rows.

Note: advanced_stats is intentionally NOT touched here — nba.com's stats API
doesn't expose PER/Win Shares/BPM/VORP (basketball-reference-only formulas),
so advanced_stats is sourced entirely from the SQLite migration instead (see
migrate_pre96.ts... actually scripts/migrate-legacy.ts, all years 1989-2023).

Neither position nor GS (games started) is available from any league-wide
nba_api endpoint — leaguedashplayerstats returns neither, and
leaguedashplayerbiostats has no position field either. Both are written NULL
here and backfilled from basketball-reference by backfill_bref_stats.py, which
is why this script preserves them on conflict rather than overwriting.
"""
import sys
import time

from nba_api.stats.endpoints import leaguedashplayerstats

from db import connect, NBA_API_SEASONS, to_season_label

SLEEP_SECONDS = 1.2


def fetch(season: str, per_mode: str):
    for attempt in range(5):
        try:
            r = leaguedashplayerstats.LeagueDashPlayerStats(
                season=season,
                season_type_all_star="Regular Season",
                per_mode_detailed=per_mode,
                timeout=60,
            )
            return r.get_data_frames()[0]
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  fetch failed ({e}), retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {season} {per_mode} after 5 attempts")


def _num(x):
    """Cast numpy/pandas scalars (incl. NaN) to native Python types psycopg2 can adapt."""
    if x is None:
        return None
    try:
        import math

        f = float(x)
        if math.isnan(f):
            return None
    except (TypeError, ValueError):
        return x
    return f


def derive_row(r, team_abbr, source):
    fgm, fga = _num(r["FGM"]), _num(r["FGA"])
    fg3m, fg3a = _num(r["FG3M"]), _num(r["FG3A"])
    fg2m = fgm - fg3m if fgm is not None and fg3m is not None else None
    fg2a = fga - fg3a if fga is not None and fg3a is not None else None

    def pct(x):
        # nba_api returns 0-1 fractions; the rest of this app (and the
        # legacy bbref data it was migrated from) stores percentages as
        # 0-100 values, e.g. 48.4 rather than 0.484 (see lib/format.ts
        # formatPercent, which just appends "%" to the raw number).
        v = _num(x)
        return v * 100 if v is not None else None

    return {
        "team": team_abbr,
        "pos": None,  # leaguedashplayerstats doesn't return position
        "age": int(_num(r["AGE"])) if _num(r["AGE"]) is not None else None,
        "gp": int(_num(r["GP"])),
        "gs": None,
        "mp": _num(r["MIN"]),
        "fgm": fgm,
        "fga": fga,
        "fg_pct": pct(r["FG_PCT"]),
        "fg3m": fg3m,
        "fg3a": fg3a,
        "fg3_pct": pct(r["FG3_PCT"]),
        "fg2m": fg2m,
        "fg2a": fg2a,
        "fg2_pct": (fg2m / fg2a * 100) if fg2a else None,
        "efg_pct": ((fgm + 0.5 * fg3m) / fga * 100) if fga else None,
        "ftm": _num(r["FTM"]),
        "fta": _num(r["FTA"]),
        "ft_pct": pct(r["FT_PCT"]),
        "orb": _num(r["OREB"]),
        "drb": _num(r["DREB"]),
        "reb": _num(r["REB"]),
        "ast": _num(r["AST"]),
        "stl": _num(r["STL"]),
        "blk": _num(r["BLK"]),
        "tov": _num(r["TOV"]),
        "pf": _num(r["PF"]),
        "pts": _num(r["PTS"]),
        "source": source,
    }


COLUMNS = [
    "team", "pos", "age", "gp", "gs", "mp", "fgm", "fga", "fg_pct", "fg3m", "fg3a",
    "fg3_pct", "fg2m", "fg2a", "fg2_pct", "efg_pct", "ftm", "fta", "ft_pct", "orb",
    "drb", "reb", "ast", "stl", "blk", "tov", "pf", "pts", "source",
]

# Columns this importer always writes as NULL (see above) but another source
# can fill in — backfill_bref_stats.py patches both from bref. They are set on
# INSERT, where nothing is known yet, and left alone on CONFLICT, so the daily
# refresh can overwrite the season-to-date numbers without wiping them.
PRESERVE_ON_CONFLICT = ("pos", "gs")


def upsert_stat_row(cur, table, player_id, season, values):
    cols = ["player_id", "season"] + COLUMNS
    placeholders = ", ".join(["%s"] * len(cols))
    updates = ", ".join(
        f"{c} = EXCLUDED.{c}" for c in COLUMNS if c not in PRESERVE_ON_CONFLICT
    )
    row = [player_id, season] + [values[c] for c in COLUMNS]
    cur.execute(
        f"""
        INSERT INTO {table} ({", ".join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (player_id, season) DO UPDATE SET {updates}
        """,
        row,
    )


def current_season() -> str:
    """The nba_api season string for the season now in progress.

    An NBA season spans October through June and is labeled by its start year,
    so anything before October belongs to the season that started last year.
    """
    from datetime import date

    today = date.today()
    start = today.year if today.month >= 10 else today.year - 1
    return f"{start}-{str(start + 1)[2:]}"


def run(seasons):
    conn = connect()
    cur = conn.cursor()

    cur.execute("SELECT nba_team_id, abbr FROM teams")
    teams_by_nba_id = {row[0]: row[1] for row in cur.fetchall()}

    cur.execute("SELECT nba_person_id, id FROM players WHERE nba_person_id IS NOT NULL")
    player_id_by_nba_id = {row[0]: row[1] for row in cur.fetchall()}

    season_counts = {}

    for season in seasons:
        label = to_season_label(season)
        print(f"=== {season} ({label}) ===")

        totals_df = fetch(season, "Totals")
        time.sleep(SLEEP_SECONDS)
        pergame_df = fetch(season, "PerGame")
        time.sleep(SLEEP_SECONDS)

        pergame_by_player = {row["PLAYER_ID"]: row for _, row in pergame_df.iterrows()}

        n = 0
        for _, r in totals_df.iterrows():
            nba_id = int(r["PLAYER_ID"])
            name = r["PLAYER_NAME"]
            team_id = int(r["TEAM_ID"])
            team_abbr = teams_by_nba_id.get(team_id)

            player_id = player_id_by_nba_id.get(nba_id)
            if player_id is None:
                cur.execute(
                    """
                    INSERT INTO players (name, nba_person_id) VALUES (%s, %s)
                    ON CONFLICT (nba_person_id) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                    """,
                    (name, nba_id),
                )
                player_id = cur.fetchone()[0]
                player_id_by_nba_id[nba_id] = player_id

            totals_values = derive_row(r, team_abbr, "nba_api")
            upsert_stat_row(cur, "player_stats_totals", player_id, label, totals_values)

            pg_row = pergame_by_player.get(nba_id)
            if pg_row is not None:
                pg_values = derive_row(pg_row, team_abbr, "nba_api")
                upsert_stat_row(cur, "player_stats_per_game", player_id, label, pg_values)

            n += 1

        conn.commit()
        season_counts[label] = n
        print(f"  upserted {n} players")

    cur.close()
    conn.close()

    print("\n=== Season row counts ===")
    for label, n in season_counts.items():
        flag = "" if 450 <= n <= 600 else "  <-- outside expected 450-600 range"
        print(f"{label}: {n}{flag}")


def main():
    # No args: every season from 1996-97 on. Otherwise the seasons named,
    # in nba_api's "2025-26" format.
    seasons = sys.argv[1:] or NBA_API_SEASONS
    run(seasons)


if __name__ == "__main__":
    main()
