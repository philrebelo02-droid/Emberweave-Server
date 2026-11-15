'use strict';
/* The controls for Vaelora's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a site made
   unguarded with a seeded draw, a row or a number of hers broken), runs the named tests of tests/talents-mech-vaelora.test.js in that copy, and expects them to
   FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. J=1 by default: one copy at a
   time, each deleted as soon as it has run (the wiring brief's rule). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page site: the freeze-roll hook names no enemy (her tests that read it fail) ----
  ['the freeze roll names no enemy',HTML,"TalentFx.num(u,'blizzFreeze',0.10,e)","TalentFx.num(u,'blizzFreeze',0.10)",'/ freezes'],
  // ---- an unguarded seeded draw at the page site (the no-talent identity test fails) ----
  ['draw at the blizzFreeze site',HTML,"if(brnd()<((u._tal&&u._tal.on.num)?TalentFx.num(u,'blizzFreeze',0.10,e):0.10)","if(brnd()<((brnd(),u._tal&&u._tal.on.num)?TalentFx.num(u,'blizzFreeze',0.10,e):0.10)",'no talents'],
  // ---- Stalk ----
  ['Stalk stops at 0',FXJ,"if(stN(T,'vlStalk')<5) A.stSet","if(stN(T,'vlStalk')<0) A.stSet",'/ Stalk'],
  ['Stalk not per-stack',FXJ,"pc_1_1:[ {stat:{crit:R(0.002)},per:'vlStalk'} ]","pc_1_1:[ {stat:{crit:R(0.002)}} ]",'/ Stalk'],
  // ---- Sulk ----
  ['Sulk 3% -> 4%',FXJ,"pc_1_4:[ {param:'sulk.dr',add:R(0.03)}, {param:'sulk.ff',add:R(0.03)} ]","pc_1_4:[ {param:'sulk.dr',add:R(0.04)}, {param:'sulk.ff',add:R(0.04)} ]",'/ Sulk'],
  ['Sulk 2 s',FXJ,"v.sulk=3+(P['sulk.len']||0);","v.sulk=2+(P['sulk.len']||0);",'/ Sulk'],
  ['Pout double',FXJ,"A.eng().healUnit(u,P.pout*u.maxHp);","A.eng().healUnit(u,P.pout*2*u.maxHp);",'/ Sulk'],
  ["Cat's Grudge 2% -> 3%",FXJ,"pc_6_4:[ {param:'grudge',add:R(0.02)} ]","pc_6_4:[ {param:'grudge',add:R(0.03)} ]",'/ Sulk'],
  // ---- Kept Height / Silent Pounce / Second Strike ----
  ['Kept Height 11 s',FXJ,"v.kh=KH_CD;","v.kh=KH_CD+1;",'/ Kept Height'],
  ['Silent Pounce on every hit',FXJ,"evaded&&P.spo","false&&P.spo",'/ Kept Height'],
  ['Second Strike off',FXJ,"if(P.ss2&&c.crit){ u._untouched=Math.max(3,u._untouched||0); v.spl=0; }","if(P.ss2&&c.crit&&u.hp<0){ u._untouched=Math.max(3,u._untouched||0); v.spl=0; }",'/ Kept Height'],
  // ---- Barbed Patience ----
  ['Barbed Patience 10%',FXJ,"u.greenCd=Math.max(0,cur-(was-cur)*0.05);","u.greenCd=Math.max(0,cur-(was-cur)*0.10);",'/ Barbed Patience'],
  ['the LINK no 2 Quills on a crit',FXJ,"if(P.bpq&&c.crit) n=2; else if(P.barb&&A.eng().rnd()<P.barb) n=2;","if(P.bpq&&c.crit) n=1; else if(P.barb&&A.eng().rnd()<P.barb) n=2;",'/ Barbed Patience'],
  // ---- Featherfang: First/Last ----
  ['First Feather on everyone',FXJ,"if(P.ff1&&v.ff.idx[t.uid]===0){ c.force=true; return; }","if(P.ff1){ c.force=true; return; }",'/ Featherfang: First Feather'],
  ['Last Feather 5% a step',FXJ,"if(P.ffL){ const i=f.idx[t.uid]; if(i>0) k*=1+0.10*i; }","if(P.ffL){ const i=f.idx[t.uid]; if(i>0) k*=1+0.05*i; }",'/ Featherfang: First Feather'],
  ['Featherfang Edge 4% -> 5%',FXJ,"pc_2_2:[ {on:'out',if:{casting:FF},critMore:R(0.04)} ]","pc_2_2:[ {on:'out',if:{casting:FF},critMore:R(0.05)} ]",'/ Featherfang: First Feather'],
  ['Far Throw 3% -> 4%',FXJ,"pc_4_2:[ {on:'out',if:{casting:FF,fn:'far6'},more:R(0.03)} ]","pc_4_2:[ {on:'out',if:{casting:FF,fn:'far6'},more:R(0.04)} ]",'/ Featherfang: First Feather'],
  ['Heavy Ring 3% -> 4%',FXJ,"wc_2_2:[ {on:'out',if:{casting:FF},more:R(0.03)} ]","wc_2_2:[ {on:'out',if:{casting:FF},more:R(0.04)} ]",'/ Featherfang: First Feather'],
  ['Ice Claw 6% -> 5%',FXJ,"tw_6_1:[ {on:'out',if:{casting:FF,targetHpBelow:0.5},more:R(0.06)} ]","tw_6_1:[ {on:'out',if:{casting:FF,targetHpBelow:0.5},more:R(0.05)} ]",'/ Featherfang: First Feather'],
  ['Frost Fang 4% -> 5%',FXJ,"tw_11_4:[ {on:'out',if:{casting:FF,fn:'lastCtr'},more:R(0.04)} ]","tw_11_4:[ {on:'out',if:{casting:FF,fn:'lastCtr'},more:R(0.05)} ]",'/ Featherfang: First Feather'],
  ['Clean Kill 3% -> 4%',FXJ,"pc_9_2:[ {on:'out',if:{casting:FF,targetHpBelow:0.40},more:R(0.03)} ]","pc_9_2:[ {on:'out',if:{casting:FF,targetHpBelow:0.40},more:R(0.04)} ]",'/ Featherfang: First Feather'],
  // ---- Featherfang: The Long Wait / Moult ----
  ['The Long Wait 2% -> 3%',FXJ,"pc_n2:[ {param:'lw',add:R(0.02)} ]","pc_n2:[ {param:'lw',add:R(0.03)} ]",'/ Featherfang: The Long Wait'],
  ['The Long Wait 4 s at most',FXJ,"v.lws=Math.min(5,v.lws+1);","v.lws=Math.min(4,v.lws+1);",'/ Featherfang: The Long Wait'],
  ['Moult 30%',FXJ,"if(f.mo) k*=1.40;","if(f.mo) k*=1.30;",'/ Featherfang: The Long Wait'],
  ['Moult 2 Quills',FXJ,"if(f.mo) n=Q_MAX; else {","if(f.mo) n=Q_MAX-1; else {",'/ Featherfang: The Long Wait'],
  // ---- Featherfang: Cold Ring group ----
  ['Cold Ring 4% -> 5%',FXJ,"wc_3_3:[ {param:'cring',add:R(0.04)} ]","wc_3_3:[ {param:'cring',add:R(0.05)} ]",'/ Featherfang: Cold Ring'],
  ['Biting Ring 6% -> 5%',FXJ,"wc_4_3:[ {on:'out',if:{casting:FF,fn:'ringSlow'},more:R(0.06)} ]","wc_4_3:[ {on:'out',if:{casting:FF,fn:'ringSlow'},more:R(0.05)} ]",'/ Featherfang: Cold Ring'],
  ['Wide Ring smaller',FXJ,"wc_4_2:[ {on:'kit',skill:FF,opt:{width:{more:R(0.08)}}} ]","wc_4_2:[ {on:'kit',skill:FF,opt:{width:{more:R(0.05)}}} ]",'/ Featherfang: Cold Ring'],
  ["Owl's Return half ignored",FXJ,"A.hurt(T,u,e,0.5*a,'#bfefff');","A.hurt(T,u,e,0.5*a*0.8,'#bfefff');",'/ Featherfang: Cold Ring'],
  ['Twin Rings 70%',FXJ,"wc_5_4:[ {param:'twin',add:1}, {on:'kit',skill:FF,opt:{mul:{mul:0.6}}} ]","wc_5_4:[ {param:'twin',add:1}, {on:'kit',skill:FF,opt:{mul:{mul:0.7}}} ]",'/ Featherfang: Cold Ring'],
  ['Finishing Ring on anyone',FXJ,"if(P.fin&&f.kill&&!f.re&&u.alive){ const t=A.pick(T,u,{team:'enemy',order:'lowHp',n:1},{u})[0];","if(P.fin&&f.kill&&!f.re&&u.alive){ const t=A.pick(T,u,{team:'enemy',order:'highHp',n:1},{u})[0];",'/ Featherfang: Cold Ring'],
  // ---- Quills ----
  ['Quills 2% -> 3%',FXJ,"wc_1_4:[ {param:'q.dmg',add:R(0.02)} ]","wc_1_4:[ {param:'q.dmg',add:R(0.03)} ]",'/ Quills: from'],
  ['Quills max 2',FXJ,"r.q=Math.min(Q_MAX,set?Math.max(was,n):was+n);","r.q=Math.min(Q_MAX-1,set?Math.max(was,n):was+n);",'/ Quills: from'],
  ['Quills melt a second sooner',FXJ,"r.qt=Q_DUR+(T.P['q.dur']||0);","r.qt=Q_DUR-1+(T.P['q.dur']||0);",'/ Quills: from'],
  ['Barbed Quills 2 s a rank',FXJ,"wc_2_4:[ {param:'q.dur',add:R(1)} ]","wc_2_4:[ {param:'q.dur',add:R(2)} ]",'/ Quills: from'],
  ['Quilled Through 3% -> 4%',FXJ,"wc_6_4:[ {stat:{move:R(-0.03)},to:{team:'enemy',fn:'q3'}} ]","wc_6_4:[ {stat:{move:R(-0.04)},to:{team:'enemy',fn:'q3'}} ]",'/ Quills: from'],
  ['Ice in the Barbs 10%',FXJ,"wc_8_4:[ {param:'barb',add:R(0.2)} ]","wc_8_4:[ {param:'barb',add:R(0.1)} ]",'/ Quills: from'],
  ['Frost Paws 25%',FXJ,"wc_12_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},chance:R(0.15),do:[{fn:'q1'}]} ]","wc_12_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},chance:R(0.25),do:[{fn:'q1'}]} ]",'/ Quills: from'],
  ['Ice Barbs 0.5% -> 0.6%',FXJ,"wc_11_4:[ {on:'teamIn',if:{targetTeam:'enemy',fn:'ibOk'},more:R(0.005),per:{fn:'qN'}} ]","wc_11_4:[ {on:'teamIn',if:{targetTeam:'enemy',fn:'ibOk'},more:R(0.006),per:{fn:'qN'}} ]",'/ Quills: from'],
  // ---- Quill Freeze / Torn Out ----
  ['Quill Freeze 0.9 s',FXJ,"if(T.fn.tstun(A,T,u,t,0.8,'qf'))","if(T.fn.tstun(A,T,u,t,0.9,'qf'))",'/ Quill Freeze'],
  ['Quill Freeze lock 9 s',FXJ,"r.qfl=QF_LOCK;","r.qfl=QF_LOCK+1;",'/ Quill Freeze'],
  ['Torn Out 0.2x a Quill',FXJ,"T.fn.mdmg(A,T,u,t,0.3*(u.apow||0)*q);","T.fn.mdmg(A,T,u,t,0.2*(u.apow||0)*q);",'/ Quill Freeze'],
  // ---- Plumage (feathers) ----
  ['no feather from Featherfang',FXJ,"f.hits.push([t,c.amt||0]); T.fn.addFea(A,T,u,1);","f.hits.push([t,c.amt||0]);",'/ Plumage'],
  ['a feather 0.2% apow',FXJ,"wc_1_1:[ {stat:{apow:R(0.001)},per:'vlFea'} ]","wc_1_1:[ {stat:{apow:R(0.002)},per:'vlFea'} ]",'/ Plumage'],
  ['White Mantle 2% mr',FXJ,"wc_3_1:[ {stat:{mr:R(0.01)},per:{fn:'fea5'}} ]","wc_3_1:[ {stat:{mr:R(0.02)},per:{fn:'fea5'}} ]",'/ Plumage'],
  ['Fluffed Up 0.6%',FXJ,"wc_4_1:[ {param:'dr.fluff',add:R(0.005)} ]","wc_4_1:[ {param:'dr.fluff',add:R(0.006)} ]",'/ Plumage'],
  ['Full Plumage 3% -> 4%',FXJ,"wc_6_1:[ {on:'out',if:{fn:'fullFea'},more:R(0.03)} ]","wc_6_1:[ {on:'out',if:{fn:'fullFea'},more:R(0.04)} ]",'/ Plumage'],
  ['Moulting 3 a rank',FXJ,"wc_2_1:[ {param:'moult0',add:R(2)} ]","wc_2_1:[ {param:'moult0',add:R(3)} ]",'/ Plumage'],
  ['Preening keeps half',FXJ,"const kept=v.waves>1?Math.min(stN(T,'vlFea'),P.preen||0):0;","const kept=v.waves>1?Math.min(stN(T,'vlFea'),(P.preen||0)/2):0;",'/ Plumage'],
  ['Shed Feathers off',FXJ,"wc_8_1:[ {param:'shed',add:R(1)} ]","wc_8_1:[ {param:'shed',add:R(0)} ]",'/ Plumage'],
  // ---- Winter Plumage rows ----
  ['Feather Storm 3% -> 4%',FXJ,"pc_7_3:[ {on:'out',if:{fn:'tick'},more:R(0.03)} ]","pc_7_3:[ {on:'out',if:{fn:'tick'},more:R(0.04)} ]",'/ Winter Plumage: Feather Storm'],
  ['Rime Wings 3% -> 4%',FXJ,"wc_8_3:[ {on:'out',if:{fn:'tick'},more:R(0.03)} ]","wc_8_3:[ {on:'out',if:{fn:'tick'},more:R(0.04)} ]",'/ Winter Plumage: Feather Storm'],
  ['Feather Weight 1% -> 2%',FXJ,"wc_12_3:[ {on:'out',if:{fn:'tick'},more:R(0.01),per:{fn:'qN'}} ]","wc_12_3:[ {on:'out',if:{fn:'tick'},more:R(0.02),per:{fn:'qN'}} ]",'/ Winter Plumage: Feather Storm'],
  ['Hunting Storm at 20% HP',FXJ,"tw_7_2:[ {on:'out',if:{fn:'tick',targetHpBelow:0.5},more:R(0.03)} ]","tw_7_2:[ {on:'out',if:{fn:'tick',targetHpBelow:0.2},more:R(0.03)} ]",'/ Winter Plumage: Feather Storm'],
  ['Wide Storm num hook off',FXJ,"pc_8_3:[ {on:'num',skill:'blizzR',addM:R(0.2)}, {param:'st.r',add:R(0.2)} ]","pc_8_3:[ {on:'num',skill:'blizzX',addM:R(0.2)}, {param:'st.r',add:R(0.2)} ]",'/ Winter Plumage: Feather Storm'],
  ['Frozen Patience 4% -> 5%',FXJ,"pc_11_2:[ {on:'out',if:{fn:'tickSA'},more:R(0.04)} ]","pc_11_2:[ {on:'out',if:{fn:'tickSA'},more:R(0.05)} ]",'/ Winter Plumage: Feather Storm'],
  // ---- freezes ----
  ['Frozen Through 0.2 s a rank',FXJ,"wc_9_3:[ {param:'ft',add:R(0.1)} ]","wc_9_3:[ {param:'ft',add:R(0.2)} ]",'/ freezes'],
  ['Winter Hunt 3%',FXJ,"tw_11_3:[ {param:'wh',add:R(0.02)} ]","tw_11_3:[ {param:'wh',add:R(0.03)} ]",'/ freezes'],
  ['Brittle Prey 2% -> 3%',FXJ,"pc_12_2:[ {on:'out',if:{fn:'frozen'},critMore:R(0.02)} ]","pc_12_2:[ {on:'out',if:{fn:'frozen'},critMore:R(0.03)} ]",'/ freezes'],
  ["Owl's Gift no 7th tick",FXJ,"if(P.gift&&(r.sh===1||r.sh===4||r.sh===7)&&Math.ceil(r.sh/3)<=P.gift)","if(P.gift&&(r.sh===1||r.sh===4)&&Math.ceil(r.sh/3)<=P.gift)",'/ freezes'],
  ['Late Winters 3%',FXJ,"wc_7_1:[ {param:'lwin',add:R(0.02)} ]","wc_7_1:[ {param:'lwin',add:R(0.03)} ]",'/ freezes'],
  // ---- Snowfall Hush / Moor Feast ----
  ['Snowfall Hush 4%',FXJ,"wc_12_2:[ {stat:{atk:R(-0.03),apow:R(-0.03)},to:{team:'enemy',fn:'inStorm'}} ]","wc_12_2:[ {stat:{atk:R(-0.04),apow:R(-0.04)},to:{team:'enemy',fn:'inStorm'}} ]",'/ Snowfall Hush'],
  ['Moor Feast 3%',FXJ,"tw_12_3:[ {param:'mf',add:R(0.02)} ]","tw_12_3:[ {param:'mf',add:R(0.03)} ]",'/ Snowfall Hush'],
  // ---- the counter, Crouch ----
  ['Counter Fang 5% -> 6%',FXJ,"pc_6_2:[ {on:'out',if:{casting:'counter'},more:R(0.05)} ]","pc_6_2:[ {on:'out',if:{casting:'counter'},more:R(0.06)} ]",'/ the counter: Counter Fang'],
  ['Deep Winter Pounce 5% -> 6%',FXJ,"wc_6_2:[ {on:'out',if:{casting:'counter'},more:R(0.05)} ]","wc_6_2:[ {on:'out',if:{casting:'counter'},more:R(0.06)} ]",'/ the counter: Counter Fang'],
  ['Pounce Weight 3% -> 4%',FXJ,"tw_4_4:[ {on:'out',if:{casting:'counter'},more:R(0.03)} ]","tw_4_4:[ {on:'out',if:{casting:'counter'},more:R(0.04)} ]",'/ the counter: Counter Fang'],
  ['Crouch not wound on an empty stance',FXJ,"if(v.evT>0&&!(ev>0)&&!v.evd) A.stSet(T,u,'vlCr',stN(T,'vlCr')+1); v.evT=ev;","if(v.evT>0&&!(ev>0)&&!v.evd); v.evT=ev;",'/ the counter: Counter Fang'],
  ['the counter keeps the Crouch',FXJ,"v.ctrCr=stN(T,'vlCr'); if(v.ctrCr>0) A.stSet(T,u,'vlCr',0);","v.ctrCr=stN(T,'vlCr'); if(v.ctrCr>0) A.stSet(T,u,'vlCr',1);",'/ the counter: Counter Fang'],
  ['Deep Crouch 4 base',FXJ,"tw_2_4:[ {param:'cr.max',add:R(1)} ]","tw_2_4:[ {param:'cr.max',add:R(0)} ]",'/ the counter: Counter Fang'],
  ['Coiled Legs 0.5%',FXJ,"tw_3_4:[ {param:'dr.coil',add:R(0.01)} ]","tw_3_4:[ {param:'dr.coil',add:R(0.005)} ]",'/ the counter: Counter Fang'],
  // ---- the stance, Second Pounce, Ready Pounce ----
  ['Blood Warm 6%',FXJ,"tw_4_3:[ {param:'bw',add:R(0.05)} ]","tw_4_3:[ {param:'bw',add:R(0.06)} ]",'/ the counter: Blood Warm'],
  ['Throat Bite 2.5 s',FXJ,"if(P.tb&&t.alive&&!v.weak) A.control(T,u,t,'silencedT',1.5);","if(P.tb&&t.alive&&!v.weak) A.control(T,u,t,'silencedT',2.5);",'/ the counter: Blood Warm'],
  ['On the Weakest 60%',FXJ,"E.strike(u,t,0.5*v.ctrRaw,'#bfe8ff','magic');","E.strike(u,t,0.6*v.ctrRaw,'#bfe8ff','magic');",'/ the counter: Blood Warm'],
  ['Snow Spring 3% -> 4%',FXJ,"tw_6_4:[ {param:'spring',add:1}, {stat:{move:R(0.03)},if:{fn:'sprung'}} ]","tw_6_4:[ {param:'spring',add:1}, {stat:{move:R(0.04)},if:{fn:'sprung'}} ]",'/ the counter: Blood Warm'],
  ['Longer Whiteout 0.2 s a rank',FXJ,"tw_3_3:[ {on:'kit',skill:WP,opt:{dur:{add:R(0.1)}}} ]","tw_3_3:[ {on:'kit',skill:WP,opt:{dur:{add:R(0.2)}}} ]",'/ the counter: Blood Warm'],
  ['Evader 2%',FXJ,"tw_7_3:[ {on:'kit',skill:WP,opt:{dr:{add:R(-0.01)}}} ]","tw_7_3:[ {on:'kit',skill:WP,opt:{dr:{add:R(-0.02)}}} ]",'/ the counter: Blood Warm'],
  ['Whiteout Storm 0.3x',FXJ,"T.fn.mdmg(A,T,u,x,0.2*(u.apow||0));","T.fn.mdmg(A,T,u,x,0.3*(u.apow||0));",'/ the counter: Blood Warm'],
  ['Cat Reflex 0.3%',FXJ,"tw_8_3:[ {param:'cref',add:R(0.002)} ]","tw_8_3:[ {param:'cref',add:R(0.003)} ]",'/ the counter: Blood Warm'],
  ['Sharp Hearing 20%',FXJ,"tw_12_4:[ {on:'cast',skill:WP,if:{fn:'slowed'},chance:R(0.33),do:[{fn:'clrSlow'}]} ]","tw_12_4:[ {on:'cast',skill:WP,if:{fn:'slowed'},chance:R(0.20),do:[{fn:'clrSlow'}]} ]",'/ the counter: Blood Warm'],
  ['Second Pounce at 20% HP',FXJ,"if(P.sp2&&!v.sp2&&u.alive&&u.hp<0.30*u.maxHp){ v.sp2=1; u.blueCd=0; }","if(P.sp2&&!v.sp2&&u.alive&&u.hp<0.20*u.maxHp){ v.sp2=1; u.blueCd=0; }",'/ the counter: Blood Warm'],
  ['Ready Pounce 0.5 s a rank',FXJ,"tw_4_1:[ {param:'cd.b',add:R(0.4)} ]","tw_4_1:[ {param:'cd.b',add:R(0.5)} ]",'/ the counter: Blood Warm'],
  // ---- Starving ----
  ['Starving 3 s',FXJ,"const per=Math.max(0.5,2-(P['stv.fast']||0));","const per=Math.max(0.5,3-(P['stv.fast']||0));",'/ Starving'],
  ['Starving 0.5% apow',FXJ,"tw_1_2:[ {stat:{apow:R(0.004)},per:'vlStv'}, {param:'stv.h',add:R(0.003)} ]","tw_1_2:[ {stat:{apow:R(0.005)},per:'vlStv'}, {param:'stv.h',add:R(0.003)} ]",'/ Starving'],
  ['Ravenous at 7',FXJ,"tw_5_2:[ {on:'out',if:{auto:true,stackMin:{vlStv:6}},more:R(0.03)} ]","tw_5_2:[ {on:'out',if:{auto:true,stackMin:{vlStv:7}},more:R(0.03)} ]",'/ Starving'],
  ['Feast 0.2%',FXJ,"tw_10_2:[ {param:'stv.h2',add:R(0.001)} ]","tw_10_2:[ {param:'stv.h2',add:R(0.002)} ]",'/ Starving'],
  ['Owl-Eater 15% shield',FXJ,"if(P.oe&&n>=10&&u.alive) A.acts(T,u,[{shield:{pct:0.10,of:'maxHp'},dur:4}],{u,tgt:u});","if(P.oe&&n>=10&&u.alive) A.acts(T,u,[{shield:{pct:0.15,of:'maxHp'},dur:4}],{u,tgt:u});",'/ Starving'],
  ['Never Sorry 1 s a rank',FXJ,"tw_11_2:[ {param:'ns',add:R(0.5)} ]","tw_11_2:[ {param:'ns',add:R(1.0)} ]",'/ Starving'],
  ['Belly Full 4%',FXJ,"tw_6_2:[ {param:'dr.belly',add:R(0.03)} ]","tw_6_2:[ {param:'dr.belly',add:R(0.04)} ]",'/ Starving'],
  ['Gorged 4 energy',FXJ,"tw_8_2:[ {param:'gorge',add:R(3)} ]","tw_8_2:[ {param:'gorge',add:R(4)} ]",'/ Starving'],
  ['Thin Belly 0.6 s a rank',FXJ,"tw_2_2:[ {param:'stv.fast',add:R(0.3)} ]","tw_2_2:[ {param:'stv.fast',add:R(0.6)} ]",'/ Starving'],
  // ---- Hoarded Cold / cooldowns ----
  ['Hoarded Cold 2 energy',FXJ,"pc_10_3:[ {param:'hc',add:R(1)} ]","pc_10_3:[ {param:'hc',add:R(2)} ]",'/ Hoarded Cold'],
  ['Quick Feather 0.4 s a rank',FXJ,"pc_2_3:[ {param:'cd.g',add:R(0.3)} ]","pc_2_3:[ {param:'cd.g',add:R(0.4)} ]",'/ Hoarded Cold'],
  ['Featherfang floor 4 s',FXJ,"c.amt=Math.max(Math.min(c.amt,FF_FLOOR),(c.amt-(P['cd.g']||0))*(1-pc));","c.amt=Math.max(Math.min(c.amt,FF_FLOOR+1),(c.amt-(P['cd.g']||0))*(1-pc));",'/ Hoarded Cold'],
  ['the cd.pct talents 2%',FXJ,"pc_9_3:[ {param:'cd.pct',add:R(0.01)} ]","pc_9_3:[ {param:'cd.pct',add:R(0.02)} ]",'/ Hoarded Cold'],
  ['the cooldown floors 4/5',FXJ,"FF_FLOOR=3, WP_FLOOR=5","FF_FLOOR=4, WP_FLOOR=5",'/ Hoarded Cold'],
  // ---- damage reduction, one group ----
  ['her DR group 35%',FXJ,"const DR_CAP=0.25, TEN_CAP=0.20","const DR_CAP=0.35, TEN_CAP=0.20",'/ damage reduction'],
  ['Fence Post 4% -> 5%',FXJ,"pc_6_1:[ {param:'dr.fence',add:R(0.04)} ]","pc_6_1:[ {param:'dr.fence',add:R(0.05)} ]",'/ damage reduction'],
  ['Soft Paws 4%',FXJ,"pc_12_1:[ {param:'dr.soft',add:R(0.03)} ]","pc_12_1:[ {param:'dr.soft',add:R(0.04)} ]",'/ damage reduction'],
  ['Moult keeps the feathers',FXJ,"if(P.moult&&stN(T,'vlFea')>=FEA_MAX){ f.mo=1; A.stSet(T,u,'vlFea',0); }","if(P.moult&&stN(T,'vlFea')>=FEA_MAX){ f.mo=1; }",'/ Featherfang: The Long Wait'],
  ['Wild Will 3%',FXJ,"tw_5_1:[ {on:'ccIn',less:R(0.04),upTo:TEN_CAP} ]","tw_5_1:[ {on:'ccIn',less:R(0.03),upTo:TEN_CAP} ]",'/ damage reduction'],
  // ---- The Owl Came Down ----
  ["the Owl's storm keeps nothing",FXJ,"(P.owl&&v.st&&v.st.owl&&(u._blizzT||0)>0)","(P.owl&&false&&(u._blizzT||0)>0)","/ The Owl Came Down"],
  ['every tick a critical hit',FXJ,"if(isTick(T,c)&&v.st&&v.st.owl&&T.fn.frozen(A,T,u,c)){ c.force=true; return; }","if(isTick(T,c)&&v.st&&v.st.owl){ c.force=true; return; }","/ The Owl Came Down"],
  ["the Owl's next throw not a critical hit",FXJ,"if(T.s.cur===FF&&v.ff){ if(v.ff.owl){ c.force=true; return; }","if(T.s.cur===FF&&v.ff){ if(v.ff.owl){ return; }","/ The Owl Came Down"],
  ['the Owl needs Silent Altitude at the cast',FXJ,"owl:!!(P.owl&&u._saOn&&u.pass&&u.pass.silentalt)","owl:!!(P.owl&&u.pass&&u.pass.silentalt)","/ The Owl Came Down"],
  // ---- The Moor's Long Winter ----
  ['the Moor 2 Quills at a tick',FXJ,"T.fn.addQ(A,T,u,x,Q_MAX,true);","T.fn.addQ(A,T,u,x,Q_MAX-1,true);","/ The Moor"],
  ['the Moor 2.5 s at the end',FXJ,"T.fn.tstun(A,T,u,r.u,1.5,'moor');","T.fn.tstun(A,T,u,r.u,2.5,'moor');","/ The Moor"],
  // ---- Dead of the Year ----
  ['the claw 0.7x',FXJ,"E.strike(u,lo,0.8*(u.apow||0),'#bfefff','magic');","E.strike(u,lo,0.7*(u.apow||0),'#bfefff','magic');",'/ Dead of the Year'],
  ['the claw never a critical hit',FXJ,"if(T.s.cur==='claw'&&stN(T,'vlStv')>=10){ c.force=true; return; }","if(T.s.cur==='claw'&&stN(T,'vlStv')>10){ c.force=true; return; }",'/ Dead of the Year'],
  ['a kill 2 s more storm',FXJ,"if(v.st.ext<STORM_EXT){ v.st.ext++; u._blizzT+=1; u._castT=Math.max(u._castT||0,u._blizzT); }","if(v.st.ext<STORM_EXT){ v.st.ext++; u._blizzT+=2; u._castT=Math.max(u._castT||0,u._blizzT); }",'/ Dead of the Year'],
  ['the storm 3 s more at most',FXJ,"if(v.st.ext<STORM_EXT){ v.st.ext++; u._blizzT+=1; u._castT=Math.max(u._castT||0,u._blizzT); }","if(v.st.ext<STORM_EXT-1){ v.st.ext++; u._blizzT+=1; u._castT=Math.max(u._castT||0,u._blizzT); }",'/ Dead of the Year'],
  ['Starving never eaten',FXJ,"if(P.doty&&s.kill>0) T.fn.eat(A,T,u);","if(false&&P.doty&&s.kill>0) T.fn.eat(A,T,u);",'/ Dead of the Year'],
  // ---- her stun limits ----
  ['5 s in a row',FXJ,"STUN_TOP=4.0, RUN_TOP=4.0, LOCK=0.5, FF_FLOOR=3","STUN_TOP=4.0, RUN_TOP=5.0, LOCK=0.5, FF_FLOOR=3",'/ her stuns'],
  ['the break 1.5 s',FXJ,"r.st=0; r.re=0; r.lk=LOCK; }","r.st=0; r.re=0; r.lk=LOCK+1; }",'/ her stuns'],
  ['a stun on a stunned enemy',FXJ,"if((t.stunned||0)>0){ v.ts.onStun++; return false; }","if(false){ v.ts.onStun++; return false; }",'/ her stuns'],
  // ---- the wave clock ----
  ['her records kept over a wave',FXJ,"T.s.api=A; v.e={}; v.st=null;","T.s.api=A; v.e=v.e||{}; v.st=null;",'/ the wave clock'],
  ['Kept Height never counts down',FXJ,"if(v.kh>0) v.kh=Math.max(0,v.kh-dt);","if(v.kh>0) v.kh=KH_CD;",'/ the wave clock'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-vaelora','.remote-logs']);
const TMP=(()=>{ const t=os.tmpdir(), r=path.relative(root,t); return (!r.startsWith('..')&&!path.isAbsolute(r))?path.dirname(root):t; })();   // the test host keeps its temp folder inside the checkout: copy beside it instead
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-vlc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-vaelora.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||1), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
