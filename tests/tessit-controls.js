'use strict';
/* The controls for Tessit's talent tests (run on the cluster through tools/remote_test.sh as a plain node script). Each control copies this checkout into the
   temp folder (os.tmpdir(): the runner points it at the slot's own .tmp on disk; node_modules and assets are symlinked, .logs and the like left out), breaks ONE
   thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page line removed, a guard made unguarded with a seeded draw, a
   row or a cap of hers broken), runs the named tests of tests/talents-mech-tessit.test.js in that copy, expects them to FAIL, and deletes the copy before the
   next. ONE copy at a time. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   CHECK=1: only checks that every text to break is found exactly once (no test is run). ONLY=<regex>: only the controls whose name matches. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const SITES='every page line', ID='no talents';
const C=[
  // ---- the page lines: removed (her tests fail) ----
  ['Unwind skillTgt removed',HTML,"        if(u._tal&&u._tal.on.skillTgt) a=TalentFx.skillTgt(u,'unwind',a,{hurt})||a;",'',SITES+'|Careful Hand'],
  ['Unwind pass removed',HTML,"        if(u._tal&&u._tal.on.pass) TalentFx.pass(u,a,'unwind');",'',SITES+'|Burden: each'],
  ['Unwind interval field removed',HTML,"SKLV.unwind(passLv(u))-(u._talUwOff||0);","SKLV.unwind(passLv(u));",SITES+'|Unwind sooner'],
  // ---- an unguarded seeded draw at each new line (the no-talent identity test fails) ----
  ['draw at the skillTgt line',HTML,"        if(u._tal&&u._tal.on.skillTgt) a=TalentFx.skillTgt(u,'unwind',a,{hurt})||a;","        brnd(); if(u._tal&&u._tal.on.skillTgt) a=TalentFx.skillTgt(u,'unwind',a,{hurt})||a;",ID],
  ['draw at the pass line',HTML,"        if(u._tal&&u._tal.on.pass) TalentFx.pass(u,a,'unwind');","        brnd(); if(u._tal&&u._tal.on.pass) TalentFx.pass(u,a,'unwind');",ID],
  ['draw at the interval line',HTML,"SKLV.unwind(passLv(u))-(u._talUwOff||0);","SKLV.unwind(passLv(u))-(u._talUwOff||0)-brnd()*0;",ID],
  // ---- Sand ----
  ['Sand per Sleight off',FXJ,"addSand(A,T,u,pairs.length);","",'Sand: Sleight|Borrowed Calm'],
  ['Sand 0.4% -> 0.5%',FXJ,"lg_1_2:[ {stat:{aspd:R(0.004)}","lg_1_2:[ {stat:{aspd:R(0.005)}",'Sand: Sleight'],
  ['Sand max 6 -> 7',FXJ,"tsSand:{max:P('sand.max',6)","tsSand:{max:P('sand.max',7)",'Sand: Sleight|Full Glass|Whose Afternoon'],
  ['Sand kept across a wave',FXJ,"tsSand:{max:P('sand.max',6),wave:'reset'}","tsSand:{max:P('sand.max',6)}",'Sand: Sleight'],
  ['Spare Change 1 -> 2',FXJ,"{param:'sand.start',add:R(1)}","{param:'sand.start',add:R(2)}",'Sand: Sleight'],
  ['Running Total 0.3% -> 0.4%',FXJ,"lg_10_2:[ {stat:{apow:R(0.003)}","lg_10_2:[ {stat:{apow:R(0.004)}",'Sand: Sleight'],
  ['Hundred and Forty Years at 2 Sand',FXJ,"A.stGet(T,'tsSand')>=3) f*=1-Pm['dr.hfy'];","A.stGet(T,'tsSand')>=2) f*=1-Pm['dr.hfy'];",'Sand: Sleight'],
  ['Calm Thief 6 s',FXJ,"A.acts(T,u,[{window:'tsThief',dur:S.d}],{u});","A.acts(T,u,[{window:'tsThief',dur:S.d+1}],{u});",'Sand: Sleight'],
  // ---- the steal ----
  ['Light Touch 1% -> 2%',FXJ,"lg_3_1:[ {param:'ss.k',add:R(0.01)} ]","lg_3_1:[ {param:'ss.k',add:R(0.02)} ]",'the steal'],
  ['steal added in points',FXJ,"p=tot*k; o.pct=(o.pct||0.35)+(p-tot);","p=tot+(k-1); o.pct=(o.pct||0.35)+(p-tot);",'the steal'],
  ['Grand Theft 2 s -> 1 s',FXJ,"{on:'cd',skill:'blue',add:2}","{on:'cd',skill:'blue',add:1}",'the steal'],
  ['Petty Theft -10% -> -5%',FXJ,"{param:'ss.k',add:-0.10}","{param:'ss.k',add:-0.05}",'the steal'],
  ['Living on Credit risk off',FXJ,"lg_6_4:[ {param:'risk',add:R(0.03)},","lg_6_4:[ {param:'risk',add:R(0)},",'the steal'],
  ['Full Glass below full',FXJ,"full:!!(Pm['ss.full']&&sandFull(A,T,u))","full:!!Pm['ss.full']",'Full Glass'],
  ['Full Glass: the same ally twice',FXJ,"S.a2=fastest(M,allySpd,a);","S.a2=a;",'Full Glass'],
  // ---- Debt ----
  ['Debt at the cast',FXJ,"{mark:'tsRob',on:'target',dur:S.d,ends:'tsRobEnd'}","{mark:'tsRob',on:'target',dur:0.1,ends:'tsRobEnd'}",'Debt: when'],
  ['Debt 3 s -> 4 s',FXJ,"const d=(3+(T.P['debt.dur']||0))","const d=(4+(T.P['debt.dur']||0))",'Debt: when|Whose Afternoon'],
  ['Written Down 2% -> 3%',FXJ,"lg_2_3:[ {stat:{aspd:R(-0.02)}","lg_2_3:[ {stat:{aspd:R(-0.03)}",'Debt: when'],
  ['Time Owed 0.4% -> 0.5%',FXJ,"lg_12_2:[ {stat:{aspd:R(-0.004)}","lg_12_2:[ {stat:{aspd:R(-0.005)}",'Debt: when'],
  ['Compound 1% -> 2%',FXJ,"{param:'debt.more',add:R(0.01)}","{param:'debt.more',add:R(0.02)}",'Debt: when'],
  ['Called In 5 -> 6 energy',FXJ,"a.energy=Math.min(100,(a.energy||0)+5); addSand(A,T,u,1);","a.energy=Math.min(100,(a.energy||0)+6); addSand(A,T,u,1);",'Debt: when'],
  ['Called In without Debt',FXJ,"if(!x||x.team===u.team||!mk(A,u,x,'tsDebt')) return;","if(!x||x.team===u.team) return;",'Debt: when'],
  // ---- Pocketed ----
  ['Pocketed max 3 -> 4',FXJ,"tsPk:{max:3,","tsPk:{max:4,",'Pocketed'],
  ['Pocketed 8 s -> 9 s',FXJ,"dur:P('pk.dur',8)","dur:P('pk.dur',9)",'Pocketed'],
  ['Pickpocket at the cap',FXJ,"if(A.stGet(T,'tsPk')>n0&&Pm['pk.heal'])","if(Pm['pk.heal'])",'Pocketed'],
  ['heal budget off',FXJ,"a=Math.min(a,s.tsHb); s.tsHb-=a;","",'Pocketed'],
  ['Pocket Watch at 2',FXJ,"if:{stackMin:{tsPk:3}}","if:{stackMin:{tsPk:2}}",'Pocketed'],
  // ---- Accelerate ----
  ['Sharp Accelerate 1.5% -> 2%',FXJ,"lg_4_1:[ {param:'acc.k',add:R(0.015)} ]","lg_4_1:[ {param:'acc.k',add:R(0.02)} ]",'Accelerate: Sharp'],
  ['Measured Pace 0.2 -> 0.3 s',FXJ,"lg_6_2:[ {param:'acc.dur',add:R(0.2)} ]","lg_6_2:[ {param:'acc.dur',add:R(0.3)} ]",'Accelerate: Sharp'],
  ['Accelerate the Theft a half',FXJ,"*Math.max(0,1+(Pm['ss.k']||0))/3*(1+(Pm['att.k']||0))","*Math.max(0,1+(Pm['ss.k']||0))/2*(1+(Pm['att.k']||0))",'Accelerate the Theft'],
  ['Accelerate the Theft no Sand',FXJ,"if(Pm.att){ addSand(A,T,u,1);","if(Pm.att){",'Accelerate the Theft'],
  ['Lent Hours 1% -> 2%',FXJ,"{param:'lent',add:R(0.01)}","{param:'lent',add:R(0.02)}",'Accelerate the Theft'],
  ['Swift Ally 2% -> 3%',FXJ,"lg_5_2:[ {stat:{move:R(0.02)}","lg_5_2:[ {stat:{move:R(0.03)}",'Accelerate the Theft'],
  // ---- Quick Fingers and the robbed ----
  ['Quick Fingers 6% -> 7%',FXJ,"{param:'qf',add:R(0.06)}","{param:'qf',add:R(0.07)}",'Quick Fingers'],
  ['Sand in the Gears 2% -> 3%',FXJ,"lg_9_4:[ {stat:{move:R(-0.02)}","lg_9_4:[ {stat:{move:R(-0.03)}",'Quick Fingers'],
  ['Bold Hand 2% -> 3%',FXJ,"{param:'bold',add:R(0.02)}","{param:'bold',add:R(0.03)}",'Quick Fingers'],
  ['Many Small Hours more than it has',FXJ,"const n=Math.min(Pm.msh,v.energy||0);","const n=Pm.msh;",'Quick Fingers'],
  ['Borrowed Calm 4% -> 5%',FXJ,"if(mk(A,u,t,'tsCalm')) f*=0.96;","if(mk(A,u,t,'tsCalm')) f*=0.95;",'Borrowed Calm'],
  ['Borrowed Calm 3 s -> 4 s',FXJ,"A.setMark(T,u,b,'tsCalm',{dur:3});","A.setMark(T,u,b,'tsCalm',{dur:4});",'Borrowed Calm'],
  ['Borrowed Calm Clear without Wiped Clean',FXJ,"if(T.r.uw_2_2) A.setMark(T,u,b,'tsClr',{dur:1,longest:true});","A.setMark(T,u,b,'tsClr',{dur:1,longest:true});",'Borrowed Calm'],
  // ---- the ultimate's Ledger riders ----
  ['Borrowed Hourglass 20% -> 25%',FXJ,"{param:'bh',add:0.20}","{param:'bh',add:0.25}",'Borrowed Hourglass'],
  ['Borrowed Hourglass to the farthest',FXJ,"{team:'ally',of:'target',order:'near',n:1},{u,tgt:e})[0]; if(a){ giveOn(a,p,5,false);","{team:'ally',of:'target',n:1,skip:'self'},{u,tgt:e})[0]; if(a){ giveOn(a,p,5,false);",'Borrowed Hourglass'],
  ['Shard Spray 4 s -> 5 s',FXJ,"A.setMark(T,u,e,'tsShard',{dur:4});","A.setMark(T,u,e,'tsShard',{dur:5});",'Borrowed Hourglass'],
  ['Whose Afternoon below full',FXJ,"if(Pm.wa&&sandFull(A,T,u)){","if(Pm.wa){",'Whose Afternoon'],
  ['Whose Afternoon keeps the Sand',FXJ,"A.stSet(T,u,'tsSand',0); s.tsWaN=","s.tsWaN=",'Whose Afternoon'],
  ['Whose Afternoon Debt once',FXJ,"{on:'tsRobWEnd',do:[{fn:'debt',k:2}]}","{on:'tsRobWEnd',do:[{fn:'debt',k:1}]}",'Whose Afternoon'],
  ['Whose Afternoon 40% -> 30%',FXJ,"for(const e of I){ robOn(e,0.40,6);","for(const e of I){ robOn(e,0.30,6);",'Whose Afternoon'],
  // ---- Burden ----
  ['Burden from Unwind off',FXJ,"  addBur(A,T,u,lifted.length,a);","",'Burden: each|Careful Hand|Tip the Glass'],
  ['Lift It Off 0.6% -> 0.7%',FXJ,"{param:'dr.bur',add:R(0.006)}","{param:'dr.bur',add:R(0.007)}",'Burden: each'],
  ['Burden max 5 -> 6',FXJ,"tsBur:{max:P('bur.max',5)}","tsBur:{max:P('bur.max',6)}",'Burden: each|Tip the Glass'],
  ['Shouldered 0.5% -> 0.6%',FXJ,"uw_4_1:[ {stat:{armor:R(0.005)}","uw_4_1:[ {stat:{armor:R(0.006)}",'Burden: each'],
  ['Grief Kept 0.5% -> 0.6%',FXJ,"{param:'grief',add:R(0.005)}","{param:'grief',add:R(0.006)}",'Burden: each'],
  ['Put It in the Glass 4% -> 5%',FXJ,"{param:'pig',add:0.04}","{param:'pig',add:0.05}",'Burden: each|Clear \\(Wiped'],
  ['Load Bearer below full',FXJ,"if(Pm['dr.load']&&burFull(A,T,u))","if(Pm['dr.load'])",'Burden: each'],
  ['Long Carry ignored',FXJ,"Math.min(A.stGet(T,'tsBur'),Pm['bur.keep']||0)","A.stGet(T,'tsBur')",'Burden: each'],
  // ---- Clear ----
  ['Clear 1 s -> 1.2 s',FXJ,"uw_2_2:[ {param:'clr',add:R(1)} ]","uw_2_2:[ {param:'clr',add:R(1.2)} ]",'Clear \\(Wiped|Wide Hand'],
  ['Clear does not halve controls',FXJ,"a[f]=Math.max(was,v/2);","a[f]=Math.max(was,v);",'Clear \\(Wiped'],
  ['Clear does not halve DoTs',FXJ,"d.remaining=Math.max(1,Math.round(d.remaining/2));","",'Clear \\(Wiped'],
  ['Clear Air 2% -> 3%',FXJ,"{param:'clr.dr',add:R(0.02)}","{param:'clr.dr',add:R(0.03)}",'Clear \\(Wiped'],
  ['Ledger of Griefs 0.1 -> 0.2 s',FXJ,"{param:'clr.bur',add:R(0.1)}","{param:'clr.bur',add:R(0.2)}",'Clear \\(Wiped'],
  ['Mending Sand 3% -> 4%',FXJ,"{param:'mend',add:R(0.03)}","{param:'mend',add:R(0.04)}",'Clear \\(Wiped'],
  ['Kind Hands 8% -> 9%',FXJ,"{param:'kind',add:R(0.08)}","{param:'kind',add:R(0.09)}",'Kind Hands'],
  ['Carry It at full strength',FXJ,"E.pushDot(u,d.dps*0.5,","E.pushDot(u,d.dps*1,",'Kind Hands'],
  ['Careful Hand one lift',FXJ,"if(Pm.careful){ const l2=lift(a); if(l2) got.push(l2); }","",'Careful Hand'],
  ['Careful Hand random',FXJ,"if(b) a=b; c.tgt=a; }","c.tgt=a; }",'Careful Hand'],
  ['Double Lift 2% -> 3%',FXJ,"{param:'dlift',add:R(0.02)}","{param:'dlift',add:R(0.03)}",'Careful Hand'],
  ['Wide Hand every Unwind',FXJ,"if(Pm.wide&&(s.tsUwN%2===0))","if(Pm.wide)",'Wide Hand'],
  ['Many Hands 0.3 -> 0.4 s',FXJ,"{param:'mhands',add:R(0.3)}","{param:'mhands',add:R(0.4)}",'Wide Hand'],
  // ---- Poured ----
  ['Tip the Glass 3% -> 4%',FXJ,"{param:'pour',add:R(0.03)}","{param:'pour',add:R(0.04)}",'Tip the Glass'],
  ['Tip the Glass empties at once',FXJ,"if(e){ pourOn(A,T,u,e); A.acts(T,u,[{window:'tsPourW',dur:pourDur(T)}],{u}); }","if(e){ pourOn(A,T,u,e); A.acts(T,u,[{window:'tsPourW',dur:0.1}],{u}); }",'Tip the Glass'],
  ['Heavy Pour 1% -> 2%',FXJ,"uw_5_4:[ {stat:{aspd:R(-0.01)}","uw_5_4:[ {stat:{aspd:R(-0.02)}",'Tip the Glass'],
  ['Spilled 2% -> 3%',FXJ,"uw_7_4:[ {on:'teamHeal',if:{unitHas:'tsPour'},less:R(0.02)} ]","uw_7_4:[ {on:'teamHeal',if:{unitHas:'tsPour'},less:R(0.03)} ]",'Tip the Glass'],
  ['Steady Pour 1% -> 2%',FXJ,"{param:'pour.more',add:R(0.01)}","{param:'pour.more',add:R(0.02)}",'Tip the Glass'],
  ['Back to Them 1 -> 2 s',FXJ,"{param:'pour.dur',add:R(1)}","{param:'pour.dur',add:R(2)}",'Tip the Glass'],
  ['Pour Again 1 -> 2',FXJ,"{param:'pour.again',add:R(1)}","{param:'pour.again',add:R(2)}",'Tip the Glass'],
  // ---- Unwind sooner, Grains of Calm, Clean Theft, Hourglass of Grief, Quiet Sand, the signature ----
  ['Unwind cap 1.5 s -> 2 s',FXJ,"UW_CAP=1.5,","UW_CAP=2,",'Unwind sooner'],
  ['Quick Unwind 0.3 -> 0.4 s',FXJ,"uw_2_3:[ {param:'uw.off',add:R(0.3)} ]","uw_2_3:[ {param:'uw.off',add:R(0.4)} ]",'Unwind sooner'],
  ['Glass Heart risk off',FXJ,"uw_6_4:[ {param:'risk',add:R(0.03)},","uw_6_4:[ {param:'risk',add:R(0)},",'Unwind sooner'],
  ['Clean Theft Clear 3 s',FXJ,"clearOn(A,T,u,a,2); A.setMark(T,u,a,'tsCtR',{dur:2});","clearOn(A,T,u,a,3); A.setMark(T,u,a,'tsCtR',{dur:2});",'Clean Theft'],
  ['Clear Run 2% -> 3%',FXJ,"uw_9_2:[ {stat:{move:R(0.02)}","uw_9_2:[ {stat:{move:R(0.03)}",'Clean Theft'],
  ['Hourglass of Grief keeps the Burden',FXJ,"for(const e of L) pourOn(A,T,u,e); A.stSet(T,u,'tsBur',0); }","for(const e of L) pourOn(A,T,u,e); }",'Hourglass of Grief'],
  ['Hourglass of Grief: no ally lifted',FXJ,"for(const a of mates(A,u)) if(!a._summon) lift(a); }","}",'Hourglass of Grief'],
  ['Sorrow Glass 0.06 -> 0.07 s',FXJ,"{param:'hog.st',add:R(0.06)}","{param:'hog.st',add:R(0.07)}",'Hourglass of Grief'],
  ['Quiet Sand 5 m -> 8 m',FXJ,"E.bodyR(t)/E.METER()<5) f*=1-Pm.quiet;","E.bodyR(t)/E.METER()<8) f*=1-Pm.quiet;",'Quiet Sand'],
  ['the signature below full Burden',FXJ,"if(Pm.nltl&&s.tsNl!==s.wave&&burFull(A,T,u))","if(Pm.nltl&&s.tsNl!==s.wave)",'Nothing Left'],
  ['the signature every tick',FXJ,"if(Pm.nltl&&s.tsNl!==s.wave&&","if(Pm.nltl&&",'Nothing Left'],
  ['the signature 3% a Burden',FXJ,"shieldOn(A,T,u,a,0.02*n*a.maxHp,5);","shieldOn(A,T,u,a,0.03*n*a.maxHp,5);",'Nothing Left'],
  ['the signature no Pour',FXJ,"for(const e of foes(A,u)) pourOn(A,T,u,e); },","},",'Nothing Left'],
  // ---- her damage reduction ----
  ['Settled Sand on every kind',FXJ,"if(kind==='magic'){ if(Pm['dr.mag'])","if(true){ if(Pm['dr.mag'])",'Settled Sand'],
  ['Steady Grip 1% -> 2%',FXJ,"{param:'dr.auto',add:R(0.01)}","{param:'dr.auto',add:R(0.02)}",'Settled Sand'],
  ['Unshaken Glass 1.5% -> 2%',FXJ,"{param:'dr.grain',add:R(0.015)}","{param:'dr.grain',add:R(0.02)}",'Settled Sand'],
  ['her cap 40% -> 45%',FXJ,"const DR_CAP=0.40, ALLY_CAP=0.25, UW_CAP","const DR_CAP=0.45, ALLY_CAP=0.25, UW_CAP",'the caps'],
  ['ally cap 25% -> 30%',FXJ,"const DR_CAP=0.40, ALLY_CAP=0.25, UW_CAP","const DR_CAP=0.40, ALLY_CAP=0.30, UW_CAP",'the caps'],
  // ---- Grains ----
  ['Grains from her hits off',FXJ,"if(!t||!t.alive||t.team===u.team) return; addGr(A,T,u,t,1);","return;",'Grains: her'],
  ['Grains need 6 -> 7',FXJ,"Math.round(6+(T.P['gr.need']||0))","Math.round(7+(T.P['gr.need']||0))",'Grains: her|Slow Sand|Sand Storm|Lost Moments'],
  ['Grains 6 s -> 7 s',FXJ,"dur:P('gr.dur',6)}","dur:P('gr.dur',7)}",'Grains: her'],
  ['Stinging Grains 12% -> 13%',FXJ,"{param:'gr.k',add:R(0.12)}","{param:'gr.k',add:R(0.13)}",'Grains: her'],
  ['Sharp Mind up to 3 -> any',FXJ,"(1+(Pm.sharp||0)*Math.min(3,others))","(1+(Pm.sharp||0)*others*1.5)",'Grains: her'],
  ['lost moment 0.3 s -> 0.4 s',FXJ,"tstun(A,T,u,e,Math.max(0.05,0.3+(Pm.mom||0)));","tstun(A,T,u,e,Math.max(0.05,0.4+(Pm.mom||0)));",'Grains: her|Slow Sand|Lost Moments'],
  ['Long Fall 0.03 -> 0.04 s',FXJ,"bg_12_3:[ {param:'mom',add:R(0.03)} ]","bg_12_3:[ {param:'mom',add:R(0.04)} ]",'Grains: her'],
  ['Grain by Grain 0.3% -> 0.4%',FXJ,"{param:'gbg',add:R(0.003)}","{param:'gbg',add:R(0.004)}",'Grains: her'],
  ['Brisk Hands always',FXJ,"return !!t&&t.alive&&t.team!==u.team&&ust(A,T,u,t,'tsGr')>0;","return true;",'Grains: her'],
  ['Grains not spent',FXJ,"  A.ustPut(T,u,e,'tsGr',0); s.tsMoN=","  s.tsMoN=",'Grains: her'],
  ['Heavy Moment 4 -> 5',FXJ,"{param:'mom.nrg',add:R(4)}","{param:'mom.nrg',add:R(5)}",'Slow Sand'],
  ['Rapid Grains 2 s -> 3 s',FXJ,"slowOn(e,Pm['mom.slow'],2);","slowOn(e,Pm['mom.slow'],3);",'Slow Sand'],
  ['stun lock 0.5 s -> 0.3 s',FXJ,"A.setMark(T,u,t,'tsLk',{dur:d+0.5});","A.setMark(T,u,t,'tsLk',{dur:d+0.3});",'Slow Sand'],
  ['three stuns in 10 s',FXJ,"if(m&&m.v>=2) return false;","if(m&&m.v>=3) return false;",'Slow Sand'],
  ['a stun on a stunned enemy',FXJ,"!((t.stunned||0)>0)&&!A.markOf(u,t,'tsLk')","!A.markOf(u,t,'tsLk')",'Slow Sand'],
  ['Sand Storm 2 m -> 3 m',FXJ,"{team:'enemy',of:'target',within:2,skip:'target'},{u,tgt:e})) addGr(A,T,u,x,2);","{team:'enemy',of:'target',within:3,skip:'target'},{u,tgt:e})) addGr(A,T,u,x,2);",'Sand Storm'],
  ['Sand Storm 3 Grains',FXJ,"{u,tgt:e})) addGr(A,T,u,x,2);","{u,tgt:e})) addGr(A,T,u,x,3);",'Sand Storm'],
  ['Lost Moments off',FXJ,"if(Pm.lm&&v.alive){","if(false){",'Lost Moments'],
  // ---- Running Out ----
  ['Running Out at 35%',FXJ,"for(const e of foes(A,u)){ if(e.hp<0.30*e.maxHp){","for(const e of foes(A,u)){ if(e.hp<0.35*e.maxHp){",'Running Out: below'],
  ['Running Out every tick',FXJ,"if(!U[e.uid]){ U[e.uid]=1; roStart(A,T,u,e,'hp'); }","roStart(A,T,u,e,'hp');",'Running Out: below'],
  ['Running Out 5 s -> 6 s',FXJ,"const roDur=T=>Math.max(1,5-","const roDur=T=>Math.max(1,6-",'Running Out: below|Accelerated End'],
  ['Last Grains 20% -> 21%',FXJ,"{param:'ro.k',add:R(0.20)}","{param:'ro.k',add:R(0.21)}",'Running Out: below|Accelerated End'],
  ['Cracked Heart 6% -> 7%',FXJ,"{param:'ro.risk',add:R(0.06)}","{param:'ro.risk',add:R(0.07)}",'Running Out: below'],
  ['Old Debt Paid 1% -> 2%',FXJ,"{param:'odp',add:R(0.01)}","{param:'odp',add:R(0.02)}",'Running Out: below'],
  ['No Time Left 1% -> 2%',FXJ,"{param:'ntl',add:R(0.01)}","{param:'ntl',add:R(0.02)}",'Running Out: below'],
  ['Sand\'s Edge on every hit',FXJ,"if(Pm['hg.ro']&&s.cur==='aoeStun'&&mk(A,u,t,'tsRun'))","if(Pm['hg.ro']&&mk(A,u,t,'tsRun'))",'Running Out: below'],
  ['Accelerated End 30% -> 40%',FXJ,"if(Pm.ae&&A.winOn(T,'tsAcc')) k*=1.30;","if(Pm.ae&&A.winOn(T,'tsAcc')) k*=1.40;",'Accelerated End'],
  ['Accelerated End not at the cast',FXJ,"for(const e of foes(A,u)) if(e.hp<0.30*e.maxHp) roStart(A,T,u,e,'acc'); }","}",'Accelerated End'],
  ['Hastened End 3% -> 4%',FXJ,"{param:'ae.k',add:R(0.03)}","{param:'ae.k',add:R(0.04)}",'Accelerated End'],
  ['Every Grain Falls below 60%',FXJ,"if(e.alive&&e.hp<0.50*e.maxHp) roStart(A,T,u,e,'egf');","if(e.alive&&e.hp<0.30*e.maxHp) roStart(A,T,u,e,'egf');",'Every Grain Falls'],
  ['Last Grain 3% -> 4%',FXJ,"{param:'egf.k',add:R(0.03)}","{param:'egf.k',add:R(0.04)}",'Every Grain Falls'],
  ['Every Grain Falls: no Grains',FXJ,"const cur=ust(A,T,u,e,'tsGr'); addGr(A,T,u,e,N-cur);","const cur=ust(A,T,u,e,'tsGr');",'Every Grain Falls'],
  // ---- Turnover ----
  ['Turnover every 11 s',FXJ,"const turnPer=T=>Math.max(1,10-","const turnPer=T=>Math.max(1,11-",'Turnover|The Sand Runs Out'],
  ['Turnover 3 s -> 4 s',FXJ,"const Pm=T.P, d=(3+(Pm['turn.dur']||0))*k;","const Pm=T.P, d=(4+(Pm['turn.dur']||0))*k;",'Turnover|The Sand Runs Out'],
  ['Turn It Over 4% -> 5%',FXJ,"bg_4_1:[ {stat:{cdRate:R(0.04)}","bg_4_1:[ {stat:{cdRate:R(0.05)}",'Turnover'],
  ['Turned Twice 2 -> 3',FXJ,"{param:'turn.nrg',add:R(2)}","{param:'turn.nrg',add:R(3)}",'Turnover'],
  ['Upturned 2% -> 3%',FXJ,"{param:'turn.dmg',add:R(0.02)}","{param:'turn.dmg',add:R(0.03)}",'Turnover'],
  // ---- Hourglass ----
  ['Hourglass stun ext ignored',FXJ,"if(x>0) t.stunned=Math.max(t.stunned||0,Math.min(STUN_MAX,(c.amt||0)+x));","",'The Sand Runs Out|Hourglass: Bigger|Hourglass of Grief'],
  ['The Sand Runs Out 1 s -> 0.5 s',FXJ,"(Pm.tsro?1:0)","(Pm.tsro?0.5:0)",'The Sand Runs Out'],
  ['The Sand Runs Out: no strikes',FXJ,"T.fn.dropTm(A,T,e); A.clearMark(u,e,'tsRun'); roStrike(A,T,u,e); }","}",'The Sand Runs Out'],
  ['The Sand Runs Out: two turns',FXJ,"turn(A,T,u,3); s.tsTnC=turnPer(T);","turn(A,T,u,2); s.tsTnC=turnPer(T);",'The Sand Runs Out'],
  ['Bigger Shatter 3% -> 1%',FXJ,"{param:'hg.rad',add:R(0.03)}","{param:'hg.rad',add:R(0.01)}",'Hourglass: Bigger'],
  ['Shatter Point 3% -> 4%',FXJ,"{param:'hg.k',add:R(0.03)}","{param:'hg.k',add:R(0.04)}",'Hourglass: Bigger'],
  ['Second Shatter 0.05 -> 0.06 s',FXJ,"{param:'hg.st',add:R(0.05)}","{param:'hg.st',add:R(0.06)}",'Hourglass: Bigger|The Sand Runs Out'],
  // ---- the rest ----
  ['Fine Sand every wave',FXJ,"if(Pm.range&&!u._tsRg){","if(Pm.range){",'Fine Sand'],
  ['Keen Eye on every kind',FXJ,"if(Pm.mag&&c.kind==='magic') k*=1+Pm.mag;","if(Pm.mag) k*=1+Pm.mag;",'Fine Sand'],
  ['Patient Ledger 1% -> 2%',FXJ,"lg_3_4:[ {on:'cd',less:R(0.01)} ]","lg_3_4:[ {on:'cd',less:R(0.02)} ]",'Fine Sand']
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-logs','.tessit-runs']);
/* a plain recursive copy (fs.cpSync refuses to copy a folder into one of its own subfolders, and the temp folder may sit inside the checkout) */
function copyDir(src,dst,top){ fs.mkdirSync(dst,{recursive:true});
  for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(top&&(SKIP.has(e.name)||/^\.(ctl|remote|test|tessit)-/.test(e.name))) continue; const s=path.join(src,e.name), d=path.join(dst,e.name);
    if(e.isDirectory()) copyDir(s,d,false); else if(e.isFile()) fs.copyFileSync(s,d); } }
function copyTo(dir){ copyDir(root,dir,true); for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function count(file,from){ const s=fs.readFileSync(path.join(root,file),'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'); return s.split(a).length-1; }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tsc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-tessit.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.env.CHECK){ let bad=0; for(const c of C){ const n=count(c[1],c[2]); if(n!==1){ bad++; console.log('NOT ONCE ('+n+'): '+c[0]); } } console.log(C.length+' controls, '+bad+' texts not found exactly once'); process.exit(bad?1:0); }
const only=process.env.ONLY?new RegExp(process.env.ONLY):null; let caught=0, miss=0;
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); if(r.ok) caught++; else miss++; console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
console.log('controls: '+caught+' of '+(caught+miss)+' caught'); process.exit(miss?1:0);
