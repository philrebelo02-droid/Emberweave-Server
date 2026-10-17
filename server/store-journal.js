'use strict';
/* v1128 PER-PLAYER SAVE JOURNAL (S1 copy run 12 Oct 2026: every action rewrote a whole shard file - the player plus ~11 others,
   ~170 KB - about 87 files a second at 2,000 players; 2048 / 8192 shards cut the bytes but every save then created hundreds of
   files and Windows stalled seconds on file creation).

   The journal layout ('journal-v1') keeps the 512 shard files as a BASE and adds an append-only journal beside them:
     <DB_FILE>                 manifest {__store:'split-v1', layout:'journal-v1', gen, count, shards:null, baseGens:[gen per shard],
                               pieces:{key:file}, core:{inline}, journals:['j-<n>.log', ...]}
     <DB_FILE>.d/<s>-<g>.json  base shard s = {users, idem} as of the last checkpoint
     <DB_FILE>.d/p-<k>-<g>.json  base shared piece k
     <DB_FILE>.d/j-<n>.log     journal: one line per save, "<md5> <json>\n", json = {"u":{id:patch|null},"i":{receipt key:receipt|null},
                               "p":{key:value|null},"c":core} - a player's receipts are entries of their own, written once when they are
                               made and null when they go (a war player's ~90 receipts are not rewritten with every action); a
                               player is a patch (server/store-diff.js: the fields / keys / array elements that changed since its
                               last write; {"w":player} the first time) - patches of a player apply in the order they were written;
                               a shared piece is a patch of {"v":value} the same way (the feedback inbox: its new entries only)
   A save appends ONE line holding exactly the players (and shared pieces) it changed - one player's ~10-15 KB for one action, no
   new file, no rename, no unlink. The line is the commit: a line whose hash does not match (a crash in the middle of the append)
   ends the journal and is cut off at the next boot; every line before it is intact.

   Checkpoints run in the store io worker, a little at a time between saves: the journal is ROTATED (a new empty journal is named in
   the manifest after the old one - one small rename), then each shard the old journal touched is rebuilt from its base file plus
   the journal's latest units and written under a new name, then one manifest rename names the new base and drops the old
   journal. A crash at any point leaves a manifest whose base + journals are complete.

   A full save (boot migration, a save that names no players, recovery after a failed save) writes a whole new base and an empty
   journal, as the pieces layout's full save did.

   Pre-v1128 code reads '__store:split-v1' with shards:null and no shardGens and refuses to start (SHARD_MISSING) - it never runs on
   a base without its journal. Rollback steps: server/world-store.js header. */
const fs = require('fs'), path = require('path'), D = require('./store-diff.js');

const J_FILE = /^j-(\d+)\.log$/;
const crypto = require('crypto');
const lineHash = json => crypto.createHash('md5').update(json).digest('hex').slice(0, 16);   // native: the JS FNV loop was 16% of the io worker
const frame = json => lineHash(json) + ' ' + json + '\n';
function shardOfN(id, n) { let h = 0x811c9dc5; const s = String(id); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h % n; }   // = world-store shardOf
const ownerOf = key => { const i = String(key).indexOf(':'); return i > 0 ? key.slice(0, i) : null; };

/* the records of one journal file, in order. Stops at the first line that is not whole (a torn last append): goodBytes = where it
   starts (the boot cuts the file there before anything is appended again). */
function parseJournal(text) {
  const recs = []; let pos = 0, goodBytes = 0, torn = false;
  while (pos < text.length) {
    const nl = text.indexOf('\n', pos);
    if (nl < 0) { torn = true; break; }
    const line = text.slice(pos, nl), sp = line.indexOf(' ');
    let rec = null;
    if (sp > 0) { const json = line.slice(sp + 1); if (lineHash(json) === line.slice(0, sp)) { try { rec = JSON.parse(json); } catch (e) { rec = null; } } }
    if (!rec || typeof rec !== 'object') { torn = true; break; }
    recs.push(rec); goodBytes += Buffer.byteLength(line, 'utf8') + 1; pos = nl + 1;
  }
  return { recs, goodBytes, torn };
}
// every journal's records folded: the latest unit per player, value per piece, and the latest inline core
function foldJournals(dir, names) {
  const units = new Map(), receipts = new Map(), pieces = new Map(); let core, lines = 0, tornAt = null;
  for (const name of names) {
    let text; try { text = fs.readFileSync(path.join(dir, name), 'utf8'); }
    catch (err) { const e = Error('world store: journal ' + name + ' unreadable (' + err.message + ')'); e.code = 'SHARD_MISSING'; throw e; }
    const { recs, goodBytes, torn } = parseJournal(text);
    if (torn) tornAt = { name, goodBytes };
    for (const r of recs) { lines++;
      if (r.u) for (const id of Object.keys(r.u)) { const v = r.u[id]; let l = units.get(id); if (!l || v === null || (v && v.w !== undefined)) units.set(id, l = []); l.push(v); }   // a player's patches, in order (a whole player or null starts over)
      if (r.i) for (const k of Object.keys(r.i)) receipts.set(k, r.i[k]);
      if (r.p) for (const k of Object.keys(r.p)) { const v = r.p[k]; let l = pieces.get(k); if (!l || v === null || (v && v.w !== undefined)) pieces.set(k, l = []); l.push(v); }
      if (r.c !== undefined) core = r.c; }
  }
  return { units, receipts, pieces, core, lines, tornAt };
}
// a player as last written with its patches applied in order (null = gone)
function applyPatches(u, list) { let x = u === undefined ? null : u; for (const p of list) x = D.apply(x, p); return x; }
// a shared piece's value with its patches (of {"v":value}) applied; undefined = the piece is gone
function applyPiece(value, list) { const o = applyPatches(value === undefined ? null : { v: value }, list); return o === null ? undefined : o.v; }
// a shard object {users, idem} with players (id -> [patch, ...]) and receipts (key -> receipt|null) applied
function applyUnits(shard, users, receipts) {
  shard.users = shard.users || {}; shard.idem = shard.idem || {};
  if (users) for (const [id, list] of users) { const u = applyPatches(shard.users[id], list); if (u === null) delete shard.users[id]; else shard.users[id] = u; }
  if (receipts) for (const [k, v] of receipts) { if (v === null || v === undefined) delete shard.idem[k]; else shard.idem[k] = v; }
  return shard;
}
const emptyPend = () => ({ u: new Map(), i: new Map(), p: new Map(), c: null });
function pendFrom(f) { const p = emptyPend();
  for (const [id, l] of f.units) p.u.set(id, l.map(v => v === null ? null : JSON.stringify(v)));
  for (const [k, v] of f.receipts) p.i.set(k, v === null ? null : JSON.stringify(v));
  for (const [k, l] of f.pieces) p.p.set(k, l.map(v => v === null ? null : JSON.stringify(v)));
  if (f.core !== undefined) p.c = JSON.stringify(f.core);
  return p; }

/* ---------------- the engine: every file operation of the journal layout (in the io worker, or on the main thread with
   DB_STORE_IO=sync). All calls are synchronous; a call that throws leaves the committed state (and the manifest) untouched. ---------------- */
const SAFE = require('./world-safety.js');   // v1183 world-load guard: durable journal lines and manifests
function createEngine(o) {
  const file = o.file, dir = o.dir, SHARDS = o.shards, shardOf = o.shardOf;
  const CKPT_BYTES = Math.max(1 << 12, o.ckptBytes || 128 << 20), CKPT_MS = Math.max(1000, o.ckptMs || 10 * 60000);   // bench 12 Oct: 2 MB/s of journal under war + chat + play - a checkpoint about once a minute rewrites the touched base shards (~1.5 MB/s); boot replays at most ~128 MB
  const st = { gen: 0, baseGens: null, pieces: {}, core: '{}', journals: [], cur: null, curBytes: 0, pend: emptyPend(),
    ckpt: null, lastCkptAt: Date.now(), ckptRetryAt: 0, lazy: [], broken: false, ready: false };
  const stats = { appends: 0, appendBytes: 0, fulls: 0, rotations: 0, checkpoints: 0, ckptShards: 0, ckptMs: 0, ckptMaxStepMs: 0, ckptAborted: 0, journalBytes: 0, pendingUnits: 0, lazy: 0, truncated: 0 };
  const P = n => path.join(dir, n);
  /* v1183 (world-load guard, kept in the journal layout): the manifest gets a hard-link copy in <DB_FILE>.m (`recover` reads it),
     every file it names that this step wrote is flushed with it - ONE syncfs, not an fsync per file - BEFORE the swap, and the swap
     itself is flushed (its directory). o.sync false = DB_FSYNC=0 (dev timing runs only). */
  function manifest(m, files) {
    const tmp = file + '.store.tmp', parent = path.dirname(file), copy = 'manifest-' + m.gen + '.json';
    const s = '{"__store":"split-v1","layout":"journal-v1","gen":' + m.gen + ',"count":' + SHARDS + ',"shards":null,"baseGens":' + JSON.stringify(m.baseGens) +
      ',"pieces":' + JSON.stringify(m.pieces) + ',"core":' + m.core + ',"journals":' + JSON.stringify(m.journals) + '}';
    fs.writeFileSync(tmp, s);
    let linked = false;
    if (o.mdir) { try { fs.mkdirSync(o.mdir, { recursive: true }); try { fs.unlinkSync(path.join(o.mdir, copy)); } catch (e) {} fs.linkSync(tmp, path.join(o.mdir, copy)); linked = true; } catch (e) {} }
    try {
      if (o.sync) { const t0 = Date.now(); SAFE.flushBatch((files || []).map(P).concat([tmp]), linked ? [dir, o.mdir, parent] : [dir, parent], dir); stats.lastSyncMs = Date.now() - t0; }
      fs.renameSync(tmp, file);
    } catch (e) { if (linked) { try { fs.unlinkSync(path.join(o.mdir, copy)); } catch (e2) {} } throw e; }
    if (o.sync) SAFE.fsyncDir(parent);
    if (st.manCopy && st.manCopy !== copy && o.mdir) st.lazy.push(path.join(o.mdir, st.manCopy));   // the previous copy, once this one committed
    st.manCopy = linked ? copy : null;
    return s.length;
  }
  function cur() { return { gen: st.gen, baseGens: st.baseGens, pieces: st.pieces, core: st.core, journals: st.journals }; }

  // the state on disk (from the main thread's load) - also cuts a torn last line off before anything is appended after it
  function init(m) {
    st.gen = m.gen; st.manCopy = 'manifest-' + m.gen + '.json'; st.baseGens = m.baseGens.slice(); st.pieces = Object.assign({}, m.pieces); st.core = m.core; st.journals = m.journals.slice();
    st.cur = st.journals[st.journals.length - 1] || null; st.pend = emptyPend(); st.ckpt = null; st.broken = false;
    if (st.journals.length) {
      const f = foldJournals(dir, st.journals);
      if (f.tornAt) { fs.truncateSync(P(f.tornAt.name), f.tornAt.goodBytes); stats.truncated++; }
      st.pend = pendFrom(f);
      try { st.curBytes = st.cur ? fs.statSync(P(st.cur)).size : 0; } catch (e) { st.curBytes = 0; }
    }
    if (st.journals.length > 1) startCheckpoint(st.journals.slice(0, -1));   // a checkpoint a restart cut short: finish it
    st.ready = true; stats.pendingUnits = st.pend.u.size;
  }

  /* one save: the players / receipts / pieces / core it changed. The line is built and hashed here (off the main thread). */
  function record(units, receipts, pieces, core) {
    if (!st.ready || st.broken || !st.cur) { const e = Error('world store: the journal is not open (a full save must come first)'); e.code = 'EJOURNAL'; throw e; }
    let json = '{"u":{', first = true;
    for (const [id, s] of units) { json += (first ? '' : ',') + JSON.stringify(id) + ':' + (s === null ? 'null' : s); first = false; }
    json += '}'; if (receipts && receipts.length) { json += ',"i":{'; first = true; for (const [k, s] of receipts) { json += (first ? '' : ',') + JSON.stringify(k) + ':' + (s === null ? 'null' : s); first = false; } json += '}'; }
    /* pieces: [key, patch|null, whole] */ if (pieces && pieces.length) { json += ',"p":{'; first = true; for (const [k, s] of pieces) { json += (first ? '' : ',') + JSON.stringify(k) + ':' + (s === null ? 'null' : s); first = false; } json += '}'; }
    if (core !== null && core !== undefined) json += ',"c":' + core;
    json += '}';
    const line = frame(json);
    try { fs.appendFileSync(P(st.cur), line); if (o.sync) SAFE.fsyncFile(P(st.cur)); }   // v1183: the line is the commit - on the disk before the save is answered
    catch (e) { st.broken = true; throw e; }   // a torn line may be on disk: nothing is appended after it - the next save is full
    st.curBytes += line.length; stats.appends++; stats.appendBytes += line.length; stats.journalBytes = st.curBytes;
    for (const [id, s, whole] of units) { const l = st.pend.u.get(id); if (!l || s === null || whole) st.pend.u.set(id, [s]); else l.push(s); }
    if (receipts) for (const [k, s] of receipts) st.pend.i.set(k, s);
    if (pieces) for (const [k, s, whole] of pieces) { const l = st.pend.p.get(k); if (!l || s === null || whole) st.pend.p.set(k, [s]); else l.push(s); }
    if (core !== null && core !== undefined) st.pend.c = core;
    stats.pendingUnits = st.pend.u.size + st.pend.i.size;
    return line.length;
  }

  /* a whole new base: shardStrs[s] = shard JSON for every s, pieceStrs = [[key, json]] for every piece, core = inline JSON */
  function full(shardStrs, pieceStrs, core, sweep) {   // sweep: after a failure - every store file the new manifest does not name goes
    const g = st.gen + 1, written = [];
    try {
      fs.mkdirSync(dir, { recursive: true });
      for (let s = 0; s < SHARDS; s++) { const n = s + '-' + g + '.json'; fs.writeFileSync(P(n), shardStrs[s]); written.push(n); }
      const pieces = {}; for (const [k, s] of pieceStrs) { const n = 'p-' + k + '-' + g + '.json'; fs.writeFileSync(P(n), s); written.push(n); pieces[k] = n; }
      const j = 'j-' + g + '.log'; fs.writeFileSync(P(j), ''); written.push(j);
      const m = { gen: g, baseGens: new Array(SHARDS).fill(g), pieces, core, journals: [j] };
      const bytes = manifest(m, written);
      // committed: everything the old manifest named (and a checkpoint in progress) goes
      for (let s = 0; s < SHARDS; s++) if (st.baseGens && st.baseGens[s]) st.lazy.push(P(s + '-' + st.baseGens[s] + '.json'));
      for (const f of Object.values(st.pieces)) st.lazy.push(P(f));
      for (const f of st.journals) st.lazy.push(P(f));
      if (st.ckpt) { for (const f of st.ckpt.written) st.lazy.push(P(f)); st.ckpt = null; stats.ckptActive = false; stats.ckptAborted++; }
      if (sweep) { const keep = new Set(written); let files = []; try { files = fs.readdirSync(dir); } catch (e) {}
        for (const f of files) if ((/^\d+-\d+\.json$/.test(f) || /^p-[A-Za-z0-9_$]{1,64}-\d+\.json$/.test(f) || J_FILE.test(f)) && !keep.has(f)) st.lazy.push(P(f)); }
      st.gen = g; st.baseGens = m.baseGens; st.pieces = pieces; st.core = core; st.journals = [j]; st.cur = j; st.curBytes = 0;
      st.pend = emptyPend(); st.broken = false; st.ready = true; st.lastCkptAt = Date.now();
      stats.fulls++; stats.journalBytes = 0; stats.pendingUnits = 0; stats.lazy = st.lazy.length;
      return bytes;
    } catch (e) { for (const n of written) { try { fs.unlinkSync(P(n)); } catch (e2) {} } throw e; }
  }

  /* ---- checkpoints ---- */
  function due() { return st.ready && !st.broken && !st.ckpt && Date.now() >= st.ckptRetryAt && st.pend.u.size + st.pend.i.size + st.pend.p.size + (st.pend.c !== null ? 1 : 0) > 0 && (st.curBytes >= CKPT_BYTES || Date.now() - st.lastCkptAt >= CKPT_MS || st.journals.length > 1); }
  function rotate() {   // a new empty journal after the current one: appends go there; the old ones are folded into a new base
    const g = st.gen + 1, j = 'j-' + g + '.log';
    fs.writeFileSync(P(j), '');
    try { manifest({ gen: g, baseGens: st.baseGens, pieces: st.pieces, core: st.core, journals: st.journals.concat(j) }, [j]); }
    catch (e) { try { fs.unlinkSync(P(j)); } catch (e2) {} throw e; }
    const old = st.journals.slice();
    st.gen = g; st.journals = st.journals.concat(j); st.cur = j; st.curBytes = 0; stats.rotations++;
    const frozen = st.pend; st.pend = emptyPend();
    startCheckpoint(old, frozen);
  }
  function startCheckpoint(oldJournals, frozen) {
    stats.ckptActive = true;
    if (!frozen) {   // after a restart: the old journals' content was folded into pend by init - split it: what the newest journal holds stays pending
      frozen = pendFrom(foldJournals(dir, oldJournals));
      st.pend = pendFrom(foldJournals(dir, st.journals.slice(-1)));
    }
    const byShard = new Map(), slot = sh => { let m = byShard.get(sh); if (!m) byShard.set(sh, m = { u: new Map(), i: new Map() }); return m; };
    for (const [id, s] of frozen.u) slot(shardOf(id)).u.set(id, s);
    for (const [k, s] of frozen.i) { const o = ownerOf(k); if (o !== null) slot(shardOf(o)).i.set(k, s); }
    const g = ++st.gen;
    st.ckpt = { g, old: oldJournals, frozen, todo: [...byShard.keys()].sort((a, b) => a - b), byShard, written: [], baseGens: st.baseGens.slice(), t0: Date.now(), ms: 0 };
  }
  // one step of the checkpoint (one shard, or the commit); returns true while there is more to do
  function step() {
    if (!st.ckpt) { if (!due()) return false;
      try { rotate(); } catch (e) { st.ckptRetryAt = Date.now() + 30000; stats.ckptAborted++; console.error('world store: journal rotation failed (' + e.message + ') - retried in 30 s'); return false; }
      return true; }
    const c = st.ckpt, t0 = Date.now();
    try {
      if (c.todo.length) {
        const s = c.todo.shift(), m = c.byShard.get(s), parse = x => x === null ? null : JSON.parse(x);
        const users = new Map([...m.u].map(([id, l]) => [id, l.map(parse)])), receipts = new Map([...m.i].map(([k, x]) => [k, parse(x)]));
        const baseName = s + '-' + st.baseGens[s] + '.json';
        const shard = applyUnits(JSON.parse(fs.readFileSync(P(baseName), 'utf8')), users, receipts);
        const n = s + '-' + c.g + '.json'; fs.writeFileSync(P(n), JSON.stringify(shard)); c.written.push(n); c.baseGens[s] = c.g; stats.ckptShards++;
      } else {
        const pieces = Object.assign({}, st.pieces), gone = [];
        for (const [k, l] of c.frozen.p) {
          const base = st.pieces[k] ? JSON.parse(fs.readFileSync(P(st.pieces[k]), 'utf8')) : undefined, v = applyPiece(base, l.map(x => x === null ? null : JSON.parse(x)));
          if (st.pieces[k]) gone.push(st.pieces[k]); if (v === undefined) { delete pieces[k]; continue; }
          const n = 'p-' + k + '-' + c.g + '.json'; fs.writeFileSync(P(n), JSON.stringify(v)); c.written.push(n); pieces[k] = n; }
        const core = c.frozen.c !== null ? c.frozen.c : st.core, journals = st.journals.filter(j => !c.old.includes(j));
        const mg = st.gen + 1;
        manifest({ gen: mg, baseGens: c.baseGens, pieces, core, journals }, c.written);
        for (let s = 0; s < SHARDS; s++) if (c.baseGens[s] !== st.baseGens[s]) st.lazy.push(P(s + '-' + st.baseGens[s] + '.json'));
        for (const f of gone) st.lazy.push(P(f)); for (const f of c.old) st.lazy.push(P(f));
        st.gen = mg; st.baseGens = c.baseGens; st.pieces = pieces; st.core = core; st.journals = journals; st.ckpt = null; st.lastCkptAt = Date.now();
        stats.checkpoints++; stats.lazy = st.lazy.length;
      }
    } catch (e) {   // the committed state is untouched; what this checkpoint wrote goes; it starts again later
      for (const n of c.written) st.lazy.push(P(n)); st.ckpt = null; stats.ckptActive = false; stats.ckptAborted++; st.lastCkptAt = Date.now(); st.ckptRetryAt = Date.now() + 30000;   // a failing disk is not retried in a loop
      for (const [id, l] of c.frozen.u) { const cur = st.pend.u.get(id); st.pend.u.set(id, cur ? l.concat(cur) : l); }   // still to fold - keep it pending, older patches first
      for (const [k, s] of c.frozen.i) if (!st.pend.i.has(k)) st.pend.i.set(k, s);
      for (const [k, l] of c.frozen.p) { const cur = st.pend.p.get(k); st.pend.p.set(k, cur ? l.concat(cur) : l); }
      if (c.frozen.c !== null && st.pend.c === null) st.pend.c = c.frozen.c;
      console.error('world store: checkpoint stopped (' + e.message + ') - the journal keeps everything; it is retried');
      return false;
    }
    stats.ckptActive = !!st.ckpt;
    const ms = Date.now() - t0; c.ms += ms; if (ms > stats.ckptMaxStepMs) stats.ckptMaxStepMs = ms; stats.ckptMs += ms;
    return true;
  }
  function unlinkSome(n) { const b = st.lazy.splice(0, n); for (const f of b) { try { fs.unlinkSync(f); } catch (e) {} } stats.lazy = st.lazy.length; return b.length; }
  // the sync path (DB_STORE_IO=sync, tools): run a due checkpoint to the end
  function settle() { let guard = 0; while (step() && guard++ < 100000) {} unlinkSome(st.lazy.length); }
  return { init, record, full, step, due, unlinkSome, settle, stats, get gen() { return st.gen; }, get busy() { return !!st.ckpt || due(); }, get lazyCount() { return st.lazy.length; }, state: () => cur() };
}

module.exports = { createEngine, shardOfN, parseJournal, foldJournals, applyUnits, applyPatches, applyPiece, lineHash, frame, J_FILE };
