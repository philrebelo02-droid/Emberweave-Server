'use strict';
/* Zahri Sunhorn's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on, in seeded
   fights with NO talents learned: Solar Impalement (casts, whom it struck and how far, the armour cut and how long it lasts), Mirage Herd (casts, refusals at the
   cap, the mirage's share of her stats, how long each one lives, how it dies, its hits and the hits on it), Desert Momentum (how fast it fills, whether it ever
   drops - between waves too), Noonday Stampede (casts, how far she runs, whom it strikes, the stun it writes and whether that enemy was already stunned), how far
   she travels (Hoofbeats are banked from it), her basic attacks, her kills, the hits she takes, enemies that stood still 2 s when she struck them, and enemies with
   more max HP than her. Run: node tests/zahri-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __zk={fights:0,ticks:0,move:0,moveTicks:0,dmCapT:[],dmWave:[],dmDrop:0,g:0,gGap:[],gShred:[],gShT:[],gNoTgt:0,gTgtNear:0,b:0,bMade:0,bRefused:0,share:[],mHp:[],mLife:[],mDie:{killed:0,owner:0,wave:0},mAlive:0,mHits:0,mAutos:0,mCrit2:0,onM:0,onMauto:0,onMskill:0,u:0,uLen:[],uFull:0,uHit:[],uStun:[],uPre:0,uStunN:0,autos:0,crits:0,hitsOn:0,hitsOnAuto:0,kills:{auto:0,green:0,ult:0,other:0},still2:0,bigger:0,mine:0,fightT:0,waves:0,ultEnd:[]};'+
  'var __zD=_doEffectCore, __zU=_updateBattleCore, __zDD=_dealDamageCore, __zIn=0, __zCur=null, __zMire=[], __zPos=new Map();'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="zahri"&&(!o||!o.deliver||o._arrived); if(!me) return __zD.apply(this,arguments);'+
  '  const pre=u.target, ml=livingSummonsOf(u,"zahri mirage"); __zIn++; __zCur=type; let r; try{ r=__zD.apply(this,arguments); } finally{ __zIn--; __zCur=null; }'+
  '  if(type==="shred"){ __zk.g++; if(!pre){ __zk.gNoTgt++; } else { __zk.gGap.push(+((dist(u,pre)-bodyR(u)-bodyR(pre))/METER).toFixed(2)); __zk.gShred.push(+(pre._shredPct||0).toFixed(3)); __zk.gShT.push(+(pre._shredT||0).toFixed(2)); const ne=nearestEnemy(u); if(ne===pre) __zk.gTgtNear++; } }'+
  '  if(type==="summonmirage"){ __zk.b++; const m=units.find(x=>x.alive&&x._summonOwner===u&&x.key==="zahri mirage"&&!__zMire.some(y=>y.m===x)); if(m){ __zk.bMade++; __zk.share.push(+(m.dmg/Math.max(1,u.dmg)).toFixed(3)); __zk.mHp.push(+(m.maxHp/Math.max(1,u.maxHp)).toFixed(3)); __zMire.push({m,t0:__zk.fightT}); } else __zk.bRefused++; }'+
  '  if(type==="stampede"){ __zk.u++; __zk.uLen.push(+((u._stampLen||0)/METER).toFixed(1)); if(Math.abs((u._stampLen||0)-20*METER)<2*METER) __zk.uFull++; u.__zStamp=1; }'+
  '  return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const auto=_autoAtk; const mine=src&&src.key==="zahri"&&tgt&&tgt.team!==src.team; const mir=src&&src.key==="zahri mirage"&&tgt&&tgt.team!==src.team;'+
  '  const onMe=tgt&&tgt.key==="zahri"&&src&&src.team!==tgt.team, onMi=tgt&&tgt.key==="zahri mirage"&&src&&src.team!==tgt.team; const hp0=tgt?tgt.hp:0, st0=tgt?(tgt.stunned||0):0;'+
  '  if(mine){ __zk.mine++; if(auto) __zk.autos++; const p=__zPos.get(tgt); if(p&&p.still>=2) __zk.still2++; if(tgt.maxHp>src.maxHp) __zk.bigger++; }'+
  '  if(onMe){ __zk.hitsOn++; if(auto) __zk.hitsOnAuto++; } if(onMi){ __zk.onM++; if(auto) __zk.onMauto++; else __zk.onMskill++; }'+
  '  const r=__zDD.apply(this,arguments);'+
  '  if(mir){ __zk.mHits++; if(auto) __zk.mAutos++; }'+
  '  if(mine&&hp0>0&&!tgt.alive){ const k=auto?"auto":(__zCur==="shred"?"green":((src._stampT||0)>0?"ult":"other")); __zk.kills[k]++; }'+
  '  if(mine&&(src._stampT||0)>0&&!__zIn){ __zk.uStun.push(+(tgt.stunned||0).toFixed(3)); if(st0>0) __zk.uPre++; __zk.uStunN++; }'+
  '  return r; };'+
  '_updateBattleCore=function(dt){ const Z=units.filter(u=>u&&u.key==="zahri"&&u.alive); __zk.fightT+=dt;'+
  '  for(const e of units){ if(!e||!e.alive) continue; const p=__zPos.get(e)||{x:e.x,y:e.y,still:0}; if(Math.hypot(e.x-p.x,e.y-p.y)<1e-6) p.still+=dt; else p.still=0; p.x=e.x; p.y=e.y; __zPos.set(e,p); }'+
  '  for(const u of Z){ __zk.ticks++; const pv=u.__zP||{x:u.x,y:u.y}, mv=Math.hypot(u.x-pv.x,u.y-pv.y); if(mv<8*METER){ __zk.move+=mv/METER; if(mv>0) __zk.moveTicks++; } u.__zP={x:u.x,y:u.y};'+
  '    const cap=0.5*(u.passMul||1); if(!u.__zCap&&(u._dmAS||0)>=cap-1e-9){ u.__zCap=1; __zk.dmCapT.push(+__zk.fightT.toFixed(1)); } if((u.__zAS||0)>(u._dmAS||0)+1e-9) __zk.dmDrop++; u.__zAS=u._dmAS||0;'+
  '    if(u.__zStamp&&!((u._stampT||0)>0)){ u.__zStamp=0; __zk.uHit.push((u._stampHit&&u._stampHit.size)||0); } }'+
  '  for(const x of __zMire){ if(x.done) continue; if(x.m.alive) __zk.mAlive+=dt; else { x.done=1; __zk.mLife.push(+(__zk.fightT-x.t0).toFixed(1)); } }'+
  '  return __zU.apply(this,arguments); };'+
  'var __zR=resetPerWave; resetPerWave=function(){ __zk.waves++; for(const u of units) if(u&&u.key==="zahri"&&u.alive) __zk.dmWave.push(+(u._dmAS||0).toFixed(3)); return __zR.apply(this,arguments); };'+
  'var __zKs=killSummon; killSummon=function(p){ if(p&&p.key==="zahri mirage"&&p.alive){ const o=p._summonOwner; if(!o||!o.alive) __zk.mDie.owner++; } return __zKs.apply(this,arguments); };');
const team=['zahri','vael','sylthaine','vireo','vex'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90,120]) for(const seed of [7,1000007,987654]){ VMX('__zk.fights++; __zMire.length=0; __zPos.clear()'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337]){ VMX('__zk.fights++; __zMire.length=0; __zPos.clear()'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__zk.fights++; __zMire.length=0; __zPos.clear()'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__zk'), step=VMX('SIM_STEP');
const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', med=a=>{ if(!a.length) return '-'; const s=a.slice().sort((x,y)=>x-y); return (+s[s.length>>1]).toFixed(2); }, hist=a=>{ const h={}; for(const x of a){ const k=String(x); h[k]=(h[k]||0)+1; } return JSON.stringify(h); }, mx=a=>a.length?Math.max.apply(null,a).toFixed(2):'-';
const alive=c.ticks*step;
console.log('fights '+c.fights+', waves ended '+c.waves+'; Zahri alive '+alive.toFixed(0)+' s; travelled '+c.move.toFixed(0)+' m ('+(c.move/Math.max(1,alive)).toFixed(2)+' m a second alive; moving on '+(100*c.moveTicks/Math.max(1,c.ticks)).toFixed(0)+'% of ticks) = '+Math.floor(c.move/5)+' Hoofbeats at 1 per 5 m');
console.log('her hits '+c.mine+' (basic attacks '+c.autos+'); on enemies that had stood still 2 s+ '+c.still2+'; on enemies with more max HP than her '+c.bigger+'; kills '+JSON.stringify(c.kills)+'; hits on her '+c.hitsOn+' (basic attacks '+c.hitsOnAuto+')');
console.log('Desert Momentum: at its cap after (s of fight time from the first fight start, a list) '+JSON.stringify(c.dmCapT.slice(0,12))+'; times it dropped on a tick '+c.dmDrop+'; at each wave end '+hist(c.dmWave));
console.log('Solar Impalement: '+c.g+' casts, no target '+c.gNoTgt+', the target was the nearest enemy '+c.gTgtNear+'; gap to it (m, body to body) median '+med(c.gGap)+', max '+mx(c.gGap)+'; armour cut '+hist(c.gShred)+'; lasting '+hist(c.gShT)+' s');
console.log('Mirage Herd: '+c.b+' casts, made '+c.bMade+', refused (cap) '+c.bRefused+'; attack share '+hist(c.share)+', HP share '+hist(c.mHp)+'; lifetimes (s) median '+med(c.mLife)+' max '+mx(c.mLife)+' n '+c.mLife.length+'; gone with her '+c.mDie.owner+'; mirage-seconds alive '+c.mAlive.toFixed(0)+' ('+(100*c.mAlive/Math.max(1,c.fightT)).toFixed(0)+'% of fight time)');
console.log('  the mirage\'s hits '+c.mHits+' (basic attacks '+c.mAutos+'); hits on it '+c.onM+' (basic '+c.onMauto+', skills '+c.onMskill+')');
console.log('Noonday Stampede: '+c.u+' casts; run length (m) '+hist(c.uLen)+'; the full 20 m '+c.uFull+'; enemies struck a cast '+hist(c.uHit)+'; stun as written after the hit (s) '+hist(c.uStun)+'; struck while already stunned '+c.uPre+' of '+c.uStunN);
/* the still field: the green, the blue, the ult on known places */
{ const L=V.arena(snaps([Object.assign(spec('zahri',100),{skillLv:[100,100,100,100]})]),snaps([0,1,2,3].map(()=>spec('vael',100))),7), z=L[0], F=L.filter(u=>u.team==='enemy');
  for(const u of L){ u.stunned=1e6; u.maxHp=u.hp=1e9; u.level=1; u.ctrlRes=0; } z.x=300; z.y=700; [[3,0],[8,0],[14,0],[30,6]].forEach((p,i)=>{ F[i].x=z.x+p[0]*V.METER; F[i].y=z.y+p[1]*V.METER; F[i].stunned=0; F[i].speed=0; F[i].atkCd=1e9; });
  z.target=F[0]; const a0=F[0].armorRating; V.cast(z,'green'); console.log('still field green: target F0 cut '+F[0]._shredPct+' for '+F[0]._shredT+' s; its armour rating '+a0);
  z.stunned=0; V.cast(z,'blue'); const m=L.concat(VMX('units')).find(x=>x.key==='zahri mirage'); console.log('blue: mirage '+(m?('hp '+Math.round(m.maxHp)+' of '+Math.round(z.maxHp)+', atk '+Math.round(m.dmg)+' of '+Math.round(z.dmg)+', crit '+m.glyphCrit+', armour '+m.armorRating+', pass '+JSON.stringify(m.pass||null)+', melee '+m.melee+', range '+(m.range/V.METER).toFixed(2)+' m, speed '+m.speed):'none'));
  VMX('(function(u){ u._castSlot="ult"; u._castLv=100; u._castSM=skillMul(100); try{ doEffect(u,"stampede",Object.assign({},ULT_DEF.stampede)); } finally{ u._castSM=1; u._castLv=0; } })')(z);
  console.log('ult: run '+((z._stampLen||0)/V.METER).toFixed(2)+' m in '+(z._stampT||0).toFixed(3)+' s, stun option '+z._stampStun+', damage '+Math.round(z._stampDmg||0)+' (attack '+Math.round(z.dmg)+')');
  let t=0; while((z._stampT||0)>0&&t<3){ V.step(1); t+=V.STEP; } console.log('  after the run: struck '+((z._stampHit&&z._stampHit.size)||0)+'; stunned '+F.map(f=>+(f.stunned||0).toFixed(3)).join(', ')+'; she stands at '+((z.x-300)/V.METER).toFixed(1)+' m'); }
const L=V.arena(snaps([Object.assign(spec('zahri',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), k=L[0];
console.log('Zahri: body radius '+V.bodyR(k).toFixed(2)+' m; attack interval '+k.atkInterval.toFixed(3)+' s; crit '+(k.glyphCrit||0)+' / pass '+JSON.stringify(k.pass)+' x'+k.passMul+'; max HP '+Math.round(k.maxHp)+', atk '+Math.round(k.dmg)+', armour '+k.armorRating+', range '+(k.range/V.METER).toFixed(2)+' m; melee '+k.melee+'; speed '+k.speed+'; armorPen '+k.armorPen+'; green '+JSON.stringify(k.greenAb)+'; blue '+JSON.stringify(k.blueAb)+'; ult '+JSON.stringify(VMX('Object.assign({},ULT_DEF.stampede,(typeof HERO_ULT_ART!=="undefined"&&HERO_ULT_ART.zahri)||{})')));
console.log('skill options as cast (level 100): green '+JSON.stringify(VMX('skillScaleOpts(KITS.zahri.green,skillMul(100),100)'))+'; ult '+JSON.stringify(VMX('skillScaleOpts(ULT_DEF.stampede,skillMul(100),100)'))+'; mirage share at 100 '+VMX('skLvNum("summonmirage",KITS.zahri.blue,100)')+'; ccDur(1) '+VMX('ccDur(1)')+'; caps '+JSON.stringify(VMX('CC_DUR_MAX'))+'; SHRED_CAP '+VMX('SHRED_CAP'));
