// Signal or Noise UI: ties the form, NASA POWER and the engine together. Data formats: see README.
import { createClassroom } from './classroom.js';
import { alibiTest, analyze, blockShuffle, lunarIndex, lunarTest, LUNAR_MIN_YEARS, projection, compareWitnesses, fetchPower, fetchPowerMany, predictionTest, scan } from './engine.js';

// Built-in fallback catalog. data/catalog.json (verified sources, more variables and places) replaces it when present.
let VARIABLES = [
  { id: 'T2M', name: 'Temperature', group: 'Heat', definition: 'How warm the air is, 2 m above the ground.', source: 'MERRA-2' },
  { id: 'T2M_MAX', name: 'Maximum temperature', group: 'Heat', definition: 'The warmest temperature of each day, averaged.', source: 'MERRA-2' },
  { id: 'PRECTOTCORR', name: 'Precipitation', group: 'Water', definition: 'How much water falls (rain and snow), per day.', source: 'MERRA-2' },
  { id: 'GWETROOT', name: 'Soil moisture', group: 'Water', definition: 'How wet the soil is where roots drink (0 dry, 1 saturated).', source: 'MERRA-2' },
  { id: 'RH2M', name: 'Air humidity', group: 'Water', definition: 'How much water vapor the air holds, relative to its maximum.', source: 'MERRA-2' },
  // From 2001 only: earlier years come from a different product (SRB), and splicing both creates false trends.
  { id: 'ALLSKY_SFC_SW_DWN', name: 'Solar radiation', group: 'Sun and clouds', definition: 'How much energy from the Sun reaches the ground.', source: 'CERES SYN1deg', start: 2001 },
  { id: 'WS2M', name: 'Wind', group: 'Air', definition: 'How fast the air moves, 2 m above the ground.', source: 'MERRA-2' },
];
// Approximate coordinates; NASA POWER averages a ~50 km cell anyway.
let PLACES = [
  ['coropuna', 'Nevado Coropuna (Peru)', 'Coropuna', -15.53, -72.65],
  ['quelccaya', 'Quelccaya Ice Cap (Peru)', 'Quelccaya', -13.93, -70.82],
  ['huascaran', 'Huascarán, Cordillera Blanca (Peru)', 'Huascarán', -9.12, -77.6],
  ['zongo', 'Zongo Glacier (Bolivia)', 'Zongo', -16.27, -68.14],
  ['chimborazo', 'Chimborazo (Ecuador)', 'Chimborazo', -1.47, -78.82],
  ['perito-moreno', 'Perito Moreno, Patagonia (Argentina)', 'Perito Moreno', -50.5, -73.05],
  ['columbia', 'Columbia Glacier (Alaska, USA)', 'Columbia', 61.15, -147.1],
  ['jakobshavn', 'Jakobshavn Glacier (Greenland)', 'Jakobshavn', 69.17, -49.83],
  ['aletsch', 'Aletsch Glacier, Alps (Switzerland)', 'Aletsch', 46.44, 8.07],
  ['kilimanjaro', 'Kilimanjaro (Tanzania)', 'Kilimanjaro', -3.07, 37.35],
  ['khumbu', 'Khumbu Glacier, Everest (Nepal)', 'Khumbu', 27.98, 86.85],
  ['puncak-jaya', 'Puncak Jaya glaciers (Indonesia)', 'Puncak Jaya', -4.08, 137.18],
].map(([id, name, short, lat, lon]) => ({ id, name, short, lat, lon, environment: 'glacier' }));
let DEMOS = [];
let INDICES = null; // data/indices.json: NOAA climate indices for the alibi test
let WITNESSES = null; // data/witnesses.json: second, independent source (ERA5) for catalog places

// Where a detective could start, by kind of place (fixed rules, no AI): what usually changes there and why.
const SUGGESTIONS = {
  glacier: [['T2M', 'SNODP', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN'], 'ice responds to warmth, snowfall and sunlight'],
  desert: [['AOD_55', 'GWETTOP', 'T2M_MAX', 'PRECTOTCORR'], 'dust, dry soil and extreme heat shape deserts'],
  rainforest: [['PRECTOTCORR', 'GWETROOT', 'EVLAND', 'T2M'], 'forests live on rain, soil water and evaporation'],
  city: [['T2M_MIN', 'T2M', 'AOD_55', 'RH2M'], 'cities trap heat at night and add particles to the air'],
  coast: [['T2M', 'WS2M', 'PRECTOTCORR', 'RH2M'], 'coasts feel the sea through wind, humidity and rain'],
  ocean: [['T2M', 'WS2M', 'CLOUD_AMT', 'PRECTOTCORR'], 'over the sea, air temperature, wind and clouds tell the story'],
  polar: [['T2M', 'SNODP', 'CLOUD_AMT', 'ALLSKY_SFC_SW_DWN'], 'the poles warm fastest, and snow and clouds respond'],
  river: [['PRECTOTCORR', 'EVLAND', 'GWETROOT', 'T2M'], 'rivers carry what rain leaves after evaporation and soil take their share'],
  lake: [['PRECTOTCORR', 'EVLAND', 'T2M', 'RH2M'], 'a lake grows or shrinks with rain, evaporation and heat'],
  volcano: [['AOD_55', 'T2M', 'PRECTOTCORR', 'CLOUD_AMT'], 'eruptions add haze, and high slopes respond to heat and rain'],
  savanna: [['PRECTOTCORR', 'GWETROOT', 'T2M_MAX', 'EVLAND'], 'grasslands depend on the rainy season and soil water'],
  tundra: [['T2M', 'SNODP', 'TS', 'GWETTOP'], 'frozen ground thaws when air and ground warm'],
  coral_reef: [['T2M', 'ALLSKY_SFC_SW_DWN', 'CLOUD_AMT', 'WS2M'], 'reefs bleach when warm, sunny, calm water lasts too long'],
  wetland: [['PRECTOTCORR', 'GWETTOP', 'EVLAND', 'T2M'], 'wetlands live on the balance of rain and evaporation'],
};
SUGGESTIONS.river ??= SUGGESTIONS.lake;
// Kinds of place (natural phenomena) with a colour used for the filter dots.
const ENVIRONMENTS = { glacier: 'Glaciers', polar: 'Polar', tundra: 'Tundra', volcano: 'Volcanoes', desert: 'Deserts', savanna: 'Savannas',
  rainforest: 'Rainforests', wetland: 'Wetlands', lake: 'Lakes', river: 'Rivers', coast: 'Coasts', coral_reef: 'Coral reefs', ocean: 'Oceans', city: 'Cities' };
const KIND_COLOR = { glacier: '#cfefff', polar: '#ffffff', tundra: '#9fd3c7', volcano: '#ff6b4a', desert: '#e8c27a', savanna: '#c9b458',
  rainforest: '#3ddc97', wetland: '#5fc9a0', lake: '#4d9bff', river: '#3aa0ff', coast: '#7fd6ff', coral_reef: '#ff8fb1', ocean: '#2b6cff', city: '#b9b9c9' };
// Plain-language names for students; the technical name stays in the details.
const PLAIN = { T2M: 'Air temperature', T2M_MAX: 'Monthly highs', T2M_MIN: 'Monthly lows', TS: 'Ground temperature', PRECTOTCORR: 'Rain and snow',
  EVLAND: 'Evaporation', GWETTOP: 'Topsoil moisture', GWETROOT: 'Root soil moisture', SNODP: 'Snow depth', RH2M: 'Humidity', QV2M: 'Water vapor',
  ALLSKY_SFC_SW_DWN: 'Sunlight', CLOUD_AMT: 'Cloud cover', WS2M: 'Wind', AOD_55: 'Haze (dust and smoke)',
  T850: 'Air temperature 1.5 km up', T500: 'Air temperature 5.5 km up', T250: 'Air temperature 10 km up', TO3: 'Ozone layer', TQV: 'Water vapor in the sky',
  T850_AIRS: 'Air temperature 1.5 km up (satellite)', T500_AIRS: 'Air temperature 5.5 km up (satellite)', TO3_AIRS: 'Ozone layer (satellite)',
  TQV_AIRS: 'Water vapor in the sky (satellite)', RUNOFF: 'Water running off the land', EVAP: 'Evaporation from land and plants', SOILMOI: 'Topsoil water' };
let FACTS = {};
const VERDICTS = {
  confirmed: { label: '● Confirmed', text: 'A real change: very unlikely to be chance.' },
  likely: { label: '◐ Likely', text: 'Signs of a change, but not enough to be sure.' },
  unknown: { label: '○ Not yet known', text: 'Too early to tell this apart from normal ups and downs.' },
};
const UNITS = { C: '°C', 'mm/day': 'mm/day', 'MJ/m^2/day': 'MJ/m²/day', 1: '', 'g/kg': 'g/kg', '%': '%', 'm/s': 'm/s', cm: 'cm', kPa: 'kPa', dimensionless: '', days: 'days', 'm3/s': 'm³/s', 'kg C/m2/yr': 'kg C/m²/yr' };

const $ = (id) => document.getElementById(id);
// Place names, descriptions and photo credits come from Wikidata/Commons: escape them before building HTML.
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (x, d = 2) => x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
// Slopes can be tiny (aerosols: 0.003 per decade), so show at least two significant digits.
const fmtSlope = (x) => { const a = Math.abs(x); return a === 0 || a >= 0.1 ? fmt(x) : x.toLocaleString('en-US', { maximumSignificantDigits: 2 }); };
const signed = (x) => (x > 0 ? '+' : '') + fmtSlope(x);
const unitOf = (s) => UNITS[s.units] ?? s.units;
const SOURCES = { MERRA2: 'MERRA-2', SYN1DEG: 'CERES SYN1deg' };
const sourceOf = (v) => (EXTRA_VARS.includes(v) || v.source.includes(' via ') ? v.source : `NASA POWER · ${SOURCES[v.source] ?? v.source}`);
// Extra variables (precomputed, catalog places only) are looked up too, but never offered for live cases.
// Precomputed variables from other datasets (MODIS, river discharge, Meteomatics), for catalog places only.
let EXTRA = {}, EXTRA_VARS = [];
const varById = (id) => VARIABLES.find((v) => v.id === id) ?? EXTRA_VARS.find((v) => v.id === id);
let current = null;        // the case being shown: { variable, place, series, r }
let compareWith = null;    // first case of a comparison, while the user picks the second place
let leads = null;          // last scan result

// --- Full-screen globe: NASA GIBS imagery, no API keys needed. ---
let viewer = null, marker = null;
const C = window.Cesium;
try {
  const gibs = new C.WebMapTileServiceImageryProvider({
    // shortcut: Blue Marble tops out at ~600 m/pixel, so close-ups are blurry; add Landsat or MODIS layers later.
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{TileMatrix}/{TileRow}/{TileCol}.jpeg',
    layer: 'BlueMarble_ShadedRelief_Bathymetry', style: 'default', tileMatrixSetID: 'GoogleMapsCompatible_Level8', format: 'image/jpeg', maximumLevel: 8,
  });
  viewer = new C.Viewer('globe', {
    baseLayer: new C.ImageryLayer(gibs), baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
  });
  viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(-60, -10, 22000000) });
  marker = viewer.entities.add({
    position: C.Cartesian3.fromDegrees(-72.65, -15.53),
    point: { pixelSize: 12, color: C.Color.fromCssColorString('#00d4ff'), outlineColor: C.Color.BLACK, outlineWidth: 1 },
  });
  // Clicking a place dot selects it; clicking anywhere else on the globe picks that point.
  new C.ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction((e) => {
    if (location.hash.startsWith('#/global')) return openCell(e.position);
    if (!location.hash.startsWith('#/case')) return;
    const id = viewer.scene.pick(e.position)?.id?.id;
    if (typeof id === 'string' && id.startsWith('place:')) return selectPlace(id.slice(6));
    const p = viewer.camera.pickEllipsoid(e.position);
    if (!p) return;
    const g = C.Cartographic.fromCartesian(p);
    selectedPlace = null;
    setPoint(+C.Math.toDegrees(g.latitude).toFixed(2), +C.Math.toDegrees(g.longitude).toFixed(2));
    renderPlaces();
  }, C.ScreenSpaceEventType.LEFT_CLICK);
} catch (e) {
  console.warn('Globe unavailable:', e);
  viewer = null;
  $('no3d').hidden = false;
}

function drawPlaceDots() {
  if (!viewer) return;
  viewer.entities.values.filter((e) => String(e.id).startsWith('place:')).forEach((e) => viewer.entities.remove(e));
  for (const p of PLACES) viewer.entities.add({
    id: `place:${p.id}`, position: C.Cartesian3.fromDegrees(p.lon, p.lat),
    point: { pixelSize: 7, color: C.Color.fromCssColorString(KIND_COLOR[p.environment] ?? '#ffffff'), outlineColor: C.Color.BLACK, outlineWidth: 1.5 },
    // The label sits above the dot (bottom-anchored with a gap) and only appears when the camera is close enough.
    label: { text: p.short, font: '600 13px Inter, sans-serif', verticalOrigin: C.VerticalOrigin.BOTTOM, pixelOffset: new C.Cartesian2(0, -12),
             fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.fromCssColorString('rgba(10,10,15,.88)'),
             backgroundPadding: new C.Cartesian2(6, 3), show: false },
  });
  labelOnly(selectedPlace);
}

// Labels: only the selected place and the one under the pointer, so 900 names never pile up.
let hoverId = null;
function labelOnly(...ids) {
  if (!viewer) return;
  for (const e of viewer.entities.values) if (String(e.id).startsWith('place:')) e.label.show = ids.includes(String(e.id).slice(6));
}
if (viewer) new C.ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction((m) => {
  const id = viewer.scene.pick(m.endPosition)?.id?.id;
  const next = typeof id === 'string' && id.startsWith('place:') ? id.slice(6) : null;
  if (next !== hoverId) { hoverId = next; labelOnly(selectedPlace, hoverId); }
}, C.ScreenSpaceEventType.MOUSE_MOVE);

function flyTo(lat, lon, height = 2500000, seconds = 3) {
  if (!viewer) return;
  const destination = C.Cartesian3.fromDegrees(lon, lat, height);
  if (reducedMotion) viewer.camera.setView({ destination });
  else viewer.camera.flyTo({ destination, duration: seconds });
}

function setPoint(lat, lon) {
  $('lat').value = lat; $('lon').value = lon;
  if (marker) marker.position = C.Cartesian3.fromDegrees(lon, lat);
}

let selectedPlace = null, kindFilter = '', page = 0;
const PER_PAGE = 4;

function selectPlace(id) {
  const p = PLACES.find((x) => x.id === id);
  if (!p) return;
  selectedPlace = p.id;
  labelOnly(p.id);
  setPoint(p.lat, p.lon);
  flyTo(p.lat, p.lon);
  fillVariables(p.environment);
  renderPlaces();
}

function renderKinds() {
  const present = Object.keys(ENVIRONMENTS).filter((k) => PLACES.some((p) => p.environment === k));
  $('kinds').innerHTML = [['', 'All'], ...present.map((k) => [k, ENVIRONMENTS[k]])].map(([k, label]) =>
    `<li><button type="button" class="chip" data-kind="${k}" aria-pressed="${k === kindFilter}">${k ? `<span class="dot" style="background:${KIND_COLOR[k]}"></span>` : ''}${label}</button></li>`).join('');
}
$('kinds').addEventListener('click', (e) => {
  const b = e.target.closest('[data-kind]');
  if (!b) return;
  kindFilter = b.dataset.kind; page = 0;
  renderKinds(); renderPlaces();
});

function factLine(p) {
  const f = FACTS[p.id];
  if (!f) return `${fmt(p.lat, 1)}°, ${fmt(p.lon, 1)}°`;
  const bits = [];
  if (f.mean_temp_c != null) bits.push(`${Math.round(f.mean_temp_c)} °C`);
  if (f.mean_precip_mm_day != null) bits.push(`${(Math.round(f.mean_precip_mm_day * 36.5) * 10).toLocaleString('en-US')} mm/yr`);
  if (f.warming_c_per_decade != null) bits.push(`${signed(f.warming_c_per_decade)} °C/dec`);
  return bits.join(' · ');
}

const countriesOf = (p) => String(p.country ?? FACTS[p.id]?.country ?? '').split(';').map((c) => c.trim()).filter(Boolean);
let countryFilter = '', searchText = '';
function fillCountries() {
  const all = [...new Set(PLACES.flatMap(countriesOf))].filter((c) => !/catalog point|international/i.test(c)).sort();
  $('country').innerHTML = `<option value="">All countries</option>${all.map((c) => `<option>${esc(c)}</option>`).join('')}`;
}
$('country').addEventListener('change', () => { countryFilter = $('country').value; page = 0; renderPlaces(); showDots(); });
$('place-search').addEventListener('input', () => { searchText = $('place-search').value.trim().toLowerCase(); page = 0; renderPlaces(); showDots(); });
// Typing "lat, lon" and pressing Enter investigates any point on Earth.
$('place-search').addEventListener('keydown', (e) => {
  const m = e.key === 'Enter' && $('place-search').value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return;
  e.preventDefault();
  const [lat, lon] = [+m[1], +m[2]];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
  selectedPlace = null; setPoint(lat, lon); flyTo(lat, lon); renderPlaces();
});
const matches = (p) => (!kindFilter || p.environment === kindFilter) && (!countryFilter || countriesOf(p).includes(countryFilter))
  && (!searchText || /^\s*-?\d/.test(searchText) || `${p.name} ${p.short} ${countriesOf(p).join(' ')}`.toLowerCase().includes(searchText));
// Dots on the globe follow the same filter, so the map shows what the list shows.
function showDots() {
  viewer?.entities.values.forEach((e) => { if (String(e.id).startsWith('place:')) e.show = !location.hash.startsWith('#/global') && matches(PLACES.find((p) => `place:${p.id}` === e.id) ?? {}); });
}

function renderPlaces() {
  const list = PLACES.filter(matches);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  $('place-cards').innerHTML = list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map((p) => `
    <button type="button" class="place" data-id="${esc(p.id)}" aria-pressed="${p.id === selectedPlace}" title="${esc(FACTS[p.id]?.one_line ?? p.name)}">
      <img src="img/places/${encodeURIComponent(p.id)}.jpg" alt="Satellite image of ${esc(p.short)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'noimg'}))">
      <span class="kind">${esc(ENVIRONMENTS[p.environment] ?? p.environment)}</span>
      <b>${esc(p.short)}</b><small>${esc(factLine(p))}</small>
    </button>`).join('');
  $('page-info').textContent = list.length ? `${page + 1} / ${pages} · ${list.length} places` : 'No place matches: try another filter';
  $('prev-page').disabled = page === 0;
  $('next-page').disabled = page >= pages - 1;
  showPop();
}

// Floating card over the globe: a photo and the key facts of the selected place.
let PHOTOS = {};
function showPop() {
  const p = PLACES.find((x) => x.id === selectedPlace), f = p && FACTS[p.id], ph = p && PHOTOS[p.id];
  $('place-pop').hidden = !location.hash.startsWith('#/case') || !$('tour').hidden;
  if (!p) {
    $('pop-img').hidden = true;
    $('pop-name').textContent = 'Selected point';
    $('pop-country').textContent = `${$('lat').value}°, ${$('lon').value}°`;
    $('pop-line').textContent = 'Any point on Earth can be investigated with NASA data.';
    $('pop-facts').textContent = ''; $('pop-credit').textContent = '';
    return;
  }
  $('pop-img').hidden = false;
  $('pop-img').src = ph ? ph.file : `img/places/${p.id}.jpg`;
  $('pop-img').alt = ph ? `Photo of ${p.short}` : `Satellite image of ${p.short}`;
  $('pop-name').textContent = p.name;
  $('pop-country').textContent = [ENVIRONMENTS[p.environment], countriesOf(p).join(', ')].filter(Boolean).join(' · ');
  $('pop-line').textContent = f?.one_line ?? '';
  $('pop-facts').textContent = f ? [f.elevation_m != null && `${Math.round(f.elevation_m).toLocaleString('en-US')} m up`, factLine(p)].filter(Boolean).join(' · ') : '';
  $('pop-credit').innerHTML = ph ? `${esc(ph.attribution)} · <a href="${esc(ph.page)}" target="_blank" rel="noopener">source</a>` : 'Satellite image: NASA Worldview (public domain)';
}
$('place-cards').addEventListener('click', (e) => { const b = e.target.closest('.place'); if (b) selectPlace(b.dataset.id); });
$('prev-page').addEventListener('click', () => { page--; renderPlaces(); });
$('next-page').addEventListener('click', () => { page++; renderPlaces(); });

const placeName = (lat, lon) => PLACES.find((p) => p.lat === lat && p.lon === lon)?.name ?? `${fmt(lat)}°, ${fmt(lon)}°`;
const shortName = (c) => PLACES.find((p) => p.lat === c.lat && p.lon === c.lon)?.short ?? c.place;

// --- Views: one at a time, each with its own address so the Back button works. ---
const VIEWS = ['home', 'class', 'host', 'player', 'global', 'moon', 'lunar', 'case', 'leads', 'evidence', 'projection', 'verdict', 'lineup', 'compare', 'record'];
function route() {
  let v = location.hash.replace('#/', '') || 'home';
  if (!VIEWS.includes(v)) v = 'home';
  setWorld(v === 'moon' || v === 'lunar');
  if (v === 'player') classroom?.renderPlayer();
  const needs = { player: classroom?.active, lunar: lunarCase, evidence: current, projection: current, verdict: current, record: current, lineup: current, leads, compare: current?.other, global: GRID };
  if (v in needs && !needs[v]) { location.replace('#/case'); return; }
  for (const n of VIEWS) $(`view-${n}`).classList.toggle('active', n === v);
  $('skip').hidden = v !== 'home';
  $('compare-banner').hidden = !(v === 'case' && compareWith);
  $(`view-${v}`).querySelector('h1, h2')?.focus();
  if (gridLayer) gridLayer.show = v === 'global';
  showDots();
  showPop();
  if (v === 'global') { drawGrid(); flyTo(10, -40, 22000000, 2); }
  if (v === 'home') flyTo(-15.53, -72.65, 160000, 9);
}
addEventListener('hashchange', route);
$('skip').addEventListener('click', () => viewer?.camera.cancelFlight());

// --- Step 1: what and where. ---
function fillVariables(env) {
  const [ids] = SUGGESTIONS[env] ?? [[]];
  const checked = new FormData($('case-form')).get('variable') ?? 'T2M';
  const order = [...VARIABLES].sort((a, b) => (ids.includes(b.id) ? 1 : 0) - (ids.includes(a.id) ? 1 : 0));
  $('variables').innerHTML = order.map((v) => `<li><label class="chip${ids.includes(v.id) ? ' suggested' : ''}" title="${v.definition}">
    <input type="radio" name="variable" value="${v.id}" ${v.id === checked ? 'checked' : ''}>${v.name}</label></li>`).join('');
  showDefinition();
}
function showDefinition() {
  const v = varById(new FormData($('case-form')).get('variable'));
  $('var-def').textContent = v ? `${v.name}: ${v.definition}` : '';
}
$('variables').addEventListener('change', showDefinition);

// Series bundled in the app (data/place_series.json) are used first, so classes still work when NASA POWER rate-limits.
let BUNDLE = null;
async function seriesFor(v, lat, lon, start) {
  const pid = PLACES.find((p) => p.lat === lat && p.lon === lon)?.id;
  if (pid) {
    BUNDLE ??= (await loadJson('data/place_series.json'))?.places ?? {};
    const b = BUNDLE[pid]?.[v.id];
    if (b) { const keep = b.years.map((y) => y >= (start ?? 1981)); return { ...b, years: b.years.filter((_, i) => keep[i]), values: b.values.filter((_, i) => keep[i]), source: 'NASA POWER · MERRA2', variable: v.id }; }
  }
  return fetchPower(v.id, lat, lon, start ?? 1981);
}
// Plain explanation when NASA POWER is busy (it answers 429, which browsers often report as a network error).
const powerError = (err) => (/429|Failed to fetch|NetworkError|Load failed/i.test(err.message)
  ? 'NASA POWER is busy right now (too many requests). Wait a minute and try again, or pick a place from the list: their main series are stored in the app.'
  : err.message);

function chosen() {
  const id = new FormData($('case-form')).get('variable');
  const lat = +$('lat').value, lon = +$('lon').value;
  return { v: varById(id), lat, lon, place: placeName(lat, lon) };
}

// Investigate one variable (or the second place of a comparison).
$('case-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { v, lat, lon, place } = chosen();
  $('status').textContent = 'Asking NASA POWER…';
  try {
    const series = await seriesFor(v, lat, lon, v.start);
    const caseNow = { variable: v, place, lat, lon, series, r: analyze(series), hunch: new FormData(e.target).get('hunch') || null };
    $('status').textContent = '';
    flyTo(lat, lon);
    if (compareWith && compareWith.variable.id === v.id) {
      current = { ...compareWith, other: caseNow };
      compareWith = null;
      renderCompare(current);
      location.hash = '#/compare';
    } else {
      compareWith = null;
      current = caseNow;
      render(current);
      location.hash = '#/evidence';
    }
  } catch (err) {
    $('status').textContent = `The case could not be completed. ${powerError(err)}`;
  }
});

// Scan every variable at the chosen place.
$('scan').addEventListener('click', async () => {
  const { lat, lon, place } = chosen();
  $('status').textContent = 'Asking NASA POWER for every variable…';
  try {
    const all = await fetchPowerMany(VARIABLES.map((v) => ({ id: v.id, start: v.start ?? 1981 })), lat, lon);
    const pid = PLACES.find((p) => p.lat === lat && p.lon === lon)?.id;
    leads = { place, lat, lon, list: scan({ ...all, ...(EXTRA[pid] ?? {}) }) };
    renderLeads(leads);
    $('status').textContent = '';
    flyTo(lat, lon);
    location.hash = '#/leads';
  } catch (err) {
    $('status').textContent = `The scan could not be completed. ${powerError(err)}`;
  }
});

// --- Leads: every variable at one place, ranked by verdict. ---
function clockText(r) {
  if (r.verdict === 'confirmed') return r.knownSince ? `Known with confidence since ${r.knownSince}.` : '';
  if (r.adjusted) return `Significant on its own (p = ${fmt(r.p, 3)}), but not once we account for testing ${r.tested} variables at this place. More years of data would settle it.`;
  if (r.yearsNeeded === Infinity || r.yearsNeeded > 100) return 'No clear signal: not even a century more of data could confirm this trend.';
  if (r.yearsNeeded <= 1) return 'On the edge: one or two more years of data could confirm it.';
  return `If the trend continues, about ${r.yearsNeeded} more years of data would be needed to confirm it.`;
}

function renderLeads({ place, list }) {
  const ok = list.filter((l) => l.status === 'ok');
  $('t-leads').textContent = `What is changing at ${place}?`;
  $('leads-intro').textContent = `We tested ${ok.length} variables here at once. The more you test, the more likely a false alarm, so the bar for "confirmed" is raised (Benjamini-Hochberg).`;
  const none = list.filter((l) => l.status !== 'ok').map((l) => varById(l.variable).name);
  $('leads-list').innerHTML = list.map((l, i) => {
    if (l.status !== 'ok') return '';
    const v = varById(l.variable), r = l.result;
    const arrow = r.slopePerDecade > 0 ? '↗' : r.slopePerDecade < 0 ? '↘' : '→';
    return `<li><button type="button" class="lead-btn" data-i="${i}"><span><strong>${v.name}</strong> ${arrow} ${signed(r.slopePerDecade)} ${unitOf(l.series)}/decade</span>
      <span>${VERDICTS[l.verdict].label}</span></button></li>`;
  }).join('') + (none.length ? `<li class="lead muted">No data or no change here: ${none.join(', ')}.</li>` : '');
}
$('leads-list').addEventListener('click', (e) => {
  const b = e.target.closest('.lead-btn');
  if (!b) return;
  const l = leads.list[+b.dataset.i];
  current = { variable: varById(l.variable), place: leads.place, lat: leads.lat, lon: leads.lon, series: l.series, r: l.result };
  render(current);
  location.hash = '#/evidence';
});

// --- Evidence, verdict and case file for one case. ---
// Second witness: only for catalog places with a precomputed series. A contradicting witness lowers "confirmed" to "likely".
function withWitness(c) {
  const p = PLACES.find((x) => x.lat === c.lat && x.lon === c.lon);
  const w = c.witnessSeries ?? (p && WITNESSES?.series?.[p.id]?.[c.variable.id]);
  if (!w) return { ...c, witness: null };
  let cmp;
  try { cmp = compareWitnesses(c.series, w); } catch { return { ...c, witness: null }; }
  const r = cmp.status === 'contradicted' && c.r.verdict === 'confirmed' ? { ...c.r, verdict: 'likely', knownSince: null, downgraded: true } : c.r;
  return { ...c, r, witness: cmp };
}

function witnessText(v, w) {
  if (!w) return `Witness: ${sourceOf(v)} (only one dataset for this place).`;
  if (w.status === 'corroborated') return `Witnesses: ${sourceOf(v)} and ${w.witness} agree.`;
  if (w.status === 'contradicted') return `Witnesses disagree: ${w.witness} sees the opposite trend.`;
  return `Witnesses: ${sourceOf(v)}; ${w.witness} sees no clear trend.`;
}

function render(c0) {
  const c = withWitness(c0);
  current = { ...c0, ...c };
  const { variable: v, place, lat, lon, series, r } = c;
  const u = unitOf(series);
  const dir = r.verdict === 'unknown' || r.slopePerDecade === 0 ? '' : r.slopePerDecade > 0 ? 'up' : 'down';
  // Evidence: one short title, one big number, the chart.
  $('t2').textContent = `${v.name} · ${lat == null ? place[0].toUpperCase() + place.slice(1) : shortName(c)}`;
  $('stat').textContent = `${signed(r.slopePerDecade)}${u ? ' ' + u : ''} per decade`;
  $('stat').className = `stat ${dir}`;
  $('stat-badge').textContent = VERDICTS[r.verdict].label;
  $('stat-badge').className = `badge ${r.verdict}`;
  $('stat-note').textContent = `${r.firstYear}–${r.lastYear} · one value per year (seasons removed) · dashed line = trend`;
  $('chart').innerHTML = chart(series, r);
  $('chart-caption').textContent = `${v.name}${v.technical ? ` (${v.technical}, ${v.id})` : ''}: annual mean. Trend: Sen's slope. Source: ${sourceOf(v)}.`;
  if (v.notice) $('chart-caption').insertAdjacentHTML('beforeend', ` ${v.notice}`);
  $('table').innerHTML = dataTable(series, v, u);
  $('witnesses').textContent = witnessText(v, c.witness);
  $('compare-start').hidden = lat == null || !sourceOf(v).startsWith('NASA POWER'); // regions and precomputed variables cannot be fetched live

  renderProjection(v, series, r, u, c);

  // Verdict: the label, one sentence, and one line per detective check.
  const vd = VERDICTS[r.verdict];
  $('verdict').textContent = vd.label;
  $('explanation').textContent = vd.text;
  const checks = [];
  const add = (title, k, t) => checks.push([k, t, title]);
  if (r.verdict === 'confirmed') add('The clock', 'yes', r.knownSince ? `Clear since ${r.knownSince}` : 'A clear trend');
  else if (r.adjusted) add('The clock', 'maybe', `Strong alone, but not after testing ${r.tested} things at once`);
  else if (r.yearsNeeded === Infinity || r.yearsNeeded > 100) add('The clock', 'maybe', 'No signal: even 100 more years may not settle it');
  else add('The clock', 'maybe', `About ${Math.max(1, r.yearsNeeded)} more years of data would settle it`);
  const tt = r.ttest, ttConfirmed = tt.p < 0.05;
  const sameCall = ttConfirmed === (r.verdict === 'confirmed') && Math.sign(tt.slopePerDecade) === Math.sign(r.slopePerDecade);
  add('Ask a second test', ...(sameCall ? ['yes', 'A second test agrees'] : ['no', 'A second test disagrees: trust it less']));
  const pt = predictionTest(series);
  if (pt) add('Test it on the past', ...(pt.skill > 0.1 ? ['yes', `Predicts ${pt.testYears[0]}–${pt.testYears[1]} better than "no change"`]
    : pt.skill < -0.1 ? ['no', `Predicts ${pt.testYears[0]}–${pt.testYears[1]} worse than "no change"`]
      : ['maybe', `Predicts ${pt.testYears[0]}–${pt.testYears[1]} no better than "no change"`]));
  const alibis = !INDICES ? [] : ['ENSO', 'PDO'].map((k) => ({ idx: INDICES[k], a: alibiTest(series, INDICES[k]) })).filter((x) => x.a);
  if (alibis.length) {
    const short = { ENSO: 'El Niño', PDO: 'the PDO' };
    const weak = alibis.filter((x) => r.verdict === 'confirmed' && x.a.after.verdict !== 'confirmed');
    add('Check the alibi: El Niño', ...(r.verdict !== 'confirmed' ? ['maybe', `El Niño explains ${Math.round(alibis[0].a.share * 100)}% of the ups and downs`]
      : weak.length ? ['maybe', `Partly explained by ${weak.map((x) => short[Object.keys(INDICES).find((k) => INDICES[k] === x.idx)]).join(' and ')}`]
        : ['yes', 'Not explained by El Niño or the PDO']));
  }
  add('Question a second witness', ...(!c.witness ? ['maybe', 'Only one dataset here'] : c.witness.status === 'corroborated' ? ['yes', 'A second dataset agrees']
    : c.witness.status === 'contradicted' ? ['no', 'A second dataset disagrees'] : ['maybe', 'A second dataset sees no clear trend']));
  const saw = r.verdict === 'unknown' ? 'none' : r.slopePerDecade > 0 ? 'up' : 'down';
  const words = { up: 'rises', down: 'falls', none: 'no change' };
  if (c.hunch && c.hunch !== 'unsure') add('Your first hunch', ...(c.hunch === saw ? ['yes', 'Your hunch was right'] : ['no', `Your hunch (${words[c.hunch]}) did not match: follow the evidence`]));
  const icon = { yes: '✓', no: '✗', maybe: '?' }, said = { yes: 'passed', no: 'failed', maybe: 'open' };
  // Clues start closed: the detective opens each one.
  $('checks').innerHTML = checks.map(([k, t, title], i) => `<li data-clue="${i}"><button type="button" class="clue">🔍 ${title}</button>
    <span hidden><span class="ic ${k}" aria-label="${said[k]}">${icon[k]}</span> ${t}</span></li>`).join('');
  if (c.hunch && c.hunch !== 'unsure' && !c.demo) award(c.hunch === saw ? 1 : 0, 'hunch');
  resetGame(c.demo);

  $('details').innerHTML = [
    `Years analyzed: ${r.n} (${r.firstYear}–${r.lastYear}), one mean per year to remove the seasonal cycle.`,
    `Sen's slope: ${signed(r.slopePerDecade)} ${u}/decade (95% interval: ${signed(r.slopeCI[0])} to ${signed(r.slopeCI[1])}).`,
    r.autocorrelationCorrected === false
      ? `Mann-Kendall test: p = ${r.p < 0.001 ? '< 0.001' : fmt(r.p, 3)}; Kendall's τ = ${fmt(r.tau)}. The Hamed & Rao autocorrelation correction could not be applied (negative correction factor), so the uncorrected test is shown.`
      : `Mann-Kendall test with the Hamed & Rao (1998) autocorrelation correction: p = ${r.p < 0.001 ? '< 0.001' : fmt(r.p, 3)}; Kendall's τ = ${fmt(r.tau)}.`,
    `Second test: linear regression t-test with the effective sample size for autocorrelation (Santer et al. 2000): ${signed(tt.slopePerDecade)} ${u}/decade (95% interval ${signed(tt.slopeCI[0])} to ${signed(tt.slopeCI[1])}), p = ${tt.p < 0.001 ? '< 0.001' : fmt(tt.p, 3)}.`,
    r.q == null
      ? 'Verdict (Mann-Kendall): confirmed if p < 0.05; likely if p < 0.10; otherwise not yet known.'
      : `Verdict from a scan of ${r.tested} variables: Benjamini-Hochberg adjusted q = ${fmt(r.q, 3)} instead of p (confirmed if q < 0.05; likely if q < 0.10).`,
    ...(pt ? [`Prediction test: trend fitted to ${pt.trainYears[0]}–${pt.trainYears[1]}; skill on ${pt.testYears[0]}–${pt.testYears[1]} versus the training mean = ${fmt(pt.skill, 2)} (mean absolute error).`] : []),
    ...alibis.map(({ idx, a }) => `Alibi, ${idx.name} (${idx.organization}): explains ${Math.round(a.share * 100)}% of the year-to-year variance; after removing it the trend is ${VERDICTS[a.after.verdict].label.slice(2).toLowerCase()} (${signed(a.after.slopePerDecade)} ${u}/decade).`),
    c.witness ? `Second witness: ${c.witness.witness}, ${c.witness.overlap[0]}–${c.witness.overlap[1]}, rated ${c.witness.witnessVerdict}; status: ${c.witness.status.replace('-', ' ')}. Only a contradicting witness that is at least "likely" lowers a confirmed verdict.` : `Witness: ${sourceOf(v)} only.`,
    'Clock: years needed to detect the current slope with 90% probability (α = 0.05) under autocorrelated noise, following Weatherhead et al. (1998); it assumes the trend and the noise stay the same.',
  ].map((t) => `<li>${t}</li>`).join('');

  $('record').innerHTML = [
    ['What', `${v.name} (${v.technical ?? v.name}, ${v.id})`], ['Where', lat == null ? `${place} (area-weighted mean of the grid cells in it)` : `${place} (${fmt(lat)}°, ${fmt(lon)}°)`],
    ['How much', `${signed(r.slopePerDecade)} ${u} per decade, ${r.firstYear}–${r.lastYear}`], ['Verdict', `${vd.label}. ${clockText(r)}`],
    ['Checks', checks.map(([k, t]) => `${icon[k]} ${t}`).join('<br>')],
    ['Witnesses', c.witness ? `${sourceOf(v)}; ${c.witness.witness} (${c.witness.status.replace('-', ' ')})` : sourceOf(v)], ['Method', "Annual means · Sen's slope · Mann-Kendall (Hamed & Rao) · t-test"],
  ].map(([k, val]) => `<tr><th scope="row">${k}</th><td>${val}</td></tr>`).join('');
}

$('compare-start').addEventListener('click', () => {
  compareWith = { ...current, other: undefined };
  $('compare-banner-text').textContent = `Comparing ${current.variable.name.toLowerCase()}: pick a second place, then press Investigate.`;
  document.querySelector(`input[value="${current.variable.id}"]`).checked = true;
  location.hash = '#/case';
});
$('compare-cancel').addEventListener('click', () => { compareWith = null; $('compare-banner').hidden = true; });

function renderCompare(c) {
  const a = c, b = c.other, v = a.variable;
  const dir = (x) => (x.r.slopePerDecade > 0 ? 'rises' : x.r.slopePerDecade < 0 ? 'falls' : 'shows no measurable change');
  const unsure = [a, b].filter((x) => x.r.verdict === 'unknown');
  $('t-compare').textContent = `${v.name}: ${a.place} vs. ${b.place}`;
  $('compare-grid').innerHTML = [a, b].map((x) => `
    <div class="card"><h3>${x.place}</h3>${chart(x.series, x.r)}
    <p><strong>${VERDICTS[x.r.verdict].label}</strong> · ${signed(x.r.slopePerDecade)} ${unitOf(x.series)} per decade</p>
    <p class="note">${clockText(x.r)}</p></div>`).join('');
  const name = v.name.toLowerCase();
  $('compare-summary').textContent = unsure.length
    ? `We cannot compare directions yet: in ${unsure.map((x) => x.place).join(' and ')} the trend is not yet known.`
    : a.r.slopePerDecade * b.r.slopePerDecade < 0
      ? `Opposite directions: ${name} ${dir(a)} in ${a.place} but ${dir(b)} in ${b.place}. The same variable can trend in opposite ways in different regions.`
      : `Same direction: ${name} ${dir(a)} in both places, at ${fmtSlope(Math.abs(a.r.slopePerDecade))} and ${fmtSlope(Math.abs(b.r.slopePerDecade))} ${unitOf(a.series)} per decade.`;
}

// --- Detective game: the user makes the calls, can be wrong, and earns points. ---
const RANKS = [[0, 'Rookie'], [5, 'Junior detective'], [12, 'Inspector'], [25, 'Chief inspector'], [45, 'Legendary detective']];
let score = 0, classroom = null;
try { score = +localStorage.getItem('td-score') || 0; } catch { score = 0; }
function showScore() { $('score').textContent = `🕵 ${score} pts · ${RANKS.filter(([p]) => score >= p).at(-1)[1]}`; }
function award(points) { classroom?.addPoints(points); score += points; try { localStorage.setItem('td-score', String(score)); } catch { /* private mode: keep it in memory */ } showScore(); }
showScore();

function resetGame(reveal) {
  for (const id of ['ask-trend', 'ask-verdict']) { $(id).classList.toggle('done', !!reveal); $(id).hidden = !!reveal; $(id).querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', 'false')); }
  $('trend-feedback').textContent = ''; $('verdict-feedback').textContent = '';
  $('stat-row').hidden = !reveal; $('verdict-block').hidden = !reveal;
  if (reveal) document.querySelectorAll('#checks [data-clue] > span').forEach((x) => { x.hidden = false; x.previousElementSibling.hidden = true; });
}
function feedback(id, kind, text) { $(id).className = `feedback ${kind}`; $(id).textContent = text; }

$('ask-trend').addEventListener('click', (e) => {
  const b = e.target.closest('[data-trend]');
  if (!b || $('ask-trend').classList.contains('done')) return;
  const r = current.r, guess = b.dataset.trend, tilt = r.slopePerDecade > 0 ? 'up' : r.slopePerDecade < 0 ? 'down' : 'none';
  const truth = r.verdict === 'unknown' ? 'none' : tilt;
  b.setAttribute('aria-pressed', 'true'); $('ask-trend').classList.add('done'); $('stat-row').hidden = false;
  if (guess === truth) { award(1); feedback('trend-feedback', 'good', '✓ Good eye! +1 point. ' + (truth === 'none' ? 'The ups and downs hide any steady change.' : 'The dashed trend line agrees with you.')); }
  else if (truth === 'none' && guess === tilt) feedback('trend-feedback', 'close', '≈ Close: the line does tilt that way, but the change is too small to tell apart from normal ups and downs. No points this time.');
  else feedback('trend-feedback', 'miss', `✗ Not quite. Follow the dashed line from ${current.series.years[0]} to ${current.series.years.at(-1)}: ${truth === 'none' ? 'it stays almost flat compared with the ups and downs' : `it goes ${truth === 'up' ? 'up' : 'down'}`}. Detectives learn from misses!`);
});

$('ask-verdict').addEventListener('click', (e) => {
  const b = e.target.closest('[data-call]');
  if (!b || $('ask-verdict').classList.contains('done')) return;
  const order = ['unknown', 'likely', 'confirmed'], call = b.dataset.call, truth = current.r.verdict;
  const gap = Math.abs(order.indexOf(call) - order.indexOf(truth));
  b.setAttribute('aria-pressed', 'true'); $('ask-verdict').classList.add('done'); $('verdict-block').hidden = false;
  const why = { confirmed: 'the tests say a change this clear would almost never come from chance', likely: 'there are signs, but chance could still explain them', unknown: 'the ups and downs are too big for the change to stand out yet' }[truth];
  if (gap === 0) { award(2); feedback('verdict-feedback', 'good', `✓ Great call! +2 points: ${why}.`); }
  else if (gap === 1) { award(1); feedback('verdict-feedback', 'close', `≈ Close, +1 point. The tests say "${VERDICTS[truth].label.slice(2)}": ${why}.`); }
  else feedback('verdict-feedback', 'miss', `✗ The tests disagree: ${why}. Open the clues to see why.`);
});

$('checks').addEventListener('click', (e) => {
  const b = e.target.closest('.clue');
  if (!b) return;
  b.hidden = true; b.nextElementSibling.hidden = false;
});

// Projection: shown only when the trend beat "no change" on held-out years (prediction test), never otherwise.
const TO_YEAR = 2040;
function renderProjection(v, series, r, u, c) {
  const pt = predictionTest(series), p = projection(series, TO_YEAR), end = p.at(TO_YEAR);
  const where = c.lat == null ? c.place : shortName(c);
  $('t-proj').textContent = `${v.name} · ${where} in ${TO_YEAR}`;
  const ok = pt && pt.skill > 0.1 && r.verdict !== 'unknown';
  $('proj-stat').textContent = ok ? `≈ ${fmt(end.centre, 1)}${u ? ' ' + u : ''}` : 'No projection';
  $('proj-note').textContent = ok
    ? `Likely range for a single year: ${fmt(end.low, 1)} to ${fmt(end.high, 1)}${u ? ' ' + u : ''}. Last observed year (${series.years.at(-1)}): ${fmt(series.values.at(-1), 1)}.`
    : `This trend is not reliable enough to extend: ${r.verdict === 'unknown' ? 'the change is not clear yet' : 'it did not predict past years better than "no change"'}.`;
  $('proj-chart').innerHTML = projChart(series, p, ok);
  $('learn-test').textContent = pt
    ? `We hid ${pt.testYears[0]}–${pt.testYears[1]}, fitted the trend on ${pt.trainYears[0]}–${pt.trainYears[1]}, and checked it: it predicted the hidden years ${pt.skill > 0.1 ? `${Math.round(pt.skill * 100)}% better than` : pt.skill < -0.1 ? 'worse than' : 'no better than'} assuming nothing changes.`
    : 'With so few years we cannot hide some to test the trend, so we do not extend it.';
}

function projChart(s, p, withBand) {
  const W = 760, H = 230, m = { l: 48, r: 12, t: 12, b: 28 };
  const x0 = s.years[0], x1 = withBand ? TO_YEAR : s.years.at(-1);
  const all = [...s.values, ...(withBand ? p.points.flatMap((q) => [q.low, q.high]) : [])];
  const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.08 || 1;
  const X = (y) => m.l + ((y - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - m.t - m.b);
  const line = s.years.map((y, i) => `${X(y)},${Y(s.values[i])}`).join(' ');
  const band = withBand ? [...p.points.map((q) => `${X(q.year)},${Y(q.high)}`), ...p.points.slice().reverse().map((q) => `${X(q.year)},${Y(q.low)}`)].join(' ') : '';
  const a = p.at(s.years[0]), b = p.at(x1);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Annual series with its trend${withBand ? ` extended to ${TO_YEAR} with a 95% band` : ''}" style="max-height:230px">
    <line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="rgba(255,255,255,.3)"/>
    <text x="${m.l}" y="${H - 8}" fill="currentColor" font-size="12">${x0}</text>
    <text x="${W - m.r}" y="${H - 8}" fill="currentColor" font-size="12" text-anchor="end">${x1}</text>
    <text x="4" y="${Y(hi)}" fill="currentColor" font-size="12">${fmt(hi, 1)}</text>
    <text x="4" y="${Y(lo)}" fill="currentColor" font-size="12">${fmt(lo, 1)}</text>
    ${withBand ? `<polygon points="${band}" fill="rgba(0,212,255,.18)" stroke="none"/><line x1="${X(s.years.at(-1))}" y1="${m.t}" x2="${X(s.years.at(-1))}" y2="${H - m.b}" stroke="rgba(255,255,255,.25)" stroke-dasharray="3 4"/>` : ''}
    <polyline points="${line}" fill="none" stroke="var(--text-primary)" stroke-width="2"/>
    <line x1="${X(s.years[0])}" y1="${Y(a.centre)}" x2="${X(x1)}" y2="${Y(b.centre)}" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="8 6"/>
  </svg>`;
}

const dataTable = (s, v, u) => `<table><thead><tr><th>Year</th><th>${v.name}${u ? ` (${u})` : ''}</th></tr></thead><tbody>${
  s.years.map((y, i) => `<tr><td>${y}</td><td>${fmt(s.values[i])}</td></tr>`).join('')}</tbody></table>`;

function chart(s, r) {
  const W = 760, H = 230, m = { l: 48, r: 12, t: 12, b: 28 };
  const x0 = s.years[0], x1 = s.years.at(-1);
  const lo = Math.min(...s.values), hi = Math.max(...s.values), pad = (hi - lo) * 0.1 || 1;
  const X = (y) => m.l + ((y - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - m.t - m.b);
  const line = s.years.map((y, i) => `${X(y)},${Y(s.values[i])}`).join(' ');
  const slope = r.slopePerDecade / 10;
  const median = (a) => { const b = [...a].sort((p, q) => p - q); return b[b.length >> 1]; };
  const b0 = median(s.values.map((v, i) => v - slope * s.years[i]));
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Annual series of ${s.years.length} years with its trend line" style="max-height:260px">
    <line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="rgba(255,255,255,.3)"/>
    <text x="${m.l}" y="${H - 8}" fill="currentColor" font-size="12">${x0}</text>
    <text x="${W - m.r}" y="${H - 8}" fill="currentColor" font-size="12" text-anchor="end">${x1}</text>
    <text x="4" y="${Y(hi)}" fill="currentColor" font-size="12">${fmt(hi, 1)}</text>
    <text x="4" y="${Y(lo)}" fill="currentColor" font-size="12">${fmt(lo, 1)}</text>
    <polyline points="${line}" fill="none" stroke="var(--text-primary)" stroke-width="2"/>
    <line x1="${X(x0)}" y1="${Y(b0 + slope * x0)}" x2="${X(x1)}" y2="${Y(b0 + slope * x1)}" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="8 6"/>
  </svg>`;
}

$('download').addEventListener('click', () => {
  if (!current) return;
  const { variable, place, lat, lon, series, r } = current;
  const blob = new Blob([JSON.stringify({ variable: variable.id, place, lat, lon, result: r, series: { ...series, source: sourceOf(variable) } }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `case_${variable.id}_${lat}_${lon}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});

// --- Line-up (placebo test from the thesis): can you spot the real series among 8 block-shuffled copies? ---
let lineupAnswer = -1;
function sparkline(values) {
  const W = 220, H = 90, lo = Math.min(...values), hi = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--text-primary)" stroke-width="2"/></svg>`;
}
$('lineup-start').addEventListener('click', () => {
  const real = current.series.values;
  lineupAnswer = Math.floor(Math.random() * 9);
  const panels = Array.from({ length: 9 }, (_, i) => (i === lineupAnswer ? real : blockShuffle(real)));
  $('lineup-grid').innerHTML = panels.map((p, i) => `<button type="button" class="lineup-cell" data-i="${i}" aria-label="Series ${i + 1}">${sparkline(p)}<span>${i + 1}</span></button>`).join('');
  $('lineup-result').textContent = '';
  location.hash = '#/lineup';
});
$('lineup-grid').addEventListener('click', (e) => {
  const b = e.target.closest('.lineup-cell');
  if (!b || $('lineup-result').textContent) return;
  const hit = +b.dataset.i === lineupAnswer;
  document.querySelectorAll('.lineup-cell')[lineupAnswer].classList.add('real');
  $('lineup-result').textContent = hit
    ? 'You found it. The real series stands out from series where chance alone shapes the ups and downs: that is what a significant trend looks like.'
    : current.r.verdict === 'confirmed'
      ? `The real one was number ${lineupAnswer + 1}. Look again: it keeps one direction over the decades, while the shuffled ones wander without one. The test sees that difference even when the eye misses it.`
      : `The real one was number ${lineupAnswer + 1}. It hides easily among the shuffled ones: its trend is hard to tell from chance, which is exactly what a "${VERDICTS[current.r.verdict].label.slice(2)}" verdict means.`;
});

// --- Demos: precomputed cases that play without the network. ---
function renderDemos() {
  $('demos').hidden = DEMOS.length === 0;
  $('demo-list').innerHTML = DEMOS.map((d, i) => `<li><button type="button" class="btn sec demo-btn" data-i="${i}">${d.title}</button></li>`).join('');
}
$('demo-list').addEventListener('click', (e) => {
  const b = e.target.closest('.demo-btn');
  if (!b) return;
  const d = DEMOS[+b.dataset.i];
  const v = varById(d.variable) ?? { id: d.variable, name: d.variable, source: '' };
  const make = (pid) => {
    const p = PLACES.find((x) => x.id === pid) ?? { name: pid, lat: 0, lon: 0 };
    const series = d.series[pid];
    return { variable: v, place: p.name, lat: p.lat, lon: p.lon, series, r: analyze(series), demo: true };
  };
  const [a, b2] = d.places;
  current = { ...make(a), other: b2 ? make(b2) : undefined };
  render(current);
  if (b2) { renderCompare(current); $('compare-summary').textContent += ` ${d.why}`; }
  else $('chart-caption').textContent += ` ${d.why}`;
  const first = PLACES.find((x) => x.id === a);
  if (first) flyTo(first.lat, first.lon, 4000000);
  playTour([
    ...(b2 ? [['#/compare', `Two places, one variable. ${d.why}`]] : []),
    ['#/evidence', `The evidence: one value per year, so the seasons cancel out. The dashed line is the trend.${b2 ? '' : ' ' + d.why}`],
    ['#/verdict', 'The verdict: several tests check whether the change could be chance. Each ✓ is a check passed.'],
    ['#/record', 'The case file keeps the data, the source and the method, so anyone can check it.'],
    ['#/case', 'Your turn: pick a place and a variable, make a hunch, and investigate.'],
  ]);
});

// A demo plays like a short guided video: it advances on its own, and can be paused or left at any time.
let tourTimer = null, tourSteps = [], tourAt = 0;
function playTour(steps) { tourSteps = steps; tourAt = 0; $('tour').hidden = false; showStep(); }
function showStep() {
  clearTimeout(tourTimer);
  const [hash, text] = tourSteps[tourAt];
  location.hash = hash;
  $('tour-text').textContent = `${tourAt + 1}/${tourSteps.length} · ${text}`;
  $('tour-pause').textContent = 'Pause';
  if (tourAt < tourSteps.length - 1 && !reducedMotion) tourTimer = setTimeout(nextStep, 9000);
  if (tourAt === tourSteps.length - 1) $('tour-next').textContent = 'Close';
  else $('tour-next').textContent = 'Next';
}
function nextStep() { if (++tourAt < tourSteps.length) showStep(); else stopTour(); }
function stopTour() { clearTimeout(tourTimer); $('tour').hidden = true; showPop(); }
$('tour-next').addEventListener('click', nextStep);
$('tour-stop').addEventListener('click', stopTour);
$('tour-pause').addEventListener('click', () => {
  if ($('tour-pause').textContent === 'Pause') { clearTimeout(tourTimer); $('tour-pause').textContent = 'Play'; }
  else { $('tour-pause').textContent = 'Pause'; tourTimer = setTimeout(nextStep, 4000); }
});

// --- Global view: a precomputed NASA POWER trend for every grid cell, drawn on the globe. ---
let GRID = null, GRID2 = null, gridLayer = null, gridVar = 'T2M';
// Trends, regions and cell series for a grid variable, from the live-capable POWER grid or the precomputed Earthdata grid.
const gridSet = (id) => (GRID?.trends[id] ? GRID : GRID2?.trends?.[id] ? GRID2 : null);
const area = (lat) => Math.cos((lat * Math.PI) / 180);

function fillGlobal() {
  $('global-link').hidden = !GRID;
  if (!GRID) return;
  const ids = VARIABLES.filter((v) => GRID.trends[v.id]).map((v) => v.id);
  const more = (GRID2?.variables ?? []).filter((v) => GRID2.trends[v.id]);
  $('global-var').innerHTML = `<optgroup label="Near the ground · NASA POWER">${ids.map((id) => `<option value="${id}">${varById(id).name}</option>`).join('')}</optgroup>`
    + (more.length ? `<optgroup label="Higher in the sky, and land water · NASA">${more.map((v) => `<option value="${v.id}">${v.name} · ${v.source.split(' (')[0].split(' on ')[0]}</option>`).join('')}</optgroup>` : '');
  $('global-var').value = gridVar;
  $('global-note').textContent = `${GRID.cells.length} cells of ${GRID.step}° × ${GRID.step}°, each with its own trend test on NASA data (value at the cell centre). With thousands of tests, the bar for "confirmed" is raised (Benjamini-Hochberg). Regions are area-weighted means.`;
}
$('global-var').addEventListener('change', () => { gridVar = $('global-var').value; drawGrid(); });

function drawGrid() {
  if (!GRID) return;
  const set = gridSet(gridVar), v = varById(gridVar), t = set.trends[gridVar], step = GRID.step;
  // Color scale: the 95th percentile of |slope| is full color, so a few extreme cells do not wash out the rest.
  const mags = t.filter(Boolean).map((x) => Math.abs(x[0])).sort((a, b) => a - b);
  const top = mags[Math.floor(mags.length * 0.95)] || 1;
  const share = { up: 0, down: 0, unsure: 0, none: 0 };
  let total = 0;
  const instances = [];
  GRID.cells.forEach(([lat, lon], i) => {
    const w = area(lat); total += w;
    const x = t[i];
    if (!x) { share.none += w; return; }
    const [slope, , verdict] = x;
    if (verdict === 'confirmed') share[slope > 0 ? 'up' : 'down'] += w; else share.unsure += w;
    const k = Math.min(1, Math.abs(slope) / top);
    const rgb = slope > 0 ? [1, 0.55 - 0.35 * k, 0.15] : [0.15, 0.55 - 0.15 * k, 1];
    const alpha = verdict === 'confirmed' ? 0.2 + 0.4 * k : verdict === 'likely' ? 0.14 : 0.04;
    if (viewer) instances.push(new C.GeometryInstance({
      geometry: new C.RectangleGeometry({ rectangle: C.Rectangle.fromDegrees(lon - step / 2, lat - step / 2, lon + step / 2, lat + step / 2), height: 2000 }),
      attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(new C.Color(...rgb, alpha)) },
    }));
  });
  if (viewer) {
    if (gridLayer) viewer.scene.primitives.remove(gridLayer);
    // A plain primitive slightly above the surface: ground-clamped primitives need GPU features some browsers lack.
    gridLayer = viewer.scene.primitives.add(new C.Primitive({
      geometryInstances: instances, appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }), asynchronous: false,
    }));
  }
  const pct = (x) => `${Math.round((100 * x) / total)}%`;
  const u = unitOf({ units: v.units });
  $('t-global').textContent = `${v.name}: where is it changing?`;
  $('global-summary').innerHTML = `<div class="up"><b>${pct(share.up)}</b>of the planet: rising</div>
    <div class="down"><b>${pct(share.down)}</b>falling</div><div><b>${pct(share.unsure + share.none)}</b>not sure yet${share.none ? ' / no data' : ''}</div>`;
  $('global-scale').textContent = `Orange: rising · blue: falling · full colour = ${fmtSlope(top)}${u ? ' ' + u : ''}/decade or more.`;
  $('regions').innerHTML = Object.entries(set.regions).filter(([, r]) => r.series[gridVar]).map(([id, r]) => {
    const res = analyze(r.series[gridVar]);
    const label = r.name.replace(/^the /, '').replace(/ \(.*\)$/, '');
    return `<li><button type="button" class="lead-btn" data-region="${id}" title="${r.name}"><span><strong>${label[0].toUpperCase() + label.slice(1)}</strong> ${signed(res.slopePerDecade)}${u ? ' ' + u : ''}/decade</span>
      <span>${VERDICTS[res.verdict].label}</span></button></li>`;
  }).join('');
}

$('regions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-region]');
  if (!b) return;
  const set = gridSet(gridVar), r = set.regions[b.dataset.region], v = varById(gridVar);
  const series = { ...r.series[gridVar], source: set === GRID ? GRID.source : v.source };
  // A satellite variable that checks this one (e.g. AIRS for MERRA-2) becomes the second witness for the region.
  const wv = GRID2?.variables?.find((x) => x.witnessOf === gridVar);
  const ws = wv && GRID2.regions[b.dataset.region]?.series[wv.id];
  render({ variable: v, place: r.name, lat: null, lon: null, series, r: analyze(series), witnessSeries: ws ? { ...ws, source: wv.source } : undefined });
  location.hash = '#/evidence';
});

function openCell(position) {
  const p = viewer.camera.pickEllipsoid(position);
  if (!p) return;
  const g = C.Cartographic.fromCartesian(p);
  if (gridSet(gridVar) === GRID2) return openStoredCell(C.Math.toDegrees(g.latitude), C.Math.toDegrees(g.longitude));
  setPoint(+C.Math.toDegrees(g.latitude).toFixed(2), +C.Math.toDegrees(g.longitude).toFixed(2));
  selectedPlace = null;
  document.querySelector(`input[name="variable"][value="${gridVar}"]`).checked = true;
  location.hash = '#/case';
  $('case-form').requestSubmit();
}

// Precomputed variables cannot be fetched live, so a click opens the cell's stored annual series.
function openStoredCell(lat, lon) {
  const step = GRID.step, i = GRID.cells.findIndex(([a, o]) => Math.abs(a - lat) <= step / 2 && Math.abs(o - lon) <= step / 2);
  const values = GRID2.cellSeries?.[gridVar]?.[i], [first, last] = GRID2.years?.[gridVar] ?? [];
  if (!values || values.length !== last - first + 1) { $('global-note').textContent = 'No stored series for that cell and variable.'; return; }
  const [clat, clon] = GRID.cells[i], v = varById(gridVar);
  const series = { years: values.map((_, k) => first + k), values, units: v.units, source: v.source };
  render({ variable: v, place: `the ${step}° cell centered at ${fmt(clat, 1)}°, ${fmt(clon, 1)}°`, lat: null, lon: null, series, r: analyze(series) });
  location.hash = '#/evidence';
}

// --- The Moon (decision D-26): a second globe, lunar places, and cases on how the Moon affects the Earth. ---
const MOON_TILES = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg';
// Coordinates from Wikipedia's lunar coordinate data (globe=moon), retrieved 14 November 2026.
const MOON_PLACES = [
  ['Tycho crater', -43.31, -11.36, 'A young, bright crater whose rays of ejecta stretch across the Moon.'],
  ['Copernicus crater', 9.62, -20.08, 'A large impact crater with terraced walls, easy to see with binoculars.'],
  ['Tranquility Base', 0.6875, 23.4333, 'Where Apollo 11 landed in 1969: the first humans on the Moon.'],
  ['Mare Tranquillitatis', 8.5, 31.4, 'A dark plain of ancient lava, the "Sea of Tranquility".'],
  ['Mare Serenitatis', 28, 17.5, 'A dark lava plain, the "Sea of Serenity".'],
  ['Mare Imbrium', 32.8, -15.6, 'One of the largest lava plains, filling a giant impact basin.'],
  ['Mare Crisium', 17, 59.1, 'An isolated dark lava plain near the eastern edge of the near side.'],
  ['Aristarchus crater', 23.7, -47.4, 'The brightest large crater on the near side.'],
  ['Shackleton crater', -89.67, 129.78, 'At the south pole; its floor never sees sunlight and may hold ice.'],
  ["Chang'e 4 landing site", -45.444, 177.599, 'In 2019, the first spacecraft to land on the far side of the Moon.'],
];
const MOON_CASES = [
  { id: 'tides', title: 'Ocean tides', tag: ['proven', 'Proven'], kinds: 'tides',
    text: 'The Moon raises two bulges of ocean water, so most coasts get two high tides a day. Over 18.6 years the tides grow and shrink a little. Test it with 100 years of tide gauges.' },
  { id: 'corals', title: 'Coral spawning', tag: ['proven', 'Proven'],
    text: 'On many reefs, corals release their eggs together a few nights after a full moon. Moonlight is one of the clocks they use.' },
  { id: 'rain', title: 'Rain and air temperature', tag: ['weak', 'Weak effect'], kinds: null,
    text: 'Studies find tiny lunar effects on rain and air pressure. Can you see the 18.6-year rhythm in the climate of a place?' },
  { id: 'glaciers', title: '★ Glaciers: the special case', tag: ['open', 'Open question'], kinds: ['glacier'],
    text: 'Does the Moon\'s 18.6-year rhythm leave a mark on the climate of glaciers? This is an open research question (the author\'s thesis). Test it with NASA data.' },
];
const LUNAR_VARS = ['T2M', 'PRECTOTCORR', 'SNODP', 'T2M_MAX', 'T2M_MIN', 'RH2M'];
let moonViewer = null, lunarCase = null, onMoon = false, TIDES = null;
// Official lunar names (IAU/USGS gazetteer) grouped into map layers; loaded the first time the Moon opens.
const MOON_LAYERS = [
  ['seas', 'Seas and lakes', '#4d9bff', ['Mare', 'Oceanus', 'Lacus', 'Sinus', 'Palus'], 12000000, 7],
  ['mountains', 'Mountains and valleys', '#e8c27a', ['Mons', 'Montes', 'Rupes', 'Vallis'], 3000000, 6],
  ['craters', 'Craters', '#c8c8d0', ['Crater'], 1200000, 4],
  ['landing', 'Landing sites', '#3ddc97', ['Landing site'], 20000000, 9],
];
const moonLayerOn = { seas: true, mountains: true, craters: false, landing: true };
let MOON_FEATURES = [];
function moonLayerOf(f) { return MOON_LAYERS.find((l) => l[3].includes(f.type)); }
function renderMoonLayers() {
  $('moon-layers').innerHTML = MOON_LAYERS.map(([id, label, color]) => `<li><button type="button" class="chip" data-layer="${id}" aria-pressed="${moonLayerOn[id]}"><span class="dot" style="background:${color}"></span>${label}</button></li>`).join('');
}
$('moon-layers').addEventListener('click', (e) => {
  const b = e.target.closest('[data-layer]');
  if (!b) return;
  moonLayerOn[b.dataset.layer] = !moonLayerOn[b.dataset.layer];
  renderMoonLayers();
  moonViewer?.entities.values.forEach((en) => { if (en.layer) en.show = moonLayerOn[en.layer]; });
});
renderMoonLayers();
async function loadMoonFeatures(M) {
  const data = await loadJson('data/moon_features.json');
  MOON_FEATURES = data?.features ?? [];
  for (const f of MOON_FEATURES) {
    const layer = moonLayerOf(f);
    if (!layer) continue;
    const [id, , color, , far, size] = layer;
    const en = moonViewer.entities.add({
      id: `gaz:${f.name}`, position: C.Cartesian3.fromDegrees(f.lon, f.lat, 0, M),
      point: { pixelSize: size, color: C.Color.fromCssColorString(color), outlineColor: C.Color.BLACK, outlineWidth: 1 },
      label: { text: f.name, font: `600 ${id === 'seas' ? 14 : 12}px Inter, sans-serif`, verticalOrigin: C.VerticalOrigin.BOTTOM, pixelOffset: new C.Cartesian2(0, -10),
               fillColor: C.Color.fromCssColorString(color), showBackground: true, backgroundColor: C.Color.fromCssColorString('rgba(10,10,15,.85)'),
               backgroundPadding: new C.Cartesian2(5, 2), distanceDisplayCondition: new C.DistanceDisplayCondition(0, far) },
    });
    en.layer = id; en.show = moonLayerOn[id]; en.feature = f;
  }
}

function setWorld(moon) {
  if (moon === onMoon && (!moon || moonViewer)) return;
  onMoon = moon;
  $('globe').hidden = moon; $('moon-globe').hidden = !moon;
  $('to-earth').setAttribute('aria-pressed', String(!moon)); $('to-moon').setAttribute('aria-pressed', String(moon));
  document.querySelector('.credits').textContent = moon
    ? 'Imagery: NASA LRO WAC global mosaic via NASA Moon Trek · Globe: CesiumJS (Apache 2.0)'
    : 'Imagery: NASA Blue Marble and Worldview (GIBS) · Globe: CesiumJS (Apache 2.0)';
  if (moon && !moonViewer && C) {
    try {
      const M = C.Ellipsoid.MOON;
      moonViewer = new C.Viewer('moon-globe', {
        globe: new C.Globe(M), skyAtmosphere: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
        navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
        baseLayer: new C.ImageryLayer(new C.WebMapTileServiceImageryProvider({ url: MOON_TILES, layer: 'LRO_WAC_Mosaic_Global_303ppd_v02', style: 'default',
          tileMatrixSetID: 'default028mm', format: 'image/jpeg', maximumLevel: 7, tilingScheme: new C.GeographicTilingScheme({ ellipsoid: M }) })),
      });
      moonViewer.scene.globe.enableLighting = false;
      moonViewer.camera.setView({ destination: C.Cartesian3.fromDegrees(10, 10, 6500000, M) });
      for (const [name, lat, lon] of MOON_PLACES) moonViewer.entities.add({
        id: `moon:${name}`, position: C.Cartesian3.fromDegrees(lon, lat, 0, M),
        point: { pixelSize: 8, color: C.Color.fromCssColorString('#ffd166'), outlineColor: C.Color.BLACK, outlineWidth: 1.5 },
        label: { text: name, font: '600 13px Inter, sans-serif', verticalOrigin: C.VerticalOrigin.BOTTOM, pixelOffset: new C.Cartesian2(0, -12),
                 showBackground: true, backgroundColor: C.Color.fromCssColorString('rgba(10,10,15,.88)'), backgroundPadding: new C.Cartesian2(6, 3) },
      });
      new C.ScreenSpaceEventHandler(moonViewer.scene.canvas).setInputAction((e) => {
        const ent = moonViewer.scene.pick(e.position)?.id, id = ent?.id;
        const f = typeof id === 'string' && MOON_PLACES.find(([n]) => `moon:${n}` === id);
        const g = ent?.feature;
        if (!f && !g) return;
        $('place-pop').hidden = false; $('pop-img').hidden = true;
        if (f) {
          $('pop-name').textContent = f[0]; $('pop-country').textContent = `Moon · ${fmt(f[1], 2)}°, ${fmt(f[2], 2)}°`;
          $('pop-line').textContent = f[3]; $('pop-facts').textContent = '';
          $('pop-credit').innerHTML = `Coordinates: <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(f[0].replace(/ /g, '_'))}" target="_blank" rel="noopener">Wikipedia</a>`;
        } else {
          $('pop-name').textContent = g.name; $('pop-country').textContent = `${g.type} · ${fmt(g.lat, 1)}°, ${fmt(g.lon, 1)}°`;
          $('pop-line').textContent = g.origin ? `Name: ${g.origin}` : '';
          $('pop-facts').textContent = [g.diameter_km && `About ${Math.round(g.diameter_km).toLocaleString('en-US')} km across`, g.approval_year && `named in ${g.approval_year}`].filter(Boolean).join(' · ');
          $('pop-credit').innerHTML = `IAU/USGS Gazetteer of Planetary Nomenclature · <a href="${esc(g.link)}" target="_blank" rel="noopener">feature page</a>`;
        }
      }, C.ScreenSpaceEventType.LEFT_CLICK);
      loadMoonFeatures(M);
    } catch (err) { console.warn('Moon globe unavailable:', err); }
  }
  if (moon) $('place-pop').hidden = true;
}
$('to-moon').addEventListener('click', () => { location.hash = '#/moon'; });
$('to-earth').addEventListener('click', () => { location.hash = '#/home'; });
$('back-earth').addEventListener('click', () => { location.hash = '#/home'; });

$('moon-cases').innerHTML = MOON_CASES.map((c) => `<li><button type="button" class="lead-btn" data-case="${c.id}"><span><strong>${c.title}</strong></span>
  <span class="tag ${c.tag[0]}">${c.tag[1]}</span></button></li>`).join('');
$('moon-cases').addEventListener('click', (e) => {
  const b = e.target.closest('[data-case]');
  if (!b) return;
  lunarCase = MOON_CASES.find((c) => c.id === b.dataset.case);
  openLunarCase();
  location.hash = '#/lunar';
});

const QUIZ = {
  tides: { q: 'How many high tides do most coasts get each day?', options: ['One', 'Two', 'Four'], answer: 1,
    why: 'Two: the Moon pulls a bulge of water toward it, and another bulge forms on the far side of the Earth.' },
  corals: { q: 'When do many corals release their eggs?', options: ['At new moon', 'A few nights after a full moon', 'On random nights'], answer: 1,
    why: 'A few nights after a full moon: moonlight helps thousands of corals spawn on the same night.' },
};
let lunarGuess = null;
$('lunar-quiz').addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]');
  if (!b || $('lunar-quiz').classList.contains('done')) return;
  const q = QUIZ[lunarCase.id], ok = +b.dataset.q === q.answer;
  b.setAttribute('aria-pressed', 'true'); $('lunar-quiz').classList.add('done'); $('lunar-note').hidden = false;
  if (ok) award(1);
  feedback('lunar-feedback', ok ? 'good' : 'miss', `${ok ? '✓ Right! +1 point.' : '✗ Not this time.'} ${q.why}`);
});
$('lunar-guess').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lg]');
  if (!b) return;
  lunarGuess = b.dataset.lg;
  $('lunar-guess').querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
});

function openLunarCase() {
  const c = lunarCase, testable = c.kinds !== undefined;
  $('lunar-step').innerHTML = `Moon case · <span class="tag ${c.tag[0]}">${c.tag[1]}</span>`;
  $('t-lunar').textContent = c.title.replace('★ ', '');
  $('lunar-intro').textContent = c.text;
  for (const id of ['lunar-controls', 'lunar-how', 'lunar-how-title', 'lunar-guess']) $(id).hidden = !testable;
  $('lunar-stat').textContent = ''; $('lunar-note').textContent = ''; $('lunar-chart').innerHTML = '';
  $('lunar-feedback').textContent = ''; lunarGuess = null;
  $('lunar-guess').querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  const quiz = QUIZ[c.id];
  $('lunar-quiz').hidden = !quiz;
  if (quiz) $('lunar-quiz').innerHTML = `<p><b>🔍 Quick question:</b> ${quiz.q}</p><div class="row">${quiz.options.map((o, i) => `<button type="button" class="chip" data-q="${i}">${o}</button>`).join('')}</div>`;
  $('lunar-quiz').classList.remove('done');
  if (!testable) {
    $('lunar-note').hidden = true;
    $('lunar-note').textContent = c.id === 'tides'
      ? 'This is the textbook lunar effect: no statistics needed to see the tide come in twice a day.'
      : 'This effect is well documented by marine biologists; it shows that living things keep time with the Moon.';
    return;
  }
  if (c.kinds === 'tides') {
    // Positive control: tide gauges, where the 18.6-year lunar cycle is known to act.
    $('lunar-place').innerHTML = (TIDES?.stations ?? []).map((s) => `<option value="tide:${esc(s.id)}">${esc(s.name)} tide gauge (${s.years[0]}–${s.years.at(-1)})</option>`).join('');
    $('lunar-var').innerHTML = '<option value="TIDE_RANGE">Tidal range</option>';
    return;
  }
  const places = PLACES.filter((p) => !c.kinds || c.kinds.includes(p.environment));
  $('lunar-place').innerHTML = places.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if (places.some((p) => p.id === 'coropuna')) $('lunar-place').value = 'coropuna';
  $('lunar-var').innerHTML = LUNAR_VARS.map((id) => varById(id)).filter(Boolean).map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('');
}

$('lunar-run').addEventListener('click', async () => {
  const tide = $('lunar-place').value.startsWith('tide:') && TIDES?.stations.find((x) => `tide:${x.id}` === $('lunar-place').value);
  const p = tide ? { short: tide.name } : PLACES.find((x) => x.id === $('lunar-place').value);
  const v = tide ? { name: 'Tidal range' } : varById($('lunar-var').value);
  if (!p || !v) return;
  $('lunar-stat').textContent = tide ? 'Reading NOAA tide gauges…' : 'Asking NASA POWER…'; $('lunar-note').textContent = ''; $('lunar-chart').innerHTML = '';
  try {
    // Tide range is shown in centimetres so a few-cm lunar swing is readable.
    const s = tide ? { years: tide.years, values: tide.values.map((x) => x * 100), units: 'cm' } : await seriesFor(v, p.lat, p.lon, 1981);
    const t = lunarTest(s);
    if (t.status === 'too-short') { $('lunar-stat').textContent = 'Record too short'; $('lunar-note').textContent = `The test needs at least ${LUNAR_MIN_YEARS} years (two full 18.6-year cycles); this record has ${t.n}.`; return; }
    const pv = t.p < 0.001 ? 'p < 0.001' : `p = ${fmt(t.p, 3)}`;
    $('lunar-stat').textContent = t.verdict === 'signal' ? `Moon-like signal (${pv})` : t.verdict === 'hint' ? `A hint, not convincing (${pv})` : `No lunar signal found (${pv})`;
    $('lunar-stat').className = `stat ${t.verdict === 'signal' ? 'up' : ''}`;
    const u = unitOf(s);
    $('lunar-note').textContent = `${v.name} at ${p.short}, ${s.years[0]}–${s.years.at(-1)}: the Moon's rhythm lines up with ${Math.round(t.share * 100)}% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: ${signed(t.swing)}${u ? ' ' + u : ''}. A signal is not proof of cause.`;
    $('lunar-chart').innerHTML = lunarChart(s, t);
    if (tide) $('lunar-note').textContent += ' Source: NOAA CO-OPS tide gauge (monthly mean high and low water).';
    const sawMoon = t.verdict === 'signal' ? 'yes' : 'no';
    if (!lunarGuess) feedback('lunar-feedback', 'close', 'Tip: make a guess before testing to earn points.');
    else if (lunarGuess === sawMoon) { award(1); feedback('lunar-feedback', 'good', `✓ Your guess matched the test. +1 point.`); }
    else feedback('lunar-feedback', 'miss', `✗ Your guess did not match the test${t.verdict === 'hint' ? ' (there is only a weak hint)' : ''}. That is how real research goes!`);
    lunarGuess = null;
    $('lunar-guess').querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  } catch (err) { $('lunar-stat').textContent = 'The test could not run'; $('lunar-note').textContent = powerError(err); }
});

function lunarChart(s, t) {
  const W = 760, H = 210, m = { l: 12, r: 12, t: 16, b: 26 }, n = s.years.length;
  const tt = s.years.map((y) => y - s.years[0]), mt = tt.reduce((a, b) => a + b, 0) / n;
  const detr = (x) => { const mx = x.reduce((a, b) => a + b, 0) / n; const b = tt.reduce((q, ti, i) => q + (ti - mt) * (x[i] - mx), 0) / tt.reduce((q, ti) => q + (ti - mt) ** 2, 0); return x.map((xi, i) => xi - mx - b * (tt[i] - mt)); };
  const r = detr(s.values), l = detr(t.index);
  const z = (a) => { const sd = Math.sqrt(a.reduce((q, x) => q + x * x, 0) / a.length) || 1; return a.map((x) => x / sd); };
  const rz = z(r), lz = z(l), lim = Math.max(2.5, ...rz.map(Math.abs));
  const X = (i) => m.l + (i / (n - 1)) * (W - m.l - m.r), Y = (v) => m.t + ((lim - v) / (2 * lim)) * (H - m.t - m.b);
  const pts = (a) => a.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const marks = [2006, 2015, 2025].filter((y) => s.years.includes(y)).map((y) => { const i = s.years.indexOf(y);
    return `<line x1="${X(i)}" y1="${m.t}" x2="${X(i)}" y2="${H - m.b}" stroke="rgba(255,255,255,.15)"/><text x="${X(i)}" y="${m.t - 4}" fill="currentColor" font-size="11" text-anchor="${i > n - 4 ? 'end' : 'middle'}">${y === 2015 ? 'minor' : 'major'} ${y}</text>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Detrended series compared with the Moon's 18.6-year index" style="max-height:210px">
    ${marks}<line x1="${m.l}" y1="${Y(0)}" x2="${W - m.r}" y2="${Y(0)}" stroke="rgba(255,255,255,.2)"/>
    <polyline points="${pts(rz)}" fill="none" stroke="var(--text-primary)" stroke-width="2"/>
    <polyline points="${pts(lz)}" fill="none" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="8 6"/>
    <text x="${m.l}" y="${H - 8}" fill="currentColor" font-size="12">${s.years[0]}</text><text x="${W - m.r}" y="${H - 8}" fill="currentColor" font-size="12" text-anchor="end">${s.years.at(-1)}</text>
    <text x="${W / 2}" y="${H - 8}" fill="currentColor" font-size="11" text-anchor="middle">white: data without its trend · yellow dashed: the Moon's 18.6-year rhythm</text>
  </svg>`;
}

// --- Start: load the verified catalog and demos if they exist, then draw. ---
async function loadJson(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
}
// Everything the first screen needs loads in parallel; the 5 MB atmosphere grid loads later, in the background.
const [catalog, demos, witnesses, grid, indices, modis, rivers, facts, photos, tides] = await Promise.all(['catalog', 'demos', 'witnesses', 'grid',
  'indices', 'modis', 'rivers', 'place_facts', 'place_photos', 'tides'].map((f) => loadJson(`data/${f}.json`)));
TIDES = tides;
INDICES = indices;
WITNESSES = witnesses;
GRID = grid;
loadJson('data/grid_atmos.json').then((g) => {
  GRID2 = g;
  for (const v of GRID2?.variables ?? []) { v.technical = v.name; v.name = PLAIN[v.id] ?? v.name; }
  if (GRID2?.variables) EXTRA_VARS.push(...GRID2.variables.filter((v) => !EXTRA_VARS.some((x) => x.id === v.id)));
  fillGlobal();
});
if (catalog?.variables?.length) VARIABLES = catalog.variables;
for (const v of VARIABLES) { v.technical = v.name; v.name = PLAIN[v.id] ?? v.name; }
FACTS = facts?.facts ?? {};
PHOTOS = photos?.photos ?? {};
if (catalog?.places?.length) PLACES = catalog.places;
function addExtra(file) {
  if (!file?.extra) return;
  EXTRA_VARS.push(...(file.extraVariables ?? []).filter((v) => !EXTRA_VARS.some((x) => x.id === v.id)));
  for (const [pid, vars] of Object.entries(file.extra)) EXTRA[pid] = { ...(EXTRA[pid] ?? {}), ...vars };
}
addExtra(WITNESSES);
addExtra(modis);
// Rivers become a kind of place. A river whose modelled flow disagrees with its published mean is left out, not shown.
// The expanded catalog already lists some rivers by the same id: keep one place per id.
const goodRivers = (rivers?.places ?? []).filter((p) => !p.quality?.flags?.length && rivers.series[p.id] && !PLACES.some((x) => x.id === p.id));
if (goodRivers.length) {
  PLACES = [...PLACES, ...goodRivers];
  addExtra({
    extraVariables: [{ id: 'DISCHARGE', name: 'River discharge', group: 'Water', units: 'm3/s', source: `${rivers.organization}`,
      // Open-Meteo data are CC BY 4.0: credit and a link must sit next to the data wherever they are shown.
      notice: 'Flood data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>), from the GloFAS reanalysis of the Copernicus Emergency Management Service; annual means computed by Signal or Noise. GloFAS is a model reconstruction from weather data, not a river gauge, so a trend can also reflect changes in the model.',
      definition: 'How much water flows down the river each second, averaged over the year.' }],
    extra: Object.fromEntries(goodRivers.map((p) => [p.id, { DISCHARGE: { ...rivers.series[p.id], source: rivers.organization } }])),
  });
}
if (Array.isArray(demos)) DEMOS = demos;
fillVariables();
renderKinds();
fillCountries();
drawPlaceDots();
selectPlace(PLACES.find((p) => p.id === 'coropuna')?.id ?? PLACES[0].id);
renderDemos();
fillGlobal();
// Classroom mode: mission cases arrive with their NASA series bundled, so a whole class does not hit NASA POWER at once.
classroom = await createClassroom({ $, esc, loadJson, openCase: ({ place, variable, series }) => {
  const p = PLACES.find((x) => x.id === place), v = varById(variable);
  current = { variable: v, place: p.name, lat: p.lat, lon: p.lon, series, r: analyze(series) };
  render(current);
  flyTo(p.lat, p.lon);
  location.hash = '#/evidence';
} });
route();
