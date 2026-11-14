// Motor estadístico del detective de tendencias. Contrato: context/CONTRATO_DATOS.md.
// Funciones puras: corren igual en el navegador y en Node (pruebas).

const Z95 = 1.959963984540054;

// Función de error (Abramowitz y Stegun 7.1.26, error < 1.5e-7) para la normal estándar.
function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

const median = (a) => {
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Rangos con empates promediados (como scipy.stats.rankdata).
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

// Pendiente de Sen sobre el índice temporal t (años), con IC del 95 % (Gilbert, 1987).
export function senSlope(t, x) {
  const s = [];
  for (let i = 0; i < x.length; i++)
    for (let j = i + 1; j < x.length; j++) s.push((x[j] - x[i]) / (t[j] - t[i]));
  s.sort((a, b) => a - b);
  const slope = median(s);
  const C = Z95 * Math.sqrt(varS(x));
  const N = s.length;
  const lo = s[Math.max(0, Math.round((N - C) / 2) - 1)];
  const hi = s[Math.min(N - 1, Math.round((N + C) / 2))];
  const intercept = median(x.map((v, i) => v - slope * t[i]));
  return { slope, ci: [lo, hi], intercept };
}

// Varianza de S con corrección por empates.
function varS(x) {
  const n = x.length, counts = new Map();
  for (const v of x) counts.set(v, (counts.get(v) || 0) + 1);
  let ties = 0;
  for (const c of counts.values()) ties += c * (c - 1) * (2 * c + 5);
  return (n * (n - 1) * (2 * n + 5) - ties) / 18;
}

// Mann-Kendall con la modificación de Hamed y Rao (1998), como pymannkendall.hamed_rao_modification_test.
export function mannKendallHR(x) {
  const n = x.length;
  let S = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) S += Math.sign(x[j] - x[i]);
  let v = varS(x);

  // Autocorrelación de los rangos de la serie sin tendencia (pendiente de Sen sobre el índice 0..n-1).
  const idx = x.map((_, i) => i);
  const { slope } = senSlope(idx, x);
  const r = ranks(x.map((val, i) => val - slope * (i + 1)));
  const mean = r.reduce((a, b) => a + b, 0) / n;
  const den = r.reduce((a, b) => a + (b - mean) ** 2, 0);
  const bound = Z95 / Math.sqrt(n);
  let sum = 0;
  for (let k = 1; k < n; k++) {
    let num = 0;
    for (let i = 0; i < n - k; i++) num += (r[i] - mean) * (r[i + k] - mean);
    const rk = num / den;
    if (Math.abs(rk) > bound) sum += (n - k) * (n - k - 1) * (n - k - 2) * rk;
  }
  const factor = 1 + (2 / (n * (n - 1) * (n - 2))) * sum;
  v *= factor;

  const z = S > 0 ? (S - 1) / Math.sqrt(v) : S < 0 ? (S + 1) / Math.sqrt(v) : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  const tau = S / (0.5 * n * (n - 1));
  return { S, z, p, tau, varS: v };
}

const verdictOf = (p) => (p < 0.05 ? 'confirmed' : p < 0.1 ? 'likely' : 'unknown');

// Años adicionales para detectar la pendiente actual (potencia 0,9, α 0,05, ruido AR(1)). Ver contrato §4.
export function yearsNeeded(t, x, slope, intercept) {
  const n = x.length;
  if (slope === 0) return Infinity;
  const res = x.map((v, i) => v - (intercept + slope * t[i]));
  const m = res.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(res.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) den += (res[i] - m) ** 2;
  for (let i = 0; i < n - 1; i++) num += (res[i] - m) * (res[i + 1] - m);
  const phi = Math.min(0.9, Math.max(0, num / den));
  return Math.max(0, Math.ceil(detectionYears(sd, phi, slope) - n));
}

// Años totales para detectar una pendiente (por año) con ruido AR(1) de desviación sd y autocorrelación phi.
export const detectionYears = (sd, phi, slope) =>
  Math.pow(3.24 * Math.sqrt(12) * (sd / Math.abs(slope)) * Math.sqrt((1 + phi) / (1 - phi)), 2 / 3);

const MIN_YEARS = 8;

// Análisis completo de una serie anual {years, values, units}.
export function analyze({ years, values, units = '' }) {
  if (years.length !== values.length) throw new Error('years y values deben tener la misma longitud');
  if (years.length < MIN_YEARS) throw new Error(`Se necesitan al menos ${MIN_YEARS} años de datos`);
  const { slope, ci, intercept } = senSlope(years, values);
  const { p, tau } = mannKendallHR(values);
  const verdict = verdictOf(p);

  // "Se sabe desde": primer año final desde el que la serie es significativa y lo sigue siendo.
  let knownSince = null;
  for (let e = years.length - 1; e >= MIN_YEARS - 1; e--) {
    if (mannKendallHR(values.slice(0, e + 1)).p < 0.05) knownSince = years[e];
    else break;
  }

  return {
    n: years.length, firstYear: years[0], lastYear: years[years.length - 1],
    slopePerDecade: slope * 10, slopeCI: [ci[0] * 10, ci[1] * 10],
    p, tau, verdict, knownSince: verdict === 'confirmed' ? knownSince : null,
    yearsNeeded: verdict === 'confirmed' ? null : yearsNeeded(years, values, slope, intercept),
    units,
  };
}

// Compara el resultado principal con un testigo en los años comunes. Contrato §3.
export function compareWitnesses(principal, testigo) {
  const common = principal.years.filter((y) => testigo.years.includes(y));
  const pick = (s) => common.map((y) => s.values[s.years.indexOf(y)]);
  const a = analyze({ years: common, values: pick(principal) });
  const b = analyze({ years: common, values: pick(testigo) });
  return {
    witness: testigo.source, agrees: Math.sign(a.slopePerDecade) === Math.sign(b.slopePerDecade),
    witnessVerdict: b.verdict, overlap: [common[0], common[common.length - 1]],
  };
}

// Serie anual desde la respuesta mensual de NASA POWER: media de los meses 1–12, sin años incompletos ni el año en curso.
export function annualFromPower(json, parameter, currentYear = new Date().getFullYear()) {
  const fill = json.header?.fill_value ?? -999;
  const p = json.properties.parameter[parameter];
  const byYear = new Map();
  for (const [k, v] of Object.entries(p)) {
    const y = +k.slice(0, 4), m = +k.slice(4);
    if (m < 1 || m > 12) continue; // el mes 13 es la media anual de POWER
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(v);
  }
  const years = [], values = [];
  for (const [y, vals] of [...byYear].sort((a, b) => a[0] - b[0])) {
    if (y >= currentYear || vals.length !== 12 || vals.some((v) => v === fill)) continue;
    years.push(y);
    values.push(vals.reduce((a, b) => a + b, 0) / 12);
  }
  const src = (json.header?.sources ?? []).filter((s) => s !== 'POWER').join(' + ') || 'desconocida';
  return { years, values, units: json.parameters?.[parameter]?.units ?? '', source: `NASA POWER · ${src}`, variable: parameter };
}

export async function fetchPower(parameter, lat, lon, start = 1981, end = new Date().getFullYear() - 1) {
  const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${parameter}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`NASA POWER respondió ${r.status}`);
  return annualFromPower(await r.json(), parameter);
}
