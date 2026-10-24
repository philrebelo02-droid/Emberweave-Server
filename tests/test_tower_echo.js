// v1218 (24 Oct 2026) THE ECHO SPIRE - server/tower-of-trials.js on a throwaway server (Phil 23 Oct night: make the best of Ember's Tower
// ideas real; Ember's idea 04, Grok's QA notes 1 + 2).
//  A. module: seasons + checkpoint, Guardian waves scale with the floor (and every 5th floor holds a boss), echo waves are the recorded
//     five as hero foes scaled UP to the floor's requirement (Grok QA #2), pay rules (a re-climbed floor pays 0, an echo pays the bonus).
//  B. HTTP: climb 3 floors -> records; the season turns -> those floors are ECHO floors with your own five; winning one lays it to rest and
//     pays only the echo bonus; a loss moves nothing; the tribute follows THIS season's floor; a fresh account has no echoes (Grok QA #1);
//     a fight started in an old season cannot pay in the new one.
// Must-fail controls: a re-climb pays no floor gold (expected 0), a rested echo is a Guardian floor again, a stale-season attempt is refused.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const T2 = require('../server/tower-of-trials.js');
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; };

// ---------- A. module ----------
ok(T2.seasonOf('2026-10-19') === 0 && T2.seasonOf('2026-10-25') === 0 && T2.seasonOf('2026-10-26') === 1, 'seasons are 7 game days from Mon 19 Oct');
ok(T2.checkpoint(0) === 0 && T2.checkpoint(24) === 0 && T2.checkpoint(25) === 5 && T2.checkpoint(57) === 35, 'checkpoint = best - 20, down to a multiple of 5');
const nodes = JSON.parse(fs.readFileSync(path.join(root, 'server', 'campaign-encounters.json'), 'utf8'));
const req = f => { let r = Math.round(560 * Math.pow(1.185, f - 1) * 1.4276); if (f % 5 === 0) r = Math.round(r * 1.3); return r; };
const g12 = T2.guardianWaves(12, req(12), nodes, 0), g40 = T2.guardianWaves(40, req(40), nodes, 0), g15 = T2.guardianWaves(15, req(15), nodes, 0);
ok(g12 && g12.waves.length >= 1 && g40 && g15, 'guardian waves exist for floors 12, 15, 40');
const hp = g => Math.max(...g.waves.flat().map(m => m.hpMul));
ok(hp(g40) > hp(g12), 'a higher floor has stronger guardians (' + hp(g12).toFixed(1) + ' -> ' + hp(g40).toFixed(1) + ')');
ok(g15.waves.flat().some(m => m.boss), 'an Elite floor (every 5th) holds a boss');
const rec = { keys: ['a', 'b', 'c', 'd', 'e'], lv: [40, 41, 42, 43, 44], pow: 5000, season: 0 };
const ew = T2.echoWaves(rec, 20000);
ok(ew.length === 1 && ew[0].length === 5 && ew[0].every(m => m.isHero && m.echo), 'an echo is ONE wave of the recorded five as hero foes');
ok(ew[0].every((m, i) => m.lvl === rec.lv[i]) && ew[0][0].hpMul === 4, 'at their recorded levels, scaled to the floor (20000 / 5000 = x4 HP) - Grok QA #2');
ok(T2.echoWaves(rec, 2000)[0][0].hpMul === 1, 'an echo is never scaled DOWN below its own power');

// ---------- B. HTTP ----------
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-tower-echo-')), dbFile = path.join(dir, 'db.json');
let port, base, child, token = '';
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start() { child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, ALLOW_NEW_GUESTS: '1', PORT: String(port), DB_FILE: dbFile, DATABASE_URL: '', TOWER_MIN_BATTLE_MS: '0' }, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 150; i++) { if (child.exitCode !== null) throw new Error('server exited'); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw new Error('no start'); }
async function stop() { if (!child) return; child.kill(); for (let i = 0; i < 60 && child.exitCode === null; i++) await delay(50); child = null; }
async function post(r, d) { const x = await fetch(base + r, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-token': token }, body: JSON.stringify(d || {}) }); return { status: x.status, data: await x.json().catch(() => ({})) }; }
const gold = async () => { const x = await fetch(base + '/api/ledger', { headers: { 'x-token': token } }); const j = await x.json(); return (j.ledger || j).gold; };
let n = 0; const rid = () => 'e' + (++n) + '-' + Date.now();
const digest = (won, keys) => JSON.stringify({ won, t: 30, u: keys.map(k => [k, 'ally', won ? 1 : 0, 999, 50]) });
async function fight(keys, won = true) { const s = await post('/api/tower/start', { requestId: rid(), heroIds: keys }); if (!s.data.ok) return { s, r: s };
  const r = await post('/api/tower/resolve', { requestId: rid(), attemptId: s.data.attemptId, won, stars: won ? 3 : 0, digest: digest(won, keys), inputLog: [] }); return { s, r }; }
async function account(tower) {
  const g = await post('/api/guest', { deviceId: 'echo-' + Date.now() + Math.random() }); token = g.data.token; const id = g.data.profile.id;
  await fetch(base + '/api/ledger', { headers: { 'x-token': token } }); await delay(300); await stop();
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')), u = db.users[id], keys = Object.keys(require('../server/sim.js').HERO_BASE).slice(0, 5);
  u.led.px = 99000000; for (const k of keys) u.led.unlocked[k] = true; u.team = keys.map(k => ({ key: k })); u.led.tower = tower;
  fs.writeFileSync(dbFile, JSON.stringify(db)); await start(); return { id, keys }; }
const editTower = async (id, fn) => { await delay(300); await stop(); const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); fn(db.users[id].led.tower); fs.writeFileSync(dbFile, JSON.stringify(db)); await start(); };
(async () => { try {
  port = await freePort(); base = 'http://127.0.0.1:' + port; await start();
  const { id, keys } = await account({ floor: 0, trib: '', mig: 1, srv: 0 });
  let st = await post('/api/tower/state', {});
  ok(st.data.next && st.data.next.type === 'guardian' && st.data.echoes.length === 0, 'season 1: a Guardian floor, no echoes - Grok QA #1');
  for (let f = 1; f <= 3; f++) { const { r } = await fight(keys); ok(r.data.ok && r.data.won && r.data.best === f && r.data.newBest && r.data.gold > 0, 'floor ' + f + ' won, new best, paid ' + r.data.gold); }
  st = await post('/api/tower/state', {}); ok(st.data.records === 3, 'three floors recorded (' + st.data.records + ')');
  // a loss moves nothing
  const g0 = await gold(); const L = (await fight(keys, false)).r; ok(L.data.ok && L.data.won === false && L.data.floor === 3 && (await gold()) === g0, 'a loss moves nothing and pays nothing');
  // the season turns: last season's records haunt the band
  await editTower(id, T => { T.season = (T.season | 0) - 1; for (const f of Object.keys(T.rec)) T.rec[f].season = T.season; });
  st = await post('/api/tower/state', {});
  ok(st.data.floor === 0 && st.data.best === 3, 'new season: back to the checkpoint (0), best kept (3)');
  ok(st.data.next.type === 'echo' && JSON.stringify(st.data.next.echo.keys) === JSON.stringify(keys), 'floor 1 is an ECHO of your own five');
  ok(st.data.next.foes.length === 5 && st.data.next.foes.every(x => x.isHero), 'the echo is five hero foes');
  ok(st.data.next.pay.gold === 0 && st.data.next.pay.echoBonus > 0, 'a re-climbed floor pays no floor gold, only the echo bonus (control)');
  ok(JSON.stringify(st.data.echoes) === '[1,2,3]', 'floors 1-3 are haunted (' + st.data.echoes + ')');
  const gb = await gold(); const { s: es, r: er } = await fight(keys);
  ok(es.data.type === 'echo' && es.data.waves[0].every(m => m.isHero && m.hpMul >= 1), 'the echo fight is the scaled hero wave');
  ok(er.data.won && er.data.rested && er.data.echoBonus === st.data.next.pay.echoBonus && er.data.gold === 0 && (await gold()) - gb === er.data.echoBonus, 'echo laid to rest: paid exactly the bonus (' + er.data.echoBonus + ')');
  st = await post('/api/tower/state', {}); ok(st.data.floor === 1 && JSON.stringify(st.data.rested) === '[1]' && st.data.next.type === 'echo' && st.data.next.floor === 2, 'floor 1 rested; floor 2 is the next echo');
  // tribute follows the season floor (1), not the best (3)
  const tr = await post('/api/tower/tribute', { requestId: rid() }); const trib1 = Math.round(500 * 1) + 250 * (1 + Math.floor(1 / 4));
  ok(tr.data.ok && tr.data.gold === trib1, 'tribute follows THIS season\'s floor (' + tr.data.gold + ' = ' + trib1 + ')');
  // a fight from an old season cannot pay
  const s2 = await post('/api/tower/start', { requestId: rid(), heroIds: keys }); await editTower(id, T => { T.att.season = (T.season | 0) - 1; });
  const stale = await post('/api/tower/resolve', { requestId: rid(), attemptId: s2.data.attemptId, won: true, stars: 3, digest: digest(true, keys), inputLog: [] });
  ok(stale.status === 400 && /no longer matches/.test(stale.data.error || ''), 'a fight started in another season is refused (control)');
  // a fresh account: no echoes
  await account({ floor: 0, trib: '', mig: 1, srv: 0 }); st = await post('/api/tower/state', {});
  ok(st.data.next.type === 'guardian' && st.data.records === 0, 'a fresh account fights Guardians - Grok QA #1');
  console.log('test_tower_echo.js: ' + pass + ' checks passed');
} catch (e) { console.error('FAIL', e && e.message || e); process.exitCode = 1; } finally { await stop(); } })();
