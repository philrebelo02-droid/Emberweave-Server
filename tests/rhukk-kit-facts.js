'use strict';
/* Rhukk's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each of his
   skills fires and what it reaches in seeded fights with NO talents learned - Impale Rush (casts, enemies slammed, stuns landed and their length, landings that
   slammed nobody, how far he ran), Carapace and Dig In (casts, the skill slot they write, enemies taunted, the taunt's length), Thick Chitin (stacks over the fight),
   the hits on him (how many take 6% or more of his max HP), his basic attacks on the same enemy in a row, the time he stands still, the allies behind him.
   Run: node tests/rhukk-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __rk={fights:0,ticks:0,still:0,rush:0,rushHit:0,rushNone:0,rushStun:0,stunLens:[],runM:[],cara:0,caraDr:[],dig:0,digDr:[],digN:[],tauntLen:[],chit:[0,0,0,0,0,0],hitsOn:0,autoOn:0,big6:0,big3:0,autos:0,streak:[],behind3:0,slotOver:0,rushStunned:0};'+
  'var __rD=_doEffectCore, __rU=_updateBattleCore, __rDD=_dealDamageCore, __rC=ccApply, __rCur=null, __rN=0, __rLast={}, __rRun=0;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="rhukk"&&(!o||!o.deliver||o._arrived); const k0=__rCur;'+
  '  if(me&&type==="charge"){ __rk.rush++; let f=null,fd=-1; for(const e of enemiesOf(u)){ const d=dist(u,e); if(d>fd){fd=d;f=e;} } __rRun=fd/METER; }'+
  '  if(me&&type==="defensive"&&u.drT>0) __rk.slotOver++; if(me&&type==="taunt"&&u.drT>0) __rk.slotOver++;'+
  '  const r=__rD.apply(this,arguments);'+
  '  if(me&&type==="defensive"){ __rk.cara++; __rk.caraDr.push(1-u.drMul); }'+
  '  if(me&&type==="taunt"){ __rk.dig++; __rk.digDr.push(1-u.drMul); let n=0; for(const e of enemiesOf(u)) if(e.forcedTarget===u&&e.forcedTargetT>0){ n++; __rk.tauntLen.push(e.forcedTargetT); } __rk.digN.push(n); }'+
  '  return r; };'+
  'ccApply=function(u,t,f,d){ const was=(t.stunned||0)>0; const r=__rC.apply(this,arguments); if(r&&u&&u.key==="rhukk"&&f==="stunned"&&__rCur==="slam"){ __rk.rushStun++; if(was) __rk.rushStunned++; __rk.stunLens.push(t.stunned); } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const auto=_autoAtk; let h0=0;'+
  '  if(src&&src.key==="rhukk"&&tgt&&tgt.team!==src.team){ if(__rCur==="slam"){ __rk.rushHit++; __rN++; } if(auto){ __rk.autos++; const L=__rLast[src.uid]; if(L&&L.t===tgt) L.n++; else { if(L) __rk.streak.push(L.n); __rLast[src.uid]={t:tgt,n:1}; } } }'+
  '  const me=tgt&&tgt.key==="rhukk"&&src&&src.team!==tgt.team; if(me){ h0=tgt.hp+(tgt.shield||0); }'+
  '  const r=__rDD.apply(this,arguments);'+
  '  if(me){ __rk.hitsOn++; if(auto) __rk.autoOn++; const l=h0-tgt.hp-(tgt.shield||0); if(l>=0.06*tgt.maxHp) __rk.big6++; if(l>=0.03*tgt.maxHp) __rk.big3++; }'+
  '  return r; };'+
  '_updateBattleCore=function(dt){ const K=units.filter(u=>u&&u.key==="rhukk"&&u.alive), pre=K.map(u=>[u,u.x,u.y]);'+
  '  for(const u of K){ __rk.ticks++; __rk.chit[Math.min(5,u.wardenStk||0)]++; if(u._dash&&!u._dash.__w){ const D=u._dash, r0=D.run; D.__w=1; __rk.runM.push(Math.hypot(D.x1-D.x0,D.y1-D.y0)/METER); D.run=function(){ __rCur="slam"; __rN=0; try{ return r0.apply(this,arguments); } finally{ if(!__rN) __rk.rushNone++; __rCur=null; } }; }'+
  '    const F=enemiesOf(u).filter(e=>e.alive); if(F.length){ let sx=0,sy=0; for(const e of F){ sx+=e.x; sy+=e.y; } const c={x:sx/F.length,y:sy/F.length}, dm=Math.hypot(u.x-c.x,u.y-c.y);'+
  '      for(const a of alliesOf(u)){ if(a===u||!a.alive) continue; if(Math.hypot(a.x-c.x,a.y-c.y)>dm&&dist(u,a)-bodyR(u)-bodyR(a)<=3*METER){ __rk.behind3++; break; } } } }'+
  '  const res=__rU.apply(this,arguments); for(const [u,x,y] of pre) if(u.alive&&Math.hypot(u.x-x,u.y-y)<1e-6) __rk.still++; return res; };');
const team=['rhukk','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__rk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__rk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__rk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__rk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', med=a=>{ if(!a.length) return '-'; const s=a.slice().sort((x,y)=>x-y); return (+s[s.length>>1]).toFixed(2); }, hist=a=>{ const h={}; for(const x of a){ const k=(+x).toFixed(2); h[k]=(h[k]||0)+1; } return JSON.stringify(h); };
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Rhukk alive '+(c.ticks*step).toFixed(0)+' s in all, standing still '+(100*c.still/Math.max(1,c.ticks)).toFixed(1)+'% of his ticks; his basic attacks '+c.autos+', same enemy in a row: median '+med(c.streak)+', longest '+Math.max(0,...c.streak)+', runs of 5+ '+c.streak.filter(n=>n>=5).length+' of '+c.streak.length);
console.log('hits on him '+c.hitsOn+' (basic '+c.autoOn+'); taking 6% of his max HP or more '+c.big6+', 3% or more '+c.big3);
console.log('Impale Rush: '+c.rush+' casts, '+c.rushHit+' enemies slammed, landings that slammed nobody '+c.rushNone+', stuns landed '+c.rushStun+' (on an enemy already stunned '+c.rushStunned+'), stun lengths as landed '+hist(c.stunLens)+'; metres run: median '+med(c.runM)+', mean '+avg(c.runM));
console.log('Carapace: '+c.cara+' casts, slot as written '+hist(c.caraDr)+'; Dig In: '+c.dig+' casts, slot as written '+hist(c.digDr)+', enemies taunted a cast '+hist(c.digN)+', taunt length '+hist(c.tauntLen)+'; a cast that overwrote a running slot '+c.slotOver);
console.log('Thick Chitin stacks, share of his ticks: '+c.chit.map((n,i)=>i+':'+(100*n/Math.max(1,c.ticks)).toFixed(1)+'%').join(' ')+'; an ally within 3 m behind him '+(100*c.behind3/Math.max(1,c.ticks)).toFixed(1)+'% of his ticks');
const L=V.arena(snaps([spec('rhukk',100)]),snaps([spec('vael',100)]),7), k=L[0];
console.log('body radius: Rhukk '+V.bodyR(k).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+k.atkInterval.toFixed(3)+' s; max HP '+Math.round(k.maxHp)+', attack '+Math.round(k.dmg)+', range '+(k.range/V.METER).toFixed(2)+' m; row '+(k.t&&k.t.row)+'; passive '+JSON.stringify(k.pass)+', green '+JSON.stringify(k.greenAb)+', blue '+JSON.stringify(k.blueAb)+', ult '+JSON.stringify(VMX('Object.assign({},ULT_DEF.charge,(typeof HERO_ULT_ART!=="undefined"&&HERO_ULT_ART.rhukk)||{})')));
console.log('at skill level 100: Carapace slot '+VMX('skLvNum("defensive",KITS.rhukk.green,100)')+', Dig In reduction '+VMX('tauntDrOf(KITS.rhukk.blue,100)')+', Thick Chitin cap '+VMX('KITS.rhukk.purple.wardenCap0+KITS.rhukk.purple.wardenCapPerLv*lvStep(100)')+' (5 stacks x 3% = 15%), Impale Rush x attack '+VMX('heroUltMul("rhukk",100)')+'; passive card '+JSON.stringify(VMX('passDescAt(KITS.rhukk.purple,100)')));
