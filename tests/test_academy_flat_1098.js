// v1099 - ACADEMY IS FLAT NUMBERS (Phil 9 Oct 2026: "there should be no percentages in academy, please make academy have flat numbers")
// and THE CASTLE FOLLOWS THE ACADEMY ("my academy is level 0, means i should have the small castle ... same thing with my world map castle").
// 1. client TECH_BASE / TECH_GROWTH = server TECH_BASE_SRV / TECH_GROWTH_SRV; every track is flat (no apMul, no techDef reduction).
// 2. a hero with every track at 30 and at 60: the server core unit (acadCombatOf + acadApply + heroCombatStats) and the client unit
//    (makeUnit from the spec the server snapshot sends) move by the same amounts, for all 60 heroes; the client's own owned-hero helpers
//    (techFlat / techArmorFlat / techMrFlat / mulsFromTotals) give the same numbers.
// 3. no '%' in the Academy screen's text (renderTech + TECH_TRACKS, static).
// 4. castle: castleTierAcad(0)=1, (24)=1, (25)=2, (100)=5, (120)=5; the server's /api/world/cities view carries the owner's academy level (live).
// Controls: a server table that drifts from the client fails the parity sweep; a '%' put back into the screen fails the static check;
// a city view without the field fails the city check. Asserts (non-zero exit).
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm'), net = require('net'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const SIM = require('../server/sim.js');
let pass = 0;
const ok = (c, m) => { assert(c, m); pass++; console.log('  ok ' + m); };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const TRACKS = ['atk', 'hp', 'ap', 'def', 'armor', 'mr', 'crit', 'critres'];

/* ---- the server's Academy code, run as written ---- */
function serverAcademy(patch) {
  const a = srv.indexOf('const TECH_MAX_SRV='), b = srv.indexOf('function learnDurSrv', a);
  const c = srv.indexOf('function acadCombat(u)'), d = srv.indexOf('/* ---- v250', c);
  assert(a > 0 && b > a && c > 0 && d > c, 'server Academy blocks found');
  let code = srv.slice(a, b) + '\n' + srv.slice(c, d);
  if (patch) code = patch(code);
  const ctx = vm.createContext({ Math });
  vm.runInContext(code + '\n;this.out={TECH_BASE_SRV,TECH_GROWTH_SRV,acadCombatOf,acadApply,techFlatSrv};', ctx);
  return ctx.out;
}
const S = serverAcademy();

/* ---- 1. one table, two copies ---- */
const host = require('../server/sim-host.js').load(path.join(ROOT, 'emberweave-heroes.html'));
const run = e => vm.runInContext(e, host.ctx);
const CB = JSON.parse(run('JSON.stringify(TECH_BASE)'));
ok(JSON.stringify(CB) === JSON.stringify(Object.assign({}, S.TECH_BASE_SRV)) && run('TECH_GROWTH') === S.TECH_GROWTH_SRV,
  'client TECH_BASE / TECH_GROWTH = server TECH_BASE_SRV / TECH_GROWTH_SRV ' + JSON.stringify(CB));
ok(TRACKS.every(k => run('!!TECH_FLAT.' + k)), 'every track is flat (TECH_FLAT has all eight)');
ok(run('abilityPowerMul()') === 1 && !/techDef/.test(html.slice(html.indexOf('function mulsFromTotals'), html.indexOf('function heroMuls'))),
  'no Academy multiplier left: abilityPowerMul() is 1 and mulsFromTotals reads no techDef reduction');
ok(/PROPOSED - Phil tunes/.test(srv.slice(srv.indexOf('const TECH_BASE_SRV'), srv.indexOf('const TECH_BASE_SRV') + 200))
  && /PROPOSED - Phil tunes/.test(html.slice(html.indexOf('const TECH_BASE='), html.indexOf('const TECH_BASE=') + 200)), 'both tables are marked PROPOSED - Phil tunes');

/* ---- 2. server unit vs client unit ---- */
const keys = Object.keys(SIM.HERO_BASE);
const OPT = { level: 100, stars: 5, pips: 0, ref: 0 };
const lvAll = L => { const lv = { academy: L }; TRACKS.forEach(k => { lv[k] = L; }); return { lv }; };
function serverUnit(SA, key, L) { const R = {}, XT = {}; SA.acadApply(R, XT, L ? SA.acadCombatOf(lvAll(L)) : null);
  return SIM.heroCombatStats(key, Object.assign({}, OPT, { ratings: R, extra: XT })); }
// the spec exactly as snapshotHeroFromServer builds it from acadCombat (the static check below pins those lines)
function specFrom(SA, key, L) { const AC = L ? SA.acadCombatOf(lvAll(L)) : null, ap = (SIM.HERO_BASE[key].apow || 0) > 0 || OPT.level > 1;
  return { key, level: 100, stars: 5, pips: 0, ref: 0, glyphRank: 6, tt: {}, ex: { techCrit: AC ? AC.critRating : 0, techCritRes: AC ? AC.critResRating : 0, equip: {} },
    fAtk: AC ? AC.atkFlat : 0, fHp: AC ? AC.hpFlat : 0, fApow: (AC && ap) ? AC.apFlat : 0, techArmor: AC ? AC.armorRating : 0, techMr: AC ? AC.mrRating : 0, apMul: 1, skillLv: [1, 1, 1, 1] }; }
const clientUnit = (SA, key, L) => host.snapFromSpecs([specFrom(SA, key, L)])[0];
function sweep(SA, L) {
  const bad = [];
  for (const key of keys) {
    const s0 = serverUnit(S, key, 0), s1 = serverUnit(SA, key, L), c0 = clientUnit(S, key, 0), c1 = clientUnit(S, key, L);
    const d = { hp: [s1.maxHp - s0.maxHp, c1.maxHp - c0.maxHp], atk: [s1.atkP - s0.atkP, c1.dmg - c0.dmg], ap: [s1.atkM - s0.atkM, c1.apow - c0.apow],
      armor: [s1.armor - s0.armor, c1.armorRating - c0.armorRating], mr: [s1.mr - s0.mr, c1.mrRating - c0.mrRating],
      crit: [s1.crit, c1.glyphCrit], critRes: [s1.critRes, c1.critRes], dr: [s1.dmgRed - s0.dmgRed, (c1.glyphDR || 0) - (c0.glyphDR || 0)] };
    for (const f in d) if (!near(d[f][0], d[f][1])) bad.push(key + '.' + f + ' ' + d[f][0] + ' vs ' + d[f][1]);
  }
  return bad;
}
for (const L of [30, 60]) { const bad = sweep(S, L);
  ok(bad.length === 0, 'all ' + keys.length + ' heroes, every track at ' + L + ': server unit = client unit (HP, Attack, Ability power, Armor, MR, crit, crit resist, no reduction)' + (bad.length ? ' ' + bad.slice(0, 4).join('; ') : '')); }
{ const AC = S.acadCombatOf(lvAll(60)), mage = keys.find(k => SIM.HERO_BASE[k].role === 'Mage'), phys = keys.find(k => !(SIM.HERO_BASE[k].apow > 0));   // no ability line at level 1 only (every class grows AP with level)
  const m0 = serverUnit(S, mage, 0), m1 = serverUnit(S, mage, 60);
  ok(m1.atkM - m0.atkM === AC.apFlat && m1.armor - m0.armor === AC.armorRating && near(m1.crit - m0.crit, AC.critRating * 0.0005) && m1.dmgRed === m0.dmgRed,
    'track 60 on ' + mage + ': +' + AC.apFlat + ' Ability power, +' + AC.armorRating + ' Armor (Defense + Armor), +' + AC.critRating + ' crit rating, damage reduction unchanged');
  { const R = {}, XT = {}; S.acadApply(R, XT, S.acadCombatOf(lvAll(60)));
    ok(!phys || SIM.heroCombatStats(phys, { level: 1, stars: 5, ratings: R, extra: XT }).atkM === 0, 'a level-1 Attack hero with no ability line gets no Ability power from the Academy (' + phys + ')'); } }
{ // the client's own owned-hero helpers read G.tech and give the server's numbers
  const lv = lvAll(60).lv; run('G.tech=' + JSON.stringify(lv));
  const AC = S.acadCombatOf({ lv });
  const cl = JSON.parse(run('JSON.stringify({ap:techFlat("ap"),atk:techFlat("atk"),hp:techFlat("hp"),ar:techArmorFlat(),mr:techMrFlat(),m:mulsFromTotals({},{techCrit:techFlat("crit"),techCritRes:techFlat("critres")})})'));
  ok(cl.ap === AC.apFlat && cl.atk === AC.atkFlat && cl.hp === AC.hpFlat && cl.ar === AC.armorRating && cl.mr === AC.mrRating
    && near(cl.m.crit, AC.critRating * 0.0005) && near(cl.m.critRes, AC.critResRating * 0.0005) && cl.m.dr === 0,
    'client owned-hero helpers at 60 = server acadCombat (AP ' + cl.ap + ', Armor ' + cl.ar + ', MR ' + cl.mr + ', crit ' + (cl.m.crit * 100).toFixed(2) + ' points of 100)'); }
{ // the server snapshot sends what specFrom assumes
  const snap = srv.slice(srv.indexOf('ex:{ techCrit:AC?AC.critRating:0'), srv.indexOf('skillLv:ledSkillArr(led,key).slice(), gearSkill, templeBonuses'));
  ok(/techCritRes:AC\?AC\.critResRating:0/.test(snap) && /fApow:tt\.apow\+\(\(AC&&\(\(\(SIM\.HERO_BASE\[key\]\|\|\{\}\)\.apow\|\|0\)>0\|\|ledHeroLevel\(led,key\)>1\)\)\?AC\.apFlat:0\)/.test(snap)
    && /techArmor:AC\?AC\.armorRating:0, techMr:AC\?AC\.mrRating:0/.test(snap) && /apMul:1,/.test(snap),
    'snapshotHeroFromServer sends crit ratings, the AP flat (ability heroes), Armor / MR ratings and apMul 1');
  ok(!/critFrac|dmgRedFrac|apMul:AC/.test(srv), 'no server path still sends an Academy fraction or multiplier'); }
{ // control: one side drifts -> the sweep fails
  const drift = serverAcademy(code => code.replace('def:7.2', 'def:7.3'));
  ok(sweep(drift, 60).length > 0, 'control: a server Defense step that drifts from the client fails the parity sweep'); }

/* ---- 3. no '%' on the Academy screen ---- */
function screenText(src) {
  const a = src.indexOf('const TECH_TRACKS=['), b = src.indexOf('/* ===================== ONLINE', a);
  return src.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')   // comments
    .replace(/style="[^"]*"/g, '').replace(/[xy]\+'%'/g, '');                          // CSS and the wheel's node positions
}
ok(screenText(html).indexOf('%') < 0, 'no "%" in the Academy screen text (TECH_TRACKS + renderTech)');
ok(screenText(html.replace("perStr='+'+(per>=10", "perStr='%+'+(per>=10")).indexOf('%') >= 0, 'control: a "%" put back into the next-level text is caught');

/* ---- 4. castle follows the Academy ---- */
ok(JSON.stringify(run('ACADEMY_CASTLE_TIERS')) === '[0,25,50,75,100]' && [0, 24, 25, 49, 50, 75, 99, 100, 120].map(l => run('castleTierAcad(' + l + ')')).join() === '1,1,2,2,3,4,4,5,5',
  'castleTierAcad: Academy 0-24 castle1, 25 castle2, 50 castle3, 75 castle4, 100+ castle5');
run('G.tech={academy:0}; G.playerXP=1e12;');
ok(/castle1/.test(run('playerCastleImg()')), 'Academy 0 shows castle1 even at a high player level');
run('G.tech={academy:100}; G.playerXP=0;');
ok(/castle5/.test(run('playerCastleImg()')), 'Academy 100 shows castle5 at player level 1');
{ const tw = html.slice(html.indexOf('function renderTech()'), html.indexOf('const rows=[13,38,62,87]'));
  const wm = html.slice(html.indexOf('const cities=worldCities(); const npcCastle'), html.indexOf('meEl.onclick'));
  ok(/ctier=castleTierAcad\(academyLevel\(\)\)/.test(tw) && /castleTierAcad\(academyLevel\(\)\)/.test(wm) && /c\.real && typeof c\.academy==='number'\) \? castleImgAcad\(c\.academy\) : npcCastle/.test(wm)
    && !/castleTier\(playerLevel\(\)\)/.test(html), 'the Academy centre, your world-map castle and real players\' castles use castleTierAcad; nothing reads castleTier(playerLevel())');
  ok(/academy:\(typeof c\.academy==='number'\?c\.academy:undefined\)/.test(html), 'fetchRealCities keeps the owner\'s academy level'); }

/* live: the server's city view carries each owner's academy level */
const cityHasAcad = (cities, id, lv) => cities.some(c => c.id === id && c.academy === lv);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-acad1099-')), dbFile = path.join(dir, 'db.json');
let child, port, base;
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start() { child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile }, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw Error('no start'); }
async function stop() { if (!child) return; child.kill(); for (let i = 0; i < 60 && child.exitCode === null; i++) await delay(50); child = null; }
async function call(tok, route, data) { const r = await fetch(base + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': tok }, body: data ? JSON.stringify(data) : undefined });
  let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, data: j }; }
(async () => { try {
  port = await freePort(); base = 'http://127.0.0.1:' + port; await start();
  const g = []; for (let i = 0; i < 3; i++) { const r = await call('', '/api/guest', { deviceId: 'acad1099-' + i + '-' + Date.now() }); g.push(r.data); await call(r.data.token, '/api/ledger'); }
  await stop();
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')), WL = require('../server/world-location.js');
  const [viewer, hi, lo] = g.map(x => db.users[x.profile.id]);
  const l1 = WL.place([]), l2 = WL.place([l1]);
  hi.worldLocation = l1; lo.worldLocation = l2;
  const acad = lv => ({ lv: { academy: lv, atk: 0, hp: 0, ap: 0, def: 0, armor: 0, mr: 0, crit: 0, critres: 0 }, learn: {}, res: { iron: 0, crystal: 0, silver: 0, coal: 0 }, mineDay: null });
  hi.led.acad = acad(100); lo.led.acad = acad(0);
  fs.writeFileSync(dbFile, JSON.stringify(db));
  await start();
  const r = await call(g[0].token, '/api/world/cities'), cities = (r.data && r.data.cities) || [];
  ok(r.status === 200 && cityHasAcad(cities, hi.id, 100) && cityHasAcad(cities, lo.id, 0),
    'live /api/world/cities: the owner at Academy 100 reads academy 100, the owner at Academy 0 reads 0 (' + cities.map(c => c.name + ':' + c.academy).join(', ') + ')');
  ok(!cityHasAcad(cities.map(c => { const o = Object.assign({}, c); delete o.academy; return o; }), hi.id, 100), 'control: a city view without the field fails the check');
  console.log('test_academy_flat_1098.js: ' + pass + ' checks passed');
} catch (e) { console.error('FAIL', e && e.message || e); process.exitCode = 1; } finally { await stop(); } })();
