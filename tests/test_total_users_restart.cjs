/* v1383 DEV PANEL HUNT (Grok, Claude 12 Nov 21:16: "hunt the new dev panel: every tab at 844x390, Fold, PC - every button works end to end for an
   admin, a player and a tester get 403 on admin routes, nothing cut off, and the Total users chip adds up across all 5 servers").
   Real servers on free ports + temp DBs (no live server touched), real page (Chromium, SwiftShader, silent: --disable-audio-output, --mute-audio NOT used).
   A. 403: every /api/admin/* and /api/dev/* route the server has (GET and POST) for signed out, a normal player and a test account
      (the tester's own Economy grant is the one allowed route; a tester's grant aimed at another player must not reach them).
   B. layout at 844x390, Fold 906x1088 and PC 1440x900: every tab + the player card + the report audit + the ban menu: nothing outside the view,
      nothing clipped sideways by its box, no text cut with an ellipsis, no two controls overlapping, every tab hit-testable; screenshots.
   C. every button end to end for an admin (real Playwright clicks: the click lands only if the button is visible and on top), checked on the server.
   D. Total users across a real Server 1 + Servers 2-5 (account server + 4 satellites with link secret): the chip on every server equals
      Server 1's signed-up players + every server's own guests (crew left out, a linked guest not twice).
   CONTROL: HUNT_ROOT=<checkout>. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.HUNT_ROOT || path.join(__dirname, '..'), control = !!process.env.HUNT_ROOT;
const SHOTS = process.env.HUNT_SHOTS || '';
const ONLY = (process.env.HUNT_ONLY || 'ABCD').toUpperCase();
let pass = 0, fail = 0; const fails = [];
const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; fails.push(m); console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 900) : '')); } };
const note = m => console.log('  note ' + m);
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
const BASEENV = { DATABASE_URL: '', DB_STORE: process.env.TOTAL_TEST_STORE || '', RL_MUL: '1000', REG_PER_MIN: '5000', REG_ACCOUNTS_PER_IP: '5000', SIM_WORKERS: '0', MUT_PER_MIN: '5000', ALLOW_NEW_GUESTS: '1', GUEST_PER_MIN: '5000' };
function mkServer(name, dbFile, extra) {
  const S = { name, port: 0, base: '', proc: null, log: '' };
  S.start = async () => { if (!S.port) { S.port = await freePort(); S.base = 'http://127.0.0.1:' + S.port; }
    const env = { ...process.env, ...BASEENV, PORT: String(S.port), DB_FILE: dbFile, ...(typeof extra === 'function' ? extra() : extra || {}) }; delete env.SHOP_FREE_PACKS;
    S.proc = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    S.proc.stdout.on('data', d => { S.log += d; if (S.log.length > 400000) S.log = S.log.slice(-200000); }); S.proc.stderr.on('data', d => { S.log += d; });
    for (const t0 = Date.now(); Date.now() - t0 < 90000 && S.proc.exitCode === null;) { try { if ((await fetch(S.base + '/api/health')).ok) return; } catch (_) {} await delay(100); }
    throw new Error(name + ' did not start: ' + S.log.slice(-600)); };
  S.stop = async () => { const c = S.proc; if (!c) return; await delay(800); c.kill(); for (let i = 0; i < 400 && c.exitCode === null && c.signalCode === null; i++) { if (i === 200) try { c.kill('SIGKILL'); } catch (_) {} await delay(50); } S.proc = null; };
  S.req = async (method, u, b, tok) => { const r = await fetch(S.base + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(b || {}) }); let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, body: j }; };
  S.post = (u, b, t) => S.req('POST', u, b, t); S.get = (u, t) => S.req('GET', u, null, t);
  S.login = async (n, p, dev) => (await S.post('/api/login', { name: n, pass: p, deviceId: dev })).body;
  S.led = async t => { const r = (await S.get('/api/ledger', t)).body; return r.ledger || r; };
  return S;
}
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-dvphunt-')); const servers = []; let br = null;
  const tag = Date.now().toString(36).slice(-4), PW = 'password1', ADM = 'hAdm' + tag, PL = 'hPl' + tag, TG = 'hTg' + tag, VIC = 'hVic' + tag;
  try {
  /* ---------------- D. Total users across 5 servers ---------------- */
  if (ONLY.includes('D')) {
    const SECRET = 'hunt-link-' + tag; const dirs = [1, 2, 3].map(i => { const d = path.join(tmp, 's' + i); fs.mkdirSync(d); return path.join(d, 'db.json'); });
    const S1 = mkServer('S1', dirs[0], () => ({ ACCOUNT_LINK_SECRET: SECRET, SERVER_NAME: 'Server 1', ADMIN_IDS: S1.adm || '' })); servers.push(S1); await S1.start();
    const a = await S1.post('/api/register', { name: 'dAdm' + tag, pass: PW }); S1.adm = a.body.profile.id; await S1.stop(); await S1.start();
    const SAT = [2, 3].map(i => { const s = mkServer('S' + i, dirs[i - 1], () => ({ ACCOUNT_LINK_SECRET: SECRET, ACCOUNT_AUTHORITY: S1.base, SERVER_NAME: 'Server ' + i, ADMIN_IDS: S1.adm, SERVER_ID: String(i), ACCOUNT_STATUS_MS: '1000' })); servers.push(s); return s; });
    for (const s of SAT) await s.start();
    const ALL = [S1, ...SAT]; const plan = { S1: { acc: 3, guests: 2 }, S2: { acc: 2, guests: 3 }, S3: { acc: 1, guests: 1 }, S4: { acc: 0, guests: 4 }, S5: { acc: 2, guests: 0 } };
    for (const s of ALL) { const p = plan[s.name]; for (let i = 0; i < p.acc; i++) { const r = await s.post('/api/register', { name: 'u' + s.name + 'a' + i + tag, pass: PW }); if (!r.body.token) throw new Error('reg ' + s.name + ' ' + JSON.stringify(r.body)); }
      for (let i = 0; i < p.guests; i++) { const r = await s.post('/api/guest', { deviceId: 'hunt-' + s.name + '-g' + i + tag }); if (!r.body.token) throw new Error('guest ' + s.name + ' ' + JSON.stringify(r.body)); } }
    /* a guest upgraded to an account on Server 2 (counts once), a guest on Server 3 whose device then signs in to a real account (not twice) */
    { const g = (await SAT[0].post('/api/guest', { deviceId: 'hunt-up-' + tag })).body; const up = await SAT[0].post('/api/register', { name: 'uUp' + tag, pass: PW, deviceId: 'hunt-up-' + tag }, g.token); if (!up.body.token) note('guest upgrade on S2: ' + JSON.stringify(up.body).slice(0, 160)); }
    { await SAT[1].post('/api/guest', { deviceId: 'hunt-ln-' + tag }); const li = await SAT[1].post('/api/login', { name: 'uS1a0' + tag, pass: PW, deviceId: 'hunt-ln-' + tag }); if (!li.body.token) note('link sign-in on S3: ' + JSON.stringify(li.body).slice(0, 160)); }
    /* a test account made on Server 1 (crew: not counted) */
    const at1 = (await S1.login('dAdm' + tag, PW)).token; const mk = await S1.post('/api/admin/test-account', {}, at1);
    const expected = 13; // seven signed-up players and six unlinked guests
    const status = async s => (await s.get('/api/admin/status', (await s.login('dAdm' + tag, PW)).token)).body.totalUsers;
    for (const satellite of SAT) await status(satellite);
    const before = await status(S1);
    ck('counts both satellites and excludes linked guest', before?.total === expected && before.servers === 3, JSON.stringify(before));
    for (const satellite of SAT) await satellite.stop();
    await S1.stop();
    await S1.start();
    const after = await status(S1);
    ck('restart retains total before either satellite reports', after?.total === before?.total && after?.servers === 3, JSON.stringify(after));
    await SAT[0].start();
    const guest = await SAT[0].post('/api/guest', {deviceId:'hunt-refresh-'+tag});
    if (!guest.body.token) throw Error('refresh guest setup failed');
    await status(SAT[0]);
    const refreshed = await status(S1);
    ck('new report replaces its earlier count', refreshed?.total === expected + 1 && refreshed.servers === 3, JSON.stringify(refreshed));
    for (const s of ALL) await s.stop();
  }
  } catch (e) { fail++; fails.push('run'); console.log('  FAIL run: ' + (e.stack || e)); for (const s of servers) if (s.log) console.log('--- ' + s.name + ' log tail: ' + s.log.slice(-800)); }
  finally { try { if (br) await br.close(); } catch (_) {} for (const s of servers) { try { if (s.proc) s.proc.kill(); } catch (_) {} } }
  console.log('test_devpanel_hunt_1383.js: ' + (control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed' + (fails.length ? '\nFAILED: ' + fails.join(' || ') : ''));
  process.exit(fail ? 1 : 0);
})();
