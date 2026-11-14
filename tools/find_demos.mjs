import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { analyze, annualSeriesFromPower } from '../engine.js';
import { getJson, pointUrl, mapLimited } from './power_api.mjs';

const catalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url)));
const end = new Date().getUTCFullYear() - 1;
const rows = [];
const requests = [];
const failures = [];
// Separate products so the response header describes each series without mixed-source attribution.
const groups = Map.groupBy(catalog.variables, v => `${v.source}:${v.start}`);
await mapLimited(catalog.places, async place => {
  let usable = 0;
  for (const variables of groups.values()) {
    for (let offset = 0; offset < variables.length; offset += 10) {
      const chunk = variables.slice(offset, offset + 10);
      const url = pointUrl(chunk.map(v => v.id).join(','), place.lat, place.lon, chunk[0].start, end);
      const response = await getJson(url);
      requests.push({ place: place.id, url, retrieved: response.retrieved, status: response.status,
        sources: response.body.header?.sources, messages: response.body.messages });
      if (response.status !== 200) {
        failures.push({ place: place.id, variables: chunk.map(v => v.id), status: response.status, messages: response.body.messages });
        continue;
      }
      const sources = response.body.header.sources.filter(s => s !== 'POWER').join(' + ');
      assert.equal(sources, chunk[0].source, `Unexpected product at ${place.id}: ${sources}`);
      const seriesById = annualSeriesFromPower(response.body, chunk);
      for (const variable of chunk) {
        const series = seriesById[variable.id];
        assert.equal(series.years.length, series.values.length);
        assert.ok(series.values.every(Number.isFinite), `Non-finite value: ${place.id}/${variable.id}`);
        if (series.years.length < 8) {
          rows.push({ place: place.id, variable: variable.id, status: 'no-data', n: series.years.length });
        } else if (Math.max(...series.values) === Math.min(...series.values)) {
          rows.push({ place: place.id, variable: variable.id, status: 'flat', n: series.years.length });
        } else {
          const result = analyze(series);
          if (!Number.isFinite(result.p)) {
            failures.push({ place: place.id, variable: variable.id, reason: 'Engine returned a non-finite p-value; excluded without modifying the engine.' });
            rows.push({ place: place.id, variable: variable.id, status: 'invalid-result', n: series.years.length });
            continue;
          }
          rows.push({ place: place.id, variable: variable.id, status: 'ok', series, result });
          usable++;
        }
      }
    }
  }
  console.log(`${place.short}: ${usable} analyzed variables`);
});

const ok = rows.filter(row => row.status === 'ok');
let opposite;
// Prefer rainfall, then check the rest in catalog order, always keeping the full product window.
for (const variable of ['PRECTOTCORR', ...catalog.variables.map(v => v.id).filter(id => id !== 'PRECTOTCORR')]) {
  const eligible = ok.filter(row => row.variable === variable && row.result.p < 0.1);
  const pairs = [];
  for (const a of eligible) for (const b of eligible) {
    if (a.result.slopePerDecade > 0 && b.result.slopePerDecade < 0) pairs.push([a, b]);
  }
  pairs.sort((a, b) => Math.max(a[0].result.p, a[1].result.p) - Math.max(b[0].result.p, b[1].result.p));
  if (pairs.length) { opposite = pairs[0]; break; }
}
assert.ok(opposite, 'No opposite-direction pair with both p < 0.10 was found.');
const confirmed = ok.find(row => row.place === 'coropuna' && row.variable === 'T2M' && row.result.verdict === 'confirmed' && row.result.knownSince)
  ?? ok.filter(row => row.result.verdict === 'confirmed' && row.result.knownSince).sort((a, b) => a.result.p - b.result.p)[0];
assert.ok(confirmed, 'No confirmed trend with a known-since year was found.');
const unknown = ok.filter(row => row.result.verdict === 'unknown' && Number.isFinite(row.result.yearsNeeded) && row.result.yearsNeeded > 0)
  .sort((a, b) => a.result.yearsNeeded - b.result.yearsNeeded || a.result.p - b.result.p)[0];
assert.ok(unknown, 'No unknown trend with finite additional years was found.');
const placeName = row => catalog.places.find(p => p.id === row.place).short;
const variableName = row => catalog.variables.find(v => v.id === row.variable).name.toLowerCase();
const number = x => Number(Math.abs(x).toPrecision(2)).toString();
const UNIT = { C: '°C', '1': '', dimensionless: '' };
const slope = row => `${number(row.result.slopePerDecade)}${UNIT[row.series.units] === '' ? '' : ' ' + (UNIT[row.series.units] ?? row.series.units)} per decade`;
const pValue = row => (row.result.p < 0.001 ? 'p < 0.001' : `p = ${row.result.p.toFixed(3)}`);
function demo(id, title, selected, why) {
  return { id, title, variable: selected[0].variable, places: selected.map(row => row.place),
    series: Object.fromEntries(selected.map(row => [row.place, row.series])), why };
}
const [a, b] = opposite;
const demos = [
  demo('opposite-trends', `Same variable, opposite directions: ${variableName(a)}`, opposite,
    `From ${a.result.firstYear} to ${a.result.lastYear}, ${variableName(a)} rose ${slope(a)} at ${placeName(a)} (${pValue(a)}) but fell ${slope(b)} at ${placeName(b)} (${pValue(b)}). One variable, two regions, opposite trends.`),
  demo('confirmed-trend', `A confirmed trend at ${placeName(confirmed)}`, [confirmed],
    `From ${confirmed.result.firstYear} to ${confirmed.result.lastYear}, ${variableName(confirmed)} at ${placeName(confirmed)} ${confirmed.result.slopePerDecade > 0 ? 'rose' : 'fell'} ${slope(confirmed)} (${pValue(confirmed)}). With data up to ${confirmed.result.knownSince}, the trend was already significant, and it has stayed significant every year since.`),
  demo('not-yet-known', `Not yet known at ${placeName(unknown)}`, [unknown],
    `From ${unknown.result.firstYear} to ${unknown.result.lastYear}, ${variableName(unknown)} at ${placeName(unknown)} ${unknown.result.slopePerDecade > 0 ? 'rose' : 'fell'} ${slope(unknown)} (${pValue(unknown)}): not significant yet. If the trend and the noise stay the same, about ${unknown.result.yearsNeeded} more years of data would settle it.`),
];
await writeFile(new URL('../data/demos.json', import.meta.url), JSON.stringify(demos, null, 2) + '\n');
const selected = await Promise.all([a, b, confirmed, unknown].map(async ({ series, ...row }) => {
  const request = requests.find(r => r.place === row.place && new URL(r.url).searchParams.get('parameters').split(',').includes(row.variable));
  const response = await getJson(request.url);
  return { ...row, request, raw: { header: response.body.header,
    properties: { parameter: { [row.variable]: response.body.properties.parameter[row.variable] } },
    parameters: { [row.variable]: response.body.parameters[row.variable] },
  } };
}));
await writeFile(new URL('./demo_checks.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString(), end,
  requests, failures, rows: rows.map(({ series, ...row }) => row),
  selected,
}, null, 2) + '\n');
for (const example of demos) console.log(example.why);
await import('./validate_data.mjs');
