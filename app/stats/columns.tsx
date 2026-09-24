import type { ColumnDef } from "@/components/DataTable";
import { PlayerLink } from "@/components/PlayerLink";
import { awardKey, type Award } from "@/lib/awards";
import { TeamLink } from "@/components/TeamLink";
import { SeasonLink } from "@/components/SeasonLink";
import type { StatType } from "@/lib/stat-types";
import { formatNumber, formatPie, formatStat } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import type { getAdvancedStats, getPlayerStatsPerGame } from "@/lib/db/queries";

type BoxScoreRow = Awaited<
  ReturnType<typeof getPlayerStatsPerGame>
>["rows"][number];
type AdvancedRow = Awaited<ReturnType<typeof getAdvancedStats>>["rows"][number];

/**
 * The columns every view opens with: who, when, for whom, and how much he
 * played. Identical across the box score and the advanced table apart from the
 * minutes column, which the two label differently.
 */
function identityColumns<Row extends BoxScoreRow | AdvancedRow>(
  showSeason: boolean,
  awards: Map<string, Award[]>,
): ColumnDef<Row>[] {
  return [
    {
      key: "name",
      label: "Name",
      defaultDir: "asc",
      render: (r) => (
        <PlayerLink
          id={r.playerId}
          name={r.name}
          awards={awards.get(awardKey(r.playerId, r.season))}
        />
      ),
    },
    ...(showSeason
      ? [
          {
            key: "season",
            label: "Season",
            defaultDir: "asc" as const,
            render: (r: Row) => <SeasonLink season={r.season} />,
          },
        ]
      : []),
    {
      key: "team",
      label: "Team",
      defaultDir: "asc",
      render: (r) => <TeamLink abbr={r.team} label={r.teamLabel} />,
    },
    {
      key: "pos",
      label: "Pos",
      defaultDir: "asc",
      render: (r) => r.pos ?? "—",
    },
    {
      key: "age",
      label: "Age",
      align: "right",
      render: (r) => formatNumber(r.age),
    },
    {
      key: "gp",
      label: "GP",
      align: "right",
      render: (r) => formatNumber(r.gp),
    },
  ];
}

export function getBoxScoreColumns(
  showSeason: boolean,
  statType: StatType,
  awards: Map<string, Award[]>,
): ColumnDef<BoxScoreRow>[] {
  const mpLabel = statType === "totals" ? "MIN" : "MPG";
  // Counting stats are fractional per game but whole in a season total, so
  // "Totals" drops the decimal. Percentages are fractional either way.
  const stat = statType === "totals" ? formatNumber : formatStat;
  // The same column means different things in the two views, so the tooltip
  // has to say which one you're looking at.
  const per = statType === "totals" ? " Season total." : " Per game.";
  const note = (key: string) => (GLOSSARY[key] ?? "") + per;
  return [
    ...identityColumns<BoxScoreRow>(showSeason, awards),
    {
      key: "gs",
      label: "GS",
      align: "right",
      render: (r) => formatNumber(r.gs),
    },
    // Minutes are the one counting stat that's fractional in a season total:
    // nba_api reports them to hundredths (3126.87) while the pre-96 bref rows are
    // whole (3533), so the column rendered ragged — two decimals some years, none
    // in others. It takes formatStat in both modes rather than following `stat`.
    {
      key: "mp",
      label: mpLabel,
      align: "right",
      render: (r) => formatStat(r.mp),
    },
    {
      key: "fgm",
      description: note("fgm"),
      label: "FGM",
      align: "right",
      render: (r) => stat(r.fgm),
    },
    {
      key: "fga",
      description: note("fga"),
      label: "FGA",
      align: "right",
      render: (r) => stat(r.fga),
    },
    {
      key: "fgPct",
      label: "FG%",
      align: "right",
      render: (r) => formatStat(r.fgPct),
    },
    {
      key: "fg3m",
      description: note("fg3m"),
      label: "3PM",
      align: "right",
      render: (r) => stat(r.fg3m),
    },
    {
      key: "fg3a",
      description: note("fg3a"),
      label: "3PA",
      align: "right",
      render: (r) => stat(r.fg3a),
    },
    {
      key: "fg3Pct",
      label: "3P%",
      align: "right",
      render: (r) => formatStat(r.fg3Pct),
    },
    {
      key: "fg2m",
      description: note("fg2m"),
      label: "2PM",
      align: "right",
      render: (r) => stat(r.fg2m),
    },
    {
      key: "fg2a",
      description: note("fg2a"),
      label: "2PA",
      align: "right",
      render: (r) => stat(r.fg2a),
    },
    {
      key: "fg2Pct",
      label: "2P%",
      align: "right",
      render: (r) => formatStat(r.fg2Pct),
    },
    {
      key: "efgPct",
      label: "eFG%",
      align: "right",
      render: (r) => formatStat(r.efgPct),
    },
    {
      key: "ftm",
      description: note("ftm"),
      label: "FTM",
      align: "right",
      render: (r) => stat(r.ftm),
    },
    {
      key: "fta",
      description: note("fta"),
      label: "FTA",
      align: "right",
      render: (r) => stat(r.fta),
    },
    {
      key: "ftPct",
      label: "FT%",
      align: "right",
      render: (r) => formatStat(r.ftPct),
    },
    {
      key: "orb",
      description: note("orb"),
      label: "OREB",
      align: "right",
      render: (r) => stat(r.orb),
    },
    {
      key: "drb",
      description: note("drb"),
      label: "DREB",
      align: "right",
      render: (r) => stat(r.drb),
    },
    {
      key: "reb",
      description: note("reb"),
      label: "REB",
      align: "right",
      render: (r) => stat(r.reb),
    },
    {
      key: "ast",
      description: note("ast"),
      label: "AST",
      align: "right",
      render: (r) => stat(r.ast),
    },
    {
      key: "stl",
      description: note("stl"),
      label: "STL",
      align: "right",
      render: (r) => stat(r.stl),
    },
    {
      key: "blk",
      description: note("blk"),
      label: "BLK",
      align: "right",
      render: (r) => stat(r.blk),
    },
    {
      key: "tov",
      description: note("tov"),
      label: "TOV",
      align: "right",
      render: (r) => stat(r.tov),
    },
    {
      key: "pf",
      description: note("pf"),
      label: "PF",
      align: "right",
      render: (r) => stat(r.pf),
    },
    {
      key: "pts",
      description: note("pts"),
      label: "PTS",
      align: "right",
      render: (r) => stat(r.pts),
    },
  ];
}

export function getAdvancedColumns(
  showSeason: boolean,
  awards: Map<string, Award[]>,
): ColumnDef<AdvancedRow>[] {
  return [
    ...identityColumns<AdvancedRow>(showSeason, awards),
    {
      key: "mp",
      label: "MP",
      align: "right",
      description: "Minutes played. Season total.",
      render: (r) => formatNumber(r.mp),
    },

    // --- basketball-reference's box-score formulas ---
    {
      key: "per",
      label: "PER",
      align: "right",
      render: (r) => formatStat(r.per),
    },
    // nba.com's figure where there is one, bref's for the pre-1996-97 seasons
    // it never covered. The glossary entries name both sources.
    {
      key: "tsPct",
      label: "TS%",
      align: "right",
      render: (r) => formatStat(r.nbaTsPct ?? r.tsPct),
    },
    {
      key: "usgPct",
      label: "USG%",
      align: "right",
      render: (r) => formatStat(r.nbaUsgPct ?? r.usgPct),
    },
    {
      key: "ows",
      label: "OWS",
      align: "right",
      render: (r) => formatStat(r.ows),
    },
    {
      key: "dws",
      label: "DWS",
      align: "right",
      render: (r) => formatStat(r.dws),
    },
    { key: "ws", label: "WS", align: "right", render: (r) => formatStat(r.ws) },
    {
      key: "obpm",
      label: "OBPM",
      align: "right",
      render: (r) => formatStat(r.obpm),
    },
    {
      key: "dbpm",
      label: "DBPM",
      align: "right",
      render: (r) => formatStat(r.dbpm),
    },
    {
      key: "bpm",
      label: "BPM",
      align: "right",
      render: (r) => formatStat(r.bpm),
    },
    {
      key: "vorp",
      label: "VORP",
      align: "right",
      render: (r) => formatStat(r.vorp),
    },

    // --- nba.com's possession-based numbers, 1996-97 on ---
    // Everything past this point reads "—" for the 2,771 earlier seasons that
    // predate play-by-play, which is why the block is kept contiguous rather
    // than filed among the bref columns it resembles.
    {
      key: "poss",
      label: "POSS",
      align: "right",
      render: (r) => formatNumber(r.poss),
    },
    {
      key: "offRating",
      label: "ORtg",
      align: "right",
      render: (r) => formatStat(r.offRating),
    },
    {
      key: "defRating",
      label: "DRtg",
      // Fewer points allowed is better, so this is the one rating whose first
      // click should sort upward.
      defaultDir: "asc",
      align: "right",
      render: (r) => formatStat(r.defRating),
    },
    {
      key: "netRating",
      label: "NetRtg",
      align: "right",
      render: (r) => formatStat(r.netRating),
    },
    {
      key: "astPct",
      label: "AST%",
      align: "right",
      render: (r) => formatStat(r.astPct),
    },
    {
      key: "astTo",
      label: "AST/TO",
      align: "right",
      render: (r) => formatStat(r.astTo),
    },
    {
      key: "orebPct",
      label: "OREB%",
      align: "right",
      render: (r) => formatStat(r.orebPct),
    },
    {
      key: "drebPct",
      label: "DREB%",
      align: "right",
      render: (r) => formatStat(r.drebPct),
    },
    {
      key: "rebPct",
      label: "REB%",
      align: "right",
      render: (r) => formatStat(r.rebPct),
    },
    {
      key: "tovPct",
      label: "TOV%",
      // Turnovers are the other column where low is good.
      defaultDir: "asc",
      align: "right",
      render: (r) => formatStat(r.tovPct),
    },
    {
      key: "efgPct",
      label: "eFG%",
      align: "right",
      render: (r) => formatStat(r.efgPct),
    },
    {
      key: "pace",
      label: "PACE",
      align: "right",
      render: (r) => formatStat(r.pace),
    },
    {
      key: "pie",
      label: "PIE",
      align: "right",
      render: (r) => formatPie(r.pie),
    },
  ];
}
