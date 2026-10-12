// v1130 - new players go to the next server (Phil 12 Oct 2026: "auto open server 2 at 1500 players and start making new downloads
// join there. Players still have the option to join server 1 if they switch using server list after they are sent to server 2").
// A: the placement rules (server/front-door.js pick + createDecider), each with a control.
// B: real servers - two game servers + a stale peer + a dead address, FRONT_THRESHOLD=2 / FRONT_RELEASE=1, accounts linked (S2 -> S1).
// C: the real page in Chromium on https://emberweaveheroes.com (requests routed to the local servers): a fresh install is placed,
//    an existing device is not, and the server list still lets a player pick a busy Server 1.
// Asserts (non-zero exit). Control for the whole file: AUD_SERVER=<main's server.js copied into the repo root> must FAIL B.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), http = require('http');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..'), srvFile = process.env.AUD_SERVER || 'server.js';
const FD = require('../server/front-door.js');
let pass = 0; const missed = [];
const ok = (c, m) => { if (process.env.AUD_SERVER && !c) { missed.push(m); console.log('  x ' + m); return; } assert(c, m); pass++; console.log('  ok ' + m); };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

function partA() {
  console.log('A. placement rules');
  const L = FD.parseServers('1|a,2|b,3|c', 1500, 1300), now = 1e6;
  const st = o => new Map(Object.entries(o).map(([k, v]) => [k, v === null ? { ok: false, gotAt: now } : { ok: true, active: v, ageMs: 0, gotAt: now }]));
  ok(L.length === 3 && L[0].threshold === 1500 && L[0].release === 1300, 'list parsed in order with threshold 1500 / release 1300');
  let full = {};
  ok(FD.pick(L, st({ 1: 1499, 2: 0, 3: 0 }), full, now).server === '1', 'below the threshold (1,499) a new player goes to S1');
  full = {};
  ok(FD.pick(L, st({ 1: 1500, 2: 0, 3: 0 }), full, now).server === '2', 'at the threshold (1,500) a new player goes to S2');
  // hysteresis: S1 stays full until it drops below 1,300
  ok(FD.pick(L, st({ 1: 1400, 2: 10, 3: 0 }), full, now).server === '2', 'hysteresis: S1 back down to 1,400 - still S2');
  ok(FD.pick(L, st({ 1: 1300, 2: 10, 3: 0 }), full, now).server === '2', 'hysteresis: S1 at 1,300 - still S2');
  ok(FD.pick(L, st({ 1: 1299, 2: 10, 3: 0 }), full, now).server === '1', 'hysteresis: S1 below 1,300 (1,299) - back to S1');
  ok(FD.pick(L, st({ 1: 1400, 2: 10, 3: 0 }), {}, now).server === '1', 'CONTROL: without the held state 1,400 would go to S1 (the state is what holds it)');
  full = {};
  ok(FD.pick(L, st({ 1: 1600, 2: 1500, 3: 4 }), full, now).server === '3', 'not hardcoded to 2: S1 and S2 at their thresholds - S3');
  full = {};
  const r = FD.pick(L, st({ 1: 1800, 2: 1500, 3: 2000 }), full, now);
  ok(r.server === '2' && r.rows.every(x => x.state === 'busy'), 'every server busy - the least loaded (S2 1500/1500) and nothing blocked');
  full = {};
  ok(FD.pick(L, st({ 1: null, 2: 0, 3: 0 }), full, now).server === '2', 'S1 down (refused) - S2');
  ok(FD.pick(L, st({ 1: 0, 2: 0, 3: 0 }), {}, now).server === '1', 'CONTROL: S1 up - S1');
  const stale = new Map([['1', { ok: true, active: 5, ageMs: 0, gotAt: now - 20000 }], ['2', { ok: true, active: 0, ageMs: 0, gotAt: now }]]);
  ok(FD.pick(L, stale, {}, now, 10000).server === '2', 'a stale count (read 20 s ago) is unknown - skipped to S2');
  const stale2 = new Map([['1', { ok: true, active: 5, ageMs: 60000, gotAt: now }], ['2', { ok: true, active: 0, ageMs: 0, gotAt: now }]]);
  ok(FD.pick(L, stale2, {}, now, 10000).server === '2', 'a count the server itself says is 60 s old is unknown - skipped to S2');
  const fresh = new Map([['1', { ok: true, active: 5, ageMs: 0, gotAt: now - 2000 }], ['2', { ok: true, active: 0, ageMs: 0, gotAt: now }]]);
  ok(FD.pick(L, fresh, {}, now, 10000).server === '1', 'CONTROL: the same count read 2 s ago is trusted - S1');
  const miss = new Map([['1', { ok: true, active: undefined, gotAt: now }], ['2', { ok: true, active: 0, ageMs: 0, gotAt: now }]]);
  ok(FD.pick(L, miss, {}, now).server === '2', 'a missing count is unknown - skipped to S2');
  ok(FD.pick(L, new Map(), {}, now).server === null, 'nothing known at all - no placement (the client keeps Server 1 and the net gate)');
  // the poller: a peer whose status stops answering becomes unknown; hysteresis held across polls
  return (async () => {
    let t = 1e6; const counts = { 2: 0, 3: 0 }; let s1 = 0, s2up = true;
    const fakeFetch = async (u) => { const id = u.match(/\/\/s(\d)/)[1];
      if (id === '2' && !s2up) throw new Error('down');
      return { ok: true, json: async () => ({ ok: true, id, active: counts[id], ageMs: 0 }) }; };
    const d = FD.createDecider({ servers: FD.parseServers('1|http://s1,2|http://s2,3|http://s3', 1500, 1300), selfId: '1',
      selfCount: () => ({ active: s1, ageMs: 0 }), fetch: fakeFetch, now: () => t, staleMs: 10000 });
    await d.poll(); ok(d.decide().server === '1', 'decider: S1 (self) at 0 - S1');
    s1 = 1500; await d.poll(); ok(d.decide().server === '2', 'decider: S1 reaches 1,500 - S2');
    s1 = 1350; t += 3000; await d.poll(); ok(d.decide().server === '2', 'decider: S1 at 1,350 on the next poll - still S2');
    s2up = false; t += 3000; await d.poll(); ok(d.decide().server === '3', 'decider: S2 stops answering - S3 (S1 still held full)');
    s1 = 1200; t += 3000; await d.poll(); ok(d.decide().server === '1', 'decider: S1 drops to 1,200 - back to S1');
  })();
}

function startSrv(port, dbDir, extra) {
  const env = { ...process.env, DATABASE_URL: '', PORT: String(port), DB_FILE: path.join(dbDir, 'db.json'), SIM_WORKERS: '0', NODE_ENV: '',
    REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', FRONT_THRESHOLD: '2', FRONT_RELEASE: '1', FRONT_POLL_MS: '200', FRONT_COUNT_MS: '250',
    FRONT_STALE_MS: '1500', ACCOUNT_LINK_SECRET: 'test-link-secret-1130', ...extra };
  delete env.CLOCK_FILE;
  const child = spawn(process.execPath, [srvFile], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  child.stderr.on('data', d => { if (process.env.FD_DEBUG) process.stderr.write('[' + port + '] ' + d); });
  return child;
}
async function up(port) { for (let i = 0; i < 300; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/api/health')).ok) return true; } catch (_) {} await delay(100); } return false; }
const J = async (port, p, opt) => { try { const r = await fetch('http://127.0.0.1:' + port + p, opt); let j = null; try { j = await r.json(); } catch (_) {} return { status: r.status, j: j || {} }; } catch (e) { return { status: 0, j: {} }; } };
const post = (port, p, b, tok) => J(port, p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: JSON.stringify(b || {}) });
const assign = async port => (await J(port, '/api/front/assign')).j;

async function partB(ctx) {
  console.log('B. real servers');
  const [p1, p2, pDead, pFake] = [await freePort(), await freePort(), await freePort(), await freePort()];
  let fakeAge = 999999;   // the stale peer: answers, but with a count it says is ~17 minutes old
  const fake = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, id: '9', active: 0, ageMs: fakeAge })); });
  await new Promise(r => fake.listen(pFake, '127.0.0.1', r)); ctx.fake = fake;
  const list = ['9|http://127.0.0.1:' + pFake, '1|http://127.0.0.1:' + p1, '2|http://127.0.0.1:' + p2, '3|http://127.0.0.1:' + pDead].join(',');
  const d1 = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-fd1130-s1-')), d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-fd1130-s2-'));
  const s1env = { SERVER_ID: '1', FRONT_SERVERS: list }, s2env = { SERVER_ID: '2', FRONT_SERVERS: list, ACCOUNT_AUTHORITY: 'http://127.0.0.1:' + p1 };
  ctx.s1 = startSrv(p1, d1, s1env); ctx.s2 = startSrv(p2, d2, s2env);
  ok(await up(p1) && await up(p2), 'two game servers up');
  Object.assign(ctx, { p1, p2 });
  await delay(700);
  let st = (await J(p1, '/api/front/status')).j;
  ok(st.ok === true && st.id === '1' && st.active === 0 && st.ageMs >= 0 && st.ageMs <= 1500, 'S1 /api/front/status: id 1, 0 active, a fresh count (' + JSON.stringify(st) + ')');
  let a = await assign(p1);
  ok(a.server === 1, 'S1 below its threshold (0/2): a new player goes to S1 (got ' + a.server + ')');
  const row = id => (a.rows || []).find(x => x.id === id) || {};
  ok(row(9).state === 'unknown' && row(3).state === 'unknown', 'the stale peer (S9, listed first) and the dead address (S3) are unknown, not open');
  fakeAge = 0; await delay(600); a = await assign(p1);
  ok(a.server === 9, 'CONTROL: the same peer with a fresh count would take the player (S9 open, listed first)');
  fakeAge = 999999; await delay(600);
  ok((await assign(p1)).server === 1, 'stale again - skipped (S1)');
  ok((await assign(p2)).server === 1, 'S2 answers the same placement (S1)');

  // one box down: Server 1 off -> S2 decides S2
  ctx.s1.kill(); await delay(1200);
  a = await assign(p2);
  ok(a.server === 2, 'S1 down: S2 places new players on S2 (got ' + a.server + ', S1 ' + JSON.stringify(row(1)) + ')');
  ctx.s1 = startSrv(p1, d1, s1env); ok(await up(p1), 'S1 back up'); await delay(700);
  ok((await assign(p2)).server === 1, 'S1 back: new players go to S1 again');

  // an existing account on S1, then S1 reaches its threshold (2 active)
  const vet = await post(p1, '/api/register', { name: 'vet1130', pass: 'password1130', deviceId: 'dev-vet' });
  ok(!!(vet.j && vet.j.token), 'an existing player registers on S1');
  const vp = await J(p1, '/api/profile', { headers: { 'x-token': vet.j.token } });
  const vetId = vp.j && vp.j.profile && vp.j.profile.id;
  await delay(600);
  ok((await assign(p1)).server === 1, 'CONTROL: 1 active on S1 - still S1');
  const g = await post(p1, '/api/guest', { deviceId: 'dev-guest-a' }); await J(p1, '/api/profile', { headers: { 'x-token': g.j.token } });
  await delay(700);
  st = (await J(p1, '/api/front/status')).j; a = await assign(p1);
  ok(st.active === 2 && a.server === 2, 'S1 at its threshold (2 active): a new player goes to S2 (active ' + st.active + ', got ' + a.server + ')');
  ok((await assign(p2)).server === 2, 'S2 answers S2 too');
  ok(row(1).state === 'busy' && row(1).active === 2 && row(1).threshold === 2, 'the list rows mark S1 busy with its load (2/2)');
  // never blocked: a player who picks Server 1 from the list can still join it
  const g2 = await post(p1, '/api/guest', { deviceId: 'dev-guest-b' });
  ok(g2.status === 200 && !!g2.j.token, 'S1 busy but a player who picks S1 still gets in (guest 200)');
  const r2 = await post(p1, '/api/register', { name: 'picks1', pass: 'password1130', deviceId: 'dev-picks1' });
  ok(r2.status === 200 && !!r2.j.token, 'S1 busy: a new account made on S1 is accepted');
  // existing accounts never move
  const vp2 = await J(p1, '/api/profile', { headers: { 'x-token': vet.j.token } });
  ok(vp2.status === 200 && vp2.j.profile && vp2.j.profile.id === vetId, 'after the switch the existing S1 account is unchanged on S1 (same id, same session)');
  const t0 = Date.now();
  const placed = await post(p2, '/api/login', { name: 'vet1130', pass: 'password1130', deviceId: 'dev-new-phone', auto: 2 });
  ok(placed.status === 409 && placed.j.homeServer === 1 && !placed.j.token, 'a placed device signing in on S2 with the S1 account: told it plays on S1, no S2 player made (' + placed.status + ')');
  await delay(50);
  const chosen = await post(p2, '/api/login', { name: 'vet1130', pass: 'password1130', deviceId: 'dev-new-phone' });
  ok(chosen.status === 200 && chosen.j.profile && chosen.j.profile.created >= t0, 'CONTROL: the player who CHOOSES S2 signs in there and starts a new S2 player (created now)');
  const again = await post(p2, '/api/login', { name: 'vet1130', pass: 'password1130', deviceId: 'dev-new-phone', auto: 2 });
  ok(again.status === 200 && again.j.profile && again.j.profile.id === chosen.j.profile.id, 'once the account has an S2 player, a placed device signs in to it normally');
}

async function partC(ctx) {
  let pw; try { pw = require('playwright'); if (!fs.existsSync(pw.chromium.executablePath())) throw 0; } catch (e) {
    if (process.env.SKIP_BROWSER_PARITY === '1') { console.log('C. skipped (SKIP_BROWSER_PARITY=1)'); return; }
    throw new Error('Playwright Chromium missing (npx playwright install chromium)'); }
  console.log('C. the page in Chromium');
  const browser = await pw.chromium.launch(); ctx.browser = browser;
  const hostPort = h => /^(www\.)?emberweaveheroes\.com$/.test(h) || h === 's1.emberweaveheroes.com' ? ctx.p1 : h === 's2.emberweaveheroes.com' ? ctx.p2 : 0;
  async function newCtx(storage) {
    const c = await browser.newContext({ serviceWorkers: 'block', storageState: storage });
    await c.route(/^https:\/\/([a-z0-9.]*emberweaveheroes\.com)\//, async route => {
      const req = route.request(), u = new URL(req.url()), port = hostPort(u.hostname);
      if (!port) return route.abort('connectionrefused');   // s3-s5: off
      if (/\.(png|jpe?g|webp|gif|mp3|ogg|wav|glb|ktx2|mp4|webm)$/i.test(u.pathname)) return route.fulfill({ status: 404, body: '' });   // art: not needed here
      const h = { ...req.headers() }; delete h['accept-encoding'];
      try { const r = await fetch('http://127.0.0.1:' + port + u.pathname + u.search, { method: req.method(), headers: h, body: req.postDataBuffer() || undefined, redirect: 'manual' });
        const rh = {}; r.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding|connection)$/i.test(k)) rh[k] = v; });
        return route.fulfill({ status: r.status, headers: rh, body: Buffer.from(await r.arrayBuffer()) });
      } catch (e) { return route.abort('connectionrefused'); } });
    return c;
  }
  const until = async (page, fn, ms) => { const end = Date.now() + (ms || 20000); while (Date.now() < end) { try { const v = await page.evaluate(fn); if (v) return v; } catch (_) {} await delay(250); } return null; };
  const ls = (page, k) => page.evaluate(k => localStorage.getItem(k), k);

  // S1 is at its threshold (part B). A fresh install is placed on S2 before any account is made.
  let c = await newCtx(), page = await c.newPage();
  await page.goto('https://emberweaveheroes.com/play', { waitUntil: 'domcontentloaded' });
  const placed = await until(page, () => localStorage.getItem('ew_server') === '2' && !!localStorage.getItem('ew_acc@s2') && window.EW_SVR === 2, 30000);
  ok(!!placed, 'fresh install with S1 at its threshold: placed on S2 (ew_server 2) and its guest made on S2');
  ok(await ls(page, 'ew_auto') === '2' && !(await page.evaluate(() => window.EW_LS_RAW.get('ew_acc'))), 'the device is marked placed (ew_auto 2) and has no Server 1 account');
  // the server list: S1 busy with its load, S2 recommended, S1 still selectable
  await page.evaluate(() => svrOpen());
  const rows = await until(page, () => { const r = [...document.querySelectorAll('#svrPanel .svrRow')]; const s1 = r.find(b => b.dataset.id === '1'), s2 = r.find(b => b.dataset.id === '2');
    return s1 && s2 && s1.classList.contains('svrBusy') && s2.querySelector('.svrRec') ? { s1: s1.textContent, s1dis: s1.disabled, s2: s2.textContent, s3: r.find(b => b.dataset.id === '3').textContent } : null; });
  ok(!!rows && /Busy 2\/2/.test(rows.s1) && rows.s1dis === false, 'server list: Server 1 shows Busy 2/2 and can still be picked (' + (rows && rows.s1) + ')');
  ok(!!rows && /Recommended/.test(rows.s2) && /Offline/.test(rows.s3), 'server list: Server 2 is Recommended, Server 3 (down) Offline');
  await Promise.all([page.waitForURL(/server=1|\/play$/, { timeout: 15000 }).catch(() => {}), page.evaluate(() => document.querySelector('#svrPanel .svrRow[data-id="1"]').click())]);
  const moved = await until(page, () => localStorage.getItem('ew_server') === '1' && window.EW_SVR === 1 && !localStorage.getItem('ew_auto'), 20000);
  ok(!!moved, 'picking Server 1 from the list moves the player to S1 (ew_server 1, placement mark cleared)');
  await c.close();

  // CONTROL: an existing device (an account stored, no server chosen) is never placed, even with S1 busy
  c = await newCtx({ cookies: [], origins: [{ origin: 'https://emberweaveheroes.com', localStorage: [{ name: 'ew_acc', value: JSON.stringify({ token: null, name: null, rank: null, coins: 0, id: null }) }] }] });
  page = await c.newPage(); let asked = 0; page.on('request', r => { if (/\/api\/front\/assign/.test(r.url())) asked++; });
  await page.goto('https://emberweaveheroes.com/play', { waitUntil: 'domcontentloaded' });
  await until(page, () => !!JSON.parse(localStorage.getItem('ew_acc') || '{}').token, 20000);
  ok(asked === 0 && await ls(page, 'ew_server') === null && await page.evaluate(() => window.EW_SVR) === 1, 'CONTROL: an existing device stays on S1 - placement never asked');
  await c.close();

  // a returning S1 player on a new phone: placed on S2, signs in with the sign-in form's call -> signed in on S1, moved there
  const v2 = await post(ctx.p1, '/api/register', { name: 'vet2b1130', pass: 'password1130', deviceId: 'dev-vet2' });
  await J(ctx.p1, '/api/profile', { headers: { 'x-token': v2.j.token } });
  c = await newCtx(); page = await c.newPage();
  await page.goto('https://emberweaveheroes.com/play', { waitUntil: 'domcontentloaded' });
  ok(!!await until(page, () => localStorage.getItem('ew_server') === '2' && !!localStorage.getItem('ew_acc@s2'), 30000), 'new phone placed on S2');
  const hint = await page.evaluate(async () => { const d = await api('/api/login', 'POST', { name: 'vet2b1130', pass: 'password1130', roster: rosterPayload(), deviceId: deviceId(), auto: svrAutoGet() || undefined });
    let err = ''; const took = svrHomeLogin(d, 'vet2b1130', 'password1130', e => { err = e; }); return { auto: svrAutoGet(), home: d.homeServer, took, err }; });
  ok(hint.auto === 2 && hint.home === 1 && hint.took === true, 'the sign-in on S2 answers homeServer 1 and the client takes it (' + JSON.stringify(hint) + ')');
  const home = await until(page, () => window.EW_SVR === 1 && localStorage.getItem('ew_server') === '1' && (JSON.parse(localStorage.getItem('ew_acc') || '{}').name === 'vet2b1130'), 20000);
  ok(!!home, 'the returning player lands on S1 signed in to their own account - never moved');
  await c.close();
}

(async () => { const ctx = {};
  try {
    await partA();
    await partB(ctx);
    if (!process.env.AUD_SERVER) await partC(ctx);
    if (missed.length) process.exitCode = 1;
    console.log('test_front_door_1130.js: ' + pass + ' checks passed, ' + missed.length + ' failed (server ' + srvFile + ')');
  } catch (e) { console.error('FAIL', e && e.message || e); process.exitCode = 1; }
  finally { try { ctx.browser && await ctx.browser.close(); } catch (_) {} for (const k of ['s1', 's2']) try { ctx[k] && ctx[k].exitCode === null && ctx[k].kill(); } catch (_) {} try { ctx.fake && ctx.fake.close(); } catch (_) {} }
})();
