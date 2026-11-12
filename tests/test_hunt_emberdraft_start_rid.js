const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-edhunt-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
async function boot(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const accs=[]; for(let i=0;i<3;i++){ const reg=await J('/api/register',{name:'ed'+i+Date.now().toString(36),pass:'password1'}); accs.push({token:reg.token,id:reg.profile.id}); } const L=accs[0];
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:accs.map(a=>a.id).join(',')},stdio:'ignore',windowsHide:true}); await up();
  /* one fresh account per screen size (9 attempts each after both packs), so a size never runs out of attempts */
  for(const a of accs){ await J('/api/admin/led-grant',{px:99000000,gold:5000000,gems:200000},a.token); for(const r of ['buyA1','buyA2']) await J('/api/emberdraft/buy',{requestId:r+Date.now().toString(36)},a.token); }
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const ctx=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {page,errs,J,L,accs}; }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
/* Grok bug hunt 12 Nov - Emberdraft (bots): the lobby's Solo start kept its requestId on the lobby element (ov._startReq). The Island
   button (#edX) removes the lobby and openEmberdraft() builds a new one, so the id was lost:
   A) the start reply is lost (offline / timeout) after the server spent the attempt -> the player goes back and reopens -> Solo sends a
      NEW id -> a SECOND attempt is spent, and the first match can never be played (it is not the one the client holds).
   (The Island button is already blocked while a start is in flight - v646 - so only a reply that is LOST, not late, reaches this.)
   The buy button already keeps its id across a reopen (ED_BUY_RID, 3 Oct audit). Main must FAIL (2 attempts spent, 2 different ids);
   patched must PASS (the same id is re-sent, the server answers with the same match, 1 attempt spent, that match is played). */
const used=async(page)=>page.evaluate(async()=>{ const d=await api('/api/emberdraft/state','POST',{}); return d&&d.edraft?d.edraft.used|0:-1; });
const openLobby=async(page)=>{ await page.evaluate(()=>{ try{ if(typeof edTeardown==='function'&&ED&&ED.active) edTeardown(); }catch(e){} openEmberdraft(); });
  for(let i=0;i<40;i++){ const r=await page.evaluate(()=>{ const s=document.querySelector('#edLobby #edSolo'); return !!s&&!s.disabled; }); if(r) return true; await delay(250); } return false; };
const tapSolo=page=>page.evaluate(()=>{ const s=document.querySelector('#edLobby #edSolo'); if(s) s.click(); });
const tapBack=page=>page.evaluate(()=>{ const b=document.querySelector('#edLobby #edX'); if(b) b.click(); else { const ov=document.getElementById('edLobby'); if(ov) ov.remove(); } });
const matchOn=page=>page.evaluate(()=>({active:!!(ED&&ED.active), att:(ED&&ED.attemptId)||null}));
async function caseRun(page,label,mode){
  const ids=[], atts=[]; let first=true;
  await page.route('**/api/emberdraft/start',async route=>{ let rid=null; try{ rid=JSON.parse(route.request().postData()||'{}').requestId; }catch(e){} ids.push(rid);
    if(first){ first=false;
      if(mode==='lost'){ const r=await route.fetch(); try{ atts.push((await r.json()).attemptId); }catch(e){} await route.abort('internetdisconnected'); return; }
      await delay(1500); const r=await route.fetch(); let j=null; try{ j=await r.json(); atts.push(j.attemptId); }catch(e){} await route.fulfill({response:r, json:j}); return; }
    const r=await route.fetch(); let j=null; try{ j=await r.json(); atts.push(j.attemptId); }catch(e){} await route.fulfill({response:r, json:j}); });
  const u0=await used(page);
  ok(await openLobby(page), label+' fixture: lobby open, Solo enabled');
  await tapSolo(page);
  if(mode==='lost'){ await delay(2500); } else { await delay(300); await tapBack(page); await delay(2500); }
  const lobbyAfter1=await page.evaluate(()=>!!document.getElementById('edLobby'));
  if(mode==='lost') ok(lobbyAfter1, label+' after the lost reply the lobby is still up (no match launched)');
  await tapBack(page); await delay(400);
  ok(await openLobby(page), label+' reopened the lobby');
  await tapSolo(page); await delay(3000);
  const m=await matchOn(page), u1=await used(page);
  await page.unroute('**/api/emberdraft/start');
  ok(ids.length===2 && !!ids[0] && ids[0]===ids[1], label+' the second Solo re-sends the SAME requestId ('+ids.map(x=>String(x).slice(0,6)).join(' / ')+')');
  ok(u1-u0===1, label+' one attempt spent for one match (spent '+(u1-u0)+')');
  ok(m.active && !!atts[0] && m.att===atts[0], label+' the match played is the one the server booked first ('+String(atts[0]).slice(0,10)+' / '+String(m.att).slice(0,10)+')');
  await page.evaluate(()=>{ try{ edTeardown(); }catch(e){} const ov=document.getElementById('edLobby'); if(ov) ov.remove(); const bl=document.getElementById('battleLoader'); if(bl) bl.remove(); try{ edSaveDrop(ED.acct); }catch(e){} try{ show('home'); }catch(e){} }); await delay(600); }
(async()=>{ try{
  const {page,errs,accs}=await boot(); let ai=0;
  const lv=await page.evaluate(()=>typeof playerLevel==='function'?playerLevel():0); ok(lv>=25,'fixture: player level '+lv+' (Emberdraft opens at 25)');
  for(const [nm,w,h] of [['844x390',844,390],['882x344',882,344],['1440x800',1440,800]]){ await page.setViewportSize({width:w,height:h}); const A=accs[ai++]; await page.evaluate(async(A)=>{ ACC.token=A.token; ACC.id=A.id; await ledgerSync(); const g=document.getElementById('authGate'); if(g) g.remove(); },A); await delay(1500);
    /* layout: every lobby control is inside the screen and is the top element at its centre */
    await openLobby(page);
    const lay=await page.evaluate(()=>{ const out=[]; for(const id of ['edX','edSolo']){ const b=document.getElementById(id); if(!b){ out.push(id+' missing'); continue; } const r=b.getBoundingClientRect();
        if(r.width<1||r.left<0||r.top<0||r.right>innerWidth+0.5||r.bottom>innerHeight+0.5) out.push(id+' off screen '+[r.left,r.top,r.right,r.bottom].map(Math.round).join(','));
        const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); if(!(e&&(e===b||b.contains(e)))) out.push(id+' covered by '+(e&&(e.id||e.className||e.tagName))); } return out; });
    ok(lay.length===0, nm+' lobby: Island and Solo on screen and tappable '+JSON.stringify(lay));
    await tapBack(page); await delay(400);
    await caseRun(page, nm+' A lost start reply, back, reopen, Solo:', 'lost');
  }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('emberdraft start after a lost or abandoned reply'); await cleanup(); } })();