// 3 Oct 2026 audit (Island of Trials #7): a match started on another device must not strand the first match's claim.
// Real server on a free port + temp DB: start A, start B (another device, new requestId), claim A -> paid once; claim A again ->
// refused; claim B -> paid; round checkpoints for A still accepted after B started. Asserts (non-zero exit), raw pairs saved,
// server file sha256 recorded. Control: ED_SERVER=<other server file in the repo root> (e.g. the pre-fix server) must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.ED_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ed-prev-')), dbFile=path.join(dir,'db.json');
const pairsFile=path.join(dir,'pairs.jsonl'), sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,srvFile))).digest('hex');
let port,base,child,token,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const stam=async()=>{ const l=(await call('/api/ledger')).data; const st=(l.ledger||l).stamina; return (st&&typeof st==='object'?st.v:st)|0; };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'ed-prev-'+Date.now()}); token=g.data.token; const id=g.data.profile.id; await call('/api/ledger');
  await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.users[id].led.px=113200; db.users[id].led.stamina=0; fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  const a=await call('/api/emberdraft/start',{requestId:'edA'}); ok(a.status===200&&a.data.attemptId,'match A started');
  const b=await call('/api/emberdraft/start',{requestId:'edB'}); ok(b.status===200&&b.data.attemptId&&b.data.attemptId!==a.data.attemptId,'match B started on another device');
  const rA=await call('/api/emberdraft/round',{attemptId:a.data.attemptId,cps:[{r:1,hp:100,alive:8}]}); ok(rA.status===200&&rA.data.ok,'round checkpoints for A still accepted after B started');
  const s0=await stam();
  const cA=await call('/api/emberdraft/result',{requestId:'claimA',attemptId:a.data.attemptId,place:3,rounds:16});
  ok(cA.status===200&&cA.data.ok===true&&(cA.data.stamina|0)>0,'claim A pays after B started ('+cA.status+' '+JSON.stringify(cA.data).slice(0,90)+')');
  const s1=await stam(); ok(s1-s0===(cA.data.stamina|0),'stamina rose by exactly the claim ('+s0+' -> '+s1+')');
  const cA2=await call('/api/emberdraft/result',{requestId:'claimA-again',attemptId:a.data.attemptId,place:1,rounds:16});
  ok(cA2.data.ok===false&&(await stam())===s1,'a second claim of A is refused and pays nothing');
  const cB=await call('/api/emberdraft/result',{requestId:'claimB',attemptId:b.data.attemptId,place:3,rounds:16});
  ok(cB.status===200&&cB.data.ok===true,'claim B still pays');
  const s2=await stam(); ok(s2-s1===(cB.data.stamina|0),'B paid exactly once ('+s1+' -> '+s2+')');
  console.log('test_ed_prev_attempt.js: '+pass+' checks passed (server '+srvFile+' sha256 '+sha.slice(0,16)+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
