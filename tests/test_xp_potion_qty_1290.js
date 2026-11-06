// v1290 (Phil 5 Nov: "can you make exp potions able to be used 1-999. allow people to enter the number they will use"):
// /api/hero/xp-potion takes qty 1-999 (missing = 1). Potions are applied one at a time and it stops at the Commander level cap /
// max XP, so a big number never wastes potions - only the ones that gave XP are taken. The client sends the number box's value.
// Control: AUD_SERVER=<the v1289 server.js copied into the repo root> must FAIL (it always takes exactly one potion).
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), srvFile = process.env.AUD_SERVER || 'server.js', dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-xpqty-'));
const dbFile = path.join(dir, 'db.json');
let port, base, child, token, id, pass = 0, missed = [];
const ok = (c, m) => { if (process.env.AUD_SERVER && !c) { missed.push(m); return; } assert(c, m); pass++; };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start() { child = spawn(process.execPath, [srvFile], { cwd: root, env: { ...process.env, ALLOW_NEW_GUESTS: '1', DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile }, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw Error('no start'); }
async function stop() { if (!child) return; child.kill(); for (let i = 0; i < 60 && child.exitCode === null; i++) await delay(50); child = null; }
async function call(route, data) { const r = await fetch(base + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': token }, body: data ? JSON.stringify(data) : undefined });
  let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, data: j }; }
const disk = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'));
async function editDB(fn) { await delay(400); await stop(); const db = disk(); fn(db, db.users[id]); fs.writeFileSync(dbFile, JSON.stringify(db)); await start(); }
const pots = async () => { const d = (await call('/api/ledger')).data; const L = d.ledger || d; return ((L.xpPotions || {}).minor) | 0; };
(async () => { try {
  port = await freePort(); base = 'http://127.0.0.1:' + port; await start();
  const g = await call('/api/guest', { deviceId: 'xpqty-' + Date.now() }); token = g.data.token; id = g.data.profile.id; await call('/api/ledger');
  // a high Commander level so the cap is far away, 50 minor potions, Vael owned at 0 XP
  await editDB((db, u) => { u.led.px = 99000000; u.led.xpPotions = { minor: 50 }; u.led.unlocked.vael = true; u.led.hero.vael = { xp: 0, stars: 1, pips: 0 }; });
  const one = await call('/api/hero/xp-potion', { heroKey: 'vael', tier: 'minor', requestId: 'q1' });
  ok(one.status === 200 && one.data.ok === true && (one.data.used === undefined || one.data.used === 1), 'no qty = one potion, as before (' + JSON.stringify(one.data).slice(0, 80) + ')');
  ok(await pots() === 49, 'one potion taken');
  const ten = await call('/api/hero/xp-potion', { heroKey: 'vael', tier: 'minor', qty: 10, requestId: 'q10' });
  ok(ten.data.ok === true && ten.data.used === 10 && ten.data.heroXp === 10 * one.data.heroXp, 'qty 10 uses 10 potions and gives 10x the XP (' + JSON.stringify({ used: ten.data.used, xp: ten.data.heroXp }) + ')');
  ok(await pots() === 39, 'ten potions taken (39 left)');
  const huge = await call('/api/hero/xp-potion', { heroKey: 'vael', tier: 'minor', qty: 5000, requestId: 'qbig' });
  ok(huge.data.ok === true && huge.data.used === 39, 'qty above what you own uses only what you own (used ' + huge.data.used + ')');
  ok(await pots() === 0, 'all potions used, none below zero');
  // Commander cap: a low Commander level stops the run early - the rest stay in the bag
  await editDB((db, u) => { u.led.px = 3000; u.led.xpPotions = { minor: 999 }; u.led.hero.vael = { xp: 0, stars: 1, pips: 0 }; });
  const capped = await call('/api/hero/xp-potion', { heroKey: 'vael', tier: 'minor', qty: 999, requestId: 'qcap' });
  const left = await pots();
  ok(capped.data.ok === true && capped.data.used < 999 && left === 999 - capped.data.used, 'the Commander cap stops it early and keeps the rest (used ' + capped.data.used + ', left ' + left + ')');
  const again = await call('/api/hero/xp-potion', { heroKey: 'vael', tier: 'minor', qty: 5, requestId: 'qagain' });
  ok(again.data.ok === false && await pots() === left, 'at the cap nothing more is taken (' + (again.data.error || '') + ')');
  const replay = await call('/api/hero/xp-potion', { heroKey: 'vael', tier: 'minor', qty: 10, requestId: 'q10' });
  ok(replay.data.used === 10 && await pots() === left, 'a replayed requestId returns the first answer and takes nothing');
  const src = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
  ok(/data-xp-qty="\$\{id\}" min="1" max="\$\{Math\.max\(1,Math\.min\(999,own\)\)\}"/.test(src) && /useHeroXpPotion\(key,btn\.dataset\.xpPotion,q\?q\.value:1\)/.test(src) && /qty:n\}/.test(src), 'the hero panel has a 1-999 number box per potion and sends it');
  if (process.env.AUD_SERVER) { console.log('CONTROL: ' + missed.length + ' check(s) failed as expected on the old server'); process.exit(missed.length ? 0 : 1); }
  console.log('test_xp_potion_qty_1290.js: ' + pass + ' checks passed');
} catch (e) { console.error(e); process.exitCode = 1; } finally { await stop(); } })();
