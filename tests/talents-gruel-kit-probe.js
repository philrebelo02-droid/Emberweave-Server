'use strict';
/* Gruel's real kit in seeded fights, with no talents (a measurement for the decisions file, not a test; run with plain node):
   Coinflail casts and the enemies it strikes; Weigh the Debt casts, whom the debtor's hits land on (Gruel or his allies) and how many are COLLECTED;
   The Reckoning casts and how many it taunts; the share of fight time Gluttony has nothing to heal (Gruel at full HP).
   20 fights: 15 campaign (5 stages x 3 seeds) and 5 two-sided, a level-100 team with Gruel at skill level 100.
   Run: node tests/talents-gruel-kit-probe.js */
const {NOW,spec,snaps}=require('./talents-lab.js'), vm=require('node:vm'), path=require('node:path'), fs=require('node:fs');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __gk={cf:0,cfHit:0,cfMiss:0,cfNear:[],wd:0,onG:0,onA:0,col:0,rk:0,taunted:0,ticks:0,full:0}; var __gD=_doEffectCore, __gH=_dealDamageCore, __gU=_updateBattleCore, __gcf=null;'+
  '_doEffectCore=function(u,type,o){ const g=u&&u.key==="gruel"; if(g&&type==="cleavecone"&&o&&(o._arrived||!o.deliver)){ __gk.cf++; __gcf={n:0}; let nd=1e9; for(const e of units) if(e.alive&&e.team!==u.team) nd=Math.min(nd,dist(u,e)/METER); __gk.cfNear.push(nd); }'+
  '  const r=__gD.apply(this,arguments); if(g&&__gcf&&type==="cleavecone"){ if(__gcf.n>0) __gk.cfHit++; else __gk.cfMiss++; __gcf=null; }'+
  '  if(g&&type==="weighdebt") __gk.wd++; if(g&&type==="taunt"){ __gk.rk++; for(const e of units) if(e.alive&&e.team!==u.team&&e.forcedTarget===u) __gk.taunted++; } return r; };'+
  '_dealDamageCore=function(src,tgt){ if(__gcf&&src&&src.key==="gruel"&&tgt&&tgt.team!==src.team) __gcf.n++;'+
  '  if(src&&(src._debtT||0)>0&&src._debtTo&&src._debtTo.key==="gruel"&&src._debtTo.alive&&tgt&&tgt.team===src._debtTo.team){ if(tgt===src._debtTo) __gk.onG++; else { __gk.onA++; __gk.col++; } } return __gH.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ for(const u of units) if(u&&u.alive&&u.key==="gruel"&&u.team==="ally"){ __gk.ticks++; if(u.hp>=worldHealCap(u)-1e-9) __gk.full++; } return __gU.apply(this,arguments); };');
const team=['gruel','vael','vireo','sylthaine','vex'], sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90,120]) for(const seed of [7,11,13]){ const e=ENC.find(x=>x.node===node); if(e) NOW.campaign(JSON.parse(JSON.stringify(sn)),e.waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [3,5,8,13,21]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
const k=VMX('__gk'), nn=k.cfNear.slice().sort((a,b)=>a-b), q=p=>nn.length?nn[Math.min(nn.length-1,Math.floor(p*nn.length))].toFixed(2):'-';
console.log('Gruel kit probe (no talents, 20 fights):');
console.log('  Coinflail: '+k.cf+' casts, struck someone '+k.cfHit+', nobody '+k.cfMiss+'; nearest enemy at the cast (centre to centre, m): min '+q(0)+', median '+q(0.5)+', max '+q(1));
console.log('  Weigh the Debt: '+k.wd+' casts; the debtor\'s hits while In Debt: on Gruel '+k.onG+' (not cut), on his allies '+k.onA+' (each a COLLECTED)');
console.log('  The Reckoning: '+k.rk+' casts, '+k.taunted+' enemies taunted ('+(k.rk?(k.taunted/k.rk).toFixed(2):'-')+' a cast)');
console.log('  Gluttony with nothing to heal (Gruel at full HP): '+(100*k.full/Math.max(1,k.ticks)).toFixed(1)+'% of his time alive ('+k.ticks+' ticks)');
