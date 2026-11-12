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
/* Temple of Ash (Grok bug hunt 12 Nov). CONTROL: the b5834f39 html must FAIL, the patched html must PASS.
   (A) Multi pray opened on the first open tier (Gold ritual) whatever tier the player had picked - pick Kindled, open Multi pray, tap
       Pray x10 and it spends gold (up to 10 Gold rituals at up to 100,000 each), or answers "Not enough currency".
   (B) the hero-choice grid sits on plate-v2.webp, whose pray-view bar and blessing frames are baked in, so empty frames show around the tiles. */
(async()=>{ try{
  const {page,errs,base}=await boot(); const SH=process.env.SHOTS; if(SH) fs.mkdirSync(SH,{recursive:true});
  const keys=await page.evaluate(()=>Object.keys(HERO_TYPES).slice(0,4));
  await page.evaluate(async(keys)=>{ await api('/api/admin/led-grant','POST',{unlock:keys,maxGlyphs:true,heroKeys:keys,gems:5000,heroXp:90000000}); await ledgerSync(); },keys);
  const tok=await page.evaluate(()=>ACC.token);
  const P=async(p,b)=>(await fetch(base+p,{method:'POST',headers:{'content-type':'application/json','x-token':tok},body:JSON.stringify(b)})).json();
  /* Temple 2 (5 keeper points): five Gold rituals, each discarded */
  for(let i=0;i<5;i++){ const r=await P('/api/temple/pray',{heroKey:keys[0],tier:'gold',requestId:'lvl'+i}); if(!r.ok) throw new Error('gold pray '+i+': '+r.error); await P('/api/temple/discard',{requestId:'dis'+i}); }
  await page.evaluate(()=>ledgerSync());
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ await page.setViewportSize({width:w,height:h}); await delay(4500);
    ok(await page.evaluate(([w,h])=>EWViewport.state.width===w&&EWViewport.state.height===h,[w,h]), nm+': game frame is '+nm);
    await page.evaluate(()=>{ templeView='grid'; templeAuto=null; show('temple'); renderTemple(); }); await delay(900);
    /* (B) points on the baked frames that no tile covers: bar row 3 and 4 (x 733-1533), blessing boxes 3 and 4 (x 1640-2280) */
    const hits=await page.evaluate(()=>{ const st=document.getElementById('tp2Stage').getBoundingClientRect(), u=st.width/2560;
      return [[1133,694],[1133,821],[1960,630],[1960,757]].map(([x,y])=>{ const px=st.left+x*u, py=st.top+y*u; const e=[...document.getElementById('tp2Stage').children].filter(c=>!c.classList.contains('tp2Plate')).find(c=>{ const r=c.getBoundingClientRect(), cs=getComputedStyle(c); return px>=r.left&&px<=r.right&&py>=r.top&&py<=r.bottom&&(cs.backgroundImage!=='none'||!/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)); }); return e?e.className:'nothing over the plate'; });   /* plate pointer-events:none, so check by box: an opaque stage layer over the plate at that point */ });
    ok(hits.every(c=>c!=='nothing over the plate'), nm+' grid: the baked bar / blessing frames are covered (hit: '+hits.join(', ')+')');
    if(SH) await page.screenshot({path:path.join(SH,'temple_grid_'+nm+'.png')});
    await page.evaluate(k=>document.querySelector('[data-tp2-hero="'+k+'"]').click(),keys[0]); await delay(600);
    await page.evaluate(()=>document.querySelector('[data-tp2-tier="kindled"]').click()); await delay(300);
    ok(await page.evaluate(()=>templeSelectedTier==='kindled'), nm+': Kindled picked on the screen');
    await page.evaluate(()=>document.getElementById('tp2Auto').click()); await delay(500);
    const shown=await page.evaluate(()=>({id:templeAuto&&templeAuto.tiers[templeAuto.i], txt:(document.querySelector('.tp2Auto .tp2AutoRow span')||{}).textContent}));
    ok(shown.id==='kindled', nm+': Multi pray opens on the picked tier (shows '+shown.id+' "'+String(shown.txt||'').trim()+'")');
    if(SH) await page.screenshot({path:path.join(SH,'temple_auto_'+nm+'.png')});
    await page.evaluate(()=>{ templeAuto=null; renderTemple(); }); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('temple multi-pray tier + grid frames'); await cleanup(); } })();
