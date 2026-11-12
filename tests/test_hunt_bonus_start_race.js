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
/* bonus stages: unlock heroes + clear the campaign far enough, open a stage's picker, and start the run */
async function bonusReady(page){ return page.evaluate(async()=>{ const ks=Object.keys(HERO_TYPES); const own=ks.slice(0,Math.max(10,ks.length-6));
  const a=await api('/api/admin/led-grant','POST',{unlock:own,campCleared:45,stamina:300}); if(typeof ledgerSync==='function') await ledgerSync(); return !!(a&&a.ok); }); }
async function openBonus(page,id){ await page.evaluate(()=>show('campaign')); await delay(600);
  await page.evaluate(id=>{ const [c,s]=id.split('-'); openBonusModal(+c,+s); },id);
  await page.waitForFunction(()=>document.querySelector('#gsplitPicker .gsplitHero'),null,{timeout:20000}); await delay(500); }
async function startBonus(page){
  await page.evaluate(()=>{ const a=document.getElementById('gsplitAuto'); if(a) a.click(); }); await delay(300);
  await page.evaluate(()=>{ const n=document.getElementById('gsplitNext'); if(n) n.click(); }); await delay(400);
  await page.evaluate(()=>{ const a=document.getElementById('gsplitAutoPlace'); if(a&&!a.disabled) a.click(); }); await delay(300);
  await page.evaluate(()=>{ const s=document.getElementById('gsplitStart'); if(s) s.click(); });
  await page.waitForFunction(()=>typeof GSPLIT!=='undefined'&&GSPLIT.active&&GSPLIT.lanes&&GSPLIT.lanes.length===3,null,{timeout:60000}); await delay(2500); }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
/* Grok bug hunt 12 Nov (Claude 02:12: "do the other launch paths have the Vault's reply-after-leaving race?"). Bonus stages: gsplitStartRun
   (html ~10537) acted on whatever picker was open when the /api/bonus/start reply LANDED. CONTROL (main) must FAIL; patched must PASS. */
async function prep(page,id){ await openBonus(page,id);
  await page.evaluate(()=>{ const a=document.getElementById('gsplitAuto'); if(a) a.click(); }); await delay(300);
  await page.evaluate(()=>{ const n=document.getElementById('gsplitNext'); if(n) n.click(); }); await delay(400);
  await page.evaluate(()=>{ const a=document.getElementById('gsplitAutoPlace'); if(a&&!a.disabled) a.click(); }); await delay(300); }
async function endRun(page){ if(!(await page.evaluate(()=>typeof GSPLIT!=='undefined'&&GSPLIT.active))) return;
  await page.evaluate(()=>{ try{ gsplitRetreat(); }catch(e){} }); await delay(600);
  const cf=page.locator('.modal:visible button:has-text("Retreat"), #confirmYes:visible'); if(await cf.count().catch(()=>0)){ try{ await cf.first().click({timeout:2000}); }catch(_){} }
  await page.waitForFunction(()=>!GSPLIT.active,null,{timeout:30000}).catch(()=>{}); await delay(1500);
  for(let i=0;i<20;i++){ const gone=await page.evaluate(()=>{ const o=document.getElementById('gsplitResultOverlay'); if(!o) return true; const b=[...o.querySelectorAll('button')].find(x=>x.offsetWidth); if(b) b.click(); return false; }); if(gone) break; await delay(700); }
  await page.evaluate(()=>{ document.querySelectorAll('.modal.active').forEach(m=>{ const b=m.querySelector('button'); if(b) b.click(); }); try{ show('campaign'); }catch(e){} }); await delay(800); }
(async()=>{ try{
  const {page,errs}=await boot(); ok(await bonusReady(page),'fixture: heroes + campaign 45 granted');
  let n=0, held=[]; await page.route('**/api/bonus/start',async route=>{ n++; if(!page._hold){ await route.continue(); return; } const resp=await route.fetch(); await new Promise(r=>held.push(()=>r())); await route.fulfill({response:resp}); });
  const releaseAll=async()=>{ const h=held; held=[]; h.forEach(f=>f()); await delay(200); };
  const started=()=>page.evaluate(()=>!!(typeof GSPLIT!=='undefined'&&GSPLIT.active));
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ await page.setViewportSize({width:w,height:h}); await delay(4000);
    /* E: an ordinary start still starts */
    page._hold=false; await prep(page,'1-4'); n=0; await page.locator('#gsplitStart').click();
    await page.waitForFunction(()=>GSPLIT.active,null,{timeout:60000}).catch(()=>{}); ok(await started(), nm+' an ordinary Start still starts the run ('+n+' start sent)'); await endRun(page);
    /* ONLY=CD runs C and D alone (a clean control: no run left over from A / B) */
    if(process.env.ONLY!=='CD'){
    /* A: double tap Start while the reply is slow */
    page._hold=true; await prep(page,'1-4'); n=0; const e0=errs.length;
    await page.locator('#gsplitStart').click(); await delay(150); await page.locator('#gsplitStart').click({force:true,timeout:3000}).catch(()=>{}); await delay(500);
    const sent=n; await releaseAll(); await page.waitForFunction(()=>GSPLIT.active,null,{timeout:60000}).catch(()=>{}); await delay(1500);
    ok(sent===1, nm+' A double tap on Start sends one start, not '+sent+' (the server keeps only the newest attempt)');
    ok(await started() && errs.length===e0, nm+' A the run starts once with no page error '+errs.slice(e0).join('|').slice(0,120)); await endRun(page);
    /* B: close the picker while the reply is in flight */
    await prep(page,'1-4'); const e1=errs.length; await page.locator('#gsplitStart').click(); await delay(300);
    await page.locator('#gsplitClose').click(); await delay(300); await releaseAll(); await delay(3000);
    ok(!(await started()) && errs.length===e1, nm+' B closed the picker mid-start -> no run, no page error '+JSON.stringify({run:await started(),err:errs.slice(e1).join('|').slice(0,120)})); await endRun(page);
    }
    page._hold=true;
    /* C: back to the hero pick while the reply is in flight */
    await prep(page,'1-4'); await page.locator('#gsplitStart').click(); await delay(300);
    await page.locator('#gsplitBack').click(); await delay(300); await releaseAll(); await delay(3000);
    ok(!(await started()) && await page.evaluate(()=>!!document.getElementById('gsplitPicker')), nm+' C went Back to heroes mid-start -> picker stays, no run');
    await endRun(page); await page.evaluate(()=>{ try{ gsplitPickerClose(); }catch(e){} });
    /* D: closed and opened ANOTHER stage while the reply is in flight */
    await prep(page,'1-4'); await page.locator('#gsplitStart').click(); await delay(300);
    await page.locator('#gsplitClose').click(); await delay(300); await openBonus(page,'1-6'); await releaseAll(); await delay(3000);
    ok(!(await started()) && await page.evaluate(()=>!!(GSPLIT_ENTRY&&GSPLIT_ENTRY.id==='1-6'&&document.getElementById('gsplitPicker'))), nm+' D opened stage 1-6 mid-start -> its picker stays open, stage 1-4 does not launch');
    await endRun(page); await page.evaluate(()=>{ try{ gsplitPickerClose(); }catch(e){} }); page._hold=false; }
  ok(true,'page errors seen in total: '+errs.length);
}catch(e){ console.error(e); fails++; } finally { finish('bonus start reply race'); await cleanup(); } })();