// v1097 - sweep 9 Oct (real server on a free port + temp DB):
//  #9  the Arena daily claim pays the arena coins it shows (server band table), and they survive a restart;
//  #15 a Patron Arena reset gives back only the 5 free attempts - bought attempts already used stay used;
//  #10 the buy-attempt route sells one attempt at its price (the client now shows it), and the client shows the attempts left,
//      blocks a Challenge with none left, and wires the buy button (static).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ar1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const dk=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-9*3600000));
let rq=0; const R=()=>'a97-'+(rq++);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'ar1097-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(u=>{ u.led.px=9000000; u.led.gems=100000; u.coins=0; delete u.arenaDaily; u.rank=60; });
  // #9 the daily claim pays its arena coins
  const c0=(await led()).arenaCoins|0;
  const dc=await call('/api/arena/daily-claim',{requestId:R()});
  const c1=(await led()).arenaCoins|0;
  ok(dc.data.ok===true&&(dc.data.reward&&dc.data.reward.coins)===530,'the claim names the band reward for rank 60 (530 coins) ('+(dc.data.error||JSON.stringify(dc.data.reward))+')');
  ok(c1-c0===530,'the claim pays the 530 arena coins it shows ('+c0+' -> '+c1+')');
  await editDB(()=>{}); const c2=(await led()).arenaCoins|0;
  ok(c2===c1&&c2>=530,'the paid coins are on disk after a restart ('+c2+')');
  const dc2=await call('/api/arena/daily-claim',{requestId:R()});
  ok(dc2.data.ok===false&&((await led()).arenaCoins|0)===c2,'a second claim the same day pays nothing (control)');
  // #10 buy an attempt
  await editDB(u=>{ u.led.arenaAtt={k:dk(),used:5,bought:0}; });
  const g0=(await led()).gems;
  const ba=await call('/api/arena/buy-attempt',{requestId:R()}); const g1=(await led()).gems;
  ok(ba.data.ok===true&&ba.data.arena.attemptsLeft===1&&ba.data.arena.extraCostGems===20&&g0-g1===20,'buy-attempt sells one attempt for 20 diamonds ('+(ba.data.error||JSON.stringify(ba.data.arena))+')');
  // #15 Patron reset: free attempts only
  const egp3=u=>{ u.led.patron={v:1,base:36,prestiged:false,edpBase:0}; delete u.led.patronDay; };
  await editDB(u=>{ egp3(u); u.led.arenaAtt={k:dk(),used:10,bought:5}; });
  const r1=await call('/api/patron/arena-reset',{requestId:R()});
  ok(r1.data.ok===true&&r1.data.arena&&r1.data.arena.attemptsLeft===5,'all 10 used (5 bought): a reset gives back 5, not 10 ('+(r1.data.error||(r1.data.arena&&r1.data.arena.attemptsLeft))+')');
  await editDB(u=>{ egp3(u); u.led.arenaAtt={k:dk(),used:7,bought:5}; });
  const r2=await call('/api/patron/arena-reset',{requestId:R()});
  ok(r2.data.ok===true&&r2.data.arena.attemptsLeft===8,'7 used of 5 free + 5 bought: the 3 unused bought stay and the 5 free return (8) ('+(r2.data.error||r2.data.arena.attemptsLeft)+')');
  await editDB(u=>{ egp3(u); u.led.arenaAtt={k:dk(),used:5,bought:0}; });
  const r3=await call('/api/patron/arena-reset',{requestId:R()});
  ok(r3.data.ok===true&&r3.data.arena.attemptsLeft===5,'control: no bought attempts - the 5 free come back ('+(r3.data.error||r3.data.arena.attemptsLeft)+')');
  // static: the client
  if(!process.env.AUD_SERVER){
    const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
    ok(/if\(d\.arena\) ARENA\.att=d\.arena;/.test(html),'the Arena screen keeps the server\'s attempts view');
    ok(/id="arenaAttLeft"[^\n]*\$\{att\.attemptsLeft\|0\}/.test(html),'the Arena screen shows the attempts left');
    ok(/apiOnce\('arenabuy','\/api\/arena\/buy-attempt'/.test(html)&&/Buy \+1 &middot; \$\{att\.extraCostGems\|0\} diamonds/.test(html),'a buy button calls /api/arena/buy-attempt and shows its cost');
    ok(/data-opp="\$\{i\}" \$\{noAtt\?'disabled':''\}/.test(html)&&/function startArena\(o\)\{ if\(arenaNoAttempts\(\)\)/.test(html),'Challenge is disabled and a fight never starts with 0 attempts');
    ok(/if\(!paid\) G\.arenaCoins=/.test(html)&&/_finish\(r\.reward,true\)/.test(html),'the client no longer adds the daily coins on top of the server\'s');
  }
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_arena_sweep_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
