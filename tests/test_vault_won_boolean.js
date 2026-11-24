// B7 (vault bug scan 24 Nov): a Vault resolve whose `won` is not a real boolean used to be decided by the
// generous vaultWinPlausible() estimate - won:"false" (a string) was PAID as a win. The shipped client always
// sends a boolean, so the server now refuses anything else, BEFORE the attempt is consumed (an honest retry
// still resolves), and pays nothing.
// Asserts (non-zero exit).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-b7-'));
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
const HEROES=Object.keys(require(path.join(root,'server','sim.js')).HERO_BASE).slice(0,5);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'b7-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await stop(); admin=true; await start();
  const grant=await call('/api/admin/led-grant',{px:99000000,gold:500,gems:0,maxGlyphs:true,unlock:HEROES,heroKeys:HEROES,heroXp:99000000});
  ok(grant.data.ok!==false&&((grant.data.ledger||{}).playerLevel|0)>=10,'fixture: player level '+(grant.data.ledger||{}).playerLevel+' (the Vault is open)');
  const st=await call('/api/dungeon/status',{});
  ok(st.data&&st.data.enabled===true&&st.data.currentFloor===1,'fixture: the Vault is at floor 1');
  const start1=await call('/api/dungeon/start-battle',{requestId:'b7-s1',heroIds:HEROES});
  ok(start1.data&&start1.data.ok===true&&start1.data.attemptId,'fixture: floor-1 battle started ('+(start1.data.error||start1.data.attemptId)+')');
  const att=start1.data.attemptId;
  /* the exploit shape: won as a STRING that is not a boolean */
  const bad=await call('/api/dungeon/resolve-battle',{requestId:'b7-r1',attemptId:att,won:'false'});
  ok(bad.data&&bad.data.ok===false&&/true or false/.test(bad.data.error||''),'non-boolean won is refused ('+(bad.data.error||JSON.stringify(bad.data).slice(0,100))+')');
  ok(bad.status===400,'the refusal is a 400');
  const st2=await call('/api/dungeon/status',{});
  ok(st2.data&&st2.data.currentFloor===1,'no progress on a refused result (still floor 1)');
  /* the attempt was NOT consumed: an honest retry with a real boolean still resolves */
  const retry=await call('/api/dungeon/resolve-battle',{requestId:'b7-r2',attemptId:att,won:false});
  ok(retry.data&&retry.data.ok===true&&retry.data.result&&retry.data.result.won===false,'the same attempt resolves after a boolean retry (a real loss)');
  /* sanity: the normal boolean win still pays and advances */
  const start2=await call('/api/dungeon/start-battle',{requestId:'b7-s2',heroIds:HEROES});
  const win=await call('/api/dungeon/resolve-battle',{requestId:'b7-r3',attemptId:start2.data.attemptId,won:true});
  ok(win.data&&win.data.ok===true&&win.data.result&&win.data.result.won===true&&win.data.reward,'a boolean win still pays ('+(win.data.error||'reward ok')+')');
  const st3=await call('/api/dungeon/status',{});
  ok(st3.data&&st3.data.currentFloor===2,'progress advanced to floor 2 on the boolean win');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_vault_won_boolean.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
