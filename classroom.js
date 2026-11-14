// Classroom mode: a host opens a session (code + QR), students join anonymously as numbered detectives,
// play the same 5-case mission and appear on a live leaderboard. No names, no accounts, no personal data.
//
// Backend: Firebase Firestore when data/classroom.json holds a web config; otherwise a local backend that works
// between tabs of the same browser (for testing and single-screen demos).

const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I: easy to read aloud

async function firebaseBackend(config) {
  const { initializeApp } = await import(`${FIREBASE}firebase-app.js`);
  const fs = await import(`${FIREBASE}firebase-firestore.js`);
  const db = fs.getFirestore(initializeApp(config));
  return {
    shared: true,
    async createRoom(code) { await fs.setDoc(fs.doc(db, 'rooms', code), { created: Date.now(), next: 0, open: true }); },
    async join(code) {
      const ref = fs.doc(db, 'rooms', code);
      const id = await fs.runTransaction(db, async (t) => {
        const s = await t.get(ref);
        if (!s.exists() || !s.data().open) throw new Error('There is no open session with that code.');
        const n = s.data().next + 1;
        t.update(ref, { next: n });
        return n;
      });
      await fs.setDoc(fs.doc(db, 'rooms', code, 'players', String(id)), { id, score: 0, done: 0, updated: Date.now() });
      return id;
    },
    async report(code, id, score, done) { await fs.updateDoc(fs.doc(db, 'rooms', code, 'players', String(id)), { score, done, updated: Date.now() }); },
    watch(code, cb) { return fs.onSnapshot(fs.collection(db, 'rooms', code, 'players'), (q) => cb(q.docs.map((d) => d.data()))); },
  };
}

function localBackend() {
  const key = (code) => `sn-room-${code}`;
  const read = (code) => { try { return JSON.parse(localStorage.getItem(key(code))); } catch { return null; } };
  const write = (code, room) => { localStorage.setItem(key(code), JSON.stringify(room)); new BroadcastChannel(key(code)).postMessage('changed'); };
  return {
    shared: false,
    async createRoom(code) { write(code, { next: 0, open: true, players: {} }); },
    async join(code) {
      const room = read(code);
      if (!room?.open) throw new Error('There is no open session with that code (local mode: open the host in this same browser).');
      const id = ++room.next;
      room.players[id] = { id, score: 0, done: 0, updated: Date.now() };
      write(code, room);
      return id;
    },
    async report(code, id, score, done) { const room = read(code); if (!room) return; room.players[id] = { id, score, done, updated: Date.now() }; write(code, room); },
    watch(code, cb) {
      const push = () => cb(Object.values(read(code)?.players ?? {}));
      const ch = new BroadcastChannel(key(code));
      ch.onmessage = push;
      addEventListener('storage', push);
      push();
      return () => { ch.close(); removeEventListener('storage', push); };
    },
  };
}

export async function createClassroom({ $, esc, openCase, loadJson }) {
  const cfg = await loadJson('data/classroom.json');
  let backend;
  try { backend = cfg?.firebase ? await firebaseBackend(cfg.firebase) : localBackend(); } catch (err) { console.warn('Classroom backend unavailable, using local mode:', err); backend = localBackend(); }
  const mission = (await loadJson('data/mission.json'))?.cases ?? [];
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k)); sessionStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };
  let me = store('sn-me'); // { code, id, score, done }
  let unwatch = null;

  const joinUrl = (code) => `${location.origin}${location.pathname}?room=${code}#/player`;
  const newCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  $('class-mode').textContent = backend.shared
    ? 'Live mode: everyone joins from their own phone.'
    : 'Local mode (no server configured): host and players must use tabs of this same browser.';

  function renderBoard(players) {
    const top = [...players].sort((a, b) => b.score - a.score || b.done - a.done || a.id - b.id);
    $('host-count').textContent = `${players.length} detective${players.length === 1 ? '' : 's'} joined`;
    $('host-board').innerHTML = top.slice(0, 10).map((p, i) => `<li><span><b>${i + 1}.</b> Detective #${p.id}</span><span>${p.score} pts · ${p.done}/${mission.length} cases</span></li>`).join('')
      || '<li class="note">Waiting for detectives… scan the QR code to join.</li>';
  }

  async function host() {
    const code = newCode();
    await backend.createRoom(code);
    $('host-code').textContent = code;
    $('host-url').textContent = joinUrl(code);
    $('host-url').href = joinUrl(code);
    try {
      const qr = window.qrcode(0, 'M'); qr.addData(joinUrl(code)); qr.make();
      $('host-qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch { $('host-qr').textContent = 'QR unavailable: share the link below.'; }
    unwatch?.();
    unwatch = backend.watch(code, renderBoard);
    location.hash = '#/host';
  }

  async function join(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{4}$/.test(code)) { $('join-status').textContent = 'The code has 4 letters or numbers.'; return; }
    try {
      $('join-status').textContent = 'Joining…';
      const id = await backend.join(code);
      me = { code, id, score: 0, done: 0 };
      store('sn-me', me);
      $('join-status').textContent = '';
      location.hash = '#/player';
    } catch (err) { $('join-status').textContent = err.message; }
  }

  function renderPlayer() {
    if (!me) return;
    $('player-id').textContent = `#${me.id}`;
    $('player-score').textContent = `${me.score} pts · session ${me.code}`;
    $('player-cases').innerHTML = mission.map((c, i) => `<li class="${i < me.done ? 'done' : ''}">${i < me.done ? '✓' : i === me.done ? '▶' : '·'} Case ${i + 1}</li>`).join('');
    $('player-next').hidden = me.done >= mission.length;
    $('player-finished').hidden = me.done < mission.length;
    showBar();
  }
  function showBar() {
    const playing = !!me && location.hash !== '#/player' && me.done < mission.length && inCase;
    $('mission-bar').hidden = !playing;
    if (playing) $('mission-bar').textContent = `Mission · case ${me.done + 1} of ${mission.length} · Detective #${me.id} · ${me.score} pts`;
    $('mission-next').hidden = !playing;
  }
  let inCase = false;
  function startNext() {
    if (!me || me.done >= mission.length) return;
    inCase = true;
    openCase(mission[me.done]);
    showBar();
  }
  async function finishCase() {
    if (!me || !inCase) return;
    inCase = false;
    me.done += 1;
    store('sn-me', me);
    await backend.report(me.code, me.id, me.score, me.done).catch((err) => console.warn('report failed', err));
    location.hash = '#/player';
  }

  $('host-btn').addEventListener('click', host);
  $('join-btn').addEventListener('click', () => join($('join-code').value));
  $('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join($('join-code').value); });
  $('player-next').addEventListener('click', startNext);
  $('mission-next').addEventListener('click', finishCase);
  addEventListener('hashchange', showBar);

  // Arriving from the QR code: ?room=CODE joins right away (once per tab).
  const fromQr = new URLSearchParams(location.search).get('room');
  if (fromQr && (!me || me.code !== fromQr.toUpperCase())) join(fromQr);

  return {
    addPoints(points) {
      if (!me || !inCase || !points) return;
      me.score += points;
      store('sn-me', me);
      backend.report(me.code, me.id, me.score, me.done).catch(() => {});
      showBar();
    },
    renderPlayer,
    get active() { return !!me; },
  };
}
