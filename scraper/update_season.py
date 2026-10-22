"""The daily in-season job: refresh today's games, then recompute Net Value.

Net Value is a function of things that all move during a season, so each one
has to be refreshed before the numbers mean anything:

  box score stats   nba_api, via update_daily
  position, GS      bref's totals page: nba_api has neither, and production
                    baselines each player against his position, so without
                    this every player of the season is position-less
  nba.com advanced  nba_api: TS%, USG% and the rest of what nba.com publishes
  bref advanced     basketball-reference's advanced page, for the figures only
                    bref has: VORP, BPM, PER and Win Shares. The model no longer
                    needs it; VORP is priced alongside for comparison only.
  team splits       a traded player's season, one row per team: nba.com's game
                    logs (one request) for the box score and bref's per-team
                    rows for the rest, so a trade shows up the day after the
                    player's first game with his new team
  team ratings      nba_api's game log: each team's offensive and defensive
                    rating, which production starts from, and its MINUTES
                    PLAYED SO FAR, overtime included, which set the
                    availability denominator. Without them, a player who has
                    started every game of a 20-game-old season looks 25%
                    available against a full 82-game workload.
  team records      nba_api's game log again: wins, losses, SRS, and once the
                    playoffs start, who is in them and who won.
  scoring splits    nba_api: how much of each player's scoring was assisted
  tracking defense  nba_api: shots defended, deflections, contests and the
                    other hustle counts the defensive model reads
  production        recomputed for this season from all of the above
  on/off            nba.com's on-court and off-court team ratings, one request
                    per team (30 a day). Nothing in the model reads them yet;
                    kept current so the table is complete when something does.
  future contracts  bref's team contracts pages, one request per team: every
                    year a player is signed through past this one, with player
                    and team options. Not part of the model; kept current
                    because signings, trades, and waivers change it any day.
  awards            nothing is voted on until the season ends, so this is a
                    no-op for most of the year and then fills in by itself the
                    day bref publishes. Cheap either way: one cached page.
  rosters           nba.com's current-season player list, one request: adds
                    anyone on a roster who isn't on file yet, chiefly rookies
                    before their debut, so their contracts have someone to
                    match to and they're on the salaries pages from day one
  salary caps       bref's cap history, one page: picks up next season's cap
                    the day bref publishes it, usually in early summer
  salaries          bref's team pages, one request per team: this season's,
                    and next season's too once bref has a page for it. Quiet
                    for most of the year; it's how signings, extensions, and
                    trades reach the salaries table, most of them in summer,
                    and how a season has salaries on file before it tips off.
  net values        recomputed for this season only. Each season is priced
                    against itself, so nothing that happens now can move an
                    older one; rebuilding all of them every morning rewrote
                    17,000 unchanged rows. Run compute_net_values.py with no
                    season after a change to the model. Next season's
                    contracts get rows of their own (pay, no Net Value)
                    once its salaries are in.

bref pages are cached on disk forever by default, which is right for finished
seasons and useless for this one, so the cache is given a few hours' life here.

A caveat worth knowing rather than discovering: early in a season these numbers
are noisy. Production is a counting stat, so after five games nobody has
accumulated much of anything and small differences swing the ranks around. The
figures settle as the sample grows.

Usage:
  python update_season.py              # the season now in progress
  python update_season.py 2026-27      # an explicit nba_api season string
"""
import sys

import bref
from backfill_stats import current_season
from db import connect, to_season_label
from revalidate import revalidate

# Long enough to avoid re-fetching on repeated runs, short enough that a job run
# once a day always sees yesterday's games.
CACHE_HOURS = 6


def main():
    season = sys.argv[1] if len(sys.argv) > 1 else current_season()
    # "2026-27" -> 2027, the end year bref names its pages by.
    end_year = int(season[:4]) + 1

    bref.MAX_CACHE_AGE = CACHE_HOURS * 3600

    import update_daily
    import backfill_bref_stats
    import backfill_nba_advanced
    import backfill_advanced
    import backfill_team_splits
    import backfill_team_ratings
    import update_team_records
    import backfill_scoring_splits
    import backfill_tracking_defense
    import compute_production
    import backfill_on_off
    import backfill_awards
    import backfill_future_salaries
    import backfill_salaries
    import seed_rosters
    import seed_seasons
    import compute_net_values

    print(f"=== stats from nba.com: {season} ===")
    sys.argv = ["update_daily", season]
    update_daily.main()

    print(f"\n=== positions and games started from bref: {end_year} ===")
    sys.argv = ["backfill_bref_stats", str(end_year)]
    backfill_bref_stats.main()

    print(f"\n=== advanced stats from nba.com: {season} ===")
    backfill_nba_advanced.run([season])

    print(f"\n=== advanced stats from bref: {end_year} ===")
    sys.argv = ["backfill_advanced", str(end_year)]
    backfill_advanced.main()

    print(f"\n=== team splits: {end_year} ===")
    sys.argv = ["backfill_team_splits", str(end_year)]
    backfill_team_splits.main()

    print(f"\n=== team ratings from nba.com: {season} ===")
    sys.argv = ["backfill_team_ratings", season]
    backfill_team_ratings.main()

    print(f"\n=== team records from nba.com: {season} ===")
    sys.argv = ["update_team_records", season]
    update_team_records.main()

    print(f"\n=== scoring splits from nba.com: {season} ===")
    sys.argv = ["backfill_scoring_splits", season]
    backfill_scoring_splits.main()

    print(f"\n=== tracking defense from nba.com: {season} ===")
    sys.argv = ["backfill_tracking_defense", season]
    backfill_tracking_defense.main()

    # After the ratings, splits and tracking it is built from, and before net
    # values, which price it.
    print(f"\n=== production: {to_season_label(season)} ===")
    sys.argv = ["compute_production", to_season_label(season)]
    compute_production.main()

    # After team records: which teams to request comes from team_seasons.
    print(f"\n=== on/off from nba.com: {season} ===")
    backfill_on_off.run([season])

    print(f"\n=== awards from bref: {end_year} ===")
    # bref only. The nba.com pass walks every ever-All-Star player one request
    # at a time, which is a backfill's job rather than a daily one; bref's own
    # all-star page covers everyone who played in this season's game, and the
    # handful it misses get picked up next time the full backfill runs.
    sys.argv = ["backfill_awards", str(end_year), "--skip-nba"]
    backfill_awards.main()

    print("\n=== future contracts from bref ===")
    backfill_future_salaries.main()

    # Before salaries, so a contract signed by someone who hasn't played yet
    # has a player to match to.
    print(f"\n=== rosters from nba.com: {season} ===")
    sys.argv = ["seed_rosters", season]
    seed_rosters.main()

    # Before salaries: a season's salaries count for nothing without its cap.
    print("\n=== salary caps from bref ===")
    conn = connect()
    with conn, conn.cursor() as cur:
        print(f"upserted {seed_seasons.seed_caps(cur)} league caps")
    conn.close()

    # Next season's league page doesn't exist until bref sets the season up,
    # around the draft; until then it 404s and is skipped.
    priced = [to_season_label(season)]
    for year in (end_year, end_year + 1):
        print(f"\n=== salaries from bref: {year} ===")
        sys.argv = ["backfill_salaries", str(year)]
        try:
            backfill_salaries.main()
        except FileNotFoundError:
            print(f"no bref season page for {year} yet")
            continue
        if year != end_year:
            priced.append(bref.season_label(year))

    for label in priced:
        print(f"\n=== net values: {label} ===")
        sys.argv = ["compute_net_values", label]
        compute_net_values.main()

    # update_daily revalidated back at the start; everything since needs it too.
    revalidate()


if __name__ == "__main__":
    main()
