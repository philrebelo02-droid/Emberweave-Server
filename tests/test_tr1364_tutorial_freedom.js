// v1368 (Phil 11 Nov: "yes make the tutorial freedom but make the glowing lights on where to go, more exxagerated"; Claude: drop the home->tutorial
// redirect, the tutorial keeps its place and its Start Here entry, a much bigger glow - stronger pulse, larger halo, an arrow - in town and in screens).
// A fresh account mid-tutorial on a throwaway server at 844x390, 882x344 and 1440x800, real clicks. Grok.
// CONTROL: EW_ROOT=<HEAD copy> must FAIL. SHOTS=<dir> writes screenshots, OUT=<file> the measurements.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1368t-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
async function server(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(const _t0=Date.now();Date.now()-_t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}   /* 11 Nov: a 60 s deadline, not an iteration count */throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  return {base}; }
async function account(base){ const r=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'tu'+Date.now().toString(36)+Math.floor(Math.random()*1e4),pass:'password1'})})).json(); return {token:r.token,id:r.profile.id}; }
async function openPage(base,L,w,h){ const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  // mid-tutorial: started, nothing claimed yet, no lesson chosen
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); G.tutStarted=true; G.tutDone=false; G.tutSkipped=false; G.tutRewarded={}; G.tutFocusStep=null; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); },L);
  return {ctx,page,errs}; }
const fx=page=>page.evaluate(()=>{ const f=document.getElementById('tutFx'); if(!f||getComputedStyle(f).display==='none'||getComputedStyle(f).visibility==='hidden') return null; const R=e=>{ const r=e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; };
  const a=f.querySelector('.tfArrow'), hl=f.querySelector('.tfHalo'); const ac=R(a); const top=document.elementFromPoint(ac.x+ac.w/2,ac.y+ac.h/2);
  return {arrow:ac, up:a.classList.contains('up'), halo:R(hl), tapThrough:!(top&&f.contains(top))}; });
const glowOf=(page,cls)=>page.evaluate(cls=>{ const e=document.querySelector('.'+cls); if(!e) return null; const r=e.getBoundingClientRect(); return {id:e.id, nav:e.dataset&&e.dataset.nav, cls:e.className.toString().slice(0,60), r:{x:r.left,y:r.top,w:r.width,h:r.height}, prev:(e.previousElementSibling&&e.previousElementSibling.classList.contains('hot'))?(()=>{ const q=e.previousElementSibling.getBoundingClientRect(); return {x:q.left,y:q.top,w:q.width,h:q.height}; })():null}; },cls);
const inside=(p,r)=>p.x>=r.x-1&&p.x<=r.x+r.w+1&&p.y>=r.y-1&&p.y<=r.y+r.h+1;
(async()=>{ const SHOTS=process.env.SHOTS, OUT=process.env.OUT, R=[]; if(SHOTS) fs.mkdirSync(SHOTS,{recursive:true}); try{
  const {base}=await server();
  for(const [w,h,n] of [[844,390,'phone'],[882,344,'Fold cover'],[1440,800,'PC']]){
    console.log('-- '+n+' '+w+'x'+h); const tag=n.replace(/ /g,'_'); const M={size:n};
    const L=await account(base); const {ctx,page,errs}=await openPage(base,L,w,h);
    // 1 Base from Start Here goes to town
    await page.evaluate(()=>show('tutorial')); await delay(900);
    const before=await page.evaluate(()=>document.getElementById('tutorialBody').innerText.replace(/\s+/g,' ').slice(0,200));
    await page.evaluate(()=>document.querySelector('#tutorial .backbtn[data-nav="home"]').click()); await delay(1500);
    M.afterBase=await page.evaluate(()=>state);
    ok(M.afterBase==='home', n+': Base on Start Here goes to town (now: '+M.afterBase+')');
    // 2 in town: the Campaign building is pointed at
    await delay(800); const tg=await glowOf(page,'tut-town-glow'), f=await fx(page); M.town={tg,f};
    if(SHOTS) await page.screenshot({path:path.join(SHOTS,tag+'_1_town.png')});
    ok(!!tg&&tg.nav==='campaign', n+': in town the next place to go glows - the Campaign plate ('+(tg?(tg.nav||tg.id):'nothing')+')');
    ok(!!f&&!!tg&&tg.prev&&inside({x:tg.prev.x+tg.prev.w/2,y:tg.prev.y+tg.prev.h/2},f.halo)&&f.halo.w>=tg.prev.w+20, n+': a halo rings the Campaign building ('+(f?Math.round(f.halo.w)+'x'+Math.round(f.halo.h):'none')+(tg&&tg.prev?' around '+Math.round(tg.prev.w)+'x'+Math.round(tg.prev.h):'')+')');
    const tip=f&&tg?(f.up?{x:f.arrow.x+f.arrow.w/2,y:f.arrow.y}:{x:f.arrow.x+f.arrow.w/2,y:f.arrow.y+f.arrow.h}):null;
    ok(!!tip&&f.arrow.h>=40&&Math.abs(tip.x-(tg.r.x+tg.r.w/2))<=4&&(f.up?Math.abs(tip.y-(tg.r.y+tg.r.h))<=24:Math.abs(tip.y-tg.r.y)<=24), n+': a big arrow ('+(f?Math.round(f.arrow.w)+'x'+Math.round(f.arrow.h):'none')+') points at the plate');
    ok(!!f&&f.tapThrough, n+': the halo and arrow do not take taps');
    // 3 the plate itself opens Campaign; inside, the stage glows with the halo + arrow
    if(tg){ await page.mouse.click(tg.r.x+tg.r.w/2,tg.r.y+tg.r.h/2); await delay(1800); }
    M.camp=await page.evaluate(()=>state); const tg2=await glowOf(page,'tut-target-glow'), f2=await fx(page); M.inCamp={tg2,f2};
    if(SHOTS) await page.screenshot({path:path.join(SHOTS,tag+'_2_campaign.png')});
    ok(M.camp==='campaign'&&!!tg2&&!!f2&&inside({x:tg2.r.x+tg2.r.w/2,y:tg2.r.y+tg2.r.h/2},f2.halo), n+': inside Campaign the stage to play glows with the halo and arrow ('+(tg2?tg2.cls:'nothing')+')');
    // 4 the tutorial kept its place
    await page.evaluate(()=>show('tutorial')); await delay(900); const after=await page.evaluate(()=>document.getElementById('tutorialBody').innerText.replace(/\s+/g,' ').slice(0,200));
    const entry=await page.evaluate(()=>!!document.querySelector('#hubMenu .mitem[data-nav="tutorial"]'));
    ok(after===before&&entry, n+': Start Here kept its place and its menu entry');
    // 5 a quest lesson: MENU glows, then the Quests entry
    await page.evaluate(()=>{ G.tutRewarded={win11:true}; G.tutFocusStep=null; show('home'); }); await delay(1500);
    const m1=await glowOf(page,'tut-town-glow'); if(SHOTS) await page.screenshot({path:path.join(SHOTS,tag+'_3_menu.png')});
    await page.evaluate(()=>document.getElementById('menuBtn').click()); await delay(900);
    const m2=await glowOf(page,'tut-town-glow'), f3=await fx(page); if(SHOTS) await page.screenshot({path:path.join(SHOTS,tag+'_4_menu_open.png')});
    M.menu={m1,m2};
    ok(!!m1&&m1.id==='menuBtn'&&!!m2&&m2.nav==='quest'&&!!f3, n+': a quest lesson lights MENU ('+(m1?m1.id||m1.nav:'-')+'), then the Quests entry ('+(m2?m2.nav||m2.id:'-')+')');
    ok(errs.length===0, n+': no page errors ('+errs.length+(errs.length?': '+errs[0]:'')+')');
    R.push(M); await ctx.close(); }
  if(OUT) fs.writeFileSync(OUT,JSON.stringify(R,null,1));
}catch(e){ console.error('  FAIL (crashed)',e); fails++; } finally{ console.log('test_tr1364_tutorial_freedom.js: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
