import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('./', import.meta.url);
const cache = new URL('.render_cache/', root);
await mkdir(cache, { recursive: true });
const files = (await readdir(root)).filter(f => f.endsWith('.puml')).sort();
assert.equal(files.length, 7);
const report = { generated: new Date().toISOString(), renderer: 'Public Kroki PlantUML service',
  endpoint: 'https://kroki.io/plantuml/{svg,png}',
  local_probe: 'Java 21.0.7 and Graphviz available; PlantUML command/JAR not found in the app or checked local tool locations. Public Kroki fallback explicitly authorized by the task.',
  disclosure: 'Only the standalone .puml diagram text is submitted; no app source, data files, credentials or personal data are uploaded.',
  output_width_px: 1200, diagrams: [] };

for (const file of files) {
  const source = await readFile(new URL(file, root), 'utf8');
  assert.ok(source.startsWith('@startuml') && source.includes('left to right direction'));
  assert.ok(!/!include|!import|https?:\/\//.test(source), `${file}: keep public render input self-contained`);
  const sha256 = createHash('sha256').update(source).digest('hex');
  const base = file.replace(/\.puml$/, '');
  for (const format of ['svg', 'png']) {
    const cached = new URL(`${sha256}.${format}`, cache);
    let bytes;
    try { bytes = await readFile(cached); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await fetch(`https://kroki.io/plantuml/${format}`, {
            method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8', 'User-Agent': 'SignalOrNoise-D1/1.0 (public UML documentation)' },
            body: source, signal: AbortSignal.timeout(90000),
          });
          if (!response.ok) throw new Error(`Kroki HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
          bytes = Buffer.from(await response.arrayBuffer());
          if (format === 'png') assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
          else assert.ok(bytes.toString('utf8').includes('<svg'));
          await writeFile(cached, bytes);
          break;
        } catch (failure) {
          if (attempt === 3) throw failure;
          await new Promise(resolve => setTimeout(resolve, 2000 * 2 ** attempt));
        }
      }
    }
    if (format === 'svg') {
      let svg = bytes.toString('utf8');
      assert.ok(!/<script\b/i.test(svg), 'Unexpected active SVG content');
      const view = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
      const [, , width, height] = view;
      const fonts = [...svg.matchAll(/font-size="([\d.]+)"/g)].map(m => Number(m[1]));
      const minimum = Math.min(...fonts) * 1200 / width;
      svg = svg.replace(/<svg\b[^>]*>/, tag => tag.replace(/width="[^"]+"/, 'width="1200"').replace(/height="[^"]+"/, `height="${Math.round(1200 * height / width)}"`));
      await writeFile(new URL(`${base}.svg`, root), svg);
      report.diagrams.push({ file, source_sha256: sha256, natural_width: width, natural_height: height,
        minimum_text_px_at_1200: Number(minimum.toFixed(2)), use_cases: [...new Set(source.match(/UC-\d+/g))].sort() });
    } else {
      const result = spawnSync('python', ['-c', `
import sys
from PIL import Image
with Image.open(sys.argv[1]) as im:
    assert im.format == 'PNG'
    im = im.convert('RGB')
    im.resize((1200, round(im.height*1200/im.width)), Image.Resampling.LANCZOS).save(sys.argv[2], optimize=True)
`, fileURLToPath(cached), fileURLToPath(new URL(`${base}.png`, root))], { encoding: 'utf8', windowsHide: true });
      assert.equal(result.status, 0, result.stderr || result.error?.message);
    }
  }
  console.log(`${file}: ${JSON.stringify(report.diagrams.at(-1))}`);
}
await writeFile(new URL('render_manifest.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(`Rendered ${files.length} SVG/PNG pairs; inspect all 1200-pixel PNGs before delivery.`);
