"""Refreshes the in-progress season's stats from nba.com.

This is the every-morning job. It re-pulls the current season's totals and
per-game rows from nba_api's leaguedashplayerstats (two requests) and upserts
them on (player_id, season), so running it repeatedly just overwrites the
season-to-date numbers with fresher ones. New players who debuted since the last
run get created along the way.

Salaries are NOT touched here. They come from basketball-reference, which is
crawl-delayed and barely changes in-season; run backfill_salaries.py for the
current bref end-year when you want to pick up trades and signings (weekly is
plenty, and it's cheap because pages are cached).

Usage:
  python update_daily.py             # the season now in progress
  python update_daily.py 2026-27     # a specific nba_api season string
"""
import sys

from backfill_stats import current_season, run


def main():
    season = sys.argv[1] if len(sys.argv) > 1 else current_season()
    print(f"updating stats for {season}")
    run([season])


if __name__ == "__main__":
    main()
