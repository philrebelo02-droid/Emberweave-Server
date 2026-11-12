// v1374 (Testers Community report 12 Nov, items picked by Phil): password eye toggle on every password box + Back asks before leaving even when Android would skip an untouched history entry. CONTROL: EW_ROOT=<1ca2631e copy> must FAIL.
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
(async()=>{ try{
  const {page,errs}=await boot({grant:false});
  /* every password box gets an eye: the account screens, plus one added later (the observer) */
  const r=await page.evaluate(async()=>{ try{ show('settings'); }catch(e){} await new Promise(r=>setTimeout(r,800));
    const d=document.createElement('div'); d.innerHTML='<input id="tpw" type="password" autocomplete="new-password" style="width:200px;padding:9px;margin-bottom:8px;border-radius:8px;border:1px solid #33405e;background:#0f1420;color:#e6edf3">'; document.body.appendChild(d);
    await new Promise(r=>setTimeout(r,150));
    const all=[...document.querySelectorAll('input[type=password]')], bare=all.filter(i=>!i.dataset.ewEye||!i.parentNode.querySelector('.ewPwEye'));
    const inp=document.getElementById('tpw'), btn=inp.parentNode.querySelector('.ewPwEye');
    const t0=btn&&btn.title; inp.value='abc'; inp.dispatchEvent(new Event('input')); const bad=inp.classList.contains('ewPwBad');
    btn.click(); const shown=inp.type, t1=btn.title; btn.click(); const hidden=inp.type;
    inp.value='abcdefgh'; inp.dispatchEvent(new Event('input')); const good=inp.classList.contains('ewPwOk');
    const br=btn.getBoundingClientRect(), ir=inp.getBoundingClientRect();
    return {rb:[br.left,br.right,br.top,br.bottom].map(Math.round),ri:[ir.left,ir.right,ir.top,ir.bottom].map(Math.round),n:all.length,bare:bare.length,t0,t1,shown,hidden,bad,good,inside:br.right<=ir.right+0.5&&br.left>=ir.left&&br.top>=ir.top-1&&br.bottom<=ir.bottom+1,mb:inp.parentNode.style.marginBottom}; });
  ok(r.bare===0,'every password box has an eye ('+r.n+' boxes, '+r.bare+' without)');
  ok(r.t0==='Show password'&&r.t1==='Hide password','tooltip says what it does ('+r.t0+' / '+r.t1+')');
  ok(r.shown==='text'&&r.hidden==='password','tap shows, tap again hides');
  ok(r.inside,'the eye sits inside the box on its right edge (eye '+r.rb+' box '+r.ri+')');
  ok(r.mb==='8px','the box keeps its spacing (margin moved to the wrapper: '+r.mb+')');
  ok(r.bad&&r.good,'new-password border goes red under 8 characters, green at 8');
  /* Back: the trap is re-pushed by the first touch, so Android cannot skip it */
  const d0=await page.evaluate(()=>window.ewBackDepth()); await page.mouse.click(5,5); const d1=await page.evaluate(()=>window.ewBackDepth());
  ok(d1===d0+1,'first touch re-pushes the back trap ('+d0+' -> '+d1+')');
  await page.mouse.click(6,6); const d2=await page.evaluate(()=>window.ewBackDepth()); ok(d2===d1,'later touches add nothing ('+d2+')');
  await page.goBack({waitUntil:'commit',timeout:3000}).catch(()=>{}); await delay(700);
  const c=await page.evaluate(()=>({dlg:!!document.getElementById('uiConfirmWrap'),url:location.pathname,d:window.ewBackDepth()}));
  ok(c.dlg&&c.url==='/play','Back asks "Leave Emberweave?" and stays in the game ('+JSON.stringify(c)+')');
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('password eye + back confirm'); await cleanup(); } })();
