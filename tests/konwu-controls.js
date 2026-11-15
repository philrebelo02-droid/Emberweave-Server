'use strict';
/* The controls for KonWu's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder (os.tmpdir(), which follows TMPDIR), breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page
   hook removed, a guard made unguarded with a seeded draw, a row or a cap of his broken), runs the named tests of tests/talents-mech-konwu.test.js in that copy,
   and expects them to FAIL. ONE copy at a time (no parallel child processes); each copy is deleted when its run is done; node_modules and assets are symlinked,
   .logs is not copied. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   Run: node tests/konwu-controls.js [name filter] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', DRAW='brnd();';
const BLK="  if(u._tal&&u._tal.on.skillTgt) tg=TalentFx.skillTgt(u,'blink',tg,o)||tg;";
const LP="  if(u._tal) TalentFx.landPre(u,tg,'blink');", LD="  if(u._tal) TalentFx.land(u,tg,'blink');";
const PSS="  if(u._tal&&u._tal.on.pass) TalentFx.pass(u,tg,'kick'); }";
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['blink target hook removed',HTML,BLK,'','Thrown Down Again|crit-chance'],
  ['kick landPre removed',HTML,LP,'','the kick:|Hard Landing'],
  ['kick land removed',HTML,LD,'','the kick:'],
  ['kick pass removed',HTML,PSS,'  }','Hard Landing|the chase:'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the blink target',HTML,BLK,'  '+DRAW+BLK.slice(1),'no talents'],
  ['draw before the kick',HTML,LP,'  '+DRAW+LP.slice(1),'no talents'],
  ['draw after the kick',HTML,LD,'  '+DRAW+LD.slice(1),'no talents'],
  ['draw at the kick end',HTML,PSS,'  '+DRAW+PSS.slice(1),'no talents'],
  // ---- Insult ----
  ['Insolence 4%',FXJ,"nf_1_4:[ {on:'out',if:{targetHas:'kwIns'},more:R(0.03)} ],","nf_1_4:[ {on:'out',if:{targetHas:'kwIns'},more:R(0.04)} ],",'Insult:'],
  ['Insult 7 s',FXJ,"A.setMark(T,u,t,'kwIns',{dur:6+(T.P['ins.dur']||0),longest:true});","A.setMark(T,u,t,'kwIns',{dur:7+(T.P['ins.dur']||0),longest:true});",'Insult:'],
  ['Lingering Slight 0.7 s',FXJ,"{param:'ins.dur',add:R(0.6)}","{param:'ins.dur',add:R(0.7)}",'Insult:'],
  ['Spite of Heaven 2%',FXJ,"{param:'dr.sp',add:R(0.015)}","{param:'dr.sp',add:R(0.02)}",'Insult:'],
  ['Wide Grin every hit',FXJ,"critMore:R(0.05),do:[{mark:'kwWg',on:'target',clear:true}]}","critMore:R(0.05)}",'Insult:'],
  ['Earned Disdain up to 4',FXJ,"per:{units:{team:'enemy',has:'kwIns'},max:3}}","per:{units:{team:'enemy',has:'kwIns'},max:4}}",'Insult:'],
  ['Old Slight 3%',FXJ,"nf_12_1:[ {on:'out',if:{targetHas:'kwIns'},critMore:R(0.02)} ],","nf_12_1:[ {on:'out',if:{targetHas:'kwIns'},critMore:R(0.03)} ],",'Insult:'],
  // ---- Hard Landing and the kick ----
  ['Hard Landing at once',FXJ,"A.acts(T,u,[{after:0.35,do:[{fn:'hlLand'}]}]","A.acts(T,u,[{after:0,do:[{fn:'hlLand'}]}]",'Hard Landing:'],
  ['Long Way Down 1.2%',FXJ,"nf_1_1:[ {param:'hl.k',add:R(0.01)} ],","nf_1_1:[ {param:'hl.k',add:R(0.012)} ],",'Hard Landing:'],
  ['Down Hard 5%',FXJ,"{param:'hl.ins',add:R(0.04)}","{param:'hl.ins',add:R(0.05)}",'Hard Landing:'],
  ['Stone in Flight link 7%',FXJ,"{param:'sf.hl',req:'nf_1_1',add:0.06}","{param:'sf.hl',req:'nf_1_1',add:0.07}",'Hard Landing:'],
  ['Broken Ground 5%',FXJ,"{param:'hl.slow',add:R(0.04)}","{param:'hl.slow',add:R(0.05)}",'Hard Landing:'],
  ['Further Down 0.6 m',FXJ,"opt:{knock:{addM:R(0.5)}}","opt:{knock:{addM:R(0.6)}}",'Hard Landing:'],
  ['Into the Crowd 7 m',FXJ,"-E.bodyR(x)-E.bodyR(t)<M) hit.push(x);","-E.bodyR(x)-E.bodyR(t)<7*M) hit.push(x);",'Into the Crowd'],
  ['Into the Crowd 0.6 s',FXJ,"tstun(A,T,u,hit,0.5);","tstun(A,T,u,hit,0.6);",'Into the Crowd|Ringing Ears'],
  ['break rule without the 0.5 s',FXJ,"if((t.stunned||0)>0||mk(u,t,'kwLk',now)) continue; A.control","if((t.stunned||0)>0) continue; A.control",'Into the Crowd'],
  ['break rule mark never written',FXJ,"A.setMark(T,u,t,'kwLk',{dur:(t.stunned||0)+0.5,longest:true});","",'Into the Crowd'],
  ['Dropkick Form 4%',FXJ,"nf_6_2:[ {on:'out',if:{casting:PS},more:R(0.03)} ],","nf_6_2:[ {on:'out',if:{casting:PS},more:R(0.04)} ],",'the kick:'],
  ['Back on His Feet 1.2%',FXJ,"nf_10_4:[ {on:'land',skill:PS,do:[{heal:{pct:R(0.01),","nf_10_4:[ {on:'land',skill:PS,do:[{heal:{pct:R(0.012),",'the kick:'],
  ['Nothing Hurt 4 s',FXJ,"{shield:{pct:R(0.02),of:'maxHp'},dur:3}","{shield:{pct:R(0.02),of:'maxHp'},dur:4}",'the kick:'],
  ['Second Step 4 s',FXJ,"A.setMark(T,u,t,'kwSs',{dur:3});","A.setMark(T,u,t,'kwSs',{dur:4});",'the kick:'],
  ['Second Step: not on the kick\'s kill',FXJ,"if(!t.alive){ u.blueCd=Math.max(0,(u.blueCd||0)-3); return; }","if(!t.alive){ return; }",'the kick:'],
  ['Monkey\'s Reach 0.5 m',FXJ,"nf_4_1:[ {on:'kit',skill:PS,opt:{range:{addM:R(1)}}} ],","nf_4_1:[ {on:'kit',skill:PS,opt:{range:{addM:R(0.5)}}} ],",'the kick:'],
  ['Deep Breath 0.25 s',FXJ,"nf_11_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ],","nf_11_3:[ {on:'cd',skill:'blue',add:R(-0.25)} ],",'the kick:'],
  ['Ringing Ears 0.07 s',FXJ,"{param:'re',add:R(0.06)}","{param:'re',add:R(0.07)}",'Ringing Ears|Landslide'],
  ['Echo of the Fall 0.12 s',FXJ,"{param:'echo',add:R(0.1)}","{param:'echo',add:R(0.12)}",'Ringing Ears'],
  ['stun ceiling 5 s',FXJ,"DR_CAP=0.70, CRIT_CAP=0.05, STUN_TOP=4.0,","DR_CAP=0.70, CRIT_CAP=0.05, STUN_TOP=5.0,",'Ringing Ears'],
  ['Landslide 5%',FXJ,"c.amt*=1+0.04*o.kk.n;","c.amt*=1+0.05*o.kk.n;",'Landslide'],
  ['Landslide 0.12 s',FXJ,"Math.min(STUN_TOP,t.stunned+0.1*kk.n)","Math.min(STUN_TOP,t.stunned+0.12*kk.n)",'Landslide'],
  ['Landslide keeps Greystone',FXJ,"if(T.P.ls&&g>0){ o.kk.n=g; A.stSet(T,u,'kwGrey',0); }","if(T.P.ls&&g>0){ o.kk.n=g; }",'Landslide'],
  // ---- the chase ----
  ['Head Start each 0.4 s',FXJ,"while(o.hsA>=0.5-1e-9){ o.hsA-=0.5;","while(o.hsA>=0.4-1e-9){ o.hsA-=0.4;",'the chase:'],
  ['Head Start while stunned',FXJ,"if(f.hs&&on&&!o.hsDone&&!((u.stunned||0)>0)&&","if(f.hs&&on&&!o.hsDone&&",'the chase:'],
  ['Head Start keeps gathering',FXJ,"if(n>0||(u._chaseT||0)>0) o.hsDone=true;","",'the chase:'],
  ['Close Behind 1.2%',FXJ,"nf_2_2:[ {param:'hs.k',add:R(0.01)} ],","nf_2_2:[ {param:'hs.k',add:R(0.012)} ],",'the chase:'],
  ['Full Stride 2 a rank',FXJ,"nf_12_3:[ {param:'hs.max',add:R(1)} ],","nf_12_3:[ {param:'hs.max',add:R(2)} ],",'the chase:'],
  ['Long Pursuit 0.4 s',FXJ,"{param:'ch.add',add:R(0.3)}","{param:'ch.add',add:R(0.4)}",'the chase:'],
  ['Overtake 0.5%',FXJ,"nf_9_1:[ {stat:{lifesteal:R(0.004)},per:'kwHs'} ],","nf_9_1:[ {stat:{lifesteal:R(0.005)},per:'kwHs'} ],",'the chase:'],
  ['Cloud Stride 5%',FXJ,"nf_6_1:[ {stat:{move:R(0.04)},if:{fn:'chasing'}} ],","nf_6_1:[ {stat:{move:R(0.05)},if:{fn:'chasing'}} ],",'the chase:'],
  ['Never Let Go lets slows through',FXJ,"{on:'ccIn',if:{fn:'chasing',cc:['slow','fearT']},mul:0}","{on:'ccIn',if:{fn:'chasing',cc:['fearT']},mul:0}",'Never Let Go'],
  ['Pass Him By within 1 m',FXJ,"{team:'enemy',within:8,order:'lowHp',n:1}","{team:'enemy',within:0.01,order:'lowHp',n:1}",'Never Let Go'],
  ['Hungry Eyes 5 s',FXJ,"A.acts(T,u,[{window:'kwHe',dur:4}],c);","A.acts(T,u,[{window:'kwHe',dur:5}],c);",'Never Let Go'],
  // ---- the slam ----
  ['Shake the Heavens 5 m',FXJ,"{push:'target',m:4,secs:0.35}","{push:'target',m:5,secs:0.35}",'Shake the Heavens'],
  ['Shake the Heavens: the highest health',FXJ,"if(x.alive&&(!lo||x.hp<lo.hp)) lo=x;","if(x.alive&&(!lo||x.hp>lo.hp)) lo=x;",'Shake the Heavens'],
  ['Heaven\'s Mistake 0.25 s',FXJ,"nf_12_2:[ {param:'hm',add:R(0.2)} ],","nf_12_2:[ {param:'hm',add:R(0.25)} ],",'Shake the Heavens'],
  ['Falling Weight 4%',FXJ,"nf_10_2:[ {on:'out',if:{casting:SL},more:R(0.03)} ],","nf_10_2:[ {on:'out',if:{casting:SL},more:R(0.04)} ],",'Shake the Heavens'],
  // ---- Thrown Down Again ----
  ['Thrown Down Again re-stuns',FXJ,"mk(u,t,'kwLk',A.eng().now()))) c.amt=0; },","mk(u,t,'kwLk',A.eng().now()))) {} },",'Thrown Down Again'],
  ['Thrown Down Again double',FXJ,"if(kk.sig) d*=3;","if(kk.sig) d*=2;",'Thrown Down Again'],
  ['Thrown Down Again 2 m',FXJ,"within:3},Object.assign({},c,{tgt:t})); tstun(A,T,u,L,1);","within:2},Object.assign({},c,{tgt:t})); tstun(A,T,u,L,1);",'Thrown Down Again'],
  ['Thrown Down Again every 15 s',FXJ,"o.tdaCd=20; o.sigM=t;","o.tdaCd=15; o.sigM=t;",'Thrown Down Again'],
  ['Thrown Down Again without an Insult',FXJ,"if(P.tda&&!kk.sig&&kk.ins&&","if(P.tda&&!kk.sig&&",'Thrown Down Again'],
  // ---- crit ----
  ['crit group 6%',FXJ,"DR_CAP=0.70, CRIT_CAP=0.05,","DR_CAP=0.70, CRIT_CAP=0.06,",'crit-chance'],
  ['crit room ignored',FXJ,"p=Math.min(p,Math.max(0,CRIT_CAP-T.fn.critS(A,T)));","",'crit-chance'],
  ['Behind You 2%',FXJ,"{param:'cr.by',add:R(0.015)}","{param:'cr.by',add:R(0.02)}",'crit-chance'],
  ['Behind You 3 s',FXJ,"A.setMark(T,u,c.tgt,'kwBy',{dur:2});","A.setMark(T,u,c.tgt,'kwBy',{dur:3});",'crit-chance'],
  // ---- Greystone, Discipline ----
  ['Grey Skin 0.5%',FXJ,"gp_1_4:[ {param:'dr.gs',add:R(0.004)} ],","gp_1_4:[ {param:'dr.gs',add:R(0.005)} ],",'Greystone:'],
  ['Greystone every 2.5 s',FXJ,"while(o.ga>=3-1e-9){ o.ga-=3;","while(o.ga>=2.5-1e-9){ o.ga-=2.5;",'Greystone:'],
  ['Discipline full at 4',FXJ,"const adFull=u=>!!(u.pass&&u.pass.warden)&&(u.wardenStk||0)>=5;","const adFull=u=>!!(u.pass&&u.pass.warden)&&(u.wardenStk||0)>=4;",'Greystone:'],
  ['Layered Stone 2 a rank',FXJ,"gp_6_4:[ {param:'grey.max',add:R(1)} ],","gp_6_4:[ {param:'grey.max',add:R(2)} ],",'Greystone:'],
  ['Stone in Flight at 2',FXJ,"if(P['dr.sf']&&g>=3) cut(P['dr.sf']);","if(P['dr.sf']&&g>=2) cut(P['dr.sf']);",'Greystone:'],
  ['Stone Remembers up to 6',FXJ,"kwSr:{max:5},","kwSr:{max:6},",'Greystone:'],
  ['Settled 3%',FXJ,"gp_11_1:[ {on:'out',if:{stackFull:'kwGrey'},more:R(0.02)} ],","gp_11_1:[ {on:'out',if:{stackFull:'kwGrey'},more:R(0.03)} ],",'Greystone:'],
  ['Cold Grey 0.5%',FXJ,"{param:'atk.cg',add:R(0.004)}","{param:'atk.cg',add:R(0.005)}",'Greystone:'],
  ['Mountain Rising 0.4%',FXJ,"gp_12_3:[ {stat:{lifesteal:R(0.003)},per:'kwGrey'} ],","gp_12_3:[ {stat:{lifesteal:R(0.004)},per:'kwGrey'} ],",'Greystone:'],
  ['Old Rock 0.5 s',FXJ,"{param:'ad.fast',add:R(0.3)}","{param:'ad.fast',add:R(0.5)}",'Old Rock'],
  ['Mountain Patience keeps all Greystone',FXJ,"A.stSet(T,u,'kwGrey',Math.floor(o.gs/2+1e-9));","A.stSet(T,u,'kwGrey',o.gs);",'Old Rock'],
  ['Mountain Patience loses Discipline',FXJ,"u.wardenStk=Math.max(u.wardenStk||0,o.ws);","",'Old Rock'],
  // ---- Skid, Granite, the group ----
  ['Skid a quarter',FXJ,"if(skid) k*=1/3;","if(skid) k*=0.25;",'Skid:'],
  ['Blades Skid 1.2%',FXJ,"gp_1_3:[ {param:'skid',add:R(0.01)} ],","gp_1_3:[ {param:'skid',add:R(0.012)} ],",'Skid:'],
  ['Sliding Off 0.6',FXJ,"gp_4_3:[ {param:'skid',add:R(0.005)} ],","gp_4_3:[ {param:'skid',add:R(0.006)} ],",'Skid:'],
  ['Grit 7%',FXJ,"{param:'grit',add:R(0.06)}","{param:'grit',add:R(0.07)}",'Skid:'],
  ['Grit stays',FXJ,"if(c.proc||!o.grit) return; o.grit=0;","if(c.proc||!o.grit) return;",'Skid:'],
  ['Shale 5%',FXJ,"gp_5_3:[ {param:'sh.k',add:0.04},","gp_5_3:[ {param:'sh.k',add:0.05},",'Skid:'],
  ['Gold Underneath 1.2%',FXJ,"{param:'gu',add:R(0.01)}","{param:'gu',add:R(0.012)}",'Skid:'],
  ['Granite 13%',FXJ,"cap=Math.max(0.03,0.12-(P['gr.hc']||0));","cap=Math.max(0.03,0.13-(P['gr.hc']||0));",'Skid:'],
  ['Granite with Skid',FXJ,"if(P.skid>0&&!P.gr&&E.rnd()<P.skid) skid=true;","if(P.skid>0&&E.rnd()<P.skid) skid=true;",'Skid:'],
  ['damage-reduction cap 75%',FXJ,"const DR_CAP=0.70,","const DR_CAP=0.75,",'Skid:|Mountain Comes Up'],
  // ---- Fault ----
  ['Fault 9 s',FXJ,"A.setMark(T,u,t,'kwFlt',{dur:8+(P['flt.dur']||0),longest:true});","A.setMark(T,u,t,'kwFlt',{dur:9+(P['flt.dur']||0),longest:true});",'Fault:'],
  ['Fault for his team 3%',FXJ,"{on:'teamIn',if:{targetHas:'kwFlt',targetTeam:'enemy',srcIs:'ally'},more:R(0.02)}","{on:'teamIn',if:{targetHas:'kwFlt',targetTeam:'enemy',srcIs:'ally'},more:R(0.03)}",'Fault:'],
  ['Crack Spreads 6%',FXJ,"gp_6_1:[ {stat:{move:R(-0.05)},","gp_6_1:[ {stat:{move:R(-0.06)},",'Fault:'],
  ['Under the City for allies 3%',FXJ,"{on:'teamIn',if:{srcHas:'kwFlt',srcTeam:'enemy',targetTeam:'ally'},less:R(0.02)}","{on:'teamIn',if:{srcHas:'kwFlt',srcTeam:'enemy',targetTeam:'ally'},less:R(0.03)}",'Fault:'],
  ['Four Hundred Times 3 s',FXJ,"if(P.fht) A.setMark(T,u,t,'kwFlt',{dur:2,longest:true});","if(P.fht) A.setMark(T,u,t,'kwFlt',{dur:3,longest:true});",'Fault:'],
  ['Shifting Ground 1.2 s',FXJ,"dur:R(1),longest:true}]} ],   // Shifting Ground","dur:R(1.2),longest:true}]} ],   // Shifting Ground",'Fault:'],
  // ---- his defence ----
  ['Weathered with one enemy',FXJ,"if(P['dr.we']&&nearN(A,u,3)>=2) cut(P['dr.we']);","if(P['dr.we']&&nearN(A,u,3)>=1) cut(P['dr.we']);",'Weathered'],
  ['Thick-Skinned with two',FXJ,"if(P['dr.ts']&&nearN(A,u,5)>=3) cut(P['dr.ts']);","if(P['dr.ts']&&nearN(A,u,5)>=2) cut(P['dr.ts']);",'Weathered'],
  ['Rooted Feet 9%',FXJ,"gp_5_1:[ {on:'tick',do:[{weaken:'slowMul',by:R(0.08)}]} ],","gp_5_1:[ {on:'tick',do:[{weaken:'slowMul',by:R(0.09)}]} ],",'Weathered'],
  ['Stubborn Stone 5%',FXJ,"gp_4_4:[ {on:'ccIn',less:R(0.04)} ],","gp_4_4:[ {on:'ccIn',less:R(0.05)} ],",'Weathered'],
  ['Never Moved 1.5 s',FXJ,"nmClamp(A,T,u,c){ if(c.amt>1) c.amt=1; },","nmClamp(A,T,u,c){ if(c.amt>1.5) c.amt=1.5; },",'Weathered'],
  ['Never Moved: a stun written on stays',FXJ,"if((u.stunned||0)>1) u.stunned=1; }","}",'Weathered'],
  ['Never Moved: he can be moved',FXJ,"if(!((u._gearImmovableT||0)>=0.1)) u._gearImmovableT=0.1;","",'Weathered'],
  ['Sky-Warden Drill 0.4%',FXJ,"Math.min(3*REGEN_CAP,0.003*r)","Math.min(3*REGEN_CAP,0.004*r)",'Weathered'],
  // ---- The Mountain Comes Up ----
  ['Mountain 7%',FXJ,"cap=cap==null?0.06:Math.min(cap,0.06);","cap=cap==null?0.07:Math.min(cap,0.07);",'Mountain Comes Up'],
  ['Mountain 5 s',FXJ,"A.acts(T,u,[{window:'kwMtn',dur:4}],c); o.mtnCd=34;","A.acts(T,u,[{window:'kwMtn',dur:5}],c); o.mtnCd=34;",'Mountain Comes Up'],
  ['Mountain again 25 s after',FXJ,"A.acts(T,u,[{window:'kwMtn',dur:4}],c); o.mtnCd=34;","A.acts(T,u,[{window:'kwMtn',dur:4}],c); o.mtnCd=29;",'Mountain Comes Up'],
  ['Mountain stun 0.25 s',FXJ,"tstun(A,T,u,L,0.2*n); }","tstun(A,T,u,L,0.25*n); }",'Mountain Comes Up'],
  ['Mountain 7 m',FXJ,"const L=A.pick(T,u,{team:'enemy',within:5},c);","const L=A.pick(T,u,{team:'enemy',within:7},c);",'Mountain Comes Up'],
  // ---- Swept, Laughter, Length ----
  ['Swept 3.5 s',FXJ,":3+(P['sw.dur']||0),longest:true});",":3.5+(P['sw.dur']||0),longest:true});",'Swept:'],
  ['Clear the Path 3%',FXJ,"ru_1_1:[ {stat:{aspd:R(-0.02)},","ru_1_1:[ {stat:{aspd:R(-0.03)},",'Swept:'],
  ['Dust in the Eyes 5%',FXJ,"ru_6_1:[ {stat:{crit:R(-0.04)},","ru_6_1:[ {stat:{crit:R(-0.05)},",'Swept:'],
  ['Swept Clean 1.2%',FXJ,"ru_12_2:[ {on:'death',if:{unitHas:'kwSw'},do:[{heal:{pct:R(0.01),","ru_12_2:[ {on:'death',if:{unitHas:'kwSw'},do:[{heal:{pct:R(0.012),",'Swept:'],
  ['Belly Laugh 0.12 s',FXJ,"ru_2_3:[ {on:'cd',skill:'green',add:R(-0.1),per:'kwLg'} ],","ru_2_3:[ {on:'cd',skill:'green',add:R(-0.12),per:'kwLg'} ],",'Laughter:'],
  ['Laughter from any kill',FXJ,"{on:'kill',reqAny:LG,if:{casting:ARC},do:[{stack:'kwLg',add:1}]},","{on:'kill',reqAny:LG,do:[{stack:'kwLg',add:1}]},",'Laughter:'],
  ['Laughter kept between waves',FXJ,"kwLg:{max:P('lg.max',3),wave:'reset'},","kwLg:{max:P('lg.max',3)},",'Laughter:'],
  ['Grow with one enemy',FXJ,"if(n>=2&&LEN.some(id=>T.r[id]))","if(n>=1&&LEN.some(id=>T.r[id]))",'Length:'],
  ['Length reach 0.25 m',FXJ,"ru_1_4:[ {param:'len.r',add:0.2},","ru_1_4:[ {param:'len.r',add:0.25},",'Length:'],
  ['Grow 1.2%',FXJ,"{on:'out',if:{casting:ARC},more:R(0.01),per:'kwLen'} ],","{on:'out',if:{casting:ARC},more:R(0.012),per:'kwLen'} ],",'Length:'],
  ['At His Word at 4',FXJ,"if(P.ahw&&n>=5) x.angle","if(P.ahw&&n>=4) x.angle",'Length:'],
  ['Wide World 0.5%',FXJ,"ru_7_4:[ {stat:{atk:R(0.004)},per:'kwLen'} ],","ru_7_4:[ {stat:{atk:R(0.005)},per:'kwLen'} ],",'Length:'],
  ['Ruyi Shrinks below 5',FXJ,"lenLow(A,T){ return stN(T,'kwLen')<3; },","lenLow(A,T){ return stN(T,'kwLen')<5; },",'Length:'],
  ['Ruyi Remembers 1.2',FXJ,"ru_10_4:[ {on:'wave',do:[{stack:'kwLen',atLeast:R(1)}]} ],","ru_10_4:[ {on:'wave',do:[{stack:'kwLen',atLeast:R(1.2)}]} ],",'Length:'],
  ['Grown Strong 0.5%',FXJ,"{param:'gs.h',add:R(0.004)}","{param:'gs.h',add:R(0.005)}",'Length:'],
  ['Full Length: the arc not ready',FXJ,"{on:'cast',skill:SL,do:[{stack:'kwLen',set:'max'},{cd:'green',set:0}]}","{on:'cast',skill:SL,do:[{stack:'kwLen',set:'max'}]}",'Length:'],
  // ---- Cleaving Arc ----
  ['Staff Weight 6%',FXJ,"nf_4_3:[ {on:'out',if:{casting:ARC},more:R(0.05)} ],","nf_4_3:[ {on:'out',if:{casting:ARC},more:R(0.06)} ],",'Cleaving Arc:'],
  ['Sweep Low at 2 m',FXJ,"return !!c.tgt&&E.dist(u,c.tgt)>3*E.METER(); }","return !!c.tgt&&E.dist(u,c.tgt)>2*E.METER(); }",'Cleaving Arc:'],
  ['Crowded Arc up to 1',FXJ,"per:{fn:'arcN',max:5}}","per:{fn:'arcN',max:1}}",'Cleaving Arc:'],
  ['Shrine Breaker 30%',FXJ,"ru_5_3:[ {on:'out',if:{casting:ARC,fn:'mostHp'},more:0.25} ],","ru_5_3:[ {on:'out',if:{casting:ARC,fn:'mostHp'},more:0.30} ],",'Cleaving Arc:'],
  ['Shrine Breaker the least HP',FXJ,"for(const e of T.fn.arcList(A,T,u)) if(!b||e.hp>b.hp) b=e;","for(const e of T.fn.arcList(A,T,u)) if(!b||e.hp<b.hp) b=e;",'Cleaving Arc:'],
  ['Pebble in the Eye 1.2 s',FXJ,"taunt:P('peb.t',1)","taunt:P('peb.t',1.2)",'Cleaving Arc:'],
  ['Look at Me 0.25 s',FXJ,"{param:'peb.t',add:R(0.2)}","{param:'peb.t',add:R(0.25)}",'Cleaving Arc:'],
  ['Clean Through 3 m',FXJ,"{push:'target',m:2,secs:0.25}","{push:'target',m:3,secs:0.25}",'Cleaving Arc:'],
  ['Quick Arc 0.2 s',FXJ,"ru_9_4:[ {on:'cd',skill:'green',add:R(-0.15)} ],","ru_9_4:[ {on:'cd',skill:'green',add:R(-0.2)} ],",'Cleaving Arc:'],
  // ---- Ruyi Touches the Sky ----
  ['the sky 7 m',FXJ,"o.sky=true; o.skyCd=20; x.radius=10*M; x.angle=90;","o.sky=true; o.skyCd=20; x.radius=7*M; x.angle=90;",'Touches the Sky'],
  ['the sky every 15 s',FXJ,"o.sky=true; o.skyCd=20; x.radius=10*M;","o.sky=true; o.skyCd=15; x.radius=10*M;",'Touches the Sky'],
  ['the sky triple',FXJ,"{on:'out',if:{casting:ARC,fn:'skyOn'},mul:2}","{on:'out',if:{casting:ARC,fn:'skyOn'},mul:3}",'Touches the Sky'],
  ['the sky Sweeps 5 s',FXJ,"dur:o.sky?Math.max(6,","dur:o.sky?Math.max(5,",'Touches the Sky'],
  // ---- small talents ----
  ['Discipline in Motion 0.4%',FXJ,"ru_11_2:[ {stat:{atk:R(0.003)},","ru_11_2:[ {stat:{atk:R(0.004)},",'small talents'],
  ['Stand in the Middle with two',FXJ,"crowd5(A,T,u){ return nearN(A,u,5)>=3; },","crowd5(A,T,u){ return nearN(A,u,5)>=2; },",'small talents'],
  ['Quick Feet 4%',FXJ,"nf_2_3:[ {stat:{move:R(0.03)}} ],","nf_2_3:[ {stat:{move:R(0.04)}} ],",'small talents'],
  ['Heaven-Forged Gold 3%',FXJ,"nf_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],","nf_3_3:[ {on:'out',ignoreArmor:R(0.03)} ],",'small talents'],
  ['Weakest First below 40%',FXJ,"nf_7_1:[ {on:'out',if:{targetHpBelow:0.50},","nf_7_1:[ {on:'out',if:{targetHpBelow:0.40},",'small talents'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-kwc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-konwu.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=(process.argv[2]||process.env.KWC_ONLY)?new RegExp(process.argv[2]||process.env.KWC_ONLY):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
