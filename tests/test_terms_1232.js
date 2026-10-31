// v1232 (Phil 30 Oct 2026, Google Play Terms + Privacy): public /terms and /privacy pages; TOS_UPDATED 'October 2026' so every device
// re-accepts; account deletion = a 7-day grace (locked + hidden, cancelled by signing in), then the SERVER wipes it from the database.
// Checks: both pages served (200, text/html, the 90-day logs, the seven-day grace, the contact email, the deletion anchor + web form);
// TOS_UPDATED and no 'not legal advice' line in the game page; Settings delete -> pending (session revoked, off the ladder search,
// durable across a restart); signing in 6 days later cancels it; a web request (/api/account/delete-request) -> after 7 days (fake clock:
// tests/terms-clock-1232.cjs) the account is wiped and its name is free; a guest is deleted at once.
// Asserts (non-zero exit). Control: AUD_SERVER=<0dbf6b8a server.js copied into the repo root> AUD_HTML=<0dbf6b8a emberweave-heroes.html> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', htmlFile=process.env.AUD_HTML||path.join(root,'emberweave-heroes.html');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-t1232-')), dbFile=path.join(dir,'db.json'), clockFile=path.join(dir,'clock.txt');
const DAY=86400000;
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const setClock=ms=>fs.writeFileSync(clockFile,String(ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['-r',path.join(__dirname,'terms-clock-1232.cjs'),srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,
    RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100',ADMIN_IDS:'',CLOCK_OFFSET_FILE:clockFile,ACCOUNT_DELETE_SWEEP_MS:'300'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function page(route){ const r=await fetch(base+route); return { status:r.status, type:String(r.headers.get('content-type')||''), text:await r.text() }; }
const SECRET='test-link-secret-1232', procs={}, ports={};
const dbOf=n=>{ const d=path.join(dir,'s'+n); fs.mkdirSync(d,{recursive:true}); return path.join(d,n+'.json'); };
async function startN(n,env){ ports[n]=ports[n]||await freePort();
  procs[n]=spawn(process.execPath,['-r',path.join(__dirname,'terms-clock-1232.cjs'),srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(ports[n]),DB_FILE:dbOf(n),RL_MUL:'1000',REG_PER_MIN:'100',
    REG_ACCOUNTS_PER_IP:'100',ADMIN_IDS:'',ACCOUNT_LINK_SECRET:SECRET,CLOCK_OFFSET_FILE:clockFile,ACCOUNT_DELETE_SWEEP_MS:'300',...env},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch('http://127.0.0.1:'+ports[n]+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start '+n); }
async function stopN(){ for(const n of Object.keys(procs)){ const c=procs[n]; c.kill(); for(let i=0;i<60&&c.exitCode===null;i++)await delay(50); delete procs[n]; } }
async function callN(n,route,data,tok){ const r=await fetch('http://127.0.0.1:'+ports[n]+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const diskN=n=>JSON.parse(fs.readFileSync(dbOf(n),'utf8'));
async function satellites(){ try{
  await startN('s1',{}); await startN('s2',{ACCOUNT_AUTHORITY:'http://127.0.0.1:'+ports.s1,ACCOUNT_STATUS_MS:'500'});
  const reg=await callN('s1','/api/register',{name:'satSue',pass:'password1'}); const gid=reg.data.profile&&reg.data.profile.id;
  let t2=(await callN('s2','/api/login',{name:'satSue',pass:'password1'})).data.token;
  ok(!!gid&&!!t2,'satellite: account on Server 1, signed in on Server 2');
  let r=await callN('s2','/api/account/delete',{confirm:'DELETE',pass:'password1',requestId:'s1'},t2);
  ok(r.status===200&&r.data.pending===true,'satellite: Settings delete is pending ('+r.status+' '+JSON.stringify(r.data)+')');
  await delay(500);
  ok(!!(diskN('s1').users[gid]||{}).delReq,'satellite: Server 1 holds the request (delReq on disk)');
  ok((await callN('s2','/api/profile',null,t2)).status===401,'satellite: the Server 2 session is revoked');
  r=await callN('s2','/api/login',{name:'satSue',pass:'password1'});
  ok(r.status===200&&r.data.deletionCancelled===true,'satellite: signing in on Server 2 cancels it ('+r.status+' '+(r.data.error||'')+')');
  t2=r.data.token; await delay(500);
  ok(!(diskN('s1').users[gid]||{}).delReq,'satellite: cancelled on Server 1 too');
  r=await callN('s2','/api/account/delete-request',{name:'satSue',pass:'password1',confirm:'DELETE',requestId:'sw1'});
  ok(r.status===200&&r.data.pending===true,'satellite: web request on Server 2 is pending');
  ok((await callN('s2','/api/profile',null,t2)).status===401,'satellite: the session is revoked again');
  setClock(7*DAY+60000); await delay(3000);   // Server 1 sweeps; Server 2 follows the tombstone at its status check
  ok(!diskN('s1').users[gid],'satellite: after 7 days Server 1 wiped the account');
  ok((await callN('s2','/api/login',{name:'satSue',pass:'password1'})).status===401,'satellite: it no longer signs in on Server 2');
  ok(!Object.values(diskN('s2').users||{}).some(u=>u&&String(u.name).toLowerCase()==='satsue'),'satellite: Server 2 dropped its player too');
} finally { await stopN(); } }
(async()=>{ try{
  setClock(0); port=await freePort(); base='http://127.0.0.1:'+port; await start();
  // ---------------- the public pages ----------------
  const T=await page('/terms'), P=await page('/privacy');
  ok(T.status===200&&/^text\/html/.test(T.type),'/terms served: '+T.status+' '+T.type);
  ok(P.status===200&&/^text\/html/.test(P.type),'/privacy served: '+P.status+' '+P.type);
  ok(/Terms of Service/.test(T.text)&&/Last updated: October 2026/.test(T.text)&&/Xanthyr Games/.test(T.text)&&/Google Play Billing/.test(T.text)&&/under 18/i.test(T.text),'/terms: title, October 2026, Xanthyr Games, Google Play Billing, under-18 consent');
  ok(/seven-day grace period/.test(T.text)&&/emberweaveheroes@gmail\.com/.test(T.text),'/terms: the seven-day grace and the contact email');
  ok(/Privacy Policy/.test(P.text)&&/Last updated: October 2026/.test(P.text)&&/retained for 90 days/.test(P.text),'/privacy: logs retained for 90 days');
  ok(/seven-day grace period/.test(P.text)&&/within those seven days/.test(P.text)&&/age out on their existing backup rotation schedule/.test(P.text),'/privacy: the seven-day grace, cancel by signing in, backups age out');
  ok(/emberweaveheroes@gmail\.com/.test(P.text)&&/id="delete-account"/.test(P.text)&&/id="delForm"/.test(P.text)&&/\/api\/account\/delete-request/.test(P.text),'/privacy: the contact email, the delete-account anchor and the web request form');
  ok(/IP addresses/.test(P.text)&&/Chat, names and reports/.test(P.text)&&/backups/i.test(P.text),'/privacy: discloses IP/logs, chat and backups');
  ok(!/legal advice/i.test(T.text+P.text),'no "not legal advice" line on either page');
  // ---------------- the game page ----------------
  const H=fs.readFileSync(htmlFile,'utf8');
  ok(/const TOS_UPDATED='October 2026'/.test(H),"TOS_UPDATED is 'October 2026' (every device re-accepts)");
  ok(!/not legal advice/i.test(H),'the game page has no "not legal advice" line');
  ok(/href="\/terms"/.test(H)&&/href="\/privacy"/.test(H)&&/function tosRecheck\(/.test(H),'the in-game Terms link /terms and /privacy; a signed-in device re-accepts (tosRecheck)');
  // ---------------- delete from Settings: 7-day grace ----------------
  const A=(await call('/api/register',{name:'graceAnn',pass:'password1'})).data, B=(await call('/api/register',{name:'graceBob',pass:'password1'})).data;
  ok(!!(A.token&&B.token),'two accounts registered');
  const aid=A.profile.id;
  const t0=Date.now();
  let r=await call('/api/account/delete',{confirm:'DELETE',pass:'password1',requestId:'g1'},A.token);
  ok(r.status===200&&r.data.ok===true&&r.data.pending===true&&!r.data.deleted,'Settings delete: pending, not wiped ('+r.status+' '+JSON.stringify(r.data)+')');
  ok(Math.abs((+r.data.wipeAt||0)-(t0+7*DAY))<60000,'the wipe is 7 days out ('+(((+r.data.wipeAt||0)-t0)/DAY).toFixed(3)+' days)');
  ok((await call('/api/profile',null,A.token)).status===401,'locked: the session is revoked');
  { const l=(await call('/api/arena/ladder?q=graceann',null,B.token)).data; ok(Array.isArray(l.entries)&&!l.entries.length,'hidden: not in the arena ladder search'); }
  await delay(500);
  { const u=(disk().users||{})[aid]; ok(!!u&&!!u.delReq&&+u.delReq.wipeAt===+r.data.wipeAt,'the request is on disk (users.'+aid+'.delReq)'); }
  await stop(); await start();   // durable: survives a restart
  { const u=(disk().users||{})[aid]; ok(!!u&&!!u.delReq,'after a restart the account is still there and still pending'); }
  ok((await call('/api/profile',null,A.token)).status===401,'after a restart the old session is still revoked');
  // ---------------- sign in on day 6: cancelled ----------------
  setClock(6*DAY); await delay(200);
  r=await call('/api/login',{name:'graceAnn',pass:'password1'});
  ok(r.status===200&&!!r.data.token&&r.data.deletionCancelled===true,'signing in on day 6 works and cancels the deletion ('+r.status+' '+(r.data.error||'')+')');
  const tokA=r.data.token;
  ok((await call('/api/profile',null,tokA)).status===200,'the account plays again');
  await delay(500);
  { const u=(disk().users||{})[aid]; ok(!!u&&!u.delReq,'the cancellation is on disk (no delReq)'); }
  setClock(15*DAY); await delay(1200);
  ok(!!(disk().users||{})[aid],'a cancelled request is never wiped (day 15)');
  // ---------------- web request: wiped after 7 days ----------------
  r=await call('/api/account/delete-request',{name:'graceAnn',pass:'wrongpass1',confirm:'DELETE',requestId:'w0'});
  ok(r.status===401,'web request: wrong password refused ('+r.status+')');
  r=await call('/api/account/delete-request',{name:'graceAnn',pass:'password1',confirm:'nope',requestId:'w0'});
  ok(r.status===400,'web request: no typed DELETE refused');
  r=await call('/api/account/delete-request',{name:'graceAnn',pass:'password1',confirm:'DELETE',requestId:'w1'});
  ok(r.status===200&&r.data.pending===true,'web request: pending ('+r.status+' '+JSON.stringify(r.data)+')');
  ok((await call('/api/profile',null,tokA)).status===401,'web request: the game session is revoked');
  setClock(15*DAY+6*DAY+23*3600000); await delay(1200);
  ok(!!(disk().users||{})[aid],'6 days 23 hours later: not wiped yet');
  setClock(15*DAY+7*DAY+60000); await delay(1500);
  { const db=disk(); ok(!(db.users||{})[aid]&&JSON.stringify(db.byName||{}).toLowerCase().indexOf('graceann')<0,'after 7 days the server wiped the account (no user, no name index)'); }
  ok((await call('/api/login',{name:'graceAnn',pass:'password1'})).status===401,'the wiped account no longer signs in');
  r=await call('/api/register',{name:'graceAnn',pass:'password1'});
  ok(r.status===200&&r.data.profile&&r.data.profile.id!==aid,'the name is free again');
  // ---------------- a guest is deleted at once ----------------
  const G=(await call('/api/guest',{deviceId:'t1232-'+Date.now()})).data;
  r=await call('/api/account/delete',{confirm:'DELETE',requestId:'gg1'},G.token);
  await delay(400);
  ok(r.status===200&&r.data.deleted===true&&!(disk().users||{})[G.profile&&G.profile.id],'a guest (no password to sign back in) is deleted at once');
  await stop();
  // ---------------- Servers 2-5: the grace is held by Server 1 ----------------
  setClock(0); await satellites();
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_terms_1232.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
