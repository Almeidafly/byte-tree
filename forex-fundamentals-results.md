# Byte tree EUR/USD paper backtest: region-count fundamentals

Paper only. FX: FRED DEXUSEU daily, 1999-01-04 to 2026-10-23. Train (perceptron): through 2015-12-31. Out-of-sample: 2016-01-04 to 2026-10-23 (2700 days). Cost = 1 pip per position change.

## Series (euro area vs US), lag = months after reference month before the value is used

| bit | euro-area series | range | US series | range | transform | lag |
|---|---|---|---|---|---|---|
| 1 unemployment rate (lower = lit) | Eurostat une_rt_m SA TOTAL EA21 | 2000-01..2026-09 | FRED UNRATE | 1948-01..2026-09 | level | 2 |
| 2 industrial production | Eurostat sts_inpr_m B-D SCA I21 EA21 | 1995-01..2026-08 | FRED INDPRO | 1919-01..2026-09 | log | 3 |
| 3 retail sales volume | Eurostat sts_trtu_m G47 VOL SCA EA21 | 2000-01..2026-08 | FRED RRSFS (real retail+food) | 1992-01..2026-09 | log | 3 |
| 4 consumer confidence | Eurostat ei_bsco_m BS-CSMCI SA EA21 | 1995-01..2026-10 | FRED UMCSENT | 1952-11..2026-09 | level | 1 |
| 5 construction output | Eurostat sts_copr_m F SCA I21 EA21 | 1995-01..2026-08 | FRED TTLCONS (nominal spending) | 1993-01..2026-08 | log | 3 |
| 6 air passengers | Eurostat avia_paoc PAS_CRD TOTAL EU27_2020 (NSA) | 2008-01..2026-03 | FRED AIRRPMTSID11 (RPM) | 2000-01..2026-06 | yoy | 4 |
| 7 tourism nights / hospitality | Eurostat tour_occ_nim TOTAL NR I551-I553 EU27_2020 (NSA) | 2011-01..2026-07 | FRED RSFSDP (food svc & drinking places $) | 1992-01..2026-09 | yoy | 4 |
| 8 youth unemployment <25 (lower = lit) | Eurostat une_rt_m SA Y_LT25 EA21 | 2000-01..2026-09 | FRED LNS14024887 (16-24) | 1948-01..2026-09 | level | 2 |

Bit rule: score = (EA change over w months)/sd_EA(w) - (US change over w)/sd_US(w), sd from data <= 2015; lit if score > 0 (sign flipped for unemployment). Transform 'yoy' = log 12-month change (for non-seasonally-adjusted counts). Value for month m is first used at the close of the first trading day of month m+lag. Depth-1: w = 6. Depth-2: each bit = 9-block tree (majority of 8 sub-windows w = 2,3,4,5,7,9,12,18). Monthly signal, daily P&L.

Learned weights: depth-1 [0.0,0.0,0.0,0.0,0.1,0.0,0.2,0.0] bias 0.3; depth-2 [0.0,0.0,0.1,0.0,0.0,0.0,0.2,0.1] bias 0.3; combined [0.0,0.0,0.0,0.0,0.0,0.0,0.1,0.0] bias 0.3. Training days with all bits available: d1 791, d2 540.

## Out-of-sample, no cost

| strategy | hit rate | z vs 50% | total | annual | Sharpe | max DD | trades |
|---|---|---|---|---|---|---|---|
| (a) traditional: unemployment-rate differential, 6m (a priori) | 50.11% (n=2632) | 0.12 | 5.09% | 0.46% | 0.10 | -22.14% | 24 |
| (b) depth-1 fundamentals, majority (9 blocks) | 49.76% (n=2534) | -0.24 | 0.11% | 0.01% | 0.04 | -24.71% | 34 |
| (c) depth-1 fundamentals, learned weights | 51.62% (n=2534) | 1.63 | 22.11% | 1.88% | 0.30 | -14.99% | 27 |
| (d) depth-2 fundamentals, majority (81 blocks) | 49.98% (n=2453) | -0.02 | 5.38% | 0.49% | 0.10 | -24.89% | 28 |
| (e) depth-2 fundamentals, learned top weights | 49.78% (n=2453) | -0.22 | -18.34% | -1.87% | -0.23 | -32.64% | 45 |
| (f) previous: depth-2 price bits, majority | 50.88% (n=2675) | 0.91 | 13.95% | 1.23% | 0.21 | -15.14% | 197 |
| (g) combined depth-2: 4 price + 4 fundamental, majority | 49.61% (n=2453) | -0.38 | -19.21% | -1.97% | -0.25 | -32.13% | 133 |
| (h) combined depth-2, learned top weights | 50.71% (n=2453) | 0.71 | -11.86% | -1.17% | -0.13 | -20.27% | 2 |
| baseline: buy-and-hold EUR | 49.12% (n=2675) | -0.91 | 3.67% | 0.34% | 0.08 | -23.00% | 1 |
| baseline: always flat | n/a (n=0) | 0.00 | 0.00% | 0.00% | 0.00 | 0.00% | 0 |

## Out-of-sample, WITH 1-pip cost

| strategy | hit rate | z vs 50% | total | annual | Sharpe | max DD | trades |
|---|---|---|---|---|---|---|---|
| (a) traditional: unemployment-rate differential, 6m (a priori) | 50.11% (n=2632) | 0.12 | 4.86% | 0.44% | 0.10 | -22.25% | 24 |
| (b) depth-1 fundamentals, majority (9 blocks) | 49.76% (n=2534) | -0.24 | -0.19% | -0.02% | 0.03 | -24.83% | 34 |
| (c) depth-1 fundamentals, learned weights | 51.62% (n=2534) | 1.63 | 21.82% | 1.86% | 0.29 | -14.99% | 27 |
| (d) depth-2 fundamentals, majority (81 blocks) | 49.98% (n=2453) | -0.02 | 5.12% | 0.47% | 0.10 | -24.95% | 28 |
| (e) depth-2 fundamentals, learned top weights | 49.78% (n=2453) | -0.22 | -18.66% | -1.91% | -0.24 | -32.84% | 45 |
| (f) previous: depth-2 price bits, majority | 50.88% (n=2675) | 0.91 | 11.98% | 1.06% | 0.18 | -15.33% | 197 |
| (g) combined depth-2: 4 price + 4 fundamental, majority | 49.61% (n=2453) | -0.38 | -20.17% | -2.08% | -0.26 | -32.47% | 133 |
| (h) combined depth-2, learned top weights | 50.71% (n=2453) | 0.71 | -11.87% | -1.17% | -0.13 | -20.27% | 2 |
| baseline: buy-and-hold EUR | 49.12% (n=2675) | -0.91 | 3.66% | 0.34% | 0.08 | -23.00% | 1 |
| baseline: always flat | n/a (n=0) | 0.00 | 0.00% | 0.00% | 0.00 | 0.00% | 0 |

Share of test days each depth-2 bit was lit: unemployment rate 73.59%; industrial production 45.59%; retail sales volume 69.68%; consumer confidence 46.70%; construction output 25.37%; air passengers 38.71%; tourism nights / hospitality 47.00%; youth unemployment <25 70.02%.

|z| < 1.96 = not distinguishable from a coin flip at ~95%. Windows, lags, series and the a-priori traditional bit were fixed before looking at test results.

## Read and limitations

- No strategy shows a hit rate that is statistically different from 50% (largest |z| = 1.63, for depth-1 learned). Fundamentals did not beat the earlier price-bit depth-2 tree. The combined tree was the worst.
- The perceptron again learned almost nothing: weights are near 0 apart from small weights on construction and tourism. The only positive learned result, (c), comes from about 0.3 of total weight on 2 bits trained on about 3 years, so it is fragile. Nearby variants (e) and (h) lost money.
- Days count as flat (pos 0) when a bit's data is not available yet. The Eurostat air series ends 2026-03, so with the 4-month lag the trees go flat from about 2026-08. That is why n is lower than for buy-and-hold.
- The data is final revised data, not what was published at the time. The publication lags cover release timing but not revisions. The US and EU series do not always match: tourism nights vs US restaurant/bar dollars, EU passengers vs US revenue passenger miles, real vs nominal construction. Some coverage is EU27 rather than the euro area.
- Google mobility (2020-22) and card spending were left out: the period is too short and the coverage too limited for an out-of-sample test from 2016. No PMI because the series are not free.
