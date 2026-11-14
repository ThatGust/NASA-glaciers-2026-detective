import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, stat, access, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const cache = new URL('./.cache/commons/', import.meta.url);
const manifest = new URL('data/place_photos.json', root);
const stateFile = new URL('state.json', cache);
const userAgent = 'TrendDetective-PlacePhotos/1.0 (educational offline Wikimedia Commons photo and attribution collector)';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const maxBytes = 40000;
let lastRequest = 0;
const rejected = new Map();
const parsedMetadata = new Map();
// These lead images were visually reviewed: they show portraits, fauna, equipment or an underwater view.
const reviewedExclusions = new Set(['Reindeer herders Yamal 1975.jpg', 'Alaska 001.jpg',
  'Baffin Island - Curious as a Fox.jpg', "Glover's Reef 2-14 (33297602395).jpg"]);
const cachePath = (url, binary = false) => new URL(createHash('sha256').update(url).digest('hex') + (binary ? '.bin' : '.json'), cache);
const apiUrl = (host, params) => `https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
const entityParams = ids => ({ action: 'wbgetentities', ids, props: 'claims|sitelinks' });
const commonsParams = titles => ({ action: 'query', titles, redirects: '1', prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '480' });

async function json(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; }
}

async function save(file, bytes) {
  const staging = new URL(createHash('sha256').update(file.href).digest('hex') + '.pending', cache);
  await writeFile(staging, bytes);
  await rename(staging, file);
}

async function request(url, binary = false) {
  const file = cachePath(url, binary);
  try { return binary ? await readFile(file) : await json(file); }
  catch (e) { if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
  for (let attempt = 0; attempt < 4; attempt++) {
    await pause(Math.max(0, (binary ? 550 : 1050) - (Date.now() - lastRequest)));
    lastRequest = Date.now();
    let delay = 2000 * 2 ** attempt;
    try {
      const response = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(45000) });
      const retry = response.headers.get('retry-after');
      delay = Math.max(delay, Number(retry) * 1000 || Date.parse(retry) - Date.now() || 0);
      if (response.status === 429) delay = Math.max(delay, binary ? 10000 : 30000);
      assert.ok(response.ok, `HTTP ${response.status}: ${new URL(url).hostname}`);
      const result = binary ? Buffer.from(await response.arrayBuffer()) : await response.json();
      assert.ok(binary || !result.error, JSON.stringify(result.error));
      await save(file, binary ? result : JSON.stringify(result));
      return result;
    } catch (e) { if (attempt === 3) throw e; console.warn(`Retry in ${Math.ceil(delay / 1000)}s: ${e.message}`); await pause(delay); }
  }
}

function api(host, params) {
  return request(apiUrl(host, params));
}

function imageClaims(entity) {
  return (entity?.claims?.P18 || []).filter(c => c.rank !== 'deprecated')
    .sort((a, b) => Number(b.rank === 'preferred') - Number(a.rank === 'preferred'))
    .map(c => c.mainsnak?.datavalue?.value).filter(v => typeof v === 'string');
}

export function pageForTitle(data, title) {
  const normalize = v => v.replaceAll('_', ' ');
  const aliases = new Map([...(data.query?.normalized || []), ...(data.query?.redirects || [])].map(a => [normalize(a.from), normalize(a.to)]));
  let target = normalize(title);
  for (let i = 0; i < 10 && aliases.has(target); i++) target = aliases.get(target);
  return data.query?.pages?.find(p => normalize(p.title) === target) || { title, missing: true };
}

async function prefetch(places) {
  const ids = [...new Set(places.map(p => p.wikidata).filter(id => /^Q\d+$/.test(id)))];
  const pending = [];
  for (const id of ids) {
    try { await access(cachePath(apiUrl('www.wikidata.org', entityParams(id)))); }
    catch (e) { if (e.code !== 'ENOENT') throw e; pending.push(id); }
  }
  for (let i = 0; i < pending.length; i += 50) {
    const batch = pending.slice(i, i + 50);
    const data = await api('www.wikidata.org', entityParams(batch.join('|')));
    for (const id of batch) await save(cachePath(apiUrl('www.wikidata.org', entityParams(id))), JSON.stringify({ entities: { [id]: data.entities?.[id] } }));
    console.log(`Wikidata metadata: ${Math.min(i + 50, pending.length)}/${pending.length}`);
  }
  const titles = new Set();
  for (const id of ids) {
    const entity = (await api('www.wikidata.org', entityParams(id))).entities?.[id];
    for (const name of imageClaims(entity)) {
      const title = 'File:' + name.replace(/^File:/, '').replaceAll('_', ' ');
      if (/\.(jpe?g|png|webp|tiff?)$/i.test(title) && !unsuitable(title, {})) titles.add(title);
    }
  }
  await prefetchImages(titles);
}

async function prefetchImages(titles) {
  const missing = [];
  for (const title of titles) {
    try { await access(cachePath(apiUrl('commons.wikimedia.org', commonsParams(title)))); }
    catch (e) { if (e.code !== 'ENOENT') throw e; missing.push(title); }
  }
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const data = await api('commons.wikimedia.org', commonsParams(batch.join('|')));
    for (const title of batch) await save(cachePath(apiUrl('commons.wikimedia.org', commonsParams(title))), JSON.stringify({ query: { pages: [pageForTitle(data, title)] } }));
    console.log(`Commons metadata: ${Math.min(i + 50, missing.length)}/${missing.length}`);
  }
}

export function allowedLicense(name, url) {
  const cc = /^(?:CC BY(?:-SA)? \d+\.\d+(?: [a-z-]+)?|CC0(?: 1\.0)?|Public domain)$/i.test(name);
  if (!cc) return false;
  if (/^Public domain$/i.test(name)) return !url || /^https?:\/\/creativecommons\.org\/publicdomain\//i.test(url);
  if (/^CC0/i.test(name)) return /^https?:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\//i.test(url);
  const kind = name.toLowerCase().startsWith('cc by-sa') ? 'by-sa' : 'by';
  const version = name.match(/\d+\.\d+/)[0];
  return new RegExp(`^https?://creativecommons\\.org/licenses/${kind}/${version.replace('.', '\\.')}(/|$)`, 'i').test(url);
}

// Decode entities and strip HTML with the standard parser, including author links.
const cleanMetadata = `
import sys,json,re
from html.parser import HTMLParser
class Text(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.parts=[]; self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style'): self.skip+=1
        if tag in ('br','p','div'): self.parts.append(' ')
    def handle_endtag(self,tag):
        if tag in ('script','style'): self.skip=max(0,self.skip-1)
        self.parts.append(' ')
    def handle_data(self,data):
        if not self.skip: self.parts.append(data)
out={}
for k,v in json.load(sys.stdin.buffer).items():
    p=Text(); p.feed(str(v.get('value',''))); out[k]=re.sub(r'\\s+',' ',''.join(p.parts)).strip()
print(json.dumps(out))
`;
function metadata(ext) {
  const input = JSON.stringify(ext), key = createHash('sha256').update(input).digest('hex');
  if (parsedMetadata.has(key)) return parsedMetadata.get(key);
  const p = spawnSync('python', ['-c', cleanMetadata], { input, encoding: 'utf8', windowsHide: true });
  assert.equal(p.status, 0, p.stderr || p.error?.message);
  const result = JSON.parse(p.stdout);
  parsedMetadata.set(key, result);
  return result;
}

export function unsuitable(title, meta) {
  // shortcut: metadata screening cannot prove photographic subject identity; review the contact sheet.
  const text = [title.replaceAll('_', ' '), meta.ObjectName, meta.Categories].join(' ');
  return reviewedExclusions.has(title.replace(/^File:/, '').replaceAll('_', ' ')) ||
    /cross[ _-]*sections?|bathymetr|computer.generated|digital elevation|rendering/i.test(text) ||
    /\b(maps?|flags?|logos?|diagrams?|locator|coat of arms|satellite|landsat|MODIS|Sentinel-2|NASA World Wind|space image|astronaut photography|montages?|collages?|pictograms?|charts?|drawings?|paintings?|engravings?|lithographs?|illustrations?|underwater)\b|(?:location|relief)[ _-]*map/i.test(text) ||
    /\b(map of|satellite (image|view)|diagram of|collage of)\b/i.test(meta.ImageDescription || '');
}

function wikipediaSource(place, fact) {
  for (const source of [place.coord_source, place.published_source, fact?.one_line_source, fact?.country_source]) {
    if (!source) continue;
    const u = new URL(source);
    if (!/^[a-z-]+\.wikipedia\.org$/.test(u.hostname)) continue;
    const title = u.searchParams.get('title') || (u.pathname.startsWith('/wiki/') ? decodeURIComponent(u.pathname.slice(6)) : '');
    if (title) return { host: u.hostname, title };
  }
}

async function sources(place, fact, includeWiki = false) {
  let qid = place.wikidata || place.coord_source?.match(/wikidata\.org\/wiki\/(Q\d+)/)?.[1];
  const wiki = wikipediaSource(place, fact);
  let page;
  if (wiki && (!qid || includeWiki)) {
    const data = await api(wiki.host, { action: 'query', titles: wiki.title, redirects: '1', prop: 'pageprops|pageimages|images', imlimit: '500', ppprop: 'wikibase_item', piprop: 'name', pilicense: 'any' });
    page = data.query?.pages?.[0];
    qid ||= page?.pageprops?.wikibase_item;
  }
  let entity;
  if (/^Q\d+$/.test(qid)) {
    entity = (await api('www.wikidata.org', entityParams(qid))).entities?.[qid];
    if (!page && includeWiki) {
      const site = entity?.sitelinks?.enwiki;
      if (site) page = (await api('en.wikipedia.org', { action: 'query', titles: site.title, prop: 'pageimages|images', imlimit: '500', piprop: 'name', pilicense: 'any' })).query?.pages?.[0];
    }
  }
  const primary = [...imageClaims(entity), page?.pageimage].filter(v => typeof v === 'string');
  const normalize = v => v.replace(/^File:/, '').replaceAll('_', ' ');
  const lead = new Set(primary.map(normalize));
  const titles = [...new Set([...primary, ...(page?.images || []).map(i => i.title)].filter(v => typeof v === 'string').map(normalize))];
  const subject = (page?.title || wiki?.title || entity?.sitelinks?.enwiki?.title || place.short).replaceAll('_', ' ').replace(/\s*\([^)]*\)/g, '');
  return titles.map(title => ({ title, primary: lead.has(title), subject }));
}

const encode = `
import io,sys,json
from PIL import Image,ImageOps
im=ImageOps.exif_transpose(Image.open(io.BytesIO(sys.stdin.buffer.read())))
assert im.width>=400, 'Thumbnail narrower than 400 px'
im.load()
if im.mode in ('RGBA','LA') or 'transparency' in im.info:
    rgba=im.convert('RGBA'); im=Image.new('RGB',rgba.size,'white'); im.paste(rgba,mask=rgba.getchannel('A'))
else: im=im.convert('RGB')
im=im.resize((480,max(1,round(im.height*480/im.width))),Image.Resampling.LANCZOS)
for quality in (85,75,65,55,45,35,25,15,5):
    out=io.BytesIO(); im.save(out,'JPEG',quality=quality,optimize=True)
    if len(out.getvalue())<=40000: break
assert len(out.getvalue())<=40000, 'Cannot fit JPEG within 40000 bytes'
sys.stdout.buffer.write(out.getvalue())
`;

async function photoFor(place, fact, log) {
  const tried = new Set();
  for (const includeWiki of [false, true]) {
    const candidates = await sources(place, fact, includeWiki);
    if (includeWiki || !place.wikidata) await prefetchImages(candidates.map(c => 'File:' + c.title)
      .filter(title => /\.(jpe?g|png|webp|tiff?)$/i.test(title) && !unsuitable(title, {})));
    for (const candidate of candidates) {
      const title = 'File:' + candidate.title;
      if (tried.has(title)) continue;
      tried.add(title);
      if (!/\.(jpe?g|png|webp|tiff?)$/i.test(title) || unsuitable(title, {})) continue;
      const data = await api('commons.wikimedia.org', commonsParams(title));
      const page = data.query?.pages?.[0], info = page?.imageinfo?.[0];
      if (!info) { log.push({ title, reason: 'No Commons file' }); continue; }
      const meta = metadata(info.extmetadata || {}), license = meta.LicenseShortName || '', licenseUrl = meta.LicenseUrl || '';
      if (!allowedLicense(license, licenseUrl)) {
        rejected.set(page.title, license || 'unspecified'); log.push({ title, reason: 'license', license }); continue;
      }
      rejected.delete(page.title);
      if (info.width < 400 || !/\.(jpe?g|png|webp|tiff?)$/i.test(page.title) || unsuitable(page.title, meta) || !meta.Artist || !info.thumburl) {
        log.push({ title, reason: 'Not a suitable >=400 px photograph', description: meta.ImageDescription }); continue;
      }
      const subjectText = [page.title, meta.ObjectName, meta.ImageDescription, meta.Categories].join(' ').replaceAll('_', ' ').toLowerCase();
      if (!candidate.primary && !subjectText.includes(candidate.subject.toLowerCase())) {
        log.push({ title, reason: 'Article illustration does not identify the actual place' }); continue;
      }
      // Context pages about a parent mountain/city must actually show this glacier/river.
      if ((place.id === 'zongo' && !/zongo/i.test(page.title + ' ' + meta.ImageDescription)) ||
          (place.id === 'chili' && !/chil[ií]/i.test(page.title + ' ' + meta.ImageDescription))) {
        log.push({ title, reason: 'Parent-place photo does not identify the requested feature' }); continue;
      }
      const url = new URL(info.thumburl);
      assert.ok(['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname), 'Unexpected thumbnail host');
      const input = await request(url.href, true);
      const result = spawnSync('python', ['-c', encode], { input, maxBuffer: 20 * 1024 * 1024, windowsHide: true });
      assert.equal(result.status, 0, result.stderr?.toString() || result.error?.message);
      await save(new URL(`img/photos/${place.id}.jpg`, root), result.stdout);
      return { file: `img/photos/${place.id}.jpg`, title: page.title.replace(/^File:/, ''), page: info.descriptionurl,
        author: meta.Artist, license, license_url: licenseUrl, attribution: `Photo: ${meta.Artist}, ${license}, via Wikimedia Commons` };
    }
  }
  return null;
}

async function placesNow() {
  const catalog = await json(new URL('data/catalog.json', root));
  const rivers = await json(new URL('data/rivers.json', root));
  const places = new Map();
  for (const p of [...catalog.places, ...rivers.places]) places.set(p.id, { ...places.get(p.id), ...p });
  return [...places.values()];
}

export async function validate() {
  const data = await json(manifest);
  assert.ok(Number.isFinite(Date.parse(data.generated)), 'Missing generated date');
  const ids = new Set((await placesNow()).map(p => p.id));
  let total = 0;
  for (const [id, photo] of Object.entries(data.photos)) {
    assert.ok(ids.has(id), `Unknown place ${id}`);
    assert.match(id, /^[a-z0-9_-]+$/);
    assert.equal(photo.file, `img/photos/${id}.jpg`);
    const bytes = await readFile(new URL(photo.file, root));
    assert.ok(bytes.length > 0 && bytes.length <= maxBytes, `${id}: invalid size ${bytes.length}`);
    assert.ok(bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217, `${id}: not JPEG`);
    assert.ok(allowedLicense(photo.license, photo.license_url), `${id}: disallowed license`);
    assert.ok(photo.author?.trim() && photo.attribution?.trim() && photo.title?.trim(), `${id}: missing credit`);
    assert.equal(photo.attribution, `Photo: ${photo.author}, ${photo.license}, via Wikimedia Commons`);
    assert.match(photo.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    total += bytes.length;
  }
  console.log(`Validated ${Object.keys(data.photos).length} photos; ${total} bytes.`);
  return { count: Object.keys(data.photos).length, total_bytes: total };
}

async function main() {
  await mkdir(cache, { recursive: true });
  await mkdir(new URL('img/photos/', root), { recursive: true });
  const data = await json(manifest, { generated: new Date().toISOString(), photos: {} });
  const state = await json(stateFile, { places: {}, rejected_license: {} });
  for (const [title, license] of Object.entries(state.rejected_license)) {
    if (!/^(?:CC BY(?:-SA)? \d+\.\d+(?: [a-z-]+)?|CC0(?: 1\.0)?|Public domain)$/i.test(license)) rejected.set(title, license);
  }
  async function processPlaces() {
    const facts = (await json(new URL('data/place_facts.json', root))).facts;
    const places = await placesNow();
    await prefetch(places);
    for (const place of places) {
      assert.match(place.id, /^[a-z0-9_-]+$/);
      const fingerprint = JSON.stringify([7, place, facts[place.id]?.one_line_source, facts[place.id]?.country_source]);
      const previous = state.places[place.id];
      const photo = data.photos[place.id];
      const exists = photo && await stat(new URL(photo.file, root)).then(s => s.size > 0 && s.size <= maxBytes).catch(() => false);
      if (previous?.fingerprint === fingerprint && !previous.error && (photo ? exists : true)) continue;
      const log = [];
      try {
        const selected = await photoFor(place, facts[place.id], log);
        if (selected) data.photos[place.id] = selected;
        else {
          delete data.photos[place.id];
          if (photo) await unlink(new URL(`img/photos/${place.id}.jpg`, root)).catch(e => { if (e.code !== 'ENOENT') throw e; });
        }
        state.places[place.id] = { fingerprint, found: Boolean(selected), candidates: log };
        console.log(`${place.id}: ${selected ? selected.title : 'no suitable photo'}`);
      } catch (e) {
        state.places[place.id] = { fingerprint, error: e.message, candidates: log };
        console.warn(`${place.id}: ${e.message}`);
      }
      data.generated = new Date().toISOString();
      state.rejected_license = Object.fromEntries(rejected);
      await save(manifest, JSON.stringify(data, null, 2) + '\n');
      await save(stateFile, JSON.stringify(state, null, 2) + '\n');
    }
  }
  await processPlaces();
  while (true) {
    try { await access(new URL('data/catalog.ready', root)); break; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    console.log('Waiting 60 seconds for data/catalog.ready ...');
    await pause(60000);
  }
  await processPlaces();
  const totals = await validate();
  const places = await placesNow();
  const missing = places.filter(p => !data.photos[p.id]).map(p => p.id);
  const errors = Object.entries(state.places).filter(([, p]) => p.error).map(([id, p]) => ({ id, error: p.error }));
  const report = { generated: data.generated, places: places.length, with_photo: totals.count, without_photo: missing.length,
    rejected_by_license: rejected.size, total_bytes: totals.total_bytes, missing, errors };
  await save(new URL('report.json', cache), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
}

function selfTest() {
  for (const name of ['CC BY 4.0', 'CC BY-SA 3.0', 'CC0 1.0', 'Public domain']) {
    const url = name === 'Public domain' ? '' : name === 'CC0 1.0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : `https://creativecommons.org/licenses/${name.includes('-SA') ? 'by-sa/3.0' : 'by/4.0'}/`;
    assert.ok(allowedLicense(name, url));
  }
  for (const name of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'GFDL', 'Fair use', '']) assert.ok(!allowedLicense(name, ''));
  assert.ok(allowedLicense('CC BY-SA 3.0 igo', 'https://creativecommons.org/licenses/by-sa/3.0/igo/'));
  assert.ok(!allowedLicense('CC BY 4.0', 'https://creativecommons.org/licenses/by-nc/4.0/'));
  assert.equal(metadata({ Artist: { value: '<a>Alice &amp; Bob</a> &#169; <i>Studio</i>' } }).Artist, 'Alice & Bob © Studio');
  assert.equal(metadata({ Artist: { value: '<a>José Müller</a>' } }).Artist, 'José Müller');
  assert.ok(unsuitable('File:River map.jpg', {}));
  assert.ok(unsuitable('File:1848 Schooners.jpg', { Categories: 'Paintings by Taras Shevchenko|Artworks' }));
  assert.ok(unsuitable('File:NorthSlopeGeologicCrossSection.png', {}));
  assert.ok(!unsuitable('File:Coropuna.jpg', { ImageDescription: 'Mountain seen from the valley' }));
  assert.ok(!unsuitable('File:Jakobshavn Calving Front.jpg', { ImageDescription: 'Aircraft instruments map the ice.' }));
  assert.deepEqual(wikipediaSource({ coord_source: 'https://en.wikipedia.org/w/index.php?title=Amazon_River&oldid=1' }), { host: 'en.wikipedia.org', title: 'Amazon_River' });
  assert.equal(pageForTitle({ query: { normalized: [{ from: 'File:old_name.jpg', to: 'File:Old name.jpg' }], redirects: [{ from: 'File:Old name.jpg', to: 'File:New name.jpg' }], pages: [{ title: 'File:New name.jpg', pageid: 1 }] } }, 'File:old_name.jpg').pageid, 1);
  console.log('Photo license, metadata, screening and source self-checks passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes('--self-test')) selfTest();
    else if (process.argv.includes('--validate')) await validate();
    else await main();
  } catch (e) { console.error(e); process.exitCode = 1; }
}
