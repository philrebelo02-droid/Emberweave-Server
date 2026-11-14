'use strict';
/* The controls for Carn's talent tests (run on PC 2 through tools/remote_test.sh as a plain node script). Each control copies this checkout to a temp
   folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, a row or a function of his broken), runs the named tests of tests/talents-mech-carn.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['reckCost hook removed',HTML,"const cost=(u._tal&&u._tal.on.num)?TalentFx.num(u,'reckCost',u.maxHp*(o.selfPct||0.06)):u.maxHp*(o.selfPct||0.06);","const cost=u.maxHp*(o.selfPct||0.06);",'Paid Out:|Reckless Blow:|Installments'],
  ['veinBody hook removed',HTML,"const _vbB=!!(u._tal&&u._tal.on.num)&&TalentFx.num(u,'veinBody',0)>0;","const _vbB=false;",'real kit|his bleeds|Vein Burst:'],
  ['Vein Burst reach: body measure dropped',HTML,"dist(u,e)-(_vbB?bodyR(e):0)<=R","dist(u,e)<=R",'real kit'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the reckCost site',HTML,"const cost=(u._tal&&u._tal.on.num)?","const cost=(brnd(),u._tal&&u._tal.on.num)?",'no talents'],
  ['draw at the veinBody site',HTML,"const _vbB=!!(u._tal&&u._tal.on.num)&&","const _vbB=!!(brnd(),u._tal&&u._tal.on.num)&&",'no talents'],
  // ---- his skills' bleeds as his ----
  ['Crimson Reap\'s bleed not his',FXJ,"{on:'cast',skill:CR,do:[{tagDots:'reap',emit:'reapDot'}]},","",'real kit'],
  // ---- The Price ----
  ['Ledger 0.4% -> 0.5%',FXJ,"pr_1_1:[ {on:'out',more:R(0.004),per:'steps'}","pr_1_1:[ {on:'out',more:R(0.005),per:'steps'}",'Paid Out:'],
  ['Paid Out not capped at his max HP',FXJ,"T.s.paid=Math.min(u.maxHp,(T.s.paid||0)+hp);","T.s.paid=(T.s.paid||0)+hp;",'Paid Out:'],
  ['Paid Out writes the cost, not what it took',FXJ,"c.amt=x; addPaid(A,T,u,c,Math.max(0,Math.min(x,u.hp-1))); },","c.amt=x; addPaid(A,T,u,c,x); },",'Paid Out:'],
  ['All In does not double the cost',FXJ,"x*=1+(P['cost.mul']||0);","",'Reckless Blow:'],
  ['Throw It Anyway deals nothing',FXJ,"if(t&&t.alive) A.hurt(T,u,t,x,'#b03a3a'); }","}",'Reckless Blow:'],
  ['Interest Due twice',FXJ,"pr_6_1:[ {on:'paid10',once:'fight',","pr_6_1:[ {on:'paid10',",'Reckless Blow:'],
  ['Interest Due before the cost',FXJ,"A.acts(T,u,[{later:[{emit:'paid10'}]}],c||{u});","A.run(T,u,'paid10',c||{u});",'Reckless Blow:'],
  ['Nothing Held Back without All In',FXJ,"{on:'crit',req:'pr_5_2',if:{casting:RB}","{on:'crit',if:{casting:RB}",'Reckless Blow:'],
  ['Installments: drained at once',FXJ,"d.rate=d.left/4;","d.rate=d.left*30;",'Installments'],
  ['Installments: drains below 1 HP',FXJ,"const p=Math.max(0,Math.min(x,u.hp-1)); if(p>0){ u.hp-=p;","const p=x; if(p>0){ u.hp-=p;",'Installments'],
  ['Spent Freely adds instead of lifting',FXJ,"if((T.s.paid||0)<want) addPaid(A,T,u,c,want-(T.s.paid||0));","addPaid(A,T,u,c,want);",'across waves'],
  ['Paid Out kept between waves without Never Called Victory',FXJ,"{on:'wave',reqAny:PAID,unless:'pr_11_1',do:[{fn:'paidReset'}]},","",'across waves'],
  ['Arithmetic: a bleed\'s kill not counted',FXJ,"pr_9_2:[ {on:'kill',dots:true,","pr_9_2:[ {on:'kill',",'across waves'],
  ['What It Cost every 24 s',FXJ,"{window:'wic',dur:0.01,cd:25}","{window:'wic',dur:0.01,cd:24}",'What It Cost'],
  ['What It Cost heals all of it',FXJ,"{heal:p*0.25}","{heal:p*0.5}",'What It Cost'],
  ['Hours: Long Watch ignored',FXJ,"period:P('hour.p',5)","period:5",'Hours:'],
  ['Hours kept between waves',FXJ,"hour:{max:P('hour.max',6),wave:'reset'},","hour:{max:P('hour.max',6)},",'Hours:'],
  ['Six Hours Held at 5 Hours',FXJ,"pr_10_4:[ {on:'in',if:{stackMin:{hour:6}}","pr_10_4:[ {on:'in',if:{stackMin:{hour:5}}",'Hours:'],
  ['Crimson Hour on the wrong skill',FXJ,"pr_7_4:[ {on:'hit',if:{casting:CR,","pr_7_4:[ {on:'hit',if:{casting:RB,",'Hours:'],
  ['Marked the Man marks every attacker',FXJ,"{mark:'mtm',on:'source',unique:true}","{mark:'mtm',on:'source'}",'Marked the Man'],
  ['Old Wounds Open uncapped',FXJ,"const k=Math.min(5,Math.floor((1-u.hp/Math.max(1,u.maxHp))*10+1e-9));","const k=Math.floor((1-u.hp/Math.max(1,u.maxHp))*10+1e-9);",'Marked the Man'],
  ['Deep Pockets on basic attacks too',FXJ,"pr_5_1:[ {on:'in',if:{auto:false},less:R(0.015)} ],","pr_5_1:[ {on:'in',less:R(0.015)} ],",'Marked the Man'],
  // ---- Ferrow Crossing ----
  ['Holding at 2 enemies',FXJ,"s.hold=eff>=3||","s.hold=eff>=2||",'Holding:'],
  ['Hold the Crossing counts past 5',FXJ,"Math.max(0,Math.min(5,eff)-2)","Math.max(0,eff-2)",'Holding:'],
  ['Corpse Count while not Holding',FXJ,"{on:'death',if:{who:'enemy',fn:'hold'}","{on:'death',if:{who:'enemy'}",'Holding:'],
  ['Six Hours Standing 0.2% -> 0.3%',FXJ,"fc_4_1:[ {on:'tick',if:{fn:'hold'},period:1,do:[{heal:{pct:R(0.002)","fc_4_1:[ {on:'tick',if:{fn:'hold'},period:1,do:[{heal:{pct:R(0.003)",'Holding:'],
  ['One for the Crossing: Doses count with 1 real enemy',FXJ,"(T.P['dose.hold']&&near>=2)?","(T.P['dose.hold'])?",'Shoulder'],
  ['One for the Crossing: Doses count without Hold the Crossing',FXJ,"{param:'dose.hold',add:1,req:'fc_1_1'}","{param:'dose.hold',add:1}",'Shoulder'],
  ['Nobody Passes slows the one coming at him',FXJ,"if(np&&g<3&&x.target!==u&&","if(np&&g<3&&",'Nobody Passes'],
  ['Red Water in any direction',FXJ,"((x.x-x.px)*(x.x-u.x)+(x.y-x.py)*(x.y-u.y))>1e-9","true",'Nobody Passes'],
  ['Dark Water ignored',FXJ,"if(dw>0) A.setMark(T,u,x,'rcx',{dur:dw,longest:true});","",'Red Current'],
  ['Flood Bank from him too',FXJ,"{on:'teamIn',if:{targetHas:'rc',srcIs:'ally'}","{on:'teamIn',if:{targetHas:'rc'}",'Red Current'],
  ['Long Bleed not applied',FXJ,"fc_4_3:[ {on:'reapDot',","fc_4_3:[ {on:'reapDotX',",'his bleeds'],
  ['Burst Deep 2 s longer',FXJ,"fc_5_3:[ {on:'veinDot',do:[{extendDot:3}]},","fc_5_3:[ {on:'veinDot',do:[{extendDot:2}]},",'his bleeds'],
  ['Gathered In counts one enemy',FXJ,"const n=Math.min(5,L.length);","const n=1;",'Crimson Reap:'],
  ['The Long Pull 2 m',FXJ,"do:[{pull:'target',to:'self',m:1.5,secs:0.3},{mark:'rcx'","do:[{pull:'target',to:'self',m:2,secs:0.3},{mark:'rcx'",'Crimson Reap:'],
  ['Drowned on any death',FXJ,"if:{who:'enemy',unitHas:'rc'},do:[","if:{who:'enemy'},do:[",'Drowned'],
  ['Scarred Ground on every enemy',FXJ,"{on:'teamHeal',if:{who:'enemy',unitWithin:3}","{on:'teamHeal',if:{who:'enemy'}",'Drowned'],
  ['Bleeding Line counts beyond 4 m',FXJ,"if(g<4) b4++;","b4++;",'bleeding enemies'],
  ['Reaping Line at 4',FXJ,"{on:'out',if:{stackMin:{bln:5}},more:R(0.02)}","{on:'out',if:{stackMin:{bln:4}},more:R(0.02)}",'bleeding enemies'],
  ['The Crossing Holds at 4',FXJ,"{on:'tick',if:{stackMin:{bnr:5}}","{on:'tick',if:{stackMin:{bnr:4}}",'bleeding enemies'],
  ['The Crossing Holds every 24 s',FXJ,"{window:'xh',dur:5,cd:25}","{window:'xh',dur:5,cd:24}",'bleeding enemies'],
  ['The Crossing Holds: bleeds 1.5x',FXJ,"{on:'dotOut',if:{targetHas:'xbl'},more:1.0}","{on:'dotOut',if:{targetHas:'xbl'},more:0.5}",'bleeding enemies'],
  // ---- The Bottle ----
  ['Pace not cleared by a stun',FXJ,"if(((u.stunned||0)>0||(u.fearT||0)>0)&&!A.winOn(T,'fu')){","if(false){",'Pace:'],
  ['Never Pause ignored',FXJ,"now(A)-(s.lastAtk||0)<2.5+(T.P['pace.wait']||0)","now(A)-(s.lastAtk||0)<2.5",'Pace:'],
  ['Quick Feet adds nothing',FXJ,"do:[Object.assign({stack:'pace',add:R(1)},P10)]} ],","do:[Object.assign({stack:'pace',add:R(0)},P10)]} ],",'Pace:'],
  ['Chain of Blows holds 1',FXJ,"cob:{max:5,wave:'reset'},","cob:{max:1,wave:'reset'},",'Pace:'],
  ['the 30% tenacity cap gone',FXJ,"c.amt*=1-Math.min(0.30,1-(1-a)*(1-b));","c.amt*=(1-a)*(1-b);",'Keep Moving'],
  ['Follow Through: no swing at once',FXJ,"u.atkCd=0; T.s.ft=true;","T.s.ft=true;",'Follow Through'],
  ['No Breath Between on every swing after',FXJ,"ftDone(A,T){ T.s.ft=false; },","ftDone(A,T){ },",'Follow Through'],
  ['Swing Through every 2nd',FXJ,"every:3,do:[{dmg:{pct:R(0.1),of:'hit'}","every:2,do:[{dmg:{pct:R(0.1),of:'hit'}",'Follow Through'],
  ['Doses past their max',FXJ,"if(ds.length<mx) ds.push(end);","ds.push(end);",'Doses: Trench'],
  ['Iron Stomach 0.04% -> 0.03%',FXJ,"{param:'dose.cost',add:R(-0.0004)}","{param:'dose.cost',add:R(-0.0003)}",'Doses: Trench'],
  ['Stimulant 1% -> 2%',FXJ,"bt_11_3:[ {stat:{cdRate:R(0.01)}","bt_11_3:[ {stat:{cdRate:R(0.02)}",'Doses: Trench'],
  ['Doses run out together',FXJ,"for(let i=0;i<ds.length;i++) if(t>=ds[i]-1e-9){ ds.splice(i--,1); out++; }","if(ds.length&&t>=Math.max(...ds)-1e-9){ out=ds.length; ds.length=0; }",'Doses run out'],
  ['Dose cost below 1 HP',FXJ,"u.hp=Math.max(1,u.hp-u.maxHp*per*n*(c.dt||0));","u.hp=u.hp-u.maxHp*per*n*(c.dt||0);",'Doses run out'],
  ['the fourth Dose not free',FXJ,"const n=T.P['dose.free4']?Math.min(3,ds.length):ds.length,","const n=ds.length,",'Doses run out'],
  ['Sip Slowly free at any HP',FXJ,"(T.P['dose.sip']&&u.hp>0.5*u.maxHp)","(T.P['dose.sip'])",'Doses run out'],
  ['Bottle Kept: full time again',FXJ,"T.s.dsK.map(r=>t+r)","T.s.dsK.map(r=>t+6)",'Doses run out'],
  ['Doses kept between waves without Bottle Kept',FXJ,"T.s.ds=(T.P['dose.keep']&&T.s.dsK)?T.s.dsK.map(r=>t+r):[];","T.s.ds=T.s.ds||[];",'Doses run out'],
  ['Fast and Unwilling: no Unstoppable',FXJ,"u.stunImmune=true; u.stunned=0;","u.stunned=0;",'Fast and Unwilling'],
  ['Fast and Unwilling: Unstoppable kept after',FXJ,"fuOff(A,T,u){ if(T.s.suW!=null){ u.stunImmune=T.s.suW; T.s.suW=null; } }","fuOff(A,T,u){ }",'Fast and Unwilling'],
  ['Fast and Unwilling every 24 s',FXJ,"{window:'fu',dur:6,cd:25}","{window:'fu',dur:6,cd:24}",'Fast and Unwilling'],
  ['Fast and Unwilling: attacks do not refresh Doses',FXJ,"{on:'hit',if:{auto:true,window:'fu'},do:[{fn:'doseRefresh'}]}","{on:'hit',if:{auto:true,window:'fuX'},do:[{fn:'doseRefresh'}]}",'Fast and Unwilling'],
  ['One for the Crossing: slower at any Dose count',FXJ,"((T.P['pace.slow']&&A.stGet(T,'dose')>=3)?1:2)","((T.P['pace.slow'])?1:2)",'One for the Crossing \\(LINK, its own'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k));
  for(const k of ['.bin','.base']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-cnc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-carn.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||4), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
