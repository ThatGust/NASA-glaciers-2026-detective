import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { analyze } from '../engine.js';
import { getJson, mapLimited } from './power_api.mjs';

const base = 'https://modis.ornl.gov/rst/api/v1/';
const specs = [
  { product: 'MOD17A3HGF', band: 'Npp_500m', id: 'NPP', name: 'Plant carbon gain', group: 'Plants', units: 'kg C/m2/yr', scale: 0.0001, min: -30000, max: 32700,
    definition: 'The carbon plants keep each year after using some of their food to stay alive.' },
  { product: 'MOD16A3GF', band: 'ET_500m', id: 'MODIS_ET', name: 'Yearly evapotranspiration', group: 'Water', units: 'kg/m2/yr', scale: 0.1, min: 0, max: 65500,
    definition: 'The water that returns to the air from soil and plants over one year.' },
];

export function modisSeries(rows, spec) {
  const annual = new Map(), rejected = {};
  for (const row of rows) {
    assert.equal(row.band, spec.band);
    assert.equal(row.data.length, 1, 'Request must return exactly one pixel');
    const year = Number(row.calendar_date.slice(0, 4)), raw = row.data[0];
    assert.ok(Number.isInteger(year));
    assert.ok(!annual.has(year), `Duplicate MODIS year ${year}`);
    annual.set(year, null);
    if (!Number.isInteger(raw) || raw < spec.min || raw > spec.max) {
      rejected[String(raw)] = (rejected[String(raw)] || 0) + 1;
      continue;
    }
    annual.set(year, +(raw * spec.scale).toFixed(4));
  }
  const pairs = [...annual].filter(([, v]) => v !== null).sort((a, b) => a[0] - b[0]);
  const series = { years: pairs.map(p => p[0]), values: pairs.map(p => p[1]), units: spec.units,
    source: `MODIS ${spec.product} (NASA) via ORNL DAAC`, variable: spec.id };
  return { series, rejected, status: pairs.length < 8 ? 'fewer-than-eight-valid-years' : new Set(series.values).size < 2 ? 'constant' : 'kept' };
}

export async function main() {
  const started = Date.now();
  const catalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
  const products = await getJson(base + 'products');
  assert.equal(products.status, 200);
  const available = new Set(products.body.products.map(p => p.product));
  assert.ok(available.has('MOD17A3HGF'));
  const selected = specs.filter(s => available.has(s.product));
  const extraVariables = [], extra = {}, report = { started: new Date(started).toISOString(), unavailable: specs.filter(s => !available.has(s.product)).map(s => s.product), checks: [] };
  for (const spec of selected) {
    const bands = await getJson(base + spec.product + '/bands');
    assert.equal(bands.status, 200);
    const band = bands.body.bands.find(b => b.band === spec.band);
    assert.ok(band, `Missing ${spec.band}`);
    assert.equal(Number(band.scale_factor), spec.scale);
    assert.equal(Number(band.add_offset), 0);
    assert.equal(band.valid_range, `${spec.min} to ${spec.max}`);
    extraVariables.push({ id: spec.id, name: spec.name, group: spec.group, units: spec.units, definition: spec.definition,
      source: `MODIS ${spec.product} (NASA) via ORNL DAAC`, organization: 'NASA' });
    await mapLimited(catalog.places.filter(p => p.environment !== 'ocean'), async place => {
      const tick = Date.now();
      const check = { place: place.id, variable: spec.id, coord_source: place.coord_source, requests: [] };
      try {
        const point = { latitude: place.lat, longitude: place.lon };
        const dates = await getJson(`${base}${spec.product}/dates?${new URLSearchParams(point)}`);
        check.dates = { url: dates.url, status: dates.status, retrieved: dates.retrieved };
        const noCoverage = dates.status === 400 && typeof dates.body === 'string' && dates.body.startsWith(`No ${spec.product} data available for `);
        assert.ok(dates.status === 200 || noCoverage, JSON.stringify(dates.body));
        if (noCoverage) check.unavailable_reason = dates.body;
        const steps = noCoverage ? [] : dates.body.dates.filter(d => Number(d.calendar_date.slice(0, 4)) >= 2001 && Number(d.calendar_date.slice(0, 4)) < new Date().getUTCFullYear());
        const rows = [];
        for (let i = 0; i < steps.length; i += 10) {
          const chunk = steps.slice(i, i + 10);
          const url = `${base}${spec.product}/subset?${new URLSearchParams({ ...point, band: spec.band, startDate: chunk[0].modis_date, endDate: chunk.at(-1).modis_date, kmAboveBelow: 0, kmLeftRight: 0 })}`;
          const response = await getJson(url);
          check.requests.push({ url, status: response.status, retrieved: response.retrieved });
          assert.equal(response.status, 200, JSON.stringify(response.body));
          assert.ok(response.body.subset.length <= 10);
          rows.push(...response.body.subset);
        }
        assert.equal(rows.length, steps.length, 'Missing composite in response');
        const result = modisSeries(rows, spec);
        Object.assign(check, { status: result.status, valid: result.series.years.length, rejected: result.rejected, available: steps.length });
        if (result.status === 'kept') {
          const analysis = analyze(result.series);
          check.engine = { verdict: analysis.verdict, p: analysis.p, slopePerDecade: analysis.slopePerDecade };
          (extra[place.id] ??= {})[spec.id] = result.series;
        }
      } catch (error) { check.status = 'request-error'; check.error = error.message; }
      check.seconds = (Date.now() - tick) / 1000;
      report.checks.push(check);
      console.log(`${place.id}/${spec.id}: ${check.status}; ${check.valid ?? 0} valid; ${check.seconds.toFixed(1)} s`);
      await writeFile(new URL('./.cache/modis_report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
    });
  }
  report.seconds = (Date.now() - started) / 1000;
  await writeFile(new URL('./.cache/modis_report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  if (report.checks.some(c => c.status === 'request-error')) throw new Error('MODIS requests failed; successful responses are cached. Rerun to resume; output was not replaced.');
  await writeFile(new URL('../data/modis.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString(), extraVariables, extra }, null, 2) + '\n');
  console.log(`MODIS: ${Object.keys(extra).length} places; ${report.seconds.toFixed(1)} s; unavailable: ${report.unavailable.join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
