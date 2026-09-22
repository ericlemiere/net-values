"""Seeds `team_identities` — what each franchise was called in which seasons.

`teams` carries one canonical row per franchise, which every other table's
`team` column points at. Right key, wrong label for a season the franchise
played under a different name: without this, Seattle's 1995-96 season is filed
under "Oklahoma City Thunder" and Vancouver's under "Memphis Grizzlies".

Only the six franchises that changed identity within reach of the data are
listed. Earlier moves — San Diego to Los Angeles (1984), Kansas City to
Sacramento (1985), New Orleans to Utah (1979) — ended before the earliest
season on file, so recording them would add rows nothing could ever match.

Each spell starts at the identity's real first season rather than at the edge
of the data, which is a season earlier for stats (1989-90) than for salaries
(1990-91) and could move again if either is backfilled further. Spells are
contiguous and cover every season the franchise played, so exactly one matches
any given season. The last carries last_season = NULL, meaning "still current",
so a new season needs no edit here.

Idempotent — safe to re-run.
"""
from db import connect

# canonical abbr -> [(abbr used then, name used then, first season, last season)]
#
# last_season None means the identity is the current one.
IDENTITIES = {
    "OKC": [
        ("SEA", "Seattle SuperSonics", "1967-1968", "2007-2008"),
        ("OKC", "Oklahoma City Thunder", "2008-2009", None),
    ],
    "MEM": [
        ("VAN", "Vancouver Grizzlies", "1995-1996", "2000-2001"),
        ("MEM", "Memphis Grizzlies", "2001-2002", None),
    ],
    "WAS": [
        # A rename rather than a move; the Bullets became the Wizards in 1997
        # without leaving Washington.
        ("WSB", "Washington Bullets", "1974-1975", "1996-1997"),
        ("WAS", "Washington Wizards", "1997-1998", None),
    ],
    "BKN": [
        ("NJN", "New Jersey Nets", "1977-1978", "2011-2012"),
        ("BKN", "Brooklyn Nets", "2012-2013", None),
    ],
    # Charlotte follows the NBA's own lineage, which is what nba_api reports and
    # what seed_teams.py already assumed: the 1988-2002 Hornets history belongs
    # to the present-day Charlotte franchise, and New Orleans begins in 2002-03.
    # Basketball-Reference takes the opposite view and treats those seasons as
    # the Pelicans' — worth knowing when cross-referencing, but the database is
    # consistent with itself, and the two-season hole below (Charlotte had no
    # team in 2002-03 or 2003-04) is what that consistency looks like.
    "CHA": [
        ("CHH", "Charlotte Hornets", "1988-1989", "2001-2002"),
        # The name changed and the abbreviation did not, which is precisely the
        # case team_aliases cannot express.
        ("CHA", "Charlotte Bobcats", "2004-2005", "2013-2014"),
        ("CHA", "Charlotte Hornets", "2014-2015", None),
    ],
    "NOP": [
        ("NOH", "New Orleans Hornets", "2002-2003", "2004-2005"),
        # Hurricane Katrina displaced the team to Oklahoma City for two seasons,
        # which bref records under its own abbreviation. It interrupts the
        # Hornets spell and resumes it, so NOH needs two ranges rather than one.
        ("NOK", "New Orleans/Oklahoma City Hornets", "2005-2006", "2006-2007"),
        ("NOH", "New Orleans Hornets", "2007-2008", "2012-2013"),
        ("NOP", "New Orleans Pelicans", "2013-2014", None),
    ],
}


def main():
    conn = connect()
    cur = conn.cursor()

    cur.execute("SELECT abbr, id FROM teams")
    team_ids = dict(cur.fetchall())

    # Rewritten wholesale rather than upserted: an identity whose dates were
    # corrected would otherwise leave the old row behind, overlapping the new
    # one, and the lookup would start returning whichever the planner found
    # first.
    cur.execute("TRUNCATE team_identities RESTART IDENTITY")

    written = 0
    for canonical, spells in IDENTITIES.items():
        team_id = team_ids.get(canonical)
        if team_id is None:
            print(f"  WARNING: no team {canonical!r}, skipped")
            continue
        for abbr, name, first_season, last_season in spells:
            cur.execute(
                """
                INSERT INTO team_identities
                    (team_id, abbr, name, first_season, last_season, source)
                VALUES (%s, %s, %s, %s, %s, 'manual')
                """,
                (team_id, abbr, name, first_season, last_season),
            )
            written += 1
        print(f"  {canonical}: {len(spells)} identities")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nwrote {written} identities across {len(IDENTITIES)} franchises")


if __name__ == "__main__":
    main()
