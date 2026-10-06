"""Refreshes `future_salaries` and `cap_projections`.

Every season a player is signed through, read off basketball-reference's team
contracts pages (/contracts/BOS.html): one request per team, rather than one
per player. Those pages list the current season and up to five more.

The current season is kept too, even though `salaries` usually has it. When a
new season starts, bref moves it into the first column, and until
backfill_salaries.py is run for it, this is the only place it is on file. The
player page shows a contract year from here only for seasons `salaries` has
nothing for, so the two never double up.

Options come from the cell's class, which is what bref colors by: `salary-pl`
is a player option, `salary-tm` a team option. Nothing else is marked there.

Each run makes the table match bref exactly: contract years still listed are
upserted, and any that are gone (a player waived, a team option declined, a
trade moving the year to another team) are deleted. Upserting rather than
replacing keeps each row's id, which the player page puts in ?salary= links,
so a shared link still points at the same season tomorrow. It all happens in
one transaction, and only when every team's page parsed, so a bad fetch leaves
yesterday's data in place instead of an empty table.

Projected caps are entered by hand below. Update them when the league
publishes new projections; a season that becomes official is read from bref
into `seasons` by seed_seasons.py and can be dropped from here.

Usage:
  python backfill_future_salaries.py
"""
import re

from bs4 import BeautifulSoup

import bref
from backfill_salaries import load_team_resolver, season_teams
from backfill_stats import current_season
from db import connect
from player_index import PlayerIndex, match_row

# Season -> projected cap. 2026-27 is official and lives in `seasons`.
CAP_PROJECTIONS = {
    "2027-2028": 176_000_000,
    "2028-2029": 184_800_000,
    "2029-2030": 191_000_000,
    "2030-2031": 201_000_000,
}

OPTION_CLASSES = {"salary-pl": "player", "salary-tm": "team"}

FUZZY_METHODS = {"fuzzy", "fuzzy_team"}


def to_label(short):
    """'2027-28' -> '2027-2028'."""
    start = int(short[:4])
    return f"{start}-{start + 1}"


def team_contracts(abbr):
    """[(name, slug, [(season, salary, option)])] from a team's contracts page."""
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
            if not salary:
                continue
            # bref keeps coloring the current season's option after it has
            # been picked up, but a player under contract this season is past
            # that decision, so only later seasons carry one.
            option = None if stat == "y1" else next(
                (OPTION_CLASSES[c] for c in td.get("class", []) if c in OPTION_CLASSES), None
            )
            years.append((season, salary, option))
        if years:
            out.append((head.get_text(strip=True), slug, years))
    return out


def seed_projections(cur):
    for season, cap in CAP_PROJECTIONS.items():
        cur.execute(
            """
            INSERT INTO cap_projections (season, league_cap, source)
            VALUES (%s, %s, 'projected')
            ON CONFLICT (season) DO UPDATE
              SET league_cap = EXCLUDED.league_cap, source = EXCLUDED.source
            """,
            (season, cap),
        )


def main():
    conn = connect()
    cur = conn.cursor()
    resolve_team = load_team_resolver(cur)
    index = PlayerIndex(cur)

    seed_projections(cur)

    # bref names league pages by the season's end year.
    end_year = int(current_season()[:4]) + 1
    season = bref.season_label(end_year)

    rows = {}
    unmatched = []
    for abbr in season_teams(end_year):
        canon_abbr, _ = resolve_team(abbr)
        for name, slug, years in team_contracts(abbr):
            if not slug:
                print(f"  skipped {canon_abbr} {name}: no bref id")
                continue
            pid, method, _ = match_row(
                {"name": name, "season": season, "team": canon_abbr, "slug": slug}, index
            )
            # Exact matches only. Before opening night the season has no stat
            # rows, so the fuzzy fallback pools every player in history, and a
            # rookie lands on whoever's name is closest: Mikel Brown Jr. came
            # out as the Mike Brown who retired in 2001. An unmatched player is
            # still stored, under his bref id and name, so his team's
            # commitments are whole; he links up once he has played and the
            # name matches exactly.
            if method in FUZZY_METHODS:
                pid = None
            if pid is None:
                unmatched.append(f"{canon_abbr} {name} ({slug})")
            else:
                index.record_slug(cur, pid, slug)
            for year, salary, option in years:
                # A player listed twice on one page is one contract shown twice.
                rows[(slug, year, canon_abbr)] = (pid, name, salary, option)

    if not rows:
        raise RuntimeError("no contract years parsed; leaving future_salaries untouched")

    cur.executemany(
        """
        INSERT INTO future_salaries
          (bref_slug, season, team, player_id, name, salary, option, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'bref')
        ON CONFLICT (bref_slug, season, team) DO UPDATE
          SET player_id = EXCLUDED.player_id, name = EXCLUDED.name,
              salary = EXCLUDED.salary, option = EXCLUDED.option,
              source = EXCLUDED.source, updated_at = now()
        """,
        [(slug, year, team, *vals) for (slug, year, team), vals in rows.items()],
    )
    # Whatever this run didn't see is no longer on anyone's books.
    cur.execute(
        """
        DELETE FROM future_salaries f
        WHERE f.source = 'bref'
          AND NOT EXISTS (
            SELECT 1 FROM unnest(%s::text[], %s::text[], %s::text[]) AS k(slug, season, team)
            WHERE k.slug = f.bref_slug AND k.season = f.season AND k.team = f.team)
        """,
        [list(col) for col in zip(*rows.keys())],
    )
    removed = cur.rowcount
    conn.commit()

    players = len({slug for slug, _, _ in rows})
    options = sum(1 for *_, option in rows.values() if option)
    print(f"{len(rows)} future contract years for {players} players ({options} options), "
          f"{removed} removed")
    if unmatched:
        print(f"stored without a player link ({len(unmatched)}): " + ", ".join(unmatched))

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
