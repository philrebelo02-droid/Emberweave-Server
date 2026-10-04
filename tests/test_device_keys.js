// 4 Oct 2026 Account audit #11 (v1005): a guest's deviceId resumes that guest, so it works like a password - it is now stored only
// as a hash (like session tokens), and raw keys left from before are converted at boot. A guest still resumes by its device id.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-devk-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function guest(dev){ const r=await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:dev})}); return r.json(); }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const devA='dev-A-'+Date.now();
  const g1=await guest(devA); await delay(500);
  const d1=disk(); const keys=Object.keys(d1.guestByDevice||{});
  ok(g1.profile&&!keys.includes(devA)&&keys.some(k=>/^h:[0-9a-f]{32}$/.test(k)),'a new guest\'s device id is stored only as a hash ('+keys.join(',').slice(0,80)+')');
  const g2=await guest(devA);
  ok(g2.profile&&g2.profile.id===g1.profile.id,'the same device id resumes the same guest');
  // a raw key from before v1005
  await stop(); const d=disk(); const devOld='dev-OLD-'+Date.now();
  d.guestByDevice=d.guestByDevice||{}; d.guestByDevice[devOld]=g1.profile.id; d.devices=d.devices||{}; d.devices[devOld]=2;
  for(const k of Object.keys(d.guestByDevice)) if(k!==devOld && d.guestByDevice[k]===g1.profile.id) delete d.guestByDevice[k];
  fs.writeFileSync(dbFile,JSON.stringify(d)); await start(); await delay(500);
  const g3=await guest(devOld);
  ok(g3.profile&&g3.profile.id===g1.profile.id,'a guest stored under a raw key from before still resumes after the boot migration');
  await delay(400); await stop(); const d3=disk(); await start();
  ok(!Object.keys(d3.guestByDevice||{}).includes(devOld)&&!Object.keys(d3.devices||{}).includes(devOld),'no raw device id is left on disk');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_device_keys.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
