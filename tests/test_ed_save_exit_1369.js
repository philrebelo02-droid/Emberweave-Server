// v1369 (Phil 11 Nov 2026: "Do it like spire" / "Save and exit option") - Emberdraft SAVE AND EXIT, the server side.
// Real server on a free port + temp DB. A saved match continues only while its attempt is open and the save is not behind the
// server's own round reports; each Continue takes a lease and every other copy of the match is refused; one claim per attempt.
//  - resume peek: ok for a current save; dropped when behind the reports (a rewind); a post-fight save may trail one report;
//  - /round {fight:r} records the fight that began (fightR) and the verdict hands it back;
//  - Continue spends no attempt; reports and claims without the current lease are refused (stale, 409 on /round);
//  - the leased copy claims once; Continue after the claim, a reported knockout, or an unknown attempt is dropped;
//  - a match that was never continued works exactly as before (no lease needed).
// Control: ED_SERVER=<path to the pre-change server.js> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=path.resolve(root,process.env.ED_SERVER||'server.js'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ed-save-'));
const dbFile=path.join(dir,'db.json'), pairsFile=path.join(dir,'pairs.jsonl');
const sha=crypto.createHash('sha256').update(fs.readFileSync(srvFile)).digest('hex');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const stam=async()=>{ const l=(await call('/api/ledger')).data; const st=(l.ledger||l).stamina; return (st&&typeof st==='object'?st.v:st)|0; };
const editDB=async f=>{ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); f(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); };
const cps=(a,b,hp)=>{ const o=[]; for(let r=a;r<=b;r++) o.push({r,hp:hp-r,alive:8,pl:0,ms:r*20000}); return o; };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'ed-save-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(u=>{ u.led.px=113200; u.led.stamina=0; });
  const A=(await call('/api/emberdraft/start',{requestId:'edsA'})).data.attemptId; ok(A,'match A started');
  const used0=(await call('/api/emberdraft/state',{})).data.edraft.used;
  ok((await call('/api/emberdraft/round',{attemptId:A,cps:cps(1,3,100)})).data.ok,'rounds 1-3 reported (no lease needed before any Continue)');
  // the verdict (peek) - a save of round r has posted r-1 rounds
  let v=(await call('/api/emberdraft/resume',{attemptId:A,round:4,stage:'plan',peek:true})).data;
  ok(v.ok===true&&v.have===3&&!v.lease,'a current save (round 4 planning, 3 reported) may continue; peek takes no lease ('+JSON.stringify(v)+')');
  v=(await call('/api/emberdraft/resume',{attemptId:A,round:3,stage:'plan',peek:true})).data;
  ok(v.ok===false&&v.drop===true,'a save from round 3 planning after round 3 was reported is a rewind - dropped');
  v=(await call('/api/emberdraft/resume',{attemptId:A,round:3,stage:'after',peek:true})).data;
  ok(v.ok===true,'a save taken just after round 3\'s fight may trail that round\'s report by one');
  v=(await call('/api/emberdraft/resume',{attemptId:A,round:2,stage:'after',peek:true})).data;
  ok(v.ok===false&&v.drop===true,'two rounds behind is never honest - dropped');
  // the fight that began
  ok((await call('/api/emberdraft/round',{attemptId:A,cps:[],fight:4})).data.ok,'round 4\'s fight began (reported)');
  v=(await call('/api/emberdraft/resume',{attemptId:A,round:4,stage:'plan',peek:true})).data;
  ok(v.ok===true&&v.fightR===4,'the verdict tells the client round 4\'s fight had begun (fightR '+v.fightR+') - it takes that fight\'s result or a loss');
  // Continue: a lease, no attempt spent
  const L1=(await call('/api/emberdraft/resume',{attemptId:A,round:4,stage:'fight'})).data; ok(L1.ok&&L1.lease,'Continue takes a lease');
  ok((await call('/api/emberdraft/state',{})).data.edraft.used===used0,'Continue spends no attempt ('+used0+')');
  let r=await call('/api/emberdraft/round',{attemptId:A,cps:cps(4,4,100)}); ok(r.status===409&&r.data.stale===true,'a report without the lease is refused (another copy of the match) - '+r.status);
  r=await call('/api/emberdraft/round',{attemptId:A,lease:L1.lease,cps:cps(4,4,100)}); ok(r.status===200&&r.data.ok,'the leased copy reports');
  const L2=(await call('/api/emberdraft/resume',{attemptId:A,round:5,stage:'plan'})).data; ok(L2.ok&&L2.lease&&L2.lease!==L1.lease,'a second Continue takes a new lease');
  r=await call('/api/emberdraft/round',{attemptId:A,lease:L1.lease,cps:cps(5,5,100)}); ok(r.status===409&&r.data.stale,'the first copy is now stale');
  const s0=await stam();
  let c=await call('/api/emberdraft/result',{requestId:'edsC1',attemptId:A,lease:L1.lease,place:3,rounds:16});
  ok(c.data.ok===false&&c.data.stale===true&&(await stam())===s0,'the stale copy cannot claim, and nothing is paid');
  await call('/api/emberdraft/round',{attemptId:A,lease:L2.lease,cps:cps(5,15,100).concat([{r:16,hp:0,alive:2,pl:3,ms:400000}])});
  await editDB(u=>{ u.led.edraft.att.startedAt=Date.now()-3600000; });
  c=await call('/api/emberdraft/result',{requestId:'edsC2',attemptId:A,lease:L2.lease,place:3,rounds:16});
  const s1=await stam(); ok(c.data.ok===true&&(c.data.stamina|0)>0&&s1-s0===(c.data.stamina|0),'the leased copy claims once ('+s0+' -> '+s1+')');
  c=await call('/api/emberdraft/result',{requestId:'edsC3',attemptId:A,lease:L2.lease,place:1,rounds:16});
  ok(c.data.ok===false&&(await stam())===s1,'a second claim is refused - one attempt, one reward');
  v=(await call('/api/emberdraft/resume',{attemptId:A,round:10,stage:'plan',peek:true})).data;
  ok(v.ok===false&&v.drop===true,'Continue after the claim is dropped');
  v=(await call('/api/emberdraft/resume',{attemptId:A,round:10,stage:'plan'})).data;
  ok(v.ok===false&&!v.lease,'and no lease is handed out for it');
  v=(await call('/api/emberdraft/resume',{attemptId:'ednope',round:3,stage:'plan',peek:true})).data;
  ok(v.ok===false&&v.drop===true,'an unknown / closed attempt is dropped');
  // a reported knockout ends the match: no Continue
  const B=(await call('/api/emberdraft/start',{requestId:'edsB'})).data.attemptId;
  await call('/api/emberdraft/round',{attemptId:B,cps:[{r:1,hp:100,alive:8},{r:2,hp:0,alive:7,pl:8}]});
  v=(await call('/api/emberdraft/resume',{attemptId:B,round:3,stage:'plan',peek:true})).data;
  ok(v.ok===false&&v.drop===true,'a match whose knockout was reported cannot be continued');
  // a match never continued is untouched by any of this
  const C=(await call('/api/emberdraft/start',{requestId:'edsCc'})).data.attemptId;
  ok((await call('/api/emberdraft/round',{attemptId:C,cps:cps(1,2,100)})).status===200,'an ordinary match reports with no lease, as before');
  // the lease survives a restart
  const L3=(await call('/api/emberdraft/resume',{attemptId:C,round:3,stage:'plan'})).data; await editDB(()=>{});
  r=await call('/api/emberdraft/round',{attemptId:C,cps:cps(3,3,100)}); ok(r.status===409,'after a server restart the lease still guards the match');
  r=await call('/api/emberdraft/round',{attemptId:C,lease:L3.lease,cps:cps(3,3,100)}); ok(r.status===200,'and the leased copy goes on');
  console.log('test_ed_save_exit_1369.js: '+pass+' checks passed (server sha256 '+sha.slice(0,16)+', pairs '+pairsFile+')');
}catch(e){ console.error('FAIL after '+pass+' checks:',e.message); process.exitCode=1; } finally{ await stop(); } })();
