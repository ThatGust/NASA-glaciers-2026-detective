import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const cache = new URL('./.cache/', import.meta.url);

// Keep the original responses so a rerun does not repeatedly hit the public APIs.
export async function getJson(url) {
  await mkdir(cache, { recursive: true });
  const file = new URL(`${createHash('sha256').update(url).digest('hex')}.json`, cache);
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(90000),
        headers: { 'User-Agent': 'TrendDetective/1.0 (NASA Space Apps educational data verification)' },
      });
      if (response.status === 429 || response.status >= 500) {
        const error = new Error(`HTTP ${response.status}: ${url}`);
        error.delay = response.status === 429 ? Math.max(10000, Number(response.headers.get('retry-after') || 0) * 1000) : 0;
        throw error;
      }
      const result = { url, retrieved: new Date().toISOString(), status: response.status, body: await response.json() };
      await writeFile(file, JSON.stringify(result));
      return result;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, error.delay || 1000 * 2 ** attempt));
    }
  }
}

export function pointUrl(parameters, lat, lon, start, end) {
  return `https://power.larc.nasa.gov/api/temporal/monthly/point?${new URLSearchParams({
    parameters, community: 'AG', latitude: lat, longitude: lon, start, end, format: 'JSON',
  })}`;
}

export async function mapLimited(items, operation) {
  let next = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await operation(items[i], i); }
  }));
  return results;
}
