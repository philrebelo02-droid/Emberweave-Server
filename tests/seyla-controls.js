'use strict';
/* The controls for Seyla Silkcoil's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-seyla.test.js). Each control copies this checkout to a temp folder (os.tmpdir(): the runner's own temp folder on disk), breaks ONE thing there
   (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guarded site given an unguarded seeded draw, a row,
   a number or a cap of hers changed), runs the named tests of tests/talents-mech-seyla.test.js in that copy, and expects them to FAIL. ONE copy at a time (no
   parallel child processes); each copy is deleted as soon as its run is done; .logs, .remote-logs, .tmp, assets and node_modules are never copied (node_modules
   is linked). The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   Run: node tests/seyla-controls.js   (ONLY='name|name' runs some of them; --check only verifies that every text to break is found exactly once) */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', ID='no talents';
const VR="%((u._tal&&u._tal.on.num)?TalentFx.num(u,'vrN',3,t):3);", VP="if(u._tal&&u._tal.on.pass) TalentFx.pass(u,t,'venomrhythm'); }";
const DP="if(u._tal) TalentFx.partPre(u,e,'sdPass');", DQ="if(u._tal) TalentFx.part(u,e,'sdPass');";
const C=[
  // ---- the page sites: hook removed (her tests fail) ----
  ['count hook removed',HTML,VR,'%3;','Long Count|Never Heard|crit-chance group'],
  ['swing hook removed',HTML,VP,'}','One \\(|Two \\(|Three \\('],
  ['pass partPre removed',HTML,DP,'','Wide Swing'],
  ['pass part removed',HTML,DQ,'','Saved for Last'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the count',HTML,"if(u.pass.venomrhythm){ u._vrN=","if(u.pass.venomrhythm){ brnd(); u._vrN=",ID],
  ['draw at the swing hook',HTML,VP,'brnd(); '+VP,ID],
  ['draw at the pass partPre',HTML,DP,'brnd(); '+DP,ID],
  ['draw at the pass part',HTML,DQ,'brnd(); '+DQ,ID],
  // ---- Counting to Three ----
  ['One 3%',FXJ,"ct_1_1:[ {on:'out',if:{targetTeam:'enemy',fn:'isOne'},ignoreArmor:R(0.02)} ]","ct_1_1:[ {on:'out',if:{targetTeam:'enemy',fn:'isOne'},ignoreArmor:R(0.03)} ]",'One \\('],
  ['One read as Two',FXJ,"return !!c.auto&&!!b&&b.t===c.tgt&&b.beat===1; }","return !!c.auto&&!!b&&b.t===c.tgt&&b.beat===2; }",'One \\('],
  ['Steady Count 4%',FXJ,"ct_6_1:[ {on:'out',if:{targetTeam:'enemy',fn:'isOne'},more:R(0.03)} ]","ct_6_1:[ {on:'out',if:{targetTeam:'enemy',fn:'isOne'},more:R(0.04)} ]",'One \\('],
  ['Steady Feet 3%',FXJ,"ct_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ]","ct_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.03)} ]",'One \\('],
  ['Swirl on skills',FXJ,"tc_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ]","tc_10_1:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.02)} ]",'One \\('],
  ['Two 7%',FXJ,"ct_2_1:[ {param:'two',add:R(0.06)} ]","ct_2_1:[ {param:'two',add:R(0.07)} ]",'Two \\('],
  ['Partner: any ally',FXJ,"for(const x of [L[i-1],L[i+1]]) if(x&&x.alive&&x.target===t) return true;","for(const x of L) if(x&&x!==u&&x.alive) return true;",'Two \\('],
  ['Partner\'s Count 5%',FXJ,"ct_n3:[  {param:'pc',add:R(0.04)} ]","ct_n3:[  {param:'pc',add:R(0.05)} ]",'Two \\('],
  ['Rocking all wave',FXJ,"    full(A,T,u){ const o=S(T), Pp=T.P; o.first=false;","    full(A,T,u){ const o=S(T), Pp=T.P;",'Two \\('],
  ['Rocking 11%',FXJ,"ct_12_1:[ {param:'rk',add:R(0.10)} ]","ct_12_1:[ {param:'rk',add:R(0.11)} ]",'Two \\('],
  ['Night Market 4%',FXJ,"ct_4_3:[ {param:'nm',add:R(0.03)} ]","ct_4_3:[ {param:'nm',add:R(0.04)} ]",'Two \\('],
  ['Three not forced',FXJ,"ct_3_1:[ {on:'crit',if:{fn:'isThree'},force:true} ]","ct_3_1:[ ]",'Three \\('],
  ['Coil Tight 3%',FXJ,"ct_8_2:[ {on:'out',if:{crit:true,targetTeam:'enemy',fn:'isThree'},critMore:R(0.02)} ]","ct_8_2:[ {on:'out',if:{crit:true,targetTeam:'enemy',fn:'isThree'},critMore:R(0.03)} ]",'Three \\('],
  ['She Still Counts up to 13',FXJ,"    sySc:{max:12,wave:'reset'},","    sySc:{max:13,wave:'reset'},",'Three \\('],
  ['She Still Counts kept',FXJ,"    sySc:{max:12,wave:'reset'},","    sySc:{max:12},",'Three \\('],
  ['Tune in Threes 0.6%',FXJ,"ct_11_1:[ {param:'tit',add:R(0.005)} ]","ct_11_1:[ {param:'tit',add:R(0.006)} ]",'Three \\('],
  ['Long Count: no bite on Four',FXJ,"o.sw={beat,bite:nx===0||two,","o.sw={beat,bite:two,",'Long Count'],
  ['Long Count 50% stronger',FXJ,"tal:two,s:Pp.f2?0.6:(Pp.lc?1.4:1)","tal:two,s:Pp.f2?0.6:(Pp.lc?1.5:1)",'Long Count'],
  ['Fourth Beat 6%',FXJ,"ct_6_3:[ {on:'out',if:{targetTeam:'enemy',fn:'isFour'},more:R(0.05)} ]","ct_6_3:[ {on:'out',if:{targetTeam:'enemy',fn:'isFour'},more:R(0.06)} ]",'Long Count'],
  ['Fang on Two: no Two bite',FXJ,"two=!!Pp.f2&&beat===2;","two=false;",'Fang on Two'],
  ['Fang on Two 70%',FXJ,"tal:two,s:Pp.f2?0.6:","tal:two,s:Pp.f2?0.7:",'Fang on Two'],
  ['a weaker cut over a longer wound',FXJ,"(cut<CUT-1e-9&&(x.mortalT||0)<=(m.until-A.eng().now())+0.05)","(cut<CUT-1e-9)",'Fang on Two'],
  ['Double Fang 4%',FXJ,"ct_6_2:[ {on:'out',if:{targetTeam:'enemy',fn:'isBite'},more:R(0.03)} ]","ct_6_2:[ {on:'out',if:{targetTeam:'enemy',fn:'isBite'},more:R(0.04)} ]",'Fang on Two'],
  ['Sure Bite 0.3 s',FXJ,"ct_10_2:[ {param:'vn.dur',add:R(0.2)} ]","ct_10_2:[ {param:'vn.dur',add:R(0.3)} ]",'Sure Bite'],
  ['Potent 4%',FXJ,"bl_8_1:[ {param:'pot',add:R(0.03)} ]","bl_8_1:[ {param:'pot',add:R(0.04)} ]",'Sure Bite'],
  ['Dry Fangs 6%',FXJ,"bl_12_3:[ {param:'dry',add:R(0.05)} ]","bl_12_3:[ {param:'dry',add:R(0.06)} ]",'Sure Bite'],
  ['Haemotoxin 11%',FXJ,"amt:{pct:0.10*(1+(Pp.hmK||0)),of:'atk'}","amt:{pct:0.11*(1+(Pp.hmK||0)),of:'atk'}",'Sure Bite'],
  ['Bleeding Venom 6%',FXJ,"bl_6_3:[ {param:'hmK',add:R(0.05)} ]","bl_6_3:[ {param:'hmK',add:R(0.06)} ]",'Sure Bite'],
  ['Haemotoxin through armor',FXJ,"dur:D,every:1,refresh:true,color:'#8f3f5c'}","dur:D,every:1,refresh:true,kind:'phys',color:'#8f3f5c'}",'Sure Bite'],
  // ---- Read ----
  ['Read window 5 s',FXJ,"A.setMark(T,u,s,'syA1',{dur:4+(T.P['rd.win']||0)})","A.setMark(T,u,s,'syA1',{dur:5+(T.P['rd.win']||0)})",'Where the Weight'],
  ['Learned Body 0.5 s',FXJ,"ct_5_4:[ {param:'rd.win',add:R(0.4)} ]","ct_5_4:[ {param:'rd.win',add:R(0.5)} ]",'Where the Weight'],
  ['Read by skill hits',FXJ,"{on:'aimed',reqAny:READ,if:{auto:true},do:[{fn:'aim'}]}","{on:'aimed',reqAny:READ,do:[{fn:'aim'}]}",'Where the Weight'],
  ['the Read swing itself misses',FXJ,"if(o.rdHit&&o.rdHit===c.src) return false; ","",'Where the Weight'],
  ['counter 45%',FXJ,"ct_1_4:[ {param:'rd',add:R(0.40)} ]","ct_1_4:[ {param:'rd',add:R(0.45)} ]",'Where the Weight'],
  ['Venomed Answer 9%',FXJ,"ct_n1:[  {on:'out',if:{casting:RD,targetTeam:'enemy'},more:0.08} ]","ct_n1:[  {on:'out',if:{casting:RD,targetTeam:'enemy'},more:0.09} ]",'Where the Weight'],
  ['Venomed Answer: no Toxin',FXJ,"if(rk(T,'ct_n1')&&rk(T,'bl_1_1')&&s.alive) T.fn.toxAdd(A,T,u,s,1,null); },","},",'Where the Weight'],
  ['Read not spent',FXJ,"A.clearMark(u,s,'syRd'); A.setMark(T,u,s,'syRdA',{dur:3});","A.setMark(T,u,s,'syRdA',{dur:3});",'Where the Weight'],
  ['Mistake Made 3 s',FXJ,"ct_9_4:[ {param:'mm',add:2} ]","ct_9_4:[ {param:'mm',add:3} ]",'Where the Weight'],
  ['Leaned In 4%',FXJ,"ct_7_4:[ {param:'dr.ln',add:R(0.03)} ]","ct_7_4:[ {param:'dr.ln',add:R(0.04)} ]",'He Always'],
  ['Leaned In 4 s',FXJ,"A.setMark(T,u,s,'syLn',{dur:3});","A.setMark(T,u,s,'syLn',{dur:4});",'He Always'],
  ['Learned Language 4 s after the miss',FXJ,"A.clearMark(u,s,'syRd'); A.setMark(T,u,s,'syRdA',{dur:3});","A.clearMark(u,s,'syRd'); A.setMark(T,u,s,'syRdA',{dur:4});",'He Always'],
  ['Learned Language 4%',FXJ,"ct_12_3:[ {param:'dr.ll',add:R(0.03)} ]","ct_12_3:[ {param:'dr.ll',add:R(0.04)} ]",'He Always'],
  ['Body Language on every hit',FXJ,"if(r.ct_3_4&&T.s.cur===RD)","if(r.ct_3_4)",'He Always'],
  ['Never Heard a Note 7 s',FXJ,"A.acts(T,u,[{window:'syNn',dur:6}],{u});","A.acts(T,u,[{window:'syNn',dur:7}],{u});",'Never Heard'],
  ['Never Heard a Note every 19 s',FXJ,"o.nnCd=CD_SIG; A.acts","o.nnCd=CD_SIG-1; A.acts",'Never Heard'],
  ['Never Heard a Note: no Read at once',FXJ,"if(o.nnRead&&A.winOn(T,'syNn')){ o.nnRead=false; T.fn.read(A,T,u,s); return; }","",'Never Heard'],
  ['Never Heard a Note: every attacker Read',FXJ,"o.nnRead=false; T.fn.read(A,T,u,s); return; }","T.fn.read(A,T,u,s); return; }",'Never Heard'],
  ['Never Heard a Note: no bite every swing',FXJ,"all:true}; c.amt=1; return; }","all:true}; c.amt=3; return; }",'Never Heard'],
  ['Rhythm of the Pipe 3%',FXJ,"ct_8_1:[ {param:'rp',add:1}, {stat:{aspd:R(0.02)}","ct_8_1:[ {param:'rp',add:1}, {stat:{aspd:R(0.03)}",'Rhythm'],
  ['Rhythm of the Pipe 4 s',FXJ,"[{window:'syRp',dur:3}]","[{window:'syRp',dur:4}]",'Rhythm'],
  ['Sway Away 3 s',FXJ,"[{window:'sySw',dur:2}]","[{window:'sySw',dur:3}]",'Rhythm'],
  ['Sway Away 3%',FXJ,"ct_9_2:[ {param:'swa',add:R(0.02)} ]","ct_9_2:[ {param:'swa',add:R(0.03)} ]",'Rhythm'],
  ['a full count on every beat',FXJ,"if(sw.beat===M||sw.all) T.fn.full(A,T,u);","T.fn.full(A,T,u);",'Rhythm'],
  ['Sidewinder on an enemy facing her',FXJ,"(!!t&&t.target!==u)","(!!t)",'Rhythm'],
  ['Sidewinder 3%',FXJ,"ct_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'flank'},more:R(0.02)} ]","ct_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'flank'},more:R(0.03)} ]",'Rhythm'],
  // ---- Hooded Feint ----
  ['Hood Flare 4%',FXJ,"ct_3_3:[ {on:'out',if:{casting:'counter',targetTeam:'enemy'},more:R(0.03)} ]","ct_3_3:[ {on:'out',if:{casting:'counter',targetTeam:'enemy'},more:R(0.04)} ]",'Hood Flare'],
  ['Coiled Strike 2%',FXJ,"bl_7_3:[ {on:'out',if:{casting:'counter',targetTeam:'enemy'},more:R(0.015)","bl_7_3:[ {on:'out',if:{casting:'counter',targetTeam:'enemy'},more:R(0.02)",'Hood Flare'],
  ['Hood Up: no critical',FXJ,"||(T.s.cur==='counter'&&!!T.P.hu)","",'Hood Flare'],
  ['Hood Up: no bite',FXJ,"o.hu=false; if(t&&t.alive){ T.fn.venom(A,T,u,t,1); T.fn.bite(A,T,u,t,1); }","o.hu=false;",'Hood Flare'],
  ['Flank Step 0.2 s',FXJ,"ct_7_3:[ {on:'cd',skill:'blue',add:R(-0.1)} ]","ct_7_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ]",'Hood Flare'],
  ['Quick Hood 0.2 s',FXJ,"tc_8_2:[ {on:'cd',skill:'blue',add:R(-0.1)} ]","tc_8_2:[ {on:'cd',skill:'blue',add:R(-0.2)} ]",'Hood Flare'],
  // ---- Toxin ----
  ['Venom Sac 0.7%',FXJ,"bl_1_1:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.006)","bl_1_1:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.007)",'Venom Sac'],
  ['two Toxin a bite',FXJ,"if(toxOn(T,o)) T.fn.toxAdd(A,T,u,t,1,'bite'); },","if(toxOn(T,o)) T.fn.toxAdd(A,T,u,t,2,'bite'); },",'Venom Sac'],
  ['Toxin from every basic attack',FXJ,"if(toxOn(T,o)&&t.alive&&A.markOf(u,t,'syV'))","if(toxOn(T,o)&&t.alive)",'Venom Sac'],
  ['Toxin max 6',FXJ,"syTx:{unit:true,max:P('tx.max',5)","syTx:{unit:true,max:P('tx.max',6)",'Venom Sac'],
  ['Lingering Bite 2',FXJ,"bl_12_1:[ {param:'tx.max',add:R(1)} ]","bl_12_1:[ {param:'tx.max',add:R(2)} ]",'Venom Sac'],
  ['Toxin 7 s',FXJ,"dur:P('tx.dur',6)}","dur:P('tx.dur',7)}",'Venom Sac'],
  ['Long Venom 0.5 s',FXJ,"bl_7_1:[ {param:'tx.dur',add:R(0.4)} ]","bl_7_1:[ {param:'tx.dur',add:R(0.5)} ]",'Venom Sac'],
  ['Bitter Blood 3%',FXJ,"bl_10_1:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.5},more:R(0.02)} ]","bl_10_1:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.5},more:R(0.03)} ]",'Venom Sac'],
  ['Thick Venom 3%',FXJ,"bl_2_1:[ {param:'tv',add:R(0.02)} ]","bl_2_1:[ {param:'tv',add:R(0.03)} ]",'Thick Venom'],
  ['Gathered Nothing at 4',FXJ,"const k=(Pp.gn&&n>=5)?0","const k=(Pp.gn&&n>=4)?0",'Thick Venom'],
  ['Numb Limbs 2%',FXJ,"bl_6_1:[ {stat:{move:R(-0.01)}","bl_6_1:[ {stat:{move:R(-0.02)}",'Thick Venom'],
  ['Skin of the Dancer at 4',FXJ,"if(tox(A,T,u,x)>=5) return true;","if(tox(A,T,u,x)>=4) return true;",'Thick Venom'],
  ['Skin of the Dancer 4%',FXJ,"bl_12_4:[ {stat:{mr:R(0.03)}","bl_12_4:[ {stat:{mr:R(0.04)}",'Thick Venom'],
  ['Paralytic 0.9 s',FXJ,"bl_5_2:[ {param:'par',add:0.8} ]","bl_5_2:[ {param:'par',add:0.9} ]",'Paralytic \\('],
  ['Long Paralysis 0.2 s',FXJ,"bl_6_2:[ {param:'par',add:R(0.1)} ]","bl_6_2:[ {param:'par',add:R(0.2)} ]",'Paralytic \\('],
  ['Paralytic: no reset',FXJ,"(o.stL||(o.stL=[])).push([t.uid,t.stunned]); A.ustPut(T,u,t,'syTx',0); },","(o.stL||(o.stL=[])).push([t.uid,t.stunned]); },",'Paralytic \\('],
  ['Paralytic on a stunned enemy',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'syLk')) return;","if(A.markOf(u,t,'syLk')) return;",'Paralytic \\('],
  ['the stun lock 0.3 s',FXJ,"{dur:t.stunned+0.5}","{dur:t.stunned+0.3}",'Paralytic \\('],
  ['Cannot Gather 4 m',FXJ,"enemies(A,u).filter(x=>x!==t&&A.gap(t,x)<3*M));","enemies(A,u).filter(x=>x!==t&&A.gap(t,x)<4*M));",'Cannot Gather'],
  ['Cannot Gather: 5 s without healing',FXJ,"A.setMark(T,u,x,'syNh',{dur:4});","A.setMark(T,u,x,'syNh',{dur:5});",'Cannot Gather'],
  ['Cannot Gather: no full Toxin',FXJ,"A.setMark(T,u,x,'syNh',{dur:4}); A.ustPut(T,u,x,'syTx',mx);","A.setMark(T,u,x,'syNh',{dur:4});",'Cannot Gather'],
  ['Cannot Gather every 15 s',FXJ,"o.cgCd=CD_SIG; o.cgN","o.cgCd=CD_SIG-5; o.cgN",'Cannot Gather'],
  // ---- Shed Skin ----
  ['Shed Skin 5%',FXJ,"bl_1_4:[ {param:'shed',add:R(0.04)} ]","bl_1_4:[ {param:'shed',add:R(0.05)} ]",'Old Skin'],
  ['Shed Skin at 50%',FXJ,"const low=u.hp<0.4*u.maxHp;","const low=u.hp<0.5*u.maxHp;",'Old Skin'],
  ['Shed Skin three times',FXJ,"(o.shN||0)<(Pp.shA?2:1)","(o.shN||0)<(Pp.shA?3:1)",'Old Skin'],
  ['Shed Skin count kept between waves',FXJ,"    wv(A,T,u,c){ const o=S(T); o.shN=0; o.shWas=false;","    wv(A,T,u,c){ const o=S(T); o.shWas=false;",'Old Skin'],
  ['Shed Skin: no cleanse',FXJ,"o.shedN=(o.shedN||0)+1; T.fn.clean(A,T,u,u);","o.shedN=(o.shedN||0)+1;",'Old Skin'],
  ['New Scales 3%',FXJ,"bl_3_4:[ {param:'dr.ns',add:R(0.02)} ]","bl_3_4:[ {param:'dr.ns',add:R(0.03)} ]",'Old Skin'],
  ['New Scales 6 s',FXJ,"[{window:'syNs',dur:5}]","[{window:'syNs',dur:6}]",'Old Skin'],
  ['Sloughing 3%',FXJ,"bl_5_4:[ {param:'slo',add:1}, {stat:{aspd:R(0.02)}","bl_5_4:[ {param:'slo',add:1}, {stat:{aspd:R(0.03)}",'Old Skin'],
  ['Cast Off 3%',FXJ,"bl_7_4:[ {param:'co',add:R(0.02)} ]","bl_7_4:[ {param:'co',add:R(0.03)} ]",'Old Skin'],
  ['Cast Off: no cleanse',FXJ,"if(b){ T.fn.clean(A,T,u,b); E.healUnit","if(b){ E.healUnit",'Old Skin'],
  // ---- Ribbon Fang ----
  ['Ribbon Edge 4%',FXJ,"ct_2_2:[ {on:'out',if:{casting:RF,targetTeam:'enemy'},more:R(0.03)} ]","ct_2_2:[ {on:'out',if:{casting:RF,targetTeam:'enemy'},more:R(0.04)} ]",'Ribbon Edge'],
  ['Ribbon Lash 4%',FXJ,"tc_7_3:[ {on:'out',if:{casting:RF,targetTeam:'enemy'},more:R(0.03)} ]","tc_7_3:[ {on:'out',if:{casting:RF,targetTeam:'enemy'},more:R(0.04)} ]",'Ribbon Edge'],
  ['Bitter Ribbon 4%',FXJ,"bl_2_2:[ {on:'out',if:{casting:RF,targetTeam:'enemy',fn:'venT'},more:R(0.03)} ]","bl_2_2:[ {on:'out',if:{casting:RF,targetTeam:'enemy',fn:'venT'},more:R(0.04)} ]",'Ribbon Edge'],
  ['In Threes every second',FXJ,"return ((S(T).rfN||0)%3)===0;","return ((S(T).rfN||0)%2)===0;",'Ribbon Edge'],
  ['In Threes 6%',FXJ,"ct_7_1:[ {on:'out',if:{casting:RF,targetTeam:'enemy',fn:'rf3'},more:R(0.05)} ]","ct_7_1:[ {on:'out',if:{casting:RF,targetTeam:'enemy',fn:'rf3'},more:R(0.06)} ]",'Ribbon Edge'],
  ['Wider Wound 5%',FXJ,"ct_4_2:[ {on:'dotOut',if:{fn:'rfBleed'},more:R(0.04)} ]","ct_4_2:[ {on:'dotOut',if:{fn:'rfBleed'},more:R(0.05)} ]",'Ribbon Edge'],
  ['Rot in the Wound 4%',FXJ,"bl_3_3:[ {on:'dotOut',if:{fn:'myBleed'},more:R(0.03)} ]","bl_3_3:[ {on:'dotOut',if:{fn:'myBleed'},more:R(0.04)} ]",'Ribbon Edge'],
  ['her wound not made hers',FXJ,"A.acts(T,u,[{tagDots:'syRf',last:true,on:'target'}],c);","",'Ribbon Edge'],
  ['Fang Rhythm 0.2 s',FXJ,"bl_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ]","bl_8_2:[ {on:'cd',skill:'green',add:R(-0.2)} ]",'Ribbon Edge'],
  ['Seeping Cut 40%',FXJ,"chance:R(0.3),do:[{fn:'tox1'}]","chance:R(0.4),do:[{fn:'tox1'}]",'Seeping Cut'],
  ['Venom Ribbon 3 m',FXJ,"if(x!==t&&A.gap(t,x)<2*A.eng().METER()) T.fn.toxAdd","if(x!==t&&A.gap(t,x)<3*A.eng().METER()) T.fn.toxAdd",'Seeping Cut'],
  ['Venom Ribbon off',FXJ,"rupt(A,T,u,c){ const t=c.tgt, n=tox(A,T,u,t); if(!(n>0)) return;","rupt(A,T,u,c){ const t=c.tgt, n=tox(A,T,u,t); return;",'Seeping Cut'],
  // ---- venomed enemies ----
  ['venomed: everyone',FXJ,"const venomed=(A,T,u,x)=>!!x&&x.team!==u.team&&(!!A.markOf(u,x,'syV')||tox(A,T,u,x)>0);","const venomed=(A,T,u,x)=>!!x&&x.team!==u.team;",'venomed enemies'],
  ['Cool Blood 3%',FXJ,"bl_6_4:[ {param:'dr.cb',add:R(0.02)} ]","bl_6_4:[ {param:'dr.cb',add:R(0.03)} ]",'venomed enemies'],
  ['Cold Grace 3%',FXJ,"bl_8_3:[ {on:'out',if:{crit:true,targetTeam:'enemy',fn:'venT'},critMore:R(0.02)} ]","bl_8_3:[ {on:'out',if:{crit:true,targetTeam:'enemy',fn:'venT'},critMore:R(0.03)} ]",'venomed enemies'],
  ['Antivenom 2%',FXJ,"bl_9_2:[ {param:'av',add:R(0.01)} ]","bl_9_2:[ {param:'av',add:R(0.02)} ]",'venomed enemies'],
  ['Venom Hunger 4%',FXJ,"bl_4_3:[ {param:'vh',add:R(0.03)} ]","bl_4_3:[ {param:'vh',add:R(0.04)} ]",'venomed enemies'],
  ['Viper\'s Speed 2%',FXJ,"bl_10_2:[ {stat:{aspd:R(0.015)}","bl_10_2:[ {stat:{aspd:R(0.02)}",'venomed enemies'],
  ['Spreading Venom at 2',FXJ,"if(T.P.spv&&n>=5)","if(T.P.spv&&n>=2)",'Spreading Venom'],
  ['Spreading Venom off',FXJ,"if(b) T.fn.toxAdd(A,T,u,b,n,null); } },","} },",'Spreading Venom'],
  ['Patient Poison 2%',FXJ,"bl_12_2:[ {stat:{atk:R(0.01)},per:'syPp'} ]","bl_12_2:[ {stat:{atk:R(0.02)},per:'syPp'} ]",'Spreading Venom'],
  ['Patient Poison kept between waves',FXJ,"    syPp:{max:5,wave:'reset'}","    syPp:{max:5}",'Spreading Venom'],
  ['Full Glands 0.3%',FXJ,"bl_11_1:[ {stat:{lifesteal:R(0.002)}","bl_11_1:[ {stat:{lifesteal:R(0.003)}",'Spreading Venom'],
  ['Full Glands 4 m',FXJ,"if(f.fg&&gp<3*M) g+=","if(f.fg&&gp<4*M) g+=",'Spreading Venom'],
  ['Precise Fangs 0.5%',FXJ,"if(r.bl_11_3) x+=0.004*r.bl_11_3","if(r.bl_11_3) x+=0.005*r.bl_11_3",'crit-chance group'],
  ['the crit group at 6%',FXJ,"CRIT_CAP=0.05, DODGE_CAP","CRIT_CAP=0.06, DODGE_CAP",'crit-chance group|her caps'],
  ['Last Dancer with allies standing',FXJ,"(Pp.ld&&T.fn.alone(A,T,u))","(Pp.ld)",'crit-chance group'],
  // ---- Crowd ----
  ['Crowd within 6 m',FXJ,"CR_M=5,","CR_M=6,",'Crowd: Thick'],
  ['Thick Crowd 0.5%',FXJ,"tc_1_1:[ {stat:{aspd:R(0.004)},per:'syCr'} ]","tc_1_1:[ {stat:{aspd:R(0.005)},per:'syCr'} ]",'Crowd: Thick'],
  ['Press of Bodies 2%',FXJ,"tc_2_1:[ {param:'dr.pb',add:R(0.01)} ]","tc_2_1:[ {param:'dr.pb',add:R(0.02)} ]",'Crowd: Thick'],
  ['Thick Enough 6 s',FXJ,"o.te=5;","o.te=6;",'Crowd: Thick'],
  ['Packed Tight: no more Crowd',FXJ,"const mx=5+(Pp['cr.max']||0);","const mx=5;",'Crowd: Thick'],
  ['Crowd Energy 2%',FXJ,"tc_4_3:[ {stat:{nrg:R(0.01)},per:'syCr'} ]","tc_4_3:[ {stat:{nrg:R(0.02)},per:'syCr'} ]",'Crowd: Thick'],
  ['Crowd Pleaser 0.4%',FXJ,"tc_11_1:[ {stat:{lifesteal:R(0.003)},per:'syCr'} ]","tc_11_1:[ {stat:{lifesteal:R(0.004)},per:'syCr'} ]",'Crowd: Thick'],
  ['Touch Each of Them at 2',FXJ,"if(c.auto&&Pp.tet&&(o.cr||0)>=3&&t.alive)","if(c.auto&&Pp.tet&&(o.cr||0)>=2&&t.alive)",'Touch Each'],
  ['Touch Each of Them 60%',FXJ,"tc_3_1:[ {param:'tet',add:0.5} ]","tc_3_1:[ {param:'tet',add:0.6} ]",'Touch Each'],
  ['Elbow Room at 1',FXJ,"&&!c.auto&&(o.cr||0)>=2) f(Pp['dr.er']);","&&!c.auto&&(o.cr||0)>=1) f(Pp['dr.er']);",'Touch Each'],
  ['Elbow Room on basic attacks',FXJ,"if(!dot&&Pp['dr.er']&&!c.auto&&","if(!dot&&Pp['dr.er']&&",'Touch Each'],
  ['Never Where It Lands at 1',FXJ,"if(Pp.nwl&&(o.cr||0)>=2) x+=Pp.nwl;","if(Pp.nwl&&(o.cr||0)>=1) x+=Pp.nwl;",'Touch Each'],
  ['Steel Edged 0.4%',FXJ,"if(r.tc_11_3) x+=0.003*r.tc_11_3","if(r.tc_11_3) x+=0.004*r.tc_11_3",'Touch Each'],
  ['Bite of the Crowd up to 12%',FXJ,"Math.min(S(T).cr||0,0.10/(0.008*r))","Math.min(S(T).cr||0,0.12/(0.008*r))",'Touch Each'],
  // ---- Tied ----
  ['Tied 11%',FXJ,"tc_1_4:[ {param:'tied',add:R(0.10)} ]","tc_1_4:[ {param:'tied',add:R(0.11)} ]",'Tied with Ribbon'],
  ['Ribbon Fang does not tie',FXJ,"if(t&&t.alive&&rk(T,'tc_1_4')) T.fn.tie(A,T,u,t);","",'Tied with Ribbon'],
  ['Knotted 0.5 s',FXJ,"tc_3_4:[ {param:'td.dur',add:R(0.4)} ]","tc_3_4:[ {param:'td.dur',add:R(0.5)} ]",'Tied with Ribbon'],
  ['Knot Pull 0.6 m',FXJ,"tc_7_4:[ {param:'kp',add:R(0.5)} ]","tc_7_4:[ {param:'kp',add:R(0.6)} ]",'Tied with Ribbon'],
  ['Snarled 3%',FXJ,"tc_5_4:[ {stat:{move:R(-0.02)}","tc_5_4:[ {stat:{move:R(-0.03)}",'Tied with Ribbon'],
  ['Ribbon Bind 3%',FXJ,"tc_6_4:[ {param:'dr.rb',add:R(0.02)} ]","tc_6_4:[ {param:'dr.rb',add:R(0.03)} ]",'Tied with Ribbon'],
  ['Thread Through 4%',FXJ,"tc_9_2:[ {stat:{aspd:R(0.03)}","tc_9_2:[ {stat:{aspd:R(0.04)}",'Tied with Ribbon'],
  ['Tight Weave 3%',FXJ,"tc_12_3:[ {param:'tw',add:R(0.02)} ]","tc_12_3:[ {param:'tw',add:R(0.03)} ]",'Tied with Ribbon'],
  ['Bound Together on enemies not Tied',FXJ,"within:2,has:'syTd',skip:'target'","within:2,skip:'target'",'Tied with Ribbon'],
  // ---- Serpent's Last Dance ----
  ['Wide Swing 4%',FXJ,"tc_2_2:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.03)} ]","tc_2_2:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.04)} ]",'Wide Swing'],
  ['Weakest for the Last 4%',FXJ,"ct_9_3:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.03)} ]","ct_9_3:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.04)} ]",'Wide Swing'],
  ['Venom Dance 2%',FXJ,"bl_9_3:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.01)","bl_9_3:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.02)",'Wide Swing'],
  ['The Old Tune 7%',FXJ,"more:0.06,per:{fn:'otN'}","more:0.07,per:{fn:'otN'}",'Wide Swing'],
  ['Wider Orbit 0.3 m',FXJ,"tc_4_2:[ {on:'kit',skill:SD,opt:{radius:{addM:R(0.2)}}} ]","tc_4_2:[ {on:'kit',skill:SD,opt:{radius:{addM:R(0.3)}}} ]",'Wide Swing'],
  ['Fifth Turn 6',FXJ,"opt:{spins:{set:5}}","opt:{spins:{set:6}}",'Wide Swing'],
  ['Long Dance on the 4th',FXJ,"pass5(A,T){ return S(T).sdN===5; }","pass5(A,T){ return S(T).sdN===4; }",'Wide Swing'],
  ['Long Dance 5%',FXJ,"tc_6_2:[ {on:'out',if:{casting:SDP,targetTeam:'enemy',fn:'pass5'},more:R(0.04)} ]","tc_6_2:[ {on:'out',if:{casting:SDP,targetTeam:'enemy',fn:'pass5'},more:R(0.05)} ]",'Wide Swing'],
  ['Saved for Last 16%',FXJ,"e.hp<0.15*e.maxHp){ A.acts","e.hp<0.16*e.maxHp){ A.acts",'Saved for Last'],
  ['Saved for Last on bosses',FXJ,"Pp.sfl&&!boss(e)&&","Pp.sfl&&",'Saved for Last'],
  ['Weakest Last 3%',FXJ,"tc_6_3:[ {param:'wl',add:R(0.02)} ]","tc_6_3:[ {param:'wl',add:R(0.03)} ]",'Saved for Last'],
  ['All the Way Round 0.4%',FXJ,"more:R(0.003),per:'syAr'","more:R(0.004),per:'syAr'",'Saved for Last'],
  ['All the Way Round each pass',FXJ,"if(n===1&&Pp.awr)","if(Pp.awr)",'Saved for Last'],
  ['Ribbon Dance off',FXJ,"if(Pp.rdn||o.wtr) T.fn.tie(A,T,u,e);","if(o.wtr) T.fn.tie(A,T,u,e);",'Saved for Last'],
  ['Last Beat every pass',FXJ,"(Pp.lb&&n%3===0)","(Pp.lb&&n%1===0)",'Saved for Last'],
  ['Dance Floor 3%',FXJ,"tc_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.4},more:R(0.02)} ]","tc_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.4},more:R(0.03)} ]",'Saved for Last'],
  ['The Whole Tune Round at 2 Crowd',FXJ,"if(Pp.wtr&&o.cr>=3&&","if(Pp.wtr&&o.cr>=2&&",'Whole Tune'],
  ['The Whole Tune Round: not faster',FXJ,"c.o.dur=(c.o.dur||2.4)*0.5;","c.o.dur=(c.o.dur||2.4)*1;",'Whole Tune'],
  ['The Whole Tune Round: no tie or bite',FXJ,"if((o.wtr&&n===1)||(Pp.lb&&n%3===0))","if((Pp.lb&&n%3===0))",'Whole Tune'],
  ['The Whole Tune Round every 18 s',FXJ,"o.wtCd=CD_SIG; u.energy=100;","o.wtCd=CD_SIG-2; u.energy=100;",'Whole Tune'],
  // ---- movement, controls, her group ----
  ['Swaying 4%',FXJ,"ct_2_3:[ {stat:{move:R(0.03)}} ]","ct_2_3:[ {stat:{move:R(0.04)}} ]",'Swaying'],
  ['Supple 5%',FXJ,"bl_5_1:[ {on:'ccIn',less:R(0.04),upTo:0.20} ]","bl_5_1:[ {on:'ccIn',less:R(0.05),upTo:0.30} ]",'Swaying'],
  ['the slow cap 45%',FXJ,"SLOW_CAP=0.40, CD_SIG","SLOW_CAP=0.45, CD_SIG",'Swaying'],
  ['slows on her not weakened',FXJ,"{on:'tick',reqAny:['ct_12_4','tc_n1'],do:[{weaken:'slowMul'","{on:'tick',reqAny:['zz_0'],do:[{weaken:'slowMul'",'Swaying'],
  ['Scales 2%',FXJ,"ct_4_1:[ {param:'dr.sc',add:R(0.015)} ]","ct_4_1:[ {param:'dr.sc',add:R(0.02)} ]",'Swaying'],
  ['Scales on everyone',FXJ,"if(Pp['dr.sc']&&s&&s===tg) f(Pp['dr.sc']);","if(Pp['dr.sc']&&s) f(Pp['dr.sc']);",'Swaying'],
  ['Nimble Hood 3%',FXJ,"ct_n2:[  {param:'dr.nh',add:R(0.02)} ]","ct_n2:[  {param:'dr.nh',add:R(0.03)} ]",'Swaying'],
  ['Hooded Eyes 3%',FXJ,"ct_6_4:[ {param:'dr.he',add:R(0.02)} ]","ct_6_4:[ {param:'dr.he',add:R(0.03)} ]",'Swaying'],
  ['Hidden in the Throng on melee',FXJ,"if(!dot&&Pp['dr.ht']&&s&&!s.melee)","if(!dot&&Pp['dr.ht']&&s)",'Swaying'],
  ['Through the Gaps 3%',FXJ,"tc_3_3:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.02)} ]","tc_3_3:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.03)} ]",'Swaying'],
  // ---- the caps ----
  ['her group at 45%',FXJ,"DR_FLOOR=0.60, CRIT_CAP","DR_FLOOR=0.55, CRIT_CAP",'her caps'],
  ['talent dodge at 12%',FXJ,"DODGE_CAP=0.10,","DODGE_CAP=0.12,",'her caps'],
  ['the heal budget 1.5%',FXJ,"REGEN=0.012, CR_M","REGEN=0.015, CR_M",'her caps']
];
const SKIP=new Set(['.tmp','.logs','.remote-logs','.git','.base','.bin','node_modules','assets','backups']);
/* the copy: our own walk (fs.cpSync refuses to copy a folder into one of its own subfolders, and the temp folder sits inside the slot) */
function copyTree(src,dst){ fs.mkdirSync(dst,{recursive:true}); for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(src===root&&(SKIP.has(e.name)||e.name.startsWith('.ctl-')||e.name.startsWith('.remote-'))) continue;
    const a=path.join(src,e.name), b=path.join(dst,e.name); if(e.isDirectory()) copyTree(a,b); else if(e.isFile()) fs.copyFileSync(a,b); } }
function found(c){ const [name,file,from]=c, s=fs.readFileSync(path.join(root,file),'utf8'), eol=s.indexOf('\r\n')>=0?'\r\n':'\n'; return s.split(from.replace(/\n/g,eol)).length-1; }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-syc-'));
  try{ copyTree(root,dir); if(fs.existsSync(path.join(root,'node_modules'))) fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'));
    const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), eol=s.indexOf('\r\n')>=0?'\r\n':'\n', a=from.replace(/\n/g,eol), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to.replace(/\n/g,eol)));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-seyla.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1; return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.argv.includes('--check')){ let bad=0; for(const c of C){ const n=found(c); if(n!==1){ bad++; console.log('found '+n+' times: '+c[0]); } } console.log(C.length+' controls, '+bad+' texts not found exactly once'); process.exit(bad?1:0); }
if(process.env.ONLY){ const w=process.env.ONLY.split('|'); for(let k=C.length-1;k>=0;k--) if(!w.some(x=>C[k][0].indexOf(x)>=0)) C.splice(k,1); }
const out=[]; for(const c of C){ const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
