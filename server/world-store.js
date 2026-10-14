'use strict';
/* v1037 PER-PLAYER STORAGE (Phil 5 Oct 2026: "do the real fix"). The war load test showed every server topping out on saving the
   WHOLE world once per batch of actions (25-38 MB copies: stringify + write of everything for a change to two players).

   Split store (DB_STORE=split): the world file becomes a small MANIFEST - the shared world (everything but players and receipts),
   plus the name of each of 512 player shard files in <DB_FILE>.d/. A shard holds its players and their request receipts (a
   receipt "<userId>:..." lives with that user). A save writes ONLY the shards it was told changed, each to a NEW file name, then
   swaps the manifest with one atomic rename. A crash at any point leaves the previous manifest, which names only complete files:
   a save is all or nothing, exactly as the one-file save was. Superseded shard files are removed after the swap.

   Without DB_STORE=split the server reads and writes the one-file world exactly as before. Either mode reads either format, so
   switching back is one restart (the next save writes the other format).

   v1127 SHARED-WORLD PIECES (Server 1 load test 11 Oct 2026: every save, partial ones too, rewrote the whole ~1 MB shared world in
   the manifest). In the pieces layout each top-level system of the shared world (chat, guilds, tokens, reports, feedback, wars,
   watch, dungeonProgress, tournaments, the shared receipts 'idem', ...) is its own file p-<key>-<gen>.json in <DB_FILE>.d/, and
   the manifest only names files. A save writes a piece only when it changed:
     - a save that declares its pieces (write(db, ids, pieces)) looks at those pieces only - a chat line writes the chat piece,
       a war march no piece at all;
     - a save that declares nothing (and every full save) compares every piece with what was last written and writes the ones
       that differ - the stringify stays, the disk write of unchanged systems goes.
   New piece files take the new gen and the manifest swap commits them with the shards: still all or nothing.

   Layouts and rollback:
     - pieces layout (default with DB_STORE=split): {__store:'split-v1', layout:'pieces-v1', shards:null, shardGens, pieces}
       (shardGens[s] = the gen of shard s's file <s>-<gen>.json - a number per shard keeps the manifest small).
       `shards` is null ON PURPOSE: code from before v1127 (59eaefba and older) reads '__store:split-v1', finds no shard names and
       refuses to start (SHARD_MISSING) instead of running a world without its players.
     - split-v1 layout (DB_STORE_PIECES=0, or `node server/world-store.js downgrade <DB_FILE>`): the v1037 manifest, shared world
       inline. Older code reads it.
   Any layout loads; the first save writes the configured one (the server forces a full save at boot when they differ).

   ROLLBACK to code from before v1127 (e.g. 59eaefba), as the v1037 split did it - the world must be split-v1 first:
     1. add DB_STORE_PIECES=0 to /etc/emberweave.env and restart once on THIS code: its boot save writes split-v1
        (check: `node server/world-store.js layout <DB_FILE>` prints split-v1);
        or, with the game stopped: `node server/world-store.js downgrade <DB_FILE>`;
     2. only then deploy the old code. Started on a pieces world, old code exits at once with "shard 0 is not in the manifest" and
        writes nothing - restore step 1 and start again. Backups (one plain JSON file) are unaffected by the layout.

   v1128 JOURNAL LAYOUT (S1 copy run 12 Oct 2026: a save rewrote whole 512-shard files, ~170 KB for one action, ~87 files a second
   at 2,000 players; 2048 / 8192 shards cut the bytes but stalled Windows seconds on file creation). With DB_STORE=split the server
   now writes {layout:'journal-v1', shards:null, baseGens, pieces, core, journals}: the 512 shard files are a BASE and every save
   APPENDS one line to <DB_FILE>.d/j-<n>.log with only what changed - each changed player as a patch (server/store-diff.js: changed
   fields, keys of big objects, elements of big arrays), each new receipt once, each changed shared piece as a patch. A war
   declaration on a 3,000-player world: 0.8 KB, no file created (v1127: one 33 KB shard file). The io worker folds the journal into
   the base in the background (server/store-journal.js: rotate, rebuild the touched shards, one manifest rename) once it holds
   DB_STORE_CKPT_BYTES (128 MB) or is DB_STORE_CKPT_MS (10 min) old. A torn last line (a crash mid-append) is cut off at boot.
   `shards:null` and no shardGens: c9f40cd8 and older refuse a journal world (SHARD_MISSING) instead of reading a stale base.

   ROLLBACK from v1128 (journal) to c9f40cd8 (v1127, pieces):
     1. add DB_STORE_JOURNAL=0 to /etc/emberweave.env and restart once on v1128: its boot save writes the pieces layout and drops the
        journals (check: `node server/world-store.js layout <DB_FILE>` prints pieces);
        or, with the game stopped: `node server/world-store.js downgrade <DB_FILE>` (split-v1 - c9f40cd8 and older read it);
     2. only then deploy c9f40cd8. Started on a journal world it exits at once with "shard 0 is not in the manifest" and writes
        nothing - do step 1 and start again.
   To 59eaefba or older: DB_STORE_PIECES=0 (split-v1; the journal is off with it), as above. DB_STORE_IO=sync puts every file
   operation back on the main thread (server/store-io.js). */
const fs = require('fs'), path = require('path');
/* 512 (v1037): a war batch touching ~40 players rewrites ~8% of the world, not a third. v1127: DB_STORE_SHARDS changes it at a
   restart (a manifest from another count loads whole and the next save re-shards it). Measured 12 Oct on the 8500-player bench
   world under a war + chat mix: 2048 wrote 12 MB/s instead of 22 MB/s but each batch touched ~4x the files and the longest stall
   grew from 0.75 s to 2.5 s (Windows file creation) - 512 stays the default; try 2048 on Linux. */
const SHARDS = Math.max(16, Math.min(16384, +process.env.DB_STORE_SHARDS || 512)), FORMAT = 'split-v1', LAYOUT = 'pieces-v1';
const PIECE_KEY = /^[A-Za-z0-9_$]{1,64}$/, PIECE_FILE = /^p-([A-Za-z0-9_$]{1,64})-(\d+)\.json$/;
const STORE_FILE_RX = '^(\\d+-\\d+|p-[A-Za-z0-9_$]{1,64}-\\d+)\\.json$';   // v1128: every shard and piece file name (the sweep after a failed save)
const STORE_IO = require('./store-io.js'), J = require('./store-journal.js'), DIFF = require('./store-diff.js'), crypto = require('crypto');
const JLAYOUT = 'journal-v1';   // v1128: base shards + an append-only per-player journal (server/store-journal.js)
/* v1134 PIECE DIRTY FLAGS (S1 copy run 12 Oct 2026 on 6bfeb24d: almost every save named no pieces, so prepareJournal stringified all
   ~20 shared pieces - ~3 MB: tokens 0.87, feedback 0.85, watch 0.72 MB, ipAccounts, byName, reports - only to find 19.8 of 20
   unchanged: 30-58 ms a save, a third of the main thread). The big pieces below are FLAGGED: a save looks at a flagged piece only
   when a route declared it (writeDB(ids, ['tokens'])) or the server marked it dirty (store.markPiece(k), server.js _dp() at every
   place that changes it). A save that names no pieces still compares the small unflagged ones (chat, guilds, wars, tournaments,
   dungeonProgress, meta, idem, ... - a few KB) and every piece it has not written yet. Safety net: every sweep slice (~1.9 s)
   compares ONE flagged piece in turn (all of them within ~15 s); a difference nobody marked is written there and counted
   (save-stats store.pieceMissed / pieceMissedNames) - a missing _dp() costs at most ~15 s of that piece, never the data.
   DB_STORE_PIECE_COMPARE=1 (server.js) = no flagged pieces: every save compares every piece again, as 6bfeb24d. */
const FLAGGED_PIECES = ['tokens', 'feedback', 'reports', 'watch', 'byName', 'ipAccounts', 'devices', 'guestByDevice'];

function shardOf(id) {   // FNV-1a over the id - stable across restarts and Node versions
  let h = 0x811c9dc5; const s = String(id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % SHARDS;
}
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h + ':' + s.length; }   // v1127: has a sweep shard changed since it was written
// the shard file names a manifest commits: split-v1 names them, the pieces layout keeps one gen number per shard
function shardNamesOf(raw) { if (!raw) return null; if (Array.isArray(raw.shardGens)) { const o = {}; raw.shardGens.forEach((g, s) => { if (g > 0) o[s] = s + '-' + g + '.json'; }); return o; } return raw.shardFiles || raw.shards || null; }
function ownerOf(key) { const i = String(key).indexOf(':'); return i > 0 ? key.slice(0, i) : null; }

function create(file, opts) {
  opts = opts || {};
  const dir = file + '.d';
  const st = { split: !!opts.split, verify: !!opts.verify, pieces: opts.pieces !== false, gen: 0, names: null, last: null,
    pnames: null, plast: new Map(), pflag: new Set(), layout: null, shash: new Map(), broken: false,
    usig: new Map(), psig: new Map(), rk: new Map(), vhash: null, dirty: new Set(), jcore: null, jstate: null, jinitSent: false, jfiles: null,
    stats: { full: 0, partial: 0, shardsWritten: 0, lastMs: 0, lastShards: 0, lastFullAt: 0, undeclared: 0, undeclaredIds: [],
      piecesWritten: 0, piecesSkipped: 0, slices: 0, sweepSkipped: 0, lastPieces: [], bytes: { shards: 0, pieces: 0, manifest: 0 }, undeclaredPieces: 0, undeclaredPieceNames: [], mainMs: 0, mainMaxMs: 0, io: null, unitsWritten: 0, unitsSkipped: 0, receiptsWritten: 0, sweepLooked: 0, dirtyNow: 0 } };
  st.stats.bytes.journal = 0;
  Object.assign(st.stats, { piecesLooked: 0, pieceBytesLooked: 0, pieceAudits: 0, pieceMissed: 0, pieceMissedNames: [], piecesMarked: 0 });   // v1134
  const FLAGGED = new Set(Array.isArray(opts.flagged) ? opts.flagged : FLAGGED_PIECES);
  st.pdirty = new Set(); st.psub = new Map(); let auditNext = 0;
  /* v1134 RECEIPT INDEX (S1 copy run 14 Oct 2026: with the piece compare gone, receiptsOf - every save walking EVERY request receipt
     of the world (~100k after two minutes at 2,500 players, an hour of them on a real server) to find the few of the saved players -
     was 14% of the main thread). The server notes each receipt it writes (noteReceipt, server.js _rkn); a save then looks only at
     the receipts it wrote before for its players plus the ones noted since. The whole table is still walked when the receipt table
     object was replaced, after a load / full save, and on sweep slice 0 (every ~30 s) - that walk also picks up a receipt nobody noted. */
  st.rnew = new Map(); st.rcore = new Set(); st.idemRef = null; st.rscan = true;   // v1134: flagged pieces marked dirty (whole / by key) since they were last looked at; the next one the sweep audits
  /* v1134: the pieces a partial save looks at. declared (a Set) = the pieces the save named; null = not known. `written` = the pieces
     with a last-written copy. A piece never written is always looked at; a flagged one only when declared or marked. Returns the
     pieces to compare whole, and (subs, journal only) the object pieces marked by key: only those keys are looked at. */
  function lookAt(keys, declared, written, bySub) {
    const out = new Set(), subs = new Map();
    for (const k of keys) {
      if (!written(k) || st.pdirty.has(k)) out.add(k);
      else if (declared ? declared.has(k) : !FLAGGED.has(k)) out.add(k);
      else if (st.psub.has(k)) { if (bySub) subs.set(k, st.psub.get(k)); else out.add(k); }
    }
    for (const k of out) { st.pdirty.delete(k); st.psub.delete(k); }
    for (const k of subs.keys()) st.psub.delete(k);
    return { out, subs };
  }
  // v1134: on a sweep slice, the next flagged piece (round robin) that this save does not already look at
  function auditKey(keys, looked, written) {
    const list = [...FLAGGED].filter(k => keys.has(k) && !looked.has(k) && written(k)); if (!list.length) return null;
    return list[(auditNext++) % list.length];
  }
  function noteMissed(k) { const S = st.stats; S.pieceMissed++; S.pieceMissedNames = S.pieceMissedNames.concat([k]).slice(-20);
    console.error('world store: shared piece ' + k + ' changed with no save naming it and no _dp() mark - written by the sweep audit'); }
  /* v1134: the journal patch of an object piece for the keys marked (store-diff 'o' patch of {"v":value}); null = none changed;
     false = not possible here (no key signature yet, not a plain object, or marked whole meanwhile) - the caller compares it whole.
     The piece's signature moves forward key by key; its last-written text becomes unknown (null) - an audit then diffs instead. */
  function subPatch(k, val, keys) {
    const ps = st.psig.get(k), e = ps && ps.get('v');
    if (!e || e.k !== 'o' || !DIFF.plain(val) || keys.has(null)) return false;
    const sets = [], dels = [];
    for (const sk of keys) {
      const s = Object.prototype.hasOwnProperty.call(val, sk) ? DIFF.J(val[sk]) : undefined;
      if (s === undefined) { if (e.m.has(sk)) { dels.push(sk); e.m.delete(sk); } continue; }
      const g = DIFF.sig(s); if (e.m.get(sk) !== g) { sets.push(JSON.stringify(sk) + ':' + s); e.m.set(sk, g); }
    }
    if (!sets.length && !dels.length) return null;
    return '{"o":{"v":{"s":{' + sets.join(',') + '}' + (dels.length ? ',"x":' + JSON.stringify(dels) : '') + '}}}';
  }
  const JOURNAL = st.split && st.pieces && opts.journal === true;   // v1128: the journal layout (the server turns it on; DB_STORE_JOURNAL=0 = the v1127 pieces layout)
  const configured = () => JOURNAL ? 'journal' : (st.pieces ? 'pieces' : 'split-v1');
  /* v1128: opts.io = 'worker' (the file work of every save on the store io worker thread) or 'sync' (default: on this thread) */
  let _io = null;
  const io = () => { if (!_io) { _io = STORE_IO.create({ mode: opts.io === 'worker' ? 'worker' : 'sync', onFailure: e => { st.broken = true; if (opts.onFailure) opts.onFailure(e); },
    onWorkerLost: () => { st.broken = true; st.jinitSent = false;   // file names restart well past any gen the lost worker used (it may still be finishing an unlink)
      const g = Math.max(st.jstate ? st.jstate.gen | 0 : 0, (_io && _io.stats.journal && _io.stats.journal.gen) | 0, st.gen | 0) + 1000;
      st.jstate = { gen: g, baseGens: [], pieces: {}, core: '{}', journals: [] }; } }); st.stats.io = _io.stats; } return _io; };   // the worker died: saves go on on this thread - the journal engine starts here with a full save
  const idShard = new Map();
  const sh = id => { let s = idShard.get(id); if (s === undefined) { s = shardOf(id); if (idShard.size > 500000) idShard.clear(); idShard.set(id, s); } return s; };

  // the content of every shard in `want` (a Set of shard numbers, or null = all) plus the shared world
  function split(db, want) {
    const parts = new Map(), users = db.users || {}, idem = db.idem || {}, coreIdem = {};
    const part = s => { let p = parts.get(s); if (!p) { p = { users: {}, idem: {} }; parts.set(s, p); } return p; };
    if (!want) for (let s = 0; s < SHARDS; s++) part(s);
    for (const id of Object.keys(users)) { const s = sh(id); if (!want || want.has(s)) part(s).users[id] = users[id]; }
    for (const k of Object.keys(idem)) {
      const o = ownerOf(k);
      if (o !== null && Object.prototype.hasOwnProperty.call(users, o)) { const s = sh(o); if (!want || want.has(s)) part(s).idem[k] = idem[k]; }
      else coreIdem[k] = idem[k];
    }
    const core = {}; for (const k of Object.keys(db)) if (k !== 'users' && k !== 'idem') core[k] = db[k];
    core.idem = coreIdem;
    return { parts, core };
  }

  function readText(name, what) {
    try { return fs.readFileSync(path.join(dir, name), 'utf8'); }
    catch (err) { const e = Error('world store: ' + what + ' file ' + name + ' unreadable (' + err.message + ')'); e.code = 'SHARD_MISSING'; throw e; }
  }

  function load() {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    st.pnames = null; st.plast = new Map(); st.pflag = new Set(); st.shash = new Map(); st.pdirty.clear(); st.psub.clear();
    if (!raw || raw.__store !== FORMAT) { st.names = null; st.layout = 'file'; st.jstate = null; st.jinitSent = false; return raw; }   // the one-file world: the next split save writes every shard
    const jl = raw.layout === JLAYOUT, pieced = raw.layout === LAYOUT || jl;
    const shardNames = jl ? (Array.isArray(raw.baseGens) ? Object.fromEntries(raw.baseGens.map((g, s) => [s, g > 0 ? s + '-' + g + '.json' : null]).filter(x => x[1])) : null) : shardNamesOf(raw);
    const db = Object.assign({}, raw.core || {});
    if (pieced) {
      st.pnames = new Map();
      for (const [k, name] of Object.entries(raw.pieces || {})) {
        if (!PIECE_KEY.test(k)) continue;
        let p; const text = readText(name, 'piece');
        try { p = JSON.parse(text); } catch (err) { const e = Error('world store: piece file ' + name + ' unreadable (' + err.message + ')'); e.code = 'SHARD_MISSING'; throw e; }
        db[k] = p; st.pnames.set(k, name); st.plast.set(k, text);
      }
    }
    const idem = Object.assign({}, db.idem || {}); db.users = {};
    const count = raw.count || 128;   // a manifest written with another shard count loads whole; the next save re-shards it
    for (let s = 0; s < count; s++) {
      const name = shardNames && shardNames[s];
      if (!name) { const e = Error('world store: shard ' + s + ' is not in the manifest'); e.code = 'SHARD_MISSING'; throw e; }
      let p; try { const text = readText(name, 'shard'); p = JSON.parse(text); st.shash.set(s, fnv(text)); }
      catch (err) { if (err.code === 'SHARD_MISSING') throw err; const e = Error('world store: shard file ' + name + ' unreadable (' + err.message + ')'); e.code = 'SHARD_MISSING'; throw e; }
      Object.assign(db.users, p.users || {}); Object.assign(idem, p.idem || {});
    }
    db.idem = idem; st.gen = raw.gen | 0; st.names = count === SHARDS ? Object.assign({}, shardNames) : null;
    st.layout = jl ? 'journal' : pieced ? 'pieces' : 'split-v1';
    if (jl) {   // v1128: the journals after the base, in order - the latest unit of each player, value of each piece, inline core
      const f = J.foldJournals(dir, raw.journals || []);
      for (const [id, list] of f.units) { const u = J.applyPatches(db.users[id], list); if (u === null) delete db.users[id]; else db.users[id] = u; }
      for (const [k, v] of f.receipts) { if (v === null) delete db.idem[k]; else db.idem[k] = v; }
      for (const [k, list] of f.pieces) {
        if (k === 'idem') { const core = {}; for (const x of Object.keys(db.idem)) { const o = ownerOf(x); if (!(o !== null && Object.prototype.hasOwnProperty.call(db.users, o))) { core[x] = db.idem[x]; delete db.idem[x]; } }
          const v = J.applyPiece(core, list); if (v) Object.assign(db.idem, v); continue; }
        const v = J.applyPiece(db[k], list); if (v === undefined) delete db[k]; else db[k] = v; }
      if (f.core !== undefined) { for (const k of Object.keys(db)) if (k !== 'users' && k !== 'idem' && !PIECE_KEY.test(k)) delete db[k]; Object.assign(db, f.core); }
      st.jfiles = (raw.journals || []).slice(); st.stats.journalLines = f.lines; st.stats.journalTorn = f.tornAt ? 1 : 0;
    }
    st.jstate = { gen: raw.gen | 0, baseGens: count === SHARDS && shardNames ? Array.from({ length: SHARDS }, (_, s) => shardNames[s] ? +String(shardNames[s]).split('-')[1].split('.')[0] : 0) : [],
      pieces: pieced ? Object.assign({}, raw.pieces || {}) : {}, core: JSON.stringify(raw.core || {}), journals: jl ? (raw.journals || []).slice() : [] };
    st.jinitSent = false;
    if (JOURNAL && jl && st.names) seedUnits(db, st.verify);
    if (!st.names) { st.pnames = null; st.plast = new Map(); }   // re-sharded on the next save: every piece is written too
    st.stats.lastFullAt = Date.now();   // what is on disk is the whole world: the sweep clock starts here
    return db;
  }

  // a server boot in split mode: shard and piece files no manifest names are leftovers of a save that never committed
  function sweepOrphans() {
    if (!st.names) return 0; const keep = new Set([...Object.values(st.names), ...(st.pnames ? st.pnames.values() : []), ...(st.jfiles || [])]); let n = 0;
    let files = []; try { files = fs.readdirSync(dir); } catch (e) { return 0; }
    for (const f of files) if ((/^\d+-\d+\.json$/.test(f) || PIECE_FILE.test(f) || J.J_FILE.test(f)) && !keep.has(f)) { try { fs.unlinkSync(path.join(dir, f)); n++; } catch (e) {} }
    return n;
  }

  /* userIds: null = save everything; else the players whose data (or receipts) changed. dirtyPieces: null/undefined = the shared
     systems that changed are not known (every piece is compared with what was last written); a Set/array of keys = only these can
     have changed.
     v1128: prepare() runs on the main thread - it decides what changed, stringifies it and moves the store's own record (gen, file
     names, hashes) forward at once, so the next save builds on this one even before it is on disk; the file work is one job for the
     store io (server/store-io.js): written by the io worker for writeAsync(), waited for by write(). A job that fails marks the
     store broken: the next save writes every shard and piece under new names and sweeps whatever its manifest does not name. */
  function prepare(db, userIds, dirtyPieces, slice) {   // v1127: slice {slice, of} = a sweep slice - every shard s with s % of === slice too
    if (JOURNAL) return prepareJournal(db, userIds, dirtyPieces, slice);
    const t0 = Date.now(), S = st.stats, broken = st.broken;
    const full = !userIds || !st.names || broken || st.layout === 'journal';   // v1128: leaving the journal layout rewrites every shard
    let want = null, sweepOnly = null;
    if (!full) { want = new Set(); for (const id of userIds) want.add(sh(id));
      if (slice && slice.of > 0) { sweepOnly = new Set(); S.slices++;   // v1128: only the shards of players marked dirty - a clean shard is never stringified
        for (const id of st.dirty) { const s = sh(id); if (!want.has(s)) { want.add(s); sweepOnly.add(s); } } S.sweepLooked += sweepOnly.size; } }
    const { parts, core } = split(db, want);
    if (!full && slice && slice.of > 0) st.dirty.clear(); else if (!full) for (const id of userIds) st.dirty.delete(id); else st.dirty.clear();   // what this save looks at is on its way to disk
    S.dirtyNow = st.dirty.size;
    const gen = ++st.gen, names = Object.assign({}, broken ? {} : (st.names || {})), ops = [{ mk: dir }], strs = st.verify ? new Map() : null, newHash = new Map();
    let pnext = null, pstr = null, inline = core, considered = null;
    if (st.pieces) {
      inline = {}; pnext = new Map(broken ? [] : (st.pnames || [])); pstr = new Map();
      const keys = new Set(); for (const k of Object.keys(core)) { if (core[k] === undefined) continue; if (PIECE_KEY.test(k)) keys.add(k); else inline[k] = core[k]; }
      for (const k of [...pnext.keys()]) if (!keys.has(k)) pnext.delete(k);   // a system that left the world: its file goes
      const declared = dirtyPieces ? new Set(dirtyPieces) : null;
      const written = k => !!(st.pnames && st.pnames.has(k) && st.plast.has(k));
      if (full || !st.pnames) { considered = keys; st.pdirty.clear(); st.psub.clear(); }
      else considered = lookAt(keys, declared, written, false).out;   // v1134: flagged pieces only when named or marked (a piece file is written whole)
      const audit = (!full && st.pnames && slice && slice.of > 0) ? auditKey(keys, considered, written) : null;
      for (const k of considered) {
        const s = JSON.stringify(core[k]); S.piecesLooked++; S.pieceBytesLooked += s ? s.length : 0;
        if (!broken && st.pnames && st.pnames.has(k) && st.plast.get(k) === s) { S.piecesSkipped++; continue; }
        pstr.set(k, s);
      }
      if (audit) { const s = JSON.stringify(core[audit]); S.pieceAudits++; S.pieceBytesLooked += s ? s.length : 0;
        if (st.plast.get(audit) !== s) { noteMissed(audit); pstr.set(audit, s); considered.add(audit); } }
    }
    let shardBytes = 0, pieceBytes = 0;
    for (const [s, p] of parts) {
      const str = JSON.stringify(p), hsh = fnv(str);
      if (sweepOnly && sweepOnly.has(s) && st.names && st.names[s] && st.shash.get(s) === hsh) { S.sweepSkipped++; continue; }   // v1127: a sweep shard that did not change keeps its file
      const name = s + '-' + gen + '.json';
      ops.push({ w: path.join(dir, name), s: str }); names[s] = name; shardBytes += str.length; newHash.set(s, hsh);
      if (strs) strs.set(s, str);
    }
    if (pstr) for (const [k, s] of pstr) { const name = 'p-' + k + '-' + gen + '.json'; ops.push({ w: path.join(dir, name), s }); pnext.set(k, name); pieceBytes += s.length; }
    const tmp = file + '.store.tmp';
    const man = st.pieces ? JSON.stringify({ __store: FORMAT, layout: LAYOUT, gen, count: SHARDS, shards: null, shardGens: Array.from({ length: SHARDS }, (_, s) => +String(names[s]).split('-')[1].split('.')[0]), pieces: Object.fromEntries(pnext), core: inline })
      : JSON.stringify({ __store: FORMAT, gen, count: SHARDS, shards: names, core });
    ops.push({ w: tmp, s: man }, { r: tmp, to: file });
    // what this save supersedes is removed once it has committed (lazily, by the io worker); after a failure, a sweep instead
    const lazy = [];
    if (broken) ops.push({ sweep: dir, keep: [...Object.values(names), ...(pnext ? pnext.values() : [])], rx: STORE_FILE_RX });
    else {
      const old = st.names || {};
      if (st.jfiles) { for (const f of st.jfiles) lazy.push(path.join(dir, f)); st.jfiles = null; }   // v1128: back from the journal layout - its journals go
      for (const s of Object.keys(names)) if (old[s] && old[s] !== names[s]) lazy.push(path.join(dir, old[s]));
      if (st.pnames) for (const [k, f] of st.pnames) if (!pnext || pnext.get(k) !== f) lazy.push(path.join(dir, f));   // superseded or removed pieces (all of them when going back to split-v1)
    }
    // the store's record moves forward now: the next save builds on this one
    st.broken = false;
    st.names = names; for (const [s, h] of newHash) st.shash.set(s, h); S.lastShards = newHash.size;
    if (st.pieces) { st.pnames = pnext; for (const [k, s] of pstr) { st.plast.set(k, s); st.pflag.delete(k); } for (const k of [...st.plast.keys()]) if (!pnext.has(k)) st.plast.delete(k); st.layout = 'pieces'; }
    else { st.pnames = null; st.plast = new Map(); st.layout = 'split-v1'; }
    const ms = Date.now() - t0;
    if (full) { S.full++; S.lastFullAt = Date.now(); } else S.partial++;
    S.shardsWritten += newHash.size; S.lastMs = ms; S.mainMs += ms; if (ms > S.mainMaxMs) S.mainMaxMs = ms;
    S.piecesWritten += pstr ? pstr.size : 0; S.lastPieces = pstr ? [...pstr.keys()] : ['(inline)'];
    S.bytes.shards += shardBytes; S.bytes.pieces += pieceBytes; S.bytes.manifest += man.length;
    if (strs) verifyAfter(db, strs, full);
    if (st.verify && st.pieces && considered && !full) verifyPieces(core, considered);
    return { ops, lazy };
  }
  /* ---------------- v1128 journal layout (server/store-journal.js): a save appends what changed ----------------
     The main thread stringifies each changed player and each NEW receipt (a receipt is written once, when it is made, and as null
     when it goes); the engine (io worker) appends them as one journal line and folds the journal into the 512 base shards in the
     background. st.usig = each player's diff signature as last written (server/store-diff.js) - a save writes only the fields / keys
     / array elements that changed; st.rk = the receipt keys written for each player. */
  const md5 = s => crypto.createHash('md5').update(s).digest('base64');
  // receipt keys grouped by owner for the players in `want` (null = every player); the rest are the shared receipts ('idem' piece)
  function receiptsOf(db, want) {
    const users = db.users || {}, idem = db.idem || {}, by = new Map(), coreIdem = {};
    for (const k of Object.keys(idem)) {
      const o = ownerOf(k);
      if (o !== null && Object.prototype.hasOwnProperty.call(users, o)) { if (!want || want.has(o)) { const a = by.get(o); if (a) a.push(k); else by.set(o, [k]); } }
      else coreIdem[k] = idem[k];
    }
    return { by, coreIdem };
  }
  // v1134: the receipts of the players in `cand` without walking the whole table (see RECEIPT INDEX); null = walk it (receiptsOf)
  function receiptsIndexed(db, cand, slice) {
    const users = db.users || {}, idem = db.idem || {}, own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    if (st.rscan || db.idem !== st.idemRef || (slice && slice.of > 0 && slice.slice === 0)) {
      const all = receiptsOf(db, null), by = new Map(); st.rcore = new Set(Object.keys(all.coreIdem)); st.idemRef = db.idem; st.rscan = false; st.rnew = new Map();
      for (const [o, ks] of all.by) { if (cand.has(o)) { by.set(o, ks); continue; } const had = st.rk.get(o), nw = ks.filter(k => !(had && had.has(k)));   // a receipt nobody noted waits for its player's next save
        if (nw.length) st.rnew.set(o, new Set(nw)); }
      const r = { by, coreIdem: all.coreIdem };
      st.stats.receiptScans = (st.stats.receiptScans | 0) + 1; return r; }
    for (const [o, set] of st.rnew) if (!own(users, o)) { for (const k of set) st.rcore.add(k); st.rnew.delete(o); }   // an owner that is no player: a shared receipt
    const by = new Map(), coreIdem = {};
    for (const id of cand) { if (!own(users, id)) continue; const had = st.rk.get(id), nw = st.rnew.get(id), ks = [];
      if (had) for (const k of had) if (own(idem, k)) ks.push(k);
      if (nw) { for (const k of nw) if (own(idem, k) && !(had && had.has(k))) ks.push(k); st.rnew.delete(id); }
      if (ks.length) by.set(id, ks); }
    for (const k of st.rcore) { if (!own(idem, k)) { st.rcore.delete(k); continue; } const o = ownerOf(k); if (o !== null && own(users, o)) continue; coreIdem[k] = idem[k]; }
    return { by, coreIdem };
  }
  const vclean = u => JSON.stringify(u, (k, v) => k === 'lastSeen' ? undefined : v);   // DB_STORE_VERIFY: presence is not saved per request
  // the shared world: piece values (PIECE_KEY) and the inline rest, as the pieces layout splits it
  function coreParts(db, coreIdem) {
    const keys = new Set(), inline = {};
    for (const k of Object.keys(db)) { if (k === 'users' || db[k] === undefined) continue; const v = k === 'idem' ? coreIdem : db[k]; if (PIECE_KEY.test(k)) keys.add(k); else inline[k] = v; }
    if (!keys.has('idem')) keys.add('idem');
    return { keys, inline, val: k => k === 'idem' ? coreIdem : db[k] };
  }
  function jcfg() { return { file, dir, shards: SHARDS, ckptBytes: +process.env.DB_STORE_CKPT_BYTES || 0, ckptMs: +process.env.DB_STORE_CKPT_MS || 0 }; }
  function jinitOp() { if (st.jinitSent) return null; st.jinitSent = true;
    const m = st.jstate || { gen: st.gen | 0, baseGens: [], pieces: {}, core: '{}', journals: [] };
    return { j: 'init', m, cfg: jcfg() }; }
  function prepareJournal(db, userIds, dirtyPieces, slice) {
    const t0 = Date.now(), S = st.stats, broken = st.broken, full = !userIds || st.layout !== 'journal' || broken;
    const ops = full || !st.jinitSent ? [{ mk: dir }] : [], init = jinitOp(); if (init) ops.push(init);
    const users = db.users || {}, idem = db.idem || {};
    let bytes = 0, unitN = 0;
    if (full) {
      const { by, coreIdem } = receiptsOf(db, null), shardUsers = Array.from({ length: SHARDS }, () => []), shardRec = Array.from({ length: SHARDS }, () => []);
      st.usig = new Map(); st.rk = new Map(); if (st.verify) st.vhash = new Map();
      for (const id of Object.keys(users)) {
        const r = DIFF.diff(users[id], null, true), keys = by.get(id), s = sh(id);
        shardUsers[s].push(JSON.stringify(id) + ':' + r.whole); st.usig.set(id, r.sig); if (st.vhash) st.vhash.set(id, md5(vclean(users[id])));
        if (keys) { for (const k of keys) shardRec[s].push(JSON.stringify(k) + ':' + JSON.stringify(idem[k])); st.rk.set(id, new Set(keys)); }
      }
      const shards = shardUsers.map((u, s) => '{"users":{' + u.join(',') + '},"idem":{' + shardRec[s].join(',') + '}}');
      const cp = coreParts(db, coreIdem), pieces = [];
      st.plast = new Map(); st.psig = new Map();
      for (const k of cp.keys) { const v = JSON.stringify(cp.val(k)); pieces.push([k, v]); st.plast.set(k, v); st.psig.set(k, DIFF.diff({ v: cp.val(k) }, null).sig); bytes += v.length; }
      const core = JSON.stringify(cp.inline); st.jcore = core;
      for (const x of shards) bytes += x.length;
      ops.push({ j: 'full', shards, pieces, core, sweep: broken });   // after a failure (or a lost io worker) the files no manifest names go too
      st.layout = 'journal'; st.broken = false; st.dirty.clear(); st.pdirty.clear(); st.psub.clear(); S.dirtyNow = 0; S.full++; S.lastFullAt = Date.now(); S.shardsWritten += SHARDS; S.bytes.shards += bytes; S.lastShards = SHARDS; S.lastPieces = pieces.map(p => p[0]);
      st.jfiles = null; st.rscan = true; st.rnew = new Map();
    } else {
      // the players this save looks at: the declared ones, and on a sweep every player marked dirty since it was last written
      // (v1128 dirty tracking: presence, pruned receipts - a clean player is never stringified)
      const declared = new Set(); for (const id of userIds) if (typeof id === 'string' && id) declared.add(id);
      const cand = new Set(declared);
      if (slice && slice.of > 0) { S.slices++; for (const id of st.dirty) if (!declared.has(id)) { cand.add(id); S.sweepLooked++; } st.dirty.clear(); }
      else for (const id of declared) st.dirty.delete(id);
      S.dirtyNow = st.dirty.size;
      const { by, coreIdem } = receiptsIndexed(db, cand, slice);   // v1134: was receiptsOf - a walk of every receipt per save
      const units = [], receipts = [];
      for (const id of cand) {
        const had = st.rk.get(id);
        if (!Object.prototype.hasOwnProperty.call(users, id)) {   // a player who is gone, and every receipt written for them
          if (st.usig.has(id)) { units.push([id, null, true]); st.usig.delete(id); if (st.vhash) st.vhash.delete(id); }
          if (had) { for (const k of had) receipts.push([k, null]); st.rk.delete(id); }
          continue; }
        const prev = st.usig.get(id), r = DIFF.diff(users[id], prev);
        if (r.patch !== null) { units.push([id, r.patch, !prev]); bytes += r.patch.length; unitN++; if (st.vhash) st.vhash.set(id, md5(vclean(users[id]))); }
        else if (declared.has(id)) S.unitsSkipped++; else S.sweepSkipped++;
        st.usig.set(id, r.sig);
        const keys = by.get(id) || [], now = new Set(keys);
        for (const k of keys) if (!had || !had.has(k)) { const v = JSON.stringify(idem[k]); receipts.push([k, v]); bytes += v.length; }
        if (had) for (const k of had) if (!now.has(k)) receipts.push([k, null]);
        if (keys.length) st.rk.set(id, now); else st.rk.delete(id);
      }
      // shared pieces: the declared ones (or all), written when they differ from what was last written; a removed one is null
      const cp = coreParts(db, coreIdem), pieces = [], declaredP = dirtyPieces ? new Set(dirtyPieces) : null;
      /* v1134: flagged pieces (FLAGGED_PIECES) only when the save named them or they were marked dirty - never stringified just to
         find out nothing changed; a save that names nothing still compares the small unflagged ones. A sweep slice audits one
         flagged piece in turn (a change nobody marked is written there and counted). */
      const written = k => st.plast.has(k), look = lookAt(cp.keys, declaredP, written, true), considered = look.out;
      for (const [k, keys] of look.subs) {   // v1134: an object piece marked by key: a patch of those keys only (tokens on a sign-in, watch on an attack)
        const r = subPatch(k, cp.val(k), keys); if (r === false) { considered.add(k); continue; }
        S.piecesLooked++; if (r === null) { S.piecesSkipped++; continue; }
        st.plast.set(k, null); st.pflag.delete(k); pieces.push([k, r, false]); bytes += r.length; }
      const audit = (slice && slice.of > 0) ? auditKey(cp.keys, considered, written) : null;
      if (audit) { const v = JSON.stringify(cp.val(audit)); S.pieceAudits++; S.pieceBytesLooked += v.length; const was = st.plast.get(audit);
        if (was !== v) { if (was === null && DIFF.diff({ v: cp.val(audit) }, st.psig.get(audit)).patch === null) st.plast.set(audit, v);   // after key patches: unchanged
          else { noteMissed(audit); considered.add(audit); } } }
      for (const k of considered) { const v = JSON.stringify(cp.val(k)); S.piecesLooked++; S.pieceBytesLooked += v === undefined ? 0 : v.length; if (st.plast.get(k) === v) { S.piecesSkipped++; continue; }
        const prev = st.psig.get(k), r = DIFF.diff({ v: cp.val(k) }, prev);
        st.plast.set(k, v); st.psig.set(k, r.sig); st.pflag.delete(k); if (r.patch === null) continue;
        pieces.push([k, r.patch, !prev]); bytes += r.patch.length; }
      for (const k of [...st.plast.keys()]) if (!cp.keys.has(k)) { pieces.push([k, null, true]); st.plast.delete(k); st.psig.delete(k); }
      const coreStr = JSON.stringify(cp.inline), core = coreStr !== st.jcore ? coreStr : null; if (core !== null) { st.jcore = coreStr; bytes += coreStr.length; }
      if (units.length || receipts.length || pieces.length || core !== null) ops.push({ j: 'rec', units, receipts, pieces, core });
      S.partial++; S.lastShards = 0; S.unitsWritten += unitN; S.receiptsWritten += receipts.length; S.piecesWritten += pieces.length; S.lastPieces = pieces.map(p => p[0]); S.bytes.journal += bytes;
      if (st.verify) verifyUnits(db, cand, cp, considered);
    }
    const ms = Date.now() - t0; S.lastMs = ms; S.mainMs += ms; if (ms > S.mainMaxMs) S.mainMaxMs = ms;
    return { ops, lazy: null };
  }
  /* DB_STORE_VERIFY=1 (journal): after a partial save, every player it did not look at is compared with what was last written for it
     (presence ignored) - a difference is a change no save declared; and every piece it did not look at. Counted, never fatal. */
  function verifyUnits(db, looked, cp, considered) {
    const users = db.users || {}, bad = [];
    for (const id of Object.keys(users)) { if (looked.has(id) || !st.vhash.has(id)) continue;
      const h = md5(vclean(users[id])); if (h !== st.vhash.get(id)) { bad.push(id); st.vhash.set(id, h); } }
    if (bad.length) { st.stats.undeclared += bad.length; st.stats.undeclaredIds = st.stats.undeclaredIds.concat(bad).slice(-20);
      console.error('world store verify: ' + bad.length + ' player(s) changed outside their save: ' + bad.slice(0, 5).join(', ')); }
    const badP = [];
    for (const k of cp.keys) { if (considered.has(k) || st.pflag.has(k) || !st.plast.has(k)) continue; const was = st.plast.get(k);
      const changed = was === null ? DIFF.diff({ v: cp.val(k) }, st.psig.get(k)).patch !== null : JSON.stringify(cp.val(k)) !== was;   // v1134: after key patches the signature is the record
      if (changed) { badP.push(k); st.pflag.add(k); } }
    if (badP.length) { st.stats.undeclaredPieces += badP.length; st.stats.undeclaredPieceNames = st.stats.undeclaredPieceNames.concat(badP).slice(-20);
      console.error('world store verify: shared piece(s) changed outside their save: ' + badP.join(', ')); }
  }
  /* what is on disk right after a load: the receipt keys of each player, the pieces and the inline core. v1128 dirty tracking: no
     player signature is built at boot (2.7 s on 8,500 players) - a player's first write after a boot is the whole player - except
     for DB_STORE_VERIFY, which compares every player. */
  function seedUnits(db, players) { st.rscan = true; st.rnew = new Map();
    const users = db.users || {}, { by, coreIdem } = receiptsOf(db, null); st.usig = new Map(); st.rk = new Map(); st.dirty = new Set(); if (st.verify) st.vhash = new Map();
    for (const id of Object.keys(users)) { if (players) st.usig.set(id, DIFF.diff(users[id], null).sig); if (st.vhash) st.vhash.set(id, md5(vclean(users[id]))); const k = by.get(id); if (k) st.rk.set(id, new Set(k)); }
    const cp = coreParts(db, coreIdem); st.jcore = JSON.stringify(cp.inline);
    st.plast = new Map(); st.psig = new Map(); for (const k of cp.keys) { st.plast.set(k, JSON.stringify(cp.val(k))); st.psig.set(k, DIFF.diff({ v: cp.val(k) }, null).sig); }
  }

  // a save that is on disk when it returns (throws if it did not commit)
  function write(db, userIds, dirtyPieces, slice) {
    const j = prepare(db, userIds, dirtyPieces, slice);
    try { io().submitSync(j.ops, j.lazy); } catch (e) { st.broken = true; throw e; }
  }
  /* v1128: a save whose files the io worker writes - resolves once its manifest is renamed into place, rejects if it did not commit
     (and every save submitted after it before the failure was seen fails too). With DB_STORE_IO=sync it is the synchronous save. */
  function writeAsync(db, userIds, dirtyPieces, slice) {
    let j; try { j = prepare(db, userIds, dirtyPieces, slice); } catch (e) { return Promise.reject(e); }
    return io().submit(j.ops, j.lazy).catch(e => { st.broken = true; throw e; });
  }

  /* DB_STORE_VERIFY=1: after a partial save, every shard it did NOT write is compared with what was last written for it. A
     difference is a change made outside the players the action declared - it would wait for the next full save. Logged and
     counted (save-stats), never fatal. Presence (lastSeen) is deliberately not saved per request and is ignored. */
  function verifyAfter(db, strs, full) {
    if (!st.last) st.last = new Map();
    if (!full) {
      const { parts } = split(db, null), bad = [];
      for (const [s, p] of parts) {
        if (strs.has(s) || !st.last.has(s)) continue;
        const now = JSON.stringify(p, (k, v) => k === 'lastSeen' ? undefined : v);
        if (now !== st.last.get(s).clean) {
          const was = JSON.parse(st.last.get(s).raw);
          for (const id of new Set([...Object.keys(p.users), ...Object.keys(was.users || {})]))
            if (JSON.stringify(p.users[id] || null, (k, v) => k === 'lastSeen' ? undefined : v) !== JSON.stringify((was.users || {})[id] || null, (k, v) => k === 'lastSeen' ? undefined : v)) bad.push(id);
          st.last.set(s, { raw: JSON.stringify(p), clean: now });
        }
      }
      if (bad.length) { st.stats.undeclared += bad.length; st.stats.undeclaredIds = st.stats.undeclaredIds.concat(bad).slice(-20);
        console.error('world store verify: ' + bad.length + ' player(s) changed outside their save: ' + bad.slice(0, 5).join(', ')); }
    }
    for (const [s, str] of strs) st.last.set(s, { raw: str, clean: JSON.stringify(JSON.parse(str), (k, v) => k === 'lastSeen' ? undefined : v) });
  }
  /* v1127, DB_STORE_VERIFY=1: after a save that declared its pieces, every piece it did not look at is compared with what was last
     written. A difference is a shared system changed by a route that did not name it: it waits for the next save that compares
     everything (any undeclared save, the sweep). Counted once per piece until it is written (save-stats undeclaredPieces). */
  function verifyPieces(core, considered) {
    const bad = [];
    for (const k of Object.keys(core)) {
      if (considered.has(k) || core[k] === undefined || !PIECE_KEY.test(k) || st.pflag.has(k) || !st.plast.has(k)) continue;
      if (JSON.stringify(core[k]) !== st.plast.get(k)) { bad.push(k); st.pflag.add(k); }
    }
    if (bad.length) { st.stats.undeclaredPieces += bad.length; st.stats.undeclaredPieceNames = st.stats.undeclaredPieceNames.concat(bad).slice(-20);
      console.error('world store verify: shared piece(s) changed outside their save: ' + bad.join(', ')); }
  }

  return { get split() { return st.split; }, get layout() { return st.layout; }, get pieces() { return st.split && st.pieces; },
    get layoutMismatch() { return st.split && st.layout !== null && st.layout !== configured(); }, get journal() { return JOURNAL; },
    touch(id) { if (st.split && typeof id === 'string' && id) st.dirty.add(id); },
    markPiece(k, sub) { if (!(st.split && st.pieces && typeof k === 'string' && k)) return; st.stats.piecesMarked++;   // v1134: a shared piece changed - the next save looks at it
      if (sub === undefined) { st.pdirty.add(k); return; }   // the whole piece; with `sub` only that key of an object piece (journal: a patch of the marked keys)
      let m = st.psub.get(k); if (!m) { m = new Set(); st.psub.set(k, m); } if (m.size < 4096) m.add(typeof sub === 'string' ? sub : null); else st.pdirty.add(k); },
    get flagged() { return [...FLAGGED]; },
    noteReceipt(k) { if (!st.split || typeof k !== 'string' || !k) return; const o = ownerOf(k);   // v1134: a request receipt was written (RECEIPT INDEX)
      if (o === null) { st.rcore.add(k); return; } let s = st.rnew.get(o); if (!s) { s = new Set(); st.rnew.set(o, s); } if (s.size < 10000) s.add(k); else st.rscan = true; },   // v1128: a change no save declared (presence, a pruned receipt) - the next sweep writes it
    get dirtyCount() { return st.dirty.size; },
    get broken() { return st.broken; }, get ioAsync() { return io().async; }, get ioPending() { return io().pending; },
    stats: st.stats, load, write, writeAsync, flush: () => io().flush(), io, sweepOrphans, shardOf, ownerOf, dir };
}

/* Tools outside the server (setpass, restores): readWorld/writeWorld take any layout. writeWorld keeps the file's layout.
   Stop the game first - it keeps the world in memory and writes it back. */
function readWorld(file) { return create(file).load(); }
function layoutOf(file) { try { const r = JSON.parse(fs.readFileSync(file, 'utf8')); return r && r.__store === FORMAT ? (r.layout === JLAYOUT ? 'journal' : r.layout === LAYOUT ? 'pieces' : 'split-v1') : 'file'; } catch (e) { return 'file'; } }
function writeWorld(file, db) {
  const lay = layoutOf(file);
  if (lay === 'file') { const tmp = file + '.tool.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, file); return; }
  const s = create(file, { split: true, pieces: lay !== 'split-v1', journal: lay === 'journal' }); s.load(); s.write(db, null);
}

// v1128: every file under <DB_FILE>.d the manifest names (base / shard files, pieces, journals) - tools and tests
function namedFiles(file) { const r = JSON.parse(fs.readFileSync(file, 'utf8')); if (!r || r.__store !== FORMAT) return new Set();
  const shards = r.layout === JLAYOUT ? (r.baseGens || []).map((g, s) => g > 0 ? s + '-' + g + '.json' : null).filter(Boolean) : Object.values(shardNamesOf(r) || {});
  return new Set([...shards, ...Object.values(r.pieces || {}), ...(r.journals || [])]); }
module.exports = { create, readWorld, writeWorld, layoutOf, namedFiles, shardOf, ownerOf, shardNamesOf, SHARDS, FORMAT, LAYOUT, JLAYOUT, FLAGGED_PIECES };

// CLI (stop the game first):
//   node server/world-store.js export <DB_FILE> <out.json>   - the whole world as one plain JSON file (any layout)
//   node server/world-store.js downgrade <DB_FILE>           - rewrite a pieces-layout world as split-v1 (code before v1127 reads it)
//   node server/world-store.js layout <DB_FILE>              - print the layout: file | split-v1 | pieces
if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'export' && a && b) { fs.writeFileSync(b, JSON.stringify(readWorld(a))); console.log('exported ' + a + ' -> ' + b); }
  else if (cmd === 'downgrade' && a) { const was = layoutOf(a); if (was === 'file') { console.log(a + ' is a one-file world - nothing to do'); }
    else { const s = create(a, { split: true, pieces: false, journal: false }); const db = s.load(); s.write(db, null); console.log('downgraded ' + a + ' (' + was + ' -> ' + layoutOf(a) + ', ' + Object.keys(db.users || {}).length + ' players)'); } }
  else if (cmd === 'layout' && a) console.log(layoutOf(a));
  else { console.log('usage: node server/world-store.js export <DB_FILE> <out.json> | downgrade <DB_FILE> | layout <DB_FILE>'); process.exitCode = 1; }
}
