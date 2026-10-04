// 4 Oct 2026 second-pass fixes (v1011). Heavy reads are throttled per account (Arena N10, Market #15, Guild #12); a Tower refusal
// answers 400, not 200 (N13); reading Province state no longer saves the database every time (N14).
// (The sign-in / Tower / star-track receipt epoch, N9, is asserted in test_gear_epoch.js.)
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-v1011-'));
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
async function burst(route,n){ const st=[]; for(let i=0;i<n;i++) st.push((await call(route)).status); return st; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'v1011-'+Date.now()}); token=g.data.token; await call('/api/ledger');
  const lad=await burst('/api/arena/ladder',61);
  ok(!lad.slice(0,60).includes(429)&&lad[60]===429,'arena ladder: 60 reads a minute, the 61st is throttled ('+lad.slice(58).join(',')+')');
  const opp=await burst('/api/arena/opponents',61);
  ok(!opp.slice(0,60).includes(429)&&opp[60]===429,'arena opponents: the 61st read in a minute is throttled ('+opp.slice(58).join(',')+')');
  const well=await burst('/api/well/state',121);
  ok(!well.slice(0,120).includes(429)&&well[120]===429,'Starless Well: the 121st call in a minute is throttled ('+well.slice(118).join(',')+')');
  const tw=await call('/api/tower/ascend',{requestId:'tw-lv1'});
  ok(tw.status===400&&tw.data.ok===false,'a Tower refusal answers 400 ('+tw.status+' '+(tw.data.error||'')+')');
  await call('/api/province/state'); await delay(800);
  const before=fs.readFileSync(dbFile,'utf8'); await call('/api/province/state'); await delay(800);
  ok(fs.readFileSync(dbFile,'utf8')===before,'a second Province state read writes nothing');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_v1011.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
