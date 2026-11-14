// Trend Detective UI: ties the form, NASA POWER and the engine together. Data contract: see README.
import { analyze, fetchPower } from './engine.js';

const VARIABLES = [
  { id: 'T2M', name: 'Temperature', def: 'How warm the air is, 2 m above the ground.' },
  { id: 'T2M_MAX', name: 'Maximum temperature', def: 'The hottest temperature of each day, on average.' },
  { id: 'PRECTOTCORR', name: 'Precipitation', def: 'How much water falls (rain and snow), per day.' },
  // From 2001 only: earlier years come from a different product (SRB), and splicing both creates false trends.
  { id: 'ALLSKY_SFC_SW_DWN', name: 'Solar radiation', def: 'How much energy from the Sun reaches the ground.', start: 2001 },
  { id: 'RH2M', name: 'Air humidity', def: 'How much water vapor the air holds, relative to its maximum.' },
  { id: 'WS2M', name: 'Wind', def: 'How fast the air moves, 2 m above the ground.' },
  { id: 'GWETROOT', name: 'Soil moisture', def: 'How wet the soil is where roots drink (0 dry, 1 saturated).' },
];
const PLACES = [
  { name: 'Nevado Coropuna, Arequipa (Peru)', lat: -15.53, lon: -72.65 },
  { name: 'Arequipa city (Peru)', lat: -16.4, lon: -71.54 },
  { name: 'Lima (Peru)', lat: -12.05, lon: -77.04 },
  { name: 'Cusco (Peru)', lat: -13.53, lon: -71.97 },
  { name: 'Iquitos, Amazon (Peru)', lat: -3.75, lon: -73.25 },
];
const VERDICTS = {
  confirmed: { label: '● Confirmed', text: 'In this dataset the trend is statistically significant: it is very unlikely to be chance.' },
  likely: { label: '◐ Likely', text: 'This dataset shows signs of a trend, but not enough to be sure yet.' },
  unknown: { label: '○ Not yet known', text: 'With the data available, a trend cannot be told apart from normal variation.' },
};
const UNITS = { C: '°C', 'mm/day': 'mm/day', 'MJ/m^2/day': 'MJ/m²/day', 1: '(0–1 index)' };

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (x, d = 2) => x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const signed = (x) => (x > 0 ? '+' : '') + fmt(x);
let current = null;

// --- Full-screen globe: NASA GIBS imagery, no API keys needed. ---
let viewer = null, marker = null;
try {
  const C = window.Cesium;
  const gibs = new C.WebMapTileServiceImageryProvider({
    // shortcut: Blue Marble tops out at ~600 m/pixel, so close-ups are blurry; add Landsat or MODIS layers for the Coropuna case.
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
    point: { pixelSize: 10, color: C.Color.fromCssColorString('#00d4ff'), outlineColor: C.Color.BLACK, outlineWidth: 1 },
    label: { text: 'Coropuna', font: '14px Inter, sans-serif', pixelOffset: new C.Cartesian2(0, -20), showBackground: true },
  });
  // Clicking the globe picks the place for the case.
  new C.ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction((e) => {
    const p = viewer.camera.pickEllipsoid(e.position);
    if (!p || !location.hash.startsWith('#/case')) return;
    const g = C.Cartographic.fromCartesian(p);
    setPoint(+C.Math.toDegrees(g.latitude).toFixed(2), +C.Math.toDegrees(g.longitude).toFixed(2), 'Selected point');
  }, C.ScreenSpaceEventType.LEFT_CLICK);
} catch (e) {
  console.warn('Globe unavailable:', e);
  $('no3d').hidden = false;
}

function flyTo(lat, lon, height = 900000, seconds = 3) {
  if (!viewer) return;
  const destination = window.Cesium.Cartesian3.fromDegrees(lon, lat, height);
  if (reducedMotion) viewer.camera.setView({ destination });
  else viewer.camera.flyTo({ destination, duration: seconds });
}

function setPoint(lat, lon, name) {
  $('lat').value = lat; $('lon').value = lon;
  if (marker) {
    marker.position = window.Cesium.Cartesian3.fromDegrees(lon, lat);
    marker.label.text = name;
  }
}

// --- Views: one at a time, each with its own address so the Back button works. ---
const VIEWS = ['home', 'case', 'evidence', 'verdict', 'record'];
function route() {
  let v = location.hash.replace('#/', '') || 'home';
  if (!VIEWS.includes(v)) v = 'home';
  if (['evidence', 'verdict', 'record'].includes(v) && !current) { location.replace('#/case'); return; }
  for (const n of VIEWS) $(`view-${n}`).classList.toggle('active', n === v);
  $('skip').hidden = v !== 'home';
  $(`view-${v}`).querySelector('h1, h2')?.focus();
  if (v === 'home') flyTo(-15.53, -72.65, 160000, 9);
}
addEventListener('hashchange', route);
$('skip').addEventListener('click', () => viewer?.camera.cancelFlight());

$('variables').innerHTML = VARIABLES.map((v, i) => `
  <li class="card"><label><input type="radio" name="variable" value="${v.id}" ${i ? '' : 'checked'}>
  <strong>${v.name}</strong>${v.def}</label></li>`).join('');
$('place').innerHTML = PLACES.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
$('place').addEventListener('change', () => { const p = PLACES[$('place').value]; setPoint(p.lat, p.lon, p.name); flyTo(p.lat, p.lon); });
setPoint(PLACES[0].lat, PLACES[0].lon, PLACES[0].name);
route();

$('case-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = VARIABLES.find((x) => x.id === new FormData(e.target).get('variable'));
  const lat = +$('lat').value, lon = +$('lon').value;
  const place = PLACES.find((p) => p.lat === lat && p.lon === lon)?.name ?? `${fmt(lat)}°, ${fmt(lon)}°`;
  $('status').textContent = 'Asking NASA POWER…';
  try {
    const series = await fetchPower(v.id, lat, lon, v.start);
    const r = analyze(series);
    current = { variable: v, place, lat, lon, series, r };
    render(current);
    $('status').textContent = '';
    flyTo(lat, lon);
    location.hash = '#/evidence';
  } catch (err) {
    $('status').textContent = `The case could not be completed: ${err.message}`;
  }
});

function render({ variable: v, place, lat, lon, series, r }) {
  const u = UNITS[series.units] ?? series.units;
  const up = r.slopePerDecade >= 0;
  const howMuch = `${fmt(Math.abs(r.slopePerDecade))} ${u} per decade (${r.firstYear}–${r.lastYear})`;
  $('t2').textContent = r.verdict === 'confirmed'
    ? `In ${place}, ${v.name.toLowerCase()} ${up ? 'rose' : 'fell'} ${howMuch}`
    : `In ${place}, ${v.name.toLowerCase()} seems to have ${up ? 'risen' : 'fallen'} ${howMuch}, but it is not certain yet`;
  $('chart').innerHTML = chart(series, r);
  $('chart-caption').textContent = `Annual mean ${v.name.toLowerCase()}. Dashed line: trend (Sen's slope). Source: ${series.source}.`;
  $('table').innerHTML = `<table><thead><tr><th>Year</th><th>${v.name} (${u})</th></tr></thead><tbody>${
    series.years.map((y, i) => `<tr><td>${y}</td><td>${fmt(series.values[i])}</td></tr>`).join('')}</tbody></table>`;
  // shortcut: one witness in live cases; a second source only exists for precomputed cases.
  $('witnesses').textContent = `One witness: ${series.source}. There is no second NASA source measuring the same thing here, so the verdict rests on this one alone.`;

  const vd = VERDICTS[r.verdict];
  $('verdict').textContent = vd.label;
  $('explanation').textContent = vd.text;
  $('clock').textContent = r.verdict === 'confirmed'
    ? (r.knownSince ? `Known with confidence since ${r.knownSince}.` : '')
    : r.yearsNeeded === Infinity || r.yearsNeeded > 100
      ? 'No clear signal: not even a century more of data could confirm this trend.'
      : r.yearsNeeded <= 1
        ? 'On the edge: one or two more years of data could confirm it.'
        : `If the trend continues, about ${r.yearsNeeded} more years of data would be needed to confirm it.`;
  $('details').innerHTML = [
    `Years analyzed: ${r.n} (${r.firstYear}–${r.lastYear}), one mean per year to remove the seasonal cycle.`,
    `Sen's slope: ${signed(r.slopePerDecade)} ${u}/decade (95% interval: ${signed(r.slopeCI[0])} to ${signed(r.slopeCI[1])}).`,
    `Mann-Kendall test with the Hamed & Rao (1998) autocorrelation correction: p = ${r.p < 0.001 ? '< 0.001' : fmt(r.p, 3)}; Kendall's τ = ${fmt(r.tau)}.`,
    'Verdict: confirmed if p < 0.05; likely if p < 0.10; otherwise not yet known.',
    'Clock: years needed to detect the current slope with 90% probability (α = 0.05) under autocorrelated noise, following the approach of Weatherhead et al. (1998). It is an approximation that assumes the trend and the noise stay the same.',
  ].map((t) => `<li>${t}</li>`).join('');

  $('record').innerHTML = [
    ['What', `${v.name} (${v.id})`], ['Where', `${place} (${fmt(lat)}°, ${fmt(lon)}°)`],
    ['How much', `${signed(r.slopePerDecade)} ${u} per decade`], ['Verdict', `${vd.label}. ${$('clock').textContent}`],
    ['Witnesses', series.source], ['Method', "Annual means · Sen's slope · Mann-Kendall (Hamed & Rao)"],
  ].map(([k, val]) => `<tr><th scope="row">${k}</th><td>${val}</td></tr>`).join('');
}

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
  const blob = new Blob([JSON.stringify({ variable: variable.id, place, lat, lon, result: r, series }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `case_${variable.id}_${lat}_${lon}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});
