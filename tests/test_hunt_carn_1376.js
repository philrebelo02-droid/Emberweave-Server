// v1376 (tester Soul Eater 12 Nov: Carn "moves very slowly" / his ult "has a shorter range than stated and does almost no damage"): speed 72->80, Crimson Reap 90 deg wedge at 3.4x Attack with bleed, 6.5 m. CONTROL: EW_ROOT=<34b0f9f2 copy> must FAIL.
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
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
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
  const r=await page.evaluate(()=>{ const out={};
    const C=makeUnit('carn','ally',300,300,30,{owned:false,rank:3}); C.skillLv=[1,1,1,1];
    const mk=(dx,dy)=>{ const e=makeUnit('vael','enemy',300+dx*METER,300+dy*METER,30,{owned:false,rank:1}); e.maxHp=e.hp=1e6; e.armor=0; e.mr=0; return e; };
    const E=[mk(2,0),mk(6.4,0),mk(4,2.5),mk(4,-2.5),mk(8,0),mk(1,3)];
    units.length=0; units.push(C,...E); battleTime=5; C.target=E[0];
    const o=Object.assign({},ULT_DEF.cleave||{},HERO_ULT_ART.carn||{},{_arrived:true});
    C._castSlot='ult'; C._castSM=1; C._castLv=1; doEffect(C,'cleave',o);
    out.dmg=E.map(e=>Math.round(1e6-e.hp)); { const F=mk(2,0); units.push(F); doEffect(C,'cleave',Object.assign({},o,{mul:2.6,arc:45})); out.old=Math.round(1e6-F.hp); } out.bleed=E.map(e=>(e.dots||[]).length); out.atk=C.dmg; out.speed=HERO_TYPES.carn.speed; out.arc=o.arc; out.mul=o.mul; return out; });
  console.log('   ',JSON.stringify(r));
  ok(r.speed===88, 'Carn moves at 88 (72 -> 80 for the tester, then every Bruiser x1.1) ('+r.speed+')');
  ok(r.arc===90&&r.mul===3.4, 'Crimson Reap: 90 deg wedge, 3.4x Attack ('+r.arc+', '+r.mul+')');
  ok(r.dmg[0]>0&&r.dmg[1]>0&&r.dmg[2]>0&&r.dmg[3]>0, 'hits every enemy in the wide wedge out to 6.4 m, including 2.5 m to each side at 4 m ('+r.dmg.slice(0,4)+')');
  ok(r.dmg[4]===0&&r.dmg[5]===0, 'misses enemies past 6.5 m or far off to the side ('+r.dmg[4]+','+r.dmg[5]+')');
  ok(Math.abs(r.dmg[0]/r.old-3.4/2.6)<0.02, 'the hit is 3.4/2.6 = 1.31x the old ult on the same target ('+r.dmg[0]+' vs '+r.old+')');
  ok(r.bleed[0]>=1&&r.bleed[2]>=1, 'and leaves them bleeding');
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('carn 1376'); await cleanup(); } })();
