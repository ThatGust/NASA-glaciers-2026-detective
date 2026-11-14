import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const cache = new URL('./.cache/moon/', import.meta.url);
const archive = new URL('MOON_nomenclature_center_pts.zip', cache);
const output = new URL('../data/moon_features.json', import.meta.url);
const downloadUrl = 'https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip';
const types = { ME: 'Mare', OC: 'Oceanus', LC: 'Lacus', SI: 'Sinus', PA: 'Palus', MO: 'Mons', VA: 'Vallis', RU: 'Rupes', AA: 'Crater', SF: 'Crater', ST: 'Landing site' };

export function eastLongitude(value) {
  assert.ok(Number.isFinite(value) && value >= -360 && value <= 360, 'Invalid source longitude');
  return Number((((value + 180) % 360 + 360) % 360 - 180).toFixed(8));
}

export function includeFeature(row) {
  if (row.approval !== 'Adopted by IAU') return false;
  if (['ME', 'OC', 'LC', 'SI', 'PA', 'ST'].includes(row.code)) return true;
  const diameter = Number(row.diameter);
  if (!row.diameter.trim() || !Number.isFinite(diameter)) return false;
  if (['MO', 'VA', 'RU'].includes(row.code)) return diameter > 100;
  return ['AA', 'SF'].includes(row.code) && diameter >= 50;
}

function shortOrigin(text) {
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= 180) return text;
  return text.slice(0, 179).replace(/\s+\S*$/, '').trimEnd() + '…';
}

export function featuresFromRows(rows) {
  return rows.filter(includeFeature).map(row => {
    const diameter = row.diameter.trim() ? Number(row.diameter) : null;
    const lat = row.center_lat.trim() ? Number(row.center_lat) : NaN;
    const lon = row.center_lon.trim() ? Number(row.center_lon) : NaN;
    const year = row.approvaldt.match(/^\d{4}/)?.[0];
    assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90, row.name);
    assert.ok(diameter === null || Number.isFinite(diameter) && diameter >= 0, row.name);
    return { name: row.name, type: row.code === 'MO' && /^Montes\b/.test(row.name) ? 'Montes' : types[row.code],
      lat: Number(lat.toFixed(8)), lon: eastLongitude(lon), diameter_km: diameter === null ? null : Number(diameter.toFixed(8)),
      origin: shortOrigin(row.origin), approval_year: year ? Number(year) : null,
      link: row.link.replace(/^http:/, 'https:') };
  }).sort((a, b) => a.name.localeCompare(b.name, 'en') || a.link.localeCompare(b.link));
}

// Read the ZIP/DBF with Python's standard library; no extraction or extra dependency.
function sourceRows() {
  const script = `
import json, struct, sys, zipfile
sys.stdout.reconfigure(encoding='utf-8')
with zipfile.ZipFile(sys.argv[1]) as z:
    assert sum(i.file_size for i in z.infolist()) < 128 * 1024 * 1024, 'Archive too large'
    dbfs = [n for n in z.namelist() if n.lower().endswith('.dbf')]
    assert len(dbfs) == 1
    cpg = next(n for n in z.namelist() if n.lower().endswith('.cpg'))
    assert z.read(cpg).strip().upper() in (b'UTF-8', b'UTF8')
    b = z.read(dbfs[0])
    count = struct.unpack_from('<I', b, 4)[0]
    header, length = struct.unpack_from('<HH', b, 8)
    assert header + count * length <= len(b)
    fields = []
    offset = 32
    while b[offset] != 13:
        field = b[offset:offset+32]
        fields.append((field[:11].split(bytes([0]))[0].decode('ascii'), field[16]))
        offset += 32
    assert 1 + sum(size for _,size in fields) == length
    keep = {'name','approvaldt','origin','diameter','center_lon','center_lat','type','code','approval','link'}
    assert keep <= {name for name,_ in fields}
    rows = []
    for i in range(count):
        record = b[header+i*length:header+(i+1)*length]
        if record[0] == 42: continue
        assert record[0] == 32
        row, pos = {}, 1
        for name,size in fields:
            if name in keep: row[name] = record[pos:pos+size].decode('utf-8').strip()
            pos += size
        rows.append(row)
    print(json.dumps(rows, ensure_ascii=False))
`;
  const result = spawnSync('python', ['-c', script, fileURLToPath(archive)], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

async function acquire() {
  await mkdir(cache, { recursive: true });
  try { await readFile(archive); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(downloadUrl, { headers: { 'User-Agent': 'SignalOrNoise/1.0 (educational lunar gazetteer catalog)' }, signal: AbortSignal.timeout(90000) });
        assert.ok(response.ok, `USGS HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length < 64 * 1024 * 1024 && bytes.readUInt32LE(0) === 0x04034b50, 'Invalid ZIP archive');
        await writeFile(archive, bytes);
        await writeFile(new URL('source.json', cache), JSON.stringify({ url: downloadUrl, retrieved: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2) + '\n');
        break;
      } catch (failure) {
        if (attempt === 3) throw failure;
        await new Promise(resolve => setTimeout(resolve, 2000 * 2 ** attempt));
      }
    }
  }
  const provenance = JSON.parse(await readFile(new URL('source.json', cache), 'utf8'));
  assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), provenance.sha256, 'Source ZIP checksum changed');
  return provenance;
}

export function validateMoon(data, rows) {
  assert.ok(Number.isFinite(Date.parse(data.generated)) && Number.isFinite(Date.parse(data.source.retrieved)));
  assert.equal(data.source.download_url, downloadUrl);
  assert.ok(/^[a-f0-9]{64}$/.test(data.source.sha256));
  assert.ok(data.features.length > 0);
  assert.equal(new Set(data.features.map(f => f.link)).size, data.features.length);
  for (const f of data.features) {
    assert.ok(typeof f.name === 'string' && f.name.trim() && !f.name.includes('\uFFFD'));
    assert.ok(Object.values(types).includes(f.type) || f.type === 'Montes', f.name);
    assert.ok(Number.isFinite(f.lat) && Math.abs(f.lat) <= 90, f.name);
    assert.ok(Number.isFinite(f.lon) && f.lon >= -180 && f.lon <= 180, f.name);
    assert.ok(f.diameter_km === null || Number.isFinite(f.diameter_km) && f.diameter_km >= 0, f.name);
    assert.ok(typeof f.origin === 'string' && f.origin.length <= 180 && !f.origin.includes('\uFFFD'));
    assert.ok(f.approval_year === null || Number.isInteger(f.approval_year) && f.approval_year >= 1900 && f.approval_year <= new Date().getUTCFullYear());
    assert.match(f.link, /^https:\/\/planetarynames\.wr\.usgs\.gov\/Feature\/\d+$/);
    if (f.type === 'Crater') assert.ok(f.diameter_km >= 50);
    if (['Mons', 'Montes', 'Vallis', 'Rupes'].includes(f.type)) assert.ok(f.diameter_km > 100);
  }
  if (rows) assert.deepEqual(data.features, featuresFromRows(rows), 'Every qualifying official record must be included exactly once');
  assert.ok(Buffer.byteLength(JSON.stringify(data) + '\n') < 400000, 'Moon catalog exceeds 400 KB');
  return Object.fromEntries([...new Set(data.features.map(f => f.type))].sort().map(type => [type, data.features.filter(f => f.type === type).length]));
}

function selfTest() {
  for (const [source, expected] of [[0, 0], [90, 90], [180, -180], [359, -1], [-181, 179], [360, 0]]) assert.equal(eastLongitude(source), expected);
  assert.throws(() => eastLongitude(NaN));
  const row = { approval: 'Adopted by IAU', code: 'AA', diameter: '50' };
  assert.ok(includeFeature(row));
  assert.ok(!includeFeature({ ...row, diameter: '49.999' }));
  assert.ok(!includeFeature({ ...row, code: 'MO', diameter: '100' }));
  assert.ok(includeFeature({ ...row, code: 'MO', diameter: '100.001' }));
  assert.ok(includeFeature({ ...row, code: 'SF' }));
  assert.ok(includeFeature({ ...row, code: 'ST', diameter: '0' }));
  assert.ok(!includeFeature({ ...row, approval: 'Dropped' }));
  assert.ok(shortOrigin('word '.repeat(100)).length <= 180);
  console.log('Moon self-checks passed (longitude wrapping, cutoffs, satellite craters, landing sites, approval).');
}

async function main() {
  if (process.argv.includes('--validate')) {
    const data = JSON.parse(await readFile(output, 'utf8'));
    let rows;
    try {
      const bytes = await readFile(archive);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), data.source.sha256, 'Cached source checksum changed');
      rows = sourceRows();
    }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const counts = validateMoon(data, rows);
    assert.ok((await readFile(output)).length < 400000);
    console.log(`Validated ${data.features.length} Moon features: ${JSON.stringify(counts)}`);
    return;
  }
  const provenance = await acquire(), rows = sourceRows();
  const data = { generated: new Date().toISOString(), source: {
    name: 'IAU/USGS Gazetteer of Planetary Nomenclature — Moon', url: 'https://planetarynames.wr.usgs.gov/GIS_Downloads',
    download_url: provenance.url, retrieved: provenance.retrieved, sha256: provenance.sha256, records_in_source: rows.length,
    license: 'U.S. public domain', license_url: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
    coordinate_system: 'LOLA 2011 Moon center points; planetocentric latitude, east-positive longitude normalized to [-180, 180). Centers and approximate diameters/longest dimensions, not feature outlines.',
    criteria: 'IAU-approved records only. All ME/OC/LC/SI/PA and ST; MO/VA/RU with longest dimension >100 km; AA and lunar lettered-crater SF with diameter >=50 km.',
    origin_note: 'Original gazetteer origin text, whitespace normalized and shortened at a word boundary to at most 180 characters; ellipsis marks truncation. Empty origins or missing approval years remain empty/null.',
    landing_sites: 'All official Statio records are included; missions without a listed landing-site record are not invented.',
    fields: 'https://planetarynames.wr.usgs.gov/Page/Specifics', descriptors: 'https://planetarynames.wr.usgs.gov/DescriptorTerms',
  }, features: featuresFromRows(rows) };
  const counts = validateMoon(data, rows);
  const json = JSON.stringify(data) + '\n';
  await writeFile(output, json);
  await writeFile(new URL('report.json', cache), JSON.stringify({ generated: data.generated, source_records: rows.length, included: data.features.length, counts, bytes: Buffer.byteLength(json), landing_sites: data.features.filter(f => f.type === 'Landing site') }, null, 2) + '\n');
  console.log(`Saved ${data.features.length} Moon features, ${Buffer.byteLength(json)} bytes: ${JSON.stringify(counts)}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  selfTest();
  if (!process.argv.includes('--self-test')) await main();
}
