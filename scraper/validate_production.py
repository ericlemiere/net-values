"""Checks player_production against everything that can be checked, and prints
leaderboards to eyeball.

Three tests, measuring different things:

TEAM WINS. Sum a roster's production, correlate with games won, and also with
the change in games won from one season to the next. The year-over-year test is
the stricter one: differencing a team cancels everything constant about the
franchise and asks whether the wins followed when the roster's production moved.

A caveat that matters here more than it did for VORP. Production is anchored to
each team's own rating, so this test is close to guaranteed to pass and says
nothing whatever about whether the credit is split correctly BETWEEN team-mates
— every possible split scores the same. It is a check that the arithmetic and
the team attribution are sound, not that the model is right about individuals.

AWARD VOTING. The only independent read on the split that exists. Reported as
the area under the ROC curve for identifying that season's All-Defensive and
All-NBA selections, and the rank correlation with DPOY and MVP vote shares.
These are the numbers to watch when changing how credit is allocated.

FACE VALIDITY. Leaderboards. Some things are easier to see than to score.

Usage:
  python validate_production.py                     # the full report
  python validate_production.py 2024-2025           # one season's leaderboard
  python validate_production.py --player "Rudy Gobert"
"""
import sys

import numpy as np
import pandas as pd

from db import connect

QUALIFYING_MINUTES = 1500


def load(conn):
    prod = pd.read_sql(
        """
        SELECT pp.player_id, pp.season, pp.team, pp.minutes, pp.production,
               pp.off_per100, pp.def_per100, pp.impact_per100, pp.def_quality,
               pp.def_tracked, pp.source, p.name,
               adv.vorp, adv.ws, adv.bpm
        FROM player_production pp
        JOIN players p ON p.id = pp.player_id
        LEFT JOIN advanced_stats adv
               ON adv.player_id = pp.player_id AND adv.season = pp.season
        """,
        conn,
    )
    teams = pd.read_sql(
        """
        SELECT te.abbr AS team, ts.season, ts.wins
        FROM team_seasons ts JOIN teams te ON te.id = ts.team_id
        WHERE ts.wins IS NOT NULL
        """,
        conn,
    )
    awards = pd.read_sql(
        "SELECT player_id, season, award, won, share FROM player_awards", conn
    )
    return prod, teams, awards


def wins_tests(prod, teams, column):
    rosters = (
        prod.dropna(subset=[column])
        .groupby(["season", "team"])[column].sum().rename("value").reset_index()
        .merge(teams, on=["season", "team"])
    )
    level = np.corrcoef(rosters.value, rosters.wins)[0, 1]

    rosters = rosters.sort_values(["team", "season"])
    prior = rosters.groupby("team").shift(1)
    consecutive = (
        rosters.season.str[:4].astype(float) - prior.season.str[:4].astype(float) == 1
    )
    moved = rosters[consecutive].dropna(subset=["value"])
    delta = np.corrcoef(
        moved.value - prior.value[consecutive].dropna(),
        moved.wins - prior.wins[consecutive].dropna(),
    )[0, 1]
    return level, delta, len(rosters)


def auc(scores, labels):
    ranks = pd.Series(scores).rank().values
    positives = labels.sum()
    negatives = len(labels) - positives
    if positives < 3 or negatives < 3:
        return None
    return (ranks[labels == 1].sum() - positives * (positives + 1) / 2) / (
        positives * negatives
    )


def award_tests(prod, awards, column):
    qualified = prod[(prod.minutes >= QUALIFYING_MINUTES) & prod[column].notna()].copy()
    for name in ("all_defense", "all_nba"):
        picks = awards[(awards.award == name) & awards.won][["player_id", "season"]]
        qualified[name] = (
            qualified.merge(picks.assign(hit=1), on=["player_id", "season"], how="left")
            .hit.fillna(0).values
        )
    for name in ("dpoy", "mvp"):
        shares = awards[awards.award == name][["player_id", "season", "share"]]
        qualified[name] = (
            qualified.merge(shares, on=["player_id", "season"], how="left")
            .share.fillna(0).values
        )

    out = {}
    for name in ("all_defense", "all_nba"):
        scored = [auc(g[column].values, g[name].values) for _, g in qualified.groupby("season")]
        out[name] = np.mean([s for s in scored if s is not None])
    for name in ("dpoy", "mvp"):
        scored = [
            g[column].corr(g[name], method="spearman")
            for _, g in qualified.groupby("season")
            if (g[name] > 0).sum() >= 3
        ]
        out[name] = np.mean(scored)
    return out


def report(prod, teams, awards):
    print(f"player-seasons {len(prod)}, {prod.season.min()} .. {prod.season.max()}")
    tracked = prod[prod.def_tracked].season.nunique()
    print(f"seasons with tracking-informed defense: {tracked}")
    print(f"priced against the league (no team on the stat line): "
          f"{(prod.source == 'league_average').sum()}\n")

    header = f"{'metric':14}{'r wins':>9}{'r YoY':>8}{'AllDef':>9}{'AllNBA':>8}{'DPOY':>8}{'MVP':>7}"
    print(header)
    print("-" * len(header))
    for label, column in (("production", "production"), ("VORP (bref)", "vorp"),
                          ("WS (bref)", "ws")):
        if prod[column].notna().sum() == 0:
            continue
        level, delta, _ = wins_tests(prod, teams, column)
        a = award_tests(prod, awards, column)
        print(f"{label:14}{level:9.3f}{delta:8.3f}{a['all_defense']:9.3f}"
              f"{a['all_nba']:8.3f}{a['dpoy']:8.3f}{a['mvp']:7.3f}")


def leaderboard(prod, season, n=15):
    cols = ["name", "team", "minutes", "off_per100", "def_per100", "impact_per100",
            "def_quality", "production", "vorp", "ws"]
    top = prod[prod.season == season].nlargest(n, "production")
    print(f"\n=== {season}: most production ===")
    print(top[cols].round(2).to_string(index=False))


def defenders(prod, season, n=12):
    q = prod[(prod.season == season) & (prod.minutes >= QUALIFYING_MINUTES)]
    print(f"\n=== {season}: best defenders (quality score) ===")
    print(
        q.nlargest(n, "def_quality")[
            ["name", "team", "minutes", "def_quality", "def_per100", "def_tracked"]
        ].round(2).to_string(index=False)
    )


def player(prod, name):
    rows = prod[prod.name.str.lower() == name.lower()].sort_values("season")
    if rows.empty:
        print(f"no rows for {name!r}")
        return
    print(f"\n=== {rows.name.iloc[0]} ===")
    print(
        rows[["season", "team", "minutes", "off_per100", "def_per100",
              "def_quality", "production", "vorp", "ws"]]
        .round(2).to_string(index=False)
    )


def main():
    conn = connect()
    prod, teams, awards = load(conn)
    conn.close()
    if prod.empty:
        raise SystemExit("player_production is empty — run compute_production.py")

    args = sys.argv[1:]
    if args and args[0] == "--player":
        player(prod, " ".join(args[1:]))
        return
    if args:
        leaderboard(prod, args[0])
        defenders(prod, args[0])
        return

    report(prod, teams, awards)
    for season in ("1992-1993", "2024-2025"):
        if (prod.season == season).any():
            leaderboard(prod, season)
            defenders(prod, season)


if __name__ == "__main__":
    main()
