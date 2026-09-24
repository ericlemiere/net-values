"""
Seeds the `teams` table from nba_api's static team list (authoritative source
for NBA.com team ids/abbreviations/names), then seeds `team_aliases` with
historical/basketball-reference-style abbreviations that resolve to those
canonical teams. Idempotent — safe to re-run.

Alias sources verified against nba_api's static `year_founded` field rather
than assumed, since franchise-lineage claims (e.g. Charlotte Hornets vs New
Orleans Pelicans) are genuinely ambiguous in NBA history. See README notes
in the final report for details.
"""
from nba_api.stats.static import teams as static_teams

from db import connect

# alias -> canonical current abbreviation
ALIASES = {
    "WSB": "WAS",  # Washington Bullets -> Wizards (1997 rename), same franchise
    "CHH": "CHA",  # Charlotte Hornets 1988-2002; nba_api credits this history to
                   # the current Hornets (year_founded=1988 on team id 1610612766)
    "VAN": "MEM",  # Vancouver Grizzlies -> Memphis (2001 relocation)
    "SEA": "OKC",  # Seattle SuperSonics -> OKC Thunder (2008 relocation)
    "NJN": "BKN",  # New Jersey Nets -> Brooklyn (2012 relocation/rename)
    "NOH": "NOP",  # New Orleans Hornets (2002-2013) -> Pelicans (2013 rename)
    "NOK": "NOP",  # New Orleans/Oklahoma City Hornets, Katrina-displaced seasons
    "BRK": "BKN",  # basketball-reference-style abbreviation for Brooklyn
    "CHO": "CHA",  # basketball-reference-style abbreviation for Charlotte
    "PHO": "PHX",  # basketball-reference-style abbreviation for Phoenix
    "UTH": "UTA",  # Spotrac-style abbreviation for Utah (SalariesCapHitsSPO tables)
    # nba.com's own older spellings, which turn up in leaguegamelog for the
    # early-90s seasons even though the static team list gives the modern code.
    "GOS": "GSW",  # Golden State
    "PHL": "PHI",  # Philadelphia
    "SAN": "SAS",  # San Antonio
}


def main():
    conn = connect()
    cur = conn.cursor()

    for t in static_teams.get_teams():
        cur.execute(
            """
            INSERT INTO teams (nba_team_id, abbr, name)
            VALUES (%s, %s, %s)
            ON CONFLICT (nba_team_id) DO UPDATE SET abbr = EXCLUDED.abbr, name = EXCLUDED.name
            """,
            (t["id"], t["abbreviation"], t["full_name"]),
        )
    conn.commit()
    print(f"Seeded {len(static_teams.get_teams())} canonical teams")

    cur.execute("SELECT abbr, id FROM teams")
    abbr_to_id = {row[0]: row[1] for row in cur.fetchall()}

    inserted = 0
    for alias, canonical_abbr in ALIASES.items():
        team_id = abbr_to_id[canonical_abbr]
        cur.execute(
            """
            INSERT INTO team_aliases (team_id, alias)
            VALUES (%s, %s)
            ON CONFLICT (alias) DO UPDATE SET team_id = EXCLUDED.team_id
            """,
            (team_id, alias),
        )
        inserted += 1
    conn.commit()
    print(f"Seeded {inserted} team aliases")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
