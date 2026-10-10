'use strict';
// Grosk eight (Phil 10 Oct 2026, ChatGPT handoff GROSK-EIGHT-10OCT2026-BLUE13-ULT2-AIR2, "send to claude"): the eight approved clips
// are wired as sheets (passive OMITTED by Phil - the old passive sheet stays). Checks every grosk sheet exists, its file is exactly
// the declared grid, the grid fits the 4096 texture limit, the anchors sit inside the cell, the ?v= is new, the measured contact frames,
// and the timing Phil asked for, run through the real battle engine (server/sim-host.js - the file the server replays fights with):
//   - Hammer Fists: "the damage dealt should land when the punch is fully extended each time" - three hits at 1.083 / 2.000 / 2.833 s
//     of clip after the cast starts (blue cells 13 / 24 / 34 at 12 fps). Clips play in real time and the fight clock runs at
//     SIM_STEP*SIM_HZ*BATTLE_PACE (0.6724) of it, so the fight lands them at 0.728 / 1.345 / 1.905 fight seconds. CONTROL: the same cast without hitTimes (the old instant flurry)
//     lands all three at the cast end (0.6 s), so the timing check fails on the old code.
//   - Croc Drop: the slam lands when his feet hit the ground in the ULT2 two-second-airtime clip (ult cell 34 = 2.833 s of clip = 1.905 fight s), damage unchanged.
// A grid control runs the sheet check on a deliberately broken copy and must fail.
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
// one Grosk cast against one dummy; returns the battle times (from the cast start) of every hit of the given colour
const cast = (kind, dropHitTimes) => run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
  const g=makeUnit('grosk','ally',500,700,20,{owned:false}); const e=makeUnit('vael','enemy',540,700,20,{owned:false});
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9;}); e.atkInterval=99; e.speed=0; e.energy=0; g.energy=0; g.target=e;
  g.greenCd=g.blueCd=99; g.greenAb=null; g.blueAb=${dropHitTimes ? `Object.assign({},KITS.grosk.blue,{hitTimes:undefined})` : 'KITS.grosk.blue'};
  const col=${kind === 'blue' ? "'#e0b070'" : "'#c9a05e'"}, hits=[], _dd=dealDamage;
  dealDamage=function(s,t,amt,c){ if(s===g&&t===e&&c===col) hits.push({t:+(battleTime-t0).toFixed(4),amt}); return _dd.apply(this,arguments); };
  const t0=battleTime; let airMax=0, ultClipAt25=null;
  try{
    if(${kind === 'blue'}){ g._castSM=1; g._castLv=1; castKit(g,g.blueAb); } else { g.energy=100; castAbility(g); }
    for(let i=0;i<Math.round(4/SIM_STEP);i++){ updateBattle(SIM_STEP); g.energy=0; g.greenCd=g.blueCd=99; e.energy=0;
      airMax=Math.max(airMax,g._airT||0); if(ultClipAt25==null && battleTime-t0>=1.6) ultClipAt25={root:+(g._ultRootT||0).toFixed(3),lock:+(g._animLockT||0).toFixed(3)}; }
  } finally { dealDamage=_dd; }
  return {hits, step:SIM_STEP, ct:castTimeFor(g,'${kind}'), airMax, ultClipAt25, maxHp:g.maxHp}; })()`);

try {
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.grosk))');
  const states = ['idle', 'walk', 'attack', 'crit', 'hit', 'green', 'blue', 'ult', 'passive'];
  ck('Grosk has the eight approved states + the kept passive', states.every(s => G[s]), Object.keys(G).join(','));
  const bad = gridProblems(G);
  ck('every sheet exists, file = declared grid, fits 4096, anchors in cell', bad.length === 0, bad.join('; '));
  const eight = states.filter(s => s !== 'passive');
  ck('the eight are new files at ?v=22 (never a reused asset version)', eight.every(s => G[s].u === '/assets/anim/grosk/grosk_' + s + '_1112.webp?v=22'));
  ck('passive unchanged (OMITTED by Phil - no mechanic removed)', G.passive.u === '/assets/anim/grosk/grosk_passive.webp?v=7' && run("KITS.grosk.purple.pass") === 'mirewall');
  ck('attack lands on cell 8, crit on cell 10 (relFrac = contact / 48)', G.attack.relFrac === 8 / 48 && G.crit.relFrac === 10 / 48);
  ck('walk plays its measured stride loop [1,45)', JSON.stringify(G.walk.loop) === '[1,45]');
  ck('blue and ult play in real time (every 2nd source frame at 12 fps)', G.blue.fps === 12 && G.ult.fps === 12 && G.blue.n === 48 && G.ult.n === 48);
  const kit = run('KITS.grosk.blue');
  ck('Hammer Fists numbers unchanged: 3 x 60% Attack, taunt 2 s, cd 6', kit.hits === 3 && kit.mul === 0.6 && kit.tauntChance === 1 && kit.tauntDur === 2 && kit.cd === 6);
  ck('Hammer Fists hitTimes = the measured full-extension cells 13/24/34 at 12 fps', JSON.stringify(kit.hitTimes) === '[1.083,2,2.833]');
  ck('Croc Drop numbers unchanged (40% own max HP, 3 m, stun 0.6, wall 30% for 5 s), leap = the 2 s clip airtime in fight seconds',
    run('JSON.stringify(ULT_DEF.hipposlam)') === '{"hpMul":0.1,"hpMul100":0.2,"aimRange":' + run('6*METER') + ',"radius":' + run('3*METER') + ',"stun":0.6,"allyDr":0.3,"allyDrDur":5,"perLv":0.0015,"leap":1.345}');   // perLv: v1112 skill levels (team wall 30% -> 44.9% at level 100)
  ck('cast times (fight s): ult 0.56 (launch cell 10 = 0.833 s of clip), green 0.308 (pull cell 11 = 0.458 s of clip), blue 0.6', run('JSON.stringify(ABILITY_CAST.grosk)') === '{"ult":0.56,"green":0.308,"blue":0.6}');
  const others = run(`(()=>{ const out=[]; const scan=(src,K)=>Object.keys(K).forEach(k=>{ if(k==='grosk')return; ['green','blue'].forEach(sl=>{ const a=K[k]&&K[k][sl]; if(a&&a.type==='punchflurry') out.push([src+':'+k, !!a.hitTimes]); }); });
    scan('hero',KITS); if(typeof MON_KITS!=='undefined') scan('mon',MON_KITS); return out; })()`);
  ck('every other punchflurry (Tick, monsters) keeps the instant flurry - no hitTimes', others.length > 0 && others.every(o => !o[1]), JSON.stringify(others));

  const PACE = run('SIM_STEP*SIM_HZ*BATTLE_PACE'), CLIP = [1.083, 2.0, 2.833], WANT = CLIP.map(t => t * PACE);
  const B = cast('blue', false), tol = B.step + 1e-6;
  ck('Hammer Fists: three punches', B.hits.length === 3, JSON.stringify(B.hits));
  ck('each punch lands at full extension: clip 1.083 / 2.000 / 2.833 s = fight ' + WANT.map(t => t.toFixed(3)).join(' / ') + ' s after the cast starts',
    B.hits.length === 3 && WANT.every((t, i) => Math.abs(B.hits[i].t - t) <= tol), JSON.stringify(B.hits.map(h => h.t)));
  ck('each punch is the same 60% hit', B.hits.length === 3 && B.hits.every(h => Math.abs(h.amt - B.hits[0].amt) < 1e-6) && B.hits[0].amt > 0);
  const C = cast('blue', true);
  ck('CONTROL: the old instant flurry (no hitTimes) lands all three at the cast end (' + C.ct + ' s)',
    C.hits.length === 3 && C.hits.every(h => Math.abs(h.t - C.ct) <= tol), JSON.stringify(C.hits.map(h => h.t)));
  ck('CONTROL differs from the timed punches (the timing check fails on the old code)',
    !(C.hits.length === 3 && WANT.every((t, i) => Math.abs(C.hits[i].t - t) <= tol)));

  const U = cast('ult', false);
  ck('Croc Drop: one slam on the dummy', U.hits.length === 1, JSON.stringify(U.hits));
  ck('the slam lands when his feet hit the ground (ult cell 34 = 2.833 s of clip = ' + (2.833 * PACE).toFixed(3) + ' fight s)', U.hits.length === 1 && Math.abs(U.hits[0].t - 2.833 * PACE) <= tol + 1e-3, JSON.stringify(U.hits));
  ck('slam damage unchanged: 40% of his own max HP', U.hits.length === 1 && U.hits[0].amt > 0 && U.hits[0].amt / U.maxHp >= 0.095 && U.hits[0].amt / U.maxHp <= 0.205   /* v1116: 10% (L1) -> 20% (L100); control: the old 40% is outside */, U.hits.length ? (U.hits[0].amt / U.maxHp) : '');
  ck('he no longer sets _airT on himself (it is never counted down and cut his own clip)', U.airMax === 0, 'airT ' + U.airMax);
  ck('his ult clip still holds him in the air at 1.6 fight s (the ult root, ultClipDur 4.0 s, still running; the old self-_airT cleared it at launch)', U.ultClipAt25 && U.ultClipAt25.root > 1, JSON.stringify(U.ultClipAt25));

  const ctl = JSON.parse(JSON.stringify(G)); ctl.crit.u = '/assets/anim/grosk/grosk_missing.webp?v=22'; ctl.walk.fw = 700;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
// v1117 (Phil 10 Oct: "please make his ult aimable, and a circle the size of the impact, with a 6 meter range circle")
{ const aimRun = (ax, ay) => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
    const u=makeUnit('grosk','ally',300,700,20,{owned:false}); const e=makeUnit('vael','enemy',300+20*METER,700,20,{owned:false});
    units=[u,e]; units.forEach(x=>{ x.atkInterval=99; x.speed=0; x.greenAb=null; x.blueAb=null; }); e.maxHp=e.hp=1e9;
    let land=null; const _d=dealDamage; dealDamage=function(a,b,amt){ return _d.apply(this,arguments); };
    const ab=Object.assign({},ULT_DEF.hipposlam); u._castSM=1; u._castLv=1; u._castSlot='ult';
    window._aimForTest={x:${ax},y:${ay}};
    try{ doEffect(u,'hipposlam',ab,null,{x:${ax},y:${ay}}); } catch(err){ return JSON.stringify({err:String(err)}); }
    const d=u._dash||{}; return JSON.stringify({tx:d.tx!=null?d.tx:(d.x2!=null?d.x2:null), ty:d.ty!=null?d.ty:(d.y2!=null?d.y2:null), ux:u.x, uy:u.y, keys:Object.keys(d)}); })()`));
  ck('Croc Drop is radius-aimed (ULT_RADIUS) with a 6 m aim range', run("ultAimMode('hipposlam')") === 'radius' && run('ULT_DEF.hipposlam.aimRange') === run('6*METER'));
  const H = require('fs').readFileSync(require('path').join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
  ck('the release clamps an aimRange ult to its range (the circle cannot leave the ring)', H.includes('/* v1116: aimRange - the circle cannot leave the range ring */'));
  ck('the aim view draws the range ring around the caster', H.includes('/* v1116: the range ring (Croc Drop 6 m) and the impact circle kept inside it */'));
  ck('the effect lands on the aimed point, clamped to aimRange; no aim -> densest cluster within range', H.includes("let _tx=aimCtr?aimCtr.x:best.x, _ty=aimCtr?aimCtr.y:best.y;") && H.includes('const _inR=_AR?foes.filter(c=>dist(u,c)<=_AR):foes'));
  ck('CONTROL: v1116 had no aimRange on Croc Drop', !/hipposlam:\{hpMul:0\.10,hpMul100:0\.20,radius/.test(H)); }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
