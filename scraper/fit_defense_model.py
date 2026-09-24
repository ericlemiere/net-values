"""Fits the defensive-quality model that compute_production.py uses to split a
team's defensive performance between its own players.

Nothing here runs in the daily refresh. The coefficients this prints are pasted
into compute_production.py as constants, so the pipeline stays deterministic
and needs neither this script nor an award table to price a live season — which
matters, because award voting lands in May and Net Value has to be computable in
December.

WHAT IS BEING FITTED, AND WHY AGAINST AWARDS

The production model starts from a team's actual defensive points above league
average — a number that is not in doubt — and divides it among the players. How
to divide it is the entire modeling problem, and the usual validation is no
help at all: because every split sums to the same team total, correlating a
roster's production against its wins gives an identical answer no matter how
the defensive credit is allocated (0.967, checked across every rule tried).
The wins test cannot see inside a team.

That leaves the voting record as the only independent read on who actually
defended, so this fits to it: All-Defensive selections and meaningful DPOY vote
shares, over every season on file. Voters are not ground truth — they favor
reputation, big minutes and winning teams — which is why their verdict is used
only to rank players within a team, never to decide how much there is to go
round.

TWO TIERS

Box-score defense describes a rim protector adequately and a wing not at all,
so where tracking data exists it is used:

  box       1990-91+    steals, blocks, defensive rebounds, fouls
  tracking  2013-14+    the above, plus shots defended and how badly the
                        shooters did, plus deflections and contested shots

Reported below is honest holdout performance: fitted on alternate seasons,
scored on the ones held out.

Usage:
  python fit_defense_model.py
"""
import numpy as np

from db import connect

# Minutes a player needs before his defensive rates are worth reading at all.
MIN_MINUTES = 1000

# A DPOY share this small is one voter having a hunch, not a defensive
# reputation, so it doesn't count as a positive label on its own.
DPOY_LABEL_THRESHOLD = 0.05

BOX_FEATURES = ["stl100", "blk100", "drb100", "pf100"]
TRACKING_FEATURES = BOX_FEATURES + [
    "fg_saved100", "d_fga100", "deflections100", "contested100",
    "loose_balls100", "charges100",
]

# Ridge penalty. The tracking columns are collinear (contested shots and shots
# defended measure overlapping things), and without it their coefficients trade
# large positive and negative values that fit the sample and generalize worse.
L2 = 1.0


def load(cur):
    cur.execute(
        """
        SELECT t.player_id, t.season, t.mp, t.stl, t.blk, t.drb, t.pf,
               d.d_fga, d.d_fg_pct, d.normal_fg_pct, d.deflections,
               d.contested_shots, d.loose_balls_recovered, d.charges_drawn,
               r.poss, r.gp,
               COALESCE(ad.won, false) AS all_defense,
               COALESCE(dp.share, 0) AS dpoy_share
        FROM player_stats_totals t
        JOIN teams te ON te.abbr = t.team
        LEFT JOIN team_aliases al ON al.alias = t.team
        JOIN team_season_ratings r
          ON r.team_id = COALESCE(al.team_id, te.id) AND r.season = t.season
        LEFT JOIN player_tracking_defense d
          ON d.player_id = t.player_id AND d.season = t.season
        LEFT JOIN player_awards ad
          ON ad.player_id = t.player_id AND ad.season = t.season AND ad.award = 'all_defense'
        LEFT JOIN player_awards dp
          ON dp.player_id = t.player_id AND dp.season = t.season AND dp.award = 'dpoy'
        WHERE t.mp >= %s AND t.mp IS NOT NULL AND r.poss > 0
        """,
        (MIN_MINUTES,),
    )
    return cur.fetchall()


def features(rows):
    """rows -> (season, feature dict, label) per player, rates per 100 slots.

    A "slot" is one fifth of a team possession, so these rates are five times a
    conventional per-100 figure. The scale cancels — every feature is
    standardized within its own season before it is used — and keeping it means
    the same denominator serves here and in compute_production.py.
    """
    out = []
    for (player_id, season, mp, stl, blk, drb, pf, d_fga, d_fg_pct, normal_fg_pct,
         deflections, contested, loose, charges, team_poss, team_gp,
         all_defense, dpoy_share) in rows:
        # Possessions elapsed while he was on the floor, then his one-fifth of
        # them, which is what a single player can be charged with. The fifth is
        # a constant factor and every feature is standardized within its season
        # anyway, so it changes no coefficient — it is here so that "slots"
        # means the same thing as it does in compute_production.py.
        slots = (float(mp) / 48.0) * (float(team_poss) / float(team_gp)) / 5.0
        if slots <= 0:
            continue
        per100 = lambda v: 100.0 * float(v or 0) / slots
        f = {
            "stl100": per100(stl), "blk100": per100(blk),
            "drb100": per100(drb), "pf100": per100(pf),
        }
        tracked = d_fga is not None and d_fg_pct is not None and normal_fg_pct is not None
        if tracked:
            saved = (float(normal_fg_pct) - float(d_fg_pct)) / 100.0 * float(d_fga)
            f["fg_saved100"] = 100.0 * saved / slots
            f["d_fga100"] = per100(d_fga)
        else:
            f["fg_saved100"] = f["d_fga100"] = None
        for key, v in (("deflections100", deflections), ("contested100", contested),
                       ("loose_balls100", loose), ("charges100", charges)):
            f[key] = None if v is None else per100(v)
        label = int(bool(all_defense) or float(dpoy_share) >= DPOY_LABEL_THRESHOLD)
        out.append((season, f, label, tracked))
    return out


def design(sample, cols):
    """Standardize each feature within its season; a missing value becomes 0.

    Standardizing by season is what lets one set of coefficients read a 1994
    steal rate and a 2024 one, and it means a feature nobody has that year (the
    hustle columns before 2015-16) simply contributes nothing rather than
    dragging every player the same way.
    """
    seasons = sorted({s for s, _, _, _ in sample})
    X = np.zeros((len(sample), len(cols)))
    for j, col in enumerate(cols):
        for season in seasons:
            idx = [i for i, (s, _, _, _) in enumerate(sample) if s == season]
            vals = np.array([sample[i][1][col] for i in idx], dtype=float)
            present = ~np.isnan(vals)
            if present.sum() < 5:
                continue
            mean, sd = vals[present].mean(), vals[present].std()
            if sd == 0:
                continue
            z = np.zeros(len(vals))
            z[present] = (vals[present] - mean) / sd
            X[idx, j] = z
    y = np.array([lab for _, _, lab, _ in sample], dtype=float)
    return X, y


def fit_logistic(X, y, l2=L2, iterations=30):
    """Ridge-penalized logistic regression by Newton-IRLS.

    Hand-rolled to keep scikit-learn out of requirements.txt for the sake of one
    offline script — it converges in well under ten iterations at this size.
    """
    X = np.column_stack([np.ones(len(X)), X])
    beta = np.zeros(X.shape[1])
    penalty = l2 * np.eye(X.shape[1])
    penalty[0, 0] = 0.0  # never penalize the intercept
    for _ in range(iterations):
        p = 1.0 / (1.0 + np.exp(-X @ beta))
        w = np.clip(p * (1 - p), 1e-6, None)
        gradient = X.T @ (y - p) - penalty @ beta
        hessian = (X * w[:, None]).T @ X + penalty
        step = np.linalg.solve(hessian, gradient)
        beta += step
        if np.max(np.abs(step)) < 1e-8:
            break
    return beta


def auc_by_season(sample, scores):
    out = []
    for season in sorted({s for s, _, _, _ in sample}):
        idx = [i for i, (s, _, _, _) in enumerate(sample) if s == season]
        y = np.array([sample[i][2] for i in idx])
        if y.sum() < 3 or (1 - y).sum() < 3:
            continue
        order = np.argsort(np.argsort(np.array([scores[i] for i in idx]))) + 1
        n1, n0 = y.sum(), (1 - y).sum()
        out.append((order[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))
    return float(np.mean(out))


def report(name, sample, cols):
    seasons = sorted({s for s, _, _, _ in sample})
    train = [r for r in sample if r[0] in seasons[::2]]
    test = [r for r in sample if r[0] in seasons[1::2]]
    Xtr, ytr = design(train, cols)
    Xte, _ = design(test, cols)
    beta = fit_logistic(Xtr, ytr)
    holdout = auc_by_season(test, (np.column_stack([np.ones(len(Xte)), Xte]) @ beta))

    X, y = design(sample, cols)
    full = fit_logistic(X, y)
    print(f"\n--- {name} ---")
    print(f"  player-seasons {len(sample)}, positives {int(y.sum())}")
    print(f"  holdout AUC (fit on alternate seasons) = {holdout:.3f}")
    print(f"  {name.upper()}_COEFFICIENTS = {{")
    for col, b in zip(cols, full[1:]):
        print(f'      "{col}": {b:+.4f},')
    print("  }")
    return full


def main():
    conn = connect()
    cur = conn.cursor()
    sample = features(load(cur))
    cur.close()
    conn.close()
    if not sample:
        raise SystemExit(
            "no rows — run backfill_team_ratings.py first, it supplies the "
            "possession denominator"
        )

    report("box", sample, BOX_FEATURES)
    tracked = [r for r in sample if r[3]]
    report("tracking", tracked, TRACKING_FEATURES)
    print("\nPaste both blocks into compute_production.py.")


if __name__ == "__main__":
    main()
