#!/usr/bin/env node
// byte-tree: 1 -> 3 -> 9 ternary block tree. Zero dependencies.
// Signal convention (active-low): lit = 0, dark = 1.
const LIT = 0, DARK = 1;
const word = b => (b === LIT ? 'lit' : 'dark');

// Seeded PRNG (mulberry32) + gaussian
function rng(seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  return r;
}

// Leaf: region-count detector. lit if count >= threshold else dark.
export const leafBit = (count, threshold) => (count >= threshold ? LIT : DARK);

// Computer block: reads 8 bits, outputs one lit/dark answer.
// Unweighted = majority vote (ties -> dark). Weighted: sum w_i*[bit lit] >= bias -> lit.
export function computer(bits, weights = null, bias = null) {
  if (!weights) { const lit = bits.filter(b => b === LIT).length; return lit > 4 ? LIT : DARK; }
  let s = 0; bits.forEach((b, i) => { if (b === LIT) s += weights[i]; });
  return s >= (bias ?? weights.reduce((x, y) => x + y, 0) / 2) ? LIT : DARK;
}

// Blocks: depth d tree = 9^d blocks (each level-3 group = 1 computer + 8 data).
export const blockCount = d => 9 ** d;

// ---------- synthetic problem ----------
// Points uniform in [0,1]^2. Label lit(0) if inside target disc C=(0.5,0.5), R=0.3.
const C = [0.5, 0.5], R = 0.3, NOISE = 0.12, K = 5, THRESH = 3;
const inDisc = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const truth = ([x, y]) => (inDisc(x, y, C[0], C[1], R) ? LIT : DARK);

// 8 overlapping sub-regions: discs jittered around the target.
function subRegions(r, n = 8, jitter = 0.06) {
  return Array.from({ length: n }, () => [C[0] + (r() - 0.5) * 2 * jitter, C[1] + (r() - 0.5) * 2 * jitter, R + (r() - 0.5) * 0.06]);
}
// Region count: K noisy observations of the point, count those inside the region.
function regionCount(p, reg, r, k = K) {
  let c = 0;
  for (let i = 0; i < k; i++) if (inDisc(p[0] + r.gauss() * NOISE, p[1] + r.gauss() * NOISE, ...reg)) c++;
  return c;
}

// Tree evaluation. depth 1: 8 leaves -> computer. depth d: each bit is a depth d-1 tree.
function makeTree(depth, r) {
  if (depth === 0) return { leaf: subRegions(r, 1)[0] };
  return { kids: Array.from({ length: 8 }, () => makeTree(depth - 1, r)), weights: null };
}
function evalTree(t, p, r, k = K, th = THRESH) {
  if (t.leaf) return leafBit(regionCount(p, t.leaf, r, k), th);
  const bits = t.kids.map(c => evalTree(c, p, r, k, th));
  t.lastBits = bits;
  return computer(bits, t.weights, t.bias);
}
const leaves = t => (t.leaf ? 1 : t.kids.reduce((s, c) => s + leaves(c), 0));

// Learn per-bit weights for the top computer (perceptron on train set).
function trainWeights(t, train, r, epochs = 5) {
  t.weights = Array(8).fill(1); t.bias = 4;
  for (let e = 0; e < epochs; e++) for (const p of train) {
    const pred = evalTree(t, p, r), y = truth(p);
    if (pred !== y) { const dir = y === LIT ? 1 : -1;
      t.lastBits.forEach((b, i) => { if (b === LIT) t.weights[i] = Math.max(0, t.weights[i] + 0.1 * dir); });
      t.bias -= 0.1 * dir; }
  }
}

function printTree(t, p, r, indent = '', depth = 1) {
  const ans = evalTree(t, p, r);
  console.log(`${indent}[computer] answer=${word(ans)} (${ans})  byte=${t.lastBits.map(word).join(' ')}  (${t.lastBits.join('')})`);
  if (t.kids[0].kids) t.kids.forEach((c, i) => { console.log(`${indent}  bit${i}:`); printTree(c, p, r, indent + '    ', depth + 1); });
}

// ---------- CLI ----------
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const cmd = args[0];
if (cmd === 'run') {
  const depth = Math.max(1, opt('--depth', 1)), r = rng(opt('--seed', 42));
  const t = makeTree(depth, r), p = [r(), r()];
  console.log(`byte-tree depth=${depth}  blocks=${blockCount(depth)}  leaf detectors=${leaves(t)}`);
  console.log('structure: 1 block -> 3 blocks (1 computer + 2 data) -> 9 blocks (1 computer + 8 data bits = 1 byte)');
  console.log(`input point=(${p.map(v => v.toFixed(3)).join(', ')})  truth=${word(truth(p))}`);
  printTree(t, p, r);
} else if (cmd === 'compare') {
  const N = opt('--n', 10000), seed = opt('--seed', 42), r = rng(seed);
  const test = Array.from({ length: N }, () => [r(), r()]);
  const train = Array.from({ length: 2000 }, () => [r(), r()]);
  const rows = [];
  const bench = (name, blocks, samples, f) => {
    const t0 = performance.now(); let ok = 0; for (const p of test) if (f(p) === truth(p)) ok++;
    rows.push([name, blocks, samples, (100 * ok / N).toFixed(2) + '%', (performance.now() - t0).toFixed(1) + ' ms']);
  };
  const target = [C[0], C[1], R];
  bench('(a) single detector, K=5', 1, K, p => leafBit(regionCount(p, target, r), THRESH));
  bench('(a2) single detector, K=40 (budget = depth1)', 1, 40, p => leafBit(regionCount(p, target, r, 40), 20));
  bench('(a3) single detector, K=320 (budget = depth2)', 1, 320, p => leafBit(regionCount(p, target, r, 320), 160));
  const t1 = makeTree(1, r); bench('(b) depth-1 byte tree, majority', blockCount(1), 8 * K, p => evalTree(t1, p, r));
  const t1w = makeTree(1, r); trainWeights(t1w, train, r);
  bench('(b2) depth-1 byte tree, learned weights', blockCount(1), 8 * K, p => evalTree(t1w, p, r));
  const t2 = makeTree(2, r); bench('(c) depth-2 recursive tree, majority', blockCount(2), 64 * K, p => evalTree(t2, p, r));
  const t2w = makeTree(2, r); trainWeights(t2w, train, r);
  bench('(c2) depth-2 recursive tree, learned top weights', blockCount(2), 64 * K, p => evalTree(t2w, p, r));
  console.log(`byte-tree compare  N=${N} test points, seed=${seed}, noise sd=${NOISE}, K=${K} obs/leaf, leaf threshold=${THRESH}`);
  console.log('task: is point inside disc (0.5,0.5) r=0.3? lit(0)=inside, dark(1)=outside');
  const h = ['method', 'blocks', 'noisy obs/pt', 'accuracy', 'runtime'];
  const w = h.map((x, i) => Math.max(x.length, ...rows.map(r => String(r[i]).length)));
  for (const row of [h, ...rows]) console.log(row.map((c, i) => String(c).padEnd(w[i])).join('  '));
} else {
  console.log('usage: node byte-tree.mjs run --depth N [--seed S]\n       node byte-tree.mjs compare [--n 10000] [--seed 42]');
}
