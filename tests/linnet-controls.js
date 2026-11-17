'use strict';
/* The controls for Linnet's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder (os.tmpdir(): the runner's own temp folder beside the slot), breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated
   talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a row or a cap of hers broken), runs the named tests of
   tests/talents-mech-linnet.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child processes); each copy is deleted when its run is
   done; .logs and node_modules are never copied (node_modules is linked). The checkout itself is never changed.
   Prints one line per control and a count; exits 1 if any control was not caught.   Run: node tests/linnet-controls.js [regex of control names] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', DRAW='brnd();';
const MS="      if(l&&u._tal&&u._tal.on.skillTgt) l=TalentFx.skillTgt(u,'mendburst',l,o)||l;";
const ST="      if(u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,'lastbreath',best,o)||best;";
const GT="healUnit(u._gtTo,(u._tal&&u._tal.on.num)?TalentFx.num(u,'gtPass',";
const C=[
  // ---- the page sites: hook removed (her tests fail) ----
  ['Mending Stitch target hook removed',HTML,MS,'','Thread She Can See'],
  ['Reinforced Seam target hook removed',HTML,ST,'','Seam on the Line'],
  ['Golden Thread share hook removed',HTML,GT,"healUnit(u._gtTo,(false)?TalentFx.num(u,'gtPass',",'the thread.s share|Two Threads'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at Mending Stitch\'s target',HTML,MS,'      '+DRAW+MS.slice(5),'no talents'],
  ['draw at Reinforced Seam\'s target',HTML,ST,'      '+DRAW+ST.slice(5),'no talents'],
  ['draw at Golden Thread\'s share',HTML,GT,"healUnit(u._gtTo,(brnd()>=0&&u._tal&&u._tal.on.num)?TalentFx.num(u,'gtPass',",'no talents'],
  // ---- Stitches ----
  ['Running Stitch 4%',FXJ,"ml_1_1:[ {param:'st.pull',add:R(0.03)} ],","ml_1_1:[ {param:'st.pull',add:R(0.04)} ],",'Stitches:'],
  ['Stitches up to 7',FXJ,"lnSt:{unit:true,max:P('st.max',6)","lnSt:{unit:true,max:P('st.max',7)",'Stitches:'],
  ['Stitches 9 s',FXJ,"dur:P('st.dur',8)}","dur:P('st.dur',9)}",'Stitches:'],
  ['a big hit is 5%',FXJ,"c.amt>0.10*x.maxHp&&any(T,STITCH)","c.amt>0.05*x.maxHp&&any(T,STITCH)",'Stitches:'],
  ['Pattern Book 2',FXJ,"ml_10_1:[ {param:'st.nrg',add:R(1)} ],","ml_10_1:[ {param:'st.nrg',add:R(2)} ],",'Stitches:'],
  ['Master Weaver over 2 s',FXJ,"E.pushHot(x,saved*Pp['st.back']/3,3,1);","E.pushHot(x,saved*Pp['st.back']/2,2,1);",'Stitches:'],
  ['Hold the Hem every time',FXJ,"L[x.uid]=now+8; (o.hem||(o.hem={}))[x.uid]=1;","L[x.uid]=now; (o.hem||(o.hem={}))[x.uid]=1;",'Stitches:'],
  ['Hold the Hem x1.5',FXJ,"if(o.hem&&o.hem[x.uid]){ o.hem[x.uid]=0; k*=2; }","if(o.hem&&o.hem[x.uid]){ o.hem[x.uid]=0; k*=1.5; }",'Stitches:'],
  ['Long Thread 0.5 s floor',FXJ,"1/Math.max(0.25,1-T.P['st.fast'])","1/Math.max(0.5,1-T.P['st.fast'])",'Slow Stitch'],
  ['Slow Stitch 25% weaker',FXJ,"else if(r.ml_5_3) k*=0.70;","else if(r.ml_5_3) k*=0.75;",'Slow Stitch'],
  ['Quick Stitch 35%',FXJ,"if(r.ml_5_2) k*=1.40;","if(r.ml_5_2) k*=1.35;",'Slow Stitch'],
  ['Quick Stitch 1 s shorter',FXJ,"ml_5_2:[ {on:'kit',skill:MEND,opt:{dur:{add:-2}}} ],","ml_5_2:[ {on:'kit',skill:MEND,opt:{dur:{add:-1}}} ],",'Slow Stitch'],
  ['Backstitch 14%',FXJ,"{param:'backstitch',add:0.15}","{param:'backstitch',add:0.14}",'Backstitch'],
  ['Backstitch 4 s',FXJ,"(o.bs||(o.bs={}))[x.uid]=now+3;","(o.bs||(o.bs={}))[x.uid]=now+4;",'Backstitch'],
  ['Backstitch at 7',FXJ,"if(Pp.backstitch&&stN(A,T,u,x)>=6)","if(Pp.backstitch&&stN(A,T,u,x)>=7)",'Backstitch'],
  ['Linen Cloak at 2',FXJ,"if(Pp.linen&&auto&&st>=3)","if(Pp.linen&&auto&&st>=2)",'Backstitch'],
  ['allies\' cap 30%',FXJ,"DR_ALLY=0.75","DR_ALLY=0.70",'Backstitch|most defensive'],
  ['Double Knot 0.5%',FXJ,"{param:'knot.dr',add:R(0.004)}","{param:'knot.dr',add:R(0.005)}",'Backstitch'],
  ['Snagged Thread 4%',FXJ,"{param:'snag',add:0.03}","{param:'snag',add:0.04}",'Frayed'],
  ['Snagged Frayed every time',FXJ,"L[s.uid]=now+1; frAdd(A,T,u,s,1);","L[s.uid]=now; frAdd(A,T,u,s,1);",'Frayed'],
  // ---- Loose ----
  ['Loose 5 s',FXJ,"const looseWin=T=>3+","const looseWin=T=>5+",'Loose:'],
  ['Newest Rows 4%',FXJ,"0.03*rk(T,'ml_2_2')","0.04*rk(T,'ml_2_2')",'Loose:'],
  ['a heal does not mend Loose',FXJ,"if(got>0&&o.lg) looseUse(T,x,got);","",'Loose:'],
  ['Thin Wool 4% more on her',FXJ,"{param:'risk.in',add:R(0.03)}","{param:'risk.in',add:R(0.04)}",'Loose:'],
  ['Snap Mend 6%',FXJ,"s+=0.05*rk(T,'ml_6_2')","s+=0.06*rk(T,'ml_6_2')",'Loose:'],
  ['Fresh Seam without Seam Sense',FXJ,"E.healUnit(x,L*(1+(Pp['fresh.k']||0)));","E.healUnit(x,L);",'Loose:'],
  ['Fresh Seam leaves the Loose',FXJ,"const g=o.lg&&o.lg[x.uid]; if(g) g.length=0;","",'Loose:'],
  // ---- Mending Stitch ----
  ['Fine Needle 3%',FXJ,"k+=0.02*rk(T,'ml_1_3')+0.03*rk(T,'gl_4_1');","k+=0.03*rk(T,'ml_1_3')+0.03*rk(T,'gl_4_1');",'Mending Stitch:'],
  ['Patient Weaver below 30%',FXJ,"if(r.ml_9_3&&frac(x)<0.40)","if(r.ml_9_3&&frac(x)<0.30)",'Mending Stitch:'],
  ['Gentle Pull 0.5%',FXJ,"if(r.ml_7_1) k+=0.004*r.ml_7_1*stN(A,T,u,x);","if(r.ml_7_1) k+=0.005*r.ml_7_1*stN(A,T,u,x);",'Mending Stitch:'],
  ['Double Thread never',FXJ,"const add=Pp['ms.part']||0;","const add=0;",'Mending Stitch:'],
  ['Close Work 0.2 s',FXJ,"ml_4_1:[ {on:'cd',skill:'green',add:R(-0.1)} ],","ml_4_1:[ {on:'cd',skill:'green',add:R(-0.2)} ],",'Mending Stitch:'],
  ['Blade Sense 2%',FXJ,"sh_10_2:[ {on:'cd',less:R(0.01)} ],","sh_10_2:[ {on:'cd',less:R(0.02)} ],",'Mending Stitch:'],
  // ---- Knots ----
  ['Tie It Off 2%',FXJ,"1+0.01*rk(T,'ml_4_4')*knN(T,x)","1+0.02*rk(T,'ml_4_4')*knN(T,x)",'Knots'],
  ['Knots up to 4',FXJ,"mx=3+(Pp['knot.max']||0)","mx=4+(Pp['knot.max']||0)",'Knots'],
  ['Knot Spell 4%',FXJ,"{param:'knot.heal',add:R(0.03)}","{param:'knot.heal',add:R(0.04)}",'Knots'],
  ['a Seam ends: no Knot',FXJ,"if(s.x.alive&&any(T,KNOT)) T.fn.knot(A,T,u,s.x);","",'Knots'],
  ['Knotted Strength at 7',FXJ,"knN(T,s)>=3) k+=Pp['knot.dmg'];","knN(T,s)>=7) k+=Pp['knot.dmg'];",'Knots'],
  ['Tight Knots at 7',FXJ,"if(Pp['ten.knot']&&knN(T,x)>=3&&","if(Pp['ten.knot']&&knN(T,x)>=7&&",'Knots'],
  ['Stronger Seam 4%',FXJ,"ml_5_1:[ {on:'kit',skill:SEAM,opt:{mul:{more:R(0.03)}}} ],","ml_5_1:[ {on:'kit',skill:SEAM,opt:{mul:{more:R(0.04)}}} ],",'Knots'],
  ['Clean Edges 0.2 s',FXJ,"ml_8_3:[ {on:'kit',skill:SEAM,opt:{dur:{add:R(0.1)}}} ],","ml_8_3:[ {on:'kit',skill:SEAM,opt:{dur:{add:R(0.2)}}} ],",'Knots'],
  ['Mended Twice within 0.5 s',FXJ,"if(now-e.t<=4+1e-9&&","if(now-e.t<=0.5+1e-9&&",'Mended Twice'],
  ['Mended Twice every time',FXJ,"e.l=now+8; E.healUnit(x,x.maxHp*Pp.twice);","e.l=now; E.healUnit(x,x.maxHp*Pp.twice);",'Mended Twice'],
  // ---- Rewrite the Pattern ----
  ['Second Pattern 3%',FXJ,"ml_12_2:[ {param:'rw.rev',add:R(0.02)} ],","ml_12_2:[ {param:'rw.rev',add:R(0.03)} ],",'Rewrite the Pattern:'],
  ['Five Seconds 3%',FXJ,"else k+=0.02*rk(T,'sh_9_2');","else k+=0.03*rk(T,'sh_9_2');",'Rewrite the Pattern:'],
  ['Rewrite in Stitches 5',FXJ,"for(const a of touched) stAdd(A,T,u,a,6);","for(const a of touched) stAdd(A,T,u,a,5);",'Rewrite the Pattern:'],
  ['the returned keep their Loose',FXJ,"const v=D[a.uid]||0; if(v>0) E.healUnit(a,v);","const v=0;",'Rewrite the Pattern:'],
  ['Quick Hands 11',FXJ,"{param:'rw.nrg',add:R(10)}","{param:'rw.nrg',add:R(11)}",'Rewrite the Pattern:'],
  ['Long Memory 4%',FXJ,"{param:'dr.memory',add:R(0.03)}","{param:'dr.memory',add:R(0.04)}",'Rewrite the Pattern:'],
  ['Long Memory 6 s',FXJ,"if(a.alive) m[a.uid]=now+4;","if(a.alive) m[a.uid]=now+6;",'Rewrite the Pattern:'],
  ['Cut Long reads the game\'s 5 s',FXJ,"else { const q=o.h7&&o.h7[a.uid]; if(q&&q.length) v=q[0]; }","else { }",'Rewrite the Pattern:'],
  ['Cut Short 2 s',FXJ,"if(L===3) v=H[Math.max(0,H.length-7)];","if(L===3) v=H[Math.max(0,H.length-5)];",'Rewrite the Pattern:'],
  ['the game\'s history not put back',FXJ,"for(const e of rw.hist) e[0]._hpHist=e[1];","",'Rewrite the Pattern:'],
  ['Cut Short 20% more energy',FXJ,"sh_5_3:[ {stat:{nrg:0.25}} ],","sh_5_3:[ {stat:{nrg:0.20}} ],",'Rewrite the Pattern:'],
  ['Golden Pattern 7 s',FXJ,"o.gpT=now+5; }","o.gpT=now+7; }",'Golden Pattern'],
  ['Golden Pattern: no Gilt',FXJ,"for(const a of touched) if(a!==u){ const e=g[a.uid]","for(const a of []) if(a!==u){ const e=g[a.uid]",'Golden Pattern'],
  ['The Last Rows 25%',FXJ,"{param:'rows',add:0.20}","{param:'rows',add:0.25}",'Last Rows'],
  ['Every Row Counted 3 points',FXJ,"{param:'rows',add:R(0.02)}","{param:'rows',add:R(0.03)}",'Last Rows'],
  ['Cut the Pattern: a boss 20%',FXJ,"if(isBoss(e)) v=Math.max(v,e.hp-0.10*e.maxHp);","if(isBoss(e)) v=Math.max(v,e.hp-0.20*e.maxHp);",'Last Rows'],
  ['Cut the Pattern: Frayed 7 s',FXJ,"frAdd(A,T,u,e,5,true,6);","frAdd(A,T,u,e,5,true,7);",'Last Rows'],
  ['Cut the Pattern keeps shields',FXJ,"e.shield=0; frAdd(A,T,u,e,5,true,6);","frAdd(A,T,u,e,5,true,6);",'Last Rows'],
  ['Not One Thread Loose 8 s',FXJ,"if(Pp.notl){ o.notlT=6;","if(Pp.notl){ o.notlT=8;",'Not One Thread Loose'],
  ['Not One Thread Loose twice an ally',FXJ,"if(U[x.uid]) return; U[x.uid]=1;\n      x.hp=1;","U[x.uid]=1;\n      x.hp=1;",'Not One Thread Loose'],
  ['Not One Thread Loose 2 Stitches a second',FXJ,"for(const x of team(A,T,u)) stAdd(A,T,u,x,1); } }","for(const x of team(A,T,u)) stAdd(A,T,u,x,2); } }",'Not One Thread Loose'],
  ['Not One Thread Loose half the Loose',FXJ,"if(o.notl&&o.notlT>0) return 1;","if(o.notl&&o.notlT>0) return 0.5;",'Not One Thread Loose'],
  // ---- Golden Thread ----
  ['Draw the Line 3%',FXJ,"k*=1+0.02*rk(T,'gl_2_3')+0.005*rk(T,'gl_12_2');","k*=1+0.03*rk(T,'gl_2_3')+0.005*rk(T,'gl_12_2');",'the thread.s share'],
  ['Breaking Strain 1%',FXJ,"{param:'taut.at',add:R(0.03)}","{param:'taut.at',add:R(0.01)}",'the thread.s share'],
  ['One Strong Thread 20%',FXJ,"if(r.gl_5_3) k*=1.15;","if(r.gl_5_3) k*=1.20;",'the thread.s share'],
  ['Nothing for Herself 7%',FXJ,"k*=(1+0.06*r.gl_6_4)","k*=(1+0.07*r.gl_6_4)",'the thread.s share'],
  ['Nothing for Herself keeps 8%',FXJ,"gl_6_4:[ {on:'healMe',less:R(0.05)} ],","gl_6_4:[ {on:'healMe',less:R(0.04)} ],",'the thread.s share'],
  ['Woven Strength 3%',FXJ,"if(r.gl_3_1&&full) k*=1+0.02*r.gl_3_1;","if(r.gl_3_1&&full) k*=1+0.03*r.gl_3_1;",'the thread.s share'],
  ['Two Threads 50%',FXJ,"if(T.r.gl_5_1){ v*=0.6;","if(T.r.gl_5_1){ v*=0.5;",'Two Threads'],
  ['Shared Weight 3%',FXJ,"{param:'dr.two',add:R(0.02)}","{param:'dr.two',add:R(0.03)}",'Two Threads'],
  ['Heavy Gold 4%',FXJ,"{param:'dr.heavy',add:R(0.03)}","{param:'dr.heavy',add:R(0.04)}",'Two Threads'],
  ['Seam on the Line lands anywhere',FXJ,"else if(T.P['seam.line']){ const x=thr(u); if(x) c.tgt=x; }","else if(false){ }",'Seam on the Line'],
  ['Seam on the Line: no 100%',FXJ,"if(T.r.gl_7_3&&x&&(o.seams","if(false&&x&&(o.seams",'Seam on the Line'],
  ['Seam Gold 4%',FXJ,"gl_9_3:[ {on:'kit',skill:SEAM,opt:{mul:{more:R(0.03)}}} ],","gl_9_3:[ {on:'kit',skill:SEAM,opt:{mul:{more:R(0.04)}}} ],",'Seam on the Line'],
  ['Spinning Wheel 0.5%',FXJ,"Math.max(0.004,0.004*rk(T,'gl_1_2'))","Math.max(0.004,0.005*rk(T,'gl_1_2'))",'Spindle'],
  ['Spun Gold 12%',FXJ,"{param:'spin.k',add:R(0.10)}","{param:'spin.k',add:R(0.12)}",'Spindle'],
  ['Golden Spin x1.5',FXJ,"if(o.spin&&r.gl_3_2) k*=2;","if(o.spin&&r.gl_3_2) k*=1.5;",'Spindle'],
  ['at full health nothing passes',FXJ,"if(over>1e-9&&u.pass&&u.pass.goldthread)","if(false&&over>1e-9&&u.pass&&u.pass.goldthread)",'Spindle'],
  ['the regeneration cap 2%',FXJ,"const REGEN=0.012;                         // the game's regeneration cap (Phil 4 Oct): Spindle","const REGEN=0.02;                         // the game's regeneration cap (Phil 4 Oct): Spindle",'Spindle'],
  ['Spinner\'s Calm above 50%',FXJ,"if(Pp.calm&&frac(u)>0.70)","if(Pp.calm&&frac(u)>0.50)",'Spindle'],
  ['Kind to Herself 3%',FXJ,"x*=1+0.02*rk(T,'gl_6_2');","x*=1+0.03*rk(T,'gl_6_2');",'Spindle'],
  ['Gilded 2%',FXJ,"{param:'gilt.heal',add:R(0.015)}","{param:'gilt.heal',add:R(0.02)}",'Gilt:'],
  ['Bright Gilt 3 s',FXJ,"gl_5_4:[ {param:'gilt.dur',add:R(2)} ],","gl_5_4:[ {param:'gilt.dur',add:R(3)} ],",'Gilt:'],
  ['Gold Lining 2%',FXJ,"{param:'dr.gilt',add:R(0.01)}","{param:'dr.gilt',add:R(0.02)}",'Gilt:'],
  ['Gilt Edge 3%',FXJ,"{param:'gilt.dmg',add:R(0.02)}","{param:'gilt.dmg',add:R(0.03)}",'Gilt:'],
  ['Gold Leaf 0.6%',FXJ,"gl_10_2:[ {stat:{heal:R(0.005)},per:{fn:'giltW'}} ],","gl_10_2:[ {stat:{heal:R(0.006)},per:{fn:'giltW'}} ],",'Gilt:'],
  ['Lasting Shine 3%',FXJ,"{param:'gilt.fade',add:R(0.02)}","{param:'gilt.fade',add:R(0.03)}",'Gilt:'],
  ['Hidden Lining up to 4',FXJ,"return Math.min(3,n); },","return Math.min(4,n); },",'Gilt:'],
  ['Sure Hands every time',FXJ,"if(!(now<(L[x.uid]||0))){ L[x.uid]=now+8; E.healUnit(x,u.maxHp*Pp.sure); }","if(true){ E.healUnit(x,u.maxHp*Pp.sure); }",'Gilt:'],
  ['Drawn Tight 4%',FXJ,"if(r.gl_8_1&&x===thr(u)&&taut(T,u)) k+=0.03*r.gl_8_1;","if(r.gl_8_1&&x===thr(u)&&taut(T,u)) k+=0.04*r.gl_8_1;",'Drawn Tight'],
  ['Snap Back 9%',FXJ,"{param:'snap',add:0.08}","{param:'snap',add:0.09}",'Drawn Tight'],
  ['Snap Back every time',FXJ,"o.sbX=null; o.sbL=now+5;","o.sbX=null; o.sbL=now;",'Drawn Tight'],
  ['Fast Wheel 5%',FXJ,"gl_2_2:[ {stat:{aspd:R(0.04)},if:{fn:'fw'}} ],","gl_2_2:[ {stat:{aspd:R(0.05)},if:{fn:'fw'}} ],",'Drawn Tight'],
  ['Fast Wheel above 30%',FXJ,"return !!x&&frac(x)>0.50; },","return !!x&&frac(x)>0.30; },",'Drawn Tight'],
  ['The Thread She Can See under 10%',FXJ,"x.hp<0.20*x.maxHp&&!(o.tssU","x.hp<0.10*x.maxHp&&!(o.tssU",'Thread She Can See'],
  ['The Thread She Can See 30%',FXJ,"E.healUnit(x,x.maxHp*0.25); o.tss=","E.healUnit(x,x.maxHp*0.30); o.tss=",'Thread She Can See'],
  ['The Thread She Can See x1.5',FXJ,"if(o.tss&&o.tss.x===x&&now<o.tss.until) k*=2;","if(o.tss&&o.tss.x===x&&now<o.tss.until) k*=1.5;",'Thread She Can See'],
  ['The Thread She Can See: Mending Stitch elsewhere',FXJ,"msTgt(A,T,u,c){ const o=S(T), now=A.eng().now(); if(o.tss","msTgt(A,T,u,c){ const o=S(T), now=A.eng().now(); if(false&&o.tss",'Thread She Can See'],
  ['The Thread She Can See twice',FXJ,"&&!(o.tssU&&o.tssU[x.uid])&&u.alive","&&u.alive",'Thread She Can See'],
  ['The Thread She Can See 5 s',FXJ,"o.tss={x,until:now+3};","o.tss={x,until:now+5};",'Thread She Can See'],
  ['The Thread She Can See: no pull',FXJ,"if(L>0){ x.pulledBy=","if(false){ x.pulledBy=",'Thread She Can See'],
  // ---- her damage reduction ----
  ['her cap 45%',FXJ,"DR_SELF=0.60","DR_SELF=0.55",'damage reduction, ONE'],
  ['Calm Weaver above 95%',FXJ,"if(Pp['dr.calm']&&frac(u)>0.70)","if(Pp['dr.calm']&&frac(u)>0.95)",'damage reduction, ONE'],
  ['Tough Linen 2%',FXJ,"{param:'dr.linen',add:R(0.01)}","{param:'dr.linen',add:R(0.02)}",'damage reduction, ONE'],
  ['Self-Mending on every hit',FXJ,"if(Pp['dr.mend']&&auto)","if(Pp['dr.mend'])",'damage reduction, ONE'],
  ['Stillness 3%',FXJ,"{param:'dr.still',add:R(0.02)}","{param:'dr.still',add:R(0.03)}",'damage reduction, ONE'],
  ['Dark Water on every hit',FXJ,"if(Pp['dr.magic']&&c&&c.kind==='magic')","if(Pp['dr.magic']&&c)",'damage reduction, ONE'],
  ['The Bank at 10%',FXJ,"a.hp<0.30*a.maxHp)) k*=1-Pp['dr.bank']","a.hp<0.10*a.maxHp)) k*=1-Pp['dr.bank']",'damage reduction, ONE'],
  ['Patient Fingers on any ally',FXJ,"if(L.length&&L.every(a=>stN(A,T,u,a)>0))","if(L.length&&L.some(a=>stN(A,T,u,a)>0))",'damage reduction, ONE'],
  // ---- Frayed ----
  ['Frayed up to 6',FXJ,"v=Math.min(5,set?Math.max(was,n):was+n)","v=Math.min(6,set?Math.max(was,n):was+n)",'Frayed'],
  ['Frayed 6 s',FXJ,"lnFr:{unit:true,max:5,dur:P('fr.dur',5)}","lnFr:{unit:true,max:5,dur:P('fr.dur',6)}",'Frayed'],
  ['Pulled Threads 2 s',FXJ,"{param:'fr.dur',add:R(1)}","{param:'fr.dur',add:R(2)}",'Frayed'],
  ['healing cut not per stack',FXJ,"c.amt*=Math.max(0,1-Pp['fr.cut']*n)","c.amt*=Math.max(0,1-Pp['fr.cut'])",'Frayed'],
  ['shield cut not per stack',FXJ,"x.shield=last+(sh-last)*Math.max(0,1-cut*n);","x.shield=last+(sh-last)*Math.max(0,1-cut);",'Frayed'],
  ['Cut Free 3 s',FXJ,"(o.nosh||(o.nosh={}))[t.uid]=A.eng().now()+2;","(o.nosh||(o.nosh={}))[t.uid]=A.eng().now()+3;",'Frayed'],
  ['Fraying Pattern every 2nd',FXJ,"o.n3%3===0","o.n3%2===0",'Frayed'],
  ['Catch 0.5%',FXJ,"sh_6_4:[ {stat:{aspd:R(-0.004)}","sh_6_4:[ {stat:{aspd:R(-0.005)}",'Frayed'],
  ['Quick Shears at 4',FXJ,"return frN(A,T,u,u.target)>=3; },","return frN(A,T,u,u.target)>=4; },",'Frayed'],
  ['Cut Back 45%',FXJ,"{param:'unravel',add:0.40}","{param:'unravel',add:0.45}",'Cut Back'],
  ['Cut Back cap 20%',FXJ,"Math.min(Pp.unravel*got,0.15*(e.maxHp||0))","Math.min(Pp.unravel*got,0.20*(e.maxHp||0))",'Cut Back'],
  ['Cut Back frays to 4',FXJ,"frAdd(A,T,u,e,5,true); } } },","frAdd(A,T,u,e,4,true); } } },",'Cut Back'],
  // ---- Unpicked ----
  ['Pick It Out 5%',FXJ,"{param:'up.k',add:R(0.04)}","{param:'up.k',add:R(0.05)}",'Unpicked'],
  ['Unpicked waits 2.5 s',FXJ,"Math.max(0.2,2+(T.P['up.wait']||0))","Math.max(0.2,2.5+(T.P['up.wait']||0))",'Unpicked'],
  ['Unpicked each 1 s',FXJ,"now>=w.s+6-1e-9","now>=w.s+1-1e-9",'Unpicked'],
  ['Hard Pattern 0.5 s',FXJ,"(o.upd[x.uid]||-1e9)>=now-4","(o.upd[x.uid]||-1e9)>=now-0.5",'Unpicked'],
  ['Unpicked Seam: only the biggest',FXJ,"if(T.P['up.seam']&&(o.seams","if(false&&(o.seams",'Unpicked'],
  ['Seam Unpicked 3%',FXJ,"{param:'up.seamk',add:R(0.02)}","{param:'up.seamk',add:R(0.03)}",'Unpicked'],
  // ---- her damage ----
  ['Steel Needle 3%',FXJ,"{param:'out.magic',add:R(0.02)}","{param:'out.magic',add:R(0.03)}",'her damage:'],
  ['Needle Point 4%',FXJ,"gl_7_1:[ {param:'out.auto',add:R(0.03)} ],","gl_7_1:[ {param:'out.auto',add:R(0.04)} ],",'her damage:'],
  ['Gilt Shears: shields not seen',FXJ,"t&&((t.shield||0)>0||","t&&(false||",'her damage:'],
  ['Loose Ends 2%',FXJ,"{param:'out.fr',add:R(0.01)}","{param:'out.fr',add:R(0.02)}",'her damage:'],
  ['Shearer on skills too',FXJ,"if(auto&&Pp['out.shear']) k+=Pp['out.shear'];","if(Pp['out.shear']) k+=Pp['out.shear'];",'her damage:'],
  ['Shears Bite Back heals 5% weaker',FXJ,"if(r.sh_6_1) k-=0.04*r.sh_6_1;","if(r.sh_6_1) k-=0.05*r.sh_6_1;",'her damage:'],
  // ---- the Bobbin ----
  ['the Bobbin up to 5',FXJ,"const bobMax=T=>4+","const bobMax=T=>5+",'Bobbin'],
  ['Wound Tight 2 a rank',FXJ,"{param:'bob.start',add:R(1)}","{param:'bob.start',add:R(2)}",'Bobbin'],
  ['Full Bobbin 1.2%',FXJ,"sh_5_1:[ {stat:{heal:R(0.01)},per:{fn:'bobN'}} ],","sh_5_1:[ {stat:{heal:R(0.012)},per:{fn:'bobN'}} ],",'Bobbin'],
  ['Thread Count 0.6%',FXJ,"{param:'bob.hp',add:R(0.005)}","{param:'bob.hp',add:R(0.006)}",'Bobbin'],
  ['Bobbin Burst 12%',FXJ,"k+=0.10*r.sh_10_1; }","k+=0.12*r.sh_10_1; }",'Bobbin'],
  ['Winding 4%',FXJ,"{param:'bob.rev',add:R(0.03)}","{param:'bob.rev',add:R(0.04)}",'Bobbin'],
  ['an ally\'s death does not wind',FXJ,"if(any(T,BOBBIN)&&(o.bob||0)<bobMax(T)){ o.bob=(o.bob||0)+1;","if(false){ o.bob=(o.bob||0)+1;",'Bobbin'],
  // ---- controls on her ----
  ['her control cap 25%',FXJ,"TEN=0.80;","TEN=0.75;",'controls on her'],
  ['Steady Hands 6%',FXJ,"ml_1_4:[ {param:'ten.self',add:R(0.05)} ],","ml_1_4:[ {param:'ten.self',add:R(0.06)} ],",'controls on her'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||(!SKIP.has(r.split(path.sep)[0])&&!/^\.ctl-/.test(r)); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-lnc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-linnet.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=(process.argv[2]||process.env.LNC_ONLY)?new RegExp(process.argv[2]||process.env.LNC_ONLY):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
