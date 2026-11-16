'use strict';
/* Vesper's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how often each of her
   skills fires and what it reaches in seeded fights with NO talents learned - Errata (casts, the enemies its field ticks on, the silences it writes and how long,
   who stands in it: enemies, allies, herself), Loose Leaf (casts, enemies cut on the way out, on the way back, by both passes), Puncture (casts, enemies frozen,
   resisted, the freeze and the silence as landed, the silence left after the freeze), Scriptorium (energy given), her basic attacks (count, damage kind), the
   damage kind of every skill hit, the enemies' own Green / Blue presses (the casts her Corrections and Struck Outs act on) and the ultimates her allies use.
   Run: node tests/vesper-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __vk={fights:0,ticks:0,err:0,errNone:0,errTgtIn:0,errUniq:[],errSil:0,errSilU:[],silLen:[],errTicks:0,errTickHits:0,inErrE:0,inErrA:0,inErrMe:0,ll:0,llOut:[],llBack:[],llBoth:[],llNone:0,pun:0,punFz:0,punRes:0,punSilRes:0,fzLen:[],silAt:[],silAfter:[],autos:0,autoKind:{},skillKind:{},enemyPress:0,enemyPressAb:0,enemyWithAb:0,enemies:0,allyUlt:0,myUlt:0,scrE:0,silencedHitsOnMe:0,hitsOnMe:0};'+
  'var __vD=_doEffectCore, __vU=_updateBattleCore, __vDD=_dealDamageCore, __vC=ccApply, __vIn=0, __vLL=null, __vF=0, __vSeen=new Set();'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="vesper"&&(!o||!o.deliver||o._arrived); const al=u&&u.team===(units.find(x=>x.key==="vesper")||{}).team;'+
  '  if(u&&u.key!=="vesper"&&u._castSlot==="ult"&&(!o||!o.deliver||o._arrived)&&al) __vk.allyUlt++;'+
  '  if(!me) return __vD.apply(this,arguments);'+
  '  const n0=groundHazards.length; __vIn++; let r;'+
  '  if(type==="pagestorm"){ __vk.ll++; __vLL={out:new Set(),back:new Set(),u}; }'+
  '  if(type==="riftpuncture"){ __vk.pun++; __vk.myUlt++; }'+
  '  try{ r=__vD.apply(this,arguments); } finally{ __vIn--; }'+
  '  if(type==="erratafield"){ __vk.err++; const h=groundHazards[groundHazards.length-1]; if(h&&h.src===u&&h.silence){ h.__vp=++__vF; h.__seen=new Set(); h.__sil=new Set(); const t=o&&o._tgtU; if(t&&t.alive&&Math.hypot(t.x-h.x,t.y-h.y)<=h.r) __vk.errTgtIn++; } }'+
  '  if(type==="pagestorm"&&__vLL){ __vk.llOut.push(__vLL.out.size); if(!__vLL.out.size) __vk.llNone++; const L=__vLL; __vLL=null; if(u._pageBack) u._pageBack.__vL=L; }'+
  '  if(type==="riftpuncture"){ for(const e of enemiesOf(u)){ if(!e.alive) continue; __vk.silAt.push(e.silencedT||0); __vk.silAfter.push(Math.max(0,(e.silencedT||0)-(e.stunned||0))); } }'+
  '  return r; };'+
  'ccApply=function(u,t,f,d){ const r=__vC.apply(this,arguments); if(u&&u.key==="vesper"&&u._castSlot==="ult"){ if(f==="stunned"){ if(r){ __vk.punFz++; __vk.fzLen.push(t.stunned); } else __vk.punRes++; } if(f==="silencedT"&&!r) __vk.punSilRes++; } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const auto=_autoAtk;'+
  '  if(src&&src.key==="vesper"&&tgt&&tgt.team!==src.team){ const k=kind||((src.t&&["Magic","Healer"].includes(src.t.damageProfile))?"magic":"phys");'+
  '    if(auto){ __vk.autos++; __vk.autoKind[k]=(__vk.autoKind[k]||0)+1; }'+
  '    else { const sk=__vIn?(src._castSlot||"?"):"back"; const key=sk+":"+k; __vk.skillKind[key]=(__vk.skillKind[key]||0)+1;'+
  '      if(__vLL&&__vIn) __vLL.out.add(tgt); if(!__vIn&&src.__vBack) src.__vBack.back.add(tgt); } }'+
  '  if(tgt&&tgt.key==="vesper"&&src&&src.team!==tgt.team){ __vk.hitsOnMe++; if((src.silencedT||0)>0) __vk.silencedHitsOnMe++; }'+
  '  return __vDD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ const Vs=units.filter(u=>u&&u.key==="vesper"&&u.alive), pend=new Map(), sil=new Map();'+
  '  for(const u of units){ if(u.alive){ pend.set(u,u._pend||null); sil.set(u,u.silencedT||0); } }'+
  '  for(const u of Vs){ __vk.ticks++; if(u._pageBack&&u._pageBack.t<=dt+1e-9&&u._pageBack.__vL){ u.__vBack=u._pageBack.__vL; } else u.__vBack=null; }'+
  '  const res=__vU.apply(this,arguments);'+
  '  for(const u of Vs){ if(u.__vBack){ const L=u.__vBack; __vk.llBack.push(L.back.size); let b=0; for(const e of L.back) if(L.out.has(e)) b++; __vk.llBoth.push(b); u.__vBack=null; }'+
  '    for(const h of groundHazards){ if(!h.__vp||h.src!==u) continue; for(const e of units){ if(!e.alive) continue; const inn=Math.hypot(e.x-h.x,e.y-h.y)<=h.r;'+
  '        if(e.team!==u.team){ if(inn){ __vk.inErrE++; h.__seen.add(e); } if((e.silencedT||0)>(sil.get(e)||0)+1e-9&&inn){ __vk.errSil++; if(!h.__sil.has(e)){ h.__sil.add(e); } __vk.silLen.push(e.silencedT); } }'+
  '        else if(inn){ if(e===u) __vk.inErrMe++; else if(!e._summon) __vk.inErrA++; } } }'+
  '    if(u.pass&&u.pass.scriptorium) __vk.scrE+=(u.passMul||1)*dt*alliesOf(u).filter(a=>a.alive).length; }'+
  '  for(const h of groundHazards){ if(h.__vp&&!h.__done&&h.life<=dt+1e-9){ h.__done=1; __vk.errUniq.push(h.__seen.size); __vk.errSilU.push(h.__sil.size); if(!h.__seen.size) __vk.errNone++; } }'+
  '  for(const u of units){ if(!u.alive||!Vs.length||u.team===Vs[0].team) continue; if(!__vSeen.has(u)){ __vSeen.add(u); __vk.enemies++; if(u.greenAb||u.blueAb) __vk.enemyWithAb++; }'+
  '    const p=u._pend||null; if(p&&p!==pend.get(u)){ __vk.enemyPress++; if(p.spell) __vk.enemyPressAb++; } }'+
  '  return res; };');
const team=['vesper','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__vk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__vk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__vk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__vk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', med=a=>{ if(!a.length) return '-'; const s=a.slice().sort((x,y)=>x-y); return (+s[s.length>>1]).toFixed(2); }, hist=a=>{ const h={}; for(const x of a){ const k=(+x).toFixed(2); h[k]=(h[k]||0)+1; } return JSON.stringify(h); };
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Vesper alive '+(c.ticks*step).toFixed(0)+' s in all; her basic attacks '+c.autos+' '+JSON.stringify(c.autoKind)+'; her skill hits by slot:kind '+JSON.stringify(c.skillKind));
console.log('Errata: '+c.err+' casts, its target inside the field at the landing '+c.errTgtIn+'; enemies its field stood on (each field) '+hist(c.errUniq)+', fields on nobody '+c.errNone+'; silence writes that raised an enemy\'s silence '+c.errSil+', enemies silenced per field '+hist(c.errSilU)+', silence as written '+hist(c.silLen)+'; enemy-ticks inside '+c.inErrE+', ally-ticks inside '+c.inErrA+', her own ticks inside '+c.inErrMe+' of '+c.ticks);
console.log('Loose Leaf: '+c.ll+' casts, out pass enemies '+hist(c.llOut)+' (none '+c.llNone+'), back pass enemies '+hist(c.llBack)+', enemies cut by both passes '+hist(c.llBoth));
console.log('Puncture: '+c.pun+' casts, freezes landed '+c.punFz+', resisted '+c.punRes+' (silences resisted '+c.punSilRes+'), freeze as landed '+hist(c.fzLen)+', silence at the cast '+hist(c.silAt)+', silence left after the freeze '+hist(c.silAfter));
console.log('enemies met '+c.enemies+', with a Green or Blue '+c.enemyWithAb+'; enemy presses '+c.enemyPress+' (Green / Blue '+c.enemyPressAb+'); ultimates her allies used '+c.allyUlt+', her own '+c.myUlt+'; Scriptorium energy given (ally-seconds x passive) '+c.scrE.toFixed(0)+'; hits on her '+c.hitsOnMe+', from a silenced enemy '+c.silencedHitsOnMe);
const L=V.arena(snaps([spec('vesper',100)]),snaps([spec('vael',100)]),7), k=L[0];
console.log('body radius: Vesper '+V.bodyR(k).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+k.atkInterval.toFixed(3)+' s; max HP '+Math.round(k.maxHp)+', AP '+Math.round(k.apow)+', range '+(k.range/V.METER).toFixed(2)+' m; row '+(k.t&&k.t.row)+'; passive '+JSON.stringify(k.pass)+' x'+k.passMul+', green '+JSON.stringify(k.greenAb)+', blue '+JSON.stringify(k.blueAb)+', ult '+JSON.stringify(VMX('Object.assign({},ULT_DEF.riftpuncture,(typeof HERO_ULT_ART!=="undefined"&&HERO_ULT_ART.vesper)||{})')));
console.log('skill options as cast (skillScaleOpts at level 100): green '+JSON.stringify(VMX('skillScaleOpts(KITS.vesper.green,skillMul(100),100)'))+'; ult '+JSON.stringify(VMX('skillScaleOpts(Object.assign({},ULT_DEF.riftpuncture,HERO_ULT_ART.vesper),skillMul(100),100)'))+'; ccDur(1) '+VMX('ccDur(1)')+', caps '+JSON.stringify(VMX('CC_DUR_MAX'))+'; BATTLE_PACE '+VMX('BATTLE_PACE')+', UNIT_SIZE '+VMX('UNIT_SIZE')+', METER '+V.METER+'; the Errata tick colour as a kind: '+VMX('dotDmgKind(units[0],"#c9a227")'));
