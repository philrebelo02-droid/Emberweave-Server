// v1378 F5 (Grok v1378 guide-bottom check; Claude 12 Nov job "continue the feature-guides work"): the Forge guide's Skip / Next never sit on a Forge
// button. The Forge is buttons top to bottom (gear grid + the full-height quality column on the right), so the bottom bar put Skip / Next on Gold +4 /
// Orange (844x390) and Orange + gear cells (PC). Forge's guide is foot:'por': when the bottom bar would put Skip / Next on a button they stand just above
// the portrait in the left gutter instead. Per line (all 4) at 844x390, Fold 906x1088 and PC 1440x900: Skip and Next overlap no visible Forge button
// (0 px2), sit inside the game view and below the screen's top row, are the top element at their own centres (tappable), the bar stays at the bottom
// edge, and Next walks the guide to the end and marks it seen. CONTROL: FAILS on d0401c0d (Skip / Next on Gold +4 / Orange). Chromium:
// --disable-audio-output, never --mute-audio.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const SHOTS=process.env.GFORGE_SHOTS||''; const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gforge-')); const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0; const ok=(c,m)=>{checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const VIEWS=[['844x390',{width:844,height:390},true],['906x1088',{width:906,height:1088},true],['1440x900',{width:1440,height:900},false]];
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',SIM_WORKERS:'0'},stdio:'ignore',windowsHide:true});
  let up=false; for(let i=0;i<400&&!up;i++){ try{ up=(await fetch(base+'/api/health')).ok; }catch(_){} if(!up) await delay(150); } if(!up) throw new Error('throwaway server did not start');
  browser=await chromium.launch({ ignoreDefaultArgs:['--mute-audio'], args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});
  for(const [tag,vp,touch] of VIEWS){
    const nm='gf'+Date.now().toString(36); const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:nm,pass:'password1'})})).json();
    const L={token:reg.token,id:reg.profile.id,name:nm};
    const ctx=await browser.newContext({viewport:vp,hasTouch:touch,isMobile:touch,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
    await page.addInitScript(L=>{ try{ localStorage.setItem('ew_acc',JSON.stringify(L)); localStorage.setItem('ew_guest_step_'+L.id,'1'); window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} },L);
    await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await page.goto(base+'/play',{waitUntil:'load',timeout:180000});
    await page.waitForFunction(()=>typeof FTUT_GUIDES!=='undefined'&&typeof show==='function'&&ACC&&ACC.token,null,{timeout:180000});
    for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
    await delay(900);
    await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} G.tutSkipped=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); document.body.classList.remove('gated');
      playerLevel=()=>99; G.campaignCleared=Math.max(G.campaignCleared|0,30); G.ftutOff=false; G.ftutSeen={}; FTUT_GUIDES.forEach(x=>{ if(x.k!=='forge') G.ftutSeen[x.k]=1; }); show('forge'); });
    const fired=await page.waitForFunction(()=>{ const b=document.getElementById('ftutBar'); return b&&b.dataset.guide==='forge'&&!b.classList.contains('ftut-hold'); },null,{timeout:30000}).then(()=>true,()=>false);
    ok(fired, tag+': forge guide fires'); if(!fired){ await ctx.close(); continue; }
    const n=await page.evaluate(()=>ftutSpeakers(FTUT.cur).length);
    for(let line=1; line<=n; line++){
      await delay(900);
      const r=await page.evaluate(()=>{ const R=e=>(typeof e.ewGameRect==='function')?e.ewGameRect():e.getBoundingClientRect(); const bar=document.getElementById('ftutBar'), host=ftutHost('forge'), v=ewGameView();
        const area=(a,q)=>Math.max(0,Math.min(a.right,q.right)-Math.max(a.left,q.left))*Math.max(0,Math.min(a.bottom,q.bottom)-Math.max(a.top,q.top));
        const fb=[...bar.querySelectorAll('.ftut-foot .btn')]; const fr=fb.map(R); let px=0; const on=[];
        host.querySelectorAll('button,.btn,a[href],input,select,[onclick],.islespot,.hd-tab,[data-portal],.tab').forEach(el=>{ if(el.closest('#ftutBar')) return; const q=R(el); if(q.width<4||q.height<4) return;
          const cs=getComputedStyle(el); if(cs.visibility==='hidden'||+cs.opacity===0) return; const a=fr.reduce((s,f)=>s+area(f,q),0); if(a>0){ px+=a; on.push((el.textContent||'').trim().replace(/\s+/g,' ').slice(0,16)||String(el.className).slice(0,16)); } });
        const hb=FTUT.row?FTUT.row.y:0; const inView=fr.every(f=>f.left>=-0.5&&f.top>=hb-0.5&&f.right<=v.width+0.5&&f.bottom<=v.height+0.5);
        const tap=fb.every(b=>{ const q=b.getBoundingClientRect(); const el=document.elementFromPoint((q.left+q.right)/2,(q.top+q.bottom)/2); return el===b||b.contains(el); });
        const box=R(bar.querySelector('.ftut-box')), por=R(bar.querySelector('.ftut-por'));
        return {line:+bar.dataset.line,px:Math.round(px),on:[...new Set(on)].slice(0,4),inView,tap,bottom:Math.max(box.bottom,por.bottom)>=v.height-24,footpor:bar.classList.contains('ftut-footpor')}; });
      if(SHOTS){ try{ fs.mkdirSync(SHOTS,{recursive:true}); await page.screenshot({path:path.join(SHOTS,tag+'-forge-L'+line+'.png')}); }catch(e){} }
      ok(r.line===line&&r.px===0, tag+': forge line '+line+' Skip / Next on no Forge button ('+r.px+' px2'+(r.on.length?': '+r.on.join(' | '):'')+(r.footpor?', above portrait':', in box')+')');
      ok(r.inView&&r.tap, tag+': forge line '+line+' Skip / Next inside the view, under the top row, tappable');
      ok(r.bottom, tag+': forge line '+line+' bar at the bottom edge');
      await page.evaluate(()=>{ const b=document.querySelector('#ftutBar .ftut-next'); if(b) b.click(); }); }
    await delay(600);
    const done=await page.evaluate(()=>({gone:!document.getElementById('ftutBar')||document.getElementById('ftutBar').dataset.guide!=='forge',seen:ftutSeen('forge')}));
    ok(done.gone&&done.seen, tag+': Next walks the forge guide to the end and marks it seen');
    ok(errs.length===0, tag+': no page errors ('+errs.slice(0,2).join(' | ')+')'); await ctx.close(); }
}catch(e){ console.error(e); fails++; } finally { console.log('guide forge 1378: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1;
  if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); await delay(300); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
