'use strict';
/* Mellan's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each of
   his skills fires and what it reaches in seeded fights with NO talents learned - Hornet Cloud (casts, stings, enemies stung per cast, how far the stung
   enemies stood from the cloud's centre), Royal Nectar (casts, its ally, the heal and its heal over time, any attack speed), Hive Mind (casts, shares, how
   many land as honey and as stings), Worker Swarm (heals per second as a share of the ally's max HP, pulses at full HP), ally deaths, and his numbers.
   Run: node tests/mellan-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __mk={fights:0,ticks:0,cloud:0,cloudTicks:0,stings:0,cloudNone:0,perCloud:[],stungD:[],nectar:0,nectarSelf:0,nectarFull:0,nectarHeal:[],nectarAspd:0,hive:0,shares:0,honey:0,hstings:0,wHeal:0,wPulse:0,wFull:0,wShare:[],allyDeaths:0,mellanDeaths:0,hitsOnAllies:0,hitsOnMellan:0,wave:0};'+
  'var __mkD=_doEffectCore, __mkB=beeLand, __mkH=ddHp, __mkDD=_dealDamageCore, __mkU=_updateBattleCore, __mkS=spawnHornetSwarm, __mkG=spawnHoneyGlob, __mkInB=false, __mkC=null;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="mellan"; if(me&&type==="hornetswarm") __mk.cloud++; if(me&&type==="hivemind") __mk.hive++; return __mkD.apply(this,arguments); };'+
  'spawnHoneyGlob=function(u,t,onLand){ if(u&&u.key==="mellan"){ __mk.nectar++; if(t===u) __mk.nectarSelf++; if(t.hp>=t.maxHp-1e-6) __mk.nectarFull++; const ai=t.atkInterval;'+
  '  const f=onLand; onLand=function(){ const h0=t.hp; const r=f.apply(this,arguments); __mk.nectarHeal.push((t.hp-h0)/t.maxHp); if(t.atkInterval!==ai) __mk.nectarAspd++; return r; }; } return __mkG.call(this,u,t,onLand); };'+
  'spawnHornetSwarm=function(u,cx,cy,R,cfg){ const r=__mkS.apply(this,arguments); if(u&&u.key==="mellan"){ const c=_bees[_bees.length-1-cfg.n]; if(c&&c.ph===5){ c.__mk=1; c.__n=0; c.__set={}; } } return r; };'+
  'beeLand=function(u,t,cfg){ if(u&&u.key==="mellan"){ __mk.shares++; if(t&&t.team===u.team) __mk.honey++; else __mk.hstings++; } __mkInB=true; try{ return __mkB.apply(this,arguments); } finally{ __mkInB=false; } };'+
  'ddHp=function(u,v,by){ if(by&&by.key==="mellan"&&by.pass&&by.pass.beeward){ } return __mkH.apply(this,arguments); };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(tgt&&src&&src.team!==tgt.team&&tgt.team==="ally"&&!tgt.summoned){ if(tgt.key==="mellan") __mk.hitsOnMellan++; else __mk.hitsOnAllies++; }'+
  '  if(src&&src.key==="mellan"&&__mkC&&!__mkInB&&tgt&&tgt.team!==src.team){ __mk.stings++; __mkC.__n++; __mkC.__set[tgt.uid]=1; __mk.stungD.push(Math.hypot(tgt.x-__mkC.cx,tgt.y-__mkC.cy)/METER); } return __mkDD.apply(this,arguments); };'+
  'var __mkUB=updateBees; updateBees=function(dt){ for(const b of _bees){ if(b.ph===5&&b.__mk&&b.acc+dt>=b.tick){ __mk.cloudTicks++; } }'+
  '  const keep=_bees.filter(b=>b.ph===5&&b.__mk); const hp=new Map(); for(const b of _bees) if(b.ph===8&&b.u&&b.u.key==="mellan"&&b.t&&b.acc+dt>=0.5) hp.set(b,[b.t,b.t.hp,b.t.hp>=worldHealCap(b.t)-1e-9]);'+
  '  const ph5=_bees.filter(b=>b.ph===5&&b.__mk&&b.acc+dt>=b.tick); __mkC=ph5.length?ph5[0]:null; const r=__mkUB.apply(this,arguments); __mkC=null;'+
  '  for(const [b,[t,h0,full]] of hp){ __mk.wPulse++; if(full) __mk.wFull++; else { __mk.wHeal++; __mk.wShare.push((t.hp-h0)/t.maxHp/0.5); } }'+
  '  for(const b of keep) if(_bees.indexOf(b)<0){ __mk.perCloud.push(Object.keys(b.__set).length); if(!b.__n) __mk.cloudNone++; } return r; };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="mellan"&&u.alive) __mk.ticks++; } const al=units.filter(u=>u.team==="ally"&&u.alive&&!u.summoned); const r=__mkU.apply(this,arguments);'+
  '  for(const u of al) if(!u.alive){ if(u.key==="mellan") __mk.mellanDeaths++; else __mk.allyDeaths++; } return r; };');
const team=['mellan','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__mk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__mk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__mk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__mk'), step=VMX('SIM_STEP'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length):0, hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
console.log('fights '+c.fights+'; Mellan alive '+(c.ticks*step).toFixed(0)+' s in all; ally deaths '+c.allyDeaths+', Mellan deaths '+c.mellanDeaths+'; hits on his allies '+c.hitsOnAllies+', on him '+c.hitsOnMellan);
console.log('Hornet Cloud: '+c.cloud+' casts, '+c.cloudTicks+' sting ticks, '+c.stings+' stings ('+(c.cloud?(c.stings/c.cloud).toFixed(2):'-')+' a cast), clouds that stung nobody '+c.cloudNone+', enemies stung per cloud '+hist(c.perCloud)+'; stung enemies stood '+avg(c.stungD).toFixed(2)+' m from the centre (max '+Math.max(0,...c.stungD).toFixed(2)+')');
console.log('Royal Nectar: '+c.nectar+' casts (on himself '+c.nectarSelf+', on an ally already at full HP '+c.nectarFull+'), burst heal '+(avg(c.nectarHeal)*100).toFixed(1)+'% of the ally\'s max HP on average, attack speed changed on landing '+c.nectarAspd);
console.log('Hive Mind: '+c.hive+' casts, '+c.shares+' shares landed ('+c.honey+' honey, '+c.hstings+' stings)');
console.log('Worker Swarm: '+c.wPulse+' pulses (every 0.5 s per ally), at full HP '+c.wFull+' ('+(100*c.wFull/Math.max(1,c.wPulse)).toFixed(0)+'%), healing ones '+c.wHeal+': '+(avg(c.wShare)*100).toFixed(2)+'% of the ally\'s max HP a second on average');
const L=V.arena(snaps([Object.assign(spec('mellan',100),{skillLv:[100,100,100,100]}),spec('vael',100)]),snaps([spec('vael',100)]),7);
const m=L[0]; console.log('Mellan at level 100, skill level 100: max HP '+Math.round(m.maxHp)+', ability power '+Math.round(m.apow)+', attack '+Math.round(m.dmg)+', healing power x'+(m.healPowMul||1).toFixed(3)+', passMul '+(m.passMul||1).toFixed(3)+', armor '+Math.round(m.armorRating||0)+', mr '+Math.round(m.mrRating||0)+', range '+(m.range/V.METER).toFixed(2)+' m, attack interval '+m.atkInterval.toFixed(3)+' s, body '+V.bodyR(m).toFixed(2)+' m; passive '+JSON.stringify(m.pass)+'; ally Vael max HP '+Math.round(L[1].maxHp)+' -> worker heal '+((L[1].maxHp*0.004+(m.apow||0)*0.08*(m.passMul||1))/L[1].maxHp*100).toFixed(2)+'% of it a second');
console.log('green '+JSON.stringify(m.greenAb)+'; blue '+JSON.stringify(m.blueAb));
