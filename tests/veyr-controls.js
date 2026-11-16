'use strict';
/* The controls for Veyr's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a row or a number of
   his broken), runs the named tests of tests/talents-mech-veyr.test.js in that copy, and expects them to FAIL. The checkout itself is never changed. Prints one
   line per control and a count; exits 1 if any control was not caught. J=1 by default: one copy at a time, each deleted as soon as it has run (the wiring brief's
   rule). Every `to` below was verified by a probe: the amplified break makes the targeted test fail.

   Swap note (this audit): five talents have no behavioural assertion an amplified break can trip (Keep Them Down tr_5_2, Heavier Pull tr_4_2, Crush Depth tr_8_1,
   Let Them Drift tr_5_3, Tough Love oh_7_1 - presence is checked by the accounting test only). Their controls were re-pointed at five wired cousins in the same
   test blocks (Quick Fold, Barbed Crescent, Heavy Enough, Undersea Calm, Nowhere to Swim) so the coverage stays 64. The five uncovered talents are listed in
   the decisions log. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page: the crescent's nearest pick, the mantle window, the Undertow catch, the Weightless pay ----
  ['the crescent picks the nearest',HTML,"type:'tendrilpull',nearest:true,mul:1.5,","type:'tendrilpull',mul:1.5,",'his real kit'],
  ['the mantle counters the hit',HTML,"u._evadeT=o.dur||2.2; u._evadeMul=(o.mul||1.8)*sm;","u._evadeT=o.dur||2.2; u._evadeMul=0;",'his real kit'],
  ['the Undertow catch 7 m',HTML,"abyssalundertow:{mul:1.9,radius:7*METER,pull:1.2,","abyssalundertow:{mul:1.9,radius:3*METER,pull:1.2,",'his real kit'],
  ['Weightless pays haste and crit',HTML,"if(tgt.pass&&tgt.pass.weightless){ const pm=(tgt.passMul||1);","if(false&&tgt.pass&&tgt.pass.weightless){ const pm=(tgt.passMul||1);",'his real kit'],
  // ---- Deepwater (The Trench) ----
  ['Deepwater 8 s',FXJ,"vyDw:{unit:true, max:5, dur:P('dw.dur',8), full:'crush', chain:0.5}","vyDw:{unit:true, max:5, dur:P('dw.dur',4), full:'crush', chain:0.5}",'/ Deepwater'],
  ['the crush answers five Deepwater',FXJ,"{on:'crush',reqAny:['tr_3_1','tr_9_1','tr_12_1'],do:[{fn:'crush'}]}","{on:'crush',reqAny:['tr_9_1x'],do:[{fn:'crush'}]}",'/ Deepwater'],
  ['Heavy Enough 2% a rank',FXJ,"tr_12_2:[ {on:'out',if:{targetUst:{vyDw:3}},more:R(0.02)} ],","tr_12_2:[ {on:'out',if:{targetUst:{vyDw:3}},more:R(0)} ],",'/ the Trench riders'],
  ['Implosion +2',FXJ,"tr_9_1:[ {param:'impl',add:R(2)} ],","tr_9_1:[ {param:'impl',add:R(1)} ],",'/ Deepwater'],
  ['Kept Down 0.6 s a rank',FXJ,"tr_11_1:[ {param:'dw.dur',add:R(0.6)} ],","tr_11_1:[ {param:'dw.dur',add:R(0)} ],",'/ Deepwater'],
  // ---- the Trench riders ----
  ['Quick Fold 0.1 s a rank',FXJ,"tr_8_3:[ {param:'cd.g',add:R(0.1)} ],","tr_8_3:[ {param:'cd.g',add:R(0.5)} ],",'/ the Trench riders'],
  ['Undersea Calm 2% a rank',FXJ,"tr_11_3:[ {on:'out',if:{crit:true,targetUst:{vyDw:1}},critMore:R(0.02)} ],","tr_11_3:[ {on:'out',if:{crit:true,targetUst:{vyDw:1}},critMore:R(0.10)} ],",'/ the Trench riders'],
  ['Barbed Crescent 5% a rank',FXJ,"tl_4_2:[ {on:'out',if:{casting:GC,crit:true},critMore:R(0.05)} ],","tl_4_2:[ {on:'out',if:{casting:GC,crit:true},critMore:R(0)} ],",'/ the Trench riders'],
  ['Soundings 2% on a slowed target',FXJ,"tr_7_1:[ {on:'out',if:{fn:'tgtSlowed'},more:R(0.02)} ],","tr_7_1:[ {on:'out',if:{fn:'tgtSlowed'},more:R(0)} ],",'/ the Trench riders'],
  // ---- the tide (Other Half) ----
  ['the breath 4 s a phase',FXJ,"v.tide='out'; v.tideT=4+(P['br.dur']||0); v.rb=0; v.dc=0;","v.tide='out'; v.tideT=9+(P['br.dur']||0); v.rb=0; v.dc=0;",'/ the tide'],
  ['Breathing Mantle 3% a rank',FXJ,"oh_1_4:[ {param:'bm.dr',add:R(0.03)}, {on:'out',if:{fn:'tideOut'},more:R(0.03)} ],","oh_1_4:[ {param:'bm.dr',add:R(0.01)}, {on:'out',if:{fn:'tideOut'},more:R(0.03)} ],",'/ the tide'],
  ['Slow Gills 0.5% a rank',FXJ,"oh_8_3:[ {param:'sg.dr',add:R(0.005)} ],","oh_8_3:[ {param:'sg.dr',add:R(0)} ],",'/ the tide'],
  ['Diving Breath 0.2 s a rank',FXJ,"oh_3_4:[ {param:'br.dur',add:R(0.2)} ],","oh_3_4:[ {param:'br.dur',add:R(0)} ],",'/ the tide'],
  ['the tide flips on its own clock',FXJ,"if(v.tideT>0){ v.tideT=Math.max(0,v.tideT-dt); if(v.tideT<=0){ v.tide=(v.tide==='in')?'out':'in'; v.tideT=4+(P['br.dur']||0); v.rb=1; v.dc=1; } }","if(v.tideT>0){ v.tideT=Math.max(0,v.tideT-dt); if(v.tideT<=0){ v.tide=(v.tide==='in')?'out':'in'; v.tideT=9+(P['br.dur']||0); v.rb=1; v.dc=1; } }",'/ the tide'],
  ['Two Hearts flips on the blue',FXJ,"tideIn(A,T,u){ const v=V(T), P=T.P; v.tide='in'; v.tideT=4+(P['br.dur']||0); v.rb=0; v.dc=0; },","tideIn(A,T,u){ const v=V(T), P=T.P; v.tide='out'; v.tideT=4+(P['br.dur']||0); v.rb=0; v.dc=0; },",'/ the tide'],
  // ---- the mantle and its counter ----
  ['Never Lets Go falls on every swinger',FXJ,"if(c.src&&c.src.team!==u.team&&v.nlgFoes.indexOf(c.src)<0) v.nlgFoes.push(c.src); }","if(false&&c.src&&c.src.team!==u.team&&v.nlgFoes.indexOf(c.src)<0) v.nlgFoes.push(c.src); }",'/ the mantle'],
  ['the counter 5% a swing evaded',FXJ,"const mul=1+0.05*v.nlgCount;","const mul=1+0.03*v.nlgCount;",'/ the mantle'],
  ['Mantle Hunger 3% a rank',FXJ,"oh_9_2:[ {param:'mh',add:R(0.03)} ],","oh_9_2:[ {param:'mh',add:R(0)} ],",'/ the mantle'],
  ['Never Lets Go never in-block',FXJ,"u._vyHm=P.hm?1:0; u._vyNlg=P.nlg?1:0;","u._vyHm=P.hm?1:0; u._vyNlg=0;",'/ the mantle'],
  // ---- Giddy (Too Light Up Here) ----
  ['Giddy caps at 8',FXJ,"vyGiddy:{max:P('g.cap',8), wave:'reset'}","vyGiddy:{max:P('g.cap',6), wave:'reset'}",'/ Giddy'],
  ['Stay Steady caps at 5',FXJ,"tl_5_2:[ {param:'g.cap',add:R(-3)} ],","tl_5_2:[ {param:'g.cap',add:R(-1)} ],",'/ Giddy'],
  ['Let Go +4',FXJ,"tl_5_3:[ {param:'g.cap',add:R(4)}, {stat:{aspd:R(0.005)},per:'vyGiddy'} ],","tl_5_3:[ {param:'g.cap',add:R(2)}, {stat:{aspd:R(0.005)},per:'vyGiddy'} ],",'/ Giddy'],
  ['Drunk on Air 2% a stack',FXJ,"tl_1_4:[ {param:'drunk',add:R(0.02)}, {stat:{armor:R(-0.005)},per:'vyGiddy',if:{fn:'noSteady'}} ],","tl_1_4:[ {param:'drunk',add:R(0)}, {stat:{armor:R(-0.005)},per:'vyGiddy',if:{fn:'noSteady'}} ],",'/ Giddy'],
  ['Head in the Clouds banks the miss',FXJ,"if(stN(T,'vyGiddy')>=A.stMax(T,u,'vyGiddy')-1e-9&&v.hcLock<=0){ v.hcLock=8; c.miss=true; u._vyBankMiss=1; }","if(stN(T,'vyGiddy')>=A.stMax(T,u,'vyGiddy')-1e-9&&v.hcLock<=0){ v.hcLock=8; }",'/ Giddy'],
  // ---- Drift ----
  ['Drift +1 per 0.5 s',FXJ,"v.dAcc+=dt; while(v.dAcc>=0.5-1e-9){ v.dAcc-=0.5;","v.dAcc+=dt; while(v.dAcc>=0.7-1e-9){ v.dAcc-=0.7;",'/ Drift'],
  ['the fade 2 a second',FXJ,"const f=Math.max(0, 2+(P['dr.fade']||0));","const f=Math.max(0, 1+(P['dr.fade']||0));",'/ Drift'],
  ['Long Glide caps 10 + 2 a rank',FXJ,"vyDrift:{max:P('dr.max',10)}","vyDrift:{max:P('dr.max',8)}",'/ Drift'],
  ['Carried Along spends 5',FXJ,"if(c.auto&&P.ca&&stN(T,'vyDrift')>=10){ c.force=true; A.stSet(T,u,'vyDrift',Math.max(0,stN(T,'vyDrift')-5)); }","if(c.auto&&P.ca&&stN(T,'vyDrift')>=10){ c.force=true; A.stSet(T,u,'vyDrift',Math.max(0,stN(T,'vyDrift')-3)); }",'/ Drift'],
  ['Dragged in the Wake at 10 Drift',FXJ,"if(P.ditw&&stN(T,'vyDrift')>=10) A.stSet(T,u,'vyDrift',0);","if(P.ditw&&stN(T,'vyDrift')>=12) A.stSet(T,u,'vyDrift',0);",'/ Drift'],
  ['Surface Run 3 m',FXJ,"{on:'out',if:{auto:true,fn:'surfOk'},more:R(0.04),do:[{fn:'surfSpend'}]}","{on:'out',if:{auto:true,fn:'surfOk'},more:R(0.01),do:[{fn:'surfSpend'}]}",'/ Drift'],
  // ---- The Fold ----
  ['the fold line 8% of max HP',FXJ,"const line=Math.max(0.05, 0.08-(P['fo.line']||0));","const line=Math.max(0.05, 0.30-(P['fo.line']||0));",'/ The Fold'],
  ['a charge back 12 s',FXJ,"v.foldC--; v.folds++; v.foldT=Math.max(2,12+(P['fold.per']||0));","v.foldC--; v.folds++; v.foldT=Math.max(2,16+(P['fold.per']||0));",'/ The Fold'],
  ['It Moves First −0.4 s a rank',FXJ,"oh_1_1:[ {param:'fold.per',add:R(-0.4)} ],","oh_1_1:[ {param:'fold.per',add:R(0.4)} ],",'/ The Fold'],
  ['Twice Folded a second charge',FXJ,"oh_9_1:[ {param:'fold.ch',add:1} ],","oh_9_1:[ {param:'fold.ch',add:2} ],",'/ The Fold'],
  ['Twice Folded readies two at the wave',FXJ,"if(has(T,FOLD)){ v.foldC=1+(P['fold.ch']||0); if(P.sw) v.swad=4; }","if(false&&has(T,FOLD)){ v.foldC=1+(P['fold.ch']||0); if(P.sw) v.swad=4; }",'/ The Fold'],
  ['Fold Over 1% a rank',FXJ,"oh_6_1:[ {param:'fo.line',add:R(0.01)} ],","oh_6_1:[ {param:'fo.line',add:R(0)} ],",'/ The Fold'],
  ['Wrapped Tight 5% a rank',FXJ,"oh_8_1:[ {param:'wt2',add:R(0.05)} ],","oh_8_1:[ {param:'wt2',add:R(0)} ],",'/ The Fold'],
  // ---- Hush (The Trench) ----
  ['the hush 4 s',FXJ,"if(T.r['tr_1_4']&&caught.length){ const d=4+(P['hush.dur']||0);","if(T.r['tr_1_4']&&caught.length){ const d=2+(P['hush.dur']||0);",'/ Hush'],
  ['Deep Silence 0.4 s a rank',FXJ,"tr_5_4:[ {param:'hush.dur',add:R(0.4)} ],","tr_5_4:[ {param:'hush.dur',add:R(0)} ],",'/ Hush'],
  ['No Sound 6% a rank',FXJ,"{on:'teamIn',if:{srcHas:'vyNs'},less:R(0.06)} ],","{on:'teamIn',if:{srcHas:'vyNs'},less:R(0.03)} ],",'/ Hush'],
  ['Hush Falls 3% a rank',FXJ,"tr_7_4:[ {on:'teamIn',if:{targetHas:'vyHush'},more:R(0.03)} ],","tr_7_4:[ {on:'teamIn',if:{targetHas:'vyHush'},more:R(0.05)} ],",'/ Hush'],
  ['Mute Water no energy',FXJ,"tr_9_4:[ {on:'teamNrg',if:{unitHas:'vyHush'},mul:0} ],","tr_9_4:[ {on:'teamNrg',if:{unitHas:'vyHush'},mul:0.5} ],",'/ Hush'],
  ['Sealing Water 5% a rank',FXJ,"tr_12_4:[ {on:'teamHeal',if:{unitHas:'vyHush'},less:R(0.05)} ],","tr_12_4:[ {on:'teamHeal',if:{unitHas:'vyHush'},less:R(0.08)} ],",'/ Hush'],
  // ---- his damage-reduction group (DRG70) ----
  ['the kept-share floor 0.30',FXJ,"const DR_FLOOR=0.30, BLUE_FLOOR=5;","const DR_FLOOR=0.20, BLUE_FLOOR=5;",'damage-reduction'],
  ['Nowhere to Swim 1% a rank each',FXJ,"tr_10_2:[ {on:'out',more:R(0.01),per:{units:{team:'enemy',within:3},max:4}} ],","tr_10_2:[ {on:'out',more:R(0.05),per:{units:{team:'enemy',within:3},max:4}} ],",'/ the Trench riders'],
  ['Clinging 10% a rank',FXJ,"oh_4_2:[ {param:'cling',add:R(0.10)} ],","oh_4_2:[ {param:'cling',add:R(0.05)} ],",'damage-reduction'],
  ['Unspoken 2% a rank',FXJ,"tr_10_4:[ {param:'un',add:R(0.02)} ],","tr_10_4:[ {param:'un',add:R(0)} ],",'damage-reduction'],
  ['Pressure Wise 2% a rank',FXJ,"tr_n1:[ {param:'pw',add:R(0.02)} ],","tr_n1:[ {param:'pw',add:R(0)} ],",'damage-reduction'],
  ['Salt Scar 2% a rank',FXJ,"oh_12_3:[ {param:'ss',add:R(0.02)} ],","oh_12_3:[ {param:'ss',add:R(0)} ],",'damage-reduction'],
  ['Updraft 2% a rank',FXJ,"tl_n1:[ {param:'up',add:R(0.02)} ],","tl_n1:[ {param:'up',add:R(0)} ],",'damage-reduction'],
  ['the fold answers a hit in the group',FXJ,"cut(0.5+(P['wt2']||0)); } }","cut(0.05+(P['wt2']||0)); } }",'damage-reduction'],
  // ---- the signatures ----
  ['The Trench Comes Up +15%',FXJ,"tr_13_2:[ {param:'s1',add:1}, {on:'out',if:{fn:'sig1On'},more:0.15} ],","tr_13_2:[ {param:'s1',add:1}, {on:'out',if:{fn:'sig1On'},more:0.10} ],",'/ the signatures'],
  ['the collapse locks 20 s',FXJ,"if(P.s1&&v.s1Lock<=0&&caught.length){ v.s1Lock=20; v.s1=4;","if(P.s1&&v.s1Lock<=0&&caught.length){ v.s1Lock=0; v.s1=4;",'/ the signatures'],
  ['It Never Let Go at 30% HP',FXJ,"if(!(u.hp-(c.amt||0)<=0.30*(u.maxHp||0))) return;","if(!(u.hp-(c.amt||0)<=0.20*(u.maxHp||0))) return;",'/ the signatures'],
  ['full Drift fires the signature',FXJ,"if(P.s3&&stN(T,'vyDrift')>=dMax-1e-9&&v.s3Lock<=0&&!(v.s3>0)){ v.s3=4; v.s3Lock=20; } } } }","if(P.s3&&stN(T,'vyDrift')>=dMax-1e-9&&v.s3Lock<=0&&!(v.s3>0)){ v.s3=2; v.s3Lock=20; } } } }",'/ the signatures'],
  ['the hide needs him moving',FXJ,"if(v.s3>0&&c.src) T.fn.sig3Cast(A,T,u,c.src);","if(false&&v.s3>0&&c.src) T.fn.sig3Cast(A,T,u,c.src);",'/ the signatures'],
  // ---- determinism / identity / the 95% ceiling ----
  ['Long Crescent 3% a rank',FXJ,"tr_2_2:[ {on:'out',if:{casting:GC},more:R(0.03)} ],","tr_2_2:[ {on:'out',if:{casting:GC},more:R(0.02)} ],",'whole fights are deterministic'],
  ['Crescent Arc 3% a rank',FXJ,"tl_8_2:[ {on:'out',if:{casting:GC},more:R(0.03)} ],","tl_8_2:[ {on:'out',if:{casting:GC},more:R(0.02)} ],",'whole fights are deterministic'],
  ['Fin Blades 2% a rank',FXJ,"oh_3_3:[ {on:'out',if:{auto:true},more:R(0.02)} ],","oh_3_3:[ {on:'out',if:{auto:true},more:R(0.03)} ],",'whole fights are deterministic'],
  ['the DR group applies at the hit',FXJ,"c.amt*=Math.max(DR_FLOOR,k); },","c.amt*=Math.max(0.50,k); },",'91-point'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-vesper','.remote-veyr','.remote-vaelora','.remote-vulmar','.remote-yenna','.remote-zahri','.remote-morvayne','.remote-logs']);
const TMP=(()=>{ const t=os.tmpdir(), r=path.relative(root,t); return (!r.startsWith('..')&&!path.isAbsolute(r))?path.dirname(root):t; })();   // the test host keeps its temp folder inside the checkout: copy beside it instead
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))){ try{ fs.symlinkSync(path.join(root,k),path.join(dir,k),process.platform==='win32'?'junction':undefined); }
    catch(e){ fs.cpSync(path.join(root,k),path.join(dir,k),{recursive:true}); } } }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-vyc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-veyr.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/(?:#|ℹ) fail (\d+)/.exec(out), pm=/(?:#|ℹ) pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||1), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
