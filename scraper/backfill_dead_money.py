"""Dead money in `future_salaries`, from basketball-reference, once a week.

BALLDONTLIE lists the players a team has, so a waived contract vanishes from
it: Damian Lillard's stretched $22.5M a year on Milwaukee's books through
2029-30, Bradley Beal's on Phoenix's. It has no dead money anywhere, and the
amounts can't be derived (a stretch spreads what was guaranteed at the waiver
over twice the years left plus one). bref's team contracts pages still list
them, so this reads those 30 pages and keeps only what BALLDONTLIE lacks.

A bref contract year is dead money when the player has no BALLDONTLIE year on
that team that season (backfill_future_salaries's rows), except:

  - a player bref can't match to anyone (almost always a rookie, on a roster
    BALLDONTLIE has too) is skipped;
  - one BALLDONTLIE has on another team for about the same money (within the
    15% a trade bonus can add) is a trade bref hasn't caught up with, not a
    waiver, and is skipped.

Rows are written with source 'bref_dead' and replace last week's set whole;
backfill_future_salaries leaves them alone. Run weekly by update_season.py's
bref job (see due()), or by hand. Dry run by default.

Usage:
  python backfill_dead_money.py            # dry run
  python backfill_dead_money.py --write
"""
import re
import sys
from datetime import datetime, timedelta, timezone

from bs4 import BeautifulSoup

import bref
from backfill_bdl_salaries import TRADE_BONUS
from backfill_salaries import load_team_resolver, season_teams
from backfill_stats import current_season
from db import connect

SOURCE = "bref_dead"
META_KEY = "dead_money"
EVERY = timedelta(days=7)


def to_label(short):
    """'2027-28' -> '2027-2028'."""
    start = int(short[:4])
    return f"{start}-{start + 1}"


def team_contracts(abbr):
    """[(name, slug, [(season, salary)])] from a team's bref contracts page."""
    html = bref.fetch(f"https://www.basketball-reference.com/contracts/{abbr}.html")
    soup = BeautifulSoup(html.replace("<!--", "").replace("-->", ""), "lxml")
    table = soup.find("table", id="contracts")
    if table is None:
        raise ValueError(f"no contracts table for {abbr}")

    seasons = {}
    for th in table.find("thead").find_all("th"):
        stat = th.get("data-stat") or ""
        if re.fullmatch(r"y\d", stat):
            seasons[stat] = to_label(th.get_text(strip=True))

    out = []
    for tr in table.find("tbody").find_all("tr"):
        head = tr.find("th", attrs={"data-stat": "player"})
        if head is None or not head.get_text(strip=True):
            continue
        link = head.find("a")
        slug = head.get("csk") or (
            re.search(r"/players/./([a-z0-9]+)\.html", link["href"]).group(1) if link else None
        )
        years = []
        for stat, season in seasons.items():
            td = tr.find("td", attrs={"data-stat": stat})
            salary = bref.parse_money(td.get_text(strip=True)) if td else None
            if salary:
                years.append((season, salary))
        if slug and years:
            out.append((head.get_text(strip=True), slug, years))
    return out


def due(cur):
    """True when the last write is a week old, or there hasn't been one."""
    cur.execute("SELECT updated_at FROM site_meta WHERE key = %s", (META_KEY,))
    row = cur.fetchone()
    return row is None or datetime.now(timezone.utc) - row[0] >= EVERY


def find(cur):
    """{(slug, season, team): (player_id, name, salary)} of dead money."""
    resolve_team = load_team_resolver(cur)
    cur.execute("SELECT bbref_slug, id FROM players WHERE bbref_slug IS NOT NULL")
    pid_for = dict(cur.fetchall())
    cur.execute(
        "SELECT player_id, season, team, salary FROM future_salaries "
        "WHERE source = 'bdl' AND player_id IS NOT NULL"
    )
    bdl_years = {}
    for pid, season, team, salary in cur.fetchall():
        bdl_years.setdefault((pid, season), {})[team] = salary

    end_year = int(current_season()[:4]) + 1
    dead, lagging, unmatched = {}, 0, 0
    for abbr in season_teams(end_year):
        team, _ = resolve_team(abbr)
        for name, slug, years in team_contracts(abbr):
            pid = pid_for.get(slug)
            if pid is None:
                unmatched += 1
                continue
            for season, salary in years:
                held = bdl_years.get((pid, season), {})
                if team in held:
                    continue
                if any(abs(s - salary) <= TRADE_BONUS * max(s, salary) for s in held.values()):
                    lagging += 1
                    continue
                dead[(slug, season, team)] = (pid, name, salary)
    print(f"{len(dead)} dead-money years; skipped {lagging} trades bref hasn't caught up with "
          f"and {unmatched} players bref has that no one matches")
    return dead


def write(cur, dead):
    cur.execute("DELETE FROM future_salaries WHERE source = %s", (SOURCE,))
    cur.executemany(
        """
        INSERT INTO future_salaries
          (bref_slug, season, team, player_id, name, salary, option, source)
        VALUES (%s, %s, %s, %s, %s, %s, NULL, %s)
        ON CONFLICT (bref_slug, season, team) DO NOTHING
        """,
        [(slug, season, team, pid, name, salary, SOURCE)
         for (slug, season, team), (pid, name, salary) in dead.items()],
    )
    cur.execute(
        """
        INSERT INTO site_meta (key, updated_at) VALUES (%s, now())
        ON CONFLICT (key) DO UPDATE SET updated_at = excluded.updated_at
        """,
        (META_KEY,),
    )


def run(write_rows):
    conn = connect()
    with conn, conn.cursor() as cur:
        dead = find(cur)
        totals = {}
        for (_, season, team), (_, name, salary) in dead.items():
            totals.setdefault(season, []).append((salary, team, name))
        for season in sorted(totals):
            rows = sorted(totals[season], reverse=True)
            print(f"  {season}: {len(rows)} rows, ${sum(r[0] for r in rows):,}; "
                  + ", ".join(f"{n} ({t}) ${s:,}" for s, t, n in rows[:4]))
        if write_rows:
            write(cur, dead)
            print("written")
        else:
            conn.rollback()
            print("dry run: nothing written")
    conn.close()


def main():
    run("--write" in sys.argv)


if __name__ == "__main__":
    main()
