// v1365 (tester A "Performance": opening the campaign freezes and the music stutters; Claude's diagnosis 11 Nov, section 2): the boss / elite icons on the
// campaign map must be decoded at the size they are drawn (not as full battle sheets), their canvases must be no bigger than they are shown, a canvas is
// repainted only when its frame changes, and opening the map under 4x CPU throttling must not block the main thread for long. Measured at 844x390,
// 882x344 and 1440x800, each in a fresh page (so each gets its own art tier). Grok. Real page on a throwaway server.
// CONTROL: EW_ROOT=<HEAD f2cef637 copy> must FAIL. OUT=<file> also writes the measurements as JSON; SHOTS=<dir> saves the map per size; DSF=3 runs at 3x density.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1365-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
const CPU=+(process.env.CPU||4), LONG_MAX=+(process.env.LONG_MAX||600);
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
async function server(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(const _t0=Date.now();Date.now()-_t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}   /* 11 Nov: a 60 s deadline, not an iteration count */throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({args:['--mute-audio','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
  return {base,L}; }
async function openPage(base,L,w,h){ const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:+(process.env.DSF||1),serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){}
    window._lt=[]; try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) window._lt.push([e.startTime,e.duration]); }).observe({entryTypes:['longtask']}); }catch(e){}
    window._idleDraws=0; const d=CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage=function(){ if(this.canvas&&this.canvas.classList&&this.canvas.classList.contains('cIdle')) window._idleDraws++; return d.apply(this,arguments); }; });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await page.evaluate(()=>show('home')); await delay(2500); return {ctx,page,errs}; }
/* open the map under CPU throttling and record the main-thread blocks and the worst gap between frames in the next 4 s */
async function timedOpen(page,cdp){ await cdp.send('Emulation.setCPUThrottlingRate',{rate:CPU});
  const r=await page.evaluate(async()=>{ const t0=performance.now(); let last=t0, gap=0, run=true; const f=t=>{ gap=Math.max(gap,t-last); last=t; if(run) requestAnimationFrame(f); }; requestAnimationFrame(f);
    show('campaign'); const sync=performance.now()-t0; await new Promise(r=>setTimeout(r,4000)); run=false; await new Promise(r=>setTimeout(r,50));
    const lt=window._lt.filter(e=>e[0]>=t0-5); return {sync:Math.round(sync),gap:Math.round(gap),max:Math.round(Math.max(0,...lt.map(e=>e[1]))),total:Math.round(lt.reduce((a,e)=>a+e[1],0)),n:lt.length}; });
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1}); return r; }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
(async()=>{ const OUT=[]; try{
  const {base,L}=await server();
  console.log('Campaign open, root='+ROOT+', CPU x'+CPU);
  for(const [w,h,n] of [[844,390,'phone'],[882,344,'Fold cover'],[1440,800,'PC']]){
    const {ctx,page,errs}=await openPage(base,L,w,h); const cdp=await ctx.newCDPSession(page);
    const first=await timedOpen(page,cdp);
    await page.waitForFunction(()=>{ const c=[...document.querySelectorAll('#campaign canvas.cIdle')]; return c.length&&c.every(el=>el._idleReady||el._lb); },null,{timeout:30000}).catch(()=>{});
    await delay(800);
    const st=await page.evaluate(async()=>{ const c=[...document.querySelectorAll('#campaign canvas.cIdle')];
      const src=el=>{ if(el._idleImg&&el._idleImg.naturalWidth) return [el._idleImg.naturalWidth,el._idleImg.naturalHeight];
        if(el._lb) return [el._lb.width,el._lb.height]; return null; };
      const per=c.map(el=>{ const q=el.getBoundingClientRect(), s=src(el), rows=+el.dataset.rows||1, cols=+el.dataset.cols||6;
        let ink=0; try{ const d=el.getContext('2d').getImageData(0,0,el.width,el.height).data; for(let i=3;i<d.length;i+=4) if(d[i]>8){ ink++; } }catch(e){ ink=-1; }
        return {u:el.dataset.u.split('/').pop(),cssW:+q.width.toFixed(1),cssH:+q.height.toFixed(1),canvas:[el.width,el.height],src:s,srcCellH:s?Math.round(s[1]/rows):null,ink,fps:+el.dataset.fps,n:+el.dataset.n,ping:el.dataset.ping==='1'}; });
      const seen={}; let mb=0; per.forEach(p=>{ if(p.src&&!seen[p.u]){ seen[p.u]=1; mb+=p.src[0]*p.src[1]*4/1048576; } });
      const d0=window._idleDraws; await new Promise(r=>setTimeout(r,2000)); const draws=window._idleDraws-d0;
      const want=per.reduce((a,p)=>a+(p.n>1?p.fps*2+1:1),0);
      return {dpr:devicePixelRatio,tier:typeof ART_TIER!=='undefined'?ART_TIER:'?',per,decodedMB:+mb.toFixed(1),draws2s:draws,frameChanges2s:want}; });
    if(process.env.SHOTS){ await page.screenshot({path:path.join(process.env.SHOTS,'campaign_'+n.split(' ')[0].toLowerCase()+'.png')});
      const cl=await page.evaluate(()=>{ const c=[...document.querySelectorAll('#campaign canvas.cIdle')].map(e=>e.getBoundingClientRect()); const l=Math.min(...c.map(r=>r.left))-30,t=Math.min(...c.map(r=>r.top))-30,r=Math.max(...c.map(r=>r.right))+30,b=Math.max(...c.map(r=>r.bottom))+40; return {x:Math.max(0,l),y:Math.max(0,t),width:Math.min(innerWidth,r)-Math.max(0,l),height:Math.min(innerHeight,b)-Math.max(0,t)}; });
      await page.screenshot({path:path.join(process.env.SHOTS,'campaign_'+n.split(' ')[0].toLowerCase()+'_icons.png'),clip:cl}); }
    await page.evaluate(()=>show('home')); await delay(1500);
    const again=await timedOpen(page,cdp);
    OUT.push({size:n,w,h,first,again,...st});
    console.log(n+' '+w+'x'+h+' (tier '+st.tier+', dpr '+st.dpr+'): open at CPU x'+CPU+' -> longest block '+first.max+' ms, long tasks '+first.n+' / '+first.total+' ms, worst frame gap '+first.gap+' ms; reopen -> longest '+again.max+' ms, total '+again.total+' ms, gap '+again.gap+' ms; decoded icon sheets '+st.decodedMB+' MB; idle repaints in 2 s '+st.draws2s+' (frame changes '+st.frameChanges2s+')');
    st.per.forEach(p=>console.log('     '+p.u+' shown '+p.cssW+'x'+p.cssH+' css, canvas '+p.canvas.join('x')+', decoded sheet '+(p.src?p.src.join('x'):'none')+' (cell h '+p.srcCellH+'), painted px '+p.ink));
    ok(st.per.length>0,n+': the map shows boss / elite icons ('+st.per.length+')');
    const cap=p=>Math.ceil(p.cssH*Math.min(3,Math.max(1,st.dpr)))+2;
    const bigSrc=st.per.filter(p=>!p.src||p.srcCellH>cap(p)); ok(bigSrc.length===0,n+': every icon sheet is decoded at no more than its shown height x density ('+(bigSrc.map(p=>p.u+' cell h '+p.srcCellH+' > '+cap(p)).join('; ')||'all within')+')');
    const bigCv=st.per.filter(p=>p.canvas[1]>cap(p)); ok(bigCv.length===0,n+': every icon canvas is no taller than its shown height x density ('+(bigCv.map(p=>p.u+' '+p.canvas.join('x')).join('; ')||'all within')+')');
    ok(st.per.every(p=>p.ink>0),n+': every icon is painted (no blank canvases)');
    ok(st.draws2s<=Math.ceil(st.frameChanges2s*1.25)+st.per.length,n+': icons repaint only when their frame changes ('+st.draws2s+' paints in 2 s, '+st.frameChanges2s+' frame changes)');
    ok(st.draws2s>0,n+': the icons still animate ('+st.draws2s+' paints in 2 s)');
    ok(first.max<=LONG_MAX,n+': opening the map blocks the main thread for at most '+LONG_MAX+' ms at CPU x'+CPU+' (longest '+first.max+' ms)');
    ok(again.max<=LONG_MAX,n+': reopening the map blocks the main thread for at most '+LONG_MAX+' ms at CPU x'+CPU+' (longest '+again.max+' ms)');
    ok(errs.length===0,n+': no page errors ('+errs.slice(0,2).join(' | ')+')');
    await ctx.close(); }
  if(process.env.OUT) fs.writeFileSync(process.env.OUT,JSON.stringify(OUT,null,1));
  finish('test_tr1364_campaign_open');
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ await cleanup(); } })();
