'use strict';
/* Grimsby's real kit, measured (not a test: run with plain node on the cluster test host). What his talents build on: how often each of his skills fires,
   how many enemies Ledger Slam reaches (4 m around him today; around his target as v1391 will have it), how often Overdue's burst when a debtor dies
   and Compound Interest's 5 m aura really act, how far apart he and the enemies he fights stand. Run: node tests/grimsby-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __gk={od:0,odStk6:0,ls:0,lsHit:0,lsTgt:0,lsTgtN:0,fc:0,fcHit:0,deaths:0,debtDeaths:0,burst:0,burstHit:0,ciAll:0,ciNear:0,ciOwnAll:0,ciOwnNear:0,dotT:0,dotNear:0,gap:[],tgtD:[],notices:0,noticeFull:0,odDeathCarry:0,fcDeathCarry:0,stkMax:[]};'+
  'var __gD=_doEffectCore, __gP=pushDot, __gU=_updateBattleCore, __gG=damage, __gDD=_dealDamageCore;'+
  'var __gm=u=>u&&u.key==="grimsby";'+
  '_doEffectCore=function(u,type,o){ if(__gm(u)&&(!o||!o.deliver||o._arrived)){'+
  '  if(type==="debtmark") __gk.od++;'+
  '  if(type==="pullsilence"){ __gk.ls++; const R=(o&&o.radius)||5*METER; let n=0; for(const e of enemiesOf(u)) if(dist(u,e)<=R) n++; __gk.lsHit+=n; if(n>0) __gk.lsTgt++;'+
  '    const t=(o._arrived&&o._tgtU)?o._tgtU:((u.target&&u.target.alive)?u.target:null); if(t){ let m=0; for(const e of enemiesOf(u)) if(dist(t,e)<=R) m++; __gk.lsTgtN+=m; __gk.tgtD.push(+(dist(u,t)/METER).toFixed(1)); } }'+
  '  if(type==="aoedot"){ __gk.fc++; __gk.fcHit+=enemiesOf(u).length; } } return __gD.apply(this,arguments); };'+
  'pushDot=function(t,dps,dur,iv,color,src,kind){ if(t&&typeof units!=="undefined"){ const g=units.find(x=>x.alive&&x.pass&&x.pass.debtaura&&x.team!==t.team); if(g){ __gk.ciAll++; const nr=Math.hypot(g.x-t.x,g.y-t.y)<5*METER; if(nr) __gk.ciNear++; if(src===g){ __gk.ciOwnAll++; if(nr) __gk.ciOwnNear++; } } } return __gP.apply(this,arguments); };'+
  'damage=function(u,a,c,s){ const was=u&&u.alive; const r=__gG.apply(this,arguments); if(was&&u&&!u.alive&&u.team!=null){ const g=units.find(x=>x.alive&&x.key==="grimsby"&&x.team!==u.team); if(g){ __gk.deaths++; if((u._debtStk||0)>0&&u._debtOwner===g){ __gk.debtDeaths++; let n=0; for(const e of units) if(e.alive&&e!==u&&e.team===u.team&&Math.hypot(e.x-u.x,e.y-u.y)<3*METER) n++; if(n>0) __gk.burst++; __gk.burstHit+=n; }'+
  '  if((u.dots||[]).some(d=>d.src===g&&d.color==="#8a7a3a")) __gk.odDeathCarry++; if((u.dots||[]).some(d=>d.src===g&&d.color==="#ffa657")) __gk.fcDeathCarry++; __gk.stkMax.push(u._debtStk||0); } } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(__gm(src)&&_autoAtk&&tgt) __gk.gap.push(+((dist(src,tgt)-bodyR(src)-bodyR(tgt))/METER).toFixed(1)); return __gDD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ for(const g of units){ if(!__gm(g)||!g.alive) continue; for(const e of units){ if(!e.alive||e.team===g.team||!e.dots) continue; for(const d of e.dots){ if(d.src!==g) continue; __gk.dotT++; if(Math.hypot(g.x-e.x,g.y-e.y)<5*METER) __gk.dotNear++; if(d.color==="#8a7a3a"&&d.remaining===1&&d.acc+dt>=d.interval) __gk.noticeFull++; } if((e._debtStk||0)>=6&&e._debtOwner===g&&!e.__g6){ e.__g6=1; __gk.odStk6++; } } } return __gU.apply(this,arguments); };');
const team=['grimsby','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
const foe=snaps(['ambrel','fritz','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337]){ NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__gk'), med=a=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?[s[0],s[s.length>>1],s[s.length-1]].join(' / '):'-'; };
console.log('Overdue casts '+c.od+'; notices that ran their full time '+c.noticeFull+'; enemies that reached 6 stacks '+c.odStk6);
console.log('Ledger Slam casts '+c.ls+': hit someone (around him) '+c.lsTgt+', enemies caught in all '+c.lsHit+'; around his target it would catch '+c.lsTgtN+'; distance to his target (min / median / max m) '+med(c.tgtD));
console.log('Foreclosure casts '+c.fc+', enemies standing at the cast '+c.fcHit);
console.log('enemy deaths while he stood '+c.deaths+': carrying his Overdue stacks '+c.debtDeaths+' (stacks at death min / median / max '+med(c.stkMax)+'); carrying a running notice '+c.odDeathCarry+'; carrying a Foreclosure DoT '+c.fcDeathCarry);
console.log('Overdue burst (a debtor dies): '+c.burst+' bursts reached anyone, '+c.burstHit+' enemies in all');
console.log('Compound Interest: DoTs pushed on his enemies '+c.ciAll+', within his 5 m '+c.ciNear+'; his own '+c.ciOwnAll+', within 5 m '+c.ciOwnNear);
console.log('his DoT enemy-ticks '+c.dotT+', within 5 m of him '+c.dotNear);
console.log('his basic attacks '+c.gap.length+'; gap body to body to the target (min / median / max m) '+med(c.gap));
const L=V.arena(snaps([Object.assign(spec('grimsby',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), g=L[0];
console.log('body radius '+V.bodyR(g).toFixed(2)+' m (Vael '+V.bodyR(L[1]).toFixed(2)+'); attack interval '+g.atkInterval.toFixed(3)+' s; profile '+g.t.damageProfile+'; melee '+g.melee+'; pass '+JSON.stringify(g.pass)+'; passLv '+VMX('passLv')(g)+'; debtaura '+VMX('SKLV.debtaura')(VMX('passLv')(g))+'; METER '+V.METER+'; UNIT_SIZE '+VMX('UNIT_SIZE')+'; maxHp '+Math.round(g.maxHp)+' atk '+Math.round(g.dmg)+'; greenAb '+JSON.stringify(g.greenAb)+'; blueAb '+JSON.stringify(g.blueAb)+'; ccDur(2) '+VMX('ccDur')(2)+'; silence cap '+VMX('CC_DUR_MAX').silencedT);
