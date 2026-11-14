// Downloads precomputed data from the Meteomatics API for every catalog place and saves ONLY annual values
// to data/witnesses.json. Credentials stay in app/.env, which Git ignores.
//
//   witnesses (second, independent source for a NASA POWER variable):
//     T2M          ERA5 daily mean air temperature (ecmwf-era5)
//     PRECTOTCORR  CHIRPS v3 rain, satellite + rain gauges (chc-chirps3); ERA5 where CHIRPS has no coverage
//   extra variables (no NASA POWER counterpart; labeled with their own source in the app):
//     SST          ERA5 sea surface temperature, ocean and coast places (GHRSST, CMEMS and HYCOM here start 2014-2022)
//     FROST_DAYS, HOT_DAYS, HEAVY_RAIN_DAYS   counted here from ERA5 daily min, max and rain (ERA5 has no ready-made counts)
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

const daily = (from, param) => `${from}-01-02T00:00:00Z--${LAST + 1}-01-01T00:00:00Z:P1D/${param}`;

const ERA5 = 'ERA5 (ECMWF / Copernicus) via Meteomatics API';
const CHIRPS = 'CHIRPS v3 rain, satellite + gauges (Climate Hazards Center, UCSB) via Meteomatics API';
export const EXTRA_VARIABLES = [
  { id: 'SST', name: 'Sea surface temperature', group: 'Heat', units: 'C', source: ERA5,
    definition: 'How warm the top of the ocean is.' },
  { id: 'FROST_DAYS', name: 'Frost days', group: 'Heat', units: 'days', source: ERA5,
    definition: 'Days in the year whose lowest temperature fell below 0 °C.' },
  { id: 'HOT_DAYS', name: 'Hot days', group: 'Heat', units: 'days', source: ERA5,
    definition: 'Days in the year whose highest temperature rose above 30 °C.' },
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
  // Sea temperature is a midnight snapshot each day (there is no 24 h mean for it).
  const era5 = `t_mean_2m_24h:C,t_min_2m_24h:C,t_max_2m_24h:C,precip_24h:mm${hasSea(p) ? ',t_sea_sfc:C' : ''}`;
  const list = [{ what: 'era5', path: daily(FIRST, era5), model: 'ecmwf-era5' }];
  if (chirpsCovers(p)) list.push({ what: 'chirps', path: daily(FIRST, 'precip_24h:mm'), model: 'chc-chirps3' });
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
  await show('2. ERA5 daily min and max, and sea temperature (Pacific)', async () => {
    const d = await query(auth, '1981-07-02T00:00:00Z/t_min_2m_24h:C,t_max_2m_24h:C,t_sea_sfc:C', pacific, 'ecmwf-era5');
    return d.map((x) => [x.parameter, x.coordinates[0].dates[0].value]);
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
      const d = (param) => datesOf(data, param);
      put(out.series[p.id], 'T2M', annualFromDaily(d('t_mean_2m_24h:C')), 'C', ERA5);
      if (!chirpsCovers(p)) put(out.series[p.id], 'PRECTOTCORR', annualFromDaily(d('precip_24h:mm')), 'mm/day', ERA5);
      for (const [id, param, test] of [['FROST_DAYS', 't_min_2m_24h:C', (v) => v < 0], ['HOT_DAYS', 't_max_2m_24h:C', (v) => v > 30],
        ['HEAVY_RAIN_DAYS', 'precip_24h:mm', (v) => v > 10]]) {
        const s = annualFromDaily(d(param), test);
        if (s.values.every((v) => v === s.values[0])) { console.log(`${p.id} ${id}: always ${s.values[0]} days a year here, skipped`); continue; }
        put(out.extra[p.id], id, s, 'days', ERA5);
      }
      if (hasSea(p)) put(out.extra[p.id], 'SST', annualFromDaily(d('t_sea_sfc:C')), 'C', ERA5);
    }
    if (q.what === 'chirps') put(out.series[p.id], 'PRECTOTCORR', annualFromDaily(datesOf(data, 'precip_24h:mm')), 'mm/day', CHIRPS);
    writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n'); // save after each request, so a failure loses nothing
  }
}
