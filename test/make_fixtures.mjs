// Descarga series reales de NASA POWER y las guarda como fixtures (se corre una vez).
import { writeFileSync } from 'node:fs';
import { fetchPower } from '../engine.js';

const casos = [
  ['T2M', -15.53, -72.65, 'Coropuna temperatura'],
  ['PRECTOTCORR', -15.53, -72.65, 'Coropuna lluvia'],
  ['T2M', -16.4, -71.54, 'Arequipa temperatura'],
  ['ALLSKY_SFC_SW_DWN', -15.53, -72.65, 'Coropuna radiación'],
];
const out = [];
for (const [param, lat, lon, name] of casos) out.push({ name, ...(await fetchPower(param, lat, lon, 1984)) });
writeFileSync(new URL('./fixtures.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.map((s) => `${s.name}: ${s.years[0]}–${s.years.at(-1)} (${s.years.length} años)`).join('\n'));
