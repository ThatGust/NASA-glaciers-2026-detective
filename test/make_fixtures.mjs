// Downloads real NASA POWER series and saves them as test fixtures (run once).
import { writeFileSync } from 'node:fs';
import { fetchPower } from '../engine.js';

const cases = [
  ['T2M', -15.53, -72.65, 'Coropuna temperature'],
  ['PRECTOTCORR', -15.53, -72.65, 'Coropuna precipitation'],
  ['T2M', -16.4, -71.54, 'Arequipa temperature'],
  ['ALLSKY_SFC_SW_DWN', -15.53, -72.65, 'Coropuna solar radiation'],
];
const out = [];
for (const [param, lat, lon, name] of cases) out.push({ name, ...(await fetchPower(param, lat, lon, 1984)) });
writeFileSync(new URL('./fixtures.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.map((s) => `${s.name}: ${s.years[0]}–${s.years.at(-1)} (${s.years.length} years)`).join('\n'));
