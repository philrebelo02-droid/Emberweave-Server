// 4 Oct 2026 Guild re-audit #5 (v1012): deleting an account (dev panel) takes it out of its guild first. It stayed a ghost member,
// and a deleted LEADER froze the guild. Leadership passes to the longest-standing member; an emptied guild is disbanded.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-adel-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(admin){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,ADMIN_IDS:admin||''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start('');
  const dev=(await call('/api/register',{name:'adelDev',pass:'password1'})).data; await delay(400); await stop(); await start(dev.profile.id);
  const devTok=(await call('/api/login',{name:'adelDev',pass:'password1'})).data.token;
  const L=(await call('/api/register',{name:'adelLead',pass:'password1'})).data, M=(await call('/api/register',{name:'adelMem',pass:'password1'})).data;
  await call('/api/ledger',null,L.token); await call('/api/ledger',null,M.token); await delay(400); await stop(); { const db=disk(); for(const u of [L,M]) db.users[u.profile.id].led=Object.assign(db.users[u.profile.id].led||{},{px:1000}); fs.writeFileSync(dbFile,JSON.stringify(db)); } await start(dev.profile.id);   // v1087: the Guild Hall opens at level 13
  const gc=await call('/api/guild/create',{name:'Ghost Test'},L.token); const gid=gc.data.guild&&gc.data.guild.id;
  ok(!!gid,'guild created ('+(gc.data.error||'ok')+')');
  await call('/api/guild/request',{guildId:gid},M.token); const ap=await call('/api/guild/approve',{id:M.profile.id},L.token);
  ok(ap.status===200,'member approved ('+(ap.data.error||ap.status)+')');
  const d1=await call('/api/admin/delete',{id:L.profile.id},devTok);
  ok(d1.status===200,'leader account deleted ('+(d1.data.error||d1.status)+')'); await delay(400);
  const g1=(disk().guilds||{})[gid]||{};
  ok(JSON.stringify(g1.members)===JSON.stringify([M.profile.id])&&g1.leader===M.profile.id,'the deleted leader left the guild and the member leads it ('+JSON.stringify({members:g1.members,leader:g1.leader})+')');
  await call('/api/admin/delete',{id:M.profile.id},devTok); await delay(400);
  ok(!(disk().guilds||{})[gid],'deleting the last member disbands the guild');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_admin_delete_guild.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
