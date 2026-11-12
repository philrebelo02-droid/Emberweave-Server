// v1374 (Phil 12 Nov: "Bubble 4" / "Everytime you tap anything on in the game it makes this sound, add another volume setting to reduce or turn off ui aound"). Codec-free (spies sndPlay). CONTROL: EW_ROOT=<ca24e8bb copy> must FAIL.
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
  await page.addInitScript(()=>{ try{  }catch(e){} });
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
  await page.mouse.click(400,200); await delay(1200);   /* the first touch starts the sound engine */
  await page.evaluate(()=>{ window.__tap=[]; const o=window.sndPlay; window.sndPlay=function(k,g){ const r=o.apply(this,arguments); if(k==='ui.tap') window.__tap.push(r); return r; }; });
  const st=await page.evaluate(()=>({ch:sndCh('ui.tap'),map:(AUDIO_MAP['ui.tap']||[]).map(l=>l.f),chs:SND_CH.slice(),cfg:SND.cfg.ui,bus:!!SND.bus.ui}));
  ok(st.ch==='ui'&&st.chs.includes('ui')&&st.bus, 'a 4th sound channel "ui" with its own volume bus ('+JSON.stringify(st.chs)+')');
  ok(st.map[0]==='sfx/UI-CLICK-BUBBLE-v1.m4a', 'the tap sound is bubble 4 (UI-CLICK-BUBBLE-v1.m4a)');
  await page.mouse.click(420,210); await delay(200); await page.mouse.click(300,150); await delay(200);
  let t=await page.evaluate(()=>window.__tap.slice());
  ok(t.length===2&&t.every(Boolean), 'every tap anywhere plays it ('+JSON.stringify(t)+')');
  await page.evaluate(()=>{ sndSet('ui',{on:false}); window.__tap=[]; }); await page.mouse.click(430,215); await delay(200);
  t=await page.evaluate(()=>window.__tap.slice());
  ok(t.length===1&&t[0]===false, 'UI switched off: the tap plays nothing ('+JSON.stringify(t)+')');
  await page.evaluate(()=>{ sndSet('ui',{on:true,vol:0.25}); }); const g=await page.evaluate(()=>SND.bus.ui.gain.value);
  ok(Math.abs(g-0.25)<0.01, 'the UI volume slider sets its own bus ('+g+')');
  const rows=await page.evaluate(()=>{ try{ show('home'); popoutScreen('settings'); renderSettings(); }catch(e){} const s=document.getElementById('snd_ui_on'); try{ pauseSndRender(); }catch(e){} return {set:!!s&&!!document.getElementById('snd_ui_vol'), label:s?s.closest('.set-row').textContent.trim().split(/\s+/)[0]:''}; });
  ok(rows.set&&rows.label==='UI', 'Settings has the UI row with its switch and slider ('+JSON.stringify(rows)+')');
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('ui tap sound'); await cleanup(); } })();
