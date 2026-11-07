'use strict';
// v1303 (Phil 7 Nov: "Labyrinth charge, when he charges the farthest enemy now he knocked to the side any enemy he passes through knocking them to
// the side 5 meters and dealing 100% of his attack damage. 150% damage to the enemy he arrives at and slams them stunning them for 3 second." /
// "Prismatic axe deals 3 rapid 120% axe swings on the weakest enemy within 3 meters of him" / "Also make his attack speed 20% slower but 20% more
// attack"). Runs the real battle engine (server/sim-host.js). CONTROL: TP_ROOT=<a pre-v1303 checkout> must FAIL.
const path = require('path'), vm = require('vm');
const ROOT = process.env.TP_ROOT || path.resolve(__dirname, '..'), control = !!process.env.TP_ROOT;
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
try {
  const T = JSON.parse(run(`JSON.stringify({swing:MONSTER_TYPES.orryx.swing, dmg:MONSTER_TYPES.orryx.dmg})`));
  ck('attack speed 20% slower: swing 2.0 -> 2.4 s', Math.abs(T.swing - 2.4) < 1e-9, T.swing);
  ck('attack 20% higher: 26 -> 31.2', Math.abs(T.dmg - 31.2) < 1e-9, T.dmg);
  const prep = `units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
    const mk=(k,t,x,y)=>{ const z=makeUnit(k,t,x,y,50,{owned:false}); z.atkInterval=99; z.speed=0; z.energy=0; z.critChance=0; z.crit=0; z.dodge=0; z.maxHp=z.hp=1e7; return z; };`;
  // only the skills' own hits count: Labyrinth Charge hits are gold (#ffcf40), Prismatic Axe swings purple (#b98bff); basic attacks are left out
  const LOG = `const log=[]; const _dd=dealDamage; dealDamage=function(s,t,amt,col){ if(s===u&&(col==='#ffcf40'||col==='#b98bff')) log.push([t.nm,amt]); return _dd.apply(this,arguments); };
    const sum=n=>log.filter(r=>r[0]===n).reduce((a,r)=>a+r[1],0), cnt=n=>log.filter(r=>r[0]===n).length;`;
  // Labyrinth Charge: O at x 150; A in the path (x 500, 0.4 m off the line); B the farthest (x 900); C beside B (2 m off the line), nearer than B
  const c = JSON.parse(run(`(()=>{ ${prep}
    const u=mk('orryx','ally',150,700), A=mk('vael','enemy',500,700+0.4*METER), B=mk('vael','enemy',900,700), C=mk('vael','enemy',880,700+2*METER);
    u.nm='O'; A.nm='A'; B.nm='B'; C.nm='C'; B.ctrlRes=0; units=[u,A,B,C]; const ab=u.greenAb; ${LOG}
    const ay0=A.y, ax0=A.x; let stB=0, stC=0; const _cc=ccApply; ccApply=function(s,tt,f,d){ const r=_cc.apply(this,arguments); if(f==='stunned'&&tt===B) stB=Math.max(stB,B.stunned||0); if(f==='stunned'&&tt===C) stC=Math.max(stC,C.stunned||0); return r; };
    let mvA=0; doEffect(u,ab.type,ab); for(let i=0;i<120;i++){ const hitBefore=cnt('A'), yb=A.y; updateBattle(SIM_STEP); if(!hitBefore&&cnt('A')) mvA=Math.abs(A.y-yb)/METER; stB=Math.max(stB,B.stunned||0); } dealDamage=_dd; ccApply=_cc;
    return JSON.stringify({ name:ab.name, dA:sum('A'), dB:sum('B'), dC:sum('C'), nA:cnt('A'), nB:cnt('B'), moveA:mvA, stunB:stB, stunC:stC, at:Math.hypot(u.x-900,u.y-700)/METER }); })()`));
  ck('Labyrinth Charge: he dashes to the farthest enemy', c.at < 2.5, JSON.stringify(c));
  ck('the enemy he passes through is hit once', c.nA === 1 && c.dA > 0, JSON.stringify({ nA: c.nA, dA: c.dA }));
  ck('...and is knocked aside 5 m (sideways, across the hit)', c.moveA > 4.7 && c.moveA < 5.5, c.moveA.toFixed(2) + ' m');
  ck('the enemy he arrives at takes 150% where the path enemy takes 100% (ratio 1.5)', c.dA > 0 && Math.abs(c.dB / c.dA - 1.5) < 0.05, (c.dB / c.dA).toFixed(3));
  ck('the slam stuns the arrival target 3 s as it lands (after the global x0.70, before Control Resist)', c.stunB > 2.95 && c.stunB <= 3.0001, c.stunB);
  ck('the slam hits ONLY the enemy he arrives at (a neighbour inside the old radius is untouched)', c.dC === 0 && !(c.stunC > 0), JSON.stringify({ dC: c.dC, stunC: c.stunC }));
  // Prismatic Axe: W (30% HP) at 2.5 m, H1 (full) at 1.5 m, H2 (full) at 2 m, F (10% HP) at 6 m (out of reach)
  const a = JSON.parse(run(`(()=>{ ${prep}
    const u=mk('orryx','ally',400,700), W=mk('grosk','enemy',400+2.5*METER,700), H1=mk('grosk','enemy',400+1.5*METER,700+30), H2=mk('grosk','enemy',400+2*METER,700-30), F=mk('grosk','enemy',400+6*METER,700);
    u.nm='O'; W.nm='W'; H1.nm='H1'; H2.nm='H2'; F.nm='F'; W.hp=W.maxHp*0.3; F.hp=F.maxHp*0.1; units=[u,W,H1,H2,F]; const ab=u.blueAb; ${LOG}
    doEffect(u,ab.type,ab); for(let i=0;i<60;i++) updateBattle(SIM_STEP); dealDamage=_dd;
    return JSON.stringify({ name:ab.name, nW:cnt('W'), dW:sum('W'), nH:cnt('H1')+cnt('H2'), nF:cnt('F'), mul:ab.mul, n:ab.n }); })()`));
  ck('Prismatic Axe: 3 swings at 120%', a.mul === 1.2 && a.n === 3, JSON.stringify({ mul: a.mul, n: a.n }));
  ck('all 3 land on the WEAKEST enemy within 3 m', a.nW === 3 && a.dW > 0, JSON.stringify(a));
  ck('one swing = 1.2 x the charge path hit (100%)', c.dA > 0 && Math.abs((a.dW / 3) / c.dA - 1.2) < 0.05, ((a.dW / 3) / c.dA).toFixed(3));
  ck('healthy enemies in reach and a weaker one out of reach (6 m) are not hit', a.nH === 0 && a.nF === 0, JSON.stringify({ nH: a.nH, nF: a.nF }));
} catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
console.log((control ? 'CONTROL ' : '') + 'test_orryx_kit_1303.js: ' + pass + ' passed, ' + fail + ' failed');
if (control) process.exit(fail > 0 ? 0 : 1);
process.exit(fail ? 1 : 0);
