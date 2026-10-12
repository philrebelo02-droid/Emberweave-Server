'use strict';
// v1128 DIRTY TRACKING (S1 copy run 12 Oct 2026: the rolling sweep stringified 1/16 of the world every 1.9 s to find the few players
// whose presence changed).
// Part 1, the store: on a 2,000-player world a sweep writes exactly the players marked dirty (touch) - every other player is never
// stringified (a toJSON spy counts it); a pruned receipt of a touched player is written as gone; a change nobody declared or touched
// is not written by the sweep but the verifier (DB_STORE_VERIFY) counts it; the pieces layout's sweep looks only at the shards of
// dirty players.
// Part 2, a real server on a 3,000-player world: five players only read (GET /api/profile - presence) and nothing else saves: their
// presence reaches disk within ~2 s and the sweep looked at those five players only.
// CONTROL c9f40cd8: presence never reaches disk while nothing else saves, and its sweep stringifies whole slices of clean shards.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const CONTROL = 'c9f40cd8';
const clone = o => JSON.parse(JSON.stringify(o));
const deepEq = (a, b) => { try { assert.deepStrictEqual(clone(a), clone(b)); return true; } catch (e) { return false; } };

function world(n) {
  const db = { users: {}, byName: {}, tokens: {}, seeded: true, chat: { world: [] }, idem: {} };
  let seen = 0; const spy = () => ({ toJSON() { seen++; return 's'; } });
  for (let i = 0; i < n; i++) { const id = 'p' + i; db.users[id] = { id, name: 'P' + i, gold: i, lastSeen: 0, led: { hero: 'h'.repeat(1200) }, spy: spy() }; db.idem[id + ':a:1'] = { t: 1, resp: { ok: true } }; }
  return { db, seen: () => seen, reset: () => { seen = 0; } };
}
async function unit(journal) {
  const tag = journal ? 'journal: ' : 'pieces: ';
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-dirty-')), file = path.join(temp, 'db.json');
  const W = world(2000), db = W.db, st = WS.create(file, { split: true, journal, io: 'sync' });
  st.write(db, null);
  const sweep = () => st.write(db, [], null, { slice: 0, of: 16 });
  sweep();   // the first sweep after a full save: nothing dirty
  for (const i of [3, 77, 501, 1200, 1999]) { db.users['p' + i].lastSeen = 1000 + i; st.touch('p' + i); }
  delete db.idem['p77:a:1']; st.touch('p77');
  W.reset(); const s0 = clone(st.stats);
  sweep();
  const looked = st.stats.sweepLooked - s0.sweepLooked, stringified = W.seen();
  if (journal) R.ok(looked === 5 && stringified === 5 && st.stats.unitsWritten - s0.unitsWritten === 5, tag + 'a sweep writes exactly the 5 dirty players of 2,000: 5 looked at, 5 stringified (' + stringified + '), 5 written');
  else R.ok(looked === 5 && stringified <= 5 * 6, tag + 'a sweep looks only at the 5 shards holding the dirty players (' + looked + ' shards, ' + stringified + ' players stringified of 2,000)');
  const back = WS.readWorld(file);
  R.ok([3, 77, 501, 1200, 1999].every(i => back.users['p' + i].lastSeen === 1000 + i) && !back.idem['p77:a:1'] && back.idem['p78:a:1'], tag + 'their presence and the pruned receipt are on disk');
  db.users.p10.gold = 999;   // a change no save declares and nothing touches
  W.reset(); sweep();
  R.ok(W.seen() === 0 && WS.readWorld(file).users.p10.gold === 10, tag + 'a change nobody declared or touched is not looked at by the sweep (no player stringified)');
  if (journal) {
    const sv = WS.create(file, { split: true, journal: true, verify: true, io: 'sync' }), d2 = sv.load(); d2.users.p11.gold = 1; sv.write(d2, ['p12']);
    R.ok(sv.stats.undeclared === 1 && sv.stats.undeclaredIds.includes('p11'), tag + 'the verifier (DB_STORE_VERIFY=1) counts such a change (' + sv.stats.undeclaredIds.join(',') + ')');
  }
}

async function bigWorld(dir, tag) {
  const S = await R.server({ dir, env: { DB_STORE_SWEEP_MS: '16000' } });   // a sweep every 1 s
  const B = await R.boot(S, tag, 6, { world: false });
  await S.kill();
  const w = WS.readWorld(S.db), tpl = w.users[B.players[0].id];
  for (let i = 0; i < 3000; i++) { const id = tag + 'f' + String(i).padStart(5, '0'), u = clone(tpl); u.id = id; u.name = tag + 'Filler' + i; w.users[id] = u; w.byName[u.name.toLowerCase()] = id; }
  WS.writeWorld(S.db, w);
  await S.start(B.adminId); await R.sleep(3000);
  return { S, B };
}
async function presence(dir, tag, check) {
  const { S, B } = await bigWorld(dir, tag);
  try {
    const five = B.players.slice(1, 6), s0 = (await B.stat()).store;
    const before = WS.readWorld(S.db);
    for (const p of five) await S.req('GET', '/api/profile', null, p.token, p.ip);
    await R.sleep(2500);
    const quiet = WS.readWorld(S.db), movedQuiet = five.filter(p => (quiet.users[p.id].lastSeen || 0) > (before.users[p.id].lastSeen || 0)).length;
    // then another player saves twice a second (cloud saves): the sweeps run beside real saves
    const p0 = B.players[0], sq = await S.req('GET', '/api/profile', null, p0.token, p0.ip);
    const sm0 = (await B.stat()).store;
    for (let i = 0; i < 8; i++) { await S.req('POST', '/api/save', { team: [{ key: 'vael' }] }, p0.token, p0.ip); await R.sleep(500); }
    const sm1 = (await B.stat()).store, busyLooked = (sm1.sweepLooked || 0) - (sm0.sweepLooked || 0) + (sm1.sweepSkipped || 0) - (sm0.sweepSkipped || 0), busySlices = sm1.slices - sm0.slices;
    check(busySlices >= 2 && busyLooked <= 2 * busySlices, 'with saves running, ' + busySlices + ' sweeps looked at ' + busyLooked + ' players / shards (only dirty ones)');
    const s1 = (await B.stat()).store, after = WS.readWorld(S.db);
    const moved = movedQuiet;
    check(moved === 5, 'five players only read (presence) and nothing else saves: their presence is on disk within 2.5 s (' + moved + ' of 5)');
    const looked = (s1.sweepLooked || 0) - (s0.sweepLooked || 0), compared = (s1.sweepSkipped || 0) - (s0.sweepSkipped || 0) + looked;
    check(compared <= 12, 'the sweep looked at the dirty players only (' + compared + ' players / shards looked at, ' + (s1.slices - s0.slices) + ' sweeps; the world has 3,007 players)');
    return { moved, compared, slices: s1.slices - s0.slices, busyLooked, busySlices };
  } finally { await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== the store, journal layout'); await unit(true);
    console.log('== the store, pieces layout'); await unit(false);
    console.log('== a real server, 3,007 players'); const mine = await presence(R.root, 'dy', R.ok);
    console.log('== control ' + CONTROL + ' (must fail)');
    const misses = []; let ctl = null;
    try { ctl = await presence(R.controlTree(CONTROL), 'dc', (c, m) => { if (!c) misses.push(m); }); } catch (e) { misses.push('threw: ' + e.message.slice(0, 160)); }
    misses.forEach(m => console.log('  control fails as it must: ' + m));
    R.ok(ctl && misses.length >= 2 && ctl.moved < 5 && ctl.busyLooked >= 16 * ctl.busySlices, 'CONTROL: on ' + CONTROL + ' ' + (ctl ? ctl.moved : '?') + ' of 5 presences reached disk while nothing else saved, and with saves running ' + (ctl ? ctl.busySlices : '?') + ' sweeps stringified ' + (ctl ? ctl.busyLooked : '?') + ' shards (this tree: ' + mine.moved + ' of 5; ' + mine.busySlices + ' sweeps, ' + mine.busyLooked + ' looked at)');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(CONTROL); }
  console.log('test_save_dirty.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
