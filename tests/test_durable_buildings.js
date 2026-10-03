// 3 Oct 2026 audit (P1): a failed save must not be acknowledged. For one money/progress route in each audited building
// (Vault resolve, Witches Hut buy-brew, Emberdraft start, Island trial resolve, Starless Well resolve) the disk is made to
// refuse the write (a preload hook fails the DB rename while a flag file exists) and the route must answer 503
// storageFailed with the account - and the Vault climb - exactly as before; with the disk back, the SAME requestId
// succeeds once. Control: the same flow with the flag off must succeed (the hook itself is proven not to break saves).
const assert=require('assert'), fs=require('fs'), os=require('os'), path=require('path'), net=require('net'), {spawn}=require('child_process');
const root=path.join(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-durable-bld-'));
const dbFile=path.join(dir,'db.json'), flag=path.join(dir,'FAIL'), hook=path.join(dir,'failhook.cjs');
fs.writeFileSync(hook,"const fs=require('node:fs'),rename=fs.renameSync;\nfs.renameSync=function(a,b){ if(b===process.env.DB_FILE&&fs.existsSync(process.env.FAIL_FLAG)) throw Error('injected rename failure'); return rename.apply(this,arguments); };\n");
let port,base,child,token,log='',pass=0;
const ok=(c,m)=>{ assert(c,m); pass++; };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['--require',hook,'server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,FAIL_FLAG:flag},stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.stdout.on('data',x=>log+=x); child.stderr.on('data',x=>log+=x);
  for(let i=0;i<150;i++){ if(child.exitCode!==null)throw Error('server exited: '+log.slice(-600)); try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const fail=on=>{ if(on) fs.writeFileSync(flag,'1'); else if(fs.existsSync(flag)) fs.unlinkSync(flag); };
const led=async()=>{ const r=(await call('/api/ledger')).data; return r.ledger||r; };
const win=(att,ids,rid)=>({requestId:rid,attemptId:att,won:true,stars:3,digest:JSON.stringify({won:true,t:1,u:ids.map(k=>[k,'ally',1,999999,100])}),inputLog:[]});
// one failing-disk round: snapshot what must not move, run under failure, check 503 + unchanged, retry the same id with the disk back
async function round(name,run,observe){
  const before=JSON.stringify(await observe());
  fail(true); let r; try{ r=await run(); } finally { fail(false); }
  ok(r.status===503&&r.data.storageFailed===true,name+': failed save answers 503 (got '+r.status+' '+JSON.stringify(r.data).slice(0,100)+')');
  ok(JSON.stringify(await observe())===before,name+': nothing moved after the refused save');
  const again=await run(); ok(again.status===200&&again.data.ok!==false,name+': same requestId succeeds once the disk works ('+again.status+' '+JSON.stringify(again.data).slice(0,80)+')');
  const third=await run(); ok(JSON.stringify(third.data.reward||third.data.result||third.data.ok)===JSON.stringify(again.data.reward||again.data.result||again.data.ok),name+': replay returns the same reply');
  return again; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'durable-bld-'+Date.now()}); token=g.data.token; const id=g.data.profile.id; await call('/api/ledger'); await call('/api/witch/state');
  await delay(400); await stop();
  const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const u=db.users[id];
  u.led.px=113200; u.led.gems=5000; const heroes=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5);
  for(const k of heroes) u.led.unlocked[k]=true; u.team=heroes.map(k=>({key:k}));
  fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  // control: the hook does not break a normal save
  const ctl=await call('/api/emberdraft/state',{}); ok(ctl.status===200,'control: a normal request saves with the hook loaded');
  // VAULT: resolve a started floor
  const vs=await call('/api/dungeon/start-battle',{heroIds:heroes,requestId:'vs1'}); ok(vs.status===200&&vs.data.attemptId,'vault start ('+JSON.stringify(vs.data).slice(0,80)+')');
  await round('vault resolve',()=>call('/api/dungeon/resolve-battle',{attemptId:vs.data.attemptId,won:true,requestId:'vr1'}),
    async()=>{ const s=(await call('/api/dungeon/status')).data; const l=await led(); return {floor:s.currentFloor||(s.progress&&s.progress.currentFloor),best:s.highestClearedFloor||(s.progress&&s.progress.highestClearedFloor),dust:l.dust,gold:l.gold}; });
  // WITCHES HUT: buy brew with a part-empty cauldron
  await call('/api/witch/state'); await delay(400); await stop(); { const d=JSON.parse(fs.readFileSync(dbFile,'utf8')); assert(d.users[id].witch,'hut state exists at level 20+'); d.users[id].witch.brew=d.users[id].witch.brew*0.3; fs.writeFileSync(dbFile,JSON.stringify(d)); } await start();
  await round('witch buy-brew',()=>call('/api/witch/buy-brew',{requestId:'wb1',tier:'first'}),
    async()=>{ const w=(await call('/api/witch/state')).data; return {brew:Math.round(w.brew),gems:(await led()).gems,offer:w.offer}; });
  // EMBERDRAFT: start a free attempt
  const es=await round('emberdraft start',()=>call('/api/emberdraft/start',{requestId:'es1',heroIds:heroes}),
    async()=>{ const e=(await call('/api/emberdraft/state',{})).data; return e.edraft||e; });
  // ChatGPT review: a flagged result (1st after 0 rounds) under a failed save must not leave its review flag behind
  const attId=es.data.attemptId; const flagsOnDisk=async()=>{ await delay(400); await stop(); const d=JSON.parse(fs.readFileSync(dbFile,'utf8')); await start();
    return {fb:(d.feedback||[]).filter(f=>f.signal==='emberdraft:'+attId).length, rp:(d.reports||[]).filter(r=>r.kind==='emberdraft-flag'&&r.userId===id).length}; };
  fail(true); let er; try{ er=await call('/api/emberdraft/result',{requestId:'er1',attemptId:attId,place:1,rounds:0}); } finally { fail(false); }
  ok(er.status===503&&er.data.storageFailed===true,'emberdraft flagged result under a failed save answers 503');
  ok((await call('/api/witch/buy-brew',{requestId:'wb-other',tier:'first'})).status<500,'an unrelated later save succeeds');
  let fl=await flagsOnDisk(); ok(fl.fb===0&&fl.rp===0,'no review flag or report survives the refused result ('+JSON.stringify(fl)+')');
  const er2=await call('/api/emberdraft/result',{requestId:'er1',attemptId:attId,place:1,rounds:0}); ok(er2.status===200&&er2.data.ok===true,'same request succeeds once the disk works (review-first: paid '+er2.data.stamina+')');
  await call('/api/emberdraft/result',{requestId:'er1',attemptId:attId,place:1,rounds:0});
  fl=await flagsOnDisk(); ok(fl.fb===1&&fl.rp===1,'exactly one flag and one report after the saved result + replay ('+JSON.stringify(fl)+')');
  // ISLAND TRIAL: a dungeon trial floor
  await round('trial resolve',()=>call('/api/trial/resolve',{kind:'dungeon',floor:1,heroIds:heroes,requestId:'tr1'}),
    async()=>{ const l=await led(); return {gold:l.gold,trial:l.trial,eq:l.eqMats}; });
  // STARLESS WELL: resolve a fight
  const st=(await call('/api/well/state')).data; const row=[0,1,2].find(r=>st.grid&&st.grid[1]&&st.grid[1][r]);
  const ws=await call('/api/well/start',{requestId:'ws1',col:1,row,heroIds:heroes}); ok(ws.status===200&&ws.data.attemptId,'well start ('+JSON.stringify(ws.data).slice(0,80)+')');
  await round('well resolve',()=>call('/api/well/resolve',win(ws.data.attemptId,heroes,'wr1')),
    async()=>{ const s=(await call('/api/well/state')).data; return {pos:s.pos,prizes:(s.prizes||[]).length,gold:(await led()).gold}; });
  // restart: what succeeded is on disk
  await delay(400); await stop(); await start();
  const s2=(await call('/api/well/state')).data; ok(s2.pos&&s2.pos.col===1,'well progress survived a restart');
  console.log('test_durable_buildings.js: '+pass+' checks passed');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { fail(false); await stop(); } })();
