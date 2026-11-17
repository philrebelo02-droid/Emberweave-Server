'use strict';
/* Pyroclast's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how often
   each of her skills fires and what it reaches in seeded fights - Ember Lash's hit and its Scorch (a DoT pushed at once or queued? its kind, its ticks, does
   a second Lash Scorch ever overlap the first?), Blazing Orbit's centre (her, or a stale aim), the enemies it strikes and pushes, Crownfire's centre and its
   target, the enemies it strikes; Rising Heat's spell-power share; the hits she takes (basic attacks in melee, controls, pulls); how near the enemies stand.
   No talents learned. Run: node tests/pyroclast-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __pk={fights:0,ticks:0,waves:0,mode:null,lash:0,lashHit:0,lashDot:[],lashKind:{},lashTicks:{},lashOver:0,lashPend:0,ob:0,obHit:0,obPer:[],obPush:0,obCtr:{self:0,aim:0},obNear:[],obBurn:0,'+
  'cf:0,cfHit:0,cfPer:[],cfTgtHit:0,cfAim:0,cfR:0,ap:[],apMax:1,sc:[],hitsOn:0,meleeAutoOn:0,rangedAutoOn:0,skillOn:0,stunOn:0,stunS:[],pullOn:0,fearOn:0,silOn:0,slowOn:0,'+
  'near2:0,near3:0,two3:0,far6:0,abilHits:0,dmg:{lash:0,lashDot:0,ob:0,obDot:0,cf:0,auto:0},red:{n:0,p:0,m:0,p85:0,m85:0}};'+
  'var __pkD=_doEffectCore, __pkDD=_dealDamageCore, __pkU=_updateBattleCore, __pkCC=ccApply, __pkPD=pushDot, __pkCur=null, __pkN=0, __pkL=null;'+
  'function __pkMe(u){ return u&&u.key==="pyroclast"; }'+
  '_doEffectCore=function(u,type,o){ const me=__pkMe(u)&&(!o||!o.deliver||o._arrived); const was=__pkCur; if(me){ __pkCur=type; __pkN=0;'+
  '    if(type==="creeprot") __pk.lash++;'+
  '    if(type==="nova"){ __pk.ob++; const c=o._aim?o._aim:((u._aimWX!=null)?{x:u._aimWX,y:u._aimWY}:null); if(c) __pk.obCtr.aim++; else __pk.obCtr.self++; let nd=1e9; enemiesOf(u).forEach(e=>{ if(e.alive) nd=Math.min(nd,dist(u,e)/METER); }); __pk.obNear.push(+nd.toFixed(1)); __pkL=enemiesOf(u).filter(e=>e.alive).map(e=>[e,e.x,e.y]); }'+
  '    if(type==="fireball"){ __pk.cf++; if(o._aim||u._aimWX!=null) __pk.cfAim++; __pk.cfR=(o.radius||95)/METER; __pkL=o._tgtU||null; } }'+
  '  try{ return __pkD.apply(this,arguments); } finally{ if(me){ if(type==="nova"){ __pk.obPer.push(__pkN); if(__pkL) for(const [e,x,y] of __pkL) if(e.x!==x||e.y!==y) __pk.obPush++; }'+
  '      if(type==="fireball"){ __pk.cfPer.push(__pkN); } } __pkCur=was; } };'+
  'pushDot=function(t,dps,dur,iv,col,src,kind){ const r=__pkPD.apply(this,arguments); if(__pkMe(src)){ const d=t.dots[t.dots.length-1];'+
  '    if(__pkCur==="creeprot"){ const prev=t.dots.filter(x=>x!==d&&x.src===src&&x._pkL&&x.remaining>0).length; if(prev) __pk.lashOver++; d._pkL=1; __pk.lashDot.push(+(dps/Math.max(1,src.apow||1)).toFixed(3)); __pk.lashKind[d.kind]=(__pk.lashKind[d.kind]||0)+1; __pk.lashTicks[d.remaining]=(__pk.lashTicks[d.remaining]||0)+1; }'+
  '    if(__pkCur==="nova"){ d._pkB=1; __pk.obBurn++; } } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const h0=tgt?tgt.hp+(tgt.shield||0):0, au=_autoAtk;'+
  '  const r=__pkDD.apply(this,arguments); const got=tgt?h0-tgt.hp-(tgt.shield||0):0;'+
  '  if(__pkMe(src)&&got>0){ if(__pkCur==="creeprot"){ __pk.lashHit++; __pk.dmg.lash+=got; } if(__pkCur==="nova"){ __pk.obHit++; __pkN++; __pk.dmg.ob+=got; } if(__pkCur==="fireball"){ __pk.cfHit++; __pkN++; __pk.dmg.cf+=got; if(tgt===__pkL) __pk.cfTgtHit++; } if(!__pkCur&&au) __pk.dmg.auto+=got;'+
  '    if(__pkCur){ __pk.abilHits++; if(dist(src,tgt)-bodyR(src)-bodyR(tgt)>6*METER) __pk.far6++; } }'+
  '  if(__pkMe(tgt)&&src&&src.team!==tgt.team&&got>0){ __pk.hitsOn++; if(au){ if(src.melee) __pk.meleeAutoOn++; else __pk.rangedAutoOn++; } else __pk.skillOn++; }'+
  '  return r; };'+
  'ccApply=function(u,t,field,dur){ const r=__pkCC.apply(this,arguments); if(r&&__pkMe(t)){ if(field==="stunned"){ __pk.stunOn++; __pk.stunS.push(+(t.stunned).toFixed(2)); } if(field==="fearT") __pk.fearOn++; if(field==="silencedT") __pk.silOn++; if(field==="slow") __pk.slowOn++; } return r; };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(!(__pkMe(u)&&u.alive)) continue; __pk.ticks++; if(!__pk.mode) __pk.mode=heroScaleMode(u)+"/"+(u.t.damageProfile||"");'+
  '    if(u.pullT>0&&!u.__pkPl) __pk.pullOn++; u.__pkPl=u.pullT>0;'+
  '    const am=u.apMul||1; __pk.apMax=Math.max(__pk.apMax,am); if(__pk.ticks%30===0){ __pk.ap.push(+am.toFixed(3)); let sc=0; enemiesOf(u).forEach(e=>{ if(e.alive&&e.dots.some(d=>d.src===u)) sc++; }); __pk.sc.push(sc); }'+
  '    let n2=0,n3=0; enemiesOf(u).forEach(e=>{ if(!e.alive) return; const g=dist(u,e)-bodyR(u)-bodyR(e); if(g<2*METER) n2++; if(g<3*METER) n3++; }); if(n2) __pk.near2++; if(n3) __pk.near3++; if(n3>=2) __pk.two3++;'+
  '    let src=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ src=e; break; } if(!src) src=nearestEnemy(u); if(!src) continue;'+
  '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1), rp=1-k*defMul(src,u,"phys"), rm=1-k*defMul(src,u,"magic"), R=__pk.red; R.n++; R.p+=rp; R.m+=rm; if(rp>=0.85) R.p85++; if(rm>=0.85) R.m85++; }'+
  '  return __pkU.apply(this,arguments); };'+
  'var __pkRW=resetPerWave; resetPerWave=function(){ __pk.waves++; return __pkRW.apply(this,arguments); };');
const team=['pyroclast','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__pk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__pk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__pk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__pk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
console.log('fights '+c.fights+' (12 campaign, 8 two-sided), waves '+c.waves+'; Pyroclast alive '+(c.ticks/37).toFixed(0)+' s in all ('+c.ticks+' ticks); scale mode / damage profile '+c.mode);
console.log('Ember Lash: '+c.lash+' casts, '+c.lashHit+' hits that took HP; Scorch pushed '+c.lashDot.length+' (dps / her ability power '+hist(c.lashDot)+'), kind '+JSON.stringify(c.lashKind)+', ticks '+JSON.stringify(c.lashTicks)+'; a new Lash Scorch on an enemy still carrying one: '+c.lashOver);
console.log('Blazing Orbit: '+c.ob+' casts, centre '+JSON.stringify(c.obCtr)+'; hits '+c.obHit+' (per cast '+avg(c.obPer)+' '+hist(c.obPer)+'); enemies moved '+c.obPush+'; burns pushed '+c.obBurn+'; nearest enemy at the cast (m, centre) median '+(c.obNear.slice().sort((a,b)=>a-b)[c.obNear.length>>1])+' '+hist(c.obNear.map(x=>Math.min(20,Math.round(x)))));
console.log('Crownfire: '+c.cf+' casts ('+c.cfAim+' aimed at a point), radius '+c.cfR.toFixed(2)+' m centre to centre; hits '+c.cfHit+' (per cast '+avg(c.cfPer)+' '+hist(c.cfPer)+'); its own target struck '+c.cfTgtHit+' times');
console.log('Rising Heat: spell power share each second mean '+avg(c.ap)+' (max '+c.apMax.toFixed(3)+'), enemies carrying a DoT of hers each second '+hist(c.sc));
console.log('her ability hits on an enemy more than 6 m away (body to body): '+c.far6+' of '+c.abilHits+'; damage dealt: Lash '+Math.round(c.dmg.lash)+', Orbit '+Math.round(c.dmg.ob)+', Crownfire '+Math.round(c.dmg.cf)+', basic attacks '+Math.round(c.dmg.auto));
console.log('hits on her that took HP: '+c.hitsOn+' (basic attacks in melee '+c.meleeAutoOn+', ranged basic attacks '+c.rangedAutoOn+', skills '+c.skillOn+'); controls landed on her: stuns '+c.stunOn+' '+hist(c.stunS)+', pulls '+c.pullOn+', fears '+c.fearOn+', silences '+c.silOn+', slows '+c.slowOn);
console.log('an enemy within 2 m of her (body to body): '+pc(c.near2,c.ticks)+' of her ticks; within 3 m '+pc(c.near3,c.ticks)+'; two or more within 3 m '+pc(c.two3,c.ticks));
const R=c.red; console.log('a reference hit on her each tick (skill slot, glyphs, armour / magic resist): physical mean '+(100*R.p/Math.max(1,R.n)).toFixed(1)+'%, magic mean '+(100*R.m/Math.max(1,R.n)).toFixed(1)+'%; at 85% or more: physical '+pc(R.p85,R.n)+', magic '+pc(R.m85,R.n));
const L=V.arena(snaps([Object.assign(spec('pyroclast',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), h=L[0];
console.log('body radius: Pyroclast '+V.bodyR(h).toFixed(2)+' m; attack interval '+h.atkInterval.toFixed(3)+' s; max HP '+Math.round(h.maxHp)+', attack '+Math.round(h.dmg)+', ability power '+Math.round(h.apow)+', melee '+!!h.melee+', range '+(h.range/V.METER).toFixed(2)+' m; passive '+JSON.stringify(h.pass)+', passMul '+(h.passMul||1).toFixed(3)+'; armour '+Math.round(h.armorRating||0)+', mr '+Math.round(h.mrRating||0));
console.log('kits: green '+JSON.stringify(VMX('KITS.pyroclast.green'))+' / blue '+JSON.stringify(VMX('KITS.pyroclast.blue'))+' / ult '+JSON.stringify(VMX('ULT_DEF.fireball'))+' + '+JSON.stringify(VMX('HERO_ULT_ART.pyroclast'))+'; Rising Heat cap at 100 '+VMX('SKLV.risingheatCap(100)')+'; skillMul(100) '+VMX('skillMul(100)'));
