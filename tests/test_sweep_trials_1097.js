// v1097 - sweep 9 Oct P0 #3 (Island of Trials): /api/trial/resolve kind 'tower' was a hidden second Tower ladder paying first-clear gold
// to floor 500 on floor-100 waves; it is retired (the Tower climbs on /api/tower/ascend).
// B2 (vault bug scan 24 Nov): kind 'dungeon' was a hidden second Vault ladder paying first-clear rewards with no
// fight; it is retired too (the Vault climbs on /api/dungeon). Floors-in-order and the max-floor cap now hold on
// the real Vault routes, not here.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-v1097 server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[],admin=false;
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:admin?id:''},stdio:'ignore',windowsHide:true});
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);}   /* 11 Nov: a 60 s deadline, not an iteration count */ throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); }   /* 11 Nov: until it has exited (the port is free) */ child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editRaw(fn){ await delay(400); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const editDB=fn=>editRaw(db=>fn(db.users[id]));
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const HEROES=['vael','sylthaine','vireo','kael','nyra'];
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'tr1097-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await stop(); admin=true; await start();
  const grant=await call('/api/admin/led-grant',{px:99000000,gold:1000,gems:0,maxGlyphs:true,unlock:HEROES,heroKeys:HEROES,heroXp:99000000});
  const L0=grant.data.ledger||{};
  ok(grant.data.ok!==false&&L0.playerLevel>=40,'fixture: player level '+L0.playerLevel+' (the Tower and the Vault are open)');
  const owned=HEROES.filter(k=>L0.unlocked&&L0.unlocked[k]);
  ok(owned.length>=3,'fixture: '+owned.length+' maxed heroes');
  /* #3a the hidden Tower ladder on /api/trial/resolve */
  const g0=(await led()).gold;
  const tw=await call('/api/trial/resolve',{kind:'tower',floor:1,heroIds:owned,requestId:'tr-tw1'});
  const g1=(await led()).gold;
  ok(tw.data.ok===false,'kind tower is refused ('+(tw.data.error||JSON.stringify(tw.data).slice(0,100))+')');
  ok(g1===g0,'kind tower pays no gold ('+(g1-g0)+')');
  /* #3b B2: the dungeon kind was a hidden second Vault ladder (estimate, no fight, first-clear gold/px/hero XP
     + up to 10 material wins a day) - retired like the tower; the Vault climbs only on /api/dungeon */
  const ga=(await led()).gold;
  const d1=await call('/api/trial/resolve',{kind:'dungeon',floor:1,heroIds:owned,requestId:'tr-d1'});
  const gb=(await led()).gold;
  ok(d1.data.ok===false&&/own ladder/.test(d1.data.error||''),'kind dungeon is refused ('+(d1.data.error||JSON.stringify(d1.data).slice(0,100))+')');
  ok(gb===ga,'kind dungeon pays no gold ('+(gb-ga)+')');
  await editDB(u=>{ u.led.trial=u.led.trial||{}; u.led.trial.dungeon={best:100}; });
  const gc=(await led()).gold;
  const d101=await call('/api/trial/resolve',{kind:'dungeon',floor:101,heroIds:owned,requestId:'tr-d101'});
  const gd=(await led()).gold; await delay(400);
  ok(d101.data.ok===false,'dungeon floor 101 (past the last built floor) is refused ('+(d101.data.error||JSON.stringify(d101.data).slice(0,100))+')');
  ok(gd===gc&&((disk().users[id].led.trial||{}).dungeon||{}).best===100,'no gold is paid and the best floor stays 100 ('+(gd-gc)+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_sweep_trials_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
