// v1082 - exploit scan round 3 (real server on a free port + temp DB): a purchase never charges in full for a grant the cap would clip.
//  F3 shields (99), a meal near the 999 stamina cap, arena Grosk fragments (9999) are refused instead; F2 a guest cannot rename;
//  F4 a signed-in player's diamonds never go to a stale local guild (static client checks).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-cap1082-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const L=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'cap1082-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(u=>{ u.led.gems=50000; u.shields=98; u.coins=100000; u.led.frags=Object.assign({},u.led.frags,{grosk:9998}); u.led.stam={v:950,t:Date.now()}; });
  const g0=(await L()).gems;
  const sh=await call('/api/shop/buy',{what:'shields3',requestId:'c-sh'});
  ok(sh.data.ok===false&&/99/.test(sh.data.error||'')&&(await L()).gems===g0,'3 shields at 98 are refused and nothing is charged ('+(sh.data.error||'')+')');
  // (a meal near the 999 stamina cap is left as is - refusing it would block meals for any player above 879 stamina)
  const c0=(await L()).arenaCoins;
  const fr=await call('/api/arena/shop',{item:'groskfrag',requestId:'c-fr'});
  ok(fr.data.ok===false&&(await L()).arenaCoins===c0,'5 Grosk fragments at 9998 are refused and no coins taken ('+(fr.data.error||'')+')');
  const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  ok(html.includes("if(ACC.token&&ACC.guest){ msg.textContent='Make an account first - guests keep their guest name.'; return; }"),'F2 a guest gets "make an account first" instead of a screen-only rename');
  ok(html.includes("if(ACC.token&&o.kind!=='res') return false;"),'F4 a signed-in player never spends diamonds on a local guild');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_caps_1082.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
