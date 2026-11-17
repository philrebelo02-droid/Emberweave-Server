'use strict';
/* The controls for Ceraline's talent tests (run on PC 2 through tools/remote_test.sh as a plain node script). Each control copies this checkout to a temp
   folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, a primitive or a row of hers broken), runs the named tests of tests/talents-mech-ceraline.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const SITES='every page site';
const C=[
  // ---- the page sites: hook removed (her tests fail) ----
  ['wax hook removed',HTML,"_wxN=(_wxO._tal&&_wxO._tal.on.wax)?TalentFx.wax(_wxO,c):3;","_wxN=3;",SITES+'|Encased Again'],
  ['encase hook removed',HTML,"    if(_wxO._tal&&_wxO._tal.on.wax) TalentFx.encase(_wxO,c,ccDur(dur));",'',SITES+'|Living Tallow:'],
  ['Sealing Wax target hook removed',HTML,"      if(best&&u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,type,best,o)||best;   /* TALENT HOOK skillTgt: whom Sealing Wax pours on */",'',SITES+'|Long Table|Courtesy'],
  ['seal partPre removed',HTML,"if(_sb._tal) TalentFx.partPre(_sb,u,'sealset');",'',SITES+'|Firm Hand'],
  ['seal part removed',HTML,"if(_sb._tal) TalentFx.part(_sb,u,'sealset');",'',SITES],
  ['bell burst partPre removed',HTML,"if(u._tal) TalentFx.partPre(u,m,'bellBurst');",'',SITES+'|Wax Fountain'],
  ['bell burst part removed',HTML,"if(u._tal) TalentFx.part(u,m,'bellBurst');",'',SITES+'|Wax Fountain'],
  ['Final Candle at hook removed',HTML,"      if(u._tal&&u._tal.on.at) TalentFx.at(u,type,_c,o,_sh);",'',SITES+'|Court Sits'],
  ['wax edge partPre removed',HTML,"if(u._tal) TalentFx.partPre(u,e,'fcWax');   /* TALENT HOOK partPre: the wax reaches it */ ",'',SITES+'|her ultimate'],
  ['pour partPre removed',HTML,"_caught.push(e); if(u._tal) TalentFx.partPre(u,e,'fcWax');","_caught.push(e);",SITES],
  ['statue partPre removed',HTML,"if(u._tal) TalentFx.partPre(u,e,'fcEnc');   /* TALENT HOOK partPre: its statue */ ",'',SITES+'|her ultimate'],
  ['effigy partPre removed',HTML,"if(u._tal) TalentFx.partPre(u,e,'fcBurst');   /* TALENT HOOK partPre: its effigy bursts */ ",'',SITES],
  ['effigy part removed',HTML,"dealDamage(u,e,_sh,'#fff0c0','magic'); if(u._tal) TalentFx.part(u,e,'fcBurst');","dealDamage(u,e,_sh,'#fff0c0','magic');",SITES+'|Last Course'],
  ['bindMore wax removed',HTML,"TalentFx.bindMore({ wax:c=>waxOnCaster(c) });","TalentFx.bindMore({});",'Candle Smoke|Late Arrival'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the wax site',HTML,"_wxN=(_wxO._tal&&_wxO._tal.on.wax)?","_wxN=((brnd(),_wxO._tal)&&_wxO._tal.on.wax)?",'no talents'],
  ['draw at the encase site',HTML,"    if(_wxO._tal&&_wxO._tal.on.wax) TalentFx.encase(","    brnd(); if(_wxO._tal&&_wxO._tal.on.wax) TalentFx.encase(",'no talents'],
  ['draw at the Sealing Wax target site',HTML,"      if(best&&u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,type,best,o)||best;   /* TALENT HOOK skillTgt: whom","      brnd(); if(best&&u._tal&&u._tal.on.skillTgt) best=TalentFx.skillTgt(u,type,best,o)||best;   /* TALENT HOOK skillTgt: whom",'no talents'],
  ['draw at the seal site',HTML,"const _sb=u._sealBy; if(_sb._tal)","const _sb=u._sealBy; brnd(); if(_sb._tal)",'no talents'],
  ['draw at the bell burst site',HTML,"const _bx=m.x,_by=m.y; if(u._tal)","const _bx=m.x,_by=m.y; brnd(); if(u._tal)",'no talents'],
  ['draw at the Final Candle at site',HTML,"      if(u._tal&&u._tal.on.at) TalentFx.at(u,type,_c,o,_sh);","      brnd(); if(u._tal&&u._tal.on.at) TalentFx.at(u,type,_c,o,_sh);",'no talents'],
  ['draw at the wax edge site',HTML,"        if(u._tal) TalentFx.partPre(u,e,'fcWax');","        brnd(); if(u._tal) TalentFx.partPre(u,e,'fcWax');",'no talents'],
  ['draw at the pour site',HTML,"_caught.push(e); if(u._tal)","_caught.push(e); brnd(); if(u._tal)",'no talents'],
  ['draw at the statue site',HTML,"_enc.push(e); if(u._tal)","_enc.push(e); brnd(); if(u._tal)",'no talents'],
  ['draw at the effigy site',HTML,"_enc.indexOf(e)<0)return; if(u._tal) TalentFx.partPre(u,e,'fcBurst');","_enc.indexOf(e)<0)return; brnd(); if(u._tal) TalentFx.partPre(u,e,'fcBurst');",'no talents'],
  // ---- the new runtime pieces ----
  ['selector fn ignored',FXJ,"      if(sel.fn&&!T.fn[sel.fn](API,T,u,{u,tgt:x,unit:x})) continue;",'','moving away'],
  ['per fn gives 0',FXJ,"    else if(per.fn) n=+T.fn[per.fn](API,T,u,ctx,per)||0;","    else if(per.fn) n=0;",'Warm Wax:'],
  ['part does not put the skill back',FXJ,"s.cur=(s.ps&&s.ps.length)?s.ps.pop():null; if(T.on.part)","s.cur=null; if(T.on.part)",SITES+'|Wax Fountain'],
  ['encase not lengthened',FXJ,"if(x>d&&c.alive){ c.stunned=Math.max(c.stunned||0,x); c.silencedT=Math.max(c.silencedT||0,x); }",'','Living Tallow:'],
  ['wax count ignored',FXJ,"run(T,o,'wax',ctx); return ctx.amt; }","run(T,o,'wax',ctx); return 3; }",'Encased Again'],
  // ---- her rows ----
  ['Guest of Honour 2% -> 3%',FXJ,"gl_1_1:[ {on:'out',if:{targetHas:'guest'},more:R(0.02)} ],","gl_1_1:[ {on:'out',if:{targetHas:'guest'},more:R(0.03)} ],",'Guest of Honour, Head'],
  ['a Guest each pour',FXJ,"{on:'skillAt',skill:SW,reqAny:GUEST,once:'wave',do:","{on:'skillAt',skill:SW,reqAny:GUEST,do:",'Guest of Honour, Head'],
  ['Next Guest: the nearest',FXJ,"{team:'enemy',order:'high:dmg',n:1,skip:'unit'}","{team:'enemy',n:1,skip:'unit'}",'Guest of Honour, Head'],
  ['Head of the Table 4% -> 5%',FXJ,"gl_2_1:[ {stat:{move:R(-0.04)},to:'holder:guest'} ],","gl_2_1:[ {stat:{move:R(-0.05)},to:'holder:guest'} ],",'Guest of Honour, Head'],
  ['the thinner pour at full time',FXJ,"const d=((c.o&&c.o.coat)||6)/2;","const d=((c.o&&c.o.coat)||6);",'Long Table'],
  ['Thick Tallow 0.1 -> 0.11',FXJ,"gl_1_4:[ {on:'encase',add:R(0.1)} ],","gl_1_4:[ {on:'encase',add:R(0.11)} ],",'Living Tallow:'],
  ['Sealed Lips 0.15 -> 0.2',FXJ,"+0.15*(T.r.gl_10_3||0)","+0.2*(T.r.gl_10_3||0)",'Living Tallow:'],
  ['Wax Lace 2% -> 2.5%',FXJ,"{fn:'selfShield',pct:R(0.02),dur:4}","{fn:'selfShield',pct:R(0.025),dur:4}",'Living Tallow:'],
  ['Encased Again 8 s -> 9 s',FXJ,"{mark:'enc8',on:'target',dur:8}","{mark:'enc8',on:'target',dur:9}",'Encased Again'],
  ['Slow Pour 5% -> 6%',FXJ,"{slowMore:R(0.05),on:'target'}","{slowMore:R(0.06),on:'target'}",'Sealing Wax:'],
  ['Hard Set 0.06 -> 0.07',FXJ,"gl_3_4:[ {on:'sealed',do:[{fn:'ext',by:R(0.06)}]} ],","gl_3_4:[ {on:'sealed',do:[{fn:'ext',by:R(0.07)}]} ],",'Sealing Wax:'],
  ['a stun lengthened only to 2.8 s',FXJ,"const top=(E.ccCap('stunned')||2.8)/(E.ccDur(1)||1); t.stunned=","const top=E.ccCap('stunned'); t.stunned=",'Firm Hand'],
  ['Firm Hand on any attacker',FXJ,"return !!a&&a.alive&&a.team===u.team&&a.hp<0.5*a.maxHp; },","return !!a&&a.alive&&a.team===u.team; },",'Firm Hand'],
  ['Nobody Leaves both ways',FXJ,"if(Math.hypot(x.x-u.x,x.y-u.y)>Math.hypot(p.x-u.x,p.y-u.y)+0.02*M)","if(true)",'moving away'],
  ['Held at Table all the way',FXJ,"(r.wx?Math.min(1,T.P.hat||0):0)","(r.wx?1:0)",'Held at Table'],
  ['Locked Doors every 8 s',FXJ,"A.setMark(T,u,x,'ldX',{dur:10});","A.setMark(T,u,x,'ldX',{dur:8});",'Locked Doors'],
  ['Candle Smoke every 9 - 1 -> 8 - 1',FXJ,"icd:[8,7,6]","icd:[7,6,5]",'Candle Smoke'],
  ['Stay a While 3% -> 4%',FXJ,"{slowMore:R(0.03),on:'target'}","{slowMore:R(0.04),on:'target'}",'her ultimate'],
  ['Long Pour 0.1 -> 0.12',FXJ,"gl_12_2:[ {on:'statue',do:[{fn:'ext',by:R(0.1)}]} ],","gl_12_2:[ {on:'statue',do:[{fn:'ext',by:R(0.12)}]} ],",'her ultimate'],
  ['the signature leash 3 m -> 3.5 m',FXJ,"{fn:'leash',lm:'nle',lr:3}","{fn:'leash',lm:'nle',lr:3.5}",'her ultimate'],
  ['the signature 1 wax a cast',FXJ,"{on:'wax',if:{targetHas:'nle'},do:[{field:'_wax',on:'target',add:1}]}","{on:'wax',if:{targetHas:'nle'},do:[{field:'_wax',on:'target',add:0}]}",'Encased Again'],
  ['no Seconds',FXJ,"if(T.P.banq&&s.cn%4===0){ k='B'; if(T.P.seconds) s.ci=1; }","if(T.P.banq&&s.cn%4===0){ k='B'; }",'Courses:'],
  ['a Banquet every 3rd',FXJ,"if(T.P.banq&&s.cn%4===0){","if(T.P.banq&&s.cn%3===0){",'Courses:'],
  ['the Sweet at most 2 hits',FXJ,"if((T.s.sw||0)>=5) return;","if((T.s.sw||0)>=2) return;",'Courses:'],
  ['Clean Plates twice a Bell',FXJ,"cleanPlates(A,T,u,c){ if(T.s.cp) return; T.s.cp=1;","cleanPlates(A,T,u,c){",'Courses:'],
  ['a Banquet counts 1 for Feast Day',FXJ,"Object.assign({},c,{k:k==='B'?3:1})","Object.assign({},c,{k:1})",'Courses:'],
  ['Hot Wax 2% -> 3%',FXJ,"nc_1_4:[ {param:'scald',add:R(0.02)} ],","nc_1_4:[ {param:'scald',add:R(0.03)} ],",'Scald:'],
  ['Wax Burns ignored',FXJ,"nc_8_4:[ {param:'scald.mr',add:R(0.05)} ],","nc_8_4:[ {param:'scald.mr',add:R(0)} ],",'Scald:'],
  ['Runny Wax not after a burst',FXJ,"s[m.uid]=E.now()+(T.P.runny||0); }","s[m.uid]=E.now(); }",'Scald:'],
  ['Effigy Fire a half',FXJ,"{param:'effigy',add:R(1/3)}","{param:'effigy',add:R(0.5)}",'Flash Scald'],
  ['Boiling Over 2.0 m',FXJ,"within:2.6+(T.P['burst.r']||0),centre:true","within:2.0+(T.P['burst.r']||0),centre:true",'Flash Scald'],
  ['Wax Fountain from thin coats too',FXJ,"if(T.s.bmThin||!c.tgt) return;","if(!c.tgt) return;",'Wax Fountain'],
  ['the Last Course reaches 1.6 m',FXJ,"const R=(2.6+(T.P['burst.r']||0))*M","const R=(1.6+(T.P['burst.r']||0))*M",'Last Course'],
  ['Candlelight 1% -> 1.2%',FXJ,"{on:'in',less:R(0.01),per:'cand'}, {on:'teamIn',if:IN_CL,less:R(0.01),per:'cand'}","{on:'in',less:R(0.012),per:'cand'}, {on:'teamIn',if:IN_CL,less:R(0.012),per:'cand'}",'Candlelight:'],
  ['candles: 4 without Fourth Candle',FXJ,"cand:{max:P('cand.max',3)}","cand:{max:P('cand.max',4)}",'Candlelight:'],
  ['Black Candles ignored',FXJ,"candWave(A,T,u){ if(!T.P.black) A.stSet(T,u,'cand',0);","candWave(A,T,u){ A.stSet(T,u,'cand',0);",'Candlelight:'],
  ['Soft Coat ignored',FXJ,"warmWax(A,T,u){ const d=4+(T.P['ww.dur']||0),","warmWax(A,T,u){ const d=4,",'Warm Wax:'],
  ['Shared Table at full strength',FXJ,"giveWW(A,T,u,L[1],d,T.P.ww2);","giveWW(A,T,u,L[1],d,1);",'Warm Wax:'],
  ['Tallow Shell 50% -> 40%',FXJ,"{param:'ww.sh',add:0.5}","{param:'ww.sh',add:0.4}",'Warm Wax:'],
  ['the 50% control cap gone',FXJ,"c.amt*=Math.max(0.5,k); },","c.amt*=k; },",'shorter controls'],
  ['Blown Out without Snuffer',FXJ,"0.04*(T.r.ho_5_1||0)+(T.P.blow||0)","0.04*(T.r.ho_5_1||0)",'Blown Out'],
  ['Guests\' Bell 3% -> 4%',FXJ,"heal:{pct:P('gb',0.03),of:'tgtMaxHp'}","heal:{pct:P('gb',0.04),of:'tgtMaxHp'}",'Guests'],
  ['the Court saves twice',FXJ,"by:'unit',once:'fight',do:[{fn:'saved'}]}","by:'unit',do:[{fn:'saved'}]}",'Court Sits'],
  ['the Court\'s 2 s: still targetable',FXJ,"x._noTarget=true; x._noTargetT=Math.max(x._noTargetT||0,2); },","},",'Court Sits'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-cec-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-ceraline.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||3), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
