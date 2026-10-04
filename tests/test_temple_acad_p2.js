// 4 Oct 2026 Temple + Academy audit P2s (v991): GET /api/academy (each read can be a full save) is limited to 60 a minute per
// player; /api/academy/collect answers from the durable read-commit; a wrong-method academy request changes nothing; the
// pending prayer handed to the client keeps its rolls (templeClientState).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tap2-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,method){ const r=await fetch(base+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  const srv=fs.readFileSync(path.join(root,srvFile),'utf8');
  const tcs=srv.slice(srv.indexOf('function templeClientState(led){'), srv.indexOf('function ledgerView(u){'));
  ok(/rolls:p\.rolls/.test(tcs),'the pending prayer sent to the client keeps its rolls');
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'tap2-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const col=await call('/api/academy/collect',{requestId:'c1'});
  ok(col.status===200&&col.data.ok===true&&col.data.lv,'collect answers ok with the levels ('+col.status+')');
  const wrong=await call('/api/academy/research',null,'GET');
  ok(wrong.status===404,'a GET to a POST academy route is 404 ('+wrong.status+')');
  let first429=0; for(let i=0;i<64;i++){ const r=await call('/api/academy'); if(r.status===429&&!first429) first429=i+1; }
  ok(first429>=55&&first429<=62,'GET /api/academy is limited (~60 a minute; first 429 at read '+first429+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_temple_acad_p2.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
