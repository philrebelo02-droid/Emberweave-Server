// Phil 3 Oct 2026: a Vault WIN with the five fighters' card power below 80% of the floor's recommended power (the
// 41d talent-less gate, server/vault-encounters.json recommendedPowerGate per floor; the card-scale rec x 3.0908 x
// 1.096 was the pre-ramp formula and is only a fallback now) files a review case for Ember with the full report; the
// reward still pays (fight rule). Real server on a free port + temp DB:
//  positive - a weak (bare level-1) squad placed on floor 50 wins -> reward paid AND exactly one 'vault-underpower'
//             case whose report carries the gate, squad power, percent (<80), every fighter, fight time and reward;
//  negative - the same five heroes, dev-built to an ordinary floor-1 squad (level 12, 5 stars, gear/temper/glyphs/
//             temple/academy via the dev panel's own led-grant roster acts), win floor 1 -> NO case (Phil: the
//             signal must not fire on an ordinary win).
// Asserts (non-zero exit), raw pairs saved, server sha256 recorded. Control: VU_SERVER=<pre-change server in the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.VU_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-vault-under-'));
const dbFile=path.join(dir,'db.json'), pairsFile=path.join(dir,'pairs.jsonl'), sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,srvFile))).digest('hex');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,DUNGEON_V2_ENABLED:'true',VAULT_MIN_BATTLE_MS:'0'},stdio:'ignore',windowsHide:true});
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);}   /* 11 Nov: a 60 s deadline, not an iteration count */ throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); }   /* 11 Nov: until it has exited (the port is free) */ child=null; }
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const editDB=async f=>{ await delay(400); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); f(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); };
const readDB=async()=>{ await delay(400); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); await start(); return db; };
/* the authored talent-less gate the server now reads (25 Nov 2026, Claude's option a of the 41d fix) */
const gate50=(()=>{ try{ const v=require(path.join(root,'server','vault-encounters.json')); const f=(v.floors||[]).find(x=>x.floor===50); return f&&f.recommendedPowerGate; }catch(_){ return null; } })();
const FIVE=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'vault-under-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(db=>{ const u=db.users[id]; u.led.px=40000; for(const k of FIVE) u.led.unlocked[k]=true; u.team=FIVE.map(k=>({key:k})); });
  // POSITIVE: weak (bare level-1) squad placed on floor 50 -> win pays AND exactly one review case with the full report
  /* prog shape mirrors server.js getDungeonProgress (~line 2360): claimedFloors is an OBJECT and sweep must carry a
     dateKey, or start-battle's resetDungeonSweepIfNewDay throws on undefined. */
  await editDB(db=>{ db.dungeonProgress=db.dungeonProgress||{}; const pr=db.dungeonProgress[id]=db.dungeonProgress[id]||{accountId:id,currentFloor:1,highestClearedFloor:0,vaultStatus:'active',claimedFloors:{},sweep:{dateKey:'',freeUsesRemaining:2,totalSweepsToday:0},version:0}; pr.currentFloor=50; pr.highestClearedFloor=49; pr.activeAttempt=null; });
  const s2=await call('/api/dungeon/start-battle',{heroIds:FIVE,requestId:'vu-s2'}); ok(s2.status===200&&s2.data.attemptId&&s2.data.floor===50,'floor 50 started ('+s2.data.floor+')');
  const r2=await call('/api/dungeon/resolve-battle',{attemptId:s2.data.attemptId,won:true,requestId:'vu-r2'}); ok(r2.data.ok===true&&r2.data.reward&&(r2.data.reward.dust|0)>0,'the under-power win still pays the reward');
  let db=await readDB(); const cases2=(db.feedback||[]).filter(f=>f.signal==='vault-underpower:'+s2.data.attemptId);
  ok(cases2.length===1,'exactly one review case for the under-power win ('+cases2.length+')');
  const rep=cases2[0]&&cases2[0].report; ok(rep&&rep.floor===50&&gate50&&rep.recommendedPower===gate50,'report carries the floor and the authored talent-less gate ('+(rep&&rep.recommendedPower)+' vs file '+gate50+')');
  ok(rep&&rep.squadPower>0&&rep.percentOfRecommended<80&&Array.isArray(rep.fighters)&&rep.fighters.length===5&&rep.fighters.every(h=>h.key&&h.power>0),'report carries the squad power, percent and every fighter with its power ('+(rep&&rep.percentOfRecommended)+'%)');
  ok(rep&&typeof rep.battleMs==='number'&&rep.reward&&(rep.reward.dust|0)===(r2.data.reward.dust|0),'report carries the fight time and the reward paid');
  // NEGATIVE: the same five dev-built to an ordinary floor-1 squad (level 12, 5 stars, gear/temper/glyphs/temple/academy) -> a normal win files NO case
  await editDB(db=>{ db.users[id].role='admin'; });   // isDev -> the dev panel's own led-grant roster acts build the squad
  for(const act of [{unlock:FIVE,heroKeys:FIVE,stars:5},{roster:'cmdlevel',n:30},{roster:'herolevel',n:12},{roster:'gear'},{roster:'temper',n:30},{roster:'glyphs'},{roster:'temple'},{roster:'academy'}]){
    const gr=await call('/api/admin/led-grant',act); ok(gr.status===200,'dev build '+JSON.stringify(act.roster||'unlock')+' ('+gr.status+')'); }
  let db2=await readDB(); const prog=db2.dungeonProgress[id];
  await editDB(db=>{ const pr=db.dungeonProgress[id]; pr.currentFloor=1; pr.highestClearedFloor=0; pr.claimedFloors={}; pr.activeAttempt=null; pr.version++; });
  const s1=await call('/api/dungeon/start-battle',{heroIds:FIVE,requestId:'vu-s1'}); ok(s1.status===200&&s1.data.attemptId&&s1.data.floor===1,'floor 1 started with the dev-built squad ('+s1.data.floor+')');
  const r1=await call('/api/dungeon/resolve-battle',{attemptId:s1.data.attemptId,won:true,requestId:'vu-r1'}); ok(r1.data.ok===true&&r1.data.reward,'floor 1 win pays');
  db=await readDB(); const cases1=(db.feedback||[]).filter(f=>String(f.signal||'').startsWith('vault-underpower:'));
  ok(cases1.length===1,'the dev-built ordinary squad files no case of its own ('+cases1.length+' - only the floor-50 one)');
  console.log('test_vault_underpower_review.js: '+pass+' checks passed (server '+srvFile+' sha256 '+sha.slice(0,16)+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
