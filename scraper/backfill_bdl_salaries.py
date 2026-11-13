"""Refreshes `salaries` and `team_payrolls` for this season and later ones from
BALLDONTLIE, in place of scraping bref's 30 team pages every morning.

One request per team per season (/nba/v1/contracts/teams), the same endpoint
backfill_rosters reads. Past seasons are left alone: their bref figures are
final, and BALLDONTLIE's history is a 15-man snapshot per team that leaves out
anyone traded or waived along the way. backfill_salaries.py still owns those.

THE FIGURE is the cap hit, which matches bref's salary for 92% of the players
both list (most of the rest are bref showing a different contract year). A
two-way contract has no cap hit, only cash paid, so it takes that instead: a
real figure where bref left the cell blank.

ONE TEAM PER PLAYER. BALLDONTLIE lists a player under the team he is on today,
bref under every team that paid him. So when a player turns up on a new team,
his row on the old one has to be dealt with, or the model, which sums a
player's rows (compute_net_values.SALARY_FOR_SEASON), pays him twice. What the
old row is depends on how he moved:

  traded             the same contract, now owed by the new team. The old row
                     is deleted; the model splits the salary between his teams
                     by days on each roster (traded_shares).
  waived, re-signed  a new contract, and the old team still owes the old one.
                     The old row is dead money and stays, charged to the team
                     that waived him.

His contract history tells the two apart: traded, his current contract was
signed with some other team; re-signed, it was signed with the team he is on.
One /contracts/players/aggregate request per player who moved, so a handful a
day. Only an old row within TRADE_BONUS of the new figure goes: a trade carries
the contract over (plus any trade bonus, at most 15%), and anything else on
the old team is a separate contract, most likely dead money.

A player who drops off every roster (waived and unsigned) simply stops being
updated; his last row stands as the dead money it now is.

team_payrolls is the sum of each team's rows after the update, dead money
included, which is what bref's payroll column was too.

Dry run by default: prints what would change, including the largest payroll
and salary deltas, and writes nothing.

Usage:
  python backfill_bdl_salaries.py                  # dry run: this season and next
  python backfill_bdl_salaries.py --write
  python backfill_bdl_salaries.py 2026 --write     # one start year (2026 is 2026-27)
"""
import re
import sys
import time

import psycopg2

import bdl
from backfill_rosters import team_contracts
from backfill_stats import current_season
from db import connect
from map_balldontlie import team_abbrs

TRADE_BONUS = 0.15

OPTION_NOTE = re.compile(r"^(\d{4})-\d{2}: (Player|Club|Team|Early Termination) Option(.*)$")
OPTION_KIND = {"Player": "player", "Early Termination": "player", "Club": "team", "Team": "team"}

_aggregates = {}


def contracts_of(bdl_id):
    """A player's contracts (/contracts/players/aggregate), once per run."""
    if bdl_id not in _aggregates:
        _aggregates[bdl_id] = bdl.get("/nba/v1/contracts/players/aggregate", player_id=bdl_id)["data"]
    return _aggregates[bdl_id]


def live(a):
    return (a.get("contract_status") or "").lower() != "expired"


def signed_through(bdl_id):
    """Start years covered by a contract that hasn't expired.

    BALLDONTLIE's season-by-season lists run past them: a year left over from
    a contract since replaced (Jonathan Isaac's old extension, after his
    one-year deal), or a hold after a deal ends (Brayden Burries, $27M in the
    year after his rookie deal). A future year counts only if this covers it.
    """
    return {y for a in contracts_of(bdl_id) if live(a)
            for y in range(a["start_year"], a["end_year"] + 1)}


def open_options(bdl_id, after_year):
    """{start year: 'player' | 'team'} for option years after `after_year`
    still to be decided. Read from the notes; rookie-scale deals have none."""
    out = {}
    for a in contracts_of(bdl_id):
        if not live(a):
            continue
        for note in a.get("contract_notes") or []:
            m = OPTION_NOTE.match(note.strip())
            decided = any(w in m.group(3).lower() for w in ("exercised", "declined")) if m else True
            if m and int(m.group(1)) > after_year and not decided:
                out[int(m.group(1))] = OPTION_KIND[m.group(2)]
    return out


def label(start_year):
    return f"{start_year}-{start_year + 1}"


def salary_of(contract):
    """Cap hit, else cash paid (a two-way deal has no cap hit). None if neither."""
    return contract.get("cap_hit") or contract.get("total_cash") or None


def roster_salaries(cur, start_year):
    """{player_id: (team, salary, bdl id)} for everyone rostered and priced.

    Logs and skips anyone not pinned to a player (map_balldontlie.py fixes
    that) and anyone with no figure at all. A season still to come keeps only
    the years a live contract covers (signed_through).
    """
    future = start_year > int(current_season()[:4])
    cur.execute("SELECT balldontlie_id, id FROM players WHERE balldontlie_id IS NOT NULL")
    pid_for = dict(cur.fetchall())

    out, unpinned, unpriced, uncovered = {}, [], 0, 0
    for abbr, c in team_contracts(cur, start_year):
        pid = pid_for.get(c["player_id"])
        name = f"{c['player']['first_name']} {c['player']['last_name']}"
        if pid is None:
            unpinned.append(f"{name} ({abbr})")
            continue
        salary = salary_of(c)
        if salary is None:
            unpriced += 1
            continue
        if future and start_year not in signed_through(c["player_id"]):
            uncovered += 1
            continue
        out[pid] = (abbr, salary, c["player_id"])
    if unpinned:
        print(f"  not pinned to a player, skipped: {', '.join(unpinned)}")
    if unpriced:
        print(f"  {unpriced} contracts with no figure, skipped")
    if uncovered:
        print(f"  {uncovered} years no live contract covers, skipped")
    return out


def signed_with(bdl_id, start_year, abbr_for):
    """Teams his current contracts covering the season were signed with.

    An empty set means BALLDONTLIE has no contract on record for the season,
    and the move can't be classified.
    """
    teams = set()
    for a in contracts_of(bdl_id):
        if (a.get("contract_status") or "").upper() != "CURRENT":
            continue
        if not (a["start_year"] <= start_year <= a["end_year"]):
            continue
        raw = a["team"]["abbreviation"]
        teams.add(abbr_for.get(raw, raw))
    return teams


def plan(cur, start_year):
    """The changes for one season, without making them."""
    season = label(start_year)
    roster = roster_salaries(cur, start_year)
    abbr_for = team_abbrs(cur)

    cur.execute(
        "SELECT player_id, team, salary, source FROM salaries WHERE season = %s",
        (season,),
    )
    on_file = {}
    for pid, team, salary, source in cur.fetchall():
        on_file.setdefault(pid, {})[team] = (salary, source)

    upserts, deletes, kept, unclassified = [], [], [], []
    future = start_year > int(current_season()[:4])
    for pid, (team, salary, bdl_id) in roster.items():
        rows = on_file.get(pid, {})
        old = rows.get(team)
        if old is None or old[0] != salary or old[1] != "bdl":
            upserts.append((pid, team, salary, old[0] if old else None))
        if future:
            continue

        elsewhere = {t: s for t, (s, _) in rows.items() if t != team and s}
        if not elsewhere:
            continue
        signed = signed_with(bdl_id, start_year, abbr_for)
        if not signed:
            unclassified.append((pid, team, elsewhere))
            continue
        traded = team not in signed
        for t, s in elsewhere.items():
            if traded and abs(s - salary) <= TRADE_BONUS * max(s, salary):
                deletes.append((pid, t, s, team))
            else:
                kept.append((pid, t, s, team))
    # A season still to come has no dead money worth keeping and nobody who
    # has been traded mid-way through it: it simply mirrors BALLDONTLIE, so
    # a year that's gone from there (declined, replaced, never real) goes.
    if future:
        for pid, rows in on_file.items():
            for t, (s, _) in rows.items():
                if roster.get(pid, (None,))[0] != t:
                    deletes.append((pid, t, s or 0, roster.get(pid, (None,))[0]))
    return season, upserts, deletes, kept, unclassified


def payrolls(cur, season):
    """{team_id: payroll} summed from salaries as they stand now."""
    cur.execute(
        """
        SELECT t.id, SUM(s.salary) FROM salaries s JOIN teams t ON t.abbr = s.team
        WHERE s.season = %s AND s.salary > 0 GROUP BY t.id
        """,
        (season,),
    )
    return dict(cur.fetchall())


def apply(cur, season, upserts, deletes):
    for pid, team, salary, _ in upserts:
        cur.execute(
            """
            INSERT INTO salaries (player_id, season, team, salary, source)
            VALUES (%s, %s, %s, %s, 'bdl')
            ON CONFLICT (player_id, season, team) DO UPDATE
              SET salary = EXCLUDED.salary, source = EXCLUDED.source
            """,
            (pid, season, team, salary),
        )
    for pid, team, _, _ in deletes:
        cur.execute(
            "DELETE FROM salaries WHERE player_id = %s AND season = %s AND team = %s",
            (pid, season, team),
        )
    for team_id, payroll in payrolls(cur, season).items():
        cur.execute(
            """
            INSERT INTO team_payrolls (team_id, season, payroll, source)
            VALUES (%s, %s, %s, 'bdl')
            ON CONFLICT (team_id, season) DO UPDATE
              SET payroll = EXCLUDED.payroll, source = EXCLUDED.source
            """,
            (team_id, season, payroll),
        )


def report(cur, season, upserts, deletes, kept, unclassified, before, after):
    cur.execute("SELECT id, name FROM players WHERE id = ANY(%s)",
                ([u[0] for u in upserts] + [d[0] for d in deletes + kept + unclassified],))
    name = dict(cur.fetchall())
    cur.execute("SELECT id, abbr FROM teams")
    abbr = dict(cur.fetchall())

    new = [u for u in upserts if u[3] is None]
    changed = [u for u in upserts if u[3] is not None and u[3] != u[2]]
    print(f"  {len(new)} new rows, {len(changed)} changed figures, "
          f"{len(upserts) - len(new) - len(changed)} relabeled bdl with the same figure")
    for pid, team, salary, old in sorted(changed, key=lambda u: -abs(u[2] - u[3]))[:8]:
        print(f"    {name[pid]} ({team}): ${old:,} -> ${salary:,} ({salary - old:+,})")
    for pid, team, salary, _ in sorted(new, key=lambda u: -u[2])[:5]:
        print(f"    new: {name[pid]} ({team}) ${salary:,}")
    print(f"  {len(deletes)} rows removed (traded away, or a future year gone):")
    for pid, t, s, now in sorted(deletes, key=lambda d: -d[2])[:15]:
        print(f"    {name[pid]}: {t} ${s:,}" + (f" -> now {now}" if now else ""))
    print(f"  {len(kept)} kept on a former team as dead money:")
    for pid, t, s, now in kept:
        print(f"    {name[pid]}: {t} ${s:,} (now {now})")
    if unclassified:
        print(f"  {len(unclassified)} moved but no current contract on record, old rows left:")
        for pid, team, elsewhere in unclassified:
            print(f"    {name[pid]}: now {team}, still on file with {elsewhere}")

    deltas = sorted(
        ((after.get(t, 0) - before.get(t, 0), t) for t in set(before) | set(after)),
        key=lambda d: -abs(d[0]),
    )
    if deltas:
        print(f"  payroll: max delta {deltas[0][0]:+,} ({abbr[deltas[0][1]]}); "
              f"league {sum(before.values()):,} -> {sum(after.values()):,}")
        for d, t in deltas[1:5]:
            print(f"    {abbr[t]} {d:+,}")


def run(start_year, write):
    for attempt in range(3):
        conn = None
        try:
            conn = connect()
            with conn, conn.cursor() as cur:
                print(f"=== {label(start_year)} ===")
                season, upserts, deletes, kept, unclassified = plan(cur, start_year)
                before = payrolls(cur, season)
                apply(cur, season, upserts, deletes)
                after = payrolls(cur, season)
                report(cur, season, upserts, deletes, kept, unclassified, before, after)
                if not write:
                    conn.rollback()
                    print("  dry run: nothing written")
            conn.close()
            return
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
            if attempt == 2:
                raise
            print(f"database connection reset while refreshing salaries; retrying ({attempt + 1}/3)")
            time.sleep(5 * (attempt + 1))


def main():
    write = "--write" in sys.argv
    years = [int(a) for a in sys.argv[1:] if a != "--write"]
    if not years:
        start = int(current_season()[:4])
        years = [start, start + 1]
    for y in years:
        run(y, write)


if __name__ == "__main__":
    main()
