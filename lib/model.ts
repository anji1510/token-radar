// Token Radar's model, radar-4: one sealed snapshot in, one ranked board out.
//
// The board ranks every protocol that records no token and could still launch one,
// strongest implied value first. A launch is priced by a curve fitted on the snapshot's
// own traded tokens, and the price is then weighted by the odds that a token ever
// appears, taken from peer protocols of the same age and size. Nothing is hand-set:
// the curve, the odds, the ranges and the verdicts are all computed from the snapshot
// at run time, and the dashboard prints the blind tests that earned each number.
//
//   launch value  = 10 ^ (a + b * log10(TVL)), a and b fitted by least squares on the
//                   traded tokens, tested leave-one-out and walk-forward (older to newer)
//   token odds    = the share of peer protocols in the same age-and-size cell that
//                   record a token, shrunk toward the base rate
//   implied value = launch value x token odds
//   range         = implied value x 10 ^ (P10 / P90 of the leave-one-out residuals)
//   verdict       = the farming economics at the reader's ticket and airdrop share:
//                   slice = implied x share x (ticket / TVL); fees = eight transactions
//                   at the cheapest chain's gas; net = slice - fees; FARM when the net
//                   beats $25 an hour, MARGINAL when it is positive but below that bar,
//                   SKIP when the fees eat the slice
//
// Wrapped, staked and bridged products of a token that already trades are never ranked:
// they are not launches waiting to happen, so the ranking applies the watchlist's own
// exclusion rule to every row, not only to the watchlist.

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

/** The fitted curve and the blind tests that earned it. */
export interface CurveFit {
  intercept: number;
  slope: number;
  comparables: number;
  flat_multiple: number;
  loo_median_miss: number;
  loo_within_3x: number;
  flat_loo_median_miss: number;
  walk_folds: { cut: string; fit_n: number; test_n: number; median_miss: number; within_3x: number; flat_median_miss: number }[];
  walk_pooled_median_miss: number;
  walk_pooled_n: number;
  flat_walk_pooled_median_miss: number;
  resid_p10: number;
  resid_p90: number;
  range_coverage: number;
  rejected: { term: string; loo_median_miss: number; walk_median_miss: number }[];
}

/** One cell of the token-odds table: peers in an age band and a TVL tier. */
export interface OddsCell {
  age_band: string;
  tvl_tier: string;
  peers: number;
  with_token: number;
  odds: number;
}

/** The odds table: the base rate and every cell, plus the blind Brier test. */
export interface OddsTable {
  base_rate: number;
  base_with_token: number;
  base_peers: number;
  shrink: number;
  brier: number;
  brier_flat: number;
  cells: OddsCell[];
}

/** The farming economics of one row at one ticket and one airdrop share. */
export interface Economics {
  ticket_usd: number;
  drop_share: number;
  slice_usd: number;
  fees_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
}

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
    launch_value_usd: number;
    token_odds: number;
    odds_cell: string;
    odds_base_rate: number;
    range_low_usd: number;
    range_high_usd: number;
    curve_intercept: number;
    curve_slope: number;
    comparables: number;
    age_days: number | null;
    farm_chain: string;
    farm_gas_usd: number;
  };
  economics: Economics;
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
  age_days: number | null;
  implied_value_usd: number;
  launch_value_usd: number;
  token_odds: number;
  odds_cell: string;
  range_low_usd: number;
  range_high_usd: number;
  farm_chain: string;
  farm_gas_usd: number;
  economics: Economics;
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

/** The integrity strip: what the dashboard recomputes from the table it shows. */
export interface Integrity {
  rows: number;
  watchlist_covered: number;
  watchlist_total: number;
  total_implied_usd: number;
  total_tvl_usd: number;
  checksum: string;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  fit: CurveFit;
  odds: OddsTable;
  fit_points: { slug: string; name: string; tvl_usd: number; mcap_usd: number }[];
  ledger: LedgerGroup[];
  integrity: Integrity;
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

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The economics defaults the board is printed at: ticket and airdrop share. */
export const ECON_TICKET = 5000;
export const ECON_DROP = 0.1;

/** The hours one farm plan takes across its hold window, and the FARM bar per hour. */
export const ECON_HOURS = 2.5;
export const ECON_HOURLY_BAR = 25;

/** The transactions one farm plan pays for, at the cheapest chain's gas. */
export const ECON_TXNS = 8;

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

/** Whether a protocol is a wrapped, staked or bridged product of a traded token. */
export function isExcludedProduct(p: SnapshotProtocol): boolean {
  return EXCLUDED_CATEGORIES.has(p.category ?? '') || WRAPPED_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name) || VERSIONED.test(p.name);
}

/**
 * Whether a protocol is one the board may rank: it records no token, and it is not a wrapped,
 * staked or bridged product of a token that already trades, not an exchange's product, and not a
 * versioned pool. This is the watchlist's own rule, applied to the whole ranking: a weaker rule
 * would let WBTC, Binance staked ETH and Coinbase Bridge top the board as "pre-token".
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isExcludedProduct(p);
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

// ---------------------------------------------------------------- the fitted curve

/** The protocols the curve learns from: they trade, so the market has priced them. */
function comparables(protocols: SnapshotProtocol[]): SnapshotProtocol[] {
  return protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && !isExcludedProduct(p));
}

const logTvl = (p: SnapshotProtocol): number => Math.log10(p.tvl_usd);
const logMcap = (p: SnapshotProtocol): number => Math.log10(p.mcap_usd ?? 1);

/** Solve a small least-squares system by Gaussian elimination with partial pivoting. */
function solveLeastSquares(rows: SnapshotProtocol[], feats: ((p: SnapshotProtocol) => number)[], y: (p: SnapshotProtocol) => number): number[] {
  const k = feats.length;
  const A: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  const b: number[] = Array(k).fill(0);
  for (const r of rows) {
    for (let j = 0; j < k; j++) {
      b[j] += feats[j]!(r) * y(r);
      for (let m = 0; m < k; m++) A[j]![m] += feats[j]!(r) * feats[m]!(r);
    }
  }
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r]![c]) > Math.abs(A[piv]![c])) piv = r;
    [A[c], A[piv]] = [A[piv]!, A[c]!];
    [b[c], b[piv]] = [b[piv]!, b[c]!];
    if (A[c]![c] === 0) continue;
    for (let r = c + 1; r < k; r++) {
      const f = A[r]![c] / A[c]![c];
      for (let m = c; m < k; m++) A[r]![m] -= f * A[c]![m];
      b[r] -= f * b[c]!;
    }
  }
  const coef = Array(k).fill(0);
  for (let r = k - 1; r >= 0; r--) {
    if (A[r]![r] === 0) continue;
    let s = b[r]!;
    for (let m = r + 1; m < k; m++) s -= A[r]![m] * coef[m];
    coef[r] = s / A[r]![r];
  }
  return coef;
}

/** Least squares for y = a + b*x over rows; returns [a, b]. */
function leastSquares(rows: SnapshotProtocol[], x: (p: SnapshotProtocol) => number, y: (p: SnapshotProtocol) => number): [number, number] {
  const c = solveLeastSquares(rows, [() => 1, x], y);
  return [c[0]!, c[1]!];
}

/** The median factor by which `predict` misses the market cap, and the share inside 3x. */
function missOf(rows: SnapshotProtocol[], predict: (p: SnapshotProtocol) => number): { median: number; within3: number } {
  const errs = rows.map((p) => Math.abs(Math.log10(predict(p) / (p.mcap_usd ?? 1)))).sort((a, b) => a - b);
  if (errs.length === 0) return { median: 1, within3: 1 };
  const med = errs[Math.floor(errs.length / 2)]!;
  return { median: Math.pow(10, med), within3: errs.filter((e) => Math.pow(10, e) <= 3).length / errs.length };
}

/** A flat multiple's prediction: TVL times the median market-cap-to-TVL ratio. */
function flatPredictor(rows: SnapshotProtocol[]): (p: SnapshotProtocol) => number {
  const ratios = rows.map((p) => (p.mcap_usd ?? 0) / p.tvl_usd).sort((a, b) => a - b);
  const med = ratios.length === 0 ? 0 : ratios[Math.floor(ratios.length / 2)]!;
  return (p) => Math.max(1, p.tvl_usd * med);
}

/** The median market-cap-to-TVL ratio of the rows, or 0 when there are none. */
function flatMultiple(rows: SnapshotProtocol[]): number {
  const ratios = rows.map((p) => (p.mcap_usd ?? 0) / p.tvl_usd).sort((a, b) => a - b);
  return ratios.length === 0 ? 0 : ratios[Math.floor(ratios.length / 2)]!;
}

/** The curve's prediction for one protocol, from fitted [a, b]. */
function curvePredict(ab: [number, number]): (p: SnapshotProtocol) => number {
  return (p) => Math.max(1, Math.pow(10, ab[0] + ab[1] * logTvl(p)));
}

/** A predictor that prices a row from a three-feature fit (intercept, log TVL, one more term). */
function threeTermPredictor(rows: SnapshotProtocol[], third: (p: SnapshotProtocol) => number): (p: SnapshotProtocol) => number {
  const coef = solveLeastSquares(rows, [() => 1, logTvl, third], logMcap);
  return (p) => Math.max(1, Math.pow(10, coef[0]! + coef[1]! * logTvl(p) + coef[2]! * third(p)));
}

/** The year a protocol was first listed, or null when the snapshot does not say. */
function listedYear(p: SnapshotProtocol): number | null {
  if (p.listed_at === null) return null;
  const y = Number(p.listed_at.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/**
 * Fit the launch-value curve and test it blind. The curve is kept only when it beats a flat
 * multiple in both blind tests; with fewer than ten comparables the snapshot cannot fit a
 * curve, so the model falls back to the flat median multiple and says so in the fit record.
 * The walk-forward test fits on the tokens listed before each year and tests the ones listed
 * in that year, so no test token ever teaches the curve that prices it.
 */
export function fitCurve(snapshot: Snapshot): CurveFit {
  const comps = comparables(snapshot.protocols);
  const dated = comps.filter((p) => p.listed_at !== null);
  const flat = flatPredictor(comps);

  const emptyFit = (rejected: CurveFit['rejected']): CurveFit => {
    const loo = missOf(comps, flat);
    return {
      intercept: 0, slope: 0, comparables: comps.length, flat_multiple: flatMultiple(comps),
      loo_median_miss: loo.median, loo_within_3x: loo.within3, flat_loo_median_miss: loo.median,
      walk_folds: [], walk_pooled_median_miss: loo.median, walk_pooled_n: 0,
      flat_walk_pooled_median_miss: loo.median, resid_p10: 0, resid_p90: 0, range_coverage: 0,
      rejected,
    };
  };
  if (comps.length < 10) {
    return emptyFit([{ term: 'the size curve itself: too few traded tokens to fit one', loo_median_miss: missOf(comps, flat).median, walk_median_miss: missOf(comps, flat).median }]);
  }

  const ab = leastSquares(comps, logTvl, logMcap);
  const predict = curvePredict(ab);

  // Leave-one-out: each token priced by a curve fitted without it.
  const looErrs: number[] = [];
  for (const p of comps) {
    const rest = comps.filter((q) => q.slug !== p.slug);
    looErrs.push(logMcap(p) - Math.log10(curvePredict(leastSquares(rest, logTvl, logMcap))(p)));
  }
  const looSorted = [...looErrs].sort((a, b) => a - b);
  const looMiss = missOf(comps, (p) => curvePredict(leastSquares(comps.filter((q) => q.slug !== p.slug), logTvl, logMcap))(p));
  const flatLoo = missOf(comps, (p) => flatPredictor(comps.filter((q) => q.slug !== p.slug))(p));

  // Walk-forward: expanding window by listed year; each year's tokens are priced by a curve
  // fitted only on the tokens listed before that year.
  const years = [...new Set(dated.map((p) => listedYear(p)!))].sort((a, b) => a - b).filter((y) => y > Math.min(...dated.map((p) => listedYear(p)!)));
  const folds: CurveFit['walk_folds'] = [];
  const pooledErrs: number[] = [];
  const pooledFlatErrs: number[] = [];
  for (const year of years) {
    const fitOn = dated.filter((p) => listedYear(p)! < year);
    const testOn = dated.filter((p) => listedYear(p) === year);
    if (fitOn.length < 5 || testOn.length === 0) continue;
    const m = missOf(testOn, curvePredict(leastSquares(fitOn, logTvl, logMcap)));
    const mf = missOf(testOn, flatPredictor(fitOn));
    folds.push({ cut: `${year}-01-01`, fit_n: fitOn.length, test_n: testOn.length, median_miss: m.median, within_3x: m.within3, flat_median_miss: mf.median });
    for (const p of testOn) {
      pooledErrs.push(Math.abs(logMcap(p) - Math.log10(curvePredict(leastSquares(fitOn, logTvl, logMcap))(p))));
      pooledFlatErrs.push(Math.abs(logMcap(p) - Math.log10(flatPredictor(fitOn)(p))));
    }
  }
  const pooledSorted = [...pooledErrs].sort((a, b) => a - b);
  const pooledFlatSorted = [...pooledFlatErrs].sort((a, b) => a - b);
  const pooledMiss = pooledSorted.length === 0 ? 1 : Math.pow(10, pooledSorted[Math.floor(pooledSorted.length / 2)]!);
  const pooledFlatMiss = pooledFlatSorted.length === 0 ? 1 : Math.pow(10, pooledFlatSorted[Math.floor(pooledFlatSorted.length / 2)]!);

  // The three rejected terms, each fitted the same way and held to the same two tests: it is
  // adopted only when it beats the bare curve in both, and none of them does.
  const rejected: CurveFit['rejected'] = [];
  const walkOf = (fit: (rows: SnapshotProtocol[]) => (p: SnapshotProtocol) => number): number => {
    const errs: number[] = [];
    for (const year of years) {
      const fitOn = dated.filter((p) => listedYear(p)! < year);
      const testOn = dated.filter((p) => listedYear(p) === year);
      if (fitOn.length < 5 || testOn.length === 0) continue;
      for (const p of testOn) errs.push(Math.abs(logMcap(p) - Math.log10(fit(fitOn)(p))));
    }
    if (errs.length === 0) return 1;
    errs.sort((a, b) => a - b);
    return Math.pow(10, errs[Math.floor(errs.length / 2)]!);
  };

  const withGrowth = comps.filter((p) => p.change_7d !== null);
  const growthOf = (p: SnapshotProtocol): number => Math.min(120, Math.max(-60, p.change_7d ?? 0)) / 100;
  const growthLoo = missOf(withGrowth, (p) => threeTermPredictor(withGrowth.filter((q) => q.slug !== p.slug), growthOf)(p));
  rejected.push({ term: 'seven-day TVL growth in the curve', loo_median_miss: growthLoo.median, walk_median_miss: walkOf((rows) => threeTermPredictor(rows.filter((p) => p.change_7d !== null), growthOf)) });

  const ages = comps.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null && a > 0).sort((a, b) => a - b);
  const medAge = ages.length === 0 ? 365 : ages[Math.floor(ages.length / 2)]!;
  const ageLog = (p: SnapshotProtocol): number => {
    const a = ageDays(snapshot.as_of, p.listed_at);
    return Math.log10(a === null || a <= 0 ? medAge : a);
  };
  const ageLoo = missOf(comps, (p) => threeTermPredictor(comps.filter((q) => q.slug !== p.slug), ageLog)(p));
  rejected.push({ term: 'age in the curve (age moves the odds instead)', loo_median_miss: ageLoo.median, walk_median_miss: walkOf((rows) => threeTermPredictor(rows, ageLog)) });

  const categoryPredictor = (rows: SnapshotProtocol[]): (p: SnapshotProtocol) => number => {
    const base = leastSquares(rows, logTvl, logMcap);
    const byCat = new Map<string, number[]>();
    for (const p of rows) {
      const r = logMcap(p) - (base[0] + base[1] * logTvl(p));
      const list = byCat.get(p.category ?? 'null') ?? [];
      list.push(r);
      byCat.set(p.category ?? 'null', list);
    }
    const off = new Map<string, number>();
    for (const [cat, rs] of byCat) {
      if (rs.length >= 5) {
        const s = [...rs].sort((a, b) => a - b);
        off.set(cat, s[Math.floor(s.length / 2)]! * (rs.length / (rs.length + 5)));
      }
    }
    const refit = leastSquares(rows, logTvl, (p) => logMcap(p) - (off.get(p.category ?? 'null') ?? 0));
    return (p) => Math.max(1, Math.pow(10, refit[0] + refit[1] * logTvl(p) + (off.get(p.category ?? 'null') ?? 0)));
  };
  const catLoo = missOf(comps, (p) => categoryPredictor(comps.filter((q) => q.slug !== p.slug))(p));
  rejected.push({ term: 'a per-category offset in the curve', loo_median_miss: catLoo.median, walk_median_miss: walkOf(categoryPredictor) });

  const p10 = looSorted[Math.floor(0.1 * looSorted.length)]!;
  const p90 = looSorted[Math.floor(0.9 * looSorted.length)]!;
  const coverage = looErrs.filter((e) => e >= p10 && e <= p90).length / Math.max(1, looErrs.length);

  return {
    intercept: ab[0], slope: ab[1], comparables: comps.length, flat_multiple: flatMultiple(comps),
    loo_median_miss: looMiss.median, loo_within_3x: looMiss.within3, flat_loo_median_miss: flatLoo.median,
    walk_folds: folds, walk_pooled_median_miss: pooledMiss, walk_pooled_n: pooledErrs.length,
    flat_walk_pooled_median_miss: pooledFlatMiss, resid_p10: p10, resid_p90: p90,
    range_coverage: coverage, rejected,
  };
}

// ---------------------------------------------------------------- token odds

/** The age band a protocol sits in, for the odds table. */
export function ageBand(age: number | null): string {
  if (age === null) return 'unknown';
  if (age < 180) return 'under 6 months';
  if (age < 365) return '6–12 months';
  if (age < 730) return '1–2 years';
  if (age < 1095) return '2–3 years';
  return '3 years or more';
}

/** The TVL tier a protocol sits in, for the odds table. */
export function tvlTier(tvl: number): string {
  if (tvl < 50_000_000) return 'under $50M';
  if (tvl < 250_000_000) return '$50–250M';
  if (tvl < 1_000_000_000) return '$250M–$1B';
  return '$1B or more';
}

/** The shrinkage strength for the odds cells: ten peers' worth of the base rate. */
export const ODDS_SHRINK = 10;

/**
 * The odds table: for every age band and TVL tier, the share of peer protocols that record a
 * token, shrunk toward the base rate. Peers are the protocols that are not an excluded product:
 * the same set the board draws from. A cell with few peers leans on the base rate, so no single
 * small cell can swing a row's odds. The Brier test scores the odds blind: each peer's odds are
 * taken from a table built without it, and the score is the mean squared gap to the truth
 * (1 when the peer records a token, 0 when it does not), against the flat base rate's score.
 */
export function oddsTable(snapshot: Snapshot): OddsTable {
  const peers = snapshot.protocols.filter((p) => !isExcludedProduct(p));
  const withToken = peers.filter((p) => !isPreToken(p)).length;
  const base = peers.length === 0 ? 0 : withToken / peers.length;
  const cells = new Map<string, { age_band: string; tvl_tier: string; peers: number; with_token: number }>();
  for (const p of peers) {
    const key = `${ageBand(ageDays(snapshot.as_of, p.listed_at))}|${tvlTier(p.tvl_usd)}`;
    const cell = cells.get(key) ?? { age_band: ageBand(ageDays(snapshot.as_of, p.listed_at)), tvl_tier: tvlTier(p.tvl_usd), peers: 0, with_token: 0 };
    cell.peers += 1;
    if (!isPreToken(p)) cell.with_token += 1;
    cells.set(key, cell);
  }
  const list: OddsCell[] = [...cells.values()]
    .map((c) => ({
      age_band: c.age_band,
      tvl_tier: c.tvl_tier,
      peers: c.peers,
      with_token: c.with_token,
      odds: (c.with_token + ODDS_SHRINK * base) / (c.peers + ODDS_SHRINK),
    }))
    .sort((a, b) => {
      const ageOrder = ['under 6 months', '6–12 months', '1–2 years', '2–3 years', '3 years or more', 'unknown'];
      const tierOrder = ['under $50M', '$50–250M', '$250M–$1B', '$1B or more'];
      return ageOrder.indexOf(a.age_band) - ageOrder.indexOf(b.age_band) || tierOrder.indexOf(a.tvl_tier) - tierOrder.indexOf(b.tvl_tier);
    });
  let brier = 0;
  let brierFlat = 0;
  for (const p of peers) {
    const cell = peers.filter(
      (q) =>
        q.slug !== p.slug &&
        ageBand(ageDays(snapshot.as_of, q.listed_at)) === ageBand(ageDays(snapshot.as_of, p.listed_at)) &&
        tvlTier(q.tvl_usd) === tvlTier(p.tvl_usd),
    );
    const wt = cell.filter((q) => !isPreToken(q)).length;
    const o = (wt + ODDS_SHRINK * base) / (cell.length + ODDS_SHRINK);
    const actual = isPreToken(p) ? 0 : 1;
    brier += (o - actual) ** 2;
    brierFlat += (base - actual) ** 2;
  }
  return {
    base_rate: base,
    base_with_token: withToken,
    base_peers: peers.length,
    shrink: ODDS_SHRINK,
    brier: peers.length === 0 ? 0 : brier / peers.length,
    brier_flat: peers.length === 0 ? 0 : brierFlat / peers.length,
    cells: list,
  };
}

/** One protocol's token odds from the table: its cell, or the base rate when the cell is empty. */
function oddsOf(p: SnapshotProtocol, snapshot: Snapshot, table: OddsTable): { odds: number; cell: string } {
  const cell = `${ageBand(ageDays(snapshot.as_of, p.listed_at))}|${tvlTier(p.tvl_usd)}`;
  const found = table.cells.find((c) => `${c.age_band}|${c.tvl_tier}` === cell);
  if (!found) return { odds: table.base_rate, cell };
  return { odds: found.odds, cell };
}

// ---------------------------------------------------------------- value

/** The launch value one protocol gets under the fitted curve, whole dollars. */
function launchValue(p: SnapshotProtocol, fit: CurveFit): number {
  if (fit.comparables < 10) {
    // The fallback path: no curve could be fitted, so the flat median multiple prices the row.
    return Math.max(1, Math.round(p.tvl_usd * fit.flat_multiple));
  }
  return Math.max(1, Math.round(Math.pow(10, fit.intercept + fit.slope * logTvl(p))));
}

/** The four numbers one protocol gets: launch value, odds, implied value, and its range. */
export function impliedValue(
  protocol: SnapshotProtocol,
  snapshot: Snapshot,
  fit: CurveFit,
  table: OddsTable,
): { launch: number; odds: number; cell: string; implied: number; low: number; high: number; age: number | null } {
  const age = ageDays(snapshot.as_of, protocol.listed_at);
  const launch = launchValue(protocol, fit);
  const { odds, cell } = oddsOf(protocol, snapshot, table);
  const implied = Math.max(1, Math.round(launch * odds));
  const low = Math.max(1, Math.round(implied * Math.pow(10, fit.resid_p10)));
  const high = Math.max(1, Math.round(implied * Math.pow(10, fit.resid_p90)));
  return { launch, odds, cell, implied, low, high, age };
}

// ---------------------------------------------------------------- farming economics

/** What one transaction costs on a chain, in dollars, from the chain's own gas price. */
const GAS_USD: Record<string, number> = {
  Ethereum: 8, Tron: 1, Avalanche: 0.3, Binance: 0.3, Bittensor: 0.1, Arbitrum: 0.2,
  Optimism: 0.05, Base: 0.05, Monad: 0.05, Plasma: 0.05, Berachain: 0.05, Polygon: 0.05,
  Flare: 0.05, Ink: 0.05, Robinhood: 0.05, Solana: 0.01, 'Hyperliquid L1': 0.01, Stellar: 0.01,
};

const DEFAULT_GAS_USD = 1;

/** The gas cost of one transaction on a chain, or the default when the chain is unknown. */
export function gasUsd(chain: string): number {
  return GAS_USD[chain] ?? DEFAULT_GAS_USD;
}

/** The cheapest chain a protocol runs on, and what one transaction costs there. */
export function cheapestChain(chains: string[]): { chain: string; gas: number } {
  let best: string | null = null;
  let bestGas = Infinity;
  for (const c of chains) {
    const g = gasUsd(c);
    if (g < bestGas) {
      best = c;
      bestGas = g;
    }
  }
  if (best === null) return { chain: 'Ethereum', gas: gasUsd('Ethereum') };
  return { chain: best, gas: bestGas };
}

/**
 * The farming economics of one row at one ticket and one airdrop share. The slice is the
 * row's share of the implied value, proportional to the ticket over the protocol's TVL;
 * the fees are the plan's transactions at the cheapest chain's gas; the net is the slice
 * minus the fees. FARM means the net beats $25 an hour, MARGINAL means it is positive but
 * below that bar, SKIP means the fees eat the slice.
 */
export function economics(implied: number, tvl: number, chain: string, ticket = ECON_TICKET, drop = ECON_DROP): Economics {
  const slice = tvl > 0 ? (implied * drop * ticket) / tvl : 0;
  const fees = ECON_TXNS * gasUsd(chain);
  const net = slice - fees;
  const perHour = net / ECON_HOURS;
  const verdict: Economics['verdict'] = net > 0 && perHour >= ECON_HOURLY_BAR ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
  return { ticket_usd: ticket, drop_share: drop, slice_usd: slice, fees_usd: fees, net_usd: net, net_per_hour_usd: perHour, verdict };
}

// ---------------------------------------------------------------- the farm plan

/** The hold window a row's plan asks for, from how long the protocol has been live. */
function holdDays(age: number | null): number {
  if (age === null) return 45;
  if (age < 365) return 30;
  if (age < 730) return 45;
  return 60;
}

/** The first action a farm plan takes, from the protocol's category. */
function firstAction(p: SnapshotProtocol, ticket: number): string {
  switch (p.category) {
    case 'DEX':
      return `Swap $${ticket} for a token that is not a stablecoin in ${p.name}'s pool and leave the position open — the swap is the first on-chain action the snapshot can see.`;
    case 'Lending':
      return `Supply $${ticket} of a stablecoin as collateral and borrow a small amount against it — the borrow is the action that shows up as real use, not just a deposit.`;
    case 'Derivatives':
      return `Open a small perpetual position with $${ticket} of margin and hold it through the week — a position closed the same day reads as a test, not as use.`;
    case 'CDP':
      return `Mint $${ticket} of the protocol's stablecoin against collateral and keep the vault open — the mint is the action that marks the wallet as a user.`;
    case 'Yield':
      return `Deposit $${ticket} into ${p.name}'s main vault and leave it earning — the deposit is the action that marks the wallet as a user.`;
    default:
      return `Use ${p.name}'s main action with $${ticket} — the one its own docs call the primary way in — and leave the position open.`;
  }
}

/** The second, different action a farm plan takes, from the protocol's category. */
function secondAction(p: SnapshotProtocol, ticket: number): string {
  switch (p.category) {
    case 'DEX':
      return `Add the same $${ticket} to the pool as liquidity, so the wallet has two kinds of activity — a swap and a deposit — instead of one action repeated.`;
    case 'Lending':
      return `Repay half the borrow and supply a second asset, so the wallet has two kinds of activity — a supply and a repayment — instead of one action repeated.`;
    case 'Derivatives':
      return `Close the position and open a fresh one on a different market, so the wallet has two kinds of activity — a close and an open — instead of one action repeated.`;
    case 'CDP':
      return `Repay part of the minted stablecoin and open a second vault, so the wallet has two kinds of activity instead of one action repeated.`;
    default:
      return `Do a second, different action the protocol offers with $${ticket}, so the wallet has two kinds of activity instead of one action repeated.`;
  }
}

/** The risk a farm plan names, from the protocol's category. */
function riskNote(p: SnapshotProtocol): string {
  switch (p.category) {
    case 'DEX':
      return `This is a DEX: the risk is impermanent loss on the pool and a bug in the router contract, so keep the position small enough that losing it outright still leaves the farm's expected value positive.`;
    case 'Lending':
      return `This is a lending market: the risk is liquidation if the collateral falls and bad debt if the market turns, so borrow well below the limit and watch the health factor.`;
    case 'Derivatives':
      return `This is a derivatives market: the risk is funding payments and liquidation on a sharp move, so keep the leverage low and the position small.`;
    case 'CDP':
      return `This is a CDP: the risk is the stablecoin losing its peg and the vault being liquidated, so keep the collateral ratio high and watch the peg.`;
    case 'Yield':
      return `This is a yield vault: the risk is the strategy behind the vault and the contracts it touches, so read what the vault actually does before depositing.`;
    default:
      return `This protocol's risk is a smart-contract bug or the team pausing it, so keep the position small enough that losing it outright still leaves the farm's expected value positive.`;
  }
}

/** The full farm plan for one row: eight steps, plus three more for the top twenty-five. */
export function farmSteps(p: SnapshotProtocol, econ: Economics, rank: number, age: number | null): string[] {
  const ticket = econ.ticket_usd;
  const hold = holdDays(age);
  const ageText = age === null ? 'an unknown age' : `${age} days live`;
  const steps: string[] = [
    `Open a fresh wallet, write the seed phrase down offline, and move $${ticket} in on ${cheapestChain(p.chains).chain} — keep the farming wallet apart from the one you trade from, so a bad link can only reach the farm. Gas about $${gasUsd(cheapestChain(p.chains).chain)}; 10 minutes.`,
    `${firstAction(p, ticket)} Gas about $${gasUsd(cheapestChain(p.chains).chain)}; 10 minutes.`,
    `Return once a week and do a different action — add liquidity, stake, or borrow — so the wallet reads as a regular user, not a one-off airdrop hunter. Gas about $${gasUsd(cheapestChain(p.chains).chain)} a visit; 10 minutes a week.`,
    `Keep the position in place for ${hold} days without moving it — ${p.name} has ${ageText}, and a hold that long is what a long-term user would show. No gas; ${hold} days.`,
    `${secondAction(p, ticket)} Gas about $${gasUsd(cheapestChain(p.chains).chain)}; 10 minutes.`,
    `Open ${p.name}'s points or rewards page once a month and confirm the wallet shows up with its activity — if it does not, the actions above are not being counted and the plan needs changing. No gas; 5 minutes a month.`,
    `${riskNote(p)} No gas; read before you start.`,
    `Write every transaction hash, date and gas cost in a small log, and stop the farm when the fees pass the expected slice — the log is what turns a guess into a number. No gas; 5 minutes a week.`,
  ];
  if (rank <= 25) {
    const growth = p.change_7d;
    const growthText =
      growth === null
        ? 'TVL has no seven-day change recorded, so start small and add to the position only if TVL turns up.'
        : growth > 0
          ? `TVL moved +${growth.toFixed(1)}% in the last seven days — a growing pool is where the team is shipping, so start the farm this week while the growth is fresh.`
          : `TVL moved ${growth.toFixed(1)}% in the last seven days — the pool is flat or shrinking, so start small and add to the position only if TVL turns up.`;
    steps.push(
      `${growthText} No gas; read before you start.`,
      `${p.name} runs on ${p.chains.join(', ')}; ${cheapestChain(p.chains).chain} is the cheapest to use at about $${gasUsd(cheapestChain(p.chains).chain)} a transaction, so run every action there and keep the other chains untouched. Gas about $${gasUsd(cheapestChain(p.chains).chain)}; no extra time.`,
      `At a $${ticket} ticket and a ${Math.round(econ.drop_share * 100)}% airdrop share, this row's expected slice is $${econ.slice_usd.toFixed(2)} against $${econ.fees_usd.toFixed(2)} in fees — ${econ.verdict === 'FARM' ? 'the numbers say farm it.' : econ.verdict === 'MARGINAL' ? 'the numbers say farm it only if you already use this chain.' : 'the numbers say skip it — the fees eat the slice.'} No gas; read before you start.`,
    );
  }
  return steps;
}

// ---------------------------------------------------------------- the board

/** The 32-bit FNV-1a checksum of a string, as eight hex digits. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The canonical string one row contributes to the integrity checksum. */
function rowChecksumString(r: RadarRow): string {
  return [r.rank, r.slug, r.implied_value_usd, r.launch_value_usd, r.token_odds, r.range_low_usd, r.range_high_usd, r.economics.verdict].join('|');
}

/**
 * Build the whole radar from a snapshot: fit the curve, build the odds table, rank every
 * rankable protocol by implied value, and count the ledger. The board is sorted by implied
 * value descending, ties broken by slug, so the order is the same on every run.
 */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fit = fitCurve(snapshot);
  const odds = oddsTable(snapshot);
  const rankable = snapshot.protocols.filter(isRankable);
  const priced = rankable
    .map((p) => ({ p, v: impliedValue(p, snapshot, fit, odds) }))
    .sort((a, b) => (b.v.implied - a.v.implied) || (a.p.slug < b.p.slug ? -1 : 1));

  const rows: RadarRow[] = priced.map(({ p, v }, i) => {
    const { chain, gas } = cheapestChain(p.chains);
    const econ = economics(v.implied, p.tvl_usd, chain);
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      age_days: v.age,
      implied_value_usd: v.implied,
      launch_value_usd: v.launch,
      token_odds: v.odds,
      odds_cell: v.cell,
      range_low_usd: v.low,
      range_high_usd: v.high,
      farm_chain: chain,
      farm_gas_usd: gas,
      economics: econ,
      farm_steps: farmSteps(p, econ, i + 1, v.age),
    };
  });

  const live: LiveRow[] = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && !isExcludedProduct(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
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

  const tokenCount = snapshot.protocols.filter((p) => !isPreToken(p) && !isExcludedProduct(p)).length;
  const excludedCount = snapshot.protocols.filter(isExcludedProduct).length;
  const preTokenCount = snapshot.protocols.filter(isPreToken).length;
  const liveTotal = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && !isExcludedProduct(p))
    .reduce((s, p) => s + (p.mcap_usd ?? 0), 0);
  const watchlistSet = new Set(snapshot.watchlist);
  const covered = rows.filter((r) => watchlistSet.has(r.slug)).length;
  const totalImplied = rows.reduce((s, r) => s + r.implied_value_usd, 0);
  const totalTvl = rows.reduce((s, r) => s + r.tvl_usd, 0);

  const board: BoardRow[] = rows.map((r) => ({
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    mcap_usd: null,
    listed_at: snapshot.protocols.find((p) => p.slug === r.slug)?.listed_at ?? null,
    gecko_id: null,
    symbol: null,
    token_status: 'pre-token',
    age_days: r.age_days,
    implied_value_usd: r.implied_value_usd,
    model: {
      launch_value_usd: r.launch_value_usd,
      token_odds: r.token_odds,
      odds_cell: r.odds_cell,
      odds_base_rate: odds.base_rate,
      range_low_usd: r.range_low_usd,
      range_high_usd: r.range_high_usd,
      curve_intercept: fit.intercept,
      curve_slope: fit.slope,
      comparables: fit.comparables,
      age_days: r.age_days,
      farm_chain: r.farm_chain,
      farm_gas_usd: r.farm_gas_usd,
    },
    economics: r.economics,
    farm_steps: r.farm_steps,
  }));

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    fit,
    odds,
    fit_points: comparables(snapshot.protocols)
      .map((p) => ({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd ?? 0 }))
      .sort((a, b) => a.tvl_usd - b.tvl_usd),
    ledger: [
      { label: 'ranked pre-token', count: rows.length, kind: 'ranked' },
      { label: 'already has a token', count: tokenCount, kind: 'token' },
      { label: 'wrapped, staked or bridged product', count: excludedCount, kind: 'out' },
    ],
    integrity: {
      rows: rows.length,
      watchlist_covered: covered,
      watchlist_total: snapshot.watchlist.length,
      total_implied_usd: totalImplied,
      total_tvl_usd: totalTvl,
      checksum: fnv1a(rows.map(rowChecksumString).join('\n')),
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: rows.length,
    early_size: rows.filter((r) => r.age_days !== null && r.age_days < 365).length,
    live_size: live.length,
    live_total: liveTotal,
    excluded_size: excludedCount,
    pre_token_size: preTokenCount,
    watchlist: snapshot.watchlist,
    rows,
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------- validation

/** Check a parsed snapshot carries the fields the model needs, and say what is missing. */
export function validateSnapshot(value: unknown): Snapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SnapshotError('snapshot.json is not an object');
  }
  const v = value as Record<string, unknown>;
  if (typeof v.as_of !== 'string' || v.as_of.length === 0) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof v.source !== 'string' || v.source.length === 0) throw new SnapshotError('snapshot.json has no source');
  if (typeof v.floor_usd !== 'number' || !Number.isFinite(v.floor_usd)) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(v.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(v.watchlist)) throw new SnapshotError('snapshot.json has no watchlist array');
  for (const p of v.protocols as unknown[]) {
    if (typeof p !== 'object' || p === null || Array.isArray(p)) throw new SnapshotError('snapshot.json holds a protocol that is not an object');
    const q = p as Record<string, unknown>;
    const bad = (f: string, ok: boolean): void => {
      if (!ok) throw new SnapshotError(`protocol ${String(q.slug ?? '?')} has a bad ${f}`);
    };
    bad('slug', typeof q.slug === 'string' && q.slug.length > 0);
    bad('name', typeof q.name === 'string' && q.name.length > 0);
    bad('category', q.category === null || typeof q.category === 'string');
    bad('chains', Array.isArray(q.chains) && (q.chains as unknown[]).every((c) => typeof c === 'string'));
    bad('tvl_usd', typeof q.tvl_usd === 'number' && Number.isFinite(q.tvl_usd) && q.tvl_usd > 0);
    bad('change_7d', q.change_7d === null || typeof q.change_7d === 'number');
    bad('mcap_usd', q.mcap_usd === null || (typeof q.mcap_usd === 'number' && Number.isFinite(q.mcap_usd)));
    bad('listed_at', q.listed_at === null || typeof q.listed_at === 'string');
    bad('gecko_id', q.gecko_id === null || typeof q.gecko_id === 'string');
    bad('symbol', q.symbol === null || typeof q.symbol === 'string');
  }
  return value as Snapshot;
}

/** Check a board against the competition's own gate, and name the first problem found. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board has ${board.length} rows, outside 100–4000`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<number>();
  let prev = Infinity;
  const implied = new Set<number>();
  for (const r of board) {
    if (!slugs.has(r.slug)) return `row ${r.rank} has a slug that is not in the snapshot`;
    if (!Number.isInteger(r.rank) || r.rank < 1 || r.rank > board.length || seen.has(r.rank)) return `row ${r.slug} has a bad rank`;
    seen.add(r.rank);
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return `row ${r.slug} has a bad implied value`;
    if (r.implied_value_usd > prev) return `row ${r.slug} breaks the descending order`;
    prev = r.implied_value_usd;
    implied.add(r.implied_value_usd);
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `row ${r.slug} has ${r.farm_steps.length} farm steps, outside 3–12`;
    for (const s of r.farm_steps) {
      if (s.length < 20 || s.length > 600) return `row ${r.slug} has a farm step of ${s.length} characters, outside 20–600`;
    }
  }
  if (implied.size === 1) return 'every row has the same implied value';
  const watchlist = new Set(snapshot.watchlist);
  const covered = board.filter((r) => watchlist.has(r.slug)).length;
  if (covered !== snapshot.watchlist.length) return `watchlist coverage is ${covered}/${snapshot.watchlist.length}`;
  return null;
}

/** The dashboard's data file: one assignment the page reads. */
export function dataScript(data: RadarData): string {
  return `window.RADAR = ${JSON.stringify(data)};\n`;
}
