// v1091 - scan 12 (P0): a request whose target cannot be parsed ('GET //', '//[') threw in `new URL(req.url)` before any routing.
// Every one was an uncaughtException; about 20 in a minute made the crash backstop exit the process - no account needed.
// Now answered 400. Live: 30 bad targets over a raw socket, then /health must still answer.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-bt1091-'));
let port,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
function raw(target){ return new Promise(res=>{ const s=net.connect(port,'127.0.0.1',()=>s.write('GET '+target+' HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
  let d=''; s.setTimeout(1500,()=>{ s.destroy(); res(d||'(no answer)'); }); s.on('data',c=>d+=c); s.on('end',()=>res(d)); s.on('error',()=>res('(error)')); }); }
(async()=>{ try{
  port=await freePort();
  child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:path.join(dir,'db.json')},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch('http://127.0.0.1:'+port+'/health')).ok) break; }catch(_){} await delay(100); }
  const first=await raw('//');
  ok(/^HTTP\/1\.1 400/.test(first),'a bad target gets 400 ('+first.split('\r\n')[0]+')');
  const answers=[]; for(let i=0;i<30;i++) answers.push(await raw(['//','//[','//%','///','//a:b@:x'][i%5]));
  await delay(500);
  ok(child.exitCode===null,'after 30 bad targets the server process is still running (exit '+child.exitCode+')');
  let h=0; try{ h=(await fetch('http://127.0.0.1:'+port+'/health')).status; }catch(_){}
  ok(h===200,'CONTROL: /health still answers 200 ('+h+')');
  ok(answers.every(a=>/^HTTP\/1\.1 400/.test(a)),'every bad target was answered 400');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_bad_target_1091.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { if(child&&child.exitCode===null) child.kill(); } })();
