// v1376 VAULT FLOOR DESCRIPTION (Phil 12 Nov 2026: "Make a Floor enemy button on the top. I feel like that reward button is for nothing. Also can merge the
// floor enemy and boss buff info into 1 Floor Description button. That has a full layout of the monsters, boss, what buff the boss receives" /
// "I dont want the enemy just sitting there, make it a pop out").
//   A. the Vault top bar has exactly "Floor Description" + "Floor N / 100" - no reward pill, no boss-buff pill; no enemy panel on the screen itself
//   B. the window lists every monster of both waves of floor 10 (boss) and floor 11 (normal) = the server's buildDungeonWaves (/api/dungeon/status
//      waves, the same lineup /api/dungeon/start-battle hands the fight); the boss chip is marked; the boss section (boss name + buff name + what
//      it does + "first clear pays the package twice") only on the boss floor; the reward + rules lines are there
//   C. a chip opens the enemy card above the window (double tap + mouse hover)
//   D. the window is inside the screen (OK reachable) at 844x390 and 1440x900; no page errors
// SHOTS=<dir> saves screenshots. CONTROL: EW_ROOT=<a 83970b8f copy> must FAIL.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const SHOTS=process.env.SHOTS?path.resolve(process.env.SHOTS):null; if(SHOTS) fs.mkdirSync(SHOTS,{recursive:true});
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-vfd1376-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
const shot=async(page,name)=>{ if(SHOTS) await page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{}); };
async function boot(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',SIM_WORKERS:'0'};
  const up=async()=>{for(let i=0;i<300;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'vf'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {page,errs,base}; }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
/* the boss buff of a floor, worked out here (not read off the page): every 5th floor is a boss floor, the rules cycle */
const RULES=['stoneguard_barrier','bloodfire_enrage','broodcall','riftblade_leap','blight_aura','storm_chain','ironwall_challenge','voidstep','cinderbrand','vault_warden'];
const buffName=f=>f%5?null:RULES[(f/5-1)%RULES.length].replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
(async()=>{ try{
  const {page,errs}=await boot();
  await page.evaluate(async()=>{ const ks=Object.keys(HERO_TYPES); await api('/api/admin/led-grant','POST',{unlock:ks,campCleared:45,stamina:300}); if(typeof ledgerSync==='function') await ledgerSync(); });
  for(const [nm,w,h] of [['phone',844,390],['pc',1440,900]]){ await page.setViewportSize({width:w,height:h});
    await page.waitForFunction(([w,h])=>document.body.offsetWidth===w&&document.body.offsetHeight===h,[w,h],{timeout:8000}).catch(()=>{}); await delay(600);
    for(const floor of [10,11]){
      const truth=await page.evaluate(async f=>{ await api('/api/dungeon/dev-floor','POST',{floor:f,requestId:uid8()}); const s=await api('/api/dungeon/status');
        return { floor:s.currentFloor, isBoss:!!s.isBoss, warn:(s.bossRule&&s.bossRule.warn)||'', waves:(s.waves||[]).map(w=>[...new Set(w.map(m=>m.key))].map(k=>({k,name:mcardName(k),boss:w.some(m=>m.key===k&&m.boss)}))) }; },floor);
      ok(truth.floor===floor&&truth.waves.length===2, nm+' floor '+floor+': the server floor has 2 waves ('+truth.waves.length+')');
      await page.evaluate(()=>{ try{ ftutMark('dungeon'); }catch(e){} VAULT.st=null; show('dungeon'); }); await page.waitForFunction(()=>document.querySelector('#dungeon .vtStats'),null,{timeout:20000}).catch(()=>{}); await delay(1200);
      /* A. the top bar */
      const bar=await page.evaluate(()=>{ const vis=e=>{ const r=e.getBoundingClientRect(), cs=getComputedStyle(e); return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'; };
        const pills=[...document.querySelectorAll('#dungeon .vtStats>div')].filter(vis).map(e=>e.innerText.replace(/\s+/g,' ').trim());
        return { pills, foes:!!document.querySelector('#dungeon .vtFoes'), chips:document.querySelectorAll('#dungeon [data-mc]').length }; });
      ok(bar.pills.length===2&&/Floor Description/.test(bar.pills[0])&&bar.pills[1]===('Floor '+floor+' / 100'), nm+' floor '+floor+': top bar = Floor Description + Floor '+floor+' / 100 ('+JSON.stringify(bar.pills)+')');
      ok(!bar.pills.some(p=>/glyph|^\d+$|\d+\s*\+2/.test(p))&&(!buffName(floor)||!bar.pills.some(p=>p.includes(buffName(floor)))), nm+' floor '+floor+': no reward pill, no boss-buff pill');
      ok(!bar.foes&&bar.chips===0, nm+' floor '+floor+': no enemy panel on the Vault screen (panel '+bar.foes+', chips '+bar.chips+')');
      if(floor===10) await shot(page,'vault-screen-'+nm);
      /* B. the window */
      await page.evaluate(()=>{ const b=document.querySelector('#dungeon .vtStats .vtInfo'); if(b) b.click(); }); await delay(700);
      const win=await page.evaluate(()=>{ const ov=document.getElementById('vtInfoPop'); if(!ov) return null; const c=ov.querySelector('.viCard'), r=c.getBoundingClientRect();
        const waves=[...ov.querySelectorAll('.smWave')].map(wv=>[...wv.querySelectorAll('[data-mc]')].map(ch=>({name:ch.querySelector('b').textContent,boss:ch.classList.contains('smBoss'),mc:ch.dataset.mc})));
        const boss=ov.querySelector('.vfd-boss'); const go=ov.querySelector('.viGo'); c.scrollTop=1e6; const gr=go.getBoundingClientRect();
        return { title:(ov.querySelector('.viTitle')||{}).textContent, text:c.innerText.replace(/\s+/g,' '), waves, boss:boss?{name:boss.querySelector('.viName').textContent.trim(),who:boss.querySelector('.vfd-who').textContent,warn:boss.querySelector('.viWarn').textContent}:null,
          box:{l:r.left,t:r.top,r:r.right,b:r.bottom}, go:{t:gr.top,b:gr.bottom}, vw:innerWidth, vh:innerHeight }; });
      ok(!!win&&win.title==='Floor Description', nm+' floor '+floor+': Floor Description opens its window ('+(win&&win.title)+')');
      if(!win){ await shot(page,'vfd-missing-'+nm+'-'+floor); continue; }
      ok(win.text.includes('Floor '+floor+' / 100'), nm+' floor '+floor+': the window names the floor');
      const same=win.waves.length===2&&truth.waves.every((tw,i)=>tw.length===win.waves[i].length&&tw.every((m,j)=>win.waves[i][j].name===m.name&&win.waves[i][j].boss===m.boss));
      ok(same, nm+' floor '+floor+': both waves list every monster of the floor ('+win.waves.map(w=>w.map(m=>m.name+(m.boss?'*':'')).join(',')).join(' | ')+' vs server '+truth.waves.map(w=>w.map(m=>m.name+(m.boss?'*':'')).join(',')).join(' | ')+')');
      if(truth.isBoss){ const bm=truth.waves.flat().find(m=>m.boss);
        ok(!!win.boss&&win.boss.name.includes(buffName(floor))&&win.boss.warn===truth.warn&&!!truth.warn, nm+' floor '+floor+': boss section with the buff '+buffName(floor)+' and what it does ('+(win.boss?win.boss.name+' / '+win.boss.warn:'none')+')');
        ok(!!bm&&!!win.boss&&win.boss.who.includes(bm.name), nm+' floor '+floor+': the boss is named ('+(win.boss&&win.boss.who)+')');
        ok(win.text.includes('first clear pays the package twice'), nm+' floor '+floor+': the boss-floor line is there'); }
      else ok(!win.boss&&!win.text.includes('package twice'), nm+' floor '+floor+': no boss section on a normal floor');
      ok(/Two waves per floor/.test(win.text)&&/same/.test(win.text), nm+' floor '+floor+': the floor rules line is there');
      ok(win.box.l>=0&&win.box.t>=0&&win.box.r<=win.vw+0.5&&win.box.b<=win.vh+0.5, nm+' floor '+floor+': the window is inside the screen ('+JSON.stringify(win.box)+' in '+win.vw+'x'+win.vh+')');
      ok(win.go.b<=win.vh+0.5&&win.go.t>=0, nm+' floor '+floor+': OK reachable');
      await page.evaluate(()=>{ const c=document.querySelector('#vtInfoPop .viCard'); if(c) c.scrollTop=0; }); await delay(300);
      if(floor===10) await shot(page,'vfd-window-'+nm);
      /* C. a chip opens the enemy card, on top of the window */
      const cardTop=async()=>page.evaluate(()=>{ const c=document.querySelector('#mcLayer .mcCard'); if(!c) return null; const r=c.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return { name:c.querySelector('.mcName').textContent, top:!!(e&&c.contains(e)), inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+0.5&&r.bottom<=innerHeight+0.5 }; });
      await page.evaluate(()=>{ const all=[...document.querySelectorAll('#vtInfoPop [data-mc]')]; const c=all.find(x=>x.classList.contains('smBoss'))||all[all.length-1]; c.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); }); await delay(500);
      let card=await cardTop(); const want=(truth.waves.flat().find(m=>m.boss)||truth.waves[1][truth.waves[1].length-1]).name;
      ok(!!card&&card.top&&card.inside&&card.name===want, nm+' floor '+floor+': double-tapping a chip opens its enemy card above the window ('+(card?card.name+' top '+card.top+' inside '+card.inside:'none')+')');
      if(floor===10) await shot(page,'vfd-card-'+nm);
      await page.evaluate(()=>mcardClose()); await delay(200);
      const hb=await page.evaluate(()=>{ const c=document.querySelector('#vtInfoPop .smWave [data-mc]'); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,name:c.querySelector('b').textContent}; });
      await page.mouse.move(hb.x,hb.y); await delay(500); card=await cardTop();
      ok(!!card&&card.name===hb.name, nm+' floor '+floor+': hovering a chip opens its card ('+(card&&card.name)+')');
      await page.mouse.move(2,2); await delay(400);
      await page.evaluate(()=>{ try{ mcardClose(); }catch(e){} const g=document.querySelector('#vtInfoPop .viGo'); if(g) g.click(); }); await delay(300);
      ok(!(await page.evaluate(()=>document.getElementById('vtInfoPop'))), nm+' floor '+floor+': OK closes the window');
    }
  }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('vault floor description'); await cleanup(); } })();
