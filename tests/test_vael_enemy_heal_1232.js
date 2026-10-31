'use strict';
// v1232 (Phil 31 Oct 2026: "put the heal to 5%"): a CAMPAIGN-ENEMY Vael's Last Stand heals 5% of his max HP (+ the kit's 0.1 pt a level);
// a player's Vael (and any Vael not spawned from a stage's authored waves) keeps 15%. The v1229 Bloodthirst enemyCd (10 s) is unchanged.
// Runs the real battle engine (server/sim-host.js loads emberweave-heroes.html headless, the file the server replays fights with).
// CONTROL: the same cast with campaignHero off heals 15% - the probe measures the heal, not a constant. Exit code = failures.
const path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const near = (a, b) => Math.abs(a - b) <= 1e-6;
// cast Last Stand at a skill level on a Vael at 10% HP; returns the share of max HP healed by the cast
const healShare = (team, campaignHero, lv) => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0;
  const u=makeUnit('vael','${team}',300,700,20,{owned:false,campaignHero:${campaignHero}}), e=makeUnit('grosk','${team === 'ally' ? 'enemy' : 'ally'}',420,700,20,{owned:false});
  units=[u,e]; units.forEach(x=>{ x.atkInterval=99; x.speed=0; x.greenAb=null; x.blueAb=null; x.energy=0; });
  u.hp=u.maxHp*0.1; const h0=u.hp; u.skillLv=[${lv},${lv},${lv},${lv}];
  u._castSM=skillMul(${lv}); u._castLv=${lv}; u._castSlot='ult';
  doEffect(u,'laststand',Object.assign({},ULT_DEF.laststand));
  return JSON.stringify((u.hp-h0)/u.maxHp); })()`));
const kit = JSON.parse(run('JSON.stringify({ls:ULT_DEF.laststand,bt:KITS.vael.blue})'));
ck('ULT_DEF.laststand: heal 0.15, enemyHeal 0.05, perLv 0.001', kit.ls.heal === 0.15 && kit.ls.enemyHeal === 0.05 && kit.ls.perLv === 0.001, JSON.stringify(kit.ls));
ck('Bloodthirst keeps cd 7 / enemyCd 10', kit.bt.cd === 7 && kit.bt.enemyCd === 10, JSON.stringify({ cd: kit.bt.cd, enemyCd: kit.bt.enemyCd }));
for (const lv of [1, 50]) {
  const g = 0.001 * (lv - 1);
  const enemy = healShare('enemy', true, lv), player = healShare('ally', false, lv), enemyNotCampaign = healShare('enemy', false, lv);
  ck('lv ' + lv + ': campaign-enemy Vael heals ' + (5 + g * 100).toFixed(1) + '%', near(enemy, 0.05 + g), enemy);
  ck('lv ' + lv + ': player Vael heals ' + (15 + g * 100).toFixed(1) + '% (unchanged)', near(player, 0.15 + g), player);
  ck('lv ' + lv + ': CONTROL enemy Vael not from the authored waves (Arena opponent) heals 15%', near(enemyNotCampaign, 0.15 + g), enemyNotCampaign);
}
// the spawn path: a campaign wave hero is created with campaignHero (v1229) - the flag reaches the unit
ck('makeUnit keeps campaignHero on the unit', run(`makeUnit('vael','enemy',0,0,20,{campaignHero:true})._campaignHero===true && makeUnit('vael','ally',0,0,20,{})._campaignHero===false`));
console.log('test_vael_enemy_heal_1232.js: ' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail;
