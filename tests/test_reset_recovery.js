// 4 Oct 2026 Account re-audit N7 (v1017): password recovery could be denied to its owner - anyone could burn an account's whole day
// of reset codes (5) and wrong guesses (10). Each requesting network now has its own share per account (2 codes, 5 wrong guesses a day)
// under a higher account-wide ceiling. Locally there is no proxy, so the last x-forwarded-for entry stands in for the network.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-reset-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,SMTP_HOST:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,ip){ const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':ip},body:JSON.stringify(data)});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const reg=await call('/api/register',{name:'resetOwner',pass:'password1'},'10.0.0.9'); id=reg.data.profile.id;
  await delay(400); await stop(); const d=disk(); d.users[id].email='owner@example.test'; fs.writeFileSync(dbFile,JSON.stringify(d)); await start();
  for(let i=0;i<3;i++) await call('/api/reset-request',{name:'resetOwner'},'10.0.0.66');   // a stranger's network asks three times
  const _log=async(want)=>{ let r={}; for(let i=0;i<40;i++){ try{ r=(disk().users[id].resetLog)||{}; }catch(_){ r={}; } if(want(r)) break; await delay(200); } return r; };   /* v1357 (flakes): the save had not reached the file after a fixed 400 ms on a loaded host */
  const r1=await _log(r=>(r.codes|0)>=2);
  ok((r1.codes|0)===2,'one network gets 2 codes a day for this account ('+(r1.codes|0)+')');
  await call('/api/reset-request',{name:'resetOwner'},'10.0.0.9');   // the owner's own network still gets a code
  const r2=await _log(r=>(r.codes|0)>=3);
  ok((r2.codes|0)===3,'the owner\'s network still gets a code after a stranger used theirs ('+(r2.codes|0)+')');
  const outs=[]; for(let i=0;i<6;i++) outs.push((await call('/api/reset-verify',{name:'resetOwner',code:'000000',newPass:'newpassword1'},'10.0.0.66')).data.error||'');
  ok(/from this network/.test(outs[5]),'a 6th wrong guess from the same network is refused for that network ('+outs[5]+')');
  await call('/api/reset-request',{name:'resetOwner'},'10.0.0.9');
  // 4 Nov 2026 (Claude): since v1184 the reset request answers at once and hashes the new code on the thread pool, so on a slow node the verify
  // below raced the old (used-up) code: wait until the owner's new code is stored (resetLog.codes 4 and a fresh reset entry), as the earlier steps wait for theirs.
  const fresh=()=>{ const u=disk().users[id]; return ((u.resetLog||{}).codes|0)>=4&&!!u.reset&&(u.reset.tries|0)===0; };   /* codes counted AND the new code itself stored */
  for(let i=0;i<100&&!fresh();i++) await delay(100);
  const own=(await call('/api/reset-verify',{name:'resetOwner',code:'000000',newPass:'newpassword1'},'10.0.0.9')).data.error||'';
  ok(/Incorrect code/.test(own),'the owner\'s network still has its own guesses ('+own+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_reset_recovery.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
