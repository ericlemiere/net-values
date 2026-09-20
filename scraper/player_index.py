"""Shared player-identity resolution, used by the legacy Hoopshype salary
migration and the basketball-reference backfill.

The cascade, cheapest and most certain first:
  0. bbref_slug  — exact, permanent. Populated by a previous run of the bref
     backfill, which records the slug on whatever player it resolved a name to.
     Once set, that player never needs matching again.
  1. player_aliases — a previously confirmed name variant.
  2. normalized name + season + team.
  3. normalized name + season (team-agnostic).
  4. normalized name, globally unique (covers a salaried player with no stat
     row that season, e.g. injured all year).
  5. fuzzy match against players on that exact team that season, threshold 80.
     The pool is ~20 players, so a looser threshold is still safe here and
     catches name variants ("Ron Holland" / "Ronald Holland II").
  6. fuzzy match against players active anywhere that season, threshold 90.
Anything left is reported unmatched and never guessed into the table.
"""
from name_matching import normalize_name, best_fuzzy_match

FUZZY_THRESHOLD = 90.0
# Looser, because the candidate pool is one team-season roster, not the league.
TEAM_FUZZY_THRESHOLD = 80.0


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
        self.team_season_norm_to_ids = {}
        for table in ("player_stats_totals", "player_stats_per_game", "advanced_stats"):
            cur.execute(f"SELECT player_id, season, team FROM {table}")
            for pid, season, team in cur.fetchall():
                norm = self.norm_by_id.get(pid)
                if norm is None:
                    continue
                self.by_norm_season_team.setdefault((norm, season, team), set()).add(pid)
                self.season_norm_to_ids.setdefault(season, {}).setdefault(norm, set()).add(pid)
                if team:
                    self.team_season_norm_to_ids.setdefault((season, team), {}).setdefault(
                        norm, set()
                    ).add(pid)

        cur.execute("SELECT alias, player_id FROM player_aliases")
        self.alias_to_id = {row[0]: row[1] for row in cur.fetchall()}

        cur.execute("SELECT bbref_slug, id FROM players WHERE bbref_slug IS NOT NULL")
        self.slug_to_id = {row[0]: row[1] for row in cur.fetchall()}

    def record_slug(self, cur, player_id, slug):
        """Pin a bref slug to a player so later runs skip name matching.

        bbref_slug is UNIQUE, so if the slug is already claimed by a different
        player this is a no-op rather than an error — a collision means one of
        the two matches is wrong, and silently repointing it would hide that.
        """
        if not slug or slug in self.slug_to_id:
            return False
        cur.execute(
            "UPDATE players SET bbref_slug = %s WHERE id = %s AND bbref_slug IS NULL",
            (slug, player_id),
        )
        if cur.rowcount:
            self.slug_to_id[slug] = player_id
            return True
        return False


def match_row(row, index):
    """row: {name, season, team, slug?}. Returns (player_id, method, score)."""
    slug = row.get("slug")
    if slug and slug in index.slug_to_id:
        return index.slug_to_id[slug], "slug", None

    norm = normalize_name(row["name"])

    if norm in index.alias_to_id:
        return index.alias_to_id[norm], "alias", None

    cands = index.by_norm_season_team.get((norm, row["season"], row["team"]))
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

    # Fuzzy within the one team's roster that season first — a ~20-name pool
    # makes a lower threshold safe, and most misses are variants of a name
    # already on the roster.
    team_pool = index.team_season_norm_to_ids.get((row["season"], row["team"]), {})
    if team_pool:
        pid, score = best_fuzzy_match(
            norm, {k: list(v) for k, v in team_pool.items()}, TEAM_FUZZY_THRESHOLD
        )
        if pid is not None:
            return pid, "fuzzy_team", score

    # Fuzzy against that season's players; fall back to all players only when
    # the season has no stat rows at all (e.g. a season not yet backfilled).
    pool = season_map
    if not pool:
        pool = {}
        for pid, n in index.norm_by_id.items():
            pool.setdefault(n, set()).add(pid)

    pid, score = best_fuzzy_match(norm, {k: list(v) for k, v in pool.items()}, FUZZY_THRESHOLD)
    if pid is not None:
        return pid, "fuzzy", score

    return None, "unmatched", score
