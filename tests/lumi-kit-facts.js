'use strict';
/* Lumi's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how often each of
   her skills fires and what it reaches in seeded fights with NO talents learned - Dawnward (casts, on whom, the holds it made), Quickening (casts, allies
   hasted), Radiant Nova (casts, enemies inside its 6 m, allies inside it, how far she stood from the nearest enemy), Hush (fires, the enemy it silenced, how
   long, how often that enemy was casting), her basic attacks and the hits on her.
   Run: node tests/lumi-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __lk={fights:0,dw:0,dwSelf:0,dwTgtHp:[],dwLen:[],holds:0,holdOn:0,holdSelf:0,wardTicks:0,wardHitTicks:0,qk:0,qkN:[],nova:0,novaE:[],novaA:[],novaNone:0,novaNearC:[],novaNearB:[],novaAllyIn:0,novaAllyAll:0,'+
  'hush:0,hushCast:0,hushLen:[],hushNone:0,autos:0,hitsOn:0,autoOn:0,skillOn:0,ticks:0,nearC:[],lowB50:0,below50:0,lowCross:0,dead:0};'+
  'var __lkD=_doEffectCore, __lkDD=_dealDamageCore, __lkU=_updateBattleCore, __lkDm=damage, __lkPrev=new Map();'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="lumi"&&(!o||!o.deliver||o._arrived);'+
  '  if(me&&type==="dawnward"){ __lk.dw++; const l=lowestAlly(u); if(l===u) __lk.dwSelf++; if(l) __lk.dwTgtHp.push(+(l.hp/l.maxHp).toFixed(3)); }'+
  '  if(me&&type==="haste"){ __lk.qk++; __lk.qkN.push(alliesOf(u).length); }'+
  '  if(me&&type==="sunburst"){ __lk.nova++; const R=(o&&o.radius)||6*METER; let ne=0,na=0,all=0,bc=1e9,bb=1e9; for(const e of enemiesOf(u)){ const d=dist(u,e); if(d<R) ne++; if(d<bc) bc=d; const g=d-bodyR(e)-bodyR(u); if(g<bb) bb=g; }'+
  '    for(const a of alliesOf(u)){ all++; if(dist(u,a)<R) na++; } __lk.novaE.push(ne); __lk.novaA.push(na); if(!ne) __lk.novaNone++; __lk.novaNearC.push(bc/METER); __lk.novaNearB.push(bb/METER); __lk.novaAllyIn+=na; __lk.novaAllyAll+=all; }'+
  '  return __lkD.apply(this,arguments); };'+
  'damage=function(u,a){ const held=u&&u.alive&&(u._wardT||0)>0; const r=__lkDm.apply(this,arguments); if(held&&u.alive&&u.hp===1&&a>0){ __lk.holds++; if(u.key==="lumi") __lk.holdSelf++; } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){'+
  '  if(src&&src.key==="lumi"&&tgt&&tgt.team!==src.team&&_autoAtk) __lk.autos++;'+
  '  if(tgt&&tgt.key==="lumi"&&src&&src.team!==tgt.team){ __lk.hitsOn++; if(_autoAtk) __lk.autoOn++; else __lk.skillOn++; }'+
  '  return __lkDD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ const L=units.filter(u=>u&&u.key==="lumi"&&u.alive); const h0=L.map(u=>u._hushT||0);'+
  '  const sil=new Map(); for(const e of units) if(e&&e.alive) sil.set(e,[e.silencedT||0,!!e._pend]);'+
  '  for(const u of L){ __lk.ticks++; let bc=1e9; for(const e of enemiesOf(u)){ const d=dist(u,e); if(d<bc) bc=d; } if(bc<1e9) __lk.nearC.push(bc/METER); }'+
  '  for(const a of units){ if(!a||!a.alive||!L.length||a.team!==L[0].team) continue; if((a._wardT||0)>0){ __lk.wardTicks++; }'+
  '    const p=a.hp/a.maxHp, w=__lkPrev.get(a); if(p<0.5) __lk.below50++; if(w!=null&&w<0.5&&p>=0.5) __lk.lowCross++; __lkPrev.set(a,p); }'+
  '  const r=__lkU.apply(this,arguments);'+
  '  L.forEach((u,i)=>{ if((u._hushT||0)<h0[i]-1e-9){ __lk.hush++; let got=null; for(const [e,v] of sil){ if(e.team!==u.team&&(e.silencedT||0)>v[0]+1e-9){ got=e; __lk.hushLen.push(+(e.silencedT).toFixed(3)); if(v[1]) __lk.hushCast++; break; } } if(!got) __lk.hushNone++; } });'+
  '  return r; };');
const team=['lumi','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__lk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__lk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__lk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__lk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
const step=VMX('SIM_STEP'), med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[b.length>>1].toFixed(2):'-'; };
console.log('fights '+c.fights+'; Lumi alive '+(c.ticks*step).toFixed(0)+' s in all; nearest enemy centre to centre: mean '+avg(c.nearC)+' m, median '+med(c.nearC));
console.log('Dawnward: '+c.dw+' casts ('+c.dwSelf+' on herself); the ward\'s ally at the cast: HP share mean '+avg(c.dwTgtHp)+' (under 50%: '+c.dwTgtHp.filter(x=>x<0.5).length+'); ward-seconds on her team '+(c.wardTicks*step).toFixed(0)+'; holds (a hit left the warded unit at 1 HP) '+c.holds+' ('+c.holdSelf+' on her)');
console.log('Quickening: '+c.qk+' casts, allies hasted a cast '+avg(c.qkN)+' '+hist(c.qkN));
console.log('Radiant Nova: '+c.nova+' casts; enemies inside its 6 m (centre to centre, as the skill measures) '+hist(c.novaE)+'; casts that reached no enemy '+c.novaNone+' ('+(c.nova?Math.round(100*(c.nova-c.novaNone)/c.nova):0)+'% reach one); nearest enemy at the cast: centre '+avg(c.novaNearC)+' m (median '+med(c.novaNearC)+'), body to body '+avg(c.novaNearB)+' m');
console.log('  allies inside it '+hist(c.novaA)+' (an ally healed on '+c.novaA.filter(x=>x>0).length+' of '+c.nova+' casts; '+c.novaAllyIn+' of '+c.novaAllyAll+' ally-casts)');
console.log('Hush: '+c.hush+' fires, '+(c.hush-c.hushNone)+' silences, silence length '+avg(c.hushLen)+' s '+hist(c.hushLen)+'; the enemy was casting when silenced: '+c.hushCast);
console.log('her basic attacks '+c.autos+'; hits on her '+c.hitsOn+' (basic '+c.autoOn+', skills '+c.skillOn+'); ally-seconds below 50% HP '+(c.below50*step).toFixed(0)+', climbs back above 50% '+c.lowCross);
const L=V.arena(snaps([Object.assign(spec('lumi',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7);
console.log('body radius: Lumi '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', apow '+Math.round(L[0].apow)+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passMul '+L[0].passMul+'; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb));
