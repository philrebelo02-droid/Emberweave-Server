'use strict';
/* Hurne's real kit, measured (not a test: run with plain node on the cluster). What his talents build on: how often each of his skills fires, how many
   summons each one raises, how long they stand and how they end (time out, killed, taken by Feed Them, with their master), what they hit, how far from
   him they stand (Kept Close is 4 m body to body), how many enemies stand within 1.5 m of a warrior (Smoulder), and what Feed Them's rupture reaches
   (today: 3 m from his centre; after the v1391 fix: to the enemy's body edge). No talents learned.
   Run: node tests/hurne-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __hk={fights:0,ticks:0,green:0,blue:0,ult:0,warRisen:0,shaRisen:0,warPer:[],packAt:[],rupCentre:0,rupEdge:0,rupHit:0,rupNone:0,rupEdgeNone:0,'+
  ' life:{"boar warrior":[],"boar shaman":[]},end:{time:0,killed:0,fed:0,master:0},hitW:0,hitS:0,hitWauto:0,hitSauto:0,chant:0,pyre:0,chantHeal:0,chantHealN:0,'+
  ' kc:0,kcN:0,sumTicks:0,kc4:0,packN:[0,0,0,0,0,0,0,0,0],near15:0,near15ticks:0,sameTgt:0,sameTgtN:0,gapSpawn:[],hurneHits:0,hurneHitsOn:0,diedSummon:0};'+
  'var __hkD=_doEffectCore, __hkDD=_dealDamageCore, __hkU=_updateBattleCore, __hkSU=summonUnit, __hkKS=killSummon, __hkHU=healUnit, __hkL={}, __hkFeed=0, __hkInChant=0;'+
  'const __hkG=x=>(x.x!=null)?x:null;'+
  '_doEffectCore=function(u,type,o){ if(u&&u.key==="hurne"&&(!o||!o.deliver||o._arrived)){'+
  '  if(type==="summonwarriors"){ __hk.green++; } if(type==="summonshaman") __hk.blue++;'+
  '  if(type==="devourpack"){ __hk.ult++; const pk=units.filter(x=>x.alive&&x._summonOwner===u); __hk.packAt.push(pk.length); let c=0,e=0; const R=((o&&o.radius)||3*METER);'+
  '    for(const x of enemiesOf(u)){ if(!x.alive) continue; const d=dist(u,x); if(d<R) c++; if(d-bodyR(x)<R) e++; } __hk.rupCentre+=c; __hk.rupEdge+=e; if(!c) __hk.rupNone++; if(!e) __hk.rupEdgeNone++; __hkFeed=1; } }'+
  '  if(u&&u.key==="boar shaman"&&u._summonOwner&&u._summonOwner.key==="hurne"){ if(type==="chantzone") __hk.chant++; if(type==="aoedot") __hk.pyre++; }'+
  '  try{ return __hkD.apply(this,arguments); } finally{ if(u&&u.key==="hurne"&&type==="devourpack") __hkFeed=0; } };'+
  'summonUnit=function(owner,key,dur,off){ const x=__hkSU.apply(this,arguments); if(x&&owner&&owner.key==="hurne"){ if(key==="boar warrior") __hk.warRisen++; else __hk.shaRisen++;'+
  '  __hkL[x.uid]={x,key,age:0}; __hk.gapSpawn.push((dist(owner,x)-bodyR(owner)-bodyR(x))/METER); } return x; };'+
  'killSummon=function(p){ const r=p&&__hkL[p.uid]; if(r&&p.alive){ const why=__hkFeed?"fed":(!p._summonOwner||!p._summonOwner.alive)?"master":(p._summonT<=0?"time":"killed"); __hk.end[why]++; __hk.life[r.key].push(r.age); delete __hkL[p.uid]; } return __hkKS.apply(this,arguments); };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const auto=!!_autoAtk;'+
  '  if(src&&__hkL[src.uid]&&tgt&&tgt.team!==src.team){ if(src.key==="boar warrior"){ __hk.hitW++; if(auto) __hk.hitWauto++; } else { __hk.hitS++; if(auto) __hk.hitSauto++; } }'+
  '  if(src&&src.key==="hurne"&&color==="#b03a3a") __hk.rupHit++; if(src&&src.key==="hurne"&&auto) __hk.hurneHits++; if(tgt&&tgt.key==="hurne"&&src&&src.team!==tgt.team) __hk.hurneHitsOn++;'+
  '  return __hkDD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(!u||u.key!=="hurne"||!u.alive) continue; __hk.ticks++; const mine=units.filter(x=>x.alive&&x._summonOwner===u&&!(x._riseT>0)); __hk.packN[Math.min(8,mine.length)]++;'+
  '    let k=0; for(const x of mine){ __hk.sumTicks++; const g=(dist(u,x)-bodyR(u)-bodyR(x))/METER; if(g<4){ __hk.kc++; k++; } if(x.target&&u.target&&x.target===u.target) __hk.sameTgt++; __hk.sameTgtN++; } if(k>=4) __hk.kc4++;'+
  '    const W=mine.filter(x=>x.key==="boar warrior"); if(W.length){ __hk.near15ticks++; for(const e of enemiesOf(u)){ if(!e.alive) continue; if(W.some(w=>dist(w,e)-bodyR(w)-bodyR(e)<1.5*METER)) __hk.near15++; } } }'+
  '  for(const id in __hkL){ const r=__hkL[id]; if(!r.x.alive){ __hk.end.killed++; __hk.life[r.key].push(r.age); delete __hkL[id]; } else r.age+=dt; }'+
  '  return __hkU.apply(this,arguments); };');
const team=['hurne','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__hk.fights++; __hkL={}'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__hk.fights++; __hkL={}'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__hk.fights++; __hkL={}'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__hk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, mx=a=>a.length?Math.max(...a).toFixed(2):'-';
console.log('fights '+c.fights+'; Hurne alive '+(c.ticks*V.STEP).toFixed(0)+' s in all');
console.log('Unchain the Dead: '+c.green+' casts, '+c.warRisen+' warriors risen ('+(c.green?(c.warRisen/c.green).toFixed(2):'-')+' a cast)');
console.log('Call the Bone-Chanter: '+c.blue+' casts, '+c.shaRisen+' shamans risen; Bone Chant '+c.chant+' casts, Pyre Grunt '+c.pyre+' casts');
console.log('summon lives (s): warriors mean '+avg(c.life['boar warrior'])+' max '+mx(c.life['boar warrior'])+' (n '+c.life['boar warrior'].length+'), shamans mean '+avg(c.life['boar shaman'])+' max '+mx(c.life['boar shaman'])+' (n '+c.life['boar shaman'].length+')');
console.log('how summons end: '+JSON.stringify(c.end));
console.log('summon hits on enemies: warriors '+c.hitW+' (basic '+c.hitWauto+'), shamans '+c.hitS+' (basic '+c.hitSauto+'); a summon on the same target as Hurne '+(100*c.sameTgt/Math.max(1,c.sameTgtN)).toFixed(1)+'% of summon ticks');
console.log('summons standing (risen) per Hurne tick: '+JSON.stringify(c.packN)+'; within 4 m of him (body to body) '+(100*c.kc/Math.max(1,c.sumTicks)).toFixed(1)+'% of summon ticks; 4 or more within 4 m '+(100*c.kc4/Math.max(1,c.ticks)).toFixed(1)+'% of his ticks');
console.log('gap at spawn (m, body to body): mean '+avg(c.gapSpawn)+' max '+mx(c.gapSpawn));
console.log('enemies within 1.5 m of a warrior (body to body): '+(c.near15/Math.max(1,c.near15ticks)).toFixed(2)+' on average while a warrior stands');
console.log('Feed Them: '+c.ult+' casts, summons taken per cast '+hist(c.packAt)+'; enemies in reach per cast: '+(c.rupCentre/Math.max(1,c.ult)).toFixed(2)+' from his centre (today), '+(c.rupEdge/Math.max(1,c.ult)).toFixed(2)+' to the body edge (after v1391); casts reaching nobody: '+c.rupNone+' today, '+c.rupEdgeNone+' after the fix; rupture hits '+c.rupHit);
console.log('Hurne basic attacks landed '+c.hurneHits+', hits on him '+c.hurneHitsOn);
const L=V.arena(snaps([spec('hurne',100)]),snaps([spec('vael',100)]),7); console.log('body radius: Hurne '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', melee '+!!L[0].melee+'; passive '+JSON.stringify(L[0].pass)+', passMul '+(L[0].passMul||1));
