'use strict';
/* Seyla Silkcoil's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on, with NO talents
   learned, in 20 seeded fights (12 campaign, 8 two-sided), Seyla at skill level 100: her swings and Venom Rhythm's bites (every third swing), Ribbon Fang (its stacks
   and how often it ruptures), Hooded Feint (its window and how often an enemy hit spends it), Serpent's Last Dance (passes, enemies struck, executions), the enemies
   that attack her (how often the same enemy swings at her twice within 4 s: Read), how many enemies stand within 3 m of her (Crowd), how often her hits land on an
   enemy that is facing someone else (the flank), and how often the ally beside her in the line-up attacks her target.
   Run: node tests/seyla-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __sk={fights:0,ticks:0,swings:0,bites:0,blows:0,blowCrit:0,flank:0,myHits:0,rf:0,rfHit:0,rfStk:{},rupt:0,rfSame:0,rfGap:[],hf:0,hfSpent:0,hfCounter:0,hfExpired:0,sd:0,sdPass:[],sdFoes:[],sdExec:0,sdBoss:0,'+
  'onMe:0,onMeAuto:0,onMeSkill:0,onMeRanged:0,onMeFromTgt:0,reads:0,third:0,thirdAny:0,biteGap:[],sim:{},attackers:{},crowd:{},crowd4:{},crowd5:{},crowd6:{},er:[],partner:0,partnerOf:0,nrg:0,venomT:0,enemyT:0,lowHp:0,mortalT:0,waves:0};'+
  'var __skD=_doEffectCore, __skH=_dealDamageCore, __skU=_updateBattleCore, __skB=addBleedStack, __skCur=null, __skN=0, __skFoes=null, __skAt=new Map(), __skRd=new Map(), __skRf=new Map(), __skVr=new Map(), __skEv=new Map(), __skBt=new Map();'+
  'addBleedStack=function(src,tgt,o){ const me=src&&src.key==="seyla"; const was=tgt?(tgt._blStk||0):0; const r=__skB.apply(this,arguments); if(me&&tgt){ const n=tgt._blStk||0; if(n===0&&was>=2) __sk.rupt++; else __sk.rfStk[n]=(__sk.rfStk[n]||0)+1; } return r; };'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="seyla"&&(!o||!o.deliver||o._arrived);'+
  '  if(me){ __skCur=type; __skN=0; if(type==="bleedstack"){ __sk.rf++; const t=u.target; if(t){ const L=__skRf.get(t); if(L!=null){ __sk.rfGap.push(+(battleTime-L).toFixed(2)); } __skRf.set(t,battleTime); } }'+
  '    if(type==="evadecounter") __sk.hf++;'+
  '    if(type==="serpentdance"){ __sk.sd++; const R=(o&&o.radius)||3*METER; __sk.sdFoes.push(enemiesOf(u).filter(e=>dist(u,e)<=R+(e.r||0)).length); } }'+
  '  try{ return __skD.apply(this,arguments); } finally{ if(me){ if(type==="bleedstack") __sk.rfHit+=__skN; __skCur=null; } } };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const auto=!!_autoAtk, mine=src&&src.key==="seyla"&&tgt&&tgt.team!==src.team, me=tgt&&tgt.key==="seyla"&&src&&src.team!==tgt.team;'+
  '  if(mine){ if(auto){ __sk.blows++; } else if(__skCur) __skN++; __sk.myHits++; if(tgt.target!==src) __sk.flank++; if(color==="#5ee89b"&&__skFoes) __skFoes.n++; }'+
  '  let ev0=0; if(me){ __sk.onMe++; if(auto) __sk.onMeAuto++; else __sk.onMeSkill++; if(!src.melee) __sk.onMeRanged++; if(tgt.target===src) __sk.onMeFromTgt++; ev0=tgt._evadeT||0; __sk.attackers[src.uid]=1;'+
  '    if(auto){ const k=src.uid, L=__skAt.get(k)||[]; L.push(battleTime); while(L.length&&L[0]<battleTime-4-1e-9) L.shift(); __skAt.set(k,L); const rd=__skRd.get(k);'+
  '      if(rd!=null){ __sk.thirdAny++; if(battleTime-rd<=6) __sk.third++; __skRd.delete(k); __skAt.set(k,[]); } else if(L.length>=2){ __sk.reads++; __skRd.set(k,battleTime); __skAt.set(k,[]); } } }'+
  '  const f0=floatTexts.length; const r=__skH.apply(this,arguments);'+
  '  if(mine&&auto){ for(let i=f0;i<floatTexts.length;i++) if(floatTexts[i].txt==="EXECUTED") __sk.sdExec++; }'+
  '  if(mine&&!auto){ for(let i=f0;i<floatTexts.length;i++) if(floatTexts[i].txt==="EXECUTED"){ __sk.sdExec++; if(tgt.t&&tgt.t.isboss) __sk.sdBoss++; } }'+
  '  if(me&&ev0>0&&!((tgt._evadeT||0)>0)){ __sk.hfSpent++; } return r; };'+
  '_updateBattleCore=function(dt){ const N=units.filter(u=>u&&u.key==="seyla"&&u.alive), e0=N.map(u=>u.energy||0), ev0=N.map(u=>u._evadeT||0), dn0=N.map(u=>(u._danceT||0)>0);'+
  '  for(const u of N){ __sk.ticks++; let c=0,c4=0,c5=0,c6=0; for(const e of units){ if(!e.alive||e.team===u.team) continue; __sk.enemyT++; if((e.mortalT||0)>0) __sk.mortalT++; const gp=dist(u,e)-bodyR(u)-bodyR(e); if(gp<3*METER) c++; if(gp<4*METER) c4++; if(gp<5*METER) c5++; if(gp<6*METER) c6++; if(__sk.er.length<5) __sk.er.push(e.r); } __sk.crowd[c]=(__sk.crowd[c]||0)+1; __sk.crowd4[c4]=(__sk.crowd4[c4]||0)+1; __sk.crowd5[c5]=(__sk.crowd5[c5]||0)+1; __sk.crowd6[c6]=(__sk.crowd6[c6]||0)+1; if(u.hp<0.4*u.maxHp) __sk.lowHp++; }'+
  '  const r=__skU.apply(this,arguments);'+
  '  N.forEach((u,i)=>{ if(u.alive&&(u.energy||0)>e0[i]) __sk.nrg+=(u.energy||0)-e0[i]; if(ev0[i]>0&&!((u._evadeT||0)>0)&&ev0[i]<=dt+1e-9) __sk.hfExpired++;'+
  '    const v0=__skVr.get(u), v=u._vrN||0; if(v0!=null&&v!==v0){ __sk.swings++; if(v===0){ __sk.bites++; const t=u.target; if(t){ const B=__skBt.get(t); if(B){ __sk.biteGap.push(+(battleTime-B.t).toFixed(2)); for(const D of [6,8,10,12,15,20]){ const k=B.n[D]=(battleTime-B.t<=D)?Math.min(5,(B.n[D]||0)+1):1; if(k>=5) __sk.sim[D]=(__sk.sim[D]||0)+1; } B.t=battleTime; } else { const n={}; for(const D of [6,8,10,12,15,20]) n[D]=1; __skBt.set(t,{t:battleTime,n}); } } }'+
  '      const al=units.filter(x=>x.team===u.team&&!x._summon), i0=al.indexOf(u), nb=[al[i0-1],al[i0+1]].filter(x=>x&&x.alive); __sk.partnerOf++; if(u.target&&nb.some(x=>x.target===u.target)) __sk.partner++; } __skVr.set(u,v);'+
  '    if(!dn0[i]&&(u._danceT||0)>0){ if(__skFoes) __sk.sdPass.push(__skFoes.n); __skFoes={n:0}; } if(dn0[i]&&!((u._danceT||0)>0)&&__skFoes){ __sk.sdPass.push(__skFoes.n); __skFoes=null; } });'+
  '  return r; };');
const team=['seyla','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
const done=()=>VMX('__skBt=new Map(); __skAt=new Map(); __skRd=new Map(); __skRf=new Map(); __skVr=new Map(); if(__skFoes){ __sk.sdPass.push(__skFoes.n); __skFoes=null; }');
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__sk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); done(); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__sk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); done(); VMX('__sk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); done(); }
const c=VMX('__sk'), step=VMX('SIM_STEP'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); },
  q=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?(+s[Math.min(s.length-1,Math.floor(p*s.length))]).toFixed(2):'-'; }, pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
const alive=c.ticks*step;
console.log('fights '+c.fights+'; Seyla alive '+alive.toFixed(0)+' s in all; swings '+c.swings+' ('+(c.swings/Math.max(1,alive)).toFixed(2)+' a second), Venom Rhythm bites '+c.bites+' ('+pc(c.bites,c.swings)+' of swings), basic-attack blows '+c.blows+'; energy gained '+Math.round(c.nrg)+' ('+(c.nrg/Math.max(1,alive)).toFixed(2)+' a second)');
console.log('her hits on enemies '+c.myHits+', on an enemy whose target is not her (the flank) '+c.flank+' ('+pc(c.flank,c.myHits)+')');
console.log('Ribbon Fang: '+c.rf+' casts, hits '+c.rfHit+'; stacks after each wound '+JSON.stringify(c.rfStk)+', ruptures '+c.rupt+'; seconds between two casts on the same target: median '+q(c.rfGap,0.5)+', min '+q(c.rfGap,0)+' '+hist(c.rfGap.map(x=>Math.round(x))));
console.log('Hooded Feint: '+c.hf+' casts; windows spent by an enemy hit '+c.hfSpent+', ran out unspent '+c.hfExpired);
console.log("Serpent's Last Dance: "+c.sd+' casts; enemies inside its circle at the cast '+hist(c.sdFoes)+'; passes that struck an enemy per cast '+hist(c.sdPass)+'; executions '+c.sdExec+' (bosses '+c.sdBoss+')');
console.log('hits aimed at her that reached the hit code '+c.onMe+' (basic attacks '+c.onMeAuto+', skills '+c.onMeSkill+'; from ranged units '+c.onMeRanged+'; from the enemy she was attacking '+c.onMeFromTgt+'); different attackers '+Object.keys(c.attackers).length);
console.log('Read (the same enemy swings at her twice within 4 s): '+c.reads+' times; its third swing came within 6 s '+c.third+' times');
console.log('bites: seconds since the last bite on the same enemy: median '+q(c.biteGap,0.5)+', quartiles '+q(c.biteGap,0.25)+' / '+q(c.biteGap,0.75)+', n '+c.biteGap.length+' '+hist(c.biteGap.map(x=>Math.min(30,Math.round(x)))) +'; bites that would find the enemy at 5 Toxin if Toxin lasted D s after the last bite: '+JSON.stringify(c.sim));
console.log('Crowd (enemies within 3 m of her, body to body) share of her time: '+JSON.stringify(Object.fromEntries(Object.entries(c.crowd).map(([k,v])=>[k,pc(v,c.ticks)]))));
for(const k of ['crowd4','crowd5','crowd6']) console.log(k+' (within '+k.slice(5)+' m): '+JSON.stringify(Object.fromEntries(Object.entries(c[k]).map(([a,v])=>[a,pc(v,c.ticks)])))); console.log('enemy e.r samples '+JSON.stringify(c.er)+'; Read whose third swing came at any later time this wave '+c.thirdAny);
console.log('the ally beside her in the line-up attacked her target on '+pc(c.partner,c.partnerOf)+' of her swings; enemies under a healing cut (mortalT, anyone\'s) '+pc(c.mortalT,c.enemyT)+' of enemy-time; she was below 40% HP '+pc(c.lowHp,c.ticks)+' of her time');
const L=V.arena(snaps([Object.assign(spec('seyla',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7);
console.log('Seyla: body radius '+V.bodyR(L[0]).toFixed(2)+' m, attack interval '+L[0].atkInterval.toFixed(3)+' s, max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', crit '+L[0].glyphCrit+', crit damage '+L[0].critDmg+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passMul '+L[0].passMul+'; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb)+', isboss field '+JSON.stringify(Object.keys(L[0].t||{}).filter(k=>/boss/.test(k))));
