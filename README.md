# byte-tree

Zero-dependency Node ESM. It builds a ternary block tree: 1 block -> 3 blocks (1 computer + 2 data) -> 9 blocks (1 computer + 8 data bits = 1 byte).
Signals are active-low: **lit = 0, dark = 1**. A leaf bit is a region-count detector: it takes K noisy observations of a point and counts how many land in its sub-region. It is lit if count >= threshold and dark otherwise. The computer block takes a majority vote of its 8 bits (more than 4 lit -> lit). It can optionally use per-bit weights learned with a perceptron.
In recursive mode each bit is itself a full tree, so depth d has 9^d blocks.

## Usage
    node byte-tree.mjs run --depth N [--seed S]
    node byte-tree.mjs compare [--n 10000] [--seed 42]

## Benchmark
Points are uniform in the unit square. The label is lit if the point is inside the disc at (0.5,0.5) with r=0.3. Observation noise is sd 0.12, K=5 observations per leaf, and the leaf threshold is 3. Leaves use 8 jittered, overlapping copies of the target disc. The weighted variants train on 2,000 separate points. Fixed seed 42, 10k test points.
The table also includes single detectors with the same budget (a2, a3). Without them the comparison would be unfair, because deeper trees simply see more noisy observations.

## Honest read
Deeper trees beat a single K=5 detector. Most of that gain comes from the extra observations, not from the tree structure. A single detector with the same budget beats majority-vote trees at both depths (94.97% vs 91.64%, 95.75% vs 92.72%). Learned top weights at depth 2 came out best (96.72%), but this is one seed on one synthetic task. Learned weights at depth 1 did not help (89.87%).

## Results (seed 42)

```
byte-tree compare  N=10000 test points, seed=42, noise sd=0.12, K=5 obs/leaf, leaf threshold=3
task: is point inside disc (0.5,0.5) r=0.3? lit(0)=inside, dark(1)=outside
method                                            blocks  noisy obs/pt  accuracy  runtime 
(a) single detector, K=5                          1       5             89.91%    12.9 ms 
(a2) single detector, K=40 (budget = depth1)      1       40            94.97%    42.3 ms 
(a3) single detector, K=320 (budget = depth2)     1       320           95.75%    310.4 ms
(b) depth-1 byte tree, majority                   9       40            91.64%    46.2 ms 
(b2) depth-1 byte tree, learned weights           9       40            89.87%    43.2 ms 
(c) depth-2 recursive tree, majority              81      320           92.72%    342.5 ms
(c2) depth-2 recursive tree, learned top weights  81      320           96.72%    345.7 ms
```
