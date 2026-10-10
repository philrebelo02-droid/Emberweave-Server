'use strict';
// v1115 Pellucid ATTACK + CRIT (Phil 10 Oct 2026: "both are a pass give them to claude"; ChatGPT handoff
// PELLUCID-ATTACK-CRIT-GREEN1-10OCT2026): the haymaker (attack-green1) and the big front kick (crit-green1) are wired as new sheets;
// every other Pellucid state is unchanged. Checks, through the real battle engine (server/sim-host.js - the file the server replays
// fights with):
//   - the two sheets exist, the file is exactly the declared grid, fits the 4096 texture limit, anchors sit in the cell, ?v= new;
//   - they stand on the same ground line as his other states (feet - top = figH on every state, flip:true like the rest);
//   - the other six states are byte-for-byte the c2354ddd entries;
//   - the blow lands on the measured contact cell: attack cell 13 (fist at full reach), crit cell 10 (sole at full extension),
//     i.e. clipDur x relFrac x BATTLE_PACE fight seconds after the swing starts (fuseStrike);
//   - a forced crit plays the crit clip and hits for 1 + critDmg of the normal swing; the normal swing's damage is identical to
//     the same swing with the OLD (c2354ddd) attack entry - damage numbers unchanged.
// CONTROLS: the old c2354ddd entries swapped in fail the timing / crit-clip checks; a broken grid copy fails the grid check.
// On a c2354ddd tree this test FAILS (no crit state, old sheet, blow at the 0.5 default).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
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
// c2354ddd entries (before v1115) - the six unchanged states must still equal these; attack is the old sheet (no crit)
const OLD = {
  idle: {u:'/assets/anim/pellucid/pellucid_idle.webp?v=21',n:48,fw:340,fh:419,cols:6,rows:8,figH:400,feet:413,cx:190,fps:24,flip:true,top:13,pingpong:true},
  walk: {u:'/assets/anim/pellucid/pellucid_walk.webp?v=21',n:48,fw:312,fh:427,cols:6,rows:8,figH:400,feet:419,cx:157,fps:24,flip:true,top:19,ax:[0,-0.4,-0.9,-0.6,-0.3,-0.1,-0.2,0.1,-0.2,-0.8,-0.4,1.8,4.7,7.9,11.1,13.2,13.8,13.8,13.9,14.2,14.1,14,13.4,13.2,13.2,13.4,14,14.7,15.6,16.4,17.2,18.3,20.5,23.8,24.7,24.9,25.1,25.4,26.5,28.3,30.7,32.4,33.5,34.2,35.2,38.2,40.5,41.3]},
  attack: {u:'/assets/anim/pellucid/pellucid_attack.webp?v=21',n:48,fw:507,fh:471,cols:6,rows:8,figH:400,feet:464,cx:281,fps:24,flip:true,top:64,ax:[0,0,0,0,0,6,18,24,27,31,31,31,31,31,32,31,31,31,31,31,31,31,31,32,31,31,31,31,31,32,31,31,31,31,31,31,31,29,26,19,16,12,6,1,0,0,0,0]},
  hit: {u:'/assets/anim/pellucid/pellucid_hit.webp?v=21',n:48,fw:424,fh:420,cols:6,rows:8,figH:400,feet:414,cx:246,fps:24,flip:true,top:14},
  green: {u:'/assets/anim/pellucid/pellucid_green.webp?v=21',n:48,fw:342,fh:409,cols:6,rows:8,figH:400,feet:404,cx:181,fps:24,flip:true,top:4},
  blue: {u:'/assets/anim/pellucid/pellucid_blue.webp?v=21',n:48,fw:504,fh:512,cols:6,rows:8,figH:400,feet:506,cx:312,fps:24,flip:true,top:106},
  ult: {u:'/assets/anim/pellucid/pellucid_ult.webp?v=21',n:48,fw:344,fh:411,cols:6,rows:8,figH:400,feet:406,cx:175,fps:24,flip:true,top:6},
  passive: {u:'/assets/anim/pellucid/pellucid_passive.webp?v=21',n:48,fw:307,fh:412,cols:6,rows:8,figH:400,feet:406,cx:148,fps:24,flip:true,top:6},
};
// One Pellucid swing against a dummy. anim = the BATTLE_ANIM.pellucid to use (null = the file's own); crit = force this swing to crit.
// Returns the fight time from the swing start to the blow, the clip the swing chose, and the damage.
const swing = (anim, crit) => run(`(()=>{ const _saved=BATTLE_ANIM.pellucid; ${anim ? 'BATTLE_ANIM.pellucid=' + JSON.stringify(anim) + ';' : ''}
  try{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
    const p=makeUnit('pellucid','ally',500,700,20,{owned:false}); const e=makeUnit('vael','enemy',540,700,20,{owned:false});
    p.anim=BATTLE_ANIM.pellucid; e.anim=BATTLE_ANIM.vael||null;   /* as buildFigure does headless (_p2guard): strike timing reads the clip data */
    units=[p,e]; units.forEach(u=>{u.maxHp=u.hp=1e9;}); e.atkInterval=99; e.speed=0; e.energy=0; p.energy=0; p.target=e;
    p.greenCd=p.blueCd=99; p.greenAb=null; p.blueAb=null; p.glyphCrit=0; p._critBuffT=0; if(p.pass) p.pass.crit=false; e.critRes=0;
    ${crit ? "p._gearNextCrit='hit';" : ''}
    const hits=[], _dd=dealDamage; let t0=null, clip=null;
    dealDamage=function(s,t,amt,c){ const r=_dd.apply(this,arguments); if(s===p&&t===e&&c==='#fff') hits.push({t:battleTime,amt:e._lastDmg!=null?e._lastDmg:amt,crit:!!e._critHit}); return r; };
    let before=e.hp;
    try{
      for(let i=0;i<Math.round(3/SIM_STEP)&&!hits.length;i++){ const cd0=p.atkCd; before=e.hp; updateBattle(SIM_STEP); p.energy=0; e.energy=0; p.greenCd=p.blueCd=99;
        if(t0==null && p.atkCd>(cd0||0)+1e-6){ t0=battleTime; clip=p._atkClip||'attack'; }
        if(hits.length){ hits[0].amt=before-e.hp; } }
    } finally { dealDamage=_dd; }
    const A=p.anim[clip==='crit'&&p.anim.crit?'crit':'attack'];
    return {dt:hits.length&&t0!=null?+(hits[0].t-t0).toFixed(4):null, clip, hit:hits[0]||null, step:SIM_STEP, want:clipDur(A)*(A.relFrac!=null?A.relFrac:0.5)*BATTLE_PACE, critDmg:p.critDmg||0.6};
  } finally { BATTLE_ANIM.pellucid=_saved; } })()`);

try {
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.pellucid))');
  const states = ['idle', 'walk', 'attack', 'crit', 'hit', 'green', 'blue', 'ult', 'passive'];
  ck('Pellucid has his eight states + the new crit', states.every(s => G[s]), Object.keys(G).join(','));
  const bad = gridProblems(G);
  ck('every sheet exists, file = declared grid, fits 4096, anchors in cell', bad.length === 0, bad.join('; '));
  ck('attack and crit are the new v1115 files at ?v=23 (never a reused asset version)',
    G.attack && G.attack.u === '/assets/anim/pellucid/pellucid_attack_1115.webp?v=23' && G.crit && G.crit.u === '/assets/anim/pellucid/pellucid_crit_1115.webp?v=23');
  ck('the other six states are exactly the c2354ddd entries (only ATTACK and CRIT change)',
    ['idle', 'walk', 'hit', 'green', 'blue', 'ult', 'passive'].every(s => JSON.stringify(G[s]) === JSON.stringify(OLD[s])));
  ck('same ground line and facing as his other states: feet - top = figH on every state, flip:true, 48 cells @24',
    states.every(s => G[s] && G[s].feet - G[s].top === G[s].figH && G[s].flip === true && G[s].n === 48 && G[s].fps === 24),
    states.map(s => G[s] ? s + ':' + (G[s].feet - G[s].top) + '/' + G[s].figH : s + ':-').join(' '));
  ck('measured contact cells: attack 13/48 (fist at full reach), crit 10/48 (sole at full extension)', G.attack.relFrac === 13 / 48 && G.crit && G.crit.relFrac === 10 / 48);
  ck('no ax on the new sheets (the slicer ax tracked the fist / kicked leg, not his planted feet)', !G.attack.ax && G.crit && !G.crit.ax);
  ck('his kit is unchanged (Meteor Knuckle / Infernal Clinch / Unmovable Mass, Worldbreaker Fists)',
    run('JSON.stringify([KITS.pellucid.green.mul,KITS.pellucid.green.stun,KITS.pellucid.blue.mul,KITS.pellucid.blue.pct,KITS.pellucid.purple.pass,HERO_TYPES.pellucid.dmg,HERO_TYPES.pellucid.swing,HERO_TYPES.pellucid.ability])') === '[1.25,1.2,1.5,0.35,"unmovable",25,1.8,"worldbreaker"]');

  const PACE = run('BATTLE_PACE'), N = swing(null, false), tol = 2 * N.step + 1e-6;
  const wantA = 2.0 * 13 / 48 * PACE, wantC = 2.0 * 10 / 48 * PACE;
  ck('normal swing plays the attack clip and lands on cell 13 = ' + wantA.toFixed(3) + ' fight s after the swing starts',
    N.clip === 'attack' && N.dt != null && Math.abs(N.dt - wantA) <= tol, JSON.stringify(N));
  const C = swing(null, true);
  ck('a crit plays the crit clip (the front kick) and lands on cell 10 = ' + wantC.toFixed(3) + ' fight s after the swing starts',
    C.clip === 'crit' && C.dt != null && Math.abs(C.dt - wantC) <= tol, JSON.stringify(C));
  ck('the crit hits for 1 + critDmg of the normal swing (crit maths unchanged)',
    N.hit && C.hit && N.hit.amt > 0 && Math.abs(C.hit.amt / N.hit.amt - (1 + C.critDmg)) < 1e-3, N.hit && C.hit ? (C.hit.amt / N.hit.amt).toFixed(4) : '');
  const O = swing(OLD, false);
  ck('damage numbers unchanged: the normal swing deals exactly what the c2354ddd attack sheet dealt',
    N.hit && O.hit && Math.abs(N.hit.amt - O.hit.amt) < 1e-6, N.hit && O.hit ? N.hit.amt + ' vs ' + O.hit.amt : '');
  // CONTROLS - the old entries fail the new checks
  ck('CONTROL: the old c2354ddd attack lands at the 0.5 default (' + (2.0 * 0.5 * PACE).toFixed(3) + ' s), not on cell 13 - the timing check fails on the old code',
    O.dt != null && Math.abs(O.dt - wantA) > tol, JSON.stringify(O));
  const OC = swing(OLD, true);
  ck('CONTROL: with the old entries a forced crit has no crit clip (plays attack) - the crit-clip check fails on the old code', OC.clip !== 'crit', JSON.stringify(OC));
  const ctl = JSON.parse(JSON.stringify(G)); ctl.crit.u = '/assets/anim/pellucid/pellucid_missing.webp?v=23'; ctl.attack.fw = 700;
  ck('CONTROL: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
