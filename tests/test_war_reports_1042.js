'use strict';
// v1042 (Phil 6 Oct 2026: "Make it one hour, with a copy of the report living in the players war inbox up to 50 mails total, and
// getting bumped out of their mail at 50."):
// - a real server: after a city attack BOTH players' war mail (pvp reports) holds the report with the fight, which replays to the
//   same winner on the ordinary engine; the settled march keeps the outcome without a second copy of the fight;
// - receipts last one hour (idem() span with a controlled clock: 59 min replays, 61 min runs again);
// - the client's war tab keeps 50, newest first, the 51st bumps the oldest; one report per march (reply + server copy).
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), vm = require('node:vm');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..');
const WS = require(path.join(root, 'server/world-store.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }

async function server() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-warmail-')), db = path.join(temp, 'db.json'), port = await freePort(), base = 'http://127.0.0.1:' + port;
  let child;
  const req = async (method, route, data, token, ip) => {
    const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': ip || '10.50.0.1' }, body: data ? JSON.stringify(data) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const start = async adminId => {
    child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: adminId || '', DB_STORE: 'split',
      NODE_ENV: 'test', SIM_WORKERS: '0', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', WORLD_WAR_TEST_MS: '100', WORLD_CITY_TEST_MS: '100', SERVER_SECRET: 'war-mail-test' } });
    for (let i = 0; i < 200; i++) { if (child.exitCode !== null) throw Error('server exited'); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await sleep(100); }
    throw Error('server not ready');
  };
  const kill = async () => { if (!child) return; const c = child; child = null; c.kill(); await Promise.race([new Promise(r => c.once('exit', r)), sleep(3000)]); };
  return { db, req, start, kill };
}

(async () => {
  const S = await server();
  try {
    // 1) real server: both players' war mail carries the fight
    await S.start('');
    const adm = await S.req('POST', '/api/register', { name: 'wmAdmin', pass: 'password1' });
    await sleep(600); await S.kill(); await S.start(adm.body.profile.id);
    const A = (await S.req('POST', '/api/login', { name: 'wmAdmin', pass: 'password1' })).body.token;
    const keys = ['vael', 'sylthaine', 'vireo'];
    const mk = async (name, ip) => { const r = await S.req('POST', '/api/register', { name, pass: 'password1' }, null, ip);
      await S.req('POST', '/api/admin/led-grant', { userId: r.body.profile.id, unlock: keys, heroKeys: keys, px: 900000, heroXp: 200000 }, A);
      await S.req('POST', '/api/save', { wall: keys.map(k => ({ key: k })) }, r.body.token, ip); return { id: r.body.profile.id, token: r.body.token, ip }; };
    const atk = await mk('wmAttacker', '10.51.0.1'), def = await mk('wmDefender', '10.51.0.2');
    const w = await S.req('POST', '/api/world/war/declare', { defId: def.id, requestId: 'wm-war' }, atk.token, atk.ip);
    await sleep(Math.max(0, (w.body.readyAt || 0) - Date.now()) + 150);
    const m = await S.req('POST', '/api/world/city/start', { defId: def.id, heroIds: keys, requestId: 'wm-march' }, atk.token, atk.ip);
    await sleep(Math.max(0, m.body.arriveAt - Date.now()) + 150);
    const a = await S.req('POST', '/api/pvp/attack', { defId: def.id, marchId: m.body.marchId, requestId: 'wm-attack' }, atk.token, atk.ip);
    assert.ok(a.body.ok && a.body.replay, JSON.stringify(a.body).slice(0, 200));
    const ra = (await S.req('GET', '/api/pvp/reports', null, atk.token, atk.ip)).body.reports || [];
    const rd = (await S.req('GET', '/api/pvp/reports', null, def.token, def.ip)).body.reports || [];
    const mine = ra.find(r => r.kind === 'attack-report'), theirs = rd.find(r => r.verified && r.marchId === m.body.marchId);
    ok(mine && mine.marchId === m.body.marchId && mine.won === a.body.won && JSON.stringify(mine.loot) === JSON.stringify(a.body.loot) && mine.battle && mine.battle.mineSnap && mine.battle.foe,
      'attacker: the server posts a copy of the report with the fight and the loot to their war mail');
    ok(theirs && theirs.battle && theirs.battle.mineSnap && theirs.battle.foe && theirs.battle.attacker === 'wmAttacker', 'defender: their raid report now carries the fight too');
    const host = require(path.join(root, 'server/sim-host.js')).load(path.join(root, 'emberweave-heroes.html'));
    const again = host.auto(mine.battle.mineSnap, mine.battle.foe, mine.battle.seed);
    ok(again.won === !!a.body.won && JSON.stringify(mine.battle.foe) === JSON.stringify(theirs.battle.foe), 'the mailed fight replays to the same winner (' + again.won + '), the same fight in both mails');
    await S.req('POST', '/api/pvp/reports-ack', { ids: ra.map(r => r.id) }, atk.token, atk.ip);
    ok(((await S.req('GET', '/api/pvp/reports', null, atk.token, atk.ip)).body.reports || []).length === 0, 'acknowledged reports leave the server (the copy now lives in the war tab)');
    await S.kill();
    const world = WS.readWorld(S.db), march = (world.users[atk.id].worldCityMarches || []).find(x => x.id === m.body.marchId);
    ok(march && march.resolved && march.receipt && march.receipt.won === a.body.won && JSON.stringify(march.receipt.replay) === JSON.stringify(a.body.replay),
      'the settled march keeps the exact reply (fight included) for 2 days, for a late retry');
    ok(!!world.idem[atk.id + ':pvpatk:wm-attack'], 'the attack receipt is on disk (for the next hour)');

    // 2) receipts last one hour - idem() with a controlled clock
    const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    const span = src.slice(src.indexOf('function idem(key, fn, opts)'), src.indexOf('/* Monster roster mirror'));
    let clock = 10_000_000; const ctx = { Date: { now: () => clock }, DB: { idem: {}, users: {} }, DURABLE_IDEM_KINDS: new Set(), _worldSettlementPlanning: null, PG_BOOT_PENDING: false,
      writeDBNow() {}, saveDB() {}, pgSave() {}, _adoptUser() {}, console };
    vm.createContext(ctx); vm.runInContext(span, ctx);
    let runs = 0; const fn = () => ({ ok: true, n: ++runs });
    ctx.idem('u1:buy:r1', fn); clock += 59 * 60000; ctx.idem('u1:buy:r1', fn);
    ok(runs === 1, 'a retry 59 minutes later gets the saved reply (runs once)');
    clock += 2 * 60000; ctx.idem('u1:buy:r1', fn);
    ok(runs === 2, 'after one hour the receipt has expired (61 minutes: runs again)');

    // 3) the client's war tab: 50 kept, newest first, one report per march
    const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
    const s1 = html.indexOf('const MAIL_CAP='), s2 = html.indexOf('function mailUnread(');
    const c = { G: { mail: { inbox: [], war: [], mines: [], scouts: [] } }, ensureMail() {}, Date }; vm.createContext(c);
    vm.runInContext(html.slice(s1, s2).replace('const MAIL_CAP', 'var MAIL_CAP'), c);
    for (let i = 1; i <= 55; i++) c.addMail('war', { subj: 'report ' + i, marchId: 'm' + i });
    for (let i = 1; i <= 45; i++) c.addMail('inbox', { subj: 'note ' + i });
    ok(c.G.mail.war.length === 50 && c.G.mail.war[0].subj === 'report 55' && c.G.mail.war[49].subj === 'report 6', 'war tab: 55 reports -> the newest 50 kept, the 5 oldest bumped out');
    ok(c.G.mail.inbox.length === 40, 'other tabs keep 40 as before');
    ok(c.hasWarMail('m55') === true && c.hasWarMail('m3') === false && c.hasWarMail(undefined) === false, 'one report per march: a second copy of m55 is recognised');
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { await S.kill(); setTimeout(() => process.exit(), 300); }
})();
