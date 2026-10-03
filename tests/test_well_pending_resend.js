// 3 Oct 2026 audit (Starless Well F4): a Well fight result whose reply is lost must not be lost. Runs the REAL client functions
// (wellPendingSave / wellPendingSettle / wellResendPending / wellRefresh) from emberweave-heroes.html in a vm against a REAL server
// on a free port + temp DB: the result is sent and committed, the reply is "lost" (client sees offline), then the next Well load
// re-sends it with the same requestId -> the stored answer is replayed, gold is paid exactly once, the pending result is cleared.
// Asserts (non-zero exit), writes raw request/reply pairs to $WELL_PAIRS (default tmp), records the server file sha256.
// Control: WELL_HTML=<v948 html> must FAIL (no pending save/resend; the paid result is never delivered).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),vm=require('vm'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-well-pend-')), dbFile=path.join(dir,'db.json');
const pairsFile=process.env.WELL_PAIRS||path.join(dir,'pairs.jsonl'); const html=fs.readFileSync(process.env.WELL_HTML||path.join(root,'emberweave-heroes.html'),'utf8');
const serverSha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server.js'))).digest('hex');
let port,base,child,token,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data,method){ const r=await fetch(base+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const gold=async()=>{ const l=(await call('/api/ledger')).data; return (l.ledger||l).gold; };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'well-pend-'+Date.now()}); token=g.data.token; const id=g.data.profile.id; await call('/api/ledger');
  await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const u=db.users[id]; u.led.px=113200;
  const heroes=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5); for(const k of heroes) u.led.unlocked[k]=true;
  fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  const st=(await call('/api/well/state')).data; const row=[0,1,2].find(r=>st.grid&&st.grid[1]&&st.grid[1][r]);
  const ws=await call('/api/well/start',{requestId:'wp-start',col:1,row,heroIds:heroes}); ok(ws.status===200&&ws.data.attemptId,'well fight started');
  const body={attemptId:ws.data.attemptId,requestId:'wp-res-1',inputLog:[],digest:JSON.stringify({won:true,t:1,u:heroes.map(k=>[k,'ally',1,999999,100])}),won:true,stars:3};
  // the client's functions, with a localStorage and an api() that can "lose" one reply after the server committed it
  const store={}; let loseNext=false;
  const ctx={ ACC:{token:'t',profile:{id}}, WELL:{}, adoptLedger(){}, JSON, console,
    localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
    api:async(p,m,b)=>{ const r=await call(p,b,m); if(loseNext){ loseNext=false; return {error:'offline'}; } return r.data; } };
  vm.createContext(ctx);
  const src=['function wellPendingKey(','function wellPendingSave(','function wellPendingSettle(','async function wellResendPending(','async function wellRefresh(']
    .map(sig=>{ const i=html.indexOf(sig); if(i<0) return ''; let j=html.indexOf('\nfunction ',i+1), k=html.indexOf('\nasync function ',i+1); const e=[j,k].filter(x=>x>0); return html.slice(i,Math.min(...e)); }).join('\n');
  vm.runInContext(src+'\nthis.h={save:typeof wellPendingSave==="function"?wellPendingSave:null,settle:typeof wellPendingSettle==="function"?wellPendingSettle:null,refresh:wellRefresh};',ctx);
  const g0=await gold();
  // the battle-end path: save, send (committed on the server, reply lost), settle
  if(ctx.h.save) ctx.h.save(body); loseNext=true; const lost=await ctx.api('/api/well/resolve','POST',body); if(ctx.h.settle) ctx.h.settle(lost);
  ok(lost.error==='offline','reply was lost after the server committed');
  const pendingKey=Object.keys(store).find(k=>k.startsWith('ew_wellPending_'));
  ok(!!pendingKey,'the unsent result is kept on the device');
  await ctx.h.refresh();
  const g1=await gold(); ok(g1>g0,'the next Well load delivers the paid result (gold '+g0+' -> '+g1+')');
  ok(!Object.keys(store).some(k=>k.startsWith('ew_wellPending_')),'pending result cleared after the definite answer');
  await ctx.h.refresh(); ok(await gold()===g1,'a second Well load pays nothing more');
  const resolves=fs.readFileSync(pairsFile,'utf8').trim().split('\n').map(JSON.parse).filter(x=>x.route==='/api/well/resolve');
  ok(resolves.length===2&&resolves.every(x=>x.req.requestId==='wp-res-1'),'both sends used the same requestId');
  ok(JSON.stringify(resolves[0].res.reward)===JSON.stringify(resolves[1].res.reward),'the resend got the stored answer');
  console.log('test_well_pending_resend.js: '+pass+' checks passed (server sha256 '+serverSha.slice(0,16)+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
