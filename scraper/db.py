"""Shared Postgres connection helper for the scraper scripts."""
import os
import re


def load_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    with open(env_path) as f:
        for line in f:
            m = re.match(r"^DATABASE_URL=(.*)$", line.strip())
            if m:
                return m.group(1).strip()
    raise RuntimeError("DATABASE_URL not found in environment or .env.local")


def connect():
    import psycopg2

    return psycopg2.connect(load_database_url())


# 1996-97 through 2025-26
NBA_API_SEASONS = [f"{y}-{str(y + 1)[2:]}" for y in range(1996, 2026)]

# "1996-97" -> "1996-1997" (schema's season label format)
def to_season_label(nba_api_season: str) -> str:
    start = int(nba_api_season[:4])
    return f"{start}-{start + 1}"
