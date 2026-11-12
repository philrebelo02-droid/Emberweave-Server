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
/* Dropped taps on the Academy + Wishing Pool (Grok bug hunt 12 Nov). The 1 s live tick (html ~19661) rebuilds the whole Academy panel
   (renderTech: p.innerHTML='') and the Wishing Pool (renderWishing) every second. A mouse click needs its press and release on the SAME
   element, so a click whose press and release straddle a tick lands on a node that no longer exists and does nothing.
   CONTROL: the b5834f39 html must FAIL; patched (no rebuild while a pointer is held) must PASS. v2 adds the held sync-reply case. */
(async()=>{ try{
  const {page,errs}=await boot();
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ await page.setViewportSize({width:w,height:h}); await delay(4500);
    ok(await page.evaluate(([w,h])=>EWViewport.state.width===w&&EWViewport.state.height===h,[w,h]), nm+': game frame is '+nm);
    /* Academy: 24 clicks with a 150 ms press on the track nodes, spread over the tick */
    await page.evaluate(()=>{ techSel='academy'; show('tech'); renderTech(); }); await delay(800);
    const order=['atk','hp','ap','heal','armor','mr','crit','critres']; let got=0;
    for(let i=0;i<24;i++){ const k=order[i%8];
      const c=await page.evaluate(k=>{ const n=[...document.querySelectorAll('#tech .tw-node')].find(x=>x.getAttribute('aria-label')===((techText(k)||[k])[0])); const r=n.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]; },k);
      await delay(37*i%1000);
      await page.mouse.move(c[0],c[1]); await page.mouse.down(); await delay(150); await page.mouse.up(); await delay(60);
      if(await page.evaluate(k=>techSel===k,k)) got++; }
    ok(got===24, nm+' Academy: '+got+'/24 clicks on a track registered');
    /* deterministic: hold 1.3 s on a node - the node under the pointer must still be the same element at release */
    const same=async()=>{ await page.evaluate(()=>{ const n=document.querySelector('#tech .tw-node'); n.dataset.probe='1'; const r=n.getBoundingClientRect(); window._pp=[r.left+r.width/2,r.top+r.height/2]; });
      const p=await page.evaluate(()=>window._pp); await page.mouse.move(p[0],p[1]); await page.mouse.down(); await delay(1300);
      const s=await page.evaluate(()=>!!document.querySelector('#tech .tw-node[data-probe]')); await page.mouse.up(); await delay(200); return s; };
    ok(await same(), nm+' Academy: a held press is not rebuilt under the finger');
    await page.evaluate(()=>{ document.querySelector('#tech .tw-node').dataset.probe2='1'; }); await delay(1600);
    ok(await page.evaluate(()=>!document.querySelector('#tech .tw-node[data-probe2]')), nm+' Academy: with no pointer held the 1 s tick still re-renders (countdowns keep moving)');
    /* Wishing Pool: same hold probe on its first button */
    await page.evaluate(()=>{ show('wishing'); renderWishing(); }); await delay(800);
    const ws=await page.evaluate(()=>{ const n=[...document.querySelectorAll('#wishing button')].find(b=>{ const r=b.getBoundingClientRect(); return r.width>20&&r.height>10&&r.top>40; }); if(!n) return null; n.dataset.probe='1'; const r=n.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2,n.textContent.trim().slice(0,20)]; });
    if(ws){ await page.mouse.move(ws[0],ws[1]); await page.mouse.down(); await delay(1300); const s=await page.evaluate(()=>!!document.querySelector('#wishing button[data-probe]')); await page.mouse.move(5,5); await page.mouse.up(); await delay(300);
      await page.evaluate(()=>{ document.querySelectorAll('.modal,.ovl').forEach(()=>{}); });
      ok(s, nm+' Wishing Pool: a held press on "'+ws[2]+'" is not rebuilt under the finger'); }
    else ok(false, nm+' Wishing Pool: no button found');
    /* v2 (ChatGPT 02:18 repro): a background sync reply (/api/academy, /api/pool/state) that lands while a press is held must not rebuild the
       pressed node either, and the refresh it carries must still happen once the press ends */
    for(const [screen,endpoint,selector] of [['tech','**/api/academy','#tech .tw-node'],['wishing','**/api/pool/state','#wishing #wishingBody button']]){
      let release=null,queued; const intercepted=new Promise(r=>{queued=r;});
      await page.route(endpoint,async route=>{ const response=await route.fetch(); const gate=new Promise(r=>{release=r;}); queued(); await gate; await route.fulfill({response}); });
      await page.evaluate(screen=>{ if(screen==='tech'){ renderTech._lastSync=0; const key=Object.keys(G.res)[0]; G.res[key]=(G.res[key]||0)+123; } else { _poolAt=0; } show(screen); },screen);
      const got=await Promise.race([intercepted.then(()=>true),delay(8000).then(()=>false)]);
      if(!got){ ok(false,nm+' '+screen+': the background sync request was not seen'); await page.unroute(endpoint); continue; }
      const target=page.locator(selector).filter({visible:true}).first(); await target.evaluate(e=>{ e.dataset.syncProbe='1'; }); const box=await target.boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down(); release(); await delay(450);
      const kept=await page.locator('[data-sync-probe]').count(); await page.mouse.move(4,4); await page.mouse.up(); await delay(1200);
      const redrawn=await page.locator('[data-sync-probe]').count();
      ok(kept===1, nm+' '+(screen==='tech'?'Academy':'Wishing Pool')+': a sync reply during a held press does not rebuild the pressed node');
      ok(redrawn===0, nm+' '+(screen==='tech'?'Academy':'Wishing Pool')+': the held-back refresh runs after the press ends');
      await page.unroute(endpoint); await page.evaluate(()=>{ document.querySelectorAll('.modal,.ovl').forEach(()=>{}); });
    }    await page.evaluate(()=>show('home')); await delay(300); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('academy + wishing taps across the 1 s tick'); await cleanup(); } })();
