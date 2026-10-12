'use strict';
// v1127 SHARED-WORLD PIECES (Server 1 load test 11 Oct 2026: every save, partial ones included, rewrote the whole ~1 MB shared world).
// Part 1, the store (server/world-store.js):
//  - the pieces layout: one file per shared system, the manifest names files only (and has no `shards`, so pre-v1127 code refuses it);
//  - a save that declares ['chat'] writes the chat piece only; a save that declares nothing compares every piece and writes the
//    changed ones only; a full save of an unchanged world writes no piece; a removed system's file goes;
//  - the verifier counts a piece changed outside a declared save; the next undeclared save writes it;
//  - a save failing at any file (shard, piece, manifest, swap) leaves the committed world exactly; leftovers are swept at boot;
//  - an old one-file world and a split-v1 world load, and their first save migrates them; readWorld/writeWorld keep the layout;
//  - rollback: `world-store.js downgrade` writes split-v1, which the 59eaefba world-store reads; 59eaefba REFUSES the pieces layout.
// Part 2, a real server (DB_STORE=split, verifier on), with a write counter on every file under the world folder:
//  - one world chat line: exactly one save, writing the chat piece + the manifest only - no shard, no other piece, a few KB, while the
//    shared world holds ~300 KB; CONTROL 59eaefba: the same line rewrites the whole shared world (>= 300 KB);
//  - durable actions (war declarations, chat reports) under a hard kill at random moments, five times: every acknowledged action is
//    on disk after the restart and the world always loads;
//  - an old-format (split-v1) world boots, keeps every player and is converted by the boot save; DB_STORE_PIECES=0 converts it
//    back, and a 59eaefba server then starts on it with every player; a 59eaefba server on the pieces layout refuses to start.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const WebSocket = require('ws');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const HOOK = path.join(__dirname, 'helpers', 'write-count-hook.cjs');
const clone = o => JSON.parse(JSON.stringify(o));
const man = f => JSON.parse(fs.readFileSync(f, 'utf8'));

function oldStore() {   // the 59eaefba world-store module, for the rollback checks
  const src = execFileSync('git', ['show', R.CONTROL_SHA + ':server/world-store.js'], { cwd: R.root });
  const f = path.join(os.tmpdir(), 'world-store-' + R.CONTROL_SHA + '-' + process.pid + '.js'); fs.writeFileSync(f, src); return require(f);
}

function unit() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-pieces-')), file = path.join(temp, 'db.json');
  const db = { users: {}, byName: {}, tokens: { t1: { id: 'u1' } }, seeded: true, chat: { world: [], region: [] }, guilds: { g1: { name: 'G', log: [] } },
    feedback: Array.from({ length: 300 }, (_, i) => ({ id: 'f' + i, text: 'x'.repeat(200) })), reports: [], idem: {} };
  for (let i = 0; i < 200; i++) { const id = 'u' + i; db.users[id] = { id, name: 'P' + i, gold: i }; db.idem[id + ':x:1'] = { t: 1, resp: { ok: true } }; }
  db.idem['sys:tick'] = { t: 1, resp: { ok: true } };
  const st = WS.create(file, { split: true, verify: true });
  st.write(db, null);
  const m0 = man(file), pf = Object.keys(m0.pieces).sort();
  R.ok(m0.layout === WS.LAYOUT && m0.shards === null && Object.keys(WS.shardNamesOf(m0)).length === WS.SHARDS && JSON.stringify(pf) === JSON.stringify(['byName', 'chat', 'feedback', 'guilds', 'idem', 'reports', 'seeded', 'tokens']),
    'pieces layout: the manifest holds a gen for each of ' + WS.SHARDS + ' shards (shards: null) and one file per shared system (' + pf.join(',') + ')');
  R.ok(fs.statSync(file).size < 30000 && deepEq(WS.readWorld(file), db), 'the world reads back whole; the manifest is ' + fs.statSync(file).size + ' bytes');
  const files = () => new Set(fs.readdirSync(st.dir));
  // a declared chat save
  let f0 = files(); db.chat.world.push({ who: 'a', txt: 'hello' });
  st.write(db, [], ['chat']);
  let m1 = man(file), nw = [...files()].filter(f => !f0.has(f));
  R.ok(nw.length === 1 && /^p-chat-\d+\.json$/.test(nw[0]) && st.stats.lastPieces.join() === 'chat' && st.stats.lastShards === 0, 'a save that declares the chat piece writes only that file (' + nw.join(',') + ')');
  R.ok(Object.keys(m1.pieces).every(k => k === 'chat' || m1.pieces[k] === m0.pieces[k]) && !fs.existsSync(path.join(st.dir, m0.pieces.chat)), 'the other pieces keep their files; the superseded chat file is removed');
  // an undeclared partial save: compares, writes only what differs
  f0 = files(); db.guilds.g1.log.push({ tx: 'hi' }); db.users.u5.gold = 55;
  st.write(db, ['u5']);
  nw = [...files()].filter(f => !f0.has(f));
  R.ok(nw.length === 2 && nw.some(f => /^p-guilds-/.test(f)) && nw.some(f => f === WS.shardOf('u5') + '-' + man(file).gen + '.json'), 'an undeclared save compares every piece and writes only the changed one (+ the player shard): ' + nw.join(','));
  // a full save of an unchanged shared world writes no piece
  st.write(db, null);
  R.ok(st.stats.lastPieces.length === 0 && st.stats.lastShards === WS.SHARDS, 'a full save of an unchanged shared world writes all shards and no piece');
  // the verifier: a piece changed outside a declared save
  db.tokens.t2 = { id: 'u2' }; db.chat.world.push({ who: 'b', txt: 'x' });
  st.write(db, [], ['chat']);
  R.ok(st.stats.undeclaredPieces === 1 && st.stats.undeclaredPieceNames.join() === 'tokens' && !WS.readWorld(file).tokens.t2, 'verifier: a piece changed outside the declared save is counted (tokens) and waits');
  st.write(db, []);
  R.ok(WS.readWorld(file).tokens.t2 && st.stats.lastPieces.join() === 'tokens', 'the next undeclared save writes it');
  // a system that leaves the world
  delete db.reports; st.write(db, []);
  R.ok(!man(file).pieces.reports && ![...files()].some(f => /^p-reports-/.test(f)) && WS.readWorld(file).reports === undefined, 'a removed system loses its piece file');
  db.reports = [];
  // failures at every file: the committed world is kept exactly
  const before = JSON.stringify(WS.readWorld(file));
  db.chat.world.push({ who: 'c', txt: 'y' }); db.guilds.g1.log.push({ tx: 'z' }); db.users.u7.gold = 1;
  const realW = fs.writeFileSync, realR = fs.renameSync; let fails = 0;
  for (const at of [1, 2, 3, 4, 5]) { let n = 0;
    fs.writeFileSync = function (f) { if (String(f).startsWith(temp) && ++n === at) throw Error('injected write failure'); return realW.apply(this, arguments); };
    try { st.write(db, ['u7']); } catch (e) { fails++; } fs.writeFileSync = realW; }
  fs.renameSync = function () { throw Error('injected rename failure'); };
  try { st.write(db, ['u7']); } catch (e) { fails++; } fs.renameSync = realR;
  R.ok(fails === 6 && JSON.stringify(WS.readWorld(file)) === before, 'a save failing at the shard, a piece, the manifest or the swap leaves the committed world exactly (' + fails + ' failures)');
  st.write(db, ['u7']); const after = WS.readWorld(file), mm = man(file), named = new Set([...Object.values(WS.shardNamesOf(mm)), ...Object.values(mm.pieces)]);
  R.ok(after.users.u7.gold === 1 && after.chat.world.length === 3 && after.guilds.g1.log.length === 2 && fs.readdirSync(st.dir).every(f => named.has(f)), 'the next save commits normally and the failed saves left no files');
  fs.writeFileSync(path.join(st.dir, 'p-chat-999999.json'), '{}'); fs.writeFileSync(path.join(st.dir, '3-999999.json'), '{}');
  const st2 = WS.create(file, { split: true }); st2.load();
  R.ok(st2.sweepOrphans() === 2, 'leftover piece and shard files no manifest names are swept at boot');
  const victim = path.join(st.dir, man(file).pieces.guilds); fs.renameSync(victim, victim + '.away');
  let code = null; try { WS.readWorld(file); } catch (e) { code = e.code; } fs.renameSync(victim + '.away', victim);
  R.ok(code === 'SHARD_MISSING', 'a missing piece file refuses to load');
  // old formats load and migrate
  const one = path.join(temp, 'one.json'); fs.writeFileSync(one, JSON.stringify(clone(db)));
  const s1 = WS.create(one, { split: true }); const w1 = s1.load(); R.ok(s1.layoutMismatch && s1.layout === 'file', 'a one-file world loads (layout file, a migration is due)');
  s1.write(w1, ['u1']); R.ok(WS.layoutOf(one) === 'pieces' && deepEq(WS.readWorld(one), db), 'its first save - even a partial one - writes the pieces layout, nothing lost');
  const v1 = path.join(temp, 'v1.json'); const s2 = WS.create(v1, { split: true, pieces: false }); s2.write(clone(db), null);
  R.ok(WS.layoutOf(v1) === 'split-v1', 'a split-v1 world (pieces: false)');
  const s3 = WS.create(v1, { split: true }); const w3 = s3.load(); R.ok(s3.layoutMismatch && deepEq(w3, db), 'loads in a pieces server whole');
  s3.write(w3, []); R.ok(WS.layoutOf(v1) === 'pieces' && deepEq(WS.readWorld(v1), db), 'and its first save migrates it to pieces');
  WS.writeWorld(v1, Object.assign(WS.readWorld(v1), { seeded: 'tool' }));
  R.ok(WS.layoutOf(v1) === 'pieces' && WS.readWorld(v1).seeded === 'tool', 'writeWorld (setpass, restores) keeps the pieces layout');
  // rollback
  const OLD = oldStore();
  let refused = null; try { OLD.readWorld(v1); } catch (e) { refused = e.code; }
  R.ok(refused === 'SHARD_MISSING', R.CONTROL_SHA + ' world-store refuses the pieces layout (' + refused + ') - pre-v1127 code never runs a world without its players');
  execFileSync(process.execPath, [path.join(R.root, 'server/world-store.js'), 'downgrade', v1]);
  R.ok(WS.layoutOf(v1) === 'split-v1' && deepEq(OLD.readWorld(v1), WS.readWorld(v1)) && Object.keys(OLD.readWorld(v1).users).length === 200 && OLD.readWorld(v1).seeded === 'tool' && !fs.readdirSync(v1 + '.d').some(f => /^p-/.test(f)),
    'rollback: `world-store.js downgrade` writes split-v1, which the ' + R.CONTROL_SHA + ' world-store reads whole; the piece files are gone');
}
function deepEq(a, b) { try { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); return true; } catch (e) { return false; } }

function writes(log, from) { const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).slice(from) : []; return lines.map(l => { const [b, f] = l.split('\t'); return { b: +b, f }; }); }
const nWrites = log => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).length : 0;
function sock(S, p, ip) { return new Promise((res, rej) => { const ws = new WebSocket('ws://127.0.0.1:' + S.port, { headers: { 'x-forwarded-for': ip } }); const s = { ws, inbox: [] };
  ws.on('message', d => { try { s.inbox.push(JSON.parse(d.toString())); } catch (_) {} }); s.send = o => ws.send(JSON.stringify(Object.assign({ token: p.token }, o)));
  ws.on('open', () => { s.send({ t: 'chatjoin', name: p.name }); res(s); }); ws.on('error', rej); }); }

// one world chat line on a world whose shared part is ~300 KB: what does the save write?
async function chatSave(dir, check) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-pieces-srv-')), log = path.join(temp, 'writes.log');
  const S = await R.server({ dir, temp, nodeArgs: ['-r', HOOK], env: { DB_STORE_VERIFY: '1', CHAT_SAVE_MS: '300', WRITE_LOG: log, DB_STORE_JOURNAL: '0' } });   // v1128: this test is the v1127 pieces layout
  try {
    const B = await R.boot(S, 'wp', 2, { world: false });
    await S.kill(); const w = WS.readWorld(S.db); w.feedback = Array.from({ length: 1500 }, (_, i) => ({ id: 'FB-x' + i, kind: 'bug', text: 'y'.repeat(180), t: 1 })); WS.writeWorld(S.db, w);
    await S.start(B.adminId); await R.sleep(1500);
    const s0 = (await B.stat()).store, at = nWrites(log), m0 = man(S.db);
    const so = await sock(S, B.players[0], '10.95.0.1'); await R.sleep(200);
    so.send({ t: 'chat', channel: 'world', text: 'one line' });
    for (let i = 0; i < 80; i++) { await R.sleep(500); const s = (await B.stat()).store; if (s.partial + s.full > s0.partial + s0.full) break; }   // 59eaefba saves chat after 30 s
    await R.sleep(500); so.ws.terminate();
    const s1 = (await B.stat()).store, wr = writes(log, at), bytes = wr.reduce((x, y) => x + y.b, 0), m1 = man(S.db);
    const coreKB = JSON.stringify(Object.assign({}, WS.readWorld(S.db), { users: undefined })).length / 1024;
    check(s1.partial - s0.partial === 1 && s1.full === s0.full, 'one chat line: one partial save (' + (s1.partial - s0.partial) + ' partial, ' + (s1.full - s0.full) + ' full)');
    check(wr.length === 2 && wr.some(x => /^p-chat-/.test(x.f)) && wr.some(x => x.f === 'db.json.store.tmp') && bytes < 20000,
      'one chat line writes the chat piece + the manifest only: ' + wr.map(x => x.f + ' ' + x.b + ' B').join(', ') + ' = ' + (bytes / 1024).toFixed(1) + ' KB while the shared world is ' + coreKB.toFixed(0) + ' KB');
    check(m1.pieces && Object.keys(m1.pieces).every(k => k === 'chat' || m1.pieces[k] === m0.pieces[k]) && JSON.stringify(m1.shardGens) === JSON.stringify(m0.shardGens), 'no shard and no other piece changed');
    check(((WS.readWorld(S.db).chat || {}).world || []).some(x => x.txt === 'one line') && s1.undeclaredPieces === 0, 'the line is on disk; the verifier saw no undeclared piece');
    return { bytes, coreKB };
  } finally { await S.kill(); }
}

// the rolling sweep: no full save, the whole world rewritten slice by slice within DB_STORE_SWEEP_MS
async function rollingSweep(check) {
  const S = await R.server({ env: { DB_STORE_SWEEP_MS: '3200', CHAT_SAVE_MS: '200', DB_STORE_JOURNAL: '0' } });
  try {
    const B = await R.boot(S, 'rs', 1, { world: false });
    await S.kill(); await S.start(B.adminId); await R.sleep(1500);
    const s0 = (await B.stat()).store, m0 = man(S.db), so = await sock(S, B.players[0], '10.97.0.1'); await R.sleep(200);
    const t0 = Date.now(); let n = 0; while (Date.now() - t0 < 4500) { so.send({ t: 'chat', channel: 'world', text: 'sweep ' + (n++) }); await R.sleep(1800); }
    so.ws.terminate(); await R.sleep(500);
    const s1 = (await B.stat()).store, m1 = man(S.db), changed = m1.shardGens.filter((g, k) => g !== m0.shardGens[k]).length;
    check(s1.full === s0.full && s1.slices - s0.slices >= 2, 'rolling sweep: ' + (s1.slices - s0.slices) + ' slice saves, no full save (' + (s1.full - s0.full) + ')');
    check(s1.sweepLooked - s0.sweepLooked <= (s1.slices - s0.slices) * 2 && changed <= 4, 'the slices looked only at shards holding a dirty player (v1128: ' + (s1.sweepLooked - s0.sweepLooked) + ' shard(s) in ' + (s1.slices - s0.slices) + ' slices) and rewrote only changed ones (' + changed + ' shard files rewritten)');
  } finally { await S.kill(); }
}

// durable actions under hard kills
async function killLoop(check) {
  const S = await R.server({ env: { DB_STORE_VERIFY: '1', DB_STORE_JOURNAL: '0' } });
  try {
    const B = await R.boot(S, 'wk', 6);
    const acked = []; let round = 0;
    for (round = 0; round < 5; round++) {
      const target = await S.req('GET', '/api/world/cities?since=0&tiles=' + Array.from({ length: 25 }, (_, i) => (i % 5) + '_' + Math.floor(i / 5)).join(','), null, B.players[0].token, B.players[0].ip);
      const bots = (target.body.bots || []).slice(round * 6, round * 6 + 6);
      const jobs = B.players.map((p, i) => bots[i] ? S.req('POST', '/api/world/war/declare', { defId: bots[i].id, requestId: 'kill-' + round + '-' + i }, p.token, p.ip).then(r => { if (r.status === 200 && r.body.ok) acked.push({ p: p.id, def: bots[i].id }); }).catch(() => {}) : null).filter(Boolean);
      await R.sleep(5 + Math.floor(Math.random() * 60));
      await S.kill(); await Promise.allSettled(jobs);
      await S.start(B.adminId);
    }
    const w = WS.readWorld(S.db), lost = acked.filter(a => !((w.users[a.p] || {}).worldWars || {})[a.def]);
    check(acked.length > 0 && lost.length === 0, 'five hard kills during war declarations: all ' + acked.length + ' acknowledged declarations are on disk, the world loads each time (' + lost.length + ' lost)');
    const st = (await B.stat()).store;
    check(st.layout === 'pieces' && st.undeclaredPieces === 0, 'layout pieces, no undeclared piece');
  } finally { await S.kill(); }
}

// an old-format world boots and is converted; DB_STORE_PIECES=0 converts it back for a 59eaefba server; 59eaefba refuses pieces
async function migrateRollback(check) {
  const S = await R.server({ env: { DB_STORE_JOURNAL: '0' } });
  try {
    const B = await R.boot(S, 'wm', 3);
    await S.kill();
    execFileSync(process.execPath, [path.join(R.root, 'server/world-store.js'), 'downgrade', S.db]);
    const w0 = WS.readWorld(S.db); check(WS.layoutOf(S.db) === 'split-v1', 'setup: the world is split-v1 (as 59eaefba writes it)');
    await S.start(B.adminId); await R.sleep(1500);
    check(WS.layoutOf(S.db) === 'pieces' && deepEq(WS.readWorld(S.db).users, w0.users), 'a v1127 server boots on the split-v1 world, keeps every player and its boot save converts it to pieces');
    const lg = await S.req('POST', '/api/login', { name: 'wmP1', pass: 'password1' }, null, '10.96.0.1');
    check(lg.status === 200, 'players sign in after the migration');
    await S.kill();
    const C = await R.server({ dir: R.controlTree(), db: S.db, temp: S.temp });
    let refused = false; try { await C.start(B.adminId); } catch (e) { refused = /exited/.test(e.message); } await C.kill();
    check(refused && WS.layoutOf(S.db) === 'pieces' && deepEq(WS.readWorld(S.db).users, w0.users), R.CONTROL_SHA + ' refuses to start on the pieces layout and leaves it untouched');
    await S.start(B.adminId, { DB_STORE_PIECES: '0' }); await R.sleep(1500); await S.kill();
    check(WS.layoutOf(S.db) === 'split-v1', 'rollback step 1: DB_STORE_PIECES=0 + one restart writes split-v1');
    const C2 = await R.server({ dir: R.controlTree(), db: S.db, temp: S.temp });
    await C2.start(B.adminId);
    const lg2 = await C2.req('POST', '/api/login', { name: 'wmP2', pass: 'password1' }, null, '10.96.0.2');
    await C2.kill();
    check(lg2.status === 200 && Object.keys(WS.readWorld(S.db).users).length === Object.keys(w0.users).length, 'rollback step 2: the ' + R.CONTROL_SHA + ' server starts on it with every player (sign-in ' + lg2.status + ')');
  } finally { await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== the store'); unit();
    if (process.env.PIECES_UNIT_ONLY) { console.log('unit only: ' + R.passed() + ' checks passed'); process.exit(0); }
    console.log('== a real server'); const mine = await chatSave(R.root, R.ok);
    await rollingSweep(R.ok);
    await killLoop(R.ok);
    await migrateRollback(R.ok);
    console.log('== control ' + R.CONTROL_SHA + ' (must fail)');
    const misses = []; let ctl = null;
    try { ctl = await chatSave(R.controlTree(), (c, m) => { if (!c) misses.push(m); }); } catch (e) { misses.push('threw: ' + e.message.slice(0, 160)); }
    misses.forEach(m => console.log('  control fails as it must: ' + m));
    R.ok(misses.length >= 1 && ctl && ctl.bytes > 300 * 1024, 'CONTROL: on ' + R.CONTROL_SHA + ' the same chat line wrote ' + (ctl ? (ctl.bytes / 1024).toFixed(0) : '?') + ' KB (this tree: ' + (mine.bytes / 1024).toFixed(1) + ' KB)');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(); }
  console.log('test_world_pieces.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
