'use strict';
/* Hollow's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each of
   his skills fires and what it reaches in seeded fights with NO talents learned - Fan of Knives (casts, enemies struck, how far the nearest enemy stood),
   Lacerate (casts, hits, ruptures), Vanishing Point (casts, strikes, executes, hops), The Space He Isn't In (misses, heals), his entrance and his time off
   the field, the hits on him, and which rank his basic attacks land on.
   Run: node tests/hollow-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __hk={fan:0,fanHit:0,fanNone:0,fanPer:[],fanNearC:[],fanNearB:[],lac:0,lacHit:0,rupt:0,ruptFan:0,ruptLac:0,ruptVp:0,vp:0,vpStrike:0,vpExec:0,vpHop:0,miss:0,missSrcAuto:0,heal:0,ticks:0,off:0,drop:0,fall:0,hitsOn:0,autoOn:0,skillOn:0,multiOn:0,autos:0,autoBack:0,autoFront:0,bleeds:0,fights:0,firstStrikeAfterDrop:0,landFirst:[]};'+
  'var __hkD=_doEffectCore, __hkDD=_dealDamageCore, __hkU=_updateBattleCore, __hkS=hollowStrike, __hkP=pushDot, __hkCur=null, __hkN=0, __hkAwait=null;'+
  'function __hkRow(e){ const d=(typeof _laneDepthOf==="function")?_laneDepthOf(e.key):1; return d; }'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="hollow"&&(!o||!o.deliver||o._arrived);'+
  '  if(me&&type==="bladefan"){ __hk.fan++; __hkCur="fan"; __hkN=0; let bc=1e9,bb=1e9; for(const e of enemiesOf(u)){ const d=dist(u,e); if(d<bc) bc=d; const g=d-bodyR(e); if(g<bb) bb=g; } __hk.fanNearC.push(bc/METER); __hk.fanNearB.push(bb/METER); }'+
  '  if(me&&type==="bleedstack"){ __hk.lac++; __hkCur="lac"; } if(me&&type==="vanishpoint") __hk.vp++;'+
  '  try{ return __hkD.apply(this,arguments); } finally{ if(me&&type==="bladefan"){ __hk.fanPer.push(__hkN); if(!__hkN) __hk.fanNone++; } if(me) __hkCur=null; } };'+
  'hollowStrike=function(u){ const st=u._vpStep||0; if(st>0) __hk.vpHop++; __hkCur="vp"; const f0=floatTexts.length; try{ return __hkS.apply(this,arguments); } finally{ __hkCur=null; for(let i=f0;i<floatTexts.length;i++) if(floatTexts[i]&&floatTexts[i].txt==="TERMINATED") __hk.vpExec++; } };'+
  'pushDot=function(t,dps,dur,iv,color,src){ if(src&&src.key==="hollow"&&color==="#8f8fa8") __hk.bleeds++; return __hkP.apply(this,arguments); };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const f0=floatTexts.length;'+
  '  if(src&&src.key==="hollow"&&tgt&&tgt.team!==src.team){ if(__hkAwait===src){ __hkAwait=null; __hk.landFirst.push(_autoAtk?"auto":(__hkCur||"other")); }'+
  '    if(color==="#ff5b6b"){ __hk.rupt++; if(__hkCur==="fan") __hk.ruptFan++; else if(__hkCur==="lac") __hk.ruptLac++; else if(__hkCur==="vp") __hk.ruptVp++; }'+
  '    else if(__hkCur==="fan"&&color==="#8f8fa8"){ __hk.fanHit++; __hkN++; } else if(__hkCur==="lac"&&color==="#8f8fa8") __hk.lacHit++; else if(__hkCur==="vp"&&color==="#c9a6ff") __hk.vpStrike++;'+
  '    if(_autoAtk){ __hk.autos++; const d=__hkRow(tgt); if(d>=3) __hk.autoBack++; else if(d<=1.01) __hk.autoFront++; } }'+
  '  if(tgt&&tgt.key==="hollow"&&src&&src.team!==tgt.team){ __hk.hitsOn++; if(_autoAtk) __hk.autoOn++; else __hk.skillOn++; }'+
  '  const r=__hkDD.apply(this,arguments); for(let i=f0;i<floatTexts.length;i++){ const t=floatTexts[i]; if(t&&t.txt==="NOT THERE"&&tgt&&tgt.key==="hollow"){ __hk.miss++; if(_autoAtk) __hk.missSrcAuto++; } } return r; };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="hollow"&&u.alive){ __hk.ticks++; const off=u._dropHidden||(u._vpT>0)||(u._fallT>0); if(off) __hk.off++; if(u._dropHidden) __hk.drop++; if(u._fallT>0) __hk.fall++;'+
  '    if(u._fallT>0&&u._fallT<=dt+1e-9) __hkAwait=u; } } return __hkU.apply(this,arguments); };');
const team=['hollow','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__hk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__hk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__hk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__hk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Hollow alive '+(c.ticks*step).toFixed(0)+' s in all, off the field '+(c.off*step).toFixed(0)+' s (waiting above '+(c.drop*step).toFixed(0)+' s, falling '+(c.fall*step).toFixed(0)+' s)');
console.log('Fan of Knives: '+c.fan+' casts, '+c.fanHit+' enemies struck ('+(c.fan?(c.fanHit/c.fan).toFixed(2):'-')+' a cast), casts that struck nobody '+c.fanNone+', per cast '+hist(c.fanPer));
console.log('  nearest enemy at the cast: centre to centre '+avg(c.fanNearC)+' m (min '+Math.min(...c.fanNearC).toFixed(2)+'), body edge '+avg(c.fanNearB)+' m (casts with the nearest body within 3 m: '+c.fanNearB.filter(x=>x<=3).length+')');
console.log('Lacerate: '+c.lac+' casts, '+c.lacHit+' hits; ruptures '+c.rupt+' (from Fan '+c.ruptFan+', Lacerate '+c.ruptLac+', Vanishing Point '+c.ruptVp+', other '+(c.rupt-c.ruptFan-c.ruptLac-c.ruptVp)+'); bleed stacks pushed '+c.bleeds);
console.log('Vanishing Point: '+c.vp+' casts, '+c.vpStrike+' strikes, '+c.vpExec+' executes, '+c.vpHop+' hops after a kill');
console.log('The Space He Isn\'t In: '+c.miss+' blows missed ('+c.missSrcAuto+' basic attacks); hits on him that landed '+c.hitsOn+' (basic '+c.autoOn+', skills '+c.skillOn+')');
console.log('his basic attacks: '+c.autos+' (on the back rank '+c.autoBack+', on the front rank '+c.autoFront+'); first hit after landing: '+hist(c.landFirst));
const L=V.arena(snaps([spec('hollow',100)]),snaps([spec('vael',100)]),7); console.log('body radius: Hollow '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb));
