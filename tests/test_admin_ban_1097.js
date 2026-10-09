// v1097 (Phil 9 Oct 2026: "please change delete to ban. when i click ban it gives me and option 1,7,14,28 days or permanent").
// POST /api/admin/ban {playerId, days|permanent, reason, requestId} and /api/admin/unban {playerId, requestId}: admin-only, one
// receipt per requestId, user.ban {until, permanent, by, reason, at}. While banned, sign-in and every authenticated route answer
// 403 "Account banned until <date>" (or "permanently"); open sockets are closed; the admin list shows the ban; an expired ban lifts
// itself; the player can still delete their own account.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const WebSocket=require('ws');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-b1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[],admin='';
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100',ADMIN_IDS:admin},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
const login=(name)=>call('/api/login',{name,pass:'password1'});
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const dev=(await call('/api/register',{name:'banDev',pass:'password1'})).data; admin=dev.profile.id; await delay(400); await stop(); await start();
  const D=(await login('banDev')).data.token;
  const P=(await call('/api/register',{name:'banPia',pass:'password1'})).data, Q=(await call('/api/register',{name:'banQuin',pass:'password1'})).data;
  const pid=P.profile.id, qid=Q.profile.id;
  // ---- only an admin bans ----
  let r=await call('/api/admin/ban',{playerId:pid,days:1,reason:'x',requestId:'n1'},Q.token);
  ok(r.status===403,'a non-admin cannot ban ('+r.status+')');
  ok((await call('/api/admin/unban',{playerId:pid,requestId:'n2'},Q.token)).status===403,'a non-admin cannot unban');
  r=await call('/api/admin/ban',{playerId:pid,days:1,reason:'x'},D);
  ok(r.status===400,'a ban needs a requestId');
  r=await call('/api/admin/ban',{playerId:pid,days:30,reason:'x',requestId:'b0'},D);
  ok(r.status===400,'only 1, 7, 14 or 28 days (or permanent) are offered');
  // ---- ban 1 day: socket closed, sign-in and routes answer 403 with the date ----
  const ws=new WebSocket('ws://127.0.0.1:'+port); let closed=false; ws.on('close',()=>{ closed=true; });
  await new Promise(res=>ws.on('open',res)); ws.send(JSON.stringify({t:'chatjoin',token:P.token})); await delay(300);
  const t0=Date.now();
  r=await call('/api/admin/ban',{playerId:pid,days:1,reason:'racism in world chat',requestId:'b1'},D);
  ok(r.status===200&&r.data.ok&&r.data.banned&&!r.data.banned.permanent&&Math.abs(r.data.banned.until-(t0+86400000))<10000,'admin bans for 1 day ('+(r.data.error||r.status)+')');
  const r2=await call('/api/admin/ban',{playerId:pid,days:1,reason:'racism in world chat',requestId:'b1'},D);
  ok(r2.status===200&&r2.data.banned&&r2.data.banned.until===r.data.banned.until,'the same requestId answers with the same receipt');
  await delay(400);
  ok(closed,'the banned player\'s open socket is closed');
  const u=disk().users[pid];
  ok(u.ban&&u.ban.permanent===false&&u.ban.reason==='racism in world chat'&&u.ban.by==='banDev'&&u.ban.at>0&&u.ban.until===r.data.banned.until,'user.ban stores until, permanent, by, reason, at');
  let li=await login('banPia');
  ok(li.status===403&&li.data.banned===true&&/^Account banned until .+\.$/.test(li.data.error||'')&&!li.data.token,'sign-in answers 403 "Account banned until <date>" ('+li.data.error+')');
  const pr=await call('/api/profile',null,P.token), lg=await call('/api/ledger',null,P.token), sv=await call('/api/save',{},P.token);
  ok([pr,lg,sv].every(x=>x.status===403&&/^Account banned until /.test(x.data.error||'')),'every authenticated route answers 403 with the date (profile '+pr.status+', ledger '+lg.status+', save '+sv.status+')');
  const al=(await call('/api/admin/accounts',null,D)).data.accounts||[];
  ok((al.find(a=>a.id===pid)||{}).ban&&(al.find(a=>a.id===pid)||{}).ban.reason==='racism in world chat'&&!(al.find(a=>a.id===qid)||{}).ban,'the admin player list shows the ban');
  // ---- unban restores access ----
  r=await call('/api/admin/unban',{playerId:pid,requestId:'u1'},D);
  ok(r.status===200&&r.data.banned===null,'admin unbans');
  li=await login('banPia');
  ok(li.status===200&&!!li.data.token,'after the unban the player signs in');
  ok((await call('/api/profile',null,li.data.token)).status===200,'and routes answer again');
  ok(!disk().users[pid].ban,'the ban record is cleared');
  // ---- permanent ----
  r=await call('/api/admin/ban',{playerId:qid,permanent:true,reason:'harassment',requestId:'p1'},D);
  ok(r.status===200&&r.data.banned&&r.data.banned.permanent===true,'admin bans permanently');
  li=await login('banQuin');
  ok(li.status===403&&li.data.error==='Account banned permanently.'&&li.data.permanent===true,'sign-in answers "Account banned permanently."');
  ok((await call('/api/profile',null,Q.token)).data.error==='Account banned permanently.','routes answer "Account banned permanently."');
  r=await call('/api/account/delete',{confirm:'DELETE',pass:'password1',requestId:'qd'},Q.token);
  ok(r.status===200&&r.data.deleted===true,'a banned player can still delete their own account');
  // ---- an admin cannot be banned ----
  ok((await call('/api/admin/ban',{playerId:admin,days:7,requestId:'a1'},D)).status===400,'an admin account cannot be banned');
  // ---- an expired ban lifts itself ----
  r=await call('/api/admin/ban',{playerId:pid,days:7,reason:'short',requestId:'e1'},D);
  ok(r.status===200,'admin bans for 7 days');
  await delay(400); await stop(); { const db=disk(); db.users[pid].bannedUntil=Date.now()+2500; if(db.users[pid].ban) db.users[pid].ban.until=db.users[pid].bannedUntil; fs.writeFileSync(dbFile,JSON.stringify(db)); } await start();
  ok((await login('banPia')).status===403,'banned while the time has not run out');
  await delay(3000);
  li=await login('banPia');
  ok(li.status===200&&!!li.data.token,'once the time runs out the ban lifts itself (no admin action)');
  try{ ws.close(); }catch(_){}
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_admin_ban_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
