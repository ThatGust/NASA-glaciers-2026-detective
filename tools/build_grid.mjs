// Builds the global trend grid: every catalog variable at the center of every STEP° x STEP° cell, from NASA POWER,
// plus area-weighted regional series (global, land, ocean, latitude bands). Output: data/grid.json.
//
// Usage (from app/):  node tools/build_grid.mjs [--step 5] [--limit 20]
// Responses are cached in tools/.cache/grid/, so an interrupted run resumes where it stopped.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { analyze, annualSeriesFromPower, areaWeightedMean, benjaminiHochberg } from '../engine.js';

const here = (p) => new URL(p, import.meta.url);
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? +args[args.indexOf(k) + 1] : d);
const STEP = opt('--step', 5), LIMIT = opt('--limit', Infinity), CONCURRENCY = 4;
const END = new Date().getUTCFullYear() - 1;
const MIN_YEARS = 8;

const catalog = JSON.parse(readFileSync(here('../data/catalog.json'), 'utf8'));
const VARS = catalog.variables;
const groups = Object.values(Object.groupBy(VARS, (v) => v.start ?? 1981)); // one request per product start year
const cacheDir = here('./.cache/grid/');
mkdirSync(cacheDir, { recursive: true });

const cells = [];
for (let lat = -90 + STEP / 2; lat < 90; lat += STEP)
  for (let lon = -180 + STEP / 2; lon < 180; lon += STEP) cells.push({ lat, lon });
const todo = cells.slice(0, LIMIT);

async function getJson(url, file) {
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url);
    if (r.ok) { const j = await r.json(); writeFileSync(file, JSON.stringify(j)); return j; }
    if (r.status !== 429 && r.status < 500) throw new Error(`${r.status} ${url}`);
    await new Promise((res) => setTimeout(res, 2000 * 2 ** attempt));
  }
  throw new Error(`gave up: ${url}`);
}

async function cellSeries({ lat, lon }) {
  const out = {};
  for (const g of groups) {
    const start = g[0].start ?? 1981;
    const ids = g.map((v) => v.id).join(',');
    const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${ids}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${END}&format=JSON`;
    const json = await getJson(url, new URL(`${lat}_${lon}_${start}.json`, cacheDir));
    Object.assign(out, annualSeriesFromPower(json, g.map((v) => ({ id: v.id, start }))));
    out._elevation ??= json.geometry?.coordinates?.[2];
  }
  return out;
}

// Run with a small worker pool.
const results = new Array(todo.length);
let next = 0, done = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < todo.length) {
    const i = next++;
    try { results[i] = await cellSeries(todo[i]); } catch (e) { console.error(`cell ${todo[i].lat},${todo[i].lon}: ${e.message}`); results[i] = {}; }
    if (++done % 25 === 0 || done === todo.length) console.log(`${done}/${todo.length} cells, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}));

// Ocean mask: POWER reports elevation exactly 0 over the ocean (land and ice sheets are above 0).
const ocean = results.map((s) => s._elevation === 0);
const usable = (s) => s && s.years.length >= MIN_YEARS && Math.max(...s.values) - Math.min(...s.values) > 1e-9;

// Per-cell trends, with Benjamini-Hochberg across the cells of each variable (many cells = many tests).
const trends = {};
for (const v of VARS) {
  const r = results.map((s, i) => (usable(s[v.id]) && !(v.land_only && ocean[i]) ? analyze(s[v.id]) : null));
  const idx = r.flatMap((x, i) => (x && Number.isFinite(x.p) ? [i] : []));
  const q = benjaminiHochberg(idx.map((i) => r[i].p));
  const verdict = (x) => (x < 0.05 ? 'confirmed' : x < 0.1 ? 'likely' : 'unknown');
  trends[v.id] = r.map(() => null);
  idx.forEach((i, k) => { trends[v.id][i] = [+r[i].slopePerDecade.toPrecision(4), +q[k].toPrecision(3), verdict(q[k])]; });
}

// Regional series: cos(latitude)-weighted mean over the cells that have every year of the variable's record.
const REGIONS = [
  ['global', 'the whole planet', () => true],
  ['land', 'all land areas', (c, i) => !ocean[i]],
  ['ocean', 'all oceans', (c, i) => ocean[i]],
  ['tropics', 'the tropics (23.5°S–23.5°N)', (c) => Math.abs(c.lat) < 23.5],
  ['north-mid', 'the northern mid-latitudes (23.5°N–66.5°N)', (c) => c.lat >= 23.5 && c.lat < 66.5],
  ['south-mid', 'the southern mid-latitudes (23.5°S–66.5°S)', (c) => c.lat <= -23.5 && c.lat > -66.5],
  ['arctic', 'the Arctic (north of 66.5°N)', (c) => c.lat >= 66.5],
  ['antarctic', 'the Antarctic (south of 66.5°S)', (c) => c.lat <= -66.5],
];
const regions = {};
for (const [id, name, inRegion] of REGIONS) {
  regions[id] = { name, series: {} };
  for (const v of VARS) {
    const members = todo.map((c, i) => i).filter((i) => inRegion(todo[i], i) && usable(results[i][v.id]) && !(v.land_only && ocean[i]));
    if (!members.length) continue;
    const m = areaWeightedMean(members.map((i) => results[i][v.id]), members.map((i) => todo[i].lat));
    regions[id].series[v.id] = { ...m, units: results[members[0]][v.id].units };
  }
}

writeFileSync(here('../data/grid.json'), JSON.stringify({
  generated: new Date().toISOString().slice(0, 10), step: STEP, end: END,
  source: 'NASA POWER monthly point API (MERRA-2, CERES SYN1deg), value at each cell center',
  note: 'Cell values are NASA POWER at the cell center, not a cell average. Cell verdicts use Benjamini-Hochberg across cells.',
  cells: todo.map((c, i) => [c.lat, c.lon, ocean[i] ? 1 : 0]), trends, regions,
}));
console.log(`Saved data/grid.json: ${todo.length} cells, ${Object.keys(regions).length} regions.`);
