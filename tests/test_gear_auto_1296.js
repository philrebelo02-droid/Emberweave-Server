// v1296 (Phil 6 Nov: "Equipment doesnt auto activate when someone has auto on"): with AUTO on, an ally's gear active fires by itself
// (from 2.5 s); with AUTO off it stays the player's button; a "below X% health" item waits until the hero is below it.
// Runs the live engine (server/sim-host.js). Control: EW_HTML=<the v1295 html> must FAIL.
const path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const h = require(path.join(ROOT, 'server/sim-host.js')).load(HTML);
const run = s => vm.runInContext(s, h.ctx);
let pass = 0, bad = [];
const ok = (c, m) => { if (c) pass++; else bad.push(m); console.log((c ? '  ok   ' : '  FAIL ') + m); };
// one ally with a gear active vs one enemy; returns when (s) the active was used, or null
const fight = (auto, params, hpFracAt) => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const a=makeUnit('korvux','ally',600,700,30,{owned:false,rank:3}); const e=makeUnit('korvux','enemy',600+3*METER,700,30,{owned:false});
  units=[a,e]; units.forEach(u=>{ u.maxHp=u.hp=1e9; u.energy=0; });
  a.gearSkill={used:false,name:'Test Item',type:'dmg',params:${JSON.stringify(params)},defId:'x'};
  autoUlt=${auto};
  let at=null;
  for(let i=0;i<Math.round(8/SIM_STEP);i++){
    ${hpFracAt ? `if(battleTime>=${hpFracAt[0]}) a.hp=a.maxHp*${hpFracAt[1]};` : ''}
    units.forEach(x=>{ x.atkCd=99; x.greenCd=x.blueCd=99; x.energy=0; x.speed=0; });
    updateBattle(SIM_STEP); if(at==null&&a.gearSkill.used) at=+battleTime.toFixed(2); }
  autoUlt=false; return JSON.stringify({at});
})()`));
const on = fight(true, { target: 'near', mult: 2 });
ok(on.at != null && on.at >= 2.4 && on.at <= 3, 'AUTO on: the gear active fires by itself at ' + on.at + ' s');
const off = fight(false, { target: 'near', mult: 2 });
ok(off.at == null, 'AUTO off: the gear active waits for the player (' + off.at + ')');
const low = fight(true, { target: 'near', mult: 2, ifBelow: 0.35 }, [5, 0.3]);
ok(low.at != null && low.at >= 5, '"below 35% health" item on AUTO waits until the hero drops below it (fired at ' + low.at + ' s, dropped at 5 s)');
if (process.env.EW_HTML) { console.log('CONTROL: ' + bad.length + ' check(s) failed as expected'); process.exit(bad.length ? 0 : 1); }
if (bad.length) { console.error('FAIL: ' + bad.join('; ')); process.exit(1); }
console.log('test_gear_auto_1296.js: ' + pass + ' checks passed');
