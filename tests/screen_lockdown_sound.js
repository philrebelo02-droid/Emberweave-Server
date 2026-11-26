'use strict';
/* Lockdown audit 25 Nov 2026, round 4, section 27 - Sound (account-hud-sound-servers.md, UNPROVEN-ON-SCREEN):
   - Sound matches the animation: real fights in the REAL page (Chromium, the game's own render loop) with a real but SILENT audio context
     (every path to the speakers goes through a gain of 0, as test_mute_music_1159 does) and the game's rig log on (SFX.log). Every scheduled
     sound's PEAK is matched to the frame its blow / release / arrival is drawn (the timing rule of test_combat_sfx_1138) and must land within
     one 30 fps frame (33 ms) of it; and the RIGHT FILE: an attack plays the hero's weapon / swing file (or one of its fused copies), a spell
     plays a file of that spell's own row. If this Chromium cannot decode a .m4a, that file is given a silent buffer of the manifest's length
     (the schedule only needs its length and its measured peak) - the test prints how many were decoded for real.
   - Speed independent: the same at 2x speed, and a fight paused (the Pause button) while a hero casts: the peaks still meet their frames and
     no sound starts inside the pause.
   - Battle music loops: each of the 10 battle songs is started on the battle lane and taken past its loop end twice; MUS.log 'seam' entries:
     the old element leaves within 50 ms of loopEnd, the new one plays from loopStart, the same song, no 'heal' between.
   - Same loudness: every combat sound file re-measured with tools/sfx_loudness.py (max momentary LUFS, BS.1770) within the manifest's
     tolerance (2 LU) of -16 LUFS-M + its offset.
   Desktop 1280x720 and phone 844x390 (touch) for the fights; the music once (phone). Screenshots: SHOT64 lines.
   Every check prints what it measured. Exit 0 = all passed. */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_sound.js', C=H.checker(TEST), shot=H.shooter(TEST);
const ROOT=H.ROOT, NAME='Screen Check';
const MAN=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/audio/sfx/sfx_manifest.json'),'utf8'));
const DUR={}; for(const v of Object.values(MAN.files)) DUR[v.f]=v.dur;
const FRAME=1/30;
/* melee (vex, grosk, aureth, korvux, brannus), ranged (sloe bow, rafe gun + cutlass), casters (fritz, konwu, lumi, sylthaine), spells on every side */
const FIGHTS=[
  {tag:'fight 1 (1x)',ally:['vex','grosk','sloe','fritz','aureth'],foe:['tick','ceraline','sylthaine','vireo','oakmir'],speed:1,pause:false},
  {tag:'fight 2 (2x)',ally:['konwu','vael','rafe','lumi','korvux'],foe:['vex','grosk','umbris','maren','brannus'],speed:2,pause:false},
  {tag:'fight 3 (1x, paused mid-cast)',ally:['vex','grosk','sloe','fritz','aureth'],foe:['konwu','rafe','umbris','maren','oakmir'],speed:1,pause:true},
];
const HEROES={}; for(const F of FIGHTS) for(const k of F.ally.concat(F.foe)) HEROES[k]=30;
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const SILENT = () => {   // every path to the speakers goes through a gain of 0 (test_mute_music_1159)
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); };
  window.__AC = []; const AC = window.AudioContext; window.AudioContext = function () { const c = new AC(...arguments); window.__AC.push(c); return c; };
  window.AudioContext.prototype = AC.prototype; window.webkitAudioContext = window.AudioContext;
};

let _br=null;
async function browser(){ if(_br) return _br; const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
  _br=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output','--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']}); return _br; }

/* the game signed in as the seeded player (as H.game does), with the real silent audio context instead of H.game's stand-in */
async function soundGame(port,S){ const b=await browser();
  const ctx=await b.newContext(Object.assign({viewport:{width:S.w,height:S.h},locale:'en-US',serviceWorkers:'block'},S.touch?{hasTouch:true,isMobile:true,deviceScaleFactor:2}:{}));
  await ctx.addInitScript(SILENT);
  await ctx.addInitScript(([tok,uid,name])=>{ try{ localStorage.setItem('ew_acc',JSON.stringify({token:tok,name,rank:1,coins:0,id:uid,created:Date.now()-1000})); localStorage.setItem('ew_lang','en'); localStorage.setItem('ew_guest_step_'+uid,'1'); }catch(e){} },[H.TOKEN,H.UID,NAME]);
  const pg=await ctx.newPage(); pg._errs=[]; pg.on('pageerror',e=>pg._errs.push(String(e.message).slice(0,200))); pg.on('dialog',d=>d.dismiss().catch(()=>{}));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await pg.goto('http://127.0.0.1:'+port+'/play',{waitUntil:'domcontentloaded',timeout:180000});
  await pg.waitForFunction(()=>typeof renderHeroDetail==='function'&&typeof api==='function'&&typeof adoptLedger==='function'&&typeof sndLoad==='function'&&typeof _startVersusNow==='function',null,{timeout:180000});
  /* a file this Chromium cannot decode gets a silent buffer of the manifest's length (the schedule uses only its length + measured peak) */
  const wrapped=await pg.evaluate(DUR=>{ window.__snd={real:0,filled:0,sample:[]};
    const fill=f=>{ const d=DUR[f]; if(!d||!SND.ctx) return; const sr=SND.ctx.sampleRate; SND.buf[f]=SND.ctx.createBuffer(1,Math.max(1,Math.round(d*sr)),sr); window.__snd.filled++; if(window.__snd.sample.length<4) window.__snd.sample.push(f); };
    window.__sndFill=()=>{ for(const f in SND.buf) if(SND.buf[f]===null&&DUR[f]) fill(f); };
    const o=sndLoad; sndLoad=function(f){ const p=o(f); if(p&&p.then&&!p.__w){ p.__w=1; p.then(b=>{ if(b){ if(DUR[f]) window.__snd.real++; } else if(DUR[f]) fill(f); }); } return p; }; sndLoad.__w=1;
    return typeof sndLoad==='function'&&sndLoad.__w===1; },DUR);
  await wait(1500); await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await wait(1000);
  const ok=await pg.evaluate(async()=>{ G.tutSkipped=true; G.tutDone=true; G.ftutOff=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); const d=await ledgerSync(); return !!(d&&ACC.token); });
  if(!ok) throw new Error('could not sign in as the seeded player');
  await pg.evaluate(()=>langSet('en',{save:true}));
  const snd=await pg.evaluate(async()=>{ SND.cfg.fx.on=true; SND.cfg.music.on=true; sndUnlock(); for(let i=0;i<50&&!(SND.ctx&&SND.ctx.state==='running');i++){ try{ SND.ctx&&SND.ctx.resume(); }catch(e){} await new Promise(r=>setTimeout(r,100)); }
    for(let i=0;i<80&&Object.keys(SND.pend).length;i++) await new Promise(r=>setTimeout(r,100)); window.__sndFill();
    return {state:SND.ctx&&SND.ctx.state,mstate:SND.mctx&&SND.mctx.state,rate:SND.ctx&&SND.ctx.sampleRate,splash:splashOn(),real:window.__snd.real,filled:window.__snd.filled,gated:document.body.classList.contains('gated')}; });
  pg._ctx=ctx; return {pg,wrapped,snd}; }

/* one fight through the game's own loop; returns the rig log and what the fight did */
async function fight(pg,F,S){
  await pg.evaluate(()=>{ try{ show('home'); }catch(e){} }); await wait(800);
  await pg.evaluate(F=>{ G.team=F.ally.slice(); CUR={node:1,mode:'arena'}; _startVersusNow(F.foe.map(k=>({key:k,level:30,rank:3})),true,F.ally); paused=true; },F);
  /* the heroes' own sounds load with the fight (sfxPrimeHero): wait for them, then the fight runs */
  const ld=await pg.evaluate(async()=>{ const need=()=>{ const s=new Set(); units.forEach(u=>{ const Hh=SFX_DATA.heroes[u.key]; if(Hh) sfxFiles(Hh).forEach(n=>{ const Fd=SFX_DATA.files[n]; if(Fd) s.add(Fd[0]); }); }); return [...s]; };
    let miss=[]; for(let i=0;i<200;i++){ window.__sndFill(); miss=need().filter(f=>!SND.buf[f]); if(!miss.length) break; await new Promise(r=>setTimeout(r,100)); }
    return {files:need().length,missing:miss.length,missSample:miss.slice(0,3)}; });
  const go=await pg.evaluate(sp=>{ SFX.log=[]; SFX.last={}; window.__fr=[]; window.__fa=[]; let last=performance.now(); window.__frOn=true;
    const tick=t=>{ if(!window.__frOn) return; window.__fr.push(t-last); last=t; window.__fa.push([+t.toFixed(2),+SND.ctx.currentTime.toFixed(4)]); requestAnimationFrame(tick); }; requestAnimationFrame(tick);   /* each frame: its time + the audio clock, to find the hitches */
    autoUlt=true; gameSpeed=sp; paused=false; try{ refreshCtrlBtns(); }catch(e){} return {state,speed:gameSpeed,units:units.length,ctx:SND.ctx.state,live:SFX.loop}; },F.speed);
  const shots=[]; let pauseWin=null; const t0=Date.now(); let shotAt=4000;
  for(;;){ await wait(100);
    const st=await pg.evaluate(()=>({ended,bt:battleTime,casting:units.filter(u=>u.alive&&u._castSlot).map(u=>u.key+':'+u._castSlot)}));
    if(Date.now()-t0>=shotAt&&shots.length<2){ shots.push(await shot(pg,S.tag+' Sound matches the animation '+F.tag+' at '+st.bt.toFixed(1)+' s')); shotAt+=8000; }
    if(F.pause&&!pauseWin&&st.bt>3&&(st.casting.length||st.bt>15)){
      pauseWin=await pg.evaluate(async c=>{ document.getElementById('pauseBtn').click(); const p0=SND.ctx.currentTime, b0=battleTime; await new Promise(r=>setTimeout(r,2000));
        const p1=SND.ctx.currentTime, b1=battleTime; document.getElementById('resumeBtn').click(); return {p0:+p0.toFixed(4),p1:+p1.toFixed(4),b0,b1,casting:c}; },st.casting);
      shots.push(await shot(pg,S.tag+' Speed independent '+F.tag+' resumed')); }
    if(st.ended||Date.now()-t0>40000) break; }
  const out=await pg.evaluate(keys=>{ window.__frOn=false; const fr=(window.__fr||[]).slice(2).sort((a,b)=>a-b), q=p=>fr.length?+fr[Math.min(fr.length-1,Math.floor(fr.length*p))].toFixed(1):null;
    const T={}; keys.forEach(k=>{ const Hh=SFX_DATA.heroes[k]; if(!Hh) return; const rows={}; ['green','blue','ult','passive'].forEach(sl=>{ rows[sl]=(Hh[sl]||[]).map(r=>({id:r.id,f:r.f})); });
      T[k]={atk:Hh.atk||null,melee:Hh.melee||null,arm:Hh.arm||null,rows}; });
    const fused={}; Object.values(T).forEach(t=>{ [t.atk,t.melee].concat(t.arm?Object.values(t.arm):[]).forEach(n=>{ if(n&&SFX_DATA.fused&&SFX_DATA.fused[n]) fused[n]=SFX_DATA.fused[n]; }); });
    return {fa:window.__fa||[],log:SFX.log||[],ended,bt:battleTime,speed:gameSpeed,rate:sfxRate(),ctx:SND.ctx.state,frames:fr.length,med:q(.5),p90:q(.9),T,fused,snd:window.__snd}; },F.ally.concat(F.foe));
  await pg.evaluate(()=>{ try{ show('home'); }catch(e){} SFX.log=null; }); await wait(600);
  return Object.assign(out,{ld,go,pauseWin,shots}); }

/* a hitch = a frame gap over 50 ms (the loop's clamp): the game's own rule (sfxFrame) is that a one-off hitch cannot be foreseen, so a sound whose
   window - from the frame it was handed to the audio clock (its play note) to the frame its blow is drawn on - holds a hitch is reported apart */
function hitchIn(FA,lo,hi){ for(let i=1;i<FA.length;i++){ const a=FA[i][1]; if(a>lo-5e-4&&a<=hi+5e-4&&FA[i][0]-FA[i-1][0]>50) return +(FA[i][0]-FA[i-1][0]).toFixed(1); } return 0; }
/* test_combat_sfx_1138's timing rule: each play matched to the frame its moment is drawn on (P: a pause window - sounds whose window spans it are reported apart) */
function timing(L,FA,P){ let matched=0, unmatched=0, entered=0; const kinds={}, clean=[], hitched=[], spanned=[];
  const moments=L.filter(e=>e.k==='blow'||e.k==='fire'||e.k==='arrive');
  L.filter(e=>e.k==='play').forEach(e=>{ kinds[e.kind||'?']=(kinds[e.kind||'?']||0)+1; });
  L.filter(e=>e.k==='play'&&e.due!=null&&(e.kind==='attack'||e.kind==='release'||e.kind==='land'||e.kind==='hit')).forEach(e=>{ let m=null;
    if(e.kind==='attack') m=moments.find(q=>q.k==='blow'&&q.hero===e.hero&&Math.abs(q.due-e.due)<1e-3&&Math.abs(q.bt-e.due)<1e-3);
    else if(e.kind==='release') m=moments.find(q=>q.k==='fire'&&q.hero===e.hero&&Math.abs(q.bt-e.due)<1e-3);
    else if(e.why==='instant'||e.why==='window'||e.why==='strike') m={rt:e.rt};
    else m=moments.find(q=>q.k==='arrive'&&q.hero===e.hero&&Math.abs(q.due-e.due)<1e-3&&Math.abs(q.bt-e.due)<1e-3);
    if(!m){ unmatched++; return; } matched++; if(e.off>0) entered++;
    const lo=Math.min(e.rt,m.rt), hi=Math.max(e.rt,m.rt), row={hero:e.hero,name:e.name,kind:e.kind,why:e.why,bt:e.bt,handed:e.rt,peakAt:e.peakAt,frame:m.rt,errMs:+((e.peakAt-m.rt)*1000).toFixed(1)};
    if(P&&lo<P.p1&&hi>P.p0){ spanned.push(row); return; }
    const hz=hitchIn(FA||[],lo,hi); if(hz){ row.hitchMs=hz; hitched.push(row); return; } clean.push(row); });
  const byErr=a=>a.slice().sort((x,y)=>Math.abs(y.errMs)-Math.abs(x.errMs));
  const worst=byErr(clean), wh=byErr(hitched), ws=byErr(spanned);
  return {matched,clean:clean.length,unmatched,entered,maxErrMs:worst.length?worst[0].errMs:0,worst10:worst.slice(0,10),
    hitched:hitched.length,hitchWorst:wh[0]||null,spanned:spanned.length,spanWorst:ws[0]||null,kinds,
    misses:L.filter(e=>e.k==='miss').length,missNames:[...new Set(L.filter(e=>e.k==='miss').map(e=>e.name))].slice(0,6),drops:L.filter(e=>e.k==='drop').length}; }

/* the right file for the moment: attack = the hero's weapon / swing (+ its fused copies); a spell = a file of that spell's own row */
function files(R){ let ok=0; const bad=[];
  R.log.filter(e=>e.k==='play'&&e.hero).forEach(e=>{ const t=R.T[e.hero]; if(!t){ bad.push({hero:e.hero,name:e.name,why:'no sound table for this hero'}); return; }
    if(e.kind==='attack'){ const base=[t.atk,t.melee].concat(t.arm?Object.values(t.arm):[]).filter(Boolean);
      const good=base.includes(e.id)&&e.name===(e.fused||e.id)&&(!e.fused||((R.fused[e.id]||[]).includes(e.fused)));
      if(good) ok++; else bad.push({hero:e.hero,id:e.id,name:e.name,fused:e.fused,want:base}); return; }
    const rows=[].concat(t.rows.green,t.rows.blue,t.rows.ult,t.rows.passive).filter(r=>r.id===e.id);
    if(rows.some(r=>(r.f||[]).includes(e.name))) ok++; else bad.push({hero:e.hero,id:e.id,name:e.name,kind:e.kind,rowFound:rows.length}); });
  return {ok,bad}; }

async function sizeRun(port,S){
  const {pg,wrapped,snd}=await soundGame(port,S); const res=[];
  {
    C.ok(wrapped&&snd.state==='running'&&!snd.splash&&!snd.gated,S.tag+' Sound matches the animation: the page\'s real audio context runs (silent rig), the splash is gone',
      {wrapped,snd,note:'decoded for real: '+snd.real+', given a silent buffer of the manifest length (this Chromium cannot decode them): '+snd.filled});
    for(const F of FIGHTS){
      try{ const R=await fight(pg,F,S); R.F=F; R.tm=timing(R.log,R.fa,R.pauseWin); R.fl=files(R); res.push(R);
        console.log('  INFO   '+S.tag+' '+F.tag+': '+R.log.filter(e=>e.k==='play').length+' sounds played, kinds '+JSON.stringify(R.tm.kinds)+', ended '+R.ended+' at battle '+R.bt.toFixed(1)+' s, speed '+R.speed+
          ', frames '+R.frames+' (median '+R.med+' ms, p90 '+R.p90+' ms), loaded '+JSON.stringify(R.ld)+', decode '+JSON.stringify(R.snd));
        console.log('  INFO   '+S.tag+' '+F.tag+' timing: '+R.tm.matched+' matched; '+R.tm.clean+' with no hitch in their window (checked); '+R.tm.hitched+' left out for a frame hitch over 50 ms between hand-over and blow frame (worst of those '+JSON.stringify(R.tm.hitchWorst)+')'+
          (R.pauseWin?'; '+R.tm.spanned+' whose window spans the pause (worst '+JSON.stringify(R.tm.spanWorst)+')':''));
        console.log('  INFO   '+S.tag+' '+F.tag+' the 10 worst checked sounds: '+JSON.stringify(R.tm.worst10));
      }catch(e){ C.ok(false,S.tag+' '+(F.speed===2||F.pause?'Speed independent':'Sound matches the animation')+': '+F.tag+' ran to the end',String(e&&e.stack||e).slice(0,500)); } }
    const one=res.find(r=>r.F===FIGHTS[0]), two=res.find(r=>r.F===FIGHTS[1]), three=res.find(r=>r.F===FIGHTS[2]);
    if(one){ const t=one.tm;
      C.ok(t.clean>=30&&Math.abs(t.maxErrMs)<=FRAME*1000+1e-6&&one.ctx==='running',S.tag+' Sound matches the animation: '+t.clean+' sounds with no frame hitch in their window meet the frame their blow / release / arrival is drawn on, worst peak-vs-frame '+t.maxErrMs+' ms (limit one 30 fps frame, 33.3 ms; '+t.hitched+' left out for a hitch)',
        {checked:t.clean,hitched:t.hitched,hitchWorst:t.hitchWorst,worst10:t.worst10,matched:t.matched,unmatched:t.unmatched,entered:t.entered,misses:t.misses,missNames:t.missNames,drops:t.drops,frameMed:one.med,frameP90:one.p90,shots:one.shots});
      C.ok(one.fl.ok>=30&&one.fl.bad.length===0,S.tag+' Sound matches the animation: the right file plays on each moment ('+one.fl.ok+' sounds: attacks play the hero\'s own weapon / swing file or one of its fused copies, spells a file of that spell\'s own row)',
        {ok:one.fl.ok,wrong:one.fl.bad.slice(0,8),wrongCount:one.fl.bad.length,shots:one.shots}); }
    if(two){ const t=two.tm;
      C.ok(two.speed===2&&t.clean>=30&&Math.abs(t.maxErrMs)<=FRAME*1000+1e-6,S.tag+' Speed independent: at 2x speed '+t.clean+' sounds with no frame hitch in their window meet their frames, worst '+t.maxErrMs+' ms (limit 33.3 ms; '+t.hitched+' left out for a hitch)',
        {checked:t.clean,hitched:t.hitched,hitchWorst:t.hitchWorst,worst10:t.worst10,speed:two.speed,rate:two.rate,matched:t.matched,unmatched:t.unmatched,misses:t.misses,frameMed:two.med,frameP90:two.p90,shots:two.shots});
      C.ok(two.fl.bad.length===0&&two.fl.ok>=20,S.tag+' Speed independent: at 2x speed the right file still plays on each moment ('+two.fl.ok+' sounds)',{wrong:two.fl.bad.slice(0,8),wrongCount:two.fl.bad.length}); }
    if(three){ const t=three.tm, P=three.pauseWin, L=three.log.filter(e=>e.k==='play');
      const inP=x=>!!P&&x>P.p0+1e-4&&x<P.p1-1e-4;
      const during=P?L.filter(e=>inP(e.rt)):[], before=P?L.filter(e=>e.rt<=P.p0+1e-4&&(inP(e.st)||inP(e.peakAt))):[], after=P?L.filter(e=>e.rt>=P.p1):[];
      C.ok(!!P&&P.casting.length>0&&Math.abs(P.b1-P.b0)<1e-9,S.tag+' Speed independent: the fight was paused with the Pause button while a hero cast, and the battle clock stood still',{pause:P});
      C.ok(!!P&&during.length===0&&after.length>0,S.tag+' Speed independent: no sound was handed to the audio clock during the '+(P?((P.p1-P.p0).toFixed(2)):'?')+' s pause, and sound goes on after Resume',
        {handedDuring:during.slice(0,5).map(e=>({name:e.name,handed:e.rt,st:e.st})),handedDuringCount:during.length,afterResume:after.length,pause:P,shots:three.shots});
      C.ok(!!P&&before.length===0,S.tag+' Speed independent: no sound handed out just before the pause starts or peaks inside it (Pause stops what is already scheduled)',
        {inside:before.slice(0,8).map(e=>({name:e.name,kind:e.kind,hero:e.hero,handed:e.rt,start:e.st,peakAt:e.peakAt,pauseStart:P.p0,pauseEnd:P.p1})),count:before.length});
      C.ok(t.clean>=20&&Math.abs(t.maxErrMs)<=FRAME*1000+1e-6&&three.fl.bad.length===0,S.tag+' Speed independent: around the pause '+t.clean+' sounds (window not spanning the pause, no hitch) meet their frames, worst '+t.maxErrMs+' ms (limit 33.3 ms), right files',
        {checked:t.clean,spanned:t.spanned,spanWorst:t.spanWorst,hitched:t.hitched,hitchWorst:t.hitchWorst,worst10:t.worst10,
        matched:t.matched,wrong:three.fl.bad.slice(0,5),misses:t.misses,frameMed:three.med,frameP90:three.p90}); }
    C.ok(pg._errs.length===0,S.tag+' no page errors (fights)',pg._errs.slice(0,3));
  }
  return {pg}; }

async function music(pg,S){
  const list=await pg.evaluate(()=>MUSIC_LISTS.battle.map(x=>({f:x.f,start:x.start,loopStart:x.loopStart,loopEnd:x.loopEnd})));
  C.ok(list.length===10,S.tag+' Battle music loops: the game has 10 battle songs',list.map(x=>x.f));
  for(let k=0;k<list.length;k++){ const song=list[k], nm=song.f.replace(/^music\//,'').replace(/\?.*$/,'');
    try{
      await pg.evaluate(()=>{ try{ show('home'); }catch(e){} }); await wait(1500);
      await pg.evaluate(([k,n])=>{ localStorage.setItem('ew_battle_track',String((k-1+n)%n)); G.team=['vex','grosk','sloe','fritz','aureth']; CUR={node:1,mode:'arena'};
        _startVersusNow([{key:'tick',level:30,rank:3},{key:'oakmir',level:30,rank:3}],true,G.team); paused=true; },[k,list.length]);
      let st=null; for(let i=0;i<120;i++){ await wait(100); st=await pg.evaluate(()=>{ const L=MUS.lanes.battle, s=L&&L.slot; return {cur:MUS.cur,f:s&&s.song&&s.song.f,t:s&&s.el.currentTime,paused:s&&s.el.paused,err:s&&s.el.error&&s.el.error.code,ready:s&&s.el.readyState}; });
        if(st.cur==='battle'&&st.f===song.f&&!st.paused&&st.t>song.start) break; }
      const r=await pg.evaluate(async()=>{ const W=ms=>new Promise(r=>setTimeout(r,ms)), L=MUS.lanes.battle, out=[]; MUS.log.length=0;
        /* every timer armed while the seam is watched: when it was armed and its delay, so the seam timer's lateness can be read */
        const ST=window.setTimeout, armed=new Map(); window.setTimeout=function(fn,d,...a){ const id=ST.call(window,fn,d,...a); armed.set(id,{at:performance.now(),d:+d||0,ct:(L.slot&&L.slot.el)?L.slot.el.currentTime:null}); return id; };
        try{
        for(let rep=0;rep<2;rep++){ const s=L.slot; if(!s){ out.push({noSlot:true}); break; } const sg=s.song; s.el.currentTime=sg.loopEnd-2.2; let sid=0;
          for(let i=0;i<600&&L.slot===s;i++){ if(!sid&&L.seamT) sid=L.seamT; await W(10); }
          await W(400); const n=L.slot, seams=MUS.log.filter(x=>x[0]==='seam');
          const A=sid?armed.get(sid):null, sm=seams[seams.length-1], due=A?A.at+A.d:null;
          const timer=A?{armedAt:+A.at.toFixed(1),delayMs:+A.d.toFixed(1),songAtArm:A.ct==null?null:+A.ct.toFixed(3),firedAt:sm?sm[3]:null,lateMs:sm&&due!=null?+(sm[3]-due).toFixed(1):null}:{found:false};
          out.push({timer,moved:n!==s,same:!!n&&n.song===sg,t:n?+n.el.currentTime.toFixed(3):null,playing:!!n&&!n.el.paused,loopStart:sg.loopStart,loopEnd:sg.loopEnd,seam:seams[seams.length-1]||null,seams:seams.length,oldFree:!s.lane}); }
        } finally { window.setTimeout=ST; }
        return {out,heal:MUS.log.filter(x=>x[0]==='heal'),seams:MUS.log.filter(x=>x[0]==='seam').length,log:MUS.log.slice(-10)}; });
      console.log('  INFO   '+S.tag+' Battle music loops '+nm+' seam timers (performance.now at the seam vs armed + delay): '+JSON.stringify(r.out.map(o=>o.timer)));
      const sh=await shot(pg,S.tag+' Battle music loops '+nm);
      const loops=r.out.map(o=>{ const outT=o.seam?o.seam[1]:null; return Object.assign(o,{outT,leaveErrMs:outT==null?null:+((outT-o.loopEnd)*1000).toFixed(1),
        ok:!!(o.moved&&o.same&&o.playing&&o.seam&&Math.abs(outT-o.loopEnd)<=0.05&&o.t>=o.loopStart&&o.t<o.loopStart+1.2&&o.oldFree)}); });
      C.ok(st&&st.f===song.f&&loops.length===2&&loops.every(o=>o.ok)&&r.heal.length===0&&r.seams===2,S.tag+' Battle music loops: '+nm+' loops twice on its seam (old element leaves within 50 ms of loopEnd '+song.loopEnd+', the same song plays on from loopStart '+song.loopStart+', no heal)',
        {start:st,loops:loops.map(o=>({timer:o.timer,leaveAt:o.outT,leaveErrMs:o.leaveErrMs,newAt:o.t,same:o.same,playing:o.playing,oldFree:o.oldFree})),seams:r.seams,heal:r.heal,log:r.log,shot:sh});
    }catch(e){ C.ok(false,S.tag+' Battle music loops: '+nm+' ran to the end',String(e&&e.stack||e).slice(0,500)); } }
  await pg.evaluate(()=>{ try{ show('home'); }catch(e){} });
}

function loudness(){
  const PY=process.env.PYTHON||'python3';
  const names=Object.keys(MAN.files).sort();
  let meas;
  try{ meas=JSON.parse(cp.execFileSync(PY,['-I','-c','import json,sys; sys.path.insert(0, sys.argv[1]); import sfx_loudness as L; print(json.dumps([L.measure(p) for p in sys.argv[2:]]))',
      path.join(ROOT,'tools'),...names.map(n=>path.join('assets/audio',MAN.files[n].f.split('?')[0]))],{cwd:ROOT,maxBuffer:16<<20,timeout:900000,stdio:['ignore','pipe','pipe']}).toString()); }
  catch(e){ C.ok(false,'Same loudness: could not measure the files on this host (tools/sfx_loudness.py needs python3 + numpy + scipy + ffmpeg/ffprobe)',String(e&&e.message||e).replace(/Error:/g,'error -').slice(0,400)); return; }
  const tbl=names.map((n,i)=>({n,m:meas[i].lufs_m,tp:meas[i].tp_db,want:MAN.files[n].target,d:+(meas[i].lufs_m-MAN.files[n].target).toFixed(2)}));
  const off=tbl.filter(r=>!(Math.abs(r.d)<=MAN.tolerance_lu)), lower=tbl.filter(r=>r.want<MAN.target_lufs_m);
  tbl.sort((a,b)=>a.m-b.m);
  console.log('  INFO   loudness (LUFS-M): quietest '+tbl.slice(0,4).map(r=>r.n+' '+r.m).join(', ')+' ... loudest '+tbl.slice(-3).map(r=>r.n+' '+r.m).join(', ')+'; deviation from target+offset '+
    Math.min(...tbl.map(r=>r.d)).toFixed(2)+' .. '+Math.max(...tbl.map(r=>r.d)).toFixed(2)+' LU; true peak max '+Math.max(...tbl.map(r=>r.tp)).toFixed(2)+' dBTP');
  C.ok(tbl.length===names.length&&names.length>=200&&off.length===0,'Same loudness: all '+tbl.length+' combat sound files measured within '+MAN.tolerance_lu+' LU of '+MAN.target_lufs_m+' LUFS-M + their offset ('+lower.length+' set lower on purpose)',
    {outside:off.slice(0,8),lower:lower.slice(0,20).map(r=>r.n+' target '+r.want+' measured '+r.m)});
}

(async()=>{
  try{ loudness(); }catch(e){ C.ok(false,'Same loudness: ran to the end',String(e&&e.stack||e).slice(0,500)); }
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg=null;
  try{
    for(const k of ['desktop','phone']){ const S=H.SIZES[k];
      try{ const r=await sizeRun(s.port,S); pg=r.pg;
        if(k==='phone'){ try{ await music(pg,S); }catch(e){ C.ok(false,S.tag+' Battle music loops: ran to the end',String(e&&e.stack||e).slice(0,500)); }
          C.ok(pg._errs.length===0,S.tag+' no page errors (music)',pg._errs.slice(0,3)); }
      }catch(e){ C.ok(false,S.tag+' Sound matches the animation: ran to the end',String(e&&e.stack||e).slice(0,500)); }
      if(pg){ try{ await pg._ctx.close(); }catch(_){} pg=null; } }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} if(_br) try{ await _br.close(); }catch(_){} await s.stop(); }
  C.done();
})();
