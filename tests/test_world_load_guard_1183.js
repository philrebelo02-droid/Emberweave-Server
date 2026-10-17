'use strict';
// v1183 WORLD-LOAD GUARD (16 Oct 2026). A power cut left a NUL manifest; the boot caught the parse error, seeded an empty world of
// 5000 NPCs and saved it over the players; hourly backups then rotated the good world out. This test proves, on REAL server boots:
//   1. a manifest that is NUL, truncated, empty, "null" or missing -> the server exits non-zero and NOTHING on disk changes
//      (every file under the data folder byte-compared before/after) - split store and one-file world;
//   2. a genuinely brand-new install still boots and seeds;
//   3. backups rotate by mtime, a pinned "last with real players" backup is kept, and a backup with 0 real players never replaces it;
//   4. the off-site GitHub push is skipped at 0 real players (and on a drop of more than half), and still runs for a real world;
//   5. `node server/world-store.js recover <DB_FILE>` rebuilds the world exactly (field-by-field digest) from what survives.
// CONTROL: EW_ROOT=<a checkout of the live code> runs the same checks against it; the live code must FAIL.
// Ports: every server gets its own free port (another suite uses 8871).
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), vm = require('node:vm'), crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(process.env.EW_ROOT || path.join(__dirname, '..'));
const SERVER = path.join(root, 'server.js'), STORE_CLI = path.join(root, 'server/world-store.js');
const WS = require(path.join(root, 'server/world-store.js'));
console.log('code under test: ' + root);
let pass = 0, fail = 0; const failures = [];
const ok = (c, m) => { if (c) { pass++; console.log('  ok    ' + m); } else { fail++; failures.push(m); console.log('  FAIL  ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function canon(v) { if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; return JSON.stringify(v === undefined ? null : v); }
function digest(db) { const users = {}, core = {}; for (const id of Object.keys(db.users || {})) users[id] = sha(canon(db.users[id])); for (const k of Object.keys(db)) if (k !== 'users') core[k] = sha(canon(db[k])); return { all: sha(canon(db)), users, core }; }
function snapshot(dir) {   // every file under dir: relative path -> sha256 of its bytes
  const out = {}; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (!/\.log$/.test(e.name)) out[path.relative(dir, p)] = sha(fs.readFileSync(p)); } })(dir);
  return out; }
function sameSnap(a, b) { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); if (ka.join('|') !== kb.join('|')) return 'files differ: +' + kb.filter(k => !a[k]).slice(0, 4).join(',') + ' -' + ka.filter(k => !b[k]).slice(0, 4).join(','); for (const k of ka) if (a[k] !== b[k]) return 'bytes changed: ' + k; return ''; }
function copyDir(src, dst) { fs.cpSync(src, dst, { recursive: true }); }
const realCount = db => Object.values(db.users || {}).filter(u => u && !u.isNpc && !u.guest && !/^LT-/i.test(String(u.name || ''))).length;
const ENV = { ALLOW_NEW_GUESTS: '1', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', DB_FSYNC: '1' };

// boot a server; resolves when it listens (ready) or exits (code). Never leaves it running past `ms` (a live server that does not
// exit is killed and reported as 'still running').
function boot(dbFile, extraEnv, ms) {
  return new Promise(async resolve => {
    const port = await freePort(), logp = path.join(path.dirname(dbFile), 'boot-' + Date.now() + '.log');
    const env = Object.assign({}, process.env, ENV, { DB_FILE: dbFile, PORT: String(port) }, extraEnv || {});
    for (const k of ['GITHUB_BACKUP_TOKEN', 'GITHUB_BACKUP_REPO', 'DATABASE_URL', 'ADMIN_IDS']) delete env[k];
    const ch = spawn(process.execPath, [SERVER], { env, cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '', done = false;
    const fin = r => { if (done) return; done = true; clearTimeout(t); resolve(Object.assign({ port, child: ch, log: () => log }, r)); };
    ch.stdout.on('data', d => { log += d; if (/Emberweave cloud server on/.test(log)) fin({ ready: true }); });
    ch.stderr.on('data', d => { log += d; });
    ch.on('exit', code => fin({ exited: true, code }));
    const t = setTimeout(() => fin({ timeout: true }), ms || 25000);
  });
}
async function stop(b) { if (!b || !b.child || b.child.exitCode !== null) return; b.child.kill(); await new Promise(r => { b.child.once('exit', r); setTimeout(r, 5000); }); }
async function post(port, p, body) { const r = await fetch('http://127.0.0.1:' + port + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; }

// a boot on a damaged world: must exit non-zero, write nothing
async function expectRefusal(label, dataDir, dbFile, env) {
  const before = snapshot(dataDir);
  const b = await boot(dbFile, env, 20000);
  if (!b.exited) await stop(b);
  await sleep(300);
  const diff = sameSnap(before, snapshot(dataDir));
  ok(b.exited && b.code !== 0 && !b.ready, label + ': the server refuses to start (exit ' + (b.exited ? b.code : 'none - it ' + (b.ready ? 'started an EMPTY world' : 'hung')) + ')');
  ok(diff === '', label + ': nothing on disk changed (whole data folder byte-compared)' + (diff ? ' - ' + diff : ''));
  ok(/WORLD DID NOT LOAD/.test(b.log()), label + ': the refusal is logged loudly');
}

// a world with players, made by the code under test itself: fresh boot (seeds), 3 registered players, a guest, an LT- account
async function makeWorld(dir, env) {
  const dbFile = path.join(dir, 'emberweave-db.json');
  const b = await boot(dbFile, env, 60000);
  ok(b.ready, (env.DB_STORE ? 'split' : 'one-file') + ': a brand-new install (empty folder) boots');
  if (!b.ready) { console.log(b.log().slice(-2000)); return null; }
  for (let i = 0; i < 50 && !/Seeded \d+ NPC/.test(b.log()); i++) await sleep(100);   // printed right after the listen line
  ok(/Seeded 5000 NPC/.test(b.log()), (env.DB_STORE ? 'split' : 'one-file') + ': ... and seeds its 5000 NPC cities');
  for (const n of ['Alder', 'Briar', 'Cinder']) { const r = await post(b.port, '/api/register', { name: n + Math.floor(Math.random() * 1e6), pass: 'password1' }); if (r.status !== 200) console.log('register', r.status, JSON.stringify(r.body).slice(0, 200)); }
  await post(b.port, '/api/register', { name: 'LT-' + Math.floor(Math.random() * 1e6), pass: 'password1' });
  await sleep(1500);   // the debounced/full save
  await stop(b); await sleep(300);
  const world = WS.readWorld(dbFile);
  return { dbFile, world };
}

async function main() {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-loadguard-'));
  console.log('temp: ' + T);

  for (const mode of ['split', 'one-file']) {
    const env = mode === 'split' ? { DB_STORE: 'split' } : {};
    const base = path.join(T, mode + '-base'); fs.mkdirSync(base);
    const w = await makeWorld(base, env); if (!w) { ok(false, mode + ': world creation'); continue; }
    const names = path.basename(w.dbFile);
    ok(realCount(w.world) >= 3 && Object.values(w.world.users).filter(u => u.isNpc).length === 5000, mode + ': the saved world holds ' + realCount(w.world) + ' real players + 5000 NPCs');
    const orig = digest(w.world);
    const cases = [
      ['manifest NUL', f => { const n = fs.statSync(f).size; fs.writeFileSync(f, Buffer.alloc(n)); }],
      ['manifest truncated', f => { const s = fs.readFileSync(f); fs.writeFileSync(f, s.subarray(0, Math.floor(s.length / 2))); }],
      ['manifest empty (0 bytes)', f => fs.writeFileSync(f, '')],
      ['manifest "null"', f => fs.writeFileSync(f, 'null')],
      ['manifest missing', f => fs.renameSync(f, path.join(T, 'away-' + mode + '-' + Date.now()))],
    ];
    for (const [label, damage] of cases) {
      const d = path.join(T, mode + '-' + label.replace(/\W+/g, '_')); copyDir(base, d);
      const f = path.join(d, names); damage(f);
      await expectRefusal(mode + ' / ' + label, d, f, env);
    }
    // no world file and no shards, but backups exist: not a fresh install
    { const d = path.join(T, mode + '-only-backups'); fs.mkdirSync(d); copyDir(path.join(base, 'backups'), path.join(d, 'backups'));
      await expectRefusal(mode + ' / world gone, backups left', d, path.join(d, names), env); }
    if (mode === 'split') {
      const d = path.join(T, 'split-shards-only'); fs.mkdirSync(d); copyDir(path.join(base, names + '.d'), path.join(d, names + '.d'));
      await expectRefusal('split / world file gone, shard files left (no backups)', d, path.join(d, names), env);
    }
    // the healthy world still boots with the same players
    { const d = path.join(T, mode + '-healthy'); copyDir(base, d);
      const b = await boot(path.join(d, names), env, 60000);
      ok(b.ready && new RegExp('Player accounts loaded: ' + Object.values(w.world.users).filter(u => !u.isNpc).length + '\\b').test(b.log()), mode + ': the healthy world boots with every account');
      await stop(b); }

    if (mode === 'split') {
      // RECOVER - path 1: the manifest copy (exact)
      const d = path.join(T, 'split-recover'); copyDir(base, d); const f = path.join(d, names);
      fs.writeFileSync(f, Buffer.alloc(fs.statSync(f).size));
      const before = snapshot(d);
      const dry = spawnSync(process.execPath, [STORE_CLI, 'recover', f], { encoding: 'utf8' });
      let rep = null; try { rep = JSON.parse(dry.stdout.slice(dry.stdout.indexOf('{'), dry.stdout.lastIndexOf('}') + 1)); } catch (e) {}
      ok(dry.status === 0 && rep && rep.wrote === false && sameSnap(before, snapshot(d)) === '', 'recover: a dry run reports and writes nothing');
      const wr = spawnSync(process.execPath, [STORE_CLI, 'recover', f, '--write'], { encoding: 'utf8' });
      let got = null; try { got = WS.readWorld(f); } catch (e) {}
      const gd = got ? digest(got) : null;
      ok(wr.status === 0 && gd && gd.all === orig.all, 'recover: --write rebuilds the world EXACTLY (whole-world digest)' + (wr.status ? ' - ' + (wr.stdout + wr.stderr).slice(-200) : ''));
      ok(gd && Object.keys(orig.users).length === Object.keys(gd.users).length && Object.keys(orig.users).every(id => gd.users[id] === orig.users[id]) && Object.keys(orig.core).every(k => gd.core[k] === orig.core[k]),
        'recover: every player (' + Object.keys(orig.users).length + ') and every shared-world field matches field by field');
      ok(fs.existsSync(f + '.before-recover-' + (fs.readdirSync(d).find(x => x.startsWith(names + '.before-recover-')) || 'x').split('.before-recover-')[1]), 'recover: the damaged world file is kept beside it, not deleted');
      const b = await boot(f, env, 60000);
      ok(b.ready && new RegExp('Player accounts loaded: ' + Object.values(w.world.users).filter(u => !u.isNpc).length + '\\b').test(b.log()), 'recover: the server boots the recovered world with every account');
      await stop(b);
      // RECOVER - path 2: no manifest copy; newest shard files + the shared world from the newest backup
      const d2 = path.join(T, 'split-recover-shards'); copyDir(base, d2); const f2 = path.join(d2, names);
      fs.writeFileSync(f2, Buffer.alloc(fs.statSync(f2).size));
      if (fs.existsSync(f2 + '.m')) fs.renameSync(f2 + '.m', path.join(T, 'away-m-' + Date.now()));
      const wr2 = spawnSync(process.execPath, [STORE_CLI, 'recover', f2, '--write'], { encoding: 'utf8' });
      let g2 = null; try { g2 = WS.readWorld(f2); } catch (e) {}
      const d2g = g2 ? digest(g2) : null;
      ok(wr2.status === 0 && d2g && Object.keys(orig.users).every(id => d2g.users[id] === orig.users[id]) && Object.keys(d2g.users).length === Object.keys(orig.users).length,
        'recover from shard files alone: every player matches field by field (' + Object.keys(orig.users).length + ')');
      ok(g2 && Object.values(g2.users).filter(u => !u.isNpc).every(u => g2.byName[String(u.name).toLowerCase()] === u.id), 'recover from shard files alone: every player name resolves (name table rebuilt past the backup)');
    }
  }

  // BACKUPS - rotation by mtime, the pinned backup (span of server.js backupDB with the real fs)
  {
    const src = fs.readFileSync(SERVER, 'utf8');
    const a = src.indexOf('function backupDB('), z = src.indexOf('// off-site backup', a);
    const d = path.join(T, 'backups-unit'); fs.mkdirSync(path.join(d, 'backups'), { recursive: true });
    let safety; try { safety = require(path.join(root, 'server/world-safety.js')); } catch (e) { safety = undefined; }
    const ctx = { fs, path, console: { log() {}, error() {} }, process, DB: null, DB_FILE: path.join(d, 'db.json'), _safety: safety, _DB_LOAD_FAILED: null, Date, JSON, Math };
    vm.createContext(ctx); vm.runInContext(src.slice(a, z), ctx);
    const bdir = path.join(d, 'backups'), now = Date.now();
    // 48 old backups whose NAMES sort opposite to their age: by name the newest would go first
    for (let i = 0; i < 48; i++) { const p = path.join(bdir, 'db-' + String(i).padStart(2, '0') + '.json'); fs.writeFileSync(p, '{"users":{}}'); const t = (now - (i + 10) * 3600e3) / 1000; fs.utimesSync(p, t, t); }
    const world = { users: { a: { id: 'a', name: 'Real1' }, b: { id: 'b', name: 'Real2' }, g: { id: 'g', name: 'Guest', guest: true }, l: { id: 'l', name: 'LT-9' }, n: { id: 'n', name: 'Bot', isNpc: true } }, byName: {} };
    ctx.DB = world; ctx.backupDB();
    const left = fs.readdirSync(bdir).filter(f => /^db-.*\.json$/.test(f));
    ok(left.length === 48 && !left.includes('db-47.json') && left.includes('db-00.json'), 'backups: the 48 newest by mtime are kept - the OLDEST file goes, not the first name (' + (left.includes('db-47.json') ? 'kept the oldest' : 'ok') + ')');
    const pin = path.join(bdir, 'pinned-last-real.json');
    ok(fs.existsSync(pin) && JSON.parse(fs.readFileSync(pin, 'utf8')).users.a && JSON.parse(fs.readFileSync(path.join(bdir, 'pinned-last-real.meta.json'), 'utf8')).real === 2,
      'backups: a world with real players is pinned (2 real: NPCs, guests and LT- accounts are not counted)');
    const pinBytes = fs.existsSync(pin) ? sha(fs.readFileSync(pin)) : 'none';
    ctx.DB = { users: { n: { id: 'n', name: 'Bot', isNpc: true }, g: { id: 'g', name: 'G', guest: true } }, byName: {} }; ctx.backupDB();
    ok(fs.existsSync(pin) && sha(fs.readFileSync(pin)) === pinBytes, 'backups: a backup with 0 real players never replaces the pinned one');
    for (let i = 0; i < 60; i++) { ctx.DB = { users: {}, byName: {} }; ctx.backupDB(); }
    ok(fs.existsSync(pin) && sha(fs.readFileSync(pin)) === pinBytes && fs.readdirSync(bdir).filter(f => /^db-.*\.json$/.test(f)).length === 48, 'backups: 60 more empty backups rotate the hourly files but never the pinned one');
    ctx.DB = { users: { a: { id: 'a', name: 'Real1' }, b: { id: 'b', name: 'Real2' }, c: { id: 'c', name: 'Real3' } }, byName: {} }; ctx.backupDB();
    ok(fs.existsSync(pin) && JSON.parse(fs.readFileSync(pin, 'utf8')).users.c, 'backups: a later world with real players replaces the pinned one');
  }

  // OFF-SITE PUSH (span of server.js pushBackupToGitHub; fetch is stubbed - nothing leaves this machine)
  {
    const src = fs.readFileSync(SERVER, 'utf8');
    const a = src.indexOf('async function pushBackupToGitHub('), z = src.indexOf('// --- email', a);
    let safety; try { safety = require(path.join(root, 'server/world-safety.js')); } catch (e) { safety = undefined; }
    const run = async (db, pinnedReal) => {
      const d = fs.mkdtempSync(path.join(T, 'push-')); fs.mkdirSync(path.join(d, 'backups'));
      if (pinnedReal != null) fs.writeFileSync(path.join(d, 'backups', 'pinned-last-real.meta.json'), JSON.stringify({ real: pinnedReal, at: 1, from: 'x' }));
      let calls = 0;
      const ctx = { fs, path, console: { log() {}, error() {} }, Buffer, encodeURI, Date, JSON, DB: db, DB_FILE: path.join(d, 'db.json'), _safety: safety, _DB_LOAD_FAILED: null,
        process: { env: { GITHUB_BACKUP_TOKEN: 'test-token-not-real', GITHUB_BACKUP_REPO: 'nobody/nothing' } },
        fetch: async () => { calls++; return { ok: true, text: async () => '' }; } };
      vm.createContext(ctx); vm.runInContext(src.slice(a, z), ctx); await ctx.pushBackupToGitHub(); return calls;
    };
    const npcs = {}; for (let i = 0; i < 50; i++) npcs['bot_' + i] = { id: 'bot_' + i, name: 'B' + i, isNpc: true };
    ok(await run({ users: Object.assign({}, npcs, { g: { id: 'g', name: 'G', guest: true } }) }, null) === 0, 'push: an NPC-only world (0 real players) is NOT pushed off-site');
    const ten = {}; for (let i = 0; i < 10; i++) ten['p' + i] = { id: 'p' + i, name: 'P' + i };
    const three = {}; for (let i = 0; i < 3; i++) three['p' + i] = { id: 'p' + i, name: 'P' + i };
    ok(await run({ users: Object.assign({}, npcs, three) }, 10) === 0, 'push: a world that fell from 10 (pinned) to 3 real players is NOT pushed');
    ok(await run({ users: Object.assign({}, npcs, ten) }, 10) === 1, 'push: a healthy world is still pushed');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('FAILURES:\n  ' + failures.join('\n  ')); process.exitCode = 1; }
  else fs.rmSync(T, { recursive: true, force: true });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
