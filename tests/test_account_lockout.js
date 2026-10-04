// 4 Oct 2026 Account audit (v1000): #5 ten wrong passwords lock the account for 15 min from THAT IP only (it was every IP, so anyone
// could keep any account locked); #10 POST /api/logout revokes the token on the server; #17 no names from other works in NPC_NAMES.
// IPs are simulated with X-Forwarded-For (the server reads its last entry; there is no proxy in this test).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-lock-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,{token,ip}={}){ const h={'Content-Type':'application/json'}; if(token) h['x-token']=token; if(ip) h['x-forwarded-for']=ip;
  const r=await fetch(base+route,{method:data?'POST':'GET',headers:h,body:data?JSON.stringify(data):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  const srv=fs.readFileSync(path.join(root,srvFile),'utf8'); const npc=(srv.match(/const NPC_NAMES=\[[^\]]*\]/)||[''])[0];
  ok(npc&&!/Winterfell|Hearthglen|Coldharbor|Oakenshield|Sunspear|Redkeep/.test(npc),'NPC names carry no names from other works');
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const name='Lock'+Date.now().toString(36).slice(-6), pw='correct-horse-9';
  const reg=await call('/api/register',{name,pass:pw},{ip:'10.9.0.1'});
  ok(reg.status===200&&reg.data.token,'test account registered ('+reg.status+' '+(reg.data.error||'')+')');
  // logout
  const lo=await call('/api/logout',{}, {token:reg.data.token});
  const after=await call('/api/ledger',null,{token:reg.data.token});
  ok(lo.status===200&&after.status===401,'logout revokes the token on the server (ledger after logout: '+after.status+')');
  // ten wrong passwords from one IP
  for(let i=0;i<10;i++) await call('/api/login',{name,pass:'wrong-'+i},{ip:'10.9.0.2'});
  const locked=await call('/api/login',{name,pass:pw},{ip:'10.9.0.2'});
  ok(locked.status===429,'the attacking IP is locked out ('+locked.status+')');
  const other=await call('/api/login',{name,pass:pw},{ip:'10.9.0.3'});
  ok(other.status===200&&other.data.token,'the owner signs in from another IP ('+other.status+' '+(other.data.error||'')+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_account_lockout.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
