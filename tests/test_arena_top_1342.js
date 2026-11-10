// v1342 (Phil 10 Nov: "Top pick button should record the top 10 most liked battle across the server that pops up so the server can watch the battle. It also had likes or dislike button on the battle").
// Real server on a free port + temp DB. Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-at1342-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok},body:data?JSON.stringify(data):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const A=(await call('/api/register',{name:'ta'+Date.now().toString(36),pass:'password1'})).data, Bq=(await call('/api/register',{name:'tb'+Date.now().toString(36),pass:'password1'})).data;
  await delay(400); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8'));
  db.arenaTop=[]; for(let i=0;i<14;i++) db.arenaTop.push({ id:'b'+i, seed:i+1, mineSnap:[{key:'vex',level:10}], foe:[{key:'vael',level:10}], won:i%2===0, atkName:'Atk'+i, defName:'Def'+i, t:Date.now()-i*60000, votes:{} });
  fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  let r=await call('/api/arena/top',null,A.token); ok(r.status===200&&r.data.ok,'top list answers'); ok((r.data.battles||[]).length===10,'top list is 10 (got '+((r.data.battles||[]).length)+')');
  ok(r.data.battles&&r.data.battles[0].id==='b0','with no votes, newest first');
  r=await call('/api/arena/vote',{id:'b9',v:1},A.token); ok(r.data.ok&&r.data.battles[0].id==='b9'&&r.data.battles[0].up===1&&r.data.battles[0].mine===1,'a like lifts a battle to the top and counts');
  r=await call('/api/arena/vote',{id:'b9',v:1},Bq.token); ok(r.data.battles[0].up===2,'a second player\'s like counts');
  r=await call('/api/arena/vote',{id:'b0',v:-1},A.token); ok(!r.data.battles.slice(0,9).some(x=>x.id==='b0'&&x.down!==1),'a dislike counts'); ok(r.data.battles[r.data.battles.length-1].id!=='b9','dislike sinks, like stays');
  r=await call('/api/arena/vote',{id:'b9',v:1},A.token); r=await call('/api/arena/vote',{id:'b9',v:0},A.token); ok(r.data.battles[0].up===1&&r.data.battles[0].mine===0,'clearing a vote removes only your own');
  r=await call('/api/arena/vote',{id:'nope',v:1},A.token); ok(r.status===404,'unknown battle refused');
  r=await call('/api/arena/top',null,'bad'); ok(r.status===401,'needs sign-in');
  ok(r.data && Array.isArray(((await call('/api/arena/top',null,A.token)).data.battles||[])[0].mineSnap),'a battle carries both teams to watch');
  if(process.env.AUD_SERVER){ assert(missed.length>0,'CONTROL: the old server should miss something'); console.log('CONTROL ok: old server misses '+missed.length+': '+missed[0]); }
  else console.log('test_arena_top_1342.js: '+pass+' checks passed, 0 failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e.message); process.exitCode=1; } finally{ await stop(); } })();
