// v1093 - Phil's benefit chart is the standard (9 Oct: "Make what we have so far the standard, and we will adjust"):
// stamina / gold purchases 1 a day at EGP 0 (cap 12), Elite stage resets (EGP 2+), Arena resets (EGP 3+), 50 % double gold (EGP 6+),
// Shady Market discount on 2 items a day (EGP 9+), armies out at once (2, then by level), the chart served to the client, chat tags.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-p1093-'));
const dbFile=path.join(dir,'db.json'), src=fs.readFileSync(path.join(root,srvFile),'utf8');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
let rq=0; const R=()=>'q'+(rq++);
const setEgp=base=>editDB(u=>{ u.led.patron={v:1,base,prestiged:false,edpBase:0}; u.led.gems=100000; u.led.stamina={v:0,t:Date.now()}; u.led.shop={day:'',food:0,gold:0}; delete u.led.patronDay; });
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'p1093-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await setEgp(0); let L=await led();
  ok(L.patron.rows.meals===1&&L.patron.rows.goldBuys===1&&L.patron.rows.marches===2&&L.patron.rows.eliteResets===0&&L.patron.rows.arenaResets===0,'EGP 0: 1 stamina purchase, 1 gold purchase, 2 armies, no resets ('+JSON.stringify(L.patron.rows)+')');
  const m1=await call('/api/shop/buy',{what:'food',requestId:R()}), m2=await call('/api/shop/buy',{what:'food',requestId:R()});
  ok(m1.data.ok===true&&m2.data.ok===false,'EGP 0 buys 1 meal a day, the 2nd is refused ('+(m2.data.error||'')+')');
  const e0=await call('/api/patron/elite-reset',{mode:'elite',node:5,requestId:R()});
  ok(e0.data.ok===false&&/EGP 2/.test(e0.data.error||''),'Elite resets are closed at EGP 0');
  await setEgp(36); L=await led();   // EGP 3
  ok(L.patron.egp===3&&L.patron.rows.eliteResets===2&&L.patron.rows.arenaResets===1&&L.patron.rows.meals===4&&L.patron.rows.goldBuys===4,'EGP 3: 2 Elite resets, 1 Arena reset, 4 / 4 purchases');
  await editDB(u=>{ u.led.arenaAtt={k:L.arena?L.arena.k:'',used:5,bought:0}; });
  { const s=await call('/api/arena/state'); }
  await editDB(u=>{ const dk=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-9*3600000)); u.led.arenaAtt={k:dk,used:5,bought:0}; u.led.portals=u.led.portals||{}; u.led.portals.elite={cleared:10,stars:{},att:null,runs:{k:dk,n5:3}}; });
  const ar=await call('/api/patron/arena-reset',{requestId:R()}); L=await led();
  ok(ar.data.ok===true&&ar.data.arena&&ar.data.arena.attemptsLeft===5,'an Arena reset gives the 5 free attempts back for 50 diamonds ('+(ar.data.error||JSON.stringify(ar.data.arena&&ar.data.arena.attemptsLeft))+')');
  const ar2=await call('/api/patron/arena-reset',{requestId:R()});
  ok(ar2.data.ok===false,'the 2nd Arena reset at EGP 3 is refused (1 a day)');
  const er=await call('/api/patron/elite-reset',{mode:'elite',node:5,requestId:R()});
  const dk=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-9*3600000));
  await delay(400); const pr=disk().users[id].led.portals.elite.runs;
  ok(er.data.ok===true&&!(pr.n5|0),'an Elite reset gives a used stage its 3 runs back ('+(er.data.error||'ok')+')');
  // EGP 6: double gold
  await setEgp(400); let doubled=0, base1=0;
  for(let i=0;i<10;i++){ const r=await call('/api/shop/buy',{what:'gold',requestId:R()}); if(!r.data.ok) break; const amt=r.data.gold||0; if(!base1||amt<base1) base1=amt; if(base1&&amt>=base1*2) doubled++; }
  ok(doubled>=1&&doubled<=9,'EGP 6: some gold purchases come out doubled ('+doubled+' of 10)');
  // EGP 9: Shady discount on today's 2 picks
  await setEgp(1400); L=await led();
  const picks=L.patron.shadyPicks||[];
  ok(L.patron.rows.shadyOff===10&&picks.length===2,'EGP 9: 10 % off 2 Shady items today ('+picks.join(',')+')');
  const pick=picks.find(x=>x!=='targeted5'); if(pick){ const before=(await led()).gems; const r=await call('/api/shop/buy',{what:pick,requestId:R()}); const after=(await led()).gems;
    const full={warchest:250,shields3:550,arenacoins:600}[pick]; ok(r.data.ok===true&&before-after===Math.round(full*0.9),'a picked item costs 10 % less ('+pick+': '+(before-after)+' of '+full+')'); }
  // static: march cap + speed wired, chart served, chat tags
  ok((src.match(/patronOpenMarches\(me,now\)>=patronRow\(/g)||[]).length===3,'all three march starts (mine, city attack, v1097 city defend) check the armies-out cap');
  ok((src.match(/patronMarchMs\(/g)||[]).length>=3,'EDP march speed shortens the planned travel');
  const bf=await fetch(base+'/server/patron-benefits.js'); const bt=await bf.text();
  ok(bf.status===200&&/EGP|stamina/i.test(bt),'the chart is served to the client');
  ok(/const msg=\{who:ws\._acctName[^\n]*patronChatTag/.test(src)&&/gm\.pt=pt/.test(src),'world and guild chat lines carry the sender\'s patron tag');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_patron_1093.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
