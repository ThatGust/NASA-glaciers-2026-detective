// Downloads an independent second witness (ERA5 reanalysis via the Meteomatics API) for every catalog place,
// and saves ONLY annual means to data/witnesses.json. Credentials stay in app/.env, which Git ignores.
//
// Usage (from app/):
//   node tools/fetch_meteomatics.mjs --dry-run          print the request for Coropuna, no credentials needed
//   node tools/fetch_meteomatics.mjs --only coropuna    one query, to check the account works
//   node tools/fetch_meteomatics.mjs                    all places (one query per place)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { annualFromDaily } from '../engine.js';

const here = (p) => new URL(p, import.meta.url);
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const dryRun = args.includes('--dry-run');
const FIRST = 1981, LAST = new Date().getUTCFullYear() - 1;

// Daily aggregates (24 h is the longest window Meteomatics offers). The value stamped at 00:00 UTC of day d+1 covers day d.
const PARAMS = {
  T2M: { meteomatics: 't_mean_2m_24h:C', units: 'C', daily: 'mean' },
  PRECTOTCORR: { meteomatics: 'precip_24h:mm', units: 'mm/day', daily: 'total' },
};
// Force ERA5: the default "mix" changes models over time, which would splice products and create false trends.
const MODEL = 'ecmwf-era5';
const SOURCE = 'ERA5 (ECMWF / Copernicus) via Meteomatics API';

function credentials() {
  const file = here('../.env');
  if (!existsSync(file)) throw new Error('Missing app/.env. Copy app/.env.example to app/.env and fill in your credentials.');
  const env = Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  if (!env.METEOMATICS_USER || !env.METEOMATICS_PASSWORD) throw new Error('METEOMATICS_USER or METEOMATICS_PASSWORD is empty in app/.env.');
  return 'Basic ' + Buffer.from(`${env.METEOMATICS_USER}:${env.METEOMATICS_PASSWORD}`).toString('base64');
}

const requestUrl = (p) => `https://api.meteomatics.com/${FIRST}-01-02T00:00:00Z--${LAST + 1}-01-01T00:00:00Z:P1D/`
  + `${Object.values(PARAMS).map((x) => x.meteomatics).join(',')}/${p.lat},${p.lon}/json?model=${MODEL}`;


const catalog = JSON.parse(readFileSync(here('../data/catalog.json'), 'utf8'));
const places = catalog.places.filter((p) => !only || p.id === only);
if (!places.length) throw new Error(`No catalog place with id "${only}".`);

if (dryRun) {
  console.log(requestUrl(places.find((p) => p.id === 'coropuna') ?? places[0]));
  process.exit(0);
}

const auth = credentials();
const outFile = here('../data/witnesses.json');
const out = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : { series: {} };
Object.assign(out, {
  generated: new Date().toISOString().slice(0, 10), source: SOURCE, model: MODEL,
  note: 'Annual means of daily ERA5 values at the place coordinate. Meteomatics downscales ERA5, so absolute levels differ from NASA POWER grid cells; compare trends, not levels.',
});

for (const p of places) {
  const r = await fetch(requestUrl(p), { headers: { Authorization: auth } });
  if (!r.ok) { console.error(`${p.id}: Meteomatics answered ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
  const body = await r.json();
  out.series[p.id] = {};
  for (const [id, cfg] of Object.entries(PARAMS)) {
    const block = body.data.find((d) => d.parameter === cfg.meteomatics);
    const s = annualFromDaily(block.coordinates[0].dates);
    out.series[p.id][id] = { ...s, units: cfg.units, source: SOURCE, variable: id };
    console.log(`${p.id} ${id}: ${s.years.length} complete years (${s.years[0]}–${s.years.at(-1)})`);
  }
  writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n'); // save after each place, so a failure loses nothing
}
