// 4 Oct 2026 Arena/Campaign re-audit (v1015). N7: the stage card's "rewarded runs left today" on a guardian/boss stage comes from the
// server's own count (the NY day it pays on) - /api/campaign/stage publishes runsLeft; the card showed a browser counter on a 09:00 day.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-v1015-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const nyDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'v1015-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>{ u.led.camp.cleared=Math.max(u.led.camp.cleared|0,5); u.led.camp.runs={k:nyDay(),n3:2}; });
  const s3=await call('/api/campaign/stage?node=3');
  ok(s3.data.runsLeft===1,'a guardian stage with 2 of 3 runs used today publishes runsLeft 1 (got '+s3.data.runsLeft+')');
  const s2=await call('/api/campaign/stage?node=2');
  ok(s2.status===200&&s2.data.runsLeft===null,'an ordinary stage publishes no run count (got '+s2.data.runsLeft+')');
  await editDB((db,u)=>{ u.led.camp.runs={k:'2000-01-01',n3:3}; });
  const s3b=await call('/api/campaign/stage?node=3');
  ok(s3b.data.runsLeft===3,'yesterday\'s count does not carry into today (got '+s3b.data.runsLeft+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_v1015.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
