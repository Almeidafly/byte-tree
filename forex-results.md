# Byte tree EUR/USD paper backtest

Data: FRED DEXUSEU (noon NY buying rate, USD per EUR), 1999-01-04 to 2026-10-23, 6974 daily obs. Price-derived bits only (no macro series).
Train (perceptron weights): through 2015-12-31. Out-of-sample test: 2016-01-04 to 2026-10-23 (2700 days).
Depth-1 bits: lit if P[t] > P[t-w], w = 5,10,20,40,60,120,200,250. Depth-2: each bit = majority of 8 sub-momenta at w x {0.5,0.625,0.75,0.875,1.125,1.25,1.375,1.5}. Position decided at close t, held t->t+1. Cost = 1 pip (0.0001) per position change (each flip or entry = 1 pip).

Learned weights depth-1: [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0] bias 0.1; depth-2: [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0] bias 0.1

## Out-of-sample, no cost

| strategy | hit rate | z vs 50% | total | annual | Sharpe | max DD | trades |
|---|---|---|---|---|---|---|---|
| (a) traditional: 200-day momentum | 50.21% (n=2675) | 0.21 | -6.11% | -0.59% | -0.05 | -30.48% | 108 |
| (b) depth-1 tree, majority (9 blocks) | 50.06% (n=2675) | 0.06 | 7.34% | 0.66% | 0.13 | -22.03% | 225 |
| (c) depth-1 tree, learned weights | 50.88% (n=2675) | 0.91 | -8.77% | -0.85% | -0.08 | -21.23% | 1 |
| (d) depth-2 tree, majority (81 blocks) | 50.88% (n=2675) | 0.91 | 13.95% | 1.23% | 0.21 | -15.14% | 197 |
| (e) depth-2 tree, learned top weights | 50.88% (n=2675) | 0.91 | -8.77% | -0.85% | -0.08 | -21.23% | 1 |
| baseline: buy-and-hold EUR | 49.12% (n=2675) | -0.91 | 3.67% | 0.34% | 0.08 | -23.00% | 1 |
| baseline: always flat | n/a (n=0) | 0.00 | 0.00% | 0.00% | 0.00 | 0.00% | 0 |

## Out-of-sample, WITH 1-pip cost

| strategy | hit rate | z vs 50% | total | annual | Sharpe | max DD | trades |
|---|---|---|---|---|---|---|---|
| (a) traditional: 200-day momentum | 50.21% (n=2675) | 0.21 | -7.01% | -0.68% | -0.06 | -30.73% | 108 |
| (b) depth-1 tree, majority (9 blocks) | 50.06% (n=2675) | 0.06 | 5.21% | 0.48% | 0.10 | -22.51% | 225 |
| (c) depth-1 tree, learned weights | 50.88% (n=2675) | 0.91 | -8.78% | -0.85% | -0.08 | -21.23% | 1 |
| (d) depth-2 tree, majority (81 blocks) | 50.88% (n=2675) | 0.91 | 11.98% | 1.06% | 0.18 | -15.33% | 197 |
| (e) depth-2 tree, learned top weights | 50.88% (n=2675) | 0.91 | -8.78% | -0.85% | -0.08 | -21.23% | 1 |
| baseline: buy-and-hold EUR | 49.12% (n=2675) | -0.91 | 3.66% | 0.34% | 0.08 | -23.00% | 1 |
| baseline: always flat | n/a (n=0) | 0.00 | 0.00% | 0.00% | 0.00 | 0.00% | 0 |

Note: on the training data the perceptron drove every weight to 0 with bias > 0, so (c) and (e) turn into "always dark" (always short EUR). That is 1 entry trade, and it shows the learner found no usable per-bit signal in 1999-2015.

|z| < 1.96 means the hit rate is not distinguishable from a coin flip at ~95%. Nothing was tuned on the test period; windows were chosen once a priori.
