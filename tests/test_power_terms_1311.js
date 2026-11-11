// v1311 (Phil 8 Nov 2026: "1. yes 2. yes"): (1) the purple FURY passive (quorrel Tireless, carn Unrelenting) is applied in server
// battles and counted in hero power; (2) Academy Crit Resist and Healing research count in hero power.
// 1. client heroPower == server heroCardPower for every hero at levels 1/20/56/100, with and without Academy crit resist + healing
//    research, rank 0 and rank 3 (Purple), passive level 1 and 100.
// 2. fury raises quorrel/carn power by sqrt(1+0.25*skillMul(lv)); other heroes unchanged; below rank 3 no fury.
// 3. crit resist / healing raise power by the formula; every hero without them prices byte-identical to live v1310.
// 4. server core: a quorrel unit at rank 3 has speed x(1+0.25*skillMul(lv)); the client fight unit gets the factor once.
// CONTROL: the live v1310 page / server.js / server/sim.js (git show 67ecbab6) - no fury on the core, no Academy terms on the card.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process'), Module = require('module');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const LIVE = '67ecbab6', show = f => Buffer.from(TICK1367(cp.execSync('git show ' + LIVE + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString('utf8')), 'utf8');
// v1367 (Phil 11 Nov "yes buff tick"): Tick's base damage 28 -> 34 on purpose - the live baseline is given the same Tick so every OTHER hero still compares byte for byte
function TICK1367(s){ return s.replace("stars:1,hp:360,dmg:28,", "stars:1,hp:360,dmg:34,").replace("tick:{swing:2.2,hp:360,dmg:28,", "tick:{swing:2.2,hp:360,dmg:34,").replace("name:'Mainspring',type:'punchflurry',hits:5,mul:0.28,", "name:'Mainspring',type:'punchflurry',hits:5,mul:0.36,"); }
const temps = [], dirs = [];
process.on('exit', () => { for (const f of temps) try { fs.unlinkSync(f); } catch (e) {} for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

/* ---- server.js in-process: the real file in a wrapper (no port, no timers, a throwaway world) ---- */
function loadServer(src) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-pw1311-')); dirs.push(tmp);
  process.env.DB_FILE = path.join(tmp, 'db.json'); process.env.PORT = '0';
  const http = require('http'), fakeHttp = Object.assign({}, http, { createServer: () => ({ listen() {}, on() {}, close() {}, address() { return { port: 0 }; } }) });
  const req = Module.createRequire(path.join(ROOT, 'server.js')), myReq = n => n === 'http' ? fakeHttp : req(n);
  const noop = () => ({ unref() {}, ref() {} });
  const log = console.log; console.log = () => {};
  try {
    const wrap = vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){' + src +
      '\n;return {heroCardPower,snapshotHeroFromServer,unitCardPower,ensureLedger,ledHeroLevel,ledSkillArr,acadCombat,D_HERO_CUM,D_TROOP_CUM,getDB:()=>DB};})', { filename: 'server.js' });
    const m = { exports: {} };
    return wrap(m.exports, myReq, m, path.join(ROOT, 'server.js'), ROOT, noop, noop);
  } finally { console.log = log; }
}
const SNEW = loadServer(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'));
const SOLD = loadServer(show('server.js').toString('utf8'));
const host = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const CNEW = host(path.join(ROOT, 'emberweave-heroes.html'));
const oldHtml = path.join(ROOT, '.test-1311-power-live.html'); temps.push(oldHtml); fs.writeFileSync(oldHtml, show('emberweave-heroes.html'));
const COLD = host(oldHtml);
const R = (h, c) => vm.runInContext(c, h.ctx);
const SIM = require('../server/sim.js');
const oldSimFile = path.join(ROOT, 'server', '.test-1311-power-sim-live.js'); temps.push(oldSimFile); fs.writeFileSync(oldSimFile, show('server/sim.js'));
const SIMOLD = require(oldSimFile);
const KEYS = Object.keys(SIM.HERO_BASE);
const skillMul = SIM.CORE.skillMul;

/* one hero state, set identically on both sides: level, stars, skills (passive = slot 3), glyph ascension index, Academy tracks */
let uid = 0;
const USERS = new Map();   // one account per (server, hero), re-set for every state (a fresh ledger each time is slow)
function serverUser(S, key, st) {
  const ck = S === SNEW ? 'n:' + key : 'o:' + key; let u = USERS.get(ck);
  if (!u) { u = { id: 'pw1311-' + (++uid), name: 'PW' + uid, guest: true, created: Date.now(), roster: {} }; S.getDB().users[u.id] = u; S.ensureLedger(u); USERS.set(ck, u); }
  const led = u.led;
  led.px = S.D_TROOP_CUM[100]; led.unlocked = led.unlocked || {}; led.unlocked[key] = true;
  led.hero[key] = { xp: S.D_HERO_CUM[st.level], stars: st.stars, pips: 0, ref: 0 };
  led.skill = led.skill || {}; led.skill[key] = [1, 1, 1, st.passive];
  led.acad = { lv: { academy: 0, atk: 0, hp: 0, ap: 0, heal: st.heal, armor: 0, mr: 0, crit: 0, critres: st.critres }, learn: {}, res: { iron: 0, crystal: 0, silver: 0, coal: 0 } };
  u.glyphs = { revision: 1, fragments: {}, subGlyphs: {}, finished: {}, boards: { [key]: { slots: [null, null, null, null, null, null], ascensionIndex: st.asc, ascended: {}, personalPathVersion: 1 } } };
  return u;
}
function clientSet(C, key, st) {
  R(C, 'G.playerXP=TROOP_CUM[100]; G.heroXP[' + JSON.stringify(key) + ']=HERO_CUM[' + st.level + ']; G.starLevel[' + JSON.stringify(key) + ']=' + st.stars +
    '; G.starPip=G.starPip||{}; G.starPip[' + JSON.stringify(key) + ']=0; G.starRefine=G.starRefine||{}; G.starRefine[' + JSON.stringify(key) + ']=0;' +
    'G.skillLevel=G.skillLevel||{}; G.skillLevel[' + JSON.stringify(key) + ']=[1,1,1,' + st.passive + ']; G.glyphRank=G.glyphRank||{}; G.glyphRank[' + JSON.stringify(key) + ']=' + st.asc +
    '; G.tech={heal:' + st.heal + ',critres:' + st.critres + '}; G.temple=undefined;');
}
const cPow = (C, key, st) => { clientSet(C, key, st); return R(C, 'heroPower(' + JSON.stringify(key) + ')'); };
/* the card's base term (POWER_K*sqrt(ehp*dps)) - the inner, unrounded, pre-glyph call minus the skill bonus */
const cBase = (C, key, st) => { clientSet(C, key, st); return R(C, '(()=>{ _powerNoGlyph=true; try{ return heroPower(' + JSON.stringify(key) + ')-skillPowerBonus(' + JSON.stringify(key) + '); } finally{ _powerNoGlyph=false; } })()'); };
const sPow = (S, key, st) => S.heroCardPower(serverUser(S, key, st), key);
const sUnit = (S, key, st) => S.snapshotHeroFromServer(serverUser(S, key, st), key);

console.log('== setup ==');
const furyKeys = JSON.parse(R(CNEW, 'JSON.stringify(Object.keys(KITS).filter(k=>HERO_TYPES[k]&&KITS[k].purple&&KITS[k].purple.pass==="fury").map(k=>[k,KITS[k].purple.pass]))'));
ck('server PURPLE_FURY = the client KITS fury passives (quorrel, carn at 0.25 - makeUnit 1+0.25*pm)',
  JSON.stringify(Object.keys(SIM.PURPLE_FURY).sort()) === JSON.stringify(furyKeys.map(x => x[0]).sort()) && Object.values(SIM.PURPLE_FURY).every(v => v === 0.25)
  && /else if\(p==='fury'\) u\.atkInterval\/=\(1\+0\.25\*pm\)/.test(fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8')), furyKeys);
ck('client SKILL_STEP = core SKILL_STEP', R(CNEW, 'SKILL_STEP') === SIM.CORE.SKILL_STEP);
ck('constants match on both sides (REF_ENEMY_CRIT 0.15, crit bonus 0.6, heal weights 1.0 / 0.25)',
  ['REF_ENEMY_CRIT', 'REF_CRIT_BONUS', 'HEAL_POWER_W_HEALER', 'HEAL_POWER_W_OTHER'].every(n => R(CNEW, n) === +((fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8').match(new RegExp(n + '=([0-9.]+)')) || [])[1]))
  && R(CNEW, 'REF_ENEMY_CRIT') === 0.15 && R(CNEW, 'REF_CRIT_BONUS') === 0.6 && R(CNEW, 'HEAL_POWER_W_HEALER') === 1 && R(CNEW, 'HEAL_POWER_W_OTHER') === 0.25);
{ const st = { level: 56, stars: 5, passive: 1, asc: 6, heal: 60, critres: 60 }, u = serverUser(SNEW, 'quorrel', st);
  ck('fixture levels agree (server ledHeroLevel = 56, client heroLevel = 56, client heroQuality = 3)', SNEW.ledHeroLevel(u.led, 'quorrel') === 56
    && (clientSet(CNEW, 'quorrel', st), R(CNEW, 'heroLevel("quorrel")') === 56 && R(CNEW, 'heroQuality("quorrel")') === 3)); }

const LEVELS = [1, 20, 56, 100];
const states = key => { const out = [], b = SIM.HERO_BASE[key].stars || 1;
  for (const level of LEVELS) for (const ac of [0, 60]) for (const asc of [0, 6]) for (const passive of [1, 100])
    out.push({ level, stars: level === 1 ? b : 5, passive, asc, heal: ac, critres: ac });
  return out; };

console.log('== 1. client card = server card ==');
{ const bad = []; let n = 0;
  for (const key of KEYS) for (const st of states(key)) { n++; const c = cPow(CNEW, key, st), s = sPow(SNEW, key, st); if (c !== s) bad.push([key, st, c, s]); }
  ck('client heroPower == server heroCardPower: ' + KEYS.length + ' heroes x ' + (n / KEYS.length) + ' states (' + n + ' cards)', bad.length === 0, bad.slice(0, 5)); }

console.log('== 2. fury ==');
for (const key of ['quorrel', 'carn']) for (const lv of [1, 100]) {
  const st = { level: 100, stars: 5, passive: lv, asc: 6, heal: 0, critres: 0 }, F = 1 + 0.25 * skillMul(lv);
  const rN = cBase(CNEW, key, st) / cBase(COLD, key, st);
  const sN = SNEW.unitCardPower(SNEW.snapshotHeroFromServer(serverUser(SNEW, key, st), key, null, { noGlyphStats: true, noTempleEffects: true }), key);
  const sO = SOLD.unitCardPower(SOLD.snapshotHeroFromServer(serverUser(SOLD, key, st), key, null, { noGlyphStats: true, noTempleEffects: true }), key);
  ck(key + ' L100 rank 3 passive ' + lv + ': card base term x sqrt(' + F.toFixed(4) + ') on client and server (' + cPow(COLD, key, st) + ' -> ' + cPow(CNEW, key, st) + ')',
    Math.abs(rN - Math.sqrt(F)) < 1e-9 && Math.abs(sN / sO - Math.sqrt(F)) < 1e-9, { client: rN, server: sN / sO, want: Math.sqrt(F) });
}
for (const key of ['quorrel', 'carn']) { const st = { level: 100, stars: 5, passive: 100, asc: 5, heal: 0, critres: 0 };   // ascension 5 = rank 2
  ck(key + ' below rank 3 (ascension 5): no fury - card equals live v1310', cPow(CNEW, key, st) === cPow(COLD, key, st) && sPow(SNEW, key, st) === sPow(SOLD, key, st)); }
{ const bad = []; for (const key of KEYS.filter(k => !SIM.PURPLE_FURY[k])) { const st = { level: 100, stars: 5, passive: 100, asc: 6, heal: 0, critres: 0 };
    if (cPow(CNEW, key, st) !== cPow(COLD, key, st) || sPow(SNEW, key, st) !== sPow(SOLD, key, st)) bad.push(key); }
  ck('every non-fury hero at rank 3 passive 100: card unchanged vs live v1310 on both sides', bad.length === 0, bad); }

console.log('== 3. Academy crit resist + healing ==');
{ const bad = []; let n = 0;
  for (const key of KEYS) for (const st of states(key)) { if (st.heal || (SIM.PURPLE_FURY[key] && st.asc >= 6)) continue; n++;
    const a = [cPow(CNEW, key, st), sPow(SNEW, key, st)], b = [cPow(COLD, key, st), sPow(SOLD, key, st)];
    if (a[0] !== b[0] || a[1] !== b[1]) bad.push([key, st, a, b]); }
  ck('no Academy crit resist / healing and no fury: ' + n + ' cards byte-identical to live v1310 (client and server)', bad.length === 0, bad.slice(0, 5)); }
const cr60 = R(CNEW, 'techFlat("critres",60)'), hl60 = R(CNEW, 'techFlat("heal",60)');
const EM = cr => { const f = Math.min(0.75, cr * 0.0005); return (1 + 0.15 * 0.6) / (1 + 0.15 * Math.max(0, 0.6 - f)); };
const HM = (h, key) => 1 + h * 0.0005 * (SIM.HERO_BASE[key].damageProfile === 'Healer' ? 1 : 0.25);
{ const bad = []; for (const key of KEYS) { const st = { level: 100, stars: 5, passive: 1, asc: 0, heal: 60, critres: 60 }, want = Math.sqrt(EM(cr60) * HM(hl60, key));
    const c = cBase(CNEW, key, st) / cBase(COLD, key, st); if (Math.abs(c - want) > 1e-9) bad.push([key, c, want]); }
  ck('Academy crit resist 60 + healing 60 (' + cr60 + ' / ' + hl60 + ' rating): every hero\'s card base term x sqrt(EHP mul x DPS mul)', bad.length === 0, bad.slice(0, 5)); }
{ const key = 'quorrel', st = { level: 100, stars: 5, passive: 1, asc: 0, heal: 0, critres: 60 };
  ck('crit resist alone: x sqrt(' + EM(cr60).toFixed(5) + ')', Math.abs(cBase(CNEW, key, st) / cBase(COLD, key, st) - Math.sqrt(EM(cr60))) < 1e-9); }
{ const key = 'mellan', st = { level: 100, stars: 5, passive: 1, asc: 0, heal: 60, critres: 0 };
  ck('healing alone on a Healer (mellan): x sqrt(' + HM(hl60, key).toFixed(4) + ') (' + cPow(COLD, key, st) + ' -> ' + cPow(CNEW, key, st) + ')',
    Math.abs(cBase(CNEW, key, st) / cBase(COLD, key, st) - Math.sqrt(HM(hl60, key))) < 1e-9); }
ck('crit resist pricing follows the fight rule: a 60% crit-resist fraction prices the full crit bonus away', Math.abs(EM(1200) - 1.09) < 1e-12);

console.log('== 4. server core battle unit ==');
for (const lv of [1, 50, 100]) { const F = 1 + 0.25 * skillMul(lv), st = { level: 100, stars: 5, passive: lv, asc: 6, heal: 0, critres: 0 };
  const n = sUnit(SNEW, 'quorrel', st), o = sUnit(SOLD, 'quorrel', st);
  ck('quorrel rank 3 passive ' + lv + ': core speed x' + F.toFixed(4) + ' (' + o.speed.toFixed(4) + ' -> ' + n.speed.toFixed(4) + ')', Math.abs(n.speed / o.speed - F) < 1e-12, [n.speed, o.speed]); }
{ const st = { level: 100, stars: 5, passive: 100, asc: 5, heal: 0, critres: 0 };
  ck('quorrel rank 2: core speed unchanged', sUnit(SNEW, 'quorrel', st).speed === sUnit(SOLD, 'quorrel', st).speed); }
{ const st = { level: 100, stars: 5, passive: 100, asc: 6, heal: 0, critres: 0 };
  ck('a non-fury hero (vael) at rank 3: core speed unchanged', sUnit(SNEW, 'vael', st).speed === sUnit(SOLD, 'vael', st).speed); }
{ const o = { level: 100, stars: 5, extra: { skillLv: [1, 1, 1, 100] } };
  const a = SIM.heroCombatStats('carn', Object.assign({ rank: 3 }, o)), b = SIMOLD.heroCombatStats('carn', Object.assign({ rank: 3 }, o)), c = SIM.heroCombatStats('carn', o);
  ck('heroCombatStats: carn rank 3 passive 100 x' + (1 + 0.25 * skillMul(100)).toFixed(4) + '; CONTROL live v1310 sim.js ignores rank; no rank = unchanged',
    Math.abs(a.speed / b.speed - (1 + 0.25 * skillMul(100))) < 1e-12 && c.speed === b.speed); }
{ /* the client real-time fight never builds units through combat-core: fury reaches its swing timer once, exactly as in v1310 */
  const spec = JSON.stringify({ key: 'quorrel', level: 100, stars: 5, pips: 0, ref: 0, glyphRank: 6, tt: {}, ex: {}, fAtk: 0, fHp: 0, fApow: 0, apMul: 1, skillLv: [1, 1, 1, 100] });
  const iv = C => R(C, 'makeUnit("quorrel","ally",100,100,100,{spec:' + spec + '}).atkInterval');
  const base = R(CNEW, 'swingInterval(HERO_TYPES.quorrel)');
  ck('client fight unit: quorrel swing timer / ' + (1 + 0.25 * skillMul(100)).toFixed(4) + ' once, identical to live v1310', iv(CNEW) === iv(COLD) && Math.abs(base / iv(CNEW) - (1 + 0.25 * skillMul(100))) < 1e-9, [iv(CNEW), iv(COLD), base]); }
{ /* the line battle itself: a fury quorrel at speed >= 1.1 takes two actions a round in the core resolver */
  const st = { level: 100, stars: 5, passive: 100, asc: 6, heal: 0, critres: 0 };
  const foe = () => SIM.makeLine([SIM.heroCombatStats('gruel', { level: 100, stars: 5 })], null);
  const acts = S => { const r = SIM.resolveLineBattle(SIM.makeLine([sUnit(S, 'quorrel', st)], null), foe(), 1311); return r.log.filter(e => e[1] === 'A' && e[2] === 'quorrel').length; };
  const aN = acts(SNEW), aO = acts(SOLD), q = sUnit(SNEW, 'quorrel', st).speed;
  ck('server line battle: quorrel speed ' + q.toFixed(3) + ' -> ' + aN + ' logged actions vs ' + aO + ' on live v1310', q >= 1.1 ? aN > aO : aN === aO, [aN, aO, q]); }

console.log('== measured ==');
for (const key of ['quorrel', 'carn']) { const st = { level: 100, stars: 5, passive: 100, asc: 16, heal: 0, critres: 0 };
  console.log('  ' + key + ' L100 5* Orange passive 100: ' + cPow(COLD, key, st) + ' -> ' + cPow(CNEW, key, st)); }
for (const key of ['mellan', 'vireo']) { const st = { level: 100, stars: 5, passive: 1, asc: 0, heal: 60, critres: 0 };
  console.log('  ' + key + ' (Healer) L100 5* Academy healing 60: ' + cPow(COLD, key, st) + ' -> ' + cPow(CNEW, key, st)); }
console.log('test_power_terms_1311.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
