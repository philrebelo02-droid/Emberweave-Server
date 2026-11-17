// v1316 (Phil 8 Nov 2026: "do everything you think is best"): crit resist, healing power and penetration from GEAR count in hero power,
// through the existing terms - gear crit resist + healing power ride the v1311 Academy terms (EHP / DPS multipliers, 20 points = 1%),
// gear penetration rides the Temple pen term of the card multiplier (+1% per 100 average penetration, cap shared with the Temple).
// Glyph stats of these kinds are NOT added: the card prices a glyph board as its TIER (v480 _powerNoGlyph / server noGlyphStats) for
// every stat, so a glyph's crit resist / healing / pen already count there (check 4 shows the card's stat total is gear only).
// 1. client heroPower == server heroCardPower for every hero at levels 1/56/100, Academy 0/60, seven gear loadouts.
// 2. each of the three stats from gear raises power by the formula, on both sides; CONTROL live c09b0412 ignores it.
// 3. a hero with none of the three (no gear, or gear without them) prices byte-identical to live c09b0412 on both sides.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process'), Module = require('module');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const LIVE = 'c09b0412', show = f => Buffer.from(TICK1367(cp.execSync('git show ' + LIVE + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString('utf8')), 'utf8');
// v1367 (Phil 11 Nov "yes buff tick"): Tick's base damage 28 -> 34 on purpose - the live baseline is given the same Tick so every OTHER hero still compares byte for byte
function TICK1367(s){ return s.replace("stars:1,hp:360,dmg:28,", "stars:1,hp:360,dmg:34,").replace("tick:{swing:2.2,hp:360,dmg:28,", "tick:{swing:2.2,hp:360,dmg:34,").replace("name:'Mainspring',type:'punchflurry',hits:5,mul:0.28,", "name:'Mainspring',type:'punchflurry',hits:5,mul:0.36,"); }
const temps = [], dirs = [];
process.on('exit', () => { for (const f of temps) try { fs.unlinkSync(f); } catch (e) {} for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

/* ---- server.js in-process: the real file in a wrapper (no port, no timers, a throwaway world) ---- */
function loadServer(src) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-pw1316-')); dirs.push(tmp);
  process.env.DB_FILE = path.join(tmp, 'db.json'); process.env.PORT = '0';
  const http = require('http'), fakeHttp = Object.assign({}, http, { createServer: () => ({ listen() {}, on() {}, prependListener() {}, close() {}, address() { return { port: 0 }; } }) });
  const req = Module.createRequire(path.join(ROOT, 'server.js')), myReq = n => n === 'http' ? fakeHttp : req(n);
  const noop = () => ({ unref() {}, ref() {} });
  const log = console.log; console.log = () => {};
  try {
    const wrap = vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){' + src +
      '\n;return {heroCardPower,snapshotHeroFromServer,unitCardPower,gearHeroFlats,ensureLedger,ledHeroLevel,D_HERO_CUM,D_TROOP_CUM,getDB:()=>DB};})', { filename: 'server.js' });
    const m = { exports: {} };
    return wrap(m.exports, myReq, m, path.join(ROOT, 'server.js'), ROOT, noop, noop);
  } finally { console.log = log; }
}
const SNEW = loadServer(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'));
const SOLD = loadServer(show('server.js').toString('utf8'));
const host = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const CNEW = host(path.join(ROOT, 'emberweave-heroes.html'));
/* v1369 (Phil 11 Nov 2026, star track approved): stars are FLAT stats now, not a multiplier. The live baseline is given the same flat star
   track (tests/helpers/star-track-1369.js, numbers from server/sim.js), so every check below still isolates its own term; the in-process
   live server already prices with this build's server/sim.js (it requires the worktree's sim). COLD_RAW = the untouched live page (CONTROL). */
const STAR1369 = require('./helpers/star-track-1369.js');
const oldHtml = path.join(ROOT, '.test-1316-power-live.html'); temps.push(oldHtml); fs.writeFileSync(oldHtml, STAR1369.starTrackPage(show('emberweave-heroes.html').toString('utf8')));
const COLD = host(oldHtml);
const rawHtml = path.join(ROOT, '.test-1316-power-live-raw.html'); temps.push(rawHtml); fs.writeFileSync(rawHtml, show('emberweave-heroes.html'));
const COLD_RAW = host(rawHtml);
const R = (h, c) => vm.runInContext(c, h.ctx);
const SIM = require('../server/sim.js');
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'gear-catalog.json'), 'utf8'));
const KEYS = Object.keys(SIM.HERO_BASE);
for (const C of [CNEW, COLD, COLD_RAW]) R(C, 'FORGE.cat=' + JSON.stringify({ items: CAT.items }) + ';');

/* gear loadouts (slot -> catalog id); every item at TEMPER, resonance rank from the catalog thresholds (= server gearResonanceRank) */
const THREE = ['critRes', 'healPow', 'armorPen', 'magicPen'];
const byId = Object.fromEntries(CAT.items.map(d => [d.id, d]));
const CONTROL = {}; for (const d of CAT.items) if (!CONTROL[d.slot] && !THREE.some(k => d.stats[k])) CONTROL[d.slot] = d.id;
const SETS = {
  none: {},
  control: CONTROL,   // a full nine-slot loadout carrying none of the three stats
  critRes: { Helm: 'E11' },
  heal: { Weapon: 'E08', Helm: 'E16', Armor: 'E34', Gloves: 'E43', Belt: 'E52', Ring: 'E62', Amulet: 'E72', Relic: 'E83' },
  armorPen: { Gloves: 'E40', Belt: 'E49', Ring: 'E59', Relic: 'E79' },
  magicPen: { Armor: 'E33', Gloves: 'E41', Belt: 'E51', Ring: 'E61', Relic: 'E81' },
  mixed: { Weapon: 'E08', Helm: 'E11', Armor: 'E33', Gloves: 'E40', Belt: 'E52', Ring: 'E59', Amulet: 'E72', Relic: 'E83' },
};
const TEMPER = 10;
const resRank = set => { const total = Object.keys(set).length * TEMPER; let r = 0; CAT.meta.resonance.thresholds.forEach((t, i) => { if (total >= t) r = i + 1; }); return r; };

let uid = 0;
const USERS = new Map();
function serverUser(S, key, st) {
  const k = (S === SNEW ? 'n:' : 'o:') + key; let u = USERS.get(k);
  if (!u) { u = { id: 'pw1316-' + (++uid), name: 'PG' + uid, guest: true, created: Date.now(), roster: {} }; S.getDB().users[u.id] = u; S.ensureLedger(u); USERS.set(k, u); }
  const led = u.led, set = SETS[st.gear];
  led.px = S.D_TROOP_CUM[100]; led.unlocked = led.unlocked || {}; led.unlocked[key] = true;
  led.hero[key] = { xp: S.D_HERO_CUM[st.level], stars: st.stars, pips: 0, ref: 0 };
  led.skill = led.skill || {}; led.skill[key] = [1, 1, 1, 1];
  led.acad = { lv: { academy: 0, atk: 0, hp: 0, ap: 0, heal: st.ac, armor: 0, mr: 0, crit: 0, critres: st.ac }, learn: {}, res: { iron: 0, crystal: 0, silver: 0, coal: 0 } };
  u.glyphs = { revision: 1, fragments: {}, subGlyphs: {}, finished: {}, boards: { [key]: { slots: [null, null, null, null, null, null], ascensionIndex: 0, ascended: {}, personalPathVersion: 1 } } };
  const items = {}, eq = {}; for (const slot in set) { const id = 'g' + slot; items[id] = { d: set[slot], temper: TEMPER, prog: 0 }; eq[slot] = id; }
  u.gear = { items, equipped: { [key]: eq }, active: {} };
  return u;
}
function clientSet(C, key, st) {
  const set = SETS[st.gear], items = {}, eq = {}; for (const slot in set) { const id = 'g' + slot; items[id] = { d: set[slot], temper: TEMPER }; eq[slot] = id; }
  const K = JSON.stringify(key);
  R(C, 'G.playerXP=TROOP_CUM[100]; G.heroXP[' + K + ']=HERO_CUM[' + st.level + ']; G.starLevel[' + K + ']=' + st.stars +
    '; G.starPip=G.starPip||{}; G.starPip[' + K + ']=0; G.starRefine=G.starRefine||{}; G.starRefine[' + K + ']=0;' +
    'G.skillLevel=G.skillLevel||{}; G.skillLevel[' + K + ']=[1,1,1,1]; G.glyphRank=G.glyphRank||{}; G.glyphRank[' + K + ']=0' +
    '; G.tech={heal:' + st.ac + ',critres:' + st.ac + '}; G.temple=undefined;' +
    'FORGE.st={enabled:true, items:' + JSON.stringify(items) + ', equipped:{' + K + ':' + JSON.stringify(eq) + '}, resonance:{rank:' + resRank(set) + '}};');
}
const cPow = (C, key, st) => { clientSet(C, key, st); return R(C, 'heroPower(' + JSON.stringify(key) + ')'); };
const cBase = (C, key, st) => { clientSet(C, key, st); return R(C, '(()=>{ _powerNoGlyph=true; try{ return heroPower(' + JSON.stringify(key) + ')-skillPowerBonus(' + JSON.stringify(key) + '); } finally{ _powerNoGlyph=false; } })()'); };
const sPow = (S, key, st) => S.heroCardPower(serverUser(S, key, st), key);
const cGear = (C, key, st) => { clientSet(C, key, st); return JSON.parse(R(C, 'JSON.stringify(gearSockMul(' + JSON.stringify(key) + '))')); };

console.log('== setup ==');
{ const st = { level: 100, stars: 5, ac: 0, gear: 'mixed' }, g = cGear(CNEW, 'vael', st), s = SNEW.gearHeroFlats(serverUser(SNEW, 'vael', st), 'vael');
  ck('client gearSockMul == server gearHeroFlats on the three stats (mixed loadout: ' + THREE.map(k => k + ' ' + g[k]).join(', ') + ')',
    THREE.every(k => g[k] === s[k]) && THREE.every(k => g[k] > 0), { client: g, server: s }); }
ck('control loadout fills ' + Object.keys(CONTROL).length + ' slots and carries none of the three stats', Object.keys(CONTROL).length === 9 && Object.values(CONTROL).every(id => !THREE.some(k => byId[id].stats[k])));

const LEVELS = [1, 56, 100];
const states = key => { const out = [], b = SIM.HERO_BASE[key].stars || 1;
  for (const level of LEVELS) for (const ac of [0, 60]) for (const gear of Object.keys(SETS)) out.push({ level, stars: level === 1 ? b : 5, ac, gear });
  return out; };

console.log('== 0. star track baseline (v1369) ==');
{ const st = { level: 100, stars: 5, passive: 1, asc: 0, heal: 0, critres: 0, ac: 0, gear: 'none' }, c = cPow(CNEW, 'vael', st), o = cPow(COLD, 'vael', st), r = cPow(COLD_RAW, 'vael', st);
  ck('CONTROL: the untouched live page prices a 5-star hero differently (star multiplier 1.9x, no flats): ' + r + ' vs this build ' + c, r !== c && R(COLD_RAW, 'starMultFrom(5,0,0)') === 1.9);
  ck('the baseline carries this build flat star track: starMult = 1 and the same 5-star flats (' + o + ')', R(COLD, 'starMultFrom(5,0,0)') === 1 && R(COLD, 'JSON.stringify(starFlat1369("vael"))') === R(CNEW, 'JSON.stringify(starFlat("vael"))')); }
console.log('== 1. client card = server card ==');
const CACHE = new Map();   // key|state -> [cNew, sNew, cOld, sOld]
const all = (key, st) => { const k = key + '|' + JSON.stringify(st); if (!CACHE.has(k)) CACHE.set(k, [cPow(CNEW, key, st), sPow(SNEW, key, st), cPow(COLD, key, st), sPow(SOLD, key, st)]); return CACHE.get(k); };
{ const bad = []; let n = 0;
  for (const key of KEYS) for (const st of states(key)) { n++; const [c, s] = all(key, st); if (c !== s) bad.push([key, st, c, s]); }
  ck('client heroPower == server heroCardPower: ' + KEYS.length + ' heroes x ' + (n / KEYS.length) + ' states (' + n + ' cards)', bad.length === 0, bad.slice(0, 5)); }
{ const bad = []; for (const key of KEYS) for (const st of states(key)) { const [, , c, s] = all(key, st); if (c !== s) bad.push([key, st, c, s]); }
  ck('CONTROL: live c09b0412 client == server on the same fixtures (the fixtures themselves agree)', bad.length === 0, bad.slice(0, 5)); }

console.log('== 2. each stat from gear raises power ==');
const EM = cr => { const f = Math.min(0.75, cr * 0.0005); return (1 + 0.15 * 0.6) / (1 + 0.15 * Math.max(0, 0.6 - f)); };
const HM = (h, key) => 1 + h * 0.0005 * (SIM.HERO_BASE[key].damageProfile === 'Healer' ? 1 : 0.25);
for (const [gear, label] of [['critRes', 'crit resist'], ['heal', 'healing power'], ['armorPen', 'armor penetration'], ['magicPen', 'magic penetration'], ['mixed', 'all three']]) {
  const bad = []; let n = 0;
  for (const key of KEYS) for (const st of states(key).filter(s => s.gear === gear)) { n++; const [cN, sN, cO, sO] = all(key, st);
    const up = st.level >= 56 ? (cN > cO && sN > sO) : (cN >= cO && sN >= sO); if (!up) bad.push([key, st, cN, cO, sN, sO]); }   // level 1: 14 crit resist can round away
  ck('gear ' + label + ': every hero at L56/L100 x Academy reads higher than live with the same gear (L1 never lower), client and server (' + n + ' cards)', bad.length === 0, bad.slice(0, 5));
}
{ const bad = []; for (const key of KEYS) for (const level of LEVELS) { const st = { level, stars: level === 1 ? (SIM.HERO_BASE[key].stars || 1) : 5, ac: 0 };
    const a = all(key, Object.assign({ gear: 'critRes' }, st)), b = all(key, Object.assign({ gear: 'none' }, st)); if (a[2] !== b[2] || a[3] !== b[3]) bad.push([key, level, a, b]); }
  ck('CONTROL: on live c09b0412 a crit-resist-only Helm (E11) prices exactly as no gear at all, client and server - the old card ignored it', bad.length === 0, bad.slice(0, 5)); }
{ const bad = []; for (const key of KEYS) for (const ac of [0, 60]) { const st = { level: 100, stars: 5, ac, gear: 'critRes' };
    const g = cGear(CNEW, key, st).critRes, acr = R(CNEW, 'techFlat("critres",' + ac + ')'), want = Math.sqrt(EM(acr + g) / EM(acr));
    const r = cBase(CNEW, key, st) / cBase(COLD, key, st); if (Math.abs(r - want) > 1e-9) bad.push([key, ac, r, want]); }
  ck('gear crit resist: card base term x sqrt(EM(Academy+gear)/EM(Academy)) for every hero, Academy 0 and 60', bad.length === 0, bad.slice(0, 5)); }
{ const bad = []; for (const key of KEYS) for (const ac of [0, 60]) { const st = { level: 100, stars: 5, ac, gear: 'heal' };
    const g = cGear(CNEW, key, st).healPow, ah = R(CNEW, 'techFlat("heal",' + ac + ')'), want = Math.sqrt(HM(ah + g, key) / HM(ah, key));
    const r = cBase(CNEW, key, st) / cBase(COLD, key, st); if (Math.abs(r - want) > 1e-9) bad.push([key, ac, r, want]); }
  ck('gear healing power: card base term x sqrt(HM(Academy+gear)/HM(Academy)) for every hero (Healer weight 1.0, others 0.25)', bad.length === 0, bad.slice(0, 5)); }
for (const gear of ['armorPen', 'magicPen']) { const bad = [];
  for (const key of KEYS) { const st = { level: 100, stars: 5, ac: 0, gear }, g = cGear(CNEW, key, st), mul = 1 + Math.min(0.5, ((g.armorPen || 0) + (g.magicPen || 0)) / 2 * 0.0001);
    clientSet(COLD, key, st); const raw = R(COLD, '(()=>{ _powerNoGlyph=true; try{ return heroPower(' + JSON.stringify(key) + ')+glyphPowerFor(' + JSON.stringify(key) + '); } finally{ _powerNoGlyph=false; } })()');
    const [cN, sN] = all(key, st); if (cN !== Math.round(raw * mul) || sN !== cN) bad.push([key, cN, sN, Math.round(raw * mul)]); }
  ck('gear ' + gear + ': card = round(live unrounded card x (1 + average pen x 0.0001)) - the Temple pen rule - for every hero', bad.length === 0, bad.slice(0, 5)); }

console.log('== 3. none of the three: unchanged ==');
{ const bad = []; let n = 0;
  for (const key of KEYS) for (const st of states(key).filter(s => s.gear === 'none' || s.gear === 'control')) { n++; const [cN, sN, cO, sO] = all(key, st);
    if (cN !== cO || sN !== sO) bad.push([key, st, cN, cO, sN, sO]); }
  ck('no gear, or a nine-slot loadout without the three stats: ' + n + ' cards byte-identical to live c09b0412 (client and server)', bad.length === 0, bad.slice(0, 5)); }

console.log('== 4. glyphs count as their tier ==');
{ const st = { level: 100, stars: 5, ac: 0, gear: 'mixed' }; clientSet(CNEW, 'vael', st);
  ck('inside the card (_powerNoGlyph) the stat total is the gear total - glyph stats are priced by the tier curve, so none are added',
    R(CNEW, '(()=>{ _powerNoGlyph=true; try{ return JSON.stringify(sockStatTotal("vael"))===JSON.stringify(gearSockMul("vael")); } finally{ _powerNoGlyph=false; } })()') === true);
  ck('server card snapshot is built with noGlyphStats (same rule)', /unitCardPower\(snapshotHeroFromServer\(u,key,null,\{noGlyphStats:true,noTempleEffects:true\}\),key,PC\)/.test(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'))); }

console.log('== measured (L100 5*, Academy 0) ==');
const MEAS = [['mellan', 'heal'], ['vireo', 'heal'], ['vael', 'heal'], ['vael', 'critRes'], ['gruel', 'critRes'], ['vex', 'armorPen'], ['sylthaine', 'armorPen'], ['sylthaine', 'magicPen'], ['vex', 'mixed'], ['mellan', 'mixed']];
for (const [key, gear] of MEAS) { if (!SIM.HERO_BASE[key]) continue; const st = { level: 100, stars: 5, ac: 0, gear }, [cN, , cO] = all(key, st);
  console.log('  ' + key + ' (' + SIM.HERO_BASE[key].role + (SIM.HERO_BASE[key].damageProfile === 'Healer' ? ', Healer' : '') + ') ' + gear + ': ' + cO + ' -> ' + cN + ' (+' + ((cN / cO - 1) * 100).toFixed(2) + '%)'); }
console.log('test_power_gear_terms_1316.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
