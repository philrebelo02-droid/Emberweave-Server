const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require('playwright');
/* v1371 (ChatGPT 20:17 Fold repro; Claude 20:28 / 20:53): leaving a bonus run zoomed must hand Campaign and Arena back at 1x.
   Exits at 2x and 1.5x through every teardown: A lose result @2x, B win result @1.5x, C retreat @2x, D pause-menu quit @1.5x. */
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-zoomexit-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
/* a throwaway server + an admin account signed in past the tutorial (the same boot the night smoke used) */
async function boot(o){ o=o||{}; const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(const _t0=Date.now();Date.now()-_t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}   /* 11 Nov: a 60 s deadline, not an iteration count */throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await (async(c)=>{ for(let i=0;i<400&&c.exitCode===null&&c.signalCode===null;i++){ if(i===200) try{ c.kill('SIGKILL'); }catch(_){} await new Promise(r=>setTimeout(r,50)); } if(c.exitCode===null&&c.signalCode===null) throw new Error('server pid '+c.pid+' did not exit within 20 s (SIGKILL sent at 10 s) - stopping the test here, no DB edit or restart'); })(child);   /* 11 Nov: until it has exited (the port is free); 12 Nov: throws if it never does */
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  if(o.grant!==false) await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({args:['--mute-audio','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
  const ctx=await browser.newContext({viewport:{width:o.width,height:o.height},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {page,errs,base}; }
const rectOf=(page,sel)=>page.evaluate(s=>{ const e=document.querySelector(s); if(!e) return null; const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden') return null; const r=e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; },sel);
const overlap=(a,b)=>a&&b&&a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
const viewOf=page=>page.evaluate(()=>{ const t=(document.getElementById('battleBg')||{style:{}}).style.transform||''; const m=t.match(/scale\(([\d.]+)\)/); return {zoom:battleZoom,panX:battlePanX,panY:battlePanY,bgScale:m?+m[1]:1}; });
const atOne=v=>v.zoom===1&&v.panX===0&&v.panY===0&&v.bgScale===1;
async function startRun(page){
  await page.evaluate(()=>{show('campaign');openBonusModal(1,4);});
  await page.locator('#gsplitPicker .gsplitHero').first().waitFor({timeout:30000});
  for(const hero of (await page.locator('#gsplitPicker .gsplitHero').all()).slice(0,3)) await hero.click();
  for(const id of ['#gsplitNext','#gsplitAutoPlace','#gsplitStart']){ try{ await page.locator(id).click({timeout:15000}); }catch(e){ const info=await page.evaluate(()=>({sel:document.querySelectorAll('#gsplitPicker .gsplitHero.sel,#gsplitPicker .gsplitHero.on,#gsplitPicker .picked').length,next:(()=>{const b=document.getElementById('gsplitNext');return b?{dis:b.disabled,txt:b.textContent,vis:getComputedStyle(b).display}:null})(),modals:[...document.querySelectorAll('.modal,.overlay,[id*=Modal]')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id||e.className).slice(0,8),banner:(document.getElementById('battleBanner')||{}).textContent})); console.log('DIAG '+id+' '+JSON.stringify(info)); if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,'diag.png')}); throw e; } }
  await page.waitForFunction(()=>typeof GSPLIT!=='undefined'&&GSPLIT.active&&state==='battle',null,{timeout:60000}); await delay(1000); }
async function zoomTo(page,want,width,height,tag){ const btn=page.locator('#bonusZoomBtn'); for(let i=0;i<4&&await page.evaluate(()=>battleZoom)!==want;i++){ await btn.click(); await delay(300); }
  ok(await page.evaluate(()=>battleZoom)===want, tag+' zoomed to '+want+'x before exit');
  const c={x:width*0.45,y:height*0.5}; await page.mouse.move(c.x,c.y); await page.mouse.down(); await page.mouse.move(c.x+60,c.y+30,{steps:6}); await page.mouse.up(); await delay(200);
  const v=await viewOf(page); ok(v.panX!==0||v.panY!==0, tag+' panned before exit '+JSON.stringify(v)); }
async function checkAfter(page,tag){
  const ov=page.locator('#gsplitResultOverlay button').last(); try{ await ov.waitFor({timeout:15000}); }catch(_){}
  ok(await ov.count()>0, tag+' result card shown'); if(await ov.count()) await ov.click(); await delay(400);   // Continue, as a player would
  ok(await rectOf(page,'#bonusZoomBtn')===null, tag+' zoom button hidden after exit');
  const v=await viewOf(page); ok(atOne(v), tag+' exit reset zoom+pan '+JSON.stringify(v));
  for(const screen of ['campaign','arena']){ await page.evaluate(n=>show(n),screen); await delay(400);
    const w=await viewOf(page); ok(atOne(w), tag+' '+screen+' opens at 1x '+JSON.stringify(w)); ok(await rectOf(page,'#bonusZoomBtn')===null, tag+' button hidden in '+screen); } }
async function run(width,height){
  const {page,errs}=await boot({width,height}); const tag=width+'x'+height;
  await page.evaluate(async()=>{await api('/api/admin/led-grant','POST',{unlock:Object.keys(HERO_TYPES).slice(0,12),campCleared:4});await ledgerSync();});
  // A: lose result at 2x (ChatGPT's repro path)
  await startRun(page); ok(await page.evaluate(()=>battleZoom)===1, tag+' A run starts at 1x');
  await zoomTo(page,2,width,height,tag+' A'); await page.evaluate(()=>gsplitShowResult(false,{won:false})); await delay(900); await checkAfter(page,tag+' A lose@2x');
  if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,tag+'-A-after.png')});
  // B: win result at 1.5x
  await startRun(page); ok(await page.evaluate(()=>battleZoom)===1, tag+' B next run starts at 1x');
  await zoomTo(page,1.5,width,height,tag+' B'); await page.evaluate(()=>gsplitShowResult(true,{won:true,stars:3})); await delay(900); await checkAfter(page,tag+' B win@1.5x');
  // C: the real Retreat button at 2x (retreat -> gsplitFinish -> server verdict -> result)
  await startRun(page); await zoomTo(page,2,width,height,tag+' C');
  const rb=page.locator('#gsplitRetreat'); let used='button';
  if(await rb.isVisible().catch(()=>false)) await rb.click(); else { used='gsplitRetreat()'; await page.evaluate(()=>gsplitRetreat()); }
  const cf=page.locator('.modal:visible button:has-text("Retreat"), #confirmYes:visible'); if(await cf.count().catch(()=>0)) { try{ await cf.first().click({timeout:2000}); }catch(_){} }
  try{ await page.waitForFunction(()=>!GSPLIT.active,null,{timeout:45000}); }catch(_){ }
  ok(await page.evaluate(()=>!GSPLIT.active), tag+' C retreat ('+used+') ended the run'); await delay(1500); await checkAfter(page,tag+' C retreat@2x');
  if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,tag+'-C-after.png')});
  // D: QUIT from the pause menu at 1.5x (pause -> "Retreat from run" -> confirm), the way a player leaves a bonus run
  await startRun(page); ok(await page.evaluate(()=>battleZoom)===1, tag+' D next run starts at 1x');
  await zoomTo(page,1.5,width,height,tag+' D');
  await page.locator('#pauseBtn').click(); const pr=page.locator('#gsplitPmRetreat'); let quitOk=true;
  try{ await pr.waitFor({state:'visible',timeout:8000}); await pr.click(); await page.locator('#uiCfOk').click({timeout:8000}); }catch(e){ quitOk=false; }
  ok(quitOk, tag+' D pause menu Retreat + confirm clicked');
  try{ await page.waitForFunction(()=>!GSPLIT.active,null,{timeout:45000}); }catch(_){ }
  ok(await page.evaluate(()=>!GSPLIT.active), tag+' D quit (pause menu) ended the run'); await delay(1500); await checkAfter(page,tag+' D quit@1.5x');
  if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,tag+'-D-after.png')});
  ok(!errs.length, tag+' no page errors '+errs.join(' | '));
}
(async()=>{
  try{
    if(process.env.SHOTS) fs.mkdirSync(process.env.SHOTS,{recursive:true});
    for(const [w,h] of [[882,344],[844,390],[1440,800]]){
      try{await run(w,h);}catch(e){ fails++; console.log('FAIL '+w+'x'+h+' '+String(e&&e.message||e).split('\n')[0]); }finally{if(browser)await browser.close();if(child)child.kill();}
    }
    console.log('test_bonus_zoom_exit_1371: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed');
    if(fails) process.exitCode=1;
  }catch(e){console.error('FAIL',e);process.exitCode=1;}
})();