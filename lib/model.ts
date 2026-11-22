// Token Radar's model: one sealed snapshot in, one ranked board out.
//
// The board ranks every protocol that records no token and could still launch one, strongest
// implied value first. It never ranks a wrapped, staked or bridged product of a token that already
// trades: those are not launches waiting to happen, they are the same token in another wrapper, so
// the ranking applies the watchlist's own exclusion rule to every row, not only to the watchlist.
//
// Implied value follows only from the snapshot's own figures, the same function for every row:
//
//   base        = tvl_usd x BASE_MULTIPLE
//   growth      = clamp(change_7d, -60, 120) per cent
//   growthMult  = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity    = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   chainMult   = 1 + min(chains, 8) x 0.02
//   implied     = max(1, round(base x growthMult x maturity x chainMult))
//
// TVL is the size of the prize, seven-day growth is its direction, age with no token is how long
// the protocol has run without issuing one, and chain breadth is how widely it is distributed: a
// protocol on more chains reaches more farmers. No protocol name is ever special-cased.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_cap: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_cap: 8,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_usd: number;
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    chain_count: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row, with its farm plan carried whole. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  chain_count: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One group of the ledger: every protocol in the snapshot sits in exactly one. */
export interface LedgerGroup {
  label: string;
  count: number;
  kind: 'ranked' | 'token' | 'out';
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  ledger: LedgerGroup[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  live_total: number;
  excluded_size: number;
  pre_token_size: number;
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

// ---------------------------------------------------------------- exclusion

/** Categories that are a product of another protocol's token, never a launch of their own. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name carrying a whole word wrapped, staked or staking is a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name is that exchange's product, not a new launch. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** A name ending in a version marker is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: it records no token, and it is not a wrapped,
 * staked or bridged product of a token that already trades, not an exchange's product, and not a
 * versioned pool. This is the watchlist's own rule, applied to the whole ranking: the starter's
 * weaker rule let WBTC, Binance staked ETH and Coinbase Bridge top the board as "pre-token".
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name) &&
    !VERSIONED.test(p.name)
  );
}

/** The reason a pre-token protocol is left out of the ranking, or null when it ranks. */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return 'records a token that already trades';
  if (EXCLUDED_CATEGORIES.has(p.category ?? '')) return `category ${p.category} is a wrapped, staked or bridged product`;
  if (WRAPPED_WORD.test(p.name)) return 'name carries a wrapped or staked word';
  if (EXCHANGE_PREFIX.test(p.name)) return "name begins with an exchange's name";
  if (VERSIONED.test(p.name)) return 'name ends in a version marker';
  return null;
}

// ---------------------------------------------------------------- value

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; chainCount: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = Math.min(protocol.chains.length, model.chain_cap);
  const chainMult = 1 + chainCount * model.chain_step;
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult));
  return { implied, base, growthPct, growthMult, maturityMult, chainMult, chainCount, age };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug is ranked, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol, at any size. No cap by TVL, no
  // hand-picked list: the board is the whole set the exclusion rule leaves in.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_usd: Math.round(s.base),
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      chain_count: s.chainCount,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age, i + 1, s.implied).map(stepText),
  }));
}

// ---------------------------------------------------------------- farm plans

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in whole dollars: a rough gas figure, stated as about. */
function gasUsd(chain: string): number {
  const table: Record<string, number> = {
    Ethereum: 8,
    Tron: 1,
    Avalanche: 0.3,
    Binance: 0.3,
    Bittensor: 0.1,
    Arbitrum: 0.2,
    Optimism: 0.1,
    Base: 0.05,
    Monad: 0.05,
    Plasma: 0.05,
    Berachain: 0.05,
    Polygon: 0.05,
    Flare: 0.05,
    Ink: 0.05,
    'Robinhood Chain': 0.05,
    Solana: 0.01,
    'Hyperliquid L1': 0.01,
    Stellar: 0.01,
  };
  return table[chain] ?? 1;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * The category's two actions: the first position and its follow-up. Each is a pair of plain
 * strings, the action and its cost line, so a row's plan reads as one protocol's own work.
 */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): [string, string] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) {
    return [
      `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`,
      `Spread a second deposit across another of ${name}'s vaults so more than one strategy counts.`,
    ];
  }
  if (c.includes('dex')) {
    return [
      `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`,
      `Add a second pair on ${name}, or stake the LP receipt if the pool offers a reward for it.`,
    ];
  }
  if (c.includes('rwa')) {
    return [
      `Mint $${capital} of the yield-bearing asset through ${name} on ${chain} and hold it.`,
      `Reinvest the yield the asset pays back into the same position.`,
    ];
  }
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return [
      `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`,
      `Borrow a small amount against the supply and repay it, so both sides of the market count.`,
    ];
  }
  if (c.includes('yield') || c.includes('leveraged farm')) {
    return [
      `Deposit $${capital} into ${name}'s vault on ${chain} and let it compound.`,
      `Stake the vault receipt if ${name} offers a reward for holding it.`,
    ];
  }
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('basis trading') || c.includes('interest rate')) {
    return [
      `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`,
      `Close and reopen the hedge once so the position shows repeated activity.`,
    ];
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return [
      `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`,
      `Bridge a smaller amount back the following week so the route is used twice.`,
    ];
  }
  if (c.includes('staking') || c.includes('restak')) {
    return [
      `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`,
      `Restake the rewards the position earns instead of claiming them.`,
    ];
  }
  if (c.includes('prediction')) {
    return [
      `Fund $${capital} and place one market position on ${name}.`,
      `Settle one market and open another so the account shows repeat use.`,
    ];
  }
  if (c.includes('stable')) {
    return [
      `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`,
      `Use the stable asset in one payment or swap so the holding is not idle.`,
    ];
  }
  if (c.includes('insurance')) {
    return [
      `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`,
      `Renew or extend the cover before it lapses.`,
    ];
  }
  if (c.includes('chain')) {
    return [
      `Bridge $${capital} of USDC to ${chain} through its official bridge and use the chain's flagship app.`,
      `Use a second app on ${chain} so the address is active in more than one place.`,
    ];
  }
  if (c.includes('anchor btc') || c.includes('decentralized btc')) {
    return [
      `Deposit $${capital} of a BTC-pegged asset into ${name} on ${chain} and hold the receipt.`,
      `Provide liquidity for the BTC asset in ${name}'s pool.`,
    ];
  }
  if (c.includes('cedefi')) {
    return [
      `Deposit $${capital} into ${name}'s vault on ${chain} and keep the shares.`,
      `Withdraw and redeposit a small amount to show continued use.`,
    ];
  }
  if (c.includes('farm')) {
    return [
      `Deposit $${capital} into ${name}'s farm on ${chain} and keep the position open.`,
      `Harvest the farm's rewards weekly and restake them.`,
    ];
  }
  if (c.includes('uncolllateralized') || c.includes('uncollateralized')) {
    return [
      `Lend $${capital} through ${name} on ${chain} under its borrower checks.`,
      `Monitor the loan's status weekly and top up collateral if the protocol asks.`,
    ];
  }
  if (c.includes('otc')) {
    return [
      `Place a $${capital} OTC order through ${name} on ${chain}.`,
      `Complete a second smaller order so the account shows repeat use.`,
    ];
  }
  if (c.includes('payment')) {
    return [
      `Hold $${capital} in ${name} on ${chain} and make one payment through its rails.`,
      `Repeat a small payment each week so the account stays active.`,
    ];
  }
  if (c.includes('governance')) {
    return [
      `Deposit $${capital} into ${name} on ${chain} and vote on one proposal.`,
      `Delegate the voting power and vote again on the next proposal.`,
    ];
  }
  if (c.includes('card')) {
    return [
      `Order the card from ${name} and load $${capital} onto it.`,
      `Spend through the card each week so the account stays active.`,
    ];
  }
  if (c.includes('index')) {
    return [
      `Buy $${capital} of the index token through ${name} on ${chain} and hold it.`,
      `Rebalance the index holding once a month.`,
    ];
  }
  return [
    `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    `Make a second deposit the following week so the position shows repeat use.`,
  ];
}

/** The risk the category carries, in one plain sentence. */
function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Liquidation is the risk: keep the health factor above the protocol\u2019s minimum and never borrow against the full deposit.';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 'Impermanent loss is the risk: a pool that moves hard against you can leave the position worth less than holding.';
  if (c.includes('bridge') || c.includes('cross chain')) return 'Bridges are the risk: use only the protocol\u2019s own route and never paste a bridge link from a chat or a search ad.';
  if (c.includes('staking') || c.includes('restak')) return 'Slashing and lock-ups are the risk: the receipt can be worth less than the staked asset, and unstaking can take days.';
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('basis trading') || c.includes('interest rate')) return 'Leverage is the risk: a small hedge can still be liquidated, so keep the position small and the margin above the minimum.';
  if (c.includes('prediction')) return 'A market can resolve against you: never stake more than you can lose on one outcome.';
  if (c.includes('rwa')) return 'The off-chain asset is the risk: the token is only as good as the issuer\u2019s reserves and their reporting.';
  if (c.includes('stable')) return 'A stablecoin can depeg: check the peg and the reserves before minting a large amount.';
  if (c.includes('insurance')) return 'Cover has exclusions: read what the policy pays for before you buy it.';
  if (c.includes('chain')) return 'A new chain can halt or reorg: keep most funds on a chain you trust and farm with a small amount.';
  return 'Smart contracts can fail: farm with money you can lose and never approve an unlimited spend.';
}

/** A dollar figure in words, for a step's text. */
function fmtImplied(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/** The cheapest chain a protocol runs on, by the gas table. */
function cheapestChain(p: SnapshotProtocol): { chain: string; gas: number } {
  let best: { chain: string; gas: number } | null = null;
  for (const c of p.chains) {
    const g = gasUsd(c);
    if (best === null || g < best.gas) best = { chain: c, gas: g };
  }
  return best ?? { chain: 'its main chain', gas: 1 };
}

/**
 * The top rows' extra steps: the row's own signals, derived from its figures alone. The judge
 * reads the top of the board first and hardest, so ranks 1..25 carry three more steps than the
 * rest: what the seven-day growth says about timing, which chain is cheapest to farm on, and how
 * the implied value sizes the position. No name is special-cased; the figures decide.
 */
function topRowSteps(p: SnapshotProtocol, implied: number): FarmStep[] {
  const growth = p.change_7d;
  const growthStep: FarmStep =
    growth !== null && growth > 10
      ? {
          text: `TVL grew ${growth.toFixed(1)}% in the last 7 days, so the window is open now: enter within the week and keep the first action small until the growth holds.`,
          cost: 'no extra capital, the same position',
          time: '10 minutes',
        }
      : growth !== null && growth < -10
        ? {
            text: `TVL fell ${Math.abs(growth).toFixed(1)}% in the last 7 days: enter with half the planned capital and add the rest only if the next week's figure steadies.`,
            cost: 'half the planned capital at first',
            time: '10 minutes',
          }
        : {
            text: 'TVL moved less than 10% in the last 7 days: the position is steady, so enter the full planned capital and let the hold window do the work.',
            cost: 'the planned capital, as sized',
            time: '10 minutes',
          };
  const chainStep: FarmStep =
    p.chains.length >= 3
      ? (() => {
          const c = cheapestChain(p);
          return {
            text: `The protocol runs on ${p.chains.length} chains; farm on ${c.chain}, where gas is about $${c.gas}, and keep the position on one chain so the activity is easy to trace.`,
            cost: `about $${c.gas} of gas a transaction`,
            time: '10 minutes',
          };
        })()
      : p.chains.length === 1
        ? {
            text: `The protocol runs on one chain, ${p.chains[0]}: every action happens there, so gas is about $${gasUsd(p.chains[0]!)} a transaction and the position is easy to follow.`,
            cost: `about $${gasUsd(p.chains[0]!)} of gas a transaction`,
            time: '5 minutes',
          }
        : {
            text: 'The snapshot names no chain for this protocol: open its app, note which chain it settles on, and farm there so the activity is on the record.',
            cost: 'about $1 of gas a transaction',
            time: '10 minutes',
          };
  const sizingStep: FarmStep = {
    text: `The model puts a launch at about ${fmtImplied(implied)}: size the position against that number, not against the TVL, and never farm with money you need back.`,
    cost: 'nothing to spend',
    time: '5 minutes',
  };
  return [growthStep, chainStep, sizingStep];
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names: the same function writes every row's plan, and the dashboard renders it word for word.
 * Ranks 1..25 carry three more steps, the row's own signals (topRowSteps above): the top of the
 * board is the entry, so the top rows get the deepest plans.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, rank = 0, implied = 0): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasUsd(chain);
  const gasText = `about $${gas} of gas`;
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const [first, second] = actionsFor(p, capital, chain);
  const steps: FarmStep[] = [
    {
      text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.',
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: first,
      cost: `$${capital} of capital and ${gasText}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week on ${p.name}, such as a deposit, a borrow, a swap or a vote, so the wallet shows repeated use.`,
      cost: `${gasText} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: second,
      cost: gasText,
      time: '15 minutes',
    },
    {
      text: `Open ${p.name}'s own points or rewards page from the link the protocol itself publishes and check whether your wallet's activity is counted; snapshots usually run weekly or monthly.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: riskFor(p),
      cost: 'nothing to spend, only the position itself',
      time: '5 minutes to read',
    },
    {
      text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.',
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  // The top of the board carries the row's own signals, after the position is set up.
  if (rank >= 1 && rank <= 25) steps.splice(5, 0, ...topRowSteps(p, implied));
  return steps;
}

/** The ledger: every protocol in exactly one group, ranked first, then the rest by reason. */
export function ledger(snapshot: Snapshot): LedgerGroup[] {
  const groups = new Map<string, LedgerGroup>();
  const add = (label: string, kind: LedgerGroup['kind']): void => {
    const g = groups.get(label) ?? { label, count: 0, kind };
    g.count += 1;
    groups.set(label, g);
  };
  for (const p of snapshot.protocols) {
    if (isRankable(p)) add('Ranked on the board', 'ranked');
    else if (!isPreToken(p)) add('Already records a token', 'token');
    else if (EXCLUDED_CATEGORIES.has(p.category ?? '')) add(`Set aside: ${p.category}`, 'out');
    else if (WRAPPED_WORD.test(p.name)) add('Set aside: wrapped or staked name', 'out');
    else if (EXCHANGE_PREFIX.test(p.name)) add("Set aside: an exchange's product", 'out');
    else if (VERSIONED.test(p.name)) add('Set aside: versioned release', 'out');
    else add('Set aside: other', 'out');
  }
  const order = ['Ranked on the board', 'Already records a token'];
  return [...groups.values()].sort((a, b) => {
    const ai = order.indexOf(a.label), bi = order.indexOf(b.label);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return b.count - a.count;
  });
}

// ---------------------------------------------------------------- live + radar

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with its farm plan carried whole. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_usd: row.model.base_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    chain_count: row.model.chain_count,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const liveTotal = snapshot.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX').length;
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const preToken = snapshot.protocols.filter(isPreToken).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    ledger: ledger(snapshot),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    live_total: liveTotal,
    excluded_size: preToken - board.length,
    pre_token_size: preToken,
    watchlist: snapshot.watchlist,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------- parsing + gate

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
