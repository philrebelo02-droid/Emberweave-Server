// 3 Oct 2026 audit (Witches Hut #12): GET /api/witch/state had only the blanket limit and recomputes every hero's power per call.
// It now allows 60 reads a minute per network; the panel reads once per open. Real server on a free port + temp DB: 60 reads
// answer 200, the 61st answers 429 with nothing else changed. Asserts (non-zero exit), records the server sha256.
// Control: WR_SERVER=<pre-fix server file in the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.WR_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-witch-rate-')), dbFile=path.join(dir,'db.json');
const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,srvFile))).digest('hex');
let port,base,child,token,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:'witch-rate-'+Date.now()})})).json(); token=g.token;
  const codes=[]; for(let i=0;i<61;i++){ const r=await fetch(base+'/api/witch/state',{headers:{'x-token':token}}); codes.push(r.status); }
  ok(codes.slice(0,60).every(c=>c===200),'60 reads answer 200 ('+[...new Set(codes.slice(0,60))].join(',')+')');
  ok(codes[60]===429,'the 61st read in a minute answers 429 (got '+codes[60]+')');
  console.log('test_witch_state_rate.js: '+pass+' checks passed (server '+srvFile+' sha256 '+sha.slice(0,16)+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
