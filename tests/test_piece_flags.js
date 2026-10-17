'use strict';
// v1134 PIECE DIRTY FLAGS (S1 copy run 12 Oct 2026 on 6bfeb24d: every save stringified all ~20 shared pieces - ~3 MB - only to compare
// them with what was last written; a third of the main thread).
// Part 1, the store (journal + pieces layouts): a world with ~3 MB of flagged pieces (tokens, feedback, watch, byName, ipAccounts):
//  - a partial save that names no pieces stringifies none of them (JSON.stringify spy, bytes counted) - the small unflagged ones only;
//  - a piece marked whole (markPiece) is written; one marked by key is written as a patch of that key only (journal) - both read back;
//  - a change nobody marked is NOT written by a normal save, but the sweep audit finds it within one round of the flagged pieces,
//    writes it and counts it (pieceMissed); DB_STORE_VERIFY counts it too;
//  - flagged:[] (DB_STORE_PIECE_COMPARE=1) compares every piece again.
// Part 2, a real server (journal, io worker; then DB_STORE_VERIFY=1) on a world with ~3 MB of tokens + feedback: sign-ins, a guest, a logout,
//   a chat-free feedback report, a watch report, cloud saves - every change is on disk after a hard kill, no piece was changed outside
//   a mark (verify 0, audit 0), and a cloud save's main-thread save time stays small.
// CONTROL f2043269 (claude/save-ship before v1134): its store stringifies every flagged piece on such a save (part 1) and its server
//   spends tens of ms of main thread per cloud save on the same world (part 2).
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const CONTROL = 'f2043269';
const clone = o => JSON.parse(JSON.stringify(o));

function world(nUsers) {
  const db = { users: {}, byName: {}, tokens: {}, seeded: true, chat: { world: [{ t: 1, who: 'a', text: 'hi' }] }, guilds: {}, idem: {}, feedback: [], reports: [], watch: {}, ipAccounts: {}, devices: {}, guestByDevice: {} };
  for (let i = 0; i < nUsers; i++) { const id = 'p' + i; db.users[id] = { id, name: 'P' + i, gold: i, led: { x: 'h'.repeat(300) } }; db.byName['p' + i] = id; }
  for (let i = 0; i < 12000; i++) db.tokens['t'.repeat(40) + i] = { id: 'p' + (i % nUsers), iat: 1, exp: 9e15 };
  for (let i = 0; i < 2500; i++) db.feedback.push({ id: 'FB-' + i, userId: 'p' + (i % nUsers), kind: 'bug', text: 'x'.repeat(260), t: i, received: false });
  for (let i = 0; i < 1500; i++) db.watch['p' + i] = { id: 'p' + i, name: 'P' + i, attacks: [{ t: 1, target: 'q', won: true }], defends: [], scouts: [], t: 1 };
  for (let i = 0; i < 3000; i++) db.ipAccounts['10.0.' + (i >> 8) + '.' + (i & 255)] = [1, 2, 3];
  return db;
}
function spyStringify(fn) {   // bytes JSON.stringify produced while fn ran
  const orig = JSON.stringify; let bytes = 0;
  JSON.stringify = function (...a) { const s = orig.apply(this, a); if (typeof s === 'string') bytes += s.length; return s; };
  try { fn(); } finally { JSON.stringify = orig; }
  return bytes;
}
function unit(WSX, journal, check, opts) {
  const tag = (journal ? 'journal' : 'pieces') + (opts && opts.flagged ? ' flagged:[]' : '') + ': ';
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-pflag-')), file = path.join(temp, 'db.json');
  const db = world(2000), st = WSX.create(file, Object.assign({ split: true, journal, io: 'sync' }, opts || {}));
  st.write(db, null);
  const flaggedBytes = ['tokens', 'feedback', 'watch', 'byName', 'ipAccounts'].reduce((n, k) => n + JSON.stringify(db[k]).length, 0);
  db.users.p5.gold = 55;
  const b1 = spyStringify(() => st.write(db, ['p5']));   // a play save: one player, pieces not named
  const out = { b1, flaggedBytes };
  check(b1 < 60000, tag + 'a save naming one player and no pieces stringified ' + b1 + ' B (flagged pieces hold ' + flaggedBytes + ' B)');
  if (!st.markPiece) return out;
  // a whole mark
  db.feedback.push({ id: 'FB-new', kind: 'bug', text: 'new', t: 9 }); st.markPiece('feedback');
  st.write(db, ['p6']);
  // a key mark (journal: a patch of that key)
  db.tokens['newtok'] = { id: 'p7', iat: 2, exp: 9e15 }; delete db.tokens['t'.repeat(40) + '3']; st.markPiece('tokens', 'newtok'); st.markPiece('tokens', 't'.repeat(40) + '3');
  db.watch.p9 = { id: 'p9', name: 'P9', attacks: [], defends: [], scouts: [], t: 99 }; st.markPiece('watch', 'p9');
  const before = st.stats.bytes.journal || 0;
  st.write(db, ['p7']);
  const lineBytes = (st.stats.bytes.journal || 0) - before;
  if (journal) check(lineBytes < 2000, tag + 'two tokens + one watch entry marked by key: the save wrote ' + lineBytes + ' B (a patch of those keys, not the 1+ MB pieces)');
  let back = WSX.readWorld(file);
  check(back.feedback.some(f => f.id === 'FB-new') && back.tokens.newtok && !back.tokens['t'.repeat(40) + '3'] && back.watch.p9.t === 99 && back.users.p5.gold === 55,
    tag + 'the marked changes (feedback whole, two tokens and one watch entry by key) are on disk');
  // a change nobody marked
  db.ipAccounts['9.9.9.9'] = [7];
  st.write(db, ['p8']);
  check(!WSX.readWorld(file).ipAccounts['9.9.9.9'], tag + 'a change nobody marked is not written by a normal save (nothing looked at it)');
  const m0 = st.stats.pieceMissed;
  for (let i = 0; i < 9; i++) st.write(db, [], null, { slice: i % 16, of: 16 });   // sweep slices: one flagged piece audited each
  back = WSX.readWorld(file);
  check(back.ipAccounts['9.9.9.9'] && st.stats.pieceMissed === m0 + 1 && st.stats.pieceMissedNames.includes('ipAccounts'),
    tag + 'the sweep audit found it within one round of the flagged pieces, wrote it and counted it (pieceMissed +' + (st.stats.pieceMissed - m0) + ': ' + st.stats.pieceMissedNames.join(',') + ')');
  check(JSON.stringify(back.tokens) === JSON.stringify(db.tokens) && JSON.stringify(back.watch) === JSON.stringify(db.watch) && JSON.stringify(back.feedback) === JSON.stringify(db.feedback),
    tag + 'tokens, watch and feedback on disk equal the world in memory, byte for byte');
  if (journal) {
    // v1134 receipt index: a save finds its players' receipts without walking every receipt of the world
    for (let i = 0; i < 30000; i++) db.idem['p' + (i % 2000) + ':r:' + i] = { t: 1, resp: { ok: true } };
    st.write(db, [], null, { slice: 0, of: 16 });   // slice 0 walks the table once (these 30,000 are not noted)
    const sc0 = st.stats.receiptScans | 0;
    db.idem['p20:new:1'] = { t: 2, resp: { ok: 'noted' } }; st.noteReceipt('p20:new:1'); db.users.p20.gold = 2020;
    db.idem['p21:new:1'] = { t: 2, resp: { ok: 'unnoted' } }; db.users.p21.gold = 2121;
    const t0 = process.hrtime.bigint(); st.write(db, ['p20', 'p21']); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    let rb = WSX.readWorld(file);
    check((st.stats.receiptScans | 0) === sc0 && rb.idem['p20:new:1'] && rb.users.p21.gold === 2121 && !rb.idem['p21:new:1'] && ms < 50,
      tag + 'a save of 2 players on 32,000 receipts walked none of them (' + ms.toFixed(1) + ' ms): the noted receipt is on disk, an unnoted one waits');
    st.write(db, [], null, { slice: 0, of: 16 }); rb = WSX.readWorld(file);
    check(!rb.idem['p21:new:1'] && (st.stats.receiptScans | 0) === sc0 + 1, tag + 'slice 0 walks the table again (the unnoted receipt of a player nobody saved still waits for its player)');
    db.users.p21.gold = 2122; st.write(db, ['p21']); rb = WSX.readWorld(file);
    check(rb.idem['p21:new:1'] && rb.users.p21.gold === 2122, tag + 'the walk indexed it: the next save of that player writes the unnoted receipt');
    delete db.idem['p20:new:1']; st.write(db, ['p20']); rb = WSX.readWorld(file);
    check(!rb.idem['p20:new:1'], tag + 'a pruned receipt of a saved player is written as gone');
    db.idem = Object.assign({}, db.idem, { 'p22:swap:1': { t: 3, resp: {} } }); st.write(db, ['p22']); rb = WSX.readWorld(file);
    check(rb.idem['p22:swap:1'], tag + 'a replaced receipt table is walked (its new receipt is on disk)');
    const sv = WSX.create(file, { split: true, journal: true, verify: true, io: 'sync' }), d2 = sv.load();
    d2.watch.p10.t = 1234; sv.write(d2, ['p11']);
    check(sv.stats.undeclaredPieces === 1 && sv.stats.undeclaredPieceNames.includes('watch'), 'journal: DB_STORE_VERIFY=1 counts an unmarked change to a flagged piece (' + sv.stats.undeclaredPieceNames.join(',') + ')');
    const sv2 = WSX.create(file, { split: true, journal: true, verify: true, io: 'sync' }), d3 = sv2.load();
    d3.tokens.k2 = { id: 'p1', iat: 3, exp: 9e15 }; sv2.markPiece('tokens', 'k2'); sv2.write(d3, ['p12']); d3.users.p12.gold = 3; sv2.write(d3, ['p12']);
    check(sv2.stats.undeclaredPieces === 0, 'journal: after a key patch the verifier sees the piece as written (0 undeclared)');
  }
  return out;
}

async function serverPart(dir, tag, check) {
  const S = await R.server({ dir, env: { DB_STORE_SWEEP_MS: '16000', RL_MUL: '1000', ALLOW_NEW_GUESTS: '1' /* v1181: new guests are off by default since v1144 */ } });
  const B = await R.boot(S, tag, 4, { world: false });
  await S.kill();
  const w = WS.readWorld(S.db);   // ~3 MB of shared pieces, as Server 1
  for (let i = 0; i < 20000; i++) w.tokens['f'.repeat(30) + i] = { id: B.players[i % 4].id, iat: 1, exp: 9e15 };
  w.feedback = w.feedback || []; for (let i = 0; i < 3000; i++) w.feedback.push({ id: 'FB-x' + i, userId: B.players[0].id, kind: 'bug', text: 'y'.repeat(300), t: i, received: false });
  WS.writeWorld(S.db, w);
  await S.start(B.adminId); await R.sleep(1500);
  try {
    const [p0, p1, p2, p3] = B.players, st0 = (await B.stat()).store;
    for (let i = 0; i < 20; i++) { const r = await S.req('POST', '/api/save', { team: [{ key: 'vael' }], wall: [{ key: 'vael' }] }, p0.token, p0.ip); if (r.status !== 200) throw Error('save ' + JSON.stringify(r.body)); }
    await R.sleep(800);
    const st1 = (await B.stat()).store, saves = st1.partial - st0.partial, mainMs = st1.mainMs - st0.mainMs;
    check(saves >= 5 && mainMs / saves < 8, '20 cloud saves: ' + saves + ' partial saves, ' + (mainMs / saves).toFixed(1) + ' ms of main thread each on a world with ~' + (JSON.stringify(w.tokens).length + JSON.stringify(w.feedback).length >> 20) + ' MB of tokens + feedback');
    if (tag === 'pc') return { msPerSave: mainMs / saves };
    await S.kill(); await S.start(B.adminId, { DB_STORE_VERIFY: '1' }); await R.sleep(1500);   // the same world, now with the verifier on
    // sign-ins, logout, a guest, a feedback report, a watch report
    const li = await S.req('POST', '/api/login', { name: p1.name, pass: 'password1' }, null, p1.ip);
    const lo = await S.req('POST', '/api/logout', null, li.body.token, p1.ip);
    const g = await S.req('POST', '/api/guest', { deviceId: 'dev-' + tag + '-1' }, null, '10.70.0.9');
    const fb = await S.req('POST', '/api/report', { text: 'the bridge is broken', kind: 'bug' }, p2.token, p2.ip);
    const wr = await S.req('POST', '/api/watch/report', { attacks: [{ name: 'Northgate', eta: 5 }], defends: [], scouts: [] }, p3.token, p3.ip);
    const bad = await S.req('POST', '/api/login', { name: p2.name, pass: 'wrong-pass' }, null, '10.70.0.10');
    check(li.body.token && lo.body.ok && g.body.token && fb.body.ok && (wr.body.ok || wr.status === 200) && bad.status === 401, 'sign-in, logout, guest, feedback report, watch report, a wrong password answered');
    await R.sleep(2500);   // the debounced saves and two sweep slices
    const st2 = (await B.stat()).store;
    check(st2.undeclaredPieces === 0 && st2.pieceMissed === 0, 'no shared piece changed without a mark (verify ' + st2.undeclaredPieces + ' ' + (st2.undeclaredPieceNames || []).join(',') + ', audit ' + st2.pieceMissed + ' ' + (st2.pieceMissedNames || []).join(',') + ')');
    await S.kill();
    const back = WS.readWorld(S.db), tk = require('node:crypto').createHash('sha256');
    const hash = t => require('node:crypto').createHash('sha256').update(String(t)).digest('hex');
    check(!back.tokens[hash(li.body.token)] && back.tokens[hash(g.body.token)] && back.users[g.body.profile.id] && back.byName[g.body.profile.name.toLowerCase()] === g.body.profile.id
      && Object.values(back.guestByDevice || {}).includes(g.body.profile.id) && back.feedback.some(f => f.text === 'the bridge is broken') && back.watch[p3.id] && back.watch[p3.id].attacks[0].name === 'Northgate'
      && back.users[p2.id].loginFails, 'after a hard kill: the logout dropped its token, the guest (player, token, name, device) is there, the feedback item, the watch entry and the lockout counter too');
    return { msPerSave: mainMs / saves };
  } finally { await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== the store, journal layout'); unit(WS, true, R.ok);
    console.log('== the store, pieces layout'); unit(WS, false, R.ok);
    console.log('== flagged:[] (DB_STORE_PIECE_COMPARE=1)');
    { const r = unit(WS, true, () => {}, { flagged: [] }); R.ok(r.b1 > r.flaggedBytes, 'flagged:[] compares every piece again (' + r.b1 + ' B stringified for one player)'); }
    console.log('== a real server'); const mine = await serverPart(R.root, 'pf', R.ok);
    console.log('== control ' + CONTROL + ' (must fail)');
    const dir = R.controlTree(CONTROL), misses = [];
    const WC = require(path.join(dir, 'server', 'world-store.js'));
    const cj = unit(WC, true, (c, m) => { if (!c) misses.push(m); });
    let cs = null; try { cs = await serverPart(dir, 'pc', (c, m) => { if (!c) misses.push(m); }); } catch (e) { misses.push('threw: ' + e.message.slice(0, 160)); }
    misses.forEach(m => console.log('  control fails as it must: ' + m));
    R.ok(misses.length >= 2 && cj.b1 > cj.flaggedBytes && cs && cs.msPerSave > 3 * mine.msPerSave,
      'CONTROL: ' + CONTROL + ' stringified ' + cj.b1 + ' B for a one-player save (all ' + cj.flaggedBytes + ' B of flagged pieces) and spent ' + (cs ? cs.msPerSave.toFixed(1) : '?') + ' ms a cloud save (this tree ' + mine.msPerSave.toFixed(1) + ' ms)');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(CONTROL); }
  console.log('test_piece_flags.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
