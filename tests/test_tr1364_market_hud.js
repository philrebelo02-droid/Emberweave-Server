// v1364 (tester B 2.3, 11 Nov; v2 after Phil 11 Nov 08:51 "move right, near menu"): the food / gold / diamond counters covered the Market tents and its tap box.
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
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
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
(async()=>{ try{
  const {page,errs}=await boot();
  console.log('B 2.3 Market under the currency strip (v2: counters right, under MENU), root='+ROOT);
  for(const [w,h,n,tag] of [[844,390,'phone','phone'],[882,344,'Fold cover','fold'],[1440,800,'PC','pc']]){
    await page.setViewportSize({width:w,height:h}); await delay(500); await page.evaluate(()=>{ show('home'); try{ window.scrollTo(0,0); }catch(e){} }); await delay(1300);
    const r=await page.evaluate(()=>{ const R=e=>{ const q=e.getBoundingClientRect(); return {l:q.left,t:q.top,r:q.right,b:q.bottom,w:q.width,h:q.height}; };
      const X=(a,b)=>a.l<b.r-0.5&&a.r>b.l+0.5&&a.t<b.b-0.5&&a.b>b.t+0.5; const vis=e=>{ if(!e) return false; const c=getComputedStyle(e); const q=e.getBoundingClientRect(); return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>0&&q.width>0&&q.height>0; };
      const lab=[...document.querySelectorAll('#townHots .townlbl')].find(l=>l.dataset.nav==='market'); if(!lab) return null;
      const hot=[...document.querySelectorAll('#townHots .hot')].find(x=>x.title===lab.textContent.trim()); if(!hot) return null;
      const b=hot.getBoundingClientRect(); let n=0,cov=0; for(let x=b.left+2;x<b.right;x+=4) for(let y=b.top+2;y<b.bottom;y+=4){ n++; const t=document.elementFromPoint(x,y); if(t&&t.closest('#townHud,#leftHud,#cornerHud')) cov++; }
      /* each counter = its plate + its icon + its + button */
      const ctr=[...document.querySelectorAll('#townHud .resframe')].map(f=>{ const parts=[f,f.querySelector('.resicon'),f.querySelector('.resplus')].filter(Boolean).map(R);
        return {id:(f.querySelector('b')||{}).id, l:Math.min(...parts.map(p=>p.l)), t:Math.min(...parts.map(p=>p.t)), r:Math.max(...parts.map(p=>p.r)), b:Math.max(...parts.map(p=>p.b))}; });
      const art=R(hot), L=R(lab), menu=R(document.getElementById('menuBtn'));
      const hitArt=ctr.filter(c=>X(c,art)||X(c,L)).map(c=>c.id);
      const others=[...document.querySelectorAll('#townHots .townlbl'),document.getElementById('menuBtn'),document.getElementById('profileBtn'),document.getElementById('patBadge'),document.getElementById('pfLvBadge'),document.querySelector('#chatWidget .cw-head')].filter(vis);
      const hitOther=[]; for(const c of ctr) for(const o of others) if(X(c,R(o))) hitOther.push(c.id+'/'+(o.id||o.dataset.nav||o.className));
      const off=ctr.filter(c=>c.l<0||c.t<0||c.r>innerWidth||c.b>innerHeight).map(c=>c.id);
      const nearMenu=ctr.every(c=>c.l>art.r&&Math.abs(c.r-menu.r)<=40&&c.t>=menu.b-6&&c.t-menu.b<=140);
      return {cov:cov/n, hot:[b.left,b.top,b.right,b.bottom].map(Math.round), hitArt, hitOther, off, nearMenu, menu:[menu.l,menu.t,menu.r,menu.b].map(Math.round), ctr:ctr.map(c=>c.id+':'+[c.l,c.t,c.r,c.b].map(Math.round))}; });
    if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,'item1_'+tag+'.png')});
    ok(r&&r.cov===0,n+' '+w+'x'+h+': no part of the Market tap box lies under the counters or any HUD piece ('+(r?(r.cov*100).toFixed(1)+'% covered, box '+r.hot:'not found')+')');
    ok(r&&r.hitArt.length===0,n+': no counter overlaps the Market art / tap box or its name plate ('+(r?r.hitArt.join(',')||'none':'?')+')');
    ok(r&&r.nearMenu,n+': the counters sit to the right of the Market, under MENU, right edges in line with it (menu '+(r&&r.menu)+'; '+(r&&r.ctr.join(' '))+')');
    ok(r&&r.hitOther.length===0,n+': the counters cover no building name plate, MENU, Commander, EGP or the chat bar ('+(r?r.hitOther.join(',')||'none':'?')+')');
    ok(r&&r.off.length===0,n+': every counter (plate, icon, +) is fully on screen ('+(r?r.off.join(',')||'all on':'?')+')');
    /* the counters still work: a real tap on each + opens its shop; MENU still opens and its items are not under the counters */
    const plus=[]; for(const [id,kind] of [['staminaPlus','food'],['goldPlus','gold'],['gemPlus','gem']]){
      const p=await page.evaluate(id=>{ const e=document.getElementById(id); const q=e.getBoundingClientRect(); const x=q.left+q.width/2,y=q.top+q.height/2; const t=document.elementFromPoint(x,y); return {x,y,top:!!t&&(t===e||e.contains(t))}; },id);
      await page.mouse.click(p.x,p.y); await delay(450);
      const k=await page.evaluate(()=>{ const m=document.getElementById('hudShop'); const a=!!m&&m.classList.contains('active'); const kd=m&&m.dataset.kind; try{ closeHudShop(); }catch(e){} return a?kd:null; });
      plus.push(id+(p.top&&k===kind?' ok':' -> '+(p.top?'opened '+k:'covered'))); await delay(250); }
    ok(plus.every(s=>s.endsWith(' ok')),n+': tapping each + opens its shop (food / gold / diamonds) ('+plus.join(', ')+')');
    const mb=await page.evaluate(()=>{ const q=document.getElementById('menuBtn').getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}; });
    await page.mouse.click(mb.x,mb.y); await delay(500);
    const mi=await page.evaluate(()=>{ const items=[...document.querySelectorAll('#menuPanel .mitem')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height>0);
      const bad=items.filter(e=>{ const q=e.getBoundingClientRect(); const t=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2); return !(t&&e.contains(t)); }).map(e=>e.dataset.nav||e.id);
      return {n:items.length,bad}; });
    if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,'item1_'+tag+'_menu.png')});
    await page.mouse.click(mb.x,mb.y); await delay(400); await page.evaluate(()=>{ const p=document.getElementById('menuPanel'); if(p) p.classList.remove('open'); });
    ok(mi.n>0&&mi.bad.length===0,n+': MENU opens and none of its '+mi.n+' items is under the counters ('+(mi.bad.join(',')||'all clear')+')'); }
  /* the numbers still follow the account */
  const g=await page.evaluate(async()=>{ const before=document.getElementById('resGold').textContent; await api('/api/admin/led-grant','POST',{gold:1234}); if(typeof ledgerSync==='function') await ledgerSync(); await new Promise(r=>setTimeout(r,400));
    const t=document.getElementById('resGold').textContent, d=document.getElementById('resGems').textContent; return {before,t,gold:G.gold,d,gems:G.gems}; });
  ok(g.t.replace(/\D/g,'')===String(g.gold)&&g.t!==g.before&&g.d.replace(/\D/g,'')===String(g.gems),'the gold and diamond counters show the account after a +1234 gold grant ('+g.before+' -> '+g.t+' = G.gold '+g.gold+'; diamonds '+g.d+' = '+g.gems+')');
  ok(errs.length===0,'no page errors ('+errs.slice(0,2).join(' | ')+')');
  finish('test_tr1364_market_hud');
}catch(e){ console.error('FAIL',e); process.exitCode=1; } finally{ await cleanup(); } })();
