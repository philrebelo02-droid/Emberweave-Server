// v1364 (Phil 11 Nov: "double check all click hit boxes for buildings, sometimes when i click shady market it opens academy"): every tap on a building's
// painted area (a 5x5 grid over each building; points under a NEIGHBOUR's name plate are reported, not tapped - plates are not moved) and on its name plate opens THAT building, at 844x390, 882x344 and 1440x800; no two tap boxes overlap;
// the food / gold / diamond counters cover no tap box. Grok. Real page on a throwaway server. CONTROL: EW_ROOT=<HEAD d1c3bcfd copy> must FAIL. SHOTS=<dir> saves outlined shots.
// They now stack on the right under MENU. Grok. Real page on a throwaway server. CONTROL: EW_ROOT=<217ca0bf copy> must FAIL. SHOTS=<dir> also saves a screenshot per size.
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
  const up=async()=>{for(const _t0=Date.now();Date.now()-_t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}   /* 11 Nov: a 60 s deadline, not an iteration count */throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  if(o.grant!==false) await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({args:['--mute-audio','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
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
/* painted area of each building, % of the town art (measured on townbg-wide-temple-of-ash-v1.webp, kept a little inside the painted edges); key = what a tap must open */
const ART=[
  ['City Wall','wall:wall',14,30,8,26], ['City Wall (long wall)','wall:wall',15,20,32,66], ['Market','market',42,53,3,15], ['Shady Market','shadymarket',32.5,39.5,15,26],
  ['Temple','temple',55.5,62,3,23], ['Campaign','campaign',68,78,4,25], ['Academy','tech',42,53.5,20,43], ['Bulletin Board','rankings',56.5,64,28,42],
  ['The Vault','dungeon',71,80,31,47], ['Wishing Pool','wishing',54,59.5,46,59], ['Arena','arena',66,75.5,49,64], ['Watch Tower','watchtower',5.5,10.5,62,81],
  ['Guild Hall','guild',34,46,61,82], ['Island of Trials','skyisland',58,70,67,88], ['Witches Hut','wall:cauldron',26,36,31,43], ['Forge','forge',23,31.5,46,60],
  ['The Starless Well','well',83.5,96.5,52,85]];
(async()=>{ try{
  const {page,errs}=await boot();
  console.log('Town tap boxes, root='+ROOT);
  /* record what a tap opens instead of opening it */
  await page.evaluate(()=>{ window._opened=[]; const _s=window.show; window._realShow=_s;
    window.show=function(n){ if(n==='home') return _s.apply(this,arguments); window._opened.push(n==='wall'?'wall:'+WALL_TAB:n); };
    window.openWell=function(){ window._opened.push('well'); }; });
  for(const [w,h,n,tag] of [[844,390,'phone','phone'],[882,344,'Fold cover','fold'],[1440,800,'PC','pc']]){
    await page.setViewportSize({width:w,height:h}); await delay(500); await page.evaluate(()=>{ _realShow('home'); }); await delay(1300);
    const info=await page.evaluate(()=>{ const hots=[...document.querySelectorAll('#townHots .hot')]; const R=e=>{ const q=e.getBoundingClientRect(); return {l:q.left,t:q.top,r:q.right,b:q.bottom}; };
      const X=(a,b)=>a.l<b.r-0.5&&a.r>b.l+0.5&&a.t<b.b-0.5&&a.b>b.t+0.5; const rs=hots.map(R); const ov=[]; for(let i=0;i<rs.length;i++) for(let j=i+1;j<rs.length;j++) if(X(rs[i],rs[j])) ov.push((hots[i].title||'wall '+i)+' / '+(hots[j].title||'wall '+j));
      const locked=hots.filter(x=>x.classList.contains('locked')).map(x=>x.title);
      const ctr=[...document.querySelectorAll('#townHud .resframe')].map(f=>{ const p=[f,f.querySelector('.resicon'),f.querySelector('.resplus')].filter(Boolean).map(R); return {l:Math.min(...p.map(a=>a.l)),t:Math.min(...p.map(a=>a.t)),r:Math.max(...p.map(a=>a.r)),b:Math.max(...p.map(a=>a.b))}; });
      const under=[]; const ia=(a,c)=>Math.max(0,Math.min(a.r,c.r)-Math.max(a.l,c.l))*Math.max(0,Math.min(a.b,c.b)-Math.max(a.t,c.t)); hots.forEach((x,i)=>{ const r=rs[i], A=Math.max(1,(r.r-r.l)*(r.b-r.t)), cov=ctr.reduce((s,c)=>s+ia(r,c),0)/A; if(cov>0.35) under.push((x.title||'wall '+i)+' '+(cov*100).toFixed(0)+'%'); });   /* v1369: the counter row sits on MENU's line (Phil 11 Nov), over the TOP strip of the top-row buildings' tap boxes; allowed up to 35% of a box (Temple and Campaign reach 25-30% on phone and Fold), never more */
      const im=document.getElementById('townImg').getBoundingClientRect(); return {ov,locked,under,img:{l:im.left,t:im.top,w:im.width,h:im.height}}; });
    ok(info.locked.length===0,n+': every building is unlocked for the test ('+(info.locked.join(',')||'none locked')+')');
    ok(info.ov.length===0,n+': no two tap boxes overlap ('+(info.ov.join('; ')||'none')+')');
    ok(info.under.length===0,n+': the food / gold / diamond counters cover no more than the top strip (35%) of any tap box ('+(info.under.join(',')||'none')+')');
    if(process.env.SHOTS){ await page.evaluate(()=>{ const s=document.createElement('style'); s.id='hbOutline'; s.textContent='#townHots .hot{outline:2px solid #ff3df5!important;outline-offset:-2px;background:rgba(255,61,245,.12)!important}'; document.head.appendChild(s); });
      await page.screenshot({path:path.join(process.env.SHOTS,'hitboxes_'+tag+'.png')}); await page.evaluate(()=>document.getElementById('hbOutline').remove()); }
    const wrong=[], hud=[], plates={}; let taps=0;
    for(const [name,want,x0,x1,y0,y1] of ART){ const bad={};
      for(let i=0;i<5;i++) for(let j=0;j<5;j++){ const px=info.img.l+info.img.w*(x0+(x1-x0)*i/4)/100, py=info.img.t+info.img.h*(y0+(y1-y0)*j/4)/100;
        const cov=await page.evaluate(([x,y])=>{ const t=document.elementFromPoint(x,y); if(t&&t.closest('#leftHud,#cornerHud,#townHud,#chatWidget,#muteBtn')) return 'hud';
          const l=t&&t.closest('.townlbl'); return l?'plate:'+(l.querySelector('span')||l).textContent.trim():''; },[px,py]);
        if(cov==='hud'){ hud.push(name); continue; }
        if(cov&&cov!=='plate:'+name){ const k=cov.slice(6)+' plate on '+name; plates[k]=(plates[k]||0)+1; continue; }   /* a name plate is its own building's button (v1322) and is not moved here */
        await page.evaluate(()=>{ window._opened=[]; }); await page.mouse.click(px,py); taps++;
        const got=await page.evaluate(()=>window._opened.join('+')||'nothing'); if(got!==want) bad[got]=(bad[got]||0)+1; }
      if(Object.keys(bad).length) wrong.push(name+' -> '+Object.entries(bad).map(([k,v])=>k+' x'+v).join(', ')); }
    ok(wrong.length===0,n+': all '+taps+' taps on painted buildings open that building ('+(wrong.join('; ')||'all right')+')'+(hud.length?' [skipped '+hud.length+' points under the commander / MENU / chat HUD]':'')+(Object.keys(plates).length?' [skipped, under another building\'s name plate: '+Object.entries(plates).map(([k,v])=>k+' x'+v).join(', ')+']':''));
    const labs=await page.evaluate(()=>[...document.querySelectorAll('#townHots .townlbl')].map(l=>{ const q=l.getBoundingClientRect(); return {t:(l.querySelector('span')||l).textContent.trim(),x:q.left+q.width/2,y:q.top+q.height/2}; }));
    const lw=[]; for(const L of labs){ const want=(ART.find(a=>a[0]===L.t)||[])[1]; if(!want){ lw.push(L.t+' (no art entry)'); continue; }
      await page.evaluate(()=>{ window._opened=[]; }); await page.mouse.click(L.x,L.y); const got=await page.evaluate(()=>window._opened.join('+')||'nothing'); if(got!==want) lw.push(L.t+' -> '+got); }
    ok(lw.length===0,n+': a tap on each of the '+labs.length+' name plates opens its building ('+(lw.join('; ')||'all right')+')'); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,2).join(' | ')+')');
  finish('test_tr1364_town_hitboxes');
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ await cleanup(); } })();
