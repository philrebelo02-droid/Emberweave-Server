'use strict';
// v1039 battle helpers (Phil 6 Oct 2026: "When the server is stressing - high war time - my computer comes to support it if its not busy").
// A real server/sim-helper.js process and real battle pools on 12 recorded city battles:
// - a backed-up pool sends battles to the helper; every result is byte-identical to the ordinary engine; spot checks agree;
// - a wrong key (401), another engine (409 / fingerprint), a busy helper and a dead helper all leave every battle fought locally;
// - the helper refuses a request without its key and a different engine; the fingerprint ignores CRLF vs LF checkouts.
// Control: a pool with no helpers fights everything itself.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..'), GAME = path.join(root, 'emberweave-heroes.html');
const HOST = require(path.join(root, 'server/sim-host.js')), POOL = require(path.join(root, 'server/sim-pool.js'));
const BATTLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/battles_1039.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const KEY = 'test-helper-key-' + 'x'.repeat(16);
const kids = [];
async function startHelper(extra) {
  const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-helper-')), cfg = path.join(dir, 'cfg.json');
  fs.writeFileSync(cfg, JSON.stringify(Object.assign({ key: KEY, port, host: '127.0.0.1', workers: 2, busyCpu: 5 }, extra || {})));
  const child = spawn(process.execPath, [path.join(root, 'server/sim-helper.js')], { env: { ...process.env, SIM_HELPER_CONFIG: cfg }, stdio: 'ignore', windowsHide: true });
  kids.push(child); const url = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 150; i++) { try { const j = await (await fetch(url + '/health')).json(); if (j.ready > 0) return { url, child, port }; } catch (e) {} await sleep(200); }
  throw Error('helper did not start');
}
async function waitHelperState(pool, want, ms = 12000) { const t = Date.now(); while (Date.now() - t < ms) { const h = pool.stats.helper.helpers[0]; if (h.ok === want) return h; await sleep(200); } return pool.stats.helper.helpers[0]; }
async function waitReady(pool) { for (let i = 0; i < 150 && !pool.stats.ready; i++) await sleep(200); }
async function fightAll(pool, times = 2) {
  const jobs = []; for (let t = 0; t < times; t++) BATTLES.forEach((b, i) => jobs.push(pool.run('auto', [b.snaps, b.foe, b.seed]).then(r => [i, JSON.stringify(r)])));
  return Promise.all(jobs);
}
(async () => {
  try {
    const host = HOST.load(GAME), want = BATTLES.map(b => JSON.stringify(host.auto(b.snaps, b.foe, b.seed)));
    const FP = HOST.fingerprint(GAME), same = res => res.every(([i, r]) => r === want[i]);

    // fingerprint: CRLF and LF checkouts of the same engine hash the same; any change hashes differently
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-fp-')), html = fs.readFileSync(GAME, 'utf8');
    const flip = t => t.includes('\r\n') ? t.replace(/\r\n/g, '\n') : t.replace(/\n/g, '\r\n');
    fs.writeFileSync(path.join(tmp, 'emberweave-heroes.html'), flip(html));
    for (const raw of [...html.matchAll(/<script\s+src=["']\/([^"']+)["'][^>]*><\/script>/g)].map(m => m[1])) { const src = raw.split('?')[0]; if (src.startsWith('assets/')) continue;
      const from = path.join(root, src); if (!fs.existsSync(from)) continue; fs.mkdirSync(path.dirname(path.join(tmp, src)), { recursive: true }); fs.writeFileSync(path.join(tmp, src), flip(fs.readFileSync(from, 'utf8'))); }
    const fpFlip = HOST.fingerprint(path.join(tmp, 'emberweave-heroes.html'));
    { const f = path.join(tmp, 'emberweave-heroes.html'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('function simFightResult', '/* edited */ function simFightResult')); }
    const fpEdited = HOST.fingerprint(path.join(tmp, 'emberweave-heroes.html'));
    ok(fpFlip === FP && fpEdited !== FP, 'engine fingerprint: same across CRLF/LF checkouts, different when the engine changes');

    const H = await startHelper();
    const noKey = await fetch(H.url + '/battle', { method: 'POST', body: JSON.stringify({ fp: FP, method: 'auto', args: [] }) });
    const otherFp = await fetch(H.url + '/battle', { method: 'POST', headers: { 'x-helper-key': KEY }, body: JSON.stringify({ fp: 'other', method: 'auto', args: [] }) });
    ok(noKey.status === 401 && otherFp.status === 409, 'helper refuses a request without its key (401) and a different engine (409)');

    // A: a backed-up pool (1 local worker) uses the helper; identical results; spot checks agree
    const A = POOL.create(GAME, { size: 1, helpers: [{ url: H.url, key: KEY }], fp: FP, stressQueue: 1, checkEvery: 1 });
    await waitReady(A); await waitHelperState(A, true);
    const ra = await fightAll(A);
    ok(same(ra), 'with the helper: all ' + ra.length + ' battles byte-identical to the ordinary engine');
    ok(A.stats.helper.done > 0 && A.stats.runs > 0, 'the backlog was shared - helper fought ' + A.stats.helper.done + ', local workers ' + A.stats.runs);
    for (let i = 0; i < 60 && A.stats.helper.checked < 3; i++) await sleep(250);
    ok(A.stats.helper.checked >= 3 && A.stats.helper.mismatches === 0, 'spot checks: ' + A.stats.helper.checked + ' helper results re-fought locally, 0 different');

    // B: wrong key -> every helper attempt refused, all fought locally
    const B = POOL.create(GAME, { size: 1, helpers: [{ url: H.url, key: 'wrong-key-' + 'y'.repeat(20) }], fp: FP, stressQueue: 1 });
    await waitReady(B); await waitHelperState(B, true);
    const rb = await fightAll(B, 1);
    ok(same(rb) && B.stats.helper.done === 0 && B.stats.helper.fellBack > 0, 'wrong key: refused (' + B.stats.helper.fellBack + ' fell back), every battle fought locally, identical');

    // C: another engine -> the helper is never used
    const C = POOL.create(GAME, { size: 1, helpers: [{ url: H.url, key: KEY }], fp: 'f'.repeat(64), stressQueue: 1 });
    await waitReady(C); const hc = await waitHelperState(C, false, 3000);
    const rc = await fightAll(C, 1);
    ok(same(rc) && C.stats.helper.sent === 0 && hc.why === 'other build', 'another engine: helper never used (' + hc.why + '), identical results');

    // D: a busy helper machine is left alone
    const BZ = await startHelper({ busyCpu: -1 });
    const D = POOL.create(GAME, { size: 1, helpers: [{ url: BZ.url, key: KEY }], fp: FP, stressQueue: 1 });
    await waitReady(D); const hd = await waitHelperState(D, false, 3000);
    const rd = await fightAll(D, 1);
    ok(same(rd) && D.stats.helper.sent === 0 && hd.why === 'busy', 'busy helper machine: not used (' + hd.why + '), identical results');

    // E: the helper dies mid-war -> battles keep being fought locally
    H.child.kill(); await sleep(500);
    const before = A.stats.runs, re = await fightAll(A, 1);
    ok(same(re) && A.stats.runs - before === BATTLES.length, 'helper gone: every battle fought locally (' + (A.stats.runs - before) + '), identical results');

    // control: no helpers configured
    const N = POOL.create(GAME, { size: 1 }); await waitReady(N); const rn = await fightAll(N, 1);
    ok(same(rn) && N.stats.helper === undefined && N.stats.runs === BATTLES.length, 'control: no helpers - the pool fights everything itself, as before');

    for (const p of [A, B, C, D, N]) p.close();
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { for (const k of kids) { try { k.kill(); } catch (e) {} } setTimeout(() => process.exit(), 300); }
})();
