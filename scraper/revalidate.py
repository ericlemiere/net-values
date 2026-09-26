"""Tells the live site its cached data is stale.

The site keeps every query's result for up to a day (lib/db/cached.ts), so
without this a run's new numbers wouldn't show until that ran out. Posts to
the app's /api/revalidate, which marks the whole data cache stale; each page
re-queries Neon the next time someone opens it.

Needs two settings, from the environment or .env.local:
  NEXT_PUBLIC_SITE_URL   the deployed site, e.g. https://example.com
  REVALIDATE_SECRET      the same value set on the deployment

update_daily.py calls this at the end. Run it by hand after a backfill:
  python revalidate.py
"""
import requests

from db import load_env


def revalidate() -> None:
    site = load_env("NEXT_PUBLIC_SITE_URL")
    secret = load_env("REVALIDATE_SECRET")
    if not site or not secret:
        # Not an error: the day-long cache expiry still picks the data up.
        print("revalidate skipped: NEXT_PUBLIC_SITE_URL or REVALIDATE_SECRET not set")
        return
    res = requests.post(
        f"{site.rstrip('/')}/api/revalidate",
        headers={"Authorization": f"Bearer {secret}"},
        timeout=30,
    )
    res.raise_for_status()
    print(f"revalidated {site}")


if __name__ == "__main__":
    revalidate()
