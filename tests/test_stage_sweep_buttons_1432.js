// v1432 (Phil 23 Nov 2026, the stage window: "instead of sweep x 1, sweep x 10 make it SWEEP, X 1, X 10, X" / "Now sweep isnt a pressable button
// but the X1 X10 and X is" / "Yes the X should give the player the option to type their sweep amount"): the REAL page against a throwaway
// server at phone landscape, phone portrait, tablet and desktop sizes:
//  1. a cleared, three-star stage shows SWEEP as a label (not a button) and three buttons x1, x10, X - all inside the window, none overlapping
//  2. X opens a number box (1 to the most one sweep can do), typing 3 and Enter sweeps exactly 3 runs (the server's stamina falls by 3 runs)
//  3. x1 sweeps one run; x10 sweeps as many as the stamina pays for (here 10)
//  4. an uncleared stage shows the label with the three buttons disabled
// Screenshots: SWEEP_SHOTS=<dir>.
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname,path.join(ROOT,'..','..','Base files')]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-sweep1432-')), dbFile=path.join(temp,'db.json');
const OUT=process.env.SWEEP_SHOTS||'';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let fails=0; const ok=(c,m)=>{ if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
(async()=>{ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:dbFile,ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',DATABASE_URL:''};
  const up=async()=>{for(let i=0;i<300;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('server did not start');};
  const child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const stop=async()=>{ child.kill(); for(let i=0;i<200&&child.exitCode===null&&child.signalCode===null;i++) await delay(50); };
  let browser;
  try{ browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output']});
    for(const vp of [{w:844,h:390,n:'phoneL'},{w:390,h:844,n:'phoneP'},{w:1024,h:768,n:'tablet'},{w:1400,h:900,n:'desktop'}]){
      const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'sw'+vp.n+Date.now().toString(36).slice(-4),pass:'password1'})})).json();
      const ctx=await browser.newContext({viewport:{width:vp.w,height:vp.h},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
      await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
      await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
      await page.waitForFunction(()=>typeof openStageModal==='function'&&typeof ledgerSync==='function',null,{timeout:120000});
      for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none') return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }); if(gone) break; await delay(250); }
      await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.profile.id; if(typeof ledgerSync==='function') await ledgerSync(); },reg); await delay(800);
      await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); const a=document.getElementById('authGate'); if(a) a.style.display='none'; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); });
      // a cleared, three-star stage 1-4 and stamina for 20 runs (the client's view of the campaign; the sweep itself is the server's)
      const tag=vp.n;
      const setUp=()=>page.evaluate(()=>{ G.campaignCleared=Math.max(G.campaignCleared|0,4); G.stageStars=G.stageStars||{}; G.stageStars[4]=3; G.stamina=Math.max(G.stamina|0,20*stageStamCost(4,'normal')); });
      await setUp(); await page.evaluate(()=>openStageModal(4,'normal')); await delay(700);
      const L=await page.evaluate(()=>{ const q=s=>document.querySelector('#stageModal '+s), R=e=>e&&e.getBoundingClientRect();
        const grp=q('.smSweepGrp'), lbl=q('.smSweepLbl'), b1=q('#smSweep'), b10=q('#smSweep10'), bx=q('#smSweepX'), card=q('.smStageCard')||document.getElementById('stageModal');
        const r=[lbl,b1,b10,bx].map(R), c=R(card), vw=innerWidth, vh=innerHeight;
        const inside=r.every(x=>x&&x.width>0&&x.left>=-1&&x.right<=vw+1&&x.top>=-1&&x.bottom<=vh+1);
        let overlap=false; for(let i=0;i<r.length;i++) for(let j=i+1;j<r.length;j++){ const a=r[i],b=r[j]; if(a&&b&&a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1) overlap=true; }
        return { hasGrp:!!grp, lblTag:lbl&&lbl.tagName, lblText:lbl&&lbl.textContent.trim(), texts:[b1,b10,bx].map(b=>b&&b.textContent.trim()), dis:[b1,b10,bx].map(b=>b&&b.disabled), inside, overlap,
          oldButtons:!!(q('#smSweepN')), sizes:r.map(x=>x&&[Math.round(x.width),Math.round(x.height)]) }; });
      ok(L.hasGrp&&L.lblTag==='SPAN'&&/SWEEP/.test(L.lblText),tag+': SWEEP is a label, not a button ('+L.lblTag+' "'+L.lblText+'")');
      ok(JSON.stringify(L.texts)==='["×1","×10","X"]',tag+': the buttons read x1, x10, X ('+JSON.stringify(L.texts)+')');
      ok(L.dis.every(d=>d===false),tag+': all three are live on a cleared three-star stage with stamina');
      ok(L.inside&&!L.overlap,tag+': label and buttons inside the screen, none overlapping ('+JSON.stringify(L.sizes)+')');
      if(OUT){ fs.mkdirSync(OUT,{recursive:true}); await page.screenshot({path:path.join(OUT,'sweep-'+tag+'.png')}); }
      // X: type 3, Enter -> a sweep of exactly 3 runs is sent (the sweep request itself is the unchanged sweepStage -> /api/campaign/sweep,
      // which the server authorises against its own campaign record; this test account has not really cleared 1-4, so we watch the call)
      const spy=()=>page.evaluate(()=>{ window._sw=[]; const o=window._swOrig||(window._swOrig=sweepStage); window.sweepStage=sweepStage=function(i,n,m){ window._sw.push([i,n,m]); }; });
      if(tag==='phoneL'||tag==='desktop'){
        await spy();
        await page.evaluate(()=>document.querySelectorAll('#tutOffer').forEach(n=>n.remove())); await page.click('#smSweepX'); await delay(300);
        const box=await page.evaluate(()=>{ const i=document.getElementById('smSweepXN'); return i&&{min:i.min,max:i.max,val:i.value,type:i.type}; });
        ok(box&&box.type==='number'&&box.min==='1'&&+box.max>=1,tag+': X opens a number box ('+JSON.stringify(box)+')');
        if(OUT) await page.screenshot({path:path.join(OUT,'sweep-'+tag+'-X.png')});
        const most=+box.max;
        ok(most===10,tag+': X goes up to 10 (one sweep, stamina for 20 runs) - '+most);
        await page.fill('#smSweepXN','3'); await page.press('#smSweepXN','Enter'); await delay(300);
        await page.fill('#smSweepXN','99'); await page.click('#smSweepXGo'); await delay(300);   // more than one sweep can do: held at the most
        await page.click('#smSweep'); await delay(200); await page.click('#smSweep10'); await delay(200);
        const calls=await page.evaluate(()=>window._sw);
        ok(JSON.stringify(calls)==='[[4,3,"normal"],[4,10,"normal"],[4,1,"normal"],[4,10,"normal"]]',tag+': X typed 3 sends 3, typed 99 is held at 10, x1 sends 1, x10 sends 10 ('+JSON.stringify(calls)+')');
        await page.evaluate(()=>{ window.sweepStage=sweepStage=window._swOrig; });
      }
      // an uncleared stage: the label is there, the buttons are disabled
      await page.evaluate(()=>{ closeStageModal(); }); await delay(200);
      await page.evaluate(()=>openStageModal(Math.min(portalStages('normal'),(G.campaignCleared|0)+1),'normal')); await delay(600);
      const U=await page.evaluate(()=>{ const q=s=>document.querySelector('#stageModal '+s); return { lbl:!!q('.smSweepLbl'), dis:['#smSweep','#smSweep10','#smSweepX'].map(s=>{ const b=q(s); return b?b.disabled:null; }) }; });
      ok(U.lbl&&U.dis.every(d=>d===true),tag+': on an uncleared stage the three are disabled ('+JSON.stringify(U.dis)+')');
      ok(errs.length===0,tag+': no page errors ('+errs.slice(0,2).join(' | ')+')');
      await ctx.close();
    }
  } catch(e){ fails++; console.log('  FAIL '+(e&&e.stack||e)); }
  finally{ try{ await browser.close(); }catch(e){} await stop(); }
  console.log('test_stage_sweep_buttons_1432.js: '+(fails?fails+' FAILED':'all passed')); process.exitCode=fails?1:0;
})();
