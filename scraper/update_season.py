"""The daily in-season job: refresh today's games, then recompute Net Value.

It runs as two jobs from two places, so that either can fail without holding
up the other:

  --bdl    every BALLDONTLIE call, from GitHub Actions
           (.github/workflows/daily.yml). Stats, team splits, rosters,
           salaries, and future contracts.
  --bref   every basketball-reference call, from launchd on the desktop
           (schedule/run_daily.sh), which bref doesn't block the way it does
           cloud addresses. Positions and games started, advanced stats,
           awards, the salary cap, and once a week, dead money.

Each job ends by recomputing production and net values from whatever is in
the database and revalidating the site, so the BALLDONTLIE numbers land even
on a day the bref scrape fails, priced against yesterday's positions. The
model's writes take a database lock (db.lock_writes), so the two jobs never
write it at once. With neither flag, both run, BALLDONTLIE first.

Inside a job, a failed step is reported and the rest still run; the job exits
non-zero at the end if anything failed, which is what alerts.

Net Value is a function of things that all move during a season, so each one
has to be refreshed before the numbers mean anything:

  BALLDONTLIE       backfill_bdl, the paid API that replaced nba.com: every
                    game line of the season, summed into box score totals;
                    each team's offensive and defensive rating, which
                    production starts from, and its MINUTES PLAYED SO FAR,
                    overtime included, which set the availability
                    denominator (without them, a player who has started every
                    game of a 20-game-old season looks 25% available against
                    a full 82-game workload); wins, losses, SRS, and once the
                    playoffs start, who is in them and who won; nba.com's
                    advanced numbers (TS%, USG% and the rest); how much of
                    each player's scoring was assisted; and the shots
                    defended, deflections, contests, and other hustle counts
                    the defensive model reads. Also adds anyone on a roster
                    who isn't on file yet, chiefly rookies before their
                    debut, so their contracts have someone to match to.
  position, GS      bref's totals page: BALLDONTLIE has only G/F/C and no
                    games started, and production baselines each player
                    against his position, so without this every player of
                    the season is position-less. Fills in age, too.
  bref advanced     basketball-reference's advanced page, for the figures only
                    bref has: VORP, BPM, PER and Win Shares. The model no longer
                    needs it; VORP is priced alongside for comparison only.
  team splits       a traded player's season, one row per team: the game
                    lines summed per team, with dates and days on each
                    roster, so a trade shows up the day after the player's
                    first game with his new team. No bref.
  production        recomputed for this season from all of the above
  future contracts  BALLDONTLIE's team contracts, one request per team per
                    season, and each signed player's contract notes for
                    player and team options: every year a player is signed
                    through past this one. Not part of the model; kept current
                    because signings, trades, and waivers change it any day.
  rosters           BALLDONTLIE's team contracts, one request per team: who
                    is on each roster today and his cap hit, for
                    /trade-finder. No dead money, unlike bref's pages.
  dead money        bref's team contracts pages, 30 requests, weekly
                    (backfill_dead_money.due): waived contracts still on a
                    team's books in future years, which BALLDONTLIE lacks.
  awards            nothing is voted on until the season ends, so this is a
                    no-op for most of the year and then fills in by itself the
                    day bref publishes. Cheap either way: one cached page.
  salary caps       bref's cap history, one page: picks up next season's cap
                    the day bref publishes it, usually in early summer
  salaries          BALLDONTLIE's team contracts, one request per team per
                    season: this season's and next season's. It's how
                    signings, extensions, and trades reach the salaries
                    table, and how a season has salaries on file before it
                    tips off. A traded player's row moves with him; a waived
                    one's stays behind as dead money (backfill_bdl_salaries).
                    Past seasons keep their bref figures (backfill_salaries).
  net values        recomputed for this season only. Each season is priced
                    against itself, so nothing that happens now can move an
                    older one; rebuilding all of them every morning rewrote
                    17,000 unchanged rows. Run compute_net_values.py with no
                    season after a change to the model. Next season's
                    contracts get rows of their own (pay, no Net Value)
                    once bref publishes its cap.

bref pages are cached on disk forever by default, which is right for finished
seasons and useless for this one, so the cache is given a few hours' life here.

A caveat worth knowing rather than discovering: early in a season these numbers
are noisy. Production is a counting stat, so after five games nobody has
accumulated much of anything and small differences swing the ranks around. The
figures settle as the sample grows.

Usage:
  python update_season.py --bdl              # GitHub's job
  python update_season.py --bref             # launchd's job
  python update_season.py                    # both
  python update_season.py --bdl 2026-27      # an explicit season
  python update_season.py --bref --dead-money   # dead money even if not due
"""
import sys
import traceback

import bref
from backfill_stats import current_season
from db import connect, to_season_label
from revalidate import revalidate

# Long enough to avoid re-fetching on repeated runs, short enough that a job run
# once a day always sees yesterday's games.
CACHE_HOURS = 6


def run_step(name, fn, failed):
    """Runs one step; a failure is printed and recorded, not raised."""
    print(f"\n=== {name} ===", flush=True)
    try:
        fn()
    except BaseException as e:  # SystemExit too: several scripts exit on bad data
        if isinstance(e, KeyboardInterrupt):
            raise
        traceback.print_exc()
        print(f"!!! {name} failed; carrying on", flush=True)
        failed.append(name)


def call_main(module, *args):
    """Runs a script's main() as if from the command line."""
    sys.argv = [module.__name__, *map(str, args)]
    module.main()


def bdl_steps(season, failed):
    import backfill_bdl
    import backfill_bdl_salaries
    import backfill_future_salaries
    import backfill_rosters
    import backfill_team_splits

    start_year = int(season[:4])
    end_year = start_year + 1

    run_step(f"stats from BALLDONTLIE: {season}",
             lambda: backfill_bdl.run(start_year), failed)

    # Game logs only: the model reads a stint's box score, dates and roster
    # days, all from BALLDONTLIE, and nothing reads bref's per-team columns.
    run_step(f"team splits: {end_year}",
             lambda: call_main(backfill_team_splits, end_year, "--box-only"), failed)

    run_step("future contracts from BALLDONTLIE",
             lambda: backfill_future_salaries.run(write=True), failed)

    # After future contracts: a player with no figure on his roster entry
    # takes his year from there.
    run_step("rosters and cap hits from BALLDONTLIE",
             lambda: backfill_rosters.run(to_season_label(season)), failed)

    # This season and next. Next season's contracts are on BALLDONTLIE long
    # before its cap is; it's priced once bref publishes one (priced_seasons).
    for year in (start_year, start_year + 1):
        run_step(f"salaries from BALLDONTLIE: {backfill_bdl_salaries.label(year)}",
                 lambda year=year: backfill_bdl_salaries.run(year, write=True), failed)

    # Not on/off. backfill_on_off.py is thirty nba.com requests, one per team,
    # and nothing in the model or on the site reads player_on_off. The table
    # stays as last backfilled; run backfill_on_off.py by hand once something
    # reads it.


def bref_steps(season, failed, force_dead_money=False):
    import backfill_advanced
    import backfill_awards
    import backfill_bref_stats
    import backfill_dead_money
    import seed_seasons

    end_year = int(season[:4]) + 1
    bref.MAX_CACHE_AGE = CACHE_HOURS * 3600

    run_step(f"positions and games started from bref: {end_year}",
             lambda: call_main(backfill_bref_stats, end_year), failed)

    run_step(f"advanced stats from bref: {end_year}",
             lambda: call_main(backfill_advanced, end_year), failed)

    # bref only. The nba.com pass walks every ever-All-Star player one request
    # at a time, which is a backfill's job rather than a daily one; bref's own
    # all-star page covers everyone who played in this season's game.
    run_step(f"awards from bref: {end_year}",
             lambda: call_main(backfill_awards, end_year, "--skip-nba"), failed)

    def caps():
        conn = connect()
        with conn, conn.cursor() as cur:
            print(f"upserted {seed_seasons.seed_caps(cur)} league caps")
        conn.close()
    run_step("salary caps from bref", caps, failed)

    def dead_money():
        conn = connect()
        with conn, conn.cursor() as cur:
            due = force_dead_money or backfill_dead_money.due(cur)
        conn.close()
        if due:
            backfill_dead_money.run(True)
        else:
            print("not due: refreshed within the week")
    run_step("dead money from bref (weekly)", dead_money, failed)


def priced_seasons(season):
    """This season, plus next once bref has published its cap: the model
    prices nothing without one."""
    from backfill_bdl_salaries import label

    priced = [to_season_label(season)]
    next_label = label(int(season[:4]) + 1)
    conn = connect()
    with conn, conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM seasons WHERE season = %s AND league_cap IS NOT NULL",
            (next_label,),
        )
        if cur.fetchone():
            priced.append(next_label)
    conn.close()
    return priced


def recompute(season, failed):
    """Production and net values from what's in the database, then the site.
    No network calls but the revalidate."""
    import compute_net_values
    import compute_production

    label = to_season_label(season)
    run_step(f"production: {label}",
             lambda: call_main(compute_production, label), failed)
    for priced in priced_seasons(season):
        run_step(f"net values: {priced}",
                 lambda priced=priced: call_main(compute_net_values, priced), failed)
    run_step("revalidate", revalidate, failed)


def main():
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    unknown = flags - {"--bdl", "--bref", "--dead-money"}
    if unknown:
        raise SystemExit(f"unknown option {sorted(unknown)[0]}; see the usage at the top")
    season = args[0] if args else current_season()
    both = not ({"--bdl", "--bref"} & flags)

    failed = []
    if both or "--bdl" in flags:
        bdl_steps(season, failed)
    if both or "--bref" in flags:
        bref_steps(season, failed, force_dead_money="--dead-money" in flags)
    recompute(season, failed)

    if failed:
        print(f"\n{len(failed)} step(s) failed: {', '.join(failed)}")
        sys.exit(1)
    print("\nall steps succeeded")


if __name__ == "__main__":
    main()
