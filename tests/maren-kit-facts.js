'use strict';
/* Maren's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each of
   his skills fires and what it reaches in seeded fights with NO talents learned - Tide Pool (casts, where it lands, enemies standing in it each tick), Tsunami
   (casts, enemies struck, the nearest enemy's distance; how many it WOULD strike centred on his target, as release v1391 makes it), Maelstrom (casts, enemies
   struck and rooted, the root's length), Deep Reserves (heal a second, the share of his time at full HP), and the hits on him.
   Run: node tests/maren-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __mk={tp:0,tpLand:0,tpTick:0,tpIn:[],tpTgtIn:0,ts:0,tsHit:0,tsNone:0,tsPer:[],tsNear:[],tsAtTgt:[],tsPush:0,mae:0,maeHit:0,maeRoot:0,maeRootT:[],maeNone:0,ticks:0,full:0,heal:0,nrg:0,hitsOn:0,autoOn:0,fights:0,dist:[]};'+
  'var __mkD=_doEffectCore, __mkDD=_dealDamageCore, __mkU=_updateBattleCore, __mkCC=ccApply, __mkCur=null, __mkN=0, __mkHz=[];'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="maren"&&(!o||!o.deliver||o._arrived);'+
  '  if(u&&u.key==="maren"&&o&&o.deliver&&!o._arrived&&type==="ashfall") __mk.tp++;'+
  '  if(me&&type==="ashfall"){ __mk.tpLand++; __mkHz.length=0; }'+
  '  if(me&&type==="tidalsurge"){ __mk.ts++; __mkCur="ts"; __mkN=0; let bc=1e9; for(const e of enemiesOf(u)){ const d=dist(u,e); if(d<bc) bc=d; } __mk.tsNear.push(bc/METER);'+
  '    const tg=(o&&o._tgtU&&o._tgtU.alive)?o._tgtU:((u.target&&u.target.alive)?u.target:nearestEnemy(u)); let k=0; if(tg) for(const e of enemiesOf(u)) if(e.alive&&dist(tg,e)<=(o.radius||3.4*METER)) k++; __mk.tsAtTgt.push(k); }'+
  '  if(me&&type==="swamproot"){ __mk.mae++; __mkCur="mae"; __mkN=0; }'+
  '  const g0=groundHazards.length; try{ return __mkD.apply(this,arguments); } finally{ if(me&&type==="ashfall"){ for(let i=g0;i<groundHazards.length;i++){ const h=groundHazards[i]; if(h&&h.src===u&&!h.arrival) { h.__mk=1; const tg=o&&o._tgtU; if(tg&&Math.hypot(tg.x-h.x,tg.y-h.y)<=h.r) __mk.tpTgtIn++; } } }'+
  '    if(me&&type==="tidalsurge"){ __mk.tsPer.push(__mkN); if(!__mkN) __mk.tsNone++; } if(me&&type==="swamproot"&&!__mkN) __mk.maeNone++; if(me) __mkCur=null; } };'+
  'ccApply=function(u,t,f,d){ const r=__mkCC.apply(this,arguments); if(u&&u.key==="maren"&&__mkCur==="mae"&&f==="stunned"&&r){ __mk.maeRoot++; __mk.maeRootT.push(t.stunned); } if(u&&u.key==="maren"&&__mkCur==="ts"&&f==="slow"&&r) __mk.tsPush++; return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(src&&src.key==="maren"&&tgt&&tgt.team!==src.team){ if(__mkCur==="ts"){ __mk.tsHit++; __mkN++; } else if(__mkCur==="mae"){ __mk.maeHit++; __mkN++; } }'+
  '  if(tgt&&tgt.key==="maren"&&src&&src.team!==tgt.team){ __mk.hitsOn++; if(_autoAtk) __mk.autoOn++; } return __mkDD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="maren"&&u.alive){ __mk.ticks++; if(u.hp>=u.maxHp-1e-6) __mk.full++; let bd=1e9; for(const e of units) if(e.alive&&e.team!==u.team){ const d=dist(u,e)-bodyR(u)-bodyR(e); if(d<bd) bd=d; } if(bd<1e8&&(__mk.ticks%15)===0) __mk.dist.push(bd/METER); } }'+
  '  for(const h of groundHazards){ if(h&&h.__mk&&h.acc+dt>=h.interval){ let n=0; for(const e of units) if(e.alive&&e.team!==h.team&&Math.hypot(e.x-h.x,e.y-h.y)<=h.r) n++; __mk.tpTick++; __mk.tpIn.push(n); } }'+
  '  return __mkU.apply(this,arguments); };');
const team=['maren','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__mk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__mk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__mk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__mk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[b.length>>1].toFixed(2):'-'; };
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Maren alive '+(c.ticks*step).toFixed(0)+' s in all, at full HP '+(100*c.full/Math.max(1,c.ticks)).toFixed(1)+'% of it; nearest enemy body to body: median '+med(c.dist)+' m, mean '+avg(c.dist)+' m');
console.log('Tide Pool: '+c.tp+' presses, '+c.tpLand+' landed, the target inside its own pool at landing '+c.tpTgtIn+'; pool ticks '+c.tpTick+', enemies standing in it per tick '+hist(c.tpIn)+' (mean '+avg(c.tpIn)+')');
console.log('Tsunami: '+c.ts+' casts, '+c.tsHit+' enemies struck ('+(c.ts?(c.tsHit/c.ts).toFixed(2):'-')+' a cast), casts that struck nobody '+c.tsNone+', per cast '+hist(c.tsPer)+', slows landed '+c.tsPush);
console.log('  nearest enemy at the cast, centre to centre: median '+med(c.tsNear)+' m (min '+(c.tsNear.length?Math.min(...c.tsNear).toFixed(2):'-')+'); enemies within its 3.4 m of his TARGET (the v1391 centre): '+hist(c.tsAtTgt)+' (mean '+avg(c.tsAtTgt)+')');
console.log('Maelstrom: '+c.mae+' casts, '+c.maeHit+' enemies struck ('+(c.mae?(c.maeHit/c.mae).toFixed(2):'-')+' a cast), casts that struck nobody '+c.maeNone+', roots landed '+c.maeRoot+', root length as written '+hist(c.maeRootT.map(x=>x.toFixed(2))));
console.log('hits on him: '+c.hitsOn+' (basic attacks '+c.autoOn+')');
const L=V.arena(snaps([spec('maren',100)]),snaps([spec('vael',100)]),7); const m=L[0];
console.log('body radius: Maren '+V.bodyR(m).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+m.atkInterval.toFixed(3)+' s; max HP '+Math.round(m.maxHp)+', attack '+Math.round(m.dmg)+', apow '+Math.round(m.apow)+', melee '+!!m.melee+', range '+(m.range/V.METER).toFixed(2)+' m; passMul '+m.passMul+'; passive '+JSON.stringify(m.pass)+', green '+JSON.stringify(m.greenAb)+', blue '+JSON.stringify(m.blueAb)+'; damage profile '+(m.t&&m.t.damageProfile)+', row '+(m.t&&m.t.row));
