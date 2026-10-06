'use strict';
// v1040 major war mode (Phil 6 Oct 2026: "if there is major war going on, like world tree day, my computer gives a little more than
// low priority help"). A real server/sim-helper.js process:
// - normal mode = lowest priority, `workers` battles at once; a major ask -> below-normal priority, `majorWorkers` at once; it drops
//   back `majorHoldMs` after the last ask;
// - a battle pool asks for major when its server says so (warLevel) and after a stretch of unbroken strain, not otherwise;
// - a REAL game server on World Tree day (calendar in its 24 h event phase) puts the helper in major mode; the same server on an
//   ordinary day leaves it normal.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..'), GAME = path.join(root, 'emberweave-heroes.html');
const HOST = require(path.join(root, 'server/sim-host.js')), POOL = require(path.join(root, 'server/sim-pool.js'));
const BATTLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/battles_1039.json'), 'utf8'));
const P = os.constants.priority;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const KEY = 'test-helper-key-' + 'z'.repeat(16), kids = [];
async function startHelper(extra) {
  const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-helper-')), cfg = path.join(dir, 'cfg.json');
  fs.writeFileSync(cfg, JSON.stringify(Object.assign({ key: KEY, port, host: '127.0.0.1', workers: 2, majorWorkers: 6, busyCpu: 5, majorBusyCpu: 5, majorHoldMs: 2000 }, extra || {})));
  const child = spawn(process.execPath, [path.join(root, 'server/sim-helper.js')], { env: { ...process.env, SIM_HELPER_CONFIG: cfg }, stdio: 'ignore', windowsHide: true });
  kids.push(child); const url = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 150; i++) { try { const j = await (await fetch(url + '/health')).json(); if (j.ready > 0) return { url, child }; } catch (e) {} await sleep(200); }
  throw Error('helper did not start');
}
const health = async (url, q) => (await fetch(url + '/health' + (q || ''))).json();
async function waitFor(fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(250); } return null; }
async function burst(url, fp, n, war) {
  return Promise.all(BATTLES.slice(0, n).map(b => fetch(url + '/battle', { method: 'POST', headers: { 'x-helper-key': KEY },
    body: JSON.stringify({ fp, method: 'auto', args: [b.snaps, b.foe, b.seed], war }) }).then(r => r.status)));
}
(async () => {
  try {
    const FP = HOST.fingerprint(GAME), H = await startHelper();
    for (let i = 0; i < 60 && (await health(H.url)).ready < 6; i++) await sleep(250);

    const h0 = await health(H.url);
    ok(h0.mode === 'normal' && h0.priority === P.PRIORITY_LOW && h0.limit === 2, 'normal mode: lowest priority (' + h0.priority + '), 2 battles at once');
    const sN = await burst(H.url, FP, 6);
    ok(sN.filter(s => s === 200).length >= 1 && sN.filter(s => s === 503).length >= 1, 'normal mode: 6 at once -> ' + sN.filter(s => s === 200).length + ' fought, ' + sN.filter(s => s === 503).length + ' handed back (busy)');

    const h1 = await health(H.url, '?war=major');
    ok(h1.mode === 'major' && h1.priority === P.PRIORITY_BELOW_NORMAL && h1.limit === 6, 'major ask: below-normal priority (' + h1.priority + '), 6 battles at once');
    const sM = await burst(H.url, FP, 6, 'major');
    ok(sM.every(s => s === 200), 'major mode: 6 at once -> all 6 fought');
    const back = await waitFor(async () => { const h = await health(H.url); return h.mode === 'normal' && h.priority === P.PRIORITY_LOW ? h : null; }, 6000);
    ok(!!back, 'no further asks: back to normal and lowest priority after the hold');

    // a pool asks for major only when told (warLevel) or after unbroken strain
    const A = POOL.create(GAME, { size: 1, helpers: [{ url: H.url, key: KEY }], fp: FP, warLevel: () => 'major' });
    const okA = await waitFor(async () => A.stats.helper.major === true && (await health(H.url)).mode === 'major');
    ok(!!okA, 'pool told "major" (World Tree day): its health checks put the helper in major mode');
    A.close(); await waitFor(async () => (await health(H.url)).mode === 'normal', 8000);
    const Q = POOL.create(GAME, { size: 1, helpers: [{ url: H.url, key: KEY }], fp: FP, warLevel: () => null, stressLagMs: 1e9 });
    await sleep(6500);
    ok(Q.stats.helper.major === false && (await health(H.url)).mode === 'normal', 'pool on an ordinary day without strain: the helper stays normal');
    Q.close();
    const S = POOL.create(GAME, { size: 1, helpers: [{ url: H.url, key: KEY }], fp: FP, stressLagMs: 0.000001, majorAfterMs: 1500 });
    const okS = await waitFor(async () => S.stats.helper.major === true && (await health(H.url)).mode === 'major');
    ok(!!okS, 'unbroken strain for majorAfterMs: the pool asks for major on its own');
    S.close();

    // a real game server on World Tree day vs an ordinary day
    async function serverRun(firstEventAt) {
      const G = await startHelper({ majorHoldMs: 60000 }), port = await freePort(), base = 'http://127.0.0.1:' + port;
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-majorwar-'));
      const env = { ...process.env, PORT: String(port), DB_FILE: path.join(temp, 'db.json'), NODE_ENV: 'test', SIM_WORKERS: '1', SIM_HELPERS: G.url, SIM_HELPER_KEY: KEY, SERVER_SECRET: 'major-war-test' };
      if (firstEventAt) env.WORLD_TREE_FIRST_EVENT_AT = new Date(firstEventAt).toISOString(); else delete env.WORLD_TREE_FIRST_EVENT_AT;
      const srv = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: 'ignore', windowsHide: true }); kids.push(srv);
      for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch (e) {} await sleep(100); }
      const cal = await (await fetch(base + '/api/world-tree/status')).json();
      const h = await waitFor(async () => { const x = await health(G.url); return x.mode === 'major' ? x : null; }, 12000) || await health(G.url);
      srv.kill(); G.child.kill(); return { cal, h };
    }
    const day = await serverRun(Date.now() - 3600000);
    ok(day.cal.phase === 'event' && day.h.mode === 'major', 'real server on World Tree day (calendar phase ' + day.cal.phase + '): helper in major mode');
    const plain = await serverRun(null);
    ok(plain.cal.configured === false && plain.h.mode === 'normal', 'same server on an ordinary day (no World Tree calendar): helper stays normal');

    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { for (const k of kids) { try { k.kill(); } catch (e) {} } setTimeout(() => process.exit(), 300); }
})();
