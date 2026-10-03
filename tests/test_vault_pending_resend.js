// 3 Oct 2026 audit (Vault F5): a Vault floor result whose reply is lost must not be lost. Runs the REAL client functions
// (vaultPendingSave / vaultPendingSettle / vaultResendPending / vaultStatus) from emberweave-heroes.html in a vm against a REAL
// server on a free port + temp DB: the win is sent and committed, the reply is "lost" (offline), then the next Vault status read
// re-sends it with the same requestId -> the stored answer is replayed, the floor advances once, dust is paid once, pending cleared.
// Also asserts vaultLaunch re-sends before it can start a new floor (a new start abandons the old attempt).
// Asserts (non-zero exit), writes raw request/reply pairs, records the server file sha256. Control: VAULT_HTML=<v948 html> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),vm=require('vm'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-vault-pend-')), dbFile=path.join(dir,'db.json');
const pairsFile=process.env.VAULT_PAIRS||path.join(dir,'pairs.jsonl'); const html=fs.readFileSync(process.env.VAULT_HTML||path.join(root,'emberweave-heroes.html'),'utf8');
const serverSha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server.js'))).digest('hex');
let port,base,child,token,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,VAULT_MIN_BATTLE_MS:'0',DUNGEON_V2_ENABLED:'true'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data,method){ const r=await fetch(base+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const fn=sig=>{ const i=html.indexOf(sig); if(i<0) return ''; const e=[html.indexOf('\nfunction ',i+1),html.indexOf('\nasync function ',i+1)].filter(x=>x>0); return html.slice(i,Math.min(...e)); };
(async()=>{ try{
  // source order: vaultLaunch must re-send before start-battle
  const L=fn('async function vaultLaunch('); const iR=L.indexOf('vaultResendPending('), iS=L.indexOf('/api/dungeon/start-battle');
  ok(iR>0&&iS>0&&iR<iS,'vaultLaunch re-sends a saved result before it can start a new floor');
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'vault-pend-'+Date.now()}); token=g.data.token; const id=g.data.profile.id; await call('/api/ledger');
  await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const u=db.users[id]; u.led.px=113200;
  const heroes=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5); for(const k of heroes) u.led.unlocked[k]=true; u.team=heroes.map(k=>({key:k}));
  fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  const vs=await call('/api/dungeon/start-battle',{heroIds:heroes,requestId:'vp-start'}); ok(vs.status===200&&vs.data.attemptId,'vault floor started');
  const body={attemptId:vs.data.attemptId,won:true,requestId:'vp-res-1'};
  const store={}; let loseNext=false;
  const ctx={ ACC:{token:'t',profile:{id}}, VAULT:{}, adoptLedger(){}, JSON, console,
    localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
    api:async(p,m,b)=>{ const r=await call(p,b,m); if(loseNext){ loseNext=false; return {error:'offline'}; } return r.data; } };
  vm.createContext(ctx);
  const src=['function vaultPendingKey(','function vaultPendingSave(','function vaultPendingSettle(','async function vaultResendPending(','async function vaultStatus('].map(fn).join('\n');
  vm.runInContext(src+'\nthis.h={save:typeof vaultPendingSave==="function"?vaultPendingSave:null,settle:typeof vaultPendingSettle==="function"?vaultPendingSettle:null,status:vaultStatus};',ctx);
  const st0=(await call('/api/dungeon/status')).data, dust0=st0.dust;
  if(ctx.h.save) ctx.h.save(body); loseNext=true; const lost=await ctx.api('/api/dungeon/resolve-battle','POST',body); if(ctx.h.settle) ctx.h.settle(lost);
  ok(lost.error==='offline','reply was lost after the server committed');
  ok(Object.keys(store).some(k=>k.startsWith('ew_vaultPending_')),'the unsent result is kept on the device');
  await ctx.h.status();
  const st1=(await call('/api/dungeon/status')).data;
  ok(!Object.keys(store).some(k=>k.startsWith('ew_vaultPending_')),'pending result cleared after the definite answer');
  const res=fs.readFileSync(pairsFile,'utf8').trim().split('\n').map(JSON.parse).filter(x=>x.route==='/api/dungeon/resolve-battle');
  ok(res.length===2&&res.every(x=>x.req.requestId==='vp-res-1'),'both sends used the same requestId');
  ok(JSON.stringify(res[0].res.reward)===JSON.stringify(res[1].res.reward)&&res[1].res.reward,'the resend got the stored answer with the reward');
  ok((st1.highestClearedFloor|0)===1,'the floor was cleared exactly once (highest '+st1.highestClearedFloor+')');
  await ctx.h.status(); const st2=(await call('/api/dungeon/status')).data; ok(st2.dust===st1.dust&&(st2.highestClearedFloor|0)===1,'a second status read pays nothing more');
  console.log('test_vault_pending_resend.js: '+pass+' checks passed (server sha256 '+serverSha.slice(0,16)+', dust '+dust0+' -> '+st1.dust+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
