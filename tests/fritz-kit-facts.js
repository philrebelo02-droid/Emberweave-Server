'use strict';
/* Fritz's real kit, measured (not a test: run with plain node on PC 2). What his talents build on: how often each of his skills fires and how many
   enemies it reaches in seeded fights, how often Static Veil dodges, how long it is up, and how far he walks (Miles). No talents learned.
   Run: node tests/fritz-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __fk={ss:0,ssBolts:0,ssHit:0,cl:0,clHit:0,clPer:[],ts:0,tsPulse:0,tsHit:0,tsPer:[],tsNone:0,veil:0,hitsOn:0,hitsCasting:0,autoOn:0,meleeOn:0,ticks:0,veilUp:0,moved:0,fights:0,stormTicks:0,energyGain:0};'+
  'var __fkD=_doEffectCore, __fkDD=_dealDamageCore, __fkU=_updateBattleCore, __fkCur=null, __fkN=0, __fkPx={};'+
  '_doEffectCore=function(u,type,o){ if(u&&u.key==="fritz"&&(!o||!o.deliver||o._arrived)){ if(type==="stormsurge"){ __fk.ss++; __fk.ssBolts+=Math.min((o&&o.n)||5,enemiesOf(u).length); }'+
  '  if(type==="chainlight"){ __fk.cl++; __fkCur="cl"; __fkN=0; } if(type==="thundershower") __fk.ts++; }'+
  '  try{ return __fkD.apply(this,arguments); } finally{ if(__fkCur==="cl"){ __fk.clPer.push(__fkN); __fkCur=null; } } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const f0=floatTexts.length;'+
  '  if(src&&src.key==="fritz"){ if(color==="#f2e07a"&&kind==="magic") __fk.ssHit++; else if(color==="#bfe6ff"){ __fk.clHit++; __fkN++; } else if(color==="#f2e07a"&&!kind){ __fk.tsHit++; __fkTs++; } }'+
  '  if(tgt&&tgt.key==="fritz"&&src&&src.team!==tgt.team){ __fk.hitsOn++; if(_autoAtk) __fk.autoOn++; if(src.melee) __fk.meleeOn++; if((tgt._stormT||0)>0||(tgt._castT||0)>0) __fk.hitsCasting++; }'+
  '  const r=__fkDD.apply(this,arguments); for(let i=f0;i<floatTexts.length;i++){ const t=floatTexts[i]; if(t&&t.txt==="DODGE"&&t.color==="#f2d84a"&&tgt&&tgt.key==="fritz") __fk.veil++; } return r; };'+
  'var __fkTs=0;'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="fritz"&&u.alive){ __fk.ticks++; if((u._stormT||0)>0||(u._castT||0)>0) __fk.veilUp++; if((u._stormT||0)>0) __fk.stormTicks++;'+
  '    const p=__fkPx[u.uid]; if(p) __fk.moved+=Math.hypot(u.x-p[0],u.y-p[1])/METER; __fkPx[u.uid]=[u.x,u.y]; const sa=u._stormAcc; } }'+
  '  const before={}; for(const u of units) if(u&&u.key==="fritz") before[u.uid]=[u._stormT||0,u._stormAcc||0];'+
  '  __fkTs=0; const r=__fkU.apply(this,arguments);'+
  '  for(const u of units) if(u&&u.key==="fritz"&&before[u.uid]){ const b=before[u.uid]; if(b[0]>0&&(b[1]+dt)>=0.5-1e-9&&((u._stormAcc||0)<b[1]+dt-0.25)){ __fk.tsPulse++; __fk.tsPer.push(__fkTs); if(!__fkTs) __fk.tsNone++; } } return r; };');
const team=['fritz','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__fkPx={}; __fk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__fkPx={}; __fk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__fkPx={}; __fk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__fk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
console.log('fights '+c.fights+'; Fritz alive '+(c.ticks/30).toFixed(0)+' s in all');
console.log('Storm Surge: '+c.ss+' casts, '+c.ssBolts+' bolts sent, '+c.ssHit+' bolts struck ('+(c.ss?(c.ssHit/c.ss).toFixed(2):'-')+' a cast)');
console.log('Chain Lightning: '+c.cl+' casts, '+c.clHit+' hits, per cast '+avg(c.clPer)+' '+hist(c.clPer));
console.log('Thunder Shower: '+c.ts+' casts, '+c.tsPulse+' pulses ('+(c.ts?(c.tsPulse/c.ts).toFixed(2):'-')+' a cast), '+c.tsHit+' strikes, per pulse '+avg(c.tsPer)+' '+hist(c.tsPer)+', pulses hitting nobody '+c.tsNone);
console.log('Static Veil: up '+(100*c.veilUp/Math.max(1,c.ticks)).toFixed(1)+'% of his time ('+(c.stormTicks/30).toFixed(0)+' s channelling); hits on him '+c.hitsOn+' (basic attacks '+c.autoOn+', from melee '+c.meleeOn+'), '+c.hitsCasting+' while casting or channelling, dodged '+c.veil);
console.log('walked '+c.moved.toFixed(0)+' m in all ('+(c.moved/Math.max(1,c.fights)).toFixed(1)+' m a fight, '+(c.moved/Math.max(1,c.ticks/30)).toFixed(2)+' m a second alive)');
const L=V.arena(snaps([spec('fritz',100)]),snaps([spec('vael',100)]),7); console.log('body radius: Fritz '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', ability power '+Math.round(L[0].apow)+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(1)+' m; passive '+JSON.stringify(L[0].pass));
