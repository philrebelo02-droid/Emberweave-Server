'use strict';
/* The controls for Orryn's talent tests (run on the cluster through tools/remote_test.sh as a plain node script). Each control copies this checkout into the
   temp folder (os.tmpdir(): the runner points it at the slot's own .tmp on disk; node_modules and assets are symlinked, .logs and the like left out), breaks ONE
   thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a
   row or a cap of his broken), runs the named tests of tests/talents-mech-orryn.test.js in that copy, expects them to FAIL, and deletes the copy before the next.
   ONE copy at a time. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   CHECK=1: only checks that every text to break is found exactly once (no test is run). ONLY=<regex>: only the controls whose name matches. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const SITES='every page site', ID='no talents';
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['hz partPre removed',HTML,"if(_hzO) TalentFx.partPre(_hzO,h,'hz');",'',SITES],
  ['hz part removed',HTML,"} }); if(_hzO) TalentFx.part(_hzO,h,'hz');","} });",SITES+'|Whorls: 1 a tick'],
  ['hzTick num removed',HTML,"_hzO?TalentFx.num(_hzO,'hzTick',h.dmg,e,h):(","(",SITES+'|Spiral Current: Strong'],
  ['hazards not bound',HTML,"TalentFx.bindMore({ hazards:()=>groundHazards });","TalentFx.bindMore({ hazardsX:()=>groundHazards });",SITES+'|Long Spiral'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the hz partPre site',HTML,"const _hzO=(h._talZ&&","const _hzO=((brnd(),h._talZ)&&",ID],
  ['draw at the hz part site',HTML,"} }); if(_hzO) TalentFx.part(_hzO,h,'hz');","} }); brnd(); if(_hzO) TalentFx.part(_hzO,h,'hz');",ID],
  ['draw at the hzTick site',HTML,"damage(e,dotTickAmt(h.src,e,_hzO?","damage(e,dotTickAmt(h.src,e,(brnd(),_hzO)?",ID],
  // ---- Crushed ----
  ['Crushed 2% -> 3%',FXJ,"fc_1_1:[ {param:'cr.k',add:R(0.02)} ]","fc_1_1:[ {param:'cr.k',add:R(0.03)} ]",'Crushed: Pressure'],
  ['Crushed max 3 -> 4',FXJ,"oCr:{unit:true,max:3,","oCr:{unit:true,max:4,",'Crushed: Pressure|Crushing Depth'],
  ['Crushed 5 s -> 6 s',FXJ,"dur:P('cr.dur',5)","dur:P('cr.dur',6)",'Crushed: Pressure'],
  ['Lasting Crush 0.4 -> 0.5 s',FXJ,"{param:'cr.dur',add:R(0.4)}","{param:'cr.dur',add:R(0.5)}",'Crushed: Pressure'],
  ['Deep Crush 2% -> 3%',FXJ,"fc_5_1:[ {stat:{move:R(-0.02)}","fc_5_1:[ {stat:{move:R(-0.03)}",'Crushed: Pressure'],
  ['Pale Eyes off',FXJ,"if(c.auto&&Pm['auto.pale']&&ust(A,T,u,t,'oCr')>0) k*=1+Pm['auto.pale'];",'','Crushed: Pressure'],
  ['Pearl Skin 3% -> 4%',FXJ,"{param:'dr.pearl',add:R(0.03)}","{param:'dr.pearl',add:R(0.04)}",'Crushed: Pressure'],
  ['Crushed not given by the Sphere',FXJ,"if(CR.some(id=>T.r[id])) addU(A,T,u,t,'oCr',1,cx);",'','Crushed: Pressure|Crushing Depth'],
  ['Crushing Depth 1 s -> 1.2 s',FXJ,"if(tstun(A,T,u,x,1,c.h?('c'+c.h._oId):'c'))","if(tstun(A,T,u,x,1.2,c.h?('c'+c.h._oId):'c'))",'Crushing Depth'],
  ['Crushing Depth keeps the stacks',FXJ,"c.h?('c'+c.h._oId):'c')) A.ustPut(T,u,x,'oCr',0); },","c.h?('c'+c.h._oId):'c')); },",'Crushing Depth'],
  ['stun lock 0.5 s -> 0.3 s',FXJ,"A.setMark(T,u,t,'oLk',{dur:d+0.5});","A.setMark(T,u,t,'oLk',{dur:d+0.3});",'Crushing Depth|stun-lock'],
  ['a stun on a stunned enemy',FXJ,"!((t.stunned||0)>0)&&!A.markOf(u,t,'oLk')","!A.markOf(u,t,'oLk')",'Crushing Depth'],
  ['one cast stuns three times',FXJ,"if((K[kk]||0)>=2) return false;","if((K[kk]||0)>=3) return false;",'Spun Round'],
  ['Third Crush at 3',FXJ,"ust(A,T,u,t,'oCr')>=2) k*=1+Pm['sph.third'];","ust(A,T,u,t,'oCr')>=3) k*=1+Pm['sph.third'];",'Crushing Depth'],
  // ---- Pressure Sphere ----
  ['Tight Sphere 5% -> 6%',FXJ,"{param:'sph.tight',add:R(0.05)}","{param:'sph.tight',add:R(0.06)}",'Pressure Sphere: Tight'],
  ['Heavy Hand above 50%',FXJ,"t.hp>0.70*t.maxHp","t.hp>0.50*t.maxHp",'Pressure Sphere: Tight'],
  ['Heavy Hand 8% -> 9%',FXJ,"{param:'sph.heavy',add:R(0.08)}","{param:'sph.heavy',add:R(0.09)}",'Pressure Sphere: Tight'],
  ['Second Current 6% -> 7%',FXJ,"{param:'sph.slow',add:R(0.06)}","{param:'sph.slow',add:R(0.07)}",'Pressure Sphere: Tight'],
  ['Second Current 2 s -> 3 s',FXJ,"slowOn(t,Pm['sph.slow'],2);","slowOn(t,Pm['sph.slow'],3);",'Pressure Sphere: Tight'],
  ['Deep Sphere 1 -> 2',FXJ,"{param:'sph.sw',add:R(1)}","{param:'sph.sw',add:R(2)}",'Pressure Sphere: Tight'],
  ['Imploding Sphere 2.5 m -> 4 m',FXJ,"within:2.5,skip:'target'","within:4,skip:'target'",'Pressure Sphere: Tight'],
  ['Imploding Sphere 40% -> 50%',FXJ,"{param:'sph.imp',add:0.4}","{param:'sph.imp',add:0.5}",'Pressure Sphere: Tight'],
  ['Sphere in the Current off the current',FXJ,"if(x!==t&&hs.some(h=>inHz(h,x)))","if(x!==t)",'Sphere in the Current'],
  ['Sphere in the Current 40% -> 50%',FXJ,"{param:'sph.ride',add:0.4}","{param:'sph.ride',add:0.5}",'Sphere in the Current'],
  ['Drowning Sphere off',FXJ,"if(Pm['sph.water']&&t.alive) A.acts","if(false) A.acts",'Sphere in the Current'],
  ['circles kept at a new wave',FXJ,"if(T.s.zn.oDs) T.s.zn.oDs.length=0;",'','Sphere in the Current'],
  // ---- Chambers ----
  ['Chambers 0.05% -> 0.06%',FXJ,"fc_1_4:[ {stat:{apow:R(0.0005)},per:'oCh'} ]","fc_1_4:[ {stat:{apow:R(0.0006)},per:'oCh'} ]",'Chambers: one'],
  ['Chambers max 40 -> 41',FXJ,"oCh:{max:40},","oCh:{max:41},",'Chambers: one'],
  ['Old Rooms 2 -> 3',FXJ,"{param:'ch.start',add:R(2)}","{param:'ch.start',add:R(3)}",'Chambers: one'],
  ['Old Rooms every wave',FXJ,"if(s.wave===1&&Pm['ch.start'])","if(Pm['ch.start'])",'Chambers: one'],
  ['First Door every Sphere',FXJ,"Pm['ch.first']&&s.oFd!==s.wave){","Pm['ch.first']){",'Chambers: one'],
  ['Gathered Weight 2 -> 3',FXJ,"{param:'ch.ult',add:R(2)}","{param:'ch.ult',add:R(3)}",'Chambers: one'],
  ['Nacre per 5 Chambers',FXJ,"per:{stack:'oCh',div:10}","per:{stack:'oCh',div:5}",'Chambers: one'],
  ['Sealed Rooms 1% -> 2%',FXJ,"{param:'mr.seal',add:R(0.01)}","{param:'mr.seal',add:R(0.02)}",'every 10 Chambers'],
  ['Snowfall Weight 0.5% -> 0.6%',FXJ,"{param:'sp.snow',add:R(0.005)}","{param:'sp.snow',add:R(0.006)}",'every 10 Chambers'],
  ['Snowfall Weight on basic hits',FXJ,"if(c.auto&&Pm['auto.pale']","k*=spellK(A,T,u,t); if(c.auto&&Pm['auto.pale']",'every 10 Chambers'],
  ['Shell Wall 0.6% -> 0.7%',FXJ,"{param:'dr.shell',add:R(0.006)}","{param:'dr.shell',add:R(0.007)}",'every 10 Chambers'],
  ['Fortieth Door at 39',FXJ,"if:{stackMin:{oCh:40}}","if:{stackMin:{oCh:39}}",'every 10 Chambers'],
  ['Fortieth Door a quarter more',FXJ,"{stat:{nrg:1/3}","{stat:{nrg:1/4}",'every 10 Chambers'],
  ['Rooms Full of Sea 0.1% -> 0.2%',FXJ,"{param:'ul.rooms',add:R(0.001)}","{param:'ul.rooms',add:R(0.002)}",'every 10 Chambers'],
  // ---- Abyssal Reserve ----
  ['the empowered press not seen',FXJ,"let emp=F>1+1e-6;","let emp=false;",'Abyssal Reserve: Stored|Spent Breath|Saved Breath'],
  ['Stored Pressure multiplied, not points',FXJ,"k*=(1+e.F+Pm['ar.pts'])/(1+e.F);","k*=1+Pm['ar.pts'];",'Abyssal Reserve: Stored'],
  ['Diver\'s Breath up to 4 spells',FXJ,"s.oDv=Math.min(3,(s.oDv||0)+1);","s.oDv=Math.min(4,(s.oDv||0)+1);",'Abyssal Reserve: Stored'],
  ['Diver\'s Breath 2% -> 3%',FXJ,"{param:'ar.dive',add:R(0.02)}","{param:'ar.dive',add:R(0.03)}",'Abyssal Reserve: Stored'],
  ['Breath Held Long 2% -> 3%',FXJ,"{param:'ar.held',add:R(0.02)}","{param:'ar.held',add:R(0.03)}",'Abyssal Reserve: Stored'],
  ['Keeper\'s Ledger 1 -> 2',FXJ,"{param:'ch.ledger',add:R(1)}","{param:'ch.ledger',add:R(2)}",'Abyssal Reserve: Stored'],
  ['Deep Energy 1 -> 2',FXJ,"{param:'ar.nrg',add:R(1)}","{param:'ar.nrg',add:R(2)}",'Abyssal Reserve: Stored'],
  ['Deeper Rooms at 19 Chambers',FXJ,"A.stGet(T,'oCh')>=20&&!u._prReady","A.stGet(T,'oCh')>=19&&!u._prReady",'Abyssal Reserve: Stored'],
  ['Deeper Rooms every third cast',FXJ,"(u._prS||0)>=2){ u._prReady=1;","(u._prS||0)>=3){ u._prReady=1;",'Abyssal Reserve: Stored'],
  ['Saved Breath does not wait',FXJ,"if(emp&&slot==='blue'&&Pm['ar.saved']){ p.sm=base; u._prReady=1; emp=false; }",'','Saved Breath'],
  ['Saved Breath 20% -> 25%',FXJ,"if(e.sv) k*=1.20;","if(e.sv) k*=1.25;",'Saved Breath'],
  ['Spent Breath 0.5 s -> 0.6 s',FXJ,"if(s.oCurE&&Pm['ar.stun']) tstun(A,T,u,t,0.5,key);","if(s.oCurE&&Pm['ar.stun']) tstun(A,T,u,t,0.6,key);",'Spent Breath'],
  ['Spent Breath on a plain spell',FXJ,"if(s.oCurE&&Pm['ar.stun']) tstun(A,T,u,t,0.5,key);","if(Pm['ar.stun']) tstun(A,T,u,t,0.5,key);",'Spent Breath'],
  ['Spent Breath every tick',FXJ,"if(first&&h._oE&&Pm['ar.stun'])","if(h._oE&&Pm['ar.stun'])",'Spent Breath'],
  // ---- No Far Wall ----
  ['No Far Wall every 9th',FXJ,"Math.floor(s.oSeal/10)>Math.floor(was/10)","Math.floor(s.oSeal/9)>Math.floor(was/9)",'No Far Wall'],
  ['No Far Wall double',FXJ,"if(s.oNfwOn) k*=3;","if(s.oNfwOn) k*=2;",'No Far Wall'],
  ['No Far Wall: no line damage',FXJ,"dmgTo(x,raw); if(x.alive) addU(A,T,u,x,'oCr',3,cx);","if(x.alive) addU(A,T,u,x,'oCr',3,cx);",'No Far Wall'],
  ['No Far Wall: a wide line',FXJ,"-E.bodyR(x)>0.5*M) continue;","-E.bodyR(x)>8*M) continue;",'No Far Wall'],
  ['No Far Wall: 2 Crushed',FXJ,"addU(A,T,u,x,'oCr',3,cx); } }","addU(A,T,u,x,'oCr',2,cx); } }",'No Far Wall'],
  ['No Far Wall: opens at 25 s',FXJ,"s.oFt>=20){ s.oNfwAny=1;","s.oFt>=25){ s.oNfwAny=1;",'No Far Wall'],
  ['No Far Wall: the opening Sphere is the sealing one',FXJ,"        if(c.skill===SPH&&Pm.nfw&&s.oNfwArm){ s.oNfwArm=0; s.oNfwOn=1; }","        if(false){}",'No Far Wall'],
  // ---- Whorls ----
  ['Whorls 0.6% -> 0.7%',FXJ,"{stat:{aspd:R(-0.006)},per:{ust:'oWh'}","{stat:{aspd:R(-0.007)},per:{ust:'oWh'}",'Whorls: 1 a tick'],
  ['Whorls max 6 -> 7',FXJ,"oWh:{unit:true,max:6,","oWh:{unit:true,max:7,",'Whorls: 1 a tick|Spun Round'],
  ['Whorls 4 s -> 5 s',FXJ,"dur:P('wh.dur',4)","dur:P('wh.dur',5)",'Whorls: 1 a tick'],
  ['Tighter Spiral 1 s -> 1.5 s',FXJ,"{param:'wh.dur',add:R(1)}","{param:'wh.dur',add:R(1.5)}",'Whorls: 1 a tick'],
  ['Dizzied at 2',FXJ,"sp_6_4:[ {stat:{move:R(-0.02)},to:{team:'enemy',ust:{oWh:3}}} ]","sp_6_4:[ {stat:{move:R(-0.02)},to:{team:'enemy',ust:{oWh:2}}} ]",'Whorls: 1 a tick'],
  ['Turned Inside 0.4% -> 0.5%',FXJ,"{param:'wh.in',add:R(0.004)}","{param:'wh.in',add:R(0.005)}",'Whorls: 1 a tick'],
  ['Calm Eye at 2',FXJ,"ust(A,T,u,src,'oWh')>=3) f*=1-Pm['dr.calm'];","ust(A,T,u,src,'oWh')>=2) f*=1-Pm['dr.calm'];",'Whorls: 1 a tick'],
  ['2 Whorls a tick',FXJ,"if(whOn){ addU(A,T,u,x,'oWh',1,cx);","if(whOn){ addU(A,T,u,x,'oWh',2,cx);",'Whorls: 1 a tick'],
  ['Spun Round 1 s -> 1.2 s',FXJ,"tstun(A,T,u,x,sp?1.5:1,key)","tstun(A,T,u,x,sp?1.5:1.2,key)",'Spun Round'],
  ['Spun Round keeps the Whorls',FXJ,"tstun(A,T,u,x,sp?1.5:1,key)){ A.ustPut(T,u,x,'oWh',0);","tstun(A,T,u,x,sp?1.5:1,key)){",'Spun Round'],
  ['Abyss Mind 1% -> 2%',FXJ,"sp_11_2:[ {stat:{apow:R(0.01)},per:'oAm'} ]","sp_11_2:[ {stat:{apow:R(0.02)},per:'oAm'} ]",'Spun Round'],
  ['Abyss Mind 6 s -> 8 s',FXJ,"oAm:{max:3,dur:6},","oAm:{max:3,dur:8},",'Spun Round'],
  ['Eye of the Spiral 0.5 m',FXJ,"within:2,skip:'target'},to:'target',m:1","within:0.5,skip:'target'},to:'target',m:1",'Spun Round'],
  ['Too Deep to Turn 10% -> 12%',FXJ,"{param:'wh.deep',add:R(0.10)}","{param:'wh.deep',add:R(0.12)}",'Spun Round'],
  ['Too Deep to Turn on a stunnable enemy',FXJ,"if(Pm['wh.deep']&&!stunOk(A,T,u,x))","if(Pm['wh.deep'])",'Spun Round'],
  ['Quick Whorls 20% -> 25%',FXJ,"sp_8_4:[ {on:'oScTick',chance:R(0.2)","sp_8_4:[ {on:'oScTick',chance:R(0.25)",'Spun Round'],
  // ---- Spiral Current ----
  ['Strong Current 2 -> 3 points',FXJ,"{param:'sc.nrg',add:R(0.02)}","{param:'sc.nrg',add:R(0.03)}",'Spiral Current: Strong'],
  ['Wide Whorl 0.1 m -> 0.2 m',FXJ,"{param:'sc.rad',add:R(0.1)}","{param:'sc.rad',add:R(0.2)}",'Spiral Current: Strong'],
  ['Current Bite 4% -> 5%',FXJ,"{param:'sc.bite',add:R(0.04)}","{param:'sc.bite',add:R(0.05)}",'Spiral Current: Strong'],
  ['Under Pressure 3% -> 4%',FXJ,"{param:'sc.under',add:R(0.03)}","{param:'sc.under',add:R(0.04)}",'Spiral Current: Strong'],
  ['Drained 2% -> 3%',FXJ,"{param:'dr.ain',add:R(0.02)}","{param:'dr.ain',add:R(0.03)}",'Spiral Current: Strong'],
  ['Drained 3 s -> 4 s',FXJ,"A.setMark(T,u,x,'oDr',{dur:3});","A.setMark(T,u,x,'oDr',{dur:4});",'Spiral Current: Strong'],
  ['Weakened Draw 1.5% -> 2%',FXJ,"{param:'sc.weak',add:R(0.015)}","{param:'sc.weak',add:R(0.02)}",'Spiral Current: Strong'],
  ['Weakened Draw out of the current',FXJ,"if(Pm['sc.weak']&&underSc(A,T,u,src)) f*=1-Pm['sc.weak']; }","if(Pm['sc.weak']) f*=1-Pm['sc.weak']; }",'Spiral Current: Strong'],
  ['Dry Well 3% -> 4%',FXJ,"sp_7_1:[ {on:'teamHeal',if:{fn:'underScU'},less:R(0.03)} ]","sp_7_1:[ {on:'teamHeal',if:{fn:'underScU'},less:R(0.04)} ]",'Spiral Current: Strong'],
  ['Patient Current 0.5 s -> 0.6 s',FXJ,"sp_5_1:[ {on:'cd',skill:'blue',add:R(-0.5)} ]","sp_5_1:[ {on:'cd',skill:'blue',add:R(-0.6)} ]",'Spiral Current: Strong'],
  ['Quick Sphere 0.3 s -> 0.4 s',FXJ,"fc_2_2:[ {on:'cd',skill:'green',add:R(-0.3)} ]","fc_2_2:[ {on:'cd',skill:'green',add:R(-0.4)} ]",'Spiral Current: Strong'],
  ['Slow Current 1% -> 2%',FXJ,"fc_9_2:[ {on:'cd',less:R(0.01)} ]","fc_9_2:[ {on:'cd',less:R(0.02)} ]",'Spiral Current: Strong'],
  ['Long Spiral 1 m -> 2 m',FXJ,"{param:'sc.long',add:R(1)}","{param:'sc.long',add:R(2)}",'Long Spiral'],
  ['Standing Whirl 30% -> 40%',FXJ,"o.radius=(o.radius||0)*1.3;","o.radius=(o.radius||0)*1.4;",'Long Spiral'],
  ['Standing Whirl spins 5 s',FXJ,"h.travelLeft=t; h.life=t+4; }","h.travelLeft=t; h.life=t+5; }",'Long Spiral'],
  ['Drag Along 0.3 m -> 0.4 m',FXJ,"{param:'sc.drag',add:R(0.3)}","{param:'sc.drag',add:R(0.4)}",'Long Spiral'],
  ['Drag Along every tick',FXJ,"if(first&&!(x.immovable","if(!(x.immovable",'Long Spiral'],
  ['Sweeping Current carries half the way',FXJ,"let d=spd*h.travelLeft;","let d=spd*h.travelLeft*0.5;",'Long Spiral'],
  ['Slow Water 3% -> 4%',FXJ,"{param:'sc.slowM',add:R(0.03)}","{param:'sc.slowM',add:R(0.04)}",'Long Spiral'],
  // ---- Drawn Strength ----
  ['Drawn Strength 10% -> 11%',FXJ,"{param:'ds.k',add:R(0.10)}","{param:'ds.k',add:R(0.11)}",'Drawn Strength'],
  ['Spare Strength 3% -> 4%',FXJ,"{param:'ds.self',add:R(0.03)}","{param:'ds.self',add:R(0.04)}",'Drawn Strength'],
  ['Strength Kept 3% -> 4%',FXJ,"{param:'ds.more',add:R(0.03)}","{param:'ds.more',add:R(0.04)}",'Drawn Strength'],
  ['what is kept: the gain x p',FXJ,"if(p>0&&p<1) pool+=g*p/(1-p);","if(p>0&&p<1) pool+=g*p;",'Drawn Strength'],
  ['to the ally with the most energy',FXJ,"if(!b||(a.energy||0)<(b.energy||0)) b=a;","if(!b||(a.energy||0)>(b.energy||0)) b=a;",'Drawn Strength'],
  ['Given Strength within 30 m',FXJ,"within:6},{u}):[];","within:30},{u}):[];",'Drawn Strength'],
  ['Shared Strength 2% -> 3%',FXJ,"sp_10_1:[ {param:'ds.as',add:R(0.02)}, {stat:{aspd:R(0.02)}","sp_10_1:[ {param:'ds.as',add:R(0.02)}, {stat:{aspd:R(0.03)}",'Drawn Strength'],
  ['Shared Strength 3 s -> 4 s',FXJ,"A.setMark(T,u,a,'oSs',{dur:3});","A.setMark(T,u,a,'oSs',{dur:4});",'Drawn Strength'],
  ['Drawn Strength from any energy slow',FXJ,"(x._nrgSlowT||0)>0&&A.markOf(u,x,'oNs')){","(x._nrgSlowT||0)>0){",'Drawn Strength'],
  ['Keeper\'s Calm 5% a rank, uncapped',FXJ,"sp_3_1:[ {on:'ccIn',less:R(0.04),upTo:0.20} ]","sp_3_1:[ {on:'ccIn',less:R(0.05)} ]",'Keeper.s Calm'],
  // ---- Drowning ----
  ['Sea Weight 2 a second',FXJ,"while(st.acc>=1){ st.acc-=1; v=Math.min(5,v+1); }","while(st.acc>=1){ st.acc-=1; v=Math.min(5,v+2); }",'Drowning: 1 Sea'],
  ['Sea Weight max 6',FXJ,"while(st.acc>=1){ st.acc-=1; v=Math.min(5,v+1); }","while(st.acc>=1){ st.acc-=1; v=Math.min(6,v+1); }",'Drowning: 1 Sea'],
  ['Gathering Deep 10% -> 20%',FXJ,"{param:'sw.fast',add:R(0.10)}","{param:'sw.fast',add:R(0.20)}",'Drowning: 1 Sea'],
  ['Sea Weight 0.4% -> 0.5%',FXJ,"{param:'sw.less',add:R(0.004)}","{param:'sw.less',add:R(0.005)}",'Drowning: 1 Sea|Drowning enemies'],
  ['Drowning 2% -> 3%',FXJ,"{param:'sw.drown',add:R(0.02)}","{param:'sw.drown',add:R(0.03)}",'Drowning: 1 Sea'],
  ['Drowning at 4',FXJ,"if(sw>=5) k*=(1+(Pm['sw.drown']||0))","if(sw>=4) k*=(1+(Pm['sw.drown']||0))",'Drowning: 1 Sea'],
  ['Heavy Sea 1 s -> 2 s',FXJ,"{param:'sw.lin',add:R(1)}","{param:'sw.lin',add:R(2)}",'Drowning: 1 Sea'],
  ['Sea Weight lapses 2 s after',FXJ,"dur:P('sw.lin',1)}","dur:P('sw.lin',2)}",'Drowning: 1 Sea'],
  ['Silt 3% -> 4%',FXJ,"os_3_1:[ {stat:{move:R(-0.03)}","os_3_1:[ {stat:{move:R(-0.04)}",'Drowning enemies'],
  ['Undersea Quiet 2% -> 3%',FXJ,"os_9_1:[ {stat:{aspd:R(-0.02)}","os_9_1:[ {stat:{aspd:R(-0.03)}",'Drowning enemies'],
  ['Pale Calm 3% -> 4%',FXJ,"{param:'dr.pale',add:R(0.03)}","{param:'dr.pale',add:R(0.04)}",'Drowning enemies'],
  ['Last Air 3% -> 4%',FXJ,"os_6_1:[ {on:'teamHeal',if:{unitUst:{oSw:5}},less:R(0.03)} ]","os_6_1:[ {on:'teamHeal',if:{unitUst:{oSw:5}},less:R(0.04)} ]",'Drowning enemies'],
  ['Pressed Lungs on hits 2% -> 3%',FXJ,"targetUst:{oSw:5}},more:R(0.02)}","targetUst:{oSw:5}},more:R(0.03)}",'Drowning enemies'],
  ['Pressed Lungs on his water 2% -> 3%',FXJ,"{param:'sw.press',add:R(0.02)}","{param:'sw.press',add:R(0.03)}",'Drowning enemies'],
  ['Saltwater Blood 1% -> 2%',FXJ,"unitUst:{oSw:5}},do:[{heal:{pct:R(0.01),of:'maxHp'}}]}","unitUst:{oSw:5}},do:[{heal:{pct:R(0.02),of:'maxHp'}}]}",'Drowning enemies'],
  ['The Weight Comes Up 20% -> 10%',FXJ,"os_11_2:[ {on:'oUlTick',chance:R(0.2)","os_11_2:[ {on:'oUlTick',chance:R(0.1)",'Drowning enemies'],
  ['Where the Currents Meet 5% -> 6%',FXJ,"if(Pm.wcm&&sw>=3) k*=1.05;","if(Pm.wcm&&sw>=3) k*=1.06;",'Where the Currents'],
  ['Where the Currents Meet at 2',FXJ,"if(Pm.wcm&&sw>=3) k*=1.05;","if(Pm.wcm&&sw>=2) k*=1.05;",'Where the Currents'],
  ['Where the Currents Meet: a Whorl every time',FXJ,"if(!D[x.uid]){ D[x.uid]=1; addU(A,T,u,x,'oWh',1); }","{ addU(A,T,u,x,'oWh',1); }",'Where the Currents'],
  ['Where the Currents Meet: a Whorl without Whorls',FXJ,"if(v>=5&&Pm.wcm&&T.r.sp_1_4)","if(v>=5&&Pm.wcm)",'Where the Currents'],
  // ---- the Flood ----
  ['Flood every 9 s',FXJ,"per=Math.max(1,8-(Pm['fl.fast']||0))","per=Math.max(1,9-(Pm['fl.fast']||0))",'Flood: one level'],
  ['High Water Mark 1 s -> 0.5 s',FXJ,"{param:'fl.fast',add:R(1)}","{param:'fl.fast',add:R(0.5)}",'Flood: one level'],
  ['Flood Gate 1 -> 2',FXJ,"{param:'fl.gate',add:R(1)}","{param:'fl.gate',add:R(2)}",'Flood: one level'],
  ['Flood Wall 0.6% -> 0.7%',FXJ,"{param:'dr.flood',add:R(0.006)}","{param:'dr.flood',add:R(0.007)}",'Flood: one level'],
  ['Flood 0.6% -> 0.7%',FXJ,"{param:'fl.k',add:R(0.006)}","{param:'fl.k',add:R(0.007)}",'Flood: one level'],
  ['Sea Level at 5',FXJ,"A.stGet(T,'oFl')>=3) f*=1-Pm['mr.sea'];","A.stGet(T,'oFl')>=5) f*=1-Pm['mr.sea'];",'Flood: one level'],
  ['Sea Level 2% -> 3%',FXJ,"{param:'mr.sea',add:R(0.02)}","{param:'mr.sea',add:R(0.03)}",'Flood: one level'],
  ['Tide Rising 1 -> 2',FXJ,"{param:'fl.tide',add:R(1)}","{param:'fl.tide',add:R(2)}",'Flood: one level'],
  ['Rising Fast 20% -> 15%',FXJ,"os_8_3:[ {on:'death',if:{who:'enemy',fn:'inWaterU'},chance:R(0.2)","os_8_3:[ {on:'death',if:{who:'enemy',fn:'inWaterU'},chance:R(0.15)",'Flood: one level'],
  ['Rising Fast out of the water',FXJ,"os_8_3:[ {on:'death',if:{who:'enemy',fn:'inWaterU'}","os_8_3:[ {on:'death',if:{who:'enemy'}",'Flood: one level'],
  ['the Flood kept between waves',FXJ,"oFl:{max:5,wave:'reset'},","oFl:{max:5},",'Flood: one level'],
  ['Above the Line at Flood 4',FXJ,"stackMin:{oFl:5}},do:[{dmg:","stackMin:{oFl:4}},do:[{dmg:",'Rising Sea'],
  ['Above the Line 10% -> 20%',FXJ,"stackMin:{oFl:5}},do:[{dmg:{pct:R(0.10)","stackMin:{oFl:5}},do:[{dmg:{pct:R(0.20)",'Rising Sea'],
  ['Rising Sea 2 m -> 3 m',FXJ,"{param:'ul.rise',add:2}","{param:'ul.rise',add:3}",'Rising Sea'],
  ['Rising Sea below Flood 5',FXJ,"if(Pm['ul.rise']&&A.stGet(T,'oFl')>=5) add+=","if(Pm['ul.rise']) add+=",'Rising Sea'],
  ['Far Water 0.2 m -> 0.3 m',FXJ,"{param:'ul.rad',add:R(0.2)}","{param:'ul.rad',add:R(0.3)}",'Rising Sea'],
  ['Wide Flood 0.2 m -> 0.3 m',FXJ,"{param:'ul.wide',add:R(0.2)}","{param:'ul.wide',add:R(0.3)}",'Rising Sea'],
  ['Endless Tide 0.1 s -> 0.2 s',FXJ,"{param:'ul.dur',add:R(0.1)}","{param:'ul.dur',add:R(0.2)}",'Rising Sea'],
  ['Shoreless 3% -> 4%',FXJ,"{param:'ul.shore',add:R(0.03)}","{param:'ul.shore',add:R(0.04)}",'Rising Sea'],
  ['Tidal Weight 3% -> 4%',FXJ,"{param:'ul.tidal',add:R(0.03)}","{param:'ul.tidal',add:R(0.04)}",'Rising Sea'],
  ['Tidal Hammer 5% -> 6%',FXJ,"{param:'ul.ham',add:R(0.05)}","{param:'ul.ham',add:R(0.06)}",'Rising Sea'],
  ['Long Flood 4% -> 5%',FXJ,"{param:'ul.long',add:R(0.04)}","{param:'ul.long',add:R(0.05)}",'Rising Sea'],
  ['Pounding Tide 1.2x as often',FXJ,"h.interval=0.5/1.3;","h.interval=0.5/1.2;",'the flood changed'],
  ['Pounding Tide 15% weaker',FXJ,"h.interval=0.5/1.3; h._oStr*=0.8;","h.interval=0.5/1.3; h._oStr*=0.85;",'the flood changed'],
  ['Drowned Ground 4 s',FXJ,"h.life+=3; h._oHalf=3;","h.life+=4; h._oHalf=3;",'the flood changed'],
  ['Drowned Ground at full strength',FXJ,"h.life<=h._oHalf)?0.5:1)","h.life<=h._oHalf)?1:1)",'the flood changed'],
  ['Second Ocean on the least HP',FXJ,"if(x.alive&&(!b||x.hp>b.hp)) b=x;","if(x.alive&&(!b||x.hp<b.hp)) b=x;",'the flood changed'],
  ['Second Ocean 4 m',FXJ,"r:3*M,dmg:h.dmg","r:4*M,dmg:h.dmg",'the flood changed'],
  ['Second Ocean raises another',FXJ,"if(h._oK!=='ul'||h._oSub||!u.alive) return;","if(h._oK!=='ul'||!u.alive) return;",'the flood changed'],
  ['a flood swept away by a wave still ends',FXJ,"wave(A,T,u){ const s=T.s, Pm=T.P; s.oHz=[];","wave(A,T,u){ const s=T.s, Pm=T.P;",'the flood changed'],
  ['Pounding Ocean 3% -> 4%',FXJ,"{param:'ul.pound',add:R(0.03)}","{param:'ul.pound',add:R(0.04)}",'the flood changed'],
  ['Grinding Weight 15% -> 10%',FXJ,"fc_8_1:[ {on:'oUlTick',chance:R(0.15)","fc_8_1:[ {on:'oUlTick',chance:R(0.10)",'the flood changed'],
  ['Spinning Deep 1 -> 2',FXJ,"{param:'ul.whorl',add:R(1)}","{param:'ul.whorl',add:R(2)}",'the flood changed'],
  ['Still Ocean 5% -> 6%',FXJ,"{param:'ul.still',add:R(0.05)}","{param:'ul.still',add:R(0.06)}",'the flood changed'],
  ['Cold Shock 5% -> 6%',FXJ,"{param:'cs.slow',add:R(0.05)}","{param:'cs.slow',add:R(0.06)}",'Cold Shock'],
  ['The Water Remembers 20% -> 25%',FXJ,"{param:'wr.k',add:R(0.2)}","{param:'wr.k',add:R(0.25)}",'Cold Shock'],
  ['The Water Remembers every time',FXJ,"&&!st.used[w._oId]){ st.used[w._oId]=1;","){",'Cold Shock'],
  ['The Water Remembers 5 s',FXJ,"st.rem={h:st.in,left:4};","st.rem={h:st.in,left:5};",'Cold Shock'],
  ['Still Mind 1.5% -> 2%',FXJ,"{param:'sp.still',add:R(0.015)}","{param:'sp.still',add:R(0.02)}",'Still Mind'],
  ['Still Mind 0.5 m',FXJ,"{team:'enemy',within:4},{u}).length===0","{team:'enemy',within:0.5},{u}).length===0",'Still Mind'],
  ['Finished Work below 25%',FXJ,"t.hp<0.30*t.maxHp","t.hp<0.25*t.maxHp",'Still Mind'],
  ['Deep Lungs 0.2% -> 0.3%',FXJ,"os_2_4:[ {on:'tick',period:1,do:[{heal:{pct:R(0.002)","os_2_4:[ {on:'tick',period:1,do:[{heal:{pct:R(0.003)",'Still Mind'],
  ['Patient Shell after 3 s',FXJ,"s.oPsQ>=4)","s.oPsQ>=3)",'Still Mind'],
  ['Patient Shell 1.5% -> 2%',FXJ,"{param:'ps.k',add:R(0.015)}","{param:'ps.k',add:R(0.02)}",'Still Mind'],
  ['Patient Shell returns after 3 s',FXJ,"s.oPsB=1; s.oPsW=4;","s.oPsB=1; s.oPsW=3;",'Still Mind'],
  ['Patient Shell kept across a wave',FXJ,"s.oFlT=0; s.oPsQ=0; s.oPsH=null; s.oPsOn=0; s.oPsB=0; s.oPsW=0;","s.oFlT=0; s.oPsH=null;",'Still Mind'],
  // ---- the signatures ----
  ['The Spiral Deep 1 Whorl a tick',FXJ,"(h._oSp?2:0)","(h._oSp?1:0)",'The Spiral Deep'],
  ['The Spiral Deep 1 m a second',FXJ,"0.5*(h.interval||0.5)*M","1*(h.interval||0.5)*M",'The Spiral Deep'],
  ['The Spiral Deep: half the energy',FXJ,"inUlt(A,T,u,x,true)) keep=0;","inUlt(A,T,u,x,true)) keep=0.5;",'The Spiral Deep'],
  ['The Spiral Deep 1.2 s',FXJ,"sp?1.5:1,key","sp?1.2:1,key",'The Spiral Deep'],
  ['The Spiral Deep outside the flood',FXJ,"const sp=Pm['ul.spiral']&&inUlt(A,T,u,x,true)","const sp=!!Pm['ul.spiral']",'The Spiral Deep'],
  ['No Shore At All at Flood 4',FXJ,"if(Pm['ul.noshore']&&A.stGet(T,'oFl')>=5)","if(Pm['ul.noshore']&&A.stGet(T,'oFl')>=4)",'No Shore At All'],
  ['No Shore At All 70%',FXJ,"h._oStr*=0.6; h._oNs=1;","h._oStr*=0.7; h._oNs=1;",'No Shore At All'],
  ['No Shore At All: the last impact 50%',FXJ,"*0.4*n*E.defMul","*0.5*n*E.defMul",'No Shore At All'],
  // ---- the damage-reduction group ----
  ['damage reduction cap 40% -> 45%',FXJ,"const DR_CAP=0.40, SC_SLOW","const DR_CAP=0.45, SC_SLOW",'at most 40%'],
  ['Braced for Depth 4 s',FXJ,"{window:'oBr',dur:3}","{window:'oBr',dur:4}",'at most 40%']
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-logs']);
/* a plain recursive copy (fs.cpSync refuses to copy a folder into one of its own subfolders, and the temp folder may sit inside the checkout) */
function copyDir(src,dst,top){ fs.mkdirSync(dst,{recursive:true});
  for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(top&&(SKIP.has(e.name)||/^\.(ctl|remote|test|orryn)-/.test(e.name))) continue; const s=path.join(src,e.name), d=path.join(dst,e.name);
    if(e.isDirectory()) copyDir(s,d,false); else if(e.isFile()) fs.copyFileSync(s,d); } }
function copyTo(dir){ copyDir(root,dir,true); for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function count(file,from){ const s=fs.readFileSync(path.join(root,file),'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'); return s.split(a).length-1; }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-orc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-orryn.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.env.CHECK){ let bad=0; for(const c of C){ const n=count(c[1],c[2]); if(n!==1){ bad++; console.log('NOT ONCE ('+n+'): '+c[0]); } } console.log(C.length+' controls, '+bad+' texts not found exactly once'); process.exit(bad?1:0); }
const only=process.env.ONLY?new RegExp(process.env.ONLY):null; let caught=0, miss=0;
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); if(r.ok) caught++; else miss++; console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
console.log('controls: '+caught+' of '+(caught+miss)+' caught'); process.exit(miss?1:0);
