/**
 * The salary rules /trade-finder checks a deal against, and the search that
 * finds every deal they allow.
 *
 * The rules are the 2023 CBA's, simplified to salary alone. What they leave
 * out, on purpose: draft picks and cash, recently signed players who can't be
 * traded yet, no-trade clauses, base-year compensation, traded player
 * exceptions, roster limits, and a team with cap room absorbing salary past
 * the cap (it only gets credit for staying under it). Each of those can make
 * a deal shown here illegal, or a legal one go unshown; the page says so.
 */

/** A season's thresholds, in dollars. */
export interface CapRules {
  season: string;
  cap: number;
  tax: number;
  firstApron: number;
  secondApron: number;
  /**
   * The salary-matching bands for a team under the first apron after the
   * trade, by outgoing salary:
   *   up to `smallBand`            200% of outgoing + `cushion`
   *   up to `largeBand`            outgoing + `smallBand`
   *   above `largeBand`            125% of outgoing + `cushion`
   * The CBA set them at $7.5M and $29M for 2023-24 and grows them with the
   * cap, which is how the figures below were derived.
   */
  smallBand: number;
  largeBand: number;
  cushion: number;
}

/**
 * By season. The cap, tax, and aprons are the league's published figures
 * (pr.nba.com, July 2026). The bands are the 2023-24 ones grown by the cap
 * ($136.021M then): $7.5M and $29M times 164.961 / 136.021.
 */
export const CAP_RULES: Record<string, CapRules> = {
  "2026-2027": {
    season: "2026-2027",
    cap: 164_961_000,
    tax: 200_428_000,
    firstApron: 209_015_000,
    secondApron: 221_686_000,
    smallBand: 9_096_000,
    largeBand: 35_170_000,
    cushion: 250_000,
  },
};

/** The most a team under the first apron can take back for `out`. */
export function matchLimit(out: number, r: CapRules): number {
  if (out <= r.smallBand) return 2 * out + r.cushion;
  if (out <= r.largeBand) return out + r.smallBand;
  return Math.floor(1.25 * out) + r.cushion;
}

export type Tier = "room" | "cap" | "tax" | "first" | "second";

/** Where a payroll sits: under the cap, over it, in the tax, past an apron. */
export function tierOf(payroll: number, r: CapRules): Tier {
  if (payroll > r.secondApron) return "second";
  if (payroll > r.firstApron) return "first";
  if (payroll > r.tax) return "tax";
  if (payroll > r.cap) return "cap";
  return "room";
}

export const TIER_LABEL: Record<Tier, string> = {
  room: "Under the cap",
  cap: "Over the cap",
  tax: "Taxpayer",
  first: "Over the first apron",
  second: "Over the second apron",
};

/** One team's side of a deal: what it sends, what it gets back. */
export interface Side {
  payroll: number;
  /** Total salary sent out. */
  out: number;
  /** The biggest single salary sent out, for the aggregation rule. */
  maxOut: number;
  /** How many players are sent out. */
  nOut: number;
  /** Total salary taken back. */
  in: number;
}

/**
 * Whether one team can make its side of the deal, judged on its payroll after
 * the trade:
 * - finishing under the cap is always fine;
 * - otherwise taking back no more than it sends is fine, except that a team
 *   past the second apron can't combine salaries, so the most it can take
 *   back for several players is the biggest of them;
 * - taking back more than it sends needs it to finish under the first apron,
 *   and then within the matching bands.
 */
export function sideIsLegal(s: Side, r: CapRules): boolean {
  const after = s.payroll - s.out + s.in;
  if (after <= r.cap) return true;
  if (after > r.secondApron && s.nOut > 1 && s.in > s.maxOut) return false;
  if (s.in <= s.out) return true;
  if (after > r.firstApron) return false;
  return s.in <= matchLimit(s.out, r);
}

/** A player who can be dealt: on a roster, with a cap hit. */
export interface TradePlayer {
  /** BALLDONTLIE id, unique within the pool. */
  key: number;
  playerId: number | null;
  nbaPersonId: number | null;
  name: string;
  team: string;
  pos: string | null;
  capHit: number;
  /** Net Value scores, NVP. Null with no season on file. */
  nvp: number | null;
  nvpPrev: number | null;
}

export type NvpBasis = "now" | "prev";
export type TradeSort = "fair" | "salary";

export interface SearchOptions {
  /** The player being shopped. */
  anchor: number;
  /** Only this partner, or any. */
  partner: string | null;
  /** How many players the anchor's team sends, him included: 1-3. */
  sendCount: number;
  /** How many players the partner sends back: 1-3. */
  getCount: number;
  basis: NvpBasis;
  sort: TradeSort;
  /** Most trades returned in all. */
  limit: number;
}

export interface TradeResults {
  trades: Trade[];
  /** Every legal trade found, before the limit. */
  total: number;
}

export interface Trade {
  partner: string;
  /** The anchor first, then any teammates sent with him. */
  sent: TradePlayer[];
  received: TradePlayer[];
  sentSalary: number;
  receivedSalary: number;
  /** NVP coming in minus going out, for the anchor's team. */
  nvpGain: number;
}

const value = (p: TradePlayer, basis: NvpBasis) =>
  (basis === "now" ? p.nvp : p.nvpPrev) ?? 0;

/** Every group of exactly `size` from `list`. */
function groups<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, picked: T[]) => {
    if (picked.length === size) {
      out.push(picked);
      return;
    }
    for (let i = start; i < list.length; i++) walk(i + 1, [...picked, list[i]]);
  };
  walk(0, []);
  return out;
}

interface Package {
  players: TradePlayer[];
  salary: number;
  maxSalary: number;
  nvp: number;
}

function pack(players: TradePlayer[], basis: NvpBasis): Package {
  let salary = 0;
  let maxSalary = 0;
  let nvp = 0;
  for (const p of players) {
    salary += p.capHit;
    maxSalary = Math.max(maxSalary, p.capHit);
    nvp += value(p, basis);
  }
  return { players, salary, maxSalary, nvp };
}

/**
 * Every deal for the anchor that both teams' payrolls allow, best first.
 *
 * Exhaustive rather than clever: a team is about fifteen players, so the
 * partner's packages of three come to under five hundred, times at most
 * seventy-eight on the anchor's side, times twenty-nine teams. Each check is a
 * few comparisons.
 */
export function findTrades(
  pool: TradePlayer[],
  payrolls: Record<string, number>,
  rules: CapRules,
  o: SearchOptions,
): TradeResults {
  const anchor = pool.find((p) => p.key === o.anchor);
  if (!anchor) return { trades: [], total: 0 };
  const home = anchor.team;
  const homePayroll = payrolls[home] ?? 0;

  const byTeam = new Map<string, TradePlayer[]>();
  for (const p of pool) {
    const list = byTeam.get(p.team);
    if (list) list.push(p);
    else byTeam.set(p.team, [p]);
  }

  const teammates = (byTeam.get(home) ?? []).filter(
    (p) => p.key !== anchor.key,
  );
  const outgoing =
    o.sendCount <= 1
      ? [pack([anchor], o.basis)]
      : groups(teammates, o.sendCount - 1).map((g) =>
          pack([anchor, ...g], o.basis),
        );

  const found: Trade[] = [];
  for (const [team, roster] of byTeam) {
    if (team === home || (o.partner && team !== o.partner)) continue;
    const payroll = payrolls[team] ?? 0;
    const incoming = groups(roster, o.getCount).map((g) => pack(g, o.basis));
    for (const out of outgoing) {
      for (const inn of incoming) {
        const homeOk = sideIsLegal(
          {
            payroll: homePayroll,
            out: out.salary,
            maxOut: out.maxSalary,
            nOut: out.players.length,
            in: inn.salary,
          },
          rules,
        );
        if (!homeOk) continue;
        const awayOk = sideIsLegal(
          {
            payroll,
            out: inn.salary,
            maxOut: inn.maxSalary,
            nOut: inn.players.length,
            in: out.salary,
          },
          rules,
        );
        if (!awayOk) continue;
        found.push({
          partner: team,
          sent: out.players,
          received: inn.players,
          sentSalary: out.salary,
          receivedSalary: inn.salary,
          nvpGain: inn.nvp - out.nvp,
        });
      }
    }
  }

  const size = (t: Trade) => t.sent.length + t.received.length;
  const score: Record<TradeSort, (t: Trade) => number> = {
    fair: (t) => Math.abs(t.nvpGain),
    salary: (t) => Math.abs(t.receivedSalary - t.sentSalary),
  };
  // Ties go to the simpler deal.
  found.sort(
    (a, b) => score[o.sort](a) - score[o.sort](b) || size(a) - size(b),
  );

  return { trades: found.slice(0, o.limit), total: found.length };
}
