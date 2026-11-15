'use strict';
/* Linnet's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how often each of
   her skills fires and what it reaches in seeded fights with NO talents learned - Mending Stitch (casts, on whom, how much of its burst fits, its mending),
   Reinforced Seam (casts, on whom, the holds it made, how it ended), Rewrite the Pattern (casts, allies it raised and how much, the fallen it returned),
   Golden Thread (how often she was healed, how much it passed on, how often she was at full health when healed), her basic attacks, the hits on her
   allies above 10% of their max HP, and the shields enemies carried.
   Run: node tests/linnet-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __lk={fights:0,ticks:0,ms:0,msSelf:0,msShare:[],msOff:0,msGot:0,msFull:0,hot:0,seam:0,seamSelf:0,seamShare:[],held:0,heldSeam:0,seamEnd:0,seamBroke:0,rw:0,rwRaised:0,rwHp:0,rwRev:0,rwNone:0,gtIn:0,gtFull:0,gtPass:0,gtAmt:0,gtNone:0,autos:0,autoKind:{},hitsOn:0,bigAlly:0,allyHits:0,foeShield:0,foeTicks:0,deaths:0,allyDeaths:0};'+
  'var __lkD=_doEffectCore, __lkH=healUnit, __lkDD=_dealDamageCore, __lkU=_updateBattleCore, __lkCur=null, __lkSeam=[];'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="linnet";'+
  '  if(me&&type==="mendburst"){ __lk.ms++; const l=lowestAlly(u); if(l){ if(l===u) __lk.msSelf++; __lk.msShare.push(l.hp/l.maxHp); } }'+
  '  if(me&&type==="lastbreath"){ __lk.seam++; let b=null,bv=2; alliesOf(u).forEach(a=>{ if(!a.alive)return; const f=a.hp/a.maxHp; if(f<bv){bv=f;b=a;} }); if(b){ if(b===u) __lk.seamSelf++; __lk.seamShare.push(bv); __lkSeam.push({t:b,end:battleTime+((o&&o.dur)||5)}); } }'+
  '  if(me&&type==="rewind"){ __lk.rw++; let k=0; units.filter(a=>a.team===u.team&&!a._dropHidden&&!a._summon).forEach(a=>{ const h=a._hpHist&&a._hpHist.length?a._hpHist[0]:null; if(h==null) return; if(a.alive&&h>a.hp){ k++; __lk.rwHp+=(Math.min(h,a.maxHp)-a.hp)/a.maxHp; } if(!a.alive) __lk.rwRev++; }); __lk.rwRaised+=k; if(!k) __lk.rwNone++; }'+
  '  if(me) __lkCur=type; try{ return __lkD.apply(this,arguments); } finally{ if(me) __lkCur=null; } };'+
  'healUnit=function(u,a){ const room=Math.max(0,worldHealCap(u)-u.hp), h0=u.hp, outer=(typeof __lkOuter!=="undefined")?__lkOuter:null;'+
  '  if(u&&u.key==="linnet"&&u.pass&&u.pass.goldthread&&!u._healing&&a>0){ __lk.gtIn++; if(room<=0) __lk.gtFull++; if(!(u._gtTo&&u._gtTo.alive&&u._gtTo!==u)) __lk.gtNone++; }'+
  '  if(outer&&outer.key==="linnet"&&outer._healing&&u===outer._gtTo){ __lk.gtPass++; }'+
  '  if(__lkCur==="mendburst"&&u&&!(outer)){ __lk.msOff+=a; __lk.msGot+=Math.min(a,room); if(room<=0) __lk.msFull++; }'+
  '  const keep=(typeof __lkOuter!=="undefined")?__lkOuter:null; __lkOuter=u; try{ return __lkH.apply(this,arguments); } finally{ __lkOuter=keep; if(outer&&outer.key==="linnet"&&outer._healing&&u===outer._gtTo) __lk.gtAmt+=Math.max(0,u.hp-h0)/u.maxHp; } };'+
  'var __lkOuter=null;'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(src&&src.key==="linnet"&&_autoAtk&&tgt&&tgt.team!==src.team){ __lk.autos++; }'+
  '  const h0=tgt?tgt.hp:0, s0=tgt?(tgt.shield||0):0; const r=__lkDD.apply(this,arguments);'+
  '  if(tgt&&src&&src.team!==tgt.team&&units.some(x=>x.key==="linnet"&&x.team===tgt.team)){ __lk.allyHits++; const l=(h0-tgt.hp)+(s0-(tgt.shield||0)); if(l>0.10*tgt.maxHp) __lk.bigAlly++; if(tgt.key==="linnet") __lk.hitsOn++; } return r; };'+
  '_updateBattleCore=function(dt){ const L=units.find(u=>u&&u.key==="linnet"&&u.alive); if(L){ __lk.ticks++; for(const e of units) if(e.alive&&e.team!==L.team){ __lk.foeTicks++; if((e.shield||0)>0) __lk.foeShield++; } }'+
  '  for(let i=0;i<__lkSeam.length;i++){ const s=__lkSeam[i]; if(!s.t.alive||battleTime>=s.end-1e-9||!((s.t._wardT||0)>0)){ __lkSeam.splice(i--,1); __lk.seamEnd++; if(s.t.alive&&!((s.t.shield||0)>0)&&battleTime<s.end-0.05) __lk.seamBroke++; } }'+
  '  const f0=floatTexts.length; const r=__lkU.apply(this,arguments); for(let i=f0;i<floatTexts.length;i++){ if(floatTexts[i]&&floatTexts[i].txt==="HELD") __lk.held++; } return r; };');
const team=['linnet','vael','sylthaine','vex','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__lk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__lk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__lk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__lk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', med=a=>{ if(!a.length) return '-'; const b=a.slice().sort((x,y)=>x-y); return b[b.length>>1].toFixed(2); };
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Linnet alive '+(c.ticks*step).toFixed(0)+' s in all');
console.log('Mending Stitch: '+c.ms+' casts, on herself '+c.msSelf+'; the ally\'s HP share at the cast: mean '+avg(c.msShare)+', median '+med(c.msShare)+'; burst offered '+Math.round(c.msOff)+', restored '+Math.round(c.msGot)+' ('+(100*c.msGot/Math.max(1,c.msOff)).toFixed(1)+'%); casts on a full ally '+c.msFull);
console.log('Reinforced Seam: '+c.seam+' casts, on herself '+c.seamSelf+'; the ally\'s HP share: mean '+avg(c.seamShare)+', median '+med(c.seamShare)+'; holds (HELD, any source) '+c.held+'; Seams ended '+c.seamEnd+' (its shield gone before its time '+c.seamBroke+')');
console.log('Rewrite the Pattern: '+c.rw+' casts, allies raised '+c.rwRaised+' (casts that raised nobody '+c.rwNone+'), HP raised '+(100*c.rwHp).toFixed(0)+'% of a max HP in all, fallen returned '+c.rwRev);
console.log('Golden Thread: she was healed '+c.gtIn+' times (at full health '+c.gtFull+', no thread '+c.gtNone+'); it passed on '+c.gtPass+' times, '+(100*c.gtAmt).toFixed(0)+'% of a max HP in all');
console.log('her basic attacks '+c.autos+'; hits on her side '+c.allyHits+' (on her '+c.hitsOn+'), of them above 10% of max HP '+c.bigAlly+'; enemy shields: '+(100*c.foeShield/Math.max(1,c.foeTicks)).toFixed(1)+'% of enemy ticks');
const L=V.arena(snaps([spec('linnet',100)]),snaps([spec('vael',100)]),7); console.log('Linnet: body radius '+V.bodyR(L[0]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', ability power '+Math.round(L[0].apow)+', profile '+L[0].t.damageProfile+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passive '+JSON.stringify(L[0].pass)+' passMul '+L[0].passMul+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb)+', ult '+JSON.stringify(VMX('ULT_DEF.rewind'))+' / art '+JSON.stringify(VMX('(typeof HERO_ULT_ART!=="undefined"&&HERO_ULT_ART.linnet)||null')));
