// 3 Oct 2026 Guild audit #6 (v980): a deleted guild must not stay a Skyfall entrant. (1) When the last member leaves, the guild
// is deleted and its OPEN registration goes with it. (2) At the Monday lock an entrant whose guild no longer exists is dropped -
// before, it was kept with the lines it registered with (players who may now be in another registered guild).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-skyghost-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const ghost=gid=>({guildId:gid,name:'Ghost '+gid,banner:null,registeredAt:1,lines:[{userId:'nobody',heroes:['vael']}],powerPool:99999,indicative:true});
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'skyghost-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const st=await call('/api/guild-war/status'); ok(st.status===200&&st.data.enabled!==false,'Skyfall is on ('+JSON.stringify(st.data).slice(0,60)+')');
  // (1) the last member leaves during registration
  await editDB((db,u)=>{ db.guilds=db.guilds||{}; db.guilds.gsolo={id:'gsolo',name:'Solo Guild',leader:id,members:[id],level:1,exp:0}; u.guildId='gsolo';
    const t=db.tournaments.current; t.state='registration'; t.registrationLocksAt=Date.now()+3600000; t.entrants=[ghost('gsolo')]; });
  const lv=await call('/api/guild/leave',{});
  ok(lv.data.disbanded===true,'the last member leaving deletes the guild ('+JSON.stringify(lv.data).slice(0,60)+')');
  await delay(400); await stop(); const d1=disk(); await start();
  ok(!(d1.tournaments.current.entrants||[]).some(e=>e.guildId==='gsolo'),'its open registration is gone ('+(d1.tournaments.current.entrants||[]).map(e=>e.guildId).join(',')+')');
  // (2) a ghost entrant at the lock
  await editDB((db)=>{ const t=db.tournaments.current; t.state='registration'; t.registrationLocksAt=Date.now()-1000; t.entrants=[ghost('ggone')]; });
  await call('/api/guild-war/status');
  await delay(400); await stop(); const d2=disk(); await start();
  ok(!(d2.tournaments.current.entrants||[]).some(e=>e.guildId==='ggone'),'the lock drops an entrant whose guild is gone ('+(d2.tournaments.current.entrants||[]).map(e=>e.guildId).join(',')+', state '+d2.tournaments.current.state+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_skyfall_ghost.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
