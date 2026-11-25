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
    ok(r.at != null && r.fired === 0 && !r.pend, f + ' 0.6 s into Frozen Orb\'s 1 s wind-up: the spell never fires (was: it fired when a stun or fear ended)');
    ok(r.cd > 0, f + ': the cooldown stays spent (' + (+r.cd).toFixed(2) + ' s left at the cancel)'); }
  // CONTROL: with no control the spell fires once
  setup([spec('quorrel', 30)], [spec('sylthaine', 30)], 7, (a, b) => a.concat(b).forEach(s => { s.ctrlRes = 0; }));
  R(`__freeze(); window.A=U('quorrel'); window.B=U('sylthaine'); B.x=500; B.y=300; A.x=500; A.y=900; B.greenAb=KITS.sylthaine.green; B.greenCd=0; B.atkCd=1e9; B.target=A;
     window.__FIRE=0; window.__de0=_doEffectCore; _doEffectCore=function(u,type,o){ if(u&&u.key==='sylthaine') window.__FIRE++; return window.__de0.apply(this,arguments); };`);
  ok(J('(function(){ for(let i=0;i<160;i++) updateBattle(SIM_STEP); _doEffectCore=window.__de0; return window.__FIRE; })()') === 1, 'CONTROL: uninterrupted, Frozen Orb fires exactly once'); }

console.log(''); console.log('test_engine_fixes_1452.js: ' + pass + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : '')); if (fail) process.exitCode = 1;
