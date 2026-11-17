'use strict';
/* The controls for Nox's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-nox.test.js). Each control copies this checkout to a temp folder (os.tmpdir(): the runner's own temp folder on disk), breaks ONE thing there
   (an exact text swap in emberweave-heroes.html, in the generated talents-fx.js or in its runtime: a page hook removed, a guarded site given an unguarded seeded
   draw, a row or a number of his changed), runs the named tests of tests/talents-mech-nox.test.js in that copy, and expects them to FAIL. ONE copy at a time (no
   parallel child processes); each copy is deleted as soon as its run is done; .logs, .remote-logs, .tmp and node_modules are never copied (node_modules is linked).
   The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   Run: node tests/nox-controls.js   (ONLY='name|name' runs some of them) */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', ID='no talents';
const EV="if(tgt._tal&&tgt._tal.on.evaded) TalentFx.evaded(tgt,src,_isAuto,kind);";
const FKS="if(u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,type,best,o)||best;";
const UH=" && !((u._talUltT||0)>battleTime)){const auto";
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['Evasion miss hook removed',HTML,EV,'','Whiskers: By|Missed Again'],
  ['Forbidden Key receiver hook removed',HTML,FKS,'','A Friend on the Inside|Covering Hand'],
  ['Ultimate hold removed',HTML,UH,'){const auto','Hooked Soul'],
  ['evaded runtime does nothing',FXJ,"function evaded(t,s,auto,kind){ const T=t._tal; if(T.on.evaded)","function evaded(t,s,auto,kind){ const T=t._tal; if(false)",'Whiskers: By'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the Evasion miss',HTML,EV,'brnd(); '+EV,ID],
  ['draw at Forbidden Key\'s receiver',HTML,FKS,'brnd(); '+FKS,ID],
  ['draw at the Ultimate hold',HTML,UH," && !((u._talUltT||0)>battleTime) && (brnd()>=0)){const auto",ID],
  // ---- his kit as the rows read it ----
  ['Forbidden Key always to the Accomplice: never',FXJ,"else if(a&&rk(T,'fe_1_1')) c.tgt=a;","",'A Friend on the Inside'],
  ['A Friend on the Inside 3 points',FXJ,"fe_1_1:[ {param:'acc.ult',add:R(0.02)} ]","fe_1_1:[ {param:'acc.ult',add:R(0.03)} ]",'A Friend on the Inside'],
  ['the Accomplice by attack only',FXJ,"const v=Math.max(+x.dmg||0,+x.apow||0); if(v>bv)","const v=+x.apow||0; if(v>bv)",'A Friend on the Inside'],
  ['Trusted Hand 3%',FXJ,"{param:'dr.th',add:R(0.02)}","{param:'dr.th',add:R(0.03)}",'A Friend on the Inside'],
  ['Inside Job on anyone',FXJ,"if(Pp.ij&&s===accOf(T,u)) c.amt*=1+Pp.ij;","if(Pp.ij) c.amt*=1+Pp.ij;",'A Friend on the Inside'],
  ['Old Debts 6',FXJ,"{param:'od',add:R(5)}","{param:'od',add:R(6)}",'A Friend on the Inside'],
  ['Deft always',FXJ,"fe_12_3:[ {stat:{aspd:R(0.03)},if:{fn:'accAlive'}} ]","fe_12_3:[ {stat:{aspd:R(0.03)}} ]",'A Friend on the Inside'],
  ['Partners: no key',FXJ,"if(Pp['pt.key']&&u.pass&&u.pass.skeletonkey) u._keys=","if(false) u._keys=",'Sooner and Larger'],
  ['Lookout 1.2%',FXJ,"{param:'lko',add:R(0.01)}","{param:'lko',add:R(0.012)}",'Sooner and Larger'],
  ['Sooner and Larger up to 12',FXJ,"    sl:{max:10,wave:'reset'},","    sl:{max:12,wave:'reset'},",'Sooner and Larger'],
  ['Sooner and Larger kept between waves',FXJ,"    sl:{max:10,wave:'reset'},","    sl:{max:10},",'Sooner and Larger'],
  ['Old Partners 4%',FXJ,"{param:'op',add:R(0.03)}","{param:'op',add:R(0.04)}",'Sooner and Larger'],
  ['an ally Ultimate never seen',FXJ,"if(x.team===u.team){ if(!x._summon) T.fn.allyUlt(A,T,u,x); }","if(x.team===u.team){ }",'Sooner and Larger'],
  // ---- Hot Goods ----
  ['Hot Goods 2.5 s',FXJ,"{window:'hot',dur:3+(T.P['hot.dur']||0)}","{window:'hot',dur:2.5+(T.P['hot.dur']||0)}",'Hot Goods'],
  ['Still Warm 6%',FXJ,"{param:'hot.k',add:R(0.05)}","{param:'hot.k',add:R(0.06)}",'Hot Goods'],
  ['Straight to Them at any time',FXJ,"E.now()-o.stoleAt<=1+1e-9","E.now()-o.stoleAt<=99",'Hot Goods'],
  ['Hand-Off 2%',FXJ,"{param:'ho',add:R(0.01)}","{param:'ho',add:R(0.02)}",'Hot Goods'],
  ['Light Load 3%',FXJ,"{param:'dr.ll',add:R(0.02)}","{param:'dr.ll',add:R(0.03)}",'Hot Goods'],
  ['Fair Price 3%',FXJ,"critMore:R(0.02)} ],                                     // Fair Price","critMore:R(0.03)} ],                                     // Fair Price",'Hot Goods'],
  ['Quick Turnaround 0.3 s',FXJ,"{param:'hot.dur',add:R(0.2)}","{param:'hot.dur',add:R(0.3)}",'Hot Goods'],
  // ---- Spread / One Buyer ----
  ['Spread 25% more',FXJ,"const sh=give*1.2/(b?2:1);","const sh=give*1.25/(b?2:1);",'Spread It Around'],
  ['Spread: no second ally',FXJ,"if(b){ gainE(b,sh); L.push(b); }","",'Spread It Around'],
  ['Fair Shares 4%',FXJ,"{param:'dr.fs',add:R(0.03)}","{param:'dr.fs',add:R(0.04)}",'Spread It Around'],
  ['Fair Shares 4 s',FXJ,"for(const x of L) A.setMark(T,u,x,'fs',{dur:3});","for(const x of L) A.setMark(T,u,x,'fs',{dur:4});",'Spread It Around'],
  ['One Buyer 50%',FXJ,"opt:{give:{mul:1.4},perLv:{mul:1.4},perKey:{mul:1.4}}","opt:{give:{mul:1.5},perLv:{mul:1.4},perKey:{mul:1.4}}",'Spread It Around'],
  ['Sole Buyer 5 s',FXJ,"A.setMark(T,u,Rv,'sb4',{dur:4});","A.setMark(T,u,Rv,'sb4',{dur:5});",'Spread It Around'],
  // ---- the Fence, the rest ----
  ['Fast Fence 2',FXJ,"fe_2_2:[ {on:'kit',skill:FK,opt:{give:{add:R(1)}}} ]","fe_2_2:[ {on:'kit',skill:FK,opt:{give:{add:R(2)}}} ]",'Fast Fence'],
  ['Generous multiplies',FXJ,"opt:{ultMul:{add:R(0.02)},muUltMul:{add:R(0.02)}}","opt:{ultMul:{bonus:R(0.02)},muUltMul:{add:R(0.02)}}",'Fast Fence'],
  ['Fence\'s Cut 2',FXJ,"{param:'fc',add:R(1)}","{param:'fc',add:R(2)}",'Fast Fence'],
  ['Courier up to 6',FXJ,"    cou:{max:5,wave:'reset'},","    cou:{max:6,wave:'reset'},",'Fast Fence'],
  ['Courier kept between waves',FXJ,"    cou:{max:5,wave:'reset'},","    cou:{max:5},",'Fast Fence'],
  ['Forbidden Edge 0.2 s',FXJ,"fe_7_3:[ {on:'cd',skill:'blue',add:R(-0.1)} ]","fe_7_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ]",'Fast Fence'],
  ['Lookout\'s Eye every hit',FXJ,"if(le[s.uid]!==T.s.wave){ if(!c.probe) le[s.uid]=T.s.wave; f(Pp['dr.le']); }","f(Pp['dr.le']);",'Never Trusted'],
  ['Never Trusted 3%',FXJ,"{param:'dr.nt',add:R(0.02)}","{param:'dr.nt',add:R(0.03)}",'Never Trusted'],
  ['Clever Hands on anyone',FXJ,"if(r.fe_11_3&&A.markOf(u,t,'rb')) x+=0.02*r.fe_11_3;","if(r.fe_11_3) x+=0.02*r.fe_11_3;",'Never Trusted'],
  ['the crit group at 6%',FXJ,"TEAM_FLOOR=0.75, CRIT_CAP=0.05,","TEAM_FLOOR=0.75, CRIT_CAP=0.06,",'Never Trusted|his caps'],
  ['Covering Hand every time',FXJ,"if(low&&!o.picWas&&o.picW!==T.s.wave){","if(low&&!o.picWas){",'Covering Hand'],
  ['Covering Hand at 35%',FXJ,"low=!!a&&a.hp<0.30*a.maxHp;","low=!!a&&a.hp<0.35*a.maxHp;",'Covering Hand'],
  ['Moment of Glory ignored',FXJ,"    fe_11_2:[ {param:'mog',add:1} ],","    fe_11_2:[ {param:'mog0',add:1} ],",'Covering Hand'],
  ['the signature every 15 s',FXJ,"SIG_CD=20,","SIG_CD=15,",'Everyone|Taken Just Before'],
  ['the signature: no Energy to the others',FXJ,"for(const y of allies(A,u)) if(y!==x) gainE(y,20);","",'Everyone'],
  ['the signature at x1.4',FXJ,"const mul=((u.blueAb&&u.blueAb.muUltMul)||1.5)+","const mul=1.4+",'Everyone'],
  // ---- Lockpick Soul ----
  ['Fresh Haul 2',FXJ,"fe_7_4:[ {on:'kit',skill:LP,opt:{steal:{add:R(1)}}} ]","fe_7_4:[ {on:'kit',skill:LP,opt:{steal:{add:R(2)}}} ]",'Lockpick Soul: Fresh'],
  ['Empty Them 50%',FXJ,"jb_5_2:[ {on:'kit',skill:LP,opt:{steal:{mul:1.4}}}","jb_5_2:[ {on:'kit',skill:LP,opt:{steal:{mul:1.5}}}",'Lockpick Soul: Fresh'],
  ['Empty Them keeps the key',FXJ,"if(Pp.et&&h&&(e0.get(h)||0)<RIPE) u._keys=Math.max(0,(u._keys||0)-1);","",'Lockpick Soul: Fresh'],
  ['Breath Before the Swing 3',FXJ,"{param:'bbs',add:R(2)}","{param:'bbs',add:R(3)}",'Lockpick Soul: Fresh'],
  ['Prime Pickings 6%',FXJ,"{param:'pp',add:R(0.05)}","{param:'pp',add:R(0.06)}",'Lockpick Soul: Fresh'],
  ['Easy Mark 4 s',FXJ,"A.setMark(T,u,h,'em',{dur:3});","A.setMark(T,u,h,'em',{dur:4});",'Lockpick Soul: Fresh'],
  ['Pick and Pocket 1.2%',FXJ,"{param:'pnp',add:R(0.01)}","{param:'pnp',add:R(0.012)}",'Lockpick Soul: Fresh'],
  ['Leave a Little 30% slower',FXJ,"else if(A.markOf(u,x,'ll')) k=0.75;","else if(A.markOf(u,x,'ll')) k=0.70;",'Lockpick Soul: Fresh'],
  ['Slow Refill 1.5 s',FXJ,"jb_6_3:[ {param:'ll.dur',add:R(1)} ]","jb_6_3:[ {param:'ll.dur',add:R(1.5)} ]",'Lockpick Soul: Fresh'],
  ['Bare Shelves below 25',FXJ,"if(Pp.et&&Pp['dr.bs']&&(x.energy||0)<20)","if(Pp.et&&Pp['dr.bs']&&(x.energy||0)<25)",'Bare Shelves'],
  ['Bare Shelves 4 s',FXJ,"A.setMark(T,u,x,'bs',{dur:3});","A.setMark(T,u,x,'bs',{dur:4});",'Bare Shelves'],
  ['Nerve Gone 2%',FXJ,"{param:'dr.ng',add:R(0.01)}","{param:'dr.ng',add:R(0.02)}",'Bare Shelves'],
  ['Cheap Coat 2%',FXJ,"{param:'dr.cc',add:R(0.015)}","{param:'dr.cc',add:R(0.02)}",'Bare Shelves'],
  ['Spoiled 5%',FXJ,"{param:'spl',add:R(0.04)}","{param:'spl',add:R(0.05)}",'Bare Shelves'],
  ['Ripe at 69',FXJ,"const RIPE=70,","const RIPE=69,",'Ripe: Saving'],
  ['Saving It Up 3%',FXJ,"jb_1_1:[ {on:'out',if:{targetTeam:'enemy',targetMin:{energy:RIPE}},more:R(0.02)} ]","jb_1_1:[ {on:'out',if:{targetTeam:'enemy',targetMin:{energy:RIPE}},more:R(0.03)} ]",'Ripe: Saving'],
  ['Ripe Fruit up to 5',FXJ,"Math.min(4,n); },","Math.min(5,n); },",'Ripe: Saving'],
  ['Casing the Job every tick',FXJ,"if(ripe(x)&&cs[x.uid]!==T.s.wave){","if(ripe(x)){",'Ripe: Saving'],
  ['Turning the Key at 45%',FXJ,"jb_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.40},","jb_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.45},",'Ripe: Saving'],
  // ---- Tumblers ----
  ['a click at 6',FXJ,"tb.n=Math.min(5,tb.n+1); if(tb.n>=5){","tb.n=Math.min(6,tb.n+1); if(tb.n>=6){",'Tumblers: Feeling'],
  ['Feeling the Pins 5',FXJ,"{param:'tb.k',add:R(4)}","{param:'tb.k',add:R(5)}",'Tumblers: Feeling'],
  ['a switch keeps them',FXJ,"tb=o.tb={t,n}; }","tb=o.tb={t,n:tb?tb.n:n}; }",'Tumblers: Feeling'],
  ['Light Touch 0.5 s',FXJ,"{param:'tb.grace',add:R(0.4)}","{param:'tb.grace',add:R(0.5)}",'Tumblers: Feeling'],
  ['Clicked 12%',FXJ,"{param:'clk',add:R(0.10)}","{param:'clk',add:R(0.12)}",'Tumblers: Feeling'],
  ['Tumbler Song kept between waves',FXJ,"    ts:{max:10,wave:'reset'},","    ts:{max:10},",'Tumblers: Feeling'],
  ['Practised Ear 2%',FXJ,"jb_7_4:[ {stat:{aspd:R(0.01)},per:{fn:'tbNow'}} ]","jb_7_4:[ {stat:{aspd:R(0.02)},per:{fn:'tbNow'}} ]",'Tumblers: Feeling'],
  ['Gap in the Guard at 2',FXJ,"return !!tb&&tb.t===c.tgt&&tb.n>=3; },","return !!tb&&tb.t===c.tgt&&tb.n>=2; },",'Gap in the Guard'],
  ['Sharp Ears on any enemy',FXJ,"if(r.jb_11_3&&tb&&tb.t===t&&tb.n>0)","if(r.jb_11_3)",'Gap in the Guard'],
  ['Spring the Lock every click',FXJ,"if(Pp.stl&&pre>=RIPE&&o.stlW!==T.s.wave){","if(Pp.stl&&pre>=RIPE){",'Gap in the Guard'],
  ['Spring the Lock: two Spare Keys',FXJ,"if(rk(T,'lf_1_4')&&!o.spare&&u.pass","if(rk(T,'lf_1_4')&&u.pass",'Gap in the Guard'],
  ['Click and Click never',FXJ,"      if(Pp.cc2) o.cc2=true; },","      },",'Gap in the Guard'],
  ['Second Breath 2',FXJ,"{param:'sbr',add:R(1)}","{param:'sbr',add:R(2)}",'Second Breath'],
  ['Stolen Moment 3 s',FXJ,"jb_9_1:[ {param:'smo',add:2} ]","jb_9_1:[ {param:'smo',add:3} ]",'Second Breath'],
  ['Nothing Left 0.6%',FXJ,"jb_12_2:[ {stat:{atk:R(0.005)},per:'nl'} ]","jb_12_2:[ {stat:{atk:R(0.006)},per:'nl'} ]",'Second Breath'],
  ['Spare Breath on skills too',FXJ,"if(c.auto){ if(Pp['nrg.hit']) gainE(u,11*Pp['nrg.hit']);","if(Pp['nrg.hit']) gainE(u,11*Pp['nrg.hit']); if(c.auto){",'Second Breath'],
  ['Lucky Break 4%',FXJ,"{param:'nrg.crit',add:R(0.03)}","{param:'nrg.crit',add:R(0.04)}",'Second Breath'],
  ['Hooked Soul 4%',FXJ,"jb_2_2:[ {on:'out',if:{casting:LP,targetTeam:'enemy'},more:R(0.03)} ]","jb_2_2:[ {on:'out',if:{casting:LP,targetTeam:'enemy'},more:R(0.04)} ]",'Hooked Soul'],
  ['Quick Pick 0.2 s',FXJ,"jb_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ]","jb_8_2:[ {on:'cd',skill:'green',add:R(-0.2)} ]",'Hooked Soul'],
  ['Deep Pocket 0.3 s',FXJ,"{param:'sil.add',add:R(0.2)}","{param:'sil.add',add:R(0.3)}",'Hooked Soul'],
  ['Just in Time never released',FXJ,"for(const x of E.units()) if(x._talUltBy===u&&(x===h||!x.alive)){ x._talUltT=0; x._talUltBy=null; } },","},",'Hooked Soul'],
  ['Long Lock 0.1 s',FXJ,"{param:'lock.add',add:R(0.05)}","{param:'lock.add',add:R(0.1)}",'Open Every Door: Long'],
  ['Double Lock on everyone',FXJ,"if(o.oRipe&&o.oRipe.has(t)) add+=","add+=",'Open Every Door: Long'],
  ['the extensions cut at 1.5 s',FXJ,"CC_TOP=4.0,","CC_TOP=1.5,",'Open Every Door: Long'],
  ['Locked Out 4 s',FXJ,"jb_11_2:[ {param:'lo',add:3} ]","jb_11_2:[ {param:'lo',add:4} ]",'Open Every Door: Long'],
  ['Every Door 4%',FXJ,"jb_7_3:[ {on:'out',if:{casting:OED,targetTeam:'enemy'},more:R(0.03)} ]","jb_7_3:[ {on:'out',if:{casting:OED,targetTeam:'enemy'},more:R(0.04)} ]",'Open Every Door: Long'],
  ['Before They Use It 11',FXJ,"{param:'btu',add:R(10)}","{param:'btu',add:R(11)}",'Before They Use It'],
  ['Long Quill 4%',FXJ,"jb_n3:[  {param:'rng',add:R(0.03)} ]","jb_n3:[  {param:'rng',add:R(0.04)} ]",'Before They Use It'],
  ['Silver Tongue 3%',FXJ,"fe_9_3:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},ignoreMr:R(0.02)} ]","fe_9_3:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},ignoreMr:R(0.03)} ]",'Before They Use It'],
  ['Not Today up to 25%',FXJ,"lf_5_1:[ {on:'ccIn',less:R(0.04),upTo:0.20} ]","lf_5_1:[ {on:'ccIn',less:R(0.05),upTo:0.25} ]",'Before They Use It'],
  ['Taken Just Before: held 1.5 s',FXJ,"p.t+=2; A.setMark","p.t+=1.5; A.setMark",'Taken Just Before'],
  ['Taken Just Before: Master-Unlocked',FXJ,"if(o.noMu&&pass&&(u._keys||0)>=5){","if(false){",'Taken Just Before'],
  ['Taken Just Before: 25% weaker',FXJ,"ULT_WEAK=0.30;","ULT_WEAK=0.25;",'Taken Just Before'],
  ['Taken Just Before: weaker for 2 s after',FXJ,"A.setMark(T,u,x,'tjb',{dur:1.5}); o.tjX=null;","A.setMark(T,u,x,'tjb',{dur:2}); o.tjX=null;",'Taken Just Before'],
  ['Taken Just Before: basic attacks too',FXJ,"if(Pp.tjb&&!c.auto&&A.markOf(u,s,'tjb')) k*=1-ULT_WEAK; c.amt*=k;","if(Pp.tjb&&A.markOf(u,s,'tjb')) k*=1-ULT_WEAK; c.amt*=k;",'Taken Just Before'],
  // ---- Luck ----
  ['By a Whisker 4%',FXJ,"{param:'wk.k',add:R(0.03)}","{param:'wk.k',add:R(0.04)}",'Whiskers: By'],
  ['Whiskers up to 4',FXJ,"    wk:{max:3,dur:P('wk.dur',6)},","    wk:{max:4,dur:P('wk.dur',6)},",'Whiskers: By'],
  ['Whiskers last 7 s',FXJ,"    wk:{max:3,dur:P('wk.dur',6)},","    wk:{max:3,dur:P('wk.dur',7)},",'Whiskers: By'],
  ['Whiskers never spent',FXJ,"A.stSet(T,u,'wk',0); if(Pp.fl)","if(Pp.fl)",'Whiskers: By'],
  ['Close Shave 3 s',FXJ,"    cs:{max:3,dur:2},","    cs:{max:3,dur:3},",'Whiskers: By'],
  ['Fox Coat 2%',FXJ,"{param:'dr.fc',add:R(0.015)}","{param:'dr.fc',add:R(0.02)}",'Whiskers: By'],
  ['Fox\'s Luck 0.6%',FXJ,"{param:'fl',add:R(0.005)}","{param:'fl',add:R(0.006)}",'Whiskers: By'],
  ['Missed Again at 2',FXJ,"wk3(A,T,u,c){ return wkN(T)>=3&&","wk3(A,T,u,c){ return wkN(T)>=2&&",'Missed Again'],
  ['Glint 4 s',FXJ,"A.acts(T,u,[{window:'gl',dur:3}],{u});","A.acts(T,u,[{window:'gl',dur:4}],{u});",'Missed Again'],
  ['Narrow Escape 1.2%',FXJ,"{param:'ne',add:R(0.01)}","{param:'ne',add:R(0.012)}",'Missed Again'],
  ['Twice Lucky 4 s',FXJ,"(o.tl||(o.tl=[])).push([A.eng().now()+3,","(o.tl||(o.tl=[])).push([A.eng().now()+4,",'Missed Again'],
  ['Luck Holds at 15 s',FXJ,"o.w0!=null&&E.now()-o.w0>=20-1e-9)?2:1;","o.w0!=null&&E.now()-o.w0>=15-1e-9)?2:1;",'Missed Again'],
  ['Charmed Life every hit',FXJ,"lf_9_1:[ {on:'in',once:'wave',","lf_9_1:[ {on:'in',",'Charmed Life'],
  ['Charmed Life at 25%',FXJ,"if:{srcTeam:'enemy',dropBelow:0.20}","if:{srcTeam:'enemy',dropBelow:0.25}",'Charmed Life'],
  ['Charmed Life: 1 Whisker',FXJ,"charmedLife(A,T,u,c){ T.fn.fd(A,T,u,c,{set3:true}); },","charmedLife(A,T,u,c){ T.fn.fd(A,T,u,c); },",'Charmed Life'],
  ['Hair\'s Breadth 4%',FXJ,"{param:'dr.hb',add:R(0.03)}","{param:'dr.hb',add:R(0.04)}",'Charmed Life'],
  ['the Spare Key never stays',FXJ,"if(Pp.spare){ u._keys=Math.min(5,(u._keys||0)+(Pp.mk?2:1)); o.spare=true; }","",'the Spare Key'],
  ['Doubled Spare: once',FXJ,"(Pp.mk?2:1)); o.spare=true; }","(Pp.mk?1:1)); o.spare=true; }",'the Spare Key'],
  ['Odd Key Out crit 4%',FXJ,"fn:'spareOn'},critMore:R(0.03)}","fn:'spareOn'},critMore:R(0.04)}",'the Spare Key'],
  ['Worn Key 2%',FXJ,"{param:'ev.wk',add:R(0.01)}","{param:'ev.wk',add:R(0.02)}",'the Spare Key'],
  ['Spare Change 6',FXJ,"{param:'sc',add:R(5)}","{param:'sc',add:R(6)}",'the Spare Key'],
  ['Beginner\'s Luck 3 keys',FXJ,"u._keys=Math.max(u._keys||0,2); o.bl=true;","u._keys=Math.max(u._keys||0,3); o.bl=true;",'Beginner'],
  ['Fast Start kept after the Master-Unlock',FXJ,"        else { o.bl=false; o.spare=false;","        else { o.spare=false;",'Beginner'],
  ['Loaded Ring 25%',FXJ,"more:P('lr',0.20)}","more:P('lr',0.25)}",'Beginner'],
  ['Heavy Ring 5 points',FXJ,"lf_6_3:[ {param:'lr',add:R(0.04)} ]","lf_6_3:[ {param:'lr',add:R(0.05)} ]",'Beginner'],
  ['Fortune\'s Fool up to 12',FXJ,"    ffl:{max:10}","    ffl:{max:12}",'Beginner'],
  ['Finds the Gap 5%',FXJ,"fn:'muNow'},critMore:R(0.04)}","fn:'muNow'},critMore:R(0.05)}",'Beginner'],
  ['Ring Jingle 0.5%',FXJ,"lf_5_4:[ {stat:{atk:R(0.004)}","lf_5_4:[ {stat:{atk:R(0.005)}",'Ring Jingle'],
  ['Ring of Five at 4',FXJ,"if(Pp['dr.r5']&&(u._keys||0)>=5)","if(Pp['dr.r5']&&(u._keys||0)>=4)",'Ring Jingle'],
  ['Fortune\'s Favour 5%',FXJ,"{param:'fav',add:R(0.04)}","{param:'fav',add:R(0.05)}",'Ring Jingle'],
  ['Charmed before any Fortune',FXJ,"if(Pp['ev.ch']&&(o.fortN||0)>0)","if(Pp['ev.ch'])",'Ring Jingle'],
  ['Every Lock Opens: 2 Whiskers',FXJ,"if(o.mu&&Pp.elo&&WK.some(id=>T.r[id])) A.acts(T,u,[{stack:'wk',add:3}],{u});","if(o.mu&&Pp.elo&&WK.some(id=>T.r[id])) A.acts(T,u,[{stack:'wk',add:2}],{u});",'Ring Jingle'],
  ['The Seventh Lock every 6th',FXJ,"((o.nCast||0)+1)%7===0","((o.nCast||0)+1)%6===0",'The Seventh Lock'],
  ['The Seventh Lock spends his keys',FXJ,"u._keys=Math.min(5,(o.k0||0)+(sk===OED?3:0)+1); u._masterT=o.m0;","u._keys=Math.min(5,(sk===OED?3:0)+1); u._masterT=o.m0;",'The Seventh Lock'],
  ['The Seventh Lock: no Whiskers',FXJ,"if(WK.some(id=>T.r[id])) A.acts(T,u,[{stack:'wk',add:3}],{u}); }","}",'The Seventh Lock'],
  // ---- the caps ----
  ['his group at 45%',FXJ,"DR_FLOOR=0.60,","DR_FLOOR=0.55,",'his caps'],
  ['the allies\' group at 30%',FXJ,"TEAM_FLOOR=0.75,","TEAM_FLOOR=0.70,",'his caps'],
  ['talent dodge at 12%',FXJ,"EVA_CAP=0.10,","EVA_CAP=0.12,",'his caps'],
  ['the heal budget 1.5%',FXJ,"REGEN=0.012,","REGEN=0.015,",'his caps']
];
const SKIP=new Set(['.tmp','.logs','.remote-logs','.git','.base','.bin','node_modules','assets','backups']);
/* the copy: our own walk (fs.cpSync refuses to copy a folder into one of its own subfolders, and the temp folder sits inside the slot) */
function copyTree(src,dst){ fs.mkdirSync(dst,{recursive:true}); for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(src===root&&(SKIP.has(e.name)||e.name.startsWith('.ctl-'))) continue;
    const a=path.join(src,e.name), b=path.join(dst,e.name); if(e.isDirectory()) copyTree(a,b); else if(e.isFile()) fs.copyFileSync(a,b); } }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-noxc-'));
  try{ copyTree(root,dir); if(fs.existsSync(path.join(root,'node_modules'))) fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'));
    const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), eol=s.indexOf('\r\n')>=0?'\r\n':'\n', a=from.replace(/\n/g,eol), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to.replace(/\n/g,eol)));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-nox.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1; return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.env.ONLY){ const w=process.env.ONLY.split('|'); for(let k=C.length-1;k>=0;k--) if(!w.some(x=>C[k][0].indexOf(x)>=0)) C.splice(k,1); }
const out=[]; for(const c of C){ const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
