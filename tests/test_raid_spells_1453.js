// v1453 (Phil 25 Nov 2026, after a level 73-74 tester could not kill guild raid boss 1): "yea why would the bosses be that tanky" /
// "just raise its spell power" / "not flat damage" / "magical beasts should do their damage with spells" / "2 attacks a day" /
// "i never said remove armor" - "i meant lessen it".
// Proves, headless, the way the server runs the raid (server/sim-host.js):
//   1. the raid boss spec's spellMul multiplies EVERY spell he casts - direct hits (Frost Nova) and ground spells (Blizzard) - and never
//      his basic attacks;
//   2. without spellMul (every other mode) nothing changes;
//   3. the server sends spellMul with all three raid boss specs, the hide is a third of the old 30,000, and there are 2 attempts a day.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
const srv = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

const host = require(path.join(root, 'server/sim-host.js')).load(path.join(root, 'emberweave-heroes.html'));
const X = code => vm.runInContext(code, host.ctx);
// record every hit the boss lands, by what landed it (his basic attack, or a spell slot)
X(`DD.force=true; window.__bh=null; const __dd0=dealDamage; dealDamage=function(src,tgt,amt){ if(window.__bh&&src&&src.boss&&src.team!=='ally'&&tgt&&amt>0){
     const k=window.__inSpell?'spell':'auto'; const e=window.__bh[k]||(window.__bh[k]={n:0,sum:0}); e.n++; e.sum+=amt; } return __dd0.apply(this,arguments); };
   window.__inSpell=false; const __de0=doEffect; doEffect=function(u){ const was=window.__inSpell; if(u&&u.boss&&u.team!=='ally') window.__inSpell=true; try{ return __de0.apply(this,arguments); } finally{ window.__inSpell=was; } };
   const __ub0=updateBattle; updateBattle=function(){ if(window.__bh){ const B=units.find(u=>u.boss&&u.team!=='ally'&&u.alive); if(B) units.forEach(u=>{ if(u.team==='ally'&&u.alive){ u.x=B.x+(u.uid%3-1)*METER*0.5; u.y=B.y+METER*0.5; } }); } return __ub0.apply(this,arguments); };   // hold the squad at his feet, so Frost Nova (around himself) lands
   window.__gh=0; const __hz=groundHazards.push.bind(groundHazards); groundHazards.push=function(h){ if(h&&h.src&&h.src.boss&&h.src.team!=='ally') window.__gh=Math.max(window.__gh,h.dmg||0); return __hz.apply(null,arguments); };`);
const TEAM = ['gruel', 'tharl', 'rhukk', 'hobb', 'grosk'];   // melee, so his Frost Nova (around himself) lands
const tough = () => host.snapSquad(TEAM).map(s => Object.assign(s, { maxHp: 1e9, hp: 1e9 }));
function run(spellMul) {
  X('window.__bh={}; window.__gh=0;');
  const boss = { key: 'wintercrag', lvl: 15, hp: 2e9, def: 0, dmgMul: 1, tier: 1 };
  if (spellMul) boss.spellMul = spellMul;
  host.raid(tough(), boss, 5, []);
  return { hits: JSON.parse(X('JSON.stringify(window.__bh)')), ground: X('window.__gh') };
}
const per = (r, k) => (r.hits[k] && r.hits[k].n) ? r.hits[k].sum / r.hits[k].n : 0;
const a = run(0), b = run(30);
ok(per(a, 'auto') > 0 && Math.abs(per(b, 'auto') - per(a, 'auto')) < 1e-6 * per(a, 'auto') + 1e-9,
  'his basic attacks are unchanged by spellMul (' + per(a, 'auto').toFixed(1) + ' vs ' + per(b, 'auto').toFixed(1) + ' a hit)');
ok(per(a, 'spell') > 0 && per(b, 'spell') > per(a, 'spell') * 20,
  'his direct spell (Frost Nova) hits about 30x harder (' + per(a, 'spell').toFixed(1) + ' -> ' + per(b, 'spell').toFixed(1) + ' a hit)');
ok(a.ground > 0 && b.ground > a.ground * 29 && b.ground < a.ground * 31,
  'his ground spell (Blizzard) ticks 30x harder (' + a.ground.toFixed(1) + ' -> ' + b.ground.toFixed(1) + ' a tick)');
const c = run(0);
ok(Math.abs(per(c, 'spell') - per(a, 'spell')) < 1e-9 && Math.abs(c.ground - a.ground) < 1e-9, 'no spellMul (every other mode): the boss is exactly as before');

ok(/if\(\+m\.spellMul>0\) u\._spellMul=\+m\.spellMul;/.test(html), 'campEnemyUnit reads the spec\'s spellMul');
ok((html.match(/spellMul:\(\+B\.spellMul>0\?\+B\.spellMul:1\)\}\]\],/g) || []).length === 2, 'the live raid fight and the headless replay both pass spellMul to the boss');
ok((srv.match(/spellMul:raidSpellMul\((open\.bossKey,open\.tier|bb\.key,rr\.level|a\.bossKey,a\.tier\|\|1)\)\}/g) || []).length === 3, 'the server sends spellMul with all three raid boss specs (fight start, rejoin, replay check)');
{ const m = srv.match(/const RAID_SPELL_MUL=(\{[^}]*\});/); let M = null; try { M = m && (new Function('return ' + m[1]))(); } catch (e) {}
  ok(!!M && Object.keys(M).length === 20 && M.wintercrag === 36 && Object.values(M).every(v => v >= 5 && v <= 150), 'every one of the 20 raid bosses has his own spell power (boss 1 x36, all between x5 and x150)'); }
ok(/const bossHide=lvl=>Math\.round\(10000\*Math\.pow\(1\.12,\(lvl\|\|1\)-1\)\);/.test(srv), 'the hide is lowered to a third (10,000 at boss 1), not removed');
ok(/const RAID_ATT=2;/.test(srv), '2 raid attempts a day');

{ const m = srv.match(/const RAID_SPELL_TIER=(\[[^\]]*\]);/); const A = m ? JSON.parse(m[1]) : null;
  ok(!!A && A.length === 40 && A.every(v => v > 0 && v <= 1), 'a per-tier spell factor for all 40 tiers, never above 1 (' + (A && A.join(',')) + ')'); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
