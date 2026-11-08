"""Shared Postgres connection helper for the scraper scripts."""
import os
import re
import time
from typing import Optional


def load_env(name: str) -> Optional[str]:
    """A setting from the environment, falling back to the app's .env.local."""
    value = os.environ.get(name)
    if value:
        return value
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if not os.path.exists(env_path):
        return None
    with open(env_path) as f:
        for line in f:
            m = re.match(rf"^{re.escape(name)}=(.*)$", line.strip())
            if m:
                return m.group(1).strip().strip('"')
    return None


def load_database_url() -> str:
    url = load_env("DATABASE_URL")
    if url:
        return url
    raise RuntimeError("DATABASE_URL not found in environment or .env.local")


def connect():
    import psycopg2

    # Keepalives make a connection that dropped silently (common while a
    # script sits on it during minutes of scraping) fail within about a
    # minute with an OperationalError, instead of hanging forever.
    last_error = None
    for attempt in range(3):
        try:
            return psycopg2.connect(
                load_database_url(),
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=5,
                connect_timeout=20,
            )
        except psycopg2.OperationalError as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
    raise last_error


# 1996-97 through 2025-26
NBA_API_SEASONS = [f"{y}-{str(y + 1)[2:]}" for y in range(1996, 2026)]

# "1996-97" -> "1996-1997" (schema's season label format)
def to_season_label(nba_api_season: str) -> str:
    start = int(nba_api_season[:4])
    return f"{start}-{start + 1}"
