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
  const { getAuth, signInAnonymously } = await import(`${FIREBASE}firebase-auth.js`);
  const app = initializeApp(config), db = fs.getFirestore(app);
  // Anonymous sign-in: no names or emails, but each phone gets a private id so the rules (firestore.rules) only let it edit its own score.
  const uid = (await signInAnonymously(getAuth(app))).user.uid;
  return {
    shared: true,
    // Create only if absent: hosting must never reset an existing room (returns false on a code collision).
    async createRoom(code) {
      const ref = fs.doc(db, 'rooms', code);
      return fs.runTransaction(db, async (t) => {
        if ((await t.get(ref)).exists()) return false;
        t.set(ref, { created: Date.now(), next: 0, open: true, host: uid });
        return true;
      });
    },
    async join(code) {
      const ref = fs.doc(db, 'rooms', code);
      const id = await fs.runTransaction(db, async (t) => {
        const s = await t.get(ref);
        if (!s.exists() || !s.data().open) throw new Error('There is no open session with that code.');
        const n = s.data().next + 1;
        t.update(ref, { next: n });
        return n;
      });
      await fs.setDoc(fs.doc(db, 'rooms', code, 'players', String(id)), { id, uid, score: 0, done: 0, updated: Date.now() });
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
  // Tabs share one localStorage room: serialize read-modify-write with a Web Lock so two joins never get the same number.
  const locked = (code, fn) => (navigator.locks ? navigator.locks.request(key(code), fn) : fn());
  return {
    shared: false,
    async createRoom(code) {
      return locked(code, () => { if (read(code)) return false; write(code, { next: 0, open: true, players: {} }); return true; });
    },
    async join(code) {
      return locked(code, () => {
        const room = read(code);
        if (!room?.open) throw new Error('There is no open session with that code (local mode: the host must be open in this same browser).');
        const id = ++room.next;
        room.players[id] = { id, score: 0, done: 0, updated: Date.now() };
        write(code, room);
        return id;
      });
    },
    async report(code, id, score, done) {
      return locked(code, () => {
        const room = read(code);
        if (!room) throw new Error('This session no longer exists.');
        room.players[id] = { id, score, done, updated: Date.now() };
        write(code, room);
      });
    },
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

  // Phones cannot reach localhost: when the host runs locally, the QR points to the public site (publicUrl in data/classroom.json).
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const base = local && backend.shared && cfg?.publicUrl ? cfg.publicUrl.replace(/\/?$/, '/') : `${location.origin}${location.pathname}`;
  const joinUrl = (code) => `${base}?room=${code}#/player`;
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
    let code = null;
    for (let tries = 0; tries < 6 && !code; tries++) { const c = newCode(); if (await backend.createRoom(c)) code = c; }
    if (!code) { $('class-mode').textContent = 'Could not create a session code. Please try again.'; return; }
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

  let joining = false;
  async function join(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{4}$/.test(code)) { $('join-status').textContent = 'The code has 4 letters or numbers.'; location.hash = '#/class'; return; }
    if (me?.code === code) { location.hash = '#/player'; return; } // already in this room: reconnect, never a second detective
    if (joining) return;
    joining = true; $('join-btn').disabled = true;
    try {
      $('join-status').textContent = 'Joining…';
      const id = await backend.join(code);
      me = { code, id, score: 0, done: 0, answered: [], unsynced: false };
      store('sn-me', me);
      $('join-status').textContent = '';
      location.hash = '#/player';
    } catch (err) {
      $('join-status').textContent = err.message;
      location.hash = '#/class'; // show the error where the player can see it and try again
    } finally { joining = false; $('join-btn').disabled = false; }
  }

  // Progress is saved locally first; until the backend confirms it, the player sees it is not synced and it is retried.
  async function sync() {
    if (!me) return;
    try { await backend.report(me.code, me.id, me.score, me.done); me.unsynced = false; }
    catch (err) { me.unsynced = true; console.warn('report failed', err); }
    store('sn-me', me);
    if (location.hash === '#/player') renderPlayer();
  }

  function renderPlayer() {
    if (!me) return;
    $('player-id').textContent = `#${me.id}`;
    $('player-score').textContent = `${me.score} pts · session ${me.code}${me.unsynced ? ' · not synced yet, retrying…' : ''}`;
    if (me.unsynced) setTimeout(sync, 3000);
    $('player-cases').innerHTML = mission.map((c, i) => `<li class="${i < me.done ? 'done' : ''}">${i < me.done ? '✓' : i === me.done ? '▶' : '·'} Case ${i + 1}</li>`).join('');
    $('player-next').hidden = me.done >= mission.length;
    $('player-finished').hidden = me.done < mission.length;
    showBar();
  }
  function showBar() {
    const playing = !!me && location.hash !== '#/player' && me.done < mission.length && inCase;
    $('mission-bar').hidden = !playing;
    if (playing) $('mission-bar').textContent = `Mission · case ${me.done + 1} of ${mission.length} · Detective #${me.id} · ${me.score} pts · ↩ mission`;
    $('mission-next').hidden = !playing;
  }
  let inCase = false;
  function startNext() {
    if (!me || me.done >= mission.length) return;
    inCase = true;
    openCase({ ...mission[me.done], key: `mission:${me.done}` });
    showBar();
  }
  async function finishCase() {
    if (!me || !inCase) return;
    inCase = false;
    me.done += 1;
    store('sn-me', me);
    location.hash = '#/player';
    await sync();
  }

  $('host-btn').addEventListener('click', host);
  $('join-btn').addEventListener('click', () => join($('join-code').value));
  $('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join($('join-code').value); });
  $('player-next').addEventListener('click', startNext);
  $('mission-next').addEventListener('click', finishCase);
  $('mission-bar').addEventListener('click', () => { location.hash = '#/player'; });
  addEventListener('hashchange', showBar);

  // Arriving from the QR code: ?room=CODE joins right away (once per tab).
  const fromQr = new URLSearchParams(location.search).get('room');
  if (fromQr && (!me || me.code !== fromQr.toUpperCase())) join(fromQr);
  // A player who reloads mid-mission goes back to the mission screen instead of a stranded case.
  else if (me && me.done < mission.length && !['#/host', '#/class'].includes(location.hash)) location.hash = '#/player';

  return {
    // Only answers that belong to the active mission case count, and each answer counts once (also after a reload).
    addPoints(points, key) {
      if (!me || !inCase || !points || !key?.startsWith(`mission:${me.done}:`)) return;
      me.answered ??= [];
      if (me.answered.includes(key)) return;
      me.answered.push(key);
      me.score += points;
      store('sn-me', me);
      sync();
      showBar();
    },
    renderPlayer,
    get active() { return !!me; },
  };
}
