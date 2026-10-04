// 3 Oct 2026 Market audit #1 (v970): the campaign STAR TRACK is server-owned (/api/stars/claim), real server on a free port + temp DB.
// The server counts the stars it recorded, seeds its claimed count from the save once (no double pay), pays the same ladder, never pays
// a milestone the stars do not reach, never pays twice for one requestId, never pays purchase/arena hero fragments; tx/earn 'stars' is gone.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-star-'));
const dbFile=path.join(dir,'db.json'), NOT_SOLD=['konwu','grosk','vulmar','aureth','hurne','hollow'];
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
async function editDB(fn){ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const starsFor=n=>{ const o={}; let left=n; for(let node=1;left>0;node++){ const v=Math.min(3,left); o[node]=v; left-=v; } return o; };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'star-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  // 45 stars = milestones #0,#1,#2 reachable; the save says #0 was already claimed (the old client-owned count)
  await editDB(u=>{ u.led.camp=u.led.camp||{}; u.led.camp.stars=starsFor(45); u.led.camp.cleared=15;
    const sv=(()=>{ try{ return JSON.parse((u.roster||{}).__save||'{}'); }catch(_){ return {}; } })(); sv.starMilestonesClaimed=1;
    u.roster=Object.assign({},u.roster||{},{__save:JSON.stringify(sv)}); });
  const s0=await led();
  const c1=await call('/api/stars/claim',{requestId:'stars:1'}); const s1=await led();
  ok(c1.data.ok===true&&c1.data.idx===1&&c1.data.got&&c1.data.got.stamina===60,'first claim is milestone #1 (seeded from the save), 60 stamina ('+JSON.stringify(c1.data.got||c1.data.error)+')');
  ok(s1.starClaimed===2,'ledger carries the server claimed count (2) ('+s1.starClaimed+')');
  const c1b=await call('/api/stars/claim',{requestId:'stars:1'}); const s1b=await led();
  ok(s1b.starClaimed===2&&s1b.gems===s1.gems&&(s1b.stamina&&s1.stamina?s1b.stamina.v===s1.stamina.v:true),'the same requestId does not pay twice');
  const c2=await call('/api/stars/claim',{requestId:'stars:2'}); const s2=await led();
  ok(c2.data.ok===true&&c2.data.got.gems===100&&s2.gems===s1.gems+100,'milestone #2 pays 100 diamonds ('+JSON.stringify(c2.data.got||c2.data.error)+')');
  const c3=await call('/api/stars/claim',{requestId:'stars:3'}); const s3=await led();
  ok(c3.data.ok===false&&/60 campaign stars/.test(c3.data.error||'')&&s3.gems===s2.gems&&s3.starClaimed===3,'milestone #3 at 45 stars is refused, nothing paid ('+(c3.data.error||'')+')');
  // the fragment milestone: 60 stars
  await editDB(u=>{ u.led.camp.stars=starsFor(60); });
  const f0=await led(); const c4=await call('/api/stars/claim',{requestId:'stars:3b'}); const f1=await led();
  const fr=(c4.data.got||{}).frags||{}, n=Object.values(fr).reduce((a,b)=>a+b,0);
  ok(c4.data.ok===true&&n===5,'milestone #3 pays 5 hero fragments ('+JSON.stringify(fr)+')');
  ok(Object.keys(fr).every(k=>!NOT_SOLD.includes(k)),'no purchase/arena hero fragments');
  ok(Object.keys(fr).every(k=>((f1.frags||{})[k]|0)-((f0.frags||{})[k]|0)===fr[k]),'the fragments landed in the ledger');
  const ea=await call('/api/tx/earn',{what:'gems',amount:2000,reason:'stars',requestId:'ea-stars'});
  ok(ea.data.ok===false&&/No earn rule/.test(ea.data.error||''),'tx/earn gems/stars is refused ('+(ea.data.error||'')+')');
  console.log('test_star_track.js: '+pass+' checks passed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
