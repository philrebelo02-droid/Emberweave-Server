// v1336 (Phil 10 Nov: "Convert the players items to the new one"): items a hero already wears become that hero's new item, once, on a real server boot with a temp DB.
//  - a worn item on the old list becomes the hero's item of the same quality, keeps its Temper and the same item id;
//  - a type's Temper is the higher of the two; an item already right is untouched (control); an item in the bag is untouched (control);
//  - the selected gear skill still points at the worn item; a second boot changes nothing.
// Control: AUD_SERVER=<a v1335 server.js copied into the repo root> must FAIL.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), srv = process.env.AUD_SERVER || 'server.js', dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-conv-')), dbFile = path.join(dir, 'db.json');
const G = JSON.parse(fs.readFileSync(path.join(root, 'server', 'hero-gear.json'), 'utf8'));
const cat = JSON.parse(fs.readFileSync(path.join(root, 'server', 'gear-catalog.json'), 'utf8')).items, byId = Object.fromEntries(cat.map(d => [d.id, d]));
const client = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8').match(/const HERO_GEAR=Object\.freeze\((\{[^;]*?\})\);/);
let child, port, base, id, token, pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok', m); }, delay = ms => new Promise(r => setTimeout(r, ms));
const free = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start() { child = spawn(process.execPath, [srv], { cwd: root, env: { ...process.env, ALLOW_NEW_GUESTS: '1', DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile }, stdio: 'ignore', windowsHide: true }); for (let i = 0; i < 150; i++) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw Error('no start'); }
async function stop() { if (!child) return; child.kill(); for (let i = 0; i < 80 && child.exitCode === null; i++) await delay(50); child = null; }
const read = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'));
(async () => { try {
  ok(client && JSON.stringify(JSON.parse(client[1])) === JSON.stringify(G), 'the server list and the client list are the same');
  port = await free(); base = 'http://127.0.0.1:' + port; await start();
  const g = await (await fetch(base + '/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'conv-' + Date.now() }) })).json(); id = g.profile.id; token = g.token;
  await fetch(base + '/api/ledger', { headers: { 'x-token': token } }); await delay(400); await stop();
  const h1 = 'vex', h2 = 'carn', newId = G[h1][0], wrong = cat.find(d => d.qi === 0 && d.id !== newId && d.id !== G[h2][0]), right = G[h2][0];
  const db = read(); db.users[id].gear = { revision: 3, fragments: {}, subs: {}, seq: 20, active: { [h1]: 'w1' }, tt: { [wrong.id]: { temper: 9, prog: 3, dustSpent: 0 }, [newId]: { temper: 2, prog: 1, dustSpent: 0 } },
    items: { w1: { d: wrong.id, temper: 9, prog: 3, dustSpent: 0, bound: true }, r1: { d: right, temper: 4, prog: 0, dustSpent: 0, bound: true }, bag: { d: wrong.id, temper: 9, prog: 3, dustSpent: 0 } },
    equipped: { [h1]: { [wrong.slot]: 'w1' }, [h2]: { [byId[right].slot]: 'r1' } } };
  fs.writeFileSync(dbFile, JSON.stringify(db)); await start(); await delay(900); await stop();
  let g2 = read().users[id].gear;
  ok(g2.items.w1.d === newId, 'the worn item became the hero\'s new item (' + byId[newId].name + ')');
  ok(g2.equipped[h1][wrong.slot] === 'w1', 'the hero still wears the same item id');
  ok(g2.items.w1.temper === 9 && g2.tt[newId].temper === 9 && g2.tt[newId].prog === 3, 'Temper kept: the new type takes the higher of the two (9, not 2)');
  ok(g2.active[h1] === 'w1', 'the selected gear skill still points at the item');
  ok(g2.items.r1.d === right && g2.items.r1.temper === 4, 'CONTROL: an item already right is untouched');
  ok(g2.items.bag.d === wrong.id && g2.tt[wrong.id].temper === 9, 'CONTROL: an item in the bag and its type are untouched');
  ok(g2.heroGearV === 1 && g2.revision === 4, 'stamped once, revision moved so the client reloads');
  await start(); await delay(900); await stop();
  const g3 = read().users[id].gear;
  ok(JSON.stringify(g3) === JSON.stringify(g2), 'a second boot changes nothing');
  console.log('test_gear_convert_1336.js: ' + pass + ' checks passed'); process.exitCode = 0;
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await stop(); } })();
