'use strict';
/* v1037 PER-PLAYER STORAGE (Phil 5 Oct 2026: "do the real fix"). The war load test showed every server topping out on saving the
   WHOLE world once per batch of actions (25-38 MB copies: stringify + write of everything for a change to two players).

   Split store (DB_STORE=split): the world file becomes a small MANIFEST - the shared world (everything but players and receipts),
   plus the name of each of 512 player shard files in <DB_FILE>.d/. A shard holds its players and their request receipts (a
   receipt "<userId>:..." lives with that user). A save writes ONLY the shards it was told changed, each to a NEW file name, then
   swaps the manifest with one atomic rename. A crash at any point leaves the previous manifest, which names only complete files:
   a save is all or nothing, exactly as the one-file save was. Superseded shard files are removed after the swap.

   Without DB_STORE=split the server reads and writes the one-file world exactly as before. Either mode reads either format, so
   switching back is one restart (the next save writes the other format). */
const fs = require('fs'), path = require('path');
const SHARDS = 512, FORMAT = 'split-v1';   // 512: a war batch touching ~40 players rewrites ~8% of the world, not a third

function shardOf(id) {   // FNV-1a over the id - stable across restarts and Node versions
  let h = 0x811c9dc5; const s = String(id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % SHARDS;
}
function ownerOf(key) { const i = String(key).indexOf(':'); return i > 0 ? key.slice(0, i) : null; }

function create(file, opts) {
  opts = opts || {};
  const dir = file + '.d';
  const st = { split: !!opts.split, verify: !!opts.verify, gen: 0, names: null, last: null,
    stats: { full: 0, partial: 0, shardsWritten: 0, lastMs: 0, lastShards: 0, lastFullAt: 0, undeclared: 0, undeclaredIds: [] } };
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

  function load() {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || raw.__store !== FORMAT) { st.names = null; return raw; }   // the one-file world: the next split save writes every shard
    const db = raw.core || {}, idem = Object.assign({}, db.idem || {}); db.users = {};
    const count = raw.count || 128;   // a manifest written with another shard count loads whole; the next save re-shards it
    for (let s = 0; s < count; s++) {
      const name = raw.shards && raw.shards[s];
      if (!name) { const e = Error('world store: shard ' + s + ' is not in the manifest'); e.code = 'SHARD_MISSING'; throw e; }
      let p; try { p = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
      catch (err) { const e = Error('world store: shard file ' + name + ' unreadable (' + err.message + ')'); e.code = 'SHARD_MISSING'; throw e; }
      Object.assign(db.users, p.users || {}); Object.assign(idem, p.idem || {});
    }
    db.idem = idem; st.gen = raw.gen | 0; st.names = count === SHARDS ? Object.assign({}, raw.shards) : null;
    st.stats.lastFullAt = Date.now();   // what is on disk is the whole world: the sweep clock starts here
    return db;
  }

  // a server boot in split mode: shard files no manifest names are leftovers of a save that never committed
  function sweepOrphans() {
    if (!st.names) return 0; const keep = new Set(Object.values(st.names)); let n = 0;
    let files = []; try { files = fs.readdirSync(dir); } catch (e) { return 0; }
    for (const f of files) if (/^\d+-\d+\.json$/.test(f) && !keep.has(f)) { try { fs.unlinkSync(path.join(dir, f)); n++; } catch (e) {} }
    return n;
  }

  // userIds: null = save everything; else the players whose data (or receipts) changed. Throws if the save did not commit.
  function write(db, userIds) {
    const t0 = Date.now();
    const full = !userIds || !st.names;
    let want = null;
    if (!full) { want = new Set(); for (const id of userIds) want.add(sh(id)); }
    const { parts, core } = split(db, want);
    const gen = ++st.gen, names = Object.assign({}, st.names || {}), fresh = [], strs = st.verify ? new Map() : null;
    fs.mkdirSync(dir, { recursive: true });
    try {
      for (const [s, p] of parts) {
        const name = s + '-' + gen + '.json', str = JSON.stringify(p);
        fs.writeFileSync(path.join(dir, name), str); fresh.push(name); names[s] = name;
        if (strs) strs.set(s, str);
      }
      const tmp = file + '.store.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ __store: FORMAT, gen, count: SHARDS, shards: names, core }));
      fs.renameSync(tmp, file);
    } catch (e) {
      for (const f of fresh) { try { fs.unlinkSync(path.join(dir, f)); } catch (e2) {} }
      throw e;
    }
    const old = st.names || {};
    for (const s of Object.keys(names)) if (old[s] && old[s] !== names[s]) { try { fs.unlinkSync(path.join(dir, old[s])); } catch (e) {} }
    st.names = names;
    const ms = Date.now() - t0, S = st.stats;
    if (full) { S.full++; S.lastFullAt = Date.now(); } else S.partial++;
    S.shardsWritten += parts.size; S.lastMs = ms; S.lastShards = parts.size;
    if (strs) verifyAfter(db, strs, full);
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

  return { get split() { return st.split; }, stats: st.stats, load, write, sweepOrphans, shardOf, ownerOf, dir };
}

/* Tools outside the server (setpass, restores): readWorld/writeWorld take either format. writeWorld keeps the file's format.
   Stop the game first - it keeps the world in memory and writes it back. */
function readWorld(file) { return create(file).load(); }
function writeWorld(file, db) {
  let isSplit = false; try { isSplit = JSON.parse(fs.readFileSync(file, 'utf8')).__store === FORMAT; } catch (e) {}
  if (!isSplit) { const tmp = file + '.tool.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, file); return; }
  const s = create(file, { split: true }); s.load(); s.write(db, null);
}

module.exports = { create, readWorld, writeWorld, shardOf, ownerOf, SHARDS, FORMAT };

// CLI: node server/world-store.js export <DB_FILE> <out.json>   - the whole world as one plain JSON file (either format)
if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'export' && a && b) { fs.writeFileSync(b, JSON.stringify(readWorld(a))); console.log('exported ' + a + ' -> ' + b); }
  else { console.log('usage: node server/world-store.js export <DB_FILE> <out.json>'); process.exitCode = 1; }
}
