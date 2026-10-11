'use strict';
// v1124 partial debounced saves (Server 1 load test 11 Oct 2026: the main thread blocked on FULL world saves, 233-883 ms each).
// A real server with DB_STORE=split and the verifier on:
//  (a) a campaign start then resolve writes only that player's shard (+ the manifest) - no full save;
//      (plus the other converted routes: tutorial claims and the pool/glyph/province/ledger reads);
//  (b) any id-less writeDB() (here an admin grant) still forces a full save;
//  (c) crash safety (and the persisted attempt is a small stub, no fight recording): two players change and the shared world changes (the Vault climb, DB.dungeonProgress) in partial saves -
//      after a hard kill straight after the acknowledgements all three are on disk;
//  (d) a restart from disk keeps the player's progress; a fight cut off by the restart returns its stamina (its recording lived in
//      memory only); an honest fight is accepted and its recording discarded, a flagged one (a2) keeps it;
//  (f) shared systems - guild create/request/approve/chat, a Skyfall line change - save the players they touch + the shared world;
//  (e) control: the same (a) flow on v1123 (216c328c) makes full saves - the check in (a) fails there.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const WS = require(path.join(root, 'server/world-store.js'));
const V1123 = '216c328cf4f061ad17965af6ad223416f2c0dc12';
const servers = [];   // every spawned server is killed at the end, pass or fail
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
const SQUAD = ['vael', 'sylthaine', 'vireo'];
const WON = JSON.stringify({ t: 60, won: true, stars: 3, wave: 2, u: SQUAD.map(k => [k, 'ally', 1, 500, 0, 100, 100]) });

async function server(script, temp) {
  const db = path.join(temp, 'db.json'), port = await freePort(), base = 'http://127.0.0.1:' + port;
  let child;
  const req = async (method, route, data, token, ip) => {
    const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': ip || '10.50.0.1' }, body: data ? JSON.stringify(data) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const start = async adminId => {
    child = spawn(process.execPath, [script], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: adminId || '',
      DB_STORE: 'split', DB_STORE_VERIFY: '1', DB_STORE_SWEEP_MS: '600000', DUNGEON_V2_ENABLED: 'true', GUILD_WAR_V2_ENABLED: 'true', VAULT_MIN_BATTLE_MS: '0',
      NODE_ENV: 'test', SIM_WORKERS: '0', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', SERVER_SECRET: 'save-partial-test-secret' } });
    for (let i = 0; i < 200; i++) { if (child.exitCode !== null) throw Error('server exited'); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await sleep(100); }
    throw Error('server not ready');
  };
  const kill = async () => { if (!child) return; const c = child; child = null; c.kill('SIGKILL'); await Promise.race([new Promise(r => c.once('exit', r)), sleep(3000)]); };
  const S = { db, req, start, kill }; servers.push(S); return S;
}
const manifest = db => JSON.parse(fs.readFileSync(db, 'utf8'));
const changedShards = (m0, m1) => Object.keys(m1.shards).filter(s => m1.shards[s] !== m0.shards[s]).map(Number).sort((a, b) => a - b);

// boot with an admin (save-stats), two players; registration's id-less saves land before anything is measured
async function boot(S, tag) {
  await S.start('');
  const adm = await S.req('POST', '/api/register', { name: tag + 'Adm', pass: 'password1' });
  await sleep(600); await S.kill(); await S.start(adm.body.profile.id);
  const A = (await S.req('POST', '/api/login', { name: tag + 'Adm', pass: 'password1' })).body.token;
  const mk = async (name, ip) => { const r = await S.req('POST', '/api/register', { name, pass: 'password1' }, null, ip); assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160)); return { id: r.body.profile.id, token: r.body.token, ip }; };
  const p1 = await mk(tag + 'One', '10.51.0.1'), p2 = await mk(tag + 'Two', '10.51.0.2');
  return { adminId: adm.body.profile.id, A, p1, p2, stat: async () => (await S.req('GET', '/api/dev/save-stats', null, A)).body.store };
}
async function settle(S, B) {   // warm each player's ledger (first touch migrates it), then let every debounced save land
  for (const p of [B.p1, B.p2]) await S.req('GET', '/api/ledger', null, p.token, p.ip);
  await sleep(500);
}
async function campaignPair(S, p, node, rid) {
  const st = await S.req('POST', '/api/campaign/start', { mode: 'normal', node, heroIds: SQUAD, requestId: rid + '-s' }, p.token, p.ip);
  assert.equal(st.status, 200, JSON.stringify(st.body).slice(0, 200));
  const rs = await S.req('POST', '/api/campaign/resolve', { attemptId: st.body.attemptId, requestId: rid + '-r', inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3 }, p.token, p.ip);
  assert.equal(rs.status, 200, JSON.stringify(rs.body).slice(0, 200));
  return { start: st.body, resolve: rs.body };
}

(async () => {
  const tmpCtl = path.join(root, '.save-partial-control-v1123.js');
  try {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-save-partial-'));
    const S = await server('server.js', temp);
    const B = await boot(S, 'sp');
    await settle(S, B);

    // (a) a campaign start + resolve: partial saves of the player's own shard only
    const s0 = await B.stat(), m0 = manifest(S.db);
    const r = await campaignPair(S, B.p1, 1, 'a1');
    await sleep(400);   // the debounced writeDB([me.id]) after start has fired too
    const s1 = await B.stat(), m1 = manifest(S.db);
    ok(r.resolve.ok === true && r.resolve.ledger.camp.cleared === 1, '(a) the stage 1-1 win is paid (cleared 1)');
    ok(s1.full === s0.full && s1.partial > s0.partial, '(a) campaign start + resolve made ' + (s1.partial - s0.partial) + ' partial and ' + (s1.full - s0.full) + ' full saves');
    const own = WS.shardOf(B.p1.id), ch = changedShards(m0, m1);
    ok(ch.length === 1 && ch[0] === own, '(a) only the player\'s own shard file was rewritten (shard ' + own + '; changed: ' + ch.join(',') + ')');
    ok(WS.readWorld(S.db).users[B.p1.id].led.camp.cleared === 1, '(a) the clear is on disk');

    // (a2) the fake verdict above does not match the replay: the fight is FLAGGED, so its recording is kept
    { const u = WS.readWorld(S.db).users[B.p1.id], rc = (u.led.battleReceipts || []).slice(-1)[0], inc = (u.led.battleIncidents || []).slice(-1)[0];
      ok(r.resolve.digestMatch === false && rc && Array.isArray(rc.transcript) && inc && Array.isArray(inc.transcript),
        '(a2) a flagged fight keeps its recording: the receipt and the incident hold the transcript'); }

    // the other converted routes: tutorial claims (gold / stamina / diamonds), and the reads that save a day roll or migration
    const sR0 = await B.stat(), mR0 = manifest(S.db), codes = [];
    for (const step of ['win11', 'signin', 'name']) codes.push((await S.req('POST', '/api/tutorial/claim', { step }, B.p1.token, B.p1.ip)).status);
    for (const route of ['/api/pool/state', '/api/glyphs/state', '/api/province/state', '/api/ledger', '/api/market/offers']) codes.push((await S.req('GET', route, null, B.p1.token, B.p1.ip)).status);
    codes.push((await S.req('POST', '/api/pvp/reports-ack', { ids: [] }, B.p1.token, B.p1.ip)).status);
    await sleep(400);
    const sR1 = await B.stat(), chR = changedShards(mR0, manifest(S.db));
    ok(codes.every(c => c === 200) && sR1.full === sR0.full && sR1.partial > sR0.partial && chR.length === 1 && chR[0] === own,
      'tutorial claims, pool/glyph/province/ledger/market reads and the mail ack saved partially, own shard only (' + codes.join(',') + '; ' + (sR1.partial - sR0.partial) + ' partial, ' + (sR1.full - sR0.full) + ' full)');
    ok(sR1.undeclared === 0, 'verifier: those routes changed no other player (' + JSON.stringify(sR1.undeclaredIds) + ')');

    // (b) an id-less writeDB() still forces a full save (an admin grant - maintenance stays full)
    const s2 = await B.stat();
    const g1 = await S.req('POST', '/api/admin/led-grant', { userId: B.p1.id, px: 900000 }, B.A);
    assert.equal(g1.body.ok, true, JSON.stringify(g1.body).slice(0, 160));
    await sleep(500);
    const s3 = await B.stat();
    ok(s3.full >= s2.full + 1, '(b) an admin grant (id-less writeDB) made a full save (' + (s3.full - s2.full) + ')');

    // (c) two players + one shared-world value, all in partial saves, then a hard kill straight after the acknowledgements
    const g = await S.req('POST', '/api/admin/led-grant', { userId: B.p2.id, unlock: ['vael', 'sylthaine', 'vireo', 'vex', 'rafe'], heroKeys: ['vael', 'sylthaine', 'vireo', 'vex', 'rafe'], px: 900000, heroXp: 200000 }, B.A);
    assert.equal(g.body.ok, true, JSON.stringify(g.body).slice(0, 160));
    await S.req('GET', '/api/dungeon/status', null, B.p2.token, B.p2.ip);
    for (const p of [B.p1, B.p2]) await S.req('GET', '/api/ledger', null, p.token, p.ip);
    await sleep(500);
    const s4 = await B.stat();
    const c1 = await S.req('POST', '/api/campaign/start', { mode: 'normal', node: 2, heroIds: SQUAD, requestId: 'c-start' }, B.p1.token, B.p1.ip);
    const marker = 'partial-marker-' + Date.now();
    const c2 = await S.req('POST', '/api/save', { roster: { __save: JSON.stringify({ marker }) } }, B.p2.token, B.p2.ip);
    const c3 = await S.req('POST', '/api/dungeon/start-battle', { heroIds: ['vael', 'sylthaine', 'vireo', 'vex', 'rafe'], requestId: 'c-vault' }, B.p2.token, B.p2.ip);
    ok(c1.status === 200 && c2.status === 200 && c3.status === 200 && c3.body.attemptId, '(c) player 1 started stage 1-2, player 2 saved and started a Vault floor (' + [c1.status, c2.status, c3.status].join('/') + ' ' + (c3.body.error || '') + ')');
    await sleep(350);   // the debounced partial saves land (no full save is due: the sweep is 10 minutes away)
    const s5 = await B.stat();
    ok(s5.full === s4.full && s5.partial > s4.partial, '(c) all three were partial saves (' + (s5.partial - s4.partial) + ' partial, ' + (s5.full - s4.full) + ' full)');
    ok(s5.undeclared === 0, '(c) verifier: no player changed outside a declared save (' + JSON.stringify(s5.undeclaredIds) + ')');
    await S.kill();
    const w = WS.readWorld(S.db);
    const att1 = w.users[B.p1.id].led.camp.att;
    ok(att1 && att1.id === c1.body.attemptId && att1.stamPaid > 0, '(c) after a hard kill: player 1\'s open stage 1-2 attempt (and the stamina it paid) is on disk');
    ok(['snaps', 'specs', 'teamSnapshot', 'seed', 'stream', 'clock'].every(k => att1[k] === undefined) && JSON.stringify(att1).length < 400,
      '(c) the fight recording is NOT in the persisted file - the stub is ' + JSON.stringify(att1).length + ' bytes');
    ok(String(w.users[B.p2.id].roster && w.users[B.p2.id].roster.__save).includes(marker), '(c) player 2\'s cloud save is on disk');
    const dp = w.dungeonProgress && w.dungeonProgress[B.p2.id];
    ok(dp && dp.activeAttempt && dp.activeAttempt.id === c3.body.attemptId, '(c) the shared world (DB.dungeonProgress) holds player 2\'s Vault attempt');

    // (d) restart from disk: progress intact; the fight interrupted by the restart gives its stamina back; a new fight is accepted
    await S.start(B.adminId);
    const t1 = (await S.req('POST', '/api/login', { name: 'spOne', pass: 'password1' }, null, B.p1.ip)).body.token;
    const led1 = (await S.req('GET', '/api/ledger', null, t1, B.p1.ip)).body;
    ok(led1.camp && led1.camp.cleared === 1, '(d) after a restart player 1 still has stage 1-1 cleared');
    const d1 = await S.req('POST', '/api/campaign/resolve', { attemptId: c1.body.attemptId, requestId: 'd-resolve', inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3 }, t1, B.p1.ip);
    ok(d1.body.ok === false && d1.body.interrupted === true && d1.body.ledger.stamina.v >= led1.stamina.v + att1.stamPaid,
      '(d) the fight cut off by the restart resolves as interrupted and returns its ' + att1.stamPaid + ' stamina (' + led1.stamina.v + ' -> ' + (d1.body.ledger && d1.body.ledger.stamina.v) + ')');
    const host = require(path.join(root, 'server/sim-host.js')).load(path.join(root, 'emberweave-heroes.html'));
    const enc = JSON.parse(fs.readFileSync(path.join(root, 'server/campaign-encounters.json'), 'utf8'));
    const d2 = await S.req('POST', '/api/campaign/start', { mode: 'normal', node: 2, heroIds: SQUAD, requestId: 'd-start' }, t1, B.p1.ip);
    const fight = host.campaign(d2.body.snaps, enc[1].waves, d2.body.seed >>> 0, []);
    const d3 = await S.req('POST', '/api/campaign/resolve', { attemptId: d2.body.attemptId, requestId: 'd-resolve-2', inputLog: [], digest: fight.digest, won: !!fight.won, stars: fight.won ? (fight.stars | 0) : 0 }, t1, B.p1.ip);
    ok(d3.status === 200 && d3.body.ok && d3.body.digestMatch === true, '(d) an honest fight replays to the same result and is accepted (won ' + !!fight.won + ')');
    await sleep(400);

    // (f) shared systems save the players they touch + the shared world, never every player:
    //     guild create / request / approve / chat, a Skyfall line change
    await S.req('GET', '/api/guild-war/status', null, t1, B.p1.ip);   // the week's tournament is created here (a full save) - not measured
    await sleep(400);
    const t2 = (await S.req('POST', '/api/login', { name: 'spTwo', pass: 'password1' }, null, B.p2.ip)).body.token;
    await sleep(400);
    const f0 = await B.stat(), fm0 = manifest(S.db);
    const gc = await S.req('POST', '/api/guild/create', { name: 'Partial Guild' }, t2, B.p2.ip);
    const gr = await S.req('POST', '/api/guild/request', { guildId: gc.body.guild && gc.body.guild.id }, t1, B.p1.ip);
    const ga = await S.req('POST', '/api/guild/approve', { id: B.p1.id }, t2, B.p2.ip);
    const gch = await S.req('POST', '/api/guild/chat', { tx: 'partial saves' }, t1, B.p1.ip);
    const wl = await S.req('POST', '/api/guild-war/lines', { lines: [] }, t1, B.p1.ip);
    await sleep(400);
    const f1 = await B.stat(), fch = changedShards(fm0, manifest(S.db)), two = [...new Set([WS.shardOf(B.p1.id), WS.shardOf(B.p2.id)])].sort((x, y) => x - y);
    ok([gc, gr, ga, gch, wl].every(x => x.status === 200), '(f) guild create/request/approve/chat and a Skyfall line change answered (' + [gc, gr, ga, gch, wl].map(x => x.status).join('/') + ')');
    ok(f1.full === f0.full && f1.partial > f0.partial && JSON.stringify(fch) === JSON.stringify(two),
      '(f) they made ' + (f1.partial - f0.partial) + ' partial and ' + (f1.full - f0.full) + ' full saves; only the two players\' shards changed (' + fch.join(',') + ')');
    ok(f1.undeclared === 0, '(f) verifier: no other player changed (' + JSON.stringify(f1.undeclaredIds) + ')');
    await S.kill();
    const w2 = WS.readWorld(S.db), gid = gc.body.guild && gc.body.guild.id;
    { const rc = w2.users[B.p1.id].led.battleReceipts.slice(-1)[0];
      ok(w2.users[B.p1.id].led.camp.cleared === (fight.won ? 2 : 1) && rc && rc.stage === '1-2' && rc.digest && rc.transcript === undefined,
        '(d) after a hard kill the accepted fight outcome is on disk and its recording was discarded (no transcript)'); }
    ok(w2.guilds[gid] && w2.guilds[gid].members.includes(B.p1.id) && w2.users[B.p1.id].guildId === gid && w2.users[B.p2.id].guildId === gid
      && w2.guilds[gid].log.some(e => e && e.tx === 'partial saves'), '(f) after a hard kill the guild, both members\' guildId and the chat line are on disk');

    // (e) control: v1123 makes full saves for the same flow
    let src = null; try { src = execFileSync('git', ['show', V1123 + ':server.js'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }); } catch (e) {}
    if (!src) { console.log('  --  (e) control skipped: git cannot read ' + V1123.slice(0, 8) + ' here'); }
    else {
      fs.writeFileSync(tmpCtl, src);
      const C = await server(tmpCtl, fs.mkdtempSync(path.join(os.tmpdir(), 'ember-save-partial-ctl-')));
      const CB = await boot(C, 'sc'); await settle(C, CB);
      const c0 = await CB.stat(), cm0 = manifest(C.db);
      await campaignPair(C, CB.p1, 1, 'e1'); await sleep(400);
      const cs1 = await CB.stat(), cm1 = manifest(C.db); await C.kill();
      ok(cs1.full > c0.full && changedShards(cm0, cm1).length > 1, '(e) control v1123: the same start + resolve made ' + (cs1.full - c0.full) + ' full save(s), ' + changedShards(cm0, cm1).length + ' shards rewritten - (a) fails there');
    }
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { for (const s of servers) await s.kill().catch(() => {}); try { fs.unlinkSync(tmpCtl); } catch (e) {} }
})();
