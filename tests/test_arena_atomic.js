// 4 Oct 2026 release review #8 (v1017): an arena win never reaches the disk without its receipt. ledTx flushed the gold reward to
// disk mid-route, before the receipt existed - a crash between the two left the reward on disk with no receipt, and the client's retry
// with the same requestId was paid again. A preload records, for every database file replacement, the player's gold and whether the
// receipt is in it.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-aatom-'));
const dbFile=path.join(dir,'db.json'), logFile=path.join(dir,'writes.jsonl'), hook=path.join(dir,'trackhook.cjs');
fs.writeFileSync(logFile,'');
fs.writeFileSync(hook,[
  "const fs=require('node:fs'),rename=fs.renameSync,lf=process.env.WRITE_LOG,tid=process.env.TRACK_ID;",
  "fs.renameSync=function(a,b){ const r=rename.apply(this,arguments);",
  "  if(b===process.env.DB_FILE&&tid){ try{ const t=fs.readFileSync(b,'utf8'), d=JSON.parse(t), u=d.users&&d.users[tid];",
  "    fs.appendFileSync(lf, JSON.stringify({gold:u&&u.led?u.led.gold:null, receipt:t.includes(tid+':arena:aatom-1')})+String.fromCharCode(10)); }catch(e){} }",
  "  return r; };"].join(String.fromCharCode(10)));
let port,base,child,token,id='',pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['--require',hook,srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,WRITE_LOG:logFile,TRACK_ID:id},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(600); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'aatom-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const g2=await call('/api/guest',{deviceId:'aatom2-'+Date.now()}); const oppId=g2.data.profile.id; await call('/api/ledger',null,g2.data.token);
  await editDB((db,u)=>{ u.led.px=900000; u.led.gold=12345; for(const k of ['vael','sylthaine','vireo','vex','gruel']){ u.led.unlocked[k]=true; u.led.hero[k]={xp:9000000,stars:5,pips:0}; }
    u.team=['vael','sylthaine','vireo','vex','gruel']; const o=db.users[oppId]; o.team=[]; o.wall=[]; });
  await delay(1200); fs.writeFileSync(logFile,'');
  const ar=await call('/api/arena/result',{oppId,won:true,requestId:'aatom-1'}); await delay(1500);
  const writes=fs.readFileSync(logFile,'utf8').split(String.fromCharCode(10)).filter(Boolean).map(l=>JSON.parse(l));
  ok(ar.data.won===true&&(ar.data.goldReward|0)>0,'the strong squad wins and is paid gold ('+JSON.stringify({won:ar.data.won,gold:ar.data.goldReward,err:ar.data.error})+')');
  ok(writes.length>0&&!writes.some(w=>w.gold!==12345&&!w.receipt),'no write puts the reward on disk without its receipt ('+JSON.stringify(writes)+')');
  const again=await call('/api/arena/result',{oppId,won:true,requestId:'aatom-1'});
  ok(again.data.goldReward===ar.data.goldReward&&again.data.rank===ar.data.rank,'the same requestId answers the same receipt');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_arena_atomic.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
