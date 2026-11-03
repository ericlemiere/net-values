"""The season's stats from BALLDONTLIE, the paid API that replaced nba.com.

From 2025-26 on, everything the model reads from a box score or the tracking
cameras comes from here. Earlier seasons stay as nba.com wrote them and are
never re-fetched. bref still supplies position, games started, age, its
advanced box-score formulas, awards, and salaries.

  game lines        /v1/stats, every game of the season, one row per player.
                    Summed into player_stats_totals and player_stats_per_game;
                    backfill_team_splits.py sums them per team, through
                    gamelog_frame(), for a traded player's stints.
  team ratings      games, minutes, and points from the same lines. Possessions
                    from team season averages, the team's own and its
                    opponents': the lines leave out team turnovers (a shot-clock
                    violation is no player's), and possessions summed from them
                    come up ~0.7% short.
  team records      wins, losses, SRS, playoffs, and champion, from the games
                    the lines belong to.
  advanced          season averages general/advanced -> nba_advanced
  scoring splits    season averages general/scoring -> player_scoring_splits
  tracking defense  season averages defense/overall and hustle ->
                    player_tracking_defense

What doesn't count: BALLDONTLIE files the play-in and the NBA Cup final as
regular-season games. nba.com doesn't, and neither does this: the Cup final is
dropped by its ist_stage, and the play-in by keeping each team's first 82.

Season averages are per game; totals are average × games, rounded. Two
decimals over fewer than 100 games always round back to the exact count.

Players are looked up by players.balldontlie_id. One not seen before is
matched by name (map_balldontlie.pin) and, failing that, created. A created
player has no nba_person_id, so no headshot until one is added.

Idempotent: everything upserts on (player_id, season) or (team_id, season).

Usage:
  python backfill_bdl.py            # the season now in progress
  python backfill_bdl.py 2025       # a start year (2025 is 2025-26)
"""
import sys
from collections import defaultdict

import pandas as pd

import bdl
import map_balldontlie
from backfill_stats import current_season, upsert_stat_row
from backfill_team_ratings import load_team_ids, write_season as write_ratings
from backfill_tracking_defense import upsert as upsert_tracking, DEFEND_COLUMNS, HUSTLE_COLUMNS
from db import connect
from update_team_records import team_rows, write_season as write_records

# The first season taken from here, by start year.
FIRST_SEASON = 2025
# The first bref end year that's ours: backfill_team_splits reads it.
FIRST_END_YEAR = FIRST_SEASON + 1

SEASON_GAMES = 82
SOURCE = "balldontlie"
# Long enough that a morning run's later steps reuse its fetch, short enough
# that tomorrow's run always fetches again.
LINES_MAX_AGE = 6 * 3600

# game line key -> our column, for what gets summed.
BOX = {
    "fgm": "fgm", "fga": "fga", "fg3m": "fg3m", "fg3a": "fg3a", "ftm": "ftm",
    "fta": "fta", "oreb": "orb", "dreb": "drb", "reb": "reb", "ast": "ast",
    "stl": "stl", "blk": "blk", "turnover": "tov", "pf": "pf", "pts": "pts",
}


def label(start_year):
    return f"{start_year}-{start_year + 1}"


def counted(rows):
    """(regular-season lines, playoff lines), finished games only.

    The Cup final and the play-in are left out of both; see the docstring.
    """
    rows = [r for r in rows if r["game"]["status_state"] == "final"]
    playoffs = [r for r in rows if r["game"]["postseason"]]
    regular = [r for r in rows if not r["game"]["postseason"]
               and r["game"].get("ist_stage") != "Championship"]

    team_games = defaultdict(set)
    for r in regular:
        team_games[r["team"]["id"]].add((r["game"]["date"], r["game"]["id"]))
    kept = {team: {gid for _, gid in sorted(games)[:SEASON_GAMES]}
            for team, games in team_games.items()}
    regular = [r for r in regular if r["game"]["id"] in kept[r["team"]["id"]]]
    return regular, playoffs


def played(lines):
    """The lines of players who got on the floor.

    Minutes are whole numbers, so a stint under thirty seconds reads "00", the
    same as a DNP. A nonzero plus-minus or any stat gives some of those away;
    the rest are lost, which leaves a deep-bench player a game or two short of
    nba.com's count.
    """
    return [r for r in lines if bdl.minutes(r["min"]) > 0 or r["plus_minus"]
            or any(r[key] for key in BOX)]


def resolve_players(cur, lines, season, write=True):
    """{bdl_id: player_id} for everyone in `lines` and on a roster today.

    New players are matched by name and pinned, or created when nobody
    matches. A collision is printed and left out, so its rows are skipped.
    """
    found = {}
    map_balldontlie.collect(found, ((r["player"], r["team"]["abbreviation"]) for r in lines), season)
    if season == label(int(current_season()[:4])):
        map_balldontlie.collect(found, map_balldontlie.active_roster(), season)
    _, unmatched, _ = map_balldontlie.pin(cur, found, write)
    for bid, name, _, apps in unmatched:
        cur.execute(
            "INSERT INTO players (name, balldontlie_id) VALUES (%s, %s) "
            "ON CONFLICT (balldontlie_id) DO NOTHING",
            (name, bid),
        )
        print(f"  + new player {name} ({apps[-1][1]})")
    cur.execute("SELECT balldontlie_id, id FROM players WHERE balldontlie_id IS NOT NULL")
    return dict(cur.fetchall())


def stat_values(total, gp, team):
    """One player_stats_* row's columns from summed (or averaged) box stats."""
    fgm, fga, fg3m, fg3a = total["fgm"], total["fga"], total["fg3m"], total["fg3a"]
    fg2m, fg2a = fgm - fg3m, fga - fg3a

    def pct(made, att):
        # nba.com published these as three-decimal fractions; stored 0-100.
        return round(100.0 * made / att, 1) if att else None

    return {
        "team": team, "pos": None, "age": None, "gp": gp, "gs": None,
        "mp": total["mp"],
        "fgm": fgm, "fga": fga, "fg_pct": pct(fgm, fga),
        "fg3m": fg3m, "fg3a": fg3a, "fg3_pct": pct(fg3m, fg3a),
        "fg2m": fg2m, "fg2a": fg2a, "fg2_pct": (fg2m / fg2a * 100) if fg2a else None,
        "efg_pct": ((fgm + 0.5 * fg3m) / fga * 100) if fga else None,
        "ftm": total["ftm"], "fta": total["fta"], "ft_pct": pct(total["ftm"], total["fta"]),
        "orb": total["orb"], "drb": total["drb"], "reb": total["reb"],
        "ast": total["ast"], "stl": total["stl"], "blk": total["blk"],
        "tov": total["tov"], "pf": total["pf"], "pts": total["pts"],
        "source": SOURCE,
    }


def write_player_stats(cur, season, lines, pid_for, abbr_for):
    """player_stats_totals and player_stats_per_game. Returns {player_id: team}."""
    by_player = defaultdict(list)
    for r in played(lines):
        pid = pid_for.get(r["player"]["id"])
        if pid is not None:
            by_player[pid].append(r)

    team_of = {}
    for pid, games in by_player.items():
        games.sort(key=lambda r: r["game"]["date"])
        # A traded player's season row carries his latest team, as nba.com's did.
        team = abbr_for.get(games[-1]["team"]["abbreviation"])
        team_of[pid] = team
        gp = len(games)
        total = {col: float(sum(r[key] or 0 for r in games)) for key, col in BOX.items()}
        total["mp"] = sum(bdl.minutes(r["min"]) for r in games)
        upsert_stat_row(cur, "player_stats_totals", pid, season, stat_values(total, gp, team))
        per_game = {col: round(v / gp, 1) for col, v in total.items()}
        values = stat_values(per_game, gp, team)
        # Percentages are the season's, not ratios of rounded averages.
        for col in ("fg_pct", "fg3_pct", "ft_pct", "fg2_pct", "efg_pct"):
            values[col] = stat_values(total, gp, team)[col]
        upsert_stat_row(cur, "player_stats_per_game", pid, season, values)
    print(f"  {len(by_player)} players' season totals")
    return team_of


def game_minutes(game):
    """48, plus 5 per overtime.

    Overtime only if regulation ended tied: `period` alone has said 5 for a
    game decided by six in the fourth (DAL-LAL, 2026-04-05).
    """
    home = sum(game.get(f"home_q{q}") or 0 for q in range(1, 5))
    away = sum(game.get(f"visitor_q{q}") or 0 for q in range(1, 5))
    if home != away:
        return 48
    return 48 + 5 * max(0, game["period"] - 4)


def team_games(lines, abbr_for):
    """[(game, {abbr: points})]: each game once, with both teams' scores."""
    games = {}
    for r in lines:
        g = r["game"]
        games[g["id"]] = g
    team_abbr = {}
    for r in lines:
        team_abbr[r["team"]["id"]] = abbr_for.get(r["team"]["abbreviation"])
    out = []
    for g in games.values():
        home, away = team_abbr.get(g["home_team_id"]), team_abbr.get(g["visitor_team_id"])
        if home and away:
            out.append((g, {home: g["home_team_score"], away: g["visitor_team_score"]}))
    return out


def write_team_ratings(cur, start_year, season, regular, abbr_for):
    rows = {}
    for g, score in team_games(regular, abbr_for):
        (a, pa), (b, pb) = score.items()
        for team, pts, opp_pts in ((a, pa, pb), (b, pb, pa)):
            t = rows.setdefault(team, {"gp": 0, "minutes": 0.0, "poss": 0.0, "pts": 0, "opp_pts": 0})
            t["gp"] += 1
            t["minutes"] += game_minutes(g)
            t["pts"] += pts
            t["opp_pts"] += opp_pts

    def averages(type_):
        j = bdl.get("/nba/v1/team_season_averages/general", season=start_year,
                    season_type="regular", type=type_, per_page=100)
        return {abbr_for.get(row["team"]["abbreviation"]): row["stats"] for row in j["data"]}

    own, opp = averages("base"), averages("opponent")
    for team, t in rows.items():
        o, d = own[team], opp[team]
        # The same estimate as backfill_team_ratings.possessions, averaged
        # over the two sides, from per-game averages times games.
        mine = o["fga"] + 0.44 * o["fta"] - o["oreb"] + o["tov"]
        theirs = d["opp_fga"] + 0.44 * d["opp_fta"] - d["opp_oreb"] + d["opp_tov"]
        t["poss"] = 0.5 * (mine + theirs) * o["gp"]
    write_ratings(cur, load_team_ids(cur), season, rows, SOURCE)


def write_team_records(cur, season, regular, playoffs, abbr_for):
    def frame(lines):
        recs = []
        for g, score in team_games(lines, abbr_for):
            (a, pa), (b, pb) = score.items()
            recs.append({"GAME_ID": g["id"], "TEAM_ABBREVIATION": a, "PTS": pa, "WL": "W" if pa > pb else "L"})
            recs.append({"GAME_ID": g["id"], "TEAM_ABBREVIATION": b, "PTS": pb, "WL": "W" if pb > pa else "L"})
        return pd.DataFrame(recs, columns=["GAME_ID", "TEAM_ABBREVIATION", "PTS", "WL"])

    write_records(cur, season, team_rows(frame(regular), frame(playoffs)), SOURCE)


def season_averages(category, start_year, **params):
    return list(bdl.paged(f"/nba/v1/season_averages/{category}", season=start_year,
                          season_type="regular", **params))


def write_season_averages(cur, start_year, season, pid_for, team_of):
    def rows(category, **params):
        for row in season_averages(category, start_year, **params):
            pid = pid_for.get(row["player"]["id"])
            if pid is not None:
                yield pid, row["stats"]

    def pct(v, digits=2):
        return None if v is None else round(100.0 * v, digits)

    def total(avg, games):
        return None if avg is None or not games else float(round(avg * games))

    n = 0
    for pid, s in rows("general", type="advanced"):
        values = {
            "team": team_of.get(pid), "gp": s.get("gp"), "minutes": s.get("min"),
            "poss": s.get("poss"), "off_rating": s.get("off_rating"),
            "def_rating": s.get("def_rating"), "net_rating": s.get("net_rating"),
            "ast_pct": pct(s.get("ast_pct"), 1), "ast_to": s.get("ast_to"),
            "oreb_pct": pct(s.get("oreb_pct"), 1), "dreb_pct": pct(s.get("dreb_pct"), 1),
            "reb_pct": pct(s.get("reb_pct"), 1), "tov_pct": s.get("tm_tov_pct"),
            "efg_pct": pct(s.get("efg_pct"), 1), "ts_pct": pct(s.get("ts_pct"), 1),
            "usg_pct": pct(s.get("usg_pct"), 1), "pace": s.get("pace"), "pie": s.get("pie"),
            "source": SOURCE,
        }
        cols = list(values)
        cur.execute(
            f"""
            INSERT INTO nba_advanced (player_id, season, {", ".join(cols)})
            VALUES ({", ".join(["%s"] * (len(cols) + 2))})
            ON CONFLICT (player_id, season) DO UPDATE SET
                {", ".join(f"{c} = EXCLUDED.{c}" for c in cols)}
            """,
            [pid, season] + [values[c] for c in cols],
        )
        n += 1
    print(f"  {n} advanced")

    n = 0
    for pid, s in rows("general", type="scoring"):
        values = {
            "team": team_of.get(pid),
            "pct_ast_fgm": pct(s.get("pct_ast_fgm")), "pct_pts_paint": pct(s.get("pct_pts_paint")),
            "pct_pts_3pt": pct(s.get("pct_pts_3pt")), "pct_pts_ft": pct(s.get("pct_pts_ft")),
            "pct_pts_fb": pct(s.get("pct_pts_fb")), "source": SOURCE,
        }
        cols = list(values)
        cur.execute(
            f"""
            INSERT INTO player_scoring_splits (player_id, season, {", ".join(cols)})
            VALUES ({", ".join(["%s"] * (len(cols) + 2))})
            ON CONFLICT (player_id, season) DO UPDATE SET
                {", ".join(f"{c} = EXCLUDED.{c}" for c in cols)}
            """,
            [pid, season] + [values[c] for c in cols],
        )
        n += 1
    print(f"  {n} scoring splits")

    n = 0
    for pid, s in rows("defense", type="overall"):
        gp = s.get("gp")
        d_fga, d_fgm = total(s.get("d_fga"), gp), total(s.get("d_fgm"), gp)
        upsert_tracking(cur, pid, season, DEFEND_COLUMNS, {
            "team": team_of.get(pid),
            "d_fga": int(d_fga) if d_fga is not None else None,
            "d_fgm": int(d_fgm) if d_fgm is not None else None,
            "d_fg_pct": pct(s.get("d_fg_pct")), "normal_fg_pct": pct(s.get("normal_fg_pct")),
            "source": SOURCE,
        })
        n += 1
    print(f"  {n} defenders")

    n = 0
    for pid, s in rows("hustle"):
        g = s.get("g")
        upsert_tracking(cur, pid, season, HUSTLE_COLUMNS, {
            "deflections": total(s.get("deflections"), g),
            "contested_shots": total(s.get("contested_shots"), g),
            "loose_balls_recovered": total(s.get("loose_balls_recovered"), g),
            "charges_drawn": total(s.get("charges_drawn"), g),
            "source": SOURCE,
        })
        n += 1
    print(f"  {n} hustle rows")


def gamelog_frame(start_year, cur):
    """Regular-season lines shaped like nba.com's player game log.

    For backfill_team_splits.gamelog_splits and add_windows, which were written
    against nba.com's columns: PLAYER_ID is our player id and TEAM_ID our team
    id, so the two lookups it returns map ids to themselves and to abbrs.
    """
    team_ids = load_team_ids(cur)
    cur.execute("SELECT balldontlie_id, id FROM players WHERE balldontlie_id IS NOT NULL")
    pid_for = dict(cur.fetchall())
    regular, _ = counted(bdl.season_lines(start_year, LINES_MAX_AGE))

    recs, skipped = [], set()
    for r in played(regular):
        pid = pid_for.get(r["player"]["id"])
        if pid is None:
            skipped.add(map_balldontlie.player_name(r["player"]))
            continue
        rec = {
            "PLAYER_ID": pid, "PLAYER_NAME": map_balldontlie.player_name(r["player"]),
            "TEAM_ID": team_ids[r["team"]["abbreviation"]], "GAME_DATE": r["game"]["date"],
            "MIN": bdl.minutes(r["min"]),
        }
        for key, col in BOX.items():
            rec[{"orb": "OREB", "drb": "DREB"}.get(col, col.upper())] = r[key] or 0
        recs.append(rec)
    if skipped:
        print(f"  no player row for {len(skipped)} players: {sorted(skipped)[:5]}")
    cur.execute("SELECT id, abbr FROM teams")
    team_by_id = dict(cur.fetchall())
    return pd.DataFrame(recs), ({pid: pid for pid in pid_for.values()}, team_by_id)


def run(start_year):
    season = label(start_year)
    rows = bdl.season_lines(start_year, max_age=0)
    regular, playoffs = counted(rows)
    print(f"{season}: {len(rows)} game lines, {len({r['game']['id'] for r in regular})} "
          f"regular-season games, {len({r['game']['id'] for r in playoffs})} playoff games")

    conn = connect()
    with conn, conn.cursor() as cur:
        abbr_for = map_balldontlie.team_abbrs(cur)
        pid_for = resolve_players(cur, played(regular) + played(playoffs), season)
    with conn, conn.cursor() as cur:
        team_of = write_player_stats(cur, season, regular, pid_for, abbr_for)
    with conn, conn.cursor() as cur:
        write_team_ratings(cur, start_year, season, regular, abbr_for)
        write_team_records(cur, season, regular, playoffs, abbr_for)
    with conn, conn.cursor() as cur:
        write_season_averages(cur, start_year, season, pid_for, team_of)
    conn.close()


def main():
    start_year = int(sys.argv[1]) if len(sys.argv) > 1 else int(current_season()[:4])
    if start_year < FIRST_SEASON:
        raise SystemExit(f"{start_year}: before {FIRST_SEASON}, seasons stay as nba.com wrote them")
    run(start_year)


if __name__ == "__main__":
    main()
