'use strict';
/* The controls for Tolley's talent tests (run on the cluster through tools/remote_test.sh as a plain node script, TOGETHER with
   tests/talents-mech-tolley.test.js: the runner sends the pre-talent page only for SHAs named in the files of the run). Each control copies this checkout
   to a folder under os.tmpdir() (which follows TMPDIR: on the cluster a folder beside the slot, wiped after the run), breaks ONE thing there (an exact text
   swap in emberweave-heroes.html or in the generated talents-fx.js: an unguarded seeded draw where his rows are reached, a row, a number, a cap or a function of
   his), runs the named tests of tests/talents-mech-tolley.test.js in that copy, and expects them to FAIL. One copy at a time; each is deleted as soon as it
   has run; .logs, node_modules and the art are not copied (node_modules and assets are linked). The checkout itself is never changed. Prints one line per
   control and a count; exits 1 if any was not caught.  node tests/tolley-controls.js [--list] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page: his talents added no page line; an unguarded seeded draw where his rows are reached makes the no-talent identity test fail ----
  ['unguarded draw: a burning patch tick',HTML,"if(h.slow)e.slow=Math.max(e.slow||0,ccDur(h.slow));","brnd(); if(h.slow)e.slow=Math.max(e.slow||0,ccDur(h.slow));",'no talents'],
  ['unguarded draw: Tempered Steel cut',HTML,"if(u.pass&&u.pass.warden&&u.wardenStk)a*=(1-wardenCut(u));","if(u.pass&&u.pass.warden&&u.wardenStk){ brnd(); a*=(1-wardenCut(u)); }",'no talents'],
  // ---- Melt and Pour: Molten ----
  ['Runs Hot 2% -> 3%',FXJ,"mp_1_1:[ {param:'mo.rh',add:R(0.02)} ]","mp_1_1:[ {param:'mo.rh',add:R(0.03)} ]",'Molten:'],
  ['Quick Melt 0.3 -> 0.4 s',FXJ,"mp_2_1:[ {param:'mo.fast',add:R(0.3)} ]","mp_2_1:[ {param:'mo.fast',add:R(0.4)} ]",'Molten:'],
  ['Molten after 2 s -> 2.4 s',FXJ,"r.mf>0||(r.bn&&r.bt>=moltT(T)-1e-9)","r.mf>0||(r.bn&&r.bt>=moltT(T)+0.4-1e-9)",'Molten:'],
  ['Molten from 2 s -> 3 s',FXJ,"const moltT=T=>Math.max(0.5,MOLT_T-(T.P['mo.fast']||0));","const moltT=T=>Math.max(0.5,3-(T.P['mo.fast']||0));",'Molten:'],
  ['a forced Molten holds 3 s',FXJ,"MOLT_HOLD=2,","MOLT_HOLD=3,",'Molten:'],
  ['Spark Shower 1.5% -> 0.5%',FXJ,"mp_9_3:[ {param:'cr.mo',add:R(0.015)} ]","mp_9_3:[ {param:'cr.mo',add:R(0.005)} ]",'Molten:'],
  // ---- Melt and Pour: the Crucible ----
  ['Bellows 15% -> 20%',FXJ,"mp_2_4:[ {param:'cru.bel',add:R(0.15)} ]","mp_2_4:[ {param:'cru.bel',add:R(0.20)} ]",'Crucible:'],
  ['a burn tick adds 2',FXJ,"A.stSet(T,u,'tCru',stN(T,'tCru')+1+(P['cru.bel']||0));","A.stSet(T,u,'tCru',stN(T,'tCru')+2+(P['cru.bel']||0));",'Crucible:'],
  ['the pour at 90',FXJ,"if(CRU.some(id=>T.r[id])&&stN(T,'tCru')>=100-1e-9)","if(CRU.some(id=>T.r[id])&&stN(T,'tCru')>=90-1e-9)",'Crucible:'],
  ['Crucible pour 15% -> 20%',FXJ,"mp_1_4:[ {param:'pour.k',add:R(0.15)} ]","mp_1_4:[ {param:'pour.k',add:R(0.20)} ]",'Crucible:'],
  ['Hot Grip 2 -> 3',FXJ,"mp_5_4:[ {param:'cru.hh',add:R(2)} ]","mp_5_4:[ {param:'cru.hh',add:R(3)} ]",'Crucible:'],
  ['Hot Start 15 -> 20',FXJ,"mp_12_4:[ {param:'cru.hs',add:R(15)} ]","mp_12_4:[ {param:'cru.hs',add:R(20)} ]",'Crucible:'],
  ['Residual Heat keeps 5',FXJ,"mp_10_4:[ {param:'cru.keep',add:R(4)} ]","mp_10_4:[ {param:'cru.keep',add:R(5)} ]",'Crucible:'],
  ['Ash Mouth 2% -> 3%',FXJ,"mp_6_4:[ {param:'am',add:R(0.02)} ]","mp_6_4:[ {param:'am',add:R(0.03)} ]",'Crucible:'],
  ['Forge Glow 1.5% -> 2%',FXJ,"mp_7_4:[ {stat:{aspd:R(0.015)},if:{fn:'cru50'}} ]","mp_7_4:[ {stat:{aspd:R(0.02)},if:{fn:'cru50'}} ]",'Crucible:'],
  ['Forge Glow below 40',FXJ,"cru50(A,T){ return stN(T,'tCru')>50; }","cru50(A,T){ return stN(T,'tCru')>40; }",'Crucible:'],
  ['Never Cold keeps nothing',FXJ,"const c0=(k&&P['cru.nc'])?k.cru:0;","const c0=k?k.cru:0;",'Crucible:'],
  ['Overpour up to 150 -> 160',FXJ,"mp_9_4:[ {param:'cru.max',add:50},","mp_9_4:[ {param:'cru.max',add:60},",'Crucible:'],
  ['Overpour 0.3% -> 0.4% a point',FXJ,"{param:'op',add:0.003} ]","{param:'op',add:0.004} ]",'Crucible:'],
  ['the pour overflows more',FXJ,"if(P.op) c.amt*=1+P.op*f.pour.over;","if(P.op) c.amt*=1+P.op*(f.pour.over+10);",'Crucible:'],
  // ---- Melt and Pour: Pour Wide / Pour Deep ----
  ['Pour Wide half again wider',FXJ,"mp_5_2:[ {param:'pw',add:1}, {on:'kit',skill:FS,if:{fn:'pouring'},opt:{radius:{mul:1.5}}} ]","mp_5_2:[ {param:'pw',add:1}, {on:'kit',skill:FS,if:{fn:'pouring'},opt:{radius:{mul:2.0}}} ]",'Pour Wide'],
  ['the pour burns 30%',FXJ,"T.fn.burn(A,T,u,t,0.25*h.amt*(1+(P['pw.k']||0))/4,4,'pw');","T.fn.burn(A,T,u,t,0.30*h.amt*(1+(P['pw.k']||0))/4,4,'pw');",'Pour Wide'],
  ['Spill 3% -> 4%',FXJ,"mp_6_2:[ {param:'pw.k',add:R(0.03)} ]","mp_6_2:[ {param:'pw.k',add:R(0.04)} ]",'Pour Wide'],
  ['Pour Deep 40% -> 50%',FXJ,"if(P.pd&&t===f.t) c.amt*=1.40;","if(P.pd&&t===f.t) c.amt*=1.50;",'Pour Wide'],
  ['Single Ingot 4% -> 5%',FXJ,"mp_6_3:[ {param:'si',add:R(0.04)} ]","mp_6_3:[ {param:'si',add:R(0.05)} ]",'Pour Wide'],
  ['Single Ingot 5 s',FXJ,"if(P.si) rec(T,f.t).si=4;","if(P.si) rec(T,f.t).si=5;",'Pour Wide'],
  ['Slag Off burns nobody',FXJ,"if(P.slag&&h.mol){","if(false&&P.slag&&h.mol){",'burns:'],
  ['Slag Off 30% -> 40%',FXJ,"T.fn.burn(A,T,u,x,0.30*h.amt/3,3,'so');","T.fn.burn(A,T,u,x,0.40*h.amt/3,3,'so');",'burns:'],
  // ---- Melt and Pour: burns ----
  ['Glowing Seams 0.2 -> 0.3 s',FXJ,"mp_3_4:[ {on:'kit',skill:CQ,opt:{dur:{add:R(0.2)}}}, {param:'burn.dur',add:R(0.2)} ]","mp_3_4:[ {on:'kit',skill:CQ,opt:{dur:{add:R(0.3)}}}, {param:'burn.dur',add:R(0.3)} ]",'burns:'],
  ['Longer Burn 0.5 -> 0.6 s',FXJ,"mp_4_2:[ {on:'kit',skill:CQ,opt:{dur:{add:R(0.5)}}} ]","mp_4_2:[ {on:'kit',skill:CQ,opt:{dur:{add:R(0.6)}}} ]",'burns:'],
  ['Hotter Chains 3% -> 4%',FXJ,"mp_2_2:[ {on:'kit',skill:CQ,opt:{dps:{more:R(0.03)}}} ]","mp_2_2:[ {on:'kit',skill:CQ,opt:{dps:{more:R(0.04)}}} ]",'burns:'],
  ['Ember Hands 5% -> 6%',FXJ,"mp_12_3:[ {param:'eh',add:R(0.05)} ]","mp_12_3:[ {param:'eh',add:R(0.06)} ]",'burns:'],
  ['Seared Through 3% -> 4%',FXJ,"mp_6_1:[ {param:'sear',add:R(0.03)} ]","mp_6_1:[ {param:'sear',add:R(0.04)} ]",'burns:'],
  ['Seared Through not on Molten',FXJ,"if(P.sear&&molten(T,t)) c.amt*=1+P.sear;","if(P.sear) c.amt*=1+P.sear;",'burns:'],
  ['Kiln Warmth 0.1% -> 0.2%',FXJ,"mp_n1:[ {param:'kw',add:R(0.001)} ]","mp_n1:[ {param:'kw',add:R(0.002)} ]",'burns:'],
  ['Kiln Warmth over 3 m',FXJ,"if(P.kw&&u.alive&&gapM(A,u,t)<3)","if(P.kw&&u.alive&&gapM(A,u,t)<4)",'burns:'],
  ['the heal budget unchecked',FXJ,"x=Math.min(x,o.bud); o.bud-=x;","o.bud-=x;",'burns:'],
  ['the heal budget 1.2% -> 2%',FXJ,"REGEN=0.012, BANK=5, SIG_CD=25,","REGEN=0.020, BANK=5, SIG_CD=25,",'burns:|Workpiece'],
  // ---- Melt and Pour: Chain Quench ----
  ['Quench Again 0.3 -> 0.4 s',FXJ,"mp_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ]","mp_10_3:[ {on:'cd',skill:'blue',add:R(-0.4)} ]",'Chain Quench:'],
  ['Chain Anchor 10% -> 2%',FXJ,"lf_10_3:[ {on:'kit',skill:CQ,opt:{pull:{more:R(0.10)}}} ]","lf_10_3:[ {on:'kit',skill:CQ,opt:{pull:{more:R(0.02)}}} ]",'Chain Quench:'],
  ['Hung in Chains 3% -> 4%',FXJ,"wm_7_4:[ {on:'out',if:{casting:CQ,fn:'tgtNearEx'},more:R(0.03)}, {param:'hic',add:R(0.03)} ]","wm_7_4:[ {on:'out',if:{casting:CQ,fn:'tgtNearEx'},more:R(0.03)}, {param:'hic',add:R(0.04)} ]",'Chain Quench:'],
  ['Hung in Chains on any tick',FXJ,"if(P.hic&&c.tag==='cq'&&T.fn.exK(A,T,t)>0)","if(P.hic&&c.tag==='cq')",'Chain Quench:'],
  ['Chains of Making a step a pull',FXJ,"const got=T.fn.temper(A,T,u,n,false);","const got=T.fn.temper(A,T,u,n+1,false);",'Chain Quench:'],
  ['Pulled to the Anvil 1% -> 2%',FXJ,"wm_9_2:[ {param:'pa',add:R(0.01)} ]","wm_9_2:[ {param:'pa',add:R(0.02)} ]",'Chain Quench:'],
  ["Smith's Patience 0.2 -> 0.3 s",FXJ,"wm_8_1:[ {on:'cd',skill:'green',add:R(-0.2)} ]","wm_8_1:[ {on:'cd',skill:'green',add:R(-0.3)} ]",'Chain Quench:'],
  // ---- Melt and Pour: Living Forge ----
  ['River of Iron 4 to the Crucible',FXJ,"A.stSet(T,u,'tCru',stN(T,'tCru')+5);","A.stSet(T,u,'tCru',stN(T,'tCru')+4);",'Living Forge:'],
  ['River of Iron every tick',FXJ,"if(r.rv>0) r.rv-=1; else { r.rv=1;","if(r.rv>0) r.rv-=1; else { r.rv=0;",'Living Forge:'],
  ['Waves of Metal 3% -> 4%',FXJ,"mp_9_2:[ {param:'lf.k1',add:R(0.03)} ]","mp_9_2:[ {param:'lf.k1',add:R(0.04)} ]",'Living Forge:'],
  ['Molten Walk 3% -> 4%',FXJ,"lf_9_2:[ {param:'lf.k2',add:R(0.03)} ]","lf_9_2:[ {param:'lf.k2',add:R(0.04)} ]",'Living Forge:'],
  ["Walking Foundry 6 s",FXJ,"o.lfT=Math.max(o.lfT,(c.o&&c.o.dur)||5);","o.lfT=Math.max(o.lfT,6);",'Living Forge:'],
  // ---- Melt and Pour: on Molten enemies ----
  ['Liquid Iron 2% -> 3%',FXJ,"mp_4_1:[ {param:'e.li',add:R(0.02)} ]","mp_4_1:[ {param:'e.li',add:R(0.03)} ]",'on Molten enemies:'],
  ['Glowing Iron 2% -> 3%',FXJ,"mp_12_1:[ {param:'e.gi',add:R(0.02)} ]","mp_12_1:[ {param:'e.gi',add:R(0.03)} ]",'on Molten enemies:'],
  ['Furnace Heart within 5 m',FXJ,"if(gapM(A,u,x)<4) mNear++;","if(gapM(A,u,x)<5) mNear++;",'on Molten enemies:'],
  ['Furnace Heart 0.5% -> 0.6%',FXJ,"mp_10_1:[ {param:'a.fh',add:R(0.005)} ]","mp_10_1:[ {param:'a.fh',add:R(0.006)} ]",'on Molten enemies:'],
  ['at most 4 Molten counted',FXJ,"o.mNear=Math.min(5,mNear);","o.mNear=Math.min(4,mNear);",'on Molten enemies:'],
  ['Melt Point 0.5% -> 0.6%',FXJ,"mp_11_2:[ {param:'a.mp',add:R(0.005)} ]","mp_11_2:[ {param:'a.mp',add:R(0.006)} ]",'on Molten enemies:'],
  ['Melt Point 12 a wave',FXJ,"if(P['a.mp']&&moltR(T,recOf(T,x))) o.mp=Math.min(10,o.mp+1);","if(P['a.mp']&&moltR(T,recOf(T,x))) o.mp=Math.min(12,o.mp+1);",'on Molten enemies:'],
  ['Foundry Pace at 2 Molten',FXJ,"if(P['o.fp']&&o.mN>=3)","if(P['o.fp']&&o.mN>=2)",'on Molten enemies:'],
  ['Foundry Pace 2% -> 3%',FXJ,"mp_12_2:[ {param:'o.fp',add:R(0.02)} ]","mp_12_2:[ {param:'o.fp',add:R(0.03)} ]",'on Molten enemies:'],
  // ---- Melt and Pour: Pour the Mold ----
  ['Pour the Mold at 2 Molten',FXJ,"if(mol.length>=3){","if(mol.length>=2){",'Pour the Mold'],
  ['Pour the Mold every pour',FXJ,"if(f.pour&&P.sig1&&o.s1<=0){","if(f.pour&&P.sig1){",'Pour the Mold'],
  ['Pour the Mold 24 s',FXJ,"SIG_CD=25, LOCK=0.5, EX_MAX=8,","SIG_CD=24, LOCK=0.5, EX_MAX=8,",'Pour the Mold'],
  ["Pour the Mold's burn 7 s",FXJ,"T.fn.burn(A,T,u,x,b,6,'pm');","T.fn.burn(A,T,u,x,b,7,'pm');",'Pour the Mold'],
  ['Pour the Mold within 5 m',FXJ,"{team:'enemy',within:6},{u})){ T.fn.force(A,T,x); T.fn.burn(A,T,u,x,b,6,'pm');","{team:'enemy',within:5},{u})){ T.fn.force(A,T,x); T.fn.burn(A,T,u,x,b,6,'pm');",'Pour the Mold'],
  // ---- Something Worth Making: the Workpiece ----
  ['Find the Work 1% -> 2%',FXJ,"wm_1_1:[ {param:'w.atk',add:R(0.01)} ]","wm_1_1:[ {param:'w.atk',add:R(0.02)} ]",'Workpiece:'],
  ['a landed Forge Strike tempers',FXJ,"if(f.hits.length) T.fn.temper(A,T,u,1,true);","if(false) T.fn.temper(A,T,u,1,true);",'Workpiece:'],
  ['Second Heat 1% -> 2%',FXJ,"wm_2_1:[ {param:'w.arm',add:R(0.01)} ]","wm_2_1:[ {param:'w.arm',add:R(0.02)} ]",'Workpiece:'],
  ['Keen Temper 0.3% -> 0.4%',FXJ,"wm_6_1:[ {param:'w.cr',add:R(0.003)} ]","wm_6_1:[ {param:'w.cr',add:R(0.004)} ]",'Workpiece:'],
  ['Keen Temper cap 5% -> 10%',FXJ,"WP_CRIT=0.05,","WP_CRIT=0.10,",'Workpiece:'],
  ["Master's Mark 1% -> 2%",FXJ,"wm_6_2:[ {param:'w.mw',add:R(0.01)} ]","wm_6_2:[ {param:'w.mw',add:R(0.02)} ]",'Workpiece:'],
  ['One Fine Thing 10 -> 12',FXJ,"wpMax=T=>T.r.wm_5_2?10:(T.r.wm_5_3?3:5);","wpMax=T=>T.r.wm_5_2?12:(T.r.wm_5_3?3:5);",'Workpiece:'],
  ['Every Hand Tempered 4 steps',FXJ,"o.mh[x.uid]=Math.min(3,(o.mh[x.uid]||0)+1);","o.mh[x.uid]=Math.min(4,(o.mh[x.uid]||0)+1);",'Workpiece:'],
  ['Every Hand Tempered within 5 m',FXJ,"for(const x of A.pick(T,u,{team:'ally',within:4,others:true},{u}))","for(const x of A.pick(T,u,{team:'ally',within:5,others:true},{u}))",'Workpiece:'],
  ['Worth Making 2% -> 3%',FXJ,"wm_11_2:[ {param:'a.wm',add:R(0.02)} ]","wm_11_2:[ {param:'a.wm',add:R(0.03)} ]",'Workpiece:'],
  ["Maker's Pride 0.3% -> 0.1%",FXJ,"wm_12_2:[ {param:'mpr',add:R(0.003)} ]","wm_12_2:[ {param:'mpr',add:R(0.001)} ]",'Workpiece:'],
  ['Finished Edge 3% -> 4%',FXJ,"wm_10_3:[ {param:'w.fe',add:R(0.03)} ]","wm_10_3:[ {param:'w.fe',add:R(0.04)} ]",'Workpiece:'],
  ['Remade re-picks nobody',FXJ,"if(P.rm){ T.fn.pickWp(A,T,u,keep,false); }","if(false){ T.fn.pickWp(A,T,u,keep,false); }",'Workpiece:'],
  ['Quenched True 20% shorter',FXJ,"QT_CUT=0.30,","QT_CUT=0.20,",'Workpiece:'],
  ['Quenched True not as landed',FXJ,"x[f]=Math.max(old,c.amt*(1-QT_CUT));","x[f]=Math.max(c.amt*(1-QT_CUT));",'Workpiece:'],
  ['Proof Mark 2% -> 3%',FXJ,"wm_10_1:[ {param:'o.pm',add:R(0.02)} ]","wm_10_1:[ {param:'o.pm',add:R(0.03)} ]",'Workpiece:'],
  ['Fire in the Work 5% -> 6%',FXJ,"wm_12_1:[ {param:'fw',add:R(0.05)} ]","wm_12_1:[ {param:'fw',add:R(0.06)} ]",'Workpiece:'],
  ['Many Hammers 2% -> 3%',FXJ,"wm_n1:[ {param:'o.mh',add:R(0.02)} ]","wm_n1:[ {param:'o.mh',add:R(0.03)} ]",'Workpiece:'],
  ['Many Hammers 3 s',FXJ,"if(P['o.mh']&&!s._summon) rec(T,t).mh[s.uid]=2;","if(P['o.mh']&&!s._summon) rec(T,t).mh[s.uid]=3;",'Workpiece:'],
  ['Many Hammers one ally enough',FXJ,"if(r&&Object.keys(r.mh).length>=2)","if(r&&Object.keys(r.mh).length>=1)",'Workpiece:'],
  // ---- Something Worth Making: The Finished Piece ----
  ['The Finished Piece 9 s',FXJ,"o.s2=1; o.fpT=8;","o.s2=1; o.fpT=9;",'The Finished Piece'],
  ['The Finished Piece 4 strikes',FXJ,"o.fpT=8; o.fpN=3;","o.fpT=8; o.fpN=4;",'The Finished Piece'],
  ['The Finished Piece every temper',FXJ,"if(!T.P.sig2||o.s2||!wpOn(T)) return;","if(!T.P.sig2||!wpOn(T)) return;",'The Finished Piece'],
  ['The Finished Piece 20% less',FXJ,"if(x===w&&o.fpT>0) cut(0.30);","if(x===w&&o.fpT>0) cut(0.20);",'The Finished Piece'],
  ['The Finished Piece 40% more',FXJ,"if(P['w.mw']) v+=P['w.mw']*Math.max(0,n-5); if(o.fpT>0) v+=0.30;","if(P['w.mw']) v+=P['w.mw']*Math.max(0,n-5); if(o.fpT>0) v+=0.40;",'The Finished Piece'],
  // ---- Something Worth Making: Examples ----
  ['Make an Example 3% -> 4%',FXJ,"wm_1_4:[ {param:'ex.k',add:R(0.03)} ]","wm_1_4:[ {param:'ex.k',add:R(0.04)} ]",'Examples:'],
  ['Lesson Learned 0.5 -> 0.6 s',FXJ,"wm_4_4:[ {param:'ex.dur',add:R(0.5)} ]","wm_4_4:[ {param:'ex.dur',add:R(0.6)} ]",'Examples:'],
  ['an Example 5 s',FXJ,"o.ex.push({x:at.x,y:at.y,t:4+(P['ex.dur']||0),k});","o.ex.push({x:at.x,y:at.y,t:5+(P['ex.dur']||0),k});",'Examples:'],
  ['at most 10 Examples',FXJ,"EX_MAX=8,","EX_MAX=10,",'Examples:'],
  ['Example to All 1 -> 2 m',FXJ,"wm_12_4:[ {param:'ex.r',add:R(1)} ]","wm_12_4:[ {param:'ex.r',add:R(2)} ]",'Examples:'],
  ['an Example centre-measure',FXJ,"Math.hypot(x.x-z.x,x.y-z.y)-br<R&&z.k>k","Math.hypot(x.x-z.x,x.y-z.y)<R&&z.k>k",'Examples:'],
  ['Warning Shown 3% -> 4%',FXJ,"wm_2_4:[ {param:'ex.mv',add:R(0.03)} ]","wm_2_4:[ {param:'ex.mv',add:R(0.04)} ]",'Examples:'],
  ['Cautionary 3% -> 4%',FXJ,"wm_6_4:[ {param:'ex.as',add:R(0.03)} ]","wm_6_4:[ {param:'ex.as',add:R(0.04)} ]",'Examples:'],
  ['Grim Display 0.5% -> 0.6%',FXJ,"wm_10_4:[ {param:'a.gd',add:R(0.005)} ]","wm_10_4:[ {param:'a.gd',add:R(0.006)} ]",'Examples:'],
  ['Grim Display 12 a wave',FXJ,"if(P['a.gd']) v+=P['a.gd']*Math.min(10,o.exN);","if(P['a.gd']) v+=P['a.gd']*Math.min(12,o.exN);",'Examples:'],
  ['Make It Count 30% -> 40%',FXJ,"wm_5_4:[ {param:'mic',add:R(0.3)} ]","wm_5_4:[ {param:'mic',add:R(0.4)} ]",'Examples:'],
  ['Make It Count within 5 m',FXJ,"if(P.mic&&d.by.alive&&gapM(A,u,d.by)<4)","if(P.mic&&d.by.alive&&gapM(A,u,d.by)<5)",'Examples:'],
  ['Spark Eye 1.5% -> 0.5%',FXJ,"wm_9_3:[ {param:'cr.ex',add:R(0.015)} ]","wm_9_3:[ {param:'cr.ex',add:R(0.005)} ]",'Examples:'],
  ['the crit group 5% -> 10%',FXJ,"DR_CAP=0.30, ALLY_CAP=0.35, CRIT_CAP=0.05,","DR_CAP=0.30, ALLY_CAP=0.35, CRIT_CAP=0.10,",'Examples:'],
  ['the crit roll always',FXJ,"if(P['cr.ex']&&T.fn.exK(A,T,t)>0) p+=P['cr.ex'];","if(P['cr.ex']&&T.fn.exK(A,T,t)>0) p+=P['cr.ex']; c.force=true;",'Examples:'],
  // ---- Something Worth Making: Fear of the Forge ----
  ['Fear of the Forge 1.2 s',FXJ,"if(b) T.fn.tfear(A,T,u,b,1);","if(b) T.fn.tfear(A,T,u,b,1.2);",'Fear of the Forge'],
  ['the fear on a stunned enemy',FXJ,"if((t.fearT||0)>0||(t.stunned||0)>0){ o.ts.on++; return false; }","if((t.fearT||0)>0){ o.ts.on++; return false; }",'Fear of the Forge'],
  ['the fear-lock 0.5 -> 0.1 s',FXJ,"SIG_CD=25, LOCK=0.5, EX_MAX=8, MOLT_T=2,","SIG_CD=25, LOCK=0.1, EX_MAX=8, MOLT_T=2,",'Fear of the Forge'],
  // ---- The Furnace That Refused: Hardened ----
  ['Past the Temper 0.3% -> 0.4%',FXJ,"lf_1_1:[ {param:'hd.dr',add:R(0.003)} ]","lf_1_1:[ {param:'hd.dr',add:R(0.004)} ]",'damage reduction, one group'],
  ['Case Hardened 0.3% -> 0.4%',FXJ,"lf_4_1:[ {param:'a.ch',add:R(0.003)} ]","lf_4_1:[ {param:'a.ch',add:R(0.004)} ]",'Hardened:'],
  ['Kiln Skin 0.3% -> 0.4%',FXJ,"lf_6_1:[ {param:'ks',add:R(0.003)} ]","lf_6_1:[ {param:'ks',add:R(0.004)} ]",'Hardened:'],
  ['Still Burning 2% -> 3%',FXJ,"lf_12_2:[ {param:'o.sb',add:R(0.02)} ]","lf_12_2:[ {param:'o.sb',add:R(0.03)} ]",'Hardened:'],
  ['Still Burning at 8 Hardened',FXJ,"if(P['o.sb']&&hdN(T)>=HD_MAX)","if(P['o.sb']&&hdN(T)>=HD_MAX-2)",'Hardened:'],
  ['Refused 3 s',FXJ,"o.refused=1; A.stSet(T,u,'tHd',0); A.acts(T,u,[{undying:2}],c);","o.refused=1; A.stSet(T,u,'tHd',0); A.acts(T,u,[{undying:3}],c);",'Hardened:'],
  ['Refused twice',FXJ,"if(T.P.rf&&!o.refused&&hdN(T)>=HD_MAX){","if(T.P.rf&&hdN(T)>=HD_MAX){",'Hardened:'],
  ['Quick Temper 0.3 -> 0.4 s',FXJ,"lf_2_1:[ {param:'ts.fast',add:R(0.3)} ]","lf_2_1:[ {param:'ts.fast',add:R(0.4)} ]",'Hardened:'],
  ['Hardened every 4 s',FXJ,"HD_EVERY=3,","HD_EVERY=4,",'Hardened:'],
  ['Never Cooled a third',FXJ,"const ws0=k?k.ws:0, tsKeep=Math.max(P.nc?Math.floor(ws0/2+1e-9):0,Math.round(P.bc||0));","const ws0=k?k.ws:0, tsKeep=Math.max(P.nc?Math.floor(ws0/3+1e-9):0,Math.round(P.bc||0));",'Hardened:'],
  ['Never Cooled keeps a third of the Hardened',FXJ,"A.stSet(T,u,'tHd',(P.nc&&k)?Math.floor(k.hd/2+1e-9):0);","A.stSet(T,u,'tHd',(P.nc&&k)?Math.floor(k.hd/3+1e-9):0);",'Hardened:'],
  ['Banked Coals 2 -> 1',FXJ,"lf_12_1:[ {param:'bc',add:R(2)} ]","lf_12_1:[ {param:'bc',add:R(1)} ]",'Hardened:'],
  ['Slow to Cool 2 -> 3 s',FXJ,"lf_4_2:[ {param:'stc',add:R(2)} ]","lf_4_2:[ {param:'stc',add:R(3)} ]",'Hardened:'],
  ['Long Burning 0.5% -> 0.6%',FXJ,"lf_11_2:[ {param:'a.lb',add:R(0.005)} ]","lf_11_2:[ {param:'a.lb',add:R(0.006)} ]",'Drop Weight'],
  // ---- The Furnace That Refused: Open Grate ----
  ['Open Grate 15 -> 20 points',FXJ,"OG_CAP=0.15;","OG_CAP=0.20;",'Open Grate'],
  ['Open Grate raises the cap twice',FXJ,"const c0=st>0?E.wardenCut(u):0, cap1=E.wardenCap(u)+(T.P.og||0),","const c0=st>0?E.wardenCut(u):0, cap1=E.wardenCap(u)+(T.P.og||0)*2,",'Open Grate'],
  ['Walking Foundry does not double',FXJ,"c2=(T.P.wf&&O(T).lfT>0)?Math.min(0.95,2*c1):c1;","c2=(T.P.wf&&O(T).lfT>0)?Math.min(0.95,1*c1):c1;",'Open Grate'],
  ['Walking Foundry does not double Hardened',FXJ,"hdEff=T=>hdN(T)*(O(T).lfT>0&&T.P.wf?2:1);","hdEff=T=>hdN(T)*(O(T).lfT>0&&T.P.wf?1:1);",'Open Grate'],
  ['Grate Thrown Wide 0.2 a point',FXJ,"v+=Math.min(WO_CAP,P['a.wo']*Math.floor(c.c1/0.04+1e-9));","v+=Math.min(WO_CAP,P['a.wo']*Math.floor(c.c1/0.05+1e-9));",'Open Grate'],
  ['Grate Thrown Wide 20% at most',FXJ,"WO_CAP=0.15,","WO_CAP=0.20,",'Open Grate'],
  ['Grate Thrown Wide 1% -> 2%',FXJ,"lf_6_3:[ {param:'a.wo',add:R(0.01)} ]","lf_6_3:[ {param:'a.wo',add:R(0.02)} ]",'Open Grate'],
  // ---- The Furnace That Refused: Housing ----
  ['Outer Housing 3% -> 4%',FXJ,"lf_1_4:[ {param:'hs.k',add:R(0.03)} ]","lf_1_4:[ {param:'hs.k',add:R(0.04)} ]",'Housing:'],
  ['Sealed Seams 1% -> 2%',FXJ,"lf_5_4:[ {param:'hs.k',add:R(0.01)} ]","lf_5_4:[ {param:'hs.k',add:R(0.02)} ]",'Housing:'],
  ['the Housing rebuild 5 s',FXJ,"hsWait(A,T){ return Math.max(1,6-(T.P['hs.fast']||0)); }","hsWait(A,T){ return Math.max(1,5-(T.P['hs.fast']||0)); }",'Housing:'],
  ['Riveted Plates 0.5 -> 0.6 s',FXJ,"lf_2_4:[ {param:'hs.fast',add:R(0.5)} ]","lf_2_4:[ {param:'hs.fast',add:R(0.6)} ]",'Housing:'],
  ['Rebuilt 1% -> 2%',FXJ,"lf_7_4:[ {param:'rb',add:R(0.01)} ]","lf_7_4:[ {param:'rb',add:R(0.02)} ]",'Housing:'],
  ['Tough Rivets 10% -> 20%',FXJ,"lf_6_4:[ {param:'hs.tr',add:R(0.10)} ]","lf_6_4:[ {param:'hs.tr',add:R(0.20)} ]",'Housing:'],
  ['Tough Rivets on any hit',FXJ,"const loss=(o.hk==='abil'&&P['hs.tr'])?take/(1+P['hs.tr']):take;","const loss=P['hs.tr']?take/(1+P['hs.tr']):take;",'Housing:'],
  ['Banked Fire 5 s',FXJ,"T.fn.burn(A,T,u,x,b,4,'bf');","T.fn.burn(A,T,u,x,b,5,'bf');",'Housing:'],
  ['Ember Flare 3% -> 4%',FXJ,"lf_6_2:[ {param:'bf.k',add:R(0.03)} ]","lf_6_2:[ {param:'bf.k',add:R(0.04)} ]",'Housing:'],
  ['Second Housing a third',FXJ,"o.hsAdd=o.hsMax/2;","o.hsAdd=o.hsMax/3;",'Housing:'],
  ['Second Housing every break',FXJ,"if(P.sh2&&!o.hsBr){","if(P.sh2){",'Housing:'],
  ['Heat Inside 2% -> 3%',FXJ,"lf_3_4:[ {param:'o.hi',add:R(0.02)} ]","lf_3_4:[ {param:'o.hi',add:R(0.03)} ]",'Housing:'],
  ['the Housing lets half through',FXJ,"const take=Math.min(o.hs,c.amt||0);","const take=Math.min(o.hs/2,c.amt||0);",'Housing:'],
  // ---- his hits and the rest of the third tree ----
  ['Drop Weight 3% -> 4%',FXJ,"mp_7_1:[ {on:'out',if:{casting:FS},more:R(0.03)} ]","mp_7_1:[ {on:'out',if:{casting:FS},more:R(0.04)} ]",'Drop Weight'],
  ['Heavy Hammer 3% -> 4%',FXJ,"wm_3_2:[ {on:'out',if:{casting:FS},more:R(0.03)} ]","wm_3_2:[ {on:'out',if:{casting:FS},more:R(0.04)} ]",'Drop Weight'],
  ['Hammer Weighted 3% -> 4%',FXJ,"lf_8_3:[ {on:'out',if:{casting:FS},more:R(0.03)} ]","lf_8_3:[ {on:'out',if:{casting:FS},more:R(0.04)} ]",'Drop Weight'],
  ['Anvil Rhythm 2% -> 3%',FXJ,"wm_7_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ]","wm_7_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.03)} ]",'Drop Weight'],
  ['Cinder Fists 2% -> 3%',FXJ,"lf_8_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ]","lf_8_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.03)} ]",'Drop Weight'],
  ['Struck Hot 1% -> 2%',FXJ,"wm_12_3:[ {param:'sh',add:R(0.01)} ]","wm_12_3:[ {param:'sh',add:R(0.02)} ]",'Drop Weight'],
  ['Walking Out 3% -> 4%',FXJ,"lf_4_3:[ {stat:{move:R(0.03)}} ]","lf_4_3:[ {stat:{move:R(0.04)}} ]",'Drop Weight'],
  ['Ore-Bound 4% -> 5%',FXJ,"lf_5_1:[ {on:'ccIn',less:R(0.04)} ]","lf_5_1:[ {on:'ccIn',less:R(0.05)} ]",'Drop Weight'],
  ['Kiln Breath 1% -> 2%',FXJ,"lf_10_1:[ {on:'tick',period:1,do:[{fn:'breath'}]}, {param:'kb',add:R(0.01)} ]","lf_10_1:[ {on:'tick',period:1,do:[{fn:'breath'}]}, {param:'kb',add:R(0.02)} ]",'Drop Weight'],
  ['Kiln Breath within 3 m',FXJ,"for(const t of A.pick(T,u,{team:'enemy',within:2},{u}))","for(const t of A.pick(T,u,{team:'enemy',within:3},{u}))",'Drop Weight'],
  ['Long Burning twice as fast',FXJ,"if(P['a.lb']&&foe){ o.lbT+=dt; if(o.lbT>=10-1e-9){","if(P['a.lb']&&foe){ o.lbT+=dt; if(o.lbT>=5-1e-9){",'Drop Weight'],
  ['Bolted Shut 25% -> 20%',FXJ,"lf_12_3:[ {on:'moved',if:{who:'self'},do:[{fn:'bolted'}]}, {param:'bolt',add:R(0.25)} ]","lf_12_3:[ {on:'moved',if:{who:'self'},do:[{fn:'bolted'}]}, {param:'bolt',add:R(0.20)} ]",'Drop Weight'],
  ['Bolted Shut 40% at most',FXJ,"BOLT_CAP=0.50,","BOLT_CAP=0.40,",'Drop Weight'],
  // ---- the third signature ----
  ['Fire Still In It 6 s',FXJ,"o.s3=1; o.s3T=5;","o.s3=1; o.s3T=6;",'Fire Still In It'],
  ['Fire Still In It undying 6 s',FXJ,"A.acts(T,u,[{undying:5}],{u,tgt:u});","A.acts(T,u,[{undying:6}],{u,tgt:u});",'Fire Still In It'],
  ['Fire Still In It below 40%',FXJ,"else if(!o.s3&&u.alive&&u.hp<0.30*u.maxHp)","else if(!o.s3&&u.alive&&u.hp<0.40*u.maxHp)",'Fire Still In It'],
  ['Fire Still In It 4% a stack',FXJ,"E.healUnit(u,0.03*n*u.maxHp);","E.healUnit(u,0.04*n*u.maxHp);",'Fire Still In It'],
  ['Fire Still In It a stack only in the 5 s',FXJ,"if(T.P.sig3&&o.s3T>0&&c.src&&c.src.team!==u.team) T.fn.hdAdd(A,T,u,1);","if(T.P.sig3&&o.s3T>6&&c.src&&c.src.team!==u.team) T.fn.hdAdd(A,T,u,1);",'Fire Still In It'],
  // ---- his damage reduction: the two capped groups ----
  ['Furnace Lining 1.5% -> 2%',FXJ,"mp_11_4:[ {param:'dr.fl',add:R(0.015)} ]","mp_11_4:[ {param:'dr.fl',add:R(0.02)} ]",'damage reduction, one group'],
  ['Heat Shield 2% -> 3%',FXJ,"mp_4_3:[ {param:'dr.hs',add:R(0.02)} ]","mp_4_3:[ {param:'dr.hs',add:R(0.03)} ]",'damage reduction, one group'],
  ['Heat Shield on any source',FXJ,"if(P['dr.hs']&&src&&burning(u,src)) cut(P['dr.hs']);","if(P['dr.hs']&&src) cut(P['dr.hs']);",'damage reduction, one group'],
  ['Steady Anvil 1% -> 2%',FXJ,"wm_4_1:[ {param:'dr.sa',add:R(0.01)} ]","wm_4_1:[ {param:'dr.sa',add:R(0.02)} ]",'damage reduction, one group'],
  ['Shop Hearth 1.5% -> 2%',FXJ,"wm_5_1:[ {param:'dr.he',add:R(0.015)} ]","wm_5_1:[ {param:'dr.he',add:R(0.02)} ]",'damage reduction, one group'],
  ['Shop Hearth on hits too',FXJ,"if(x===w&&!auto) cut(P['dr.he']);","if(x===w) cut(P['dr.he']);",'damage reduction, one group'],
  ['Workshop Floor 1% -> 2%',FXJ,"wm_6_3:[ {param:'al.wf',add:R(0.01)} ]","wm_6_3:[ {param:'al.wf',add:R(0.02)} ]",'damage reduction, one group'],
  ['Hearth Guard 1.5% -> 2%',FXJ,"lf_12_4:[ {param:'al.hg',add:R(0.015)} ]","lf_12_4:[ {param:'al.hg',add:R(0.02)} ]",'damage reduction, one group'],
  ['Hearth Guard within 4 m',FXJ,"if(P['al.hg']&&u.alive&&gapM(A,u,x)<3)","if(P['al.hg']&&u.alive&&gapM(A,u,x)<4)",'damage reduction, one group'],
  ['Temper of Mind 1.5% -> 2%',FXJ,"wm_8_3:[ {param:'dr.tm',add:R(0.015)} ]","wm_8_3:[ {param:'dr.tm',add:R(0.02)} ]",'damage reduction, one group'],
  ['Foundry Walls 2% -> 3%',FXJ,"wm_11_4:[ {param:'dr.fw',add:R(0.02)} ]","wm_11_4:[ {param:'dr.fw',add:R(0.03)} ]",'damage reduction, one group'],
  ['Foundry Walls above half',FXJ,"if(u.hp<0.5*u.maxHp){ cut(P['dr.fw']); cut(P['dr.is']); }","if(u.hp<0.6*u.maxHp){ cut(P['dr.fw']); cut(P['dr.is']); }",'damage reduction, one group'],
  ['Refractory 1.5% -> 2%',FXJ,"lf_3_3:[ {param:'dr.rf',add:R(0.015)} ]","lf_3_3:[ {param:'dr.rf',add:R(0.02)} ]",'damage reduction, one group'],
  ['Ironside 2% -> 3%',FXJ,"lf_9_3:[ {param:'dr.is',add:R(0.02)} ]","lf_9_3:[ {param:'dr.is',add:R(0.03)} ]",'damage reduction, one group'],
  ['Thick Grate 1.5% -> 2%',FXJ,"lf_11_4:[ {param:'dr.tg',add:R(0.015)} ]","lf_11_4:[ {param:'dr.tg',add:R(0.02)} ]",'damage reduction, one group'],
  ['Layered Housing 1% -> 2%',FXJ,"lf_10_4:[ {param:'dr.pp',add:R(0.01)} ]","lf_10_4:[ {param:'dr.pp',add:R(0.02)} ]",'Housing:'],
  ['Lesson in Iron 2% -> 3%',FXJ,"if(P.li&&o.liT>0) cut(0.02);","if(P.li&&o.liT>0) cut(0.03);",'Examples:'],
  ['his group 30% -> 35%',FXJ,"DR_CAP=0.30, ALLY_CAP=0.35,","DR_CAP=0.35, ALLY_CAP=0.35,",'damage reduction, one group'],
  ["the allies' group 35% -> 40%",FXJ,"ALLY_CAP=0.35,","ALLY_CAP=0.40,",'damage reduction, one group'],
];

const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ const ex=[...SKIP].map(k=>'--exclude=./'+k).join(' ');
  const r=cp.spawnSync('bash',['-c','tar cf - '+ex+' --exclude="./.ctl-*" --exclude="./.remote-*" . | tar xf - -C "'+dir+'"'],{cwd:root,encoding:'utf8',maxBuffer:1<<26});
  if(!fs.existsSync(path.join(dir,HTML))) throw new Error('copy failed: rc '+r.status+' '+String(r.stderr||r.error||'').slice(0,400));
  for(const k of ['node_modules','assets','.bin','.base']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function count(file,from){ const s=fs.readFileSync(path.join(root,file),'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'); return s.split(a).length-1; }
if(process.argv.includes('--list')){ let bad=0; for(const [name,file,from] of C){ const n=count(file,from); if(n!==1){ bad++; console.log('FOUND '+n+'x: '+name); } } console.log(C.length+' controls, '+bad+' not found exactly once'); process.exit(bad?1:0); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ctl-tolley-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), b=to.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>b));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-tolley.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    const why=/error: [^\n]*/.exec(out); return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')+(why?' | '+why[0].slice(0,140):'')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
{ const d=fs.mkdtempSync(path.join(os.tmpdir(),'ctl-tolley-')); try{ copyTo(d); const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern=Tolley /|accounted|real kit','tests/talents-mech-tolley.test.js'],{cwd:d,env:process.env,encoding:'utf8',maxBuffer:1<<26}); const o=(r.stdout||'')+(r.stderr||'');
  console.log('BASELINE (nothing broken, the group tests): '+((/# fail (\d+)/.exec(o)||[])[0])+', '+((/# pass (\d+)/.exec(o)||[])[0])); if(!/# fail 0/.test(o)){ console.log(o.slice(-3000)); process.exit(1); } } finally{ fs.rmSync(d,{recursive:true,force:true}); } }
const only=process.argv.find(a=>a.startsWith('--only='));
const out=[]; for(const c of C){ if(only&&!c[0].includes(only.slice(7))) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }   // one copy at a time
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
