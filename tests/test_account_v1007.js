// 4 Oct 2026 Account re-audit (v1007). N2: the guest 15-a-day cap is kept after the 10-minute rate-limit sweeper runs (it used to
// drop every entry older than 10 minutes, so the 24 h window was really 10 minutes). N6: the cloud save is stored as ONE string -
// other roster keys are dropped and an object __save is refused.
// The server runs with a preload that moves its clock forward on request and runs the 10-minute sweeper every 0.5 s.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-a1007-'));
const dbFile=path.join(dir,'db.json'), skewFile=path.join(dir,'skew.txt'), preload=path.join(dir,'clock.js');
fs.writeFileSync(skewFile,'0');
fs.writeFileSync(preload,`const fs=require('fs'),f=${JSON.stringify(skewFile)},real=Date.now; let sk=0,at=0;
Date.now=()=>{ const r=real(); if(r-at>100){ at=r; try{ sk=+fs.readFileSync(f,'utf8')||0; }catch(_){} } return r+sk; };
const si=global.setInterval; global.setInterval=(fn,ms,...a)=>si(fn,ms===600000?500:ms,...a);`);
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['--require',preload,srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function post(p,b,tok){ const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:JSON.stringify(b)}); let j={}; try{ j=await r.json(); }catch(_){} return {s:r.status,j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  // N6 - save shape
  const g=await post('/api/guest',{deviceId:'a1007-save-'+Date.now()}); const tok=g.j.token;
  const s1=await post('/api/save',{roster:{__save:JSON.stringify({mtime:1}),junk:{x:'y'.repeat(1000)},vex:{level:1,rank:1}}},tok);
  ok(s1.s===200,'an ordinary save is accepted ('+s1.s+')');
  const ro=(disk().users[g.j.profile.id]||{}).roster||{};
  ok(JSON.stringify(Object.keys(ro))==='["__save"]','only the save string is stored ('+Object.keys(ro).join(',')+')');
  const s2=await post('/api/save',{roster:{__save:{gems:1}}},tok);
  ok(s2.s===400,'an object __save is refused ('+s2.s+')');
  const s3=await post('/api/save',{roster:{junk:'x'}},tok);
  ok(s3.s===400,'a roster with no save string is refused ('+s3.s+')');
  // N2 - the guest daily cap survives the sweeper (one guest is already made above)
  let made=1, refused=0;
  for(let i=0;i<14;i++){ const r=await post('/api/guest',{deviceId:'a1007-g'+i+'-'+Date.now()}); if(r.s===200) made++; else refused++; }
  ok(made===15&&refused===0,'15 guests a day from one network are allowed ('+made+' made)');
  const r16=await post('/api/guest',{deviceId:'a1007-g16a-'+Date.now()});
  ok(r16.s===429,'the 16th guest the same minute is refused ('+r16.s+')');
  fs.writeFileSync(skewFile,String(11*60000)); await delay(1500);   // 11 minutes later; the sweeper has run
  const r17=await post('/api/guest',{deviceId:'a1007-g16b-'+Date.now()});
  ok(r17.s===429,'11 minutes later (after the sweeper) the 16th guest is still refused ('+r17.s+')');
  fs.writeFileSync(skewFile,String(25*3600000)); await delay(1500);   // a day later the window is over
  const r18=await post('/api/guest',{deviceId:'a1007-g16c-'+Date.now()});
  ok(r18.s===200,'a day later a new guest is allowed again ('+r18.s+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_account_v1007.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
