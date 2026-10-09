// v1097 - sweep 9 Oct P0 #1 and #2 (Temple of Ash):
//  #1 the prayer seed carries a server-owned prayer count, so a requestId reused after its 1-hour receipt never replays the same rolls
//     (pray and auto pray);
//  #2 a held (Mythical Pool) prayer above the player's Temple level is refused before it is spent, and a failed prayer never answers ok.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-v1097 server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-st1097-'));
const dbFile=path.join(dir,'db.json');
const T=require('../server/temple-of-ash.js');
let port,base,child,token,id,pass=0,missed=[],admin=false;
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:admin?id:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editRaw(fn){ await delay(400); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const editDB=fn=>editRaw(db=>fn(db.users[id]));
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const HERO='vael';
const levelPoints=lv=>{ let s=0; for(let i=0;i<lv;i++) s+=T.FLAMEKEEPER_TRACK[i].exp; return s; };
const rollSig=r=>JSON.stringify(Object.keys(r.data.rolls||{}).sort().map(k=>[k,r.data.rolls[k].deltaSteps]))+'|'+!!r.data.bonusWon;
/* the 1-hour receipt window passing: drop this account's Temple receipts and put the Temple back exactly as it was (the attack
   replays a known state); only the server-owned prayer count is kept as it now is, since a player cannot reset it */
const hourLater=(snapTemple,gold,gems)=>editRaw(db=>{ for(const k of Object.keys(db.idem||{})) if(k.indexOf(id+':temple:')===0) delete db.idem[k];
  const u=db.users[id], t=JSON.parse(snapTemple); if(u.led.temple&&u.led.temple.prayN!=null) t.prayN=u.led.temple.prayN; else delete t.prayN;
  u.led.temple=t; u.led.gold=gold; u.led.gems=gems; });
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'st1097-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await stop(); admin=true; await start();
  const grant=await call('/api/admin/led-grant',{px:99000000,gold:90000000,gems:900000,maxGlyphs:true,unlock:[HERO],heroKeys:[HERO],heroXp:99000000});
  ok(grant.data.ok!==false&&grant.data.ledger&&grant.data.ledger.playerLevel>=50,'fixture: player level '+(grant.data.ledger&&grant.data.ledger.playerLevel)+', an Orange hero, gold and diamonds');
  await call('/api/ledger');
  /* Temple 12 (auto pray open), the hero at 0 steps, nothing pending */
  await editDB(u=>{ const t=u.led.temple||T.newState(); u.led.temple=Object.assign(t,{keeperPoints:levelPoints(12),levelSeen:12,heroes:{},_pending:null,bonusPrayers:0}); });
  await call('/api/ledger');
  /* ---- #1 pray: the same requestId an hour later rolls again ---- */
  let same=0; const N=8;   // a fresh hero's Kindled rolls repeat by chance about 1 time in 3; all 8 repeating is the replay
  for(let i=0;i<N;i++){
    await delay(400); const d=disk().users[id].led; const snap=JSON.stringify(d.temple), gold=d.gold, gems=d.gems;
    const a=await call('/api/temple/pray',{requestId:'rq-replay-'+i,heroKey:HERO,tier:'kindled'});
    ok(a.data.ok===true&&!!a.data.rolls,'kindled prayer '+i+' rolls ('+(a.data.error||'ok')+')');
    await call('/api/temple/discard',{requestId:'rq-disc-'+i});
    await hourLater(snap,gold,gems);
    const b=await call('/api/temple/pray',{requestId:'rq-replay-'+i,heroKey:HERO,tier:'kindled'});
    ok(b.data.ok===true&&!!b.data.rolls,'the reused requestId '+i+' is a fresh prayer once its receipt is gone');
    if(rollSig(a)===rollSig(b)) same++;
    await call('/api/temple/discard',{requestId:'rq-disc2-'+i});
  }
  ok(same<N,'a reused requestId does not replay the same rolls ('+same+' of '+N+' identical)');
  await delay(400);
  const pn=(disk().users[id].led.temple||{}).prayN|0;
  ok(pn>=2*N,'the server keeps its own prayer count ('+pn+')');
  /* ---- #1 auto pray ---- */
  { await delay(400); const d=disk().users[id].led; const snap=JSON.stringify(d.temple), gold=d.gold, gems=d.gems;
    const a=await call('/api/temple/auto',{requestId:'rq-auto',heroKey:HERO,tier:'kindled',count:5});
    ok(a.data.ok===true&&a.data.results&&a.data.results.length===5,'auto pray runs 5 ('+(a.data.error||'ok')+')');
    await hourLater(snap,gold,gems);
    const b=await call('/api/temple/auto',{requestId:'rq-auto',heroKey:HERO,tier:'kindled',count:5});
    const sig=r=>JSON.stringify((r.data.results||[]).map(x=>Object.keys(x.rolls||{}).sort().map(k=>x.rolls[k].deltaSteps)));
    ok(b.data.ok===true&&sig(a)!==sig(b),'a reused auto-pray requestId does not replay the same 5 prayers'); }
  /* ---- #2 a held prayer above the Temple level ---- */
  await editDB(u=>{ u.led.temple.keeperPoints=levelPoints(4); u.led.temple.levelSeen=4; u.led.temple._pending=null; u.led.temple.heldPrayers={inferno:1,stoked:1}; });
  const lvl=T.keeperLevel(levelPoints(4),100);
  ok(lvl<17,'fixture: Temple level '+lvl+' (Inferno opens at 17)');
  const g0=await led();
  const h=await call('/api/temple/pray',{requestId:'rq-held',heroKey:HERO,tier:'inferno',held:true});
  await delay(400); const t1=disk().users[id].led.temple;
  ok(h.data.ok===false,'a held Inferno prayer at Temple '+lvl+' is refused ('+(h.data.error||JSON.stringify(h.data).slice(0,80))+')');
  ok(/Temple 17/.test(h.data.error||''),'the refusal names the Temple level it needs');
  ok((t1.heldPrayers.inferno|0)===1,'the held Inferno prayer is kept ('+(t1.heldPrayers.inferno|0)+')');
  ok(!t1._pending,'no prayer is left pending');
  const g1=await led();
  ok(g1.gold===g0.gold&&g1.gems===g0.gems,'no gold or diamonds were taken');
  /* control: a held tier the Temple has opened still prays and spends the held prayer */
  await editDB(u=>{ u.led.temple.keeperPoints=levelPoints(8); u.led.temple.levelSeen=8; });
  const s=await call('/api/temple/pray',{requestId:'rq-held-ok',heroKey:HERO,tier:'stoked',held:true});
  await delay(400);
  ok(s.data.ok===true&&!!s.data.rolls&&(disk().users[id].led.temple.heldPrayers.stoked|0)===0,'control: a held Stoked prayer at Temple 8 prays and is spent ('+(s.data.error||'ok')+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_sweep_temple_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
