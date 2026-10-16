'use strict';
// Pellucid redo1 GREEN / BLUE / ULT (Phil 11 Oct 2026: "send to claude"; ChatGPT handoff PELLUCID-GREEN-BLUE-ULT-REDO1-11OCT2026):
// the approved Meteor Knuckle, Infernal Clinch and Worldbreaker Fists takes replace ONLY those three states. Checks, through the real
// battle engine (server/sim-host.js - the file the server replays fights with):
//   - the three sheets exist, the file is exactly the declared grid, fits 4096, anchors in the cell, new files at ?v=24;
//   - attack, crit and every other state are exactly the v1115 entries; kit and ult numbers unchanged;
//   - the art lands on the game's own moments: the clip plays in real time from the cast, the fight clock runs at
//     SIM_STEP*SIM_HZ*BATTLE_PACE of it, so a gameplay event at fight time t shows on cell t/pace*fps. Measured contact cells:
//     green 17 (fist on the ground), blue 9 (hands close), ult 14/26/39 (the three two-fist slams) - each while that cell is on screen;
//   - the ult roots him for exactly the 2.0 fight s the old clip did (root:2), and whole fights with Pellucid on both sides are
//     tick-for-tick identical with the old and the new entries - no game logic moved.
// CONTROLS: the old entries miss the contact cells; the new ult without root:2 roots him for 4 s and changes the fight trace.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const Q95 = require('./helpers/q95-1158.js');   // v1158: q95 sheets are checked as the v1157 lossless originals they were (tests/test_q95_1158.js checks the q95 files)
const host = require(path.join(ROOT, 'server/sim-host.js')).load(Q95.page(path.join(ROOT, 'emberweave-heroes.html')));
require('./helpers/anim-slim-1155.js').undoSlim1155(src => require('vm').runInContext(src, host.ctx));   // v1155 slim: this release's checks see the v1153 entries (tests/test_anim_slim_1155.js checks the slim)
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
function webpSize(file) {
  const b = fs.readFileSync(file), tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return null;
}
const V1115 = {
  idle: {u:'/assets/anim/pellucid/pellucid_idle.webp?v=21',n:48,fw:340,fh:419,cols:6,rows:8,figH:400,feet:413,cx:190,fps:24,flip:true,top:13,pingpong:true},
  attack: {u:'/assets/anim/pellucid/pellucid_attack_1115.webp?v=23',n:48,fw:528,fh:511,cols:6,rows:8,figH:376,feet:460,cx:296,fps:24,flip:true,top:84,relFrac:13/48},
  crit: {u:'/assets/anim/pellucid/pellucid_crit_1115.webp?v=23',n:48,fw:528,fh:512,cols:6,rows:8,figH:395,feet:458,cx:326,fps:24,flip:true,top:63,relFrac:10/48},
  hit: {u:'/assets/anim/pellucid/pellucid_hit.webp?v=21',n:48,fw:424,fh:420,cols:6,rows:8,figH:400,feet:414,cx:246,fps:24,flip:true,top:14},
  green: {u:'/assets/anim/pellucid/pellucid_green.webp?v=21',n:48,fw:342,fh:409,cols:6,rows:8,figH:400,feet:404,cx:181,fps:24,flip:true,top:4},
  blue: {u:'/assets/anim/pellucid/pellucid_blue.webp?v=21',n:48,fw:504,fh:512,cols:6,rows:8,figH:400,feet:506,cx:312,fps:24,flip:true,top:106},
  ult: {u:'/assets/anim/pellucid/pellucid_ult.webp?v=21',n:48,fw:344,fh:411,cols:6,rows:8,figH:400,feet:406,cx:175,fps:24,flip:true,top:6},
  passive: {u:'/assets/anim/pellucid/pellucid_passive.webp?v=21',n:48,fw:307,fh:412,cols:6,rows:8,figH:400,feet:406,cx:148,fps:24,flip:true,top:6},
};
const CONTACT = { green: [17], blue: [9], ult: [14, 26, 39] };   // measured on the sheets (source 38; 33; 34/67/98) - the game event must land while that cell is on screen

// Fight-time of each gameplay moment after the cast starts: green = Meteor Knuckle's damage, blue = Infernal Clinch's damage,
// ult = each slam (the shockwave ring at Pellucid's feet). Enemy right next to him so the wave travel is not counted.
const moments = (slot) => JSON.parse(run(`(()=>{
  units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const p=makeUnit('pellucid','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',520,700,30,{owned:false});
  p.anim=BATTLE_ANIM.pellucid; units=[p,e]; units.forEach(u=>{u.maxHp=u.hp=1e9;}); e.atkInterval=99; e.speed=0; e.energy=0; p.target=e;
  p.atkCd=99; p.greenCd=p.blueCd=99; const out=[]; let t0=null;
  const _rb=ringBurst, _dd=dealDamage;
  ringBurst=function(x,y,c){ if(${slot === 'ult'} && c===0xff7a2a && t0!=null) out.push(+(battleTime-t0).toFixed(4)); return _rb.apply(this,arguments); };
  dealDamage=function(s,t,a,c){ if(${slot !== 'ult'} && s===p && t0!=null && c!=='#fff' && !out.length) out.push(+(battleTime-t0).toFixed(4)); return _dd.apply(this,arguments); };
  try{
    if(${slot === 'ult'}){ t0=battleTime; castAbility(p); }
    else { t0=battleTime; p._castSM=1; castKit(p, p.${slot}Ab); }
    for(let i=0;i<Math.round(5/SIM_STEP);i++){ updateBattle(SIM_STEP); p.atkCd=99; p.greenCd=p.blueCd=99; e.energy=0; p.energy=0; }
  } finally { ringBurst=_rb; dealDamage=_dd; }
  return JSON.stringify(out); })()`));
const PACE = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
// the cell showing at a fight time (clip starts at the cast, plays in real time)
const cellAt = (A, t) => t / PACE * A.fps;

try {
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.pellucid))');
  const bad = [];
  for (const st of ['green', 'blue', 'ult']) {
    const A = G[st], f = Q95.file(ROOT, A.u), sz = fs.existsSync(f) ? webpSize(f) : null;
    if (!sz) { bad.push(st + ' missing'); continue; }
    if (sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (A.fw * A.cols > 4096 || A.fh * A.rows > 4096) bad.push(st + ' >4096');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top < A.feet)) bad.push(st + ' anchor');
  }
  ck('the three redo1 sheets exist, file = declared grid, fit 4096, anchors in the cell', !bad.length, bad.join('; '));
  ck('green/blue/ult are the new redo1 files at ?v=24 (never a reused asset version)',
    ['green', 'blue', 'ult'].every(s => G[s].u === '/assets/anim/pellucid/pellucid_' + s + '_redo1.webp?v=24'));
  ck('attack, crit and every other state are exactly the v1115 entries (only GREEN, BLUE, ULT change)',
    ['idle', 'walk', 'attack', 'crit', 'hit', 'passive'].every(s => s === 'walk' ? !!G.walk && G.walk.u === '/assets/anim/pellucid/pellucid_walk.webp?v=21' : JSON.stringify(G[s]) === JSON.stringify(V1115[s])));
  ck('same ground line, facing and grid as his other states: feet - top = figH, flip:true, 48 cells 6x8 (the ult plays 46: it ends before his cast lock)',
    ['green', 'blue', 'ult'].every(s => G[s].feet - G[s].top === G[s].figH && G[s].flip === true && G[s].n === (s === 'ult' ? 46 : 48) && G[s].cols === 6 && G[s].rows === 8));
  ck('his kit and ult numbers are unchanged',
    run('JSON.stringify([KITS.pellucid.green.type,KITS.pellucid.green.mul,KITS.pellucid.green.stun,Math.round(KITS.pellucid.green.radius/METER*100)/100,KITS.pellucid.green.deliver,KITS.pellucid.green.fall,KITS.pellucid.green.gfx,KITS.pellucid.blue.type,KITS.pellucid.blue.mul,KITS.pellucid.blue.pct,KITS.pellucid.blue.stun,KITS.pellucid.blue.gfx,ULT_DEF.worldbreaker.mul,ULT_DEF.worldbreaker.stun,ULT_DEF.worldbreaker.radius/METER,ULT_DEF.worldbreaker.slams,ULT_DEF.worldbreaker.gap,ULT_DEF.worldbreaker.wave/METER,HERO_ULT_ART.pellucid.gfx,ABIL_ANIM.worldbreaker.hold])')
      === '["aoeStun",1.25,1.2,2.6,"land",0.45,"pellucid_green","atkcrush",1.5,0.35,0.6,"pellucid_blue",0.45,0.4,6,3,0.7,12,"pellucid_ult",1.6]');

  const mG = moments('green'), mB = moments('blue'), mU = moments('ult');
  const near = (A, ts, cells) => ts.length === cells.length && ts.every((t, k) => Math.floor(cellAt(A, t) + 1e-9) === cells[k]);
  const show = (A, ts) => ts.map(t => t.toFixed(3) + 's->cell ' + cellAt(A, t).toFixed(2)).join(', ');
  ck('GREEN: Meteor Knuckle lands while cell 17 is on screen (fist on the ground)', near(G.green, mG, CONTACT.green), show(G.green, mG));
  ck('BLUE: Infernal Clinch fires while cell 9 is on screen (hands close on the target)', near(G.blue, mB, CONTACT.blue), show(G.blue, mB));
  ck('ULT: exactly three slams, on cells 14 / 26 / 39 (the three two-fist ground contacts)', near(G.ult, mU, CONTACT.ult), show(G.ult, mU));
  ck('CONTROL: the old 48@24 entries miss those cells (green, blue and the ult slams)',
    !near(V1115.green, mG, CONTACT.green) && !near(V1115.blue, mB, CONTACT.blue) && !near(V1115.ult, mU, CONTACT.ult));

  const rootOf = anim => run(`(()=>{ const _s=BATTLE_ANIM.pellucid; BATTLE_ANIM.pellucid=${JSON.stringify(anim)};
    try{ const p=makeUnit('pellucid','ally',500,700,30,{owned:false}); return ultClipDur(p); } finally{ BATTLE_ANIM.pellucid=_s; } })()`);
  const noRoot = JSON.parse(JSON.stringify(G)); delete noRoot.ult.root;
  ck('the ult roots him for the same 2.0 fight s as the old clip (root:2)', rootOf(G) === 2 && rootOf(V1115) === 2, rootOf(G) + ' / ' + rootOf(V1115));
  ck('CONTROL: without root:2 the 3.83 s clip (46 @12) would root him for 3.83 fight s', Math.abs(rootOf(noRoot) - 46 / 12) < 1e-9, String(rootOf(noRoot)));

  // whole fights, autoUlt on both sides, Pellucid on both sides: per-tick hp/x/y of every unit
  const trace = (anim, seed, a, f) => crypto.createHash('sha256').update(run(`(()=>{ const _s=BATTLE_ANIM.pellucid; ${anim ? 'BATTLE_ANIM.pellucid=' + JSON.stringify(anim) + ';' : ''}
    window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return tr.join('#'); } finally{ BATTLE_ANIM.pellucid=_s; autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
  const OLDSET = Object.assign({}, G, { green: V1115.green, blue: V1115.blue, ult: V1115.ult });
  const fights = [[['pellucid', 'vael', 'sloe'], ['grosk', 'pellucid', 'rhukk'], 11], [['pellucid', 'konwu'], ['umbris', 'tick', 'pellucid'], 222]];
  ck('whole fights with Pellucid on both sides are tick-for-tick identical with the old and the new entries',
    fights.every(([a, f, s]) => trace(null, s, a, f) === trace(OLDSET, s, a, f)));
  ck('CONTROL: the same fights with the new ult and no root:2 diverge (the trace sees a root change)',
    fights.some(([a, f, s]) => trace(noRoot, s, a, f) !== trace(OLDSET, s, a, f)));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
