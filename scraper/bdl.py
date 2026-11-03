"""Shared BALLDONTLIE fetching: the paid API the season's stats come from.

The key is BALLDONTLIE_API_KEY, from the environment or .env.local. The GOAT
plan allows 600 requests a minute; REQUEST_DELAY keeps well under that, and a
429 waits out the Retry-After the server sends rather than guessing.

Seasons are named by their start year here (2025 is 2025-26), and the
percentages arrive as 0-1 fractions; callers convert to the schema's
"2025-2026" labels and 0-100 values.

Usage from a script:
  import bdl
  for row in bdl.paged("/v1/stats", **{"seasons[]": 2025, "per_page": 100}):
      ...
"""
import json
import sys
import time
from pathlib import Path

import requests

from db import load_env

BASE_URL = "https://api.balldontlie.io"
CACHE_DIR = Path(__file__).parent / ".cache"
REQUEST_DELAY = 0.2
ATTEMPTS = 5

_session = None
_last_request = 0.0


def _client():
    global _session
    if _session is None:
        key = load_env("BALLDONTLIE_API_KEY")
        if not key:
            raise RuntimeError("BALLDONTLIE_API_KEY not found in environment or .env.local")
        _session = requests.Session()
        _session.headers["Authorization"] = key
    return _session


def get(path, **params):
    """One GET against the API, as parsed JSON."""
    global _last_request

    for attempt in range(1, ATTEMPTS + 1):
        wait = REQUEST_DELAY - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        try:
            r = _client().get(BASE_URL + path, params=params, timeout=60)
        except (requests.Timeout, requests.ConnectionError) as e:
            error = str(e)
            pause = 10 * attempt
        else:
            if r.status_code == 200:
                _last_request = time.monotonic()
                return r.json()
            if r.status_code == 429:
                pause = int(r.headers.get("retry-after") or 30) + 1
            elif r.status_code >= 500:
                pause = 10 * attempt
            else:
                # 401 (bad key), 400 (bad parameters), 404: retrying won't help.
                raise RuntimeError(f"BALLDONTLIE {path}: HTTP {r.status_code} {r.text[:200]}")
            error = f"HTTP {r.status_code}"
        finally:
            _last_request = time.monotonic()
        if attempt == ATTEMPTS:
            raise RuntimeError(f"BALLDONTLIE {path} failed after {ATTEMPTS} attempts ({error})")
        print(f"  {path} {error}, retrying in {pause}s...", file=sys.stderr)
        time.sleep(pause)


def paged(path, **params):
    """Every row of a cursor-paginated endpoint, following next_cursor."""
    params.setdefault("per_page", 100)
    while True:
        j = get(path, **params)
        yield from j["data"]
        cursor = (j.get("meta") or {}).get("next_cursor")
        if not cursor:
            return
        params["cursor"] = cursor


def season_lines(start_year, max_age=None):
    """Every game line of a season, regular season and playoffs, cached on disk.

    A full season is ~46,000 lines, ~460 requests. `max_age` is in seconds:
    None reuses any cached copy, 0 always refetches.
    """
    CACHE_DIR.mkdir(exist_ok=True)
    cached = CACHE_DIR / f"bdl_stats_{start_year}.json"
    if cached.exists() and (max_age is None or time.time() - cached.stat().st_mtime < max_age):
        return json.loads(cached.read_text())
    rows = list(paged("/v1/stats", **{"seasons[]": start_year}))
    cached.write_text(json.dumps(rows))
    return rows


def minutes(value):
    """The `min` string on a game line ("34", "34:12", "00", "") as a float."""
    if not value:
        return 0.0
    if ":" in value:
        m, s = value.split(":", 1)
        return int(m) + int(s) / 60
    return float(value)
