// Trend Detective UI: ties the form, NASA POWER and the engine together. Data formats: see README.
import { alibiTest, analyze, blockShuffle, compareWitnesses, fetchPower, fetchPowerMany, predictionTest, scan } from './engine.js';

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
  ALLSKY_SFC_SW_DWN: 'Sunlight', CLOUD_AMT: 'Cloud cover', WS2M: 'Wind', AOD_55: 'Haze (dust and smoke)' };
let FACTS = {};
const VERDICTS = {
  confirmed: { label: '● Confirmed', text: 'A real change: very unlikely to be chance.' },
  likely: { label: '◐ Likely', text: 'Signs of a change, but not enough to be sure.' },
  unknown: { label: '○ Not yet known', text: 'Too early to tell this apart from normal ups and downs.' },
};
const UNITS = { C: '°C', 'mm/day': 'mm/day', 'MJ/m^2/day': 'MJ/m²/day', 1: '', 'g/kg': 'g/kg', '%': '%', 'm/s': 'm/s', cm: 'cm', kPa: 'kPa', dimensionless: '', days: 'days', 'm3/s': 'm³/s', 'kg C/m2/yr': 'kg C/m²/yr' };

const $ = (id) => document.getElementById(id);
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
    point: { pixelSize: 7, color: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 1 },
    label: { text: p.short, font: '12px Inter, sans-serif', pixelOffset: new C.Cartesian2(0, -14), fillColor: C.Color.WHITE,
             showBackground: true, backgroundColor: C.Color.fromCssColorString('rgba(10,10,15,.7)'),
             distanceDisplayCondition: new C.DistanceDisplayCondition(0, 12000000) },
  });
}

function flyTo(lat, lon, height = 900000, seconds = 3) {
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
  if (f.mean_precip_mm_day != null) bits.push(`${fmt(f.mean_precip_mm_day * 365 / 1000, 1)} m rain/yr`);
  if (f.warming_c_per_decade != null) bits.push(`${signed(f.warming_c_per_decade)} °C/decade`);
  return bits.join(' · ');
}

function renderPlaces() {
  const list = PLACES.filter((p) => !kindFilter || p.environment === kindFilter);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  $('place-cards').innerHTML = list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map((p) => `
    <button type="button" class="place" data-id="${p.id}" aria-pressed="${p.id === selectedPlace}" title="${FACTS[p.id]?.one_line ?? p.name}">
      <img src="img/places/${p.id}.jpg" alt="Satellite image of ${p.short}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'noimg'}))">
      <span class="kind">${ENVIRONMENTS[p.environment] ?? p.environment}</span>
      <b>${p.short}</b><small>${factLine(p)}</small>
    </button>`).join('');
  $('page-info').textContent = `${page + 1} / ${pages} · ${list.length} places`;
  $('prev-page').disabled = page === 0;
  $('next-page').disabled = page >= pages - 1;
  const sel = PLACES.find((p) => p.id === selectedPlace);
  $('point-summary').textContent = sel ? `${sel.name}${FACTS[sel.id]?.one_line ? ` — ${FACTS[sel.id].one_line}` : ''}` : `Point ${$('lat').value}°, ${$('lon').value}° (or type coordinates)`;
}
$('place-cards').addEventListener('click', (e) => { const b = e.target.closest('.place'); if (b) selectPlace(b.dataset.id); });
$('prev-page').addEventListener('click', () => { page--; renderPlaces(); });
$('next-page').addEventListener('click', () => { page++; renderPlaces(); });

const placeName = (lat, lon) => PLACES.find((p) => p.lat === lat && p.lon === lon)?.name ?? `${fmt(lat)}°, ${fmt(lon)}°`;
const shortName = (c) => PLACES.find((p) => p.lat === c.lat && p.lon === c.lon)?.short ?? c.place;

// --- Views: one at a time, each with its own address so the Back button works. ---
const VIEWS = ['home', 'global', 'case', 'leads', 'evidence', 'verdict', 'lineup', 'compare', 'record'];
function route() {
  let v = location.hash.replace('#/', '') || 'home';
  if (!VIEWS.includes(v)) v = 'home';
  const needs = { evidence: current, verdict: current, record: current, lineup: current, leads, compare: current?.other, global: GRID };
  if (v in needs && !needs[v]) { location.replace('#/case'); return; }
  for (const n of VIEWS) $(`view-${n}`).classList.toggle('active', n === v);
  $('skip').hidden = v !== 'home';
  $('compare-banner').hidden = !(v === 'case' && compareWith);
  $(`view-${v}`).querySelector('h1, h2')?.focus();
  if (gridLayer) gridLayer.show = v === 'global';
  viewer?.entities.values.forEach((e) => { if (String(e.id).startsWith('place:')) e.show = v !== 'global'; });
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
    const series = await fetchPower(v.id, lat, lon, v.start ?? 1981);
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
    $('status').textContent = `The case could not be completed: ${err.message}`;
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
    $('status').textContent = `The scan could not be completed: ${err.message}`;
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

  // Verdict: the label, one sentence, and one line per detective check.
  const vd = VERDICTS[r.verdict];
  $('verdict').textContent = vd.label;
  $('explanation').textContent = vd.text;
  const checks = [];
  if (r.verdict === 'confirmed') checks.push(['yes', r.knownSince ? `Clear since ${r.knownSince}` : 'A clear trend']);
  else if (r.adjusted) checks.push(['maybe', `Strong alone, but not after testing ${r.tested} things at once`]);
  else if (r.yearsNeeded === Infinity || r.yearsNeeded > 100) checks.push(['maybe', 'No signal: even 100 more years may not settle it']);
  else checks.push(['maybe', `About ${Math.max(1, r.yearsNeeded)} more years of data would settle it`]);
  const tt = r.ttest, ttConfirmed = tt.p < 0.05;
  const sameCall = ttConfirmed === (r.verdict === 'confirmed') && Math.sign(tt.slopePerDecade) === Math.sign(r.slopePerDecade);
  checks.push(sameCall ? ['yes', 'A second test agrees'] : ['no', 'A second test disagrees: trust it less']);
  const pt = predictionTest(series);
  if (pt) checks.push(pt.skill > 0.1 ? ['yes', `Predicts ${pt.testYears[0]}–${pt.testYears[1]} better than "no change"`]
    : pt.skill < -0.1 ? ['no', `Predicts ${pt.testYears[0]}–${pt.testYears[1]} worse than "no change"`]
      : ['maybe', `Predicts ${pt.testYears[0]}–${pt.testYears[1]} no better than "no change"`]);
  const alibis = !INDICES ? [] : ['ENSO', 'PDO'].map((k) => ({ idx: INDICES[k], a: alibiTest(series, INDICES[k]) })).filter((x) => x.a);
  if (alibis.length) {
    const short = { ENSO: 'El Niño', PDO: 'the PDO' };
    const weak = alibis.filter((x) => r.verdict === 'confirmed' && x.a.after.verdict !== 'confirmed');
    checks.push(r.verdict !== 'confirmed' ? ['maybe', `El Niño explains ${Math.round(alibis[0].a.share * 100)}% of the ups and downs`]
      : weak.length ? ['maybe', `Partly explained by ${weak.map((x) => short[Object.keys(INDICES).find((k) => INDICES[k] === x.idx)]).join(' and ')}`]
        : ['yes', 'Not explained by El Niño or the PDO']);
  }
  checks.push(!c.witness ? ['maybe', 'Only one dataset here'] : c.witness.status === 'corroborated' ? ['yes', 'A second dataset agrees']
    : c.witness.status === 'contradicted' ? ['no', 'A second dataset disagrees'] : ['maybe', 'A second dataset sees no clear trend']);
  const saw = r.verdict === 'unknown' ? 'none' : r.slopePerDecade > 0 ? 'up' : 'down';
  const words = { up: 'rises', down: 'falls', none: 'no change' };
  if (c.hunch && c.hunch !== 'unsure') checks.push(c.hunch === saw ? ['yes', 'Your hunch was right'] : ['no', `Your hunch (${words[c.hunch]}) did not match: follow the evidence`]);
  const icon = { yes: '✓', no: '✗', maybe: '?' }, said = { yes: 'passed', no: 'failed', maybe: 'open' };
  $('checks').innerHTML = checks.map(([k, t]) => `<li><span class="ic ${k}" aria-label="${said[k]}">${icon[k]}</span><span>${t}</span></li>`).join('');

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
    return { variable: v, place: p.name, lat: p.lat, lon: p.lon, series, r: analyze(series) };
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
function stopTour() { clearTimeout(tourTimer); $('tour').hidden = true; }
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
    + (more.length ? `<optgroup label="Atmosphere, land and satellites · NASA (precomputed)">${more.map((v) => `<option value="${v.id}">${v.name} (${v.source.split(' (')[0]})</option>`).join('')}</optgroup>` : '');
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

// --- Start: load the verified catalog and demos if they exist, then draw. ---
async function loadJson(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
}
const [catalog, demos, witnesses, grid, indices] = await Promise.all([loadJson('data/catalog.json'), loadJson('data/demos.json'),
  loadJson('data/witnesses.json'), loadJson('data/grid.json'), loadJson('data/indices.json')]);
INDICES = indices;
const [modis, rivers] = await Promise.all([loadJson('data/modis.json'), loadJson('data/rivers.json')]);
WITNESSES = witnesses;
GRID = grid;
GRID2 = await loadJson('data/grid_atmos.json');
if (GRID2?.variables) EXTRA_VARS.push(...GRID2.variables.filter((v) => !EXTRA_VARS.some((x) => x.id === v.id)));
if (catalog?.variables?.length) VARIABLES = catalog.variables;
for (const v of VARIABLES) { v.technical = v.name; v.name = PLAIN[v.id] ?? v.name; }
FACTS = (await loadJson('data/place_facts.json'))?.facts ?? {};
if (catalog?.places?.length) PLACES = catalog.places;
function addExtra(file) {
  if (!file?.extra) return;
  EXTRA_VARS.push(...(file.extraVariables ?? []).filter((v) => !EXTRA_VARS.some((x) => x.id === v.id)));
  for (const [pid, vars] of Object.entries(file.extra)) EXTRA[pid] = { ...(EXTRA[pid] ?? {}), ...vars };
}
addExtra(WITNESSES);
addExtra(modis);
// Rivers become a kind of place. A river whose modelled flow disagrees with its published mean is left out, not shown.
const goodRivers = (rivers?.places ?? []).filter((p) => !p.quality?.flags?.length && rivers.series[p.id]);
if (goodRivers.length) {
  PLACES = [...PLACES, ...goodRivers];
  addExtra({
    extraVariables: [{ id: 'DISCHARGE', name: 'River discharge', group: 'Water', units: 'm3/s', source: `${rivers.organization}`,
      // Open-Meteo data are CC BY 4.0: credit and a link must sit next to the data wherever they are shown.
      notice: 'Flood data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>), from the GloFAS reanalysis of the Copernicus Emergency Management Service; annual means computed by Trend Detective. GloFAS is a model reconstruction from weather data, not a river gauge, so a trend can also reflect changes in the model.',
      definition: 'How much water flows down the river each second, averaged over the year.' }],
    extra: Object.fromEntries(goodRivers.map((p) => [p.id, { DISCHARGE: { ...rivers.series[p.id], source: rivers.organization } }])),
  });
}
if (Array.isArray(demos)) DEMOS = demos;
fillVariables();
renderKinds();
drawPlaceDots();
selectPlace(PLACES.find((p) => p.id === 'coropuna')?.id ?? PLACES[0].id);
renderDemos();
fillGlobal();
route();
