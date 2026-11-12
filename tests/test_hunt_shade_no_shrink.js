// v1374 (Phil 12 Nov: "When i drag down my android settings it still shrinks the game, dont let the game changes sizes please"): a small same-orientation shrink (system bars) keeps the game frame's size; rotation and big changes still refit. CONTROL: EW_ROOT=<1ca2631e copy> must FAIL.
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
const appSize=page=>page.evaluate(()=>{ const a=document.getElementById('app'); return {w:a.clientWidth,h:a.clientHeight}; });
(async()=>{ try{
  const {page,errs}=await boot({grant:false});
  for(const scr of ['home','campaign','heroes']){
    await page.setViewportSize({width:844,height:390}); await page.evaluate(s=>show(s),scr); await delay(900);
    const a0=await appSize(page);
    await page.setViewportSize({width:800,height:362}); await delay(900); const a1=await appSize(page);   /* Android status + nav bars shown */
    ok(a1.w===a0.w&&a1.h===a0.h, scr+': system bars shown -> game keeps its size ('+a0.w+'x'+a0.h+' -> '+a1.w+'x'+a1.h+')');
    if(scr==='home'){ await delay(5500); const a3=await appSize(page); ok(a3.w===a0.w&&a3.h===a0.h, 'shade held down past 4 s -> still the same size ('+a3.w+'x'+a3.h+')'); }
    await page.setViewportSize({width:844,height:390}); await delay(900); const a2=await appSize(page);
    ok(a2.w===a0.w&&a2.h===a0.h, scr+': bars hidden again -> same size ('+a2.w+'x'+a2.h+')');
  }
  await page.setViewportSize({width:390,height:844}); await delay(1500); const rot=await page.evaluate(()=>document.body.classList.contains('ew-rotated'));
  ok(rot, 'turning the phone upright still turns the game (ew-rotated)');
  await page.setViewportSize({width:844,height:390}); await delay(1500); const l=await appSize(page);
  ok(l.w===844&&l.h===390, 'back to landscape -> 844x390 ('+l.w+'x'+l.h+')');
  await page.setViewportSize({width:600,height:300}); await delay(4800); const s=await appSize(page);   /* a big change (split screen) lands */
  ok(s.w<=600&&s.h<=300, 'big shrink (split screen) refits to '+s.w+'x'+s.h);
  await page.setViewportSize({width:1280,height:720}); await delay(1500); const g=await appSize(page);
  ok(g.w>l.w, 'growing refits ('+g.w+'x'+g.h+')');
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('shade no shrink'); await cleanup(); } })();
