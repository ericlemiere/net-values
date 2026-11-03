import { PageHeader } from "@/components/PageHeader";
import { TradeFinder, type TradeFinderState } from "@/components/TradeFinder";
import { getTeams, getTradePool } from "@/lib/db/queries";
import { PAGE_COLUMN } from "@/lib/layout";
import { pageMetadata } from "@/lib/site";
import { CAP_RULES, type NvpBasis, type TradeSort } from "@/lib/trade";

export const metadata = pageMetadata({
  title: "Trade Finder",
  description:
    "Pick an NBA player and see every trade that works under the salary cap, with the Net Value each team gains or gives up.",
  path: "/trade-finder",
});

function pick<T extends string | number>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const found = allowed.find((a) => String(a) === value);
  return found ?? fallback;
}

export default async function TradeFinderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [pool, teams] = await Promise.all([getTradePool(), getTeams()]);
  const rules = pool ? CAP_RULES[pool.season] : undefined;

  if (!pool || !rules) {
    return (
      <div className={PAGE_COLUMN}>
        <PageHeader title="Trade Finder" />
        <p className="text-white/70">
          The trade finder isn&apos;t set up for this season yet.
        </p>
      </div>
    );
  }

  const player = Number(sp.player);
  const anchor = pool.players.find((p) => p.key === player) ?? null;
  const partner =
    anchor && sp.partner && sp.partner !== anchor.team && sp.partner in pool.payrolls
      ? sp.partner
      : null;
  const initial: TradeFinderState = {
    player: anchor?.key ?? null,
    partner,
    sendCount: pick(sp.send, [1, 2, 3] as const, 1),
    getCount: pick(sp.get, [1, 2, 3] as const, 1),
    basis: pick<NvpBasis>(sp.nvp, ["prev", "now"], "prev"),
    sort: pick<TradeSort>(sp.sort, ["salary", "fair"], "salary"),
  };

  return (
    <div className={PAGE_COLUMN}>
      <PageHeader title="Trade Finder" />
      <TradeFinder
        pool={pool.players}
        payrolls={pool.payrolls}
        rules={rules}
        teamNames={Object.fromEntries(teams.map((t) => [t.abbr, t.name]))}
        initial={initial}
      />
      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-white/50">
        Trades are checked against salary alone, under the 2023 CBA: a team
        that finishes over the cap can take back up to 200% of what it sends
        plus $250,000 on small salaries, what it sends plus about $9.1 million
        in the middle, and 125% plus $250,000 above about $35.2 million. A
        team that would finish over the first apron can&apos;t take back more
        than it sends, and one over the second apron can&apos;t combine
        salaries. Draft picks, cash, trade restrictions on newly signed
        players, no-trade clauses, traded player exceptions, and roster limits
        aren&apos;t considered, and two-way players aren&apos;t offered.
      </p>
    </div>
  );
}
