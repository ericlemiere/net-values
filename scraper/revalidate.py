"""Tells the live site its cached data is stale.

The site keeps every query's result for up to a day (lib/db/cached.ts), so
without this a run's new numbers wouldn't show until that ran out. Posts to
the app's /api/revalidate, which expires the whole data cache; each page
re-queries Neon the next time someone opens it. Then it opens the home page
itself, so that first, slower render is this script's rather than a visitor's.

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
import time
from urllib.parse import urlparse

import requests

from db import connect, load_env


def stamp_updated() -> str:
    """Records now as when the data last changed, and returns it as Postgres
    prints it, the same text the site embeds in its pages."""
    conn = connect()
    with conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO site_meta (key, updated_at) VALUES ('data', now())
            ON CONFLICT (key) DO UPDATE SET updated_at = excluded.updated_at
            RETURNING updated_at::text
            """
        )
        stamp = cur.fetchone()[0]
    conn.close()
    return stamp


def revalidate() -> None:
    stamp = stamp_updated()
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
    # The host alone, so it shows in GitHub's log, which masks the whole URL.
    print(f"revalidated {urlparse(site).hostname}")
    warm(site, stamp)


def warm(site: str, stamp: str) -> None:
    """Requests the home page so its fresh render is built before anyone visits,
    then checks that render carries the stamp just written. A page still showing
    the old stamp means the revalidate reached something other than the live
    site (a deployment URL, say), and the run fails so someone hears about it."""
    # Postgres's text to the second; the fraction's trailing zeros can differ.
    want = stamp[:19]
    for attempt in range(3):
        try:
            res = requests.get(site.rstrip("/") + "/", timeout=60)
        except requests.RequestException as e:
            print(f"warming the home page failed: {e}")
            continue
        print(f"warmed home page: {res.status_code}, cache {res.headers.get('x-vercel-cache')}")
        if want in res.text:
            print(f"home page shows the new stamp ({want})")
            return
        time.sleep(10)
    raise RuntimeError(f"home page at {urlparse(site).hostname} still doesn't show "
                       f"the stamp {want}: the revalidate didn't reach the live site")


if __name__ == "__main__":
    revalidate()
