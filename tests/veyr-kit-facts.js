'use strict';
/* Veyr's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each of his
   skills fires and what it does in seeded fights with NO talents learned - Gravity Crescent (casts, the nearest enemy it cuts: AP x 1.5 magic + the fight's rage,
   the root as stunned after ccDur's 30% cut), Abyssal Mantle (casts, the evade-window spends, the counter: AP x 2.0 magic + rage), Abyssal Undertow (casts,
   enemies caught in the 7 m drag, the collapse: AP x 1.9 magic + rage each, the 2 s slow after ccDur's cut), Weightless Predator (a pay = haste +0.08 x passMul
   for 5 s, capped 1.6, and +0.05 x passMul crit, capped 0.6, on the evade-window spend ONLY), his basic attacks (count, damage kind: a Magic hero's autos are magic).
   Run: node tests/veyr-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __vk={fights:0,ticks:0,gc:0,gcDmg:[],gcKind:{},gcRoot:[],mantle:0,spends:0,ctrs:0,ctrDmg:[],ctrKind:{},ult:0,caught:[],colDmg:[],colKind:{},slows:[],wl:0,wlHaste:[],wlCrit:[],autos:0,autoKind:{},skillKind:{}};'+
  'var __vD=_doEffectCore, __vU=_updateBattleCore, __vDD=_dealDamageCore, __vC=ccApply, __vIn=0;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="veyr"&&(!o||!o.deliver||o._arrived);'+
  '  if(!me) return __vD.apply(this,arguments);'+
  '  __vIn++; let r;'+
  '  if(type==="tendrilpull") __vk.gc++;'+
  '  if(type==="evadecounter") __vk.mantle++;'+
  '  if(type==="abyssalundertow") __vk.ult++;'+
  '  try{ r=__vD.apply(this,arguments); } finally{ __vIn--; }'+
  '  return r; };'+
  'ccApply=function(u,t,f,d){ const r=__vC.apply(this,arguments); if(u&&u.key==="veyr"&&u._castSlot==="green"&&f==="stunned"&&r) __vk.gcRoot.push(t.stunned); return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const auto=_autoAtk;'+
  '  if(tgt&&tgt.key==="veyr"&&src&&src.team!==tgt.team&&(tgt._evadeT||0)>0&&!tgt._ctring) __vk.spends++;'+
  '  if(src&&src.key==="veyr"&&tgt&&tgt.team!==src.team){ const k=kind||((src.t&&["Magic","Healer"].includes(src.t.damageProfile))?"magic":"phys");'+
  '    if(auto){ __vk.autos++; __vk.autoKind[k]=(__vk.autoKind[k]||0)+1; }'+
  '    else if(src._ctring){ __vk.ctrs++; __vk.ctrDmg.push(amt); __vk.ctrKind[k]=(__vk.ctrKind[k]||0)+1; }'+
  '    else if(__vIn>0&&src._castSlot==="green"){ __vk.gcDmg.push(amt); __vk.gcKind[k]=(__vk.gcKind[k]||0)+1; }'+
  '    else if(!__vIn){ __vk.colDmg.push(amt); __vk.colKind[k]=(__vk.colKind[k]||0)+1; }'+
  '    else { const key=src._castSlot+":"+k; __vk.skillKind[key]=(__vk.skillKind[key]||0)+1; } }'+
  '  return __vDD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ const Vs=units.filter(u=>u&&u.key==="veyr"&&u.alive);'+
  '  const wl0=new Map(), sl0=new Map();'+
  '  for(const u of Vs) wl0.set(u,{h:u.hasteT||0,c:u.glyphCrit||0});'+
  '  for(const e of units) if(e.alive) sl0.set(e,e.slow||0);'+
  '  const res=__vU.apply(this,arguments);'+
  '  for(const u of Vs){ __vk.ticks++; const b=wl0.get(u);'+
  '    if((u.hasteT||0)>0&&b.h<=0){ __vk.wl++; __vk.wlHaste.push((u.hasteMul||1)-1); __vk.wlCrit.push((u.glyphCrit||0)-b.c); }'+
  '    if(u._horizon&&u._horizon.__n==null){ u._horizon.__n=1; __vk.caught.push(u._horizon.caught.length); } }'+
  '  for(const e of units){ if(!e.alive||!Vs.length||e.team===Vs[0].team) continue;'+
  '    const s0=sl0.get(e)||0; if((e.slow||0)>s0+1e-9) __vk.slows.push(e.slow); }'+
  '  return res; };');
const team=['veyr','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__vk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__vk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__vk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__vk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):'-', med=a=>{ if(!a.length) return '-'; const s=a.slice().sort((x,y)=>x-y); return (+s[s.length>>1]).toFixed(2); }, hist=a=>{ const h={}; for(const x of a){ const k=(+x).toFixed(2); h[k]=(h[k]||0)+1; } return JSON.stringify(h); };
const L=V.arena(snaps([spec('veyr',100)]),snaps([spec('vael',100)]),7), k=L[0];
console.log('fights '+c.fights+'; Veyr alive '+(c.ticks*VMX('SIM_STEP')).toFixed(0)+' s in all; his basic attacks '+c.autos+' '+JSON.stringify(c.autoKind)+'; his other skill hits by slot:kind '+JSON.stringify(c.skillKind));
console.log('Gravity Crescent: '+c.gc+' casts, cut damage '+c.gcDmg.length+' hits '+JSON.stringify(c.gcKind)+' avg '+avg(c.gcDmg)+' = '+avg(c.gcDmg.map(x=>x/k.apow))+' x his AP (mul 1.5 + the fight rage); root as stunned '+hist(c.gcRoot)+' (the 3.33 s drag x 0.7)');
console.log('Abyssal Mantle: '+c.mantle+' casts, evade-window spends '+c.spends+', counters landed '+c.ctrs+' '+JSON.stringify(c.ctrKind)+' avg '+avg(c.ctrDmg)+' = '+avg(c.ctrDmg.map(x=>x/k.apow))+' x his AP (mul 2.0 + rage); a spend always pays Weightless and lands the counter');
console.log('Abyssal Undertow: '+c.ult+' casts, caught per cast '+hist(c.caught)+'; collapse damage '+c.colDmg.length+' hits '+JSON.stringify(c.colKind)+' avg '+avg(c.colDmg)+' = '+avg(c.colDmg.map(x=>x/k.apow))+' x his AP (mul 1.9 + rage); slow written '+hist(c.slows)+' (2 s x 0.7 = 1.4)');
console.log('Weightless Predator: '+c.wl+' pays on window spends only (of '+c.spends+'), haste gained '+hist(c.wlHaste)+' of +0.08 x '+k.passMul.toFixed(3)+' = +'+(0.08*k.passMul).toFixed(4)+' (cap 1.6 x, 5 s); crit gained '+hist(c.wlCrit)+' of +'+(0.05*k.passMul).toFixed(4)+' (cap 0.6)');
console.log('body radius: Veyr '+V.bodyR(k).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+k.atkInterval.toFixed(3)+' s; max HP '+Math.round(k.maxHp)+', AP '+Math.round(k.apow)+', dmg(attack) '+Math.round(k.dmg)+', range '+(k.range/V.METER).toFixed(2)+' m; row '+(k.t&&k.t.row)+'; passive '+JSON.stringify(k.pass)+' x'+k.passMul.toFixed(3)+' = Weightless Predator');
console.log('ult def '+JSON.stringify(VMX('Object.assign({},ULT_DEF.abyssalundertow,(typeof HERO_ULT_ART!=="undefined"&&HERO_ULT_ART.veyr)||{})'))+'; green as cast (skillScaleOpts at level 100) '+JSON.stringify(VMX('skillScaleOpts(KITS.veyr.green,skillMul(100),100)'))+'; BATTLE_PACE '+VMX('BATTLE_PACE')+', METER '+V.METER+', ccDur(3.33) '+VMX('ccDur(3.33)')+', ccDur(2) '+VMX('ccDur(2)'));
