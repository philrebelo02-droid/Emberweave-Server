'use strict';
/* The controls for Quorrel's talent tests (run on the cluster through tools/remote_test.sh as a plain node script, TOGETHER with
   tests/talents-mech-quorrel.test.js: the runner sends the pre-talent page only for SHAs named in the files of the run). Each control copies this checkout to
   a folder under os.tmpdir() (which follows TMPDIR: on the cluster a folder beside the slot, wiped after the run), breaks ONE thing there (exact text swaps in
   emberweave-heroes.html or in the generated talents-fx.js: the page line his talents added, an unguarded seeded draw at it, or a row, a cap or a function of
   his), runs the named tests of tests/talents-mech-quorrel.test.js in that copy, and expects them to FAIL. One copy at a time; each is deleted as soon as it
   has run; .logs, node_modules and the art are not copied (node_modules and assets are linked). The checkout itself is never changed.
   Prints one line per control and a count; exits 1 if any was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page line his talents added (removed: his tests fail), and an unguarded seeded draw at it (the no-talent identity test fails) ----
  ['writ landPre removed',HTML,[["if(e.alive){ if(u._tal) TalentFx.landPre(u,e,'volley');","if(e.alive){ "]],'Contempt Storm|Sentenced'],
  ['writ land removed',HTML,[["if(u._tal) TalentFx.land(u,e,'volley');   /* TALENT HOOK land: a writ has landed */",""]],'Contempt Storm'],
  ['draw at the writ site',HTML,[["if(e.alive){ if(u._tal) TalentFx.landPre(u,e,'volley');","if(e.alive){ brnd(); if(u._tal) TalentFx.landPre(u,e,'volley');"]],'no talents'],
  // ---- his capped groups and limits ----
  ['damage-reduction group 25% -> 30%',FXJ,[["const DR_CAP=0.25, CRIT_CAP","const DR_CAP=0.30, CRIT_CAP"]],'damage reduction'],
  ['crit group 5% -> 6%',FXJ,[["DR_CAP=0.25, CRIT_CAP=0.05,","DR_CAP=0.25, CRIT_CAP=0.06,"]],'crit group'],
  ['slow group 40% -> 45%',FXJ,[["SLOW_CAP=0.40, TEN_CAP","SLOW_CAP=0.45, TEN_CAP"]],'slows and controls'],
  ['control group 50% -> 55%',FXJ,[["TEN_CAP=0.50, REGEN","TEN_CAP=0.55, REGEN"]],'slows and controls'],
  ['regeneration 1.2% -> 2%',FXJ,[["REGEN=0.012, BANK=5","REGEN=0.02, BANK=5"]],'Gavels:'],
  ['budget kept 5 s -> 6 s',FXJ,[["REGEN=0.012, BANK=5","REGEN=0.012, BANK=6"]],'Gavels:'],
  ['in a row 4.0 -> 4.5',FXJ,[["RUN_TOP=4.0, LOCK","RUN_TOP=4.5, LOCK"]],'Precedent'],
  ['lock 0.5 s -> 0.1 s',FXJ,[["LOCK=0.5, SIG_CD","LOCK=0.1, SIG_CD"]],'Precedent|stun-lock rule for'],
  ['signatures every 24 s',FXJ,[["SIG_CD=25, CT_FLOOR","SIG_CD=24, CT_FLOOR"]],'Court Is in Session'],
  ['Contempt floor 4 -> 3',FXJ,[["CT_FLOOR=4, GO_FLOOR","CT_FLOOR=3, GO_FLOOR"]],'cooldowns'],
  ['Gag Order floor 5 -> 4',FXJ,[["GO_FLOOR=5, DAY_EVERY","GO_FLOOR=4, DAY_EVERY"]],'cooldowns'],
  ['a Day every 9 s',FXJ,[["DAY_EVERY=10, GV_MAX","DAY_EVERY=9, GV_MAX"]],'Days'],
  ['7 Gavels on the field',FXJ,[["GV_MAX=6, SIG1_MIN","GV_MAX=7, SIG1_MIN"]],'Gavels:'],
  ['the court at 3 stunned',FXJ,[["SIG1_MIN=2;","SIG1_MIN=3;"]],'Court Is in Session'],
  ['the court\'s cooldown as an absolute fight time',FXJ,[["if(!T.P.sig1||q.s1>0||q.goN<SIG1_MIN","if(!T.P.sig1||q.s1>0||A.eng().now()<(q.s1a||-1)||q.goN<SIG1_MIN"],["q.s1=SIG_CD; q.cw=5;","q.s1=SIG_CD; q.s1a=A.eng().now()+SIG_CD; q.cw=5;"]],'Court Is in Session'],
  // ---- stuns ----
  ['stunHit row removed',FXJ,[["    {on:'ccHit',if:{cc:['stunned']},do:[{fn:'stunHit'}]},",""]],'Precedent'],
  ['talent stun on a stunned enemy',FXJ,[["if((t.stunned||0)>0){ q.ts.onStun++; return false; }",""]],'Contempt:|stun-lock rule for'],
  ['talent stun inside the lock',FXJ,[["if(r&&(r.lk>0||r.cap>0)){ q.ts.lkOk++; return false; }",""]],'Contempt:|stun-lock rule for'],
  ['no lock when his stun ends',FXJ,[["r.st=0; r.re=0; r.lk=LOCK; if(r.hc){","r.st=0; r.re=0; if(r.hc){"]],'stun-lock rule for'],
  ['the 4.0 s run not cut',FXJ,[["const room=run?Math.max(0,RUN_TOP-r.re):RUN_TOP,","const room=RUN_TOP,"]],'Precedent'],
  ['no break after a capped run',FXJ,[["if(r.re>=RUN_TOP-0.05) r.cap=LOCK; ",""]],'Precedent'],
  ['Precedent not counted in the extension',FXJ,[["let x=(P['ext.pre']||0)*stN(T,'qPre')","let x=(P['ext.pre']||0)*0"]],'Precedent'],
  ['Precedent 0.02 -> 0.03',FXJ,[["oc_1_3:[ {param:'ext.pre',add:R(0.02)} ]","oc_1_3:[ {param:'ext.pre',add:R(0.03)} ]"]],'Precedent'],
  ['Silence in Court on every stun',FXJ,[["if(src===GO&&P['ext.go']) x+=P['ext.go'];","if(P['ext.go']) x+=P['ext.go'];"]],'Precedent'],
  ['Precedent from Contempt too',FXJ,[["if((!c.talent&&src===GO)||q.cw>0) A.stSet(T,u,'qPre'","if((!c.talent)||q.cw>0) A.stSet(T,u,'qPre'"]],'Precedent'],
  ['Standing Order 0.04 -> 0.05',FXJ,[["oc_8_3:[ {param:'ext.all',add:R(0.04)} ]","oc_8_3:[ {param:'ext.all',add:R(0.05)} ]"]],'Precedent'],
  ['Know the Docket 0.05 -> 0.06',FXJ,[["oc_n1:[ {param:'ext.dk',add:R(0.05)} ]","oc_n1:[ {param:'ext.dk',add:R(0.06)} ]"]],'Precedent'],
  ['Know the Docket up to 4',FXJ,[["q.dk=Math.min(3,n);","q.dk=Math.min(4,n);"]],'Precedent'],
  ['Long Record 1 -> 2',FXJ,[["oc_11_3:[ {param:'pre.max',add:R(1)} ]","oc_11_3:[ {param:'pre.max',add:R(2)} ]"]],'Precedent'],
  ['Case Law 0.5% -> 0.6%',FXJ,[["oc_2_3:[ {stat:{atk:R(0.005)},per:'qPre'} ]","oc_2_3:[ {stat:{atk:R(0.006)},per:'qPre'} ]"]],'Precedent'],
  ['Bound by Precedent below full',FXJ,[["oc_12_3:[ {on:'out',if:{casting:GO,stackFull:'qPre'},more:R(0.04)} ]","oc_12_3:[ {on:'out',if:{casting:GO},more:R(0.04)} ]"]],'Precedent'],
  // ---- Cut Short ----
  ['Cut Short 0.3 -> 0.4',FXJ,[["oc_1_4:[ {param:'cs.cd',add:R(0.3)} ]","oc_1_4:[ {param:'cs.cd',add:R(0.4)} ]"]],'Cut Short'],
  ['Mid-Sentence 0.15 -> 0.2',FXJ,[["oc_2_4:[ {param:'cs.atk',add:R(0.15)} ]","oc_2_4:[ {param:'cs.atk',add:R(0.2)} ]"]],'Cut Short'],
  ['Overruled 4 s -> 5 s',FXJ,[["if(P['cs.ovr']) r.ow=4;","if(P['cs.ovr']) r.ow=5;"]],'Cut Short'],
  ['Overruled 1% -> 2%',FXJ,[["{stat:{atk:R(-0.01)},to:{team:'enemy',fn:'ovrOn'}}","{stat:{atk:R(-0.02)},to:{team:'enemy',fn:'ovrOn'}}"]],'Cut Short'],
  // ---- damage reduction ----
  ['Bench Posture 3 s -> 4 s',FXJ,[["r.bp=Math.max(r.bp,L+3);","r.bp=Math.max(r.bp,L+4);"]],'damage reduction'],
  ['Bench Posture 2% -> 3%',FXJ,[["oc_3_1:[ {param:'dr.bench',add:R(0.02)} ]","oc_3_1:[ {param:'dr.bench',add:R(0.03)} ]"]],'damage reduction'],
  ['Chamber Calm 1% -> 2%',FXJ,[["oc_10_2:[ {param:'dr.calm',add:R(0.01)} ]","oc_10_2:[ {param:'dr.calm',add:R(0.02)} ]"]],'damage reduction'],
  ['No Sleep 1.5% -> 2%',FXJ,[["ed_6_1:[ {param:'dr.nosleep',add:R(0.015)} ]","ed_6_1:[ {param:'dr.nosleep',add:R(0.02)} ]"]],'damage reduction'],
  ['Old Robes on physical hits too',FXJ,[["kind==='magic'&&tsOf(T,src)>0","tsOf(T,src)>0"]],'damage reduction'],
  ['Legal Tradition from any row',FXJ,[["if(P['dr.back']&&src.t&&src.t.row==='Back')","if(P['dr.back']&&src.t)"]],'damage reduction'],
  // ---- Gag Order, Contempt, his hits ----
  ['Wider Seal 0.2 -> 0.3',FXJ,[["oc_4_3:[ {on:'kit',skill:GO,opt:{radius:{addM:R(0.2)}}} ]","oc_4_3:[ {on:'kit',skill:GO,opt:{radius:{addM:R(0.3)}}} ]"]],'Gag Order:'],
  ['Firm Hand 5% -> 6%',FXJ,[["oc_4_2:[ {on:'out',if:{casting:GO},more:R(0.05)} ]","oc_4_2:[ {on:'out',if:{casting:GO},more:R(0.06)} ]"]],'Gag Order:'],
  ['Gavel Rain 1% -> 2%',FXJ,[["sg_12_2:[ {on:'out',if:{casting:GO},more:R(0.01),per:{fn:'gvN'}} ]","sg_12_2:[ {on:'out',if:{casting:GO},more:R(0.02),per:{fn:'gvN'}} ]"]],'Gag Order:'],
  ['Clear the Gallery 2 m -> 3 m',FXJ,[["do:[{push:'target',m:2,secs:0.3}]","do:[{push:'target',m:3,secs:0.3}]"]],'Gag Order:'],
  ['Removed 6% -> 7%',FXJ,[["do:[{slow:R(0.06),dur:2,on:'target'}]","do:[{slow:R(0.07),dur:2,on:'target'}]"]],'Gag Order:'],
  ['Removed on an immovable enemy',FXJ,[["targetTeam:'enemy',fn:'movable'},do:[{slow:R(0.06)","targetTeam:'enemy'},do:[{slow:R(0.06)"]],'Gag Order:'],
  ['Not Finished without a cast',FXJ,[["if(P.nf&&t._pend&&t._pend.spell)","if(P.nf)"]],'Contempt:'],
  ['Held in Contempt 30% -> 35%',FXJ,[["{slow:0.30,dur:2,on:'target'}","{slow:0.35,dur:2,on:'target'}"]],'Contempt:'],
  ['Gavel Down 5% -> 6%',FXJ,[["oc_10_3:[ {on:'out',if:{casting:CT},more:R(0.05)} ]","oc_10_3:[ {on:'out',if:{casting:CT},more:R(0.06)} ]"]],'Contempt:'],
  ['Contempt Twice 60%',FXJ,[["{dmg:0.5*q.ctHit,on:'target'}","{dmg:0.6*q.ctHit,on:'target'}"]],'Contempt:'],
  ['Contempt Twice 6 m',FXJ,[["{team:'enemy',of:'target',within:3,skip:'target',n:1}","{team:'enemy',of:'target',within:6,skip:'target',n:1}"]],'Contempt:'],
  ['Contempt Twice a 1 s stun',FXJ,[["if(t===q.ctT) q.ctSt=c.amt||0;","if(t===q.ctT) q.ctSt=1;"]],'Contempt:'],
  ['Contempt of Court on a tie',FXJ,[["if(best&&bn>cn&&best!==cur)","if(best&&bn>=cn&&best!==cur)"]],'Contempt:'],
  ['Contempt of Court keeps the new target',FXJ,[["if(q.ctPrev!==undefined){ if(q.ctPrev&&q.ctPrev.alive) u.target=q.ctPrev;","if(q.ctPrev!==undefined){ "]],'Contempt:'],
  ['Contempt of Court 8% -> 9%',FXJ,[["{on:'out',if:{casting:CT},more:0.08,per:{fn:'tsN'}}","{on:'out',if:{casting:CT},more:0.09,per:{fn:'tsN'}}"]],'Contempt:'],
  ['Writs 2% -> 3%',FXJ,[["oc_7_2:[ {on:'out',if:{auto:true},more:R(0.02)} ]","oc_7_2:[ {on:'out',if:{auto:true},more:R(0.03)} ]"]],'his hits'],
  ['Rapid Rulings 3% -> 4%',FXJ,[["ed_4_3:[ {on:'out',if:{auto:true},more:R(0.03)} ]","ed_4_3:[ {on:'out',if:{auto:true},more:R(0.04)} ]"]],'his hits'],
  ['Strike From the Record 2% -> 3%',FXJ,[["oc_9_1:[ {on:'out',if:{fn:'tgtStunned'},more:R(0.02)} ]","oc_9_1:[ {on:'out',if:{fn:'tgtStunned'},more:R(0.03)} ]"]],'his hits'],
  ['Procedure 2% -> 3%',FXJ,[["oc_8_4:[ {on:'out',if:{fn:'tgtStunned'},critMore:R(0.02)} ]","oc_8_4:[ {on:'out',if:{fn:'tgtStunned'},critMore:R(0.03)} ]"]],'his hits'],
  ['Long Session at 14 s',FXJ,[["return Q(T).wt>=15-1e-9;","return Q(T).wt>=14-1e-9;"]],'his hits'],
  ['Long Session kept between waves',FXJ,[["q.e={}; q.otr=0; q.wt=0; q.csXd=1;","q.e={}; q.otr=0; q.csXd=1;"]],'his hits'],
  ['Court Seal 2% -> 3%',FXJ,[["oc_3_2:[ {on:'out',ignoreArmor:R(0.02)} ]","oc_3_2:[ {on:'out',ignoreArmor:R(0.03)} ]"]],'his hits'],
  // ---- stats on conditions ----
  ['Chitin Robes with nobody held',FXJ,[["if(r.st>0&&r.u.alive&&(r.u.stunned||0)>0) return true;","return true;"]],'stats on conditions'],
  ['Chitin Robes 2% -> 3%',FXJ,[["oc_5_4:[ {stat:{mr:R(0.02)},if:{fn:'anyHeld'}} ]","oc_5_4:[ {stat:{mr:R(0.03)},if:{fn:'anyHeld'}} ]"]],'stats on conditions'],
  ['Court Chitin at 2 Gavels',FXJ,[["gv3(A,T){ return gvCount(T)>=3; }","gv3(A,T){ return gvCount(T)>=2; }"]],'stats on conditions'],
  ['Chitin Plates above 40%',FXJ,[["ed_3_3:[ {stat:{armor:R(0.02)},if:{selfHpAbove:0.5}} ]","ed_3_3:[ {stat:{armor:R(0.02)},if:{selfHpAbove:0.4}} ]"]],'stats on conditions'],
  ['Insomnia below 50%',FXJ,[["ed_12_1:[ {stat:{aspd:R(0.04)},if:{selfHpBelow:0.4}} ]","ed_12_1:[ {stat:{aspd:R(0.04)},if:{selfHpBelow:0.5}} ]"]],'stats on conditions'],
  ['Tireless Hands 1% -> 2%',FXJ,[["ed_8_2:[ {stat:{lifesteal:R(0.01)}} ]","ed_8_2:[ {stat:{lifesteal:R(0.02)}} ]"]],'stats on conditions'],
  ['Brisk Step 3% -> 4%',FXJ,[["oc_5_1:[ {stat:{move:R(0.03)}} ]","oc_5_1:[ {stat:{move:R(0.04)}} ]"]],'stats on conditions'],
  // ---- Tireless and Days ----
  ['Six Hands 1 -> 2 points',FXJ,[["oc_9_2:[ {param:'tir.pts',add:R(0.01)} ]","oc_9_2:[ {param:'tir.pts',add:R(0.02)} ]"]],'Tireless:'],
  ['Still in Session 40% -> 45%',FXJ,[["?0.40*pm:F;","?0.45*pm:F;"]],'Tireless:'],
  ['Tireless talents without the passive',FXJ,[["const pm=u.passMul; if(!(pm>0)) return 0;","const pm=u.passMul||1;"]],'Tireless:'],
  ['2 Days a wave',FXJ,[["let d=stN(T,'qDay')+1;","let d=stN(T,'qDay')+2;"]],'Days'],
  ['Unadjourned every wave',FXJ,[["if(!q.ua){ q.ua=1; d+=T.P.unadj||0; }","{ d+=T.P.unadj||0; }"]],'Days'],
  ['Days max 12',FXJ,[["qDay:{max:11}","qDay:{max:12}"]],'Days'],
  ['Eleven Days 0.4% -> 0.5%',FXJ,[["ed_1_1:[ {stat:{aspd:R(0.004)},per:'qDay'} ]","ed_1_1:[ {stat:{aspd:R(0.005)},per:'qDay'} ]"]],'Days'],
  ['The Twelfth Day 0.3% -> 0.4%',FXJ,[["ed_2_1:[ {stat:{hp:R(0.003)},per:'qDay'} ]","ed_2_1:[ {stat:{hp:R(0.004)},per:'qDay'} ]"]],'Days'],
  ['Day Follows Day 0.3% -> 0.4%',FXJ,[["ed_10_1:[ {stat:{atk:R(0.003)},per:'qDay'} ]","ed_10_1:[ {stat:{atk:R(0.004)},per:'qDay'} ]"]],'Days'],
  // ---- crit, slows, controls, cooldowns ----
  ['Hammered 1% -> 2%',FXJ,[["sg_5_4:[ {param:'cr.ham',add:R(0.01)} ]","sg_5_4:[ {param:'cr.ham',add:R(0.02)} ]"]],'crit group'],
  ['Restless 0.2% -> 0.3%',FXJ,[["ed_7_3:[ {param:'cr.day',add:R(0.002)} ]","ed_7_3:[ {param:'cr.day',add:R(0.003)} ]"]],'crit group'],
  ['Long Hearing on any enemy',FXJ,[["if(P['cr.lh']&&(t.stunned||0)>0) p+=P['cr.lh'];","if(P['cr.lh']) p+=P['cr.lh'];"]],'crit group'],
  ['Heavy Docket on skills too',FXJ,[["if(c.auto&&P['cr.hd']&&gvOn(T,t))","if(P['cr.hd']&&gvOn(T,t))"]],'crit group'],
  ['Cross-Examine at 4',FXJ,[["if(c.auto&&P['cr.cx']&&tsOf(T,t)>=5)","if(c.auto&&P['cr.cx']&&tsOf(T,t)>=4)"]],'crit group'],
  ['Unhurried Voice 4% -> 5%',FXJ,[["oc_11_1:[ {param:'sw.uv',add:R(0.04)} ]","oc_11_1:[ {param:'sw.uv',add:R(0.05)} ]"]],'slows and controls'],
  ['slows weakened again every tick',FXJ,[["if(q.swL===m) return; u.slowMul=","u.slowMul="]],'slows and controls'],
  ['Nobody Said It above 30%',FXJ,[["if(f==='stunned'&&P['ten.nsi']&&u.hp>0.5*u.maxHp)","if(f==='stunned'&&P['ten.nsi']&&u.hp>0.3*u.maxHp)"]],'slows and controls'],
  ['Steady Bench 4% -> 5%',FXJ,[["ed_4_1:[ {param:'ten.all',add:R(0.04)} ]","ed_4_1:[ {param:'ten.all',add:R(0.05)} ]"]],'slows and controls'],
  ['Quick Seal 0.2 -> 0.3',FXJ,[["oc_6_3:[ {param:'cd.go',add:R(0.2)} ]","oc_6_3:[ {param:'cd.go',add:R(0.3)} ]"]],'cooldowns'],
  ['Swift Ruling 0.15 -> 0.2',FXJ,[["oc_7_1:[ {param:'cd.ct',add:R(0.15)} ]","oc_7_1:[ {param:'cd.ct',add:R(0.2)} ]"]],'cooldowns'],
  ['Eleven Is Enough at 10 Days',FXJ,[["if(P.eie&&stN(T,'qDay')>=11) v*=0.5;","if(P.eie&&stN(T,'qDay')>=10) v*=0.5;"]],'cooldowns'],
  ['Sustained 1.5 s',FXJ,[["Math.max(0,u.blueCd-1,CT_FLOOR-q.bcE)","Math.max(0,u.blueCd-1.5,CT_FLOOR-q.bcE)"]],'cooldowns'],
  ['Sustained may lengthen',FXJ,[["u.blueCd=Math.min(u.blueCd,Math.max(0,u.blueCd-1,CT_FLOOR-q.bcE));","u.blueCd=Math.max(0,u.blueCd-1,CT_FLOOR-q.bcE);"]],'cooldowns'],
  // ---- The Court Is in Session ----
  ['the court 8 m',FXJ,[["A.pick(T,u,{team:'enemy',within:6},{u})){ if(!T.fn.tstun","A.pick(T,u,{team:'enemy',within:8},{u})){ if(!T.fn.tstun"]],'Court Is in Session'],
  ['the court 1.2 s',FXJ,[["if(!T.fn.tstun(A,T,u,x,1,'sig1'))","if(!T.fn.tstun(A,T,u,x,1.2,'sig1'))"]],'Court Is in Session'],
  ['the court leaves Contempt',FXJ,[["      u.blueCd=0; },\n    movable","      },\n    movable"]],'Court Is in Session'],
  ['the court\'s window 6 s',FXJ,[["q.s1=SIG_CD; q.cw=5;","q.s1=SIG_CD; q.cw=6;"]],'Court Is in Session'],
  ['the court cuts nobody short',FXJ,[["if(!T.fn.tstun(A,T,u,x,1,'sig1')) T.fn.cutShort(A,T,u,x);","T.fn.tstun(A,T,u,x,1,'sig1');"]],'Court Is in Session'],
  // ---- Gavels ----
  ['Gavel 9 s',FXJ,[["d=8+(P['gv.dur']||0);","d=9+(P['gv.dur']||0);"]],'Gavels:'],
  ['Laid Down 1 -> 2',FXJ,[["sg_2_1:[ {param:'gv.dur',add:R(1)} ]","sg_2_1:[ {param:'gv.dur',add:R(2)} ]"]],'Gavels:'],
  ['the newest Gavel pushed out',FXJ,[["if(!lo||x.gv<lo.gv) lo=x;","if(!lo||x.gv>lo.gv) lo=x;"]],'Gavels:'],
  ['All Six 3% -> 4%',FXJ,[["sg_1_1:[ {param:'gv',add:1}, {on:'out',if:{auto:true,fn:'tgtGv'},more:R(0.03)} ]","sg_1_1:[ {param:'gv',add:1}, {on:'out',if:{auto:true,fn:'tgtGv'},more:R(0.04)} ]"]],'Gavels:'],
  ['Gavel to the Head 0.4% -> 0.5%',FXJ,[["sg_7_1:[ {stat:{atk:R(0.004)},per:{fn:'gvN'}} ]","sg_7_1:[ {stat:{atk:R(0.005)},per:{fn:'gvN'}} ]"]],'Gavels:'],
  ['Weighty Gavel 4% -> 5%',FXJ,[["sg_6_1:[ {stat:{move:R(-0.04)}","sg_6_1:[ {stat:{move:R(-0.05)}"]],'Gavels:'],
  ['Down Comes the Gavel 45%',FXJ,[["{on:'out',if:{casting:CT,fn:'tgtGv'},more:0.40}","{on:'out',if:{casting:CT,fn:'tgtGv'},more:0.45}"]],'Gavels:'],
  ['Down Comes the Gavel keeps it',FXJ,[["{on:'hit',if:{casting:CT,targetTeam:'enemy'},do:[{fn:'gvSpendT'}]}","{on:'hit',if:{casting:CT,targetTeam:'enemy'},do:[]}"]],'Gavels:'],
  ['Order Restored gone',FXJ,[["sg_11_2:[ {on:'hit',if:{casting:GO,targetTeam:'enemy'},do:[{fn:'gvAddT'}]} ]","sg_11_2:[ {param:'x.or',add:1} ]"]],'Gavels:'],
  ['Unused Gavel 1% -> 2%',FXJ,[["sg_10_1:[ {param:'ug',add:R(0.01)} ]","sg_10_1:[ {param:'ug',add:R(0.02)} ]"]],'Gavels:'],
  // ---- Sentenced, Contempt Storm, Sentence Is Passed ----
  ['Sentenced 7 s',FXJ,[["const r=rec(T,t); r.sn=Math.max(r.sn,6+(T.P['sn.dur']||0)); },","const r=rec(T,t); r.sn=Math.max(r.sn,7+(T.P['sn.dur']||0)); },"]],'Sentenced'],
  ['Full Sentence 0.6 -> 0.7',FXJ,[["sg_3_4:[ {param:'sn.dur',add:R(0.6)} ]","sg_3_4:[ {param:'sn.dur',add:R(0.7)} ]"]],'Sentenced'],
  ['Sentence Passed 3% -> 4%',FXJ,[["{on:'out',if:{auto:true,fn:'tgtSn'},more:R(0.03)}","{on:'out',if:{auto:true,fn:'tgtSn'},more:R(0.04)}"]],'Sentenced'],
  ['Sentence Carried Out below 40%',FXJ,[["t.hp<0.30*t.maxHp","t.hp<0.40*t.maxHp"]],'Sentenced'],
  ['Thorough 1% -> 2%',FXJ,[["sg_10_4:[ {stat:{atk:R(-0.01),apow:R(-0.01)}","sg_10_4:[ {stat:{atk:R(-0.02),apow:R(-0.01)}"]],'Sentenced'],
  ['Record Kept 2% -> 3%',FXJ,[["sg_12_4:[ {param:'rkept',add:R(0.02)} ]","sg_12_4:[ {param:'rkept',add:R(0.03)} ]"]],'Sentenced'],
  ['Executed gone',FXJ,[["executed(A,T,u,c){ for(const x of","executed(A,T,u,c){ for(const x of [] ||"]],'Sentenced'],
  ['Storm of Paper 3% -> 4%',FXJ,[["sg_2_2:[ {on:'out',if:{casting:CS},more:R(0.03)} ]","sg_2_2:[ {on:'out',if:{casting:CS},more:R(0.04)} ]"]],'Contempt Storm'],
  ['Final Word 10% -> 12%',FXJ,[["oc_12_1:[ {on:'hit',if:{casting:CS,targetTeam:'enemy'},do:[{slow:R(0.10)","oc_12_1:[ {on:'hit',if:{casting:CS,targetTeam:'enemy'},do:[{slow:R(0.12)"]],'Contempt Storm'],
  ['Writ Weight 1% -> 2%',FXJ,[["{stat:{aspd:R(0.01)},per:{fn:'wwN'}}","{stat:{aspd:R(0.02)},per:{fn:'wwN'}}"]],'Contempt Storm'],
  ['Writ Weight 6 s',FXJ,[["q.wwN++; q.wwT=5;","q.wwN++; q.wwT=6;"]],'Contempt Storm'],
  ['Final Session 8% -> 9%',FXJ,[["ed_12_4:[ {on:'out',if:{casting:CS,fn:'tsAny'},more:R(0.08)} ]","ed_12_4:[ {on:'out',if:{casting:CS,fn:'tsAny'},more:R(0.09)} ]"]],'Contempt Storm'],
  ['All at Once 0.5 s',FXJ,[["T.fn.tstun(A,T,u,c.tgt,0.4,'aao');","T.fn.tstun(A,T,u,c.tgt,0.5,'aao');"]],'Contempt Storm'],
  ['One by One one writ short',FXJ,[["q.csX=Math.max(0,n-Math.min(n,k));","q.csX=Math.max(0,n-1-Math.min(n,k));"]],'Contempt Storm'],
  ['No Exceptions 5% -> 6%',FXJ,[["sg_6_3:[ {param:'obo.more',add:R(0.05)} ]","sg_6_3:[ {param:'obo.more',add:R(0.06)} ]"]],'Contempt Storm'],
  ['the sentence 160%',FXJ,[["*E.rage()*1.5*(E.skillMul?","*E.rage()*1.6*(E.skillMul?"]],'Sentence Is Passed'],
  ['the sentence stuns 0.6 s',FXJ,[["T.fn.tstun(A,T,u,t,0.5,'sig2');","T.fn.tstun(A,T,u,t,0.6,'sig2');"]],'Sentence Is Passed'],
  ['the sentence spends nothing',FXJ,[["      for(const k in q.e) q.e[k].gv=0;\n","      \n"]],'Sentence Is Passed'],
  ['the sentence without its cooldown',FXJ,[["gvCount(T)<GV_MAX) return; q.s2=SIG_CD;","gvCount(T)<GV_MAX) return;"]],'Sentence Is Passed'],
  // ---- Testimony and Waiting to Hear It ----
  ['2 Testimony a hit',FXJ,[["tsOf(T,s)+1+(c.crit?","tsOf(T,s)+2+(c.crit?"]],'Testimony:'],
  ['Hear Every Word 1 -> 2',FXJ,[["ed_10_2:[ {param:'ts.crit',add:R(1)} ]","ed_10_2:[ {param:'ts.crit',add:R(2)} ]"]],'Testimony:'],
  ['Testimony 7 s',FXJ,[["r.tt=6+(T.P['ts.dur']||0);","r.tt=7+(T.P['ts.dur']||0);"]],'Testimony:'],
  ['Let Them Speak to 11',FXJ,[["ed_5_3:[ {param:'ts.max',add:5} ]","ed_5_3:[ {param:'ts.max',add:6} ]"]],'Testimony:'],
  ['At Extraordinary Length 0.6% -> 0.7%',FXJ,[["ed_1_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.006),per:{fn:'tsN'}} ]","ed_1_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.007),per:{fn:'tsN'}} ]"]],'Testimony:'],
  ['Closing Arguments 3% -> 4%',FXJ,[["ed_12_2:[ {on:'out',if:{fn:'tsFull'},more:R(0.03)} ]","ed_12_2:[ {on:'out',if:{fn:'tsFull'},more:R(0.04)} ]"]],'Testimony:'],
  ['Restless Hands 0.4% -> 0.5%',FXJ,[["ed_6_2:[ {stat:{aspd:R(0.004)},per:{fn:'tsMine'}} ]","ed_6_2:[ {stat:{aspd:R(0.005)},per:{fn:'tsMine'}} ]"]],'Testimony:'],
  ['Long Testimony 1% -> 2%',FXJ,[["ed_6_3:[ {stat:{move:R(-0.01)}","ed_6_3:[ {stat:{move:R(-0.02)}"]],'Testimony:'],
  ['On the Record kept between waves',FXJ,[["q.e={}; q.otr=0; q.wt=0;","q.e={}; q.wt=0;"]],'Testimony:'],
  ['On the Record 1% -> 2%',FXJ,[["ed_11_2:[ {stat:{aspd:R(0.01)},per:{fn:'otrN'}} ]","ed_11_2:[ {stat:{aspd:R(0.02)},per:{fn:'otrN'}} ]"]],'Testimony:'],
  ['Struck Into the Record 12%',FXJ,[["{on:'out',if:{fn:'armed'},more:0.10}","{on:'out',if:{fn:'armed'},more:0.12}"]],'Struck Into the Record'],
  ['Struck Into the Record at 4',FXJ,[["if(T.P.sir&&was<5&&r.ts>=5) r.arm=1;","if(T.P.sir&&was<4&&r.ts>=4) r.arm=1;"]],'Struck Into the Record'],
  ['Struck Into the Record no Gavel',FXJ,[["if(T.r.sg_1_1&&t.alive) T.fn.addGavel(A,T,u,t);",""]],'Struck Into the Record'],
  ['Interrupt 0.7 s',FXJ,[["if(T.fn.tstun(A,T,u,t,0.6,'int'))","if(T.fn.tstun(A,T,u,t,0.7,'int'))"]],'Struck Into the Record'],
  ['Interrupt keeps the Testimony',FXJ,[["const r=rec(T,t); r.ts=0; r.tt=0; r.arm=0; } },","} },"]],'Struck Into the Record'],
  ['Waiting to Hear It: stunned anyway',FXJ,[["if(T.P.sig3&&Q(T).wh>0&&(f==='stunned'||f==='slow')) k=0;",""]],'Waiting to Hear It'],
  ['Waiting to Hear It 7 s',FXJ,[["q.s3=SIG_CD; q.wh=6;","q.s3=SIG_CD; q.wh=7;"]],'Waiting to Hear It'],
  ['Waiting to Hear It: Tireless x1.5',FXJ,[["if(T.P.sig3&&Q(T).wh>0) f*=2;","if(T.P.sig3&&Q(T).wh>0) f*=1.5;"]],'Waiting to Hear It'],
  ['Waiting to Hear It: no Testimony from his hits',FXJ,[["if(T.P.sig3&&q.wh>0&&t.alive&&!c.proc) T.fn.tsSet(A,T,u,t,tsMax(T));",""]],'Waiting to Hear It'],
  ['Waiting to Hear It without its cooldown',FXJ,[["&&q.s3<=0&&u.alive){ q.s3=SIG_CD;","&&u.alive){ q.s3=0;"]],'Waiting to Hear It'],
  ['Waiting for the Word 0.3% -> 0.4%',FXJ,[["T.fn.heal(A,T,u,0.003*rk(T,'ed_8_1')*u.maxHp);","T.fn.heal(A,T,u,0.004*rk(T,'ed_8_1')*u.maxHp);"]],'Waiting for the Word'],
  ['Waiting for the Word every 2 s',FXJ,[["ed_8_1:[ {on:'tick',period:3,","ed_8_1:[ {on:'tick',period:2,"]],'Waiting for the Word'],
];

const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ const ex=[...SKIP].map(k=>'--exclude=./'+k).join(' ');
  const r=cp.spawnSync('bash',['-c','tar cf - '+ex+' . | tar xf - -C "'+dir+'"'],{cwd:root,encoding:'utf8',maxBuffer:1<<26});
  if(!fs.existsSync(path.join(dir,HTML))) throw new Error('copy failed: rc '+r.status+' '+String(r.stderr||r.error||'').slice(0,400));
  for(const k of ['node_modules','assets','.bin','.base']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,swaps,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ctl-quorrel-'));
  try{ copyTo(dir); const p=path.join(dir,file); let s=fs.readFileSync(p,'utf8');
    for(const [from,to] of swaps){ const a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
      if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times: '+from.slice(0,60)}; s=s.replace(a,()=>to); }
    fs.writeFileSync(p,s);
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-quorrel.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    const why=/error: [^\n]*/.exec(out); return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')+(why?' | '+why[0].slice(0,140):'')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=process.env.QCTL?new RegExp(process.env.QCTL):(process.argv[2]?new RegExp(process.argv[2]):null);
const out=[]; for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }   // one copy at a time
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'+(miss.length?'; missed: '+miss.map(r=>r.name).join(' | '):'')); process.exit(miss.length?1:0);
