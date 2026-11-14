import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze, annualSeriesFromPower } from '../engine.js';

const catalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url)));
const demos = JSON.parse(await readFile(new URL('../data/demos.json', import.meta.url)));
const evidence = JSON.parse(await readFile(new URL('./demo_checks.json', import.meta.url)));
const catalogEvidence = JSON.parse(await readFile(new URL('./catalog_checks.json', import.meta.url)));
assert.equal(new Set(catalog.variables.map(v => v.id)).size, catalog.variables.length);
assert.equal(new Set(catalog.places.map(p => p.id)).size, catalog.places.length);
for (const { place } of catalogEvidence.coordinateEvidence) {
  const current = catalog.places.find(p => p.id === place.id);
  for (const [key, value] of Object.entries(place)) assert.deepEqual(current?.[key], value, `Existing place changed or removed: ${place.id}.${key}`);
}
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
  const citation = catalog.coordinate_evidence?.[p.id] ?? catalogEvidence.coordinateEvidence.find(row => row.place.id === p.id);
  assert.ok(citation, `Missing coordinate evidence: ${p.id}`);
  assert.deepEqual(p, citation.place);
  if (citation.response?.page.coordinates?.length) {
    const coord = citation.response.page.coordinates[0];
    assert.equal(p.lat, coord.lat);
    assert.equal(p.lon, coord.lon);
  } else if (citation.wikidata) {
    const coord = citation.wikidata.claim.mainsnak.datavalue.value;
    assert.equal(p.lat, coord.latitude);
    assert.equal(p.lon, coord.longitude);
  } else assert.equal(typeof citation.citation, 'string');
}
for (const environment of ['glacier', 'desert', 'rainforest', 'city', 'coast', 'ocean', 'polar', 'lake', 'volcano', 'savanna', 'tundra', 'coral_reef', 'wetland']) assert.ok(catalog.places.filter(p => p.environment === environment).length >= 3, `Missing places: ${environment}`);
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

const rivers = JSON.parse(await readFile(new URL('../data/rivers.json', import.meta.url)));
const facts = JSON.parse(await readFile(new URL('../data/place_facts.json', import.meta.url)));
const places = [...new Map([...rivers.places, ...catalog.places].map(p => [p.id, p])).values()];
assert.deepEqual(Object.keys(facts.facts).sort(), places.map(p => p.id).sort());
assert.ok(Number.isFinite(Date.parse(facts.generated)));
assert.ok(facts.source.climate.includes('NASA POWER'));
for (const place of places) {
  const fact = facts.facts[place.id];
  assert.ok(fact.country?.length);
  assert.equal(fact.elevation_label, 'NASA POWER grid elevation');
  assert.ok(Number.isFinite(fact.elevation_m) || (fact.elevation_m === null && fact.elevation_note));
  const climateKeys = ['mean_temp_c', 'mean_precip_mm_day', 'warming_c_per_decade'];
  if (climateKeys.every(key => fact[key] === null)) {
    assert.ok(['pending', 'unavailable'].includes(fact.climate_status) && fact.climate_note, `${place.id}: unexplained null climate`);
    assert.equal(fact.warming_verdict, null);
  } else {
    for (const key of climateKeys) assert.ok(Number.isFinite(fact[key]), `${place.id}: invalid ${key}`);
    assert.ok(fact.mean_temp_c > -100 && fact.mean_temp_c < 65);
    assert.ok(fact.mean_precip_mm_day >= 0 && fact.mean_precip_mm_day < 100);
    assert.ok(['confirmed', 'likely', 'unknown'].includes(fact.warming_verdict));
  }
  assert.deepEqual(fact.climatology_period, [1991, 2020]);
  assert.deepEqual(fact.warming_period, [1981, new Date().getUTCFullYear() - 1]);
  assert.ok(fact.one_line.trim().split(/\s+/).length <= 14);
  const textSource = new URL(fact.one_line_source);
  assert.ok(textSource.hostname === 'en.wikipedia.org' && /^\d+$/.test(textSource.searchParams.get('oldid')) ||
    textSource.hostname === 'www.wikidata.org' && /^\d+$/.test(textSource.searchParams.get('revision')));
  assert.equal(new URL(fact.country_source).protocol, 'https:');
  for (const source of Object.values(fact.power_sources)) {
    assert.equal(new URL(source.url).hostname, 'power.larc.nasa.gov');
    assert.ok(Number.isFinite(Date.parse(source.retrieved)));
  }
  const image = await readFile(new URL(`../img/places/${place.id}.jpg`, import.meta.url));
  assert.ok(image.length <= 25000 && image[0] === 255 && image[1] === 216, `${place.id}: invalid or oversized JPEG`);
}
const credits = await readFile(new URL('../img/places/CREDITS.md', import.meta.url), 'utf8');
for (const place of places) assert.ok(credits.includes(`](./${place.id}.jpg)`), `${place.id}: missing image credit`);
if (process.argv.includes('--cache')) {
  const { generateFacts } = await import('./place_facts.mjs');
  assert.deepEqual((await generateFacts(true)).facts, facts.facts);
}
console.log(`Validated facts, image files, and image credits for all ${places.length} catalog and river places.`);

try {
  const coverage = JSON.parse(await readFile(new URL('../data/coverage.json', import.meta.url)));
  const { distance } = await import('./build_universes.mjs');
  const visibleRivers = rivers.places.filter(p => !p.quality?.flags?.length && rivers.series[p.id]).map(p => coverage.existing_river_metadata[p.id]);
  const visible = [...catalog.places, ...visibleRivers];
  assert.equal(new Set(visible.map(p => p.id)).size, visible.length, 'UI would append duplicate river IDs');
  for (const p of visible) {
    assert.ok(/^Q\d+$/.test(p.wikidata), `${p.id}: missing Wikidata identity`);
    assert.ok(p.country && p.continent, `${p.id}: missing geographic metadata`);
    assert.ok(Array.isArray(p.country_codes) && p.country_codes.every(c => /^[A-Z]{2}$/.test(c)), p.id);
    for (const key of ['area_km2', 'population', 'length_km']) if (key in p) assert.ok(Number.isFinite(p[key]) && p[key] >= 0);
  }
  for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) assert.ok(distance(visible[i], visible[j]) >= 5, `${visible[i].id}/${visible[j].id}: sampling points closer than 5 km`);
  assert.deepEqual(Object.keys(coverage.kinds).sort(), [...new Set(visible.map(p => p.environment))].sort());
  for (const [kind, row] of Object.entries(coverage.kinds)) {
    assert.equal(new Set(row.members).size, row.N, `${kind}: incorrect denominator`);
    const included = row.members.filter(q => visible.some(p => p.wikidata === q));
    assert.deepEqual(included, row.included_wikidata);
    assert.equal(included.length, row.included);
    assert.ok(row.included >= Math.ceil(0.2 * row.N), `${kind}: under 20%`);
    assert.ok(Math.abs(row.percent - 100 * row.included / row.N) < 1e-9);
    assert.ok(Number.isFinite(Date.parse(row.retrieved)) && row.query.includes('SELECT DISTINCT'));
    for (const continent of row.continents) assert.ok(visible.some(p => included.includes(p.wikidata) && p.continent.split('; ').includes(continent)), `${kind}: continent missing: ${continent}`);
  }
  console.log(`Validated all ${Object.keys(coverage.kinds).length} universes, coverage denominators, metadata and 5 km separation.`);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
