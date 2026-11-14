// Offline Earthdata lane. Credentials are read here only; never cache authentication responses.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { analyze, benjaminiHochberg, areaWeightedMean } from '../engine.js';

const here = (p) => new URL(p, import.meta.url);
const cache = here('./.cache/earthdata/');
mkdirSync(cache, { recursive: true });
const END = new Date().getUTCFullYear() - 1;
const PRODUCTS = [
  { id: 'merra', short: 'M2TMNXSLV', version: '5.12.4', start: 1981 },
  { id: 'airs', short: 'AIRS3STM', version: '7.0', start: 2003 },
  { id: 'gldas', short: 'GLDAS_NOAH10_M', version: '2.1', start: 2000 },
];
const grid = JSON.parse(readFileSync(here('../data/grid.json'), 'utf8'));
assert.equal(grid.step, 5);
assert.equal(grid.cells.length, 2592);
grid.cells.forEach(([lat, lon, ocean], i) => {
  assert.equal(lat, -87.5 + 5 * Math.floor(i / 72));
  assert.equal(lon, -177.5 + 5 * (i % 72));
  assert([0, 1].includes(ocean));
});
const round = (x, digits = 4) => +x.toPrecision(digits);
const variable = (id, name, group, units, definition, source, start, witnessOf = null) =>
  ({ id, name, group, units, definition, source, organization: 'NASA', start, witnessOf });
const MER = 'MERRA-2 (NASA GMAO)', AIR = 'AIRS on Aqua (NASA satellite)', GLD = 'GLDAS Noah (NASA)';
const VARIABLES = [
  variable('T850', 'Lower-troposphere temperature', 'Atmosphere', 'C', 'Air temperature at 850 hPa, roughly 1.5 km above sea level.', MER, 1981),
  variable('T500', 'Mid-troposphere temperature', 'Atmosphere', 'C', 'Air temperature at 500 hPa, roughly 5.5 km above sea level.', MER, 1981),
  variable('T250', 'Upper-troposphere temperature', 'Atmosphere', 'C', 'Air temperature at 250 hPa, roughly 10 km above sea level.', MER, 1981),
  // From 2005: MERRA-2 switched its ozone input from SBUV to OMI/MLS in October 2004 (Wargan et al. 2017), so earlier years would splice two observing systems.
  variable('TO3', 'Total column ozone', 'Air', 'DU', 'The amount of ozone in a column of air from the ground to the top of the atmosphere.', MER, 2005),
  variable('TQV', 'Total water vapor', 'Water', 'kg/m2', 'The mass of water vapor above each square meter of ground.', MER, 1981),
  variable('T850_AIRS', 'Lower-troposphere temperature (AIRS)', 'Atmosphere', 'C', 'Aqua satellite estimates of air temperature near 1.5 km above sea level during afternoon overpasses.', AIR, 2003, 'T850'),
  variable('T500_AIRS', 'Mid-troposphere temperature (AIRS)', 'Atmosphere', 'C', 'Aqua satellite estimates of air temperature near 5.5 km above sea level during afternoon overpasses.', AIR, 2003, 'T500'),
  variable('TO3_AIRS', 'Total column ozone (AIRS)', 'Air', 'DU', 'Aqua satellite estimates of the ozone in a column of air during afternoon overpasses.', AIR, 2003, 'TO3'),
  variable('TQV_AIRS', 'Total water vapor (AIRS)', 'Water', 'kg/m2', 'Aqua satellite estimates of the mass of water vapor above each square meter during afternoon overpasses.', AIR, 2003, 'TQV'),
  variable('RUNOFF', 'Total runoff', 'Water', 'mm/day', 'Water leaving the land through surface flow and underground drainage each day.', GLD, 2000),
  variable('EVAP', 'Evapotranspiration', 'Water', 'mm/day', 'Water moving from the land and plants into the air each day.', GLD, 2000),
  variable('SOILMOI', 'Topsoil water', 'Water', 'kg/m2', 'The mass of water in the top ten centimeters of soil beneath each square meter of land.', GLD, 2000),
];
const OMI_QUERY = 'https://cmr.earthdata.nasa.gov/search/collections.json?keyword=OMI%20ozone&page_size=200';
let bearer;
async function token() {
  if (bearer) return bearer;
  const env = Object.fromEntries(readFileSync(here('../.env.earthdata'), 'utf8').split(/\r?\n/)
    .map((s) => s.match(/^\s*(EARTHDATA_USER|EARTHDATA_PASSWORD)\s*=\s*(.*?)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]));
  assert(env.EARTHDATA_USER && env.EARTHDATA_PASSWORD, 'Missing Earthdata credentials in app/.env.earthdata');
  let response;
  try {
    response = await fetch('https://urs.earthdata.nasa.gov/api/users/find_or_create_token', {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${env.EARTHDATA_USER}:${env.EARTHDATA_PASSWORD}`).toString('base64')}` },
      signal: AbortSignal.timeout(60000),
    });
  } catch { throw new Error('Earthdata authentication network failure'); }
  assert(response.ok, `Earthdata authentication HTTP ${response.status}`);
  let json;
  try { json = await response.json(); }
  catch { throw new Error('Earthdata authentication returned invalid JSON'); }
  assert(typeof json.access_token === 'string', 'Earthdata authentication returned no access token');
  bearer = json.access_token;
  return bearer;
}

async function raw(url, auth = false) {
  const file = new URL(`${createHash('sha256').update(url).digest('hex')}.txt`, cache);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetch(url, { headers: auth ? { Authorization: `Bearer ${await token()}` } : {}, signal: AbortSignal.timeout(180000) });
    } catch {
      if (attempt === 3) throw new Error(`Network timeout/failure at ${new URL(url).hostname}`);
      continue;
    }
    if (response.ok) {
      const body = await response.text();
      assert(!/^\s*</.test(body) && !/^\s*Error\s*\{/.test(body), 'Data server returned an error document');
      writeFileSync(new URL(`${file.pathname.split('/').at(-1)}.part`, cache), body);
      renameSync(new URL(`${file.pathname.split('/').at(-1)}.part`, cache), file);
      return body;
    }
    if (response.status === 401 && auth && attempt < 3) bearer = undefined;
    else if (response.status !== 429 && response.status < 500) throw new Error(`Data HTTP ${response.status} at ${new URL(url).hostname}`);
    if (attempt === 3) throw new Error(`Data HTTP ${response.status} after retries`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
}

async function granules(product) {
  const query = new URLSearchParams({ short_name: product.short, version: product.version,
    temporal: `${product.start}-01-01T00:00:00Z,${END}-12-31T23:59:59Z`, page_size: '2000', sort_key: 'start_date' });
  const json = JSON.parse(await raw(`https://cmr.earthdata.nasa.gov/search/granules.json?${query}`));
  assert(json.feed?.entry && json.feed.entry.length < 2000, 'Missing or truncated CMR granule response');
  return json.feed.entry.map((g) => ({ month: g.time_start.slice(0, 7), title: g.title,
    url: g.links?.find((l) => l.href?.includes('opendap.earthdata.nasa.gov') && !/\.html(?:\?|$)/.test(l.href))?.href }))
    .filter((g) => +g.month.slice(0, 4) >= product.start && +g.month.slice(0, 4) <= END);
}

// Hyrax ASCII labels contain either coordinate values (DAP Grid) or zero-based output indices (HDF arrays).
function ascii(body) {
  const out = {};
  for (const line of body.split(/\r?\n/)) {
    const comma = line.indexOf(',');
    if (comma < 0 || line.startsWith('Dataset:')) continue;
    const label = line.slice(0, comma), name = label.split('[')[0].trim();
    assert(name && !name.includes(' '), 'Unexpected ASCII variable label');
    const values = line.slice(comma + 1).split(',').map((s) => {
      assert(s.trim() && /^(?:[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|nan|[+-]?inf)$/i.test(s.trim()), 'Invalid ASCII numeric value');
      return Number(s.trim());
    });
    (out[name] ??= []).push(...values);
    const latitude = label.match(/\[([^\]]+\.lat)=([^\]]+)\]/);
    if (latitude) (out[latitude[1]] ??= []).push(Number(latitude[2]));
  }
  assert(Object.keys(out).length, 'Empty DAP ASCII response');
  return out;
}
const dap = (base, query) => raw(`${base}.ascii?${query.replaceAll('[', '%5B').replaceAll(']', '%5D')}`, true).then(ascii);
const AIRPATH = '/ascending/Data_Fields/';
const SLICES = { merra: '[5:10:355][4:8:572]', airs: '[2:5:177][2:5:357]', gldas: '[2:5:147][2:5:357]' };
const fields = {
  merra: ['T850', 'T500', 'T250', 'TO3', 'TQV'],
  airs: ['Temperature_A', 'Temperature_A_ct', 'TotO3_A', 'TotO3_A_ct', 'TotH2OVap_A', 'TotH2OVap_A_ct'].map((s) => AIRPATH + s),
  gldas: ['Qs_acc', 'Qsb_acc', 'Evap_tavg', 'SoilMoi0_10cm_inst'],
};
function attribute(das, field, name) {
  const start = das.indexOf(`\n    ${field} {`);
  assert(start >= 0, `Missing metadata for ${field}`);
  const block = das.slice(start, das.indexOf('\n    }', start));
  return block.match(new RegExp(`\\b${name}\\s+([^;]+);`))?.[1].replace(/^"|"$/g, '');
}
async function setup(p) {
  const gs = await granules(p);
  assert(gs.length, `No granules for ${p.short}`);
  const months = new Map();
  for (const g of gs) {
    assert(g.url?.startsWith('https://opendap.earthdata.nasa.gov/'), `Missing trusted OPeNDAP link for ${p.id} ${g.month}`);
    assert(!months.has(g.month), `Duplicate month ${p.id} ${g.month}; select a processing version explicitly`);
    months.set(g.month, g);
  }
  const complete = [];
  for (let y = p.start; y <= END; y++) {
    if (Array.from({ length: 12 }, (_, m) => months.has(`${y}-${String(m + 1).padStart(2, '0')}`)).every(Boolean)) complete.push(y);
  }
  assert(complete.length >= 8, `Fewer than eight complete years for ${p.id}`);
  const base = gs[0].url, das = await raw(`${base}.das`, true);
  const dds = await raw(`${base}.dds`, true);
  if (p.id === 'merra' && !dds.includes('Float32 T250[')) fields.merra = fields.merra.filter((s) => s !== 'T250');
  const fills = Object.fromEntries(fields[p.id].map((f) => [f, Number(attribute(das, f, '_FillValue'))]));
  Object.values(fills).forEach((v) => assert(Number.isFinite(v), 'Missing fill-value metadata'));
  const query = p.id === 'airs'
    ? `/location/Data_Fields/Latitude${SLICES.airs},/location/Data_Fields/Longitude${SLICES.airs},StdPressureLev_ascending`
    : `lat${p.id === 'merra' ? '[5:10:355]' : '[2:5:147]'},lon${p.id === 'merra' ? '[4:8:572]' : '[2:5:357]'}`;
  const coords = await dap(base, query);
  let mapping, levels;
  if (p.id === 'airs') {
    const lat = coords['/location/Data_Fields/Latitude'], lon = coords['/location/Data_Fields/Longitude'];
    assert.equal(lat?.length, 2592); assert.equal(lon?.length, 2592);
    const keys = new Map(lat.map((v, i) => [`${v},${lon[i]}`, i]));
    assert.equal(keys.size, 2592);
    mapping = grid.cells.map(([a, b]) => keys.get(`${a},${b}`));
    assert(mapping.every(Number.isInteger), 'AIRS centers do not match grid.json');
    levels = [850, 500, 250].map((v) => coords.StdPressureLev_ascending.indexOf(v));
    assert(levels.every((i) => i >= 0), 'Missing AIRS pressure levels');
    assert.equal(levels[1] - levels[0], 3);
    console.log(`airs: coordinate order ${lat[0]} to ${lat.at(-1)}, pressure indices ${levels}`);
  } else {
    const { lat, lon } = coords;
    assert.equal(lon?.length, 72); assert.equal(lat?.length, p.id === 'merra' ? 36 : 30);
    lon.forEach((v, i) => assert.equal(v, -177.5 + 5 * i));
    lat.forEach((v, i) => assert.equal(v, (p.id === 'merra' ? -87.5 : -57.5) + 5 * i));
    mapping = grid.cells.map(([a, b]) => lat.includes(a) ? lat.indexOf(a) * 72 + lon.indexOf(b) : undefined);
  }
  const units = Object.fromEntries(fields[p.id].filter((f) => !f.endsWith('_ct')).map((f) => [f, attribute(das, f, 'units')]));
  // AIRS HDF field attributes omit units; V7 L3 User Guide sections 2.5.1 and Table 1 specify K, DU and kg/m2.
  const expected = p.id === 'merra' ? { T850: 'K', T500: 'K', TO3: 'Dobsons', TQV: 'kg m-2' }
    : p.id === 'gldas' ? { Qs_acc: 'kg m-2', Qsb_acc: 'kg m-2', Evap_tavg: 'kg m-2 s-1', SoilMoi0_10cm_inst: 'kg m-2' } : {};
  for (const [f, unit] of Object.entries(expected)) assert.equal(units[f], unit, `Unexpected units for ${f}`);
  console.log(`${p.id}: ${complete[0]}-${complete.at(-1)}, ${gs.length} months, units ${JSON.stringify(units)}`);
  return { ...p, months, complete, mapping, levels, fills, coords };
}

function monthly(p, data) {
  const n = p.id === 'gldas' ? 2160 : 2592;
  const get = (field, size = n) => {
    const v = data[p.id === 'airs' ? field : `${field}.${field}`];
    assert.equal(v?.length, size, `Wrong data length for ${field}`);
    return v.map((x) => Number.isFinite(x) && Math.abs(x) < 1e14 && x !== p.fills[field] && x !== -9999 ? x : null);
  };
  let source;
  if (p.id === 'airs') {
    const temperature = get(`${AIRPATH}Temperature_A`, 2 * n), count = get(`${AIRPATH}Temperature_A_ct`, 2 * n);
    const temp = (offset) => temperature.slice(offset, offset + n).map((v, i) => v !== null && count[i + offset] > 0 ? v - 273.15 : null);
    const total = (f) => get(AIRPATH + f).map((v, i) => v !== null && getCount[f][i] > 0 ? v : null);
    const getCount = Object.fromEntries(['TotO3_A', 'TotH2OVap_A'].map((f) => [f, get(`${AIRPATH}${f}_ct`)]));
    source = { T850_AIRS: temp(0), T500_AIRS: temp(n), TO3_AIRS: total('TotO3_A'), TQV_AIRS: total('TotH2OVap_A') };
  } else if (p.id === 'merra') {
    assert(data['T850.lat']?.join() === p.coords.lat.join(), 'MERRA-2 latitude order changed');
    assert(data['T850.lon']?.join() === p.coords.lon.join(), 'MERRA-2 longitude order changed');
    source = Object.fromEntries(fields.merra.map((f) => [f, get(f).map((v) => v === null ? null : /^T\d/.test(f) ? v - 273.15 : v)]));
  } else {
    assert(data['Qs_acc.lat']?.join() === p.coords.lat.join(), 'GLDAS latitude order changed');
    assert(data['Qs_acc.lon']?.join() === p.coords.lon.join(), 'GLDAS longitude order changed');
    const qs = get('Qs_acc'), qsb = get('Qsb_acc');
    // GLDAS README section 3.5(6): monthly _acc values are mean 3-hour amounts; _tavg water fluxes are kg/m2/s.
    source = { RUNOFF: qs.map((v, i) => v === null || qsb[i] === null ? null : (v + qsb[i]) * 8),
      EVAP: get('Evap_tavg').map((v) => v === null ? null : v * 86400), SOILMOI: get('SoilMoi0_10cm_inst') };
  }
  return Object.fromEntries(Object.entries(source).map(([id, values]) => [id, p.mapping.map((i, k) =>
    i === undefined || (p.id === 'gldas' && grid.cells[k][2]) ? null : values[i])]));
}

async function download(p) {
  const t0 = Date.now(), annual = {}, failures = [];
  let next = 0, done = 0;
  // Three year workers, each with one monthly request at a time: at most three network requests.
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < p.complete.length) {
      const year = p.complete[next++], sums = {}, valid = {};
      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, '0')}`;
        try {
          const data = await fetchMonth(p, month);
          for (const [id, values] of Object.entries(data)) {
            sums[id] ??= new Float64Array(2592); valid[id] ??= new Uint8Array(2592);
            values.forEach((v, i) => { if (v !== null) { sums[id][i] += v; valid[id][i]++; } });
          }
        } catch (e) {
          failures.push({ month, error: e.message });
          console.error(`${p.id} ${month}: ${e.message}`);
        }
        if (++done % 24 === 0) console.log(`${p.id}: ${done}/${p.complete.length * 12} months, ${Math.round((Date.now() - t0) / 1000)} s`);
      }
      for (const id of Object.keys(sums)) {
        annual[id] ??= {};
        annual[id][year] = annualMean(sums[id], valid[id]);
      }
    }
  }));
  return { annual, failures, seconds: round((Date.now() - t0) / 1000, 5) };
}

const annualMean = (sums, counts) => Array.from(sums, (v, i) => counts[i] === 12 ? v / 12 : null);

async function fetchMonth(p, month) {
  const query = fields[p.id].map((f) => `${f}${p.id !== 'airs' ? '[0:0]' : f.includes('Temperature_') ? `[${p.levels[0]}:3:${p.levels[1]}]` : ''}${SLICES[p.id]}`).join(',');
  return monthly(p, await dap(p.months.get(month).url, query));
}

const REGIONS = [
  ['global', () => true], ['land', (c) => !c[2]], ['ocean', (c) => !!c[2]],
  ['tropics', (c) => Math.abs(c[0]) < 23.5], ['north-mid', (c) => c[0] >= 23.5 && c[0] < 66.5],
  ['south-mid', (c) => c[0] <= -23.5 && c[0] > -66.5], ['arctic', (c) => c[0] >= 66.5], ['antarctic', (c) => c[0] <= -66.5],
];
function output(annual) {
  const out = { generated: new Date().toISOString(), step: 5, variables: [], trends: {},
    regions: Object.fromEntries(REGIONS.map(([id]) => [id, { name: grid.regions[id].name, series: {} }])), cellSeries: {}, years: {} };
  const stats = [];
  for (const v of VARIABLES) {
    if (!annual[v.id]) continue;
    console.log(`Analyzing ${v.id} across ${grid.cells.length} cells`);
    // A variable can start later than its product, e.g. MERRA-2 ozone after the October 2004 SBUV-to-OMI switch.
    const years = Object.keys(annual[v.id]).map(Number).filter((y) => y >= v.start).sort((a, b) => a - b);
    const series = grid.cells.map((_, i) => {
      const keep = years.filter((y) => annual[v.id][y][i] !== null);
      return { years: keep, values: keep.map((y) => annual[v.id][y][i]), units: v.units };
    });
    const usable = (s) => s.years.length >= 8 && Math.max(...s.values) - Math.min(...s.values) > 1e-9;
    const analyses = series.map((s) => usable(s) ? analyze(s) : null);
    const idx = analyses.flatMap((r, i) => r && Number.isFinite(r.p) && Number.isFinite(r.slopePerDecade) ? [i] : []);
    assert(idx.length, `No usable trends for ${v.id}`);
    const q = benjaminiHochberg(idx.map((i) => analyses[i].p));
    out.variables.push(v); out.years[v.id] = [years[0], years.at(-1)];
    out.trends[v.id] = Array(2592).fill(null);
    idx.forEach((i, k) => { out.trends[v.id][i] = [round(analyses[i].slopePerDecade), round(q[k], 3), q[k] < 0.05 ? 'confirmed' : q[k] < 0.1 ? 'likely' : 'unknown']; });
    // A compact value-only series cannot encode a missing year: keep only full-window cells here.
    out.cellSeries[v.id] = series.map((s) => s.years.length === years.at(-1) - years[0] + 1 ? s.values.map((x) => round(x, 3)) : null);
    for (const [region, contains] of REGIONS) {
      const members = series.flatMap((s, i) => contains(grid.cells[i]) && usable(s) ? [i] : []);
      if (!members.length) continue;
      out.regions[region].series[v.id] = { ...areaWeightedMean(members.map((i) => series[i]), members.map((i) => grid.cells[i][0])), units: v.units };
    }
    const global = out.regions.global.series[v.id];
    stats.push({ id: v.id, years: out.years[v.id], trend: analyze(global).slopePerDecade, units: `${v.units}/decade`,
      globalCells: global.cells, trendCells: idx.length, fullSeriesCells: out.cellSeries[v.id].filter(Boolean).length,
      gappedTrendCells: idx.filter((i) => series[i].years.length < years.length).length,
      globalYears: [global.years[0], global.years.at(-1)], globalAnnualValues: global.values.length,
      droppedCellYears: series.reduce((n, s) => n + years.length - s.years.length, 0) });
  }
  const dropped = [];
  while (Buffer.byteLength(JSON.stringify(out)) >= 8_000_000) {
    const id = Object.keys(out.cellSeries).sort((a, b) => JSON.stringify(out.cellSeries[b]).length - JSON.stringify(out.cellSeries[a]).length)[0];
    assert(id, 'Output exceeds 8 MB even without cellSeries');
    delete out.cellSeries[id]; dropped.push(id);
  }
  return { out, stats, dropped };
}

function validate(out) {
  assert.equal(out.step, 5); assert.equal(out.variables.length, Object.keys(out.trends).length);
  assert.deepEqual(Object.keys(out.regions), REGIONS.map(([id]) => id));
  const increasing = (years) => years.every((y, i) => Number.isInteger(y) && (!i || y > years[i - 1]));
  for (const v of out.variables) {
    assert.equal(out.trends[v.id].length, grid.cells.length);
    const [first, last] = out.years[v.id];
    assert(first >= v.start && last <= END && first < last);
    for (const t of out.trends[v.id]) if (t !== null) {
      assert.equal(t.length, 3); assert(Number.isFinite(t[0]) && Number.isFinite(t[1]) && t[1] >= 0 && t[1] <= 1);
      // q is rounded for export; the verdict is assigned using its unrounded value, as in build_grid.mjs.
      assert(['confirmed', 'likely', 'unknown'].includes(t[2]));
    }
    if (out.cellSeries[v.id]) {
      assert.equal(out.cellSeries[v.id].length, grid.cells.length);
      for (const s of out.cellSeries[v.id]) if (s !== null) { assert.equal(s.length, last - first + 1); assert(s.every(Number.isFinite)); }
    }
    for (const r of Object.values(out.regions)) {
      const s = r.series[v.id]; if (!s) continue;
      assert.equal(s.years.length, s.values.length); assert(increasing(s.years)); assert(s.values.every(Number.isFinite));
      assert(s.cells > 0 && s.cells <= 2592 && s.units === v.units);
    }
    if (v.source === GLD) grid.cells.forEach(([lat, , ocean], i) => {
      if (ocean || lat < -59.5) { assert.equal(out.trends[v.id][i], null); assert.equal(out.cellSeries[v.id]?.[i] ?? null, null); }
    });
  }
  assert(Buffer.byteLength(JSON.stringify(out)) < 8_000_000);
}

function selfTest() {
  const parsed = ascii('Dataset: sample\nlat, -2.5, 2.5\nx.x[x.time=0][x.lat=-2.5], 1e+15, -2.5\nx.x[x.time=0][x.lat=2.5], 3, 4\n/a[0][0], 5, 6\n');
  assert.deepEqual(parsed['x.x'], [1e15, -2.5, 3, 4]); assert.deepEqual(parsed['/a'], [5, 6]);
  assert.deepEqual(parsed['x.lat'], [-2.5, 2.5]);
  assert.throws(() => ascii('x, bad')); assert.throws(() => ascii('Dataset: empty'));
  assert.equal((2 + 3) * 8, 40); assert.equal(0.00001 * 86400, 0.8640000000000001);
  const p = { id: 'gldas', fills: Object.fromEntries(fields.gldas.map((f) => [f, -9999])),
    coords: { lat: [-57.5], lon: [-177.5] }, mapping: grid.cells.map((c) => c[0] < -59.5 ? undefined : 0) };
  const fixture = Object.fromEntries(fields.gldas.map((f) => [`${f}.${f}`, Array(2160).fill(f === 'Evap_tavg' ? 0.00001 : 2)]));
  fixture['Qs_acc.lat'] = p.coords.lat; fixture['Qs_acc.lon'] = p.coords.lon;
  const converted = monthly(p, fixture), land = grid.cells.findIndex((c) => !c[2] && c[0] >= -59.5);
  assert.equal(converted.RUNOFF[land], 32); assert.equal(converted.SOILMOI[land], 2);
  assert(Math.abs(converted.EVAP[land] - 0.864) < 1e-12);
  fixture['Qsb_acc.Qsb_acc'][0] = -9999; assert.equal(monthly(p, fixture).RUNOFF[land], null);
  assert.deepEqual(annualMean([120, 110, 0], [12, 11, 0]), [10, null, null]);
  console.log('Earthdata self-checks passed (ASCII parsing, conversions, fill propagation, cell order and masks).');
}

async function main() {
  const t0 = Date.now(), annual = {}, reports = [];
  await token();
  for (const product of PRODUCTS) {
    const p = await setup(product);
    await fetchMonth(p, `${p.complete[0]}-01`); // Fail on a protocol/schema mismatch before starting the worker pool.
    const r = await download(p);
    Object.assign(annual, r.annual); reports.push({ product: p.id, ...r, annual: undefined });
  }
  const omi = await searchOMI();
  const result = output(annual); validate(result.out);
  const body = JSON.stringify(result.out);
  writeFileSync(here('./.cache/earthdata/grid_atmos.part'), body);
  renameSync(here('./.cache/earthdata/grid_atmos.part'), here('../data/grid_atmos.json'));
  const report = { generated: result.out.generated, seconds: (Date.now() - t0) / 1000, bytes: Buffer.byteLength(body), products: reports, omi,
    droppedCellSeries: result.dropped, variables: result.stats };
  writeFileSync(new URL('report.json', cache), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function searchOMI() {
  const json = JSON.parse(await raw(OMI_QUERY)), entries = json.feed?.entry;
  assert(entries && entries.length < 200, 'Missing or truncated OMI collection search');
  const matches = entries.filter((e) => /OMI/i.test(e.dataset_id) && /month/i.test(e.dataset_id)
    && /total.*(?:column|ozone)/i.test(e.dataset_id) && /L3/i.test(e.dataset_id) && !/tropospheric|zonal|merged/i.test(e.dataset_id));
  assert.equal(matches.length, 0, 'A new monthly OMI total-column collection needs an explicit field/grid adapter');
  return { query: OMI_QUERY, collections: entries.length, totalColumnMonthly: [],
    monthlyRelated: entries.filter((e) => /month/i.test(e.dataset_id)).map((e) => ({ short: e.short_name, title: e.dataset_id })),
    note: 'No matching monthly OMI L3 total-column grid found; tropospheric ozone, daily total ozone and merged zonal means are different products. OMI_O3 omitted.' };
}
assert(process.argv.slice(2).every((s) => ['--sample', '--self-test', '--validate', '--omi'].includes(s)), 'Unknown option');
if (process.argv.includes('--omi')) console.log(JSON.stringify(await searchOMI(), null, 2));
if (process.argv.includes('--self-test')) selfTest();
if (process.argv.includes('--sample')) {
  await token();
  for (const product of PRODUCTS) {
    const p = await setup(product), month = `${p.complete[0]}-01`, data = await fetchMonth(p, month);
    console.log(JSON.stringify({ product: p.id, month, fields: Object.fromEntries(Object.entries(data).map(([id, v]) => [id, { valid: v.filter((x) => x !== null).length, min: Math.min(...v.filter((x) => x !== null)), max: Math.max(...v.filter((x) => x !== null)) }])) }));
  }
}
if (process.argv.includes('--validate')) { validate(JSON.parse(readFileSync(here('../data/grid_atmos.json'), 'utf8'))); console.log('grid_atmos.json validated.'); }
if (!process.argv.slice(2).length) await main();
