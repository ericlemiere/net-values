"""Backfills `player_awards` from basketball-reference and nba.com.

Two sources, because neither has all of it:

  bref /awards/awards_YYYY.html — one page per season, carrying the five voted
      awards (MVP, ROY, DPOY, 6MOY, MIP) with their full ballots, plus the
      All-NBA, All-Defensive and All-Rookie teams. Every row on those tables
      carries bref's player slug, so identity is an exact lookup rather than a
      name match for anyone whose slug we already know.

  nba.com PlayerAwards — All-Star selections only. bref's /allstar/ page is the
      box score of the game, so a player who was selected and then scratched is
      simply absent from it: Joel Embiid was a 2023-24 All-Star and does not
      appear on that page. nba.com lists the selection itself. It is keyed on
      the NBA person id, which `players.nba_person_id` already holds, so that
      join is exact too. It is also right about 1998-99, when the lockout meant
      there was no game and so no selections.

Runners-up are kept, with `won` false. A losing ballot line is what lets the
awards page show a result instead of a name, and it is nearly free — a whole
season of ballots is a few dozen rows.

Idempotent: upserts on (player_id, season, award). Re-running after a parsing
fix costs nothing, since bref pages are cached on disk by bref.fetch().

Usage:
  python backfill_awards.py                 # bref 1991..2026, then All-Star
  python backfill_awards.py 2024            # one bref end-year
  python backfill_awards.py 2020 2026       # a range
  python backfill_awards.py --skip-allstar  # the voted awards only
  python backfill_awards.py --allstar-only  # the All-Star passes only
  python backfill_awards.py --skip-nba      # everything bref has, no nba.com
"""
import csv
import re
import sys
import time
from pathlib import Path

import bref
from db import connect
from player_index import PlayerIndex, match_row

# bref publishes awards from 1946 on, but the stats in this database start at
# 1990-91 and an award for a player we have no row for is not useful.
DEFAULT_START, DEFAULT_END = 1991, 2026

UNMATCHED_CSV = Path(__file__).parent / "unmatched_awards.csv"

# bref table id -> (award code, is a tiered team award)
VOTED = {
    "mvp": "mvp",
    "roy": "roy",
    "dpoy": "dpoy",
    "smoy": "smoy",
    "mip": "mip",
}
TEAMED = {
    "leading_all_nba": ("all_nba", "all_nba_team"),
    "leading_all_defense": ("all_defense", "all_defense_team"),
    "leading_all_rookie": ("all_rookie", "all_rookie_team"),
}

COLUMNS = [
    "team_number", "won", "rank", "share",
    "points_won", "points_max", "votes_first", "source",
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


def team_number(text):
    """bref writes the tier as '1T'/'2T'/'3T'; sometimes just '1'."""
    if not text:
        return None
    digits = "".join(c for c in text if c.isdigit())
    return int(digits) if digits else None


def rank_num(text):
    """Finishing position, with bref's tie suffix stripped.

    A shared placing is written '1T', so reading the cell as a plain integer
    yields nothing and the co-winners of a tied vote both look like also-rans.
    Rookie of the Year was shared twice in this range — Hill and Kidd in
    1994-95, Brand and Francis in 1999-2000 — and both seasons had no winner
    at all until this stopped discarding the tie.
    """
    if not text:
        return None
    digits = "".join(c for c in str(text) if c.isdigit())
    return int(digits) if digits else None


def upsert(cur, player_id, season, award, values):
    cols = ", ".join(["player_id", "season", "award"] + COLUMNS)
    placeholders = ", ".join(["%s"] * (len(COLUMNS) + 3))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS)
    cur.execute(
        f"INSERT INTO player_awards ({cols}) VALUES ({placeholders}) "
        f"ON CONFLICT (player_id, season, award) DO UPDATE SET {updates}",
        [player_id, season, award] + [values.get(c) for c in COLUMNS],
    )


def resolve(row, season, index, unmatched, methods, award):
    """bref row -> player id, via the shared slug-first cascade."""
    name = (row.get("player") or row.get("name_display") or "").strip()
    pid, method, _score = match_row(
        {
            "name": name,
            "season": season,
            "team": (row.get("team_id") or "").strip() or None,
            "slug": row.get("slug"),
        },
        index,
    )
    methods[method] = methods.get(method, 0) + 1
    if pid is None:
        unmatched.append({"season": season, "award": award, "name": name,
                          "slug": row.get("slug", ""), "team": row.get("team_id", "")})
    return pid


def backfill_bref(cur, start, end, index, unmatched, methods):
    written = 0
    for end_year in range(start, end + 1):
        season = bref.season_label(end_year)
        url = f"https://www.basketball-reference.com/awards/awards_{end_year}.html"
        try:
            html = bref.fetch(url)
        except FileNotFoundError:
            print(f"=== {season}: no awards page")
            continue

        n = 0
        for table_id, award in VOTED.items():
            for row in bref.parse_table(html, table_id):
                rank = rank_num(row.get("rank"))
                pid = resolve(row, season, index, unmatched, methods, award)
                if pid is None:
                    continue
                upsert(cur, pid, season, award, {
                    "team_number": None,
                    # bref lists the ballot in finishing order; rank 1 is the winner.
                    "won": rank == 1,
                    "rank": rank,
                    "share": num(row.get("award_share")),
                    "points_won": num(row.get("points_won")),
                    "points_max": num(row.get("points_max")),
                    "votes_first": intnum(row.get("votes_first")),
                    "source": "bref",
                })
                n += 1

        for table_id, (award, tier_key) in TEAMED.items():
            for row in bref.parse_table(html, table_id):
                tier = team_number(row.get(tier_key))
                # These tables list everyone who drew a vote, most of whom made
                # no team at all. Only an actual selection carries a tier.
                if tier is None:
                    continue
                pid = resolve(row, season, index, unmatched, methods, award)
                if pid is None:
                    continue
                upsert(cur, pid, season, award, {
                    "team_number": tier,
                    "won": True,
                    "rank": None,
                    "share": num(row.get("award_share")),
                    "points_won": num(row.get("points_won")),
                    "points_max": num(row.get("points_max")),
                    "votes_first": intnum(row.get("first_team_votes")),
                    "source": "bref",
                })
                n += 1

        print(f"=== {season}: {n} rows")
        written += n
    return written


ALL_STAR_INDEX = "https://www.basketball-reference.com/awards/all_star_by_player.html"


def ever_all_star_slugs():
    """The slug of every player who has ever been an All-Star.

    bref keeps a single page of career All-Star counts, which is the cheapest
    way to know who is worth asking nba.com about: without it this would be one
    request per player in the database, and nineteen in twenty of those would
    come back with nothing. The table's cells carry no `data-stat`, so
    parse_table() can't read it and the slugs come out of the player hrefs.
    """
    html = bref.fetch(ALL_STAR_INDEX).replace("<!--", "").replace("-->", "")
    start = html.find('id="all_star_by_player"')
    if start == -1:
        return set()
    end = html.find("</table>", start)
    return set(re.findall(r'/players/[a-z]/([a-z0-9]+)\.html', html[start:end]))


def backfill_allstar_bref(cur, start, end, index, unmatched, methods):
    """All-Star appearances from bref's game page, as the floor under nba.com.

    This page is the box score, so it misses anyone selected and then scratched
    — which is exactly why nba.com is the primary source. It is here for the
    other direction: nba.com can only be asked about a player we hold an NBA
    person id for, and several hundred early-90s players have none, so Magic
    Johnson and James Worthy would carry no All-Star badge at all without it.

    Runs BEFORE the nba.com pass on purpose. Where both have a player the
    upsert lets nba.com's row win, and where only this one does the row stays.
    """
    written = 0
    for end_year in range(start, end + 1):
        season = bref.season_label(end_year)
        url = f"https://www.basketball-reference.com/allstar/NBA_{end_year}.html"
        try:
            html = bref.fetch(url)
        except FileNotFoundError:
            # 1998-99: the lockout canceled the game, so there is no page.
            print(f"=== All-Star {season}: no game")
            continue

        # The rosters aren't reliably "East"/"West": since 2018 the teams have
        # been drafted by captains and named after them, and the id is whatever
        # that year's teams were called — "Team LeBron", "Giannis", "Team
        # Stripes". Every table on the page is a roster except the line score.
        rosters = [
            t for t in re.findall(r'<table[^>]*id="([^"]+)"',
                                  html.replace("<!--", "").replace("-->", ""))
            if t != "line_score"
        ]

        n = 0
        for roster in rosters:
            for row in bref.parse_table(html, roster):
                pid = resolve(row, season, index, unmatched, methods, "all_star")
                if pid is None:
                    continue
                upsert(cur, pid, season, "all_star", {
                    "team_number": None, "won": True, "rank": None,
                    "share": None, "points_won": None, "points_max": None,
                    "votes_first": None, "source": "bref",
                })
                n += 1
        print(f"=== All-Star {season}: {n} played")
        written += n
    return written


def backfill_allstar(cur, start, end, index):
    """All-Star selections from nba.com, one request per ever-All-Star player.

    Scoped two ways before a single request goes out: the player has to appear
    on bref's career All-Star list, and we have to hold an nba person id for
    him. That turns ~2,800 round trips into a few hundred.
    """
    from nba_api.stats.endpoints import playerawards

    first, last = bref.season_label(start), bref.season_label(end)
    slugs = ever_all_star_slugs()
    ids = {index.slug_to_id[s] for s in slugs if s in index.slug_to_id}
    if not ids:
        print("=== All-Star: no known players on bref's list; nothing to do")
        return 0

    cur.execute(
        """
        SELECT DISTINCT p.id, p.nba_person_id
        FROM players p
        JOIN advanced_stats a ON a.player_id = p.id
        WHERE p.nba_person_id IS NOT NULL
          AND p.id = ANY(%s)
          AND a.season BETWEEN %s AND %s
        ORDER BY p.id
        """,
        (list(ids), first, last),
    )
    targets = cur.fetchall()
    print(f"=== All-Star: {len(slugs)} ever-All-Stars, {len(targets)} of them ours")

    written, failed = 0, []
    for i, (pid, person_id) in enumerate(targets, 1):
        try:
            df = playerawards.PlayerAwards(player_id=person_id, timeout=60).get_data_frames()[0]
        except Exception as exc:  # noqa: BLE001 — one bad player must not end the run
            failed.append((pid, person_id, str(exc)[:80]))
            continue

        if not df.empty:
            for _, r in df[df["DESCRIPTION"] == "NBA All-Star"].iterrows():
                # nba.com writes "2023-24"; this schema writes "2023-2024".
                raw = str(r["SEASON"] or "")
                if len(raw) != 7 or "-" not in raw:
                    continue
                season = f"{raw[:4]}-{int(raw[:4]) + 1}"
                if not (first <= season <= last):
                    continue
                upsert(cur, pid, season, "all_star", {
                    "team_number": None, "won": True, "rank": None,
                    "share": None, "points_won": None, "points_max": None,
                    "votes_first": None, "source": "nba",
                })
                written += 1

        if i % 100 == 0:
            print(f"    {i}/{len(targets)} checked, {written} selections")
        # stats.nba.com throttles hard on sustained traffic.
        time.sleep(0.6)

    if failed:
        print(f"    {len(failed)} players errored, e.g. {failed[:3]}")
    return written


def main():
    args = [a for a in sys.argv[1:]]
    skip_allstar = "--skip-allstar" in args
    allstar_only = "--allstar-only" in args
    # The nba.com pass is one request per ever-All-Star player, so a job that
    # runs daily wants bref's page (one fetch, already cached) and not this.
    skip_nba = "--skip-nba" in args
    years = [int(a) for a in args if not a.startswith("--")]
    start, end = (DEFAULT_START, DEFAULT_END) if not years else (
        (years[0], years[0]) if len(years) == 1 else (years[0], years[1])
    )

    conn = connect()
    cur = conn.cursor()
    index = PlayerIndex(cur)
    unmatched, methods = [], {}
    total = 0

    if not allstar_only:
        total += backfill_bref(cur, start, end, index, unmatched, methods)
        conn.commit()
    if not skip_allstar:
        total += backfill_allstar_bref(cur, start, end, index, unmatched, methods)
        conn.commit()
        if not skip_nba:
            total += backfill_allstar(cur, start, end, index)
            conn.commit()

    cur.close()
    conn.close()

    print(f"\n{total} award rows written")
    if methods:
        print("match methods:", dict(sorted(methods.items())))
    if unmatched:
        with open(UNMATCHED_CSV, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["season", "award", "name", "slug", "team"])
            w.writeheader()
            w.writerows(unmatched)
        print(f"{len(unmatched)} unmatched -> {UNMATCHED_CSV.name}")


if __name__ == "__main__":
    main()
