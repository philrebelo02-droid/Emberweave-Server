// 3 Oct 2026 Market audit (v967), real server on a free port + temp DB:
//  #2 - the Market (and /api/tx/earn) never sells fragments of the purchase/arena heroes; a sold hero still buys (control);
//  #8 - a meal at full stamina is refused with no diamond taken; below full it still sells (control);
//  #4 - tx/spend + tx/earn run in the durable idempotency lane (static check of DURABLE_IDEM_KINDS);
//  static - the server's HERO_NOT_SOLD equals the client's HERO_TYPES source:'purchase'/'arena' heroes.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-mkt-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
async function editDB(fn){ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  // static: server set == client purchase/arena heroes
  const srv=fs.readFileSync(path.join(root,srvFile),'utf8'), html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  const clientSet=[...html.matchAll(/^\s*([a-z_]+):\s*\{name:[^\n]*?source:'(?:purchase|arena)'/gm)].map(x=>x[1]).sort();
  let serverSet=clientSet;
  if(!process.env.AUD_SERVER){   // the control run (a pre-fix server) skips the static half so it fails on BEHAVIOUR
    const m=srv.match(/const HERO_NOT_SOLD=new Set\(\[([^\]]*)\]\)/); ok(m,'server defines HERO_NOT_SOLD');
    serverSet=m[1].match(/'([a-z_]+)'/g).map(s=>s.slice(1,-1)).sort();
    ok(clientSet.length>=6&&JSON.stringify(serverSet)===JSON.stringify(clientSet),'HERO_NOT_SOLD equals the client source heroes ('+serverSet+' vs '+clientSet+')');
    ok(/DURABLE_IDEM_KINDS=new Set\(\[[^\]]*'spend'[^\]]*'earn'/.test(srv),'tx/spend + tx/earn are durable idem kinds'); }
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'mkt-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const sold=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).find(k=>!serverSet.includes(k));
  await editDB(u=>{ u.led.gems=5000; u.led.gold=100000; u.led.px=13000; });
  // #2
  const g0=(await led()).gems;
  const r1=await call('/api/market/frag',{heroKey:'hollow',qty:1,pay:'gems',requestId:'mk-hollow'});
  ok(r1.data.ok===false&&/not sold/.test(r1.data.error||''),'Market refuses Hollow fragments ('+(r1.data.error||JSON.stringify(r1.data).slice(0,80))+')');
  ok((await led()).gems===g0,'no diamond taken by the refused Hollow buy');
  const r2=await call('/api/market/frag',{heroKey:sold,qty:1,pay:'gems',requestId:'mk-sold'});
  ok(r2.data.ok===true,'CONTROL: a sold hero ('+sold+') still buys ('+(r2.data.error||'ok')+')');
  const r3=await call('/api/tx/earn',{what:'frag',amount:5,reason:'arena',heroKey:'hollow',requestId:'ea-hollow'});   // 'arena' is the only fragment reason left (v972: Grosk only)
  ok(r3.data.ok===false&&/only Grosk/.test(r3.data.error||''),'tx/earn arena refuses Hollow fragments ('+(r3.data.error||'')+')');
  const r3g=await call('/api/tx/earn',{what:'frag',amount:5,reason:'arena',heroKey:'grosk',requestId:'ea-grosk'});
  ok(r3g.data.ok===true,'CONTROL: tx/earn arena still pays Grosk fragments ('+(r3g.data.error||'ok')+')');
  // #8
  await editDB(u=>{ u.led.stam={v:999,t:Date.now()}; });
  const g1=(await led()).gems;
  const f1=await call('/api/shop/buy',{what:'food',requestId:'food-full'});
  ok(f1.data.ok===false&&/Stamina is full/.test(f1.data.error||''),'a meal at full stamina is refused ('+(f1.data.error||JSON.stringify(f1.data).slice(0,80))+')');
  ok((await led()).gems===g1,'no diamond taken by the refused meal');
  await editDB(u=>{ u.led.stam={v:100,t:Date.now()}; });
  const f2=await call('/api/shop/buy',{what:'food',requestId:'food-low'});
  ok(f2.data.ok===true,'CONTROL: a meal below full stamina sells ('+(f2.data.error||'ok')+')');
  // #1/#5 (v969): the War Chest is one server purchase; the legacy 'convert' earn is gone
  await editDB(u=>{ u.led.gems=10000; u.led.gold=0; });
  const w1=await call('/api/shop/buy',{what:'warchest',requestId:'wc-1'}), l1=await led();
  ok(w1.data.ok===true&&l1.gold===80000&&l1.gems===10000-250,'War Chest: -250 diamonds, +80,000 gold in one purchase ('+(w1.data.error||'gold '+l1.gold+' gems '+l1.gems)+')');
  const w1b=await call('/api/shop/buy',{what:'warchest',requestId:'wc-1'}), l1b=await led();
  ok(l1b.gold===80000&&l1b.gems===10000-250,'the same requestId does not buy twice');
  const cv=await call('/api/tx/earn',{what:'gold',amount:80000,reason:'convert',requestId:'cv-1'});
  ok(cv.data.ok===false&&/No earn rule/.test(cv.data.error||''),'tx/earn gold/convert is refused ('+(cv.data.error||'')+')');
  await editDB(u=>{ u.led.shop=Object.assign(u.led.shop||{},{warchest:25}); u.led.gems=10000; });
  const w26=await call('/api/shop/buy',{what:'warchest',requestId:'wc-26'});
  ok(w26.data.ok===false&&/No more War Chests/.test(w26.data.error||''),'the 26th War Chest of the day is refused ('+(w26.data.error||'')+')');
  console.log('test_market_harden.js: '+pass+' checks passed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
