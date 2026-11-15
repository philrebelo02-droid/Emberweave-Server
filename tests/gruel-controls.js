'use strict';
/* The controls for Gruel's talent tests (run on the cluster through tools/remote_test.sh as a plain node script). Each control copies this checkout to a temp
   folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, a cap or a row of his broken), runs the named tests of tests/talents-mech-gruel.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   J (environment) = how many run at once (default 3: the test host is shared). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['Weigh the Debt skillTgt line removed',HTML,"      if(big&&u._tal&&u._tal.on.skillTgt) big=TalentFx.skillTgt(u,type,big,o)||big;","",'Weigh the Debt: Two Ledgers'],
  ['COLLECTED num hook removed',HTML,"healUnit(g,(g._tal&&g._tal.on.num)?TalentFx.num(g,'collect',cut*0.5):cut*0.5);","healUnit(g,cut*0.5);",'Fee: Collector'],
  ['Gluttony num hook removed',HTML,"u.hp+((u._tal&&u._tal.on.num)?TalentFx.num(u,'glut',u.maxHp*0.04*(u.passMul||1)*dt):u.maxHp*0.04*(u.passMul||1)*dt)","u.hp+u.maxHp*0.04*(u.passMul||1)*dt",'Girth: Girth'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the Weigh the Debt line',HTML,"      if(big&&u._tal&&u._tal.on.skillTgt) big=","      brnd(); if(big&&u._tal&&u._tal.on.skillTgt) big=",'no talents'],
  ['draw at the COLLECTED line',HTML,"healUnit(g,(g._tal&&g._tal.on.num)?","healUnit(g,(brnd(),g._tal&&g._tal.on.num)?",'no talents'],
  ['draw at the Gluttony line',HTML,"u.hp+((u._tal&&u._tal.on.num)?TalentFx.num(u,'glut'","u.hp+((brnd(),u._tal&&u._tal.on.num)?TalentFx.num(u,'glut'",'no talents'],
  // ---- his caps ----
  ['damage-reduction group cap 30% -> 40%',FXJ,"const DR_FLOOR=0.70;","const DR_FLOOR=0.60;",'ONE group'],
  ['control-shortening cap 35% -> 40%',FXJ,"const TEN_FLOOR=0.65;","const TEN_FLOOR=0.60;",'controls on him'],
  ['crit cap 5% -> 6%',FXJ,"const CRIT_CAP=0.05;","const CRIT_CAP=0.06;",'critical-chance talents together'],
  ['regeneration cap 1.2% -> 1.3%',FXJ,"const REGEN=0.012;                        // his per-second","const REGEN=0.013;                        // his per-second",'Feast: Feast'],
  ['Everything Is Eaten extra 6% -> 7%',FXJ,"const EIE_CAP=0.06;","const EIE_CAP=0.07;",'Everything Is Eaten'],
  // ---- his rows: The Ledger ----
  ['Ledger Entry 2% -> 3%',FXJ,"le_1_1:[ {on:'out',if:{casting:CF,targetTeam:'enemy'},more:R(0.02)","le_1_1:[ {on:'out',if:{casting:CF,targetTeam:'enemy'},more:R(0.03)",'Owed: Ledger'],
  ['Running Tab 1 -> 2 a rank',FXJ,"le_2_1:[ {param:'owed.max',add:R(1)} ],","le_2_1:[ {param:'owed.max',add:R(2)} ],",'Owed: Ledger'],
  ['Square Accounts at 4',FXJ,"if(Pp.sq&&n>=5&&t.alive)","if(Pp.sq&&n>=4&&t.alive)",'Owed: Ledger'],
  ['Collections at 2',FXJ,"if(Pp.coll&&n>=3)","if(Pp.coll&&n>=2)",'Owed: Ledger'],
  ['Coinflail does not clear the Owed',FXJ,"u.greenCd=Math.max(0,(u.greenCd||0)-Pp.coll); A.ustPut(T,u,t,'owed',0); } }","u.greenCd=Math.max(0,(u.greenCd||0)-Pp.coll); } }",'Owed: Ledger'],
  ['Itemised one Owed short',FXJ,"E.healUnit(u,Pp.item*n*u.maxHp)","E.healUnit(u,Pp.item*(n-1)*u.maxHp)",'Owed: Ledger'],
  ['Bookkeeper counts nobody',FXJ,"if(!(E.dist(u,x)-E.bodyR(x)<=R)) continue;","if(!(E.dist(u,x)<=0)) continue;",'Coinflail: Heavy Flail'],
  ['no Fee for a COLLECTED',FXJ,"{on:'num',skill:'collect',reqAny:FEE,do:[{stack:'fee',add:1}]}","{on:'num',skill:'collect',reqAny:FEE,do:[{stack:'fee',add:0}]}",'Fee: Collector'],
  ['Keep the Change 0.2% -> 0.3%',FXJ,"le_3_4:[ {param:'dr.fee',add:R(0.002)} ],","le_3_4:[ {param:'dr.fee',add:R(0.003)} ],",'Fee: Collector'],
  ['Rainy Day keeps nothing',FXJ,"s.feeK=Math.min(A.stGet(T,'fee'),Pp['fee.keep']||0);","s.feeK=0;",'Fee: Collector'],
  ['Call It In spends 9',FXJ,"A.stSet(T,u,'fee',A.stGet(T,'fee')-10); s.cii=1;","A.stSet(T,u,'fee',A.stGet(T,'fee')-9); s.cii=1;",'Call It In'],
  ['Compound ignored',FXJ,"dt*(1+(Pp['int.rate']||0))","dt*(1)",'Interest: Interest'],
  ['Interest does not raise the cut',FXJ,"x._debtPct=x._talDb*(1+(Pp['int.cut']||0)*n);","x._debtPct=x._talDb;",'Interest: Interest'],
  ['Interest kept after the debt',FXJ,"ia[x.uid]=null; A.ustPut(T,u,x,'int',0); } }","} }",'Interest: Interest'],
  ['Usury 0.3% -> 0.4%',FXJ,"le_9_2:[ {stat:{atk:R(-0.003)}","le_9_2:[ {stat:{atk:R(-0.004)}",'Interest: Interest'],
  ['What Is Owed every 0 s',FXJ,"s.wioCd=E.now()+20;","s.wioCd=E.now()+0;",'What Is Owed'],
  ['What Is Owed keeps the debt',FXJ,"if(s.ia) s.ia[x.uid]=null; x._debtT=0; x._debtTo=null; },","if(s.ia) s.ia[x.uid]=null; },",'What Is Owed'],
  ['The Heaviest Pays ignored',FXJ,"if(Pp.heavy&&L.length) c.tgt=L[0][0];","",'Weigh the Debt: Two Ledgers'],
  ['Two Ledgers at 80%',FXJ,"const k=T.P.two?0.75:1;","const k=T.P.two?0.80:1;",'Weigh the Debt: Two Ledgers'],
  ['Debt Sold On to the lowest max HP',FXJ,"if(y!==x&&!inDebt(u,y)&&(!n||(y.maxHp||0)>(n.maxHp||0))) n=y;","if(y!==x&&!inDebt(u,y)&&(!n||(y.maxHp||0)<(n.maxHp||0))) n=y;",'No Forgiveness'],
  ['No Forgiveness at 80%',FXJ,"0.70*x.maxHp-x.hp","0.80*x.maxHp-x.hp",'No Forgiveness'],
  ['Day of Reckoning owes 2',FXJ,"A.ustGet(T,u,x,'owed')+3))","A.ustGet(T,u,x,'owed')+2))",'Reckoning.s Ledger'],
  ['Settling Up on any enemy',FXJ,"targetUst:{owed:1}},more:R(0.01)","targetUst:{owed:0}},more:R(0.01)",'Reckoning.s Ledger'],
  // ---- The Brass Scales ----
  ['the pans never empty',FXJ,"if(p.t>=4+(Pp['pan.hold']||0)-1e-9){ p.L=0; p.R=0; p.t=0; }","",'Pans: Two Pans'],
  ['a tip on any heavier pan',FXJ,"if(cur&&p.side&&cur!==p.side)","if(cur&&p.side)",'Pans: Two Pans'],
  ['Counterpoise every tip',FXJ,"bs_4_3:[ {on:'tip',icd:2.5,","bs_4_3:[ {on:'tip',icd:0,",'Pans: Two Pans'],
  ['Steady Hand 0.5% -> 0.6%',FXJ,"bs_11_3:[ {param:'dr.steady',add:R(0.005)}","bs_11_3:[ {param:'dr.steady',add:R(0.006)}",'Pans: Two Pans'],
  ['level within 5%',FXJ,"<=(0.10+(x||0))*m+1e-9","<=(0.05+(x||0))*m+1e-9",'Honest Measure and Level Hand'],
  ['Thumb on the Scale at 50%',FXJ,"let k=Pp.thumb?0.6:(p.L>p.R?1:0);","let k=Pp.thumb?0.5:(p.L>p.R?1:0);",'Honest Measure and Level Hand'],
  ['Fair Exchange fills nothing',FXJ,"p.L+=a; if(T.P.fairx&&A.winOn(T,'reck')) p.R+=a;","p.L+=a;",'Honest Measure and Level Hand'],
  ['Short Weight at 32%',FXJ,"const swThr=T=>0.30+","const swThr=T=>0.32+",'Short Weight: Short Weight'],
  ['Coinflail does not turn',FXJ,"if(!isSW(T,u,x)) continue; const d=E.dist(u,x); if(d<bd){ bd=d; b=x; } } if(b) o._tgtU=b; }","if(!isSW(T,u,x)) continue; const d=E.dist(u,x); if(d<bd){ bd=d; b=x; } } }",'Short Weight: Short Weight'],
  ['Scrap Value: no Short Weight mark',FXJ,"if(r.bs_7_1&&isSW(T,u,x)) A.setMark(T,u,x,'sw',{dur:0.5});","",'Short Weight: Short Weight'],
  ['Tipped Scales per 5%',FXJ,"Math.floor(g*10+1e-9)","Math.floor(g*20+1e-9)",'Tipped Scales'],
  ['Weigh Them Down at 40 points',FXJ,"hpf(u)+0.5-1e-9","hpf(u)+0.4-1e-9",'Tipped Scales'],
  ['Weighed and Found never marks',FXJ,"more:R(0.10),do:[{mark:'wf',on:'target'}]}","more:R(0.10)}",'Weighed and Found'],
  ['Brass Polish 0.2 -> 0.3 s',FXJ,"bs_12_4:[ {on:'kit',skill:RK,opt:{dur:{add:R(0.2)}}} ],","bs_12_4:[ {on:'kit',skill:RK,opt:{dur:{add:R(0.3)}}} ],",'Weighed and Found'],
  ['Fair Warning not on his allies',FXJ,"{on:'teamIn',if:{targetTeam:'ally',srcHas:'tnt'},less:R(0.02)}","{on:'teamIn',if:{targetTeam:'ally',srcHas:'tnt'},less:R(0)}",'Weighed and Found'],
  ['Iron Stomach not on DoT ticks',FXJ,"if(Pp['dr.stom']) f(Pp['dr.stom']);","",'Weighed and Found'],
  ['the settle moves 40%',FXJ,"Math.min(c.amt*0.5,st.left)","Math.min(c.amt*0.4,st.left)",'Scales Settle'],
  ['the settle budget 25%',FXJ,"(isBoss(b)?0.05:0.20)","(isBoss(b)?0.05:0.25)",'Scales Settle'],
  ['the settle every 1 s',FXJ,"s.stlCd=E.now()+25;","s.stlCd=E.now()+1;",'Scales Settle'],
  // ---- The Appetite ----
  ['Snacking ignored',FXJ,"if(room0<=1e-9) a+=dt*sp; else","if(room0<=1e-9) a+=dt; else",'Appetite: Never Full'],
  ['Coinflail does not eat',FXJ,"s.cfEat=n; A.stSet(T,u,'app',0);","s.cfEat=n;",'eats the Appetite'],
  ['Clean Plate at 9',FXJ,"if(Pp.plate&&n>=10)","if(Pp.plate&&n>=9)",'eats the Appetite'],
  ['Girth every 9%',FXJ,"const step=0.10*(u.maxHp||1);","const step=0.09*(u.maxHp||1);",'Girth: Girth'],
  ['Girth kept between waves',FXJ,"if(learned(T,GIRTH)){ A.stSet(T,u,'girth',s.girK||0); s.ga=0; }","if(learned(T,GIRTH)){ s.ga=0; }",'Girth: Girth'],
  ['Feast 4 s',FXJ,"d=3+(Pp['feast.dur']||0)","d=4+(Pp['feast.dur']||0)",'Feast: Feast'],
  ['All You Can Eat adds nothing',FXJ,"if(on&&kill&&Pp.aye){ w.t+=1;","if(false){ w.t+=1;",'Feast: Feast'],
  ['Pass the Dish at twice the cap',FXJ,"REGEN*b.maxHp*dt","2*REGEN*b.maxHp*dt",'Feast: Feast'],
  ['Slow Digest on his own COLLECTED',FXJ,"if(s.ownH){ s.ownH=false; return false; }","",'Slow Digest'],
  ['Heavyweight at 4 Girth',FXJ,"A.stGet(T,'girth')>=5&&(u.drT||0)>0","A.stGet(T,'girth')>=4&&(u.drT||0)>0",'Sit Down to Dinner'],
  ['Sit Down to Dinner gives no Girth',FXJ,"if(L.length) A.stSet(T,u,'girth',A.stGet(T,'girth')+L.length);","",'Sit Down to Dinner'],
  ['Everything Is Eaten twice a fight',FXJ,"ap_13_2:[ {on:'tick',edge:true,once:'fight',","ap_13_2:[ {on:'tick',edge:true,",'Everything Is Eaten'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups']);
const TMP=(()=>{ const t=os.tmpdir(); if(!path.resolve(t).startsWith(root+path.sep)) return t; for(const c of ['/tmp',path.dirname(root)]) if(fs.existsSync(c)&&!path.resolve(c).startsWith(root+path.sep)) return c; return t; })();   // a temp folder outside the checkout (the test host's TMPDIR sits inside the slot)
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-grc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,to.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n')));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-gruel.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
if(process.env.ONLY){ const w=process.env.ONLY.split('|'); for(let k=C.length-1;k>=0;k--) if(!w.some(x=>C[k][0].indexOf(x)>=0)) C.splice(k,1); }   // ONLY='name part|name part': run just those
(async()=>{ const J=+(process.env.J||3), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
