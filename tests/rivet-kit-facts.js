'use strict';
/* Rivet's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: in seeded fights
   with NO talents learned - his ten weapons (which one each basic attack picked, ranged or melee, the gap to the target), how often five ranged weapons came
   in a row (a "Full Rack") and four melee weapons in a row (a melee cycle), the chain hook (how often, who it pulled), the hammer's stun, the upper spike's
   silence and the hook's stun (landed / resisted, how long), Scattergun (casts, enemies struck - it is one of the back-row skills release v1391 re-centres on
   its target), Smoke Bomb (casts, its slow), Full Arsenal (casts, enemies struck, its stun and slow), where he stands, and the hits on him.
   Run: node tests/rivet-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __rk={fights:0,picks:{},rangedPicks:0,meleePicks:0,gapR:[],gapM:[],run5:0,run4:0,hooks:0,hookPulled:0,hookImm:0,cc:{},ccLen:{},sg:0,sgHit:0,sgNobody:0,sgN:[],sgTgtD:[],sgTgtIn:0,'+
  'sb:0,sbSlow:0,sbLen:[],sbMul:[],fa:0,faN:[],faStun:0,faStunLen:[],faSlow:0,ticks:0,inMelee:0,tgtFar6:0,tgtNone:0,hitsOn:0,autoOn:0,skillOn:0,far6On:0,near3On:0,redOn:[],'+
  'wpnDmg:{},autoHits:0,nearC:[],dashes:0};'+
  'var __rkP=rivetPick, __rkCC=rivetCC, __rkH=rivetHook, __rkD=_doEffectCore, __rkDD=_dealDamageCore, __rkU=_updateBattleCore, __rkRun=new Map(), __rkSkill=null, __rkSgSet=null;'+
  'rivetPick=function(u,t){ const w=__rkP.apply(this,arguments); __rk.picks[w]=(__rk.picks[w]||0)+1; const g=rivetGap(u,t)/METER; const m=RIVET_WPN.melee.indexOf(w)>=0;'+
  '  if(m){ __rk.meleePicks++; __rk.gapM.push(g); } else { __rk.rangedPicks++; __rk.gapR.push(g); }'+
  '  const r=__rkRun.get(u)||{r:0,m:0}; if(m){ r.r=0; r.m++; if(r.m%4===0) __rk.run4++; } else { r.m=0; r.r++; if(r.r%5===0) __rk.run5++; } __rkRun.set(u,r); return w; };'+
  'rivetCC=function(u,t,f,v){ const w=__rkSkill||u._rvWpn||"?"; const k=w+":"+f; const ok=__rkCC.apply(this,arguments); __rk.cc[k]=__rk.cc[k]||{landed:0,resisted:0}; __rk.cc[k][ok?"landed":"resisted"]++; if(ok){ (__rk.ccLen[k]=__rk.ccLen[k]||[]).push(+(t[f]).toFixed(3)); } return ok; };'+
  'rivetHook=function(u,e){ __rk.hooks++; const x0=e.x,y0=e.y; const r=__rkH.apply(this,arguments); return r; };'+
  'var __rkSB=null;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="rivet"&&(!o||!o.deliver||o._arrived); let pre=null;'+
  '  if(me&&type==="spread"){ __rk.sg++; __rkSgSet=new Set(); const t=u.target; if(t&&t.alive){ __rk.sgTgtD.push(dist(u,t)/METER); if(dist(u,t)<=3.2*METER) __rk.sgTgtIn++; } }'+
  '  if(me&&type==="slow"){ __rk.sb++; const t=o&&o._tgtU||u.target; __rkSB=t; pre=t?(t.slow||0):0; }'+
  '  if(me&&type==="multiShot"){ __rk.fa++; __rk.faN.push(enemiesOf(u).filter(e=>e.alive).length); }'+
  '  __rkSkill=me?type:null; let r; try{ r=__rkD.apply(this,arguments); } finally{ __rkSkill=null; }'+
  '  if(me&&type==="spread"){ __rk.sgN.push(__rkSgSet.size); if(__rkSgSet.size) __rk.sgHit++; else __rk.sgNobody++; __rkSgSet=null; }'+
  '  if(me&&type==="slow"&&__rkSB){ const t=__rkSB; if((t.slow||0)>pre){ __rk.sbSlow++; __rk.sbLen.push(+(t.slow).toFixed(3)); __rk.sbMul.push(+(t.slowMul||1).toFixed(3)); } __rkSB=null; }'+
  '  return r; };'+
  'var __rkCA=ccApply; ccApply=function(u,t,field,dur){ const r=__rkCA.apply(this,arguments); if(u&&u.key==="rivet"&&__rkSkill==="multiShot"&&r){ if(field==="stunned"){ __rk.faStun++; __rk.faStunLen.push(+(t.stunned).toFixed(3)); } if(field==="slow") __rk.faSlow++; } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){'+
  '  if(src&&src.key==="rivet"&&tgt&&tgt.team!==src.team){ if(__rkSkill==="spread"&&__rkSgSet) __rkSgSet.add(tgt); if(_autoAtk){ __rk.autoHits++; const w=src._rvWpn||"?"; __rk.wpnDmg[w]=(__rk.wpnDmg[w]||0)+1; } }'+
  '  let h0=null; if(tgt&&tgt.key==="rivet"&&src&&src.team!==tgt.team){ __rk.hitsOn++; if(_autoAtk) __rk.autoOn++; else __rk.skillOn++; const g=rivetGap(tgt,src)/METER; if(g>6) __rk.far6On++; if(g<3) __rk.near3On++; h0=[tgt.hp+(tgt.shield||0),amt]; }'+
  '  const r=__rkDD.apply(this,arguments); if(h0){ const lost=h0[0]-(tgt.hp+(tgt.shield||0)); if(h0[1]>0&&lost>=0) __rk.redOn.push(1-lost/h0[1]); } return r; };'+
  '_updateBattleCore=function(dt){ const L=units.filter(u=>u&&u.key==="rivet"&&u.alive);'+
  '  for(const u of L){ __rk.ticks++; const t=u.target; if(t&&t.alive){ const g=rivetGap(u,t)/METER; if(g<=3) __rk.inMelee++; if(g>6) __rk.tgtFar6++; } else __rk.tgtNone++; let bc=1e9; for(const e of enemiesOf(u)){ if(!e.alive) continue; const d=dist(u,e); if(d<bc) bc=d; } if(bc<1e9) __rk.nearC.push(bc/METER);'+
  '    for(const e of enemiesOf(u)) if(e.alive&&e._dash&&rivetGap(u,e)<=3*METER) __rk.dashes++; }'+
  '  return __rkU.apply(this,arguments); };');
const team=['rivet','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__rk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','korvux'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__rk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__rk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__rk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
const step=VMX('SIM_STEP'), med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[b.length>>1].toFixed(2):'-'; }, mx=a=>a.length?Math.max(...a).toFixed(2):'-', share=(a,f)=>a.length?(100*a.filter(f).length/a.length).toFixed(1)+'%':'-';
console.log('fights '+c.fights+'; Rivet alive '+(c.ticks*step).toFixed(0)+' s in all; his target within 3 m (ground between bodies) '+(100*c.inMelee/Math.max(1,c.ticks)).toFixed(1)+'% of ticks, beyond 6 m '+(100*c.tgtFar6/Math.max(1,c.ticks)).toFixed(1)+'%, no target '+(100*c.tgtNone/Math.max(1,c.ticks)).toFixed(1)+'%; nearest enemy centre to centre median '+med(c.nearC)+' m');
console.log('weapon picks '+JSON.stringify(c.picks)+'; ranged '+c.rangedPicks+' melee '+c.meleePicks+'; gap at a ranged pick median '+med(c.gapR)+' m (beyond 6 m '+share(c.gapR,x=>x>6)+'), at a melee pick median '+med(c.gapM)+' m');
console.log('five ranged weapons in a row (a Full Rack with no talents) '+c.run5+' times; four melee weapons in a row (a melee cycle) '+c.run4+' times; weapon hits (basic) '+c.autoHits+' '+JSON.stringify(c.wpnDmg));
console.log('chain hooks fired '+c.hooks+'; enemy dashes that started within 3 m of him (ticks) '+c.dashes);
for(const k of Object.keys(c.cc)) console.log('control '+k+': landed '+c.cc[k].landed+', resisted '+c.cc[k].resisted+'; length '+avg(c.ccLen[k]||[])+' s '+hist(c.ccLen[k]||[]));
console.log('Scattergun: '+c.sg+' casts; struck somebody '+c.sgHit+', nobody '+c.sgNobody+'; enemies struck '+hist(c.sgN)+'; his target centre to centre at the cast median '+med(c.sgTgtD)+' m (inside 3.2 m '+c.sgTgtIn+')');
console.log('Smoke Bomb: '+c.sb+' casts; slow landed '+c.sbSlow+'; length '+avg(c.sbLen)+' s '+hist(c.sbLen)+'; slow multiplier '+hist(c.sbMul));
console.log('Full Arsenal: '+c.fa+' casts; living enemies at the cast '+hist(c.faN)+'; its stun landed '+c.faStun+' '+hist(c.faStunLen)+'; its slow landed '+c.faSlow);
console.log('hits on him '+c.hitsOn+' (basic '+c.autoOn+', skills '+c.skillOn+'); from beyond 6 m '+c.far6On+', from within 3 m '+c.near3On+'; share of each hit his own reductions took (armour, glyphs, shield): median '+med(c.redOn)+', max '+mx(c.redOn));
const L=V.arena(snaps([Object.assign(spec('rivet',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7);
console.log('body radius: Rivet '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', armour '+Math.round(L[0].armorRating||0)+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passMul '+L[0].passMul+'; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb)+'; slowMulFor(100) '+V.slowMulFor(100)+'; ccNerf '+V.ccNerf+'; caps '+JSON.stringify({st:V.cap('stunned'),si:V.cap('silencedT'),sl:V.cap('slow')}));
