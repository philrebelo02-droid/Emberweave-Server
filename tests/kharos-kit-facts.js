'use strict';
/* Kharos Bloomknife's real kit, measured (not a test: run with plain node on the cluster test host). What his talents build on: how often each of his skills
   fires and what it reaches, how often Petal Sever's wound really ruptures (its stacks lapse 6 s after the last; its cooldown is 6 s), what Bloomstep's
   counter and its window-end strike reach, what Orchid Execution's health bonus is at the cast, how much of his time Perfect Camouflage is up and what
   ends it, and the two new talent states' raw material: enemies near him that are not attacking him (Onlookers), and enemy basic attacks that reach him
   from close (Overreach). Run: node tests/kharos-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __kk={ps:0,psHit:0,psStk:[0,0,0,0],rup:0,bs:0,ctr:0,ctrHit:0,wend:0,wendHit:0,jumps:0,ult:0,ultBonus:[],ultHpF:[],camOn:0,camTicks:0,ticks:0,camBreakHit:0,camBreakEvade:0,camHitsOn:0,camMiss:0,onl:[0,0,0,0,0],onlTicks:0,over:0,overMelee:0,hitsOn:0,autos:0,gap:[],back:0,alive:0,deaths:0,dodgeEva:0,ultTgtLow:0,blueDr:[],psOpt:null,bsOpt:null,energyUlt:[]};'+
  'var __kD=_doEffectCore, __kB=addBleedStack, __kU=_updateBattleCore, __kDD=_dealDamageCore, __kJ=bloomstepJump, __kG=damage;'+
  'var __km=u=>u&&u.key==="kharos", __kIn=0;'+
  '_doEffectCore=function(u,type,o){ if(__km(u)&&(!o||!o.deliver||o._arrived)){'+
  '  if(type==="bleedstack"){ __kk.ps++; if(!__kk.psOpt){ const sm=u._castSM||1; __kk.psOpt=JSON.stringify(skillScaleOpts(Object.assign({},o),sm,(u._castLv|0)||1)); } }'+
  '  if(type==="evadecounter"){ __kk.bs++; if(!__kk.bsOpt){ const sm=u._castSM||1; __kk.bsOpt=JSON.stringify(Object.assign(skillScaleOpts(Object.assign({},o),sm,(u._castLv|0)||1),{_sm:sm,_drMul:skLvNum("evadecounter",o,(u._castLv|0)||1)})); } }'+
  '  if(type==="execute"){ __kk.ult++; const t=(u.target&&u.target.alive)?u.target:nearestEnemy(u); if(t){ const f=t.hp/t.maxHp; __kk.ultHpF.push(+f.toFixed(2)); __kk.ultBonus.push(+(1+(1-f)*2).toFixed(2)); if(f<0.4) __kk.ultTgtLow++; } } }'+
  '  return __kD.apply(this,arguments); };'+
  'addBleedStack=function(src,tgt,o){ if(__km(src)&&tgt&&tgt.alive){ const k=Math.min(3,tgt._blStk||0); __kk.psStk[k]++; if((tgt._blStk||0)+1>=((o&&o.rupture)||3)) __kk.rup++; } return __kB.apply(this,arguments); };'+
  'bloomstepJump=function(u,T){ if(__km(u)){ __kk.jumps++; if(__kIn) __kk.ctr++; else __kk.wend++; } return __kJ.apply(this,arguments); };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ __kIn++; try{'+
  '  if(__km(src)&&tgt&&tgt.team!==src.team){ if(_autoAtk){ __kk.autos++; __kk.gap.push(+((dist(src,tgt)-bodyR(src)-bodyR(tgt))/METER).toFixed(1)); if((typeof _laneDepthOf==="function")&&_laneDepthOf(tgt.key)>=3) __kk.back++; } if(color==="#bfe8ff"){ if(__kIn>1) __kk.ctrHit++; else __kk.wendHit++; } if(color==="#8f8fa8"||color==="#ff5b6b") __kk.psHit++; }'+
  '  if(__km(tgt)&&src&&src.team!==tgt.team){ __kk.hitsOn++; if(tgt._camOn){ __kk.camHitsOn++; if((tgt._evadeT||0)>0) __kk.camBreakEvade++; else __kk.camBreakHit++; } if(_autoAtk&&(dist(src,tgt)-bodyR(src)-bodyR(tgt))<2*METER){ __kk.over++; if(src.melee) __kk.overMelee++; } }'+
  '  return __kDD.apply(this,arguments); } finally{ __kIn--; } };'+
  'damage=function(u,a,c,s){ const was=u&&u.alive; const r=__kG.apply(this,arguments); if(was&&__km(u)&&!u.alive) __kk.deaths++; return r; };'+
  '_updateBattleCore=function(dt){ for(const k of units){ if(!__km(k)||!k.alive) continue; __kk.ticks++; if(k._camOn){ __kk.camTicks++; if(!k.__co) __kk.camOn++; } k.__co=!!k._camOn;'+
  '    let n=0; for(const e of units){ if(!e.alive||e.team===k.team||e._noTarget) continue; if(dist(k,e)-bodyR(k)-bodyR(e)<3*METER&&e.target!==k) n++; } __kk.onl[Math.min(4,n)]++; if(n) __kk.onlTicks++; if((k.drT||0)>0&&k.drMul<1) __kk.blueDr.push(+k.drMul.toFixed(4)); }'+
  '  return __kU.apply(this,arguments); };');
const team=['kharos','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
const foe=snaps(['ambrel','fritz','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__kk'), med=a=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?[s[0],s[s.length>>1],s[s.length-1]].join(' / '):'-'; };
console.log('Petal Sever casts '+c.ps+' (hits by it, strike + rupture '+c.psHit+'); stacks it found on the target before each stack [0,1,2,3+] '+JSON.stringify(c.psStk)+'; RUPTURES '+c.rup+'; options at level 100 '+c.psOpt);
console.log('Bloomstep casts '+c.bs+': counters on a hit '+c.ctr+' (landed '+c.ctrHit+'), window-end strikes '+c.wend+' (landed '+c.wendHit+'), jumps '+c.jumps+'; options '+c.bsOpt+'; skill slot while it holds (min/med/max) '+med(c.blueDr));
console.log('Orchid Execution casts '+c.ult+'; target HP share at the cast '+med(c.ultHpF)+'; health bonus x '+med(c.ultBonus)+'; targets below 40% '+c.ultTgtLow);
console.log('Perfect Camouflage: came up '+c.camOn+' times, up '+(100*c.camTicks/Math.max(1,c.ticks)).toFixed(1)+'% of his ticks ('+c.ticks+'); enemy hits that reached him while up '+c.camHitsOn+' (inside Bloomstep\'s window '+c.camBreakEvade+')');
console.log('hits on him '+c.hitsOn+'; enemy basic attacks reaching him from within 2 m (body to body) '+c.over+' (melee '+c.overMelee+'); deaths '+c.deaths);
console.log('Onlookers (enemies within 3 m body to body not targeting him), ticks with 0..4+: '+JSON.stringify(c.onl)+'; ticks with at least one '+(100*c.onlTicks/Math.max(1,c.ticks)).toFixed(1)+'%');
console.log('his basic attacks '+c.autos+' (on the back rank '+c.back+'); gap body to body to the target (min / median / max m) '+med(c.gap));
const L=V.arena(snaps([Object.assign(spec('kharos',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), g=L[0];
console.log('body radius '+V.bodyR(g).toFixed(2)+' m (Vael '+V.bodyR(L[1]).toFixed(2)+'); attack interval '+g.atkInterval.toFixed(3)+' s; profile '+g.t.damageProfile+'; melee '+g.melee+'; range '+g.range+'; pass '+JSON.stringify(g.pass)+'; passMul '+g.passMul+'; maxHp '+Math.round(g.maxHp)+' atk '+Math.round(g.dmg)+' armor '+g.armorRating+'; greenAb '+JSON.stringify(g.greenAb)+'; blueAb '+JSON.stringify(g.blueAb)+'; ult '+JSON.stringify(VMX('ULT_DEF.execute'))+' art '+JSON.stringify(VMX('HERO_ULT_ART.kharos'))+'; skillMul(100) '+VMX('skillMul')(100)+'; METER '+V.METER+'; kind of #8f8fa8 '+VMX('dotDmgKind')(g,'#8f8fa8')+'; castTime green '+VMX('castTimeFor')(g,'green')+' blue '+VMX('castTimeFor')(g,'blue'));
