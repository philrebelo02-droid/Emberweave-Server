'use strict';
/* The controls for Bloatus's talent tests (run on PC 2 through tools/remote_test.sh as a plain node script). Each control copies this checkout to a temp
   folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, a primitive or a row of his broken), runs the named tests of tests/talents-mech-bloatus.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const DRAW='brnd();';   // an unguarded seeded draw (the fight's own stream): with no talents it changes every later roll
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['poisQ hook removed',HTML,"if(src&&src._tal&&src._tal.on.poisQ) TalentFx.poisQ(src,_pendingDots[_pendingDots.length-1]);",'','kit|Rot:'],
  ['pois hook removed',HTML,"if(p._talC&&p.t&&p.t.alive) TalentFx.pois(p.src,p.t,p);",'','kit|Rot:'],
  ['spreadR hook removed (the old reach)',HTML,"_cgR=_cgT?TalentFx.spreadR(_cgO,u,2.6*METER):2.6*METER;","_cgR=2.6*METER;",'Contagion and Outbreak|Clean Spread'],
  ['spreadIn removed (centre to centre again)',HTML,"(_cgT?TalentFx.spreadIn(_cgO,u,e,_cgR):Math.hypot(e.x-u.x,e.y-u.y)<_cgR)","(Math.hypot(e.x-u.x,e.y-u.y)<_cgR)",'Contagion and Outbreak|Clean Spread'],
  ['spread hook removed',HTML,"      if(_cgT) TalentFx.spread(_cgO,u);",'','Contagion and Outbreak|Clean Spread|Kingdom Falls'],
  ['breath aim hook removed',HTML,"      if(u._tal&&u._tal.on.skillTgt) aim=TalentFx.skillTgt(u,type,aim,o)||aim;",'','where his skills go'],
  ['breath width hook removed',HTML,"half=(u._tal&&u._tal.on.num)?TalentFx.num(u,'breathW',1.4*METER):1.4*METER;","half=1.4*METER;",'where his skills go'],
  ['Plague Sovereign centre hook removed',HTML,"const _psC=(u._tal&&u._tal.on.skillTgt)?(TalentFx.skillTgt(u,type,u,o)||u):u;","const _psC=u;",'where his skills go'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the poisQ site',HTML,"if(src&&src._tal&&src._tal.on.poisQ) TalentFx.poisQ(","if((brnd(),src)&&src._tal&&src._tal.on.poisQ) TalentFx.poisQ(",'no talents'],
  ['draw at the pois site',HTML,"if(p._talC&&p.t&&p.t.alive) TalentFx.pois(","if((brnd(),p._talC)&&p.t&&p.t.alive) TalentFx.pois(",'no talents'],
  ['draw at the spreadR site',HTML,"_cgT=!!(_cgO&&_cgO._tal&&_cgO._tal.on.spread),","_cgT=!!((brnd(),_cgO)&&_cgO._tal&&_cgO._tal.on.spread),",'no talents'],
  ['draw at the spread site',HTML,"      if(_cgT) TalentFx.spread(_cgO,u);","      "+DRAW+" if(_cgT) TalentFx.spread(_cgO,u);",'no talents'],
  ['draw at the breath aim site',HTML,"      if(u._tal&&u._tal.on.skillTgt) aim=","      "+DRAW+" if(u._tal&&u._tal.on.skillTgt) aim=",'no talents'],
  ['draw at the breath width site',HTML,"half=(u._tal&&u._tal.on.num)?","half=("+DRAW.slice(0,-1)+",u._tal&&u._tal.on.num)?",'no talents'],
  ['draw at the Sovereign centre site',HTML,"const _psC=(u._tal&&u._tal.on.skillTgt)?","const _psC=("+DRAW.slice(0,-1)+",u._tal&&u._tal.on.skillTgt)?",'no talents'],
  // ---- the new runtime pieces ----
  ['poisQ: no origin kept',FXJ,"p.dps=Math.max(0,ctx.amt); p._talC=k;","p.dps=Math.max(0,ctx.amt); p._talC='other';",'kit|where his skills go'],
  ['poisQ: strength change dropped',FXJ,"p.dps=Math.max(0,ctx.amt); p._talC=k;","p._talC=k;",'Contagion and Outbreak|Spit the Brine'],
  ['pois: was always false',FXJ,"if(myDot(src,D[i],true)){ was=true; break; }","if(myDot(src,D[i],true)){ break; }",'Rot:'],
  ['spread: victims not counted',FXJ,"run(T,o,'spread',{u:o,src:o,unit:dead,tgt:dead,k:sp.v.length,vic:sp.v});","run(T,o,'spread',{u:o,src:o,unit:dead,tgt:dead,k:1,vic:[]});",'Contagion and Outbreak|Clean Spread'],
  ['spreadIn: body ignored',FXJ,"return (sp&&sp.body)?(d-E.bodyR(dead)-E.bodyR(e)<r):(d<r); }","return (d<r); }",'Contagion and Outbreak'],
  // ---- his rows ----
  ['Rot 0.6% -> 0.7%',FXJ,"pk_1_2:[ {on:'dotOut',more:R(0.006),per:{ust:'rot'}} ],","pk_1_2:[ {on:'dotOut',more:R(0.007),per:{ust:'rot'}} ],",'Rot:'],
  ['Rot only lasts 6 s with Deep Rot',FXJ,"pk_2_2:[ {param:'rot.dur',add:R(1)} ],","pk_2_2:[ {param:'rot.dur',add:R(0.8)} ],",'Rot:'],
  ['Carrier ignores ties / most',FXJ,"if(v>bv+1e-9){ best=x; bv=v; } }\n      if(best&&cur","if(v>0&&!best){ best=x; bv=v; } }\n      if(best&&cur",'Carrier'],
  ['Plague Bearer gives no Rot',FXJ,"if(!best) return; A.setMark(T,u,best,'car',{unique:true}); rotAtLeast(A,T,u,best,2); },","if(!best) return; A.setMark(T,u,best,'car',{unique:true}); },",'Carrier'],
  ['Spore Burst at 4 Rot',FXJ,"deadRot5(A,T,u,c){ return A.ustGet(T,u,c.unit,'rot')>=5; },","deadRot5(A,T,u,c){ return A.ustGet(T,u,c.unit,'rot')>=4; },",'Spore Burst'],
  ['Kingdom twice a wave',FXJ,"pk_13_2:[ {on:'obGain',if:{stackMin:{ob:10}},once:'wave',","pk_13_2:[ {on:'obGain',if:{stackMin:{ob:10}},",'Kingdom Falls'],
  ['Seeping 5% -> 6%',FXJ,"tp(A,T,u,c,t,h*0.05*(T.r.pk_6_2||0),3,'seep','true');","tp(A,T,u,c,t,h*0.06*(T.r.pk_6_2||0),3,'seep','true');",'Seeping'],
  ['Court: no cap list',FXJ,"cap:P('court.max',6),added:'courtJoin'","added:'courtJoin'",'the Court'],
  ['Command cooldown not kept',FXJ,"if(!A.winOn(T,'cmdO')){ if(A.winOn(T,'cmdCd')) return;","if(!A.winOn(T,'cmdO')){",'Command|without First Petition'],
  ['Standing Order ignored',FXJ,"if((s.cmdN||0)>=1+(T.P['cmd.n']||0)) return;","if((s.cmdN||0)>=1) return;",'Command:'],
  ['Long Root cut at 2.8 s',FXJ,"t.stunned=Math.max(t.stunned,Math.min(top,t.stunned+x)); },","t.stunned=Math.max(t.stunned,Math.min(E.ccCap('stunned'),t.stunned+x)); },",'Swampcall:'],
  ['Sunk to the Neck: no cleanse put back',FXJ,"if(x.dots) for(const d of k.dots) if(d.remaining>=2&&x.dots.indexOf(d)<0) x.dots.push(d); }","}",'Sunk to the Neck'],
  ['Long Live the King every 24 s',FXJ,"{window:'llk',dur:3,cd:25}","{window:'llk',dur:3,cd:24}",'Long Live the King'],
  ['the 50% silence cap gone',FXJ,"k=Math.max(0.50,k*(1-(T.P['ten.sil']||0))*(1-(T.P['ten.sil2']||0)));","k=k*(1-(T.P['ten.sil']||0))*(1-(T.P['ten.sil2']||0));",'Royal Girth'],
  ['Swell 0.02% -> 0.03%',FXJ,"heal:{pct:R(0.0002),of:'maxHp',x:'bloat'}","heal:{pct:R(0.0003),of:'maxHp',x:'bloat'}",'Bloat:'],
  ['Throne Not Abandoned twice a wave',FXJ,"if(s.tnaW===s.wave||s.undy>0) return; s.tnaW=s.wave;","if(s.undy>0) return;",'Throne Not Abandoned'],
  ['Marshwater drunk with Spit the Brine',FXJ,"if(!a.force&&(T.r.km_5_3||(a.all&&T.r.km_5_2))) return;","if(!a.force&&(a.all&&T.r.km_5_2)) return;",'Spit the Brine'],
  ['the signature drinks at single healing',FXJ,"T.fn.drink(A,T,u,c,{all:true,force:true,mul:2});","T.fn.drink(A,T,u,c,{all:true,force:true,mul:1});",'Would Not Leave'],
  ['the signature twice a fight',FXJ,"km_13_2:[ {on:'lethal',once:'fight',","km_13_2:[ {on:'lethal',",'Would Not Leave'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-blc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-bloatus.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||6), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
