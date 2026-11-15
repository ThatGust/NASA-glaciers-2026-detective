// npm-free real-browser interaction audit. Run from app/: node test/e2e/run.mjs
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const app = resolve(directory, '../..');
const base = 'http://localhost:8765/index.html';
const chromeExe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const artifacts = join(directory, `run-${runId}`);
const profile = join(artifacts, 'chrome-profile');
const downloads = join(artifacts, 'downloads');
const context = new AsyncLocalStorage();
const results = [], events = [], tabs = [];
const metadata = { started: new Date().toISOString(), base, node: process.version, runner_pid: process.pid, artifacts: `run-${runId}`, power_requests_blocked: 0, browser_instances_started: 0 };
let browserProcess, browser, foreground, mainTab, stopped = false, activeStep = null, activeController;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = file => readFile(file, 'utf8').then(JSON.parse);
const ensureActive = () => { if (stopped || context.getStore()?.signal.aborted) throw new Error('Step/run aborted'); };
const relative = file => file ? file.slice(directory.length + 1).replaceAll('\\', '/') : '';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const visibleFunction = `(selector)=>{const e=typeof selector==='string'?document.querySelector(selector):selector;if(!e||e.closest('[hidden]')||getComputedStyle(e).visibility==='hidden'||getComputedStyle(e).opacity==='0')return false;const r=e.getBoundingClientRect();let l=Math.max(0,r.left),t=Math.max(0,r.top),rr=Math.min(innerWidth,r.right),b=Math.min(innerHeight,r.bottom);for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowX)){l=Math.max(l,q.left);rr=Math.min(rr,q.right)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){t=Math.max(t,q.top);b=Math.min(b,q.bottom)}}return rr-l>1&&b-t>1}`;

async function snapshotSources() {
  return Object.fromEntries(await Promise.all(['index.html', 'main.js', 'classroom.js', 'engine.js', 'data/catalog.json'].map(async file => [file, digest(await readFile(join(app, file)))])));
}

async function until(fn, description, timeout = 12000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    ensureActive();
    try { last = await fn(); if (last) return last; } catch (e) { last = e.message; }
    await sleep(100);
  }
  throw new Error(`Timeout waiting for ${description}; last=${JSON.stringify(last)}`);
}

class CDP {
  constructor(url, name) {
    this.name = name; this.nextId = 0; this.pending = new Map(); this.handlers = new Map();
    this.socket = new WebSocket(url);
    this.opened = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`WebSocket open timeout: ${name}`)), 8000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`WebSocket error: ${name}`)); }, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id); pending.clear();
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
      } else for (const fn of this.handlers.get(message.method) || []) Promise.resolve(fn(message.params)).catch(e => events.push({ at: Date.now(), tab: name, kind: 'harness-event', message: e.message, step: activeStep }));
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { pending.clear(); pending.reject(new Error(`CDP closed: ${name}`)); }
      this.pending.clear();
    });
  }
  on(method, handler) { this.handlers.set(method, [...(this.handlers.get(method) || []), handler]); }
  async send(method, params = {}, internal = false) {
    if (!internal) ensureActive();
    await this.opened;
    const signal = internal ? null : context.getStore()?.signal;
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const fail = message => { const p = this.pending.get(id); if (p) { this.pending.delete(id); p.clear(); reject(new Error(message)); } };
      const abort = () => fail(`Aborted CDP ${method}`);
      const timer = setTimeout(() => fail(`CDP timeout: ${method}`), 12000);
      const clear = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      this.pending.set(id, { resolve, reject, clear, method });
      signal?.addEventListener('abort', abort, { once: true });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket.close(); }
}

class Tab {
  constructor(id, client, name) { this.id = id; this.cdp = client; this.name = name; }
  async front() { await this.cdp.send('Page.bringToFront'); foreground = this; }
  async evaluate(expression) {
    const data = await this.cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (data.exceptionDetails) throw new Error(data.exceptionDetails.exception?.description || data.exceptionDetails.text);
    return data.result?.value;
  }
  async visible(selector) {
    return this.evaluate(`(${visibleFunction})(${JSON.stringify(selector)})`);
  }
  async text(selector) { return this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText || ''`); }
  async waitVisible(selector, timeout) { return until(() => this.visible(selector), `visible ${selector}`, timeout); }
  // Radio inputs are intentionally transparent; their visible labels are pointer targets.
  async view(name) { await this.waitVisible(`#view-${name}.active`); return this.text(`#view-${name}`); }
  async route(name) { await this.evaluate(`location.hash=${JSON.stringify('#/' + name)}`); await this.view(name); }
  async key(key, options = {}) {
    const codes = { Enter: 13, Tab: 9, Escape: 27, Backspace: 8, Home: 36, End: 35, ArrowDown: 40, ArrowUp: 38, a: 65 };
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key === 'a' ? 'KeyA' : key, windowsVirtualKeyCode: codes[key], ...options });
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key === 'a' ? 'KeyA' : key, windowsVirtualKeyCode: codes[key], ...options });
  }
  async click(selector) {
    await this.front();
    await until(() => this.evaluate(`(()=>{let e=document.querySelector(${JSON.stringify(selector)});if(e?.matches('input[type="radio"],input[type="checkbox"]'))e=e.closest('label')||e;return !!e&&!e.closest('[hidden]')&&e.getClientRects().length>0})()`), `rendered control ${selector}`);
    const point = await this.evaluate(`(()=>{let e=document.querySelector(${JSON.stringify(selector)});if(e.matches('input[type="radio"],input[type="checkbox"]'))e=e.closest('label')||e;e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:!!e.disabled,visible:(${visibleFunction})(e)}})()`);
    assert.ok(!point.disabled, `Disabled control ${selector}`);
    assert.ok(point.visible, `Control/label is clipped or hidden: ${selector}`);
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  }
  async fill(selector, value) {
    await this.click(selector); await this.key('a', { modifiers: 2 });
    if (value) await this.cdp.send('Input.insertText', { text: value }); else await this.key('Backspace');
  }
  async select(selector, value) {
    await this.waitVisible(selector);
    await this.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(![...e.options].some(o=>o.value===${JSON.stringify(value)}))throw Error('Missing option '+${JSON.stringify(value)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  }
  async score() { const text = await this.text('#score'); return { text, points: Number(text.match(/(\d+) pts/)?.[1]) }; }
  async close() { if (this.closed) return; this.closed = true; await browser.send('Target.closeTarget', { targetId: this.id }, true).catch(() => {}); this.cdp.close(); }
}

async function newTab(name, url = base) {
  assert.ok(tabs.filter(t => !t.closed).length < 3, 'Memory guard: at most host + two player tabs');
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const targets = await fetch(`http://127.0.0.1:${metadata.debug_port}/json/list`, { signal: AbortSignal.timeout(3000) }).then(r => r.json());
  const endpoint = targets.find(t => t.id === targetId)?.webSocketDebuggerUrl;
  assert.ok(endpoint, `Missing target endpoint ${name}`);
  const client = new CDP(endpoint, name), tab = new Tab(targetId, client, name); tabs.push(tab);
  await client.opened;
  for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await client.send(`${domain}.enable`);
  client.on('Runtime.consoleAPICalled', e => {
    if (['error', 'warning', 'warn'].includes(e.type)) events.push({ at: Date.now(), tab: name, step: activeStep, kind: `console.${e.type}`, message: e.args.map(a => a.value ?? a.description ?? a.type).join(' ').slice(0, 3000) });
  });
  client.on('Runtime.exceptionThrown', e => events.push({ at: Date.now(), tab: name, step: activeStep, kind: 'exception', message: e.exceptionDetails.exception?.description || e.exceptionDetails.text }));
  client.on('Log.entryAdded', ({ entry }) => { if (entry.level === 'error') events.push({ at: Date.now(), tab: name, step: activeStep, kind: 'browser-error', message: entry.text, url: entry.url }); });
  client.on('Fetch.requestPaused', async e => {
    if (new URL(e.request.url).hostname === 'power.larc.nasa.gov') {
      metadata.power_requests_blocked++; events.push({ at: Date.now(), tab: name, step: activeStep, kind: 'POWER blocked (expected)', message: e.request.url });
      await client.send('Fetch.failRequest', { requestId: e.requestId, errorReason: 'Failed' }, true);
    } else await client.send('Fetch.continueRequest', { requestId: e.requestId }, true);
  });
  await client.send('Fetch.enable', { patterns: [{ urlPattern: '*://power.larc.nasa.gov/*', requestStage: 'Request' }] });
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 940, deviceScaleFactor: 1, mobile: false });
  // Functional checks measure layout right after a view change; reduced motion turns the panel animations off so they never catch a panel mid-slide.
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await tab.front(); await client.send('Page.navigate', { url });
  await until(() => tab.evaluate("!!document.querySelector('#demo-list .demo-btn')"), 'app initialized', 35000);
  return tab;
}

async function screenshot(id) {
  if (!foreground || foreground.closed) return { error: 'No foreground tab available' };
  try {
    const visible = await foreground.evaluate('document.visibilityState');
    assert.equal(visible, 'visible', 'Refusing to screenshot a background tab');
    const { data } = await foreground.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const path = join(artifacts, `${id}.png`); await writeFile(path, Buffer.from(data, 'base64'));
    return { path: relative(path), tab: foreground.name };
  } catch (e) { return { error: e.message }; }
}

async function step(name, severity, expected, action, tab = mainTab, timeout = 35000) {
  if (stopped) throw new Error('Run interrupted');
  const id = String(results.length + 1).padStart(3, '0'), start = Date.now(), controller = new AbortController();
  const row = { id, name, severity, expected, status: 'PASS', actual: '', tab: tab?.name || 'infrastructure', console: [] };
  activeStep = id;
  activeController = controller;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    await context.run({ signal: controller.signal }, async () => {
      if (tab) await tab.front();
      row.actual = await action() || 'Visible assertions passed.';
    });
  } catch (e) {
    row.status = 'FAIL'; row.actual = e.message;
    if (tab && !tab.closed) row.state = await tab.evaluate(`({url:location.href,view:document.querySelector('.view.active')?.id,text:document.querySelector('.view.active')?.innerText?.slice(0,2200)})`).catch(error => ({ error: error.message }));
    row.screenshot = await screenshot(id);
  } finally {
    clearTimeout(timer); row.duration_ms = Date.now() - start;
    row.console = events.filter(e => e.at >= start && e.step === id);
    const exceptions = row.console.filter(e => e.kind === 'exception');
    if (exceptions.length && row.status === 'PASS') { row.status = 'FAIL'; row.actual += ` Uncaught exceptions: ${exceptions.map(e => e.message).join('; ')}`; row.screenshot = await screenshot(id); }
    results.push(row); activeStep = null; activeController = null;
    await writeFile(join(artifacts, 'results.json'), JSON.stringify({ metadata, results, events }, null, 2));
    console.log(`${row.status} ${id} ${name}${row.status === 'FAIL' ? ': ' + row.actual.slice(0, 180) : ''}`);
  }
  return row;
}

async function setup() {
  await mkdir(downloads, { recursive: true });
  metadata.sources_before = await snapshotSources();
  let answered = false;
  try { const r = await fetch(base, { signal: AbortSignal.timeout(2500) }); answered = r.ok && (await r.text()).includes('view-home'); } catch {}
  metadata.used_existing_server = answered;
  assert.ok(answered, 'Existing localhost:8765 server unavailable; runner will not start or stop a server');
  const other = spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match '--headless' -and $_.CommandLine -notmatch '--type=' } | Measure-Object).Count`], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(other.status, 0, 'Could not check headless Chrome memory guard');
  assert.equal(Number(other.stdout.trim()), 0, 'Another headless Chrome is running; refusing to launch a second browser');
  const port = await new Promise((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
  metadata.debug_port = port;
  browserProcess = spawn(chromeExe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,940', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-crash-reporter', '--disable-breakpad', '--renderer-process-limit=2'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  metadata.browser_instances_started++; metadata.chrome_pid = browserProcess.pid;
  let chromeLog = ''; browserProcess.stderr.on('data', d => { chromeLog += d; }); browserProcess.on('exit', () => writeFile(join(artifacts, 'chrome.log'), chromeLog).catch(() => {}));
  const version = await until(async () => { try { return await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) }).then(r => r.json()); } catch { return false; } }, 'Chrome CDP', 12000);
  metadata.chrome = version.Browser;
  browser = new CDP(version.webSocketDebuggerUrl, 'browser'); await browser.opened;
  const initial = await browser.send('Target.getTargets');
  mainTab = await newTab('main');
  for (const target of initial.targetInfos.filter(t => t.type === 'page')) await browser.send('Target.closeTarget', { targetId: target.targetId });
}

async function cleanup() {
  for (const tab of tabs) await tab.close();
  if (browser) { await browser.send('Browser.close', {}, true).catch(() => {}); browser.close(); }
  await sleep(500);
  const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  if (browserProcess?.pid && alive(browserProcess.pid)) spawnSync('taskkill.exe', ['/PID', String(browserProcess.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 10000 });
  metadata.cleanup = { closed_tabs: tabs.filter(t => t.closed).length, total_tabs: tabs.length, owned_chrome_stopped: !browserProcess?.pid || !alive(browserProcess.pid), existing_server_untouched: true };
  const safeProfile = resolve(profile);
  assert.ok(safeProfile.startsWith(resolve(directory) + sep), 'Profile cleanup escaped e2e directory');
  await rm(safeProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }).catch(e => { metadata.cleanup.profile_cleanup_error = e.message; });
}

async function report() {
  metadata.finished = new Date().toISOString(); metadata.sources_after = await snapshotSources();
  const weight = { blocker: 0, major: 1, minor: 2 };
  const sorted = [...results].sort((a, b) => weight[a.severity] - weight[b.severity] || (a.status === b.status ? 0 : a.status === 'FAIL' ? -1 : 1) || a.id.localeCompare(b.id));
  let text = `# Signal or Noise — interaction audit R1\n\nRun: ${metadata.started} → ${metadata.finished}. Node ${metadata.node}; ${metadata.chrome || 'Chrome unavailable'}. Target: ${base}.\n\n**${results.filter(r => r.status === 'PASS').length} PASS / ${results.filter(r => r.status === 'FAIL').length} FAIL.** One isolated Chrome process; maximum three app tabs (host plus two players). Live POWER is intercepted before transmission: ${metadata.power_requests_blocked} requests failed through Fetch.failRequest. Reused the existing server; never started or stopped a server.\n\nCleanup: \`${JSON.stringify(metadata.cleanup)}\`. Source hashes: [run evidence](${relative(join(artifacts, 'results.json'))}). Catalog/image data can change concurrently; this runner does not modify or freeze them. Changed source hashes: ${Object.keys(metadata.sources_before || {}).filter(k => metadata.sources_before[k] !== metadata.sources_after[k]).join(', ') || 'none'}.\n\nTests use public hash routes for setup and real pointer/keyboard events for actions; select values dispatch their normal change event. No private app functions, synthetic scientific series, or mocked successful NASA responses are injected. Visibility assertions include viewport and scroll-container clipping. Transparent radio inputs are clicked through their visible labels. Initialization waits for attached demo controls, which may belong to an inactive home view. Internal vertical panel scrolling is allowed. PASS means the stated visible assertion passed; warnings and browser resource errors remain attached per step. Uncaught JavaScript exceptions also fail the step. Every failed step attempts a foreground-only screenshot; any capture failure is stated explicitly. Per-step aborts and CDP timeouts bound all waits.\n\nAll scenarios are ordered by blocker, major, minor, with failures first within each severity. Horizontal layout overflow is minor; interaction failures and score farming are major. Unverified headless picking is labelled a limitation rather than a proven application defect.\n\n`;
  text += 'Initial timeout diagnosis: **test-script error**. `index.html:69` intentionally gives `.chip input` opacity 0 and disables its pointer events; `main.js:299` wraps each variable radio in a visible label. Waiting for a visible `#variables input` can never succeed. The runner clicks that label and asserts the checked state/definition. Player initialization also checks attached controls rather than visibility of the inactive home view.\n\n';
  for (const row of sorted) {
    const shot = row.actual.match(/"screenshot":"([^"]+)"|screenshot=(\S+)/);
    if (!row.screenshot && shot) row.screenshot = { path: shot[1] || shot[2], tab: row.tab };
    text += `## ${row.status} · ${row.severity} · ${row.id} ${row.name}\n\n- **Expected:** ${row.expected}\n- **Actual:** ${row.actual.replaceAll('\n', ' ')}\n- **Tab / duration:** ${row.tab} / ${row.duration_ms} ms\n- **Console errors/exceptions:** ${row.console.length ? row.console.map(e => `\`${e.kind}\`: ${e.message.replaceAll('\n', ' ').slice(0, 1000)}${e.url ? ' (' + e.url + ')' : ''}`).join(' · ') : 'none'}\n- **Screenshot:** ${row.screenshot?.path ? `[foreground ${row.screenshot.tab}](${row.screenshot.path})` : row.screenshot?.error || 'not needed (PASS)'}\n`;
    if (row.state) text += `- **Failure state:** \`${JSON.stringify(row.state).replaceAll('`', "'")}\`\n`;
    text += '\n';
  }
  text += '\nProtocol sources: [CDP Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/), [Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/), [Input](https://chromedevtools.github.io/devtools-protocol/tot/Input/). Application expectations were read from index.html, main.js and classroom.js. No application fixes or commits were made. Successful leads are outside this POWER-blocked run; no successful network fixture was fabricated.\n';
  await writeFile(join(directory, 'REPORT.md'), text);
  await writeFile(join(artifacts, 'results.json'), JSON.stringify({ metadata, results, events }, null, 2));
}

const auditedViews = new Set();
async function auditView(tab, name, targets) {
  if (auditedViews.has(name)) return;
  auditedViews.add(name);
  for (const [width, height] of [[1920, 940], [1366, 768], [390, 844]]) {
    await step(`Layout ${name} at ${width}x${height}`, 'minor', 'Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.', async () => {
      await tab.cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
      await sleep(150);
      const size = await tab.evaluate(`(()=>{const e=document.querySelector('.view.active'),r=e?.getBoundingClientRect();return {view:e?.id,scrollHeight:e?.scrollHeight,clientHeight:e?.clientHeight,panelScrollWidth:e?.scrollWidth,panelClientWidth:e?.clientWidth,overflowY:e&&getComputedStyle(e).overflowY,switches:[...document.querySelectorAll('.world button')].map(b=>{const q=b.getBoundingClientRect(),hit=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return {id:b.id,uncovered:b===hit||b.contains(hit)}}),scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,width:innerWidth,height:innerHeight,panel:r&&{left:r.left,right:r.right,top:r.top,bottom:r.bottom}}})()`);
      assert.equal(size.view, `view-${name}`, `Cannot audit ${name}: actual active view is ${size.view}`);
      assert.ok(size.panel && size.clientHeight > 0, `Missing active panel: ${JSON.stringify(size)}`);
      assert.ok((size.scrollHeight <= size.clientHeight + 1 || /auto|scroll/.test(size.overflowY)) && size.panelScrollWidth <= size.panelClientWidth + 1 && size.scrollWidth <= size.width + 1 && size.bodyWidth <= size.width + 1 && size.panel.left >= -1 && size.panel.right <= size.width + 1 && size.panel.top >= -1 && size.panel.bottom <= size.height + 1, JSON.stringify(size));
      assert.ok(size.switches.every(b => b.uncovered), 'Covered Earth/Moon switch: ' + JSON.stringify(size.switches));
      const shot = await screenshot(`layout-${name}-${width}x${height}`);
      assert.ok(shot.path, shot.error);
      return JSON.stringify({...size,screenshot:shot.path});
    }, tab);
  }
  await tab.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 940, deviceScaleFactor: 1, mobile: false });
  await step(`Keyboard ${name}: main controls and visible focus`, 'major', `Tab reaches ${targets.join(', ')} with a visible focus outline or ring.`, async () => {
    assert.equal(await tab.evaluate(`document.querySelector('.view.active')?.id`), `view-${name}`, 'Wrong view for keyboard audit');
    await tab.evaluate(`document.querySelector('.view.active h1,.view.active h2')?.focus()`);
    const missing = new Set(targets), trace = [];
    for (let i = 0; i < 130 && missing.size; i++) {
      await tab.key('Tab');
      const focus = await tab.evaluate(`(()=>{const e=document.activeElement,s=getComputedStyle(e),visible=(${visibleFunction});return {id:e.id,tag:e.tagName,text:e.innerText?.slice(0,60),ring:(parseFloat(s.outlineWidth)>0&&s.outlineStyle!=='none'&&s.outlineColor!=='transparent')||s.boxShadow!=='none',matched:${JSON.stringify(targets)}.filter(sel=>e.matches(sel)&&visible(sel))}})()`);
      trace.push(focus);
      for (const sel of focus.matched) { assert.ok(focus.ring, `No visible focus: ${JSON.stringify(focus)}`); missing.delete(sel); }
    }
    assert.equal(missing.size, 0, `Unreached controls: ${[...missing]}; last focus: ${JSON.stringify(trace.slice(-8))}`);
    return `Reached all controls; ${trace.length} Tab presses. ${JSON.stringify(trace.filter(x => x.matched.length))}`;
  }, tab, 40000);
}

let catalog, places, mission, discovery, unknownFixture;
async function choosePlace(tab, id, variable = 'T2M', hunch = 'unsure') {
  const place = places.get(id); assert.ok(place, `Missing fixture place ${id}`);
  await tab.route('case');
  await tab.click('#kinds [data-kind=""]');
  await tab.select('#country', '');
  await tab.fill('#place-search', place.short);
  await tab.click(`#place-cards [data-id="${id}"]`);
  await tab.click(`#variables input[value="${variable}"]`);
  await tab.click(`input[name="hunch"][value="${hunch}"]`);
}
async function openCase(tab, fixture = unknownFixture, hunch = 'unsure') {
  metadata.current_fixture = { place: fixture.place, variable: fixture.variable };
  await choosePlace(tab, fixture.place, fixture.variable, hunch);
  await tab.click('#case-form button[type="submit"]');
  await tab.view('evidence'); await tab.waitVisible('#chart svg');
}
async function truth(tab) {
  return tab.evaluate(`(()=>{const b=document.querySelector('#stat-badge'),v=['confirmed','likely','unknown'].find(c=>b.classList.contains(c)),d=v==='unknown'?'none':document.querySelector('#stat').classList.contains('up')?'up':'down';return {verdict:v,direction:d,tilt:document.querySelector('#stat').textContent.trim().startsWith('-')?'down':'up'}})()`);
}
async function answerCase(tab, correct = true) {
  const actual = await truth(tab);
  const direction = correct ? actual.direction : ['up', 'down', 'none'].find(d => d !== actual.direction);
  await tab.click(`[data-trend="${direction}"]`);
  await tab.waitVisible('#stat-row'); assert.ok((await tab.text('#trend-feedback')).length > 10);
  await tab.click('#view-evidence a[href="#/verdict"]'); await tab.view('verdict');
  const call = correct ? actual.verdict : actual.verdict === 'unknown' ? 'confirmed' : 'unknown';
  await tab.click(`[data-call="${call}"]`); await tab.waitVisible('#verdict-block');
  return actual;
}

async function homeAndTours() {
  await mainTab.route('home');
  await auditView(mainTab, 'home', ['#view-home a[href="#/global"]', '#view-home a[href="#/case"]', '#view-home a[href="#/class"]']);
  await step('Home: classroom button and Back', 'major', 'Play in class opens host/join controls; Back returns home.', async () => { await mainTab.route('home'); await mainTab.click('#view-home a[href="#/class"]'); await mainTab.view('class'); await mainTab.waitVisible('#host-btn'); await mainTab.click('#view-class a[href="#/home"]'); await mainTab.view('home'); return 'Classroom host/join and home visible.'; });
  await step('Home: Skip and brand navigation', 'major', 'Skip opens the case picker and the brand returns home.', async () => { await mainTab.click('#skip'); await mainTab.view('case'); await mainTab.click('#brand-home'); await mainTab.view('home'); return 'Skip → case → brand → home.'; });
  const demos = await mainTab.evaluate(`[...document.querySelectorAll('#demo-list .demo-btn')].map(b=>({index:b.dataset.i,title:b.textContent}))`);
  for (const demo of demos) {
    await step(`Demo ${demo.index}: start and Next — ${demo.title}`, 'major', 'Tour overlay opens; Next advances its visible step counter and view.', async () => {
      await mainTab.route('home'); await mainTab.click(`#demo-list [data-i="${demo.index}"]`); await mainTab.waitVisible('#tour');
      if (await mainTab.text('#tour-pause') === 'Pause') await mainTab.click('#tour-pause');
      const before = await mainTab.text('#tour-text'); await mainTab.click('#tour-next'); const after = await mainTab.text('#tour-text');
      const oldStep = Number(before.match(/^(\d+)/)?.[1]), total = Number(before.match(/^\d+\/(\d+)/)?.[1]);
      if (oldStep === total) assert.equal(await mainTab.visible('#tour'), false);
      else assert.ok(Number(after.match(/^(\d+)/)?.[1]) > oldStep, `${before} → ${after}`); return `${before} → ${after}`;
    });
    await step(`Demo ${demo.index}: Pause`, 'major', 'Pause changes to Play and prevents auto-advance over the normal 9-second interval.', async () => {
      if (!(await mainTab.visible('#tour'))) { await mainTab.route('home'); await mainTab.click(`#demo-list [data-i="${demo.index}"]`); }
      if (await mainTab.text('#tour-pause') === 'Play') await mainTab.click('#tour-pause');
      await mainTab.click('#tour-pause'); assert.equal(await mainTab.text('#tour-pause'), 'Play');
      const before = await mainTab.text('#tour-text'); await sleep(9400); assert.equal(await mainTab.text('#tour-text'), before); return `Paused for 9.4 seconds: ${before}`;
    }, mainTab, 35000);
    await step(`Demo ${demo.index}: resume and Exit`, 'major', 'Play changes to Pause; Exit removes the tour overlay.', async () => { await mainTab.click('#tour-pause'); assert.equal(await mainTab.text('#tour-pause'), 'Pause'); await mainTab.click('#tour-stop'); assert.equal(await mainTab.visible('#tour'), false); return 'Tour resumed and exited.'; });
    await step(`Demo ${demo.index}: every remaining step and Close`, 'major', 'Every tour step has text and an active view; final Close hides the tour.', async () => {
      await mainTab.route('home'); await mainTab.click(`#demo-list [data-i="${demo.index}"]`);
      const seen = [];
      for (let i = 0; i < 7 && await mainTab.visible('#tour'); i++) { seen.push(await mainTab.text('#tour-text')); assert.ok((await mainTab.text('.view.active')).length > 15); await mainTab.click('#tour-next'); }
      assert.equal(await mainTab.visible('#tour'), false); assert.ok(seen.length >= 4); return seen.join(' | ');
    }, mainTab, 35000);
  }
}

async function casePicker() {
  await mainTab.route('case');
  await mainTab.fill('#place-search', ''); await mainTab.select('#country', '');
  const kinds = await mainTab.evaluate(`[...document.querySelectorAll('#kinds [data-kind]')].map(b=>({id:b.dataset.kind,text:b.textContent.trim()}))`);
  for (const kind of kinds) await step(`Case kind chip: ${kind.text}`, 'major', 'The selected chip is pressed; all visible place cards match its kind.', async () => {
    await mainTab.click(`#kinds [data-kind="${kind.id}"]`);
    const state = await mainTab.evaluate(`({pressed:document.querySelector('#kinds [data-kind="${kind.id}"]').getAttribute('aria-pressed'),ids:[...document.querySelectorAll('#place-cards .place')].map(b=>b.dataset.id),count:document.querySelector('#page-info').textContent})`);
    assert.equal(state.pressed, 'true'); assert.ok(state.ids.length > 0);
    if (kind.id) assert.ok(state.ids.every(id => places.get(id)?.environment === kind.id), JSON.stringify(state)); return JSON.stringify(state);
  });
  await mainTab.click('#kinds [data-kind=""]');
  await step('Case country filter: Peru', 'major', 'Choosing Peru shows only Peruvian places; clearing restores the larger list.', async () => {
    await mainTab.select('#country', 'Peru');
    const ids = await mainTab.evaluate(`[...document.querySelectorAll('#place-cards .place')].map(b=>b.dataset.id)`);
    assert.ok(ids.length > 0 && ids.every(id => (places.get(id)?.country || '').split(';').map(v => v.trim()).includes('Peru')), JSON.stringify(ids));
    const filtered = await mainTab.text('#page-info'); await mainTab.select('#country', ''); assert.notEqual(await mainTab.text('#page-info'), filtered); return filtered;
  });
  await step('Case search: name', 'major', 'Searching Coropuna shows its place card, and no unrelated cards.', async () => { await mainTab.fill('#place-search', 'Coropuna'); const ids = await mainTab.evaluate(`[...document.querySelectorAll('#place-cards .place')].map(b=>b.dataset.id)`); assert.deepEqual(ids, ['coropuna']); return await mainTab.text('#page-info'); });
  await step('Case card: photo and credit popup', 'major', 'Clicking Coropuna opens an onscreen popup with loaded photo, name and attribution/source.', async () => {
    await mainTab.click('#place-cards [data-id="coropuna"]'); await mainTab.waitVisible('#place-pop');
    await until(() => mainTab.evaluate(`document.querySelector('#pop-img').complete&&document.querySelector('#pop-img').naturalWidth>0`), 'popup photo');
    assert.match(await mainTab.text('#pop-name'), /Coropuna/i); assert.match(await mainTab.text('#pop-credit'), /Photo:|NASA Worldview/);
    assert.ok(await mainTab.visible('#pop-credit')); return `${await mainTab.text('#pop-name')} · ${await mainTab.text('#pop-credit')}`;
  });
  await step('Case search: lat, lon + Enter', 'major', 'Enter selects the exact typed coordinates and shows Selected point in the popup.', async () => {
    await mainTab.fill('#place-search', '12.3456, 45.6789'); await mainTab.key('Enter');
    const point = await mainTab.evaluate(`({lat:document.querySelector('#lat').value,lon:document.querySelector('#lon').value})`);
    assert.equal(Number(point.lat), 12.3456); assert.equal(Number(point.lon), 45.6789); assert.equal(await mainTab.text('#pop-name'), 'Selected point'); return JSON.stringify(point);
  });
  await step('Case pager: Next and Previous', 'major', 'Next changes cards/page count; Previous restores the exact first cards.', async () => {
    await mainTab.fill('#place-search', ''); const before = await mainTab.evaluate(`[...document.querySelectorAll('#place-cards .place')].map(b=>b.dataset.id)`);
    await mainTab.click('#next-page'); assert.match(await mainTab.text('#page-info'), /^2\s*\//);
    const after = await mainTab.evaluate(`[...document.querySelectorAll('#place-cards .place')].map(b=>b.dataset.id)`); assert.notDeepEqual(after, before);
    await mainTab.click('#prev-page'); assert.deepEqual(await mainTab.evaluate(`[...document.querySelectorAll('#place-cards .place')].map(b=>b.dataset.id)`), before); return `${before} → ${after} → ${before}`;
  });
  await mainTab.fill('#place-search', 'Coropuna'); await mainTab.click('#place-cards [data-id="coropuna"]');
  for (const variable of catalog.variables) await step(`Case variable chip and definition: ${variable.id}`, 'major', 'The variable radio is checked and its visible definition matches catalog metadata.', async () => {
    await mainTab.click(`#variables input[value="${variable.id}"]`);
    assert.ok(await mainTab.evaluate(`document.querySelector('#variables input[value="${variable.id}"]').checked`));
    const definition = await mainTab.text('#var-def'); assert.ok(definition.includes(variable.definition), definition); assert.ok(await mainTab.visible('#var-def')); return definition;
  });
  for (const value of ['up', 'down', 'none', 'unsure']) await step(`Case hunch: ${value}`, 'minor', 'The chosen hunch radio becomes checked.', async () => { await mainTab.click(`input[name="hunch"][value="${value}"]`); assert.ok(await mainTab.evaluate(`document.querySelector('input[name="hunch"][value="${value}"]').checked`)); return `Checked ${value}`; });
  await auditView(mainTab, 'case', ['#place-search', '#country', '#case-form button[type="submit"]', '#scan']);
}

async function evidenceAndVerdict() {
  for (const kind of ['good', 'close', 'miss']) await step(`Evidence direction: ${kind}, one reveal and no double score`, 'major', `Visible ${kind} feedback, one revealed statistic, and repeated clicks add no points.`, async () => {
    await openCase(mainTab); const t = await truth(mainTab); assert.equal(t.verdict, 'unknown', 'Unknown fixture required for all three feedback types');
    assert.equal(await mainTab.visible('#stat-row'), false);
    const answer = kind === 'good' ? 'none' : kind === 'close' ? t.tilt : t.tilt === 'up' ? 'down' : 'up';
    const before = await mainTab.score(); await mainTab.click(`[data-trend="${answer}"]`); await mainTab.waitVisible('#stat-row');
    assert.ok(await mainTab.visible(`#trend-feedback.${kind}`)); const after = await mainTab.score(); assert.equal(after.points - before.points, kind === 'good' ? 1 : 0);
    await mainTab.click(`[data-trend="${answer}"]`); await mainTab.click('[data-trend="none"]'); assert.equal((await mainTab.score()).points, after.points);
    assert.equal(await mainTab.evaluate(`document.querySelectorAll('#stat-row').length`), 1); return `${await mainTab.text('#trend-feedback')} · ${await mainTab.text('#stat')} · points ${before.points}→${after.points}`;
  }, mainTab, 35000);
  await auditView(mainTab, 'evidence', ['[data-trend="up"]', '#view-evidence a[href="#/projection"]', '#view-evidence a[href="#/verdict"]']);
  await step('Evidence: data table and sources details', 'major', 'Opening Data and sources shows all yearly rows and a source caption.', async () => {
    await mainTab.click('#view-evidence summary'); await mainTab.waitVisible('#table table');
    const rows = await mainTab.evaluate(`document.querySelectorAll('#table tbody tr').length`); assert.equal(rows, unknownFixture.series.years.length);
    assert.match(await mainTab.text('#chart-caption'), /Source:/); return `${rows} annual rows; ${await mainTab.text('#chart-caption')}`;
  });
  await step('Projection: uncertainty band or No projection', 'major', 'Projection renders a real band with a range, or explicitly says No projection with a reason.', async () => {
    await mainTab.click('#view-evidence a[href="#/projection"]'); await mainTab.view('projection');
    const status = await mainTab.text('#proj-stat'); assert.ok(status.length > 0);
    const polygons = await mainTab.evaluate(`document.querySelectorAll('#proj-chart polygon').length`);
    if (status === 'No projection') { assert.equal(polygons, 0); assert.ok((await mainTab.text('#proj-note')).length > 20); }
    else { assert.ok(polygons > 0); assert.match(await mainTab.text('#proj-note'), /range/i); }
    return `${status}; polygons=${polygons}; ${await mainTab.text('#proj-note')}`;
  });
  await auditView(mainTab, 'projection', ['#view-projection a[href="#/evidence"]', '#view-projection a[href="#/verdict"]']);
  await step('Projection: Back and browser history back/forward', 'major', 'Page.navigateToHistoryEntry restores evidence and then projection without losing the case.', async () => {
    const history = await mainTab.cdp.send('Page.getNavigationHistory');
    const previous = history.entries[history.currentIndex - 1], now = history.entries[history.currentIndex]; assert.ok(previous.url.endsWith('#/evidence'));
    await mainTab.cdp.send('Page.navigateToHistoryEntry', { entryId: previous.id }); await mainTab.view('evidence');
    await mainTab.cdp.send('Page.navigateToHistoryEntry', { entryId: now.id }); await mainTab.view('projection');
    await mainTab.click('#view-projection a[href="#/evidence"]'); await mainTab.view('evidence'); return 'History back → evidence; forward → projection; Back → evidence.';
  });
  for (const [call, feedback, points] of [['unknown', 'good', 2], ['likely', 'close', 1], ['confirmed', 'miss', 0]]) await step(`Verdict answer ${call}: ${feedback}, one reveal and no double score`, 'major', `Visible ${feedback} feedback and verdict; only ${points} points, including repeated clicks.`, async () => {
    await openCase(mainTab); await mainTab.click('#view-evidence a[href="#/verdict"]'); await mainTab.view('verdict'); assert.equal(await mainTab.visible('#verdict-block'), false);
    const before = (await mainTab.score()).points; await mainTab.click(`[data-call="${call}"]`); await mainTab.waitVisible('#verdict-block');
    assert.ok(await mainTab.visible(`#verdict-feedback.${feedback}`)); const after = (await mainTab.score()).points; assert.equal(after - before, points);
    await mainTab.click(`[data-call="${call}"]`); await mainTab.click('[data-call="unknown"]'); assert.equal((await mainTab.score()).points, after); return `${await mainTab.text('#verdict-feedback')} · score ${before}→${after}`;
  }, mainTab, 35000);
  await step('Verdict: every clue opens', 'major', 'Each clue button hides and its explanation becomes visible exactly once.', async () => {
    const count = await mainTab.evaluate(`document.querySelectorAll('#checks .clue').length`); assert.ok(count >= 3);
    for (let i = 0; i < count; i++) { await mainTab.click(`#checks [data-clue="${i}"] .clue`); assert.ok(await mainTab.visible(`#checks [data-clue="${i}"] > span`)); assert.equal(await mainTab.visible(`#checks [data-clue="${i}"] .clue`), false); }
    return `${count} clue explanations opened.`;
  });
  await step('Verdict: statistics details', 'major', 'The statistics disclosure opens with numerical slope, p and methods.', async () => { await mainTab.click('#view-verdict summary'); const text = await mainTab.text('#details'); assert.match(text, /Sen's slope/); assert.match(text, /p =/); assert.ok(await mainTab.visible('#details')); return text.slice(0, 700); });
  await auditView(mainTab, 'verdict', ['#lineup-start', '#compare-start', '#view-verdict a[href="#/record"]']);
  await step('Case file: open and download', 'major', 'Case file has provenance rows; Page.setDownloadBehavior allows a valid JSON download.', async () => {
    await mainTab.click('#view-verdict a[href="#/record"]'); await mainTab.view('record'); assert.match(await mainTab.text('#record'), /Method/);
    const before = new Set(await readdir(downloads)); await mainTab.click('#download');
    const file = await until(async () => (await readdir(downloads)).find(f => !before.has(f) && f.endsWith('.json')), 'case JSON download');
    const data = await json(join(downloads, file)); assert.equal(data.variable, unknownFixture.variable); assert.ok(data.series.years.length >= 8); assert.ok(data.result.verdict);
    return `${relative(join(downloads, file))}; ${data.series.years.length} rows; verdict=${data.result.verdict}`;
  });
  await auditView(mainTab, 'record', ['#download', '#view-record a[href="#/verdict"]']);
  await step('Case file: Back', 'major', 'Back returns to the same verdict.', async () => { await mainTab.click('#view-record a[href="#/verdict"]'); await mainTab.view('verdict'); assert.ok((await mainTab.text('#verdict')).length); return await mainTab.text('#verdict'); });
  await step('Lineup: pick and one result only', 'major', 'Nine series appear; selecting a series reveals the real one; repeat selection changes nothing.', async () => {
    await mainTab.click('#lineup-start'); await mainTab.view('lineup'); assert.equal(await mainTab.evaluate(`document.querySelectorAll('#lineup-grid button').length`), 9);
    await mainTab.click('#lineup-grid [data-i="0"]'); const first = await mainTab.text('#lineup-result'); assert.ok(first.length > 20); assert.equal(await mainTab.evaluate(`document.querySelectorAll('#lineup-grid .real').length`), 1);
    await mainTab.click('#lineup-grid [data-i="1"]'); assert.equal(await mainTab.text('#lineup-result'), first); return first;
  });
  await auditView(mainTab, 'lineup', ['#lineup-grid [data-i="0"]', '#view-lineup a[href="#/verdict"]']);
  await step('Lineup: Back', 'major', 'Back restores verdict.', async () => { await mainTab.click('#view-lineup a[href="#/verdict"]'); await mainTab.view('verdict'); return 'Verdict visible.'; });
  await step('Compare: start, pick second bundled place and result', 'major', 'Compare banner opens; second place produces two charts and a comparison summary without POWER.', async () => {
    await openCase(mainTab, mission[0]); await mainTab.click('#view-evidence a[href="#/verdict"]'); await mainTab.view('verdict');
    const beforePower = metadata.power_requests_blocked; await mainTab.click('#compare-start'); await mainTab.view('case'); await mainTab.waitVisible('#compare-banner');
    await choosePlace(mainTab, 'jakobshavn', 'T2M'); await mainTab.click('#case-form button[type="submit"]'); await mainTab.view('compare');
    assert.equal(await mainTab.evaluate(`document.querySelectorAll('#compare-grid svg').length`), 2); assert.ok((await mainTab.text('#compare-summary')).length > 15); assert.equal(metadata.power_requests_blocked, beforePower);
    return `${await mainTab.text('#t-compare')}; ${await mainTab.text('#compare-summary')}`;
  }, mainTab, 35000);
  await auditView(mainTab, 'compare', ['#view-compare a[href="#/case"]']);
  await step('Compare: New case', 'major', 'New case returns to picker.', async () => { await mainTab.click('#view-compare a[href="#/case"]'); await mainTab.view('case'); return await mainTab.text('#page-info'); });
  await step('Hunch: evidence and clue', 'major', 'A correct no-change hunch is recorded and its explanation opens.', async () => {
    await openCase(mainTab, unknownFixture, 'none'); await mainTab.click('#view-evidence a[href="#/verdict"]'); await mainTab.click('[data-call="unknown"]');
    const selector = await mainTab.evaluate(`(()=>{const b=[...document.querySelectorAll('#checks .clue')].find(b=>b.textContent.includes('hunch'));return b?'#checks [data-clue="'+b.parentElement.dataset.clue+'"] .clue':null})()`); assert.ok(selector);
    await mainTab.click(selector); assert.match(await mainTab.text('#checks'), /Your hunch was right/); return await mainTab.text('#checks');
  }, mainTab, 35000);
  await step('Evidence: Back', 'major', 'Evidence Back returns to case picker.', async () => { await mainTab.route('evidence'); await mainTab.click('#view-evidence a[href="#/case"]'); await mainTab.view('case'); return 'Picker visible.'; });
}

async function scanAndGlobal() {
  await step('Scan everything: blocked POWER friendly message', 'major', 'Fetch.failRequest blocks POWER; a friendly busy message stays visible on the case form.', async () => {
    await mainTab.route('case'); await mainTab.fill('#place-search', '12.3456, 45.6789'); await mainTab.key('Enter');
    const before = metadata.power_requests_blocked; await mainTab.click('#scan');
    await until(async () => /NASA POWER is busy/.test(await mainTab.text('#status')), 'friendly POWER busy message', 15000);
    assert.ok(metadata.power_requests_blocked > before); await mainTab.view('case'); return `${await mainTab.text('#status')} · blocked=${metadata.power_requests_blocked - before}`;
  });
  await step('Global: open and variable groups', 'major', 'Both near-ground and upper-air/land-water groups contain options.', async () => {
    await mainTab.route('home'); await mainTab.click('#global-link'); await mainTab.view('global');
    await until(() => mainTab.evaluate(`document.querySelectorAll('#global-var optgroup').length===2`), 'two global variable groups');
    const groups = await mainTab.evaluate(`[...document.querySelectorAll('#global-var optgroup')].map(g=>({label:g.label,ids:[...g.querySelectorAll('option')].map(o=>o.value)}))`);
    assert.ok(groups.every(g => g.ids.length > 0)); return JSON.stringify(groups);
  });
  const groups = await mainTab.evaluate(`[...document.querySelectorAll('#global-var optgroup')].map(g=>({label:g.label,first:g.querySelector('option')?.value}))`);
  for (const group of groups) await step(`Global variable group: ${group.label}`, 'major', 'The selected map has a heading, three finite area shares and a numeric colour legend.', async () => {
    await mainTab.select('#global-var', group.first);
    const status = await mainTab.evaluate(`({heading:document.querySelector('#t-global').textContent,scale:document.querySelector('#global-scale').textContent,shares:[...document.querySelectorAll('#global-summary b')].map(e=>parseFloat(e.textContent)),regions:document.querySelectorAll('#regions button').length})`);
    assert.match(status.heading, /where is it changing/); assert.match(status.scale, /full colour = [\d.,]+/);
    assert.equal(status.shares.length, 3); assert.ok(status.shares.every(n => Number.isFinite(n) && n >= 0 && n <= 100));
    assert.ok(Math.abs(status.shares.reduce((a, b) => a + b, 0) - 100) <= 2); assert.ok(status.regions > 0); return JSON.stringify(status);
  });
  await auditView(mainTab, 'global', ['#global-var', '#regions button:first-child', '#view-global a[href="#/home"]']);
  await step('Global region opens a bundled case', 'major', 'A region button opens visible evidence with a chart and region name, without POWER.', async () => {
    const before = metadata.power_requests_blocked; const label = await mainTab.text('#regions button strong');
    await mainTab.click('#regions button'); await mainTab.view('evidence'); await mainTab.waitVisible('#chart svg');
    assert.ok((await mainTab.text('#t2')).toLowerCase().includes(label.toLowerCase()), await mainTab.text('#t2')); assert.equal(metadata.power_requests_blocked, before); return await mainTab.text('#t2');
  });
  await step('Global Back returns home', 'major', 'Back on the global monitor returns home.', async () => { await mainTab.route('global'); await mainTab.click('#view-global a[href="#/home"]'); await mainTab.view('home'); return 'Home visible.'; });
}

async function moonTests() {
  await step('Earth to Moon switch', 'major', 'Moon panel and globe become visible; Earth globe hides and world buttons update.', async () => {
    await mainTab.click('#to-moon'); await mainTab.view('moon'); await mainTab.waitVisible('#moon-globe canvas');
    const world = await mainTab.evaluate(`({moon:document.querySelector('#to-moon').getAttribute('aria-pressed'),earth:document.querySelector('#to-earth').getAttribute('aria-pressed'),earthHidden:document.querySelector('#globe').hidden,moonHidden:document.querySelector('#moon-globe').hidden})`);
    assert.deepEqual(world, { moon: 'true', earth: 'false', earthHidden: true, moonHidden: false }); return JSON.stringify(world);
  });
  const layers = await mainTab.evaluate(`[...document.querySelectorAll('#moon-layers [data-layer]')].map(b=>({id:b.dataset.layer,text:b.textContent.trim()}))`);
  for (const layer of layers) await step(`Moon layer toggle: ${layer.text}`, 'major', 'The visible layer chip toggles its pressed state off/on and restores the original setting.', async () => {
    const selector = `#moon-layers [data-layer="${layer.id}"]`;
    const before = await mainTab.evaluate(`document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-pressed')`);
    await mainTab.click(selector); assert.notEqual(await mainTab.evaluate(`document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-pressed')`), before);
    await mainTab.click(selector); assert.equal(await mainTab.evaluate(`document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-pressed')`), before); return `Restored ${layer.id}=${before}`;
  });
  await auditView(mainTab, 'moon', ['#moon-cases button', '#moon-layers [data-layer="seas"]', '#back-earth']);
  await step('Moon map: attempt foreground feature picking', 'minor', 'Clicking a rendered lunar marker opens its feature popup with name and source.', async () => {
    await mainTab.route('moon'); await sleep(1000);
    const canvas = await mainTab.evaluate(`(()=>{const r=document.querySelector('#moon-globe canvas')?.getBoundingClientRect();return r&&{x:r.x,y:r.y,w:r.width,h:r.height}})()`); assert.ok(canvas);
    let picked = false, attempts = 0;
    // No private Cesium viewer or application closure is exposed. Try real unobscured globe points only.
    for (const [dx, dy] of [[0, 0], [-80, 0], [-160, 0], [80, 0], [0, -80], [0, 80], [-80, -80], [-80, 80], [80, -80], [80, 80], [-180, -70], [-180, 70]]) {
      const x = canvas.x + canvas.w / 2 + dx, y = canvas.y + canvas.h / 2 + dy;
      await mainTab.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await mainTab.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); attempts++;
      await sleep(60);
      if (await mainTab.visible('#place-pop')) { picked = true; break; }
    }
    assert.ok(picked, `NOT VERIFIED: ${attempts} real clicks did not hit a lunar marker under headless SwiftShader; no private picking state was injected.`);
    assert.ok((await mainTab.text('#pop-name')).length > 0); assert.match(await mainTab.text('#pop-credit'), /Wikipedia|IAU|USGS/); return `${await mainTab.text('#pop-name')} · ${await mainTab.text('#pop-credit')}`;
  });
  await step('Mobile Earth/Moon switch remains clickable', 'major', 'At 390x844 both switch buttons are uncovered; real clicks move Moon ? Earth ? Moon.', async () => {
    await mainTab.cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    try {
      const hits = await mainTab.evaluate(`['to-earth','to-moon'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id,uncovered:e===hit||e.contains(hit)}})`);
      assert.ok(hits.every(h => h.uncovered), JSON.stringify(hits));
      await mainTab.click('#to-earth'); await mainTab.view('home'); await mainTab.click('#to-moon'); await mainTab.view('moon');
      const shot = await screenshot('mobile-world-switch'); assert.ok(shot.path, shot.error); return JSON.stringify({hits,screenshot:shot.path});
    } finally { await mainTab.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 940, deviceScaleFactor: 1, mobile: false }); }
  });
  await step('Moon flat series: Kilimanjaro snow depth', 'major', 'Bundled constant snow depth shows Nothing to test here, explains no annual variation and leaves no result chart.', async () => {
    await mainTab.route('moon'); await mainTab.click('#moon-cases [data-case="glaciers"]'); await mainTab.view('lunar');
    await mainTab.select('#lunar-place', 'kilimanjaro'); await mainTab.select('#lunar-var', 'SNODP');
    const before = metadata.power_requests_blocked; await mainTab.click('#lunar-run');
    await until(async () => (await mainTab.text('#lunar-stat')) === 'Nothing to test here', 'flat-series explanation');
    assert.match(await mainTab.text('#lunar-note'), /does not vary from year to year/);
    assert.equal(await mainTab.evaluate(`document.querySelectorAll('#lunar-chart svg').length`), 0); assert.equal(metadata.power_requests_blocked, before);
    const shot = await screenshot('moon-flat-series'); assert.ok(shot.path, shot.error); return `${await mainTab.text('#lunar-stat')} ? ${await mainTab.text('#lunar-note')} ? screenshot=${shot.path}`;
  });
  const earthCases = await mainTab.evaluate(`[...document.querySelectorAll('#moon-cases [data-case]')].map(b=>({id:b.dataset.case,title:b.querySelector('strong').textContent}))`);
  for (const c of earthCases) {
    await step(`Moon–Earth case opens: ${c.id}`, 'major', 'The selected case has its own visible heading, introduction, and applicable controls or quiz.', async () => {
      await mainTab.route('moon'); await mainTab.click(`#moon-cases [data-case="${c.id}"]`); await mainTab.view('lunar');
      assert.equal(await mainTab.text('#t-lunar'), c.title.replace('★ ', '')); assert.ok((await mainTab.text('#lunar-intro')).length > 25); return await mainTab.text('#lunar-intro');
    });
    if (c.id === 'tides') {
      const stations = await mainTab.evaluate(`[...document.querySelectorAll('#lunar-place option')].map(o=>({id:o.value,title:o.textContent}))`);
      for (const station of stations) await step(`Moon tides: bundled run ${station.title}`, 'major', 'The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.', async () => {
        await mainTab.select('#lunar-place', station.id); const before = metadata.power_requests_blocked;
        await mainTab.click('#lunar-run'); await until(async () => /signal|hint/i.test(await mainTab.text('#lunar-stat')), 'tidal test result'); await mainTab.waitVisible('#lunar-chart svg');
        assert.match(await mainTab.text('#lunar-note'), /NOAA CO-OPS/); assert.equal(metadata.power_requests_blocked, before); return `${await mainTab.text('#lunar-stat')} · ${await mainTab.text('#lunar-note')}`;
      });
      await auditView(mainTab, 'lunar', ['#lunar-place', '#lunar-var', '#lunar-run', '#view-lunar a[href="#/moon"]']);
    } else if (['glaciers', 'rain'].includes(c.id)) await step(`Moon ${c.id}: bundled Coropuna run and guess`, 'major', 'A bundled glacier/climate test shows a chart, result, and guess feedback without any live POWER request.', async () => {
      await mainTab.select('#lunar-place', 'coropuna'); await mainTab.select('#lunar-var', 'T2M'); await mainTab.click('[data-lg="yes"]');
      const before = metadata.power_requests_blocked; await mainTab.click('#lunar-run');
      await until(async () => /signal|hint/i.test(await mainTab.text('#lunar-stat')), 'bundled lunar climate result');
      await mainTab.waitVisible('#lunar-chart svg'); assert.ok((await mainTab.text('#lunar-feedback')).length > 10); assert.equal(metadata.power_requests_blocked, before); return `${await mainTab.text('#lunar-stat')} · ${await mainTab.text('#lunar-feedback')}`;
    });
  }
  const quizzes = [{ id: 'tides', group: 'moon-cases', answer: 1 }, { id: 'corals', group: 'moon-cases', answer: 1 }, ...discovery.map(c => ({ id: c.id, group: 'moon-own', answer: c.quiz.answer }))];
  for (const quiz of quizzes) {
    await step(`Discovery quiz ${quiz.id}: right and repeated click`, 'major', 'The correct choice produces visible Right feedback; repeating the click awards nothing further.', async () => {
      await mainTab.route('moon'); await mainTab.click(`#${quiz.group} [data-case="${quiz.id}"]`); await mainTab.view('lunar');
      await mainTab.click(`#lunar-quiz [data-q="${quiz.answer}"]`); assert.ok(await mainTab.visible('#lunar-feedback.good')); assert.match(await mainTab.text('#lunar-feedback'), /Right/);
      const score = (await mainTab.score()).points; await mainTab.click(`#lunar-quiz [data-q="${quiz.answer}"]`); assert.equal((await mainTab.score()).points, score);
      assert.ok(await mainTab.visible('#lunar-feedback')); return await mainTab.text('#lunar-feedback');
    });
    await step(`Discovery quiz ${quiz.id}: wrong after reopening`, 'major', 'A wrong choice gives visible Not this time feedback and no points.', async () => {
      await mainTab.route('moon'); await mainTab.click(`#${quiz.group} [data-case="${quiz.id}"]`); await mainTab.view('lunar'); const before = (await mainTab.score()).points;
      await mainTab.click(`#lunar-quiz [data-q="${quiz.answer === 0 ? 1 : 0}"]`); assert.ok(await mainTab.visible('#lunar-feedback.miss')); assert.match(await mainTab.text('#lunar-feedback'), /Not this time/); assert.equal((await mainTab.score()).points, before); return await mainTab.text('#lunar-feedback');
    });
    await step(`Discovery quiz ${quiz.id}: right again after reopening`, 'major', 'The right answer may be reviewed but cannot score again in the same page session.', async () => {
      await mainTab.route('moon'); await mainTab.click(`#${quiz.group} [data-case="${quiz.id}"]`); await mainTab.view('lunar'); const before = (await mainTab.score()).points;
      await mainTab.click(`#lunar-quiz [data-q="${quiz.answer}"]`); assert.ok(await mainTab.visible('#lunar-feedback.good')); assert.equal((await mainTab.score()).points, before); return await mainTab.text('#lunar-feedback');
    });
  }
  await step('Lunar case Back → Moon and Moon → Earth', 'major', 'Back returns to Moon; Earth restores the home panel and Earth globe.', async () => {
    await mainTab.click('#view-lunar a[href="#/moon"]'); await mainTab.view('moon'); await mainTab.click('#to-earth'); await mainTab.view('home');
    assert.equal(await mainTab.evaluate(`document.querySelector('#to-earth').getAttribute('aria-pressed')`), 'true'); assert.equal(await mainTab.evaluate(`document.querySelector('#globe').hidden`), false); return 'Lunar → Moon → Earth/home.';
  });
  await step('Moon Back to Earth button', 'major', 'Back to Earth restores home and pressed Earth world switch.', async () => { await mainTab.click('#to-moon'); await mainTab.view('moon'); await mainTab.click('#back-earth'); await mainTab.view('home'); return 'Earth/home visible.'; });
}

async function scoreTests() {
  await step('Score farming: replay identical case twice', 'major', 'A second identical completed case does not re-award the same direction/verdict points.', async () => {
    const gains = [];
    for (let i = 0; i < 2; i++) { await openCase(mainTab); const before = (await mainTab.score()).points; await answerCase(mainTab, true); gains.push((await mainTab.score()).points - before); }
    metadata.replay_point_gains = gains;
    assert.equal(gains[1], 0, `Points can be farmed: first completion +${gains[0]}, identical replay +${gains[1]}; ${await mainTab.text('#score')}`); return `Point gains: ${gains}`;
  }, mainTab, 40000);
  await step('Score chip and rank persist after reload', 'major', 'Exact score/rank text survives a page reload and agrees with the public rank thresholds.', async () => {
    const before = await mainTab.score(); assert.ok(before.points > 0);
    const ranks = [[0, 'Rookie'], [5, 'Junior detective'], [12, 'Inspector'], [25, 'Chief inspector'], [45, 'Legendary detective']];
    assert.ok(before.text.includes(ranks.filter(([p]) => before.points >= p).at(-1)[1]));
    await mainTab.cdp.send('Page.reload'); await until(() => mainTab.evaluate("!!document.querySelector('#demo-list .demo-btn')"), 'app initialized after navigation', 30000); await until(() => mainTab.text('#score'), 'score after reload');
    assert.equal((await mainTab.score()).text, before.text); return before.text;
  }, mainTab, 40000);
}

async function classroomTests() {
  await mainTab.route('class');
  await auditView(mainTab, 'class', ['#host-btn', '#join-code', '#join-btn', '#view-class a[href="#/home"]']);
  let code, player1, player2;
  await step('Classroom: host session and QR', 'major', 'Hosting shows a four-character code, usable room link, QR/fallback, and empty leaderboard.', async () => {
    await mainTab.click('#host-btn'); await mainTab.view('host'); code = await mainTab.text('#host-code'); assert.match(code, /^[A-Z2-9]{4}$/);
    assert.ok((await mainTab.text('#host-url')).includes(`?room=${code}`)); assert.match(await mainTab.text('#host-count'), /0 detectives/);
    assert.ok(await mainTab.evaluate(`!!document.querySelector('#host-qr svg')||document.querySelector('#host-qr').textContent.includes('QR unavailable')`)); return `Code ${code}; ${await mainTab.text('#class-mode')}`;
  });
  if (!code) throw new Error('Host session prerequisite failed');
  await auditView(mainTab, 'host', ['#host-url', '#view-host a[href="#/class"]']);
  await step('Classroom: player 1 joins via ?room=CODE', 'major', 'First independent tab becomes Detective #1 and appears on the host board.', async () => {
    player1 = await newTab('player1', `${base}?room=${code}#/player`); await player1.view('player'); assert.equal(await player1.text('#player-id'), '#1');
    await mainTab.front(); await until(async () => /1 detective joined/.test(await mainTab.text('#host-count')), 'host player 1'); return `${await mainTab.text('#host-count')} · ${await mainTab.text('#host-board')}`;
  }, mainTab, 50000);
  await step('Classroom: wrong room code', 'major', 'A valid-looking nonexistent code reports an error visibly on the join screen.', async () => {
    player2 = await newTab('player2'); await player2.route('class'); await player2.fill('#join-code', code === 'ZZZZ' ? 'YYYY' : 'ZZZZ'); await player2.click('#join-btn');
    await until(async () => /no open session/i.test(await player2.text('#join-status')), 'wrong-code feedback'); await player2.view('class'); return await player2.text('#join-status');
  }, mainTab, 50000);
  await step('Classroom: rapid double Join creates exactly one player', 'major', 'Two consecutive native Join clicks create only Detective #2; the host has exactly two unique players.', async () => {
    assert.ok(player2); await player2.route('class'); await player2.fill('#join-code', code);
    const point = await player2.evaluate(`(()=>{const e=document.querySelector('#join-btn');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for (let i = 0; i < 2; i++) {
      await player2.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await player2.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    }
    await player2.view('player'); assert.equal(await player2.text('#player-id'), '#2');
    await mainTab.front(); await until(async () => /2 detectives joined/.test(await mainTab.text('#host-count')), 'host two players'); const board = await mainTab.text('#host-board'); assert.match(board, /Detective #1/); assert.match(board, /Detective #2/); return board;
  });
  if (!player1 || !player2) throw new Error('Two-player prerequisites failed');
  await auditView(player1, 'player', ['#player-next']);
  await step('Classroom: join twice reuses existing detective', 'major', 'Repeated Join in the same tab does not register another player or reset its identity.', async () => {
    await player1.route('class'); await player1.fill('#join-code', code); await player1.click('#join-btn'); await player1.view('player'); assert.equal(await player1.text('#player-id'), '#1');
    await player1.route('class'); await player1.click('#join-btn'); await player1.view('player');
    await mainTab.front(); assert.match(await mainTab.text('#host-count'), /^2 detectives/); return `${await mainTab.text('#host-count')}; player 1 reused.`;
  });
  await step('Classroom: player reload mid-mission preserves progress', 'major', 'Reload keeps detective identity, earned mission score and current case; returning to that case cannot duplicate its mission points.', async () => {
    await player1.click('#player-next'); await player1.view('evidence'); const t = await truth(player1); await player1.click(`[data-trend="${t.direction}"]`); await player1.waitVisible('#stat-row');
    await player1.cdp.send('Page.reload'); await until(() => player1.evaluate("!!document.querySelector('#demo-list .demo-btn')"), 'app initialized after navigation', 30000); await player1.view('player');
    assert.equal(await player1.evaluate('location.hash'), '#/player');
    assert.equal(await player1.text('#player-id'), '#1'); assert.match(await player1.text('#player-score'), /^1 pts/);
    assert.equal(await player1.evaluate(`document.querySelectorAll('#player-cases .done').length`), 0);
    await player1.click('#player-next'); await player1.view('evidence'); const replay = await truth(player1); await player1.click(`[data-trend="${replay.direction}"]`);
    await player1.route('player'); await until(async () => /^1 pts/.test(await player1.text('#player-score')), 'unchanged mission score after replay'); return `${await player1.text('#player-id')} · ${await player1.text('#player-score')}`;
  }, player1, 50000);
  for (const [tab, correct] of [[player1, true], [player2, false]]) {
    for (let i = 0; i < mission.length; i++) {
      await step(`Classroom ${tab.name}: mission case ${i + 1} answers`, 'major', 'Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.', async () => {
        await tab.route('player'); await tab.view('player'); const before = metadata.power_requests_blocked;
        assert.equal(await tab.evaluate(`document.querySelectorAll('#player-cases .done').length`), i);
        await tab.click('#player-next'); await tab.view('evidence'); await answerCase(tab, correct); await tab.waitVisible('#mission-next'); assert.equal(metadata.power_requests_blocked, before);
        return `${await tab.text('#trend-feedback')} · ${await tab.text('#verdict-feedback')} · ${await tab.text('#mission-bar')}`;
      }, tab, 35000);
      if (i === 0 && correct) await step('Classroom: replay both answers in the active mission case', 'major', 'Reopening the current mission case and answering direction and verdict again preserves the earned mission score and completion count.', async () => {
        await tab.route('player'); const before = await tab.text('#player-score');
        await tab.click('#player-next'); await tab.view('evidence'); await answerCase(tab, true);
        await tab.route('player'); assert.equal(await tab.text('#player-score'), before);
        assert.equal(await tab.evaluate(`document.querySelectorAll('#player-cases .done').length`), 0);
        await tab.click('#player-next'); await tab.view('evidence'); await answerCase(tab, true); await tab.waitVisible('#mission-next');
        const shot = await screenshot('mission-replay'); assert.ok(shot.path, shot.error); return `Mission score unchanged: ${before}; both answers replayed twice; screenshot=${shot.path}`;
      }, tab, 50000);
      await step(`Classroom ${tab.name}: Next case ${i + 1}`, 'major', 'Next case advances exactly one mission position and eventually shows Mission complete.', async () => {
        await tab.click('#mission-next'); await tab.view('player');
        assert.equal(await tab.evaluate(`document.querySelectorAll('#player-cases .done').length`), i + 1);
        if (i + 1 === mission.length) { assert.ok(await tab.visible('#player-finished')); assert.equal(await tab.visible('#player-next'), false); }
        return `${await tab.text('#player-score')} · completed ${i + 1}/${mission.length}`;
      }, tab);
    }
  }
  await step('Classroom: leaderboard order and live totals', 'major', 'Host has exactly two players, sorted by score/done/id; correct player outranks wrong-answer player.', async () => {
    await mainTab.front(); await until(async () => /5\/5 cases/.test(await mainTab.text('#host-board')), 'host final progress');
    const board = await mainTab.evaluate(`[...document.querySelectorAll('#host-board li')].map(li=>{const t=li.innerText;return {text:t,id:Number(t.match(/Detective #(\\d+)/)?.[1]),score:Number(t.match(/(\\d+) pts/)?.[1]),done:Number(t.match(/(\\d+)\\/5 cases/)?.[1])}})`);
    assert.equal(board.length, 2); assert.ok(board.every(p => Number.isFinite(p.score) && p.done === 5));
    assert.equal(board[0].id, 1); assert.ok(board[0].score > board[1].score); assert.deepEqual(board, [...board].sort((a, b) => b.score - a.score || b.done - a.done || a.id - b.id)); return JSON.stringify(board);
  });
  await step('Classroom host Back and class Back', 'major', 'Host Back opens classroom; classroom Back returns home.', async () => { await mainTab.click('#view-host a[href="#/class"]'); await mainTab.view('class'); await mainTab.click('#view-class a[href="#/home"]'); await mainTab.view('home'); return 'Host → class → home.'; });
  await player2.close(); await player1.close(); await mainTab.front();
}

async function suite(name, action) {
  try { await action(); }
  catch (error) {
    if (stopped) throw error;
    await step(`Suite ${name}: prerequisite/recovery failure`, 'blocker', 'All scenario prerequisites are available without fabricating application state.', async () => { throw error; });
    if (mainTab && !mainTab.closed) await mainTab.route('home').catch(() => {});
  }
}

process.on('SIGINT', () => { stopped = true; activeController?.abort(); });
process.on('SIGTERM', () => { stopped = true; activeController?.abort(); });
try {
  await step('Infrastructure and app bootstrap', 'blocker', 'Server answers; one Chrome opens; home and demo buttons are visible.', async () => { await setup(); await mainTab.view('home'); return await mainTab.text('#view-home'); }, null, 60000);
  if (!mainTab) throw new Error('Bootstrap did not produce an app tab');
  await step('Home: open case', 'major', 'Investigate a place opens the case form with catalog cards.', async () => { await mainTab.click('#view-home a[href="#/case"]'); await mainTab.view('case'); await mainTab.waitVisible('#place-cards .place'); return await mainTab.text('#page-info'); });
  catalog = await json(join(app, 'data/catalog.json'));
  const rivers = await json(join(app, 'data/rivers.json'));
  places = new Map([...rivers.places, ...catalog.places].map(p => [p.id, p]));
  mission = (await json(join(app, 'data/mission.json'))).cases;
  discovery = (await json(join(app, 'data/moon_cases.json'))).cases;
  const { analyze } = await import('../../engine.js');
  const bundle = (await json(join(app, 'data/place_series.json'))).places;
  const candidates = mission.filter(c => bundle[c.place]?.[c.variable]).map(c => ({ ...c, series: bundle[c.place][c.variable] }));
  unknownFixture = candidates.find(c => analyze(c.series).verdict === 'unknown' && analyze(c.series).slopePerDecade !== 0);
  if (!unknownFixture) outer: for (const [place, variables] of Object.entries(bundle)) {
    if (!places.has(place)) continue;
    for (const [variable, series] of Object.entries(variables)) {
      if (!catalog.variables.some(v => v.id === variable)) continue;
      const result = analyze(series);
      if (result.verdict === 'unknown' && result.slopePerDecade !== 0) { unknownFixture = { place, variable, series }; break outer; }
    }
  }
  assert.ok(unknownFixture, 'No bundled unknown-trend mission fixture');
  metadata.unknown_fixture = { place: unknownFixture.place, variable: unknownFixture.variable, result: analyze(unknownFixture.series).verdict };
  await suite('home and tours', homeAndTours);
  await suite('case picker', casePicker);
  await suite('evidence and verdict', evidenceAndVerdict);
  await suite('scan and global', scanAndGlobal);
  await suite('Moon cases', moonTests);
  await suite('score persistence and farming', scoreTests);
  await suite('classroom', classroomTests);
} catch (e) { metadata.fatal = e.message; }
finally { await cleanup().catch(e => { metadata.cleanup_error = e.message; }); await report(); }
process.exitCode = results.some(r => r.status === 'FAIL') || metadata.fatal ? 1 : 0;
