'use strict';
// v1124 fight checks on the helpers (Phil 11 Oct 2026: "the helpers are there specifically to carry the fight checks, so Server 1 does
// none itself"). A real server/sim-helper.js (2 battles at once) and a real pool with one local worker:
//  - checks (run(..., {check:true})) fed at checkCapacity() all go to the helper; the local worker fights none; results identical;
//  - with every helper slot taken a check is refused at once ('no helper free' - the server's backlog asks again), never run locally;
//  - per-helper numbers (limit, sent, done, mean ms, the helper's own in-flight, the rest of its machine's CPU) are published;
//  - control: a pool with no helper configured runs checks on its own workers (dev / tests / a server without helpers).
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..'), GAME = path.join(root, 'emberweave-heroes.html');
const HOST = require(path.join(root, 'server/sim-host.js')), POOL = require(path.join(root, 'server/sim-pool.js'));
const BATTLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/battles_1039.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const KEY = 'test-helper-key-' + 'z'.repeat(16), kids = [], pools = [];
async function startHelper() {
  const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-chk-helper-')), cfg = path.join(dir, 'cfg.json');
  fs.writeFileSync(cfg, JSON.stringify({ key: KEY, port, host: '127.0.0.1', workers: 2, busyCpu: 5 }));
  const child = spawn(process.execPath, [path.join(root, 'server/sim-helper.js')], { env: { ...process.env, SIM_HELPER_CONFIG: cfg }, stdio: 'ignore', windowsHide: true });
  kids.push(child); const url = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 150; i++) { try { const j = await (await fetch(url + '/health')).json(); if (j.ready > 0) return url; } catch (e) {} await sleep(200); }
  throw Error('helper did not start');
}
async function until(f, ms) { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(200); } return false; }
(async () => {
  try {
    const host = HOST.load(GAME), want = BATTLES.map(b => JSON.stringify(host.auto(b.snaps, b.foe, b.seed)));
    const url = await startHelper();
    const P = POOL.create(GAME, { size: 1, helpers: [{ url, key: KEY }], fp: HOST.fingerprint(GAME), checksLocal: false }); pools.push(P);
    await until(() => P.stats.ready > 0 && P.stats.helper.helpers[0] && P.stats.helper.helpers[0].ok, 20000);
    // feed like the server's backlog: never more in flight than checkCapacity()
    const queue = BATTLES.map((b, i) => i).concat(BATTLES.map((b, i) => i)), results = []; let inFlight = 0, refused = 0;
    await new Promise(done => { const pump = () => {
      if (!queue.length && !inFlight) return done();
      while (queue.length && inFlight < P.checkCapacity()) { const i = queue.shift(); inFlight++;
        P.run('auto', [BATTLES[i].snaps, BATTLES[i].foe, BATTLES[i].seed], { check: true })
          .then(r => results.push([i, JSON.stringify(r)]), () => { refused++; queue.push(i); }).finally(() => { inFlight--; setTimeout(pump, 50); }); } };
      pump(); });
    ok(results.length === 2 * BATTLES.length && results.every(([i, r]) => r === want[i]), 'all ' + results.length + ' checks answered by the helper, byte-identical to the ordinary engine');
    ok(P.stats.runs === 0, 'the server\'s own worker fought none of them (local runs: ' + P.stats.runs + ')');
    ok(P.checkCapacity() === 2, 'checkCapacity() = the helper\'s 2 slots (' + P.checkCapacity() + ')');
    const h = P.stats.helper.helpers[0];
    ok(h.limit === 2 && h.done === 2 * BATTLES.length && h.sent >= h.done && h.avgMs > 0 && typeof h.otherCpu === 'number' && typeof h.theirInFlight === 'number' && h.maxMine <= 2,
      'per-helper numbers: ' + JSON.stringify({ limit: h.limit, sent: h.sent, done: h.done, busy: h.busy, avgMs: h.avgMs, maxMine: h.maxMine, otherCpu: h.otherCpu, mode: h.mode }));
    // over capacity: refused at once, never run locally
    const over = await Promise.allSettled(BATTLES.slice(0, 6).map(b => P.run('auto', [b.snaps, b.foe, b.seed], { check: true })));
    const no = over.filter(x => x.status === 'rejected' && /no helper free/.test(x.reason.message)).length;
    ok(no >= 4 && P.stats.runs === 0, 'six checks at once on two slots: ' + no + ' refused at once (the backlog asks again), none fought locally');
    // control: no helper configured -> checks run on the pool's own workers
    const L = POOL.create(GAME, { size: 1 }); pools.push(L); await until(() => L.stats.ready > 0, 20000);
    const rl = await Promise.all(BATTLES.slice(0, 3).map((b, i) => L.run('auto', [b.snaps, b.foe, b.seed], { check: true }).then(r => JSON.stringify(r) === want[i])));
    ok(rl.every(Boolean) && L.stats.runs === 3, 'control: with no helper configured the pool checks on its own workers (' + L.stats.runs + ')');
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { for (const p of pools) try { p.close(); } catch (e) {} for (const k of kids) try { k.kill(); } catch (e) {} }
})();
