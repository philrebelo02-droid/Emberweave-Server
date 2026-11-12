// v1364 (tester B 2.4, 11 Nov): tapping a hero in the three-roads run drew the campaign's 11 px gold box over the tiny bonus hero. Grok. CONTROL: EW_ROOT=<217ca0bf copy> must FAIL.
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
  const up=async()=>{for(const _t0=Date.now();Date.now()-_t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}   /* 11 Nov: a 60 s deadline, not an iteration count */throw new Error('throwaway server did not start');};
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
(async()=>{ try{
  const {page,errs}=await boot();
  console.log('B 2.4 bonus-run selection outline, root='+ROOT);
  ok(await bonusReady(page),'heroes unlocked, campaign cleared to 45');
  await openBonus(page,'1-4'); await startBonus(page);
  /* record every frame drawn on the battle overlay while a bonus hero is selected */
  const r=await page.evaluate(async()=>{ const u=units.find(u=>u.team==='ally'&&u.alive&&u._gauntScale); if(!u) return {err:'no bonus hero'}; selected=u;
    const P=CanvasRenderingContext2D.prototype, sr=P.strokeRect, el=P.ellipse, rec={box11:0, rects:0, ellipses:0};
    P.strokeRect=function(x,y,w,h){ if(this.canvas&&this.canvas.id==='overlay'){ rec.rects++; if(Math.abs(h-11)<0.01&&/#ffd45e/i.test(String(this.strokeStyle))) rec.box11++; } return sr.apply(this,arguments); };
    P.ellipse=function(){ if(this.canvas&&this.canvas.id==='overlay'&&/#ffd45e/i.test(String(this.strokeStyle))) rec.ellipses++; return el.apply(this,arguments); };
    await new Promise(r=>setTimeout(r,900)); P.strokeRect=sr; P.ellipse=el; rec.stillSelected=selected===u; return rec; });
  ok(!r.err,'a bonus-run hero was selected ('+(r.err||'ok')+')');
  ok(r.box11===0,'no 11 px gold box is drawn round the selected bonus hero (drawn '+r.box11+' times in 0.9 s)');
  ok(r.ellipses>0,'the selected bonus hero gets a gold ring at its feet ('+r.ellipses+' frames)');
  ok(errs.length===0,'no page errors ('+errs.slice(0,2).join(' | ')+')');
  finish('test_tr1364_bonus_select_ring');
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ await cleanup(); } })();
