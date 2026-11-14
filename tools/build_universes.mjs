import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const cache = new URL('./.cache/wikidata/', import.meta.url);
const agent = 'TrendDetective/1.0 (NASA Space Apps educational geographic catalog; public data research)';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let lastRequest = 0;

export async function sourceJson(url) {
  await mkdir(cache, { recursive: true });
  const file = new URL(createHash('sha256').update(url).digest('hex') + '.json', cache);
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.ok(!process.argv.includes('--cache-only'), `Missing cached source: ${url}`);
  for (let attempt = 0; attempt < 4; attempt++) {
    await pause(Math.max(0, 6500 - (Date.now() - lastRequest)));
    lastRequest = Date.now();
    let delay = 10000 * 2 ** attempt;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': agent, Accept: 'application/json' }, signal: AbortSignal.timeout(90000) });
      delay = Math.max(delay, Number(r.headers.get('retry-after')) * 1000 || 0);
      if (!r.ok) {
        const body = await r.text();
        await writeFile(new URL(createHash('sha256').update(url).digest('hex') + '.error.json', cache), JSON.stringify({ url, retrieved: new Date().toISOString(), status: r.status, body }));
        throw new Error(`HTTP ${r.status}: ${body.slice(-1000)}`);
      }
      const row = { url, retrieved: new Date().toISOString(), body: await r.json() };
      assert.ok(!row.body.error, JSON.stringify(row.body.error));
      await writeFile(file, JSON.stringify(row));
      return row;
    } catch (error) {
      console.warn(`Source retry ${attempt + 1}: ${error.message}`);
      if (attempt === 3) throw error;
      await pause(delay);
    }
  }
}

export const sparql = query => sourceJson('https://query.wikidata.org/sparql?' + new URLSearchParams({ query, format: 'json' }));
const typed = classes => `VALUES ?class { ${classes.split(' ').map(q => 'wd:' + q).join(' ')} } ?item wdt:P31 ?class .`;
const size = (property, minimum) => `?item wdt:${property} ?size . FILTER(?size >= ${minimum})`;
const notable = n => `?item wikibase:sitelinks ?links . FILTER(?links >= ${n})`;
const ecoregions = pattern => `?item wdt:P1294 ?wwf; rdfs:label ?regionLabel . FILTER(LANG(?regionLabel)="en" && REGEX(?regionLabel,"${pattern}","i"))`;

export const definitions = {
  lake: ['Natural lakes with recorded area >=100 km2 (reservoirs excluded)', `${size('P2046', 100)} ${typed('Q23397')} FILTER NOT EXISTS { ?item wdt:P31 wd:Q131681 }`],
  volcano: ['Volcanoes with a Smithsonian Global Volcanism Program number (P1886)', '?item wdt:P1886 ?gvp .'],
  glacier: ['Glaciers and ice caps with recorded area >=10 km2', `${typed('Q35666 Q878077')} ${size('P2046', 10)}`],
  city: ['Cities with a recorded population >=1,000,000 (Wikidata truthy values; boundaries and census dates vary)', `?item wdt:P1082 ?population . FILTER(?population >= 1000000) ${typed('Q515')}`],
  river: ['Rivers with recorded length >=1,000 km; selection additionally requires a cited mouth or existing gauge', `?item wdt:P2043 ?size . FILTER(?size >= 1000) ${typed('Q4022')} ?item p:P2043 ?statement . ?statement ps:P2043 ?size; psv:P2043/wikibase:quantityUnit wd:Q828224 .`],
  desert: ['Named deserts with at least 10 Wikimedia sitelinks', `${typed('Q8514')} ${notable(10)}`],
  rainforest: ['Named rainforests, including WWF-coded ecoregions named rain forest/rainforest/moist forest, with at least 5 Wikimedia sitelinks', `{ { ${typed('Q9444')} } UNION { ${ecoregions('rain.?forest|moist forest')} } } ${notable(5)}`],
  savanna: ['Named savannas and tropical grasslands, including WWF-coded ecoregions named savanna/savannah, with at least 5 Wikimedia sitelinks', `{ { ${typed('Q42320 Q1290693')} } UNION { ${ecoregions('savanna')} } } ${notable(5)}`],
  wetland: ['Ramsar sites with a Ramsar Sites Information Service ID (P2525) and recorded area >=1,000 km2', `?item wdt:P2525 ?ramsar . ${size('P2046', 1000)}`],
  coral_reef: ['Named coral reefs with at least 5 Wikimedia sitelinks', `${typed('Q11292')} ${notable(5)}`],
  tundra: ['Named tundra regions, including WWF-coded ecoregions named tundra, with at least 5 Wikimedia sitelinks', `{ { ${typed('Q43262')} } UNION { ${ecoregions('tundra')} } } ${notable(5)}`],
  coast: ['Capes and peninsulas with at least 30 Wikimedia sitelinks', `${typed('Q185113 Q34763')} ${notable(30)}`],
  ocean: ['Named seas and oceans with at least 20 Wikimedia sitelinks', `${typed('Q165 Q9430')} ${notable(20)}`],
  polar: ['Research stations at or beyond 66.5 degrees latitude with at least 10 Wikimedia sitelinks', `${typed('Q195339')} ${notable(10)} FILTER(ABS(geof:latitude(?coord)) >= 66.5)`],
};

export async function buildUniverses() {
  const report = { generated: new Date().toISOString(), endpoint: 'https://query.wikidata.org/sparql', license: 'CC0-1.0', universes: {} };
  for (const [kind, [description, criterion]] of Object.entries(definitions)) {
    let expanded = criterion, classQuery;
    const roots = criterion.match(/VALUES \?class \{ ([^}]+) \}/)?.[1];
    if (roots) {
      classQuery = `SELECT DISTINCT ?class WHERE { VALUES ?root { ${roots} } ?class wdt:P279* ?root } ORDER BY ?class`;
      const classes = (await sparql(classQuery)).body.results.bindings.map(b => 'wd:' + qid(b.class.value));
      const direct = ['city', 'river', 'lake'].includes(kind) ? `?item wdt:P31 ?class . FILTER(?class IN (${classes.join(', ')}))` : `VALUES ?class { ${classes.join(' ')} } ?item wdt:P31 ?class .`;
      const pattern = /VALUES \?class \{ [^}]+ \} \?item wdt:P31 \?class \./;
      expanded = criterion.replace(pattern, direct);
    }
    const minimum = { lake: 100, glacier: 10, wetland: 1000 }[kind];
    if (minimum) expanded += ` ?item p:P2046 ?statement . ?statement ps:P2046 ?size; psv:P2046/wikibase:quantityUnit ?unit . FILTER((?unit=wd:Q712226 && ?size>=${minimum}) || (?unit=wd:Q35852 && ?size>=${minimum * 100}) || (?unit=wd:Q25343 && ?size>=${minimum * 1000000}))`;
    const optimizer = ['rainforest', 'savanna', 'tundra'].includes(kind) ? '' : 'hint:Query hint:optimizer "None" .';
    const query = `SELECT DISTINCT ?item WHERE { ${optimizer} ${expanded} ?item wdt:P625 ?coord; rdfs:label ?label . ?item p:P625/psv:P625/wikibase:geoGlobe wd:Q2 . FILTER(LANG(?label) = "en") } ORDER BY ?item`;
    assert.equal((query.match(/\{/g) ?? []).length, (query.match(/\}/g) ?? []).length, `${kind}: unbalanced query`);
    const row = await sparql(query);
    const ids = row.body.results.bindings.map(b => b.item.value.split('/').at(-1));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.length, `${kind}: empty universe; inspect the definition`);
    report.universes[kind] = { universe_description: description + '; instance-of classes include subclasses. Earth coordinates and English label required. Area statements use km2, hectares or m2. This is a Wikidata inventory, not an exhaustive inventory of Earth.', query, class_query: classQuery, retrieved: row.retrieved, N: ids.length, ids };
    await writeFile(new URL('universes.json', cache), JSON.stringify(report, null, 2) + '\n');
    console.log(`${kind}: N=${ids.length}`);
  }
  return report;
}

export async function entities(ids) {
  const result = {};
  ids = [...new Set(ids)].sort();
  for (const id of ids) {
    try { result[id] = JSON.parse(await readFile(new URL(`entity_${id}.json`, cache), 'utf8')).entity; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  ids = ids.filter(id => !result[id]);
  for (let i = 0; i < ids.length; i += 50) {
    const row = await sourceJson('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'info|labels|descriptions|claims|sitelinks', languages: 'en', format: 'json' }));
    Object.assign(result, row.body.entities);
    for (const entity of Object.values(row.body.entities)) await writeFile(new URL(`entity_${entity.id}.json`, cache), JSON.stringify({ retrieved: row.retrieved, url: row.url, entity }));
    console.log(`Entities: ${Math.min(i + 50, ids.length)}/${ids.length}`);
  }
  return result;
}

const claims = (e, p) => {
  const rows = (e?.claims?.[p] ?? []).filter(c => c.rank !== 'deprecated' && !c.qualifiers?.P582);
  return rows.some(c => c.rank === 'preferred') ? rows.filter(c => c.rank === 'preferred') : rows;
};
const values = (e, p) => claims(e, p).map(c => c.mainsnak.datavalue?.value).filter(v => v !== undefined);
const label = e => e?.labels?.en?.value;
const qid = uri => uri.split('/').at(-1);
const earthPoint = e => values(e, 'P625').find(c => c.globe?.endsWith('/Q2') && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180);
const saCountries = new Set(['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'FK', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE']);
const continents = { Q15: 'Africa', Q48: 'Asia', Q46: 'Europe', Q49: 'North America', Q18: 'South America', Q538: 'Oceania', Q55643: 'Oceania', Q51: 'Antarctica' };

export function distance(a, b) {
  const rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function quantity(e, property, units) {
  const nums = values(e, property).filter(v => units[qid(v.unit)] !== undefined).map(v => Number(v.amount) * units[qid(v.unit)]).filter(n => Number.isFinite(n) && n >= 0);
  return nums.length ? Math.max(...nums) : undefined;
}

function metadata(e, countries, kind, old) {
  const coord = earthPoint(e);
  if (!coord && !old) return null;
  const nations = values(e, 'P17').map(v => countries[v.id]).filter(c => c && label(c) && !values(c, 'P576').length);
  const codes = [...new Set(nations.flatMap(c => values(c, 'P297'))) ].sort();
  let continent = values(e, 'P30').map(v => continents[v.id]).filter(Boolean);
  if (!continent.length) continent = [...new Set(nations.flatMap(c => values(c, 'P30').map(v => continents[v.id])).filter(Boolean))];
  const lat = old?.lat ?? coord.latitude, lon = old?.lon ?? coord.longitude;
  if (lat <= -60) continent = ['Antarctica'];
  if (codes.includes('FR') && lat >= -5 && lat <= 10 && lon >= -60 && lon <= -45) continent = ['South America'];
  if (!continent.length && codes.some(c => saCountries.has(c))) continent = ['South America'];
  if (!continent.length && kind === 'ocean') continent = ['Ocean'];
  if (!continent.length) continent = values(e, 'P30').map(v => continents[v.id]).filter(Boolean);
  const country = nations.length ? [...new Set(nations.map(label))].sort().join('; ') : lat <= -60 ? 'Antarctica (no sovereign country)' : kind === 'ocean' || Math.abs(lat) === 90 ? 'International waters' : null;
  return { ...old, name: old?.name ?? label(e), short: old?.short ?? label(e), lat, lon, environment: old?.environment ?? kind,
    wikidata: e.id, coord_source: old?.coord_source ?? `https://www.wikidata.org/wiki/${e.id}#P625`, country: lat <= -60 ? 'Antarctica (no sovereign country)' : country, country_codes: lat <= -60 ? ['AQ'] : codes,
    continent: continent.join('; '), ...(quantity(e, 'P2046', { Q712226: 1, Q25343: 1e-6, Q35852: 0.01 }) !== undefined ? { area_km2: quantity(e, 'P2046', { Q712226: 1, Q25343: 1e-6, Q35852: 0.01 }) } : {}),
    ...(quantity(e, 'P1082', { '1': 1 }) !== undefined ? { population: quantity(e, 'P1082', { '1': 1 }) } : {}),
    ...(quantity(e, 'P2043', { Q828224: 1, Q11573: 0.001 }) !== undefined ? { length_km: quantity(e, 'P2043', { Q828224: 1, Q11573: 0.001 }) } : {}) };
}

async function legacyEntities(places, facts) {
  const pending = places.filter(p => !p.wikidata);
  const titles = pending.map(p => {
    const src = new URL(facts[p.id].one_line_source);
    return src.searchParams.get('title') ?? decodeURIComponent(src.pathname.replace('/wiki/', '').replaceAll('_', ' '));
  });
  const mapping = Object.fromEntries(places.filter(p => p.wikidata).map(p => [p.id, p.wikidata]));
  for (let i = 0; i < titles.length; i += 20) {
    const row = await sourceJson('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', prop: 'pageprops', titles: titles.slice(i, i + 20).join('|'), redirects: 1, format: 'json' }));
    const pages = new Map(Object.values(row.body.query.pages).map(p => [p.title, p.pageprops?.wikibase_item]));
    for (const redirect of row.body.query.redirects ?? []) pages.set(redirect.from, pages.get(redirect.to));
    titles.slice(i, i + 20).forEach((title, j) => { mapping[pending[i + j].id] = pages.get(title); });
  }
  // These legacy text citations describe a host mountain/city rather than the feature.
  for (const [id, title] of [['zongo', 'Zongo Glacier'], ['chili', 'Chili River']]) {
    if (places.find(p => p.id === id)?.wikidata) continue;
    const r = await sourceJson('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbsearchentities', search: title, language: 'en', format: 'json' }));
    const exact = r.body.search.find(e => e.label?.toLowerCase() === title.toLowerCase());
    assert.ok(exact, `Missing entity: ${title}`);
    mapping[id] = exact.id;
  }
  for (const p of places) assert.ok(/^Q\d+$/.test(mapping[p.id]), `Missing legacy entity: ${p.id}`);
  return mapping;
}

function qualifiedMouth(e) {
  const claim = (e.claims?.P625 ?? []).find(c => c.rank !== 'deprecated' &&
    c.qualifiers?.P518?.some(q => ['Q1233637', 'Q723748'].includes(q.datavalue?.value?.id)) &&
    c.mainsnak.datavalue?.value?.globe?.endsWith('/Q2'));
  if (!claim) return null;
  const coord = claim.mainsnak.datavalue.value;
  assert.ok(Number.isFinite(coord.latitude) && Math.abs(coord.latitude) <= 90 && Number.isFinite(coord.longitude) && Math.abs(coord.longitude) <= 180);
  return { lat: coord.latitude, lon: coord.longitude, coord_source: `https://www.wikidata.org/wiki/${e.id}#P625`,
    sampling_point: 'Wikidata coordinate explicitly qualified as river mouth or confluence; NASA POWER climate here, not discharge.' };
}

async function riverMouth(e) {
  const mouth = qualifiedMouth(e);
  if (mouth) return mouth;
  const title = e.sitelinks?.enwiki?.title;
  if (!title) return null;
  const row = await sourceJson('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', titles: title, redirects: 1, format: 'json' }));
  const page = Object.values(row.body.query.pages)[0], rev = page.revisions?.[0];
  if (!rev) return null;
  const { mouthCoordinate } = await import('./fetch_rivers.mjs');
  try {
    const [lat, lon] = mouthCoordinate(rev.slots.main['*']);
    return { lat, lon, sampling_point: 'Published river mouth; NASA POWER climate at this point, not river discharge.',
      coord_source: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${rev.revid}` };
  } catch { return null; }
}

export async function expandCatalog(report) {
  assert.equal(Object.keys(report.universes).length, Object.keys(definitions).length, 'Finish all universe queries before catalog selection');
  const data = name => new URL(`../data/${name}.json`, import.meta.url);
  const catalog = JSON.parse(await readFile(data('catalog'), 'utf8'));
  const curatedNames = new Map(catalog.places.filter(p => p.name_source).map(p => [p.wikidata, p]));
  const rivers = JSON.parse(await readFile(data('rivers'), 'utf8'));
  const facts = JSON.parse(await readFile(data('place_facts'), 'utf8')).facts;
  // Save the initial ID/coordinate baseline once; repeated runs must not redefine it.
  let baseline;
  try { baseline = JSON.parse(await readFile(new URL('baseline.json', cache), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    baseline = { catalog: catalog.places, rivers: rivers.places };
    await writeFile(new URL('baseline.json', cache), JSON.stringify(baseline));
  }
  const originals = [...baseline.catalog, ...baseline.rivers.filter(p => !baseline.catalog.some(c => c.id === p.id))];
  const legacy = await legacyEntities(originals, facts);
  const ids = Object.values(report.universes).flatMap(u => u.ids);
  const extraIds = ['Q5513', 'Q941342', 'Q3848305', 'Q1075162', 'Q337974', 'Q946035'];
  const all = await entities([...ids, ...Object.values(legacy), ...extraIds]);
  const countryIds = Object.values(all).flatMap(e => values(e, 'P17').map(v => v.id));
  const countries = await entities(countryIds);
  const places = [], riverMetadata = {}, rejected = [];
  for (const old of originals) {
    const p = metadata(all[legacy[old.id]], countries, old.environment, old);
    assert.ok(p, old.id);
    p.country ||= facts[old.id].country;
    p.continent ||= p.country_codes.some(c => saCountries.has(c)) ? 'South America' : old.lat < -60 ? 'Antarctica' : old.environment === 'polar' ? 'Ocean' : '';
    if (baseline.rivers.some(r => r.id === p.id)) riverMetadata[p.id] = p;
    // The UI appends these IDs itself; adding them here would duplicate markers.
    const visibleRiver = old.environment === 'river' && !old.quality?.flags?.length && rivers.series[old.id];
    if (!visibleRiver) places.push(p);
  }
  const occupied = () => [...places, ...Object.values(riverMetadata)];
  const represented = new Map(occupied().map(p => [p.wikidata, p]));
  const byQ = q => represented.get(q);
  const coverage = { generated: new Date().toISOString(), source: 'Wikidata Query Service, CC0-1.0', endpoint: report.endpoint,
    scope: 'Percentages apply only to the documented Wikidata query inventories, not all natural features on Earth. Existing sampling points retain their original coordinate citations. River mouth coordinates cite Wikipedia revisions.',
    kinds: {}, existing_river_metadata: riverMetadata, rejected };
  const add = async (q, kind) => {
    if (byQ(q)) return true;
    const e = all[q], p = metadata(e, countries, kind);
    if (!p || !p.country || !p.continent) { rejected.push({ wikidata: q, kind, reason: 'Missing usable coordinates, country, or continent' }); return false; }
    if (kind === 'river') {
      const mouth = await riverMouth(e);
      if (!mouth) { rejected.push({ wikidata: q, kind, reason: 'No parsable published mouth coordinate' }); return false; }
      Object.assign(p, mouth);
    }
    const near = occupied().find(other => distance(p, other) < 5);
    if (near) { rejected.push({ wikidata: q, kind, reason: 'Within 5 km of an existing sampling point', near: near.id }); return false; }
    p.id = label(e).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || q.toLowerCase();
    if (occupied().some(other => other.id === p.id)) p.id += '_' + q.toLowerCase();
    const curated = curatedNames.get(q);
    if (curated) Object.assign(p, { id: curated.id, name: curated.name, short: curated.short, name_source: curated.name_source });
    places.push(p);
    represented.set(q, p);
    return true;
  };
  for (const [kind, u] of Object.entries(report.universes)) {
    const candidates = u.ids.map(q => metadata(all[q], countries, kind)).filter(Boolean);
    candidates.sort((a, b) => (b.area_km2 ?? b.population ?? b.length_km ?? Object.keys(all[b.wikidata].sitelinks ?? {}).length) - (a.area_km2 ?? a.population ?? a.length_km ?? Object.keys(all[a.wikidata].sitelinks ?? {}).length) || a.wikidata.localeCompare(b.wikidata));
    const mandatory = kind === 'lake' ? ['Q5513', 'Q941342', 'Q3848305'] : kind === 'volcano' ? ['Q1075162', 'Q337974', 'Q946035'] : [];
    const wanted = new Set([...mandatory, ...candidates.filter(p => p.country_codes.some(c => saCountries.has(c)) || p.continent.split('; ').includes('South America')).map(p => p.wikidata)]);
    for (const q of wanted) await add(q, kind);
    const count = () => u.ids.filter(q => byQ(q));
    const memberContinents = [...new Set(candidates.flatMap(p => p.continent.split('; ').filter(Boolean)))];
    for (const continent of memberContinents) {
      if (count().some(q => byQ(q).continent.split('; ').includes(continent))) continue;
      for (const p of candidates.filter(p => p.continent.split('; ').includes(continent))) if (await add(p.wikidata, kind)) break;
    }
    for (const p of candidates) { if (count().length >= Math.ceil(0.2 * u.N)) break; await add(p.wikidata, kind); }
    const includedIds = count();
    coverage.kinds[kind] = { ...u, ids: undefined, included: includedIds.length, percent: 100 * includedIds.length / u.N,
      members: u.ids, included_wikidata: includedIds, required_south_american: [...wanted].filter(q => u.ids.includes(q)), continents: memberContinents };
    console.log(`Selected ${kind}: ${includedIds.length}/${u.N} (${coverage.kinds[kind].percent.toFixed(2)}%)`);
    await writeFile(new URL('selection_progress.json', cache), JSON.stringify({ places, coverage }, null, 2));
  }
  for (const p of places) {
    const entity = all[p.wikidata];
    let text = entity.descriptions?.en?.value?.replace(/\bstratovolcano\b/gi, 'volcano').replace(/\bsubmarine volcano\b/gi, 'underwater volcano').replace(/\becoregion\b/gi, 'natural region');
    if (!text || text.trim().split(/\s+/).length > 14) text = `This ${p.environment.replaceAll('_', ' ')} is in ${p.country.split('; ')[0]}.`;
    if (text.split(/\s+/).length > 14) text = `This place is in ${p.country.split('; ')[0]}.`;
    p.context_description = text[0].toUpperCase() + text.slice(1);
    p.context_source = `https://www.wikidata.org/wiki/Special:EntityData/${p.wikidata}.json?revision=${entity.lastrevid}`;
  }
  // Later selections can also belong to earlier universes (for example a lake in a wetland).
  for (const row of Object.values(coverage.kinds)) {
    row.included_wikidata = row.members.filter(q => byQ(q));
    row.included = row.included_wikidata.length;
    row.percent = 100 * row.included / row.N;
  }
  catalog.places = places;
  catalog.generated = coverage.generated;
  catalog.coordinate_evidence = Object.fromEntries(places.map(p => [p.id, { ...catalog.coordinate_evidence?.[p.id], place: p, citation: `Published coordinate: ${p.coord_source}`, wikidata_entity: p.wikidata }]));
  coverage.total = { N: Object.values(coverage.kinds).reduce((n, k) => n + k.N, 0), included: Object.values(coverage.kinds).reduce((n, k) => n + k.included, 0), places: places.length, existing_visible_rivers: Object.values(riverMetadata).filter(p => !p.quality?.flags?.length && rivers.series[p.id]).length };
  coverage.total.percent = coverage.total.included / coverage.total.N * 100;
  const uniqueMembers = [...new Set(Object.values(coverage.kinds).flatMap(row => row.members))];
  coverage.total.unique_N = uniqueMembers.length;
  coverage.total.unique_included = uniqueMembers.filter(q => byQ(q)).length;
  coverage.total.unique_percent = 100 * coverage.total.unique_included / coverage.total.unique_N;
  coverage.total.note = 'N and included are sums of kind memberships; a place can belong to more than one universe. places counts unique catalog entries.';
  assert.ok(Object.values(coverage.kinds).every(k => k.included >= Math.ceil(0.2 * k.N)), 'Coverage below 20%');
  assert.equal(new Set(places.map(p => p.id)).size, places.length, 'Curated names must retain unique place IDs');
  await writeFile(data('catalog'), JSON.stringify(catalog, null, 2) + '\n');
  await writeFile(data('coverage'), JSON.stringify(coverage, null, 2) + '\n');
}

function selfTest() {
  assert.equal(distance({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
  assert.ok(distance({ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }) < 5);
  assert.ok(distance({ lat: 0, lon: 179.99 }, { lat: 0, lon: -179.99 }) < 5);
  assert.ok(distance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) > 100);
  assert.equal(quantity({ claims: { P2046: [{ mainsnak: { datavalue: { value: { amount: '+1000000', unit: 'http://www.wikidata.org/entity/Q25343' } } } }] } }, 'P2046', { Q25343: 1e-6 }), 1);
  const coordinate = (lat, part) => ({ mainsnak: { datavalue: { value: { latitude: lat, longitude: 1, globe: 'http://www.wikidata.org/entity/Q2' } } }, qualifiers: { P518: [{ datavalue: { value: { id: part } } }] } });
  assert.equal(qualifiedMouth({ id: 'Q1', claims: { P625: [coordinate(10, 'Q7376362'), coordinate(20, 'Q1233637')] } }).lat, 20);
  assert.equal(qualifiedMouth({ claims: { P625: [coordinate(10, 'Q7376362')] } }), null);
  console.log('Universe self-checks passed (distance, date line, units).');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  selfTest();
  if (!process.argv.includes('--self-test')) {
    const report = process.argv.includes('--select') ? JSON.parse(await readFile(new URL('universes.json', cache), 'utf8')) : await buildUniverses();
    if (process.argv.includes('--select')) await expandCatalog(report);
  }
}
