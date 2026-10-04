// 3 Oct 2026 Market audit #1 (v971): the DAILY SIGN-IN is server-owned (/api/signin/claim), real server on a free port + temp DB.
// Same calendar as the client (New York day shifted 9 h, day-of-month ladder, Saturday monthly-hero fragments), claimed days on the
// ledger seeded once from the save, one claim a day, one payment per requestId; tx/earn 'signin' is gone; SIGNIN_HERO_POOL == client.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-signin-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
async function editDB(fn){ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
// the client's calendar, recomputed independently (signinNow: New York wall time 9 h ago)
function calendar(now){ const p={}; for(const x of new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(now-9*3600000))) p[x.type]=x.value;
  const y=+p.year, m0=+p.month-1, day=+p.day, dow=new Date(Date.UTC(y,m0,day)).getUTCDay(), dim=new Date(Date.UTC(y,m0+1,0)).getUTCDate(); return {y,m0,day,dow,dim,mk:y+'-'+(m0+1)}; }
(async()=>{ try{
  const srv=fs.readFileSync(path.join(root,srvFile),'utf8'), html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  const HB=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE);
  const rows=[...html.matchAll(/^\s*([a-z_]+):\s*\{name:["']([^"']*)["'][^\n]*/gm)].filter(r=>HB.includes(r[1]));
  const clientPool=rows.filter(r=>!/myth:true/.test(r[0])&&!/source:'/.test(r[0])).map(r=>r[1]);
  let pool=clientPool;
  if(!process.env.AUD_SERVER){ const m=srv.match(/const SIGNIN_HERO_POOL=\[([^\]]*)\]/); ok(m,'server defines SIGNIN_HERO_POOL');
    pool=m[1].match(/'([a-z_]+)'/g).map(s=>s.slice(1,-1));
    ok(rows.length===60&&JSON.stringify(pool)===JSON.stringify(clientPool),'SIGNIN_HERO_POOL equals the client HERO_KEYS order minus mythical/source heroes ('+pool.length+'/'+clientPool.length+')'); }
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'signin-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const c=calendar(Date.now());
  const expect=c.dow===6?{frags:{[pool[(c.y*12+c.m0)%pool.length]]:(c.day+7>c.dim)?15:5}}:[{gold:300},{stamina:60},{gems:20},{gold:400},{gold:600},{gems:30}][(c.day-1)%6];
  // migration: the save already claimed today -> refused, nothing paid
  await editDB(u=>{ const sv=(()=>{ try{ return JSON.parse((u.roster||{}).__save||'{}'); }catch(_){ return {}; } })(); sv.signinMonth=c.mk; sv.signinClaimed=[c.day];
    u.roster=Object.assign({},u.roster||{},{__save:JSON.stringify(sv)}); });
  const a0=await led(); const r0=await call('/api/signin/claim',{requestId:'si-mig'}); const a1=await led();
  ok(r0.data.ok===false&&/Already signed in/.test(r0.data.error||'')&&a1.gold===a0.gold&&a1.gems===a0.gems,'a day the save already claimed is refused ('+(r0.data.error||JSON.stringify(r0.data).slice(0,80))+')');
  // (a refusal commits nothing, so the seeded calendar is stored by the first successful claim, not here)
  // a fresh account claims today
  await editDB(u=>{ delete u.led.signin; u.roster=Object.assign({},u.roster||{},{__save:'{}'}); });
  const b0=await led(); const r1=await call('/api/signin/claim',{requestId:'si-'+c.mk+'-'+c.day}); const b1=await led();
  ok(r1.data.ok===true&&r1.data.day===c.day,'today is claimed ('+(r1.data.error||'day '+r1.data.day)+')');
  ok(JSON.stringify(r1.data.got)===JSON.stringify(expect),'the reward is the client calendar\'s reward for today ('+JSON.stringify(r1.data.got)+' vs '+JSON.stringify(expect)+')');
  const r1b=await call('/api/signin/claim',{requestId:'si-'+c.mk+'-'+c.day}); const b2=await led();
  ok(b2.gold===b1.gold&&b2.gems===b1.gems&&JSON.stringify(b2.frags)===JSON.stringify(b1.frags),'the same requestId does not pay twice');
  const r2=await call('/api/signin/claim',{requestId:'si-again'});
  ok(r2.data.ok===false&&/Already signed in/.test(r2.data.error||''),'a second claim the same day is refused');
  const ea=await call('/api/tx/earn',{what:'gems',amount:200,reason:'signin',requestId:'ea-si'});
  ok(ea.data.ok===false&&/No earn rule/.test(ea.data.error||''),'tx/earn gems/signin is refused ('+(ea.data.error||'')+')');
  console.log('test_signin.js: '+pass+' checks passed (server '+srvFile+', today '+c.mk+'-'+c.day+' dow '+c.dow+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
