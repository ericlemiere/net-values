"""Tests candidate production metrics against the only ground truth we have:
actual team wins.

A player-value metric is only worth anything if, when you add up a team's
players, you get something close to how many games that team actually won.
This script builds each candidate per player-season, sums it by team-season,
and reports the correlation with real wins. Nothing is written to the database
— this exists to choose a formula, not to store one.

Team attribution note: nba_api assigns a traded player's whole season to one
team, so a mid-season trade moves all of his production to one side. That adds
noise to every candidate equally, so it doesn't bias the comparison.

Usage:
  python validate_value.py
"""
import numpy as np
import pandas as pd

from db import connect

# A replacement player is roughly this much worse than league average, per 100
# possessions. -2.0 is the convention bref uses for BPM/VORP.
REPLACEMENT_BPM = -2.0


def load():
    conn = connect()
    df = pd.read_sql(
        """
        SELECT a.player_id, a.season, a.team,
               a.poss, a.net_rating, a.off_rating, a.def_rating, a.pie,
               a.minutes,
               adv.bpm, adv.obpm, adv.dbpm, adv.vorp, adv.ws, adv.per,
               ts.wins, ts.losses
        FROM nba_advanced a
        JOIN advanced_stats adv
          ON adv.player_id = a.player_id AND adv.season = a.season
        JOIN teams t ON t.abbr = a.team
        JOIN team_seasons ts ON ts.team_id = t.id AND ts.season = a.season
        WHERE ts.wins IS NOT NULL AND a.poss > 0
        """,
        conn,
    )
    conn.close()
    return df


def candidates(df):
    """Each candidate is a per-player-season production figure, in wins-ish units."""
    poss100 = df["poss"] / 100.0
    out = {}

    # --- what already exists ---
    out["VORP (bref)"] = df["vorp"]
    out["Win Shares (bref)"] = df["ws"]

    # --- box prior, scaled by possessions rather than minutes ---
    out["BPM x poss"] = df["bpm"] * poss100
    out["(BPM - repl) x poss"] = (df["bpm"] - REPLACEMENT_BPM) * poss100

    # --- PIE, nba.com's own composite ---
    out["PIE x poss"] = df["pie"] * poss100

    # --- raw on-court, no shrinkage: expected to be the worst ---
    out["NET_RATING x poss"] = df["net_rating"] * poss100

    # --- the blend: on-court shrunk toward the box prior by sample size ---
    for k in (500, 1000, 2000, 4000, 8000):
        w = df["poss"] / (df["poss"] + k)
        blended = w * df["net_rating"] + (1 - w) * df["bpm"]
        out[f"blend k={k}"] = (blended - REPLACEMENT_BPM) * poss100
    return out


def evaluate(df, name, series):
    """Sum by team-season, then correlate with actual wins."""
    tmp = df[["season", "team", "wins"]].copy()
    tmp["value"] = series
    grouped = tmp.groupby(["season", "team"]).agg(value=("value", "sum"), wins=("wins", "first"))
    grouped = grouped.dropna()
    if len(grouped) < 10:
        return None
    r = np.corrcoef(grouped["value"], grouped["wins"])[0, 1]
    # Fit wins = a + b*value, and report the typical miss in wins.
    b, a = np.polyfit(grouped["value"], grouped["wins"], 1)
    resid = grouped["wins"] - (a + b * grouped["value"])
    return {
        "name": name,
        "r": r,
        "r2": r * r,
        "mae_wins": float(np.abs(resid).mean()),
        "team_seasons": len(grouped),
    }


def delta_test(df, name, series):
    """The stronger test: does a change in roster production predict a change in wins?

    Correlating team-summed production against team wins flatters any metric
    that is really measuring team quality — Win Shares is allocated FROM team
    ratings, and on-court net rating is mostly the team's net rating. Both will
    score well without saying anything about an individual.

    Differencing a team season-over-season cancels everything constant about
    the franchise and asks a harder question: when the roster's production
    changed, did the wins follow? A metric that only echoes team quality has
    much less to say here.
    """
    tmp = df[["season", "team", "wins"]].copy()
    tmp["value"] = series
    g = (
        tmp.groupby(["season", "team"])
        .agg(value=("value", "sum"), wins=("wins", "first"))
        .reset_index()
        .sort_values(["team", "season"])
    )
    g["prev_value"] = g.groupby("team")["value"].shift(1)
    g["prev_wins"] = g.groupby("team")["wins"].shift(1)
    g["prev_season"] = g.groupby("team")["season"].shift(1)
    # Only consecutive seasons.
    consecutive = g["season"].str[:4].astype(float) - g["prev_season"].str[:4].astype(float) == 1
    g = g[consecutive].dropna(subset=["prev_value", "prev_wins"])
    if len(g) < 10:
        return None
    dv = g["value"] - g["prev_value"]
    dw = g["wins"] - g["prev_wins"]
    return float(np.corrcoef(dv, dw)[0, 1]), len(g)


def main():
    df = load()
    print(f"player-seasons: {len(df)}   team-seasons: {df.groupby(['season','team']).ngroups}")
    print(f"seasons: {df.season.min()} .. {df.season.max()}\n")

    rows = [evaluate(df, name, s) for name, s in candidates(df).items()]
    rows = [r for r in rows if r]
    rows.sort(key=lambda r: -r["r"])

    cands = candidates(df)
    print(f"{'candidate':24} {'r (level)':>10} {'MAE wins':>9} {'r (YoY delta)':>14}")
    print("-" * 62)
    for r in rows:
        d = delta_test(df, r["name"], cands[r["name"]])
        dr = f"{d[0]:14.3f}" if d else " " * 14
        print(f"{r['name']:24} {r['r']:10.3f} {r['mae_wins']:9.2f} {dr}")
    print()
    if rows:
        d = delta_test(df, rows[0]["name"], cands[rows[0]["name"]])
        if d:
            print(f"year-over-year pairs used: {d[1]}")


if __name__ == "__main__":
    main()
