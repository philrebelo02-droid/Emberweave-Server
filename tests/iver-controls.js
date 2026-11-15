'use strict';
/* The controls for Iver's talent tests (run on the cluster through tools/remote_test.sh as a plain node script). Each control copies this checkout into a folder
   under os.tmpdir() (the runner points TMPDIR at the slot's own .tmp, which it wipes after the run), leaving out .tmp, .logs, .git, node_modules and the art,
   breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard given an unguarded seeded
   draw, a cap or a row of his broken), runs the named tests of tests/talents-mech-iver.test.js in that copy, expects them to FAIL, and deletes the copy.
   ONE AT A TIME: no copies run side by side. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any was not caught.
   ONLY='name part|name part' runs just those. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['swing pass line removed',HTML,"        if(u.pass.staticcharge&&u._tal&&u._tal.on.pass) TalentFx.pass(u,t,'scSwing');","        ",'Charge: Overfull'],
  ['scGo removed',HTML,"&&!(u._tal&&u._tal.on.num&&!TalentFx.num(u,'scGo',1,ab))","",'Hold It In'],
  ['scN removed',HTML,"const _scN=(u._tal&&u._tal.on.num)?TalentFx.num(u,'scN',3,ab):3;","const _scN=3;",'the discharge'],
  ['chain landPre removed',HTML,"      if(u._tal) TalentFx.landPre(u,null,'staticcharge');","      ",'the discharge'],
  ['chain land removed',HTML,"      if(u._tal) TalentFx.land(u,null,'staticcharge');","      ",'Strikes: Struck Once'],
  ['_talAim line removed',HTML,"  if(u._talW) u._talAim={","  if(false) u._talAim={",'the Rod: Tallest'],
  ['scChain binding removed',HTML,"scChain:(u,foes)=>talentStaticChain(u,foes), ","",'Hold It In'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the swing line',HTML,"        if(u.pass.staticcharge&&u._tal&&u._tal.on.pass) TalentFx","        if(u.pass.staticcharge&&(brnd(),true)&&u._tal&&u._tal.on.pass) TalentFx",'no talents'],
  ['draw at scGo',HTML,"if(u.pass.staticcharge&&u._scReady&&!(u._tal","if(u.pass.staticcharge&&u._scReady&&(brnd(),true)&&!(u._tal",'no talents'],
  ['draw at scN',HTML,"const _scN=(u._tal&&u._tal.on.num)?","const _scN=(brnd(),u._tal&&u._tal.on.num)?",'no talents'],
  ['draw at the chain landPre',HTML,"      if(u._tal) TalentFx.landPre(u,null,'staticcharge');","      brnd(); if(u._tal) TalentFx.landPre(u,null,'staticcharge');",'no talents'],
  ['draw at the chain land',HTML,"      if(u._tal) TalentFx.land(u,null,'staticcharge');","      brnd(); if(u._tal) TalentFx.land(u,null,'staticcharge');",'no talents'],
  ['draw at the _talAim line',HTML,"  if(u._talW) u._talAim={","  if(u.key==='iver') brnd(); if(u._talW) u._talAim={",'no talents'],
  // ---- his caps ----
  ['damage-reduction group 35% -> 40%',FXJ,"const DR_FLOOR=0.65;                      // his damage","const DR_FLOOR=0.60;                      // his damage",'ONE group'],
  ['Somewhere to Go 40% -> 45%',FXJ,"const SIG_DR=0.40;","const SIG_DR=0.45;",'Somewhere to Go'],
  ['crit cap 5% -> 6%',FXJ,"const CRIT_CAP=0.05;                      // his critical-chance talents together never give more than 5% (Ozone","const CRIT_CAP=0.06;                      // his critical-chance talents together never give more than 5% (Ozone",'critical-chance'],
  ['regeneration cap 1.2% -> 1.4%',FXJ,"const REGEN=0.012;                        // his talent heals","const REGEN=0.014;                        // his talent heals",'Overflowing'],
  ['stun break 0.5 s -> 0.3 s',FXJ,"const STUN_GAP=0.5;","const STUN_GAP=0.3;",'Charged Air'],
  ['stuns per cast 2 -> 3',FXJ,"const STUN_PER=2;","const STUN_PER=3;",'Answering Strike'],
  ['the 3 s stun cut at 2.8 s',FXJ,"    if(secs>cap&&(t.stunned||0)>=cap-1e-9) t.stunned=Math.max(t.stunned,Math.min(secs,top));","",'Twelfth Is Owed'],
  // ---- The Twelfth Strike ----
  ['Overfull 4% -> 5%',FXJ,"{on:'out',if:{casting:CHN},more:R(0.04),per:{fn:'above'}}","{on:'out',if:{casting:CHN},more:R(0.05),per:{fn:'above'}}",'Charge: Overfull'],
  ['Overfull up to 7',FXJ,"ts_1_4:[ {param:'ch.max',add:3},","ts_1_4:[ {param:'ch.max',add:2},",'Charge: Overfull'],
  ['Live Wire every swing',FXJ,"ts_12_3:[ {on:'pass',skill:'scSwing',once:'wave',","ts_12_3:[ {on:'pass',skill:'scSwing',",'Charge: Overfull'],
  ['Quick Charge 20% a rank',FXJ,"ts_2_2:[ {on:'pass',skill:'scSwing',chance:R(0.04),","ts_2_2:[ {on:'pass',skill:'scSwing',chance:R(0.2),",'Charge: Overfull'],
  ['Copper Skin up to 8',FXJ,"f(Pp['dr.cu']*Math.min(5,chg(T,u)))","f(Pp['dr.cu']*Math.min(8,chg(T,u)))",'Charge: Overfull'],
  ['Static Hair at 6',FXJ,"ch5(A,T,u){ return chg(T,u)>=5; }","ch5(A,T,u){ return chg(T,u)>=6; }",'Charge: Overfull'],
  ['Held Current not by Charge',FXJ,"return base+Math.min(T.P.hc||0,above(T));","return base+(T.P.hc||0);",'the discharge'],
  ['Bright Arc on the first',FXJ,"notFirst(A,T){ return (T.s.ivCi||0)>1; }","notFirst(A,T){ return (T.s.ivCi||0)>0; }",'the discharge'],
  ['Charge Echo keeps nothing',FXJ,"s.ivC=Math.min(Pp.echo||0,dc);","s.ivC=0;",'the discharge'],
  ['Storm Season at the press',FXJ,"A.acts(T,u,[{after:0,do:[{cd:'green',add:-Pp.ss}]}],c);","A.acts(T,u,[{cd:'green',add:-Pp.ss}],c);",'the discharge'],
  ['Afterglow 4 s',FXJ,"A.acts(T,u,[{window:'iv_ag',dur:3}],c);","A.acts(T,u,[{window:'iv_ag',dur:4}],c);",'the discharge'],
  ['Looking Forward up to 4',FXJ,"iv_lf:{max:3,dur:4},","iv_lf:{max:4,dur:4},",'the discharge'],
  ['Strikes past 12 without the signature',FXJ,"if(n>=12&&!T.P.owe) return;","",'Strikes: Struck Once'],
  ['After the Seventh at 6',FXJ,"(T.P.a7&&strikes(T)>=7)?4:5","(T.P.a7&&strikes(T)>=6)?4:5",'Strikes: Struck Once'],
  ['Twelve Counted at 11',FXJ,"(T.P.tw&&strikes(T)>=12)?3","(T.P.tw&&strikes(T)>=11)?3",'Strikes: Struck Once'],
  ['Charged Pike not per enemy',FXJ,"{by:Math.min(L.length,Pp.cpk)}","{by:Pp.cpk}",'more Charge'],
  ['Bracing Charge without a limit',FXJ,"if((s.brN||0)>=(T.P.brc||0)) return;","",'more Charge'],
  ['Quiet Weeks 2',FXJ,"if((T.s.ivC||0)<3){ T.s.ivC=3;","if((T.s.ivC||0)<2){ T.s.ivC=2;",'more Charge'],
  ['Hold It In reaches 4',FXJ,"firstN(A,T,u,T.fn.reach(A,T,u,5))","firstN(A,T,u,T.fn.reach(A,T,u,4))",'Hold It In'],
  ['Let It Go on every hit',FXJ,"if(s.ivLG) return; s.ivLG=1;","s.ivLG=1;",'Let It Go'],
  ['Let It Go 3 enemies',FXJ,"nearOf(A,T,u,c.tgt,2),'scBasic'","nearOf(A,T,u,c.tgt,3),'scBasic'",'Let It Go'],
  ['Forked Pike from a Blue press',FXJ,"if(Pp.fork&&s.ivPress==='green')","if(Pp.fork)",'Forked Pike'],
  ['Forked Pike from the first too',FXJ,"for(const e of L.slice(1)) if(e.alive) chainRun(","for(const e of L) if(e.alive) chainRun(",'Forked Pike'],
  ['talent stuns on a stunned enemy',FXJ,"if((t.stunned||0)>0||A.markOf(u,t,'iv_lk')) continue;","if(A.markOf(u,t,'iv_lk')&&(t.stunned||0)<=0) continue;",'Charged Air'],
  ['the stun lock never set',FXJ,"A.setMark(T,u,t,'iv_lk',{dur:(t.stunned||0)+STUN_GAP,longest:true});","",'Charged Air'],
  ['Storm-Worn 4 s',FXJ,"do:[{mark:'iv_sw',on:'target',dur:3}]","do:[{mark:'iv_sw',on:'target',dur:4}]",'Charged Air'],
  ['Overflowing past the budget',FXJ,"const g=Math.min(x,s.rgV);","const g=x;",'Overflowing'],
  ['the budget kept 20 s',FXJ,"s.rgV=Math.min(10*cap,","s.rgV=Math.min(20*cap,",'Overflowing'],
  ['the signature every 5th',FXJ,"if(T.P.owe&&n%6===0)","if(T.P.owe&&n%5===0)",'Twelfth Is Owed'],
  ['the 12th only twice as hard',FXJ,"n%12===0?3:1,n%12===0?3:1.5","n%12===0?2:1,n%12===0?3:1.5",'Twelfth Is Owed'],
  ['the others take it all',FXJ,"A.hurt(T,u,x,0.5*raw*","A.hurt(T,u,x,raw*",'Twelfth Is Owed'],
  // ---- Volt Pike, Lit, the Thunderhead ----
  ['Line of Storms counts one more',FXJ,"s.pkN=n;","s.pkN=n+1;",'Volt Pike: Grounding'],
  ['Long Watch at most 12%',FXJ,"Math.min(0.10,0.004*","Math.min(0.12,0.004*",'Volt Pike: Grounding'],
  ['Thrown Far ignored',FXJ,"if(Pp['pk.w']) o.width=","if(false) o.width=",'Volt Pike: Grounding'],
  ['Pinned does not root',FXJ,"{stat:{move:-1},to:{team:'enemy',has:'iv_root'}}","{stat:{move:0},to:{team:'enemy',has:'iv_root'}}",'Pike and Return'],
  ['Rapid Throws 4 s',FXJ,"{window:'iv_rt',dur:3}","{window:'iv_rt',dur:4}",'Pike and Return'],
  ['Current Jumps ignored',FXJ,"if(T.P.cj){","if(false){",'Lit: Lit End'],
  ['Appointment Kept ignored',FXJ,"relit(A,T,u,c){ for(","relit(A,T,u,c){ return; for(",'Lit: Lit End'],
  ['Lit 5 s',FXJ,"const litDur=T=>4+","const litDur=T=>5+",'Lit: Lit End'],
  ['the Cloud\'s arc 25%',FXJ,"if(!k&&A.markOf(u,t,'iv_litS')) k=0.30;","if(!k&&A.markOf(u,t,'iv_litS')) k=0.25;",'Cloud Answers'],
  ['the Cloud every 20 s',FXJ,"s.caCd=E.now()+25;","s.caCd=E.now()+20;",'Cloud Answers'],
  ['Thunder Rolls keeps nothing',FXJ,"A.stSet(T,u,'iv_th',Math.min(st,Pp['th.keep']||0));","A.stSet(T,u,'iv_th',0);",'Thunderhead'],
  ['Storm Front ignored',FXJ,"period:P('th.per',4)","period:4",'Thunderhead'],
  ['Gathering Cloud 5%',FXJ,"sf_1_4:[ {param:'th.dmg',add:R(0.04)} ]","sf_1_4:[ {param:'th.dmg',add:R(0.05)} ]",'Thunderhead'],
  ['Skyward 50%',FXJ,"(c.raw||0)*0.40*","(c.raw||0)*0.50*",'Skyward'],
  ['Skyward stun 1 s',FXJ,"tstun(A,T,u,[x],0.7,key)","tstun(A,T,u,[x],1.0,key)",'Skyward'],
  ['Cloudburst at 5 steps',FXJ,"s.sbCb=(Pp.cb&&st>=6)?1:0;","s.sbCb=(Pp.cb&&st>=5)?1:0;",'Skyward'],
  // ---- Lightning Rod ----
  ['the Rod draws basic attacks',FXJ,"t===u||t._summon||c.auto||!(c.amt>0)","t===u||t._summon||!(c.amt>0)",'the Rod: Tallest'],
  ['the Rod draws area skills',FXJ,"a.at!==E.now()||a.area) return false;","a.at!==E.now()) return false;",'the Rod: Tallest'],
  ['Draw the Storm reaches 4 m',FXJ,"(T.P.dts?2:4)","(T.P.dts?4:4)",'the Rod: Tallest'],
  ['Every Storm at any HP',FXJ,"if(u.hp>0.5*u.maxHp) p+=Pp.esc||0;","p+=Pp.esc||0;",'the Rod: Tallest'],
  ['Steel Rod not on drawn hits',FXJ,"if(Pp['dr.steel']&&c.drawn)","if(Pp['dr.steel']&&false)",'what the Rod draws'],
  ['a drawn hit keeps the ally\'s armor',FXJ,"let x=(m0>0?a/m0:a)*m1;","let x=a;",'what the Rod draws'],
  ['Struck for Them at most 15%',FXJ,"Math.min(10,A.stGet(T,'iv_sft')","Math.min(15,A.stGet(T,'iv_sft')",'what the Rod draws'],
  ['Copper Rod 3',FXJ,"lr_3_1:[ {on:'iv_drawn',do:[{fn:'chPlus',by:2}]} ]","lr_3_1:[ {on:'iv_drawn',do:[{fn:'chPlus',by:3}]} ]",'what the Rod draws'],
  ['Bolt Taken 3%',FXJ,"lr_6_1:[ {on:'iv_drawn',do:[{shield:{pct:R(0.02)","lr_6_1:[ {on:'iv_drawn',do:[{shield:{pct:R(0.03)",'what the Rod draws'],
  ['Counted Bolt every 2 s',FXJ,"s.cbAt=E.now()+4;","s.cbAt=E.now()+2;",'Counted Bolt'],
  ['Counted Bolt 4 a wave',FXJ,"if(s.cbN>=3) return;","if(s.cbN>=4) return;",'Counted Bolt'],
  ['Counted Bolt may be the 12th',FXJ,"if(n===12||n>12&&!T.P.owe","if(n>12&&!T.P.owe",'Counted Bolt'],
  ['Stormwall full size',FXJ,"*(u._castSM||1)*0.5*(1+(T.P.swc||0))","*(u._castSM||1)*1*(1+(T.P.swc||0))",'Thunder Guard: Brace'],
  ['Hold the Tower within 12 m',FXJ,"{team:'enemy',within:3},c)){ x.forcedTarget=u;","{team:'enemy',within:12},c)){ x.forcedTarget=u;",'Hold the Tower'],
  ['Ring of Thunder 2.5 s',FXJ,"A.setMark(T,u,x,'iv_tnt',{dur:1.5});","A.setMark(T,u,x,'iv_tnt',{dur:2.5});",'Hold the Tower'],
  ['Answering Strike counted across casts',FXJ,"'ans'+(T.s.tgId||0)","'ans'",'Answering Strike'],
  ['Ground up to 12',FXJ,"iv_gr:{max:P('gr.max',10)}","iv_gr:{max:P('gr.max',12)}",'Ground: Earth'],
  ['Ground into 12 m',FXJ,"T.fn.ground(A,T,u,c,g,3,T.P.eb||0);","T.fn.ground(A,T,u,c,g,12,T.P.eb||0);",'Ground: Earth'],
  ['Earthed past the budget',FXJ,"if(Pp.eh&&g>=3) budHeal(A,T,u,","if(Pp.eh&&g>=3) A.eng().healUnit(u,",'Ground: Earth'],
  ['Overloaded Ground at 4',FXJ,"if(Pp.olg&&g>=10)","if(Pp.olg&&g>=4)",'Ground: Earth'],
  ['Ground while the guard is down',FXJ,"if(learned(T,GR)&&tgOn(u))","if(learned(T,GR))",'Ground: Earth'],
  ['the signature every 20 s',FXJ,"s.sigCd=E.now()+25;","s.sigCd=E.now()+20;",'Somewhere to Go'],
  ['the signature reaches 12 m',FXJ,"(c.amt||0)>0&&A.gap(u,x)<6*A.eng().METER(); },","(c.amt||0)>0&&A.gap(u,x)<12*A.eng().METER(); },",'Somewhere to Go'],
  ['the signature Ground into 12 m',FXJ,"T.fn.ground(A,T,u,c,g,4,","T.fn.ground(A,T,u,c,g,12,",'Somewhere to Go'],
  ['Father\'s Post every blow',FXJ,"lr_11_1:[ {on:'teamLethal',once:'wave',","lr_11_1:[ {on:'teamLethal',",'Father'],
  ['Oilskin on basic attacks too',FXJ,"if(!dot&&!c.auto){ if(Pp['dr.oil'])","if(!dot){ if(Pp['dr.oil'])",'Hair Gone White'],
  ['Lightning Lines 4 s',FXJ,"{mark:'iv_ll',on:'source',dur:3}","{mark:'iv_ll',on:'source',dur:4}",'Hair Gone White'],
  ['Close Cover within 4 m',FXJ,"u.alive&&A.gap(u,x)<2*A.eng().METER(); },","u.alive&&A.gap(u,x)<4*A.eng().METER(); },",'Hair Gone White'],
  ['Planted Feet half',FXJ,"u.x=f.x+(u.x-f.x)*(1-k);","u.x=f.x+(u.x-f.x)*(1-k/2);",'Hair Gone White'],
  ['Planted Feet ignores pulls',FXJ,"else if(c.kind==='pull'&&(u.pullSpeed||0)>0) u.pullSpeed*=(1-k);","",'Hair Gone White'],
  ['Lit Spear on any enemy',FXJ,"if(Pp['crit.ls']&&c.tgt&&A.markOf(u,c.tgt,'iv_lit'))","if(Pp['crit.ls']&&c.tgt)",'critical-chance'],
];
const SKIP=new Set(['.tmp','.logs','.remote-logs','.git','.base','.bin','node_modules','assets','backups']);
/* the copy: our own walk (fs.cpSync refuses to copy a folder into one of its own subfolders, and the temp folder sits inside the slot) */
function copyTree(src,dst){ fs.mkdirSync(dst,{recursive:true}); for(const e of fs.readdirSync(src,{withFileTypes:true})){ if(src===root&&(SKIP.has(e.name)||e.name.startsWith('.ctl-'))) continue;
    const a=path.join(src,e.name), b=path.join(dst,e.name); if(e.isDirectory()) copyTree(a,b); else if(e.isFile()) fs.copyFileSync(a,b); } }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ivc-'));
  try{ copyTree(root,dir); if(fs.existsSync(path.join(root,'node_modules'))) fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'));
    const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), eol=s.indexOf('\r\n')>=0?'\r\n':'\n', a=from.replace(/\n/g,eol), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to.replace(/\n/g,eol)));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-iver.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1; return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.env.ONLY){ const w=process.env.ONLY.split('|'); for(let k=C.length-1;k>=0;k--) if(!w.some(x=>C[k][0].indexOf(x)>=0)) C.splice(k,1); }
const out=[]; for(const c of C){ const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
