// Builds the public site into dist/ for Cloudflare Pages: only the files the browser needs.
// Usage: node tools/build_site.mjs   (Cloudflare Pages: root directory "app", build command the same, output "dist")
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
// Local-only data (third-party licence terms or work in progress) must never be published.
const PRIVATE = new Set(['witnesses.json', 'coropuna.json']);
const FILES = ['index.html', 'main.js', 'engine.js', 'classroom.js', 'i18n.js', 'i18n_dictionary.js', 'LICENSE', 'THIRD_PARTY_NOTICES.md'];

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'data'), { recursive: true });
for (const f of FILES) cpSync(join(root, f), join(dist, f));
for (const f of readdirSync(join(root, 'data'))) if (f.endsWith('.json') && !PRIVATE.has(f)) cpSync(join(root, 'data', f), join(dist, 'data', f));
cpSync(join(root, 'img'), join(dist, 'img'), { recursive: true });
if (existsSync(join(root, 'docs', 'diagrams', 'page_overview.png'))) cpSync(join(root, 'docs', 'diagrams', 'page_overview.png'), join(dist, 'img', 'page_overview.png'));

// Caching: code revalidates every time (instant updates); data and images are cached so a full room loads them once.
writeFileSync(join(dist, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/index.html
  Cache-Control: no-cache
/*.js
  Cache-Control: no-cache
/data/*
  Cache-Control: public, max-age=3600
/img/*
  Cache-Control: public, max-age=86400
`);

let files = 0, bytes = 0;
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f), s = statSync(p); if (s.isDirectory()) walk(p); else { files++; bytes += s.size; if (s.size > 25e6) throw new Error(`${p} exceeds the 25 MB Pages limit`); } } };
walk(dist);
if (files > 20000) throw new Error(`${files} files exceed the 20,000-file Pages limit`);
// Every local ES module main.js imports must ship, or the page loads Cloudflare's HTML fallback instead and never starts.
for (const m of readFileSync(join(root, 'main.js'), 'utf8').matchAll(/from '\.\/([\w.-]+\.js)'/g)) if (!existsSync(join(dist, m[1]))) throw new Error(`${m[1]} is imported by main.js but missing from dist`);
for (const f of PRIVATE) if (existsSync(join(dist, 'data', f))) throw new Error(`private file ${f} leaked into dist`);
console.log(`dist ready: ${files} files, ${(bytes / 1e6).toFixed(1)} MB`);
