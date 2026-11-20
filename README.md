# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/anji1510/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/anji1510/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the pre-token DeFi protocols by what a launch would be worth, each with the steps to farm it — built on a sealed DefiLlama snapshot of 758 protocols. The value model (radar-2) scores TVL, seven-day growth, age with no token on record, and chain breadth; wrapped, staked and bridged products are left out on purpose, because they are not launches waiting to happen.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Node 22 or later. The program reads the snapshot, writes the ranked board to `out/board.json`, the dashboard's data to `out/data.js`, and copies `dashboard/` and `screenshots/` to `out/`, then writes `out/dossier.json`. Open `out/dashboard/index.html` to use the board. Run it twice and the outputs are byte for byte identical.

## How the value is worked out

```
implied = round( tvl_usd x 0.25 x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4)
                 x (1 + min(chains, 8) x 0.02) )
```

TVL is the size of the prize, seven-day growth is its direction, age is how long the protocol has run with no token on record, and chain breadth is how widely it is distributed. No protocol name is special-cased: the same function scores every row. The board covers all 40 watchlist protocols plus every other rankable pre-token protocol in the snapshot — 198 rows. The first 25 rows carry three extra farm steps each: what the seven-day growth says about timing, which chain is cheapest to farm on, and how the implied value sizes the position.

## What is left out, and why

A protocol that records no token is still left out when it is a wrapped, staked or bridged product of a token that already trades, an exchange's product, or a versioned pool — the watchlist's own rule, applied to the whole ranking. WBTC, Binance staked ETH and Coinbase Bridge hold billions of TVL and would otherwise sit at the top of a launch board they do not belong on.

---

<sub>Entered on [make.fun](https://make.fun/?ref=442qgert&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
