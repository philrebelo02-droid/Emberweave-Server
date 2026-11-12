'use strict';
// v1372 AFFINITIES ON (Phil 11 Nov 2026: switch the Affinities system on). The client engine (emberweave-heroes.html dealDamage / healUnit)
// and the server line resolver (server/sim.js -> server/combat-core.js: Arena, Skyfall lines, war marches, the Vault / elite / trial estimates)
// must apply the SAME elements and class edges, behind the same switch.
//   A. TABLES + RULES: the server's AFF_ELEMENT / ELEM_BEATS / ELEM_BONUS / CLASS_BEATS / EDGE are the client's, the switch is ON on both
//      sides, and elemMul / classEdge agree for every one of the 136x136 unit pairs, every element pair and both Aureth stances, every class pair.
//   B. ENGINE, HIT FOR HIT: the client's real dealDamage / healUnit (the game script loaded by server/sim-host.js - the code the server replays
//      player fights with) and the core's applyDamage / applyHeal give the same numbers for every element pair (Aureth Light / Dark included)
//      and every edge: Sundering grace (Armor + MR x0.5, heal x1.20), Shield wall (the same 400 seeded rolls block the same 100 hits, basic
//      attacks only), Interrupt (-10 energy), Hex (2 s, not from a basic or physical hit; the swing x1/1.3), Riposte (the Bruiser's attack back,
//      once per 3 s, not while stunned), Silence the healer (heal x0.6 for 4 s, double damage to a shield, not on a miss).
//   C. ARENA-STYLE 5v5s in the line resolver: the same seed gives the same digest; every edge fires; switched off the core is the v1367 core
//      byte for byte (same digests as c8d8f962's combat-core.js), and switched on the digest moves; Neutral lines with no edge are untouched.
//   D. THE REPLAY ENGINE (sim-host, the client's own code on the server): same seed -> same digest with the switch on, and the switch moves it.
// CONTROL: AFF_SIM_DIR=<a server/ folder from c8d8f962 (no mirror)> must FAIL (A, B and C fail); the default run (this checkout) passes.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto'), Module = require('module');
const ROOT = path.join(__dirname, '..');
const SIMDIR = process.env.AFF_SIM_DIR ? path.resolve(process.env.AFF_SIM_DIR) : path.join(ROOT, 'server');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const HTMLF = path.join(ROOT, 'emberweave-heroes.html');
const src = fs.readFileSync(HTMLF, 'utf8');
const S = require(path.join(SIMDIR, 'sim.js')), C = S.CORE;
const has = typeof C.elemMul === 'function' && typeof C.classEdge === 'function' && !!C.AFF_ELEMENT;
const compileCore = (text, name) => { const m = new Module(name, module); m.filename = path.join(SIMDIR, name); m.paths = module.paths; m._compile(text, m.filename); return m.exports; };

// ---------------- A. tables + rules ----------------
const liveM = /const AFFINITIES_LIVE=(true|false);/.exec(src);
ck('client switch is ON (const AFFINITIES_LIVE=true)', !!liveM && liveM[1] === 'true');
ck('server switch is ON and equals the client (combat-core AFFINITIES_LIVE, re-exported by sim.js)', C.AFFINITIES_LIVE === true && S.AFFINITIES_LIVE === true, String(C.AFFINITIES_LIVE));
const a0 = src.indexOf('const AFF_ELEMENT='), b0 = src.indexOf('function dealDamage(', a0);
const K = {}; vm.runInNewContext('var AFFINITIES_LIVE=true;' + src.slice(a0, b0) + '\nthis.e=elemMul; this.c=classEdge; this.ue=unitElement; this.T={AFF_ELEMENT,ELEM_BEATS,ELEM_BONUS,CLASS_BEATS,EDGE};', K);
for (const t of ['AFF_ELEMENT', 'ELEM_BEATS', 'ELEM_BONUS', 'CLASS_BEATS', 'EDGE'])
  ck('server ' + t + ' == client ' + t, JSON.stringify(C[t]) === JSON.stringify(K.T[t]) && JSON.stringify(S[t]) === JSON.stringify(K.T[t]));
const keys = Object.keys(K.T.AFF_ELEMENT);
let pairs = 0, pairBad = [];
if (has) for (const x of keys) for (const y of keys) { pairs++;
  const c = K.e({ key: x, team: 0, t: {} }, { key: y, team: 1, t: {} }), s = C.elemMul({ key: x }, { key: y });
  if (c !== s && pairBad.length < 5) pairBad.push(x + '>' + y + ' ' + c + '/' + s); }
ck('elemMul: client == server for all ' + keys.length + 'x' + keys.length + ' unit pairs (' + pairs + ')', has && pairs === keys.length * keys.length && !pairBad.length, pairBad.join(' '));
const ELS = ['Water', 'Fire', 'Ice', 'Nature', 'Lightning', 'Light', 'Dark', 'Neutral'];
const ofEl = el => keys.find(k => K.T.AFF_ELEMENT[k] === el && k !== 'aureth');
const EXPECT = (a, d) => (a === 'Neutral' || d === 'Neutral') ? 1 : ((a === 'Light' && d === 'Dark') || (a === 'Dark' && d === 'Light')) ? 1.2 : K.T.ELEM_BEATS[a] === d ? 1.2 : K.T.ELEM_BEATS[d] === a ? 0.8 : 1;
let elBad = [];
const elUnits = ELS.map(el => ({ el, k: ofEl(el) })).concat([{ el: 'Light', k: 'aureth', dark: false }, { el: 'Dark', k: 'aureth', dark: true }]);
if (has) for (const A of elUnits) for (const D of elUnits) { if (A.k === D.k && !!A.dark === !!D.dark) continue;
  const c = K.e({ key: A.k, team: 0, t: {}, _darkStance: A.dark }, { key: D.k, team: 1, t: {}, _darkStance: D.dark }), s = C.elemMul({ key: A.k, _darkStance: A.dark }, { key: D.k, _darkStance: D.dark });
  if (!(c === s && Math.abs(s - EXPECT(A.el, D.el)) < 1e-12)) elBad.push(A.k + (A.dark ? '(dark)' : '') + '>' + D.k + ' ' + c + '/' + s); }
ck('every element pair (5-cycle both ways, Light<->Dark, Neutral, Aureth Light + Dark stance) - same multiplier both sides, the rule\'s value', has && !elBad.length, elBad.slice(0, 4).join(' '));
ck('Aureth: Light in his Light stance, Dark in his Dark stance (server)', has && C.unitElement({ key: 'aureth' }) === 'Light' && C.unitElement({ key: 'aureth', _darkStance: true }) === 'Dark');
const CLS = ['Support', 'Tank', 'Marksman', 'Mage', 'Bruiser', 'Assassin'];
let clBad = [];
if (has) for (const x of CLS) for (const y of CLS) { const c = K.c({ key: 'a', team: 0, t: { role: x } }, { key: 'b', team: 1, t: { role: y } }), s = C.classEdge({ key: 'a', role: x }, { key: 'b', role: y }); if (c !== s) clBad.push(x + '>' + y); }
ck('classEdge: client == server for all 36 class pairs (six edges, no reverse edge, no Warrior / Brute)', has && !clBad.length && C.classEdge({ role: 'Support' }, { role: 'Tank' }) === 'Support', clBad.join(' '));

// ---------------- B. engine, hit for hit ----------------
const H = require(path.join(ROOT, 'server/sim-host.js')).load(HTMLF);
const run = s => vm.runInContext(s, H.ctx);
const CL = JSON.parse(run(`(()=>{ window._p2guard=true; state='battle'; battleTime=0; seedBattle(7); units=[]; const out={};
  const mk=(k,team,o)=>{ const u=makeUnit(k,team,team==='ally'?300:620,600,30,{owned:false}); u.hp=u.maxHp=1e7; u.glyphDR=0; u.glyphCrit=0; u.evaStat=0; u.blockStat=0;
    u.pass={}; u.armorRating=0; u.mrRating=0; u.lifestealStat=0; u.armorPen=0; u.magicPen=0; u.critRes=0; u.shield=0; u.energy=50; u.lvl=30; u._critBuffT=0; u.drT=0; u.mortalT=0;
    if(o&&o.role) u.t=Object.assign({},u.t,{role:o.role}); if(o&&o.dark) u._darkStance=true; Object.assign(u,(o&&o.f)||{}); units.push(u); return u; };
  const fresh=()=>{ units=[]; battleTime=0; _autoAtk=0; };
  const hit=(A,B,amt,kind)=>{ const h0=B.hp; dealDamage(A,B,amt,'#fff',kind); return h0-B.hp; };
  /* elements: a 1000 true hit for each pair */
  out.el={}; for(const [ka,da,kd,dd] of ${JSON.stringify(elUnits.flatMap(A => elUnits.map(D => [A.k, !!A.dark, D.k, !!D.dark])))}){ fresh();
    const A=mk(ka,'ally',{role:'Bruiser',dark:da}), D=mk(kd,'enemy',{role:'Bruiser',dark:dd}); out.el[ka+(da?'*':'')+'>'+kd+(dd?'*':'')]=hit(A,D,1000,'true'); }
  /* Sundering grace: a Support vs a Mage hitting an armoured / warded Tank (armour 600 / MR 400, level 30) */
  fresh(); { const T=mk('vael','enemy',{role:'Tank',f:{armorRating:600,mrRating:400}}), Su=mk('vael','ally',{role:'Support'}), Ma=mk('vael','ally',{role:'Mage'});
    out.sgP=[hit(Su,T,1000,'phys'),hit(Ma,T,1000,'phys')]; out.sgM=[hit(Su,T,1000,'magic'),hit(Ma,T,1000,'magic')]; }
  /* Sundering grace heal: an ally whose target is a Tank, a Support alive beside it; then the Support dead; then the target not a Tank */
  fresh(); { const T=mk('vael','enemy',{role:'Tank'}), Br=mk('vael','enemy',{role:'Bruiser'}), u=mk('vael','ally',{role:'Bruiser'}), Su=mk('vael','ally',{role:'Support'});
    const h=()=>{ u.hp=u.maxHp-5000; const h0=u.hp; healUnit(u,100); return u.hp-h0; };
    u.target=T; const a=h(); Su.alive=false; const b=h(); Su.alive=true; u.target=Br; const c=h(); out.sgH=[a,b,c]; }
  /* Shield wall: 400 Marksman hits on a Tank, roll i = (i+0.5)/400, as basic attacks and as skill hits */
  fresh(); { const T=mk('vael','enemy',{role:'Tank'}), M=mk('vael','ally',{role:'Marksman'}); const sv=_brng; let bl=0, dm=0, sk=0;
    for(let i=0;i<400;i++){ const r=(i+0.5)/400; _brng=()=>r; _autoAtk=1; const d=hit(M,T,100,'phys'); if(d===0) bl++; else dm+=d; }
    for(let i=0;i<400;i++){ const r=(i+0.5)/400; _brng=()=>r; _autoAtk=0; if(hit(M,T,100,'phys')===0) sk++; }
    _brng=sv; out.sw=[bl,dm,sk]; }
  /* Interrupt */
  /* (the client's damage() also gives the struck unit energy for the hit; the core has no such gain - so the edge is read as the difference from the same hit by a Bruiser) */
  fresh(); { const Mg=mk('vael','enemy',{role:'Mage'}), M=mk('vael','ally',{role:'Marksman'}), Br=mk('vael','ally',{role:'Bruiser'}); Mg.energy=50; hit(M,Mg,100,'phys'); const e1=Mg.energy; Mg.energy=50; hit(Br,Mg,100,'phys'); out.int=[e1,Mg.energy]; }
  /* Hex: a magic skill hit; a magic basic attack; a physical skill hit */
  fresh(); { const B=mk('vael','enemy',{role:'Bruiser'}), Mg=mk('vael','ally',{role:'Mage'}); battleTime=5; hit(Mg,B,100,'magic'); const d1=(B._hexUntil||0)-battleTime, sl=B.slow||0;
    const B2=mk('vael','enemy',{role:'Bruiser'}); _autoAtk=1; hit(Mg,B2,100,'magic'); const d2=(B2._hexUntil||0);
    const B3=mk('vael','enemy',{role:'Bruiser'}); _autoAtk=0; hit(Mg,B3,100,'phys'); const d3=(B3._hexUntil||0); out.hex=[+d1.toFixed(6),sl>0?1:0,d2,d3]; }
  /* Riposte: the Assassin hits at t=0 (back), t=1 (cooldown), t=3 (back), and once more while the Bruiser is stunned */
  fresh(); { const B=mk('vael','enemy',{role:'Bruiser',f:{dmg:100}}), A=mk('vael','ally',{role:'Assassin',f:{dmg:50}}); const back=()=>{ const h0=A.hp; hit(A,B,10,'true'); return h0-A.hp; };
    battleTime=0; const r0=back(); battleTime=1; const r1=back(); battleTime=3; const r3=back(); battleTime=10; B.stunned=1; const rs=back(); out.rip=[r0,r1,r3,rs]; }
  /* Silence the healer: a landed blow cuts the Support's heals x0.6 for 4 s and strips its shield first; a miss does neither */
  fresh(); { const Su=mk('vael','enemy',{role:'Support'}), A=mk('vael','ally',{role:'Assassin'}); Su.shield=500; battleTime=2; hit(A,Su,100,'true'); const sh=Su.shield;
    Su.hp=Su.maxHp-5000; let h0=Su.hp; healUnit(Su,100); const cut=Su.hp-h0; battleTime=6.01; h0=Su.hp; healUnit(Su,100); const after=Su.hp-h0;
    const S2=mk('vael','enemy',{role:'Support'}); S2.shield=500; S2.evaStat=1; hit(A,S2,100,'phys');   /* a 'true' hit can never miss - the dodged blow is physical */ const missSh=S2.shield, missCut=(S2._healCutUntil||0);
    out.sil=[sh,cut,after,missSh,missCut]; }
  window._p2guard=false; return JSON.stringify(out); })()`));
// the same probes in the core
const T0 = o => Object.assign({ key: 'vael', role: 'Bruiser', healer: false, maxHp: 1e7, hp: 1e7, energy: 50, atkP: 0, atkM: 0, heal: 0, speed: 1, level: 30,
  armor: 0, mr: 0, armorPen: 0, magicPen: 0, crit: 0, critDmg: 0.6, critRes: 0, energyReg: 0, startEnergy: 0, regen: 0, lifesteal: 0, eva: 0, acc: 0,
  block: 0, dmgBonus: 1, dmgRed: 0, haste: 1, shieldStr: 1, ctrlHit: 0, ctrlRes: 0, healPow: 0, defense: 0, shieldPool: 0, _stunR: 0, _drR: 0, _markR: 0, _markMul: 1 }, o);
const rndQ = q => { let i = 0; return () => (i < q.length ? q[i++] : 0.999); };
const sHit = (A, B, amt, kind, opts, round, q) => { const h0 = B.hp; C.applyDamage(rndQ(q || [0.999, 0.999, 0.999]), [], round || 1, 'A', A, B, amt, kind, opts || {}); return h0 - B.hp; };
const SV = {}, SVerr = [];
const probe = fn => { try { fn(); } catch (e) { SVerr.push(String(e && e.message || e)); } };   /* each probe on its own: a missing rule fails its own check (CONTROL), not the rest */
probe(() => { SV.el = {}; for (const A of elUnits) for (const D of elUnits) SV.el[A.k + (A.dark ? '*' : '') + '>' + D.k + (D.dark ? '*' : '')] = sHit(T0({ key: A.k, _darkStance: !!A.dark }), T0({ key: D.k, _darkStance: !!D.dark }), 1000, 'true'); });
probe(() => { { const T = () => T0({ role: 'Tank', armor: 600, mr: 400 }); SV.sgP = [sHit(T0({ role: 'Support' }), T(), 1000, 'phys'), sHit(T0({ role: 'Mage' }), T(), 1000, 'phys')];
    SV.sgM = [sHit(T0({ role: 'Support' }), T(), 1000, 'magic'), sHit(T0({ role: 'Mage' }), T(), 1000, 'magic')]; } });
probe(() => { { const T = T0({ role: 'Tank' }), Br = T0({ role: 'Bruiser' }), u = T0({ role: 'Bruiser' }), Su = T0({ role: 'Support' });
    const h = (ctx) => { u.hp = u.maxHp - 5000; const h0 = u.hp; const m = C.affHealMul(u, 'A', 1, ctx); u.hp += Math.round(100 * m); return u.hp - h0; };
    const a = h({ a: [u, Su], b: [T, Br] }); Su.hp = 0; const b = h({ a: [u, Su], b: [T, Br] }); Su.hp = 1e7; const c = h({ a: [u, Su], b: [Br, T] }); SV.sgH = [a, b, c];
    // outside a battle there are no lines to read: applyHeal gives no Sundering grace bonus (resolveBattle sets them for its own run)
    SV.sgHeal = C.applyHeal([], 1, 'A', T0({ role: 'Support' }), T0({ role: 'Bruiser', hp: 1e6 }), 100, false); } });
probe(() => { { let bl = 0, dm = 0, sk = 0; for (let i = 0; i < 400; i++) { const r = (i + 0.5) / 400; const d = sHit(T0({ role: 'Marksman' }), T0({ role: 'Tank' }), 100, 'phys', { auto: true }, 1, [r]); if (d === 0) bl++; else dm += d; }
    for (let i = 0; i < 400; i++) { const r = (i + 0.5) / 400; if (sHit(T0({ role: 'Marksman' }), T0({ role: 'Tank' }), 100, 'phys', {}, 1, [r]) === 0) sk++; } SV.sw = [bl, dm, sk]; } });
probe(() => { { const Mg = T0({ role: 'Mage', energy: 50 }); sHit(T0({ role: 'Marksman' }), Mg, 100, 'phys'); const e1 = Mg.energy; Mg.energy = 50; sHit(T0({ role: 'Bruiser' }), Mg, 100, 'phys'); SV.int = [e1, Mg.energy]; } });
probe(() => { { const B = T0({ role: 'Bruiser' }); sHit(T0({ role: 'Mage' }), B, 100, 'magic', { ult: true }, 5); const B2 = T0({ role: 'Bruiser' }); sHit(T0({ role: 'Mage' }), B2, 100, 'magic', { auto: true }, 5);
    const B3 = T0({ role: 'Bruiser' }); sHit(T0({ role: 'Mage' }), B3, 100, 'phys', {}, 5); SV.hex = [(B._hexUntilR || 0) - 5, B2._hexUntilR || 0, B3._hexUntilR || 0]; } });
probe(() => { { const B = T0({ role: 'Bruiser', atkP: 100 }), A = T0({ role: 'Assassin', atkP: 50 }); const back = r => { const h0 = A.hp; sHit(A, B, 10, 'true', {}, r, [0.999, 0.999, 0.999, 0.999, 0.999, 0.999]); return h0 - A.hp; };
    const r0 = back(1), r1 = back(2), r3 = back(4); B._stunR = 1; const rs = back(11); SV.rip = [r0, r1, r3, rs]; } });
probe(() => { { const Su = T0({ role: 'Support', shieldPool: 500 }), A = T0({ role: 'Assassin' }); sHit(A, Su, 100, 'true', {}, 2); const sh = Su.shieldPool;
    Su.hp = Su.maxHp - 5000; const cut = C.applyHeal([], 2, 'B', T0({ role: 'Support' }), Su, 100, false); const after = C.applyHeal([], 6, 'B', T0({ role: 'Support' }), Su, 100, false);
    const S2 = T0({ role: 'Support', shieldPool: 500, eva: 1 }); sHit(A, S2, 100, 'phys', {}, 2, [0]); SV.sil = [sh, cut, after, S2.shieldPool, S2._healCutUntilR || 0]; } });
ck('B probes ran on both engines', !SVerr.length, SVerr.join(' | '));
const elDiff = Object.keys(CL.el || {}).filter(k => Math.round(CL.el[k]) !== (SV.el || {})[k]);
ck('B every element pair: the client\'s real dealDamage and the core\'s applyDamage remove the same HP from a 1000 hit (' + Object.keys(CL.el || {}).length + ' pairs: Water>Fire ' + Math.round(CL.el[ofEl('Water') + '>' + ofEl('Fire')]) + ', Fire>Water ' + Math.round(CL.el[ofEl('Fire') + '>' + ofEl('Water')]) + ', aureth*>aureth ' + Math.round(CL.el['aureth*>aureth']) + ')',
  has && Object.keys(CL.el).length === elUnits.length * elUnits.length && !elDiff.length && Math.round(CL.el[ofEl('Water') + '>' + ofEl('Fire')]) === 1200 && Math.round(CL.el[ofEl('Fire') + '>' + ofEl('Water')]) === 800,
  elDiff.slice(0, 4).map(k => k + ' ' + CL.el[k] + '/' + SV.el[k]).join(' '));
const r = a => (a || []).map(x => Math.round(x));
ck('B Sundering grace: a Support reads the Tank\'s Armor / MR at x0.5 - same damage both engines (phys ' + r(CL.sgP).join(' vs ') + ', magic ' + r(CL.sgM).join(' vs ') + ')',
  has && JSON.stringify(r(CL.sgP)) === JSON.stringify(SV.sgP) && JSON.stringify(r(CL.sgM)) === JSON.stringify(SV.sgM) && CL.sgP[0] > CL.sgP[1] && CL.sgM[0] > CL.sgM[1], JSON.stringify([SV.sgP, SV.sgM]));
ck('B Sundering grace heal: x1.20 while a Support lives and the target is a Tank, x1 otherwise (client ' + r(CL.sgH).join('/') + ', server ' + (SV.sgH || []).join('/') + ')',
  has && JSON.stringify(r(CL.sgH)) === JSON.stringify([120, 100, 100]) && JSON.stringify(SV.sgH) === JSON.stringify([120, 100, 100]) && SV.sgHeal === 100);
ck('B Shield wall: the same 400 rolls block the same 100 basic attacks on both engines, the rest land in full, skill hits never blocked (client ' + (CL.sw || []).join('/') + ', server ' + (SV.sw || []).join('/') + ')',
  has && JSON.stringify(r(CL.sw)) === JSON.stringify(SV.sw) && SV.sw[0] === 100 && SV.sw[1] === 30000 && SV.sw[2] === 0);
ck('B Interrupt: a Marksman hit leaves a Mage 10 energy below the same hit from a Bruiser (client ' + JSON.stringify(CL.int) + ', server ' + JSON.stringify(SV.int) + ')',
  has && CL.int && SV.int && CL.int[1] - CL.int[0] === 10 && SV.int[1] - SV.int[0] === 10 && SV.int[0] === 40);
ck('B Hex: a magic skill hit hexes a Bruiser for 2 s (slowed in the client); a basic attack or a physical hit does not (client ' + JSON.stringify(CL.hex) + ', server ' + JSON.stringify(SV.hex) + ')',
  has && JSON.stringify(CL.hex) === JSON.stringify([2, 1, 0, 0]) && JSON.stringify(SV.hex) === JSON.stringify([2, 0, 0]));   /* the client also slows (movement; the core has no positions) */
ck('B Riposte: the Bruiser\'s 100 attack comes straight back, once per 3 s, never while stunned (client ' + r(CL.rip).join('/') + ', server ' + (SV.rip || []).join('/') + ')',
  has && JSON.stringify(r(CL.rip)) === JSON.stringify([100, 0, 100, 0]) && JSON.stringify(SV.rip) === JSON.stringify([100, 0, 100, 0]));
ck('B Silence the healer: shield 500 -> 300 off a 100 blow, heals 100 -> 60 for 4 s then 100 again, a miss strips and cuts nothing (client ' + r(CL.sil).join('/') + ', server ' + (SV.sil || []).join('/') + ')',
  has && JSON.stringify(r(CL.sil)) === JSON.stringify([300, 60, 100, 500, 0]) && JSON.stringify(SV.sil) === JSON.stringify([300, 60, 100, 500, 0]));
// the core's Hex on the swing: x1/1.3 energy and basic-attack damage while hexed (the client's attack interval x1.3)
let hexSw = null;
if (has) { const a = C.lineUp([T0({ key: 'vael', role: 'Bruiser', atkP: 1000, maxHp: 1e9 })]), b = C.lineUp([T0({ key: 'vael', role: 'Tank', maxHp: 1e9, atkP: 0 })]);
  a[0]._hexUntilR = 3; const res = C.resolveBattle(a, b, 99); const hits = res.log.filter(e => e[1] === 'A' && e[3] === '>' && !e[6]); hexSw = [hits[0][5], hits[2][5], res.aState[0].energy]; }
const base = has ? (() => { const a = C.lineUp([T0({ key: 'vael', role: 'Bruiser', atkP: 1000, maxHp: 1e9 })]), b = C.lineUp([T0({ key: 'vael', role: 'Tank', maxHp: 1e9, atkP: 0 })]); const res = C.resolveBattle(a, b, 99); const hits = res.log.filter(e => e[1] === 'A' && e[3] === '>' && !e[6]); return [hits[0][5], hits[2][5]]; })() : null;
ck('B core Hex on the swing: rounds 1-2 hit x1/1.3, round 3 in full (' + JSON.stringify(hexSw) + ' vs unhexed ' + JSON.stringify(base) + ')',
  has && hexSw && Math.abs(hexSw[0] / base[0] - 1 / 1.3) < 0.01 && hexSw[1] === base[1]);

// ---------------- C. arena-style 5v5s in the line resolver ----------------
const old = cp.execSync('git show c8d8f962:server/combat-core.js', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const OLD = compileCore(old, 'combat-core-v1367.js');
const curSrc = fs.readFileSync(path.join(SIMDIR, 'combat-core.js'), 'utf8');
const OFF = curSrc.includes('const AFFINITIES_LIVE=true;') ? compileCore(curSrc.replace('const AFFINITIES_LIVE=true;', 'const AFFINITIES_LIVE=false;'), 'combat-core-off.js') : null;
const snap = (k, lv) => S.heroCombatStats(k, { level: lv || 60, skillLv: [60, 60, 60, 60], extra: { skillLv: [60, 60, 60, 60] } });
const LINES = {
  classic: ['grosk', 'konwu', 'hollow', 'sloe', 'lumi'],          // Tank Bruiser Assassin Marksman Support
  mages: ['umbris', 'astra', 'maren', 'vesper', 'sylthaine'],
  bruisers: ['konwu', 'tick', 'korvux', 'hurne', 'carn'],
  supports: ['lumi', 'vireo', 'oakmir', 'mirelle', 'nerisse'],
  assassins: ['hollow', 'vex', 'sorrel', 'kharos', 'nox'],
  tanks: ['grosk', 'gruel', 'tharl', 'askel', 'brannus'],
  marks: ['sloe', 'meridian', 'yenna', 'rafe', 'calypsa'],
  neutralB: ['konwu', 'deepcleft', 'quorrel', 'carn', 'grimsby'],      // all Neutral Bruisers: no element, and Bruiser vs Bruiser is no edge
  neutralB2: ['deepcleft', 'carn', 'grimsby', 'konwu', 'quorrel'],   /* v1374: Tick is Lightning now (Phil 12 Nov) - these are the 5 Neutral Bruisers left */
};
const FIGHTS = [['classic', 'mages'], ['classic', 'bruisers'], ['classic', 'supports'], ['bruisers', 'assassins'], ['assassins', 'supports'], ['supports', 'tanks'],
  ['tanks', 'marks'], ['marks', 'mages'], ['mages', 'bruisers'], ['classic', 'classic']];
const fightOn = (core, A, B, seed) => { const res = core.resolveBattle(core.lineUp(LINES[A].map(k => snap(k))), core.lineUp(LINES[B].map(k => snap(k))), seed);
  return { won: res.won, rounds: res.rounds, d: sha(JSON.stringify([res.won, res.rounds, res.aState, res.bState, res.log])), log: res.log }; };
let det = true, moved = 0, offOld = true, tot = 0; const verbs = {};
const roles = new Set();
for (const [A, B] of FIGHTS) for (const seed of [11, 222, 3333]) { tot++;
  const x = fightOn(C, A, B, seed), y = fightOn(C, A, B, seed);
  if (x.d !== y.d) det = false;
  const o = fightOn(OLD, A, B, seed); if (o.d !== x.d) moved++;
  if (OFF) { const f = fightOn(OFF, A, B, seed); if (f.d !== o.d) offOld = false; } else offOld = false;
  for (const e of x.log) verbs[e[3]] = (verbs[e[3]] || 0) + 1; }
ck('C same seed, same lines -> the same digest, switch on (' + tot + ' arena 5v5s run twice)', det);
ck('C switched OFF the core is the v1367 core exactly - all ' + tot + ' digests equal c8d8f962\'s combat-core.js', !!OFF && offOld);
ck('C switched ON the affinities move the fights (' + moved + ' of ' + tot + ' digests differ from v1367)', has && moved >= tot - 2, String(moved));
ck('C the edges fire in real 5v5s: Shield wall blocks (' + (verbs.block || 0) + ') and Ripostes (' + (verbs.riposte || 0) + ') in the log', (verbs.block || 0) > 0 && (verbs.riposte || 0) > 0);
// Neutral lines with no class pair in the cycle: the switch changes nothing
let neutralSame = true;
for (const seed of [5, 55, 555]) { const x = fightOn(C, 'neutralB', 'neutralB2', seed), o = fightOn(OLD, 'neutralB', 'neutralB2', seed); if (x.d !== o.d) neutralSame = false; }
ck('C all-Neutral Bruiser lines (no element, no edge between them) fight exactly as in v1367', neutralSame && [...LINES.neutralB, ...LINES.neutralB2].every(k => K.T.AFF_ELEMENT[k] === 'Neutral' && S.HERO_BASE[k].role === 'Bruiser'));
// win rates on the new rules (the blueprint's proof, line-model edition): the cycle shows
const wr = (A, B, core) => { let w = 0; for (let s = 1; s <= 40; s++) if (fightOn(core, A, B, s * 7919).won) w++; return w; };
const wBS = wr('bruisers', 'assassins', C), wBS0 = wr('bruisers', 'assassins', OLD), wAS = wr('assassins', 'supports', C), wAS0 = wr('assassins', 'supports', OLD);
console.log('      line model, 40 fights each: 5 Bruisers beat 5 Assassins ' + wBS + ' (v1367 ' + wBS0 + '); 5 Assassins beat 5 Supports ' + wAS + ' (v1367 ' + wAS0 + ')');
ck('C the edge helps the side that holds it (Bruisers vs Assassins and Assassins vs Supports win at least as often as in v1367)', wBS >= wBS0 && wAS >= wAS0);
// the routes call these through sim.js: resolveLineBattle / qualificationEstimate are the core
{ const a = S.makeLine(LINES.tanks.map(k => snap(k))), b = S.makeLine(LINES.marks.map(k => snap(k))); const r1 = S.resolveLineBattle(a, b, 77);
  const r2 = C.resolveBattle(C.lineUp(LINES.tanks.map(k => snap(k))), C.lineUp(LINES.marks.map(k => snap(k))), 77);
  ck('C sim.js resolveLineBattle (Arena / Skyfall / war) is the core with affinities: same digest, Shield wall in its log', sha(JSON.stringify(r1)) === sha(JSON.stringify(r2)) && r1.log.some(e => e[3] === 'block')); }
{ const est = S.qualificationEstimate(LINES.supports.map(k => snap(k)), [LINES.tanks.map(k => snap(k, 40))], 4242), est2 = S.qualificationEstimate(LINES.supports.map(k => snap(k)), [LINES.tanks.map(k => snap(k, 40))], 4242);
  ck('C the Vault / trial estimate (qualificationEstimate) is deterministic with the switch on', JSON.stringify(est) === JSON.stringify(est2)); }

// ---------------- D. the replay engine (the client's own code, server side) ----------------
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'affpar-'));
const offHtml = path.join(tmp, 'parity-off.html'); fs.writeFileSync(offHtml, src.replace('const AFFINITIES_LIVE=true;', 'const AFFINITIES_LIVE=false;'));
for (const raw of [...src.matchAll(/<script\s+src=["']\/([^"']+)["'][^>]*><\/script>/g)].map(m => m[1].split('?')[0]).filter(s => !s.startsWith('assets/'))) {
  const from = path.join(ROOT, raw); if (fs.existsSync(from)) { const to = path.join(tmp, raw); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); } }
const H0 = require(path.join(ROOT, 'server/sim-host.js')).load(offHtml);
const tA = H.snapSquad(LINES.classic), tB = H.snapSquad(['grosk', 'umbris', 'sloe', 'hollow', 'tick']);
const cp2 = x => JSON.parse(JSON.stringify(x));
let rsame = true, rmoved = 0;
for (const seed of [17, 1717, 171717]) { const x = H.auto(cp2(tA), cp2(tB), seed), y = H.auto(cp2(tA), cp2(tB), seed), o = H0.auto(cp2(tA), cp2(tB), seed);
  if (!x.digest || x.digest !== y.digest || x.won !== y.won) rsame = false; if (o.digest !== x.digest) rmoved++; }
ck('D replay engine (sim-host): the same fight and seed give the same digest with the switch on - the player\'s fight and the server\'s replay agree', rsame);
ck('D replay engine: the switch moves the digest (' + rmoved + ' of 3) - the affinities run inside every replayed / auto fight', rmoved >= 2);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
console.log('test_affinity_parity_1372.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
