import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { analyze } from '../engine.js';
import { getJson } from './power_api.mjs';

const source = 'GloFAS v4 consolidated reanalysis via Open-Meteo';
const stationCatalogue = 'https://grdc.bafg.de/downloads/GTN-R.xlsx';
const report21 = 'https://doi.bafg.de/BfG/1998/GRDC_Report_21.pdf';
const stations = {
  amazon_river: [-1.9472, -55.5111, 'Obidos - Porto', stationCatalogue, 3],
  yangtze_river: [30.77, 117.62, 'Datong', stationCatalogue, 2],
  mississippi_river: [32.315, -90.9058, 'Vicksburg', stationCatalogue, 3],
  yenisei_river: [67.43, 86.48, 'Igarka', stationCatalogue, 1],
  ob_river: [66.63, 66.6, 'Salekhard', stationCatalogue, 1],
  mackenzie_river: [67.458336, -133.74472, 'Arctic Red River', stationCatalogue, 1],
  ganges_river: [25, 87.92, 'Farakka', report21, 3],
  mekong_river: [16.53, 104.73, 'Mukdahan', report21, 1],
  rhine_river: [51.756918, 6.395395, 'Rees', stationCatalogue, 1],
  danube_river: [45.22, 28.73, 'Ceatal Izmail', 'https://grdc.bafg.de/downloads/GRDC_Report_36.pdf', 1],
};
// Discharge field numbers refer to the cited Wikipedia infobox, not ranked measurements.
const rivers = [
  ['amazon_river', 'Amazon River', 'Amazon', 1],
  ['congo_river', 'Congo River', 'Congo', 1],
  ['yangtze_river', 'Yangtze', 'Yangtze', 1],
  ['mississippi_river', 'Mississippi River', 'Mississippi', 1, 'Published delta total includes the Atchafalaya; one mouth cell may represent only one branch.'],
  ['niger_river', 'Niger River', 'Niger', 1],
  ['yenisei_river', 'Yenisei', 'Yenisei', 3],
  ['lena_river', 'Lena River', 'Lena', 1, 'Published reference is upstream at Kyusyur, not at the delta mouth.'],
  ['ob_river', 'Ob', 'Ob', 1, 'Published reference is upstream at Salekhard, not at the estuary.'],
  ['mackenzie_river', 'Mackenzie River', 'Mackenzie', 1],
  ['parana_river', 'Paran\u00e1 River', 'Parana', 1, 'Mouth coordinate is the Parana Guazu distributary; published reference describes total river flow.'],
  ['danube_river', 'Danube', 'Danube', 1],
  ['ganges_river', 'Ganges', 'Ganges', 2, 'Published reference is Ganges-only; the cited delta mouth also receives Brahmaputra and Meghna water.'],
  ['mekong_river', 'Mekong', 'Mekong', 1],
  ['murray_river', 'Murray River', 'Murray', 1],
  ['rhine_river', 'Rhine', 'Rhine', 1],
  ['majes_camana', 'Colca River', 'Majes-Camana', null],
];

export function mouthCoordinate(wikitext) {
  const match = wikitext.match(/\|\s*mouth_coordinates\s*=\s*\{\{coord\|([^}]+)/i);
  assert.ok(match, 'No cited mouth coordinate');
  const parts = match[1].split('|').map(p => p.trim());
  let point;
  const ns = parts.findIndex(p => /^[NS]$/.test(p));
  if (ns < 0) point = parts.slice(0, 2).map(Number);
  else {
    const ew = parts.findIndex(p => /^[EW]$/.test(p));
    const degrees = a => { assert.ok(a.length >= 1 && a.length <= 3 && a.every(x => x !== '' && Number.isFinite(Number(x)))); return Number(a[0]) + Number(a[1] || 0) / 60 + Number(a[2] || 0) / 3600; };
    point = [degrees(parts.slice(0, ns)) * (parts[ns] === 'S' ? -1 : 1), degrees(parts.slice(ns + 1, ew)) * (parts[ew] === 'W' ? -1 : 1)];
  }
  assert.ok(point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180);
  return point;
}

export function annualDischarge(daily, lastYear) {
  assert.equal(daily.time.length, daily.river_discharge.length);
  const byYear = new Map(), seen = new Set();
  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i], value = daily.river_discharge[i];
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date).toISOString().slice(0, 10) === date);
    assert.ok(!seen.has(date), `Duplicate day ${date}`);
    seen.add(date);
    const year = Number(date.slice(0, 4));
    if (year < 1984 || year > lastYear) continue;
    if (!byYear.has(year)) byYear.set(year, { days: 0, valid: 0, sum: 0 });
    const bin = byYear.get(year);
    bin.days++;
    if (Number.isFinite(value) && value >= 0) { bin.valid++; bin.sum += value; }
  }
  const years = [], values = [], dropped = [];
  for (const [year, bin] of [...byYear].sort((a, b) => a[0] - b[0])) {
    const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    if (bin.days !== days || bin.valid !== days) { dropped.push({ year, expected: days, received: bin.days, valid: bin.valid }); continue; }
    years.push(year);
    values.push(bin.sum / days);
  }
  return { years, values, dropped };
}

function publishedMean(wikitext, field) {
  if (field === null) return null;
  const text = wikitext.match(new RegExp(`\\|\\s*discharge${field}_avg\\s*=([^\\n]*)`, 'i'))?.[1];
  const match = text?.match(/\{\{(?:cvt|convert)\|\s*([\d,. ]+)\|\s*(m3\/s|km3\/year|ft3\/s)\s*\|/i);
  assert.ok(match, `Cannot read published mean field ${field}`);
  const value = Number(match[1].replaceAll(',', '').trim());
  assert.ok(Number.isFinite(value) && value > 0);
  return match[2].toLowerCase() === 'km3/year' ? value * 1e9 / (365.25 * 86400) : match[2].toLowerCase() === 'ft3/s' ? value * 0.028316846592 : value;
}

export async function main() {
  const started = Date.now(), lastYear = new Date().getUTCFullYear() - 1;
  await mkdir(new URL('./.cache/', import.meta.url), { recursive: true });
  const titles = rivers.map(r => r[1]);
  const wiki = await getJson('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content|ids', rvslots: 'main', titles: titles.join('|'), format: 'json', redirects: '1' }));
  assert.equal(wiki.status, 200);
  const places = rivers.map(([id, title, short, field, referenceNote]) => {
    const page = Object.values(wiki.body.query.pages).find(p => p.title === title);
    assert.ok(page?.revisions?.length, `Missing Wikipedia page: ${title}`);
    const revision = page.revisions[0], text = revision.slots.main['*'];
    const [lat, lon] = mouthCoordinate(text);
    const coord_source = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replaceAll(' ', '_'))}&oldid=${revision.revid}`;
    return { id, name: `${short} River (mouth)`, short, lat, lon, environment: 'river', coord_source,
      published_mean_m3s: publishedMean(text, stations[id]?.[4] ?? field), published_source: field === null ? null : coord_source,
      reference_note: referenceNote || (field === null ? 'No verified published annual mean was found for this mouth.' : 'Published river/delta mean; period and delta branches may differ from this model cell.') };
  });
  Object.assign(places.find(p => p.id === 'majes_camana'), { published_mean_m3s: 68.03,
    published_source: 'https://repositorio.promperu.gob.pe/server/api/core/bitstreams/e0d56ca0-5150-4543-84c9-94c2b7033b03/content',
    reference_note: 'PROMPERU regional export plan, page 87, reports a Camana river annual mean of 68.03 m3/s; a basin reference, not a colocated or period-matched gauge validation.' });
  const geoUrl = 'https://www.geonames.org/3943900/about.rdf';
  const geoCache = new URL('./.cache/chili_geonames.rdf', import.meta.url);
  const { readFile } = await import('node:fs/promises');
  let geo;
  try { geo = await readFile(geoCache, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(geoUrl, { signal: AbortSignal.timeout(90000) });
    assert.ok(response.ok, `GeoNames HTTP ${response.status}`);
    geo = await response.text();
    await writeFile(geoCache, geo);
  }
  const lat = Number(geo.match(/<wgs84_pos:lat>([^<]+)/)?.[1]), lon = Number(geo.match(/<wgs84_pos:long>([^<]+)/)?.[1]);
  assert.ok(Number.isFinite(lat) && Number.isFinite(lon));
  places.push({ id: 'chili', name: 'Chili River (terminus near Palca, Peru)', short: 'Chili', lat, lon, environment: 'river', coord_source: geoUrl,
    location_note: 'GeoNames river endpoint near the Yura confluence, where the downstream river is named Vitor; not the Quilca ocean mouth.',
    location_source: 'https://revistas.ucr.ac.cr/index.php/rrbt/article/download/233/2955/11453',
    published_mean_m3s: 15.6, published_source: 'https://app.ingemmet.gob.pe/biblioteca/pdf/CPG15-029.pdf',
    reference_note: 'INGEMMET (2010) reports 15.60 m3/s annual mean at upstream Charcani, citing ANA (2010); not a colocated or period-matched validation.' });
  const series = {}, report = { started: new Date(started).toISOString(), model: 'consolidated_v4', requested: [1984, lastYear], checks: [] };
  const pointUrl = place => 'https://flood-api.open-meteo.com/v1/flood?' + new URLSearchParams({ latitude: place.lat, longitude: place.lon, daily: 'river_discharge', start_date: '1984-01-01', end_date: `${lastYear}-12-31`, models: 'consolidated_v4', timezone: 'GMT' });
  for (const place of places) {
    const tick = Date.now();
    if (stations[place.id]) {
      const attempt = await getJson(pointUrl(place));
      assert.equal(attempt.status, 200);
      const annual = annualDischarge(attempt.body.daily, lastYear);
      place.attempted_mouth = { lat: place.lat, lon: place.lon, coord_source: place.coord_source, snapped: [attempt.body.latitude, attempt.body.longitude],
        complete_years: annual.years.length, mean_of_annual_means_m3s: annual.values.length ? annual.values.reduce((a, b) => a + b, 0) / annual.values.length : null,
        reason: annual.years.length < 8 ? 'No usable mouth series; selected a cited upstream gauge.' : 'Mouth cell did not represent whole-river discharge; selected a cited upstream gauge.' };
      const [lat, lon, station, citation] = stations[place.id];
      Object.assign(place, { lat, lon, name: `${place.short} River (${station} gauge)`, coord_source: citation,
        reference_note: ['mackenzie_river', 'mekong_river', 'rhine_river'].includes(place.id)
          ? 'Published reference is downstream river/delta flow, not this upstream gauge; comparisons are approximate.'
          : 'Published reference is for this named station; historical periods differ from the model record.' });
    }
    const url = pointUrl(place);
    const response = await getJson(url);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const body = response.body;
    assert.equal(body.daily_units.river_discharge, 'm³/s');
    assert.equal(body.utc_offset_seconds, 0);
    place.snapped = [body.latitude, body.longitude];
    assert.ok(place.snapped.every(Number.isFinite));
    const { years, values, dropped } = annualDischarge(body.daily, lastYear);
    assert.ok(years.length >= 8, `Insufficient complete years for ${place.id}`);
    series[place.id] = { years, values, units: 'm3/s', source, variable: 'DISCHARGE' };
    const totalDays = years.reduce((sum, y) => sum + (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000, 0);
    const mean = years.reduce((sum, y, i) => sum + values[i] * (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000, 0) / totalDays;
    const ratio = place.published_mean_m3s === null ? null : mean / place.published_mean_m3s;
    const flags = [];
    if (ratio !== null && (ratio < 0.5 || ratio > 2)) flags.push('mean-mismatch');
    if (ratio === null) flags.push('no-published-annual-mean');
    if (new Set(values).size === 1) flags.push('constant-discharge');
    if (mean === 0) flags.push('zero-discharge');
    if (['lena_river', 'chili'].includes(place.id)) flags.push('reference-station-upstream');
    if (['mackenzie_river', 'mekong_river', 'rhine_river', 'parana_river'].includes(place.id)) flags.push('reference-location-differs');
    place.quality = { flags, mean_m3s: mean, ratio_to_published: ratio,
      comparison: 'Screening only: a model/published mean ratio outside 0.5–2 is flagged; this heuristic does not establish correctness, and periods, regulation and delta branches differ.' };
    const analysis = new Set(values).size > 1 ? analyze(series[place.id]) : null;
    report.checks.push({ place: place.id, url, retrieved: response.retrieved, seconds: (Date.now() - tick) / 1000,
      complete_years: years, dropped, quality: place.quality, engine: analysis && { verdict: analysis.verdict, p: analysis.p, slopePerDecade: analysis.slopePerDecade } });
    console.log(`${place.id}: ${years.length} years; mean ${mean.toFixed(2)} m3/s; ${flags.join(', ') || 'within screening range'}`);
    await writeFile(new URL('./.cache/rivers_report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
    if (Date.parse(response.retrieved) >= tick) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  report.seconds = (Date.now() - started) / 1000;
  await writeFile(new URL('./.cache/rivers_report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  const terms = { checked: new Date().toISOString().slice(0, 10), license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/',
    service_terms: 'https://open-meteo.com/en/terms', attribution_rules: 'https://open-meteo.com/en/licence',
    attribution: 'Contains modified Copernicus Emergency Management Service information (GloFAS); river discharge data by Open-Meteo.com (https://open-meteo.com/).',
    display_requirement: 'Link to https://open-meteo.com/ next to every display of these data; retain Copernicus/GloFAS credit and license link.',
    free_api: 'Non-commercial use only; fewer than 10,000 calls/day, 5,000/hour and 600/minute. Long date ranges can count as multiple calls.',
    transformations: 'GloFAS v4 consolidated only, UTC model days; daily arithmetic means for complete calendar years; any missing/invalid day excludes the entire year; no interpolation or forecast substitution.',
    model: 'consolidated_v4', documentation: 'https://open-meteo.com/en/docs/flood-api',
    upstream_license: 'https://open-meteo.com/en/licence',
    upstream_license_note: 'The GloFAS-specific PDF linked by Open-Meteo returned HTTP 404 when checked; Open-Meteo explicitly offers its API data under CC BY 4.0. Retain Copernicus/GloFAS attribution.',
    uncertainty: 'Modelled river discharge, not gauge measurements. Mouth/delta cells can select a small branch or the wrong river; review each place quality flags and reference_note before interpretation.' };
  await writeFile(new URL('../data/rivers.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString(), source,
    organization: 'Copernicus Emergency Management Service (GloFAS) via Open-Meteo', terms, places, series }, null, 2) + '\n');
  console.log(`Rivers: ${places.length} places; ${report.seconds.toFixed(1)} s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
