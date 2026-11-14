import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allPlaces } from './place_facts.mjs';
import { mapLimited } from './power_api.mjs';

const imageDir = new URL('../img/places/', import.meta.url);
const cache = new URL('./.cache/place_images/', import.meta.url);
const manifestFile = new URL('./.cache/place_images.json', import.meta.url);
const cloudReportFile = new URL('./.cache/place_images_cloud_screen.json', import.meta.url);
const layers = ['MODIS_Terra_CorrectedReflectance_TrueColor', 'VIIRS_SNPP_CorrectedReflectance_TrueColor'];
const fallback = 'BlueMarble_NextGeneration';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function bboxFor(place) {
  const custom = { lake_titicaca: [3, 4.5], aral_sea: [5, 7.5], lake_chad: [3, 4.5],
    great_barrier_reef: [0.8, 1.2], glovers_reef: [0.5, 0.75], elphinstone_reef: [0.06, 0.09],
    pantanal: [5, 7.5], sundarbans: [2, 3], okavango: [2.6, 3.9],
    north_pole: [8, 36], south_pole: [8, 36], vostok: [3, 4.5] };
  const [height, width] = custom[place.id] ?? ({ desert: [12, 18], rainforest: [3, 4.5],
    savanna: [4, 6], tundra: [5, 7.5], wetland: [3, 4.5], ocean: [12, 18],
    river: [1.2, 1.8], coast: [1.2, 1.8] }[place.environment] ?? [0.6, 0.9]);
  const south = Math.max(-90, Math.min(90 - height, place.lat - height / 2));
  const west = Math.max(-180, Math.min(180 - width, place.lon - width / 2));
  return [south, west, south + height, west + width].map(v => +v.toFixed(6));
}

export function snapshotUrl(layer, date, bbox, crs = 'EPSG:4326') {
  return 'https://wvs.earthdata.nasa.gov/api/v1/snapshot?' + new URLSearchParams({
    REQUEST: 'GetSnapshot', LAYERS: layer, CRS: crs, TIME: date,
    BBOX: bbox.join(','), FORMAT: 'image/jpeg', WIDTH: '360', HEIGHT: '240',
  });
}

function datesFor(place) {
  const months = place.lat < -45 ? [1, 2, 12] : place.lat > 30 ? [6, 7, 8] :
    place.lat > 0 && place.lat < 20 ? [1, 2, 3] : [6, 8, 9];
  return months.map(m => `2025-${String(m).padStart(2, '0')}-20`);
}

async function download(url) {
  const file = new URL(`${createHash('sha256').update(url).digest('hex')}.jpg`, cache);
  try { await readFile(file); return file; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (let attempt = 0; attempt < 4; attempt++) {
    let delay = 2000 * 2 ** attempt;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (response.status === 429) delay = Math.max(10000, Number(response.headers.get('retry-after') || 0) * 1000, delay);
      assert.ok(response.ok, `Worldview HTTP ${response.status}`);
      assert.ok(response.headers.get('content-type')?.includes('image/jpeg'), 'Worldview did not return JPEG');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.ok(bytes.length > 100 && bytes[0] === 255 && bytes[1] === 216, 'Invalid JPEG signature');
      await writeFile(file, bytes);
      return file;
    } catch (error) {
      if (attempt === 3) throw error;
      await pause(delay);
    }
  }
}

// Pillow is used only by this offline tool: no new app or npm dependency.
const pixelCheck = `
import json, os, sys
from PIL import Image, ImageStat, ImageChops
def mask(low, spread, brightness, difference):
    return ImageChops.multiply(low.point(lambda p: 255 if p >= brightness else 0), spread.point(lambda p: 255 if p <= difference else 0))
def inspect(path, output=None):
    with Image.open(path) as source:
        original_size = source.size
        assert original_size in ((480, 320), (360, 240)), original_size
        im = source.convert('RGB').resize((360, 240), Image.Resampling.LANCZOS)
    red, green, blue = im.split()
    low = ImageChops.darker(ImageChops.darker(red, green), blue)
    high = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    spread = ImageChops.subtract(high, low)
    n = 360 * 240
    white = mask(low, spread, 220, 35).histogram()[255] / n
    black = sum(high.histogram()[:6]) / n
    cloud_mask = mask(low, spread, 155, 40)
    clouds = cloud_mask.histogram()[255]
    cloudlike = clouds / n
    rim_cloudlike = (clouds - cloud_mask.crop((90, 60, 270, 180)).histogram()[255]) / (n - 180 * 120)
    if output:
        for quality in (80, 70, 60, 50, 40, 30, 20):
            im.save(output, 'JPEG', quality=quality, optimize=True)
            if os.path.getsize(output) <= 25000: break
        assert os.path.getsize(output) <= 25000
    return {'width': original_size[0], 'height': original_size[1], 'white': white, 'black': black, 'cloudlike': cloudlike, 'rim_cloudlike': rim_cloudlike, 'texture': ImageStat.Stat(im.convert('L')).stddev[0]}
test_low = Image.frombytes('L', (5, 1), bytes([154, 155, 220, 255, 255]))
test_spread = Image.frombytes('L', (5, 1), bytes([0, 40, 35, 41, 36]))
assert list(mask(test_low, test_spread, 155, 40).getdata()) == [0, 255, 255, 0, 255]
assert list(mask(test_low, test_spread, 220, 35).getdata()) == [0, 0, 255, 0, 0]
print(json.dumps([inspect(*paths) for paths in json.load(sys.stdin)]))
`;
function inspectBatch(files) {
  const result = spawnSync('python', ['-c', pixelCheck], { input: JSON.stringify(files.map(paths => paths.map(file => fileURLToPath(file)))), encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}
function inspect(file, output) { return inspectBatch([[file, ...(output ? [output] : [])]])[0]; }

export function imageScore(metrics, environment) {
  if (metrics.black > 0.02 || metrics.texture < 1) return Infinity;
  const cloud = environment === 'polar' ? 0 : environment === 'glacier' ? metrics.rim_cloudlike : metrics.cloudlike;
  return metrics.black * 10 + cloud;
}

export function usableComposite(metrics, environment) {
  // Next Generation shows real deep water nearly black; the daily-image 2% test rejects it.
  return metrics.black < 0.98 && (metrics.texture >= 1 || ['glacier', 'polar', 'tundra', 'ocean'].includes(environment));
}

async function imageFor(place) {
  const polar = Math.abs(place.lat) >= 66.5;
  const crs = polar ? place.lat > 0 ? 'EPSG:3413' : 'EPSG:3031' : 'EPSG:4326';
  const bbox = polar ? polarBbox(place, crs) : bboxFor(place), snow = ['glacier', 'polar'].includes(place.environment);
  const candidates = [];
  async function candidate(date, layer) {
    const url = snapshotUrl(layer, date, bbox, crs);
    try {
      const file = await download(url);
      candidates.push({ layer, date, bbox, crs, url, file: fileURLToPath(file) });
    } catch (error) { candidates.push({ layer, date, bbox, url, error: error.message }); }
  }
  for (const date of datesFor(place)) await Promise.all(layers.map(layer => candidate(date, layer)));
  // This narrow reef needs Landsat/Sentinel HLS pixels rather than a MODIS-sized footprint.
  if (place.id === 'elphinstone_reef') {
    for (let day = 1; day <= 10; day++) await Promise.all(['HLS_L30_Nadir_BRDF_Adjusted_Reflectance', 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance']
      .map(layer => candidate(`2025-06-${String(day).padStart(2, '0')}`, layer)));
  }
  function best() {
    const pending = candidates.filter(c => !c.error && c.texture === undefined);
    const metrics = inspectBatch(pending.map(c => [pathToFileURL(c.file)]));
    pending.forEach((c, i) => Object.assign(c, metrics[i]));
    return candidates.filter(c => !c.error && Number.isFinite(imageScore(c, place.environment)))
      .sort((a, b) => imageScore(a, place.environment) - imageScore(b, place.environment) || Number(b.layer.startsWith('HLS_')) - Number(a.layer.startsWith('HLS_')) || a.date.localeCompare(b.date) || a.layer.localeCompare(b.layer))[0];
  }
  let selected = best();
  if (place.environment !== 'polar' && (!selected || imageScore(selected, place.environment) > 0.1)) {
    for (const date of datesFor(place).map(d => d.replace(/20$/, '05'))) await Promise.all(layers.map(layer => candidate(date, layer)));
    selected = best();
  }
  let note = snow ? 'Snow/ice expected; white pixels are not a reliable cloud measure.' : '';
  // shortcut: RGB whiteness cannot distinguish cloud from bright sand or salt; review the contact sheet.
  if (!selected || (place.environment !== 'polar' && imageScore(selected, place.environment) > 0.35)) {
    const date = '2004-08-01', layer = fallback, url = snapshotUrl(layer, date, bbox, crs);
    try {
      const file = await download(url), metrics = inspect(file);
      const composite = { layer, date, bbox, crs, url, file: fileURLToPath(file), ...metrics };
      candidates.push(composite);
      if (usableComposite(metrics, place.environment)) {
        selected = composite;
        note = 'Cloud-free Blue Marble Next Generation satellite composite; TIME is an API parameter, not a single acquisition date.';
      }
    } catch (error) { candidates.push({ layer, date, bbox, url, error: error.message }); }
  }
  assert.ok(selected, `${place.id}: no image with usable coverage`);
  if (selected.layer !== fallback && place.environment !== 'polar' && imageScore(selected, place.environment) > 0.2)
    note += ' Residual bright/cloudy pixels; human review recommended.';
  if (place.id === 'elphinstone_reef') note += selected.layer.startsWith('HLS_') ? ' Narrow reef: HLS 30 m true-colour imagery; Landsat (L30) or NASA-harmonized Sentinel-2 (S30).' : ' The narrow reef is near the resolution limit of MODIS/VIIRS.';
  const output = new URL(`${place.id}.jpg`, imageDir);
  inspect(pathToFileURL(selected.file), output);
  const bytes = (await readFile(output)).length;
  console.log(`Image: ${place.id}: ${selected.layer}, ${selected.date}, ${bytes} bytes`);
  return { id: place.id, name: place.name, selected, note: note.trim(), width: 360, height: 240, bytes, candidates };
}

export async function validateImages(places) {
  const result = spawnSync('python', ['-c', `
import json, os, sys
from PIL import Image
for path in json.load(sys.stdin):
    assert os.path.getsize(path) <= 25000, path
    with Image.open(path) as im:
        assert im.format == 'JPEG' and im.size == (360, 240), path
        im.verify()
`], { input: JSON.stringify(places.map(p => fileURLToPath(new URL(`${p.id}.jpg`, imageDir)))), encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}

async function saveManifest(report) {
  const temporary = new URL(`./.cache/place_images.${process.pid}.tmp`, import.meta.url);
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
  await rename(temporary, manifestFile);
}

async function writeOutputs(rows) {
  const report = { generated: new Date().toISOString(), rows, total_bytes: rows.reduce((sum, row) => sum + row.bytes, 0) };
  await saveManifest(report);
  let cloudNote = '';
  try {
    const screen = JSON.parse(await readFile(cloudReportFile, 'utf8'));
    cloudNote = `Cloud review (${screen.generated.slice(0, 10)}): ${screen.replaced.length} daily images replaced with cloud-free Blue Marble Next Generation. Automatic flag: at least 15% of pixels have all RGB channels >=155 and channel spread <=40. Glacier, polar and tundra places are exempt; existing Blue Marble composites are already cloud-free and are retained. Explicitly reported non-snow examples are reviewed even below the threshold. Bright sand, salt or rock can trigger this heuristic; it is not a scientific cloud mask. Composite TIME is not an observation date. ${screen.failures?.length ?? 0} flagged views retained because no usable composite showed the feature${screen.failures?.length ? ': ' + screen.failures.map(f => f.id).join(', ') : ''}.`;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const credits = [
    '# Place image credits', '',
    'NASA Worldview / GIBS, public domain. We acknowledge imagery from NASA Global Imagery Browse Services (GIBS), part of NASA ESDIS.', '',
    '[NASA data use guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance) · [GIBS API documentation](https://nasa-gibs.github.io/gibs-api-docs/) · [current Worldview Snapshots request implementation](https://wvs.earthdata.nasa.gov/js/index-chunk.js).', '',
    '360 × 240 JPEGs, each at most 25,000 bytes. EPSG:4326 BBOX uses latitude,longitude: minLat,minLon,maxLat,maxLon. EPSG:3413 (Arctic) and EPSG:3031 (Antarctic) BBOX uses projected metres: minX,minY,maxX,maxY. Cropped by the API and recompressed locally; no synthetic content.', '',
    'Daily-image selection compares six real true-colour snapshots (three seasonal dates, MODIS Terra and VIIRS SNPP), plus six alternate dates if the best cloud score exceeds 10%. Reject >2% near-black pixels (all channels ≤5) or nearly flat images (grayscale standard deviation <1). Rank by 10×black fraction + cloud-like fraction (all channels ≥155, channel spread ≤40, including gray cloud). Also record near-white fraction (all channels ≥220, spread ≤35). For glaciers, score cloud-like pixels only in the outer rim, excluding the central half-width/half-height feature where snow is expected. For polar places, omit the brightness penalty. If none passes, or the best non-polar cloud score exceeds 35%, try Blue Marble. This is a heuristic, not a validated cloud mask; sand, salt, snow, haze and ocean colour can mislead it. Human review remains necessary.', '',
    'Blue Marble Next Generation is a cloud-free satellite composite. ShadedRelief/Bathymetry variants add relief/bathymetry. Dates below are requested TIME parameters, not single acquisition dates or current glacier outlines. Integrator-requested replacements use Next Generation, retaining geographic bounds; polar replacements use metre bounds in polar stereographic projections. Small reefs can be near the sensor resolution limit.', '',
    ...(cloudNote ? [cloudNote, ''] : []),
    '| Place / file | Layer | Requested date | BBOX | Projection | Credit | Review note |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(row => `| [${row.name.replaceAll('|', '/')}](./${row.id}.jpg) | ${row.selected.layer} | ${row.selected.date} | ${row.selected.bbox.join(', ')} | ${row.selected.crs ?? 'EPSG:4326'} | [NASA Worldview / GIBS, public domain](${row.selected.url}) | ${row.note} |`), '',
    `Total: ${rows.length} images, ${report.total_bytes} bytes.`, '',
  ].join('\n');
  await writeFile(new URL('CREDITS.md', imageDir), credits);
  await writeFile(new URL('./.cache/contact_sheet.html', import.meta.url), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Trend Detective satellite image review</title><style>body{font:16px system-ui;margin:24px;background:#eef2f4;color:#172c3a}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}figure{margin:0;background:white;padding:12px}img{width:100%;height:auto}small{display:block;overflow-wrap:anywhere}</style><h1>Satellite images: human review</h1><p>${rows.length} images · ${(report.total_bytes / 1e6).toFixed(2)} MB. Automatic cloud screening is approximate.</p><div class="grid">${rows.map(row => `<figure><img src="../../img/places/${row.id}.jpg" alt="Satellite view of ${esc(row.name)}" width="480" height="320"><figcaption><strong>${esc(row.name)}</strong><small>${esc(row.id)} · ${esc(row.selected.date)} · ${esc(row.selected.layer)} · ${esc(row.selected.crs ?? 'EPSG:4326')}</small><small>White ${(row.selected.white * 100).toFixed(1)}% · black ${(row.selected.black * 100).toFixed(1)}%</small><small>${esc(row.note)}</small></figcaption></figure>`).join('')}</div></html>`);
  await validateImages((await allPlaces()).places);
  console.log(`Saved ${rows.length} images, ${report.total_bytes} bytes; contact sheet: tools/.cache/contact_sheet.html`);
}

export function cloudFlag(environment, fraction) {
  assert.ok(Number.isFinite(fraction) && fraction >= 0 && fraction <= 1);
  return !['glacier', 'polar', 'tundra'].includes(environment) && fraction >= 0.15;
}

async function cloudScreen() {
  const { places } = await allPlaces();
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const rows = new Map(manifest.rows.map(row => [row.id, row]));
  const hash = async id => createHash('sha256').update(await readFile(new URL(`${id}.jpg`, imageDir))).digest('hex');
  for (const place of places) assert.ok(rows.has(place.id), `Missing original bounds/credit: ${place.id}`);
  let screen;
  try { screen = JSON.parse(await readFile(cloudReportFile, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const metrics = inspectBatch(places.map(p => [new URL(`${p.id}.jpg`, imageDir)]));
    const requested = new Set(['galeras', 'baoshan', 'hechi', 'shaoguan', 'tongren', 'guaviare_river']);
    const scanned = [];
    for (let i = 0; i < places.length; i++) {
      const p = places[i], previous = rows.get(p.id);
      const exempt = ['glacier', 'polar', 'tundra'].includes(p.environment);
      const composite = previous.selected.layer.startsWith('BlueMarble_');
      const automatic = cloudFlag(p.environment, metrics[i].cloudlike);
      scanned.push({ id: p.id, environment: p.environment, fraction: metrics[i].cloudlike, automatic,
        requested: requested.has(p.id), exempt, already_cloud_free: composite,
        replace: !exempt && !composite && (automatic || requested.has(p.id)), before_hash: await hash(p.id) });
    }
    screen = { generated: new Date().toISOString(), threshold: { minimum_channel: 155, maximum_channel_spread: 40, minimum_fraction: 0.15 },
      method: 'Fraction measured on each delivered 360x240 JPEG. Glacier/polar/tundra excluded. Existing Blue Marble composites retained. Explicit user examples below the automatic threshold are included as manual review targets.',
      scanned, replaced: [] };
    await writeFile(cloudReportFile, JSON.stringify(screen, null, 2) + '\n');
  }
  assert.deepEqual(screen.scanned.map(row => row.id).sort(), places.map(p => p.id).sort(), 'Catalog changed since cloud scan');
  screen.failures ??= [];
  const pending = screen.scanned.filter(row => row.replace && !screen.replaced.some(done => done.id === row.id));
  const updatedIds = new Set(screen.replaced.map(row => row.id));
  console.log(`Cloud screen: ${screen.scanned.length} images, ${screen.scanned.filter(r => r.automatic).length} automatic flags, ${pending.length} pending replacements.`);
  for (let i = 0; i < pending.length; i += 3) {
    const updates = await mapLimited(pending.slice(i, i + 3), async flagged => {
      const place = places.find(p => p.id === flagged.id), previous = rows.get(place.id);
      let bbox = previous.selected.bbox, crs = previous.selected.crs ?? 'EPSG:4326';
      if (Math.abs(place.lat) >= 66.5 && crs === 'EPSG:4326') {
        crs = place.lat > 0 ? 'EPSG:3413' : 'EPSG:3031';
        const projected = spawnSync('python', ['-c', `
import json,sys
from pyproj import Transformer
south,west,north,east=json.loads(sys.argv[1])
print(json.dumps(Transformer.from_crs('EPSG:4326',sys.argv[2],always_xy=True).transform_bounds(west,south,east,north,densify_pts=21)))
`, JSON.stringify(bbox), crs], { encoding: 'utf8', windowsHide: true });
        assert.equal(projected.status, 0, projected.stderr);
        bbox = JSON.parse(projected.stdout);
        assert.ok(bbox.every(Number.isFinite));
      }
      let date, url, file, metrics;
      const attempts = [];
      for (const trial of ['2004-08-01', '2004-01-01', '2004-07-01', '2004-12-01']) {
        date = trial; url = snapshotUrl(fallback, date, bbox, crs);
        try {
          file = await download(url); metrics = inspect(file);
          if (usableComposite(metrics, place.environment)) break;
          attempts.push({ url, reason: 'Empty/flat composite; feature not visible', black: metrics.black, texture: metrics.texture });
          file = undefined;
        } catch (error) { attempts.push({ url, reason: error.message }); file = undefined; }
      }
      if (!file) return { failure: { id: place.id, reason: 'No usable Blue Marble Next Generation view; original image retained', attempts } };
      const output = new URL(`${place.id}.jpg`, imageDir);
      inspect(file, output);
      const selected = { layer: fallback, date, bbox, crs, url, file: fileURLToPath(file), ...metrics };
      const row = { ...previous, name: place.name, selected, width: 360, height: 240, bytes: (await readFile(output)).length,
        note: 'Cloud review: cloud-free Blue Marble Next Generation historical satellite composite; illustrative mosaic, not a current observation. Original geographic footprint retained.',
        candidates: [...(previous.candidates ?? []), selected] };
      return { row, audit: { id: place.id, fraction_before: flagged.fraction, reason: flagged.automatic ? 'automatic brightness screen' : 'explicit user-reported clouds', before_hash: flagged.before_hash, after_hash: await hash(place.id), url, bbox, crs } };
    });
    for (const { row, audit, failure } of updates) {
      if (failure) { screen.failures = [...screen.failures.filter(f => f.id !== failure.id), failure]; console.warn(`Cloud review: ${failure.id}: ${failure.reason}`); continue; }
      rows.set(row.id, row); screen.replaced.push(audit); updatedIds.add(row.id);
      screen.failures = screen.failures.filter(f => f.id !== row.id);
    }
    await writeFile(cloudReportFile, JSON.stringify(screen, null, 2) + '\n');
    await writeOutputs(places.map(p => ({ ...rows.get(p.id), name: p.name })));
    console.log(`Cloud replacements saved: ${screen.replaced.length}`);
  }
  for (const row of screen.scanned) if (!updatedIds.has(row.id)) assert.equal(await hash(row.id), row.before_hash, `${row.id}: unrequested image changed`);
  await writeOutputs(places.map(p => ({ ...rows.get(p.id), name: p.name })));
  console.log(`Cloud review complete: ${screen.replaced.length} replaced; ${places.length - updatedIds.size} other image hashes unchanged; ${screen.failures.length} composite failures.`);
}

const reviewIds = new Set(['aletsch', 'cape_byron', 'cape_horn', 'chimborazo', 'congo', 'congo_river',
  'ganges_river', 'glovers_reef', 'jakobshavn', 'khumbu', 'london', 'niger_river', 'perito-moreno',
  'puncak-jaya', 'quelccaya', 'yenisei_river', 'zongo', 'north_pole', 'south_pole', 'vostok']);

function polarBbox(place, crs) {
  const result = spawnSync('python', ['-c', `
import json,sys
from pyproj import Transformer
x,y=Transformer.from_crs('EPSG:4326',sys.argv[3],always_xy=True).transform(float(sys.argv[2]),float(sys.argv[1]))
print(json.dumps([round(x-300000),round(y-200000),round(x+300000),round(y+200000)]))
`, String(place.lat), String(place.lon), crs], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const bbox = JSON.parse(result.stdout);
  assert.ok(bbox.length === 4 && bbox.every(Number.isFinite));
  return bbox;
}

async function reviewImage(place, previous) {
  const polar = place.environment === 'polar';
  const crs = polar ? place.id === 'north_pole' ? 'EPSG:3413' : 'EPSG:3031' : 'EPSG:4326';
  const bbox = polar ? polarBbox(place, crs) : previous.selected.bbox;
  const candidates = [];
  async function candidate(layer, date) {
    const url = snapshotUrl(layer, date, bbox, crs);
    try {
      const file = await download(url), metrics = inspect(file);
      const row = { layer, date, bbox, crs, url, file: fileURLToPath(file), ...metrics };
      candidates.push(row);
      return row;
    } catch (error) { candidates.push({ layer, date, bbox, crs, url, error: error.message }); }
  }
  let selected;
  if (['cape_byron', 'cape_horn', 'glovers_reef'].includes(place.id)) {
    const months = place.id === 'glovers_reef' ? [1, 2, 3] : place.id === 'cape_horn' ? [1, 2, 12] : [6, 8, 9];
    for (const year of [2025, 2024]) for (const month of months)
      for (const layer of layers) await candidate(layer, `${year}-${String(month).padStart(2, '0')}-08`);
    selected = candidates.filter(c => !c.error && imageScore(c, 'coast') <= 0.05)
      .sort((a, b) => imageScore(a, 'coast') - imageScore(b, 'coast'))[0];
  }
  if (place.id === 'north_pole') {
    for (const date of ['2025-07-20', '2025-07-05', '2025-08-05'])
      for (const layer of layers) await candidate(layer, date);
    selected = candidates.filter(c => !c.error && c.black <= 0.02 && c.texture >= 2)
      .sort((a, b) => a.black - b.black || b.texture - a.texture)[0];
  }
  if (!selected) selected = await candidate('BlueMarble_NextGeneration', '2004-08-01');
  assert.ok(selected && selected.black <= 0.02, `${place.id}: reviewed image has missing coverage`);
  if (place.id === 'north_pole') assert.ok(selected.texture >= 2, 'North Pole needs visible ice texture, not a flat ocean composite');
  const output = new URL(`${place.id}.jpg`, imageDir);
  inspect(pathToFileURL(selected.file), output);
  const bytes = (await readFile(output)).length;
  const note = selected.layer === 'BlueMarble_NextGeneration' ?
    'Integrator review: cloud-free Blue Marble Next Generation satellite composite; illustrative historical mosaic, not a current observation.' :
    polar ? 'Integrator review: sunny-season true-colour satellite image with visible ice texture; cloud/ice distinction remains heuristic.' :
    'Integrator review: selected from 12 additional true-colour snapshots with at most 5% cloud-like pixels; heuristic, human review still required.';
  console.log(`Review fix: ${place.id}: ${selected.layer}, ${crs}, ${bytes} bytes`);
  return { ...previous, selected, note: note + (polar ? ' Polar stereographic bounds remove the geographic pole seam.' : ''), bytes,
    candidates: [...previous.candidates, ...candidates] };
}

async function main() {
  const { places } = await allPlaces();
  await mkdir(imageDir, { recursive: true });
  await mkdir(cache, { recursive: true });
  if (process.argv.includes('--review-fixes')) {
    const report = JSON.parse(await readFile(manifestFile, 'utf8'));
    const hash = async id => createHash('sha256').update(await readFile(new URL(`${id}.jpg`, imageDir))).digest('hex');
    const unchanged = new Map(await Promise.all(places.filter(p => !reviewIds.has(p.id)).map(async p => [p.id, await hash(p.id)])));
    const updates = await mapLimited(places.filter(p => reviewIds.has(p.id)), p => reviewImage(p, report.rows.find(row => row.id === p.id)));
    assert.equal(updates.length, 20);
    for (const [id, before] of unchanged) assert.equal(await hash(id), before, `${id}: unrequested image changed`);
    await writeOutputs(report.rows.map(row => updates.find(update => update.id === row.id) ?? row));
    console.log(`Replaced only ${updates.length} requested images; ${unchanged.size} other image hashes unchanged.`);
  } else {
    let rows = [];
    try { rows = JSON.parse(await readFile(manifestFile, 'utf8')).rows; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const completed = new Map(rows.map(row => [row.id, row]));
    let next = 0, finished = 0, checkpoint = Promise.resolve();
    // Six places, with two instruments per date: at most twelve snapshot requests in flight.
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < places.length) {
        const place = places[next++], previous = completed.get(place.id);
        let row = previous;
        if (!previous) row = await imageFor(place);
        else {
          const output = new URL(`${place.id}.jpg`, imageDir);
          if (previous.width !== 360 || previous.height !== 240 || (await readFile(output)).length > 25000) {
            const metrics = inspect(output);
            if (metrics.width !== 360 || (await readFile(output)).length > 25000) inspect(pathToFileURL(previous.selected.file), output);
            row = { ...previous, width: 360, height: 240, bytes: (await readFile(output)).length };
          }
        }
        completed.set(place.id, row);
        finished++;
        const current = places.map(p => completed.get(p.id)).filter(Boolean);
        const report = { generated: new Date().toISOString(), rows: current, total_bytes: current.reduce((n, r) => n + r.bytes, 0) };
        checkpoint = checkpoint.then(() => saveManifest(report));
        await checkpoint;
        if (finished % 6 === 0) console.log(`Image progress saved: ${finished}/${places.length}`);
      }
    }));
    await writeOutputs(places.map(p => completed.get(p.id)));
  }
}

function selfTest() {
  assert.ok(usableComposite({ black: 0.2, texture: 30 }, 'wetland'));
  assert.ok(!usableComposite({ black: 1, texture: 0 }, 'ocean'));
  assert.ok(!usableComposite({ black: 0, texture: 0 }, 'city'));
  assert.ok(cloudFlag('city', 0.15));
  assert.ok(!cloudFlag('city', 0.14999));
  for (const kind of ['glacier', 'polar', 'tundra']) assert.ok(!cloudFlag(kind, 1));
  assert.deepEqual(bboxFor({ id: 'test', environment: 'volcano', lat: 0, lon: 0 }), [-0.3, -0.45, 0.3, 0.45]);
  for (const lat of [-90, 90]) {
    const bbox = bboxFor({ id: lat < 0 ? 'south_pole' : 'north_pole', lat, lon: 0 });
    assert.ok(bbox[0] <= lat && bbox[2] >= lat && bbox[0] >= -90 && bbox[2] <= 90);
  }
  assert.equal(imageScore({ black: 0.5, cloudlike: 0, texture: 20 }, 'city'), Infinity);
  assert.equal(imageScore({ black: 0, cloudlike: 0.8, texture: 20 }, 'polar'), 0);
  assert.equal(imageScore({ black: 0, cloudlike: 0.8, rim_cloudlike: 0.2, texture: 20 }, 'glacier'), 0.2);
  assert.ok(imageScore({ black: 0, cloudlike: 0.1, texture: 20 }, 'city') < imageScore({ black: 0, cloudlike: 0.8, texture: 20 }, 'city'));
  assert.equal(new URL(snapshotUrl(layers[0], '2025-07-20', [-16, -72, -15, -71])).searchParams.get('BBOX'), '-16,-72,-15,-71');
  assert.equal(new URL(snapshotUrl(layers[0], '2025-07-20', [-300000, -200000, 300000, 200000], 'EPSG:3413')).searchParams.get('CRS'), 'EPSG:3413');
  assert.deepEqual(polarBbox({ lat: 90, lon: 0 }, 'EPSG:3413'), [-300000, -200000, 300000, 200000]);
  assert.deepEqual(polarBbox({ lat: -90, lon: 0 }, 'EPSG:3031'), [-300000, -200000, 300000, 200000]);
  assert.equal(reviewIds.size, 20);
  console.log('Image-selection self-check passed.');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  selfTest();
  if (process.argv.includes('--cloud-screen')) await cloudScreen();
  else if (process.argv.includes('--check')) await validateImages((await allPlaces()).places);
  else if (!process.argv.includes('--self-test')) await main();
}
