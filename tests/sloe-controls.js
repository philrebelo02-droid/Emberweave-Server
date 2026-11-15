'use strict';
/* The controls for Sloe's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-sloe.test.js). Each control copies this checkout to a temp folder (os.tmpdir(): the runner's slot folder on disk), breaks ONE thing there (an
   exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a row or a number
   of hers broken), runs the named tests of tests/talents-mech-sloe.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child
   processes); each copy is deleted when its run is done. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was
   not caught. A pattern as the first argument runs only the controls whose name matches it; --check only verifies that every text to break is found exactly once. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', DRAW='brnd();';
const HPP="        if(u.pass.patience&&u._tal&&u._tal.on.pass) TalentFx.pass(u,t,'hpPre');";
const HPS="        if(u.pass.patience&&u._tal&&u._tal.on.pass) TalentFx.pass(u,t,'hpSwing');";
const VLP="if(e.alive){ if(u._tal) TalentFx.landPre(u,e,'volley');";
const VTG="      if(u._tal&&u._tal.on.skillTgt){ const _vf=TalentFx.skillTgt(u,type,null,o); if(_vf) _vt=[_vf]; }";
const C=[
  // ---- the page sites: hook removed (her tests fail) ----
  ['Patience pre-swing hook removed',HTML,HPP,"        if(false) TalentFx.pass(u,t,'hpPre');",'Hunter\'s Patience:'],
  ['Patience swing hook removed',HTML,HPS,"        if(false) TalentFx.pass(u,t,'hpSwing');",'Hunter\'s Patience:|One Clean Arrow'],
  ['volley arrow landing hook removed',HTML,VLP,"if(e.alive){ if(false) TalentFx.landPre(u,e,'volley');",'Learned Him|Overgrown:|Greenfall:'],
  ['volley target hook removed',HTML,VTG,"      if(false){ const _vf=TalentFx.skillTgt(u,type,null,o); if(_vf) _vt=[_vf]; }",'Learned Him'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw before the Patience swing',HTML,HPP,"        "+DRAW+HPP.slice(8),'no talents'],
  ['draw after the Patience swing',HTML,HPS,"        "+DRAW+HPS.slice(8),'no talents'],
  ['draw at the volley arrow',HTML,VLP,"if(e.alive){ "+DRAW+" if(u._tal) TalentFx.landPre(u,e,'volley');",'no talents'],
  ['draw at the volley target',HTML,VTG,"      "+DRAW+VTG.slice(6),'no talents'],
  // ---- One Man and Enough Time ----
  ['Weak Spot crit 3%',FXJ,"om_1_1:[ {param:'ws.cd',add:R(0.02)} ],","om_1_1:[ {param:'ws.cd',add:R(0.03)} ],",'Weak Spot:'],
  ['Weak Spot at 5 stacks',FXJ,"if(WS.some(id=>T.r[id])&&k>=6&&o.ws!==t","if(WS.some(id=>T.r[id])&&k>=5&&o.ws!==t",'Hunter\'s Patience:'],
  ['Weak Spot kept on a switch',FXJ,"if(t!==o.pT){ o.ws=null; o.oca=null; o.lan=0;","if(t!==o.pT){ o.oca=null; o.lan=0;",'Hunter\'s Patience:'],
  ['Nearer Each Time 2 a rank',FXJ,"om_2_1:[ {param:'pt.near',add:R(1)} ],","om_2_1:[ {param:'pt.near',add:R(2)} ],",'Hunter\'s Patience:'],
  ['Never Changes Target keeps all',FXJ,"s=Math.max(s,Math.floor(o.pS/2));","s=Math.max(s,o.pS);",'Hunter\'s Patience:'],
  ['Never Changes Target from a living target',FXJ,"if(P0(T,'pt.keep')&&o.pT&&!o.pT.alive)","if(P0(T,'pt.keep')&&o.pT)",'Hunter\'s Patience:'],
  ['Found Again on any enemy',FXJ,"if(P0(T,'ws.again')&&E1(o,t).fdOn)","if(P0(T,'ws.again'))",'Hunter\'s Patience:'],
  ['talent crit not kept at the swing',FXJ,"u.glyphCrit=u._hpBaseCrit+0.05*(u.passMul||1)*k+((T.s.ap&&T.s.ap.crit)||0); },","u.glyphCrit=u._hpBaseCrit+0.05*(u.passMul||1)*k; },",'Hunter\'s Patience:'],
  ['base crit read with the talent share',FXJ,"if(u._hpBaseCrit==null) u._hpBaseCrit=(u.glyphCrit||0)-((T.s.ap&&T.s.ap.crit)||0); },","if(u._hpBaseCrit==null) u._hpBaseCrit=(u.glyphCrit||0); },",'Hunter\'s Patience:'],
  ['Long Watch 3%',FXJ,"om_5_1:[ {param:'ws.ign',add:R(0.02)} ],","om_5_1:[ {param:'ws.ign',add:R(0.03)} ],",'Weak Spot:'],
  ['Waited Long Enough 3%',FXJ,"om_9_1:[ {param:'ws.heal',add:R(0.02)} ],","om_9_1:[ {param:'ws.heal',add:R(0.03)} ],",'Weak Spot:'],
  ['A Little Nearer up to 12%',FXJ,"m*=1+Math.min(0.10,0.01*o.lan);","m*=1+Math.min(0.12,0.01*o.lan);",'Weak Spot:'],
  ['Many Small Wounds 7%',FXJ,"om_5_3:[ {param:'ws.msw',add:0.06} ],","om_5_3:[ {param:'ws.msw',add:0.07} ],",'Weak Spot:'],
  ['Bleeding Bark 2%',FXJ,"om_6_3:[ {param:'ws.msw2',add:R(0.01)} ],","om_6_3:[ {param:'ws.msw2',add:R(0.02)} ],",'Weak Spot:'],
  ['One Clean Arrow 50%',FXJ,"if(t===o.oca) m*=1+0.40+P0(T,'ws.oca2');","if(t===o.oca) m*=1+0.50+P0(T,'ws.oca2');",'One Clean Arrow'],
  ['One Clean Arrow not spent',FXJ,"      if(t===o.oca) o.oca=null;","",'One Clean Arrow'],
  ['One Clean Arrow no crit',FXJ,"if(c.tgt&&(c.tgt===o.oca||c.tgt===o.sigHit)) c.force=true;","if(c.tgt&&(c.tgt===o.sigHit)) c.force=true;",'One Clean Arrow'],
  ['Heart Shot 9%',FXJ,"om_6_2:[ {param:'ws.oca2',add:R(0.08)} ],","om_6_2:[ {param:'ws.oca2',add:R(0.09)} ],",'One Clean Arrow'],
  ['Undisturbed after 2 s',FXJ,"o.qt>=3-P0(T,'und.sooner')-1e-9","o.qt>=2-P0(T,'und.sooner')-1e-9",'Undisturbed:'],
  ['Undisturbed on any target',FXJ,"if(P['und.k']&&o.und&&t===u.target)","if(P['und.k']&&o.und)",'Undisturbed:'],
  ['Undisturbed not ended by a hit',FXJ,"    disturb(A,T,u){ const o=S(T); o.qt=0; if(o.und){","    disturb(A,T,u){ const o=S(T); o.qt=0; if(false){",'Undisturbed:'],
  ['Steady Breath 3%',FXJ,"om_7_4:[ {param:'und.cd',add:R(0.02)} ],","om_7_4:[ {param:'und.cd',add:R(0.03)} ],",'Undisturbed:'],
  ['Tanglewood Cloak 11%',FXJ,"om_3_4:[ {param:'dr.cloak',add:R(0.10)} ],","om_3_4:[ {param:'dr.cloak',add:R(0.11)} ],",'Undisturbed:'],
  ['Watcher 4 s',FXJ,"A.acts(T,u,[{window:'slWat',dur:3}],{u});","A.acts(T,u,[{window:'slWat',dur:4}],{u});",'Undisturbed:'],
  ['Small Fire 0.6 s',FXJ,"om_12_3:[ {param:'und.sooner',add:R(0.5)} ],","om_12_3:[ {param:'und.sooner',add:R(0.6)} ],",'Undisturbed:'],
  ['Splits up to 4',FXJ,"e.sp=Math.min(3,(e.spT>0?e.sp:0)+1);","e.sp=Math.min(4,(e.spT>0?e.sp:0)+1);",'Splits:'],
  ['Splits 9 s',FXJ,"e.spT=8+P0(T,'sp.dur'); }","e.spT=9+P0(T,'sp.dur'); }",'Splits:'],
  ['Old Bark 4%',FXJ,"om_1_3:[ {param:'sp.basic',add:R(0.03)} ],","om_1_3:[ {param:'sp.basic',add:R(0.04)} ],",'Splits:'],
  ['Split Open 3%',FXJ,"om_8_3:[ {param:'sp.open',add:R(0.02)} ],","om_8_3:[ {param:'sp.open',add:R(0.03)} ],",'Splits:'],
  ['Split Wide 2%',FXJ,"om_7_3:[ {param:'sp.wide',add:R(0.01)} ],","om_7_3:[ {param:'sp.wide',add:R(0.02)} ],",'Splits:'],
  ['Barbed Tip 5%',FXJ,"om_4_3:[ {param:'ts.more',add:R(0.04)} ],","om_4_3:[ {param:'ts.more',add:R(0.05)} ],",'Splits:'],
  ['Like Old Bark at 2 Splits',FXJ,"if(e&&e.spT>0&&e.sp>=3&&e.sh>0)","if(e&&e.spT>0&&e.sp>=1&&e.sh>0)",'Like Old Bark'],
  ['Bark Split Through never',FXJ,"if(P0(T,'sp.pass')&&e.spT>0&&e.sp>=3){","if(false){",'Like Old Bark'],
  ['Patient Draw 0.4%',FXJ,"om_4_1:[ {param:'pd.atk',add:R(0.003)} ],","om_4_1:[ {param:'pd.atk',add:R(0.004)} ],",'at 6 Patience'],
  ['Six Arrows Deep at 5',FXJ,"if(P0(T,'pt.six')&&stk(u)>=6)","if(P0(T,'pt.six')&&stk(u)>=5)",'at 6 Patience'],
  ['No Hurry 2%',FXJ,"om_11_1:[ {param:'dr.nh',add:R(0.015)} ],","om_11_1:[ {param:'dr.nh',add:R(0.02)} ],",'at 6 Patience'],
  ['Hunter\'s Calm 0.4%',FXJ,"om_10_1:[ {param:'pt.calm',add:R(0.003)} ],","om_10_1:[ {param:'pt.calm',add:R(0.004)} ],",'at 6 Patience'],
  ['Enough Time up to 12 s',FXJ,"o.et=Math.min(10,o.et+dt);","o.et=Math.min(12,o.et+dt);",'at 6 Patience'],
  ['Bowstring Rhythm up to 5',FXJ,"o.bw=Math.min(4,o.bw+1);","o.bw=Math.min(5,o.bw+1);",'at 6 Patience'],
  ['Unwatched from her target too',FXJ,"if(s&&P['dr.unw']&&s!==u.target)","if(s&&P['dr.unw'])",'Unwatched'],
  ['Last Arrow below 40%',FXJ,"if(P['la.k']&&t.hp<0.30*t.maxHp)","if(P['la.k']&&t.hp<0.40*t.maxHp)",'Unwatched'],
  ['Between the Plates 3%',FXJ,"om_10_2:[ {param:'arm.btp',add:R(0.02)} ],","om_10_2:[ {param:'arm.btp',add:R(0.03)} ],",'Unwatched'],
  ['Fireless Camp every 4 s',FXJ,"if(o.fc>=5-1e-9){ o.fc-=5;","if(o.fc>=4-1e-9){ o.fc-=4;",'Unwatched'],
  ['Quick Thorn 0.4 s',FXJ,"om_8_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],","om_8_2:[ {on:'cd',skill:'green',add:R(-0.4)} ],",'Unwatched'],
  ['Learned Him out of reach too',FXJ,"if(P0(T,'ws.lh')&&o.ws&&o.ws.alive&&A.eng().dist(u,o.ws)<=u.range)","if(P0(T,'ws.lh')&&o.ws&&o.ws.alive)",'Learned Him'],
  ['Deep Quiver 4%',FXJ,"om_11_4:[ {param:'vo.more',add:R(0.03)} ],","om_11_4:[ {param:'vo.more',add:R(0.04)} ],",'Learned Him'],
  ['Splinter Rain 4%',FXJ,"om_10_3:[ {param:'vo.spl',add:R(0.03)} ],","om_10_3:[ {param:'vo.spl',add:R(0.04)} ],",'Learned Him'],
  ['Given One Man below 60%',FXJ,"o.ws.hp<0.5*o.ws.maxHp) T.fn.sigOm(A,T,u);","o.ws.hp<0.6*o.ws.maxHp) T.fn.sigOm(A,T,u);",'Given One Man'],
  ['Given One Man every 19 s',FXJ,"o.c1=20; o.sigHit=x;","o.c1=19; o.sigHit=x;",'Given One Man'],
  ['Given One Man 310%',FXJ,"E.strike(u,x,3.0*(u.dmg||0),'#b6ff9e')","E.strike(u,x,3.1*(u.dmg||0),'#b6ff9e')",'Given One Man'],
  ['Given One Man through armour no more',FXJ,"        if(t===o.sigHit) ig=1;","",'Given One Man'],
  ['Given One Man carries nothing',FXJ,"if(!x.alive){ o.carry=true;","if(false){ o.carry=true;",'Given One Man'],
  // ---- The Tanglewood ----
  ['Tangle Deep 0.3 s',FXJ,"tw_2_1:[ {param:'vs.td',add:R(0.2)} ],","tw_2_1:[ {param:'vs.td',add:R(0.3)} ],",'Vine Snare\'s root'],
  ['Green Shoots 6%',FXJ,"tw_1_2:[ {param:'og.root',add:R(0.05)} ],","tw_1_2:[ {param:'og.root',add:R(0.06)} ],",'Vine Snare\'s root'],
  ['her roots up to 5 s',FXJ,"ROOT_TOP=4.0,","ROOT_TOP=5.0,",'Vine Snare\'s root|in a chain'],
  ['Hold Fast 1.2 s',FXJ,"A.control(T,u,t,'silencedT',1+P0(T,'vs.qw'));","A.control(T,u,t,'silencedT',1.2+P0(T,'vs.qw'));",'Vine Snare\'s root'],
  ['Snare Thorns 5%',FXJ,"tw_10_1:[ {param:'vs.more',add:R(0.04)} ],","tw_10_1:[ {param:'vs.more',add:R(0.05)} ],",'Vine Snare\'s root'],
  ['Snare Reach none',FXJ,"tw_4_1:[ {on:'kit',skill:VS,opt:{radius:{more:R(0.04)}}} ],","tw_4_1:[ {on:'kit',skill:VS,opt:{radius:{more:R(0)}}} ],",'Vine Snare\'s root'],
  ['Path Closes to the farthest',FXJ,"const d=E.dist(u,x)-E.bodyR(x); if(d<bd){ bd=d; b=x; } } if(b) c.tgt=b; },","const d=-E.dist(u,x); if(d<bd){ bd=d; b=x; } } if(b) c.tgt=b; },",'Vine Snare\'s root'],
  ['Snare Pace 0.3 s',FXJ,"tw_7_1:[ {on:'cd',skill:'blue',add:R(-0.2)} ],","tw_7_1:[ {on:'cd',skill:'blue',add:R(-0.3)} ],",'Vine Snare\'s root'],
  ['Let Them Run 30% shorter',FXJ,"if(P0(T,'vs.ltr')){ len*=0.6; r.ltr=true; }","if(P0(T,'vs.ltr')){ len*=0.7; r.ltr=true; }",'Let Them Run'],
  ['Let Them Run slow 25%',FXJ,"[{slow:0.30,dur:3+P0(T,'vs.lc'),on:'target'}]","[{slow:0.25,dur:3+P0(T,'vs.lc'),on:'target'}]",'Let Them Run'],
  ['Long Chase 0.6 s',FXJ,"tw_6_3:[ {param:'vs.lc',add:R(0.5)} ],","tw_6_3:[ {param:'vs.lc',add:R(0.6)} ],",'Let Them Run'],
  ['Thicket 4 s after',FXJ,"z.t=m+3+P0(T,'th.wide');","z.t=m+4+P0(T,'th.wide');",'the Thicket'],
  ['Thicket slow 4%',FXJ,"tw_1_1:[ {param:'th.slow',add:R(0.03)} ],","tw_1_1:[ {param:'th.slow',add:R(0.04)} ],",'the Thicket'],
  ['Thicket measured at the centre',FXJ,"Math.hypot(x.x-z.x,x.y-z.y)-E.bodyR(x)<z.r","Math.hypot(x.x-z.x,x.y-z.y)<z.r",'the Thicket'],
  ['Wide Thicket 0.5 s',FXJ,"tw_5_1:[ {param:'th.wide',add:R(0.4)} ],","tw_5_1:[ {param:'th.wide',add:R(0.5)} ],",'the Thicket'],
  ['Taken by the Roots 2%',FXJ,"tw_8_1:[ {param:'th.team',add:R(0.015)} ],","tw_8_1:[ {param:'th.team',add:R(0.02)} ],",'the Thicket'],
  ['stun lock 0.3 s',FXJ,"delete o.rt[id]; const e=E1(o,x); e.lk=0.5;","delete o.rt[id]; const e=E1(o,x); e.lk=0.3;",'the Thicket|Brambles:'],
  ['talent root on a stunned enemy',FXJ,"if((t.stunned||0)>0||e.lk>1e-9){ if((t.stunned||0)>0) o.st.on++; return false; }","if(e.lk>1e-9){ return false; }",'Brambles:|What It Will|in a chain'],
  ['Overgrown 6 s',FXJ,"e.og=Math.max(e.og,5+P0(T,'og.dur'));\n        if((T.r.eq_1_3","e.og=Math.max(e.og,6+P0(T,'og.dur'));\n        if((T.r.eq_1_3",'Overgrown:'],
  ['Grows Where It Lands 2%',FXJ,"tw_2_2:[ {param:'og.more',add:R(0.015)} ],","tw_2_2:[ {param:'og.more',add:R(0.02)} ],",'Overgrown:'],
  ['Choking Vines 3%',FXJ,"tw_4_2:[ {param:'og.chk',add:R(0.02)} ],","tw_4_2:[ {param:'og.chk',add:R(0.03)} ],",'Overgrown:'],
  ['Choked Out 3%',FXJ,"tw_10_2:[ {param:'og.cho',add:R(0.02)} ],","tw_10_2:[ {param:'og.cho',add:R(0.03)} ],",'Overgrown:'],
  ['Seeded Volley never',FXJ,"if(P['og.seed']&&e.og>0) troot(","if(false) troot(",'Overgrown:'],
  ['Wildwood 4 m',FXJ,"if(E.dist(x,f)-E.bodyR(x)-E.bodyR(f)<3*E.METER()){ const r=E1(o,f);","if(E.dist(x,f)-E.bodyR(x)-E.bodyR(f)<20*E.METER()){ const r=E1(o,f);",'Overgrown:'],
  ['Brambles 3 m',FXJ,"if(E.dist(u,x)-E.bodyR(u)-E.bodyR(x)>=2*M) continue;","if(E.dist(u,x)-E.bodyR(u)-E.bodyR(x)>=3*M) continue;",'Brambles:'],
  ['Brambles 0.12 s a rank',FXJ,"tw_1_4:[ {param:'br.root',add:R(0.1)} ],","tw_1_4:[ {param:'br.root',add:R(0.12)} ],",'Brambles:'],
  ['Thicker Brambles 0.08 s',FXJ,"tw_10_4:[ {param:'br.root2',add:R(0.06)} ],","tw_10_4:[ {param:'br.root2',add:R(0.08)} ],",'Brambles:'],
  ['Brambles twice a wave',FXJ,"const o=S(T), E=A.eng(), allow=1+P0(T,'br.bp');","const o=S(T), E=A.eng(), allow=2+P0(T,'br.bp');",'Brambles:'],
  ['Thorny 16%',FXJ,"tw_3_4:[ {param:'br.thorny',add:R(0.15)} ],","tw_3_4:[ {param:'br.thorny',add:R(0.16)} ],",'Brambles:'],
  ['Thorn Wall 11%',FXJ,"tw_12_4:[ {param:'br.wall',add:R(0.10)} ],","tw_12_4:[ {param:'br.wall',add:R(0.11)} ],",'Brambles:'],
  ['Caught Fast 3%',FXJ,"tw_7_4:[ {param:'br.cf',add:R(0.02)} ],","tw_7_4:[ {param:'br.cf',add:R(0.03)} ],",'Brambles:'],
  ['Closing Behind 4%',FXJ,"tw_8_4:[ {param:'dr.cb',add:R(0.03)} ],","tw_8_4:[ {param:'dr.cb',add:R(0.04)} ],",'Brambles:'],
  ['Wood Remembers 2%',FXJ,"tw_5_4:[ {param:'br.wr',add:R(0.01)} ],","tw_5_4:[ {param:'br.wr',add:R(0.02)} ],",'Brambles:'],
  ['Thorn and Fletching 15%',FXJ,"if(e&&e.tf){ m*=1.10; e.tf=false; }","if(e&&e.tf){ m*=1.15; e.tf=false; }",'Thorn and Fletching'],
  ['Thorn and Fletching 3 arrows a wave',FXJ,"o.tfN<2&&o.nk<nkMax(T)","o.tfN<3&&o.nk<nkMax(T)",'Thorn and Fletching'],
  ['Thorn and Fletching nocks without Nock and Wait',FXJ,"if(T.r.eq_1_1&&o.tfN<2","if(o.tfN<2",'Thorn and Fletching'],
  ['Rooted Prey 4%',FXJ,"tw_6_1:[ {param:'rt.prey',add:R(0.03)} ],","tw_6_1:[ {param:'rt.prey',add:R(0.04)} ],",'her roots:'],
  ['Rooted Prey on any stunned enemy',FXJ,"const rooted=(o,x)=>!!x&&!!o.rt[x.uid]&&(x.stunned||0)>0;","const rooted=(o,x)=>!!x&&(x.stunned||0)>0;",'her roots:'],
  ['Patient Wood 0.4%',FXJ,"tw_11_3:[ {param:'rt.pw',add:R(0.003)} ],","tw_11_3:[ {param:'rt.pw',add:R(0.004)} ],",'her roots:'],
  ['Ring of Thorn 5%',FXJ,"tw_12_1:[ {param:'ts.ring',add:R(0.04)} ],","tw_12_1:[ {param:'ts.ring',add:R(0.05)} ],",'her roots:'],
  ['Tough Rind 3%',FXJ,"tw_4_4:[ {param:'rt.bark',add:R(0.02)} ],","tw_4_4:[ {param:'rt.bark',add:R(0.03)} ],",'her roots:'],
  ['Never Followed 4 m',FXJ,"if(s&&P['dr.nf']&&E.dist(u,s)-E.bodyR(u)-E.bodyR(s)<3*E.METER())","if(s&&P['dr.nf']&&E.dist(u,s)-E.bodyR(u)-E.bodyR(s)<9*E.METER())",'her roots:'],
  ['Woodwise 6%',FXJ,"tw_2_3:[ {on:'ccIn',less:R(0.05)} ],","tw_2_3:[ {on:'ccIn',less:R(0.06)} ],",'her roots:'],
  ['Roots Find Stone 5%',FXJ,"tw_n2:[ {param:'dr.rfs',add:R(0.04)} ],","tw_n2:[ {param:'dr.rfs',add:R(0.05)} ],",'her roots:'],
  ['Roots Find Stone every 11 s',FXJ,"e.rfs=3; e.rfsL=12; },","e.rfs=3; e.rfsL=11; },",'her roots:'],
  ['What It Will Not Allow every 24 s',FXJ,"vc.sigT=true; o.c2=25;","vc.sigT=true; o.c2=24;",'What It Will Not Allow'],
  ['What It Will Not Allow 1.6 s',FXJ,"troot(A,T,u,t,1.5,'vo'+vc.id);","troot(A,T,u,t,1.6,'vo'+vc.id);",'What It Will Not Allow'],
  ['What It Will Not Allow no Brambles again',FXJ,"o.c2=25; for(const id in o.e) o.e[id].br=0; }","o.c2=25; }",'What It Will Not Allow'],
  // ---- Empty the Quiver ----
  ['nock every 1.8 s',FXJ,"while(o.nkT>=2-1e-9){ o.nkT-=2;","while(o.nkT>=1.8-1e-9){ o.nkT-=1.8;",'Nocked Arrows:'],
  ['quiver up to 10',FXJ,"const nkMax=T=>Math.min(9,6+P0(T,'nk.max'));","const nkMax=T=>Math.min(10,7+P0(T,'nk.max'));",'Nocked Arrows:'],
  ['a cast keeps the nock clock',FXJ,"const o=S(T), sk=c.skill; o.nkT=0;","const o=S(T), sk=c.skill;",'Nocked Arrows:'],
  ['Quick Nock 7%',FXJ,"eq_5_1:[ {param:'nk.rate',add:R(0.06)} ],","eq_5_1:[ {param:'nk.rate',add:R(0.07)} ],",'Nocked Arrows:'],
  ['Tough Bow at 2',FXJ,"if(P['dr.tb']&&o.nk>=3)","if(P['dr.tb']&&o.nk>=2)",'Nocked Arrows:'],
  ['Held Draw at 5',FXJ,"if(auto&&P['auto.hd']&&o.nk>=6)","if(auto&&P['auto.hd']&&o.nk>=5)",'Nocked Arrows:'],
  ['Never Run Dry 5',FXJ,"if(T.r.eq_11_1) o.nk=Math.max(o.nk,Math.min(6,nkMax(T)));","if(T.r.eq_11_1) o.nk=Math.max(o.nk,Math.min(5,nkMax(T)));",'Nocked Arrows:'],
  ['nocked arrow 9%',FXJ,"eq_1_1:[ {param:'nk.dmg',add:R(0.08)} ],","eq_1_1:[ {param:'nk.dmg',add:R(0.09)} ],",'every nocked arrow'],
  ['Quiver Empty at 5',FXJ,"if(P0(T,'nk.qe')&&n>=6)","if(P0(T,'nk.qe')&&n>=5)",'every nocked arrow'],
  ['Rain of Thorns full shred',FXJ,"T.fn.shredOn(A,T,u,t,0.5*(o.shLast||0.32)); }","T.fn.shredOn(A,T,u,t,1.0*(o.shLast||0.32)); }",'every nocked arrow'],
  ['Every Arrow Counts up to 6',FXJ,"states:{ slEac:{max:5,dur:4} },","states:{ slEac:{max:6,dur:4} },",'every nocked arrow'],
  ['Every Arrow Counts 5 s',FXJ,"states:{ slEac:{max:5,dur:4} },","states:{ slEac:{max:5,dur:5} },",'every nocked arrow'],
  ['Second String spends nothing',FXJ,"if(b){ o.nk--;","if(b){",'Second String'],
  ['Second String without a shred',FXJ,"      if(q.ss&&e.alive) T.fn.shredOn(A,T,u,e,o.shLast||0.32); },","      },",'Second String'],
  ['crit group 6%',FXJ,"DR_CAP=0.35, ADR_CAP=0.15, CRIT_CAP=0.05,","DR_CAP=0.35, ADR_CAP=0.15, CRIT_CAP=0.06,",'Second String|ONE group'],
  ['Steady Nock 0.4%',FXJ,"eq_4_1:[ {param:'nk.crit',add:R(0.003)} ],","eq_4_1:[ {param:'nk.crit',add:R(0.004)} ],",'Second String'],
  ['Greenfall 5 s',FXJ,"e.gf=Math.max(e.gf,4+P0(T,'gf.dur'));","e.gf=Math.max(e.gf,5+P0(T,'gf.dur'));",'Greenfall:'],
  ['Greenfall heal 2%',FXJ,"eq_1_3:[ {param:'gf.heal',add:R(0.01)} ],","eq_1_3:[ {param:'gf.heal',add:R(0.02)} ],",'Greenfall:'],
  ['Thick Growth 0.5%',FXJ,"eq_9_3:[ {param:'gf.heal',add:R(0.004)} ],","eq_9_3:[ {param:'gf.heal',add:R(0.005)} ],",'Greenfall:'],
  ['Low Brush 3%',FXJ,"eq_4_3:[ {param:'gf.ug',add:R(0.02)} ],","eq_4_3:[ {param:'gf.ug',add:R(0.03)} ],",'Greenfall:'],
  ['Marked Green on Sloe too',FXJ,"if(e&&s!==u){ if(P['sp.wide']","if(e){ if(P['sp.wide']",'Greenfall:|Splits:'],
  ['Far Shot 3%',FXJ,"eq_10_4:[ {param:'gf.fs',add:R(0.02)} ],","eq_10_4:[ {param:'gf.fs',add:R(0.03)} ],",'Greenfall:'],
  ['Bloom 5 m',FXJ,"if(E.dist(x,a)-E.bodyR(x)-E.bodyR(a)<4*E.METER()","if(E.dist(x,a)-E.bodyR(x)-E.bodyR(a)<1*E.METER()",'Greenfall:'],
  ['New Growth at 2',FXJ,"if(vc.gfN>=3&&!vc.ng&&P['gf.ng'])","if(vc.gfN>=2&&!vc.ng&&P['gf.ng'])",'Greenfall:'],
  ['All at Once 20%',FXJ,"eq_5_2:[ {param:'vo.aao',add:0.15} ],","eq_5_2:[ {param:'vo.aao',add:0.20} ],",'the volley:'],
  ['All at Once 0.12 s apart',FXJ,"if(P0(T,'vo.aao')) c.o.stagger=0; else","if(P0(T,'vo.aao')) c.o.stagger=0.12; else",'the volley:'],
  ['Slowly 0.2 s apart',FXJ,"else if(P0(T,'vo.slow')) c.o.stagger=0.3;","else if(P0(T,'vo.slow')) c.o.stagger=0.2;",'the volley:'],
  ['Slowly step 6%',FXJ,"eq_5_3:[ {param:'vo.slow',add:0.05} ],","eq_5_3:[ {param:'vo.slow',add:0.06} ],",'the volley:'],
  ['Back Row Hunter 5%',FXJ,"eq_4_2:[ {param:'vo.back',add:R(0.04)} ],","eq_4_2:[ {param:'vo.back',add:R(0.05)} ],",'the volley:'],
  ['Fan of Green 2%',FXJ,"eq_12_2:[ {param:'vo.fan',add:R(0.01)} ],","eq_12_2:[ {param:'vo.fan',add:R(0.02)} ],",'the volley:'],
  ['Thorn Storm 5%',FXJ,"eq_11_2:[ {param:'vo.cd',add:R(0.04)} ],","eq_11_2:[ {param:'vo.cd',add:R(0.05)} ],",'the volley:'],
  ['Rapid Release past the group',FXJ,"x=Math.max(0,Math.min(CRIT_CAP,g+P0(T,'vo.crit'))-g);","x=Math.max(0,g+P0(T,'vo.crit')-g);",'the volley:'],
  ['Wood Sense 5 s',FXJ,"A.acts(T,u,[{window:'slWsn',dur:4}],c);","A.acts(T,u,[{window:'slWsn',dur:5}],c);",'the volley:'],
  ['Volley Pace 4%',FXJ,"eq_6_1:[ {stat:{nrg:R(0.03)}} ],","eq_6_1:[ {stat:{nrg:R(0.04)}} ],",'the volley:'],
  ['Slowly, Then All at Once every 29 s',FXJ,"vc.sigE=true; o.c3=30;","vc.sigE=true; o.c3=29;",'Slowly, Then All at Once'],
  ['Slowly, Then All at Once 5 more',FXJ,"let n=o.nk, sig=vc.sigE?6:0;","let n=o.nk, sig=vc.sigE?5:0;",'Slowly, Then All at Once'],
  ['Laid Bare 50%',FXJ,"if(e.lb>0){ m*=1.40; e.lb=0; }","if(e.lb>0){ m*=1.50; e.lb=0; }",'Slowly, Then All at Once'],
  ['Laid Bare kept',FXJ,"if(e.lb>0){ m*=1.40; e.lb=0; }","if(e.lb>0){ m*=1.40; }",'Slowly, Then All at Once'],
  ['Another Will Do 11%',FXJ,"eq_n1:[ {param:'awd.k',add:R(0.10)} ],","eq_n1:[ {param:'awd.k',add:R(0.11)} ],",'Another Will Do'],
  ['Another Will Do kept',FXJ,"add(P['awd.k']); o.awd=0; o.awdFrom=null; }","add(P['awd.k']); }",'Another Will Do'],
  ['Another Will Do 5 s',FXJ,"if(o.awdIn&&!inR){ o.awd=4; o.awdFrom=t; }","if(o.awdIn&&!inR){ o.awd=5; o.awdFrom=t; }",'Another Will Do'],
  // ---- the caps ----
  ['her group 40%',FXJ,"DR_CAP=0.35, ADR_CAP=0.15, CRIT","DR_CAP=0.40, ADR_CAP=0.15, CRIT",'ONE group'],
  ['her allies\' group 20%',FXJ,"DR_CAP=0.35, ADR_CAP=0.15,","DR_CAP=0.35, ADR_CAP=0.20,",'ONE group'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTree(src,dst,top){ fs.mkdirSync(dst,{recursive:true}); for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(top&&(SKIP.has(e.name)||e.name.startsWith('.ctl-')||e.name.startsWith('.tmp')||e.name.startsWith('.remote-'))) continue; const s=path.join(src,e.name), d=path.join(dst,e.name);
    if(e.isDirectory()) copyTree(s,d,false); else if(e.isFile()) fs.copyFileSync(s,d); } }
function copyTo(dir){ copyTree(root,dir,true); for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
const fix=(s,x)=>x.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n');
function count(c){ const s=fs.readFileSync(path.join(root,c[1]),'utf8'); return s.split(fix(s,c[2])).length-1; }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-slc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=fix(s,from), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,fix(s,to)));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-sloe.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.argv[2]==='--check'){ let bad=0; for(const c of C){ const n=count(c); if(n!==1){ bad++; console.log('FOUND '+n+' TIMES: '+c[0]); } } console.log('check: '+(C.length-bad)+' of '+C.length+' texts found exactly once'); process.exit(bad?1:0); }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
