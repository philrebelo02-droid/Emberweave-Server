// Phil 3 Oct 2026: a Vault WIN with the five fighters' card power below 80% of the floor's recommended power (Vault rec x 3.0908, the
// measured scale) files a review case for Ember with the full report; the reward still pays (fight rule). Real server on a free port +
// temp DB: a weak squad placed on floor 50 wins -> reward paid AND exactly one 'vault-underpower' case with the report (floor, recommended,
// squad power, percent, each fighter with power/xp/stars, backups, battle ms, reward); a normal squad winning floor 1 (well above 80%)
// files no case. Asserts (non-zero exit), raw pairs saved, server sha256 recorded. Control: VU_SERVER=<pre-change server in the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.VU_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-vault-under-'));
const dbFile=path.join(dir,'db.json'), pairsFile=path.join(dir,'pairs.jsonl'), sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,srvFile))).digest('hex');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,DUNGEON_V2_ENABLED:'true',VAULT_MIN_BATTLE_MS:'0'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const editDB=async f=>{ await delay(400); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); f(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); };
const readDB=async()=>{ await delay(400); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); await start(); return db; };
const FIVE=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'vault-under-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(db=>{ const u=db.users[id]; u.led.px=40000; for(const k of FIVE) u.led.unlocked[k]=true; u.team=FIVE.map(k=>({key:k})); });
  // normal squad on floor 1: well above 80% of recommended -> no case
  const s1=await call('/api/dungeon/start-battle',{heroIds:FIVE,requestId:'vu-s1'}); ok(s1.status===200&&s1.data.attemptId,'floor 1 started');
  const r1=await call('/api/dungeon/resolve-battle',{attemptId:s1.data.attemptId,won:true,requestId:'vu-r1'}); ok(r1.data.ok===true&&r1.data.reward,'floor 1 win pays');
  let db=await readDB(); const cases1=(db.feedback||[]).filter(f=>String(f.signal||'').startsWith('vault-underpower:'));
  ok(cases1.length===0,'a squad above 80% of recommended files no case ('+cases1.length+')');
  // weak squad placed on floor 50 -> wins -> reward pays AND one review case with the full report
  await editDB(db=>{ const pr=db.dungeonProgress[id]; pr.currentFloor=50; pr.highestClearedFloor=49; pr.activeAttempt=null; });
  const s2=await call('/api/dungeon/start-battle',{heroIds:FIVE,requestId:'vu-s2'}); ok(s2.status===200&&s2.data.attemptId&&s2.data.floor===50,'floor 50 started ('+s2.data.floor+')');
  const r2=await call('/api/dungeon/resolve-battle',{attemptId:s2.data.attemptId,won:true,requestId:'vu-r2'}); ok(r2.data.ok===true&&r2.data.reward&&(r2.data.reward.dust|0)>0,'the under-power win still pays the reward');
  db=await readDB(); const cases2=(db.feedback||[]).filter(f=>f.signal==='vault-underpower:'+s2.data.attemptId);
  ok(cases2.length===1,'exactly one review case for the under-power win ('+cases2.length+')');
  const rep=cases2[0]&&cases2[0].report; ok(rep&&rep.floor===50&&rep.recommendedPower===Math.round(15463*3.0908),'report carries the floor and the card-scale recommended power ('+(rep&&rep.recommendedPower)+')');
  ok(rep&&rep.squadPower>0&&rep.percentOfRecommended<80&&Array.isArray(rep.fighters)&&rep.fighters.length===5&&rep.fighters.every(h=>h.key&&h.power>0),'report carries the squad power, percent and every fighter with its power ('+(rep&&rep.percentOfRecommended)+'%)');
  ok(rep&&typeof rep.battleMs==='number'&&rep.reward&&(rep.reward.dust|0)===(r2.data.reward.dust|0),'report carries the fight time and the reward paid');
  console.log('test_vault_underpower_review.js: '+pass+' checks passed (server '+srvFile+' sha256 '+sha.slice(0,16)+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
