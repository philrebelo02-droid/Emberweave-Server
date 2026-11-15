'use strict';
/* Nox's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on, with NO talents learned,
   in 20 seeded fights (12 campaign, 8 two-sided), Nox at skill level 100: how often each skill fires and whom it reaches, how much Energy Lockpick Soul and
   Open Every Door steal, whom Forbidden Key gives to, the Skeleton Keys (when he holds 5, how often an ability is Master-Unlocked), Fortune (his crit damage and
   dodge as they grow), the misses Fortune makes, how often enemies are Ripe (70 Energy or more) and press their Ultimate, and how often his allies press theirs.
   Run: node tests/nox-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __nk={fights:0,ticks:0,lp:0,lpMu:0,lpPer:[],lpStole:[],lpTgtE:[],lpRipe:0,lpTgtDist:[],lpSil:[],fk:0,fkMu:0,fkGive:[],fkTgtE:[],fkTop:0,fkStrong:0,oed:0,oedMu:0,oedPool:[],oedHit:[],oedLock:[],press:{green:0,blue:0},'+
  'keys5:0,keyHist:{},mu:0,crit0:[],crit1:[],eva0:[],eva1:[],hitsOn:0,autoOn:0,miss:0,missAuto:0,landed:0,ripeT:0,enemyT:0,ripeIn:0,full:0,eUlt:0,aUlt:0,autos:0,nrgGain:0,nrgSwing:0,waves:0};'+
  'var __nkD=_doEffectCore, __nkH=_dealDamageCore, __nkU=_updateBattleCore, __nkK=castKit, __nkS=noxSpendKeys, __nkC=ccApply, __nkDm=damage, __nkCur=null, __nkN=0, __nkHit=false, __nkPend=new Map(), __nkRipe=new Map(), __nkF=new Map();'+
  'noxSpendKeys=function(u){ const r=__nkS.apply(this,arguments); if(r&&u.key==="nox"){ __nk.mu++; if(__nkCur==="energysteal") __nk.lpMu++; if(__nkCur==="energygift") __nk.fkMu++; if(__nkCur==="openeverydoor") __nk.oedMu++; } return r; };'+
  'castKit=function(u,ab){ if(u&&u.key==="nox") __nk.press[(u.blueAb&&ab===u.blueAb)?"blue":"green"]++; return __nkK.apply(this,arguments); };'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="nox"&&(!o||!o.deliver||o._arrived); let e0=null, a0=null;'+
  '  if(me){ __nkCur=type; __nkN=0; e0=new Map(); for(const x of units) if(x.alive) e0.set(x,x.energy||0);'+
  '    if(type==="energysteal"){ __nk.lp++; const t=(o&&o._tgtU)||null; if(t){ __nk.lpTgtE.push(Math.round(e0.get(t)||0)); if((e0.get(t)||0)>=70) __nk.lpRipe++; __nk.lpTgtDist.push(+(dist(u,t)/METER).toFixed(1)); } }'+
  '    if(type==="energygift"){ __nk.fk++; let top=null,tv=-1,st=null,sv=-1; alliesOf(u).forEach(a=>{ if(a===u) return; if((a.energy||0)>tv){tv=a.energy||0;top=a;} const s=Math.max(a.dmg||0,a.apow||0); if(s>sv){sv=s;st=a;} }); __nk.fkTgtE.push(Math.round(tv)); a0={top,st}; }'+
  '    if(type==="openeverydoor") __nk.oed++; }'+
  '  try{ return __nkD.apply(this,arguments); } finally{ if(me){'+
  '    if(type==="energysteal"){ let s=0; for(const [x,e] of e0) if(x.team!==u.team) s+=Math.max(0,e-(x.energy||0)); __nk.lpStole.push(Math.round(s)); __nk.lpPer.push(__nkN); }'+
  '    if(type==="energygift"&&a0&&a0.top){ __nk.fkGive.push(Math.round((a0.top.energy||0)-(e0.get(a0.top)||0))); __nk.fkTop++; if(a0.st===a0.top) __nk.fkStrong++; }'+
  '    if(type==="openeverydoor"){ let s=0; for(const [x,e] of e0) if(x.team!==u.team) s+=Math.max(0,e-(x.energy||0)); __nk.oedPool.push(Math.round(s)); __nk.oedHit.push(__nkN); }'+
  '    __nkCur=null; } } };'+
  'ccApply=function(u,t,field,dur){ const r=__nkC.apply(this,arguments); if(r&&u&&u.key==="nox"){ if(__nkCur==="energysteal"&&field==="silencedT") __nk.lpSil.push(+t.silencedT.toFixed(3)); if(__nkCur==="openeverydoor"&&field==="stunned") __nk.oedLock.push(+t.stunned.toFixed(3)); } return r; };'+
  'damage=function(u,a){ __nkHit=true; return __nkDm.apply(this,arguments); };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="nox"&&src&&src.team!==tgt.team, auto=!!_autoAtk;'+
  '  if(src&&src.key==="nox"&&tgt&&tgt.team!==src.team){ if(_autoAtk) __nk.autos++; else if(__nkCur) __nkN++; }'+
  '  if(me){ __nk.hitsOn++; if(auto) __nk.autoOn++; } const f0=floatTexts.length; __nkHit=false; const r=__nkH.apply(this,arguments);'+
  '  if(me){ if(__nkHit) __nk.landed++; else { const ft=floatTexts.slice(f0).map(f=>f.txt); if(ft.indexOf("MISS")>=0){ __nk.miss++; if(auto) __nk.missAuto++; } } } return r; };'+
  '_updateBattleCore=function(dt){ const N=units.filter(u=>u&&u.key==="nox"&&u.alive), e0=N.map(u=>u.energy||0);'+
  '  for(const u of N){ __nk.ticks++; const k=u._keys||0; __nk.keyHist[k]=(__nk.keyHist[k]||0)+1; if(k>=5) __nk.keys5++; if(!__nkF.has(u)){ __nkF.set(u,1); __nk.crit0.push(u.critDmg||0.6); __nk.eva0.push(u.evaStat||0); } __nk.lastC=u.critDmg||0.6; __nk.lastE=u.evaStat||0;'+
  '    for(const e of units){ if(!e.alive||e.team===u.team) continue; __nk.enemyT++; const ri=(e.energy||0)>=70; if(ri) __nk.ripeT++; if((e.energy||0)>=100) __nk.full++; const w=__nkRipe.get(e); if(ri&&!w) __nk.ripeIn++; __nkRipe.set(e,ri); } }'+
  '  const r=__nkU.apply(this,arguments);'+
  '  for(const x of units){ if(!x||!N.length) continue; const p=x._pend||null, was=__nkPend.get(x); if(p&&p!==was&&!p.spell){ if(x.team===N[0].team) __nk.aUlt++; else __nk.eUlt++; } __nkPend.set(x,p); }'+
  '  N.forEach((u,i)=>{ if(u.alive&&(u.energy||0)>e0[i]) __nk.nrgGain+=(u.energy||0)-e0[i]; });'+
  '  return r; };');
const team=['nox','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
const fin=()=>VMX('if(__nk.lastC!=null){ __nk.crit1.push(+__nk.lastC.toFixed(3)); __nk.eva1.push(+__nk.lastE.toFixed(3)); } __nk.lastC=null; __nkF=new Map();');
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__nk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); fin(); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__nk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); fin(); VMX('__nk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); fin(); }
const c=VMX('__nk'), step=VMX('SIM_STEP'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); },
  q=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?(+s[Math.min(s.length-1,Math.floor(p*s.length))]).toFixed(2):'-'; };
console.log('fights '+c.fights+'; Nox alive '+(c.ticks*step).toFixed(0)+' s in all; presses green '+c.press.green+', blue '+c.press.blue+'; his basic attacks '+c.autos+'; energy he gained '+Math.round(c.nrgGain)+' ('+(c.nrgGain/Math.max(1,c.ticks*step)).toFixed(2)+' a second)');
console.log('Lockpick Soul: '+c.lp+' casts ('+c.lpMu+' Master-Unlocked), hits per cast '+hist(c.lpPer)+'; Energy stolen a cast mean '+avg(c.lpStole)+' '+hist(c.lpStole)+'; the hooked enemy\'s Energy at the hook: mean '+avg(c.lpTgtE)+', median '+q(c.lpTgtE,0.5)+', Ripe (70+) '+c.lpRipe+'; its distance median '+q(c.lpTgtDist,0.5)+' m, max '+q(c.lpTgtDist,1)+' m; Master-Unlocked silences as landed '+hist(c.lpSil));
console.log('Forbidden Key: '+c.fk+' casts ('+c.fkMu+' Master-Unlocked); the receiver = the ally with the most Energy: its Energy before mean '+avg(c.fkTgtE)+'; Energy given '+hist(c.fkGive)+'; receiver was also the ally with the highest attack / ability power '+c.fkStrong+' of '+c.fkTop);
console.log('Open Every Door: '+c.oed+' casts ('+c.oedMu+' Master-Unlocked), enemies struck '+hist(c.oedHit)+', Energy stolen in all a cast mean '+avg(c.oedPool)+'; locks (stun) as landed '+hist(c.oedLock));
console.log('Skeleton Keys: Master-Unlocks '+c.mu+'; his time at each key count '+JSON.stringify(Object.fromEntries(Object.entries(c.keyHist).map(([k,v])=>[k,(v*step).toFixed(0)+' s'])))+'; holding 5 keys '+(100*c.keys5/Math.max(1,c.ticks)).toFixed(1)+'% of his time');
console.log('Fortune: crit damage at the start of a fight '+hist(c.crit0)+', at the end '+hist(c.crit1)+'; dodge (evaStat) at the start '+hist(c.eva0)+', at the end '+hist(c.eva1));
console.log('hits aimed at him '+c.hitsOn+' (basic '+c.autoOn+'): landed '+c.landed+', Evasion misses (Fortune) '+c.miss+' ('+c.missAuto+' basic)');
console.log('enemies: Ripe (70+ Energy) '+(100*c.ripeT/Math.max(1,c.enemyT)).toFixed(1)+'% of enemy-time, at 100 '+(100*c.full/Math.max(1,c.enemyT)).toFixed(2)+'%, became Ripe '+c.ripeIn+' times; Ultimate presses: enemies '+c.eUlt+', his allies '+c.aUlt);
const L=V.arena(snaps([Object.assign(spec('nox',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7);
console.log('Nox: body radius '+V.bodyR(L[0]).toFixed(2)+' m, attack interval '+L[0].atkInterval.toFixed(3)+' s, max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', apow '+Math.round(L[0].apow)+', crit damage '+L[0].critDmg+', dodge '+L[0].evaStat+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passMul '+L[0].passMul+'; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb));
