'use strict';
/* Vulmar's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each of his
   skills fires and what it reaches in seeded fights with NO talents learned - Gravity Sling (casts, how many had a second enemy to smash into, the metres the first
   enemy flew), Grasping Vow (casts, the metres its target was dragged, the silence and root as they land), Weight of the World (casts, enemies lifted a cast), his
   basic attacks (count, damage kind), the damage kind of every skill hit, how many enemies a fight usually has (his sling needs two), and the allies around him
   (his lotus auras read who stands within 4 m). Run: node tests/vulmar-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __vk={fights:0,ticks:0,gs:0,gsBoth:0,gsAlone:0,gsFly:[],tp:0,tpDrag:[],tpSil:[],tpRoot:[],ww:0,wwHit:[],wwIn:[],wwLift:[],slam:0,autos:0,autoKind:{},skillKind:{},foes:0,foeN:[],mate4:[],hitsOnMe:0,myUlt:0};'+
  'var __vD=_doEffectCore, __vU=_updateBattleCore, __vDD=_dealDamageCore, __vC=ccApply, __vIn=0, __vB=null, __vWW=0, __vLift=new Set(), __vSlam=0;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="vulmar"&&(!o||!o.deliver||o._arrived);'+
  '  if(me&&type==="gravsling"){ __vB={pos:new Map()}; for(const e of enemiesOf(u)) if(e.alive) __vB.pos.set(e,{x:e.x,y:e.y}); }'+
  '  if(me&&type==="tendrilpull"){ __vB={t:new Map()}; for(const e of enemiesOf(u)) if(e.alive) __vB.t.set(e,{x:e.x,y:e.y,pullT:e.pullT||0}); }'+
  '  if(me&&type==="worldweight"){ __vWW=0; __vLift=new Set(); const ctr=(u._aimWX!=null)?{x:u._aimWX,y:u._aimWY}:((u.target&&u.target.alive)?u.target:u), R=(o&&o.radius)||8*METER; let nin=0; for(const e of enemiesOf(u)) if(e.alive&&dist(ctr,e)<R) nin++; __vk.wwIn.push(nin); }'+
  '  if(me&&type==="worldweight") __vk.myUlt++;'+
  '  __vIn++; let r; try{ r=__vD.apply(this,arguments); } finally{ __vIn--; }'+
  '  if(me&&type==="gravsling"){ __vk.gs++; let fly=0, n=0; for(const [e,p] of __vB.pos){ if(!e.alive) continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d>0.5*METER){ n++; fly=Math.max(fly,d); } } __vk.gsFly.push(+(fly/METER).toFixed(2)); if(n>0) __vk.gsBoth++; else __vk.gsAlone++; }'+
  '  if(me&&type==="tendrilpull"){ __vk.tp++; let best=null,bd=-1; for(const [e,p] of __vB.t){ if(!e.alive) continue; if((e.pullT||0)>p.pullT+1e-9){ const d=Math.hypot(e.x-u.x,e.y-u.y); if(d>bd){ bd=d; best=e; } } } if(best){ const stopD=((o&&o.stop)||10)*METER; __vk.tpDrag.push(+((Math.max(0,bd-stopD))/METER).toFixed(2)); } else __vk.tpDrag.push(0); }'+
  '  if(me&&type==="worldweight"){ __vk.ww++; __vk.wwHit.push(__vWW); __vk.wwLift.push(__vLift.size); }'+
  '  return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(src&&src.key==="vulmar"&&tgt&&tgt.team!==src.team){ const k=kind||((src.t&&["Magic","Healer"].includes(src.t.damageProfile))?"magic":"phys");'+
  '    if(_autoAtk){ __vk.autos++; __vk.autoKind[k]=(__vk.autoKind[k]||0)+1; }'+
  '    else { const sk=__vIn?(src._castSlot||"?"):"other"; __vk.skillKind[sk+":"+k]=(__vk.skillKind[sk+":"+k]||0)+1; if(__vIn) __vWW++; if(!__vIn) __vSlam++; }'+
  '    if(!__vIn&&(tgt._liftT||0)>0) __vLift.add(tgt.uid); }'+
  '  if(tgt&&tgt.key==="vulmar"&&src&&src.team!==tgt.team) __vk.hitsOnMe++;'+
  '  return __vDD.apply(this,arguments); };'+
  'ccApply=function(u,t,f,d){ const r=__vC.apply(this,arguments); if(u&&u.key==="vulmar"&&u._castSlot==="blue"){ if(f==="silencedT"&&r) __vk.tpSil.push(+((t.silencedT||0)).toFixed(2)); if(f==="stunned"&&r) __vk.tpRoot.push(+((t.stunned||0)).toFixed(2)); } return r; };'+
  '_updateBattleCore=function(dt){ const Vs=units.filter(u=>u&&u.key==="vulmar"&&u.alive);'+
  '  for(const u of Vs){ __vk.ticks++; const M=METER; __vk.mate4.push(alliesOf(u).filter(a=>a.alive&&a!==u&&!a._summon&&Math.hypot(a.x-u.x,a.y-u.y)<=4*M).length); }'+
  '  const res=__vU.apply(this,arguments);'+
  '  for(const u of units){ if(!u.alive||u.team!==((units.find(x=>x.key==="vulmar")||{team:null}).team)||u._summon) continue; }'+
  '  return res; };');
const team=['vulmar','vael','sylthaine','vireo','vex'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__vk.fights++'); const foes0=VMX('(function(){ return 0; })()'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__vk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__vk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__vk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', med=a=>{ if(!a.length) return '-'; const s=a.slice().sort((x,y)=>x-y); return (+s[s.length>>1]).toFixed(2); }, hist=a=>{ const h={}; for(const x of a){ const k=(+x).toFixed(1); h[k]=(h[k]||0)+1; } return JSON.stringify(h); }, mx=a=>a.length?Math.max.apply(null,a).toFixed(1):'-';
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Vulmar alive '+(c.ticks*step).toFixed(0)+' s in all; his basic attacks '+c.autos+' '+JSON.stringify(c.autoKind)+'; his skill hits by slot:kind '+JSON.stringify(c.skillKind)+'; hits on him '+c.hitsOnMe);
console.log('Gravity Sling: '+c.gs+' casts, a second enemy to smash into '+c.gsBoth+' (alone '+c.gsAlone+'), the metres the hurled enemy flew '+hist(c.gsFly)+' (median '+med(c.gsFly)+', max '+mx(c.gsFly)+')');
console.log('Grasping Vow: '+c.tp+' casts, the metres its target was dragged '+hist(c.tpDrag)+' (median '+med(c.tpDrag)+', max '+mx(c.tpDrag)+'); silence as landed '+hist(c.tpSil)+'; root as landed '+hist(c.tpRoot));
console.log('Weight of the World: '+c.myUlt+' casts, enemies inside the 8 m circle at the cast '+hist(c.wwIn)+', initial hits per cast '+hist(c.wwHit)+', enemies lifted per cast '+hist(c.wwLift)+'; slams seen outside a skill '+(VMX('__vSlam')));
console.log('allies within 4 m of him, a tick each: '+hist(c.mate4)+' (median '+med(c.mate4)+')');
const L=V.arena(snaps([spec('vulmar',100)]),snaps([spec('vael',100)]),7), k=L[0];
console.log('body radius: Vulmar '+V.bodyR(k).toFixed(2)+' m; attack interval '+k.atkInterval.toFixed(3)+' s; max HP '+Math.round(k.maxHp)+', AP '+Math.round(k.apow)+', range '+(k.range/V.METER).toFixed(2)+' m; row '+(k.t&&k.t.row)+'; heroScaleMode '+VMX('heroScaleMode')(k)+'; passive '+JSON.stringify(k.pass)+' x'+k.passMul+', green '+JSON.stringify(k.greenAb)+', blue '+JSON.stringify(k.blueAb)+', ult '+JSON.stringify(VMX('Object.assign({},ULT_DEF.worldweight,(typeof HERO_ULT_ART!=="undefined"&&HERO_ULT_ART.vulmar)||{})')));
console.log('skill options as cast (skillScaleOpts at level 100): green '+JSON.stringify(VMX('skillScaleOpts(KITS.vulmar.green,skillMul(100),100)'))+'; blue '+JSON.stringify(VMX('skillScaleOpts(KITS.vulmar.blue,skillMul(100),100)'))+'; ult '+JSON.stringify(VMX('skillScaleOpts(Object.assign({},ULT_DEF.worldweight,HERO_ULT_ART.vulmar||{}),skillMul(100),100)'))+'; ccDur(1) '+VMX('ccDur(1)')+', caps '+JSON.stringify(VMX('CC_DUR_MAX'))+'; BATTLE_PACE '+VMX('BATTLE_PACE')+', UNIT_SIZE '+VMX('UNIT_SIZE')+', METER '+V.METER);
