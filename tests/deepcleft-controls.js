'use strict';
/* The controls for Deepcleft's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, a primitive or a row of his broken), runs the named tests of tests/talents-mech-deepcleft.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const DRAW='brnd();';
const DIGH="  if(u.pass&&u.pass.digger&&u._tal&&u._tal.on.pass) TalentFx.pass(u,u,'digger');";
const TGTH="      if(n2&&u._tal&&u._tal.on.skillTgt) n2=TalentFx.skillTgt(u,'burrowguard',n2,null)||n2;";
const LPH="        if(u._tal) TalentFx.landPre(u,n2,'burrowguard');";
const LH="        if(u._tal) TalentFx.land(u,n2,'burrowguard');";
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['digger pass hook removed',HTML,DIGH,'','Relentless Digger:|Tallies'],
  ['emerge target hook removed',HTML,TGTH,'','Pop Up Behind|Cave Roof|Up Through'],
  ['emerge landPre removed',HTML,LPH,'','emerge spends|Weight:'],
  ['emerge land removed',HTML,LH,'','emerge spends|Undermined:'],
  ['weakestBack line removed',HTML,"if(typeof TalentFx!=='undefined'&&TalentFx.bindMore) TalentFx.bindMore({ weakestBack:u=>weakestBackEnemy(u) });",'','Pop Up Behind'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the digger site',HTML,DIGH,"  "+DRAW+DIGH.slice(1),'no talents'],
  ['draw at the emerge target site',HTML,TGTH,"      "+DRAW+TGTH.slice(5),'no talents'],
  ['draw before the emerge strike',HTML,LPH,"        "+DRAW+LPH.slice(7),'no talents'],
  ['draw after the emerge strike',HTML,LH,"        "+DRAW+LH.slice(7),'no talents'],
  // ---- his rows and caps ----
  ['Split cap 80% -> 90%',FXJ,"0.8*r*atk(A,T,u,c)","0.9*r*atk(A,T,u,c)",'Seams and the Split'],
  ['Split at 4 Seams',FXJ,"if(nw>=5) A.run(T,u,'split'","if(nw>=4) A.run(T,u,'split'",'Seams and the Split'],
  ['Seams held without the break',FXJ,"function seamsHeld(A,T,u,t){ return !!(T.r.sr_11_2&&A.markOf(u,t,'fc')); }","function seamsHeld(A,T,u,t){ return !!T.r.sr_11_2; }",'Cut the Seam'],
  ['Seams on any basic attack',FXJ,"if:{auto:true,targetHas:'fc'},do:[{fn:'sAdd',by:1}]}","if:{auto:true},do:[{fn:'sAdd',by:1}]}",'Seams and the Split'],
  ['Clean Face keeps the armor break',FXJ,"{on:'kit',skill:FC,opt:{shred:{set:1e-9}}},","",'Clean Face'],
  ['Brittle Seam on any enemy',FXJ,"if((t._shredT||0)>0&&(t._shredPct||0)>1e-6) d*=","d*=",'riders'],
  ['Whole Cliff every 19 s',FXJ,"{on:'split',icd:20,","{on:'split',icd:19,",'Whole Cliff'],
  ['Whole Cliff within 5 m',FXJ,"{team:'enemy',of:'target',within:4,skip:'target'},c)){ if(!x.alive) continue; const c2","{team:'enemy',of:'target',within:5,skip:'target'},c)){ if(!x.alive) continue; const c2",'Whole Cliff'],
  ['Bare Rock 1.5%',FXJ,"sr_6_2:[ {stat:{crit:R(0.01)}","sr_6_2:[ {stat:{crit:R(0.015)}",'Bare Rock'],
  ['Grind without a cap',FXJ,"grind:{unit:true,max:10,dur:5}","grind:{unit:true,max:20,dur:5}",'Grind'],
  ['Lying Wall the least armor',FXJ,"if(!b||(+x.armorRating||0)>(+b.armorRating||0)) b=x; if(b) A.setMark(T,u,b,'lw'","if(!b||(+x.armorRating||0)<(+b.armorRating||0)) b=x; if(b) A.setMark(T,u,b,'lw'",'Lying Wall'],
  ['Weight share cap 25% -> 30%',FXJ,"Math.min(0.25,P['dr.wt']*w)","Math.min(0.30,P['dr.wt']*w)",'Weight:'],
  ['DR group cap 40% -> 45%',FXJ,"A.stGet(T,'shored')>0) k*=1-P['dr.hf'];\n      c.amt*=Math.max(0.60,k); },","A.stGet(T,'shored')>0) k*=1-P['dr.hf'];\n      c.amt*=Math.max(0.55,k); },",'one capped group'],
  ['control cap 50% -> 60%',FXJ,"k=Math.max(0.5,k); const b=c.amt;","k=Math.max(0.4,k); const b=c.amt;",'control on him'],
  ['Weight each 0.6 s',FXJ,"if((s.wacc||0)>=0.5-1e-9){ const n=Math.floor(s.wacc/0.5+1e-9); s.wacc-=n*0.5;","if((s.wacc||0)>=0.6-1e-9){ const n=Math.floor(s.wacc/0.6+1e-9); s.wacc-=n*0.6;",'Weight:'],
  ['Tally each 12%',FXJ,"(s.tl||0)/(0.1*u.maxHp)","(s.tl||0)/(0.12*u.maxHp)",'Tallies'],
  ['Faster in the Dark at 5 Weight',FXJ,"if(P['dig.fast']&&A.stGet(T,'wt')>=6)","if(P['dig.fast']&&A.stGet(T,'wt')>=5)",'Relentless Digger:'],
  ['Loose Gravel cap off',FXJ,"x:{stack:'ews',max:[50,25,50/3,12.5,10]}","x:{stack:'ews'}",'emerge spends'],
  ['Pressure Cracks at 7',FXJ,"if:{stackMin:{ews:8}},do:[{fn:'tst'","if:{stackMin:{ews:7}},do:[{fn:'tst'",'emerge spends'],
  ['Come Up Swinging every 9 s',FXJ,"{on:'hardEnd',icd:10,","{on:'hardEnd',icd:9,",'control on him'],
  ['Stay Down heals 2% a second',FXJ,"{on:'tick',period:0.5,if:{fn:'under'},do:[{heal:{pct:0.005,","{on:'tick',period:0.5,if:{fn:'under'},do:[{heal:{pct:0.01,",'Stay Down'],
  ['Up Through the Floor twice',FXJ,"nd_13_2:[ {on:'in',once:'fight',","nd_13_2:[ {on:'in',",'Up Through'],
  ['Up Through the Floor heals 20%',FXJ,"{heal:{pct:0.16,of:'maxHp'},on:'self'}],c);","{heal:{pct:0.20,of:'maxHp'},on:'self'}],c);",'Up Through'],
  ['Rumble per 20 Tremor',FXJ,"opt:{stun:{add:R(0.1),per:{stack:'qcs',div:10},ccRaw:true}}","opt:{stun:{add:R(0.1),per:{stack:'qcs',div:20},ccRaw:true}}",'Tremor:'],
  ['Tremor max 30 with Long Rumble',FXJ,"trem:{max:P('trem.max',30),wave:'reset'}","trem:{max:30,wave:'reset'}",'Tremor:'],
  ['Shoring reach 4 m',FXJ,"within:3+(T.P['sh.m']||0)},{u}","within:4+(T.P['sh.m']||0)},{u}",'Shoring'],
  ['Hold Fast does nothing',FXJ,"if((x.pullT||0)>0&&x.pullSpeed>0) x.pullSpeed*=(1-k); },","},",'Shoring'],
  ['Cave Roof twice a wave',FXJ,"um_9_4:[ {on:'teamIn',once:'wave',","um_9_4:[ {on:'teamIn',",'Cave Roof'],
  ['Undermined 5 s',FXJ,"const umDur=T=>4+(T.P['um.dur']||0);","const umDur=T=>5+(T.P['um.dur']||0);",'Undermined:'],
  ['Deep Charges 40%',FXJ,"{fn:'deep',by:0.3}","{fn:'deep',by:0.4}",'Undermined:'],
  ['Bring Down the Wall on everyone',FXJ,"if:{casting:QC,cc:['stunned'],talent:false,targetHas:'um'},do:[{fn:'ext',by:0.5}]}","if:{casting:QC,cc:['stunned'],talent:false},do:[{fn:'ext',by:0.5}]}",'Bring Down'],
  ['Collapse Beneath 0.7 s',FXJ,"tstun(A,T,u,c,[c.tgt],0.6)","tstun(A,T,u,c,[c.tgt],0.7)",'Bring Down'],
  ['re-stun three times',FXJ,".filter(x=>A.ustGet(T,u,x,'fgn')<2);",".filter(x=>A.ustGet(T,u,x,'fgn')<3);",'Floor Gives Way'],
  ['Floor Gives Way every 24 s',FXJ,"{on:'kit',skill:QC,icd:25,","{on:'kit',skill:QC,icd:24,",'Floor Gives Way'],
  ['the break rule off (stunned)',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'lk')) continue;","if(A.markOf(u,t,'lk')) continue;",'break rule'],
  ['the break rule 0.5 s -> 0.1 s',FXJ,"{dur:(t.stunned||0)+0.5,longest:true}","{dur:(t.stunned||0)+0.1,longest:true}",'break rule'],
  ['Pop Up Behind ignored',FXJ,"if(T.P.pub&&E.weakestBack)","if(false&&E.weakestBack)",'Pop Up Behind'],
  ['Granite Hide 4 s',FXJ,"{window:'gh',dur:3}","{window:'gh',dur:4}",'Pop Up Behind'],
  ['Second Shake at once',FXJ,"dur:9,while:'stunned',ends:'ssEnd'","dur:0.01,while:'stunned',ends:'ssEnd'",'Bring Down'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-dcc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-deepcleft.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||3), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
