// Trend Detective UI: ties the form, NASA POWER and the engine together. Data formats: see README.
import { analyze, fetchPower, fetchPowerMany, scan } from './engine.js';

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

const ENVIRONMENTS = { glacier: 'Glaciers and snow peaks', desert: 'Deserts', rainforest: 'Rainforests', city: 'Large cities', coast: 'Coasts and estuaries', ocean: 'Open ocean', polar: 'Polar regions' };
const VERDICTS = {
  confirmed: { label: '● Confirmed', text: 'In this dataset the trend is statistically significant: it is very unlikely to be chance.' },
  likely: { label: '◐ Likely', text: 'This dataset shows signs of a trend, but not enough to be sure yet.' },
  unknown: { label: '○ Not yet known', text: 'With the data available, a trend cannot be told apart from normal variation.' },
};
const UNITS = { C: '°C', 'mm/day': 'mm/day', 'MJ/m^2/day': 'MJ/m²/day', 1: '(0–1 index)', 'g/kg': 'g/kg', '%': '%', 'm/s': 'm/s', cm: 'cm', kPa: 'kPa', dimensionless: '(index)' };

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (x, d = 2) => x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
// Slopes can be tiny (aerosols: 0.003 per decade), so show at least two significant digits.
const fmtSlope = (x) => { const a = Math.abs(x); return a === 0 || a >= 0.1 ? fmt(x) : x.toLocaleString('en-US', { maximumSignificantDigits: 2 }); };
const signed = (x) => (x > 0 ? '+' : '') + fmtSlope(x);
const unitOf = (s) => UNITS[s.units] ?? s.units;
const SOURCES = { MERRA2: 'MERRA-2', SYN1DEG: 'CERES SYN1deg' };
const sourceOf = (v) => `NASA POWER · ${SOURCES[v.source] ?? v.source}`;
const varById = (id) => VARIABLES.find((v) => v.id === id);
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
    if (!location.hash.startsWith('#/case')) return;
    const id = viewer.scene.pick(e.position)?.id?.id;
    if (typeof id === 'string' && id.startsWith('place:')) return selectPlace(id.slice(6));
    const p = viewer.camera.pickEllipsoid(e.position);
    if (!p) return;
    const g = C.Cartographic.fromCartesian(p);
    $('place').value = '';
    setPoint(+C.Math.toDegrees(g.latitude).toFixed(2), +C.Math.toDegrees(g.longitude).toFixed(2));
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

function selectPlace(id) {
  const p = PLACES.find((x) => x.id === id);
  if (!p) return;
  if ($('environment').value && $('environment').value !== p.environment) { $('environment').value = p.environment; fillPlaceList(); }
  $('place').value = p.id;
  setPoint(p.lat, p.lon);
  flyTo(p.lat, p.lon);
}

const placeName = (lat, lon) => PLACES.find((p) => p.lat === lat && p.lon === lon)?.name ?? `${fmt(lat)}°, ${fmt(lon)}°`;

// --- Views: one at a time, each with its own address so the Back button works. ---
const VIEWS = ['home', 'case', 'leads', 'evidence', 'verdict', 'compare', 'record'];
function route() {
  let v = location.hash.replace('#/', '') || 'home';
  if (!VIEWS.includes(v)) v = 'home';
  const needs = { evidence: current, verdict: current, record: current, leads, compare: current?.other };
  if (v in needs && !needs[v]) { location.replace('#/case'); return; }
  for (const n of VIEWS) $(`view-${n}`).classList.toggle('active', n === v);
  $('skip').hidden = v !== 'home';
  $('compare-banner').hidden = !(v === 'case' && compareWith);
  $(`view-${v}`).querySelector('h1, h2')?.focus();
  if (v === 'home') flyTo(-15.53, -72.65, 160000, 9);
}
addEventListener('hashchange', route);
$('skip').addEventListener('click', () => viewer?.camera.cancelFlight());

// --- Step 1: what and where. ---
function fillVariables() {
  const groups = [...new Set(VARIABLES.map((v) => v.group))];
  $('variables').innerHTML = groups.map((g) => `<li class="group"><h3>${g}</h3><ul class="grid">${
    VARIABLES.filter((v) => v.group === g).map((v) => `
      <li class="card"><label><input type="radio" name="variable" value="${v.id}" ${v.id === 'T2M' ? 'checked' : ''}>
      <strong>${v.name}</strong>${v.definition}</label></li>`).join('')}</ul></li>`).join('');
}
function fillPlaceList() {
  const env = $('environment').value;
  $('place').innerHTML = PLACES.filter((p) => !env || p.environment === env).map((p) => `<option value="${p.id}">${p.name}</option>`).join('')
    + '<option value="" disabled>Other point (click the globe)</option>';
}
function fillEnvironments() {
  const present = [...new Set(PLACES.map((p) => p.environment))];
  $('environment').innerHTML = '<option value="">All kinds of places</option>'
    + present.map((e) => `<option value="${e}">${ENVIRONMENTS[e] ?? e}</option>`).join('');
}
$('environment').addEventListener('change', () => { fillPlaceList(); selectPlace($('place').value); });
$('place').addEventListener('change', () => selectPlace($('place').value));

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
    const caseNow = { variable: v, place, lat, lon, series, r: analyze(series) };
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
    leads = { place, lat, lon, list: scan(all) };
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
  $('t-leads').textContent = `Leads in ${place}`;
  $('leads-intro').textContent = `We tested ${ok.length} variables here. Because testing many variables at once raises the chance of a false alarm, these verdicts are adjusted for multiple testing (Benjamini-Hochberg).`;
  $('leads-list').innerHTML = list.map((l, i) => {
    const v = varById(l.variable);
    if (l.status !== 'ok') return `<li class="lead muted"><strong>${v.name}</strong>: ${l.status === 'no-data' || v.land_only ? 'no data here' : 'does not vary here'}.</li>`;
    const r = l.result;
    return `<li class="lead"><button type="button" class="lead-btn" data-i="${i}">
      <span class="lead-verdict">${VERDICTS[l.verdict].label}</span>
      <strong>${v.name}</strong> ${signed(r.slopePerDecade)} ${unitOf(l.series)} per decade (${r.firstYear}–${r.lastYear})</button></li>`;
  }).join('');
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
function headline({ variable: v, place, series, r }) {
  if (r.slopePerDecade === 0) return `In ${place}, ${v.name.toLowerCase()} shows no measurable change (${r.firstYear}–${r.lastYear})`;
  const up = r.slopePerDecade > 0;
  const howMuch = `${fmtSlope(Math.abs(r.slopePerDecade))} ${unitOf(series)} per decade (${r.firstYear}–${r.lastYear})`;
  return r.verdict === 'confirmed'
    ? `In ${place}, ${v.name.toLowerCase()} ${up ? 'rose' : 'fell'} ${howMuch}`
    : `In ${place}, ${v.name.toLowerCase()} seems to have ${up ? 'risen' : 'fallen'} ${howMuch}, but it is not certain yet`;
}

function render(c) {
  const { variable: v, place, lat, lon, series, r } = c;
  const u = unitOf(series);
  $('t2').textContent = headline(c);
  $('chart').innerHTML = chart(series, r);
  $('chart-caption').textContent = `Annual mean ${v.name.toLowerCase()}. Dashed line: trend (Sen's slope). Source: ${sourceOf(v)}.`;
  $('table').innerHTML = dataTable(series, v, u);
  // shortcut: one witness in live cases; a second source only exists where the catalog lists one.
  $('witnesses').textContent = `One witness: ${sourceOf(v)}. There is no second NASA source measuring the same thing here, so the verdict rests on this one alone.`;

  const vd = VERDICTS[r.verdict];
  $('verdict').textContent = vd.label;
  $('explanation').textContent = vd.text;
  $('clock').textContent = clockText(r);
  $('details').innerHTML = [
    `Years analyzed: ${r.n} (${r.firstYear}–${r.lastYear}), one mean per year to remove the seasonal cycle.`,
    `Sen's slope: ${signed(r.slopePerDecade)} ${u}/decade (95% interval: ${signed(r.slopeCI[0])} to ${signed(r.slopeCI[1])}).`,
    r.autocorrelationCorrected === false
      ? `Mann-Kendall test: p = ${r.p < 0.001 ? '< 0.001' : fmt(r.p, 3)}; Kendall's τ = ${fmt(r.tau)}. The Hamed & Rao autocorrelation correction could not be applied to this series (its correction factor is negative), so the uncorrected test is shown.`
      : `Mann-Kendall test with the Hamed & Rao (1998) autocorrelation correction: p = ${r.p < 0.001 ? '< 0.001' : fmt(r.p, 3)}; Kendall's τ = ${fmt(r.tau)}.`,
    r.q == null
      ? 'Verdict: confirmed if p < 0.05; likely if p < 0.10; otherwise not yet known.'
      : `Verdict from a scan of ${r.tested} variables: it uses the Benjamini-Hochberg adjusted q = ${fmt(r.q, 3)} instead of p (confirmed if q < 0.05; likely if q < 0.10), so testing many variables does not create false alarms.`,
    'Clock: years needed to detect the current slope with 90% probability (α = 0.05) under autocorrelated noise, following the approach of Weatherhead et al. (1998). It is an approximation that assumes the trend and the noise stay the same.',
  ].map((t) => `<li>${t}</li>`).join('');

  $('record').innerHTML = [
    ['What', `${v.name} (${v.id})`], ['Where', `${place} (${fmt(lat)}°, ${fmt(lon)}°)`],
    ['How much', `${signed(r.slopePerDecade)} ${u} per decade`], ['Verdict', `${vd.label}. ${clockText(r)}`],
    ['Witnesses', sourceOf(v)], ['Method', "Annual means · Sen's slope · Mann-Kendall (Hamed & Rao)"],
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

const dataTable = (s, v, u) => `<table><thead><tr><th>Year</th><th>${v.name} (${u})</th></tr></thead><tbody>${
  s.years.map((y, i) => `<tr><td>${y}</td><td>${fmt(s.values[i])}</td></tr>`).join('')}</tbody></table>`;

function chart(s, r) {
  const W = 760, H = 260, m = { l: 48, r: 12, t: 12, b: 28 };
  const x0 = s.years[0], x1 = s.years.at(-1);
  const lo = Math.min(...s.values), hi = Math.max(...s.values), pad = (hi - lo) * 0.1 || 1;
  const X = (y) => m.l + ((y - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - m.t - m.b);
  const line = s.years.map((y, i) => `${X(y)},${Y(s.values[i])}`).join(' ');
  const slope = r.slopePerDecade / 10;
  const median = (a) => { const b = [...a].sort((p, q) => p - q); return b[b.length >> 1]; };
  const b0 = median(s.values.map((v, i) => v - slope * s.years[i]));
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Annual series of ${s.years.length} years with its trend line" style="max-height:300px">
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
  if (b2) { renderCompare(current); $('compare-summary').textContent += ` ${d.why}`; location.hash = '#/compare'; }
  else { $('chart-caption').textContent += ` ${d.why}`; location.hash = '#/evidence'; }
  const first = PLACES.find((x) => x.id === a);
  if (first) flyTo(first.lat, first.lon, 4000000);
});

// --- Start: load the verified catalog and demos if they exist, then draw. ---
async function loadJson(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
}
const [catalog, demos] = await Promise.all([loadJson('data/catalog.json'), loadJson('data/demos.json')]);
if (catalog?.variables?.length) VARIABLES = catalog.variables;
if (catalog?.places?.length) PLACES = catalog.places;
if (Array.isArray(demos)) DEMOS = demos;
fillVariables();
fillEnvironments();
fillPlaceList();
drawPlaceDots();
selectPlace(PLACES.find((p) => p.id === 'coropuna')?.id ?? PLACES[0].id);
renderDemos();
route();
