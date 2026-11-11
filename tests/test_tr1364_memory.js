// v1365 (tester B 1.1, phone crash after 30-40 min; Claude's diagnosis 11 Nov, section 3): two real Stage 1-1 fights, each quit early (before Vireo and
// Sylthaine run in), at 844x390, 882x344 and 1440x800, each in a fresh page (its own art tier). On the PHONE art tier the battle textures must be gone on the
// campaign map after the fight (they stayed loaded); on every tier the benched 1-1 meshes must leave the scene with the fight and the scene must not grow
// fight to fight; the second fight must reload its art and run. Grok. Real page on a throwaway server.
// CONTROL: EW_ROOT=<HEAD f2cef637 copy> must FAIL. OUT=<file> also writes the measurements as JSON.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1365m-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
async function server(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({args:['--mute-audio','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
  return {base,L}; }
async function openPage(base,L,w,h){ const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:+(process.env.DSF||1),serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e))); const cons=[]; page.on('console',m=>{ if(m.type()==='error'||/WebGL|GL_|texture/i.test(m.text())) cons.push(m.type()+': '+m.text().slice(0,160)); });
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){}
    window._lt=[]; try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) window._lt.push([e.startTime,e.duration]); }).observe({entryTypes:['longtask']}); }catch(e){}
  });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await page.evaluate(()=>show('home')); await delay(2500); return {ctx,page,errs,cons}; }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
const mem=page=>page.evaluate(()=>{ let mb=0, n=0, big=0; for(const t of _texReg){ const im=t&&t.image; if(im&&im.width){ n++; mb+=im.width*im.height*4*(t.generateMipmaps?4/3:1); if(Math.max(im.width,im.height)>2048) big++; } }
  return {texMB:+(mb/1048576).toFixed(1), tally:+(+texTallyMB()).toFixed(1), tex:n, big, scene:scene.children.length, heap:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null, state}; });
/* one real Stage 1-1 fight from the stage card, quit after `secs` s of fight; returns what was measured */
async function fight(page,secs){ await page.evaluate(()=>{ show('campaign'); openStageModal(1,'normal'); });
  await page.waitForFunction(()=>{ const b=document.getElementById('smBattle'); return b&&!b.disabled&&b.offsetParent; },null,{timeout:20000});
  const t0=Date.now(); await page.evaluate(()=>document.getElementById('smBattle').click());
  await page.waitForFunction(()=>state==='menu',null,{timeout:20000}); await delay(600);
  const warm=await mem(page);   /* the pre-fight squad screen: the stage card's art warm-up must still be there */
  await page.evaluate(()=>document.getElementById('startBtn').click());
  try{ await page.waitForFunction(()=>state==='battle'&&typeof CUR!=='undefined'&&CUR&&CUR._intro&&units.length>0&&battleTime>0.3,null,{timeout:60000}); }
  catch(e){ const d=await page.evaluate(()=>({state, mode:CUR&&CUR.mode, node:CUR&&CUR.node, intro:!!(CUR&&CUR._intro), units:units.map(u=>u.key+':'+u.team).join(','), team:(G.team||[]).join(','), squad:(typeof squadFor==='function'?squadFor('campaign'):[]).join(','), bt:battleTime, ended, paused, loading:typeof _blLoading!=='undefined'?_blLoading:null,
      modals:[...document.querySelectorAll('.modal.active,.overlay.active,[class*=Modal].active')].map(m=>m.id||m.className).join(','), banner:(document.getElementById('battleBanner')||{}).textContent||'' })).catch(x=>String(x));
    throw new Error('fight did not start: '+JSON.stringify(d)); }
  const start=Date.now()-t0;
  /* the fight's own art is up: every unit on the field has its idle sheet decoded */
  await page.waitForFunction(()=>units.every(u=>{ const A=u.anim&&(u.anim.idle||u.anim.walk); return !A||(A.tex&&A.tex.image&&A.tex.image.width>0); }),null,{timeout:30000}).catch(()=>{});
  const artMs=Date.now()-t0;
  await delay(secs*1000);
  const inFight=await mem(page);
  const pre=await page.evaluate(()=>{ const I=CUR._intro; window._benchMeshes=[I.vireo&&I.vireo.mesh,I.syl&&I.syl.mesh].filter(Boolean);
    return {benched:window._benchMeshes.length, inUnits:[I.vireo,I.syl].filter(u=>units.indexOf(u)>=0).length, team:(G.team||[]).join(',')}; });
  await page.evaluate(()=>{ document.getElementById('exitBtn').onclick(); });
  await delay(2500);
  const after=await mem(page);
  const bench=await page.evaluate(()=>window._benchMeshes.filter(m=>m.parent===scene||scene.children.indexOf(m)>=0).length);
  return {start,artMs,warm,inFight,pre,after,benchLeft:bench}; }
(async()=>{ const OUT=[]; try{
  const {base,L}=await server();
  console.log('Memory between fights, root='+ROOT);
  for(const [w,h,n] of [[844,390,'phone'],[882,344,'Fold cover'],[1440,800,'PC']]){
    const {ctx,page,errs,cons}=await openPage(base,L,w,h);
    const tier=await page.evaluate(()=>ART_TIER);
    await page.evaluate(()=>show('campaign')); await delay(2000); const map0=await mem(page);
    const f1=await fight(page,3), f2=await fight(page,3);
    await page.evaluate(()=>show('heroesPanel')); await delay(1500); const menu=await mem(page);
    OUT.push({size:n,w,h,tier,map0,f1,f2,menu,console:cons});
    const S=m=>m.texMB+' MB in '+m.tex+' textures ('+m.big+' over 2048 px), scene '+m.scene+' children'+(m.heap!=null?', JS heap '+m.heap+' MB':'');
    console.log(n+' '+w+'x'+h+' (art tier '+tier+', squad '+f1.pre.team+'):');
    console.log('     campaign map before any fight: '+S(map0));
    [['fight 1',f1],['fight 2',f2]].forEach(([k,f])=>{ console.log('     '+k+': fight running '+f.start+' ms after Fight (incl. the squad screen), squad art up '+f.artMs+' ms; in the fight '+S(f.inFight)+'; benched '+f.pre.benched+' (on the field '+f.pre.inUnits+')');
      console.log('       on the pre-fight squad screen: '+S(f.warm));
      console.log('       after Quit, on the campaign map: '+S(f.after)+'; benched meshes still in the scene: '+f.benchLeft); });
    console.log('     Heroes screen after: '+S(menu));
    console.log('     console errors / GL warnings in this page: '+cons.length+(cons.length?' - '+[...new Set(cons)].slice(0,4).join(' | '):''));
    ok(f1.pre.benched===2&&f1.pre.inUnits===0&&f2.pre.benched===2,n+': both fights quit while Vireo and Sylthaine were still benched (the case under test)');
    ok(f1.benchLeft===0&&f2.benchLeft===0,n+': the benched 1-1 meshes leave the scene with the fight (left: '+f1.benchLeft+' then '+f2.benchLeft+')');
    ok(f2.after.scene<=f1.after.scene,n+': the scene does not grow fight to fight ('+f1.after.scene+' -> '+f2.after.scene+' children)');
    if(tier==='phone'){
      ok(f1.after.texMB<=8&&f2.after.texMB<=8,n+': phone tier - battle textures are released on the campaign map after a fight ('+f1.after.texMB+' MB, then '+f2.after.texMB+' MB; limit 8)');
      ok(menu.texMB<=8,n+': phone tier - and stay released on another menu ('+menu.texMB+' MB)');
    } else {
      ok(f1.after.texMB>0,n+': '+tier+' tier - the squad stays warm between fights as before ('+f1.after.texMB+' MB kept)');
    }
    ok(f2.inFight.tex<=f1.inFight.tex&&f2.inFight.texMB<=f1.inFight.texMB+1,n+': fight 2 holds no more textures than fight 1 - nothing released mid-load comes back (a stage card opened in the same tick as the release, as the rune tree\'s "Farm:" link does) ('+f1.inFight.tex+' / '+f1.inFight.texMB+' MB -> '+f2.inFight.tex+' / '+f2.inFight.texMB+' MB)');
    ok(f2.warm.tex>0,n+': the stage card\'s art warm-up is kept on the pre-fight squad screen ('+f2.warm.texMB+' MB in '+f2.warm.tex+' textures)');
    ok(f2.inFight.tex>0&&f2.artMs<30000,n+': the second fight reloads its art and runs ('+f2.inFight.texMB+' MB in '+f2.inFight.tex+' textures, art up in '+f2.artMs+' ms)');
    ok(errs.length===0,n+': no page errors ('+errs.slice(0,2).join(' | ')+')');
    await ctx.close(); }
  if(process.env.OUT) fs.writeFileSync(process.env.OUT,JSON.stringify(OUT,null,1));
  finish('test_tr1364_memory');
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ await cleanup(); } })();
