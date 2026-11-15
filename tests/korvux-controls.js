'use strict';
/* The controls for Korvux's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-korvux.test.js in the same run). Each control copies this checkout to a temp folder under os.tmpdir() (never under the checkout:
   .logs, node_modules, assets and the runner's own folders are left out, node_modules and assets are linked), breaks ONE thing there (an exact text swap in
   emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a primitive or a row of his broken),
   runs the named tests of tests/talents-mech-korvux.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child processes); each copy
   is deleted as soon as its run is done. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   node tests/korvux-controls.js [regex: only the controls whose name matches] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', ENG='talents-fx.js';
const IMR="u._immT=(u._immT||0)+(_imG?TalentFx.num(u,'immRate',dt):dt);";
const IMRR="const R=_imG?TalentFx.num(u,'immR',2.4*METER):2.4*METER;";
const IMA="dotTickAmt(u,e,_imG?TalentFx.num(u,'immAmt',u.dmg*SKLV.immolate(passLv(u)),e):u.dmg*SKLV.immolate(passLv(u)),";
const IMB="if(u._immT>=1){ u._immT-=1; const R=_imG?";
const STG="if(u._tal&&u._tal.on.skillTgt) tg2=TalentFx.skillTgt(u,'charge',tg2,o)||tg2;";
const AT="      if(u._tal&&u._tal.on.at) TalentFx.at(u,'ashfall',groundHazards[groundHazards.length-1],o,_sD*(o.dps||0.5)*sm);";
const HZ="(h._talH&&h._talH._tal)?TalentFx.num(h._talH,'hzTick',h.dmg,e):h.dmg";
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['Emberskin clock hook removed',HTML,IMR,'u._immT=(u._immT||0)+dt;','Cooking:'],
  ['Emberskin reach hook removed',HTML,IMRR,'const R=2.4*METER;','Emberskin.s reach'],
  ['Emberskin burn hook removed',HTML,IMA,'dotTickAmt(u,e,u.dmg*SKLV.immolate(passLv(u)),','Cooking:'],
  ['charge target hook removed',HTML,STG,'','Thought It Safe|Called Down'],
  ['Falling Star crater hook removed',HTML,AT,'','Falling Star:|in the crater|Witnessed:'],
  ['crater tick hook removed',HTML,HZ,'h.dmg','in the crater'],
  // ---- an unguarded seeded draw at each page site (the no-talent identity test fails) ----
  ['unguarded draw: Emberskin',HTML,IMB,"if(u._immT>=1){ u._immT-=1; brnd(); const R=_imG?",'no talents'],
  ['unguarded draw: charge target',HTML,STG,STG+' brnd();','no talents'],
  ['unguarded draw: Falling Star crater',HTML,AT,AT+' brnd();','no talents'],
  ['unguarded draw: crater tick',HTML,HZ,'(brnd(),'+HZ+')','no talents'],
  // ---- the runtime ----
  ['at hook loses the crater',ENG,"pt:p,raw:raw||0,c}); }","pt:p,raw:raw||0}); }",'Falling Star:|in the crater'],
  // ---- Cooking and Emberskin ----
  ['Too Close 2%',FXJ,"rh_1_1:[ {param:'cook.k',add:R(0.01)} ],","rh_1_1:[ {param:'cook.k',add:R(0.02)} ],",'Cooking:'],
  ['Cooking max 9',FXJ,"A.ustPut(T,u,e,'kxCk',Math.min(8,n+1),1.5);","A.ustPut(T,u,e,'kxCk',Math.min(9,n+1),1.5);",'Cooking:'],
  ['Cooking lapses after 2.5 s',FXJ,"A.ustPut(T,u,e,'kxCk',Math.min(8,n+1),1.5);","A.ustPut(T,u,e,'kxCk',Math.min(8,n+1),2.5);",'Cooking:'],
  ['Cooking fades 1 a second never',FXJ,"kxCk:{unit:true,max:8,dur:1.5,step:P('ck.step',1)}","kxCk:{unit:true,max:8,dur:1.5}",'Cooking:'],
  ['Slow Roast 0.6 s',FXJ,"rh_2_1:[ {param:'ck.step',add:R(0.5)} ],","rh_2_1:[ {param:'ck.step',add:R(0.6)} ],",'Cooking:'],
  ['Cooked Through x1.9',FXJ,"if(P['imm.thru']&&n>=8) k*=2;","if(P['imm.thru']&&n>=8) k*=1.9;",'Cooking:'],
  ['Cooked Through at 7',FXJ,"if(P['imm.thru']&&n>=8) k*=2;","if(P['imm.thru']&&n>=7) k*=2;",'Cooking:'],
  ['Furnace Core 3%',FXJ,"rh_3_4:[ {param:'imm.core',add:R(0.02)} ],","rh_3_4:[ {param:'imm.core',add:R(0.03)} ],",'Cooking:'],
  ['Seething at 60%',FXJ,"if(P['imm.seeth']&&u.hp<0.5*u.maxHp)","if(P['imm.seeth']&&u.hp<0.6*u.maxHp)",'Cooking:'],
  ['Cook Faster 5%',FXJ,"rh_9_4:[ {param:'imm.fast',add:R(0.04)} ],","rh_9_4:[ {param:'imm.fast',add:R(0.05)} ],",'Cooking:'],
  ['Cleave the Heat 2',FXJ,"A.ustPut(T,u,t,'kxCk',Math.min(8,ck(A,T,u,t)+3),1.5);","A.ustPut(T,u,t,'kxCk',Math.min(8,ck(A,T,u,t)+2),1.5);",'Cleave the Heat'],
  ['Blistered at 3',FXJ,"rh_6_4:[ {on:'out',if:{casting:CLV,targetUst:{kxCk:4}},more:R(0.03)} ],","rh_6_4:[ {on:'out',if:{casting:CLV,targetUst:{kxCk:3}},more:R(0.03)} ],",'Cleave the Heat'],
  ['Hot Blood from anyone',FXJ,"if(P['dr.hb']&&ck(A,T,u,s)>0) k*=1-P['dr.hb'];","if(P['dr.hb']) k*=1-P['dr.hb'];",'Cleave the Heat'],
  ['Forty Words at 3 Cooking',FXJ,"if(P['crit.fw']&&ck(A,T,u,t)>=4)","if(P['crit.fw']&&ck(A,T,u,t)>=3)",'Cleave the Heat'],
  ['Wide Heat 0.25 m',FXJ,"rh_4_2:[ {param:'imm.wide',add:R(0.2)} ],","rh_4_2:[ {param:'imm.wide',add:R(0.25)} ],",'Emberskin.s reach'],
  ['Scalding Mist 0.15 m',FXJ,"rh_2_2:[ {param:'imm.mist',add:R(0.1)} ],","rh_2_2:[ {param:'imm.mist',add:R(0.15)} ],",'Emberskin.s reach'],
  ['Kellsmarch Summer at 2',FXJ,"if(ck(A,T,u,x)>0) n++; if(n>=3) add+=1; }","if(ck(A,T,u,x)>0) n++; if(n>=2) add+=1; }",'Emberskin.s reach'],
  ['Kellsmarch Summer 1.2 m',FXJ,"if(ck(A,T,u,x)>0) n++; if(n>=3) add+=1; }","if(ck(A,T,u,x)>0) n++; if(n>=3) add+=1.2; }",'Emberskin.s reach'],
  // ---- Steam ----
  ['Steam max 6',FXJ,"kxSt:{max:5,dur:4},","kxSt:{max:6,dur:4},",'Steam:'],
  ['Steam lapses after 5 s',FXJ,"kxSt:{max:5,dur:4},","kxSt:{max:5,dur:5},",'Steam:'],
  ['Rain to Steam 0.5%',FXJ,"rh_1_2:[ {param:'dr.st',add:R(0.004)} ],","rh_1_2:[ {param:'dr.st',add:R(0.005)} ],",'Steam:'],
  ['Old Scales at 2 Steam',FXJ,"rh_5_1:[ {stat:{mr:R(0.02)},if:{stackMin:{kxSt:3}}} ],","rh_5_1:[ {stat:{mr:R(0.02)},if:{stackMin:{kxSt:2}}} ],",'Steam:'],
  ['Ash Tongue at 4 Steam',FXJ,"rh_10_2:[ {stat:{aspd:R(0.03)},if:{stackMin:{kxSt:5}}} ],","rh_10_2:[ {stat:{aspd:R(0.03)},if:{stackMin:{kxSt:4}}} ],",'Steam:'],
  ['Boiling Off 0.3%',FXJ,"rh_8_2:[ {param:'heal.boil',add:R(0.0024)} ],","rh_8_2:[ {param:'heal.boil',add:R(0.003)} ],",'Steam:'],
  ['heal budget 1.5%',FXJ,"DR_FLOOR=0.70, CRIT_CAP=0.05, SLOW_CAP=0.40, REGEN=0.012;","DR_FLOOR=0.70, CRIT_CAP=0.05, SLOW_CAP=0.40, REGEN=0.015;",'Steam:|Afterglow:'],
  ['Boiling Off at 4 Steam',FXJ,"if(P['heal.boil']&&A.stGet(T,'kxSt')>=5)","if(P['heal.boil']&&A.stGet(T,'kxSt')>=4)",'Steam:'],
  ['Steam Burst 110%',FXJ,"A.hurt(T,u,x,d*E.defMul(u,x,'phys')*T.fn.dk(A,T,u,x),'#ff8a3a','steamburst');","A.hurt(T,u,x,1.1*d*E.defMul(u,x,'phys')*T.fn.dk(A,T,u,x),'#ff8a3a','steamburst');",'Steam Burst'],
  ['Steam Burst keeps its Steam',FXJ,"if(P['st.burst']&&n>=5){ A.stSet(T,u,'kxSt',0);","if(P['st.burst']&&n>=5){ ",'Steam Burst'],
  ['Steam Burst on everyone',FXJ,"for(const x of foes(A,u)) if(inE(A,u,x)) A.hurt(","for(const x of foes(A,u)) if(true) A.hurt(",'Steam Burst'],
  ['Steam Burst at 4',FXJ,"if(P['st.burst']&&n>=5){","if(P['st.burst']&&n>=4){",'Steam Burst'],
  ['Glow 20%',FXJ,"if(T.r.rh_n1&&A.winOn(T,'kxGl')) k*=1.15;","if(T.r.rh_n1&&A.winOn(T,'kxGl')) k*=1.2;",'Steam Burst'],
  ['Glow 4 s',FXJ,"rh_n1:[  {on:'steam5',do:[{window:'kxGl',dur:3},{fn:'glowAg'}]} ],","rh_n1:[  {on:'steam5',do:[{window:'kxGl',dur:4},{fn:'glowAg'}]} ],",'Steam Burst'],
  ['Glow: Afterglow without Afterglow',FXJ,"glowAg(A,T,u,c){ if(T.r.bs_1_1)","glowAg(A,T,u,c){ if(true)",'Steam Burst'],
  // ---- in Emberskin ----
  ['Coals 0.6%',FXJ,"rh_7_4:[ {stat:{armor:R(-0.005)},to:{team:'enemy',has:'kxIe'}} ],","rh_7_4:[ {stat:{armor:R(-0.006)},to:{team:'enemy',has:'kxIe'}} ],",'in Emberskin'],
  ['in Emberskin lasts 3 s',FXJ,"const d=1.2/(o.rate||1); A.setMark(T,u,e,'kxIe',{dur:d});","const d=3; A.setMark(T,u,e,'kxIe',{dur:d});",'in Emberskin'],
  ['Overheat 0.6%',FXJ,"rh_10_1:[ {stat:{atk:R(0.005)},per:{fn:'cookIn',max:5}} ],","rh_10_1:[ {stat:{atk:R(0.006)},per:{fn:'cookIn',max:5}} ],",'in Emberskin'],
  ['Keep Them Back every burn',FXJ,"if(kb[e.uid]!==w){ kb[e.uid]=w;","if(true){ kb[e.uid]=w;",'in Emberskin'],
  ['Keep Them Back no push',FXJ,"A.acts(T,u,[{push:'unit',from:'self',m:1,secs:0.3},","A.acts(T,u,[",'in Emberskin'],
  ['Keep Them Back 25%',FXJ,"{slow:0.20+(P['kb.slow']||0),dur:2,on:'unit'}","{slow:0.25+(P['kb.slow']||0),dur:2,on:'unit'}",'in Emberskin'],
  ['Cooked Out 6 points',FXJ,"rh_6_3:[ {param:'kb.slow',add:R(0.05)} ],","rh_6_3:[ {param:'kb.slow',add:R(0.06)} ],",'in Emberskin'],
  ['Sunburnt Friends 7%',FXJ,"rh_5_2:[ {on:'teamIn',if:{fn:'sunAlly'},more:0.06} ],","rh_5_2:[ {on:'teamIn',if:{fn:'sunAlly'},more:0.07} ],",'Sunburnt Friends'],
  ['Sunburnt Friends Korvux too',FXJ,"if(!s||s===u||s.team!==u.team","if(!s||s.team!==u.team",'Sunburnt Friends'],
  ['Sunburnt Friends any distance',FXJ,"return A.gap(u,s)<(S(T).R||2.4)*E.METER(); },","return true; },",'Sunburnt Friends'],
  // ---- Running Hotter, Well Done, the white signature ----
  ['Running Hotter on any death',FXJ,"if((T.r.rh_11_2||T.r.rh_12_2)&&ck(A,T,u,x)>0)","if((T.r.rh_11_2||T.r.rh_12_2))",'Running Hotter'],
  ['Running Hotter 1.2%',FXJ,"rh_11_2:[ {param:'rh.k',add:R(0.01)} ],","rh_11_2:[ {param:'rh.k',add:R(0.012)} ],",'Running Hotter'],
  ['Running Hotter kept between waves',FXJ,"kxRh:{max:5,wave:'reset'},","kxRh:{max:5},",'Running Hotter'],
  ['Well Done at 4',FXJ,"if(P['wd.k']&&A.stGet(T,'kxRh')>=5)","if(P['wd.k']&&A.stGet(T,'kxRh')>=4)",'Running Hotter'],
  ['Well Done no boss rule',FXJ,"if(isBoss(e)) x=Math.min(x,atk(A,T,u,c)); amt+=x; }","amt+=x; }",'Running Hotter'],
  ['Something Owes Him at 6',FXJ,"if(P['imm.owe']&&A.stGet(T,'kxPc')>=7)","if(P['imm.owe']&&A.stGet(T,'kxPc')>=6)",'Running Hotter'],
  ['white at 2 enemies',FXJ,"if(ck(A,T,u,x)>=8) n++;   // Rain Never Lands","if(ck(A,T,u,x)>=8) n+=2;   // Rain Never Lands",'Rain Never Lands'],
  ['white every 20 s',FXJ,"if(n>=3){ o.whT=now+25;","if(n>=3){ o.whT=now+20;",'Rain Never Lands'],
  ['white 7 s',FXJ,"A.acts(T,u,[{window:'kxWh',dur:6}],c); } }","A.acts(T,u,[{window:'kxWh',dur:7}],c); } }",'Rain Never Lands'],
  ['white reach x1.5',FXJ,"c.amt+=add*M; if(A.winOn(T,'kxWh')) c.amt*=2;","c.amt+=add*M; if(A.winOn(T,'kxWh')) c.amt*=1.5;",'Rain Never Lands'],
  ['white burn x1.8',FXJ,"if(A.winOn(T,'kxWh')) k*=2;","if(A.winOn(T,'kxWh')) k*=1.8;",'Rain Never Lands'],
  ['white: hits do not fill Steam',FXJ,"const to=A.winOn(T,'kxWh')?5:n+1;","const to=n+1;",'Rain Never Lands'],
  ['white burst 60%',FXJ,"const d=0.5*atk(A,T,u,c); for(const y of foes(A,u))","const d=0.6*atk(A,T,u,c); for(const y of foes(A,u))",'Rain Never Lands'],
  ['white burst 2 m',FXJ,"if(y!==x&&A.gap(x,y)<3*E.METER())","if(y!==x&&A.gap(x,y)<0.5*E.METER())",'Rain Never Lands'],
  // ---- Afterglow ----
  ['Afterglow 5 s',FXJ,"dur:eight?8:4+(P['ag.dur']||0),longest:true}],c);","dur:eight?8:5+(P['ag.dur']||0),longest:true}],c);",'Afterglow:|Called Down'],
  ['Lasting Glow 0.5 s',FXJ,"bs_3_1:[ {param:'ag.dur',add:R(0.4)} ],","bs_3_1:[ {param:'ag.dur',add:R(0.5)} ],",'Afterglow:'],
  ['Afterglow 5%',FXJ,"bs_1_1:[ {on:'out',if:{auto:true,window:'kxAg'},more:R(0.04)} ],","bs_1_1:[ {on:'out',if:{auto:true,window:'kxAg'},more:R(0.05)} ],",'Afterglow:'],
  ['Glow Hands 2%',FXJ,"bs_5_1:[ {stat:{aspd:R(0.01)},if:{window:'kxAg'}} ],","bs_5_1:[ {stat:{aspd:R(0.02)},if:{window:'kxAg'}} ],",'Afterglow:'],
  ['Thick Scales 4%',FXJ,"bs_5_4:[ {stat:{mr:R(0.03)},if:{window:'kxAg'}} ],","bs_5_4:[ {stat:{mr:R(0.04)},if:{window:'kxAg'}} ],",'Afterglow:'],
  ['Glowing Hide always',FXJ,"if(P['dr.gh']&&A.winOn(T,'kxAg')) k*=1-P['dr.gh'];","if(P['dr.gh']) k*=1-P['dr.gh'];",'Afterglow:'],
  ['Landing Heat over the budget',FXJ,"h=Math.min(o.hb||0,0.005*rk(T,'bs_7_1')*u.maxHp);","h=0.005*rk(T,'bs_7_1')*u.maxHp;",'Afterglow:'],
  ['Bask 3%',FXJ,"bs_12_1:[ {on:'end:kxAg',do:[{heal:{pct:R(0.02),of:'maxHp'},on:'self'}]} ],","bs_12_1:[ {on:'end:kxAg',do:[{heal:{pct:R(0.03),of:'maxHp'},on:'self'}]} ],",'Afterglow:'],
  ['Never Stops Burning always',FXJ,"bs_9_1:[ {on:'kill',if:{window:'kxAg'},do:[{cd:'green',set:0}]} ],","bs_9_1:[ {on:'kill',do:[{cd:'green',set:0}]} ],",'Never Stops Burning'],
  // ---- Cratered, Comet Dash ----
  ['Cratered 5 s',FXJ,"A.setMark(T,u,t,'kxCr',{dur:4+(T.P['cr.dur']||0)}); },","A.setMark(T,u,t,'kxCr',{dur:5+(T.P['cr.dur']||0)}); },",'Cratered:'],
  ['Deep Crater 0.6 s',FXJ,"bs_2_4:[ {param:'cr.dur',add:R(0.5)} ],","bs_2_4:[ {param:'cr.dur',add:R(0.6)} ],",'Cratered:'],
  ['Cratered without a stun of the dash',FXJ,"if(!c.talent&&T.s.cur===DASH){","if(!c.talent){",'Second Stroke|Cratered:'],
  ['Distance Is No Armour 4%',FXJ,"bs_1_4:[ {on:'out',if:{casting:CLV,targetHas:'kxCr'},more:R(0.03)} ],","bs_1_4:[ {on:'out',if:{casting:CLV,targetHas:'kxCr'},more:R(0.04)} ],",'Cratered:'],
  ['Shaken Ground 6%',FXJ,"bs_6_4:[ {stat:{move:R(-0.05)},to:{team:'enemy',has:'kxCr'}} ],","bs_6_4:[ {stat:{move:R(-0.06)},to:{team:'enemy',has:'kxCr'}} ],",'Cratered:'],
  ['Craterside 2%',FXJ,"bs_9_4:[ {param:'dr.cs',add:R(0.015)} ],","bs_9_4:[ {param:'dr.cs',add:R(0.02)} ],",'Cratered:'],
  ['Stunned Crowd up to 4',FXJ,"per:{units:{team:'enemy',has:'kxCr'},max:3}} ],","per:{units:{team:'enemy',has:'kxCr'},max:4}} ],",'Cratered:'],
  ['Edge of the Crater 0.8%',FXJ,"bs_9_2:[ {param:'crit.ec',add:R(0.01)} ],","bs_9_2:[ {param:'crit.ec',add:R(0.008)} ],",'Cratered:'],
  ['Second Stroke 0.5 s',FXJ,"stroke(A,T,u,c){ tstun(A,T,u,[c.tgt],0.4,","stroke(A,T,u,c){ tstun(A,T,u,[c.tgt],0.5,",'Second Stroke'],
  ['stun lock removed',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'kxLk')) continue;","if((t.stunned||0)>0) continue;",'Second Stroke'],
  ['stun on a stunned enemy',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'kxLk')) continue;","if(A.markOf(u,t,'kxLk')) continue;",'Second Stroke'],
  ['stun lock 0.3 s',FXJ,"A.setMark(T,u,t,'kxLk',{dur:(t.stunned||0)+0.5,longest:true}); },","A.setMark(T,u,t,'kxLk',{dur:(t.stunned||0)+0.3,longest:true}); },",'Second Stroke'],
  ['Long Stride 4%',FXJ,"bs_2_3:[ {on:'out',if:{casting:DASHES},more:R(0.03)} ],","bs_2_3:[ {on:'out',if:{casting:DASHES},more:R(0.04)} ],",'Comet Dash:'],
  ['Brief Words only the slam',FXJ,"pp_10_2:[ {on:'out',if:{casting:DASHES},more:R(0.05)} ],","pp_10_2:[ {on:'out',if:{casting:DASH},more:R(0.05)} ],",'Comet Dash:'],
  ['Wider Landing 0.25 m',FXJ,"bs_4_3:[ {param:'dash.r',add:R(0.2)} ],","bs_4_3:[ {param:'dash.r',add:R(0.25)} ],",'Comet Dash:'],
  ['Staggering 0.05 s',FXJ,"bs_7_4:[ {param:'ext.st',add:R(0.04)} ],","bs_7_4:[ {param:'ext.st',add:R(0.05)} ],",'Comet Dash:'],
  ['Farthest Always on everyone',FXJ,"if(P['ext.aim']&&t===S(T).aim) ext+=P['ext.aim'];","if(P['ext.aim']) ext+=P['ext.aim'];",'Comet Dash:'],
  ['the 4 s ceiling 4.5 s',FXJ,"t.stunned=Math.min(4.0,Math.max(t.stunned||0,(c.amt||0)+ext));","t.stunned=Math.min(4.5,Math.max(t.stunned||0,(c.amt||0)+ext));",'Comet Dash:'],
  ['Dash Again 0.25 s',FXJ,"bs_6_3:[ {on:'cd',skill:'green',add:R(-0.2)} ],","bs_6_3:[ {on:'cd',skill:'green',add:R(-0.25)} ],",'Comet Dash:'],
  ['Bright Landing 2%',FXJ,"bs_6_1:[ {param:'crit.bl',add:R(0.025)} ],","bs_6_1:[ {param:'crit.bl',add:R(0.02)} ],",'Comet Dash:'],
  ['Bright Landing on every hit',FXJ,"if(P['crit.bl']&&T.s.cur===DASH) p+=P['crit.bl'];","if(P['crit.bl']) p+=P['crit.bl'];",'Comet Dash:'],
  ['Thought It Safe: any row',FXJ,"for(const x of foes(A,u)) if(back(x)&&(!b||x.hp<b.hp)) b=x;","for(const x of foes(A,u)) if((!b||x.hp<b.hp)) b=x;",'Thought It Safe'],
  ['Thought It Safe: the highest HP',FXJ,"for(const x of foes(A,u)) if(back(x)&&(!b||x.hp<b.hp)) b=x;","for(const x of foes(A,u)) if(back(x)&&(!b||x.hp>b.hp)) b=x;",'Thought It Safe'],
  ['Nowhere Safe 5 s',FXJ,"if(P['ns.k']) A.setMark(T,u,b,'kxNs',{dur:4});","if(P['ns.k']) A.setMark(T,u,b,'kxNs',{dur:5});",'Thought It Safe'],
  ['Nowhere Safe 5%',FXJ,"bs_6_2:[ {param:'ns.k',add:R(0.04)} ],","bs_6_2:[ {param:'ns.k',add:R(0.05)} ],",'Thought It Safe'],
  ['Through the Field 50%',FXJ,"bs_11_3:[ {param:'dash.path',add:0.4} ],","bs_11_3:[ {param:'dash.path',add:0.5} ],",'Through the Field'],
  ['Scorched Path no mark',FXJ,"T.fn.crater(A,T,u,t); A.setMark(T,u,t,'kxCp',{dur:4+(T.P['cr.dur']||0)}); },","T.fn.crater(A,T,u,t); },",'Through the Field'],
  ['Scorched Path 2%',FXJ,"{on:'out',if:{casting:DASHES,targetHas:'kxCp'},more:R(0.01)} ],","{on:'out',if:{casting:DASHES,targetHas:'kxCp'},more:R(0.02)} ],",'Through the Field'],
  ['Called Down every 20 s',FXJ,"if(b){ o.cdT=now+25; o.cd2={t:b,left:2}; o.aim1","if(b){ o.cdT=now+20; o.cd2={t:b,left:2}; o.aim1",'Called Down'],
  ['Called Down line stun 0.6 s',FXJ,"tstun(A,T,u,line,0.5,'cd'+now); } }","tstun(A,T,u,line,0.6,'cd'+now); } }",'Called Down'],
  ['Called Down no line',FXJ,"const line=foes(A,u).filter(x=>x!==o.aim1&&x!==o.aim&&T.fn.onSeg(A,x,L1,here));","const line=[];",'Called Down'],
  ['Called Down Afterglow 6 s',FXJ,"dur:eight?8:4+(P['ag.dur']||0),longest:true}],c);","dur:eight?6:4+(P['ag.dur']||0),longest:true}],c);",'Called Down'],
  ['Called Down: the first landing does not Crater its hits',FXJ,"if(b){ o.cdT=now+25; o.cd2={t:b,left:2}; o.aim1=first; eight=true; for(const x of (o.sh||[])) T.fn.crater(A,T,u,x); } }","if(b){ o.cdT=now+25; o.cd2={t:b,left:2}; o.aim1=first; eight=true; } }",'Called Down'],
  ['Called Down: back to the first target',FXJ,"for(const x of foes(A,u)){ if(x===first) continue; const d=Math.hypot(x.x-from.x,x.y-from.y);","for(const x of foes(A,u)){ const d=Math.hypot(x.x-from.x,x.y-from.y);",'Called Down'],
  // ---- Ember Cleave ----
  ['Wide Stroke 0.25 m',FXJ,"bs_4_2:[ {on:'kit',skill:CLV,opt:{radius:{addM:R(0.2)}}} ],","bs_4_2:[ {on:'kit',skill:CLV,opt:{radius:{addM:R(0.25)}}} ],",'Ember Cleave:'],
  ['Cleave Through 6%',FXJ,"pp_4_2:[ {on:'out',if:{casting:CLV},more:R(0.05)} ],","pp_4_2:[ {on:'out',if:{casting:CLV},more:R(0.06)} ],",'Ember Cleave:'],
  ['Ember Rhythm 0.2 s',FXJ,"bs_11_2:[ {on:'cd',skill:'blue',add:R(-0.15)} ],","bs_11_2:[ {on:'cd',skill:'blue',add:R(-0.2)} ],",'Ember Cleave:'],
  ['Ember Patience on the green',FXJ,"pp_12_2:[ {on:'cd',skill:'blue',add:R(-0.3)} ],","pp_12_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],",'Ember Cleave:'],
  // ---- Falling Star ----
  ['Glowing Axe 5%',FXJ,"rh_12_3:[ {param:'star.k1',add:R(0.04)} ],","rh_12_3:[ {param:'star.k1',add:R(0.05)} ],",'Falling Star:'],
  ['Long Burn 4%',FXJ,"pp_6_3:[ {param:'star.burn',add:R(0.03)} ],","pp_6_3:[ {param:'star.burn',add:R(0.04)} ],",'Falling Star:'],
  ['a Piece 3%',FXJ,"pp_1_4:[ {param:'pc.k',add:R(0.02)} ],","pp_1_4:[ {param:'pc.k',add:R(0.03)} ],",'Falling Star:'],
  ['Crater Edge 0.25 m',FXJ,"pp_7_1:[ {param:'star.r',add:R(0.2)} ],","pp_7_1:[ {param:'star.r',add:R(0.25)} ],",'Falling Star:'],
  ['Lingering Fire 0.4 s',FXJ,"pp_10_3:[ {param:'star.dur',add:R(0.3)} ],","pp_10_3:[ {param:'star.dur',add:R(0.4)} ],",'Falling Star:'],
  ['Installment at 6 Pieces',FXJ,"if(P['star.inst']&&A.stGet(T,'kxPc')>=7){ r+=2*M; d+=3; }","if(P['star.inst']&&A.stGet(T,'kxPc')>=6){ r+=2*M; d+=3; }",'Falling Star:'],
  ['Installment 3 m',FXJ,"if(P['star.inst']&&A.stGet(T,'kxPc')>=7){ r+=2*M; d+=3; }","if(P['star.inst']&&A.stGet(T,'kxPc')>=7){ r+=3*M; d+=3; }",'Falling Star:'],
  ['Look Up 3%',FXJ,"pp_8_3:[ {param:'lu.k',add:R(0.02)} ],","pp_8_3:[ {param:'lu.k',add:R(0.03)} ],",'in the crater'],
  ['Stay in the Crater 35%',FXJ,"pp_9_3:[ {param:'fs.slow',add:0.30} ],","pp_9_3:[ {param:'fs.slow',add:0.35} ],",'in the crater'],
  ['Scaled Back 4%',FXJ,"pp_9_2:[ {stat:{armor:R(0.03)},if:{fn:'meInCrater'}} ],","pp_9_2:[ {stat:{armor:R(0.04)},if:{fn:'meInCrater'}} ],",'in the crater'],
  ['in the crater: everywhere',FXJ,"if(Math.hypot(x.x-h.x,x.y-h.y)<=h.r) return true; }","return true; }",'in the crater'],
  ['Small Violet Star over the cap',FXJ,"const p=Math.min(P['crit.sv'],Math.max(0,CRIT_CAP-T.fn.critS(A,T))); if(p>0&&A.eng().rnd()<p)","const p=P['crit.sv']*1.2; if(p>0&&A.eng().rnd()<p)",'in the crater'],
  // ---- Witnessed ----
  ['Witnessed within 9 m',FXJ,"const L=A.pick(T,u,{team:'enemy',of:'pt',within:10},c)","const L=A.pick(T,u,{team:'enemy',of:'pt',within:9},c)",'Witnessed:'],
  ['Witnessed 7 s',FXJ,"A.setMark(T,u,x,'kxWi',{dur:6+(P['wit.dur']||0),longest:true});","A.setMark(T,u,x,'kxWi',{dur:7+(P['wit.dur']||0),longest:true});",'Witnessed:'],
  ['Never Forgotten 1.2 s',FXJ,"pp_2_3:[ {param:'wit.dur',add:R(1)} ],","pp_2_3:[ {param:'wit.dur',add:R(1.2)} ],",'Witnessed:'],
  ['Stop Arguing 2% on allies',FXJ,"{on:'teamIn',if:{srcHas:'kxWi',srcTeam:'enemy'},less:R(0.01)} ],","{on:'teamIn',if:{srcHas:'kxWi',srcTeam:'enemy'},less:R(0.02)} ],",'Witnessed:'],
  ['Stop Arguing 2% on him',FXJ,"pp_1_3:[ {param:'dr.wi',add:R(0.01)},","pp_1_3:[ {param:'dr.wi',add:R(0.02)},",'Witnessed:'],
  ['Lasting Awe 4%',FXJ,"pp_4_3:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'kxWi'}} ],","pp_4_3:[ {stat:{aspd:R(-0.04)},to:{team:'enemy',has:'kxWi'}} ],",'Witnessed:'],
  ['Sunburn 6%',FXJ,"pp_12_1:[ {on:'teamHeal',if:{unitHas:'kxWi'},less:R(0.05)} ],","pp_12_1:[ {on:'teamHeal',if:{unitHas:'kxWi'},less:R(0.06)} ],",'Witnessed:'],
  ['Witness Marks 0.8%',FXJ,"pp_9_1:[ {param:'crit.wm',add:R(0.01)} ],","pp_9_1:[ {param:'crit.wm',add:R(0.008)} ],",'Witnessed:'],
  ['Prefers the Second 0.6 s',FXJ,"pp_5_3:[ {param:'wit.fear',add:0.5} ],","pp_5_3:[ {param:'wit.fear',add:0.6} ],",'Prefers the Second'],
  ['fear from nobody',FXJ,"if((x.fearT||0)>0) x._fearFrom=u; } }","} }",'Prefers the Second'],
  ['Never Confirmed 12%',FXJ,"pp_5_2:[ {param:'nc.k',add:0.10} ],","pp_5_2:[ {param:'nc.k',add:0.12} ],",'Prefers the Second'],
  ['Nobody Argues 3 points',FXJ,"pp_6_2:[ {param:'nc.k',add:R(0.02)} ],","pp_6_2:[ {param:'nc.k',add:R(0.03)} ],",'Prefers the Second'],
  ['damage from Korvux not on Emberskin',FXJ,"if(A.winOn(T,'kxWh')) k*=2;\n      k*=T.fn.dk(A,T,u,e);","if(A.winOn(T,'kxWh')) k*=2;",'Prefers the Second'],
  // ---- Pieces ----
  ['Pieces within 5 m',FXJ,"if(PC.some(id=>T.r[id])&&A.gap(u,x)<6*E.METER())","if(PC.some(id=>T.r[id])&&A.gap(u,x)<5*E.METER())",'Pieces:'],
  ['Pieces max 8',FXJ,"kxPc:{max:7},","kxPc:{max:8},",'Pieces:'],
  ['Pieces of Sky 2 a rank',FXJ,"pp_10_4:[ {on:'wave',once:'fight',do:[{stack:'kxPc',add:R(1)}]} ],","pp_10_4:[ {on:'wave',once:'fight',do:[{stack:'kxPc',add:R(2)}]} ],",'Pieces:'],
  ['Pieces of Sky each wave',FXJ,"pp_10_4:[ {on:'wave',once:'fight',do:","pp_10_4:[ {on:'wave',do:",'Pieces:'],
  ['Paid Ahead 3',FXJ,"const n=(P['pc.ahead']&&A.winOn(T,'kxPa'))?2:1;","const n=(P['pc.ahead']&&A.winOn(T,'kxPa'))?3:1;",'Pieces:'],
  ['Paid Ahead 4 s',FXJ,"if(P['pc.ahead']) A.acts(T,u,[{window:'kxPa',dur:3}],c); },","if(P['pc.ahead']) A.acts(T,u,[{window:'kxPa',dur:4}],c); },",'Pieces:'],
  ['Wartime 0.5%',FXJ,"pp_2_4:[ {stat:{atk:R(0.004)},per:'kxPc'} ],","pp_2_4:[ {stat:{atk:R(0.005)},per:'kxPc'} ],",'Pieces:'],
  ['Heavens Owe 0.3%',FXJ,"pp_11_3:[ {stat:{lifesteal:R(0.002)},per:'kxPc'} ],","pp_11_3:[ {stat:{lifesteal:R(0.003)},per:'kxPc'} ],",'Pieces:'],
  ['Steaming Hide at 2',FXJ,"pp_5_4:[ {stat:{mr:R(0.02)},if:{stackMin:{kxPc:3}}} ],","pp_5_4:[ {stat:{mr:R(0.02)},if:{stackMin:{kxPc:2}}} ],",'Pieces:'],
  ['Paying Out at 6',FXJ,"if(P['po.k']&&A.stGet(T,'kxPc')>=7) k*=1+P['po.k'];","if(P['po.k']&&A.stGet(T,'kxPc')>=6) k*=1+P['po.k'];",'Pieces:'],
  // ---- Kellsmarch ----
  ['Kellsmarch every 25 s',FXJ,"o.kT=now+30; o.k2={left:2,","o.kT=now+25; o.k2={left:2,",'What Came Down'],
  ['Kellsmarch at 6 Pieces',FXJ,"if(P['sig.star']&&A.stGet(T,'kxPc')>=7&&","if(P['sig.star']&&A.stGet(T,'kxPc')>=6&&",'What Came Down'],
  ['Kellsmarch x1.5 size',FXJ,"if(o.k2On) r*=2; op.radius=r;","if(o.k2On) r*=1.5; op.radius=r;",'What Came Down'],
  ['Kellsmarch fear 0.8 s',FXJ,"const f=sec?1:(P['wit.fear']||0);","const f=sec?0.8:(P['wit.fear']||0);",'What Came Down'],
  ['Kellsmarch keeps the Pieces',FXJ,"if(sec){ A.stSet(T,u,'kxPc',0); return; }","if(sec){ return; }",'What Came Down'],
  // ---- the caps ----
  ['damage-reduction cap 35%',FXJ,"DR_FLOOR=0.70, CRIT_CAP","DR_FLOOR=0.65, CRIT_CAP",'the caps'],
  ['damage reduction not on damage over time',FXJ,"{on:'in',reqAny:DRG,do:[{fn:'myDr'}]}, {on:'dotIn',reqAny:DRG,do:[{fn:'myDr'}]},","{on:'in',reqAny:DRG,do:[{fn:'myDr'}]},",'the caps'],
  ['Hard Scales 1.2%',FXJ,"rh_9_3:[ {param:'dr.hs',add:R(0.01)} ],","rh_9_3:[ {param:'dr.hs',add:R(0.012)} ],",'the caps'],
  ['crit cap 6%',FXJ,"DR_FLOOR=0.70, CRIT_CAP=0.05,","DR_FLOOR=0.70, CRIT_CAP=0.06,",'the caps|Cratered:'],
  ['Violet Blood 0.8%',FXJ,"pp_1_1:[ {param:'crit.vb',add:R(0.01)} ],","pp_1_1:[ {param:'crit.vb',add:R(0.008)} ],",'the caps'],
  ['slow cap 45%',FXJ,"SLOW_CAP=0.40, REGEN=0.012;","SLOW_CAP=0.45, REGEN=0.012;",'the caps'],
  ['Unbothered 5%',FXJ,"rh_4_1:[ {on:'ccIn',less:R(0.04)} ],","rh_4_1:[ {on:'ccIn',less:R(0.05)} ],",'the caps'],
  ['ignore armour lost',FXJ,"rh_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],","rh_3_3:[ ],",'the caps'],
  ['Hot Stride 4%',FXJ,"rh_5_4:[ {stat:{move:R(0.03)}} ],","rh_5_4:[ {stat:{move:R(0.04)}} ],",'the caps'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ const walk=(s,d)=>{ fs.mkdirSync(d,{recursive:true}); for(const n of fs.readdirSync(s)){ const a=path.join(s,n), b=path.join(d,n), r=path.relative(root,a);
    if(SKIP.has(r.split(path.sep)[0])||/^\.ctl-|^\.remote-|^\.test-/.test(n)) continue; const st=fs.lstatSync(a); if(st.isDirectory()) walk(a,b); else if(st.isFile()) fs.copyFileSync(a,b); } };
  walk(root,dir); for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-kxc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>to.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n')));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-korvux.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0&&!!pm,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
/* first the copy unbroken: every test must pass there, or a control that "fails" proves nothing */
{ const b=runOne(['(unbroken)',HTML,'<html','<html','.']); if(!/^fail 0, pass [1-9]/.test(b.why)){ console.log('BASELINE BROKEN: '+b.why); process.exit(1); } console.log('baseline: '+b.why); }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
