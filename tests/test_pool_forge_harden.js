// 3 Oct 2026 Wishing Pool + Forge audit (v968), real server on a free port + temp DB:
//  Forge #2 - gear cannot be equipped on (or made active for) a hero the player does not own; an owned hero still equips (control);
//  Pool #3  - /api/pool/state says how long until the free diamond wish (New York midnight), never the 09:00 arena reset.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-pf-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
async function editDB(fn){ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'pf-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const cat=JSON.parse(fs.readFileSync(path.join(root,'server','gear-catalog.json'),'utf8')).items;
  const HB=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE);
  let owned, unowned;
  await editDB(u=>{ const un=u.led.unlocked||{}; owned=HB.find(k=>un[k]); unowned=HB.find(k=>!un[k]);
    u.gear={revision:1,fragments:{},subs:{},items:{q1:{d:cat[0].id,temper:0,prog:0,dustSpent:0,bound:false,createdAt:Date.now()},q2:{d:cat[0].id,temper:0,prog:0,dustSpent:0,bound:false,createdAt:Date.now()}},equipped:{},active:{},seq:3}; });
  ok(owned&&unowned,'fixture has an owned ('+owned+') and an unowned ('+unowned+') hero');
  const e1=await call('/api/gear/equip',{heroKey:unowned,itemId:'q1',expectedRevision:1});
  ok(!e1.data.ok&&/own/.test(e1.data.error||''),'equip on an unowned hero is refused ('+(e1.data.error||JSON.stringify(e1.data).slice(0,80))+')');
  const st=(await call('/api/gear/state')).data; const eqd=(st.gear||st).equipped||{};
  ok(!eqd[unowned],'nothing was equipped on the unowned hero');
  const e2=await call('/api/gear/equip',{heroKey:owned,itemId:'q2',expectedRevision:(st.gear||st).revision||1});
  ok(e2.data.ok===true,'CONTROL: equip on an owned hero works ('+(e2.data.error||'ok')+')');
  const ps=(await call('/api/pool/state')).data;
  ok(ps.gemFree&&typeof ps.gemFree.nextMs==='number','pool state carries gemFree.nextMs ('+JSON.stringify(ps.gemFree)+')');
  if(!ps.gemFree.ready){ ok(ps.gemFree.nextMs>0&&ps.gemFree.nextMs<=25*3600e3,'next free diamond wish within a day ('+ps.gemFree.nextMs+')'); }
  // the countdown must land on a New York day boundary: the NY date one second after it is a different day than now
  const etDay=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(t));
  const nm=ps.gemFree.nextMs||0; if(nm>0){ ok(etDay(Date.now()+nm+2000)!==etDay(Date.now()),'nextMs ends at New York midnight'); ok(etDay(Date.now()+nm-5000)===etDay(Date.now()),'and not before it'); }
  console.log('test_pool_forge_harden.js: '+pass+' checks passed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
