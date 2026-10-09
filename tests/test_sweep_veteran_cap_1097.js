// v1097 - sweep 9 Oct P0 #5 (Veteran portal): x-3/6/9 cap fights at 3 rewarded runs a day, but sweeps skipped the cap and paid without
// limit. The fight, the sweep and the stage card now ask one helper (campCapStageSrv), so Veteran sweeps count toward and respect the cap.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-v1097 server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-vt1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[],admin=false;
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:admin?id:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editRaw(fn){ await delay(400); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const editDB=fn=>editRaw(db=>fn(db.users[id]));
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
let rq=0; const R=()=>'vt'+(rq++);
const dk=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-9*3600000));
const fixture=runs=>editDB(u=>{ u.led.px=99000000; u.led.camp.cleared=160; u.led.stam={v:900,t:Date.now()};
  u.led.portals=u.led.portals||{}; u.led.portals.veteran={cleared:10,stars:{2:3,3:3,6:3},att:null,runs:runs||{}}; });
const sweep=(node,times)=>call('/api/campaign/sweep',{mode:'veteran',node,times:times||1,requestId:R()});
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'vt1097-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await fixture();
  /* sweeps alone: 3 a day on Veteran 1-3 */
  const r=[]; for(let i=0;i<5;i++) r.push((await sweep(3)).data);
  ok(r.slice(0,3).every(x=>x.ok===true),'the first 3 sweeps of Veteran 1-3 pay ('+r.slice(0,3).map(x=>x.ok?'ok':x.error).join(', ')+')');
  ok(r[3].ok===false&&r[4].ok===false&&/Daily limit/.test(r[3].error||''),'the 4th and 5th sweeps of Veteran 1-3 are refused ('+(r[3].error||'paid '+r[3].gold)+')');
  await delay(400);
  ok(((disk().users[id].led.portals.veteran.runs||{}).n3|0)===3,'the sweeps count on the shared daily run counter ('+((disk().users[id].led.portals.veteran.runs||{}).n3|0)+')');
  /* a 10-sweep is clipped to what is left */
  const t=(await sweep(6,10)).data;
  ok(t.ok===true&&t.times===3,'a x10 sweep of Veteran 1-6 runs only the 3 left today ('+(t.times||t.error)+')');
  /* fights first: 3 fights used today -> sweeps refused */
  await fixture({k:dk(),n3:3});
  const f=(await sweep(3)).data;
  ok(f.ok===false&&/Daily limit/.test(f.error||''),'after 3 fights today, a Veteran 1-3 sweep is refused ('+(f.error||'paid '+f.gold)+')');
  /* the stage card agrees */
  const sc=(await call('/api/campaign/stage?mode=veteran&node=3')).data;
  if(sc&&('runsLeft' in sc)) ok(sc.runsLeft===0,'the stage card shows 0 runs left ('+sc.runsLeft+')');
  /* control: a stage without the cap (Veteran 1-2) sweeps freely */
  const c=[]; for(let i=0;i<4;i++) c.push((await sweep(2)).data);
  ok(c.every(x=>x.ok===true),'control: Veteran 1-2 (no cap) sweeps 4 times');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_sweep_veteran_cap_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
