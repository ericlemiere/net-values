"""Backfills `advanced_stats` from basketball-reference league pages.

PER / TS% / WS / BPM / VORP are bref-only formulas — nba.com's stats API does
not expose them — so this is the only source for that table.

Covers bref end-years 2023..2026 by default. 2022-23 is included deliberately:
the legacy SQLite data for that season was scraped about eight games in (avg 5.5
GP, max 8) and has been sitting in the table looking like a full season, so it
gets overwritten rather than kept.

A traded player appears on bref as a "2TM"/"3TM" season-summary row plus one row
per team. advanced_stats is unique on (player_id, season), so only the summary
row is kept for those players, with team left NULL — the same convention the
legacy migration used for "TOT".

Percentages are stored 0-100 to match the rest of the schema, so bref's
fractional ".585" becomes 58.5.

Idempotent: upserts on (player_id, season).

Usage:
  python backfill_advanced.py            # 2023..2026
  python backfill_advanced.py 2026       # one bref end-year
"""
import csv
import sys
from pathlib import Path

import bref
from db import connect
from player_index import PlayerIndex, match_row

DEFAULT_START, DEFAULT_END = 2023, 2026
UNMATCHED_CSV = Path(__file__).parent / "unmatched_bref_advanced.csv"

# bref data-stat -> advanced_stats column. Percent columns are scaled separately.
DIRECT = {
    "per": "per", "usg_pct": "usg_pct", "ows": "ows", "dws": "dws", "ws": "ws",
    "obpm": "obpm", "dbpm": "dbpm", "bpm": "bpm", "vorp": "vorp",
}
COLUMNS = [
    "team", "pos", "age", "gp", "mp", "per", "ts_pct", "usg_pct",
    "ows", "dws", "ws", "obpm", "dbpm", "bpm", "vorp", "source",
]


def num(text):
    if text in (None, "", "-"):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def intnum(text):
    v = num(text)
    return int(v) if v is not None else None


def build_values(r, team):
    # bref writes rate stats as fractions (".585"); the schema stores 0-100.
    ts = num(r.get("ts_pct"))
    values = {
        "team": team,
        "pos": (r.get("pos") or None),
        "age": intnum(r.get("age")),
        "gp": intnum(r.get("games")),
        "mp": intnum(r.get("mp")),
        "ts_pct": ts * 100 if ts is not None else None,
        "source": "bref",
    }
    for src, col in DIRECT.items():
        values[col] = num(r.get(src))
    return values


def pick_rows(rows):
    """One row per player: the multi-team summary when there is one."""
    best = {}
    for r in rows:
        slug = r.get("slug")
        if not slug:
            continue
        team = (r.get("team_name_abbr") or "").strip()
        # A summary row always wins; otherwise first row for the player wins.
        if slug not in best or team.endswith("TM"):
            best[slug] = r
    return best


def load_team_resolver(cur):
    cur.execute("SELECT abbr FROM teams")
    canonical = {row[0] for row in cur.fetchall()}
    cur.execute("SELECT ta.alias, t.abbr FROM team_aliases ta JOIN teams t ON t.id = ta.team_id")
    aliases = dict(cur.fetchall())

    def resolve(raw):
        raw = (raw or "").strip()
        # "2TM"/"3TM" summary rows aren't a single team.
        if not raw or raw.endswith("TM") or raw == "TOT":
            return None
        if raw in canonical:
            return raw
        return aliases.get(raw, raw)

    return resolve


def main():
    args = [int(a) for a in sys.argv[1:]]
    start, end = (DEFAULT_START, DEFAULT_END) if not args else (
        (args[0], args[0]) if len(args) == 1 else (args[0], args[1])
    )

    conn = connect()
    cur = conn.cursor()
    resolve_team = load_team_resolver(cur)
    index = PlayerIndex(cur)

    unmatched, methods = [], {}
    placeholders = ", ".join(["%s"] * (len(COLUMNS) + 2))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS)

    for end_year in range(start, end + 1):
        season = bref.season_label(end_year)
        url = f"https://www.basketball-reference.com/leagues/NBA_{end_year}_advanced.html"
        rows = bref.parse_table(bref.fetch(url), "advanced")
        chosen = pick_rows(rows)
        print(f"=== {season} ({len(chosen)} players) ===")

        n = 0
        for slug, r in chosen.items():
            name = r.get("name_display", "").strip()
            team = resolve_team(r.get("team_name_abbr"))
            pid, method, score = match_row(
                {"name": name, "season": season, "team": team, "slug": slug}, index
            )
            methods[method] = methods.get(method, 0) + 1
            if pid is None:
                unmatched.append([season, team or "", name, slug, round(score or 0, 1)])
                continue

            index.record_slug(cur, pid, slug)
            values = build_values(r, team)
            cur.execute(
                f"""
                INSERT INTO advanced_stats (player_id, season, {", ".join(COLUMNS)})
                VALUES ({placeholders})
                ON CONFLICT (player_id, season) DO UPDATE SET {updates}
                """,
                [pid, season] + [values[c] for c in COLUMNS],
            )
            n += 1

        conn.commit()
        print(f"  upserted {n}")

    if unmatched:
        with open(UNMATCHED_CSV, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["season", "team", "name", "slug", "best_score"])
            w.writerows(unmatched)
        print(f"\nwrote {len(unmatched)} unmatched -> {UNMATCHED_CSV.name}")

    cur.close()
    conn.close()
    print("by method:", dict(sorted(methods.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
