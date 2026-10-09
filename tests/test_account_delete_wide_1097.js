// v1097 (sweep #17): deleting an account on a satellite (Server 2-5) deletes the game-wide account on Server 1, and every other
// satellite drops its linked player at its next status check. Real Server 1 + two satellites.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-dw1097-'));
const SECRET='test-link-secret-1097', procs={}, ports={};
let pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const dbOf=n=>path.join(dir,n+'.json');
async function start(n,env){ ports[n]=ports[n]||await freePort();
  procs[n]=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(ports[n]),DB_FILE:dbOf(n),RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100',ADMIN_IDS:'',ACCOUNT_LINK_SECRET:SECRET,...env},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch('http://127.0.0.1:'+ports[n]+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start '+n); }
async function stopAll(){ for(const n of Object.keys(procs)){ const c=procs[n]; c.kill(); for(let i=0;i<60&&c.exitCode===null;i++)await delay(50); delete procs[n]; } }
async function call(n,route,data,tok){ const r=await fetch('http://127.0.0.1:'+ports[n]+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=n=>JSON.parse(fs.readFileSync(dbOf(n),'utf8'));
const hasName=(n,nm)=>Object.values(disk(n).users||{}).some(u=>u&&String(u.name).toLowerCase()===nm.toLowerCase());
(async()=>{ try{
  await start('s1',{});
  const auth='http://127.0.0.1:'+ports.s1;
  await start('s2',{ACCOUNT_AUTHORITY:auth,ACCOUNT_STATUS_MS:'1000'}); await start('s3',{ACCOUNT_AUTHORITY:auth,ACCOUNT_STATUS_MS:'1000'});
  const reg=await call('s1','/api/register',{name:'wideAnn',pass:'password1'});
  ok(reg.status===200,'account made on Server 1');
  const t2=(await call('s2','/api/login',{name:'wideAnn',pass:'password1'})).data.token, t3=(await call('s3','/api/login',{name:'wideAnn',pass:'password1'})).data.token;
  ok(!!t2&&!!t3,'signed in on both satellites');
  let r=await call('s2','/api/account/delete',{confirm:'DELETE',requestId:'w1'},t2);
  ok(r.status===400&&r.data.needPass===true,'satellite: no password - refused');
  r=await call('s2','/api/account/delete',{confirm:'DELETE',pass:'nottheone1',requestId:'w1'},t2);
  ok(r.status===403,'satellite: wrong password (checked by Server 1) - refused ('+r.status+')');
  ok((await call('s1','/api/login',{name:'wideAnn',pass:'password1'})).status===200,'the refusals left the account on Server 1');
  const t2b=(await call('s2','/api/login',{name:'wideAnn',pass:'password1'})).data.token;
  r=await call('s2','/api/account/delete',{confirm:'DELETE',pass:'password1',requestId:'w2'},t2b);
  ok(r.status===200&&r.data.deleted===true,'satellite: deleted ('+r.status+' '+(r.data.error||'')+')');
  ok((await call('s1','/api/login',{name:'wideAnn',pass:'password1'})).status===401,'the game-wide account is gone from Server 1');
  ok((await call('s2','/api/login',{name:'wideAnn',pass:'password1'})).status===401,'and it no longer signs in on the satellite');
  await delay(3500);   // Server 3's status check runs every second here
  ok((await call('s3','/api/profile',null,t3)).status===401,'Server 3 signed the deleted player out at its next status check');
  await delay(500);
  ok(!hasName('s1','wideAnn')&&!hasName('s2','wideAnn')&&!hasName('s3','wideAnn'),'no server keeps a player of that name');
  const tomb=disk('s1').deletedGids||{};
  ok(Object.keys(tomb).length===1&&!JSON.stringify(tomb).includes('wideAnn'),'Server 1 keeps a bare tombstone (id and time only)');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_account_delete_wide_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stopAll(); } })();
