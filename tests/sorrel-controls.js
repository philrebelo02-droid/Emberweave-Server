'use strict';
/* The controls for Sorrel's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-sorrel.test.js). Each control copies this checkout to a temp folder (os.tmpdir(): the runner's own temp folder on disk), breaks ONE thing there
   (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guarded site given an unguarded seeded draw, a row or a
   number of his changed), runs the named tests of tests/talents-mech-sorrel.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child
   processes); each copy is deleted as soon as its run is done; .logs, .remote-logs, .tmp and node_modules are never copied (node_modules is linked).
   The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   Run: node tests/sorrel-controls.js   (ONLY='name|name' runs some of them; --list only checks that every text to break is found exactly once) */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', ID='no talents';
const LH="if(u.pass.loadedhand&&!(u._tal&&u._tal.on.num&&TalentFx.num(u,'lhSwing',0,t)>0)){";
const LAND="if(e.alive){ if(u._tal) TalentFx.landPre(u,e,'volley');";
const SFX="TalentFx.bindMore({ suitFx:(u,t,s)=>{";
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['Loaded Hand hook removed',HTML,LH,'if(u.pass.loadedhand){','live fight'],
  ['card landing pair removed',HTML,LAND+'   /* TALENT HOOK landPre',"if(e.alive){ if(false) TalentFx.landPre(u,e,'volley');   /* TALENT HOOK landPre",'Edged Cards'],
  ['suit art not bound',HTML,SFX,'TalentFx.bindMore({ suitFx_:(u,t,s)=>{','Up the Sleeve'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at Loaded Hand',HTML,LH,"if(u.pass.loadedhand&&(brnd()>=0)&&!(u._tal&&u._tal.on.num&&TalentFx.num(u,'lhSwing',0,t)>0)){",ID],
  ['draw at the card landing',HTML,LAND,"if(e.alive){ brnd(); if(u._tal) TalentFx.landPre(u,e,'volley');",ID],
  // ---- Loaded Hand as the passive plays it ----
  ['heavy hit 95%',FXJ,"strike0(A,T,u,t,a*0.9*pm*k,'#c0392b');","strike0(A,T,u,t,a*0.95*pm*k,'#c0392b');",'Clean Deck'],
  ['stun suit 0.6 s',FXJ,"E.ccDur(0.5)*k","E.ccDur(0.6)*k",'Clean Deck'],
  ['heal suit 55%',FXJ,"else E.healUnit(u,a*0.5*pm*k);","else E.healUnit(u,a*0.55*pm*k);",'Clean Deck'],
  ['armour break 5 s',FXJ,"t._shredT=Math.max(t._shredT||0,4); }","t._shredT=Math.max(t._shredT||0,5); }",'same seeded draw'],
  ['suit draw shifted',FXJ,"else suit=Math.floor(E.rnd()*4)%4; }","else suit=Math.floor(E.rnd()*4+1)%4; }",'same seeded draw'],
  ['card index not counted',FXJ,"r.got.set(e,g+1); o.card={rec:r,i:g,e}; return;","o.card={rec:r,i:g,e}; return;",'Edged Cards'],
  // ---- the Stacked Deck ----
  ['Counting Cards: repeats',FXJ,"const L=[0,1,2,3].filter(x=>!((o.rd||0)&(1<<x)));","const L=[0,1,2,3];",'Counting Cards'],
  ['a round gives 2 Count',FXJ,"A.acts(T,u,[{stack:'soCnt',add:1}],{u});","A.acts(T,u,[{stack:'soCnt',add:2}],{u});",'Counting Cards'],
  ['Count capped at 6',FXJ,"if(T.P.wit) n+=S(T).sgN||0; return Math.min(5,n); }","if(T.P.wit) n+=S(T).sgN||0; return Math.min(6,n); }",'Third Signs Them'],
  ['Counting Cards 2%',FXJ,"sd_1_4:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.01)","sd_1_4:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.02)",'Counting Cards'],
  ['Card Sharp 0.6%',FXJ,"if(r.sd_3_4) x+=0.005*r.sd_3_4","if(r.sd_3_4) x+=0.006*r.sd_3_4",'Counting Cards'],
  ['Counted Out 0.3 s',FXJ,"sd_5_4:[ {param:'co',add:R(0.2)} ]","sd_5_4:[ {param:'co',add:R(0.3)} ]",'Counting Cards'],
  ['Stacked Deck below 30%',FXJ,"suit=(u.hp<0.5*u.maxHp)?HEAL:HEAVY","suit=(u.hp<0.3*u.maxHp)?HEAL:HEAVY",'Counting Cards'],
  ['Stacked Deck off',FXJ,"if(Pp.stk) o.force=true; }","}",'Counting Cards'],
  ['Long Count 2 a rank',FXJ,"sd_12_1:[ {param:'lc',add:R(1)} ]","sd_12_1:[ {param:'lc',add:R(2)} ]",'Counting Cards'],
  ['Count kept between waves',FXJ,"A.stSet(T,u,'soCnt',Math.min(A.stGet(T,'soCnt'),Pp.lc||0));","",'Counting Cards'],
  ['Full House 6%',FXJ,"sd_7_4:[ {param:'fh',add:R(0.05)} ]","sd_7_4:[ {param:'fh',add:R(0.06)} ]",'Counting Cards'],
  ['Full House at 4',FXJ,"if(Pp.fh&&T.fn.cntN(A,T,u)>=5)","if(Pp.fh&&T.fn.cntN(A,T,u)>=4)",'Counting Cards'],
  ['every draw palmed',FXJ,"if(o.pc%2===0&&L.length<room)","if(L.length<room)",'Up the Sleeve'],
  ['Up the Sleeve 5%',FXJ,"sd_1_1:[ {param:'palm.k',add:R(0.04)} ]","sd_1_1:[ {param:'palm.k',add:R(0.05)} ]",'Up the Sleeve'],
  ['Quick Palm always',FXJ,"sd_2_1:[ {stat:{aspd:R(0.04)},if:{fn:'palmHeld'}} ]","sd_2_1:[ {stat:{aspd:R(0.04)}} ]",'Up the Sleeve'],
  ['Cold Read always',FXJ,"sd_6_1:[ {on:'out',if:{targetTeam:'enemy',fn:'palmHeld'},ignoreArmor","sd_6_1:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor",'Up the Sleeve'],
  ['Sleight of Hand 5%',FXJ,"sd_7_1:[ {param:'slh',add:R(0.04)} ]","sd_7_1:[ {param:'slh',add:R(0.05)} ]",'Up the Sleeve'],
  ['Bottom Deal 0.6%',FXJ,"sd_11_1:[ {stat:{atk:R(0.005)},per:'soBd'} ]","sd_11_1:[ {stat:{atk:R(0.006)},per:'soBd'} ]",'Up the Sleeve'],
  ['Bottom Deal kept between waves',FXJ,"soBd:{max:6,wave:'reset'},","soBd:{max:6},",'Up the Sleeve'],
  ['palm played on the first card',FXJ,"else if(i===2) mine=r.palms.slice();","else if(i===0) mine=r.palms.slice();",'Up the Sleeve'],
  ['Second Sleeve: room for one',FXJ,"const room=Pp.palm2?2:1, L=o.palm||(o.palm=[]); if(o.pc%2===0","const room=1, L=o.palm||(o.palm=[]); if(o.pc%2===0",'Second Sleeve'],
  ['Second Sleeve: both on card 3',FXJ,"if(i===1) mine=[r.palms[0]]; else if(i===2) mine=r.palms.slice(1); }","if(i===2) mine=r.palms.slice(); }",'Second Sleeve'],
  ['The Cooler off',FXJ,"if(Pp.cool) mine=r.palms.slice();","if(false) mine=r.palms.slice();",'Second Sleeve'],
  ['Card Up Each Cuff 6%',FXJ,"sd_8_1:[ {param:'cuff',add:R(0.05)} ]","sd_8_1:[ {param:'cuff',add:R(0.06)} ]",'Second Sleeve'],
  ['Marked Cards off',FXJ,"else if(Pp.mc&&marked(t)) thr=3;","",'Marked Cards'],
  ['Fast Draw 11%',FXJ,"hc_8_1:[ {param:'fd',add:R(0.10)} ]","hc_8_1:[ {param:'fd',add:R(0.11)} ]",'Marked Cards'],
  ['Back-to-Back off',FXJ,"o.b2bNext=!!(third&&Pp.b2b);","o.b2bNext=false;",'Marked Cards'],
  ['House Always Wins every 3rd',FXJ,"if(Pp.haw&&A.winOn(T,'soHe')) thr=2;","if(Pp.haw&&A.winOn(T,'soHe')) thr=3;",'Marked Cards'],
  ['Clean Deck stun 0.6 s',FXJ,"sd_5_3:[ {param:'cd.st',add:0.5}","sd_5_3:[ {param:'cd.st',add:0.6}",'Clean Deck'],
  ['Clean Deck heal 35%',FXJ,"{param:'cd.hl',add:0.30}","{param:'cd.hl',add:0.35}",'Clean Deck'],
  ['Shaking Paw 0.15 s',FXJ,"hc_6_4:[ {param:'st.add',add:R(0.1)} ]","hc_6_4:[ {param:'st.add',add:R(0.15)} ]",'Clean Deck'],
  ['stun: half its control resist',FXJ,"+(Pp['st.add']||0))*(1-cr))","+(Pp['st.add']||0))*(1-cr*0.5))",'Clean Deck'],
  ['House Rules 6%',FXJ,"sd_6_3:[ {param:'ab.k',add:R(0.05)} ]","sd_6_3:[ {param:'ab.k',add:R(0.06)} ]",'Clean Deck'],
  ['Broken Armour 5%',FXJ,"hc_7_3:[ {param:'ab.k',add:R(0.04)} ]","hc_7_3:[ {param:'ab.k',add:R(0.05)} ]",'Clean Deck'],
  ['Lowmere Luck 3%',FXJ,"sc_8_3:[ {param:'ll',add:R(0.02)} ]","sc_8_3:[ {param:'ll',add:R(0.03)} ]",'Clean Deck'],
  ['Last Chip below 35%',FXJ,"if(Pp.lchip&&u.hp<0.30*u.maxHp)","if(Pp.lchip&&u.hp<0.35*u.maxHp)",'Clean Deck'],
  ['armour break top 80%',FXJ,"SHRED_TOP=0.75,","SHRED_TOP=0.80,",'Clean Deck'],
  ['Green Lamp 5%',FXJ,"hc_10_1:[ {param:'hl.k',add:R(0.04)} ]","hc_10_1:[ {param:'hl.k',add:R(0.05)} ]",'Clean Deck'],
  ['Hard Cards 5%',FXJ,"hc_3_3:[ {param:'hv.k',add:R(0.04)} ]","hc_3_3:[ {param:'hv.k',add:R(0.05)} ]",'Clean Deck'],
  ['Edged Cards 4%',FXJ,"sd_2_2:[ {on:'out',if:{targetTeam:'enemy',fn:'mdCard'},more:R(0.03)} ]","sd_2_2:[ {on:'out',if:{targetTeam:'enemy',fn:'mdCard'},more:R(0.04)} ]",'Edged Cards'],
  ['Clean Throw on Grand Reveal too',FXJ,"sc_3_3:[ {on:'out',if:{targetTeam:'enemy',fn:'mdCard'}","sc_3_3:[ {on:'out',if:{targetTeam:'enemy',fn:'anyCard'}",'Grand Reveal: Fanned'],
  ['Spin the Deck 4%',FXJ,"hc_8_2:[ {on:'out',if:{targetTeam:'enemy',fn:'mdCard'},more:R(0.03)} ]","hc_8_2:[ {on:'out',if:{targetTeam:'enemy',fn:'mdCard'},more:R(0.04)} ]",'Edged Cards'],
  ['Second Card on the third',FXJ,"o.card.i===1); },","o.card.i===2); },",'Edged Cards'],
  ['Long Mark 0.5 s',FXJ,"sd_3_3:[ {param:'mark.add',add:R(0.4)} ]","sd_3_3:[ {param:'mark.add',add:R(0.5)} ]",'Edged Cards'],
  ['Quick Deal 0.2 s',FXJ,"sd_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ]","sd_8_2:[ {on:'cd',skill:'green',add:R(-0.2)} ]",'Edged Cards'],
  ['Quick Hands 0.2 s',FXJ,"sc_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ]","sc_8_2:[ {on:'cd',skill:'green',add:R(-0.2)} ]",'Edged Cards'],
  ['Fanned Deck 4%',FXJ,"sd_7_3:[ {on:'out',if:{targetTeam:'enemy',fn:'ultCard'},more:R(0.03)} ]","sd_7_3:[ {on:'out',if:{targetTeam:'enemy',fn:'ultCard'},more:R(0.04)} ]",'Grand Reveal: Fanned'],
  ['Giant Cards on any card',FXJ,"sc_7_3:[ {on:'out',if:{targetTeam:'enemy',fn:'ultCard'}","sc_7_3:[ {on:'out',if:{targetTeam:'enemy'}",'Grand Reveal: Fanned'],
  ['Deeper Mark on anyone',FXJ,"sd_4_2:[ {on:'out',if:{targetTeam:'enemy',fn:'tMarked'}","sd_4_2:[ {on:'out',if:{targetTeam:'enemy'}",'Grand Reveal: Fanned'],
  ['Steady Edge on every hit',FXJ,"sd_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'}","sd_10_1:[ {on:'out',if:{targetTeam:'enemy'}",'Grand Reveal: Fanned'],
  ['Point First below 45%',FXJ,"sd_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.40}","sd_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.45}",'Grand Reveal: Fanned'],
  ['Final Hand below 35%',FXJ,"sc_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.30}","sc_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.35}",'Grand Reveal: Fanned'],
  ['Fine Gloves off',FXJ,"sc_6_4:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.03)} ]","sc_6_4:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0)} ]",'Grand Reveal: Fanned'],
  ['Read the Table 3%',FXJ,"sd_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'tMarked'},critMore:R(0.02)} ]","sd_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'tMarked'},critMore:R(0.03)} ]",'crit damage'],
  ['Ace in the Cuff every hit',FXJ,"sd_12_4:[ {on:'out',once:'wave',","sd_12_4:[ {on:'out',",'crit damage'],
  ['Lucky Strike on every hit',FXJ,"hc_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'suitHit'}","hc_8_3:[ {on:'out',if:{targetTeam:'enemy'}",'crit damage'],
  ['Old Signatures 4%',FXJ,"sc_8_1:[ {on:'out',if:{targetTeam:'enemy',fn:'tSigned'},critMore:R(0.03)} ]","sc_8_1:[ {on:'out',if:{targetTeam:'enemy',fn:'tSigned'},critMore:R(0.04)} ]",'crit damage'],
  // ---- Honest Cards ----
  ['Wild Card 1 in 4',FXJ,"r.hc_1_1?0.2*(1+(Pp['wild.p']||0)):0","r.hc_1_1?0.25*(1+(Pp['wild.p']||0)):0",'The Joker'],
  ['Wild Odds as points',FXJ,"r.hc_1_1?0.2*(1+(Pp['wild.p']||0)):0","r.hc_1_1?(0.2+(Pp['wild.p']||0)):0",'The Joker'],
  ['Wild Pair off',FXJ,"      if(wild&&Pp.jw) T.fn.pair(A,T,u,t,suit,k0,{talent:true}); },","      },",'The Joker'],
  ['The Joker 5%',FXJ,"hc_1_1:[ {param:'wild.k',add:R(0.04)} ]","hc_1_1:[ {param:'wild.k',add:R(0.05)} ]",'The Joker'],
  ['Joker\'s Grin 6%',FXJ,"hc_6_1:[ {param:'wild.g',add:R(0.05)} ]","hc_6_1:[ {param:'wild.g',add:R(0.06)} ]",'The Joker'],
  ['Wild Chase 4 s',FXJ,"A.acts(T,u,[{window:'soWh',dur:3}],{u});","A.acts(T,u,[{window:'soWh',dur:4}],{u});",'The Joker'],
  ['Deal Me In off',FXJ,"const wp=(Pp.dmi&&A.winOn(T,'soHe'))?1:","const wp=(false)?1:",'The Joker'],
  ['Streak grows on another suit',FXJ,"suit===o.last)?Math.min(4,s0+1)","suit!==o.last)?Math.min(4,s0+1)",'Hot Hand'],
  ['Unbroken Run at 3',FXJ,"A.stGet(T,'soStr')>=4){ suit=o.last; n=3;","A.stGet(T,'soStr')>=3){ suit=o.last; n=3;",'Hot Hand'],
  ['Hot Hand 4%',FXJ,"hc_1_4:[ {param:'str.k',add:R(0.03)} ]","hc_1_4:[ {param:'str.k',add:R(0.04)} ]",'Hot Hand'],
  ['Running Hot 2%',FXJ,"hc_3_4:[ {stat:{aspd:R(0.01)},per:'soStr'} ]","hc_3_4:[ {stat:{aspd:R(0.02)},per:'soStr'} ]",'Hot Hand'],
  ['Winning Streak 0.5%',FXJ,"hc_5_4:[ {stat:{lifesteal:R(0.004)},per:'soStr'} ]","hc_5_4:[ {stat:{lifesteal:R(0.005)},per:'soStr'} ]",'Hot Hand'],
  ['Charmed Coat 2%',FXJ,"hc_7_1:[ {param:'dr.cc',add:R(0.015)} ]","hc_7_1:[ {param:'dr.cc',add:R(0.02)} ]",'Hot Hand'],
  ['Never Goes Cold keeps nothing',FXJ,"?Math.min(4,s0+1):Math.min(s0,Pp.ngc||0);","?Math.min(4,s0+1):0;",'Hot Hand'],
  ['Unbroken Run keeps the Streak',FXJ,"if(n===3) s1=Math.min(s0,Pp.ngc||0);","",'Hot Hand'],
  ['All In x3',FXJ,"two=Pp.don*(Pp.allin?2:1)*(Pp.hedge?0.5:1)","two=Pp.don*(Pp.allin?3:1)*(Pp.hedge?0.5:1)",'All or Nothing'],
  ['nothing never',FXJ,"none=Pp.hedge?0:Pp.don*(Pp.allin?2:1)","none=Pp.hedge?0:0",'All or Nothing'],
  ['Ride the Next One 11%',FXJ,"hc_4_2:[ {param:'lir',add:R(0.10)} ]","hc_4_2:[ {param:'lir',add:R(0.11)} ]",'All or Nothing'],
  ['Ride the Next One stays',FXJ,"if(o.lir>0){ k0+=o.lir; o.lir=0; }","if(o.lir>0){ k0+=o.lir; }",'All or Nothing'],
  ['Bust 4%',FXJ,"hc_6_2:[ {param:'bust',add:R(0.03),req:'hc_5_2'} ]","hc_6_2:[ {param:'bust',add:R(0.04),req:'hc_5_2'} ]",'All or Nothing'],
  ['Bust 4 s',FXJ,"A.setMark(T,u,t,'bust',{dur:3});","A.setMark(T,u,t,'bust',{dur:4});",'All or Nothing'],
  ['Bust on every enemy',FXJ,"if(Pp.bust&&A.markOf(u,t,'bust')) c.amt*=1+Pp.bust;","if(Pp.bust) c.amt*=1+Pp.bust;",'All or Nothing'],
  ['Fortune\'s Favourite 6 s',FXJ,"A.acts(T,u,[{window:'soFf',dur:5}],{u});","A.acts(T,u,[{window:'soFf',dur:6}],{u});",'All or Nothing'],
  ['Hedge the Bet: nothing as well',FXJ,"none=Pp.hedge?0:","none=Pp.hedge?Pp.don:",'Hedge the Bet'],
  ['Safe Money 2%',FXJ,"hc_6_3:[ {param:'safe',add:R(0.01)} ]","hc_6_3:[ {param:'safe',add:R(0.02)} ]",'Hedge the Bet'],
  ['Lucky Seven every 6th',FXJ,"if(Pp.l7&&o.d7%7===0)","if(Pp.l7&&o.d7%6===0)",'Lucky Seven'],
  ['Honest Hands 2%',FXJ,"hc_12_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.01),per:{fn:'hhN'}} ]","hc_12_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.02),per:{fn:'hhN'}} ]",'Lucky Seven'],
  ['Dealer\'s Choice up to 11',FXJ,"soDc:{max:10,wave:'reset'},","soDc:{max:11,wave:'reset'},",'Lucky Seven'],
  ['Dealer\'s Choice 0.5%',FXJ,"sd_12_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.004),per:'soDc'} ]","sd_12_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.005),per:'soDc'} ]",'Lucky Seven'],
  ['Gambler\'s Nerve 4%',FXJ,"hc_4_3:[ {param:'nrg.draw',add:R(0.03)} ]","hc_4_3:[ {param:'nrg.draw',add:R(0.04)} ]",'Lucky Seven'],
  ['Dealer\'s Patience 4%',FXJ,"sd_4_3:[ {param:'nrg.auto',add:R(0.03)} ]","sd_4_3:[ {param:'nrg.auto',add:R(0.04)} ]",'Lucky Seven'],
  ['Steady Breath on any enemy',FXJ,"if(Pp['nrg.mk']&&marked(t))","if(Pp['nrg.mk'])",'Lucky Seven'],
  // ---- Signed and Collected ----
  ['Signed on the second card',FXJ,"if(i===r.need-1&&e.alive){ if(has(T,SIGNED))","if(i===1&&e.alive){ if(has(T,SIGNED))",'Signed \\(Marked'],
  ['First Card Says Hello 2%',FXJ,"sc_1_1:[ {on:'out',if:{targetTeam:'enemy',fn:'tSigned'},more:R(0.015)} ]","sc_1_1:[ {on:'out',if:{targetTeam:'enemy',fn:'tSigned'},more:R(0.02)} ]",'Signed \\(Marked'],
  ['Witnessed 3%',FXJ,"sc_n1:[  {on:'out',if:{targetTeam:'enemy',fn:'anySigned'},more:0.02}","sc_n1:[  {on:'out',if:{targetTeam:'enemy',fn:'anySigned'},more:0.03}",'Signed \\(Marked'],
  ['Signed for the Team 2%',FXJ,"sc_7_1:[ {param:'sft',add:R(0.01)} ]","sc_7_1:[ {param:'sft',add:R(0.02)} ]",'Signed \\(Marked'],
  ['Signed in Ink 5%',FXJ,"sc_6_1:[ {param:'ink',add:R(0.04)} ]","sc_6_1:[ {param:'ink',add:R(0.05)} ]",'Signed \\(Marked'],
  ['Folded Cuff 3%',FXJ,"sc_12_4:[ {param:'dr.fc',add:R(0.02)} ]","sc_12_4:[ {param:'dr.fc',add:R(0.03)} ]",'Signed \\(Marked'],
  ['Deadline 0.6%',FXJ,"sc_10_1:[ {stat:{aspd:R(0.005)},per:{fn:'sgN4'}} ]","sc_10_1:[ {stat:{aspd:R(0.006)},per:{fn:'sgN4'}} ]",'Signed \\(Marked'],
  ['Collector\'s Nerve 2',FXJ,"sc_n2:[  {param:'cn',add:R(1)} ]","sc_n2:[  {param:'cn',add:R(2)} ]",'Signed \\(Marked'],
  ['Third Signs Them 10 s',FXJ,"op.markDur=((Pp.tst&&rec.sb)?9:","op.markDur=((Pp.tst&&rec.sb)?10:",'Third Signs Them'],
  ['Countersign 20%',FXJ,"op.mark=1+(op.mark-1)*1.1;","op.mark=1+(op.mark-1)*1.2;",'Third Signs Them'],
  ['Witnessed link off',FXJ,"{param:'wit',add:1,req:'sd_1_4'}","{param:'wit',add:0,req:'sd_1_4'}",'Third Signs Them'],
  ['Witnessed link without Counting Cards',FXJ,"{param:'wit',add:1,req:'sd_1_4'}","{param:'wit',add:1}",'Third Signs Them'],
  ['two Markers a death',FXJ,"if(M.length<3) M.push(T.s.wave); A.stSet(T,u,'soMk',M.length); }   // a Marker","M.push(T.s.wave); M.push(T.s.wave); A.stSet(T,u,'soMk',M.length); }   // a Marker",'Markers'],
  ['What\'s Owed 30%',FXJ,"const sh=0.25*rk(T,'sc_1_4')","const sh=0.30*rk(T,'sc_1_4')",'Markers'],
  ['Fourth Card 11%',FXJ,"sc_12_1:[ {param:'mk.4',add:R(0.10)} ]","sc_12_1:[ {param:'mk.4',add:R(0.11)} ]",'Markers'],
  ['Interest 4%',FXJ,"sc_5_4:[ {param:'int',add:R(0.03)} ]","sc_5_4:[ {param:'int',add:R(0.04)} ]",'Markers'],
  ['Marker Paid 3%',FXJ,"sc_7_4:[ {param:'mp',add:R(0.02)} ]","sc_7_4:[ {param:'mp',add:R(0.03)} ]",'Markers'],
  ['Called In off',FXJ,"if(T.P.ci){","if(false){",'Markers'],
  ['Good Coat 2%',FXJ,"sc_4_1:[ {param:'gc',add:R(0.01)} ]","sc_4_1:[ {param:'gc',add:R(0.02)} ]",'Markers'],
  ['Saving the Last 0.6%',FXJ,"sc_12_2:[ {stat:{atk:R(0.005)},per:'soStl'} ]","sc_12_2:[ {stat:{atk:R(0.006)},per:'soStl'} ]",'Markers'],
  ['Settling Up 6 s',FXJ,"A.acts(T,u,[{window:'soSu',dur:5}],{u});","A.acts(T,u,[{window:'soSu',dur:6}],{u});",'Markers'],
  ['Collector 2%',FXJ,"sc_3_4:[ {stat:{atk:R(0.01)},per:'soMk'} ]","sc_3_4:[ {stat:{atk:R(0.02)},per:'soMk'} ]",'Markers'],
  ['House Advantage 4%',FXJ,"sd_10_2:[ {param:'he.k',add:R(0.03)} ]","sd_10_2:[ {param:'he.k',add:R(0.04)} ]",'House Edge: House'],
  ['Run Them Down: the highest HP',FXJ,"if(!b||x.hp<b.hp) b=x;","if(!b||x.hp>b.hp) b=x;",'House Edge: House'],
  ['Run Them Down over a taunt',FXJ,"if((u.forcedTargetT||0)>0&&u.forcedTarget&&u.forcedTarget!==o.ftE) return; ","",'House Edge: House'],
  ['Run Them Down beyond his reach',FXJ,"if(!marked(x)||E.dist(u,x)>u.range) continue;","if(!marked(x)) continue;",'House Edge: House'],
  ['Long Chase 3%',FXJ,"sc_6_2:[ {stat:{move:R(0.02)},req:'sc_5_2'","sc_6_2:[ {stat:{move:R(0.03)},req:'sc_5_2'",'House Edge: House'],
  ['Long Chase without Run Them Down',FXJ,"req:'sc_5_2',if:{window:'soHe'}","if:{window:'soHe'}",'House Edge: House'],
  ['Scent of Endings 5%',FXJ,"fn:'tMarked',targetHpBelow:0.50},more:R(0.04)} ]","fn:'tMarked',targetHpBelow:0.50},more:R(0.05)} ]",'House Edge: House'],
  ['Scent of Endings outside House Edge',FXJ,"sc_4_2:[ {on:'out',if:{targetTeam:'enemy',window:'soHe',","sc_4_2:[ {on:'out',if:{targetTeam:'enemy',",'House Edge: House'],
  ['Wait Them Out 4 s',FXJ,"sc_5_3:[ {on:'kit',skill:HE,opt:{dur:{add:3}}}","sc_5_3:[ {on:'kit',skill:HE,opt:{dur:{add:4}}}",'Wait Them Out'],
  ['Wait Them Out never ends',FXJ,"if(w.t<=3+1e-9){ w.t=0;","if(false){ w.t=0;",'Wait Them Out'],
  ['Patient Fox 4%',FXJ,"sc_6_3:[ {param:'dr.pf',add:R(0.03)} ]","sc_6_3:[ {param:'dr.pf',add:R(0.04)} ]",'Wait Them Out'],
  ['Patient Fox without a marked enemy',FXJ,"if(Pp['dr.pf']&&Pp.wto&&A.winOn(T,'soHe')&&mk)","if(Pp['dr.pf']&&Pp.wto&&A.winOn(T,'soHe'))",'Wait Them Out'],
  ['Table Stakes 11%',FXJ,"sd_n2:[  {param:'ts',add:R(0.1)} ]","sd_n2:[  {param:'ts',add:R(0.11)} ]",'Table Stakes'],
  ['Table Stakes up to 16',FXJ,"TS_TOP=15;","TS_TOP=16;",'Table Stakes'],
  ['Everyone Signs 2%',FXJ,"sc_n3:[  {param:'es',add:R(0.01)} ]","sc_n3:[  {param:'es',add:R(0.02)} ]",'Table Stakes'],
  ['Everyone Signs counts an ally twice',FXJ,"if(L.length<4&&L.indexOf(s.uid)<0) L.push(s.uid);","if(L.length<4) L.push(s.uid);",'Table Stakes'],
  ['First Impression 7%',FXJ,"sc_12_3:[ {param:'fi',add:R(0.06)} ]","sc_12_3:[ {param:'fi',add:R(0.07)} ]",'Table Stakes'],
  ['First Impression on every card',FXJ,"if(!F[t.uid]){ F[t.uid]=1; c.amt*=1+Pp.fi; }","c.amt*=1+Pp.fi;",'Table Stakes'],
  ['Long Deal 4%',FXJ,"sd_n1:[  {param:'rng',add:R(0.03)} ]","sd_n1:[  {param:'rng',add:R(0.04)} ]",'Long Deal'],
  ['Poker Face 5% uncapped',FXJ,"hc_5_1:[ {on:'ccIn',less:R(0.04),upTo:0.20} ]","hc_5_1:[ {on:'ccIn',less:R(0.05)} ]",'Long Deal'],
  ['Grin and Bear It 4%',FXJ,"hc_12_3:[ {stat:{armor:R(0.03)},if:{selfHpBelow:0.5}} ]","hc_12_3:[ {stat:{armor:R(0.04)},if:{selfHpBelow:0.5}} ]",'Long Deal'],
  ['Lamp Flame 3%',FXJ,"sd_6_4:[ {param:'dr.lf',add:R(0.02)} ]","sd_6_4:[ {param:'dr.lf',add:R(0.03)} ]",'Long Deal'],
  ['Bluff from anyone',FXJ,"if(Pp['dr.bl']&&marked(s))","if(Pp['dr.bl'])",'Long Deal'],
  ['Gambler\'s Mark on every hit',FXJ,"fn:'suitMarked'},more:R(0.01)} ]","fn:'tMarked'},more:R(0.01)} ]",'Long Deal'],
  // ---- the signatures ----
  ['Every Card: no stun',FXJ,"for(const s of [HEAVY,STUN,ARMOR,HEAL])","for(const s of [HEAVY,ARMOR,HEAL])",'Every Card He Ever Palmed'],
  ['the signatures every 15 s',FXJ,"SHRED_TOP=0.75, SIG_CD=20,","SHRED_TOP=0.75, SIG_CD=15,",'Every Card He Ever Palmed'],
  ['Every Card: the palmed suits stay',FXJ,"if(e===r.list[0]&&r.palms){","if(false&&r.palms){",'Every Card He Ever Palmed'],
  ['Last Honest Hand at 1.5x',FXJ,"T.fn.draw(A,T,u,e,{sig:true,mul:2,rec:r});","T.fn.draw(A,T,u,e,{sig:true,mul:1.5,rec:r});",'Last Honest Hand'],
  ['Last Honest Hand: Streak 3',FXJ,"A.stSet(T,u,'soStr',4); } } },","A.stSet(T,u,'soStr',3); } } },",'Last Honest Hand'],
  ['the ace below 30%',FXJ,"ACE_AT=0.25,","ACE_AT=0.30,",'Stranger'],
  ['the ace on a boss 15%',FXJ,"ACE_BOSS=0.12,","ACE_BOSS=0.15,",'Stranger'],
  ['the ace: 2 Markers',FXJ,"for(let i=0;i<3;i++) if(M.length<3) M.push(T.s.wave);","for(let i=0;i<2;i++) if(M.length<3) M.push(T.s.wave);",'Stranger'],
  ['the ace on anyone',FXJ,"if(!signed(A,u,x)||!(x.hp<ACE_AT*x.maxHp)) continue;","if(!(x.hp<ACE_AT*x.maxHp)) continue;",'Stranger'],
  // ---- the caps and rules ----
  ['his group at 30%',FXJ,"DR_FLOOR=0.75,","DR_FLOOR=0.70,",'his caps'],
  ['crit at 6%',FXJ,"DR_FLOOR=0.75, CRIT_CAP=0.05,","DR_FLOOR=0.75, CRIT_CAP=0.06,",'his caps'],
  ['the heal budget 1.5%',FXJ,"DR_FLOOR=0.75, CRIT_CAP=0.05, REGEN=0.012,","DR_FLOOR=0.75, CRIT_CAP=0.05, REGEN=0.015,",'his caps'],
  ['his stuns up to 4.5 s',FXJ,"CC_TOP=4.0, SHRED_TOP=0.75,","CC_TOP=4.5, SHRED_TOP=0.75,",'his caps'],
  ['a talent stun on a stunned enemy',FXJ,"if(f.talent){ if((t.stunned||0)>0) return; const e=st[t.uid];","if(f.talent){ const e=st[t.uid];",'his caps'],
  ['no 0.5 s after his stun',FXJ,"if(e!=null&&now>=e-1e-9&&now<e+0.5) return;","",'his caps'],
  ['three times a cast',FXJ,"if((m[t.uid]||0)>=2) return;","if((m[t.uid]||0)>=3) return;",'his caps'],
  ['his stun stamps not in times',FXJ,"times:['so.st.*','so.rgAt'],","times:['so.rgAt'],",'across a wave']
];
const SKIP=new Set(['.tmp','.logs','.remote-logs','.git','.base','.bin','node_modules','assets','backups']);
/* the copy: our own walk (fs.cpSync refuses to copy a folder into one of its own subfolders, and the temp folder sits inside the slot) */
function copyTree(src,dst){ fs.mkdirSync(dst,{recursive:true}); for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(src===root&&(SKIP.has(e.name)||e.name.startsWith('.ctl-')||e.name.startsWith('.remote-'))) continue;
    const a=path.join(src,e.name), b=path.join(dst,e.name); if(e.isDirectory()) copyTree(a,b); else if(e.isFile()) fs.copyFileSync(a,b); } }
function count(c){ const s=fs.readFileSync(path.join(root,c[1]),'utf8'), eol=s.indexOf('\r\n')>=0?'\r\n':'\n'; return s.split(c[2].replace(/\n/g,eol)).length-1; }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-sorrelc-'));
  try{ copyTree(root,dir); if(fs.existsSync(path.join(root,'node_modules'))) fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'));
    const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), eol=s.indexOf('\r\n')>=0?'\r\n':'\n', a=from.replace(/\n/g,eol), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to.replace(/\n/g,eol)));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-sorrel.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1; return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.argv.includes('--list')){ let bad=0; for(const c of C){ const n=count(c); if(n!==1){ bad++; console.log('FOUND '+n+' TIMES: '+c[0]); } } console.log('controls: '+C.length+', texts not found exactly once: '+bad); process.exit(bad?1:0); }
if(process.env.ONLY){ const w=process.env.ONLY.split('|'); for(let k=C.length-1;k>=0;k--) if(!w.some(x=>C[k][0].indexOf(x)>=0)) C.splice(k,1); }
const out=[]; for(const c of C){ const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
