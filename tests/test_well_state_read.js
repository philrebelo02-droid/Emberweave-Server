// 3 Oct 2026 audit (Starless Well F11): GET /api/well/state wrote the WHOLE database on every read. Now a read saves only when it
// changed the player's run (a new cycle). Real server on a free port + temp DB, preloaded with tests/helpers/save-count-hook.cjs,
// which counts real disk saves: the first read (it creates the run) must save and survive a restart with the same map; four later
// unchanged reads must not save. Asserts (non-zero exit), raw pairs saved, module sha256 recorded.
// Control: WELL_MODULE=<absolute path to a pre-fix starless-well.js> is swapped in by the hook; the test must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), hook=path.join(__dirname,'helpers','save-count-hook.cjs'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-well-read-'));
const dbFile=path.join(dir,'db.json'), counter=path.join(dir,'saves.txt'), pairsFile=path.join(dir,'pairs.jsonl');
const modPath=process.env.WELL_MODULE||path.join(root,'server','starless-well.js'), sha=crypto.createHash('sha256').update(fs.readFileSync(modPath)).digest('hex');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['--require',hook,'server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,SAVE_COUNTER:counter},stdio:['ignore','ignore','pipe'],windowsHide:true});
  child.stderr.on('data',d=>{ const t=String(d); if(t.includes('[save-count-hook]')) process.stderr.write(t); });
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const saves=()=>fs.existsSync(counter)?fs.readFileSync(counter,'utf8').length:0;
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'well-read-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await delay(400); await stop();
  { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.users[id].led.px=113200; delete db.users[id].led.well2; fs.writeFileSync(dbFile,JSON.stringify(db)); }
  await start(); await delay(1500); const s0=saves();
  const r1=await call('/api/well/state'); ok(r1.status===200&&r1.data.grid,'first read creates the run');
  await delay(1500); const s1=saves(); ok(s1>s0,'the first read (a new run) is saved ('+s0+' -> '+s1+')');
  for(let i=0;i<4;i++){ await call('/api/well/state'); await delay(300); }
  await delay(1500); const s2=saves(); ok(s2===s1,'four unchanged reads do not save ('+s1+' -> '+s2+')');
  const map1=JSON.stringify(r1.data.grid); await stop(); await start(); const r2=await call('/api/well/state');
  ok(JSON.stringify(r2.data.grid)===map1,'the run created by a read survives a restart (same map)');
  console.log('test_well_state_read.js: '+pass+' checks passed (well module sha256 '+sha.slice(0,16)+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
