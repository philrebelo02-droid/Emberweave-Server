// v1368 (tester B 4.6 - "Standardize boss warnings and a top boss health bar"; Claude 11 Nov: "a stylized ribbon with the boss portrait and a large boss
// HP bar at the top, display only"). Stage 1-10 (Brukk, the chapter 1 boss) on a throwaway server at 844x390, 882x344 and 1440x800. The waves before the
// boss are ended from the test page (dealDamage) - the check is the boss wave's DISPLAY. On the boss wave: the ribbon shows with the boss's portrait art,
// name and cue, does not take taps; the large HP bar sits under the wave timer clear of the HUD buttons, reads 100%, follows a hit (half HP -> ~50%)
// and is gone once the boss dies. Grok. CONTROL: EW_ROOT=<HEAD copy> must FAIL. SHOTS=<dir> writes screenshots; OUT=<file> the measurements.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1368b-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
async function server(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'bo'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  const g=await J('/api/admin/led-grant',{campCleared:9,px:2000000,gold:1000000},L.token); if(g&&g.error) console.log('  (grant said: '+g.error+')');
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  return {base,L}; }
async function openPage(base,L,w,h){ const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await page.evaluate(()=>show('home')); await delay(1500); return {ctx,page,errs}; }
const rectOf=(page,sel)=>page.evaluate(sel=>{ const e=document.querySelector(sel); if(!e) return null; const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden') return null; const r=e.getBoundingClientRect(); return r.width>0?{x:r.left,y:r.top,w:r.width,h:r.height}:null; },sel);
const overlap=(a,b)=>a&&b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
(async()=>{ const SHOTS=process.env.SHOTS, OUT=process.env.OUT, R=[]; if(SHOTS) fs.mkdirSync(SHOTS,{recursive:true}); try{
  const {base,L}=await server();
  for(const [w,h,n] of [[844,390,'phone'],[882,344,'Fold cover'],[1440,800,'PC']]){
    console.log('-- '+n+' '+w+'x'+h); const tag=n.replace(/ /g,'_'); const M={size:n};
    const {ctx,page,errs}=await openPage(base,L,w,h);
    await page.evaluate(()=>{ show('campaign'); openStageModal(10,'normal'); });
    await page.waitForFunction(()=>{ const b=document.getElementById('smBattle'); return b&&!b.disabled&&b.offsetParent; },null,{timeout:20000});
    await page.evaluate(()=>document.getElementById('smBattle').click()); await page.waitForFunction(()=>state==='menu',null,{timeout:20000}); await delay(500);
    await page.evaluate(()=>document.getElementById('startBtn').click());
    await page.waitForFunction(()=>state==='battle'&&typeof units!=='undefined'&&units.some(u=>u.team==='enemy'),null,{timeout:60000});
    M.boss=await page.evaluate(()=>isBossStage(CUR.node)); M.waves=await page.evaluate(()=>chapterWaves);
    // end the waves before the boss from the test page, then wait for the boss wave
    let ribbon=null, ribAt=null; const t0=Date.now();
    while(Date.now()-t0<90000){ const st=await page.evaluate(()=>({wave:waveIdx, last:chapterWaves-1, boss:units.some(u=>u.team==='enemy'&&u.alive&&u.boss), ended}));
      if(st.ended) break;
      if(st.wave<st.last){ await page.evaluate(()=>{ const a=units.find(u=>u.team==='ally'&&u.alive); units.filter(u=>u.team==='enemy'&&u.alive).forEach(e=>{ try{ dealDamage(a,e,1e9,null,null,true); }catch(_){ e.hp=0; } }); }); await delay(300); continue; }
      ribbon=await rectOf(page,'#bossRibbon.show'); if(ribbon){ ribAt=Date.now(); break; } await delay(100); }
    M.ribbon=ribbon;
    ok(M.boss&&!!ribbon, n+': the boss wave opens with the ribbon across the field ('+(ribbon?Math.round(ribbon.w)+'x'+Math.round(ribbon.h)+' at y '+Math.round(ribbon.y):'none')+')');
    let rib={};
    if(ribbon){ await delay(450); if(SHOTS) await page.screenshot({path:path.join(SHOTS,tag+'_1_ribbon.png')});
      rib=await page.evaluate(()=>{ const r=document.getElementById('bossRibbon'), p=r.querySelector('.brPort'), pr=p.getBoundingClientRect(), rr=r.getBoundingClientRect(); const cx=rr.left+rr.width/2, cy=rr.top+rr.height/2; const top=document.elementFromPoint(cx,cy);
        return {name:r.querySelector('.brName').textContent.trim(), cue:r.querySelector('.brCue').textContent.trim(), warn:r.querySelector('.brWarn').textContent.trim(), art:getComputedStyle(p).backgroundImage, port:[Math.round(pr.width),Math.round(pr.height)], tapThrough:!(top&&r.contains(top)), pe:getComputedStyle(r).pointerEvents,
          nameOver:(()=>{ const e=r.querySelector('.brName'); return e.scrollWidth>e.clientWidth+1; })(), bossName:(units.find(u=>u.team==='enemy'&&u.boss)||{t:{}}).t.name }; });
      M.rib=rib;
      ok(/url\(/.test(rib.art)&&rib.port[0]>=40, n+': the ribbon carries the boss portrait art ('+rib.port.join('x')+' px, '+(rib.art.match(/[^/"]+\.(webp|png|jpg)/)||['none'])[0]+')');
      ok(rib.name.indexOf(rib.bossName)>=0&&rib.cue.length>10&&/BOSS/i.test(rib.warn), n+': name "'+rib.name+'", the warning and the cue are on it');
      ok(!rib.nameOver, n+': the boss name fits on the ribbon');
      ok(rib.tapThrough&&rib.pe==='none', n+': the ribbon does not take taps (an ult drag passes through)');
      await page.waitForFunction(()=>!document.querySelector('#bossRibbon.show'),null,{timeout:6000}).catch(()=>{}); M.ribbonSecs=+((Date.now()-ribAt)/1000).toFixed(1);
      ok(M.ribbonSecs<=3.5, n+': and it leaves on its own ('+M.ribbonSecs+' s)'); }
    else { for(let k=0;k<5;k++) ok(false, n+': (no ribbon - ribbon checks not run)'); }
    // the top bar
    await page.waitForFunction(()=>state==='battle'&&units.some(u=>u.team==='enemy'&&u.boss&&u.alive),null,{timeout:15000}).catch(()=>{});
    const bar=await rectOf(page,'#bossTopBar.on'), hud=await rectOf(page,'#battleBanner'), ctrls=await rectOf(page,'#battleCtrls'), pause=await rectOf(page,'#pauseBtn'), speed=await rectOf(page,'#speedBtn'), auto=await rectOf(page,'#autoBtn');
    M.bar=bar; M.hud=hud; const pct0=await page.evaluate(()=>{ const e=document.querySelector('#bossTopBar .btPct'); return e?e.textContent:null; });
    ok(!!bar&&bar.w>=Math.min(0.4*w,300)&&pct0==='100%', n+': a large boss HP bar is up ('+(bar?Math.round(bar.w)+'x'+Math.round(bar.h)+' at y '+Math.round(bar.y):'none')+', reads '+pct0+')');
    ok(!!bar&&hud&&bar.y>=hud.y+hud.h-1&&!overlap(bar,pause)&&!overlap(bar,speed)&&!overlap(bar,auto)&&!overlap(bar,ctrls), n+': under the wave timer (timer bottom '+(hud?Math.round(hud.y+hud.h):'?')+') and clear of pause / speed / AUTO');
    if(SHOTS) await page.screenshot({path:path.join(SHOTS,tag+'_2_bar_full.png')});
    await page.evaluate(()=>{ const b=units.find(u=>u.team==='enemy'&&u.boss&&u.alive), a=units.find(u=>u.team==='ally'&&u.alive); if(b){ b.hp=Math.max(1,Math.round(b.maxHp*0.5)); } }); await delay(900);
    const pct1=await page.evaluate(()=>{ const e=document.querySelector('#bossTopBar .btPct'), f=document.querySelector('#bossTopBar .btFill'), b=units.find(u=>u.team==='enemy'&&u.boss&&u.alive); return {txt:e&&e.textContent, fill:f&&f.style.width, real:b?Math.round(100*b.hp/b.maxHp):null}; });
    M.half=pct1; if(SHOTS) await page.screenshot({path:path.join(SHOTS,tag+'_3_bar_hit.png')});
    ok(pct1.real!=null&&Math.abs(parseInt(pct1.txt)-pct1.real)<=1&&Math.abs(parseFloat(pct1.fill)-pct1.real)<=1.5, n+': the bar follows the boss HP (boss at '+pct1.real+'%, bar '+pct1.txt+', fill '+pct1.fill+')');
    await page.evaluate(()=>{ const a=units.find(u=>u.team==='ally'&&u.alive); units.filter(u=>u.team==='enemy'&&u.alive).forEach(e=>{ try{ dealDamage(a,e,1e9,null,null,true); }catch(_){ e.hp=0; } }); }); await delay(1500);
    const gone=!(await rectOf(page,'#bossTopBar.on'));
    ok(gone, n+': the bar is gone once the boss is dead');
    ok(errs.length===0, n+': no page errors ('+errs.length+(errs.length?': '+errs[0]:'')+')');
    R.push(M); await ctx.close(); }
  if(OUT) fs.writeFileSync(OUT,JSON.stringify(R,null,1));
}catch(e){ console.error('  FAIL (crashed)',e); fails++; } finally{ console.log('test_tr1364_boss_ribbon.js: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
