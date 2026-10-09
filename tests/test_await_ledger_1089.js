// v1089 - scan 10: a handler that took the ledger BEFORE an await wrote to a detached object when another request of the same
// account committed during that await (a commit replaces me.led). Grants that go through `me` (glyph fragments) still landed, so the
// bonus pot paid again and again, bonus first clears repeated, province plays passed the daily cap; spends and progress were silently lost.
// Live: hold a request's body, let a free durable read commit (GET /api/academy), release the body.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),http=require('http'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-aw1089-'));
const dbFile=path.join(dir,'db.json'), src=fs.readFileSync(path.join(root,srvFile),'utf8');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
function hold(route,data){ const payload=JSON.stringify(data); let done; const p=new Promise(r=>done=r);
  const req=http.request({host:'127.0.0.1',port,path:route,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),'x-token':token}},res=>{
    let t=''; res.on('data',c=>t+=c); res.on('end',()=>{ let j={}; try{ j=JSON.parse(t); }catch(_){} done({status:res.statusCode,data:j}); }); });
  req.flushHeaders(); return { release:()=>{ req.end(payload); return p; } }; }
const frags=u=>Object.values((u.glyphs&&u.glyphs.fragments)||{}).reduce((a,b)=>a+b,0);
async function interleaved(route,data){ const h=hold(route,data); await delay(150); await call('/api/academy'); return h.release(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'aw1089-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(u=>{ const t=Date.now(); u.led.px=11986; u.led.gold=1000000; u.led.gems=1000;
    u.led.bonus={done:{'1-3':{stars:3,at:t-40*3600e3},'1-4':{stars:3,at:t-40*3600e3}},ts:t-36*3600e3,att:null}; });
  // bonus pot: three claims, each with a commit in the middle
  const paid=[]; for(let i=0;i<3;i++){ const r=await interleaved('/api/bonus/claim',{requestId:'bc'+i}); paid.push(r.status); }
  await delay(400); const u1=disk().users[id];
  ok(paid[0]===200&&paid.slice(1).every(s=>s===400),'the bonus pot pays once; the interleaved repeats are refused ('+paid.join(',')+')');
  ok(Date.now()-u1.led.bonus.ts<3600e3,'the claim reset the pot clock on disk ('+((Date.now()-u1.led.bonus.ts)/3600e3).toFixed(2)+' h)');
  const f1=frags(u1);
  // emberdraft pack: the purchase is saved, not only answered
  const eb=await interleaved('/api/emberdraft/buy',{requestId:'eb1'}); await delay(400); const u2=disk().users[id];
  ok(eb.status===200&&u2.led.gems===900&&u2.led.edraft&&u2.led.edraft.bought===1,'an Emberdraft pack bought across a commit is saved (reply '+eb.status+', disk gems '+u2.led.gems+', bought '+(u2.led.edraft&&u2.led.edraft.bought)+')');
  ok(frags(u2)===f1,'CONTROL: no fragments appeared from the refused claims ('+f1+')');
  // static: every site takes the ledger after its await
  ok(/const _bb=req\.method==='POST'\?await body\(req\):\{\}; const led=ensureLedger\(me\);/.test(src)&&/body:\(\)=>Promise\.resolve\(_bb\)/.test(src),'bonus dispatch: body first, then the ledger');
  ok(/const _wb=req\.method==='POST'\?await body\(req\):\{\}; const led=ensureLedger\(me\);/.test(src)&&/body:\(\)=>Promise\.resolve\(_wb\)/.test(src),'Starless Well dispatch: body first, then the ledger');
  ok(/if\(p==='\/api\/province\/resolve'\)\{ led=ensureLedger\(me\); const out=idem\(/.test(src),'province resolve re-takes the ledger after the replay await');
  ok((src.match(/v1089 \(scan 10\)/g)||[]).length>=6,'all six sites carry the fix ('+(src.match(/v1089 \(scan 10\)/g)||[]).length+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_await_ledger_1089.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
