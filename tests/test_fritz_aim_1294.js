// v1294 (Phil 6 Nov: "Fritz ult is meant to be aimable" / "Also make it have a 6m radius"; a tester: "it does nothing or little damage").
// Thunder Shower is a player-aimed storm, 6 m radius, like Blizzard: it lands where the player aims (auto / no aim: on his target),
// not on Fritz. Measured before (v1293, self-centred 8 m): in real campaign fights the nearest enemy was 8.4-13 m away at the cast.
// Runs the live engine (server/sim-host.js). Control: EW_HTML=<the v1293 html> must FAIL.
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const h = require(path.join(ROOT, 'server/sim-host.js')).load(HTML);
const run = s => vm.runInContext(s, h.ctx);
let pass = 0, bad = [];
const ok = (c, m) => { if (c) pass++; else bad.push(m); console.log((c ? '  ok   ' : '  FAIL ') + m); };
// Fritz at x=600; enemies at the given metres to his right; aim (metres from Fritz) or none; returns damage per enemy over 5 s
const cast = (distsM, aimM, targetIdx) => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('fritz','ally',600,700,30,{owned:false,rank:3});
  const D=${JSON.stringify(distsM)};
  const E=D.map(m=>{ const e=makeUnit('korvux','enemy',600+m*METER,700,30,{owned:false}); e._px=e.x; e._py=e.y; return e; });
  units=[g].concat(E); units.forEach(u=>{ u.maxHp=u.hp=1e9; u.energy=0; });
  const park=()=>{ units.forEach(x=>{ x.atkCd=99; x.greenCd=x.blueCd=99; if(x!==g){ x.atkInterval=99; x.speed=0; x.x=x._px; x.y=x._py; } }); g.speed=0; g.atkCd=99; };
  park(); g.target=E[${targetIdx == null ? 0 : targetIdx}];
  const dmg=E.map(()=>0); const _dd=dealDamage; dealDamage=function(sr,t){ const i=E.indexOf(t); if(sr===g&&i>=0){ const b=t.hp; const r=_dd.apply(this,arguments); dmg[i]+=b-t.hp; return r; } return _dd.apply(this,arguments); };
  ${aimM == null ? 'g._aimWX=null; g._aimWY=null;' : `g._aimWX=600+${aimM}*METER; g._aimWY=700;`}
  g.energy=100; castAbility(g);
  for(let i=0;i<Math.round(5/SIM_STEP);i++){ updateBattle(SIM_STEP); park(); }
  dealDamage=_dd; return JSON.stringify({dmg:dmg.map(Math.round), R:ULT_DEF.thundershower.radius/METER});
})()`));
const src = fs.readFileSync(HTML, 'utf8');
// 1) aimed 15 m away: enemies around the aim point are hit, the ones near Fritz are not
const a = cast([2, 15, 22], 15);
ok(a.dmg[1] > 0 && a.dmg[0] === 0 && a.dmg[2] === 0, 'aimed 15 m out: the enemy at the aim point is hit (' + a.dmg[1] + '), the one 2 m from Fritz is not (' + a.dmg[0] + '), one 7 m past the aim is out (' + a.dmg[2] + ')');
// 2) radius 6 m: 5 m from the aim point is in, 7 m is out
const r = cast([10, 15, 22], 15);
ok(r.R === 6 && r.dmg[0] > 0 && r.dmg[1] > 0 && r.dmg[2] === 0, 'radius 6 m: 5 m from the centre is hit (' + r.dmg[0] + '), 7 m is not (' + r.dmg[2] + ')');
// 3) no aim (auto): the storm lands on his target, even 12 m away
const t = cast([12, 30], null, 0);
ok(t.dmg[0] > 0 && t.dmg[1] === 0, 'no aim: the storm lands on his target 12 m away (' + t.dmg[0] + ')');
// 4) the player gets the aiming circle and the auto-ult aims at the enemy cluster
ok(!/const _SELF_CENTRED=\{[^}]*\bthundershower:1/.test(src) && /const AUTO_GROUND_AOE=\{[^}]*\bthundershower:1/.test(src), 'aimable: not self-centred, and the auto-ult aims it like Blizzard');
ok(/thundershower:'Player-aimed ultimate/.test(src), 'the skill text says it is player-aimed');
if (process.env.EW_HTML) { console.log('CONTROL: ' + bad.length + ' check(s) failed as expected'); process.exit(bad.length ? 0 : 1); }
if (bad.length) { console.error('FAIL: ' + bad.join('; ')); process.exit(1); }
console.log('test_fritz_aim_1294.js: ' + pass + ' checks passed');
