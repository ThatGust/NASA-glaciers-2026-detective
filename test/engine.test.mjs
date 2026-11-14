// Engine tests: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, mannKendallHR, senSlope, annualFromPower, yearsNeeded, detectionYears } from '../engine.js';

// Seeded PRNG (mulberry32) and Box-Muller normals, for reproducible simulations.
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const normal = (u) => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());

test('the clock is right: with n* years the trend is detected about 90% of the time', () => {
  const u = rng(42);
  for (const [sd, phi, slope] of [[1, 0, 0.05], [1, 0.3, 0.05], [0.5, 0.2, 0.01]]) {
    const n = Math.round(detectionYears(sd, phi, slope));
    let hits = 0; const trials = 400;
    for (let k = 0; k < trials; k++) {
      let e = normal(u) * sd; const x = [];
      for (let i = 0; i < n; i++) { e = phi * e + Math.sqrt(1 - phi * phi) * sd * normal(u); x.push(slope * i + e); }
      if (mannKendallHR(x).p < 0.05) hits++;
    }
    const power = hits / trials;
    // Mann-Kendall with Hamed-Rao is a bit more conservative than the regression the formula assumes.
    assert.ok(power > 0.75 && power < 0.97, `sd=${sd} phi=${phi} slope=${slope} n=${n}: power ${power}`);
  }
});

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)));
const reference = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url)));

test('Mann-Kendall Hamed-Rao and Sen match pymannkendall on real NASA POWER series', () => {
  for (const s of fixtures) {
    const ref = reference.find((r) => r.name === s.name);
    const mk = mannKendallHR(s.values);
    const { slope } = senSlope(s.values.map((_, i) => i), s.values);
    assert.equal(mk.S, ref.s, `${s.name}: S`);
    assert.ok(Math.abs(mk.z - ref.z) < 1e-6, `${s.name}: z ${mk.z} vs ${ref.z}`);
    assert.ok(Math.abs(mk.p - ref.p) < 1e-6, `${s.name}: p ${mk.p} vs ${ref.p}`);
    assert.ok(Math.abs(slope - ref.slope_per_year) < 1e-9, `${s.name}: pendiente`);
  }
});

// A perfect line is no good: rounding creates false autocorrelation in the residuals (same in pymannkendall).
test('a strong noisy trend is confirmed, with no clock and a known-since year', () => {
  const years = Array.from({ length: 30 }, (_, i) => 1990 + i);
  const values = years.map((y, i) => 0.05 * (y - 1990) + (((i * 7) % 5) - 2) * 0.05);
  const r = analyze({ years, values });
  assert.equal(r.verdict, 'confirmed');
  assert.equal(r.yearsNeeded, null);
  assert.ok(Math.abs(r.slopePerDecade - 0.5) < 0.05);
  assert.ok(r.knownSince >= 1997 && r.knownSince <= 2010, `knownSince ${r.knownSince}`);
});

test('trendless noise is not confirmed and the clock gives a number or infinity', () => {
  const years = Array.from({ length: 30 }, (_, i) => 1990 + i);
  const values = years.map((_, i) => Math.sin(i * 12.9898) * 43758.5453 % 1); // fixed pseudo-random
  const r = analyze({ years, values });
  assert.notEqual(r.verdict, 'confirmed');
  assert.ok(r.yearsNeeded === Infinity || r.yearsNeeded >= 0);
});

test('the clock grows when the slope is smaller relative to the noise', () => {
  const t = Array.from({ length: 20 }, (_, i) => i);
  const noise = t.map((i) => ((i * 7) % 5) - 2);
  const a = yearsNeeded(t, t.map((i) => 0.2 * i + noise[i]), 0.2, 0);
  const b = yearsNeeded(t, t.map((i) => 0.05 * i + noise[i]), 0.05, 0);
  assert.ok(b > a, `${b} should be > ${a}`);
});

test('annualFromPower drops incomplete years, the current year and month 13', () => {
  const p = {};
  for (let m = 1; m <= 13; m++) { p[`2020${String(m).padStart(2, '0')}`] = m === 13 ? 999 : m; p[`2021${String(m).padStart(2, '0')}`] = m === 5 ? -999 : 1; }
  const s = annualFromPower({ header: { fill_value: -999 }, properties: { parameter: { T2M: p } }, parameters: { T2M: { units: 'C' } } }, 'T2M', 2026);
  assert.deepEqual(s.years, [2020]);
  assert.equal(s.values[0], 6.5);
});

test('a series whose Hamed-Rao factor is negative still gets a finite, flagged p-value', () => {
  // Real NASA POWER T2M at Arequipa, 1981-2025: the correction factor is negative (pymannkendall gives NaN).
  const s = JSON.parse(readFileSync(new URL('./negative_factor.json', import.meta.url)));
  const mk = mannKendallHR(s.values);
  assert.equal(mk.corrected, false);
  assert.ok(Number.isFinite(mk.p) && mk.varS > 0);
  const r = analyze(s);
  assert.equal(r.autocorrelationCorrected, false);
  assert.ok(Number.isFinite(r.p));
});

test('analyze rejects series that are too short', () => {
  assert.throws(() => analyze({ years: [1, 2, 3], values: [1, 2, 3] }), /At least/);
});

test('Benjamini-Hochberg matches known values', async () => {
  const { benjaminiHochberg } = await import('../engine.js');
  const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.2]);
  const expected = [0.04, 0.05333333333333334, 0.05333333333333334, 0.2];
  q.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-12, `q[${i}]=${v}`));
});

test('scan flags missing and flat series and ranks confirmed first', async () => {
  const { scan } = await import('../engine.js');
  const years = Array.from({ length: 30 }, (_, i) => 1990 + i);
  const leads = scan({
    TREND: { years, values: years.map((y, i) => 0.05 * i + (((i * 7) % 5) - 2) * 0.05) },
    FLAT: { years, values: years.map(() => 0) },
    NONE: { years: [], values: [] },
    NOISE: { years, values: years.map((_, i) => (Math.sin(i * 12.9898) * 43758.5453) % 1) },
  });
  assert.equal(leads[0].variable, 'TREND');
  assert.equal(leads[0].verdict, 'confirmed');
  assert.equal(leads.find((l) => l.variable === 'FLAT').status, 'flat');
  assert.equal(leads.find((l) => l.variable === 'NONE').status, 'no-data');
  assert.ok(leads.find((l) => l.variable === 'TREND').q >= leads.find((l) => l.variable === 'TREND').result.p);
});

test('a scan lead that loses significance after adjustment carries the adjusted verdict', async () => {
  const { scan } = await import('../engine.js');
  const u = rng(7);
  const years = Array.from({ length: 30 }, (_, i) => 1990 + i);
  // Find a weak trend that is significant alone (0.01 < p < 0.05); next to 5 noise series its q must exceed 0.05.
  let weak;
  for (let k = 0; k < 500 && !weak; k++) {
    const values = years.map((_, i) => 0.03 * i + normal(u));
    const p = mannKendallHR(values).p;
    if (p > 0.012 && p < 0.05) weak = values;
  }
  assert.ok(weak, 'no weak trend found');
  const input = { WEAK: { years, values: weak } };
  for (let j = 0; j < 5; j++) input[`N${j}`] = { years, values: years.map(() => normal(u)) };
  const lead = scan(input).find((l) => l.variable === 'WEAK');
  assert.ok(lead.q > lead.result.p);
  assert.equal(lead.result.verdict, lead.verdict, 'result verdict must match the list verdict');
  if (lead.verdict !== 'confirmed') { assert.equal(lead.result.adjusted, true); assert.equal(lead.result.knownSince, null); }
});

test('annualFromDaily averages complete years and drops years with a missing day', async () => {
  const { annualFromDaily } = await import('../engine.js');
  const dates = [];
  for (let t = Date.UTC(2020, 0, 2); t <= Date.UTC(2022, 0, 1); t += 86400000) dates.push({ date: new Date(t).toISOString(), value: 2 });
  dates[400].value = null; // a day in 2021
  assert.deepEqual(annualFromDaily(dates), { years: [2020], values: [2] });
  dates[10].value = -1; dates[11].value = -3; // two frost days in 2020
  assert.deepEqual(annualFromDaily(dates, (v) => v < 0), { years: [2020], values: [2] });
});

test('a witness only contradicts when its own trend is at least likely', async () => {
  const { compareWitnesses } = await import('../engine.js');
  const years = Array.from({ length: 40 }, (_, i) => 1980 + i);
  const wiggle = (i) => (((i * 7) % 5) - 2) * 0.05;
  const up = { years, values: years.map((_, i) => 0.05 * i + wiggle(i)), source: 'A' };
  const down = { years, values: years.map((_, i) => -0.05 * i + wiggle(i)), source: 'B' };
  const noise = { years, values: years.map((_, i) => (Math.sin(i * 12.9898) * 43758.5453) % 1), source: 'C' };
  assert.equal(compareWitnesses(up, up).status, 'corroborated');
  assert.equal(compareWitnesses(up, down).status, 'contradicted');
  assert.equal(compareWitnesses(up, noise).status, 'not-corroborated');
});

test('Student t p-values match published tables', async () => {
  const { studentTwoSidedP } = await import('../engine.js');
  assert.ok(Math.abs(studentTwoSidedP(2.0, 10) - 0.07339) < 1e-4);
  assert.ok(Math.abs(studentTwoSidedP(2.228, 10) - 0.05) < 1e-3);
  assert.ok(Math.abs(studentTwoSidedP(1.96, 1e6) - 0.05) < 1e-3);
});

test('the linear t-test finds a clear trend and agrees in direction with Sen', async () => {
  const { linearTTest } = await import('../engine.js');
  const years = Array.from({ length: 30 }, (_, i) => 1990 + i);
  const values = years.map((y, i) => 0.05 * i + (((i * 7) % 5) - 2) * 0.05);
  const r = linearTTest(years, values);
  assert.ok(Math.abs(r.slope - 0.05) < 0.005 && r.p < 0.001 && r.ci[0] > 0);
});

test('prediction test: a real trend beats "nothing changes", pure noise does not', async () => {
  const { predictionTest } = await import('../engine.js');
  const years = Array.from({ length: 45 }, (_, i) => 1981 + i);
  const trend = predictionTest({ years, values: years.map((_, i) => 0.05 * i + (((i * 7) % 5) - 2) * 0.05) });
  assert.ok(trend.skill > 0.5, `skill ${trend.skill}`);
  assert.deepEqual(trend.testYears, [2011, 2025]);
  const flat = predictionTest({ years, values: years.map((_, i) => (Math.sin(i * 12.9898) * 43758.5453) % 1) });
  assert.ok(flat.skill < 0.2, `skill ${flat.skill}`);
  assert.equal(predictionTest({ years: years.slice(0, 20), values: years.slice(0, 20) }), null);
});

test('block shuffle keeps the values but removes a strong trend', async () => {
  const { blockShuffle } = await import('../engine.js');
  const values = Array.from({ length: 45 }, (_, i) => i + (((i * 7) % 5) - 2) * 0.1);
  const u = rng(3);
  let trendless = 0;
  for (let k = 0; k < 50; k++) {
    const s = blockShuffle(values, u);
    assert.deepEqual([...s].sort((a, b) => a - b), [...values].sort((a, b) => a - b));
    if (Math.abs(mannKendallHR(s).tau) < 0.5) trendless++;
  }
  assert.ok(trendless > 40, `only ${trendless}/50 shuffles lost the trend`);
});

test('alibi test: removing a pure El Niño signal leaves a real trend standing, and explains a pure El Niño series', async () => {
  const { alibiTest } = await import('../engine.js');
  const years = Array.from({ length: 40 }, (_, i) => 1981 + i);
  const enso = { years, values: years.map((_, i) => Math.sin(i * 1.7) * 1.2) };
  const trendPlusEnso = { years, values: years.map((_, i) => 0.03 * i + 0.5 * enso.values[i] + (((i * 7) % 5) - 2) * 0.02) };
  const a = alibiTest(trendPlusEnso, enso);
  assert.equal(a.after.verdict, 'confirmed');
  assert.ok(Math.abs(a.coefficient - 0.5) < 0.05, `coef ${a.coefficient}`);
  const onlyEnso = { years, values: years.map((_, i) => 0.8 * enso.values[i] + (((i * 7) % 5) - 2) * 0.01) };
  const b = alibiTest(onlyEnso, enso);
  assert.ok(b.share > 0.9, `share ${b.share}`);
  assert.notEqual(b.after.verdict, 'confirmed');
});

test('area-weighted mean gives polar cells less weight and skips incomplete cells', async () => {
  const { areaWeightedMean } = await import('../engine.js');
  const years = [2000, 2001];
  const r = areaWeightedMean([
    { years, values: [0, 0] },       // equator, weight 1
    { years, values: [10, 10] },     // 60°, weight 0.5
    { years: [2000], values: [99] }, // incomplete: skipped
  ], [0, 60, 0]);
  assert.equal(r.cells, 2);
  assert.ok(Math.abs(r.values[0] - 10 * 0.5 / 1.5) < 1e-3, `${r.values[0]}`);
});
