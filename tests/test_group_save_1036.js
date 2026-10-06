'use strict';
// v1036 group saves (Phil 5 Oct 2026, after the war load test: "do it all").
// 1. 60 durable war declarations at once: every reply ok, every war on disk, far fewer saves than actions.
// 2. A save that fails (the temp path is a directory): the reply is 503, nothing reaches disk, the action is undone in memory,
//    and once the disk works the SAME request succeeds exactly once.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }

(async () => {
  const root = path.join(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-groupsave-'));
  const db = path.join(temp, 'db.json'), port = await freePort(), base = 'http://127.0.0.1:' + port;
  let child, pass = 0;
  const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
  const req = async (method, route, data, token, ip) => {
    const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': ip || '10.20.0.1' }, body: data ? JSON.stringify(data) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const start = async adminId => {
    child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: adminId || '',
      NODE_ENV: 'test', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', WORLD_WAR_TEST_MS: '200', WORLD_CITY_TEST_MS: '200' } });
    for (let i = 0; i < 200; i++) { if (child.exitCode !== null) throw Error('server exited'); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await new Promise(r => setTimeout(r, 100)); }
    throw Error('server not ready');
  };
  const stop = async () => { if (!child) return; const c = child; child = null; c.kill(); await Promise.race([new Promise(r => c.once('exit', r)), new Promise(r => setTimeout(r, 3000))]); };
  try {
    await start('');
    const adm = await req('POST', '/api/register', { name: 'gsAdmin', pass: 'password1' });
    await new Promise(r => setTimeout(r, 600)); await stop(); await start(adm.body.profile.id);
    const A = (await req('POST', '/api/login', { name: 'gsAdmin', pass: 'password1' })).body.token;
    const players = [];
    for (let i = 0; i < 61; i++) {
      const r = await req('POST', '/api/register', { name: 'gs' + i, pass: 'password1' }, null, '10.21.0.' + (i + 1));
      const g = await req('POST', '/api/admin/led-grant', { userId: r.body.profile.id, unlock: ['vael', 'sylthaine', 'vireo'], heroKeys: ['vael', 'sylthaine', 'vireo'], px: 900000 }, A);
      assert.equal(g.body.ok, true, JSON.stringify(g.body).slice(0, 120));
      players.push({ id: r.body.profile.id, token: r.body.token, ip: '10.21.0.' + (i + 1) });
    }
    const cities = await req('GET', '/api/world/cities', null, players[0].token, players[0].ip);
    const bots = cities.body.bots || [];
    ok(bots.length >= 61, 'setup: 61 level-20 players and ' + bots.length + ' NPC castles');
    const before = (await req('GET', '/api/dev/save-stats', null, A)).body;

    // 1. sixty at once
    const sixty = players.slice(0, 60);
    const replies = await Promise.all(sixty.map((p, i) => req('POST', '/api/world/war/declare', { defId: bots[i].id, requestId: 'gs-war-' + i }, p.token, p.ip)));
    ok(replies.every(r => r.status === 200 && r.body.ok === true), '60 concurrent war declarations all answered ok');
    const disk = JSON.parse(fs.readFileSync(db, 'utf8'));
    ok(sixty.every((p, i) => disk.users[p.id].worldWars && disk.users[p.id].worldWars[bots[i].id]), 'every one of the 60 wars is on disk once its reply arrived');
    const after = (await req('GET', '/api/dev/save-stats', null, A)).body;
    const saves = after.batches - before.batches, acts = after.actions - before.actions;
    ok(acts >= 60 && saves < acts / 3, 'group saves: ' + acts + ' save requests written in ' + saves + ' whole-world saves');

    // 2. a save that fails
    const p = players[60], target = bots[60].id;
    fs.mkdirSync(db + '.group.tmp');   // the group save's temp path is now a directory: the write fails
    const failed = await req('POST', '/api/world/war/declare', { defId: target, requestId: 'gs-fail' }, p.token, p.ip);
    ok(failed.status === 503 && failed.body.storageFailed === true, 'a failed save answers 503 storageFailed (got ' + failed.status + ')');
    const disk2 = JSON.parse(fs.readFileSync(db, 'utf8'));
    ok(!(disk2.users[p.id].worldWars && disk2.users[p.id].worldWars[target]), 'nothing of the failed action reached disk');
    const st = (await req('GET', '/api/dev/save-stats', null, A)).body;
    ok(st.failed >= 1, 'the failure is counted (' + st.failed + ')');
    fs.rmdirSync(db + '.group.tmp');
    const retry = await req('POST', '/api/world/war/declare', { defId: target, requestId: 'gs-fail' }, p.token, p.ip);
    ok(retry.status === 200 && retry.body.ok === true && !retry.body.existing, 'the same request succeeds once the disk works, as a NEW war (the failed one was undone in memory)');
    const disk3 = JSON.parse(fs.readFileSync(db, 'utf8'));
    ok(!!(disk3.users[p.id].worldWars && disk3.users[p.id].worldWars[target]), 'the retried war is on disk');
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + e.message); process.exitCode = 1; }
  finally { await stop(); }
})();
