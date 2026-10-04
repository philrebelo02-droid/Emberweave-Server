// 4 Oct 2026 Account + World audits (v999): a player's 'balance' report is filed as a normal bug (only the dev balance bot writes
// the integrity list it could flood); /api/save refuses a non-object roster and a save above 1 MB; /api/pvp/attack-report is retired.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-acctw-'));
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
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'acctw-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const rb=await call('/api/report',{kind:'balance',text:'flood'});
  ok(rb.status===200&&/^FB-/.test(rb.data.id||''),'a player\'s balance report is filed as a normal report ('+(rb.data.id||JSON.stringify(rb.data))+')');
  const bad=await call('/api/save',{roster:'not an object'});
  ok(bad.status===400,'a save whose roster is not an object is refused ('+bad.status+')');
  const big=await call('/api/save',{roster:{__save:'x'.repeat(1024*1024+10)}});
  ok(big.status===413,'a save above 1 MB is refused ('+big.status+')');
  const okSave=await call('/api/save',{roster:{__save:JSON.stringify({gold:1})}});
  ok(okSave.status===200,'a normal save still works ('+okSave.status+')');
  const ar=await call('/api/pvp/attack-report',{defId:id,won:true});
  ok(ar.status===410,'/api/pvp/attack-report is retired ('+ar.status+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_account_world.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
