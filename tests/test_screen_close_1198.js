// v1198 (tester report 18 Oct 2026, Galaxy Z Fold, Brave): the game "froze" leaving Vael's skills and his glyphs during the guided
// tutorial - a black page, music still on, only Android Back answered. Cause: the tutorial opens Heroes as the FULL screen; the hero
// window's "Back" popped Heroes out as a pop-out of itself, and closing that pop-out (X or the dark backdrop) took the screen's
// 'active' away - no screen was left showing. Not Fold-only: every device, every build back to at least v1140.
// This test plays the reported paths in the real page at the Fold's inner (landscape + portrait) and cover screen sizes and checks a
// screen is always left up and answering taps; then makes a screen's render and a close step THROW and checks the same.
// CONTROL: FOLD_ROOT=<a pre-v1198 checkout> must FAIL (the black page).
const assert=require('assert');
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const {chromium}=require('playwright');
const root=process.env.FOLD_ROOT?path.resolve(process.env.FOLD_ROOT):path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-screen-close-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
const SIZES=[ {name:'fold-inner-landscape',w:840,h:690,dpr:2.6}, {name:'fold-inner-portrait',w:690,h:840,dpr:2.6}, {name:'fold-cover',w:344,h:882,dpr:2.6} ];
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ✓ '+msg); else { fails++; console.log('  ✗ '+msg); } };
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',PORT:String(port),DB_FILE:path.join(temp,'db.json')},stdio:'ignore',windowsHide:true});
  let ready=false; for(let i=0;i<200;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch(_){}await delay(100);}
  assert(ready,'throwaway server did not start');
  try{browser=await chromium.launch({args:['--mute-audio']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
  console.log('screen close (v1198) root='+root);
  const openPage=async(sz,tag)=>{
    const deviceId='screen-close-'+tag+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    const guest=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,roster:{__save:'{}'}})})).json();
    assert(guest.token,'throwaway guest');
    const ctx=await browser.newContext({viewport:{width:sz.w,height:sz.h},deviceScaleFactor:sz.dpr,isMobile:true,hasTouch:true});
    const page=await ctx.newPage(); page._errs=[];
    page.on('pageerror',e=>page._errs.push(e.message));
    await page.addInitScript(([id,tok,gid,nm])=>{ localStorage.setItem('ew_device',id); localStorage.setItem('ew_acc',JSON.stringify({token:tok,id:gid,name:nm,guest:true})); localStorage.setItem('ew_guest_step_'+gid,'1');
      try{ const AC=window.AudioContext||window.webkitAudioContext; if(AC){ const g=AC.prototype.createGain; AC.prototype.createGain=function(){ const n=g.call(this); try{ n.gain.value=0; }catch(e){} return n; }; } }catch(e){} },
      [deviceId,guest.token,guest.profile.id,guest.profile.name]);
    await page.goto(base+'/play',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1200);
    await page.evaluate(()=>{const p=document.querySelector('.splashPlay');if(p)p.click();});
    await page.waitForFunction(()=>ACC.token&&_cloudReady,null,{timeout:20000});
    await page.waitForTimeout(500);
    if(await page.locator('#tutStart').count()){ await page.locator('#tutStart').click(); await page.waitForTimeout(300); }
    // Download-step coverage has its own real cache/browser test. Exercise the
    // existing skill/glyph lessons here using the supported play-while-loading path.
    await page.evaluate(()=>{ window._firstDownloadDeferred=true; if(state==='tutorial')renderTutorial(); });
    return {page,ctx};
  };
  /* one screen showing, filling the view, and a tap at its middle lands inside it; the mute button answers its own tap */
  const alive=async(page,label)=>{ await page.waitForTimeout(250);
    const s=await page.evaluate(()=>{ const act=[...document.querySelectorAll('.screen.active')].filter(e=>{ const r=e.getBoundingClientRect(); return r.width>50&&r.height>50&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'; });
      const mid=document.elementFromPoint(innerWidth/2,innerHeight/2), m=document.getElementById('muteBtn');
      let muteTop=null; if(m&&m.getClientRects().length){ const r=m.getBoundingClientRect(); const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); muteTop=!!(t&&(t===m||m.contains(t))); }
      const bd=document.getElementById('popoutBackdrop');
      return { state, popout:_popout, active:act.map(e=>e.id), midIn:!!(mid&&act.some(e=>e.contains(mid)||mid.contains(e)))||!!(mid&&bd&&mid===bd), muteTop }; });
    ok(s.active.length>0, label+': a screen is showing ('+(s.active.join(',')||'NONE')+', state '+s.state+')');
    ok(s.midIn, label+': a tap in the middle of the page reaches that screen');
    ok(s.muteTop!==false, label+': the mute button takes its own tap');
    return s; };
  const backToTown=async(page,label)=>{ // the screen's own way out still works (in the tutorial the town hands over to Start Here)
    const r=await page.evaluate(()=>{ const scr=document.querySelector('.screen.active:not(.popout)'); const b=scr&&[...scr.querySelectorAll('.backbtn')].find(x=>x.getClientRects().length); if(!b) return 'no back button'; b.click(); return 'ok'; });
    await page.waitForTimeout(300);
    const st=await page.evaluate(()=>({state, act:[...document.querySelectorAll('.screen.active')].map(e=>e.id)}));
    ok(r==='ok'&&(st.state==='tutorial'||st.state==='home')&&st.act.length>0, label+': its back button leads on ('+r+' -> '+st.state+')'); };

  for(const sz of SIZES){
    console.log('-- '+sz.name+' '+sz.w+'x'+sz.h);
    /* 1. the reported path: Start Here -> "Spend your first skill point" Go -> Vael -> Skills -> upgrade -> Back -> X */
    { const {page,ctx}=await openPage(sz,'skill');
      await page.evaluate(()=>{ G.tutRewarded=Object.assign(G.tutRewarded||{},{win11:true,quest11:true}); renderTutorial(); });
      await page.locator('[data-tut-go="skill"]').click(); await page.waitForTimeout(400);
      await page.locator('#heroesPanel .hero-card[data-hero-key="vael"]').click(); await page.waitForTimeout(600);
      await page.locator('#heroDetail [data-tab="skills"]').click(); await page.waitForTimeout(600);
      const up=page.locator('#heroDetail [data-skillup]:not([disabled])').first();
      if(await up.count()){ await up.click(); await page.waitForTimeout(1200); }
      /* (a level-1 hero cannot raise a skill - the fixture has not played 1-1; the freeze is on the way OUT, which is what this checks) */
      ok(await page.locator('#heroDetail [data-skillup]').count()>0, 'the Skills tab shows its upgrade buttons');
      await page.locator('#heroDetail .backbtn').click(); await page.waitForTimeout(400);
      await alive(page,'skills -> Back');
      const x=page.locator('.popoutClose:visible').first(); if(await x.count()){ await x.click(); await page.waitForTimeout(300); }
      await alive(page,'skills -> Back -> X');
      await backToTown(page,'skills -> Back -> X');
      ok(page._errs.length===0,'no page errors ('+page._errs.slice(0,3).join(' | ')+')');
      await ctx.close(); }
    /* 2. glyphs: "Build Vael's first glyph" Go -> Vael -> Glyphs -> Back -> tap the dark backdrop */
    { const {page,ctx}=await openPage(sz,'rune');
      await page.evaluate(()=>{ G.tutRewarded=Object.assign(G.tutRewarded||{},{win11:true,quest11:true,skill:true,win12:true,quest12:true}); renderTutorial(); });
      await page.locator('[data-tut-go="rune"]').click(); await page.waitForTimeout(400);
      await page.locator('#heroesPanel .hero-card[data-hero-key="vael"]').click(); await page.waitForTimeout(600);
      await page.locator('#heroDetail [data-tab="glyphs"]').click(); await page.waitForTimeout(800);
      await page.locator('#heroDetail .backbtn').click(); await page.waitForTimeout(400);
      await alive(page,'glyphs -> Back');
      await page.evaluate(()=>{ const bd=document.getElementById('popoutBackdrop'); if(bd&&bd.style.display==='block') bd.click(); });
      await alive(page,'glyphs -> Back -> backdrop');
      /* the hero window's own X straight from the glyphs tab */
      await page.locator('#heroesPanel .hero-card[data-hero-key="vael"]').click(); await page.waitForTimeout(500);
      await page.locator('#heroDetail [data-tab="glyphs"]').click(); await page.waitForTimeout(400);
      await page.locator('#heroDetail .popoutClose').click(); await page.waitForTimeout(300);
      const s=await alive(page,'glyphs -> X');
      ok(s.active.includes('heroesPanel'),'glyphs -> X: back on the Heroes screen');
      ok(page._errs.length===0,'no page errors ('+page._errs.slice(0,3).join(' | ')+')');
      await ctx.close(); }
  }
  /* 3. errors on the way: a screen's render throws, a close step throws - a screen is still left up */
  { console.log('-- errors on close / screen change (fold inner)');
    const {page,ctx}=await openPage(SIZES[0],'err');
    await page.evaluate(()=>{ G.tutRewarded=Object.assign(G.tutRewarded||{},{win11:true,quest11:true}); renderTutorial(); });
    await page.locator('[data-tut-go="skill"]').click(); await page.waitForTimeout(400);
    await page.locator('#heroesPanel .hero-card[data-hero-key="vael"]').click(); await page.waitForTimeout(500);
    await page.evaluate(()=>{ window.__rhl=renderHeroList; renderHeroList=function(){ throw new Error('test: hero list render failed'); }; });
    await page.locator('#heroDetail .backbtn').click().catch(()=>{}); await page.waitForTimeout(300);
    await alive(page,'Back while the Heroes render throws');
    await page.evaluate(()=>{ renderHeroList=window.__rhl; });
    await page.evaluate(()=>{ window.__stage=window.EmberSkillStage; window.EmberSkillStage={stop(){ throw new Error('test: preview stop failed'); }}; try{ popoutScreen('bag'); }catch(e){} try{ closePopout(); }catch(e){} window.EmberSkillStage=window.__stage; });
    await alive(page,'close while a close step throws');
    await page.evaluate(()=>{ window.__rq=renderQuests; renderQuests=function(){ throw new Error('test: quests render failed'); }; try{ show('quest'); }catch(e){} renderQuests=window.__rq; });
    await alive(page,'screen change while its render throws');
    await page.evaluate(()=>{ window.__fit=_fitApp; _fitApp=function(){ throw new Error('test: fit failed'); }; try{ show('bag'); }catch(e){} _fitApp=window.__fit; });
    await alive(page,'screen change while the layout step throws');
    await ctx.close(); }
  console.log(`screen close 1198: ${checks-fails}/${checks} checks passed, ${fails} failed`);
  if(fails) process.exitCode=1;
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ if(browser)await browser.close().catch(()=>{}); if(child)child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
