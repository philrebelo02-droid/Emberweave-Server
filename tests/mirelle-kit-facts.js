'use strict';
/* Mirelle Velvetplum's real kit, measured (not a test: run with plain node on the cluster test host). What her talents build on: whom Scent of Courage
   reaches and what it writes (the heal, the game's one damage-buff slot), how often a stronger buff already held the slot, what Trail of Splendor's shields
   come from and how big they are, how many of them break and how many run out, whom Soporific Bouquet reaches, how long its sleep really holds and what ends
   it (a hit or its time), what Imperial Plumage touches (allies and enemies, its numbers at skill level 100), and what attacks her.
   Run: node tests/mirelle-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __mk={sc:0,scSelf:0,scNone:0,scHeal:[],scHp:[],scHeld:0,scBuff:[],bq:0,bqArr:0,bqSleep:0,bqResist:0,bqStun:[],bqSlp:[],bqWokeHit:0,bqWokeTime:0,bqAsleep:[],bqHitsOn:0,bqTgtTop:0,ult:0,ultAl:[],ultEn:[],ultSh:[],ultShred:null,spl:0,splSrc:{},splSz:[],splBroke:0,splRan:0,autos:0,autoKind:{},gap:[],hitsOn:0,attackers:{},deaths:0,waves:0,waveT:[],ticks:0,shOn:0};'+
  'var __mD=_doEffectCore, __mU=_updateBattleCore, __mDD=_dealDamageCore, __mG=damage, __mR=resetPerWave;'+
  'var __mm=u=>u&&u.key==="mirelle", __mS=new Map(), __mW=0;'+
  '_doEffectCore=function(u,type,o){ if(__mm(u)&&(!o||!o.deliver||o._arrived)){'+
  '  if(type==="healbuff"){ __mk.sc++; let b=null,bv=2; alliesOf(u).forEach(a=>{ if(!a.alive)return; const f=a.hp/a.maxHp; if(f<bv){bv=f;b=a;} }); if(!b) __mk.scNone++; else { if(b===u) __mk.scSelf++; __mk.scHp.push(+bv.toFixed(2)); if((b.dmgBuffT||0)>0&&(b.dmgBuffMul||1)>=(o.atk||1.25)) __mk.scHeld++; b.__h0=b.hp; } }'+
  '  if(type==="sleepbouquet"){ __mk.bqArr++; const t=o._tgtU; if(t){ let top=true; enemiesOf(u).forEach(e=>{ if(e.alive&&(e.energy||0)>(t.energy||0)) top=false; }); if(top) __mk.bqTgtTop++; t.__s0=t.stunned||0; __mk.__bt=t; } }'+
  '  if(type==="plumage"){ __mk.ult++; __mk.ultAl.push(alliesOf(u).length); __mk.ultEn.push(enemiesOf(u).filter(e=>e.alive).length); if(!__mk.ultShred){ const sm=u._castSM||1; __mk.ultShred=JSON.stringify(Object.assign(skillScaleOpts(Object.assign({},o,{_tgtU:null}),sm,(u._castLv|0)||1),{_sm:sm})); } } }'+
  '  if(__mm(u)&&o&&o.deliver==="shot"&&!o._arrived&&type==="sleepbouquet") __mk.bq++;'+
  '  const r=__mD.apply(this,arguments);'+
  '  if(__mm(u)&&(!o||!o.deliver||o._arrived)){ if(type==="sleepbouquet"&&__mk.__bt){ const t=__mk.__bt; __mk.__bt=null; if((t._sleepT||0)>0&&(t.stunned||0)>t.__s0){ __mk.bqSleep++; __mk.bqStun.push(+(t.stunned).toFixed(3)); __mk.bqSlp.push(+(t._sleepT).toFixed(3)); __mS.set(t,{t0:battleTime,w:__mW}); } else __mk.bqResist++; }'+
  '    if(type==="healbuff"){ alliesOf(u).forEach(a=>{ if(a.__h0!=null){ __mk.scHeal.push(Math.round(a.hp-a.__h0)); __mk.scBuff.push(+(a.dmgBuffMul||1).toFixed(3)); a.__h0=null; a.__shP=a.shield||0; } }); }'+
  '    if(type==="plumage"){ alliesOf(u).forEach(a=>{ __mk.ultSh.push(+((a.shield||0)/a.maxHp).toFixed(3)); a.__shP=a.shield||0; }); } }'+
  '  return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){'+
  '  if(tgt&&__mS.has(tgt)&&(tgt._sleepT||0)>0&&src&&src.team!==tgt.team){ __mk.bqHitsOn++; }'+
  '  if(__mm(src)&&tgt&&tgt.team!==src.team&&_autoAtk){ __mk.autos++; __mk.gap.push(+((dist(src,tgt)-bodyR(src)-bodyR(tgt))/METER).toFixed(1)); __mk.autoKind[kind||"?"]=(__mk.autoKind[kind||"?"]||0)+1; }'+
  '  if(__mm(tgt)&&src&&src.team!==tgt.team){ __mk.hitsOn++; const k=(src.key||"?")+(_autoAtk?":auto":":skill"); __mk.attackers[k]=(__mk.attackers[k]||0)+1; }'+
  '  return __mDD.apply(this,arguments); };'+
  'damage=function(u,a,c,s){ const was=u&&u.alive; const r=__mG.apply(this,arguments); if(was&&__mm(u)&&!u.alive) __mk.deaths++; return r; };'+
  'resetPerWave=function(){ __mW++; __mS.clear(); return __mR.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ const M=units.find(k=>__mm(k)&&k.alive);'+
  '  if(M){ __mk.ticks++; alliesOf(M).forEach(a=>{ a.__sh0=a.shield||0; a.__shT0=a.shieldT||0; a.__bf0=a._buffedT||0; }); }'+
  '  const r=__mU.apply(this,arguments);'+
  '  if(M){ alliesOf(M).forEach(a=>{ if((a.shield||0)>0) __mk.shOn++; if(a.__shP!=null){ __mk.spl++; const g=(a.shield||0)-a.__shP; __mk.splSz.push(+(g/a.maxHp).toFixed(3)); a.__shP=null; }'+
  '      if(a.__sh0>0&&!((a.shield||0)>0)){ if(a.__shT0>dt+1e-6) __mk.splBroke++; else __mk.splRan++; } }); }'+
  '  for(const [t,e] of __mS){ if(!t.alive){ __mS.delete(t); continue; } if(!((t._sleepT||0)>0)){ const d=battleTime-e.t0; __mk.bqAsleep.push(+d.toFixed(2)); if(d<4.9) __mk.bqWokeHit++; else __mk.bqWokeTime++; __mS.delete(t); } }'+
  '  return r; };');
const team=['mirelle','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
const foe=snaps(['ambrel','fritz','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})).filter(s=>{ try{ return !!VMX('HERO_TYPES')[s.key]; }catch(e){ return false; } }));
for(const seed of [5,77,31337,4242]){ NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__mk'), med=a=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?[s[0],s[s.length>>1],s[s.length-1]].join(' / '):'-'; };
console.log('Scent of Courage casts '+c.sc+' (on herself '+c.scSelf+', no target '+c.scNone+'); the target\'s HP share (min/med/max) '+med(c.scHp)+'; HP healed '+med(c.scHeal)+'; damage-buff slot after it '+med(c.scBuff)+'; a buff as strong already in the slot '+c.scHeld);
console.log('Trail of Splendor shields '+c.spl+', size (share of the ally\'s max HP, min/med/max) '+med(c.splSz)+'; ally shields that broke while their time ran '+c.splBroke+', ran out '+c.splRan+'; ally-ticks with a shield '+c.shOn);
console.log('Soporific Bouquet launched '+c.bq+', arrived '+c.bqArr+' (on the highest-energy enemy at arrival '+c.bqTgtTop+'); slept '+c.bqSleep+', resisted or no sleep '+c.bqResist+'; stunned written (min/med/max) '+med(c.bqStun)+' s, _sleepT '+med(c.bqSlp)+' s; enemy hits on a sleeper '+c.bqHitsOn+'; sleep ended by a hit (under 4.9 s) '+c.bqWokeHit+', ran its time '+c.bqWokeTime+'; seconds asleep '+med(c.bqAsleep));
console.log('Imperial Plumage casts '+c.ult+'; allies touched '+med(c.ultAl)+', enemies touched '+med(c.ultEn)+'; ally shield share after it '+med(c.ultSh)+'; options at level 100 '+c.ultShred);
console.log('her basic attacks '+c.autos+' kinds '+JSON.stringify(c.autoKind)+'; gap body to body to the target (min/med/max m) '+med(c.gap)+'; hits on her '+c.hitsOn+' by '+JSON.stringify(c.attackers)+'; deaths '+c.deaths+'; her ticks '+c.ticks);
const L=V.arena(snaps([Object.assign(spec('mirelle',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), g=L[0];
console.log('body radius '+V.bodyR(g).toFixed(2)+' m (Vael '+V.bodyR(L[1]).toFixed(2)+'); attack interval '+g.atkInterval.toFixed(3)+' s; profile '+g.t.damageProfile+'; melee '+g.melee+'; range '+g.range+' ('+(g.range/V.METER).toFixed(2)+' m); pass '+JSON.stringify(g.pass)+'; passMul '+g.passMul+'; maxHp '+Math.round(g.maxHp)+' atk '+Math.round(g.dmg)+' apow '+Math.round(g.apow)+' armor '+g.armorRating+' mr '+g.mrRating+'; greenAb '+JSON.stringify(g.greenAb)+'; blueAb '+JSON.stringify(g.blueAb)+'; ult '+JSON.stringify(VMX('ULT_DEF.plumage'))+' art '+JSON.stringify(VMX('HERO_ULT_ART.mirelle'))+'; skillMul(100) '+VMX('skillMul')(100)+'; METER '+V.METER+'; castTime green '+VMX('castTimeFor')(g,'green')+' blue '+VMX('castTimeFor')(g,'blue')+'; ccCap stunned '+V.cap('stunned')+' _sleepT '+V.cap('_sleepT')+' slow '+V.cap('slow'));
