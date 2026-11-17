'use strict';
/* What Nox's talents cost (run on the cluster through tools/remote_test.sh as a plain node script): 50 seeded campaign fights (5 stages x 10 seeds), a level-100
   team of Vael, Sylthaine, Vireo, Vex and Nox at skill level 100, for each build below, measured twice in alternation. Prints ms of computer time per
   second of fight, the fights won and the digest of the no-talent runs (it must be the same every time). */
const vm=require('node:vm');
const {NOW,T,spec,snaps,everything,build}=require('./talents-lab.js');
const H='nox', ENC=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
const VMX=s=>vm.runInContext(s,NOW.ctx);
function twoTrees(a,na,b){ let x=build(H,a,na,100); const tr=T.trees(H)[b];
  for(let g=0;g<600&&T.spent(H,x).total<91;g++){ const nx=tr.talents.slice().sort((p,q)=>p[1]-q[1]||p[2]-q[2]).find(t=>T.canLearn(H,x,t[0],100)); if(!nx) break; x=T.learn(H,x,nx[0],100).build; }
  if(T.invalid(H,x,100)) throw new Error('not legal: '+T.invalid(H,x,100)); return T.learned(H,x); }
const B={ none:null, all:everything(H), 'legal FE61+JB30':twoTrees(0,61,1), 'legal JB61+LF30':twoTrees(1,61,2), 'legal LF61+FE30':twoTrees(2,61,0), 'FE91':T.learned(H,build(H,0,91,100)), 'JB91':T.learned(H,build(H,1,91,100)), 'LF91':T.learned(H,build(H,2,91,100)) };
VMX('var __cs={t:0}; var __cu=_updateBattleCore; _updateBattleCore=function(dt){ __cs.t+=dt; return __cu.apply(this,arguments); };');
function run(list){ const sn=snaps(['vael','sylthaine','vireo','vex','nox'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))); let won=0, dg='';
  VMX('__cs.t=0'); const t0=process.hrtime.bigint();
  for(const node of [12,34,60,90,120]) for(let seed=1;seed<=10;seed++){ const r=NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed*7919,[[0,'auto',-1,1,null,null]]); if(r.won) won++; dg+=r.digest; }
  const ms=Number(process.hrtime.bigint()-t0)/1e6, fs=VMX('__cs.t'); let h=0; for(let i=0;i<dg.length;i++) h=(h*31+dg.charCodeAt(i))>>>0;
  return {ms,fs,won,h:h.toString(16)}; }
const res={}; for(const k in B) res[k]=[];
for(let pass=0;pass<2;pass++) for(const k in B){ const r=run(B[k]); res[k].push(r); console.log(k.padEnd(18)+' pass '+pass+': '+(r.ms/r.fs).toFixed(2)+' ms per second of fight ('+r.ms.toFixed(0)+' ms, '+r.fs.toFixed(0)+' s of fight), won '+r.won+' of 50, digest '+r.h); }
const base=res.none.reduce((a,r)=>a+r.ms/r.fs,0)/res.none.length;
for(const k in res){ const m=res[k].reduce((a,r)=>a+r.ms/r.fs,0)/res[k].length; console.log('SUMMARY '+k.padEnd(18)+' mean '+m.toFixed(2)+' ms/s ('+(k==='none'?'base':((m/base-1)*100>=0?'+':'')+((m/base-1)*100).toFixed(0)+'%')+'), won '+res[k].map(r=>r.won).join(' / ')); }
