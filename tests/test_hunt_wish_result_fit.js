// v1364 (tester A P10, 11 Nov): the close X on every menu and Vael's Play Voice icon sat ~1.9 px left of centre (.stIc margin-right in an icon-only button). Grok. CONTROL: EW_ROOT=<217ca0bf copy> must FAIL.
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
/* Wishing Pool single-wish result card must fit short screens: on 882x344 the hero card (132px art + name + 2 buttons)
   was ~366px tall in a fixed, non-scrolling overlay, so its top and bottom edges were cut off. */
(async()=>{ try{
  const {page,errs}=await boot();
  await page.evaluate(async()=>{ await api('/api/admin/led-grant','POST',{campCleared:45,gems:5000,gold:50000}); if(typeof ledgerSync==='function') await ledgerSync(); });
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ await page.setViewportSize({width:w,height:h}); await page.evaluate(()=>show('wishing')); await delay(800);
    const m=await page.evaluate(()=>{ const hk=Object.keys(HERO_TYPES).find(k=>BATTLE_ANIM[k]&&BATTLE_ANIM[k].idle); const res=serverWishToRes({type:'hero',hero:hk,stars:2});
      showWishResult(res,'gem'); const ov=document.body.lastElementChild, c=ov.firstElementChild, r=c.getBoundingClientRect();
      const btn=ov.querySelector('#_wishAgain'), br=btn.getBoundingClientRect(); c.scrollTop=1e6; const br2=btn.getBoundingClientRect();
      const out={top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight,reach:br2.bottom<=innerHeight+0.5}; ov.remove(); return out; });
    ok(m.top>=0&&m.bottom<=m.vh, nm+': result card inside the screen (card '+m.top+'..'+m.bottom+', screen 0..'+m.vh+')');
    ok(m.reach, nm+': Wish Again reachable'); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('wish result fit'); await cleanup(); } })();