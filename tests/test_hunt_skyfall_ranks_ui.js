// Grok bug hunt 12 Nov - Skyfall x guild ranks, in the browser at 844x390 / 882x344 / 1440x800 (real server, temp DB, a planning match g1 vs g2).
// Per size: an Officer sees the placement controls on the Skyfall tab; the leader demotes them -> after the next status poll the controls are gone;
// a member leaves during prep -> after the next poll the officer's board no longer lists them.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-skyrankui-')), dbFile=path.join(dir,'db.json');
const {chromium}=require(require.resolve('playwright',{paths:[root,__dirname]}));
let port,base,child,browser,fails=0,checks=0;
const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100',ALLOW_NEW_GUESTS:'1'},stdio:'ignore',windowsHide:true});
  for(const t0=Date.now();Date.now()-t0<60000&&child.exitCode===null;){ try{ if((await fetch(base+'/health')).ok) return; }catch(_){} await delay(100); } throw Error('no start'); }
async function stop(){ if(!child) return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); }
  if(child.exitCode===null&&child.signalCode===null) throw Error('server pid '+child.pid+' did not exit - no DB edit or restart'); child=null; await delay(300); }
let ipN=0;
async function call(route,data,tok,war){ const h={'Content-Type':'application/json',...(tok?{'x-token':tok}:{})}; if(war) h['x-forwarded-for']='10.6.'+((++ipN)>>8&255)+'.'+(ipN&255);
  const r=await fetch(base+route,{method:data?'POST':'GET',headers:h,body:data?JSON.stringify(data):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const offs=['uiOffA','uiOffB','uiOffC'], leavers=['uiGoA','uiGoB','uiGoC'], names=['uiLead',...offs,...leavers,'uiZed'];
  const U={}; for(const n of names){ U[n]=(await call('/api/register',{name:n+Date.now().toString(36).slice(-4),pass:'password1'})).data; }
  const id=n=>U[n].profile.id; for(const n of names) await call('/api/ledger',null,U[n].token);
  await call('/api/guild-war/status',null,U.uiLead.token,true); await delay(500); await stop();
  const now=Date.now();
  { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.guilds=db.guilds||{}; const g1n=['uiLead',...offs,...leavers];
    db.guilds.g1={id:'g1',name:'Sky Hall',leader:id('uiLead'),members:g1n.map(id),officers:offs.map(id),reqs:[],level:3,exp:0,motd:'',log:[],createdAt:now-86400000};
    db.guilds.g2={id:'g2',name:'Far Order',leader:id('uiZed'),members:[id('uiZed')],reqs:[],level:3,exp:0,motd:'',log:[],createdAt:now-86400000};
    for(const n of g1n) db.users[id(n)].guildId='g1'; db.users[id('uiZed')].guildId='g2';
    for(const n of names){ if(db.users[id(n)].led) db.users[id(n)].led.px=99000000; }
    const t=db.tournaments.current, lanes=[0,1,2,3,4], L=n=>({memberId:id(n),line:0,power:100,name:db.users[id(n)].name});
    const side=(gid,nm,defs)=>({guildId:gid,name:nm,citadels:lanes.map(i=>({lane:i,key:'l'+i,destroyed:false,defenders:i===0?defs:[]})),unplaced:[]});
    t.state='bracket'; t.roundIndex=0; t.roundBase=3;
    t.entrants=[{guildId:'g1',name:'Sky Hall',banner:null,seed:1,powerPool:700,lines:g1n.map(L)},{guildId:'g2',name:'Far Order',banner:null,seed:2,powerPool:100,lines:[L('uiZed')]}];
    t.rounds=[{name:'F',matchIds:['gwm_ui']}];
    t.matches={gwm_ui:{id:'gwm_ui',tournamentId:t.id,roundIndex:0,state:'planning',aGuildId:'g1',bGuildId:'g2',revealAt:0,planningEndsAt:now+6*3600000,startsAt:now+6*3600000,endsAt:now+8*3600000,winnerGuildId:null,
      sides:{g1:side('g1','Sky Hall',g1n.map(L)),g2:side('g2','Far Order',[L('uiZed')])},assaults:{},eventLog:[],version:0}};
    fs.writeFileSync(dbFile,JSON.stringify(db)); }
  await start();
  const T={}; for(const n of names) T[n]=(await call('/api/login',{name:U[n].profile.name,pass:'password1'})).data.token;
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const ctx=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  const view=async(tok,uid)=>page.evaluate(async([tok,uid])=>{ ACC.token=tok; ACC.id=uid; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); const ag=document.getElementById('authGate'); if(ag) ag.remove();
      try{ await ledgerSync(); }catch(e){} try{ await guildFetch(); }catch(e){} try{ await skyStatus(); }catch(e){} guildTab='war'; show('guild'); try{ renderGuild(); }catch(e){}
      await new Promise(r=>setTimeout(r,600)); const body=document.getElementById('guildBody');
      const btns=[...(body?body.querySelectorAll('[onclick^="skyAssign"]'):[])]; const b=btns[0]; let onScreen=null;
      if(b){ b.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,200)); const q=b.getBoundingClientRect(); const e=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2); onScreen=q.width>0&&q.left>=0&&q.right<=innerWidth+0.5&&q.top>=0&&q.bottom<=innerHeight+0.5&&!!e&&(e===b||b.contains(e)); }
      return { tab:guildTab, assign:btns.length, onScreen, text:body?body.innerText:'' }; },[tok,uid]);
  const sizes=[['844x390',844,390],['882x344',882,344],['1440x800',1440,800]];
  for(let k=0;k<3;k++){ const [nm,w,h]=sizes[k], off=offs[k], go=leavers[k];
    await page.setViewportSize({width:w,height:h}); await delay(1200);
    let v=await view(T[off],id(off));
    ok(v.assign>0 && v.onScreen===true, nm+' Officer '+off+': Skyfall placement controls shown and tappable ('+v.assign+' buttons, onScreen '+v.onScreen+')');
    ok(v.text.includes(U[go].profile.name), nm+' fixture: the officer\'s board lists '+go);
    await call('/api/guild/leave',{},T[go]);
    v=await view(T[off],id(off));
    ok(!v.text.includes(U[go].profile.name), nm+' after '+go+' leaves during prep, the officer\'s board no longer lists them');
    await call('/api/guild/rank/assign',{id:id(off),rankId:'member'},T.uiLead);
    v=await view(T[off],id(off));
    ok(v.assign===0, nm+' after the leader demotes '+off+' mid-war, the placement controls are gone ('+v.assign+' buttons)'); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { console.log('skyfall ranks mid-war (browser): '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; if(browser) await browser.close().catch(()=>{}); try{ await stop(); }catch(e){ console.error(String(e)); process.exitCode=1; } try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){} } })();