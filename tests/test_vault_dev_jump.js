// B8 (vault bug scan 24 Nov): the dev floor-jump could corrupt the dev account's climb - after jumping DOWN,
// winning the lower floor ran `prog.highestClearedFloor=a.floor` and lowered the recorded climb. Fix: Math.max
// on both highestClearedFloor and currentFloor at the clear. Dev-only path; normal players can never hit it
// (their currentFloor always equals the attempt's floor).
// Asserts (non-zero exit).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-b8-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[],admin=false;
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:admin?id:''},stdio:'ignore',windowsHide:true});
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
const prog=async()=>{ const r=await call('/api/dungeon/status',{}); return r.data; };
const HEROES=Object.keys(require(path.join(root,'server','sim.js')).HERO_BASE).slice(0,5);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'b8-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await stop(); admin=true; await start();   // admin id -> isDev
  const grant=await call('/api/admin/led-grant',{px:99000000,gold:500,gems:0,maxGlyphs:true,unlock:HEROES,heroKeys:HEROES,heroXp:99000000});
  ok(grant.data.ok!==false,'fixture: maxed heroes granted');
  /* craft the corrupting shape: the climb says floor 5, but the dev is standing at floor 3 */
  await delay(400); await stop();
  const db=disk(); const dk=new Date().toISOString().slice(0,10);
  db.dungeonProgress=db.dungeonProgress||{};
  db.dungeonProgress[id]={ accountId:id, currentFloor:3, highestClearedFloor:5, vaultStatus:'active', claimedFloors:{},
    sweep:{dateKey:dk,freeUsesRemaining:2,totalSweepsToday:0}, activeAttempt:null, lastTeamHeroIds:[], version:1 };
  fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  let p=await prog(); ok(p.currentFloor===3&&p.highestClearedFloor===5,'fixture: standing at floor 3, climb at floor 5');
  /* dev jumps DOWN to floor 2 and wins it */
  const jump=await call('/api/dungeon/dev-floor',{requestId:'b8-j1',floor:2});
  ok(jump.data&&jump.data.ok===true&&jump.data.currentFloor===2,'dev jump down to floor 2 accepted');
  const st=await call('/api/dungeon/start-battle',{requestId:'b8-s1',heroIds:HEROES});
  ok(st.data&&st.data.ok===true&&st.data.attemptId,'floor-2 battle started');
  const win=await call('/api/dungeon/resolve-battle',{requestId:'b8-r1',attemptId:st.data.attemptId,won:true});
  ok(win.data&&win.data.ok===true&&win.data.result&&win.data.result.won===true,'floor-2 win accepted');
  p=await prog();
  ok(p.highestClearedFloor===5,'the climb is NOT lowered by the lower win (highestClearedFloor '+p.highestClearedFloor+')');
  ok(p.currentFloor>=3,'currentFloor never moves backwards either ('+p.currentFloor+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_vault_dev_jump.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
