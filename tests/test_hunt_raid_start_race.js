const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1364-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
/* Grok bug hunt 12 Nov (Claude 02:12: do other launch paths have the Vault's reply-after-leaving race?). Guild Raid: raidLaunch awaited
   /api/guild/raid/start and then ran startBattle() wherever the player was - Back to the Guild during a slow reply still yanked them into
   the raid fight. CONTROL (main) must FAIL; patched must PASS, and a normal Battle (and the one after a dropped reply) must still start. */
async function server(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  /* wait for the first server's REAL exit before the admin restart (Claude's start/stop rule) */
  await delay(700); await new Promise(r=>{ child.once('exit',r); child.kill(); }); 
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  return {base,L,J}; }
async function openPage(base,L,w,h,errs){ const ctx=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:'block'}); const page=await ctx.newPage();
  page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {ctx,page}; }
async function raidSquad(page){ await page.evaluate(()=>{ const own=Object.keys(HERO_TYPES).filter(k=>G.unlocked&&G.unlocked[k]);
  G.squads=G.squads||{}; G.squads.graid=own.slice(0,5); raidSelectHeroes(); }); await delay(1000); }
(async()=>{ try{
  const {base,L,J}=await server();
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const g=await J('/api/guild/create',{name:'Race Guild'},L.token); ok(!!(g&&!g.error),'fixture: guild created '+JSON.stringify(g&&g.error||'ok'));
  const errs=[];
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){
    const {ctx,page}=await openPage(base,L,w,h,errs); const e0=errs.length; await page.evaluate(async()=>{ await api('/api/admin/led-grant','POST',{unlock:Object.keys(HERO_TYPES).slice(0,10)}); await ledgerSync(); }); await delay(500);
    let hold=true, held=[], n=0; await page.route('**/api/guild/raid/start',async route=>{ n++; if(!hold){ await route.continue(); return; } const resp=await route.fetch(); await new Promise(r=>held.push(r)); await route.fulfill({response:resp}); });
    await page.evaluate(()=>show('guild')); await delay(1500);
    await raidSquad(page); const sq=await page.evaluate(()=>({state, mode:CUR.mode, sq:squadFor('graid').length}));
    ok(sq.state==='menu'&&sq.mode==='graid'&&sq.sq>0, nm+' fixture: on the raid squad screen with '+sq.sq+' heroes');
    await page.locator('#startBtn').click(); await delay(400); const sent=n;
    await page.evaluate(()=>show('guild')); await delay(400);   /* the player goes back to the Guild while the start reply is slow */
    held.forEach(f=>f()); held=[]; await delay(8000);
    const s1=await page.evaluate(()=>{ const ld=document.getElementById('battleLoader'); const lv=!!(ld&&ld.offsetParent!==null&&getComputedStyle(ld).display!=='none'&&getComputedStyle(ld).visibility!=='hidden'); return {state, loader:lv, attempt:!!CUR.attemptId}; });
    ok(sent===1, nm+' one raid start was sent ('+sent+')');
    ok(s1.state==='guild'&&!s1.loader&&!s1.attempt, nm+' back to the Guild mid-start -> stays on the Guild, no raid fight loads '+JSON.stringify(s1));
    hold=false; await raidSquad(page); await page.locator('#startBtn').click();
    await page.waitForFunction(()=>state==='battle'&&CUR.mode==='graid',null,{timeout:90000}).catch(()=>{});
    const s2=await page.evaluate(()=>({state, mode:CUR.mode, att:!!CUR.attemptId}));
    ok(s2.state==='battle'&&s2.mode==='graid'&&s2.att, nm+' the next Battle tap starts the raid fight (server attempt) '+JSON.stringify(s2));
    ok(errs.length===e0, nm+' no page errors '+errs.slice(e0).join(' | ').slice(0,160));
    await ctx.close(); }
}catch(e){ console.error(e); fails++; } finally { finish('guild raid start reply race'); await cleanup(); } })();
