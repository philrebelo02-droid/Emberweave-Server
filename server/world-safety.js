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
  try { const side = fs.readdirSync(dir).filter(f => f !== base && f.startsWith(base) && f !== base + '.d' && f !== base + '.m'); if (side.length) evidence.push('side files of the world: ' + side.slice(0, 5).join(', ')); }
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
  const man = picked.manifest, db = Object.assign({}, man.core); db.users = {}; const idem = Object.assign({}, (man.core && man.core.idem) || {});
  for (let s = 0; s < (man.count || 128); s++) { const p = readJSON(path.join(dir, man.shards[s])); Object.assign(db.users, p.users || {}); Object.assign(idem, p.idem || {}); }
  db.idem = idem;
  out.players = Object.keys(db.users).length; out.realPlayers = realPlayerCount(db); out.npcs = Object.values(db.users).filter(u => u && u.isNpc).length;
  out.digest = worldDigest(db).all; out.gen = man.gen;
  if (!opts.write) return out;
  // write: the current world file (if any) is kept beside it, the manifest is written atomically, unused shard files are MOVED
  // aside (never deleted) so the next boot's sweep cannot remove them
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (fs.existsSync(file)) { fs.renameSync(file, file + '.before-recover-' + stamp); out.keptOld = file + '.before-recover-' + stamp; }
  const keep = new Set(Object.values(man.shards)), aside = file + '.d.recover-' + stamp; let moved = 0;
  for (const f of fs.readdirSync(dir)) if (/^\d+-\d+\.json$/.test(f) && !keep.has(f)) { fs.mkdirSync(aside, { recursive: true }); fs.renameSync(path.join(dir, f), path.join(aside, f)); moved++; }
  if (moved) { out.movedAside = moved; out.asideDir = aside; fsyncDir(dir); }
  writeAtomic(file, picked.text, '.recover.tmp');
  const back = WS.readWorld(file);
  out.verified = worldDigest(back).all === out.digest; out.wrote = true;
  return out;
}

module.exports = { fsyncFile, fsyncDir, flushBatch, writeDurable, writeAtomic, freshInstall, isWorld, isRealPlayer, realPlayerCount,
  readPinMeta, rotateBackups, pinVerdict, backupWorld, pushVerdict, canon, worldDigest, recover, PIN, PIN_META };
