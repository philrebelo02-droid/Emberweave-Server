'use strict';
/* The controls for Vulmar's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed or given an unguarded
   seeded draw, a row or a number of his broken), runs the named tests of tests/talents-mech-vulmar.test.js in that copy, and expects them to FAIL. The checkout itself
   is never changed. Prints one line per control and a count; exits 1 if any control was not caught. J=1 by default: one copy at a time, each deleted as soon as it
   has run (the wiring brief's rule). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page sites (removed: his talents stop; an unguarded draw: the no-talent identity breaks) ----
  ['the at site for the ultimate',HTML,"if(u._tal&&u._tal.on.at) TalentFx.at(u,type,ctr,o,dB*(o.mul||2.0)*rm);   /* TALENT HOOK at: the ultimate's","if(false) TalentFx.at(u,type,ctr,o,dB*(o.mul||2.0)*rm);   /* TALENT HOOK at: the ultimate's",'real kit'],
  ['the slam part site',HTML,"if(by&&by._tal) TalentFx.part(by,u,'slam');","if(false) TalentFx.part(by,u,'slam');",'real kit'],
  ['the slam partPre site',HTML,"if(by&&by._tal) TalentFx.partPre(by,u,'slam');","if(false) TalentFx.partPre(by,u,'slam');",'Weight of the World'],
  ['the sling proj site',HTML,"if(u._tal&&u._tal.on.skillTgt) proj=TalentFx.skillTgt(u,type,proj,o)||proj;","if(false) proj=TalentFx.skillTgt(u,type,proj,o)||proj;",'the sling'],
  ['the sling anvil site',HTML,"if(anvil&&u._tal&&u._tal.on.skillTgt) anvil=TalentFx.skillTgt(u,'vuAnvil',anvil,o)||anvil;","if(false) anvil=TalentFx.skillTgt(u,'vuAnvil',anvil,o)||anvil;",'the sling'],
  ['the Great Fall gate',HTML,"if(anvil&&!(u._vuNoAnvil>0)){","if(anvil){",'the sling'],
  ['the Vow target site',HTML,"if(u._tal&&u._tal.on.skillTgt) tg2=TalentFx.skillTgt(u,type,tg2,o)||tg2;   /* TALENT HOOK skillTgt: whom the drag seizes","if(false) tg2=TalentFx.skillTgt(u,type,tg2,o)||tg2;   /* TALENT HOOK skillTgt: whom the drag seizes",'the Vow'],
  ['an unguarded draw at the sling site',HTML,"if(u._tal&&u._tal.on.skillTgt) proj=TalentFx.skillTgt(u,type,proj,o)||proj;","brnd(); if(u._tal&&u._tal.on.skillTgt) proj=TalentFx.skillTgt(u,type,proj,o)||proj;",'no talents'],
  ['an unguarded draw at the slam site',HTML,"if(by&&by._tal) TalentFx.partPre(by,u,'slam');","brnd(); if(by&&by._tal) TalentFx.partPre(by,u,'slam');",'no talents'],
  ['an unguarded draw at the ult site',HTML,"if(u._tal&&u._tal.on.at) TalentFx.at(u,type,ctr,o,dB*(o.mul||2.0)*rm);   /* TALENT HOOK at: the ultimate's","brnd(); if(u._tal&&u._tal.on.at) TalentFx.at(u,type,ctr,o,dB*(o.mul||2.0)*rm);   /* TALENT HOOK at: the ultimate's",'no talents'],
  ['an unguarded draw at the Vow site',HTML,"if(u._tal&&u._tal.on.skillTgt) tg2=TalentFx.skillTgt(u,type,tg2,o)||tg2;   /* TALENT HOOK skillTgt: whom the drag seizes","brnd(); if(u._tal&&u._tal.on.skillTgt) tg2=TalentFx.skillTgt(u,type,tg2,o)||tg2;   /* TALENT HOOK skillTgt: whom the drag seizes",'no talents'],
  // ---- Heft and Pressed Flat ----
  ['Heft 8 s',FXJ,"vuHeft:{unit:true, max:6, dur:P('heft.dur',8), full:'heftFull'}","vuHeft:{unit:true, max:6, dur:P('heft.dur',4), full:'heftFull'}",'/ Heft'],
  ['Heft slows 1% a rank',FXJ,"gw_1_1:[ {param:'heft.slow',add:R(0.01)} ],","gw_1_1:[ {param:'heft.slow',add:R(0.005)} ],",'/ Heft'],
  ['Measured Step',FXJ,"gw_11_1:[ {param:'heft.slow2',add:R(0.002)} ],","gw_11_1:[ {param:'heft.slow2',add:R(0)} ],",'/ Heft'],
  ['Leaden Weight',FXJ,"if(P.lw&&n>=3){ x.hasteMul=","if(P.lw&&n>=9){ x.hasteMul=",'/ Heft'],
  ['Millstone 0.4% a rank',FXJ,"gw_7_1:[ {on:'out',more:R(0.004),per:{ust:'vuHeft'}} ],","gw_7_1:[ {on:'out',more:R(0.002),per:{ust:'vuHeft'}} ],",'/ Heft'],
  ['Second Knot',FXJ,"gw_4_2:[ {param:'knot',add:R(1)} ],","gw_4_2:[ {param:'knot',add:R(0)} ],",'/ Heft'],
  ['Deep Memory',FXJ,"gw_12_1:[ {param:'dmem',add:R(1)} ],","gw_12_1:[ {param:'dmem',add:R(0)} ],",'/ Heft'],
  ['Pressed Flat waits out the lock',FXJ,"if((t.stunned||0)>0||r.lk>0){ v.stats.locked++; return; }","if(false){ v.stats.locked++; return; }",'Pressed Flat'],
  ['Pressed Flat 1 s',FXJ,"const secs=inPd?1.5:(P.pf?1+(P.gr||0):0);","const secs=inPd?1.5:(P.pf?0.5+(P.gr||0):0);",'Pressed Flat'],
  ['Settling',FXJ,"if(P.settle) for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2.5,skip:'target'},{u,tgt:t})) T.fn.addHeft(A,T,u,x,2); },","if(P.settle) for(const x of A.pick(T,u,{team:'enemy',of:'target',within:0.01,skip:'target'},{u,tgt:t})) T.fn.addHeft(A,T,u,x,2); },",'Pressed Flat'],
  ['Shared Burden',FXJ,"gw_6_1:[ {param:'shb',add:R(0.05)} ],","gw_6_1:[ {param:'shb',add:R(0.03)} ],",'Pressed Flat'],
  // ---- Tether ----
  ['the Tether clamp',FXJ,"if(d>L){ t.x=r.tx+dx/d*L;","if(d>L*99){ t.x=r.tx+dx/d*L;",'/ Tether'],
  ['Taut Line',FXJ,"gw_5_4:[ {param:'teth.dur',add:R(0.4)} ],","gw_5_4:[ {param:'teth.dur',add:R(0.1)} ],",'/ Tether'],
  ['Anchor Point',FXJ,"gw_8_4:[ {param:'teth.reach',add:R(-0.5)} ],","gw_8_4:[ {param:'teth.reach',add:R(0)} ],",'/ Tether'],
  ['Tether 3% a rank',FXJ,"gw_1_4:[ {on:'out',if:{fn:'tethered'},more:R(0.03)} ],","gw_1_4:[ {on:'out',if:{fn:'tethered'},more:R(0.01)} ],",'/ Tether'],
  ['Drawn Tight',FXJ,"gw_3_4:[ {param:'dt',add:R(0.02)} ],","gw_3_4:[ {param:'dt',add:R(0)} ],",'/ Tether'],
  ['Heavy Line',FXJ,"gw_6_4:[ {param:'hline',add:R(1)} ],","gw_6_4:[ {param:'hline',add:R(0)} ],",'/ Tether'],
  ['Two Tethers',FXJ,"gw_9_4:[ {param:'teth2',add:1} ],","gw_9_4:[ {param:'teth2',add:0} ],",'/ Tether'],
  ['Vow of Return half silence',FXJ,"if(P.vor&&t.alive){ const sil=Math.max(0,(t.silencedT||0))/2;","if(P.vor&&t.alive){ const sil=Math.max(0,(t.silencedT||0));",'/ Tether'],
  // ---- Impact ----
  ['Impact 4% a rank',FXJ,"fb_1_1:[ {param:'imp',add:R(0.04)} ],","fb_1_1:[ {param:'imp',add:R(0.03)} ],",'/ Impact'],
  ['Impact counted up to 6 m',FXJ,"LOCK=0.5, IMPACT_M=6, PD_MAX=2;","LOCK=0.5, IMPACT_M=60, PD_MAX=2;",'/ Impact'],
  ['Bound to Fall 5 m',FXJ,"if(P.btf){ if(m>=5) k*=1.05;","if(P.btf){ if(m>=50) k*=1.05;",'/ Impact'],
  ['Heavy Bodies',FXJ,"fb_8_1:[ {param:'hb',add:R(0.05)} ],","fb_8_1:[ {param:'hb',add:R(0)} ],",'/ Impact'],
  ['Second Bounce',FXJ,"fb_n3:[ {param:'sbnc',add:R(1)} ],","fb_n3:[ {param:'sbnc',add:R(0)} ],",'/ Impact'],
  ['Second Impact',FXJ,"if(P.si&&v.si<=0){ v.si=6; u.greenCd=0; }","if(P.si&&v.si<=0){ v.si=6; }",'/ Impact'],
  // ---- Debris ----
  ['Debris 3% a rank',FXJ,"fb_1_4:[ {param:'deb',add:R(0.03)} ],","fb_1_4:[ {param:'deb',add:R(0.02)} ],",'/ Debris'],
  ['Rubble Field',FXJ,"fb_6_4:[ {param:'deb.w',add:R(0.3)} ],","fb_6_4:[ {param:'deb.w',add:R(0)} ],",'/ Debris'],
  ['Settled Dust',FXJ,"fb_2_4:[ {param:'deb.dur',add:R(0.5)} ],","fb_2_4:[ {param:'deb.dur',add:R(0)} ],",'/ Debris'],
  ['Sharp Stones',FXJ,"fb_8_4:[ {param:'sharp',add:R(0.06)} ],","fb_8_4:[ {param:'sharp',add:R(0)} ],",'/ Debris'],
  ['Packed Debris',FXJ,"fb_10_4:[ {param:'pack',add:R(1)} ],","fb_10_4:[ {param:'pack',add:R(0)} ],",'/ Debris'],
  ['Avalanche Field',FXJ,"if(P.aval&&has(T,DEB)) T.fn.zone(","if(false) T.fn.zone(",'/ Debris'],
  // ---- Mass ----
  ['Mass 0.4% AP a rank',FXJ,"fb_2_3:[ {stat:{apow:R(0.004)},per:'vuMass'} ],","fb_2_3:[ {stat:{apow:R(0.002)},per:'vuMass'} ],",'/ Mass'],
  ['Gathering Mass',FXJ,"fb_4_3:[ {param:'mass.dur',add:R(1)} ],","fb_4_3:[ {param:'mass.dur',add:R(0)} ],",'/ Mass'],
  ['Mass Retained',FXJ,"fb_9_3:[ {param:'cd.mass',add:R(0.002)} ],","fb_9_3:[ {param:'cd.mass',add:R(0)} ],",'/ Mass'],
  ['Gravity Keeps',FXJ,"fb_10_2:[ {param:'gkeep',add:R(1)} ],","fb_10_2:[ {param:'gkeep',add:R(0)} ],",'/ Mass'],
  ['Unstepped Power',FXJ,"fb_11_3:[ {on:'unmoved',if:{srcTeam:'enemy'},do:[{stack:'vuMass',add:R(1)}]} ],","fb_11_3:[ {on:'unmoved',if:{srcTeam:'enemy'},do:[{stack:'vuMass',add:R(0)}]} ],",'/ Mass'],
  ['Last Knot 30%',FXJ,"if:{selfHpBelow:0.30},do:[{cd:'green',set:0},{stack:'vuMass',add:R(2)}]} ],","if:{selfHpBelow:0.10},do:[{cd:'green',set:0},{stack:'vuMass',add:R(2)}]} ],",'/ Mass'],
  ['World\'s Weight',FXJ,"fb_12_2:[ {on:'out',if:{casting:[WW,SLAM]},more:R(0.005),per:'vuMass'} ],","fb_12_2:[ {on:'out',if:{casting:[WW]},more:R(0.005),per:'vuMass'} ],",'/ Mass'],
  // ---- the sling ----
  ['Added Weight',FXJ,"gw_6_2:[ {on:'out',if:{casting:GS},more:R(0.05)} ],","gw_6_2:[ {on:'out',if:{casting:GS},more:R(0.03)} ],",'/ the sling'],
  ['Splash Weight',FXJ,"fb_4_2:[ {on:'kit',skill:GS,opt:{splashMul:{add:R(0.1)}}} ],","fb_4_2:[ {on:'kit',skill:GS,opt:{splashMul:{add:R(0.05)}}} ],",'/ the sling'],
  ['Sure Grip / Measured Sling',FXJ,"if(sling){ x+=(P.sg||0)+(P.msl||0);","if(sling){ x+=(P.sg||0);",'/ the sling'],
  ['Leaden',FXJ,"if(c.field==='stunned'){ let x=c.amt*(1+(P.leaden||0));","if(c.field==='stunned'){ let x=c.amt;",'/ the sling'],
  ['Felled Together',FXJ,"if(P.fel&&T.s.cur===GS) rec(T,t).fel=3; },","if(P.fel&&T.s.cur===GS) rec(T,t).fel=0.5; },",'/ the sling'],
  ['Cast Far 6 m',FXJ,"if(A.gap(p,x)<6*E.METER()){ const d=E.dist(p,x); if(d>bd){ bd=d; b=x; } }","if(A.gap(p,x)<1*E.METER()){ const d=E.dist(p,x); if(d>bd){ bd=d; b=x; } }",'/ the sling'],
  ['Great Fall +0.5 s',FXJ,"if(P.gfall&&c.tgt&&c.tgt===v.proj&&!v.ds) x+=0.5;","if(P.gfall&&c.tgt&&c.tgt===v.proj&&!v.ds) x+=0.1;",'/ the sling'],
  ['Spin and Release',FXJ,"fb_5_2:[ {param:'spin',add:1} ],","fb_5_2:[ {param:'spin',add:0} ],",'/ the sling'],
  ['Double Sling',FXJ,"gw_5_2:[ {param:'dsl',add:1} ],","gw_5_2:[ {param:'dsl',add:0} ],",'/ the sling'],
  ['Bound Pair 25%',FXJ,"A.hurt(T,u,r.bp,0.25*c.amt,'#9a7cff','bond');","A.hurt(T,u,r.bp,0.20*c.amt,'#9a7cff','bond');",'/ the sling'],
  ['Sling Aside',FXJ,"rl_7_1:[ {param:'aside',add:1} ],","rl_7_1:[ {param:'aside',add:0} ],",'/ the sling'],
  // ---- the Vow ----
  ['Patient Vow',FXJ,"gw_2_3:[ {param:'cd.vow',add:R(0.5)} ],","gw_2_3:[ {param:'cd.vow',add:R(0.2)} ],",'/ the Vow'],
  ['Clear Thought',FXJ,"rl_9_1:[ {param:'cd.pct',add:R(0.01)} ],","rl_9_1:[ {param:'cd.pct',add:R(0)} ],",'/ the Vow'],
  ['Deeper Silence / Vow Kept',FXJ,"else if(c.field==='silencedT'&&T.s.cur===TP&&!c.talent) c.amt+=(P.vsil||0); },","else if(c.field==='silencedT'&&T.s.cur===TP&&!c.talent) c.amt+=0; },",'/ the Vow'],
  ['Long Arm',FXJ,"fb_6_3:[ {param:'arm',add:R(0.30)} ],","fb_6_3:[ {param:'arm',add:R(0.20)} ],",'/ the Vow'],
  ['Gravity Shelter',FXJ,"rl_5_4:[ {param:'shelter',add:1} ],","rl_5_4:[ {param:'shelter',add:0} ],",'/ the Vow'],
  ['Cast Down',FXJ,"fb_7_3:[ {param:'cdown',add:1} ],","fb_7_3:[ {param:'cdown',add:0} ],",'/ the Vow'],
  // ---- the ultimate ----
  ['Wide Circle',FXJ,"gw_8_3:[ {on:'kit',skill:WW,opt:{radius:{addM:R(0.2)}}} ],","gw_8_3:[ {on:'kit',skill:WW,opt:{radius:{addM:R(0)}}} ],",'Weight of the World'],
  ['Crushing Slam',FXJ,"fb_8_2:[ {on:'out',if:{casting:SLAM},more:R(0.03)} ],","fb_8_2:[ {on:'out',if:{casting:SLAM},more:R(0.01)} ],",'Weight of the World'],
  ['Slow Descent',FXJ,"gw_11_2:[ {param:'sdesc',add:R(2)} ],","gw_11_2:[ {param:'sdesc',add:R(0)} ],",'Weight of the World'],
  ['Held Silence',FXJ,"if(P.hsil) A.control(T,u,t,'silencedT',P.hsil);","if(P.hsil) A.control(T,u,t,'silencedT',P.hsil*0.5);",'Weight of the World'],
  ['Grave Mercy',FXJ,"rl_11_3:[ {param:'gm',add:R(0.02)} ],","rl_11_3:[ {param:'gm',add:R(0.01)} ],",'Weight of the World'],
  ['Falling Sky',FXJ,"fb_9_2:[ {param:'fsky',add:R(1)} ],","fb_9_2:[ {param:'fsky',add:R(0.5)} ],",'Weight of the World'],
  ['Lifted Load',FXJ,"rl_7_2:[ {param:'load',add:R(0.03)} ],","rl_7_2:[ {param:'load',add:R(0.01)} ],",'Weight of the World'],
  ['What Cannot Be Lifted',FXJ,"gw_n2:[ {param:'wcbl',add:R(0.05)} ],","gw_n2:[ {param:'wcbl',add:R(0.03)} ],",'Weight of the World'],
  ['Settled Mind',FXJ,"gw_n1:[ {on:'wave',do:[{energy:R(2)}]} ],","gw_n1:[ {on:'wave',do:[{energy:R(1)}]} ],",'Weight of the World'],
  ['Heavy Patience',FXJ,"gw_10_3:[ {param:'hpat',add:R(1)} ],","gw_10_3:[ {param:'hpat',add:R(0)} ],",'Weight of the World'],
  // ---- Rise ----
  ['Rise every 6 s',FXJ,"risePer(A,T){ return Math.max(3,6+(T.P['rise.per']||0)); },","risePer(A,T){ return Math.max(3,9+(T.P['rise.per']||0)); },",'/ Rise'],
  ['Rise 0.6% a rank',FXJ,"rl_1_2:[ {param:'rise.dr',add:R(0.006)} ],","rl_1_2:[ {param:'rise.dr',add:R(0.004)} ],",'/ Rise'],
  ['High Lotus',FXJ,"rl_8_2:[ {param:'rise.max',add:R(1)} ],","rl_8_2:[ {param:'rise.max',add:R(0)} ],",'/ Rise'],
  ['Soft Air',FXJ,"rl_5_2:[ {stat:{apow:R(0.003)},per:'vuRise'} ],","rl_5_2:[ {stat:{apow:R(0.001)},per:'vuRise'} ],",'/ Rise'],
  ['Lightened at 3',FXJ,"rl_6_2:[ {stat:{move:R(0.04)},if:{stackMin:{vuRise:3}}} ],","rl_6_2:[ {stat:{move:R(0.04)},if:{stackMin:{vuRise:30}}} ],",'/ Rise'],
  ['Above Reach',FXJ,"if(P.abv&&c&&c.auto&&s&&s.melee&&stN(T,'vuRise')>=5) cut(0.25);","if(P.abv&&c&&c.auto&&s&&s.melee&&stN(T,'vuRise')>=5) cut(0.10);",'/ Rise'],
  ['the regeneration cap',FXJ,"const DR_FLOOR=0.60, ALLY_FLOOR=0.70, REGEN=0.012,","const DR_FLOOR=0.60, ALLY_FLOOR=0.70, REGEN=0.024,",'/ Rise'],
  // ---- Sacrament ----
  ['Sacrament 8% a rank',FXJ,"rl_1_4:[ {param:'pen',add:R(0.08)} ],","rl_1_4:[ {param:'pen',add:R(0.06)} ],",'/ Sacrament'],
  ['Sacrament within 6 m',FXJ,"if(P.pen&&u.alive&&A.gap(u,a)<6*E.METER()&&c.amt>0)","if(P.pen&&u.alive&&A.gap(u,a)<60*E.METER()&&c.amt>0)",'/ Sacrament'],
  ['Counted Names',FXJ,"rl_2_4:[ {param:'pen.cap',add:R(0.10)} ],","rl_2_4:[ {param:'pen.cap',add:R(0.05)} ],",'/ Sacrament'],
  ['Recompense',FXJ,"rl_9_4:[ {param:'pen.dur',add:R(0.5)} ],","rl_9_4:[ {param:'pen.dur',add:R(0.2)} ],",'/ Sacrament'],
  ['Bearing It',FXJ,"rl_4_4:[ {param:'bear',add:R(0.02)} ],","rl_4_4:[ {param:'bear',add:R(0.01)} ],",'/ Sacrament'],
  ['Old Debt',FXJ,"rl_6_4:[ {param:'debt',add:R(0.04)} ],","rl_6_4:[ {param:'debt',add:R(0.02)} ],",'/ Sacrament'],
  ['Kept Count',FXJ,"rl_12_4:[ {param:'kept',add:R(0.10)} ],","rl_12_4:[ {param:'kept',add:R(0.05)} ],",'/ Sacrament'],
  // ---- around him ----
  ['Held in Place',FXJ,"rl_4_3:[ {stat:{ctrl:R(0.03)},to:{team:'ally',within:4,others:true}} ],","rl_4_3:[ {stat:{ctrl:R(0.03)},to:{team:'ally',within:40,others:true}} ],",'around him'],
  ['Steady Ground',FXJ,"rl_7_3:[ {stat:{armor:R(0.015),mr:R(0.015)},to:{team:'ally',within:4,others:true}} ],","rl_7_3:[ {stat:{armor:R(0.01),mr:R(0.015)},to:{team:'ally',within:4,others:true}} ],",'around him'],
  ['Unstepped Circle',FXJ,"rl_5_3:[ {stat:{immovable:true},to:{team:'ally',within:3,others:true}} ],","rl_5_3:[ {stat:{immovable:true},to:{team:'ally',within:30,others:true}} ],",'around him'],
  ['Quiet Air',FXJ,"if(c.kind==='pull'&&(x.pullSpeed||0)>0) x.pullSpeed*=1-sh;","if(c.kind==='pull'&&(x.pullSpeed||0)>0) x.pullSpeed*=1;",'around him'],
  ['Ward of Weight 6 m',FXJ,"if(P.ward&&s&&A.gap(u,a)<4*E.METER()&&A.gap(a,s)>6*E.METER()) cut(P.ward);","if(P.ward&&s&&A.gap(u,a)<4*E.METER()) cut(P.ward);",'around him'],
  ['Floating Guard',FXJ,"rl_12_1:[ {param:'fg',add:R(0.01)} ],","rl_12_1:[ {param:'fg',add:R(0.005)} ],",'around him'],
  ['Fall Away once a wave',FXJ,"if(P.fa&&!v.faW&&u.alive","if(P.fa&&u.alive",'around him'],
  ['Settled Calm',FXJ,"rl_5_1:[ {on:'ccIn',less:R(0.04)} ],","rl_5_1:[ {on:'ccIn',less:R(0.02)} ],",'around him'],
  // ---- signatures, caps, clocks ----
  ['The Pressed District 35%',FXJ,"A.acts(T,u,[{slow:0.35,dur:0.6,on:'target'}],{u,tgt:t}); r.pdAcc+=dt;","A.acts(T,u,[{slow:0.10,dur:0.6,on:'target'}],{u,tgt:t}); r.pdAcc+=dt;",'signatures'],
  ['The Pressed District 6 s',FXJ,"if(P.pd) T.fn.zone(A,T,'vuPD',W.x,W.y,W.R,6);","if(P.pd) T.fn.zone(A,T,'vuPD',W.x,W.y,W.R,3);",'signatures'],
  ['Everything Falls 4 m',FXJ,"if(P.efall&&r.ef){ T.fn.impact(A,T,u,t,4,{full:true}); }","if(P.efall&&r.ef){ T.fn.impact(A,T,u,t,2,{full:true}); }",'signatures'],
  ['Coming Down once a fight',FXJ,"if(P.cdn&&!v.cdUsed&&T.fn.riseFull(A,T,u)){ v.cdNow=1; v.cdUsed=1;","if(P.cdn&&T.fn.riseFull(A,T,u)){ v.cdNow=1; v.cdUsed=1;",'signatures'],
  ['Coming Down 25%',FXJ,"if(P.cdn&&v.cdw>0&&A.gap(u,a)<8*E.METER()) cut(0.25);","if(P.cdn&&v.cdw>0&&A.gap(u,a)<8*E.METER()) cut(0.20);",'signatures'],
  ['the 40% group floor',FXJ,"const DR_FLOOR=0.60, ALLY_FLOOR=0.70,","const DR_FLOOR=0.40, ALLY_FLOOR=0.70,",'one product'],
  ['the 30% ally floor',FXJ,"return Math.max(ALLY_FLOOR,k); },\n    allyIn(","return Math.max(0.50,k); },\n    allyIn(",'one product'],
  ['a countdown, not a fight time',FXJ,"if(v.unr>0) v.unr=Math.max(0,v.unr-dt);","if(v.unr>0) v.unr=Math.max(0,v.unr-dt*2);",'countdowns'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-logs']);
const TMP=(()=>{ const t=os.tmpdir(), r=path.relative(root,t); return (!r.startsWith('..')&&!path.isAbsolute(r))?path.dirname(root):t; })();   // the test host keeps its temp folder inside the checkout: copy beside it instead
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); const top=r.split(path.sep)[0]; return !r||!(SKIP.has(top)||top.startsWith('.remote-')||top.startsWith('.ctl-')); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))){ try{ fs.symlinkSync(path.join(root,k),path.join(dir,k),process.platform==='win32'?'junction':undefined); }
    catch(e){ fs.cpSync(path.join(root,k),path.join(dir,k),{recursive:true}); } } }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-vuc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-vulmar.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/(?:#|ℹ) fail (\d+)/.exec(out), pm=/(?:#|ℹ) pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||1), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
