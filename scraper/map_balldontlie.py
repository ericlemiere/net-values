"""Pins each BALLDONTLIE player id to our `players` row (players.balldontlie_id).

BALLDONTLIE has its own player ids and carries no nba.com or bref id, so the
link is made once by name, through the same cascade the bref backfills use
(player_index.match_row): name + season + team first, looser after that. Once
pinned, the scrapers look players up by id and never match names again.

Who gets mapped: everyone with a game line in the seasons named, plus every
player on a current roster. History before that is already in the database and
never re-fetched, so it needs no ids. backfill_bdl.py runs the same matching
every morning for anyone new, through collect() and pin().

A BALLDONTLIE player who matches no one is listed in unmatched_balldontlie.csv
and left alone; one whose match is already pinned to a different id is a
collision, listed and left alone too. Neither is guessed. A legal name that
won't match a nickname ("Airious Bailey" for Ace Bailey) is fixed by adding it
to player_aliases.

Usage:
  python map_balldontlie.py                 # dry run: 2025-26 and 2026-27
  python map_balldontlie.py --write         # pin the matches
  python map_balldontlie.py 2024 2025 2026  # other start years
"""
import csv
import sys
from collections import Counter
from pathlib import Path

import bdl
from db import connect
from player_index import PlayerIndex, match_row

UNMATCHED_CSV = Path(__file__).parent / "unmatched_balldontlie.csv"


def label(start_year):
    return f"{start_year}-{start_year + 1}"


def team_abbrs(cur):
    """Every abbreviation we know, current or historical -> its canonical one."""
    cur.execute("SELECT abbr FROM teams")
    canonical = {row[0]: row[0] for row in cur.fetchall()}
    cur.execute("SELECT a.alias, t.abbr FROM team_aliases a JOIN teams t ON t.id = a.team_id")
    return {**canonical, **dict(cur.fetchall())}


def player_name(p):
    return f"{p['first_name']} {p['last_name']}".strip()


def collect(found, players_and_teams, season):
    """Add (bdl player object, team abbreviation) pairs seen in `season`.

    `found` is {bdl_id: {name, draft_year, appearances: [(season, team)]}}.
    """
    for p, team in players_and_teams:
        if not team:
            continue
        c = found.setdefault(p["id"], {
            "name": player_name(p), "draft_year": p.get("draft_year"), "appearances": [],
        })
        if (season, team) not in c["appearances"]:
            c["appearances"].append((season, team))


def active_roster():
    """[(bdl player, team abbreviation)] for everyone on a roster today."""
    # The team comes nested; a player between teams may have none.
    return [(p, (p.get("team") or {}).get("abbreviation"))
            for p in bdl.paged("/v1/players/active")]


def pin(cur, found, write):
    """Match every not-yet-pinned player in `found`; with `write`, pin them.

    Returns (matched {bdl_id: player_id}, unmatched [(bdl_id, name, draft
    year, appearances)], collisions [(bdl_id, name, why, detail)]).
    """
    abbr_for = team_abbrs(cur)
    cur.execute("SELECT balldontlie_id, id FROM players WHERE balldontlie_id IS NOT NULL")
    pinned = dict(cur.fetchall())
    pinned_players = set(pinned.values())

    index = PlayerIndex(cur)
    matched, unmatched, collisions = {}, [], []
    methods = Counter()
    for bid, c in found.items():
        if bid in pinned:
            continue
        # Most recent appearance first: today's team is the surest context.
        votes = Counter()
        how = None
        for season, team in sorted(c["appearances"], reverse=True):
            pid, method, _ = match_row(
                {"name": c["name"], "season": season, "team": abbr_for.get(team, team)}, index
            )
            if pid is not None:
                votes[pid] += 1
                how = how or method
        if not votes:
            unmatched.append((bid, c["name"], c["draft_year"], c["appearances"]))
            continue
        if len(votes) > 1:
            collisions.append((bid, c["name"], "appearances matched different players", dict(votes)))
            continue
        pid = next(iter(votes))
        if pid in pinned_players or pid in matched.values():
            collisions.append((bid, c["name"], "player already has another id", pid))
            continue
        matched[bid] = pid
        methods[how] += 1

    new = sum(1 for bid in found if bid not in pinned)
    print(f"{len(found)} players seen, {new} not yet pinned: {len(matched)} matched, "
          f"{len(unmatched)} unmatched, {len(collisions)} collisions")
    for method, n in methods.most_common():
        print(f"  {method}: {n}")
    for bid, name, why, detail in collisions:
        print(f"  collision: {name} (bdl {bid}): {why} {detail}")

    if write and matched:
        cur.executemany(
            "UPDATE players SET balldontlie_id = %s WHERE id = %s AND balldontlie_id IS NULL",
            [(bid, pid) for bid, pid in matched.items()],
        )
    return matched, unmatched, collisions


def main():
    args = sys.argv[1:]
    write = "--write" in args
    seasons = [int(a) for a in args if a.isdigit()] or [2025, 2026]

    found = {}
    for start_year in seasons:
        rows = bdl.season_lines(start_year)
        print(f"{label(start_year)}: {len(rows)} game lines")
        collect(found, ((r["player"], r["team"]["abbreviation"]) for r in rows
                        if bdl.minutes(r["min"]) > 0), label(start_year))
    roster = active_roster()
    print(f"{len(roster)} players on current rosters")
    collect(found, roster, label(max(seasons)))

    conn = connect()
    cur = conn.cursor()
    matched, unmatched, _ = pin(cur, found, write)

    cur.execute("SELECT id, name FROM players")
    names = dict(cur.fetchall())
    renamed = sorted((found[bid]["name"], names[pid]) for bid, pid in matched.items()
                     if found[bid]["name"].lower() != names[pid].lower())
    if renamed:
        print(f"\nmatched under a different spelling ({len(renamed)}):")
        for theirs, ours in renamed:
            print(f"  {theirs!r} -> {ours!r}")

    with UNMATCHED_CSV.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["balldontlie_id", "name", "draft_year", "appearances"])
        for bid, name, draft_year, apps in sorted(unmatched, key=lambda x: x[1]):
            w.writerow([bid, name, draft_year, "; ".join(f"{s} {t}" for s, t in apps)])
    print(f"\nunmatched written to {UNMATCHED_CSV.name}")

    if write:
        conn.commit()
        print(f"pinned {len(matched)} ids")
    else:
        print("dry run: nothing written (--write to pin)")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
