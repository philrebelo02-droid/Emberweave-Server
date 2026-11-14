'use strict';
/* Dandra's real kit in real fights, with NO talents (not a test: a measurement, run with plain node). Counts, over seeded fights with her in the
   line-up (campaign stages and two-sided fights, everyone at skill level 100):
   - Drowsy Sting: casts; casts that found their enemy already stung (the only way it puts an enemy to sleep); sleeps that landed; how long each
     sleep really held (until the stun field ran out or a hit woke it), and who woke it (Dandra herself, another unit);
   - The Swarm Moves On: enemies that died while carrying her sting's poison, and how many enemies her bees moved on to;
   - Seedlight and Queen's Call casts.
   Run: node tests/talents-dandra-kit-probe.js */
const {NOW,spec,snaps}=require('./talents-lab.js'), vm=require('node:vm'), path=require('node:path'), fs=require('node:fs');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX(`var __dp={sting:0,onStung:0,slept:0,resist:0,held:[],wokeBy:{dandra:0,other:0,time:0},deaths:0,moved:0,spreadEv:0,seed:0,ult:0,stungAtCast:[],sleeping:[],gap:[]};
var __dpD=_doEffectCore, __dpH=_dealDamageCore, __dpU=_updateBattleCore, __dpP=plagueDot;
_doEffectCore=function(u,type,o){ const me=u&&u.key==='dandra'&&u.team==='ally';
  if(me&&type==='drowsy'&&o&&o._arrived){ const t=o._tgtU||u.target; __dp.sting++; const s=t?(t._stungT||0):0; __dp.stungAtCast.push(+s.toFixed(2)); if(s>0) __dp.onStung++;
    const r=__dpD.apply(this,arguments); if(t&&s>0){ if((t.stunned||0)>0){ __dp.slept++; __dp.sleeping.push({t,at:battleTime}); } else __dp.resist++; } return r; }
  if(me&&type==='mendburst') __dp.seed++; if(me&&type==='rally') __dp.ult++;
  return __dpD.apply(this,arguments); };
_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const was=tgt&&(tgt._sleepT||0)>0&&(tgt.stunned||0)>0; const r=__dpH.apply(this,arguments);
  if(was&&!((tgt.stunned||0)>0)){ for(let i=0;i<__dp.sleeping.length;i++) if(__dp.sleeping[i].t===tgt){ __dp.held.push(+(battleTime-__dp.sleeping[i].at).toFixed(2)); __dp.sleeping.splice(i,1); if(src&&src.key==='dandra') __dp.wokeBy.dandra++; else __dp.wokeBy.other++; break; } } return r; };
_updateBattleCore=function(dt){ const r=__dpU.apply(this,arguments); for(let i=0;i<__dp.sleeping.length;i++){ const e=__dp.sleeping[i]; if(!e.t.alive||!((e.t.stunned||0)>0)){ __dp.held.push(+(battleTime-e.at).toFixed(2)); __dp.wokeBy.time++; __dp.sleeping.splice(i--,1); } }
  for(const x of units){ if(x&&!x.alive&&!x.__dpSeen&&x.team==='enemy'){ x.__dpSeen=1; if(x._plagueColor==='#f2d84a'&&x.dots&&x.dots.some(d=>d.color==='#f2d84a')){ __dp.deaths++; let m=1e9; for(const e of units) if(e!==x&&e.alive&&e.team===x.team) m=Math.min(m,Math.hypot(e.x-x.x,e.y-x.y)/METER); __dp.gap.push(+m.toFixed(2)); } } } return r; };
plagueDot=function(t,dps,dur,iv,color){ if(color==='#f2d84a') __dp.moved++; return __dpP.apply(this,arguments); };`);
const TEAM=['vael','sylthaine','vireo','vex','dandra'], sn=snaps(TEAM.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
let fights=0;
for(const node of [12,34,60,90,120]) for(const seed of [1,2,3]){ NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); fights++; }
const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [3,5,8,13,21]){ NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); fights++; }
const d=VMX('__dp'), H=d.held.slice().sort((a,b)=>a-b), med=H.length?H[Math.floor(H.length/2)]:0, st=d.stungAtCast.filter(x=>x>0);
console.log('fights '+fights);
console.log('Drowsy Sting casts '+d.sting+'; on an enemy already stung '+d.onStung+' (stung time left at those casts: '+JSON.stringify(st)+'); sleeps landed '+d.slept+', resisted '+d.resist);
console.log('sleep held (s): '+JSON.stringify(H)+'  median '+med+'; woken by Dandra '+d.wokeBy.dandra+', by another unit '+d.wokeBy.other+', ran out / target died '+d.wokeBy.time);
console.log('The Swarm Moves On: enemies died carrying her sting poison '+d.deaths+'; bees moved on to '+d.moved+' enemies');
console.log('  nearest other enemy (centre to centre, m) at each of those deaths: '+JSON.stringify(d.gap.slice().sort((a,b)=>a-b))+' (the passive reaches 2.6 m centre to centre)');
console.log('Seedlight casts '+d.seed+', Queen\'s Call casts '+d.ult);
