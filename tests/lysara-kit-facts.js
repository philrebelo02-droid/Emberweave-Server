'use strict';
/* Lysara's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how often each
   of her skills fires and what it reaches in seeded fights with NO talents learned -
   - Queen of Quiet Wings: casts, enemies on the field, enemies put to sleep (stunned rose), resisted; how long each sleep really held (until the stun field ran
     out, a hit woke it, or the enemy died), who woke it (Lysara herself, another unit), how long _sleepT (the uncut 5 s) kept casts cancelled after the stun ended;
   - Dreamthread: casts, links made, links that included Lysara herself, healing that travelled along a link (the game's 35%), shields shared (none expected);
   - Moon Cocoon: casts, allies shielded per cast, Cocoon shields that ran out of time unbroken / broke before their time;
   - Powdered Slumber: swings that wrote it, enemies whose accuracy rating it lowered (an enemy with no rating loses nothing), the accuracy rating removed in all,
     enemies that reached the passive's own 35% field (_accDn: written, never read), evasion misses by enemies whose accuracy it had lowered;
   - her basic attacks: hits on enemies, and the hits that woke a sleeping enemy.
   20 seeded fights: 12 campaign (4 stages x 3 seeds) and 8 two-sided (4 seeds, each side once), everyone at skill level 100.
   Run: node tests/lysara-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX(`var __ly={fights:0,ult:0,ultFoes:0,slept:0,resisted:0,held:[],wokeBy:{lysara:0,other:0,time:0,died:0},castLock:[],casts:0,cancelled:0,
  dt:0,links:0,linkSelf:0,shared:0,sharedN:0,coc:0,cocPer:[],cocEnd:{time:0,broke:0},swings:0,accLowered:0,accRemoved:0,accFull:0,accZero:0,evaMissLowered:0,evaMiss:0,
  autos:0,autoWake:0,ticks:0,linkT:0};
var __lyD=_doEffectCore, __lyH=_dealDamageCore, __lyU=_updateBattleCore, __lyHU=healUnit, __lySl=[], __lyCo=[], __lyAcc=new Map(), __lyCast=new Map();
_doEffectCore=function(u,type,o){ const me=u&&u.key==='lysara'&&!(o&&o.deliver&&!o._arrived);
  if(me&&type==='quietwings'){ __ly.ult++; const F=enemiesOf(u).filter(e=>e.alive), s0=F.map(e=>e.stunned||0); __ly.ultFoes+=F.length; const r=__lyD.apply(this,arguments);
    F.forEach((e,i)=>{ if((e.stunned||0)>s0[i]+1e-9){ __ly.slept++; __lySl.push({t:e,at:battleTime,st:e.stunned,woke:false}); } else __ly.resisted++; }); return r; }
  if(me&&type==='linkheal'){ __ly.dt++; const r=__lyD.apply(this,arguments); const L=units.filter(a=>a.team===u.team&&a._linkTo&&(a._linkT||0)>=7.99); if(L.length){ __ly.links++; if(L.indexOf(u)>=0) __ly.linkSelf++; } return r; }
  if(me&&type==='harmonyshield'){ __ly.coc++; const A=alliesOf(u), s0=A.map(a=>[a.shield||0,a.shieldT||0]); const r=__lyD.apply(this,arguments); let n=0;
    A.forEach((a,i)=>{ if((a.shieldT||0)>s0[i][1]+1e-9||(a.shield||0)>s0[i][0]+1e-9){ n++; __lyCo.push({a,until:battleTime+(a.shieldT||0)}); } }); __ly.cocPer.push(n); return r; }
  return __lyD.apply(this,arguments); };
healUnit=function(u,a){ const lk=u&&u._linkTo&&u._linkTo.alive&&(u._linkT||0)>0&&!u._healing, p=lk?u._linkTo:null, h0=p?p.hp:0; const r=__lyHU.apply(this,arguments);
  if(p&&p.hp>h0){ __ly.shared+=p.hp-h0; __ly.sharedN++; } return r; };
_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const asleep=tgt&&(tgt.stunned||0)>0&&(tgt._sleepT||0)>0, lyAuto=src&&src.key==='lysara'&&_autoAtk&&tgt&&tgt.team!==src.team;
  const f0=floatTexts.length, low=src&&__lyAcc.has(src)&&(src.accStat||0)<__lyAcc.get(src)-1e-9; if(lyAuto) __ly.autos++;
  const r=__lyH.apply(this,arguments);
  for(let i=f0;i<floatTexts.length;i++) if(floatTexts[i]&&floatTexts[i].txt==='MISS'){ __ly.evaMiss++; if(low) __ly.evaMissLowered++; }
  if(asleep&&!((tgt.stunned||0)>0)){ for(const e of __lySl) if(e.t===tgt&&!e.woke){ e.woke=true; __ly.held.push(+(battleTime-e.at).toFixed(2)); if(src&&src.key==='lysara'){ __ly.wokeBy.lysara++; if(lyAuto) __ly.autoWake++; } else __ly.wokeBy.other++; e.end=battleTime; } }
  return r; };
_updateBattleCore=function(dt){ const ly=units.filter(x=>x.key==='lysara'&&x.alive);
  for(const x of units) if(x.alive&&x.team==='enemy'&&ly.length&&!__lyAcc.has(x)) { __lyAcc.set(x,x.accStat||0); if(!(x.accStat>0)) __ly.accZero++; }
  const acc0=new Map(), ad0=new Map(); for(const x of units) if(x.team==='enemy'){ acc0.set(x,x.accStat||0); ad0.set(x,x._accDn||0); }
  const pend=new Map(); for(const x of units) if(x.team==='enemy'&&x._pend) pend.set(x,x._pend);
  const r=__lyU.apply(this,arguments);
  for(const x of units){ if(x.team!=='enemy') continue; const a=x._accDn||0, b=ad0.get(x)||0; if(a>b+1e-12){ __ly.swings++; if(a>=0.35-1e-9&&b<0.35-1e-9) __ly.accFull++; }
    const c0=acc0.get(x)||0; if((x.accStat||0)<c0-1e-9){ __ly.accRemoved+=c0-(x.accStat||0); if(!x.__lyLow){ x.__lyLow=1; __ly.accLowered++; } }
    const p=pend.get(x); if(p&&!x._pend&&((x._sleepT||0)>0)&&!((x.stunned||0)>0)) __ly.cancelled++; }
  for(const u of ly){ __ly.ticks++; if(units.some(a=>a.team===u.team&&a._linkTo&&(a._linkT||0)>0)) __ly.linkT++; }
  for(const e of __lySl){ if(e.woke) continue; if(!e.t.alive){ e.woke=true; __ly.held.push(+(battleTime-e.at).toFixed(2)); __ly.wokeBy.died++; continue; }
    if(!((e.t.stunned||0)>0)){ e.woke=true; e.end=battleTime; __ly.held.push(+(battleTime-e.at).toFixed(2)); __ly.wokeBy.time++; } }
  for(const e of __lySl){ if(e.end!=null&&e.lockDone==null){ if(!((e.t._sleepT||0)>0)||!e.t.alive){ e.lockDone=1; __ly.castLock.push(+(battleTime-e.end).toFixed(2)); } } }
  for(let i=0;i<__lyCo.length;i++){ const c=__lyCo[i]; if(!c.a.alive){ __lyCo.splice(i--,1); continue; } if(!((c.a.shield||0)>0)){ if(battleTime<c.until-0.05) __ly.cocEnd.broke++; else __ly.cocEnd.time++; __lyCo.splice(i--,1); } }
  return r; };`);
const team=['lysara','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__ly.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__ly.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__ly.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__ly'), step=VMX('SIM_STEP'), H=c.held.slice().sort((a,b)=>a-b), med=a=>a.length?a[Math.floor(a.length/2)]:0, hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
console.log('fights '+c.fights+'; Lysara alive '+(c.ticks*step).toFixed(0)+' s in all, a Dreamthread link up '+(c.linkT*step).toFixed(0)+' s of it');
console.log('Queen of Quiet Wings: '+c.ult+' casts, '+c.ultFoes+' enemies on the field at the casts, put to sleep '+c.slept+', resisted '+c.resisted);
console.log('  sleep held (s), sorted: '+JSON.stringify(H)+'  median '+med(H)+', longest '+(H.length?H[H.length-1]:0));
console.log('  woken by Lysara '+c.wokeBy.lysara+' (her basic attacks '+c.autoWake+'), by another unit '+c.wokeBy.other+', ran out '+c.wokeBy.time+', died asleep '+c.wokeBy.died);
console.log('  after the stun field ended, _sleepT still held casts off for (s): median '+med(c.castLock.slice().sort((a,b)=>a-b))+' ('+c.castLock.length+' sleeps); casts cancelled by it '+c.cancelled);
console.log('Dreamthread: '+c.dt+' casts, links made '+c.links+' (with Lysara herself one of the two: '+c.linkSelf+'); healing that travelled along a link '+Math.round(c.shared)+' HP in '+c.sharedN+' heals');
console.log('Moon Cocoon: '+c.coc+' casts, allies shielded per cast '+hist(c.cocPer)+'; its shields ran out unbroken '+c.cocEnd.time+', broke '+c.cocEnd.broke);
console.log('Powdered Slumber: '+c.swings+' swings wrote its 35% field; enemies that reached 35% '+c.accFull+'; enemies with NO accuracy rating to lose '+c.accZero+', enemies whose rating it lowered '+c.accLowered+' ('+c.accRemoved.toFixed(0)+' rating in all); evasion misses '+c.evaMiss+', by an enemy whose accuracy it had lowered '+c.evaMissLowered);
console.log('her basic attacks on enemies: '+c.autos);
const L=V.arena(snaps([Object.assign(spec('lysara',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), y=L[0];
console.log('body radius '+V.bodyR(y).toFixed(2)+' m; attack interval '+y.atkInterval.toFixed(3)+' s; range '+(y.range/V.METER).toFixed(2)+' m; melee '+!!y.melee+'; max HP '+Math.round(y.maxHp)+', apow '+Math.round(y.apow||0)+'; passMul '+y.passMul+'; passive '+JSON.stringify(y.pass)+'; green '+JSON.stringify(y.greenAb)+'; blue '+JSON.stringify(y.blueAb));
const o=VMX('skillScaleOpts')(Object.assign({},VMX('ULT_DEF').quietwings),VMX('skillMul')(100),100); console.log('ult options as cast at level 100 (after the control table): '+JSON.stringify(o)+'; CC_DUR_MAX '+JSON.stringify(VMX('CC_DUR_MAX')));
