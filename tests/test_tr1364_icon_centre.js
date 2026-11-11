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
  const up=async()=>{for(const _t0=Date.now();Date.now()-_t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}   /* 11 Nov: a 60 s deadline, not an iteration count */throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  if(o.grant!==false) await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({args:['--mute-audio','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
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
/* the visible art of an icon-only button's <img>, from the image's own alpha, against the button's centre */
const ART=sel=>page_.evaluate(async(sel)=>{ const img=document.querySelector(sel); if(!img) return null; await img.decode().catch(()=>{});
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; const x=c.getContext('2d'); x.drawImage(img,0,0); const d=x.getImageData(0,0,c.width,c.height).data;
  let x0=1e9,y0=1e9,x1=-1,y1=-1; for(let j=0;j<c.height;j++) for(let i=0;i<c.width;i++) if(d[(j*c.width+i)*4+3]>40){ if(i<x0)x0=i; if(j<y0)y0=j; if(i>x1)x1=i; if(j>y1)y1=j; }
  const r=img.getBoundingClientRect(), sx=r.width/c.width, sy=r.height/c.height, b=(img.closest('button')||img.parentElement).getBoundingClientRect();
  return { dx:r.left+(x0+x1+1)/2*sx-(b.left+b.width/2), dy:r.top+(y0+y1+1)/2*sy-(b.top+b.height/2) }; },sel);
let page_;
(async()=>{ try{
  const {page,errs}=await boot(); page_=page;
  console.log('A P10 icon-only buttons centred, root='+ROOT);
  await page.evaluate(async()=>{ const a=await api('/api/admin/led-grant','POST',{unlock:Object.keys(HERO_TYPES)}); if(typeof ledgerSync==='function') await ledgerSync(); });
  const f=v=>v==null?'?':v.toFixed(2);
  for(const s of ['heroesPanel','bag','settings']){ await page.evaluate(s=>{ show('home'); popoutScreen(s); },s); await delay(900);
    const a=await ART('.screen.popout.active .popoutClose img');
    ok(a&&Math.abs(a.dx)<=0.75&&Math.abs(a.dy)<=0.75,s+' menu: the close X sits in the centre of its ring (dx '+f(a&&a.dx)+', dy '+f(a&&a.dy)+' px)'); }
  await page.evaluate(()=>{ closePopout(); detailHero='vael'; heroTab='lore'; show('heroDetail'); }); await delay(1200);
  const v=await ART('#loreBtn img');
  ok(v&&Math.abs(v.dx)<=0.75&&Math.abs(v.dy)<=0.75,"Vael's Play Voice icon sits in the centre of its button (dx "+f(v&&v.dx)+', dy '+f(v&&v.dy)+' px)');
  /* guard: an icon beside a word keeps its gap */
  await page.evaluate(()=>{ show('campaign'); }); await delay(900);
  const gap=await page.evaluate(()=>{ const i=document.querySelector('#campGlossBtn img.stIc'); return i?parseFloat(getComputedStyle(i).marginRight):null; });
  ok(gap!=null&&gap>0,'the Glossary icon keeps its gap before the word ('+gap+' px)');
  ok(errs.length===0,'no page errors ('+errs.slice(0,2).join(' | ')+')');
  finish('test_tr1364_icon_centre');
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ await cleanup(); } })();
