// 3 Oct 2026 Pool+Forge audit #8 (v1004): after "Reset all progress" the gear revision is back to 1, so the SAME first craft body
// used to replay the old receipt for 24 h (nothing crafted). The ledger epoch is now part of the gear receipt key: the same packet
// after a reset crafts again.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gepoch-'));
const dbFile=path.join(dir,'db.json');
const catalog=require(path.join(root,'server/gear-catalog.json')), green=catalog.items.find(x=>x.qi===1);
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,GEAR_V2_ENABLED:'true'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const seed=u=>{ u.dust=1000; u.gear={revision:1,fragments:Object.fromEntries(catalog.items.map(d=>[d.frag,100])),subs:{},items:{},equipped:{},active:{},seq:1}; };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'gepoch-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>seed(u));
  const pkt={expectedRevision:1,gearId:green.id};
  const c1=await call('/api/gear/craft-sub',pkt);
  const s1=(await call('/api/gear/state')).data;
  ok(c1.status===200&&((s1.subs||{})[green.sub]|0)===1,'the first sub-craft works ('+c1.status+' '+JSON.stringify(c1.data).slice(0,80)+')');
  const rs=await call('/api/account/reset-progress',{});
  ok(rs.status===200,'reset all progress ('+rs.status+')');
  await editDB((db,u)=>seed(u));
  const c2=await call('/api/gear/craft-sub',pkt);
  const s2=(await call('/api/gear/state')).data;
  ok(c2.status===200&&((s2.subs||{})[green.sub]|0)===1,'after the reset the same packet crafts again, not an old receipt ('+((s2.subs||{})[green.sub]|0)+' sub(s))');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_gear_epoch.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
