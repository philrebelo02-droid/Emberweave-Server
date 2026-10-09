// 3 Oct 2026 Guild audit P2s (v982): #11 guild names pass badNewName (hidden characters refused); #13 /api/guild/browse
// carries no banners (no list draws them); #12 no textContent assignment holds an HTML entity (it shows literally).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gp2-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  const lit=html.match(/textContent=['"][^'"]*&#\d+;[^'"]*['"]/g)||[];
  ok(lit.length===0,'no textContent assignment holds an HTML entity ('+lit.join(' | ')+')');
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'gp2-'+Date.now()}); token=g.data.token; await call('/api/ledger');
  await delay(400); await stop(); { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.users[g.data.profile.id].led.px=1000; fs.writeFileSync(dbFile,JSON.stringify(db)); } await start();   // v1087: the Guild Hall opens at level 13
  const zw=await call('/api/guild/create',{name:'Ash​Guard'});
  ok(zw.status===400&&/hidden characters/.test(zw.data.error||''),'a guild name with a zero-width space is refused ('+zw.status+' '+(zw.data.error||'')+')');
  const okc=await call('/api/guild/create',{name:'Ash Guard'});
  ok(okc.status===200&&okc.data.guild,'a normal guild name is accepted ('+okc.status+' '+(okc.data.error||'')+')');
  const br=await call('/api/guild/browse');
  ok(Array.isArray(br.data.guilds)&&br.data.guilds.length>0&&br.data.guilds.every(x=>!('banner' in x)),'browse rows carry no banner ('+JSON.stringify(br.data.guilds&&br.data.guilds[0]).slice(0,100)+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_guild_p2.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
