// No dependencies: one isolated Chrome, public controls, local classroom backend, real bundled data.
// Run with the app already served: node test/e2e/i18n.mjs [http://localhost:8766]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:net';

const base = process.argv[2] || 'http://localhost:8766';
const artifacts = resolve('.build-i18n');
const profile = resolve(artifacts, 'chrome-profile');
await mkdir(artifacts, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  const end = Date.now() + 45000;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await sleep(100); }
  throw Error('Timeout: ' + label);
}
class CDP {
  constructor(url) {
    this.next = 0; this.pending = new Map(); this.handlers = new Map(); this.ws = new WebSocket(url);
    this.ready = new Promise(resolve => this.ws.addEventListener('open', resolve, { once: true }));
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) { const p = this.pending.get(message.id); this.pending.delete(message.id); clearTimeout(p.timer); message.error ? p.reject(Error(message.error.message)) : p.resolve(message.result); }
      else this.handlers.get(message.method)?.(message.params);
    });
  }
  async send(method, params = {}) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const id = ++this.next, timer = setTimeout(() => reject(Error('CDP timeout: ' + method)), 20000);
      this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}
const port = await new Promise(resolve => { const server = createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check', '--disable-background-networking'], { windowsHide: true, stdio: 'ignore' });
let browser, page;
const exceptions = [], snapshots = [], layouts = [];
const evaluate = async expression => {
  const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const click = async selector => { assert.ok(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), selector); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await sleep(120); };
const language = async lang => {
  await evaluate(`(()=>{const p=document.querySelector('#language-picker');p.value=${JSON.stringify(lang)};p.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await until(() => evaluate(`document.documentElement.lang===${JSON.stringify(lang)}`), 'picker ' + lang);
};
const route = async name => { await evaluate(`location.hash='#/${name}'`); await until(() => evaluate(`document.querySelector('#view-${name}').classList.contains('active')`), name); await sleep(150); };
try {
  const version = await until(async () => { try { return await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()); } catch { return null; } }, 'Chrome');
  browser = new CDP(version.webSocketDebuggerUrl);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  page = new CDP(tabs.find(t => t.id === targetId).webSocketDebuggerUrl);
  await page.send('Page.enable'); await page.send('Runtime.enable');
  page.handlers.set('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*power.larc.nasa.gov*' }, { urlPattern: '*gstatic.com/firebasejs/*' }] });
  page.handlers.set('Fetch.requestPaused', event => page.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }));
  await page.send('Page.navigate', { url: base + '/index.html?lang=ru' });
  await until(() => evaluate("document.querySelector('#demo-list .demo-btn') && document.documentElement.lang==='ru'"), '?lang=ru initializes');
  assert.match(await evaluate("document.querySelector('#t0').textContent"), /Земля/);
  await route('case'); await click('#case-form button[type=submit]');
  await until(() => evaluate("document.querySelector('#view-evidence').classList.contains('active')"), 'bundled case');
  await click('[data-trend=up]'); await route('verdict'); await click('[data-call=confirmed]');
  const before = await evaluate("({score:document.querySelector('#score').textContent.match(/\\d+/)[0], chart:document.querySelector('#chart polyline').getAttribute('points'), lat:document.querySelector('#lat').value, done:document.querySelectorAll('.ask.done').length})");
  for (const lang of ['es', 'pt', 'fr', 'ru', 'zh', 'en']) {
    await language(lang);
    const after = await evaluate("({score:document.querySelector('#score').textContent.match(/\\d+/)[0], chart:document.querySelector('#chart polyline').getAttribute('points'), lat:document.querySelector('#lat').value, done:document.querySelectorAll('.ask.done').length})");
    assert.deepEqual(after, before, 'switch preserves the case, answers and score: ' + lang);
    assert.doesNotMatch(await evaluate('document.body.innerText'), /\{\d+\}|\[missing|undefined/);
    if (lang !== 'en') assert.doesNotMatch(await evaluate("document.querySelector('#view-verdict').innerText"), /A real change|The clock|A second test agrees/);
  }
  await language('fr');
  await page.send('Page.reload');
  await until(() => evaluate("document.querySelector('#demo-list .demo-btn') && document.documentElement.lang==='fr'"), 'saved language reload');
  await route('home'); await click('#demo-list button');
  await click('#tour-pause'); assert.equal(await evaluate("document.querySelector('#tour-pause').textContent"), 'Reprendre');
  await language('ru'); assert.equal(await evaluate("document.querySelector('#tour-pause').textContent"), 'Продолжить');
  await click('#tour-pause'); assert.equal(await evaluate("document.querySelector('#tour-pause').textContent"), 'Пауза');
  await click('#tour-stop');
  for (const lang of ['es', 'pt', 'fr', 'ru', 'zh']) {
    await language(lang);
    for (let demo = 0; demo < 3; demo++) {
      await route('home'); await click(`#demo-list button[data-i="${demo}"]`); await click('#tour-pause');
      const text = await evaluate("document.querySelector('#tour-text').textContent");
      assert.doesNotMatch(text, /\?\?|\p{L}\?\p{L}|\bFrom 1981|\bFrom 2001|The evidence:|Two places, one variable/u);
      if (!demo) {
        const summary = await evaluate("document.querySelector('#compare-summary').textContent");
        assert.doesNotMatch(summary, /\?\?|\p{L}\?\p{L}|Opposite directions:|\bprecipitation\b/u);
        snapshots.push({ lang, view: 'compare', text: summary });
      }
      await click('#tour-stop');
    }
  }
  // A host and a player can use different languages in the same local room.
  await route('class'); await click('#host-btn');
  await until(() => evaluate("document.querySelector('#host-code').textContent.length===4"), 'local host');
  const code = await evaluate("document.querySelector('#host-code').textContent");
  await route('class'); await evaluate(`document.querySelector('#join-code').value=${JSON.stringify(code)}`); await click('#join-btn');
  await until(() => evaluate("document.querySelector('#view-player').classList.contains('active')"), 'local player');
  const identity = await evaluate("document.querySelector('#player-id').textContent");
  await language('zh'); assert.equal(await evaluate("document.querySelector('#player-id').textContent"), identity);
  await click('#player-next'); await until(() => evaluate("document.querySelector('#view-evidence').classList.contains('active')"), 'mission case');
  await language('fr'); assert.match(await evaluate("document.querySelector('#mission-bar').textContent"), /enquête 1 sur 5/);
  for (const lang of ['es', 'pt', 'fr', 'ru', 'zh']) {
    await language(lang);
    for (const [list, id] of [['moon-cases', 'tides'], ['moon-cases', 'corals'], ['moon-cases', 'rain'], ['moon-cases', 'glaciers'], ['moon-own', 'moon_recession'], ['moon-own', 'new_craters'], ['moon-own', 'impact_flashes'], ['moon-own', 'apollo_moonquakes']]) {
      await route('moon'); await click(`#${list} [data-case="${id}"]`);
      await until(() => evaluate("document.querySelector('#view-lunar').classList.contains('active')"), 'Moon case ' + id);
      if (['tides', 'rain', 'glaciers'].includes(id)) {
        await click('#lunar-run');
        await until(() => evaluate("!!document.querySelector('#lunar-chart svg')"), 'Moon test ' + id);
        assert.doesNotMatch(await evaluate("document.querySelector('#lunar-note').textContent"), /\b(?:at|the|rhythm|standstill|year-to-year|removing)\b/i, 'translated lunar result: ' + lang);
      } else await click('#lunar-quiz [data-q="1"]');
      snapshots.push({ lang, view: id, text: await evaluate("document.querySelector('#view-lunar').innerText"), caption: await evaluate("document.querySelector('#space-cap').textContent") });
      assert.doesNotMatch(await evaluate("document.querySelector('#view-lunar').innerText"), /\{\d+\}|undefined|Quick question|How do we test|Your guess|The Moon's rhythm lines up/);
    }
  }
  for (const lang of ['ru', 'fr']) {
    await language(lang);
    for (const [width, height] of [[1920, 940], [1366, 768], [390, 844]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
      for (const view of ['home', 'case', 'evidence', 'verdict', 'projection', 'record', 'compare', 'global', 'moon', 'class', 'host', 'player']) {
        if (view === 'compare') { await route('home'); await click('#demo-list button[data-i="0"]'); await click('#tour-pause'); await click('#tour-stop'); }
        await route(view);
        if (view === 'evidence' && await evaluate("!document.querySelector('#ask-trend').classList.contains('done')")) await click('[data-trend=up]');
        if (view === 'verdict' && await evaluate("!document.querySelector('#ask-verdict').classList.contains('done')")) await click('[data-call=confirmed]');
        await evaluate("document.querySelectorAll('.view.active details').forEach(d=>d.open=true)");
        const overflow = await evaluate(`(()=>{const rect=e=>e.getBoundingClientRect(),brand=rect(document.querySelector('.brand'));const overflow=[...document.querySelectorAll('.view.active, .view.active .btn, .view.active .chip, .view.active .lead-btn')].filter(e=>!e.closest('[hidden]')&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+2).map(e=>({tag:e.tagName,id:e.id,text:e.textContent.slice(0,100),width:e.clientWidth,scroll:e.scrollWidth}));return {overflow,overlap:[...document.querySelector('.opts').children].some(e=>{const r=rect(e);return r.left<brand.right&&r.right>brand.left&&r.top<brand.bottom&&r.bottom>brand.top}),picker:rect(document.querySelector('#language-picker')).right>innerWidth}})()`);
        layouts.push({ lang, width, height, view, ...overflow });
        assert.equal(overflow.overlap, false, `${lang} ${width} brand overlaps options`);
        assert.equal(overflow.picker, false, `${lang} ${width} picker outside viewport`);
        assert.deepEqual(overflow.overflow, [], `${lang} ${width} ${view} horizontal overflow`);
        if (width === 390 && ['home', 'case', 'moon'].includes(view)) {
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          await writeFile(resolve(artifacts, `${lang}-${view}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
        if (width === 1920) snapshots.push({ lang, view, text: await evaluate("document.querySelector('.view.active').innerText"), labels: await evaluate("[...document.querySelector('.view.active').querySelectorAll('[aria-label], [placeholder], [title]')].map(e=>[e.id,e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('title')])") });
      }
      await route('moon'); await click('#moon-own button'); await route('lunar');
      snapshots.push({ lang, view: 'lunar', text: await evaluate("document.querySelector('#view-lunar').innerText") });
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(resolve(artifacts, `${lang}-lunar-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  assert.deepEqual(exceptions, [], 'no uncaught browser exceptions');
  console.log(`PASS: six languages, ru URL, saved choice, case/score/quiz/room preservation, tour pause, ${layouts.length} responsive view checks.`);
} finally {
  await writeFile(resolve(artifacts, 'results.json'), JSON.stringify({ exceptions, layouts, snapshots }, null, 2));
  try { await browser?.send('Browser.close'); } catch { /* Already closed. */ }
  page?.ws.close(); browser?.ws.close();
  await sleep(500);
  if (chrome.exitCode === null) { const exited = new Promise(resolve => chrome.once('exit', resolve)); chrome.kill(); await Promise.race([exited, sleep(5000)]); }
  assert.ok(profile.startsWith(artifacts + '\\'), 'profile must stay in the test artifact folder');
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
}
