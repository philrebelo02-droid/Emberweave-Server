'use strict';
// Umbris eight (Phil 10 Oct 2026, ChatGPT handoff UMBRIS-EIGHT-10OCT2026-IDLE3-WALK2-PASSIVE1, "Pass, send them to claude"): the eight
// approved clips (idle3, walk2, attack1, hit1, green1 Shadeburst, blue1 Creeping Rot, ult1 Umbral Cataclysm, passive1 Lingering Dark) are
// wired as sheets. Checks every umbris sheet exists, its file is exactly the declared grid, the grid fits the 4096 texture limit, the anchors
// sit inside the cell, the ?v= is new, and the timing measured off the clips, run through the real battle engine (server/sim-host.js - the
// file the server replays fights with). Clips play in real time; the fight clock runs at SIM_STEP*SIM_HZ*BATTLE_PACE (0.6724) of it:
//   - attack: the bolt leaves his hand on attack cell 18 of 48 at 26 fps = 0.692 s of clip = 0.465 fight s after the swing starts; 26 fps so
//     the clip (1.846 s) fits his 1.9 s swing hold - a longer clip is squeezed into the hold and drawn late (rig: cell 12 when the bolt left)
//   - green (Shadeburst): both hands thrust out on green cell 17 = 0.708 s of clip -> cast 0.476 fight s (the zone forms 0.35 s later)
//   - blue (Creeping Rot): the arm reaches full extension on blue cell 13 = 0.542 s of clip -> the rot lands at 0.364 fight s
//   - ult (Umbral Cataclysm): both arms thrown forward on ult cell 26 = 1.083 s of clip -> the orb leaves at 0.728 fight s and lands
//     0.22 x BATTLE_PACE later
// CONTROLS: the v1114 timing (default casts 0.5/0.5/0.8, the BATTLE_PACE-only fuses) is computed from the same engine and must miss;
// a broken grid must fail. Run against v1114's emberweave-heroes.html (EW_HTML=<file>) this test fails.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(HTML);
require('./helpers/anim-slim-1155.js').undoSlim1155(src => require('vm').runInContext(src, host.ctx));   // v1155 slim: this release's checks see the v1153 entries (tests/test_anim_slim_1155.js checks the slim)
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
function webpSize(file) {   // VP8L (lossless) / VP8X header - no image library needed
  const b = fs.readFileSync(file);
  const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null;
}
function gridProblems(G) {
  const bad = [];
  for (const [st, A] of Object.entries(G)) {
    const f = path.join(ROOT, A.u.split('?')[0]);
    if (!fs.existsSync(f)) { bad.push(st + ' missing'); continue; }
    const sz = webpSize(f);
    if (A.n > A.cols * A.rows) bad.push(st + ' n>grid');
    if (A.fw * A.cols > 4096 || A.fh * A.rows > 4096) bad.push(st + ' >4096');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top < A.feet)) bad.push(st + ' anchor outside cell');
  }
  return bad;
}
// one Umbris action against one dummy; returns the battle times (from the action start) of every hit of the given colour,
// plus when the shadow-DoT first lands on the dummy (Shadeburst deals no direct damage - its zone applies the rot)
const act = (kind) => run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
  const g=makeUnit('umbris','ally',500,700,20,{owned:false}); const e=makeUnit('vael','enemy',700,700,20,{owned:false});
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9;}); e.atkInterval=99; e.speed=0; e.energy=0; g.energy=0; g.target=e; g.speed=0;
  g.greenCd=g.blueCd=99; e.greenCd=e.blueCd=99; g.greenAb=KITS.umbris.green; g.blueAb=KITS.umbris.blue;
  const col=${kind === 'blue' ? "'#8a5cff'" : "'#c9a6ff'"}, hits=[], _dd=dealDamage, _pd=plagueDot; let dotAt=null, boltSetAt=null, spd=null;
  dealDamage=function(s,t,amt,c){ if(s===g&&t===e&&c===col) hits.push({t:+(battleTime-t0).toFixed(4),amt}); return _dd.apply(this,arguments); };
  plagueDot=function(t){ if(t===e&&dotAt==null) dotAt=+(battleTime-t0).toFixed(4); return _pd.apply(this,arguments); };
  const t0=battleTime;
  try{
    if('${kind}'==='green'){ g._castSM=1; g._castLv=1; castKit(g,g.greenAb); }
    else if('${kind}'==='blue'){ g._castSM=1; g._castLv=1; castKit(g,g.blueAb); }
    else if('${kind}'==='ult'){ g.energy=100; castAbility(g); }
    else { g.atkCd=0; }
    for(let i=0;i<Math.round(4/SIM_STEP);i++){ updateBattle(SIM_STEP); g.energy=0; g.greenCd=g.blueCd=99; e.energy=0;
      if(boltSetAt==null && (g._boltT||0)>0){ boltSetAt=+(battleTime-t0).toFixed(4); spd=g._atkSpdMul||1; }
      if('${kind}'==='attack' && hits.length) break; }
  } finally { dealDamage=_dd; plagueDot=_pd; }
  return {hits, dotAt, boltSetAt, spd, step:SIM_STEP, ct:castTimeFor(g,'${kind === 'attack' ? 'blue' : kind}'), anim:!!g.anim, pace:BATTLE_PACE}; })()`);

try {
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.umbris))');
  const states = ['idle', 'walk', 'attack', 'hit', 'green', 'blue', 'ult', 'passive'];
  ck('Umbris has the eight approved states', states.every(s => G[s]), Object.keys(G).join(','));
  ck('no crit sheet (mage, range 210: no separate crit animation - none wired, as before)', !G.crit && run('HERO_TYPES.umbris.range') === 210);
  const bad = gridProblems(G);
  ck('every sheet exists, file = declared grid, fits 4096, anchors in cell', bad.length === 0, bad.join('; '));
  ck('the eight are new files at ?v=1115 (never a reused asset version)', states.every(s => G[s].u === '/assets/anim/umbris/umbris_' + s + '_1115.webp?v=1115'));
  ck('the source art faces right (flip:false) on all eight', states.every(s => G[s].flip === false));
  ck('48-cell 6x8 grids', states.every(s => G[s].n === 48 && G[s].cols === 6 && G[s].rows === 8));
  ck('attack releases on cell 18, ult on cell 26 (relFrac = release / 48)', G.attack.relFrac === 18 / 48 && G.ult.relFrac === 26 / 48);
  ck('the attack clip fits his swing hold (clip <= 0.95 x his attack interval), so it is never squeezed and drawn late', run("clipDur(BATTLE_ANIM.umbris.attack) <= 0.95*makeUnit('umbris','ally',0,0,20,{owned:false}).atkInterval") && G.attack.fps === 26);
  ck('walk plays its measured loop [1,47)', JSON.stringify(G.walk.loop) === '[1,47]');
  ck('cast times (fight s) = release cells x 0.6724: ult 0.728 (cell 26), green 0.476 (cell 17), blue 0.364 (cell 13)',
    run('JSON.stringify(ABILITY_CAST.umbris)') === '{"ult":0.364,"green":0.476,"blue":0.364}');   // v1116: ult clip at 48 fps (Phil: faster)
  const kit = run('JSON.stringify(KITS.umbris)'), M = run('METER');
  ck('Shadeburst / Creeping Rot / Lingering Dark numbers unchanged', kit === JSON.stringify({
    green: { deliver: 'form', name: 'Shadeburst', type: 'shadeburst', at: 'cluster', dps: 0.3, dur: 6, radius: 7 * M, cd: 7, gfx: 'umbris_green', noArt: true, gdur: 5.88 },
    blue: { name: 'Creeping Rot', type: 'creeprot', mul: 0.5, dps: 0.6, dur: 5, color: '#8a5cff', foot: true, handglow: true, cd: 6, gfx: 'umbris_blue', gfxR: 3 * M, gdur: 5.38 },
    purple: { name: 'Lingering Dark', pass: 'contagion', desc: run('KITS.umbris.purple.desc') } }), kit);
  ck('Umbral Cataclysm numbers unchanged (1.6 x AP, 6.8 m, 0.6 AP/s for 5 s)', run('JSON.stringify(ULT_DEF.umbralcata)') === JSON.stringify({ mul: 1.6, radius: 6.8 * M, dps: 0.6, dur: 5 }));
  ck('skill-tab previews use the new ult / green / blue / passive sheets', run("[0,1,2,3].map(i=>HERO_SKILL_CLIPS.umbris[i].u).join()") === ['ult', 'green', 'blue', 'passive'].map(s => G[s].u).join());

  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
  ck('the fight clock is 0.6724 of real time', Math.abs(CLK - 0.6724) < 1e-9, CLK);
  const tolOf = r => r.step + 1e-3;

  const B = act('blue');
  ck('this dummy has NO figure (u.anim unset, as a headless render=false resolver) - the fuses below must read the clip data themselves', !B.anim);
  const wantB = 13 / 24 * CLK;
  ck('Creeping Rot lands on blue cell 13 (0.542 s of clip = ' + wantB.toFixed(3) + ' fight s)', B.hits.length === 1 && Math.abs(B.hits[0].t - wantB) <= tolOf(B), JSON.stringify(B.hits));
  ck('CONTROL: the v1114 default blue cast (0.5 s) misses that frame', Math.abs(0.5 - wantB) > tolOf(B));

  const Gr = act('green');
  const wantG = 17 / 24 * CLK;
  ck('Shadeburst fires on green cell 17 (0.708 s of clip = ' + wantG.toFixed(3) + ' fight s) and its rot lands 0.35 s later', Gr.dotAt != null && Math.abs(Gr.dotAt - (wantG + 0.35)) <= tolOf(Gr) + 1e-3, 'dot at ' + Gr.dotAt);
  // (green moved only 0.5 -> 0.476 s, under one 0.027 s tick: no separate control - the cast-table check above fails on v1114)

  const U = act('ult');
  const wantU = 26 / 48 * CLK + 0.22 * U.pace;   // v1116: ult clip at 48 fps
  ck('Umbral Cataclysm: the slam is 1.6 x his AP (the later hits are the zone ticks and his bolts)', U.hits.length >= 1 && Math.abs(U.hits[0].amt / run('(()=>{const g=makeUnit("umbris","ally",0,0,20,{owned:false}); return g.apow;})()') - 1.6) < 0.05, JSON.stringify(U.hits[0]));
  ck('the orb leaves on ult cell 26 (1.083 s of clip = ' + (26 / 24 * CLK).toFixed(3) + ' fight s) and lands ' + (0.22 * U.pace).toFixed(3) + ' s later (' + wantU.toFixed(3) + ')',
    U.hits.length >= 1 && Math.abs(U.hits[0].t - wantU) <= 2 * U.step + 1e-3, JSON.stringify(U.hits[0]));
  const oldU = 0.8 + (26 / 48) * 2 * U.pace + 0.22 * U.pace;
  ck('CONTROL: the v1114 fuse (0.8 s cast + relFrac x clip x BATTLE_PACE) lands ' + oldU.toFixed(3) + ' s - misses the throw', Math.abs(oldU - wantU) > 2 * U.step);

  const A = act('attack');
  const wantA = (18 / 26) * CLK / (A.spd || 1);
  ck('a basic attack throws one bolt', A.hits.length === 1 && A.boltSetAt != null, JSON.stringify(A));
  ck('the bolt leaves on attack cell 18 (' + wantA.toFixed(3) + ' fight s after the swing starts)', A.hits.length === 1 && Math.abs((A.hits[0].t - A.boltSetAt) - wantA) <= tolOf(A) + 0.001, JSON.stringify({ hit: A.hits[0], set: A.boltSetAt, spd: A.spd }));
  const oldA = (18 / 26) * A.pace;
  ck('CONTROL: the v1114 bolt fuse (relFrac x clip x BATTLE_PACE = ' + oldA.toFixed(3) + ' s) lands 4 cells late (22% of the clip time)', Math.abs(oldA - wantA) > tolOf(A));

  const ctl = JSON.parse(JSON.stringify(G)); ctl.hit.u = '/assets/anim/umbris/umbris_missing.webp?v=1115'; ctl.walk.fw = 700;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
