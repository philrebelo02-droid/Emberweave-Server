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
  if(o.grant!==false) await J('/api/admin/led-grant',{px:99000000,gold:5000000,gems:200000,arenaCoins:50000,guildCoins:50000},L.token);
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
/* Grok bug hunt 12 Nov - Arena shop + Guild shop: every tap minted a NEW requestId (uid8), unlike the Market / Shady / HUD shops
   (Market audit #7 / v1010: one id per offer until a definite answer). So when the reply to a purchase is lost (offline, timeout,
   front-door 503) but the server booked it, the player's retap is a SECOND purchase and pays again.
   Repro: the first reply is dropped after the server answered (route.fetch then abort), then the player taps again.
   main must FAIL (charged twice, 2 different ids); patched must PASS (same id, server answers with the receipt, charged once). */
async function lostThenRetap(page,label,urlGlob,openFn,btnFind,coinKey,cost,goldGain){
  const ids=[]; let first=true;
  await page.route(urlGlob,async route=>{ try{ ids.push(JSON.parse(route.request().postData()||'{}').requestId); }catch(e){}
    if(first){ first=false; await route.fetch(); await route.abort('internetdisconnected'); return; } await route.continue(); });
  await page.evaluate(async()=>{ await ledgerSync(); }); await delay(400);
  const before=await page.evaluate((k)=>({c:G[k]|0,g:G.gold|0}),coinKey);
  await page.evaluate(openFn); await delay(1500);
  await page.evaluate(btnFind); await delay(2500);   /* tap 1: the server books it, the reply is lost */
  await page.evaluate(openFn); await delay(1200);
  await page.evaluate(btnFind); await delay(2500);   /* tap 2: the player retries */
  await page.evaluate(async()=>{ await ledgerSync(); }); await delay(600);
  const after=await page.evaluate((k)=>({c:G[k]|0,g:G.gold|0}),coinKey);
  await page.unroute(urlGlob);
  const paid=before.c-after.c, got=after.g-before.g;
  ok(ids.length===2&&ids[0]&&ids[0]===ids[1], label+': the retap re-sends the SAME requestId ('+ids.map(x=>String(x).slice(0,6)).join(' / ')+')');
  ok(paid===cost&&got===goldGain, label+': charged once after a lost reply + retap (paid '+paid+' '+coinKey+', got '+got+' gold; one purchase = '+cost+' / '+goldGain+')'); }
(async()=>{ try{
  const {page,errs}=await boot();
  const g=await page.evaluate(async()=>{ const r=await api('/api/guild/create','POST',{name:'Rid Guild'}); try{ await guildFetch(); }catch(e){} await ledgerSync(); return r&&(r.error||'ok'); });
  ok(g==='ok','fixture: guild created ('+g+')');
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ await page.setViewportSize({width:w,height:h}); await delay(2500);
    await lostThenRetap(page,nm+' Arena shop Gold Cache','**/api/arena/shop',
      ()=>show('arenaShop'),
      ()=>{ const row=[...document.querySelectorAll('#arenaShopList > div')].find(r=>/5,000|5000/.test(r.textContent)); const b=row&&row.querySelector('button'); if(b) b.click(); },
      'arenaCoins',120,5000);
    await lostThenRetap(page,nm+' Guild shop Gold Cache','**/api/shop/buy',
      ()=>{ document.querySelectorAll('.gmodal-ov').forEach(m=>m.remove()); show('guild'); openGuildShop(); },
      ()=>{ const b=document.querySelector('.gmodal-ov [data-buy="1"]'); if(b) b.click(); },
      'guildCoins',300,5000);
    await page.evaluate(()=>{ document.querySelectorAll('.gmodal-ov').forEach(m=>m.remove()); show('home'); }); await delay(400); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('arena + guild shop retap after a lost reply'); await cleanup(); } })();