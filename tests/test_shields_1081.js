// v1081 - exploit scan round 2 #1 (real server on a free port + temp DB): PROTECTION SHIELDS ARE THE SERVER'S.
//  - the Shady pack (550 diamonds -> 3) is a server purchase; activating spends one and shields the castle for 12 h;
//  - war declare on a shielded castle is refused; a castle under beginner peace (72 h, under level 30) is refused too;
//  - declaring war breaks the attacker's own shield; the ledger view carries shields / shieldUntil / beginnerShieldUntil.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-sh1081-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const L=async tok=>{ const l=(await call('/api/ledger',null,tok)).data; return l.ledger||l; };
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const mk=async n=>{ const g=await call('/api/guest',{deviceId:'sh1081-'+n+'-'+Date.now()}); await call('/api/ledger',null,g.data.token); return {id:g.data.profile.id,tok:g.data.token}; };
  const A=await mk('a'), B=await mk('b'), C=await mk('c');   // A attacks; B shields; C is a newcomer
  const old=Date.now()-10*86400000;
  await editDB(db=>{ for(const x of [A,B]){ const u=db.users[x.id]; u.led.px=9000000; u.created=old; u.led.gems=5000; }
    const c=db.users[C.id]; c.led.px=3100; c.created=Date.now(); });   // C: level 25 - world map open (20), beginner peace (<30)
  // C must be under level 30 for beginner peace; find its level and keep it world-eligible
  const lc=await L(C.tok);
  // shields: buy, activate
  const buy=await call('/api/shop/buy',{what:'shields3',requestId:'sh-buy'},B.tok); const lb=await L(B.tok);
  ok(buy.data.ok===true&&lb.shields===3,'the Shady pack credits 3 server shields ('+(buy.data.error||lb.shields)+')');
  const act=await call('/api/world/shield',{requestId:'sh-act'},B.tok); const lb2=await L(B.tok);
  ok(act.data.ok===true&&lb2.shields===2&&lb2.shieldUntil>Date.now()+11*3600000,'activating spends one and shields for 12 h ('+(act.data.error||lb2.shieldUntil)+')');
  const again=await call('/api/world/shield',{requestId:'sh-act2'},B.tok);
  ok(again.data.ok===false,'a second shield cannot stack while one is active');
  // a shielded castle cannot be declared on
  const decl=await call('/api/world/war/declare',{defId:B.id,requestId:'sh-decl'},A.tok);
  ok(decl.data.ok===false&&/protection shield/.test(decl.data.error||''),'war on a shielded castle is refused ('+(decl.data.error||JSON.stringify(decl.data).slice(0,80))+')');
  // beginner peace
  ok(lc.playerLevel>=20&&lc.playerLevel<30&&(+lc.beginnerShieldUntil||0)>Date.now(),'the ledger shows a newcomer\'s beginner peace (level '+lc.playerLevel+', until '+lc.beginnerShieldUntil+')');
  { const dc=await call('/api/world/war/declare',{defId:C.id,requestId:'sh-declC'},A.tok);
    ok(dc.data.ok===false&&/protection shield/.test(dc.data.error||''),'a newcomer under beginner peace cannot be declared on ('+(dc.data.error||'')+')'); }
  // attacking breaks your own shield: give A a shield, then declare on an unshielded target (B's shield expired)
  await editDB(db=>{ db.users[A.id].shields=1; db.users[A.id].shieldUntil=Date.now()+3600000; db.users[B.id].shieldUntil=0; });
  const d2=await call('/api/world/war/declare',{defId:B.id,requestId:'sh-decl2'},A.tok); await delay(500);
  const la=await L(A.tok);
  ok(d2.data.ok===true&&!(la.shieldUntil>Date.now()),'declaring war breaks the attacker\'s own shield ('+(d2.data.error||la.shieldUntil)+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_shields_1081.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
