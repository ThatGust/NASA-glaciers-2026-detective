import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { getJson as cachedJson, pointUrl, mapLimited } from './power_api.mjs';
import { getPowerJson } from './place_facts.mjs';
const getJson = url => url.startsWith('https://power.larc.nasa.gov/') ? getPowerJson(url) : cachedJson(url);

const placesOnly = process.argv.includes('--places-only');
const existingCatalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url)));
const existingEvidence = JSON.parse(await readFile(new URL('./catalog_checks.json', import.meta.url)));

const candidates = [
  ['T2M', 'Air temperature', 'Heat', 'The average air temperature two meters above the ground.'],
  ['T2M_MAX', 'Monthly high temperature', 'Heat', 'The highest hourly air temperature in each month, measured two meters above the surface.'],
  ['T2M_MIN', 'Monthly low temperature', 'Heat', 'The lowest hourly air temperature in each month, measured two meters above the surface.'],
  ['TS', 'Surface temperature', 'Heat', 'The temperature of the surface itself, rather than the air above it.'],
  ['PRECTOTCORR', 'Precipitation', 'Water', 'The average water falling as rain and snow each day, with a correction for measurement bias.'],
  ['EVLAND', 'Land evaporation', 'Water', 'The water that returns to the air from land and plants each day.'],
  ['GWETTOP', 'Topsoil wetness', 'Water', 'How wet the upper soil layer is, from zero for dry to one for saturated.'],
  ['GWETROOT', 'Root-zone wetness', 'Water', 'How wet the soil around plant roots is, from zero for dry to one for saturated.'],
  ['SNODP', 'Snow depth', 'Water', 'The depth of snow covering the land surface.'],
  ['RH2M', 'Relative humidity', 'Air', 'The water vapor in the air as a percentage of what it could hold at that temperature.'],
  ['QV2M', 'Specific humidity', 'Air', 'The mass of water vapor in each kilogram of air two meters above the ground.'],
  ['ALLSKY_SFC_SW_DWN', 'Sunlight at the surface', 'Sun and clouds', 'The solar energy reaching the surface each day, including the effect of clouds.'],
  ['CLOUD_AMT', 'Cloud cover', 'Sun and clouds', 'The percentage of the sky covered by clouds.'],
  ['WS2M', 'Wind speed', 'Air', 'How fast the wind blows two meters above the ground.'],
  ['AOD_55', 'Aerosol optical depth', 'Air', 'How much airborne dust, smoke, and other particles weaken light at a wavelength of 550 nanometers.'],
];
const list = placesOnly ? { status: 200, body: {} } : await getJson('https://power.larc.nasa.gov/api/system/manager/parameters?user=x&community=AG&temporal=MONTHLY');
assert.equal(list.status, 200);
const imerg = Object.entries(list.body).filter(([id, meta]) =>
  /GPM|IMERG/i.test(id + ' ' + meta.definition) && /precipitation/i.test(meta.name + ' ' + meta.definition));
for (const [id] of imerg) candidates.push([id, 'Satellite precipitation', 'Water', 'The average rain and snow falling each day, estimated from the IMERG satellite product.']);

const periods = [[1981, 1982], [1999, 2000], [2001, 2002], [2023, 2024]];
const checks = placesOnly ? [] : await mapLimited(candidates, async ([id]) => {
  const metadata = await getJson(`https://power.larc.nasa.gov/api/system/manager/parameters/${id}`);
  const probes = [];
  for (const [start, end] of periods) probes.push(await getJson(pointUrl(id, -15.55, -72.65, start, end)));
  const ocean = await getJson(pointUrl(id, 0, -140, 2023, 2024));
  console.log(`Probed ${id}: ${probes.map(p => p.body.header?.sources?.join('+') ?? p.status).join(', ')}`);
  return { id, metadata, probes, ocean };
});
const locations = [
  ['coropuna', 'Nevado Coropuna (Peru)', 'Coropuna', 'glacier', 'Coropuna'],
  ['quelccaya', 'Quelccaya Ice Cap (Peru)', 'Quelccaya', 'glacier', 'Quelccaya Ice Cap'],
  ['huascaran', 'Huascaran (Peru)', 'Huascaran', 'glacier', 'Huascarán'],
  ['zongo', 'Zongo Glacier (Bolivia)', 'Zongo', 'glacier', 'Zongo Glacier'],
  ['chimborazo', 'Chimborazo (Ecuador)', 'Chimborazo', 'glacier', 'Chimborazo'],
  ['perito-moreno', 'Perito Moreno Glacier (Argentina)', 'Perito Moreno', 'glacier', 'Perito Moreno Glacier'],
  ['columbia', 'Columbia Glacier (Alaska, USA)', 'Columbia', 'glacier', 'Columbia Glacier (Alaska)'],
  ['jakobshavn', 'Jakobshavn Glacier (Greenland)', 'Jakobshavn', 'glacier', 'Jakobshavn Glacier'],
  ['aletsch', 'Aletsch Glacier (Switzerland)', 'Aletsch', 'glacier', 'Aletsch Glacier'],
  ['kilimanjaro', 'Mount Kilimanjaro (Tanzania)', 'Kilimanjaro', 'glacier', 'Mount Kilimanjaro'],
  ['khumbu', 'Khumbu Glacier (Nepal)', 'Khumbu', 'glacier', 'Khumbu Glacier'],
  ['puncak-jaya', 'Puncak Jaya (Indonesia)', 'Puncak Jaya', 'glacier', 'Puncak Jaya'],
  ['atacama', 'Atacama Desert (Chile)', 'Atacama', 'desert', 'Atacama Desert'],
  ['sahara', 'Sahara (North Africa)', 'Sahara', 'desert', 'Sahara'],
  ['gobi', 'Gobi Desert (Asia)', 'Gobi', 'desert', 'Gobi Desert'],
  ['amazon', 'Amazon rainforest (South America)', 'Amazon', 'rainforest', 'Amazon rainforest'],
  ['congo', 'Salonga rainforest (DR Congo)', 'Salonga', 'rainforest', 'Salonga National Park'],
  ['daintree', 'Daintree Rainforest (Australia)', 'Daintree', 'rainforest', 'Daintree Rainforest'],
  ['arequipa', 'Arequipa (Peru)', 'Arequipa', 'city', 'Arequipa'],
  ['tokyo', 'Tokyo (Japan)', 'Tokyo', 'city', 'Tokyo'],
  ['london', 'London (United Kingdom)', 'London', 'city', 'London'],
  ['cape_good_hope', 'Cape of Good Hope (South Africa)', 'Cape of Good Hope', 'coast', 'Cape of Good Hope'],
  ['cape_horn', 'Cape Horn (Chile)', 'Cape Horn', 'coast', 'Cape Horn'],
  ['cape_byron', 'Cape Byron (Australia)', 'Cape Byron', 'coast', 'Cape Byron'],
  ['pacific', 'Pacific Ocean', 'Pacific', 'ocean', 'Pacific Ocean'],
  ['atlantic', 'Atlantic Ocean', 'Atlantic', 'ocean', 'Atlantic Ocean'],
  ['indian', 'Indian Ocean', 'Indian', 'ocean', 'Indian Ocean'],
  ['north_pole', 'North Pole', 'North Pole', 'polar', 'North Pole'],
  ['south_pole', 'South Pole', 'South Pole', 'polar', 'South Pole'],
  ['vostok', 'Vostok Station (Antarctica)', 'Vostok', 'polar', 'Vostok Station'],
];
locations.push(
  ["lake_titicaca","Lake Titicaca (Peru and Bolivia)","Titicaca","lake","Lake Titicaca"],
  ["aral_sea","Aral Sea (Kazakhstan and Uzbekistan)","Aral Sea","lake","Aral Sea"],
  ["lake_chad","Lake Chad (Central Africa)","Lake Chad","lake","Lake Chad"],
  ["el_misti","El Misti (Arequipa, Peru)","El Misti","volcano","Misti"],
  ["etna","Mount Etna (Italy)","Etna","volcano","Mount Etna"],
  ["mauna_loa","Mauna Loa (Hawaii, USA)","Mauna Loa","volcano","Mauna Loa"],
  ["serengeti","Serengeti (Tanzania and Kenya)","Serengeti","savanna","Serengeti"],
  ["cerrado","Cerrado (Brazil)","Cerrado","savanna","Cerrado"],
  ["sahel","Sahel (Africa)","Sahel","savanna","Sahel"],
  ["yamal","Yamal Peninsula (Russia)","Yamal","tundra","Yamal Peninsula"],
  ["alaska_north_slope","Alaska North Slope (USA)","North Slope","tundra","Alaska North Slope"],
  ["baffin_island","Baffin Island (Canada)","Baffin Island","tundra","Baffin Island"],
  ["great_barrier_reef","Great Barrier Reef (Davies Reef, Australia)","Davies Reef","coral_reef","Great Barrier Reef"],
  ["glovers_reef","Glover's Reef (Belize)","Glover's Reef","coral_reef","Glover's Reef"],
  ["elphinstone_reef","Elphinstone Reef (Red Sea, Egypt)","Elphinstone Reef","coral_reef","Elphinstone Reef"],
  ["pantanal","Pantanal (South America)","Pantanal","wetland","Pantanal"],
  ["sundarbans","Sundarbans (Bangladesh and India)","Sundarbans","wetland","Sundarbans"],
  ["okavango","Okavango Delta (Botswana)","Okavango","wetland","Okavango Delta"]
);
const uncited = locations.filter(p => p[0] !== 'zongo' && !existingCatalog.places.some(old => old.id === p[0]));
const coordinateBatch = !uncited.length ? { status: 200, body: { query: { pages: {} } } } : await getJson(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({
  action: 'query', prop: 'coordinates|info|pageprops', inprop: 'url', coprimary: 'primary',
  colimit: 'max', redirects: '1', titles: uncited.map(p => p[4]).join('|'), format: 'json',
})}`);
assert.equal(coordinateBatch.status, 200);
const coordinateEvidence = await mapLimited(locations, async ([id, name, short, environment, title]) => {
  const original = existingCatalog.places.find(p => p.id === id);
  if (original) return existingCatalog.coordinate_evidence?.[id] ?? existingEvidence.coordinateEvidence.find(row => row.place.id === id);
  if (id === 'great_barrier_reef') return {
    place: { id, name, short, lat: -(18 + 49 / 60), lon: 147 + 38 / 60, environment, coord_source: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5971101/' },
    citation: 'Methods: Davies Reef (18 degrees 49 minutes S, 147 degrees 38 minutes E), a mid-shelf platform reef in the central Great Barrier Reef.',
  };
  if (id === 'zongo') return {
    place: { id, name, short, lat: -16.25, lon: -68.17, environment, coord_source: 'https://user.geo.uzh.ch/mzemp/Docs/WGMS_GGCB_05.pdf' },
    citation: 'WGMS Global Glacier Change Bulletin No. 5 (2020-2021), section 4.5, printed page 66: 16.25 degrees S / 68.17 degrees W.',
  };
  const page = Object.values(coordinateBatch.body.query.pages).find(p => p.title === title);
  assert.ok(page, `Page not found: ${title}`);
  const response = { url: coordinateBatch.url, retrieved: coordinateBatch.retrieved, page };
  let coord = page.coordinates?.[0];
  let coord_source = page.fullurl;
  let wikidata;
  if (!coord) {
    const qid = page.pageprops?.wikibase_item;
    assert.ok(qid, `No linked coordinate source: ${title}`);
    const entity = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
    const claims = entity.body.entities[qid].claims.P625;
    const claim = claims?.find(c => c.rank === 'preferred') ?? claims?.find(c => c.rank !== 'deprecated');
    const value = claim?.mainsnak.datavalue?.value;
    assert.ok(value, `No published coordinate: ${title}`);
    coord = { lat: value.latitude, lon: value.longitude };
    coord_source = `https://www.wikidata.org/wiki/${qid}#P625`;
    wikidata = { url: entity.url, retrieved: entity.retrieved, claim };
  }
  return { place: { id, name, short, lat: coord.lat, lon: coord.lon, environment, coord_source }, response, wikidata };
});

const variables = placesOnly ? existingCatalog.variables : [];
for (const [id, name, group, definition] of (placesOnly ? [] : candidates)) {
  const check = checks.find(c => c.id === id);
  const current = check.probes.at(-1);
  assert.equal(current.status, 200, `${id}: current probe failed`);
  const source = current.body.header.sources.filter(s => s !== 'POWER').join(' + ');
  if (!source) { check.excluded = 'Monthly endpoint advertises this parameter but returns only fill and no source; no usable current monthly product.'; continue; }
  // Query across the record, then locate the first complete year of the current product.
  const startProbe = await getJson(pointUrl(id, -15.55, -72.65, source === 'SYN1DEG' ? 2001 : 1981, 2024));
  check.start_probe = startProbe;
  assert.equal(startProbe.status, 200, `${id}: start probe failed`);
  const monthly = startProbe.body.properties.parameter[id];
  const years = [...new Set(Object.keys(monthly).map(k => +k.slice(0, 4)))].sort((a, b) => a - b);
  const first = years.find(y => Array.from({ length: 12 }, (_, m) => monthly[`${y}${String(m + 1).padStart(2, '0')}`]).every(v => Number.isFinite(v) && v !== startProbe.body.header.fill_value));
  assert.ok(first, `${id}: no complete year`);
  const sourcePeriods = check.probes.map(p => ({ period: [+(new URL(p.url)).searchParams.get('start'), +(new URL(p.url)).searchParams.get('end')], status: p.status, sources: p.body.header?.sources ?? [], messages: p.body.messages ?? [] }));
  const oceanValues = Object.values(check.ocean.body.properties?.parameter?.[id] ?? {});
  assert.equal(check.ocean.status, 200, `${id}: ocean probe failed`);
  const oceanAllFill = oceanValues.length > 0 && oceanValues.every(v => v === check.ocean.body.header.fill_value);
  // POWER returns constant 1 over the ocean for GWETTOP, but its definition explicitly describes soil.
  const land_only = oceanAllFill || id === 'GWETTOP';
  check.current_source = source;
  check.current_start = first;
  check.land_only = land_only;
  if (first > 2005) { check.excluded = 'Current source starts after 2005'; continue; }
  variables.push({ id, name, group, definition, power_definition: check.metadata.body[id].temporal.MONTHLY.definition,
    units: current.body.parameters[id].units, source, start: first, land_only,
    notes: `${oceanAllFill ? 'All monthly values at the open-ocean test point are fill. ' : ''}${id === 'GWETTOP' ? 'The ocean test returns constant 1 rather than fill; this is a soil variable and ocean values must not be interpreted. ' : ''}Annual values are the unweighted mean of 12 complete monthly means; years crossing product boundaries are excluded.`,
    source_periods: sourcePeriods,
  });
}
const limits = [];
const limitParameters = [...candidates.map(c => c[0]), 'PS', 'T2MDEW', 'PRECSNO', 'WS10M', 'GWETPROF', 'T2MWET', 'TO3', 'TQV', 'TROPPB', 'U10M', 'V10M'];
for (const count of (placesOnly ? [] : [10, 11, 20, 21, 25, 26])) limits.push(await getJson(pointUrl(limitParameters.slice(0, count).join(','), -15.55, -72.65, 2023, 2024)));
const catalog = { generated: new Date().toISOString().slice(0, 10), variables, places: coordinateEvidence.map(c => c.place),
  coordinate_evidence: Object.fromEntries(coordinateEvidence.filter(c => !existingEvidence.coordinateEvidence.some(old => old.place.id === c.place.id)).map(c => [c.place.id, c])) };
assert.equal(catalog.places.length, 48);
for (const environment of new Set(catalog.places.map(p => p.environment))) assert.ok(catalog.places.filter(p => p.environment === environment).length >= 3);
await writeFile(new URL('../data/catalog.json', import.meta.url), JSON.stringify(catalog, null, 2) + '\n');
if (placesOnly) { console.log(`Catalog: ${variables.length} variables, ${catalog.places.length} cited places (existing places preserved).`); process.exit(0); }
const suppliedListEndpoint = await getJson('https://power.larc.nasa.gov/api/system/manager/parameters?user=x');
await writeFile(new URL('./catalog_checks.json', import.meta.url), JSON.stringify({
  list: { url: list.url, retrieved: list.retrieved, status: list.status, parameter_count: Object.keys(list.body).length, precipitation_candidates: Object.fromEntries(imerg) },
  suppliedListEndpoint, source_documentation: 'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/',
  checks, coordinateEvidence, limits,
}, null, 2) + '\n');
console.log(`Catalog: ${variables.length} variables, ${catalog.places.length} places; limits: ${limits.map(p => p.status).join(', ')}`);
