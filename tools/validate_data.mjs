import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze, annualSeriesFromPower } from '../engine.js';

const catalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url)));
const demos = JSON.parse(await readFile(new URL('../data/demos.json', import.meta.url)));
const evidence = JSON.parse(await readFile(new URL('./demo_checks.json', import.meta.url)));
const catalogEvidence = JSON.parse(await readFile(new URL('./catalog_checks.json', import.meta.url)));
assert.equal(new Set(catalog.variables.map(v => v.id)).size, catalog.variables.length);
assert.equal(new Set(catalog.places.map(p => p.id)).size, catalog.places.length);
for (const v of catalog.variables) {
  for (const key of ['id', 'name', 'group', 'definition', 'power_definition', 'units', 'source', 'notes']) assert.equal(typeof v[key], 'string');
  assert.ok(['Heat', 'Water', 'Sun and clouds', 'Air'].includes(v.group));
  assert.ok(Number.isInteger(v.start) && v.start <= 2005);
  assert.equal(typeof v.land_only, 'boolean');
  const checked = catalogEvidence.checks.find(row => row.id === v.id);
  assert.equal(v.power_definition, checked.metadata.body[v.id].temporal.MONTHLY.definition);
  assert.equal(v.source, checked.current_source);
  assert.equal(v.start, checked.current_start);
  assert.equal(v.land_only, checked.land_only);
  assert.equal(checked.probes.length, 4);
  for (const probe of checked.probes) assert.equal(new URL(probe.url).searchParams.get('parameters'), v.id);
}
for (const p of catalog.places) {
  assert.ok(Number.isFinite(p.lat) && Math.abs(p.lat) <= 90);
  assert.ok(Number.isFinite(p.lon) && Math.abs(p.lon) <= 180);
  assert.equal(new URL(p.coord_source).protocol, 'https:');
  assert.deepEqual(p, catalogEvidence.coordinateEvidence.find(row => row.place.id === p.id).place);
}
for (const environment of ['glacier', 'desert', 'rainforest', 'city', 'coast', 'ocean', 'polar']) assert.ok(catalog.places.filter(p => p.environment === environment).length >= 3);
for (const id of ['coropuna', 'quelccaya', 'huascaran', 'zongo', 'chimborazo', 'perito-moreno', 'columbia', 'jakobshavn', 'aletsch', 'kilimanjaro', 'khumbu', 'puncak-jaya']) assert.ok(catalog.places.some(p => p.id === id));
assert.equal(demos.length, 3);
for (const demo of demos) {
  const variable = catalog.variables.find(v => v.id === demo.variable);
  assert.ok(variable);
  assert.equal(Object.keys(demo.series).length, demo.places.length);
  const results = demo.places.map(id => {
    assert.ok(catalog.places.some(p => p.id === id));
    const series = demo.series[id];
    assert.equal(series.years.length, series.values.length);
    assert.ok(series.values.every(Number.isFinite));
    assert.ok(series.years.every((y, i) => Number.isInteger(y) && y >= variable.start && y < new Date().getFullYear() && (!i || y > series.years[i - 1])));
    assert.ok(series.source.includes(variable.source));
    const result = analyze(series);
    assert.ok(Number.isFinite(result.p));
    const original = evidence.selected.find(row => row.place === id && row.variable === demo.variable);
    assert.ok(original, 'Missing original monthly evidence');
    assert.deepEqual(series, annualSeriesFromPower(original.raw, [variable])[variable.id]);
    assert.deepEqual(result, original.result);
    return result;
  });
  if (demo.id.startsWith('opposite-')) {
    assert.equal(results.length, 2);
    assert.ok(results.every(r => r.p < 0.1));
    assert.ok(results[0].slopePerDecade * results[1].slopePerDecade < 0);
  } else if (demo.id === 'confirmed-trend') {
    assert.equal(results[0].verdict, 'confirmed');
    assert.ok(Number.isInteger(results[0].knownSince));
  } else if (demo.id === 'not-yet-known') {
    assert.equal(results[0].verdict, 'unknown');
    assert.ok(Number.isFinite(results[0].yearsNeeded) && results[0].yearsNeeded > 0);
  } else assert.fail(`Unexpected demo: ${demo.id}`);
}
console.log(`Validated ${catalog.variables.length} variables, ${catalog.places.length} cited places, and all ${demos.length} offline demos.`);
