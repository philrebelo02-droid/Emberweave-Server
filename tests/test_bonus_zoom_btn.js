const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require('playwright');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-zoom42-'));
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
async function run(width,height){
  const {page,errs}=await boot({width,height}); const tag=width+'x'+height;
  ok(await page.locator('#bonusZoomBtn').count()===1, tag+' #bonusZoomBtn exists in the page');
  ok(await rectOf(page,'#bonusZoomBtn')===null, tag+' hidden outside a bonus run');
  await page.evaluate(async()=>{await api('/api/admin/led-grant','POST',{unlock:Object.keys(HERO_TYPES).slice(0,12),campCleared:4});await ledgerSync();});
  await page.evaluate(()=>{show('campaign');openBonusModal(1,4);});
  await page.locator('#gsplitPicker .gsplitHero').first().waitFor({timeout:30000});
  for(const hero of (await page.locator('#gsplitPicker .gsplitHero').all()).slice(0,3)) await hero.click();
  await page.locator('#gsplitNext').click();
  await page.locator('#gsplitAutoPlace').click();
  await page.locator('#gsplitStart').click();
  await page.waitForFunction(()=>typeof GSPLIT!=='undefined'&&GSPLIT.active&&state==='battle',null,{timeout:60000});
  await delay(1200);
  const btn=page.locator('#bonusZoomBtn');
  ok(await btn.getAttribute('data-bonus-zoom')!==null, tag+' carries data-bonus-zoom');
  const r=await rectOf(page,'#bonusZoomBtn');
  ok(!!r && r.x>=0 && r.y>=0 && r.x+r.w<=width && r.y+r.h<=height, tag+' visible and on screen '+JSON.stringify(r));
  for(const s of ['#speedBtn','#autoBtn','#pauseBtn','#topStatus .stTag','#battleBanner']){ const o=await rectOf(page,s); ok(!overlap(r,o), tag+' does not overlap '+s); }
  ok(await page.evaluate(()=>battleZoom)===1, tag+' run starts at 1x');
  ok((await btn.textContent()).trim()==='Zoom 1x', tag+' label Zoom 1x');
  if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,tag+'-1x.png')});
  const seq=[]; const pans=[];
  for(const want of [1.5,2,1]){ await btn.click(); await delay(350); const z=await page.evaluate(()=>battleZoom); seq.push(z);
    ok(z===want, tag+' tap -> '+want+'x (got '+z+')'); ok((await btn.textContent()).trim()==='Zoom '+want+'x', tag+' label Zoom '+want+'x');
    ok(await page.evaluate(()=>document.getElementById('battleBg').style.transform.includes('scale('+battleZoom+')')), tag+' map transform follows '+want+'x');
    if(process.env.SHOTS && want>1) await page.screenshot({path:path.join(process.env.SHOTS,tag+'-'+want+'x.png')});
    if(want===2){ // drag pans as today
      const c={x:width*0.45,y:height*0.5}; await page.mouse.move(c.x,c.y); await page.mouse.down(); await page.mouse.move(c.x+60,c.y+30,{steps:6}); await page.mouse.up();
      const p=await page.evaluate(()=>[battlePanX,battlePanY]); pans.push(p); ok(p[0]!==0||p[1]!==0, tag+' drag pans at 2x '+JSON.stringify(p)); }
  }
  ok(await page.evaluate(()=>battlePanX===0&&battlePanY===0), tag+' back at 1x the pan resets');
  ok(await page.evaluate(()=>!paused), tag+' tapping zoom does not pause the run');
  // the wheel still zooms (to 1.25x), the label follows it, and the next tap goes to the next cycle step above
  await page.mouse.move(width*0.45,height*0.5); await page.mouse.wheel(0,-100); await delay(300);
  ok(await page.evaluate(()=>battleZoom)===1.25 && (await btn.textContent()).trim()==='Zoom 1.25x', tag+' wheel still zooms and the label follows (1.25x)');
  await btn.click(); await delay(300); ok(await page.evaluate(()=>battleZoom)===1.5, tag+' tap after the wheel -> 1.5x');
  await btn.click(); await btn.click(); await delay(300); ok(await page.evaluate(()=>battleZoom)===1, tag+' and round to 1x');
  await page.evaluate(()=>gsplitShowResult(false,{won:false})); await delay(800);   // the real end-of-run path: gsplitEnd + gsplitHudExit
  ok(await rectOf(page,'#bonusZoomBtn')===null, tag+' hidden again after the run ends (gsplitShowResult)');
  ok(!errs.length, tag+' no page errors '+errs.join(' | '));
}
(async()=>{
  try{
    if(process.env.SHOTS) fs.mkdirSync(process.env.SHOTS,{recursive:true});
    for(const [w,h] of [[844,390],[882,344],[1440,800]]){
      try{await run(w,h);}catch(e){ fails++; console.log('FAIL '+w+'x'+h+' '+String(e&&e.message||e).split('\n')[0]); }finally{if(browser)await browser.close();if(child)child.kill();}
    }
    console.log('test_bonus_zoom_btn: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed');
    if(fails) process.exitCode=1;
  }catch(e){console.error('FAIL',e);process.exitCode=1;}
})();