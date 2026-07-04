"""
Phase 2: migrates from OLD_PROJECT/Databases/Main.db:
  - player_stats_per_game for 1989-90 through 1995-96 ONLY (nba.com has no
    data before 1996-97; totals aren't available pre-96 in this source, only
    per-game averages, so player_stats_totals stays empty for these seasons).
  - advanced_stats for EVERY season available (1989-90 through 2022-23) since
    PER/Win Shares/BPM/VORP are basketball-reference-only metrics nba_api
    cannot provide at any point.

Creates new player rows for names not already in the players table (matched
by normalized name — see name_matching.py), storing no bbref slug since the
source data has no such field. Idempotent via ON CONFLICT upserts.
"""
import sqlite3
from pathlib import Path

from db import connect
from name_matching import normalize_name, normalize_name_strict, best_fuzzy_match

FUZZY_THRESHOLD = 92.0
# Absolute cutoff for *accepting* an uncertain fuzzy match (different spelling
# entirely) — a real spelling variant of the same person is always active in
# roughly the same years. This is what stops e.g. bbref's 1980s-90s "Isiah
# Thomas" (Pistons) from fuzzy-matching onto the unrelated modern-era nba_api
# player "Isaiah Thomas" (Celtics), whose seasons are 20+ years apart.
FUZZY_SEASON_WINDOW = 6

MAIN_DB = Path(__file__).parent.parent / "OLD_PROJECT" / "Databases" / "Main.db"

PRE96_SEASONS = [
    "1989_1990", "1990_1991", "1991_1992", "1992_1993",
    "1993_1994", "1994_1995", "1995_1996",
]


def to_label(suffix: str) -> str:
    # "1989_1990" -> "1989-1990"
    parts = suffix.split("_")
    return f"{parts[0]}-{parts[1]}"


def list_tables(sconn, prefix):
    rows = sconn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?", (f"{prefix}_%",)
    ).fetchall()
    return sorted(r[0] for r in rows)


def collapse_to_one_row_per_player(rows):
    """bbref season tables have a TOT row (season totals) plus one row per
    team for traded players. Collapse to one row per player: prefer TOT,
    else the row with the most games played."""
    groups = {}
    for r in rows:
        name = r["Name"].strip()
        groups.setdefault(name, []).append(r)

    out = []
    for group in groups.values():
        if len(group) == 1:
            out.append(group[0])
        else:
            tot = next((r for r in group if r["Team"] == "TOT"), None)
            out.append(tot or max(group, key=lambda r: r["GP"] or 0))
    return out


class PlayerResolver:
    """Resolves a bbref name + season to a player id, creating new rows as
    needed. Two distinct normalizations are used deliberately:

      - strict (suffix-preserving): the primary exact-match key. Two real
        people can share a strict-normalized name (e.g. Tim Hardaway Sr./Jr.,
        Patrick Ewing Sr./Jr. — nba_api doesn't always store the "Jr." at
        all), so multi-candidate strict matches are disambiguated by which
        candidate's already-known active seasons are closest to this row's
        season, not by suffix.
      - loose (suffix-stripped): only used as the candidate pool for fuzzy
        matching spelling variants (e.g. "Steve"/"Steven" Smith). A fuzzy
        match is only accepted if it's season-plausible — otherwise two
        different real people with similar names (Isiah Thomas, 1980s-90s
        Pistons, vs. Isaiah Thomas, 2010s Celtics) would get merged.
    """

    def __init__(self, cur):
        self.cur = cur
        self.strict_by_norm = {}
        self.loose_by_norm = {}
        cur.execute("SELECT id, name FROM players")
        for pid, name in cur.fetchall():
            self.strict_by_norm.setdefault(normalize_name_strict(name), []).append(pid)
            self.loose_by_norm.setdefault(normalize_name(name), []).append(pid)

        self.season_years = {}  # player_id -> set of season-start years already on file
        for table in ("player_stats_totals", "player_stats_per_game", "advanced_stats"):
            cur.execute(f"SELECT player_id, season FROM {table}")
            for pid, season in cur.fetchall():
                self.season_years.setdefault(pid, set()).add(int(season.split("-")[0]))

        self.collisions = []
        self.season_disambiguated = []
        self.fuzzy_matched = []
        self.fuzzy_rejected = []
        self.created = 0

    def _note_season(self, pid: int, year: int):
        self.season_years.setdefault(pid, set()).add(year)

    def _closest_candidate(self, candidates, target_year):
        """Picks the candidate whose closest known season is nearest
        target_year. Returns None if no candidate has season data yet, or if
        two candidates are tied (still genuinely ambiguous)."""
        scored = []
        for pid in candidates:
            years = self.season_years.get(pid)
            if years:
                scored.append((min(abs(target_year - y) for y in years), pid))
        if not scored:
            return None
        scored.sort(key=lambda x: x[0])
        if len(scored) > 1 and scored[0][0] == scored[1][0]:
            return None
        return scored[0][1]

    def resolve(self, raw_name: str, target_season: str) -> int:
        target_year = int(target_season.split("-")[0])
        strict_norm = normalize_name_strict(raw_name)
        candidates = self.strict_by_norm.get(strict_norm, [])

        if len(candidates) == 1:
            pid = candidates[0]
            self._note_season(pid, target_year)
            return pid

        if len(candidates) > 1:
            best = self._closest_candidate(candidates, target_year)
            if best is not None:
                self.season_disambiguated.append((raw_name, target_season, best, candidates))
                self._note_season(best, target_year)
                return best
            self.collisions.append((raw_name, target_season, candidates))
            pid = candidates[0]
            self._note_season(pid, target_year)
            return pid

        # No strict match — try a fuzzy match against suffix-stripped names
        # (spelling variants), but only accept it if season-plausible.
        loose_norm = normalize_name(raw_name)
        fuzzy_id, score = best_fuzzy_match(loose_norm, self.loose_by_norm, FUZZY_THRESHOLD)
        if fuzzy_id is not None:
            years = self.season_years.get(fuzzy_id)
            if not years or min(abs(target_year - y) for y in years) <= FUZZY_SEASON_WINDOW:
                self.fuzzy_matched.append((raw_name, target_season, fuzzy_id, score))
                self.strict_by_norm.setdefault(strict_norm, []).append(fuzzy_id)
                self._note_season(fuzzy_id, target_year)
                return fuzzy_id
            self.fuzzy_rejected.append((raw_name, target_season, fuzzy_id, score))

        self.cur.execute(
            "INSERT INTO players (name) VALUES (%s) RETURNING id", (raw_name,)
        )
        pid = self.cur.fetchone()[0]
        self.strict_by_norm.setdefault(strict_norm, []).append(pid)
        self.loose_by_norm.setdefault(loose_norm, []).append(pid)
        self._note_season(pid, target_year)
        self.created += 1
        return pid


def load_team_resolver(cur):
    cur.execute("SELECT abbr, id FROM teams")
    abbr_to_id = {row[0]: row[0] for row in cur.fetchall()}  # abbr is canonical already
    cur.execute(
        """
        SELECT team_aliases.alias, teams.abbr FROM team_aliases
        JOIN teams ON teams.id = team_aliases.team_id
        """
    )
    alias_to_abbr = {row[0]: row[1] for row in cur.fetchall()}

    def resolve(raw_team):
        if raw_team is None or raw_team == "TOT":
            return None
        if raw_team in abbr_to_id:
            return raw_team
        return alias_to_abbr.get(raw_team, raw_team)  # fall back to raw if unknown

    return resolve


PER_GAME_COLUMNS = [
    "team", "pos", "age", "gp", "gs", "mp", "fgm", "fga", "fg_pct", "fg3m", "fg3a",
    "fg3_pct", "fg2m", "fg2a", "fg2_pct", "efg_pct", "ftm", "fta", "ft_pct", "orb",
    "drb", "reb", "ast", "stl", "blk", "tov", "pf", "pts", "source",
]

ADV_COLUMNS = [
    "team", "pos", "age", "gp", "mp", "per", "ts_pct", "usg_pct", "ows", "dws",
    "ws", "obpm", "dbpm", "bpm", "vorp", "source",
]


def upsert(cur, table, columns, player_id, season, values):
    cols = ["player_id", "season"] + columns
    placeholders = ", ".join(["%s"] * len(cols))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in columns)
    row = [player_id, season] + [values[c] for c in columns]
    cur.execute(
        f"""
        INSERT INTO {table} ({", ".join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (player_id, season) DO UPDATE SET {updates}
        """,
        row,
    )


def main():
    conn = connect()
    cur = conn.cursor()
    resolver = PlayerResolver(cur)
    resolve_team = load_team_resolver(cur)

    sconn = sqlite3.connect(f"file:{MAIN_DB}?mode=ro", uri=True)
    sconn.row_factory = sqlite3.Row

    # ---- player_stats_per_game: pre-96 only ----
    pg_total = 0
    for suffix in PRE96_SEASONS:
        table = f"PlayerStats_{suffix}"
        label = to_label(suffix)
        raw = sconn.execute(f'SELECT * FROM "{table}"').fetchall()
        rows = collapse_to_one_row_per_player(raw)
        for r in rows:
            pid = resolver.resolve(r["Name"].strip(), label)
            values = {
                "team": resolve_team(r["Team"]),
                "pos": r["Pos"],
                "age": r["Age"],
                "gp": r["GP"],
                "gs": r["GS"],
                "mp": r["MP"],
                "fgm": r["FGM"],
                "fga": r["FGA"],
                "fg_pct": r["FGP"],
                "fg3m": r["3PM"],
                "fg3a": r["3PA"],
                "fg3_pct": r["3PP"],
                "fg2m": r["2PM"],
                "fg2a": r["2PA"],
                "fg2_pct": r["2PP"],
                "efg_pct": r["eFG"],
                "ftm": r["FTM"],
                "fta": r["FTA"],
                "ft_pct": r["FTP"],
                "orb": r["ORB"],
                "drb": r["DRB"],
                "reb": r["REB"],
                "ast": r["AST"],
                "stl": r["STL"],
                "blk": r["BLK"],
                "tov": r["TOV"],
                "pf": r["PF"],
                "pts": r["PTS"],
                "source": "sqlite",
            }
            upsert(cur, "player_stats_per_game", PER_GAME_COLUMNS, pid, label, values)
        conn.commit()
        pg_total += len(rows)
        print(f"player_stats_per_game {label}: {len(rows)} rows")

    # ---- advanced_stats: all available seasons ----
    adv_total = 0
    adv_tables = list_tables(sconn, "AdvancedStats")
    for table in adv_tables:
        suffix = table.replace("AdvancedStats_", "")
        label = to_label(suffix)
        raw = sconn.execute(f'SELECT * FROM "{table}"').fetchall()
        rows = collapse_to_one_row_per_player(raw)
        for r in rows:
            pid = resolver.resolve(r["Name"].strip(), label)
            values = {
                "team": resolve_team(r["Team"]),
                "pos": r["Pos"],
                "age": r["Age"],
                "gp": r["GP"],
                "mp": r["MP"],
                "per": r["PER"],
                "ts_pct": r["TS"],
                "usg_pct": r["USG"],
                "ows": r["OWS"],
                "dws": r["DWS"],
                "ws": r["WS"],
                "obpm": r["OBPM"],
                "dbpm": r["DBPM"],
                "bpm": r["BPM"],
                "vorp": r["VORP"],
                "source": "sqlite",
            }
            upsert(cur, "advanced_stats", ADV_COLUMNS, pid, label, values)
        conn.commit()
        adv_total += len(rows)
        print(f"advanced_stats {label}: {len(rows)} rows")

    sconn.close()
    cur.close()
    conn.close()

    print(f"\nTotal player_stats_per_game rows (pre-96): {pg_total}")
    print(f"Total advanced_stats rows (all years): {adv_total}")
    print(f"New players created: {resolver.created}")
    print(f"Fuzzy-matched to an existing player (spelling mismatch, season-plausible): {len(resolver.fuzzy_matched)}")
    for name, season, pid, score in resolver.fuzzy_matched[:50]:
        print(f"  '{name}' ({season}) -> existing player id {pid} (score={score:.1f})")
    print(f"Fuzzy match rejected as season-implausible (created new player instead): {len(resolver.fuzzy_rejected)}")
    for name, season, pid, score in resolver.fuzzy_rejected[:50]:
        print(f"  '{name}' ({season}) NOT matched to player id {pid} (score={score:.1f}, seasons too far apart)")
    print(f"Same-name collisions disambiguated by season proximity: {len(resolver.season_disambiguated)}")
    for name, season, best, candidates in resolver.season_disambiguated[:50]:
        print(f"  '{name}' ({season}) -> player id {best} (candidates were {candidates})")
    print(f"Still-ambiguous collisions (used first match, needs manual review): {len(resolver.collisions)}")
    for name, season, ids in resolver.collisions[:50]:
        print(f"  '{name}' ({season}) matched multiple existing player ids with no season data: {ids}")


if __name__ == "__main__":
    main()
