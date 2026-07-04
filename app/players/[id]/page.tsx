import { notFound } from "next/navigation";
import { SimpleTable } from "@/components/SimpleTable";
import type { ColumnDef } from "@/components/DataTable";
import { formatNumber, formatCurrency, formatPercent } from "@/lib/format";
import {
  getPlayerById,
  getPlayerCareerStatsTotals,
  getPlayerCareerStatsPerGame,
  getPlayerCareerAdvancedStats,
  getPlayerCareerSalaries,
} from "@/lib/db/queries";

type StatsRow = Awaited<ReturnType<typeof getPlayerCareerStatsPerGame>>[number];
type AdvRow = Awaited<ReturnType<typeof getPlayerCareerAdvancedStats>>[number];
type SalRow = Awaited<ReturnType<typeof getPlayerCareerSalaries>>[number];

const statsColumns: ColumnDef<StatsRow>[] = [
  { key: "season", label: "Season", render: (r) => r.season },
  { key: "team", label: "Team", render: (r) => r.team ?? "—" },
  { key: "pos", label: "Pos", render: (r) => r.pos ?? "—" },
  { key: "age", label: "Age", align: "right", render: (r) => formatNumber(r.age) },
  { key: "gp", label: "GP", align: "right", render: (r) => formatNumber(r.gp) },
  { key: "gs", label: "GS", align: "right", render: (r) => formatNumber(r.gs) },
  { key: "mp", label: "MP", align: "right", render: (r) => formatNumber(r.mp) },
  { key: "fgm", label: "FGM", align: "right", render: (r) => formatNumber(r.fgm) },
  { key: "fga", label: "FGA", align: "right", render: (r) => formatNumber(r.fga) },
  { key: "fgPct", label: "FG%", align: "right", render: (r) => formatNumber(r.fgPct) },
  { key: "fg3m", label: "3PM", align: "right", render: (r) => formatNumber(r.fg3m) },
  { key: "fg3a", label: "3PA", align: "right", render: (r) => formatNumber(r.fg3a) },
  { key: "fg3Pct", label: "3P%", align: "right", render: (r) => formatNumber(r.fg3Pct) },
  { key: "fg2m", label: "2PM", align: "right", render: (r) => formatNumber(r.fg2m) },
  { key: "fg2a", label: "2PA", align: "right", render: (r) => formatNumber(r.fg2a) },
  { key: "fg2Pct", label: "2P%", align: "right", render: (r) => formatNumber(r.fg2Pct) },
  { key: "efgPct", label: "eFG%", align: "right", render: (r) => formatNumber(r.efgPct) },
  { key: "ftm", label: "FTM", align: "right", render: (r) => formatNumber(r.ftm) },
  { key: "fta", label: "FTA", align: "right", render: (r) => formatNumber(r.fta) },
  { key: "ftPct", label: "FT%", align: "right", render: (r) => formatNumber(r.ftPct) },
  { key: "orb", label: "OREB", align: "right", render: (r) => formatNumber(r.orb) },
  { key: "drb", label: "DREB", align: "right", render: (r) => formatNumber(r.drb) },
  { key: "reb", label: "REB", align: "right", render: (r) => formatNumber(r.reb) },
  { key: "ast", label: "AST", align: "right", render: (r) => formatNumber(r.ast) },
  { key: "stl", label: "STL", align: "right", render: (r) => formatNumber(r.stl) },
  { key: "blk", label: "BLK", align: "right", render: (r) => formatNumber(r.blk) },
  { key: "tov", label: "TOV", align: "right", render: (r) => formatNumber(r.tov) },
  { key: "pf", label: "PF", align: "right", render: (r) => formatNumber(r.pf) },
  { key: "pts", label: "PTS", align: "right", render: (r) => formatNumber(r.pts) },
];

const advancedColumns: ColumnDef<AdvRow>[] = [
  { key: "season", label: "Season", render: (r) => r.season },
  { key: "team", label: "Team", render: (r) => r.team ?? "—" },
  { key: "pos", label: "Pos", render: (r) => r.pos ?? "—" },
  { key: "age", label: "Age", align: "right", render: (r) => formatNumber(r.age) },
  { key: "gp", label: "GP", align: "right", render: (r) => formatNumber(r.gp) },
  { key: "mp", label: "MP", align: "right", render: (r) => formatNumber(r.mp) },
  { key: "per", label: "PER", align: "right", render: (r) => formatNumber(r.per) },
  { key: "tsPct", label: "TS%", align: "right", render: (r) => formatNumber(r.tsPct) },
  { key: "usgPct", label: "USG%", align: "right", render: (r) => formatNumber(r.usgPct) },
  { key: "ows", label: "OWS", align: "right", render: (r) => formatNumber(r.ows) },
  { key: "dws", label: "DWS", align: "right", render: (r) => formatNumber(r.dws) },
  { key: "ws", label: "WS", align: "right", render: (r) => formatNumber(r.ws) },
  { key: "obpm", label: "OBPM", align: "right", render: (r) => formatNumber(r.obpm) },
  { key: "dbpm", label: "DBPM", align: "right", render: (r) => formatNumber(r.dbpm) },
  { key: "bpm", label: "BPM", align: "right", render: (r) => formatNumber(r.bpm) },
  { key: "vorp", label: "VORP", align: "right", render: (r) => formatNumber(r.vorp) },
];

const salariesColumns: ColumnDef<SalRow>[] = [
  { key: "season", label: "Season", render: (r) => r.season },
  { key: "team", label: "Team", render: (r) => r.team ?? "—" },
  { key: "salary", label: "Salary", align: "right", render: (r) => formatCurrency(r.salary) },
  {
    key: "teamPayroll",
    label: "Team Payroll",
    align: "right",
    render: (r) => formatCurrency(r.teamPayroll),
  },
  {
    key: "pctOfTeamCap",
    label: "% of Team Payroll",
    align: "right",
    render: (r) => formatPercent(r.pctOfTeamCap),
  },
  {
    key: "pctOfLeagueCap",
    label: "% of League Cap",
    align: "right",
    render: (r) => formatPercent(r.pctOfLeagueCap),
  },
  {
    key: "spotracBase",
    label: "Spotrac Base",
    align: "right",
    render: (r) => formatCurrency(r.spotracBase),
  },
  {
    key: "spotracCapHit",
    label: "Spotrac Cap Hit",
    align: "right",
    render: (r) => formatCurrency(r.spotracCapHit),
  },
];

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();

  const player = await getPlayerById(playerId);
  if (!player) notFound();

  const [perGame, totals, advanced, salaries] = await Promise.all([
    getPlayerCareerStatsPerGame(playerId),
    getPlayerCareerStatsTotals(playerId),
    getPlayerCareerAdvancedStats(playerId),
    getPlayerCareerSalaries(playerId),
  ]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-6">{player.name}</h1>
      <SimpleTable title="Career Averages" columns={statsColumns} rows={perGame} rowKey={(r) => r.id} />
      {totals.length > 0 && (
        <SimpleTable title="Career Totals" columns={statsColumns} rows={totals} rowKey={(r) => r.id} />
      )}
      <SimpleTable title="Advanced Stats" columns={advancedColumns} rows={advanced} rowKey={(r) => r.id} />
      <SimpleTable title="Salaries" columns={salariesColumns} rows={salaries} rowKey={(r) => r.id} />
    </div>
  );
}
