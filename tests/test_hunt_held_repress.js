const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1364-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
/* a throwaway server + an admin account signed in past the tutorial (the same boot the night smoke used) */
async function boot(o){ o=o||{}; const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  if(o.grant!==false) await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const ctx=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {page,errs,base}; }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };

/* Grok bug hunt 12 Nov, v3 (ChatGPT 03:16 FAIL on v2): a press queues a background repaint (the real Arena daily-reset tick), the press ends
   WITHOUT a click (release outside / cancel), and a NEW press starts 50 ms later. The first release's 150 ms fallback (or a click flush that
   lands after a new pointerdown) must NOT repaint under the new press; the queue must survive and run exactly once after the new press ends.
   main and v2 must FAIL; v3 must PASS. */
async function repress(page,nm,label,seq,gap){
  await page.evaluate(()=>show('arena')); await delay(2000);
  const n0=await page.evaluate(()=>{ if(!window._ra0){ window._ra0=renderArena; window._as0=arenaSync; window._asl0=arenaSyncLadder; window._adr0=arenaDailyReady; } arenaDailyReady=()=>false; window._ra0(); /* a counting-down daily, so the tick's 'reaches 0' repaint is the one queued */ arenaSync=()=>Promise.resolve(false); arenaSyncLadder=()=>Promise.resolve(false); /* renderArena's own opponent/ladder sync re-renders it; stubbed so the count is the queued repaint only */ window._raN=0; renderArena=function(){ window._raN++; return window._ra0.apply(this,arguments); };
    document.querySelectorAll('[data-held-probe]').forEach(e=>delete e.dataset.heldProbe); const els=document.querySelectorAll('#arena *'); els.forEach(e=>e.dataset.heldProbe='1'); return els.length; });
  const S=()=>page.evaluate(()=>({n:window._raN,k:document.querySelectorAll('[data-held-probe]').length}));
  const P=(types)=>page.evaluate((types)=>{ const t=document.getElementById('arena'); for(const ty of types){ const o={bubbles:true,cancelable:true,pointerId:1,isPrimary:true,pointerType:'mouse'}; t.dispatchEvent(ty==='click'?new MouseEvent('click',o):new PointerEvent(ty,o)); } },types);
  await P(['pointerdown']);
  await page.evaluate(()=>{ window._adl=arenaDailyLeft; arenaDailyLeft=()=>0; }); await delay(1250);   /* at least one 1 s tick sees the daily reset */
  await page.evaluate(()=>{ arenaDailyLeft=window._adl; });
  const s1=await S();
  await P(seq); if(gap!=null){ await delay(gap); await P(['pointerdown']); }
  await delay(400); const s2=await S();
  await P(['pointerup']); await delay(700); const s3=await S();
  await page.evaluate(()=>{ renderArena=window._ra0; arenaSync=window._as0; arenaSyncLadder=window._asl0; arenaDailyReady=window._adr0; });
  ok(n0>3&&s1.n===0&&s1.k===n0, nm+' '+label+': first press held - Arena repaint queued, not run ('+JSON.stringify(s1)+' of '+n0+')');
  ok(s2.n===0&&s2.k===n0, nm+' '+label+': no queued repaint fires under the NEW press ('+JSON.stringify(s2)+')');
  ok(s3.n===1&&s3.k<n0, nm+' '+label+': the kept repaint runs exactly once after the new press ends ('+JSON.stringify(s3)+')'); }
(async()=>{ try{
  const {page,errs}=await boot();
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ await page.setViewportSize({width:w,height:h}); await delay(3000);
    await repress(page,nm,'release without click, press again 50 ms later',['pointerup'],50);
    await repress(page,nm,'press cancelled, press again 50 ms later',['pointercancel'],50);
    await repress(page,nm,'click, then a new press before the click flush',['pointerup','click','pointerdown'],null);
    await page.evaluate(()=>show('home')); await delay(500); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('held-repaint queue across a new press (v3)'); await cleanup(); } })();