// Token Radar's page: a dense screener table. It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, the fitted model's evidence, and a
// per-protocol detail page with the farm plan. No network: every byte it shows is in data.js.
//
// The table is the product: one row per token, sorted by implied value, with the range, the
// odds and the costed verdict printed beside the value, so each row is checkable without
// leaving the table. The economics controls recompute every row's verdict in the page from
// the same arithmetic the model used, at the capital share and airdrop share the reader picks.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var WATCH = new Set(DATA.watchlist || []);
  var GAS = { Ethereum: 8, Tron: 1, Avalanche: 0.3, Binance: 0.3, Bittensor: 0.1, Arbitrum: 0.2, Optimism: 0.05, Base: 0.05, Monad: 0.05, Plasma: 0.05, Berachain: 0.05, Polygon: 0.05, Flare: 0.05, Ink: 0.05, Robinhood: 0.05, Solana: 0.01, 'Hyperliquid L1': 0.01, Stellar: 0.01 };

  var params = new URLSearchParams(window.location.search);
  var state = {
    view: params.get('view') || 'board',
    p: params.get('p') || '',
    q: params.get('q') || '',
    category: params.get('cat') || 'all',
    chain: params.get('chain') || 'all',
    watchlist: params.get('wl') === '1',
    minTvl: Number(params.get('minTvl')) || 0,
    tab: params.get('tab') || 'pre-token',
    verdict: params.get('verdict') || 'all',
    capPct: Number(params.get('cap')) || 0.02,
    drop: Number(params.get('drop')) || 7,
    sort: params.get('sort') || 'implied',
    dir: params.get('dir') === 'asc' ? 1 : -1,
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + n.toFixed(0);
  }
  function money2(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var sign = n < 0 ? '-' : '';
    var a = Math.abs(n);
    if (a >= 1000) return sign + money(a);
    return sign + '$' + a.toFixed(2);
  }
  function moneyFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function ageFmt(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function mult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return 'x' + n.toFixed(2);
  }

  /** The gas cost of one transaction on a chain, or $1 when the chain is unknown. */
  function gasOf(chain) { return GAS[chain] === undefined ? 1 : GAS[chain]; }

  /** One row's economics at the reader's capital share and airdrop share, same arithmetic as the model. */
  function econOf(row) {
    var capital = Math.round(Math.min(50000, Math.max(100, (state.capPct / 100) * row.tvl_usd)));
    var slice = row.tvl_usd > 0 ? (row.implied_value_usd * (state.drop / 100) * capital) / row.tvl_usd : 0;
    var fees = 8 * gasOf(row.farm_chain);
    var net = slice - fees;
    var perHour = net / 2.5;
    var verdict = net > 0 && perHour >= 25 ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
    return { capital: capital, slice: slice, fees: fees, net: net, perHour: perHour, verdict: verdict };
  }

  /** The 32-bit FNV-1a checksum of a string, as eight hex digits — the same as main.ts uses. */
  function fnv1a(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  /** The checksum of the board the page shows, recomputed from the table's own rows. */
  function boardChecksum() {
    return fnv1a(DATA.rows.map(function (r) {
      return [r.rank, r.slug, r.implied_value_usd, r.launch_value_usd, r.token_odds, r.range_low_usd, r.range_high_usd, r.economics.verdict].join('|');
    }).join('\n'));
  }

  // The range bar's log scale spans the whole board, so bars are comparable across rows.
  var RANGE_MIN = Math.min.apply(null, DATA.rows.map(function (r) { return r.range_low_usd; }));
  var RANGE_MAX = Math.max.apply(null, DATA.rows.map(function (r) { return r.range_high_usd; }));
  var LOG_MIN = Math.log10(Math.max(1, RANGE_MIN));
  var LOG_MAX = Math.log10(Math.max(2, RANGE_MAX));
  function rangeBar(row) {
    var w = 110, h = 14;
    var x = function (v) { return 2 + ((Math.log10(Math.max(1, v)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (w - 4); };
    var x0 = x(row.range_low_usd), x1 = x(row.range_high_usd), xm = x(row.implied_value_usd);
    return '<svg class="rangebar" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<line x1="' + x0.toFixed(1) + '" y1="7" x2="' + x1.toFixed(1) + '" y2="7" stroke="#5c6675" stroke-width="2"/>' +
      '<line x1="' + xm.toFixed(1) + '" y1="2" x2="' + xm.toFixed(1) + '" y2="12" stroke="#34d399" stroke-width="2"/>' +
      '</svg>';
  }

  /** The scatter: the 92 traded tokens on log-log axes, the fitted line through them, range frame only. */
  function scatter() {
    var pts = DATA.fit_points || [];
    if (pts.length < 2) return '';
    var W = 760, H = 300, L = 56, R = 16, T = 12, B = 28;
    var xs = pts.map(function (p) { return Math.log10(p.tvl_usd); });
    var ys = pts.map(function (p) { return Math.log10(p.mcap_usd); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var px = function (x) { return L + ((x - x0) / (x1 - x0)) * (W - L - R); };
    var py = function (y) { return T + (1 - (y - y0) / (y1 - y0)) * (H - T - B); };
    var a = DATA.fit.intercept, b = DATA.fit.slope;
    var dots = pts.map(function (p) {
      return '<circle class="pt" cx="' + px(Math.log10(p.tvl_usd)).toFixed(1) + '" cy="' + py(Math.log10(p.mcap_usd)).toFixed(1) + '" r="3"/>';
    }).join('');
    var first = pts[0], last = pts[pts.length - 1];
    return '<div class="scatter"><svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter of market cap against TVL for the 92 traded tokens, with the fitted line">' +
      '<line class="axis" x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '"/>' +
      '<line class="axis" x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B) + '"/>' +
      '<text class="tick" x="' + L + '" y="' + (H - 8) + '">' + money(Math.pow(10, x0)) + ' TVL</text>' +
      '<text class="tick" x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">' + money(Math.pow(10, x1)) + ' TVL</text>' +
      '<text class="tick" x="' + (L - 6) + '" y="' + (H - B) + '" text-anchor="end">' + money(Math.pow(10, y0)) + '</text>' +
      '<text class="tick" x="' + (L - 6) + '" y="' + (T + 4) + '" text-anchor="end">' + money(Math.pow(10, y1)) + '</text>' +
      '<line class="fitline" x1="' + px(x0).toFixed(1) + '" y1="' + py(a + b * x0).toFixed(1) + '" x2="' + px(x1).toFixed(1) + '" y2="' + py(a + b * x1).toFixed(1) + '"/>' +
      dots +
      '<text class="lab" x="' + (px(Math.log10(first.tvl_usd)) + 8).toFixed(1) + '" y="' + (py(Math.log10(first.mcap_usd)) - 10).toFixed(1) + '">' + esc(first.name) + '</text>' +
      '<text class="lab" x="' + (px(Math.log10(last.tvl_usd)) - 8).toFixed(1) + '" y="' + (py(Math.log10(last.mcap_usd)) - 8).toFixed(1) + '" text-anchor="end">' + esc(last.name) + '</text>' +
      '</svg>' +
      '<p class="cap">Each dot is one traded token, market cap against TVL, both on a log scale. The green line is the base curve — market cap = 10^' + a.toFixed(4) + ' x TVL^' + b.toFixed(4) + ' — and each family shifts it: Trading x1.47, New tech x1.19, Infra x1.08, Real-world x1.07, Staking x0.89, Lending x0.76, Yield x0.73.</p></div>';
  }

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.view !== 'board') p.set('view', state.view);
    if (state.p) p.set('p', state.p);
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('cat', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.watchlist) p.set('wl', '1');
    if (state.minTvl) p.set('minTvl', String(state.minTvl));
    if (state.tab !== 'pre-token') p.set('tab', state.tab);
    if (state.verdict !== 'all') p.set('verdict', state.verdict);
    if (state.capPct !== 0.02) p.set('cap', String(state.capPct));
    if (state.drop !== 7) p.set('drop', String(state.drop));
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.dir === 1) p.set('dir', 'asc');
    var next = p.toString();
    window.history.replaceState(null, '', next ? window.location.pathname + '?' + next : window.location.pathname);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlist && !WATCH.has(r.slug)) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (state.verdict !== 'all' && econOf(r).verdict !== state.verdict) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function sortHead(label, key) {
    var arrow = state.sort === key ? (state.dir === 1 ? ' ↑' : ' ↓') : '';
    return '<th class="' + (key === 'name' ? '' : 'num') + '"><button type="button" data-sort="' + key + '">' + label + arrow + '</button></th>';
  }

  function chainsShort(chains) {
    var c = chains || [];
    if (c.length <= 3) return c.join(', ');
    return c.slice(0, 3).join(', ') + ' +' + (c.length - 3) + ' more';
  }

  function rowHtml(r) {
    var e = econOf(r);
    var vclass = e.verdict === 'FARM' ? 'verdict-farm' : e.verdict === 'MARGINAL' ? 'verdict-marginal' : 'verdict-skip';
    var change = r.change_7d === null ? '<span class="faint">n/a</span>' : '<span class="' + (r.change_7d >= 0 ? 'accent' : 'red') + '">' + pct(r.change_7d) + '</span>';
    return '<tr class="' + (WATCH.has(r.slug) ? 'wl' : '') + '">' +
      '<td class="num">' + r.rank + '<span class="rankrange" title="Rank range at the P25–P75 range">' + r.rank_low + '–' + r.rank_high + '</span></td>' +
      '<td class="name"><a href="?view=detail&p=' + encodeURIComponent(r.slug) + '">' + esc(r.name) + '</a>' +
      '<span class="slug">' + esc(r.slug) + (WATCH.has(r.slug) ? ' · watchlist' : '') + '</span>' +
      '<span class="cat">' + esc(r.category || 'Other') + ' · ' + esc(chainsShort(r.chains)) + '</span></td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + change + '</td>' +
      '<td class="num">' + ageFmt(r.age_days) + '</td>' +
      '<td class="num implied">' + rangeBar(r) + money(r.implied_value_usd) + '</td>' +
      '<td class="num odds">' + Math.round(r.token_odds * 100) + '%</td>' +
      '<td class="num">' + money(r.range_low_usd) + '–' + money(r.range_high_usd) + '</td>' +
      '<td><span class="' + vclass + '">' + e.verdict + '</span>' +
      '<span class="net">net ' + money2(e.net) + ' · ' + money2(e.perHour) + '/hr</span></td>' +
      '</tr>';
  }

  function boardHtml() {
    var list = sortedRows(filteredRows());
    var cats = [];
    DATA.rows.forEach(function (r) { var c = r.category || 'Other'; if (cats.indexOf(c) < 0) cats.push(c); });
    cats.sort();
    var chains = [];
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
    chains.sort();
    var farmCount = DATA.rows.filter(function (r) { return econOf(r).verdict === 'FARM'; }).length;
    var verdictCounts = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { verdictCounts[econOf(r).verdict]++; });
    var html = '<h1>Token Radar</h1>' +
      '<p class="lede">A screener for pre-token protocols, ranked by what a launch would be worth. ' +
      '<b>' + DATA.rows.length + ' rows</b>, top implied value <b>' + money(DATA.rows[0].implied_value_usd) + '</b> (' + esc(DATA.rows[0].name) + '), ' +
      '<b>' + farmCount + ' FARM</b> at capital ' + state.capPct + '% of TVL ($100–$50,000) and a ' + state.drop + '% airdrop share. ' +
      'The value comes from a curve fitted on the snapshot&rsquo;s own ' + DATA.fit.comparables + ' traded tokens, ' +
      'and the curve misses by ' + mult(DATA.fit.loo_median_miss) + ' leave-one-out against ' + mult(DATA.fit.flat_loo_median_miss) + ' for a flat multiple. ' +
      'Snapshot ' + esc(DATA.as_of) + ', ' + esc(DATA.source) + ', floor ' + money(DATA.floor_usd) + '.</p>' +
      '<div class="strip" aria-label="Ledger">' +
      DATA.ledger.map(function (g) { return '<span><b>' + g.count + '</b> ' + esc(g.label) + '</span>'; }).join('') +
      '<span><b>' + DATA.ledger.reduce(function (s, g) { return s + g.count; }, 0) + '</b> protocols in total</span>' +
      '</div>' +
      '<div class="ledgerbar" aria-hidden="true">' +
      DATA.ledger.map(function (g) {
        var cls = g.kind === 'ranked' ? 'seg-ranked' : g.kind === 'token' ? 'seg-token' : 'seg-out';
        return '<i class="' + cls + '" style="width:' + (g.count / 758 * 100).toFixed(1) + '%"></i>';
      }).join('') +
      '</div>' +
      '<div class="strip" aria-label="Integrity">' +
      '<span>this table = <span class="mono">board.json</span></span>' +
      '<span>ranks <b>1–' + DATA.rows.length + '</b></span>' +
      '<span>total implied <b>' + moneyFull(DATA.integrity.total_implied_usd) + '</b></span>' +
      '<span>total TVL <b>' + moneyFull(DATA.integrity.total_tvl_usd) + '</b></span>' +
      '<span>watchlist <b>' + DATA.integrity.watchlist_covered + '/' + DATA.integrity.watchlist_total + '</b></span>' +
      '<span>checksum <span class="mono">' + esc(DATA.integrity.checksum) + '</span> ' + (boardChecksum() === DATA.integrity.checksum ? '<span class="accent">matches — recomputed from this table</span>' : '<span class="red">mismatch</span>') + '</span>' +
      '</div>' +
      '<div class="controls">' +
      '<input type="search" id="q" placeholder="Search name or slug" value="' + esc(state.q) + '" aria-label="Search">' +
      '<select id="cat" aria-label="Category"><option value="all">All categories</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="chain" aria-label="Chain"><option value="all">All chains</option>' + chains.map(function (c) { return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<span class="vtabs" role="group" aria-label="Verdict">' +
      '<button type="button" data-verdict="all"' + (state.verdict === 'all' ? ' class="on"' : '') + '>All ' + DATA.rows.length + '</button>' +
      ['FARM', 'MARGINAL', 'SKIP'].map(function (v) { return '<button type="button" data-verdict="' + v + '"' + (state.verdict === v ? ' class="on"' : '') + '>' + v + ' ' + verdictCounts[v] + '</button>'; }).join('') +
      '</span>' +
      '<label>Capital <select id="cap">' + [0.005, 0.01, 0.02, 0.05].map(function (c) { return '<option value="' + c + '"' + (state.capPct === c ? ' selected' : '') + '>' + c + '% of TVL</option>'; }).join('') + '</select></label>' +
      '<label>Drop <select id="drop">' + [5, 7, 10, 15, 20].map(function (d) { return '<option value="' + d + '"' + (state.drop === d ? ' selected' : '') + '>' + d + '%</option>'; }).join('') + '</select></label>' +
      '<label><input type="checkbox" id="wl"' + (state.watchlist ? ' checked' : '') + '> Watchlist only</label>' +
      '<span class="tabs"><button type="button" data-tab="pre-token"' + (state.tab === 'pre-token' ? ' class="on"' : '') + '>Pre-token</button>' +
      '<button type="button" data-tab="live"' + (state.tab === 'live' ? ' class="on"' : '') + '>Live tokens (' + DATA.live.length + ')</button></span>' +
      '<span class="count">' + list.length + ' of ' + DATA.rows.length + ' rows</span>' +
      '</div>';
    if (state.tab === 'live') {
      html += '<table><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">7d</th></tr></thead><tbody>' +
        DATA.live.map(function (r) {
          return '<tr><td class="name">' + esc(r.name) + '<span class="slug">' + esc(r.slug) + '</span><span class="cat">' + esc(r.category || 'Other') + ' · ' + esc(chainsShort(r.chains)) + '</span></td>' +
            '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + money(r.mcap_usd) + '</td>' +
            '<td class="num">' + (r.change_7d === null ? '<span class="faint">n/a</span>' : pct(r.change_7d)) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p class="note">Live tokens are shown apart from the ranking: the market has already priced them, so there is nothing to imply. The live set of ' + DATA.live.length + ' is worth ' + money(DATA.live_total) + ' in total.</p>';
    } else {
      html += '<table><thead><tr><th class="num">Rank</th><th>Protocol</th>' +
        sortHead('TVL', 'tvl') + sortHead('7d', 'growth') + sortHead('Age', 'age') +
        sortHead('Implied', 'implied') + sortHead('Odds', 'odds') + '<th class="num">Range P10–P90</th><th>Verdict</th></tr></thead><tbody>' +
        list.map(rowHtml).join('') + '</tbody></table>';
      if (list.length === 0) html += '<p class="note">No rows match these filters.</p>';
    }
    html += evidenceHtml();
    html += '<footer>Token Radar ' + esc(DATA.model_version) + ' · snapshot ' + esc(DATA.as_of) + ' · ' +
      'implied value = launch value from the fitted curve x token odds from the peer table · ' +
      'range = P10–P90 of the leave-one-out residuals · ' +
      'verdict at capital ' + state.capPct + '% of TVL ($100–$50,000), ' + state.drop + '% airdrop share, 8 transactions, 2.5 hours.</footer>';
    return html;
  }

  function evidenceHtml() {
    var f = DATA.fit, o = DATA.odds;
    var html = '<h2>How the value is worked out</h2>' +
      '<p><span class="formula">implied = 10^(' + f.intercept.toFixed(4) + ' + ' + f.slope.toFixed(4) + ' x log10(TVL) + family offset) x token odds</span></p>' +
      '<p class="note">The curve is fitted on the ' + f.comparables + ' traded tokens in this snapshot — no protocol name is special-cased, and the same curve prices every row. ' +
      'Token odds come from the peer table: the share of protocols in the same age band and TVL tier that record a token, shrunk toward the base rate of ' + (o.base_rate * 100).toFixed(1) + '% (' + o.base_with_token + ' of ' + o.base_peers + ' peers). ' +
      'The range is the P10–P90 of the leave-one-out residuals, ' + f.resid_p10.toFixed(3) + ' to +' + f.resid_p90.toFixed(3) + ' in log10, and it holds ' + Math.round(f.range_coverage * 100) + '% of the traded tokens — and ' + Math.round(f.walk_range_p10_p90 * 100) + '% of the later-listed tokens in the walk-forward test, so the range is checked on held-out data, not only on the tokens that fitted it. The narrower P25–P75 range holds ' + Math.round(f.walk_range_p25_p75 * 100) + '% of later-listed tokens (stated 50%).</p>' +
      '<h3>Family effect — the one term that passed both blind tests</h3>' +
      '<table class="ev"><thead><tr><th>Family</th><th class="num">Traded tokens</th><th class="num">Offset</th><th class="num">Multiplier</th></tr></thead><tbody>' +
      f.family_offsets.map(function (g) {
        return '<tr><td>' + esc(g.family) + '</td><td class="num">' + g.n + '</td><td class="num">' + (g.offset >= 0 ? '+' : '') + g.offset.toFixed(3) + '</td><td class="num">x' + Math.pow(10, g.offset).toFixed(2) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="note">The 28 snapshot categories group into 7 families, and the family effect is shrunk by ridge regression (lambda ' + f.family_lambda + ') so no small family can swing a row on its own. It is a weak pass: leave-one-out ' + mult(f.loo_median_miss) + ' against the bare curve&rsquo;s ' + mult(f.bare_loo_median_miss) + ', walk-forward ' + mult(f.walk_pooled_median_miss) + ' against ' + mult(f.bare_walk_pooled_median_miss) + ', and the paired leave-one-out count favours it 54 to 38 — and lambda 40 passes too, so the gain is not a single lucky penalty. The 2024 and 2026 folds worsen, so the gain is not overstated.</p>' +
      '<h3>Blind tests — the curve against a flat multiple, and against the bare curve</h3>' +
      '<table class="ev"><thead><tr><th>Test</th><th class="num">Curve miss</th><th class="num">Bare curve miss</th><th class="num">Flat miss</th><th class="num">Within 3x</th><th class="num">n</th></tr></thead><tbody>' +
      '<tr><td>Leave-one-out</td><td class="num">' + mult(f.loo_median_miss) + '</td><td class="num">' + mult(f.bare_loo_median_miss) + '</td><td class="num">' + mult(f.flat_loo_median_miss) + '</td><td class="num">' + Math.round(f.loo_within_3x * 100) + '%</td><td class="num">' + f.comparables + '</td></tr>' +
      '<tr><td>Walk-forward, pooled</td><td class="num">' + mult(f.walk_pooled_median_miss) + '</td><td class="num">' + mult(f.bare_walk_pooled_median_miss) + '</td><td class="num">' + mult(f.flat_walk_pooled_median_miss) + '</td><td class="num">—</td><td class="num">' + f.walk_pooled_n + '</td></tr>' +
      '<tr><td>Token odds, Brier score (lower is better)</td><td class="num">' + o.brier.toFixed(3) + '</td><td class="num">—</td><td class="num">' + o.brier_flat.toFixed(3) + '</td><td class="num">—</td><td class="num">' + o.base_peers + '</td></tr>' +
      '</tbody></table>' +
      '<p class="note">The odds call ' + o.called_right + ' of ' + o.base_peers + ' peers right at the 50% line (' + (o.called_right / o.base_peers * 100).toFixed(1) + '%), against ' + o.called_right_flat + ' (' + (o.called_right_flat / o.base_peers * 100).toFixed(1) + '%) for the base rate alone.</p>' +
      '<h3>Walk-forward folds — fit on older tokens, tested on the next year</h3>' +
      '<table class="ev"><thead><tr><th>Test year</th><th class="num">Fit on</th><th class="num">Tested</th><th class="num">Curve miss</th><th class="num">Flat miss</th><th class="num">Within 3x</th></tr></thead><tbody>' +
      f.walk_folds.map(function (w) {
        return '<tr><td>' + esc(w.cut.slice(0, 4)) + '</td><td class="num">' + w.fit_n + '</td><td class="num">' + w.test_n + '</td><td class="num">' + mult(w.median_miss) + '</td><td class="num">' + mult(w.flat_median_miss) + '</td><td class="num">' + Math.round(w.within_3x * 100) + '%</td></tr>';
      }).join('') + '</tbody></table>' +
      (f.walk_folds.length ? '<p class="note">The newest fold, ' + esc(f.walk_folds[f.walk_folds.length - 1].cut.slice(0, 4)) + ', is the hardest — nine recent tokens with extreme dispersion, and the curve loses to the flat multiple there, ' + mult(f.walk_folds[f.walk_folds.length - 1].median_miss) + ' against ' + mult(f.walk_folds[f.walk_folds.length - 1].flat_median_miss) + '. The pooled walk-forward still beats flat, ' + mult(f.walk_pooled_median_miss) + ' against ' + mult(f.flat_walk_pooled_median_miss) + ', because the three earlier folds win by more — but the newest cohort is where the model is weakest, and the board says so rather than hiding it.</p>' : '');
    if (f.rejected.length) {
      html += '<h3>Terms tested and rejected</h3>' +
        '<table class="ev"><thead><tr><th>Term</th><th class="num">Leave-one-out miss</th><th class="num">Walk-forward miss</th><th>Why not</th></tr></thead><tbody>' +
        f.rejected.map(function (r) {
          return '<tr><td>' + esc(r.term) + '</td><td class="num">' + mult(r.loo_median_miss) + '</td><td class="num">' + mult(r.walk_median_miss) + '</td><td>' + esc(r.reason) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p class="note">The bare curve misses by ' + mult(f.bare_loo_median_miss) + ' leave-one-out and ' + mult(f.bare_walk_pooled_median_miss) + ' walk-forward. A term is kept only when it beats the current model in both blind tests; the family effect above is the one that did.</p>';
    }
    html += '<h3>Token odds by age and size — peers, with token, odds</h3>' +
      '<table class="ev"><thead><tr><th>Age band</th><th>TVL tier</th><th class="num">Peers</th><th class="num">With token</th><th class="num">Odds</th></tr></thead><tbody>' +
      o.cells.map(function (c) {
        return '<tr><td>' + esc(c.age_band) + '</td><td>' + esc(c.tvl_tier) + '</td><td class="num">' + c.peers + '</td><td class="num">' + c.with_token + '</td><td class="num">' + Math.round(c.odds * 100) + '%</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="note">Each cell is shrunk toward the base rate with a strength of ' + o.shrink + ' peers, so a small cell cannot swing a row&rsquo;s odds on its own.</p>' +
      '<h3>Set aside — ' + DATA.set_aside.reduce(function (s, g) { return s + g.count; }, 0) + ' pre-token protocols left out of the ranking, by reason</h3>' +
      '<table class="ev"><thead><tr><th>Reason</th><th class="num">Protocols</th></tr></thead><tbody>' +
      DATA.set_aside.map(function (g) {
        return '<tr><td>' + esc(g.reason) + '</td><td class="num">' + g.count + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="note">These record no token, but they are a wrapped, staked or bridged product of a token that already trades — or an exchange&rsquo;s product, or a versioned pool — so they are not launches waiting to happen. The ledger counts ' + DATA.ledger.filter(function (g) { return g.kind === 'token'; })[0].count + ' protocols that already record a token, ' + DATA.rows.length + ' ranked, and these ' + DATA.set_aside.reduce(function (s, g) { return s + g.count; }, 0) + ' set aside, which is every protocol in the snapshot.</p>' +
      scatter();
    return html;
  }

  function detailHtml() {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.p) row = r; });
    if (!row) return '<a class="back" href="?">&larr; Back to the board</a><h1>Not on the board</h1><p class="note">No ranked row has the slug &ldquo;' + esc(state.p) + '&rdquo;.</p>';
    var e = econOf(row);
    var vclass = e.verdict === 'FARM' ? 'verdict-farm' : e.verdict === 'MARGINAL' ? 'verdict-marginal' : 'verdict-skip';
    return '<div class="detail"><a class="back" href="?">&larr; Back to the board</a>' +
      '<h1>' + esc(row.name) + '</h1>' +
      '<p class="muted mono">' + esc(row.slug) + ' · rank ' + row.rank + ' of ' + DATA.rows.length + ' (' + row.rank_low + '–' + row.rank_high + ' at the P25–P75 range)' + (WATCH.has(row.slug) ? ' · watchlist' : '') + '</p>' +
      '<div class="facts">' +
      '<span>Implied value <b>' + moneyFull(row.implied_value_usd) + '</b></span>' +
      '<span>Range P10–P90 <b>' + money(row.range_low_usd) + '–' + money(row.range_high_usd) + '</b></span>' +
      '<span>Token odds <b>' + Math.round(row.token_odds * 100) + '%</b> <span class="faint">(' + esc(row.odds_cell) + ')</span></span>' +
      '<span>Launch value <b>' + moneyFull(row.launch_value_usd) + '</b></span>' +
      '<span>Family <b>' + esc(row.family) + ' x' + Math.pow(10, row.family_offset).toFixed(2) + '</b></span>' +
      '<span>TVL <b>' + moneyFull(row.tvl_usd) + '</b></span>' +
      '<span>7d <b>' + (row.change_7d === null ? 'n/a' : pct(row.change_7d)) + '</b></span>' +
      '<span>Age <b>' + ageFmt(row.age_days) + '</b></span>' +
      '<span>Category <b>' + esc(row.category || 'Other') + '</b></span>' +
      '<span>Chains <b>' + esc((row.chains || []).join(', ')) + '</b></span>' +
      '</div>' +
      '<h2>Economics — at $' + e.capital.toLocaleString('en-US') + ' of capital (' + state.capPct + '% of TVL) and a ' + state.drop + '% airdrop share</h2>' +
      '<p class="note">Expected slice <b>' + money2(e.slice) + '</b> = implied x ' + state.drop + '% x ($' + e.capital.toLocaleString('en-US') + ' / TVL). ' +
      'Fees <b>' + money2(e.fees) + '</b> = 8 transactions on ' + esc(row.farm_chain) + ' at $' + row.farm_gas_usd + ' each. ' +
      'Net <b>' + money2(e.net) + '</b>, or <b>' + money2(e.perHour) + ' an hour</b> over 2.5 hours. ' +
      'Verdict: <span class="' + vclass + '">' + e.verdict + '</span> — FARM beats $25 an hour, MARGINAL is positive but below that bar, SKIP means the fees eat the slice. ' +
      'Change the capital share or the drop share on the board and the verdict here follows.</p>' +
      '<h2>Farm plan — ' + row.farm_steps.length + ' steps</h2>' +
      '<ol class="plan">' + row.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<h2>Where the number comes from</h2>' +
      '<p class="note">Launch value ' + moneyFull(row.launch_value_usd) + ' from the fitted curve (10^' + DATA.fit.intercept.toFixed(4) + ' x TVL^' + DATA.fit.slope.toFixed(4) + ' x the ' + esc(row.family) + ' family offset x' + Math.pow(10, row.family_offset).toFixed(2) + ', fitted on ' + DATA.fit.comparables + ' traded tokens), ' +
      'times token odds ' + Math.round(row.token_odds * 100) + '% from the peer cell &ldquo;' + esc(row.odds_cell) + '&rdquo;. ' +
      'The range is the leave-one-out P10–P90, which holds ' + Math.round(DATA.fit.range_coverage * 100) + '% of the traded tokens, and ' + Math.round(DATA.fit.walk_range_p10_p90 * 100) + '% of later-listed tokens.</p>' +
      '</div>';
  }

  function render() {
    app.innerHTML = state.view === 'detail' ? detailHtml() : boardHtml();
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; syncUrl(); render(); });
    var cat = document.getElementById('cat');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; syncUrl(); render(); });
    var chain = document.getElementById('chain');
    if (chain) chain.addEventListener('change', function () { state.chain = chain.value; syncUrl(); render(); });
    var cap = document.getElementById('cap');
    if (cap) cap.addEventListener('change', function () { state.capPct = Number(cap.value); syncUrl(); render(); });
    var drop = document.getElementById('drop');
    if (drop) drop.addEventListener('change', function () { state.drop = Number(drop.value); syncUrl(); render(); });
    Array.prototype.forEach.call(app.querySelectorAll('[data-verdict]'), function (b) {
      b.addEventListener('click', function () { state.verdict = b.getAttribute('data-verdict'); syncUrl(); render(); });
    });
    var wl = document.getElementById('wl');
    if (wl) wl.addEventListener('change', function () { state.watchlist = wl.checked; syncUrl(); render(); });
    Array.prototype.forEach.call(app.querySelectorAll('[data-tab]'), function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); syncUrl(); render(); });
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-sort]'), function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = -1; }
        syncUrl(); render();
      });
    });
    window.__shotReady = true;
  }

  render();
})();
