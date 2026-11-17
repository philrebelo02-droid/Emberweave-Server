'use strict';
/* The controls for Pellucid's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-pellucid.test.js). Each control copies this checkout to a temp folder under os.tmpdir(), breaks ONE thing there (an exact text swap in
   emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a primitive or a row of his
   broken), runs the named tests of tests/talents-mech-pellucid.test.js in that copy, and expects them to FAIL. ONE copy at a time; each copy is deleted when
   its run is done (node_modules and assets are symlinked, .logs never copied). The checkout itself is never changed.
   Prints one line per control and a count; exits 1 if any control was not caught.  Run: node tests/pellucid-controls.js [name filter] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
[
"unmoved removed: kick",
"HTML",
"if(tg&&tg._tal&&tg._tal.on.unmoved&&tg.immovable) TalentFx.unmoved(tg,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tg.immovable&&!(tg.pass&&(tg.pass.un",
"if(!tg.immovable&&!(tg.pass&&(tg.pass.un",
"page sites"
],
[
"draw at unmoved: kick",
"HTML",
"if(tg&&tg._tal&&tg._tal.on.unmoved&&tg.immovable) TalentFx.unmoved(tg,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tg.immovable&&!(tg.pass&&(tg.pass.un",
"brnd();if(tg&&tg._tal&&tg._tal.on.unmoved&&tg.immovable) TalentFx.unmoved(tg,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tg.immovable&&!(tg.pass&&(tg.pass.un",
"no talents"
],
[
"unmoved removed: nova push",
"HTML",
"if(o.push&&e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(o.push&&!e.immovable&&!(e.pass&&(e.pa",
"if(o.push&&!e.immovable&&!(e.pass&&(e.pa",
"page sites"
],
[
"draw at unmoved: nova push",
"HTML",
"if(o.push&&e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(o.push&&!e.immovable&&!(e.pass&&(e.pa",
"brnd();if(o.push&&e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(o.push&&!e.immovable&&!(e.pass&&(e.pa",
"no talents"
],
[
"unmoved removed: tidalsurge",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0",
"if(!e.immovable&&!((e._gearImmovableT||0",
"page sites"
],
[
"draw at unmoved: tidalsurge",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0",
"brnd();if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0",
"no talents"
],
[
"unmoved removed: charge knock-aside",
"HTML",
"if(o.knockAside&&e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'charge'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(o.knockAside&&!e.immovable&&!(e.pass&",
"if(o.knockAside&&!e.immovable&&!(e.pass&",
"page sites"
],
[
"draw at unmoved: charge knock-aside",
"HTML",
"if(o.knockAside&&e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'charge'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(o.knockAside&&!e.immovable&&!(e.pass&",
"brnd();if(o.knockAside&&e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'charge'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(o.knockAside&&!e.immovable&&!(e.pass&",
"no talents"
],
[
"unmoved removed: knockstun",
"HTML",
"if(tgt&&tgt._tal&&tgt._tal.on.unmoved&&tgt.immovable) TalentFx.unmoved(tgt,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tgt.immovable&&!(tgt.pass&&(tgt.pass",
"if(!tgt.immovable&&!(tgt.pass&&(tgt.pass",
"page sites"
],
[
"draw at unmoved: knockstun",
"HTML",
"if(tgt&&tgt._tal&&tgt._tal.on.unmoved&&tgt.immovable) TalentFx.unmoved(tgt,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tgt.immovable&&!(tgt.pass&&(tgt.pass",
"brnd();if(tgt&&tgt._tal&&tgt._tal.on.unmoved&&tgt.immovable) TalentFx.unmoved(tgt,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tgt.immovable&&!(tgt.pass&&(tgt.pass",
"no talents"
],
[
"unmoved removed: gravknot",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){   /* v1",
"if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){   /* v1",
"page sites"
],
[
"draw at unmoved: gravknot",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){   /* v1",
"brnd();if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){   /* v1",
"no talents"
],
[
"unmoved removed: chainquench",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){   /* v9",
"if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){   /* v9",
"page sites"
],
[
"draw at unmoved: chainquench",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){   /* v9",
"brnd();if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){   /* v9",
"no talents"
],
[
"unmoved removed: grapple",
"HTML",
"if(tgt&&tgt._tal&&tgt._tal.on.unmoved&&tgt.immovable) TalentFx.unmoved(tgt,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tgt.immovable&&!(tgt.pass&&(tgt.pass",
"if(!tgt.immovable&&!(tgt.pass&&(tgt.pass",
"page sites"
],
[
"draw at unmoved: grapple",
"HTML",
"if(tgt&&tgt._tal&&tgt._tal.on.unmoved&&tgt.immovable) TalentFx.unmoved(tgt,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tgt.immovable&&!(tgt.pass&&(tgt.pass",
"brnd();if(tgt&&tgt._tal&&tgt._tal.on.unmoved&&tgt.immovable) TalentFx.unmoved(tgt,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tgt.immovable&&!(tgt.pass&&(tgt.pass",
"no talents"
],
[
"unmoved removed: pullsilence",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0)>0)){ e.pulledBy=u;",
"if(!e.immovable&&!((e._gearImmovableT||0)>0)){ e.pulledBy=u;",
"page sites"
],
[
"draw at unmoved: pullsilence",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0)>0)){ e.pulledBy=u;",
"brnd();if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0)>0)){ e.pulledBy=u;",
"no talents"
],
[
"unmoved removed: eventhorizon",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0)>0)){ e.pulledBy={x:cx,y",
"if(!e.immovable&&!((e._gearImmovableT||0)>0)){ e.pulledBy={x:cx,y",
"page sites"
],
[
"draw at unmoved: eventhorizon",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0)>0)){ e.pulledBy={x:cx,y",
"brnd();if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0)>0)){ e.pulledBy={x:cx,y",
"no talents"
],
[
"unmoved removed: gravcrush",
"HTML",
"if(dist(ctr,e)<R){ if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0",
"if(!e.immovable&&!((e._gearImmovableT||0",
"page sites"
],
[
"draw at unmoved: gravcrush",
"HTML",
"if(dist(ctr,e)<R){ if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0",
"brnd();if(dist(ctr,e)<R){ if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!((e._gearImmovableT||0",
"no talents"
],
[
"unmoved removed: gravsling",
"HTML",
"if(anvil){ if(proj&&proj._tal&&proj._tal.on.unmoved&&proj.immovable) TalentFx.unmoved(proj,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!proj.immovable&&!((proj._gearImmovab",
"if(!proj.immovable&&!((proj._gearImmovab",
"page sites"
],
[
"draw at unmoved: gravsling",
"HTML",
"if(anvil){ if(proj&&proj._tal&&proj._tal.on.unmoved&&proj.immovable) TalentFx.unmoved(proj,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!proj.immovable&&!((proj._gearImmovab",
"brnd();if(anvil){ if(proj&&proj._tal&&proj._tal.on.unmoved&&proj.immovable) TalentFx.unmoved(proj,u,'push'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!proj.immovable&&!((proj._gearImmovab",
"no talents"
],
[
"unmoved removed: tendrilpull nearest",
"HTML",
"if(near&&near._tal&&near._tal.on.unmoved&&near.immovable) TalentFx.unmoved(near,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!near.immovable&&!((near._gearImmovab",
"if(!near.immovable&&!((near._gearImmovab",
"page sites"
],
[
"draw at unmoved: tendrilpull nearest",
"HTML",
"if(near&&near._tal&&near._tal.on.unmoved&&near.immovable) TalentFx.unmoved(near,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!near.immovable&&!((near._gearImmovab",
"brnd();if(near&&near._tal&&near._tal.on.unmoved&&near.immovable) TalentFx.unmoved(near,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!near.immovable&&!((near._gearImmovab",
"no talents"
],
[
"unmoved removed: tendrilpull pull",
"HTML",
"if(tg2&&tg2._tal&&tg2._tal.on.unmoved&&tg2.immovable) TalentFx.unmoved(tg2,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tg2.immovable&&!((tg2._gearImmovable",
"if(!tg2.immovable&&!((tg2._gearImmovable",
"page sites"
],
[
"draw at unmoved: tendrilpull pull",
"HTML",
"if(tg2&&tg2._tal&&tg2._tal.on.unmoved&&tg2.immovable) TalentFx.unmoved(tg2,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tg2.immovable&&!((tg2._gearImmovable",
"brnd();if(tg2&&tg2._tal&&tg2._tal.on.unmoved&&tg2.immovable) TalentFx.unmoved(tg2,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!tg2.immovable&&!((tg2._gearImmovable",
"no talents"
],
[
"unmoved removed: rivet hook",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){\n      const dx=e.x-u.x, dy=e.y-u.y, L=Math.hypot(dx,dy)||1, to=Math.min(L,bodyR(",
"if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){\n      const dx=e.x-u.x, dy=e.y-u.y, L=Math.hypot(dx,dy)||1, to=Math.min(L,bodyR(",
"page sites"
],
[
"draw at unmoved: rivet hook",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){\n      const dx=e.x-u.x, dy=e.y-u.y, L=Math.hypot(dx,dy)||1, to=Math.min(L,bodyR(",
"brnd();if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'pull'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)){\n      const dx=e.x-u.x, dy=e.y-u.y, L=Math.hypot(dx,dy)||1, to=Math.min(L,bodyR(",
"no talents"
],
[
"unmoved removed: knock4",
"HTML",
"if(t&&t._tal&&t._tal.on.unmoved&&t.immovable) TalentFx.unmoved(t,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ const moves=!t.immovable&&!(t.pass&&(t.p",
"const moves=!t.immovable&&!(t.pass&&(t.p",
"page sites"
],
[
"draw at unmoved: knock4",
"HTML",
"if(t&&t._tal&&t._tal.on.unmoved&&t.immovable) TalentFx.unmoved(t,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ const moves=!t.immovable&&!(t.pass&&(t.p",
"brnd();if(t&&t._tal&&t._tal.on.unmoved&&t.immovable) TalentFx.unmoved(t,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ const moves=!t.immovable&&!(t.pass&&(t.p",
"no talents"
],
[
"unmoved removed: stampede",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'charge'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unste",
"if(!e.immovable&&!(e.pass&&(e.pass.unste",
"page sites"
],
[
"draw at unmoved: stampede",
"HTML",
"if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'charge'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unste",
"brnd();if(e&&e._tal&&e._tal.on.unmoved&&e.immovable) TalentFx.unmoved(e,u,'charge'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(!e.immovable&&!(e.pass&&(e.pass.unste",
"no talents"
],
[
"unmoved removed: gear knock",
"HTML",
"if(p.knock&&t&&t._tal&&t._tal.on.unmoved&&t.immovable) TalentFx.unmoved(t,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(p.knock&&!t.immovable&&!((t._gearImmo",
"if(p.knock&&!t.immovable&&!((t._gearImmo",
"page sites"
],
[
"draw at unmoved: gear knock",
"HTML",
"if(p.knock&&t&&t._tal&&t._tal.on.unmoved&&t.immovable) TalentFx.unmoved(t,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(p.knock&&!t.immovable&&!((t._gearImmo",
"brnd();if(p.knock&&t&&t._tal&&t._tal.on.unmoved&&t.immovable) TalentFx.unmoved(t,u,'knock'); /* TALENT HOOK unmoved: a displacement his immovability refuses (Pellucid's Unmoved) */ if(p.knock&&!t.immovable&&!((t._gearImmo",
"no talents"
],
[
"slam pass removed",
"HTML",
"if(u._tal&&u._tal.on.pass) TalentFx.pass(u,u,'wbSlam'+_k);",
"",
"page sites|Castling"
],
[
"shockwave landPre removed",
"HTML",
"if(u._tal) TalentFx.landPre(u,e,'wb'+_k);",
"",
"page sites|Tremor"
],
[
"draw at the slam",
"HTML",
"if(u._tal&&u._tal.on.pass) TalentFx.pass(u,u,'wbSlam'+_k);",
"brnd();if(u._tal&&u._tal.on.pass) TalentFx.pass(u,u,'wbSlam'+_k);",
"no talents"
],
[
"draw at the shockwave hit",
"HTML",
"if(u._tal) TalentFx.landPre(u,e,'wb'+_k);",
"brnd();if(u._tal) TalentFx.landPre(u,e,'wb'+_k);",
"no talents"
],
[
"engine unmoved runs no rows",
"FXJ",
"if(T.on.unmoved) run(T,t,'unmoved',{u:t,tgt:t,unit:t,src:by||null,kind}); }",
"}",
"page sites|Unmoved"
],
[
"Craze threshold 6%",
"FXJ",
"const thr=Math.max(0.02,0.05-(T.P.thr||0));",
"const thr=Math.max(0.02,0.06-(T.P.thr||0));",
"Craze"
],
[
"Craze breaks at 6",
"FXJ",
"if(k>=5) T.fn.brk(A,T,u); },",
"if(k>=6) T.fn.brk(A,T,u); },",
"Craze|crust breaking"
],
[
"leak 3 m",
"FXJ",
"for(const x of nearFoes(A,u,u,2)) A.hurt(T,u,x,d,'#ff9a4a','peLeak');",
"for(const x of nearFoes(A,u,u,7)) A.hurt(T,u,x,d,'#ff9a4a','peLeak');",
"Craze"
],
[
"leak not per Craze",
"FXJ",
"const n=A.stGet(T,'peCraze'), d=P.leak*n*atkOf(A,T,u);",
"const n=A.stGet(T,'peCraze'), d=P.leak*atkOf(A,T,u);",
"Craze"
],
[
"Spider Lines 0.9%",
"FXJ",
"gc_2_1:[ {param:'thr',add:R(0.01)} ],",
"gc_2_1:[ {param:'thr',add:R(0.009)} ],",
"Craze"
],
[
"Kiln 1 a rank",
"FXJ",
"gc_6_4:[ {param:'kiln',add:R(2)} ],",
"gc_6_4:[ {param:'kiln',add:R(1)} ],",
"Craze"
],
[
"Flow 4.5 s",
"FXJ",
"T.fn.flowOn(A,T,u,4+(P['flow.dur']||0),false);",
"T.fn.flowOn(A,T,u,4.5+(P['flow.dur']||0),false);",
"the Flow"
],
[
"Hot Run 0.6",
"FXJ",
"gc_2_2:[ {param:'flow.dur',add:R(0.5)} ],",
"gc_2_2:[ {param:'flow.dur',add:R(0.6)} ],",
"the Flow"
],
[
"Flow burn 5%",
"FXJ",
"flowK(A,T){ return 0.04*rk1(T,'gc_1_2'); },",
"flowK(A,T){ return 0.05*rk1(T,'gc_1_2'); },",
"the Flow|Glassblower"
],
[
"Flow burn without a minimum",
"FXJ",
"flowK(A,T){ return 0.04*rk1(T,'gc_1_2'); },",
"flowK(A,T){ return 0.04*rk(T,'gc_1_2'); },",
"the Flow|Glassblower"
],
[
"Flow burn on any hit",
"FXJ",
"if(!(c.auto||cur===MK||cur===CL||(T.P.rof&&WB.indexOf(cur)>=0))) return;",
"",
"the Flow"
],
[
"River of Fire always",
"FXJ",
"(T.P.rof&&WB.indexOf(cur)>=0)",
"(WB.indexOf(cur)>=0)",
"the Flow"
],
[
"Ember Glow 0.4",
"FXJ",
"gc_10_2:[ {param:'burn.dur',add:R(0.3)} ],",
"gc_10_2:[ {param:'burn.dur',add:R(0.4)} ],",
"the Flow"
],
[
"Patient Fire not counted",
"FXJ",
"A.stSet(T,u,'peFlows',A.stGet(T,'peFlows')+1); },",
"},",
"the Flow"
],
[
"Lava Fist 6%",
"FXJ",
"gc_4_2:[ {on:'out',if:{casting:MK,window:'peFlow',targetTeam:'enemy'},more:R(0.05)} ],",
"gc_4_2:[ {on:'out',if:{casting:MK,window:'peFlow',targetTeam:'enemy'},more:R(0.06)} ],",
"during the Flow"
],
[
"Clear Strike 3%",
"FXJ",
"gc_7_3:[ {on:'out',if:{window:'peFlow',targetTeam:'enemy'},critMore:R(0.02)} ],",
"gc_7_3:[ {on:'out',if:{window:'peFlow',targetTeam:'enemy'},critMore:R(0.03)} ],",
"during the Flow"
],
[
"Old Lava 4%",
"FXJ",
"gc_12_1:[ {stat:{aspd:[1/0.97-1,1/0.94-1,1/0.91-1]}",
"gc_12_1:[ {stat:{aspd:[1/0.96-1,1/0.92-1,1/0.88-1]}",
"during the Flow"
],
[
"Lava Tide cap 1.5%",
"FXJ",
"E.healUnit(u,Math.min(0.012,P.tide)*u.maxHp); } } else o.tdA=0;",
"E.healUnit(u,Math.min(0.015,P.tide*1.25)*u.maxHp); } } else o.tdA=0;",
"during the Flow"
],
[
"What Lies Beneath 2%",
"FXJ",
"gc_12_2:[ {param:'dr.wlb',add:R(0.015)} ],",
"gc_12_2:[ {param:'dr.wlb',add:R(0.02)} ],",
"during the Flow"
],
[
"Reglaze 1.2%",
"FXJ",
"u.maxHp*(0.01*rk1(T,'gc_1_4')",
"u.maxHp*(0.012*rk1(T,'gc_1_4')",
"Reglaze|Castling"
],
[
"Reglaze without its minimum",
"FXJ",
"u.maxHp*(0.01*rk1(T,'gc_1_4')+0.01*rk(T,'gc_9_4'))",
"u.maxHp*(0.01*rk(T,'gc_1_4')+0.01*rk(T,'gc_9_4'))",
"Reglaze"
],
[
"Second Skin 1.2%",
"FXJ",
"u.maxHp*(0.01*rk1(T,'gc_1_4')+0.01*rk(T,'gc_9_4'))",
"u.maxHp*(0.01*rk1(T,'gc_1_4')+0.012*rk(T,'gc_9_4'))",
"Reglaze"
],
[
"Thick Glaze 1.2 s",
"FXJ",
"gc_3_4:[ {param:'glz.dur',add:R(1)} ],",
"gc_3_4:[ {param:'glz.dur',add:R(1.2)} ],",
"Reglaze"
],
[
"Clear as Glass 3%",
"FXJ",
"gc_5_4:[ {param:'glz.k',add:R(0.02)}",
"gc_5_4:[ {param:'glz.k',add:R(0.03)}",
"Reglaze"
],
[
"Clear as Glass no cleanse",
"FXJ",
"if(P['glz.cl']) A.acts(T,u,[{cleanse:1,on:'self'}],{u});",
"",
"Reglaze"
],
[
"Cooling Crust without the shield",
"FXJ",
"glazed(A,T,u){ return A.winOn(T,'peGlaze')&&(u.shield||0)>0; },",
"glazed(A,T,u){ return A.winOn(T,'peGlaze'); },",
"Reglaze"
],
[
"Annealing 1 Craze",
"FXJ",
"T.fn.craze(A,T,u,rk(T,'gc_12_4')); },",
"T.fn.craze(A,T,u,1); },",
"Reglaze"
],
[
"Hold It Back 30%",
"FXJ",
"if(P.hold&&A.winOn(T,'peHold')) cut(0.25);",
"if(P.hold&&A.winOn(T,'peHold')) cut(0.30);",
"crust breaking"
],
[
"Still Standing 0.6",
"FXJ",
"gc_6_3:[ {param:'hold.dur',add:R(0.5)} ],",
"gc_6_3:[ {param:'hold.dur',add:R(0.6)} ],",
"crust breaking"
],
[
"Splinters 4 nearest",
"FXJ",
".sort((a,b)=>E.dist(u,a)-E.dist(u,b)).slice(0,3);",
".sort((a,b)=>E.dist(u,a)-E.dist(u,b)).slice(0,4);",
"crust breaking"
],
[
"Splinters 70%",
"FXJ",
"A.acts(T,u,[{dmg:0.6*atkOf(A,T,u),on:'target',color:'#bfe8ff'}]",
"A.acts(T,u,[{dmg:0.7*atkOf(A,T,u),on:'target',color:'#bfe8ff'}]",
"crust breaking"
],
[
"Flood 7 m",
"FXJ",
"if(P.flood) for(const x of nearFoes(A,u,u,3))",
"if(P.flood) for(const x of nearFoes(A,u,u,7))",
"crust breaking"
],
[
"Flood 35%",
"FXJ",
"amt:0.30*atkOf(A,T,u),total:true,dur:3",
"amt:0.35*atkOf(A,T,u),total:true,dur:3",
"crust breaking"
],
[
"Running Heat 0.5%",
"FXJ",
"gc_4_1:[ {stat:{atk:R(0.004)},per:'peCraze'} ],",
"gc_4_1:[ {stat:{atk:R(0.005)},per:'peCraze'} ],",
"Craze riders"
],
[
"Safety Glass at 3",
"FXJ",
"if(P['dr.sg']&&A.stGet(T,'peCraze')>=4) cut(P['dr.sg']);",
"if(P['dr.sg']&&A.stGet(T,'peCraze')>=3) cut(P['dr.sg']);",
"Craze riders"
],
[
"Heat Shimmer 7 m",
"FXJ",
"if(P.shim&&s&&gapM(A,u,s)<2) cut(P.shim*A.stGet(T,'peCraze'));                                               // Heat Shimmer",
"if(P.shim&&s&&gapM(A,u,s)<7) cut(P.shim*A.stGet(T,'peCraze'));",
"Craze riders"
],
[
"Heat Shimmer not on allies",
"FXJ",
"if(P.shim&&s&&gapM(A,u,s)<2) cut(P.shim*A.stGet(T,'peCraze'));\n",
"\n",
"Craze riders"
],
[
"Fault Lines 0.5%",
"FXJ",
"ignoreArmor:R(0.004),per:'peCraze'}",
"ignoreArmor:R(0.005),per:'peCraze'}",
"Craze riders"
],
[
"Brittle Edge at 2",
"FXJ",
"if:{srcTeam:'enemy',stackMin:{peCraze:3}},do:[{dot:'peBrit'",
"if:{srcTeam:'enemy',stackMin:{peCraze:2}},do:[{dot:'peBrit'",
"Craze riders"
],
[
"Brittle Edge stacks",
"FXJ",
"every:1,refresh:true,color:'#ff8a3a'}]} ],",
"every:1,color:'#ff8a3a'}]} ],",
"Craze riders"
],
[
"Glassblower single",
"FXJ",
"T.fn.burn(A,T,u,c.tgt,2*T.fn.flowK(A,T)*(c.amt||0),'peGb');",
"T.fn.burn(A,T,u,c.tgt,T.fn.flowK(A,T)*(c.amt||0),'peGb');",
"Glassblower"
],
[
"Glassblower 1 Craze",
"FXJ",
"if(any(T,CRZ)) T.fn.craze(A,T,u,2); },",
"if(any(T,CRZ)) T.fn.craze(A,T,u,1); },",
"Glassblower"
],
[
"Burning Hands off",
"FXJ",
"myBurn(A,T,u,c){ return BURN.indexOf(c.tag)>=0; },",
"myBurn(A,T,u,c){ return false; },",
"Glassblower"
],
[
"signature 5 s",
"FXJ",
"A.acts(T,u,[{undying:6}],c); A.stSet(T,u,'peCraze',0); T.fn.flowOn(A,T,u,6,true); o.sigT=6;",
"A.acts(T,u,[{undying:6}],c); A.stSet(T,u,'peCraze',0); T.fn.flowOn(A,T,u,5,true); o.sigT=6;",
"Flow That Stopped"
],
[
"signature burn 7 m",
"FXJ",
"for(const x of nearFoes(A,u,u,3)) A.acts(T,u,[{dmg:d,on:'target',tag:'peSig'",
"for(const x of nearFoes(A,u,u,7)) A.acts(T,u,[{dmg:d,on:'target',tag:'peSig'",
"Flow That Stopped"
],
[
"signature burn 60%",
"FXJ",
"const d=0.5*atkOf(A,T,u);      // The Flow That Stopped",
"const d=0.6*atkOf(A,T,u);      // The Flow That Stopped",
"Flow That Stopped"
],
[
"signature shield 25%",
"FXJ",
"T.fn.glaze(A,T,u,0.30*u.maxHp,",
"T.fn.glaze(A,T,u,0.25*u.maxHp,",
"Flow That Stopped"
],
[
"signature every time",
"FXJ",
"gc_13_2:[ {on:'lethal',once:'fight',do:[{fn:'flowStood'}]} ],",
"gc_13_2:[ {on:'lethal',do:[{fn:'flowStood'}]} ],",
"Flow That Stopped"
],
[
"Check 4.5 s",
"FXJ",
"T.fn.check(A,T,u,t,4+(P['chk.dur']||0)+(o.mkFirst?(P['chk.first']||0):0));",
"T.fn.check(A,T,u,t,4.5+(P['chk.dur']||0)+(o.mkFirst?(P['chk.first']||0):0));",
"Check:"
],
[
"Checking Line 0.6",
"FXJ",
"rk_3_1:[ {param:'chk.dur',add:R(0.5)} ],",
"rk_3_1:[ {param:'chk.dur',add:R(0.6)} ],",
"Check:"
],
[
"Opening Move always",
"FXJ",
"o.mkFirst=(o.mkW!==T.s.wave);",
"o.mkFirst=true;",
"Check:"
],
[
"Check cut 3%",
"FXJ",
"rk_1_1:[ {param:'chk',add:R(0.02)} ],",
"rk_1_1:[ {param:'chk',add:R(0.03)} ],",
"Check:|caps"
],
[
"Check Pressure 2%",
"FXJ",
"rk_5_1:[ {on:'teamIn',if:{targetHas:'peChk',srcTeam:'ally'},more:R(0.015)} ],",
"rk_5_1:[ {on:'teamIn',if:{targetHas:'peChk',srcTeam:'ally'},more:R(0.02)} ],",
"Check:"
],
[
"Glass Behind Stone 4%",
"FXJ",
"rk_n2:[  {param:'dr.gbs',add:0.03}",
"rk_n2:[  {param:'dr.gbs',add:0.04}",
"Check:"
],
[
"Check Weight up to 5",
"FXJ",
"cut(P['dr.cw']*Math.min(4,n)); }",
"cut(P['dr.cw']*Math.min(5,n)); }",
"Check:"
],
[
"Discovered Check 1.2 s",
"FXJ",
"T.fn.check(A,T,u,L[0],1*rk(T,'rk_7_1')); },",
"T.fn.check(A,T,u,L[0],1.2*rk(T,'rk_7_1')); },",
"Discovered"
],
[
"Forced Move 20%",
"FXJ",
"rk_12_1:[ {on:'peChkEnd',if:{broke:false},do:[{slow:R(0.15),dur:2,on:'target'}]} ],",
"rk_12_1:[ {on:'peChkEnd',if:{broke:false},do:[{slow:R(0.2),dur:2,on:'target'}]} ],",
"Discovered"
],
[
"Perpetual Check 0.6 s",
"FXJ",
"((P.perp&&had)?0.5:0)",
"((P.perp&&had)?0.6:0)",
"Discovered"
],
[
"Perpetual Check on anyone",
"FXJ",
"((P.perp&&had)?0.5:0)",
"((P.perp)?0.5:0)",
"Discovered"
],
[
"Unmoved max 6",
"FXJ",
"peUnm:{max:P('unm.max',5),wave:'reset'}",
"peUnm:{max:P('unm.max',6),wave:'reset'}",
"Unmoved:"
],
[
"Unmoved kept between waves",
"FXJ",
"peUnm:{max:P('unm.max',5),wave:'reset'}",
"peUnm:{max:P('unm.max',5)}",
"Unmoved:"
],
[
"No Retreat per call",
"FXJ",
"if(got>0&&T.P.nr) A.acts(T,u,[{cd:'green',add:-T.P.nr*got}],{u}); },",
"if(T.P.nr) A.acts(T,u,[{cd:'green',add:-T.P.nr}],{u}); },",
"Unmoved:"
],
[
"Hold the Corner 1.1%",
"FXJ",
"rk_1_4:[ {stat:{atk:R(0.01)},per:'peUnm'} ],",
"rk_1_4:[ {stat:{atk:R(0.011)},per:'peUnm'} ],",
"Unmoved:"
],
[
"Weight of the Rook 0.5%",
"FXJ",
"rk_4_4:[ {param:'dr.wr',add:R(0.004)} ],",
"rk_4_4:[ {param:'dr.wr',add:R(0.005)} ],",
"Unmoved:"
],
[
"Corner Stone 0.3%",
"FXJ",
"rk_8_4:[ {stat:{hp:R(0.002)},per:'peUnm'} ],",
"rk_8_4:[ {stat:{hp:R(0.003)},per:'peUnm'} ],",
"Unmoved:"
],
[
"Planted Fists on any hit",
"FXJ",
"rk_6_4:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.005),per:'peUnm'} ],",
"rk_6_4:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.005),per:'peUnm'} ],",
"Unmoved:"
],
[
"Glass Endgame below 50%",
"FXJ",
"per:'peUnm',if:{selfHpBelow:0.40}} ],",
"per:'peUnm',if:{selfHpBelow:0.50}} ],",
"Unmoved:"
],
[
"Castle Wall 3 hits",
"FXJ",
"||(u._mmHits||0)<2) return;",
"||(u._mmHits||0)<3) return;",
"Castle Wall"
],
[
"Castle Wall at 4",
"FXJ",
"rk_3_4:[ {on:'hurt',if:{srcTeam:'enemy',stackMin:{peUnm:5}}",
"rk_3_4:[ {on:'hurt',if:{srcTeam:'enemy',stackMin:{peUnm:4}}",
"Castle Wall"
],
[
"Molten Plates 0.4%",
"FXJ",
"rk_2_2:[ {param:'dr.mp',add:R(0.003)} ],",
"rk_2_2:[ {param:'dr.mp',add:R(0.004)} ],",
"Castle Wall"
],
[
"Molten Heart 0.6%",
"FXJ",
"fm_8_3:[ {stat:{atk:R(0.005)}",
"fm_8_3:[ {stat:{atk:R(0.006)}",
"Castle Wall"
],
[
"the file: not behind",
"FXJ",
"if(!(along>0)) continue;",
"",
"Guarded File"
],
[
"the file: most off the line",
"FXJ",
"out.sort((p,q)=>p[1]-q[1]);",
"out.sort((p,q)=>q[1]-p[1]);",
"Guarded File"
],
[
"Two Files: one",
"FXJ",
"n=T.P.twoFiles?2:1",
"n=1",
"Guarded File"
],
[
"File Behind 1.2%",
"FXJ",
"rk_2_3:[ {param:'file',add:R(0.01)}",
"rk_2_3:[ {param:'file',add:R(0.012)}",
"Guarded File|caps"
],
[
"File Behind no mark",
"FXJ",
"if(rk(T,'rk_2_3')) A.setMark(T,u,s,'peFoe',{dur:3});",
"",
"Guarded File"
],
[
"Rook's Watch 1.2%",
"FXJ",
"rk_6_3:[ {param:'dr.rw',add:R(0.01)} ],",
"rk_6_3:[ {param:'dr.rw',add:R(0.012)} ],",
"Guarded File"
],
[
"File Guard 3%",
"FXJ",
"rk_8_3:[ {param:'fguard',add:R(0.02)} ],",
"rk_8_3:[ {param:'fguard',add:R(0.03)} ],",
"Guarded File"
],
[
"Rook and King 1.2%",
"FXJ",
"rk_10_3:[ {on:'teamIn',if:{targetTeam:'enemy',fn:'srcOnFile'},more:R(0.01)} ],",
"rk_10_3:[ {on:'teamIn',if:{targetTeam:'enemy',fn:'srcOnFile'},more:R(0.012)} ],",
"Guarded File"
],
[
"Long File 0.25%",
"FXJ",
"rk_4_3:[ {param:'lfile',add:R(0.002)} ],",
"rk_4_3:[ {param:'lfile',add:R(0.0025)} ],",
"Guarded File"
],
[
"Closed Board 7 s",
"FXJ",
"S(T).cbCd=Math.max(1,6-(T.P['cb.less']||0));",
"S(T).cbCd=Math.max(1,7-(T.P['cb.less']||0));",
"Closed Board"
],
[
"Closed Board no divert",
"FXJ",
"fn:'cbOk'},divert:1,do:[{fn:'cbUsed'}]}",
"fn:'cbOk'},do:[{fn:'cbUsed'}]}",
"Closed Board"
],
[
"Interpose 0.5 s",
"FXJ",
"rk_6_2:[ {param:'cb.less',add:R(1)} ],",
"rk_6_2:[ {param:'cb.less',add:R(0.5)} ],",
"Closed Board"
],
[
"Castling Wall 5%",
"FXJ",
"{shield:0.04*u.maxHp*(1+(T.P.hfile||0)),dur:4,on:'unit'}",
"{shield:0.05*u.maxHp*(1+(T.P.hfile||0)),dur:4,on:'unit'}",
"Castling"
],
[
"Hold the File 4%",
"FXJ",
"rk_12_3:[ {param:'hfile',add:R(0.03)} ],",
"rk_12_3:[ {param:'hfile',add:R(0.04)} ],",
"Castling"
],
[
"Castling Wall no Check",
"FXJ",
"if(P.cw&&!c.talent&&cur==='wb2') T.fn.check(A,T,u,t,4+(P['chk.dur']||0));",
"",
"Castling"
],
[
"Glass Behind Stone 60%",
"FXJ",
"[{shield:0.5*x*(1+(P.hfile||0)),dur:d,on:'unit'}]",
"[{shield:0.6*x*(1+(P.hfile||0)),dur:d,on:'unit'}]",
"Castling"
],
[
"Glass Behind Stone without Reglaze",
"FXJ",
"{param:'gbs',add:1,req:'gc_1_4'}",
"{param:'gbs',add:1}",
"Castling"
],
[
"Cannot Be Moved at 35%",
"FXJ",
"const lo=a.alive&&a.hp<0.3*a.maxHp",
"const lo=a.alive&&a.hp<0.35*a.maxHp",
"Cannot Be Moved"
],
[
"Cannot Be Moved 20 s",
"FXJ",
"o.cbm={a,t:4}; o.cbmCd=25;",
"o.cbm={a,t:4}; o.cbmCd=20;",
"Cannot Be Moved"
],
[
"Cannot Be Moved 5 s",
"FXJ",
"o.cbm={a,t:4}; o.cbmCd=25;",
"o.cbm={a,t:5}; o.cbmCd=25;",
"Cannot Be Moved"
],
[
"Cannot Be Moved 40%",
"FXJ",
"if(o.cbm&&o.cbm.a===t) k=0.5; return k; },",
"if(o.cbm&&o.cbm.a===t) k=0.6; return k; },",
"Cannot Be Moved"
],
[
"Cannot Be Moved 4 Unmoved",
"FXJ",
"A.stSet(T,u,'peUnm',A.stGet(T,'peUnm')+5);",
"A.stSet(T,u,'peUnm',A.stGet(T,'peUnm')+4);",
"Cannot Be Moved"
],
[
"Cannot Be Moved no molten",
"FXJ",
"if(u.pass&&u.pass.unmovable) u.wardenStk=5; break; }",
"break; }",
"Cannot Be Moved"
],
[
"Cannot Be Moved no taunt",
"FXJ",
"x.forcedTarget=u; x.forcedTargetT=Math.max(x.forcedTargetT||0,o.cbm.t); }",
"}",
"Cannot Be Moved"
],
[
"Cannot Be Moved lock as fight time",
"FXJ",
"o.cbCd=0; o.cbm=null;",
"o.cbCd=0; o.cbm=null; o.cbmCd=0;",
"Cannot Be Moved"
],
[
"Blocked Lines on melee",
"FXJ",
"if(P['dr.bl']&&!dot&&s&&!s.melee) cut(P['dr.bl']);",
"if(P['dr.bl']&&!dot&&s) cut(P['dr.bl']);",
"Rook:"
],
[
"Board Edge any row",
"FXJ",
"return (+E.depth(t.key)||0)<=1; },",
"return true; },",
"Rook:"
],
[
"Stand Fast 4 s",
"FXJ",
"A.setMark(T,u,t,'peStn',{dur:(t.stunned||0)+3,longest:true});",
"A.setMark(T,u,t,'peStn',{dur:(t.stunned||0)+4,longest:true});",
"Rook:"
],
[
"Last Rank below 35%",
"FXJ",
"if(P['dr.lr']&&u.hp<0.3*u.maxHp) cut(P['dr.lr']);",
"if(P['dr.lr']&&u.hp<0.35*u.maxHp) cut(P['dr.lr']);",
"Rook:"
],
[
"Slow Board 7 m",
"FXJ",
"rk_11_2:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',within:3}} ],",
"rk_11_2:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',within:7}} ],",
"Rook:"
],
[
"Rook's Patience 0.4",
"FXJ",
"rk_12_2:[ {on:'cd',skill:'blue',add:R(-0.3)} ],",
"rk_12_2:[ {on:'cd',skill:'blue',add:R(-0.4)} ],",
"Rook:"
],
[
"Unmovable 5%",
"FXJ",
"rk_5_4:[ {param:'ten',add:R(0.04)} ],",
"rk_5_4:[ {param:'ten',add:R(0.05)} ],",
"Rook:|caps"
],
[
"Crushing Grip 3%",
"FXJ",
"rk_9_2:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.02)} ],",
"rk_9_2:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.03)} ],",
"Rook:"
],
[
"Heat max 7",
"FXJ",
"peHeat:{max:P('heat.max',6),wave:'reset'}",
"peHeat:{max:P('heat.max',7),wave:'reset'}",
"Knuckle Heat"
],
[
"Coal 1 a rank",
"FXJ",
"fm_6_1:[ {param:'coal',add:R(2)} ],",
"fm_6_1:[ {param:'coal',add:R(1)} ],",
"Knuckle Heat"
],
[
"Furnace Breath 0.6%",
"FXJ",
"fm_4_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.005),per:'peHeat'} ],",
"fm_4_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.006),per:'peHeat'} ],",
"Knuckle Heat"
],
[
"Hot Knuckles 2%",
"FXJ",
"more:R(0.015),per:{fn:'spent'}} ],",
"more:R(0.02),per:{fn:'spent'}} ],",
"Knuckle Heat|Valley"
],
[
"Heat not spent",
"FXJ",
"if(!(n>0)) return; A.stSet(T,u,'peHeat',0);",
"if(!(n>0)) return;",
"Knuckle Heat"
],
[
"Burning Knuckles 0.4%",
"FXJ",
"fm_7_1:[ {param:'bk',add:R(0.003)} ],",
"fm_7_1:[ {param:'bk',add:R(0.004)} ],",
"Knuckle Heat"
],
[
"Rising Fire 6 s",
"FXJ",
"[{roll:'peRise',add:n,span:5}]",
"[{roll:'peRise',add:n,span:6}]",
"Knuckle Heat"
],
[
"Searing at 5",
"FXJ",
"spent6(A,T){ return (S(T).sp||0)>=6; },",
"spent6(A,T){ return (S(T).sp||0)>=5; },",
"Knuckle Heat"
],
[
"Searing 30%",
"FXJ",
"T.fn.burn(A,T,u,c.tgt,0.25*(c.amt||0),'peSear',3);",
"T.fn.burn(A,T,u,c.tgt,0.30*(c.amt||0),'peSear',3);",
"Knuckle Heat"
],
[
"Fire Fists at 5",
"FXJ",
"stackMin:{peHeat:6}},do:[{fn:'fireFist'}]}",
"stackMin:{peHeat:5}},do:[{fn:'fireFist'}]}",
"Knuckle Heat"
],
[
"Held Fast 4.5 s",
"FXJ",
"dur:4+(T.P['hf.dur']||0),while:'alive',ends:'peHFEnd'}",
"dur:4.5+(T.P['hf.dur']||0),while:'alive',ends:'peHFEnd'}",
"Held Fast"
],
[
"Held Fast basic 4%",
"FXJ",
"{param:'hf.on',add:1}, {on:'out',if:{auto:true,targetHas:'peHF'},more:R(0.03)}",
"{param:'hf.on',add:1}, {on:'out',if:{auto:true,targetHas:'peHF'},more:R(0.04)}",
"Held Fast"
],
[
"Held Fast no heal cap",
"FXJ",
"c.amt=Math.max(0,Math.min(c.amt,cap-t.hp)); },",
"},",
"Held Fast"
],
[
"Fist Speed 4%",
"FXJ",
"fm_2_3:[ {stat:{aspd:[1/0.97-1,1/0.94-1,1/0.91-1]}",
"fm_2_3:[ {stat:{aspd:[1/0.96-1,1/0.92-1,1/0.88-1]}",
"Held Fast"
],
[
"Grinding Hold 1.2%",
"FXJ",
"fm_9_2:[ {on:'teamIn',if:{targetHas:'peHF',srcTeam:'ally'},more:R(0.01)} ],",
"fm_9_2:[ {on:'teamIn',if:{targetHas:'peHF',srcTeam:'ally'},more:R(0.012)} ],",
"Held Fast"
],
[
"Throw Them Down 7 m",
"FXJ",
"const L=[t].concat(nearFoes(A,u,t,2)), d=0.5*atkOf(A,T,u)*(1+(P.crater||0));",
"const L=[t].concat(nearFoes(A,u,t,7)), d=0.5*atkOf(A,T,u)*(1+(P.crater||0));",
"Held Fast ends"
],
[
"Throw Them Down 60%",
"FXJ",
"const L=[t].concat(nearFoes(A,u,t,2)), d=0.5*atkOf(A,T,u)*(1+(P.crater||0));",
"const L=[t].concat(nearFoes(A,u,t,2)), d=0.6*atkOf(A,T,u)*(1+(P.crater||0));",
"Held Fast ends"
],
[
"Ground Crater 12%",
"FXJ",
"fm_6_3:[ {param:'crater',add:R(0.10)} ],",
"fm_6_3:[ {param:'crater',add:R(0.12)} ],",
"Held Fast ends"
],
[
"talent stun on a stunned enemy",
"FXJ",
"if((t.stunned||0)>0||A.markOf(u,t,'peLk')||(n[t.uid]||0)>=2) continue;",
"if(A.markOf(u,t,'peLk')||(n[t.uid]||0)>=2) continue;",
"Held Fast ends"
],
[
"talent stun inside the lock",
"FXJ",
"if((t.stunned||0)>0||A.markOf(u,t,'peLk')||(n[t.uid]||0)>=2) continue;",
"if((t.stunned||0)>0||(n[t.uid]||0)>=2) continue;",
"stun-lock"
],
[
"Crush the Arms off",
"FXJ",
"if(P.crush){ const h=o.hf; if(h&&h.alive&&A.markOf(u,h,'peHF')) h.silencedT=Math.max(h.silencedT||0,0.1); }",
"",
"Held Fast ends"
],
[
"Mountain Falls Twice 0.7 s",
"FXJ",
"later(T,0.6,'twice',{hits:L.slice()}); },",
"later(T,0.7,'twice',{hits:L.slice()}); },",
"Held Fast ends"
],
[
"Mountain Falls Twice 60%",
"FXJ",
"A.acts(T,u,[{dmg:0.5*d,on:'target',color:'#ff9a4a'}],{u,src:u,tgt:e}); },",
"A.acts(T,u,[{dmg:0.6*d,on:'target',color:'#ff9a4a'}],{u,src:u,tgt:e}); },",
"Held Fast ends"
],
[
"Tremor 11%",
"FXJ",
"let k=0.10*rk1(T,'fm_1_4')*(1+(P.rumble||0));",
"let k=0.11*rk1(T,'fm_1_4')*(1+(P.rumble||0));",
"Tremor|Worldshaker|Valley"
],
[
"Tremor 1.2 s",
"FXJ",
"if(any(T,TREM)) later(T,1,'tremor',{hits:L.slice(),stun:false});",
"if(any(T,TREM)) later(T,1.2,'tremor',{hits:L.slice(),stun:false});",
"Tremor"
],
[
"First Shock every time",
"FXJ",
"if(o.firstT){ o.firstT=false; k*=1+(P.first||0); }",
"if(o.firstT){ k*=1+(P.first||0); }",
"Tremor"
],
[
"Rolling Shock 5%",
"FXJ",
"fm_3_4:[ {param:'roll',add:R(0.04)} ],",
"fm_3_4:[ {param:'roll',add:R(0.05)} ],",
"Tremor"
],
[
"Settling Ground 0.2",
"FXJ",
"fm_10_4:[ {param:'settle',add:R(0.1)} ],",
"fm_10_4:[ {param:'settle',add:R(0.2)} ],",
"Tremor"
],
[
"Long Rumble 4%",
"FXJ",
"fm_12_4:[ {param:'rumble',add:R(0.03)} ],",
"fm_12_4:[ {param:'rumble',add:R(0.04)} ],",
"Tremor"
],
[
"Echoing Ground 3%",
"FXJ",
"fm_7_4:[ {param:'echo',add:R(0.02)} ],",
"fm_7_4:[ {param:'echo',add:R(0.03)} ],",
"Tremor"
],
[
"every slam a Tremor without Worldshaker",
"FXJ",
"(k===2||T.P.shaker)",
"(true)",
"Tremor"
],
[
"Worldshaker stun 0.5",
"FXJ",
"if(a.stun) T.fn.tstun(A,T,u,st,0.4,'shaker');",
"if(a.stun) T.fn.tstun(A,T,u,st,0.5,'shaker');",
"Worldshaker"
],
[
"Deep Quake 0.2",
"FXJ",
"fm_5_4:[ {param:'deep',add:R(0.3)} ],",
"fm_5_4:[ {param:'deep',add:R(0.2)} ],",
"Worldshaker"
],
[
"Crushing Weight 0.2",
"FXJ",
"fm_12_1:[ {param:'mk.ext',add:R(0.1)} ],",
"fm_12_1:[ {param:'mk.ext',add:R(0.2)} ],",
"extensions"
],
[
"Hold Tighter 0.2",
"FXJ",
"fm_10_2:[ {param:'cl.ext',add:R(0.1)} ],",
"fm_10_2:[ {param:'cl.ext',add:R(0.2)} ],",
"extensions"
],
[
"Open Hearth 0.15",
"FXJ",
"fm_11_2:[ {param:'opens',add:0.1} ],",
"fm_11_2:[ {param:'opens',add:0.15} ],",
"extensions"
],
[
"stun top 4.5 s",
"FXJ",
"STUN_TOP=4.0;   // his group",
"STUN_TOP=4.5;   // his group",
"extensions"
],
[
"Bigger Fist 0.1",
"FXJ",
"fm_4_3:[ {on:'kit',skill:MK,opt:{radius:{addM:R(0.2)}}} ],",
"fm_4_3:[ {on:'kit',skill:MK,opt:{radius:{addM:R(0.1)}}} ],",
"Falling Mountain:"
],
[
"First Knock every hit",
"FXJ",
"if:{auto:true,targetTeam:'enemy',targetLacks:'peKn'},more:R(0.08)}",
"if:{auto:true,targetTeam:'enemy'},more:R(0.08)}",
"Falling Mountain:"
],
[
"Bonebreaker 4%",
"FXJ",
"fm_11_1:[ {on:'out',if:{targetTeam:'enemy',fn:'stunnedT'},more:R(0.03)} ],",
"fm_11_1:[ {on:'out',if:{targetTeam:'enemy',fn:'stunnedT'},more:R(0.04)} ],",
"Falling Mountain:"
],
[
"Lava Veins 1.2%",
"FXJ",
"fm_11_3:[ {on:'hit',if:{casting:SK,targetTeam:'enemy'},do:[{heal:{pct:R(0.01),of:'hpLost'}}]} ],",
"fm_11_3:[ {on:'hit',if:{casting:SK,targetTeam:'enemy'},do:[{heal:{pct:R(0.012),of:'hpLost'}}]} ],",
"Falling Mountain:"
],
[
"Smelted 3%",
"FXJ",
"fm_8_1:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.02)} ],",
"fm_8_1:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.03)} ],",
"Falling Mountain:"
],
[
"Clinch Strength 4%",
"FXJ",
"fm_6_2:[ {on:'out',if:{casting:CL,targetTeam:'enemy'},more:R(0.03)} ],",
"fm_6_2:[ {on:'out',if:{casting:CL,targetTeam:'enemy'},more:R(0.04)} ],",
"Falling Mountain:"
],
[
"Crater Maker 4%",
"FXJ",
"fm_9_3:[ {on:'out',if:{casting:WB,targetTeam:'enemy'},more:R(0.03)} ],",
"fm_9_3:[ {on:'out',if:{casting:WB,targetTeam:'enemy'},more:R(0.04)} ],",
"Falling Mountain:"
],
[
"Valley 15 s",
"FXJ",
"c.force=true; o.valArm=false; o.valCd=20; o.valT=t; },",
"c.force=true; o.valArm=false; o.valCd=15; o.valT=t; },",
"Valley"
],
[
"Valley no crit",
"FXJ",
"c.force=true; o.valArm=false; o.valCd=20; o.valT=t; },",
"o.valArm=false; o.valCd=20; o.valT=t; },",
"Valley"
],
[
"Valley no refill",
"FXJ",
"o.valT=null; A.stSet(T,u,'peHeat',A.stMax(T,u,'peHeat'));",
"o.valT=null;",
"Valley"
],
[
"Valley Tremors 0.6 s",
"FXJ",
"later(T,0.5,'tremor',{hits:L,stun:false}); later(T,1.0,",
"later(T,0.6,'tremor',{hits:L,stun:false}); later(T,1.0,",
"Valley"
],
[
"Valley at 5 Heat",
"FXJ",
"if(rk(T,'fm_13_2')&&n>=6&&!(o.valCd>0)) o.valArm=true; },",
"if(rk(T,'fm_13_2')&&n>=5&&!(o.valCd>0)) o.valArm=true; },",
"Valley"
],
[
"DR cap 45%",
"FXJ",
"const DR_FLOOR=0.60, TEN_CAP=0.30",
"const DR_FLOOR=0.55, TEN_CAP=0.30",
"caps"
],
[
"tenacity cap 35%",
"FXJ",
"const x=Math.min(TEN_CAP,1-k);",
"const x=Math.min(0.35,1-k);",
"caps"
]
].map(c=>[c[0],c[1]==='HTML'?HTML:FXJ,c[2],c[3],c[4]]);
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||(!SKIP.has(r.split(path.sep)[0])&&!/^\.ctl-|^\.remote-|^\.test-/.test(r.split(path.sep)[0])); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-pec-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\r\n/g,'\n').replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), b=to.replace(/\r\n/g,'\n').replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>b));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-pellucid.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
