// 3 Oct 2026 Guild audit #7 (v976): /api/watch/report was a synchronous full-database save on every Watch Tower tab tap and
// march start, with no limit. An UNCHANGED report now answers {ok:true} (the same body as a save) without touching the disk; a changed report is
// still saved before it is acknowledged, at most 12 a minute per player (then 429).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-wrate-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const mtime=()=>fs.statSync(dbFile).mtimeMs;
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'wrate-'+Date.now()}); token=g.data.token; await call('/api/ledger'); await delay(500);
  const rep={attacks:[{name:'Ashgate',eta:30,ret:false}],defends:[],scouts:[]};
  const r1=await call('/api/watch/report',rep);
  ok(r1.status===200&&r1.data.ok===true,'a new report is saved ('+r1.status+')');
  await delay(300); const m1=mtime(), b1=fs.readFileSync(dbFile,'utf8');
  const r2=await call('/api/watch/report',rep); await delay(50);
  ok(r2.status===200&&JSON.stringify(r2.data)===JSON.stringify(r1.data),'the same report again answers exactly like the first ('+JSON.stringify(r2.data)+')');
  ok(mtime()===m1&&fs.readFileSync(dbFile,'utf8')===b1,'an unchanged report does not write the database');
  let first429=0;
  for(let i=0;i<14;i++){ const r=await call('/api/watch/report',{attacks:[{name:'Row'+i,eta:i,ret:false}],defends:[],scouts:[]}); if(r.status===429&&!first429) first429=i+1; }
  ok(first429>0&&first429<=13,'changed reports are limited per minute (first 429 at call '+first429+' of 14 after one earlier save)');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_watch_report_rate.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
