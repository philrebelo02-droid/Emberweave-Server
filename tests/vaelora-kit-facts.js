'use strict';
/* Vaelora Velvetclaw's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how
   often each of her skills fires and what it reaches in seeded fights with NO talents learned -
   Featherfang ('piercethrow': a line toward the FARTHEST enemy, every enemy whose centre is within the line's half-width), Whiteout Pounce ('evadecounter': an
   evade window, the hit it is spent on, the counter and whom it strikes), Winter Plumage ('blizzard': the 4 s channel, its ticks, the enemies each tick reaches,
   its freezes and how long they land), Silent Altitude ('silentalt': 3 s untouched, then critical damage until something lands - how long it holds, what spoils
   it), her basic attacks, her critical hits and kills, the hits on her (basic attacks, ranged, from more than 6 m), her deaths.
   Run: node tests/vaelora-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX(`var __vk={fights:0,ticks:0,deaths:0,ff:0,ffPer:[],ffFar:0,ffFoes:[],ffFarGap:[],ffCrit:0,ffHits:0,wp:0,wpSpent:0,wpExpired:0,wpLow:0,wpCtr:0,ctrCrit:0,wpWin:[],
  ult:0,ultTicks:0,ultPer:[],frz:0,frzOn:0,frzLen:{},frzPerCast:[],frzAlready:0,autos:0,autoCrit:0,hitsBy:0,crits:0,kills:0,killCrit:0,killBy:{},
  saTicks:0,saOn:0,saOff:0,saRuns:[],spoilEvade:0,spoilHit:0,hitsOn:0,autosOn:0,farOn:0,meleeOn:0,stunOn:0,slowOn:0,low30:0,energyAt:[],critCh:[],critDmg:[],firstUlt:[],
  stalkFull:0,waveStarts:0};
var __vkD=_doEffectCore, __vkDD=_dealDamageCore, __vkTh=think, __vkU=_updateBattleCore, __vkCur=null, __vkN=0, __vkFar=null, __vkFz=0, __vkUlt=null;
function __vkMe(u){ return !!(u&&u.key==='vaelora'); }
_doEffectCore=function(u,type,o){ const me=__vkMe(u);
  if(me&&type==='piercethrow'){ __vk.ff++; __vkCur='ff'; __vkN=0; const foes=enemiesOf(u); __vk.ffFoes.push(foes.length); __vkFar=foes.slice().sort((a,b)=>dist(u,b)-dist(u,a))[0]||null;
    if(__vkFar) __vk.ffFarGap.push(+((dist(u,__vkFar)-bodyR(u)-bodyR(__vkFar))/METER).toFixed(1)); }
  if(me&&type==='evadecounter'){ __vk.wp++; u.__vkWin=0; }
  if(me&&type==='blizzard'){ __vk.ult++; __vkUlt={n:0}; __vk.firstUlt.push(+battleTime.toFixed(1)); }
  try{ return __vkD.apply(this,arguments); } finally{ if(me&&type==='piercethrow'){ __vk.ffPer.push(__vkN); __vkCur=null; } } };
_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=__vkMe(src)&&tgt&&tgt.team!==src.team, au=_autoAtk, on=__vkMe(tgt)&&src&&src.team!==tgt.team;
  const ctr=me&&src._ctring===1, alive0=tgt&&tgt.alive; let ev=false;
  if(on){ __vk.hitsOn++; if(au) __vk.autosOn++; if(src.melee) __vk.meleeOn++; if(dist(src,tgt)-bodyR(src)-bodyR(tgt)>6*METER) __vk.farOn++; ev=(tgt._evadeT||0)>0;
    if(ev){ __vk.wpSpent++; let lo=null; enemiesOf(tgt).forEach(e=>{ if(e.alive&&(!lo||e.hp/e.maxHp<lo.hp/lo.maxHp)) lo=e; }); if(lo===src) __vk.wpLow++; }
    if((tgt._untouched||0)>=3&&tgt._saOn){ if(ev) __vk.spoilEvade++; else __vk.spoilHit++; } }
  if(me&&tgt) tgt._critHit=false;
  const r=__vkDD.apply(this,arguments);
  if(me){ __vk.hitsBy++; const c=!!tgt._critHit; if(c) __vk.crits++; if(au){ __vk.autos++; if(c) __vk.autoCrit++; }
    if(__vkCur==='ff'){ __vkN++; __vk.ffHits++; if(tgt===__vkFar) __vk.ffFar++; if(c) __vk.ffCrit++; }
    if(ctr){ __vk.wpCtr++; if(c) __vk.ctrCrit++; }
    if(alive0&&!tgt.alive){ __vk.kills++; if(c) __vk.killCrit++; const k=au?'auto':(__vkCur==='ff'?'featherfang':(ctr?'counter':((src._blizzT||0)>0?'storm':'other'))); __vk.killBy[k]=(__vk.killBy[k]||0)+1; } }
  return r; };
think=function(u,dt){ if(!__vkMe(u)||!u.alive) return __vkTh.apply(this,arguments);
  const bz=(u._blizzT||0)>0, acc=u._blizzAcc||0, foes=enemiesOf(u), st0=foes.map(e=>e.stunned||0), ev0=u._evadeT||0;
  const r=__vkTh.apply(this,arguments);
  if(bz&&acc+dt>=0.5&&__vkUlt){ __vk.ultTicks++; let n=0; foes.forEach((e,i)=>{ if(e.alive&&dist({x:u._blizzX,y:u._blizzY},e)<8*METER) n++;
      const s1=e.stunned||0; if(s1>st0[i]-dt+1e-6&&s1>0){ __vk.frz++; __vkUlt.n++; if(st0[i]>0) __vk.frzAlready++; const k=s1.toFixed(2); __vk.frzLen[k]=(__vk.frzLen[k]||0)+1; } }); __vk.ultPer.push(n); }
  if(bz&&!((u._blizzT||0)>0)&&__vkUlt){ __vk.frzPerCast.push(__vkUlt.n); __vkUlt=null; }
  if(ev0>0&&!((u._evadeT||0)>0)&&u.__vkWin!=null){ /* the window closed this tick: spent (counted at the hit) or ran out */ }
  return r; };
_updateBattleCore=function(dt){ for(const u of units){ if(!__vkMe(u)) continue; if(!u.alive){ if(!u.__vkDead){ u.__vkDead=1; __vk.deaths++; } continue; } __vk.ticks++;
    if(u.__vkEv>0&&!((u._evadeT||0)>0)&&!u.__vkSpent) __vk.wpExpired++; u.__vkSpent=0; u.__vkEv=u._evadeT||0;
    if(u._saOn){ __vk.saTicks++; u.__vkRun=(u.__vkRun||0)+dt; if(u.__vkRun>=8) u.__vkS8=1; } else if(u.__vkRun){ __vk.saRuns.push(+u.__vkRun.toFixed(1)); u.__vkRun=0; }
    if(u._saOn&&!u.__vkSa) __vk.saOn++; if(!u._saOn&&u.__vkSa) __vk.saOff++; u.__vkSa=!!u._saOn;
    if((u.stunned||0)>0) __vk.stunOn++; if((u.slow||0)>0) __vk.slowOn++; if(u.hp<0.3*u.maxHp) __vk.low30++;
    if(!u.__vkI){ u.__vkI=1; __vk.critCh.push(+(u.glyphCrit||0).toFixed(3)); __vk.critDmg.push(+(u.critDmg||0.6).toFixed(3)); } }
  return __vkU.apply(this,arguments); };`);
/* an evade spent: the window was open when an enemy's hit arrived (the hit itself counted above); the window that ran out unspent counted per tick */
VMX(`(function(){ const f=_dealDamageCore; _dealDamageCore=function(src,tgt){ if(__vkMe(tgt)&&(tgt._evadeT||0)>0&&src&&src.team!==tgt.team&&!tgt._ctring) tgt.__vkSpent=1; return f.apply(this,arguments); }; })();`);
const team=['vaelora','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90,120]) for(const seed of [7,1000007,987654]){ VMX('__vk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foeA=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
const foeB=snaps(['ambrel','grosk','dandra','brannus','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337]){ const foe=seed%2?foeA:foeB; VMX('__vk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__vk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__vk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
const step=VMX('SIM_STEP'), pc=x=>(100*x/Math.max(1,c.ticks)).toFixed(1)+'%';
console.log('fights '+c.fights+'; Vaelora alive '+(c.ticks*step).toFixed(0)+' s in all, deaths '+c.deaths+', below 30% HP '+pc(c.low30));
console.log('Featherfang: '+c.ff+' casts, enemies struck per cast '+hist(c.ffPer)+' (avg '+avg(c.ffPer)+'), the farthest (its aim) struck '+c.ffFar+', critical '+c.ffCrit+' of '+c.ffHits+'; enemies on the field at the cast avg '+avg(c.ffFoes)+'; gap to the farthest avg '+avg(c.ffFarGap)+' m');
console.log('Whiteout Pounce: '+c.wp+' casts, windows spent on a hit '+c.wpSpent+' (the striker was the lowest-HP enemy '+c.wpLow+'), ran out unspent '+c.wpExpired+'; counters '+c.wpCtr+' (critical '+c.ctrCrit+')');
console.log('Winter Plumage: '+c.ult+' casts (first at '+c.firstUlt.slice(0,8).join(', ')+' s ...), ticks '+c.ultTicks+', enemies inside per tick '+hist(c.ultPer)+' (avg '+avg(c.ultPer)+'); freezes '+c.frz+' ('+avg(c.frzPerCast)+' a cast, per cast '+hist(c.frzPerCast)+'), lengths as landed '+JSON.stringify(c.frzLen)+', on an enemy already stunned '+c.frzAlready);
console.log('Silent Altitude: up '+pc(c.saTicks)+' of her time, turned on '+c.saOn+' times, off '+c.saOff+'; runs (s) '+hist(c.saRuns.map(x=>Math.min(20,Math.round(x))))+'; spoiled by a hit '+c.spoilHit+', by a hit her evade took '+c.spoilEvade);
console.log('her hits '+c.hitsBy+', critical '+c.crits+'; basic attacks '+c.autos+' (critical '+c.autoCrit+'); kills '+c.kills+' (with a critical '+c.killCrit+') by '+JSON.stringify(c.killBy));
console.log('hits on her '+c.hitsOn+': basic attacks '+c.autosOn+', melee '+c.meleeOn+', from more than 6 m (body to body) '+c.farOn+'; stunned '+pc(c.stunOn)+', slowed '+pc(c.slowOn));
console.log('crit chance at the start '+JSON.stringify(c.critCh.slice(0,6))+', crit damage '+JSON.stringify(c.critDmg.slice(0,6)));
const L=V.arena(snaps([spec('vaelora',100)]),snaps([spec('vael',100)]),7); const u=L[0];
console.log('body radius: Vaelora '+V.bodyR(u).toFixed(2)+' m; max HP '+Math.round(u.maxHp)+', attack '+Math.round(u.dmg)+', apow '+Math.round(u.apow)+', range '+u.range+', melee '+!!u.melee+', passive '+JSON.stringify(u.pass)+', passMul '+u.passMul+'; green '+JSON.stringify(u.greenAb)+'; blue '+JSON.stringify(u.blueAb)+'; ult '+JSON.stringify(VMX('ULT_DEF.blizzard'))+' art '+JSON.stringify(VMX('HERO_ULT_ART.vaelora'))+'; ccDur(1.2) '+VMX('ccDur(1.2)')+'; METER '+V.METER+', UNIT_SIZE '+VMX('UNIT_SIZE')+'; damage profile '+JSON.stringify(u.t.damageProfile)+', row '+u.t.row);
