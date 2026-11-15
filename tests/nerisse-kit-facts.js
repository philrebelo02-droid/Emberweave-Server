'use strict';
/* Nerisse's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how often each
   of her skills fires and what it reaches in seeded fights with NO talents learned - Resonant Star (casts, the silence it lands, how long, how often it breaks
   a cast under way), Drifting Constellation (casts, hops, who it heals first, heal sizes), Choir of the Deep Sky (casts, enemies inside its 8 m, its silences,
   its heals and how many of them are zero, how often the channel breaks early), Pelagic Insight (uptime), where her allies stand (within 4 m of her body),
   how long enemies stay silenced in a row, her basic attacks and the hits on her.
   Run: node tests/nerisse-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __nk={fights:0,rs:0,rsLand:0,rsLen:[],rsCut:0,rsResist:0,rsHitKind:{},orb:0,orbHops:0,orbFirstSelf:0,orbAllies:[],orbHeal:[],orbHot:[],choir:0,choirIn:[],choirTicks:0,choirSil:0,choirHealN:0,choirHeal0:0,choirHealSum:0,choirHealPct:[],choirEarly:0,choirLife:[],'+
  'piTicks:0,ticks:0,near4:0,allyTicks:0,silRun:[],autos:0,autoKind:{},hitsOn:0,autoOn:0,skillOn:0,nearC:[],cutBy:{}};'+
  'var __nkD=_doEffectCore, __nkDD=_dealDamageCore, __nkU=_updateBattleCore, __nkCA=ccApply, __nkHU=healUnit, __nkOH=orbNextHop, __nkSil=new Map(), __nkCh=new Set();'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="nerisse"&&(!o||!o.deliver||o._arrived);'+
  '  if(me&&type==="silencestrike") __nk.rs++;'+
  '  if(me&&type==="orbheal"){ __nk.orb++; __nk.orbAllies.push(alliesOf(u).length); }'+
  '  const n0=groundHazards.length; const r=__nkD.apply(this,arguments);'+
  '  if(me&&type==="deepchoir"){ __nk.choir++; for(let i=n0;i<groundHazards.length;i++){ const h=groundHazards[i]; if(h&&h.choir){ __nkCh.add(h); h.__t0=battleTime; h.__w=0; let n=0; for(const e of enemiesOf(u)) if(e.alive&&Math.hypot(e.x-h.x,e.y-h.y)<=h.r) n++; __nk.choirIn.push(n); } } }'+
  '  return r; };'+
  'ccApply=function(u,t,field,dur){ const me=u&&u.key==="nerisse"&&field==="silencedT"; const cast=!!(t&&t._pend); const s0=t?(t.silencedT||0):0; const r=__nkCA.apply(this,arguments);'+
  '  if(me){ if(r){ __nk.rsLand++; __nk.rsLen.push(+(t.silencedT).toFixed(3)); if(cast) __nk.rsCut++; } else __nk.rsResist++; } return r; };'+
  'orbNextHop=function(h){ const first=!h.tgt; const r=__nkOH.apply(this,arguments); if(h.owner&&h.owner.key==="nerisse"&&h.tgt&&!h.done){ __nk.orbHops++; if(first&&h.tgt===h.owner) __nk.orbFirstSelf++; } return r; };'+
  'healUnit=function(u,a){ const h0=u?u.hp:0; const r=__nkHU.apply(this,arguments); if(__nkHU.__in) __nkHU.__in.push([u,a,u.hp-h0]); return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){'+
  '  if(src&&src.key==="nerisse"&&tgt&&tgt.team!==src.team){ if(_autoAtk){ __nk.autos++; __nk.autoKind[kind||"phys"]=(__nk.autoKind[kind||"phys"]||0)+1; } else __nk.rsHitKind[kind||"phys"]=(__nk.rsHitKind[kind||"phys"]||0)+1; }'+
  '  if(tgt&&tgt.key==="nerisse"&&src&&src.team!==tgt.team){ __nk.hitsOn++; if(_autoAtk) __nk.autoOn++; else __nk.skillOn++; }'+
  '  return __nkDD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ const L=units.filter(u=>u&&u.key==="nerisse"&&u.alive);'+
  '  for(const u of L){ __nk.ticks++; if((u._piT||0)>0&&u._piAdd) __nk.piTicks++; let bc=1e9; for(const e of enemiesOf(u)){ const d=dist(u,e); if(d<bc) bc=d; } if(bc<1e9) __nk.nearC.push(bc/METER);'+
  '    for(const a of alliesOf(u)){ if(a===u) continue; __nk.allyTicks++; if(dist(u,a)-bodyR(u)-bodyR(a)<4*METER) __nk.near4++; } }'+
  '  for(const e of units){ if(!e||!L.length||e.team===L[0].team) continue; const s=__nkSil.get(e)||0; if(e.alive&&(e.silencedT||0)>0) __nkSil.set(e,s+dt); else { if(s>0) __nk.silRun.push(+s.toFixed(2)); __nkSil.set(e,0); } }'+
  '  const hz=Array.from(__nkCh); const heals=[]; __nkHU.__in=heals; let r; try{ r=__nkU.apply(this,arguments); } finally{ __nkHU.__in=null; }'+
  '  for(const h of hz){ if(groundHazards.indexOf(h)<0){ __nkCh.delete(h); __nk.choirLife.push(+(battleTime-h.__t0).toFixed(2)); if(h.life>0.05) __nk.choirEarly++; } }'+
  '  return r; };'+
  /* the choir's own tick: count its silences and heals (healUnit calls made inside the hazard pass while one of her choirs is down) */
  'var __nkHz=null;');
/* a second wrap, on the hazard pass only, would need the page's internals; instead the choir's heals are counted from the heals made during a frame that ran a
   choir tick: healUnit calls whose amount equals 0.30 x skill level x an enemy's ability power. Simpler and exact: replay the choir's own rule per tick here. */
VMX('var __nkU2=_updateBattleCore; _updateBattleCore=function(dt){ const pre=[]; for(const h of __nkCh){ if(h.acc+dt>=h.interval) pre.push(h); }'+
  '  const r=__nkU2.apply(this,arguments);'+
  '  for(const h of pre){ if(groundHazards.indexOf(h)<0&&h.life>0) continue; __nk.choirTicks++; for(const e of units){ if(!e.alive||e.team===h.team||Math.hypot(e.x-h.x,e.y-h.y)>h.r) continue; __nk.choirSil++;'+
  '      let b=null,bd=1e9; for(const a of units){ if(!a.alive||a.team!==h.team||a._riseT>0) continue; const d=Math.hypot(a.x-e.x,a.y-e.y); if(d<bd){bd=d;b=a;} } if(!b) continue; const amt=h.choir*(e.apow||0); __nk.choirHealN++; if(!(amt>0)) __nk.choirHeal0++; else { __nk.choirHealSum+=amt; __nk.choirHealPct.push(+(100*amt/b.maxHp).toFixed(2)); } } }'+
  '  return r; };');
const team=['nerisse','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__nk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__nk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__nk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__nk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
const step=VMX('SIM_STEP'), med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[b.length>>1].toFixed(2):'-'; }, mx=a=>a.length?Math.max(...a).toFixed(2):'-';
console.log('fights '+c.fights+'; Nerisse alive '+(c.ticks*step).toFixed(0)+' s in all; nearest enemy centre to centre: mean '+avg(c.nearC)+' m, median '+med(c.nearC));
console.log('Resonant Star: '+c.rs+' casts; silences landed '+c.rsLand+', resisted '+c.rsResist+'; length '+avg(c.rsLen)+' s '+hist(c.rsLen)+'; the enemy was casting (cut short) '+c.rsCut+'; her skill hits by kind '+JSON.stringify(c.rsHitKind));
console.log('Drifting Constellation: '+c.orb+' casts, hops '+c.orbHops+' ('+(c.orb?(c.orbHops/c.orb).toFixed(2):0)+' a cast), first hop on herself '+c.orbFirstSelf+'; allies alive at the cast '+hist(c.orbAllies));
console.log('Choir of the Deep Sky: '+c.choir+' casts; enemies inside its circle at the start '+hist(c.choirIn)+'; ticks '+c.choirTicks+', enemy silences '+c.choirSil+'; heals '+c.choirHealN+' of which ZERO '+c.choirHeal0+' (the enemy had no ability power); heal size % of the healed max HP mean '+avg(c.choirHealPct)+' max '+mx(c.choirHealPct)+'; channel broken early '+c.choirEarly+'; life '+avg(c.choirLife)+' s '+hist(c.choirLife));
console.log('Pelagic Insight up '+(c.ticks?(100*c.piTicks/c.ticks).toFixed(1):0)+'% of her time alive; ally-ticks within 4 m of her body '+c.near4+' of '+c.allyTicks+' ('+(c.allyTicks?(100*c.near4/c.allyTicks).toFixed(1):0)+'%)');
console.log('enemies silenced in a row (any source): runs '+c.silRun.length+', mean '+avg(c.silRun)+' s, longest '+mx(c.silRun)+' s, 3 s or more '+c.silRun.filter(x=>x>=3).length+', 2.1 s or more '+c.silRun.filter(x=>x>=2.1).length);
console.log('her basic attacks '+c.autos+' '+JSON.stringify(c.autoKind)+'; hits on her '+c.hitsOn+' (basic '+c.autoOn+', skills '+c.skillOn+')');
const L=V.arena(snaps([Object.assign(spec('nerisse',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7);
console.log('body radius: Nerisse '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', apow '+Math.round(L[0].apow)+', Vael apow '+Math.round(L[1].apow||0)+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passMul '+L[0].passMul+'; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb));
const fo=VMX('units').filter(u=>u.team==='enemy'); console.log('ability power of the two-sided foes: '+JSON.stringify(snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>spec(k,100))).map(s=>[s.key,Math.round(s.apow||0)])));
