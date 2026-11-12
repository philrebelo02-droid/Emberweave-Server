// v1376 (tester Soul Eater 12 Nov, Phil: "make the dandra change"): The Swarm Moves On - enemies the bees move on to receive 30% less healing while the spread sting lasts. CONTROL: EW_ROOT=<d5dca06b copy> must FAIL.
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
    const D=makeUnit('dandra','ally',100,300,30,{owned:false,rank:5}); D.pass=Object.assign({},D.pass||{},{contagion:true});
    const mk=(x)=>makeUnit('vael','enemy',x,300,30,{owned:false,rank:1});
    const A=mk(400), B=mk(400+1.2*METER), C=mk(400+20*METER);
    units.length=0; units.push(D,A,B,C); battleTime=10;
    A.dots=[{color:'#f2d84a',dps:5,t:4,src:D}]; A._contagion=true; A._plagueDps=5; A._plagueColor='#f2d84a'; A._plagueHex=0xf2d84a;
    damage(A,1e9,'#fff');
    out.died=!A.alive; out.nearCut=+(((B._beeCutUntil||0)-battleTime).toFixed(2)); out.farCut=C._beeCutUntil||0;
    const h0=B.hp; B.hp=1; healUnit(B,100); out.healCut=+(B.hp-1).toFixed(2); B.hp=1; C.hp=1; healUnit(C,100); out.healFar=+(C.hp-1).toFixed(2);
    battleTime+=30; B.hp=1; healUnit(B,100); out.healAfter=+(B.hp-1).toFixed(2);
    /* a Bloatus plague spread (green) cuts nothing */
    const E=mk(700), F=mk(700+1*METER); units.push(E,F); E.dots=[{color:'#8fbf3f',dps:5,t:4}]; E._contagion=true; E._plagueColor='#8fbf3f'; damage(E,1e9,'#fff'); out.plagueCut=F._beeCutUntil||0;
    out.desc=KITS.dandra.purple.desc; return out; });
  ok(r.died&&r.nearCut>=3.9, 'a stung foe dies -> the bees move on and the nearby enemy carries the heal cut for the spread duration ('+r.nearCut+' s)');
  ok(r.farCut===0, 'an enemy out of reach is not affected');
  ok(Math.abs(r.healCut-70)<0.6&&Math.abs(r.healFar-100)<0.6, 'it receives 30% less healing ('+r.healCut+' of 100; unaffected '+r.healFar+')');
  ok(Math.abs(r.healAfter-100)<0.6, 'the cut ends with the sting ('+r.healAfter+')');
  ok(r.plagueCut===0, 'CONTROL: King Bloatus plague spread gives no heal cut');
  ok(/30% less healing/.test(r.desc), 'the ability text says it ('+r.desc+')');
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('dandra swarm heal cut'); await cleanup(); } })();
