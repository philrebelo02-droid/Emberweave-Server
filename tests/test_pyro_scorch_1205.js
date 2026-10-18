'use strict';
// v1205 PYROCLAST SCORCH (Phil 18 Oct 2026: "yes" to ONE step; the tester's "Smoke does a lot of damage"; Kimi's SMOKE CLAIM CHECK):
// Ember Lash's Scorch 2.2x -> 1.8x of ability power over its 4 s (dps 0.55 -> 0.45). No browser: the page runs in server/sim-host.js,
// the engine the client and the server replay share. Checks:
//  1. the kit: dps 0.45, dur 4, the hit (mul 1.0) and cd 6 unchanged; nothing else in KITS / ULT_DEF / HERO_TYPES differs from BASE;
//  2. one Ember Lash on a dummy at hero/skill level 1, 50, 100: the hit is BASE's, the Scorch part is 0.45/0.55 of BASE's; Orryn's green
//     unchanged (the sim table for Phil);
//  3. whole fights WITHOUT Pyroclast are BASE tick for tick (3 seeds x 2 line-ups); CONTROL: a fight WITH her differs from BASE.
// BASE = the commit this sits on (EW_BASE, default the parent of the v1205 commit's base).
const fs=require('fs'), path=require('path'), vm=require('vm'), cp=require('child_process'), crypto=require('crypto'), os=require('os');
const ROOT=path.resolve(__dirname,'..');
const BASE_SHA=process.env.EW_BASE||'619fdb65';
let pass=0, fail=0; const ck=(n,ok,d)=>{ if(ok){ pass++; console.log('  ok  '+n); } else { fail++; console.log('  FAIL '+n+(d?' - '+String(d).slice(0,500):'')); } };
const BD=fs.mkdtempSync(path.join(os.tmpdir(),'pyro-base-')); process.on('exit',()=>{ try{ fs.rmSync(BD,{recursive:true,force:true}); }catch(e){} });
fs.mkdirSync(path.join(BD,'server'),{recursive:true});
for(const f of ['emberweave-heroes.html','hero-profiles.js','hero-paths.js','server/temple-of-ash.js','server/patron-benefits.js','server/temple-effects.js'])
  fs.writeFileSync(path.join(BD,f), cp.execSync('git show '+BASE_SHA+':'+f,{cwd:ROOT,maxBuffer:64<<20}));
const load=f=>{ const h=require(path.join(ROOT,'server/sim-host.js')).load(f); return src=>vm.runInContext(src,h.ctx); };
const NOW=load(path.join(ROOT,'emberweave-heroes.html')), OLD=load(path.join(BD,'emberweave-heroes.html'));
console.log('pyroclast scorch 1205 (BASE '+BASE_SHA+')');
// 1. the data
{ const k=JSON.parse(NOW('JSON.stringify(KITS.pyroclast.green)')), b=JSON.parse(OLD('JSON.stringify(KITS.pyroclast.green)'));
  ck('Ember Lash Scorch dps 0.45 for 4 s (was '+b.dps+')', k.dps===0.45&&k.dur===4&&b.dps===0.55);
  ck('the hit, cooldown and everything else on Ember Lash unchanged', JSON.stringify(Object.assign({},k,{dps:0}))===JSON.stringify(Object.assign({},b,{dps:0})));
  const strip=s=>{ const o=JSON.parse(s); delete o.pyroclast; return JSON.stringify(o); };
  ck('KITS of every other hero = BASE', strip(NOW('JSON.stringify(KITS)'))===strip(OLD('JSON.stringify(KITS)')));
  ck('HERO_TYPES and ULT_DEF = BASE', NOW('JSON.stringify([HERO_TYPES,ULT_DEF])')===OLD('JSON.stringify([HERO_TYPES,ULT_DEF])')); }
// 2. one cast on a dummy
const cast=(run,key,lv,noDot)=>run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(11);
  const saved=JSON.stringify(KITS.${key}.green); ${noDot?`KITS.${key}.green.dps=1e-9;`:''}
  const c=makeUnit('${key}','ally',300,700,${lv},{owned:false,rank:3}), t=makeUnit('grosk','enemy',520,700,${lv},{owned:false,rank:3});
  units=[c,t]; t.maxHp=t.hp=1e9; t.armor=0; t.mr=0; t.eva=0; t.block=0; t.dmgRed=0; t.speed=0; t.atkInterval=99; t.atkCd=99; t.greenCd=t.blueCd=99; t.energy=0;
  c.atkInterval=99; c.atkCd=99; c.crit=0; c.energy=0; c.target=t; c.greenCd=c.blueCd=99; c._castLv=${lv}; c._castSM=skillMul(${lv});
  castKit(c,KITS.${key}.green); const hp0=t.hp; for(let i=0;i<30*8;i++) updateBattle(1/30); KITS.${key}.green=JSON.parse(saved);
  return Math.round(hp0-t.hp); })()`);
const table=[];
for(const lv of [1,50,100]){
  const nowAll=cast(NOW,'pyroclast',lv), oldAll=cast(OLD,'pyroclast',lv), hit=cast(NOW,'pyroclast',lv,true), oldHit=cast(OLD,'pyroclast',lv,true);
  const or=cast(NOW,'orryn',lv), orOld=cast(OLD,'orryn',lv);
  table.push({lv,before:oldAll,after:nowAll,hit,orryn:or,beforeVsOrryn:+(oldAll/or).toFixed(2),afterVsOrryn:+(nowAll/or).toFixed(2)});
  ck('L'+lv+': the Ember Lash hit is BASE\'s ('+hit+' = '+oldHit+')', hit===oldHit);
  const r=(nowAll-hit)/(oldAll-oldHit); ck('L'+lv+': the Scorch is 0.45/0.55 of BASE\'s ('+(nowAll-hit)+' vs '+(oldAll-oldHit)+', ratio '+r.toFixed(3)+')', Math.abs(r-0.45/0.55)<0.03);
  ck('L'+lv+': Orryn\'s green unchanged ('+or+')', or===orOld); }
console.log('  table (one cast on one target, cd 6 for both):');
console.log('  level | Pyroclast before | after | of which the hit | Orryn | before/Orryn | after/Orryn');
for(const t of table) console.log('  '+[t.lv,t.before,t.after,t.hit,t.orryn,t.beforeVsOrryn+'x',t.afterVsOrryn+'x'].join(' | '));
// 3. whole fights
const digest=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const fight=(run,seed,A,E)=>digest(run(`(()=>{window._p2guard=true;autoUlt=true;ended=false;state='battle';CUR={mode:'replay',seed:${seed}};battleTime=0;gameSpeed=1;groundHazards=[];seedBattle(${seed});units=[];
  ${JSON.stringify(A)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*20,600+i*40,30,{owned:false,rank:3})));${JSON.stringify(E)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',800+i*20,600+i*40,30,{owned:false,rank:3})));
  units.forEach(u=>buildFigure(u));const trace=[];for(let i=0;i<Math.round(35/SIM_STEP)&&!ended;i++){updateBattle(SIM_STEP);trace.push(units.map(u=>[u.key,u.hp,u.x,u.y,u.alive,u.energy,u.stunned].join(':')).join('|'));}window._p2guard=false;return trace.join('#');})()`));
const LINES=[[['vael','fritz','hobb','sylthaine','vireo'],['grosk','tick','joss','iver','ambrel']],[['orryn','astra','umbris','absalie','vulmar'],['konwu','tessit','vesper','lumi','rivet']]];
for(const [A,E] of LINES) for(const seed of [17,222,777]) ck('a fight without Pyroclast is BASE tick for tick ('+A[0]+'... vs '+E[0]+'..., seed '+seed+')', fight(NOW,seed,A,E)===fight(OLD,seed,A,E));
{ const A=['pyroclast','fritz','hobb','sylthaine','vireo'], E=['grosk','tick','joss','iver','ambrel'];
  ck('CONTROL: a fight WITH Pyroclast differs from BASE (the change reaches the fight)', fight(NOW,17,A,E)!==fight(OLD,17,A,E)); }
console.log('pyroclast scorch 1205: '+pass+' passed, '+fail+' failed');
if(fail) process.exitCode=1;
