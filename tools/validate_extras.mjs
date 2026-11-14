import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { analyze } from '../engine.js';
import { modisSeries } from './fetch_modis.mjs';
import { annualDischarge, mouthCoordinate } from './fetch_rivers.mjs';

// Synthetic fixtures test transforms only; none are written to the data products.
const npp = { band: 'Npp_500m', min: -30000, max: 32700, scale: 0.0001, units: 'kg C/m2/yr', id: 'NPP', product: 'MOD17A3HGF' };
const row = (year, raw) => ({ band: npp.band, calendar_date: `${year}-01-01`, data: [raw] });
assert.deepEqual(modisSeries([row(2001, 1000), row(2002, 32766), row(2003, -1000), row(2004, 32762)], npp).series.values, [0.1, -0.1]);
assert.equal(modisSeries([row(2001, 32767)], npp).status, 'fewer-than-eight-valid-years');
assert.equal(modisSeries(Array.from({ length: 8 }, (_, i) => row(2001 + i, 1000)), npp).status, 'constant');
const et = { ...npp, band: 'ET_500m', min: 0, max: 65500, scale: 0.1, units: 'kg/m2/yr', id: 'MODIS_ET', product: 'MOD16A3GF' };
assert.deepEqual(modisSeries([{ ...row(2001, 100), band: et.band }, { ...row(2002, 65529), band: et.band }], et).series.values, [10]);
assert.throws(() => modisSeries([row(2001, 1000), row(2001, 1001)], npp));
const dates = Array.from({ length: 366 }, (_, i) => new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10));
const daily = { time: dates, river_discharge: dates.map(() => 2) };
assert.deepEqual(annualDischarge(daily, 2000).years, [2000]);
assert.deepEqual(annualDischarge(daily, 2000).values, [2]);
assert.equal(annualDischarge({ ...daily, river_discharge: daily.river_discharge.map((v, i) => i === 10 ? null : v) }, 2000).years.length, 0);
assert.equal(annualDischarge({ time: dates.slice(1), river_discharge: daily.river_discharge.slice(1) }, 2000).years.length, 0);
assert.throws(() => annualDischarge({ time: [...dates, dates[0]], river_discharge: [...daily.river_discharge, 2] }, 2000));
assert.deepEqual(mouthCoordinate('| mouth_coordinates = {{coord|16|30|0|S|72|45|0|W}}'), [-16.5, -72.75]);
assert.deepEqual(mouthCoordinate('| mouth_coordinates = {{coord|22.0|N|90.9|E}}'), [22, 90.9]);
assert.deepEqual(mouthCoordinate('| mouth_coordinates = {{coord|10.19|106.75|display=it}}'), [10.19, 106.75]);
console.log('Transform self-checks passed (fill, scale, duplicate years, flat series, leap days, missing days, coordinates).');
if (process.argv.includes('--self-test')) process.exit(0);

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [modis, rivers, catalog] = await Promise.all([json('../data/modis.json'), json('../data/rivers.json'), json('../data/catalog.json')]);
const url = value => assert.ok(typeof value === 'string' && /^https:\/\//.test(value), `Missing citation: ${value}`);
const completeYear = new Date().getUTCFullYear() - 1;
let count = 0;
function series(s, minYear, nonconstant) {
  assert.ok(s.years.length >= 8);
  assert.equal(s.years.length, s.values.length);
  s.years.forEach((y, i) => assert.ok(Number.isInteger(y) && y >= minYear && y <= completeYear && (!i || y > s.years[i - 1])));
  assert.ok(s.values.every(Number.isFinite));
  assert.ok(s.units && s.source && s.variable);
  if (nonconstant) assert.ok(new Set(s.values).size > 1);
  if (new Set(s.values).size > 1) {
    const a = analyze(s);
    assert.ok(Number.isFinite(a.p) && Number.isFinite(a.slopePerDecade), `Invalid engine result: ${s.variable}`);
  }
  count++;
}
assert.ok(Number.isFinite(Date.parse(modis.generated)) && Number.isFinite(Date.parse(rivers.generated)));
assert.ok(modis.extraVariables.length && Object.keys(modis.extra).length);
const variables = new Map(modis.extraVariables.map(v => [v.id, v]));
assert.equal(variables.size, modis.extraVariables.length);
for (const v of variables.values()) {
  for (const k of ['id', 'name', 'group', 'units', 'definition', 'source']) assert.ok(v[k]);
  assert.equal(v.organization, 'NASA');
}
for (const [id, entries] of Object.entries(modis.extra)) {
  const place = catalog.places.find(p => p.id === id);
  assert.ok(place && place.environment !== 'ocean');
  url(place.coord_source);
  for (const [key, s] of Object.entries(entries)) {
    assert.equal(s.variable, key);
    assert.equal(s.units, variables.get(key)?.units);
    assert.equal(s.source, variables.get(key)?.source);
    series(s, 2001, true);
  }
}
assert.equal(rivers.organization, 'Copernicus Emergency Management Service (GloFAS) via Open-Meteo');
assert.ok(rivers.source && rivers.terms.license && rivers.terms.attribution);
assert.equal(rivers.places.length, 17);
assert.equal(new Set(rivers.places.map(p => p.id)).size, rivers.places.length);
assert.deepEqual(Object.keys(rivers.series).sort(), rivers.places.map(p => p.id).sort());
for (const p of rivers.places) {
  url(p.coord_source);
  assert.equal(p.environment, 'river');
  for (const xy of [[p.lat, p.lon], p.snapped]) assert.ok(xy.length === 2 && xy.every(Number.isFinite) && Math.abs(xy[0]) <= 90 && Math.abs(xy[1]) <= 180);
  if (p.published_mean_m3s !== null) { assert.ok(p.published_mean_m3s > 0); url(p.published_source); }
  assert.ok(Array.isArray(p.quality.flags));
  assert.ok(Number.isFinite(p.quality.mean_m3s) && p.quality.mean_m3s >= 0);
  if (p.published_mean_m3s !== null) {
    const ratio = p.quality.mean_m3s / p.published_mean_m3s;
    assert.equal(p.quality.ratio_to_published, ratio);
    assert.equal(p.quality.flags.includes('mean-mismatch'), ratio < 0.5 || ratio > 2);
  }
  if (p.attempted_mouth) url(p.attempted_mouth.coord_source);
  assert.equal(rivers.series[p.id].variable, 'DISCHARGE');
  assert.equal(rivers.series[p.id].units, 'm3/s');
  assert.ok(rivers.series[p.id].values.every(v => v >= 0));
  series(rivers.series[p.id], 1984, false);
}
for (const id of ['majes_camana', 'chili']) assert.ok(rivers.places.some(p => p.id === id));
if (process.argv.includes('--cache')) {
  const cached = async url => {
    const response = await json(`./.cache/${createHash('sha256').update(url).digest('hex')}.json`);
    assert.equal(response.url, url);
    assert.equal(response.status, 200);
    return response.body;
  };
  const report = await json('./.cache/modis_report.json');
  const expectedPlaces = catalog.places.filter(p => p.environment !== 'ocean').map(p => p.id).sort();
  for (const variable of variables.keys()) {
    const checks = report.checks.filter(c => c.variable === variable);
    assert.deepEqual(checks.map(c => c.place).sort(), expectedPlaces);
    for (const check of checks) {
      assert.notEqual(check.status, 'request-error', check.error);
      const rows = [];
      for (const request of check.requests) rows.push(...(await cached(request.url)).subset);
      const result = modisSeries(rows, variable === 'NPP' ? npp : et);
      assert.equal(result.status, check.status);
      assert.deepEqual(result.rejected, check.rejected);
      if (result.status === 'kept') assert.deepEqual(result.series, modis.extra[check.place][variable]);
      else assert.ok(!modis.extra[check.place]?.[variable]);
    }
  }
  const riverReport = await json('./.cache/rivers_report.json');
  assert.equal(riverReport.checks.length, rivers.places.length);
  for (const check of riverReport.checks) {
    const raw = await cached(check.url), place = rivers.places.find(p => p.id === check.place);
    assert.deepEqual(place.snapped, [raw.latitude, raw.longitude]);
    assert.deepEqual(annualDischarge(raw.daily, completeYear).years, rivers.series[place.id].years);
    assert.deepEqual(annualDischarge(raw.daily, completeYear).values, rivers.series[place.id].values);
    assert.deepEqual(place.quality, check.quality);
  }
  console.log('All non-ocean MODIS attempts covered; bundled values exactly match cached original responses.');
}
console.log(`Validated ${count} cited series; both JSON files parse and pass schema and engine checks.`);
