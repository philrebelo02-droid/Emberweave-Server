'use strict';
/* The controls for Rhukk's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-rhukk.test.js in the same run). Each control copies this checkout to a temp folder under os.tmpdir() (never under the checkout:
   .logs, node_modules, assets and the runner's own folders are left out, node_modules and assets are linked), breaks ONE thing there (an exact text swap in the
   generated talents-fx.js: a row, a number, a cap or a piece of his bookkeeping), runs the named tests of tests/talents-mech-rhukk.test.js in that copy, and
   expects them to FAIL. ONE copy at a time (no parallel child processes); each copy is deleted as soon as its run is done. The checkout itself is never changed.
   His wiring added no page site (every hook he uses was there), so there is no page control; the no-talent identity test with him in the line-up is in the file.
   Prints one line per control and a count; exits 1 if any control was not caught.
   node tests/rhukk-controls.js [regex: only the controls whose name matches]   |   node tests/rhukk-controls.js --check  (each text to break is found exactly once) */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const FXJ='talents-fx.js';
const C=[
  // ---- Phil's Dig In cap ----
  ['Dig In cap 55%',FXJ,"DIG_CAP=0.50,","DIG_CAP=0.55,",'Dig In capped'],
  ['Dig In cap gone',FXJ,"const dr=Math.min(DIG_CAP,(1-u.drMul)*k);","const dr=(1-u.drMul)*k;",'Dig In capped'],
  ['Roar Louder adds points',FXJ,"const k=(1+(P['dig.k1']||0))*(1+(P['dig.k2']||0));","const k=1+((P['dig.k1']||0)+(P['dig.k2']||0))/Math.max(0.01,1-u.drMul);",'Dig In capped'],
  ['Roar Louder 4%',FXJ,"ot_4_3:[ {param:'dig.k1',add:R(0.03)} ],","ot_4_3:[ {param:'dig.k1',add:R(0.04)} ],",'Dig In capped'],
  ['Dig Deeper 5%',FXJ,"eb_4_3:[ {param:'dig.k2',add:R(0.04)} ],","eb_4_3:[ {param:'dig.k2',add:R(0.05)} ],",'Dig In capped'],
  ['Dig In row changes Carapace too',FXJ,"{on:'cast',skill:'taunt',do:[{fn:'digCast'}]},","{on:'cast',do:[{fn:'digCast'}]},",'Dig In capped'],
  // ---- Headlong ----
  ['Headlong max 6',FXJ,"rkHl:{max:5},","rkHl:{max:6},",'Old Habit'],
  ['Headlong never resets on another enemy',FXJ,"const same=o.lastT==null||o.lastT===t;","const same=true;",'Headlong:'],
  ['Lowered Horn 12%',FXJ,"st_1_1:[ {param:'hl.k',add:R(0.10)} ],","st_1_1:[ {param:'hl.k',add:R(0.12)} ],",'Headlong:'],
  ['Lowered Horn at 4',FXJ,"if(A.stGet(T,'rkHl')>=5){ o.shv=c.tgt;","if(A.stGet(T,'rkHl')>=4){ o.shv=c.tgt;",'Headlong:'],
  ['shove does not empty',FXJ,"o.shv=null; A.stSet(T,u,'rkHl',0); o.lastT=null;","o.shv=null; o.lastT=null;",'Headlong:'],
  ['shove 1.4 m',FXJ,"const m=1.5+(P['hl.push']||0);","const m=1.4+(P['hl.push']||0);",'Headlong:'],
  ['One Idea 2%',FXJ,"st_2_1:[ {stat:{aspd:R(0.01)},per:'rkHl'} ],","st_2_1:[ {stat:{aspd:R(0.02)},per:'rkHl'} ],",'Headlong:'],
  ['Rolling Weight 2%',FXJ,"st_10_3:[ {param:'hl.heal',add:R(0.01)} ],","st_10_3:[ {param:'hl.heal',add:R(0.02)} ],",'Headlong:'],
  ['Straight Through It 4 m',FXJ,"g<=3*E.METER()&&g<bd","g<=4*E.METER()&&g<bd",'Headlong:'],
  ['Straight Through It always',FXJ,"if(P['hl.thru']){ const E=A.eng()","if(true){ const E=A.eng()",'Headlong:'],
  ['Last Push 0.6 m',FXJ,"st_12_4:[ {param:'hl.push',add:R(0.5)} ],","st_12_4:[ {param:'hl.push',add:R(0.6)} ],",'Headlong:'],
  ['Old Habit 2 a rank',FXJ,"st_12_1:[ {param:'hl.old',add:R(1)} ],","st_12_1:[ {param:'hl.old',add:R(2)} ],",'Old Habit'],
  ['Old Habit only once',FXJ,"o.lost=0; o.lastT=null; if(P['hl.old'])","o.lost=0; o.lastT=null; if(P['hl.old']&&!o.oh&&(o.oh=1))",'Old Habit'],
  ['Through the Line on anyone',FXJ,"const add=(P['hl.tl']&&A.markOf(u,t,'rkTr'))?2:1;","const add=P['hl.tl']?2:1;",'Old Habit'],
  ['Beetle Hide at 2',FXJ,"if(P['dr.bh']&&A.stGet(T,'rkHl')>=3)","if(P['dr.bh']&&A.stGet(T,'rkHl')>=2)",'Old Habit'],
  // ---- Impale Rush ----
  ['Trampled 4 s base',FXJ,"A.setMark(T,u,t,'rkTr',{dur:5+(T.P['tr.dur']||0),longest:true});","A.setMark(T,u,t,'rkTr',{dur:4+(T.P['tr.dur']||0),longest:true});",'Impale Rush:'],
  ['Hoof and Horn 3%',FXJ,"st_1_2:[ {stat:{armor:R(-0.02)},to:{team:'enemy',has:'rkTr'}} ],","st_1_2:[ {stat:{armor:R(-0.03)},to:{team:'enemy',has:'rkTr'}} ],",'Impale Rush:'],
  ['Ground Down 0.5 s',FXJ,"st_2_2:[ {param:'tr.dur',add:R(0.6)} ],","st_2_2:[ {param:'tr.dur',add:R(0.5)} ],",'Impale Rush:'],
  ['Trodden 6%',FXJ,"st_6_4:[ {stat:{move:R(-0.05)},to:{team:'enemy',has:'rkTr'}} ],","st_6_4:[ {stat:{move:R(-0.06)},to:{team:'enemy',has:'rkTr'}} ],",'Impale Rush:'],
  ['Trample Ground 4%',FXJ,"st_8_3:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'rkTr'}} ],","st_8_3:[ {stat:{aspd:R(-0.04)},to:{team:'enemy',has:'rkTr'}} ],",'Impale Rush:'],
  ['Walls Became Rubble on anyone',FXJ,"st_8_2:[ {on:'out',if:{targetHas:'rkTr'},more:R(0.02)} ],","st_8_2:[ {on:'out',more:R(0.02)} ],",'Impale Rush:'],
  ['Bowled Over 6 s -> 7 s',FXJ,"rkBo:{max:8,dur:6}","rkBo:{max:8,dur:7}",'Impale Rush:'],
  ['Bowled Over counts 1 a rush',FXJ,"A.stSet(T,u,'rkBo',A.stGet(T,'rkBo')+L.length);","A.stSet(T,u,'rkBo',A.stGet(T,'rkBo')+1);",'Impale Rush:'],
  ['Momentum Hide 4 s',FXJ,"if(P['dr.mh']) A.acts(T,u,[{window:'rkMh',dur:3}],c);","if(P['dr.mh']) A.acts(T,u,[{window:'rkMh',dur:4}],c);",'Impale Rush:'],
  ['Momentum Hide 2.5%',FXJ,"st_10_1:[ {param:'dr.mh',add:R(0.02)} ],","st_10_1:[ {param:'dr.mh',add:R(0.025)} ],",'Impale Rush:'],
  ['Hard Charge 0.07 s',FXJ,"st_7_4:[ {param:'ext.hc',add:R(0.06)} ],","st_7_4:[ {param:'ext.hc',add:R(0.07)} ],",'Impale Rush:'],
  ['Scattered at 2',FXJ,"if(P['ext.sc']&&L.length>=3)","if(P['ext.sc']&&L.length>=2)",'Impale Rush:'],
  ['Scattered 0.12 s',FXJ,"st_12_2:[ {param:'ext.sc',add:R(0.1)} ],","st_12_2:[ {param:'ext.sc',add:R(0.12)} ],",'Impale Rush:'],
  ['Farthest First 6%',FXJ,"st_4_2:[ {on:'out',if:{casting:RUSH},more:R(0.05)} ],","st_4_2:[ {on:'out',if:{casting:RUSH},more:R(0.06)} ],",'Impale Rush:'],
  ['Horn Rush on every hit',FXJ,"eb_8_3:[ {on:'out',if:{casting:RUSH},more:R(0.05)} ],","eb_8_3:[ {on:'out',more:R(0.05)} ],",'Impale Rush:'],
  ['Shorter Fuse aims the farthest',FXJ,"else if(P['sf.on']){ let b=null,bd=1e18;","else if(false){ let b=null,bd=1e18;",'Shorter Fuse'],
  ['Shorter Fuse 0.4 s',FXJ,"let ext=(P['sf.on']?0.5:0)","let ext=(P['sf.on']?0.4:0)",'Shorter Fuse'],
  ['Close Quarters 4 s',FXJ,"if(P['dr.cq']&&P['sf.on']) A.acts(T,u,[{window:'rkCq',dur:3}],c);","if(P['dr.cq']&&P['sf.on']) A.acts(T,u,[{window:'rkCq',dur:4}],c);",'Shorter Fuse'],
  ['Longer Run cap 45%',FXJ,"k*=1+Math.min(0.40,P['run.k']*(o.run||0));","k*=1+Math.min(0.45,P['run.k']*(o.run||0));",'Shorter Fuse'],
  ['Longer Run 2.2% a metre',FXJ,"st_5_2:[ {param:'run.k',add:0.02} ],","st_5_2:[ {param:'run.k',add:0.022} ],",'Shorter Fuse'],
  ['stun cap 5 s',FXJ,"DIG_CAP=0.50, CRIT_CAP=0.05, SLOW_CAP=0.40, CTRL_MAX=4.0;","DIG_CAP=0.50, CRIT_CAP=0.05, SLOW_CAP=0.40, CTRL_MAX=5.0;",'One Tunnel'],
  ['Rubble 0.6',FXJ,"if(!(op.pathHit>0)) op.pathHit=0.5;","if(!(op.pathHit>0)) op.pathHit=0.6;",'Rubble'],
  ['Rubble no knock',FXJ,"if(!(op.knockAside>0)) op.knockAside=1.5*M;","",'Rubble'],
  ['Never Stops gone',FXJ,"if(P['ns.on']&&o.rush&&u._dash&&","if(false&&o.rush&&u._dash&&",'Rubble'],
  ['Fastest Way at 2',FXJ,"else if((o.hitN||0)>=3&&!(o.fwL>0))","else if((o.hitN||0)>=2&&!(o.fwL>0))",'Fastest Way'],
  ['Fastest Way 70%',FXJ,"if(o.sec) k*=0.6; c.amt*=k;","if(o.sec) k*=0.7; c.amt*=k;",'Fastest Way'],
  ['Fastest Way lock ignored',FXJ,"else if((o.hitN||0)>=3&&!(o.fwL>0)){","else if((o.hitN||0)>=3){",'Fastest Way'],
  ['Fastest Way no full Headlong',FXJ,"if(sec){ o.sec=0; A.stSet(T,u,'rkHl',5);","if(sec){ o.sec=0;",'Fastest Way'],
  ['Fastest Way stun-lock rule gone',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'rkLk')) c.amt=0;","",'Fastest Way'],
  ['Fastest Way lock 0.5 s ignored',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'rkLk')) c.amt=0;","if(A.markOf(u,t,'rkLk')) c.amt=0;",'Fastest Way'],
  // ---- Sheltered ----
  ['Sheltered 3.5 m',FXJ,"R=(3+(P['sh.r']||0))*M;","R=(3.5+(P['sh.r']||0))*M;",'Sheltered:'],
  ['Sheltered in front too',FXJ,"if(Math.hypot(a.x-cx,a.y-cy)>dm&&A.gap(u,a)<=R) sh[a.uid]=1;","if(A.gap(u,a)<=R) sh[a.uid]=1;",'Sheltered:'],
  ['The Young Behind 3%',FXJ,"ot_1_1:[ {param:'sh.k',add:R(0.02)} ],","ot_1_1:[ {param:'sh.k',add:R(0.03)} ],",'Sheltered:'],
  ['Fill the Tunnel 0.4 m',FXJ,"ot_3_1:[ {param:'sh.r',add:R(0.3)} ],","ot_3_1:[ {param:'sh.r',add:R(0.4)} ],",'Sheltered:'],
  ['Little Ones Watch 3%',FXJ,"ot_6_1:[ {param:'sh.out',add:R(0.02)} ],","ot_6_1:[ {param:'sh.out',add:R(0.03)} ],",'Sheltered:'],
  ['Sheltering Bulk on anyone',FXJ,"shU(A,T,u,c){ const x=c.unit; return !!(x&&x!==u&&S(T).sh[x.uid]); },","shU(A,T,u,c){ const x=c.unit; return !!(x&&x!==u); },",'Sheltered:'],
  ['Thick Lip 3%',FXJ,"ot_7_1:[ {param:'cp.sh',add:R(0.02)} ],","ot_7_1:[ {param:'cp.sh',add:R(0.03)} ],",'Sheltered:'],
  ['Shell Over Them 0.6',FXJ,"if(P['cp.half']&&sh&&A.winOn(T,'rkCp')) k*=0.5;","if(P['cp.half']&&sh&&A.winOn(T,'rkCp')) k*=0.6;",'Sheltered:'],
  ['ally cap 45%',FXJ,"DR_FLOOR=0.65, ALLY_FLOOR=0.50,","DR_FLOOR=0.65, ALLY_FLOOR=0.45,",'the caps'],
  // ---- Anchor ----
  ['Anchor max 7',FXJ,"rkAn:{max:P('an.max',6)},","rkAn:{max:P('an.max',7)},",'Anchor:'],
  ['Anchor never empties',FXJ,"else { o.ad=0; if(!(P['dig.fill']&&A.winOn(T,'rkDg'))) A.stSet(T,u,'rkAn',0); } }","else { o.ad=0; } }",'Anchor:'],
  ['Plant the Legs 0.4%',FXJ,"ot_1_4:[ {param:'dr.an',add:R(0.003)} ],","ot_1_4:[ {param:'dr.an',add:R(0.004)} ],",'Anchor:'],
  ['Dug Deep 2 a rank',FXJ,"ot_2_4:[ {param:'an.max',add:R(1)} ],","ot_2_4:[ {param:'an.max',add:R(2)} ],",'Anchor:'],
  ['Bedded In 0.4%',FXJ,"ot_6_4:[ {stat:{atk:R(0.003)},per:'rkAn'} ],","ot_6_4:[ {stat:{atk:R(0.004)},per:'rkAn'} ],",'Anchor:'],
  ['Weight of Water 0.6%',FXJ,"ot_10_4:[ {on:'out',if:{auto:true},more:R(0.005),per:'rkAn'} ],","ot_10_4:[ {on:'out',if:{auto:true},more:R(0.006),per:'rkAn'} ],",'Anchor:'],
  ['Did Not Move does not hold',FXJ,"if(!(P['dig.fill']&&A.winOn(T,'rkDg')))","if(!(P['dig.fill']&&false))",'Anchor:'],
  ['Did Not Move does not fill',FXJ,"if(P['dig.fill']) A.stSet(T,u,'rkAn',1e9);","",'Anchor:'],
  ['Like the Roots without Anchor',FXJ,"{on:'tick',if:{stackMin:{rkAn:1}},do:[{timer:'_gearImmovableT',min:0.1,on:'self'}]}","{on:'tick',do:[{timer:'_gearImmovableT',min:0.1,on:'self'}]}",'Anchor:'],
  ['Tough Night 0.4%',FXJ,"ot_8_4:[ {on:'tick',period:3,if:{stackMin:{rkAn:1}},do:[{heal:{pct:R(0.003),of:'maxHp'},on:'self'}]} ],","ot_8_4:[ {on:'tick',period:3,if:{stackMin:{rkAn:1}},do:[{heal:{pct:R(0.006),of:'maxHp'},on:'self'}]} ],",'Anchor:'],
  ['Stone Still on every hit',FXJ,"if(P['dr.ss']&&crit&&A.stGet","if(P['dr.ss']&&A.stGet",'Anchor:'],
  // ---- Dig In ----
  ['Long Roar 0.12 s',FXJ,"ot_2_3:[ {param:'dig.ext',add:R(0.1)} ],","ot_2_3:[ {param:'dig.ext',add:R(0.12)} ],",'Dig In.s talents'],
  ['Carved by the Roar 2%',FXJ,"A.acts(T,u,[{shield:{pct:0.01*n,of:'maxHp'},dur:3,on:'self'}],c);","A.acts(T,u,[{shield:{pct:0.02*n,of:'maxHp'},dur:3,on:'self'}],c);",'Dig In.s talents'],
  ['Carved by the Roar carves at 1',FXJ,"if(T.r.eb_1_1&&n>=2) T.fn.carve(A,T,u,c);","if(T.r.eb_1_1&&n>=1) T.fn.carve(A,T,u,c);",'Dig In.s talents'],
  ['Come for Me 2%',FXJ,"ot_5_3:[ {param:'dig.heal',add:0.015} ],","ot_5_3:[ {param:'dig.heal',add:0.02} ],",'Dig In.s talents'],
  ['Taunting Horn from anyone',FXJ,"if(P['dr.th']&&s&&taunted(u,s))","if(P['dr.th']&&s)",'Dig In.s talents'],
  ['Gore Back on anyone',FXJ,"if(P['crit.gb']&&taunted(u,t)) p+=P['crit.gb'];","if(P['crit.gb']) p+=P['crit.gb'];",'Dig In.s talents'],
  ['Echo Roar 0.3',FXJ,"ot_6_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ],","ot_6_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],",'Dig In.s talents'],
  ['Plates Lock on blue',FXJ,"eb_4_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],","eb_4_2:[ {on:'cd',skill:'blue',add:R(-0.3)} ],",'Dig In.s talents'],
  ['Not Them at 35%',FXJ,"if(p!=null&&p>=0.3&&f<0.3&&!(o.ntL>0))","if(p!=null&&p>=0.35&&f<0.35&&!(o.ntL>0))",'Not Them'],
  ['Not Them no lock',FXJ,"o.ntL=Math.max(0,20-(P['nt.wait']||0)); o.dig=2;","o.dig=2;",'Not Them'],
  ['Always Listening 1.5 s',FXJ,"ot_6_2:[ {param:'nt.wait',add:R(2)} ],","ot_6_2:[ {param:'nt.wait',add:R(1.5)} ],",'Not Them'],
  ['Not Them for Rhukk too',FXJ,"if(o.f.nt){ for(const a of U){","if(o.f.nt){ for(const a of U.concat([u])){",'Not Them'],
  ['Forgot the Young twice',FXJ,"A.clearMark(u,s,'rkFt'); A.acts(T,u,[{taunt:1,on:'source'}],c);","A.acts(T,u,[{taunt:1,on:'source'}],c);",'Forgot the Young'],
  ['Forgot the Young 4 s',FXJ,"{dur:Math.min(CTRL_MAX,t.forcedTargetT)+3}","{dur:Math.min(CTRL_MAX,t.forcedTargetT)+4}",'Forgot the Young'],
  ['Forgot the Young any ally',FXJ,"if(P['ft.on']&&sh&&A.markOf(u,s,'rkFt')","if(P['ft.on']&&A.markOf(u,s,'rkFt')",'Forgot the Young'],
  ['Let It Come 2%',FXJ,"ot_12_3:[ {param:'ft.sh',add:R(0.01)} ],","ot_12_3:[ {param:'ft.sh',add:R(0.02)} ],",'Forgot the Young'],
  ['One Tunnel 0.6',FXJ,"const h=(c.amt||0)*0.5; c.amt=0; c.mv=0;","const h=(c.amt||0)*0.6; c.amt=0; c.mv=0;",'One Tunnel'],
  ['One Tunnel 6 s',FXJ,"o.otL=30; A.acts(T,u,[{window:'rkOt',dur:5}],c);","o.otL=30; A.acts(T,u,[{window:'rkOt',dur:6}],c);",'One Tunnel'],
  ['One Tunnel no lock',FXJ,"&&!A.winOn(T,'rkOt')&&!(o.otL>0)&&","&&!A.winOn(T,'rkOt')&&",'One Tunnel'],
  ['One Tunnel at 30%',FXJ,"t.hp>=0.25*t.maxHp&&t.hp+(t.shield||0)-(c.amt||0)<0.25*t.maxHp","t.hp>=0.30*t.maxHp&&t.hp+(t.shield||0)-(c.amt||0)<0.30*t.maxHp",'One Tunnel'],
  ['One Tunnel no full Anchor',FXJ,"o.otCast=1; o.dig=2; A.stSet(T,u,'rkAn',1e9);","o.otCast=1; o.dig=2;",'One Tunnel'],
  ['By Morning 3%',FXJ,"ot_10_1:[ {param:'bm.k',add:R(0.02)} ],","ot_10_1:[ {param:'bm.k',add:R(0.03)} ],",'By Morning'],
  ['By Morning ignores the lost',FXJ,"const o=S(T), P=T.P; if(o.lost) return;","const o=S(T), P=T.P;",'By Morning'],
  ['By Morning lost forever',FXJ,"wv(A,T,u){ const o=S(T), P=T.P; o.lost=0;","wv(A,T,u){ const o=S(T), P=T.P;",'By Morning'],
  ['Nobody Lost 1.5%',FXJ,"ot_12_1:[ {param:'bm.all',add:R(0.01)} ],","ot_12_1:[ {param:'bm.all',add:R(0.015)} ],",'By Morning'],
  // ---- Carvings and Lesson ----
  ['Carving at 5%',FXJ,"Math.max(0.03,0.06-(P['cv.need']||0))","Math.max(0.03,0.05-(P['cv.need']||0))",'Carvings:'],
  ['Carvings max 7',FXJ,"rkCv:{max:P('cv.max',6)},","rkCv:{max:P('cv.max',7)},",'Carvings:'],
  ['Carve It 3',FXJ,"eb_5_2:[ {param:'cv.max',add:4} ],","eb_5_2:[ {param:'cv.max',add:3} ],",'Carvings:'],
  ['First Lesson 0.5%',FXJ,"eb_1_1:[ {stat:{armor:R(0.004),mr:R(0.004)},per:'rkCv'} ],","eb_1_1:[ {stat:{armor:R(0.005),mr:R(0.004)},per:'rkCv'} ],",'Carvings:'],
  ['Every Hard Thing 2%',FXJ,"eb_10_1:[ {param:'cv.heal',add:R(0.01)} ],","eb_10_1:[ {param:'cv.heal',add:R(0.02)} ],",'Carvings:'],
  ['Scored Plates 0.4%',FXJ,"eb_5_4:[ {stat:{atk:R(0.003)},per:'rkCv'} ],","eb_5_4:[ {stat:{atk:R(0.004)},per:'rkCv'} ],",'Carvings:'],
  ['Old Scars Hold 0.3%',FXJ,"eb_9_1:[ {stat:{lifesteal:R(0.002)},per:'rkCv'} ],","eb_9_1:[ {stat:{lifesteal:R(0.003)},per:'rkCv'} ],",'Carvings:'],
  ['Cut Deep gone',FXJ,"if(P['cp.cut']) T.fn.carve(A,T,u,c); },","},",'Carvings:'],
  ['Keep It Smooth carves',FXJ,"if(P.smooth||!CV.some(id=>T.r[id])) return false;","if(!CV.some(id=>T.r[id])) return false;",'Keep It Smooth'],
  ['Keep It Smooth 9%',FXJ,"eb_5_3:[ {param:'dr.sm',add:0.08}, {param:'smooth',add:1} ],","eb_5_3:[ {param:'dr.sm',add:0.09}, {param:'smooth',add:1} ],",'Keep It Smooth'],
  ['chitin speed ignored',FXJ,"/(P.smooth?2:1)); u.wardenT=(u.wardenT||0)+dt*(3/p-1); }","/(P.smooth?2:1)); }",'Keep It Smooth'],
  ['chitin speed floor 1.5 s',FXJ,"const p=Math.max(1,(3-(P['chit.fast']||0))/(P.smooth?2:1));","const p=Math.max(1.5,(3-(P['chit.fast']||0))/(P.smooth?2:1));",'Keep It Smooth'],
  ['Chitin Grows at 4',FXJ,"if(P['dr.cg']&&(u.wardenStk||0)>=5)","if(P['dr.cg']&&(u.wardenStk||0)>=4)",'Keep It Smooth'],
  ['Wide Shell 0.4%',FXJ,"ot_12_2:[ {stat:{hp:R(0.003)},per:{fn:'chitN'}} ],","ot_12_2:[ {stat:{hp:R(0.004)},per:{fn:'chitN'}} ],",'Keep It Smooth'],
  ['Lesson 4.5 m',FXJ,"R=(4+(P['les.r']||0))*M,","R=(4.5+(P['les.r']||0))*M,",'Lesson:'],
  ['Teach Them no double',FXJ,"if((dg&&g<=4*M)||(fm&&g<=6*M)) n=2;","if(fm&&g<=6*M) n=2;",'Lesson:'],
  ['Read the Back 0.4%',FXJ,"eb_1_4:[ {stat:{armor:R(0.003)},","eb_1_4:[ {stat:{armor:R(0.004)},",'Lesson:'],
  ['The Young Read armour',FXJ,"eb_3_4:[ {stat:{mr:R(0.003)},","eb_3_4:[ {stat:{armor:R(0.003)},",'Lesson:'],
  ['Readable 0.6 m',FXJ,"eb_7_4:[ {param:'les.r',add:R(0.5)} ],","eb_7_4:[ {param:'les.r',add:R(0.6)} ],",'Lesson:'],
  ['Lines in the Chitin 2%',FXJ,"eb_6_4:[ {param:'les.out',add:R(0.01)} ],","eb_6_4:[ {param:'les.out',add:R(0.02)} ],",'Lesson:'],
  ['Wide Reading 2%',FXJ,"eb_10_4:[ {on:'teamHeal',if:{fn:'lesHeal'},more:R(0.01)} ],","eb_10_4:[ {on:'teamHeal',if:{fn:'lesHeal'},more:R(0.02)} ],",'Lesson:'],
  ['Read Aloud 0.6%',FXJ,"const o=S(T), k=0.003*rk(T,'eb_12_4');","const o=S(T), k=0.006*rk(T,'eb_12_4');",'Lesson:'],
  ['Thick Loam on all damage',FXJ,"if(P['dr.tl']&&mg&&A.winOn(T,'rkCp')) k*=1-P['dr.tl'];","if(P['dr.tl']&&A.winOn(T,'rkCp')) k*=1-P['dr.tl'];",'Lesson:'],
  ['Thick Loam not for allies',FXJ,"if(P['dr.tl']&&c.kind==='magic'&&A.winOn(T,'rkCp')&&o.les[t.uid]) k*=1-P['dr.tl'];","",'Lesson:'],
  ['A Straight Line 6%',FXJ,"eb_11_2:[ {on:'out',if:{casting:RUSH},more:0.05,per:'rkCv'}, {param:'ext.sl',add:0.1} ],","eb_11_2:[ {on:'out',if:{casting:RUSH},more:0.06,per:'rkCv'}, {param:'ext.sl',add:0.1} ],",'A Straight Line'],
  ['A Straight Line 0.12 s',FXJ,"eb_11_2:[ {on:'out',if:{casting:RUSH},more:0.05,per:'rkCv'}, {param:'ext.sl',add:0.1} ],","eb_11_2:[ {on:'out',if:{casting:RUSH},more:0.05,per:'rkCv'}, {param:'ext.sl',add:0.12} ],",'A Straight Line'],
  ['And a Wall 5 s',FXJ,"of:'maxHp'},dur:4,on:'self'}],c); }\n      if(P['sig.fw'])","of:'maxHp'},dur:5,on:'self'}],c); }\n      if(P['sig.fw'])",'A Straight Line'],
  ['Plated Horn on every hit',FXJ,"if(P['crit.ph']&&RUSH.indexOf(T.s.cur)>=0) p+=P['crit.ph'];","if(P['crit.ph']) p+=P['crit.ph'];",'A Straight Line'],
  ['First Mark 0.7',FXJ,"if(P['sig.fm']&&A.winOn(T,'rkFm')&&A.gap(u,t)<=6*E.METER()) k*=0.75;","if(P['sig.fm']&&A.winOn(T,'rkFm')&&A.gap(u,t)<=6*E.METER()) k*=0.7;",'First Mark'],
  ['First Mark 7 m',FXJ,"if(P['sig.fm']&&A.winOn(T,'rkFm')&&A.gap(u,t)<=6*E.METER()) k*=0.75;","if(P['sig.fm']&&A.winOn(T,'rkFm')&&A.gap(u,t)<=9*E.METER()) k*=0.75;",'First Mark'],
  ['First Mark no hold',FXJ,"T.s.undy=Math.max(T.s.undy||0,6); if(u.hp<1) u.hp=1;","",'First Mark'],
  ['First Mark no lock',FXJ,"if(P['sig.fm']&&!(o.fmL>0)){ o.fmL=30;","if(P['sig.fm']){ o.fmL=30;",'First Mark'],
  ['First Mark before the most',FXJ,"if(A.stGet(T,'rkCv')>=A.stMax(T,u,'rkCv')){ if(P['sig.fm']","if(A.stGet(T,'rkCv')>=A.stMax(T,u,'rkCv')-1){ if(P['sig.fm']",'First Mark'],
  // ---- the caps ----
  ['damage-reduction cap 40%',FXJ,"DR_FLOOR=0.65, ALLY_FLOOR","DR_FLOOR=0.60, ALLY_FLOOR",'the caps'],
  ['damage reduction not on damage over time',FXJ,"const s=c.src||(c.dot&&c.dot.src); if(s&&s.team===u.team) return;","if(c.dot) return; const s=c.src; if(s&&s.team===u.team) return;",'the caps'],
  ['Hard Head 1.2%',FXJ,"st_11_4:[ {param:'dr.hh',add:R(0.01)} ],","st_11_4:[ {param:'dr.hh',add:R(0.012)} ],",'the caps'],
  ['Learned the Hard Way gone',FXJ,"if(P['dr.lh']) k*=1-P['dr.lh'];","",'the caps'],
  ['crit cap 6%',FXJ,"DIG_CAP=0.50, CRIT_CAP=0.05,","DIG_CAP=0.50, CRIT_CAP=0.06,",'the caps'],
  ['Long Horn 0.8%',FXJ,"st_7_3:[ {param:'crit.lh',add:R(0.01)} ],","st_7_3:[ {param:'crit.lh',add:R(0.008)} ],",'the caps'],
  ['slow cap 45%',FXJ,"SLOW_CAP=0.40, CTRL_MAX","SLOW_CAP=0.45, CTRL_MAX",'the caps'],
  ['Unafraid 5%',FXJ,"ot_4_4:[ {on:'ccIn',less:R(0.04)} ],","ot_4_4:[ {on:'ccIn',less:R(0.05)} ],",'the caps'],
  ['Thicker Plates 2%',FXJ,"ot_11_2:[ {param:'cp.k',add:R(0.01)} ],","ot_11_2:[ {param:'cp.k',add:R(0.02)} ],",'the caps'],
  ['Shell First 0.3 s',FXJ,"st_9_4:[ {on:'kit',skill:'defensive',opt:{dur:{add:R(0.2)}}} ],","st_9_4:[ {on:'kit',skill:'defensive',opt:{dur:{add:R(0.3)}}} ],",'the caps'],
  ['Horn Weight on anyone',FXJ,"st_8_1:[ {on:'out',if:{fn:'backT'},more:R(0.02)} ],","st_8_1:[ {on:'out',more:R(0.02)} ],",'the caps'],
  ['Root-Splitter lost',FXJ,"st_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],","st_3_3:[ ],",'the caps'],
  ['Pace 4%',FXJ,"st_5_4:[ {stat:{move:R(0.03)}} ],","st_5_4:[ {stat:{move:R(0.04)}} ],",'the caps'],
  ['Horn Bash 3%',FXJ,"ot_7_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],","ot_7_2:[ {on:'out',if:{auto:true},more:R(0.03)} ],",'the caps'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp','.rhukk-runs']);
function copyTo(dir){ const walk=(s,d)=>{ fs.mkdirSync(d,{recursive:true}); for(const n of fs.readdirSync(s)){ const a=path.join(s,n), b=path.join(d,n), r=path.relative(root,a);
    if(SKIP.has(r.split(path.sep)[0])||/^\.ctl-|^\.remote-|^\.test-/.test(n)) continue; const st=fs.lstatSync(a); if(st.isDirectory()) walk(a,b); else if(st.isFile()) fs.copyFileSync(a,b); } };
  walk(root,dir); for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
const fix=(s,x)=>x.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n');
if(process.argv[2]==='--check'){ let bad=0; const cache={}; for(const c of C){ const s=cache[c[1]]||(cache[c[1]]=fs.readFileSync(path.join(root,c[1]),'utf8')), n=s.split(fix(s,c[2])).length-1; if(n!==1){ bad++; console.log('found '+n+' times: '+c[0]); } }
  console.log(C.length+' controls, '+bad+' with a bad text'); process.exit(bad?1:0); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-rkc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=fix(s,from), n=s.split(a).length-1;
    if(from!==to&&n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>fix(s,to)));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-rhukk.test.js'],{cwd:dir,env:Object.assign({},process.env,{RHUKK_NOBASE:'1'}),encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0&&!!pm,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
/* first the copy unbroken: every test must pass there, or a control that "fails" proves nothing */
{ const b=runOne(['(unbroken)',FXJ,'TalentFx','TalentFx','.']); if(!/^fail 0, pass [1-9]/.test(b.why)){ console.log('BASELINE BROKEN: '+b.why); process.exit(1); } console.log('baseline: '+b.why); }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
