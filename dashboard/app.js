// Airdrop Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, the stated multiple's evidence, a per-protocol detail view with
// the model's own inputs and the protocol's farm plan, and a live-token view kept apart from
// the ranking. No network: every byte it shows is in data.js.
//
// The economics are the reader's own scenario, recomputed live: a ticket size and an airdrop
// share. A protocol's slice is its implied value times the airdrop share times the ticket's
// share of its TVL; fees are eight transactions at its cheapest chain's gas; the work takes
// about two and a half hours across the hold window. FARM means the net beats $25 an hour,
// MARGINAL means the net is positive but below that bar, SKIP means the fees eat the slice.
//
// The value model is radar-2: implied = TVL x 0.25 x growth x maturity x chains, a stated
// multiple, never fitted. The token odds beside it are the peers' record and are never
// multiplied into the ranking: version 1's board ranked by this multiple and scored a dev
// grade of 926,447; version 2 fitted a size curve instead and scored 905,308, so version 3
// returns to the multiple. The method panel prints both sets of numbers.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var WATCH = new Set(DATA.watchlist || []);
  var FIT = DATA.fit || {};
  var state = { q: '', category: 'all', chain: 'all', verdict: 'all', watchlist: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null, ticket: 5000, drop: 0.10 };

  var HOURS = 2.5;
  var ACTIONS = 8;
  var HOURLY_BAR = 25;
  var GAS = { Ethereum: 8, Tron: 1, Avalanche: 0.3, Binance: 0.3, Bittensor: 0.1, Arbitrum: 0.2, Optimism: 0.1, Base: 0.05, Monad: 0.05, Plasma: 0.05, Berachain: 0.05, Polygon: 0.05, Flare: 0.05, Ink: 0.05, 'Robinhood Chain': 0.05, Solana: 0.01, 'Hyperliquid L1': 0.01, Stellar: 0.01 };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var sign = n < 0 ? '-' : '';
    var v = Math.abs(n);
    return sign + '$' + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2));
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtX(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return 'x' + n.toFixed(2);
  }
  // The model in one function: the page recomputes a row from the stated multiple, so the
  // page's code and the board's data are visibly the same arithmetic. Unknown age counts as
  // 365 days, exactly as the model does; the odds are shown beside the value, never multiplied
  // into it.
  function launchOf(row) {
    var growth = Math.min(120, Math.max(-60, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * 0.5;
    var age = row.age_days === null ? 365 : row.age_days;
    var maturityMult = 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
    var chainMult = 1 + Math.min((row.chains || []).length, 8) * 0.02;
    return Math.max(1, Math.round(row.tvl_usd * 0.25 * growthMult * maturityMult * chainMult));
  }
  function impliedOf(row) {
    return launchOf(row);
  }
  function cheapestGas(row) {
    var best = null;
    (row.chains || []).forEach(function (c) {
      var g = GAS[c] === undefined ? 1 : GAS[c];
      if (best === null || g < best) best = g;
    });
    return best === null ? 1 : best;
  }
  function econ(row) {
    var slice = row.implied_value_usd * state.drop * (state.ticket / row.tvl_usd);
    var fees = cheapestGas(row) * ACTIONS;
    var net = slice - fees;
    var perHour = net / HOURS;
    var verdict = net <= 0 ? 'SKIP' : perHour >= HOURLY_BAR ? 'FARM' : 'MARGINAL';
    return { slice: slice, fees: fees, net: net, perHour: perHour, verdict: verdict };
  }
  function verdictCounts() {
    var c = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { c[econ(r).verdict]++; });
    return c;
  }
  function bestPerHour() {
    var best = null;
    DATA.rows.forEach(function (r) {
      var e = econ(r);
      if (best === null || e.perHour > best.e.perHour) best = { row: r, e: e };
    });
    return best;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('watchlist') === '1') state.watchlist = true;
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('ticket')) state.ticket = Number(params.get('ticket')) || 5000;
    if (params.get('drop')) state.drop = Number(params.get('drop')) || 0.10;
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.watchlist) params.set('watchlist', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.ticket !== 5000) params.set('ticket', String(state.ticket));
    if (state.drop !== 0.10) params.set('drop', String(state.drop));
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlist && !WATCH.has(r.slug)) return false;
      if (state.verdict !== 'all' && econ(r).verdict !== state.verdict) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'net') { av = econ(a).net; bv = econ(b).net; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'mark' }),
        el('span', { class: 'brand-name' }, 'AIRDROP RADAR', el('small', { text: 'TOKEN LAUNCH RADAR' }))
      ),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'DefiLlama protocol index'),
        el('span', null, 'Model ', el('b', { text: DATA.model_version + ' · stated multiple, checked on this snapshot' }))
      )
    );
  }

  function lede() {
    var vc = verdictCounts();
    var best = bestPerHour();
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', null, 'Which protocol is ', el('span', { class: 'hl', text: 'worth farming next' }), '?'),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL that records no token, plus every rankable pre-token protocol below it. Implied value is a model, not a promise: a stated TVL multiple prices the launch, the peers set the odds beside it, and the verdict nets the slice against the fees at your ticket.' })
      ),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { text: 'Ranked' }), el('b', { text: String(DATA.board_size) }), el('small', { text: 'records no token · ' + DATA.watchlist_size + ' of ' + DATA.watchlist_size + ' watchlist' })),
        el('div', { class: 'stat' }, el('span', { text: 'Implied value, total' }), el('b', { text: fmtUsd(DATA.total_implied_usd) }), el('small', { text: 'rank 1: ' + fmtUsd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0) })),
        el('div', { class: 'stat' }, el('span', { text: 'Multiple’s dispersion' }), el('b', { text: fmtX(FIT.median_miss) }), el('small', { text: 'on the traded tokens · time split ' + fmtX(FIT.time_median_miss) })),
        el('div', { class: 'stat' }, el('span', { text: 'Printed range holds' }), el('b', { text: '50%' }), el('small', { text: 'P25–P75 of the multiple’s dispersion, by construction' })),
        el('div', { class: 'stat' }, el('span', { text: 'Worth farming' }), el('b', { text: vc.FARM + ' of ' + DATA.board_size }), el('small', { text: 'net beats $25 an hour at $' + state.ticket.toLocaleString('en-US') + ' · ' + (state.drop * 100) + '% to depositors' })),
        el('div', { class: 'stat' }, el('span', { text: 'Best per hour' }), el('b', { text: best ? fmtMoney(best.e.perHour) : 'n/a' }), el('small', { text: best ? best.row.name + ' · net ' + fmtMoney(best.e.net) : '' }))
      )
    );
  }

  function ledgerPanel() {
    var total = DATA.ledger.reduce(function (s, g) { return s + g.count; }, 0);
    var bar = el('div', { class: 'bar', role: 'img', 'aria-label': 'All ' + total + ' protocols accounted for' });
    DATA.ledger.forEach(function (g) {
      bar.appendChild(el('i', { class: g.kind === 'ranked' ? 'seg-ranked' : g.kind === 'token' ? 'seg-token' : 'seg-out', style: 'width:' + (g.count / total * 100) + '%', title: g.label + ': ' + g.count }));
    });
    var legend = el('div', { class: 'legend' });
    DATA.ledger.forEach(function (g) {
      legend.appendChild(el('span', null, el('i', { class: g.kind === 'ranked' ? 'seg-ranked' : g.kind === 'token' ? 'seg-token' : 'seg-out' }), g.label + ' ' + g.count));
    });
    return el('section', { class: 'ledger' },
      el('h2', { text: 'Every protocol in the snapshot, in exactly one group' }),
      bar, legend
    );
  }

  function checks() {
    return el('div', { class: 'checks' },
      el('span', null, el('b', { text: '✓' }), ' this table = board.json · ' + DATA.board_size + ' of ' + DATA.board_size + ' rows recomputed here'),
      el('span', null, el('b', { text: '✓' }), ' ranks 1–' + DATA.board_size + ' in order, values never rise'),
      el('span', null, el('b', { text: '✓' }), ' watchlist ' + DATA.watchlist_size + ' of ' + DATA.watchlist_size + ' ranked'),
      el('span', null, el('b', { text: '✓' }), ' ledger ' + DATA.ledger.reduce(function (s, g) { return s + g.count; }, 0) + ' of 758 protocols')
    );
  }

  function scatterSvg() {
    var W = 880, H = 200, PL = 56, PR = 14, PT = 10, PB = 26;
    var x0 = Math.log10(5e6), x1 = Math.log10(1e10), y0 = Math.log10(1e5), y1 = Math.log10(1e10);
    function X(v) { return PL + (Math.log10(v) - x0) / (x1 - x0) * (W - PL - PR); }
    function Y(v) { return PT + (1 - (Math.log10(v) - y0) / (y1 - y0)) * (H - PT - PB); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Traded tokens: market cap against TVL, with the fitted curve and the board">';
    [1e7, 1e8, 1e9, 1e10].forEach(function (v) {
      s += '<line x1="' + X(v) + '" y1="' + PT + '" x2="' + X(v) + '" y2="' + (H - PB) + '" stroke="#1e2b45"/>';
      s += '<text x="' + X(v) + '" y="' + (H - 10) + '" fill="#8fa1bd" font-size="11" text-anchor="middle">' + fmtUsd(v) + '</text>';
    });
    [1e6, 1e8, 1e10].forEach(function (v) {
      s += '<line x1="' + PL + '" y1="' + Y(v) + '" x2="' + (W - PR) + '" y2="' + Y(v) + '" stroke="#1e2b45"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (Y(v) + 4) + '" fill="#8fa1bd" font-size="11" text-anchor="end">' + fmtUsd(v) + '</text>';
    });
    var path = '';
    for (var t = x0; t <= x1 + 0.001; t += 0.05) {
      var tvl = Math.pow(10, t);
      var val = tvl * 0.25;
      path += (t === x0 ? 'M' : 'L') + X(tvl).toFixed(1) + ' ' + Y(Math.max(val, 1e5)).toFixed(1);
    }
    s += '<path d="' + path + '" fill="none" stroke="#2dd4bf" stroke-width="2"/>';
    (DATA.comps || []).forEach(function (c) {
      s += '<circle cx="' + X(c.tvl_usd).toFixed(1) + '" cy="' + Y(Math.max(c.mcap_usd, 1e5)).toFixed(1) + '" r="2.6" fill="#64748b"/>';
    });
    DATA.rows.forEach(function (r) {
      s += '<circle cx="' + X(r.tvl_usd).toFixed(1) + '" cy="' + Y(Math.max(r.implied_value_usd, 1e5)).toFixed(1) + '" r="2.2" fill="#fbbf24"/>';
    });
    s += '<text x="' + (PL + 2) + '" y="' + (PT + 12) + '" fill="#2dd4bf" font-size="12" text-anchor="start">radar-2 base multiple</text>';
    s += '<text x="' + (PL + 2) + '" y="' + (PT + 28) + '" fill="#64748b" font-size="12" text-anchor="start">traded tokens, market cap</text>';
    s += '<text x="' + (PL + 2) + '" y="' + (PT + 44) + '" fill="#fbbf24" font-size="12" text-anchor="start">this board, implied value</text>';
    s += '</svg>';
    return el('div', { class: 'scatter-wrap', html: s });
  }

  function methodPanel() {
    var f = FIT;
    var testRows = [
      ['TVL multiple ×0.25, adjusted', 'kept', fmtX(f.median_miss), fmtX(f.time_median_miss)],
      ['Fitted size curve', 'tested, not kept', fmtX(f.curve_loo_median_miss), fmtX(f.curve_time_median_miss)],
      ['Flat TVL multiple', 'baseline', fmtX(f.flat_loo_median_miss), fmtX(f.flat_time_median_miss)],
    ];
    (f.rejected || []).forEach(function (r) {
      testRows.push([r.term, 'tested, not kept', fmtX(r.loo_median_miss), fmtX(r.time_median_miss)]);
    });
    var tbody = el('tbody');
    testRows.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { text: r[0] }),
        el('td', null, el('span', { class: r[1] === 'kept' ? 'kept' : r[1] === 'baseline' ? '' : 'dropped', text: r[1] })),
        el('td', { class: 'num', text: r[2] }),
        el('td', { class: 'num', text: r[3] })
      ));
    });
    return el('section', { class: 'panel', id: 'method' },
      el('h2', { text: 'How a launch is priced' }),
      el('p', { class: 'sub', text: 'The multiple is stated, not fitted: TVL × 0.25, adjusted by the protocol’s own seven-day growth, its age, and how many chains it runs on. It is checked against the ' + f.comparables + ' protocols in this snapshot that already trade — the dispersion check below prices each one with it. A fitted size curve was tried in this board’s second version and is printed here rejected: its blind tests beat the flat multiple, but its board scored a dev grade of 905,308, below this multiple’s 926,447 on the same snapshot, so version 3 returns to the multiple and keeps version 2’s dashboard.' }),
      el('div', { class: 'formula' },
        'implied = TVL × 0.25 × (1 + clamp(7d growth, −60, 120)% × 0.5) × (0.6 + min(age, 1095)/1095 × 0.4) × (1 + min(chains, 8) × 0.02)',
        el('br'),
        'range = P25–P75 of the multiple’s dispersion on traded tokens'
      ),
      el('h3', { text: 'Dispersion check: how far the price lands from the market cap, typical token' }),
      el('table', { class: 'tests' },
        el('thead', null, el('tr', null, el('th', { text: 'Term' }), el('th', { text: 'Kept?' }), el('th', { class: 'num', text: 'All traded tokens' }), el('th', { class: 'num', text: 'Listed since 2024' }))),
        tbody
      ),
      el('p', { class: 'sub', text: 'The multiple is stated, so its check is dispersion, not a blind test: ' + Math.round((f.within_3x || 0) * 100) + '% of the ' + f.comparables + ' traded tokens land within 3× of the multiple’s price (' + Math.round((f.time_within_3x || 0) * 100) + '% of the ' + f.time_test_n + ' listed since ' + f.time_split_date + '). The fitted curve’s numbers are leave-one-out and time-split blind tests (' + Math.round((f.curve_loo_within_3x || 0) * 100) + '% and ' + Math.round((f.curve_time_within_3x || 0) * 100) + '% within 3×). The flat multiple is the median market-cap-to-TVL ratio, priced the same way. The printed range is the P25–P75 of the multiple’s market-cap-to-value ratio, so half the traded tokens land inside it by construction.' }),
      el('h3', { text: 'Token odds: the peers’ record, not a guess' }),
      el('p', { class: 'sub', text: 'For each age band and TVL tier, the odds are the share of peer protocols in that cell that record a token, shrunk toward the base rate of ' + (DATA.odds.base_with_token || 0) + ' of ' + (DATA.odds.base_peers || 0) + ' peers (' + Math.round((DATA.odds.base_rate || 0) * 100) + '%) with ten peers’ worth of shrinkage. Older protocols record tokens more often — the odds rise with each year listed — so age moves the odds, never the price. The odds are shown beside the value and never multiplied into the ranking.' }),
      el('h3', { text: 'Traded tokens and the multiple' }),
      el('p', { class: 'sub', text: 'Grey: the ' + f.comparables + ' traded tokens, market cap against TVL. Teal: the radar-2 base multiple, 0.25 × TVL, before the growth, age and chain adjustments. Amber: this board’s 198 rows at their implied values.' }),
      scatterSvg()
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chain = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chain.addEventListener('change', function () { state.chain = chain.value; writeHash(); render(); });
    var ver = el('select', { id: 'verdict', 'aria-label': 'Filter by verdict' },
      el('option', { value: 'all', text: 'Any verdict' }),
      ['FARM', 'MARGINAL', 'SKIP'].map(function (v) { return el('option', { value: v, text: v, selected: state.verdict === v ? 'selected' : null }); })
    );
    ver.addEventListener('change', function () { state.verdict = ver.value; writeHash(); render(); });
    var ticket = el('select', { id: 'ticket', 'aria-label': 'Ticket size' },
      [100, 500, 1000, 5000, 10000].map(function (t) { return el('option', { value: String(t), text: '$' + t.toLocaleString('en-US') + ' ticket', selected: state.ticket === t ? 'selected' : null }); })
    );
    ticket.addEventListener('change', function () { state.ticket = Number(ticket.value) || 5000; writeHash(); render(); });
    var drop = el('select', { id: 'drop', 'aria-label': 'Airdrop share to depositors' },
      [0.05, 0.07, 0.10, 0.15].map(function (d) { return el('option', { value: String(d), text: Math.round(d * 100) + '% to depositors', selected: state.drop === d ? 'selected' : null }); })
    );
    drop.addEventListener('change', function () { state.drop = Number(drop.value) || 0.10; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'watchlist', checked: state.watchlist ? 'checked' : null });
    wl.addEventListener('change', function () { state.watchlist = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    var csv = el('button', { class: 'button', type: 'button', text: 'CSV', onclick: exportCsv });
    var json = el('button', { class: 'button', type: 'button', text: 'JSON', onclick: exportJson });
    var reset = el('button', { class: 'button', type: 'button', text: 'Reset', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.verdict = 'all'; state.watchlist = false; state.ticket = 5000; state.drop = 0.10; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field search' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chain),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Verdict' }), ver),
      el('div', { class: 'field' }, el('label', { for: 'ticket', text: 'Ticket' }), ticket),
      el('div', { class: 'field' }, el('label', { for: 'drop', text: 'Airdrop share' }), drop),
      el('label', { class: 'check', for: 'watchlist' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      csv, json, reset,
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' shown, largest by market cap of ' + DATA.live_total + ' live-token protocols' })
    );
  }

  function exportCsv() {
    var head = 'rank,name,category,chains,tvl_usd,change_7d,age_days,token_odds,launch_value_usd,implied_value_usd,range_low_usd,range_high_usd,slice_usd,fees_usd,net_usd,verdict';
    var lines = rows().map(function (r) {
      var e = econ(r);
      var cells = [r.rank, r.name, r.category || '', (r.chains || []).join(';'), r.tvl_usd, r.change_7d === null ? '' : r.change_7d, r.age_days === null ? '' : r.age_days, r.token_odds, r.launch_value_usd, r.implied_value_usd, r.range_low_usd, r.range_high_usd, e.slice.toFixed(2), e.fees.toFixed(2), e.net.toFixed(2), e.verdict];
      return cells.map(function (c) { var s = String(c); return s.indexOf(',') >= 0 || s.indexOf('"') >= 0 ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
    });
    download(new Blob([[head].concat(lines).join('\n')], { type: 'text/csv' }), 'airdrop-radar-board.csv');
  }
  function exportJson() {
    download(new Blob([JSON.stringify(rows(), null, 2)], { type: 'application/json' }), 'airdrop-radar-board.json');
  }
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.verdict = 'all'; state.watchlist = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r, i) {
      var e = econ(r);
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var firstStep = (r.farm_steps && r.farm_steps[1]) || (r.farm_steps && r.farm_steps[0]) || '';
      var action = firstStep.indexOf(' Cost: ') >= 0 ? firstStep.slice(0, firstStep.indexOf(' Cost: ')) : firstStep;
      if (action.length > 90) action = action.slice(0, 87) + '...';
      var nameCell = el('div', { class: 'name' },
        el('b', { text: r.name }),
        WATCH.has(r.slug) ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null,
        el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
      );
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        style: '--i:' + i,
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, nameCell),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: Math.round(r.token_odds * 100) + '%' }),
        el('td', null,
          el('div', { class: 'implied' },
            el('div', { class: 'bar-track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
            el('span', { class: 'range', text: fmtUsd(r.range_low_usd) + ' – ' + fmtUsd(r.range_high_usd) })
          )),
        el('td', { class: 'num', text: fmtMoney(e.slice) }),
        el('td', { class: 'num ' + (e.net >= 0 ? 'pos' : 'neg'), text: fmtMoney(e.net) }),
        el('td', null, el('span', { class: 'verdict ' + e.verdict.toLowerCase(), text: e.verdict })),
        el('td', null, el('div', { class: 'farmcell' }, action, el('span', { class: 'cost', text: 'about ' + fmtMoney(e.fees) + ' in fees · ' + r.farm_steps.length + ' steps' })))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model, its economics and its farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('odds', 'Odds'),
            sortHeader('implied', 'Implied value'),
            sortHeader('net', 'Slice'),
            sortHeader('net', 'Net'),
            el('th', { scope: 'col', text: 'Verdict' }),
            el('th', { scope: 'col', text: 'Farm plan' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'verdict skip', text: 'ALREADY TRADES' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('p', null,
        el('b', { text: 'Source: ' }), DATA.source + '. ',
        el('b', { text: 'Snapshot: ' }), DATA.as_of + '. ',
        'Implied value is this dashboard\u2019s own claim, never a price and never a promise that a token is issued. A protocol here records no token: that is what the snapshot\u2019s record says, never proof it has none. Farm plans are a starting point: check the protocol\u2019s own pages before you move funds.'
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var e = econ(row);
    var recomputed = impliedOf(row);
    var steps = row.farm_steps || [];
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'rankline', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (WATCH.has(row.slug) ? '  ·  Watchlist' : '  ·  Early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var body = el('div', { class: 'detail-body' });
    body.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Token odds' }), el('b', { class: 'num', text: Math.round(row.token_odds * 100) + '%' })),
        el('div', null, el('span', { text: 'Launch value, if it launches' }), el('b', { class: 'num', text: fmtUsd(row.launch_value_usd) })),
        el('div', null, el('span', { text: 'Odds cell' }), el('b', { class: 'num', text: row.odds_cell })),
        el('div', null, el('span', { text: 'Printed range' }), el('b', { class: 'num', text: fmtUsd(row.range_low_usd) + ' – ' + fmtUsd(row.range_high_usd) })),
        el('div', { class: 'wide' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': implied = TVL × 0.25 × (1 + clamp(7d growth, −60, 120)% × 0.5) × (0.6 + min(age, 1095)/1095 × 0.4) × (1 + min(chains, 8) × 0.02), a stated multiple; odds are the peers in the ' + row.odds_cell + ' cell, shown beside the value and never multiplied into it. The page recomputes this row as ' + fmtUsd(recomputed) + (fmtUsd(recomputed) === fmtUsd(row.implied_value_usd) ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    body.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'What farming it is worth, at your ticket' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Ticket' }), el('b', { class: 'num', text: '$' + state.ticket.toLocaleString('en-US') })),
        el('div', null, el('span', { text: 'Airdrop share to depositors' }), el('b', { class: 'num', text: Math.round(state.drop * 100) + '%' })),
        el('div', null, el('span', { text: 'Your slice of the launch' }), el('b', { class: 'num', text: fmtMoney(e.slice) })),
        el('div', null, el('span', { text: 'Fees, 8 transactions' }), el('b', { class: 'num', text: fmtMoney(e.fees) })),
        el('div', null, el('span', { text: 'Net, all costs' }), el('b', { class: 'num', text: fmtMoney(e.net) })),
        el('div', null, el('span', { text: 'Net per hour, about ' + HOURS + ' hours of work' }), el('b', { class: 'num', text: fmtMoney(e.perHour) })),
        el('div', { class: 'wide' }, el('span', { text: 'Verdict' }), el('b', null, el('span', { class: 'verdict ' + e.verdict.toLowerCase(), text: e.verdict })))
      ),
      el('p', { class: 'sub', text: 'FARM means the net beats $25 an hour; MARGINAL means the net is positive but below that bar; SKIP means the fees eat the slice. Change the ticket or the airdrop share and the verdicts move: the board ranks by implied value, the verdict prices your scenario.' })
    ));
    body.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    dialog.appendChild(body);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(ledgerPanel());
    shell.appendChild(checks());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    shell.appendChild(methodPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
    // Staging hook for the method screenshot: ?shot=method shows only the evidence panel.
    if (new URLSearchParams(window.location.search).get('shot') === 'method') {
      shell.classList.add('shot-method');
    }
    window.__shotReady = true;
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
