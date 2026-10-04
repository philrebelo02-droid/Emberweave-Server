// 4 Oct 2026 World Map + Account audit P2s (v1002): /api/world and /api/raid retired (410; /api/raid returned any player's wall);
// /api/world/mine stays 410 even with ALLOW_LEGACY_MINE_GRANTS=1; /api/world/cities limited to 30 a minute per player; a guest
// cannot send email codes.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-wap2-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,ALLOW_LEGACY_MINE_GRANTS:'1'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'wap2-'+Date.now()}); token=g.data.token; const id=g.data.profile.id; await call('/api/ledger');
  ok((await call('/api/world')).status===410,'/api/world is retired');
  ok((await call('/api/raid',{id})).status===410,'/api/raid is retired');
  const mine=await call('/api/world/mine',{res:'iron',amount:15,requestId:'wm-1'});
  ok(mine.status===410,'/api/world/mine stays retired with ALLOW_LEGACY_MINE_GRANTS=1 ('+mine.status+')');
  let first429=0; for(let i=0;i<33;i++){ const r=await call('/api/world/cities'); if(r.status===429&&!first429) first429=i+1; }
  ok(first429>=30&&first429<=32,'world cities limited (~30 a minute; first 429 at call '+first429+')');
  const em=await call('/api/email-request',{email:'someone@example.com'});
  ok(em.status===403||(em.status>=400&&/account first/i.test(em.data.error||'')),'a guest cannot send email codes ('+em.status+' '+(em.data.error||'')+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_world_account_p2.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
