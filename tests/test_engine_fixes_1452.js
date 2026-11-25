// v1452 lockdown audit 25 Nov 2026 (Battle Engine > core rules): twelve engine bugs fixed so each rule works as
// the design (Mechanics blueprints/18 - Battle Engine.md and the hero pages) says. Every check runs the page's own
// battle code headless through server/sim-host.js (the same engine the server replays fights with), plus a few
// static checks on the page. Exit 0 = all passed.
// CONTROL: EF_HTML=<the v1451 page> fails (each section was run against it before the fix; numbers in the commit messages).
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const HTML = process.env.EF_HTML || path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(HTML, 'utf8');
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const ctx = host.ctx;
let pass = 0, fail = 0; const SOFT = !!process.env.EF_SOFT;   // EF_SOFT=1: list every failing check instead of stopping at the first (for the control run)
const ok = (c, m) => { if (!c && SOFT) { fail++; console.log('  FAIL ' + m); return; } assert(c, m); pass++; console.log('  ok   ' + m); };
const R = s => vm.runInContext(s, ctx);
const J = s => JSON.parse(R('JSON.stringify(' + s + ')'));
// a fight built the way the server replay builds it (clip data on every unit, as buildFigure does headless)
R(`window.__setup=function(al,fo,seed){ ended=false; state='battle'; CUR={mode:'replay',seed,manualReplay:false}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true;
  try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0;
  window._p2guard=true; seedBattle(seed); setupMarchTeams(al,fo,false); units.forEach(u=>{ u.anim=BATTLE_ANIM[u.key]||null; }); ddReset(); return units.length; };
window.__step=function(n){ for(let i=0;i<n&&!ended;i++) updateBattle(SIM_STEP); return battleTime; };
window.U=function(k,team){ return units.find(x=>x.key===k&&(!team||x.team===team)); };
window.__freeze=function(){ autoUlt=false; units.forEach(u=>{ u.speed=0; u.atkCd=1e9; u.greenAb=null; u.blueAb=null; u.energy=0; u.gearSkill=null; u.ctrlRes=0; u.maxHp=1e9; u.hp=1e9; }); };`);
const spec = (key, level, stars, skill) => ({ key, level, stars: stars || 3, pips: 0, ref: 0, glyphRank: 0, tt: {}, ex: {}, fAtk: 0, fHp: 0, fApow: 0, apMul: 1, skillLv: [skill || 1, skill || 1, skill || 1, skill || 1] });
const setup = (A, B, seed, mut) => { const a = JSON.parse(JSON.stringify(host.snapFromSpecs(A))), b = JSON.parse(JSON.stringify(host.snapFromSpecs(B))); if (mut) mut(a, b);
  return R('window.__setup(' + JSON.stringify(a) + ',' + JSON.stringify(b) + ',' + (seed | 0) + ')'); };
const S = s => R(s);

console.log('== 1. magic tanks never crit with a basic attack (Joss, Ambrel had crit clips that re-rolled it) ==');
{ R(`window.__C=null; (function(){ const dd=dealDamage; dealDamage=function(src,tgt,amt,color,kind,silent){ const C=window.__C; if(!C||!src) return dd.apply(this,arguments); const auto=!!_autoAtk; if(tgt) tgt._critHit=false; const h0=tgt?tgt.hp:0, s0=tgt?tgt.shield:0; const r=dd.apply(this,arguments);
    const k=src.key+'|'+(auto?'auto':'spell'); const E=C[k]||(C[k]={n:0,crit:0}); if(tgt&&(tgt.hp!==h0||tgt.shield!==s0||tgt._critHit)){ E.n++; if(tgt._critHit) E.crit++; } return r; }; })()`);
  const C = {};
  for (const seed of [61, 62]) { R('window.__C={}'); setup(['bloatus', 'joss', 'ambrel', 'meridian', 'vex'].map(k => spec(k, 40)), ['grosk', 'hurne', 'fritz', 'vireo', 'rhukk'].map(k => spec(k, 40)), seed, a => a.forEach(s => { if (['bloatus', 'joss', 'ambrel', 'meridian'].includes(s.key)) s.glyphCrit = 0.5; }));
    R('window.__step(Math.round(60/SIM_STEP))'); for (const [k, v] of Object.entries(J('window.__C'))) { const c = C[k] || (C[k] = { n: 0, crit: 0 }); c.n += v.n; c.crit += v.crit; } }
  R('window.__C=null');
  ok(J("!!(BATTLE_ANIM.joss&&BATTLE_ANIM.joss.crit)&&!!(BATTLE_ANIM.ambrel&&BATTLE_ANIM.ambrel.crit)"), 'Joss and Ambrel carry a crit clip (the path that broke the rule)');
  for (const k of ['bloatus', 'joss', 'ambrel']) {
    ok(C[k + '|auto'] && C[k + '|auto'].n >= 15 && C[k + '|auto'].crit === 0, k + ' at 50% crit: 0 critical basic attacks of ' + (C[k + '|auto'] || {}).n);
    ok(C[k + '|spell'] && C[k + '|spell'].crit > 0, k + "'s spells still crit (" + C[k + '|spell'].crit + ' of ' + C[k + '|spell'].n + ')'); }
  ok(C['meridian|auto'].crit > 0, 'CONTROL: an Attack hero (Meridian, also 50%) still crits on autos (' + C['meridian|auto'].crit + ' of ' + C['meridian|auto'].n + ')'); }

console.log('== 2. lifesteal heals off the health actually removed, never overkill ==');
{ setup([spec('meridian', 30)], [spec('rhukk', 30)], 77);
  R(`window.__eM=elemMul; window.__cE=classEdge; elemMul=function(){return 1;}; classEdge=function(){return '';}; window.Sx=U('meridian','ally'); window.Tx=U('rhukk','enemy');
  window.__ls=function(pre){ for(const u of [Sx,Tx]){ u.pass=null; u._tal=null; u._talW=null; u._bn=null; u.shield=0; u.glyphDR=0; u.drT=0; u.drMul=1; u.evaStat=0; u.blockStat=0; u.critRes=0; u.defenseStat=0; u.glyphCrit=0; u.lifestealStat=0; u.armorRating=0; u.mrRating=0; u._lifestealT=0; u._gearVampT=0; u._sleepT=0; u.stunned=0; u.dots=[]; u.alive=true; u._wardT=0; }
    Tx.maxHp=1e9; Tx.hp=1e9; Sx.maxHp=1e9; Sx.hp=5e8; _preCrit=null; _autoAtk=0; Sx.lifestealStat=0.2; eval(pre); const s0=Sx.hp; dealDamage(Sx,Tx,1000,'#fff','true'); return +(Sx.hp-s0).toFixed(3); };`);
  ok(J("__ls('')") === 200, '1000 damage at 20% lifesteal heals 200');
  ok(J("__ls('Tx.shield=600')") === 80, 'through a 600 shield (400 health removed) heals 80');
  ok(J("__ls('Tx.hp=300')") === 60, 'killing blow of 1000 on a 300 HP enemy heals 60 (was 200)');
  ok(J("__ls('Sx.lifestealStat=0; Sx._lifestealT=5; Sx._lifestealPct=0.25; Tx.hp=300')") === 75, 'timed lifesteal 25% on the same killing blow heals 75 (was 250)');
  ok(J("__ls('Sx.lifestealStat=0; Sx._gearVampT=5; Sx._gearVampPct=0.3; Tx.hp=300')") === 90, 'gear vamp 30% on the same killing blow heals 90');
  R('elemMul=window.__eM; classEdge=window.__cE;'); }

console.log(''); console.log('test_engine_fixes_1452.js: ' + pass + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : '')); if (fail) process.exitCode = 1;
