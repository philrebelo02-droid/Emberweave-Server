'use strict';
/* Korvux's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each
   of his skills fires and what it reaches in seeded fights with NO talents learned - Emberskin (burn ticks, enemies burned, how far the nearest enemy stood:
   centre to centre and body edge), Comet Dash (casts, enemies slammed, stuns landed and their length, casts that slammed nobody), Ember Cleave (casts, enemies
   struck), Falling Star (casts, crater ticks, enemies per tick, any impact hit), the hits on him, the deaths within 6 m of him, and his own numbers.
   Run: node tests/korvux-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __kk={fights:0,ticks:0,burnT:0,burnTHit:0,burned:0,burnNearC:[],burnNearB:[],edge24:0,dash:0,dashHit:0,dashNone:0,dashStun:0,stunLens:[],dashTgtGap:[],cleave:0,cleaveHit:0,cleaveNone:0,star:0,starImpact:0,crTicks:0,crHit:0,crAmtK:[],hitsOn:0,autoOn:0,deaths6:0,deaths:0,autos:0,starAimed:0};'+
  'var __kD=_doEffectCore, __kU=_updateBattleCore, __kDD=_dealDamageCore, __kC=ccApply, __kT=dotTickAmt, __kCur=null, __kN=0, __kDam=damage;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="korvux"&&(!o||!o.deliver||o._arrived); const k0=__kCur;'+
  '  if(me&&type==="charge"){ __kk.dash++; __kCur="dash"; __kN=0; } if(me&&type==="cleave"){ __kk.cleave++; __kCur="cleave"; __kN=0; } if(me&&type==="ashfall"){ __kk.star++; __kCur="star"; if(o&&o._aim) __kk.starAimed++; }'+
  '  try{ return __kD.apply(this,arguments); } finally{ if(me&&type==="cleave"){ if(!__kN) __kk.cleaveNone++; } if(me&&type!=="charge") __kCur=k0; } };'+
  'ccApply=function(u,t,f,d){ const r=__kC.apply(this,arguments); if(r&&u&&u.key==="korvux"&&f==="stunned"&&__kCur==="dashSlam"){ __kk.dashStun++; __kk.stunLens.push(t.stunned); } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){'+
  '  if(src&&src.key==="korvux"&&tgt&&tgt.team!==src.team){ if(__kCur==="dashSlam"){ __kk.dashHit++; __kN++; } else if(__kCur==="cleave"&&!_autoAtk){ __kk.cleaveHit++; __kN++; } else if(__kCur==="star"&&!_autoAtk) __kk.starImpact++; if(_autoAtk) __kk.autos++; }'+
  '  if(tgt&&tgt.key==="korvux"&&src&&src.team!==tgt.team){ __kk.hitsOn++; if(_autoAtk) __kk.autoOn++; }'+
  '  return __kDD.apply(this,arguments); };'+
  'dotTickAmt=function(src,tgt,amt,kind){ if(src&&src.key==="korvux"){ if(src.pass&&src.pass.immolate&&Math.abs(amt-src.dmg*SKLV.immolate(passLv(src)))<1e-9){ __kk.burned++; } else { __kk.crHit++; __kk.crAmtK.push(amt/Math.max(1e-9,src.dmg)); } } return __kT.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ const K=units.filter(u=>u&&u.key==="korvux"&&u.alive), pre=K.map(u=>[u,u._immT||0,u._dash,u.alive]); const al=units.filter(u=>u.team!=="ally"||true).map(u=>[u,u.alive]);'+
  '  for(const u of K){ __kk.ticks++; if(u._dash&&!u._dash.__w){ const D=u._dash, r0=D.run; D.__w=1; D.run=function(){ const k0=__kCur; __kCur="dashSlam"; __kN=0; try{ return r0.apply(this,arguments); } finally{ if(!__kN) __kk.dashNone++; __kCur=null; } }; } }'+
  '  const b0=__kk.burned; const res=__kU.apply(this,arguments);'+
  '  for(const [u,t0] of pre){ if(u.alive&&(u._immT||0)<t0-1e-9){ __kk.burnT++; let bc=1e9,bb=1e9; for(const e of enemiesOf(u)){ if(!e.alive) continue; const d=dist(u,e); if(d<bc) bc=d; const g=d-bodyR(e); if(g<bb) bb=g; } __kk.burnNearC.push(bc/METER); __kk.burnNearB.push(bb/METER); if(bb<=2.4*METER) __kk.edge24++; } }'+
  '  if(__kk.burned>b0) __kk.burnTHit++;'+
  '  for(const [x,a] of al){ if(a&&!x.alive&&x.team!=="ally"){ __kk.deaths++; for(const u of units) if(u.key==="korvux"&&u.alive&&dist(u,x)-bodyR(u)-bodyR(x)<6*METER){ __kk.deaths6++; break; } } }'+
  '  return res; };');
const team=['korvux','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__kk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__kk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__kk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__kk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', med=a=>{ if(!a.length) return '-'; const s=a.slice().sort((x,y)=>x-y); return s[s.length>>1].toFixed(2); }, hist=a=>{ const h={}; for(const x of a){ const k=(+x).toFixed(2); h[k]=(h[k]||0)+1; } return JSON.stringify(h); };
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Korvux alive '+(c.ticks*step).toFixed(0)+' s in all; his basic attacks '+c.autos+'; hits on him '+c.hitsOn+' (basic '+c.autoOn+')');
console.log('Emberskin: '+c.burnT+' burn ticks, enemies burned '+c.burned+' (ticks that burned someone '+c.burnTHit+'); nearest enemy at a tick: centre '+med(c.burnNearC)+' m median (min '+(c.burnNearC.length?Math.min(...c.burnNearC).toFixed(2):'-')+'), body edge '+med(c.burnNearB)+' m median; ticks with an enemy body within 2.4 m (the v1391 measure) '+c.edge24);
console.log('Comet Dash: '+c.dash+' casts, '+c.dashHit+' enemies slammed, landings that slammed nobody '+c.dashNone+', stuns landed '+c.dashStun+', stun lengths as landed '+hist(c.stunLens));
console.log('Ember Cleave: '+c.cleave+' casts, '+c.cleaveHit+' enemies struck ('+(c.cleave?(c.cleaveHit/c.cleave).toFixed(2):'-')+' a cast), casts that struck nobody '+c.cleaveNone);
console.log('Falling Star: '+c.star+' casts (aimed '+c.starAimed+'), impact hits '+c.starImpact+', crater ticks on enemies '+c.crHit+' (per tick x his attack: median '+med(c.crAmtK)+')');
console.log('deaths of his enemies '+c.deaths+', within 6 m of him (body to body) '+c.deaths6);
const L=V.arena(snaps([spec('korvux',100)]),snaps([spec('vael',100)]),7), k=L[0];
console.log('body radius: Korvux '+V.bodyR(k).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+k.atkInterval.toFixed(3)+' s; max HP '+Math.round(k.maxHp)+', attack '+Math.round(k.dmg)+', melee '+!!k.melee+', range '+(k.range/V.METER).toFixed(2)+' m; row '+(k.t&&k.t.row)+', profile '+(k.t&&k.t.damageProfile)+'; passive '+JSON.stringify(k.pass)+', green '+JSON.stringify(k.greenAb)+', blue '+JSON.stringify(k.blueAb)+', ult '+JSON.stringify(VMX('Object.assign({},ULT_DEF.ashfall,HERO_ULT_ART.korvux)')));
console.log('the ult as cast at skill level 100: '+JSON.stringify(VMX('skillScaleOpts(Object.assign({},ULT_DEF.ashfall,HERO_ULT_ART.korvux),skillMul(100),100)'))+'; Comet Dash: '+JSON.stringify(VMX('skillScaleOpts(Object.assign({},KITS.korvux.green),skillMul(100),100)'))+'; immolate at 100: '+VMX('SKLV.immolate(100)'));
