'use strict';
/* Oakmir's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often
   each of his skills fires and what it reaches in 20 seeded fights (12 campaign, 8 two-sided) with NO talents learned.
   - Mending Bloom ('hot', green): the ally it goes to (the engine's lowestAlly: the lowest HP SHARE, himself included), its HP share then, what its ticks
     offered and what they restored (overheal);
   - Rally Roots ('heal', blue): allies healed a cast (every ally, any distance), offered / restored;
   - First Spring (ultimate, 'firstspring', delivered as a form): allies inside its 20 m, offered / restored of the burst and of its regrowth;
   - Deep Roots (passive): catches (on whom), what it healed; whether the ally was really held (it is not: "roots" is the art);
   - his basic attacks (count, kind, landed), the enemy basic attacks on his allies (for Thorns), the controls that landed on his allies (for Nests),
     how often an ally drops below 50% / 30%, where his allies stand from him (for Shade), his deaths.
   Run: node tests/oakmir-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __ok={fights:0,mb:0,mbSelf:0,mbHp:[],mbOff:0,mbGot:0,rr:0,rrN:[],rrOff:0,rrGot:0,fs:0,fsN:[],fsOff:0,fsGot:0,rgOff:0,rgGot:0,dr:0,drSelf:0,drSum:0,drHeal:0,drHeld:0,'+
  'autos:0,autoKind:{},autoLand:0,enAutoOnAl:0,enHitOnAl:0,ccOnAl:{},ccOnMe:{},below50:0,below30:0,ticks:0,alTicks:0,gap2:0,gap3:0,gap5:0,gapAll:[],deaths:0,hitsOn:0,autoOn:0,energyT:[],ultAt:[]};'+
  'var __okD=_doEffectCore, __okDD=_dealDamageCore, __okU=_updateBattleCore, __okH=healUnit, __okF=healFrom, __okC=ccApply, __okP=pushHot, __okSrc=null, __okPrev=new Map(), __okDr=new Map();'+
  'pushHot=function(t,hps,dur,iv){ const r=__okP.apply(this,arguments); if(__okSrc){ const h=t.hots[t.hots.length-1]; if(h){ h.__ok=__okSrc; let v=h.hps; Object.defineProperty(h,"hps",{get(){ __okHot=this; return v; },set(x){ v=x; },configurable:true,enumerable:true}); } } return r; };'+
  'var __okHot=null;'+
  'healUnit=function(u,a){ const h0=u.hp, alive=u.alive, k=__okHot; __okHot=null; const src=__okSrc; const r=__okH.apply(this,arguments); const got=alive?Math.max(0,u.hp-h0):0;'+
  '  if(k&&k.__ok==="mb"){ __ok.mbOff+=a; __ok.mbGot+=got; } else if(k&&k.__ok==="fs"){ __ok.rgOff+=a; __ok.rgGot+=got; } else if(src==="rr"){ __ok.rrOff+=a; __ok.rrGot+=got; } else if(src==="fs"){ __ok.fsOff+=a; __ok.fsGot+=got; } return r; };'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="oakmir"&&(!o||!o.deliver||o._arrived);'+
  '  if(me&&type==="hot"){ __ok.mb++; const l=lowestAlly(u); if(l===u) __ok.mbSelf++; if(l) __ok.mbHp.push(+(l.hp/l.maxHp).toFixed(3)); __okSrc="mb"; }'+
  '  else if(me&&type==="heal"){ __ok.rr++; __ok.rrN.push(alliesOf(u).length); __okSrc="rr"; }'+
  '  else if(me&&type==="firstspring"){ __ok.fs++; const R=(o&&o.radius)||20*METER; let c=null,ws=2; alliesOf(u).forEach(a=>{ const f=a.hp/Math.max(1,a.maxHp); if(f<ws){ws=f;c=a;} }); let n=0; if(c) alliesOf(u).forEach(a=>{ if(Math.hypot(a.x-c.x,a.y-c.y)<=R) n++; }); __ok.fsN.push(n); __ok.ultAt.push(+battleTime.toFixed(1)); __okSrc="fs"; }'+
  '  try{ return __okD.apply(this,arguments); } finally{ if(me) __okSrc=null; } };'+
  'ccApply=function(u,t,field,dur){ const b=t?(t[field]||0):0, r=__okC.apply(this,arguments); if(r&&t&&units.some(x=>x.key==="oakmir"&&x.team===t.team)&&(t[field]||0)>b+1e-9){ const k=field+(field==="stunned"&&(t._sleepT||0)>0?"(sleep)":""); const m=t.key==="oakmir"?__ok.ccOnMe:__ok.ccOnAl; m[k]=(m[k]||0)+1; } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const au=_autoAtk; const h0=tgt?tgt.hp+(tgt.shield||0):0;'+
  '  if(src&&src.key==="oakmir"&&tgt&&tgt.team!==src.team&&au){ __ok.autos++; __ok.autoKind[kind||"phys"]=(__ok.autoKind[kind||"phys"]||0)+1; }'+
  '  const oak=units.find(x=>x.key==="oakmir"&&x.alive&&tgt&&x.team===tgt.team);'+
  '  if(oak&&src&&src.team!==tgt.team&&tgt!==oak){ __ok.enHitOnAl++; if(au) __ok.enAutoOnAl++; }'+
  '  if(tgt&&tgt.key==="oakmir"&&src&&src.team!==tgt.team){ __ok.hitsOn++; if(au) __ok.autoOn++; }'+
  '  const r=__okDD.apply(this,arguments); if(src&&src.key==="oakmir"&&au&&tgt&&tgt.hp+(tgt.shield||0)<h0) __ok.autoLand++; return r; };'+
  '_updateBattleCore=function(dt){ const O=units.filter(u=>u&&u.key==="oakmir"&&u.alive);'+
  '  for(const u of O){ __ok.ticks++; __ok.energyT.push(u.energy||0); for(const a of units){ if(!a||!a.alive||a.team!==u.team||a===u||a._summon) continue; __ok.alTicks++; const g=(dist(u,a)-bodyR(u)-bodyR(a))/METER; if(g<2) __ok.gap2++; if(g<3) __ok.gap3++; if(g<5) __ok.gap5++; if(__ok.gapAll.length<20000) __ok.gapAll.push(+g.toFixed(2)); } }'+
  '  for(const a of units){ if(!a||!a.alive||!O.length||a.team!==O[0].team) continue; const p=a.hp/a.maxHp, w=__okPrev.get(a); if(w!=null&&w>=0.5&&p<0.5) __ok.below50++; if(w!=null&&w>=0.3&&p<0.3) __ok.below30++; __okPrev.set(a,p);'+
  '    const d0=__okDr.get(a)||0; if(a._drUsed&&a._drBy&&a._drBy.key==="oakmir"&&!d0){ __ok.dr++; if(a.key==="oakmir") __ok.drSelf++; __ok.drSum+=a._drRate*4; __okDr.set(a,1); if((a.stunned||0)>0) __ok.drHeld++; } }'+
  '  const dead=O.filter(u=>u); const r=__okU.apply(this,arguments); for(const u of dead) if(!u.alive) __ok.deaths++; return r; };'+
  'healFrom=function(s,t,a){ return __okF.apply(this,arguments); };');
const team=['oakmir','vael','vex','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__ok.fights++; __okPrev=new Map(); __okDr=new Map();'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','konwu','lysara','dandra','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__ok.fights++; __okPrev=new Map(); __okDr=new Map();'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__ok.fights++; __okPrev=new Map(); __okDr=new Map();'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__ok'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
const step=VMX('SIM_STEP'), med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?(+b[b.length>>1]).toFixed(2):'-'; }, pc=(a,b)=>b?(100*a/b).toFixed(1)+'%':'-';
console.log('fights '+c.fights+'; Oakmir alive '+(c.ticks*step).toFixed(0)+' s in all; his deaths '+c.deaths);
console.log('Mending Bloom: '+c.mb+' casts ('+c.mbSelf+' on himself); the ally\'s HP share at the cast mean '+avg(c.mbHp)+' median '+med(c.mbHp)+'; its ticks offered '+c.mbOff.toFixed(0)+' HP and restored '+c.mbGot.toFixed(0)+' ('+pc(c.mbGot,c.mbOff)+'; overheal '+pc(c.mbOff-c.mbGot,c.mbOff)+')');
console.log('Rally Roots: '+c.rr+' casts, allies healed a cast '+hist(c.rrN)+'; offered '+c.rrOff.toFixed(0)+', restored '+c.rrGot.toFixed(0)+' ('+pc(c.rrGot,c.rrOff)+')');
console.log('First Spring: '+c.fs+' casts, allies inside its 20 m '+hist(c.fsN)+'; burst offered '+c.fsOff.toFixed(0)+', restored '+c.fsGot.toFixed(0)+' ('+pc(c.fsGot,c.fsOff)+'); regrowth offered '+c.rgOff.toFixed(0)+', restored '+c.rgGot.toFixed(0)+' ('+pc(c.rgGot,c.rgOff)+'); cast at fight time (s) median '+med(c.ultAt));
console.log('Deep Roots: '+c.dr+' catches ('+c.drSelf+' on himself), healing '+c.drSum.toFixed(0)+' HP planned; the caught ally was held by a stun at the catch '+c.drHeld+' times (the roots are art only)');
console.log('his basic attacks '+c.autos+' '+JSON.stringify(c.autoKind)+', landed '+c.autoLand+'; hits on him '+c.hitsOn+' (basic '+c.autoOn+'); enemy hits on his allies '+c.enHitOnAl+' (basic attacks '+c.enAutoOnAl+', '+(c.enAutoOnAl/Math.max(1,c.alTicks*step)).toFixed(2)+' per ally-second)');
console.log('controls landed on his allies '+JSON.stringify(c.ccOnAl)+', on him '+JSON.stringify(c.ccOnMe)+'; an ally dropped below 50% '+c.below50+' times, below 30% '+c.below30+' times');
console.log('his allies (heroes) body to body from him: within 2 m '+pc(c.gap2,c.alTicks)+', within 3 m '+pc(c.gap3,c.alTicks)+', within 5 m '+pc(c.gap5,c.alTicks)+' of ally-ticks; gap median '+med(c.gapAll)+' m; his energy median '+med(c.energyT));
const L=V.arena(snaps([Object.assign(spec('oakmir',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7);
console.log('body radius: Oakmir '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', apow '+Math.round(L[0].apow)+', healPowMul '+(L[0].healPowMul||1).toFixed(3)+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passMul '+L[0].passMul+'; profile '+(L[0].t&&L[0].t.damageProfile)+'; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb)+', ult '+JSON.stringify(VMX('ULT_DEF.firstspring'))+' / '+JSON.stringify(VMX('HERO_ULT_ART.oakmir')));
