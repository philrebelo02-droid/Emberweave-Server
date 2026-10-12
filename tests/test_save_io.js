'use strict';
// v1128 SAVE I/O OFF THE MAIN THREAD (S1 copy run 12 Oct 2026: synchronous shard writes were 40-45% of the main thread; on a busy
// SSD one save froze the server 7.5-8.1 s).
// A real server (DB_STORE=split) with a SLOW DISK (tests/helpers/slow-fs-hook.cjs: every file call under the world folder sleeps
// 200 ms in whichever thread makes it) while 12 players declare wars:
//  - the event loop keeps answering: /health, polled every 25 ms, never waits a whole disk call; no world file call is made on the
//    main thread; every declaration is answered ok and is on disk when answered;
//  - hard kills at random moments with saves queued on the slow disk lose no acknowledged declaration, five times;
//  - a save that fails on the io worker (the manifest temp path is a directory) answers 503, nothing reaches disk, the action is
//    undone in memory and the same request succeeds as a new action once the disk works; the world then loads with everything;
//  - DB_STORE_IO=sync still works (the v1127 path).
// CONTROL c9f40cd8: the same slow-disk round blocks /health for >= a disk call and makes its file calls on the main thread.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const HOOK = path.join(__dirname, 'helpers', 'slow-fs-hook.cjs');
const CONTROL = 'c9f40cd8';
const DISK_MS = 200;

function slowServer(dir, extraEnv) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-saveio-')), side = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-saveio-side-'));
  const on = path.join(side, 'slow.on'), log = path.join(side, 'main-thread-calls.log');
  return R.server({ dir, temp, nodeArgs: ['-r', HOOK], env: { SLOW_FS_DIR: temp, SLOW_FS_ON: on, SLOW_FS_MS: String(DISK_MS), SLOW_FS_LOG: log, ...(extraEnv || {}) } })
    .then(S => Object.assign(S, { slow: v => { if (v) fs.writeFileSync(on, '1'); else try { fs.unlinkSync(on); } catch (_) {} }, mainCalls: () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [] }));
}
async function bots(S, p) {
  const out = [];   // v1127 zoom gate: the whole map read as four 5 x 5-tile views
  for (const [c0, r0] of [[0, 0], [5, 0], [0, 5], [5, 5]]) { const t = []; for (let c = c0; c < c0 + 5; c++) for (let r = r0; r < r0 + 5; r++) t.push(c + '_' + r);
    out.push(...((await S.req('GET', '/api/world/cities?since=0&tiles=' + t.join(','), null, p.token, p.ip)).body.bots || [])); }
  return out;
}

// one slow-disk round: 12 declarations at once (a second wave while the first saves), /health polled every 25 ms
async function slowRound(dir, check, extraEnv) {
  const S = await slowServer(dir, extraEnv);
  try {
    const B = await R.boot(S, 'si', 12);
    const targets = await bots(S, B.players[0]);
    await R.sleep(1500);
    S.slow(true); await R.sleep(120);
    let stop = false; const probe = [];
    const poll = (async () => { while (!stop) { const t0 = Date.now(); try { await fetch(S.base + '/health'); } catch (_) {} probe.push(Date.now() - t0); await R.sleep(25); } })();
    const t0 = Date.now(), acked = [];
    const wave = (k) => Promise.all(B.players.map((p, i) => S.req('POST', '/api/world/war/declare', { defId: targets[k * 12 + i].id, requestId: 'si-' + k + '-' + i }, p.token, p.ip)
      .then(r => { if (r.status === 200 && r.body.ok) { acked.push({ p: p.id, def: targets[k * 12 + i].id }); } return r; })));
    const w1 = wave(0); await R.sleep(150); const w2 = wave(1);
    const rs = (await w1).concat(await w2), took = Date.now() - t0;
    await R.sleep(300); stop = true; await poll; S.slow(false);
    const calls = S.mainCalls(), worst = Math.max(...probe);
    check(rs.every(r => r.status === 200 && r.body.ok), '24 war declarations on a slow disk (' + DISK_MS + ' ms per file call): all answered ok in ' + took + ' ms');
    check(worst < DISK_MS * 0.75, 'the event loop kept answering: /health worst ' + worst + ' ms over ' + probe.length + ' polls (a disk call is ' + DISK_MS + ' ms)');
    check(calls.length === 0, 'no world-file call on the main thread while the disk was slow (' + calls.length + (calls.length ? ': ' + calls.slice(0, 4).join(', ') : '') + ')');
    await S.kill();
    const w = WS.readWorld(S.db), lost = acked.filter(a => !((w.users[a.p] || {}).worldWars || {})[a.def]);
    check(acked.length === 24 && lost.length === 0, 'every acknowledged declaration is on disk (' + lost.length + ' of ' + acked.length + ' missing)');
    return { worst, calls: calls.length };
  } finally { S.slow(false); await S.kill(); }
}

// hard kills with saves queued on the slow disk
async function killLoop(check) {
  const S = await slowServer(R.root, { SLOW_FS_MS: '40' });   // 40 ms a file call: at each kill some saves have landed, some are queued
  try {
    const B = await R.boot(S, 'sk', 8);
    const targets = await bots(S, B.players[0]);
    const acked = []; let sent = 0;
    for (let round = 0; round < 5; round++) {
      S.slow(true); await R.sleep(80);
      const jobs = [];
      for (let k = 0; k < 2; k++) for (let i = 0; i < 8; i++) { const def = targets[(round * 16 + k * 8 + i) % targets.length].id, p = B.players[i]; sent++;
        jobs.push(S.req('POST', '/api/world/war/declare', { defId: def, requestId: 'sk-' + round + '-' + k + '-' + i }, p.token, p.ip).then(r => { if (r.status === 200 && r.body.ok) acked.push({ p: p.id, def }); }).catch(() => {})); }
      await R.sleep(900 + Math.floor(Math.random() * 2400));   // some saves are on disk, some queued on the slow disk
      await S.kill(); await Promise.allSettled(jobs); S.slow(false);
      const lost = acked.filter(a => !((WS.readWorld(S.db).users[a.p] || {}).worldWars || {})[a.def]);
      if (lost.length) throw Error('round ' + round + ': ' + lost.length + ' acknowledged declarations lost');
      await S.start(B.adminId);
    }
    const w = WS.readWorld(S.db), lost = acked.filter(a => !((w.users[a.p] || {}).worldWars || {})[a.def]);
    check(acked.length > 0 && lost.length === 0, 'five hard kills with saves queued on the slow disk: all ' + acked.length + ' acknowledged declarations (of ' + sent + ' sent) are on disk, the world loads each time');
    const files = fs.readdirSync(S.db + '.d'), m = JSON.parse(fs.readFileSync(S.db, 'utf8')), named = new Set([...Object.values(WS.shardNamesOf(m)), ...Object.values(m.pieces || {})]);
    check(files.filter(f => /^(\d+-\d+|p-.+-\d+)\.json$/.test(f)).every(f => named.has(f)), 'after the restarts every shard / piece file is one the manifest names (orphans of killed saves swept at boot)');
  } finally { S.slow(false); await S.kill(); }
}

// a save that fails on the io worker
async function failedSave(check) {
  const S = await R.server({});
  try {
    const B = await R.boot(S, 'sf', 2);
    const targets = await bots(S, B.players[0]), p = B.players[1], target = targets[5].id;
    await R.sleep(1200);
    const s0 = await B.stat();
    fs.mkdirSync(S.db + '.store.tmp');   // the manifest temp path is a directory: the worker's write fails
    const failed = await S.req('POST', '/api/world/war/declare', { defId: target, requestId: 'sf-1' }, p.token, p.ip);
    check(failed.status === 503 && failed.body.storageFailed === true, 'a save that fails on the io worker answers 503 storageFailed (got ' + failed.status + ')');
    check(!((WS.readWorld(S.db).users[p.id] || {}).worldWars || {})[target], 'nothing of the failed action reached disk');
    const s1 = await B.stat();
    check(s1.failed > s0.failed && s1.store.io.failed >= 1 && s1.store.io.mode === 'worker', 'the failure is counted (group ' + (s1.failed - s0.failed) + ', io ' + s1.store.io.failed + ')');
    fs.rmdirSync(S.db + '.store.tmp');
    const retry = await S.req('POST', '/api/world/war/declare', { defId: target, requestId: 'sf-1' }, p.token, p.ip);
    check(retry.status === 200 && retry.body.ok === true && !retry.body.existing, 'the same request succeeds once the disk works, as a NEW war (the failed one was undone in memory)');
    await R.sleep(600); await S.kill();
    const w = WS.readWorld(S.db), m = JSON.parse(fs.readFileSync(S.db, 'utf8')), named = new Set([...Object.values(WS.shardNamesOf(m)), ...Object.values(m.pieces || {})]);
    check(!!(w.users[p.id].worldWars || {})[target] && Object.keys(w.users).length >= 3, 'the retried war is on disk and the world loads whole');
    check(fs.readdirSync(S.db + '.d').filter(f => /^(\d+-\d+|p-.+-\d+)\.json$/.test(f)).every(f => named.has(f)), 'the save after the failure rewrote the world and swept every file its manifest does not name');
  } finally { await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== slow disk, this tree');
    const mine = await slowRound(R.root, R.ok);
    console.log('== hard kills on a slow disk'); await killLoop(R.ok);
    console.log('== a failed save on the io worker'); await failedSave(R.ok);
    console.log('== DB_STORE_IO=sync (the v1127 path) still saves');
    { const misses = []; const s = await slowRound(R.root, (c, m) => { if (!c) misses.push(m); }, { DB_STORE_IO: 'sync' });
      R.ok(misses.length >= 1 && s.calls > 0 && misses.every(m => !/every acknowledged|answered ok/.test(m)), 'DB_STORE_IO=sync: every declaration saved and answered, the file calls back on the main thread (' + s.calls + ', worst /health ' + s.worst + ' ms)'); }
    console.log('== control ' + CONTROL + ' (must fail)');
    const misses = []; let ctl = null;
    try { ctl = await slowRound(R.controlTree(CONTROL), (c, m) => { if (!c) misses.push(m); }); } catch (e) { misses.push('threw: ' + e.message.slice(0, 160)); }
    misses.forEach(m => console.log('  control fails as it must: ' + m));
    R.ok(ctl && misses.length >= 2 && ctl.worst >= DISK_MS && ctl.calls > 0, 'CONTROL: on ' + CONTROL + ' the slow disk blocked /health ' + (ctl ? ctl.worst : '?') + ' ms with ' + (ctl ? ctl.calls : '?') + ' file calls on the main thread (this tree: ' + mine.worst + ' ms, ' + mine.calls + ')');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(CONTROL); }
  console.log('test_save_io.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
