"""Refreshes `rosters`: who is on each team today, and his cap hit.

The pool /trade-finder deals from. One BALLDONTLIE request per team
(/nba/v1/contracts/teams), which lists the players a team actually has, so a
waived player's dead money, still on his old team's bref contracts page,
never shows up as someone who can be traded.

A player BALLDONTLIE has just moved arrives with no cap hit for a while. His
contract hasn't changed, so it is taken from his year in `future_salaries`:
the row on his new team if it has caught up, otherwise his only row
anywhere. Two rows and neither on his new team is one contract plus dead
money that can't be told apart, so he stays unpriced. So does anyone neither
source prices, mostly two-way deals; the trade finder leaves them out.

The table is replaced in one transaction, and only when every team came back,
so a failed request leaves yesterday's rosters in place.

Usage:
  python backfill_rosters.py            # the season now in progress
  python backfill_rosters.py 2026-27
"""
import sys

import bdl
from backfill_stats import current_season
from db import connect, to_season_label
from map_balldontlie import team_abbrs


def team_contracts(cur, start_year=None, require_all=True):
    """[(canonical team, contract)] for every roster, all 30 teams or an error.

    `start_year` picks the season (2026 is 2026-27); omitted, BALLDONTLIE
    returns the season now in progress. `require_all=False` is for seasons
    years out, where a team with nothing committed yet is real, not a failed
    fetch. Also read by backfill_bdl_salaries and backfill_future_salaries.
    """
    abbr_for = team_abbrs(cur)
    cur.execute("SELECT abbr FROM teams")
    ours = {row[0] for row in cur.fetchall()}
    params = {} if start_year is None else {"season": start_year}

    rows = []
    teams = 0
    for team in bdl.get("/v1/teams")["data"]:
        abbr = abbr_for.get(team["abbreviation"], team["abbreviation"])
        # /v1/teams carries defunct franchises and exhibition opponents too
        # (with a blank conference), one of them a second WAS.
        if not (team.get("conference") or "").strip() or abbr not in ours:
            continue
        contracts = bdl.get("/nba/v1/contracts/teams", team_id=team["id"], **params)["data"]
        if not contracts and require_all:
            raise RuntimeError(f"no contracts for {abbr}; leaving the tables as they were")
        teams += 1
        rows.extend((abbr, c) for c in contracts)
    if teams != 30:
        raise RuntimeError(f"expected 30 teams, got {teams}; leaving the tables as they were")
    return rows


def fetch(cur):
    """[(bdl player, canonical team, cap hit or None)] for every roster.

    A two-way deal has no cap hit, so it takes the cash paid, as `salaries` does.
    """
    return [(c["player"], abbr, c.get("cap_hit") or c.get("total_cash")) for abbr, c in team_contracts(cur)]


def bref_cap_hit(contracts, player_id, team):
    """His bref contract year this season, if it can be pinned to one row."""
    years = contracts.get(player_id, [])
    on_team = [salary for t, salary in years if t == team]
    if on_team:
        return on_team[0]
    if len(years) == 1:
        return years[0][1]
    return None


def run(season):
    conn = connect()
    with conn, conn.cursor() as cur:
        fetched = fetch(cur)

        cur.execute("SELECT balldontlie_id, id FROM players WHERE balldontlie_id IS NOT NULL")
        pid_for = dict(cur.fetchall())
        cur.execute(
            "SELECT player_id, team, salary FROM future_salaries "
            "WHERE season = %s AND player_id IS NOT NULL",
            (season,),
        )
        contracts = {}
        for pid, team, salary in cur.fetchall():
            contracts.setdefault(pid, []).append((team, salary))

        out, seen = [], set()
        counts = {"bdl": 0, "contracts": 0, None: 0}
        for p, team, cap_hit in fetched:
            if p["id"] in seen:
                continue
            seen.add(p["id"])
            pid = pid_for.get(p["id"])
            source = "bdl" if cap_hit else None
            if not cap_hit and pid is not None:
                cap_hit = bref_cap_hit(contracts, pid, team)
                source = "contracts" if cap_hit else None
            counts[source] += 1
            name = f"{p['first_name']} {p['last_name']}".strip()
            out.append((pid, p["id"], name, team, season, cap_hit or None, source))

        cur.execute("DELETE FROM rosters WHERE season = %s", (season,))
        cur.executemany(
            "INSERT INTO rosters (player_id, balldontlie_id, name, team, season, cap_hit, cap_source) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            out,
        )
    conn.close()
    unpinned = sum(1 for r in out if r[0] is None)
    print(
        f"{len(out)} rostered players: {counts['bdl']} priced by BALLDONTLIE, "
        f"{counts['contracts']} from future_salaries, {counts[None]} unpriced; {unpinned} not pinned to a player"
    )


def main():
    season = sys.argv[1] if len(sys.argv) > 1 else current_season()
    run(to_season_label(season))


if __name__ == "__main__":
    main()
