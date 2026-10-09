// v1097 (9 Oct 2026 full-game sweep #18, App Store user-content rule): chat safety over the real WebSocket and the guild routes.
// - Word filter (server/chat-filter.js): world / region chat, whispers, guild chat and the guild message are masked with asterisks;
//   a guild name on the list is refused. Innocent words that contain a listed one ('classic', 'Scunthorpe') pass.
// - Block: a player's block list lives in the ledger; the blocked player's live lines, history and whispers stop reaching them
//   (server side, per player); unblock restores it.
// - Report: 'report message' files the line (looked up on the server by its id: text, sender id, channel) in the report inbox.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const WebSocket=require('ws');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-c1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
// a chat socket: every frame carries the token (the server revalidates it per frame); inbox = every frame received
function sock(p){ return new Promise((res,rej)=>{ const ws=new WebSocket('ws://127.0.0.1:'+port); const s={ws,inbox:[],p};
  ws.on('message',d=>{ try{ s.inbox.push(JSON.parse(d.toString())); }catch(_){} });
  ws.on('open',()=>{ s.send({t:'chatjoin',name:p.name}); res(s); }); ws.on('error',rej);
  s.send=o=>ws.send(JSON.stringify(Object.assign({token:p.token},o))); }); }
const got=(s,f)=>s.inbox.filter(f);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const mk=async k=>{ const g=(await call('/api/guest',{deviceId:'c1097-'+k+'-'+Date.now()})).data; await call('/api/ledger',null,g.token); return {token:g.token,id:g.profile.id,name:g.profile.name}; };
  const A=await mk('a'), B=await mk('b'), C=await mk('c');
  await editDB(db=>{ for(const p of [A,B,C]) db.users[p.id].led.px=1000; });   // level 13: the Guild Hall
  const sa=await sock(A), sb=await sock(B), sc=await sock(C); await delay(400);
  // ---- word filter, live ----
  sa.send({t:'chat',channel:'world',text:'what the fuck is this sh1t'}); await delay(500);
  let mC=got(sc,m=>m.t==='chatmsg'), mB=got(sb,m=>m.t==='chatmsg');
  ok(mC.length===1&&mC[0].txt==='what the **** is this ****','world chat is masked for other players ('+JSON.stringify(mC[0]&&mC[0].txt)+')');
  ok(mB.length===1,'B sees the line before blocking');
  const mid1=mC[0]&&mC[0].mid;
  ok(typeof mid1==='string'&&mid1.length>=8,'the line carries a server id for Report');
  sa.send({t:'chat',channel:'region',text:'a classic day in Scunthorpe'}); await delay(400);
  mC=got(sc,m=>m.t==='chatmsg'&&m.channel==='region');
  ok(mC.length===1&&mC[0].txt==='a classic day in Scunthorpe','innocent words that contain a listed word pass untouched');
  // ---- block ----
  let r=await call('/api/chat/block',{name:A.name},B.token);
  ok(r.status===200&&r.data.ok&&(r.data.blocked||[]).some(x=>x.id===A.id),'B blocks A ('+(r.data.error||r.status)+')');
  await delay(400); ok(((disk().users[B.id].led||{}).blocked||[]).includes(A.id),'the block list is stored in B\'s ledger');
  sb.inbox.length=0; sc.inbox.length=0;
  sa.send({t:'chat',channel:'world',text:'second line'}); await delay(500);
  ok(got(sc,m=>m.t==='chatmsg'&&m.txt==='second line').length===1,'C still gets A\'s new line');
  ok(got(sb,m=>m.t==='chatmsg').length===0,'B does not get A\'s new line (blocked, server side)');
  sa.send({t:'whisper',to:B.name,text:'psst'}); sa.send({t:'whisper',to:C.name,text:'you f4ggot'}); await delay(500);
  ok(got(sb,m=>m.t==='whispermsg').length===0,'B does not get A\'s whisper');
  const wC=got(sc,m=>m.t==='whispermsg');
  ok(wC.length===1&&wC[0].txt==='you ******'&&!!wC[0].mid,'C gets A\'s whisper, masked ('+JSON.stringify(wC[0]&&wC[0].txt)+')');
  // history on a fresh socket: B's leaves A out, C's keeps A; nobody is sent sender ids
  const sb2=await sock(B), sc2=await sock(C); await delay(500);
  const hB=got(sb2,m=>m.t==='chathist')[0]||{}, hC=got(sc2,m=>m.t==='chathist')[0]||{};
  const whoB=[...(hB.world||[]),...(hB.region||[])].map(x=>x.who), whoC=[...(hC.world||[]),...(hC.region||[])].map(x=>x.who);
  ok(Array.isArray(hB.world)&&!whoB.includes(A.name),'B\'s chat history leaves the blocked player out');
  ok(whoC.filter(w=>w===A.name).length===3,'C\'s chat history keeps all three of A\'s lines');
  ok(!JSON.stringify(hC).includes(A.id),'chat history never carries sender ids');
  // ---- guild chat: masked, blocked member hidden ----
  const gc=await call('/api/guild/create',{name:'Shit Lords'},A.token);
  ok(gc.status===400,'a guild name on the word list is refused ('+(gc.data.error||gc.status)+')');
  const g=(await call('/api/guild/create',{name:'Ash Wardens'},A.token)).data.guild; const gid=g&&g.id;
  await call('/api/guild/request',{guildId:gid},B.token); await call('/api/guild/approve',{id:B.id},A.token);
  await call('/api/guild/request',{guildId:gid},C.token); await call('/api/guild/approve',{id:C.id},A.token);
  const gm=await call('/api/guild/chat',{tx:'piss off'},A.token);
  ok(gm.status===200&&(gm.data.log||[]).some(e=>e.tx==='**** off'),'guild chat is masked');
  const mo=await call('/api/guild/motd',{motd:'no bullshit allowed'},A.token);
  ok(mo.status===200&&mo.data.guild&&mo.data.guild.motd==='no ******** allowed','the guild message is masked');
  const gB=(await call('/api/guild/chat',{tx:'hello all'},B.token)).data.log||[], gC=(await call('/api/guild/chat',{tx:'hey'},C.token)).data.log||[];
  ok(!gB.some(e=>!e.sys&&e.id===A.id)&&gC.some(e=>!e.sys&&e.id===A.id),'B\'s guild chat hides A; C\'s shows A');
  // ---- report ----
  r=await call('/api/chat/report',{mid:mid1},C.token);
  ok(r.status===200&&r.data.ok===true,'C reports A\'s world line ('+(r.data.error||r.status)+')');
  r=await call('/api/chat/report',{mid:mid1},C.token);
  ok(r.status===200&&r.data.already===true,'reporting the same line twice files it once');
  r=await call('/api/chat/report',{mid:wC[0]&&wC[0].mid},C.token);
  ok(r.status===200&&r.data.ok===true,'C reports A\'s whisper');
  r=await call('/api/chat/report',{mid:wC[0]&&wC[0].mid},B.token);
  ok(r.status===404,'a whisper can be reported only by the two players in it');
  r=await call('/api/chat/report',{mid:'nosuchline'},C.token);
  ok(r.status===404,'an unknown line is refused');
  await delay(400);
  const fb=(disk().feedback||[]).filter(f=>f.kind==='chat'&&f.userId===C.id);
  const fw=fb.find(f=>f.chat&&f.chat.channel==='world'), fwh=fb.find(f=>f.chat&&f.chat.channel==='whisper');
  ok(fb.length===2&&fw&&fw.chat.senderId===A.id&&fw.chat.text==='what the **** is this ****'&&fwh&&fwh.chat.senderId===A.id,'the reports are stored with the text, sender id and channel');
  // ---- unblock ----
  r=await call('/api/chat/unblock',{id:A.id},B.token);
  ok(r.status===200&&!(r.data.blocked||[]).length,'B unblocks A');
  r=await call('/api/chat/blocks',null,B.token);
  ok(r.status===200&&Array.isArray(r.data.blocked)&&!r.data.blocked.length,'the block list reads back empty');
  sb.inbox.length=0; sa.send({t:'chat',channel:'world',text:'back again'}); await delay(500);
  ok(got(sb,m=>m.t==='chatmsg'&&m.txt==='back again').length===1,'after unblocking B gets A\'s lines again');
  for(const s of [sa,sb,sc,sb2,sc2]) try{ s.ws.close(); }catch(_){}
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_chat_safety_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
