import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { analyze, annualSeriesFromPower } from '../engine.js';
import { getJson, pointUrl } from './power_api.mjs';

const cache = new URL('./.cache/', import.meta.url);
const output = new URL('../data/place_facts.json', import.meta.url);
const lastYear = new Date().getUTCFullYear() - 1;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let lastRequest = 0, powerQueue = Promise.resolve();

// Share the existing URL-hash cache, but serialize every POWER request, including retries.
export function getPowerJson(url) {
  const task = powerQueue.catch(() => {}).then(async () => {
    await mkdir(cache, { recursive: true });
    const file = new URL(`${createHash('sha256').update(url).digest('hex')}.json`, cache);
    try {
      const hit = JSON.parse(await readFile(file, 'utf8'));
      if (hit.status !== 429 && hit.status < 500) return hit;
    } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    for (let attempt = 0; attempt < 6; attempt++) {
      await pause(Math.max(0, 2100 - (Date.now() - lastRequest)));
      lastRequest = Date.now();
      let delay = 2000 * 2 ** attempt;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(90000),
          headers: { 'User-Agent': 'TrendDetective/1.0 (educational place facts)' } });
        if (response.status === 429 || response.status >= 500) {
          const retry = response.headers.get('retry-after');
          delay = Math.max(delay, 10000, Number(retry) * 1000 || Date.parse(retry) - Date.now() || 0);
          throw new Error(`NASA POWER HTTP ${response.status}`);
        }
        const result = { url, retrieved: new Date().toISOString(), status: response.status, body: await response.json() };
        await writeFile(file, JSON.stringify(result));
        return result;
      } catch (error) {
        if (attempt === 5) throw error;
        console.warn(`POWER retry ${attempt + 1}: ${error.message}; waiting ${delay} ms`);
        await pause(delay);
      }
    }
  });
  powerQueue = task;
  return task;
}

// Original short paraphrases; the generator pins each cited Wikipedia revision.
const descriptions = [
  ['coropuna', 'Peru', 'Coropuna', 'An ice cap covers this volcano in the Peruvian Andes.'],
  ['quelccaya', 'Peru', 'Quelccaya Ice Cap', 'This large tropical ice cap lies in the Peruvian Andes.'],
  ['huascaran', 'Peru', 'Huascarán', 'This mountain has the highest summit in Peru.'],
  ['zongo', 'Bolivia', 'Huayna Potosí', 'This glacier lies on the mountain Huayna Potosi in Bolivia.'],
  ['chimborazo', 'Ecuador', 'Chimborazo', "Its summit is the farthest surface point from Earth's center."],
  ['perito-moreno', 'Argentina', 'Perito Moreno Glacier', 'This glacier flows into Lake Argentino in Patagonia.'],
  ['columbia', 'United States', 'Columbia Glacier (Alaska)', 'This Alaskan glacier flows into the sea at Prince William Sound.'],
  ['jakobshavn', 'Greenland (Kingdom of Denmark)', 'Jakobshavn Glacier', 'This Greenland glacier sends icebergs into Ilulissat Icefjord.'],
  ['aletsch', 'Switzerland', 'Aletsch Glacier', 'This is the largest glacier in the Alps.'],
  ['kilimanjaro', 'Tanzania', 'Mount Kilimanjaro', "Africa's highest mountain has glaciers near its summit."],
  ['khumbu', 'Nepal', 'Khumbu Glacier', 'This Himalayan glacier lies between Mount Everest and the Lhotse-Nuptse ridge.'],
  ['puncak-jaya', 'Indonesia', 'Puncak Jaya', "This mountain is the highest peak on the island of New Guinea."],
  ['atacama', 'Chile', 'Atacama Desert', 'This desert lies between the Andes and the Pacific Ocean.'],
  ['sahara', 'Algeria; Chad; Egypt; Libya; Mali; Mauritania; Morocco; Niger; Sudan; Tunisia; Western Sahara', 'Sahara', 'This is the largest hot desert on Earth.'],
  ['gobi', 'China; Mongolia', 'Gobi Desert', 'This cold desert stretches across northern China and southern Mongolia.'],
  ['amazon', 'Brazil; Bolivia; Peru; Ecuador; Colombia; Venezuela; Guyana; Suriname; French Guiana', 'Amazon rainforest', 'This rainforest covers much of the Amazon basin in South America.'],
  ['congo', 'Democratic Republic of the Congo', 'Salonga National Park', "This national park protects a large area of Africa's tropical rainforest."],
  ['daintree', 'Australia', 'Daintree Rainforest', 'This tropical rainforest grows on the northeastern coast of Australia.'],
  ['arequipa', 'Peru', 'Arequipa', 'This Peruvian city lies near the volcano El Misti.'],
  ['tokyo', 'Japan', 'Tokyo', "This city is Japan's capital on the island of Honshu."],
  ['london', 'United Kingdom', 'London', 'This capital city stands on the River Thames.'],
  ['cape_good_hope', 'South Africa', 'Cape of Good Hope', 'This rocky headland lies at the southern end of the Cape Peninsula.'],
  ['cape_horn', 'Chile', 'Cape Horn', 'This headland marks the northern edge of the Drake Passage.'],
  ['cape_byron', 'Australia', 'Cape Byron', "This headland is the easternmost point of mainland Australia."],
  ['pacific', 'International waters', 'Pacific Ocean', 'This is the largest and deepest ocean on Earth.'],
  ['atlantic', 'International waters', 'Atlantic Ocean', 'This ocean lies between the Americas, Europe, and Africa.'],
  ['indian', 'International waters', 'Indian Ocean', 'This ocean lies between Africa, Asia, Australia, and Antarctica.'],
  ['north_pole', 'International waters', 'North Pole', 'This point lies on floating sea ice in the Arctic Ocean.'],
  ['south_pole', 'Antarctica (no sovereign country)', 'South Pole', 'This point lies on the Antarctic ice sheet.'],
  ['vostok', 'Antarctica (no sovereign country)', 'Vostok Station', 'This research station stands above a lake buried beneath Antarctic ice.'],
  ['lake_titicaca', 'Peru; Bolivia', 'Lake Titicaca', 'This large Andean lake lies on the border between Peru and Bolivia.'],
  ['aral_sea', 'Kazakhstan; Uzbekistan', 'Aral Sea', 'This lake shrank after rivers feeding it were diverted for irrigation.'],
  ['lake_chad', 'Chad; Cameroon; Niger; Nigeria', 'Lake Chad', 'This shallow lake changes size as its water level rises and falls.'],
  ['el_misti', 'Peru', 'Misti', 'This volcano rises above Arequipa and has two nested summit craters.'],
  ['etna', 'Italy', 'Mount Etna', 'This active volcano stands on the island of Sicily.'],
  ['mauna_loa', 'United States', 'Mauna Loa', 'This Hawaiian volcano has broad, gently sloping sides built by lava.'],
  ['serengeti', 'Tanzania; Kenya', 'Serengeti', 'These grasslands host large seasonal migrations of wildebeest and other animals.'],
  ['cerrado', 'Brazil; Bolivia; Paraguay', 'Cerrado', 'This tropical savanna covers much of central Brazil.'],
  ['sahel', 'Senegal; Mauritania; Mali; Burkina Faso; Niger; Nigeria; Cameroon; Chad; Sudan; Eritrea', 'Sahel', 'This dry savanna forms a transition between the Sahara and wetter grasslands.'],
  ['yamal', 'Russia', 'Yamal Peninsula', 'This Siberian peninsula extends into the Kara Sea.'],
  ['alaska_north_slope', 'United States', 'Alaska North Slope', 'This Arctic region lies north of the Brooks Range in Alaska.'],
  ['baffin_island', 'Canada', 'Baffin Island', 'This is the largest island in Canada.'],
  ['great_barrier_reef', 'Australia', 'Great Barrier Reef', 'Coral animals built this reef system off the coast of Queensland.'],
  ['glovers_reef', 'Belize', "Glover's Reef", 'This partly submerged coral atoll lies off the coast of Belize.'],
  ['elphinstone_reef', 'Egypt', 'Elphinstone Reef', 'This Red Sea reef has many soft corals.'],
  ['pantanal', 'Brazil; Bolivia; Paraguay', 'Pantanal', 'Seasonal floods cover much of this large tropical wetland.'],
  ['sundarbans', 'Bangladesh; India', 'Sundarbans', 'Tidal channels wind through this mangrove forest in the Ganges Delta.'],
  ['okavango', 'Botswana', 'Okavango Delta', 'This river delta spreads inland instead of flowing into the sea.'],
  ['amazon_river', 'Brazil (catalog point)', 'Amazon River', 'This river carries more water than any other river.'],
  ['congo_river', 'Democratic Republic of the Congo; Angola (catalog point)', 'Congo River', 'This river crosses the equator twice before reaching the Atlantic Ocean.'],
  ['yangtze_river', 'China (catalog point)', 'Yangtze', 'This is the longest river in Asia.'],
  ['mississippi_river', 'United States (catalog point)', 'Mississippi River', 'This river flows south through the United States to the Gulf of Mexico.'],
  ['niger_river', 'Nigeria (catalog point)', 'Niger River', 'This river bends through West Africa before reaching the Gulf of Guinea.'],
  ['yenisei_river', 'Russia (catalog point)', 'Yenisei', 'This Siberian river flows north into the Arctic Ocean.'],
  ['lena_river', 'Russia (catalog point)', 'Lena River', 'This Siberian river forms a large delta at the Laptev Sea.'],
  ['ob_river', 'Russia (catalog point)', 'Ob', 'This Siberian river flows into the Gulf of Ob.'],
  ['mackenzie_river', 'Canada (catalog point)', 'Mackenzie River', 'This river flows through northwestern Canada into the Arctic Ocean.'],
  ['parana_river', 'Argentina (catalog point)', 'Paraná River', 'This river joins the Paraguay River before reaching the Rio de la Plata.'],
  ['danube_river', 'Romania (catalog point)', 'Danube', 'This river flows through central and southeastern Europe to the Black Sea.'],
  ['ganges_river', 'India (catalog point)', 'Ganges', 'This river flows from the Himalayas across northern India into Bangladesh.'],
  ['mekong_river', 'Thailand; Laos (catalog point)', 'Mekong', 'This river flows through six countries in East and Southeast Asia.'],
  ['murray_river', 'Australia (catalog point)', 'Murray River', 'This river flows through southeastern Australia to the Southern Ocean.'],
  ['rhine_river', 'Germany (catalog point)', 'Rhine', 'This river flows from the Swiss Alps toward the North Sea.'],
  ['majes_camana', 'Peru (catalog point)', 'Colca River', 'This Andean river is called Camana near the Pacific Ocean.'],
  ['chili', 'Peru (catalog point)', 'Arequipa', 'This river flows through the city of Arequipa.'],
];

export async function allPlaces() {
  const [catalog, rivers] = await Promise.all(['catalog', 'rivers'].map(async name =>
    JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)))));
  const places = [...catalog.places, ...rivers.places];
  assert.equal(new Set(places.map(p => p.id)).size, places.length);
  return { catalog, places };
}

async function powerCache() {
  const rows = [];
  for (const file of await readdir(cache)) {
    if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
    try {
      const row = JSON.parse(await readFile(new URL(file, cache), 'utf8'));
      if (row.status === 200 && row.url?.includes('/temporal/monthly/point?')) rows.push(row);
    } catch (error) { if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error; }
  }
  return rows;
}

function matching(rows, place, parameter) {
  return rows.find(row => {
    const q = new URL(row.url).searchParams;
    return Math.abs(+q.get('latitude') - place.lat) < 1e-8 && Math.abs(+q.get('longitude') - place.lon) < 1e-8 &&
      +q.get('start') <= 1981 && +q.get('end') >= lastYear && row.body.properties?.parameter?.[parameter];
  });
}

export function baselineMean(series) {
  const values = series.values.filter((_, i) => series.years[i] >= 1991 && series.years[i] <= 2020);
  assert.equal(values.length, 30, 'Climatology requires all 30 annual means, 1991-2020');
  assert.ok(values.every(Number.isFinite));
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function climateFacts(temperature, precipitation, catalog) {
  for (const [response, id] of [[temperature, 'T2M'], [precipitation, 'PRECTOTCORR']]) {
    assert.equal(response.status, 200);
    for (const [key, value] of Object.entries(response.body.properties.parameter[id])) {
      const year = +key.slice(0, 4), month = +key.slice(4);
      if (year >= 1981 && year <= lastYear && month >= 1 && month <= 12)
        assert.ok(Number.isFinite(value) && value !== response.body.header.fill_value, `${id}: missing month ${key}`);
    }
  }
  const t = annualSeriesFromPower(temperature.body, [catalog.variables.find(v => v.id === 'T2M')]).T2M;
  const p = annualSeriesFromPower(precipitation.body, [catalog.variables.find(v => v.id === 'PRECTOTCORR')]).PRECTOTCORR;
  assert.equal(t.years[0], 1981);
  assert.equal(t.years.at(-1), lastYear);
  assert.equal(t.years.length, lastYear - 1981 + 1);
  assert.ok(t.values.every(Number.isFinite));
  assert.ok(p.values.every(v => Number.isFinite(v) && v >= 0));
  assert.equal(t.units, 'C');
  assert.equal(p.units, 'mm/day');
  const trend = analyze(t);
  const elevation = temperature.body.geometry?.coordinates?.[2];
  const validElevation = Number.isFinite(elevation) && elevation !== temperature.body.header.fill_value;
  return {
    elevation_m: validElevation ? elevation : null,
    elevation_label: 'NASA POWER grid elevation',
    ...(validElevation ? {} : { elevation_note: 'NASA POWER returned no grid elevation; no summit or station height was substituted.' }),
    mean_temp_c: baselineMean(t), mean_precip_mm_day: baselineMean(p),
    warming_c_per_decade: trend.slopePerDecade, warming_verdict: trend.verdict,
    climatology_period: [1991, 2020], warming_period: [t.years[0], t.years.at(-1)],
    power_sources: { T2M: { url: temperature.url, retrieved: temperature.retrieved },
      PRECTOTCORR: { url: precipitation.url, retrieved: precipitation.retrieved } },
  };
}

async function wikiPages(titles, cacheOnly) {
  const pages = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query',
      prop: 'info|extracts', inprop: 'url', exintro: '1', explaintext: '1', exlimit: '20', redirects: '1',
      titles: titles.slice(i, i + 20).join('|'), format: 'json' });
    if (cacheOnly) await readFile(new URL(`${createHash('sha256').update(url).digest('hex')}.json`, cache));
    const response = await getJson(url);
    assert.equal(response.status, 200);
    for (const page of Object.values(response.body.query.pages)) pages.set(page.title, { ...page, retrieved: response.retrieved });
    for (const redirect of response.body.query.redirects ?? []) pages.set(redirect.from, pages.get(redirect.to));
  }
  return pages;
}

export async function generateFacts(cacheOnly = false) {
  const { catalog, places } = await allPlaces();
  assert.equal(places.length, descriptions.length, 'Add a sourced description for every place');
  const pages = await wikiPages([...new Set(descriptions.map(d => d[2]))], cacheOnly);
  const rows = await powerCache(), facts = {};
  for (const place of places) {
    const description = descriptions.find(d => d[0] === place.id);
    assert.ok(description, `Missing description: ${place.id}`);
    const [, country, title, one_line] = description;
    assert.ok(one_line.split(/\s+/).length <= 14, `${place.id}: description exceeds 14 words`);
    const page = pages.get(title);
    assert.ok(page?.lastrevid && page.extract?.length, `${place.id}: missing Wikipedia text: ${title}`);
    const missing = ['T2M', 'PRECTOTCORR'].filter(id => !matching(rows, place, id));
    if (missing.length) {
      assert.ok(!cacheOnly, `${place.id}: missing cached POWER ${missing}`);
      rows.push(await getPowerJson(pointUrl(missing.join(','), place.lat, place.lon, 1981, lastYear)));
    }
    facts[place.id] = { country, ...climateFacts(matching(rows, place, 'T2M'), matching(rows, place, 'PRECTOTCORR'), catalog),
      one_line, one_line_source: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${page.lastrevid}`,
      country_source: page.fullurl, wikipedia_retrieved: page.retrieved };
    console.log(`Facts: ${place.id}${missing.length ? ' (POWER downloaded)' : ' (POWER cache)'}`);
  }
  return { generated: new Date().toISOString().slice(0, 10), source: {
    climate: 'NASA POWER / MERRA-2 monthly point API; grid climate, not site measurements or river discharge.',
    methods: 'Annual values: unweighted means of 12 complete monthly means, using engine.annualSeriesFromPower. Climatology: mean of all 30 annual values, 1991-2020. Warming: engine.analyze T2M, Sen slope per decade and Hamed-Rao Mann-Kendall verdict, 1981 through the last complete calendar year. Each place is tested separately; no multiple-testing adjustment.',
    documentation: 'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/',
    text: 'Original paraphrases of the cited Wikipedia revisions; CC BY-SA 4.0. Country lists describe whole features, except river countries explicitly refer to catalog points.',
    text_license: 'https://creativecommons.org/licenses/by-sa/4.0/',
  }, facts };
}

function selfTest() {
  const years = Array.from({ length: 45 }, (_, i) => 1981 + i);
  assert.equal(baselineMean({ years, values: years.map(y => y - 1981) }), 24.5);
  assert.throws(() => baselineMean({ years: [1991], values: [1] }), /30 annual/);
  assert.throws(() => baselineMean({ years, values: years.map(() => NaN) }));
  const recordYears = Array.from({ length: lastYear - 1981 + 1 }, (_, i) => 1981 + i);
  const monthly = id => Object.fromEntries(recordYears.flatMap(y => Array.from({ length: 12 }, (_, i) =>
    [`${y}${String(i + 1).padStart(2, '0')}`, id === 'T2M' ? (y - 1981) / 10 : 2])));
  const response = { status: 200, body: { header: { fill_value: -999, sources: ['MERRA2'] },
    geometry: { coordinates: [0, 0, 123] }, parameters: { T2M: { units: 'C' }, PRECTOTCORR: { units: 'mm/day' } },
    properties: { parameter: { T2M: monthly('T2M'), PRECTOTCORR: monthly('PRECTOTCORR') } } } };
  const catalog = { variables: [{ id: 'T2M', start: 1981 }, { id: 'PRECTOTCORR', start: 1981 }] };
  {
    const fact = climateFacts(response, response, catalog);
    assert.equal(fact.elevation_m, 123);
    assert.equal(fact.mean_precip_mm_day, 2);
    assert.ok(Math.abs(fact.warming_c_per_decade - 1) < 1e-10);
    response.body.properties.parameter.T2M['198101'] = null;
    assert.throws(() => climateFacts(response, response, catalog), /missing month/);
  }
  for (const row of descriptions) assert.ok(row[3].split(/\s+/).length <= 14, row[0]);
  assert.equal(new Set(descriptions.map(row => row[0])).size, descriptions.length);
  console.log('Place-facts self-check passed.');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  selfTest();
  if (!process.argv.includes('--self-test')) {
    const result = await generateFacts(process.argv.includes('--check'));
    if (process.argv.includes('--check')) {
      const saved = JSON.parse(await readFile(output, 'utf8'));
      assert.deepEqual(result.facts, saved.facts);
      console.log(`Reproduced all ${Object.keys(result.facts).length} facts from cached sources.`);
    } else await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  }
}
