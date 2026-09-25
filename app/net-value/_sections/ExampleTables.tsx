import { SimpleTable } from "@/components/SimpleTable";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamLink } from "@/components/TeamLink";
import { SeasonLink } from "@/components/SeasonLink";
import type { ColumnDef } from "@/components/DataTable";
import {
  formatCurrency,
  formatPercent,
  formatRank,
  formatScore,
  formatStat,
} from "@/lib/format";
import type { NetValueExample } from "@/lib/db/queries";
import { awardKey, type Award } from "@/lib/awards";
import { TABLE_BREAKOUT } from "@/lib/layout";

function exampleColumns(
  showSeason: boolean,
  awards: Map<string, Award[]>,
): ColumnDef<NetValueExample>[] {
  return [
    {
      key: "name",
      label: "Player",
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
            align: "center" as const,
            render: (r: NetValueExample) => <SeasonLink season={r.season} />,
          },
        ]
      : []),
    {
      key: "team",
      label: "Team",
      align: "center",
      render: (r) => <TeamLink abbr={r.team} label={r.teamLabel} />,
    },
    {
      key: "salary",
      label: "Salary",
      align: "right",
      render: (r) => formatCurrency(r.salary),
    },
    {
      key: "pctOfLeagueCap",
      label: "% of League Cap",
      align: "right",
      // Two decimals, the same as the salaries page shows it.
      render: (r) =>
        formatPercent(
          r.leagueCap
            ? Number(((100 * r.salary) / r.leagueCap).toFixed(2))
            : null,
        ),
    },
    {
      key: "salaryRank",
      label: "Pay Rank",
      align: "right",
      render: (r) => formatRank(r.salaryRank),
    },
    {
      key: "production",
      label: "Value Produced",
      align: "right",
      description:
        "NVPs. His share of the points his team's offense and defense generated above league average, counted up from replacement level.",
      render: (r) => formatStat(r.production),
    },
    {
      key: "expectedProduction",
      label: "Value Bought",
      align: "right",
      description:
        "NVPs. What his salary bought at that season's going rate, scaled by his Charged Share.",
      render: (r) => formatStat(r.expectedProduction),
    },
    {
      key: "netValueScore",
      label: "Net Value",
      align: "right",
      render: (r) => formatScore(r.netValueScore),
    },
  ];
}

/** The best and worst seasons on record and in the latest season. */
export function ExampleTables({
  season,
  best,
  worst,
  overCap,
  latestTop,
  latestBottom,
  awards,
}: {
  season: string;
  best: NetValueExample[];
  worst: NetValueExample[];
  overCap: NetValueExample[];
  latestTop: NetValueExample[];
  latestBottom: NetValueExample[];
  awards: Map<string, Award[]>;
}) {
  /*
   * The breakout goes on the section rather than on each table, so all four
   * share one right edge. They are two matched pairs — best against worst,
   * all-time against this season — and sizing each to its own contents would
   * have the pair you are meant to compare come out 114px apart.
   *
   * The prose inside is unaffected: every paragraph here carries
   * `max-w-prose`, which caps what it contributes to the section's width
   * well below what the tables ask for.
   */
  return (
    <section className={`mt-12 ${TABLE_BREAKOUT}`}>
      <h2 className="text-xl font-semibold tracking-tight">
        Best Net Value seasons on record
      </h2>
      <p className="mt-2 mb-4 max-w-prose text-sm text-white/70">
        All-time seasons bought cheaply. Some are rookie deals, the rest are
        long contracts signed before the cap and the player&rsquo;s price caught
        up with him. The ten of them averaged 19% of the cap.
      </p>
      <SimpleTable
        columns={exampleColumns(true, awards)}
        rows={best}
        rowKey={(r) => `${r.playerId}-${r.season}`}
      />

      <h2
        id="worst-seasons"
        className="mt-8 scroll-mt-24 text-xl font-semibold tracking-tight"
      >
        Worst Net Value seasons on record
      </h2>
      <p className="mt-2 mb-4 max-w-prose text-sm text-white/70">
        Contracts that didn&rsquo;t return what they cost. Six of these ten
        players were available all season, so this is mostly money running well
        ahead of production rather than time lost to injury.
        {overCap.length > 0 && (
          <>
            {" "}
            <a
              href="#jordan"
              className="underline underline-offset-2 hover:text-accent transition-all duration-150"
            >
              Michael Jordan should be on this list but has been omitted. Why?
            </a>
          </>
        )}
      </p>
      <SimpleTable
        columns={exampleColumns(true, awards)}
        rows={worst}
        rowKey={(r) => `${r.playerId}-${r.season}`}
      />

      <h2 className="mt-8 text-xl font-semibold tracking-tight">
        Best of {season}
      </h2>
      <div className="mt-4">
        <SimpleTable
          columns={exampleColumns(false, awards)}
          rows={latestTop}
          rowKey={(r) => `${r.playerId}-${r.season}`}
        />
      </div>
      <h2 className="mt-8 text-xl font-semibold tracking-tight">
        Worst of {season}
      </h2>
      <div className="mt-4">
        <SimpleTable
          columns={exampleColumns(false, awards)}
          rows={latestBottom}
          rowKey={(r) => `${r.playerId}-${r.season}`}
        />
      </div>
    </section>
  );
}
