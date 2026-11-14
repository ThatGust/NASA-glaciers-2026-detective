// Downloads two climate-variability indices from NOAA and saves their annual means to data/indices.json.
// Used by the "alibi" test: does a trend survive once the year-to-year effect of El Niño or the PDO is removed?
// Usage (from app/): node tools/fetch_indices.mjs
import { writeFileSync } from 'node:fs';

const FIRST = 1981, LAST = new Date().getUTCFullYear() - 1;
const text = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); };
const annual = (byYear) => {
  const years = [], values = [];
  for (let y = FIRST; y <= LAST; y++) {
    const v = byYear.get(y);
    if (v?.length === 12) { years.push(y); values.push(+(v.reduce((a, b) => a + b, 0) / 12).toFixed(3)); }
  }
  return { years, values };
};

// ONI: 3-month running mean SST anomaly in the Nino 3.4 region, one row per season (DJF ... NDJ).
const oniUrl = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
const oni = new Map();
for (const line of (await text(oniUrl)).split('\n').slice(1)) {
  const [, yr, , anom] = line.trim().split(/\s+/);
  if (!yr) continue;
  if (!oni.has(+yr)) oni.set(+yr, []);
  oni.get(+yr).push(+anom);
}

// PDO from ERSST v5: one row per year, 12 monthly values; 99.99 marks missing months.
const pdoUrl = 'https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.pdo.dat';
const pdo = new Map();
for (const line of (await text(pdoUrl)).split('\n')) {
  const f = line.trim().split(/\s+/).map(Number);
  if (f.length === 13 && f[0] > 1800) pdo.set(f[0], f.slice(1).filter((v) => v < 99));
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  ENSO: { name: 'El Niño (ONI)', organization: 'NOAA Climate Prediction Center', source: oniUrl,
    definition: 'How much warmer or cooler than normal the central tropical Pacific is; above +0.5 is El Niño, below −0.5 is La Niña.', ...annual(oni) },
  PDO: { name: 'Pacific Decadal Oscillation (PDO)', organization: 'NOAA NCEI (ERSST v5)', source: pdoUrl,
    definition: 'A slow, decades-long swing in North Pacific sea temperatures that shifts weather around the Pacific.', ...annual(pdo) },
};
writeFileSync(new URL('../data/indices.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
for (const k of ['ENSO', 'PDO']) console.log(k, out[k].years.length, 'years', out[k].years[0], '-', out[k].years.at(-1));
