'use strict';
// v1128 SMALLER SAVE UNIT: the journal layout (server/store-journal.js + server/store-diff.js). S1 copy run 12 Oct 2026: every
// action rewrote a whole 512-shard file (the player + ~11 others, ~170 KB).
// Part 1, the store (sync io and the io worker): players, receipts, shared pieces, the inline core, a deleted player, big pieces
// patched, checkpoints, a torn last line, a reload that appends after it, orphans, writeWorld keeps the layout, `downgrade` writes
// split-v1 and the c9f40cd8 world-store refuses the journal layout.
// Part 2, a real server on a world of 3,000 players: one war declaration appends one journal line (a few KB) and writes no shard
// file; CONTROL c9f40cd8 rewrites a whole shard file per declaration.
// Part 3, hard kills at random moments while declarations save and small checkpoints fold the journal: no acknowledged
// declaration is lost, the world loads every time, no orphan file is left.
// Part 4, migration and rollback: a pieces world boots into the journal layout with every player; DB_STORE_JOURNAL=0 + one
// restart writes the pieces layout back and a c9f40cd8 server starts on it; c9f40cd8 refuses to start on the journal layout.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const HOOK = path.join(__dirname, 'helpers', 'write-count-hook.cjs');
const CONTROL = 'c9f40cd8';
const clone = o => JSON.parse(JSON.stringify(o));
const deepEq = (a, b) => { try { assert.deepStrictEqual(clone(a), clone(b)); return true; } catch (e) { return false; } };
const STORE_FILES = /^(\d+-\d+|p-.+-\d+)\.json$|^j-\d+\.log$/;
const orphans = file => { const named = WS.namedFiles(file); return fs.readdirSync(file + '.d').filter(f => STORE_FILES.test(f) && !named.has(f)); };
function controlStore() {
  const src = execFileSync('git', ['show', CONTROL + ':server/world-store.js'], { cwd: R.root });
  const f = path.join(os.tmpdir(), 'world-store-' + CONTROL + '-' + process.pid + '.js'); fs.writeFileSync(f, src); return require(f);
}

// the io worker has no checkpoint under way and nothing left to unlink - the test reads the files (tools stop the game first)
async function idle(st) { for (let i = 0; i < 200; i++) { st.flush(); const j = st.stats.io.journal || {}; if (!j.ckptActive && !j.lazy) return; await R.sleep(50); } }
async function unit(mode) {
  process.env.DB_STORE_CKPT_BYTES = '20000';   // small checkpoints (read when the store starts its journal)
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-journal-')), file = path.join(temp, 'db.json');
  const db = { users: {}, byName: {}, tokens: { t1: { id: 'u1' } }, seeded: true, chat: { world: [] }, idem: { 'sys:x': { t: 1 } }, 'weird-key': 5,
    feedback: Array.from({ length: 300 }, (_, i) => ({ id: 'f' + i, text: 'y'.repeat(200) })), guilds: { g1: { name: 'G', log: [] }, g2: { name: 'H', pad: 'z'.repeat(2000) } } };
  for (let i = 0; i < 300; i++) { const id = 'u' + i; db.users[id] = { id, name: 'P' + i, gold: i, led: { hero: 'h'.repeat(1500), txs: [] }, marches: [] }; db.idem[id + ':a:1'] = { t: 1, resp: { ok: true, n: i } }; }
  const st = WS.create(file, { split: true, journal: true, io: mode });
  const W = async (ids, p) => { if (mode === 'sync') st.write(db, ids, p); else await st.writeAsync(db, ids, p); };
  const m = mode + ': ';
  await W(null);
  R.ok(WS.layoutOf(file) === 'journal' && deepEq(WS.readWorld(file), db) && JSON.parse(fs.readFileSync(file, 'utf8')).shards === null, m + 'a full save writes the journal layout (shards: null) and reads back whole');
  const j0 = st.stats.bytes.journal; db.users.u5.gold = 555; db.users.u5.led.txs.push({ t: 1 }); db.idem['u5:a:2'] = { t: 2, resp: { pad: 'r'.repeat(3000) } }; delete db.idem['u5:a:1'];
  await W(['u5']);
  R.ok(deepEq(WS.readWorld(file), db) && st.stats.bytes.journal - j0 < 3600, m + 'one player\'s change appends its patch + its new receipt only (' + (st.stats.bytes.journal - j0) + ' B; the player is ' + JSON.stringify(db.users.u5).length + ' B)');
  const j1 = st.stats.bytes.journal; db.users.u5.gold = 556; await W(['u5']);
  R.ok(deepEq(WS.readWorld(file), db) && st.stats.bytes.journal - j1 < 200, m + 'the next change of that player does not write its receipts again (' + (st.stats.bytes.journal - j1) + ' B)');
  db.chat.world.push({ t: 'hi' }); db['weird-key'] = 6; db.tokens.t2 = 1; if (st.markPiece) st.markPiece('tokens', 't2'); await W([], ['chat']); await W([]);   // v1134: tokens is a flagged piece - a change to it is marked (server.js _dpk)
  R.ok(deepEq(WS.readWorld(file), db), m + 'declared and undeclared shared pieces and the inline core read back');
  const j2 = st.stats.bytes.journal; db.feedback.push({ id: 'new', text: 'q'.repeat(150) }); if (st.markPiece) st.markPiece('feedback'); await W([]);   // v1134: feedback is flagged (server.js _dp in feedbackAppend)
  R.ok(deepEq(WS.readWorld(file), db) && st.stats.bytes.journal - j2 < 400, m + 'a new entry in a big shared piece writes that entry only (' + (st.stats.bytes.journal - j2) + ' B; the piece is ' + JSON.stringify(db.feedback).length + ' B)');
  delete db.users.u7; delete db.idem['u7:a:1']; delete db.guilds.g2; await W(['u7']);
  R.ok(deepEq(WS.readWorld(file), db), m + 'a deleted player (and its receipts) and a removed key of a piece read back');
  const ids = Object.keys(db.users);
  for (let r = 0; r < 60; r++) { const w = []; for (let i = 0; i < 30; i++) { const id = ids[(r * 7 + i) % ids.length]; db.users[id].gold = r * 1000 + i; db.users[id].marches.push({ r, pad: 'm'.repeat(300) }); if (db.users[id].marches.length > 4) db.users[id].marches.shift(); w.push(id); }
    db.feedback.push({ id: 'n' + r, text: 'q'.repeat(150) }); if (r % 7 === 0) db.feedback.shift(); if (st.markPiece) st.markPiece('feedback'); await W(w); }
  if (mode === 'worker') { for (let i = 0; i < 40; i++) { await R.sleep(40); await W([]); } await idle(st); }
  const js = st.stats.io.journal;
  R.ok(js.checkpoints >= 2 && js.ckptAborted === 0 && deepEq(WS.readWorld(file), db) && orphans(file).length === 0, m + 'checkpoints fold the journal into the base (' + js.checkpoints + ' checkpoints, ' + js.ckptShards + ' shards rewritten); the world reads back whole; no orphan file');
  if (mode === 'worker') {
    const pend = []; for (let k = 0; k < 5; k++) { db.users['u' + (20 + k)].gold = -k; pend.push(st.writeAsync(db, ['u' + (20 + k)])); }
    db.users.u30.gold = -30; st.write(db, ['u30']);   // a synchronous save (exit, timers) right behind them
    const queued = st.ioPending; await Promise.all(pend); await idle(st); const now = WS.readWorld(file);
    R.ok([0, 1, 2, 3, 4].every(k => now.users['u' + (20 + k)].gold === -k) && now.users.u30.gold === -30 && queued === 0, m + 'a synchronous save waits for the saves queued before it: nothing was left in the queue when it returned (' + queued + '); all six are on disk');
    st.io().lose('test'); db.users.u31.gold = -31; await W(['u31']); db.users.u32.gold = -32; await W(['u32']);
    R.ok(st.stats.io.mode === 'sync' && deepEq(WS.readWorld(file), db) && orphans(file).length === 0, m + 'the io worker lost: saves go on on the main thread (a full save restarts the journal there) and the world reads back whole');
  }
  { const man0 = JSON.parse(fs.readFileSync(file, 'utf8')), s0 = WS.shardOf('u0'), victim = path.join(st.dir, s0 + '-' + man0.baseGens[s0] + '.json'); fs.renameSync(victim, victim + '.away');
    const a0 = st.stats.io.journal.ckptAborted; for (let k = 0; k < 80; k++) { db.users.u0.gold = k; db.users.u0.marches.push({ k, pad: 'z'.repeat(600) }); await W(['u0']); }
    if (mode === 'worker') { for (let i = 0; i < 20; i++) { await R.sleep(50); await W([]); } await idle(st); }
    const a1 = st.stats.io.journal.ckptAborted; fs.renameSync(victim + '.away', victim);
    R.ok(a1 - a0 === 1 && deepEq(WS.readWorld(file), db), m + 'a checkpoint that cannot read a base file stops once and waits 30 s (' + (a1 - a0) + ' stop, not a retry loop); every save still lands in the journal'); }
  const man = JSON.parse(fs.readFileSync(file, 'utf8')), jf = path.join(st.dir, man.journals[man.journals.length - 1]);
  fs.appendFileSync(jf, 'deadbeefdeadbeef {"u":{"u1":');
  R.ok(deepEq(WS.readWorld(file), db), m + 'a torn last line (a crash in the middle of an append) is ignored');
  const st2 = WS.create(file, { split: true, journal: true, io: mode }), d2 = st2.load(); d2.users.u9.gold = 99;
  if (mode === 'sync') st2.write(d2, ['u9']); else { await st2.writeAsync(d2, ['u9']); await idle(st2); }
  R.ok(WS.readWorld(file).users.u9.gold === 99 && st2.stats.io.journal.truncated === 1, m + 'the next server cuts the torn line off before it appends; its append reads back');
  fs.writeFileSync(path.join(st.dir, 'j-999999.log'), ''); fs.writeFileSync(path.join(st.dir, '7-999999.json'), '{}');
  const st3 = WS.create(file, { split: true, journal: true }); st3.load();
  R.ok(st3.sweepOrphans() === 2 && orphans(file).length === 0, m + 'a journal and a base file no manifest names are swept at boot');
  WS.writeWorld(file, Object.assign(WS.readWorld(file), { seeded: 'tool' }));
  R.ok(WS.layoutOf(file) === 'journal' && WS.readWorld(file).seeded === 'tool', m + 'writeWorld (setpass, restores) keeps the journal layout');
  let refused = null; try { controlStore().readWorld(file); } catch (e) { refused = e.code; }
  R.ok(refused === 'SHARD_MISSING', m + CONTROL + ' world-store refuses the journal layout (' + refused + ') - it never runs a base without its journal');
  execFileSync(process.execPath, [path.join(R.root, 'server/world-store.js'), 'downgrade', file]);
  const back = WS.readWorld(file);
  R.ok(WS.layoutOf(file) === 'split-v1' && deepEq(controlStore().readWorld(file), back) && back.users.u9.gold === 99 && !fs.readdirSync(st.dir).some(f => /^j-|^p-/.test(f)),
    m + 'rollback: `world-store.js downgrade` writes split-v1, the ' + CONTROL + ' world-store reads it whole, journals and pieces are gone');
  delete process.env.DB_STORE_CKPT_BYTES;
}

// a world of `filler` extra players (clones of a booted one, no castle) around the booted players
async function bigWorld(dir, tag, filler) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-journal-srv-')), log = path.join(temp, 'writes.log');
  const S = await R.server({ dir, temp, nodeArgs: ['-r', HOOK], env: { WRITE_LOG: log, WRITE_LOG_APPENDS: '1' } });
  const B = await R.boot(S, tag, 8);
  await S.kill();
  const w = WS.readWorld(S.db), tpl = w.users[B.players[0].id];
  for (let i = 0; i < filler; i++) { const id = tag + 'f' + String(i).padStart(5, '0'), u = clone(tpl); u.id = id; u.name = tag + 'Filler' + i; delete u.worldLocation; delete u.worldWars; w.users[id] = u; w.byName[u.name.toLowerCase()] = id; }
  WS.writeWorld(S.db, w);
  await S.start(B.adminId); await R.sleep(2500);
  return { S, B, log };
}
const writes = (log, from) => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : []).slice(from).map(l => { const [b, f] = l.split('\t'); return { b: +b, f }; });
async function perAction(dir, tag, check) {
  const { S, B, log } = await bigWorld(dir, tag, 3000);
  try {
    const targets = []; for (const [c0, r0] of [[0, 0], [5, 0], [0, 5], [5, 5]]) { const t = []; for (let c = c0; c < c0 + 5; c++) for (let r = r0; r < r0 + 5; r++) t.push(c + '_' + r);
      targets.push(...((await S.req('GET', '/api/world/cities?since=0&tiles=' + t.join(','), null, B.players[0].token, B.players[0].ip)).body.bots || [])); }
    const from = writes(log, 0).length; let acked = 0;
    for (let k = 0; k < 16; k++) { const p = B.players[k % 8];
      const r = await S.req('POST', '/api/world/war/declare', { defId: targets[k].id, requestId: tag + '-pa-' + k }, p.token, p.ip); if (r.status === 200 && r.body.ok) acked++;
      await R.sleep(350); }
    const wr = writes(log, from), bytes = wr.reduce((a, x) => a + x.b, 0), shardFiles = wr.filter(x => /^\d+-\d+\.json$/.test(x.f)).length;
    const per = Math.round(bytes / Math.max(1, acked));
    check(acked === 16, '16 war declarations answered ok on a world of ' + (3000 + 9) + ' players');
    check(per < 15000 && shardFiles === 0, 'one declaration writes ' + (per / 1024).toFixed(1) + ' KB and no shard file (' + wr.length + ' writes: ' + [...new Set(wr.map(x => x.f.replace(/\d+/g, 'N')))].join(', ') + ')');
    return { per, shardFiles };
  } finally { await S.kill(); }
}

async function killLoop(check) {
  const S = await R.server({ env: { DB_STORE_CKPT_BYTES: '6000', DB_STORE_VERIFY: '1' } });
  try {
    const B = await R.boot(S, 'jk', 8);
    const targets = []; for (const [c0, r0] of [[0, 0], [5, 0], [0, 5], [5, 5]]) { const t = []; for (let c = c0; c < c0 + 5; c++) for (let r = r0; r < r0 + 5; r++) t.push(c + '_' + r);
      targets.push(...((await S.req('GET', '/api/world/cities?since=0&tiles=' + t.join(','), null, B.players[0].token, B.players[0].ip)).body.bots || [])); }
    const acked = []; let sent = 0, ckpts = 0;
    for (let round = 0; round < 6; round++) {
      const jobs = [];
      for (let k = 0; k < 3; k++) for (let i = 0; i < 8; i++) { const def = targets[(round * 24 + k * 8 + i) % targets.length].id, p = B.players[i]; sent++;
        jobs.push(R.sleep(k * 120).then(() => S.req('POST', '/api/world/war/declare', { defId: def, requestId: 'jk-' + round + '-' + k + '-' + i }, p.token, p.ip)).then(r => { if (r.status === 200 && r.body.ok) acked.push({ p: p.id, def }); }).catch(() => {})); }
      await R.sleep(round % 2 ? 450 + Math.floor(Math.random() * 700) : 60 + Math.floor(Math.random() * 250));   // even rounds: saves still in flight; odd: a checkpoint under way
      try { ckpts = Math.max(ckpts, ((await B.stat()).store.io.journal || {}).checkpoints || 0); } catch (_) {}
      await S.kill(); await Promise.allSettled(jobs);
      const w = WS.readWorld(S.db), lost = acked.filter(a => !((w.users[a.p] || {}).worldWars || {})[a.def]);
      if (lost.length) throw Error('round ' + round + ': ' + lost.length + ' acknowledged declarations lost');
      await S.start(B.adminId);
    }
    const st = (await B.stat()).store; await S.kill();
    check(acked.length > 0 && ckpts > 0, 'six hard kills while declarations save and the journal is folded into the base (' + ckpts + '+ checkpoints): all ' + acked.length + ' acknowledged declarations (of ' + sent + ' sent) are on disk, the world loads each time');
    check(orphans(S.db).length === 0 && st.layout === 'journal' && st.undeclaredPieces === 0, 'no orphan file after the restarts; layout journal; the verifier saw no undeclared piece');
  } finally { await S.kill(); }
}

async function migrateRollback(check) {
  const S = await R.server({ env: { DB_STORE_JOURNAL: '0' } });
  try {
    const B = await R.boot(S, 'jm', 3);
    await R.sleep(800); await S.kill();
    const w0 = WS.readWorld(S.db); check(WS.layoutOf(S.db) === 'pieces', 'setup: a v1127 pieces world (DB_STORE_JOURNAL=0)');
    await S.start(B.adminId, { DB_STORE_JOURNAL: '' }); await R.sleep(2000);
    const lg = await S.req('POST', '/api/login', { name: 'jmP1', pass: 'password1' }, null, '10.96.1.1');
    await S.kill();
    check(WS.layoutOf(S.db) === 'journal' && deepEq(WS.readWorld(S.db).users, Object.assign(clone(w0.users), { [B.players[1].id]: WS.readWorld(S.db).users[B.players[1].id] })) && lg.status === 200 && orphans(S.db).length === 0,
      'a v1128 server boots on the pieces world, its boot save writes the journal layout with every player; players sign in; the old files are gone');
    const C = await R.server({ dir: R.controlTree(CONTROL), db: S.db, temp: S.temp });
    let refused = false; try { await C.start(B.adminId); } catch (e) { refused = /exited/.test(e.message); } await C.kill();
    check(refused && WS.layoutOf(S.db) === 'journal', CONTROL + ' refuses to start on the journal layout and leaves it untouched');
    await S.start(B.adminId, { DB_STORE_JOURNAL: '0' }); await R.sleep(2000); await S.kill();
    check(WS.layoutOf(S.db) === 'pieces' && orphans(S.db).length === 0, 'rollback step 1: DB_STORE_JOURNAL=0 + one restart writes the pieces layout (journals gone)');
    const C2 = await R.server({ dir: R.controlTree(CONTROL), db: S.db, temp: S.temp });
    await C2.start(B.adminId);
    const lg2 = await C2.req('POST', '/api/login', { name: 'jmP2', pass: 'password1' }, null, '10.96.1.2');
    await C2.kill();
    check(lg2.status === 200 && Object.keys(WS.readWorld(S.db).users).length === Object.keys(w0.users).length, 'rollback step 2: the ' + CONTROL + ' server starts on it with every player (sign-in ' + lg2.status + ')');
  } finally { await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== the store, synchronous io'); await unit('sync');
    console.log('== the store, the io worker'); await unit('worker');
    console.log('== a real server, 3,009 players'); const mine = await perAction(R.root, 'sj', R.ok);
    console.log('== hard kills with checkpoints'); await killLoop(R.ok);
    console.log('== migration and rollback'); await migrateRollback(R.ok);
    console.log('== control ' + CONTROL + ' (must fail)');
    const misses = []; let ctl = null;
    try { ctl = await perAction(R.controlTree(CONTROL), 'sc', (c, m) => { if (!c) misses.push(m); }); } catch (e) { misses.push('threw: ' + e.message.slice(0, 160)); }
    misses.forEach(m => console.log('  control fails as it must: ' + m));
    R.ok(ctl && misses.length >= 1 && ctl.shardFiles >= 16 && ctl.per > 4 * mine.per, 'CONTROL: on ' + CONTROL + ' one declaration wrote ' + (ctl ? (ctl.per / 1024).toFixed(1) : '?') + ' KB and ' + (ctl ? ctl.shardFiles : '?') + ' shard files for 16 (this tree: ' + (mine.per / 1024).toFixed(1) + ' KB, 0)');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(CONTROL); }
  console.log('test_save_journal.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
