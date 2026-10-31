'use strict';
// v1237 CITY GARRISON. Phil 31 Oct 2026 (he won a siege and his march headed home): "my troop should not return when i capture it, it
// should remain in the [city]. it should say 1/8 for non capitals and 1/10 for capitols"; "only guild players can attack a city"; on a
// city his guild holds: "the option then have to change to Defense, View Garrison".
//   1. module: CAPITALS = the 4 largest cities by squares; caps 8 / 10; the label; the guild-only attack rule; the Defense rule.
//   2. server (a real server, one-file world): a guild-less player is refused; a claimed win STATIONS the march (no return, an army
//      out) as the first line; guild members add lines up to 8, the 9th is refused; Return drops the count; idempotent starts,
//      results and recalls; an enemy's siege fights the garrison heroes (not the guards), its win sends every old line home (their
//      owners' marches) and stations the attacker as the new garrison; restarts keep it all (worldSieges in the saved world).
//   3. client (Chromium, phone landscape): the map banner "N/8" (and "N/10" on a capital); your guild's site shows Defense + View
//      Garrison (Defense disabled with the reason when full, enabled below the cap), the list with Return on your own lines only;
//      an enemy site shows Attack + Close; a guild-less player's Attack is disabled with "Join a guild to attack"; a won siege march
//      is parked in the site (stationed, no line) and a server stationed row is drawn at the site with no return line.
//   CONTROL: 48495b02 (v1236, before this branch) - no guild rule, no garrison route, no Defense / garrison label code - must fail 3/3.
// Asserts, exits non-zero. NODE_PATH=C:/Users/Home/Downloads/ew-realm-suite/node_modules. Runs on the cluster (Ember's suite).
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
let chromium = null;
for (const p of ['playwright', 'C:\\Users\\Home\\Downloads\\ew-realm-suite\\node_modules\\playwright']) { try { chromium = require(p).chromium; if (chromium) break; } catch (e) {} }
const root = path.join(__dirname, '..');
const RLM = require('../world-realm.js'), SG = require('../assets/ui/world-siege.js'), LOC = require('../server/world-location.js'), MINES = require('../server/world-mines.js');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CONTROL = process.env.GARRISON_CONTROL || '48495b02';
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const FAR = 1e12;   // a stationed line's homeAt is ~100 years out

async function server(dir) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'garrison-1237-')), db = path.join(temp, 'db.json'), port = await freePort(), base = 'http://127.0.0.1:' + port;
  let child = null, log = '';
  const req = async (method, route, data, token, ip) => { const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': ip || '10.72.0.1' }, body: data ? JSON.stringify(data) : undefined });
    const t = await r.text(); let b = {}; try { b = JSON.parse(t); } catch (_) {} return { status: r.status, body: b }; };
  const start = async admin => { child = spawn(process.execPath, ['server.js'], { cwd: dir, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: admin || '', DB_STORE: '',
      NODE_ENV: 'test', SIM_WORKERS: '0', DATABASE_URL: '', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', SERVER_SECRET: 'v1237-test', WORLD_CITY_TEST_MS: '1500' } });
    const c = child; c.stderr.on('data', d => { log = (log + d).slice(-4000); });
    for (let i = 0; i < 400; i++) { if (c.exitCode !== null) throw Error('server exited: ' + log); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await sleep(100); } throw Error('server not ready: ' + log); };
  const stop = async () => { if (!child) return; const c = child; child = null; c.kill('SIGTERM'); await Promise.race([new Promise(r => c.once('exit', r)), sleep(8000)]); if (c.exitCode === null) c.kill('SIGKILL'); await sleep(300); };
  return { base, db, req, start, stop, log: () => log };
}
let ipN = 1;
async function player(S, A, name) {
  const ip = '10.72.1.' + (ipN++);
  const r = await S.req('POST', '/api/register', { name, pass: 'password1' }, null, ip); assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160));
  const keys = ['vael', 'sylthaine', 'vireo', 'brannus', 'mirelle'];
  const g = await S.req('POST', '/api/admin/led-grant', { userId: r.body.profile.id, unlock: keys, heroKeys: keys, px: 900000, heroXp: 900000, gems: 5000 }, A); assert.equal(g.body.ok, true, JSON.stringify(g.body).slice(0, 160));
  const w = await S.req('GET', '/api/world/state', null, r.body.token, ip); assert.ok(w.body && w.body.locked === false, 'castle placed: ' + JSON.stringify(w.body).slice(0, 160));
  return { id: r.body.profile.id, token: r.body.token, name, ip, loc: { x: w.body.x, y: w.body.y, region: w.body.region }, keys };
}
function cellAt(site, region, d, avoid) {
  const mines = new Set(); const ep = MINES.epochAt(Date.now()); for (let e = ep; e <= ep + 1; e++) for (const n of MINES.field(e)) for (const k of LOC.GEO.mineKeys(n.x, n.y)) mines.add(k);
  const [sx, sy] = [Math.round(site.cx), Math.round(site.cy)];
  for (let r = d - 2; r <= d + 40; r++) for (let a = 0; a < 360; a += 3) {
    const x = Math.round(sx + Math.cos(a * Math.PI / 180) * r), y = Math.round(sy + Math.sin(a * Math.PI / 180) * r);
    if (!RLM.isOpen(x, y) || RLM.landZone(x, y) !== region || mines.has(x + ',' + y) || (avoid && avoid.has(x + ',' + y))) continue;
    const pos = { x: LOC.cornerX(x), y: LOC.cornerY(y) }; if (!LOC.targetAllowed(region, pos.x, pos.y)) continue;
    if (SG.distance(pos, site) === d) return { x, y, pos };
  }
  return null;
}
// a NON-capital site both attackers can reach (each from its own region, two different squares)
function pickShared(rA, rB) {
  for (const s of SG.sites()) { if (SG.isCapital(s)) continue; const a = cellAt(s, rA, 19); if (!a) continue;
    for (let d = 18; d >= 8; d--) { const b = cellAt(s, rB, d, new Set([a.x + ',' + a.y])); if (b) return { site: s, a, b }; } }
  return null;
}
async function relocate(S, p, pos, tag) {
  let r = await S.req('POST', '/api/world/relocate', { kind: 'targeted', x: pos.x, y: pos.y, requestId: 'mv-' + tag }, p.token, p.ip);
  if (!r.body.ok && /scroll/i.test(r.body.error || '')) { await S.req('POST', '/api/world/buy-scrolls', { offer: 'targeted1', requestId: 'buy-' + tag }, p.token, p.ip);
    r = await S.req('POST', '/api/world/relocate', { kind: 'targeted', x: pos.x, y: pos.y, requestId: 'mv2-' + tag }, p.token, p.ip); }
  assert.ok(r.body.ok, 'relocate ' + tag + ': ' + JSON.stringify(r.body).slice(0, 200)); p.loc = { x: r.body.x, y: r.body.y, region: p.loc.region };
}
// the claimed-win digest for a frozen fight (the player's reported result stands; a mismatch is only a flag)
function claimWin(host, start) { const f = host.auto(JSON.parse(JSON.stringify(start.snaps)), JSON.parse(JSON.stringify(start.foe)), start.seed >>> 0); const d = JSON.parse(f.digest); d.won = true; return f.won ? f.digest : JSON.stringify(d); }

// ---------- 1. the module ----------
function moduleChecks() {
  const cities = SG.sites().filter(s => s.kind === 'city').sort((a, b) => b.squares - a.squares), top4 = cities.slice(0, 4).map(s => s.id).sort();
  ok(JSON.stringify(top4) === JSON.stringify(SG.CAPITALS.slice().sort()), 'CAPITALS default = the 4 largest cities by squares: ' + cities.slice(0, 5).map(s => s.name + ' ' + s.squares).join(', '));
  const cap = SG.byId(SG.CAPITALS[0]), city = cities.find(s => !SG.isCapital(s));
  ok(SG.garrisonCap(cap) === 10 && SG.garrisonCap(city) === 8 && SG.garrisonCap(SG.byId('oasis-nw')) === 8 && SG.garrisonCap(SG.byId('tree')) === 8, 'caps: a capital 10, a city 8, an oasis 8, the World Tree 8');
  ok(SG.garrisonLabel(city, { garrison: [1] }) === '1/8' && SG.garrisonLabel(cap, { garrison: [1, 2, 3] }) === '3/10' && SG.garrisonLabel(cap, { lines: 4 }) === '4/10' && SG.garrisonLabel(city, null) === '0/8', 'label: 1/8, 3/10 on a capital (from lines too)');
  const near = { x: city.x, y: city.y }, now = Date.now();
  ok(/^Join a guild to attack a city/.test(SG.refusal({ site: city, castle: near, holder: null, me: { id: 'u1' }, now })) && /^Join a guild to attack an oasis/.test(SG.refusal({ site: SG.byId('oasis-nw'), castle: near, holder: null, me: { id: 'u1' }, now }))
    && SG.refusal({ site: city, castle: near, holder: null, me: { id: 'u1', guildId: 'g1' }, now }) === null, 'only a guild member may attack (Phil: "only guild players can attack a city")');
  const held = { type: 'guild', id: 'g1', name: 'G', garrison: new Array(8).fill({}) }, part = { ...held, garrison: [{}] };
  ok(/full \(8\/8\)/.test(SG.garrisonRefusal({ site: city, holder: held, me: { id: 'u', guildId: 'g1' } })) && SG.garrisonRefusal({ site: city, holder: part, me: { id: 'u', guildId: 'g1' } }) === null
    && /Only the guild holding/.test(SG.garrisonRefusal({ site: city, holder: part, me: { id: 'u', guildId: 'g2' } })) && /Join a guild/.test(SG.garrisonRefusal({ site: city, holder: part, me: { id: 'u' } }))
    && /armies/.test(SG.garrisonRefusal({ site: city, holder: part, me: { id: 'u', guildId: 'g1' }, freeMarch: false }))
    && SG.garrisonRefusal({ site: cap, holder: { ...held, garrison: new Array(9).fill({}) }, me: { id: 'u', guildId: 'g1' } }) === null, 'Defense rule: holder guild only, full at 8 (a capital takes a 10th), no free army refused');
}

// ---------- 2. the server (+ the client in the middle, while the first guild holds 8/8) ----------
async function run(clientChecks) {
  const S = await server(root);
  try {
    await S.start(''); const adm = await S.req('POST', '/api/register', { name: 'gnAdm', pass: 'password1' }); await S.stop(); await S.start(adm.body.profile.id);
    const A = (await S.req('POST', '/api/login', { name: 'gnAdm', pass: 'password1' })).body.token;
    const a1 = await player(S, A, 'gnLead'); let b1 = null, pick = null;
    for (let i = 0; i < 8 && !pick; i++) { b1 = await player(S, A, 'gnFoe' + i); pick = pickShared(a1.loc.region, b1.loc.region); }
    assert.ok(pick, 'a non-capital site two castles can reach');
    const { site } = pick; await relocate(S, a1, pick.a.pos, 'a1'); await relocate(S, b1, pick.b.pos, 'b1');
    const mates = []; for (let i = 2; i <= 5; i++) mates.push(await player(S, A, 'gnMate' + i));
    const n0 = await player(S, A, 'gnLone');
    const gA = await S.req('POST', '/api/guild/create', { name: 'Iron Vow' }, a1.token, a1.ip), gB = await S.req('POST', '/api/guild/create', { name: 'Grey Banner' }, b1.token, b1.ip);
    assert.ok(gA.body.guild && gB.body.guild, JSON.stringify([gA.body, gB.body]).slice(0, 200));
    for (const m of mates) { const q = await S.req('POST', '/api/guild/request', { guildId: gA.body.guild.id }, m.token, m.ip); assert.ok(q.body.ok, JSON.stringify(q.body));
      const ap = await S.req('POST', '/api/guild/approve', { id: m.id }, a1.token, a1.ip); assert.ok(ap.body.guild, JSON.stringify(ap.body).slice(0, 200)); }
    const [a2, a3, a4, a5] = mates;
    const host = require('../server/sim-host.js').load(path.join(root, 'emberweave-heroes.html'));
    const sieges = async p => (await S.req('GET', '/api/world/sieges', null, p.token, p.ip)).body;
    const marches = async p => (await S.req('GET', '/api/world/marches', null, p.token, p.ip)).body.marches || [];

    // guild-less: refused (server)
    let r = await S.req('POST', '/api/world/siege/start', { siteId: site.id, heroIds: n0.keys, requestId: 'n0s' }, n0.token, n0.ip);
    ok(r.status === 400 && /^Join a guild to attack/.test(r.body.error || ''), 'server: a player with no guild cannot attack (' + r.body.error + ')');

    // the first guild takes the site: the march STAYS
    const s1 = await S.req('POST', '/api/world/siege/start', { siteId: site.id, heroIds: a1.keys.slice(0, 3), requestId: 'a1s' }, a1.token, a1.ip);
    assert.ok(s1.body.ok, JSON.stringify(s1.body).slice(0, 200)); ok(s1.body.defenders === 'guards', 'an unheld site is defended by its NPC guards');
    await sleep(1700);
    const w1 = await S.req('POST', '/api/world/siege/resolve', { marchId: s1.body.marchId, requestId: 'a1r', won: true, digest: claimWin(host, s1.body) }, a1.token, a1.ip);
    ok(w1.body.ok && w1.body.won && w1.body.seized && w1.body.garrisoned === true && w1.body.holder.name === 'Iron Vow' && w1.body.lines === 1 && w1.body.cap === 8 && w1.body.homeAt > Date.now() + FAR,
      'a win seizes ' + site.name + ' for Iron Vow and the march stays as its first line (1/8, no return trip)');
    let row = (await marches(a1)).find(m => m.id === s1.body.marchId);
    ok(row && row.phase === 'stationed' && row.stationed === true && row.garrison === true && row.siteId === site.id && row.homeAt > Date.now() + FAR, 'the march reads as stationed in ' + site.name + ' (phase ' + (row && row.phase) + ')');
    let sv = await sieges(a1);
    ok(sv.sites[site.id].lines === 1 && sv.sites[site.id].cap === 8 && sv.sites[site.id].garrison.length === 1 && sv.sites[site.id].garrison[0].mine === true && sv.armies.out === 1, 'the garrison reads 1/8 and the stationed line is an army out (' + JSON.stringify(sv.armies) + ')');
    const sb = await sieges(b1);
    ok(sb.sites[site.id].lines === 1 && !sb.sites[site.id].garrison, 'another guild sees the count, not the lines');
    const w1b = await S.req('POST', '/api/world/siege/resolve', { marchId: s1.body.marchId, requestId: 'a1r2', won: false, digest: '{}' }, a1.token, a1.ip);
    ok(JSON.stringify(w1b.body) === JSON.stringify(w1.body) && (await sieges(a1)).sites[site.id].lines === 1, 'idempotent: a retried result is the same receipt, the count stays 1');

    // Defense: guild members add lines up to 8
    const add = async (p, keys, rid) => S.req('POST', '/api/world/siege/garrison', { siteId: site.id, heroIds: keys, requestId: rid }, p.token, p.ip);
    const plan = [[a1, a1.keys.slice(3, 5)], [a2, a2.keys.slice(0, 2)], [a2, a2.keys.slice(2, 4)], [a3, a3.keys.slice(0, 2)], [a3, a3.keys.slice(2, 4)], [a4, a4.keys.slice(0, 2)], [a4, a4.keys.slice(2, 4)]];
    const lines = [];
    for (let i = 0; i < plan.length; i++) { const [p, keys] = plan[i], g = await add(p, keys, 'g' + i);
      assert.ok(g.body.ok, 'line ' + (i + 2) + ': ' + JSON.stringify(g.body).slice(0, 200)); lines.push({ p, id: g.body.marchId }); if (g.body.lines !== i + 2) throw Error('count after line ' + (i + 2) + ': ' + g.body.lines); }
    ok(true, 'guild members add lines 2..8 (each reply counts up to 8/8)');
    const again = await add(a2, a2.keys.slice(0, 2), 'g1');
    ok(again.body.marchId === lines[1].id && (await sieges(a1)).sites[site.id].lines === 8, 'a retried Defense (same request id) is the same line - the count stays 8');
    r = await add(a5, a5.keys.slice(0, 2), 'a5x');
    ok(r.status === 400 && /full \(8\/8\)/.test(r.body.error || ''), 'server: a 9th line is refused (' + r.body.error + ')');
    r = await add(b1, b1.keys.slice(0, 2), 'b1x');
    ok(r.status === 400 && /Only the guild holding/.test(r.body.error || ''), 'server: another guild cannot garrison it (' + r.body.error + ')');
    r = await add(n0, n0.keys.slice(0, 2), 'n0x');
    ok(r.status === 400 && /Join a guild/.test(r.body.error || ''), 'server: a guild-less player cannot garrison (' + r.body.error + ')');
    sv = await sieges(a1); ok(sv.armies.out === 2 && sv.armies.out === sv.armies.cap, 'the leader\'s two lines are two armies out (' + JSON.stringify(sv.armies) + ')');
    await sleep(1700);   // every line arrives

    // Return: the count drops; the line marches home
    const back = await S.req('POST', '/api/world/city/recall', { marchId: lines[6].id, requestId: 'rc1' }, a4.token, a4.ip);
    ok(back.body.ok && back.body.recalled && back.body.lines === 7 && back.body.homeAt > Date.now() && back.body.homeAt < Date.now() + 600000, 'Return: the line leaves (7/8) and marches home');
    const back2 = await S.req('POST', '/api/world/city/recall', { marchId: lines[6].id, requestId: 'rc1' }, a4.token, a4.ip);
    row = (await marches(a4)).find(m => m.id === lines[6].id);
    ok(JSON.stringify(back2.body) === JSON.stringify(back.body) && row && row.phase === 'returning' && (await sieges(a1)).sites[site.id].lines === 7, 'a retried Return is the same receipt; the march reads returning');
    r = await add(a5, a5.keys.slice(0, 2), 'a5y');
    ok(r.body.ok && r.body.lines === 8, 'with room again a member fills the 8th place');
    lines.push({ p: a5, id: r.body.marchId }); await sleep(1700);

    // the client while Iron Vow holds 8/8
    if (clientChecks) await clientChecks({ S, site, a1, b1, n0, lines });

    // restart: the garrison survives; lift the protection hour on disk for the enemy siege
    await S.stop();
    const disk = JSON.parse(fs.readFileSync(S.db, 'utf8')); const rec = disk.worldSieges && disk.worldSieges.sites[site.id];
    ok(rec && Array.isArray(rec.garrison) && rec.garrison.length === (clientChecks ? 7 : 8) && rec.id === gA.body.guild.id, 'the garrison lines are in the saved world file (' + (rec && rec.garrison.length) + ' lines)');
    const before = rec.garrison.length; rec.protectedUntil = 0; fs.writeFileSync(S.db, JSON.stringify(disk));
    await S.start(adm.body.profile.id);
    sv = await sieges(a1); row = (await marches(a1)).find(m => m.id === s1.body.marchId);
    ok(sv.sites[site.id].lines === before && sv.sites[site.id].protectedUntil === 0 && row && row.phase === 'stationed', 'after a restart: ' + before + '/8 and the first line still stationed');

    // the enemy siege fights the GARRISON, and its win replaces it
    const sE = await S.req('POST', '/api/world/siege/start', { siteId: site.id, heroIds: b1.keys, requestId: 'b1s' }, b1.token, b1.ip);
    assert.ok(sE.body.ok, JSON.stringify(sE.body).slice(0, 200));
    ok(sE.body.defenders === 'garrison' && sE.body.foe.length === 5 && sE.body.foe.every(f => a1.keys.includes(f.key)) && new Set(sE.body.foe.map(f => f.key)).size === 5, 'a siege on a garrisoned site fights the garrison heroes (' + sE.body.foe.map(f => f.key).join(',') + '), not the guards');
    await sleep(1700);
    const wE = await S.req('POST', '/api/world/siege/resolve', { marchId: sE.body.marchId, requestId: 'b1r', won: true, digest: claimWin(host, sE.body) }, b1.token, b1.ip);
    ok(wE.body.ok && wE.body.seized && wE.body.holder.name === 'Grey Banner' && wE.body.sentHome === before && wE.body.garrisoned && wE.body.lines === 1, 'the win takes ' + site.name + ' for Grey Banner, sends ' + wE.body.sentHome + ' old lines home and stations the attacker (1/8)');
    const [mA1, mA2] = await Promise.all([marches(a1), marches(a2)]);   // read at once: the fixture's way home is 1.5 s
    const homeA1 = mA1.find(m => m.id === s1.body.marchId), homeA2 = mA2.filter(m => lines.some(l => l.id === m.id));
    ok(homeA1 && homeA1.phase === 'returning' && homeA1.homeAt < Date.now() + 600000 && homeA2.length === 2 && homeA2.every(m => m.phase === 'returning'), 'the old garrison owners\' marches turn for home (their own accounts)');
    await sleep(1700);   // the old lines reach home
    sv = await sieges(a1); ok(sv.sites[site.id].name === 'Grey Banner' && sv.sites[site.id].lines === 1 && !sv.sites[site.id].garrison && sv.armies.out === 0, 'Iron Vow sees Grey Banner 1/8; its armies are home and free (' + sv.armies.out + ' out)');
    await S.stop(); await S.start(adm.body.profile.id);
    sv = await sieges(b1); row = (await marches(b1)).find(m => m.id === sE.body.marchId);
    ok(sv.sites[site.id].name === 'Grey Banner' && sv.sites[site.id].lines === 1 && sv.sites[site.id].garrison[0].mine === true && row && row.phase === 'stationed', 'after another restart Grey Banner holds it with its stationed line');
  } catch (e) { console.error(S.log().slice(-1500)); throw e; }
  finally { await S.stop(); }
}

// ---------- 3. the client ----------
function clientRunner(browser) {
  return async ({ S, site, a1, b1, n0, lines }) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } }); const errors = [];
    const open = async p => { const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(S.base + '/play', { waitUntil: 'domcontentloaded' }); await page.evaluate(t => { ACC.token = t; G.playerXP = 900000; }, p.token);
      if (await page.locator('#tutSkip').isVisible()) await page.locator('#tutSkip').click();
      await page.locator('#splashPlay').click(); await page.waitForFunction(() => document.getElementById('rotateGate')?.style.display === 'none', null, { timeout: 15000 });
      await page.evaluate(t => { ACC.token = t; G.tutSkipped = true; document.querySelectorAll('#tutOffer').forEach(n => n.remove()); show('world'); }, p.token);
      await page.waitForFunction(() => _worldServerAccount === ACC.token && document.getElementById('wzoneInner'), null, { timeout: 15000 });
      await page.evaluate(() => { document.querySelectorAll('#tutOffer').forEach(n => n.remove()); return siegeRefresh(); }); await page.waitForTimeout(500); return page; };
    const panel = (page, id) => page.evaluate(async id => { await openSiegePanel(id); const p = document.getElementById('siegePanel'), q = s => p.querySelector(s);
      return { attack: q('#spAttack') ? { dis: q('#spAttack').disabled } : null, defense: q('#spDefense') ? { dis: q('#spDefense').disabled } : null, view: !!q('#spView'), close: !!q('#spClose'),
        garrison: q('#spGarrison') ? q('#spGarrison').textContent : null, why: q('#spWhy').textContent }; }, id);
    try {
      // your guild's site, full
      const pa = await open(a1);
      const banner = await pa.evaluate(id => { const b = document.querySelector('.wmSiegeHolder[data-site-id="' + id + '"]'); return b && { name: b.querySelector('span').textContent, g: b.querySelector('.wmGarrison').textContent }; }, site.id);
      ok(banner && banner.name === 'Iron Vow' && banner.g === '8/8', 'map: the holder banner reads Iron Vow 8/8 (' + JSON.stringify(banner) + ')');
      const cap = await pa.evaluate(() => { const id = EmberweaveWorldSiege.CAPITALS[0]; _siegeState.sites[id] = { type: 'guild', id: 'gx', name: 'Capital Test', lines: 3, cap: 10 }; drawSiegeHolders();
        const t = document.querySelector('.wmSiegeHolder[data-site-id="' + id + '"] .wmGarrison').textContent; delete _siegeState.sites[id]; drawSiegeHolders(); return t; });
      ok(cap === '3/10', 'map: a capital reads N/10 (' + cap + ')');
      let pn = await panel(pa, site.id);
      ok(!pn.attack && pn.defense && pn.defense.dis === true && pn.view && pn.close && pn.garrison === '8/8' && /full \(8\/8\)/.test(pn.why), 'your guild\'s site: Defense (disabled - full 8/8) + View Garrison + Close, no Attack (' + JSON.stringify(pn) + ')');
      const list = await pa.evaluate(() => { document.querySelector('#siegePanel #spView').click(); const rows = [...document.querySelectorAll('#siegePanel .sgLine')];
        return { n: rows.length, mine: rows.filter(r => r.querySelector('[data-return]')).length, owners: rows.map(r => r.querySelector('.sgOwner').textContent), count: document.querySelector('#sgCount').textContent }; });
      ok(list.n === 8 && list.mine === 2 && list.count === '8/8' && list.owners.filter(o => /\(you\)$/.test(o)).length === 2, 'View Garrison: 8 lines, Return only on your 2 (' + list.owners.join(' | ') + ')');
      // Return the leader's Defense line (lines[0]); its siege line stays for the server half
      const rcResp = pa.waitForResponse(r => r.url().includes('/api/world/city/recall'), { timeout: 15000 });
      await pa.evaluate(id => document.querySelector('#siegePanel [data-return="' + id + '"]').click(), lines[0].id);
      const rc = await (await rcResp).json(); await pa.waitForTimeout(2500);
      const afterList = await pa.evaluate(() => ({ n: document.querySelectorAll('#siegePanel .sgLine').length, count: document.querySelector('#sgCount') && document.querySelector('#sgCount').textContent }));
      ok(rc.ok && rc.lines === 7 && afterList.n === 7 && afterList.count === '7/8', 'Return in View Garrison: the line goes home, the list and count drop to 7/8');
      pn = await panel(pa, site.id);
      ok(pn.defense && pn.defense.dis === false && pn.garrison === '7/8' && pn.why === '', 'below the cap Defense is enabled (' + JSON.stringify(pn) + ')');
      // a won siege march is parked in the site (the resolve reply says garrisoned)
      const parked = await pa.evaluate(async id => { const s = EmberweaveWorldSiege.byId(id), keep = api, now = Date.now();
        api = () => Promise.resolve({ ok: true, won: true, seized: true, garrisoned: true, lines: 1, cap: 8, holder: { type: 'guild', name: 'Iron Vow' } });
        const m = { id: 'gnT', dir: 'out', ctype: 'siege', serverCityId: 'fake', siege: { snaps: [], foe: [], seed: 1 }, siegeFight: { won: true, digest: '{}' }, tName: s.name, fx: s.x, fy: s.y, heroes: [], depart: now - 2000, arrive: now - 1, home: now + 1000, out: 1000, resolved: false };
        G.marches.push(m); resolveMarch(m); await new Promise(r => setTimeout(r, 300)); api = keep;
        const res = { stationed: m.stationed === true, home: m.home - Date.now() };
        G.marches = G.marches.filter(x => x.id !== 'gnT'); document.querySelectorAll('.gmodal-ov,#marchReport').forEach(n => n.remove()); await siegeRefresh(); return res; }, site.id);
      ok(parked.stationed && parked.home > FAR, 'client: a won siege march is parked in the site (stationed, no return trip)');
      // the server's stationed row is drawn AT the site with no line back
      const drawn = await pa.evaluate(async id => { const s = EmberweaveWorldSiege.byId(id); await syncWorldMarches(true); mapZoomCloseAt(s.x, s.y); drawMarches();
        const st = worldMarchCache().state(), v = EmberweaveWorldMarchVisual.views(st.rows, Date.now(), G.marches || []).filter(x => x.phase === 'stationed');
        return { n: v.length, atSite: v.every(x => Math.abs(x.x - s.x) < 1e-6 && Math.abs(x.y - s.y) < 1e-6 && x.from.x === x.to.x), timers: [...document.querySelectorAll('#marchVeh .marchTimer')].map(t => t.textContent) }; }, site.id);
      ok(drawn.n === 1 && drawn.atSite && drawn.timers.includes('stationed'), 'map: the stationed line sits at the site centre with no return line or timer (' + JSON.stringify(drawn) + ')');
      // an enemy site: Attack + Close
      const pb = await open(b1); pn = await panel(pb, site.id);
      const gb = await pb.evaluate(id => document.querySelector('.wmSiegeHolder[data-site-id="' + id + '"] .wmGarrison').textContent, site.id);
      ok(pn.attack && !pn.defense && !pn.view && pn.close && pn.garrison === '7/8' && gb === '7/8', 'an enemy guild\'s site: Attack + Close, the count 7/8 for everyone (' + JSON.stringify(pn) + ')');
      // guild-less: Attack disabled with the reason
      const pnn = await open(n0); pn = await panel(pnn, 'tree');
      ok(pn.attack && pn.attack.dis === true && /^Join a guild to attack/.test(pn.why), 'client: a guild-less player\'s Attack is disabled - ' + pn.why);
      ok(errors.length === 0, 'no page errors (' + errors.slice(0, 2).join(' | ') + ')');
    } finally { await ctx.close(); }
  };
}

// ---------- control ----------
async function control() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garrison-ctl-'));
  const tar = execFileSync('git', ['archive', '--format=tar', CONTROL, '--', '.', ':!assets'], { cwd: root, maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', dir.split(path.sep).join('/')], { input: tar, maxBuffer: 1 << 30 });
  fs.mkdirSync(path.join(dir, 'assets'));
  for (const sub of fs.readdirSync(path.join(root, 'assets'))) if (sub !== 'ui') fs.symlinkSync(path.join(root, 'assets', sub), path.join(dir, 'assets', sub), 'junction');
  const ui = execFileSync('git', ['archive', '--format=tar', CONTROL, '--', 'assets/ui'], { cwd: root, maxBuffer: 1 << 30 });   // the control's OWN shared siege module
  execFileSync('tar', ['-x', '-C', dir.split(path.sep).join('/')], { input: ui, maxBuffer: 1 << 30 });
  const html = fs.readFileSync(path.join(dir, 'emberweave-heroes.html'), 'utf8');
  const S = await server(dir); let failures = 0;
  try { await S.start(''); const adm = await S.req('POST', '/api/register', { name: 'ctAdm', pass: 'password1' }); await S.stop(); await S.start(adm.body.profile.id);
    const A = (await S.req('POST', '/api/login', { name: 'ctAdm', pass: 'password1' })).body.token;
    const lone = await player(S, A, 'ctLone'), lead = await player(S, A, 'ctLead');
    await S.req('POST', '/api/guild/create', { name: 'Ctl Guild' }, lead.token, lead.ip);
    const st = await S.req('POST', '/api/world/siege/start', { siteId: 'tree', heroIds: lone.keys, requestId: 'c1' }, lone.token, lone.ip);
    if (!/^Join a guild to attack/.test(st.body.error || '')) failures++;
    const gr = await S.req('POST', '/api/world/siege/garrison', { siteId: 'tree', heroIds: lead.keys, requestId: 'c2' }, lead.token, lead.ip);
    if (!/Only the guild holding/.test(gr.body.error || '')) failures++;
    if (!/spDefense/.test(html) || !/garrisonLabel/.test(html)) failures++;
  } finally { await S.stop(); }
  ok(failures === 3, 'CONTROL ' + CONTROL + ' fails all three: no guild rule, no garrison route, no Defense / N/8 code (' + failures + '/3)');
}

(async () => {
  let failed = false, browser = null;
  try {
    console.log('== module'); moduleChecks();
    browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
    console.log('== server + client'); await run(clientRunner(browser));
    if (!process.argv.includes('--this')) { console.log('== control ' + CONTROL); await control(); }
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { if (browser) await browser.close(); }
  console.log('test_city_garrison_1237.js: ' + pass + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
