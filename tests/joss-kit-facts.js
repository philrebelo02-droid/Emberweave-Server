'use strict';
/* Joss Gatley's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often
   each of his skills fires and what it reaches in seeded fights - Radiant Hammer's target (the enemy with the highest attack, or his own target?), its
   crush and its stun as they land; Sanctuary Guard's ally, its shield, its 1 HP hold and the saves it makes; Unbroken Dawn's trigger and its shield;
   Daybreak Judgment's hits, stuns and heals - the hits he takes, and how much a reference hit on him is reduced tick by tick. No talents learned.
   Run: node tests/joss-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __jk={fights:0,ticks:0,rh:0,rhHit:0,rhTop:0,rhOwn:0,rhStunTry:0,rhStun:0,rhStunS:[],rhCrush:[],rhNone:0,sg:0,sgSelf:0,sgShield:[],sgFrac:[],held:0,heldSelf:0,'+
  'ub:0,ubAt:[],ubSh:[],ubCtrl:[],dj:0,djHit:0,djPer:[],djStunTry:0,djStun:0,djStunS:[],djHeal:0,djHealPer:[],djStunOpt:[],auto:0,autoHit:0,hitsOn:0,physOn:0,magOn:0,critOn:0,below50:0,below30:0,'+
  'red:{n:0,p:0,m:0,p85:0,m85:0,pmax:0,mmax:0},crushOn:0,waves:0,dmgDealt:{rh:0,dj:0,auto:0},mode:null};'+
  'var __jkD=_doEffectCore, __jkDD=_dealDamageCore, __jkU=_updateBattleCore, __jkCC=ccApply, __jkDm=damage, __jkHF=healFrom, __jkCur=null, __jkN=0, __jkH=0;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="joss"&&(!o||!o.deliver||o._arrived); const was=__jkCur; if(me){ __jkCur=type; __jkN=0; __jkH=0;'+
  '    if(type==="atkcrush"){ __jk.rh++; let best=null,bv=-1; enemiesOf(u).forEach(e=>{ if(!e.alive)return; const v=e.dmg||0; if(v>bv){bv=v;best=e;} }); if(!best) __jk.rhNone++; else { if(u.target===best) __jk.rhOwn++; } }'+
  '    if(type==="lastbreath"){ __jk.sg++; }'+
  '    if(type==="sunburst"){ __jk.dj++; } }'+
  '  try{ return __jkD.apply(this,arguments); } finally{ if(me){ if(type==="sunburst"){ __jk.djPer.push(__jkN); __jk.djHealPer.push(__jkH); }'+
  '      if(type==="lastbreath"){ for(const a of alliesOf(u)){ if(a._buffedT===0.5&&(a._wardT||0)>0){ a.__jsgT=battleTime+(a._wardT||0); a.__jsgBy=u; if(a===u) __jk.sgSelf++; __jk.sgShield.push(+((a.shield||0)/Math.max(1,u.apow||1)).toFixed(2)); __jk.sgFrac.push(+(a.hp/a.maxHp).toFixed(2)); } } }'+
  '      if(type==="atkcrush"){ for(const e of enemiesOf(u)) if((e._atkDnT||0)>4.9) __jk.rhCrush.push(+(e._atkDnPct||0).toFixed(3)); } } __jkCur=was; } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const h0=tgt?tgt.hp+(tgt.shield||0):0, au=_autoAtk;'+
  '  const r=__jkDD.apply(this,arguments); const got=tgt?h0-tgt.hp-(tgt.shield||0):0;'+
  '  if(src&&src.key==="joss"&&got>0){ if(__jkCur==="atkcrush"){ __jk.rhHit++; __jk.dmgDealt.rh+=got; } if(__jkCur==="sunburst"){ __jk.djHit++; __jkN++; __jk.dmgDealt.dj+=got; } if(!__jkCur&&au){ __jk.auto++; __jk.dmgDealt.auto+=got; } }'+
  '  if(tgt&&tgt.key==="joss"&&src&&src.team!==tgt.team&&got>0){ __jk.hitsOn++; if(tgt._lastHitKind==="magic") __jk.magOn++; else __jk.physOn++; if(tgt._critHit) __jk.critOn++; if(tgt.hp<0.5*tgt.maxHp) __jk.below50++; if(tgt.hp<0.3*tgt.maxHp) __jk.below30++; if((src._atkDnT||0)>0) __jk.crushOn++; }'+
  '  return r; };'+
  'ccApply=function(u,t,field,dur){ const me=u&&u.key==="joss"; const r=__jkCC.apply(this,arguments);'+
  '  if(me&&field==="stunned"){ if(__jkCur==="atkcrush"){ __jk.rhStunTry++; if(r){ __jk.rhStun++; __jk.rhStunS.push(+(t.stunned).toFixed(3)); } } if(__jkCur==="sunburst"){ __jk.djStunTry++; __jk.djStunOpt.push(dur); if(r){ __jk.djStun++; __jk.djStunS.push(+(t.stunned).toFixed(3)); } } } return r; };'+
  'healFrom=function(s,t,a){ if(s&&s.key==="joss"&&__jkCur==="sunburst"){ __jk.djHeal++; __jkH++; } return __jkHF.apply(this,arguments); };'+
  'damage=function(u,a,c,noEnergy,crit){ const w=u&&u.alive&&(u._wardT||0)>0&&u.__jsgBy&&battleTime<(u.__jsgT||0), h0=u?u.hp:0; const r=__jkDm.apply(this,arguments); if(w&&u.alive&&h0>1&&u.hp===1){ __jk.held++; if(u===u.__jsgBy) __jk.heldSelf++; } return r; };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="joss"&&u.alive)) continue; __jk.ticks++; if(!__jk.mode) __jk.mode=heroScaleMode(u)+"/"+(u.t.damageProfile||"");'+
  '    if(u._ubUsed&&!u.__ubSeen){ u.__ubSeen=1; __jk.ub++; __jk.ubAt.push(+(u.hp/u.maxHp).toFixed(3)); __jk.ubSh.push(+((u.shield||0)/u.maxHp).toFixed(3)); __jk.ubCtrl.push(+(u.ctrlRes||0).toFixed(3)); }'+
  '    let src=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ src=e; break; } if(!src) src=nearestEnemy(u); if(!src) continue;'+
  '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1), dp=defMul(src,u,"phys"), dm=defMul(src,u,"magic"), rp=1-k*dp, rm=1-k*dm, R=__jk.red;'+
  '    R.n++; R.p+=rp; R.m+=rm; if(rp>=0.85) R.p85++; if(rm>=0.85) R.m85++; R.pmax=Math.max(R.pmax,rp); R.mmax=Math.max(R.mmax,rm); }'+
  '  return __jkU.apply(this,arguments); };'+
  'var __jkRW=resetPerWave; resetPerWave=function(){ __jk.waves++; return __jkRW.apply(this,arguments); };');
const team=['joss','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__jk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__jk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__jk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__jk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
console.log('fights '+c.fights+' (12 campaign, 8 two-sided), waves '+c.waves+'; Joss alive '+(c.ticks/30).toFixed(0)+' s in all; scale mode / damage profile '+c.mode);
console.log('Radiant Hammer: '+c.rh+' casts ('+c.rhNone+' with no enemy), '+c.rhHit+' hits that took HP; its victim (the highest-attack enemy) was his own target in '+c.rhOwn+'; stuns tried '+c.rhStunTry+', landed '+c.rhStun+' '+hist(c.rhStunS)+'; crush written '+hist(c.rhCrush));
console.log('Sanctuary Guard: '+c.sg+' casts, on himself '+c.sgSelf+'; shield / his ability power '+hist(c.sgShield)+'; the ally\'s HP share at the cast mean '+avg(c.sgFrac)+'; saves by its 1 HP hold '+c.held+' (on himself '+c.heldSelf+')');
console.log('Unbroken Dawn: '+c.ub+' triggers, at HP share '+hist(c.ubAt)+'; his shield after it / max HP '+hist(c.ubSh)+'; control resist then '+hist(c.ubCtrl));
console.log('Daybreak Judgment: '+c.dj+' casts, '+c.djHit+' hits (per cast '+avg(c.djPer)+' '+hist(c.djPer)+'); stun asked '+hist(c.djStunOpt)+', tried '+c.djStunTry+', landed '+c.djStun+' '+hist(c.djStunS)+'; heals '+c.djHeal+' (per cast '+avg(c.djHealPer)+')');
console.log('his basic attacks that took HP: '+c.auto+'; damage dealt: Radiant Hammer '+Math.round(c.dmgDealt.rh)+', Daybreak Judgment '+Math.round(c.dmgDealt.dj)+', basic attacks '+Math.round(c.dmgDealt.auto));
console.log('hits on him that took HP: '+c.hitsOn+' (physical '+c.physOn+', magic '+c.magOn+', critical '+c.critOn+'; while below 50% '+c.below50+', below 30% '+c.below30+'; from a crushed enemy '+c.crushOn+')');
const R=c.red; console.log('a reference hit on him each tick (skill slot, glyphs, armour / magic resist): physical mean '+(100*R.p/Math.max(1,R.n)).toFixed(1)+'% (max '+(100*R.pmax).toFixed(1)+'%), magic mean '+(100*R.m/Math.max(1,R.n)).toFixed(1)+'% (max '+(100*R.mmax).toFixed(1)+'%); at 85% or more: physical '+pc(R.p85,R.n)+', magic '+pc(R.m85,R.n));
const L=V.arena(snaps([Object.assign(spec('joss',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), h=L[0];
console.log('body radius: Joss '+V.bodyR(h).toFixed(2)+' m; attack interval '+h.atkInterval.toFixed(3)+' s; max HP '+Math.round(h.maxHp)+', attack '+Math.round(h.dmg)+', ability power '+Math.round(h.apow)+', melee '+!!h.melee+', range '+(h.range/V.METER).toFixed(2)+' m; passive '+JSON.stringify(h.pass)+', passMul '+(h.passMul||1).toFixed(3)+'; armour '+Math.round(h.armorRating||0)+', mr '+Math.round(h.mrRating||0)+', glyphDR '+(h.glyphDR||0));
console.log('kits: green '+JSON.stringify(VMX('KITS.joss.green'))+' / blue '+JSON.stringify(VMX('KITS.joss.blue'))+' / ult '+JSON.stringify(VMX('ULT_DEF.sunburst'))+' + '+JSON.stringify(VMX('HERO_ULT_ART.joss'))+'; skillScaleOpts(green, x2.188) stun '+VMX('skillScaleOpts(KITS.joss.green,skillMul(100),100).stun')+', (ult) stun '+VMX('skillScaleOpts(Object.assign({},ULT_DEF.sunburst,HERO_ULT_ART.joss),skillMul(100),100).stun'));
