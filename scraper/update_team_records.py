"""Refreshes the in-progress season's `team_seasons` rows from nba.com.

The daily counterpart of backfill_teams.py, which reads the same five columns
off basketball-reference's standings. nba_api has every one of them for a
current season, in two requests, so the daily job takes them from there:

  wins, losses    counted off the regular-season game log.
  srs             computed from the same log. The Simple Rating System is a
                  team's average margin plus the average rating of the teams
                  it played, solved for every team at once.
  made_playoffs   the team has a game in the playoff log. The play-in is its
                  own season type on nba.com, so losing one doesn't count.
  champion        the team with sixteen playoff wins.

backfill_teams.py is still the script for history: nba_api's leaguedash family
is empty before 1996-97, and bref covers every season salaries are held for.

Idempotent: upserts on (team_id, season).

Usage:
  python update_team_records.py             # the season now in progress
  python update_team_records.py 2026-27     # a specific nba_api season string
"""
import sys

from nba_api.stats.endpoints import leaguegamelog

import nba

from backfill_stats import current_season
from backfill_team_ratings import load_team_ids
from db import connect, to_season_label

# Four best-of-seven rounds.
TITLE_WINS = 16


def fetch(season, season_type):
    return nba.frames(
        leaguegamelog.LeagueGameLog,
        f"{season} {season_type}",
        season=season,
        season_type_all_star=season_type,
        player_or_team_abbreviation="T",
        timeout=90,
    )[0]


def records(df):
    """Game log -> {abbr: {wins, losses, margin, opponents}}."""
    by_game = {}
    for row in df.to_dict("records"):
        by_game.setdefault(row["GAME_ID"], []).append(row)

    out = {}
    for rows in by_game.values():
        if len(rows) != 2:
            continue
        for row, opp in ((rows[0], rows[1]), (rows[1], rows[0])):
            t = out.setdefault(
                row["TEAM_ABBREVIATION"],
                {"wins": 0, "losses": 0, "margin": 0, "opponents": []},
            )
            t["wins" if row["WL"] == "W" else "losses"] += 1
            t["margin"] += int(row["PTS"]) - int(opp["PTS"])
            t["opponents"].append(opp["TEAM_ABBREVIATION"])
    return out


def simple_ratings(teams):
    """{abbr: SRS}: average margin plus the average rating of its opponents.

    Each team's rating depends on everyone else's, so it is solved by
    repetition: start from margin alone and re-rate until nothing moves.
    """
    margin = {a: t["margin"] / len(t["opponents"]) for a, t in teams.items()}
    srs = dict(margin)
    for _ in range(1000):
        nxt = {
            a: margin[a] + sum(srs[o] for o in t["opponents"]) / len(t["opponents"])
            for a, t in teams.items()
        }
        # The ratings are only fixed up to a constant; pin the league at zero.
        mean = sum(nxt.values()) / len(nxt)
        nxt = {a: v - mean for a, v in nxt.items()}
        moved = max(abs(nxt[a] - srs[a]) for a in nxt)
        srs = nxt
        if moved < 1e-6:
            break
    return srs


def team_rows(regular, playoffs):
    """[(abbr, wins, losses, srs, made_playoffs, champion)], best record first."""
    teams = records(regular)
    srs = simple_ratings(teams)
    post = records(playoffs) if not playoffs.empty else {}
    rows = [
        (
            abbr, t["wins"], t["losses"], round(srs[abbr], 2),
            abbr in post,
            post.get(abbr, {}).get("wins", 0) >= TITLE_WINS,
        )
        for abbr, t in teams.items()
    ]
    return sorted(rows, key=lambda r: (-r[1], r[0]))


def main():
    season = sys.argv[1] if len(sys.argv) > 1 else current_season()
    label = to_season_label(season)

    regular = fetch(season, "Regular Season")
    if regular.empty:
        print(f"{label}: no games")
        return
    playoffs = fetch(season, "Playoffs")

    conn = connect()
    cur = conn.cursor()
    team_ids = load_team_ids(cur)
    rows = team_rows(regular, playoffs)
    for abbr, wins, losses, srs, made_playoffs, champion in rows:
        team_id = team_ids.get(abbr)
        if team_id is None:
            raise SystemExit(
                f"{label}: unknown team abbreviation {abbr!r} — add it to "
                f"ALIASES in seed_teams.py and re-run that first"
            )
        cur.execute(
            """
            INSERT INTO team_seasons
                (team_id, season, wins, losses, srs, made_playoffs, champion, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'nba_api')
            ON CONFLICT (team_id, season) DO UPDATE SET
                wins = EXCLUDED.wins, losses = EXCLUDED.losses, srs = EXCLUDED.srs,
                made_playoffs = EXCLUDED.made_playoffs, champion = EXCLUDED.champion,
                source = EXCLUDED.source
            """,
            (team_id, label, wins, losses, srs, made_playoffs, champion),
        )
    conn.commit()
    cur.close()
    conn.close()
    champ = next((r[0] for r in rows if r[5]), None)
    print(f"{label}: {len(rows)} teams" + (f", champion {champ}" if champ else ""))


if __name__ == "__main__":
    main()
