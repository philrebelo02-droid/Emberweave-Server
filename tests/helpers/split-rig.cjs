'use strict';
// Shared rig for the v1127 tests (zoom gate, chat cap, world pieces, attack copy): spawn a real server on a free port with its own
// temp world, call it, kill it hard; build a CONTROL tree of an older commit (git archive, assets linked) to run the same check on.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..', '..');
const CONTROL_SHA = '59eaefba';   // claude/save-partial head: the code before the v1127 rules
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const children = new Set();
process.on('exit', () => { for (const c of children) { try { c.kill('SIGKILL'); } catch (_) {} } });

// a server in `dir` (the worktree, or a control tree) on its own world file
async function server(opts) {
  opts = opts || {};
  const dir = opts.dir || root, temp = opts.temp || fs.mkdtempSync(path.join(os.tmpdir(), 'ember-v1127-'));
  const db = opts.db || path.join(temp, 'db.json'), port = opts.port || await freePort(), base = 'http://127.0.0.1:' + port;
  let child = null, log = '';
  const req = async (method, route, data, token, ip) => {
    const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': ip || '10.61.0.1' }, body: data ? JSON.stringify(data) : undefined });
    const text = await r.text(); let body = {}; try { body = JSON.parse(text); } catch (_) {}
    return { status: r.status, body, bytes: text.length };
  };
  const start = async (adminId, extraEnv) => {
    child = spawn(process.execPath, [...(opts.nodeArgs || []), 'server.js'], { cwd: dir, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: adminId || '',
      DB_STORE: 'split', DB_STORE_SWEEP_MS: '600000', NODE_ENV: 'test', SIM_WORKERS: '0', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', SERVER_SECRET: 'v1127-test-secret',
      DUNGEON_V2_ENABLED: 'true', GUILD_WAR_V2_ENABLED: 'true', VAULT_MIN_BATTLE_MS: '0', WORLD_WAR_TEST_MS: '20', WORLD_CITY_TEST_MS: '20', ...(opts.env || {}), ...(extraEnv || {}) } });
    children.add(child); const c = child; c.on('exit', () => children.delete(c));
    c.stderr.on('data', d => { log = (log + d).slice(-4000); });
    for (let i = 0; i < 300; i++) { if (c.exitCode !== null) throw Error('server exited: ' + log); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await sleep(100); }
    throw Error('server not ready: ' + log);
  };
  const kill = async () => { if (!child) return; const c = child; child = null; c.kill('SIGKILL'); await Promise.race([new Promise(r => c.once('exit', r)), sleep(3000)]); };
  const stop = async () => { if (!child) return; const c = child; child = null; c.kill('SIGTERM'); await Promise.race([new Promise(r => c.once('exit', r)), sleep(8000)]); };
  return { dir, temp, db, port, base, req, start, kill, stop, log: () => log, get child() { return child; } };
}

// boot with an admin (save-stats, led-grant) and n players at world level (castles placed)
async function boot(S, tag, n, opts) {
  opts = opts || {};
  await S.start('');
  const adm = await S.req('POST', '/api/register', { name: tag + 'Adm', pass: 'password1' });
  assert.ok(adm.body.profile, 'admin registered: ' + JSON.stringify(adm.body).slice(0, 120));
  await sleep(600); await S.kill(); await S.start(adm.body.profile.id);
  const A = (await S.req('POST', '/api/login', { name: tag + 'Adm', pass: 'password1' })).body.token;
  const players = [];
  for (let i = 0; i < n; i++) {
    const ip = '10.62.' + (i >> 8) + '.' + ((i & 255) + 1);
    const r = await S.req('POST', '/api/register', { name: tag + 'P' + i, pass: 'password1' }, null, ip);
    assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160));
    const p = { id: r.body.profile.id, token: r.body.token, ip, name: tag + 'P' + i };
    if (opts.world !== false) {
      const keys = opts.heroes || ['vael', 'sylthaine', 'vireo'];
      const g = await S.req('POST', '/api/admin/led-grant', { userId: p.id, unlock: keys, heroKeys: keys, px: 900000, heroXp: 200000 }, A);
      assert.equal(g.body.ok, true, JSON.stringify(g.body).slice(0, 160));
      const w = await S.req('GET', '/api/world/state', null, p.token, ip);
      assert.ok(w.body && w.body.locked === false, 'castle placed: ' + JSON.stringify(w.body).slice(0, 160));
      p.loc = { x: w.body.x, y: w.body.y, region: w.body.region };
    }
    players.push(p);
  }
  return { adminId: adm.body.profile.id, A, players, stat: async () => (await S.req('GET', '/api/dev/save-stats', null, A)).body };
}

// the control tree: CONTROL_SHA's files (no assets - they are linked) in a folder under the repo, so node_modules resolves
function controlTree(sha) {
  sha = sha || CONTROL_SHA;
  const dir = path.join(root, '.ctl-' + sha);
  if (fs.existsSync(path.join(dir, 'server.js'))) return dir;
  fs.mkdirSync(dir, { recursive: true });
  const tar = execFileSync('git', ['archive', '--format=tar', sha, '--', '.', ':!assets'], { cwd: root, maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', dir.split(path.sep).join('/')], { input: tar, maxBuffer: 1 << 30 });
  fs.symlinkSync(path.join(root, 'assets'), path.join(dir, 'assets'), 'junction');
  return dir;
}
function removeControlTree(sha) {
  const dir = path.join(root, '.ctl-' + (sha || CONTROL_SHA)); if (!fs.existsSync(dir)) return;
  try { fs.unlinkSync(path.join(dir, 'assets')); } catch (_) { try { fs.rmdirSync(path.join(dir, 'assets')); } catch (_) {} }
  fs.rmSync(dir, { recursive: true, force: true });
}

let passN = 0;
const ok = (c, m) => { assert.ok(c, m); passN++; console.log('  ok  ' + m); };
module.exports = { root, CONTROL_SHA, sleep, freePort, server, boot, controlTree, removeControlTree, ok, passed: () => passN };
