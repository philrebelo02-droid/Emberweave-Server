// v1087 - scan 8 (unlock gates the server never checked):
//  #1 the Guild Hall opens at level 13 - create / request / contribute / raid start / war register were open from level 1;
//  #2 /api/trial/resolve: the Tower ladder needs level 40, the Vault ladder level 10, the retired Gauntlet pays nothing;
//  #4 the arena shop needs level 10 like the arena; #7 the market shield is one per CLOCK hour (the market restocks hourly).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-g1087-'));
const dbFile=path.join(dir,'db.json'), src=fs.readFileSync(path.join(root,srvFile),'utf8');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'g1087-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>{ u.coins=5000; u.led.gold=100000; });
  // level 1
  const c1=await call('/api/guild/create',{name:'Gate Test'});
  ok(c1.status===400&&/level 13/.test(c1.data.error||''),'#1 a level-1 account cannot found a guild ('+c1.status+' '+(c1.data.error||'')+')');
  const tw=await call('/api/trial/resolve',{kind:'tower',floor:1,win:true,requestId:'g1087-tw'});
  ok(tw.data.ok===false&&/level 40/.test(tw.data.error||''),'#2 a level-1 account gets nothing from the Tower ladder ('+(tw.data.error||JSON.stringify(tw.data).slice(0,80))+')');
  const gt=await call('/api/trial/resolve',{kind:'gauntlet',floor:1,win:true,requestId:'g1087-gt'});
  ok(gt.data.ok===false&&/retired/.test(gt.data.error||''),'#2 the retired Gauntlet pays nothing ('+(gt.data.error||'')+')');
  const pr=await call('/api/trial/resolve',{kind:'toString',floor:1,win:true,requestId:'g1087-pr'});
  ok(pr.data.ok===false&&/Unknown trial|Invalid request/.test(pr.data.error||''),'#2 a prototype key is an unknown trial ('+JSON.stringify(pr.data).slice(0,120)+')');
  const as=await call('/api/arena/shop',{item:'gold1',requestId:'g1087-as'});
  ok(as.data.ok===false&&/level 10/.test(as.data.error||''),'#4 a level-1 account cannot spend in the arena shop ('+(as.data.error||'')+')');
  // CONTROL: level 13+ (806 px) opens the hall and the arena shop
  await editDB((db,u)=>{ u.led.px=1000; });
  const c2=await call('/api/guild/create',{name:'Gate Test'});
  ok(c2.status===200&&c2.data.guild,'CONTROL: at level 13 the guild is founded ('+c2.status+' '+(c2.data.error||'')+')');
  const as2=await call('/api/arena/shop',{item:'gold1',requestId:'g1087-as2'});
  ok(as2.data.ok===true,'CONTROL: at level 13 the arena shop sells ('+(as2.data.error||'ok')+')');
  // #7 static
  ok(/Math\.floor\(Date\.now\(\)\/3600000\)===Math\.floor\(\(\+me\.marketShieldAt\|\|0\)\/3600000\)/.test(src),'#7 the market shield limit is per clock hour');
  ok((src.match(/<13\) return send\(res,400,\{error:'The Guild Hall opens at level 13\.'\}\);/g)||[]).length===5,'#1 all five guild entry routes carry the level-13 gate');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_gates_1087.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
