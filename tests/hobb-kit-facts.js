'use strict';
/* Hobb Kilnmask's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how
   often each of his skills fires and what it reaches in seeded fights, how long Sealed Vessel holds and what it writes in his skill slot, how Fired Clay
   climbs, how his basic attacks fall on one enemy, the hits he takes, and how much a reference hit on him is reduced tick by tick. No talents learned.
   Run: node tests/hobb-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __hk={fights:0,ticks:0,gz:0,gzHit:0,gzShred:[],gzOnShred:0,sv:0,svMul:[],svTicks:0,ks:0,ksHit:0,ksStun:0,ksStunTry:0,ksFear:0,ksFearTry:0,ksStunS:[],ksFearS:[],ksPer:[],'+
  'auto:0,sameRow:[],third:0,stk:[0,0,0,0,0,0],capT:0,capAt:[],hitsOn:0,physOn:0,magOn:0,critOn:0,big15:0,backOn:0,red:{n:0,p:0,m:0,p85:0,m85:0,any85:0,pmax:0,mmax:0,vp:0,vn:0},deaths:0,waves:0,arm:[],mr:[],dmP:[],dmM:[]};'+
  'var __hkD=_doEffectCore, __hkDD=_dealDamageCore, __hkU=_updateBattleCore, __hkCC=ccApply, __hkCur=null, __hkN=0, __hkLast={}, __hkW={};'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="hobb"&&(!o||!o.deliver||o._arrived); const was=__hkCur; if(me){ __hkCur=type; __hkN=0;'+
  '    if(type==="shred"){ __hk.gz++; const t=(u.target&&u.target.alive)?u.target:nearestEnemy(u); if(t&&(t._shredT||0)>0) __hk.gzOnShred++; }'+
  '    if(type==="defensive") __hk.sv++; if(type==="aoeStun") __hk.ks++; }'+
  '  try{ return __hkD.apply(this,arguments); } finally{ if(me){ if(type==="aoeStun") __hk.ksPer.push(__hkN);'+
  '      if(type==="shred"){ const t=(u.target&&u.target.alive)?u.target:nearestEnemy(u); if(t) __hk.gzShred.push(+(t._shredPct||0).toFixed(4)); }'+
  '      if(type==="defensive"){ __hk.svMul.push(+(u.drMul).toFixed(4)); u.__svMul=u.drMul; } } __hkCur=was; } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const h0=tgt?tgt.hp+(tgt.shield||0):0, au=_autoAtk;'+
  '  const r=__hkDD.apply(this,arguments); const got=tgt?h0-tgt.hp-(tgt.shield||0):0;'+
  '  if(src&&src.key==="hobb"&&got>0){ if(__hkCur==="shred") __hk.gzHit++; if(__hkCur==="aoeStun"){ __hk.ksHit++; __hkN++; }'+
  '    if(!__hkCur&&au){ __hk.auto++; const L=__hkLast[src.uid]; if(L&&L.t===tgt.uid) L.n++; else { if(L) __hk.sameRow.push(L.n); __hkLast[src.uid]={t:tgt.uid,n:1}; } if(__hkLast[src.uid].n===3) __hk.third++; } }'+
  '  if(tgt&&tgt.key==="hobb"&&src&&src.team!==tgt.team&&got>0){ __hk.hitsOn++; if(kind==="magic") __hk.magOn++; else if(kind!=="true") __hk.physOn++; if(tgt._critHit) __hk.critOn++;'+
  '    if(got>0.15*tgt.maxHp) __hk.big15++; if(src.t&&src.t.row==="Back") __hk.backOn++; }'+
  '  return r; };'+
  'ccApply=function(u,t,field,dur){ const me=u&&u.key==="hobb"&&__hkCur==="aoeStun"; const b=t?(t[field]||0):0; const r=__hkCC.apply(this,arguments);'+
  '  if(me){ if(field==="stunned"){ __hk.ksStunTry++; if(r){ __hk.ksStun++; __hk.ksStunS.push(+(t.stunned).toFixed(3)); } } if(field==="fearT"){ __hk.ksFearTry++; if(r){ __hk.ksFear++; __hk.ksFearS.push(+(t.fearT).toFixed(3)); } } } return r; };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="hobb"&&u.alive)) continue; __hk.ticks++; const s=Math.min(5,u.wardenStk||0); __hk.stk[s]++;'+
  '    const cut=(u.pass&&u.pass.warden&&u.wardenStk)?wardenCut(u):0, cap=SKLV.wardenCap(passLv(u)); const w=__hkW[u.uid]||(__hkW[u.uid]={t0:battleTime,at:null}); if(cut>=cap-1e-9&&cut>0){ __hk.capT++; if(w.at==null){ w.at=battleTime-w.t0; __hk.capAt.push(+w.at.toFixed(2)); } }'+
  '    const vs=(u.drT>0&&u.__svMul!=null&&Math.abs(u.drMul-u.__svMul)<1e-9); if(vs) __hk.svTicks++;'+
  '    let src=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ src=e; break; } if(!src) src=nearestEnemy(u); if(!src) continue;'+
  '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1)*(1-cut), dp=defMul(src,u,"phys"), dm=defMul(src,u,"magic"), rp=1-k*dp, rm=1-k*dm, R=__hk.red;'+
  '    R.n++; R.p+=rp; R.m+=rm; if(rp>=0.85) R.p85++; if(rm>=0.85) R.m85++; if(rp>=0.85||rm>=0.85) R.any85++; R.pmax=Math.max(R.pmax,rp); R.mmax=Math.max(R.mmax,rm); if(vs){ R.vn++; R.vp+=rp; }'+
  '    if(__hk.ticks%60===0){ __hk.arm.push(u.armorRating||0); __hk.mr.push(u.mrRating||0); __hk.dmP.push(dp); __hk.dmM.push(dm); } }'+
  '  const r=__hkU.apply(this,arguments); return r; };'+
  'var __hkRW=resetPerWave; resetPerWave=function(){ __hk.waves++; for(const u of units) if(u&&u.key==="hobb") __hkW[u.uid]={t0:battleTime,at:null}; return __hkRW.apply(this,arguments); };');
const team=['hobb','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
const begin=()=>VMX('__hkLast={}; __hkW={}; for(const u of units) if(u&&u.key==="hobb") __hkW[u.uid]={t0:battleTime,at:null}; __hk.fights++');
VMX('var __hkSB=seedBattle; seedBattle=function(){ const r=__hkSB.apply(this,arguments); __hkW={}; return r; }');
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ begin(); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ begin(); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); begin(); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__hk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
console.log('fights '+c.fights+' (12 campaign, 8 two-sided), waves '+c.waves+'; Hobb alive '+(c.ticks/30).toFixed(0)+' s in all');
console.log('Glazebreaker: '+c.gz+' casts, '+c.gzHit+' hits that took HP; its target already armour-cut at the cast '+c.gzOnShred+'; armour cut on the target after it '+hist(c.gzShred));
console.log('Sealed Vessel: '+c.sv+' casts; skill slot written '+hist(c.svMul)+'; its value held in his slot '+pc(c.svTicks,c.ticks)+' of his time');
console.log('Grand Kiln Shape: '+c.ks+' casts, '+c.ksHit+' hits (per cast '+avg(c.ksPer)+' '+hist(c.ksPer)+'); stuns tried '+c.ksStunTry+', landed '+c.ksStun+' '+hist(c.ksStunS)+'; fears tried '+c.ksFearTry+', landed '+c.ksFear+' '+hist(c.ksFearS));
console.log('Fired Clay: time at 0..5 stacks '+c.stk.map(x=>pc(x,c.ticks)).join(' / ')+'; at its cap '+pc(c.capT,c.ticks));
console.log('basic attacks that took HP: '+c.auto+'; in a row on one enemy '+hist(c.sameRow)+' (mean '+avg(c.sameRow)+'); a 3rd in a row '+c.third+' times');
console.log('hits on him that took HP: '+c.hitsOn+' (physical '+c.physOn+', magic '+c.magOn+', critical '+c.critOn+', from the back row '+c.backOn+'), more than 15% of his max HP '+c.big15);
const R=c.red; console.log('a reference hit on him, each tick (his attacker or the nearest enemy): physical mean '+(100*R.p/Math.max(1,R.n)).toFixed(1)+'% (max '+(100*R.pmax).toFixed(1)+'%), magic mean '+(100*R.m/Math.max(1,R.n)).toFixed(1)+'% (max '+(100*R.mmax).toFixed(1)+'%); share of his time at 85% or more: physical '+pc(R.p85,R.n)+', magic '+pc(R.m85,R.n)+', either '+pc(R.any85,R.n)+'; inside Sealed Vessel physical mean '+(100*R.vp/Math.max(1,R.vn)).toFixed(1)+'%');
console.log('armour rating '+avg(c.arm)+', magic resist '+avg(c.mr)+', armour leaves '+avg(c.dmP)+' of a physical hit, magic resist '+avg(c.dmM)+' of a magic one');
const L=V.arena(snaps([Object.assign(spec('hobb',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), h=L[0];
console.log('body radius: Hobb '+V.bodyR(h).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+h.atkInterval.toFixed(3)+' s; max HP '+Math.round(h.maxHp)+', attack '+Math.round(h.dmg)+', melee '+!!h.melee+', range '+(h.range/V.METER).toFixed(2)+' m; passive '+JSON.stringify(h.pass)+', passMul '+(h.passMul||1).toFixed(3)+', Fired Clay cap '+VMX('(u=>SKLV.wardenCap(passLv(u)))')(h).toFixed(3)+'; Glazebreaker cut at skill 100 '+VMX('shredAt(0.30,skillMul(100))').toFixed(4)+'; Sealed Vessel slot at 100 '+VMX('skLvNum')('defensive',VMX('KITS.hobb.blue'),100).toFixed(4)+'; ult '+JSON.stringify(VMX('ULT_DEF.aoeStun'))+' + '+JSON.stringify(VMX('HERO_ULT_ART.hobb')));
