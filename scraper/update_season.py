"""The daily in-season job: refresh today's games, then recompute Net Value.

Net Value is a function of things that all move during a season, so each one
has to be refreshed before the numbers mean anything:

  box score stats   nba_api, via update_daily
  VORP              basketball-reference's advanced page, which is where
                    production comes from
  team records      basketball-reference standings — not just for the /teams
                    page, but because GAMES PLAYED SO FAR sets the availability
                    denominator. Without it, a player who has started every game
                    of a 20-game-old season looks 25% available against a full
                    82-game workload.
  net values        recomputed from scratch, which takes a few seconds

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

# Long enough to avoid re-fetching on repeated runs, short enough that a job run
# once a day always sees yesterday's games.
CACHE_HOURS = 6


def main():
    season = sys.argv[1] if len(sys.argv) > 1 else current_season()
    # "2026-27" -> 2027, the end year bref names its pages by.
    end_year = int(season[:4]) + 1

    bref.MAX_CACHE_AGE = CACHE_HOURS * 3600

    import update_daily
    import backfill_advanced
    import backfill_teams
    import compute_net_values

    print(f"=== stats from nba.com: {season} ===")
    sys.argv = ["update_daily", season]
    update_daily.main()

    print(f"\n=== advanced stats from bref: {end_year} ===")
    sys.argv = ["backfill_advanced", str(end_year)]
    backfill_advanced.main()

    print(f"\n=== team records from bref: {end_year} ===")
    sys.argv = ["backfill_teams", str(end_year)]
    backfill_teams.main()

    print("\n=== net values ===")
    sys.argv = ["compute_net_values"]
    compute_net_values.main()


if __name__ == "__main__":
    main()
