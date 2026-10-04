// 4 Oct 2026 Account re-audit (v1013). N16: a suspended account cannot issue a server-switch code (/api/handoff ran before the ban
// gate). N12: a replay chip of any shape but {oppName:string, mine/mineSnap/foe: small arrays of {key:string}} is dropped (only the
// name was checked, so a chip with a malformed squad broke every viewer); world chat reaches only signed-in sockets that joined chat.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const WebSocket=require('ws');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-v1013-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
const sock=()=>new Promise((res,rej)=>{ const w=new WebSocket('ws://127.0.0.1:'+port); w.got=[]; w.on('message',d=>{ try{ w.got.push(JSON.parse(d.toString())); }catch(_){} }); w.on('open',()=>res(w)); w.on('error',rej); });
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const A=(await call('/api/register',{name:'v13a',pass:'password1'})).data, Bn=(await call('/api/register',{name:'v13b',pass:'password1'})).data;
  /* chip shape (guild chat) */
  const gc=await call('/api/guild/create',{name:'Chip Test'},A.token); ok(!!(gc.data.guild&&gc.data.guild.id),'guild created ('+(gc.data.error||'ok')+')');
  const good={oppName:'Rival',mineSnap:[{key:'vael'}],foe:[{key:'gruel'}],seed:1};
  await call('/api/guild/chat',{tx:'good chip',battle:good},A.token);
  await call('/api/guild/chat',{tx:'bad chip',battle:{oppName:'Rival',mineSnap:[{key:'vael'}],foe:'not-a-squad'}},A.token);
  await call('/api/guild/chat',{tx:'bad unit',battle:{oppName:'Rival',mineSnap:[7],foe:[{key:'gruel'}]}},A.token); await delay(400);
  const log=(Object.values(disk().guilds||{})[0]||{}).log||[];
  const byTx=t=>log.find(e=>e.tx===t)||{};
  ok(!!byTx('good chip').battle,'a well-formed chip is kept');
  ok(!byTx('bad chip').battle&&!byTx('bad unit').battle,'a chip with a malformed squad is dropped (the line is kept)');
  /* world chat reaches only signed-in sockets that joined chat */
  const anon=await sock(), wa=await sock(), wb=await sock();
  wa.send(JSON.stringify({t:'chatjoin',name:'v13a',token:A.token})); wb.send(JSON.stringify({t:'chatjoin',name:'v13b',token:Bn.token})); await delay(300);
  wa.send(JSON.stringify({t:'chat',channel:'world',text:'hello world v1013',token:A.token})); await delay(500);
  ok(wb.got.some(m=>m.t==='chatmsg'&&m.txt==='hello world v1013'),'a signed-in socket that joined chat receives world chat');
  ok(!anon.got.some(m=>m.t==='chatmsg'),'an unauthenticated socket does not receive world chat');
  for(const w of [anon,wa,wb]) try{ w.close(); }catch(_){}
  /* a suspended account cannot get a server-switch code */
  await delay(300); await stop(); const db=disk(); db.users[A.profile.id].bannedUntil=Date.now()+86400000; fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  const ho=await call('/api/handoff',{},A.token);
  ok(ho.status===403&&!ho.data.code,'a suspended account cannot issue a server-switch code ('+ho.status+' '+JSON.stringify(ho.data).slice(0,60)+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_v1013.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
