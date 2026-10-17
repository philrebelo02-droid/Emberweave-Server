'use strict';
/* v1183 WORLD-LOAD SAFETY (16 Oct 2026, after a power cut left a NUL manifest and a boot replaced the world with an empty one).
   1. freshInstall(): the ONLY case where a world that will not load may become an empty world - nothing of a world exists yet.
   2. durable writes: fsyncFile / fsyncDir / writeDurable / writeAtomic - a save is on the disk, not in the page cache, before the
      manifest (or the one-file world) is swapped, and the swap itself is flushed.
   3. backups: rotation by mtime (never by name) and a PINNED backup of the last world with real players, never rotated and never
      replaced by a world with 0 real players or one that lost more than half of them.
   4. the off-site push is skipped for a world with 0 real players or one that lost more than half against the pinned backup.
   5. recover(): rebuild a split-store manifest from the files that survive in <DB_FILE>.m/ (exact) or <DB_FILE>.d/ (players
      exact, the shared world from the newest backup). Dry run unless asked to write. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

/* ---------------------------------------------------------------- durable writes */
function fsyncFile(p) { const fd = fs.openSync(p, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function fsyncDir(d) {   // a rename or a new file name is durable only once its directory is flushed (Linux; Windows cannot open a dir)
  if (process.platform === 'win32') return;
  let fd; try { fd = fs.openSync(d, 'r'); } catch (e) { return; }
  try { fs.fsyncSync(fd); } catch (e) { if (e.code === 'EIO') throw e; } finally { fs.closeSync(fd); }
}
// many new files at once: ONE filesystem flush (syncfs through `sync -f <path>`, Linux) - an fsync per file costs a disk cache flush
// each (512 shards = 5-20 s on the cluster's SSDs, measured 16 Oct). Falls back to an fsync per file + its directories where
// `sync -f` is missing (Windows dev machines, minimal images). A failed flush throws: the save did not happen.
let _syncfs = null;   // null = untried, true = works, false = unavailable
function flushBatch(files, dirs, onFs) {
  if (process.platform !== 'win32' && _syncfs !== false) {
    try { require('child_process').execFileSync('sync', ['-f', onFs], { stdio: 'ignore', timeout: 60000 }); _syncfs = true; return 'syncfs'; }
    catch (e) { if (_syncfs === true) throw e; _syncfs = false; console.error('world store: `sync -f` unavailable (' + (e.code || e.message) + ') - one fsync per file instead'); }
  }
  for (const f of files) fsyncFile(f);
  for (const d of dirs) fsyncDir(d);
  return 'fsync';
}
function writeDurable(p, str) { fs.writeFileSync(p, str); fsyncFile(p); }
function writeAtomic(p, str, suffix) {   // temp + fsync + rename + fsync the directory
  const tmp = p + (suffix || '.safe.tmp'), dir = path.dirname(p);
  writeDurable(tmp, str); fsyncDir(dir); fs.renameSync(tmp, p); fsyncDir(dir);
}

/* ---------------------------------------------------------------- fresh install */
// A world that will not load may start empty ONLY if nothing of a world exists: no world file (manifest or one-file), no shard
// directory with files in it, no manifest copies, no backups, and no leftover temp/side files of the world file.
function freshInstall(file) {
  const evidence = [], dir = path.dirname(file), base = path.basename(file);
  const exists = p => { try { fs.lstatSync(p); return true; } catch (e) { return e.code !== 'ENOENT'; } };   // unreadable = exists
  const nonEmptyDir = p => { try { return fs.readdirSync(p).length > 0; } catch (e) { return e.code !== 'ENOENT'; } };
  if (exists(file)) evidence.push('the world file ' + file + ' exists');
  if (nonEmptyDir(file + '.d')) evidence.push('the shard folder ' + file + '.d has files');
  if (nonEmptyDir(file + '.m')) evidence.push('the manifest copies folder ' + file + '.m has files');
  try { const b = fs.readdirSync(path.join(dir, 'backups')).filter(f => !f.endsWith('.tmp')); if (b.length) evidence.push(b.length + ' backup file(s) in ' + path.join(dir, 'backups')); }
  catch (e) { if (e.code !== 'ENOENT') evidence.push('the backups folder is unreadable (' + e.code + ')'); }
  // v1185: <DB_FILE>.checks (the fight-check backlog, server/check-backlog.js) is made at start-up before the world loads - it is
  // evidence of a world only when a file in it holds something (a waiting check)
  const emptyChecks = f => { if (f !== base + '.checks') return false; try { return fs.readdirSync(path.join(dir, f)).every(x => fs.statSync(path.join(dir, f, x)).size === 0); } catch (e) { return false; } };
  try { const side = fs.readdirSync(dir).filter(f => f !== base && f.startsWith(base) && f !== base + '.d' && f !== base + '.m' && !emptyChecks(f)); if (side.length) evidence.push('side files of the world: ' + side.slice(0, 5).join(', ')); }
  catch (e) { if (e.code !== 'ENOENT') evidence.push('the data folder is unreadable (' + e.code + ')'); }
  return { fresh: evidence.length === 0, evidence };
}
function isWorld(db) { return !!db && typeof db === 'object' && !Array.isArray(db) && !!db.users && typeof db.users === 'object' && !Array.isArray(db.users); }

/* ---------------------------------------------------------------- real players */
// a real player: not an NPC, not a guest, not a load-test account (names LT-...)
function isRealPlayer(u) { return !!u && typeof u === 'object' && !u.isNpc && !u.guest && !/^LT-/i.test(String(u.name || '')); }
function realPlayerCount(db) { let n = 0; const us = (db && db.users) || {}; for (const id in us) if (isRealPlayer(us[id])) n++; return n; }

/* ---------------------------------------------------------------- backups */
const PIN = 'pinned-last-real.json', PIN_META = 'pinned-last-real.meta.json';
function readPinMeta(bdir) {
  try { const m = JSON.parse(fs.readFileSync(path.join(bdir, PIN_META), 'utf8')); if (m && typeof m.real === 'number') return m; } catch (e) {}
  try { const db = JSON.parse(fs.readFileSync(path.join(bdir, PIN), 'utf8')); return { real: realPlayerCount(db), at: 0, from: '(meta rebuilt)' }; } catch (e) {}
  return null;
}
// keep the newest `keep` db-*.json by mtime (a name sorts by the clock that wrote it, not by when it landed)
function rotateBackups(bdir, keep) {
  const files = [];
  for (const f of fs.readdirSync(bdir)) { if (!/^db-.*\.json$/.test(f)) continue; try { files.push({ f, m: fs.statSync(path.join(bdir, f)).mtimeMs }); } catch (e) {} }
  files.sort((a, b) => a.m - b.m || (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
  const gone = [];
  while (files.length > keep) { const o = files.shift(); try { fs.unlinkSync(path.join(bdir, o.f)); gone.push(o.f); } catch (e) {} }
  return gone;
}
// should a backup with `real` real players replace the pinned one?
function pinVerdict(real, pinnedReal) {
  if (!(real > 0)) return { pin: false, why: 'this backup has 0 real players' };
  if (pinnedReal > 0 && real < pinnedReal * 0.5) return { pin: false, why: 'real players fell from ' + pinnedReal + ' to ' + real + ' (more than half)' };
  return { pin: true, why: real + ' real players' };
}
// one hourly backup: db-<stamp>.json (atomic + fsync), rotation by mtime, then the pinned copy if this world earns it
function backupWorld(db, dbFile, opts) {
  opts = opts || {};
  const bdir = path.join(path.dirname(dbFile), 'backups'); fs.mkdirSync(bdir, { recursive: true });
  const body = JSON.stringify(db), real = realPlayerCount(db);
  const now = opts.now || new Date(), stamp = now.toISOString().replace(/[:.]/g, '-'), name = 'db-' + stamp + '.json';
  writeAtomic(path.join(bdir, name), body, '.tmp');
  const rotated = rotateBackups(bdir, opts.keep || 48);
  const meta = readPinMeta(bdir), v = pinVerdict(real, meta ? meta.real : 0);
  if (v.pin) { writeAtomic(path.join(bdir, PIN), body, '.tmp'); writeAtomic(path.join(bdir, PIN_META), JSON.stringify({ real, at: now.getTime(), from: name }), '.tmp'); }
  return { name, real, rotated, pinned: v.pin, pinWhy: v.why, pinnedReal: v.pin ? real : (meta ? meta.real : 0) };
}
// the off-site push: skip a world with no real players, or one that lost more than half of the pinned backup's
function pushVerdict(real, pinnedReal) {
  if (!(real > 0)) return { push: false, why: 'the world has 0 real players' };
  if (pinnedReal > 0 && real < pinnedReal * 0.5) return { push: false, why: 'real players fell from ' + pinnedReal + ' (pinned backup) to ' + real + ' - more than half' };
  return { push: true, why: real + ' real players (pinned ' + (pinnedReal || 0) + ')' };
}

/* ---------------------------------------------------------------- digests (tests, recover reports) */
function canon(v) {   // key-sorted JSON, so two equal worlds digest the same whatever their key order
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function worldDigest(db) {
  const users = {}, core = {};
  for (const id of Object.keys(db.users || {})) users[id] = sha(canon(db.users[id]));
  for (const k of Object.keys(db)) if (k !== 'users') core[k] = sha(canon(db[k]));
  return { all: sha(canon(db)), users, core };
}

/* ---------------------------------------------------------------- recover */
function recover(file, opts) {
  opts = opts || {};
  const WS = require('./world-store.js');
  const dir = file + '.d', mdir = file + '.m', out = { file, source: null, warnings: [], wrote: false };
  const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
  // 1. a manifest copy whose shards all exist and parse: the exact last committed world
  let picked = null;
  let copies = []; try { copies = fs.readdirSync(mdir).map(f => { const m = /^manifest-(\d+)\.json$/.exec(f); return m ? { f, g: +m[1] } : null; }).filter(Boolean).sort((a, b) => b.g - a.g); } catch (e) {}
  for (const c of copies) {
    try {
      const man = readJSON(path.join(mdir, c.f));
      if (!man || man.__store !== WS.FORMAT) throw Error('not a manifest');
      if (man.layout) {   // v1185: a pieces / journal manifest - the store itself loads it against the live .d (every base, piece and journal it names)
        const db = WS.create(path.join(mdir, c.f), { dir }).load();
        picked = { manifest: man, text: fs.readFileSync(path.join(mdir, c.f), 'utf8'), db, keep: WS.namedFiles(path.join(mdir, c.f)) };
        out.source = 'manifest copy ' + c.f + ' (exact: the last committed save, layout ' + man.layout + ')'; break;
      }
      const count = man.count || 128;
      for (let s = 0; s < count; s++) { const n = man.shards && man.shards[s]; if (!n) throw Error('shard ' + s + ' not named'); readJSON(path.join(dir, n)); }
      picked = { manifest: man, text: JSON.stringify(man) }; out.source = 'manifest copy ' + c.f + ' (exact: the last committed save)'; break;
    } catch (e) { out.warnings.push('manifest copy ' + c.f + ' unusable: ' + e.message); }
  }
  // 2. no usable copy: the newest readable shard file of every shard + the shared world from the newest backup
  let chosen = null;
  if (!picked) {
    const by = new Map(); let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { out.error = 'no shard folder ' + dir; return out; }
    // v1185: a pieces / journal world (no usable manifest copy): rebuild it from what is in .d - see recoverLayout()
    if (files.some(f => /^p-[A-Za-z0-9_$]{1,64}-\d+\.json$/.test(f) || /^j-\d+\.log$/.test(f))) return recoverLayout(file, files, opts, out);
    for (const f of files) { const m = /^(\d+)-(\d+)\.json$/.exec(f); if (!m) continue; const s = +m[1]; if (!by.has(s)) by.set(s, []); by.get(s).push({ f, g: +m[2] }); }
    chosen = {}; const missing = []; let gen = 0;
    for (let s = 0; s < WS.SHARDS; s++) {
      const list = (by.get(s) || []).sort((a, b) => b.g - a.g); let got = null;
      for (const c of list) { try { readJSON(path.join(dir, c.f)); got = c; break; } catch (e) { out.warnings.push('shard file ' + c.f + ' unreadable (' + e.message + '), trying an older one'); } }
      if (!got) missing.push(s); else { chosen[s] = got.f; gen = Math.max(gen, got.g); }
    }
    if (missing.length) { out.error = missing.length + ' shard(s) have no readable file: ' + missing.slice(0, 10).join(','); out.missing = missing; return out; }
    // the shared world (everything but players): newest readable backup by mtime, or --core <file>
    let coreFrom = opts.core || null, coreDb = null;
    if (!coreFrom) {
      const bdir = path.join(path.dirname(file), 'backups'); let cands = [];
      try { cands = fs.readdirSync(bdir).filter(f => /^db-.*\.json$/.test(f) || f === PIN).map(f => ({ f: path.join(bdir, f), m: fs.statSync(path.join(bdir, f)).mtimeMs })).sort((a, b) => b.m - a.m); } catch (e) {}
      for (const c of cands) { try { const d = readJSON(c.f); if (isWorld(d)) { coreFrom = c.f; coreDb = d; break; } } catch (e) { out.warnings.push('backup ' + c.f + ' unreadable'); } }
    } else coreDb = readJSON(coreFrom);
    if (!coreDb || !isWorld(coreDb)) { out.error = 'no readable backup to take the shared world from (pass --core <file>)'; return out; }
    const users = {}; for (let s = 0; s < WS.SHARDS; s++) Object.assign(users, readJSON(path.join(dir, chosen[s])).users || {});
    const core = {}; for (const k of Object.keys(coreDb)) if (k !== 'users' && k !== 'idem') core[k] = coreDb[k];
    core.idem = {}; for (const k of Object.keys(coreDb.idem || {})) { const o = WS.ownerOf(k); if (o === null || !Object.prototype.hasOwnProperty.call(users, o)) core.idem[k] = coreDb.idem[k]; }
    // players newer than the backup are missing from its name and session tables: names are rebuilt, sessions need a new sign-in
    core.byName = Object.assign({}, core.byName || {}); let named = 0;
    for (const id of Object.keys(users)) { const u = users[id]; if (u && u.name && !u.isNpc) { const k = String(u.name).toLowerCase(); if (!core.byName[k]) { core.byName[k] = id; named++; } } }
    if (named) out.warnings.push(named + ' name(s) were not in the backup\'s name table and were rebuilt from the players');
    let st = null; try { st = fs.statSync(coreFrom); } catch (e) {}
    out.source = 'newest shard files (gen up to ' + gen + ') + the shared world from ' + coreFrom + (st ? ' (written ' + new Date(st.mtimeMs).toISOString() + ')' : '');
    out.warnings.push('the shared world (guilds, ladder, sessions, ...) is as of that backup, not the last save; players newer than it must sign in again');
    const man = { __store: WS.FORMAT, gen, count: WS.SHARDS, shards: chosen, core };
    picked = { manifest: man, text: JSON.stringify(man) };
  }
  // what the recovered world holds
  const man = picked.manifest; let db = picked.db;
  if (!db) { db = Object.assign({}, man.core); db.users = {}; const idem = Object.assign({}, (man.core && man.core.idem) || {});
    for (let s = 0; s < (man.count || 128); s++) { const p = readJSON(path.join(dir, man.shards[s])); Object.assign(db.users, p.users || {}); Object.assign(idem, p.idem || {}); }
    db.idem = idem; }
  out.players = Object.keys(db.users).length; out.realPlayers = realPlayerCount(db); out.npcs = Object.values(db.users).filter(u => u && u.isNpc).length;
  out.digest = worldDigest(db).all; out.gen = man.gen;
  if (opts.returnWorld) Object.defineProperty(out, 'world', { value: db, enumerable: false });   // checks only; never printed
  if (!opts.write) return out;
  // write: the current world file (if any) is kept beside it, the manifest is written atomically, unused shard files are MOVED
  // aside (never deleted) so the next boot's sweep cannot remove them
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (fs.existsSync(file)) { fs.renameSync(file, file + '.before-recover-' + stamp); out.keptOld = file + '.before-recover-' + stamp; }
  const keep = picked.keep || new Set(Object.values(man.shards)), aside = file + '.d.recover-' + stamp; let moved = 0;
  const storeFile = f => /^\d+-\d+\.json$/.test(f) || /^p-[A-Za-z0-9_$]{1,64}-\d+\.json$/.test(f) || /^j-\d+\.log$/.test(f);   // v1185: pieces and journals too
  for (const f of fs.readdirSync(dir)) if (storeFile(f) && !keep.has(f)) { fs.mkdirSync(aside, { recursive: true }); fs.renameSync(path.join(dir, f), path.join(aside, f)); moved++; }
  if (moved) { out.movedAside = moved; out.asideDir = aside; fsyncDir(dir); }
  writeAtomic(file, picked.text, '.recover.tmp');
  const back = WS.readWorld(file);
  out.verified = worldDigest(back).all === out.digest; out.wrote = true;
  return out;
}

/* v1185 recover for the pieces / journal layout when no manifest copy in .m is usable. The world is rebuilt from .d alone:
   - every shard: its newest readable base file <s>-<g>.json (missing -> error, as split-v1);
   - every shared piece: its newest readable p-<key>-<g>.json;
   - the journals j-<x>.log, in order, applied ONLY where they are newer than that base: a base of gen g written by a full save has
     j-g beside it (its own journal) - patches from j-g on; one written by a checkpoint was folded from the journals before the
     rotation that made j-(g-1) - patches from j-(g-1) on. Older journals (already folded, maybe not yet removed) are never re-applied.
   - the inline core (the few keys that are not pieces): the newest one in a journal, else from the newest backup.
   --write moves every store file in .d (and .m) ASIDE (never deleted) and writes the rebuilt world as ONE plain world file (atomic);
   the next boot of a split server writes it back as a journal world (a full save). */
function recoverLayout(file, files, opts, out) {
  const WS = require('./world-store.js'), J = require('./store-journal.js');
  const dir = file + '.d', readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
  const SH = WS.SHARDS, shards = new Map(), pfiles = new Map(), jlist = [];
  for (const f of files) { let m;
    if ((m = /^(\d+)-(\d+)\.json$/.exec(f))) { const s = +m[1]; if (!shards.has(s)) shards.set(s, []); shards.get(s).push({ f, g: +m[2] }); }
    else if ((m = /^p-([A-Za-z0-9_$]{1,64})-(\d+)\.json$/.exec(f))) { if (!pfiles.has(m[1])) pfiles.set(m[1], []); pfiles.get(m[1]).push({ f, g: +m[2] }); }
    else if ((m = /^j-(\d+)\.log$/.exec(f))) jlist.push({ f, g: +m[1] }); }
  jlist.sort((a, b) => a.g - b.g); const jgen = new Set(jlist.map(j => j.g));
  const from = g => jgen.has(g) ? g : g - 1;   // the first journal that is newer than a base / piece file of gen g
  const newest = list => { for (const c of (list || []).sort((a, b) => b.g - a.g)) { try { return { c, v: readJSON(path.join(dir, c.f)) }; } catch (e) { out.warnings.push(c.f + ' unreadable (' + e.message + '), trying an older one'); } } return null; };
  const db = { users: {} }, idem = {}, baseOf = new Array(SH).fill(0), missing = []; let G = 0;
  for (let s = 0; s < SH; s++) { const n = newest(shards.get(s)); if (!n) { missing.push(s); continue; } baseOf[s] = n.c.g; G = Math.max(G, n.c.g);
    Object.assign(db.users, n.v.users || {}); Object.assign(idem, n.v.idem || {}); }
  if (missing.length) { out.error = missing.length + ' shard(s) have no readable base file: ' + missing.slice(0, 10).join(','); out.missing = missing; return out; }
  const pieceFrom = {};
  for (const [k, list] of pfiles) { const n = newest(list); if (!n) continue; db[k] = n.v; pieceFrom[k] = from(n.c.g); }
  // the journals, oldest first: each player / receipt / piece patch applied only when its journal is newer than the file it sits on
  const units = new Map(), recs = new Map(), plist = new Map(); let core, lines = 0, torn = 0;
  for (const j of jlist) {
    let text; try { text = fs.readFileSync(path.join(dir, j.f), 'utf8'); } catch (e) { out.warnings.push('journal ' + j.f + ' unreadable (' + e.message + ') - skipped'); continue; }
    const r = J.parseJournal(text); if (r.torn) { torn++; out.warnings.push('journal ' + j.f + ': a torn last line was ignored'); }
    for (const rec of r.recs) { lines++;
      if (rec.u) for (const id of Object.keys(rec.u)) { if (j.g < from(baseOf[J.shardOfN(id, SH)])) continue; const v = rec.u[id]; let l = units.get(id); if (!l || v === null || (v && v.w !== undefined)) units.set(id, l = []); l.push(v); }
      if (rec.i) for (const k of Object.keys(rec.i)) { const o = WS.ownerOf(k); const t = o === null ? from(G) : from(baseOf[J.shardOfN(o, SH)]); if (j.g >= t) recs.set(k, rec.i[k]); }
      if (rec.p) for (const k of Object.keys(rec.p)) { const t = pieceFrom[k] !== undefined ? pieceFrom[k] : from(G); if (j.g < t) continue; const v = rec.p[k]; let l = plist.get(k); if (!l || v === null || (v && v.w !== undefined)) plist.set(k, l = []); l.push(v); }
      if (rec.c !== undefined && j.g >= from(G)) core = rec.c; } }
  for (const [id, list] of units) { const u = J.applyPatches(db.users[id], list); if (u === null) delete db.users[id]; else db.users[id] = u; }
  for (const [k, v] of recs) { if (v === null) delete idem[k]; else idem[k] = v; }
  for (const [k, list] of plist) { const v = J.applyPiece(db[k], list); if (v === undefined) delete db[k]; else db[k] = v; }
  // the inline core: from the journals, else the keys a piece does not hold from the newest backup
  if (core !== undefined) Object.assign(db, core);
  else {
    let coreDb = null, coreFrom = opts.core || null;
    if (coreFrom) { try { coreDb = readJSON(coreFrom); } catch (e) {} }
    else { const bdir = path.join(path.dirname(file), 'backups'); let c = [];
      try { c = fs.readdirSync(bdir).filter(f => /^db-.*\.json$/.test(f) || f === PIN).map(f => ({ f: path.join(bdir, f), m: fs.statSync(path.join(bdir, f)).mtimeMs })).sort((a, b) => b.m - a.m); } catch (e) {}
      for (const x of c) { try { const d = readJSON(x.f); if (isWorld(d)) { coreDb = d; coreFrom = x.f; break; } } catch (e) {} } }
    if (coreDb) { let n = 0; for (const k of Object.keys(coreDb)) if (k !== 'users' && k !== 'idem' && db[k] === undefined) { db[k] = coreDb[k]; n++; }
      if (n) out.warnings.push(n + ' shared key(s) that are not pieces came from ' + coreFrom); }
  }
  db.idem = Object.assign({}, db.idem || {}, idem);
  out.source = 'newest base / piece files in ' + dir + ' (base gen up to ' + G + ') + ' + jlist.length + ' journal(s) applied only past their base (' + lines + ' lines' + (torn ? ', ' + torn + ' torn tail(s) ignored' : '') + ')';
  out.players = Object.keys(db.users).length; out.realPlayers = realPlayerCount(db); out.npcs = Object.values(db.users).filter(u => u && u.isNpc).length;
  out.digest = worldDigest(db).all; out.gen = G; out.layout = 'journal (rebuilt)';
  if (opts.returnWorld) Object.defineProperty(out, 'world', { value: db, enumerable: false });
  if (!opts.write) return out;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (fs.existsSync(file)) { fs.renameSync(file, file + '.before-recover-' + stamp); out.keptOld = file + '.before-recover-' + stamp; }
  const aside = file + '.d.recover-' + stamp; fs.renameSync(dir, aside); out.asideDir = aside; out.movedAside = files.length;   // every store file kept, never deleted
  if (fs.existsSync(file + '.m')) { fs.renameSync(file + '.m', file + '.m.recover-' + stamp); out.asideManifestCopies = file + '.m.recover-' + stamp; }
  fsyncDir(path.dirname(file));
  writeAtomic(file, JSON.stringify(db), '.recover.tmp');   // one plain world file: the next split boot writes it back as a journal world
  out.verified = worldDigest(WS.readWorld(file)).all === out.digest; out.wrote = true;
  return out;
}

module.exports = { recoverLayout, fsyncFile, fsyncDir, flushBatch, writeDurable, writeAtomic, freshInstall, isWorld, isRealPlayer, realPlayerCount,
  readPinMeta, rotateBackups, pinVerdict, backupWorld, pushVerdict, canon, worldDigest, recover, PIN, PIN_META };
