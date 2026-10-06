'use strict';
// v1045 Bloatus Toxic Breath (Phil 6 Oct 2026: "please check bloatus toxic breath spell FX"). Looked at in a real battle: the gas came
// out of his knees as a thin dark streak (the beam's mouth was a fixed 1.55 high and the old toxbeam sheet sat on frame 0 - the update
// wrote the frame into the shared texture, which fx2Hook ignores), it started mid-inhale and outlived the clip by a second, his next
// swing cut the clip (v1031 rule) so the exhale never showed, and he faced the nearest foe while breathing at the furthest.
(function main() {
const path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
try {
  const D = run(`({cast:ABILITY_CAST.bloatus.green, kit:KITS.bloatus.green, cone:FX2_DEF.toxcone, apex:APEX.bloatus, anim:BATTLE_ANIM.bloatus.green, M:METER})`);
  ck('the gas leaves on his exhale: cast 0.9 s (green2 frame 27 at 24 fps on the 0.82 battle pace)', D.cast === 0.9);
  ck('the breath is the green gas plume (toxcone: frames 20-29, body capped to the 2.8 m line it hits)', D.cone && /bloatus_green\.webp/.test(D.cone.u) && D.cone.f0 === 20 && Math.abs(D.cone.thick - 2.8 * D.M) < 1e-9);
  ck('the flat ground cone is not drawn as well (noArt)', D.kit.noArt === true);
  ck('his mouth is measured (APEX) and he faces the furthest foe in 15 m while breathing', D.apex && D.apex.fy > 0 && D.anim.faceFar === 15);
  // a real cast through updateBattle: damage when the cast resolves, then no swing for the 0.75 s exhale
  const R = run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0;
    const b=makeUnit('bloatus','ally',400,700,20,{owned:false}), near=makeUnit('grosk','enemy',400+0.9*METER,690,20,{owned:false}), far=makeUnit('brannus','enemy',400+8*METER,700,20,{owned:false});
    units=[b,near,far]; units.forEach(u=>{u.maxHp=u.hp=1e7; u.speed=0;}); [near,far].forEach(u=>{u.atkInterval=99; u.greenAb=null; u.blueAb=null;});
    b.greenAb=KITS.bloatus.green; b.blueAb=null; b.greenCd=0; b.energy=0;
    let castAt=null, hitAt=null, swingHits=[]; const f0=far.hp, n0=near.hp; let nPrev=near.hp;
    for(let i=0;i<Math.round(4/SIM_STEP);i++){ b.energy=0; if(castAt==null&&b._pend) castAt=battleTime;
      updateBattle(SIM_STEP);
      if(hitAt==null&&far.hp<f0) hitAt=battleTime;
      if(hitAt!=null&&near.hp<nPrev&&battleTime-hitAt>SIM_STEP*1.5) swingHits.push(+(battleTime-hitAt).toFixed(3));
      nPrev=near.hp; }
    return {castAt, hitAt, firstSwingAfter:swingHits.length?swingHits[0]:null, STEP:SIM_STEP}; })()`);
  ck('Toxic Breath reaches the FURTHEST foe 0.9 s after the cast starts', R.castAt != null && R.hitAt != null && Math.abs((R.hitAt - R.castAt) - 0.9) <= 2 * R.STEP + 1e-9, JSON.stringify(R));
  ck('no swing lands during the 0.75 s exhale (to the sim step) (the breath clip is not cut, no blow lands unseen)', R.firstSwingAfter == null || R.firstSwingAfter >= 0.75 - R.STEP - 1e-9, JSON.stringify(R));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
