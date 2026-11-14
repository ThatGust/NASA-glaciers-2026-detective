// Builds data/mission.json: the 5 cases of the classroom mission, with their NASA POWER series bundled,
// so a class of 30 does not send 30 x 5 requests to NASA POWER at the same time.
// Usage (from app/): node tools/build_mission.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { fetchPower, analyze } from '../engine.js';

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const CASES = [
  ['coropuna', 'T2M', 1981], ['jakobshavn', 'T2M', 1981], ['congo', 'PRECTOTCORR', 1981],
  ['cape_good_hope', 'AOD_55', 2001], ['tokyo', 'T2M_MIN', 1981],
];
const out = { generated: new Date().toISOString().slice(0, 10), source: 'NASA POWER monthly point API (annual means)', cases: [] };
for (const [placeId, variable, start] of CASES) {
  const p = catalog.places.find((x) => x.id === placeId);
  if (!p) throw new Error(`missing place ${placeId}`);
  const series = await fetchPower(variable, p.lat, p.lon, start);
  const r = analyze(series);
  out.cases.push({ place: placeId, variable, series });
  console.log(placeId, variable, series.years[0], series.years.at(-1), r.verdict, r.slopePerDecade.toFixed(3));
  await new Promise((res) => setTimeout(res, 2500)); // be gentle with NASA POWER
}
writeFileSync(new URL('../data/mission.json', import.meta.url), JSON.stringify(out) + '\n');
