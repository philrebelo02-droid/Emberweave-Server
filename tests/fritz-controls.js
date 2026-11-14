'use strict';
/* The controls for Fritz's talent tests (run on PC 2 through tools/remote_test.sh as a plain node script). Each control copies this checkout to a temp
   folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, an engine piece added for him or a row or a function of his broken), runs the named tests of tests/talents-mech-fritz.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['veil hook removed',HTML,"const _svT=(tgt.pass&&tgt.pass.stormdodge&&tgt._tal&&tgt._tal.on.veil)?TalentFx.veil(tgt,src,_isAuto,kind,((tgt._stormT||0)>0||(tgt._castT||0)>0),SKLV.stormdodge(passLv(tgt))):-1;","const _svT=-1;",'Static Veil:'],
  ['veiled hook removed',HTML,"if(_svT>=0) TalentFx.veiled(tgt,src,_isAuto,kind);","",'Static Veil:'],
  ['bolt skillTgt removed',HTML,"if(u._tal&&u._tal.on.skillTgt){ const _bt=TalentFx.skillTgt(u,'stormsurge',foes[k],{list:foes,i,n,sb:_sb,o}), _bk=foes.indexOf(_bt); if(_bk>=0) k=_bk; }","",'Storm Surge'],
  ['boltDelay hook removed',HTML,"delay:(u._tal&&u._tal.on.num)?TalentFx.num(u,'boltDelay',0.3+i*0.12):0.3+i*0.12","delay:0.3+i*0.12",'Storm Surge: Ready'],
  ['bolt landPre removed',HTML,"run:function(){ if(u._tal) TalentFx.landPre(u,e,'stormsurge');","run:function(){",'Charge:'],
  ['bolt land removed (a bolt that struck)',HTML,"dealDamage(u,e,_sb,'#f2e07a','magic'); if(u._tal) TalentFx.land(u,e,'stormsurge');","dealDamage(u,e,_sb,'#f2e07a','magic');",'Charge:'],
  ['chainEnd hook removed',HTML,"if(u._tal&&u._tal.on.chainEnd) TalentFx.chainEnd(u,hit,dmg,dec,o,apB*(o.mul||1.1)*rm);","",'Single Spark'],
  ['chainRun not bound',HTML,"TalentFx.bindMore({ chainRun:","TalentFx.bindMore({ chainRunX:",'Single Spark'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the veil site',HTML,"const _svT=(tgt.pass&&tgt.pass.stormdodge&&","const _svT=(brnd(),tgt.pass&&tgt.pass.stormdodge&&",'no talents'],
  ['draw at the bolt skillTgt site',HTML,"if(u._tal&&u._tal.on.skillTgt){ const _bt=","if((brnd(),u._tal&&u._tal.on.skillTgt)){ const _bt=",'no talents'],
  ['draw at the boltDelay site',HTML,"delay:(u._tal&&u._tal.on.num)?TalentFx.num(u,'boltDelay'","delay:(brnd(),u._tal&&u._tal.on.num)?TalentFx.num(u,'boltDelay'",'no talents'],
  ['draw at the bolt landPre site',HTML,"run:function(){ if(u._tal) TalentFx.landPre(u,e,'stormsurge');","run:function(){ if((brnd(),u._tal)) TalentFx.landPre(u,e,'stormsurge');",'no talents'],
  ['draw at the chainEnd site',HTML,"if(u._tal&&u._tal.on.chainEnd) TalentFx.chainEnd(","if((brnd(),u._tal&&u._tal.on.chainEnd)) TalentFx.chainEnd(",'no talents'],
  // ---- the engine pieces added for him ----
  ['late hit lands at once',FXJ,"T.s.lq.push({t:E.now()+lc.secs,","T.s.lq.push({t:E.now(),",'Late Blows|at 60'],
  ['late hit also lands now',FXJ,"pre:lc.pre,ends:lc.ends}); tgt._talMiss=1;","pre:lc.pre,ends:lc.ends});",'Late Blows'],
  ['late hits kept across a wave',FXJ,"s.wave++; s.lq.length=0;","s.wave++;",'Late Blows'],
  ['veil floor ignored',FXJ,"Math.max(0,Math.min(1,Math.max(ctx.amt,ctx.floor||0)))","Math.max(0,Math.min(1,ctx.amt))",'at 60'],
  ['veil rows never run',FXJ,"if(T.on.veil) run(T,t,'veil',ctx); return ctx.up?","return ctx.up?",'Static Veil:|Storm Surge: Ready'],
  // ---- Livewire ----
  ['Bottled Storm 10% -> 11%',FXJ,"lw_1_1:[ {on:'out',if:{casting:CL,fn:'bsNow'},more:R(0.10)} ]","lw_1_1:[ {on:'out',if:{casting:CL,fn:'bsNow'},more:R(0.11)} ]",'Charge:'],
  ['Residue keeps nothing',FXJ,"A.stSet(T,u,'charge',Math.min(20,T.P.residue||0));","A.stSet(T,u,'charge',0);",'Charge:'],
  ['Storm Battery uncapped a pulse',FXJ,"if((T.s.pn||0)>=(T.r.lw_8_1||0)) return;","",'Storm Battery'],
  ['Thunder Shower strikes give Charge',FXJ,"{on:'hit',reqAny:CHG,if:{casting:SPELLS,","{on:'hit',reqAny:CHG,if:{casting:SKILLS,",'Charge:'],
  ['Conductor window 4 s -> 5 s',FXJ,"A.setMark(T,u,t,mine,{dur:4});","A.setMark(T,u,t,mine,{dur:5});",'Conductors: struck'],
  ['Live Metal ignored',FXJ,"{dur:4+(T.P['cond.dur']||0)}","{dur:4}",'Conductors: struck'],
  ['Spark Gap 4% -> 5%',FXJ,"lw_8_4:[ {stat:{move:R(-0.04)}","lw_8_4:[ {stat:{move:R(-0.05)}",'Conductors: struck'],
  ['Arc Flash 15% -> 16%',FXJ,"{dmg:{pct:R(0.15),of:'apow'},on:{team:'enemy',of:'unit',within:3}","{dmg:{pct:R(0.16),of:'apow'},on:{team:'enemy',of:'unit',within:3}",'Conductors: Grounding'],
  ['Lightning Rod on the least HP',FXJ,"const t=L.slice().sort((a,b)=>b.hp-a.hp)[0];","const t=L.slice().sort((a,b)=>a.hp-b.hp)[0];",'Conductors: Grounding'],
  ['Live Current cap 5 -> 6',FXJ,"if((T.s.lcN||0)>=5) return;","if((T.s.lcN||0)>=6) return;",'Chain Lightning:'],
  ['Extra Link never',FXJ,"if(p>0&&A.eng().rnd()<p) j+=1;","",'Chain Lightning:'],
  ['Single Spark stun 0.5 -> 0.6',FXJ,"do:[{stun:0.5,on:'target'}]","do:[{stun:0.6,on:'target'}]",'Single Spark'],
  ['Forked Chain 3 jumps -> 4',FXJ,"T.s.fj=osq?6:3;","T.s.fj=osq?6:4;",'Single Spark'],
  ['skill hits inside a row seen as a talent\'s',FXJ,"function skillHits(T,f){ const d=T.s.d; T.s.d=0;","function skillHits(T,f){ const d=T.s.d;",'Chain Lightning:|storm.s end'],
  ['Relay heals 15% more',FXJ,"if(t&&c.amt>0) A.eng().healUnit(t,c.amt);","if(t&&c.amt>0) A.eng().healUnit(t,c.amt*1.15);",'Single Spark'],
  ['Called Bolts: highest HP',FXJ,"if(pool.length) c.tgt=pool.slice().sort((a,b)=>a.hp-b.hp)[0];","if(pool.length) c.tgt=pool.slice().sort((a,b)=>b.hp-a.hp)[0];",'Storm Surge: Ready'],
  ['Spare Bolt 30% -> 35%',FXJ,"T.fn.boltSize(A,T,u)*0.30*(T.r.lw_12_1||0)","T.fn.boltSize(A,T,u)*0.35*(T.r.lw_12_1||0)",'Storm Surge: Ready'],
  ['Surge on Cue on every bolt',FXJ,"firstBolt(A,T){ return T.s.bn===1; }","firstBolt(A,T){ return T.s.bn>=1; }",'Storm Surge: Ready'],
  ['Discharge does nothing',FXJ,"lw_9_1:[ {on:'stormEnd',do:[{fn:'discharge'}]} ]","lw_9_1:[ ]",'storm.s end'],
  ['The Open Square 30% -> 35%',FXJ,"const x=0.30*(u.apow||0)","const x=0.35*(u.apow||0)",'storm.s end'],
  ['The Open Square doubles to 2 x jumps',FXJ,"if(osq) j=1+2*(j-1);","if(osq) j=2*j;",'storm.s end'],
  ['High Voltage 2% -> 3%',FXJ,"lw_5_4:[ {on:'out',if:{casting:SKILLS},ignoreMr:R(0.02)} ]","lw_5_4:[ {on:'out',if:{casting:SKILLS},ignoreMr:R(0.03)} ]",'Thunder Shower:'],
  // ---- Half a Heartbeat ----
  ['Hard to Pin on basic attacks too',FXJ,"hh_9_2:[ {on:'veil',if:{auto:false},add:R(0.04)} ]","hh_9_2:[ {on:'veil',add:R(0.04)} ]",'Static Veil:'],
  ['Veil in Motion 0.5 s -> 0.6 s',FXJ,"hh_4_2:[ {param:'vim',add:R(0.5)} ]","hh_4_2:[ {param:'vim',add:R(0.6)} ]",'Static Veil:'],
  ['Between Ticks veil 1 s -> 2 s',FXJ,"{on:'cast',skill:SS,do:[{window:'btv',dur:1}]}","{on:'cast',skill:SS,do:[{window:'btv',dur:2}]}",'Storm Surge: Ready'],
  ['Counter Spark 15% -> 16%',FXJ,"{dmg:{pct:R(0.15),of:'apow'},on:'source',def:'magic'","{dmg:{pct:R(0.16),of:'apow'},on:'source',def:'magic'",'dodges:'],
  ['Shocking Reply every 5 s',FXJ,"by:'source',icd:6,do:[{stun:0.6,on:'source'}]","by:'source',icd:5,do:[{stun:0.6,on:'source'}]",'dodges:'],
  ['Shocking Reply on ranged too',FXJ,"hh_5_3:[ {on:['veiled','dodged'],if:{srcMelee:true},","hh_5_3:[ {on:['veiled','dodged'],",'dodges:'],
  ['Slip Away not once a second',FXJ,"hh_5_4:[ {on:['veiled','dodged'],icd:1,","hh_5_4:[ {on:['veiled','dodged'],",'dodges:'],
  ['Turned Collar clears nothing',FXJ,"unslow(A,T,u){ u.slow=0; u.slowMul=1; },","unslow(A,T,u){ },",'dodges:'],
  ['Slipstream 2 s -> 3 s',FXJ,"do:[{window:'slip',dur:2}]","do:[{window:'slip',dur:3}]",'dodges:'],
  ['Stolen Time per 19',FXJ,"while(s.sg>=20-1e-9){ s.sg-=20;","while(s.sg>=19-1e-9){ s.sg-=19;",'Seconds:'],
  ['Pocketed keeps all',FXJ,"T.s.secK=Math.min(A.stGet(T,'sec'),T.P['sec.keep']||0);","T.s.secK=A.stGet(T,'sec');",'Seconds:'],
  ['Overwound at 39',FXJ,"stackMin:{sec:40}},more:R(0.02)}","stackMin:{sec:39}},more:R(0.02)}",'Seconds:'],
  ['Minute Hand spends 20',FXJ,"A.stSet(T,u,'sec',A.stGet(T,'sec')-30); T.s.mh=c.skill;","A.stSet(T,u,'sec',A.stGet(T,'sec')-20); T.s.mh=c.skill;",'at 60'],
  ['Stopped Clock twice a wave',FXJ,"if(T.P.stopped&&s.scW!==s.wave){","if(T.P.stopped){",'at 60'],
  ['The Watch Ticks every 19 s',FXJ,"s.wtCd=t+20;","s.wtCd=t+19;",'at 60'],
  ['The Watch Ticks stun 1.5 -> 1.6',FXJ,"{stun:1.5,on:{team:'enemy',within:8}}","{stun:1.6,on:{team:'enemy',within:8}}",'at 60'],
  ['The Watch Ticks: no Late Blows',FXJ,"let ok=A.winOn(T,'wtl');","let ok=false;",'at 60'],
  ['Late Blows every 7 s',FXJ,"s.lateAt=t+Math.max(1,8+(T.P['late.cd']||0));","s.lateAt=t+Math.max(1,7+(T.P['late.cd']||0));",'Late Blows'],
  ['Late Blows 6% -> 7%',FXJ,"hh_1_4:[ {param:'late.less',add:R(0.06)} ]","hh_1_4:[ {param:'late.less',add:R(0.07)} ]",'Late Blows'],
  ['Second Look every time',FXJ,"if(!ok&&T.P.second&&s.slW!==s.wave&&","if(!ok&&T.P.second&&",'Late Blows'],
  ['Never There does nothing',FXJ,"neverThere(A,T,u,c){ c.amt=0; c.missed=true; },","neverThere(A,T,u,c){ },",'Late Blows'],
  ['Caught Up without its 2.5 s',FXJ,"hh_8_4:[ {on:'lateLand',icd:2.5,","hh_8_4:[ {on:'lateLand',",'Late Blows'],
  ['Behind Schedule 3 s -> 4 s',FXJ,"{on:'lateQ',do:[{mark:'bsch',on:'source',dur:3}]}","{on:'lateQ',do:[{mark:'bsch',on:'source',dur:4}]}",'Late Blows'],
  ['Shaken Off 6% -> 7%',FXJ,"hh_5_1:[ {on:'ccIn',less:R(0.06)} ]","hh_5_1:[ {on:'ccIn',less:R(0.07)} ]",'Running Late'],
  ['Light Feet while casting too',FXJ,"hh_10_2:[ {stat:{move:R(0.02)},if:{fn:'notBusy'}} ]","hh_10_2:[ {stat:{move:R(0.02)}} ]",'Running Late'],
  // ---- The Storm Courier ----
  ['a Mile every 2 m',FXJ,"if(s.md>=3){ const k=Math.floor(s.md/3+1e-9); s.md-=3*k;","if(s.md>=2){ const k=Math.floor(s.md/2+1e-9); s.md-=2*k;",'Miles: Miles'],
  ['Miles aura on himself too',FXJ,"sc_1_1:[ {stat:{aspd:R(0.002)},per:'miles',to:{team:'ally',within:5,others:true}} ]","sc_1_1:[ {stat:{aspd:R(0.002)},per:'miles',to:{team:'ally',within:5}} ]",'Miles: Miles'],
  ['Familiar Roads keeps all',FXJ,"T.s.miK=Math.min(A.stGet(T,'miles'),T.P['miles.keep']||0);","T.s.miK=A.stGet(T,'miles');",'Miles: Miles'],
  ['Road Worn up to 12%',FXJ,"per:{stack:'miles',div:5},upTo:0.10} ]","per:{stack:'miles',div:5},upTo:0.12} ]",'Miles: Rain'],
  ['Tailwind 0.2% -> 0.3%',FXJ,"period:1,do:[{heal:{pct:R(0.002),of:'tgtMaxHp'},on:{team:'ally',within:5,others:true}}]","period:1,do:[{heal:{pct:R(0.003),of:'tgtMaxHp'},on:{team:'ally',within:5,others:true}}]",'Miles: Rain'],
  ['Parcel to the most energy',FXJ,"const L=byEnergy(allies(A,T,u)); if(!L.length) return; let t=L[0];","const L=byEnergy(allies(A,T,u)); if(!L.length) return; let t=L[L.length-1];",'Parcels: Parcel|Parcels: Express'],
  ['Forwarding Address 30% -> 40%',FXJ,"sc_n3:[ {param:'forward',add:R(0.3)} ]","sc_n3:[ {param:'forward',add:R(0.4)} ]",'Parcels: Express'],
  ['Second Round ignored',FXJ,"T.s.par=T.r.sc_1_3?1+(T.r.sc_2_3||0):0;","T.s.par=T.r.sc_1_3?1:0;",'Parcels: Parcel'],
  ['Charged Parcel gives Charge without Bottled Storm',FXJ,"if(T.r.lw_1_1) A.stSet(T,u,'charge',A.stGet(T,'charge')+1);","A.stSet(T,u,'charge',A.stGet(T,'charge')+1);",'Parcels: Parcel'],
  ['Express 3 s -> 4 s',FXJ,"act.push({mark:'expr',on:'target',dur:3});","act.push({mark:'expr',on:'target',dur:4});",'Parcels: Express'],
  ['Fair Weather sends all five bolts',FXJ,"T.s.fw=t; c.o.n=Math.max(0,(c.o.n||5)-1); },","T.s.fw=t; },",'Storm Surge for his team'],
  ['Rush Order twice a wave',FXJ,"if(lo&&was===false&&s.rw!==s.wave){","if(lo&&was===false){",'Storm Surge for his team'],
  ['Return Address to the most energy',FXJ,"least(A,T,u,c,a){ const t=byEnergy(allies(A,T,u))[0];","least(A,T,u,c,a){ const t=byEnergy(allies(A,T,u)).pop();",'Storm Surge for his team'],
  ['Handed Over to allies who never stood in it',FXJ,"for(const x of allies(A,T,u)) if(inStorm(A,u,x)) m[x.uid]=x; },","for(const x of allies(A,T,u)) m[x.uid]=x; },",'Shared Storm'],
  ['The Last Delivery every storm',FXJ,"sc_13_2:[ {on:'stormEnd',once:'fight',","sc_13_2:[ {on:'stormEnd',",'Shared Storm'],
  ['Rain on Them counts himself',FXJ,"alliesIn(A,T,u){ let n=0; for(const x of allies(A,T,u)) if(inStorm(A,u,x)) n++; return n; },","alliesIn(A,T,u){ let n=1; for(const x of allies(A,T,u)) if(inStorm(A,u,x)) n++; return n; },",'Shared Storm'],
];

const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k));
  for(const k of ['.bin','.base']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-fzc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-fritz.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||2), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
