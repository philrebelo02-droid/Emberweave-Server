// 3 Oct 2026 release review (ChatGPT): a READ that pays Academy income (GET /api/academy, GET /api/witch/state) commits durably before it
// answers. With the disk refusing the DB rename (preload hook + flag file, as test_durable_buildings.js) the read answers 503 storageFailed and
// neither the disk nor the live account moves; with the disk back, the next read pays the income once and it is on disk. Real server, free
// port, temp DB. Asserts, exits non-zero. Control: ARD_SERVER=<server before the durable read> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.ARD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-acad-read-'));
const dbFile=path.join(dir,'db.json'), flag=path.join(dir,'FAIL'), hook=path.join(dir,'failhook.cjs');
fs.writeFileSync(hook,"const fs=require('node:fs'),rename=fs.renameSync;\nfs.renameSync=function(a,b){ if(b===process.env.DB_FILE&&fs.existsSync(process.env.FAIL_FLAG)) throw Error('injected rename failure'); return rename.apply(this,arguments); };\n");
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['--require',hook,srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,FAIL_FLAG:flag},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const fail=on=>{ if(on) fs.writeFileSync(flag,'1'); else if(fs.existsSync(flag)) fs.unlinkSync(flag); };
async function call(route){ const r=await fetch(base+route,{headers:{'x-token':token}}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const editDB=async f=>{ await delay(400); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); f(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); };
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:'acad-read-'+Date.now()})})).json(); token=g.token; id=g.profile.id; await call('/api/ledger');
  const T0=Date.now()-10*3600000;
  await editDB(db=>{ const u=db.users[id]; u.led.px=20000; u.led.acad={lv:{academy:10,atk:0,hp:0,ap:0,def:0,armor:0,mr:0,crit:0,critres:0},learn:{},res:{iron:0,crystal:0,silver:0,coal:0},mineDay:null,incAt:T0}; });
  for(const route of ['/api/academy','/api/witch/state']){
    await delay(400); const before=JSON.stringify(disk().users[id].led.acad);
    fail(true); let r; try{ r=await call(route); await delay(500); } finally { fail(false); }
    ok(r.status===503&&r.data.storageFailed===true,route+': a read that pays income under a refused save answers 503 ('+r.status+')');
    ok(JSON.stringify(disk().users[id].led.acad)===before,route+': the disk did not move');
    // the live account did not move either: once the disk is back, the same income is paid exactly once, from the saved clock
  }
  const r2=await call('/api/academy'); ok(r2.status===200&&r2.data.res.iron>0,'disk back: the read pays the income ('+(r2.data.res&&r2.data.res.iron)+')');
  await delay(400); const d=disk().users[id].led.acad;
  ok(JSON.stringify(d.res)===JSON.stringify(r2.data.res)&&d.incAt>T0,'the paid income is on disk with the clock moved on');
  const r3=await call('/api/witch/state'); ok(r3.status===200&&JSON.stringify(r3.data.res)===JSON.stringify(r2.data.res),'the Hut read straight after pays nothing more');
  console.log('test_academy_read_durable.js: '+pass+' checks passed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { fail(false); await stop(); } })();
