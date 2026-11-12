// v1377 hunt F4 (Grok): the Heroes feature guide never plays in normal play. Players open Heroes from the town menu (data-pop -> popoutScreen), which never
// calls ftutCheck('heroesPanel') - only show('heroesPanel') did. Opening Heroes from the menu must start the 'heroes' guide (once), and the hero window
// guides (xp/glyph/skills/gear) must still play. 844x390 phone. CONTROL: FAILS on 6f1b947a. Chromium: --disable-audio-output, never --mute-audio.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-hguide-')); const delay=ms=>new Promise(r=>setTimeout(r,ms)); const SHOT=process.env.HGUIDE_SHOT||'';
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0; const ok=(c,m)=>{checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',SIM_WORKERS:'0'},stdio:'ignore',windowsHide:true});
  let up=false; for(let i=0;i<400&&!up;i++){ try{ up=(await fetch(base+'/api/health')).ok; }catch(_){} if(!up) await delay(150); } if(!up) throw new Error('throwaway server did not start');
  browser=await chromium.launch({ ignoreDefaultArgs:['--mute-audio'], args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});
  const nm='hg'+Date.now().toString(36); const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:nm,pass:'password1'})})).json();
  const L={token:reg.token,id:reg.profile.id,name:nm};
  const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(L=>{ try{ localStorage.setItem('ew_acc',JSON.stringify(L)); localStorage.setItem('ew_guest_step_'+L.id,'1'); window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} },L);
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(base+'/play',{waitUntil:'load',timeout:180000});
  await page.waitForFunction(()=>typeof FTUT_GUIDES!=='undefined'&&typeof show==='function'&&ACC&&ACC.token,null,{timeout:180000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} G.tutSkipped=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); document.body.classList.remove('gated');
    G.campaignCleared=Math.max(G.campaignCleared|0,5); G.ftutOff=false; G.ftutSeen={}; FTUT_GUIDES.forEach(x=>{ if(!['heroes','skills'].includes(x.k)) G.ftutSeen[x.k]=1; }); show('home'); });
  await delay(1200);
  const wait=async k=>{ for(let i=0;i<40;i++){ const g=await page.evaluate(()=>{ const b=document.getElementById('ftutBar'); return b&&!b.classList.contains('ftut-hold')?b.dataset.guide:null; }); if(g===k) return true; await delay(250); } return false; };
  // 1) town menu -> Heroes (a real click on the menu item, as a player does)
  const m=await page.evaluate(()=>{ const el=document.querySelector('.mitem[data-nav="heroesPanel"]'); if(!el) return {none:true}; el.click(); return {state,pop:typeof _popout!=='undefined'?_popout:null}; });
  ok(!m.none, 'town menu has the Heroes item');
  const fired=await wait('heroes'); ok(fired, 'Heroes opened from the town menu (pop-out, state '+m.state+', pop-out '+m.pop+') starts the Heroes guide');
  if(SHOT) await page.screenshot({path:SHOT});
  if(fired){ const n=await page.evaluate(async()=>{ const s=ms=>new Promise(r=>setTimeout(r,ms)); let n=0; for(let i=0;i<12;i++){ const b=document.querySelector('#ftutBar .ftut-next'); if(!b) break; b.click(); n++; await s(200); } return {n,seen:ftutSeen('heroes'),gone:!document.getElementById('ftutBar')}; });
    ok(n.seen&&n.gone, 'Next walks the Heroes guide to the end ('+n.n+' taps) and marks it seen');
    await page.evaluate(()=>{ closePopout(); show('home'); }); await delay(800);
    await page.evaluate(()=>document.querySelector('.mitem[data-nav="heroesPanel"]').click()); await delay(3000);
    ok(!(await page.evaluate(()=>!!document.getElementById('ftutBar'))), 'opening Heroes again does not replay it'); }
  // 2) the hero window guide still plays (card tap -> hero window, Skills tab)
  const hd=await page.evaluate(()=>{ try{ ftutEnd(false); }catch(e){} heroTab='skills'; const c=document.querySelector('#heroesPanel .hero-card'); if(!c) return false; detailHero=c.dataset.heroKey||'vael'; popoutScreen('heroDetail'); return true; });
  ok(hd&&await wait('skills'), 'hero window (Skills tab) still starts the Skills guide');
  ok(errs.length===0, 'no page errors ('+errs.slice(0,2).join(' | ')+')'); await ctx.close();
}catch(e){ console.error(e); fails++; } finally { console.log('heroes guide 1377: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1;
  if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); await delay(300); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
