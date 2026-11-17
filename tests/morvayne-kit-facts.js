'use strict';
/* Morvayne's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). His key in the game is 'hero61' (HERO61 in
   hero61.js; his casts are his own code - hero61Cast / hero61Schedule - not _doEffectCore). What his talents build on, in seeded fights with NO talents learned:
   King's Mercy and Shelter of the Crown (casts started, released, cut by a control, cancelled any other way; cast times; whom they heal - himself? the lowest HP
   share? overheal), None Shall Fall (casts, whom it protects, the 4 s of immunity and what it stops), An Open Gate (the armour it gives, who has it), the big
   hits on his allies (more than 10% of their max HP: Knocks), the hits on him (Iron), how far his allies stand (Met on the Road, 4 m and 6 m auras), allies who
   fall (Borne), how often he is the last hero standing (Last Watch) and whether he swings then, his energy.  Run: node tests/morvayne-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __mk={fights:0,ticks:0,alive:0,start:{green:0,blue:0,ult:0},fire:{green:0,blue:0,ult:0},cut:{green:0,blue:0,ult:0},cancel:{green:0,blue:0,ult:0},cutBy:{},'+
  'healSelf:{green:0,blue:0},healAmt:{green:[],blue:[]},healOver:{green:0,blue:0},healOff:{green:0,blue:0},healLowest:{green:0,blue:0},castLen:{green:[],blue:[],ult:[]},'+
  'ultTgt:{self:0,other:0},ultTgtLowest:0,immHits:0,immAmt:0,immDot:0,immDotAmt:0,immAmtShare:[],aura:[],auraHolders:0,auraTicks:0,big:0,bigOnHim:0,hitsOn:0,hitsOnAuto:0,'+
  'far:[],within4:[],beyond6:[],deaths:0,lastT:0,lastSwing:0,lastSwingLow:0,atkOutside:0,energyGain:0,ultEvery:[],fightT:0,waves:0,ccOn:{},stunsOn:0};'+
  'var __mC=hero61Cast, __mX=castCancel, __mH=healFrom, __mD=damage, __mDD=_dealDamageCore, __mU=_updateBattleCore, __mPT=null;'+
  'hero61Cast=function(u,slot,target){ const r=__mC.apply(this,arguments); if(r&&u._pend){ __mk.start[slot]++; const p=u._pend, f=p.fire, t0=__mk.fightT; p.__m={slot,t0}; p.fire=function(){ __mk.fire[slot]++; __mk.castLen[slot].push(+(__mk.fightT-t0).toFixed(2)); __mPT=slot;'+
  '    if(slot==="ult"){ if(target===u) __mk.ultTgt.self++; else __mk.ultTgt.other++; const w=HERO61.weakest(u,units); if(w===target) __mk.ultTgtLowest++; u.__mLastUlt=__mk.fightT; }'+
  '    try{ return f.apply(this,arguments); } finally{ __mPT=null; } }; } return r; };'+
  'castCancel=function(u,why){ const p=u&&u._pend; if(p&&p.__m){ const s=p.__m.slot; if(hero61Controlled(u)){ __mk.cut[s]++; const k=(u.stunned>0?"stun":"")+((u.fearT||0)>0?"fear":"")+((u.silencedT||0)>0?"silence":"")+((u._sleepT||0)>0?"sleep":"")+(u.alive?"":"dead"); __mk.cutBy[k]=(__mk.cutBy[k]||0)+1; } else __mk.cancel[s]++; } return __mX.apply(this,arguments); };'+
  'healFrom=function(s,t,a){ if(s&&s.key==="hero61"&&__mPT&&__mPT!=="ult"){ const sl=__mPT; const h0=t.hp, room=Math.max(0,worldHealCap(t)-t.hp); const r=__mH.apply(this,arguments); const got=t.hp-h0;'+
  '    __mk.healAmt[sl].push(Math.round(a*(s.healPowMul||1))); __mk.healOver[sl]+=Math.max(0,a*(s.healPowMul||1)-got); __mk.healOff[sl]+=a*(s.healPowMul||1); if(t===s) __mk.healSelf[sl]++; return r; } return __mH.apply(this,arguments); };'+
  'damage=function(u,a,c,ne,cr){ if(u&&u.alive&&HERO61.immune(u,battleTime)&&a>0){ if(ne){ __mk.immDot++; __mk.immDotAmt+=a; } else { __mk.immHits++; __mk.immAmt+=a; __mk.immAmtShare.push(+(a/Math.max(1,u.maxHp)).toFixed(3)); } } return __mD.apply(this,arguments); };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const auto=_autoAtk; const h=units.find(x=>x&&x.alive&&x.key==="hero61"); const hp0=tgt?tgt.hp:0, sh0=tgt?(tgt.shield||0):0; const r=__mDD.apply(this,arguments);'+
  '  if(h&&tgt&&src&&tgt.team===h.team&&src.team!==h.team){ const lost=(hp0-tgt.hp)+(sh0-(tgt.shield||0)); if(lost>0.10*tgt.maxHp){ __mk.big++; if(tgt===h) __mk.bigOnHim++; } if(tgt===h){ __mk.hitsOn++; if(auto) __mk.hitsOnAuto++; } }'+
  '  if(src&&src.key==="hero61"&&tgt&&tgt.team!==src.team&&auto){ const al=units.filter(a=>a.alive&&a.team===src.team&&!a._summon&&!(a.t&&a.t.monster)); if(al.length===1){ __mk.lastSwing++; if(src.hp<=src.maxHp*.5) __mk.lastSwingLow++; } else __mk.atkOutside++; }'+
  '  return r; };'+
  '_updateBattleCore=function(dt){ __mk.fightT+=dt; const H=units.filter(u=>u&&u.key==="hero61");'+
  '  for(const u of H){ if(!u.alive) continue; __mk.alive+=dt; __mk.ticks++; const al=HERO61.allies(u,units).filter(a=>a!==u&&!a._summon);'+
  '    if(al.length){ let fd=0; for(const a of al){ const d=(dist(u,a)-bodyR(u)-bodyR(a))/METER; if(d>fd) fd=d; } if(__mk.ticks%30===0){ __mk.far.push(+fd.toFixed(1)); __mk.within4.push(al.filter(a=>(dist(u,a)-bodyR(u)-bodyR(a))/METER<=4).length); __mk.beyond6.push(al.filter(a=>(dist(u,a)-bodyR(u)-bodyR(a))/METER>6).length); } }'+
  '    else __mk.lastT+=dt;'+
  '    if(__mk.ticks%30===0){ const g=HERO61.aura(u,units); __mk.aura.push(g); for(const a of units) if(a.alive&&a.team===u.team&&HERO61.aura(a,units)>0) __mk.auraHolders++; __mk.auraTicks++; }'+
  '    const e0=u.__mE==null?u.energy:u.__mE; if(u.energy>e0) __mk.energyGain+=u.energy-e0; u.__mE=u.energy;'+
  '    for(const f of ["stunned","fearT","silencedT","_sleepT"]){ const was=(u["__m"+f]||0)>0, now=(u[f]||0)>0; if(now&&!was) __mk.ccOn[f]=(__mk.ccOn[f]||0)+1; u["__m"+f]=u[f]||0; } }'+
  '  const r=__mU.apply(this,arguments);'+
  '  return r; };'+
  'var __mR=resetPerWave; resetPerWave=function(){ __mk.waves++; return __mR.apply(this,arguments); };'+
  'var __mDie=null;');
/* deaths of his allies: counted from the units list between ticks */
VMX('var __mSeen=new Set(); var __mU2=_updateBattleCore; _updateBattleCore=function(dt){ const r=__mU2.apply(this,arguments); const h=units.find(x=>x&&x.key==="hero61"); if(h) for(const a of units){ if(a&&a.team===h.team&&a!==h&&!a._summon&&!(a.t&&a.t.monster)&&!a.alive&&!__mSeen.has(a)){ __mSeen.add(a); __mk.deaths++; } } return r; };');
const team=['hero61','vael','sylthaine','vex','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90,120]) for(const seed of [7,1000007,987654]){ VMX('__mk.fights++; __mSeen=new Set()'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337]){ VMX('__mk.fights++; __mSeen=new Set()'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__mk.fights++; __mSeen=new Set()'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__mk');
const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', med=a=>{ if(!a.length) return '-'; const s=a.slice().sort((x,y)=>x-y); return (+s[s.length>>1]).toFixed(2); }, hist=a=>{ const h={}; for(const x of a){ const k=String(x); h[k]=(h[k]||0)+1; } return JSON.stringify(h); }, mx=a=>a.length?Math.max.apply(null,a).toFixed(2):'-';
console.log('fights '+c.fights+', waves ended '+c.waves+'; Morvayne alive '+c.alive.toFixed(0)+' s of '+c.fightT.toFixed(0)+' s of fight; alone (no other hero of his side alive) '+c.lastT.toFixed(1)+' s');
for(const s of ['green','blue','ult']) console.log(s+': started '+c.start[s]+', released '+c.fire[s]+', cut by a control '+c.cut[s]+', cancelled otherwise '+c.cancel[s]+'; press-to-release (s) median '+med(c.castLen[s])+' min '+(c.castLen[s].length?Math.min.apply(null,c.castLen[s]).toFixed(2):'-')+' max '+mx(c.castLen[s]));
console.log('cut by '+JSON.stringify(c.cutBy)+'; controls landing on him '+JSON.stringify(c.ccOn));
for(const s of ['green','blue']) console.log(s+' heals: on himself '+c.healSelf[s]+' of '+c.fire[s]+'; heal offered median '+med(c.healAmt[s])+' max '+mx(c.healAmt[s])+'; overheal '+(100*c.healOver[s]/Math.max(1,c.healOff[s])).toFixed(0)+'% of offered');
console.log('ult: on himself '+c.ultTgt.self+', on another '+c.ultTgt.other+'; the target was also the lowest HP share '+c.ultTgtLowest+'; damage stopped by the immunity: hits '+c.immHits+' ('+c.immAmt.toFixed(0)+'; each as a share of max HP median '+med(c.immAmtShare)+' max '+mx(c.immAmtShare)+'), other damage() calls '+c.immDot+' ('+c.immDotAmt.toFixed(0)+'); a cast stops '+(c.fire.ult?((c.immAmt+c.immDotAmt)/c.fire.ult).toFixed(0):'-'));
console.log('An Open Gate: the armour it gives '+hist(c.aura)+'; units holding it per sample '+(c.auraHolders/Math.max(1,c.auraTicks)).toFixed(2));
console.log('big hits (>10% of max HP after shields) on his side '+c.big+' ('+(c.big/Math.max(1,c.fightT)).toFixed(3)+' a second; on him '+c.bigOnHim+'); hits on him '+c.hitsOn+' ('+(c.hitsOn/Math.max(1,c.alive)).toFixed(2)+' a second alive; basic attacks '+c.hitsOnAuto+')');
console.log('farthest ally (m, body to body) median '+med(c.far)+' max '+mx(c.far)+'; allies within 4 m '+hist(c.within4)+'; allies beyond 6 m '+hist(c.beyond6));
console.log('allies who fell '+c.deaths+'; his swings while alone '+c.lastSwing+' (at or below half HP '+c.lastSwingLow+'), while not alone '+c.atkOutside+'; energy gained '+(c.energyGain/Math.max(1,c.alive)).toFixed(2)+' a second alive');
/* the still field: what each cast does on known places */
{ const L=V.arena(snaps([Object.assign(spec('hero61',100),{skillLv:[100,100,100,100]}),spec('vael',100),spec('vael',100)]),snaps([spec('vael',100)]),7), m=L[0], A=L.filter(u=>u.team==='ally'&&u!==m), F=L.filter(u=>u.team==='enemy');
  for(const u of L){ u.stunned=1e6; u.level=1; u.ctrlRes=0; } F[0].maxHp=F[0].hp=1e9; m.stunned=0; m.atkCd=1e9;
  A[0].hp=A[0].maxHp*0.5; A[1].hp=A[1].maxHp*0.8; console.log('still field: Morvayne max HP '+Math.round(m.maxHp)+' apow '+Math.round(m.apow||0)+' healPowMul '+(m.healPowMul||1)+' armour '+m.armorRating+' mr '+m.mrRating+' pass '+JSON.stringify(m.pass)+' skillLv '+JSON.stringify(m.skillLv)+' greenAb '+JSON.stringify(m.greenAb)+' blueAb '+JSON.stringify(m.blueAb)+' energy '+m.energy+' range '+(m.range/V.METER).toFixed(2)+' m melee '+m.melee+' atkInterval '+(m.atkInterval||0).toFixed(3)+' body '+V.bodyR(m).toFixed(2)+' m');
  console.log('  aura on A0 '+VMX('HERO61.aura')(A[0],L)+'; A0 armour rating '+A[0].armorRating+' -> armour now '+VMX('unitArmorNow')(A[0]).toFixed(1));
  const hp0=A[0].hp; let t=0; while(t<2.5){ V.step(1); t+=V.STEP; } console.log('  after 2.5 s: A0 healed '+(A[0].hp-hp0).toFixed(0)+' (expected green '+VMX('HERO61.healAmount')('green',100,A[0],m).toFixed(0)+' / blue '+VMX('HERO61.healAmount')('blue',100,A[0],m).toFixed(0)+'), pend '+JSON.stringify(m._pend&&{slot:m._pend.hero61Slot,t:m._pend.t})+', blueCd '+m.blueCd+', rec '+(m._h61Rec||0).toFixed(2));
  m.energy=100; A[0].hp=A[0].maxHp*0.3; t=0; while(t<1.5){ V.step(1); t+=V.STEP; } console.log('  ult: A0 immune until '+(A[0]._openGateImmuneUntil||0).toFixed(2)+' (now '+V.now().toFixed(2)+'), A1 '+(A[1]._openGateImmuneUntil||0)+', him '+(m._openGateImmuneUntil||0)+', energy '+m.energy); }
console.log('CAST '+JSON.stringify(VMX('HERO61.CAST'))+'; anim '+JSON.stringify(VMX('(function(){ const A=BATTLE_ANIM.hero61||{}; const o={}; for(const k of ["green","blue","ult"]) if(A[k]) o[k]={n:A[k].n,contact:A[k].contact}; return o; })()'))+'; SPELL_ENERGY '+VMX('SPELL_ENERGY'));
