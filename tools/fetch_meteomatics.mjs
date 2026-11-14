// Downloads precomputed data from the Meteomatics API for every catalog place and saves ONLY annual values
// to data/witnesses.json. Credentials stay in app/.env, which Git ignores.
//
//   witnesses (second, independent source for a NASA POWER variable):
//     T2M          ERA5 daily mean air temperature (ecmwf-era5)
//     PRECTOTCORR  CHIRPS v3 rain, satellite + rain gauges (chc-chirps3); ERA5 where CHIRPS has no coverage
//   extra variables (no NASA POWER counterpart; labeled with their own source in the app):
//     SST          sea surface temperature from NASA GHRSST (nasa-ghrsst), ocean and coast places
//     FROST_DAYS, HOT_DAYS, HEAVY_RAIN_DAYS   yearly day counts from ERA5
//
// Usage (from app/):
//   node tools/fetch_meteomatics.mjs --dry-run          print the requests for Coropuna, no credentials needed
//   node tools/fetch_meteomatics.mjs --check            a few tiny queries that answer the open questions (run this first)
//   node tools/fetch_meteomatics.mjs --only coropuna    one place
//   node tools/fetch_meteomatics.mjs                    all places
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { annualFromDaily } from '../engine.js';

const here = (p) => new URL(p, import.meta.url);
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const FIRST = 1981, LAST = new Date().getUTCFullYear() - 1;
const SST_FIRST = 2003; // shortcut: assumed GHRSST start (MUR begins mid-2002); --check confirms it

const daily = (from, param) => `${from}-01-02T00:00:00Z--${LAST + 1}-01-01T00:00:00Z:P1D/${param}`;
// Day counts accumulate from 1 January, so the value late on 31 December is the yearly total (--check verifies this).
const yearly = (param) => `${FIRST}-12-31T23:00:00Z--${LAST}-12-31T23:00:00Z:P1Y/${param}`;

const ERA5 = 'ERA5 (ECMWF / Copernicus) via Meteomatics API';
const CHIRPS = 'CHIRPS v3 rain, satellite + gauges (Climate Hazards Center, UCSB) via Meteomatics API';
const GHRSST = 'NASA GHRSST sea surface temperature via Meteomatics API';
export const EXTRA_VARIABLES = [
  { id: 'SST', name: 'Sea surface temperature', group: 'Heat', units: 'C', source: GHRSST, start: SST_FIRST,
    definition: 'How warm the top of the ocean is.' },
  { id: 'FROST_DAYS', name: 'Frost days', group: 'Heat', units: 'days', source: ERA5,
    definition: 'Days in the year when the temperature fell below 0 °C.' },
  { id: 'HOT_DAYS', name: 'Hot days', group: 'Heat', units: 'days', source: ERA5,
    definition: 'Days in the year when the temperature rose above 30 °C.' },
  { id: 'HEAVY_RAIN_DAYS', name: 'Heavy rain days', group: 'Water', units: 'days', source: ERA5,
    definition: 'Days in the year with more than 10 mm of rain.' },
];

const chirpsCovers = (p) => Math.abs(p.lat) <= 50 && p.environment !== 'ocean';
const hasSea = (p) => p.environment === 'ocean' || p.environment === 'coast';

function credentials() {
  const file = here('../.env');
  if (!existsSync(file)) throw new Error('Missing app/.env. Copy app/.env.example to app/.env and fill in your credentials.');
  const env = Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  if (!env.METEOMATICS_USER || !env.METEOMATICS_PASSWORD) throw new Error('METEOMATICS_USER or METEOMATICS_PASSWORD is empty in app/.env.');
  return 'Basic ' + Buffer.from(`${env.METEOMATICS_USER}:${env.METEOMATICS_PASSWORD}`).toString('base64');
}

// The docs use both ?model= and ?source= to pick a data source; try model first, then source.
let sourceKey = 'model';
async function query(auth, path, p, model) {
  for (const key of [sourceKey, sourceKey === 'model' ? 'source' : 'model']) {
    const url = `https://api.meteomatics.com/${path}/${p.lat},${p.lon}/json?${key}=${model}`;
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (r.ok) { sourceKey = key; return (await r.json()).data; }
    const msg = `${r.status} ${(await r.text()).slice(0, 300).replace(/\s+/g, ' ')}`;
    if (r.status !== 400) throw new Error(msg);
    if (key !== sourceKey) throw new Error(msg); // both spellings failed
  }
}
const datesOf = (data, param) => data.find((d) => d.parameter === param).coordinates[0].dates;
const valid = (v) => v != null && v !== -999 && Number.isFinite(v);

function requests(p) {
  const list = [
    { what: 'era5', path: daily(FIRST, 't_mean_2m_24h:C,precip_24h:mm'), model: 'ecmwf-era5' },
    { what: 'counts', path: yearly('frost_days:d,hot_days:d,heavy_rain_days:d'), model: 'ecmwf-era5' },
  ];
  if (chirpsCovers(p)) list.push({ what: 'chirps', path: daily(FIRST, 'precip_24h:mm'), model: 'chc-chirps3' });
  // Daily snapshot at 12 UTC: there is no 24 h mean for sea temperature.
  if (hasSea(p)) list.push({ what: 'sst', path: `${SST_FIRST}-01-01T12:00:00Z--${LAST}-12-31T12:00:00Z:P1D/t_sea_sfc:C`, model: 'nasa-ghrsst' });
  return list;
}

const catalog = JSON.parse(readFileSync(here('../data/catalog.json'), 'utf8'));
const places = catalog.places.filter((p) => !only || p.id === only);
if (!places.length) throw new Error(`No catalog place with id "${only}".`);
const coropuna = catalog.places.find((p) => p.id === 'coropuna');
const pacific = catalog.places.find((p) => p.environment === 'ocean');

if (args.includes('--dry-run')) {
  for (const p of [coropuna, pacific]) for (const q of requests(p)) console.log(p.id, q.what, `https://api.meteomatics.com/${q.path}/${p.lat},${p.lon}/json?model=${q.model}`);
  process.exit(0);
}

const auth = credentials();

if (args.includes('--check')) {
  const show = async (label, fn) => { try { console.log(label, '→', JSON.stringify(await fn())); } catch (e) { console.log(label, '→ FAILED', e.message); } };
  await show('1. source parameter spelling (ERA5, one day)', async () => {
    const d = await query(auth, '2020-06-02T00:00:00Z/t_mean_2m_24h:C', coropuna, 'ecmwf-era5');
    return { works_with: sourceKey, value: datesOf(d, 't_mean_2m_24h:C')[0].value };
  });
  await show('2. day counts around new year (should grow to ~a yearly total, then restart)', async () => {
    const d = await query(auth, '2020-12-30T23:00:00Z,2020-12-31T23:00:00Z,2021-01-01T00:00:00Z,2021-01-01T23:00:00Z/frost_days:d', coropuna, 'ecmwf-era5');
    return datesOf(d, 'frost_days:d').map((x) => [x.date, x.value]);
  });
  for (const y of [1990, 2002, 2003])
    await show(`3. GHRSST sea temperature on ${y}-07-01 at ${pacific.id}`, async () => {
      const d = await query(auth, `${y}-07-01T12:00:00Z/t_sea_sfc:C`, pacific, 'nasa-ghrsst');
      return datesOf(d, 't_sea_sfc:C')[0].value;
    });
  await show('4. CHIRPS rain, one week of 1981 at coropuna', async () => {
    const d = await query(auth, '1981-01-02T00:00:00Z--1981-01-08T00:00:00Z:P1D/precip_24h:mm', coropuna, 'chc-chirps3');
    return datesOf(d, 'precip_24h:mm').map((x) => x.value);
  });
  await show('5. one full ERA5 daily request (45 years) at coropuna: seconds', async () => {
    const t = Date.now(); await query(auth, daily(FIRST, 't_mean_2m_24h:C'), coropuna, 'ecmwf-era5'); return (Date.now() - t) / 1000;
  });
  process.exit(0);
}

const outFile = here('../data/witnesses.json');
const out = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};
out.series ??= {};
out.extra ??= {};
Object.assign(out, {
  generated: new Date().toISOString().slice(0, 10),
  extraVariables: EXTRA_VARIABLES,
  note: 'Annual values only. ERA5 is downscaled by Meteomatics and CHIRPS has ~5 km cells, so absolute levels differ from NASA POWER cells; compare trends, not levels.',
});
const keep = (s) => s.years.length >= 8;

for (const p of places) {
  out.series[p.id] = {};
  out.extra[p.id] = {};
  for (const q of requests(p)) {
    let data;
    try { data = await query(auth, q.path, p, q.model); } catch (e) { console.error(`${p.id} ${q.what}: ${e.message}`); continue; }
    const put = (bucket, id, s, units, source) => {
      if (!keep(s)) return console.log(`${p.id} ${id}: only ${s.years.length} complete years, skipped`);
      bucket[id] = { ...s, units, source, variable: id };
      console.log(`${p.id} ${id}: ${s.years.length} years (${s.years[0]}–${s.years.at(-1)}) · ${source.split(' ')[0]}`);
    };
    if (q.what === 'era5') {
      put(out.series[p.id], 'T2M', annualFromDaily(datesOf(data, 't_mean_2m_24h:C')), 'C', ERA5);
      if (!chirpsCovers(p)) put(out.series[p.id], 'PRECTOTCORR', annualFromDaily(datesOf(data, 'precip_24h:mm')), 'mm/day', ERA5);
    }
    if (q.what === 'chirps') put(out.series[p.id], 'PRECTOTCORR', annualFromDaily(datesOf(data, 'precip_24h:mm')), 'mm/day', CHIRPS);
    if (q.what === 'sst') put(out.extra[p.id], 'SST', annualFromDaily(datesOf(data, 't_sea_sfc:C').map((x) => ({ ...x, date: new Date(Date.parse(x.date) + 86400000).toISOString() }))), 'C', GHRSST);
    if (q.what === 'counts') for (const [param, id] of [['frost_days:d', 'FROST_DAYS'], ['hot_days:d', 'HOT_DAYS'], ['heavy_rain_days:d', 'HEAVY_RAIN_DAYS']]) {
      const rows = datesOf(data, param).filter((x) => valid(x.value));
      const s = { years: rows.map((x) => new Date(x.date).getUTCFullYear()), values: rows.map((x) => x.value) };
      if (s.values.every((v) => v === 0)) { console.log(`${p.id} ${id}: always 0 here, skipped`); continue; }
      put(out.extra[p.id], id, s, 'days', ERA5);
    }
    writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n'); // save after each request, so a failure loses nothing
  }
}
