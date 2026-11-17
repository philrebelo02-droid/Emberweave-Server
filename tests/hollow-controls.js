'use strict';
/* The controls for Hollow's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder (the system temp dir), breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a
   guard made unguarded with a seeded draw, a primitive or a row of his broken), runs the named tests of tests/talents-mech-hollow.test.js in that copy, and expects
   them to FAIL. ONE copy at a time (no parallel child processes); each copy is deleted when its run is done. The checkout itself is never changed.
   Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', DRAW='brnd();';
const BPH="  if(tgt._tal&&tgt._tal.on.bankPre&&tgt.pass&&tgt.pass.notthere&&src&&src.team!==tgt.team&&TalentFx.bankPre(tgt,src,amt,kind,_isAuto)) tgt._ntReady=true;";
const BH="    if(tgt._tal&&tgt._tal.on.bank) TalentFx.bank(tgt,src,amt,kind,_isAuto);";
const HF1="      if(o._talHide&&TalentFx.hideFrom(u,o))continue;";
const HF2="&&!(o._talHide&&TalentFx.hideFrom(u,o))){const d=dist(u,o);";
const STG="  if(tg&&u._tal&&u._tal.on.skillTgt) tg=TalentFx.skillTgt(u,'vanishpoint',tg,o)||tg;";
const FALL="fall=(u._tal&&u._tal.on.num)?TalentFx.num(u,'vpFall',";
const EXEC="const thresh=((u._tal&&u._tal.on.num)?TalentFx.num(u,'vpExec',";
const LP="  if(u._tal) TalentFx.landPre(u,tg,'vanishpoint');", LD="  if(u._tal) TalentFx.land(u,tg,'vanishpoint');";
const BLP="  if(src&&src._tal&&src._tal.on.pass) TalentFx.pass(src,tgt,'bleedstack');";
const RUPN="if(tgt._blStk>=((src&&src._tal&&src._tal.on.num)?TalentFx.num(src,'rupN',";
const PP="    if(src&&src._tal) TalentFx.partPre(src,tgt,'rupture');", PT="    if(src&&src._tal) TalentFx.part(src,tgt,'rupture');";
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['bankPre hook removed',HTML,BPH,'','Intervals|Two Places'],
  ['bank hook removed',HTML,BH,'','Misdirect|Forgotten'],
  ['hideFrom removed (the back-line hunter)',HTML,HF1,'','Forgotten'],
  ['hideFrom removed (every other unit)',HTML,HF2,'){const d=dist(u,o);','Forgotten'],
  ['Vanishing Point target hook removed',HTML,STG,'','Vanishing Point:'],
  ['Vanishing Point fall-off hook removed',HTML,FALL,"fall=(false)?TalentFx.num(u,'vpFall',",'Countersigned in a real chain'],
  ['Vanishing Point HP-line hook removed',HTML,EXEC,"const thresh=((false)?TalentFx.num(u,'vpExec',",'Contract Is Kept'],
  ['Vanishing Point landPre removed',HTML,LP,'','Vanishing Point:'],
  ['Vanishing Point land removed',HTML,LD,'','Vanishing Point:'],
  ['bleed stack pass hook removed',HTML,BLP,'','bleeds made his|Knife Left In'],
  ['rupture threshold hook removed',HTML,RUPN,"if(tgt._blStk>=((false)?TalentFx.num(src,'rupN',",'the rupture'],
  ['rupture partPre removed',HTML,PP,'','the rupture'],
  ['rupture part removed',HTML,PT,'','All the Others|the rupture'],
  ['bound depth missing',HTML,"TalentFx.bindMore({ ntCd:u=>SKLV.notthere(passLv(u)), depth:k=>","TalentFx.bindMore({ ntCd:u=>SKLV.notthere(passLv(u)), depthX:k=>",'the Contract:|Deep Rank'],
  ['bound ntCd missing',HTML,"TalentFx.bindMore({ ntCd:u=>SKLV","TalentFx.bindMore({ ntCdX:u=>SKLV",'Two Places'],
  ['bound skillArea missing',HTML,"  skillArea:x=>{","  skillAreaX:x=>{",'Deep Rank|capped group'],
  ['bound castUlt missing',HTML,"  castUlt:(u,t)=>{","  castUltX:(u,t)=>{",'Contract Is Kept'],
  ['bound bleedStack missing',HTML,"bleedStack:(u,t)=>addBleedStack(","bleedStackX:(u,t)=>addBleedStack(",'All the Others'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at bankPre',HTML,BPH,'  '+DRAW+BPH.slice(1),'no talents'],
  ['draw at bank',HTML,BH,'    '+DRAW+BH.slice(3),'no talents'],
  ['draw at hideFrom (back-line hunter)',HTML,HF1,'      '+DRAW+HF1.slice(5),'no talents'],
  ['draw at hideFrom (every other unit)',HTML,HF2,'&&!(o._talHide&&TalentFx.hideFrom(u,o))&&(brnd()>=0)){const d=dist(u,o);','no talents'],
  ['draw at the strike target',HTML,STG,'  '+DRAW+STG.slice(1),'no talents'],
  ['draw at the fall-off',HTML,FALL,"fall=(brnd()>=0&&u._tal&&u._tal.on.num)?TalentFx.num(u,'vpFall',",'no talents'],
  ['draw at the HP line',HTML,EXEC,"const thresh=((brnd()>=0&&u._tal&&u._tal.on.num)?TalentFx.num(u,'vpExec',",'no talents'],
  ['draw before the strike',HTML,LP,'  '+DRAW+LP.slice(1),'no talents'],
  ['draw after the strike',HTML,LD,'  '+DRAW+LD.slice(1),'no talents'],
  ['draw at the bleed stack',HTML,BLP,'  '+DRAW+BLP.slice(1),'no talents'],
  ['draw at the rupture threshold',HTML,RUPN,"if(tgt._blStk>=((brnd()>=0&&src&&src._tal&&src._tal.on.num)?TalentFx.num(src,'rupN',",'no talents'],
  ['draw before the rupture',HTML,PP,'    '+DRAW+PP.slice(3),'no talents'],
  ['draw after the rupture',HTML,PT,'    '+DRAW+PT.slice(3),'no talents'],
  // ---- the engine pieces ----
  ['bankPre ignores the miss',FXJ,"run(T,t,'bankPre',c); return !!c.miss; }","run(T,t,'bankPre',c); return false; }",'Intervals|Two Places'],
  ['hideFrom never hides',FXJ,"return !!(T&&o.alive&&o._talHide&&markOf(o,u,o._talHide)); }","return false; }",'Forgotten'],
  ['hide never set at attach',FXJ,"    if(M.hide) u._talHide=M.hide;","",'Forgotten'],
  // ---- his rows and caps ----
  ['Contract: the shallowest',FXJ,"else { for(const x of L) if(!b||dep(A,x)>dep(A,b)) b=x; }","else { for(const x of L) if(!b||dep(A,x)<dep(A,b)) b=x; }",'the Contract:'],
  ['Terms of Hire 3%',FXJ,"co_1_1:[ {on:'out',if:{targetHas:'ct'},more:R(0.02)} ],","co_1_1:[ {on:'out',if:{targetHas:'ct'},more:R(0.03)} ],",'the Contract:'],
  ['Short Roster at 3',FXJ,"L.filter(x=>back(A,x)).length<=2","L.filter(x=>back(A,x)).length<=3",'Short Roster'],
  ['Sealed no crit',FXJ,"if(o.seal&&t===o.seal){ o.seal=null; c.force=true; return; }","if(o.seal&&t===o.seal){ o.seal=null; return; }",'Short Roster'],
  ['Reputation up to 4',FXJ,"rep:{max:3},","rep:{max:4},",'Short Roster'],
  ['Contract Closed 16%',FXJ,"do:[{heal:{pct:0.15,of:'maxHp'},on:'self'}]} ],","do:[{heal:{pct:0.16,of:'maxHp'},on:'self'}]} ],",'Short Roster'],
  ['Open Terms 11%',FXJ,"{on:'teamIn',if:{targetHas:'ct',srcIs:'ally'},more:0.10} ],","{on:'teamIn',if:{targetHas:'ct',srcIs:'ally'},more:0.11} ],",'the Contract:'],
  ['Withheld Mercy 11%',FXJ,"co_12_1:[ {on:'teamHeal',if:{unitHas:'ct'},less:R(0.10)} ],","co_12_1:[ {on:'teamHeal',if:{unitHas:'ct'},less:R(0.11)} ],",'the Contract:'],
  ['Night Shift 6%',FXJ,"co_12_4:[ {stat:{nrg:R(0.05)},","co_12_4:[ {stat:{nrg:R(0.06)},",'the Contract:'],
  ['Blood Owed 25%',FXJ,"{on:'out',if:{fn:'owedHit'},more:0.20} ],","{on:'out',if:{fn:'owedHit'},more:0.25} ],",'Blood Owed'],
  ['Dusk each 0.6 s',FXJ,"if(o.dAcc>=0.5-1e-9){ const n=Math.floor(o.dAcc/0.5+1e-9); o.dAcc-=n*0.5;","if(o.dAcc>=0.6-1e-9){ const n=Math.floor(o.dAcc/0.6+1e-9); o.dAcc-=n*0.6;",'Dusk:'],
  ['Dusk max 11',FXJ,"dusk:{max:P('dusk.max',10)},","dusk:{max:P('dusk.max',11)},",'Dusk:'],
  ['Settling Dark without its cap',FXJ,"per:{window:'sd',max:[20,10,20/3,5,4]}}","per:{window:'sd'}}",'Dusk:'],
  ['Second Descent 6',FXJ,"A.acts(T,u,[{stack:'dusk',add:5}],c); o.aa=1;","A.acts(T,u,[{stack:'dusk',add:6}],c); o.aa=1;",'Dusk:'],
  ['Dusk spent by any hit after the first',FXJ,"const armed=o.arm||(o.aa&&c.auto); if(!armed) return; o.arm=0;","const armed=o.arm||(o.aa&&c.auto); if(!armed) return;",'Dusk:'],
  ['Clean Work from an enemy that hit him',FXJ,"{on:'kill',reqAny:CWK,dots:true,if:{targetLacks:'hm'},","{on:'kill',reqAny:CWK,dots:true,",'Clean Work'],
  ['Clean Work up to 6',FXJ,"cw:{max:5,wave:'reset'},","cw:{max:6,wave:'reset'},",'Clean Work'],
  ['Untouched Record whatever hit him',FXJ,"o.ur=o.hitW?0:(T.P['ur.k']||0);","o.ur=(T.P['ur.k']||0);",'Clean Work'],
  ['The Last Line 0.7%',FXJ,"opt:{exec:{add:R(0.006)}}","opt:{exec:{add:R(0.007)}}",'Vanishing Point:'],
  ['Clause of Silence 1.2 s',FXJ,"A.control(T,u,t,'silencedT',1); },","A.control(T,u,t,'silencedT',1.2); },",'Vanishing Point:'],
  ['Countersigned never',FXJ,"csHit(A,T,u,c){ if(c.tgt&&!c.tgt.alive) S(T).cs=1; },","csHit(A,T,u,c){ },",'Countersigned'],
  ['Kept every 19 s',FXJ,"o.kT=E.now()+20; o.kept=h;","o.kT=E.now()+19; o.kept=h;",'Contract Is Kept'],
  ['Kept: a boss 16%',FXJ,"c.amt=0.15*(t.maxHp||0); },","c.amt=0.16*(t.maxHp||0); },",'Contract Is Kept'],
  ['Kept at 25%',FXJ,"if(!h||!(h.hp<0.2*h.maxHp)) return;","if(!h||!(h.hp<0.25*h.maxHp)) return;",'Contract Is Kept'],
  ['Patient Hands 4%',FXJ,"do:[{energy:R(0.33)}]} ],","do:[{energy:R(0.44)}]} ],",'Deep Rank'],
  ['Deep Rank on the front row',FXJ,"const back=(A,x)=>dep(A,x)>=3;","const back=(A,x)=>dep(A,x)<3;",'Deep Rank'],
  ['damage-reduction cap 45%',FXJ,"k*=1-P['dr.do'];\n      c.amt*=Math.max(0.60,k); },","k*=1-P['dr.do'];\n      c.amt*=Math.max(0.55,k); },",'capped group'],
  ['Thin Target on basic attacks too',FXJ,"if(P['dr.tt']&&!c.auto&&A.eng().skillArea","if(P['dr.tt']&&A.eng().skillArea",'Deep Rank'],
  ['Never Recognised with one Forgetter',FXJ,"A.pick(T,u,{team:'enemy',has:'fg'},c).length>=2","A.pick(T,u,{team:'enemy',has:'fg'},c).length>=1",'capped group'],
  ['Unwritten after a hit',FXJ,"if(P['dr.uw']&&!A.markOf(u,s,'ht'))","if(P['dr.uw'])",'capped group'],
  ['crit group 6%',FXJ,"critS(A,T){ const o=S(T); return Math.min(0.05,","critS(A,T){ const o=S(T); return Math.min(0.06,",'crit-chance'],
  ['crit room ignored',FXJ,"p=Math.min(p,Math.max(0,0.05-T.fn.critS(A,T)));","",'crit-chance'],
  ['knives up to 4',FXJ,"kn:{unit:true,max:P('kn.max',3),dur:6}","kn:{unit:true,max:P('kn.max',4),dur:6}",'Knife Left In'],
  ['a knife 7 s',FXJ,"A.ustPut(T,u,t,'kn',v,T.P['kn.fq']?Math.max(6,bleedLeft(u,t)):6); },","A.ustPut(T,u,t,'kn',v,T.P['kn.fq']?Math.max(7,bleedLeft(u,t)):7); },",'Knife Left In'],
  ['Full Quiver: no extra knife',FXJ,"for(const x of H){ const d=A.eng().dist(u,x); if(d<bd){ bd=d; b=x; } } T.fn.knAdd(A,T,u,b,1); }","}",'Knife Left In'],
  ['Every Knife Home 5% cap',FXJ,"{heal:{flat:Math.min(0.04,P['kn.heal']*n)*u.maxHp}","{heal:{flat:Math.min(0.05,P['kn.heal']*n)*u.maxHp}",'Knife Left In'],
  ['Pincushion at 2',FXJ,"if(T.P['kn.pin']&&n>=3&&t.alive)","if(T.P['kn.pin']&&n>=2&&t.alive)",'Knife Left In'],
  ['Fan Then Tear 1.5 s',FXJ,"if(T.r.ec_n2) A.acts(T,u,[{window:'fan',dur:1}],c);","if(T.r.ec_n2) A.acts(T,u,[{window:'fan',dur:1.5}],c);",'Knife Left In'],
  ['Rusted Edge up to 4 knives',FXJ,"per:{ust:'kn',of:'unit',max:3}}","per:{ust:'kn',of:'unit',max:4}}",'Knife Left In'],
  ['Crowd Work up to 1',FXJ,"Math.min(4,o.fanH.length-1)","Math.min(1,o.fanH.length-1)",'Fan Then Tear'],
  ['Wide Fan 4 degrees',FXJ,"opt:{angle:{add:R(5)}}","opt:{angle:{add:R(4)}}",'Fan Then Tear'],
  ['Lingering 0.3 s',FXJ,"{param:'bl.dur',add:R(0.2)}","{param:'bl.dur',add:R(0.3)}",'bleeds made his'],
  ['Quiet Bleeding 5%',FXJ,"{param:'bl.fast',add:R(0.04)}","{param:'bl.fast',add:R(0.05)}",'bleeds made his'],
  ['Takes a Little Back 4%',FXJ,"do:[{heal:{pct:R(0.03),of:'hit'},on:'self'}]} ],","do:[{heal:{pct:R(0.04),of:'hit'},on:'self'}]} ],",'bleeds made his'],
  ['Every One Opens up to 11',FXJ,"eo:{max:10,wave:'reset'},","eo:{max:11,wave:'reset'},",'the rupture'],
  ['Open Season 25% less',FXJ,"{on:'out',if:{casting:'rupture'},less:0.30} ],","{on:'out',if:{casting:'rupture'},less:0.25} ],",'the rupture'],
  ['Narrow Cut on 3',FXJ,".sort((p,q)=>p[1]-q[1]).slice(0,2)",".sort((p,q)=>p[1]-q[1]).slice(0,3)",'the rupture'],
  ['All the Others on the ruptured one too',FXJ,"A.pick(T,u,{team:'enemy',dot:'bl'},c).filter(x=>x!==t0);","A.pick(T,u,{team:'enemy',dot:'bl'},c);",'All the Others'],
  ['All the Others without armor',FXJ,"A.hurt(T,u,x,tk*k*E.defMul(u,x,'phys'),'#8f8fa8','ato');","A.hurt(T,u,x,tk*k,'#8f8fa8','ato');",'All the Others'],
  ['Red Thread 60%',FXJ,"do:[{after:1,do:[{fn:'ato',by:0.5}]}]} ],","do:[{after:1,do:[{fn:'ato',by:0.6}]}]} ],",'All the Others'],
  ['Every Cut at Once skips the knives',FXJ,"const n=A.ustGet(T,u,x,'kn'); if(n>0){ A.ustPut(T,u,x,'kn',0); tot+=T.fn.knDmg(A,T,u,c,x,n,false); } }","}",'Every Cut at Once'],
  ['Every Cut at Once twice',FXJ,"ec_13_2:[ {on:'part',skill:'rupture',icd:20,","ec_13_2:[ {on:'part',skill:'rupture',",'Every Cut at Once'],
  ['shadow shield 9%',FXJ,"cap=(0.08+(P['shs.max']||0))*u.maxHp","cap=(0.09+(P['shs.max']||0))*u.maxHp",'shadow shield'],
  ['shadow shield 6 s',FXJ,"const d=5+(P['shs.dur']||0); u.shield=","const d=6+(P['shs.dur']||0); u.shield=",'shadow shield'],
  ['Thin Shadow 3 s',FXJ,"do:[{slow:R(0.04),dur:2,on:'source'}]} ],","do:[{slow:R(0.04),dur:3,on:'source'}]} ],",'shadow shield'],
  ['Borrowed Dark stays',FXJ,"if(o.bd&&c.tgt&&c.tgt.team!==u.team){ o.bd=0; return true; }","if(o.bd&&c.tgt&&c.tgt.team!==u.team){ return true; }",'shadow shield'],
  ['Misdirect: the whole blow every time',FXJ,"const k=(c.why==='sig')?1:(P['md.k']||0);","const k=1;",'Misdirect:'],
  ['Misdirect without the thrower\'s defence',FXJ,"A.hurt(T,u,x,d*E.defMul(u,x,c.kind||'phys'),'#c9a6ff','misdirect');","A.hurt(T,u,x,d*1.01,'#c9a6ff','misdirect');",'Misdirect:'],
  ['Thrown Back: no break rule',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'lk')) continue;\n    A.control(T,u,t,'stunned',secs); if((t.stunned||0)>0) A.setMark(","if((t.stunned||0)>0) continue;\n    A.control(T,u,t,'stunned',secs); if((t.stunned||0)>0) A.setMark(",'Misdirect:'],
  ['No Reflection every time',FXJ,"if(P['md.heal']&&!(E.now()<(o.nrT||0))){ o.nrT=E.now()+5;","if(P['md.heal']){",'Misdirect:'],
  ['Return to Sender 2%',FXJ,"{param:'md.crit',add:R(0.015)}","{param:'md.crit',add:R(0.02)}",'Misdirect:'],
  ['Forgotten 1.7 s',FXJ,"T.fn.fgOn(A,T,u,s,1.5+(T.P['fg.dur']||0)); },","T.fn.fgOn(A,T,u,s,1.7+(T.P['fg.dur']||0)); },",'Forgotten'],
  ['Lost in the Press 0.4 s',FXJ,"{param:'fg.fan',add:R(0.3)}","{param:'fg.fan',add:R(0.4)}",'Forgotten'],
  ['Interval after 3.5 s',FXJ,"else if(now-o.rdyT>=4-1e-9&&","else if(now-o.rdyT>=3.5-1e-9&&",'Intervals'],
  ['Interval: the passive clock not kept',FXJ,"if(why!=='pass'){ u._ntReady=false; u._ntCd=o.cd0; }","if(why!=='pass'){ u._ntReady=false; T.fn.ntSet(A,T,u); }",'Intervals'],
  ['Interval reduction cap 25%',FXJ,"c.amt*=1-Math.min(0.20,1-(1-(P['dr.bb']||0)*iv)","c.amt*=1-Math.min(0.25,1-(1-(P['dr.bb']||0)*iv)",'Intervals'],
  ['Two Places 40% longer',FXJ,"if(T.P.tp) d*=1.5; u._ntCd=d;","if(T.P.tp) d*=1.4; u._ntCd=d;",'Two Places'],
  ['Sooner 20%',FXJ,"if(T.P.soon) d*=0.75;","if(T.P.soon) d*=0.8;",'Two Places'],
  ['Two Places: one blow',FXJ,"else if(P.tp&&!o.tp2){ o.tp2=1; u._ntReady=true;","else if(false){ o.tp2=1; u._ntReady=true;",'Two Places'],
  ['Knife Screen stays',FXJ,"if(T.P.ks&&A.winOn(T,'ks')){ A.acts(T,u,[{window:'ks',end:true}],c); o.why='ks'; }","if(T.P.ks&&A.winOn(T,'ks')){ o.why='ks'; }",'Two Places'],
  ['Polite up to 11',FXJ,"pol:{max:10,wave:'reset'},","pol:{max:11,wave:'reset'},",'Two Places'],
  ['Quick Return 15%',FXJ,"{fn:'quick',by:R(0.10)}","{fn:'quick',by:R(0.15)}",'Two Places'],
  ['He Was Never There twice',FXJ,"sb_13_2:[ {on:'in',icd:20,","sb_13_2:[ {on:'in',",'Never There'],
  ['He Was Never There within 3 m',FXJ,"for(const x of A.pick(T,u,{team:'enemy',within:4},c)) T.fn.fgOn(A,T,u,x,2);","for(const x of A.pick(T,u,{team:'enemy',within:3},c)) T.fn.fgOn(A,T,u,x,2);",'Never There'],
  ['Calm Head 12%',FXJ,"do:[{weaken:'slowMul',by:R(0.10)}]} ],","do:[{weaken:'slowMul',by:R(0.12)}]} ],",'Unmoved'],
  ['Unmoved 5%',FXJ,"sb_5_1:[ {on:'ccIn',less:R(0.04)} ],","sb_5_1:[ {on:'ccIn',less:R(0.05)} ],",'Unmoved'],
  ['Closed Over 5%',FXJ,"ec_n1:[  {on:'dotIn',less:R(0.04)} ],","ec_n1:[  {on:'dotIn',less:R(0.05)} ],",'bleeds made his'],
  ['Pale Blade 0.6%',FXJ,"sb_12_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{heal:{pct:R(0.005),","sb_12_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{heal:{pct:R(0.006),",'Unmoved'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-hoc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-hollow.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
