'use strict';
// v1124 world map deltas (load test 11 Oct 2026: GET /api/world/cities was 139 KB and 156-205 ms of main thread per call, polled every
// 60 s per player). A real server with 300 placed castles:
//  - the old call (no since) still answers the full list with teams (old clients keep working);
//  - since=0 gives the full list without teams + a rev; since=<rev> gives only castles changed since (empty when nothing changed);
//  - a castle that changes (its owner founds a guild) is in the next delta; a removed castle comes back in `gone`;
//  - a castle's defending team is served on demand (/api/world/city?id=);
//  - a restart changes the epoch: an old rev gets the full list again;
//  - sizes and server time per refresh, old vs delta; control: v1123 ignores since (the client's old-server branch).
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const WS = require(path.join(root, 'server/world-store.js'));
const WL = require(path.join(root, 'server/world-location.js'));
const V1123 = '216c328cf4f061ad17965af6ad223416f2c0dc12';
const servers = [];
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
const REFRESH = 1500;

async function server(script, db) {
  const port = await freePort(), base = 'http://127.0.0.1:' + port; let child;
  const req = async (method, route, data, token) => {
    const t0 = process.hrtime.bigint();
    const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': '10.70.0.' + (1 + (Math.random() * 200 | 0)) }, body: data ? JSON.stringify(data) : undefined });
    const text = await r.text(), ms = Number(process.hrtime.bigint() - t0) / 1e6;
    let body = {}; try { body = JSON.parse(text); } catch (_) {}
    return { status: r.status, body, bytes: Buffer.byteLength(text), ms };
  };
  const start = async adminId => {
    child = spawn(process.execPath, [script], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: adminId || '',
      DB_STORE: 'split', NODE_ENV: 'test', SIM_WORKERS: '0', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', SERVER_SECRET: 'map-delta-secret', WORLD_CITIES_REFRESH_MS: String(REFRESH) } });
    for (let i = 0; i < 300; i++) { if (child.exitCode !== null) throw Error('server exited'); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await sleep(100); }
    throw Error('server not ready');
  };
  const kill = async () => { if (!child) return; const c = child; child = null; c.kill('SIGKILL'); await Promise.race([new Promise(r => c.once('exit', r)), sleep(3000)]); };
  const S = { req, start, kill }; servers.push(S); return S;
}

// a world with 300 placed castles (clones of a real ledger) + the viewer and a "mover" who will change
async function seedWorld(dir) {
  const db = path.join(dir, 'db.json'), S = await server(path.join(root, 'server.js'), db);
  await S.start('');
  const adm = (await S.req('POST', '/api/register', { name: 'mdAdm', pass: 'password1' })).body.profile.id;
  const viewer = (await S.req('POST', '/api/register', { name: 'mdView', pass: 'password1' })).body;
  const mover = (await S.req('POST', '/api/register', { name: 'mdMove', pass: 'password1' })).body;
  await S.req('GET', '/api/ledger', null, mover.token);
  await S.req('GET', '/api/ledger', null, viewer.token);
  await sleep(600); await S.kill();
  const w = WS.readWorld(db), taken = [];
  const tpl = JSON.parse(JSON.stringify(w.users[mover.profile.id]));
  tpl.led.px = 900000;   // level 13+ (guild founding)
  const put = u => { const loc = WL.place(taken, n => Math.floor(Math.random() * n)); taken.push(loc); u.worldLocation = loc; };
  Object.assign(w.users[mover.profile.id].led, { px: 900000 }); put(w.users[mover.profile.id]);
  const clones = [];
  for (let i = 0; i < 299; i++) { const u = JSON.parse(JSON.stringify(tpl)); u.id = 'mdc' + String(i).padStart(4, '0'); u.name = 'mdClone' + i; u.wall = tpl.wall || tpl.team; put(u); w.users[u.id] = u; w.byName[u.name.toLowerCase()] = u.id; clones.push(u.id); }
  const vu = w.users[viewer.profile.id]; vu.led.px = 900000; put(vu);   // the viewer has a castle (bots are served) and one war far away
  const far = clones.map(id => w.users[id]).sort((p, q) => Math.hypot(q.worldLocation.x - vu.worldLocation.x, q.worldLocation.y - vu.worldLocation.y) - Math.hypot(p.worldLocation.x - vu.worldLocation.x, p.worldLocation.y - vu.worldLocation.y))[0];
  vu.worldWars = { [far.id]: { readyAt: Date.now(), expireAt: Date.now() + 86400000 } };
  WS.writeWorld(db, w);
  return { db, adm, viewer, mover, clones, farId: far.id, view: vu.worldLocation };
}

(async () => {
  const tmpCtl = path.join(root, '.map-delta-control-v1123.js');
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-map-delta-'));
    const W = await seedWorld(dir);
    const S = await server(path.join(root, 'server.js'), W.db);
    await S.start(W.adm);
    const login = async n => (await S.req('POST', '/api/login', { name: n, pass: 'password1' })).body.token;
    const tv = await login('mdView'), tm = await login('mdMove'), ta = await login('mdAdm');

    // the old call: full list with teams
    const olds = []; for (let i = 0; i < 6; i++) olds.push(await S.req('GET', '/api/world/cities', null, tv));
    const old = olds[olds.length - 1];
    ok(old.status === 200 && old.body.cities.length === 300 && old.body.cities.every(c => Array.isArray(c.team)) && old.body.rev === undefined,
      'old clients: /api/world/cities answers all 300 castles with teams (' + (old.bytes / 1024).toFixed(1) + ' KB)');

    // the first delta call: full, no teams
    const f = await S.req('GET', '/api/world/cities?since=0', null, tv);
    ok(f.body.full === true && f.body.cities.length === 300 && f.body.cities.every(c => c.team === undefined) && typeof f.body.rev === 'string',
      'since=0: the full list without teams + rev ' + f.body.rev + ' (' + (f.bytes / 1024).toFixed(1) + ' KB)');
    const ids = new Set(f.body.cities.map(c => c.id));
    ok(ids.has(W.mover.profile.id) && !ids.has(W.viewer.profile.id), 'the list holds the other castles, not the viewer\'s own');
    const deltas = []; let rev = f.body.rev;
    for (let i = 0; i < 6; i++) { const d = await S.req('GET', '/api/world/cities?since=' + rev, null, tv); deltas.push(d); }
    const d0 = deltas[deltas.length - 1];
    ok(d0.body.full === false && d0.body.cities.length === 0 && d0.body.gone.length === 0, 'since=<rev> with nothing changed: no castles (' + d0.bytes + ' bytes)');

    // a castle changes: its owner founds a guild
    const g = await S.req('POST', '/api/guild/create', { name: 'Delta Guild' }, tm);
    assert.equal(g.status, 200, JSON.stringify(g.body).slice(0, 160));
    await sleep(REFRESH + 200);
    const d1 = await S.req('GET', '/api/world/cities?since=' + rev, null, tv);
    const row = d1.body.cities.find(c => c.id === W.mover.profile.id);
    ok(d1.body.full === false && d1.body.cities.length === 1 && row && row.guildId === g.body.guild.id,
      'the changed castle (new guild) is the only row in the next delta (' + d1.bytes + ' bytes)');
    rev = d1.body.rev;

    // a castle leaves the map
    const victim = W.clones[7];
    const del = await S.req('POST', '/api/admin/delete', { id: victim }, ta);
    await sleep(REFRESH + 200);
    const d2 = await S.req('GET', '/api/world/cities?since=' + rev, null, tv);
    ok(del.status === 200 && d2.body.gone.includes(victim), 'a deleted account\'s castle is in the next delta\'s gone list (' + del.status + ')');

    // the team on demand
    const t = await S.req('GET', '/api/world/city?id=' + W.clones[3], null, tv);
    const oldRow = old.body.cities.find(c => c.id === W.clones[3]);
    ok(t.status === 200 && Array.isArray(t.body.team) && JSON.stringify(t.body.team) === JSON.stringify(oldRow.team) && t.body.power === oldRow.power,
      'a tapped castle\'s team comes from /api/world/city, identical to the old list\'s (' + t.bytes + ' bytes)');
    ok((await S.req('GET', '/api/world/city?id=nobody', null, tv)).status === 404, 'an unknown castle answers 404');

    // sizes and time per refresh (server time as seen by the client, serial calls on an idle machine)
    const avg = a => a.reduce((x, r) => x + r.ms, 0) / a.length;
    console.log('  --  per refresh: old ' + (old.bytes / 1024).toFixed(1) + ' KB / ' + avg(olds.slice(1)).toFixed(1) + ' ms; delta (nothing changed) ' + d0.bytes + ' B / ' + avg(deltas).toFixed(1) + ' ms; first full ' + (f.bytes / 1024).toFixed(1) + ' KB / ' + f.ms.toFixed(1) + ' ms');
    const d0c = d0.bytes - JSON.stringify(d0.body.bots).length;
    ok(d0c * 20 < old.bytes, 'a quiet refresh carries >20x fewer castle bytes than the old call (' + d0c + ' B + ' + (d0.bytes - d0c) + ' B of bots vs ' + old.bytes + ' B)');

    // VIEWPORT: only the tiles around the viewer's castle
    const tileOf = (x, y) => Math.max(0, Math.min(9, Math.floor(x / 10))) + '_' + Math.max(0, Math.min(9, Math.floor(y / 10)));
    const vt = []; for (let c = Math.floor((W.view.x - 6) / 10); c <= Math.floor((W.view.x + 6) / 10); c++) for (let r = Math.floor((W.view.y - 6) / 10); r <= Math.floor((W.view.y + 6) / 10); r++) if (c >= 0 && c <= 9 && r >= 0 && r <= 9) vt.push(c + '_' + r);
    if (old.body.bots.length) { const bt = tileOf(old.body.bots[0].x, old.body.bots[0].y); if (!vt.includes(bt)) vt.push(bt); }   // a view that holds bots too
    const vq = (since, have) => S.req('GET', '/api/world/cities?since=' + encodeURIComponent(since) + '&tiles=' + vt.join(',') + '&have=' + (have || []).join(','), null, tv);
    const v0 = await vq('0');
    const inView = c => vt.includes(tileOf(c.x, c.y));
    const oldIn = old.body.cities.filter(inView);
    ok(v0.status === 200 && v0.body.reset === true && v0.body.cities.every(inView) && v0.body.cities.length === oldIn.length - (oldIn.some(c => c.id === victim) ? 1 : 0) && v0.body.cities.length < 300,
      'viewport: the first call returns only the castles in the ' + vt.length + ' tiles in view (' + v0.body.cities.length + ' of 299, ' + (v0.bytes / 1024).toFixed(1) + ' KB)');
    ok(v0.body.targets.some(c => c.id === W.farId) && !inView(v0.body.targets.find(c => c.id === W.farId)), 'the viewer war target comes back although it is off-screen');
    const oldNow = await S.req('GET', '/api/world/cities', null, tv);   // the same moment (a deleted castle changed its region's bot fill)
    const oldBots = oldNow.body.bots.filter(inView).map(x => x.id + '@' + x.x + ',' + x.y + ':' + x.power).sort(), newBots = v0.body.bots.map(x => x.id + '@' + x.x + ',' + x.y + ':' + x.power).sort();
    ok(v0.body.bots.length > 0 && v0.body.bots.every(inView) && JSON.stringify(newBots) === JSON.stringify(oldBots),
      'bots: only those in view, identical to the old full roster there (' + newBots.length + ' of ' + oldNow.body.bots.length + ')');
    const vms = []; let vrev = v0.body.rev, vq0 = null;
    for (let i = 0; i < 6; i++) { vq0 = await vq(vrev, vt); vms.push(vq0); }
    ok(vq0.body.reset === false && vq0.body.cities.length === 0, 'viewport refresh with nothing changed: no castles (' + vq0.bytes + ' bytes)');
    // a change inside the view comes back; one outside does not
    const inside = v0.body.cities.find(c => c.id !== W.mover.profile.id), outside = old.body.cities.find(c => !inView(c) && c.id !== W.farId && c.id !== victim);
    const md = (await S.req('POST', '/api/admin/delete', { id: inside.id }, ta)).status, md2 = (await S.req('POST', '/api/admin/delete', { id: outside.id }, ta)).status;
    await sleep(REFRESH + 200);
    const v1 = await vq(vrev, vt);
    ok(md === 200 && md2 === 200 && v1.body.gone.includes(inside.id) && !v1.body.cities.some(c => c.id === outside.id), 'a castle removed inside the view is in gone; a change outside it is not sent');
    // panning: a new tile is loaded whole, the held ones as changes only
    const nt = ['0_0', '9_9', '0_9', '9_0'].find(t => !vt.includes(t));
    const v2 = await S.req('GET', '/api/world/cities?since=' + encodeURIComponent(v1.body.rev) + '&tiles=' + [...vt, nt].join(',') + '&have=' + vt.join(','), null, tv);
    const expectNew = old.body.cities.filter(c => tileOf(c.x, c.y) === nt && c.id !== victim && c.id !== outside.id).length;
    ok(v2.body.cities.every(c => tileOf(c.x, c.y) === nt) && v2.body.cities.length === expectNew, 'panning to tile ' + nt + ' loads just that tile (' + v2.body.cities.length + ' castles)');
    console.log('  --  viewport refresh: first ' + (v0.bytes / 1024).toFixed(1) + ' KB / ' + v0.ms.toFixed(1) + ' ms; quiet ' + vq0.bytes + ' B / ' + (vms.reduce((x, r) => x + r.ms, 0) / vms.length).toFixed(1) + ' ms (old full list ' + (old.bytes / 1024).toFixed(1) + ' KB)');

    // a restart: new epoch -> an old rev gets the full list
    await S.kill(); await S.start(W.adm);
    const tv2 = await login('mdView');
    const r2 = await S.req('GET', '/api/world/cities?since=' + rev, null, tv2);
    ok(r2.body.full === true && r2.body.cities.length === 297 && r2.body.rev.split('.')[0] !== rev.split('.')[0], 'after a restart an old rev gets the full list again (new epoch)');
    await S.kill();

    // control: v1123 ignores since (the client then takes its old-server branch)
    let src = null; try { src = execFileSync('git', ['show', V1123 + ':server.js'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }); } catch (e) {}
    if (!src) console.log('  --  control skipped: git cannot read ' + V1123.slice(0, 8));
    else {
      fs.writeFileSync(tmpCtl, src);
      const C = await server(tmpCtl, W.db); await C.start(W.adm);
      const tc = (await C.req('POST', '/api/login', { name: 'mdView', pass: 'password1' })).body.token;
      const c0 = await C.req('GET', '/api/world/cities?since=0', null, tc); await C.kill();
      ok(c0.body.rev === undefined && c0.body.cities.every(c => Array.isArray(c.team)), 'control v1123: since is ignored - the full list with teams, no rev (' + (c0.bytes / 1024).toFixed(1) + ' KB)');
    }
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { for (const s of servers) await s.kill().catch(() => {}); try { fs.unlinkSync(tmpCtl); } catch (e) {} }
})();
