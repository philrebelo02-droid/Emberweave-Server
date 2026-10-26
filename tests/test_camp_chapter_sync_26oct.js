// 26 Oct 2026 (Kimi playtest bug A1: "chapter-next shows Chapter 2 but tapping 2-1 opens Stage 1-1"). Claude.
// The cause: adoptLedger() repaints an open Campaign when the ledger arrives, and it reset campViewCh to the chapter of your last
// stage. A background ledger sync landing after you pressed the next-chapter arrow put Chapter 1 back under your finger - same plate
// positions, so the tap on 2-1 hit 1-1. Now a chapter the player picked with the arrows survives a ledger repaint; a map the player
// has not touched still follows the ledger (the 29 Aug fix that this repaint exists for).
// Checked in the real page (phone landscape, touch) on a throwaway server and guest. CONTROL: CAMP_ROOT=<a pre-fix checkout> must FAIL.
const assert=require('assert');
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const {chromium}=require('playwright');
const root=process.env.CAMP_ROOT?path.resolve(process.env.CAMP_ROOT):path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-camp-sync-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ✓ '+msg); else { fails++; console.log('  ✗ '+msg); } };
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',PORT:String(port),DB_FILE:path.join(temp,'db.json')},stdio:'ignore',windowsHide:true});
  let ready=false; for(let i=0;i<200;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch(_){}await delay(100);}
  assert(ready,'throwaway server did not start');
  try{browser=await chromium.launch({args:['--mute-audio']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
  console.log('campaign chapter vs ledger sync (26 Oct) root='+root);
  const deviceId='camp-sync-'+Date.now();
  const guest=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,roster:{__save:'{}'}})})).json();
  assert(guest.token,'throwaway guest');
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.addInitScript(([id,tok,gid,nm])=>{ localStorage.setItem('ew_device',id); localStorage.setItem('ew_acc',JSON.stringify({token:tok,id:gid,name:nm,guest:true})); localStorage.setItem('ew_guest_step_'+gid,'1');
      try{ const AC=window.AudioContext||window.webkitAudioContext; if(AC){ const g=AC.prototype.createGain; AC.prototype.createGain=function(){ const n=g.call(this); try{ n.gain.value=0; }catch(e){} return n; }; } }catch(e){} },
    [deviceId,guest.token,guest.profile.id,guest.profile.name]);
  await page.goto(base+'/play',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
  await page.evaluate(()=>{const p=document.querySelector('.splashPlay');if(p)p.click();});
  await page.waitForFunction(()=>ACC.token&&_cloudReady,null,{timeout:20000}); await page.waitForTimeout(400);
  const hdr=()=>page.evaluate(()=>{ const m=((document.getElementById('cmapHdr')||{}).innerText||'').match(/Chapter (\d+)/); return { view:campViewCh, shown:m?+m[1]:0, state }; });
  // 1. the player turns to Chapter 2, then the ledger lands
  await page.evaluate(()=>{ closePopout&&closePopout(); show('campaign'); }); await page.waitForTimeout(500);
  const h0=await hdr(); ok(h0.state==='campaign'&&h0.shown===1,'Campaign opens on Chapter 1 ('+JSON.stringify(h0)+')');
  await page.evaluate(()=>{ const nx=document.getElementById('chNext'); nx&&nx.click(); }); await page.waitForTimeout(300);
  const h1=await hdr(); ok(h1.shown===2,'the next-chapter arrow shows Chapter 2 ('+JSON.stringify(h1)+')');
  await page.evaluate(()=>adoptLedger({})); await page.waitForTimeout(300);
  const h2=await hdr(); ok(h2.shown===2&&h2.view===2,'a ledger repaint keeps the chapter the player chose ('+JSON.stringify(h2)+')');
  // 2. the arrow back still works after that, and a fresh visit follows the ledger again
  await page.evaluate(()=>{ const pv=document.getElementById('chPrev'); pv&&pv.click(); }); await page.waitForTimeout(300);
  const h3=await hdr(); ok(h3.shown===1,'the back arrow returns to Chapter 1 ('+JSON.stringify(h3)+')');
  await page.evaluate(()=>{ show('home'); }); await page.waitForTimeout(300);
  await page.evaluate(()=>{ G.lastStage=11; show('campaign'); }); await page.waitForTimeout(400);
  const h4=await hdr(); ok(h4.shown===2,'re-entering seeds the map from your last stage (11 -> Chapter 2) ('+JSON.stringify(h4)+')');
  await page.evaluate(()=>{ G.lastStage=1; adoptLedger({}); }); await page.waitForTimeout(300);
  const h5=await hdr(); ok(h5.shown===1,'an untouched map still follows the ledger on repaint (last stage 1 -> Chapter 1) ('+JSON.stringify(h5)+')');
  ok(errs.length===0,'no page errors ('+errs.slice(0,2).join(' | ')+')');
  await ctx.close();
  console.log(`camp chapter sync 26oct: ${checks-fails}/${checks} checks passed, ${fails} failed`);
  if(fails) process.exitCode=1;
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ if(browser)await browser.close().catch(()=>{}); if(child)child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} }
})();
