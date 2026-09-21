"""Shared basketball-reference fetching + table parsing.

BR's robots.txt allows /teams/ and /leagues/ for a generic user-agent but sets
"Crawl-delay: 3", so every fetch here goes through a module-level throttle.
Responses are cached on disk (scraper/.cache/) so re-running a backfill after a
parsing fix costs nothing and doesn't re-hit their servers.

BR also wraps most secondary tables (including the per-season team salary table
and every stat table on a league page) in HTML comments to defer rendering, so
parse_table() strips comment markers before looking for the table.
"""
import hashlib
import re
import time
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

CACHE_DIR = Path(__file__).parent / ".cache"
CRAWL_DELAY = 3.0
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
)

_last_fetch = 0.0

# How long a cached page stays good, in seconds. None means forever, which is
# right for finished seasons: their pages never change, and a backfill re-run
# after a parsing fix should cost nothing. A job refreshing the season now in
# progress sets this to a few hours so today's games actually arrive.
MAX_CACHE_AGE = None


def fetch(url: str, use_cache: bool = True) -> str:
    """GET `url`, honoring the crawl delay. Returns HTML, cached on disk."""
    global _last_fetch

    CACHE_DIR.mkdir(exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    cached = CACHE_DIR / f"{key}.html"
    if use_cache and cached.exists():
        fresh = MAX_CACHE_AGE is None or (time.time() - cached.stat().st_mtime) < MAX_CACHE_AGE
        if fresh:
            return cached.read_text(encoding="utf-8")

    elapsed = time.monotonic() - _last_fetch
    if elapsed < CRAWL_DELAY:
        time.sleep(CRAWL_DELAY - elapsed)

    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
    _last_fetch = time.monotonic()

    # BR serves UTF-8 but sends no charset in Content-Type, so requests would
    # fall back to latin-1 and mangle accented names (Doncic, Jokic, ...).
    resp.encoding = "utf-8"

    if resp.status_code == 404:
        raise FileNotFoundError(url)
    resp.raise_for_status()

    cached.write_text(resp.text, encoding="utf-8")
    return resp.text


def parse_table(html: str, table_id: str) -> List[Dict[str, str]]:
    """Return the rows of table `table_id` as {data-stat: text} dicts.

    Repeated header rows inside the body are dropped. Where bref tags a cell
    with `data-append-csv` (its player slug), that lands in the row under the
    key "slug" — a far more reliable identity than the displayed name.
    """
    # Un-hide tables BR defers inside HTML comments.
    uncommented = html.replace("<!--", "").replace("-->", "")
    soup = BeautifulSoup(uncommented, "lxml")
    table = soup.find("table", id=table_id)
    if table is None:
        return []

    body = table.find("tbody") or table
    rows = []
    for tr in body.find_all("tr"):
        if "thead" in (tr.get("class") or []):
            continue
        cells = tr.find_all(["th", "td"])
        row = {
            c.get("data-stat"): c.get_text(strip=True)
            for c in cells
            if c.get("data-stat")
        }
        for c in cells:
            if c.get("data-append-csv"):
                row["slug"] = c["data-append-csv"]
                break
        # A real data row always carries an identity cell; which one depends on
        # the table (salaries use "player", stat tables "name_display").
        if row and any(
            row.get(k) for k in ("player", "name_display", "team_id", "year_id")
        ):
            rows.append(row)
    return rows


def parse_money(text: str) -> Optional[int]:
    """'$48,728,845' -> 48728845. Empty/placeholder cells -> None."""
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def season_label(end_year: int) -> str:
    """BR uses the season's END year in URLs (2025 = the 2024-25 season).
    Returns this schema's label format, e.g. 2025 -> '2024-2025'."""
    return f"{end_year - 1}-{end_year}"
