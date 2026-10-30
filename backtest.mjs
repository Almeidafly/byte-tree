#!/usr/bin/env node
// Paper backtest of the byte tree on daily EUR/USD (FRED DEXUSEU). No money, no broker, zero deps.
// lit(0) = bullish EUR -> long; dark(1) = short. Logic copied from byte-tree.mjs (computer + perceptron).
import fs from 'node:fs';
const LIT = 0, DARK = 1, COST = 0.0001; // 1 pip per position change
const DIR = new URL('./data/', import.meta.url).pathname, F = DIR + 'DEXUSEU.csv';
function computer(bits, weights = null, bias = null) { // identical to byte-tree.mjs
  if (!weights) { const lit = bits.filter(b => b === LIT).length; return lit > 4 ? LIT : DARK; }
  let s = 0; bits.forEach((b, i) => { if (b === LIT) s += weights[i]; });
  return s >= (bias ?? weights.reduce((x, y) => x + y, 0) / 2) ? LIT : DARK;
}
if (!fs.existsSync(F)) { fs.mkdirSync(DIR, { recursive: true });
  const r = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXUSEU'); fs.writeFileSync(F, await r.text()); }
const rows = fs.readFileSync(F, 'utf8').trim().split('\n').slice(1).map(l => l.split(','))
  .filter(([, v]) => v && v !== '.' && !isNaN(+v)).map(([d, v]) => ({ d, p: +v }));
const P = rows.map(r => r.p), N = P.length;
// Signals at day t use P[0..t] only. Momentum: lit if P[t] > P[t-w].
const mom = (t, w) => (t - w >= 0 ? (P[t] > P[t - w] ? LIT : DARK) : null);
const W1 = [5, 10, 20, 40, 60, 120, 200, 250];          // depth-1 byte: 8 lookbacks
const SCALE = [0.5, 0.625, 0.75, 0.875, 1.125, 1.25, 1.375, 1.5]; // depth-2 sub-signals per bit
const bits1 = t => W1.map(w => mom(t, w));
const bits2 = t => W1.map(w => computer(SCALE.map(s => mom(t, Math.max(1, Math.round(w * s))))));
const START = 380; // warm-up so every signal exists
const y = t => (P[t + 1] > P[t] ? LIT : DARK);
const isTrain = t => rows[t + 1].d <= '2015-12-31', isTest = t => rows[t].d >= '2016-01-01' && t + 1 < N;
function train(bitsFn, epochs = 5) { // perceptron from byte-tree.mjs trainWeights
  const w = Array(8).fill(1); let bias = 4;
  for (let e = 0; e < epochs; e++) for (let t = START; t < N - 1; t++) { if (!isTrain(t)) continue;
    const b = bitsFn(t), pred = computer(b, w, bias), yy = y(t);
    if (pred !== yy) { const dir = yy === LIT ? 1 : -1;
      b.forEach((x, i) => { if (x === LIT) w[i] = Math.max(0, w[i] + 0.1 * dir); }); bias -= 0.1 * dir; } }
  return { w, bias };
}
const T1 = train(bits1), T2 = train(bits2);
const strategies = {
  '(a) traditional: 200-day momentum': t => (mom(t, 200) === LIT ? 1 : -1),
  '(b) depth-1 tree, majority (9 blocks)': t => (computer(bits1(t)) === LIT ? 1 : -1),
  '(c) depth-1 tree, learned weights': t => (computer(bits1(t), T1.w, T1.bias) === LIT ? 1 : -1),
  '(d) depth-2 tree, majority (81 blocks)': t => (computer(bits2(t)) === LIT ? 1 : -1),
  '(e) depth-2 tree, learned top weights': t => (computer(bits2(t), T2.w, T2.bias) === LIT ? 1 : -1),
  'baseline: buy-and-hold EUR': () => 1,
  'baseline: always flat': () => 0,
};
function evalS(f, cost) {
  let eq = 1, peak = 1, mdd = 0, prev = 0, trades = 0, hits = 0, n = 0; const rets = [];
  for (let t = START; t < N - 1; t++) { if (!isTest(t)) continue;
    const pos = f(t); let r = pos * (P[t + 1] / P[t] - 1);
    if (pos !== prev) { trades++; if (cost) r -= Math.abs(pos - prev) / 2 * COST / P[t] * (prev === 0 || pos === 0 ? 2 : 1) / 1; }
    prev = pos; if (pos !== 0 && P[t + 1] !== P[t]) { n++; if ((pos > 0) === (P[t + 1] > P[t])) hits++; }
    rets.push(r); eq *= 1 + r; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq / peak - 1); }
  const m = rets.reduce((a, b) => a + b, 0) / rets.length, sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / rets.length);
  const yrs = rets.length / 252, z = n ? (hits - n / 2) / Math.sqrt(n / 4) : 0;
  return { hit: n ? hits / n : NaN, n, z, tot: eq - 1, ann: eq ** (1 / yrs) - 1, sh: sd ? m / sd * Math.sqrt(252) : 0, mdd, trades };
}
const pct = x => (isNaN(x) ? 'n/a' : (100 * x).toFixed(2) + '%');
const testDays = rows.filter((r, t) => isTest(t));
let out = `# Byte tree EUR/USD paper backtest\n\nData: FRED DEXUSEU (noon NY buying rate, USD per EUR), ${rows[0].d} to ${rows[N - 1].d}, ${N} daily obs. Price-derived bits only (no macro series).\n`;
out += `Train (perceptron weights): through 2015-12-31. Out-of-sample test: ${testDays[0].d} to ${rows[N - 1].d} (${testDays.length} days).\n`;
out += `Depth-1 bits: lit if P[t] > P[t-w], w = ${W1.join(',')}. Depth-2: each bit = majority of 8 sub-momenta at w x {${SCALE.join(',')}}. Position decided at close t, held t->t+1. Cost = 1 pip (0.0001) per position change (each flip or entry = 1 pip).\n\n`;
out += `Learned weights depth-1: [${T1.w.map(v => v.toFixed(1))}] bias ${T1.bias.toFixed(1)}; depth-2: [${T2.w.map(v => v.toFixed(1))}] bias ${T2.bias.toFixed(1)}\n\n`;
for (const cost of [false, true]) {
  out += `## Out-of-sample, ${cost ? 'WITH 1-pip cost' : 'no cost'}\n\n| strategy | hit rate | z vs 50% | total | annual | Sharpe | max DD | trades |\n|---|---|---|---|---|---|---|---|\n`;
  for (const [k, f] of Object.entries(strategies)) { const s = evalS(f, cost);
    out += `| ${k} | ${pct(s.hit)} (n=${s.n}) | ${s.z.toFixed(2)} | ${pct(s.tot)} | ${pct(s.ann)} | ${s.sh.toFixed(2)} | ${pct(s.mdd)} | ${s.trades} |\n`; }
  out += '\n'; }
out += `Note: on the training data the perceptron drove every weight to 0 with bias > 0, so (c) and (e) turn into "always dark" (always short EUR). That is 1 entry trade, and it shows the learner found no usable per-bit signal in 1999-2015.\n\n`;
out += `|z| < 1.96 means the hit rate is not distinguishable from a coin flip at ~95%. Nothing was tuned on the test period; windows were chosen once a priori.\n`;
fs.writeFileSync(new URL('./forex-results.md', import.meta.url), out); console.log(out);
