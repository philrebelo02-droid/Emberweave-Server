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
/* Grok bug hunt 12 Nov, v2 part 2 (ChatGPT 02:18 code-read list): BACKGROUND repaints of a whole screen - the 45 s ledger reconcile on Home and
   Campaign, and the Arena daily reset in the 1 s tick - rebuild the node under a held press, so that tap does nothing.
   CONTROL (c3bf2a12) must FAIL the "kept" checks; patched must PASS them and still repaint once the press ends. */
async function probePoint(page,scr,render){ return page.evaluate(([scr,render])=>{ const R=()=>(0,eval)(render); const root=document.getElementById(scr);
  const cands=[...root.querySelectorAll('*')].filter(e=>{ const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return cs.visibility!=='hidden'&&r.width>24&&r.height>16&&r.width<innerWidth*0.5&&r.top>50&&r.bottom<innerHeight-10&&r.left>10&&r.right<innerWidth-10; });
  const pts=cands.map(e=>{ const r=e.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]; }).filter(([x,y])=>{ const h=document.elementFromPoint(x,y); return h&&root.contains(h); });
  for(const [x,y] of pts){ const h=document.elementFromPoint(x,y); h.dataset.cal='1'; R(); const gone=!h.isConnected; if(gone){ const n=document.elementFromPoint(x,y); return [x,y,(n.className||n.tagName)+''] ; } delete h.dataset.cal; }
  return null; },[scr,render]); }
async function heldCase(page,nm,label,scr,render,trigger,after){
  const p=await probePoint(page,scr,render); if(!p){ ok(false,nm+' '+label+': no node found that a repaint replaces'); return; }
  await page.evaluate(([x,y])=>{ document.querySelectorAll('[data-held-probe]').forEach(e=>delete e.dataset.heldProbe); document.elementFromPoint(x,y).dataset.heldProbe='1'; },p);
  await page.mouse.move(p[0],p[1]); await page.mouse.down(); await page.evaluate(trigger); await delay(1300);
  const kept=await page.locator('[data-held-probe]').count(); await page.mouse.move(4,4); await page.mouse.up(); await delay(1200);
  const redrawn=await page.locator('[data-held-probe]').count(); if(after) await page.evaluate(after);
  ok(kept===1, nm+' '+label+': the node under a held press is not rebuilt ('+p[2].slice(0,30)+')');
  ok(redrawn===0, nm+' '+label+': the held-back repaint still runs after the press ends'); }
(async()=>{ try{
  const {page,errs}=await boot();
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ await page.setViewportSize({width:w,height:h}); await delay(4500);
    await page.evaluate(()=>show('home')); await delay(1500);
    await heldCase(page,nm,'Home ledger reconcile','home','renderHome()','ledgerSync()');
    await page.evaluate(()=>show('campaign')); await delay(1500);
    await heldCase(page,nm,'Campaign ledger reconcile','campaign','renderRoadmap()','ledgerSync()');
    await page.evaluate(()=>show('arena')); await delay(2500); await page.evaluate(()=>{ window._adr=arenaDailyReady; arenaDailyReady=()=>false; renderArena(); });   /* v3: a counting-down daily (a ready one no longer repaints every second) */
    await heldCase(page,nm,'Arena daily reset tick','arena','renderArena()','(()=>{ window._adl=arenaDailyLeft; arenaDailyLeft=()=>0; })()','(()=>{ arenaDailyLeft=window._adl; arenaDailyReady=window._adr; })()');
    await page.evaluate(()=>show('home')); await delay(500); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('background repaints under a held press (Home / Campaign / Arena)'); await cleanup(); } })();
