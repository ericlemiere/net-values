"""
Phase 2 (salary load) + Phase 3 (salary matching), combined into one script
since a salary row can't be inserted without a resolved player_id.

Loads every season of salary data (Hoopshype "Home" tables, all years, plus
Spotrac cap-hit overlay 2011-12+) using the same Home-is-primary /
Spotrac-overlay merge the original migrate.ts used. For each row:
  1. Check player_aliases for a previously-confirmed match (permanent, from a
     prior run's confirmed fuzzy match or manual review).
  2. Exact match on normalized name + season + team (team resolved via
     team_aliases) against players who have a stat/advanced-stat row that
     season/team.
  3. Exact match on normalized name + season (team-agnostic fallback).
  4. Fuzzy match (rapidfuzz) against players active that season, threshold 90.
     A confirmed fuzzy match is recorded in player_aliases so it's permanent
     and instant on re-run.
  5. Anything left is written to unmatched_salaries.csv with top-3 candidate
     names/scores for manual review — never guessed into the table.

Idempotent: salaries upsert on (player_id, season, team); player_aliases
insert is ON CONFLICT DO NOTHING.
"""
import csv
import sqlite3
from pathlib import Path

from db import connect
from name_matching import normalize_name, best_fuzzy_match, top_candidates

MAIN_DB = Path(__file__).parent.parent / "OLD_PROJECT" / "Databases" / "Main.db"
UNMATCHED_CSV = Path(__file__).parent / "unmatched_salaries.csv"
FUZZY_THRESHOLD = 90.0


def list_tables(sconn, prefix):
    rows = sconn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?", (f"{prefix}_%",)
    ).fetchall()
    return sorted(r[0] for r in rows)


def to_label(suffix):
    parts = suffix.split("_")
    return f"{parts[0]}-{parts[1]}"


def load_team_resolver(cur):
    cur.execute("SELECT abbr FROM teams")
    canonical = {row[0] for row in cur.fetchall()}
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
        if raw_team in canonical:
            return raw_team
        return alias_to_abbr.get(raw_team, raw_team)

    return resolve


def build_salary_rows(sconn, resolve_team):
    home_tables = list_tables(sconn, "Home")
    spo_tables = set(list_tables(sconn, "SalariesCapHitsSPO"))

    all_rows = []
    for t in home_tables:
        suffix = t.replace("Home_", "")
        season = to_label(suffix)
        home_rows = sconn.execute(f'SELECT * FROM "{t}"').fetchall()

        season_rows = []
        for r in home_rows:
            name = r["Name"].strip()
            raw_salary = r["Salary"]
            season_rows.append({
                "name": name,
                "team": resolve_team(r["Team"]),
                "season": season,
                "salary": None if raw_salary == 0 else raw_salary,
                "team_payroll": r["TeamPayroll"],
                "league_cap": r["LeagueCap"],
                "pct_of_team_cap": r["PercOfTeamCap"],
                "pct_of_league_cap": r["PercOfLeagueCap"],
                "spotrac_base": None,
                "spotrac_cap_hit": None,
            })

        spo_table = f"SalariesCapHitsSPO_{suffix}"
        if spo_table in spo_tables:
            spo_rows = sconn.execute(f'SELECT * FROM "{spo_table}"').fetchall()
            exact_idx, name_idx = {}, {}
            for i, row in enumerate(season_rows):
                exact_idx[(row["name"], row["team"])] = i
                name_idx.setdefault(row["name"], i)

            for s in spo_rows:
                name = s["Name"].strip()
                team = resolve_team(s["Team"])
                idx = exact_idx.get((name, team))
                if idx is None:
                    idx = name_idx.get(name)
                if idx is not None:
                    season_rows[idx]["spotrac_base"] = s["Base"]
                    season_rows[idx]["spotrac_cap_hit"] = s["CapHit"]
                else:
                    season_rows.append({
                        "name": name,
                        "team": team,
                        "season": season,
                        "salary": None,
                        "team_payroll": None,
                        "league_cap": None,
                        "pct_of_team_cap": None,
                        "pct_of_league_cap": None,
                        "spotrac_base": s["Base"],
                        "spotrac_cap_hit": s["CapHit"],
                    })

        all_rows.extend(season_rows)

    return all_rows


class PlayerIndex:
    def __init__(self, cur):
        cur.execute("SELECT id, name FROM players")
        self.norm_by_id = {}
        self.global_by_norm = {}  # normalized name -> set(player_id), across ALL seasons
        for pid, name in cur.fetchall():
            norm = normalize_name(name)
            self.norm_by_id[pid] = norm
            self.global_by_norm.setdefault(norm, set()).add(pid)

        self.by_norm_season_team = {}
        self.season_norm_to_ids = {}
        for table in ("player_stats_totals", "player_stats_per_game", "advanced_stats"):
            cur.execute(f"SELECT player_id, season, team FROM {table}")
            for pid, season, team in cur.fetchall():
                norm = self.norm_by_id.get(pid)
                if norm is None:
                    continue
                self.by_norm_season_team.setdefault((norm, season, team), set()).add(pid)
                self.season_norm_to_ids.setdefault(season, {}).setdefault(norm, set()).add(pid)

        cur.execute("SELECT alias, player_id FROM player_aliases")
        self.alias_to_id = {row[0]: row[1] for row in cur.fetchall()}


def match_row(row, index):
    norm = normalize_name(row["name"])

    if norm in index.alias_to_id:
        return index.alias_to_id[norm], "alias", None

    key3 = (norm, row["season"], row["team"])
    cands = index.by_norm_season_team.get(key3)
    if cands and len(cands) == 1:
        return next(iter(cands)), "exact", None

    season_map = index.season_norm_to_ids.get(row["season"], {})
    cands2 = season_map.get(norm)
    if cands2 and len(cands2) == 1:
        return next(iter(cands2)), "exact_no_team", None

    # Exact name match, but the player has no stat row for this exact season
    # (e.g. injured/DNP all year while still on a roster and salaried). Safe
    # to use directly only if the name is globally unique — no homonym risk.
    cands3 = index.global_by_norm.get(norm)
    if cands3 and len(cands3) == 1:
        return next(iter(cands3)), "exact_global_no_season_stats", None

    # candidate pool for fuzzy matching, as {norm: set(ids)}
    if season_map:
        pool = season_map
    else:
        pool = {}
        for pid, n in index.norm_by_id.items():
            pool.setdefault(n, set()).add(pid)

    pid, score = best_fuzzy_match(norm, {k: list(v) for k, v in pool.items()}, FUZZY_THRESHOLD)
    if pid is not None:
        return pid, "fuzzy", score

    return None, "unmatched", score


SALARY_COLUMNS = [
    "team", "salary", "team_payroll", "league_cap", "pct_of_team_cap",
    "pct_of_league_cap", "spotrac_base", "spotrac_cap_hit", "source",
]


def upsert_salary(cur, player_id, season, values):
    cols = ["player_id", "season"] + SALARY_COLUMNS
    placeholders = ", ".join(["%s"] * len(cols))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in SALARY_COLUMNS)
    row = [player_id, season] + [values[c] for c in SALARY_COLUMNS]
    cur.execute(
        f"""
        INSERT INTO salaries ({", ".join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (player_id, season, team) DO UPDATE SET {updates}
        """,
        row,
    )


def main():
    conn = connect()
    cur = conn.cursor()
    resolve_team = load_team_resolver(cur)
    index = PlayerIndex(cur)

    sconn = sqlite3.connect(f"file:{MAIN_DB}?mode=ro", uri=True)
    sconn.row_factory = sqlite3.Row

    rows = build_salary_rows(sconn, resolve_team)
    sconn.close()

    stats = {
        "alias": 0, "exact": 0, "exact_no_team": 0,
        "exact_global_no_season_stats": 0, "fuzzy": 0, "unmatched": 0,
    }
    unmatched_out = []

    for row in rows:
        player_id, kind, score = match_row(row, index)
        stats[kind] += 1

        if player_id is None:
            norm = normalize_name(row["name"])
            candidates = top_candidates(norm, index.norm_by_id, n=3)
            unmatched_out.append({
                "name": row["name"],
                "season": row["season"],
                "team": row["team"],
                "salary": row["salary"],
                "candidate_1_id": candidates[0][0] if len(candidates) > 0 else "",
                "candidate_1_score": candidates[0][1] if len(candidates) > 0 else "",
                "candidate_2_id": candidates[1][0] if len(candidates) > 1 else "",
                "candidate_2_score": candidates[1][1] if len(candidates) > 1 else "",
                "candidate_3_id": candidates[2][0] if len(candidates) > 2 else "",
                "candidate_3_score": candidates[2][1] if len(candidates) > 2 else "",
            })
            continue

        values = {
            "team": row["team"],
            "salary": row["salary"],
            "team_payroll": row["team_payroll"],
            "league_cap": row["league_cap"],
            "pct_of_team_cap": row["pct_of_team_cap"],
            "pct_of_league_cap": row["pct_of_league_cap"],
            "spotrac_base": row["spotrac_base"],
            "spotrac_cap_hit": row["spotrac_cap_hit"],
            "source": "sqlite_migration",
        }
        upsert_salary(cur, player_id, row["season"], values)

        if kind == "fuzzy":
            norm = normalize_name(row["name"])
            cur.execute(
                """
                INSERT INTO player_aliases (player_id, alias, note)
                VALUES (%s, %s, %s)
                ON CONFLICT (alias) DO NOTHING
                """,
                (player_id, norm, f"fuzzy salary match, score={score:.1f}, season={row['season']}"),
            )

    conn.commit()
    cur.close()
    conn.close()

    with open(UNMATCHED_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "name", "season", "team", "salary",
            "candidate_1_id", "candidate_1_score",
            "candidate_2_id", "candidate_2_score",
            "candidate_3_id", "candidate_3_score",
        ])
        writer.writeheader()
        writer.writerows(unmatched_out)

    total = len(rows)
    matched = total - stats["unmatched"]
    print(f"Total salary rows: {total}")
    print(f"  Alias (previously confirmed): {stats['alias']}")
    print(f"  Exact (name+season+team):     {stats['exact']}")
    print(f"  Exact (name+season only):     {stats['exact_no_team']}")
    print(f"  Exact (unique name, no stat row that season): {stats['exact_global_no_season_stats']}")
    print(f"  Fuzzy (>= {FUZZY_THRESHOLD} confidence): {stats['fuzzy']}")
    print(f"  Unmatched (written to CSV):   {stats['unmatched']}")
    print(f"Matched total: {matched} ({100 * matched / total:.1f}%)")
    print(f"Unmatched rows written to {UNMATCHED_CSV}")


if __name__ == "__main__":
    main()
