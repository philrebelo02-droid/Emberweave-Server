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
const spec = (key, level, stars, skill) => ({ key, level, stars: stars || 3, rank: 3, pips: 0, ref: 0, glyphRank: 0, tt: {}, ex: {}, fAtk: 0, fHp: 0, fApow: 0, apMul: 1, skillLv: [skill || 1, skill || 1, skill || 1, skill || 1] });
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

console.log('== 3. sleep: the table length (3.5 s), the cast lock ends on waking, waking ends only the sleep ==');
{ const sleepLen = (hero, type, slot, pre) => { setup([spec(hero, 40)], [spec('carn', 40)], 5, (a, b) => { a[0].ctrlRes = 0; b[0].ctrlRes = 0; });
    R(`__freeze(); window.A=U(${JSON.stringify(hero)}); window.B=U('carn'); A.x=500;A.y=900;B.x=500;B.y=500; A.target=B; A._castLv=40; A._castSM=1; A._castSlot=${JSON.stringify(slot)}; ${pre || ''}`);
    return J(`(function(){ const o=Object.assign({},${slot === 'ult' ? 'ULT_DEF[' + JSON.stringify(type) + ']' : 'KITS[' + JSON.stringify(hero) + '].' + slot}); o._tgtU=B; o._arrived=true; _doEffectCore(A,${JSON.stringify(type)},o); A._castSlot=null;
      let n=0,act=0,cast=0; while(n<600){ updateBattle(SIM_STEP); n++; if((B.stunned||0)>0) act=n; if((B._sleepT||0)>0) cast=n; } return {act:+(act*SIM_STEP).toFixed(2),cast:+(cast*SIM_STEP).toFixed(2)}; })()`); };
  const table = J('+(CC_SECONDS.sleep.single*CC_NERF).toFixed(2)');
  ok(table === 3.5, 'the control table sleep is 5.0 x 0.7 = 3.5 s');
  for (const [h, ty, sl, pre] of [['mirelle', 'sleepbouquet', 'blue'], ['dandra', 'drowsy', 'blue', 'B._stungT=5;'], ['lysara', 'quietwings', 'ult']]) {
    const r = sleepLen(h, ty, sl, pre);
    ok(Math.abs(r.act - 3.5) < 0.05, h + ' ' + ty + ': asleep (cannot act) 3.5 s (was 2.8 s, cut by the stun ceiling) - measured ' + r.act);
    ok(Math.abs(r.cast - r.act) < 0.05, h + ' ' + ty + ': cannot cast exactly as long as asleep (was 5.0 s, 2.2 s after waking) - ' + r.cast); }
  // the waking hit leaves a separate stun running
  setup([spec('quorrel', 30)], [spec('rhukk', 30)], 5, (a, b) => { b[0].ctrlRes = 0; });
  R('__freeze(); window.A=U("quorrel"); window.B=U("rhukk"); A._castLv=30; A.x=80;A.y=1330;B.x=930;B.y=90;');
  const w = J(`(function(){ ccApply(A,B,'stunned',3.5); const s0=B.stunned; A._castSlot='blue'; const o=Object.assign({},KITS.mirelle.blue); o._tgtU=B; o._arrived=true; _doEffectCore(A,'sleepbouquet',o); A._castSlot=null; const asleep=(B._sleepT||0)>0;
    for(let i=0;i<10;i++) updateBattle(SIM_STEP); const left=s0-10*SIM_STEP; dealDamage(A,B,10,'#fff','true'); return {asleep,left:+left.toFixed(3),stunned:+B.stunned.toFixed(3),sleepT:B._sleepT||0}; })()`);
  ok(w.asleep && w.sleepT === 0, 'a hit wakes the sleeper');
  ok(Math.abs(w.stunned - w.left) < 0.02, 'the hit that wakes it leaves the 2.45 s stun it also had running (' + w.stunned + ' s left; was 0)');
  const w2 = J(`(function(){ B.stunned=0; B._sleepT=0; B._stunNS=0; A._castSlot='blue'; const o=Object.assign({},KITS.mirelle.blue); o._tgtU=B; o._arrived=true; _doEffectCore(A,'sleepbouquet',o); A._castSlot=null; dealDamage(A,B,10,'#fff','true'); return {stunned:B.stunned,sleepT:B._sleepT}; })()`);
  ok(w2.stunned === 0 && w2.sleepT === 0, 'a sleep with no other stun: the waking hit frees the unit completely');
  // a real fight: Carn put to sleep by Mirelle casts again as soon as he is awake
  setup(['mirelle', 'rhukk'].map(k => spec(k, 40)), [spec('carn', 40)], 121, (a, b) => { a.concat(b).forEach(s => { s.ctrlRes = 0; }); });
  R(`autoUlt=false; units.forEach(u=>{ u.maxHp=1e9; u.hp=1e9; }); window.M=U('mirelle'); window.C=U('carn'); window.K=U('rhukk','ally'); K.atkCd=1e9; K.greenAb=null; K.blueAb=null; K.speed=0; M.atkCd=1e9; M.greenAb=null; M.blueCd=0; C.speed=0;
     C.x=500; C.y=600; K.x=500; K.y=600+bodyR(C)+bodyR(K)+5; M.x=500; M.y=950; C.blueAb=null; C.greenCd=99;
     window.__CS={starts:[],cancelled:0}; (function(){ const th=think; window.__thk=th; think=function(u,dt){ if(u!==C) return th.apply(this,arguments); const p0=u._pend; const r=th.apply(this,arguments); if(u._pend&&u._pend!==p0) __CS.starts.push(+battleTime.toFixed(2)); if(p0&&!u._pend&&!(p0.t<=0)) __CS.cancelled++; return r; }; })();`);
  const f = J(`(function(){ let slept=null,woke=null; for(let i=0;i<330;i++){ updateBattle(SIM_STEP); if((C._sleepT||0)>0&&slept==null){ slept=+battleTime.toFixed(2); C.greenCd=0; C.atkCd=0; } if(slept!=null&&woke==null&&!((C.stunned||0)>0)) woke=+battleTime.toFixed(2); } think=window.__thk; return {slept,woke,starts:__CS.starts,cancelled:__CS.cancelled}; })()`);
  ok(f.slept != null && f.woke - f.slept > 3.4 && f.woke - f.slept < 3.6, 'real fight: Mirelle\'s Soporific Bouquet holds Carn ' + (f.woke - f.slept).toFixed(2) + ' s');
  ok(f.starts.length > 0 && f.starts[0] >= f.woke && f.starts[0] - f.woke < 0.2 && f.cancelled === 0, 'real fight: Carn starts his cast ' + (f.starts[0] - f.woke).toFixed(2) + ' s after waking and it is not cancelled (was cancelled by the leftover 2.2 s lock)'); }

console.log(''); console.log('test_engine_fixes_1452.js: ' + pass + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : '')); if (fail) process.exitCode = 1;
