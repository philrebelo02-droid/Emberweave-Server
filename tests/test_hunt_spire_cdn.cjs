// Grok bug hunt (Swarm Spire): a stalled cdnjs request (three.js, only used by the 3D pilot) held the Spire on a black screen until it timed out.
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

(async()=>{
  try {
    const {page,errs,base}=await boot();
    let stall=true, cdn=0;
    await page.route('**/cdnjs.cloudflare.com/**',async route=>{ cdn++; if(stall){ await delay(15000); return route.abort('timedout'); } return route.continue(); });
    for(const [w,h] of [[844,390],[882,344],[1440,800]]){
      const tag=w+'x'+h; await page.setViewportSize({width:w,height:h}); await delay(600);
      errs.length=0; const t0=Date.now(); await page.evaluate(()=>{ show('home'); openSurvivors(); });
      const fr=await (await page.waitForSelector('#survFrame')).contentFrame();
      const ready=await fr.waitForFunction(()=>{ const L=document.getElementById('lobby'); return L&&!L.hidden&&!L.classList.contains('wait')&&document.querySelectorAll('.lbT').length>1; },null,{timeout:60000}).then(()=>true,()=>false);
      const ms=Date.now()-t0;
      ok(ready&&ms<6000,tag+' cdnjs stalled: the Spire lobby is up in '+ms+' ms (limit 6000)');
      await fr.click('#lbPlay'); await delay(300); if(await fr.evaluate(()=>!document.getElementById('lbAsk').hidden)) await fr.click('#lbAskYes');   /* the frame closed mid-run last size: its autosave is offered */
      const run=await fr.waitForFunction(()=>window._S&&window._S.t>2,null,{timeout:30000}).then(()=>true,()=>false);
      ok(run,tag+' and a 2D run plays');
      ok(!errs.some(e=>/THREE/.test(e)),tag+' no "THREE is not defined" error: '+(errs.join(' | ')||'none'));
      await fr.evaluate(()=>{ try{ parent.postMessage('survivors-close',location.origin); }catch(e){} }); await page.waitForFunction(()=>!document.getElementById('survFrame'),null,{timeout:15000});
    }
    // the 3D pilot (dev page, Linnet 3D) still loads three.js and its GLTF loader when it is used
    stall=false; const p2=await page.context().newPage(); const e2=[]; p2.on('pageerror',e=>e2.push(String(e.message||e)));
    await p2.route('**/cdnjs.cloudflare.com/**',route=>{ cdn++; route.continue(); });
    await p2.goto(base+'/survivors',{waitUntil:'load'}); await p2.waitForSelector('#go'); const before=await p2.evaluate(()=>typeof THREE);
    await p2.evaluate(()=>{ document.getElementById('use3d').checked=true; }); await p2.click('#go');
    const got=await p2.waitForFunction(()=>typeof THREE!=='undefined'&&!!THREE.GLTFLoader,null,{timeout:30000}).then(()=>true,()=>false);
    ok(got,'3D pilot: three.js + GLTFLoader load on demand (THREE before PLAY: '+before+')');
    await delay(4000); ok(!e2.length,'3D pilot: no page errors '+e2.join(' | '));
  } catch(error){console.error(error);fails++;}
  finally{ if(browser)await browser.close(); if(child)child.kill(); console.log('Spire without cdnjs: '+(checks-fails)+'/'+checks+' checks passed'); process.exitCode=fails?1:0; }
})();