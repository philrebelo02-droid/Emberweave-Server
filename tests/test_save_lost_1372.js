// v1372 SAVE LOST (12 Nov 2026, test_admin_delete_guild flaky 2 in 5 locally, once in suite c3bf2a12): a change acknowledged 200 ok
// never reached the save file. writeDB() acks at once and debounces the save (200 ms); when that save threw (on Windows: EPERM renaming
// db.json.tmp over a db.json another process was reading - the test's own disk() poll; anywhere: ENOSPC/EIO/EACCES) the error was logged
// and no save was ever scheduled again. A group save (saveSoon/writeDBNow inside a request) that cancelled the pending debounced timer
// and then failed dropped that change the same way. The acked change stayed in memory only until some unrelated save.
// Deterministic: a DIRECTORY at the temp-file path makes the save throw on every OS; it is removed after the failure, and the acked
// change must then reach disk on its own (the fix schedules a full retry, 250 ms backing off). No other request runs meanwhile.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-slost-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(admin){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:dbFile,ADMIN_IDS:admin||''},stdio:'ignore',windowsHide:true});
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
/* read the save only while no save can be running into it (no polling during the failure window - a reader on Windows is itself a fault) */
const onDisk=id=>{ for(let i=0;i<20;i++){ try{ return !!(JSON.parse(fs.readFileSync(dbFile,'utf8')).users||{})[id]; }catch(_){} } throw Error('db.json unreadable'); };
const waitGone=async(id,ms)=>{ for(const t0=Date.now();Date.now()-t0<ms;){ if(!onDisk(id)) return true; await delay(250); } return !onDisk(id); };
const block=f=>fs.mkdirSync(f), unblock=f=>fs.rmdirSync(f);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start('');
  const dev=(await call('/api/register',{name:'slostDev',pass:'password1'})).data; await delay(400); await stop(); await start(dev.profile.id);
  const devTok=(await call('/api/login',{name:'slostDev',pass:'password1'})).data.token;
  const A=(await call('/api/register',{name:'slostA',pass:'password1'})).data, B=(await call('/api/register',{name:'slostB',pass:'password1'})).data;
  await delay(600);
  ok(onDisk(A.profile.id)&&onDisk(B.profile.id),'both test players are on disk before the faults');

  /* 1. the debounced save fails once: the acked change must still reach disk */
  block(dbFile+'.tmp');
  const d1=await call('/api/admin/delete',{id:A.profile.id},devTok);
  ok(d1.status===200&&d1.data.ok===true,'the delete is acknowledged ('+(d1.data.error||d1.status)+')');
  await delay(700); unblock(dbFile+'.tmp');   // the 200 ms save has failed by now
  ok(await waitGone(A.profile.id,6000),'1. an acked writeDB() change reaches disk after its debounced save failed (it stayed in memory only)');

  /* 2. a group save cancels the pending debounced timer, then fails: the debounced change must still reach disk */
  block(dbFile+'.group.tmp');
  const [d2,lg]=await Promise.all([call('/api/admin/delete',{id:B.profile.id},devTok), delay(20).then(()=>call('/api/login',{name:'slostDev',pass:'password1'}))]);
  ok(d2.status===200&&d2.data.ok===true,'the second delete is acknowledged ('+(d2.data.error||d2.status)+')');
  const batchFailedFirst=lg.status===503;   // the login's group save ran inside the 200 ms window and failed (it cancelled the timer)
  await delay(700); unblock(dbFile+'.group.tmp');
  ok(await waitGone(B.profile.id,6000),'2. an acked writeDB() change reaches disk after a failed group save cancelled its timer (login '+lg.status+(batchFailedFirst?', group save failed first':', timer saved first')+')');

  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_save_lost_1372.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); for(const f of ['.tmp','.group.tmp']) try{ fs.rmdirSync(dbFile+f); }catch(_){} } })();
