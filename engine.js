// Trend Detective statistics engine. Pure functions: they run the same in the browser and in Node (tests).

const Z95 = 1.959963984540054;

// Error function (Abramowitz & Stegun 7.1.26, error < 1.5e-7) for the standard normal CDF.
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

// Ranks with averaged ties (like scipy.stats.rankdata).
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

// Sen's slope over time index t (years), with a 95% confidence interval (Gilbert, 1987).
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

// Variance of S with tie correction.
function varS(x) {
  const n = x.length, counts = new Map();
  for (const v of x) counts.set(v, (counts.get(v) || 0) + 1);
  let ties = 0;
  for (const c of counts.values()) ties += c * (c - 1) * (2 * c + 5);
  return (n * (n - 1) * (2 * n + 5) - ties) / 18;
}

// Mann-Kendall with the Hamed & Rao (1998) modification, matching pymannkendall.hamed_rao_modification_test.
export function mannKendallHR(x) {
  const n = x.length;
  let S = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) S += Math.sign(x[j] - x[i]);
  let v = varS(x);

  // Autocorrelation of the ranks of the detrended series (Sen's slope over index 0..n-1).
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
  const raw = 1 + (2 / (n * (n - 1) * (n - 2))) * sum;
  // A non-positive factor (strong negative autocorrelations) makes the variance negative; pymannkendall returns NaN there.
  // We fall back to the uncorrected test and flag it, instead of giving no answer.
  const corrected = raw > 0;
  v *= corrected ? raw : 1;

  const z = S > 0 ? (S - 1) / Math.sqrt(v) : S < 0 ? (S + 1) / Math.sqrt(v) : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  const tau = S / (0.5 * n * (n - 1));
  return { S, z, p, tau, varS: v, corrected };
}

const verdictOf = (p) => (p < 0.05 ? 'confirmed' : p < 0.1 ? 'likely' : 'unknown');

// Extra years needed to detect the current slope (power 0.9, alpha 0.05, AR(1) noise).
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

// Total years needed to detect a per-year slope under AR(1) noise with standard deviation sd and lag-1 autocorrelation phi.
// Derived from the slope's standard error, following the approach of Weatherhead et al. (1998), doi:10.1029/98JD00995.
export const detectionYears = (sd, phi, slope) =>
  Math.pow(3.24 * Math.sqrt(12) * (sd / Math.abs(slope)) * Math.sqrt((1 + phi) / (1 - phi)), 2 / 3);

const MIN_YEARS = 8;

// Full analysis of an annual series {years, values, units}.
export function analyze({ years, values, units = '' }) {
  if (years.length !== values.length) throw new Error('years and values must have the same length');
  if (years.length < MIN_YEARS) throw new Error(`At least ${MIN_YEARS} years of data are needed`);
  const { slope, ci, intercept } = senSlope(years, values);
  const { p, tau, corrected } = mannKendallHR(values);
  const verdict = verdictOf(p);

  // "Known since": first end year from which the series is significant and stays significant.
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
    units, autocorrelationCorrected: corrected,
  };
}

// Compares the main series with a witness over their common years.
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

// Annual series from a NASA POWER monthly response: mean of months 1-12, dropping incomplete years and the current year.
export function annualFromPower(json, parameter, currentYear = new Date().getFullYear()) {
  const fill = json.header?.fill_value ?? -999;
  const p = json.properties.parameter[parameter];
  const byYear = new Map();
  for (const [k, v] of Object.entries(p)) {
    const y = +k.slice(0, 4), m = +k.slice(4);
    if (m < 1 || m > 12) continue; // month 13 is POWER's own annual mean
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(v);
  }
  const years = [], values = [];
  for (const [y, vals] of [...byYear].sort((a, b) => a[0] - b[0])) {
    if (y >= currentYear || vals.length !== 12 || vals.some((v) => v === fill)) continue;
    years.push(y);
    values.push(vals.reduce((a, b) => a + b, 0) / 12);
  }
  const src = (json.header?.sources ?? []).filter((s) => s !== 'POWER').join(' + ') || 'unknown';
  return { years, values, units: json.parameters?.[parameter]?.units ?? '', source: `NASA POWER · ${src}`, variable: parameter };
}

export async function fetchPower(parameter, lat, lon, start = 1981, end = new Date().getFullYear() - 1) {
  const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${parameter}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`NASA POWER answered ${r.status}`);
  return annualFromPower(await r.json(), parameter);
}

// Benjamini-Hochberg adjusted p-values (q), in the input order. Controls the false discovery rate when testing many variables.
export function benjaminiHochberg(ps) {
  const m = ps.length;
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const q = new Array(m);
  let min = 1;
  for (let k = m - 1; k >= 0; k--) {
    min = Math.min(min, (order[k][0] * m) / (k + 1));
    q[order[k][1]] = min;
  }
  return q;
}

// Annual series for several parameters from one NASA POWER response, each starting at its own first valid year.
export function annualSeriesFromPower(json, params, currentYear = new Date().getFullYear()) {
  return Object.fromEntries(params.map(({ id, start = 0 }) => {
    const s = annualFromPower(json, id, currentYear);
    const keep = s.years.map((y) => y >= start);
    return [id, { ...s, years: s.years.filter((_, i) => keep[i]), values: s.values.filter((_, i) => keep[i]) }];
  }));
}

// Analyzes many variables at one place. Verdicts use the BH-adjusted q, so testing many variables does not inflate "confirmed".
export function scan(seriesById) {
  const leads = Object.entries(seriesById).map(([variable, s]) => {
    if (s.years.length < MIN_YEARS) return { variable, series: s, status: 'no-data' };
    if (Math.max(...s.values) - Math.min(...s.values) < 1e-9) return { variable, series: s, status: 'flat' };
    return { variable, series: s, status: 'ok', result: analyze(s) };
  });
  const ok = leads.filter((l) => l.status === 'ok');
  benjaminiHochberg(ok.map((l) => l.result.p)).forEach((q, i) => {
    const r = ok[i].result, verdict = verdictOf(q);
    ok[i].q = q;
    ok[i].verdict = verdict;
    // The adjusted verdict travels with the result, so opening a lead never shows a stronger verdict than the list.
    ok[i].result = { ...r, q, tested: ok.length, verdict, adjusted: verdict !== r.verdict,
      knownSince: verdict === 'confirmed' ? r.knownSince : null };
  });
  const rank = { confirmed: 0, likely: 1, unknown: 2 };
  return leads.sort((a, b) => (rank[a.verdict] ?? 3) - (rank[b.verdict] ?? 3) || (a.q ?? 1) - (b.q ?? 1));
}

export async function fetchPowerMany(params, lat, lon, end = new Date().getFullYear() - 1) {
  const out = {};
  // One request per product start year (so each response has one source), at most 10 parameters each.
  const byStart = Object.values(Object.groupBy(params, (p) => p.start ?? 1981));
  for (const chunk of byStart.flatMap((g) => Array.from({ length: Math.ceil(g.length / 10) }, (_, i) => g.slice(i * 10, i * 10 + 10)))) {
    const start = chunk[0].start ?? 1981;
    const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${chunk.map((p) => p.id).join(',')}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`NASA POWER answered ${r.status}`);
    Object.assign(out, annualSeriesFromPower(await r.json(), chunk));
  }
  return out;
}

// Annual mean of daily values stamped at the END of each 24 h window (Meteomatics style); a year is dropped if any day is missing (same rule as the NASA POWER series).
export function annualFromDaily(dates) {
  const byYear = new Map();
  for (const { date, value } of dates) {
    const day = new Date(Date.parse(date) - 86400000); // the 24 h window ends at this timestamp
    const y = day.getUTCFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(value);
  }
  const years = [], values = [];
  for (const [y, v] of [...byYear].sort((a, b) => a[0] - b[0])) {
    const days = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
    if (v.length !== days || v.some((x) => x == null || x === -999 || !Number.isFinite(x))) continue;
    years.push(y);
    values.push(+(v.reduce((a, b) => a + b, 0) / days).toFixed(4));
  }
  return { years, values };
}
