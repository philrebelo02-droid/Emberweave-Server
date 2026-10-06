'use strict';
(function main() {
// v1044 KonWu (Phil 6 Oct 2026): "there is a couple heroes that are done please slice and wire" / "its similar to vex's hook" /
// "from now on it knocks back whoever he hits 8 meters, in the direction away from him" / "the knock back stuns the hero for 2 seconds,
// and kunwu runs to close the gap on them" / "at 1.5x speed" / "The cleave should be a 5 meter cone" / "45°".
// Runs the real battle engine (server/sim-host.js - the same file the server replays fights with) through updateBattle.
const path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };

// one Phantom Step, start to finish: KonWu vs the given foes; returns the timeline
const fight = (foes) => run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0;
  const k=makeUnit('konwu','ally',300,700,20,{owned:false}); const fs=${JSON.stringify(foes)}.map(f=>makeUnit(f[0],'enemy',f[1],f[2],20,{owned:false}));
  units=[k,...fs]; units.forEach(u=>{u.maxHp=u.hp=1e7;}); fs.forEach(f=>{f.atkInterval=99; f.speed=0;}); k.blueAb=KITS.konwu.blue; k.greenAb=null; k.blueCd=0; k.energy=0;
  const R={moveAt:null,kickAt:null,mark:null}; let prevKick=0, prevHp=null, chaseSteps=[], lockedOnMark=true;
  for(let i=0;i<Math.round(8/SIM_STEP);i++){ const px=k.x, py=k.y, chasing=(k._chaseT||0)>0;
    if(R.mark) prevHp=R.mark.hp;
    updateBattle(SIM_STEP); k.energy=0;
    if(R.moveAt==null && k._kickTg){ R.moveAt=battleTime; R.mark=k._kickTg; R.markKey=k._kickTg.key; R.d0=null; }
    if(R.moveAt!=null && R.kickAt==null && R.mark && R.mark.hp<prevHp){ R.kickAt=battleTime; R.dmg=prevHp-R.mark.hp; R.stun=R.mark.stunned; R.chaseMul=k._chaseMul; R.chaseT=k._chaseT; }
    if(R.kickAt!=null && R.mark && R.markPos==null){ R.markPos=[R.mark.x,R.mark.y]; }
    if(chasing && (k._chaseT||0)>0){ chaseSteps.push(Math.hypot(k.x-px,k.y-py)); if(k.target!==R.mark) lockedOnMark=false; }
  }
  const cs=chaseSteps.slice().sort((a,b)=>a-b); R.chaseStep=cs.length?cs[cs.length>>1]:0;   /* the median step: a body-separation shove can add to one */ R.walkStep=k.speed*MOVE_MUL*SIM_STEP; R.lockedOnMark=lockedOnMark; R.chaseN=chaseSteps.length;
  R.METER=METER; R.STEP=SIM_STEP; R.mark=null; return R; })()`);

try {
// 1) the full sequence against one foe
{ const R = fight([['grosk', 520, 700]]);
  ck('Phantom Step moves him behind the lowest-health foe', R.moveAt != null && R.markKey === 'grosk', JSON.stringify(R));
  ck('the dropkick lands 0.667 s after the move (the blue sheet\'s contact frame 64)', R.kickAt != null && Math.abs((R.kickAt - R.moveAt) - 0.667) <= R.STEP + 1e-9, 'gap ' + (R.kickAt - R.moveAt));
  ck('the dropkick deals damage', R.dmg > 0);
  ck('the mark is stunned by the kick', R.stun > 0, 'stun ' + R.stun);
  ck('KonWu runs it down at 1.5x his speed', R.chaseMul === 1.5 && R.chaseN > 0 && Math.abs(R.chaseStep / R.walkStep - 1.5) < 0.02, 'step ratio ' + (R.chaseStep / R.walkStep));
}
// 2) the knockback: 8 m straight away from him (measured directly on konwuKickExec, away from the field edges)
{ const r = run(`(()=>{ units=[]; const k=makeUnit('konwu','ally',500,700,20,{owned:false}); const g=makeUnit('grosk','enemy',530,740,20,{owned:false});
    units=[k,g]; units.forEach(u=>{u.maxHp=u.hp=1e7;}); const x0=g.x,y0=g.y;
    k._kickTg=g; k._kickO=KITS.konwu.blue; k._kickDmg=10; k._kickD0=dist(k,g); konwuKickExec(k);
    const dx=g.x-x0, dy=g.y-y0, along=(dx*(x0-k.x)+dy*(y0-k.y))/Math.hypot(x0-k.x,y0-k.y);
    return {moved:Math.hypot(dx,dy), along, M:METER, target:k.target===g, chase:k._chaseT}; })()`);
  ck('the kick knocks the mark back 8 m', Math.abs(r.moved - 8 * r.M) < 0.01, 'moved ' + r.moved + ' (8 m = ' + 8 * r.M + ')');
  ck('...in the direction away from KonWu', Math.abs(r.along - 8 * r.M) < 0.01, 'along ' + r.along);
  ck('...and he takes it as his target and starts the chase', r.target && r.chase > 0);
}
// 3) a closer second foe does not pull him off the chase
{ const R = fight([['grosk', 520, 700], ['brannus', 360, 760]]);
  ck('during the chase he stays on the kicked mark, not the nearest foe', R.kickAt != null && R.chaseN > 0 && R.lockedOnMark, JSON.stringify({ kickAt: R.kickAt, n: R.chaseN, lock: R.lockedOnMark }));
}
// 4) a mark that cannot be displaced is stunned but not moved
{ const r = run(`(()=>{ units=[]; const k=makeUnit('konwu','ally',500,700,20,{owned:false}); const g=makeUnit('grosk','enemy',530,700,20,{owned:false});
    units=[k,g]; units.forEach(u=>{u.maxHp=u.hp=1e7;}); g._gearImmovableT=3; const x0=g.x;
    k._kickTg=g; k._kickO=KITS.konwu.blue; k._kickDmg=10; k._kickD0=dist(k,g); konwuKickExec(k); return {dx:g.x-x0, stun:g.stunned}; })()`);
  ck('Hold Fast (displacement immunity) keeps the mark in place', r.dx === 0);
}
// 5) the monsters' blinks are untouched: they still strike on arrival, no kick, no knockback
{ const r = run(`(()=>{ units=[]; const m=makeUnit('konwu','ally',300,700,20,{owned:false}); const g=makeUnit('grosk','enemy',520,700,20,{owned:false});
    units=[m,g]; units.forEach(u=>{u.maxHp=u.hp=1e7;}); const h0=g.hp;
    m._blinkO={mul:1.8,range:20*METER}; konwuBlinkExec(m); return {dmg:h0-g.hp, kick:m._kickT||0, stun:g.stunned||0}; })()`);
  ck('a blink without a kick (Blink Shift, Gloam Step, Rift Bite, Mirage Current) still hits at once', r.dmg > 0 && r.kick === 0 && r.stun === 0, JSON.stringify(r));
}
// 6) data: the cleave, the kit, the sheet
{ const r = run(`({g:KITS.konwu.green, b:KITS.konwu.blue, A:BATTLE_ANIM.konwu, M:METER})`);
  ck('Cleaving Arc is a 5 m cone, 45 degrees wide', r.g.radius === 5 * r.M && r.g.angle === 45 && r.g.type === 'cleavecone');
  ck('Phantom Step: 8 m knockback, 2 s stun (control table), 1.5x chase', r.b.knock === 8 * r.M && r.b.stun === 2 && r.b.chase === 1.5 && r.b.kick === 0.667);
  ck('the blue sheet\'s contact frame matches the kick time (48 + 0.667 x 24 = frame 64)', r.A.blue.blink && r.A.blue.blink.move === 48 && Math.round(r.A.blue.blink.move + r.b.kick * r.A.blue.fps) === 64);
  ck('all eight states are the v1044 sheets, facing right, with a crit and no passive', ['idle', 'walk', 'attack', 'crit', 'hit', 'green', 'blue', 'ult'].every(s => r.A[s] && /\?v=30$/.test(r.A[s].u) && r.A[s].flip === false) && !r.A.passive);
}
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
