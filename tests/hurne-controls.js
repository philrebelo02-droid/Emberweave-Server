'use strict';
/* The controls for Hurne's talent tests (run on the cluster through tools/remote_test.sh as a plain node script). Each control copies this checkout into the
   temp folder (os.tmpdir(): the runner points it at the slot's own .tmp on disk), breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the
   generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a row or a cap of his broken), runs the named tests of
   tests/talents-mech-hurne.test.js in that copy, expects them to FAIL, and deletes the copy. ONE copy at a time. The checkout itself is never changed.
   Prints one line per control and a count; exits 1 if any control was not caught.
   CHECK=1: only checks that every text to break is found exactly once (no test is run). ONLY=<regex>: only the controls whose name matches. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const SITES='every page site', ID='no talents';
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['chant partPre removed',HTML,"if(_chO) TalentFx.partPre(_chO,h,'chant');",'',SITES+'|heals: Old Sow|Leave the Old Sow'],
  ['chant part removed',HTML,"      if(_chO) TalentFx.part(_chO,h,'chant');",'',SITES+'|heals: Old Sow'],
  ['castUltFree not bound',HTML,"TalentFx.bindMore({ castUltFree:u=>{","TalentFx.bindMore({ castUltX:u=>{",SITES+'|He Does It'],
  ['castUltFree at the wrong level',HTML,"lv=(u.skillLv&&u.skillLv[0])||1;\n    u._castLv=lv;","lv=1;\n    u._castLv=lv;",'He Does It'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the chant partPre site',HTML,"const _chO=(h.heal&&h.src","const _chO=((brnd(),h.heal)&&h.src",ID],
  ['draw at the chant part site',HTML,"      if(_chO) TalentFx.part(_chO,h,'chant');","      brnd(); if(_chO) TalentFx.part(_chO,h,'chant');",ID],
  // ---- Driven ----
  ['Point the Way 3% -> 4%',FXJ,"sw_1_1:[ {on:'sOut',if:{targetHas:'hDrv'},more:R(0.03)} ]","sw_1_1:[ {on:'sOut',if:{targetHas:'hDrv'},more:R(0.04)} ]",'Driven: Point'],
  ['Driven: summons do not turn',FXJ,"x.forcedTarget=d; x.forcedTargetT=0.2; W[x.uid]=d; } },","W[x.uid]=d; } },",'Driven: Point|live fight'],
  ['Driven: a taunt on a summon overridden',FXJ,"if((x.forcedTargetT||0)>0&&x.forcedTarget&&x.forcedTarget.alive&&!mineFt) continue;",'','Driven: Point'],
  ['Driven: not unique',FXJ,"do:[{mark:'hDrv',on:'target',unique:true}]}","do:[{mark:'hDrv',on:'target'}]}",'Driven: Point'],
  ['Drive Them 2% -> 3%',FXJ,"sw_3_1:[ {on:'out',if:{targetHas:'hDrv'},more:R(0.02)} ]","sw_3_1:[ {on:'out',if:{targetHas:'hDrv'},more:R(0.03)} ]",'Driven: Point'],
  ['Whistle 3% -> 4%',FXJ,"sw_5_1:[ {stat:{move:R(-0.03)}","sw_5_1:[ {stat:{move:R(-0.04)}",'Driven: Point'],
  ['Mark for the Herd 2% -> 3%',FXJ,"sw_7_1:[ {stat:{armor:R(-0.02)}","sw_7_1:[ {stat:{armor:R(-0.03)}",'Driven: Point'],
  ['Driven Hard 0.5% -> 0.6%',FXJ,"sw_10_1:[ {stat:{aspd:R(0.005)},per:{fn:'drvAtk'}} ]","sw_10_1:[ {stat:{aspd:R(0.006)},per:{fn:'drvAtk'}} ]",'Driven Hard'],
  ['Whole Valley: no new Driven',FXJ,"if(x) A.setMark(T,u,x,'hDrv',{unique:true}); A.acts(T,u,[{window:'hWv',dur:3}],c); },","A.acts(T,u,[{window:'hWv',dur:3}],c); },",'Driven Hard'],
  ['Whole Valley 3 s -> 4 s',FXJ,"A.acts(T,u,[{window:'hWv',dur:3}],c); },","A.acts(T,u,[{window:'hWv',dur:4}],c); },",'Driven Hard|Whole Valley: his'],
  ['Whole Valley 5% -> 6%',FXJ,"sw_12_1:[ {stat:{aspd:R(0.05)},to:MINE","sw_12_1:[ {stat:{aspd:R(0.06)},to:MINE",'Whole Valley: his'],
  ['Run It Down off',FXJ,"do:[{place:'unit',near:'holder:hDrv'}]} ]","do:[]} ]",'Driven Hard'],
  // ---- Kept Close ----
  ['Kept Close 4 m -> 5 m',FXJ,"const kcR=T=>4+(T.P['kc.m']||0);","const kcR=T=>5+(T.P['kc.m']||0);",'Kept Close'],
  ['Short Tether 0.5 m -> 0.4 m',FXJ,"{param:'kc.m',add:R(0.5)}","{param:'kc.m',add:R(0.4)}",'Kept Close'],
  ['Bring Them In 2% -> 3%',FXJ,"sw_1_4:[ {on:'sOut',if:{fn:'kcSrc'},more:R(0.02)} ]","sw_1_4:[ {on:'sOut',if:{fn:'kcSrc'},more:R(0.03)} ]",'Kept Close'],
  ['Patient Man at 1',FXJ,"kc2(A,T,u){ return kcN(A,T,u)>=2; },","kc2(A,T,u){ return kcN(A,T,u)>=1; },",'Kept Close'],
  ['Patient Man 2% -> 3%',FXJ,"sw_5_4:[ {stat:{mr:R(0.02)},if:{fn:'kc2'}} ]","sw_5_4:[ {stat:{mr:R(0.03)},if:{fn:'kc2'}} ]",'Kept Close'],
  ['Fed Well 0.4% -> 0.5%',FXJ,"heal:{pct:R(0.004),of:'tgtMaxHp'}","heal:{pct:R(0.005),of:'tgtMaxHp'}",'Kept Close'],
  ['Fed Well on every summon',FXJ,"on:{team:'ally',mine:true,fn:'kcX'}","on:{team:'ally',mine:true}",'Kept Close'],
  // ---- Packmaster ----
  ['Stay Together ignored',FXJ,"if(T.r.sw_3_4) N2+=kcN(A,T,u);",'','Packmaster:'],
  ['Packmaster\'s Weight: dealt ignored',FXJ,"xd:0.005*(T.r.sw_10_4||0)","xd:0",'Packmaster:'],
  ['Stand Before Them ignored',FXJ,"xs:0.005*((T.r.sw_10_4||0)+(T.r.br_2_2||0))","xs:0.005*((T.r.sw_10_4||0))",'Packmaster:'],
  ['Nothing Left to Lose at 4 Cost',FXJ,"A.stGet(T,'hCost')>=5) N2+=3;","A.stGet(T,'hCost')>=4) N2+=3;",'Packmaster:'],
  ['Nothing Left to Lose as 2',FXJ,"A.stGet(T,'hCost')>=5) N2+=3;","A.stGet(T,'hCost')>=5) N2+=2;",'Packmaster:'],
  ['his damage reduction cap 40% -> 50%',FXJ,"const DR_CAP=0.40, SDR_CAP=","const DR_CAP=0.50, SDR_CAP=",'Packmaster:'],
  ['Packmaster ignored without the passive',FXJ,"if(!(u.pass&&u.pass.packstats)) return null; const N=+u._packN||0","if(!(u.pass&&u.pass.packstats)) return null; const N=0",'Packmaster:'],
  // ---- his damage reduction group ----
  ['Hard to Stop 1% -> 2%',FXJ,"{param:'dr.hard',add:R(0.01)}","{param:'dr.hard',add:R(0.02)}",'No Name'],
  ['Thick Skin 1% -> 2%',FXJ,"{param:'dr.skin',add:R(0.01)}","{param:'dr.skin',add:R(0.02)}",'No Name'],
  ['Chain Mail 1% -> 2%',FXJ,"{param:'dr.mail',add:R(0.01)}","{param:'dr.mail',add:R(0.02)}",'No Name'],
  ['reductions added, not multiplied',FXJ,"f*=1-(Pm['dr.hard']||0); f*=1-(Pm['dr.skin']||0); f*=1-(Pm['dr.mail']||0);","f*=1-(Pm['dr.hard']||0)-(Pm['dr.skin']||0)-(Pm['dr.mail']||0);",'No Name'],
  ['Grim Patience at 15 s',FXJ,"E.now()-T.s.hWt>=20) f*=1-Pm['dr.grim'];","E.now()-T.s.hWt>=15) f*=1-Pm['dr.grim'];",'No Name'],
  ['Grim Patience 2% -> 3%',FXJ,"{param:'dr.grim',add:R(0.02)}","{param:'dr.grim',add:R(0.03)}",'No Name'],
  ['No Name for It at 50%',FXJ,"if:{selfHpBelow:0.4},more:R(0.02)}","if:{selfHpBelow:0.5},more:R(0.02)}",'No Name'],
  ['Swallowed Pain ignored',FXJ,"if(Pm['dr.pain']&&(u._devourT||0)>0) f*=1-Pm['dr.pain'];",'','Feed Them: Supper'],
  ['Swallowed Pain always on',FXJ,"if(Pm['dr.pain']&&(u._devourT||0)>0) f*=1-Pm['dr.pain'];","if(Pm['dr.pain']) f*=1-Pm['dr.pain'];",'Feed Them: Supper'],
  ['The Road Is Closed without the cover',FXJ,"if(Pm['dr.road']&&T.P.cover&&behindOne(A,T,u))","if(Pm['dr.road']&&T.P.cover)",'damage reduction: The Chains'],
  ['behind him reversed',FXJ,"Math.hypot(x.x-cx,x.y-cy)>du);","Math.hypot(x.x-cx,x.y-cy)<du);",'damage reduction: The Chains'],
  ['Carried shrug ignored',FXJ,"if(k>0) f/=1+k*A.stGet(T,'hCar');",'','Carried:'],
  ['Carried dealt ignored',FXJ,"const k=T.P['car.k']||0; if(k>0) c.amt*=1+k*A.stGet(T,'hCar'); },","},",'Carried:'],
  // ---- his warriors ----
  ['Armoured Herd 2% -> 3%',FXJ,"sw_2_3:[ {on:'summon',if:{unitKey:WK},do:[{unitStat:{hp:R(0.02)}","sw_2_3:[ {on:'summon',if:{unitKey:WK},do:[{unitStat:{hp:R(0.03)}",'his warriors'],
  ['Iron Tusks 4% -> 5%',FXJ,"sw_4_3:[ {on:'sOut',if:{srcKey:WK},more:R(0.04)} ]","sw_4_3:[ {on:'sOut',if:{srcKey:WK},more:R(0.05)} ]",'his warriors'],
  ['Three Strong 20% -> 25%',FXJ,"{unitStat:{hp:0.2,atk:0.2},on:'unit'}","{unitStat:{hp:0.25,atk:0.25},on:'unit'}",'his warriors'],
  ['Old Boars 3% -> 4%',FXJ,"{param:'dr.boar',add:R(0.03)}","{param:'dr.boar',add:R(0.04)}",'his warriors'],
  ['Called Back / Fed Herd ignored',FXJ,"opt:{dur:{add:P('w.dur',0)}}}","opt:{dur:{add:0}}}",'his warriors'],
  ['Called Back 0.5 -> 0.4 s',FXJ,"sw_8_3:[ {param:'w.dur',add:R(0.5)} ]","sw_8_3:[ {param:'w.dur',add:R(0.4)} ]",'his warriors'],
  ['Four of Them: 5 warriors',FXJ,"opt:{n:{set:4}}","opt:{n:{set:5}}",'Four of Them'],
  ['Four of Them 15% -> 10% weaker',FXJ,"{unitStat:{hp:-0.15,atk:-0.15},on:'unit'}","{unitStat:{hp:-0.10,atk:-0.10},on:'unit'}",'Four of Them'],
  ['Quick Unchaining 0.2 -> 0.3 s',FXJ,"sw_7_2:[ {on:'cd',skill:'green',add:R(-0.2)} ]","sw_7_2:[ {on:'cd',skill:'green',add:R(-0.3)} ]",'cooldowns'],
  ['Shallow Grave 0.3 -> 0.2 s',FXJ,"ft_10_2:[ {on:'cd',skill:'green',add:R(-0.3)} ]","ft_10_2:[ {on:'cd',skill:'green',add:R(-0.2)} ]",'cooldowns'],
  ['Sow\'s Patience 0.4 -> 0.5 s',FXJ,"sw_8_2:[ {on:'cd',skill:'blue',add:R(-0.4)} ]","sw_8_2:[ {on:'cd',skill:'blue',add:R(-0.5)} ]",'cooldowns'],
  ['Bone Fire 0.4 -> 0.3 s',FXJ,"br_4_3:[ {on:'cd',skill:'blue',add:R(-0.4)} ]","br_4_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ]",'cooldowns'],
  ['Bone Song 0.4 -> 0.5 s',FXJ,"sw_6_3:[ {on:'kit',skill:BC,opt:{dur:{add:R(0.4)}}} ]","sw_6_3:[ {on:'kit',skill:BC,opt:{dur:{add:R(0.5)}}} ]",'cooldowns'],
  ['Herd Instinct 4 s -> 5 s',FXJ,"{window:'hHi',dur:4}","{window:'hHi',dur:5}",'Herd Instinct'],
  ['Herd Instinct 5% -> 6%',FXJ,"{stat:{aspd:R(0.05)},to:MINE,if:{window:'hHi'}}","{stat:{aspd:R(0.06)},to:MINE,if:{window:'hHi'}}",'Herd Instinct'],
  ['Good at It 1% -> 2%',FXJ,"sw_12_2:[ {on:'sKill',do:[{heal:{pct:R(0.01)","sw_12_2:[ {on:'sKill',do:[{heal:{pct:R(0.02)",'Herd Instinct'],
  // ---- the Bone-Chanter ----
  ['her heals not stronger',FXJ,"chantHeal(A,T,u,c){ const k=T.P['ch.heal']||0; if(k>0) c.amt*=1+k; },","chantHeal(A,T,u,c){ },",'heals: Old Sow'],
  ['Old Sow\'s Care 4% -> 5%',FXJ,"{param:'ch.heal',add:R(0.04)}","{param:'ch.heal',add:R(0.05)}",'heals: Old Sow'],
  ['Old Sow\'s Heat 5% -> 6%',FXJ,"{param:'ch.heal',add:R(0.05)}","{param:'ch.heal',add:R(0.06)}",'heals: Old Sow'],
  ['The Whole Herd: no warrior',FXJ,"do:[{fn:'herdUp'}]}","do:[]}",'heals: Old Sow'],
  ['The Whole Herd: no far heal',FXJ,"{on:'part',skill:'chant',do:[{fn:'herdHeal'}]}","{on:'part',skill:'chant',do:[]}",'heals: Old Sow'],
  ['The Whole Herd: far heal not stronger',FXJ,"E.healUnit(x,h.heal*(1+(T.P['ch.heal']||0)));","E.healUnit(x,h.heal);",'heals: Old Sow'],
  // ---- his summons' damage reduction group ----
  ['Wall of Herd 3% -> 4%',FXJ,"{param:'dr.wall',add:R(0.03)}","{param:'dr.wall',add:R(0.04)}",'damage reduction: The Chains'],
  ['Shoulder to Shoulder 2% -> 3%',FXJ,"{param:'dr.shoul',add:R(0.02)}","{param:'dr.shoul',add:R(0.03)}",'damage reduction: The Chains'],
  ['Shoulder to Shoulder 6 m',FXJ,"if(Pm['dr.shoul']&&gapM(E,u,x)<3)","if(Pm['dr.shoul']&&gapM(E,u,x)<6)",'damage reduction: The Chains'],
  ['She Tends Them without her',FXJ,"if(Pm['dr.tend']&&shamanUp(A,T,u))","if(Pm['dr.tend'])",'damage reduction: The Chains'],
  ['She Tends Them 1% -> 2%',FXJ,"{param:'dr.tend',add:R(0.01)}","{param:'dr.tend',add:R(0.02)}",'damage reduction: The Chains'],
  ['The Chains on summons ignored',FXJ,"if(Pm['dr.chain']&&src&&A.markOf(u,src,'hCh')) f*=1-Pm['dr.chain'];",'','damage reduction: The Chains'],
  ['The Chains 1.5% -> 2%',FXJ,"{param:'dr.chain',add:R(0.015)}","{param:'dr.chain',add:R(0.02)}",'damage reduction: The Chains'],
  ['his summons\' cap 50% -> 60%',FXJ,"SDR_CAP=0.50,","SDR_CAP=0.60,",'damage reduction: The Chains'],
  ['Between Them ignored',FXJ,"if(Pm.cover&&behindOne(A,T,u)){ const p=pack(A,T,u); if(p) f/=1+p.N2*(p.b+p.xs); }",'','damage reduction: The Chains'],
  ['The Army: not half',FXJ,"if(A.winOn(T,'hArmy')) return 0.5;",'','The Army'],
  // ---- Nobody Walks Around ----
  ['the charge at 3 Kept Close',FXJ,"return kcN(A,T,u)>=4&&!!drvOf(A,T,u);","return kcN(A,T,u)>=3&&!!drvOf(A,T,u);",'Nobody Walks'],
  ['no stun-lock rule',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'hLk')) return false;","if(false) return false;",'Nobody Walks|Dragged Back|stun-lock'],
  ['the lock 0.5 s -> 0.3 s',FXJ,"A.setMark(T,u,t,'hLk',{dur:d+0.5});","A.setMark(T,u,t,'hLk',{dur:d+0.3});",'Nobody Walks'],
  ['the charge hits for 90%',FXJ,"A.hurt(T,u,d,(x.dmg||0),'#c9a227','nwa');","A.hurt(T,u,d,(x.dmg||0)*0.9,'#c9a227','nwa');",'Nobody Walks'],
  ['the charge stuns 0.4 s',FXJ,"if(d.alive) tstun(A,T,u,d,0.3); } },","if(d.alive) tstun(A,T,u,d,0.4); } },",'Nobody Walks'],
  ['the herd at 1 HP 7 s',FXJ,"{window:'hNwa',dur:6}","{window:'hNwa',dur:7}",'Nobody Walks'],
  ['the herd not held at 1 HP',FXJ,"{on:'teamLethal',if:{unitMine:true,window:'hNwa'},do:[{atOne:'unit'}]}","{on:'teamLethal',if:{unitMine:true,window:'hNwa'},do:[]}",'Nobody Walks'],
  ['the charge every 9 s',FXJ,"if:{fn:'chargeReady'},icd:25,","if:{fn:'chargeReady'},icd:9,",'Nobody Walks'],
  // ---- Cost and Carried ----
  ['Cost max 5 -> 6',FXJ,"hCost:{max:5},","hCost:{max:6},",'Cost: What'],
  ['2 Cost a cast',FXJ,"if(COST.some(id=>T.r[id])) A.stSet(T,u,'hCost',A.stGet(T,'hCost')+1);","if(COST.some(id=>T.r[id])) A.stSet(T,u,'hCost',A.stGet(T,'hCost')+2);",'Cost: What'],
  ['What It Costs 2% -> 3%',FXJ,"ft_1_1:[ {stat:{atk:R(0.02)},per:'hCost'} ]","ft_1_1:[ {stat:{atk:R(0.03)},per:'hCost'} ]",'Cost: What'],
  ['Pay Gladly 0.5% -> 0.6%',FXJ,"ft_2_1:[ {stat:{lifesteal:R(0.005)},per:'hCost'} ]","ft_2_1:[ {stat:{lifesteal:R(0.006)},per:'hCost'} ]",'Cost: What'],
  ['Cost Taken 0.3% -> 0.4%',FXJ,"ft_10_1:[ {stat:{hp:R(0.003)},per:'hCost'} ]","ft_10_1:[ {stat:{hp:R(0.004)},per:'hCost'} ]",'Cost: What'],
  ['Overfed at 4 Cost',FXJ,"if:{stackMin:{hCost:5}},opt:{radius:{addM:2}}","if:{stackMin:{hCost:4}},opt:{radius:{addM:2}}",'Cost: What'],
  ['Overfed 4 m',FXJ,"if:{stackMin:{hCost:5}},opt:{radius:{addM:2}}","if:{stackMin:{hCost:5}},opt:{radius:{addM:1}}",'Cost: What'],
  ['Smoke of the Feast 4% -> 5%',FXJ,"ft_n1:[  {on:'out',if:{casting:FT},more:0.04,per:'hCost'},","ft_n1:[  {on:'out',if:{casting:FT},more:0.05,per:'hCost'},",'Smoke of the Feast'],
  ['Smoke: Smoulder without Her Young',FXJ,"{on:'hit',req:'br_1_4',if:{casting:FT,","{on:'hit',if:{casting:FT,",'Smoke of the Feast'],
  ['Smoke: 3 Smoulder',FXJ,"do:[{ustack:'hSmo',on:'target',add:2}]} ],","do:[{ustack:'hSmo',on:'target',add:3}]} ],",'Smoke of the Feast'],
  ['Take Them All: 1 for her',FXJ,"const k=f.n+(T.P.sow2?f.sow:0);","const k=f.n;",'Carried:'],
  ['Stored Herd ignored',FXJ,"ft_11_2:[ {param:'car.max',add:R(1)} ]","ft_11_2:[ {param:'car.max',add:R(0)} ]",'Carried:'],
  ['Carried kept between waves',FXJ,"hCar:{max:P('car.max',6),wave:'reset'},","hCar:{max:P('car.max',6)},",'Carried:'],
  ['Heavy With Them 0.5% -> 0.6%',FXJ,"ft_2_2:[ {stat:{aspd:R(0.005)},per:'hCar'} ]","ft_2_2:[ {stat:{aspd:R(0.006)},per:'hCar'} ]",'Carried:'],
  ['Old Oath 2% -> 3%',FXJ,"ft_5_1:[ {stat:{mr:R(0.02)},if:{stackMin:{hCar:1}}} ]","ft_5_1:[ {stat:{mr:R(0.03)},if:{stackMin:{hCar:1}}} ]",'Carried:'],
  ['Nothing Wasted 2% -> 3%',FXJ,"ft_6_3:[ {param:'sowSh',add:R(0.02)} ]","ft_6_3:[ {param:'sowSh',add:R(0.03)} ]",'Carried:'],
  ['Carry Their Strength 0.6% -> 0.7%',FXJ,"ft_1_2:[ {param:'car.k',add:R(0.006)} ]","ft_1_2:[ {param:'car.k',add:R(0.007)} ]",'Carried:'],
  ['Full Belly at 5',FXJ,"stackMin:{hCar:6},targetTeam:'enemy'}","stackMin:{hCar:5},targetTeam:'enemy'}",'Full Belly'],
  ['Full Belly 6% -> 7%',FXJ,"dmg:{pct:R(0.06),of:'hit'}","dmg:{pct:R(0.07),of:'hit'}",'Full Belly'],
  ['Full Belly within 3 m',FXJ,"on:{team:'enemy',of:'target',within:1.5,skip:'target'},tag:'belly'","on:{team:'enemy',of:'target',within:30,skip:'target'},tag:'belly'",'Full Belly'],
  // ---- Feed Them's riders ----
  ['Torn Open 5% -> 6%',FXJ,"ft_4_2:[ {on:'out',if:{casting:FT},more:R(0.05)} ]","ft_4_2:[ {on:'out',if:{casting:FT},more:R(0.06)} ]",'the rupture'],
  ['Swallow the Pack 3% -> 4%',FXJ,"br_10_2:[ {on:'out',if:{casting:FT},more:R(0.03)} ]","br_10_2:[ {on:'out',if:{casting:FT},more:R(0.04)} ]",'the rupture'],
  ['Last Meal below 30%',FXJ,"if:{casting:FT,targetHpBelow:0.5},more:R(0.03)}","if:{casting:FT,targetHpBelow:0.3},more:R(0.03)}",'the rupture'],
  ['Bitter Meat 10% -> 12%',FXJ,"do:[{slow:R(0.10),dur:2,on:'target'}]","do:[{slow:R(0.12),dur:2,on:'target'}]",'the rupture'],
  ['Bitter Meat 3 s',FXJ,"do:[{slow:R(0.10),dur:2,on:'target'}]","do:[{slow:R(0.10),dur:3,on:'target'}]",'the rupture'],
  ['Shared Grave 1% -> 2%',FXJ,"ft_12_4:[ {on:'hit',if:{casting:FT,targetTeam:'enemy'},do:[{heal:{pct:R(0.01)","ft_12_4:[ {on:'hit',if:{casting:FT,targetTeam:'enemy'},do:[{heal:{pct:R(0.02)",'the rupture'],
  ['Supper Table 3% -> 4%',FXJ,"opt:{healPct:{more:R(0.03)}}","opt:{healPct:{more:R(0.04)}}",'Feed Them: Supper'],
  ['Thick Neck 3% -> 4%',FXJ,"opt:{shieldPct:{more:R(0.03)}}","opt:{shieldPct:{more:R(0.04)}}",'Feed Them: Supper'],
  ['Grave Dirt without the shield',FXJ,"return A.winOn(T,'hFsh')&&(u.shield||0)>0; },","return A.winOn(T,'hFsh'); },",'Feed Them: Supper'],
  ['Grave Dirt 3% -> 4%',FXJ,"ft_3_3:[ {stat:{armor:R(0.03)},if:{fn:'fedShield'}} ]","ft_3_3:[ {stat:{armor:R(0.04)},if:{fn:'fedShield'}} ]",'Feed Them: Supper'],
  ['Strength in Every Blow 0.4 -> 0.5 s',FXJ,"{field:'_devourT',add:R(0.4),","{field:'_devourT',add:R(0.5),",'Feed Them: Supper'],
  ['Raw Hands 2% -> 3%',FXJ,"ft_10_3:[ {stat:{aspd:R(0.02)},if:{selfMin:{_devourT:0.001}}} ]","ft_10_3:[ {stat:{aspd:R(0.03)},if:{selfMin:{_devourT:0.001}}} ]",'Feed Them: Supper'],
  ['Swallowed Pain 2% -> 3%',FXJ,"ft_8_2:[ {param:'dr.pain',add:R(0.02)} ]","ft_8_2:[ {param:'dr.pain',add:R(0.03)} ]",'Feed Them: Supper'],
  ['Call Them Again: not the Bone-Chanter',FXJ,"do:[{cd:'green',set:0},{cd:'blue',set:0}]} ]","do:[{cd:'green',set:0}]} ]",'Feed Them: Supper'],
  ['Unbreakable Oath: slows land',FXJ,"if:{cc:['stunned','slow'],selfMin:{_devourT:0.001}},mul:0}","if:{cc:['stunned'],selfMin:{_devourT:0.001}},mul:0}",'Unbreakable'],
  ['Unbreakable Oath: always',FXJ,"if:{cc:['stunned','slow'],selfMin:{_devourT:0.001}},mul:0}","if:{cc:['stunned','slow']},mul:0}",'Unbreakable'],
  ['Leave the Old Sow: she is taken',FXJ,"if(x.key===SK&&T.P.keepSow){","if(false){",'Leave the Old Sow'],
  ['Leave the Old Sow 30% -> 25%',FXJ,"selfMin:{_devourT:0.001}},more:0.30}","selfMin:{_devourT:0.001}},more:0.25}",'Leave the Old Sow'],
  ['Leave the Old Sow: always',FXJ,"if:{casting:'chant',selfMin:{_devourT:0.001}},more:0.30}","if:{casting:'chant'},more:0.30}",'Leave the Old Sow'],
  ['Leave the Old Sow: she is not given back at once',FXJ,"if(f) for(const x of f.keep) if(x.alive&&!x._summonOwner) x._summonOwner=u;",'','Leave the Old Sow'],
  // ---- He Does It Anyway ----
  ['He Does It Anyway at 35%',FXJ,"if:{selfHpBelow:0.30},do:[{fn:'anyway'}]}","if:{selfHpBelow:0.35},do:[{fn:'anyway'}]}",'He Does It'],
  ['He Does It Anyway every 20 s',FXJ,"s.hAnyT=now+30;","s.hAnyT=now+20;",'He Does It'],
  ['He Does It Anyway: 4% shield a summon',FXJ,"{shield:{pct:0.05*f.n,of:'maxHp'}","{shield:{pct:0.04*f.n,of:'maxHp'}",'He Does It'],
  ['He Does It Anyway: heals to 35%',FXJ,"if(u.hp<0.4*u.maxHp) E.healUnit(u,0.4*u.maxHp-u.hp);","if(u.hp<0.35*u.maxHp) E.healUnit(u,0.35*u.maxHp-u.hp);",'He Does It'],
  ['He Does It Anyway: Carried not filled',FXJ,"A.stSet(T,u,'hCar',A.stMax(T,u,'hCar'));",'','He Does It'],
  ['He Does It Anyway: Unchain not ready',FXJ,"A.stSet(T,u,'hCost',A.stGet(T,'hCost')+1); }\n      u.greenCd=0; },","A.stSet(T,u,'hCost',A.stGet(T,'hCost')+1); }\n      },",'He Does It'],
  // ---- crit, slows, controls ----
  ['crit cap 5 -> 6',FXJ,"CRIT_CAP=5;","CRIT_CAP=6;",'crit chance'],
  ['Grave Grip: no room rule',FXJ,"return 0.01*Math.max(0,Math.min(T.r.br_7_3||0,CRIT_CAP-used)); },","return 0.01*(T.r.br_7_3||0); },",'crit chance'],
  ['Grave Grip at 2 Smoulder',FXJ,"br_7_3:[ {on:'crit',if:{targetUst:{hSmo:3}}","br_7_3:[ {on:'crit',if:{targetUst:{hSmo:2}}",'crit chance'],
  ['slow cap 40% -> 50%',FXJ,"SDR_CAP=0.50, SLOW_CAP=0.40,","SDR_CAP=0.50, SLOW_CAP=0.50,",'slows on him'],
  ['Steady Man 4% -> 5%',FXJ,"sw_11_4:[ {param:'slw',add:R(0.04)} ]","sw_11_4:[ {param:'slw',add:R(0.05)} ]",'slows on him'],
  ['Unmoved Man 4% -> 5%',FXJ,"br_4_1:[ {on:'ccIn',less:R(0.04)} ]","br_4_1:[ {on:'ccIn',less:R(0.05)} ]",'slows on him'],
  // ---- Chained ----
  ['every hit chains',FXJ,"{on:'hit',reqAny:CH,if:{auto:true,targetTeam:'enemy',targetAlive:true},do:[{fn:'chain'}]}","{on:'hit',reqAny:CH,if:{targetTeam:'enemy',targetAlive:true},do:[{fn:'chain'}]}",'Chained:'],
  ['a chain 4 s',FXJ,"A.setMark(T,u,x,'hCh',{dur:3+(T.P['ch.dur']||0)});","A.setMark(T,u,x,'hCh',{dur:4+(T.P['ch.dur']||0)});",'Chained:'],
  ['Iron Links 0.5 -> 0.6 s',FXJ,"br_6_1:[ {param:'ch.dur',add:R(0.5)} ]","br_6_1:[ {param:'ch.dur',add:R(0.6)} ]",'Chained:'],
  ['Shorter Chain 1 -> 0.5 m',FXJ,"br_2_1:[ {param:'ch.short',add:R(1)} ]","br_2_1:[ {param:'ch.short',add:R(0.5)} ]",'Chained:'],
  ['the leash off',FXJ,"        A.acts(T,u,[{pull:'target',to:'self',m:g-Lm,secs:0.1}],{u,tgt:x}); } },","        } },",'Chained:'],
  ['Rattle 3% -> 4%',FXJ,"br_9_1:[ {stat:{move:R(-0.03)}","br_9_1:[ {stat:{move:R(-0.04)}",'Chained:'],
  ['Pulling Weight 2% -> 3%',FXJ,"br_7_1:[ {on:'out',if:{auto:true,targetHas:'hCh'},more:R(0.02)} ]","br_7_1:[ {on:'out',if:{auto:true,targetHas:'hCh'},more:R(0.03)} ]",'Chained:'],
  ['Weighted Fists 2% -> 3%',FXJ,"br_3_3:[ {stat:{atk:R(0.02)},if:{fn:'anyCh'}} ]","br_3_3:[ {stat:{atk:R(0.03)},if:{fn:'anyCh'}} ]",'Chained:'],
  ['Swineherd\'s Grip up to 4',FXJ,"chN3(A,T,u){ return Math.min(3,chainedL(A,T,u).length); },","chN3(A,T,u){ return Math.min(4,chainedL(A,T,u).length); },",'Chained:'],
  ['Dragged Back off',FXJ,"if(T.P.drag&&now>=(Q[x.uid]||0)","if(false&&now>=(Q[x.uid]||0)",'Dragged Back'],
  ['Dragged Back every 3 s',FXJ,"Q[x.uid]=now+5;","Q[x.uid]=now+3;",'Dragged Back'],
  ['Dragged Back 0.6 s',FXJ,"tstun(A,T,u,x,0.5); continue; }","tstun(A,T,u,x,0.6); continue; }",'Dragged Back'],
  ['Hold the Road on every chain',FXJ,"if(!had) A.run(T,u,'chNew',","A.run(T,u,'chNew',",'Hold the Road'],
  ['Hold the Road 1.5 s',FXJ,"br_5_2:[ {on:'chNew',do:[{taunt:1,on:'target'}]} ]","br_5_2:[ {on:'chNew',do:[{taunt:1.5,on:'target'}]} ]",'Hold the Road'],
  ['Let Them Through 20% -> 25%',FXJ,"P('ltt',0.20)","P('ltt',0.25)",'Hold the Road'],
  ['Let Them Through every hit',FXJ,"by:'source',icd:0.5,do:","by:'source',do:",'Hold the Road'],
  ['Price of Passing 5% -> 6%',FXJ,"br_6_3:[ {param:'ltt',add:R(0.05)} ]","br_6_3:[ {param:'ltt',add:R(0.06)} ]",'Hold the Road'],
  ['Short Leash 0.24% -> 0.3%',FXJ,"icd:1,do:[{heal:{pct:R(0.0024),of:'maxHp'}}]} ]","icd:1,do:[{heal:{pct:R(0.003),of:'maxHp'}}]} ]",'Hold the Road'],
  ['Short Leash every hit',FXJ,"if:{srcHas:'hCh'},icd:1,do:","if:{srcHas:'hCh'},do:",'Hold the Road'],
  // ---- Smoulder ----
  ['Smoulder without the Bone-Chanter',FXJ,"if(S.length&&src.length) for(const x of F)","if(src.length) for(const x of F)",'Smoulder:'],
  ['Smoulder within 4 m',FXJ,"gapM(E,w,x)<1.5)) addSmo(A,T,u,x,1);","gapM(E,w,x)<4)) addSmo(A,T,u,x,1);",'Smoulder:'],
  ['Smoulder max 5 -> 6',FXJ,"max:P('smo.max',5),","max:P('smo.max',6),",'Smoulder:'],
  ['Her Young 2% -> 3%',FXJ,"br_1_4:[ {param:'smo.burn',add:R(0.02)} ]","br_1_4:[ {param:'smo.burn',add:R(0.03)} ]",'Smoulder:'],
  ['Slow Embers 0.4 -> 0.5 s',FXJ,"br_3_4:[ {param:'smo.f',add:R(0.4)} ]","br_3_4:[ {param:'smo.f',add:R(0.5)} ]",'Smoulder:'],
  ['Smoulder fades all at once',FXJ,"dur:P('smo.f',1.5),step:P('smo.f',1.5)}","dur:P('smo.f',1.5)}",'Smoulder:'],
  ['Ash in the Air 0.5% -> 0.6%',FXJ,"br_5_4:[ {stat:{aspd:R(-0.005)}","br_5_4:[ {stat:{aspd:R(-0.006)}",'Smoulder:'],
  ['Hot Bristles at 4',FXJ,"br_7_4:[ {on:'sOut',if:{targetUst:{hSmo:5}}","br_7_4:[ {on:'sOut',if:{targetUst:{hSmo:4}}",'Smoulder:'],
  ['Ash Underfoot off',FXJ,"src=T.P.sowSmo?W.concat(S):W;","src=W;",'Smoulder:'],
  ['Embers Spread 1 -> 2',FXJ,"br_10_4:[ {param:'embers',add:R(1)} ]","br_10_4:[ {param:'embers',add:R(2)} ]",'Smoulder:'],
  ['Whole Hillside 1 -> 2',FXJ,"br_12_4:[ {param:'smo.max',add:R(1)} ]","br_12_4:[ {param:'smo.max',add:R(2)} ]",'Smoulder:'],
  // ---- The Army That Did Not Stop ----
  ['The Army from a ranged hit',FXJ,"if:{targetMine:true,srcTeam:'enemy',srcMelee:true},icd:25,","if:{targetMine:true,srcTeam:'enemy'},icd:25,",'The Army'],
  ['The Army every 10 s',FXJ,"srcMelee:true},icd:25,","srcMelee:true},icd:10,",'The Army'],
  ['The Army within 12 m',FXJ,"for(const x of A.pick(T,u,{team:'enemy',within:6},c))","for(const x of A.pick(T,u,{team:'enemy',within:12},c))",'The Army'],
  ['The Army: 4 Smoulder',FXJ,"addSmo(A,T,u,x,5); } }","addSmo(A,T,u,x,4); } }",'The Army'],
  ['The Army: no drag',FXJ,"A.acts(T,u,[{pull:'target',to:'self',m:2,secs:0.3}],{u,tgt:x}); addSmo","addSmo",'The Army'],
  ['The Army 6 s',FXJ,"A.acts(T,u,[{window:'hArmy',dur:5}],c);","A.acts(T,u,[{window:'hArmy',dur:6}],c);",'The Army']
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-logs']);
/* a plain recursive copy (fs.cpSync refuses to copy a folder into one of its own subfolders, and the temp folder may sit inside the checkout) */
function copyDir(src,dst,top){ fs.mkdirSync(dst,{recursive:true});
  for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(top&&(SKIP.has(e.name)||/^\.(ctl|remote|test)-/.test(e.name))) continue; const s=path.join(src,e.name), d=path.join(dst,e.name);
    if(e.isDirectory()) copyDir(s,d,false); else if(e.isFile()) fs.copyFileSync(s,d); } }
function copyTo(dir){ copyDir(root,dir,true); for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function count(file,from){ const s=fs.readFileSync(path.join(root,file),'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'); return s.split(a).length-1; }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-huc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-hurne.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.env.CHECK){ let bad=0; for(const c of C){ const n=count(c[1],c[2]); if(n!==1){ bad++; console.log('NOT ONCE ('+n+'): '+c[0]); } } console.log(C.length+' controls, '+bad+' texts not found exactly once'); process.exit(bad?1:0); }
const only=process.env.ONLY?new RegExp(process.env.ONLY):null; let caught=0, miss=0;
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); if(r.ok) caught++; else miss++; console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
console.log('controls: '+caught+' of '+(caught+miss)+' caught'); process.exit(miss?1:0);
