"""Repairs split and conflated player identities.

Three kinds of damage, all found through traded players whose per-team rows
had nowhere to land:

1. One player, two rows. nba.com and basketball-reference spell some names
   differently ("Clar. Weatherspoon" / "Clarence Weatherspoon"), and the two
   importers each created a player for the name they saw. The nba.com row
   holds his 1996-97+ box scores; the bref row holds his advanced stats,
   salaries and awards. So neither page showed his career, and his Net Value
   was computed against a row with no production on it. Each pair is merged
   onto the nba.com row, which keeps its nba_person_id and takes the bref
   slug; the name that loses is kept as an alias.

2. Two players, one row. Gerald Henderson and his son, and the two Michael
   Smiths, were resolved to one player each. The earlier seasons move to a new
   player carrying the right bref slug.

3. One row on the wrong player: Marcus Williams (willima04)'s 2007-08 advanced
   line sat on the other Marcus Williams (willima03), whose own line was
   missing. It moves, and the missing one is re-read from bref.

player_production, net_values and net_value_shares are derived, so the rows
touched here are deleted rather than moved; compute_production.py and
compute_net_values.py rebuild them. player_team_splits is rebuilt by
backfill_team_splits.py. Run all three afterwards.

Every move checks for a clash on the target first and aborts the whole run
rather than overwrite. Without --apply it rolls back and only reports.

Usage:
  python merge_players.py            # dry run
  python merge_players.py --apply
"""
import sys

import bref
from backfill_advanced import COLUMNS as ADV_COLUMNS, build_values, load_team_resolver
from db import connect
from player_index import normalize_name

# (keep: the nba.com row, duplicate: the bref row, the name to keep).
MERGES = [
    (85, 3625, "Clarence Weatherspoon"),
    (398, 3588, "Steve Smith"),
    (826, 3689, "Flip Murray"),
    (731, 3687, "Slava Medvedenko"),
    (203, 3558, "Ike Austin"),
    (917, 3690, "Mike Sweetney"),
    (98, 3455, "Danny Schayes"),
    (1539, 3695, "Jeffery Taylor"),
    (968, 3692, "Ha Seung-Jin"),
    (2039, 3700, "Cameron Reynolds"),
    (1998, 3698, "Nigel Hayes-Davis"),
    (497, 3686, "Kiwane Garris"),
    (2459, 3702, "Tre Scott"),
    (2104, 3699, "Mitch Creek"),
    (349, 3676, "Rich Manning"),
    (1298, 3693, "Sun Yue"),
    (1413, 3694, "Pooh Jeter"),
    (2446, 3701, "RJ Nembhard Jr."),
    (970, 3691, "Ibrahim Kutluay"),
    (761, 3688, "Ike Fontaine"),
]

# (row to split, seasons before this go to the new player, new name, new slug,
#  slug the original row should carry afterwards).
SPLITS = [
    (1322, "1992-1993", "Gerald Henderson Sr.", "hendege01", "hendege02"),
    (312, "1993-1994", "Michael Smith", "smithmi01", "smithmi02"),
]

# Marcus Williams: (from, to, season) for the misplaced advanced row, and the
# slug + bref end-year to re-read the player who was left without one.
MISPLACED_ADVANCED = (1135, 1221, "2007-2008")
REFETCH_ADVANCED = (1135, "willima03", 2008)

# Tables that are simply moved, with the columns beyond player_id that make a
# row unique — a clash on those aborts the run.
MOVED = {
    "player_stats_per_game": ["season"],
    "player_stats_totals": ["season"],
    "advanced_stats": ["season"],
    "nba_advanced": ["season"],
    "player_scoring_splits": ["season"],
    "player_tracking_defense": ["season"],
    "salaries": ["season", "team"],
    "player_awards": ["season", "award"],
}
# Rebuilt from scratch by their own scripts afterwards.
DERIVED = ["player_production", "net_values", "net_value_shares", "player_team_splits"]


class Clash(Exception):
    pass


def move_rows(cur, table, from_id, to_id, season_before=None):
    keys = MOVED[table]
    season_clause = " AND season < %s" if season_before else ""
    where = "player_id = %s" + season_clause
    args = [from_id] + ([season_before] if season_before else [])
    if table == "salaries":
        # The one clash that isn't a conflict: a contract row carried on both
        # players, empty on one of them. The row with the figure wins, and a
        # row repeated with the same figure is just a copy.
        cur.execute(
            f"""
            DELETE FROM salaries t USING salaries f
            WHERE f.player_id = %s{season_clause.replace("season", "f.season")}
              AND t.player_id = %s AND t.season = f.season
              AND t.team IS NOT DISTINCT FROM f.team
              AND (t.salary IS NULL OR t.salary = f.salary)
            """,
            args + [to_id],
        )
    cur.execute(
        f"""
        SELECT {", ".join(f"f.{k}" for k in keys)} FROM {table} f
        WHERE f.player_id = %s{season_clause.replace("season", "f.season")}
          AND EXISTS (
            SELECT 1 FROM {table} t WHERE t.player_id = %s
            AND {" AND ".join(f"t.{k} IS NOT DISTINCT FROM f.{k}" for k in keys)})
        """,
        args + [to_id],
    )
    clashes = cur.fetchall()
    if clashes:
        raise Clash(f"{table}: player {to_id} already has {clashes}")
    cur.execute(f"UPDATE {table} SET player_id = %s WHERE {where}", [to_id] + args)
    return cur.rowcount


def delete_derived(cur, player_id, season_before=None):
    for table in DERIVED:
        if season_before:
            cur.execute(
                f"DELETE FROM {table} WHERE player_id = %s AND season < %s",
                (player_id, season_before),
            )
        else:
            cur.execute(f"DELETE FROM {table} WHERE player_id = %s", (player_id,))


def add_alias(cur, player_id, name, note):
    cur.execute(
        """
        INSERT INTO player_aliases (player_id, alias, note) VALUES (%s, %s, %s)
        ON CONFLICT (alias) DO NOTHING
        """,
        (player_id, normalize_name(name), note),
    )


def player(cur, pid):
    cur.execute("SELECT name, nba_person_id, bbref_slug FROM players WHERE id = %s", (pid,))
    row = cur.fetchone()
    if row is None:
        raise Clash(f"player {pid} does not exist")
    return row


def merge(cur, keep, dup, name):
    keep_name, keep_nba, keep_slug = player(cur, keep)
    dup_name, dup_nba, dup_slug = player(cur, dup)
    if keep_slug or dup_nba or not keep_nba or not dup_slug:
        raise Clash(
            f"{keep} {keep_name!r} / {dup} {dup_name!r} aren't an nba-only + "
            "bref-only pair any more; already merged?"
        )
    moved = {t: move_rows(cur, t, dup, keep) for t in MOVED}
    delete_derived(cur, dup)
    delete_derived(cur, keep)
    cur.execute("UPDATE player_aliases SET player_id = %s WHERE player_id = %s", (keep, dup))
    for old in {keep_name, dup_name} - {name}:
        add_alias(cur, keep, old, "merged duplicate player row")
    cur.execute("UPDATE players SET bbref_slug = NULL WHERE id = %s", (dup,))
    cur.execute(
        "UPDATE players SET bbref_slug = %s, name = %s WHERE id = %s", (dup_slug, name, keep)
    )
    cur.execute("DELETE FROM players WHERE id = %s", (dup,))
    summary = ", ".join(f"{t} {n}" for t, n in moved.items() if n)
    print(f"  {keep_name} + {dup_name} -> {name} ({keep}): {summary}")


def split(cur, source, before, new_name, new_slug, source_slug):
    name, _, slug = player(cur, source)
    cur.execute("SELECT id FROM players WHERE bbref_slug = %s", (new_slug,))
    taken = cur.fetchone()
    if taken and taken[0] != source:
        raise Clash(f"{new_slug} already belongs to player {taken[0]}; already split?")
    cur.execute("UPDATE players SET bbref_slug = %s WHERE id = %s", (source_slug, source))
    cur.execute(
        "INSERT INTO players (name, bbref_slug) VALUES (%s, %s) RETURNING id",
        (new_name, new_slug),
    )
    new_id = cur.fetchone()[0]
    moved = {t: move_rows(cur, t, source, new_id, season_before=before) for t in MOVED}
    delete_derived(cur, source, season_before=before)
    summary = ", ".join(f"{t} {n}" for t, n in moved.items() if n)
    print(f"  {name} ({source}): seasons before {before} -> {new_name} ({new_id}): {summary}")


def fix_marcus_williams(cur):
    src, dst, season = MISPLACED_ADVANCED
    cur.execute(
        "SELECT 1 FROM advanced_stats WHERE player_id = %s AND season = %s", (dst, season)
    )
    if cur.fetchone():
        raise Clash(f"advanced_stats: player {dst} already has {season}; already fixed?")
    cur.execute(
        "UPDATE advanced_stats SET player_id = %s WHERE player_id = %s AND season = %s",
        (dst, src, season),
    )
    print(f"  advanced_stats {season}: player {src} -> {dst}")

    pid, slug, end_year = REFETCH_ADVANCED
    url = f"https://www.basketball-reference.com/leagues/NBA_{end_year}_advanced.html"
    rows = [r for r in bref.parse_table(bref.fetch(url), "advanced") if r.get("slug") == slug]
    if len(rows) != 1:
        raise Clash(f"expected one {slug} row on the {end_year} advanced page, got {len(rows)}")
    values = build_values(rows[0], load_team_resolver(cur)(rows[0].get("team_name_abbr")))
    cur.execute(
        f"""
        INSERT INTO advanced_stats (player_id, season, {", ".join(ADV_COLUMNS)})
        VALUES ({", ".join(["%s"] * (len(ADV_COLUMNS) + 2))})
        """,
        [pid, bref.season_label(end_year)] + [values[c] for c in ADV_COLUMNS],
    )
    print(f"  advanced_stats {season}: re-read {slug} from bref for player {pid}")


def main():
    apply = "--apply" in sys.argv
    conn = connect()
    cur = conn.cursor()
    try:
        print("=== merges ===")
        for keep, dup, name in MERGES:
            merge(cur, keep, dup, name)
        print("=== splits ===")
        for args in SPLITS:
            split(cur, *args)
        print("=== misplaced ===")
        fix_marcus_williams(cur)
    except Clash as e:
        conn.rollback()
        print(f"\nABORTED, nothing written: {e}")
        sys.exit(1)

    if apply:
        conn.commit()
        print("\napplied. Now run compute_production.py, compute_net_values.py and "
              "backfill_team_splits.py.")
    else:
        conn.rollback()
        print("\ndry run, rolled back. Re-run with --apply to write it.")
    conn.close()


if __name__ == "__main__":
    main()
