// v1372 hardening: if /assets/ui/fold-viewport.js fails to load (a dropped request on a phone), the game must not throw
// "x.ewGameRect is not a function" on every screen - the inline fallback after its <script> tag installs plain browser equivalents.
// Seen in a test run on 12 Nov (3 page errors on the campaign map while PC 1 was loaded). Blocks the script, opens the campaign map
// and a stage card, and expects no page errors. CONTROL: EW_ROOT=<a v1371 copy> fails.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const delay=ms=>new Promise(r=>setTimeout(r,ms)); let child,browser,fails=0,checks=0;
const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
(async()=>{ try{
  const port=await freePort(), base='http://127.0.0.1:'+port, temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-vpfb-'));
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json')},stdio:'ignore',windowsHide:true});
  for(let i=0;i<200;i++){ try{ if((await fetch(base+'/api/health')).ok) break; }catch(_){} await delay(150); }
  browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  for(const [w,h,n] of [[844,390,'phone'],[1440,800,'PC']]){
    const ctx=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[];
    page.on('pageerror',e=>errs.push(String(e).slice(0,140)));
    let blocked=0; await page.route(/fold-viewport\.js/,r=>{ blocked++; r.abort(); });
    await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
    await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof show==='function'&&typeof G!=='undefined',null,{timeout:120000});
    ok(blocked>0,n+': fold-viewport.js was blocked');
    const shim=await page.evaluate(()=>({rect:typeof Element.prototype.ewGameRect, view:typeof ewGameView, ep:typeof ewGameElementFromPoint, vp:!!window.EWViewport}));
    ok(shim.rect==='function'&&shim.view==='function'&&shim.ep==='function'&&shim.vp,n+': the fallback helpers are installed ('+JSON.stringify(shim)+')');
    await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); show('campaign'); }); await delay(2500);
    await page.evaluate(()=>{ try{ openStageModal(1,'normal'); }catch(e){} }); await delay(1200);
    await page.evaluate(()=>{ try{ window.dispatchEvent(new Event('resize')); }catch(e){} }); await delay(800);
    ok(errs.length===0,n+': campaign map + stage card with the script blocked: no page errors ('+errs.length+(errs[0]?': '+errs[0]:'')+')');
    await ctx.close(); }
} catch(e){ fails++; console.log('  FAIL '+(e&&e.message||e)); }
  finally{ try{ await browser.close(); }catch(_){} if(child){ child.kill(); for(let i=0;i<100&&child.exitCode===null&&child.signalCode===null;i++) await delay(50); } }
  console.log('test_viewport_fallback_1372.js: '+(checks-fails)+'/'+checks+' passed, '+fails+' failed'); process.exit(fails?1:0); })();
