'use strict';
/* The controls for Hobb Kilnmask's talent tests (run on the cluster through tools/remote_test.sh as a plain node script). Each control copies this checkout
   to a temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: the page line his talents
   added, an unguarded seeded draw in one of his skills, or a row, a cap or a function of his), runs the named tests of tests/talents-mech-hobb.test.js
   in that copy, and expects them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page: the line his talents added, and the no-talent identity reaching his skills (an unguarded seeded draw in each of his three skills) ----
  ['wardenCut not bound',HTML,"TalentFx.bindMore({ wardenCut:u=>wardenCut(u), wardenCap:","TalentFx.bindMore({ wardenCutX:u=>wardenCut(u), wardenCap:",'Tessel Blue'],
  ['wardenCap not bound',HTML,"wardenCap:u=>SKLV.wardenCap(passLv(u)) });","wardenCapX:u=>SKLV.wardenCap(passLv(u)) });",'Tessel Blue'],
  ['draw in Glazebreaker',HTML,"case 'shred':{ if(!tgt)break;","case 'shred':{ brnd(); if(!tgt)break;",'no talents'],
  ['draw in Sealed Vessel',HTML,"case 'defensive':{u.drMul=skLvNum('defensive',o,_kLv);","case 'defensive':{brnd(); u.drMul=skLvNum('defensive',o,_kLv);",'no talents'],
  ['draw in Fired Clay',HTML,"if(u.pass.warden){ u.wardenT=(u.wardenT||0)+dt;","if(u.pass.warden){ brnd(); u.wardenT=(u.wardenT||0)+dt;",'no talents'],
  // ---- Rings False ----
  ['Ring False on the 4th',FXJ,"tap:{unit:true,max:P('tap.n',3),full:'tapFull'}","tap:{unit:true,max:P('tap.n',4),full:'tapFull'}",'Ring False'],
  ['Quick Ear 1 s -> 0.9 s',FXJ,"rf_2_1:[ {param:'rf.dur',add:R(1)} ]","rf_2_1:[ {param:'rf.dur',add:R(0.9)} ]",'Ring False'],
  ['Found the Place ignored',FXJ,"rf_3_1:[ {param:'tap.n',add:-1} ]","rf_3_1:[ {param:'tap.n',add:0} ]",'Ring False'],
  ['Tap and Listen 2% -> 3%',FXJ,"rf_1_1:[ {on:'out',if:{targetHas:'rf'},more:R(0.02)} ]","rf_1_1:[ {on:'out',if:{targetHas:'rf'},more:R(0.03)} ]",'Ring False'],
  ['Brittle 2% -> 3%',FXJ,"rf_5_4:[ {stat:{move:R(-0.02)}","rf_5_4:[ {stat:{move:R(-0.03)}",'Ring False'],
  ['Weak Seam: attack only',FXJ,"rf_6_4:[ {stat:{atk:R(-0.03),apow:R(-0.03)}","rf_6_4:[ {stat:{atk:R(-0.03)}",'Ring False'],
  ['Listen Again 1 s -> 1.1 s',FXJ,"dur:R(1),longest:true}]} ],","dur:R(1.1),longest:true}]} ],",'Ring False'],
  ['Fracture on any target',FXJ,"if:{casting:GZ,targetTeam:'enemy',targetHas:'rf'},do:[{ustack:'frac',on:'target',add:1}]}","if:{casting:GZ,targetTeam:'enemy'},do:[{ustack:'frac',on:'target',add:1}]}",'Fracture'],
  ['Hairline 1% -> 1.5%',FXJ,"rf_1_4:[ {stat:{armor:R(-0.01)}","rf_1_4:[ {stat:{armor:R(-0.015)}",'Fracture'],
  ['Deep Fracture from Hobb too',FXJ,"if:{targetTeam:'enemy',srcIs:'ally'},more:R(0.004)","if:{targetTeam:'enemy'},more:R(0.004)",'Fracture'],
  ['It Gives made longer by each Glazebreaker',FXJ,"{on:'fracFull',if:{targetLacks:'gave'},","{on:'fracFull',",'Fracture'],
  ['It Gives keeps the Fracture',FXJ,"{on:'gaveEnd',do:[{ustack:'frac',on:'target',set:0}]}","{on:'gaveEnd',do:[]}",'Fracture'],
  ['Clay Pit Hide on any kind',FXJ,"if(P['dr.frm']&&kind==='magic'&&","if(P['dr.frm']&&",'Fracture'],
  ['Fractured Line 1 -> 2 a rank',FXJ,"do:[{ustack:'frac',on:'target',add:R(1)}]} ]","do:[{ustack:'frac',on:'target',add:R(2)}]} ]",'Fracture'],
  ['Paddle Weight 3% -> 4%',FXJ,"rf_2_2:[ {on:'out',if:{casting:GZ},more:R(0.03)} ]","rf_2_2:[ {on:'out',if:{casting:GZ},more:R(0.04)} ]",'Glazebreaker:'],
  ['Glaze Shatter 2% -> 3%',FXJ,"opt:{shred:{more:R(0.02)}}","opt:{shred:{more:R(0.03)}}",'Glazebreaker:'],
  ['Glaze Paddle 0.1 -> 0.2',FXJ,"rf_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ]","rf_8_2:[ {on:'cd',skill:'green',add:R(-0.2)} ]",'Glazebreaker:'],
  ['Beat Until It Gives before the skill wrote its cut',FXJ,"do:[{later:[{fn:'beat'}]}]","do:[{fn:'beat'}]",'Glazebreaker:'],
  ['Clean Break keeps the Ring False',FXJ,"do:[{mark:'rf',on:'target',clear:true}]","do:[]",'Glazebreaker:'],
  ['Clean Break 40% -> 45%',FXJ,"targetHas:'rf'},more:0.40,","targetHas:'rf'},more:0.45,",'Glazebreaker:'],
  ['Shard Spray 10% -> 11%',FXJ,"{dmg:{pct:R(0.10),of:'hit'},on:{team:'enemy',of:'target',within:1.5","{dmg:{pct:R(0.11),of:'hit'},on:{team:'enemy',of:'target',within:1.5",'Glazebreaker:'],
  ['Shard Spray 1.5 m -> 0.5 m',FXJ,"of:'target',within:1.5,skip:'target'","of:'target',within:0.5,skip:'target'",'Glazebreaker:'],
  ['the signature every 24 s',FXJ,"{window:'tessel',dur:0.01,cd:25}","{window:'tessel',dur:0.01,cd:24}",'Four Hundred'],
  ['the signature double, not triple',FXJ,"tessel(A,T,u,c){ c.amt*=3;","tessel(A,T,u,c){ c.amt*=2;",'Four Hundred'],
  ['the signature 2 Fracture',FXJ,"{ustack:'frac',on,add:3}","{ustack:'frac',on,add:2}",'Four Hundred'],
  ['the signature at 4 Fracture',FXJ,"rf_13_2:[ {on:'out',if:{casting:GZ,targetUst:{frac:5}}","rf_13_2:[ {on:'out',if:{casting:GZ,targetUst:{frac:4}}",'Four Hundred'],
  ['Wide Swing 3% -> 4%',FXJ,"rf_4_3:[ {on:'out',if:{auto:true},more:R(0.03)} ]","rf_4_3:[ {on:'out',if:{auto:true},more:R(0.04)} ]",'basic attacks'],
  ['Through the Glaze 2% -> 3%',FXJ,"rf_3_3:[ {on:'out',ignoreArmor:R(0.02)} ]","rf_3_3:[ {on:'out',ignoreArmor:R(0.03)} ]",'basic attacks'],
  ['Rhythm every 2nd',FXJ,"if(s.rhN%3===0)","if(s.rhN%2===0)",'basic attacks'],
  ['Rhythm not broken by another enemy',FXJ,"else { s.rhT=t.uid; s.rhN=1; }","else { s.rhT=t.uid; }",'basic attacks'],
  ['All of Them False 1% -> 2%',FXJ,"targetHas:'rf'},do:[{heal:{pct:R(0.01),of:'hpLost'}}]} ],","targetHas:'rf'},do:[{heal:{pct:R(0.02),of:'hpLost'}}]} ],",'basic attacks'],
  ['Shard Harvest 0.4% -> 0.5%',FXJ,"{heal:{pct:R(0.004),of:'maxHp',x:{ust:'frac',of:'unit'}}}","{heal:{pct:R(0.005),of:'maxHp',x:{ust:'frac',of:'unit'}}}",'Shard Harvest'],
  ['Swept Up to the nearest ally',FXJ,"x:{ust:'frac',of:'unit'}},on:{team:'ally',others:true,order:'lowHp',n:1}","x:{ust:'frac',of:'unit'}},on:{team:'ally',others:true,order:'near',n:1}",'Shard Harvest'],
  // ---- critical chance ----
  ['crit cap 5% -> 6%',FXJ,"CRIT_CAP=0.05,","CRIT_CAP=0.06,",'critical chance'],
  ['Ear for It 1.5% -> 2%',FXJ,"rf_6_1:[ {param:'crit.rf',add:R(0.015)} ]","rf_6_1:[ {param:'crit.rf',add:R(0.02)} ]",'critical chance'],
  ['crit row never rolls',FXJ,"chance:{flat:1,x:{fn:'critP'}},force:true}","chance:{flat:0,x:{fn:'critP'}},force:true}",'critical chance'],
  ['Eye on the Shelf 1% -> 1.2%',FXJ,"{param:'crit.sure',add:R(0.01)}","{param:'crit.sure',add:R(0.012)}",'critical chance'],
  // ---- damage reduction: the group ----
  ['group cap 30% -> 35%',FXJ,"const DR_CAP=0.30,","const DR_CAP=0.35,",'one group of 30%'],
  ['group shares added, not multiplied',FXJ,"const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };","const cut=x=>{ if(x>0) k-=x; };",'one group of 30%'],
  ['River Mask from any row',FXJ,"if(P['dr.back']&&src&&src.t&&src.t.row==='Back')","if(P['dr.back'])",'one group of 30%'],
  ['Old Clay below 50%',FXJ,"if(P['dr.low']&&u.hp<0.3*u.maxHp)","if(P['dr.low']&&u.hp<0.5*u.maxHp)",'one group of 30%'],
  ['Hard Fired on every hit',FXJ,"if(P['dr.crit']&&crit)","if(P['dr.crit'])",'one group of 30%'],
  ['Second Coat at 4 Coats always',FXJ,"if(P['dr.coat']) cut(P['dr.coat']*stN(T,'coat'));","if(P['dr.coat']) cut(P['dr.coat']*4);",'one group of 30%'],
  ['Shelf of Names per shard ever carried',FXJ,"if(P['dr.shelf']) cut(P['dr.shelf']*stN(T,'shard'));","if(P['dr.shelf']) cut(P['dr.shelf']*6);",'one group of 30%'],
  ['Tessel Blue from anyone',FXJ,"if(P['dr.rf']&&mk(u,src,'rf',now))","if(P['dr.rf'])",'Tessel Blue'],
  ['Clay Skin on any kind',FXJ,"if(P['dr.khm']&&kind==='magic'&&","if(P['dr.khm']&&",'Tessel Blue'],
  ['Centred at 7 Turns',FXJ,"if(P['dr.c8']&&stN(T,'turn')>=8)","if(P['dr.c8']&&stN(T,'turn')>=7)",'Tessel Blue'],
  ['For Grandmother at single strength',FXJ,"cut(2*(P['jar.r']||0));","cut(P['jar.r']||0);",'Tessel Blue'],
  ['Blue Glaze without the slot check',FXJ,"Math.abs(u.drMul-s.vMul)<1e-9){ const r0","true){ const r0",'Tessel Blue'],
  ['Blue Glaze as points',FXJ,"const r1=Math.min(0.95,r0*(1+P.bg));","const r1=Math.min(0.95,r0+P.bg);",'Tessel Blue'],
  ['The Long Hall: Coats not stacks',FXJ,"st1=Math.min(5,st+(hall?stN(T,'coat'):0));","st1=Math.min(5,st);",'Tessel Blue'],
  ['White Plates ignored',FXJ,"cap1=E.wardenCap(u)+(P['clay.cap']||0)+(hall?0.04:0)","cap1=E.wardenCap(u)+(hall?0.04:0)",'Tessel Blue'],
  ['Shaped Hands always',FXJ,"rf_10_2:[ {stat:{armor:R(0.02)},if:{fn:'clayAtCap'}} ]","rf_10_2:[ {stat:{armor:R(0.02)}} ]",'Tessel Blue'],
  ['Most of the Town on top of the others',FXJ,"if(winN(T,'town')) return 1-DR_TOWN;","if(winN(T,'town')) return (1-DR_TOWN)*0.9;",'Most of the Town'],
  // ---- Carrying the Town ----
  ['a Vessel leaves 2 Coats',FXJ,"{on:'end:vessel',reqAny:COAT,do:[{stack:'coat',add:1}]}","{on:'end:vessel',reqAny:COAT,do:[{stack:'coat',add:2}]}",'Coats:'],
  ['Coats kept between waves',FXJ,"coat:{max:P('coat.max',4),wave:'reset'}","coat:{max:P('coat.max',4)}",'Coats:'],
  ['the Vessel outlives the wave',FXJ,"{on:'waveEnd',reqAny:VES,do:[{window:'vessel',end:true}]},","",'Coats:'],
  ['Painted Mask ignored',FXJ,"ct_12_1:[ {param:'coat.max',add:R(1)} ]","ct_12_1:[ {param:'coat.max',add:R(0)} ]",'Coats:'],
  ['Thick Glaze 0.3% -> 0.4%',FXJ,"ct_2_3:[ {stat:{hp:R(0.003)},per:'coat'} ]","ct_2_3:[ {stat:{hp:R(0.004)},per:'coat'} ]",'Coats:'],
  ['Heavy Paddle when it does not hold',FXJ,"ct_3_2:[ {stat:{atk:R(0.03)},if:{window:'vessel'}} ]","ct_3_2:[ {stat:{atk:R(0.03)}} ]",'Coats:'],
  ['Vessel Strength 0.2 -> 0.3',FXJ,"ct_6_3:[ {on:'kit',skill:SV,opt:{dur:{add:R(0.2)}}} ]","ct_6_3:[ {on:'kit',skill:SV,opt:{dur:{add:R(0.3)}}} ]",'Coats:'],
  ['Kin Shard at 13%',FXJ,"if:{hitMin:{pct:0.15,of:'maxHp'},stackMin:{shard:1}}","if:{hitMin:{pct:0.13,of:'maxHp'},stackMin:{shard:1}}",'Kin Shards'],
  ['Kin Shard takes 13% a rank',FXJ,"ct_1_4:[ {param:'shard.k',add:R(0.10)} ]","ct_1_4:[ {param:'shard.k',add:R(0.13)} ]",'Kin Shards'],
  ['Kin Shard never spent',FXJ,"do:[{stack:'shard',spend:1,then:[{emit:'shardBreak'}]}]","do:[{emit:'shardBreak'}]",'Kin Shards'],
  ['Shards on the Wheel 5% -> 6%',FXJ,"ct_n1:[ {param:'dr.sotw',add:0.05}","ct_n1:[ {param:'dr.sotw',add:0.06}",'Kin Shards'],
  ['Shards on the Wheel 3 Turns',FXJ,"{on:'shardBreak',req:'ow_1_4',do:[{stack:'turn',add:4}]}","{on:'shardBreak',req:'ow_1_4',do:[{stack:'turn',add:3}]}",'Kin Shards'],
  ['Nobody Left Behind twice',FXJ,"ct_11_4:[ {on:'shardBreak',once:'fight',","ct_11_4:[ {on:'shardBreak',",'Kin Shards'],
  ['Swept and Refired mends 2',FXJ,"ct_3_4:[ {on:'cast',skill:SV,do:[{stack:'shard',add:1}]} ]","ct_3_4:[ {on:'cast',skill:SV,do:[{stack:'shard',add:2}]} ]",'Kin Shards'],
  ['Eye on the Shelf 4 s -> 5 s',FXJ,"do:[{window:'sure',dur:4}]","do:[{window:'sure',dur:5}]",'Kin Shards'],
  ['Fragments per whole shard',FXJ,"per:{stack:'shard',missing:true}","per:'shard'",'Kin Shards'],
  ['Most of the Town at 3 Coats',FXJ,"if:{stackMin:{coat:4}},do:[{window:'town'","if:{stackMin:{coat:3}},do:[{window:'town'",'Most of the Town'],
  ['Most of the Town 6 s',FXJ,"{window:'town',dur:5,cd:30},{stack","{window:'town',dur:6,cd:30},{stack",'Most of the Town'],
  ['Most of the Town every 20 s',FXJ,"{window:'town',dur:5,cd:30},{stack","{window:'town',dur:5,cd:20},{stack",'Most of the Town'],
  ['Most of the Town casts nothing',FXJ,"{after:0,do:[{castSkill:'blue',on:'self'}]}","{after:0,do:[]}",'Most of the Town'],
  ['Most of the Town mends nothing',FXJ,"{window:'town',dur:5,cd:30},{stack:'shard',set:'max'},","{window:'town',dur:5,cd:30},",'Most of the Town'],
  ['Jar Ready 0.3 -> 0.4',FXJ,"ct_4_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ]","ct_4_3:[ {on:'cd',skill:'blue',add:R(-0.4)} ]",'Sealed Vessel:'],
  ['River Glaze 4% -> 5%',FXJ,"{heal:{pct:P('rg.h',0.04),of:'maxHp'}}","{heal:{pct:P('rg.h',0.05),of:'maxHp'}}",'Sealed Vessel:'],
  ['Set Tight 0.24% -> 0.2%',FXJ,"ct_8_3:[ {param:'st.h',add:R(0.0024)} ]","ct_8_3:[ {param:'st.h',add:R(0.002)} ]",'Sealed Vessel:'],
  ['the regeneration cap removed',FXJ,"if(a>0) E.healUnit(u,Math.min(REGEN_CAP,a)*u.maxHp);","if(a>0) E.healUnit(u,a*u.maxHp);",'Fired Again'],
  ['Sealed Tight lets stuns land',FXJ,"ct_9_3:[ {on:'ccIn',if:{window:'vessel',cc:['stunned']},mul:0},","ct_9_3:[",'Sealed Vessel:'],
  ['Sealed Tight keeps a stun written on',FXJ,"{timer:'_gearImmovableT',min:0.1,on:'self'},{fn:'unstun'}]}","{timer:'_gearImmovableT',min:0.1,on:'self'}]}",'Sealed Vessel:'],
  ['Unhurried Hands 4% -> 5%',FXJ,"ct_4_4:[ {on:'ccIn',less:R(0.04)} ]","ct_4_4:[ {on:'ccIn',less:R(0.05)} ]",'controls on him'],
  ['slow cap 40% -> 50%',FXJ,"SLOW_CAP=0.40,","SLOW_CAP=0.50,",'controls on him'],
  ['Clay Weight 4% -> 5%',FXJ,"rf_11_1:[ {param:'slw.a',add:R(0.04)} ]","rf_11_1:[ {param:'slw.a',add:R(0.05)} ]",'controls on him'],
  ['Fired Clay fastest 1.5 s -> 1 s',FXJ,"CLAY_FASTEST=1.5;","CLAY_FASTEST=1.0;",'Fired Clay faster'],
  ['Fired Clay clock never faster',FXJ,"u.wardenT=(u.wardenT||0)+(c.dt||0)*(3/p-1); },","},",'Fired Clay faster'],
  ['Heavy Step 3% -> 4%',FXJ,"ct_5_1:[ {stat:{move:R(0.03)}} ]","ct_5_1:[ {stat:{move:R(0.04)}} ]",'move speed'],
  ['Never Cracked stacks',FXJ,"dur:3,mode:'max'}]} ],","dur:3}]} ],",'Never Cracked'],
  ['Never Cracked on every hit',FXJ,"ct_12_3:[ {on:'hurt',if:{crit:true},","ct_12_3:[ {on:'hurt',",'Never Cracked'],
  // ---- On the Wheel ----
  ['Kiln Heat 3% -> 4%',FXJ,"ow_1_1:[ {param:'kh.burn',add:R(0.03)} ]","ow_1_1:[ {param:'kh.burn',add:R(0.04)} ]",'Kiln-Hot'],
  ['Kiln-Hot 6 s -> 7 s',FXJ,"(a&&a.dur)||(6+(T.P['kh.dur']||0))","(a&&a.dur)||(7+(T.P['kh.dur']||0))",'Kiln-Hot'],
  ['Kiln-Hot on every enemy it reaches',FXJ,"{on:'ccHit',reqAny:KH,if:{casting:KS,cc:['stunned'],talent:false},do:[{fn:'khOn'}]}","{on:'hit',reqAny:KH,if:{casting:KS},do:[{fn:'khOn'}]}",'Kiln-Hot'],
  ['Kiln Glow 1.5% -> 2%',FXJ,"ow_5_1:[ {on:'out',if:{targetHas:'kh'},more:R(0.015)} ]","ow_5_1:[ {on:'out',if:{targetHas:'kh'},more:R(0.02)} ]",'Kiln-Hot'],
  ['Hot Glaze 6% -> 7%',FXJ,"ow_6_1:[ {stat:{move:R(-0.06)}","ow_6_1:[ {stat:{move:R(-0.07)}",'Kiln-Hot'],
  ['Kiln Opens 2 m -> 1 m',FXJ,"A.pick(T,u,{team:'enemy',of:'unit',within:2},c)","A.pick(T,u,{team:'enemy',of:'unit',within:1},c)",'Kiln-Hot'],
  ['Kiln Opens 3 s -> 4 s',FXJ,"T.fn.khOn(A,T,u,{tgt:x},{dur:3});","T.fn.khOn(A,T,u,{tgt:x},{dur:4});",'Kiln-Hot'],
  ['Fired Again 0.1% -> 0.12%',FXJ,"ow_10_1:[ {param:'fa.h',add:R(0.001)} ]","ow_10_1:[ {param:'fa.h',add:R(0.0012)} ]",'Fired Again'],
  ['Warm Kiln at full',FXJ,"E.healUnit(holder,Math.min(REGEN_CAP*holder.maxHp,fa*P.wk*u.maxHp));","E.healUnit(holder,Math.min(REGEN_CAP*holder.maxHp,fa*2*u.maxHp));",'Fired Again'],
  ['Warm Kiln past the holder cap',FXJ,"E.healUnit(holder,Math.min(REGEN_CAP*holder.maxHp,fa*P.wk*u.maxHp));","E.healUnit(holder,fa*P.wk*u.maxHp);",'Fired Again'],
  ['Lump on the Wheel 2% -> 3%',FXJ,"ow_1_4:[ {on:'out',if:{casting:KS},more:R(0.02),per:'turn'} ]","ow_1_4:[ {on:'out',if:{casting:KS},more:R(0.03),per:'turn'} ]",'Turns:'],
  ['Turns never spent',FXJ,"{on:'cast',reqAny:TURN,skill:KS,do:[{stack:'turn',set:0}]},","",'Turns:'],
  ['Turns from skills too',FXJ,"{on:'hit',reqAny:TURN,if:{auto:true,targetTeam:'enemy'},do:[{stack:'turn',add:1}]}","{on:'hit',reqAny:TURN,if:{targetTeam:'enemy'},do:[{stack:'turn',add:1}]}",'Turns:'],
  ['Fast Wheel 0.5% -> 0.6%',FXJ,"ow_2_4:[ {stat:{aspd:R(0.005)},per:'turn'} ]","ow_2_4:[ {stat:{aspd:R(0.006)},per:'turn'} ]",'Turns:'],
  ['Steady Turning 0.3% -> 0.4%',FXJ,"ow_11_4:[ {stat:{armor:R(0.003)},per:'turn'} ]","ow_11_4:[ {stat:{armor:R(0.004)},per:'turn'} ]",'Turns:'],
  ['Spin It Up 1 -> 2 a rank',FXJ,"ow_9_4:[ {on:'wave',do:[{stack:'turn',add:R(1)}]} ]","ow_9_4:[ {on:'wave',do:[{stack:'turn',add:R(2)}]} ]",'Turns:'],
  ['Wheel Momentum 3 Turns',FXJ,"chance:R(0.2),do:[{stack:'turn',add:2}]}","chance:R(0.2),do:[{stack:'turn',add:3}]}",'Turns:'],
  ['Thrown Shape 50% -> 20%',FXJ,"opt:{radius:{mul:1.5}}","opt:{radius:{mul:1.2}}",'Turns:'],
  ['Frontline Breaker 3% -> 4%',FXJ,"rf_7_3:[ {on:'out',if:{casting:KS},more:R(0.03)} ]","rf_7_3:[ {on:'out',if:{casting:KS},more:R(0.04)} ]",'Grand Kiln Shape:'],
  ['Bigger Mold 0.1 -> 0.2',FXJ,"ow_4_2:[ {param:'ks.stun',add:R(0.1)},","ow_4_2:[ {param:'ks.stun',add:R(0.2)},",'Grand Kiln Shape:'],
  ['Kiln Shape Rings on its fear',FXJ,"rf_11_2:[ {on:'ccHit',if:{casting:KS,cc:['stunned'],talent:false}","rf_11_2:[ {on:'ccHit',if:{casting:KS,cc:['fearT'],talent:false}",'Grand Kiln Shape:'],
  ['Hands on the Ground on Hobb too',FXJ,"dur:6,on:{team:'ally',within:4,others:true}}]} ],","dur:6,on:{team:'ally',within:4}}]} ],",'Grand Kiln Shape:'],
  ['Hands on the Ground 4 m -> 3 m',FXJ,"dur:6,on:{team:'ally',within:4,others:true}}]} ],","dur:6,on:{team:'ally',within:3,others:true}}]} ],",'Grand Kiln Shape:'],
  ['Shaped for Them 2% -> 3%',FXJ,"ow_12_3:[ {param:'hog',add:R(0.02)} ]","ow_12_3:[ {param:'hog',add:R(0.03)} ]",'Grand Kiln Shape:'],
  ['the Evening Jar to the highest HP',FXJ,"if(x.alive&&x.team===u.team&&x!==u&&!x._summon&&(!h||x.hp<h.hp)) h=x; }","if(x.alive&&x.team===u.team&&x!==u&&!x._summon&&(!h||x.hp>h.hp)) h=x; }",'The Evening Jar'],
  ['the Evening Jar 1% -> 1.2%',FXJ,"ow_2_3:[ {param:'jar.r',add:R(0.01)} ]","ow_2_3:[ {param:'jar.r',add:R(0.012)} ]",'The Evening Jar'],
  ['Jar Lid 3% -> 4%',FXJ,"{on:'teamHeal',if:{fn:'jarUnit'},more:R(0.03)}","{on:'teamHeal',if:{fn:'jarUnit'},more:R(0.04)}",'The Evening Jar'],
  ['Hall of Jars above 30%',FXJ,"&&h.hp>0.5*h.maxHp; },","&&h.hp>0.3*h.maxHp; },",'The Evening Jar'],
  ['For Whoever Needs It twice a wave',FXJ,"if(s.fwW===s.wave||!h","if(!h",'The Evening Jar'],
  ['For Whoever Needs It keeps the jar',FXJ,"A.clearMark(u,h,'jar'); s.m.jar=null; if(nx) A.setMark(T,u,nx,'jar',{unique:true}); }","}",'The Evening Jar'],
  ['One Jar Each Evening 3% -> 4%',FXJ,"ow_6_2:[ {param:'fw.sh',add:R(0.03)} ]","ow_6_2:[ {param:'fw.sh',add:R(0.04)} ]",'The Evening Jar'],
  ['He Has Not Decided at 7 Turns',FXJ,"ow_13_3:[ {on:'kit',skill:KS,if:{stackMin:{turn:8}}","ow_13_3:[ {on:'kit',skill:KS,if:{stackMin:{turn:7}}",'He Has Not Decided'],
  ['He Has Not Decided every 20 s',FXJ,"{window:'hnd',dur:0.01,cd:30}","{window:'hnd',dur:0.01,cd:20}",'He Has Not Decided'],
  ['He Has Not Decided jars 6 m -> 4 m',FXJ,"{mark:'jar6',on:{team:'ally',within:6,others:true},dur:6}","{mark:'jar6',on:{team:'ally',within:4,others:true},dur:6}",'He Has Not Decided'],
  ['He Has Not Decided jars 5% -> 4%',FXJ,"if(mk(u,t,'jar6',now)) x=Math.max(x,0.05);","if(mk(u,t,'jar6',now)) x=Math.max(x,0.04);",'He Has Not Decided'],
  ['He Has Not Decided readies nothing',FXJ,"{cd:'green',set:0},{cd:'blue',set:0},{fn:'hndOff'}","{fn:'hndOff'}",'He Has Not Decided'],
  ['He Has Not Decided: no Kiln-Hot',FXJ,"{on:'hit',if:{casting:KS,targetTeam:'enemy',fn:'hndOn'},do:[{fn:'khOn'}]},","",'He Has Not Decided'],
];

const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ const ex=[...SKIP].map(k=>'--exclude=./'+k).join(' ');   // tar, not fs.cpSync: the runner's temp folder sits inside the checkout
  const r=cp.spawnSync('bash',['-c','tar cf - '+ex+' . | tar xf - -C "'+dir+'"'],{cwd:root,encoding:'utf8',maxBuffer:1<<26});
  if(!fs.existsSync(path.join(dir,HTML))) throw new Error('copy failed: rc '+r.status+' '+String(r.stderr||r.error||'').slice(0,400));
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k));
  for(const k of ['.bin','.base']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(path.dirname(root),'.ctl-'+path.basename(root)+'-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-hobb.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||3), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
