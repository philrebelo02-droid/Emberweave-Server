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
        writes nothing - restore step 1 and start again. Backups (one plain JSON file) are unaffected by the layout. */
const fs = require('fs'), path = require('path');
/* 512 (v1037): a war batch touching ~40 players rewrites ~8% of the world, not a third. v1127: DB_STORE_SHARDS changes it at a
   restart (a manifest from another count loads whole and the next save re-shards it). Measured 12 Oct on the 8500-player bench
   world under a war + chat mix: 2048 wrote 12 MB/s instead of 22 MB/s but each batch touched ~4x the files and the longest stall
   grew from 0.75 s to 2.5 s (Windows file creation) - 512 stays the default; try 2048 on Linux. */
const SHARDS = Math.max(16, Math.min(16384, +process.env.DB_STORE_SHARDS || 512)), FORMAT = 'split-v1', LAYOUT = 'pieces-v1';
const PIECE_KEY = /^[A-Za-z0-9_$]{1,64}$/, PIECE_FILE = /^p-([A-Za-z0-9_$]{1,64})-(\d+)\.json$/;

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
    pnames: null, plast: new Map(), pflag: new Set(), layout: null, shash: new Map(),
    stats: { full: 0, partial: 0, shardsWritten: 0, lastMs: 0, lastShards: 0, lastFullAt: 0, undeclared: 0, undeclaredIds: [],
      piecesWritten: 0, piecesSkipped: 0, slices: 0, sweepSkipped: 0, lastPieces: [], bytes: { shards: 0, pieces: 0, manifest: 0 }, undeclaredPieces: 0, undeclaredPieceNames: [] } };
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
    st.pnames = null; st.plast = new Map(); st.pflag = new Set(); st.shash = new Map();
    if (!raw || raw.__store !== FORMAT) { st.names = null; st.layout = 'file'; return raw; }   // the one-file world: the next split save writes every shard
    const pieced = raw.layout === LAYOUT, shardNames = shardNamesOf(raw);
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
    st.layout = pieced ? 'pieces' : 'split-v1';
    if (!st.names) { st.pnames = null; st.plast = new Map(); }   // re-sharded on the next save: every piece is written too
    st.stats.lastFullAt = Date.now();   // what is on disk is the whole world: the sweep clock starts here
    return db;
  }

  // a server boot in split mode: shard and piece files no manifest names are leftovers of a save that never committed
  function sweepOrphans() {
    if (!st.names) return 0; const keep = new Set([...Object.values(st.names), ...(st.pnames ? st.pnames.values() : [])]); let n = 0;
    let files = []; try { files = fs.readdirSync(dir); } catch (e) { return 0; }
    for (const f of files) if ((/^\d+-\d+\.json$/.test(f) || PIECE_FILE.test(f)) && !keep.has(f)) { try { fs.unlinkSync(path.join(dir, f)); n++; } catch (e) {} }
    return n;
  }

  /* userIds: null = save everything; else the players whose data (or receipts) changed. dirtyPieces: null/undefined = the shared
     systems that changed are not known (every piece is compared with what was last written); a Set/array of keys = only these can
     have changed. Throws if the save did not commit. */
  function write(db, userIds, dirtyPieces, slice) {   // v1127: slice {slice, of} = a sweep slice - every shard s with s % of === slice too
    const t0 = Date.now(), S = st.stats;
    const full = !userIds || !st.names;
    let want = null, sweepOnly = null;
    if (!full) { want = new Set(); for (const id of userIds) want.add(sh(id));
      if (slice && slice.of > 0) { sweepOnly = new Set(); for (let s = slice.slice % slice.of; s < SHARDS; s += slice.of) if (!want.has(s)) { want.add(s); sweepOnly.add(s); } S.slices++; } }
    const { parts, core } = split(db, want);
    const gen = ++st.gen, names = Object.assign({}, st.names || {}), fresh = [], strs = st.verify ? new Map() : null, newHash = new Map();
    let pnext = null, pstr = null, inline = core, considered = null;
    if (st.pieces) {
      inline = {}; pnext = new Map(st.pnames || []); pstr = new Map();
      const keys = new Set(); for (const k of Object.keys(core)) { if (core[k] === undefined) continue; if (PIECE_KEY.test(k)) keys.add(k); else inline[k] = core[k]; }
      for (const k of [...pnext.keys()]) if (!keys.has(k)) pnext.delete(k);   // a system that left the world: its file goes
      const declared = dirtyPieces ? new Set(dirtyPieces) : null;
      considered = (full || !declared || !st.pnames) ? keys : new Set([...keys].filter(k => declared.has(k) || !st.pnames.has(k)));
      for (const k of considered) {
        const s = JSON.stringify(core[k]);
        if (st.pnames && st.pnames.has(k) && st.plast.get(k) === s) { S.piecesSkipped++; continue; }
        pstr.set(k, s);
      }
    }
    fs.mkdirSync(dir, { recursive: true });
    let manifestBytes = 0, shardBytes = 0, pieceBytes = 0;
    try {
      for (const [s, p] of parts) {
        const str = JSON.stringify(p), hsh = fnv(str);
        if (sweepOnly && sweepOnly.has(s) && st.names && st.names[s] && st.shash.get(s) === hsh) { S.sweepSkipped++; continue; }   // v1127: a sweep shard that did not change keeps its file
        const name = s + '-' + gen + '.json';
        fs.writeFileSync(path.join(dir, name), str); fresh.push(name); names[s] = name; shardBytes += str.length; newHash.set(s, hsh);
        if (strs) strs.set(s, str);
      }
      if (pstr) for (const [k, s] of pstr) { const name = 'p-' + k + '-' + gen + '.json'; fs.writeFileSync(path.join(dir, name), s); fresh.push(name); pnext.set(k, name); pieceBytes += s.length; }
      const tmp = file + '.store.tmp';
      const man = st.pieces ? JSON.stringify({ __store: FORMAT, layout: LAYOUT, gen, count: SHARDS, shards: null, shardGens: Array.from({ length: SHARDS }, (_, s) => +String(names[s]).split('-')[1].split('.')[0]), pieces: Object.fromEntries(pnext), core: inline })
        : JSON.stringify({ __store: FORMAT, gen, count: SHARDS, shards: names, core });
      fs.writeFileSync(tmp, man); manifestBytes = man.length;
      fs.renameSync(tmp, file);
    } catch (e) {
      for (const f of fresh) { try { fs.unlinkSync(path.join(dir, f)); } catch (e2) {} }
      throw e;
    }
    const old = st.names || {};
    for (const s of Object.keys(names)) if (old[s] && old[s] !== names[s]) { try { fs.unlinkSync(path.join(dir, old[s])); } catch (e) {} }
    if (st.pnames) for (const [k, f] of st.pnames) if (!pnext || pnext.get(k) !== f) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) {} }   // superseded or removed pieces (all of them when going back to split-v1)
    st.names = names; for (const [s, h] of newHash) st.shash.set(s, h); S.lastShards = newHash.size;
    if (st.pieces) { st.pnames = pnext; for (const [k, s] of pstr) { st.plast.set(k, s); st.pflag.delete(k); } for (const k of [...st.plast.keys()]) if (!pnext.has(k)) st.plast.delete(k); st.layout = 'pieces'; }
    else { st.pnames = null; st.plast = new Map(); st.layout = 'split-v1'; }
    const ms = Date.now() - t0;
    if (full) { S.full++; S.lastFullAt = Date.now(); } else S.partial++;
    S.shardsWritten += newHash.size; S.lastMs = ms;
    S.piecesWritten += pstr ? pstr.size : 0; S.lastPieces = pstr ? [...pstr.keys()] : ['(inline)'];
    S.bytes.shards += shardBytes; S.bytes.pieces += pieceBytes; S.bytes.manifest += manifestBytes;
    if (strs) verifyAfter(db, strs, full);
    if (st.verify && st.pieces && considered && !full) verifyPieces(core, considered);
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
    get layoutMismatch() { return st.split && st.layout !== null && st.layout !== (st.pieces ? 'pieces' : 'split-v1'); },
    stats: st.stats, load, write, sweepOrphans, shardOf, ownerOf, dir };
}

/* Tools outside the server (setpass, restores): readWorld/writeWorld take any layout. writeWorld keeps the file's layout.
   Stop the game first - it keeps the world in memory and writes it back. */
function readWorld(file) { return create(file).load(); }
function layoutOf(file) { try { const r = JSON.parse(fs.readFileSync(file, 'utf8')); return r && r.__store === FORMAT ? (r.layout === LAYOUT ? 'pieces' : 'split-v1') : 'file'; } catch (e) { return 'file'; } }
function writeWorld(file, db) {
  const lay = layoutOf(file);
  if (lay === 'file') { const tmp = file + '.tool.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, file); return; }
  const s = create(file, { split: true, pieces: lay === 'pieces' }); s.load(); s.write(db, null);
}

module.exports = { create, readWorld, writeWorld, layoutOf, shardOf, ownerOf, shardNamesOf, SHARDS, FORMAT, LAYOUT };

// CLI (stop the game first):
//   node server/world-store.js export <DB_FILE> <out.json>   - the whole world as one plain JSON file (any layout)
//   node server/world-store.js downgrade <DB_FILE>           - rewrite a pieces-layout world as split-v1 (code before v1127 reads it)
//   node server/world-store.js layout <DB_FILE>              - print the layout: file | split-v1 | pieces
if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'export' && a && b) { fs.writeFileSync(b, JSON.stringify(readWorld(a))); console.log('exported ' + a + ' -> ' + b); }
  else if (cmd === 'downgrade' && a) { const was = layoutOf(a); if (was === 'file') { console.log(a + ' is a one-file world - nothing to do'); }
    else { const s = create(a, { split: true, pieces: false }); const db = s.load(); s.write(db, null); console.log('downgraded ' + a + ' (' + was + ' -> ' + layoutOf(a) + ', ' + Object.keys(db.users || {}).length + ' players)'); } }
  else if (cmd === 'layout' && a) console.log(layoutOf(a));
  else { console.log('usage: node server/world-store.js export <DB_FILE> <out.json> | downgrade <DB_FILE> | layout <DB_FILE>'); process.exitCode = 1; }
}
