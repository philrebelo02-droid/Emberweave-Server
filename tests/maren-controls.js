'use strict';
/* The controls for Maren's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-maren.test.js). Each control copies this checkout to a temp folder (os.tmpdir(): the runner's slot folder on disk), breaks ONE thing there (an
   exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, the engine's disarm
   or a row of his broken), runs the named tests of tests/talents-mech-maren.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child
   processes); each copy is deleted when its run is done. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was
   not caught. A pattern as the first argument runs only the controls whose name matches it. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', DRAW='brnd();';
const TSN="push=(u._tal&&u._tal.on.num)?TalentFx.num(u,'tsPush',o.push||1.6*METER):(o.push||1.6*METER);";
const TSAT="      if(u._tal&&u._tal.on.at) TalentFx.at(u,type,u,o,apB*(o.mul||1.1)*rm);";
const TSP=" if(u._tal&&u._tal.on.pass) TalentFx.pass(u,e,'tsPush'); } });";
const MSAT="_ctrs.forEach(ctr=>{ if(u._tal&&u._tal.on.at) TalentFx.at(u,type,ctr,o,apB*(o.mul||0.7)*rm);";
const TPAT="      if(u._tal&&u._tal.on.at) TalentFx.at(u,'ashfall',groundHazards[groundHazards.length-1],o,_sD*(o.dps||0.5)*sm);";   // Korvux's site (the patch just made): Maren's rows use it too
const DRS="((u._tal&&u._tal.on.num)?TalentFx.num(u,'drsv',";
const DIS=" && !(u._talDisarmT>0) && d<=(u.melee?";
const DCD=" if(u._talDisarmT>0)u._talDisarmT-=dt;";
const HZ="TalentFx.bindMore({ hazards:()=>groundHazards });";
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['Tsunami push-length hook removed',HTML,TSN,"push=(false)?TalentFx.num(u,'tsPush',o.push||1.6*METER):(o.push||1.6*METER);",'Long Push'],
  ['Tsunami centre hook removed',HTML,TSAT,'','on his allies'],
  ['Tsunami shove hook removed',HTML,TSP,' } });','Fouled:|Keel and Hull Wake'],
  ['Maelstrom centre hook removed',HTML,MSAT,'_ctrs.forEach(ctr=>{','Where the Lark|Called Water|Knee Deep'],
  ['Tide Pool landing hook removed',HTML,TPAT,'','Fathoms:|Tide Pool:'],
  ['Deep Reserves hook removed',HTML,DRS,"((false)?TalentFx.num(u,'drsv',",'Ballast'],
  ['swing disarm test removed',HTML,DIS,' && d<=(u.melee?','Numb Fingers'],
  ['disarm countdown removed',HTML,DCD,'','Numb Fingers'],
  ['bound hazards missing',HTML,HZ,"TalentFx.bindMore({ hazardsX:()=>groundHazards });",'Fathoms:|Tide Pool:'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the push length',HTML,TSN,"push=(brnd()>=0&&u._tal&&u._tal.on.num)?TalentFx.num(u,'tsPush',o.push||1.6*METER):(o.push||1.6*METER);",'no talents'],
  ['draw at the wave centre',HTML,TSAT,'      '+DRAW+TSAT.slice(5),'no talents'],
  ['draw at the shove',HTML,TSP,' '+DRAW+TSP,'no talents'],
  ['draw at Maelstrom\'s centre',HTML,MSAT,'_ctrs.forEach(ctr=>{ '+DRAW+MSAT.slice(20),'no talents'],
  ['draw at the pool',HTML,TPAT,'      '+DRAW+TPAT.slice(5),'no talents'],
  ['draw at Deep Reserves',HTML,DRS,"((brnd()>=0&&u._tal&&u._tal.on.num)?TalentFx.num(u,'drsv',",'no talents'],
  ['draw at the swing test',HTML,DIS,' && !(u._talDisarmT>0) && (brnd()>=0) && d<=(u.melee?','no talents'],
  ['draw at the disarm countdown',HTML,DCD,' '+DRAW+DCD,'no talents'],
  // ---- the engine's disarm ----
  ['disarm never written',FXJ,"t._talDisarmT=Math.max(t._talDisarmT||0,d);","",'Numb Fingers'],
  ['disarm skips the target\'s ccIn rows',FXJ,"const d=cc(u,t,'disarm',secs,true); if(!(d>0)) continue;","const d=secs*1.1; if(!(d>0)) continue;",'Numb Fingers'],
  // ---- Six Fathoms ----
  ['Fouled root 0.5 s',FXJ,"sf_1_1:[ {param:'fo.root',add:R(0.4)} ],","sf_1_1:[ {param:'fo.root',add:R(0.5)} ],",'Fouled:'],
  ['tangle every 0 s',FXJ,"E.now()-o.tg[x.uid]<6-1e-9) return false;","E.now()-o.tg[x.uid]<0) return false;",'Fouled:'],
  ['tangle reach 3 m',FXJ,"reach=(2+P0(T,'fo.reach'))*M;","reach=(3+P0(T,'fo.reach'))*M;",'Fouled:'],
  ['stun lock without its 0.5 s',FXJ,"A.setMark(T,u,t,'mrLk',{dur:t.stunned+0.5,longest:true}); const o=S(T)","A.setMark(T,u,t,'mrLk',{dur:t.stunned,longest:true}); const o=S(T)",'Fouled:'],
  ['talent root on a stunned enemy',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'mrLk')) return false; const st=","if(A.markOf(u,t,'mrLk')) return false; const st=",'Where the Lark|chain'],
  ['Maelstrom on a tangle: the run past 4.0 s',FXJ,"Math.min(ROOT_TOP-(now-run0),(c.amt||0)+ext)","Math.min(ROOT_TOP,(c.amt||0)+ext)",'Maelstrom:|chain'],
  ['Tangled Line 0.5 s',FXJ,"sf_3_1:[ {param:'fo.dur',add:R(0.4)} ],","sf_3_1:[ {param:'fo.dur',add:R(0.5)} ],",'Fouled:'],
  ['Fouled Again 0.4 m',FXJ,"sf_8_1:[ {param:'fo.reach',add:R(0.5)} ],","sf_8_1:[ {param:'fo.reach',add:R(0.4)} ],",'Fouled:'],
  ['Snarled 3%',FXJ,"sf_5_1:[ {stat:{move:R(-0.02)}","sf_5_1:[ {stat:{move:R(-0.03)}",'Fouled:'],
  ['Weed Wrapped 4%',FXJ,"sf_12_1:[ {stat:{aspd:R(-0.03)}","sf_12_1:[ {stat:{aspd:R(-0.04)}",'Fouled:'],
  ['Knotted 4%',FXJ,"targetHas:'mrTg'},more:R(0.03)} ],","targetHas:'mrTg'},more:R(0.04)} ],",'Fouled:'],
  ['Fouled Anchor never',FXJ,"if(P0(T,'fo.anchor')) T.fn.foulOn(","if(false) T.fn.foulOn(",'Fouled:'],
  ['Fathom every 0.9 s',FXJ,"while(k.i>=1-1e-9){ k.i-=1;","while(k.i>=0.9-1e-9){ k.i-=0.9;",'Fathoms:'],
  ['Fathoms up to 7',FXJ,"WMAX=6,","WMAX=7,",'Fathoms:'],
  ['Fathom attack slow 0.7%',FXJ,"{stat:{aspd:R(-0.006)},to:{team:'enemy',ust:{mrFa:1}},per:{ust:'mrFa'}}","{stat:{aspd:R(-0.007)},to:{team:'enemy',ust:{mrFa:1}},per:{ust:'mrFa'}}",'Fathoms:'],
  ['Heavy Limbs 0.7%',FXJ,"sf_4_4:[ {stat:{move:R(-0.006)}","sf_4_4:[ {stat:{move:R(-0.007)}",'Fathoms:'],
  ['Deeper Pool 2',FXJ,"sf_2_4:[ {param:'fa.land',add:R(1)} ],","sf_2_4:[ {param:'fa.land',add:R(2)} ],",'Fathoms:'],
  ['Fathoms never lost',FXJ,"while(k.o>=per-1e-9&&fa(A,T,u,x)>0){","while(false){",'Fathoms:'],
  ['Bottom Silt 0.2 s',FXJ,"sf_6_4:[ {param:'fa.silt',add:R(0.3)} ],","sf_6_4:[ {param:'fa.silt',add:R(0.2)} ],",'Fathoms:'],
  ['Sinking Shot never',FXJ,"sinkHit(A,T,u,c){ T.fn.sink(A,T,u,c.tgt,1); },","sinkHit(A,T,u,c){ },",'Fathoms:'],
  ['Back in the Water within 1 s',FXJ,"now-o.left[x.uid]<=4+1e-9","now-o.left[x.uid]<=1+1e-9",'Fathoms:'],
  ['Closing Water 1',FXJ,"sf_11_3:[ {param:'fa.close',add:R(2)} ],","sf_11_3:[ {param:'fa.close',add:R(1)} ],",'Fathoms:'],
  ['Salt Mind every 1 s',FXJ,"A.setMark(T,u,x,'mrSm',{dur:12});","A.setMark(T,u,x,'mrSm',{dur:1});",'Fathoms:'],
  ['Salt Mind: a resisted root not counted',FXJ,"for(const x of mc.hit) if(x.alive&&mc.root.indexOf(x)<0&&!x.stunImmune) T.fn.blocked(A,T,u,x);","",'Fathoms:'],
  ['The Bottom never',FXJ,"if(b) T.fn.sink(A,T,u,b,fa(A,T,u,x)); }","}",'Fathoms:'],
  ['Numb Fingers 1.3 s',FXJ,"{disarm:1.2,on:'target'}","{disarm:1.3,on:'target'}",'Numb Fingers'],
  ['Numb Fingers every 2 s',FXJ,"{dur:Math.max(8,x._talDisarmT+0.5)}","{dur:Math.max(2,x._talDisarmT+0.5)}",'Numb Fingers'],
  ['Cold Ache 2%',FXJ,"sf_5_4:[ {param:'dr.ache',add:R(0.015)} ],","sf_5_4:[ {param:'dr.ache',add:R(0.02)} ],",'Fathoms:'],
  ['Cold Ache at 2 Fathoms',FXJ,"if(s&&P['dr.ache']&&fa(A,T,u,s)>=3) k*=1-P['dr.ache'];\n      if(P['dr.eg']","if(s&&P['dr.ache']&&fa(A,T,u,s)>=2) k*=1-P['dr.ache'];\n      if(P['dr.eg']",'Fathoms:'],
  ['Six Fathoms Down 3%',FXJ,"sf_7_4:[ {on:'out',if:{targetUst:{mrFa:6}},more:R(0.02)} ],","sf_7_4:[ {on:'out',if:{targetUst:{mrFa:6}},more:R(0.03)} ],",'Fathoms:'],
  ['Wide Pool 0.2 m',FXJ,"sf_2_3:[ {on:'kit',skill:TP,opt:{radius:{addM:R(0.1)}}} ],","sf_2_3:[ {on:'kit',skill:TP,opt:{radius:{addM:R(0.2)}}} ],",'Tide Pool:'],
  ['Standing Water 0.4 s',FXJ,"sf_4_3:[ {on:'kit',skill:TP,opt:{dur:{add:R(0.3)}}} ],","sf_4_3:[ {on:'kit',skill:TP,opt:{dur:{add:R(0.4)}}} ],",'Tide Pool:'],
  ['Cold Pool 5%',FXJ,"sf_9_3:[ {on:'kit',skill:TP,opt:{dps:{more:R(0.04)}}} ],","sf_9_3:[ {on:'kit',skill:TP,opt:{dps:{more:R(0.05)}}} ],",'Tide Pool:'],
  ['Deep Pool at 90%',FXJ,"if(cur>0.20){ o.dp[x.uid]={was:x.slowMul,until:q.born+1.5}; x.slowMul=0.20; }","if(cur>0.10){ o.dp[x.uid]={was:x.slowMul,until:q.born+1.5}; x.slowMul=0.10; }",'Tide Pool:'],
  ['Deep Pool for 3 s',FXJ,"until:q.born+1.5}; x.slowMul=0.20;","until:q.born+3}; x.slowMul=0.20;",'Tide Pool:'],
  ['Twin Pools 2.5 m',FXJ,"if(kind==='twin') h.r=2*E.METER();","if(kind==='twin') h.r=2.5*E.METER();",'Tide Pool:'],
  ['Twin Pools on the nearest',FXJ,"if(d>fd){ fd=d; f=x; } } if(!f||!E.castSlot) return;","if(fd<0||d<fd){ fd=d; f=x; } } if(!f||!E.castSlot) return;",'Tide Pool:'],
  ['Knee Deep 2%',FXJ,"sf_n1:[ {param:'dr.kd',add:R(0.01)} ],","sf_n1:[ {param:'dr.kd',add:R(0.02)} ],",'in Tide Pool'],
  ['Knee Deep without Maelstrom\'s circle',FXJ,"(o.inTP[s.uid]||(o.mae&&A.eng().now()<o.mae.until&&","(o.inTP[s.uid]||(false&&",'in Tide Pool'],
  ['Ready Wave 0.6 s',FXJ,"sf_2_2:[ {on:'cd',skill:'blue',add:R(-0.5)} ],","sf_2_2:[ {on:'cd',skill:'blue',add:R(-0.6)} ],",'in Tide Pool'],
  ['Grey Ball 5%',FXJ,"sf_6_3:[ {on:'out',if:{auto:true,fn:'tgtInTP'},more:R(0.04)} ],","sf_6_3:[ {on:'out',if:{auto:true,fn:'tgtInTP'},more:R(0.05)} ],",'in Tide Pool'],
  ['Brackish 5%',FXJ,"sf_8_4:[ {on:'teamHeal',if:{fn:'unitFoeInTP'},less:R(0.04)} ],","sf_8_4:[ {on:'teamHeal',if:{fn:'unitFoeInTP'},less:R(0.05)} ],",'in Tide Pool'],
  ['Leaden Water 2%',FXJ,"fn:'tgtInTP'},more:R(0.015)} ],","fn:'tgtInTP'},more:R(0.02)} ],",'in Tide Pool'],
  ['Tide Clock 2%',FXJ,"sf_9_2:[ {on:'cd',skill:'green',less:R(0.01)},{on:'cd',skill:'blue',less:R(0.01)} ],","sf_9_2:[ {on:'cd',skill:'green',less:R(0.02)},{on:'cd',skill:'blue',less:R(0.01)} ],",'in Tide Pool'],
  ['Long Root 0.2 s',FXJ,"sf_8_2:[ {param:'mae.root',add:R(0.1)} ],","sf_8_2:[ {param:'mae.root',add:R(0.2)} ],",'Maelstrom:'],
  ['Whirl 4%',FXJ,"sf_7_2:[ {on:'out',if:{casting:MS},more:R(0.03)} ],","sf_7_2:[ {on:'out',if:{casting:MS},more:R(0.04)} ],",'Maelstrom:'],
  ['Holding Water 6%',FXJ,"sf_12_3:[ {param:'mae.hold',add:R(0.05)} ],","sf_12_3:[ {param:'mae.hold',add:R(0.06)} ],",'Maelstrom:'],
  ['Ebb Energy 2',FXJ,"sf_10_2:[ {on:'ccHit',if:{cc:['stunned']},do:[{energy:R(1),on:'self'}]} ],","sf_10_2:[ {on:'ccHit',if:{cc:['stunned']},do:[{energy:R(2),on:'self'}]} ],",'Maelstrom:'],
  ['deep sea 5 s after the root',FXJ,"until:now+rootLen+6,","until:now+rootLen+5,",'Where the Lark'],
  ['deep sea a Fathom every 0.6 s',FXJ,"while(k.d>=0.5-1e-9){ k.d-=0.5;","while(k.d>=0.6-1e-9){ k.d-=0.6;",'Where the Lark'],
  ['deep sea root 1.6 s',FXJ,"troot(A,T,u,x,1.5)) z.rr[x.uid]=1;","troot(A,T,u,x,1.6)) z.rr[x.uid]=1;",'Where the Lark'],
  ['deep sea root every time',FXJ,"if(z&&!z.rr[x.uid]&&troot(","if(z&&troot(",'Where the Lark'],
  // ---- The Old Hull ----
  ['Bracing 0.4%',FXJ,"oh_1_1:[ {param:'dr.br',add:R(0.003)} ],","oh_1_1:[ {param:'dr.br',add:R(0.004)} ],",'Bracing:'],
  ['Bracing up to 11',FXJ,"mrBr:{max:10,","mrBr:{max:11,",'Bracing:'],
  ['Bracing 6 s',FXJ,"dur:P('br.dur',5)}","dur:P('br.dur',6)}",'Bracing:'],
  ['Iron Ribs 0.4%',FXJ,"oh_6_1:[ {stat:{mr:R(0.003)},per:'mrBr'} ],","oh_6_1:[ {stat:{mr:R(0.004)},per:'mrBr'} ],",'Bracing:'],
  ['Groan drops to 6',FXJ,"A.stSet(T,u,'mrBr',5); },","A.stSet(T,u,'mrBr',6); },",'Bracing:'],
  ['Groan pushes 2 m',FXJ,"[{push:{team:'enemy',within:3},m:1.5,secs:0.3}]","[{push:{team:'enemy',within:3},m:2,secs:0.3}]",'Bracing:'],
  ['Swell 7%',FXJ,"stackMin:{mrBr:5}},more:R(0.06)} ],","stackMin:{mrBr:5}},more:R(0.07)} ],",'Bracing:'],
  ['Hull Song 0.5%',FXJ,"oh_8_1:[ {param:'rg.song',add:R(0.004)} ],","oh_8_1:[ {param:'rg.song',add:R(0.005)} ],",'Bracing:'],
  ['Anchor Down at 4',FXJ,"oh_5_2:[ {on:'tick',if:{stackMin:{mrBr:5}}","oh_5_2:[ {on:'tick',if:{stackMin:{mrBr:4}}",'Bracing:'],
  ['Last to Sink every time',FXJ,"oh_9_1:[ {on:'lethal',once:'fight',","oh_9_1:[ {on:'lethal',",'Last to Sink'],
  ['Drawn Down 3',FXJ,"do:[{stack:'mrBr',add:R(2)}]} ],","do:[{stack:'mrBr',add:R(3)}]} ],",'Maelstrom:'],
  ['Ballast 5%',FXJ,"oh_1_4:[ {param:'bal.max',add:R(0.04)} ],","oh_1_4:[ {param:'bal.max',add:R(0.05)} ],",'Ballast'],
  ['Full Ballast 3%',FXJ,"oh_8_4:[ {param:'bal.max',add:R(0.02)} ],","oh_8_4:[ {param:'bal.max',add:R(0.03)} ],",'Ballast'],
  ['Tidal Ballast 20%',FXJ,"oh_n1:[ {param:'bal.tidal',add:0.10} ],","oh_n1:[ {param:'bal.tidal',add:0.20} ],",'Ballast'],
  ['Caulked 2%',FXJ,"oh_4_4:[ {param:'dr.cau',add:R(0.015)} ],","oh_4_4:[ {param:'dr.cau',add:R(0.02)} ],",'Ballast'],
  ['Ballast Burst 30%',FXJ,"oh_6_4:[ {param:'bal.burst',add:R(0.20)} ],","oh_6_4:[ {param:'bal.burst',add:R(0.30)} ],",'Ballast'],
  ['Ballast Burst within 12 m',FXJ,"for(const x of A.pick(T,u,{team:'enemy',within:3},c)) A.hurt(T,u,x,k*ap(u),","for(const x of A.pick(T,u,{team:'enemy',within:12},c)) A.hurt(T,u,x,k*ap(u),",'Ballast'],
  ['Ballast Kept 20%',FXJ,"oh_10_4:[ {param:'bal.keep',add:R(0.10)} ],","oh_10_4:[ {param:'bal.keep',add:R(0.20)} ],",'Ballast'],
  ['Shared Ballast never',FXJ,"if(rest>0&&P0(T,'bal.share')){","if(false){",'Ballast'],
  ['Shared Ballast without its size',FXJ,"g=Math.min(rest,Math.max(0,mx-have));","g=Math.min(rest,Math.max(0,2*mx-have));",'Ballast'],
  ['Steady Bilge 0.2%',FXJ,"oh_2_4:[ {param:'rg.bilge',add:R(0.001)} ],","oh_2_4:[ {param:'rg.bilge',add:R(0.002)} ],",'Ballast'],
  ['Bilge Pump 0.3',FXJ,"oh_5_4:[ {param:'en.bilge',add:R(0.2)} ],","oh_5_4:[ {param:'en.bilge',add:R(0.3)} ],",'Ballast'],
  ['Shared Reserves 0.2',FXJ,"gb_9_4:[ {param:'en.share',add:R(0.1)} ],","gb_9_4:[ {param:'en.share',add:R(0.2)} ],",'Ballast'],
  ['Shouldered Wave 2%',FXJ,"{heal:{pct:R0(T,'oh_2_3',0.01),of:'maxHp'},on:'self'}","{heal:{pct:R0(T,'oh_2_3',0.02),of:'maxHp'},on:'self'}",'Tsunami:'],
  ['Shouldered Wave 4 enemies',FXJ,"if((o.tsN||0)>=3) return;","if((o.tsN||0)>=4) return;",'Tsunami:'],
  ['Long Shoulder 0.3 m',FXJ,"oh_5_3:[ {on:'num',skill:'tsPush',addM:R(0.2)} ],","oh_5_3:[ {on:'num',skill:'tsPush',addM:R(0.3)} ],",'Tsunami:'],
  ['Long Push 0.3 m',FXJ,"sf_4_2:[ {on:'num',skill:'tsPush',addM:R(0.2)} ],","sf_4_2:[ {on:'num',skill:'tsPush',addM:R(0.3)} ],",'Tsunami:'],
  ['Pushback 4%',FXJ,"{casting:TS,cc:['slow']},do:[{slowMore:R(0.03),on:'target'}]} ],","{casting:TS,cc:['slow']},do:[{slowMore:R(0.04),on:'target'}]} ],",'Tsunami:'],
  ['Breakwater 4 s',FXJ,"oh_5_1:[ {on:'cast',skill:TS,do:[{window:'mrBw',dur:3}]}","oh_5_1:[ {on:'cast',skill:TS,do:[{window:'mrBw',dur:4}]}",'Tsunami:'],
  ['Breakwater: in front, not behind',FXJ,"return Math.hypot(x.x-cx,x.y-cy)>Math.hypot(u.x-cx,u.y-cy); },","return Math.hypot(x.x-cx,x.y-cy)<Math.hypot(u.x-cx,u.y-cy); },",'Tsunami:'],
  ['Keel 3%',FXJ,"oh_3_2:[ {param:'dr.keel',add:R(0.02)} ],","oh_3_2:[ {param:'dr.keel',add:R(0.03)} ],",'Last to Sink'],
  ['Keel 5 s',FXJ,"{on:'pass',skill:'tsPush',do:[{mark:'mrPs',on:'target',dur:4}]}","{on:'pass',skill:'tsPush',do:[{mark:'mrPs',on:'target',dur:5}]}",'Last to Sink'],
  ['Hull Wake 5%',FXJ,"oh_4_3:[ {param:'dr.hw',add:R(0.04)} ],","oh_4_3:[ {param:'dr.hw',add:R(0.05)} ],",'Last to Sink'],
  ['Hull Wake 4 s',FXJ,"{on:'pass',skill:'tsPush',do:[{mark:'mrHw',on:'target',dur:3}]}","{on:'pass',skill:'tsPush',do:[{mark:'mrHw',on:'target',dur:4}]}",'Last to Sink'],
  ['Riding Low 2% less',FXJ,"{param:'dr.rl',add:R(0.015)}","{param:'dr.rl',add:R(0.02)}",'Last to Sink'],
  ['Barnacle Hide 2%',FXJ,"oh_11_3:[ {param:'dr.bh',add:R(0.015)} ],","oh_11_3:[ {param:'dr.bh',add:R(0.02)} ],",'Last to Sink'],
  ['Briny Will 5%',FXJ,"oh_3_4:[ {on:'ccIn',less:R(0.04)} ],","oh_3_4:[ {on:'ccIn',less:R(0.05)} ],",'Last to Sink'],
  ['Unhurried Tide 2%',FXJ,"oh_11_1:[ {on:'cd',skill:'green',less:R(0.01)}","oh_11_1:[ {on:'cd',skill:'green',less:R(0.02)}",'Last to Sink'],
  ['Long Breath 2%',FXJ,"gb_10_4:[ {on:'cd',skill:'green',less:R(0.01)}","gb_10_4:[ {on:'cd',skill:'green',less:R(0.02)}",'Last to Sink'],
  ['Old Timber 2%',FXJ,"oh_12_1:[ {on:'wave',do:[{heal:{pct:R(0.015),","oh_12_1:[ {on:'wave',do:[{heal:{pct:R(0.02),",'Last to Sink'],
  ['Stand Fast 20%',FXJ,"oh_4_2:[ {param:'sf.k',add:R(0.15)} ],","oh_4_2:[ {param:'sf.k',add:R(0.20)} ],",'Stand Fast'],
  ['Stand Fast: no shove taken back',FXJ,"if(Math.hypot(dx,dy)>=0.5*M){ u.x-=dx*k; u.y-=dy*k;","if(false){ u.x-=dx*k; u.y-=dy*k;",'Stand Fast'],
  ['Home Water at 2 enemies',FXJ,"if:{atLeast:{n:3,of:{team:'enemy',within:4}}}","if:{atLeast:{n:2,of:{team:'enemy',within:4}}}",'Home Water'],
  ['Taking Water 0.6%',FXJ,"oh_6_3:[ {param:'rg.take',add:R(0.005)} ],","oh_6_3:[ {param:'rg.take',add:R(0.006)} ],",'Home Water'],
  ['Weathered Hull 3%',FXJ,"oh_12_2:[ {param:'dr.wh',add:R(0.02)} ],","oh_12_2:[ {param:'dr.wh',add:R(0.03)} ],",'Maelstrom:'],
  ['Weathered Hull 5 s',FXJ,"A.setMark(T,u,t,'mrWh',{dur:4});","A.setMark(T,u,t,'mrWh',{dur:5});",'Maelstrom:'],
  ['Taking the Sea 2%',FXJ,"oh_9_2:[ {param:'mae.sea',add:R(0.01)} ],","oh_9_2:[ {param:'mae.sea',add:R(0.02)} ],",'Maelstrom:'],
  ['The Hull Holds 7 s',FXJ,"do:[{window:'mrHull',dur:6}]},","do:[{window:'mrHull',dur:7}]},",'Hull Holds'],
  ['The Hull Holds push 2 m',FXJ,"do:[{push:'source',m:1.5,secs:0.3},{slow:0.30,dur:1,on:'source'}]","do:[{push:'source',m:2,secs:0.3},{slow:0.30,dur:1,on:'source'}]",'Hull Holds'],
  ['The Hull Holds slow 40%',FXJ,"{push:'source',m:1.5,secs:0.3},{slow:0.30,dur:1,on:'source'}","{push:'source',m:1.5,secs:0.3},{slow:0.40,dur:1,on:'source'}",'Hull Holds'],
  ['The Hull Holds heal nothing more',FXJ,"if(T.r.oh_13_2&&A.winOn(T,'mrHull')) d+=0.03; }","if(T.r.oh_13_2&&A.winOn(T,'mrHull')) d+=0; }",'Hull Holds'],
  // ---- What the Sea Gives Back ----
  ['Returns 2%',FXJ,"gb_1_1:[ {param:'ret.k',add:R(0.01)} ],","gb_1_1:[ {param:'ret.k',add:R(0.02)} ],",'Returns:'],
  ['Unhurried Return 3',FXJ,"gb_2_1:[ {param:'ret.nrg',add:R(2)} ],","gb_2_1:[ {param:'ret.nrg',add:R(3)} ],",'Returns:'],
  ['Generous Sea 20%',FXJ,"gb_4_1:[ {param:'ret.gen',add:R(0.15)} ],","gb_4_1:[ {param:'ret.gen',add:R(0.20)} ],",'Returns:'],
  ['Washed Ashore 2',FXJ,"gb_6_1:[ {param:'ret.me',add:R(1)} ],","gb_6_1:[ {param:'ret.me',add:R(2)} ],",'Returns:'],
  ['Late Return 0.3 s',FXJ,"gb_9_1:[ {param:'ret.late',add:R(0.4)} ],","gb_9_1:[ {param:'ret.late',add:R(0.3)} ],",'Returns:'],
  ['wet for 3 s',FXJ,"o.wl[c.tgt.uid]=Math.max(o.wl[c.tgt.uid]||0,now+2); },","o.wl[c.tgt.uid]=Math.max(o.wl[c.tgt.uid]||0,now+3); },",'Returns:'],
  ['Kelp Wrap 4%',FXJ,"gb_12_1:[ {param:'ret.kelp',add:R(0.03)} ],","gb_12_1:[ {param:'ret.kelp',add:R(0.04)} ],",'Returns:'],
  ['Ebb and Flow 0.2%',FXJ,"gb_1_3:[ {param:'ef.k',add:R(0.001)},","gb_1_3:[ {param:'ef.k',add:R(0.002)},",'Ebb and Flow'],
  ['Low Water energy 3%',FXJ,"{param:'ef.e',add:R(0.02)} ],","{param:'ef.e',add:R(0.03)} ],",'Ebb and Flow'],
  ['High Water 9 s',FXJ,"n.w={ph:'H',t:0,len:8+P0(T,'ef.spring')};","n.w={ph:'H',t:0,len:9+P0(T,'ef.spring')};",'Ebb and Flow'],
  ['Low Water 9 s',FXJ,"w.len=len!=null?len:(to==='H'?8+P0(T,'ef.spring'):8);","w.len=len!=null?len:(to==='H'?8+P0(T,'ef.spring'):9);",'Ebb and Flow'],
  ['Spring Water 2 s',FXJ,"gb_2_3:[ {param:'ef.spring',add:R(1)} ],","gb_2_3:[ {param:'ef.spring',add:R(2)} ],",'Ebb and Flow'],
  ['Full Moon Water 4%',FXJ,"gb_10_3:[ {param:'ef.moon',add:R(0.03)} ],","gb_10_3:[ {param:'ef.moon',add:R(0.04)} ],",'Ebb and Flow'],
  ['Slack Water 4%',FXJ,"gb_6_3:[ {param:'ef.slack',add:R(0.03)} ],","gb_6_3:[ {param:'ef.slack',add:R(0.04)} ],",'Ebb and Flow'],
  ['Rising Water 0.1 m',FXJ,"gb_7_3:[ {param:'ef.reach',add:R(0.5)} ],","gb_7_3:[ {param:'ef.reach',add:R(0.1)} ],",'Ebb and Flow'],
  ['Salt Sense 3%',FXJ,"{stat:{apow:R(0.02)},if:{window:'mrSs'}}","{stat:{apow:R(0.03)},if:{window:'mrSs'}}",'water turns'],
  ['Salt Sense 4 s',FXJ,"gb_1_4:[ {on:'mrTurn',do:[{window:'mrSs',dur:3}]},","gb_1_4:[ {on:'mrTurn',do:[{window:'mrSs',dur:4}]},",'water turns'],
  ['Turn of the Water 7%',FXJ,"do:[{heal:{pct:0.06,of:'tgtMaxHp'},on:'lowestAlly'}]} ],","do:[{heal:{pct:0.07,of:'tgtMaxHp'},on:'lowestAlly'}]} ],",'water turns'],
  ['Turning Point 0.4 s',FXJ,"gb_8_3:[ {on:'mrTurn',do:[{cd:'green',add:R(-0.3)},","gb_8_3:[ {on:'mrTurn',do:[{cd:'green',add:R(-0.4)},",'water turns'],
  ['High Water Bite 3%',FXJ,"gb_5_3:[ {on:'out',if:{fn:'abilHigh'},more:R(0.02)} ],","gb_5_3:[ {on:'out',if:{fn:'abilHigh'},more:R(0.03)} ],",'water turns'],
  ['Ebb Guard 3%',FXJ,"gb_n1:[ {param:'dr.eg',add:R(0.02)} ],","gb_n1:[ {param:'dr.eg',add:R(0.03)} ],",'water turns'],
  ['King Water 3%',FXJ,"gb_11_3:[ {param:'dr.kw',add:R(0.02)} ],","gb_11_3:[ {param:'dr.kw',add:R(0.03)} ],",'water turns'],
  ['Called Water 2 s',FXJ,"gb_12_2:[ {param:'ef.called',add:R(1)} ],","gb_12_2:[ {param:'ef.called',add:R(2)} ],",'water turns'],
  ['Gentle Maelstrom 2%',FXJ,"gb_11_2:[ {param:'mae.gentle',add:R(0.01)} ],","gb_11_2:[ {param:'mae.gentle',add:R(0.02)} ],",'water turns'],
  ['Tidal link 6 energy',FXJ,"if(b){ b.energy=Math.min(100,(b.energy||0)+5);","if(b){ b.energy=Math.min(100,(b.energy||0)+6);",'link'],
  ['Healing Pool 0.4%',FXJ,"gb_3_2:[ {param:'tp.heal',add:R(0.003)} ],","gb_3_2:[ {param:'tp.heal',add:R(0.004)} ],",'Tide Pool heals'],
  ['Still Pool 6%',FXJ,"gb_8_2:[ {param:'tp.still',add:R(0.05)} ],","gb_8_2:[ {param:'tp.still',add:R(0.06)} ],",'Tide Pool heals'],
  ['Calm Water 3%',FXJ,"gb_4_2:[ {param:'dr.cw',add:R(0.02)} ],","gb_4_2:[ {param:'dr.cw',add:R(0.03)} ],",'Tide Pool heals'],
  ['Clear Pool 4%',FXJ,"gb_7_2:[ {stat:{ctrl:R(0.03)},","gb_7_2:[ {stat:{ctrl:R(0.04)},",'Tide Pool heals'],
  ['Hold Fast 2%',FXJ,"gb_12_4:[ {stat:{armor:R(0.01)},","gb_12_4:[ {stat:{armor:R(0.02)},",'Tide Pool heals'],
  ['Shallows never moves the pool',FXJ,"c.tgt=l; S(T).shNext=true; },","S(T).shNext=true; },",'Tide Pool heals'],
  ['Shallows heals at the usual rate',FXJ,"r+=tpK*(q.sh?2:1);","r+=tpK*(q.sh?1:1);",'Tide Pool heals'],
  ['Shallows with two enemies close',FXJ,"if(Math.hypot(x.x-t.x,x.y-t.y)<=r) n++; return n<=1; },","if(Math.hypot(x.x-t.x,x.y-t.y)<=r) n++; return n<=2; },",'Tide Pool heals'],
  ['Ready Pool 0.5 s',FXJ,"gb_4_4:[ {on:'cd',skill:'green',add:R(-0.4)} ],","gb_4_4:[ {on:'cd',skill:'green',add:R(-0.5)} ],",'Tide Pool:'],
  ['Rip Current 2 m',FXJ,"[{pull:'target',to:'pt',m:1,secs:0.3}]","[{pull:'target',to:'pt',m:2,secs:0.3}]",'Rip Current'],
  ['Rip Current every time',FXJ,"(q.rip||(q.rip={}))[x.uid]=1; A.acts(","A.acts(",'Rip Current'],
  ['Sanctuary Pool 11%',FXJ,"[{heal:{pct:0.10,of:'tgtMaxHp'},on:'target'}],{u,tgt:x}); },","[{heal:{pct:0.11,of:'tgtMaxHp'},on:'target'}],{u,tgt:x}); },",'Rip Current'],
  ['Sanctuary Pool twice a wave',FXJ,"if(!x||!x.alive||o.sanW===T.s.wave||!E.castSlot) return;","if(!x||!x.alive||!E.castSlot) return;",'Rip Current'],
  ['Sanctuary Pool below 45%',FXJ,"edge:true,if:{targetHpBelow:0.30},do:[{fn:'sanct'}]}","edge:true,if:{targetHpBelow:0.45},do:[{fn:'sanct'}]}",'Rip Current'],
  ['Gentle Wave 11%',FXJ,"gb_6_4:[ {param:'ts.gentle',add:R(0.10)} ],","gb_6_4:[ {param:'ts.gentle',add:R(0.11)} ],",'on his allies'],
  ['Carrying Wave 2 m',FXJ,"[{pull:'target',to:'self',m:1,secs:0.3}]","[{pull:'target',to:'self',m:2,secs:0.3}]",'on his allies'],
  ['Carrying Wave frees nothing',FXJ,"if((x.slow||0)>0) x.slow=0; else if((x.stunned||0)>0) x.stunned=0; } },","} },",'on his allies'],
  ['Cold Kindness 4%',FXJ,"gb_10_1:[ {param:'dr.ck',add:R(0.03)} ],","gb_10_1:[ {param:'dr.ck',add:R(0.04)} ],",'capped'],
  ['Cold Kindness at 60%',FXJ,"alliesOf(A,u).some(x=>x.hp<0.5*x.maxHp)","alliesOf(A,u).some(x=>x.hp<0.7*x.maxHp)",'capped'],
  ['Twenty-Nine 5% a root',FXJ,"const k=Math.min(0.20,0.04*roots);","const k=Math.min(0.20,0.05*roots);",'Twenty-Nine'],
  ['Twenty-Nine up to 25%',FXJ,"const k=Math.min(0.20,0.04*roots);","const k=Math.min(0.25,0.04*roots);",'Twenty-Nine'],
  ['Twenty-Nine: Returns once',FXJ,"const n=(T.r.gb_13_2&&A.winOn(T,'mrTnr'))?2:1;","const n=1;",'Twenty-Nine'],
  // ---- the caps ----
  ['his group 45%',FXJ,"WMAX=6, DR_CAP=0.40,","WMAX=6, DR_CAP=0.45,",'capped'],
  ['his allies\' group 35%',FXJ,"ADR_CAP=0.30,","ADR_CAP=0.35,",'capped'],
  ['regeneration 1.3%',FXJ,"ADR_CAP=0.30, REGEN_CAP=0.012,","ADR_CAP=0.30, REGEN_CAP=0.013,",'capped'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
/* a recursive copy of the checkout (fs.cpSync refuses a destination inside its source, and the runner's temp folder may be under the slot) */
function copyTree(src,dst,top){ fs.mkdirSync(dst,{recursive:true}); for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(top&&(SKIP.has(e.name)||e.name.startsWith('.ctl-')||e.name.startsWith('.tmp'))) continue; const s=path.join(src,e.name), d=path.join(dst,e.name);
    if(e.isDirectory()) copyTree(s,d,false); else if(e.isFile()) fs.copyFileSync(s,d); } }
function copyTo(dir){ copyTree(root,dir,true); for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-mrc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n')));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-maren.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
