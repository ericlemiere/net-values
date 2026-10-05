"""Tells the live site its cached data is stale.

The site keeps every query's result for up to a day (lib/db/cached.ts), so
without this a run's new numbers wouldn't show until that ran out. Posts to
the app's /api/revalidate, which marks the whole data cache stale; each page
re-queries Neon the next time someone opens it.

Needs two settings, from the environment or .env.local:
  NEXT_PUBLIC_SITE_URL   the deployed site, e.g. https://example.com
  REVALIDATE_SECRET      the same value set on the deployment

Before posting, it stamps site_meta's 'data' row with the current time: this
is called whenever the data changes, so that row is when it last did, and the
site footer shows it as the "Updated" date.

update_daily.py and update_season.py call this at the end. Run it by hand after
a backfill:
  python revalidate.py
"""
import requests

from db import connect, load_env


def stamp_updated() -> None:
    """Records now as when the data last changed."""
    conn = connect()
    with conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO site_meta (key, updated_at) VALUES ('data', now())
            ON CONFLICT (key) DO UPDATE SET updated_at = excluded.updated_at
            """
        )
    conn.close()


def revalidate() -> None:
    stamp_updated()
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
