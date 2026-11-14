'use strict';
/* The controls for Calypsa's talent tests (run on PC 2 through tools/remote_test.sh as a plain node script). Each control copies this checkout to a temp
   folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, a primitive or a row of hers broken), runs the named tests of tests/talents-mech-calypsa.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const DRAW='brnd();';   // an unguarded seeded draw (the fight's own stream): with no talents it changes every later roll
const C=[
  // ---- the page sites: hook removed (her tests fail) ----
  ['Ribbon aim hook removed',HTML,"      if(u._tal&&u._tal.on.skillTgt) tg2=TalentFx.skillTgt(u,type,tg2,o)||tg2;",'','Straight Line'],
  ['line hook removed',HTML,"const _lnE=(u._tal&&u._tal.on.line)?TalentFx.line(u,type,o,foes,ux,uy,len,W,_D,_spd):len+24;","const _lnE=len+24;",'real kit|the line:|First Escape'],
  ['Ribbon hit landPre removed',HTML,"if(!e.alive)return; if(u._tal) TalentFx.landPre(u,e,type);","if(!e.alive)return;",'real kit|the line:'],
  ['Ribbon hit land removed',HTML,"dealDamage(u,e,_D,'#5ed0e8'); if(u._tal) TalentFx.land(u,e,type);","dealDamage(u,e,_D,'#5ed0e8');",'the line:|Flow'],
  ['evade hook removed',HTML,"    if(tgt._tal&&tgt._tal.on.evade) TalentFx.evade(tgt,src);",'','Weariness|Carried Water'],
  ['counter landPre removed',HTML,"      if(tgt._tal) TalentFx.landPre(tgt,src,'counter');",'','Still Water|Answers:'],
  ['counter land removed',HTML,"      if(tgt._tal) TalentFx.land(tgt,src,'counter');",'','Answers:|Bright Water|Hold the Flare'],
  ['blade landPre removed',HTML,"      if(tgt._tal) TalentFx.landPre(tgt,src,'blade');",'','real kit'],
  ['blade land removed',HTML,"      if(tgt._tal) TalentFx.land(tgt,src,'blade');",'','Answers:|Exhausted'],
  ['storm landPre removed',HTML,"      if(u._tal) TalentFx.landPre(u,null,'thundershower');",'','the storm:|Break the Wave'],
  ['storm land removed',HTML,"      if(u._tal) TalentFx.land(u,null,'thundershower');",'','Rainbow Rain|Never Seen the Sea'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the Ribbon aim site',HTML,"      if(u._tal&&u._tal.on.skillTgt) tg2=","      "+DRAW+" if(u._tal&&u._tal.on.skillTgt) tg2=",'no talents'],
  ['draw at the line site',HTML,"const _lnE=(u._tal&&u._tal.on.line)?","const _lnE=("+DRAW.slice(0,-1)+",u._tal&&u._tal.on.line)?",'no talents'],
  ['draw at the Ribbon hit (before)',HTML,"if(!e.alive)return; if(u._tal) TalentFx.landPre(u,e,type);","if(!e.alive)return; "+DRAW+" if(u._tal) TalentFx.landPre(u,e,type);",'no talents'],
  ['draw at the Ribbon hit (after)',HTML,"dealDamage(u,e,_D,'#5ed0e8'); if(u._tal) TalentFx.land(u,e,type);","dealDamage(u,e,_D,'#5ed0e8'); "+DRAW+" if(u._tal) TalentFx.land(u,e,type);",'no talents'],
  ['draw at the evade site',HTML,"    if(tgt._tal&&tgt._tal.on.evade) TalentFx.evade(tgt,src);","    "+DRAW+" if(tgt._tal&&tgt._tal.on.evade) TalentFx.evade(tgt,src);",'no talents'],
  ['draw at the counter (before)',HTML,"      if(tgt._tal) TalentFx.landPre(tgt,src,'counter');","      "+DRAW+" if(tgt._tal) TalentFx.landPre(tgt,src,'counter');",'no talents'],
  ['draw at the counter (after)',HTML,"      if(tgt._tal) TalentFx.land(tgt,src,'counter');","      "+DRAW+" if(tgt._tal) TalentFx.land(tgt,src,'counter');",'no talents'],
  ['draw at the blade (before)',HTML,"      if(tgt._tal) TalentFx.landPre(tgt,src,'blade');","      "+DRAW+" if(tgt._tal) TalentFx.landPre(tgt,src,'blade');",'no talents'],
  ['draw at the blade (after)',HTML,"      if(tgt._tal) TalentFx.land(tgt,src,'blade');","      "+DRAW+" if(tgt._tal) TalentFx.land(tgt,src,'blade');",'no talents'],
  ['draw at the storm pulse (before)',HTML,"      if(u._tal) TalentFx.landPre(u,null,'thundershower');","      "+DRAW+" if(u._tal) TalentFx.landPre(u,null,'thundershower');",'no talents'],
  ['draw at the storm pulse (after)',HTML,"      if(u._tal) TalentFx.land(u,null,'thundershower');","      "+DRAW+" if(u._tal) TalentFx.land(u,null,'thundershower');",'no talents'],
  // ---- the new runtime pieces ----
  ['per.fn counts nothing',FXJ,"else if(per.fn) n=+T.fn[per.fn](API,T,u,ctx,per)||0;","else if(per.fn) n=0;",'Answers:|the line:'],
  ['line: not measured again at its new end',FXJ,"if(end!==ln.end){ L=on(end); ln.L=L.map(x=>x[0]); ln.P=L.map(x=>x[1]); ln.end=end; }","",'First Escape'],
  ['land forgets the skill it interrupted',FXJ,"T.s.cur=(L&&L.length)?L.pop():null;","T.s.cur=null;",'real kit'],
  ['miss only ever on the owner',FXJ,"(ctx.tgt||u)._talMiss=1;","u._talMiss=1;",'Bright Show'],
  ['the lines switch ignored',FXJ,"if(M.lines) T.on.line=T.on.line||[];","",'real kit|the line:'],
  // ---- her rows ----
  ['Wear Them Out 2% -> 3%',FXJ,"nb_1_4:[ {stat:{aspd:R(-0.02)}","nb_1_4:[ {stat:{aspd:R(-0.03)}",'Weariness'],
  ['Tired Fins 1 s -> 0.8 s',FXJ,"nb_2_4:[ {param:'wear.dur',add:R(1)} ],","nb_2_4:[ {param:'wear.dur',add:R(0.8)} ],",'Weariness'],
  ['Exhausted twice a wave',FXJ,"nb_7_4:[ {on:'wearFull',by:'target',once:'wave',","nb_7_4:[ {on:'wearFull',by:'target',",'Exhausted'],
  ['Swift Answer cap 3 s -> 4 s',FXJ,"const x=Math.min(3,n*(T.P['ans.cd']||0));","const x=Math.min(4,n*(T.P['ans.cd']||0));",'Answers:'],
  ['Kept Score keeps all',FXJ,"A.stSet(T,u,'ans',Math.min(A.stGet(T,'ans'),T.P['ans.keep']||0));","A.stSet(T,u,'ans',A.stGet(T,'ans'));",'Answers:'],
  ['Patient Answer 0.3% -> 0.4%',FXJ,"nb_6_1:[ {on:'in',less:R(0.003),per:'ans'} ],","nb_6_1:[ {on:'in',less:R(0.004),per:'ans'} ],",'Answers:'],
  ['Still Water counters at 60%',FXJ,"const amt=(u.dmg||0)*(u._evadeMul||1.6)*0.5*","const amt=(u.dmg||0)*(u._evadeMul||1.6)*0.6*",'Still Water'],
  ['Still Water outside the stance',FXJ,"{on:'hurt',if:{window:'fc'},do:[{fn:'swCounter'}]}","{on:'hurt',do:[{fn:'swCounter'}]}",'Still Water'],
  ['Hand\'s Width not written',FXJ,"if(p>0&&(u.drT||0)>0) u.drMul=Math.min(","if(p>0&&(u.drT||0)>9) u.drMul=Math.min(",'Fighting Current:'],
  ['Unbitten never',FXJ,"nb_11_3:[ {param:'fc.low',add:R(0.01)}, {on:'tick',if:{window:'fc',selfHpBelow:0.5}","nb_11_3:[ {param:'fc.low',add:R(0.01)}, {on:'tick',if:{window:'fc',selfHpBelow:0.3}",'Fighting Current:'],
  ['Never Bit First every 19 s',FXJ,"{on:'dodge',if:{fn:'fcDown'},icd:20,","{on:'dodge',if:{fn:'fcDown'},icd:19,",'Never Bit First'],
  ['Never Bit First blades within 7 m',FXJ,"on:{team:'enemy',within:4},def:'magic',tag:'nbf'}","on:{team:'enemy',within:7},def:'magic',tag:'nbf'}",'Never Bit First'],
  ['Into the Next cap 5 -> 6',FXJ,"Math.min(ln.i,5+(T.P['thru.cap']||0))","Math.min(ln.i,6+(T.P['thru.cap']||0))",'Line Breaker'],
  ['Through the Glass on the second',FXJ,"first(A,T){ const ln=T.s.ln; return !!ln&&ln.i===0; },","first(A,T){ const ln=T.s.ln; return !!ln&&ln.i===1; },",'the line:'],
  ['Flow at 3 enemies',FXJ,"cut4(A,T){ const ln=T.s.ln; return !!ln&&ln.n===4; },","cut4(A,T){ const ln=T.s.ln; return !!ln&&ln.n===3; },",'Flow'],
  ['The First Escape every 14 s',FXJ,"{on:'line',if:{fn:'soaked3'},icd:15,","{on:'line',if:{fn:'soaked3'},icd:14,",'First Escape'],
  ['The First Escape at 2 Soaked',FXJ,"if(A.markOf(u,e,'soak')&&++n>=3) return true;","if(A.markOf(u,e,'soak')&&++n>=2) return true;",'First Escape'],
  ['Twin Ribbon 40%',FXJ,"{fn:'echo',share:0.35,lag:0.3}","{fn:'echo',share:0.40,lag:0.3}",'Twin Ribbon'],
  ['Answered in Full at 4',FXJ,"spent5(A,T){ return (T.s.rs||0)>=5; },","spent5(A,T){ return (T.s.rs||0)>=4; },",'Answered in Full'],
  ['Drenched without being Soaked first',FXJ,"{on:'hit',req:'sl_3_1',if:{targetTeam:'enemy',targetHas:'soak'},","{on:'hit',req:'sl_3_1',if:{targetTeam:'enemy'},",'Soaked:'],
  ['Soaked 3 s',FXJ,"do:[{mark:'soak',on:'target',dur:P('soak.dur',4)}]}","do:[{mark:'soak',on:'target',dur:P('soak.dur',3)}]}",'Soaked:'],
  ['Spilled Over loses the overflow',FXJ,"s.spill=(s.spill||0)+(nw-Math.max(100,have));","s.spill=0;",'Carried Water'],
  ['Never Empty up to 15',FXJ,"const keep=Math.min(20,T.P['w.keep']||0);","const keep=Math.min(15,T.P['w.keep']||0);",'Carried Water'],
  ['Brimming at 90 Water',FXJ,"if(have<100-1e-9) return; T.s[k]=true;","if(have<90-1e-9) return; T.s[k]=true;",'Carried Water'],
  ['Ribbon of Water along the first line',FXJ,".find(x=>ln.L.indexOf(x)<0); if(!t) return;",".find(x=>ln.L.indexOf(x)>=0); if(!t) return;",'Brimming'],
  ['Dazzled at 2 strikes',FXJ,"if(n<3&&n+k>=3&&","if(n<2&&n+k>=2&&",'the storm:'],
  ['Break the Wave counts 1 strike',FXJ,"k=T.r.pp_5_3?3:1;","k=1;",'Break the Wave'],
  ['Rainbow Rain 1%',FXJ,"E.healUnit(x,(x.maxHp||0)*0.005);","E.healUnit(x,(x.maxHp||0)*0.01);",'Rainbow Rain'],
  ['Never Seen the Sea every 29 s',FXJ,"T.s.seaCd=now+30;","T.s.seaCd=now+27;",'Never Seen the Sea'],
  ['Bright Show 40%',FXJ,"{on:'in',if:{auto:true,srcHas:'dazz'},chance:0.25,","{on:'in',if:{srcHas:'dazz'},chance:0.25,",'Bright Show'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-cac-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-calypsa.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||6), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
