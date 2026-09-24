"""Computes what every player produced, and rewrites the player_production table.

    Production  =  the points his team actually generated above league average,
                   the share of them that was his, expressed on VORP's scale

WHY THIS WAY ROUND

A box-score metric (VORP, PER, BPM) estimates a player from his own counting
stats and hopes a roster adds up to the team. This starts from the team, whose
offensive and defensive points above league average are not in doubt — they are
arithmetic on `team_season_ratings` — and splits them between the players. The
total is therefore never wrong. The whole modeling problem becomes the split,
which is the honest place for the uncertainty to sit.

The reason for the change was defense. VORP is built on BPM, which sees defense
through steals, blocks and defensive rebounds, and those three columns describe
a rim protector adequately and a wing not at all. Rudy Gobert anchored the
league's best defense in 2023-24 and VORP gave him 2.5 — worse than his backup
center's pay would suggest — because his value does not appear in a box score.
Here he gets a share of a defense that actually was 8 points per 100 better
than the league, and prices out where watching the games would put him.

THE OFFENSIVE SPLIT is box credit, which the box score is genuinely good at:
shooting efficiency above league average on the player's own volume, playmaking,
turnovers, offensive rebounds. The one correction it needs is for who created
the shot — see ASSISTED_CREDIT_SHARE.

THE DEFENSIVE SPLIT is minutes, tilted by the defensive-quality model in
DEFENSE_*_COEFFICIENTS. Minutes carry most of the weight deliberately: team
defense is a team activity, and a scheme's results belong substantially to the
five men running it. The tilt is what separates the anchor from the passenger,
and it is fitted to All-Defensive voting because no free data says who defended
well — see fit_defense_model.py, which also explains why the wins test cannot
settle this and the voting record has to.

WHAT THIS DELIBERATELY DOES NOT DO

Tracking data (2013-14 onward) makes the defensive tilt far sharper, and is used
only for the tilt — never to change the size of what is being split. A season
with cameras and a season without therefore stay on one scale, which is what
lets a 1991 bargain and a 2026 bargain be compared at all.

SCALE. Read like VORP: replacement level is -2.0 points per 100 possessions, and
the figure is scaled by the share of the team's floor time the player was on for
and by the season's length. A roster sums to its team's net rating plus 10.
Against team wins over 1,056 team-seasons it runs r = 0.967 at level and 0.924
on year-over-year change, where VORP manages 0.954 and 0.904.

Idempotent: truncates and rewrites, so re-running cannot double-count.

Usage:
  python compute_production.py
  python compute_production.py 2024-2025      # one season
"""
import math
import sys

from psycopg2.extras import execute_values

from db import connect

# Replacement level, in points per 100 possessions below league average. -2.0 is
# the convention BPM and VORP use, kept so the two are readable side by side.
REPLACEMENT = -2.0

# Whether each half's credits are baselined against the player's own position
# or against the league. See the centering step in compute() for why they differ.
CENTER_OFFENSE_BY_POSITION = True
CENTER_DEFENSE_BY_POSITION = False

# How much of the efficiency credit for an assisted basket belongs to the passer.
#
# Without this the model reads a lob finisher as an elite offensive player: a
# center shooting 70% on shots created entirely by team-mates collects the full
# credit for that efficiency. At 0.45, Ivica Zubac, Jalen Duren and Luke Kornet
# drop out of a season's top fifteen, which is where they should not have been.
# The passer is separately paid through POINTS_PER_ASSIST.
ASSISTED_CREDIT_SHARE = 0.45

# Where the scoring splits don't reach (pre-1996-97), the league's own average
# assisted share stands in. A fixed value covers the case where even that is
# unknown, which in practice is only a season with no scoring data at all.
DEFAULT_ASSISTED_SHARE = 0.55

# Points of expected value per event, for the credits a box score can support.
# Offense:
#
# POINTS_PER_ASSIST was 0.70, taken from the published estimates rather than
# fitted, and it was too generous by enough to distort the all-time list: John
# Stockton took four of the eight best Net Value seasons ever recorded, on the
# strength of ~1,100 assists a year earning him ~770 points of credit before
# anything else happened. His defensive credit was ordinary throughout, so the
# artifact was entirely here.
#
# Chosen by sweeping it against the two tests that can see the offensive split
# — how well production identifies All-NBA selections, and how it tracks MVP
# voting. (Team wins cannot: the metric is anchored to each team's own rating,
# so the wins correlation sits at 0.967 whatever this is set to.)
#
#   0.70   AUC 0.949   rho 0.425   Stockton x4 in the top eight
#   0.55   AUC 0.948   rho 0.422   Paul, Paul, James, Robinson, Kirilenko...
#   0.45   AUC 0.944   rho 0.416   defenders start to crowd the top
#   0.35   AUC 0.936   rho 0.407   Rodman and Ben Wallace in the top five
#
# 0.55 costs essentially nothing measurable and fixes the face-validity
# problem; below it the list tips into the opposite error, where defensive
# specialists dominate a list that should be mostly stars on rookie deals.
POINTS_PER_ASSIST = 0.55

# What a possession taken on is worth, above what an average player would have
# used in the same floor time, before any question of how well it was used.
#
# Without this, shooting is credited purely as efficiency ABOVE league average
# times volume, so 1,445 shots at exactly league-average efficiency earn
# precisely nothing. That buries high-usage creators and inflates efficient
# finishers living on shots other people made for them. Curry is the clean
# case: his edge over the league fell from +0.115 TS% in 2015-16 to +0.041 by
# 2023-24 as the league caught up, and his offensive rate collapsed from 8.02
# to 1.77 per 100 while bref's OBPM — which does pay for usage — held at 6.3.
#
# Swept against All-NBA identification and MVP voting, the two tests that can
# see the offensive split (team wins cannot: the metric is anchored to each
# team's rating, so that correlation stays at 0.967 throughout):
#
#   0.00   AllNBA 0.948   MVP 0.422   AllDef 0.861
#   0.05   AllNBA 0.960   MVP 0.433   AllDef 0.853
#   0.10   AllNBA 0.968   MVP 0.440   AllDef 0.844
#   0.15   AllNBA 0.973   MVP 0.445   AllDef 0.833
#   VORP   AllNBA 0.963   MVP 0.440   AllDef 0.849
#
# The gain does not stop climbing, which is the tell that the term is partly
# proxying "is a star" — voters reward usage. So it is capped by what the
# usage-efficiency literature supports rather than by what the tests like, and
# 0.10 is the top of that range while still beating VORP on both.
#
# The All-Defense figure falls because crediting offense more pushes defenders
# down a ranking of TOTAL production. The defensive model is untouched by this
# constant, and `def_quality` does not move at all.
POINTS_PER_POSSESSION_USED = 0.10
POINTS_PER_OREB = 0.75      # a fresh possession, net of the team-mate who'd
                            # otherwise have collected it
# Defense:
POINTS_PER_STEAL = 1.40     # a possession taken, plus what transition is worth
POINTS_PER_BLOCK = 0.70     # a possession ended, less the ones the offense keeps
POINTS_PER_DREB = 0.30      # above what a team-mate would have rebounded anyway
POINTS_PER_FOUL = -0.40

# How hard defensive quality tilts a player's share of the team's defense.
#
# The weight is minutes x exp(GAMMA x z), so 0.35 moves a defender one standard
# deviation above his peers to about 1.4x his minutes-share of the credit, and
# one below to about 0.7x. Higher values were tested: they change the ordering
# very little and start to misbehave at the edges, where a low-minute player
# with a freak rate takes an implausible slice of a team's season.
GAMMA = 0.35

# Fitted by fit_defense_model.py against All-Defensive selections and DPOY vote
# shares, 1990-91 onward. Features are standardized within each season, so these
# read as "standard deviations of defensive reputation per standard deviation of
# the stat" and are era-neutral by construction.
#
# Holdout AUC for identifying that season's All-Defensive selections, fitted on
# alternate seasons and scored on the ones held out: 0.885 for the box set,
# 0.920 once the cameras are looking. The gap is the whole reason the tracking
# tables exist.
DEFENSE_BOX_COEFFICIENTS = {
    "stl100": +1.0210,
    "blk100": +0.8587,
    "drb100": +0.6827,
    "pf100": -1.1689,
}

# fg_saved100 — baskets prevented against what the same shooters manage against
# everyone else — carries more weight here than any box column, which is the
# finding in one line: the thing that identifies a defender is not in a box
# score. d_fga100 is faintly negative, so being targeted often is a small mark
# against a man once you know how well he did when targeted.
DEFENSE_TRACKING_COEFFICIENTS = {
    "stl100": +0.9942,
    "blk100": +0.4999,
    "drb100": +0.3526,
    "pf100": -0.8140,
    "fg_saved100": +1.1734,
    "d_fga100": -0.0869,
    "deflections100": +0.0981,
    "contested100": +0.0643,
    "loose_balls100": +0.1653,
    "charges100": +0.1176,
}

COLUMNS = [
    "team", "minutes", "floor_share", "off_points", "def_points",
    "off_per100", "def_per100", "impact_per100", "def_quality", "def_tracked",
    "production", "source",
]


def load_players(cur, season_filter):
    """Every player-season with minutes, its team's ratings, and the extras.

    The team join goes through team_aliases so that a stat line filed under WSB,
    SEA or VAN finds the franchise that team_season_ratings knows as WAS, OKC or
    MEM. A LEFT JOIN on the ratings keeps the pre-1997 multi-team rows, whose
    team is NULL and which are priced against the league instead.
    """
    sql = """
        SELECT t.player_id, t.season, t.team, t.mp, t.gp,
               t.fga, t.fta, t.pts, t.ast, t.tov, t.orb, t.drb, t.stl, t.blk, t.pf,
               COALESCE(al.team_id, te.id) AS team_id,
               r.poss AS team_poss, r.gp AS team_gp,
               r.off_rating, r.def_rating,
               t.pos,
               s.pct_ast_fgm,
               d.d_fga, d.d_fg_pct, d.normal_fg_pct, d.deflections,
               d.contested_shots, d.loose_balls_recovered, d.charges_drawn
        FROM player_stats_totals t
        LEFT JOIN teams te ON te.abbr = t.team
        LEFT JOIN team_aliases al ON al.alias = t.team
        LEFT JOIN team_season_ratings r
               ON r.team_id = COALESCE(al.team_id, te.id) AND r.season = t.season
        LEFT JOIN player_scoring_splits s
               ON s.player_id = t.player_id AND s.season = t.season
        LEFT JOIN player_tracking_defense d
               ON d.player_id = t.player_id AND d.season = t.season
        WHERE t.mp IS NOT NULL AND t.mp > 0
    """
    params = []
    if season_filter:
        sql += " AND t.season = %s"
        params.append(season_filter)
    cur.execute(sql, params)
    cols = [c.name for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def load_league_ratings(cur, season_filter):
    """Possession-weighted league average rating per season — the zero point."""
    sql = """
        SELECT season,
               SUM(off_rating * poss) / SUM(poss),
               SUM(def_rating * poss) / SUM(poss),
               SUM(poss), MAX(gp), SUM(gp), COUNT(*)
        FROM team_season_ratings
        WHERE poss > 0
    """
    params = []
    if season_filter:
        sql += " AND season = %s"
        params.append(season_filter)
    cur.execute(sql + " GROUP BY season", params)
    return {
        season: {
            "off": float(off), "def": float(deff),
            "poss": float(poss), "gp": int(gp),
            # Possessions in an average team-game, and in an average team's
            # season — the stand-ins used for a player with no team on file.
            "poss_per_game": float(poss) / float(team_games),
            "poss_per_team": float(poss) / float(team_count),
        }
        for season, off, deff, poss, gp, team_games, team_count in cur.fetchall()
    }


def f(x, default=0.0):
    return default if x is None else float(x)


def add_usage(players, league):
    """Attach floor share, possessions and the per-100 denominators.

    A player's share of his team's floor time is measured against the ROSTER's
    own minutes rather than against games x 48 x 5. Those differ whenever
    someone was traded, because these sources file a traded player's whole
    season under one team, so a roster that gained him has more minutes on the
    books than it really played and one that lost him has fewer.

    Normalising against the roster is what keeps a team's credits summing to
    exactly what the team did. Measuring each player's possessions
    independently, from minutes and the team's pace, is closer to his true
    on-court possession count but leaves the roster summing to something
    slightly other than the team — up to three points of production adrift on
    the worst-affected teams, which quietly breaks the one guarantee this model
    makes.

    `poss` is then the possessions that elapsed while he was on the floor, and
    `slots` his fifth of them: the most any one of the five men out there can be
    charged with, and the denominator every rate in this file uses.
    """
    by_team = {}
    unattached = []
    for p in players:
        if p.get("team_poss") and p.get("team_id"):
            by_team.setdefault((p["season"], p["team_id"]), []).append(p)
        else:
            unattached.append(p)

    for roster in by_team.values():
        roster_minutes = sum(f(x["mp"]) for x in roster) or 1.0
        team_poss = float(roster[0]["team_poss"])
        for p in roster:
            p["floor_share"] = f(p["mp"]) / roster_minutes
            p["on_floor"] = 5.0 * p["floor_share"]
            p["poss"] = p["on_floor"] * team_poss
            p["slots"] = p["poss"] / 5.0
            p["games"] = min(int(p["team_gp"]), 82)

    for p in unattached:
        # A stat line naming no team: the pre-1997 multi-team rows. There is no
        # roster to measure him against, so he is placed on a league-average one.
        lg = league[p["season"]]
        p["on_floor"] = f(p["mp"]) / (48.0 * lg["gp"])
        p["floor_share"] = p["on_floor"] / 5.0
        p["poss"] = p["on_floor"] * lg["poss_per_team"]
        p["slots"] = p["poss"] / 5.0
        p["games"] = lg["gp"]

    return by_team, unattached


def league_constants(players):
    """Per-season league rates, all against the same `slots` denominator."""
    out = {}
    for p in players:
        s = out.setdefault(
            p["season"],
            {k: 0.0 for k in
             ("pts", "tsa", "tov", "orb", "drb", "stl", "blk", "pf", "slots",
              "ast_fgm_w", "ast_fgm_n")},
        )
        tsa = f(p["fga"]) + 0.44 * f(p["fta"])
        s["pts"] += f(p["pts"])
        s["tsa"] += tsa
        for k in ("tov", "orb", "drb", "stl", "blk", "pf"):
            s[k] += f(p[k])
        s["slots"] += p["slots"]
        if p["pct_ast_fgm"] is not None:
            s["ast_fgm_w"] += float(p["pct_ast_fgm"]) / 100.0
            s["ast_fgm_n"] += 1

    constants = {}
    for season, s in out.items():
        slots = s["slots"] or 1.0
        constants[season] = {
            "ts": s["pts"] / (2 * s["tsa"]) if s["tsa"] else 0.0,
            # A possession is worth this much, which is what a turnover costs.
            "ppp": s["pts"] / slots,
            "tov_rate": s["tov"] / (s["tsa"] + s["tov"]) if (s["tsa"] + s["tov"]) else 0.0,
            "used_rate": (s["tsa"] + s["tov"]) / slots,
            "orb_rate": s["orb"] / slots,
            "drb_rate": s["drb"] / slots,
            "stl_rate": s["stl"] / slots,
            "blk_rate": s["blk"] / slots,
            "pf_rate": s["pf"] / slots,
            "assisted": (s["ast_fgm_w"] / s["ast_fgm_n"]) if s["ast_fgm_n"]
                        else DEFAULT_ASSISTED_SHARE,
        }
    return constants


def offense_credit(p, lg):
    """Points above a league-average player, from what a box score can support.

    Shooting is the big term: points scored, less what an average shooter would
    have scored on the same attempts. It is scaled by how much of the efficiency
    the player generated himself, because credit for a basket someone else
    created belongs partly to whoever created it.

    Turnovers are charged against what an average player would have committed on
    the same workload, not against zero — everyone turns it over.
    """
    tsa = f(p["fga"]) + 0.44 * f(p["fta"])
    ts = (f(p["pts"]) / (2 * tsa)) if tsa > 0 else lg["ts"]
    assisted = (float(p["pct_ast_fgm"]) / 100.0 if p["pct_ast_fgm"] is not None
                else lg["assisted"])
    shooting = 2 * tsa * (ts - lg["ts"]) * (1.0 - ASSISTED_CREDIT_SHARE * assisted)

    used = tsa + f(p["tov"])
    turnovers = -lg["ppp"] * (f(p["tov"]) - lg["tov_rate"] * used)
    assists = POINTS_PER_ASSIST * f(p["ast"])
    rebounds = POINTS_PER_OREB * (f(p["orb"]) - lg["orb_rate"] * p["slots"])
    # Taking the shot is worth something even at ordinary efficiency, because
    # someone has to, and the alternative is a team-mate doing it worse.
    creation = POINTS_PER_POSSESSION_USED * (used - lg["used_rate"] * p["slots"])
    return shooting + turnovers + assists + rebounds + creation


def defense_credit(p, lg):
    """The part of defense a box score can support, against the same baselines."""
    return (
        POINTS_PER_STEAL * (f(p["stl"]) - lg["stl_rate"] * p["slots"])
        + POINTS_PER_BLOCK * (f(p["blk"]) - lg["blk_rate"] * p["slots"])
        + POINTS_PER_DREB * (f(p["drb"]) - lg["drb_rate"] * p["slots"])
        + POINTS_PER_FOUL * (f(p["pf"]) - lg["pf_rate"] * p["slots"])
    )


def defense_features(p):
    """The inputs to the defensive-quality model, per 100 slots.

    Returns (features, tracked). `tracked` decides which coefficient set reads
    them, since the tracking columns only exist from 2013-14.
    """
    slots = p["slots"] or 1.0
    per100 = lambda v: 100.0 * f(v) / slots
    feats = {
        "stl100": per100(p["stl"]), "blk100": per100(p["blk"]),
        "drb100": per100(p["drb"]), "pf100": per100(p["pf"]),
    }
    tracked = (
        p["d_fga"] is not None
        and p["d_fg_pct"] is not None
        and p["normal_fg_pct"] is not None
    )
    if tracked:
        # Baskets prevented: how much worse the men he guarded shot against him
        # than they shoot in general, over the shots he actually defended.
        saved = (float(p["normal_fg_pct"]) - float(p["d_fg_pct"])) / 100.0 * float(p["d_fga"])
        feats["fg_saved100"] = 100.0 * saved / slots
        feats["d_fga100"] = per100(p["d_fga"])
    for key, col in (("deflections100", "deflections"), ("contested100", "contested_shots"),
                     ("loose_balls100", "loose_balls_recovered"), ("charges100", "charges_drawn")):
        if p[col] is not None:
            feats[key] = per100(p[col])
    return feats, tracked


def standardize(players, keys):
    """Within-season z-scores. A stat a season doesn't have contributes nothing."""
    by_season = {}
    for p in players:
        by_season.setdefault(p["season"], []).append(p)
    for season, group in by_season.items():
        for key in keys:
            vals = [p["features"][key] for p in group if key in p["features"]]
            if len(vals) < 5:
                continue
            mean = sum(vals) / len(vals)
            sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))
            if sd == 0:
                continue
            for p in group:
                if key in p["features"]:
                    p["z"][key] = (p["features"][key] - mean) / sd


def defensive_quality(players):
    """Score every player, then re-standardize the score within its season.

    The score is only ever used to rank players against their own team-mates in
    the same season, so its absolute level means nothing and being a z-score
    makes GAMMA readable as "per standard deviation".
    """
    all_keys = set(DEFENSE_BOX_COEFFICIENTS) | set(DEFENSE_TRACKING_COEFFICIENTS)
    for p in players:
        p["features"], p["tracked"] = defense_features(p)
        p["z"] = {}
    standardize(players, all_keys)

    for p in players:
        coefficients = (DEFENSE_TRACKING_COEFFICIENTS if p["tracked"]
                        else DEFENSE_BOX_COEFFICIENTS)
        p["raw_quality"] = sum(b * p["z"].get(k, 0.0) for k, b in coefficients.items())

    by_season = {}
    for p in players:
        by_season.setdefault(p["season"], []).append(p)
    for group in by_season.values():
        vals = [p["raw_quality"] for p in group]
        mean = sum(vals) / len(vals)
        sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals)) or 1.0
        for p in group:
            p["quality"] = (p["raw_quality"] - mean) / sd


def spread(players, raw_key, target, weight_key):
    """Move everyone by the same rate so the group's credits sum to `target`.

    This is the team adjustment. Whatever the box credits miss — and on defense
    they miss most of it — lands here, apportioned by `weight_key`, so the team's
    demonstrated performance is fully distributed and nothing is invented.
    """
    total_raw = sum(p[raw_key] for p in players)
    total_weight = sum(p[weight_key] for p in players)
    if total_weight <= 0:
        return {id(p): p[raw_key] for p in players}
    gap = target - total_raw
    return {
        id(p): p[raw_key] + gap * p[weight_key] / total_weight
        for p in players
    }


def compute(players, league):
    """players -> rows for player_production."""
    for p in players:
        p["pos_group"] = (p.get("pos") or "?")[:2]
    by_team, unattached = add_usage(players, league)
    constants = league_constants(players)
    defensive_quality(players)

    for p in players:
        lg = constants[p["season"]]
        p["off_raw"] = offense_credit(p, lg)
        p["def_raw"] = defense_credit(p, lg)

    # Center both credits so that league-wide they sum to zero before any team
    # adjustment. Otherwise a systematically generous coefficient would inflate
    # every team's box total and the adjustment would quietly claw it back.
    # Set the zero point for each half of the credit — and do it differently
    # for the two halves, because the positional bias is spurious on one side
    # and real on the other.
    #
    # OFFENSE is baselined within position. Against a league-wide baseline the
    # offensive credits measure position far more than skill, and rebounds are
    # the worst of it: a center collects them because he is standing there, and
    # charging him against an average that includes point guards paid him about
    # 20 points per 100 for his job description. The whole center-minus-guard
    # gap came to +3.43 points per 100 — bref's BPM, which makes its own
    # positional adjustment, runs about +0.4 — and it filled the top of every
    # season with backup centers on rookie deals.
    #
    # DEFENSE is baselined against the league, because there the positional
    # difference is the point. Rim protection is worth more than perimeter
    # defense and is scarcer, and centering it away says a good defensive center
    # is worth no more than a good defensive guard. Tried both ways: centering
    # defense by position too sends Rudy Gobert's 2023-24 from 95th to 399th,
    # which is the exact failure this model was built to fix.
    #
    # Measured over all 36 seasons, offense-only centering is the best of the
    # three on the defensive test and close to the best on the offensive ones:
    #
    #                        AllNBA  AllDef   MVP   C-minus-guard  Gobert 23-24
    #   league / league       0.968   0.844  0.440     +3.43          32nd
    #   position / position   0.972   0.846  0.444     +0.18         399th
    #   position / league     0.971   0.849  0.441     +1.68          95th
    #
    # The team adjustment below still sets the levels, so this only decides who
    # gets the credit, never how much there is to give.
    #
    # `pos` is the one thing in this pipeline still sourced from bref, via
    # backfill_bref_stats.py, and it covers 99.6% of player-seasons. It is a
    # position label rather than a computed stat, and nba_api's
    # commonplayerinfo could supply it per-player if the bref dependency ever
    # has to go. Anyone missing one falls into a bucket of his own, which
    # amounts to being centered against the other unknowns.
    for key, by_position in (("off_raw", CENTER_OFFENSE_BY_POSITION),
                             ("def_raw", CENTER_DEFENSE_BY_POSITION)):
        groups = {}
        for p in players:
            bucket = (p["season"], p["pos_group"] if by_position else None)
            groups.setdefault(bucket, []).append(p)
        for group in groups.values():
            slots = sum(p["slots"] for p in group) or 1.0
            rate = sum(p[key] for p in group) / slots
            for p in group:
                p[key] -= rate * p["slots"]


    for (season, _), roster in by_team.items():
        lg = league[season]
        team_poss = float(roster[0]["team_poss"])
        off_above = (float(roster[0]["off_rating"]) - lg["off"]) * team_poss / 100.0
        def_above = (lg["def"] - float(roster[0]["def_rating"])) * team_poss / 100.0

        for p in roster:
            p["def_weight"] = p["poss"] * math.exp(GAMMA * p["quality"])
        off = spread(roster, "off_raw", off_above, "poss")
        deff = spread(roster, "def_raw", def_above, "def_weight")
        for p in roster:
            p["off_points"] = off[id(p)]
            p["def_points"] = deff[id(p)]
            p["source"] = "team_anchored"

    for p in unattached:
        # No team, so no share of anyone's surplus: he is credited with his own
        # box line against the league and nothing else.
        p["off_points"] = p["off_raw"]
        p["def_points"] = p["def_raw"]
        p["source"] = "league_average"

    rows = []
    for p in players:
        points = p["off_points"] + p["def_points"]
        per100 = lambda v: 100.0 * v / p["poss"] if p["poss"] else 0.0
        impact = per100(points)
        production = (impact - REPLACEMENT) * p["on_floor"] * (p["games"] / 82.0)
        rows.append(
            (
                p["player_id"], p["season"], p["team"],
                round(f(p["mp"]), 1), round(p["floor_share"], 5),
                round(p["off_points"], 2), round(p["def_points"], 2),
                round(per100(p["off_points"]), 2), round(per100(p["def_points"]), 2),
                round(impact, 2), round(p["quality"], 3), bool(p["tracked"]),
                round(production, 3), p["source"],
            )
        )
    return rows


def main():
    if not DEFENSE_BOX_COEFFICIENTS:
        raise SystemExit(
            "DEFENSE_BOX_COEFFICIENTS is empty — run fit_defense_model.py and "
            "paste its output in"
        )

    season_filter = sys.argv[1] if len(sys.argv) > 1 else None
    conn = connect()
    cur = conn.cursor()

    league = load_league_ratings(cur, season_filter)
    players = [p for p in load_players(cur, season_filter) if p["season"] in league]
    rows = compute(players, league)

    if season_filter:
        cur.execute("DELETE FROM player_production WHERE season = %s", (season_filter,))
    else:
        cur.execute("TRUNCATE player_production RESTART IDENTITY")
    execute_values(
        cur,
        f"INSERT INTO player_production (player_id, season, {', '.join(COLUMNS)}) VALUES %s",
        rows,
        page_size=1000,
    )
    conn.commit()
    cur.close()
    conn.close()

    seasons = sorted({r[1] for r in rows})
    print(f"wrote {len(rows)} player-seasons, {seasons[0]} .. {seasons[-1]}")


if __name__ == "__main__":
    main()
