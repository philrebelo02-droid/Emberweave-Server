const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require('playwright');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-graphics-'));
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
  const ctx=await browser.newContext({viewport:{width:o.width,height:o.height},deviceScaleFactor:o.dpr,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {page,errs,base,L}; }
async function run(width,height,dpr){
  const {page,errs}=await boot({width,height,dpr});
  const select=page.locator('#setGraphicsSel');
  const settings=async()=>{await page.evaluate(()=>{setTab='general';show('settings');});await select.waitFor({timeout:10000});};
  await settings();
  ok(await select.inputValue()==='high',width+' High default');
  const shot=async tag=>{if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,width+'x'+height+'-'+tag+'.png')});};
  for(const preset of ['high','balanced','low']){
    await select.selectOption(preset);
    await shot('settings-'+preset);
  }
  await page.evaluate(async()=>{
    const owned=Object.keys(HERO_TYPES).slice(0,12);
    await api('/api/admin/led-grant','POST',{unlock:owned,campCleared:4});
    await ledgerSync();
    show('campaign');
    openBonusModal(1,4);
  });
  await page.locator('#gsplitAuto').click();
  await page.locator('#gsplitNext').click();
  await page.locator('#gsplitAutoPlace').click();
  await page.locator('#gsplitStart').click();
  await page.waitForFunction(()=>GSPLIT.active&&state==='battle'&&!!renderer,null,{timeout:60000});
  await page.evaluate(()=>{QUAL.locked=true;QUAL.dpr=window.devicePixelRatio;setGraphicsPreset('high');setBattleZoom(1.5);});
  const capture=async preset=>{
    const info=await page.evaluate(preset=>{
      const stateSnapshot=()=>JSON.stringify({time:battleTime,zoom:battleZoom,wave:GSPLIT.waveShown,
        roads:GSPLIT.lanes.map(l=>l.units.map(u=>[u.uid,u.hp,u.x,u.y,u.alive]))});
      const before=stateSnapshot();
      setGraphicsPreset(preset);
      const webgl=renderer.getContext();
      return {ratio:renderer.getPixelRatio(),webgl:[webgl.drawingBufferWidth,webgl.drawingBufferHeight],
        overlay:[overlay.width,overlay.height],css:[CW,CH],sameState:before===stateSnapshot()};
    },preset);
    await shot('battle-'+preset);
    info.rgbaMiB=+(4*(info.webgl[0]*info.webgl[1]+info.overlay[0]*info.overlay[1])/1048576).toFixed(2);
    return info;
  };
  const high=await capture('high'), balanced=await capture('balanced'), low=await capture('low');
  ok(high.ratio>balanced.ratio&&balanced.ratio>low.ratio,width+' three renderer tiers at zoom');
  ok(balanced.ratio===2&&low.ratio===1,width+' final DPR capped after zoom');
  ok(high.sameState&&balanced.sameState&&low.sameState,width+' setting changes do not mutate fight state');
  ok(high.css.join()===low.css.join()&&low.rgbaMiB<high.rgbaMiB,width+' smaller buffers at unchanged CSS size');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof graphicsPreset!=='undefined');
  ok(await page.evaluate(()=>graphicsPreset==='low'&&localStorage.getItem('ew_graphics_quality')==='low'),width+' Low restored after reload');
  ok(!errs.length,width+' no page errors '+errs.join(' | '));
  console.log(JSON.stringify({width,height,dpr,high,balanced,low}));
}
(async()=>{
  try{
    if(process.env.SHOTS) fs.mkdirSync(process.env.SHOTS,{recursive:true});
    for(const [w,h,dpr] of [[844,390,3],[882,344,2.625],[1440,800,1.5]]){
      try{await run(w,h,dpr);}finally{if(browser)await browser.close();if(child)child.kill();}
    }
    console.log((checks-fails)+'/'+checks+' checks passed');
    if(fails) process.exitCode=1;
  }catch(e){console.error('FAIL',e);process.exitCode=1;}
})();
