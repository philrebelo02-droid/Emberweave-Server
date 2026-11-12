// test_hunt_academy_icons_1377 (tester 12 Nov, Academy, English + Spanish screenshots): "the material types I see only show 4 ... I don't know
// what the diamond, the chain, the hook, and the rock represent. Because the stones that can be mined on the map have different icons" - and the
// Spanish Academy had no title.
// 1. the Academy upgrade cost shows the 4 mine-art icons the top bar and the map use (no emoji).
// 2. in Spanish the Academy title (no painted wordmark there) is visible text: fill colour not transparent, a real box; in English the painted
//    wordmark stays.
// Control: on the parent of the fix (EW_ACAD_REF=<sha> runs that tree) checks 1 and 2 fail.
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn,execFileSync}=require('child_process');
let ROOT=path.resolve(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-acadi-'));
if(process.env.EW_ACAD_REF){ const wt=path.join(temp,'wt'); execFileSync('git',['worktree','add','--detach',wt,process.env.EW_ACAD_REF],{cwd:ROOT,stdio:'ignore'});
  process.on('exit',()=>{ try{ execFileSync('git',['worktree','remove','--force',wt],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'}); }catch(e){} });
  try{ fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(wt,'node_modules'),'junction'); }catch(e){}
  ROOT=wt; }
const OUT=process.env.ACAD_SHOTS||'';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let fails=0; const ok=(c,m)=>{ if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
(async()=>{ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  const child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'ac'+Date.now().toString(36),pass:'password1'})})).json();
  const L={token:reg.token,id:reg.profile.id};
  let browser;
  try{ browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output']});
    const ctx=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'}); const page=await ctx.newPage();
    await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
    await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof show==='function'&&typeof renderTech==='function',null,{timeout:120000});
    for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none') return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
    await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; if(typeof ledgerSync==='function') await ledgerSync(); },L); await delay(800);
    await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); const a=document.getElementById('authGate'); if(a) a.style.display='none'; });
    for(const lang of ['en','es']){
      await page.evaluate(async l=>{ await langLoad(l); G.res={iron:703,crystal:703,silver:0,coal:0}; show('tech'); const sc=document.getElementById('tech');
        document.querySelectorAll('.screen.active').forEach(x=>x!==sc&&x.classList.remove('active')); sc.classList.add('active'); techSel='academy'; renderTech(); },lang);
      await delay(2000);
      const r=await page.evaluate(()=>{ const h=document.querySelector('#tech h1'); const rc=h.getBoundingClientRect();
        return {txt:h.textContent,w:rc.width,h:rc.height,fill:getComputedStyle(h).webkitTextFillColor,cost:(document.querySelector('#techLearnBtn .ac-cost')||{}).innerHTML||''}; });
      const icons=r.cost.match(/mine-icons-(iron|crystal|silver|coal)\.png/g)||[];
      ok(icons.length===4, lang+': the Academy cost shows the 4 mine-art icons ('+icons.length+')');
      ok(!/⛓|💎|🔗|🪨/.test(r.cost), lang+': no emoji in the cost');
      if(lang==='es') ok(r.fill!=='rgba(0, 0, 0, 0)'&&r.w>40&&r.h>20&&r.txt==='Academia', 'es: the Academy title is visible text ('+r.fill+')');
      else ok(r.fill==='rgba(0, 0, 0, 0)'&&r.h>20, 'en: the painted wordmark stays');
      if(OUT){ try{ fs.mkdirSync(OUT,{recursive:true}); await page.screenshot({path:path.join(OUT,'acad-'+lang+'.jpg'),type:'jpeg',quality:75}); }catch(e){} } }
  } finally { try{ await browser.close(); }catch(e){} child.kill(); }
  console.log(fails?'FAIL '+fails:'PASS'); process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
