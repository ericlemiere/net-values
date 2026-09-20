"""Populates `seasons` (league salary cap) and backfills `team_payrolls` from
the payroll values currently duplicated on every `salaries` row.

Run this BEFORE dropping salaries.team_payroll / salaries.league_cap — for
seasons older than the bref salary backfill (pre 2011-12), those columns are the
only place that data exists.

League cap comes from basketball-reference's salary cap history table, which
covers 1984-85 through the upcoming season and agrees with the values the legacy
SQLite migration carried (verified for 2021-22 and 2022-23).

Idempotent: both tables upsert on their natural keys.
"""
import bref
from db import connect

CAP_URL = "https://www.basketball-reference.com/contracts/salary-cap-history.html"


def to_label(year_id: str) -> str:
    """bref's '2024-25' -> this schema's '2024-2025'."""
    start = int(year_id[:4])
    return f"{start}-{start + 1}"


def seed_caps(cur) -> int:
    rows = bref.parse_table(bref.fetch(CAP_URL), "salary_cap_history")
    n = 0
    for r in rows:
        label = to_label(r["year_id"])
        cap = bref.parse_money(r.get("cap", ""))
        if cap is None:
            continue
        cur.execute(
            """
            INSERT INTO seasons (season, league_cap, source) VALUES (%s, %s, 'bref')
            ON CONFLICT (season) DO UPDATE
              SET league_cap = EXCLUDED.league_cap, source = EXCLUDED.source
            """,
            (label, cap),
        )
        n += 1
    return n


def migrate_legacy_payrolls(cur) -> int:
    """Lift the distinct (season, team) -> team_payroll values off `salaries`.

    Verified conflict-free: no (season, team) pair carries two different payroll
    values, so DISTINCT is safe here. Only fills rows that don't already exist,
    so re-running after the bref backfill won't clobber bref-sourced payrolls.
    """
    cur.execute(
        """
        INSERT INTO team_payrolls (team_id, season, payroll, source)
        SELECT DISTINCT teams.id, s.season, s.team_payroll, 'sqlite_migration'
        FROM salaries s
        JOIN teams ON teams.abbr = s.team
        WHERE s.team_payroll IS NOT NULL
        ON CONFLICT (team_id, season) DO NOTHING
        """
    )
    return cur.rowcount


def main():
    conn = connect()
    cur = conn.cursor()

    caps = seed_caps(cur)
    print(f"seasons: upserted {caps} league cap rows")

    payrolls = migrate_legacy_payrolls(cur)
    print(f"team_payrolls: inserted {payrolls} legacy rows")

    conn.commit()

    cur.execute("SELECT min(season), max(season), count(*) FROM seasons")
    print("seasons range:", cur.fetchone())
    cur.execute("SELECT min(season), max(season), count(*) FROM team_payrolls")
    print("team_payrolls range:", cur.fetchone())

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
