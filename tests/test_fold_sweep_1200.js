// v1200 (Fold device sweep after the v1198 freeze, 18 Oct 2026, Phil: "simulate his device to find any other possible bugs").
// Two fixes, checked in the real page at the Galaxy Z Fold inner screen (841x632 css, dpr 2.625, Android Chrome UA, touch):
//  1. The World Map's message screens (below its level, locating, unavailable) had no way out: #world has no back button of its own.
//     Each now has a Base button; a /api/world/state reply that never comes turns into "unavailable" + Try again (the read timeout, 20 s).
//  2. A hero whose death clip had ended kept the freed death sheet on its sprite, and three re-uploaded the freed sheet each fight
//     ('texImage2D: Overload resolution failed' in the console, one per dead hero). The sprite now lets go of it.
//  3. REQUEST TIMEOUT (Phil: "add the request timeout everywhere"): a stalled server. Reads hung past 20 s - the Glyphs tab and the
//     stage popup leave their loading text for "could not be loaded" + Try again (the Glyphs tab used to re-request in a loop).
//     A write held past 45 s (the daily sign-in claim; the server books it, the reply comes too late): the page gives up, nothing is
//     re-sent by itself, the player taps again and the server answers from its receipt - the reward is paid ONCE.
// CONTROL: SWEEP_ROOT=<a pre-v1200 checkout> must FAIL.
const assert=require('assert');
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const {chromium}=require('playwright');
const root=process.env.SWEEP_ROOT?path.resolve(process.env.SWEEP_ROOT):path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-fold-sweep-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
const UA='Mozilla/5.0 (Linux; Android 14; SM-F946B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ✓ '+msg); else { fails++; console.log('  ✗ '+msg); } };
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',PORT:String(port),DB_FILE:path.join(temp,'db.json')},stdio:'ignore',windowsHide:true});
  let ready=false; for(let i=0;i<200;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch(_){}await delay(100);}
  assert(ready,'throwaway server did not start');
  try{browser=await chromium.launch({args:['--mute-audio']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
  console.log('fold sweep (v1200) root='+root);
  const open=async(tag,hangWorld,routes)=>{
    const deviceId='fold-sweep-'+tag+'-'+Date.now();
    const guest=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,roster:{__save:'{}'}})})).json();
    assert(guest.token,'throwaway guest');
    const ctx=await browser.newContext({viewport:{width:841,height:632},deviceScaleFactor:2.625,isMobile:true,hasTouch:true,userAgent:UA,serviceWorkers:'block'});
    if(hangWorld) await ctx.route('**/api/world/state*',()=>{ /* never answered */ });
    for(const [glob,fn] of (routes||[])) await ctx.route(glob,fn);
    const page=await ctx.newPage(); page._errs=[];
    page.on('pageerror',e=>page._errs.push(e.message));
    await page.addInitScript(([id,tok,gid,nm])=>{ localStorage.setItem('ew_device',id); localStorage.setItem('ew_acc',JSON.stringify({token:tok,id:gid,name:nm,guest:true})); localStorage.setItem('ew_guest_step_'+gid,'1');
      window.__texFail=0; for(const C of [self.WebGL2RenderingContext,self.WebGLRenderingContext]){ if(!C) continue; const o=C.prototype.texImage2D; C.prototype.texImage2D=function(){ try{ return o.apply(this,arguments); }catch(e){ window.__texFail++; throw e; } }; }
      try{ const AC=window.AudioContext||window.webkitAudioContext; if(AC){ const g=AC.prototype.createGain; AC.prototype.createGain=function(){ const n=g.call(this); try{ n.gain.value=0; }catch(e){} return n; }; } }catch(e){} },
      [deviceId,guest.token,guest.profile.id,guest.profile.name]);
    await page.goto(base+'/play',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
    await page.evaluate(()=>{const p=document.querySelector('.splashPlay');if(p)p.click();});
    await page.waitForFunction(()=>ACC.token&&_cloudReady,null,{timeout:20000}); await page.waitForTimeout(400);
    await page.evaluate(()=>{ try{ skipTutorialGuide(); }catch(e){} }); await page.waitForTimeout(700);
    return {page,ctx}; };
  const backOnScreen=page=>page.evaluate(()=>{ const w=document.getElementById('world'); const b=[...w.querySelectorAll('button')].find(x=>/Base/.test(x.textContent)&&x.getClientRects().length);
    if(!b) return null; const r=b.getBoundingClientRect(); return (r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight)?b.id||'base':null; });

  /* 1a. a level-1 player opens the World Map (the City Wall's World button): the "opens at level 20" message has a way back */
  { console.log('-- World Map below its level');
    const {page,ctx}=await open('world');
    await page.evaluate(()=>show('wall')); await page.waitForTimeout(300);
    await page.evaluate(()=>{ const b=document.querySelector('#wall>[data-nav="world"]'); b.click(); });
    await page.waitForFunction(()=>/opens at level|unavailable/.test((document.getElementById('worldBody')||{}).textContent||''),null,{timeout:15000}).catch(()=>{});
    const txt=await page.evaluate(()=>document.getElementById('worldBody').textContent);
    ok(/opens at level 20/.test(txt),'the World Map says it opens at level 20 ('+txt.trim().slice(0,60)+')');
    ok(!!(await backOnScreen(page)),'that message has a Base button on screen');
    await page.evaluate(()=>{ const b=[...document.querySelectorAll('#world button')].find(x=>/Base/.test(x.textContent)); if(b) b.click(); }); await page.waitForTimeout(400);
    ok(await page.evaluate(()=>state==='home'&&document.getElementById('home').classList.contains('active')),'Base takes the player back to the town');
    ok(page._errs.length===0,'no page errors ('+page._errs.slice(0,2).join(' | ')+')');
    await ctx.close(); }
  /* 1b. the world reply never comes (a stalled connection): after 15 s the screen says so, with Try again and Base */
  { console.log('-- World Map reply never arrives');
    const {page,ctx}=await open('hang',true);
    await page.evaluate(()=>show('world')); await page.waitForTimeout(500);
    ok(!!(await backOnScreen(page)),'while locating the castle there is already a Base button');
    await page.waitForTimeout(22000);
    const txt=await page.evaluate(()=>document.getElementById('worldBody').textContent);
    ok(/unavailable/.test(txt),'after the 20 s read timeout the screen says the castle location is unavailable ('+txt.trim().slice(0,50)+')');
    ok(await page.evaluate(()=>!!document.getElementById('worldRetry')),'and offers Try again');
    ok(!!(await backOnScreen(page)),'and a Base button on screen');
    await ctx.close(); }
  /* 3a. stalled reads: the Glyphs tab and the stage popup */
  { console.log('-- stalled reads (Glyphs tab, stage popup)');
    let gl=0; const {page,ctx}=await open('reads',false,[['**/api/glyphs/state*',()=>{ gl++; }],['**/api/campaign/stage*',()=>{}]]);
    await page.evaluate(()=>{ RUNE2.enabled=null; RUNE2.st=null; detailHero='vael'; heroTab='glyphs'; popoutScreen('heroDetail'); }); await page.waitForTimeout(800);
    const t0=await page.evaluate(()=>document.getElementById('heroDetailBody').textContent);
    ok(/Loading glyphs/.test(t0),'the Glyphs tab starts on its loading text');
    await page.waitForTimeout(22000);
    const t1=await page.evaluate(()=>document.getElementById('heroDetailBody').textContent);
    ok(/could not be loaded/i.test(t1)&&/Try again/.test(t1),'after the 20 s read timeout it says the glyphs could not be loaded, with Try again');
    ok(gl<=2,'it did not keep re-asking the stalled server ('+gl+' glyph-state requests in 23 s)');
    await page.evaluate(()=>{ closePopout(); show('campaign'); openStageModal(1,'normal'); }); await page.waitForTimeout(500);
    const s0=await page.evaluate(()=>(document.getElementById('smDetails')||{}).textContent||'');
    ok(/Loading stage details/.test(s0),'the stage popup starts on "Loading stage details"');
    await page.waitForTimeout(22000);
    const s1=await page.evaluate(()=>(document.getElementById('smDetails')||{}).textContent||'');
    ok(/could not be loaded/i.test(s1)&&!!(await page.evaluate(()=>document.getElementById('smDetRetry'))),'after the read timeout it says the stage details could not be loaded, with Try again');
    ok(page._errs.length===0,'no page errors ('+page._errs.slice(0,2).join(' | ')+')');
    await ctx.close(); }
  /* 3b. a write the server books but answers too late (held 50 s > the 45 s write timeout): paid once */
  { console.log('-- slow write: the daily sign-in claim answered after 50 s');
    let held=0, sent=0;
    const slow=async route=>{ sent++; const resp=await route.fetch(); if(held++===0){ await delay(50000); } try{ await route.fulfill({response:resp}); }catch(e){} };
    const {page,ctx}=await open('write',false,[['**/api/signin/claim*',slow]]);
    const tok=await page.evaluate(()=>ACC.token);
    const led=async()=>{ const j=await (await fetch(base+'/api/ledger',{headers:{'x-token':tok}})).json(); return j; };
    const money=j=>{ const o={}; const walk=(x,pre)=>{ if(!x||typeof x!=='object') return; for(const k in x){ const v=x[k]; if(typeof v==='number') o[pre+k]=v; else if(v&&typeof v==='object'&&!Array.isArray(v)&&pre.split('.').length<3) walk(v,pre+k+'.'); } }; walk(j,''); return o; };
    const L0=money(await led());
    await page.evaluate(()=>{ show('home'); popoutScreen('signin'); }); await page.waitForTimeout(500);
    await page.evaluate(()=>signinClaimToday());
    await page.waitForTimeout(47000);
    const busyAfter=await page.evaluate(()=>_signinBusy);
    ok(busyAfter===false,'past the 45 s write timeout the claim has given up (not still waiting)');
    ok(sent===1,'nothing was re-sent by itself ('+sent+' claim request(s))');
    await page.waitForTimeout(4000);
    const L1=money(await led());
    const d1=Object.keys(L1).filter(k=>L1[k]!==L0[k]);
    ok(d1.length>0,'the server did book the first claim ('+d1.slice(0,4).join(', ')+')');
    await page.evaluate(()=>signinClaimToday()); await page.waitForTimeout(3000);
    const L2=money(await led());
    const d2=Object.keys(L2).filter(k=>L2[k]!==L1[k]&&!/time|At$|rev|seq|ts$|updated/i.test(k));
    ok(d2.length===0,'the second tap is answered from the receipt: no second payment ('+(d2.map(k=>k+' '+L1[k]+'->'+L2[k]).slice(0,4).join(', ')||'none')+')');
    ok(await page.evaluate(()=>!_signinBusy),'the page is free again');
    await ctx.close(); }
  /* 2. two campaign fights in a row where heroes die with their death clip: no freed death sheet left on a sprite, no failed upload */
  { console.log('-- dead heroes keep no freed death sheet (two fights)');
    const {page,ctx}=await open('death');
    let died=0;
    for(let b=1;b<=2;b++){
      await page.evaluate(()=>{ G.stamina=Math.max(G.stamina||0,60); show('campaign'); openStageModal(1,'normal'); }); await page.waitForTimeout(400);
      await page.locator('#smBattle').click(); await page.waitForTimeout(600);
      await page.evaluate(()=>{ const s=document.getElementById('startBtn'); if(s) s.click(); });
      for(let i=0;i<160;i++){ if(await page.evaluate(()=>state==='battle'&&units.length>0)) break; await page.waitForTimeout(250); }
      /* two allies start the fight at 12% health (display test only - the result is not what this checks): under 30% their death sheet
         loads, the enemy finishes them, and each death clip plays to its end (6 s) */
      await page.evaluate(()=>{ units.filter(u=>u.team==='ally'&&!u.summoned).slice(0,2).forEach(u=>{ u.hp=Math.max(1,Math.round(u.maxHp*0.12)); }); });
      let t0=Date.now(); while(Date.now()-t0<60000){ const n=await page.evaluate(()=>units.concat(_corpses||[]).filter(u=>u.team==='ally'&&u._die&&u._die.end).length); if(n>=2) break; if(await page.evaluate(()=>state!=='battle')) break; await page.waitForTimeout(1000); }
      await page.waitForTimeout(1500);
      const s=await page.evaluate(()=>{ let stale=0, dead=0; units.concat(_corpses||[]).forEach(u=>{ if(u.team==='ally'&&u._die&&u._die.end) dead++; });
        try{ scene.traverse(o=>{ const m=o.material; if(o.isSprite&&m&&m.map&&(m.map._ewFreed||(m.map.image&&m.map.image._freed&&m.map._ewFreed))) stale++; }); }catch(e){} return { stale, dead, fail:window.__texFail }; });
      died+=s.dead;
      ok(s.stale===0,'fight '+b+': no sprite still holds a freed death sheet ('+s.stale+', '+s.dead+' ended deaths)');
      ok(s.fail===0,'fight '+b+': no failed texture upload so far ('+s.fail+')');
      await page.evaluate(()=>{ if(state==='battle'&&!ended) endBattle(false); }); for(let i=0;i<40;i++){ if(await page.evaluate(()=>state==='result')) break; await page.waitForTimeout(250); }
      await page.evaluate(()=>{ const r=document.getElementById('resultBtn'); if(r) r.click(); }); await page.waitForTimeout(900);
    }
    ok(died>=2,'deaths really played to their end in these fights ('+died+')');
    await ctx.close(); }
  console.log(`fold sweep 1200: ${checks-fails}/${checks} checks passed, ${fails} failed`);
  if(fails) process.exitCode=1;
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ if(browser)await browser.close().catch(()=>{}); if(child)child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
