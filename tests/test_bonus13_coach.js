const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require('playwright');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1364-'));
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
  await delay(700); child.kill(); await delay(900);
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
async function run(width,height){
  const {page,errs}=await boot({width,height});
  const open=async(slot)=>{
    await page.evaluate(slot=>{show('campaign');openBonusModal(1,slot);},slot);
    await page.locator('#gsplitPicker .gsplitHero').first().waitFor();
  };
  const dialog=page.locator('#bonus13Coach');
  const step=async(who,part,shot)=>{
    await dialog.waitFor({timeout:10000});
    ok(await dialog.locator('strong').textContent()===who, width+' speaker '+who);
    ok((await dialog.locator('p').textContent()).includes(part),width+' copy '+part);
    const box=await dialog.boundingBox();
    ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,width+' bubble fits');
    if(shot==='2-roads'||shot==='3-goal'){
      const labels=await page.locator('#gsplitPicker .gsplitRoad>div:first-child').all();
      const rects=await Promise.all(labels.map(label=>label.boundingBox()));
      ok(rects.length===3&&rects.every(r=>r&&(r.x+r.width<=box.x||r.x>=box.x+box.width||r.y+r.height<=box.y||r.y>=box.y+box.height)),width+' bubble leaves all road labels visible');
    }
    if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,width+'x'+height+'-'+shot+'.png')});
    await dialog.getByRole('button',{name:'Tap to continue'}).click();
  };
  await page.evaluate(async()=>{await api('/api/admin/led-grant','POST',{unlock:Object.keys(HERO_TYPES).slice(0,12),campCleared:4});await ledgerSync();});
  await open(4);
  ok(await dialog.count()===0,width+' Bonus 1-4 has no coach');
  await page.locator('#gsplitClose').click();
  await open(3);
  await step('Vael','Pick your squad','1-pick');
  ok(await page.locator('.bonus13PickGlow .gsplitCount').count()===1,width+' counter glows after dismissal');
  for(const hero of (await page.locator('.gsplitHero').all()).slice(0,3)) await hero.click();
  await page.locator('#gsplitNext').click();
  await step('Sylthaine','Top, Middle, Bottom','2-roads');
  await step('Vael','Five waves','3-goal');
  ok(await page.locator('.bonus13RoadGlow .gsplitRoad').count()===3,width+' road labels glow');
  await page.locator('#gsplitAutoPlace').click();
  await page.locator('#gsplitStart').click();
  await dialog.waitFor({timeout:60000});
  const before=await page.evaluate(()=>battleTime);
  await delay(450);
  ok(await page.evaluate(t=>battleTime===t,before),width+' battle held for zoom bubble');
  const zoom=page.locator('#bonusZoomBtn');
  const hasZoom=await zoom.isVisible();
  if(hasZoom){
    ok(await page.locator('#bonusZoomBtn.bonus13ZoomGlow').count()===1,width+' real zoom control glows');
    const box=await dialog.boundingBox();
    const controls=await Promise.all([zoom,page.locator('#autoBtn')].map(control=>control.boundingBox()));
    ok(controls.every(r=>r&&(r.x+r.width<=box.x||r.x>=box.x+box.width||r.y+r.height<=box.y||r.y>=box.y+box.height)),width+' zoom bubble clears HUD controls');
  }
  await step('Vireo',hasZoom?'Tap Zoom':'Pinch','4-zoom');
  await page.evaluate(()=>{gsplitOpenWindow();gsplitWindowDraw();});
  await step('Sylthaine','Choose one boon','5-boon');
  ok(await page.locator('.bonus13BoonGlow .gw-boon').count()>0,width+' boon choices glow');
  for(const i of [0,1,2]) await page.locator('.gw-boon[data-lane="'+i+'"]').first().click();
  const completion=page.waitForResponse(r=>r.url().endsWith('/api/tutorial/bonus13')&&r.request().method()==='POST');
  await page.locator('#gwConfirm').click();
  await step('Vex','Their boon goes with them','6-cross');
  ok((await completion).ok(),width+' account completion accepted');
  ok(await page.locator('#gwStart').isEnabled(),width+' crossing optional, Start Wave 2 enabled');
  await page.locator('#gwStart').click();
  const flag=await page.evaluate(async()=>{const r=await api('/api/bonus/stage?id=1-3','GET');return r.coachBonus13;});
  ok(flag===false,width+' server suppresses replays');
  await page.evaluate(()=>gsplitEnd());
  await open(3);
  ok(await dialog.count()===0,width+' re-opening 1-3 has no coach');
  ok(!errs.length,width+' no page errors '+errs.join(' | '));
}
(async()=>{
  try{
    if(process.env.SHOTS) fs.mkdirSync(process.env.SHOTS,{recursive:true});
    for(const [w,h] of [[844,390],[882,344],[1440,800]]){
      try{await run(w,h);}finally{if(browser)await browser.close();if(child)child.kill();}
    }
    console.log((checks-fails)+'/'+checks+' checks passed');
    if(fails) process.exitCode=1;
  }catch(e){console.error('FAIL',e);process.exitCode=1;}
})();