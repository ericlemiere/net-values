"""Backfills `team_seasons`: win-loss record, SRS, playoff berth and champion.

Two basketball-reference pages per run:
  /leagues/                          the season index, one row per season with
                                     that season's champion.
  /leagues/NBA_<year>_standings.html the conference standings, which carry
                                     wins, losses, SRS, and a "*" on every team
                                     that made the playoffs.

Teams are keyed off the abbreviation in each row's team link (/teams/ORL/1995)
rather than the displayed name, so defunct and relocated franchises resolve
exactly — NJN, WSB, SEA and friends go through team_aliases like everywhere
else. No fuzzy matching, so this cannot misattribute the way a name match can.

nba_api would give records too, but only from 1996-97; bref covers every season
we hold salary data for, so it is the single source here.

Idempotent: upserts on (team_id, season).

Usage:
  python backfill_teams.py                # 1991..2026 (bref end-years)
  python backfill_teams.py 2026           # one season
  python backfill_teams.py 1991 2000      # a range
"""
import re
import sys

from bs4 import BeautifulSoup

import bref
from db import connect

# Our salary data starts in 1990-91, so that's the earliest season worth a row.
DEFAULT_START, DEFAULT_END = 1991, 2026

COLUMNS = ["wins", "losses", "srs", "made_playoffs", "champion", "source"]


def num(text):
    if text in (None, "", "-", "—"):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def load_team_resolver(cur):
    cur.execute("SELECT abbr, id FROM teams")
    canonical = dict(cur.fetchall())
    cur.execute("SELECT ta.alias, t.id FROM team_aliases ta JOIN teams t ON t.id = ta.team_id")
    aliases = dict(cur.fetchall())

    def resolve(abbr):
        return canonical.get(abbr) or aliases.get(abbr)

    return resolve


def champions_by_season():
    """{'2023-2024': 'Boston Celtics'} from the league index."""
    soup = BeautifulSoup(
        bref.fetch("https://www.basketball-reference.com/leagues/")
        .replace("<!--", "").replace("-->", ""),
        "lxml",
    )
    table = soup.find("table", id="stats")
    out = {}
    for tr in (table.find("tbody") or table).find_all("tr"):
        cells = {c.get("data-stat"): c.get_text(strip=True) for c in tr.find_all(["th", "td"])}
        season, champ, lg = cells.get("season"), cells.get("champion"), cells.get("lg_id")
        if not season or lg != "NBA" or not champ:
            continue
        # bref writes "2023-24"; the schema uses "2023-2024".
        start = int(season[:4])
        out[f"{start}-{start + 1}"] = champ
    return out


def standings(end_year):
    """[(abbr, wins, losses, srs, made_playoffs)] for one season."""
    html = bref.fetch(
        f"https://www.basketball-reference.com/leagues/NBA_{end_year}_standings.html"
    )
    soup = BeautifulSoup(html.replace("<!--", "").replace("-->", ""), "lxml")
    rows = []
    for tid in ("divs_standings_E", "divs_standings_W"):
        table = soup.find("table", id=tid)
        if table is None:
            continue
        for tr in (table.find("tbody") or table).find_all("tr"):
            th = tr.find("th")
            link = th.find("a") if th else None
            if link is None:
                continue  # a division header row, not a team
            m = re.search(r"/teams/([A-Z]{3})/", link["href"])
            if not m:
                continue
            cells = {c.get("data-stat"): c.get_text(strip=True) for c in tr.find_all("td")}
            rows.append((
                m.group(1),
                int(num(cells.get("wins")) or 0),
                int(num(cells.get("losses")) or 0),
                num(cells.get("srs")),
                "*" in th.get_text(),
            ))
    return rows


def main():
    years = [int(a) for a in sys.argv[1:]]
    start, end = (DEFAULT_START, DEFAULT_END) if not years else (
        (years[0], years[0]) if len(years) == 1 else (years[0], years[1])
    )

    conn = connect()
    cur = conn.cursor()
    resolve = load_team_resolver(cur)
    champs = champions_by_season()

    cur.execute("SELECT id, name FROM teams")
    team_name_to_id = {name: tid for tid, name in cur.fetchall()}

    placeholders = ", ".join(["%s"] * (len(COLUMNS) + 2))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS)
    total, unresolved = 0, []

    for end_year in range(start, end + 1):
        season = bref.season_label(end_year)
        champ_name = champs.get(season)
        champ_id = team_name_to_id.get(champ_name) if champ_name else None
        if champ_name and champ_id is None:
            # A franchise that has since been renamed (e.g. a 1990s champion
            # under an old name). Fall back to matching on the last word.
            for name, tid in team_name_to_id.items():
                if name.split()[-1] == champ_name.split()[-1]:
                    champ_id = tid
                    break

        rows = standings(end_year)
        n = 0
        for abbr, wins, losses, srs, playoffs in rows:
            team_id = resolve(abbr)
            if team_id is None:
                unresolved.append((season, abbr))
                continue
            values = [wins, losses, srs, playoffs, team_id == champ_id, "bref"]
            cur.execute(
                f"""
                INSERT INTO team_seasons (team_id, season, {", ".join(COLUMNS)})
                VALUES ({placeholders})
                ON CONFLICT (team_id, season) DO UPDATE SET {updates}
                """,
                [team_id, season] + values,
            )
            n += 1
        conn.commit()
        total += n
        flag = f"  champion: {champ_name}" if champ_name else "  (no champion on record)"
        print(f"=== {season} === {n} teams{flag}")

    cur.close()
    conn.close()
    print(f"\ntotal team-seasons upserted: {total}")
    if unresolved:
        print(f"unresolved abbreviations: {sorted(set(unresolved))}")


if __name__ == "__main__":
    main()
