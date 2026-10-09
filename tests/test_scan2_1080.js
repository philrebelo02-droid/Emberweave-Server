// v1080 - exploit scan round 2 (real server on a free port + temp DB):
//  #5 a look-alike of an existing player's name (full-width, Cyrillic, punctuation) is refused like the name itself;
//  #3 a rename goes through the server: first free, then 50 diamonds, and the ACCOUNT name changes (before: client-only, charged);
//  #4 an arena bot never gets a castle / player ledger (worldLocation refuses NPCs);
//  #2 a castle with no standing defender is taken without loot (static: the loot branch needs defenders).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-s2-1080-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,REG_PER_MIN:'200',REG_ACCOUNTS_PER_IP:'200'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const r1=await call('/api/register',{name:'Marigold',pass:'password123',deviceId:'s2a'}); token=r1.data.token; id=(r1.data.profile||{}).id;
  ok(r1.status===200&&!!token,'a normal account registers ('+(r1.data.error||'')+')');
  // #5 look-alikes
  for(const n of ['ＭＡＲＩＧＯＬＤ','Mаrigold','Mari-gold']){   // full-width / Cyrillic a / punctuation
    const r=await call('/api/register',{name:n,pass:'password123',deviceId:'s2-'+n.length+Math.random()});
    ok(r.status===409,'#5 the look-alike "'+n+'" is refused ('+r.status+' '+(r.data.error||'')+')'); }
  const fine=await call('/api/register',{name:'Marigolds',pass:'password123',deviceId:'s2c'});
  ok(fine.status===200,'#5 a genuinely different name still registers ('+(fine.data.error||'')+')');
  // #3 rename through the server
  await call('/api/ledger'); await editDB((db,u)=>{ u.led.gems=500; });
  const rn1=await call('/api/account/rename',{name:'Bramble',requestId:'rn1'});
  ok(rn1.status===200&&rn1.data.ok===true&&rn1.data.cost===0,'#3 the first rename is free ('+(rn1.data.error||rn1.status)+')');
  const prof=await call('/api/ledger'); const gemsA=(prof.data.ledger||prof.data).gems;
  const rn2=await call('/api/account/rename',{name:'Thistle',requestId:'rn2'});
  const _lb=(await call('/api/ledger')).data; const gemsB=(_lb.ledger||_lb).gems;
  ok(rn2.data.ok===true&&rn2.data.cost===50&&gemsA-gemsB===50,'#3 the second rename costs 50 diamonds, taken by the server ('+gemsA+' -> '+gemsB+')');
  await delay(600); const db=disk();
  ok(db.users[id].name==='Thistle'&&db.byName.thistle===id&&!db.byName.marigold&&!db.byName.bramble,'#3 the ACCOUNT name changed and the name index moved');
  const taken=await call('/api/account/rename',{name:'Marigolds',requestId:'rn3'});
  ok(taken.data.ok===false&&/taken/.test(taken.data.error||''),'#3 a taken name is refused ('+(taken.data.error||'')+')');
  // #4 / #2 static
  const src=fs.readFileSync(path.join(root,srvFile),'utf8');
  ok(/function worldLocation\(u\)\{\r?\n  if\(!u\|\|u\.isNpc\) return null;/.test(src),'#4 an arena bot never gets a castle (and so no player ledger)');
  ok(/if\(won&&!defSnaps\.length\) loot=\{gold:0,guildCoins:0,undefended:true\};/.test(src)&&/if\(won&&defSnaps\.length\)\{ const g=Math\.min\(400/.test(src),'#2 an undefended castle pays no loot');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_scan2_1080.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
