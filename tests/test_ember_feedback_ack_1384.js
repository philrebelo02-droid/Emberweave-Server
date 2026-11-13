// v1384 (Grok, Claude 12 Nov 21:49) EMBER ACK STICKS. Live S1: forwarded S2-5 reports and cheat ids came back on every Ember pull and
// POST /api/ember/feedback/ack answered acknowledged:0. Cause: since v1383 the pull also sends the ids Phil resolved (done) and the dev
// panel's moderation actions every time, with no way to ack them - those items were already received, so the ack matched nothing.
// Fixture (throwaway servers, temp DBs, plain + DB_STORE=split): a forwarded Server 2 report (the real link-secret route), a dev-grant
// cheat item and a local report are appended through feedbackAppend; GET shows them; ack; gone. Phil resolves the forwarded and the cheat
// item in the dev panel; GET sends them in done + actions; ack -> acknowledged>0; GET no longer sends them; hard restart; still gone;
// a reopen + resolve is sent again once; nothing lost or duplicated. CONTROL: EW_ROOT=<main checkout> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=process.env.EW_ROOT||path.join(__dirname,'..');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let pass=0,fail=0;const check=(ok,msg)=>{ if(ok){pass++;console.log('  PASS '+msg);} else {fail++;console.log('  FAIL '+msg);} };
async function run(split){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-emberack-')),dbFile=path.join(temp,'db.json');
  let port=await freePort(),base='http://127.0.0.1:'+port,child=null,token='',adminId='';
  const start=async()=>{ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',PORT:String(port),DB_FILE:dbFile,
      ACCOUNT_LINK_SECRET:'fixture-link',ACCOUNT_AUTHORITY:'',ADMIN_IDS:adminId,DB_STORE:split?'split':''},stdio:'ignore',windowsHide:true});
    for(const t0=Date.now();Date.now()-t0<60000;){ if(child.exitCode!==null) throw Error('throwaway server exited'); try{ if((await fetch(base+'/health')).ok) return; }catch(_){} await delay(100); }
    throw Error('throwaway server did not start'); };
  const stop=async()=>{ if(!child) return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{child.kill('SIGKILL');}catch(_){} await delay(50); } child=null; };
  const call=async(route,method='GET',data,h={})=>{ const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json','x-token':token,...h},body:data?JSON.stringify(data):undefined}); return {status:r.status,data:await r.json()}; };
  const keysOf=feed=>(feed.data.actions||[]).map(x=>x.key);
  try{
    console.log((split?'DB_STORE=split':'plain db.json')+':');
    await start();
    const g=await call('/api/guest','POST',{deviceId:'emberack-'+Date.now()}); token=g.data.token; adminId=g.data.profile.id;
    await delay(300); await stop(); await start();
    // 1. append: a forwarded Server 2 report, a cheat item (dev grant), a local report
    const fw=await call('/api/internal/account/feedback','POST',{server:'2',item:{id:'FB-412e006146d04ad5',userId:'u-s2',name:'Phil',kind:'bug',text:'S2 test report',t:Date.now()}},{'x-link-secret':'fixture-link'});
    const fwId=fw.data.id; assert.strictEqual(fwId,'S2-FB-412e006146d04ad5');
    assert.strictEqual((await call('/api/admin/led-grant','POST',{gold:5000001})).status,200);
    const bug=await call('/api/report','POST',{text:'A local test report'}); assert.strictEqual(bug.status,200);
    const f1=await call('/api/ember/feedback'); const cheat=f1.data.items.find(x=>x.kind==='cheat'); const ids1=f1.data.items.map(x=>x.id);
    check(ids1.includes(fwId)&&cheat&&ids1.includes(bug.data.id),'GET shows the forwarded S2 report, the cheat item and the local report');
    const a1=await call('/api/ember/feedback/ack','POST',{ids:ids1});
    check(a1.data.acknowledged===ids1.length,'ack of the unread items: acknowledged '+a1.data.acknowledged+' of '+ids1.length);
    const f2=await call('/api/ember/feedback'); check(f2.data.items.length===0,'GET after the ack: no items');
    // 2. Phil resolves the forwarded report and the cheat item in the dev panel
    assert.strictEqual((await call('/api/admin/feedback','POST',{id:fwId,done:true})).status,200);
    assert.strictEqual((await call('/api/admin/feedback','POST',{id:cheat.id,done:true})).status,200);
    const f3=await call('/api/ember/feedback');
    check(f3.data.done.includes(fwId)&&f3.data.done.includes(cheat.id),'GET sends both resolves in done');
    const acts=(f3.data.actions||[]).filter(x=>x.act==='feedback:done');
    check(acts.length===2&&acts.every(x=>typeof x.key==='string'&&x.key),'GET sends both feedback:done actions, each with an ack key');
    const a2=await call('/api/ember/feedback/ack','POST',{ids:[...f3.data.done,...keysOf(f3)]});
    check(a2.data.acknowledged>0,'ack of the done ids + action keys: acknowledged '+a2.data.acknowledged+' (main: 0)');
    check(a2.data.acknowledged===4,'acknowledged = 2 resolves + 2 actions');
    const f4=await call('/api/ember/feedback');
    check(!f4.data.done.includes(fwId)&&!f4.data.done.includes(cheat.id),'GET after the ack: the resolves are not sent again');
    check((f4.data.actions||[]).length===0,'GET after the ack: the actions are not sent again');
    const a3=await call('/api/ember/feedback/ack','POST',{ids:[fwId,cheat.id]});
    check(a3.data.acknowledged===0,'a second ack of the same ids changes nothing');
    // 3. hard restart: still gone
    await delay(500); await stop(); await start();
    const f5=await call('/api/ember/feedback');
    check(f5.data.items.length===0&&!f5.data.done.includes(fwId)&&!f5.data.done.includes(cheat.id)&&(f5.data.actions||[]).length===0,'after a restart: no items, no done, no actions come back');
    // 4. a reopen + new resolve is sent once more, then acked away
    await call('/api/admin/feedback','POST',{id:fwId,done:false}); await delay(5); await call('/api/admin/feedback','POST',{id:fwId,done:true});
    const f6=await call('/api/ember/feedback');
    check(f6.data.done.includes(fwId)&&!f6.data.done.includes(cheat.id),'a new resolve of the S2 report is sent again (only it)');
    const a6=await call('/api/ember/feedback/ack','POST',{ids:[...f6.data.done,...keysOf(f6)]});
    const f7=await call('/api/ember/feedback');
    check(a6.data.acknowledged>0&&!f7.data.done.includes(fwId)&&(f7.data.actions||[]).length===0,'and acked away again');
    // 5. nothing lost or duplicated
    const all=await call('/api/admin/feedback?all=1');
    const list=all.data.items||all.data.feedback||all.data.list||[];
    check(list.filter(x=>x.id===fwId).length===1&&list.filter(x=>x.id===bug.data.id).length===1,'the S2 report and the local report are each still there exactly once');
    const again=await call('/api/internal/account/feedback','POST',{server:'2',item:{id:'FB-412e006146d04ad5',userId:'u-s2',name:'Phil',kind:'bug',text:'S2 test report',t:Date.now()}},{'x-link-secret':'fixture-link'});
    const f8=await call('/api/ember/feedback');
    check(again.data.id===fwId&&!f8.data.items.some(x=>x.id===fwId),'a repeat forward of the same S2 report does not bring it back');
    if(!split){ await delay(500); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8'));
      const ids=db.feedback.map(x=>x.id); check(new Set(ids).size===ids.length&&ids.includes(cheat.id)&&ids.includes(fwId),'db.json: every item once, the cheat + S2 items kept');
      const it=db.feedback.find(x=>x.id===fwId); check(it.received&&it.doneAcked===it.adminDone,'db.json: the S2 report is received and its resolve acked'); }
  } finally { await stop(); const r=path.resolve(temp); if(r.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(r).startsWith('ew-emberack-')) fs.rmSync(r,{recursive:true,force:true}); }
}
(async()=>{ await run(false); await run(true);
  console.log('test_ember_feedback_ack_1384: '+pass+'/'+(pass+fail)+' passed'); if(fail) process.exitCode=1; })().catch(e=>{ console.error(e); process.exitCode=1; });
