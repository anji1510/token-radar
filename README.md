# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/anji1510/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/anji1510/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the pre-token DeFi protocols by what a launch would be worth, each with the steps to farm it — built on a sealed DefiLlama snapshot of 758 protocols. The value model (radar-5) fits a launch curve on the snapshot's own traded tokens, weights each row by the odds that a token ever appears, and prices the farm with a costed verdict — so every number on the board is earned from the snapshot, not set by hand.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

Node 22 or later. The program reads the snapshot, writes the ranked board to `out/board.json`, the dashboard's data to `out/data.js`, and copies `dashboard/` and `screenshots/` to `out/`, then writes `out/dossier.json`. Open `out/dashboard/index.html` to use the board. Run it twice and the outputs are byte for byte identical.

## How the value is worked out

```
launch value  = 10 ^ (3.9022 + 0.4007 x log10(TVL) + family offset)   fitted on 92 traded tokens
token odds    = peers in the same age-and-size cell that record a token, shrunk toward 55.2%
implied value = launch value x token odds
range         = implied value x 10 ^ (P10 / P90 of the leave-one-out residuals)
verdict       = FARM when the slice beats $25 an hour, MARGINAL when positive but below it,
                SKIP when the fees eat the slice — at capital 0.02% of TVL ($100–$50,000)
                and a 7% airdrop share
```

The curve is a power law in TVL plus a family effect: the 28 snapshot categories group into 7 families (Trading, Lending, Yield, Real-world, New tech, Infra, Staking), and the family offsets are fitted by ridge regression (lambda 30) — Trading x1.47, New tech x1.19, Infra x1.08, Real-world x1.07, Staking x0.89, Lending x0.76, Yield x0.73. The family effect is the one term that passed both blind tests, and it is a weak pass: leave-one-out x3.31 against the bare curve's x3.34, walk-forward x2.49 against x2.61, paired leave-one-out count 54–38 in its favour, and the 2024 and 2026 folds worsen — the board says so rather than overstating it. Seven-day growth, age and per-category offsets were tested and rejected: growth beats the bare curve on the pooled medians by a hair (x3.33 / x2.45 against x3.34 / x2.61) but loses the paired leave-one-out count 40–52, worsens the mean log error, and loses the 2024 and 2026 folds — and on top of the family model it adds nothing, walk-forward stays x2.49. Age is worse on both tests; per-category offsets win leave-one-out and lose walk-forward, which is overfitting. The board covers all 40 watchlist protocols plus every other rankable pre-token protocol in the snapshot — 198 rows. Each row carries its rank range at the P25–P75 range (Sentora 1–26), and the first 25 rows carry three extra farm steps each: what the seven-day growth says about timing, which chain is cheapest to farm on, and how the implied value sizes the position. One strip at the top of the dashboard accounts for all 758 protocols in the snapshot — 198 ranked, 416 already record a token, 144 set aside by reason — and an integrity strip shows the checksum the page recomputes from the table it shows, so the coverage is visible at a glance.

## The blind tests

| Test | Curve | Bare curve | Flat multiple |
| --- | --- | --- | --- |
| Leave-one-out, median miss | x3.31 (47% within 3x) | x3.34 | x4.68 |
| Walk-forward, pooled, median miss | x2.49 (54 tokens) | x2.61 | x4.88 |
| Token odds, Brier score (lower is better) | 0.197 | — | 0.247 |
| Range P10–P90, coverage | 80% leave-one-out, 80% walk-forward | — | — |
| Range P25–P75, coverage | 57% walk-forward (stated 50%) | — | — |

Walk-forward fits on the tokens listed before each year and tests the ones listed in that year: 2023 x2.80 against x5.12 flat, 2024 x2.36 against x4.61, 2025 x1.91 against x4.87, 2026 x8.56 against x7.50. The newest year is the hardest, and the curve loses to the flat multiple there — nine recent tokens with extreme dispersion, and the board says so rather than hiding it. The odds call 293 of 442 peers right at the 50% line (66.3%), against 244 (55.2%) for the base rate alone.

## What is left out, and why

A protocol that records no token is still left out when it is a wrapped, staked or bridged product of a token that already trades, an exchange's product, or a versioned pool — the watchlist's own rule, applied to the whole ranking. WBTC, Binance staked ETH and Coinbase Bridge hold billions of TVL and would otherwise sit at the top of a launch board they do not belong on. The 144 set aside split by reason: CEX 42, Liquid Staking 38, Bridge 28, Canonical Bridge 15, versioned name 11, wrapped or staked name 5, Liquid Restaking 3, Restaked BTC 2.

---

<sub>Entered on [make.fun](https://make.fun/?ref=442qgert&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
