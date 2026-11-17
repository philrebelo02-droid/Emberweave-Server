'use strict';
/* Claude's follow-up (15 Nov 2026, after Tharl landed a2599c391): his talents' reduction on ALLIES is one group
   (Curled Around se_2_2 sh.dr 3%/rank on sheltered allies, the signature se_13_2 iron 50% on the nearest ally for 6 s,
   Gravel sb_5_1 dr.gravel 1.5%/rank vs Rubble-covered attackers, Weight on Them rc_5_4 dr.weight 2%/rank vs Buried attackers).
   Landed capped at 50%; measured here Rhukk's worst hit hit 94.5%, so the cap was lowered to 25% (floor 1-ALLY_CAP = 0.75
   in allyK, in line with Linnet/Lumi); re-measured: Rhukk worst 81.2%, Hobb 82.4%, zero hits at 85%+ on either.
   Measure here: in real seeded fights, with a most-defensive-91-points Tharl beside him, the worst hit and the share of a
   fight at 85% or more reduction ON HOBB and ON RHUKK (the two tankiest allies). If the worst hit is 90%+ or the 85% share
   approaches half a fight, the ally cap must come down.
   Run: node tests/tharl-ally95.js   (plain node; the remote runner runs non-.test.js files with plain node) */
const vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='tharl';
const VMX=s=>vm.runInContext(s,NOW.ctx);
const fail=m=>{ console.error('FAIL: '+m); process.exit(1); };

/* the defensive candidate builds, exactly as in tests/talents-mech-tharl.test.js */
const DEF={ se:['se_10_1','se_2_3','se_9_1','se_8_2','se_12_1','se_1_1','se_2_1','se_4_1','se_6_4','se_3_3','se_12_3','se_1_3','se_2_2','se_13_2'],
            sb:['sb_5_1','sb_12_4','sb_8_2','sb_1_1'],
            rc:['rc_4_1','rc_10_3','rc_6_2','rc_n1','rc_5_4','rc_8_2','rc_3_3','rc_9_3','rc_4_3','rc_6_1','rc_1_1','rc_1_2','rc_2_2','rc_1_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={se:0,sb:1,rc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const CANDS=[[['se','rc'],[61,30]],[['se','sb'],[61,30]],[['rc','se'],[61,30]],[['rc','sb'],[61,30]],[['sb','se'],[61,30]],[['sb','rc'],[61,30]],[['se'],[91]],[['sb'],[91]],[['rc'],[91]],[['rc','se','sb'],null]]
  .map(([o,c])=>({o,b:defensive(o,c)}));
for(const c of CANDS){ if(T.invalid(H,c.b,100)!=='') fail('illegal build '+c.o.join('>')); if(T.spent(H,c.b).total!==91) fail('not 91 points: '+c.o.join('>')); c.list=T.learned(H,c.b); }

/* which candidate shelters the ally hardest: force every allyK condition in a still lab and read allyK */
function labAlly(list,allyKey){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]}),spec(allyKey,100,null,0),spec('vael',100,null,0),spec('vael',100,null,0)].concat([0,1].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7);
  const v=U[0], al=U.filter(u=>u.team==='ally'&&u!==v)[0], f=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; al.x=v.x; al.y=v.y-3*V.METER; f.forEach((e,i)=>{ e.x=v.x+[16,0][i]*V.METER; e.y=v.y+[0,5][i]*V.METER; }); V.step(1);
  return {v,al,f,T:v._tal}; }
for(const c of CANDS){ const L=labAlly(c.list,'hobb'), o=L.T.s.th;
  if(!o) fail('no state'); o.sh=[L.al]; o.shT=9; o.iron=6; o.ironA=L.al; o.rub[L.f[0].uid]=9; o.bur[L.f[0].uid]=9; V.step(1);
  const k=L.T.fn.allyK(L.T.s.api,L.T,L.v,L.al,L.f[0]);
  c.allyK=k; c.allyCut=1-k; }
CANDS.sort((a,b)=>a.allyK-b.allyK);
console.log('candidate builds by hardest allyK (sheltered + signature 6 s + Rubble + Buried on the attacker):');
for(const c of CANDS) console.log('  '+c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' allyK '+c.allyK.toFixed(4)+' ('+(c.allyCut*100).toFixed(1)+'% off an ally hit)');
const BEST=CANDS[0];

/* real fights: allies [Tharl(build), TARGET, vael, sylthaine, vireo] vs the standard foe five; instrument hits on TARGET */
function measure(target,list){ const tag='tharl-ally95';
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0,wk:1}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="'+target+'"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; const th=units.find(x=>x&&x.key==="tharl"&&x.alive&&x._tal); const ak=th&&th._tal&&th._tal.s.api?th._tal.fn.allyK(th._tal.s.api,th._tal,th,tgt,src):1; __dr.n++; if(d>__dr.max){ __dr.max=d; __dr.wk=ak; } if(d>=0.95) __dr.at++; if(d>=0.85){ __dr.hi++; if(!__dr["hiK"])__dr.hiK=[]; __dr.hiK.push([+d.toFixed(4),+ak.toFixed(4)]); } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="'+target+'"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const th=units.find(x=>x&&x.key==="tharl"&&x.alive&&x._tal); const T=th&&th._tal, o=T&&T.s.th;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue;'+
    '    const base=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const ak=T&&T.s.api?T.fn.allyK(T.s.api,T,th,u,s):1;'+
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
console.log('Tharl build measured: '+BEST.o.join(' > ')+' '+JSON.stringify(T.spent(H,BEST.b).tree)+' (hardest allyK '+(BEST.allyCut*100).toFixed(1)+'%)');
for(const target of ['hobb','rhukk']){
  const d0=measure(target,null), d=measure(target,BEST.list);
  console.log('');
  console.log('ALLY = '+target.toUpperCase()+' (no talents on him, standing next to that Tharl):');
  console.log('  '+line(d0,'talentless Tharl'));
  console.log('  '+line(d,'most-defensive Tharl'));
  const worst=Math.max(d0.max,d.max), share=Math.max(d0.te85,d.te85)/Math.max(1,Math.max(d0.t,d.t));
  console.log('  -> worst hit '+(worst*100).toFixed(1)+'%, share of a fight at 85%+ '+(100*share).toFixed(1)+'%');
  if(d.wk!==undefined&&d.wk<1) console.log('  (worst-hit decomposition: allyK at that hit '+(d.wk*100).toFixed(1)+'% => the ally\'s own defences left '+((1-worst)/d.wk*100).toFixed(1)+'%)');
  if(d.hiK) console.log('  hits 85%+ (d, allyK): '+JSON.stringify(d.hiK));
  if(worst>=0.90) console.log('  RULE CHECK: worst hit 90% or more - the ally cap must come down.');
  else if(share>=0.35) console.log('  RULE CHECK: near half a fight at 85%+ - consider lowering the ally cap.');
  else console.log('  RULE CHECK: passes (worst under 90%, the 85% share well under half a fight).');
}
