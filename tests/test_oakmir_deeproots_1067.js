'use strict';
(function main() {
// v1067 Oakmir - Deep Roots (Phil 8 Oct 2026): "oakmir should have his own not share another" (he carried Aureth's Twin Fonts) /
// "when an ally falls below 30% health, roots wrap them and heal X% of their max health over Y seconds. Once per ally per fight" /
// "go with 25% over 4 seconds". Runs the real battle engine (server/sim-host.js - the file the server replays fights with).
const path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };

// Oakmir + one ally; the ally is put at a set health, nothing deals damage; returns the ally's health over 6 s
const fight = (withOakmir, startFrac, dropAgainAt) => run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0;
  const o=makeUnit('oakmir','ally',200,700,20,{owned:false}), a=makeUnit('vael','ally',260,700,20,{owned:false}), e=makeUnit('grosk','enemy',900,700,20,{owned:false});
  units=[a,e].concat(${withOakmir}?[o]:[]);
  units.forEach(u=>{ u.atkInterval=99; u.speed=0; u.greenAb=null; u.blueAb=null; u.energy=0; });
  o.pass={deeproots:true}; o.passMul=1; a.pass=a.pass||null; e.maxHp=e.hp=1e9;
  a.hp=a.maxHp*${startFrac}; const h0=a.hp, mx=a.maxHp; const trace=[];
  for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); units.forEach(u=>u.energy=0);
    if(${dropAgainAt}>0 && Math.abs(battleTime-${dropAgainAt})<SIM_STEP/2) a.hp=a.maxHp*0.10;
    trace.push([+battleTime.toFixed(3), a.hp]); }
  return {h0, mx, trace, used:!!a._drUsed, rooted:a._drBy===o, MAXHP:a.maxHp}; })()`);

try {
  { const R = fight(true, 0.20, 0);
    const at = t => R.trace.find(x => x[0] >= t - 1e-9)[1];
    const gain4 = at(4.0) - R.h0;
    ck('an ally below 30% is rooted (once-per-fight flag set, Oakmir owns the heal)', R.used && R.rooted, JSON.stringify({ used: R.used, rooted: R.rooted }));
    ck('the roots heal 25% of max health over 4 s', Math.abs(gain4 - 0.25 * R.mx) <= 0.02 * R.mx, 'healed ' + (gain4 / R.mx * 100).toFixed(2) + '%');
    ck('the heal is spread over the 4 s (about half by 2 s)', Math.abs((at(2.0) - R.h0) / R.mx - 0.125) <= 0.02, ((at(2.0) - R.h0) / R.mx * 100).toFixed(2) + '% at 2 s');
    ck('no more healing after the 4 s', Math.abs(at(5.5) - at(4.2)) <= 0.001 * R.mx, (at(5.5) - at(4.2)).toFixed(1));
  }
  { const R = fight(true, 0.20, 4.5);
    const after = R.trace.filter(x => x[0] > 4.6);
    ck('once per ally per fight: a second drop below 30% gets no second roots', Math.abs(after[after.length - 1][1] - 0.10 * R.MAXHP) <= 0.001 * R.MAXHP, 'end ' + (after[after.length - 1][1] / R.MAXHP * 100).toFixed(2) + '%');
  }
  { const R = fight(true, 0.50, 0);
    ck('an ally at 50% is not rooted', !R.used && Math.abs(R.trace[R.trace.length - 1][1] - R.h0) <= 0.001 * R.mx);
  }
  { const R = fight(false, 0.20, 0);
    ck('CONTROL: without Oakmir the same ally at 20% gets no heal', !R.used && Math.abs(R.trace[R.trace.length - 1][1] - R.h0) <= 0.001 * R.mx);
  }
  const k = run(`({p:KITS.oakmir.purple, a:KITS.aureth.purple, d:PASS_DESC.deeproots})`);
  ck('Oakmir\'s passive is Deep Roots; Aureth keeps Twin Fonts', k.p.pass === 'deeproots' && k.p.name === 'Deep Roots' && k.a.pass === 'twinfonts', JSON.stringify(k));
  ck('Deep Roots has its description', /30%/.test(k.d || '') && /25%/.test(k.d || '') && /4 seconds/.test(k.d || ''));
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log((fail ? 'FAIL' : 'PASS') + ': ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
