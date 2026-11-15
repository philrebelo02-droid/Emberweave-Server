'use strict';
/* Claude's standing rule (15 Nov 2026, after Tharl/Tolley): a hero whose talents protect ALLIES must be measured on the two tankiest
   allies (Hobb, Rhukk). Umbris's ally group is alK (talents-mech/umbris.js): Fading (dr.fade vs rotting attackers, sd_7_1),
   Night Eyes (dr.ne vs dimmed attackers, wl_6_4), The Dim Hour (dr.dh vs attackers inside his zone, wl_12_3) - one multiplicative
   group floored at 1-DR_AL = 0.85, so at most 15% off an ally hit. Measure here: in real seeded fights, with a most-defensive
   91-points Umbris beside him, the worst hit and the share of a fight at 85% or more reduction ON HOBB and ON RHUKK.
   If the worst hit is 90%+ or the 85% share approaches half a fight, the ally cap must come down.
   Run: node tests/umbris-ally95.js   (plain node; the remote runner runs non-.test.js files with plain node) */
const vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='umbris';
const VMX=s=>vm.runInContext(s,NOW.ctx);
const fail=m=>{ console.error('FAIL: '+m); process.exit(1); };

/* the defensive candidate builds, exactly as in tests/talents-mech-umbris.test.js */
const DEF={ sd:['sd_7_1'],
            wl:['wl_6_4','wl_12_3','wl_11_4','wl_12_4','wl_9_4','wl_3_4','wl_1_4','wl_11_2'],
            oc:['oc_10_4','oc_12_1','oc_11_4','oc_1_2','oc_10_2','oc_8_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sd:0,wl:1,oc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const CANDS=[[['wl','oc'],[61,30]],[['oc','wl'],[61,30]],[['wl','sd'],[61,30]],[['oc','sd'],[61,30]],[['sd','wl'],[61,30]],[['sd','oc'],[61,30]],[['wl'],[91]],[['oc'],[91]],[['sd'],[91]],[['oc','wl','sd'],null]]
  .map(([o,c])=>({o,b:defensive(o,c)}));
for(const c of CANDS){ if(T.invalid(H,c.b,100)!=='') fail('illegal build '+c.o.join('>')); if(T.spent(H,c.b).total!==91) fail('not 91 points: '+c.o.join('>')); c.list=T.learned(H,c.b); }

/* which candidate shelters the ally hardest: force every alK condition (a rotted + dimmed attacker inside his zone) in a still
   lab and read alK; the ally cut is 1-alK, floored at the 15% ally cap */
function labAlly(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]}),spec('hobb',100,null,0),spec('vael',100,null,0),spec('vael',100,null,0)].concat([0,1].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7);
  const v=U[0], f=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; }
  V.step(1);
  return {v,f,T:v._tal}; }
for(const c of CANDS){ const L=labAlly(c.list);
  L.T.s.um.e[L.f[0].uid]={th:0,keep:0,zT:0,dimL:0,dim:true,rot:true,cr:false,inF:false,inZ:true,sh:0,en:0,lt:0,lw:0,rg:null,cs:0};
  const k=L.T.fn.alK(null,L.T,L.v,L.f[0]);
  c.allyK=k; c.allyCut=1-k; }
CANDS.sort((a,b)=>a.allyK-b.allyK);
console.log('candidate builds by hardest alK (a rotted + dimmed attacker inside his zone):');
for(const c of CANDS) console.log('  '+c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' alK '+c.allyK.toFixed(4)+' ('+(c.allyCut*100).toFixed(1)+'% off an ally hit)');
const BEST=CANDS[0];

/* real fights: allies [Umbris(build), TARGET, vael, sylthaine, vireo] vs the standard foe five; instrument hits on TARGET */
function measure(target,list){ const tag='umbris-ally95';
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0,wk:1}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="'+target+'"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; const th=units.find(x=>x&&x.key==="umbris"&&x.alive&&x._tal); const ak=th&&th._tal?th._tal.fn.alK(th._tal.s.api,th._tal,th,src):1; __dr.n++; if(d>__dr.max){ __dr.max=d; __dr.wk=ak; } if(d>=0.95) __dr.at++; if(d>=0.85){ __dr.hi++; if(!__dr["hiK"])__dr.hiK=[]; __dr.hiK.push([+d.toFixed(4),+ak.toFixed(4)]); } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="'+target+'"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const th=units.find(x=>x&&x.key==="umbris"&&x.alive&&x._tal); const T=th&&th._tal;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue;'+
    '    const base=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const ak=T&&T.s?T.fn.alK(T.s.api,T,th,s):1;'+
    '    const kp=base*defMul(s,u,"phys")*ak, km=base*defMul(s,u,"magic")*ak;'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  try{ VMX('for(const k in __dr) __dr[k]=0');
    const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps([H,target,'vael','sylthaine','vireo'].map(sp));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    return JSON.parse(JSON.stringify(VMX('__dr')));
  } finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc; delete __dr;'); } }

const pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
const line=(x,tag)=>tag+': '+x.n+' hits on him, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85%+ phys '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
console.log('');
console.log('Umbris build measured: '+BEST.o.join(' > ')+' '+JSON.stringify(T.spent(H,BEST.b).tree)+' (hardest alK '+(BEST.allyCut*100).toFixed(1)+'%)');
for(const target of ['hobb','rhukk']){
  const d0=measure(target,null), d=measure(target,BEST.list);
  console.log('');
  console.log('ALLY = '+target.toUpperCase()+' (no talents on him, standing next to that Umbris):');
  console.log('  '+line(d0,'talentless Umbris'));
  console.log('  '+line(d,'most-defensive Umbris'));
  const worst=Math.max(d0.max,d.max), share=Math.max(d0.te85,d.te85)/Math.max(1,Math.max(d0.t,d.t));
  console.log('  -> worst hit '+(worst*100).toFixed(1)+'%, share of a fight at 85%+ '+(100*share).toFixed(1)+'%');
  if(d.wk!==undefined&&d.wk<1) console.log('  (worst-hit decomposition: alK at that hit '+(d.wk*100).toFixed(1)+'% => the ally\'s own defences left '+((1-worst)/d.wk*100).toFixed(1)+'%)');
  if(d.hiK) console.log('  hits 85%+ (d, alK): '+JSON.stringify(d.hiK));
  if(worst>=0.90) console.log('  RULE CHECK: worst hit 90% or more - the ally cap must come down.');
  else if(share>=0.35) console.log('  RULE CHECK: near half a fight at 85%+ - consider lowering the ally cap.');
  else console.log('  RULE CHECK: passes (worst under 90%, the 85% share well under half a fight).');
}
