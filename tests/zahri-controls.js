'use strict';
/* The controls for Zahri's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page site removed or given an unguarded
   seeded draw, a row or a number of hers broken), runs the named tests of tests/talents-mech-zahri.test.js in that copy, and expects them to FAIL. The checkout itself
   is never changed. Prints one line per control and a count; exits 1 if any control was not caught. J=1 by default: one copy at a time, each deleted as soon as it
   has run (the wiring brief's rule). ONLY=<regex> runs a subset. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const r=(id,from,to,pat)=>[id,FXJ,from,to,pat];
const C=[
  // ---- the page sites (removed: her talents stop; an unguarded draw: the no-talent identity breaks) ----
  ['the summon cap site',HTML,"(SUMMON_CAPS[key]||3)+(owner._zhCap||0))return null;","(SUMMON_CAPS[key]||3))return null;",'real kit'],
  ['the kitReady cap site',HTML,"(SUMMON_CAPS[ab.key||'zahri mirage']||1)+(u._zhCap||0)) return false;","(SUMMON_CAPS[ab.key||'zahri mirage']||1)) return false;",'real kit'],
  ['the kitReady reach site',HTML,"+ ((ty==='shred'&&u._zhLc)||0);","+ 0;",'real kit'],
  ['the fieldWH line',HTML,"TalentFx.bindMore({ fieldWH:()=>[FW,FD] });","TalentFx.bindMore({ fieldWHx:()=>[FW,FD] });",'/ the stampede'],
  ['an unguarded draw at the summon cap',HTML,"(SUMMON_CAPS[key]||3)+(owner._zhCap||0))return null;","(SUMMON_CAPS[key]||3)+(owner._zhCap||0)+0*brnd())return null;",'no talents'],
  ['an unguarded draw at the kitReady cap',HTML,"(SUMMON_CAPS[ab.key||'zahri mirage']||1)+(u._zhCap||0)) return false;","(SUMMON_CAPS[ab.key||'zahri mirage']||1)+(u._zhCap||0)+0*brnd()) return false;",'no talents'],
  ['an unguarded draw at the kitReady reach',HTML,"+ ((ty==='shred'&&u._zhLc)||0);","+ ((ty==='shred'&&u._zhLc)||0)+0*brnd();",'no talents'],
  // ---- Hoofbeats ----
  r('Hoofbeats every 5 m',"while(v.d5>=5*M){ v.d5-=5*M; T.fn.per5(A,T,u); }","while(v.d5>=4*M){ v.d5-=4*M; T.fn.per5(A,T,u); }",'/ Hoofbeats'),
  r('a jump is not travel',"if(mv>0&&mv<8*M){","if(mv>0&&mv<0.4*M){",'/ Hoofbeats'),
  r('8 at most',"HOOF_MAX=8,","HOOF_MAX=9,",'/ Hoofbeats'),
  r('Long Gallop',"rn_2_1:[ {param:'hoof.max',add:R(1)} ],","rn_2_1:[ {param:'hoof.max',add:R(0)} ],",'/ Hoofbeats'),
  r('Long Legs 1.5%',"rn_1_1:[ {on:'out',if:{auto:true},more:R(0.015),per:{fn:'spentN'}} ],","rn_1_1:[ {on:'out',if:{auto:true},more:R(0.01),per:{fn:'spentN'}} ],",'/ Hoofbeats'),
  r('the spend empties the bank',"v.sp=v.hoof; if(v.hoof>0){ v.stats.spent+=v.hoof; v.hoof=0; } },","v.sp=v.hoof; if(v.hoof>0){ v.stats.spent+=v.hoof; } },",'/ Hoofbeats'),
  r('abilities spend nothing',"{on:'out',if:{auto:true},reqAny:HOOF,do:[{fn:'spend'}]},","{on:'out',reqAny:HOOF,do:[{fn:'spend'}]},",'/ Hoofbeats'),
  r('Running Start at 6',"return v.nweT>0||v.hoof>=6; },","return v.nweT>0||v.hoof>=5; },",'/ Hoofbeats'),
  r('Wide Country',"rn_10_1:[ {stat:{aspd:R(0.002)},per:{fn:'hoofN'}} ],","rn_10_1:[ {stat:{aspd:R(0.003)},per:{fn:'hoofN'}} ],",'/ Hoofbeats'),
  r('Ride Through 0.3%',"rn_4_1:[ {param:'ride',add:R(0.003)} ],","rn_4_1:[ {param:'ride',add:R(0.002)} ],",'/ Hoofbeats'),
  r('Ride Through 3 s',"v.rdK=P.ride*n; v.rdT=3;","v.rdK=P.ride*n; v.rdT=6;",'/ Hoofbeats'),
  r('Gap in the Dust at 3',"sp3(A,T,u,c){ return !!c.auto&&V(T).sp>=3; },","sp3(A,T,u,c){ return !!c.auto&&V(T).sp>=4; },",'/ Hoofbeats'),
  r('Gap in the Dust Sunlit',"if(n>=3&&T.r.rn_n2&&T.r.sn_1_1&&t.alive) T.fn.putSun(A,T,u,t,5);","if(false) T.fn.putSun(A,T,u,t,5);",'/ Hoofbeats'),
  r('Hooves Like Drums',"rn_12_1:[ {param:'drums',add:R(2)} ],","rn_12_1:[ {param:'drums',add:R(1)} ],",'/ Hoofbeats'),
  r('High Noon at noon',"if(P.hnoon&&v.sun>=NOON){","if(P.hnoon){",'/ Hoofbeats'),
  r('High Noon within 2 m',"for(const x of A.pick(T,u,{team:'enemy',within:2},{u})) if(x!==t){ v.stats.noonHits++;","for(const x of A.pick(T,u,{team:'enemy',within:20},{u})) if(x!==t){ v.stats.noonHits++;",'/ Hoofbeats'),
  // ---- the sun ----
  r('a step every 4 s',"SUN_PERIOD=4,","SUN_PERIOD=5,",'/ Sun Height'),
  r('noon at 12',"NOON=12,","NOON=11,",'/ Sun Height'),
  r('Climbing Sun 0.3%',"rn_1_4:[ {stat:{atk:R(0.003)},per:{fn:'sunN'}} ],","rn_1_4:[ {stat:{atk:R(0.002)},per:{fn:'sunN'}} ],",'/ Sun Height'),
  r('Slow Sunset',"rn_5_4:[ {param:'sun.fast',add:R(0.3)} ],","rn_5_4:[ {param:'sun.fast',add:R(0.2)} ],",'/ Sun Height'),
  r('a new day',"if(!v.held){ v.sun=0; v.sacc=0; }","if(false){ v.sun=0; v.sacc=0; }",'/ Sun Height'),
  r('Late Morning at 6',"if(P.late&&v.sun>=6) cut(P.late);","if(P.late&&v.sun>=5) cut(P.late);",'/ Sun Height'),
  r('Glaring Heat basics only',"rn_4_4:[ {on:'out',if:{auto:true,fn:'noon'},more:R(0.02)} ],","rn_4_4:[ {on:'out',if:{fn:'noon'},more:R(0.02)} ],",'/ Sun Height'),
  r('Sunstruck 1 a rank',"rn_6_4:[ {param:'sunPen',add:R(1)} ],","rn_6_4:[ {param:'sunPen',add:R(2)} ],",'/ Sun Height'),
  r('Second Sun',"rn_12_3:[ {param:'sun2',add:R(1)} ],","rn_12_3:[ {param:'sun2',add:R(0)} ],",'/ Sun Height'),
  r('Afternoon holds noon',"if(v.sun>=NOON){ v.stats.noon++; if(P.aft) v.held=1; } } else if(P.aft&&v.aft<10) v.aft++; } }","if(v.sun>=NOON){ v.stats.noon++; } } else if(P.aft&&v.aft<10) v.aft++; } }",'/ Sun Height'),
  r('Afternoon up to 10',"else if(P.aft&&v.aft<10) v.aft++; } }","else if(P.aft&&v.aft<12) v.aft++; } }",'/ Sun Height'),
  r('Afternoon 0.5%',"rn_12_4:[ {param:'aft',add:R(0.005)},","rn_12_4:[ {param:'aft',add:R(0.004)},",'/ Sun Height'),
  r('Forenoon 3%',"const cap=0.5*(u.passMul||1), k=0.03*rk(T,'rn_2_4');","const cap=0.5*(u.passMul||1), k=0.04*rk(T,'rn_2_4');",'/ Sun Height'),
  r('Forenoon at 6',"mmK(A,T,u){ if(V(T).sun<6||","mmK(A,T,u){ if(V(T).sun<5||",'/ Sun Height'),
  // ---- travel ----
  r('Hot Sand',"rn_1_2:[ {stat:{move:R(0.02)}} ],","rn_1_2:[ {stat:{move:R(0.03)}} ],",'/ travel'),
  r('Wind at Her Back',"rn_3_2:[ {param:'wind',add:R(0.10)} ],","rn_3_2:[ {param:'wind',add:R(0.05)} ],",'/ travel'),
  r('Fast Thirst',"rn_7_1:[ {param:'thirst',add:R(0.005)} ],","rn_7_1:[ {param:'thirst',add:R(0.004)} ],",'/ travel'),
  r('the regeneration cap',"CRIT_POOL=500, REGEN=0.012, NOON=12,","CRIT_POOL=500, REGEN=0.024, NOON=12,",'/ travel'),
  r('Toward the Water: toward',"if(d1<d0-1e-9){ v.dtw+=mv;","if(true){ v.dtw+=mv;",'/ travel'),
  r('Toward the Water 4 s',"zhTw:{max:10, dur:4}","zhTw:{max:10, dur:8}",'/ travel'),
  r('Dust Trail 1 m',"for(const x of A.pick(T,u,{team:'enemy',within:1},{u})) A.acts(T,u,[{slow:P.dust,dur:2,on:'target'}],{u,tgt:x}); } }","for(const x of A.pick(T,u,{team:'enemy',within:40},{u})) A.acts(T,u,[{slow:P.dust,dur:2,on:'target'}],{u,tgt:x}); } }",'/ travel'),
  r('Dust Devil 3 s',"r.zt=2; r.h3=3; r.pb=1; v.lastT=t;","r.zt=2; r.h3=6; r.pb=1; v.lastT=t;",'/ travel'),
  r('No Shade 2 s',"still2(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.still>=2); },","still2(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.still>=0); },",'/ travel'),
  r('Seen Through',"bigger(A,T,u,c){ return !!c.tgt&&(c.tgt.maxHp||0)>(u.maxHp||0); },","bigger(A,T,u,c){ return !!c.tgt; },",'/ travel'),
  r('Ride Them Down full',"const dmFull=u=>!!(u.pass&&u.pass.desertmom)&&(u._dmAS||0)>=0.5*(u.passMul||1)-1e-9;","const dmFull=u=>!!(u.pass&&u.pass.desertmom)&&(u._dmAS||0)>=0;",'/ travel'),
  r('Hoof Rhythm',"rn_10_3:[ {param:'rhythm',add:R(0.005)} ],","rn_10_3:[ {param:'rhythm',add:R(0.004)} ],",'/ travel'),
  r('Penetrating Heat',"sn_3_2:[ {param:'pheat',add:R(1)} ],","sn_3_2:[ {param:'pheat',add:R(2)} ],",'/ travel'),
  r('Ninth Week half',"u._dmAS=Math.max(u._dmAS||0,0.25*pm);","u._dmAS=Math.max(u._dmAS||0,0.30*pm);",'/ travel'),
  r('Ninth Week first wave only',"if(v.first){ v.first=0;","if(v.first){",'/ travel'),
  // ---- the stampede ----
  r('Never Turn Back',"if(P.ntb&&u._stampX0!=null&&E.fieldWH){","if(false){",'/ the stampede'),
  r('To the Horizon',"rn_6_2:[ {on:'out',if:{fn:'stamp'},more:R(0.03)} ],","rn_6_2:[ {on:'out',if:{fn:'stamp'},more:R(0.02)} ],",'/ the stampede'),
  r('Circle the Herd 0.5 s',"u._stampStun=(u._stampStun||1)+0.5/(E.ccDur(1)||0.7);","u._stampStun=(u._stampStun||1)+0.4/(E.ccDur(1)||0.7);",'/ the stampede'),
  r('Circle the Herd on her line',"T.fn.onLine(A,T,u,e); } }","void 0; } }",'/ the stampede'),
  r('Underfoot after the stun',"if(r.stS&&!((t.stunned||0)>0)){ r.stS=0; if(T.r.rn_7_3) r.tr=3; }","if(r.stS){ r.stS=0; if(T.r.rn_7_3) r.tr=3; }",'/ the stampede'),
  r('Underfoot 3 s',"if(T.r.rn_7_3) r.tr=3; }","if(T.r.rn_7_3) r.tr=6; }",'/ the stampede'),
  r('Dry Wind 5 s',"if(T.r.rn_10_4) r.dw=5;","if(T.r.rn_10_4) r.dw=9;",'/ the stampede'),
  r('Follow Me 40%',"hr_7_2:[ {param:'follow',add:0.40} ],","hr_7_2:[ {param:'follow',add:0.30} ],",'/ the stampede'),
  r('Stampede of Ghosts',"hr_9_2:[ {param:'ghost',add:R(0.04)} ],","hr_9_2:[ {param:'ghost',add:R(0.02)} ],",'/ the stampede'),
  r('Sun Over Shoulder Glare',"T.fn.putGlare(A,T,u,t,2+(P['gl.dur']||0)+(P.spot||0)); }","T.fn.putGlare(A,T,u,t,2+(P['gl.dur']||0)); }",'/ the stampede'),
  r('a stampede hit is the run\'s',"stamp(A,T,u,c){ return !!u._stampFoes&&T.s.cur==null&&!c.auto; },","stamp(A,T,u,c){ return (u._stampT||0)>1e9; },",'/ the stampede'),
  // ---- Solar Impalement, Sunlit ----
  r('Lance Line',"hr_7_3:[ {on:'out',if:{casting:GR},more:R(0.03)} ],","hr_7_3:[ {on:'out',if:{casting:GR},more:R(0.02)} ],",'/ Solar Impalement'),
  r('Sun-Forged Tip',"sn_7_1:[ {on:'out',if:{casting:GR},more:R(0.03)} ],","sn_7_1:[ {on:'out',if:{casting:GR},more:R(0.02)} ],",'/ Solar Impalement'),
  r('Wider Opening',"sn_2_1:[ {param:'wider',add:R(0.02)} ],","sn_2_1:[ {param:'wider',add:R(0.01)} ],",'/ Solar Impalement'),
  r('Through and Through behind',"if(side<=br+0.5*M&&E.dist(t,x)-E.bodyR(t)-br<=L) out.push([x,p]); } }","if(false) out.push([x,p]); } }",'/ Solar Impalement'),
  r('Spitting Sun',"sn_6_1:[ {param:'cd.g',add:R(0.3)} ],","sn_6_1:[ {param:'cd.g',add:R(0.2)} ],",'/ Solar Impalement'),
  r('Called Closer',"hr_2_2:[ {param:'cd.b',add:R(0.3)} ],","hr_2_2:[ {param:'cd.b',add:R(0.2)} ],",'/ Solar Impalement'),
  r('Lance Charge 4 m',"rn_7_2:[ {param:'lc',add:4} ],","rn_7_2:[ {param:'lc',add:3} ],",'/ Solar Impalement'),
  r('Lance Charge dash',"u._dash={x0:u.x,y0:u.y,x1:u.x+ux*run,y1:u.y+uy*run,","u._dash={x0:u.x,y0:u.y,x1:u.x+ux*run*0.5,y1:u.y+uy*run*0.5,",'/ Solar Impalement'),
  r('Spear Point at 3 m',"if(T.r.rn_9_2&&run>=3*M-1e-6) v.spear=1;","if(T.r.rn_9_2&&run>=4*M-1e-6) v.spear=1;",'/ Solar Impalement'),
  r('Find the Gap 5 s',"if(has(T,LIT)) T.fn.putSun(A,T,u,t,5); }","if(has(T,LIT)) T.fn.putSun(A,T,u,t,4); }",'/ Solar Impalement'),
  r('Find the Gap 1.5%',"sn_1_1:[ {param:'lit',add:R(0.015)} ],","sn_1_1:[ {param:'lit',add:R(0.01)} ],",'/ Solar Impalement'),
  r('A Gap for All',"sn_12_2:[ {param:'lit2',add:R(0.01)} ],","sn_12_2:[ {param:'lit2',add:R(0.02)} ],",'/ Solar Impalement'),
  r('Sunlit: allies, not Zahri',"const hero=!s._summon;","const hero=!s._summon||true;",'/ Solar Impalement'),
  r('Show the Way',"s._wpnArmIgn=1-(1-(sv||0))*(1-P.way);","s._wpnArmIgn=1-(1-(sv||0))*(1-0);",'/ Solar Impalement'),
  r('Open to All abilities only',"if(P.ota&&!c.auto) c.amt*=1+P.ota; } },","if(P.ota) c.amt*=1+P.ota; } },",'/ Solar Impalement'),
  r('Hold It Open one at a time',"if(T.P.hio) A.setMark(T,u,t,'zhSun',{unique:true});","if(T.P.hio) A.setMark(T,u,t,'zhSun',{});",'/ Solar Impalement'),
  r('One Gap at a Time',"sn_6_2:[ {on:'out',if:{fn:'sunlit'},more:R(0.02)} ],","sn_6_2:[ {on:'out',if:{fn:'sunlit'},more:R(0.01)} ],",'/ Solar Impalement'),
  r('Drive It Home 25%',"sn_5_3:[ {param:'dih',add:0.25},","sn_5_3:[ {param:'dih',add:0.20},",'/ Solar Impalement'),
  r('Drive It Home closes',"closeGap(A,T,u,c){ if(c.tgt) A.clearMark(u,c.tgt,'zhSun'); },","closeGap(A,T,u,c){ },",'/ Solar Impalement'),
  r('Hilt-Deep points',"sn_7_3:[ {param:'dih',add:R(0.03)} ],","sn_7_3:[ {param:'dih',add:R(0.02)} ],",'/ Solar Impalement'),
  r('Gap Finder time left',"else if(mk.until!=null) T.fn.putSun(A,T,u,b,Math.max(0,mk.until-E.now())); } } },","else if(mk.until!=null) T.fn.putSun(A,T,u,b,5); } } },",'/ Solar Impalement'),
  r('Open Day at 3',"if(x.alive&&x.team!==u.team&&A.markOf(u,x,'zhSun')) n++; return n>=3; },","if(x.alive&&x.team!==u.team&&A.markOf(u,x,'zhSun')) n++; return n>=4; },",'/ Solar Impalement'),
  r('Open Day 10%',"sn_11_2:[ {stat:{aspd:0.10},to:{team:'ally',others:true},if:{fn:'lit3'}} ],","sn_11_2:[ {stat:{aspd:0.10},to:{team:'ally'},if:{fn:'lit3'}} ],",'/ Solar Impalement'),
  // ---- Glare ----
  r('crits Glare',"if(c.crit&&has(T,GLARE)&&T.r.sn_1_4&&t.alive)","if(has(T,GLARE)&&T.r.sn_1_4&&t.alive)",'/ Glare'),
  r('White Light',"sn_2_4:[ {param:'gl.dur',add:R(0.3)} ],","sn_2_4:[ {param:'gl.dur',add:R(0.2)} ],",'/ Glare'),
  r('Glare 3% on her',"if(P.gl&&T.fn.glOn(A,u,s)) cut(P.gl); }","if(false) cut(P.gl); }",'/ Glare'),
  r('Glare on an ally',"if(t!==u&&!t._summon&&P.gl&&T.fn.glOn(A,u,s)) c.amt*=1-Math.min(0.5,P.gl);","if(false) c.amt*=1-Math.min(0.5,P.gl);",'/ Glare'),
  r('Glare on a mirage',"if(P.gl&&s&&T.fn.glOn(A,u,s)) cut(P.gl); return Math.max(MIR_FLOOR,k); },","return Math.max(MIR_FLOOR,k); },",'/ Glare'),
  r('Blinding Point',"sn_4_4:[ {on:'out',if:{fn:'glared'},critMore:R(0.03)} ],","sn_4_4:[ {on:'out',if:{fn:'glared'},critMore:R(0.02)} ],",'/ Glare'),
  r('Sunspots',"sn_5_4:[ {stat:{crit:R(-0.03)},to:{team:'enemy',has:'zhGl'}} ],","sn_5_4:[ {stat:{crit:R(-0.02)},to:{team:'enemy',has:'zhGl'}} ],",'/ Glare'),
  r('Blind Noon',"sn_12_4:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'zhGl'}} ],","sn_12_4:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'zhGl'}} ],",'/ Glare'),
  r('Shadowless',"t.shield=r.sh+(sh-r.sh)*(1-Math.min(1,P.shadow));","t.shield=r.sh+(sh-r.sh)*(1-Math.min(1,P.shadow*0.5));",'/ Glare'),
  r('Glare of Noon',"sn_10_4:[ {param:'gnoon',add:R(0.01)} ],","sn_10_4:[ {param:'gnoon',add:R(0.02)} ],",'/ Glare'),
  r('Point Blank first',"first(A,T,u,c){ const r=recOf(T,c.tgt); return !r||!r.pb; },","first(A,T,u,c){ return true; },",'/ Glare'),
  r('Hot Iron',"sn_12_3:[ {param:'iron',add:R(0.01)} ],","sn_12_3:[ {param:'iron',add:R(0.02)} ],",'/ Glare'),
  r('Through the Ribs',"sn_10_1:[ {on:'out',ignoreArmor:R(0.015)} ],","sn_10_1:[ {on:'out',ignoreArmor:R(0)} ],",'/ Glare'),
  r('Lance Tip',"hr_10_3:[ {on:'out',ignoreArmor:R(0.02)} ],","hr_10_3:[ {on:'out',ignoreArmor:R(0)} ],",'/ Glare'),
  // ---- the herd ----
  r('A Herd Again 2/3',"fork=P.aha?2/3:(P.ots?1.5:1), want=","fork=P.aha?0.8:(P.ots?1.5:1), want=",'/ the herd: the forks'),
  r('One True Shape 1.5',"fork=P.aha?2/3:(P.ots?1.5:1), want=","fork=P.aha?2/3:(P.ots?1.4:1), want=",'/ the herd: the forks'),
  r('One True Shape Desert Momentum',"if(P.ots){ m.pass=Object.assign({},m.pass||{},{desertmom:true}); m.passMul=u.passMul||1; } }","}",'/ the herd: the forks'),
  r('Truer Than Most',"hr_6_3:[ {param:'truer',add:R(0.03)} ],","hr_6_3:[ {param:'truer',add:R(0.02)} ],",'/ the herd: the forks'),
  r('Remembered 5 at most',"if(has(T,REM)&&v.rem<5){ v.rem++; v.stats.rem++; }","if(has(T,REM)&&v.rem<6){ v.rem++; v.stats.rem++; }",'/ the herd: the forks'),
  r('One Horned Shape',"hr_1_1:[ {param:'horn',add:R(0.01)} ],","hr_1_1:[ {param:'horn',add:R(0.02)} ],",'/ the herd: the forks'),
  r('Old Faces',"hr_4_1:[ {stat:{atk:R(0.005)},per:{fn:'remN'}} ],","hr_4_1:[ {stat:{atk:R(0.004)},per:{fn:'remN'}} ],",'/ the herd: the forks'),
  r('Five Names at 5',"rem5(A,T){ return V(T).rem>=5; },","rem5(A,T){ return V(T).rem>=6; },",'/ the herd: the forks'),
  r('Herd Memory',"hr_8_1:[ {param:'hmem',add:R(0.01)} ],","hr_8_1:[ {param:'hmem',add:R(0.02)} ],",'/ the herd: the forks'),
  r('Lance Twin',"hr_3_3:[ {on:'sOut',more:R(0.03)} ],","hr_3_3:[ {on:'sOut',more:R(0.02)} ],",'/ the herd: the forks'),
  r('Water on the Horizon',"if(P.water) v.rem=Math.min(5,Math.max(v.rem,P.water)); }","}",'/ the herd: the forks'),
  r('Herd Sense',"hr_2_3:[ {stat:{atk:R(0.02)},if:{mine:MKEY}} ],","hr_2_3:[ {stat:{atk:R(0.01)},if:{mine:MKEY}} ],",'/ the herd: the forks'),
  r('Pace Keeper',"hr_2_1:[ {stat:{move:R(0.03),aspd:R(0.03)},to:{team:'ally',mine:MKEY}} ],","hr_2_1:[ {stat:{move:R(0.03),aspd:R(0.02)},to:{team:'ally',mine:MKEY}} ],",'/ the herd: the forks'),
  r('Kept Pace above half',"per:{fn:'kpN'},if:{selfHpAbove:0.5}} ],","per:{fn:'kpN'}} ],",'/ the herd: the forks'),
  r('Herdmate 10%',"hr_12_3:[ {param:'mate',add:R(0.10)},","hr_12_3:[ {param:'mate',add:R(0.05)},",'/ the herd: the forks'),
  r('Blurred Edges',"hr_4_2:[ {param:'blur',add:R(0.04)} ],","hr_4_2:[ {param:'blur',add:R(0.03)} ],",'/ the herd and Shimmer'),
  r('Unreal Footing',"if(P.unreal&&s&&T.fn.shOn(A,u,s)) cut(P.unreal);","if(P.unreal) cut(P.unreal);",'/ the herd and Shimmer'),
  r('Still Running',"if(P.still&&!x._zhRisen) u.blueCd=0;","if(false) u.blueCd=0;",'/ the herd and Shimmer'),
  r('Grief Speed 4 s',"A.acts(T,u,[{window:'zhGr',dur:4}],{u}); return; }","A.acts(T,u,[{window:'zhGr',dur:8}],{u}); return; }",'/ the herd and Shimmer'),
  r('Who Followed 2 m',"for(const e of A.pick(T,u,{team:'enemy',of:'unit',within:2},{u,unit:x})) T.fn.putShim(A,T,u,e,3);","for(const e of A.pick(T,u,{team:'enemy',of:'unit',within:40},{u,unit:x})) T.fn.putShim(A,T,u,e,3);",'/ the herd and Shimmer'),
  r('Mirage Dust',"hr_5_4:[ {param:'mdust',add:R(0.03)} ],","hr_5_4:[ {param:'mdust',add:R(0.02)} ],",'/ the herd and Shimmer'),
  r('Two of Her',"if(P.two&&r.mt>0) c.amt*=1+P.two;","if(P.two) c.amt*=1+P.two;",'/ the herd and Shimmer'),
  r('Two of Her 2 s',"const r=rec(T,t); r.mt=2;","const r=rec(T,t); r.mt=5;",'/ the herd and Shimmer'),
  r('Running Together',"if(P.rtog) cut(P.rtog*Math.min(5,T.fn.mirN(A,T,u)));","if(P.rtog) cut(P.rtog*Math.min(1,T.fn.mirN(A,T,u)));",'/ the herd and Shimmer'),
  r('False Target 3 s',"if(T.r.hr_n1) rec(T,s).ft=3;","if(T.r.hr_n1) rec(T,s).ft=6;",'/ the herd and Shimmer'),
  r('Close Enough to Touch',"hr_12_2:[ {param:'touch',add:R(0.01)} ],","hr_12_2:[ {param:'touch',add:R(0.02)} ],",'/ the herd and Shimmer'),
  r('Not There above 15%',"if(P.nt&&c.amt>0.15*(u.maxHp||0)){","if(P.nt&&c.amt>0.05*(u.maxHp||0)){",'/ the herd and Shimmer'),
  r('Not There 10%',"hr_12_4:[ {param:'nt',add:R(0.10)} ],","hr_12_4:[ {param:'nt',add:R(0.08)} ],",'/ the herd and Shimmer'),
  r('Hide in the Heat abilities only',"if(P.hide&&!c.auto&&s){","if(P.hide&&s){",'/ the herd and Shimmer'),
  r('Shimmer 3 s',"T.fn.putShim(A,T,u,t,3+(P['shim.dur']||0));","T.fn.putShim(A,T,u,t,4+(P['shim.dur']||0));",'/ the herd and Shimmer'),
  r('Haze of Noon',"hr_3_4:[ {param:'shim.dur',add:R(0.3)} ],","hr_3_4:[ {param:'shim.dur',add:R(0.2)} ],",'/ the herd and Shimmer'),
  r('Shimmer basic attacks only',"if(!P.shim||!c.auto||!T.fn.shOn(A,u,s)) return false;","if(!P.shim||!T.fn.shOn(A,u,s)) return false;",'/ the herd and Shimmer'),
  r('Shimmer 2% a rank',"hr_1_4:[ {param:'shim',add:R(0.02)} ],","hr_1_4:[ {param:'shim',add:R(0.06)} ],",'/ the herd and Shimmer'),
  r('Lost in the Haze',"if(P.lost&&s.alive){","if(false){",'/ the herd and Shimmer'),
  r('Sun Glint',"hr_6_4:[ {param:'cp.sg',add:R(1)} ],","hr_6_4:[ {param:'cp.sg',add:R(2)} ],",'/ the herd and Shimmer'),
  // ---- signatures ----
  r('Noon Without End 8',"if(P.nwe&&n>=8&&v.sun>=NOON&&","if(P.nwe&&n>=9&&v.sun>=NOON&&",'/ the signatures'),
  r('Noon Without End counts 8',"spend(A,T,u,c){ const v=V(T); if(v.nweT>0){ v.sp=8; return; }","spend(A,T,u,c){ const v=V(T); if(v.nweT>0){ v.sp=7; return; }",'/ the signatures'),
  r('Noon Without End 30%',"rn_13_2:[ {param:'nwe',add:1}, {stat:{move:0.30},if:{fn:'nweOn'}} ],","rn_13_2:[ {param:'nwe',add:1}, {stat:{move:0.20},if:{fn:'nweOn'}} ],",'/ the signatures'),
  r('Noon Without End 2 m',"const want=((P.lunge||0)+(v.nweT>0?2:0))*M;","const want=((P.lunge||0)+(v.nweT>0?1:0))*M;",'/ the signatures'),
  r('Noon Without End 5 s',"NWE_DUR=5,","NWE_DUR=6,",'/ the signatures'),
  r('Noon Without End 25 s',"NWE_CD=25,","NWE_CD=1,",'/ the signatures'),
  r('Noon Without End fills Desert Momentum',"const pm=u.passMul||1; u._dmAS=0.5*pm; u._dmPen=120*pm; } } } }","} } } }",'/ the signatures'),
  r('They Followed Her once',"if(v.tfh||!T.P.tfh) return;","if(!T.P.tfh) return;",'/ the signatures'),
  r('They Followed Her 1 s',"T.s.undy=Math.max(T.s.undy||0,1);","T.s.undy=Math.max(T.s.undy||0,0.01);",'/ the signatures'),
  r('the herd rises 8 s',"m=E.summon(u,MKEY,8,{a,r:1.6*M,share:0.5/0.30});","m=E.summon(u,MKEY,20,{a,r:1.6*M,share:0.5/0.30});",'/ the signatures'),
  r('the risen heal',"v.risen=v.risen.filter(x=>x.alive); if(v.risen.length){ E.healUnit(u,room); return; }","v.risen=v.risen.filter(x=>x.alive); if(v.risen.length){ return; }",'/ the signatures'),
  r('The Sun Lance needs both',"v.gSG=(P.lance&&t&&T.fn.litOn(A,u,t)&&T.fn.glOn(A,u,t))?1:0;","v.gSG=(P.lance&&t&&T.fn.litOn(A,u,t))?1:0;",'/ the signatures'),
  r('The Sun Lance 10 m',"for(const x of T.fn.behind(A,T,u,t,10*M,'line')){","for(const x of T.fn.behind(A,T,u,t,5*M,'line')){",'/ the signatures'),
  r('The Sun Lance zero armour',"A.setMark(T,u,x,'zhZero',{dur:4,longest:true}); } }","} }",'/ the signatures'),
  r('The Sun Lance 20 s',"SL_CD=20;","SL_CD=0;",'/ the signatures'),
  // ---- caps, clocks ----
  r('the 40% group floor',"const DR_FLOOR=0.60, MIR_FLOOR=0.75,","const DR_FLOOR=0.50, MIR_FLOOR=0.75,",'one product'),
  r('the 25% mirage floor',"const DR_FLOOR=0.60, MIR_FLOOR=0.75,","const DR_FLOOR=0.60, MIR_FLOOR=0.70,",'one product'),
  r('the 30% control floor',"MIR_FLOOR=0.75, CC_FLOOR=0.70,","MIR_FLOOR=0.75, CC_FLOOR=0.60,",'one product'),
  r('Running Free per Hoofbeat',"rn_n1:[ {param:'rfree',add:R(0.006)} ],","rn_n1:[ {param:'rfree',add:R(0)} ],",'one product'),
  r('the 5% crit pool',"CC_FLOOR=0.70, CRIT_POOL=500,","CC_FLOOR=0.70, CRIT_POOL=600,",'one product'),
  r('countdowns',"for(const f of ['rdT','nweT','nweCd','slCd']) if(v[f]>0) v[f]=Math.max(0,v[f]-dt);","for(const f of ['rdT','nweT','nweCd','slCd']) if(v[f]>0) v[f]=Math.max(0,v[f]-dt*2);",'countdowns'),
  r('the records drop at a wave',"v.e={}; v.px=null; v.py=null;","v.px=null; v.py=null;",'countdowns'),
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-logs']);
const TMP=(()=>{ const t=os.tmpdir(), r=path.relative(root,t); return (!r.startsWith('..')&&!path.isAbsolute(r))?path.dirname(root):t; })();   // the test host keeps its temp folder inside the checkout: copy beside it instead
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); const top=r.split(path.sep)[0]; return !r||!(SKIP.has(top)||top.startsWith('.remote-')||top.startsWith('.ctl-')); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))){ try{ fs.symlinkSync(path.join(root,k),path.join(dir,k),process.platform==='win32'?'junction':undefined); }
    catch(e){ fs.cpSync(path.join(root,k),path.join(dir,k),{recursive:true}); } } }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-zhc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-zahri.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/(?:#|ℹ) fail (\d+)/.exec(out), pm=/(?:#|ℹ) pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||1), only=process.env.ONLY?new RegExp(process.env.ONLY):null, list=only?C.filter(c=>only.test(c[0])):C, out=[]; let i=0;
  async function worker(){ while(i<list.length){ const c=list[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
