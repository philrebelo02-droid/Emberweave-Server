// v1368 (v2: repaint keeps the original end time; a completed hold is not a tap - ChatGPT's review 12:45/12:55; v3: a tap after a repaint gets its own time, 13:36) (tester A P7/P8 - town name plates; Claude 11 Nov: "a tap on a locked plate acts like a tap on the lock; a tap on an open plate opens the
// building; plates stay where they are"). A level-1 account on a throwaway server; the town at 844x390 and 882x344 (touch) and 1440x800 (mouse).
// Every plate is tapped on its NAME (not the padlock): a locked one must show 'Unlocks at Lv N' (and keep it up long enough to read), an open one
// must open its building. The padlock itself is tapped too (what the plate must now match). Grok. Real page, real input events.
// CONTROL: run with EW_ROOT=<HEAD copy> - it must FAIL. OUT=<file> writes every plate's position + result as JSON; SHOTS=<dir> writes screenshots.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1368p-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0; const notes=[];
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
async function server(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  try{browser=await chromium.launch({args:['--mute-audio','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});}
  return {base,port}; }
async function account(base){ const r=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'pl'+Date.now().toString(36)+Math.floor(Math.random()*1e4),pass:'password1'})})).json(); return {token:r.token,id:r.profile.id}; }
async function openPage(base,L,w,h,touch){ const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,hasTouch:touch,isMobile:touch,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await home(page); return {ctx,page,errs}; }
async function home(page){ await page.evaluate(()=>{ document.querySelectorAll('.modal,.overlayModal').forEach(m=>{ if(m.classList.contains('show')) m.classList.remove('show'); }); show('home'); }); await delay(1200); }
/* scroll the town so plate i is centred, then return the tap points on its name and on its padlock (null when something else is on top) */
const aim=(page,i)=>page.evaluate(i=>{ const lab=document.querySelectorAll('#townHots .townlbl')[i], wrap=document.getElementById('townWrap'); if(!lab||!wrap) return null;
  let r=lab.getBoundingClientRect(), b=wrap.getBoundingClientRect(); wrap.scrollLeft+= (r.left+r.width/2)-(b.left+b.width/2); wrap.scrollTop+=(r.top+r.height/2)-(b.top+b.height/2);
  const nm=lab.querySelector('span'), lk=lab.querySelector('.lockwrap:not(.acatimer) .lkIc'); const c=e=>{ if(!e) return null; const q=e.getBoundingClientRect(); const x=q.left+q.width/2, y=q.top+q.height/2; const top=document.elementFromPoint(x,y); return {x,y,top:!!(top&&lab.contains(top)), on:top?(top.id||top.className||top.tagName).toString().slice(0,40):null}; };
  return {name:c(nm), lock:c(lk)}; },i);
const tipUp=(page,i)=>page.evaluate(i=>{ const lab=document.querySelectorAll('#townHots .townlbl')[i], t=lab&&lab.querySelector('.lockwrap:not(.acatimer) .locktip'); if(!t) return null; const cs=getComputedStyle(t), r=t.getBoundingClientRect(); return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0?t.textContent:''; },i);
(async()=>{ const OUT=process.env.OUT, SHOTS=process.env.SHOTS, R=[]; try{
  const {base}=await server();
  for(const [w,h,n,touch] of [[844,390,'phone',true],[882,344,'Fold cover',true],[1440,800,'PC',false]]){
    console.log('-- '+n+' '+w+'x'+h+(touch?' (touch)':' (mouse)'));
    const L=await account(base); const {ctx,page,errs}=await openPage(base,L,w,h,touch);
    const tap=async(x,y)=>{ if(touch) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y); };
    const plates=await page.evaluate(()=>[...document.querySelectorAll('#townHots .townlbl')].map(l=>({label:l.querySelector('span').textContent, nav:l.dataset.nav, locked:!!l.querySelector('.lockwrap:not(.acatimer)'), left:l.style.left, top:l.style.top})));
    const lv=await page.evaluate(()=>playerLevel());
    if(SHOTS){ fs.mkdirSync(SHOTS,{recursive:true}); await page.screenshot({path:path.join(SHOTS,n.replace(/ /g,'_')+'_town.png')}); }
    ok(lv<10&&plates.filter(p=>p.locked).length>=5&&plates.filter(p=>!p.locked).length>=3, n+': level '+lv+' town has '+plates.filter(p=>p.locked).length+' locked and '+plates.filter(p=>!p.locked).length+' open plates');
    let lockedTapOk=0, lockedTot=0, lockedHeld=0, padOk=0, padTot=0, openOk=0, openTot=0; const bad=[];
    for(let i=0;i<plates.length;i++){ const p=plates[i]; const a=await aim(page,i); await delay(250);
      const a2=await aim(page,i); const r=Object.assign({},p,{size:n});
      if(!a2||!a2.name){ notes.push(n+' '+p.label+': no plate on screen'); continue; }
      if(!a2.name.top){ notes.push(n+' '+p.label+': the name is under '+a2.name.on+' - not tapped'); r.covered=a2.name.on; R.push(r); continue; }
      if(p.locked){ lockedTot++;
        await tap(a2.name.x,a2.name.y); await delay(200); const t1=await tipUp(page,i); const st=await page.evaluate(()=>state);
        if(SHOTS&&lockedTot===1) await page.screenshot({path:path.join(SHOTS,n.replace(/ /g,'_')+'_locked_name_tap.png')});
        await delay(1500); const t2=await tipUp(page,i);
        r.nameTap=t1; r.after1700=t2; r.state=st; if(t1&&/\d/.test(t1)&&st==='home') lockedTapOk++; else bad.push(p.label+' name tap: '+JSON.stringify(t1)); if(t2) lockedHeld++;
        await delay(2600);   // let it hide
        if(a2.lock&&a2.lock.top){ padTot++; await tap(a2.lock.x,a2.lock.y); await delay(200); const t3=await tipUp(page,i); r.lockTap=t3; if(t3&&/\d/.test(t3)) padOk++; else bad.push(p.label+' padlock tap: '+JSON.stringify(t3));
          if(!touch) await page.mouse.move(w/2,2); await delay(2600); await home(page); }   // (no tap to clear it: a corner tap opens the Chat bar)
      } else { openTot++;
        await tap(a2.name.x,a2.name.y); await delay(1200); const st=await page.evaluate(()=>state); const wellUp=await page.evaluate(()=>!!document.querySelector('#wellModal.show,.wellModal.show'));
        const want=p.nav==='cauldron'?'wall':p.nav; r.state=st; if(st===want||(p.nav==='well'&&wellUp)) openOk++; else bad.push(p.label+' opened '+st+' (want '+want+')');
        await home(page); }
      R.push(r); }
    ok(lockedTot>0&&lockedTapOk===lockedTot, n+': a tap on the NAME of a locked plate shows its unlock level ('+lockedTapOk+'/'+lockedTot+')');
    ok(lockedTot>0&&lockedHeld===lockedTot, n+': and it stays up long enough to read (still shown 1.7 s after the tap: '+lockedHeld+'/'+lockedTot+')');
    ok(padTot>0&&padOk===padTot, n+': a tap on the padlock shows it too ('+padOk+'/'+padTot+')');
    ok(openTot>0&&openOk===openTot, n+': a tap on the name of an open plate opens that building ('+openOk+'/'+openTot+')');
    { const li=plates.findIndex(p=>p.locked); const a3=await aim(page,li); await delay(250); const a4=await aim(page,li);
      if(a4&&a4.name&&a4.name.top){ await tap(a4.name.x,a4.name.y); const T0=Date.now(); const until=async ms=>{ const d=ms-(Date.now()-T0); if(d>0) await delay(d); };
        await until(250); await page.evaluate(()=>renderHome()); await until(550); const t=await tipUp(page,li);   // the repaint a ledger sync does while the town is open
        ok(!!t, n+': a level tip that is showing survives a town repaint (ledger sync) ('+JSON.stringify(t)+')');
        await until(1200); await page.evaluate(()=>renderHome()); await until(1700); const tB=await tipUp(page,li); await until(2650); const tC=await tipUp(page,li);
        ok(!!tB&&!tC, n+': two repaints keep the tip to its ORIGINAL end (up at 1.7 s: '+JSON.stringify(tB)+'; gone by 2.65 s after the tap: '+JSON.stringify(tC)+')');
        await delay(1500); await home(page); } else { ok(false, n+': could not reach a locked plate for the repaint check'); ok(false, n+': (repaint expiry not checked)'); } }
    { const li=plates.findIndex(p=>p.locked); await aim(page,li); await delay(250); const a6=await aim(page,li);   // v3 (ChatGPT 13:36): tap -> repaint -> tap again before the first tip's end
      if(a6&&a6.name&&a6.name.top){ await tap(a6.name.x,a6.name.y); const T0=Date.now(); const until=async ms=>{ const d=ms-(Date.now()-T0); if(d>0) await delay(d); };
        await until(250); await page.evaluate(()=>renderHome()); await until(1000); await tap(a6.name.x,a6.name.y);   // the first tip would end at 2.2 s
        await until(2700); const tD=await tipUp(page,li); await until(3650); const tE=await tipUp(page,li); const dbg=await page.evaluate(([i,x,y])=>{ const lab=document.querySelectorAll('#townHots .townlbl')[i], w=lab.querySelector('.lockwrap'), r=w.getBoundingClientRect(), el=document.elementFromPoint(x,y); return {show:w.classList.contains('show'), hover:w.matches(':hover'), labHover:lab.matches(':hover'), tapOnWrap:x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom, wrap:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], at:[x,y], hit:el&&el.className, until:lab._tipUntil-Date.now()}; },[li,a6.name.x,a6.name.y]);
        ok(!!tD&&!tE, n+': tap, repaint, tap again: the second tap gets its own 2.2 s (up at 2.7 s: '+JSON.stringify(tD)+'; gone by 3.65 s: '+JSON.stringify(tE)+') '+JSON.stringify(dbg));
        await delay(1500); await home(page); } else ok(false, n+': could not reach a locked plate for the re-tap check'); }
    if(!touch){ const li=plates.findIndex(p=>p.locked); await aim(page,li); await delay(250); const a5=await aim(page,li);   // a completed HOLD keeps its 1.4 s hide (test_town_lock_hold)
      if(a5&&a5.name&&a5.name.top){ await page.mouse.move(a5.name.x,a5.name.y); await page.mouse.down(); await delay(700); const th=await tipUp(page,li); await page.mouse.up(); await delay(1700); const tg=await tipUp(page,li);
        ok(!!th&&!tg, n+': a completed hold shows the level and hides 1.4 s after letting go, not 2.2 s (held: '+JSON.stringify(th)+'; 1.7 s after release: '+JSON.stringify(tg)+')'); await page.mouse.move(w/2,2); await delay(1500); await home(page); }
      else ok(false, n+': could not reach a locked plate for the hold check'); }
    const after=await page.evaluate(()=>[...document.querySelectorAll('#townHots .townlbl')].map(l=>l.style.left+','+l.style.top).join(' '));
    ok(after===plates.map(p=>p.left+','+p.top).join(' '), n+': no plate moved');
    ok(errs.length===0, n+': no page errors ('+errs.length+(errs.length?': '+errs[0]:'')+')');
    if(bad.length) console.log('      '+bad.join('\n      '));
    await ctx.close(); }
  if(notes.length) console.log('  notes:\n    '+notes.join('\n    '));
  if(OUT) fs.writeFileSync(OUT,JSON.stringify(R,null,1));
}catch(e){ console.error('  FAIL (crashed)',e); fails++; } finally{ console.log('test_tr1364_town_plates.js: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
