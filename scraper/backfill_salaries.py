"""Backfills `salaries` and `team_payrolls` from basketball-reference.

Replaces the dead Hoopshype pipeline (their historical season URLs now 404) and
the Spotrac overlay (403 behind Cloudflare). One source, one number per
player-season-team: the actual salary bref lists on each team's season page.

Per season, the team list comes from that season's league page rather than a
hardcoded map, so franchise-era abbreviations (NJN->BRK, CHA->CHO, NOH->NOP) are
always whatever bref actually used that year; team_aliases maps them to
canonical. Team payroll is the sum of that page's salary column.

Player identity resolves through player_index's cascade, and every successful
match pins the bref slug onto the player so subsequent runs are exact lookups.

Idempotent: salaries upsert on (player_id, season, team), team_payrolls on
(team_id, season). Pages are cached on disk by bref.fetch.

Usage:
  python backfill_salaries.py                # 2012..2027 (2011-12 .. 2026-27)
  python backfill_salaries.py 2026 2027      # just those bref end-years
"""
import csv
import re
import sys
from pathlib import Path

import bref
from db import connect
from player_index import PlayerIndex, match_row

DEFAULT_START, DEFAULT_END = 2012, 2027
UNMATCHED_CSV = Path(__file__).parent / "unmatched_bref_salaries.csv"


def season_teams(end_year):
    """Abbreviations bref used for that season, from its league index page."""
    html = bref.fetch(f"https://www.basketball-reference.com/leagues/NBA_{end_year}.html")
    return sorted(set(re.findall(rf"/teams/([A-Z]{{3}})/{end_year}\.html", html)))


def team_salaries(abbr, end_year):
    """[(player_name, bref_slug, salary)] from a team's season page."""
    url = f"https://www.basketball-reference.com/teams/{abbr}/{end_year}.html"
    html = bref.fetch(url)
    uncommented = html.replace("<!--", "").replace("-->", "")
    table = re.search(r'<table[^>]*id="salaries2".*?</table>', uncommented, re.S)
    slugs = re.findall(r"/players/./([a-z0-9]+)\.html", table.group(0)) if table else []

    rows = bref.parse_table(html, "salaries2")
    out = []
    for i, r in enumerate(rows):
        name = r.get("player", "").strip()
        if not name:
            continue
        out.append((name, slugs[i] if i < len(slugs) else None, bref.parse_money(r.get("salary", ""))))
    return out


def load_team_resolver(cur):
    cur.execute("SELECT abbr, id FROM teams")
    canonical = {abbr: tid for abbr, tid in cur.fetchall()}
    cur.execute(
        "SELECT ta.alias, t.abbr, t.id FROM team_aliases ta JOIN teams t ON t.id = ta.team_id"
    )
    aliases = {alias: (abbr, tid) for alias, abbr, tid in cur.fetchall()}

    def resolve(raw):
        if raw in canonical:
            return raw, canonical[raw]
        if raw in aliases:
            return aliases[raw]
        raise KeyError(f"unknown team abbreviation: {raw}")

    return resolve


def main():
    args = [int(a) for a in sys.argv[1:]]
    start, end = (args + [DEFAULT_START, DEFAULT_END])[:2] if not args else (
        (args[0], args[0]) if len(args) == 1 else (args[0], args[1])
    )

    conn = connect()
    cur = conn.cursor()
    resolve_team = load_team_resolver(cur)
    index = PlayerIndex(cur)

    stats = {"matched": 0, "unmatched": 0, "slugs_pinned": 0}
    methods = {}
    unmatched = []

    for end_year in range(start, end + 1):
        season = bref.season_label(end_year)
        abbrs = season_teams(end_year)
        print(f"=== {season} ({len(abbrs)} teams) ===")
        season_rows = 0

        for abbr in abbrs:
            canon_abbr, team_id = resolve_team(abbr)
            entries = team_salaries(abbr, end_year)
            payroll = 0

            for name, slug, salary in entries:
                pid, method, score = match_row(
                    {"name": name, "season": season, "team": canon_abbr, "slug": slug}, index
                )
                methods[method] = methods.get(method, 0) + 1

                if pid is None:
                    stats["unmatched"] += 1
                    unmatched.append([season, canon_abbr, name, slug or "", salary or "", round(score or 0, 1)])
                    continue

                if slug and index.record_slug(cur, pid, slug):
                    stats["slugs_pinned"] += 1

                cur.execute(
                    """
                    INSERT INTO salaries (player_id, season, team, salary, source)
                    VALUES (%s, %s, %s, %s, 'bref')
                    ON CONFLICT (player_id, season, team) DO UPDATE
                      SET salary = EXCLUDED.salary, source = EXCLUDED.source
                    """,
                    (pid, season, canon_abbr, salary),
                )
                stats["matched"] += 1
                season_rows += 1
                payroll += salary or 0

            cur.execute(
                """
                INSERT INTO team_payrolls (team_id, season, payroll, source)
                VALUES (%s, %s, %s, 'bref')
                ON CONFLICT (team_id, season) DO UPDATE
                  SET payroll = EXCLUDED.payroll, source = EXCLUDED.source
                """,
                (team_id, season, payroll),
            )

        conn.commit()
        print(f"  {season_rows} salary rows")

    if unmatched:
        with open(UNMATCHED_CSV, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["season", "team", "name", "slug", "salary", "best_score"])
            w.writerows(unmatched)
        print(f"\nwrote {len(unmatched)} unmatched rows -> {UNMATCHED_CSV.name}")

    cur.close()
    conn.close()

    print(f"\nmatched {stats['matched']}, unmatched {stats['unmatched']}, "
          f"slugs pinned {stats['slugs_pinned']}")
    print("by method:", dict(sorted(methods.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
