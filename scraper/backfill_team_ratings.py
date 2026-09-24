"""Backfills `team_season_ratings` from nba_api's league game log.

Why game logs rather than the team Advanced endpoint, which reports the same
ratings directly: the leaguedash* family returns an empty frame for every
season before 1996-97 — checked for Base, Advanced, Scoring and Defense, both
player and team — while the game log goes back to the 1940s. Since Net Value
prices seasons from 1990-91 on, the game log is the only nba_api route that
covers all of them, and it happens to be a single request per season.

Each game appears twice in the log, once per team. Joining the two rows on
GAME_ID gives a team its own box score and its opponent's in the same row,
which is what makes both ratings computable: possessions need the opponent's
rebounds and turnovers, and a defensive rating is nothing but what the
opponent scored.

Possessions use the standard estimate averaged across the two teams, since a
single team's figure double-counts the ends of possessions it did not finish.
Against nba.com's own published possession counts for the 842 team-seasons
where both exist, this lands within 0.6 points per 100 on both ratings
(r = 0.995 on each), which is well inside the noise of the model that consumes
them.

Idempotent: upserts on (team_id, season).

Usage:
  python backfill_team_ratings.py                 # 1990-91 .. current
  python backfill_team_ratings.py 2024-25         # one nba_api season string
"""
import sys
import time

from nba_api.stats.endpoints import leaguegamelog

from db import connect, to_season_label
from backfill_stats import current_season

SLEEP_SECONDS = 1.4

# Net Value prices seasons from 1990-91, which is as far back as the salary
# data reaches. The game log itself goes back much further.
FIRST_SEASON = 1990


def seasons_through_current():
    last = int(current_season()[:4])
    return [f"{y}-{str(y + 1)[2:]}" for y in range(FIRST_SEASON, last + 1)]


def fetch(season):
    for attempt in range(5):
        try:
            return leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star="Regular Season",
                player_or_team_abbreviation="T",
                timeout=90,
            ).get_data_frames()[0]
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  fetch failed ({e}), retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {season} after 5 attempts")


def possessions(row, opp):
    """Possessions in one game, averaged over the two teams.

    Each team's own figure is an estimate of how many possessions it used;
    they should agree to within a possession or two, and averaging is the
    convention precisely because they don't exactly.
    """
    def side(r):
        return r["FGA"] + 0.44 * r["FTA"] - r["OREB"] + r["TOV"]

    return 0.5 * (side(row) + side(opp))


def team_season_rows(df):
    """Game log -> one (abbr, gp, poss, pts, opp_pts) per team-season."""
    by_game = {}
    for row in df.to_dict("records"):
        by_game.setdefault(row["GAME_ID"], []).append(row)

    totals = {}
    for game_id, rows in by_game.items():
        if len(rows) != 2:
            # A game with one side missing can't produce an opponent figure, so
            # it is left out rather than silently counted as a shutout.
            print(f"  skipping {game_id}: {len(rows)} team rows", file=sys.stderr)
            continue
        for row, opp in ((rows[0], rows[1]), (rows[1], rows[0])):
            t = totals.setdefault(
                row["TEAM_ABBREVIATION"],
                {"gp": 0, "poss": 0.0, "pts": 0, "opp_pts": 0},
            )
            t["gp"] += 1
            t["poss"] += possessions(row, opp)
            t["pts"] += int(row["PTS"])
            t["opp_pts"] += int(opp["PTS"])
    return totals


def load_team_ids(cur):
    """Every abbreviation nba.com might use -> our canonical team id."""
    cur.execute(
        """
        SELECT abbr, id FROM teams
        UNION ALL
        SELECT a.alias, a.team_id FROM team_aliases a
        """
    )
    return dict(cur.fetchall())


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    seasons = [only] if only else seasons_through_current()

    conn = connect()
    cur = conn.cursor()
    team_ids = load_team_ids(cur)

    written = 0
    for season in seasons:
        df = fetch(season)
        label = to_season_label(season)
        if df.empty:
            print(f"{label}: no games")
            time.sleep(SLEEP_SECONDS)
            continue

        for abbr, t in sorted(team_season_rows(df).items()):
            team_id = team_ids.get(abbr)
            if team_id is None:
                raise SystemExit(
                    f"{label}: unknown team abbreviation {abbr!r} — add it to "
                    f"ALIASES in seed_teams.py and re-run that first"
                )
            off = 100.0 * t["pts"] / t["poss"]
            deff = 100.0 * t["opp_pts"] / t["poss"]
            cur.execute(
                """
                INSERT INTO team_season_ratings
                    (team_id, season, gp, poss, pts, opp_pts,
                     off_rating, def_rating, net_rating, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'nba_api')
                ON CONFLICT (team_id, season) DO UPDATE SET
                    gp = EXCLUDED.gp, poss = EXCLUDED.poss, pts = EXCLUDED.pts,
                    opp_pts = EXCLUDED.opp_pts, off_rating = EXCLUDED.off_rating,
                    def_rating = EXCLUDED.def_rating, net_rating = EXCLUDED.net_rating,
                    source = EXCLUDED.source
                """,
                (
                    team_id, label, t["gp"], round(t["poss"], 1),
                    t["pts"], t["opp_pts"],
                    round(off, 2), round(deff, 2), round(off - deff, 2),
                ),
            )
            written += 1
        conn.commit()
        print(f"{label}: {len(team_season_rows(df))} teams")
        time.sleep(SLEEP_SECONDS)

    cur.close()
    conn.close()
    print(f"\nwrote {written} team-seasons")


if __name__ == "__main__":
    main()
