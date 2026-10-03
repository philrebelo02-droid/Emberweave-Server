// 3 Oct 2026 audit small fixes, real server on a free port + temp DB:
//  Vault F8  - a PAID sweep with no floor cleared is refused BEFORE any diamond is taken;
//  Trials #8 - buying Emberdraft attempts below level 25 is refused (same gate as /start), no diamond taken;
//  Trials #9 - GET /api/emberdraft/state answers (it used to 404 on GET).
// Asserts (non-zero exit), raw pairs saved, server sha256 recorded. Control: AUD_SERVER=<pre-fix server in the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-aud-small-'));
const dbFile=path.join(dir,'db.json'), pairsFile=path.join(dir,'pairs.jsonl'), sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,srvFile))).digest('hex');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,DUNGEON_V2_ENABLED:'true'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data,method){ const r=await fetch(base+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,method:method||(data?'POST':'GET'),req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const gems=async()=>{ const l=(await call('/api/ledger')).data; return (l.ledger||l).gems; };
const FIVE=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'aud-small-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger'); await call('/api/dungeon/status');
  // fixture: a player between level 10 (the Vault opens) and 24 (below Emberdraft's 25)
  let lvl=0; for(const px of [1500,2500,4000,6000,9000,13000]){ await delay(300); await stop(); { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.users[id].led.px=px; for(const k of FIVE) db.users[id].led.unlocked[k]=true; fs.writeFileSync(dbFile,JSON.stringify(db)); } await start();
    lvl=((await call('/api/ledger')).data.playerLevel)|0; if(lvl>=10&&lvl<25) break; }
  assert(lvl>=10&&lvl<25,'fixture level between 10 and 24 (got '+lvl+')');
  const team=FIVE; const vs=await call('/api/dungeon/start-battle',{heroIds:team,requestId:'vs-fixture'}); assert(vs.status===200&&vs.data.attemptId,'fixture vault start ('+vs.status+' '+JSON.stringify(vs.data).slice(0,80)+')');
  await delay(1500); await stop();
  { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const u=db.users[id]; u.led.gems=5000;   // level 10-24, rich in diamonds
    const pr=(db.dungeonProgress||{})[id]; assert(pr,'vault progress exists'); pr.highestClearedFloor=0; pr.activeAttempt=null; pr.sweep=pr.sweep||{}; pr.sweep.freeUsesRemaining=0; pr.sweep.totalSweepsToday=2;
    fs.writeFileSync(dbFile,JSON.stringify(db)); }
  await start();
  const st=(await call('/api/dungeon/status')).data; ok(st&&st.sweep&&st.sweep.freeUsesRemaining===0&&(st.highestClearedFloor|0)===0,'fixture: no free sweeps left, no floor cleared ('+JSON.stringify(st.sweep||{}).slice(0,80)+')');
  const g0=await gems(); const sw=await call('/api/dungeon/sweep',{requestId:'sw-paid-0'});
  ok(sw.data.ok===false&&/Clear a floor first/.test(sw.data.error||''),'paid sweep with no floor cleared is refused ('+(sw.data.error||'')+')');
  ok((await gems())===g0,'no diamond taken by the refused sweep ('+g0+')');
  const g1=await gems(); const bu=await call('/api/emberdraft/buy',{requestId:'buy-lv1'});
  ok(bu.data.ok===false&&/level 25/.test(bu.data.error||''),'buying Emberdraft attempts below level 25 is refused ('+(bu.data.error||'')+')');
  ok((await gems())===g1,'no diamond taken by the refused buy');
  const gs=await call('/api/emberdraft/state',null,'GET'); ok(gs.status===200&&gs.data.ok===true&&gs.data.edraft,'GET /api/emberdraft/state answers ('+gs.status+')');
  console.log('test_audit_small_fixes.js: '+pass+' checks passed (server '+srvFile+' sha256 '+sha.slice(0,16)+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
