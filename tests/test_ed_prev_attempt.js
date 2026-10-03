// 3 Oct 2026 audit (Island of Trials #7; ChatGPT HOLD 03:43 on 2117b00f): a match started later - here or on another device -
// must not strand an earlier match's claim. Real server on a free port + temp DB, rename-failure preload hook:
//  three ordinary starts A, B, C -> rounds for A still accepted, A/B/C each claimable once, each paying exactly its stamina;
//  a server restart and a day rollover (edraft.day moved back while stopped) keep the unclaimed matches;
//  a claim under a failed save answers 503 with nothing moved, then the same request pays once;
//  an unclaimed match older than 24 h (not the latest) is no longer offered; the latest keeps its old no-age-limit behaviour.
// Asserts (non-zero exit), raw pairs saved, server sha256 recorded. Control: ED_SERVER=<pre-fix server file in the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.ED_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ed-prev-'));
const dbFile=path.join(dir,'db.json'), flag=path.join(dir,'FAIL'), hook=path.join(dir,'failhook.cjs'), pairsFile=path.join(dir,'pairs.jsonl');
fs.writeFileSync(hook,"const fs=require('node:fs'),rename=fs.renameSync;\nfs.renameSync=function(a,b){ if(b===process.env.DB_FILE&&fs.existsSync(process.env.FAIL_FLAG)) throw Error('injected rename failure'); return rename.apply(this,arguments); };\n");
const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,srvFile))).digest('hex');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['--require',hook,srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,FAIL_FLAG:flag},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const fail=on=>{ if(on) fs.writeFileSync(flag,'1'); else if(fs.existsSync(flag)) fs.unlinkSync(flag); };
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const stam=async()=>{ const l=(await call('/api/ledger')).data; const st=(l.ledger||l).stamina; return (st&&typeof st==='object'?st.v:st)|0; };
const editDB=async f=>{ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); f(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); };
const claim=(att,rid)=>call('/api/emberdraft/result',{requestId:rid,attemptId:att,place:3,rounds:16});
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'ed-prev-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(u=>{ u.led.px=113200; u.led.stamina=0; });
  const A=(await call('/api/emberdraft/start',{requestId:'edA'})).data.attemptId, B=(await call('/api/emberdraft/start',{requestId:'edB'})).data.attemptId, C=(await call('/api/emberdraft/start',{requestId:'edC'})).data.attemptId;
  ok(A&&B&&C&&new Set([A,B,C]).size===3,'three ordinary starts A, B, C');
  const rA=await call('/api/emberdraft/round',{attemptId:A,cps:[{r:1,hp:100,alive:8}]}); ok(rA.status===200&&rA.data.ok,'rounds for A still accepted after B and C started ('+rA.status+')');
  // restart + day rollover keep the unclaimed matches
  await editDB(u=>{ u.led.edraft.day='2000-01-01'; });
  const s0=await stam();
  // failed save on A's claim: 503, nothing moved; then the same request pays once
  fail(true); let fA; try{ fA=await claim(A,'claimA'); } finally { fail(false); }
  ok(fA.status===503&&fA.data.storageFailed===true,'claim A under a failed save answers 503 ('+fA.status+')');
  ok((await stam())===s0,'nothing moved on the refused save');
  const cA=await claim(A,'claimA'); ok(cA.status===200&&cA.data.ok===true&&(cA.data.stamina|0)>0,'claim A pays after restart + day rollover ('+cA.status+' '+JSON.stringify(cA.data).slice(0,70)+')');
  const s1=await stam(); ok(s1-s0===(cA.data.stamina|0),'A paid exactly once ('+s0+' -> '+s1+')');
  const cA2=await claim(A,'claimA-2'); ok(cA2.data.ok===false&&(await stam())===s1,'a second claim of A is refused and pays nothing');
  const cB=await claim(B,'claimB'); ok(cB.data.ok===true,'B still claimable'); const s2=await stam(); ok(s2-s1===(cB.data.stamina|0),'B paid exactly once');
  const cC=await claim(C,'claimC'); ok(cC.data.ok===true,'C (the latest) still claimable'); const s3=await stam(); ok(s3-s2===(cC.data.stamina|0),'C paid exactly once');
  // age bound: an unclaimed non-latest match older than 24 h is not offered; the latest keeps its old behaviour
  const D=(await call('/api/emberdraft/start',{requestId:'edD',god:false})).data.attemptId;
  const E=(await call('/api/emberdraft/start',{requestId:'edE'})).data.attemptId;
  if(D&&E){ await editDB(u=>{ const o=(u.led.edraft.open||[]).find(x=>x.id===D); if(o) o.startedAt=Date.now()-25*3600000; if(u.led.edraft.att) u.led.edraft.att.startedAt=Date.now()-25*3600000; });
    await call('/api/emberdraft/start',{requestId:'edF'}).catch(()=>{});
    const cD=await claim(D,'claimD'); ok(cD.data.ok===false,'a non-latest unclaimed match older than 24 h is no longer offered');
    const cE=await claim(E,'claimE'); ok(cE.data.ok===true,'the match that was latest before F (25 h old) is kept as before'); }
  else ok(false,'D/E starts available ('+D+','+E+')');

  // legacy one-slot form (2117b00f kept one unclaimed match in E.prevAtt): it must still be found after the upgrade
  await editDB(u=>{ u.led.edraft.used=0; });
  const P=(await call('/api/emberdraft/start',{requestId:'edP'})).data.attemptId, Q=(await call('/api/emberdraft/start',{requestId:'edQ'})).data.attemptId;
  ok(P&&Q,'two more starts for the legacy-form check');
  await editDB(u=>{ const E=u.led.edraft; const i=(E.open||[]).findIndex(x=>x.id===P); if(i>=0){ E.prevAtt=E.open[i]; E.open.splice(i,1); } });
  const rP=await call('/api/emberdraft/round',{attemptId:P,cps:[{r:1,hp:100,alive:8}]}); ok(rP.status===200&&rP.data.ok,'a match in the legacy prevAtt slot still accepts rounds after a restart ('+rP.status+')');
  const cP=await claim(P,'claimP'); ok(cP.data.ok===true,'and can still be claimed once');
  console.log('test_ed_prev_attempt.js: '+pass+' checks passed (server '+srvFile+' sha256 '+sha.slice(0,16)+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { fail(false); await stop(); } })();
