'use strict';
// v1036 battles on the second core (Phil 5 Oct 2026: "use both cores?" / "do it all").
// A real server with one battle worker resolves player-vs-player city attacks: the battles come from the worker (memo hits, no
// main-thread fights), and each fight the reply reports replays to the SAME winner and digest on the ordinary engine. A control
// server with workers off resolves the same way on the main thread.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..');
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };

async function scenario(workers) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-battleworkers-'));
  const db = path.join(temp, 'db.json'), port = await freePort(), base = 'http://127.0.0.1:' + port;
  let child;
  const req = async (method, route, data, token, ip) => {
    const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': ip || '10.30.0.1' }, body: data ? JSON.stringify(data) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const start = async adminId => {
    child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: adminId || '',
      NODE_ENV: 'test', SIM_WORKERS: String(workers), REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', WORLD_WAR_TEST_MS: '100', WORLD_CITY_TEST_MS: '100', SERVER_SECRET: 'battle-worker-test-secret' } });
    for (let i = 0; i < 200; i++) { if (child.exitCode !== null) throw Error('server exited'); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await sleep(100); }
    throw Error('server not ready');
  };
  const stop = async () => { if (!child) return; const c = child; child = null; c.kill(); await Promise.race([new Promise(r => c.once('exit', r)), sleep(3000)]); };
  try {
    await start('');
    const adm = await req('POST', '/api/register', { name: 'bwAdmin', pass: 'password1' });
    await sleep(600); await stop(); await start(adm.body.profile.id);
    const A = (await req('POST', '/api/login', { name: 'bwAdmin', pass: 'password1' })).body.token;
    const keys = ['vael', 'sylthaine', 'vireo'];
    const mk = async (name, ip) => { const r = await req('POST', '/api/register', { name, pass: 'password1' }, null, ip);
      const g = await req('POST', '/api/admin/led-grant', { userId: r.body.profile.id, unlock: keys, heroKeys: keys, px: 900000, heroXp: 200000 }, A);
      assert.equal(g.body.ok, true); await req('POST', '/api/save', { wall: keys.map(k => ({ key: k })) }, r.body.token, ip);
      return { id: r.body.profile.id, token: r.body.token, ip }; };
    const atk = await mk('bwAttacker', '10.31.0.1'), defs = [await mk('bwDefA', '10.31.0.2'), await mk('bwDefB', '10.31.0.3')];
    for (let i = 0; i < 60 && workers > 0; i++) { const st = (await req('GET', '/api/dev/save-stats', null, A)).body; if (st.battles && st.battles.pool && st.battles.pool.ready > 0) break; await sleep(250); }   // the pool loads at boot
    const results = [];
    for (let i = 0; i < 2; i++) {
      const d = defs[i];
      const w = await req('POST', '/api/world/war/declare', { defId: d.id, requestId: 'bw-war-' + i }, atk.token, atk.ip);
      assert.ok(w.body.ok, JSON.stringify(w.body).slice(0, 160)); await sleep(Math.max(0, (w.body.readyAt || 0) - Date.now()) + 150);
      const m = await req('POST', '/api/world/city/start', { defId: d.id, heroIds: keys, requestId: 'bw-march-' + i }, atk.token, atk.ip);
      assert.ok(m.body.ok, JSON.stringify(m.body).slice(0, 160)); await sleep(Math.max(0, m.body.arriveAt - Date.now()) + 150);
      const a = await req('POST', '/api/pvp/attack', { defId: d.id, marchId: m.body.marchId, requestId: 'bw-attack-' + i }, atk.token, atk.ip);
      assert.ok(a.body.ok, JSON.stringify(a.body).slice(0, 200)); results.push(a.body);
      await req('POST', '/api/witch/heal-all', { requestId: 'bw-heal-' + i }, atk.token, atk.ip);
    }
    const st = (await req('GET', '/api/dev/save-stats', null, A)).body.battles;
    return { results, st };
  } finally { await stop(); }
}

(async () => {
  try {
    const host = require(path.join(root, 'server/sim-host.js')).load(path.join(root, 'emberweave-heroes.html'));
    const on = await scenario(1);
    ok(on.st.pool && on.st.pool.size === 1 && on.st.pool.runs >= 2, 'worker server: the battle pool ran the fights (' + JSON.stringify(on.st.pool && { size: on.st.pool.size, runs: on.st.pool.runs }) + ')');
    ok(on.st.memoHits >= 2 && on.st.mainThread === 0, 'worker server: every city battle came from the worker, none on the main thread (memo hits ' + on.st.memoHits + ', main ' + on.st.mainThread + ')');
    for (const [i, r] of on.results.entries()) {
      assert.ok(r.replay && Array.isArray(r.replay.snaps) && Array.isArray(r.replay.foe), 'attack ' + i + ' reports its fight: ' + JSON.stringify(r).slice(0, 160));
      const again = host.auto(r.replay.snaps, r.replay.foe, r.replay.seed);
      ok(again.won === !!r.won, 'attack ' + i + ': the ordinary engine replays the worker\'s fight to the same winner (' + again.won + ')');
    }
    const off = await scenario(0);
    ok(off.st.pool === null && off.st.mainThread >= 2 && off.st.memoHits === 0, 'control server (SIM_WORKERS=0): the same attacks fight on the main thread (main ' + off.st.mainThread + ')');
    ok(off.results.every(r => r.ok), 'control server: both attacks resolve');
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + e.message); process.exitCode = 1; }
})();
