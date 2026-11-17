'use strict';
/* Umbris's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on, with NO talents
   learned: how often each skill fires and what it reaches in seeded fights - his basic attack (the bolt: its kind), Shadeburst (the cluster it forms on, the
   enemies it reaches, its rot: kind, ticks, queued?), Creeping Rot (its hit, its rot, its target), Umbral Cataclysm (where it lands, the enemies its first hit
   strikes, the void zone's ticks), Lingering Dark (enemies that die rotting, how far the nearest other enemy stands, how many spreads happen), the damage
   each skill deals, the hits on him (who from, how far), and his numbers.  Run: node tests/umbris-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __um={fights:0,ticks:0,waves:0,mode:null,bolt:0,boltKind:{},sb:0,sbN:[],sbDot:0,sbCtr:{aim:0,cluster:0,self:0},cr:0,crHit:0,crKind:{},crDot:0,dotKind:{},dotTicks:{},crTgtNone:0,'+
  'ult:0,ultHit:0,ultN:[],ultKind:{},zt:0,ztKind:{},ztN:0,ztDeaths:0,deaths:0,rot:0,rotCon:0,rotNoDot:0,spreadN:0,spreadDeaths:0,nn:[],nnGap:[],dmg:{bolt:0,sb:0,cr:0,crDot:0,ult:0,zone:0,spread:0},'+
  'hitsOn:0,hitsOnFar8:0,hitsOnBack:0,hitsOnAuto:0,stunOn:0,silOn:0,crit:0,heals:0,shields:0,refDr:{n:0,p:0,m:0}, energyGain:0, killsRot:0, rotUp:0, rotUpN:0};'+
  'var __umD=_doEffectCore, __umDD=_dealDamageCore, __umU=_updateBattleCore, __umCC=ccApply, __umPD=pushDot, __umPL=plagueDot, __umDm=damage, __umVZ=updateVoidZones, __umCur=null, __umN=0, __umDie=null, __umZ=0;'+
  'function __umMe(u){ return u&&u.key==="umbris"; }'+
  '_doEffectCore=function(u,type,o){ const me=__umMe(u)&&(!o||!o.deliver||o._arrived); const was=__umCur; if(me){ __umCur=type; __umN=0;'+
  '    if(type==="shadeburst"){ __um.sb++; if(o&&o._aim) __um.sbCtr.aim++; else __um.sbCtr.cluster++; }'+
  '    if(type==="creeprot"){ __um.cr++; if(!u.target||!u.target.alive) __um.crTgtNone++; }'+
  '    if(type==="umbralcata"){ __um.ult++; } }'+
  '  try{ return __umD.apply(this,arguments); } finally{ if(me){ if(type==="shadeburst") __um.sbN.push(__umN); } __umCur=was; } };'+
  'plagueDot=function(t,dps,dur,iv,col,src,kind){ if(__umMe(src)){ if(__umDie&&!__umDie.alive){ __um.spreadN++; __umDie.__umSp=1; } else if(__umCur==="shadeburst"){ __um.sbDot++; __umN++; } else if(__umCur==="creeprot") __um.crDot++; } return __umPL.apply(this,arguments); };'+
  'pushDot=function(t,dps,dur,iv,col,src,kind){ const r=__umPD.apply(this,arguments); if(__umMe(src)){ const d=t.dots[t.dots.length-1]; __um.dotKind[d.kind]=(__um.dotKind[d.kind]||0)+1; const k=Math.round(dur)+"s"; __um.dotTicks[k]=(__um.dotTicks[k]||0)+1; } return r; };'+
  'damage=function(u,amt){ const a=u&&u.alive; __umDie=a?u:null; try{ return __umDm.apply(this,arguments); } finally{ if(a&&!u.alive&&u.team!==undefined){ const um=units.find(x=>__umMe(x)&&x.team!==u.team);'+
  '      if(um){ __um.deaths++; const mine=(u.dots||[]).some(d=>d.src===um&&d.remaining>0); if(mine) __um.rot++; if(u._contagion&&mine) __um.rotCon++; if(u._contagion&&!mine) __um.rotNoDot++; if(u.__umSp) __um.spreadDeaths++;'+
  '        if(mine){ let nd=1e9, ng=1e9; units.forEach(e=>{ if(e!==u&&e.alive&&e.team===u.team){ const d=Math.hypot(e.x-u.x,e.y-u.y); if(d<nd){ nd=d; ng=d-bodyR(e)-bodyR(u); } } }); if(nd<1e9){ __um.nn.push(+(nd/METER).toFixed(1)); __um.nnGap.push(+(ng/METER).toFixed(1)); } } } } __umDie=null; } };'+
  'updateVoidZones=function(dt){ __umZ=1; try{ return __umVZ.apply(this,arguments); } finally{ __umZ=0; } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const h0=tgt?tgt.hp+(tgt.shield||0):0, au=_autoAtk;'+
  '  const kd=kind||((src&&src.t&&(["Magic","Healer"].includes(src.t.damageProfile)))?"magic":"phys");'+
  '  const r=__umDD.apply(this,arguments); const got=tgt?h0-tgt.hp-(tgt.shield||0):0;'+
  '  if(__umMe(src)&&tgt&&tgt.team!==src.team){ if(au&&!__umCur&&!__umZ){ __um.bolt++; __um.boltKind[kd]=(__um.boltKind[kd]||0)+1; if(got>0) __um.dmg.bolt+=got; }'+
  '    else if(__umZ){ __um.zt++; __um.ztKind[kd]=(__um.ztKind[kd]||0)+1; if(got>0) __um.dmg.zone+=got; if(!tgt.alive) __um.ztDeaths++; }'+
  '    else if(__umCur==="creeprot"){ __um.crHit++; __um.crKind[kd]=(__um.crKind[kd]||0)+1; if(got>0) __um.dmg.cr+=got; }'+
  '    else if(!__umCur&&src._voidLandT===0&&color==="#c9a6ff"){ __um.ultHit++; __um.ultKind[kd]=(__um.ultKind[kd]||0)+1; if(got>0) __um.dmg.ult+=got; } }'+
  '  if(__umMe(tgt)&&src&&src.team!==tgt.team&&got>0){ __um.hitsOn++; if(au) __um.hitsOnAuto++; if(dist(src,tgt)-bodyR(src)-bodyR(tgt)>8*METER) __um.hitsOnFar8++; if(typeof heroFormationDepth==="function"&&src.key&&heroFormationDepth(src.key)>=3) __um.hitsOnBack++; }'+
  '  return r; };'+
  'ccApply=function(u,t,field,dur){ const r=__umCC.apply(this,arguments); if(__umMe(t)){ if(field==="stunned") __um.stunOn++; if(field==="silencedT") __um.silOn++; } return r; };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(!(__umMe(u)&&u.alive)) continue; __um.ticks++; if(!__um.mode) __um.mode=heroScaleMode(u)+"/"+(u.t.damageProfile||"")+" pass "+JSON.stringify(u.pass);'+
  '    let rn=0; enemiesOf(u).forEach(e=>{ if(e.alive&&e.dots.some(d=>d.src===u&&d.remaining>0)) rn++; }); __um.rotUp+=rn; __um.rotUpN++;'+
  '    let src=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ src=e; break; } if(!src) src=nearestEnemy(u); if(!src) continue;'+
  '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1), R=__um.refDr; R.n++; R.p+=1-k*defMul(src,u,"phys"); R.m+=1-k*defMul(src,u,"magic"); }'+
  '  const lv=units.filter(x=>__umMe(x)).map(x=>[x,x._voidLandT||0]); const r=__umU.apply(this,arguments); return r; };'+
  'var __umRW=resetPerWave; resetPerWave=function(){ __um.waves++; return __umRW.apply(this,arguments); };');
/* the ultimate's first hit lands in Umbris's own think (the _voidLandT countdown): count the enemies inside the circle at that moment */
VMX('var __umTh=think; think=function(u,dt){ if(__umMe(u)&&u._voidLandT>0&&u._voidLandT<=dt+1e-9&&u._voidCast){ const vc=u._voidCast; let n=0; enemiesOf(u).forEach(e=>{ if(e.alive&&Math.hypot(e.x-vc.cx,e.y-vc.cy)<vc.R) n++; }); __um.ultN.push(n); } return __umTh.apply(this,arguments); };');
const team=['umbris','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__um.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['grosk','kharos','konwu','carn','vex'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__um.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__um.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__um'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, med=a=>a.length?a.slice().sort((x,y)=>x-y)[a.length>>1]:'-';
console.log('fights '+c.fights+' (12 campaign, 8 two-sided), waves '+c.waves+'; Umbris alive '+(c.ticks/37).toFixed(0)+' s ('+c.ticks+' ticks); scale mode / profile / passive '+c.mode);
console.log('basic attack (bolt): '+c.bolt+' hits, kind '+JSON.stringify(c.boltKind)+', damage '+Math.round(c.dmg.bolt));
console.log('Shadeburst: '+c.sb+' casts, centre '+JSON.stringify(c.sbCtr)+'; rots put on '+c.sbDot+' (per cast '+avg(c.sbN)+' '+hist(c.sbN)+')');
console.log('Creeping Rot: '+c.cr+' casts (no target '+c.crTgtNone+'), hits '+c.crHit+' kind '+JSON.stringify(c.crKind)+', damage '+Math.round(c.dmg.cr)+'; rots '+c.crDot);
console.log('his DoTs pushed: kind '+JSON.stringify(c.dotKind)+', length '+JSON.stringify(c.dotTicks));
console.log('Umbral Cataclysm: '+c.ult+' casts, first hits '+c.ultHit+' kind '+JSON.stringify(c.ultKind)+' (enemies in the circle at the landing: '+avg(c.ultN)+' '+hist(c.ultN)+'), damage '+Math.round(c.dmg.ult)+'; zone ticks '+c.zt+' kind '+JSON.stringify(c.ztKind)+', damage '+Math.round(c.dmg.zone)+', kills by a zone tick '+c.ztDeaths);
console.log('enemy deaths (Umbris on the other side): '+c.deaths+'; carrying a rot of his '+c.rot+' (with the contagion flag '+c.rotCon+'); flagged but no rot of his '+c.rotNoDot+'; deaths that spread '+c.spreadDeaths+' ('+c.spreadN+' spread rots)');
console.log('nearest other enemy when a rotting enemy dies: centre to centre median '+med(c.nn)+' m '+hist(c.nn.map(x=>Math.min(12,Math.round(x))))+'; body gap median '+med(c.nnGap)+' m; within 2.6 m centre: '+c.nn.filter(x=>x<2.6).length+' of '+c.nn.length);
console.log('enemies rotting from him on an average tick: '+(c.rotUp/Math.max(1,c.rotUpN)).toFixed(2));
console.log('hits on him that took HP: '+c.hitsOn+' (basic attacks '+c.hitsOnAuto+', from more than 8 m body to body '+c.hitsOnFar8+', from back-row heroes '+c.hitsOnBack+'); stuns '+c.stunOn+', silences '+c.silOn);
const R=c.refDr; console.log('a reference hit on him each tick: physical mean '+(100*R.p/Math.max(1,R.n)).toFixed(1)+'%, magic mean '+(100*R.m/Math.max(1,R.n)).toFixed(1)+'%');
const L=V.arena(snaps([Object.assign(spec('umbris',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), h=L[0];
console.log('body radius: Umbris '+V.bodyR(h).toFixed(2)+' m, a Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+h.atkInterval.toFixed(3)+' s; max HP '+Math.round(h.maxHp)+', attack '+Math.round(h.dmg)+', ability power '+Math.round(h.apow)+', range '+(h.range/V.METER).toFixed(2)+' m; passive '+JSON.stringify(h.pass)+', passMul '+(h.passMul||1).toFixed(3)+'; armour '+Math.round(h.armorRating||0)+', mr '+Math.round(h.mrRating||0));
console.log('kits: '+JSON.stringify(VMX('KITS.umbris'))+' / ult '+JSON.stringify(VMX('ULT_DEF.umbralcata'))+' + '+JSON.stringify(VMX('HERO_ULT_ART.umbris'))+'; skillMul(100) '+VMX('skillMul(100)')+'; contagion spread at level 100 '+VMX('SKLV.contagionDur(100)')+' s; METER '+V.METER);
