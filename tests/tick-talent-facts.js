'use strict';
/* How often Tick's talent mechanics really happen (not a test: a plain node script, run on the cluster through tools/remote_test.sh): each tree at 91 and
   every talent, in 12 seeded campaign fights and 4 two-sided ones, skill level 100. Per fight: Chimes, the Hour (every 4th Chime), discharges, Overclocks,
   the most Wind and Strain, Only the Clockmaker, Strokes and Hours reached, Spin, Flywheel casts and the enemies they reached, It Does Not Mind, his basic
   attacks. Run: node tests/tick-talent-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,T,spec,snaps,everything,build}=require('./talents-lab.js');
const H='tick', VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __tf=null; var __tfU=_updateBattleCore, __tfD=_doEffectCore;'+
  '_doEffectCore=function(u,type,o){ if(__tf&&u&&u.key==="tick"&&type==="flywheel"){ __tf.fw++; __tf.fwHit+=enemiesOf(u).filter(e=>e.alive&&dist(u,e)<(o&&o.radius||3*METER)).length; } return __tfD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ if(__tf) for(const u of units){ if(!(u&&u.key==="tick"&&u._tal&&u._tal.s.tk)) continue; const k=u._tal.s.tk; __tf.t+=u.alive?dt:0;'+
  '    for(const f of ["chN","dis","hours","strokes","wind","strain","spin","gs","auto"]) __tf[f]=Math.max(__tf[f]||0,k[f]||0); if(k.sig2>0&&!__tf.on2){ __tf.on2=1; __tf.sig2++; } if(!(k.sig2>0)) __tf.on2=0;'+
  '    if(k.sig3>0&&!__tf.on3){ __tf.on3=1; __tf.sig3++; } if(k.oc>0&&!__tf.onO){ __tf.onO=1; __tf.oc++; } if(!(k.oc>0)) __tf.onO=0; if(k.hours>=12) __tf.t12+=dt; if(k.wind>=10-1e-9) __tf.sw10=Math.max(__tf.sw10||0,k.strain); if(k.wind>=8-1e-9) __tf.sw8=Math.max(__tf.sw8||0,k.strain); }'+
  '  return __tfU.apply(this,arguments); };');
const B={ SQ91:T.learned(H,build(H,0,91,100)), KB91:T.learned(H,build(H,1,91,100)), BW91:T.learned(H,build(H,2,91,100)), all:everything(H) };
for(const name in B){ const sn=snaps(['tick','vael','vireo','sylthaine','gruel'].map(k=>Object.assign(spec(k,100,k===H?B[name]:null),{skillLv:[100,100,100,100]}))); const rows=[];
  const one=f=>{ VMX('__tf={t:0,t12:0,fw:0,fwHit:0,sig2:0,sig3:0,oc:0}'); f(); rows.push(JSON.parse(JSON.stringify(VMX('__tf')))); };
  for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) one(()=>NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]));
  const foe=snaps(['absalie','astra','vireo','sylthaine','vex'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
  for(const seed of [5,77]){ one(()=>NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed)); one(()=>NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed)); }
  const avg=f=>(rows.reduce((a,r)=>a+(r[f]||0),0)/rows.length).toFixed(1), mx=f=>Math.max(...rows.map(r=>r[f]||0));
  console.log(name.padEnd(5)+' per fight (mean / max): alive '+avg('t')+' s; basic attacks counted '+avg('auto')+' / '+mx('auto')+'; Chimes '+avg('chN')+' / '+mx('chN')+'; discharges '+avg('dis')+' / '+mx('dis')+'; Overclocks '+avg('oc')+
    '; Wind max '+avg('wind')+', Strain max '+avg('strain')+'; Clockmaker '+avg('sig2')+' / '+mx('sig2')+'; Strokes '+avg('strokes')+' / '+mx('strokes')+', Hours '+avg('hours')+' / '+mx('hours')+' (s at 12: '+avg('t12')+'); Spin '+avg('spin')+'; Flywheels '+avg('fw')+', enemies in reach '+avg('fwHit')+'; It Does Not Mind '+avg('sig3')+'; most Strain while Wind is 10 / 8: '+avg('sw10')+' / '+avg('sw8')); }
