"""Refreshes `future_salaries` and `cap_projections`.

Every season a player is signed through, from BALLDONTLIE's team contracts
(/nba/v1/contracts/teams), one request per team per season, this season and
the YEARS_AHEAD after it. Replaced bref's team contracts pages on 2026-11-13.

The current season is kept too, even though `salaries` has it: the player page
shows a contract year from here only for seasons `salaries` has nothing for,
so the two never double up, and backfill_rosters falls back on it.

THE FIGURE is the cap hit, or for a two-way deal (no cap hit) the cash paid,
the same as backfill_bdl_salaries.

ONLY YEARS A LIVE CONTRACT COVERS. BALLDONTLIE's season lists run past a
player's contracts (see backfill_bdl_salaries.signed_through), so each future
year is checked against his contracts before it's kept.

OPTIONS aren't a field. They are written into the contract's notes
("2027-28: Player Option (deadline 6/29/27)", "Club Option/non-guaranteed",
"Team Option"), one /contracts/players/aggregate request per player with a
year after this one. An option already exercised is no longer an option, and
the current season never carries one: a player under contract now is past
that decision. A rookie-scale deal has no notes, so its third- and fourth-year
team options go unlabeled, deliberately.

DEAD MONEY isn't on BALLDONTLIE, which lists only the players a team has.
backfill_dead_money.py adds it weekly from bref, as source 'bref_dead' rows,
which this script never touches.

ROW IDENTITY stays (bref_slug, season, team), because the player page puts the
row's id in ?salary= links and an upsert on that key keeps it. bref_slug is the
player's bref id where we have one, else "bdl:<BALLDONTLIE id>" for a player
bref has never matched (mostly rookies before their debut).

Each run makes the table match BALLDONTLIE exactly, in one transaction and only
when the current season came back for all 30 teams, so a bad fetch leaves
yesterday's data in place. Dry run by default.

Projected caps are entered by hand below. Update them when the league
publishes new projections; a season that becomes official is read from bref
into `seasons` by seed_seasons.py and can be dropped from here.

Usage:
  python backfill_future_salaries.py           # dry run: what would change
  python backfill_future_salaries.py --write
"""
import sys
import time
from collections import Counter

import psycopg2

import bdl
from backfill_bdl_salaries import label, open_options, salary_of, signed_through
from backfill_rosters import team_contracts
from backfill_stats import current_season
from db import connect

# Season -> projected cap. 2026-27 is official and lives in `seasons`.
CAP_PROJECTIONS = {
    "2027-2028": 176_000_000,
    "2028-2029": 184_800_000,
    "2029-2030": 191_000_000,
    "2030-2031": 201_000_000,
}

# Seasons after this one to fetch. Five, as bref's pages had; a sixth season out
# is checked too, and fetched if anyone is signed that far.
YEARS_AHEAD = 5

def fetch(cur, start_year):
    """{(slug, season, team): (player_id, name, salary, option)}."""
    cur.execute("SELECT balldontlie_id, id, bbref_slug FROM players WHERE balldontlie_id IS NOT NULL")
    player = {bid: (pid, slug) for bid, pid, slug in cur.fetchall()}

    years = {}
    for year in range(start_year, start_year + YEARS_AHEAD + 2):
        rows = team_contracts(cur, year, require_all=(year == start_year))
        if year > start_year + YEARS_AHEAD and not rows:
            break
        years[year] = rows

    future = {c["player_id"] for y, rows in years.items() if y > start_year for _, c in rows}
    covered = {bid: signed_through(bid) for bid in sorted(future)}
    options = {bid: open_options(bid, start_year) for bid in sorted(future)}

    out, skipped = {}, 0
    for year, rows in years.items():
        for team, c in rows:
            salary = salary_of(c)
            if not salary:
                continue
            bid = c["player_id"]
            if year > start_year and year not in covered[bid]:
                skipped += 1
                continue
            pid, slug = player.get(bid, (None, None))
            name = f"{c['player']['first_name']} {c['player']['last_name']}".strip()
            option = options.get(bid, {}).get(year)
            out[(slug or f"bdl:{bid}", label(year), team)] = (pid, name, salary, option)
    print(f"  {skipped} future years no live contract covers, skipped")
    return out


def seed_projections(cur):
    for season, cap in CAP_PROJECTIONS.items():
        cur.execute(
            """
            INSERT INTO cap_projections (season, league_cap, source)
            VALUES (%s, %s, 'projected')
            ON CONFLICT (season) DO UPDATE
              SET league_cap = EXCLUDED.league_cap, source = EXCLUDED.source
            """,
            (season, cap),
        )


def report(cur, rows):
    cur.execute("SELECT bref_slug, season, team, salary, option, name FROM future_salaries "
                "WHERE source <> 'bref_dead'")
    old = {(s, y, t): (sal, o, n) for s, y, t, sal, o, n in cur.fetchall()}
    kept = [k for k in rows if k in old]
    changed = [k for k in kept if old[k][0] != rows[k][2]]
    opt_changed = [k for k in kept if old[k][1] != rows[k][3]]
    added = [k for k in rows if k not in old]
    removed = [k for k in old if k not in rows]
    print(f"{len(rows)} contract years for {len({k[0] for k in rows})} players "
          f"({sum(1 for v in rows.values() if v[3])} options)")
    print(f"  {len(kept)} rows keep their id; {len(changed)} with a new figure, "
          f"{len(opt_changed)} with a different option")
    print(f"  {len(added)} added, {len(removed)} removed")
    by_season = Counter(k[1] for k in removed)
    print(f"  removed by season: {dict(sorted(by_season.items()))}")
    for k in sorted(removed, key=lambda k: -old[k][0])[:12]:
        print(f"    - {old[k][2]} {k[1]} {k[2]} ${old[k][0]:,}")
    for k in sorted(added, key=lambda k: -rows[k][2])[:6]:
        print(f"    + {rows[k][1]} {k[1]} {k[2]} ${rows[k][2]:,}")
    for k in opt_changed[:8]:
        print(f"    option {rows[k][1]} {k[1]}: {old[k][1]} -> {rows[k][3]}")

    def commitments(src, sal):
        out = Counter()
        for k, v in src.items():
            out[(k[1], k[2])] += sal(v)
        return out
    before = commitments(old, lambda v: v[0])
    after = commitments(rows, lambda v: v[2])
    deltas = sorted(((after[k] - before[k], k) for k in set(before) | set(after)
                     if k[0] != label(int(current_season()[:4]))), key=lambda d: -abs(d[0]))
    print("  biggest future team commitment changes:")
    for d, (season, team) in deltas[:6]:
        print(f"    {team} {season}: {d:+,}")


def run(write):
    start_year = int(current_season()[:4])
    # Fetched on a connection of its own and closed before the write: the
    # fetch is a few hundred requests, and a connection idle that long is the
    # one Neon drops.
    conn = connect()
    with conn, conn.cursor() as cur:
        rows = fetch(cur, start_year)
    conn.close()
    if not rows:
        raise RuntimeError("no contract years fetched; leaving future_salaries untouched")

    for attempt in range(3):
        conn = None
        try:
            conn = connect()
            with conn, conn.cursor() as cur:
                report(cur, rows)
                if write:
                    write_rows(cur, rows)
            conn.close()
            if not write:
                print("dry run: nothing written")
            return
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
            if attempt == 2:
                raise
            print(f"database connection reset during future salaries; retrying ({attempt + 1}/3)")
            time.sleep(5 * (attempt + 1))


def write_rows(cur, rows):
    seed_projections(cur)
    cur.executemany(
        """
        INSERT INTO future_salaries
          (bref_slug, season, team, player_id, name, salary, option, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'bdl')
        ON CONFLICT (bref_slug, season, team) DO UPDATE
          SET player_id = EXCLUDED.player_id, name = EXCLUDED.name,
              salary = EXCLUDED.salary, option = EXCLUDED.option,
              source = EXCLUDED.source, updated_at = now()
        """,
        [(slug, year, team, *vals) for (slug, year, team), vals in rows.items()],
    )
    # Whatever this run didn't see is no longer on anyone's books.
    cur.execute(
        """
        DELETE FROM future_salaries f
        WHERE f.source <> 'bref_dead'
          AND NOT EXISTS (
            SELECT 1 FROM unnest(%s::text[], %s::text[], %s::text[]) AS k(slug, season, team)
            WHERE k.slug = f.bref_slug AND k.season = f.season AND k.team = f.team)
        """,
        [list(col) for col in zip(*rows.keys())],
    )
    print(f"written; {cur.rowcount} removed")


def main():
    run(write="--write" in sys.argv)


if __name__ == "__main__":
    main()
