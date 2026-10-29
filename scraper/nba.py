"""Shared nba.com fetching: one throttle and one failure policy for every
nba_api request.

nba_api is a client for nba.com's own stats endpoints, and nba.com sits behind
Akamai's bot protection. Once an address's traffic looks automated, Akamai
blocks it outright for hours to a day: requests hang until they time out, or
come back 403, and the block takes www.nba.com and the CDN with it. So:

  - every request waits at least REQUEST_DELAY since the last one, plus a
    random extra, so the job never fires a tight, regular burst;
  - a refusal (403/429, a timeout, a dropped connection) stops the run at
    once. Retrying a block only extends it. The healthcheck reports the
    failure and tomorrow's run tries again;
  - anything else (a 5xx, a response that isn't JSON) is the server having a
    bad moment, and gets a couple of retries.
"""
import random
import sys
import time

import requests

REQUEST_DELAY = 3.0
JITTER = 2.0
ATTEMPTS = 3

_last_request = 0.0


class Refused(RuntimeError):
    """nba.com refused or ignored a request: almost certainly a block."""


def frames(endpoint, what, timeout=60, **params):
    """Every data frame `endpoint(**params)` returns, fetched politely.

    `what` names the request in log lines and errors.
    """
    global _last_request

    for attempt in range(1, ATTEMPTS + 1):
        wait = REQUEST_DELAY + random.uniform(0, JITTER) - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)

        try:
            r = endpoint(**params, timeout=timeout)
        except (requests.Timeout, requests.ConnectionError) as e:
            raise Refused(f"nba.com didn't answer {what} ({e}); likely blocked, stopping") from e
        finally:
            _last_request = time.monotonic()

        status = r.nba_response._status_code
        if status in (403, 429):
            raise Refused(f"nba.com refused {what} (HTTP {status}); likely blocked, stopping")
        try:
            if status != 200:
                raise RuntimeError(f"HTTP {status}")
            return r.get_data_frames()
        except Exception as e:
            if attempt == ATTEMPTS:
                raise RuntimeError(f"Failed to fetch {what} after {ATTEMPTS} attempts ({e})") from e
            print(f"  {what} failed ({e}), retrying...", file=sys.stderr)
            time.sleep(10 * attempt)
