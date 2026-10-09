// v1097 (9 Oct 2026 full-game sweep #18, App Store user-content rule): chat safety over the real WebSocket and the guild routes.
// - Phil 9 Oct "this game is 18+ for mature, cursing is ok": chat (world, region, guild, whispers, guild message) is never masked;
//   server/chat-filter.js only refuses a slur or hate term in a player or guild name (a curse word in a name is fine).
// - Block: a player's block list lives in the ledger; the blocked player's live lines, history and whispers stop reaching them
//   (server side, per player); unblock restores it.
// - Report (Phil 9 Oct): a reason is required. Racism / Sexual harassment go to Phil's moderation queue (DB.reports: the dev panel's
//   report list and the Integrity desk, where Ban is) with the full text, sender id, channel, time and the 10 surrounding lines;
//   Other goes to the feedback inbox.
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
  // ten lines of world chat before the one that gets reported (context for the moderation queue; 5 each, under the chat pace)
  for(let i=0;i<5;i++){ sb.send({t:'chat',channel:'world',text:'filler b'+i}); sc.send({t:'chat',channel:'world',text:'filler c'+i}); }
  await delay(600); sb.inbox.length=0; sc.inbox.length=0;
  // ---- no masking (18+) ----
  sa.send({t:'chat',channel:'world',text:'what the fuck is this sh1t'}); await delay(500);
  let mC=got(sc,m=>m.t==='chatmsg'), mB=got(sb,m=>m.t==='chatmsg');
  ok(mC.length===1&&mC[0].txt==='what the fuck is this sh1t','world chat goes out as typed - cursing is not masked ('+JSON.stringify(mC[0]&&mC[0].txt)+')');
  ok(mB.length===1,'B sees the line before blocking');
  const mid1=mC[0]&&mC[0].mid;
  ok(typeof mid1==='string'&&mid1.length>=8,'the line carries a server id for Report');
  sa.send({t:'chat',channel:'region',text:'a classic day in Scunthorpe'}); await delay(400);
  mC=got(sc,m=>m.t==='chatmsg'&&m.channel==='region');
  ok(mC.length===1&&mC[0].txt==='a classic day in Scunthorpe','region chat goes out as typed');
  // ---- block ----
  let r=await call('/api/chat/block',{name:A.name},B.token);
  ok(r.status===200&&r.data.ok&&(r.data.blocked||[]).some(x=>x.id===A.id),'B blocks A ('+(r.data.error||r.status)+')');
  await delay(400); ok(((disk().users[B.id].led||{}).blocked||[]).includes(A.id),'the block list is stored in B\'s ledger');
  sb.inbox.length=0; sc.inbox.length=0;
  sa.send({t:'chat',channel:'world',text:'second line'}); await delay(500);
  ok(got(sc,m=>m.t==='chatmsg'&&m.txt==='second line').length===1,'C still gets A\'s new line');
  ok(got(sb,m=>m.t==='chatmsg').length===0,'B does not get A\'s new line (blocked, server side)');
  sa.send({t:'whisper',to:B.name,text:'psst'}); sa.send({t:'whisper',to:C.name,text:'send me pics, sexy'}); await delay(500);
  ok(got(sb,m=>m.t==='whispermsg').length===0,'B does not get A\'s whisper');
  const wC=got(sc,m=>m.t==='whispermsg');
  ok(wC.length===1&&wC[0].txt==='send me pics, sexy'&&!!wC[0].mid,'C gets A\'s whisper as typed ('+JSON.stringify(wC[0]&&wC[0].txt)+')');
  // history on a fresh socket: B's leaves A out, C's keeps A; nobody is sent sender ids
  const sb2=await sock(B), sc2=await sock(C); await delay(500);
  const hB=got(sb2,m=>m.t==='chathist')[0]||{}, hC=got(sc2,m=>m.t==='chathist')[0]||{};
  const whoB=[...(hB.world||[]),...(hB.region||[])].map(x=>x.who), whoC=[...(hC.world||[]),...(hC.region||[])].map(x=>x.who);
  ok(Array.isArray(hB.world)&&!whoB.includes(A.name),'B\'s chat history leaves the blocked player out');
  ok(whoC.filter(w=>w===A.name).length===3,'C\'s chat history keeps all three of A\'s lines');
  ok(!JSON.stringify(hC).includes(A.id),'chat history never carries sender ids');
  // ---- names: a slur is refused, a curse word is fine; guild chat as typed, blocked member hidden ----
  const gc=await call('/api/guild/create',{name:'Kike Club'},A.token);
  ok(gc.status===400,'a slur in a guild name is refused ('+(gc.data.error||gc.status)+')');
  const gc2=await call('/api/guild/create',{name:'Shit Lords'},A.token); const g=gc2.data.guild; const gid=g&&g.id;
  ok(gc2.status===200&&!!gid,'a curse word in a guild name is allowed ('+(gc2.data.error||gc2.status)+')');
  await call('/api/guild/request',{guildId:gid},B.token); await call('/api/guild/approve',{id:B.id},A.token);
  await call('/api/guild/request',{guildId:gid},C.token); await call('/api/guild/approve',{id:C.id},A.token);
  const gm=await call('/api/guild/chat',{tx:'piss off'},A.token);
  ok(gm.status===200&&(gm.data.log||[]).some(e=>e.tx==='piss off'),'guild chat goes out as typed');
  const mo=await call('/api/guild/motd',{motd:'no bullshit allowed'},A.token);
  ok(mo.status===200&&mo.data.guild&&mo.data.guild.motd==='no bullshit allowed','the guild message goes out as typed');
  const gB=(await call('/api/guild/chat',{tx:'hello all'},B.token)).data.log||[], gC=(await call('/api/guild/chat',{tx:'hey'},C.token)).data.log||[];
  ok(!gB.some(e=>!e.sys&&e.id===A.id)&&gC.some(e=>!e.sys&&e.id===A.id),'B\'s guild chat hides A; C\'s shows A');
  // ---- report: a reason is required; racism / harassment -> moderation queue, other -> feedback inbox ----
  r=await call('/api/chat/report',{mid:mid1},C.token);
  ok(r.status===400,'a report without a reason is refused');
  r=await call('/api/chat/report',{mid:mid1,reason:'racism'},C.token);
  ok(r.status===200&&r.data.ok===true&&r.data.queue==='moderation','C reports A\'s world line for racism - moderation queue ('+(r.data.error||r.status)+')');
  r=await call('/api/chat/report',{mid:mid1,reason:'racism'},C.token);
  ok(r.status===200&&r.data.already===true,'reporting the same line twice files it once');
  r=await call('/api/chat/report',{mid:wC[0]&&wC[0].mid,reason:'harassment'},C.token);
  ok(r.status===200&&r.data.queue==='moderation','C reports A\'s whisper for sexual harassment - moderation queue');
  r=await call('/api/chat/report',{mid:wC[0]&&wC[0].mid,reason:'harassment'},B.token);
  ok(r.status===404,'a whisper can be reported only by the two players in it');
  r=await call('/api/chat/report',{mid:'nosuchline',reason:'other'},C.token);
  ok(r.status===404,'an unknown line is refused');
  r=await call('/api/chat/report',{mid:mid1,reason:'other'},B.token);
  ok(r.status===200&&r.data.queue==='feedback','an Other report goes to the feedback inbox');
  await delay(400); const dbx=disk();
  const mq=(dbx.reports||[]).filter(x=>x.kind==='moderation'&&x.reporterId===C.id);
  const mw=mq.find(x=>x.chat&&x.chat.channel==='world'), mh=mq.find(x=>x.chat&&x.chat.channel==='whisper');
  ok(mq.length===2&&mw&&mw.priority==='high'&&mw.reason==='racism'&&mw.userId===A.id&&mw.chat.senderId===A.id&&mw.chat.text==='what the fuck is this sh1t'&&mw.chat.t>0,
    'the racism report is in the moderation queue: high priority, full original text, sender id, channel, time');
  ok(Array.isArray(mw&&mw.context)&&mw.context.length===10&&mw.context.filter(c=>/^filler /.test(c.text)).length>=9&&!mw.context.some(c=>c.text===mw.chat.text),
    'it carries the 10 surrounding chat lines ('+(mw&&mw.context?mw.context.length:0)+')');
  const lst=(await call('/api/admin/reports',null,C.token)).status;
  ok(lst===403,'the moderation queue is admin-only');
  ok(mh&&mh.reason==='harassment'&&mh.chat.text==='send me pics, sexy'&&mh.chat.senderId===A.id,'the harassment report keeps the whisper text and sender');
  const ad=(dbx.feedback||[]).filter(f=>f.kind==='chat'&&f.userId===B.id);
  ok(ad.length===1&&ad[0].chat.senderId===A.id&&!(dbx.feedback||[]).some(f=>f.kind==='chat'&&f.userId===C.id),'Other is in the feedback inbox; racism / harassment are not');
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
