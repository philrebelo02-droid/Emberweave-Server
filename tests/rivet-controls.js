'use strict';
/* The controls for Rivet's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-rivet.test.js in the same run). Each control copies this checkout to a temp folder under os.tmpdir() (never under the checkout:
   .logs, node_modules, assets and the runner's own folders are left out, node_modules and assets are linked), breaks ONE thing there (an exact text swap in
   emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a primitive or a row of his broken),
   runs the named tests of tests/talents-mech-rivet.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child processes); each copy
   is deleted as soon as its run is done. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   node tests/rivet-controls.js [regex: only the controls whose name matches]   |   node tests/rivet-controls.js --check  (each text to break is found exactly once) */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const PICK="return (u._tal&&u._tal.on.num)?TalentFx.num(u,'rvPick',w,t):w; }";
const FIRE="const _rq=(u._tal&&u._tal.on.num)?TalentFx.num(u,'rvFire',0,t):0;";
const CYC="if(_rq&&w==='hook'){ rivetHook(u,t,_rq); return; }";
const PPRE="_autoAtk=1; if(_rq) TalentFx.partPre(u,t,'rv:'+_rq); try{ fn(); }";
const PPOST="if(_rq) TalentFx.part(u,t,'rv:'+_rq); } },extra,rate);";
const CONE="cMin=Math.cos((_rq?TalentFx.num(u,'rvCone',W.canAngle):W.canAngle)/2*Math.PI/180);";
const HREC="if(!_rq&&u._tal&&u._tal.on.num) _rq=TalentFx.num(u,'rvHook',0,e);";
const HPRE="if(_rq) TalentFx.partPre(u,e,'rv:'+_rq); try{";
const HPOST="} finally{ if(_rq) TalentFx.part(u,e,'rv:'+_rq); } },0,rate);";
const RCC="_sec=(u._tal&&u._tal.on.num)?TalentFx.num(u,'rvCC',sec,t):sec;";
const HR="const R=(u._tal&&u._tal.on.num)?TalentFx.num(u,'rvHookR',RIVET_WPN.meleeR):RIVET_WPN.meleeR,";
const BIND="if(typeof TalentFx!=='undefined'&&TalentFx.bindMore) TalentFx.bindMore({ rvFire:";
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['weapon pick hook removed',HTML,PICK,'return w; }','Next Barrel Up|Keep Them Out|Hook in the Cycle'],
  ['attack record removed',HTML,FIRE,'const _rq=0;','the Rack:|Saw Teeth'],
  ['cycle hook line removed',HTML,CYC,'','Hook in the Cycle'],
  ['blow partPre removed',HTML,PPRE,'_autoAtk=1; try{ fn(); }','the Rack:|Keep Them Out'],
  ['blow part removed',HTML,PPOST,'} },extra,rate);','Saw Teeth'],
  ['cannon cone hook removed',HTML,CONE,'cMin=Math.cos(W.canAngle/2*Math.PI/180);','Next Barrel Up'],
  ['hook record removed',HTML,HREC,'','Pinned:'],
  ['hook partPre removed',HTML,HPRE,'try{','his weapons'],
  ['hook part removed',HTML,HPOST,'} finally{ } },0,rate);','Pinned:'],
  ['weapon control length hook removed',HTML,RCC,'_sec=sec;','Hammer Hand'],
  ['hook reach hook removed',HTML,HR,'const R=RIVET_WPN.meleeR,','Pinned:'],
  ['bound rvFire removed',HTML,BIND,'if(false) TalentFx.bindMore({ rvFire:','The Whole Workshop'],
  // ---- an unguarded seeded draw at each page site (the no-talent identity test fails) ----
  ['unguarded draw: weapon pick',HTML,PICK,'brnd(); '+PICK,'no talents'],
  ['unguarded draw: attack record',HTML,FIRE,FIRE+' brnd();','no talents'],
  ['unguarded draw: blow',HTML,PPRE,'_autoAtk=1; brnd(); if(_rq) TalentFx.partPre(u,t,\'rv:\'+_rq); try{ fn(); }','no talents'],
  ['unguarded draw: cannon cone',HTML,CONE,'cMin=(brnd(),Math.cos((_rq?TalentFx.num(u,\'rvCone\',W.canAngle):W.canAngle)/2*Math.PI/180));','no talents'],
  ['unguarded draw: hook record',HTML,HREC,HREC+' brnd();','no talents'],
  ['unguarded draw: hook blow',HTML,HPRE,'brnd(); '+HPRE,'no talents'],
  ['unguarded draw: weapon control',HTML,RCC,"_sec=(brnd(),(u._tal&&u._tal.on.num)?TalentFx.num(u,'rvCC',sec,t):sec);",'no talents'],
  ['unguarded draw: hook reach',HTML,HR,"const R=(brnd(),(u._tal&&u._tal.on.num)?TalentFx.num(u,'rvHookR',RIVET_WPN.meleeR):RIVET_WPN.meleeR),",'no talents'],
  // ---- the Rack ----
  ['Load the Rack 5%',FXJ,"lw_1_1:[ {param:'rack.k',add:R(0.04)} ],","lw_1_1:[ {param:'rack.k',add:R(0.05)} ],",'the Rack:'],
  ['Full Rack at 4',FXJ,"if(ranged||P.anyd){ o.rack++; if(o.rack>=5)","if(ranged||P.anyd){ o.rack++; if(o.rack>=4)",'the Rack:'],
  ['melee does not empty the Rack',FXJ,"} else { o.rack=0; o.frU=false; }","} else { o.frU=false; }",'the Rack:'],
  ['Quick Change 3%',FXJ,"lw_2_1:[ {stat:{aspd:R(0.02)},if:{fn:'filling'}} ],","lw_2_1:[ {stat:{aspd:R(0.03)},if:{fn:'filling'}} ],",'the Rack:'],
  ['Quick Change on an empty rack',FXJ,"return n>0&&n<5;","return n<5;",'the Rack:'],
  ['Spare Ammunition 0.6%',FXJ,"lw_4_1:[ {stat:{aspd:R(0.005)},per:'rvSa'} ],","lw_4_1:[ {stat:{aspd:R(0.006)},per:'rvSa'} ],",'the Rack:'],
  ['Spare Ammunition kept a wave',FXJ,"rvSa:{max:5,wave:'reset'},","rvSa:{max:5},",'the Rack:'],
  ['Eighty Years 0.5%',FXJ,"lw_11_2:[ {stat:{atk:R(0.004)},per:'rvEy'} ],","lw_11_2:[ {stat:{atk:R(0.005)},per:'rvEy'} ],",'the Rack:'],
  ['Re-Rack 0.4 s',FXJ,"lw_10_1:[ {param:'rerack',add:R(0.3)} ],","lw_10_1:[ {param:'rerack',add:R(0.4)} ],",'the Rack:'],
  ['the Rack kept at a wave',FXJ,"if(!P.nc){ o.rack=0; o.full=false; o.frU=false; }","if(!P.nc){ o.full=false; o.frU=false; }",'the Rack:'],
  ['Next Barrel Up breaks the order',FXJ,"if(w!=='cannon'){ u._rvRi=((u._rvRi|0)+4)%5; w='cannon'; }","if(w!=='cannon'){ w='cannon'; }",'Next Barrel Up'],
  ['Next Barrel Up 20 degrees',FXJ,"if(r&&r.nbu) c.amt+=15;","if(r&&r.nbu) c.amt+=20;",'Next Barrel Up'],
  ['Rack Master 3%',FXJ,"lw_12_2:[ {param:'rm.k',add:R(0.02)} ],","lw_12_2:[ {param:'rm.k',add:R(0.03)} ],",'Next Barrel Up'],
  ['Keep Them Out 20%',FXJ,"if(r.pb) k*=1.15*","if(r.pb) k*=1.2*",'Keep Them Out'],
  ['Keep Them Out moves the melee cycle',FXJ,"if(P.kto){ u._rvMi=((u._rvMi|0)+3)%4;","if(P.kto){",'Keep Them Out'],
  ['Muzzle Close 4%',FXJ,"lw_6_2:[ {param:'pb.k',add:R(0.03)} ],","lw_6_2:[ {param:'pb.k',add:R(0.04)} ],",'Keep Them Out'],
  ['Any Distance does not count melee',FXJ,"if(ranged||P.anyd){ o.rack++;","if(ranged){ o.rack++;",'Keep Them Out'],
  // ---- Sighted ----
  ['Sighted by the same weapon',FXJ,"else if(o.lw[t.uid]!==r.w){","else if(true){",'Sighted:'],
  ['Glass Eye 1.5%',FXJ,"lw_1_4:[ {on:'out',if:{targetTeam:'enemy',targetUst:{rvSi:1}},more:R(0.01)","lw_1_4:[ {on:'out',if:{targetTeam:'enemy',targetUst:{rvSi:1}},more:R(0.015)",'Sighted:|Whole Workshop'],
  ['Steady Eye 1.5 s',FXJ,"lw_2_4:[ {param:'si.dur',add:R(1)} ],","lw_2_4:[ {param:'si.dur',add:R(1.5)} ],",'Sighted:'],
  ['Watchful 3%',FXJ,"lw_5_4:[ {stat:{move:R(-0.02)}","lw_5_4:[ {stat:{move:R(-0.03)}",'Sighted:'],
  ['Seen Coming at 2 steps',FXJ,"if(P['dr.seen']&&si(A,T,u,s)>=3)","if(P['dr.seen']&&si(A,T,u,s)>=2)",'Sighted:'],
  ['Read the Order 2%',FXJ,"lw_4_4:[ {param:'crit.ro',add:R(0.015)} ],","lw_4_4:[ {param:'crit.ro',add:R(0.02)} ],",'Sighted:'],
  ['Read the Order at 4',FXJ,"if(P['crit.ro']&&si(A,T,u,t)>=5)","if(P['crit.ro']&&si(A,T,u,t)>=4)",'Sighted:'],
  ['Five of Five lost',FXJ,"lw_9_4:[ {param:'ff',add:1} ],","lw_9_4:[ ],",'Sighted:'],
  ['Five of Five never used up',FXJ,"A.clearMark(u,t,'rvFf'); c.force=true; return;","c.force=true; return;",'Sighted:'],
  ['Marked Glass 0.6%',FXJ,"more:R(0.005),per:{ust:'rvSi'}} ],","more:R(0.006),per:{ust:'rvSi'}} ],",'Sighted:'],
  ['Marked Glass for Rivet too',FXJ,"lw_10_4:[ {on:'teamIn',if:{srcIs:'ally',","lw_10_4:[ {on:'teamIn',if:{srcTeam:'ally',",'Sighted:'],
  // ---- his weapons ----
  ['Oiled Gatling 1.2 points',FXJ,"lw_2_2:[ {param:'gat.pt',add:R(0.01)} ],","lw_2_2:[ {param:'gat.pt',add:R(0.012)} ],",'his weapons'],
  ['Shells in the Chest 4%',FXJ,"lw_8_4:[ {param:'can.k',add:R(0.03)} ],","lw_8_4:[ {param:'can.k',add:R(0.04)} ],",'his weapons'],
  ['Curved Edge 5%',FXJ,"cw_3_2:[ {param:'blade.k',add:R(0.04)} ],","cw_3_2:[ {param:'blade.k',add:R(0.05)} ],",'his weapons'],
  ['Short Leash 25%',FXJ,"cw_4_4:[ {param:'hook.k',add:R(0.20)} ],","cw_4_4:[ {param:'hook.k',add:R(0.25)} ],",'his weapons'],
  ['Ninepin Count 3%',FXJ,"lw_7_1:[ {param:'basic.k',add:R(0.02)} ],","lw_7_1:[ {param:'basic.k',add:R(0.03)} ],",'his weapons'],
  ['Ninepin Count on any record',FXJ,"if(r.basic&&P['basic.k'])","if(P['basic.k'])",'his weapons'],
  ['Gear Grind 3%',FXJ,"cw_7_1:[ {param:'mel.k',add:R(0.02)} ],","cw_7_1:[ {param:'mel.k',add:R(0.03)} ],",'his weapons'],
  ['Walnut Steady 12%',FXJ,"lw_12_3:[ {param:'ws.k',add:R(0.10)} ],","lw_12_3:[ {param:'ws.k',add:R(0.12)} ],",'his weapons'],
  ['Walnut Steady every ranged attack',FXJ,"if(ranged&&P['ws.k']&&o.wsW!==T.s.wave){ o.wsW=T.s.wave; pk.ws=true; }","if(ranged&&P['ws.k']){ pk.ws=true; }",'his weapons'],
  ['Range Finder at any distance',FXJ,"lw_4_3:[ {on:'out',if:{targetTeam:'enemy',fn:'far6'},more:R(0.02)} ],","lw_4_3:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.02)} ],",'his weapons'],
  ['Bolt Pressure 6%',FXJ,"ignoreArmor:R(0.05)} ],","ignoreArmor:R(0.06)} ],",'his weapons'],
  ['Saw Teeth 10%',FXJ,"lw_6_1:[ {param:'saw.k',add:R(0.08)} ],","lw_6_1:[ {param:'saw.k',add:R(0.10)} ],",'Saw Teeth|Long Arsenal'],
  ['Lower Spike Bite 6%',FXJ,"cw_6_4:[ {param:'ls.k',add:R(0.05)} ],","cw_6_4:[ {param:'ls.k',add:R(0.06)} ],",'Saw Teeth'],
  // ---- Full Arsenal ----
  ['Long Arsenal gatling 10 rounds',FXJ,"A.hurt(T,u,t,9*(0.15+(P['gat.pt']||0))*a","A.hurt(T,u,t,10*(0.15+(P['gat.pt']||0))*a",'Long Arsenal'],
  ['Long Arsenal saw 60%',FXJ,"E.pushDot(t,a*0.5/4*(1+(P['saw.k']||0)),4,1,'#c0392b',u);","E.pushDot(t,a*0.6/4*(1+(P['saw.k']||0)),4,1,'#c0392b',u);",'Long Arsenal'],
  ['Long Arsenal cannon 80%',FXJ,"A.hurt(T,u,x,0.75*a*(1+(P['can.k']||0))","A.hurt(T,u,x,0.80*a*(1+(P['can.k']||0))",'Long Arsenal'],
  ['Long Arsenal cannon on its own target',FXJ,"for(const x of foes(A,u)){ if(x===t) continue; const dx=x.x-u.x","for(const x of foes(A,u)){ const dx=x.x-u.x",'Long Arsenal'],
  ['Every Barrel Counts 3%',FXJ,"lw_9_2:[ {param:'ebc.k',add:R(0.02)} ],","lw_9_2:[ {param:'ebc.k',add:R(0.03)} ],",'Long Arsenal'],
  ['Every Barrel Counts no step',FXJ,"if(P['ebc.k']&&t.alive) T.fn.sight(","if(false) T.fn.sight(",'Long Arsenal'],
  ['Workshop Repair on any enemy',FXJ,"if(P.wr&&A.markOf(u,t,'rvCk'))","if(P.wr)",'Long Arsenal'],
  // ---- The Whole Workshop ----
  ['Whole Workshop every 15 s',FXJ,"o.sigW=20; o.full=false;","o.sigW=15; o.full=false;",'The Whole Workshop'],
  ['Whole Workshop without the bonus',FXJ,"o.vol={boost:(1+(P['rack.k']||0))*(1+(P['rm.k']||0))-1};","o.vol={boost:0};",'The Whole Workshop'],
  ['Whole Workshop on every Full Rack',FXJ,"if(P['sig.ww']&&!(o.sigW>0)){","if(P['sig.ww']){",'The Whole Workshop'],
  // ---- Torque ----
  ['Torque Wrench 18%',FXJ,"o.tqA+=dt*(1+(P['tq.fast']||0));","o.tqA+=dt*(1+(P['tq.fast']||0)*1.2);",'Torque:'],
  ['Torque unwinds 3 a second',FXJ,"o.tqU+=2*dt;","o.tqU+=3*dt;",'Torque:'],
  ['Wound Spring 0.5%',FXJ,"cw_1_1:[ {stat:{aspd:R(0.004)},per:'rvTq'} ],","cw_1_1:[ {stat:{aspd:R(0.005)},per:'rvTq'} ],",'Torque:'],
  ['Tight Spring 3',FXJ,"cw_2_1:[ {param:'tq.max',add:R(2)} ],","cw_2_1:[ {param:'tq.max',add:R(3)} ],",'Torque:'],
  ['Spring Steel 0.25%',FXJ,"cw_4_1:[ {param:'dr.tq',add:R(0.002)} ],","cw_4_1:[ {param:'dr.tq',add:R(0.0025)} ],",'Torque:'],
  ['Spin Down 0.25%',FXJ,"cw_6_1:[ {param:'spin',add:R(0.002)} ],","cw_6_1:[ {param:'spin',add:R(0.0025)} ],",'Torque:'],
  ['heal budget 2% a second',FXJ,"CRIT_CAP=0.05, REGEN=0.012, BANK=5,","CRIT_CAP=0.05, REGEN=0.02, BANK=5,",'Torque:|Spare Parts:'],
  ['Pre-Tensioned lost',FXJ,"cw_11_1:[ {on:'wave',do:[{stack:'rvTq',set:'max'}]} ],","cw_11_1:[ ],",'Pre-Tensioned'],
  ['Torque Release 3%',FXJ,"cw_8_1:[ {param:'tr.k',add:R(0.02)} ],","cw_8_1:[ {param:'tr.k',add:R(0.03)} ],",'Pre-Tensioned'],
  ['Torque Release keeps the Torque',FXJ,"const n=tq(A,T); r.tr=n; A.stSet(T,u,'rvTq',0); } }","const n=tq(A,T); r.tr=n; } }",'Pre-Tensioned'],
  ['Overwound 0.6 s',FXJ,"cw_3_1:[ {param:'ow',add:0.5} ],","cw_3_1:[ {param:'ow',add:0.6} ],",'Pre-Tensioned'],
  ['Overwound below full Torque',FXJ,"if(kind==='hammer'&&P.ow&&tqFull(A,T,u)) F+=P.ow;","if(kind==='hammer'&&P.ow) F+=P.ow;",'Pre-Tensioned'],
  // ---- Pinned and the hook ----
  ['Pinned 5 s',FXJ,"A.setMark(T,u,t,'rvPin',{dur:4+(P['pin.dur']||0)}); o.pmv[t.uid]=1; if(P.gate)","A.setMark(T,u,t,'rvPin',{dur:5+(P['pin.dur']||0)}); o.pmv[t.uid]=1; if(P.gate)",'Pinned:'],
  ['Pin Down 0.6 s',FXJ,"cw_5_4:[ {param:'pin.dur',add:R(0.5)} ],","cw_5_4:[ {param:'pin.dur',add:R(0.6)} ],",'Pinned:'],
  ['Clamp Hand 3%',FXJ,"cw_1_4:[ {param:'pin.k',add:R(0.02)} ],","cw_1_4:[ {param:'pin.k',add:R(0.03)} ],",'Pinned:'],
  ['Clamp Hand on ranged blows',FXJ,"if(mel&&P['pin.k']&&A.markOf(u,t,'rvPin'))","if(P['pin.k']&&A.markOf(u,t,'rvPin'))",'Pinned:'],
  ['Gate Kept 1.5 s',FXJ,"A.control(T,u,t,'silencedT',1); } finally{ o.tsrc=null; } } }","A.control(T,u,t,'silencedT',1.5); } finally{ o.tsrc=null; } } }",'Pinned:'],
  ['Nobody Leaves 1.2%',FXJ,"cw_9_4:[ {param:'nl',add:R(0.01)} ],","cw_9_4:[ {param:'nl',add:R(0.012)} ],",'Pinned:'],
  ['Dragged Back 0.4 m',FXJ,"cw_12_4:[ {param:'drag',add:R(0.3)} ],","cw_12_4:[ {param:'drag',add:R(0.4)} ],",'Pinned:'],
  ['Dragged Back by ranged blows',FXJ,"if(r&&ARM.indexOf(r.w)>=0&&P.drag&&","if(r&&P.drag&&",'Pinned:'],
  ['Pinned lets a dash go',FXJ,"if(x._dash){ const D=x._dash; D.x0=D.x1=x.px; D.y0=D.y1=x.py; x.x=x.px; x.y=x.py; x._ax=x.x; x._ay=x.y; continue; }","",'Pinned:'],
  ['Pinned lets a jump go',FXJ,"if(x.px!=null&&Math.hypot(x.x-x.px,x.y-x.py)>1.5*M){ x.x=x.px; x.y=x.py; x._ax=x.x; x._ay=x.y; }","",'Pinned:'],
  ['Held Fast 2.5%',FXJ,"cw_10_4:[ {param:'held',add:R(0.02)} ],","cw_10_4:[ {param:'held',add:R(0.025)} ],",'Pinned:'],
  ['Held Fast not on allies',FXJ,"      if(P.held&&A.markOf(u,s,'rvPin')) k*=1-P.held;\n      if(P.screen&&T.r.nc_5_2&&A.markOf(u,s,'rvSm')) k*=1-P.screen;\n      return Math.max(ALLY_FLOOR,k); },","      if(P.screen&&T.r.nc_5_2&&A.markOf(u,s,'rvSm')) k*=1-P.screen;\n      return Math.max(ALLY_FLOOR,k); },",'Pinned:'],
  ['Long Chain 1.5 m',FXJ,"cw_2_4:[ {param:'chain',add:R(1)} ],","cw_2_4:[ {param:'chain',add:R(1.5)} ],",'Pinned:'],
  // ---- the melee cycle ----
  ['Hook in the Cycle: no stun-lock rule',FXJ,"if(kind==='hook'&&r&&r.cyc) lock=true;","",'Hook in the Cycle'],
  ['Reel In 5%',FXJ,"cw_6_2:[ {param:'reel.k',add:R(0.04)} ],","cw_6_2:[ {param:'reel.k',add:R(0.05)} ],",'Hook in the Cycle'],
  ['Reel In on the automatic hook',FXJ,"if(w==='hook'&&r.cyc&&P['reel.k'])","if(w==='hook'&&P['reel.k'])",'Hook in the Cycle'],
  ['Hammer Hand 1.2 s',FXJ,"if(P.hh) F=1.0;","if(P.hh) F=1.2;",'Hammer Hand'],
  ['Hammer Hand: second hammer not locked',FXJ,"if(r&&r.h2) lock=true;","",'Hammer Hand'],
  ['Ringing Blow 4%',FXJ,"cw_7_3:[ {param:'ring.k',add:R(0.03)} ],","cw_7_3:[ {param:'ring.k',add:R(0.04)} ],",'Hammer Hand'],
  ['Hard Questions 4%',FXJ,"nc_7_1:[ {param:'hq',add:R(0.03)} ],","nc_7_1:[ {param:'hq',add:R(0.04)} ],",'Hammer Hand|Third Winter'],
  ['Spike Rhythm 0.4 s',FXJ,"cw_10_3:[ {param:'spike',add:R(0.3)} ],","cw_10_3:[ {param:'spike',add:R(0.4)} ],",'Hammer Hand'],
  ['Machine Patience every 3',FXJ,"o.mr%((P.hic||P.hh)?5:4)===0","o.mr%((P.hic||P.hh)?5:3)===0",'Machine Patience'],
  ['Machine Patience through a shot',FXJ,"if(ranged) o.mr=0; else {","if(ranged){} else {",'Machine Patience'],
  ['Machine Patience 0.6%',FXJ,"cw_11_2:[ {stat:{atk:R(0.005)},per:'rvMp'} ],","cw_11_2:[ {stat:{atk:R(0.006)},per:'rvMp'} ],",'Machine Patience'],
  ['Clockwork Fury at 9',FXJ,"A.stGet(T,'rvMp')>=10) p+=P['crit.cf'];","A.stGet(T,'rvMp')>=9) p+=P['crit.cf'];",'Machine Patience'],
  ['Arms for the Gap three attacks',FXJ,"o.sigA=20; o.agN=4;","o.sigA=20; o.agN=3;",'Arms for the Gap'],
  ['Arms for the Gap every 15 s',FXJ,"o.sigA=20; o.agN=4;","o.sigA=15; o.agN=4;",'Arms for the Gap'],
  ['Arms for the Gap 50% faster',FXJ,"{stat:{aspd:1},if:{fn:'agOn'}}","{stat:{aspd:0.5},if:{fn:'agOn'}}",'Arms for the Gap'],
  ['Arms for the Gap hooks nobody in',FXJ,"if(canMove(x)){ const dx=x.x-u.x, dy=x.y-u.y, L=Math.hypot(dx,dy)||1, to=Math.min(L,A.eng().bodyR(u)+A.eng().bodyR(x)+0.5*M); x._dash=null; x.x=u.x+dx/L*to; x.y=u.y+dy/L*to; x._ax=x.x; x._ay=x.y; }","",'Arms for the Gap'],
  ['Arms for the Gap out of order',FXJ,"w=MEL[o.agi%4]; o.agi++;","w=MEL[(o.agi+1)%4]; o.agi++;",'Arms for the Gap'],
  // ---- Cracks ----
  ['Cracked at 2',FXJ,"if(v>=3){ A.ustPut(T,u,t,'rvCr',0);","if(v>=2){ A.ustPut(T,u,t,'rvCr',0);",'Cracks:'],
  ['Walnut Grip lost',FXJ,"(kind==='hammer'&&P.wg&&f==='stunned')?2:","(false)?2:",'Cracks:'],
  ['Cracked 3.5 s',FXJ,"A.setMark(T,u,t,'rvCk',{dur:3+(P['ck.dur']||0)});","A.setMark(T,u,t,'rvCk',{dur:3.5+(P['ck.dur']||0)});",'Cracks:'],
  ['Crack the Shell 7%',FXJ,"nc_1_1:[ {stat:{armor:R(-0.06)}","nc_1_1:[ {stat:{armor:R(-0.07)}",'Cracks:'],
  ['Stress Point 1.2%',FXJ,"nc_9_2:[ {stat:{aspd:R(-0.01)}","nc_9_2:[ {stat:{aspd:R(-0.012)}",'Cracks:'],
  ['Split Grain 4%',FXJ,"nc_10_1:[ {stat:{move:R(-0.03)}","nc_10_1:[ {stat:{move:R(-0.04)}",'Cracks:'],
  ['Nothing Cancelled 0.5%',FXJ,"nc_11_2:[ {stat:{atk:R(0.004)},per:'rvNc'} ],","nc_11_2:[ {stat:{atk:R(0.005)},per:'rvNc'} ],",'Cracks:'],
  ['Shell Splinters 3%',FXJ,"nc_4_1:[ {on:'out',if:{targetTeam:'enemy',targetHas:'rvCk'},more:R(0.02)} ],","nc_4_1:[ {on:'out',if:{targetTeam:'enemy',targetHas:'rvCk'},more:R(0.03)} ],",'on Cracked enemies'],
  ['Nutcracker\'s Jaw 4%',FXJ,"nc_8_1:[ {param:'jaw.k',add:R(0.03)} ],","nc_8_1:[ {param:'jaw.k',add:R(0.04)} ],",'on Cracked enemies'],
  ['One Function 3%',FXJ,"targetHas:'rvCk'},critMore:R(0.02)} ],","targetHas:'rvCk'},critMore:R(0.03)} ],",'on Cracked enemies'],
  ['Fracture Lines 3%',FXJ,"nc_6_1:[ {on:'teamIn',if:{srcIs:'ally',targetHas:'rvCk'},more:R(0.02)} ],","nc_6_1:[ {on:'teamIn',if:{srcIs:'ally',targetHas:'rvCk'},more:R(0.03)} ],",'on Cracked enemies'],
  ['Deep Fracture 6%',FXJ,"nc_12_1:[ {on:'teamHeal',if:{unitHas:'rvCk'},less:R(0.05)} ],","nc_12_1:[ {on:'teamHeal',if:{unitHas:'rvCk'},less:R(0.06)} ],",'on Cracked enemies'],
  ['Cracked Open every Cracking',FXJ,"if(P.co&&!(o.coT>0)){ o.coT=10;","if(P.co){ o.coT=10;",'on Cracked enemies'],
  ['Fits the Rack 7%',FXJ,"if(fs[t.uid]) k*=1.06;","if(fs[t.uid]) k*=1.07;",'on Cracked enemies'],
  ['Fits the Rack twice a rack',FXJ,"if(T.r.lw_1_1&&!o.frU&&!o.vol){","if(T.r.lw_1_1&&!o.vol){",'on Cracked enemies'],
  // ---- Spare Parts ----
  ['two Parts a Cracking',FXJ,"if(sig||T.r.nc_1_4) A.stSet(T,u,'rvPt',A.stGet(T,'rvPt')+1);","if(sig||T.r.nc_1_4) A.stSet(T,u,'rvPt',A.stGet(T,'rvPt')+2);",'Spare Parts:'],
  ['Spare Bolts 3',FXJ,"nc_2_4:[ {param:'pt.max',add:R(2)} ],","nc_2_4:[ {param:'pt.max',add:R(3)} ],",'Spare Parts:'],
  ['fitted below 70%',FXJ,"if(f.fit&&u.hp<0.5*u.maxHp&&","if(f.fit&&u.hp<0.7*u.maxHp&&",'Spare Parts:'],
  ['Parts Bin 1.2%',FXJ,"nc_1_4:[ {param:'pt.fit',add:R(0.01)} ],","nc_1_4:[ {param:'pt.fit',add:R(0.012)} ],",'Spare Parts:|Last Spare'],
  ['Patch Kit 0.6%',FXJ,"nc_6_4:[ {param:'pt.kit',add:R(0.005)} ],","nc_6_4:[ {param:'pt.kit',add:R(0.006)} ],",'Spare Parts:'],
  ['Quick Fit 0.6%',FXJ,"nc_3_4:[ {param:'dr.qf',add:R(0.005)} ],","nc_3_4:[ {param:'dr.qf',add:R(0.006)} ],",'Spare Parts:'],
  ['Quick Fit 4 s',FXJ,"A.acts(T,u,[{window:'rvQf',dur:3,n}],c);","A.acts(T,u,[{window:'rvQf',dur:4,n}],c);",'Spare Parts:'],
  ['Salvage 2',FXJ,"nc_5_4:[ {param:'salv',add:R(1)} ],","nc_5_4:[ {param:'salv',add:R(2)} ],",'Spare Parts:'],
  ['Spare Arm 2.5%',FXJ,"nc_9_4:[ {stat:{aspd:R(0.02)},if:{stackMin:{rvPt:8}}} ],","nc_9_4:[ {stat:{aspd:R(0.025)},if:{stackMin:{rvPt:8}}} ],",'Spare Parts:'],
  ['Self-Made 0.12%',FXJ,"nc_10_4:[ {param:'self',add:R(0.001)} ],","nc_10_4:[ {param:'self',add:R(0.0012)} ],",'Spare Parts:'],
  ['heal budget kept 1 s',FXJ,"REGEN=0.012, BANK=5, STUN_RUN","REGEN=0.012, BANK=1, STUN_RUN",'Spare Parts:'],
  ['Parts kept at a wave',FXJ,"if(!P.walnut) A.stSet(T,u,'rvPt',0);","",'Spare Parts:'],
  ['Last Spare 1.8 s',FXJ,"nc_12_4:[ {param:'ls.hold',add:R(0.5)} ],","nc_12_4:[ {param:'ls.hold',add:R(0.6)} ],",'Last Spare'],
  ['Last Spare twice',FXJ,"{on:'lethal',reqAny:['nc_12_4'],once:'fight',","{on:'lethal',reqAny:['nc_12_4'],",'Last Spare'],
  // ---- Smoke Bomb and Scattergun ----
  ['Thick Smoke 4%',FXJ,"nc_2_2:[ {param:'smoke.k',add:R(0.03)} ],","nc_2_2:[ {param:'smoke.k',add:R(0.04)} ],",'Smoke Bomb:'],
  ['Lingering Smoke 0.4 s',FXJ,"nc_4_2:[ {param:'smoke.dur',add:R(0.3)} ],","nc_4_2:[ {param:'smoke.dur',add:R(0.4)} ],",'Smoke Bomb:'],
  ['Spreading Smoke 0.4 m',FXJ,"if(x===t||A.gap(t,x)>=2*M) continue;","if(x===t||A.gap(t,x)>=0.4*M) continue;",'Smoke Bomb:'],
  ['Smoke Screen 2.5%',FXJ,"nc_6_2:[ {param:'screen',add:R(0.02)} ],","nc_6_2:[ {param:'screen',add:R(0.025)} ],",'Smoke Bomb:'],
  ['Hinge Oil 0.6 s',FXJ,"nc_12_3:[ {on:'cd',skill:'blue',add:R(-0.5)} ],","nc_12_3:[ {on:'cd',skill:'blue',add:R(-0.6)} ],",'Smoke Bomb:'],
  ['Smoke and Sight 2 a rank',FXJ,"lw_12_1:[ {param:'sas',add:R(1)} ],","lw_12_1:[ {param:'sas',add:R(2)} ],",'Smoke Bomb:'],
  ['Second Look 3%',FXJ,"targetUst:{rvSi:1}},more:R(0.02)} ],","targetUst:{rvSi:1}},more:R(0.03)} ],",'Smoke Bomb:'],
  ['Oil in the Eyes 1.5 s',FXJ,"o.tsrc='oil'; try{ A.control(T,u,t,'silencedT',1); }","o.tsrc='oil'; try{ A.control(T,u,t,'silencedT',1.5); }",'Oil in the Eyes'],
  ['Oil in the Eyes 1 Crack',FXJ,"(kind==='oil'?2:1)","(kind==='oil'?1:1)",'Oil in the Eyes'],
  ['Black Oil 5%',FXJ,"nc_7_3:[ {on:'out',if:{casting:SB,targetTeam:'enemy'},more:R(0.04)} ],","nc_7_3:[ {on:'out',if:{casting:SB,targetTeam:'enemy'},more:R(0.05)} ],",'Oil in the Eyes'],
  ['Smoke in Their Face 5%',FXJ,"cw_9_2:[ {on:'out',if:{casting:SB,targetTeam:'enemy',targetWithin:3},more:R(0.04)} ],","cw_9_2:[ {on:'out',if:{casting:SB,targetTeam:'enemy',targetWithin:3},more:R(0.05)} ],",'Oil in the Eyes'],
  ['Scrap Load 5%',FXJ,"lw_10_2:[ {on:'out',if:{casting:SG,targetTeam:'enemy'},more:R(0.04)} ],","lw_10_2:[ {on:'out',if:{casting:SG,targetTeam:'enemy'},more:R(0.05)} ],",'Scattergun:'],
  ['Close Enough 4%',FXJ,"cw_10_1:[ {on:'out',if:{casting:SG,targetTeam:'enemy',targetWithin:3},more:R(0.03)} ],","cw_10_1:[ {on:'out',if:{casting:SG,targetTeam:'enemy',targetWithin:3},more:R(0.04)} ],",'Scattergun:'],
  // ---- The Third Winter ----
  ['Third Winter 3 m',FXJ,"L=foes(A,u).filter(x=>x!==t&&A.gap(t,x)<4*M);","L=foes(A,u).filter(x=>x!==t&&A.gap(t,x)<3*M);",'Third Winter'],
  ['Third Winter 1.5 s',FXJ,"o.tsrc='tw'; try{ for(const x of L) if(x.alive) A.control(T,u,x,'stunned',1); }","o.tsrc='tw'; try{ for(const x of L) if(x.alive) A.control(T,u,x,'stunned',1.5); }",'Third Winter'],
  ['Third Winter every 20 s',FXJ,"o.sigT=25;","o.sigT=20;",'Third Winter'],
  ['talent stuns not locked',FXJ,"let lock=!!c.talent;","let lock=false;",'Third Winter'],
  ['Third Winter drops no Part',FXJ,"if(sig||T.r.nc_1_4)","if(T.r.nc_1_4)",'Third Winter'],
  // ---- the caps ----
  ['damage-reduction cap 40%',FXJ,"DR_FLOOR=0.65, ALLY_FLOOR=0.80, CRIT_CAP=0.05, REGEN=0.012, BANK=5,","DR_FLOOR=0.60, ALLY_FLOOR=0.80, CRIT_CAP=0.05, REGEN=0.012, BANK=5,",'the caps'],
  ['damage reduction not on damage over time',FXJ,"{on:'dotIn',reqAny:DRG,do:[{fn:'myDr'}]},                              // his damage reduction: one capped group\n    {on:'teamIn',reqAny:ALLY,if:{targetTeam:'ally',srcTeam:'enemy'},do:[{fn:'allyDr'}]}","                              // his damage reduction: one capped group\n    {on:'teamIn',reqAny:ALLY,if:{targetTeam:'ally',srcTeam:'enemy'},do:[{fn:'allyDr'}]}",'the caps'],
  ['Bolted Seams on basic attacks',FXJ,"if(P['dr.ab1']&&ab)","if(P['dr.ab1'])",'the caps'],
  ['Reinforced Plating beyond 7 m',FXJ,"if(P['dr.far']&&g>6*M)","if(P['dr.far']&&g>7*M)",'the caps'],
  ['Iron Apron within 7 m',FXJ,"if(P['dr.near']&&g<=3*M)","if(P['dr.near']&&g<=7*M)",'the caps'],
  ['crit cap 6%',FXJ,"ALLY_FLOOR=0.80, CRIT_CAP=0.05,","ALLY_FLOOR=0.80, CRIT_CAP=0.06,",'the caps|Clockwork'],
  ['stun run 4.5 s',FXJ,"STUN_RUN=4.0,","STUN_RUN=4.5,",'the caps'],
  ['no free 0.5 s',FXJ,"if(st.free>0) F=0;","",'the caps'],
  ['Seized Gears 4 s',FXJ,"if(T.r.nc_n1) A.setMark(T,u,t,'rvSz',{dur:3});","if(T.r.nc_n1) A.setMark(T,u,t,'rvSz',{dur:4});",'the caps'],
  ['Patched Joints 1.5%',FXJ,"cw_12_3:[ {param:'pj',add:R(0.01)} ],","cw_12_3:[ {param:'pj',add:R(0.015)} ],",'the caps'],
  ['Grounded Frame 5%',FXJ,"cw_3_3:[ {on:'ccIn',less:R(0.04)} ],","cw_3_3:[ {on:'ccIn',less:R(0.05)} ],",'the caps'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ const walk=(s,d)=>{ fs.mkdirSync(d,{recursive:true}); for(const n of fs.readdirSync(s)){ const a=path.join(s,n), b=path.join(d,n), r=path.relative(root,a);
    if(SKIP.has(r.split(path.sep)[0])||/^\.ctl-|^\.remote-|^\.test-/.test(n)) continue; const st=fs.lstatSync(a); if(st.isDirectory()) walk(a,b); else if(st.isFile()) fs.copyFileSync(a,b); } };
  walk(root,dir); for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
const fix=(s,x)=>x.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n');
if(process.argv[2]==='--check'){ let bad=0; for(const c of C){ const s=fs.readFileSync(path.join(root,c[1]),'utf8'), n=s.split(fix(s,c[2])).length-1; if(n!==1){ bad++; console.log('FOUND '+n+' TIMES: '+c[0]); } } console.log(C.length+' controls, '+bad+' with a text not found exactly once'); process.exit(bad?1:0); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-rvc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=fix(s,from), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>fix(s,to)));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-rivet.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0&&!!pm,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
/* first the copy unbroken: every test must pass there, or a control that "fails" proves nothing */
{ const b=runOne(['(unbroken)',HTML,'<html','<html','.']); if(!/^fail 0, pass [1-9]/.test(b.why)){ console.log('BASELINE BROKEN: '+b.why); process.exit(1); } console.log('baseline: '+b.why); }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
