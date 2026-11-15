'use strict';
/* Meridian's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each of
   his skills fires and what it reaches in seeded fights with NO talents learned - Golden Quill (casts, enemies on its line, the farthest one struck), Plumb Line
   (casts, landings, how far its target stood: the share of its long-shot bonus), Final Expedition (casts, enemies struck, bleeds), Well-Read (when it is at its
   full ramp), his basic attacks (blocked by a Tank's shield wall, missed to Evasion, halved by Block: Windage), the time no enemy stood within 4 m of him
   (Sightline), the time below 50% HP (Provisions) and his deaths.
   Run: node tests/meridian-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __mk={q:0,qHit:0,qNone:0,qFar:0,qPer:[],pl:0,plLand:0,plFar:[],plFull:0,fe:0,feHit:0,feBleed:0,ticks:0,clear:0,low:0,full:0,fullAt:[],autos:0,edgeBlock:0,evaMiss:0,blockHalf:0,deaths:0,fights:0,hitsOn:0};'+
  'var __mkD=_doEffectCore, __mkDD=_dealDamageCore, __mkU=_updateBattleCore, __mkCur=null, __mkN=0, __mkFar=null, __mkSort=null;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="meridian"&&(!o||!o.deliver||o._arrived);'+
  '  if(me&&type==="piercethrow"){ __mk.q++; __mkCur="q"; __mkN=0; const f=enemiesOf(u).filter(e=>e.alive).sort((a,b)=>dist(u,b)-dist(u,a)); __mkFar=f[0]||null; }'+
  '  if(me&&type==="plumbline"){ __mk.pl++; __mkCur="pl"; const t=o&&o._tgtU; if(t){ const fr=Math.min(1,dist(u,t)/(8*METER)); __mk.plFar.push(fr); if(fr>=1) __mk.plFull++; } }'+
  '  if(me&&type==="finalsurvey"){ __mk.fe++; __mkCur="fe"; }'+
  '  try{ return __mkD.apply(this,arguments); } finally{ if(me&&type==="piercethrow"){ __mk.qPer.push(__mkN); if(!__mkN) __mk.qNone++; } if(me) __mkCur=null; } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const f0=floatTexts.length, me=src&&src.key==="meridian"&&tgt&&tgt.team!==src.team, au=_autoAtk;'+
  '  if(me){ if(__mkCur==="q"){ __mk.qHit++; __mkN++; if(tgt===__mkFar) __mk.qFar++; } else if(__mkCur==="pl") __mk.plLand++; else if(__mkCur==="fe") __mk.feHit++; if(au) __mk.autos++; }'+
  '  if(tgt&&tgt.key==="meridian"&&src&&src.team!==tgt.team) __mk.hitsOn++;'+
  '  const r=__mkDD.apply(this,arguments); if(me&&au){ for(let i=f0;i<floatTexts.length;i++){ const t=floatTexts[i]; if(!t) continue; if(t.txt==="BLOCK"&&t.sz===12) __mk.edgeBlock++; else if(t.txt==="BLOCK") __mk.blockHalf++; else if(t.txt==="MISS") __mk.evaMiss++; } } return r; };'+
  'var __mkP=pushDot; pushDot=function(t,dps,dur,iv,color,src){ if(src&&src.key==="meridian"&&__mkCur==="fe") __mk.feBleed++; return __mkP.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="meridian"){ if(!u.alive){ if(!u.__mkDead){ u.__mkDead=1; __mk.deaths++; } continue; } __mk.ticks++;'+
  '    let g=1e9; for(const e of enemiesOf(u)){ if(!e.alive) continue; const d=dist(u,e)-bodyR(u)-bodyR(e); if(d<g) g=d; } if(g>=4*METER) __mk.clear++;'+
  '    if(u.hp<0.5*u.maxHp) __mk.low++; const cap=SKLV.momentumCap(passLv(u)); if((u._momStk||0)>=cap-1e-9){ __mk.full++; if(!u.__mkF){ u.__mkF=1; __mk.fullAt.push(battleTime); } } } } return __mkU.apply(this,arguments); };');
const team=['meridian','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__mk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','grosk','dandra','brannus','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__mk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__mk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__mk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
const step=VMX('SIM_STEP'), pc=x=>(100*x/Math.max(1,c.ticks)).toFixed(1)+'%';
console.log('fights '+c.fights+'; Meridian alive '+(c.ticks*step).toFixed(0)+' s in all, deaths '+c.deaths);
console.log('Golden Quill: '+c.q+' casts, '+c.qHit+' enemies struck ('+(c.q?(c.qHit/c.q).toFixed(2):'-')+' a cast), the farthest enemy struck in '+c.qFar+', casts that struck nobody '+c.qNone+', per cast '+hist(c.qPer));
console.log('Plumb Line: '+c.pl+' landings ('+c.plLand+' hits), long-shot share at landing avg '+avg(c.plFar)+', at its full bonus (8 m+ centre to centre) '+c.plFull);
console.log('Final Expedition: '+c.fe+' casts, '+c.feHit+' enemies struck ('+(c.fe?(c.feHit/c.fe).toFixed(2):'-')+' a cast), '+c.feBleed+' bleeds');
console.log('Well-Read at its full ramp '+pc(c.full)+' of his time alive; first full at '+c.fullAt.map(x=>x.toFixed(1)).join(', ')+' s');
console.log('no enemy within 4 m (body to body) '+pc(c.clear)+'; below 50% HP '+pc(c.low)+'; hits on him '+c.hitsOn);
console.log('his basic attacks: '+c.autos+' landed; shield-wall BLOCKs '+c.edgeBlock+', Evasion MISSes '+c.evaMiss+', Block halvings '+c.blockHalf);
const L=V.arena(snaps([spec('meridian',100)]),snaps([spec('vael',100)]),7); console.log('body radius: Meridian '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb)+'; ramp cap at lv 100 '+VMX('SKLV.momentumCap(100)')+', at lv 10 '+VMX('SKLV.momentumCap(10)'));
