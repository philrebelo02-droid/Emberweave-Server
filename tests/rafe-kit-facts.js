'use strict';
/* Rafe Marrow's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each
   of his skills fires and what it reaches in seeded fights with NO talents learned - his basic attacks (cutlass or pistol, how often the weapon switches),
   Pirate's Instinct (every fourth swing: a true-damage hit at the swing's press), Pistol Barrage (one bullet at each of the 4 nearest enemies), Grappling Hook
   (its stun as it lands, the pull), Dead Man's Fortune (5 shots, its evasion window and what it made miss), the hits on him (and how close the attacker stood),
   the enemies he helped kill, and his numbers.  Run: node tests/rafe-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __rk={fights:0,ticks:0,sw:0,cut:0,pis:0,swi:0,inst:0,instT:0,vol:0,bul:0,volN:[],volD:[],gr:0,grStun:[],grRes:0,grNone:0,grPull:[],grD:[],ult:0,shots:0,ultN:[],evT:0,aimedEv:0,missEv:0,aimed:0,miss:0,'+
  'hitsOn:0,meleeGap:[],hitsOnAuto:0,kills:0,assist4:0,deaths:0,crits:0,autoHits:0,gapAtSwing:[],cutGap:[],lastW:null,instSkill:0};'+
  'var __rkD=_doEffectCore, __rkC=_dealDamageCore, __rkU=_updateBattleCore, __rkCC=ccApply, __rkLast={}, __rkCur=null;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="rafe"; let pre=null;'+
  '  if(me&&type==="volley"){ __rk.vol++; __rkCur={k:"vol",set:{},n:0}; const es=enemiesOf(u).sort((a,b)=>dist(u,a)-dist(u,b)).slice(0,4); __rk.volN.push(es.length); es.forEach(e=>__rk.volD.push((dist(u,e)-bodyR(u)-bodyR(e))/METER)); }'+
  '  if(me&&type==="grapple"){ __rk.gr++; const t=u.target; if(!t) __rk.grNone++; else { __rk.grD.push((dist(u,t)-bodyR(u)-bodyR(t))/METER); pre=[t,t.x,t.y,t.stunned||0]; } }'+
  '  if(me&&type==="multiShot"){ __rk.ult++; __rk.ultN.push(enemiesOf(u).length); }'+
  '  const r=__rkD.apply(this,arguments);'+
  '  if(pre){ const t=pre[0]; __rk.grPull.push(Math.hypot(t.x-pre[1],t.y-pre[2])/METER); if((t.stunned||0)>pre[3]) __rk.grStun.push(t.stunned); else __rk.grRes++; }'+
  '  return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const au=_autoAtk; const ft=floatTexts.length;'+
  '  if(src&&src.key==="rafe"&&tgt&&tgt.team!==src.team){ __rkLast[tgt.uid]=[battleTime,src]; if(au){ __rk.autoHits++; const w=/[mM]elee/.test(src._atkClip||"")?"c":"p"; if(w==="c"){ __rk.cut++; __rk.cutGap.push((dist(src,tgt)-bodyR(src)-bodyR(tgt))/METER); } else __rk.pis++; if(__rk.lastW&&__rk.lastW!==w) __rk.swi++; __rk.lastW=w; }'+
  '    else if(kind==="true"&&color==="#ffe08a"){ __rk.inst++; __rk.instT+=amt; }'+
  '    else if(color==="#5ee89b"){ if(src._castSlot==="ult"||src._rkUlt) __rk.shots++; else __rk.bul++; } }'+
  '  const hv=tgt&&tgt.hp, me=tgt&&tgt.key==="rafe"&&src&&src.team!==tgt.team; if(me){ __rk.aimed++; if((tgt._miragT||0)>0){ __rk.evT++; __rk.aimedEv++; } if(au) __rk.hitsOnAuto++; __rk.meleeGap.push((dist(src,tgt)-bodyR(src)-bodyR(tgt))/METER); }'+
  '  const r=__rkC.apply(this,arguments);'+
  '  if(me){ for(let i=ft;i<floatTexts.length;i++) if(floatTexts[i].txt==="MISS"){ __rk.miss++; if((tgt._miragT||0)>0) __rk.missEv++; } }'+
  '  if(src&&src.key==="rafe"&&tgt&&tgt._critHit) __rk.crits++;'+
  '  return r; };'+
  '_updateBattleCore=function(dt){ const al=units.filter(u=>u.alive); const r=__rkU.apply(this,arguments);'+
  '  for(const u of units){ if(u&&u.key==="rafe"&&u.alive) __rk.ticks++; }'+
  '  for(const u of al) if(!u.alive){ if(u.key==="rafe") __rk.deaths++; const L=__rkLast[u.uid]; if(L&&L[1].team!==u.team){ if(battleTime-L[0]<=4) __rk.assist4++; } } return r; };');
/* the ult's shots land later (groundHazards) with the green colour: count them by marking the ult's window */
VMX('var __rkD2=_doEffectCore; _doEffectCore=function(u,type,o){ if(u&&u.key==="rafe"&&type==="multiShot"){ u._rkUlt=1; groundHazards.push({arrival:true,delay:0.9,run:function(){ u._rkUlt=0; }}); } return __rkD2.apply(this,arguments); };');
const team=['rafe','vael','vireo','sylthaine','mellan'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__rk.fights++; __rk.lastW=null'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['grosk','kharos','konwu','carn','vex'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__rk.fights++; __rk.lastW=null'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__rk.fights++; __rk.lastW=null'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__rk'), step=VMX('SIM_STEP'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length):0, hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, mx=a=>a.length?Math.max(...a):0, mn=a=>a.length?Math.min(...a):0;
const pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
console.log('fights '+c.fights+'; Rafe alive '+(c.ticks*step).toFixed(0)+' s in all; Rafe deaths '+c.deaths);
console.log('basic attacks landed '+c.autoHits+': cutlass '+c.cut+' ('+pc(c.cut,c.autoHits)+'), pistol '+c.pis+'; weapon switches (a Crossdraw) '+c.swi+' ('+pc(c.swi,c.autoHits)+' of swings); the cutlass target\'s body gap: mean '+avg(c.cutGap).toFixed(2)+' m, max '+mx(c.cutGap).toFixed(2)+' m; critical hits of his '+c.crits);
console.log('Pirate\'s Instinct: '+c.inst+' true-damage hits ('+pc(c.inst,c.autoHits)+' of landed basic attacks), mean '+(c.instT/Math.max(1,c.inst)).toFixed(0)+' each');
console.log('Pistol Barrage: '+c.vol+' casts, '+c.bul+' bullets landed ('+(c.bul/Math.max(1,c.vol)).toFixed(2)+' a cast); enemies alive to aim at '+hist(c.volN)+'; their body gap from him mean '+avg(c.volD).toFixed(2)+' m, max '+mx(c.volD).toFixed(2)+' m');
console.log('Grappling Hook: '+c.gr+' casts ('+c.grNone+' with no target); stun landed '+c.grStun.length+' (mean '+avg(c.grStun).toFixed(2)+' s, min '+mn(c.grStun).toFixed(2)+', max '+mx(c.grStun).toFixed(2)+'), resisted / none '+c.grRes+'; pull mean '+avg(c.grPull).toFixed(2)+' m (max '+mx(c.grPull).toFixed(2)+'); target body gap at the cast mean '+avg(c.grD).toFixed(2)+' m (max '+mx(c.grD).toFixed(2)+')');
console.log('Dead Man\'s Fortune: '+c.ult+' casts, '+c.shots+' shots landed ('+(c.shots/Math.max(1,c.ult)).toFixed(2)+' a cast), enemies alive at the cast '+hist(c.ultN)+'; hits aimed at him while it evades '+c.aimedEv+', missed '+c.missEv+' ('+pc(c.missEv,c.aimedEv)+')');
console.log('hits aimed at him '+c.aimed+' (basic attacks '+c.hitsOnAuto+'), missed to Evasion '+c.miss+'; attacker body gap: within 2.5 m '+c.meleeGap.filter(x=>x<2.5).length+', within 4 m '+c.meleeGap.filter(x=>x<4).length+', mean '+avg(c.meleeGap).toFixed(2)+' m');
console.log('enemies that died within 4 s of a hit of his '+c.assist4);
const L=V.arena(snaps([Object.assign(spec('rafe',100),{skillLv:[100,100,100,100]}),spec('vael',100)]),snaps([spec('vael',100)]),7);
const m=L[0]; console.log('Rafe at level 100, skill level 100: max HP '+Math.round(m.maxHp)+', attack '+Math.round(m.dmg)+', crit '+(m.glyphCrit||0).toFixed(3)+', crit dmg '+(m.critDmg||0.6)+', evasion '+(m.evaStat||0)+', armor '+Math.round(m.armorRating||0)+', mr '+Math.round(m.mrRating||0)+', range '+(m.range/V.METER).toFixed(2)+' m, attack interval '+m.atkInterval.toFixed(3)+' s, body '+V.bodyR(m).toFixed(2)+' m (a Vael '+V.bodyR(L[1]).toFixed(2)+' m), speed '+m.speed+'; passive '+JSON.stringify(m.pass)+', passMul '+(m.passMul||1)+', instinct '+VMX('instinctDmg')(m).toFixed(3));
console.log('green '+JSON.stringify(m.greenAb)+'; blue '+JSON.stringify(m.blueAb)+'; ult '+JSON.stringify(Object.assign({},VMX('ULT_DEF')[m.t.ability],VMX('HERO_ULT_ART').rafe))+'; skillScaleOpts(ult, lv100) '+JSON.stringify(VMX('skillScaleOpts')(Object.assign({},VMX('ULT_DEF')[m.t.ability],VMX('HERO_ULT_ART').rafe),VMX('skillMul')(100),100))+'; blue scaled '+JSON.stringify(VMX('skillScaleOpts')(Object.assign({},m.blueAb),VMX('skillMul')(100),100)));
