// v1369 HERO STAR TRACK (Phil 11 Nov 2026): "the first 5 bronze is 100%, after 5 star the 6th Star unlocks, you can get the bronze 6th star" /
// "i mean 30% to 50%" / "after that you can change all the stars to silver, but it takes 6 total pips" / "then again 6 pips of gold" /
// "then again 6 total pips for mythical"; chances "50, 35, 20, 10"; costs "50,70,90,110"; "make sure the stats they gain is flat, not
// percentage" / "should be pretty much Attack damage, Ability power, health" / "All flat damage".
//  1. the table: client STAR_FLAT / REFINE_TIERS (steps, cost, chance, done) == server/sim.js; REFINE_MAX 16; average fragments per stage.
//  2. the display: refineStarTiers (five stars; a stage recolours the outer stars left to right and the large middle star last; large from step 1), next stage / step for every step 0..16.
//  3. the flat curve: client starFlatFrom == server starFlatFrom for every star / pip / step; rising; the stage totals; no multiplier left.
//  4. ONE POWER: client heroPower == server heroCardPower for all 61 heroes at 3 levels x 7 star states.
//  5. migration: old refine 0-15 -> the new step (every value), once (led.refTrack), a legacy browser save converted, a new ledger marked.
//  6. the route: the step's cost and the SERVER's roll (HMAC srvRoll < chance) at every stage, 0 -> 16 walked, retries are receipts,
//     16 answers "Fully refined." and spends nothing.
//  7. report: before/after card power (live v1368 vs this build) for 5 heroes at levels 20/60/100, and for old refine 5/10/15 -> migrated.
// CONTROL: the live page / sim (BASE) still multiplies (5 stars = 1.90x) - the flat checks must tell them apart.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process'), net = require('net'), crypto = require('crypto'), Module = require('module');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x).slice(0, 600) : '')); } };
const BASE = '5285debc';   // v1368, the build this track is cut from
const show = f => cp.execSync('git show ' + BASE + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString('utf8');
const temps = [], dirs = [];
process.on('exit', () => { for (const f of temps) try { fs.unlinkSync(f); } catch (e) {} for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

function loadServer(src, extra) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-ref1369-')); dirs.push(tmp);
  process.env.DB_FILE = path.join(tmp, 'db.json'); process.env.PORT = '0';
  const http = require('http'), fakeHttp = Object.assign({}, http, { createServer: () => ({ listen() {}, on() {}, prependListener() {}, close() {}, address() { return { port: 0 }; } }) });
  const req = Module.createRequire(path.join(ROOT, 'server.js')), myReq = n => n === 'http' ? fakeHttp : req(n);
  const noop = () => ({ unref() {}, ref() {} });
  const log = console.log; console.log = () => {};
  try {
    const wrap = vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){' + src +
      '\n;return {heroCardPower,ensureLedger,campaignHeroSpec,D_HERO_CUM,D_TROOP_CUM,getDB:()=>DB' + (extra || '') + '};})', { filename: 'server.js' });
    const m = { exports: {} };
    return wrap(m.exports, myReq, m, path.join(ROOT, 'server.js'), ROOT, noop, noop);
  } finally { console.log = log; }
}
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

(async () => {
const SIM = require('../server/sim.js');
const host = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const CNEW = host(path.join(ROOT, 'emberweave-heroes.html'));
const oldHtml = path.join(ROOT, '.test-1369-live.html'); temps.push(oldHtml); fs.writeFileSync(oldHtml, show('emberweave-heroes.html'));
const COLD = host(oldHtml);
const R = (h, c) => vm.runInContext(c, h.ctx);
const J = (h, c) => JSON.parse(R(h, 'JSON.stringify(' + c + ')'));
const KEYS = Object.keys(SIM.HERO_BASE);
const ORDER = ['bronze', 'silver', 'gold', 'mythical'];

console.log('== 1. table ==');
const ct = J(CNEW, 'REFINE_ORDER.map(k=>({tier:k,steps:REFINE_TIERS[k].steps,cost:REFINE_TIERS[k].cost,chance:REFINE_TIERS[k].chance,done:REFINE_TIERS[k].done,name:REFINE_TIERS[k].name}))');
ck('REFINE_MAX 16 on both sides; stages start at steps 0 / 1 / 6 / 11', R(CNEW, 'REFINE_MAX') === 16 && SIM.REFINE_MAX === 16 && JSON.stringify(J(CNEW, 'REFINE_START')) === '[0,1,6,11]' && JSON.stringify(SIM.REFINE_START) === '[0,1,6,11]');
ck('client stages == server stages (tier, steps, cost, chance, flat totals)', JSON.stringify(ct.map(t => [t.tier, t.steps, t.cost, t.chance, t.done])) === JSON.stringify(SIM.REFINE_TIERS.map(t => [t.tier, t.steps, t.cost, t.chance, t.done])), [ct, SIM.REFINE_TIERS]);
ck('client STAR_FLAT == server STAR_FLAT', JSON.stringify(J(CNEW, 'STAR_FLAT')) === JSON.stringify(SIM.STAR_FLAT));
ck('Phil\'s numbers: bronze 6th star 1 step 50 / 50%, silver 5 x 70 / 35%, gold 5 x 90 / 20%, mythical 5 x 110 / 10%',
  JSON.stringify(ct.map(t => [t.steps, t.cost, t.chance])) === JSON.stringify([[1, 50, 0.50], [5, 70, 0.35], [5, 90, 0.20], [5, 110, 0.10]]));
ck('names Bronze / Silver / Gold / Mythical', JSON.stringify(ct.map(t => t.name)) === JSON.stringify(['Bronze', 'Silver', 'Gold', 'Mythical']));
{ const avg = SIM.REFINE_TIERS.map(t => Math.round(t.steps * t.cost / t.chance));
  ck('average fragments per stage: ' + avg.join(' / ') + ' (100 / 1000 / 2250 / 5500)', JSON.stringify(avg) === '[100,1000,2250,5500]'); }

console.log('== 2. display ==');
{ const got = J(CNEW, '[0,1,2,4,6,9,11,14,16].map(l=>refineStarTiers(l))'), B = 'bronze', S = 'silver', G = 'gold', M = 'mythical';
  const exp = [[B, B, B, B, B], [B, B, B, B, B], [S, B, B, B, B], [S, S, B, S, B], [S, S, S, S, S], [G, G, S, G, S], [G, G, G, G, G], [M, M, G, M, G], [M, M, M, M, M]];
  ck('always five stars; pips 1-4 of a stage recolour stars 1, 2, 4, 5, pip 5 the big middle star last ("the big star always gets raised last"; steps 0/1/2/4/6/9/11/14/16)', JSON.stringify(got) === JSON.stringify(exp), got); }
{ const rows = J(CNEW, '[0,1,4,16].map(r=>{ G.starLevel.konwu=5; G.starPip=G.starPip||{}; G.starPip.konwu=0; G.starRefine=G.starRefine||{}; G.starRefine.konwu=r; const h=starFillRow("konwu",20); return [(h.match(/<svg/g)||[]).length, (h.match(/class="hs-big"/g)||[]).length, h.indexOf(String.fromCharCode(119,105,100,116,104,61,34,50,55,34))>=0]; })');
  ck('the row is 5 stars at steps 0/1/4/16; the middle star is large (27 px vs 20, 1.35x) from step 1, never at step 0 (' + rows.map(r => r[0] + '/' + r[1]).join(', ') + ')',
    rows.every(r => r[0] === 5) && rows[0][1] === 0 && rows.slice(1).every(r => r[1] === 1 && r[2] === true), rows); }
{ const got = J(CNEW, '[...Array(17).keys()].map(l=>[refineNextTier(l),refineStepInfo(l).step,refineStepInfo(l).of])');
  const exp = [...Array(17).keys()].map(l => l >= 16 ? [null, 5, 5] : l < 1 ? ['bronze', 0, 1] : l < 6 ? ['silver', l - 1, 5] : l < 11 ? ['gold', l - 6, 5] : ['mythical', l - 11, 5]);
  ck('next stage and step for every step 0..16', JSON.stringify(got) === JSON.stringify(exp), got);
  const srv = [...Array(17).keys()].map(l => { const t = SIM.refineTierAt(l); return t ? t.tier : null; });
  ck('server refineTierAt == client refineNextTier', JSON.stringify(srv) === JSON.stringify(exp.map(e => e[0]))); }
{ const urls = J(CNEW, 'Object.keys(HERO_STAR_ART).map(t=>heroStarUrl(t))'), art = 'C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/UI/Hero Stars 11NOV2026';
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const bad = urls.filter(u => { const f = path.join(ROOT, u.split('?')[0]); if (!fs.existsSync(f) || !/\?v=1369$/.test(u)) return true;
    const a = path.join(art, path.basename(f)); return fs.existsSync(art) && (!fs.existsSync(a) || sha(a) !== sha(f)); });
  ck('the five star images exist in assets with ?v=1369 and byte-match Game Art/UI/Hero Stars 11NOV2026', bad.length === 0, bad); }

console.log('== 3. flat curve ==');
{ const states = []; for (let lv = 1; lv <= 5; lv++) for (let p = 0; p <= (lv < 5 ? 5 : 0); p++) states.push([lv, p, 0]); for (let r = 1; r <= 16; r++) states.push([5, 0, r]);
  const c = J(CNEW, JSON.stringify(states) + '.map(s=>starFlatFrom(s[0],s[1],s[2]))'), s = states.map(x => SIM.starFlatFrom(x[0], x[1], x[2]));
  ck('client starFlatFrom == server starFlatFrom at ' + states.length + ' star / pip / step states', JSON.stringify(c) === JSON.stringify(s));
  ck('never falls along the path (1★ pips -> 5★ -> step 16)', s.every((v, i) => i === 0 || (v.hp >= s[i - 1].hp && v.atk >= s[i - 1].atk && v.apow >= s[i - 1].apow)));
  const at = (lv, p, r) => JSON.stringify(SIM.starFlatFrom(lv, p, r));
  const F = (h, a) => JSON.stringify({ hp: h, atk: a, apow: a, armor: a, mr: a });
  ck('Phil totals ("lets go 1000, 1500, 2500, 3500, 5000" then "increase the power slightly" +20%): 1★ 240/24 ... 5★ 1200/120, bronze 6th 1800/180, silver 3000, gold 4200, mythical 6000/600 (armor and MR follow attack: "yes add it")',
    at(1, 0, 0) === F(240, 24) && at(2, 0, 0) === F(480, 48) && at(3, 0, 0) === F(720, 72) && at(4, 0, 0) === F(960, 96) && at(5, 0, 0) === F(1200, 120)
    && at(5, 0, 1) === F(1800, 180) && at(5, 0, 6) === F(3000, 300) && at(5, 0, 11) === F(4200, 420) && at(5, 0, 16) === F(6000, 600));
  ck('linear inside a stage (1★ + 3 pips = 384 hp; silver step 4 = 2520 hp; mythical step 13 = 4920 hp)', SIM.starFlatFrom(1, 3, 0).hp === 384 && SIM.starFlatFrom(5, 0, 4).hp === 2520 && SIM.starFlatFrom(5, 0, 13).hp === 4920);
  ck('no multiplier: client starMult / starMultFrom = 1 for every state', J(CNEW, JSON.stringify(states) + '.every(s=>starMultFrom(s[0],s[1],s[2])===1)') === true);
  ck('CONTROL: the live page multiplies (starMultFrom(5,0,0) = 1.9)', J(COLD, 'starMultFrom(5,0,0)') === 1.9); }
{ const a = SIM.heroCombatStats('vael', { level: 60, stars: 5, ref: 16 }), b = SIM.heroCombatStats('vael', { level: 60, stars: 1, ref: 0 });
  ck('server unit: 1★ -> 5★ + step 16 adds exactly +5760 HP, +576 attack, +576 armor, +576 MR (' + b.maxHp + ' -> ' + a.maxHp + ')', a.maxHp - b.maxHp === 5760 && a.atkP - b.atkP === 576 && Math.abs(a.armor - b.armor - 576) < 1e-9 && Math.abs(a.mr - b.mr - 576) < 1e-9, [a.maxHp, b.maxHp, a.atkP, b.atkP]); }

console.log('== 4. ONE POWER ==');
const SNEW = loadServer(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), ',ledRefTrack');
let uid = 0; const USERS = new Map();
function sUser(S, key, st) { const k = (S === SNEW ? 'n:' : 'o:') + key; let u = USERS.get(k);
  if (!u) { u = { id: 'rf1369-' + (++uid), name: 'RF' + uid, guest: true, created: Date.now(), roster: {} }; S.getDB().users[u.id] = u; S.ensureLedger(u); USERS.set(k, u); }
  u.led.px = S.D_TROOP_CUM[100]; u.led.unlocked[key] = true; u.led.hero[key] = { xp: S.D_HERO_CUM[st.level], stars: st.stars, pips: st.pips, ref: st.ref };
  u.led.skill = u.led.skill || {}; u.led.skill[key] = [1, 1, 1, 1]; return u; }
function cPow(C, key, st) { const K = JSON.stringify(key);
  R(C, 'G.playerXP=TROOP_CUM[100]; G.heroXP[' + K + ']=HERO_CUM[' + st.level + ']; G.starLevel[' + K + ']=' + st.stars + '; G.starPip=G.starPip||{}; G.starPip[' + K + ']=' + st.pips + '; G.starRefine=G.starRefine||{}; G.starRefine[' + K + ']=' + st.ref +
    '; G.skillLevel=G.skillLevel||{}; G.skillLevel[' + K + ']=[1,1,1,1]; G.glyphRank=G.glyphRank||{}; G.glyphRank[' + K + ']=0; G.tech={}; G.temple=undefined;');
  return R(C, 'heroPower(' + K + ')'); }
const sPow = (S, key, st) => S.heroCardPower(sUser(S, key, st), key);
const STATES = key => { const b = SIM.HERO_BASE[key].stars || 1, out = [];
  for (const level of [20, 60, 100]) for (const [stars, pips, ref] of [[b, 2, 0], [5, 0, 0], [5, 0, 1], [5, 0, 4], [5, 0, 9], [5, 0, 11], [5, 0, 16]]) out.push({ level, stars, pips, ref });
  return out; };
{ const bad = []; let n = 0;
  for (const key of KEYS) for (const st of STATES(key)) { n++; const c = cPow(CNEW, key, st), s = sPow(SNEW, key, st); if (c !== s) bad.push([key, st, c, s]); }
  ck('client heroPower == server heroCardPower: ' + KEYS.length + ' heroes x ' + (n / KEYS.length) + ' states (' + n + ' cards)', bad.length === 0, bad.slice(0, 4)); }
{ const bad = []; for (const key of KEYS) { const p = [0, 1, 4, 9, 11, 16].map(r => cPow(CNEW, key, { level: 60, stars: 5, pips: 0, ref: r })); if (!p.every((v, i) => i === 0 || v > p[i - 1])) bad.push([key, p]); }
  ck('card power rises with every stage for every hero (level 60, steps 0/1/4/9/11/16)', bad.length === 0, bad.slice(0, 3)); }
{ const key = 'vael', st = { level: 60, stars: 5, pips: 0, ref: 10 }, u = sUser(SNEW, key, st), sp = SNEW.campaignHeroSpec(u, key), SF = SIM.starFlatFrom(5, 0, 10);
  ck('the frozen fight spec carries the star flats (fHp / fAtk / fApow include +' + SF.hp + ' / +' + SF.atk + ' / +' + SF.apow + ')', sp.fHp >= SF.hp && sp.fAtk >= SF.atk && sp.fApow >= SF.apow && sp.ref === 10, [sp.fHp, sp.fAtk, sp.fApow]); }

{ const bad = []; for (const key of ['vael', 'konwu', 'quorrel', 'mellan', 'tick', 'yenna']) for (const ref of [0, 4, 16]) { const st = { level: 60, stars: 5, pips: 0, ref };
    const u = sUser(SNEW, key, st), spec = SNEW.campaignHeroSpec(u, key); cPow(CNEW, key, st);
    const c = J(CNEW, '(()=>{ const a=makeUnit(' + JSON.stringify(key) + ',"ally",0,0,null,{owned:true}), b=makeUnit(' + JSON.stringify(key) + ',"ally",0,0,null,{spec:' + JSON.stringify(spec) + '}); return [Math.round(a.maxHp),Math.round(a.dmg),a.apow,Math.round(a.armorRating),Math.round(a.mrRating),Math.round(b.maxHp),Math.round(b.dmg),b.apow,Math.round(b.armorRating),Math.round(b.mrRating)]; })()');
    if ([0, 1, 2, 3, 4].some(i => c[i] !== c[i + 5])) bad.push([key, ref, c]); }
  ck('fight units: the client own hero == the hero built from the server frozen spec (HP, attack, ability power, armor, MR; 6 heroes x steps 0/4/16)', bad.length === 0, bad.slice(0, 4)); }

console.log('== 5. migration ==');
{ const exp = [0, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], got = [...Array(16).keys()].map(r => SIM.refineFromOld(r));
  ck('old 0-15 -> ' + got.join(',') + ' (0->0, 1-5->1, 6-10->1+(r-5), 11-15->6+(r-10))', JSON.stringify(got) === JSON.stringify(exp));
  ck('tier kept: old 5 = bronze 6th star (1), old 10 = silver done (6), old 15 = gold done (11)', got[5] === 1 && got[10] === 6 && got[15] === 11);
  const led = { migratedAt: 1, hero: {} }; [...Array(16).keys()].forEach(r => led.hero['h' + r] = { xp: 0, stars: 5, pips: 0, ref: r }); led.hero.nf = { xp: 0, stars: 2, pips: 0 };
  const first = SNEW.ledRefTrack(led), after1 = [...Array(16).keys()].map(r => led.hero['h' + r].ref);
  const second = SNEW.ledRefTrack(led), after2 = [...Array(16).keys()].map(r => led.hero['h' + r].ref);
  ck('an old ledger is moved once: every old value converted, led.refTrack = 2, a hero with no ref untouched', first === true && JSON.stringify(after1) === JSON.stringify(exp) && led.refTrack === 2 && led.hero.nf.ref === undefined, after1);
  ck('it never runs twice (a second pass changes nothing)', second === false && JSON.stringify(after2) === JSON.stringify(exp));
  const u = { id: 'rf1369-new', name: 'N', guest: true, created: Date.now(), roster: {} }; SNEW.getDB().users[u.id] = u; SNEW.ensureLedger(u);
  ck('a new ledger is born on the track (refTrack 2)', u.led.refTrack === 2);
  const u2 = { id: 'rf1369-oldled', name: 'O', guest: true, created: Date.now(), roster: {}, led: { v: 1, migratedAt: 5, rev: 1, gold: 0, gems: 0, px: 0, hero: { vael: { xp: 0, stars: 5, pips: 0, ref: 12 } }, unlocked: { vael: true }, frags: {}, camp: { cleared: 0, stars: {}, att: null }, stam: { v: 60, ts: Date.now() }, txs: [] } };
  SNEW.getDB().users[u2.id] = u2; SNEW.ensureLedger(u2);
  ck('ensureLedger moves a live account\'s old refine 12 -> 8', u2.led.hero.vael.ref === 8 && u2.led.refTrack === 2, u2.led.hero.vael);
  const u3 = { id: 'rf1369-legacy', name: 'L', guest: true, created: 0, roster: { __save: JSON.stringify({ starLevel: { vael: 5, konwu: 5 }, starRefine: { vael: 20, konwu: 8 }, heroXP: { vael: 100, konwu: 100 } }) } };
  SNEW.getDB().users[u3.id] = u3; SNEW.ensureLedger(u3);
  ck('a pre-ledger browser save is read as the old scale: 20 (forged) -> 11, 8 -> 4', u3.led.hero.vael.ref === 11 && u3.led.hero.konwu.ref === 4 && u3.led.refTrack === 2, [u3.led.hero.vael, u3.led.hero.konwu]); }

console.log('== 7. report: card power, live v1368 -> this build ==');
const RH = ['vael', 'konwu', 'quorrel', 'mellan', 'tick'].filter(k => SIM.HERO_BASE[k]);
const report = { levels: [], migrate: [] };
for (const key of RH) { const b = SIM.HERO_BASE[key].stars || 1;
  for (const level of [20, 60, 100]) { const row = { key, level };
    row.base = b;
    for (const [tag, stars, oref, nref] of [['start', b, 0, 0], ['5', 5, 0, 0], ['gold', 5, 15, 11], ['myth', 5, 15, 16]]) row[tag] = [cPow(COLD, key, { level, stars, pips: 0, ref: oref }), sPow(SNEW, key, { level, stars, pips: 0, ref: nref })];   // before = the live v1368 card (client = server there; the in-process server shares this build's sim.js)
    report.levels.push(row); }
  for (const r of [5, 10, 15]) { const st = { level: 80, stars: 5, pips: 0 }; report.migrate.push({ key, old: r, now: SIM.refineFromOld(r), before: cPow(COLD, key, Object.assign({ ref: r }, st)), after: sPow(SNEW, key, Object.assign({ ref: SIM.refineFromOld(r) }, st)) }); } }
for (const r of report.levels) console.log('  ' + r.key + ' L' + r.level + ': ' + [['start', r.base + '★'], ['5', '5★'], ['gold', 'gold (old 15 -> 11)'], ['myth', 'mythical (old 15 max -> 16)']].map(([t, n]) => n + ' ' + fmt(r[t][0]) + ' -> ' + fmt(r[t][1])).join(' · '));
for (const r of report.migrate) console.log('  ' + r.key + ' L80 old refine ' + r.old + ' -> step ' + r.now + ': ' + fmt(r.before) + ' -> ' + fmt(r.after));
fs.writeFileSync(path.join(os.tmpdir(), 'ew-star-track-1369-report.json'), JSON.stringify(report));

console.log('== 6. /api/hero/refine ==');
const SECRET = 'test-1369-' + crypto.randomBytes(6).toString('hex');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-ref1369r-')); dirs.push(dir); const dbFile = path.join(dir, 'db.json');
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const delay = ms => new Promise(r => setTimeout(r, ms));
const port = await freePort(), base = 'http://127.0.0.1:' + port; let child = null, token, id;
async function start() { child = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, ALLOW_NEW_GUESTS: '1', DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile, SERVER_SECRET: SECRET }, stdio: 'ignore', windowsHide: true });
  for (const _t0 = Date.now(); Date.now() - _t0 < 60000 && !(child && child.exitCode !== null); ) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw Error('no start'); }   /* 11 Nov: a 60 s deadline, not an iteration count (was 300 tries) */
async function stop() { if (!child) return; child.kill(); await (async(c)=>{ for(let i=0;i<400&&c.exitCode===null&&c.signalCode===null;i++){ if(i===200) try{ c.kill('SIGKILL'); }catch(_){} await new Promise(r=>setTimeout(r,50)); } if(c.exitCode===null&&c.signalCode===null) throw new Error('server pid '+c.pid+' did not exit within 20 s (SIGKILL sent at 10 s) - stopping the test here, no DB edit or restart'); })(child);   /* 11 Nov: until it has exited (the port is free); 12 Nov: throws if it never does */ child = null; }
async function call(route, data) { const r = await fetch(base + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': token }, body: data ? JSON.stringify(data) : undefined });
  let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, data: j }; }
async function editDB(fn) { await delay(400); await stop(); const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); fn(db.users[id]); fs.writeFileSync(dbFile, JSON.stringify(db)); await start(); }
const roll = rid => crypto.createHmac('sha256', SECRET).update(['refine', id, rid].join('|')).digest().readUInt32BE(0) / 4294967296;
try {
  await start();
  const g = await call('/api/guest', { deviceId: 'rf1369-' + Date.now() }); token = g.data.token; id = g.data.profile.id; await call('/api/ledger');
  await editDB(u => { u.led.unlocked.vael = true; u.led.hero.vael = { xp: 0, stars: 5, pips: 0, ref: 0 }; u.led.frags = { vael: 9999 }; });
  // request ids picked from the server's own roll so the walk is deterministic: per step one miss then one hit
  let n = 0; const pick = (want, ch) => { for (;;) { const rid = 'rf' + (++n); const r = roll(rid); if (want ? r < ch : r >= ch) return rid; } };
  let frags = 9999, lvl = 0, allMatch = true, receipt = null; const paid = {}; const log = [];
  for (let step = 0; step < 16; step++) { const T = SIM.refineTierAt(lvl);
    for (const want of [false, true]) { const rid = pick(want, T.chance), r = await call('/api/hero/refine', { heroKey: 'vael', requestId: rid });
      const exp = roll(rid) < T.chance; const cost = frags - r.data.frags; frags = r.data.frags; (paid[T.tier] = paid[T.tier] || new Set()).add(cost);
      if (!r.data.ok || r.data.success !== exp || r.data.level !== lvl + (exp ? 1 : 0)) { allMatch = false; log.push([lvl, rid, r.data]); }
      if (exp) lvl++;
      if (step === 3 && !want) { const again = await call('/api/hero/refine', { heroKey: 'vael', requestId: rid }); receipt = JSON.stringify(again.data) === JSON.stringify(r.data) && again.data.frags === frags; } } }
  ck('0 -> 16 walked: every outcome = the server\'s srvRoll < the stage chance (16 hits, 16 misses)', allMatch && lvl === 16, log.slice(0, 3));
  ck('each try costs its stage: bronze 50, silver 70, gold 90, mythical 110, hit or miss (' + ORDER.map(t => t + ' ' + [...(paid[t] || [])].join('/')).join(', ') + ')',
    ORDER.every((t, i) => paid[t] && paid[t].size === 1 && paid[t].has([50, 70, 90, 110][i])) && frags === 9999 - (2 * 50 + 10 * 70 + 10 * 90 + 10 * 110));
  ck('a retried requestId is the stored receipt (nothing re-rolled, nothing re-paid)', receipt === true);
  const l = (await call('/api/ledger')).data; const L = l.ledger || l;
  ck('the ledger holds step 16 on the track (refTrack 2 never re-applied: 16 stays 16)', L.hero && L.hero.vael && L.hero.vael.ref === 16, L.hero && L.hero.vael);
  const done = await call('/api/hero/refine', { heroKey: 'vael', requestId: 'rf-done' }), l2 = (await call('/api/ledger')).data;
  ck('at 16: "Fully refined." and nothing spent', done.data.ok === false && done.data.error === 'Fully refined.' && ((l2.ledger || l2).frags.vael | 0) === frags, done.data);
} catch (e) { FAIL++; console.log('  FAIL route section threw: ' + (e && e.stack || e)); }
finally { await stop(); }

console.log('test_refine_mythical_1369.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exitCode = FAIL ? 1 : 0;
})();
