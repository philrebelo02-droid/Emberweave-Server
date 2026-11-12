// Grok v1376 hunt (Claude 13:28: "the UI tap sound ... no sound in battle or during spam"). The bubble-4 tap (ui.tap, v1375) is wired to EVERY
// pointerdown, so a fight plays a pop on every tap of the field / HUD (6 of 6), and 25 fast taps in a fight start 12 pops that take up to 3 of the
// 8 shared sound slots the combat sounds use. Checks: a tap outside a fight still pops; taps in a fight do not. Codec-free (spies sndPlay).
// FAILS on f2322e0e. Chromium: --disable-audio-output, never --mute-audio.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tapbat-')); const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0; const ok=(c,m)=>{checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',SIM_WORKERS:'0'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/api/health')).ok) break; }catch(_){} await delay(150); }
  const nm='tb'+Date.now().toString(36); const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:nm,pass:'password1'})})).json();
  const L={token:reg.token,id:reg.profile.id,name:nm};
  browser=await chromium.launch({ ignoreDefaultArgs:['--mute-audio'], args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const ctx=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(L=>{ try{ localStorage.setItem('ew_acc',JSON.stringify(L)); localStorage.setItem('ew_guest_step_'+L.id,'1'); }catch(e){} },L);
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(base+'/play',{waitUntil:'load',timeout:180000});
  await page.waitForFunction(()=>typeof sndPlay==='function'&&typeof show==='function'&&ACC&&ACC.token,null,{timeout:180000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(1200);
  await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; G.tutSkipped=true; G.ftutOff=true; try{_whatsNewDone=true;}catch(e){} document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); document.body.classList.remove('gated'); });
  await page.mouse.click(422,200); await delay(1200);
  await page.evaluate(()=>{ window.__tap=[]; const o=window.sndPlay; window.sndPlay=function(k,g){ const r=o.apply(this,arguments); if(k==='ui.tap') window.__tap.push({r,st:state}); return r; }; });
  const take=()=>page.evaluate(()=>{ const a=window.__tap.slice(); window.__tap.length=0; return a; });
  await page.evaluate(()=>show('home')); await delay(600); await take(); await page.mouse.click(422,200); await delay(250);
  const home=await take(); ok(home.some(x=>x.r), 'control: a tap outside a fight plays the UI tap ('+JSON.stringify(home)+')');
  await page.evaluate(()=>{ CUR={node:1,mode:'campaign',portal:'normal',opp:null}; teamCtx='campaign'; G.stamina=999; show('menu'); }); await delay(2500);
  await page.evaluate(()=>{ const b=document.getElementById('startBtn'); if(b) b.click(); });
  const inBattle=await page.waitForFunction(()=>state==='battle'&&typeof units!=='undefined'&&units.some(u=>u.team==='enemy'),null,{timeout:90000}).then(()=>true,()=>false);
  ok(inBattle,'a real 1-1 fight started'); await delay(1500); await take();
  for(let i=0;i<6;i++){ await page.mouse.click(422,215); await delay(250); }
  for(let i=0;i<25;i++){ await page.mouse.click(380+((i%5)*9),195); await delay(15); } await delay(300);
  const bt=await take(), inB=bt.filter(x=>x.st==='battle'), played=inB.filter(x=>x.r).length;
  ok(inB.length===0||played===0, 'no UI tap sound in a fight: 31 taps on the field -> '+played+' pops');
  ok(errs.length===0,'no page errors ('+errs.slice(0,2).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { console.log('ui tap battle 1377: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1;
  if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); await delay(300); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
