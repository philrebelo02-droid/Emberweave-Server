// 4 Oct 2026 City Wall audit #14 (v997): every City Wall / Bulletin Board spend route has an HTTP test in the suite - refusals
// are explicit, a success moves exactly what it says, and the SAME requestId applies once (the second answer is the receipt).
// Routes: /api/hero/xp-potion, /api/hero/refine, /api/hero/summon, /api/skill/upgrade, /api/quest/claim, /api/arena/ladder.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-wallr-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0;
const ok=(c,m)=>{ assert(c,m); pass++; };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'wallr-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  // --- xp potion
  const p0=await call('/api/hero/xp-potion',{heroKey:'vael',tier:'minor',requestId:'xp-0'});
  ok(p0.data.ok===false,'xp potion: refused without the hero or a potion ('+(p0.data.error||'')+')');
  await editDB((db,u)=>{ u.led.px=3000; u.led.unlocked.vael=true; u.led.hero.vael={xp:0,stars:5,pips:0,ref:0}; u.led.xpPotions={minor:2}; u.led.gold=1000000; u.led.frags={vael:500,cacklefang:200}; delete u.led.unlocked.cacklefang; });
  const p1=await call('/api/hero/xp-potion',{heroKey:'vael',tier:'minor',requestId:'xp-1'}), p1b=await call('/api/hero/xp-potion',{heroKey:'vael',tier:'minor',requestId:'xp-1'});
  const l1=await led();
  ok(p1.data.ok===true&&p1.data.heroXp>0,'xp potion: grants hero XP ('+(p1.data.error||p1.data.heroXp)+')');
  ok(same(p1.data,p1b.data)&&l1.xpPotions.minor===1,'xp potion: the same requestId uses one potion ('+l1.xpPotions.minor+' left)');
  const p2=await call('/api/hero/xp-potion',{heroKey:'vael',tier:'nope',requestId:'xp-2'});
  ok(p2.data.ok===false&&/Unknown potion/.test(p2.data.error||''),'xp potion: unknown tier refused');
  // --- refine (5★ vael, 500 fragments, first tier costs 50)
  const r1=await call('/api/hero/refine',{heroKey:'vael',requestId:'rf-1'}), r1b=await call('/api/hero/refine',{heroKey:'vael',requestId:'rf-1'});
  const l2=await led();
  ok(r1.data.ok===true&&typeof r1.data.success==='boolean','refine: rolls on the server ('+(r1.data.error||r1.data.success)+')');
  ok(same(r1.data,r1b.data)&&(l2.frags.vael|0)===450,'refine: the same requestId pays 50 fragments once ('+l2.frags.vael+')');
  const r2=await call('/api/hero/refine',{heroKey:'cacklefang',requestId:'rf-2'});
  ok(r2.data.ok===false,'refine: refused on a hero that is not 5★ / not owned ('+(r2.data.error||'')+')');
  // --- summon (cacklefang not owned, 200 fragments)
  const s1=await call('/api/hero/summon',{heroKey:'cacklefang',requestId:'sm-1'}), s1b=await call('/api/hero/summon',{heroKey:'cacklefang',requestId:'sm-1'});
  const l3=await led();
  ok(s1.data.ok===true&&l3.unlocked.cacklefang,'summon: unlocks the hero ('+(s1.data.error||'ok')+')');
  ok(same(s1.data,s1b.data)&&(l3.frags.cacklefang|0)<200,'summon: the same requestId summons once');
  const s2=await call('/api/hero/summon',{heroKey:'cacklefang',requestId:'sm-2'});
  ok(s2.data.ok===false&&/Already summoned/.test(s2.data.error||''),'summon: a second summon is refused');
  // --- skill upgrade
  const k0=await led();
  const u1=await call('/api/skill/upgrade',{key:'vael',idx:0,requestId:'sk-1'}), u1b=await call('/api/skill/upgrade',{key:'vael',idx:0,requestId:'sk-1'});
  const k1=await led();
  ok(u1.data.ok===true&&same(u1.data,u1b.data)&&k1.gold===k0.gold-u1.data.cost,'skill up: pays its gold once for one requestId ('+(u1.data.error||u1.data.cost)+')');
  // --- quest claim
  const q0=await call('/api/quest/state');
  ok(q0.data&&q0.data.ready&&typeof q0.data.ready==='object','quest state sends the ready map');
  const readyId=Object.keys(q0.data.ready).find(k=>q0.data.ready[k]&&!(q0.data.claimed||{})[k]);
  if(readyId){ const c1=await call('/api/quest/claim',{id:readyId,requestId:'qc-1'}), c1b=await call('/api/quest/claim',{id:readyId,requestId:'qc-1'}), c2=await call('/api/quest/claim',{id:readyId,requestId:'qc-2'});
    ok(c1.data.ok===true&&same(c1.data,c1b.data)&&c2.data.ok===false,'quest claim: pays once ('+readyId+'; second request: '+(c2.data.error||'')+')'); }
  const notReady=Object.keys(q0.data.ready).find(k=>!q0.data.ready[k]);
  if(notReady){ const c3=await call('/api/quest/claim',{id:notReady,requestId:'qc-3'}); ok(c3.data.ok===false,'quest claim: a quest that is not ready is refused ('+notReady+')'); }
  // --- rankings
  const lad=await call('/api/arena/ladder?offset=0&limit=5');
  ok(lad.status===200&&Array.isArray(lad.data.entries)&&lad.data.entries.length>0&&typeof lad.data.total==='number','arena ladder answers a page ('+lad.status+')');
  console.log('test_wall_routes.js: '+pass+' checks passed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
