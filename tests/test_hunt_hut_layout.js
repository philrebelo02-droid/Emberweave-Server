// v1364 (tester A P10, 11 Nov): the close X on every menu and Vael's Play Voice icon sat ~1.9 px left of centre (.stIc margin-right in an icon-only button). Grok. CONTROL: EW_ROOT=<217ca0bf copy> must FAIL.
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
/* bonus stages: unlock heroes + clear the campaign far enough, open a stage's picker, and start the run */
async function bonusReady(page){ return page.evaluate(async()=>{ const ks=Object.keys(HERO_TYPES); const own=ks.slice(0,Math.max(10,ks.length-6));
  const a=await api('/api/admin/led-grant','POST',{unlock:own,campCleared:45,stamina:300}); if(typeof ledgerSync==='function') await ledgerSync(); return !!(a&&a.ok); }); }
async function openBonus(page,id){ await page.evaluate(()=>show('campaign')); await delay(600);
  await page.evaluate(id=>{ const [c,s]=id.split('-'); openBonusModal(+c,+s); },id);
  await page.waitForFunction(()=>document.querySelector('#gsplitPicker .gsplitHero'),null,{timeout:20000}); await delay(500); }
async function startBonus(page){
  await page.evaluate(()=>{ const a=document.getElementById('gsplitAuto'); if(a) a.click(); }); await delay(300);
  await page.evaluate(()=>{ const n=document.getElementById('gsplitNext'); if(n) n.click(); }); await delay(400);
  await page.evaluate(()=>{ const a=document.getElementById('gsplitAutoPlace'); if(a&&!a.disabled) a.click(); }); await delay(300);
  await page.evaluate(()=>{ const s=document.getElementById('gsplitStart'); if(s) s.click(); });
  await page.waitForFunction(()=>typeof GSPLIT!=='undefined'&&GSPLIT.active&&GSPLIT.lanes&&GSPLIT.lanes.length===3,null,{timeout:60000}); await delay(2500); }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
/* Witches Hut cauldron panel with several damaged heroes (the normal state after a war).
   (1) the gold frame is a 1800x1050 picture stretched to the panel (background 100% 100%), so a tall panel stretches its 270px border
       with it and the border runs over the brew line at the top and the last hero row at the bottom;
   (2) the reskin's ".panel>.row" column rule (meant for the action buttons) also hits every hero row, so icon / name / Heal stack in three lines.
   Frame thickness = the visible gold bar of dialog-frame.webp (measured: 86px top / 64px bottom of 1050), scaled by the CSS actually in force: a 9-slice border-image by its width/slice, a stretched picture by height/1050. */
(async()=>{ try{
  const {page,errs}=await boot(); const SH=process.env.SHOTS; if(SH) fs.mkdirSync(SH,{recursive:true});
  await page.evaluate(async()=>{ await api('/api/admin/led-grant','POST',{unlock:Object.keys(HERO_TYPES).slice(0,8)}); if(typeof ledgerSync==='function') await ledgerSync(); });
  const keys=await page.evaluate(()=>Object.keys(HERO_TYPES).slice(0,8)); let nHurt=8;
  await page.route('**/api/witch/state',async route=>{ const resp=await route.fetch(); const j=await resp.json(); const now=Date.now();
    j.heroes=keys.slice(0,nHurt).map((k,i)=>({key:k,power:123456+i*1111,hp:[0,150,4200,9999,7000,10,5000,3000][i],healCost:9876+i,returnAt:i%3===1?now+3723000:0}));
    await route.fulfill({response:resp,json:j}); });
  for(const n of [8,1]) for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ nHurt=n; await page.setViewportSize({width:w,height:h}); await delay(4500);   /* headless Chromium reports display-mode:fullscreen, so fold-viewport.js's v1243 swipe guard holds a shrink for 4 s */
    ok(await page.evaluate(([w,h])=>EWViewport.state.width===w&&EWViewport.state.height===h,[w,h]), nm+' '+n+' hurt: game frame is '+nm);
    await page.evaluate(()=>{ show('home'); renderHome(); document.querySelector('#townHots .hot[title="Witches Hut"] .hit').click(); });
    await page.waitForFunction(()=>/Hut Lv/.test(document.getElementById('wallBody')?.textContent||'')&&document.querySelector('#wallBody [data-witch-heal]'),null,{timeout:15000}); await delay(900);
    const m=await page.evaluate(()=>{ const p=document.querySelector('#wallBody [data-witch-all]').closest('.panel'), cs=getComputedStyle(p), r=p.getBoundingClientRect();
      let top,bot; if(cs.borderImageSource&&cs.borderImageSource!=='none'){ const bw=cs.borderImageWidth.split(' ').map(parseFloat), sl=parseFloat(cs.borderImageSlice)||270; top=bw[0]*86/sl; bot=(bw[2]!=null?bw[2]:bw[0])*64/sl; }
      else { top=r.height*86/1050; bot=r.height*64/1050; }
      const kids=[...p.children].filter(c=>c.getBoundingClientRect().height>0), first=Math.min(...kids.map(c=>c.getBoundingClientRect().top)), last=Math.max(...kids.map(c=>c.getBoundingClientRect().bottom));
      const rows=[...p.querySelectorAll('[data-witch-heal]')].map(b=>{ const row=b.parentElement, ic=row.firstElementChild.getBoundingClientRect(), br=b.getBoundingClientRect(); return {h:Math.round(row.getBoundingClientRect().height),sameLine:br.top<ic.bottom&&br.bottom>ic.top}; });
      return {ph:Math.round(r.height),frameTop:Math.round(top),frameBot:Math.round(bot),gapTop:Math.round(first-r.top),gapBot:Math.round(r.bottom-last),rows}; });
    const tag=nm+' '+n+' hurt';
    ok(m.gapTop>=m.frameTop&&m.gapBot>=m.frameBot, tag+': content inside the gold frame (panel '+m.ph+'px, frame '+m.frameTop+'/'+m.frameBot+'px, content starts '+m.gapTop+'px in, ends '+m.gapBot+'px from the bottom)');
    ok(m.rows.every(r=>r.sameLine), tag+': each hero row is one line - icon, name, Heal (row heights '+[...new Set(m.rows.map(r=>r.h))].join('/')+'px)');
    if(SH){ await page.screenshot({path:path.join(SH,'hut_'+nm+'_'+n+'_top.png')}); await page.evaluate(()=>[...document.querySelectorAll('[data-witch-heal]')].pop().scrollIntoView({block:'end'})); await delay(300); await page.screenshot({path:path.join(SH,'hut_'+nm+'_'+n+'_end.png')}); } }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('hut panel layout'); await cleanup(); } })();