'use strict';
// v1185: the v1183 WORLD-LOAD GUARD kept in the save-ship layouts (pieces, journal). The guard's own test (test_world_load_guard_1183)
// runs on this tree too; this one covers what only the new layouts have:
//   1. durable commits: every manifest swap is preceded by a flush of the files it names (one flushBatch) and followed by an fsync
//      of its folder; every journal line is fsynced before the save returns - sync io and the io worker, journal and pieces;
//   2. the .m copy: after every save exactly one manifest copy, the current one, byte-equal to the world file;
//   3. recover from the .m copy (exact) on a journal world with checkpoints;
//   4. recover with NO manifest and NO .m (shard / piece / journal files alone) after several checkpoints, with an already-folded
//      journal left lying in .d - the rebuilt world equals the real one field by field (the folded journal is not applied twice);
//   5. a pieces world with no manifest copy is rebuilt the same way.
// CONTROL: the v1185 tree minus the guard (claude/save-ship-v1181 5a16c572's world-store / store-io / store-journal) makes no flush
// before its manifest swaps and keeps no .m copy - checks 1 and 2 fail there.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const R = require('./helpers/split-rig.cjs');
const CONTROL = '5a16c572';
const clone = o => JSON.parse(JSON.stringify(o));
const deepEq = (a, b) => { try { assert.deepStrictEqual(clone(a), clone(b)); return true; } catch (e) { return false; } };

// a store from `root` with world-safety's flush / fsync calls and the world-file renames recorded in order
function instrument(root) {
  let SAFE = null; try { SAFE = require(path.join(root, 'server/world-safety.js')); } catch (e) {}   // the control tree has none
  const ev = [];
  if (SAFE && SAFE.flushBatch) { const f = SAFE.flushBatch, d = SAFE.fsyncDir, ff = SAFE.fsyncFile;
    SAFE.flushBatch = (...a) => { ev.push('flush'); return f(...a); }; SAFE.fsyncDir = (...a) => { ev.push('fsyncDir'); return d(...a); }; SAFE.fsyncFile = (p) => { ev.push('fsyncFile:' + path.basename(p)); return ff(p); }; }
  const ren = fs.renameSync; fs.renameSync = (a, b) => { ev.push('rename:' + path.basename(b)); return ren(a, b); };
  const folded = [], unl = fs.unlinkSync; fs.unlinkSync = p => { if (/^j-\d+\.log$/.test(path.basename(String(p)))) { try { const s = fs.readFileSync(p); if (s.length) folded.push({ f: path.basename(p), s }); } catch (e) {} } return unl(p); };   // a journal the engine removes after folding it
  const restore = () => { fs.renameSync = ren; fs.unlinkSync = unl; };
  return { WS: require(path.join(root, 'server/world-store.js')), ev, restore, folded };
}
function world(n) {
  const db = { users: {}, byName: {}, tokens: { t1: { id: 'u1' } }, chat: { world: [] }, idem: { 'sys:x': { t: 1 } }, guilds: { g1: { name: 'G', log: [] } } };
  for (let i = 0; i < n; i++) { const id = 'u' + i; db.users[id] = { id, name: 'P' + i, gold: i, led: { hero: 'h'.repeat(900), txs: [] } }; db.byName['p' + i] = id; db.idem[id + ':a:1'] = { t: 1, n: i }; }
  return db;
}
function mutate(db, round) {   // players, a receipt, a shared piece, a deletion
  const ids = [];
  for (let k = 0; k < 40; k++) { const id = 'u' + ((round * 37 + k * 11) % 300); const u = db.users[id]; if (!u) continue; u.gold += round; u.led.txs.push({ r: round, k }); ids.push(id); db.idem[id + ':r:' + round + ':' + k] = { t: round }; }
  db.chat.world.push({ t: round, s: 'line ' + round }); db.guilds.g1.log.push(round);
  if (round === 3) { delete db.users['u299']; ids.push('u299'); }
  return ids;
}
const copyDir = (a, b) => fs.cpSync(a, b, { recursive: true });

(async () => {
  let failed = false; const ok = R.ok;
  try {
    process.env.DB_STORE_CKPT_BYTES = '4096'; process.env.DB_STORE_CKPT_MS = '1000'; process.env.DB_FSYNC = '1';
    for (const layout of ['journal', 'pieces']) {
      const I = instrument(R.root), WS = I.WS, SAFE = require(path.join(R.root, 'server/world-safety.js'));
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-guard1185-')), file = path.join(temp, 'emberweave-db.json');
      const db = world(300), st = WS.create(file, { split: true, pieces: true, journal: layout === 'journal', io: 'sync' });
      st.write(db, null);
      let lingering = null;
      for (let round = 1; round <= 6; round++) {
        I.ev.length = 0;
        const ids = mutate(db, round); st.write(db, ids, ['chat', 'guilds', 'idem']);
        if (layout === 'journal') { await R.sleep(1100); st.write(db, [ids[0]], ['chat']); }   // a due checkpoint folds the journal (sync io: right here)
        // 1. every swap of the world file: a flush before it and a folder fsync after it; journal lines fsynced
        const ev = I.ev, swaps = ev.map((e, i) => e === 'rename:' + path.basename(file) ? i : -1).filter(i => i >= 0);
        const goodSwaps = swaps.every(i => ev.slice(0, i).lastIndexOf('flush') > ev.slice(0, i).lastIndexOf('rename:' + path.basename(file)) && ev[i + 1] === 'fsyncDir');
        const jsync = layout !== 'journal' || ev.some(e => /^fsyncFile:j-\d+\.log$/.test(e));
        if (round === 1 || round === 6) ok(swaps.length > 0 && goodSwaps && jsync, layout + ' round ' + round + ': ' + swaps.length + ' manifest swap(s), each after a flush and followed by a folder fsync' + (layout === 'journal' ? '; the journal line fsynced' : '') + ' (' + ev.filter(e => !/^rename:(?!emberweave)/.test(e)).slice(0, 8).join(' ') + ')');
        else if (!(swaps.length > 0 && goodSwaps && jsync)) ok(false, layout + ' round ' + round + ': a swap without flush / fsync: ' + ev.join(' '));
        // 2. exactly one manifest copy, the current one
        const copies = fs.existsSync(file + '.m') ? fs.readdirSync(file + '.m') : [];
        const man = fs.readFileSync(file, 'utf8'), gen = JSON.parse(man).gen;
        const copyOk = copies.length === 1 && copies[0] === 'manifest-' + gen + '.json' && fs.readFileSync(path.join(file + '.m', copies[0]), 'utf8') === man;
        if (round === 1 || round === 6 || !copyOk) ok(copyOk, layout + ' round ' + round + ': one manifest copy, the current one (' + copies.join(',') + ' vs gen ' + gen + ')');
      }
      if (layout === 'journal') lingering = I.folded.slice(0, 2);
      // the last saves stay in the journal: a store with no checkpoint due (big thresholds) - recover must apply them
      process.env.DB_STORE_CKPT_BYTES = '1000000000'; process.env.DB_STORE_CKPT_MS = '100000000';
      const st2 = WS.create(file, { split: true, pieces: true, journal: layout === 'journal', io: 'sync' }); st2.load();
      for (const r of [7, 8]) st2.write(db, mutate(db, r), ['chat', 'guilds', 'idem']);
      process.env.DB_STORE_CKPT_BYTES = '4096'; process.env.DB_STORE_CKPT_MS = '1000';
      I.restore();
      const truth = WS.readWorld(file);
      ok(deepEq(truth.users, db.users) && deepEq(truth.chat, db.chat), layout + ': the world on disk = the world in memory (' + Object.keys(truth.users).length + ' players)');
      if (layout === 'journal') { const n = st.stats.io && st.stats.io.journal ? st.stats.io.journal.checkpoints : 0; ok(n >= 2, 'journal: ' + n + ' checkpoints folded the journal during the rounds'); }
      // 3. recover from the .m copy (manifest damaged: NUL bytes)
      const t3 = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-guard1185-r3-')), f3 = path.join(t3, 'emberweave-db.json');
      copyDir(temp, t3); fs.writeFileSync(f3, Buffer.alloc(fs.statSync(file).size));
      const dry = SAFE.recover(f3, { returnWorld: true }), wr = SAFE.recover(f3, { write: true });
      const back = WS.readWorld(f3);
      ok(!dry.error && /manifest copy/.test(dry.source) && wr.wrote && wr.verified && deepEq(back.users, truth.users) && deepEq(back.chat, truth.chat) && deepEq(back.idem, truth.idem),
        layout + ': a NUL manifest is recovered EXACTLY from the .m copy (' + (dry.error || dry.source) + ')');
      // 4. no manifest, no .m: shard / piece / journal files alone (+ an already-folded journal left lying there)
      const t4 = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-guard1185-r4-')), f4 = path.join(t4, 'emberweave-db.json');
      copyDir(temp, t4); fs.renameSync(f4, f4 + '.gone'); fs.renameSync(f4 + '.m', f4 + '.m.gone');
      let back4 = null, r4 = null;
      if (lingering) { const now = new Set(fs.readdirSync(f4 + '.d')); const old = lingering.filter(x => !now.has(x.f)); for (const x of old) fs.writeFileSync(path.join(f4 + '.d', x.f), x.s);
        ok(old.length > 0, 'journal: ' + old.length + ' already-folded journal(s) put back beside the newer base (' + old.map(x => x.f).join(',') + ')'); }
      r4 = SAFE.recover(f4, { write: true }); if (r4.wrote) back4 = WS.readWorld(f4);
      const bad = back4 ? Object.keys(truth.users).filter(id => !deepEq(back4.users[id], truth.users[id])).concat(Object.keys(back4.users).filter(id => !truth.users[id])) : ['(no world)'];
      ok(!r4.error && r4.verified && bad.length === 0 && deepEq(back4.chat, truth.chat) && deepEq(back4.guilds, truth.guilds) && deepEq(back4.idem, truth.idem),
        layout + ': manifest AND .m gone - rebuilt from the files alone, every player / receipt / piece equal (' + (r4.error || r4.source) + (bad.length ? '; DIFFERENT: ' + bad.slice(0, 5).join(',') : '') + ')');
      ok(r4.asideDir && fs.existsSync(r4.asideDir) && fs.readdirSync(r4.asideDir).length > 0, layout + ': every old store file was moved aside, none deleted (' + (r4.asideDir ? path.basename(r4.asideDir) : '-') + ')');
      if (layout === 'journal') {   // CONTROL for 4: applying the folded journal again (the naive fold) breaks the world - the rule is needed
        const t5 = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-guard1185-c-')), f5 = path.join(t5, 'emberweave-db.json'); copyDir(t4, t5);
        const J = require(path.join(R.root, 'server/store-journal.js')), d5 = r4.asideDir.replace(t4, t5);
        const files = fs.readdirSync(d5).filter(f => /^j-\d+\.log$/.test(f)).sort((a, b) => +a.slice(2, -4) - +b.slice(2, -4));
        const f = J.foldJournals(d5, files); let diffN = 0;
        for (const [id, list] of f.units) { const base = back4.users[id] ? clone(back4.users[id]) : undefined; const u = J.applyPatches(base, list); if (!deepEq(u, truth.users[id] || null)) diffN++; }
        ok(diffN > 0, 'CONTROL: re-applying every journal on top (no per-base rule) changes ' + diffN + ' player(s) - the folded journal must be skipped');
      }
    }
    // CONTROL: the save-ship store before the guard was ported in - no flush before its swaps, no .m copy
    const ctl = R.controlTree(CONTROL), C = instrument(ctl);
    const tc = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-guard1185-ctl-')), fc = path.join(tc, 'emberweave-db.json');
    const dbc = world(50), sc = C.WS.create(fc, { split: true, pieces: true, journal: true, io: 'sync' }); sc.write(dbc, null); C.ev.length = 0; sc.write(dbc, mutate(dbc, 1));
    C.restore();
    ok(!C.ev.includes('flush') && !fs.existsSync(fc + '.m'), 'CONTROL ' + CONTROL + ': no flush before the swap and no manifest copy (' + C.ev.slice(0, 6).join(' ') + ')');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { try { R.removeControlTree(CONTROL); } catch (e) {} }
  console.log('test_world_guard_layouts_1185.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
