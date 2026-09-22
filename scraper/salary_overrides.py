"""Hand-entered salaries for contracts basketball-reference leaves blank.

bref's team salary pages carry a figure only for standard contracts. A two-way
deal — the NBA/G-League hybrid that has existed since 2017-18 — shows up as an
empty cell, which parses as $0. The player was paid; the page just doesn't say
what.

$0 is worse than missing, because everything downstream treats it as real: the
player sinks to the bottom of the salary rank, his net value is priced against
a cost of nothing, and his team's payroll is short by the amount. So the known
figures live here and are reapplied on top of every scrape.

Keyed by (bbref_slug, season, team), which is exactly the grain of the salaries
table's unique index. Slug rather than name, so a name collision can't quietly
move a salary onto the wrong player.

backfill_salaries applies these while it scrapes, before it sums team payroll,
so the payroll comes out right without a second pass. Run this module directly
to patch a database that was filled before an override was added:

    python salary_overrides.py
"""
from db import connect

# Sourced by hand from contract reporting, since bref carries no figure.
SALARY_OVERRIDES = {
    # Two-way contract both seasons, before his first standard deal in 2019-20.
    ("carusal01", "2017-2018", "LAL"): 77_250,
    ("carusal01", "2018-2019", "LAL"): 77_250,
}


def override_for(slug, season, team):
    """The figure to use for this row, or None to keep what bref gave."""
    return SALARY_OVERRIDES.get((slug, season, team))


def apply(cur):
    """Write every override straight to the database, ignoring what's there.

    For retrofitting a database that predates an entry. Returns the number of
    rows written; a row that was already correct still counts, since the point
    is the value being right afterwards, not this run being the one to fix it.
    """
    applied = 0
    for (slug, season, team), salary in SALARY_OVERRIDES.items():
        cur.execute(
            """
            INSERT INTO salaries (player_id, season, team, salary, source)
            SELECT p.id, %s, %s, %s, 'bref'
            FROM players p WHERE p.bbref_slug = %s
            ON CONFLICT (player_id, season, team) DO UPDATE
              SET salary = EXCLUDED.salary
            """,
            (season, team, salary, slug),
        )
        if cur.rowcount == 0:
            # Loud rather than silent: a mistyped slug would otherwise look
            # like a clean run that happened to fix nothing.
            print(f"  WARNING: no player with bbref_slug {slug!r}, skipped")
        else:
            applied += cur.rowcount
    return applied


def main():
    conn = connect()
    cur = conn.cursor()
    applied = apply(cur)
    conn.commit()
    cur.close()
    conn.close()
    print(f"applied {applied} salary override(s)")


if __name__ == "__main__":
    main()
