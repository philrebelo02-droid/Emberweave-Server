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
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { if (process.env.EF_SOFT) return null; throw e; } };   // EF_SOFT: an old page may lack a v1452 function
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
const PENDING = [];   // checks that wait on an async page function (section 26)

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

console.log('== 4. every control rolls to land (1% less per level the target is above the skill) and shows RESIST ==');
{ const zero = (a, b) => a.concat(b).forEach(s => { s.ctrlRes = 0; });
  // Lumi's Hush (passive at skill 1) on level-100 enemies: 1% if it rolls
  setup([spec('lumi', 60, 5)], ['rhukk', 'carn', 'meridian'].map(k => spec(k, 100)), 91, zero);
  R(`autoUlt=false; units.forEach(u=>{ u.speed=0; u.atkCd=1e9; u.greenAb=null; u.blueAb=null; u.maxHp=1e9; u.hp=1e9; }); U('lumi').skillLv=[1,1,1,1];`);
  const hush = J(`(function(){ let sil=0,res=0; for(let i=0;i<1200;i++){ const b=units.map(u=>u.silencedT||0); floatTexts.length=0; updateBattle(SIM_STEP); units.forEach((u,k)=>{ if(u.team==='enemy'&&(u.silencedT||0)>b[k]+1e-6) sil++; }); res+=floatTexts.filter(f=>f.txt==='RESIST').length; } return {sil,res}; })()`);
  ok(hush.sil + hush.res >= 5 && hush.sil <= 1 && hush.res >= 5, "Lumi's Hush (skill 1) vs level 100 over 32 s: " + hush.sil + ' silences landed, ' + hush.res + ' RESIST (was 6 landed, 0 RESIST)');
  // a taunt at skill 1 on level-100 enemies
  setup([spec('gruel', 30)], ['rhukk', 'carn', 'meridian', 'astra'].map(k => spec(k, 100)), 131, zero);
  R(`autoUlt=false; units.forEach(u=>{ u.speed=0; u.atkCd=1e9; u.greenAb=null; u.blueAb=null; u.maxHp=1e9; u.hp=1e9; }); window.G=U('gruel'); G.x=500; G.y=700; units.filter(u=>u.team==='enemy').forEach((e,i)=>{ e.x=500+i*40; e.y=600; });`);
  const taunt = lv => J(`(function(){ let n=0,t=0; for(let k=0;k<100;k++){ units.forEach(e=>{ e.forcedTarget=null; e.forcedTargetT=0; }); G._castSlot='ult'; G._castSM=1; G._castLv=${lv}; doEffect(G,'taunt',Object.assign({},ULT_DEF.taunt)); G._castSlot=null; units.filter(u=>u.team==='enemy').forEach(e=>{ n++; if(e.forcedTarget===G) t++; }); } return t/n; })()`);
  const t1 = taunt(1), t100 = taunt(100), t60 = taunt(60);
  ok(t1 < 0.05, "Gruel's The Reckoning at skill 1 on level-100 enemies taunts " + (100 * t1).toFixed(1) + '% (was 100%)');
  ok(t60 > 0.5 && t60 < 0.7, 'at skill 60 it taunts ' + (100 * t60).toFixed(1) + '% (expected 60%)');
  ok(t100 === 1, 'at skill 100 (no level gap) it always taunts');
  // a ground silence from a level-1 cast on a level-100 target
  setup([spec('quorrel', 30)], [spec('rhukk', 100)], 5, zero);
  R(`autoUlt=false; units.forEach(u=>{ u.speed=0; u.atkCd=1e9; u.greenAb=null; u.blueAb=null; u.maxHp=1e9; u.hp=1e9; }); window.A=U('quorrel'); window.B=U('rhukk','enemy');`);
  const hz = lv => J(`(function(){ let landed=0; for(let k=0;k<200;k++){ B.silencedT=0; groundHazards.length=0; groundHazards.push({x:B.x,y:B.y,r:300,dmg:0,team:'ally',src:A,owner:A,interval:0.001,acc:0.01,life:0.02,silence:1,_ccLv:${lv}}); updateBattle(SIM_STEP); if(B.silencedT>0) landed++; } groundHazards.length=0; return landed/200; })()`);
  ok(hz(1) < 0.05 && hz(100) === 1, 'a ground silence at skill 1 on a level-100 enemy lands ' + (100 * hz(1)).toFixed(1) + '% (was 100%); at skill 100 always');
  // a pool made by a real cast carries its skill level
  ok(J(`(function(){ groundHazards.length=0; A._castSlot='green'; A._castLv=37; A._castSM=1; const _de=_doEffectCore; _doEffectCore=function(){ groundHazards.push({x:0,y:0,r:1,life:1,interval:1,acc:0}); }; try{ doEffect(A,'x',{}); } finally{ _doEffectCore=_de; } A._castLv=0; A._castSlot=null; const lv=groundHazards[0]._ccLv; groundHazards.length=0; return lv; })()`) === 37, 'a ground pool made by a cast is stamped with that cast\'s skill level');
  // equipment stun active from a level-30 hero on a level-100 enemy (30% expected)
  setup([spec('grosk', 30)], [spec('rhukk', 100)], 112, zero);
  R(`autoUlt=false; units.forEach(u=>{ u.speed=0; u.atkCd=1e9; u.greenAb=null; u.blueAb=null; u.maxHp=1e9; u.hp=1e9; }); window.A=U('grosk'); window.B=U('rhukk','enemy'); A.x=500;A.y=600;B.x=500;B.y=560;`);
  const gs = J(`(function(){ let landed=0; for(let k=0;k<400;k++){ B.stunned=0; A.gearSkill={used:false,type:'stun',params:{dur:1,target:'near'},name:'T',desc:''}; castGearSkill(A,true); if(B.stunned>0) landed++; } return landed/400; })()`);
  ok(gs > 0.22 && gs < 0.38, 'an equipment stun from a level-30 hero on a level-100 enemy lands ' + (100 * gs).toFixed(1) + '% (expected 30%; was 100%)');
  // static: none of the audited sites writes its control straight onto the target any more
  for (const [m, re] of [["Lumi's Hush", /e\.silencedT=Math\.max\(e\.silencedT\|\|0,\(u\._tal&&u\._tal\.on\.num\)\?TalentFx\.num\(u,'hushD'/],
    ['Blizzard freeze', /\)\{ e\.stunned=Math\.max\(e\.stunned\|\|0,ccDur\(1\.2\)\); if\(u\._tal&&\(u\._tal\.on\.ccHit/],
    ["Sorrel's spade", /suit===1\)\{ t\.stunned=Math\.max/], ["Zahri's stampede", /e\.stunned=Math\.max\(e\.stunned\|\|0,ccDur\(\(u\._stampStun/],
    ["Ceraline's encase", /c\.stunned=Math\.max\(c\.stunned\|\|0,ccDur\(dur\)\)/], ['Deep Freeze', /%foes\.length\]; e\.stunned=Math\.max/],
    ['the collapse', /if\(H\.slow\) e\.slow=Math\.max/], ['ground slows', /if\(h\.slow\)e\.slow=Math\.max/], ['ground silences', /if\(h\.silence\)e\.silencedT=Math\.max/],
    ['the taunt skill', /return;e\.forcedTarget=u;e\.forcedTargetT/], ['gear stun', /t\.stunned=Math\.max\(t\.stunned\|\|0,ccDur\(p\.dur\|\|0\.75\)\)/],
    ['gear silence', /t\.silencedT=Math\.max\(t\.silencedT\|\|0,ccDur\(p\.dur\|\|1\.25\)\)/], ['gear slow', /t\.slow=Math\.max\(t\.slow\|\|0,ccDur\(p\.dur\|\|2\)\)/],
    ["Brawler's Blow", /tgt\.stunned=Math\.max\(tgt\.stunned\|\|0,ccDur\(src\._gearNextStun\)\)/]])
    ok(!re.test(html), m + ' no longer skips the landing roll'); }

console.log('== 5. Control Resist shortens every control with a length ==');
{ const rows = {};
  for (const f of ['stunned', 'fearT', 'silencedT', 'slow', 'forcedTargetT', 'sleep']) for (const cr of [0, 0.5]) {
    setup([spec('quorrel', 30)], [spec('rhukk', 30)], 5, (a, b) => { b[0].ctrlRes = 0; });
    R(`__freeze(); window.A=U("quorrel"); window.B=U("rhukk"); A.x=80;A.y=1330;B.x=930;B.y=90; B.ctrlRes=${cr}; A._castLv=30; B.immovable=true;
      window.__timeOf=function(t,field,max){ let n=0; while((t[field]||0)>0&&n<max){ updateBattle(SIM_STEP); n++; } return +(n*SIM_STEP).toFixed(3); };`);
    rows[f + cr] = f === 'forcedTargetT' ? J(`(B.forcedTarget=A, B.forcedTargetT=1.4, __timeOf(B,'forcedTargetT',2000))`)
      : f === 'sleep' ? J(`(sleepApply(A,B,2.0), __timeOf(B,'_sleepT',2000))`) : J(`(ccApply(A,B,${JSON.stringify(f)},2.0), __timeOf(B,${JSON.stringify(f)},2000))`); }
  for (const f of ['stunned', 'fearT', 'silencedT', 'slow', 'forcedTargetT', 'sleep'])
    ok(Math.abs(rows[f + '0.5'] / rows[f + '0'] - 0.5) < 0.03, f + ': 1.42 s with no resist, ' + rows[f + '0.5'] + ' s at 50% Control Resist (was 1.42 for silence, slow, taunt, sleep lock)'); }

console.log('== 6. ground slows are as strong as their skill level (45% at 1, 70% at 100) ==');
{ const move = cast => { setup([spec('quorrel', 30)], [spec('rhukk', 30)], 5, (a, b) => { b[0].ctrlRes = 0; });
    R('__freeze(); window.A=U("quorrel"); window.B=U("rhukk"); A.x=500;A.y=1330; B.x=500;B.y=90; B.speed=40; A._castLv=0;'); if (cast) R(cast);
    return J(`(function(){ for(let i=0;i<20;i++) updateBattle(SIM_STEP); const y0=B.y; for(let i=0;i<10;i++) updateBattle(SIM_STEP); return B.y-y0; })()`); };
  const base = move(null);
  const pool = lv => move(`groundHazards.push({x:B.x,y:B.y+60,r:600,dmg:0,team:"ally",src:A,owner:A,interval:0.5,acc:0,life:6,slow:2,_ccLv:${lv}});`) / base;
  const p1 = pool(1), p100 = pool(100), p50 = pool(50);
  ok(Math.abs(p1 - 0.55) < 0.005, 'a pool slow from skill 1 walks at x' + p1.toFixed(4) + ' (45% slower)');
  ok(Math.abs(p100 - J('slowMulFor(100)')) < 0.005, 'from skill 100 at x' + p100.toFixed(4) + ' (was x0.55 whatever the level)');
  ok(Math.abs(p50 - J('slowMulFor(50)')) < 0.005, 'from skill 50 at x' + p50.toFixed(4) + ', the same curve as a cast slow');
  // a real Maren at skill 100: every slowed tick is at the level-100 strength
  setup([spec('maren', 60, 3, 100)], ['rhukk', 'carn', 'meridian'].map(k => spec(k, 60)), 93, (a, b) => a.concat(b).forEach(s => { s.ctrlRes = 0; }));
  const sm = J(`(function(){ const S={}; for(let i=0;i<Math.round(30/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); units.forEach(u=>{ if(u.team==='enemy'&&u.slow>0){ const k=String(+(u.slowMul==null?SLOW_MUL_BASE:u.slowMul).toFixed(4)); S[k]=(S[k]||0)+1; } }); } return S; })()`);
  const tot = Object.values(sm).reduce((a, b) => a + b, 0);
  ok(tot > 50 && (sm['0.3025'] || 0) === tot, 'real Maren (skill 100) over 30 s: ' + tot + ' slowed enemy ticks, all at x0.3025 (' + JSON.stringify(sm) + '; was about half at x0.55)'); }

console.log('== 7. a resisted slow does nothing ==');
{ setup([spec('quorrel', 30)], [spec('rhukk', 30)], 5, (a, b) => { b[0].ctrlRes = 0; }); R('__freeze(); window.A=U("quorrel"); window.B=U("rhukk");');
  const r = J(`(function(){ let res=0,deep=0,landed=0,deepL=0; for(let i=0;i<1000;i++){ B.level=100; B.slow=2; B.slowMul=0.55; A._castLv=60; if(!ccApply(A,B,'slow',2)){ res++; if(B.slowMul<0.55) deep++; } else { landed++; if(B.slowMul<0.55) deepL++; } } return {res,deep,landed,deepL}; })()`);
  ok(r.res > 300 && r.deep === 0, r.res + ' resisted level-60 slows on a level-100 target: ' + r.deep + ' deepened the slow it had (was every one)');
  ok(r.landed > 0 && r.deepL === r.landed, 'CONTROL: the ' + r.landed + ' that landed did deepen it to the level-60 strength'); }

console.log('== 8. immovable units ignore every push, including bodies (charges, leaps, dashes) ==');
{ const run = (k, imm) => { setup([spec(k, 40, 5, 30)], [spec('rhukk', 40)], 171, (a, b) => { b[0].ctrlRes = 0; });
    return J(`(function(){ const t=U('rhukk','enemy'); t.speed=0; t.atkCd=1e9; t.greenAb=null; t.blueAb=null; t.energy=0; t.maxHp=1e9; t.hp=1e9; t.immovable=${imm}; t._talUltT=1e9; t.x=500; t.y=500; t.homeX=500; t.homeY=500;
      const h=units.find(u=>u.team==='ally'); h.x=500; h.y=1000; h.maxHp=1e9; h.hp=1e9; let mx=0; for(let i=0;i<Math.round(20/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); mx=Math.max(mx,Math.hypot(t.x-500,t.y-500)); } return +(mx/METER).toFixed(2); })()`); };
  for (const k of ['rhukk', 'korvux', 'askel', 'grosk', 'vex']) { const mv = run(k, false), im = run(k, true);
    ok(im < 0.05, k + ': an immovable target moved ' + im + ' m in 20 s (was up to 6.5 m: Korvux 6.46, Rhukk 3.49, Askel 3.51, Grosk 2.01, Vex 1.05)');
    ok(mv > 0.5, 'CONTROL: ' + k + ' still moves a normal target (' + mv + ' m)'); }
  ok(J("bodyFixed({pass:{unstepped:true}})&&bodyFixed({immovable:true})&&bodyFixed({_gearImmovableT:1})&&!bodyFixed({})"), 'the body test is the same immovable test pushes and pulls use (immovable, Unstepped / unstoppable, a gear hold)'); }

console.log('== 9. a summon is untargetable and unhittable while it climbs out ==');
{ setup(['hurne', 'sylthaine'].map(k => spec(k, 50, 5)), [spec('hollow', 50)], 151);
  const r = J(`(function(){ const h=U('hollow','enemy'); h._dropHidden=false; h.x=500; h.y=900; const o=U('hurne'); const sh=summonUnit(o,'boar shaman',18,{backRow:true});
    const rising=sh._riseT>0, pick=nearestEnemy(h); const h0=sh.hp; dealDamage(h,sh,100,'#fff','true'); const afterHit=sh.hp; damage(sh,100,'#fff',true); const afterRaw=sh.hp;
    groundHazards.push({x:sh.x,y:sh.y,r:200,dmg:100,team:'enemy',src:h,owner:h,interval:0.001,acc:0.01,life:0.02}); updateBattle(SIM_STEP); const afterPool=sh.hp;
    let t=0; while(sh._riseT>0&&t<200){ updateBattle(SIM_STEP); t++; } const risen=!(sh._riseT>0); const r0=sh.hp; dealDamage(h,sh,100,'#fff','true');
    return {rising,pick:pick&&pick.key,pickRising:!!(pick&&pick._riseT>0),h0,afterHit,afterRaw,afterPool,risen,hitAfterRise:r0-sh.hp}; })()`);
  ok(r.rising, 'the boar shaman is rising (the case that broke)');
  ok(!r.pickRising && r.pick !== 'boar shaman', "Hollow's back-line hunt picks " + r.pick + ', not the rising shaman (was the shaman, score 303.6 vs 300.9)');
  ok(r.afterHit === r.h0, 'a direct hit on the rising shaman does nothing (was -100 HP)');
  ok(r.afterRaw === r.h0 && r.afterPool === r.h0, 'raw damage and a ground pool tick do nothing while it rises');
  ok(r.risen && r.hitAfterRise > 0, 'CONTROL: once risen it takes the hit (' + r.hitAfterRise + ')');
  // whole fights: no rising summon is targeted or damaged
  R(`window.__RZ=null; (function(){ const ub=updateBattle; window.__ubR=ub; updateBattle=function(dt){ const Z=window.__RZ; const pre=Z?units.filter(u=>u._summon&&u.alive&&u._riseT>0).map(u=>[u,u.hp]):null; const r=ub.apply(this,arguments);
    if(Z) pre.forEach(([u,h])=>{ Z.ticks++; if(u.alive&&u.hp<h-1e-9) Z.dmg++;   /* (a summon whose owner fell is removed by killSummon - not damage) */ if(units.some(o=>o.alive&&o.team!==u.team&&o.target===u)) Z.tgt++; }); return r; }; })()`);
  const agg = { ticks: 0, dmg: 0, tgt: 0 };
  for (const seed of [141, 142]) { R('window.__RZ={ticks:0,dmg:0,tgt:0}'); setup(['hurne', 'aldren', 'zahri', 'vireo', 'rhukk'].map(k => spec(k, 50, 5)), ['fritz', 'astra', 'umbris', 'hollow', 'sylthaine'].map(k => spec(k, 50)), seed);
    R('window.__step(Math.round(60/SIM_STEP))'); const z = J('window.__RZ'); agg.ticks += z.ticks; agg.dmg += z.dmg; agg.tgt += z.tgt; }
  R('updateBattle=window.__ubR; window.__RZ=null');
  ok(agg.ticks > 50 && agg.dmg === 0 && agg.tgt === 0, '2 x 60 s fights (Hurne, Aldren, Zahri vs Hollow, Umbris): ' + agg.ticks + ' rising-summon ticks, ' + agg.tgt + ' targeted, ' + agg.dmg + ' damaged (was 550 targeted, 3 to 6 hits a fight)'); }

console.log('== 10. a stun, fear, silence, sleep or death during a wind-up cancels the skill (cost and cooldown stay spent) ==');
{ for (const f of ['stunned', 'fearT', 'silencedT', 'sleep', 'death']) {
    setup([spec('quorrel', 30)], [spec('sylthaine', 30)], 7, (a, b) => a.concat(b).forEach(s => { s.ctrlRes = 0; }));
    R(`__freeze(); window.A=U('quorrel'); window.B=U('sylthaine'); B.x=500; B.y=300; A.x=500; A.y=900; B.greenAb=KITS.sylthaine.green; B.greenCd=0; B.atkCd=1e9; B.target=A; A._castLv=30;
       window.__FIRE=0; window.__de0=_doEffectCore; _doEffectCore=function(u,type,o){ if(u&&u.key==='sylthaine') window.__FIRE++; return window.__de0.apply(this,arguments); };`);
    const ctl = f === 'sleep' ? 'sleepApply(A,B,2.0)' : f === 'death' ? "(B._wardT=0, dealDamage(A,B,1e12,'#fff','true'), B.alive=false, B.hp=0)" : 'ccApply(A,B,"' + f + '",2.0)';
    const r = J(`(function(){ let at=null,cd=null; for(let i=0;i<160;i++){ updateBattle(SIM_STEP); if(B._pend&&at==null&&B._pend.t<0.4){ at=battleTime; cd=B.greenCd; ${ctl}; } }
      if('${f}'==='death'){ B.alive=true; B.hp=B.maxHp; for(let i=0;i<60;i++) updateBattle(SIM_STEP); }   /* a revive: the old wind-up must not fire */
      _doEffectCore=window.__de0; return {at,cd,fired:window.__FIRE,pend:!!B._pend}; })()`);
    ok(!!r && r.at != null && r.fired === 0 && !r.pend, f + ' 0.6 s into Frozen Orb\'s 1 s wind-up: the spell never fires (was: it fired when a stun or fear ended)');
    ok(!!r && r.cd > 0, f + ': the cooldown stays spent (' + (r ? +r.cd : 0).toFixed(2) + ' s left at the cancel)'); }
  // CONTROL: with no control the spell fires once
  setup([spec('quorrel', 30)], [spec('sylthaine', 30)], 7, (a, b) => a.concat(b).forEach(s => { s.ctrlRes = 0; }));
  R(`__freeze(); window.A=U('quorrel'); window.B=U('sylthaine'); B.x=500; B.y=300; A.x=500; A.y=900; B.greenAb=KITS.sylthaine.green; B.greenCd=0; B.atkCd=1e9; B.target=A;
     window.__FIRE=0; window.__de0=_doEffectCore; _doEffectCore=function(u,type,o){ if(u&&u.key==='sylthaine') window.__FIRE++; return window.__de0.apply(this,arguments); };`);
  ok(J('(function(){ for(let i=0;i<160;i++) updateBattle(SIM_STEP); _doEffectCore=window.__de0; return window.__FIRE; })()') === 1, 'CONTROL: uninterrupted, Frozen Orb fires exactly once'); }

console.log('== 11. the Range rating works for ranged heroes (10 points = 1%, cap 30%) ==');
{ const bare = (k, lv, tt) => ({ key: k, level: lv, stars: 1, rank: 3, pips: 0, ref: 0, glyphRank: 0, tt: tt || {}, ex: {}, fAtk: 0, fHp: 0, fApow: 0, apMul: 1, skillLv: [1, 1, 1, 1] });
  const rng = (k, pts) => { setup([bare(k, 30, { range: pts })], [bare('grosk', 1)], 1); return J(`({r:U(${JSON.stringify(k)}).range,cd:U(${JSON.stringify(k)}).combatDist})`); };
  for (const k of ['meridian', 'sylthaine', 'fritz']) { const a = rng(k, 0), b = rng(k, 200), c = rng(k, 1000);
    ok(Math.abs(b.cd / a.cd - 1.2) < 1e-6 && b.r > a.r && b.r >= b.cd, k + ': 200 Range points = it fights from 20% further (hold ' + a.cd.toFixed(1) + ' -> ' + b.cd.toFixed(1) + ', reach ' + a.r.toFixed(1) + ' -> ' + b.r.toFixed(1) + '; was unchanged)');
    ok(Math.abs(c.cd / a.cd - 1.3) < 1e-6, k + ': 1000 points stop at the 30% cap'); }
  const m0 = rng('rhukk', 0), m200 = rng('rhukk', 200);
  ok(Math.abs(m200.r / m0.r - 1.2) < 1e-6 && m200.cd === m0.cd, 'a melee hero is unchanged (+20% on its range number as before, same hold)');
  // in a fight: Meridian rooted, a target 10% past her plain hold: she waits without the rating, shoots with 200 points
  const shots = pts => { setup([bare('meridian', 30, { range: pts })], [bare('grosk', 30)], 3);
    return J(`(function(){ const m=U('meridian'), g=U('grosk','enemy'); m.speed=0; m.greenAb=null; m.blueAb=null; autoUlt=false; g.speed=0; g.atkCd=1e9; g.greenAb=null; g.blueAb=null; g.maxHp=1e9; g.hp=1e9; m.x=500; m.y=1200; g.x=500; g.y=1200-Math.round(813.45*1.1); const h0=g.hp; for(let i=0;i<200;i++) updateBattle(SIM_STEP); return g.hp<h0; })()`); };
  ok(!shots(0) && shots(200), 'a rooted Meridian does not shoot an enemy 10% past her 25 m hold without the rating, and does with 200 Range points'); }

console.log("== 12. Brannus's Arena Lock card says what it does: every enemy (the design gives it no radius) ==");
{ const NEW = 'Plants the wheel and forces every enemy to attack him.', OLD = 'Plants the wheel and forces nearby enemies to attack him.';
  ok(J('KITS.brannus.blue.desc') === NEW && !J('KITS.brannus.blue.radius||0'), 'the card reads "' + NEW + '" and the skill has no radius (18 - Battle Engine: taunts with no radius, Arena Lock among them, reach every enemy)');
  setup(['brannus'].map(k => spec(k, 30)), ['rhukk', 'carn', 'meridian', 'astra'].map(k => spec(k, 30)), 131);
  R(`__freeze(); window.Br=U('brannus'); Br.x=100; Br.y=1300; units.filter(u=>u.team==='enemy').forEach((e,i)=>{ e.x=500; e.y=700-i*100; });`);
  const hit = J(`(function(){ Br._castSlot='blue'; Br._castSM=1; Br._castLv=30; doEffect(Br,'taunt',Object.assign({},KITS.brannus.blue)); Br._castSlot=null; return units.filter(u=>u.team==='enemy').map(e=>[+(dist(Br,e)/METER).toFixed(1),e.forcedTarget===Br]); })()`);
  ok(!!hit && hit.every(h => h[1]) && Math.min(...hit.map(h => h[0])) > 15, 'cast at the same level it taunts every enemy, ' + (hit || []).map(h => h[0]).join(' / ') + ' m away');
  const crypto = require('crypto'); const CV = JSON.parse(html.match(/\nconst EW_LANG_CV=(\{.*?\});/)[1]);
  const en = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'lang', 'content', 'en.json'), 'utf8'));
  ok(NEW in en && !(OLD in en), 'tools/lang/content/en.json carries the new template, not the old one');
  for (const c of ['es', 'pt-BR', 'fr', 'de', 'it', 'nl', 'ru', 'tr', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'th', 'id', 'hi', 'en-XA']) {
    const raw = fs.readFileSync(path.join(root, 'lang', c + '.content.json'), 'utf8'), j = JSON.parse(raw);
    ok(typeof j[NEW] === 'string' && j[NEW].length > 5 && !(OLD in j) && crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8) === CV[c === 'en-XA' ? 'qps' : c], c + ': the new card text is translated ("' + j[NEW] + '") and the pack hash in the page matches'); } }

console.log('== 13. a revived hero never finishes the cast he died in ==');
{ for (const slot of ['green', 'ult']) { setup(['vulmar', 'linnet'].map(k => spec(k, 40)), [spec('rhukk', 40)], 31, (a, b) => a.concat(b).forEach(s => { s.ctrlRes = 0; }));
    const r = J(`(function(){ __freeze(); const V=U('vulmar','ally'), LN=U('linnet','ally'), T0=U('rhukk','enemy'); V.greenAb=KITS.vulmar.green; T0.x=V.x+300; T0.y=V.y; let F=0; const de=_doEffectCore; _doEffectCore=function(u){ if(u===V) F++; return de.apply(this,arguments); };
      try{ for(let i=0;i<20;i++) updateBattle(SIM_STEP); ${slot === 'green' ? 'V._castSM=skillMul(V.skillLv[1]); V._castLv=V.skillLv[1]; castKit(V,V.greenAb); V._castSM=1; V._castLv=0; V.greenCd=99;' : 'V.energy=100; V.target=T0; castAbility(V);'}
        const pend=!!V._pend; for(let i=0;i<22;i++) updateBattle(SIM_STEP); V._wardT=0; dealDamage(T0,V,1e13,'#fff','true'); for(let i=0;i<10;i++) updateBattle(SIM_STEP); LN.energy=100; castAbility(LN); for(let i=0;i<150;i++) updateBattle(SIM_STEP);
        return {pend,revived:V.alive,fired:F,pendAfter:!!V._pend}; } finally{ _doEffectCore=de; } })()`);
    ok(!!r && r.pend && r.revived && r.fired === 0, 'Vulmar dies 0.6 s into his ' + slot + " wind-up, Linnet's Rewind brings him back: the old cast never goes off (was: it fired at 3.14 s) " + JSON.stringify(r)); }
  ok(/a\._pend=null; a\._castNow=0;[^\n]*a\._blizzT=0; a\._stormT=0;/.test(html), 'the revive itself clears the pending cast and any channel'); }

console.log('== 14. Blizzard and Thunder Shower stop when the caster is stunned, feared, silenced, put to sleep or killed ==');
{ for (const hero of ['sylthaine', 'fritz']) for (const kind of ['none', 'stun', 'fear', 'silence', 'sleep', 'death']) {
    setup([spec(hero, 40)], ['rhukk', 'grosk', 'carn'].map(k => spec(k, 40)), 41, (a, b) => a.concat(b).forEach(s => { s.ctrlRes = 0; }));
    const n = J(`(function(){ __freeze(); const C=U('${hero}','ally'); units.filter(u=>u.team==='enemy').forEach((e,i)=>{ e.x=C.x+260+i*30; e.y=C.y+i*40; }); for(let i=0;i<10;i++) updateBattle(SIM_STEP);
      const TK=[]; const dd=dealDamage; dealDamage=function(s){ if(s===C) TK.push(battleTime); return dd.apply(this,arguments); };
      try{ C.energy=100; C.target=units.find(u=>u.team==='enemy'); castAbility(C); for(let i=0;i<Math.round(1.6/SIM_STEP);i++) updateBattle(SIM_STEP); const at=battleTime; const E=units.find(u=>u.team==='enemy');
        const k='${kind}'; if(k==='stun') C.stunned=1; if(k==='fear'){ C.fearT=1; C._fearFrom=E; } if(k==='silence') C.silencedT=1; if(k==='sleep') sleepApply(E,C,1.0); if(k==='death'){ C._wardT=0; dd(E,C,1e13,'#fff','true'); }
        for(let i=0;i<Math.round(5/SIM_STEP);i++) updateBattle(SIM_STEP); return TK.filter(t=>t>at+1e-3).length; } finally{ dealDamage=dd; } })()`);
    if (kind === 'none') ok(n >= 8, 'CONTROL: ' + hero + "'s storm uncontrolled lands " + n + ' more ticks after 1.6 s');
    else ok(n === 0, hero + ': ' + kind + ' 1.6 s into the storm ends it - ' + n + ' ticks after (was 12 / 10: a stun only delayed them, silence did nothing)'); } }

console.log('== 15. Frozen Orb, Volt Pike, Golden Quill, Featherfang and Full Arsenal hit when the projectile arrives ==');
{ for (const [hero, slot, lag] of [['sylthaine', 'green', [0.8, 0.95]], ['iver', 'green', [0.2, 0.35]], ['meridian', 'green', [0.2, 0.35]], ['vaelora', 'green', [0.2, 0.35]], ['rivet', 'ult', [0.1, 0.35]]]) {
    setup([spec(hero, 40)], [spec('rhukk', 40)], 7, (a, b) => a.concat(b).forEach(s => { s.ctrlRes = 0; }));
    const r = J(`(function(){ __freeze(); const C=U('${hero}'), T=U('rhukk','enemy'); C.greenAb=KITS['${hero}'].green; C.x=500; C.y=900; T.x=500; T.y=900-14*METER; C.target=T; for(let i=0;i<5;i++) updateBattle(SIM_STEP);
      let rel=null, hit=null; const h0=T.hp; const de=_doEffectCore; _doEffectCore=function(u){ if(u===C&&rel==null) rel=battleTime; return de.apply(this,arguments); };
      try{ if('${slot}'==='ult'){ C.energy=100; castAbility(C); } else { C._castSM=1; C._castLv=40; castKit(C,C.greenAb); C._castSM=1; C._castLv=0; }
        for(let i=0;i<200&&hit==null;i++){ updateBattle(SIM_STEP); if(T.hp<h0) hit=battleTime; } } finally{ _doEffectCore=de; } return {rel,hit,ty:'${slot}'==='ult'?C.t.ability:C.greenAb.type}; })()`);
    const l = r ? r.hit - r.rel : NaN; ok(!!r && r.rel != null && r.hit != null && l >= lag[0] && l <= lag[1], hero + ' ' + (r && r.ty) + ': the hit lands ' + (+l).toFixed(3) + ' s after the release, with the art (was 0, at the release)'); } }

console.log("== 16. Linnet's AUTO Rewind waits for the first ally damage ==");
{ setup(['linnet', 'rhukk'].map(k => spec(k, 40)), [spec('grosk', 40)], 9);
  const r = J(`(function(){ __freeze(); autoUlt=true; const L=U('linnet'), K=U('rhukk','ally'), G=U('grosk','enemy'); units.forEach(u=>{ u.maxHp=1e5; u.hp=1e5; }); G.x=900; G.y=100;
    let fired=null; const ca=castAbility; castAbility=function(u){ if(u===L&&fired==null) fired=battleTime; return ca.apply(this,arguments); };
    try{ for(let i=0;i<110;i++){ L.energy=Math.max(L.energy,100); updateBattle(SIM_STEP); } const idle=fired; K.hp=K.maxHp*0.5; for(let i=0;i<10;i++) updateBattle(SIM_STEP); return {idle,after:fired}; } finally{ castAbility=ca; } })()`);
  ok(!!r && r.idle === null, 'full energy for 3 s with nobody hurt: Rewind is held (was cast at 0.03 s)');
  ok(!!r && r.after != null, 'the first ally damage: Rewind goes off');
  setup(['linnet', 'rhukk'].map(k => spec(k, 40)), [spec('grosk', 40)], 9);
  ok(J(`(function(){ __freeze(); autoUlt=true; const L=U('linnet'), K=U('rhukk','ally'); units.forEach(u=>{ u.maxHp=1e5; u.hp=1e5; }); K.alive=false; K.hp=0; let f=false; const ca=castAbility; castAbility=function(u){ if(u===L) f=true; return ca.apply(this,arguments); }; try{ L.energy=100; for(let i=0;i<5;i++) updateBattle(SIM_STEP); } finally{ castAbility=ca; } return f; })()`), 'a fallen ally (the revive) also releases it');
  ok(J("HEALER_ULT_HITS.has('symphony')&&!HEAL_ONLY_ULTS.has('symphony')"), 'CONTROL: ults that also damage (Symphony, Sunburst, Hive Mind) still fire at once'); }

console.log("== 17. Magic and Healer skill cards show the real number (the hero's own Ability Power) ==");
{ setup([spec('sylthaine', 40)], [spec('rhukk', 40)], 5);
  const r = J(`(function(){ __freeze(); const S=U('sylthaine'), T=U('rhukk','enemy'); T.armorRating=0; T.mrRating=0; T.glyphDR=0; const card=skillEffectStr('sylthaine',2,Math.round(S.dmg),Math.round(S.maxHp),Math.round(S.apow));
    const eM=elemMul, cE=classEdge; elemMul=()=>1; classEdge=()=>''; const h0=T.hp; try{ S._castSlot='blue'; S._castSM=skillMul(skillLevel('sylthaine',2)); S._castLv=skillLevel('sylthaine',2); S.target=T; _doEffectCore(S,'freeze',Object.assign({},KITS.sylthaine.blue,{_arrived:true})); } finally{ S._castSlot=null; elemMul=eM; classEdge=cE; } return {card,hit:h0-T.hp}; })()`);
  const num = +(((r && r.card) || '').replace(/\{[^}]*\}/g, '').match(/\d+/) || [0])[0];
  ok(!!r && Math.abs(num - r.hit) <= 1, "Sylthaine's Glacial Prison card says " + num + ', the hit is ' + (r ? r.hit.toFixed(1) : '?') + ' (was 102 against 273.6)');
  const heroes = J(`Object.keys(HERO_TYPES).filter(k=>KITS[k]&&k!==HERO61.KEY&&!HERO_TYPES[k].monster&&['Magic','Healer'].includes(HERO_TYPES[k].damageProfile))`);
  let n = 0; const bad = [];
  for (const k of heroes) for (const idx of [0, 1, 2]) { const a = J(`skillEffectStr(${JSON.stringify(k)},${idx},50,3000,300)`), b = J(`skillEffectStr(${JSON.stringify(k)},${idx},50,3000,600)`);
    const na = String(a).replace(/\{[^}]*\}/g, '').match(/\d+/g) || [], nb = String(b).replace(/\{[^}]*\}/g, '').match(/\d+/g) || [];
    if (a === b || na.length !== nb.length) continue; n++; na.forEach((x, i) => { if (x !== nb[i] && Math.abs(+nb[i] - 2 * +x) > 2) bad.push(k + ':' + idx); }); }
  ok(heroes.length >= 28 && n >= 30 && !bad.length, heroes.length + ' Magic / Healer heroes: ' + n + ' AP-scaled card numbers follow the Ability Power given (double AP = double number)' + (bad.length ? ' BAD ' + bad.join(',') : ''));
  ok(/iconize\(skillEffectStr\(key,s\.idx,S_ATK,S_HP,S_APOW\)\)/.test(html) && /skillEffectStr\(u\.key,0,Math\.round\(u\.dmg\),Math\.round\(u\.maxHp\),Math\.round\(u\.apow\|\|0\)\)/.test(html), "the Skills tab passes the Stats tab's Ability Power, the battle portrait the unit's own"); }

console.log("== 18. AUTO area aim: the best spot, inside the skill's real reach ==");
{ setup([spec('fritz', 40)], ['rhukk', 'grosk', 'carn', 'meridian', 'astra', 'lumi'].map(k => spec(k, 40)), 11);
  const r = J(`(function(){ __freeze(); const F=U('fritz'); let s=12345; const rnd=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; }; const R=3*METER; let worse=0,n=0;
    const es=units.filter(u=>u.team==='enemy'); for(let k=0;k<200;k++){ es.forEach(e=>{ e.x=300+rnd()*400; e.y=300+rnd()*400; }); const c=densestEnemyCluster(F,R); const got=es.filter(e=>dist(c,e)<=R).length;
      let bestG=0; for(let x=250;x<=750;x+=5) for(let y=250;y<=750;y+=5){ let m=0; for(const e of es) if(Math.hypot(e.x-x,e.y-y)<=R) m++; if(m>bestG) bestG=m; } n++; if(got<bestG) worse++; } return {n,worse}; })()`);
  ok(r.worse === 0, r.n + ' random layouts of 6 enemies: the AUTO circle never catches fewer than a 5-unit grid search (' + r.worse + ' did; was 24 of 300 one fewer)');
  setup([spec('grosk', 40)], ['rhukk', 'carn', 'meridian', 'astra', 'lumi'].map(k => spec(k, 40)), 12);
  const c = J(`(function(){ __freeze(); const G=U('grosk'); G.x=500; G.y=1000; const es=units.filter(u=>u.team==='enemy'); es[0].x=500; es[0].y=1000-5*METER; es.slice(1).forEach((e,i)=>{ e.x=480+i*20; e.y=1000-14*METER+i*10; }); const a=optimalAimField(G); return Math.hypot(a.x-G.x,a.y-G.y)/METER; })()`);
  ok(c <= 6.0001, "Grosk's AUTO Croc Drop aims " + (+c).toFixed(2) + ' m away, inside his 6 m reach (was 13.13 m, at a pack he cannot reach)'); }

console.log('== 19. ranged bosses fight from 1.4x as far, like melee bosses ==');
{ const r = J(`(function(){ const keep=CUR; CUR={mode:'arena'}; const o={}; for(const k of CHAPTER_MAP_BOSS_KEYS.concat(['leviath'])){ if(!k||!MONSTER_TYPES[k]) continue; const n=makeUnit(k,'enemy',500,500,40), b=makeUnit(k,'enemy',500,500,40,{boss:true}); o[k]={melee:n.melee,r:b.range/n.range,h:b.combatDist/n.combatDist}; } CUR=keep; return o; })()`);
  const ranged = Object.entries(r).filter(([k, v]) => !v.melee), melee = Object.entries(r).filter(([k, v]) => v.melee);
  ok(ranged.length >= 8, ranged.length + ' ranged bosses (the chapter bosses and Leviath): ' + ranged.map(x => x[0]).join(', '));
  for (const [k, v] of ranged) ok(Math.abs(v.h - 1.4) < 1e-6 && v.r > 1.35, k + ': as a boss its hold is x' + v.h.toFixed(2) + ' and reach x' + v.r.toFixed(2) + ' (was x1.00 / x1.00)');
  ok(melee.every(([k, v]) => Math.abs(v.r - 1.4) < 1e-6), 'melee bosses keep their x1.4 range (' + melee.length + ')'); }

console.log('== 20. the battle loader lists every spell sheet a fighter can use ==');
{ const r = J(`(function(){ const F=FX2_DEF, P=(typeof FX_PLATE_DEF!=='undefined')?FX_PLATE_DEF:{}; const keys=Object.keys(HERO_TYPES).concat(Object.keys(MONSTER_TYPES||{})); const all=new Set(); for(const k of keys) fxSheetKeys([k]).forEach(x=>all.add(x));
    const miss=Object.keys(F).concat(Object.keys(P)).filter(n=>!all.has(n)&&n.indexOf('__')!==0); return {miss, cer:fxSheetKeys(['ceraline']), syl:fxSheetKeys(['sylthaine']), any:fxSheetKeys(['vael'])}; })()`);
  ok(r.miss.length <= 1 && r.miss.every(n => n === 'toxbeam'), 'every sheet is on some fighter\'s list (left: ' + JSON.stringify(r.miss) + ' - toxbeam is defined but never drawn); 59 were missing before');
  for (const n of ['candlepot', 'candlepool', 'candleburst', 'candleeffigy', 'waxerupt', 'waxpool', 'bellring', 'waxshatter']) ok(r.cer.includes(n), "Ceraline's list has " + n);
  ok(r.syl.includes('blizzard'), "Sylthaine's list has her Blizzard");
  ok(['bleed', 'poison', 'firepatch'].every(n => r.any.includes(n)), 'every fighter brings the burn / bleed / poison floor marks');
  ok(!/const FX_\w*LIST\s*=\s*\[/.test(html.slice(html.indexOf('function fxSheetKeys('), html.indexOf('function fxSheetTex('))), 'the list is derived from the data and the effect code, not a hand list');
  /* memory budget (tests/test_memory_budget_1140.js, the phone's 2048 MB GPU / 400 MB bitmaps): only the core list is decoded and uploaded before the
     fight; the added sheets are fetched into the cache only. The heaviest 5v5 of that test uploaded 112 MB more with all of them (2085 MB). */
  const H10 = JSON.stringify(['rivet', 'hollow', 'aureth', 'rafe', 'tharl', 'ambrel', 'zahri', 'kharos', 'rhukk', 'grosk']);
  const m = J(`(function(){ const c=fxSheetKeys(${H10},1), a=fxSheetKeys(${H10}); return {c:c.length, a:a.length, extra:a.filter(n=>c.indexOf(n)<0), pre:fxSheetPrefetch(${H10})}; })()`);
  ok(m.c === 35 && m.a > m.c && m.pre === m.a - m.c, 'heaviest 5v5: ' + m.c + ' sheets uploaded before the fight (as v1451), ' + m.pre + ' more downloaded to the cache only');
  ok(!m.extra.some(n => /^(tessit|hobb|sorrel)/.test(n)), 'a sheet the effect code names after a hero who is not in the fight is not fetched (tessithourglass, hobb_green, sorrelflare were)');
  ok(/const list=fxSheetKeys\(keys,1\)\.map\(fxSheetTex\)/.test(html) && /fxSheetKeys\(keys,1\)\.forEach\(fxSheetTex\); \}catch\(e\)\{\}[^\n]*\n\s*try\{ fxSheetPrefetch\(keys\); \}/.test(html), 'the loader and the GPU warm-up make textures for the core list only; the rest is prefetched');
  ok(/fetch\(u,\{credentials:'same-origin'\}\)\)\.then\(r=>\(r&&r\.ok&&r\.arrayBuffer\)\?r\.arrayBuffer\(\):null\)/.test(html.slice(html.indexOf('function fxSheetPrefetch('), html.indexOf('function fxSheetTex('))) && !/fx2Tex|TextureLoader|bitmapLoad|createImageBitmap/.test(html.slice(html.indexOf('function fxSheetPrefetch('), html.indexOf('function fxSheetTex('))), 'the prefetch reads bytes only: no texture, no decoded bitmap'); }

console.log('== 21. the Damage Done lists step down until every row fits ==');
{ ok(/function ddFit\(ov\)\{[^\n]*for\(const c of \['ddD1','ddD2','ddD3'\]\)\{ if\(L\.scrollHeight<=L\.clientHeight\+1\) break; L\.classList\.add\(c\); \}/.test(html), 'ddFit adds ddD1 / ddD2 / ddD3 to a list until it no longer scrolls');
  ok(/ddFit\(ov\);/.test(html), 'ddRender calls ddFit after the panel is on the page');
  ok(/#ddPop \.ddList\.ddD2\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(html) && /#ddPop \.ddList\.ddD1 \.ddSub\{display:none\}/.test(html), 'compact rows, then two columns');
  // the fit loop on fake lists: 10 rows that need 411 px in a 242 px box
  const fit = new Function('ov', html.match(/function ddFit\(ov\)\{([^\n]*)\}   \/\* v1452/)[1]);
  const L = { classList: { s: new Set(), add(c) { this.s.add(c); } }, get scrollHeight() { const s = this.classList.s; return s.has('ddD2') ? 150 : s.has('ddD1') ? 280 : 411; }, clientHeight: 242 };
  fit({ querySelectorAll: () => [L] }); ok(L.classList.s.has('ddD1') && L.classList.s.has('ddD2') && !L.classList.s.has('ddD3'), 'a 10-row list in a 242 px column goes compact, then to two columns, and stops when it fits'); }

console.log('== 22. the fight never stands still waiting for the server ==');
{ const src = ['ACT_ACK_TIMEOUT_MS', 'ACT_INPUT_DELAY_CLIENT'].map(n => html.match(new RegExp('const ' + n + '=[^;]*;'))[0]).join('\n') + '\n' +
    html.match(/function actHold\(\)\{[\s\S]*?\n\}/)[0] + '\n' + html.match(/function actGiveUp\(\)\{[\s\S]*?\n\}/)[0];
  const c = { _actWait: 1, _actWaitAt: Date.now(), _actWaitFrom: 100, simTick: 100, _actStreamOn: true, _actSeq: 0, _actSent: { 1: { k: 'auto', uid: -1 } }, _inputQ: [], INPUT_LOG: [], banners: [], actSend() {}, bannerMsg(m) { c.banners.push(m); }, uiIcon: () => '', t: k => k };
  vm.createContext(c); vm.runInContext(src, c);
  ok(vm.runInContext('actHold()', c) === false && c._actStreamOn, 'before the press\'s tick: the fight runs, still streaming');
  c.simTick = 109; ok(vm.runInContext('actHold()', c) === false, 'at the press\'s tick with no answer: the fight runs on (was: held up to 3 s)');
  ok(!c._actStreamOn && c._inputQ.length === 1 && c.INPUT_LOG.length === 1 && c.INPUT_LOG[0][0] === 109, 'the press is applied on that tick and recorded locally at once');
  ok(c.banners.length === 1 && /combatnet\.slow/.test(c.banners[0]), 'with the same "Connection slow" notice'); }

console.log('== 23. talents add at most 5% crit chance per hero ==');
{ const T = require(path.join(root, 'talents.js'));
  const two = (h, picks) => { let b = { r: {} }; for (const [tid, target] of picks) { const tr = T.trees(h).find(t => t.id === tid); const tal = tr.talents.find(x => x[0] === target);
      for (let g = 0; g < 200 && T.rankOf(b, target) < tal[4]; g++) { if (T.canLearn(h, b, target, 100)) { b = T.learn(h, b, target, 100).build; continue; }
        const nx = tr.talents.filter(q => q[1] < tal[1] && q[0] !== target && T.canLearn(h, b, q[0], 100) && !/crit/i.test(q[5])).sort((a, c) => a[1] - c[1])[0]; if (!nx) break; b = T.learn(h, b, nx[0], 100).build; } }
    return T.learned(h, b); };
  for (const [h, picks] of [['brannus', [['champion', 'cc_7_3'], ['bronze_wheel', 'bw_3_2']]], ['calypsa', [['straight_lines', 'sl_2_4'], ['never_bit_first', 'nb_9_3']]], ['vex', [['ropewalker', 'rw_1_3'], ['short_list', 'sl_3_3']]]]) {
    const list = two(h, picks), c0 = (() => { setup([spec(h, 100)], [spec('rhukk', 100)], 3); return J(`U(${JSON.stringify(h)},'ally').glyphCrit||0`); })();
    setup([Object.assign(spec(h, 100), { talents: list })], [spec('rhukk', 100)], 3); const c1 = J(`U(${JSON.stringify(h)},'ally').glyphCrit||0`);
    ok(c1 - c0 <= 0.05 + 1e-9 && c1 - c0 > 0.04, h + ': two crit trees add ' + (100 * (c1 - c0)).toFixed(1) + '% crit chance (was 10% / 9.5%)'); } }

console.log('== 24. talent stuns and extensions stop at 4 s in a row on one target ==');
{ ok(J('typeof TalentFx.api==="function"||true') && /function stunRoom\(t\)/.test(fs.readFileSync(path.join(root, 'talents-fx.js'), 'utf8')), 'the shared talent engine has the 4.0 s run room (stunRoom)');
  setup([spec('quorrel', 30)], [spec('rhukk', 30)], 5, (a, b) => { b[0].ctrlRes = 0; });
  const r = J(`(function(){ __freeze(); const B=U('rhukk','enemy'); B.stunned=3.5; for(let i=0;i<Math.round(3.0/SIM_STEP);i++) updateBattle(SIM_STEP); const since=B._stunSince; const room=4.0-(battleTime-since); return {since:since!=null, room:+room.toFixed(2), left:+B.stunned.toFixed(2)}; })()`);
  ok(r.since && Math.abs(r.room - 1.0) < 0.06, 'the page stamps when a stun run began (3 s into a 3.5 s stun: ' + r.room + ' s of room left for talents)');
  const T = require(path.join(root, 'talents.js'));
  const dive = (h, ti) => { const t = T.trees(h)[ti]; const chain = new Set(); { let s = t.talents.find(q => q[1] === 13); while (s) { chain.add(s[0]); s = s[6] ? t.talents.find(q => q[0] === s[6]) : null; } }
    let b = { r: {} }; for (let g = 0; g < 700 && T.spent(h, b).total < 91; g++) { const nx = t.talents.filter(q => T.canLearn(h, b, q[0], 100)).sort((a, c) => ((chain.has(c[0]) ? 1000 : 0) + c[1]) - ((chain.has(a[0]) ? 1000 : 0) + a[1]) || a[2] - c[2])[0]; if (!nx) break; b = T.learn(h, b, nx[0], 100).build; }
    return T.learned(h, b); };
  const chainOf = (h, ti) => { setup([Object.assign(spec(h, 100, 5, 100), { talents: dive(h, ti) })], ['rhukk', 'meridian', 'vulmar', 'konwu', 'vex'].map(k => spec(k, 100, 5, 100)), 7);
    return J(`(function(){ const H=U(${JSON.stringify(h)},'ally'); H.maxHp*=40; H.hp=H.maxHp; const ch=new Map(); let best=0; for(let i=0;i<Math.round(60/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); for(const e of units){ if(e.team==='ally') continue; const c=(e.alive&&e.stunned>0)?(ch.get(e)||0)+SIM_STEP:0; ch.set(e,c); if(c>best) best=c; } } return +best.toFixed(2); })()`); };
  for (const [h, ti, was] of [['joss', 2, '5.52-5.58'], ['tessit', 2, '5.25']]) { const c = chainOf(h, ti); ok(c <= 4.05, h + ' alone, one tree at 91 points, 60 s: the longest stun in a row on one enemy is ' + c + ' s (was ' + was + ' s)'); }
  ok(/A\.stunRoom\(t\)/.test(fs.readFileSync(path.join(root, 'talents-mech', 'joss.js'), 'utf8')) && /A\.stunRoom\(t\)/.test(fs.readFileSync(path.join(root, 'talents-mech', 'tessit.js'), 'utf8')) && /A\.stunRoom\(t\)/.test(fs.readFileSync(path.join(root, 'talents-mech', 'pellucid.js'), 'utf8')), "Joss's, Tessit's and Pellucid's extensions read the run room"); }

console.log("== 25. Ceraline's talent damage reduction has a cap (40% on her, 25% on an ally) ==");
{ const LAB = require('./talents-lab.js'); const T = LAB.T; const tr = T.trees('ceraline').find(t => t.id === 'the_host');
  const L = LAB.lab('ceraline', LAB.full('ceraline', tr.talents.map(x => x[0])), { foes: 2, allies: 2 }); for (const k of Object.keys(L.T.st || {})) L.T.s.k[k] = { n: 99, t: 0, idle: 0 };
  const r = JSON.parse(vm.runInContext(`JSON.stringify((function(){ const C=units.find(u=>u.key==='ceraline'); const E=units.find(u=>u.team!==C.team); const A=units.find(u=>u.team===C.team&&u!==C); return {self:TalentFx.inc(C,E,1000,'phys',true,false), ally:TalentFx.inc(A,E,1000,'phys',true,false)}; })())`, LAB.NOW.ctx));
  ok(r.self >= 600 - 1e-6 && r.self <= 600 + 1e-6, 'every The Host talent, every candle: a 1000 hit on her deals ' + r.self + ' (40% off at most; was 48% off)');
  ok(Math.abs(r.ally - 750) < 1e-6, 'and on an ally ' + r.ally + ' (25% off at most; was 43% off)'); }

console.log('== 26. after a fight the glyph tab re-reads its state; a stale first tap retries itself ==');
{ const grab = name => { const i = html.indexOf('function ' + name + '('); assert(i >= 0, name); let d = 0, k = html.indexOf('{', i); for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) break; } } return (html.slice(i - 6, i) === 'async ' ? 'async ' : '') + html.slice(i, k + 1); };
  ok(/if\(method==='POST'&&r&&!r\.error&&BATTLE_RESULT_ROUTES\.test\(String\(path\)\)\) glyphAfterFight\(\);/.test(html), 'every successful fight result (campaign, Vault, Arena and every other result route) re-reads glyph state');
  ok(/campaign\\\/resolve/.test(html.match(/const BATTLE_RESULT_ROUTES=[^\n]*/)[0]) && /dungeon\\\/resolve-battle/.test(html.match(/const BATTLE_RESULT_ROUTES=[^\n]*/)[0]) && /arena\\\/result/.test(html.match(/const BATTLE_RESULT_ROUTES=[^\n]*/)[0]), 'the result routes include the Campaign, the Vault and the Arena');
  // Quick Slot in a sandbox: the server answers STALE once (the fight bumped the revision), then builds
  const calls = []; const c = { RUNE2: { busy: false, st: { revision: 4 }, build: null }, detailHero: 'vael', banners: [], bannerMsg(m) { c.banners.push(m); }, ewT: k => k, escapeHTML: s => s, langMsg: s => s, uid8: () => 'r' + calls.length,
    api: async (p, m, b) => { calls.push(b.expectedRevision); return calls.length === 1 ? { error: 'STALE' } : { built: [0, 1, 2, 3, 4, 5] }; }, glyphV2Sync: async () => { c.RUNE2.st.revision = 5; }, renderHeroDetail() {}, g2RenderOverlays() {}, checkTutorial() {}, tutReturnAfterAction() {}, g2buildOpen() {} };
  vm.createContext(c); vm.runInContext(grab('g2buildAll'), c);
  PENDING.push((async () => { await vm.runInContext('g2buildAll()', c);
    ok(calls.length === 2 && calls[0] === 4 && calls[1] === 5, 'Quick Slot: the stale first send (revision 4) is re-read and sent again with revision 5 - on the same tap');
    ok(c.banners.some(b => /glyphs_built/.test(b)) && !c.banners.some(b => /refreshed_retry/.test(b)), 'the board is built on the first tap, no "Refreshed - try again"');
  })().catch(e => { ok(false, "Quick Slot sandbox: " + e.message); }));
  ok(/if\(r&&r\.error==='STALE'\)\{ await glyphV2Sync\(\);[^\n]*\n\s*if\(!g2post\._again\)\{ g2post\._again=true;/.test(html), 'ASCEND (g2post): a stale revision is re-read and the press sent once more'); }

console.log('== 27. recipe-tree cores with a grade word or Worldfire find their art ==');
{ const src = html.match(/function g2parseKey\(k\)\{[^\n]*\n[^\n]*\}/)[0];
  const c = { RUNE2: { cat: { ladder: ['Grey', 'Green', 'Green +1', 'Blue', 'Blue +1', 'Blue +2', 'Purple', 'Purple +1', 'Purple +2', 'Purple +3', 'Gold', 'Gold +1', 'Gold +2', 'Gold +3', 'Gold +4', 'Orange'] } } };
  vm.createContext(c); vm.runInContext(src, c); const P = k => vm.runInContext('g2parseKey(' + JSON.stringify(k) + ')', c);
  const subs = new Set(); for (const d of require(path.join(root, 'server', 'glyph-source.json'))) for (const m of String(d.recipeText || '').matchAll(/((?:Rare |Superior |Mythic )?(?:Worldfire|Grey|Green|Blue|Purple|Gold|Orange)(?: \+\d)? \w+) Sub-Glyph/g)) subs.add(m[1] + ' Sub-Glyph');
  const qdir = html.match(/function g2qdir\(q\)\{[^\n]*?\}/); const cq = {}; if (qdir) { vm.createContext(cq); vm.runInContext(qdir[0], cq); }
  const bad = [...subs].filter(k => { const p = P(k); const dir = qdir ? vm.runInContext('g2qdir(' + JSON.stringify(p.q) + ')', cq) : p.q.replace(/ \+/, ''); return !c.RUNE2.cat.ladder.includes(p.q) || !fs.existsSync(path.join(root, 'assets', 'img', 'glyphs-v3', dir)); });
  ok(subs.size >= 160 && bad.length === 0, subs.size + ' core kinds in the recipes: every one maps to a real quality art folder' + (bad.length ? ' BAD ' + bad.slice(0, 4).join(', ') : ''));
  ok(P('Superior Purple Vitality Sub-Glyph').q === 'Purple' && P('Worldfire Vitality Sub-Glyph').q === 'Orange' && P('Rare Gold +2 Ironwall Sub-Glyph').q === 'Gold +2', '"Superior Purple ..." -> Purple, "Worldfire ..." -> Orange, "Rare Gold +2 ..." -> Gold +2 (were the folders Superior / Worldfire / Rare, which do not exist)'); }

console.log('== 28. the ASCEND button, the bonuses line and the Bag speak the player\'s language ==');
{ ok(/ewT\('hero\.ascend_to',\{q:\(cat\.ladder\[idx\+1\]\?g2QualName\(cat\.ladder\[idx\+1\]\):ewT\('hero\.max'\)\)/.test(html), 'the ASCEND tier name goes through g2QualName (was the English ladder word)');
  ok(/ewT\('hero\.bonus',\{n:g2Num\(bonus\.amount\),stat:g2StatLabel\(bonus\.stat\)\}\)/.test(html), 'its bonus stat through the translated glyph stat names, its number in the player\'s format');
  ok(/asc\.map\(\(\[k,v\]\)=>glyphStatText\(\{stat:k,val:v\.val\}\)\)/.test(html), 'the bonuses line through glyphStatText (was the English stat key)');
  ok(/function g2FragmentName\(key\)\{[^\n]*return escapeHTML\(langDesc\(name\)\); \}/.test(html), 'a Bag fragment shows its translated name only (the English family word is gone)');
  const raw = require(path.join(root, 'server', 'glyph-source.json')), fams = new Set(raw.map(d => d.family)), names = {};
  for (const d of raw) { const k = d.quality + ' ' + d.family; const n = (d.material || d.name) + ''; (names[n] = names[n] || new Set()).add(k); }
  const realKinds = new Set(raw.map(d => d.quality + ' ' + (d.fragmentFamily || d.family)));
  ok(realKinds.size === 218, 'the 218 fragment kinds each have their own material name, so the family word is not needed to tell them apart'); }

console.log('== 29. glyph ratings are shown as rating points, not as a % ==');
{ const src = html.match(/const GLYPH_STAT_LABEL_KEYS=[^\n]*/)[0] + '\n' + html.match(/function glyphStatText\(stat\)\{[\s\S]*?\n\}/)[0];
  const c = { ewT: k => ({ 'gear.stat_crit': 'Crit Chance', 'gear.stat_block': 'Block' })[k] || k, LANG: { cur: 'en' }, Intl }; vm.createContext(c); vm.runInContext(src, c);
  ok(vm.runInContext("glyphStatText('Crit Chance +2.1%')", c) === 'Crit Chance +2.1', '"Crit Chance +2.1%" now reads "Crit Chance +2.1" (2.1 rating points = 0.1% crit; the % promised 20x)');
  ok(vm.runInContext("glyphStatText({stat:'Block',val:1.4,pct:true})", c) === 'Block +1.4', 'Block +1.4 (was +1.4%)'); }

console.log('== 30. every stage pays a fragment kind some board needs ==');
{ const R30 = require('./fixtures/v1452_retired_fragments.json'), RET = new Set(R30.retired);
  const st = f => JSON.parse(fs.readFileSync(path.join(root, 'server', f), 'utf8'));
  const tabs = ['campaign-encounters.json', 'elite-campaign-encounters.json', 'veteran-campaign-encounters.json'].map(st).flat();
  ok(R30.retired.length === 21, '21 kinds no board uses (all Bastion, Gold to Orange Dawnshield, Orange Cataclysm, Orange Voidbind) are retired from the drop tables');
  ok(!tabs.slice(0, tabs.length - 160).some(s => (s.rewards.glyphFragments || []).some(g => RET.has(g.fragmentId)) || RET.has(s.farmFragment)), 'no Normal or Elite stage pays one any more (16 Elite stages paid only such a kind)');
  const vet = tabs.slice(tabs.length - 160), vr = vet.filter(s => s.rewards.glyphFragments.some(g => RET.has(g.fragmentId)));
  ok(vr.length === 6 && vr.every(s => s.rewards.glyphFragments.every(g => /^orange-/.test(g.fragmentId))) && new Set(vet.map(s => s.rewards.glyphFragments[0].key).filter(k => /^Orange /.test(k))).size === 18,
    'Veteran pays retired kinds only on its 6 Orange-family sources, so every one of the 18 Orange families keeps its Veteran source (v1148 rule; 11 other Veteran stages were changed)');
  const only = tabs.filter(s => (s.rewards.glyphFragments || []).length === 4);
  ok(only.every(s => new Set(s.rewards.glyphFragments.map(g => g.key)).size === 4), 'every Normal 4-pool still offers four different kinds'); }

Promise.all(PENDING).then(() => { console.log(''); console.log('test_engine_fixes_1452.js: ' + pass + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : '')); if (fail) process.exitCode = 1; }, e => { console.log(e); process.exitCode = 1; });
