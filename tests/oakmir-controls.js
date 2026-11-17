'use strict';
/* The controls for Oakmir's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-oakmir.test.js). Each control copies this checkout to a temp folder (os.tmpdir(): the runner's own temp folder on disk), breaks ONE thing there
   (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: the page site removed, the guarded site given an unguarded seeded draw, a row
   or a number of his changed), runs the named tests of tests/talents-mech-oakmir.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel
   child processes); each copy is deleted when its run is done; .logs, .remote-logs and node_modules are never copied (node_modules is linked). The checkout
   itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   Run: node tests/oakmir-controls.js [name pattern]      node tests/oakmir-controls.js --check   (only: every text to break is found exactly once) */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', ID='no talents';
const KEEP="units.filter(u=>!u.alive&&u.team==='enemy'&&u.deathT>.9&&!u._talKeep).forEach(u=>{";
const C=[
  // ---- the page site: removed (his test fails), an unguarded seeded draw there (the no-talent identity test fails) ----
  ['_talKeep removed',HTML,KEEP,"units.filter(u=>!u.alive&&u.team==='enemy'&&u.deathT>.9).forEach(u=>{",'enemy side'],
  ['draw at the removal line',HTML,KEEP,"units.filter(u=>!u.alive&&u.team==='enemy'&&u.deathT>.9&&!u._talKeep&&brnd()<2).forEach(u=>{",ID],
  // ---- Sap ----
  ['Rising Sap 2%',FXJ,"0.10+0.01*rk(T,'hw_1_1')","0.10+0.02*rk(T,'hw_1_1')",'Sap:'],
  ['Sap Reserve 2.5%',FXJ,"{param:'sap.res',add:R(0.02)}","{param:'sap.res',add:R(0.025)}",'Sap:'],
  ['pour below 45%',FXJ,"if(p>=0.50&&f<0.50&&any(T,SAP)","if(p>=0.45&&f<0.45&&any(T,SAP)",'Sap:'],
  ['Sweet Sap 4%',FXJ,"{param:'pour.more',add:R(0.03)}","{param:'pour.more',add:R(0.04)}",'Sap:'],
  ['Still Wood 2%',FXJ,"hw_11_1:[ {param:'dr.sw',add:R(0.015)} ]","hw_11_1:[ {param:'dr.sw',add:R(0.02)} ]",'Sap:'],
  ['Ringed Trunk 5 s',FXJ,"if(r.hw_3_3) o.rtW=4;","if(r.hw_3_3) o.rtW=5;",'Sap:'],
  ['Sap Bloom never',FXJ,"if(P.sapBloom&&o.sap>0) T.fn.pour(A,T,u,x);","",'Sap Bloom'],
  ['First Green 4 s',FXJ,"o.fgW[x.uid]=3;","o.fgW[x.uid]=4;",'Sap Bloom'],
  ['First Green lock as an absolute time',FXJ,"if(r.ty_1_4&&o.sea&&!(o.lk.fg>0)){ o.lk.fg=12;","if(r.ty_1_4&&o.sea&&!(o.fgAt>A.eng().now())){ o.fgAt=A.eng().now()+12;",'Sap Bloom'],
  ['First Green no lock',FXJ,"if(r.ty_1_4&&o.sea&&!(o.lk.fg>0)){ o.lk.fg=12;","if(r.ty_1_4&&o.sea){ o.lk.fg=12;",'Sap Bloom'],
  ['Sap Spring 2%',FXJ,"{param:'sap.spring',add:R(0.01)}","{param:'sap.spring',add:R(0.02)}",'Sap Bloom'],
  ['Brimming on any ally',FXJ,"if(P.brim&&sapFull(T,u)&&x===A.eng().lowestAlly(u)) k+=P.brim;","if(P.brim&&sapFull(T,u)) k+=P.brim;",'Brimming'],
  ['Brimming without full Sap',FXJ,"if(P.brim&&sapFull(T,u)&&x===A.eng().lowestAlly(u)) k+=P.brim;","if(P.brim&&x===A.eng().lowestAlly(u)) k+=P.brim;",'Brimming'],
  ['Ever Green 3%',FXJ,"{param:'eg',add:R(0.02)}","{param:'eg',add:R(0.03)}",'Brimming'],
  ['Ever Green on the ungrafted',FXJ,"for(const y of team(A,T,u)) if(grafted(T,y)&&(!best||frac(y)<frac(best))) best=y;","for(const y of team(A,T,u)) if(y!==u&&(!best||frac(y)<frac(best))) best=y;",'Brimming'],
  // ---- Shade ----
  ['Shade 3.5 m',FXJ,"return (d?2:3)+0.5*rk(T,'hw_4_2')","return (d?2:3.5)+0.5*rk(T,'hw_4_2')",'Shade:'],
  ['Under the Boughs 1.2%',FXJ,"const shadeDr=T=>0.01*rk(T,'hw_2_2')","const shadeDr=T=>0.012*rk(T,'hw_2_2')",'Shade:'],
  ['Shade measured centre to centre',FXJ,"const inn=o.grove>0||(x!==u&&gapM(A,u,x)<R);","const inn=o.grove>0||(x!==u&&A.eng().dist(u,x)/A.eng().METER()<R);",'Shade:'],
  ['Forest Floor ignored',FXJ,"else if(was[x.uid]&&P['shade.ln']) o.ln[x.uid]=P['shade.ln'];","",'Shade:'],
  ['Canopy Song 2%',FXJ,"{param:'shade.heal',add:R(0.01)}","{param:'shade.heal',add:R(0.02)}",'Shade:'],
  ['Grove Rally 12%',FXJ,"if(r.hw_7_2) k+=0.10;","if(r.hw_7_2) k+=0.12;",'Shade:'],
  ['Grove Rally not doubled',FXJ,"if(!c.hot&&c.skill===RR&&T.r.hw_7_2) ov*=2;","",'Shade:'],
  ['Dense not doubled',FXJ,"*(rk(T,'hw_5_2')?2:1)","*(rk(T,'hw_5_2')?1:1)",'Dense'],
  ['Dense 2.5 m',FXJ,"return (d?2:3)+0.5*rk(T,'hw_4_2')","return (d?2.5:3)+0.5*rk(T,'hw_4_2')",'Dense'],
  ['Deep Shadow on basic attacks',FXJ,"if(P['dr.ds']&&T.r.hw_5_2&&s&&s._castSlot==='ult'&&!c.auto)","if(P['dr.ds']&&T.r.hw_5_2&&s&&s._castSlot==='ult')",'Dense'],
  ['Wide 2.5 m farther',FXJ,"+(w?2:0); }","+(w?2.5:0); }",'Dense'],
  ['Wide 0.6% a second',FXJ,"k+=0.005+(P['wide.k']||0);","k+=0.006+(P['wide.k']||0);",'Dense'],
  ['the regeneration cap dropped',FXJ,"if(k>0) E.healUnit(x,x.maxHp*Math.min(REGEN,k)); } } } },","if(k>0) E.healUnit(x,x.maxHp*k); } } } },",'full turn'],
  // ---- Graft ----
  ['he grafts himself',FXJ,"if(!x||x===u||!mate(u,x)||x._summon) return; o.gr[x.uid]=x;","if(!x||!mate(u,x)||x._summon) return; o.gr[x.uid]=x;",'Graft:'],
  ['Grafted Root 5%',FXJ,"{param:'graft.share',add:R(0.04)}","{param:'graft.share',add:R(0.05)}",'Graft:'],
  ['Shared Rings 2%',FXJ,"{stat:{hp:R(0.01)},to:{team:'ally',fn:'isGrafted'}}","{stat:{hp:R(0.02)},to:{team:'ally',fn:'isGrafted'}}",'Graft:'],
  ['Kept Close 2%',FXJ,"{param:'dr.kc',add:R(0.01)}","{param:'dr.kc',add:R(0.02)}",'Graft:'],
  ['Heavy Limbs up to 1',FXJ,"k*=1-P['dr.hl']*Math.min(4,n);","k*=1-P['dr.hl']*Math.min(1,n);",'Graft:'],
  ['Bound Bark at 20%',FXJ,"c.amt>0.15*t.maxHp","c.amt>0.20*t.maxHp",'Graft:'],
  ['Bound Bark 6 s',FXJ,"o.bbL[t.uid]=5;","o.bbL[t.uid]=6;",'Graft:'],
  ['Bound Bark lock as an absolute time',FXJ,"&&!((o.bbL[t.uid]||0)>0)){ o.bbL[t.uid]=5;","&&!(((o.bbA||{})[t.uid]||0)>A.eng().now())){ (o.bbA||(o.bbA={}))[t.uid]=A.eng().now()+5;",'no lock of his'],
  ['Shared Heartwood 2%',FXJ,"{param:'graft.more',add:R(0.015)}","{param:'graft.more',add:R(0.02)}",'Graft:'],
  // ---- Deep Roots ----
  ['Root Memory 6%',FXJ,"{param:'dr.heal',add:R(0.05)}","{param:'dr.heal',add:R(0.06)}",'Deep Roots:'],
  ['Slow Heart 0.6 s',FXJ,"{param:'dr.slow',add:R(0.5)}","{param:'dr.slow',add:R(0.6)}",'Deep Roots:'],
  ['Slow Heart total ignored',FXJ,"+(P['dr.heal']||0)+0.04*rk(T,'hw_12_4');","+(P['dr.heal']||0);",'Deep Roots:'],
  ['Grasping Ground 4 m',FXJ,"if(P.grasp) for(const e of foes(A,T,u)) if(gapM(A,x,e)<3)","if(P.grasp) for(const e of foes(A,T,u)) if(gapM(A,x,e)<4)",'Deep Roots:'],
  ['Root Grip 3.5 m',FXJ,"if(P.rgrip) for(const e of foes(A,T,u)) if(gapM(A,x,e)<2)","if(P.rgrip) for(const e of foes(A,T,u)) if(gapM(A,x,e)<3.5)",'Deep Roots:'],
  ['a root that lets it move',FXJ,"{stat:{move:-1},reqAny:ROOTS,to:{team:'enemy',fn:'isRooted'}}","{stat:{move:0},reqAny:ROOTS,to:{team:'enemy',fn:'isRooted'}}",'Deep Roots:|roots and'],
  // ---- his skills' heals ----
  ['Broad Leaves 4%',FXJ,"{param:'mb.more',add:R(0.03)}","{param:'mb.more',add:R(0.04)}","skills' heals"],
  ['Slow Mending without a part tick',FXJ,"h._talF=(f<1-1e-9)?f:null; break;","h._talF=null; break;","skills' heals"],
  ['Green Patience 0.2 s',FXJ,"hw_8_3:[ {on:'cd',skill:'green',add:R(-0.1)} ]","hw_8_3:[ {on:'cd',skill:'green',add:R(-0.2)} ]","skills' heals"],
  ['Leaf Mulch 2%',FXJ,"{param:'dr.lm',add:R(0.01)}","{param:'dr.lm',add:R(0.02)}","skills' heals"],
  ['Steady Boughs 3%',FXJ,"{param:'rr.more',add:R(0.02)}","{param:'rr.more',add:R(0.03)}","skills' heals"],
  ['Lingering Spring 4%',FXJ,"{param:'fs.more',add:R(0.03)}","{param:'fs.more',add:R(0.04)}","skills' heals"],
  // ---- Thick Bark and the caps ----
  ['Thick Bark every hit',FXJ,"if(P['dr.tb']&&o.tb!==T.s.wave){","if(P['dr.tb']){",'Thick Bark'],
  ['Thick Bark once a fight',FXJ,"if(P['dr.tb']&&o.tb!==T.s.wave){","if(P['dr.tb']&&o.tb<0){",'Thick Bark'],
  ['his group at 45%',FXJ,"const ME_CAP=0.60,","const ME_CAP=0.55,",'Thick Bark|capped groups'],
  ['the allies\' group at 30%',FXJ,"ALLY_CAP=0.75,","ALLY_CAP=0.70,",'capped groups'],
  // ---- The Grove Stands ----
  ['Grove without full Sap',FXJ,"o.fsGrove=!!(T.P['sig.grove']&&any(T,SAP)&&sapFull(T,u));","o.fsGrove=!!(T.P['sig.grove']);",'Grove Stands'],
  ['Grove 9 s',FXJ,"o.fsGrove=false; o.grove=8;","o.fsGrove=false; o.grove=9;",'Grove Stands'],
  ['Grove doubled',FXJ,"*(O(T).grove>0?3:1)","*(O(T).grove>0?2:1)",'Grove Stands'],
  ['Grove: Deep Roots not again',FXJ,"if(o.dr2[x.uid]){ delete o.dr2[x.uid]; x._drUsed=false; }","if(o.dr2[x.uid]){ delete o.dr2[x.uid]; }",'Grove Stands'],
  ['Grove: a catch already over not re-armed',FXJ,"if(x._drUsed&&x._drBy===u&&(o.drSeen[x.uid]||0)%2===0) x._drUsed=false; else o.dr2[x.uid]=1;","o.dr2[x.uid]=1;",'Grove Stands'],
  ['Grove: Deep Roots every time',FXJ,"if(o.dr2[x.uid]){ delete o.dr2[x.uid]; x._drUsed=false; }","if(o.dr2[x.uid]){ x._drUsed=false; }",'Grove Stands'],
  // ---- Thorns ----
  ['Briar Skin 9%',FXJ,"{param:'thorn',add:R(0.08)}","{param:'thorn',add:R(0.09)}",'Thorns:'],
  ['Thorns on skill hits',FXJ,"if(c.auto&&thorned(T,u,t)) T.fn.bite(A,T,u,t,s);","if(thorned(T,u,t)) T.fn.bite(A,T,u,t,s);",'Thorns:'],
  ['Long Thorns 1.5 s',FXJ,"{param:'thorn.ln',add:R(1)}","{param:'thorn.ln',add:R(1.5)}",'Thorns:'],
  ['Sharp Bark 4%',FXJ,"{param:'thorn.more',add:R(0.03)}","{param:'thorn.more',add:R(0.04)}",'Thorns:'],
  ['a bite gives no Heartrot',FXJ,"      T.fn.rot(A,T,u,s,1);\n      if(s.alive&&(P.bramble","      if(s.alive&&(P.bramble",'Thorns:'],
  ['Spearwood no cut',FXJ,"*(P.spear?0.7:1);","*(P.spear?1:1);",'Spearwood'],
  ['Bramblewood plants nothing',FXJ,"if(s.alive&&(P.bramble||(P.barkbound&&low)))","if(s.alive&&((P.barkbound&&low)))",'Spearwood'],
  ['Barbed Hedge at 1 Acorn',FXJ,"if(P.hedge&&P.bramble&&acorns(T,s)>=2)","if(P.hedge&&P.bramble&&acorns(T,s)>=1)",'Spearwood'],
  ['Bitter Spring 5%',FXJ,"{param:'bitter',add:R(0.04)}","{param:'bitter',add:R(0.05)}",'Spearwood'],
  ['Barkbound below 50%',FXJ,"const low=frac(x)<0.40;","const low=frac(x)<0.50;",'Spearwood'],
  ['Rally the Briars 4 s',FXJ,"{param:'rr.thorn',add:3}","{param:'rr.thorn',add:4}",'Rally the Briars'],
  ['Spring of Thorns 10 m',FXJ,"<6*M) T.fn.addAcorn(A,T,u,e,3);","<10*M) T.fn.addAcorn(A,T,u,e,3);",'Rally the Briars'],
  ['Spring of Thorns 6 s',FXJ,"t.sp=Math.max(t.sp,5);","t.sp=Math.max(t.sp,6);",'Rally the Briars'],
  // ---- Acorns ----
  ['4 Acorns sprout',FXJ,"a.n=Math.min(scattered?Math.max(a.n,2):3,a.n+n); a.t=6+(T.P['acorn.dur']||0); if(a.n>=3&&!scattered)","a.n=Math.min(scattered?Math.max(a.n,2):4,a.n+n); a.t=6+(T.P['acorn.dur']||0); if(a.n>=4&&!scattered)",'Acorns:'],
  ['Acorn Shot 16%',FXJ,"{param:'acorn',add:R(0.15)}","{param:'acorn',add:R(0.16)}",'Acorns:'],
  ['Deep Planting 0.3 s',FXJ,"{param:'acorn.root',add:R(0.2)}","{param:'acorn.root',add:R(0.3)}",'Acorns:'],
  ['Seed Store 1.5 s',FXJ,"{param:'acorn.dur',add:R(1)}","{param:'acorn.dur',add:R(1.5)}",'Acorns:'],
  ['Sprouting Energy 2',FXJ,"{param:'acorn.nrg',add:R(1)}","{param:'acorn.nrg',add:R(2)}",'Acorns:'],
  ['Hollow Trunk 9%',FXJ,"{param:'acorn.more',add:R(0.08)}","{param:'acorn.more',add:R(0.09)}",'Acorns:'],
  ['Hollow Trunk risk 4%',FXJ,"tw_6_4:[ {param:'risk',add:R(0.03)}","tw_6_4:[ {param:'risk',add:R(0.04)}",'Acorns:'],
  ['a scattered Acorn sprouts',FXJ,"a.n=Math.min(scattered?Math.max(a.n,2):3,a.n+n);","a.n=Math.min(3,a.n+n);",'Acorns:'],
  ['Split Shaft 5%',FXJ,"{param:'split',add:R(0.04)}","{param:'split',add:R(0.05)}",'Acorns:'],
  // ---- roots and the rooted ----
  ['Hard Rind not on the slowed',FXJ,"if(P['dr.hr']&&(rooted(T,s)||slowed(s)))","if(P['dr.hr']&&(rooted(T,s)))",'roots and'],
  ['Snarl 3%',FXJ,"{param:'snarl',add:R(0.02)}","{param:'snarl',add:R(0.03)}",'roots and'],
  ['Slow Fury 4%',FXJ,"tw_11_1:[ {param:'fury',add:R(0.03)} ]","tw_11_1:[ {param:'fury',add:R(0.04)} ]",'roots and'],
  ['Woodland Ward without Thorns',FXJ,"if(P['dr.ww']&&rooted(T,s)&&thorned(T,u,x))","if(P['dr.ww']&&rooted(T,s))",'roots and'],
  ['Oak Strength 3%',FXJ,"{param:'oak',add:R(0.02)}","{param:'oak',add:R(0.03)}",'roots and'],
  ['Briar Bloom 1 s',FXJ,"{param:'briar',add:0.8}","{param:'briar',add:1.0}",'roots and'],
  ['Briar Bloom 3.5 m',FXJ,"if(P.briar) for(const e of foes(A,T,u)) if(gapM(A,x,e)<2)","if(P.briar) for(const e of foes(A,T,u)) if(gapM(A,x,e)<3.5)",'roots and'],
  ['roots past 4 s',FXJ,"REGEN=0.012, ROOT_TOP=4.0;","REGEN=0.012, ROOT_TOP=10;",'roots and'],
  ['a root gives no Heartrot',FXJ,"o.rt[e.uid]=Math.max(o.rt[e.uid]||0,Math.min(ROOT_TOP,secs)); T.fn.rot(A,T,u,e,1);","o.rt[e.uid]=Math.max(o.rt[e.uid]||0,Math.min(ROOT_TOP,secs));",'Heartrot'],
  // ---- Heartrot ----
  ['Rotting Grip 2%',FXJ,"{param:'rot.heal',add:R(0.01)}","{param:'rot.heal',add:R(0.02)}",'Heartrot'],
  ['Heartrot max 6',FXJ,"h.n=fill?5:Math.min(5,h.n+n);","h.n=fill?5:Math.min(6,h.n+n);",'Heartrot'],
  ['Rotwood 0.5 s',FXJ,"{param:'rot.dur',add:R(0.4)}","{param:'rot.dur',add:R(0.5)}",'Heartrot'],
  ['Choking Rot at 4',FXJ,"rot5(A,T,u,c){ return rotN(T,c.tgt)>=5; }","rot5(A,T,u,c){ return rotN(T,c.tgt)>=4; }",'Heartrot'],
  ['Rot to the Core 2%',FXJ,"{stat:{armor:R(-0.01)},to:{team:'enemy',fn:'hasRot'},per:{fn:'rotCnt'}}","{stat:{armor:R(-0.02)},to:{team:'enemy',fn:'hasRot'},per:{fn:'rotCnt'}}",'Heartrot'],
  ['Wooden Heart 2%',FXJ,"{param:'dr.wh',add:R(0.01)}","{param:'dr.wh',add:R(0.02)}",'Heartrot'],
  // ---- The Wood Remembers ----
  ['Wood: 4 s lock',FXJ,"o.wr[s.uid]=3;","o.wr[s.uid]=4;",'Wood Remembers'],
  ['Wood: no sprout',FXJ,"T.fn.root(A,T,u,s,0.6); T.fn.sprout(A,T,u,s);","T.fn.root(A,T,u,s,0.6);",'Wood Remembers'],
  ['Wood: 9 s',FXJ,"if(P['sig.wood']) o.wood=8;","if(P['sig.wood']) o.wood=9;",'Wood Remembers'],
  ['Wood: Heartrot not filled',FXJ,"T.fn.rot(A,T,u,s,0,true); },","T.fn.rot(A,T,u,s,0,false); },",'Wood Remembers'],
  // ---- his hits ----
  ['Heavy Spear 5%',FXJ,"{param:'auto.more',add:R(0.04)}","{param:'auto.more',add:R(0.05)}",'his hits'],
  ['Angry Sap on every kind',FXJ,"if(P['magic.more']&&c.kind==='magic') k*=1+P['magic.more'];","if(P['magic.more']) k*=1+P['magic.more'];",'his hits'],
  ['Woodsman\'s Reach 4%',FXJ,"u.range=(u.range||0)*(1+0.03*rk(T,'tw_2_4'));","u.range=(u.range||0)*(1+0.04*rk(T,'tw_2_4'));",'his hits'],
  ['Unbending 2%',FXJ,"{param:'dr.ub',add:R(0.01)}","{param:'dr.ub',add:R(0.02)}",'his hits'],
  ['Weathered 2%',FXJ,"{param:'dr.wea',add:R(0.01)}","{param:'dr.wea',add:R(0.02)}",'his hits'],
  // ---- the Seasons ----
  ['a season 6.5 s',FXJ,"let d=6+0.5*rk(T,'ty_2_4');","let d=6.5+0.5*rk(T,'ty_2_4');",'Turn of Seasons'],
  ['Spring 2%',FXJ,"const springK=T=>seaOn(T,0)?0.01*rk(T,'ty_1_4')","const springK=T=>seaOn(T,0)?0.02*rk(T,'ty_1_4')",'Turn of Seasons'],
  ['Summer 2%',FXJ,"const summerK=T=>seaOn(T,1)?0.01*rk(T,'ty_1_4')","const summerK=T=>seaOn(T,1)?0.02*rk(T,'ty_1_4')",'Turn of Seasons'],
  ['Autumn 2%',FXJ,"const autumnK=T=>seaOn(T,2)?0.01*rk(T,'ty_1_4')","const autumnK=T=>seaOn(T,2)?0.02*rk(T,'ty_1_4')",'Turn of Seasons'],
  ['Winter 2%',FXJ,"const winterK=T=>seaOn(T,3)?0.01*rk(T,'ty_1_4')","const winterK=T=>seaOn(T,3)?0.02*rk(T,'ty_1_4')",'Turn of Seasons'],
  ['Harvest Swing 5%',FXJ,"{param:'harvest',add:R(0.04)}","{param:'harvest',add:R(0.05)}",'Turn of Seasons'],
  ['Winter Hardiness 3%',FXJ,"{param:'dr.wint',add:R(0.02)}","{param:'dr.wint',add:R(0.03)}",'Turn of Seasons'],
  ['a full turn not counted',FXJ,"o.sea.turns++;","",'Turn of Seasons|full turn'],
  ['Deciduous not longer',FXJ,"if(decid(T)&&(i===2||i===3)) d*=2;","",'Deciduous'],
  ['Deciduous 60% more',FXJ,"const autumnK=T=>seaOn(T,2)?0.01*rk(T,'ty_1_4')*(decid(T)?1.5:1)","const autumnK=T=>seaOn(T,2)?0.01*rk(T,'ty_1_4')*(decid(T)?1.6:1)",'Deciduous'],
  ['Evergreen keeps Autumn',FXJ,"if(everg(T)&&i>1) i=4;","",'Deciduous'],
  ['Falling Leaves 4%',FXJ,"{param:'leaves',add:R(0.03)}","{param:'leaves',add:R(0.04)}",'Deciduous'],
  ['Early Turn never',FXJ,"if(r.ty_3_4&&o.sea&&!(o.allS>0)) T.fn.turn(A,T,u);","",'Deciduous'],
  ['Green All Year stronger',FXJ,"if(everg(T)) k+=(P['mb.green']||0);","if(everg(T)) k+=(P['mb.green']||0)*1.5;",'Deciduous'],
  ['Early Spring 2%',FXJ,"*(1+0.01*rk(T,'ty_8_4'))","*(1+0.02*rk(T,'ty_8_4'))",'Deciduous'],
  ['Long Year up to 6',FXJ,"Math.min(5,o.sea.turns)","Math.min(6,o.sea.turns)",'full turn'],
  ['Old as the Road 2%',FXJ,"{param:'road',add:R(0.015)}","{param:'road',add:R(0.02)}",'full turn'],
  ['Ring Count 2',FXJ,"{param:'ring',add:R(1)}","{param:'ring',add:R(2)}",'full turn'],
  ['Equinox every time',FXJ,"&&o.eq!==T.s.wave&&o.sea){","&&o.sea){",'full turn'],
  ['Equinox 4 s',FXJ,"o.eq=T.s.wave; T.fn.toSpring(A,T,u,3);","o.eq=T.s.wave; T.fn.toSpring(A,T,u,4);",'full turn'],
  ['Hibernate 0.2%',FXJ,"{param:'hib',add:R(0.004)}","{param:'hib',add:R(0.002)}",'full turn'],
  ['Deep Heartwood 2%',FXJ,"{stat:{armor:R(0.01),mr:R(0.01)},to:{team:'ally'},if:{fn:'winter'}}","{stat:{armor:R(0.02),mr:R(0.01)},to:{team:'ally'},if:{fn:'winter'}}",'full turn'],
  // ---- Rally of the Year, First Thaw ----
  ['Rally of the Year 35%',FXJ,"k+=0.30*(1+(P['rr.show']||0));","k+=0.35*(1+(P['rr.show']||0));",'Rally of the Year'],
  ['Rally of the Year shield 5%',FXJ,"x.shield=Math.max(x.shield||0,0.04*x.maxHp);","x.shield=Math.max(x.shield||0,0.05*x.maxHp);",'Rally of the Year'],
  ['First Thaw wakes nobody',FXJ,"for(const x of L) if(x.alive){ for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((x[f]||0)>0) x[f]=0; } }","}",'Rally of the Year'],
  ['First Thaw does not hold Spring',FXJ,"T.fn.toSpring(A,T,u,0); o.sea.t=Math.max(o.sea.t,5);","T.fn.toSpring(A,T,u,0);",'Rally of the Year'],
  ['Spring Eternal 4%',FXJ,"{param:'fs.spring',add:R(0.03)}","{param:'fs.spring',add:R(0.04)}",'Rally of the Year'],
  // ---- Nests ----
  ['Songbird Nests 9%',FXJ,"{param:'nest',add:R(0.10)}","{param:'nest',add:R(0.09)}",'Nests'],
  ['Wider Branches 2',FXJ,"const n=3+rk(T,'ty_4_3');","const n=3+2*rk(T,'ty_4_3');",'Nests'],
  ['Homing Birds 1 s',FXJ,"{param:'nest.re',add:R(0.8)}","{param:'nest.re',add:R(1.0)}",'Nests'],
  ['Birdsong 2%',FXJ,"{param:'bird.heal',add:R(0.01)}","{param:'bird.heal',add:R(0.02)}",'Nests'],
  ['Dawn Chorus 2',FXJ,"{param:'bird.nrg',add:R(1)}","{param:'bird.nrg',add:R(2)}",'Nests'],
  ['a sleep not woken',FXJ,"for(const k in o.zz){ const x=o.zz[k]; if((x._sleepT||0)>(x.stunned||0)) x._sleepT=x.stunned||0; delete o.zz[k]; }","",'Nests'],
  // ---- Second Growth ----
  ['Second Growth 11 s',FXJ,"o.sg.wait=Math.max(0,10-rk(T,'ty_4_1')","o.sg.wait=Math.max(0,11-rk(T,'ty_4_1')",'Second Growth:'],
  ['Stubborn Growth 4%',FXJ,"{param:'sg.hp',add:R(0.03)}","{param:'sg.hp',add:R(0.04)}",'Second Growth:'],
  ['no step to the left',FXJ,"u.x=(o.sg.x!=null?o.sg.x:u.x)-1*M;","u.x=(o.sg.x!=null?o.sg.x:u.x)-0*M;",'Second Growth:'],
  ['Rooted Again 6%',FXJ,"{param:'sg.team',add:R(0.05)}","{param:'sg.team',add:R(0.06)}",'Second Growth:'],
  ['Waking Roots 8 m',FXJ,"if(P['sg.root']) for(const e of foes(A,T,u)) if(gapM(A,u,e)<4)","if(P['sg.root']) for(const e of foes(A,T,u)) if(gapM(A,u,e)<8)",'Second Growth:'],
  ['Second Life 3%',FXJ,"ty_7_1:[ {stat:{heal:R(0.02)},if:{fn:'regrown'}} ]","ty_7_1:[ {stat:{heal:R(0.03)},if:{fn:'regrown'}} ]",'Second Growth:'],
  ['Fallen Seed past the cap',FXJ,"if(lo) E.healUnit(lo,lo.maxHp*Math.min(REGEN,P['sg.seed']));","if(lo) E.healUnit(lo,lo.maxHp*P['sg.seed']);",'Second Growth:'],
  ['Second Growth every time',FXJ,"if(!o||o.sg.used) return; o.sg.used=true;","if(!o) return; o.sg.used=true;",'Second Growth:'],
  ['his body not kept',FXJ,"T.s.ghost=true; u._talKeep=1; },","T.s.ghost=true; },",'enemy side'],
  ['Spring That Woke: no second regrowth',FXJ,"if(r.ty_4_1&&o.sg.regrown&&!o.sg.re){ o.sg.re=1; o.sg.used=false; }","",'Spring That Woke'],
  ['Spring That Woke: regrowth every time',FXJ,"if(r.ty_4_1&&o.sg.regrown&&!o.sg.re){","if(r.ty_4_1&&o.sg.regrown){",'Spring That Woke'],
  ['Spring That Woke 9 s',FXJ,"if(P['sig.year']){ o.allS=8;","if(P['sig.year']){ o.allS=9;",'Spring That Woke'],
  ['Spring That Woke: Nests not refilled',FXJ,"if(o.ne) for(let i=0;i<o.ne.length;i++) o.ne[i]=0;","",'Spring That Woke'],
  ['Spring That Woke: the year keeps turning',FXJ,"if(o.allS>0) o.allS=Math.max(0,o.allS-dt); else {","if(o.allS>0) o.allS=Math.max(0,o.allS-dt); {",'Spring That Woke'],
  // ---- the rest ----
  ['Frost-Hard 6%',FXJ,"ty_1_1:[ {on:'ccIn',less:R(0.05)} ]","ty_1_1:[ {on:'ccIn',less:R(0.06)} ]",'Frost-Hard'],
  ['Acorns kept across waves',FXJ,"o.th={}; o.ac={};","o.th={};",'no lock of his'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); if(!r) return true; const top=r.split(path.sep)[0]; return !SKIP.has(top)&&!/^\.(ctl|test|remote)-/.test(top); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function count(file,from){ const s=fs.readFileSync(path.join(root,file),'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'); return s.split(a).length-1; }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-okc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat.split('|').map(esc).join('|'),'tests/talents-mech-oakmir.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.argv[2]==='--check'){ let bad=0; for(const c of C){ const n=count(c[1],c[2]); if(n!==1){ bad++; console.log('FOUND '+n+' TIMES: '+c[0]); } } console.log(C.length+' controls, '+bad+' with a text not found exactly once'); process.exit(bad?1:0); }
const only=(process.argv[2]||process.env.OAKMIR_CTL)?new RegExp(process.argv[2]||process.env.OAKMIR_CTL):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
