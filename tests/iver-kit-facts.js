'use strict';
/* Iver's real kit, measured (not a test: run with plain node on the cluster through tools/remote_test.sh). What his talents build on, with NO talents learned:
   how often each of his skills fires and what it reaches in 20 seeded fights (12 campaign, 8 two-sided), Static Charge's discharges and their chain,
   Thunder Guard's retaliation, Skybreak's stun as it lands. Run: node tests/iver-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __ik={fights:0,ticks:0,vp:0,vpHit:0,vpPer:[],vpNone:0,tg:0,tgHitsOn:0,ret:0,sb:0,sbHit:0,sbPer:[],sbNone:0,sbStun:[],sbStunN:0,dis:0,disSlot:{green:0,blue:0},chainHit:0,chainPer:[],chainDmg:[],chainK:[],ready:0,readyT:0,swings:0,hitsOn:0,autoOn:0,abilOn:0,sbDist:[]};'+
  'var __ikD=_doEffectCore, __ikH=_dealDamageCore, __ikU=_updateBattleCore, __ikK=castKit, __ikC=ccApply, __ikCur=null, __ikN=0, __ikDis=null;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="iver"&&(!o||!o.deliver||o._arrived); if(me){ __ikCur=type; __ikN=0; if(type==="piercethrow") __ik.vp++; if(type==="thornguard") __ik.tg++; if(type==="aoeStun"){ __ik.sb++; const c=(o&&o._aim)||u.target; if(c){ let nd=1e9; enemiesOf(u).forEach(e=>{ if(e.alive){ const d=Math.hypot(e.x-c.x,e.y-c.y)/METER; if(d<nd) nd=d; } }); __ik.sbDist.push(nd); } } }'+
  '  try{ return __ikD.apply(this,arguments); } finally{ if(me){ if(type==="piercethrow"){ __ik.vpPer.push(__ikN); if(!__ikN) __ik.vpNone++; } if(type==="aoeStun"){ __ik.sbPer.push(__ikN); if(!__ikN) __ik.sbNone++; } __ikCur=null; } } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){'+
  '  if(src&&src.key==="iver"&&tgt&&tgt.team!==src.team){ if(__ikDis&&color==="#8fd0ff"&&kind==="magic"){ __ikDis.n++; __ik.chainHit++; __ik.chainDmg.push(amt); __ik.chainK.push(amt/Math.max(1,src.dmg)); }'+
  '    else if(src._ctring&&color==="#8fd0ff") __ik.ret++; else if(__ikCur==="piercethrow"){ __ik.vpHit++; __ikN++; } else if(__ikCur==="aoeStun"){ __ik.sbHit++; __ikN++; } }'+
  '  if(tgt&&tgt.key==="iver"&&src&&src.team!==tgt.team){ __ik.hitsOn++; if(_autoAtk) __ik.autoOn++; else __ik.abilOn++; if((tgt._thornT||0)>0) __ik.tgHitsOn++; }'+
  '  return __ikH.apply(this,arguments); };'+
  'castKit=function(u,ab){ if(u&&u.key==="iver"&&u.pass&&u.pass.staticcharge&&u._scReady){ __ik.dis++; __ik.disSlot[(u.blueAb&&ab===u.blueAb)?"blue":"green"]++; __ikDis={n:0}; }'+
  '  try{ return __ikK.apply(this,arguments); } finally{ if(__ikDis){ __ik.chainPer.push(__ikDis.n); __ikDis=null; } } };'+
  'ccApply=function(u,t,field,dur){ const r=__ikC.apply(this,arguments); if(u&&u.key==="iver"&&field==="stunned"&&__ikCur==="aoeStun"&&r){ __ik.sbStunN++; __ik.sbStun.push(t.stunned); } return r; };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="iver"&&u.alive){ __ik.ticks++; if(u._scReady) __ik.readyT++; } } return __ikU.apply(this,arguments); };');
const team=['iver','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__ik.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__ik.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__ik.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__ik'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, q=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?s[Math.min(s.length-1,Math.floor(p*s.length))].toFixed(2):'-'; };
console.log('fights '+c.fights+'; Iver alive '+(c.ticks/30).toFixed(0)+' s in all; Charge ready (5) '+(100*c.readyT/Math.max(1,c.ticks)).toFixed(1)+'% of his time');
console.log('Volt Pike: '+c.vp+' casts, '+c.vpHit+' hits, per cast '+avg(c.vpPer)+' '+hist(c.vpPer)+', casts hitting nobody '+c.vpNone);
console.log('Thunder Guard: '+c.tg+' casts; hits on him while it was up '+c.tgHitsOn+' (of '+c.hitsOn+' hits on him: basic attacks '+c.autoOn+', abilities '+c.abilOn+'); retaliations '+c.ret);
console.log('Skybreak: '+c.sb+' casts, '+c.sbHit+' hits, per cast '+avg(c.sbPer)+' '+hist(c.sbPer)+', casts hitting nobody '+c.sbNone+'; nearest enemy to its centre (m, centre to centre) median '+q(c.sbDist,0.5)+'; stuns landed '+c.sbStunN+', length as written '+q(c.sbStun,0)+' .. '+q(c.sbStun,1)+' s');
console.log('Static Charge: '+c.dis+' discharges (pressed green '+c.disSlot.green+', blue '+c.disSlot.blue+'), chain hits '+c.chainHit+', per discharge '+avg(c.chainPer)+' '+hist(c.chainPer)+'; a chain hit as dealt (before armor) median '+q(c.chainDmg,0.5)+' = '+q(c.chainK,0.5)+' x his Attack');
const L=V.arena(snaps([Object.assign(spec('iver',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7);
console.log('Iver: body radius '+V.bodyR(L[0]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', Attack '+Math.round(L[0].dmg)+', ability power '+Math.round(L[0].apow||0)+', passMul '+(L[0].passMul||1).toFixed(3)+', armor '+Math.round(L[0].armorRating||0)+', melee '+!!L[0].melee+'; passive '+JSON.stringify(L[0].pass)+'; Volt Pike half-width '+((L[0].greenAb.width||0)/V.METER).toFixed(2)+' m; Skybreak radius '+(VMX('ULT_DEF.aoeStun.radius')/V.METER).toFixed(2)+' m');
