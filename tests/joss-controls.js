'use strict';
/* The controls for Joss Gatley's talent tests (run on the cluster through tools/remote_test.sh as a plain node script, TOGETHER with
   tests/talents-mech-joss.test.js: the runner sends the pre-talent page only for SHAs named in the files of the run). Each control copies this checkout to
   a folder under os.tmpdir() (which follows TMPDIR: on the cluster a folder beside the slot, wiped after the run), breaks ONE thing there (an exact text
   swap in emberweave-heroes.html or in the generated talents-fx.js: a page line his talents added, an unguarded seeded draw at one of those lines, the
   runtime's new held hook, or a row, a cap or a function of his), runs the named tests of tests/talents-mech-joss.test.js in that copy, and expects them to
   FAIL. One copy at a time; each is deleted as soon as it has run; .logs, node_modules and the art are not copied (node_modules and assets are linked).
   The checkout itself is never changed. Prints one line per control and a count; exits 1 if any was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page lines his talents added (each removed: his tests fail), and an unguarded seeded draw at each (the no-talent identity test fails) ----
  ['skillTgt in Radiant Hammer removed',HTML,"      if(u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,'atkcrush',best,o)||best;","      ",'Hammer Between Them'],
  ['skillTgt in Sanctuary Guard removed',HTML,"      if(u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,'lastbreath',best,o)||best;","      ",'choice'],
  ['held line removed',HTML,"  if(_talHd&&u.alive&&u.hp>0) TalentFx.held(u);","  ",'Kept Word'],
  ['draw at the Radiant Hammer site',HTML,"      if(u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,'atkcrush',best,o)||best;","      brnd(); if(u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,'atkcrush',best,o)||best;",'no talents'],
  ['draw at the Sanctuary Guard site',HTML,"      if(u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,'lastbreath',best,o)||best;","      brnd(); if(u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,'lastbreath',best,o)||best;",'no talents'],
  ['draw at the held site',HTML,"  const _talHd=!!(u._talW&&","  brnd(); const _talHd=!!(u._talW&&",'no talents'],
  // ---- the runtime ----
  ['held runs no rows',FXJ,"run(To,o,'teamHeld',{u:o,unit:u,tgt:u}); } }","} }",'Kept Word'],
  ['teamHeld does not turn the watch on',FXJ,"T.on.teamNrg||T.on.teamHeld||M.watch===true","T.on.teamNrg||M.watch===true",'Kept Word'],
  // ---- the caps ----
  ['damage-reduction group 40% -> 45%',FXJ,"const DR_CAP=0.40, ALLY_CAP","const DR_CAP=0.45, ALLY_CAP",'one group of 40%'],
  ['allies\' group 25% -> 30%',FXJ,"ALLY_CAP=0.25,","ALLY_CAP=0.30,",'his allies'],
  ['control cap 35% -> 40%',FXJ,"TEN_CAP=0.35,","TEN_CAP=0.40,",'controls on him'],
  ['regeneration cap 1.2% -> 2%',FXJ,"REGEN_CAP=0.012, STUN_TOP","REGEN_CAP=0.02, STUN_TOP",'healing each second'],
  ['stun ceiling 4.0 s -> 4.5 s',FXJ,"STUN_TOP=4.0,","STUN_TOP=4.5,",'stuns made longer'],
  ['stun-lock 0.5 s -> 0.1 s',FXJ,"LOCK=0.5;","LOCK=0.1;",'The Gate Still Stands'],
  ['the signature stuns a stunned or locked enemy',FXJ,"if(T.fn.stunOk(A,T,u,e)) A.control","if(true) A.control",'The Gate Still Stands'],
  // ---- Hold Until Morning ----
  ['Light Before Dawn 0.1% -> 0.2%',FXJ,"hm_1_1:[ {param:'dr.dawn',add:R(0.001)} ]","hm_1_1:[ {param:'dr.dawn',add:R(0.002)} ]",'Dawnlight:'],
  ['Brightening 1 -> 2',FXJ,"hm_2_1:[ {param:'dawn.stun',add:R(1)} ]","hm_2_1:[ {param:'dawn.stun',add:R(2)} ]",'Dawnlight:'],
  ['Dawnlight max 21',FXJ,"jDawn:{max:20,gain:'jDawnG'}","jDawn:{max:21,gain:'jDawnG'}",'Dawnlight:'],
  ['Dawnlight from every hit',FXJ,"if:{selfHpBelow:0.5},do:[{stack:'jDawn',add:1}]}","if:{selfHpBelow:1.01},do:[{stack:'jDawn',add:1}]}",'Dawnlight:'],
  ['Pale Sky 0.2% -> 0.3%',FXJ,"hm_8_1:[ {on:'jDawnG',do:[{heal:{pct:R(0.002),of:'maxHp'}}]} ]","hm_8_1:[ {on:'jDawnG',do:[{heal:{pct:R(0.003),of:'maxHp'}}]} ]",'Dawnlight:'],
  ['Grey Light 0.1% -> 0.2%',FXJ,"hm_4_1:[ {stat:{apow:R(0.001)},per:'jDawn'} ]","hm_4_1:[ {stat:{apow:R(0.002)},per:'jDawn'} ]",'Dawnlight:'],
  ['Dawn Hammer 0.2% -> 0.3%',FXJ,"more:R(0.002),per:'jDawn'} ]","more:R(0.003),per:'jDawn'} ]",'Dawnlight:'],
  ['Early Light every wave',FXJ,"hm_6_4:[ {on:'wave',once:'fight',","hm_6_4:[ {on:'wave',",'Dawnlight:'],
  ['Grit below 60%',FXJ,"if:{selfHpBelow:0.3},do:[{stack:'jGrit',add:1}]}","if:{selfHpBelow:0.6},do:[{stack:'jGrit',add:1}]}",'Grit:'],
  ['Grit kept between waves',FXJ,"jGrit:{max:10,wave:'reset'}","jGrit:{max:10}",'Grit:'],
  ['Set Jaw 0.3% -> 0.4%',FXJ,"hm_3_4:[ {param:'dr.grit',add:R(0.003)} ]","hm_3_4:[ {param:'dr.grit',add:R(0.004)} ]",'Grit:'],
  ['Hard Night 0.2% -> 0.3%',FXJ,"hm_7_4:[ {stat:{ctrl:R(0.002)},per:'jGrit'} ]","hm_7_4:[ {stat:{ctrl:R(0.003)},per:'jGrit'} ]",'Grit:'],
  ['Scarred Gate 0.2% -> 0.3%',FXJ,"hm_10_4:[ {stat:{hp:R(0.002)},per:'jGrit'} ]","hm_10_4:[ {stat:{hp:R(0.003)},per:'jGrit'} ]",'Grit:'],
  ['Long Siege 2 -> 3',FXJ,"hm_12_1:[ {on:'wave',do:[{stack:'jGrit',add:R(2)}]} ]","hm_12_1:[ {on:'wave',do:[{stack:'jGrit',add:R(3)}]} ]",'Grit:'],
  ['Bloodied Not Bowed at 3 Grit',FXJ,"if(P['rg.bnb']&&stN(T,'jGrit')>=5)","if(P['rg.bnb']&&stN(T,'jGrit')>=3)",'Grit:'],
  ['Until Morning twice a wave',FXJ,"hm_9_4:[ {on:'hurt',if:{stackFull:'jGrit'},once:'wave',","hm_9_4:[ {on:'hurt',if:{stackFull:'jGrit'},",'Grit:'],
  ['Until Morning heals every Radiant Hammer',FXJ,"umClr(A,T){ T.s.joUm=false; },","umClr(A,T){ },",'Grit:'],
  ['Sally Forth leaves Sanctuary Guard',FXJ,"{cd:'green',set:0},{cd:'blue',set:0},{window:'jSally',dur:4}","{cd:'green',set:0},{window:'jSally',dur:4}",'event'],
  ['Sally\'s Wake 4 s -> 5 s',FXJ,"{window:'jSally',dur:4}]} ]","{window:'jSally',dur:5}]} ]",'event'],
  ['Morning Comes 3% -> 4%',FXJ,"hm_6_1:[ {param:'ud.more',add:R(0.03)}","hm_6_1:[ {param:'ud.more',add:R(0.04)}",'event'],
  ['First Light 6 m -> 12 m',FXJ,"on:{team:'ally',within:6,others:true},emit:'jGrat'}]} ],","on:{team:'ally',within:12,others:true},emit:'jGrat'}]} ],",'event'],
  ['Dawn Mercy 2% -> 3%',FXJ,"pr_11_1:[ {on:'jDawn',do:[{shield:{pct:R(0.02),","pr_11_1:[ {on:'jDawn',do:[{shield:{pct:R(0.03),",'event'],
  ['the signature: the full shield for allies',FXJ,"half=T.fn.udShield(A,T,u)*0.5;","half=T.fn.udShield(A,T,u)*1;",'The Gate Still Stands'],
  ['the dazzle 25% -> 20% on him',FXJ,"if(T.r.hm_13_2&&mk(u,src,'jDaz',now)) cut(0.25);","if(T.r.hm_13_2&&mk(u,src,'jDaz',now)) cut(0.20);",'The Gate Still Stands'],
  ['the dazzle 25% -> 20% on his allies',FXJ,"if(T.r.hm_13_2&&mk(u,s,'jDaz',now)) cut(0.25);","if(T.r.hm_13_2&&mk(u,s,'jDaz',now)) cut(0.20);",'The Gate Still Stands'],
  ['the dazzle 4 s -> 5 s',FXJ,"A.setMark(T,u,e,'jDaz',{dur:4});","A.setMark(T,u,e,'jDaz',{dur:5});",'The Gate Still Stands'],
  ['Second Morning at 21',FXJ,"!s.joSM&&stN(T,'jDawn')>=20&&","!s.joSM&&stN(T,'jDawn')>=21&&",'The Gate Still Stands'],
  ['Second Morning keeps the Dawnlight',FXJ,"if(s.joUbN===2&&T.P.sm) A.stSet(T,u,'jDawn',0);","",'The Gate Still Stands'],
  ['Second Morning again and again',FXJ,"if(T.P.sm&&s.joUbN===1&&!s.joSM&&","if(T.P.sm&&s.joUbN>=1&&",'The Gate Still Stands'],
  ['Hammer at the Gate 5% -> 6%',FXJ,"hm_n1:[ {on:'out',if:{casting:RH,selfHpBelow:0.5},more:0.05}","hm_n1:[ {on:'out',if:{casting:RH,selfHpBelow:0.5},more:0.06}",'Hammer at the Gate'],
  ['Hammer at the Gate 25% -> 50%',FXJ,"{on:'jDawnG',req:'ra_1_1',chance:0.25,","{on:'jDawnG',req:'ra_1_1',chance:0.5,",'Hammer at the Gate'],
  ['Hammer at the Gate: not full at the dawn',FXJ,"{on:'jDawn',req:'ra_1_1',do:[{stack:'jHL',set:'max'}]}","{on:'jDawn',req:'ra_1_1',do:[{stack:'jHL',add:1}]}",'Hammer at the Gate'],
  // ---- the damage-reduction group ----
  ['Gate Bar from any row',FXJ,"if(P['dr.front']&&src&&src.t&&src.t.row==='Front')","if(P['dr.front'])",'one group of 40%'],
  ['Thick Timber 2% -> 3%',FXJ,"hm_4_2:[ {param:'dr.crit1',add:R(0.02)} ]","hm_4_2:[ {param:'dr.crit1',add:R(0.03)} ]",'one group of 40%'],
  ['Stand Fast at Night below 50%',FXJ,"if(P['dr.grit']) cut(P['dr.grit']*stN(T,'jGrit'));\n      if(P['dr.low']&&u.hp<0.3*u.maxHp)","if(P['dr.grit']) cut(P['dr.grit']*stN(T,'jGrit'));\n      if(P['dr.low']&&u.hp<0.5*u.maxHp)",'one group of 40%'],
  ['Court of Morning up to 5',FXJ,"cut(P['dr.court']*Math.min(4,j))","cut(P['dr.court']*Math.min(5,j))",'one group of 40%'],
  ['Shamed with nobody Humbled',FXJ,"if(P['dr.shame']&&h) cut(P['dr.shame']);","if(P['dr.shame']) cut(P['dr.shame']);",'one group of 40%'],
  ['Thanks of the Town 0.5% -> 0.6%',FXJ,"pr_1_1:[ {param:'dr.gra',add:R(0.005)} ]","pr_1_1:[ {param:'dr.gra',add:R(0.006)} ]",'one group of 40%'],
  ['Devotion 4 m -> 6 m',FXJ,"<4*E.METER()) cut(P['dr.dev']);","<6*E.METER()) cut(P['dr.dev']);",'one group of 40%'],
  ['Broad Shield not on him',FXJ,"if(P.bs&&mk(u,u,'jSg',now)) cut(P.bs);","",'one group of 40%'],
  ['Humbled\'s cut 2% -> 3%',FXJ,"ra_1_4:[ {param:'hum.less',add:R(0.02)}","ra_1_4:[ {param:'hum.less',add:R(0.03)}",'one group of 40%'],
  ['Witness Stand 1% -> 2%',FXJ,"ra_8_2:[ {param:'wit',add:R(0.01)} ]","ra_8_2:[ {param:'wit',add:R(0.02)} ]",'one group of 40%'],
  // ---- his allies ----
  ['Given Word 1% -> 2%',FXJ,"pr_1_4:[ {param:'al.pro',add:R(0.01)}","pr_1_4:[ {param:'al.pro',add:R(0.02)}",'his allies'],
  ['Broad Shield on allies 3% -> 4%',FXJ,"pr_n1:[ {param:'bs',add:R(0.03)} ]","pr_n1:[ {param:'bs',add:R(0.04)} ]",'his allies'],
  ['Grateful Town 1% -> 2%',FXJ,"pr_11_3:[ {param:'al.gra',add:R(0.01)} ]","pr_11_3:[ {param:'al.gra',add:R(0.02)} ]",'his allies'],
  ['Brighter Each Morning 6 m -> 12 m',FXJ,"-E.bodyR(t)<6*E.METER()) cut(P['al.dawn']","-E.bodyR(t)<12*E.METER()) cut(P['al.dawn']",'his allies'],
  ['Judged 2% -> 3% for his team',FXJ,"ra_2_2:[ {param:'jud.team',add:R(0.02)} ]","ra_2_2:[ {param:'jud.team',add:R(0.03)} ]",'his allies'],
  ['Townsfolk 1% -> 2%',FXJ,"pr_9_1:[ {param:'tf',add:R(0.01)} ]","pr_9_1:[ {param:'tf',add:R(0.02)} ]",'his allies'],
  // ---- controls and healing ----
  ['Unbroken Will 4% -> 5%',FXJ,"hm_5_1:[ {param:'ten.all',add:R(0.04)} ]","hm_5_1:[ {param:'ten.all',add:R(0.05)} ]",'controls on him'],
  ['Wakeful on stuns too',FXJ,"if(f==='fearT') k*=1-(P['ten.fear']||0);","k*=1-(P['ten.fear']||0);",'controls on him'],
  ['Warm Thanks 0.1% -> 0.2%',FXJ,"pr_5_1:[ {param:'rg.wt',add:R(0.001)} ]","pr_5_1:[ {param:'rg.wt',add:R(0.002)} ]",'healing each second'],
  ['Keep Them Close 3 m -> 6 m',FXJ,"<3*E.METER()) a+=P['rg.ktc'];","<6*E.METER()) a+=P['rg.ktc'];",'healing each second'],
  // ---- Sanctuary Guard ----
  ['Long Guard 0.2 -> 0.3',FXJ,"hm_4_3:[ {on:'kit',skill:SG,opt:{dur:{add:R(0.2)}}} ]","hm_4_3:[ {on:'kit',skill:SG,opt:{dur:{add:R(0.3)}}} ]",'Sanctuary Guard: Long'],
  ['Bulwark 3% -> 4%',FXJ,"hm_10_2:[ {on:'kit',skill:SG,opt:{mul:{more:R(0.03)}}} ]","hm_10_2:[ {on:'kit',skill:SG,opt:{mul:{more:R(0.04)}}} ]",'Sanctuary Guard: Long'],
  ['Word Given Twice 0.2 -> 0.3',FXJ,"pr_8_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ]","pr_8_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ]",'Sanctuary Guard: Long'],
  ['Unmoved Guard always',FXJ,"hm_5_2:[ {on:'tick',if:{window:'jSgW'},","hm_5_2:[ {on:'tick',",'Sanctuary Guard: Long'],
  ['Only You picks anyone',FXJ,"pr_5_2:[ {on:'skillTgt',skill:SG,do:[{retarget:'holder:jPro'}]}, ","pr_5_2:[ ",'choice'],
  ['Only You 25% -> 30%',FXJ,"{on:'kit',skill:SG,opt:{mul:{more:0.25}}} ]","{on:'kit',skill:SG,opt:{mul:{more:0.30}}} ]",'choice'],
  ['Two Promises at full strength',FXJ,"b.shield=Math.max(b.shield||0,g.v*0.5);","b.shield=Math.max(b.shield||0,g.v);",'choice'],
  ['Not Yet below 50%',FXJ,"x!==u&&u.hp<0.3*u.maxHp){ u.shield=","x!==u&&u.hp<0.5*u.maxHp){ u.shield=",'choice'],
  ['Never Broken 2 s',FXJ,"s.joNb=true; x._wardT+=1;","s.joNb=true; x._wardT+=2;",'choice'],
  ['Never Broken twice a cast',FXJ,"if(!x||!x.alive||s.joNb) return;","if(!x||!x.alive) return;",'choice'],
  // ---- Kept Word and the Promise ----
  ['Kept Word from any hold',FXJ,"{on:'teamHeld',reqAny:KW,if:{unitHas:'jSg'},do:[{fn:'kept'}]}","{on:'teamHeld',reqAny:KW,do:[{fn:'kept'}]}",'Kept Word'],
  ['Promise Fulfilled 3% -> 4%',FXJ,"pr_6_3:[ {param:'kw.heal',add:R(0.03)} ]","pr_6_3:[ {param:'kw.heal',add:R(0.04)} ]",'Kept Word'],
  ['Town\'s Gift 1 -> 2',FXJ,"pr_6_1:[ {on:'wave',once:'fight',do:[{stack:'jKW',add:R(1)}]} ]","pr_6_1:[ {on:'wave',once:'fight',do:[{stack:'jKW',add:R(2)}]} ]",'Kept Word'],
  ['Promise Weight 2 a rank',FXJ,"pr_10_3:[ {param:'kw.max',add:R(1)} ]","pr_10_3:[ {param:'kw.max',add:R(2)} ]",'Kept Word'],
  ['Kept Word 1% -> 2%',FXJ,"pr_1_3:[ {stat:{apow:R(0.01)},per:'jKW'} ]","pr_1_3:[ {stat:{apow:R(0.02)},per:'jKW'} ]",'Kept Word'],
  ['the Promise on himself',FXJ,"if(x!==u){ if(PRO.some(id=>T.r[id]))","if(true){ if(PRO.some(id=>T.r[id]))",'the Promise:'],
  ['Close Promise 0.2% -> 0.3%',FXJ,"pr_2_4:[ {on:'tick',period:1,do:[{heal:{pct:R(0.002),","pr_2_4:[ {on:'tick',period:1,do:[{heal:{pct:R(0.003),",'the Promise:'],
  ['Shoulder Guard 1% -> 2%',FXJ,"pr_4_4:[ {param:'sh.arm',add:R(0.01)}","pr_4_4:[ {param:'sh.arm',add:R(0.02)}",'the Promise:'],
  ['Shoulder Guard kept by the old holder',FXJ,"if(s.joShX&&s.joShX!==h){ s.joShX.armorRating=(s.joShX.armorRating||0)-(s.joShV||0);","if(s.joShX&&s.joShX!==h){ s.joShX.armorRating=(s.joShX.armorRating||0);",'the Promise:'],
  ['Always Return every 5 s',FXJ,"edge:true,icd:10,do:[{cd:'blue',add:-3}]}","edge:true,icd:5,do:[{cd:'blue',add:-3}]}",'the Promise:'],
  ['Back to Back above 30%',FXJ,"u.hp>0.5*u.maxHp&&h.hp>0.5*h.maxHp","u.hp>0.3*u.maxHp&&h.hp>0.3*h.maxHp",'the Promise:'],
  ['Mind the Gate 5 s -> 6 s',FXJ,"A.setMark(T,u,s,'jMind',{dur:5});","A.setMark(T,u,s,'jMind',{dur:6});",'the Promise:'],
  ['Steady Promise 3% -> 4%',FXJ,"t[f]=c.amt*(1-0.03*(T.r.pr_8_4||0));","t[f]=c.amt*(1-0.04*(T.r.pr_8_4||0));",'the Promise:'],
  ['Given Word: faster walking away',FXJ,"(mx*(h.x-u.x)+my*(h.y-u.y))>0","(mx*(h.x-u.x)+my*(h.y-u.y))<0",'the Promise:'],
  ['Hammer Between Them picks nobody',FXJ,"if(x&&x.alive&&x.team!==u.team){ c.tgt=x; T.s.joHbt=x; }","if(x&&x.alive&&x.team!==u.team){ T.s.joHbt=x; }",'Hammer Between Them'],
  ['Hammer Between Them 0.3 s -> 0.4 s',FXJ,"if(s.joHbt===t) x+=0.3;","if(s.joHbt===t) x+=0.4;",'Hammer Between Them'],
  ['I Will Hold twice a wave',FXJ,"pr_11_4:[ {on:'teamLethal',if:{fn:'unitPro'},once:'wave',","pr_11_4:[ {on:'teamLethal',if:{fn:'unitPro'},",'Hammer Between Them'],
  ['I Will Hold leaves the ally at 1 HP',FXJ,"x.hp=Math.max(1,x.hp+a); c.stop=true;","x.hp=1; c.stop=true;",'Hammer Between Them'],
  ['Carried Like a Promise every 20 s',FXJ,"{window:'jCarW',dur:3,cd:25}","{window:'jCarW',dur:3,cd:20}",'Hammer Between Them'],
  ['Carried Like a Promise 4 s',FXJ,"{mark:'jCar',on:'target',dur:3,ends:'jCarEnd'}","{mark:'jCar',on:'target',dur:4,ends:'jCarEnd'}",'Hammer Between Them'],
  ['Carried Like a Promise 20 energy',FXJ,"u.energy=Math.min(100,(u.energy||0)+25);","u.energy=Math.min(100,(u.energy||0)+20);",'Hammer Between Them'],
  // ---- Gratitude ----
  ['Gratitude 8 s -> 9 s',FXJ,"dur:P('gra.dur',8),cap:4}]}","dur:P('gra.dur',9),cap:4}]}",'Gratitude'],
  ['Gratitude up to 5',FXJ,"dur:P('gra.dur',8),cap:4}]}","dur:P('gra.dur',8),cap:5}]}",'Gratitude'],
  ['Gratitude on himself',FXJ,"isAlly(A,T,u,c){ const x=c.tgt; return !!x&&x!==u&&","isAlly(A,T,u,c){ const x=c.tgt; return !!x&&",'Gratitude'],
  ['Thankful 1 s -> 2 s',FXJ,"pr_3_1:[ {param:'gra.dur',add:R(1)} ]","pr_3_1:[ {param:'gra.dur',add:R(2)} ]",'Gratitude'],
  ['Many Thanks 0.4% -> 0.5%',FXJ,"pr_7_1:[ {stat:{apow:R(0.004)}","pr_7_1:[ {stat:{apow:R(0.005)}",'Gratitude'],
  ['Last Thanks 3% -> 4%',FXJ,"if:{unitHas:'jGra',who:'ally'},do:[{heal:{pct:R(0.03),","if:{unitHas:'jGra',who:'ally'},do:[{heal:{pct:R(0.04),",'Gratitude'],
  ['Shared Morning 2% -> 3%',FXJ,"if:{targetHas:'jGra'},more:R(0.02)} ]","if:{targetHas:'jGra'},more:R(0.03)} ]",'Gratitude'],
  ['Morning Prayer 2% -> 3%',FXJ,"pr_9_2:[ {on:'healOut',skill:DJ,more:R(0.02)} ]","pr_9_2:[ {on:'healOut',skill:DJ,more:R(0.03)} ]",'Gratitude'],
  // ---- Radiant Hammer ----
  ['Hammerlight 4% -> 5%',FXJ,"ra_1_1:[ {on:'out',if:{casting:RH},more:R(0.04),per:{fn:'hlN'}} ]","ra_1_1:[ {on:'out',if:{casting:RH},more:R(0.05),per:{fn:'hlN'}} ]",'Hammerlight:'],
  ['Hammerlight from every hit',FXJ,"{on:'hit',reqAny:HL,if:{auto:true,targetTeam:'enemy'},do:[{stack:'jHL',add:1}]}","{on:'hit',reqAny:HL,if:{targetTeam:'enemy'},do:[{stack:'jHL',add:1}]}",'Hammerlight:'],
  ['Bright Swing never',FXJ,"chance:R(0.33),do:[{stack:'jHL',add:1}]}","chance:R(0),do:[{stack:'jHL',add:1}]}",'Hammerlight:'],
  ['Full Charge 50% -> 60%',FXJ,"{dmg:{pct:0.5,of:'hit'},on:{team:'enemy',of:'target',within:2,skip:'target'}}","{dmg:{pct:0.6,of:'hit'},on:{team:'enemy',of:'target',within:2,skip:'target'}}",'Hammerlight:'],
  ['Gathering Light 0.4% -> 0.5%',FXJ,"ra_4_1:[ {stat:{atk:R(0.004)},per:'jHL'} ]","ra_4_1:[ {stat:{atk:R(0.005)},per:'jHL'} ]",'Hammerlight:'],
  ['Light in the Hand 0.1% -> 0.2%',FXJ,"ra_11_1:[ {stat:{crit:R(0.001)},per:'jHL'} ]","ra_11_1:[ {stat:{crit:R(0.002)},per:'jHL'} ]",'Hammerlight:'],
  ['Overflowing Light 0.3% -> 0.5%',FXJ,"ra_8_1:[ {on:'cast',skill:RH,do:[{heal:{pct:R(0.003),","ra_8_1:[ {on:'cast',skill:RH,do:[{heal:{pct:R(0.005),",'Hammerlight:'],
  ['First Strike of Day on every Radiant Hammer',FXJ,"ra_6_4:[ {on:'out',if:{casting:RH},once:'wave',","ra_6_4:[ {on:'out',if:{casting:RH},",'Hammerlight:'],
  ['Morning Glint 2 -> 1',FXJ,"ra_6_1:[ {on:'wave',do:[{stack:'jHL',add:R(2)}]} ]","ra_6_1:[ {on:'wave',do:[{stack:'jHL',add:R(1)}]} ]",'Hammerlight:'],
  ['Long Light 1 -> 2',FXJ,"ra_12_1:[ {param:'hl.keep',add:R(1)} ]","ra_12_1:[ {param:'hl.keep',add:R(2)} ]",'Hammerlight:'],
  ['Hammerlight kept between waves',FXJ,"Math.min(stN(T,'jHL'),T.P['hl.keep']||0)","Math.min(stN(T,'jHL'),T.P['hl.keep']||5)",'Hammerlight:'],
  ['Humbled 6 s -> 7 s',FXJ,"{mark:'jHum',on:'target',dur:P('hum.dur',6),longest:true}]},","{mark:'jHum',on:'target',dur:P('hum.dur',7),longest:true}]},",'Humbled:'],
  ['Brought Low 0.5 -> 0.6',FXJ,"ra_3_4:[ {param:'hum.dur',add:R(0.5)} ]","ra_3_4:[ {param:'hum.dur',add:R(0.6)} ]",'Humbled:'],
  ['Humbled basic attacks 4% -> 5%',FXJ,"{on:'out',if:{auto:true,targetHas:'jHum'},more:R(0.04)}","{on:'out',if:{auto:true,targetHas:'jHum'},more:R(0.05)}",'Humbled:'],
  ['Lowly 2% -> 3%',FXJ,"ra_5_4:[ {stat:{aspd:R(-0.02)}","ra_5_4:[ {stat:{aspd:R(-0.03)}",'Humbled:'],
  ['Pride Brought Down 4% -> 5%',FXJ,"ra_7_4:[ {on:'teamHeal',if:{unitHas:'jHum'},less:R(0.04)} ]","ra_7_4:[ {on:'teamHeal',if:{unitHas:'jHum'},less:R(0.05)} ]",'Humbled:'],
  ['Fallen Pride 3% -> 4%',FXJ,"ra_12_4:[ {on:'death',if:{unitHas:'jHum'},do:[{heal:{pct:R(0.03),","ra_12_4:[ {on:'death',if:{unitHas:'jHum'},do:[{heal:{pct:R(0.04),",'Humbled:'],
  ['On Your Knees crush 50% -> 70%',FXJ,"t._atkDnPct=Math.max(t._atkDnPct||0,0.50); } },","t._atkDnPct=Math.max(t._atkDnPct||0,0.70); } },",'Humbled:'],
  ['On Your Knees 0.5 s -> 0.6 s',FXJ,"if(P.knee&&s.joKnee) x+=0.5;","if(P.knee&&s.joKnee) x+=0.6;",'Humbled:'],
  ['On Your Knees never gives the crush back',FXJ,"if(t._atkDnPct===0.50) t._atkDnPct=t._joCr0; t._joCr0=undefined;","t._joCr0=undefined;",'Humbled:'],
  ['Judged 5 s -> 6 s',FXJ,"do:[{mark:'jJud',on:'target',dur:P('jud.dur',5),longest:true}]},   //","do:[{mark:'jJud',on:'target',dur:P('jud.dur',6),longest:true}]},   //",'Judged:'],
  ['Weight of Judgment 0.5 -> 0.6',FXJ,"ra_4_2:[ {param:'jud.dur',add:R(0.5)} ]","ra_4_2:[ {param:'jud.dur',add:R(0.6)} ]",'Judged:'],
  ['Sentence Read 3% -> 4%',FXJ,"ra_6_2:[ {on:'out',if:{targetHas:'jJud'},critMore:R(0.03)} ]","ra_6_2:[ {on:'out',if:{targetHas:'jJud'},critMore:R(0.04)} ]",'Judged:'],
  ['The Last Ruling 30% -> 35%',FXJ,"targetHpBelow:0.25},more:0.30} ]","targetHpBelow:0.25},more:0.35} ]",'Judged:'],
  ['Gate Plate 2% -> 3%',FXJ,"ra_9_3:[ {stat:{armor:R(0.02)}","ra_9_3:[ {stat:{armor:R(0.03)}",'Judged:'],
  ['Verdict 2% -> 3%',FXJ,"ra_12_2:[ {on:'out',if:{casting:DJ,targetHas:'jJud'},more:R(0.02)} ]","ra_12_2:[ {on:'out',if:{casting:DJ,targetHas:'jJud'},more:R(0.03)} ]",'Judged:'],
  ['Morning of Judgment Humbled 4 s -> 5 s',FXJ,"{mark:'jHum',on:'target',dur:4,longest:true}]} ]","{mark:'jHum',on:'target',dur:5,longest:true}]} ]",'Judged:'],
  ['Mercy 15% -> 20%',FXJ,"{heal:{pct:P('mercy',0.15),of:'hit'}","{heal:{pct:P('mercy',0.20),of:'hit'}",'Judged:'],
  ['Healing Mercy 3 -> 4 points',FXJ,"ra_6_3:[ {param:'mercy',add:R(0.03)} ]","ra_6_3:[ {param:'mercy',add:R(0.04)} ]",'Judged:'],
  ['Ringing Blow 0.1 -> 0.2',FXJ,"ra_n1:[ {param:'ext.all',add:R(0.1)} ]","ra_n1:[ {param:'ext.all',add:R(0.2)} ]",'stuns made longer'],
  ['Gate Held 0.1 -> 0.2',FXJ,"hm_9_2:[ {param:'ext.dj',add:R(0.1)} ]","hm_9_2:[ {param:'ext.dj',add:R(0.2)} ]",'stuns made longer'],
  ['the sentence every 14 s',FXJ,"if(!(now<w.cdT)){ w.cdT=now+15;","if(!(now<w.cdT)){ w.cdT=now+14;",'Sentence at Sunrise'],
  ['the sentence no critical',FXJ,"{on:'crit',if:{casting:RH,fn:'senOn'},force:true}","{on:'crit',if:{casting:RH,fn:'senOn'},force:false}",'Sentence at Sunrise'],
  ['the sentence 1.0 s longer',FXJ,"if(s.joSen===t) x+=1.5;","if(s.joSen===t) x+=1.0;",'Sentence at Sunrise'],
  ['the sentence 60% to the others',FXJ,"{dmg:{pct:0.5,of:'hit'},on:{team:'enemy',of:'target',within:6,has:'jJud',skip:'target'}}","{dmg:{pct:0.6,of:'hit'},on:{team:'enemy',of:'target',within:6,has:'jJud',skip:'target'}}",'Sentence at Sunrise'],
  ['the sentence on an enemy not Judged',FXJ,"(s.joHl||0)>=5&&mk(u,t,'jJud',now)){","(s.joHl||0)>=5){",'Sentence at Sunrise'],
  ['the sentence at 4 Hammerlight',FXJ,"(s.joHl||0)>=5&&mk(u,t,'jJud',now)){","(s.joHl||0)>=4&&mk(u,t,'jJud',now)){",'Sentence at Sunrise'],
  // ---- his skills, Daybreak at the Gate, Gate Splinters ----
  ['Promise Hammer 4% -> 5%',FXJ,"hm_2_3:[ {on:'out',if:{casting:RH},more:R(0.04)} ]","hm_2_3:[ {on:'out',if:{casting:RH},more:R(0.05)} ]",'his skills'],
  ['Judgment Weight 3% -> 4%',FXJ,"hm_9_3:[ {on:'out',if:{casting:DJ},more:R(0.03)} ]","hm_9_3:[ {on:'out',if:{casting:DJ},more:R(0.04)} ]",'his skills'],
  ['Holy Iron 2% -> 3%',FXJ,"hm_11_3:[ {on:'out',if:{casting:SK},ignoreMr:R(0.02)} ]","hm_11_3:[ {on:'out',if:{casting:SK},ignoreMr:R(0.03)} ]",'his skills'],
  ['Hammer Rhythm 2% -> 3%',FXJ,"ra_7_1:[ {on:'out',if:{auto:true},more:R(0.02)} ]","ra_7_1:[ {on:'out',if:{auto:true},more:R(0.03)} ]",'his skills'],
  ['Gatekeeper\'s Patience 0.3 -> 0.4',FXJ,"hm_7_1:[ {on:'cd',skill:'green',add:R(-0.3)} ]","hm_7_1:[ {on:'cd',skill:'green',add:R(-0.4)} ]",'his skills'],
  ['Early Swing 0.2 -> 0.3',FXJ,"ra_10_1:[ {on:'cd',skill:'green',add:R(-0.2)} ]","ra_10_1:[ {on:'cd',skill:'green',add:R(-0.3)} ]",'his skills'],
  ['Daybreak at the Gate 2% damage each',FXJ,"{on:'out',if:{casting:DJ},more:0.01,per:{fn:'dgN'}}","{on:'out',if:{casting:DJ},more:0.02,per:{fn:'dgN'}}",'Daybreak at the Gate'],
  ['Daybreak at the Gate 2% healing each',FXJ,"{on:'healOut',skill:DJ,more:0.01,per:{fn:'dgN'}}","{on:'healOut',skill:DJ,more:0.02,per:{fn:'dgN'}}",'Daybreak at the Gate'],
  ['Daybreak at the Gate 0.6% shield each',FXJ,"{shield:{pct:0.005,of:'maxHp',x:{fn:'dgN'}},dur:6}","{shield:{pct:0.006,of:'maxHp',x:{fn:'dgN'}},dur:6}",'Daybreak at the Gate'],
  ['Daybreak at the Gate keeps the Dawnlight',FXJ,"dgKit(A,T,u){ T.s.joDg=stN(T,'jDawn'); A.stSet(T,u,'jDawn',0); },","dgKit(A,T,u){ T.s.joDg=stN(T,'jDawn'); },",'Daybreak at the Gate'],
  ['Gate Splinters 10% -> 12%',FXJ,"hm_12_4:[ {on:'hurt',if:{selfHpBelow:0.3},do:[{dmg:{pct:R(0.10),","hm_12_4:[ {on:'hurt',if:{selfHpBelow:0.3},do:[{dmg:{pct:R(0.12),",'Daybreak at the Gate'],
];

const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ const ex=[...SKIP].map(k=>'--exclude=./'+k).join(' ');
  const r=cp.spawnSync('bash',['-c','tar cf - '+ex+' . | tar xf - -C "'+dir+'"'],{cwd:root,encoding:'utf8',maxBuffer:1<<26});
  if(!fs.existsSync(path.join(dir,HTML))) throw new Error('copy failed: rc '+r.status+' '+String(r.stderr||r.error||'').slice(0,400));
  for(const k of ['node_modules','assets','.bin','.base']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ctl-joss-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-joss.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    const why=/error: [^\n]*/.exec(out); return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')+(why?' | '+why[0].slice(0,140):'')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
{ const d=fs.mkdtempSync(path.join(os.tmpdir(),'ctl-joss-')); try{ copyTo(d); const r=cp.spawnSync(process.execPath,['--test','tests/talents-mech-joss.test.js'],{cwd:d,env:process.env,encoding:'utf8',maxBuffer:1<<26}); const o=(r.stdout||'')+(r.stderr||'');
  console.log('BASELINE (nothing broken, every test): '+((/# fail (\d+)/.exec(o)||[])[0])+', '+((/# pass (\d+)/.exec(o)||[])[0])); if(!/# fail 0/.test(o)){ console.log(o.slice(-3000)); process.exit(1); } } finally{ fs.rmSync(d,{recursive:true,force:true}); } }
const out=[]; for(const c of C){ const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }   // one copy at a time
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
