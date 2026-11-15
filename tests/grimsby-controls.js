'use strict';
/* The controls for Grimsby's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a site made
   unguarded with a seeded draw, a row of his broken), runs the named tests of tests/talents-mech-grimsby.test.js in that copy, and expects them to FAIL.
   The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. J=2 by default (the test host is shared). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['debtaura num hook removed',HTML,"dur*=1+((g._tal&&g._tal.on.num)?TalentFx.num(g,'debtaura',SKLV.debtaura(passLv(g))):SKLV.debtaura(passLv(g)));","dur*=1+SKLV.debtaura(passLv(g));",'Interest Only'],
  ['Served by Hand option ignored',HTML,"&&!(o._only&&o._only.indexOf(e)<0)){if(o.mul)dealDamage(u,e,dB*o.mul,'#ffa657');","){if(o.mul)dealDamage(u,e,dB*o.mul,'#ffa657');",'Served by Hand'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the debtaura site',HTML,"dur*=1+((g._tal&&g._tal.on.num)?","dur*=1+((brnd(),g._tal&&g._tal.on.num)?",'no talents'],
  ['draw at the Foreclosure site',HTML,"&&!(o._only&&o._only.indexOf(e)<0)){if(o.mul)","&&!(brnd(),o._only&&o._only.indexOf(e)<0)){if(o.mul)",'no talents'],
  // ---- his rows and bookkeeping ----
  ['Past Due 1% -> 1.1%',FXJ,"ci_1_1:[ {param:'ar.rate',add:R(0.01)} ]","ci_1_1:[ {param:'ar.rate',add:R(0.011)} ]",'Arrears:'],
  ['Arrears not capped at 10 s',FXJ,"r.rise=Math.min(rate*10,","r.rise=Math.min(rate*11,",'Arrears:'],
  ['Arrears at 5',FXJ,"const thr=T=>T.P.thr9?9:6;","const thr=T=>T.P.thr9?9:5;",'Arrears:|Compounding'],
  ['Arrears without a notice',FXJ,"const has=notices(u,x).length>0, inA=has&&","const has=notices(u,x).length>0, inA=",'Arrears:'],
  ['Arrears rise kept without Never Thrown Away',FXJ,"if(!T.P.nta){ r.sec=0; r.rise=0; }","",'Arrears:'],
  ['Never Thrown Away ignored',FXJ,"ci_3_1:[ {param:'nta',add:1} ]","ci_3_1:[ {param:'ntaX',add:1} ]",'Never Thrown'],
  ['Interest on Interest twice for one enemy',FXJ,"{on:'arrears',by:'target',once:'wave',do:[{stack:'ioi',add:1}]}","{on:'arrears',do:[{stack:'ioi',add:1}]}",'Arrears:'],
  ['Usury 2% -> 3%',FXJ,"ci_12_2:[ {on:'teamHeal',if:{unitHas:'arr'},less:R(0.02)} ]","ci_12_2:[ {on:'teamHeal',if:{unitHas:'arr'},less:R(0.03)} ]",'Arrears:'],
  ['Late Fee 10% -> 11%',FXJ,"ci_1_4:[ {param:'lf',add:R(0.10)} ]","ci_1_4:[ {param:'lf',add:R(0.11)} ]",'Late Fee'],
  ['Late Fee on a notice cut short',FXJ,"if(d.remaining<=1&&x.alive&&T.P.lf){","if(x.alive&&T.P.lf){",'Late Fee'],
  ['Final Notice at any HP',FXJ,"((x.hp<0.5*x.maxHp)?(T.P['lf.low']||0):0)","(T.P['lf.low']||0)",'Late Fee'],
  ['Garnished 10% -> 20%',FXJ,"ci_9_4:[ {on:'lateFee',do:[{heal:{pct:0.10,of:'spent'}}]} ]","ci_9_4:[ {on:'lateFee',do:[{heal:{pct:0.20,of:'spent'}}]} ]",'Late Fee'],
  ['Collection Agent on the target',FXJ,"{team:'enemy',of:'target',n:1,skip:'target'},c)[0]; if(t) addOd(A,T,u,t,a.k||1,false); },","{team:'enemy',of:'target',n:1},c)[0]; if(t) addOd(A,T,u,t,a.k||1,false); },",'Late Fee'],
  ['Pinned Notices on every hit',FXJ,"ci_7_1:[ ...ODM(R(0.04),{targetLacks:'od1'}).slice(0,1) ]","ci_7_1:[ ...ODM(R(0.04),{}).slice(0,1) ]",'Overdue upgrades'],
  ['Standing Debt on every Overdue',FXJ,"if(T.P.sd&&before===0&&!r.seen)","if(T.P.sd)",'Overdue upgrades'],
  ['Fine Print not applied',FXJ,"const add=(T.P['od.dur']||0)+(d._fdX||0);","const add=(d._fdX||0);",'Overdue upgrades'],
  ['Hounding on any enemy',FXJ,"ci_7_4:[ ...ALLM(R(0.02),{targetDot:'od'}) ]","ci_7_4:[ ...ALLM(R(0.02),{}) ]",'Overdue upgrades'],
  ['Deeper Debt on all stacks',FXJ,"return n>6?(n-6)/n:0;","return n>6?1:0;",'Compounding'],
  ['Compounding cap 10',FXJ,"opt:{maxStk:{set:9}}","opt:{maxStk:{set:10}}",'Compounding'],
  ['Settle Now at 5',FXJ,"if(T.P.settle&&before>=thr(T)){","if(T.P.settle&&before>=thr(T)-1){",'Settle Now'],
  ['Settle Now leaves the new notice',FXJ,"if(T.P.settle&&before>=thr(T)){ own(T,u,x,d,'od'); T.fn.settle","if(T.P.settle&&before>=thr(T)){ T.fn.settle",'Settle Now'],
  ['Paper Cuts on skill hits',FXJ,"ci_3_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},","ci_3_4:[ {on:'hit',if:{targetTeam:'enemy'},",'Paper Cuts'],
  ['Quarter Days without a notice',FXJ,"if(has&&r.hpF!=null) for(const th of","if(r.hpF!=null) for(const th of",'Paper Cuts'],
  ['Rolled Over to the farthest',FXJ,"A.pick(T,u,{team:'enemy',of:'unit',n:1},c)[0]; if(t) addOd(A,T,u,t,x._debtStk||0,false); },","A.pick(T,u,{team:'enemy',of:'unit'},c).pop(); if(t) addOd(A,T,u,t,x._debtStk||0,false); },",'Paper Cuts'],
  ['Interest Only 5% -> 6%',FXJ,"ci_5_4:[ {on:'num',skill:'debtaura',add:R(0.05)} ]","ci_5_4:[ {on:'num',skill:'debtaura',add:R(0.06)} ]",'Interest Only'],
  ['Dry Ink body to body',FXJ,"to:{team:'enemy',within:5,centre:true,dot:true}","to:{team:'enemy',within:7,dot:true}",'Interest Only'],
  ['Served in Full ignored',FXJ,"addOd(A,T,u,x,3,true,T.P['fd.dur']||0);","addOd(A,T,u,x,3,true,0);",'Final Demand'],
  ['The Rate He Set every 20 s',FXJ,"s.rhsCd=tn+25;","s.rhsCd=tn+20;",'Rate He Set'],
  ['The Rate He Set at 9.6 s',FXJ,"r.sec>=10-1e-9","r.sec>=9.6-1e-9",'Rate He Set'],
  ['The Rate He Set reaches 3 m',FXJ,"{team:'enemy',of:'target',within:4,skip:'target'},{tgt:x})","{team:'enemy',of:'target',within:3,skip:'target'},{tgt:x})",'Rate He Set'],
  ['The Rate He Set: no double rise',FXJ,"rec(T,y).dbl=tn+6;","",'Rate He Set'],
  ['Served 1 s after the taunt',FXJ,"{dur:(x.forcedTargetT||0)+2+(T.P['srv.dur']||0),longest:true}","{dur:(x.forcedTargetT||0)+1+(T.P['srv.dur']||0),longest:true}",'Served:'],
  ['silence cut at 2.8 s',FXJ,"x.silencedT=Math.max(x.silencedT,Math.min(top,x.silencedT+ex));","x.silencedT=Math.max(x.silencedT,Math.min(2.8,x.silencedT+ex));",'Served:'],
  ['Served Twice on everyone',FXJ,"(was?(T.P.st2||0):0)","(T.P.st2||0)",'Served:'],
  ['Notice to Quit on him too',FXJ,"ev_1_1:[ {on:'teamIn',if:{srcHas:'served'},less:R(0.02)} ]","ev_1_1:[ {on:'teamIn',if:{srcHas:'served'},less:R(0.02)}, {on:'in',if:{srcHas:'served'},less:R(0.02)} ]",'Served:'],
  ['Heavy Ledger 9%',FXJ,"ev_2_3:[ {param:'hl',add:R(0.10)} ]","ev_2_3:[ {param:'hl',add:R(0.09)} ]",'Served:'],
  ['Tenant Burden up to 6',FXJ,"ev_11_2:[ {on:'in',less:R(0.01),per:{stack:'srv',max:5}} ]","ev_11_2:[ {on:'in',less:R(0.01),per:{stack:'srv',max:6}} ]",'Served counts'],
  ['Paper Wall at one',FXJ,"ev_4_3:[ {on:'in',if:{stackMin:{srv:2}},less:R(0.02)} ]","ev_4_3:[ {on:'in',if:{stackMin:{srv:1}},less:R(0.02)} ]",'Served counts'],
  ['Tenants Rights at any distance',FXJ,"targetTeam:'ally',targetWithin:4},less:R(0.015)","targetTeam:'ally'},less:R(0.015)",'Served counts'],
  ['Drawn In no extra taunt',FXJ,"if(T.P.drawn){ x.forcedTargetT+=1;","if(T.P.drawn){",'Served counts'],
  ['Kept Out pushes 1 m',FXJ,"[{push:'target',from:'source',m:2,secs:0.4}]","[{push:'target',from:'source',m:1,secs:0.4}]",'Kept Out'],
  ['Deposit cap 25% base',FXJ,"(u.maxHp||0)*(0.20+(T.P['dep.cap']||0))","(u.maxHp||0)*(0.25+(T.P['dep.cap']||0))",'Deposit'],
  ['Deposit not emptied',FXJ,"const amt=d*(1+(T.P['dep.heal']||0)); T.s.dep=0;","const amt=d*(1+(T.P['dep.heal']||0));",'Deposit'],
  ['Deposit withholds from anyone',FXJ,"{on:'in',if:{srcHas:'served'},do:[{fn:'withhold'}]}","{on:'in',do:[{fn:'withhold'}]}",'Deposit'],
  ['refund at 40%',FXJ,"edge:true,if:{targetHpBelow:0.30},do:[{fn:'refund'}]}","edge:true,if:{targetHpBelow:0.40},do:[{fn:'refund'}]}",'Deposit'],
  ['Doors Locked with two',FXJ,"if(T.P.doors&&nS>=3&&","if(T.P.doors&&nS>=2&&",'Doors Locked'],
  ['Doors Locked every 4 s',FXJ,"s.doorsCd=now(A)+25;","s.doorsCd=now(A)+4;",'Doors Locked'],
  ['Doors Locked 25%',FXJ,"{on:'in',if:{window:'doors'},less:0.30}","{on:'in',if:{window:'doors'},less:0.25}",'Doors Locked'],
  ['Mass Eviction ignored',FXJ,"const d=1.5+(T.P['evict.t']||0);","const d=1.5;",'Eviction Notice'],
  ['Rent Strike a third',FXJ,"do:[{cd:'blue',mul:0.5}]","do:[{cd:'blue',mul:0.66}]",'Eviction Notice'],
  ['dash not stopped',FXJ,"x._dash.x1=x._dash.x0; x._dash.y1=x._dash.y0;","",'Eviction Notice'],
  ['crit cap 10%',FXJ,"return Math.min(5,(T.r.ci_8_3||0)+(T.r.ne_8_3||0));","return Math.min(10,(T.r.ci_8_3||0)+(T.r.ne_8_3||0));",'damage reduction'],
  ['Ninety-One every 9',FXJ,"per:{stack:'entry',div:10}","per:{stack:'entry',div:9}",'damage reduction'],
  ['Entries up to 92',FXJ,"entry:{max:91}","entry:{max:92}",'Entries:'],
  ['Record Kept off',FXJ,"else if(T.P.rk&&A.markOf(u,x,'lien')) n=1;","",'Entries:'],
  ['an Entry from a death carrying nothing',FXJ,"if(od||f1||f2){ n=1;","if(true){ n=1;",'Entries:'],
  ['Ledger of the Dead up to 4',FXJ,"lx=Math.min(3,Math.floor(A.stGet(T,'entry')/10+1e-9));","lx=Math.min(4,Math.floor(A.stGet(T,'entry')/10+1e-9));",'Ledger of the Dead'],
  ['Every Name Kept at 9',FXJ,"if:{stackMin:{entry:10}},do:[{fn:'twoServe'}]","if:{stackMin:{entry:9}},do:[{fn:'twoServe'}]",'Ledger of the Dead'],
  ['Lien shields not weakened',FXJ,"if(sh>r.lsh+1e-9) x.shield=r.lsh+(sh-r.lsh)*(1-k);","",'Lien:'],
  ['Debt Transfer 2 s a rank',FXJ,"dur:R(1),longest:true}]} ]","dur:R(2),longest:true}]} ]",'Lien:'],
  ['No Relief on every heal',FXJ,"return !!x&&x===T.s.lsS&&T.s.lsT===now(A)&&!!A.markOf(u,x,'lien'); }","return !!x&&!!A.markOf(u,x,'lien'); }",'Lien:'],
  ['Total Foreclosure at the window only',FXJ,"if(c.dot&&c.dot.remaining<=1&&--T.s.fcN<=0&&T.r.ne_9_4) T.fn.fcEnd(A,T,u);","",'Foreclosure:'],
  ['Total Foreclosure 25%',FXJ,"A.hurt(T,u,x,0.2*r.fcD,FCC,'tfc');","A.hurt(T,u,x,0.25*r.fcD,FCC,'tfc');",'Foreclosure:'],
  ['Served Everywhere 2 s',FXJ,"skill:FC,opt:{dur:{add:3}}","skill:FC,opt:{dur:{add:2}}",'Foreclosure:'],
  ['Served by Hand twice as strong',FXJ,"c.o.dps=(c.o.dps||0.4)*3;","c.o.dps=(c.o.dps||0.4)*2;",'Served by Hand'],
  ['Ledger Corrected up to 35%',FXJ,"per:{stack:'entry',max:60}","per:{stack:'entry',max:70}",'Ledger Corrected'],
  ['Ledger Corrected energy unlimited',FXJ,"if((T.s.corrE||0)<25){","if(true){",'Ledger Corrected'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups']);
const TMP=(()=>{ const t=os.tmpdir(), r=path.relative(root,t); return (!r.startsWith('..')&&!path.isAbsolute(r))?path.dirname(root):t; })();   // the test host keeps its temp folder inside the checkout: copy beside it instead
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-grc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-grimsby.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||2), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
