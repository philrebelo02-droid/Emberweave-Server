'use strict';
/* Orryn's real kit, measured (not a test: run with plain node on the cluster). What his talents build on: how often each skill fires and what it reaches,
   how many casts Abyssal Reserve empowers (and which), how long enemies stand in his two waters (Spiral Current's travelling whirlpool, Ocean Without
   Shore's 6 m flood), how much energy his Spiral Current really keeps from enemies, how far enemies stand from him (Still Mind: 4 m body to body),
   and the hits on him. No talents learned. 20 seeded fights: 12 campaign, 8 two-sided.
   Run: node tests/orryn-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __ok={fights:0,ticks:0,press:{green:0,blue:0},emp:{green:0,blue:0},sph:0,sphHit:0,sphNone:0,sphKill:0,blue:0,ult:0,'+
  ' scTicks:0,scTickHit:0,scEnemyTicks:0,scDistinct:0,scNone:0,ulTicks:0,ulTickHit:0,ulEnemyTicks:0,ulDistinct:0,ulNone:0,ulRad:0,'+
  ' scInSecs:[],ulInSecs:[],denied:0,deniedTicks:0,nearTicks:0,hitsOn:0,meleeHitsOn:0,kindSc:"",kindSph:"",prog:[],ulGap:0,scLen:[]};'+
  'var __okD=_doEffectCore, __okU=_updateBattleCore, __okK=castKit, __okDD=_dealDamageCore, __okH=new Map(), __okE=new Map();'+
  'castKit=function(u,ab){ if(u&&u.key==="orryn"){ const s=(u.blueAb&&ab===u.blueAb)?"blue":"green"; __ok.press[s]++; if(u._prReady) __ok.emp[s]++; } return __okK.apply(this,arguments); };'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="orryn"; const n0=groundHazards.length;'+
  '  if(me&&type==="strike"&&o&&o._arrived){ __ok.sph++; const t=o._tgtU; if(t&&t.alive) __ok.sphHit++; else __ok.sphNone++; }'+
  '  const r=__okD.apply(this,arguments);'+
  '  if(me&&type==="ashfall"&&(!o||!o.deliver||o.deliver==="travel"||o._arrived)){ const ult=u._castSlot==="ult"; if(ult) __ok.ult++; else __ok.blue++;'+
  '    for(let i=n0;i<groundHazards.length;i++){ const h=groundHazards[i]; if(h.src===u&&!h.arrival){ h.__ok={ult,seen:new Set(),inT:new Map(),t0:battleTime}; __okH.set(h,1); if(ult) __ok.ulRad=h.r/METER; else __ok.scLen.push((h.travelLeft||0)*Math.hypot(h.vx||0,h.vy||0)/METER); } } }'+
  '  return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(tgt&&tgt.key==="orryn"&&src&&src.team!==tgt.team){ __ok.hitsOn++; if(src.melee) __ok.meleeHitsOn++; }'+
  '  const k0=tgt&&tgt.alive; const r=__okDD.apply(this,arguments); return r; };'+
  '_updateBattleCore=function(dt){ const acc=new Map(); for(const [h] of __okH) acc.set(h,h.acc);'+
  '  const O=units.filter(u=>u.alive&&u.key==="orryn"); const E0=new Map(); for(const e of units) if(e.alive&&O.some(o=>o.team!==e.team)) E0.set(e,[e.energy||0,(e._nrgSlowT||0)>0?(e._nrgSlowPct||0):0]);'+
  '  const r=__okU.apply(this,arguments);'+
  '  for(const o of O){ if(!o.alive) continue; __ok.ticks++; let near=false; for(const e of units) if(e.alive&&e.team!==o.team&&(dist(o,e)-bodyR(o)-bodyR(e))<4*METER) near=true; if(near) __ok.nearTicks++; }'+
  '  for(const [e,v] of E0){ const g=(e.energy||0)-v[0]; if(e.alive&&v[1]>0&&g>0){ __ok.denied+=g*v[1]/(1-v[1]); __ok.deniedTicks++; } }'+
  '  for(const [h] of __okH){ const z=h.__ok; const ticked=groundHazards.indexOf(h)>=0?(h.acc<acc.get(h)):(acc.get(h)+dt>=h.interval);'+
  '    const inside=units.filter(e=>e.alive&&e.team!==h.team&&Math.hypot(e.x-h.x,e.y-h.y)<=h.r);'+
  '    for(const e of inside) z.inT.set(e,(z.inT.get(e)||0)+dt);'+
  '    if(ticked){ if(z.ult){ __ok.ulTicks++; if(inside.length) __ok.ulTickHit++; __ok.ulEnemyTicks+=inside.length; } else { __ok.scTicks++; if(inside.length) __ok.scTickHit++; __ok.scEnemyTicks+=inside.length; } for(const e of inside) z.seen.add(e); }'+
  '    if(groundHazards.indexOf(h)<0){ __okH.delete(h); if(z.ult){ __ok.ulDistinct+=z.seen.size; if(!z.seen.size) __ok.ulNone++; for(const [,s] of z.inT) __ok.ulInSecs.push(s); } else { __ok.scDistinct+=z.seen.size; if(!z.seen.size) __ok.scNone++; for(const [,s] of z.inT) __ok.scInSecs.push(s); } } }'+
  '  return r; };');
const team=['orryn','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__ok.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__ok.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__ok.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__ok'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', mx=a=>a.length?Math.max(...a).toFixed(2):'-';
const alive=c.ticks*V.STEP;
console.log('fights '+c.fights+'; Orryn alive '+alive.toFixed(0)+' s in all');
console.log('presses: green '+c.press.green+' (empowered by Abyssal Reserve '+c.emp.green+'), blue '+c.press.blue+' (empowered '+c.emp.blue+')');
console.log('Pressure Sphere: '+c.sph+' arrivals, on a living target '+c.sphHit+', its target already dead '+c.sphNone);
console.log('Spiral Current: '+c.blue+' casts, its run '+avg(c.scLen)+' m (max '+mx(c.scLen)+'); '+c.scTicks+' ticks, '+c.scTickHit+' reached an enemy, '+(c.scEnemyTicks/Math.max(1,c.scTicks)).toFixed(2)+' enemies a tick; '+(c.scDistinct/Math.max(1,c.blue)).toFixed(2)+' different enemies a cast; casts reaching nobody '+c.scNone+'; seconds an enemy spends under it per cast: mean '+avg(c.scInSecs)+' max '+mx(c.scInSecs));
console.log('Ocean Without Shore: '+c.ult+' casts, radius '+c.ulRad.toFixed(2)+' m; '+c.ulTicks+' ticks, '+c.ulTickHit+' reached an enemy, '+(c.ulEnemyTicks/Math.max(1,c.ulTicks)).toFixed(2)+' enemies a tick; '+(c.ulDistinct/Math.max(1,c.ult)).toFixed(2)+' different enemies a cast; casts reaching nobody '+c.ulNone+'; seconds an enemy spends in it per cast: mean '+avg(c.ulInSecs)+' max '+mx(c.ulInSecs));
console.log('energy kept from enemies by his energy slow: '+c.denied.toFixed(0)+' in all ('+(c.denied/Math.max(1,alive)).toFixed(2)+' a second of Orryn alive), over '+c.deniedTicks+' enemy ticks');
console.log('an enemy within 4 m of him (body to body): '+(100*c.nearTicks/Math.max(1,c.ticks)).toFixed(1)+'% of his time alive');
console.log('hits on him: '+c.hitsOn+' (melee '+c.meleeHitsOn+')');
const L=V.arena(snaps([spec('orryn',100)]),snaps([spec('vael',100)]),7), o=L[0];
console.log('body radius: Orryn '+V.bodyR(o).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+o.atkInterval.toFixed(3)+' s; max HP '+Math.round(o.maxHp)+', ability power '+Math.round(o.apow)+'; damage profile '+o.t.damageProfile+'; passive '+JSON.stringify(o.pass)+', passMul '+(o.passMul||1)+'; Abyssal Reserve at level 100 +'+(VMX('SKLV.abyssres(100)')*100).toFixed(1)+'%');
console.log('kit: '+JSON.stringify(VMX('KITS.orryn'))+'; ult '+JSON.stringify(Object.assign({},VMX('ULT_DEF.ashfall'),VMX('HERO_ULT_ART.orryn')))+'; ccDur(2) '+VMX('ccDur(2)')+'; ult card: '+VMX('HERO_ULT_DESC.orryn'));
