# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/anji1510/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/anji1510/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the pre-token DeFi protocols by what a launch would be worth, each with the steps to farm it — built on a sealed DefiLlama snapshot of 758 protocols. The value model (radar-4) fits a launch curve on the snapshot's own traded tokens, weights each row by the odds that a token ever appears, and prices the farm with a costed verdict — so every number on the board is earned from the snapshot, not set by hand.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

Node 22 or later. The program reads the snapshot, writes the ranked board to `out/board.json`, the dashboard's data to `out/data.js`, and copies `dashboard/` and `screenshots/` to `out/`, then writes `out/dossier.json`. Open `out/dashboard/index.html` to use the board. Run it twice and the outputs are byte for byte identical.

## How the value is worked out

```
launch value  = 10 ^ (3.9578 + 0.3940 x log10(TVL))     fitted on 92 traded tokens
token odds    = peers in the same age-and-size cell that record a token, shrunk toward 55.2%
implied value = launch value x token odds
range         = implied value x 10 ^ (P10 / P90 of the leave-one-out residuals)
verdict       = FARM when the slice beats $25 an hour, MARGINAL when positive but below it,
                SKIP when the fees eat the slice — at a $5,000 ticket and a 10% airdrop share
```

The curve is a power law in TVL, fitted by least squares on the 92 traded tokens that are not wrapped, staked or bridged products. Seven-day growth, age and per-category offsets were all tested and rejected: each one failed to beat the bare curve in both blind tests. The board covers all 40 watchlist protocols plus every other rankable pre-token protocol in the snapshot — 198 rows. The first 25 rows carry three extra farm steps each: what the seven-day growth says about timing, which chain is cheapest to farm on, and how the implied value sizes the position. One strip at the top of the dashboard accounts for all 758 protocols in the snapshot — ranked, already records a token, or set aside by reason — and an integrity strip shows the checksum the page recomputes from the table it shows, so the coverage is visible at a glance.

## The blind tests

| Test | Curve | Flat multiple |
| --- | --- | --- |
| Leave-one-out, median miss | x3.34 (46% within 3x) | x4.68 |
| Walk-forward, pooled, median miss | x2.61 (54 tokens) | x4.88 |
| Token odds, Brier score (lower is better) | 0.197 | 0.247 |
| Range P10–P90, coverage | 80% | — |

Walk-forward fits on the tokens listed before each year and tests the ones listed in that year: 2023 x2.81 against x5.12 flat, 2024 x2.17 against x4.61, 2025 x2.14 against x4.87, 2026 x7.34 against x7.50. The newest year is the hardest, and the curve still beats the flat multiple there.

## What is left out, and why

A protocol that records no token is still left out when it is a wrapped, staked or bridged product of a token that already trades, an exchange's product, or a versioned pool — the watchlist's own rule, applied to the whole ranking. WBTC, Binance staked ETH and Coinbase Bridge hold billions of TVL and would otherwise sit at the top of a launch board they do not belong on.

---

<sub>Entered on [make.fun](https://make.fun/?ref=442qgert&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
