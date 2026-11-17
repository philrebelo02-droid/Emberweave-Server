'use strict';
/* The controls for Brannus's talent tests (run on PC 2 through tools/remote_test.sh as a plain node script). Each control copies this checkout to a temp
   folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, a primitive or a row of his broken), runs the named tests of tests/talents-mech-brannus.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const DRAW='brnd();';   // an unguarded seeded draw (the fight's own stream): with no talents it changes every later roll
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['absorb hook removed',HTML,"  if(u._tal&&u._tal.on.absorb&&u.shield>0&&a>0) TalentFx.absorb(u,a);",'','Load:|Wounded Pride'],
  ['slam landPre removed',HTML,"        if(u._tal) TalentFx.landPre(u,tg2,'charge');",'','Lionwheel Rampage:'],
  ['slam land removed',HTML,"        if(u._tal) TalentFx.land(u,tg2,'charge');",'','Lionwheel Rampage:'],
  ['path landPre removed',HTML,"if(o.pathHit){ if(u._tal) TalentFx.landPre(u,e,'chargePath'); ","if(o.pathHit){ ",'Lionwheel Rampage:'],
  ['reach hook removed',HTML,"const R=(u._tal&&u._tal.on.num)?TalentFx.num(u,'rimR',o.pierce.range||10*METER):(o.pierce.range||10*METER);","const R=o.pierce.range||10*METER;",'the throw:'],
  ['line slack hook removed',HTML,"const _pw=(u._tal&&u._tal.on.num)?TalentFx.num(u,'rimW',0):0;","const _pw=0;",'the throw:'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the absorb site',HTML,"if(u._tal&&u._tal.on.absorb&&u.shield>0&&a>0) TalentFx.absorb(","if((brnd(),u._tal)&&u._tal.on.absorb&&u.shield>0&&a>0) TalentFx.absorb(",'no talents'],
  ['draw at the slam landPre site',HTML,"        if(u._tal) TalentFx.landPre(u,tg2,'charge');","        "+DRAW+" if(u._tal) TalentFx.landPre(u,tg2,'charge');",'no talents'],
  ['draw at the slam land site',HTML,"        if(u._tal) TalentFx.land(u,tg2,'charge');","        "+DRAW+" if(u._tal) TalentFx.land(u,tg2,'charge');",'no talents'],
  ['draw at the path site',HTML,"if(o.pathHit){ if(u._tal) TalentFx.landPre(","if(o.pathHit){ "+DRAW+" if(u._tal) TalentFx.landPre(",'no talents'],
  ['draw at the reach site',HTML,"const R=(u._tal&&u._tal.on.num)?TalentFx.num(u,'rimR'","const R=(brnd(),u._tal&&u._tal.on.num)?TalentFx.num(u,'rimR'",'no talents'],
  ['draw at the line slack site',HTML,"const _pw=(u._tal&&u._tal.on.num)?","const _pw=(brnd(),u._tal&&u._tal.on.num)?",'no talents'],
  // ---- the new runtime piece (absorb) ----
  ['absorb: amount not cut to the shield',FXJ,"const amt=Math.min(sh,a), broke=a>=sh;","const amt=a, broke=a>=sh;",'Load:'],
  ['absorb: a break never seen',FXJ,"const amt=Math.min(sh,a), broke=a>=sh;","const amt=Math.min(sh,a), broke=false;",'Wounded Pride|Bronze Guard'],
  ['absorb: shieldBreak rows alone do not turn the hook on',FXJ,"    if(T.on.shieldBreak) T.on.absorb=T.on.absorb||[];",'','Wounded Pride'],
  ['absorb: what the shield took not counted',FXJ,"s.shA=(s.shA||0)+amt;",'','his shield'],
  // ---- his rows ----
  ['Cheers last 7 s',FXJ,"cheer:{max:10,dur:P('cheer.dur',8)}","cheer:{max:10,dur:P('cheer.dur',7)}",'Cheers:'],
  ['Play to the Crowd 0.4% -> 0.5%',FXJ,"cc_1_1:[ {stat:{atk:R(0.004)},per:'cheer'} ]","cc_1_1:[ {stat:{atk:R(0.005)},per:'cheer'} ]",'Cheers:'],
  ['Cheers all kept between waves',FXJ,"keep=Math.min(n,Math.floor((T.P['cheer.keep']||0)+1e-9));","keep=n;",'Cheers:'],
  ['Wins reach 5 m',FXJ,"((T.P['win.r']||0)+4)","((T.P['win.r']||0)+5)",'Wins:'],
  ['a Win counted twice',FXJ,"if(!x||x.team===u.team||x._summon||A.markOf(u,x,'won')) return false;","if(!x||x.team===u.team||x._summon) return false;",'Lionwheel|Wins:'],
  ['Pit Veteran 0.05% -> 0.06%',FXJ,"cc_4_2:[ {on:'in',less:R(0.0005),per:'win'} ]","cc_4_2:[ {on:'in',less:R(0.0006),per:'win'} ]",'Wins:'],
  ['Record Book at 19',FXJ,"stackMin:{win:20}},less:R(0.01)","stackMin:{win:19}},less:R(0.01)",'Wins:'],
  ['Hall of Wins every 5',FXJ,"per:{stack:'win',div:10}","per:{stack:'win',div:5}",'Wins:'],
  ['Bated Breath: no limit a wave',FXJ,"if(s.bbN>=1+Math.floor((T.P['bb.n']||0)+1e-9)) return;","",'Bated Breath'],
  ['Bated Breath 0.4% -> 0.5% a Cheer',FXJ,"{on:'in',if:{window:'bb'},less:R(0.004),per:'cheer'}","{on:'in',if:{window:'bb'},less:R(0.005),per:'cheer'}",'Bated Breath'],
  ['Bated Breath: Cheers keep fading',FXJ,"cc_1_4:[ {on:'tick',if:{window:'bb'},do:[{stack:'cheer',touch:true}]},","cc_1_4:[",'Bated Breath'],
  ['Showmanship 0.1% -> 0.2%',FXJ,"cc_4_1:[ {stat:{crit:R(0.001)},per:'cheer'} ]","cc_4_1:[ {stat:{crit:R(0.002)},per:'cheer'} ]",'Champion stats'],
  ['Bloodied Sand below 52%',FXJ,"targetHpBelow:0.50},more:R(0.02)","targetHpBelow:0.52},more:R(0.02)",'Champion stats'],
  ['Spare Them heals once, not per enemy',FXJ,"A.acts(T,u,[{heal:{pct:(T.P['spare.h']||0)*L.length,of:'maxHp'}}],c);","A.acts(T,u,[{heal:{pct:(T.P['spare.h']||0),of:'maxHp'}}],c);",'Arena Lock:'],
  ['Thunderous ignored',FXJ,"if(th>0) x.forcedTargetT+=th;","",'Arena Lock:'],
  ['Eyes on Me 2% -> 3%',FXJ,"lp_n1:[ {on:'in',if:{srcHas:'locked'},less:R(0.02)} ]","lp_n1:[ {on:'in',if:{srcHas:'locked'},less:R(0.03)} ]",'Arena Lock:'],
  ['Long Lock does nothing',FXJ,"lp_4_3:[ {on:'kit',skill:AL,opt:{dur:{add:R(0.2)}}} ]","lp_4_3:[ {on:'kit',skill:AL,opt:{dur:{add:R(0)}}} ]",'Arena Lock:'],
  ['Victory Lap 15 -> 10 energy',FXJ,"u.energy=Math.min(100,(u.energy||0)+15);","u.energy=Math.min(100,(u.energy||0)+10);",'Lionwheel'],
  ['Lionwheel Throw twice on one enemy',FXJ,"if:{casting:LW,targetTeam:'enemy'},by:'target',icd:1.5,do:","if:{casting:LW,targetTeam:'enemy'},do:",'Lionwheel'],
  ['Standing Ovation: no second strike',FXJ,"if((s.ov||s.wds)&&t.alive&&(c.amt||0)>0) A.hurt","if((s.wds)&&t.alive&&(c.amt||0)>0) A.hurt",'Standing Ovation'],
  ['stun lengthening cut at 2.8 s',FXJ,"if(x>0&&(t.stunned||0)>0) t.stunned=Math.max(t.stunned,Math.min(top,t.stunned+x));","if(x>0&&(t.stunned||0)>0) t.stunned=Math.max(t.stunned,Math.min(E.ccCap('stunned'),t.stunned+x));",'Standing Ovation|Wheel Did Not Stop'],
  ['The Forty-Second reaches only 3 m',FXJ,"!(A.gap(d,x)<6*E.METER())","!(A.gap(d,x)<3*E.METER())",'Standing Ovation'],
  ['the stood-up taunt reaches 15 m',FXJ,"{taunt:4,on:{team:'enemy',within:5}}","{taunt:4,on:{team:'enemy',within:15}}",'Stood Up'],
  ['the stood-up signature twice a fight',FXJ,"cc_13_2:[ {on:'lethal',once:'fight',","cc_13_2:[ {on:'lethal',",'Stood Up'],
  ['the 50% silence cap at 80%',FXJ,"k=Math.max(0.50,k*(1-(T.P['ten.sil']||0))*(1-(T.P['ten.sil2']||0))*(1-(T.P['ten.sil3']","k=Math.max(0.20,k*(1-(T.P['ten.sil']||0))*(1-(T.P['ten.sil2']||0))*(1-(T.P['ten.sil3']",'controls on him'],
  ['Iron Lungs 8% -> 9%',FXJ,"{weaken:'slowMul',by:{rk:'bw_12_2',r:0.08}}","{weaken:'slowMul',by:{rk:'bw_12_2',r:0.09}}",'controls on him'],
  ['Whirl lasts 9 s',FXJ,"whirl:{max:6,dur:P('whirl.dur',10)","whirl:{max:6,dur:P('whirl.dur',9)",'Whirl:'],
  ['Ever Turning once per gain, not per Whirl',FXJ,"{heal:{pct:R(0.003),of:'maxHp',k:1}}","{heal:{pct:R(0.003),of:'maxHp'}}",'Whirl:'],
  ['Warm-Up Throw every press',FXJ,"bw_6_1:[ {on:'cd',skill:'green',once:'wave',","bw_6_1:[ {on:'cd',skill:'green',",'Whirl:'],
  ['Rimmed 3.5 s',FXJ,"if:{casting:RB,targetTeam:'enemy'},do:[{mark:'rim',on:'target',dur:P('rim.dur',4)}]}","if:{casting:RB,targetTeam:'enemy'},do:[{mark:'rim',on:'target',dur:P('rim.dur',3.5)}]}",'Rimmed:'],
  ['Wheelhand 1% -> 2%',FXJ,"if:{targetHas:'rim',targetTeam:'enemy'},chance:R(0.01),force:true","if:{targetHas:'rim',targetTeam:'enemy'},chance:R(0.02),force:true",'Rimmed:'],
  ['Line of Spikes on the first strike too',FXJ,"notFirst(A,T){ return (T.s.thN||0)>1; }","notFirst(A,T){ return (T.s.thN||0)>0; }",'the throw:'],
  ['every strike counted as the far target',FXJ,"s.rbFar=isFar(c.o);","s.rbFar=true;",'the throw:'],
  ['Dizzy Whirl 4% -> 5%',FXJ,"bw_11_4:[ {on:'rbEnd',do:[{slow:R(0.04)","bw_11_4:[ {on:'rbEnd',do:[{slow:R(0.05)",'the throw:'],
  ['Pin the Last 0.5 s',FXJ,"{on:'pinGo',do:[{mark:'pinned',on:'target',dur:P('pin.dur',1)}]}","{on:'pinGo',do:[{mark:'pinned',on:'target',dur:P('pin.dur',0.5)}]}",'Pin the Last'],
  ['Rim Shock with no lock',FXJ,"unitHas:'rim'},icd:5,","unitHas:'rim'},icd:0,",'Ring of Bronze'],
  ['Full Whirl at 5',FXJ,"stackMin:{whirl:6}},do:[{dmg:{pct:0.40","stackMin:{whirl:5}},do:[{dmg:{pct:0.40",'Ring of Bronze'],
  ['Ring of Bronze silences every one',FXJ,"if(A.markOf(u,x,'rim')) A.control(T,u,x,'silencedT',1);","A.control(T,u,x,'silencedT',1);",'Ring of Bronze'],
  ['the wheel signature every 0.5 s',FXJ,"{window:'wdsCd',dur:0.01,cd:20}","{window:'wdsCd',dur:0.01,cd:0.5}",'Wheel Did Not Stop'],
  ['Bronze Guard not per enemy',FXJ,"pct:T.P.bg*(1+(T.P['bg.str']||0))*n","pct:T.P.bg*(1+(T.P['bg.str']||0))",'Bronze Guard'],
  ['Bronze Guard up to 5',FXJ,"Math.min(4+Math.floor((T.P['bg.n']||0)+1e-9),L.length)","Math.min(5+Math.floor((T.P['bg.n']||0)+1e-9),L.length)",'Bronze Guard'],
  ['Shield of the Pit never',FXJ,"lp_3_1:[ {on:'shieldBreak',if:{window:'bg'},","lp_3_1:[ {on:'shieldBreak',if:{window:'bgX'},",'Bronze Guard'],
  ['Load cap ignores Heavier Load',FXJ,"load:{max:{pct:P('load.cap',1),of:'dmg'}}","load:{max:{pct:1,of:'dmg'}}",'Load:'],
  ['Load not emptied',FXJ,"c.amt+=ex*dm; A.stSet(T,u,'load',0);","c.amt+=ex*dm;",'Load:'],
  ['Heavy Load ignored',FXJ,"ign=Math.min(1,T.P['load.ign']||0)","ign=0",'Load:'],
  ['Full Load not on the spending hit',FXJ,"c.lfull=full;","",'Load:'],
  ['Store It All not doubled',FXJ,"(T.P['load.k']||0)*(rb?2:1)","(T.P['load.k']||0)*(rb?1:1)",'Store It All'],
  ['Lock and Load not double',FXJ,"return !!x&&s.hitAt===A.eng().now()&&!!A.markOf(u,x,'locked'); }","return false; }",'Store It All'],
  ['Broad Swing does nothing',FXJ,"lp_6_3:[ {param:'spread.r',add:R(0.3)} ]","lp_6_3:[ {param:'spread.r',add:R(0)} ]",'Store It All'],
  ['Wounded Pride kept between waves',FXJ,"wp:{max:5,wave:'reset'}","wp:{max:5}",'Wounded Pride'],
  ['Proud Anger 0.2% -> 0.5%',FXJ,"lp_3_4:[ {stat:{crit:R(0.002)},per:'wp'} ]","lp_3_4:[ {stat:{crit:R(0.005)},per:'wp'} ]",'Wounded Pride'],
  ['Stubborn Pride with no lock',FXJ,"lp_7_4:[ {on:'shielded',if:{stackMin:{wp:5}},icd:5,","lp_7_4:[ {on:'shielded',if:{stackMin:{wp:5}},icd:0,",'Wounded Pride'],
  ['Never Humbled twice a wave',FXJ,"lp_9_4:[ {on:'tick',edge:true,once:'wave',","lp_9_4:[ {on:'tick',edge:true,",'Wounded Pride'],
  ['Bronze Plate never applied',FXJ,"if(b>0) u.shield+=g*b;","",'his shield'],
  ['his own shields count as given',FXJ,"if(!ownW) A.run(T,u,'given',c);","A.run(T,u,'given',c);",'his shield'],
  ['Spiked Shield without a break',FXJ,"brokeNow(A,T){ return T.s.brk!=null&&T.s.brk===A.eng().now(); }","brokeNow(A,T){ return true; }",'his shield'],
  ['Gladiator Armor 6 s',FXJ,"{window:'gla',dur:4}","{window:'gla',dur:6}",'his shield'],
  ['Pride Goes First ignored',FXJ,"const v=1+0.22*(u.passMul||1)+(T.P['pm.more']||0);","const v=1+0.22*(u.passMul||1);",'Momentum'],
  ['Proud Lion starts it',FXJ,"&&u.dmgBuffT>0) T.fn.pmOn(A,T,u);",") T.fn.pmOn(A,T,u);",'Momentum'],
  ['The Crowd Was His with no lock',FXJ,"{window:'crowdCd',dur:0.01,cd:15}","{window:'crowdCd',dur:0.01,cd:0}",'Crowd Was His'],
  ['The Crowd Was His on any Load',FXJ,"if(full&&T.P.crowd)","if(T.P.crowd)",'Crowd Was His'],
  ['Behind the Rim beyond 14 m',FXJ,"bw_n1:[ {on:'in',if:{srcBeyond:4}","bw_n1:[ {on:'in',if:{srcBeyond:14}",'Behind the Rim'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-brc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-brannus.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||6), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
