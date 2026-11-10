// v1341 (Phil 10 Nov: "I should always be able to see 4 opponents" / "No matter what rank I am" / "Rank 1 should be able to see the top 10 to fight" /
// "the climb was really slow. Increase the max range each opponent found by 25%"). Real server on a free port + temp DB.
// Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ao1341-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||token},body:data?JSON.stringify(data):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function setRank(rk){ await delay(400); await stop(); const db=disk(); const me=db.users[id], old=me.rank; const other=Object.values(db.users).find(u=>u.id!==id&&u.rank===rk); if(other) other.rank=old; me.rank=rk; fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const reg=await call('/api/register',{name:'ao'+Date.now().toString(36),pass:'password1'}); token=reg.data.token; id=reg.data.profile.id;
  for(const rk of [1,2,3,10,11,45,800]){ await setRank(rk); const r=await call('/api/arena/opponents'); const o=(r.data.opponents||[]);
    ok(r.data.rank===rk,'rank '+rk+' set');
    ok(o.length>=4,'rank '+rk+': at least 4 opponents (got '+o.length+')');
    if(rk<=10){ const want=new Set([1,2,3,4,5,6,7,8,9,10].filter(x=>x!==rk)); ok(o.length===5&&o.every(x=>want.has(x.rank)),'rank '+rk+': 5 of the other top 10 (got '+o.map(x=>x.rank).join(',')+')');
      const seen=new Set(o.map(x=>x.rank)); for(let k=0;k<25&&seen.size<9;k++){ const q=(await call('/api/arena/opponents')).data.opponents||[]; q.forEach(x=>seen.add(x.rank)); } ok(seen.size===9,'rank '+rk+': refreshing reaches all 9 others (saw '+seen.size+')'); }
    ok(!o.some(x=>x.id===id),'rank '+rk+': never yourself'); }
  const src=fs.readFileSync(path.join(root,srvFile),'utf8');
  ok(/\[Math\.min\(T,oneRank\),T\*1\.25\]/.test(src)&&/\(T\+12\)\*1\.25\]/.test(src),'each band reaches 25% further');
  if(process.env.AUD_SERVER){ assert(missed.length>0,'CONTROL: the old server should miss something'); console.log('CONTROL ok: old server misses '+missed.length+': '+missed[0]); }
  else console.log('test_arena_opps_1341.js: '+pass+' checks passed, 0 failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e.message); process.exitCode=1; } finally{ await stop(); } })();
