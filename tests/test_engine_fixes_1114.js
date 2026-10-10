'use strict';
// v1114 (Phil 10 Oct 2026: "Fix the easy ones now") - three engine bugs found by the v1112 skill audit and the Grosk work:
//   1. Bone Chant (chantzone) and Mellan's Hornet Cloud (hornetswarm) applied the skill level twice (apB already carries sm);
//   2. the dodge-and-counter blues countered off Attack for every hero - Magic heroes (Veyr, Vaelora) now counter off Ability Power;
//   3. _airT (knock-up / knockback) was never counted down - a unit knocked back once stayed airborne (hard CC) all fight.
// Runs the real battle engine (server/sim-host.js). One line per check; exit code = number of failures.
const path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);
const setup = (key, foe) => `units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
  const u=makeUnit('${key}','ally',300,700,20,{owned:false}), e=makeUnit('${foe || 'grosk'}','enemy',420,700,20,{owned:false});
  units=[u,e]; units.forEach(x=>{ x.atkInterval=99; x.speed=0; x.greenAb=null; x.blueAb=null; x.energy=0; }); e.maxHp=e.hp=1e9;`;

// 1. chantzone at level 50: the hazard's tick damage = apB x dps, apB = apow x sm (once)
{ const r = JSON.parse(run(`(()=>{ ${setup('boar shaman')}
    const ab=Object.assign({},MONSTER_KITS['boar shaman'].green); delete ab.deliver; u._castSM=skillMul(50); u._castLv=50; u._castSlot='green';
    doEffect(u,'chantzone',ab); const h=groundHazards.find(z=>z.chant); u._castSM=1;
    return JSON.stringify({dmg:h&&h.dmg, heal:h&&h.heal, apow:u.apow, sm:skillMul(50), dps:ab.dps, hps:ab.hps}); })()`));
  const once = r.apow * r.sm * r.dps, twice = once * r.sm;
  ck('Bone Chant at level 50: tick damage = Ability Power x level x 0.35 once (' + Math.round(r.dmg) + ')', near(r.dmg, once, 1e-6), JSON.stringify(r));
  ck('Bone Chant heal = Ability Power x level x 0.6 once', near(r.heal, r.apow * r.sm * r.hps, 1e-6));
  ck('CONTROL: the old double level (' + Math.round(twice) + ') differs', !near(r.dmg, twice, 1e-3)); }
// hornetswarm: the dps handed to the swarm
{ const r = JSON.parse(run(`(()=>{ ${setup('mellan')}
    let got=null; const _orig=spawnHornetSwarm; spawnHornetSwarm=function(u,x,y,R,o){ got=o.dps; };
    const ab=Object.assign({},KITS.mellan.green); delete ab.deliver; u._castSM=skillMul(50); u._castLv=50; u._castSlot='green';
    try{ doEffect(u,'hornetswarm',ab); } finally { spawnHornetSwarm=_orig; u._castSM=1; }
    const _m=heroScaleMode(u), base=(_m==='ad')?u.dmg:(u.apow||0);
    return JSON.stringify({dps:got, base:base, sm:skillMul(50), mul:ab.dps}); })()`));
  ck('Hornet Cloud at level 50: swarm dps = stat x level x 0.42 once (' + Math.round(r.dps) + ')', near(r.dps, r.base * r.sm * r.mul, 1e-6), JSON.stringify(r));
  ck('CONTROL: the old double level differs', !near(r.dps, r.base * r.sm * r.sm * r.mul, 1e-3)); }

// 2. evade counter: a Magic hero counters off Ability Power (magic), an Attack hero off Attack
const counter = key => JSON.parse(run(`(()=>{ ${setup(key, 'vael')}
  u._evadeT=2; u._evadeMul=2; let hit=null; const _d=dealDamage, _f=dealFrostDamage;
  dealDamage=function(a,b,amt,c,kind){ if(a===u&&b===e) hit={amt,kind}; return _d.apply(this,arguments); };
  dealFrostDamage=function(a,b,amt){ if(a===u&&b===e) hit={amt,kind:'magic'}; return _f.apply(this,arguments); };
  try{ dealDamage(e,u,10); } finally { dealDamage=_d; dealFrostDamage=_f; }
  return JSON.stringify({hit, apow:u.apow, dmg:u.dmg, mode:heroScaleMode(u)}); })()`));
{ const v = counter('vaelora'), k = counter('kharos');
  ck('Vaelora (Mage) counters off Ability Power: ' + Math.round(v.hit && v.hit.amt) + ' = ' + v.apow + ' x 2 (was ' + v.dmg + ' x 2)', v.hit && near(v.hit.amt, v.apow * 2, 1e-6) && v.hit.kind === 'magic', JSON.stringify(v));
  ck('Kharos (Attack) still counters off Attack', k.hit && near(k.hit.amt, k.dmg * 2, 1e-6), JSON.stringify(k));
  ck('CONTROL: the old Attack counter for Vaelora differs', v.apow !== v.dmg); }

// 3. airborne counts down
{ const r = JSON.parse(run(`(()=>{ ${setup('vael')} e._airT=0.35; for(let i=0;i<60;i++) updateBattle(SIM_STEP); return JSON.stringify({air:e._airT||0, t:battleTime}); })()`));
  ck('a knocked-back unit is airborne 0.35 s, then lands (after ' + (+r.t).toFixed(2) + ' s: ' + r.air + ')', r.air === 0, JSON.stringify(r)); }
{ const H = require('fs').readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
  ck('the countdown sits with the other per-unit timers', H.includes('if((u._airT||0)>0){ u._airT=Math.max(0,u._airT-dt); }')); }

console.log('test_engine_fixes_1114.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail);
