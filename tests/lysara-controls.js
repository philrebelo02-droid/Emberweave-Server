'use strict';
/* The controls for Lysara's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder (os.tmpdir(): the runner points it at the slot's own folder on disk), breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the
   generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a primitive or a row of hers broken), runs the named tests of
   tests/talents-mech-lysara.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child processes); each copy is deleted when its run is
   done. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   Run: node tests/lysara-controls.js [name filter] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', DRAW='brnd();';
const WAKE="&&!(battleTime<(tgt._talZzA||0))){ tgt._sleepT=0; tgt.stunned=0; }";
const PASS="        if(u.pass.slumber&&t&&u._tal&&u._tal.on.pass) TalentFx.pass(u,t,'slumber');";
const PICK="  if(u._tal&&u._tal.on.pickTgt&&!(u.forcedTargetT>0";
const CAST="  if(u._talW&&u._castSlot) TalentFx.teamCast(u,type,o);";
const C=[
  // ---- the page sites: hook removed (her tests fail) ----
  ['wake-line guard removed (Sound Sleep)',HTML,WAKE,"){ tgt._sleepT=0; tgt.stunned=0; }",'Sound Sleep'],
  ['Powdered Slumber pass hook removed',HTML,PASS,'','Powdered Slumber at a real swing'],
  ['pickTgt hook removed',HTML,PICK,"  if(false&&u._tal&&u._tal.on.pickTgt&&!(u.forcedTargetT>0",'The Lantern'],
  ['teamCast hook removed',HTML,CAST,'','Wing Dust|Wildfire|Snuffed'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the wake line',HTML,WAKE,"&&!(battleTime<(tgt._talZzA||0))&&(brnd()>=0)){ tgt._sleepT=0; tgt.stunned=0; }",'no talents'],
  ['draw at the Powdered Slumber site',HTML,PASS,'        '+DRAW+PASS.slice(7),'no talents'],
  ['draw at the target pick',HTML,PICK,'  '+DRAW+PICK.slice(1),'no talents'],
  ['draw at an enemy cast',HTML,CAST,'  '+DRAW+CAST.slice(1),'no talents'],
  // ---- the engine pieces ----
  ['teamCast runs no rows',FXJ,"      run(Tw,w,'teamCast',{u:w,src:u,tgt:u,unit:u,skill:type,slot:u._castSlot,o:o||{}}); } }","      } }",'Wing Dust'],
  ['teamCast does not turn the watch on',FXJ,"||T.on.teamHeld||T.on.teamCast||","||T.on.teamHeld||",'Wildfire'],
  ['pickTgt ignores its rows',FXJ,"if(T.on.pickTgt) run(T,u,'pickTgt',ctx); return ctx.tgt||t; }","return t; }",'The Lantern'],
  // ---- her rows and caps ----
  ['Drowse sleeps at 6',FXJ,"if(nw>=(r.ln_3_1?4:5)) trySleep","if(nw>=(r.ln_3_1?4:6)) trySleep",'Drowse: 1'],
  ['Drowse 0.3 s a rank',FXJ,"putSleep(A,T,u,t,0.25*r.ln_1_1*","putSleep(A,T,u,t,0.30*r.ln_1_1*",'Drowse: 1'],
  ['Drowse gate 11 s',FXJ,"(r.ln_9_4&&psFull(A,T,u,t))?6:12","(r.ln_9_4&&psFull(A,T,u,t))?6:11",'Drowse: 1'],
  ['Black Window 7 s',FXJ,"(r.ln_9_4&&psFull(A,T,u,t))?6:12","(r.ln_9_4&&psFull(A,T,u,t))?7:12",'Lullaby'],
  ['Drowse on a stunned enemy',FXJ,"  if((t.stunned||0)>0||now<((s.lk||{})[t.uid]||0)) return;","  if(now<((s.lk||{})[t.uid]||0)) return;",'Drowse: 1'],
  ['no 0.5 s lock',FXJ,"const LOCK=0.5;","const LOCK=0;",'Sound Sleep'],
  ['Heavy Head ignored',FXJ,"(r.ln_3_1?4:5)","(5)",'Sound Sleep'],
  ['Wide Awake 1 s a rank',FXJ,"haunt(A,T,u,t,2*r.ln_n1)","haunt(A,T,u,t,1*r.ln_n1)",'Sound Sleep'],
  ['Sound Sleep not set',FXJ,"if(kind==='drowse'&&T.P.ss) t._talZzA=","if(false) t._talZzA=",'Sound Sleep'],
  ['Slow Breathing 3%',FXJ,"ln_n2:[ {param:'sb',add:R(0.02)} ],","ln_n2:[ {param:'sb',add:R(0.03)} ],",'made longer'],
  ['no 4.0 s cap',FXJ,"const CAP=4.0;","const CAP=9;",'made longer'],
  ['Slow Wingbeat not added',FXJ,"if(Pp.swb) t.slow=","if(false) t.slow=",'made longer'],
  ['Queen\'s Grace multiplies',FXJ,"if(Pp.qg) c.o.buff=(c.o.buff||1.3)+Pp.qg;","if(Pp.qg) c.o.buff=(c.o.buff||1.3)*(1+Pp.qg);",'made longer'],
  ['Haunting 0.5',FXJ,"ln_6_4:[ {param:'haunt',add:R(0.4)} ],","ln_6_4:[ {param:'haunt',add:R(0.5)} ],",'Haunted: Nightmare'],
  ['Nightmare 3%',FXJ,"if(r.ln_2_2&&A.markOf(u,s,'ha')) k*=1-0.02*r.ln_2_2;","if(r.ln_2_2&&A.markOf(u,s,'ha')) k*=1-0.03*r.ln_2_2;",'Haunted: Nightmare'],
  ['Moth Hide on allies',FXJ,"if(me&&r.ln_10_4&&","if(r.ln_10_4&&",'Haunted: Nightmare'],
  ['Moonless 2%',FXJ,"if(r.ln_5_4&&A.markOf(u,t,'ha')) k*=1+0.015*r.ln_5_4;","if(r.ln_5_4&&A.markOf(u,t,'ha')) k*=1+0.02*r.ln_5_4;",'Haunted: Nightmare'],
  ['Bad Dreams 6%',FXJ,"ln_6_2:[ {on:'teamHeal',if:{unitHas:'ha'},less:R(0.05)} ],","ln_6_2:[ {on:'teamHeal',if:{unitHas:'ha'},less:R(0.06)} ],",'Haunted: Nightmare'],
  ['Night Terrors x1',FXJ,"if(z.kind==='ult'&&r.ln_7_2) d=2*hd;","if(z.kind==='ult'&&r.ln_7_2) d=hd;",'Night Terrors'],
  ['Twin Dreams passes on',FXJ,"if(r.ln_5_2&&!twin){","if(r.ln_5_2){",'Twin Dreams'],
  ['Twin Dreams 2 Drowse',FXJ,"drowseAdd(A,T,u,x,3,true); } }","drowseAdd(A,T,u,x,2,true); } }",'Twin Dreams'],
  ['Dreamcatcher 4%',FXJ,"apNow(u)*0.03*r.ln_11_1","apNow(u)*0.04*r.ln_11_1",'Twin Dreams'],
  ['Sleep Paralysis 0.5 s',FXJ,"if(r.ln_10_1) A.control(T,u,t,'silencedT',1);","if(r.ln_10_1) A.control(T,u,t,'silencedT',0.5);",'Twin Dreams'],
  ['Weight of Night 5%',FXJ,"k*=1+0.04*r.ln_12_1;","k*=1+0.05*r.ln_12_1;",'Twin Dreams'],
  ['Stopped Clock 2 s',FXJ,"={t,until:now+1,g:t.greenCd||0","={t,until:now+2,g:t.greenCd||0",'Stopped Clock'],
  ['Lullaby wakes',FXJ,"if(r.ln_8_1){ t._talZz=u;","if(false){ t._talZz=u;",'Lullaby'],
  ['Lamp Out 3%',FXJ,"ln_5_1:[ {stat:{armor:R(-0.02),mr:R(-0.02)}","ln_5_1:[ {stat:{armor:R(-0.03),mr:R(-0.02)}",'Lullaby'],
  ['Grey Hours 0.6%',FXJ,"1-0.005*r.ln_10_3*T.s.nz","1-0.006*r.ln_10_3*T.s.nz",'Lullaby'],
  ['Deep Lull 4 sleeps',FXJ,"if(L.length<3){ L.push(now);","if(L.length<4){ L.push(now);",'Lullaby'],
  ['Hush 7 s',FXJ,"if(r.ln_13_2){ s.hush=now+6;","if(r.ln_13_2){ s.hush=now+7;",'Hush'],
  ['Hush twice per enemy',FXJ,"&&z.kind!=='hush'&&t.alive&&!s.hd[t.uid]){ s.hd[t.uid]=1;","&&t.alive){ s.hd[t.uid]=1;",'Hush'],
  ['Hush no gap',FXJ,"(s.hq||(s.hq=[])).push({t,at:now+LOCK});","(s.hq||(s.hq=[])).push({t,at:now});",'Hush'],
  ['Hush energy 4',FXJ,"if(!x._summon) nrg(x,5);","if(!x._summon) nrg(x,4);",'Hush'],
  ['Moon 9 s',FXJ,"const mIdx=T=>Math.floor((T.s.mt||0)/8+1e-9);","const mIdx=T=>Math.floor((T.s.mt||0)/9+1e-9);",'Moon Phase'],
  ['Lunar Clock 5',FXJ,"if(r.sd_8_1) nrg(u,4*r.sd_8_1);","if(r.sd_8_1) nrg(u,5*r.sd_8_1);",'Moon Phase'],
  ['Full Moon not spent',FXJ,"if(s.fm){ s.fm=false; k+=0.25; }","if(s.fm){ k+=0.25; }",'Moon Phase'],
  ['Syzygy 5 s',FXJ,"if(r.sd_9_1&&p%3===0) s.syz=s.mt+4;","if(r.sd_9_1&&p%3===0) s.syz=s.mt+5;",'Moon Phase'],
  ['Tidal Heart 2 points',FXJ,"sd_12_1:[ {param:'moon',add:R(0.01)} ],","sd_12_1:[ {param:'moon',add:R(0.02)} ],",'Moon Phase'],
  ['Moon Basin no cap',FXJ,"const h=Math.min(q.b,apNow(u)*0.02*r.sd_11_1);","const h=apNow(u)*0.02*r.sd_11_1;",'New Moon'],
  ['New Moon 3 s',FXJ,"A.setMark(T,u,t,'nm',{dur:2});","A.setMark(T,u,t,'nm',{dur:3});",'New Moon'],
  ['Spun Fine 4%',FXJ,"k+=0.03*(r.sd_8_2||0);","k+=0.04*(r.sd_8_2||0);",'her link'],
  ['Kind Dreams 5%',FXJ,"k+=0.04*(r.sd_4_3||0);","k+=0.05*(r.sd_4_3||0);",'her link'],
  ['Dreamshare full strength',FXJ,"A.eng().damage(p,cut*0.5,","A.eng().damage(p,cut,",'her link'],
  ['Shared Breath off',FXJ,"if(r.sd_3_2&&p) E.healUnit(p,got*0.03*r.sd_3_2);","",'her link'],
  ['One Dream 50%',FXJ,"const ns=cur*0.4;","const ns=cur*0.5;",'her link'],
  ['Lamp in the Window 5%',FXJ,"else k*=1-0.04; }","else k*=1-0.05; }",'her link'],
  ['Bound Hearts 25%',FXJ,"if(r.sd_5_2&&A.markOf(u,x,'bh')) k+=0.30;","if(r.sd_5_2&&A.markOf(u,x,'bh')) k+=0.25;",'Bound Hearts'],
  ['Wide Weave no share',FXJ,"if(x===w.c&&w.a.alive) E.healUnit(w.a,got*0.35);","if(false) E.healUnit(w.a,got*0.35);",'Bound Hearts'],
  ['Hatching never on time-out',FXJ,"if(!broke&&(r.sd_1_4","if(false&&(r.sd_1_4",'her cocoons'],
  ['Hatchling 20%',FXJ,"hatch(A,T,u,a,0.15*r.sd_11_3)","hatch(A,T,u,a,0.20*r.sd_11_3)",'her cocoons'],
  ['Molting on a half-hatch',FXJ,"if(r.sd_3_4&&k>=1)","if(r.sd_3_4)",'her cocoons'],
  ['Night Bloom 4%',FXJ,"E.healUnit(a,a.maxHp*0.03*r.sd_6_3)","E.healUnit(a,a.maxHp*0.04*r.sd_6_3)",'her cocoons'],
  ['Pupa 3%',FXJ,"k*=1-0.02*r.sd_5_4;","k*=1-0.03*r.sd_5_4;",'her cocoons'],
  ['Second Skin 70%',FXJ,"*s.ss.mul*0.6;","*s.ss.mul*0.7;",'Second Skin'],
  ['Under Her Wing 3 allies',FXJ,".sort((a,b)=>a[1]-b[1]).slice(0,2);   // Under Her Wing",".sort((a,b)=>a[1]-b[1]).slice(0,3);   // Under Her Wing",'Second Skin'],
  ['Shared Dream twice a fight',FXJ,"if(U[x.uid]||!linked(A,T,u,x)) return;","if(!linked(A,T,u,x)) return;",'Shared Dream'],
  ['Shared Dream 1 s',FXJ,"(s.sdW||(s.sdW={}))[x.uid]=now+2;","(s.sdW||(s.sdW={}))[x.uid]=now+1;",'Shared Dream'],
  ['Shared Dream cocoon 2x',FXJ,"cocoon(A,T,u,x,3*apNow(u),c)","cocoon(A,T,u,x,2*apNow(u),c)",'Shared Dream'],
  ['Restless Queen 5%',FXJ,"sd_7_4:[ {on:'ccIn',less:R(0.04)} ],","sd_7_4:[ {on:'ccIn',less:R(0.05)} ],",'Restless Queen'],
  ['flare 4% a Dust',FXJ,"let a=apNow(u)*0.03*Math.max(1,r.lm_1_1||0)*n*k;","let a=apNow(u)*0.04*Math.max(1,r.lm_1_1||0)*n*k;",'Wing Dust'],
  ['Dust not spent',FXJ,"A.ustPut(T,u,t,'du',keep,6+(T.P['du.dur']||0));","",'Wing Dust'],
  ['Ember Moth ignored',FXJ,"const E=A.eng(), x=0.02*(T.r.lm_11_1||0);","const E=A.eng(), x=0;",'Wing Dust'],
  ['Pale Fire counts 4',FXJ,"Math.min(3,m)","Math.min(4,m)",'Wing Dust'],
  ['Lantern: the lowest ability power',FXJ,"const v=x.apow||0; if(v>bv){ bv=v; b=x; }","const v=-(x.apow||0); if(v>bv){ bv=v; b=x; }",'The Lantern'],
  ['Lightless 3%',FXJ,"if(r.lm_8_3&&isLan(A,T,u,t)) k*=1+0.02*r.lm_8_3;","if(r.lm_8_3&&isLan(A,T,u,t)) k*=1+0.03*r.lm_8_3;",'The Lantern'],
  ['Self-Snuffing keeps all',FXJ,"Math.floor(A.ustGet(T,u,t,'du')/2):0;","A.ustGet(T,u,t,'du'):0;",'The Lantern'],
  ['Lamp Black no Dust',FXJ,"if(n>0) dustAdd(A,T,u,L,n,true); } }","} }",'The Lantern'],
  ['Ash Wings 3 m',FXJ,"{team:'enemy',of:'unit',within:2,skip:'unit'},c)) done+=flare","{team:'enemy',of:'unit',within:0.01,skip:'unit'},c)) done+=flare",'Ash Wings'],
  ['Choking Flare 1 s',FXJ,"A.control(T,u,t,'silencedT',0.6);","A.control(T,u,t,'silencedT',1);",'Ash Wings'],
  ['Moth Swarm off',FXJ,"if(E.rnd()<0.2*T.r.lm_10_3) dustAdd(A,T,u,x,1,true); } }","} }",'Ash Wings'],
  ['Wick 2%',FXJ,"k*=1+0.01*r.lm_7_1*n;","k*=1+0.02*r.lm_7_1*n;",'Ash Wings'],
  ['Wildfire 1 Dust',FXJ,"dustAdd(A,T,u,x,2); } }","dustAdd(A,T,u,x,1); } }",'Wildfire'],
  ['Snuffed Light single',FXJ,"k:A.markOf(u,t,'sn')?2:1","k:1",'Snuffed'],
  ['Lost Aim 4%',FXJ,"if(!(A.eng().rnd()<0.03*r.lm_1_4)) return false;","if(!(A.eng().rnd()<0.04*r.lm_1_4)) return false;",'full Powdered Slumber'],
  ['Fumble 0.2',FXJ,"(u.blueCd||0)-0.1*r.lm_6_4","(u.blueCd||0)-0.2*r.lm_6_4",'full Powdered Slumber'],
  ['Once Burned on basic attacks',FXJ,"if(me&&r.lm_n1&&!auto)","if(me&&r.lm_n1)",'full Powdered Slumber'],
  ['Choking Dust 2 s',FXJ,"ln_8_4:[ {param:'ps.hold',add:R(1)} ],","ln_8_4:[ {param:'ps.hold',add:R(2)} ],",'Powdered Slumber at a real swing'],
  ['Into the Flame single',FXJ,"done+=flare(A,T,u,x,n,2); } }","done+=flare(A,T,u,x,n,1); } }",'Into the Flame'],
  ['Into the Flame no silence',FXJ,"if(L.alive) A.control(T,u,L,'silencedT',2); }","}",'Into the Flame'],
  ['group cap 30% on her',FXJ,"return Math.max(me?0.65:0.75,k); }","return Math.max(me?0.70:0.75,k); }",'ONE group'],
  ['group cap 20% on allies',FXJ,"return Math.max(me?0.65:0.75,k); }","return Math.max(me?0.65:0.80,k); }",'ONE group'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-lyc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-lysara.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
