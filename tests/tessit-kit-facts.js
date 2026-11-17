'use strict';
/* Tessit's real kit, measured (not a test: run with plain node on the cluster). What her talents build on: how often each skill fires and what it reaches -
   whom Sleight of Hours robs (the shot's target: the fastest enemy) and whom it gives to (the fastest ally: herself?), what Accelerate buffs, how many enemies
   Hourglass strikes and stuns and for how long, how often Unwind cleanses and what it lifts (and from whom), the kind of her basic attacks and of Hourglass's
   hit, and the hits on her. No talents learned. 20 seeded fights: 12 campaign, 8 two-sided.
   Run: node tests/tessit-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __tk={fights:0,ticks:0,press:{green:0,blue:0},acc:0,accAllies:0,ss:0,ssFastest:0,ssTgtWasTarget:0,ssSelf:0,ssNone:0,hg:0,hgIn:0,hgStun:0,hgStunSecs:[],hgNone:0,hgRad:0,'+
  ' uw:0,uwSelf:0,uwLift:{dot:0,stun:0,silence:0,slow:0,mortal:0,unknown:0},uwHurtAllies:[],autoKinds:{},hgKinds:{},hitsOn:0,meleeOn:0,autos:0,'+
  ' enemyHaste:[],allyPickSpeed:[]};'+
  'var __tkD=_doEffectCore, __tkU=_updateBattleCore, __tkK=castKit, __tkDD=_dealDamageCore, __tkC=ccApply, __tkHg=null;'+
  'castKit=function(u,ab){ if(u&&u.key==="tessit"){ const s=(u.blueAb&&ab===u.blueAb)?"blue":"green"; __tk.press[s]++; } return __tkK.apply(this,arguments); };'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="tessit";'+
  '  if(me&&type==="spdsteal"&&o&&o._arrived){ __tk.ss++; const v=(o._tgtU&&o._tgtU.alive)?o._tgtU:null; if(!v) __tk.ssNone++;'+
  '    const F=enemiesOf(u).filter(e=>e.alive); let best=null,bs=-1; F.forEach(e=>{ const sp=(1/Math.max(0.05,e.atkInterval||1))*(e.hasteMul||1); if(sp>bs){bs=sp;best=e;} }); if(v&&v===best) __tk.ssFastest++; if(v&&v===u.target) __tk.ssTgtWasTarget++;'+
  '    let ally=null,as=-1; alliesOf(u).forEach(a=>{ if(a.alive){ const s=(a.atkSpeed||1)*(a.hasteMul||1); if(s>as){as=s;ally=a;} } }); if(ally===u) __tk.ssSelf++; __tk.allyPickSpeed.push(ally?ally.key:"-"); }'+
  '  if(me&&type==="dmgbuff"){ __tk.acc++; __tk.accAllies+=alliesOf(u).length; }'+
  '  if(me&&type==="aoeStun"&&o&&(!o.deliver||o._arrived)){ __tk.hg++; __tkHg={n:0,st:0,u}; }'+
  '  const r=__tkD.apply(this,arguments);'+
  '  if(me&&type==="aoeStun"&&__tkHg){ if(!__tkHg.n) __tk.hgNone++; __tk.hgIn+=__tkHg.n; __tk.hgStun+=__tkHg.st; __tk.hgRad=(o.radius||110)/METER; __tkHg=null; }'+
  '  return r; };'+
  'ccApply=function(u,t,field,dur){ const r=__tkC.apply(this,arguments); if(__tkHg&&u===__tkHg.u&&field==="stunned"){ if(r){ __tkHg.st++; __tk.hgStunSecs.push(t.stunned); } } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(tgt&&tgt.key==="tessit"&&src&&src.team!==tgt.team){ __tk.hitsOn++; if(src.melee) __tk.meleeOn++; }'+
  '  if(src&&src.key==="tessit"&&tgt&&tgt.team!==src.team){ const k=kind||((src.t&&["Magic","Healer"].includes(src.t.damageProfile))?"magic":"phys"); if(__tkHg){ __tkHg.n++; __tk.hgKinds[k]=(__tk.hgKinds[k]||0)+1; } else if(_autoAtk){ __tk.autos++; __tk.autoKinds[k]=(__tk.autoKinds[k]||0)+1; } }'+
  '  return __tkDD.apply(this,arguments); };'+
  'var __tkSeen=new Set();'+
  '_updateBattleCore=function(dt){ const T=units.filter(u=>u.alive&&u.key==="tessit"); const pre=new Map();'+
  '  for(const t of T) for(const a of units) if(a.alive&&a.team===t.team) pre.set(a,{d:(a.dots||[]).length,st:a.stunned||0,si:a.silencedT||0,sl:a.slow||0,mo:a.mortalT||0});'+
  '  for(const t of T){ __tk.uwHurtAllies.push(units.filter(a=>a.alive&&a.team===t.team&&((a.dots&&a.dots.length)||a.stunned>0||a.slow>0||a.silencedT>0||a.mortalT>0)).length); }'+
  '  const r=__tkU.apply(this,arguments);'+
  '  for(const t of T){ if(t.alive) __tk.ticks++; }'+
  '  for(const f of floatTexts){ if(__tkSeen.has(f)) continue; __tkSeen.add(f); if(f.txt!=="UNWIND") continue; let a=null,bd=1e9; for(const x of units){ if(!x.alive) continue; const d=Math.hypot(x.x-f.x,x.y-8-f.y); if(d<bd){bd=d;a=x;} }'+
  '    __tk.uw++; if(a&&a.key==="tessit") __tk.uwSelf++; const p=a&&pre.get(a); if(!p){ __tk.uwLift.unknown++; continue; }'+
  '    if((a.dots||[]).length<p.d) __tk.uwLift.dot++; else if(p.st>0&&!(a.stunned>0)) __tk.uwLift.stun++; else if(p.si>0&&!(a.silencedT>0)) __tk.uwLift.silence++; else if(p.sl>0&&!(a.slow>0)) __tk.uwLift.slow++; else if(p.mo>0&&!(a.mortalT>0)) __tk.uwLift.mortal++; else __tk.uwLift.unknown++; }'+
  '  if(floatTexts.length>4000) __tkSeen.clear();'+
  '  return r; };');
const team=['tessit','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__tk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__tk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__tk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__tk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', mx=a=>a.length?Math.max(...a).toFixed(2):'-';
const alive=c.ticks*V.STEP;
console.log('fights '+c.fights+'; Tessit alive '+alive.toFixed(0)+' s in all');
console.log('presses: green (Accelerate) '+c.press.green+', blue (Sleight of Hours) '+c.press.blue);
console.log('Accelerate: '+c.acc+' casts, allies buffed '+(c.accAllies/Math.max(1,c.acc)).toFixed(2)+' a cast (her included)');
console.log('Sleight of Hours: '+c.ss+' arrivals; on a living target '+(c.ss-c.ssNone)+'; the target was the fastest enemy '+c.ssFastest+'; the target was her own current target '+c.ssTgtWasTarget+'; the ally given to was Tessit herself '+c.ssSelf+'; allies given to: '+JSON.stringify(c.allyPickSpeed.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{})));
console.log('Hourglass: '+c.hg+' casts, radius '+c.hgRad.toFixed(2)+' m (centre to centre); enemies struck '+(c.hgIn/Math.max(1,c.hg)).toFixed(2)+' a cast; stuns that landed '+(c.hgStun/Math.max(1,c.hg)).toFixed(2)+' a cast; casts striking nobody '+c.hgNone+'; stun seconds as landed: mean '+avg(c.hgStunSecs)+' max '+mx(c.hgStunSecs)+'; kinds '+JSON.stringify(c.hgKinds));
console.log('Unwind: '+c.uw+' cleanses ('+(c.uw/Math.max(1,alive)).toFixed(3)+' a second of Tessit alive), on herself '+c.uwSelf+'; what it lifted '+JSON.stringify(c.uwLift)+'; allies (her included) with a negative effect at a tick: mean '+avg(c.uwHurtAllies));
console.log('her basic attacks: '+c.autos+', kinds '+JSON.stringify(c.autoKinds)+'; hits on her '+c.hitsOn+' (melee '+c.meleeOn+')');
const L=V.arena(snaps([spec('tessit',100)]),snaps([spec('vael',100)]),7), o=L[0];
console.log('body radius: Tessit '+V.bodyR(o).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+o.atkInterval.toFixed(3)+' s; atkSpeed '+o.atkSpeed+'; range '+(o.range/V.METER).toFixed(2)+' m; max HP '+Math.round(o.maxHp)+', ability power '+Math.round(o.apow)+', attack '+Math.round(o.dmg)+'; damage profile '+o.t.damageProfile+'; role '+o.t.role+'; passive '+JSON.stringify(o.pass)+'; Unwind interval at passive level 100 '+VMX('SKLV.unwind(100)').toFixed(3)+' s');
console.log('kit: '+JSON.stringify(VMX('KITS.tessit'))+'; ult '+JSON.stringify(Object.assign({},VMX('ULT_DEF.aoeStun'),VMX('HERO_ULT_ART.tessit')))+'; ccDur(2) '+VMX('ccDur(2)')+'; stun cap '+VMX('CC_DUR_MAX.stunned')+'; skLvNum spdsteal at 100 '+VMX('skLvNum("spdsteal",KITS.tessit.blue,100)')+', dmgbuff at 100 '+VMX('skLvNum("dmgbuff",KITS.tessit.green,100)')+'; ult card: '+VMX('HERO_ULT_DESC.tessit'));
