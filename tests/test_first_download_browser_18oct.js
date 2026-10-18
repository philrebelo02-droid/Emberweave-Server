'use strict';
// Real app, real Cache API and service worker; only the download payload is tiny.
// GPU rendering is disabled: this tests the tutorial/download UI without taking
// the shared battle-testing GPU slot. It never opens a visible desktop window.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),net=require('net'),assert=require('assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),out=process.env.SHOT_DIR||path.join(os.tmpdir(),'ew-first-download-shots');fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});}),base='http://127.0.0.1:'+port;
 const srv=cp.spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),DB_FILE:path.join(fs.mkdtempSync(path.join(os.tmpdir(),'ew-first-ui-')),'db.json')},stdio:'ignore'});let browser;
 try{for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch(_){}await delay(150);}
  const catalog=await (await fetch(base+'/api/download-catalog')).json();assert.ok(catalog.files.length>2000&&catalog.chapter1.includes('brukk'));
  browser=await chromium.launch({headless:true,args:['--mute-audio','--disable-gpu','--disable-software-rasterizer']});
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'allow'});
  const nonce=Date.now(),urls=Array.from({length:4},(_,i)=>'/assets/ui/first-download.js?v=fd-test-'+nonce+'-'+i);
  await context.addInitScript(urls=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;let api;
   Object.defineProperty(window,'EmberweaveFirstDownload',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=options=>create(Object.assign({},options,{plan:async()=>({parts:urls.map(u=>[u])})}));}});
  },urls);
  const page=await context.newPage(),requests=[],errors=[];page.on('request',r=>{if(r.url().includes('fd-test-'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/play',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{const r=await api('/api/register','POST',{name:'dl'+Date.now().toString(36),pass:'password1'});ACC.token=r.token;ACC.id=r.profile.id;ACC.name=r.profile.name;ACC.guest=false;_cloudReady=true;saveAcc();G.tutStarted=true;G.tutDone=false;G.campaignCleared=0;saveGLocalOnly();document.body.classList.remove('gated');authGateRefresh();document.getElementById('rotateGate').style.display='none';show('tutorial');});
  await page.waitForFunction(()=>window.FirstDownloadGame&&FirstDownloadGame.snapshot().status==='ready');
  assert.ok((await page.locator('#tutorialBody').innerText()).includes('Step 1'));
  await page.locator('#tutorialBody [data-fd-next]').click();
  await page.waitForFunction(()=>FirstDownloadGame.snapshot().percent===25&&FirstDownloadGame.snapshot().status==='saved').catch(async e=>{console.log('download debug',await page.evaluate(()=>FirstDownloadGame.snapshot()),requests,errors);await page.screenshot({path:path.join(out,'debug.png')});throw e;});
  let text=await page.locator('[data-fd-card]').first().innerText();assert.ok(!/\b(?:MB|GB|bytes|files|Mbps)\b|\d+\s*\/\s*\d+/i.test(text));
  await page.screenshot({path:path.join(out,'phone-essentials-saved.png')});
  await page.locator('[data-fd-exit]').first().click();await page.waitForFunction(()=>state==='home');
  await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(()=>{document.getElementById('rotateGate').style.display='none';document.body.classList.remove('gated');firstDownloadBoot();});
  await page.waitForFunction(()=>window.FirstDownloadGame&&FirstDownloadGame.snapshot().percent===50&&FirstDownloadGame.snapshot().status==='saved');
  assert.equal(requests.filter(u=>u.endsWith(urls[0])).length,1);await page.screenshot({path:path.join(out,'phone-resumed-next-quarter.png')});
  await page.locator('#firstDownloadOverlay [data-fd-next]').click();await page.waitForFunction(()=>FirstDownloadGame.snapshot().percent===75&&FirstDownloadGame.snapshot().status==='saved');
  await page.locator('#firstDownloadOverlay [data-fd-next]').click();await page.waitForFunction(()=>FirstDownloadGame.snapshot().percent===100);
  assert.equal(requests.length,4);assert.equal(await page.evaluate(async()=>{const c=await caches.open('ember-assets-v1');return (await c.keys()).filter(r=>r.url.includes('fd-test-')).length;}),4);
  assert.deepEqual(errors,[]);
  const failedContext=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await failedContext.addInitScript(urls=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;let api;Object.defineProperty(window,'EmberweaveFirstDownload',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=o=>create(Object.assign({},o,{plan:async()=>({parts:urls.map(u=>[u])}),fetch:async()=>({ok:false,status:404})}));}});},urls);
  const failedPage=await failedContext.newPage();await failedPage.goto(base+'/play',{waitUntil:'domcontentloaded'});
  await failedPage.evaluate(async()=>{const r=await api('/api/register','POST',{name:'miss'+Date.now().toString(36),pass:'password1'});ACC.token=r.token;ACC.id=r.profile.id;ACC.guest=false;_cloudReady=true;G.tutStarted=true;G.tutDone=false;G.campaignCleared=0;document.body.classList.remove('gated');authGateRefresh();document.getElementById('rotateGate').style.display='none';show('tutorial');});
  await failedPage.waitForFunction(()=>window.FirstDownloadGame&&FirstDownloadGame.snapshot().status==='ready');await failedPage.locator('[data-fd-next]').click();await failedPage.waitForFunction(()=>FirstDownloadGame.snapshot().status==='waiting');
  assert.equal(await failedPage.evaluate(()=>FirstDownloadGame.snapshot().percent),0);await failedPage.screenshot({path:path.join(out,'phone-missing-asset.png')});
  await failedPage.locator('[data-fd-play]').click();await failedPage.waitForFunction(()=>document.getElementById('tutorialBody').textContent.includes('Choose your first squad'));
  assert.equal(await failedPage.evaluate(()=>FirstDownloadGame.snapshot().essentialsReady),false);
  let available=false;const late='/assets/icons/icon-192.png?v=late-test';await failedContext.route('**/*late-test',route=>available?route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(root,'assets/icons/icon-192.png'))}):route.fulfill({status:404,body:'not yet'}));
  await failedPage.evaluate(u=>{const img=document.createElement('img');img.id='lateImage';img.src=u;document.body.appendChild(img);},late);
  await failedPage.waitForFunction(()=>document.getElementById('lateImage').dataset.fdLoading==='1');available=true;await failedPage.evaluate(u=>FirstDownloadGame.assetSaved(u),late);
  await failedPage.waitForFunction(()=>document.getElementById('lateImage').naturalWidth>0&&!document.getElementById('lateImage').dataset.fdLoading);await failedContext.close();
  console.log('PASS real phone UI: step1,25% save/exit,reload resumes50%,75/100%,four cached files,no repeated first quarter,percent-only display; unavailable art stays0% and permits play while loading. Screenshots '+out);
 }finally{if(browser)await browser.close();srv.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
