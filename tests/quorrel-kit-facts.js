'use strict';
/* Quorrel's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each
   of his skills fires and what it reaches in seeded fights - Gag Order (green 'aoeStun', delivered as a form: the enemies its circle reaches, the stuns and
   silences it lands and their length), Contempt (blue 'stun': its target, the stun it lands, the casts it interrupts), Contempt Storm (the ultimate 'volley':
   how many enemies its writs reach, whether they land together), Tireless (the 'fury' passive: his attack interval); the waves a fight has (Days), the hits
   he takes (who, from which row, magic or physical, critical), his stuns on one enemy in a row, how far enemies stand from each other (Contempt Twice's 3 m),
   and the Mages and Supports in the enemy line-ups. No talents learned. Run: node tests/quorrel-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __qk={fights:0,waves:0,wavesPer:[],ticks:0,go:0,goHit:[],goStunTry:0,goStun:0,goStunS:[],goSil:0,goSilS:[],goNone:0,goCtr:[],ct:0,ctNone:0,ctHit:0,ctStunTry:0,ctStun:0,ctStunS:[],ctPend:0,ctPendSpell:0,'+
  'cs:0,csN:[],csHit:0,csLandT:[],csFoes:[],auto:0,interval:[],hitsOn:0,magOn:0,physOn:0,critOn:0,backOn:0,below50:0,below40:0,runs:[],gap:[],mageSup:[],stunnedFoeTicks:0,foeTicks:0,dmg:{go:0,ct:0,cs:0,auto:0},mode:null,cdG:[],cdB:[]};'+
  'var __qkD=_doEffectCore, __qkDD=_dealDamageCore, __qkU=_updateBattleCore, __qkCC=ccApply, __qkRW=resetPerWave, __qkCur=null, __qkN=0, __qkW=0, __qkRun=new Map();'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="quorrel"&&(!o||!o.deliver||o._arrived); const was=__qkCur; if(me){ __qkCur=type; __qkN=0;'+
  '    if(type==="aoeStun"){ __qk.go++; }'+
  '    if(type==="stun"){ __qk.ct++; const t=(u.target&&u.target.alive)?u.target:null; if(!t) __qk.ctNone++; else if(t._pend){ __qk.ctPend++; if(t._pend.spell) __qk.ctPendSpell++; } }'+
  '    if(type==="volley"){ __qk.cs++; __qk.csFoes.push(enemiesOf(u).filter(e=>e.alive).length); } }'+
  '  try{ return __qkD.apply(this,arguments); } finally{ if(me){ if(type==="aoeStun"){ __qk.goHit.push(__qkN); if(!__qkN) __qk.goNone++; } if(type==="volley"){ __qk.csN.push(groundHazards.filter(h=>h.arrival&&!h.__qs).length); for(const h of groundHazards) if(h.arrival) h.__qs=1; } __qkCur=was; } } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const h0=tgt?tgt.hp+(tgt.shield||0):0, au=_autoAtk;'+
  '  const r=__qkDD.apply(this,arguments); const got=tgt?h0-tgt.hp-(tgt.shield||0):0;'+
  '  if(src&&src.key==="quorrel"&&got>0){ if(__qkCur==="aoeStun"){ __qkN++; __qk.dmg.go+=got; } else if(__qkCur==="stun"){ __qk.ctHit++; __qk.dmg.ct+=got; } else if(color==="#5ee89b"){ __qk.csHit++; __qk.csLandT.push(+battleTime.toFixed(2)); __qk.dmg.cs+=got; } else if(au){ __qk.auto++; __qk.dmg.auto+=got; } }'+
  '  if(tgt&&tgt.key==="quorrel"&&src&&src.team!==tgt.team&&got>0){ __qk.hitsOn++; if(tgt._lastHitKind==="magic") __qk.magOn++; else __qk.physOn++; if(tgt._critHit) __qk.critOn++; if(src.t&&src.t.row==="Back") __qk.backOn++; if(tgt.hp<0.5*tgt.maxHp) __qk.below50++; if(tgt.hp<0.4*tgt.maxHp) __qk.below40++; }'+
  '  return r; };'+
  'ccApply=function(u,t,field,dur){ const me=u&&u.key==="quorrel"; const r=__qkCC.apply(this,arguments);'+
  '  if(me&&field==="stunned"){ if(__qkCur==="aoeStun"){ __qk.goStunTry++; if(r){ __qk.goStun++; __qk.goStunS.push(+(t.stunned).toFixed(3)); } } if(__qkCur==="stun"){ __qk.ctStunTry++; if(r){ __qk.ctStun++; __qk.ctStunS.push(+(t.stunned).toFixed(3)); } }'+
  '    if(r){ const q=__qkRun.get(t)||{on:false,len:0}; q.on=true; __qkRun.set(t,q); t.__qMine=1; } }'+
  '  if(me&&field==="silencedT"&&r){ __qk.goSil++; __qk.goSilS.push(+(t.silencedT).toFixed(3)); } return r; };'+
  'resetPerWave=function(){ __qk.waves++; __qkW++; for(const [t,q] of __qkRun){ if(q.len>0) __qk.runs.push(+q.len.toFixed(2)); } __qkRun.clear(); return __qkRW.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="quorrel"&&u.alive)) continue; __qk.ticks++; if(!__qk.mode) __qk.mode=heroScaleMode(u)+"/"+(u.t.damageProfile||"");'+
  '    if(__qk.ticks%30===1){ __qk.interval.push(+u.atkInterval.toFixed(3)); __qk.cdG.push(+(u.greenCd||0).toFixed(1)); }'+
  '    const F=units.filter(e=>e.alive&&e.team!==u.team); for(const e of F){ __qk.foeTicks++; if((e.stunned||0)>0) __qk.stunnedFoeTicks++; }'+
  '    if(__qk.ticks%60===1&&F.length>1){ for(const e of F){ let b=1e9; for(const f of F) if(f!==e) b=Math.min(b,(dist(e,f)-bodyR(e)-bodyR(f))/METER); __qk.gap.push(+b.toFixed(1)); } } }'+
  '  for(const [t,q] of __qkRun){ if(!t.alive){ if(q.len>0) __qk.runs.push(+q.len.toFixed(2)); __qkRun.delete(t); continue; } if((t.stunned||0)>0&&q.on){ q.len+=dt; } else { if(q.len>0) __qk.runs.push(+q.len.toFixed(2)); q.len=0; q.on=false; } }'+
  '  return __qkU.apply(this,arguments); };');
const team=['quorrel','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
const lineup=(sns)=>sns.filter(s=>{ const r=VMX('(HERO_TYPES['+JSON.stringify(s.key)+']||{}).role'); return r==='Mage'||r==='Support'; }).length;
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__qk.fights++; __qkW=0'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); VMX('__qk.wavesPer.push(__qkW)'); }
const foes=[['ambrel','carn','dandra','konwu','ceraline'],['absalie','astra','vireo','sylthaine','vex']];
for(const fk of foes){ const foe=snaps(fk.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]}))); VMX('__qk.mageSup.push('+lineup(foe)+')');
  for(const seed of [5,77]){ VMX('__qk.fights++; __qkW=0'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__qk.wavesPer.push(__qkW)'); VMX('__qk.fights++; __qkW=0'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); VMX('__qk.wavesPer.push(__qkW)'); } }
for(const e of ENC.filter(e=>[12,34,60,90].includes(e.node))) VMX('__qk.mageSup.push("node '+e.node+': '+e.waves.length+' waves")');
const c=VMX('__qk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%', mx=a=>a.length?Math.max(...a):0;
const sorted=a=>a.slice().sort((x,y)=>x-y), med=a=>a.length?sorted(a)[Math.floor(a.length/2)]:0;
console.log('fights '+c.fights+' (12 campaign, 8 two-sided), waves (resetPerWave calls) '+c.waves+', per fight '+hist(c.wavesPer)+'; Quorrel alive '+(c.ticks/30).toFixed(0)+' s; scale mode / damage profile '+c.mode+'; enemy line-ups '+JSON.stringify(c.mageSup));
console.log('Gag Order: '+c.go+' casts (as they land), enemies hit per cast '+hist(c.goHit)+' (none: '+c.goNone+'); stuns tried '+c.goStunTry+', landed '+c.goStun+' '+hist(c.goStunS)+'; silences landed '+c.goSil+' '+hist(c.goSilS));
console.log('Contempt: '+c.ct+' casts ('+c.ctNone+' with no target), '+c.ctHit+' hits that took HP; stuns tried '+c.ctStunTry+', landed '+c.ctStun+' '+hist(c.ctStunS)+'; its target was casting at the strike '+c.ctPend+' times (a Green / Blue '+c.ctPendSpell+')');
console.log('Contempt Storm: '+c.cs+' casts, enemies alive at the cast '+hist(c.csFoes)+', writs queued per cast '+hist(c.csN)+', writ hits that took HP '+c.csHit+'; first landing times '+JSON.stringify(c.csLandT.slice(0,18)));
console.log('his basic attacks that took HP: '+c.auto+'; attack interval (sampled) '+hist(c.interval)+'; damage dealt: Gag Order '+Math.round(c.dmg.go)+', Contempt '+Math.round(c.dmg.ct)+', Contempt Storm '+Math.round(c.dmg.cs)+', basic attacks '+Math.round(c.dmg.auto));
console.log('hits on him that took HP: '+c.hitsOn+' (physical '+c.physOn+', magic '+c.magOn+', critical '+c.critOn+', from the back row '+c.backOn+'; while below 50% '+c.below50+', below 40% '+c.below40+')');
console.log('enemy ticks stunned (by anyone) '+pc(c.stunnedFoeTicks,c.foeTicks)+'; his stun runs on one enemy (s) median '+med(c.runs)+', longest '+mx(c.runs)+', count '+c.runs.length+' '+hist(c.runs.map(x=>Math.round(x*2)/2)));
console.log('gap from each enemy to its nearest other enemy (m, body to body) median '+med(c.gap)+', within 3 m '+pc(c.gap.filter(x=>x<3).length,c.gap.length)+' of '+c.gap.length);
const L=V.arena(snaps([Object.assign(spec('quorrel',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), h=L[0];
console.log('body radius: Quorrel '+V.bodyR(h).toFixed(2)+' m; attack interval '+h.atkInterval.toFixed(3)+' s; passMul '+h.passMul+'; max HP '+Math.round(h.maxHp)+', attack '+Math.round(h.dmg)+', melee '+!!h.melee+', range '+(h.range/V.METER).toFixed(2)+' m; pass '+JSON.stringify(h.pass)+'; armour '+Math.round(h.armorRating||0)+', mr '+Math.round(h.mrRating||0)+'; row '+h.t.row+', role '+h.t.role);
console.log('kits: green '+JSON.stringify(VMX('KITS.quorrel.green'))+' / blue '+JSON.stringify(VMX('KITS.quorrel.blue'))+' / ult '+JSON.stringify(VMX('ULT_DEF.volley'))+' + '+JSON.stringify(VMX('HERO_ULT_ART.quorrel'))+'; table at level 100: green stun '+VMX('skillScaleOpts(KITS.quorrel.green,skillMul(100),100).stun')+' silence '+VMX('skillScaleOpts(KITS.quorrel.green,skillMul(100),100).silence')+', blue stun '+VMX('skillScaleOpts(KITS.quorrel.blue,skillMul(100),100).stun')+'; cast times green '+VMX('castTimeFor('+'units[0]'+',"green")')+', blue '+VMX('castTimeFor(units[0],"blue")'));
