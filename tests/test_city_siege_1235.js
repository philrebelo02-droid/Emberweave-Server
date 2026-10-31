'use strict';
// v1235 CITY SIEGE (first slice) + two map fixes on the same branch. Phil 31 Oct 2026: "i still cannot left click to attack cities, it
// should have a Sword ... when i hove over a citty, oasis, or world tree for attach. when then i left click it gives me the option to
// attack"; "ship and dotted lines are now too big in comparison to the castles"; "when im mining the mine dissapears, it should [not]
// dissapear until its depleted".
//   1. module: 16 cities + 4 oases + the World Tree are siege sites; the 20-square rule measures to the nearest site square.
//   2. server (a real server, one-file world): 19 squares -> the march starts and goes to the site's CENTRE; 21 -> refused; the
//      player's reported win seizes the site for the player's GUILD (v1237: only a guild member may attack; the winning line stays as
//      the garrison - tests/test_city_garrison_1237.js), the result is idempotent, survives a restart and is in the world read for
//      everyone; a reported loss changes nothing; the honest digest replays to a match (no flag).
//   3. client (Chromium, phone landscape): the attack-icon marker + cursor over a city, an oasis and the Tree; the click panel with
//      name, holder, distance; Attack enabled at 19 and disabled with the reason at 21; the holder banner on the map; the march ship
//      ~1 castle and the trail dashes ~0.35 castle at two zooms; a mine being gathered stays drawn with its timer, a depleted one goes.
//   CONTROL: f817e438 (before this branch) refuses the siege route and has no hover marker - must fail.
// Asserts, exits non-zero. NODE_PATH=C:/Users/Home/Downloads/ew-realm-suite/node_modules
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
let chromium = null;
for (const p of ['playwright', 'C:\\Users\\Home\\Downloads\\ew-realm-suite\\node_modules\\playwright']) { try { chromium = require(p).chromium; if (chromium) break; } catch (e) {} }
const root = path.join(__dirname, '..');
const RLM = require('../world-realm.js'), SG = require('../assets/ui/world-siege.js'), LOC = require('../server/world-location.js'), MINES = require('../server/world-mines.js');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CONTROL = process.env.SIEGE_CONTROL || 'f817e438';
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

async function server(dir) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'siege-1235-')), db = path.join(temp, 'db.json'), port = await freePort(), base = 'http://127.0.0.1:' + port;
  let child = null, log = '';
  const req = async (method, route, data, token, ip) => { const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': ip || '10.71.0.1' }, body: data ? JSON.stringify(data) : undefined });
    const t = await r.text(); let b = {}; try { b = JSON.parse(t); } catch (_) {} return { status: r.status, body: b }; };
  const start = async admin => { child = spawn(process.execPath, ['server.js'], { cwd: dir, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: admin || '', DB_STORE: '',
      NODE_ENV: 'test', SIM_WORKERS: '0', DATABASE_URL: '', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', SERVER_SECRET: 'v1235-test', WORLD_CITY_TEST_MS: '1500' } });
    const c = child; c.stderr.on('data', d => { log = (log + d).slice(-4000); });
    for (let i = 0; i < 400; i++) { if (c.exitCode !== null) throw Error('server exited: ' + log); try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await sleep(100); } throw Error('server not ready: ' + log); };
  const stop = async () => { if (!child) return; const c = child; child = null; c.kill('SIGTERM'); await Promise.race([new Promise(r => c.once('exit', r)), sleep(8000)]); if (c.exitCode === null) c.kill('SIGKILL'); await sleep(300); };
  return { base, db, req, start, stop, log: () => log };
}
async function player(S, A, name, ip) {
  const r = await S.req('POST', '/api/register', { name, pass: 'password1' }, null, ip); assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160));
  const keys = ['vael', 'sylthaine', 'vireo', 'brannus', 'mirelle'];
  const g = await S.req('POST', '/api/admin/led-grant', { userId: r.body.profile.id, unlock: keys, heroKeys: keys, px: 900000, heroXp: 900000, gems: 5000 }, A); assert.equal(g.body.ok, true, JSON.stringify(g.body).slice(0, 160));
  const w = await S.req('GET', '/api/world/state', null, r.body.token, ip); assert.ok(w.body && w.body.locked === false, 'castle placed: ' + JSON.stringify(w.body).slice(0, 160));
  return { id: r.body.profile.id, token: r.body.token, name, ip, loc: { x: w.body.x, y: w.body.y, region: w.body.region }, keys };
}
// an open square of `region` exactly `d` squares from the site (nearest-square rule), not on a mine
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
function pickSite(region, exclude) {   // a site with open squares of this region at 19 and 21
  for (const s of SG.sites()) { if (s.kind !== 'city' || s.id === exclude) continue; const a = cellAt(s, region, 19), b = cellAt(s, region, 21); if (a && b) return { site: s, at19: a, at21: b }; }
  return null;
}
async function relocate(S, p, pos, tag) {
  let r = await S.req('POST', '/api/world/relocate', { kind: 'targeted', x: pos.x, y: pos.y, requestId: 'mv-' + tag }, p.token, p.ip);
  if (!r.body.ok && /scroll/i.test(r.body.error || '')) { await S.req('POST', '/api/world/buy-scrolls', { offer: 'targeted1', requestId: 'buy-' + tag }, p.token, p.ip);
    r = await S.req('POST', '/api/world/relocate', { kind: 'targeted', x: pos.x, y: pos.y, requestId: 'mv2-' + tag }, p.token, p.ip); }
  assert.ok(r.body.ok, 'relocate ' + tag + ': ' + JSON.stringify(r.body).slice(0, 200)); p.loc = { x: r.body.x, y: r.body.y, region: p.loc.region };
}

// ---------- 1. the module ----------
function moduleChecks() {
  const all = SG.sites(); ok(all.filter(s => s.kind === 'city').length === 16 && all.filter(s => s.kind === 'oasis').length === 4 && all.filter(s => s.kind === 'tree').length === 1, '21 siege sites: 16 cities, 4 oases, the World Tree');
  for (const s of all) { const [x, y] = s.cells[0]; if (SG.atCell(x, y) !== s) throw Error('atCell ' + s.id); }
  ok(true, 'every site square maps back to its site');
  const t = SG.byId('tree'); ok(t && t.cells.length === 14 * 14 && Math.abs(t.x - RLM.META.tree.cx * RLM.GEO.CELL) < 1e-9, 'the World Tree site is its 14 x 14 core, centred on the trunk');
  const c = SG.byId('city-durrakh'); ok(c && c.guardLevel === 10 && SG.byId('city-hollin').guardLevel === 2 && SG.byId('oasis-nw').guardLevel === 1, 'guards scale with size (Durrakh 10, Hollin 2, an oasis 1)');
  ok(SG.RANGE_SQUARES === 20 && SG.PROTECT_MS === 3600000, 'defaults: 20 squares, 1 h protection');
  const s = SG.byId('oasis-nw'), near = { x: s.x, y: s.y + 0.5 }, now = Date.now(), held = { type: 'player', id: 'u1', name: 'A', protectedUntil: now + 600000 };
  // v1237: every attacker below is in a guild (a guild-less player is refused first - test_city_garrison_1237)
  ok(/protected for 10 more min/.test(SG.refusal({ site: s, castle: near, holder: held, me: { id: 'u2', guildId: 'g2' }, now })) && /already hold/.test(SG.refusal({ site: s, castle: near, holder: held, me: { id: 'u1', guildId: 'g9' }, now }))
    && /already hold/.test(SG.refusal({ site: s, castle: near, holder: { ...held, type: 'guild', id: 'g1' }, me: { id: 'u3', guildId: 'g1' }, now })) && SG.refusal({ site: s, castle: near, holder: { ...held, protectedUntil: now - 1 }, me: { id: 'u2', guildId: 'g2' }, now }) === null
    && /armies/.test(SG.refusal({ site: s, castle: near, holder: null, me: { id: 'u2', guildId: 'g2' }, now, freeMarch: false })), 'rules: protection hour, your own / your guild site refused, open after the hour, no free army refused');
}

// ---------- 2. the server ----------
async function serverChecks() {
  const S = await server(root); const out = {};
  try {
    await S.start(''); const adm = await S.req('POST', '/api/register', { name: 'sgAdm', pass: 'password1' }); await S.stop(); await S.start(adm.body.profile.id);
    const A = (await S.req('POST', '/api/login', { name: 'sgAdm', pass: 'password1' })).body.token;
    const p1 = await player(S, A, 'sgOne', '10.71.1.1'), p2 = await player(S, A, 'sgTwo', '10.71.1.2');
    // v1237 (Phil: "only guild players can attack a city"): each attacker leads a guild
    const g1 = await S.req('POST', '/api/guild/create', { name: 'Ember Hold' }, p1.token, p1.ip), g2 = await S.req('POST', '/api/guild/create', { name: 'Ash Watch' }, p2.token, p2.ip);
    assert.ok(g1.body.guild && g2.body.guild, 'guilds: ' + JSON.stringify([g1.body, g2.body]).slice(0, 200)); p1.guildId = g1.body.guild.id; p2.guildId = g2.body.guild.id;
    const pick = pickSite(p1.loc.region); assert.ok(pick, 'a city with open squares of ' + p1.loc.region + ' at 19 and 21');
    const { site } = pick; out.site = site.id; out.at19 = pick.at19.pos; out.at21 = pick.at21.pos;
    // 21 squares: refused (server)
    await relocate(S, p1, pick.at21.pos, 'a21');
    let r = await S.req('POST', '/api/world/siege/start', { siteId: site.id, heroIds: p1.keys, requestId: 's21' }, p1.token, p1.ip);
    ok(r.status === 400 && r.body.ok === false && r.body.distance === 21 && /21 squares/.test(r.body.error), 'server: 21 squares from ' + site.name + ' is refused (' + r.body.error + ')');
    // 19 squares: the march starts, to the CENTRE
    await relocate(S, p1, pick.at19.pos, 'a19');
    r = await S.req('POST', '/api/world/siege/start', { siteId: site.id, heroIds: p1.keys, requestId: 's19' }, p1.token, p1.ip);
    ok(r.body.ok === true && r.body.distance === 19, 'server: 19 squares - the siege march starts (' + JSON.stringify(r.body).slice(0, 100) + ')');
    ok(Math.abs(r.body.target.x - site.x) < 1e-9 && Math.abs(r.body.target.y - site.y) < 1e-9, 'the march goes to the site centre from the realm data (' + site.cx + ', ' + site.cy + ' squares)');
    ok(Array.isArray(r.body.foe) && r.body.foe.length === 5 && r.body.foe.every(f => f.level === [1, 8, 16, 26, 36, 44, 52, 58, 66, 74][site.guardLevel - 1]), 'guards: the mine guardians\' five at the site\'s guard level ' + site.guardLevel);
    const again = await S.req('POST', '/api/world/siege/start', { siteId: site.id, heroIds: p1.keys, requestId: 's19' }, p1.token, p1.ip);
    ok(again.body.marchId === r.body.marchId, 'a retried start (same request id) is the same march');
    const busy = await S.req('POST', '/api/world/siege/start', { siteId: site.id, heroIds: p1.keys, requestId: 's19b' }, p1.token, p1.ip);
    ok(busy.body.ok === false && /already marching/.test(busy.body.error), 'march rules: heroes already out are refused');
    const ms = await S.req('GET', '/api/world/marches', null, p1.token, p1.ip), row = (ms.body.marches || []).find(m => m.id === r.body.marchId);
    ok(row && row.route && Math.abs(row.route.to.x - site.x) < 1e-9 && Math.abs(row.route.to.y - site.y) < 1e-9, 'the frozen route (map line) ends at the centre');
    const atk = await S.req('POST', '/api/pvp/attack', { defId: '', marchId: r.body.marchId, requestId: 'pa1' }, p1.token, p1.ip);
    ok(atk.body.ok === false, 'a siege march cannot be settled as a castle attack');
    await sleep(1700);
    // the player's fight (the same engine the browser runs)
    const host = require('../server/sim-host.js').load(path.join(root, 'emberweave-heroes.html'));
    const fight = host.auto(JSON.parse(JSON.stringify(r.body.snaps)), JSON.parse(JSON.stringify(r.body.foe)), r.body.seed >>> 0);
    out.honestWon = fight.won;
    const bad = await S.req('POST', '/api/world/siege/resolve', { marchId: r.body.marchId, requestId: 'r0', won: true, digest: 'nope' }, p1.token, p1.ip);
    ok(bad.body.ok === false && bad.body.unverified === true, 'an incomplete result is refused and nothing is spent');
    // report a WIN (if the honest fight lost, the claim is a flag - never a verdict - and the win still stands)
    const dig = JSON.parse(fight.digest); dig.won = true;
    const claimDigest = fight.won ? fight.digest : JSON.stringify(dig);
    const win = await S.req('POST', '/api/world/siege/resolve', { marchId: r.body.marchId, requestId: 'r1', won: true, digest: claimDigest }, p1.token, p1.ip);
    ok(win.body.ok === true && win.body.won === true && win.body.seized === true && win.body.holder && win.body.holder.name === 'Ember Hold' && win.body.holder.type === 'guild' && win.body.garrisoned === true, 'the reported win seizes ' + site.name + ' for the guild and the line stays (v1237)');
    ok(win.body.digestMatch === fight.won && win.body.replayIncident === !fight.won, 'replay: honest win matches (' + fight.won + '); a mismatch is a flag only');
    const w2 = await S.req('POST', '/api/world/siege/resolve', { marchId: r.body.marchId, requestId: 'r1', won: true, digest: claimDigest }, p1.token, p1.ip);
    const w3 = await S.req('POST', '/api/world/siege/resolve', { marchId: r.body.marchId, requestId: 'r2', won: false, digest: JSON.stringify({ ...dig, won: false }) }, p1.token, p1.ip);
    ok(JSON.stringify(w2.body) === JSON.stringify(win.body) && w3.body.won === true && w3.body.seized === true, 'idempotent: the same or a new request id gets the same receipt (cannot flip or pay twice)');
    // a LOSS changes nothing: p2 on an unheld oasis-free city - use the same rule on another site p2 can reach
    const pick2 = pickSite(p2.loc.region, site.id); assert.ok(pick2, 'a site for player two');
    await relocate(S, p2, pick2.at19.pos, 'b19');
    const before = (await S.req('GET', '/api/world/sieges', null, p2.token, p2.ip)).body;
    const target2 = pick2.site; out.target2 = target2.id;
    {
      const s2 = await S.req('POST', '/api/world/siege/start', { siteId: target2.id, heroIds: p2.keys, requestId: 'p2s' }, p2.token, p2.ip); assert.ok(s2.body.ok, JSON.stringify(s2.body).slice(0, 200)); await sleep(1700);
      const f2 = host.auto(JSON.parse(JSON.stringify(s2.body.snaps)), JSON.parse(JSON.stringify(s2.body.foe)), s2.body.seed >>> 0), d2 = JSON.parse(f2.digest); d2.won = false;
      const loss = await S.req('POST', '/api/world/siege/resolve', { marchId: s2.body.marchId, requestId: 'p2r', won: false, digest: JSON.stringify(d2) }, p2.token, p2.ip);
      const after = (await S.req('GET', '/api/world/sieges', null, p2.token, p2.ip)).body;
      ok(loss.body.ok === true && loss.body.won === false && loss.body.seized === false && !after.sites[target2.id] && after.rev === before.rev, 'a reported loss changes nothing (' + target2.name + ' stays unheld, rev ' + after.rev + ')');
    }
    // restart: the holder survives, and every player reads it
    await S.stop(); await S.start(adm.body.profile.id);
    const st = await S.req('GET', '/api/world/state', null, p2.token, p2.ip);
    ok(st.body.sieges && st.body.sieges.sites[site.id] && st.body.sieges.sites[site.id].name === 'Ember Hold', 'after a restart the world read shows ' + site.name + ' held by Ember Hold (to another player)');
    const disk = JSON.parse(fs.readFileSync(S.db, 'utf8'));
    ok(disk.worldSieges && disk.worldSieges.sites[site.id] && disk.worldSieges.sites[site.id].id === p1.guildId, 'the holder is in the saved world file (backed up with the world)');
    out.p1 = p1; out.p2 = p2; out.S = S; out.A = A;
    return out;
  } catch (e) { await S.stop(); console.error(S.log().slice(-1500)); throw e; }
}

// ---------- 3. the client ----------
async function clientChecks(info) {
  const { S, p1, site: siteId } = info, site = SG.byId(siteId);
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
  try {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } }), page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(S.base + '/play', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { ACC.token = t; G.playerXP = 900000; }, p1.token);
    if (await page.locator('#tutSkip').isVisible()) await page.locator('#tutSkip').click();
    await page.locator('#splashPlay').click();
    await page.waitForFunction(() => document.getElementById('rotateGate')?.style.display === 'none', null, { timeout: 15000 });
    await page.evaluate(t => { ACC.token = t; G.tutSkipped = true; document.querySelectorAll('#tutOffer').forEach(n => n.remove()); show('world'); }, p1.token);
    await page.waitForFunction(() => _worldServerAccount === ACC.token && document.getElementById('wzoneInner'), null, { timeout: 15000 });
    await page.evaluate(() => document.querySelectorAll('#tutOffer').forEach(n => n.remove())); await page.waitForTimeout(800);
    // hover: a city, an oasis, the Tree
    const hoverAt = async (sid) => { const pt = await page.evaluate(id => { const s = EmberweaveWorldSiege.byId(id); mapZoomCloseAt(s.x, s.y); return s.id; }, sid); await page.waitForTimeout(500);
      const xy = await page.evaluate(id => { const s = EmberweaveWorldSiege.byId(id), z = document.getElementById('wzone'), r = z.getBoundingClientRect(), G2 = EmberweaveRealm.GEO;
        let best = null; for (const [x, y] of s.cells) { const d = Math.hypot(x + .5 - s.cx, y + .5 - s.cy); if (!best || d < best.d) best = { x, y, d }; }
        const wx = (best.x + .5) * G2.CELL / 100 * WORLD_W, wy = (G2.Y0 + (best.y + .5) * G2.CELL) / 100 * WORLD_H;
        return { x: r.left + (wx - wzLeft(z)) * worldZoom, y: r.top + (wy - wzTop(z)) * worldZoom }; }, sid);
      await page.mouse.move(xy.x - 30, xy.y - 30); await page.mouse.move(xy.x, xy.y); await page.waitForTimeout(150);
      return { xy, ...(await page.evaluate(() => { const m = document.getElementById('siegeHover'), z = document.getElementById('wzone');
        return { shown: !!m && m.style.display === 'block', site: m && m.dataset.siteId, src: m && m.getAttribute('src'), cursor: z.style.cursor }; })) }; };
    for (const sid of [siteId, 'oasis-ne', 'tree']) { const h = await hoverAt(sid);
      ok(!h.shown && h.site === sid && /attack-cursor-32\.png/.test(h.cursor), 'hover over ' + sid + ': ONE sword - the sword cursor, no extra floating icon (v1236, Phil) (' + h.site + ')'); }
    const off = await page.evaluate(() => { const z = document.getElementById('wzone'), r = z.getBoundingClientRect(); return { x: r.left + 5, y: r.top + r.height / 2 }; });
    // click: the panel
    const h = await hoverAt(siteId); await page.mouse.click(h.xy.x, h.xy.y); await page.waitForTimeout(800);
    const pan = await page.evaluate(() => { const p = document.getElementById('siegePanel'); return p && { id: p.dataset.siteId, name: p.querySelector('#spName').textContent, holder: p.querySelector('#spHolder').textContent,
      dist: +p.querySelector('#spDist').dataset.squares, attack: !!p.querySelector('#spAttack'), defense: !!p.querySelector('#spDefense'), view: !!p.querySelector('#spView') }; });
    ok(pan && pan.id === siteId && pan.name === site.name && pan.holder === 'Ember Hold (guild)' && pan.dist === 19 && !pan.attack && pan.defense && pan.view, 'left click opens the panel (your guild\'s site: Defense + View Garrison, v1237): ' + JSON.stringify(pan));
    // the gate in the panel: an unheld site at 19 (enabled) and 21 (disabled + reason) - the castle moved on this page only
    const gate = await page.evaluate(async ([id, a, b]) => { const keep = siegeRefresh; siegeRefresh = () => Promise.resolve(_siegeState); _siegeState.sites = {}; const S = EmberweaveWorldSiege, s = S.byId(id), res = [];
      for (const pos of [a, b]) { G.castleX = pos.x; G.castleY = pos.y; await openSiegePanel(id); _siegeState.sites = {}; const p = document.getElementById('siegePanel');
        const sp = p.querySelector('#spAttack'); res.push({ dist: +p.querySelector('#spDist').dataset.squares, dis: sp.disabled, why: p.querySelector('#spWhy').textContent }); p.remove(); }
      siegeRefresh = keep; return res; }, [siteId, info.at19, info.at21]);
    ok(gate[0].dist === 19 && gate[0].dis === false && gate[1].dist === 21 && gate[1].dis === true && /21 squares/.test(gate[1].why), 'client gate: 19 squares Attack enabled, 21 disabled with the reason (' + JSON.stringify(gate) + ')');
    await page.evaluate(() => { G.castleX = null; G.castleY = null; }); await page.evaluate(() => siegeRefresh());
    const banner = await page.evaluate(id => { const b = document.querySelector('.wmSiegeHolder[data-site-id="' + id + '"]'); return b && { name: b.querySelector('span').textContent, g: b.querySelector('.wmGarrison').textContent }; }, siteId);
    ok(banner && banner.name === 'Ember Hold' && banner.g === '1/8', 'the holder banner is on the map with the garrison count: ' + JSON.stringify(banner));
    // march ship + trail in proportion to a castle, at two zooms
    const sizes = [];
    for (const zf of ['close', 'max']) {
      sizes.push(await page.evaluate(zf => { const c = myCastlePos(); mapZoomCloseAt(c.x, c.y); if (zf === 'max') { const z = document.getElementById('wzone'); worldZoom = worldZoomBounds(z).max; applyWorldZoom(); }
        const now = Date.now(); G.marches = (G.marches || []).filter(m => m.id !== 'szTest'); G.marches.push({ id: 'szTest', dir: 'out', ctype: 'attack', tName: 'Size test', fx: c.x + 2, fy: c.y + 1, heroes: [], depart: now - 20000, arrive: now + 200000, home: now + 400000, out: 220000, resolved: false });
        drawMarches(); const ship = document.querySelector('#marchVeh .marchShipWrap').getBoundingClientRect(), castle = document.querySelector('#wzoneInner .wnode.city.me .castle-spr').getBoundingClientRect();
        const ln = document.querySelector('#marchG line'), w = +ln.getAttribute('stroke-width'), da = ln.getAttribute('stroke-dasharray').split(' ').map(Number), pctPx = WORLD_W / 100 * worldZoom;
        const timer = [...document.querySelectorAll('#marchVeh .marchTimer')].pop().getBoundingClientRect();
        G.marches = G.marches.filter(m => m.id !== 'szTest'); drawMarches();
        return { zoom: worldZoom, ship: ship.width / castle.width, dash: (da[0] + w) * pctPx / castle.width, thick: w * pctPx / castle.width, gap: (da[1] - w) * pctPx / castle.width, timerH: timer.height, castle: castle.width }; }, zf));
      await page.waitForTimeout(300); }
    for (const s of sizes) ok(s.ship >= 0.9 && s.ship <= 1.5 && s.dash >= 0.25 && s.dash <= 0.5 && s.thick >= 0.08 && s.thick <= 0.16 && s.gap >= 0.25 && s.gap <= 0.5 && s.timerH >= 9 && s.timerH <= 22,
      'zoom ' + s.zoom.toFixed(2) + ': ship ' + s.ship.toFixed(2) + ' castle, dash ' + s.dash.toFixed(2) + ' x ' + s.thick.toFixed(2) + ', gap ' + s.gap.toFixed(2) + ', timer ' + s.timerH.toFixed(1) + ' px (castle ' + s.castle.toFixed(1) + ' px)');
    ok(Math.abs(sizes[0].ship - sizes[1].ship) < 0.05 && Math.abs(sizes[0].dash - sizes[1].dash) < 0.05, 'the proportions hold across zoom');
    // a mine being gathered stays drawn with its timer; a depleted one is removed
    const mine = await page.evaluate(async () => { const c = myCastlePos(); mapZoomCloseAt(c.x, c.y); await new Promise(r => setTimeout(r, 400)); await worldMineFieldCache().sync(true);
      const inner = document.getElementById('wzoneInner'); const n = worldMines().find(m => mineAvailable(m)); if (!n) return { none: true };
      mapZoomCloseAt(n.x, n.y); await new Promise(r => setTimeout(r, 400));
      const now = Date.now(); G.marches.push({ id: 'mnTest', dir: 'out', ctype: 'mine', mineId: n.id, res: n.res, mineLevel: n.level, tName: 'x', fx: n.x, fy: n.y, heroes: [], depart: now - 60000, reachAt: now - 30000, arrive: now + 600000, home: now + 630000, out: 30000, resolved: false });
      mineClaimedSet().push(n.id); paintWorldMineField(inner); drawMarches();
      const el = inner.querySelector('.wnode.mine[data-mine-id="' + n.id + '"]'), timer = inner.querySelector('#marchVeh .marchTimer.mining');
      const res = { gathering: !!el && el.classList.contains('mining') && !!el.querySelector('.wm-mine-spr'), timer: timer && timer.textContent, timerAbove: !!timer && !!el && timer.getBoundingClientRect().bottom <= el.querySelector('.wm-mine-spr').getBoundingClientRect().top + 2 };
      G.marches.find(m => m.id === 'mnTest').arrive = Date.now() - 1; paintWorldMineField(inner);
      res.depleted = !inner.querySelector('.wnode.mine[data-mine-id="' + n.id + '"]');
      G.marches = G.marches.filter(m => m.id !== 'mnTest'); return res; });
    ok(!mine.none && mine.gathering && /^Mining /.test(mine.timer || '') && mine.timerAbove, 'a mine being gathered stays on the map with its timer above it (' + mine.timer + ')');
    ok(mine.depleted, 'a depleted mine (gather over) is removed');
    // end to end in the browser (player two): Attack -> the server march -> arrival -> the fight played HERE -> the report -> the receipt
    const p2 = info.p2, t2 = SG.byId(info.target2), page2 = await ctx.newPage(); page2.on('pageerror', e => errors.push(e.message));
    await page2.goto(S.base + '/play', { waitUntil: 'domcontentloaded' }); await page2.evaluate(t => { ACC.token = t; G.playerXP = 900000; }, p2.token);
    if (await page2.locator('#tutSkip').isVisible()) await page2.locator('#tutSkip').click();
    await page2.locator('#splashPlay').click(); await page2.waitForFunction(() => document.getElementById('rotateGate')?.style.display === 'none', null, { timeout: 15000 });
    await page2.evaluate(t => { ACC.token = t; G.tutSkipped = true; document.querySelectorAll('#tutOffer').forEach(n => n.remove()); show('world'); }, p2.token);
    await page2.waitForFunction(() => _worldServerAccount === ACC.token && document.getElementById('wzoneInner'), null, { timeout: 15000 });
    const resolved = page2.waitForResponse(r => r.url().includes('/api/world/siege/resolve') && r.request().method() === 'POST', { timeout: 60000 });
    await page2.evaluate(([id, keys]) => { const s = EmberweaveWorldSiege.byId(id); return startMarch('siege', { id, siteId: id, name: s.name, x: s.x, y: s.y }, keys); }, [t2.id, p2.keys]);
    const local = await page2.evaluate(() => (G.marches || []).filter(m => m.ctype === 'siege').map(m => ({ fx: m.fx, fy: m.fy, sid: m.serverCityId, has: !!(m.siege && m.siege.snaps) })));
    ok(local.length === 1 && Math.abs(local[0].fx - t2.x) < 1e-9 && Math.abs(local[0].fy - t2.y) < 1e-9 && local[0].sid && local[0].has, 'the client march heads for the centre of ' + t2.name + ' with the frozen fight');
    const rr = await (await resolved).json();
    ok(rr.ok === true && rr.digestMatch === true && rr.replayIncident === false, 'the fight the browser played replays to the same end on the server (won ' + rr.won + ', no flag)');
    await page2.waitForTimeout(800);
    const mail = await page2.evaluate(name => ((G.mail && G.mail.war) || []).some(m => m && m.battle && String(m.subj || '').includes(name)), t2.name);
    ok(mail, 'the result is in War mail with its replay');
    if (rr.won) { const h2 = (await S.req('GET', '/api/world/sieges', null, p1.token, p1.ip)).body.sites[t2.id]; ok(h2 && h2.name === 'Ash Watch', 'the win of player two seized ' + t2.name + ' for Ash Watch (seen by player one)'); }
    ok(errors.length === 0, 'no page errors (' + errors.slice(0, 2).join(' | ') + ')');
  } finally { await browser.close(); }
}

// ---------- control ----------
async function control() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'siege-ctl-'));
  const tar = execFileSync('git', ['archive', '--format=tar', CONTROL, '--', '.', ':!assets'], { cwd: root, maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', dir.split(path.sep).join('/')], { input: tar, maxBuffer: 1 << 30 });
  fs.symlinkSync(path.join(root, 'assets'), path.join(dir, 'assets'), 'junction');
  const html = fs.readFileSync(path.join(dir, 'emberweave-heroes.html'), 'utf8');
  const S = await server(dir); let failures = 0;
  try { await S.start(''); const r = await S.req('POST', '/api/register', { name: 'ctlP', pass: 'password1' });
    const st = await S.req('POST', '/api/world/siege/start', { siteId: 'tree', heroIds: ['vael'], requestId: 'c1' }, r.body.token);
    if (!(st.body && st.body.ok === true)) failures++;
    if (!/world-siege\.js/.test(html) || !/siegeHover/.test(html)) failures++;
    if (/stroke-dasharray','0\.07 0\.2'/.test(html)) failures++;   // the old 4-cell trail
  } finally { await S.stop(); }
  ok(failures === 3, 'CONTROL ' + CONTROL + ' fails all three: no siege route, no hover marker, the old trail size (' + failures + '/3)');
}

(async () => {
  let failed = false, info = null;
  try {
    console.log('== module'); moduleChecks();
    console.log('== server'); info = await serverChecks();
    console.log('== client'); await clientChecks(info);
    if (!process.argv.includes('--this')) { console.log('== control ' + CONTROL); await control(); }
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { if (info && info.S) await info.S.stop(); }
  console.log('test_city_siege_1235.js: ' + pass + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
