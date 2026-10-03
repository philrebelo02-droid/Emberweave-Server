// 3 Oct 2026 audit - The Starless Well F2/F3.
// F2: a fight started at (2,F) and held open while stepping onto the free square (2,N) beside it must NOT pay when the
//     held fight is resolved afterwards (it used to pay both squares of column 2 and jump the player back).
// F3: sweep with path "constructor" must be refused and must NOT end the run.
// Inverse control: on the v948 module both assertions fail (the held fight pays; the forged sweep ends the run).
const assert=require('assert'), fs=require('fs'), os=require('os'), path=require('path'), net=require('net'), {spawn}=require('child_process');
const root=path.join(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-well-audit-')), dbFile=path.join(dir,'db.json');
let port,base,child,token,log='',pass=0,n=0;
const ok=(c,m)=>{ assert(c,m); pass++; }, rid=()=>'w'+(++n)+'-'+Date.now();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.stdout.on('data',x=>log+=x); child.stderr.on('data',x=>log+=x);
  for(let i=0;i<150;i++){ if(child.exitCode!==null)throw Error('server exited'); try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const win=(att,ids)=>({requestId:rid(),attemptId:att,won:true,stars:3,digest:JSON.stringify({won:true,t:1,u:ids.map(k=>[k,'ally',1,999999,100])}),inputLog:[]});
const gold=async()=>{ const r=(await call('/api/ledger')).data; return (r.ledger||r).gold; };
async function account(){ // a fresh level-70 account with five unlocked heroes
  const g=await call('/api/guest',{deviceId:'well-audit-'+Date.now()+Math.random()}); token=g.data.token; const id=g.data.profile.id; await call('/api/ledger');
  await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const u=db.users[id]; u.led.px=113200;
  const heroes=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5); for(const k of heroes) u.led.unlocked[k]=true;
  fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); return heroes; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  // F3 first (fresh account, nothing cleared)
  await account();
  const f3=await call('/api/well/sweep',{requestId:rid(),path:'constructor'});
  ok(f3.status===400&&f3.data.ok===false,'F3: sweep "constructor" refused ('+f3.status+' '+(f3.data.error||'')+')');
  const after=(await call('/api/well/state')).data; ok(!after.done,'F3: the run is NOT ended by a forged sweep path');
  // F2: find a map where column 2 holds a fight and a free square both reachable from one column-1 square
  let heroes,plan=null,st;
  for(let tries=0;tries<15&&!plan;tries++){ heroes=await account(); st=(await call('/api/well/state')).data; const g=st.grid;
    for(const r1 of [0,1,2]){ if(!g[1][r1])continue; const o=[0,1,2].filter(r=>g[2][r]&&Math.abs(r-r1)<=1);
      const F=o.find(r=>g[2][r].type==='fight'), N=o.find(r=>g[2][r].type!=='fight'&&g[2][r].type!=='boss'); if(F!=null&&N!=null){ plan={r1,F,N}; break; } } }
  ok(!!plan,'F2: found a map with a fight and a free square side by side in column 2');
  let s=await call('/api/well/start',{requestId:rid(),col:1,row:plan.r1,heroIds:heroes}); ok(s.status===200,'col1 start');
  let r=await call('/api/well/resolve',win(s.data.attemptId,heroes)); ok(r.status===200&&r.data.reward,'col1 won');
  r=await call('/api/well/buff',{requestId:rid(),id:r.data.offer[0].id||r.data.offer[0]}); ok(r.status===200,'buff picked');
  const g0=await gold();
  s=await call('/api/well/start',{requestId:rid(),col:2,row:plan.F,heroIds:heroes}); ok(s.status===200,'col2 fight started (held open)');
  const mv=await call('/api/well/move',{requestId:rid(),col:2,row:plan.N}); ok(mv.status===200,'stepped to the free square in col2');
  const g1=await gold();
  const held=await call('/api/well/resolve',win(s.data.attemptId,heroes));
  ok(held.status===400&&held.data.ok===false,'F2: the held fight cannot be resolved after stepping away ('+held.status+' '+(held.data.error||'')+')');
  ok(await gold()===g1,'F2: no second payout in column 2 (free square paid '+(g1-g0)+')');
  const st2=(await call('/api/well/state')).data; ok(st2.pos.col===2&&st2.pos.row===plan.N,'F2: position stays on the square stepped to');
  console.log('test_well_audit.js: '+pass+' checks passed');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
