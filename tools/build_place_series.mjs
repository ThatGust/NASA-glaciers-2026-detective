// Bundles the NASA POWER annual series already downloaded for the place facts (tools/.cache) into data/place_series.json,
// so the most common cases work even when NASA POWER rate-limits a classroom. Makes no network request.
// Usage (from app/): node tools/build_place_series.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { annualFromPower } from '../engine.js';

const here = (p) => new URL(p, import.meta.url);
const facts = JSON.parse(readFileSync(here('../data/place_facts.json'), 'utf8')).facts;
const out = { generated: new Date().toISOString().slice(0, 10), source: 'NASA POWER monthly point API (MERRA-2), annual means of complete years', places: {} };
let series = 0, missing = 0;
for (const [id, f] of Object.entries(facts)) {
  const urls = [...new Set(Object.values(f.power_sources ?? {}).map((s) => s.url))];
  for (const url of urls) {
    const file = here(`./.cache/${createHash('sha256').update(url).digest('hex')}.json`);
    if (!existsSync(file)) { missing++; continue; }
    // A few cache files got a second write appended (concurrent runs): recover the first complete JSON object.
    const text = readFileSync(file, 'utf8');
    let body = null;
    for (let end = text.length; end > 0 && !body; end = text.lastIndexOf('}', end - 1)) {
      try { body = JSON.parse(text.slice(0, end === text.length ? end : end + 1)).body; } catch { /* try a shorter prefix */ }
      if (end === -1) break;
    }
    if (!body) { missing++; continue; }
    for (const param of Object.keys(body?.properties?.parameter ?? {})) {
      const s = annualFromPower(body, param, 2026);
      if (s.years.length < 8) continue;
      out.places[id] ??= {};
      out.places[id][param] = { years: s.years, values: s.values.map((v) => +v.toFixed(3)), units: s.units };
      series++;
    }
  }
}
writeFileSync(here('../data/place_series.json'), JSON.stringify(out));
console.log(`places ${Object.keys(out.places).length}, series ${series}, missing cache files ${missing}`);
