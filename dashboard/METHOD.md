# Token Radar — how this board is built

Token Radar ranks the 198 pre-token protocols in the snapshot by what a token launch
would be worth, strongest first. A launch is priced by a curve fitted on the snapshot's
own 92 traded tokens, then weighted by the odds that a token ever appears.

## The two formulas

`implied = 10^(3.9022 + 0.4007 x log10(TVL) + family offset) x P(token)`

The curve is a ridge fit on log market cap against log TVL, with one offset per family
(lambda 30). It misses by x3.31 leave-one-out and x2.49 walk-forward, against x4.68 and
x4.88 for a flat multiple — so it earns its place on held-out data, not on the tokens
that fitted it.

`logit P(token) = 0.66 − 1.56·[<6mo] − 1.04·[6–12mo] − 1.25·[1–2y] − 0.29·[2–3y] + 0.80·[3y+] + 0.47·[$50–250M] + 0.53·[$250M–$1B] + 0.81·[$1B+]`

The odds are a logistic model on the protocol's age band and TVL tier (baseline:
unknown age, under $50M). It beats the old age-by-size cell table on both blind tests:
Brier 0.196 vs 0.197 leave-one-out, 0.258 vs 0.268 walk-forward; 312 vs 293 calls
right leave-one-out, 187 vs 166 walk-forward. A Murphy decomposition and a per-bin
calibration table are on the board, with the correction the next cycle should make.

## The second valuation

Each row also carries a peer value: TVL times the median market-cap-to-TVL multiple
of its strict peers (same family, same size band). The two methods sit a median x1.70
apart — the curve prices size sublinearly, a multiple prices it linearly — so the
verdict follows the curve and the peer value is printed as the cross-check, never
averaged in. Flexing the curve slope by one standard error moves the median row x7.87;
flexing the peer median by 10% moves it x1.10. The slope is the driving assumption.

## What is checked, and what is not claimed

The range is the P10–P90 of the leave-one-out residuals; it holds 80% of the traded
tokens and 80% of later-listed tokens. The newest walk-forward fold (2026) is the
hardest and the curve loses to flat there — the board says so. The top twenty rows
carry five-pillar thesis farm plans with named exit triggers; the rest keep the
generic plan. The 144 pre-token protocols set aside are wrapped, staked or bridged
products of tokens that already trade, and are counted by reason on the board.
