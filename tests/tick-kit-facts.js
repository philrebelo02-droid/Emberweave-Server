'use strict';
/* Tick's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on, in 20 seeded
   fights with no talents learned: Overclock (green 'haste', self: how long his attack speed really stays raised after a cast - the _ocT marker), Mainspring
   (blue 'punchflurry': its five punches, their target, crits), Flywheel (the ultimate 'flywheel': the enemies it reaches, centre to centre 3 m, and how far
   the nearest enemies stand), Momentum Gears (passive 'momentum': u._momStk over the fight and at each wave change), his basic attacks (how many land, the
   interval), the hits he takes (physical / magic / critical), stuns and slows on him, the waves a fight has and how long they last.
   Run: node tests/tick-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __tk={fights:0,waves:0,waveLen:[],wavesPer:[],ticks:0,oc:0,ocHasteAfter:[],ocT:[],ms:0,msNone:0,msHits:[],msCrit:0,msPunch:0,fw:0,fwHit:[],fwNear:[],fwNearC:[],auto:0,autoCrit:0,interval:[],hm:[],'+
  'hitsOn:0,magOn:0,physOn:0,trueOn:0,critOn:0,stunsOn:0,slowsOn:0,slowT:0,stunT:0,mom:[],momWave:[],mode:null,dmg:{ms:0,fw:0,auto:0,other:0},deaths:0,energyFw:[],kinds:{},fightLen:[],strokes:[]};'+
  'var __tkD=_doEffectCore, __tkDD=_dealDamageCore, __tkU=_updateBattleCore, __tkRW=resetPerWave, __tkCur=null, __tkN=0, __tkW=0, __tkWT=0, __tkFT=0, __tkPrevSt=0, __tkPrevSl=0, __tkOcAt=-1, __tkSt=0;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="tick"; const was=__tkCur; if(me){ __tkCur=type; __tkN=0;'+
  '    if(type==="haste"){ __tk.oc++; __tkOcAt=0; }'+
  '    if(type==="punchflurry"){ __tk.ms++; if(!(u.target&&u.target.alive)) __tk.msNone++; }'+
  '    if(type==="flywheel"){ __tk.fw++; const F=enemiesOf(u).filter(e=>e.alive).map(e=>dist(u,e)/METER).sort((a,b)=>a-b); __tk.fwNearC.push(F.length?+F[0].toFixed(2):-1);'+
  '      const G=enemiesOf(u).filter(e=>e.alive).map(e=>(dist(u,e)-bodyR(u)-bodyR(e))/METER).sort((a,b)=>a-b); __tk.fwNear.push(G.length?+G[0].toFixed(2):-1); } }'+
  '  try{ return __tkD.apply(this,arguments); } finally{ if(me){ if(type==="punchflurry") __tk.msHits.push(__tkN); if(type==="flywheel") __tk.fwHit.push(__tkN); __tkCur=was; } } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const h0=tgt?tgt.hp+(tgt.shield||0):0, au=_autoAtk; if(tgt) tgt._critHit=false;'+
  '  const r=__tkDD.apply(this,arguments); const got=tgt?h0-tgt.hp-(tgt.shield||0):0;'+
  '  if(src&&src.key==="tick"&&got>0){ __tk.kinds[(__tkCur||(au?"auto":"other"))+":"+(tgt._lastHitKind||"?")]=(__tk.kinds[(__tkCur||(au?"auto":"other"))+":"+(tgt._lastHitKind||"?")]||0)+1; __tkSt++;'+
  '    if(__tkCur==="punchflurry"){ __tkN++; __tk.msPunch++; __tk.dmg.ms+=got; if(tgt._critHit) __tk.msCrit++; } else if(__tkCur==="flywheel"){ __tkN++; __tk.dmg.fw+=got; } else if(au){ __tk.auto++; __tk.dmg.auto+=got; if(tgt._critHit) __tk.autoCrit++; } else __tk.dmg.other+=got; }'+
  '  if(tgt&&tgt.key==="tick"&&src&&src.team!==tgt.team&&got>0){ __tk.hitsOn++; __tkSt++; const k=tgt._lastHitKind; if(k==="magic") __tk.magOn++; else if(k==="true") __tk.trueOn++; else __tk.physOn++; if(tgt._critHit) __tk.critOn++; }'+
  '  return r; };'+
  'resetPerWave=function(){ __tk.waves++; __tkW++; __tk.waveLen.push(+battleTime.toFixed(1)); for(const u of units) if(u&&u.key==="tick"&&u.alive) __tk.momWave.push(+(u._momStk||0).toFixed(3)); return __tkRW.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ __tkFT+=dt; for(const u of units){ if(!(u&&u.key==="tick")) continue; if(!u.alive){ if(!u.__dd){ u.__dd=1; __tk.deaths++; } continue; } __tk.ticks++; if(!__tk.mode) __tk.mode=heroScaleMode(u)+"/"+(u.t.damageProfile||"")+"/pass "+JSON.stringify(u.pass);'+
  '    if(__tkOcAt>=0){ __tkOcAt+=dt; if(Math.abs(__tkOcAt-6)<dt/2) __tk.ocHasteAfter.push(+((u.hasteT>0?u.hasteMul:1)).toFixed(3)+"/oc "+(+(u._ocT||0).toFixed(2))+"/mom "+(+(u._momStk||0).toFixed(3))); if(Math.abs(__tkOcAt-20)<dt/2) __tk.ocT.push(+(u._ocT||0).toFixed(2)); }'+
  '    if(__tk.ticks%60===1){ __tk.interval.push(+(u.atkInterval/(u.hasteT>0?u.hasteMul:1)).toFixed(3)); __tk.mom.push(+(u._momStk||0).toFixed(3)); }'+
  '    if((u.stunned||0)>__tkPrevSt+1e-6) __tk.stunsOn++; if((u.slow||0)>__tkPrevSl+1e-6) __tk.slowsOn++; if(u.stunned>0) __tk.stunT+=dt; if(u.slow>0) __tk.slowT+=dt; __tkPrevSt=u.stunned||0; __tkPrevSl=u.slow||0;'+
  '    if(u._pend&&!u._pend.spell&&!u.__ep){ u.__ep=1; __tk.energyFw.push(+__tkFT.toFixed(1)); } if(!u._pend) u.__ep=0; }'+
  '  return __tkU.apply(this,arguments); };');
const team=['tick','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
const fight=f=>{ VMX('__tk.fights++; __tkW=0; __tkFT=0; __tkOcAt=-1; __tkSt=0'); f(); VMX('__tk.wavesPer.push(__tkW); __tk.fightLen.push(+__tkFT.toFixed(1)); __tk.strokes.push(__tkSt)'); };
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) fight(()=>NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]));
const foes=[['ambrel','carn','dandra','konwu','ceraline'],['absalie','astra','vireo','sylthaine','vex']];
for(const fk of foes){ const foe=snaps(fk.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
  for(const seed of [5,77]){ fight(()=>NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed)); fight(()=>NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed)); } }
const c=VMX('__tk'), hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, sorted=a=>a.slice().sort((x,y)=>x-y), med=a=>a.length?sorted(a)[Math.floor(a.length/2)]:0, mx=a=>a.length?Math.max(...a):0;
console.log('fights '+c.fights+' (12 campaign, 8 two-sided); waves (resetPerWave) '+c.waves+', per fight '+hist(c.wavesPer)+'; fight seconds median '+med(c.fightLen)+' max '+mx(c.fightLen)+'; wave ends at (s) median '+med(c.waveLen)+'; Tick alive '+(c.ticks/30).toFixed(0)+' s, deaths '+c.deaths+'; mode '+c.mode);
console.log('Overclock: '+c.oc+' casts; 6 s after a cast his attack-speed multiplier / _ocT / Momentum: '+JSON.stringify(c.ocHasteAfter.slice(0,12))+'; _ocT 20 s after: '+JSON.stringify(c.ocT.slice(0,12)));
console.log('Mainspring: '+c.ms+' casts ('+c.msNone+' with no target at the cast), punches that took HP per cast '+hist(c.msHits)+', punches '+c.msPunch+', critical '+c.msCrit);
console.log('Flywheel: '+c.fw+' casts, enemies hit per cast '+hist(c.fwHit)+'; nearest enemy at the cast, centre to centre (m) '+JSON.stringify(c.fwNearC.slice(0,30))+'; body to body '+JSON.stringify(c.fwNear.slice(0,30)));
console.log('basic attacks that took HP '+c.auto+' (critical '+c.autoCrit+'); swing interval with haste (sampled 2 s) median '+med(c.interval)+' min '+Math.min(...c.interval)+'; Momentum sampled median '+med(c.mom)+' max '+mx(c.mom)+'; at each wave change '+JSON.stringify(c.momWave.slice(0,24)));
console.log('hits on him that took HP '+c.hitsOn+' (physical '+c.physOn+', magic '+c.magOn+', true '+c.trueOn+', critical '+c.critOn+'); new stuns on him '+c.stunsOn+' ('+c.stunT.toFixed(1)+' s), new slows '+c.slowsOn+' ('+c.slowT.toFixed(1)+' s)');
console.log('damage dealt: Mainspring '+Math.round(c.dmg.ms)+', Flywheel '+Math.round(c.dmg.fw)+', basic attacks '+Math.round(c.dmg.auto)+', other '+Math.round(c.dmg.other)+'; kinds (skill:kind -> hits) '+JSON.stringify(c.kinds)+'; strokes (hits landed + taken) per fight '+JSON.stringify(c.strokes)+'; ultimate presses at (s of fight) '+JSON.stringify(c.energyFw.slice(0,20)));
const L=V.arena(snaps([Object.assign(spec('tick',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), h=L[0];
console.log('body radius: Tick '+V.bodyR(h).toFixed(2)+' m; atkInterval '+h.atkInterval.toFixed(3)+' s; passMul '+h.passMul+'; max HP '+Math.round(h.maxHp)+', attack '+Math.round(h.dmg)+', melee '+!!h.melee+', range '+(h.range/V.METER).toFixed(2)+' m; pass '+JSON.stringify(h.pass)+'; armour '+Math.round(h.armorRating||0)+', mr '+Math.round(h.mrRating||0)+'; row '+h.t.row+', role '+h.t.role+', speed '+h.speed);
console.log('kits: green '+JSON.stringify(VMX('KITS.tick.green'))+' / blue '+JSON.stringify(VMX('KITS.tick.blue'))+' / ult '+JSON.stringify(VMX('ULT_DEF.flywheel'))+' + '+JSON.stringify(VMX('HERO_ULT_ART.tick'))+'; Overclock at level 100 '+VMX('skLvNum("haste",KITS.tick.green,100)')+', lab level 10 '+VMX('skLvNum("haste",KITS.tick.green,10)')+'; Momentum cap at 100 '+VMX('SKLV.momentumCap(100)')+', at 10 '+VMX('SKLV.momentumCap(10)')+'; cast times green '+VMX('castTimeFor(units[0],"green")')+', blue '+VMX('castTimeFor(units[0],"blue")'));
