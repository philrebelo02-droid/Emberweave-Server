'use strict';
// v1037 per-player storage (Phil 5 Oct 2026: "do the real fix").
// Part 1, the store itself: a save writes only the changed players' shards; a save that fails at any file leaves the last
// committed world exactly; leftovers of a failed save are swept; a missing shard refuses to load; receipts live with their owner;
// tools read and write either format. Part 2, a real server with DB_STORE=split and the verifier on: the war flow (declare, march,
// attack, heal) saves partially, no player changes outside a declared save, every acknowledged action survives a hard kill, and
// the world converts split -> one file -> split across restarts. A control server without DB_STORE keeps the one-file world.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..');
const WS = require(path.join(root, 'server/world-store.js'));
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
const clone = o => JSON.parse(JSON.stringify(o));

function unit() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-store-unit-')), file = path.join(temp, 'db.json');
  const db = { users: {}, byName: {}, tokens: {}, seeded: true, feedback: [{ t: 1 }], idem: {} };
  for (let i = 0; i < 400; i++) { const id = 'u' + i; db.users[id] = { id, name: 'P' + i, gold: i }; db.idem[id + ':x:1'] = { t: Date.now(), resp: { ok: true, i } }; }
  db.idem['sys:tick'] = { t: Date.now(), resp: { ok: true } };
  const st = WS.create(file, { split: true });
  st.write(db, null);
  ok(fs.readdirSync(st.dir).length === WS.SHARDS && JSON.parse(fs.readFileSync(file, 'utf8')).__store === WS.FORMAT, 'a full save writes all ' + WS.SHARDS + ' shards and the manifest');
  ok(JSON.stringify(WS.readWorld(file)) === JSON.stringify(WS.readWorld(file)) && WS.readWorld(file).users.u7.gold === 7 && Object.keys(WS.readWorld(file).idem).length === 401, 'the world reads back whole (400 players, 401 receipts)');
  const man0 = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(Object.keys(man0.core.idem).join() === 'sys:tick', 'a receipt with no player owner stays in the shared world; player receipts live in their shard');

  db.users.u7.gold = 777; db.users.u300.gold = 3000; db.idem['u7:x:2'] = { t: Date.now(), resp: { ok: true } };
  st.write(db, new Set(['u7', 'u300']));
  const man1 = JSON.parse(fs.readFileSync(file, 'utf8'));
  const changed = Object.keys(man1.shards).filter(s => man1.shards[s] !== man0.shards[s]).map(Number).sort((a, b) => a - b);
  const expect = [...new Set([WS.shardOf('u7'), WS.shardOf('u300')])].sort((a, b) => a - b);
  ok(JSON.stringify(changed) === JSON.stringify(expect), 'a save for two players rewrites only their shards (' + changed.join(',') + ')');
  const back = WS.readWorld(file);
  ok(back.users.u7.gold === 777 && back.users.u300.gold === 3000 && back.idem['u7:x:2'] && back.users.u8.gold === 8, 'their changes and the new receipt are on disk; others unchanged');
  ok(fs.readdirSync(st.dir).length === WS.SHARDS, 'superseded shard files are removed after the swap');

  // a save that fails at each file in turn leaves the last committed world
  const before = JSON.stringify(WS.readWorld(file));
  db.users.u7.gold = 1; db.users.u300.gold = 1;
  const realW = fs.writeFileSync, realR = fs.renameSync; let fails = 0;
  for (const at of [1, 2, 3]) {
    let n = 0;
    fs.writeFileSync = function (f) { if (String(f).startsWith(temp) && ++n === at) throw Error('injected write failure'); return realW.apply(this, arguments); };
    try { st.write(db, new Set(['u7', 'u300'])); } catch (e) { fails++; }
    fs.writeFileSync = realW;
  }
  fs.renameSync = function () { throw Error('injected rename failure'); };
  try { st.write(db, new Set(['u7', 'u300'])); } catch (e) { fails++; }
  fs.renameSync = realR;
  ok(fails === 4 && JSON.stringify(WS.readWorld(file)) === before, 'a save failing at either shard, the manifest or the swap leaves the committed world exactly (4 failures)');
  ok(fs.readdirSync(st.dir).length === WS.SHARDS, 'a failed save cleans up the files it wrote');
  st.write(db, new Set(['u7']));
  ok(WS.readWorld(file).users.u7.gold === 1, 'the next save after failures commits normally');

  fs.writeFileSync(path.join(st.dir, '5-999999.json'), '{}');
  const st2 = WS.create(file, { split: true }); st2.load();
  ok(st2.sweepOrphans() === 1 && fs.readdirSync(st2.dir).length === WS.SHARDS, 'a leftover shard no manifest names is swept at boot');
  const man = JSON.parse(fs.readFileSync(file, 'utf8')), victim = path.join(st.dir, man.shards[3]);
  fs.renameSync(victim, victim + '.away');
  let code = null; try { WS.readWorld(file); } catch (e) { code = e.code; }
  ok(code === 'SHARD_MISSING', 'a missing shard file refuses to load (never a world with players missing)');
  fs.renameSync(victim + '.away', victim);

  const one = path.join(temp, 'one.json'); fs.writeFileSync(one, JSON.stringify(clone(db)));
  WS.writeWorld(one, Object.assign(clone(db), { seeded: 'tool' }));
  WS.writeWorld(file, Object.assign(WS.readWorld(file), { seeded: 'tool' }));
  ok(!JSON.parse(fs.readFileSync(one, 'utf8')).__store && JSON.parse(fs.readFileSync(one, 'utf8')).seeded === 'tool' && WS.readWorld(file).seeded === 'tool' && JSON.parse(fs.readFileSync(file, 'utf8')).__store === WS.FORMAT,
    'tools (setpass, restores) read and write either format and keep it');
}

async function server(split, temp) {
  const db = path.join(temp, 'db.json'), port = await freePort(), base = 'http://127.0.0.1:' + port;
  let child, mode = split;
  const req = async (method, route, data, token, ip) => {
    const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': ip || '10.40.0.1' }, body: data ? JSON.stringify(data) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const start = async adminId => {
    child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: adminId || '',
      DB_STORE: mode ? 'split' : '', DB_STORE_VERIFY: mode ? '1' : '', DB_STORE_SWEEP_MS: '600000',
      NODE_ENV: 'test', SIM_WORKERS: '0', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', WORLD_WAR_TEST_MS: '100', WORLD_CITY_TEST_MS: '100', SERVER_SECRET: 'world-store-test-secret' } });
    for (let i = 0; i < 200; i++) { if (child.exitCode !== null) throw Error('server exited'); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await sleep(100); }
    throw Error('server not ready');
  };
  const kill = async () => { if (!child) return; const c = child; child = null; c.kill('SIGKILL'); await Promise.race([new Promise(r => c.once('exit', r)), sleep(3000)]); };
  return { db, req, start, kill, setMode: m => { mode = m; } };
}

async function warFlow(S, admin) {
  const A = (await S.req('POST', '/api/login', { name: admin, pass: 'password1' })).body.token;
  const keys = ['vael', 'sylthaine', 'vireo'];
  const mk = async (name, ip) => { const r = await S.req('POST', '/api/register', { name, pass: 'password1' }, null, ip);
    const g = await S.req('POST', '/api/admin/led-grant', { userId: r.body.profile.id, unlock: keys, heroKeys: keys, px: 900000, heroXp: 200000 }, A);
    assert.equal(g.body.ok, true); await S.req('POST', '/api/save', { wall: keys.map(k => ({ key: k })) }, r.body.token, ip);
    return { id: r.body.profile.id, token: r.body.token, ip }; };
  const atk = await mk(admin + 'Atk', '10.41.0.1'), def = await mk(admin + 'Def', '10.41.0.2');
  await S.req('POST', '/api/witch/heal-all', { requestId: 'ws-warm' }, atk.token, atk.ip);   // a first Witch's Hut state is a one-time full save
  await sleep(400);   // registration's debounced full save lands; what follows is the war flow alone
  const stat = async () => (await S.req('GET', '/api/dev/save-stats', null, A)).body.store, steps = [];
  const s0 = await stat();
  const w = await S.req('POST', '/api/world/war/declare', { defId: def.id, requestId: 'ws-war' }, atk.token, atk.ip);
  assert.ok(w.body.ok, JSON.stringify(w.body).slice(0, 160)); steps.push(['declare', await stat()]); await sleep(Math.max(0, (w.body.readyAt || 0) - Date.now()) + 150);
  const m = await S.req('POST', '/api/world/city/start', { defId: def.id, heroIds: keys, requestId: 'ws-march' }, atk.token, atk.ip);
  assert.ok(m.body.ok, JSON.stringify(m.body).slice(0, 160)); steps.push(['march', await stat()]); await sleep(Math.max(0, m.body.arriveAt - Date.now()) + 150);
  const a = await S.req('POST', '/api/pvp/attack', { defId: def.id, marchId: m.body.marchId, requestId: 'ws-attack' }, atk.token, atk.ip);
  assert.ok(a.body.ok, JSON.stringify(a.body).slice(0, 200)); steps.push(['attack', await stat()]);
  const h = await S.req('POST', '/api/witch/heal-all', { requestId: 'ws-heal' }, atk.token, atk.ip);
  const s1 = await stat(); steps.push(['heal', s1]);
  const trail = steps.map(([k, x]) => k + ' ' + x.partial + 'p/' + x.full + 'f').join(', ');
  return { atk, def, marchId: m.body.marchId, attack: a.body, heal: h.body, s0, s1, trail: 'start ' + s0.partial + 'p/' + s0.full + 'f, ' + trail };
}

(async () => {
  try {
    unit();
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-store-srv-'));
    const S = await server(true, temp);
    await S.start('');
    const adm = await S.req('POST', '/api/register', { name: 'wsAdmin', pass: 'password1' });
    await sleep(600); await S.kill(); await S.start(adm.body.profile.id);
    const r = await warFlow(S, 'wsAdmin');
    ok(r.s1.split === true && r.s1.partial > r.s0.partial && r.s1.full === r.s0.full, 'split server: the war flow saved partially (' + (r.s1.partial - r.s0.partial) + ' partial, ' + (r.s1.full - r.s0.full) + ' full saves: ' + r.trail + ')');
    ok(r.s1.undeclared === 0, 'verifier: no player changed outside a declared save during the war flow (' + JSON.stringify(r.s1.undeclaredIds) + ')');
    await S.kill();   // hard kill straight after the acknowledgements
    const w1 = WS.readWorld(S.db), au = w1.users[r.atk.id];
    ok(JSON.stringify(au).includes(r.marchId) && w1.idem[r.atk.id + ':worldwar:ws-war'] && Object.keys(w1.idem).some(k => k.startsWith(r.atk.id + ':') && k.includes('ws-attack')),
      'after a hard kill: the march, the war receipt and the attack receipt are on disk');
    ok(JSON.parse(fs.readFileSync(S.db, 'utf8')).__store === WS.FORMAT, 'the world file is the split manifest');
    S.setMode(false); await S.start(adm.body.profile.id);
    const tok = (await S.req('POST', '/api/login', { name: 'wsAdminAtk', pass: 'password1' }, null, '10.41.0.1')).body.token;
    ok(!!tok, 'a one-file server boots from the split world and its players sign in');
    await S.req('POST', '/api/witch/heal-all', { requestId: 'ws-heal-2' }, tok, '10.41.0.1'); await sleep(400); await S.kill();
    const plain = JSON.parse(fs.readFileSync(S.db, 'utf8'));
    ok(!plain.__store && plain.users[r.atk.id] && JSON.stringify(plain.users[r.atk.id]).includes(r.marchId), 'its next save writes the one-file world, players intact');
    S.setMode(true); await S.start(adm.body.profile.id);
    const tok2 = (await S.req('POST', '/api/login', { name: 'wsAdminDef', pass: 'password1' }, null, '10.41.0.2')).body.token;
    await S.req('POST', '/api/witch/heal-all', { requestId: 'ws-heal-3' }, tok2, '10.41.0.2'); await sleep(400); await S.kill();
    ok(JSON.parse(fs.readFileSync(S.db, 'utf8')).__store === WS.FORMAT && WS.readWorld(S.db).users[r.def.id] && tok2, 'and a split server converts it back on its first save');

    const C = await server(false, fs.mkdtempSync(path.join(os.tmpdir(), 'ember-store-ctl-')));
    await C.start('');
    const cadm = await C.req('POST', '/api/register', { name: 'wcAdmin', pass: 'password1' });
    await sleep(600); await C.kill(); await C.start(cadm.body.profile.id);
    const c = await warFlow(C, 'wcAdmin'); await C.kill();
    ok(c.s1.split === false && c.s1.partial === 0 && !JSON.parse(fs.readFileSync(C.db, 'utf8')).__store && c.attack.ok, 'control server (no DB_STORE): the same flow keeps the one-file world');
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
})();
