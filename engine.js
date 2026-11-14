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
    ttest: (({ slope: b, ci: c, p: tp }) => ({ slopePerDecade: b * 10, slopeCI: [c[0] * 10, c[1] * 10], p: tp }))(linearTTest(years, values)),
  };
}

// Compares the main series with a witness over their common years.
export function compareWitnesses(principal, testigo) {
  const common = principal.years.filter((y) => testigo.years.includes(y));
  const pick = (s) => common.map((y) => s.values[s.years.indexOf(y)]);
  const a = analyze({ years: common, values: pick(principal) });
  const b = analyze({ years: common, values: pick(testigo) });
  const agrees = Math.sign(a.slopePerDecade) === Math.sign(b.slopePerDecade);
  // The direction of a trend that is not even "likely" is noise, so it can neither back nor contradict the main series.
  const status = b.verdict === 'unknown' ? 'not-corroborated' : agrees ? 'corroborated' : 'contradicted';
  return {
    witness: testigo.source, agrees, status,
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

// Annual values from daily values stamped at the END of each 24 h window (Meteomatics style): the mean by default,
// or, with a test, the number of days that pass it (e.g. frost days). A year with any missing day is dropped.
export function annualFromDaily(dates, countIf = null) {
  const byYear = new Map();
  for (const { date, value } of dates) {
    const y = new Date(Date.parse(date) - 86400000).getUTCFullYear(); // the 24 h window ends at this timestamp
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(value);
  }
  const years = [], values = [];
  for (const [y, v] of [...byYear].sort((a, b) => a[0] - b[0])) {
    const days = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
    if (v.length !== days || v.some((x) => x == null || x === -999 || !Number.isFinite(x))) continue;
    years.push(y);
    values.push(countIf ? v.filter(countIf).length : +(v.reduce((a, b) => a + b, 0) / days).toFixed(4));
  }
  return { years, values };
}

// Regularized incomplete beta I_x(a, b) by continued fraction (Numerical Recipes 6.4), for Student's t p-values.
function incBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lgamma(a + b) - lgamma(a) - lgamma(b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b + lnBeta);
  if (x > (a + 1) / (a + b + 2)) return 1 - incBeta(1 - x, b, a);
  let f = 1, c = 1, d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); f = d;
  for (let m = 1; m <= 200; m++) {
    for (const num of [(m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m)), -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))]) {
      d = 1 + num * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
      c = 1 + num / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c;
      f *= c * d;
    }
    if (Math.abs(c * d - 1) < 1e-12) break;
  }
  return (front * f) / a;
}
function lgamma(z) { // Lanczos approximation
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  g.forEach((gi, i) => { x += gi / (z + i + 1); });
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
export const studentTwoSidedP = (t, df) => incBeta(df / (df + t * t), df / 2, 0.5);

// Least-squares slope with a t-test, using the effective sample size for lag-1 autocorrelation (Santer et al. 2000).
export function linearTTest(years, values) {
  const n = years.length;
  const mx = years.reduce((a, b) => a + b, 0) / n, my = values.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  years.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (values[i] - my); });
  const slope = sxy / sxx, b0 = my - slope * mx;
  const e = values.map((y, i) => y - (b0 + slope * years[i]));
  const ee = e.reduce((a, r) => a + r * r, 0);
  let r1 = 0;
  for (let i = 1; i < n; i++) r1 += e[i] * e[i - 1];
  r1 = Math.max(0, Math.min(0.95, ee ? r1 / ee : 0));
  const nEff = Math.max(3, (n * (1 - r1)) / (1 + r1));
  const se = Math.sqrt(ee / (nEff - 2) / sxx);
  const t = se > 0 ? slope / se : 0;
  const df = nEff - 2;
  // Two-sided 95% critical value by bisection on the t distribution.
  let lo = 0, hi = 50;
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (studentTwoSidedP(mid, df) > 0.05) lo = mid; else hi = mid; }
  return { slope, ci: [slope - hi * se, slope + hi * se], t, df, p: studentTwoSidedP(Math.abs(t), df), r1, nEff };
}

// Prediction test (the thesis idea of incremental predictive value, without any lunar term): fit the trend on the
// first part of the record and check whether it predicts the held-out recent years better than "nothing changes"
// (the mean of the training years). skill > 0 means the trend adds predictive value.
export function predictionTest({ years, values }, holdout = 15) {
  if (years.length - holdout < MIN_YEARS) return null;
  const cut = years.length - holdout;
  const ty = years.slice(0, cut), tv = values.slice(0, cut);
  const { slope, intercept } = senSlope(ty, tv);
  const mean = tv.reduce((a, b) => a + b, 0) / tv.length;
  let errTrend = 0, errFlat = 0;
  for (let i = cut; i < years.length; i++) {
    errTrend += Math.abs(values[i] - (intercept + slope * years[i]));
    errFlat += Math.abs(values[i] - mean);
  }
  return { trainYears: [ty[0], ty.at(-1)], testYears: [years[cut], years.at(-1)], skill: errFlat ? 1 - errTrend / errFlat : 0 };
}

// Placebo series for the visual line-up (Buja et al. 2009): cut the series into blocks and shuffle the blocks.
// This keeps short-range autocorrelation (neighbouring years stay together) but destroys any long-term trend.
export function blockShuffle(values, random = Math.random) {
  const n = values.length, len = Math.max(2, Math.round(Math.cbrt(n)));
  const blocks = [];
  for (let i = 0; i < n; i += len) blocks.push(values.slice(i, i + len));
  for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; }
  return blocks.flat();
}

// The alibi test: remove the same-year linear effect of a climate index (e.g. El Niño) and test the trend again.
// Index and trend are fitted together (y = a + b·index + c·year), so a trend shared by the index is not removed twice.
export function alibiTest(series, index) {
  const years = series.years.filter((y) => index.years.includes(y));
  if (years.length < MIN_YEARS) return null;
  const y = years.map((yr) => series.values[series.years.indexOf(yr)]);
  const x = years.map((yr) => index.values[index.years.indexOf(yr)]);
  // Least squares for y on [1, x, t] via the 3x3 normal equations.
  const t = years.map((yr) => yr - years[0]);
  const cols = [years.map(() => 1), x, t];
  const A = cols.map((a) => cols.map((b) => a.reduce((s, v, i) => s + v * b[i], 0)));
  const rhs = cols.map((a) => a.reduce((s, v, i) => s + v * y[i], 0));
  const [a0, bIdx] = solve3(A, rhs);
  const adjusted = y.map((v, i) => v - bIdx * (x[i] - x.reduce((s, q) => s + q, 0) / x.length));
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssIdx = y.reduce((s, v, i) => s + (bIdx * (x[i] - x.reduce((q, w) => q + w, 0) / x.length)) ** 2, 0);
  return { share: ssTot ? Math.min(1, ssIdx / ssTot) : 0, coefficient: bIdx, intercept: a0, after: analyze({ years, values: adjusted }) };
}
function solve3(A, b) { // Gaussian elimination with partial pivoting
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    const p = M.slice(c).reduce((best, r, i) => (Math.abs(r[c]) > Math.abs(M[best][c]) ? i + c : best), c);
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < 3; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
  }
  const out = [0, 0, 0];
  for (let r = 2; r >= 0; r--) out[r] = (M[r][3] - M[r].slice(r + 1, 3).reduce((s, v, k) => s + v * out[r + 1 + k], 0)) / M[r][r];
  return out;
}

// Area-weighted mean series: each cell weighs cos(latitude), because cells shrink toward the poles.
// Only cells with the same, complete set of years are averaged (no gap filling).
export function areaWeightedMean(seriesList, lats) {
  const full = Math.max(...seriesList.map((s) => s.years.length));
  const keep = seriesList.map((s, i) => i).filter((i) => seriesList[i].years.length === full);
  const years = seriesList[keep[0]].years;
  const same = keep.filter((i) => seriesList[i].years.join() === years.join());
  const w = same.map((i) => Math.cos((lats[i] * Math.PI) / 180));
  const W = w.reduce((a, b) => a + b, 0);
  const values = years.map((_, y) => +(same.reduce((a, i, k) => a + w[k] * seriesList[i].values[y], 0) / W).toFixed(4));
  return { years, values, cells: same.length };
}

// Projection: extend Sen's trend to a future year with a ~95% band for single years. The band adds the year-to-year
// spread around the trend (residual SD) and the uncertainty of the slope itself (its 95% interval), in quadrature.
export function projection({ years, values }, toYear) {
  const { slope, ci, intercept } = senSlope(years, values);
  const res = values.map((v, i) => v - (intercept + slope * years[i]));
  const sd = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / (res.length - 2));
  const mid = (years[0] + years.at(-1)) / 2, halfCI = (ci[1] - ci[0]) / 2;
  const at = (y) => {
    const centre = intercept + slope * y, half = Math.sqrt((1.96 * sd) ** 2 + (halfCI * (y - mid)) ** 2);
    return { year: y, centre, low: centre - half, high: centre + half };
  };
  const out = [];
  for (let y = years.at(-1) + 1; y <= toYear; y++) out.push(at(y));
  return { slope, sd, points: out, at };
}

// --- The Moon's 18.6-year nodal cycle (decision D-26) ---
// Longitude of the Moon's mean ascending node in degrees (Meeus, Astronomical Algorithms, 2nd ed., eq. 47.7).
export function nodeLongitude(decimalYear) {
  const T = (decimalYear - 2000.0) / 100; // Julian centuries from J2000.0 (close enough at yearly resolution)
  const om = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
  return ((om % 360) + 360) % 360;
}
// Annual lunar index: mean of cos(node longitude) over the year. +1 = major lunar standstill (the Moon's monthly
// swing in declination is widest, tides are most modulated), -1 = minor standstill.
export const lunarIndex = (year) => Array.from({ length: 12 }, (_, m) => Math.cos((nodeLongitude(year + (m + 0.5) / 12) * Math.PI) / 180))
  .reduce((a, b) => a + b, 0) / 12;

// Does an annual series carry an 18.6-year lunar signal? The lunar index is fixed by astronomy (no phase is fitted).
// Both the series and the index are detrended, then correlated. Placebos are simulated noise series with the same
// year-to-year persistence as the data (AR(1), lag-1 estimate bias-corrected for short records): block shuffles and
// rotations gave 7-10% false alarms on persistent noise in our checks, this gives about 5%. Needs two full cycles.
export const LUNAR_MIN_YEARS = 37;
export function lunarTest({ years, values }, { placebos = 999, random = Math.random } = {}) {
  if (years.length < LUNAR_MIN_YEARS) return { status: 'too-short', n: years.length };
  const n = years.length, t = years.map((y) => y - years[0]);
  const mt = t.reduce((a, b) => a + b, 0) / n, stt = t.reduce((s, x) => s + (x - mt) ** 2, 0);
  const detrend = (x) => {
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const b = t.reduce((s, ti, i) => s + (ti - mt) * (x[i] - mx), 0) / stt;
    return x.map((xi, i) => xi - mx - b * (t[i] - mt));
  };
  const L = years.map(lunarIndex), r = detrend(values), l = detrend(L);
  const corr = (a, b) => { const ab = a.reduce((s, x, i) => s + x * b[i], 0); return ab / Math.sqrt(a.reduce((s, x) => s + x * x, 0) * b.reduce((s, x) => s + x * x, 0)); };
  const observed = corr(r, l);
  let num = 0, den = 0;
  for (let i = 1; i < n; i++) { num += r[i] * r[i - 1]; den += r[i - 1] * r[i - 1]; }
  const phiRaw = den ? num / den : 0;
  const phi = Math.min(0.95, Math.max(0, phiRaw + (1 + 3 * phiRaw) / n)); // small-sample bias correction (Marriott & Pope 1954)
  const gauss = () => Math.sqrt(-2 * Math.log(random() || 1e-12)) * Math.cos(2 * Math.PI * random());
  let asExtreme = 0;
  for (let k = 0; k < placebos; k++) {
    let e = gauss() / Math.sqrt(1 - phi * phi);
    const sim = detrend(t.map(() => (e = phi * e + gauss())));
    if (Math.abs(corr(sim, l)) >= Math.abs(observed)) asExtreme++;
  }
  const p = (asExtreme + 1) / (placebos + 1);
  const amplitude = r.reduce((s, x, i) => s + x * l[i], 0) / l.reduce((s, x) => s + x * x, 0); // change per unit of lunar index
  return { status: 'ok', n, correlation: observed, share: observed * observed, amplitude, swing: 2 * amplitude, p, persistence: phi,
    verdict: p < 0.05 ? 'signal' : p < 0.10 ? 'hint' : 'none', index: L };
}
