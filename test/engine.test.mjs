// Pruebas del motor: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, mannKendallHR, senSlope, annualFromPower, yearsNeeded, detectionYears } from '../engine.js';

// Generador seudoaleatorio fijo (mulberry32) y normal por Box-Muller, para simulaciones reproducibles.
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const normal = (u) => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());

test('el reloj acierta: con n* años la tendencia se detecta cerca del 90 % de las veces', () => {
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
    // Mann-Kendall con Hamed-Rao es algo más conservador que la regresión que asume la fórmula.
    assert.ok(power > 0.75 && power < 0.97, `sd=${sd} phi=${phi} slope=${slope} n=${n}: potencia ${power}`);
  }
});

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)));
const reference = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url)));

test('Mann-Kendall Hamed-Rao y Sen coinciden con pymannkendall en series reales de NASA POWER', () => {
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

// Una recta perfecta no sirve: el redondeo crea autocorrelación falsa en los residuos (igual en pymannkendall).
test('una tendencia fuerte con ruido sale confirmada, sin reloj y con "se sabe desde"', () => {
  const years = Array.from({ length: 30 }, (_, i) => 1990 + i);
  const values = years.map((y, i) => 0.05 * (y - 1990) + (((i * 7) % 5) - 2) * 0.05);
  const r = analyze({ years, values });
  assert.equal(r.verdict, 'confirmed');
  assert.equal(r.yearsNeeded, null);
  assert.ok(Math.abs(r.slopePerDecade - 0.5) < 0.05);
  assert.ok(r.knownSince >= 1997 && r.knownSince <= 2010, `knownSince ${r.knownSince}`);
});

test('ruido sin tendencia no sale confirmado y el reloj da un número o infinito', () => {
  const years = Array.from({ length: 30 }, (_, i) => 1990 + i);
  const values = years.map((_, i) => Math.sin(i * 12.9898) * 43758.5453 % 1); // seudoaleatorio fijo
  const r = analyze({ years, values });
  assert.notEqual(r.verdict, 'confirmed');
  assert.ok(r.yearsNeeded === Infinity || r.yearsNeeded >= 0);
});

test('el reloj crece cuando la pendiente es más pequeña respecto del ruido', () => {
  const t = Array.from({ length: 20 }, (_, i) => i);
  const noise = t.map((i) => ((i * 7) % 5) - 2);
  const a = yearsNeeded(t, t.map((i) => 0.2 * i + noise[i]), 0.2, 0);
  const b = yearsNeeded(t, t.map((i) => 0.05 * i + noise[i]), 0.05, 0);
  assert.ok(b > a, `${b} debería ser > ${a}`);
});

test('annualFromPower descarta años incompletos, el año en curso y el mes 13', () => {
  const p = {};
  for (let m = 1; m <= 13; m++) { p[`2020${String(m).padStart(2, '0')}`] = m === 13 ? 999 : m; p[`2021${String(m).padStart(2, '0')}`] = m === 5 ? -999 : 1; }
  const s = annualFromPower({ header: { fill_value: -999 }, properties: { parameter: { T2M: p } }, parameters: { T2M: { units: 'C' } } }, 'T2M', 2026);
  assert.deepEqual(s.years, [2020]);
  assert.equal(s.values[0], 6.5);
});

test('analyze rechaza series demasiado cortas', () => {
  assert.throws(() => analyze({ years: [1, 2, 3], values: [1, 2, 3] }), /al menos/);
});
