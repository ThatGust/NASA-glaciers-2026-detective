// Interfaz del detective: une el formulario, NASA POWER y el motor. Contrato: context/CONTRATO_DATOS.md.
import { analyze, fetchPower } from './engine.js';

const VARIABLES = [
  { id: 'T2M', name: 'Temperatura', def: 'Qué tan caliente está el aire, a 2 m del suelo.', verbo: ['subió', 'bajó'] },
  { id: 'T2M_MAX', name: 'Temperatura máxima', def: 'La temperatura más alta de cada día, en promedio.', verbo: ['subió', 'bajó'] },
  { id: 'PRECTOTCORR', name: 'Lluvia', def: 'Cuánta agua cae (lluvia y nieve), por día.', verbo: ['aumentó', 'disminuyó'] },
  // Desde 2001: antes NASA POWER usa otro producto (SRB) y mezclar ambos crea tendencias falsas.
  { id: 'ALLSKY_SFC_SW_DWN', name: 'Radiación solar', def: 'Cuánta energía del Sol llega al suelo.', verbo: ['aumentó', 'disminuyó'], start: 2001 },
  { id: 'RH2M', name: 'Humedad del aire', def: 'Qué tan cargado de vapor de agua está el aire.', verbo: ['aumentó', 'disminuyó'] },
  { id: 'WS2M', name: 'Viento', def: 'Qué tan rápido se mueve el aire, a 2 m del suelo.', verbo: ['aumentó', 'disminuyó'] },
  { id: 'GWETROOT', name: 'Humedad del suelo', def: 'Qué tan húmeda está la tierra donde beben las raíces (0 seco, 1 saturado).', verbo: ['aumentó', 'disminuyó'] },
];
const LUGARES = [
  { name: 'Nevado Coropuna, Arequipa', lat: -15.53, lon: -72.65 },
  { name: 'Ciudad de Arequipa', lat: -16.4, lon: -71.54 },
  { name: 'Lima', lat: -12.05, lon: -77.04 },
  { name: 'Cusco', lat: -13.53, lon: -71.97 },
  { name: 'Iquitos (Amazonía)', lat: -3.75, lon: -73.25 },
];
const VEREDICTOS = {
  confirmed: { label: '● Confirmado', text: 'En estos datos, la tendencia es estadísticamente significativa: es muy poco probable que sea casualidad.' },
  likely: { label: '◐ Probable', text: 'En estos datos hay señales de tendencia, pero todavía no bastan para estar seguros.' },
  unknown: { label: '○ Aún no se sabe', text: 'Con los datos que hay, no se puede distinguir una tendencia de la variación normal.' },
};

const $ = (id) => document.getElementById(id);
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Globo a pantalla completa: imágenes de NASA GIBS, sin claves (D-21). ---
let viewer = null, marcador = null;
try {
  const C = window.Cesium;
  const gibs = new C.WebMapTileServiceImageryProvider({
    // shortcut: Blue Marble llega a ~600 m/píxel; de cerca se ve borroso. Para el caso Coropuna, añadir Landsat o MODIS.
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{TileMatrix}/{TileRow}/{TileCol}.jpeg',
    layer: 'BlueMarble_ShadedRelief_Bathymetry', style: 'default', tileMatrixSetID: 'GoogleMapsCompatible_Level8', format: 'image/jpeg', maximumLevel: 8,
  });
  viewer = new C.Viewer('globo', {
    baseLayer: new C.ImageryLayer(gibs), baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
  });
  viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(-60, -10, 22000000) });
  marcador = viewer.entities.add({
    position: C.Cartesian3.fromDegrees(-72.65, -15.53),
    point: { pixelSize: 10, color: C.Color.fromCssColorString('#00d4ff'), outlineColor: C.Color.BLACK, outlineWidth: 1 },
    label: { text: 'Nevado Coropuna', font: '14px Inter, sans-serif', pixelOffset: new C.Cartesian2(0, -20), showBackground: true },
  });
  // Clic en el globo: elige el lugar del caso.
  new C.ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction((e) => {
    const p = viewer.camera.pickEllipsoid(e.position);
    if (!p || !location.hash.startsWith('#/caso')) return;
    const g = C.Cartographic.fromCartesian(p);
    ponerPunto(+C.Math.toDegrees(g.latitude).toFixed(2), +C.Math.toDegrees(g.longitude).toFixed(2), 'Punto elegido');
  }, C.ScreenSpaceEventType.LEFT_CLICK);
} catch (e) {
  console.warn('Globo no disponible:', e);
  $('sin3d').hidden = false;
}

function volarA(lat, lon, alto = 900000, segundos = 3) {
  if (!viewer) return;
  const destino = window.Cesium.Cartesian3.fromDegrees(lon, lat, alto);
  if (quieto) viewer.camera.setView({ destination: destino });
  else viewer.camera.flyTo({ destination: destino, duration: segundos });
}

function ponerPunto(lat, lon, nombre) {
  $('lat').value = lat; $('lon').value = lon;
  if (marcador) {
    marcador.position = window.Cesium.Cartesian3.fromDegrees(lon, lat);
    marcador.label.text = nombre;
  }
}

// --- Vistas: una a la vez, con dirección propia para que el botón Atrás funcione. ---
const VISTAS = ['inicio', 'caso', 'evidencia', 'veredicto', 'expediente'];
function irA() {
  let v = location.hash.replace('#/', '') || 'inicio';
  if (!VISTAS.includes(v)) v = 'inicio';
  if (['evidencia', 'veredicto', 'expediente'].includes(v) && !ultimo) { location.replace('#/caso'); return; }
  for (const n of VISTAS) $(`vista-${n}`).classList.toggle('activa', n === v);
  $('saltar').hidden = v !== 'inicio';
  $(`vista-${v}`).querySelector('h1, h2')?.focus();
  if (v === 'inicio') volarA(-15.53, -72.65, 160000, 9);
}
addEventListener('hashchange', irA);
$('saltar').addEventListener('click', () => viewer?.camera.cancelFlight());
const fmt = (x, d = 2) => x.toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });
const signo = (x) => (x > 0 ? '+' : '') + fmt(x);
let ultimo = null;

$('variables').innerHTML = VARIABLES.map((v, i) => `
  <li class="tarjeta"><label><input type="radio" name="variable" value="${v.id}" ${i ? '' : 'checked'}>
  <strong>${v.name}</strong>${v.def}</label></li>`).join('');
$('lugar').innerHTML = LUGARES.map((l, i) => `<option value="${i}">${l.name}</option>`).join('');
const ponerLugar = () => { const l = LUGARES[$('lugar').value]; ponerPunto(l.lat, l.lon, l.name); volarA(l.lat, l.lon); };
$('lugar').addEventListener('change', ponerLugar);
ponerPunto(LUGARES[0].lat, LUGARES[0].lon, LUGARES[0].name);
irA();

$('caso').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = VARIABLES.find((x) => x.id === new FormData(e.target).get('variable'));
  const lat = +$('lat').value, lon = +$('lon').value;
  const lugar = LUGARES.find((l) => l.lat === lat && l.lon === lon)?.name ?? `${fmt(lat)}°, ${fmt(lon)}°`;
  $('estado').textContent = 'Consultando a NASA POWER…';
  try {
    const serie = await fetchPower(v.id, lat, lon, v.start);
    const r = analyze(serie);
    ultimo = { variable: v, lugar, lat, lon, serie, r };
    mostrar(ultimo);
    $('estado').textContent = '';
    volarA(lat, lon);
    location.hash = '#/evidencia';
  } catch (err) {
    $('estado').textContent = `No se pudo completar el caso: ${err.message}`;
  }
});

function mostrar({ variable: v, lugar, serie, r }) {
  const u = { C: '°C', 'mm/day': 'mm/día', 'MJ/m^2/day': 'MJ/m²/día', 1: '(índice 0–1)' }[serie.units] ?? serie.units;
  const dir = r.slopePerDecade >= 0 ? v.verbo[0] : v.verbo[1];
  const cuanto = `${fmt(Math.abs(r.slopePerDecade))} ${u} por década (${r.firstYear}–${r.lastYear})`;
  $('t2').textContent = r.verdict === 'confirmed'
    ? `En ${lugar}, la ${v.name.toLowerCase()} ${dir} ${cuanto}`
    : `En ${lugar}, la ${v.name.toLowerCase()} parece haber ${dir === v.verbo[0] ? 'subido' : 'bajado'} ${cuanto}, pero aún no es seguro`;
  $('grafico').innerHTML = grafico(serie, r);
  $('pie-grafico').textContent = `Media anual de ${v.name.toLowerCase()}. Línea discontinua: tendencia (pendiente de Sen). Fuente: ${serie.source}.`;
  $('tabla').innerHTML = `<table><thead><tr><th>Año</th><th>${v.name} (${u})</th></tr></thead><tbody>${
    serie.years.map((y, i) => `<tr><td>${y}</td><td>${fmt(serie.values[i])}</td></tr>`).join('')}</tbody></table>`;
  // shortcut: un solo testigo en vivo; el segundo (p. ej. GPM) solo existe en los casos precalculados
  $('testigos').textContent = `Un solo testigo: ${serie.source}. Para este lugar no hay una segunda fuente de la NASA que mida lo mismo, así que el veredicto se apoya solo en ella.`;

  const vd = VEREDICTOS[r.verdict];
  $('veredicto').textContent = vd.label;
  $('explicacion').textContent = vd.text;
  $('reloj').textContent = r.verdict === 'confirmed'
    ? (r.knownSince ? `Se sabe con certeza desde ${r.knownSince}.` : '')
    : r.yearsNeeded === Infinity || r.yearsNeeded > 100
      ? 'No hay una señal clara: ni con un siglo más de datos se podría confirmar esta tendencia.'
      : r.yearsNeeded <= 1
        ? 'Está al borde: con uno o dos años más de datos podría confirmarse.'
        : `Si la tendencia sigue igual, harían falta unos ${r.yearsNeeded} años más de datos para confirmarla.`;
  $('detalle').innerHTML = [
    `Años analizados: ${r.n} (${r.firstYear}–${r.lastYear}), una media por año para quitar el ciclo de las estaciones.`,
    `Pendiente de Sen: ${signo(r.slopePerDecade)} ${u}/década (intervalo del 95 %: ${signo(r.slopeCI[0])} a ${signo(r.slopeCI[1])}).`,
    `Prueba de Mann-Kendall con corrección de Hamed y Rao (1998) por autocorrelación: p = ${r.p < 0.001 ? '< 0,001' : fmt(r.p, 3)}; τ de Kendall = ${fmt(r.tau)}.`,
    'Veredicto: confirmado si p < 0,05; probable si p < 0,10; si no, aún no se sabe.',
    'Reloj: años para detectar la pendiente actual con un 90 % de probabilidad (α = 0,05), con ruido autocorrelacionado, siguiendo el enfoque de Weatherhead et al. (1998). Es una aproximación: supone que la tendencia y el ruido siguen iguales.',
  ].map((t) => `<li>${t}</li>`).join('');

  $('expediente').innerHTML = [
    ['Qué', `${v.name} (${v.id})`], ['Dónde', `${lugar} (${fmt(ultimo.lat)}°, ${fmt(ultimo.lon)}°)`],
    ['Cuánto', `${signo(r.slopePerDecade)} ${u} por década`], ['Veredicto', `${vd.label}. ${$('reloj').textContent}`],
    ['Testigos', serie.source], ['Método', 'Medias anuales · pendiente de Sen · Mann-Kendall (Hamed y Rao)'],
  ].map(([k, val]) => `<tr><th scope="row">${k}</th><td>${val}</td></tr>`).join('');
}

function grafico(s, r) {
  const W = 760, H = 260, m = { l: 48, r: 12, t: 12, b: 28 };
  const x0 = s.years[0], x1 = s.years.at(-1);
  const lo = Math.min(...s.values), hi = Math.max(...s.values), pad = (hi - lo) * 0.1 || 1;
  const X = (y) => m.l + ((y - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - m.t - m.b);
  const linea = s.years.map((y, i) => `${X(y)},${Y(s.values[i])}`).join(' ');
  const pend = r.slopePerDecade / 10;
  const med = (a) => { const b = [...a].sort((p, q) => p - q); return b[b.length >> 1]; };
  const b0 = med(s.values.map((v, i) => v - pend * s.years[i]));
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Serie anual de ${s.years.length} años con su línea de tendencia" style="max-height:300px">
    <line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="rgba(255,255,255,.3)"/>
    <text x="${m.l}" y="${H - 8}" fill="currentColor" font-size="12">${x0}</text>
    <text x="${W - m.r}" y="${H - 8}" fill="currentColor" font-size="12" text-anchor="end">${x1}</text>
    <text x="4" y="${Y(hi)}" fill="currentColor" font-size="12">${fmt(hi, 1)}</text>
    <text x="4" y="${Y(lo)}" fill="currentColor" font-size="12">${fmt(lo, 1)}</text>
    <polyline points="${linea}" fill="none" stroke="var(--text-primary)" stroke-width="2"/>
    <line x1="${X(x0)}" y1="${Y(b0 + pend * x0)}" x2="${X(x1)}" y2="${Y(b0 + pend * x1)}" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="8 6"/>
  </svg>`;
}

$('descargar').addEventListener('click', () => {
  if (!ultimo) return;
  const { variable, lugar, lat, lon, serie, r } = ultimo;
  const blob = new Blob([JSON.stringify({ variable: variable.id, lugar, lat, lon, resultado: r, serie }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `expediente_${variable.id}_${lat}_${lon}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});
