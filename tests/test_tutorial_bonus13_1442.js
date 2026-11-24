/* v1442 - BONUS 1-3 IS THE LAST GETTING STARTED STEP (Phil 24 Nov 2026: "Is bonus stage part of tutorial? If not lets add it as the last step" /
   "Make it tutorial lines like the other help steps" / "Build the voice lines like you did all the other ones in the game" / "That the bottom of the
   screen when you open campaign"). Real server (throwaway, free port) + the real page (one headless Chromium).
   A. An account that finished the old 14 steps (tutDone) gets the ONE new step back, open, in "own pace" mode; the server refuses its claim before the clear.
   B. A player at that step is walked through it by the guide bar (#ftutBar - Vael, Vireo, Sylthaine, Vex): Go opens the map on chapter 1, the Bonus talk
      ends on the Bonus 1-3 building (lit), the line-up screen, the roads screen, the run's start, the first firebreak (boon, then crossing) and the result
      each speak their lines IN ORDER, the run is held while a line shows, and the buttons to press glow in turn.
   C. The step is then claimable: 30 diamonds from the server, 15 / 15, tutorial complete; a second claim pays nothing.
   Asserts (non-zero exit). EW_ROOT=<tree> runs it against another tree (the v1439 tree must FAIL). */
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tutb13-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg,d)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg+(d!==undefined?' - '+JSON.stringify(d).slice(0,400):'')); } };
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),DATABASE_URL:'',DB_STORE:'',ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',RL_MUL:'100000',SIM_WORKERS:'0',BONUS_MIN_RESOLVE_MS:'0'};
  const up=async()=>{for(let i=0;i<400;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tb'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(2600); child.kill(); await delay(1200);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  await J('/api/admin/led-grant',{campCleared:5},L.token);
  const pre=await J('/api/tutorial/claim',{step:'bonusclear'},L.token);
  ok(pre&&pre.ok!==true&&/Finish this lesson first/.test(String(pre.error)),'server: the step cannot be claimed before Bonus 1-3 is cleared',pre);
  try{browser=await chromium.launch({args:['--mute-audio','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
  const ctx=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  const posts=[]; page.on('request',r=>{ if(/\/api\/tutorial\/bonus13$/.test(r.url())) posts.push(r.url()); });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  const STEPS=await page.evaluate(()=>TUTORIAL_STEPS.map(s=>s.id));
  ok(STEPS.length===15&&STEPS[14]==='bonusclear'&&await page.evaluate(()=>{ const g=TUTORIAL_GROUPS[TUTORIAL_GROUPS.length-1]; return g.ids.length===1&&g.ids[0]==='bonusclear'&&/1-3/.test(g.stage); }),'the list has 15 steps; the last is the Bonus 1-3 step in its own last group',STEPS);

  /* ---- A. an account that had finished the 14 steps ---- */
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; G.tutSkipped=false; G.tutRewarded={}; G.ftutSeen={}; G.ftutOff=false; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); await ledgerSync(); },L);
  await delay(500);
  await page.evaluate(()=>{ show('tutorial'); }); await delay(900);
  let a=await page.evaluate(()=>({done:G.tutDone,skipped:G.tutSkipped,started:G.tutStarted,rewarded:Object.keys(G.tutRewarded).filter(k=>G.tutRewarded[k]).length,txt:document.getElementById('tutorialBody').innerText,go:!!document.querySelector('[data-tut-go="bonusclear"]'),claim:!!document.querySelector('[data-tut-claim="bonusclear"]'),cards:document.querySelectorAll('#tutorialBody .qcard').length}));
  ok(a.done===false&&a.rewarded===14&&a.cards===1&&a.go&&!a.claim,'a finished account sees ONE open step (Go), its 14 earlier steps stay done',a);
  ok(/14 \/ 15 steps complete/.test(a.txt)&&/Clear Bonus Stage 1-3/.test(a.txt)&&/30 bonus Diamonds/.test(a.txt)&&/three roads/i.test(a.txt),'the card: 14 / 15, "Clear Bonus Stage 1-3", what to do, 30 bonus Diamonds',a.txt);
  ok(a.skipped===true&&a.started===false,'it is in own-pace mode: nothing points or pulls it back to Start Here',a);

  /* ---- B. a player at the step, guided ---- */
  await page.evaluate(()=>{ G.tutSkipped=false; G.tutStarted=true; G.tutFocusStep=null; show('tutorial'); }); await delay(600);
  const bar=()=>page.evaluate(()=>{ const b=document.getElementById('ftutBar'); if(!b||b.classList.contains('ftut-hold')) return null; const v=ewGameView(), r=b.querySelector('.ftut-box').ewGameRect();
    return {guide:b.dataset.guide,line:+b.dataset.line,speaker:b.dataset.speaker,text:b.querySelector('.ftut-text').textContent,inside:r.left>=-1&&r.top>=-1&&r.right<=v.width+1&&r.bottom<=v.height+1,img:!!b.querySelector('.ftut-img').getAttribute('src')}; });
  const seen=[]; let allInside=true, allText=true;
  /* read the talk that is showing to its end (Next ... Got it); returns its lines */
  const talk=async(guide,opts)=>{ opts=opts||{}; let b=null; for(let i=0;i<60&&!((b=await bar())&&b.guide===guide);i++) await delay(250);
    if(!b||b.guide!==guide){ ok(false,'the '+guide+' talk shows',b); return []; }
    if(process.env.TUTB13_SHOTS) await page.screenshot({path:path.join(process.env.TUTB13_SHOTS,'tutb13_'+guide+'.png')});
    const lines=[]; for(let n=0;n<8;n++){ b=await bar(); if(!b||b.guide!==guide) break; lines.push(b); seen.push(b.guide+'.'+b.line+':'+b.speaker); if(!b.inside) allInside=false; if(!b.text||/^ftut\./.test(b.text)) allText=false;
      if(opts.each) await opts.each(b); await page.locator('#ftutBar .ftut-next').click(); await delay(350); }
    return lines; };
  await page.locator('[data-tut-go="bonusclear"]').click(); await delay(1500);
  a=await page.evaluate(()=>({state,ch:campViewCh,focus:G.tutFocusStep,glow:!!document.querySelector('.cbonus[data-bonus-stage="1-3"].tut-target-glow')}));
  ok(a.state==='campaign'&&a.ch===1&&a.focus==='bonusclear'&&a.glow,'Go opens the campaign map on chapter 1 and the Bonus 1-3 building glows',a);
  let hl5=null; let ls=await talk('bonus',{each:async b=>{ if(b.line===5) hl5=await page.evaluate(()=>!!document.querySelector('.cbonus[data-bonus-stage="1-3"].ftut-hl')); }});
  ok(ls.length===5&&hl5===true,'the Bonus talk plays on the map (5 lines) and its last line lights the Bonus 1-3 building',[ls.length,hl5]);
  await page.locator('.cbonus[data-bonus-stage="1-3"]').click({force:true}); await page.locator('#gsplitPicker .gsplitHero').first().waitFor({timeout:30000}); await delay(600);
  ls=await talk('bonus13a'); ok(ls.length===1&&/squad/i.test(ls[0].text),'line-up screen: Vael on picking the squad',ls);
  ok(await page.evaluate(()=>{ highlightTutorialTarget(); return !!document.querySelector('#gsplitAuto.tut-target-glow'); }),'the BEST button glows');
  await page.locator('#gsplitAuto').click(); await delay(700);
  ok(await page.evaluate(()=>{ highlightTutorialTarget(); return !!document.querySelector('#gsplitNext.tut-target-glow'); }),'then NEXT glows');
  await page.locator('#gsplitNext').click(); await delay(700);
  ls=await talk('bonus13b'); ok(ls.length===2&&/road/i.test(ls[0].text)&&/two roads/i.test(ls[1].text),'roads screen: Sylthaine on the three roads, Vael on the goal',ls);
  ok(await page.evaluate(()=>{ highlightTutorialTarget(); return !!document.querySelector('#gsplitAutoPlace.tut-target-glow'); }),'AUTO glows');
  await page.locator('#gsplitAutoPlace').click(); await delay(700);
  ok(await page.evaluate(()=>{ highlightTutorialTarget(); return !!document.querySelector('#gsplitStart.tut-target-glow'); }),'then START glows');
  await page.locator('#gsplitStart').click();
  await page.waitForFunction(()=>typeof GSPLIT!=='undefined'&&GSPLIT.active&&state==='battle',null,{timeout:60000}); await delay(800);
  const held=await page.evaluate(async()=>{ const t0=GSPLIT.lanes.map(L=>L.battleTime||0).join(), d=!!(GSPLIT.coach&&GSPLIT.coach.dialog); for(let i=0;i<120;i++) gsplitStep(SIM_STEP); return {talkUp:d,frozen:GSPLIT.lanes.map(L=>L.battleTime||0).join()===t0}; });
  ls=await talk('bonus13c'); ok(ls.length===1&&/zoom/i.test(ls[0].text)&&held.talkUp&&held.frozen,'the run opens with Vireo on Zoom, and the fight is held while she speaks',[ls,held]);
  /* play on to the first firebreak */
  const toWindow=()=>page.evaluate(()=>{ paused=true; let n=0; while(!gsplitWindowOpen()&&GSPLIT.active&&!GSPLIT._finishing&&n<60000){ gsplitStep(SIM_STEP); n++; } gsplitWindowDraw(); return {open:gsplitWindowOpen(),phase:GSPLIT.window&&GSPLIT.window.phase,station:GSPLIT.window&&GSPLIT.window.station}; });
  a=await toWindow(); ok(a.open&&a.phase==='boon'&&a.station===0,'the first firebreak opens',a);
  ls=await talk('bonus13d'); ok(ls.length===1&&/boon/i.test(ls[0].text),'first firebreak: Sylthaine on choosing a boon',ls);
  await page.evaluate(()=>{ for(const L of GSPLIT.lanes){ if(L.state==='walking'&&L.offer) gsplitPickBoon(L.i,L.offer[0].id); } GSPLIT.window.phase='move'; GSPLIT.window.selectedHero=null; gsplitWindowDraw(); }); await delay(500);
  ls=await talk('bonus13e'); ok(ls.length===1&&/across/i.test(ls[0].text),'then Vex on sending a hero across',ls);
  await delay(600); ok(posts.length===1,'the talk is recorded as seen once (POST /api/tutorial/bonus13)',posts.length);
  /* finish the run: boons taken, nobody moved */
  await page.evaluate(()=>{ window.__fin=setInterval(()=>{ try{ if(!GSPLIT.active){ clearInterval(window.__fin); return; } for(let i=0;i<400&&GSPLIT.active&&!GSPLIT._finishing;i++){ if(gsplitWindowOpen()){ const W=GSPLIT.window; if(W.phase==='boon'){ for(const L of GSPLIT.lanes){ if(L.state==='walking'&&L.offer&&!W.picked[L.i]) gsplitPickBoon(L.i,L.offer[0].id); } W.phase='move'; } if(gsplitStartAllowed()) gsplitCloseWindow(); } gsplitStep(SIM_STEP); } }catch(e){ window.__finErr=String(e); } },30); });
  await page.locator('#gsplitResultOverlay').waitFor({timeout:240000});
  a=await page.evaluate(()=>({title:document.querySelector('#gsplitResultOverlay h2').textContent,err:window.__finErr||null,clear:G.bonus13Clear}));
  ok(/BONUS 1-3 CLEARED/.test(a.title)&&!a.err&&a.clear===1,'Bonus 1-3 is cleared and the page knows it',a);
  ok(await bar()===null,'the result talk waits for the Damage Done card');
  { const dd=page.locator('#ddPop .ddGo'); try{ await dd.waitFor({timeout:8000}); await dd.click(); }catch(_){} }
  let hlClaim=null; ls=await talk('bonus13f',{each:async b=>{ if(b.line===2) hlClaim=await page.evaluate(()=>!!document.querySelector('#gsplitResultOverlay button[data-claim-hourly].ftut-hl')); }});
  ok(ls.length===2&&/stars/i.test(ls[0].text)&&/every hour/i.test(ls[1].text)&&hlClaim===true,'result: Vael on stars, Vireo on the hourly fragments with the Claim button lit',[ls,hlClaim]);
  const want=['bonus.1:vireo','bonus.2:vael','bonus.3:vex','bonus.4:sylthaine','bonus.5:vael','bonus13a.1:vael','bonus13b.1:sylthaine','bonus13b.2:vael','bonus13c.1:vireo','bonus13d.1:sylthaine','bonus13e.1:vex','bonus13f.1:vael','bonus13f.2:vireo'];
  ok(JSON.stringify(seen)===JSON.stringify(want),'every line appeared once, in order, with its speaker ('+seen.length+' lines)',seen);
  ok(allInside&&allText,'every line was inside the screen at 844x390 and had its text');
  ok(await page.evaluate(()=>!!G.ftutSeen.bonus&&!!G.ftutSeen.bonus13f&&!document.getElementById('ftutBar')&&!document.querySelector('.ftut-hl')),'the talks are marked seen and the bar is gone');
  await page.locator('#gsplitResultOverlay button').last().click(); await delay(500);

  /* ---- C. the claim ---- */
  await page.evaluate(()=>{ show('tutorial'); }); await delay(900);
  a=await page.evaluate(()=>({claim:!!document.querySelector('[data-tut-claim="bonusclear"]'),gems:G.gems|0}));
  ok(a.claim,'the step is ready to claim',a);
  await page.locator('[data-tut-claim="bonusclear"]').click(); await delay(2500);
  const c=await page.evaluate(()=>({gems:G.gems|0,done:G.tutDone,txt:document.getElementById('tutorialBody').innerText,n:TUTORIAL_STEPS.filter(s=>G.tutRewarded[s.id]).length}));
  ok(c.gems-a.gems===30,'the claim pays 30 diamonds',[a.gems,c.gems]);
  ok(c.done===true&&c.n===15&&/15 \/ 15 steps complete/.test(c.txt),'15 / 15 and the tutorial is complete',c);
  const again=await J('/api/tutorial/claim',{step:'bonusclear'},await page.evaluate(()=>ACC.token));
  ok(again&&again.ok===true&&again.already===true,'server: a second claim answers already and pays nothing',again&&{ok:again.ok,already:again.already});
  /* a second Bonus 1-3 run has no talk */
  await page.evaluate(()=>{ show('campaign'); campViewCh=1; renderRoadmap(); openBonusModal(1,3); }); await page.locator('#gsplitPicker .gsplitHero').first().waitFor({timeout:30000}); await delay(1500);
  ok(await bar()===null,'opening Bonus 1-3 again plays no talk');
  ok(errs.length===0,'no page errors',errs.slice(0,3));
}catch(e){ fails++; console.log('  FAIL crashed: '+String(e&&e.stack||e).slice(0,700)); }
finally{ try{ if(browser) await browser.close(); }catch(e){} if(child) child.kill(); await delay(1200); try{ fs.rmSync(temp,{recursive:true,force:true}); }catch(e){}
  console.log('test_tutorial_bonus13_1442: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); process.exit(fails?1:0); }
})();
