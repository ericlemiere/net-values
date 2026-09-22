"""Recovers legacy salary rows the original Hoopshype migration dropped.

Phoenix has no salaries before 2011-12 and Washington none before 1997-98 —
21 and 7 seasons with no player salaries and, because team payroll was summed
from those same rows, no payroll either. Their records, stats and Net Value are
all present, so the seasons look complete until a percentage column comes up
blank.

Nothing was lost at the source. `SalariesHH_*` in the legacy SQLite carries
every row, with a `Team` column the original import never read: it took the
team from `Rosters_*` instead, and that table is the broken one. Phoenix is
absent from all 34 of its seasons and Washington from exactly the eight it
spent as the Bullets, which is what a scraper fetching by current team name
would produce. A salary with no roster entry got no team and was dropped.

So this reads `SalariesHH_*` directly, which also makes it self-checking:
`TeamPayrollHH_*` equals the sum of its own salary rows in every season tested,
for both teams.

Only genuinely empty (season, team) pairs are touched. A pair that already has
any salary row is left alone, so this can never duplicate or contradict what
the bref backfill wrote, and re-running once the gap is filled does nothing.

Names resolve through player_index's season-aware cascade rather than a plain
lookup, which matters more here than usual: Hoopshype lists a "Jaren Jackson Jr"
on the 1996-97 Bullets, meaning the father, while the database's Jaren Jackson
Jr. was born in 1999. Suffix-stripped both names normalize alike, so the global
fallback is correctly skipped as ambiguous and the season+team step lands on the
father, who has the 1996-97 stat row.

Written as 'sqlite_migration' because that is what these are — Hoopshype
figures, full-season and not split across teams, which is exactly the
distinction compute_net_values keys on when it collapses a traded player.

Usage:
  python backfill_missing_legacy_salaries.py            # report, change nothing
  python backfill_missing_legacy_salaries.py --write
"""
import csv
import re
import sqlite3
import sys
from pathlib import Path

from db import connect
from player_index import PlayerIndex, match_row

LEGACY_DB = Path(__file__).parent.parent / "OLD_PROJECT" / "Databases" / "Main.db"
UNMATCHED_CSV = Path(__file__).parent / "unmatched_recovered_salaries.csv"

# Name variants Hoopshype uses that no amount of normalization reaches, since
# they differ in the given name rather than in punctuation or a suffix. Each was
# confirmed against the player's own stat rows for these exact seasons before
# being written here; they go into player_aliases, so every later run of any
# script resolves them too.
#
# Keys are already normalized, which is the form the matcher looks up.
NAME_ALIASES = {
    # Played 8 games for Phoenix in 1997-98 and was still paid in 1998-99.
    "horacio llamas grey": "Horacio Llamas",
    # Goes by Jake; Phoenix 2000-01 through 2002-03.
    "iakovos tsakalidis": "Jake Tsakalidis",
    # Goes by Sasha; on Phoenix's books in 2009-10.
    "aleksandar pavlovic": "Sasha Pavlovic",
}


def record_aliases(cur, write):
    """Pin the known variants to their players; returns {alias: player_id}.

    The mapping comes back so a dry run can apply it to the in-memory index. A
    preview that reported these as unmatched, purely because it had not written
    the aliases it is about to write, would misstate the one number anyone
    checks before committing.
    """
    resolved = {}
    for alias, canonical in NAME_ALIASES.items():
        cur.execute("SELECT id FROM players WHERE name = %s", (canonical,))
        rows = cur.fetchall()
        if len(rows) != 1:
            print(f"  WARNING: {canonical!r} matched {len(rows)} players, alias skipped")
            continue
        if write:
            cur.execute(
                """
                INSERT INTO player_aliases (player_id, alias, note)
                VALUES (%s, %s, 'hoopshype name variant, recovered salaries')
                ON CONFLICT (alias) DO NOTHING
                """,
                (rows[0][0], alias),
            )
        resolved[alias] = rows[0][0]
    return resolved


def season_label(table_suffix: str) -> str:
    """'1990_1991' -> '1990-1991'."""
    return table_suffix.replace("_", "-")


def legacy_tables(lite):
    """{season: (salaries_table, payroll_table)} for every legacy season."""
    names = {r[0] for r in lite.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    out = {}
    for name in names:
        m = re.fullmatch(r"SalariesHH_(\d{4}_\d{4})", name)
        if not m:
            continue
        payroll = f"TeamPayrollHH_{m.group(1)}"
        out[season_label(m.group(1))] = (name, payroll if payroll in names else None)
    return out


def load_team_resolver(cur):
    """Legacy code -> canonical abbreviation. CHH/NJN/SEA/VAN all appear here."""
    cur.execute("SELECT abbr, id FROM teams")
    canonical = {abbr: (abbr, tid) for abbr, tid in cur.fetchall()}
    cur.execute(
        """
        SELECT team_aliases.alias, teams.abbr, teams.id
        FROM team_aliases JOIN teams ON teams.id = team_aliases.team_id
        """
    )
    aliases = {alias: (abbr, tid) for alias, abbr, tid in cur.fetchall()}

    def resolve(raw):
        if not raw:
            return None, None
        if raw in canonical:
            return canonical[raw]
        return aliases.get(raw, (None, None))

    return resolve


def find_gaps(cur, lite, tables):
    """[(season, legacy_team, canonical_abbr, team_id)] with no salary rows at all.

    Keyed on what the database is actually missing rather than on a hardcoded
    list of franchises, so anything else the original import lost surfaces here
    too instead of needing its own script.
    """
    cur.execute(
        "SELECT DISTINCT season, team FROM salaries WHERE team IS NOT NULL"
    )
    have = set(cur.fetchall())
    resolve_team = load_team_resolver(cur)

    gaps = []
    for season, (sal_table, _) in sorted(tables.items()):
        rows = lite.execute(
            f"SELECT DISTINCT Team FROM '{sal_table}' WHERE Team IS NOT NULL"
        ).fetchall()
        for (raw_team,) in rows:
            abbr, team_id = resolve_team(raw_team)
            if abbr is None:
                print(f"  WARNING: {season} unknown team code {raw_team!r}, skipped")
                continue
            if (season, abbr) not in have:
                gaps.append((season, raw_team, abbr, team_id))
    return gaps


def main():
    write = "--write" in sys.argv
    if not LEGACY_DB.exists():
        raise SystemExit(f"legacy database not found at {LEGACY_DB}")

    lite = sqlite3.connect(LEGACY_DB)
    conn = connect()
    cur = conn.cursor()

    tables = legacy_tables(lite)
    gaps = find_gaps(cur, lite, tables)
    if not gaps:
        print("no gaps — every legacy (season, team) already has salary rows")
        return

    by_team = {}
    for season, _, abbr, _ in gaps:
        by_team.setdefault(abbr, []).append(season)
    print("missing (season, team) pairs with legacy data available:")
    for abbr, seasons in sorted(by_team.items()):
        print(f"  {abbr}: {len(seasons)} seasons, {min(seasons)} .. {max(seasons)}")

    aliases = record_aliases(cur, write)
    if write:
        conn.commit()
    print(f"\nname aliases in place: {len(aliases)}")

    index = PlayerIndex(cur)
    # On a dry run the aliases are not in the table yet, so seed them here and
    # the preview matches what --write will actually do.
    index.alias_to_id.update(aliases)
    methods = {}
    unmatched = []
    inserted = payrolls = 0

    for season, raw_team, abbr, team_id in gaps:
        sal_table, pay_table = tables[season]
        rows = lite.execute(
            f"SELECT Name, Salary FROM '{sal_table}' WHERE Team = ?", (raw_team,)
        ).fetchall()

        for name, salary in rows:
            if salary is None:
                continue
            pid, method, score = match_row(
                {"name": name.strip(), "season": season, "team": abbr}, index
            )
            methods[method] = methods.get(method, 0) + 1
            if pid is None:
                unmatched.append([season, abbr, name, salary, round(score or 0, 1)])
                continue
            if write:
                cur.execute(
                    """
                    INSERT INTO salaries (player_id, season, team, salary, source)
                    VALUES (%s, %s, %s, %s, 'sqlite_migration')
                    ON CONFLICT (player_id, season, team) DO UPDATE
                      SET salary = EXCLUDED.salary
                    """,
                    (pid, season, abbr, salary),
                )
            inserted += 1

        # Payroll comes from the legacy table rather than the sum of the rows
        # above, so a name this script could not match doesn't quietly shrink
        # the team's payroll. The two agree wherever everything matched.
        if pay_table:
            row = lite.execute(
                f"SELECT Payroll FROM '{pay_table}' WHERE Team = ?", (raw_team,)
            ).fetchone()
            if row and row[0] is not None:
                if write:
                    cur.execute(
                        """
                        INSERT INTO team_payrolls (team_id, season, payroll, source)
                        VALUES (%s, %s, %s, 'sqlite_migration')
                        ON CONFLICT (team_id, season) DO NOTHING
                        """,
                        (team_id, season, row[0]),
                    )
                payrolls += 1

    if write:
        conn.commit()

    print(f"\nmatch methods: {dict(sorted(methods.items(), key=lambda kv: -kv[1]))}")
    print(f"salary rows  : {inserted}")
    print(f"payroll rows : {payrolls}")
    print(f"unmatched    : {len(unmatched)}")

    if unmatched:
        with open(UNMATCHED_CSV, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["season", "team", "name", "salary", "best_score"])
            w.writerows(unmatched)
        print(f"  written to {UNMATCHED_CSV.name} — never guessed into the table")
        for row in unmatched[:15]:
            print(f"    {row[0]} {row[1]} {row[2]} ${row[3]:,}")

    if not write:
        print("\nDRY RUN — nothing written. Re-run with --write to apply.")

    cur.close()
    conn.close()
    lite.close()


if __name__ == "__main__":
    main()
