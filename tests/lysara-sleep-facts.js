'use strict';
/* How long Lysara's sleeps really hold in seeded fights (not a test: a measurement, run with plain node on the cluster through tools/remote_test.sh).
   For each build below, over 12 campaign fights and 8 two-sided fights (everyone at skill level 100): every sleep of hers (Queen of Quiet Wings, Drowse, the Hush),
   how long it held (until a hit woke it, its time ran out or the enemy died: her talents' own record of it), how it ended, and the longest time one enemy spent
   stunned in a row while one of her sleeps was on it (the stun-lock measure).
   Run: node tests/lysara-sleep-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,T,V,spec,snaps,build,everything}=require('./talents-lab.js');
const H='lysara', VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
function twoTrees(a,na,b){ let x=build(H,a,na,100); const tr=T.trees(H)[b];
  for(let g=0;g<600&&T.spent(H,x).total<91;g++){ const nx=tr.talents.slice().sort((p,q)=>p[1]-q[1]||p[2]-q[2]).find(t=>T.canLearn(H,x,t[0],100)); if(!nx) break; x=T.learn(H,x,nx[0],100).build; }
  if(T.invalid(H,x,100)) throw new Error('not legal: '+T.invalid(H,x,100)); return T.learned(H,x); }
const B={ 'no talents':null, 'Long Night 91':T.learned(H,build(H,0,91,100)), 'Long Night 61 + Lantern Moth 30':twoTrees(0,61,2), 'every talent':everything(H) };
/* a plain sleep record for the no-talent fights: the ultimate's sleepers (stunned rose at its cast) */
VMX(`var __sf=null, __sfD=_doEffectCore, __sfU=_updateBattleCore;
_doEffectCore=function(u,type,o){ const me=u&&u.key==='lysara'&&type==='quietwings'&&!(o&&o.deliver&&!o._arrived)&&__sf&&!u._tal; let F=null, s0=null; if(me){ F=enemiesOf(u).filter(e=>e.alive); s0=F.map(e=>e.stunned||0); }
  const r=__sfD.apply(this,arguments); if(me) F.forEach((e,i)=>{ if((e.stunned||0)>s0[i]+1e-9) __sf.plain.set(e,{at:battleTime,kind:'ult'}); }); return r; };
_updateBattleCore=function(dt){ const r=__sfU.apply(this,arguments); if(!__sf) return r; const now=battleTime;
  const ly=units.find(x=>x.key==='lysara'); const zz=(ly&&ly._tal&&ly._tal.s.zz)||null;
  if(zz){ for(const k in zz){ if(!__sf.open.has(k)) __sf.open.set(k,{at:zz[k].at,kind:zz[k].kind,t:zz[k].t}); }
    for(const [k,e] of __sf.open){ if(!zz[k]||zz[k].at!==e.at){ __sf.held.push([e.kind,+(now-e.at).toFixed(2),e.t.alive?(((e.t.stunned||0)>0)?'other':'woken or out'):'died']); __sf.open.delete(k); } } }
  for(const [e,p] of __sf.plain){ if(!e.alive||!((e.stunned||0)>0&&(e._sleepT||0)>0)){ __sf.held.push([p.kind,+(now-p.at).toFixed(2),e.alive?'woken or out':'died']); __sf.plain.delete(e); } }
  for(const e of units){ if(e.team===(ly&&ly.team)||!e.alive) continue; const mine=!!(zz&&zz[e.uid])||__sf.plain.has(e); const run=__sf.run.get(e)||{t:0,mine:false};
    if((e.stunned||0)>0){ run.t+=dt; if(mine) run.mine=true; } else { if(run.mine&&run.t>__sf.longest) __sf.longest=run.t; run.t=0; run.mine=false; } __sf.run.set(e,run); }
  return r; };`);
const sn=list=>snaps(['lysara','vael','vireo','sylthaine','gruel'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const name in B){ const s=sn(B[name]); VMX('__sf={held:[],open:new Map(),plain:new Map(),run:new Map(),longest:0}');
  for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) NOW.campaign(JSON.parse(JSON.stringify(s)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
  for(const seed of [5,77,31337,4242]){ NOW.auto(JSON.parse(JSON.stringify(s)),JSON.parse(JSON.stringify(foe)),seed); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(s)),seed); }
  const d=VMX('__sf'), by={}; for(const [k,h,how] of d.held){ const b=by[k]||(by[k]={n:0,h:[],how:{}}); b.n++; b.h.push(h); b.how[how]=(b.how[how]||0)+1; }
  const med=a=>{ const x=a.slice().sort((p,q)=>p-q); return x.length?x[Math.floor(x.length/2)]:0; };
  console.log(name.padEnd(34)+' '+Object.keys(by).map(k=>k+': '+by[k].n+' sleeps, held median '+med(by[k].h)+' s (longest '+Math.max(...by[k].h).toFixed(2)+' s), '+JSON.stringify(by[k].how)).join(' | ')+'; longest one enemy stunned in a row with her sleep on it '+d.longest.toFixed(2)+' s'); }
