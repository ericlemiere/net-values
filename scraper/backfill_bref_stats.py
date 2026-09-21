"""Closes the two stat gaps created by the 1996-97 source seam.

The stats tables are stitched from two importers that each lack something the
other has:

  1989-90..1995-96  migrate_legacy.py, from OLD_PROJECT/Databases/Main.db.
                    That SQLite holds per-game averages ONLY, so
                    player_stats_totals is empty for these seasons.
  1996-97..now      backfill_stats.py, from nba_api leaguedashplayerstats.
                    That endpoint returns neither position nor games started
                    (verified: 38 non-rank columns, no GS/POS; and
                    leaguedashplayerbiostats has no position either), so
                    pos and gs are NULL on every row it wrote.

bref's season totals page carries all three — pos, games_started and real
totals — for every season involved, so one pass over it fixes both. This
script therefore runs in two modes, chosen per season:

  end year <  1997   INSERT the full totals row (the missing table).
  end year >= 1997   UPDATE pos/gs only, on BOTH stat tables, leaving every
                     nba_api-sourced number untouched.

Mode B deliberately leaves `source` as 'nba_api': the stats in those rows are
still nba_api's, only the two columns it could not supply come from bref.

Totals are NOT derived from per-game x GP anywhere. Per-game is stored to one
decimal, so PTS 17.7 x 82 carries up to ~4 points of error while looking
authoritative.

A traded player appears on bref as a "2TM"/"3TM" summary row plus one row per
team. Both stat tables are unique on (player_id, season), so only the summary
row is kept, with team NULL — the same convention the legacy migration used
for "TOT" and backfill_advanced.py uses today.

Players that cannot be resolved are written to unmatched_bref_stats.csv and
never guessed into the table.

Two different bref players can resolve to the SAME row of ours — either because
they genuinely share a name (there were two Charles Smiths in 1989-90) or
because a stale players.bbref_slug points at the wrong person. Both tables are
unique on (player_id, season), so without a guard the last row processed just
overwrites the first and the loser's season silently becomes the winner's.
resolve_collisions() breaks the tie against what we already hold for that
season — the team and games played on the existing stat row, which came from a
different source — and writes nothing for a player it cannot settle.

Idempotent: mode A upserts on (player_id, season), mode B sets the same two
columns to the same values.

Usage:
  python backfill_bref_stats.py                 # 1990..2026 (everything)
  python backfill_bref_stats.py 1996            # one bref end-year
  python backfill_bref_stats.py 1990 1996       # a range
  python backfill_bref_stats.py --dry-run 1996  # report, write nothing
"""
import csv
import sys
from pathlib import Path

import bref
from db import connect
from player_index import PlayerIndex, match_row

# Our earliest stats season is 1989-90; nba_api takes over at 1996-97.
DEFAULT_START, DEFAULT_END = 1990, 2026
NBA_API_FIRST_END_YEAR = 1997

UNMATCHED_CSV = Path(__file__).parent / "unmatched_bref_stats.csv"
COLLISION_CSV = Path(__file__).parent / "collisions_bref_stats.csv"

# bref data-stat -> stat table column, for the counting stats that map 1:1.
DIRECT = {
    "fg": "fgm", "fga": "fga", "fg3": "fg3m", "fg3a": "fg3a",
    "fg2": "fg2m", "fg2a": "fg2a", "ft": "ftm", "fta": "fta",
    "orb": "orb", "drb": "drb", "trb": "reb", "ast": "ast",
    "stl": "stl", "blk": "blk", "tov": "tov", "pf": "pf", "pts": "pts",
}
# bref writes rate stats as fractions (".526"); the schema stores 0-100.
PERCENTS = {
    "fg_pct": "fg_pct", "fg3_pct": "fg3_pct", "fg2_pct": "fg2_pct",
    "ft_pct": "ft_pct", "efg_pct": "efg_pct",
}
COLUMNS = [
    "team", "pos", "age", "gp", "gs", "mp", "fgm", "fga", "fg_pct", "fg3m", "fg3a",
    "fg3_pct", "fg2m", "fg2a", "fg2_pct", "efg_pct", "ftm", "fta", "ft_pct", "orb",
    "drb", "reb", "ast", "stl", "blk", "tov", "pf", "pts", "source",
]


def num(text):
    if text in (None, "", "-"):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def intnum(text):
    v = num(text)
    return int(v) if v is not None else None


def build_totals(r, team):
    values = {
        "team": team,
        "pos": (r.get("pos") or None),
        "age": intnum(r.get("age")),
        "gp": intnum(r.get("games")),
        "gs": intnum(r.get("games_started")),
        "mp": num(r.get("mp")),
        "source": "bref",
    }
    for src, col in DIRECT.items():
        values[col] = num(r.get(src))
    for src, col in PERCENTS.items():
        v = num(r.get(src))
        values[col] = v * 100 if v is not None else None
    return values


def pick_rows(rows):
    """One row per player: the multi-team summary when there is one."""
    best = {}
    for r in rows:
        slug = r.get("slug")
        if not slug:
            continue
        team = (r.get("team_name_abbr") or "").strip()
        if slug not in best or team.endswith("TM"):
            best[slug] = r
    return best


def load_existing(cur, season):
    """(team, gp) already on file for each player that season, for tie-breaking.

    Read from per-game rather than totals: for the pre-96 seasons it comes from
    the legacy SQLite, i.e. a source independent of the bref rows being matched.
    """
    cur.execute(
        "SELECT player_id, team, gp FROM player_stats_per_game WHERE season = %s",
        (season,),
    )
    return {pid: (team, gp) for pid, team, gp in cur.fetchall()}


def resolve_collisions(claimed, existing):
    """claimed: {player_id: [(slug, row, team), ...]}. Returns (winners, dropped).

    A player claimed by one slug passes straight through. Where several claim
    the same player, the one whose team and games played match the row we
    already hold wins; anything still ambiguous is dropped rather than guessed.
    """
    winners, dropped = {}, []
    for pid, entries in claimed.items():
        if len(entries) == 1:
            winners[pid] = entries[0]
            continue
        team, gp = existing.get(pid, (None, None))
        exact = [
            e for e in entries
            if gp is not None and intnum(e[1].get("games")) == gp and e[2] == team
        ]
        if len(exact) != 1:
            # Fall back to games played alone — team is NULL on bref's
            # multi-team summary rows, which is exactly when it can't match.
            exact = [
                e for e in entries
                if gp is not None and intnum(e[1].get("games")) == gp
            ]
        if len(exact) == 1:
            winners[pid] = exact[0]
            dropped += [(e, "lost tie-break") for e in entries if e is not exact[0]]
        else:
            dropped += [(e, "ambiguous, nothing written") for e in entries]
    return winners, dropped


def load_team_resolver(cur):
    cur.execute("SELECT abbr FROM teams")
    canonical = {row[0] for row in cur.fetchall()}
    cur.execute("SELECT ta.alias, t.abbr FROM team_aliases ta JOIN teams t ON t.id = ta.team_id")
    aliases = dict(cur.fetchall())

    def resolve(raw):
        raw = (raw or "").strip()
        # "2TM"/"3TM" summary rows aren't a single team.
        if not raw or raw.endswith("TM") or raw == "TOT":
            return None
        if raw in canonical:
            return raw
        return aliases.get(raw, raw)

    return resolve


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry_run = "--dry-run" in sys.argv
    years = [int(a) for a in args]
    start, end = (DEFAULT_START, DEFAULT_END) if not years else (
        (years[0], years[0]) if len(years) == 1 else (years[0], years[1])
    )

    conn = connect()
    cur = conn.cursor()
    resolve_team = load_team_resolver(cur)
    index = PlayerIndex(cur)

    unmatched, collisions, methods = [], [], {}
    placeholders = ", ".join(["%s"] * (len(COLUMNS) + 2))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS)
    inserted = patched = missing_row = 0

    for end_year in range(start, end + 1):
        season = bref.season_label(end_year)
        mode = "totals" if end_year < NBA_API_FIRST_END_YEAR else "pos/gs"
        url = f"https://www.basketball-reference.com/leagues/NBA_{end_year}_totals.html"
        chosen = pick_rows(bref.parse_table(bref.fetch(url), "totals_stats"))
        print(f"=== {season} [{mode}] ({len(chosen)} players) ===")

        # Resolve every bref row first, so a player claimed twice can be settled
        # before anything is written.
        claimed = {}
        for slug, r in chosen.items():
            name = r.get("name_display", "").strip()
            team = resolve_team(r.get("team_name_abbr"))
            pid, method, score = match_row(
                {"name": name, "season": season, "team": team, "slug": slug}, index
            )
            methods[method] = methods.get(method, 0) + 1
            if pid is None:
                unmatched.append([season, team or "", name, slug, round(score or 0, 1)])
                continue
            claimed.setdefault(pid, []).append((slug, r, team))

        winners, dropped = resolve_collisions(claimed, load_existing(cur, season))
        for (slug, r, team), why in dropped:
            collisions.append(
                [season, team or "", r.get("name_display", "").strip(), slug,
                 r.get("games", ""), why]
            )

        n_ins = n_pat = n_miss = 0
        for pid, (slug, r, team) in winners.items():
            if dry_run:
                n_ins += 1
                continue

            index.record_slug(cur, pid, slug)

            if end_year < NBA_API_FIRST_END_YEAR:
                values = build_totals(r, team)
                cur.execute(
                    f"""
                    INSERT INTO player_stats_totals (player_id, season, {", ".join(COLUMNS)})
                    VALUES ({placeholders})
                    ON CONFLICT (player_id, season) DO UPDATE SET {updates}
                    """,
                    [pid, season] + [values[c] for c in COLUMNS],
                )
                n_ins += 1
            else:
                pos = r.get("pos") or None
                gs = intnum(r.get("games_started"))
                touched = 0
                for table in ("player_stats_totals", "player_stats_per_game"):
                    cur.execute(
                        f"UPDATE {table} SET pos = %s, gs = %s WHERE player_id = %s AND season = %s",
                        (pos, gs, pid, season),
                    )
                    touched += cur.rowcount
                if touched:
                    n_pat += 1
                else:
                    # bref has this player-season but nba_api didn't write a row
                    # for it (or the match landed on the wrong player).
                    n_miss += 1

        if not dry_run:
            conn.commit()
        inserted += n_ins
        patched += n_pat
        missing_row += n_miss
        detail = f"inserted {n_ins}" if end_year < NBA_API_FIRST_END_YEAR else f"patched {n_pat}"
        if n_miss:
            detail += f", {n_miss} with no matching stat row"
        n_drop = sum(1 for c in collisions if c[0] == season)
        if n_drop:
            detail += f", {n_drop} dropped to collisions"
        print(f"  {detail}{'  (dry run, nothing written)' if dry_run else ''}")

    if collisions:
        with open(COLLISION_CSV, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["season", "team", "name", "slug", "games", "reason"])
            w.writerows(collisions)
        print(f"\n{len(collisions)} bref rows lost or dropped to a collision -> {COLLISION_CSV.name}")

    if unmatched:
        with open(UNMATCHED_CSV, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["season", "team", "name", "slug", "best_score"])
            w.writerows(unmatched)
        print(f"\nwrote {len(unmatched)} unmatched -> {UNMATCHED_CSV.name}")

    cur.close()
    conn.close()
    print(f"\ntotals rows inserted: {inserted}   pos/gs rows patched: {patched}", end="")
    print(f"   bref-only player-seasons: {missing_row}" if missing_row else "")
    print("by match method:", dict(sorted(methods.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
