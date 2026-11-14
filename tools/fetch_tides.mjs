import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { lunarTest } from '../engine.js';

const root = new URL('../', import.meta.url);
const cache = new URL('./.cache/tides/', import.meta.url);
const output = new URL('data/tides.json', root);
const reportFile = new URL('lunar_results.json', cache);
const stationIds = ['8443970', '8518750', '9414290', '1612340', '9447130', '8724580', '8418150', '8574680'];
const lastYear = new Date().getUTCFullYear() - 1;
const seed = 20261114, placebos = 999;
const docs = 'https://api.tidesandcurrents.noaa.gov/api/prod/';
const termsUrl = 'https://tidesandcurrents.noaa.gov/disclaimers.html';
const peng = 'https://doi.org/10.1029/2018JC014695';
const usgs = 'https://www.usgs.gov/publications/nodal-tidal-cycle-186-yr-its-importance-sea-level-curves-east-coast-united-states-and';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = value => createHash('sha256').update(value).digest('hex');
let lastRequest = 0;

function dataUrl(id) {
  return 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?' + new URLSearchParams({
    product: 'monthly_mean', station: id, begin_date: '18500101', end_date: `${lastYear}1231`,
    datum: 'STND', units: 'metric', time_zone: 'gmt', format: 'json', application: 'SignalOrNoise_PositiveControl',
  });
}
const cacheFile = url => new URL(hash(url) + '.json', cache);
async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function saveJson(file, data) {
  const staging = new URL(hash(file.href) + '.pending', cache);
  await writeFile(staging, JSON.stringify(data, null, 2) + '\n');
  await rename(staging, file);
}

async function getJson(url) {
  const file = cacheFile(url);
  try {
    const cached = await readJson(file);
    if (cached.status === 200 && !cached.body.error) return cached;
  } catch (e) { if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
  for (let attempt = 0; attempt < 4; attempt++) {
    await pause(Math.max(0, 1100 - (Date.now() - lastRequest)));
    lastRequest = Date.now();
    let delay = 2000 * 2 ** attempt;
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'SignalOrNoise-Tides/1.0 (educational tidal-range positive-control study)' }, signal: AbortSignal.timeout(45000) });
      const retry = response.headers.get('retry-after');
      delay = Math.max(delay, Number(retry) * 1000 || Date.parse(retry) - Date.now() || 0, response.status === 429 ? 15000 : 0);
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { error: { message: text.slice(0, 500) || 'Non-JSON response' } }; }
      const record = { url, retrieved: new Date().toISOString(), status: response.status, body };
      await saveJson(file, record);
      if (!response.ok || body.error) {
        const error = new Error(`NOAA HTTP ${response.status}: ${body.error?.message || response.statusText}`);
        error.permanent = response.status !== 429 && response.status < 500;
        throw error;
      }
      return record;
    } catch (e) {
      if (attempt === 3 || e.permanent) throw e;
      console.warn(`Retry in ${Math.ceil(delay / 1000)}s: ${e.message}`);
      await pause(delay);
    }
  }
}

function number(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) < 9000 ? n : null;
}

export function annualRanges(rows) {
  assert.ok(Array.isArray(rows), 'Missing monthly data array');
  const months = new Map(), seen = new Set();
  let invalid = 0, inferred = 0, mnMismatch = 0;
  for (const row of rows) {
    const year = Number(row.year), month = Number(row.month);
    assert.ok(Number.isInteger(year) && year >= 1850 && year <= lastYear && Number.isInteger(month) && month >= 1 && month <= 12, 'Invalid monthly timestamp');
    const key = `${year}-${month}`;
    assert.ok(!seen.has(key), `Duplicate monthly record ${key}`);
    seen.add(key);
    if (!months.has(year)) months.set(year, new Map());
    const high = number(row.MHW), low = number(row.MLW);
    if (high === null || low === null || high <= low) { invalid++; continue; }
    if (String(row.inferred) === '1') inferred++;
    const mn = number(row.MN);
    if (mn !== null && Math.abs(high - low - mn) > 0.003) mnMismatch++;
    months.get(year).set(month, high - low);
  }
  const years = [...months.keys()].filter(year => months.get(year).size === 12).sort((a, b) => a - b);
  const values = years.map(year => +([...months.get(year).values()].reduce((a, b) => a + b, 0) / 12).toFixed(9));
  const allYears = [...months.keys()].sort((a, b) => a - b);
  const excludedYears = allYears.length ? Array.from({ length: allYears.at(-1) - allYears[0] + 1 }, (_, i) => allYears[0] + i)
    .filter(year => !years.includes(year)).map(year => ({ year, valid_months: months.get(year)?.size || 0 })) : [];
  return { years, values, coverage: { returned_months: rows.length, valid_months: rows.length - invalid,
    invalid_months: invalid, inferred_valid_months: inferred, monthly_MN_mismatches_over_3mm: mnMismatch,
    first_returned_year: allYears[0] ?? null, last_returned_year: allYears.at(-1) ?? null, excluded_years: excludedYears } };
}

function rng(initial) {
  let state = initial >>> 0;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
}

export function longestRun(series) {
  let start = 0, bestStart = 0, bestLength = 0;
  for (let i = 0; i <= series.years.length; i++) {
    if (i === series.years.length || (i > start && series.years[i] !== series.years[i - 1] + 1)) {
      if (i - start > bestLength) { bestStart = start; bestLength = i - start; }
      start = i;
    }
  }
  return { years: series.years.slice(bestStart, bestStart + bestLength), values: series.values.slice(bestStart, bestStart + bestLength) };
}

function test(series) {
  const { index, ...result } = lunarTest(series, { placebos, random: rng(seed) });
  return result;
}

function tidalForm(body) {
  assert.equal(body.units, 'meters', 'Unexpected harmonic amplitude units');
  const amplitudes = Object.fromEntries((body.HarmonicConstituents || []).map(c => [c.name, Number(c.amplitude)]));
  assert.ok(['K1', 'O1', 'M2', 'S2'].every(k => Number.isFinite(amplitudes[k]) && amplitudes[k] >= 0), 'Missing harmonic constituents');
  const factor = (amplitudes.K1 + amplitudes.O1) / (amplitudes.M2 + amplitudes.S2);
  assert.ok(Number.isFinite(factor), 'Invalid form factor');
  return { factor, kind: factor < 0.25 ? 'semidiurnal' : factor < 1.5 ? 'mixed, mainly semidiurnal' : factor < 3 ? 'mixed, mainly diurnal' : 'diurnal',
    expected_sign: factor < 0.9 ? 'negative' : factor >= 1.5 ? 'positive' : 'either (mixed)', amplitudes_m: amplitudes };
}

function excludedText(years) {
  const groups = [];
  for (const row of years) {
    const last = groups.at(-1);
    if (last && last.end + 1 === row.year && last.months === row.valid_months) last.end = row.year;
    else groups.push({ start: row.year, end: row.year, months: row.valid_months });
  }
  return groups.map(g => `${g.start}${g.end === g.start ? '' : '-' + g.end} (${g.months}/12)`).join(', ') || 'none';
}

export async function validate() {
  const data = await readJson(output);
  const report = await readJson(reportFile);
  assert.equal(report.engine_sha256, hash(await readFile(new URL('engine.js', root))), 'Engine changed; rerun the cached analysis');
  assert.equal(report.placebos, placebos); assert.equal(report.seed, seed);
  assert.ok(Number.isFinite(Date.parse(data.generated)), 'Invalid generated timestamp');
  assert.equal(data.terms.license, 'Public domain');
  assert.ok(data.stations.length >= 6 && data.stations.length <= 10, 'Need 6-10 usable stations');
  const seen = new Set();
  for (const station of data.stations) {
    assert.ok(stationIds.includes(station.id) && !seen.has(station.id), 'Unexpected/duplicate station');
    seen.add(station.id);
    assert.equal(station.units, 'm'); assert.equal(station.variable, 'TIDE_RANGE');
    assert.ok(station.name && Number.isFinite(station.lat) && Math.abs(station.lat) <= 90 && Number.isFinite(station.lon) && Math.abs(station.lon) <= 180);
    assert.equal(station.link, `https://tidesandcurrents.noaa.gov/stationhome.html?id=${station.id}`);
    assert.ok(station.years.length >= 80, `${station.id}: fewer than 80 complete years`);
    assert.equal(station.years.length, station.values.length);
    assert.ok(station.years.every((y, i, ys) => Number.isInteger(y) && y <= lastYear && (!i || y > ys[i - 1])));
    assert.ok(station.values.every(v => Number.isFinite(v) && v > 0));
    const raw = (await readJson(cacheFile(dataUrl(station.id)))).body;
    const reproduced = annualRanges(raw.data);
    assert.deepEqual(station.years, reproduced.years, `${station.id}: year reproduction failed`);
    assert.deepEqual(station.values, reproduced.values, `${station.id}: value reproduction failed`);
    assert.equal(station.id, raw.metadata.id);
    assert.equal(station.name, raw.metadata.name);
    assert.equal(station.lat, Number(raw.metadata.lat)); assert.equal(station.lon, Number(raw.metadata.lon));
    const result = report.stations.find(s => s.id === station.id)?.test;
    assert.ok(result && [result.p, result.share, result.swing].every(Number.isFinite), `${station.id}: nonfinite test result`);
    assert.ok(result.p >= 1 / (placebos + 1) && result.p <= 1 && result.share >= 0 && result.share <= 1);
    assert.deepEqual(result, test(station), `${station.id}: fixed-seed lunar result reproduction failed`);
  }
  console.log(`Validated ${data.stations.length} stations and ${data.stations.reduce((n, s) => n + s.years.length, 0)} complete annual means, exactly reproduced from cached NOAA monthly data.`);
}

async function writeReport(report) {
  const fixed = (v, digits = 3) => Number.isFinite(v) ? v.toFixed(digits) : 'unavailable';
  const honolulu = report.stations.find(s => s.id === '1612340');
  const weak = honolulu && honolulu.contiguous.test.p >= 0.05 ? ` Honolulu is not robust to that check (full p=${fixed(honolulu.test.p)}; contiguous p=${fixed(honolulu.contiguous.test.p)}) and should not be promoted as a reliable demonstration.` : '';
  const strong = report.stations.filter(s => ['8443970', '8518750', '8418150'].includes(s.id) && s.test.p < 0.01 && s.contiguous.test.p < 0.01 && s.test.swing < 0).map(s => s.name);
  const magnitudes = report.stations.map(s => 50 * Math.abs(s.test.swing));
  const table = report.stations.map(s => `| [${s.name} (${s.id})](${s.link}) | ${s.first_year}-${s.last_year}; ${s.n} | ${fixed(s.form?.factor, 2)}; ${s.form?.kind || 'unavailable'} | ${fixed(s.test.p)} | ${fixed(100 * s.test.share, 1)}% | ${fixed(100 * s.test.swing, 2)} | ${s.test.verdict} |`).join('\n');
  const gaps = report.stations.map(s => {
    const missing = excludedText(s.coverage.excluded_years);
    const run = s.contiguous;
    return `- **${s.name}:** excluded years: ${missing}. Inferred valid monthly values retained: ${s.coverage.inferred_valid_months}; MN check mismatches >3 mm: ${s.coverage.monthly_MN_mismatches_over_3mm}. Longest contiguous block: ${run.first_year}-${run.last_year} (${run.n} years), p=${fixed(run.test.p)}, swing=${fixed(100 * run.test.swing, 2)} cm.`;
  }).join('\n');
  const signs = report.stations.map(s => {
    const expected = s.form?.expected_sign;
    const check = expected === 'negative' ? s.test.swing < 0 : expected === 'positive' ? s.test.swing > 0 : null;
    return `- **${s.name}:** expected ${expected || 'unclassified'}; observed ${s.test.swing < 0 ? 'negative' : 'positive'}${check === null ? '' : check ? ' (agrees)' : ' (does not agree)'}. Signed peak-to-peak swing ${fixed(100 * s.test.swing, 2)} cm; absolute half-swing amplitude ${fixed(50 * Math.abs(s.test.swing), 2)} cm; ${fixed(100 * Math.abs(s.test.swing) / s.mean_range_m, 2)}% of mean tidal range.`;
  }).join('\n');
  const failures = report.failures.length ? report.failures.map(f => `- ${f.id}: ${f.error}`).join('\n') : 'No station/API failures.';
  const block = `<!-- tides-control:start -->
## NOAA tidal-range positive control (lane 6B)

Generated ${report.generated}. The eight stations were specified before testing: the six requested stations plus Portland, Maine, and Baltimore. All retained stations have at least 80 complete years. Data: [tides.json](../data/tides.json); full audit, raw request URLs, harmonic constants and machine-readable results: [ignored cache](.cache/tides/lunar_results.json). Source: NOAA CO-OPS, **not NASA**. These are derived research data, not an official NOAA product.

**Outcome:** ${report.stations.filter(s => s.test.p < 0.05).length}/${report.stations.length} full-series results have p<0.05; ${report.stations.filter(s => s.contiguous.test.p < 0.05).length}/${report.stations.length} remain significant on their longest contiguous block.${weak} Strong, correctly phased examples among the preselected East Coast controls: ${strong.join(', ') || 'none established'}.

### Existing engine results

The unedited engine's \`lunarTest\` detrends both annual range and astronomical index, then tests their absolute correlation against AR(1) simulations. Each station uses **999 placebos and LCG seed ${seed}, reset per station**; minimum attainable p is 0.001. Share is squared detrended correlation, not a causal fraction. Signed swing is \`2 * amplitude\`, the fitted change from index -1 to +1 (minor to major standstill), **not** an unsigned amplitude. P values are per-station and unadjusted. Engine SHA-256: \`${report.engine_sha256}\`.

| Station | Complete years; N | Form factor F; regime | p | Share | Signed swing (cm) | Verdict |
|---|---|---|---|---|---|---|
${table}

### Phase and magnitude check

The proposed semidiurnal sign was reversed. [Kaye and Stuckey (1973), USGS abstract](${usgs}) places Boston/East Coast range maxima near node longitude 180 degrees and minima near 0 degrees. With this engine's cosine index, **semidiurnal-dominated range should generally have negative swing: larger near minor standstill**, not major standstill. [Peng et al. (2019), section 3.3 and Figures 12-14](${peng}) likewise associates semidiurnal maxima with 2015 and diurnal maxima with 2006; intermediate mixed regimes can vary. F=(K1+O1)/(M2+S2), from [NOAA harmonic constants](https://api.tidesandcurrents.noaa.gov/mdapi/prod/); F<0.9 is used for a clear negative-phase expectation, F>=1.5 for positive, and 0.9<=F<1.5 remains mixed/ambiguous.

${signs}

Observed absolute half-swing amplitudes span **${fixed(Math.min(...magnitudes), 2)}-${fixed(Math.max(...magnitudes), 2)} cm**: centimetre-scale modulation, with larger signed peak-to-peak changes because swing is twice amplitude. This agrees in order of magnitude with published nodal effects. Peng's few-centimetre amplitudes and up-to-30-cm modulation concern **high-water levels**, not MHW-minus-MLW tidal range; neither that upper value nor a few centimetres is a universal expected size for this different observable. These results are an observational positive-control check, not a station-by-station replication of Peng's freely phased, filtered monthly method or proof of lunar effects on other variables. No station, sign, record window, seed or astronomical phase was selected to obtain significance.

### Data completeness and limitations

[NOAA Data API](${docs}): \`product=monthly_mean\`, \`datum=STND\`, \`units=metric\`, \`time_zone=gmt\`, requested 1850-01-01 through ${lastYear}-12-31 (within the 200-year limit). NOAA states the time-zone parameter does not apply to monthly means; these remain its published calendar months. Annual values are equal-weight means of all 12 valid monthly (MHW-MLW) differences, rounded to 1e-9 m. Blank/fill/nonfinite values are missing, duplicate months are errors, and an incomplete year is omitted without interpolation. NOAA-marked inferred monthly values are retained and counted below. A common additive datum offset cancels in MHW-MLW; this does not remove gauge relocation or tidal-regime changes.

${gaps}

The existing AR(1) simulation treats adjacent retained entries as equally spaced even across missing years; primary gap-spanning p values have that limitation. The separate longest-contiguous-block checks above avoid it while preserving the requested full-series results. Linear detrending alone cannot remove nonlinear harbour/bathymetry changes.

Excluded-year counts include early or late returned rows with MSL but no complete MHW/MLW record; those are not necessarily gaps inside the tested annual span. Full individual-month accounting remains in the cached audit. The retained source months include NOAA's inferred flags; these are not client-created estimates.

MN comparisons are diagnostics against a separate NOAA field. The requested MHW-MLW values are retained even when MN differs by a few millimetres; no substitution or correction is applied.

${failures}

Reproduce from \`app/\` (Node.js only; no added dependency):

~~~sh
node tools/fetch_tides.mjs --self-test
node tools/fetch_tides.mjs
node tools/fetch_tides.mjs --validate
npm test
~~~

Successful NOAA JSON responses and request/retrieval provenance are cached under \`tools/.cache/tides/\`; restarts reuse them. Requests are serialized at least 1.1 seconds apart, with a non-personal User-Agent, timeouts, retries and Retry-After backoff. \`--validate\` is offline and exactly reconstructs every annual series and fixed-seed lunar result, while checking the engine hash. [NOAA terms](${termsUrl}) allow public use unless otherwise marked, request attribution, prohibit presenting modified material as official government material, and disclaim warranties. Credit NOAA/NOS/CO-OPS; these annual aggregates and statistical results are project derivatives.
<!-- tides-control:end -->
`;
  const file = new URL('./README.md', import.meta.url), before = await readFile(file, 'utf8');
  const marker = /<!-- tides-control:start -->[\s\S]*?<!-- tides-control:end -->\n?/;
  await writeFile(file, marker.test(before) ? before.replace(marker, block) : before + '\n' + block);
}

async function main() {
  assert.ok(lastYear - 1850 < 200, 'Requested range exceeds NOAA monthly 200-year limit');
  await mkdir(cache, { recursive: true });
  const engineFile = new URL('engine.js', root), engineHash = hash(await readFile(engineFile));
  const data = { generated: new Date().toISOString(), source: { organization: 'NOAA/NOS/CO-OPS', product: 'monthly_mean', description: 'Verified monthly mean water levels',
    url: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter', documentation: docs, begin_date: '18500101', end_date: `${lastYear}1231`,
    method: 'Equal-weight mean of 12 monthly MHW-MLW differences; only complete years; no client interpolation; NOAA-inferred values retained.', datum: 'STND', units: 'metric', time_zone_requested: 'gmt', time_zone_note: 'NOAA says time_zone does not apply to monthly_mean.' },
    terms: { checked: new Date().toISOString().slice(0, 10), license: 'Public domain', url: termsUrl,
      attribution: 'NOAA National Ocean Service, Center for Operational Oceanographic Products and Services (CO-OPS).',
      modifications: 'Annual tidal-range aggregates and statistical results are project derivatives, not official NOAA material.', disclaimer: 'NOAA provides data as is; see source terms.' }, stations: [] };
  const report = { generated: data.generated, engine_sha256: engineHash, placebos, seed, stations: [], failures: [] };
  for (const id of stationIds) {
    const url = dataUrl(id);
    try {
      const raw = await getJson(url), body = raw.body;
      assert.equal(body.metadata?.id, id, 'Station metadata mismatch');
      const annual = annualRanges(body.data);
      assert.ok(annual.years.length >= 80, `Only ${annual.years.length} complete years; requires 80`);
      const station = { id, name: body.metadata.name, lat: Number(body.metadata.lat), lon: Number(body.metadata.lon),
        link: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${id}`, years: annual.years, values: annual.values, units: 'm', variable: 'TIDE_RANGE' };
      const row = { id, name: station.name, link: station.link, first_year: station.years[0], last_year: station.years.at(-1), n: station.years.length,
        source_url: url, retrieved: raw.retrieved, coverage: annual.coverage, mean_range_m: station.values.reduce((a, b) => a + b, 0) / station.values.length, test: test(station) };
      const contiguous = longestRun(station);
      row.contiguous = { first_year: contiguous.years[0], last_year: contiguous.years.at(-1), n: contiguous.years.length, test: test(contiguous) };
      const harmonicUrl = `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/${id}/harcon.json?units=metric`;
      try { row.form = tidalForm((await getJson(harmonicUrl)).body); row.harmonic_url = harmonicUrl; }
      catch (e) { row.harmonic_error = e.message; }
      data.stations.push(station); report.stations.push(row);
      console.log(`${station.name}: N=${row.n}, p=${row.test.p}, share=${row.test.share.toFixed(4)}, swing=${(100 * row.test.swing).toFixed(2)} cm`);
    } catch (e) { report.failures.push({ id, url, error: e.message }); console.warn(`${id}: ${e.message}`); }
    await saveJson(output, data); await saveJson(reportFile, report);
  }
  assert.equal(hash(await readFile(engineFile)), engineHash, 'Engine changed during run; rerun the cached analysis');
  await writeReport(report);
  await validate();
  if (report.failures.length) process.exitCode = 1;
}

function selfTest() {
  const rows = Array.from({ length: 12 }, (_, i) => ({ year: '2000', month: String(i + 1), MHW: '2.5', MLW: '1.25', inferred: '0' }));
  const result = annualRanges(rows);
  assert.deepEqual(result.years, [2000]);
  assert.deepEqual(result.values, [1.25]);
  assert.deepEqual(annualRanges(rows.slice(1)).years, []);
  assert.deepEqual(annualRanges(rows.map((r, i) => i ? r : { ...r, MLW: '' })).years, []);
  assert.deepEqual(annualRanges(rows.map((r, i) => i ? r : { ...r, MHW: '-99999' })).years, []);
  assert.throws(() => annualRanges([...rows, rows[0]]), /Duplicate/);
  assert.deepEqual(annualRanges(rows.map(r => ({ ...r, MHW: String(Number(r.MHW) + 10), MLW: String(Number(r.MLW) + 10) }))).values, result.values);
  assert.deepEqual(longestRun({ years: [2000, 2001, 2003, 2004, 2005], values: [0, 1, 3, 4, 5] }), { years: [2003, 2004, 2005], values: [3, 4, 5] });
  assert.equal(rng(seed)(), rng(seed)());
  assert.equal(excludedText([{ year: 2000, valid_months: 0 }, { year: 2001, valid_months: 0 }, { year: 2002, valid_months: 11 }]), '2000-2001 (0/12), 2002 (11/12)');
  console.log('Annual range, missing-month, blank/fill, duplicate and datum-invariance checks passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes('--self-test')) selfTest();
    else if (process.argv.includes('--validate')) await validate();
    else await main();
  } catch (e) { console.error(e); process.exitCode = 1; }
}
