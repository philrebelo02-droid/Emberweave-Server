// v1377 (Grok hunt F1; Claude 12 Nov: "the feature-guide bar must never cover a screen's top row (Back, title, counters)"). On every guide screen Grok's
// hunt listed (Market, Shady Market, Wishing Pool, Bulletin Board, Arena, Island, Guild, Forge, Campaign Elite + Bonus) at 844x390, 1280x720 and
// 390x844 portrait: the guide box AND its portrait stay clear of the screen's top row (the Back button + every button / text whose top is in the top 22%
// of the screen), stay inside the screen, and Skip / Next never sit on one of the screen's buttons. CONTROL: FAILS on c9b5496d (box at the top, over the
// Back button / title / counters on Market, Wishing, Campaign...). Chromium: --disable-audio-output, never --mute-audio.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const SHOTS=process.env.GCLEAR_SHOTS||''; const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gclear-')); const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0; const ok=(c,m)=>{checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const VIEWS=[['844x390',{width:844,height:390},true],['1280x720',{width:1280,height:720},false],['390x844 portrait',{width:390,height:844},true]];
const CASES=[['market','market'],['shadymarket','shadymarket'],['wishing','wishing'],['rankings','rankings'],['arena','arena'],['skyisland','skyisland'],['guild','guild'],['forge','forge'],['campaign','elite'],['campaign','bonus']];
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',SIM_WORKERS:'0'},stdio:'ignore',windowsHide:true});
  let up=false; for(let i=0;i<400&&!up;i++){ try{ up=(await fetch(base+'/api/health')).ok; }catch(_){} if(!up) await delay(150); } if(!up) throw new Error('throwaway server did not start');
  browser=await chromium.launch({ ignoreDefaultArgs:['--mute-audio'], args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});
  for(const [tag,vp,touch] of VIEWS){
    const nm='gc'+Date.now().toString(36); const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:nm,pass:'password1'})})).json();
    const L={token:reg.token,id:reg.profile.id,name:nm};
    const ctx=await browser.newContext({viewport:vp,hasTouch:touch,isMobile:touch,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
    await page.addInitScript(L=>{ try{ localStorage.setItem('ew_acc',JSON.stringify(L)); localStorage.setItem('ew_guest_step_'+L.id,'1'); window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} },L);
    await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await page.goto(base+'/play',{waitUntil:'load',timeout:180000});
    await page.waitForFunction(()=>typeof FTUT_GUIDES!=='undefined'&&typeof show==='function'&&ACC&&ACC.token,null,{timeout:180000});
    for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
    await delay(900);
    await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} G.tutSkipped=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); document.body.classList.remove('gated');
      playerLevel=()=>99; G.campaignCleared=Math.max(G.campaignCleared|0,30); G.ftutOff=false; });
    for(const [sc,k] of CASES){
      const r=await page.evaluate(async([sc,k])=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const R=e=>(typeof e.ewGameRect==='function')?e.ewGameRect():e.getBoundingClientRect();
        try{ ftutEnd(false); }catch(e){} document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); show('home'); await sleep(500);
        G.ftutSeen={}; FTUT_GUIDES.forEach(x=>{ if(x.k!==k) G.ftutSeen[x.k]=1; }); show(sc);
        let bar=null; for(let i=0;i<40;i++){ await sleep(200); bar=document.getElementById('ftutBar'); if(bar&&bar.dataset.guide===k&&!bar.classList.contains('ftut-hold')) break; bar=null; } if(!bar) return {fired:false};
        await sleep(900); const v=ewGameView(), host=ftutHost(FTUT.cur.at), hr=R(host), box=R(bar.querySelector('.ftut-box')), por=R(bar.querySelector('.ftut-por'));
        const hit=(a,q)=>Math.min(a.right,q.right)-Math.max(a.left,q.left)>2&&Math.min(a.bottom,q.bottom)-Math.max(a.top,q.top)>2;
        const area=(a,q)=>Math.max(0,Math.min(a.right,q.right)-Math.max(a.left,q.left))*Math.max(0,Math.min(a.bottom,q.bottom)-Math.max(a.top,q.top));
        const row=[]; host.querySelectorAll('.backbtn,button,.btn,h1,h2,h3,b,span,div').forEach(el=>{ if(el.closest('#ftutBar')) return; const q=R(el); if(q.width<6||q.height<6||q.height>80) return;
          const own=el.matches('.backbtn,button,.btn,h1,h2,h3')||[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1); if(!own) return; const cs=getComputedStyle(el); if(cs.visibility==='hidden'||+cs.opacity===0) return;
          if(q.top>hr.top+hr.height*.22) return; if(el.closest('.backbtn')&&!el.matches('.backbtn')) return; row.push({tx:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,24)||String(el.className).slice(0,24),q}); });
        const over=row.filter(x=>hit(box,x.q)||hit(por,x.q)).map(x=>x.tx);
        const foot=[...bar.querySelectorAll('.ftut-foot .btn')].map(R), under=[];
        host.querySelectorAll('button,.btn,[onclick]').forEach(el=>{ if(el.closest('#ftutBar')) return; const q=R(el); if(q.width<6||q.height<6) return; const cs=getComputedStyle(el); if(cs.visibility==='hidden'||+cs.opacity===0) return;
          const a=foot.reduce((s,f)=>s+area(f,q),0); if(a>0.5*q.width*q.height) under.push((el.textContent||'').trim().replace(/\s+/g,' ').slice(0,20)||String(el.className).slice(0,20)); });
        const inside=box.left>=-0.5&&box.top>=-0.5&&box.right<=v.width+0.5&&box.bottom<=v.height+0.5&&por.top>=-0.5&&por.bottom<=v.height+0.5&&por.left>=-0.5;
        return {fired:true,n:row.length,over,under,inside,y:Math.round(box.top)}; },[sc,k]);
      ok(r.fired, tag+': '+k+' guide fires on '+sc);
      if(!r.fired) continue;
      if(SHOTS){ try{ fs.mkdirSync(SHOTS,{recursive:true}); await page.screenshot({path:path.join(SHOTS,tag.replace(/\s.*$/,'')+'-'+k+'.png')}); }catch(e){} }
      ok(r.n>0&&r.over.length===0, tag+': '+k+' box + portrait clear of the '+sc+' top row and Back (box top '+r.y+'; covers: '+(r.over.join(' | ')||'nothing')+')');
      ok(r.inside, tag+': '+k+' box + portrait inside the screen');
      ok(r.under.length===0, tag+': '+k+' Skip / Next not on a screen button ('+(r.under.join(' | ')||'none')+')');
      await page.evaluate(()=>{ try{ ftutEnd(true); }catch(e){} }); }
    ok(errs.length===0, tag+': no page errors ('+errs.slice(0,2).join(' | ')+')'); await ctx.close(); }
}catch(e){ console.error(e); fails++; } finally { console.log('guide clear 1377: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1;
  if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); await delay(300); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
