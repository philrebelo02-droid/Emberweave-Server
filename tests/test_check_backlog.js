'use strict';
// v1127 CHECK BACKLOG OUTSIDE THE PLAYER SHARDS (S1 copy run 11 Oct 2026: recordings waiting for a check sat on the receipts in the
// player shards - ~3.6 KB each, up to 40 a player; the world grew 51 -> 156 MB in one run). A real server whose only helper is down,
// so every campaign fight waits for its check:
//  - the receipt in the player's shard is a small marker (verify:'pending', no snapshots, no input log); the recording is in
//    <DB_FILE>.checks/backlog.jsonl;
//  - a hard kill and restart loses no waiting check (the boot scan re-queues all of them from the backlog file);
//  - a recording whose fight never reached disk (a crash before its save) is dropped at boot;
//  - once a real helper is up every check runs: the receipts say done, a flagged fight keeps its recording ON ITS RECEIPT (+ its
//    incident), and the backlog file holds nothing waiting;
//  - control 59eaefba: the same waiting fights put their recordings in the player shard (bytes per fight compared).
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { spawn } = require('node:child_process');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const KEY = 'backlog-test-key-' + 'b'.repeat(16), SQUAD = ['vael', 'sylthaine', 'vireo'];
const WON = JSON.stringify({ t: 60, won: true, stars: 3, wave: 2, u: SQUAD.map(k => [k, 'ally', 1, 500, 0, 100, 100]) });

function downHelper() { const srv = http.createServer((q, s) => { s.writeHead(503); s.end('{}'); });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ url: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() }))); }
async function realHelper() {
  const port = await R.freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-bl-helper-')), cfg = path.join(dir, 'cfg.json');
  fs.writeFileSync(cfg, JSON.stringify({ key: KEY, port, host: '127.0.0.1', workers: 2, busyCpu: 5 }));
  const child = spawn(process.execPath, [path.join(R.root, 'server/sim-helper.js')], { env: { ...process.env, SIM_HELPER_CONFIG: cfg }, stdio: 'ignore', windowsHide: true });
  const url = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 150; i++) { try { const j = await (await fetch(url + '/health')).json(); if (j.ready > 0) return { url, close: () => child.kill() }; } catch (e) {} await R.sleep(200); }
  child.kill(); throw Error('helper did not start');
}
const pendingOf = (w, id) => ((w.users[id].led || {}).battleReceipts || []).filter(r => r && r.verify === 'pending');
const shardBytes = (db, id) => { const m = JSON.parse(fs.readFileSync(db, 'utf8')), names = m.shardFiles || m.shards; return fs.statSync(path.join(db + '.d', names[WS.shardOf(id)])).size; };

async function fights(S, B, n) {
  const out = [];
  for (const p of B.players) for (let i = 0; i < n; i++) {
    const st = await S.req('POST', '/api/campaign/start', { mode: 'normal', node: 1, heroIds: SQUAD, requestId: 'bl-s-' + p.id + i }, p.token, p.ip);
    assert.equal(st.status, 200, JSON.stringify(st.body).slice(0, 160));
    const rs = await S.req('POST', '/api/campaign/resolve', { attemptId: st.body.attemptId, requestId: 'bl-r-' + p.id + i, inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3 }, p.token, p.ip);
    assert.equal(rs.status, 200, JSON.stringify(rs.body).slice(0, 160)); out.push(rs.body);
  }
  return out;
}

async function runOn(dir, check, full) {
  const down = await downHelper();
  const env = { SIM_WORKERS: '1', SIM_RESOLVE_WAIT_MS: '0', SIM_HELPERS: down.url, SIM_HELPER_KEY: KEY, SERVER_ID: '1' };
  const S = await R.server({ dir, env });
  let help = null;
  try {
    const B = await R.boot(S, 'bl', 2, { world: false });
    await S.kill(); await S.start(B.adminId, env); await R.sleep(1500);   // the pool (workers + the down helper) is up
    const b0 = B.players.map(p => shardBytes(S.db, p.id));
    const res = await fights(S, B, 5); await R.sleep(800);
    const w = WS.readWorld(S.db), pend = B.players.map(p => pendingOf(w, p.id));
    const perFight = B.players.map((p, i) => (shardBytes(S.db, p.id) - b0[i]) / 5);
    check(res.every(r => r.verify === 'pending') && pend.every(x => x.length === 5), 'with the only helper down all 10 fights wait for their check (receipts pending)');
    check(pend.every(x => x.every(r => !r.chk && !r.transcript)), 'the receipts in the player shards carry no snapshots and no input log (' + perFight.map(x => Math.round(x)).join(' / ') + ' B of shard per fight)');
    const bl = path.join(S.db + '.checks', 'backlog.jsonl'), lines = fs.existsSync(bl) ? fs.readFileSync(bl, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
    check(lines.filter(x => x.a).length === 10 && lines.every(x => !x.a || (Array.isArray(x.p.snaps) && Array.isArray(x.p.transcript))), 'the 10 recordings are in the backlog file beside the world (' + (fs.existsSync(bl) ? fs.statSync(bl).size : 0) + ' B)');
    if (!full) return { perFight };
    // an orphan: a recording whose fight never reached disk
    fs.appendFileSync(bl, JSON.stringify({ a: B.players[0].id + '|1|1', p: { snaps: [], transcript: [] } }) + '\n' + '{"a":"torn');
    await S.kill(); await S.start(B.adminId, env); await R.sleep(17000);   // the boot scan runs 15 s after boot
    const st = (await S.req('GET', '/api/dev/save-stats', null, (await S.req('POST', '/api/login', { name: 'blAdm', pass: 'password1' })).body.token)).body;
    check(st.checkBacklog && st.checkBacklog.waiting === 10 && st.battles.verify.backlog >= 10, 'hard kill + restart: all 10 waiting checks are back in the queue (' + (st.checkBacklog && st.checkBacklog.waiting) + ' waiting, the orphan and the torn line dropped)');
    await S.kill();
    help = await realHelper();
    await S.start(B.adminId, { ...env, SIM_HELPERS: help.url });
    let w2 = null; for (let i = 0; i < 90; i++) { await R.sleep(1000); try { w2 = WS.readWorld(S.db); } catch (e) { continue; } if (B.players.every(p => pendingOf(w2, p.id).length === 0)) break; }
    const rcs = B.players.flatMap(p => (w2.users[p.id].led.battleReceipts || []).slice(-5)), flagged = rcs.filter(r => r.match === false);
    check(rcs.length === 10 && rcs.every(r => r.verify === undefined && typeof r.match === 'boolean'), 'a helper comes up: all 10 checks run, every receipt says done');
    check(flagged.every(r => Array.isArray(r.transcript) && r.transcript.length) && B.players.every(p => (w2.users[p.id].led.battleIncidents || []).length >= flagged.filter(r => true).length / 2),
      'a flagged fight keeps its recording on its receipt with its incident (' + flagged.length + ' flagged, ' + (rcs.length - flagged.length) + ' accepted)');
    const tail = fs.readFileSync(bl, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean), live = new Set();
    for (const x of tail) { if (x.a) live.add(x.a); if (x.d) live.delete(x.d); }
    check(live.size === 0, 'the backlog file holds nothing waiting');
    return { perFight };
  } finally { await S.kill(); down.close(); if (help) help.close(); }
}

(async () => {
  let failed = false;
  try {
    const mine = await runOn(R.root, R.ok, true);
    console.log('== control ' + R.CONTROL_SHA + ' (must fail)');
    const misses = []; let ctl = null;
    try { ctl = await runOn(R.controlTree(), (c, m) => { if (!c) misses.push(m); }, false); } catch (e) { misses.push('threw: ' + e.message.slice(0, 160)); }
    misses.forEach(m => console.log('  control fails as it must: ' + m));
    R.ok(misses.length >= 2 && ctl && Math.min(...ctl.perFight) - Math.max(...mine.perFight) > 1500, 'CONTROL: on ' + R.CONTROL_SHA + ' a waiting fight adds ' + (ctl ? ctl.perFight.map(Math.round).join(' / ') : '?') + ' B to its player shard, this tree ' + mine.perFight.map(Math.round).join(' / ') + ' B (the rest is the clear itself: ledger, rewards, receipt) - its recording stays out of the shard');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(); }
  console.log('test_check_backlog.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
