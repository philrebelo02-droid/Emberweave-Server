// 3 Oct 2026 Pool+Forge audit P2s (v994): the legacy /api/eq/craft is retired (410 - no screen calls it, it made a save-only item
// and its receipt was not durable); /api/pool/wish is limited to 60 a minute per player.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-pfp2-'));
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
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'pfp2-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const eq=await call('/api/eq/craft',{slot:'weapon',requestId:'eq-1'});
  ok(eq.status===410,'/api/eq/craft is retired (410; got '+eq.status+' '+JSON.stringify(eq.data).slice(0,70)+')');
  await editDB((db,u)=>{ u.led.gold=100000000; });
  let first429=0, oks=0;
  for(let i=0;i<64;i++){ const r=await call('/api/pool/wish',{pool:'gold',n:1,requestId:'pw-'+i}); if(r.status===429&&!first429) first429=i+1; if(r.data.ok) oks++; }
  ok(first429>=58&&first429<=62,'pool wishes are limited (~60 a minute; first 429 at wish '+first429+', '+oks+' paid)');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_pool_forge_p2.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
