#!/usr/bin/env node
// Paper backtest: byte tree on EUR/USD with euro-area-vs-US "region count" fundamental bits. No money, no broker, zero deps.
// lit(0) = euro area relatively stronger -> long EUR; dark(1) = short EUR. All data cached in ./data (FRED fredgraph.csv + Eurostat SDMX-CSV, no keys).
import fs from 'node:fs';
const LIT = 0, DARK = 1, COST = 0.0001, D = new URL('./data/', import.meta.url).pathname;
function computer(bits, weights = null, bias = null) { // identical to byte-tree.mjs
  if (!weights) { const lit = bits.filter(b => b === LIT).length; return lit > 4 ? LIT : DARK; }
  let s = 0; bits.forEach((b, i) => { if (b === LIT) s += weights[i]; });
  return s >= (bias ?? weights.reduce((x, y) => x + y, 0) / 2) ? LIT : DARK;
}
const lines = f => fs.readFileSync(D + f, 'utf8').trim().split('\n');
const fred = id => new Map(lines(id + '.csv').slice(1).map(l => l.split(',')).filter(([, v]) => v && v !== '.' && !isNaN(+v)).map(([d, v]) => [d.slice(0, 7), +v]));
const estat = (f, filt = () => true) => { const L = lines(f + '.csv'), h = L[0].split(','), ti = h.indexOf('TIME_PERIOD'), vi = h.indexOf('OBS_VALUE');
  return new Map(L.slice(1).map(l => l.split(',')).filter(r => filt(r, h) && r[vi] !== '' && !isNaN(+r[vi])).map(r => [r[ti], +r[vi]])); };
const air = estat('EU_AIR', (r, h) => r[h.indexOf('tra_cov')] === 'TOTAL' && r[h.indexOf('schedule')] === 'TOTAL');
// [name, EA series, US series, transform, invert, lag months]
export const SERIES = [
  ['unemployment rate', 'Eurostat une_rt_m SA TOTAL EA21', estat('EU_UNE'), 'FRED UNRATE', fred('UNRATE'), 'level', true, 2],
  ['industrial production', 'Eurostat sts_inpr_m B-D SCA I21 EA21', estat('EU_IP'), 'FRED INDPRO', fred('INDPRO'), 'log', false, 3],
  ['retail sales volume', 'Eurostat sts_trtu_m G47 VOL SCA EA21', estat('EU_RET'), 'FRED RRSFS (real retail+food)', fred('RRSFS'), 'log', false, 3],
  ['consumer confidence', 'Eurostat ei_bsco_m BS-CSMCI SA EA21', estat('EU_CONF'), 'FRED UMCSENT', fred('UMCSENT'), 'level', false, 1],
  ['construction output', 'Eurostat sts_copr_m F SCA I21 EA21', estat('EU_CONS'), 'FRED TTLCONS (nominal spending)', fred('TTLCONS'), 'log', false, 3],
  ['air passengers', 'Eurostat avia_paoc PAS_CRD TOTAL EU27_2020 (NSA)', air, 'FRED AIRRPMTSID11 (RPM)', fred('AIRRPMTSID11'), 'yoy', false, 4],
  ['tourism nights / hospitality', 'Eurostat tour_occ_nim TOTAL NR I551-I553 EU27_2020 (NSA)', estat('EU_TOUR'), 'FRED RSFSDP (food svc & drinking places $)', fred('RSFSDP'), 'yoy', false, 4],
  ['youth unemployment <25', 'Eurostat une_rt_m SA Y_LT25 EA21', estat('EU_YUNE'), 'FRED LNS14024887 (16-24)', fred('LNS14024887'), 'level', true, 2],
];
const mk = (y, m) => `${y}-${String(m).padStart(2, '0')}`, shift = (k, n) => { let y = +k.slice(0, 4), m = +k.slice(5) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return mk(y, m + 1); };
function tf(map, t) { const o = new Map(); for (const [k, v] of map) {
  if (t === 'level') o.set(k, v); else if (t === 'log') o.set(k, Math.log(v));
  else { const p = map.get(shift(k, -12)); if (p) o.set(k, Math.log(v / p)); } } return o; }
const S = SERIES.map(([name, ea, E, us, U, t, inv, lag]) => ({ name, ea, us, t, inv, lag, E: tf(E, t), U: tf(U, t), rawE: E, rawU: U, sd: {} }));
const sdOf = (m, w) => { const d = []; for (const [k, v] of m) { if (k > '2015-12') continue; const p = m.get(shift(k, -w)); if (p !== undefined) d.push(v - p); }
  const mu = d.reduce((a, b) => a + b, 0) / d.length; return Math.sqrt(d.reduce((a, b) => a + (b - mu) ** 2, 0) / d.length) || 1; };
// relative-strength bit for series s, window w (months), as-of data month K (already lag-shifted)
function rbit(s, K, w) { const e1 = s.E.get(K), e0 = s.E.get(shift(K, -w)), u1 = s.U.get(K), u0 = s.U.get(shift(K, -w));
  if ([e1, e0, u1, u0].some(x => x === undefined)) return null;
  const key = w; if (!s.sd[key]) s.sd[key] = [sdOf(s.E, w), sdOf(s.U, w)];
  let sc = (e1 - e0) / s.sd[key][0] - (u1 - u0) / s.sd[key][1]; if (s.inv) sc = -sc; return sc > 0 ? LIT : DARK; }
const W = 6, SUB = [2, 3, 4, 5, 7, 9, 12, 18]; // chosen a priori, not tuned
// ---- prices (same as backtest.mjs)
const rows = lines('DEXUSEU.csv').slice(1).map(l => l.split(',')).filter(([, v]) => v && v !== '.' && !isNaN(+v)).map(([d, v]) => ({ d, p: +v }));
const P = rows.map(r => r.p), N = P.length;
const mom = (t, w) => (t - w >= 0 ? (P[t] > P[t - w] ? LIT : DARK) : null);
const PW = [5, 10, 20, 40, 60, 120, 200, 250], SCALE = [0.5, 0.625, 0.75, 0.875, 1.125, 1.25, 1.375, 1.5];
const pbit2 = (t, w) => computer(SCALE.map(s => mom(t, Math.max(1, Math.round(w * s)))));
// as-of month for series s on day t: value for month m usable from 1st of month m+lag (decided at close t, so date t >= that day)
const asof = (s, t) => shift(rows[t].d.slice(0, 7), -s.lag);
const memo = new Map(); const cache = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };
const f1 = t => cache('f1' + t, () => S.map(s => rbit(s, asof(s, t), W)));
const f2 = t => cache('f2' + t, () => S.map(s => { const b = SUB.map(w => rbit(s, asof(s, t), w)); return b.some(x => x === null) ? null : computer(b); }));
const p2 = t => cache('p2' + t, () => PW.map(w => pbit2(t, w)));
const comb = t => { const p = p2(t), f = f2(t); return [p[2], p[4], p[5], p[7], f[0], f[1], f[2], f[3]]; }; // price 20,60,120,250 + UNE,IP,RET,CONF
const ok = b => b.every(x => x !== null);
const START = 380, y = t => (P[t + 1] > P[t] ? LIT : DARK);
const isTrain = t => rows[t + 1].d <= '2015-12-31', isTest = t => rows[t].d >= '2016-01-01' && t + 1 < N;
function train(bitsFn, epochs = 5) { const w = Array(8).fill(1); let bias = 4, n = 0;
  for (let e = 0; e < epochs; e++) for (let t = START; t < N - 1; t++) { if (!isTrain(t)) continue; const b = bitsFn(t); if (!ok(b)) continue; if (!e) n++;
    const pred = computer(b, w, bias), yy = y(t);
    if (pred !== yy) { const dir = yy === LIT ? 1 : -1; b.forEach((x, i) => { if (x === LIT) w[i] = Math.max(0, w[i] + 0.1 * dir); }); bias -= 0.1 * dir; } }
  return { w, bias, n }; }
// training with partial bits: missing bits counted as dark (not lit) so early years with fewer series still train
const fill = fn => t => fn(t).map(x => (x === null ? DARK : x));
const T1 = train(fill(f1)), T2 = train(fill(f2)), TC = train(fill(comb));
const sig = (b, wt) => (ok(b) ? (computer(b, wt?.w, wt?.bias) === LIT ? 1 : -1) : 0);
const strategies = {
  '(a) traditional: unemployment-rate differential, 6m (a priori)': t => { const b = f1(t)[0]; return b === null ? 0 : b === LIT ? 1 : -1; },
  '(b) depth-1 fundamentals, majority (9 blocks)': t => sig(f1(t)),
  '(c) depth-1 fundamentals, learned weights': t => sig(f1(t), T1),
  '(d) depth-2 fundamentals, majority (81 blocks)': t => sig(f2(t)),
  '(e) depth-2 fundamentals, learned top weights': t => sig(f2(t), T2),
  '(f) previous: depth-2 price bits, majority': t => sig(p2(t)),
  '(g) combined depth-2: 4 price + 4 fundamental, majority': t => sig(comb(t)),
  '(h) combined depth-2, learned top weights': t => sig(comb(t), TC),
  'baseline: buy-and-hold EUR': () => 1,
  'baseline: always flat': () => 0,
};
function evalS(f, cost) { let eq = 1, peak = 1, mdd = 0, prev = 0, trades = 0, hits = 0, n = 0; const rets = [];
  for (let t = START; t < N - 1; t++) { if (!isTest(t)) continue;
    const pos = f(t); let r = pos * (P[t + 1] / P[t] - 1);
    if (pos !== prev) { trades++; if (cost) r -= Math.abs(pos - prev) / 2 * COST / P[t] * (prev === 0 || pos === 0 ? 2 : 1); }
    prev = pos; if (pos !== 0 && P[t + 1] !== P[t]) { n++; if ((pos > 0) === (P[t + 1] > P[t])) hits++; }
    rets.push(r); eq *= 1 + r; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq / peak - 1); }
  const m = rets.reduce((a, b) => a + b, 0) / rets.length, sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / rets.length);
  const yrs = rets.length / 252, z = n ? (hits - n / 2) / Math.sqrt(n / 4) : 0;
  return { hit: n ? hits / n : NaN, n, z, tot: eq - 1, ann: eq ** (1 / yrs) - 1, sh: sd ? m / sd * Math.sqrt(252) : 0, mdd, trades }; }
const pct = x => (isNaN(x) ? 'n/a' : (100 * x).toFixed(2) + '%');
const testDays = rows.filter((r, t) => isTest(t));
const rng = m => { const k = [...m.keys()].sort(); return `${k[0]}..${k.at(-1)}`; };
let out = `# Byte tree EUR/USD paper backtest: region-count fundamentals\n\nPaper only. FX: FRED DEXUSEU daily, ${rows[0].d} to ${rows[N - 1].d}. Train (perceptron): through 2015-12-31. Out-of-sample: ${testDays[0].d} to ${rows[N - 1].d} (${testDays.length} days). Cost = 1 pip per position change.\n\n`;
out += `## Series (euro area vs US), lag = months after reference month before the value is used\n\n| bit | euro-area series | range | US series | range | transform | lag |\n|---|---|---|---|---|---|---|\n`;
S.forEach((s, i) => out += `| ${i + 1} ${s.name}${s.inv ? ' (lower = lit)' : ''} | ${s.ea} | ${rng(s.rawE)} | ${s.us} | ${rng(s.rawU)} | ${s.t} | ${s.lag} |\n`);
out += `\nBit rule: score = (EA change over w months)/sd_EA(w) - (US change over w)/sd_US(w), sd from data <= 2015; lit if score > 0 (sign flipped for unemployment). Transform 'yoy' = log 12-month change (for non-seasonally-adjusted counts). Value for month m is first used at the close of the first trading day of month m+lag. Depth-1: w = ${W}. Depth-2: each bit = 9-block tree (majority of 8 sub-windows w = ${SUB.join(',')}). Monthly signal, daily P&L.\n\n`;
out += `Learned weights: depth-1 [${T1.w.map(v => v.toFixed(1))}] bias ${T1.bias.toFixed(1)}; depth-2 [${T2.w.map(v => v.toFixed(1))}] bias ${T2.bias.toFixed(1)}; combined [${TC.w.map(v => v.toFixed(1))}] bias ${TC.bias.toFixed(1)}. Training days with all bits available: d1 ${train(f1).n}, d2 ${train(f2).n}.\n\n`;
for (const cost of [false, true]) {
  out += `## Out-of-sample, ${cost ? 'WITH 1-pip cost' : 'no cost'}\n\n| strategy | hit rate | z vs 50% | total | annual | Sharpe | max DD | trades |\n|---|---|---|---|---|---|---|---|\n`;
  for (const [k, f] of Object.entries(strategies)) { const s = evalS(f, cost);
    out += `| ${k} | ${pct(s.hit)} (n=${s.n}) | ${s.z.toFixed(2)} | ${pct(s.tot)} | ${pct(s.ann)} | ${s.sh.toFixed(2)} | ${pct(s.mdd)} | ${s.trades} |\n`; }
  out += '\n'; }
const lit = Object.fromEntries(S.map((s, i) => [s.name, (() => { let a = 0, n = 0; for (let t = START; t < N - 1; t++) if (isTest(t)) { const b = f2(t)[i]; if (b !== null) { n++; if (b === LIT) a++; } } return pct(a / n); })()]));
out += `Share of test days each depth-2 bit was lit: ${Object.entries(lit).map(([k, v]) => `${k} ${v}`).join('; ')}.\n\n|z| < 1.96 = not distinguishable from a coin flip at ~95%. Windows, lags, series and the a-priori traditional bit were fixed before looking at test results.\n`;
fs.writeFileSync(new URL('./forex-fundamentals-results.md', import.meta.url), out); console.log(out);
