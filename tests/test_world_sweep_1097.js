// v1097 - sweep 9 Oct (real server on a free port + temp DB):
//  #11 a protection shield raised while an enemy march travels stops it ON ARRIVAL: no fight, no loot, both sides get a war mail line;
//  #12 Defend and Scout reach the server:
//      - Scout (POST /api/world/scout) reveals the castle's standing defenders and power, is free, and is rate limited;
//      - Defend (POST /api/world/city/defend) is for guild allies only; the stationed squad fills the empty places on the ally's wall
//        when an attack lands, its owner gets a war mail line, it is never an attack march, and it can be recalled.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-wd1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:dbFile,NODE_ENV:'test',SIM_WORKERS:'0',
    WORLD_WAR_TEST_MS:'100',WORLD_CITY_TEST_MS:'400',SERVER_SECRET:'wd1097',REG_PER_MIN:'1000',REG_ACCOUNTS_PER_IP:'1000'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,who){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':who.tok,'x-forwarded-for':who.ip},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(500); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const until=async t=>{ const w=(t||0)-Date.now(); if(w>0) await delay(w+150); };
const reports=async who=>((await call('/api/pvp/reports',null,who)).data.reports||[]);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const mk=async(n,ip)=>{ const g=await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':ip},body:JSON.stringify({deviceId:'wd1097-'+n+'-'+Date.now()})}).then(r=>r.json());
    const who={id:g.profile.id,tok:g.token,ip}; await call('/api/ledger',null,who); return who; };
  const A=await mk('a','10.97.0.1'), B=await mk('b','10.97.0.2'), C=await mk('c','10.97.0.3'), X=await mk('x','10.97.0.4');   // A attacks B; C is B's guildmate; X is not
  const keys=['vael','sylthaine','vireo'], old=Date.now()-10*86400000;
  await editDB(db=>{ for(const w of [A,B,C,X]){ const u=db.users[w.id]; u.created=old; u.led.px=9000000; u.led.gems=5000;
      for(const k of keys){ u.led.unlocked[k]=true; u.led.hero[k]=u.led.hero[k]||{xp:0,stars:1,pips:0,ref:0}; u.led.hero[k].xp=200000; } u.wall=keys.map(k=>({key:k})); }
    db.users[B.id].wall=[{key:'vael'}]; db.users[B.id].shields=1;   // B's wall: one hero, so allies have room
    db.users[B.id].guildId='g1097'; db.users[C.id].guildId='g1097';
    db.guilds=db.guilds||{}; db.guilds.g1097={id:'g1097',name:'Wardens',leader:B.id,members:[B.id,C.id],level:1,exp:0}; });
  for(const w of [A,B,C,X]) await call('/api/world/state',null,w);
  // ---- #11 shield raised while the march travels
  const war=await call('/api/world/war/declare',{defId:B.id,requestId:'wd-war'},A); await until(war.data.readyAt);
  const m1=await call('/api/world/city/start',{defId:B.id,heroIds:keys,requestId:'wd-m1'},A);
  ok(m1.data.ok===true,'the march on B starts while B is unshielded ('+(m1.data.error||'ok')+')');
  const sh=await call('/api/world/shield',{requestId:'wd-sh'},B);
  ok(sh.data.ok===true,'B raises a shield while the army travels ('+(sh.data.error||'ok')+')');
  await until(m1.data.arriveAt);
  const g0=(await call('/api/ledger',null,A)).data; const gold0=(g0.ledger||g0).gold;
  const a1=await call('/api/pvp/attack',{defId:B.id,marchId:m1.data.marchId,requestId:'wd-a1'},A);
  const g1=(await call('/api/ledger',null,A)).data; const gold1=(g1.ledger||g1).gold;
  ok(a1.data.ok===true&&a1.data.shielded===true&&a1.data.won===false&&!a1.data.replay&&gold1===gold0,'the arrival meets the shield: no fight, no loot ('+JSON.stringify(a1.data).slice(0,140)+')');
  ok((disk().users[A.id].pvpDay||{}).n|0?false:true,'no city attack was counted for A');
  const ra=await reports(A), rb=await reports(B);
  ok(ra.some(r=>r.kind==='attack-report'&&r.shielded&&r.marchId===m1.data.marchId),'A gets a war mail line: the army came home');
  ok(rb.some(r=>r.kind==='shield-blocked'&&r.from&&r.marchId===m1.data.marchId),'B gets a war mail line: the shield turned the army away');
  await editDB(db=>{ db.users[B.id].shieldUntil=0; });   // the shield ends for the next fights
  // ---- #12 scout
  const s1=await call('/api/world/scout',{defId:B.id,requestId:'wd-s1'},A);
  ok(s1.data.ok===true&&Array.isArray(s1.data.team)&&s1.data.team.length===1&&s1.data.team[0].key==='vael'&&s1.data.team[0].level>1&&(s1.data.power|0)>0,
    'Scout reveals B\'s standing defenders and power ('+JSON.stringify(s1.data).slice(0,160)+')');
  let limited=null; for(let i=2;i<=12&&!limited;i++){ const r=await call('/api/world/scout',{defId:B.id,requestId:'wd-s'+i},A); if(r.status===429) limited=i; }
  ok(limited===11,'Scout is rate limited (10 a minute; the 11th is refused: '+limited+')');
  // ---- #12 defend
  const xd=await call('/api/world/city/defend',{defId:B.id,heroIds:['sylthaine'],requestId:'wd-xd'},X);
  ok(xd.data.ok===false&&/guild ally/.test(xd.data.error||''),'a player outside B\'s guild cannot defend B ('+(xd.data.error||'')+')');
  const cd=await call('/api/world/city/defend',{defId:B.id,heroIds:['sylthaine','vireo'],requestId:'wd-cd'},C);
  ok(cd.data.ok===true&&cd.data.arriveAt>cd.data.depart&&cd.data.homeAt>Date.now()+86400000*365,'C (B\'s guildmate) sends two heroes to defend B, stationed until recalled ('+(cd.data.error||'ok')+')');
  await until(cd.data.arriveAt);
  const wm=(await call('/api/world/marches',null,C)).data.marches||[];
  const row=wm.find(m=>m.id===cd.data.marchId);
  ok(row&&row.defend===true&&row.phase==='stationed'&&row.resultPending===false,'the server shows the defend march as stationed, with no pending result ('+JSON.stringify(row||{}).slice(0,120)+')');
  const misuse=await call('/api/pvp/attack',{defId:B.id,marchId:cd.data.marchId,requestId:'wd-misuse'},C);
  ok(misuse.data.ok===false,'a defend march can never be settled as an attack ('+(misuse.data.error||'')+')');
  const s2=await call('/api/world/scout',{defId:B.id,requestId:'wd-s2b'},X);
  ok(s2.data.ok===true&&s2.data.allyDefenders===1,'a scout sees one stationed ally squad');
  await until(m1.data.homeAt);
  const m2=await call('/api/world/city/start',{defId:B.id,heroIds:keys,requestId:'wd-m2'},A);
  ok(m2.data.ok===true,'A marches on B again ('+(m2.data.error||'ok')+')');
  await until(m2.data.arriveAt);
  const a2=await call('/api/pvp/attack',{defId:B.id,marchId:m2.data.marchId,requestId:'wd-a2'},A);
  ok(a2.data.ok===true&&a2.data.allyDefenders===2&&a2.data.replay&&a2.data.replay.foe.length===3,'the attack meets B\'s wall hero plus C\'s two stationed heroes ('+JSON.stringify({ok:a2.data.ok,ally:a2.data.allyDefenders,foe:a2.data.replay&&a2.data.replay.foe.length,err:a2.data.error})+')');
  const rc=await reports(C);
  ok(rc.some(r=>r.kind==='defend-report'&&r.to&&r.marchId===m2.data.marchId),'C gets a war mail line about the fight');
  const rec=await call('/api/world/city/recall',{marchId:cd.data.marchId,requestId:'wd-rc'},C);
  ok(rec.data.ok===true&&rec.data.homeAt>Date.now()&&rec.data.homeAt<Date.now()+60000,'C recalls the stationed squad; it makes the trip home ('+(rec.data.error||'ok')+')');
  const s3=await call('/api/world/scout',{defId:B.id,requestId:'wd-s3'},X);
  ok(s3.data.ok===true&&s3.data.allyDefenders===0,'after the recall no ally squad stands on B\'s wall');
  // static: the client sends them
  if(!process.env.AUD_SERVER){
    const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
    ok(/marchStartPost\('\/api\/world\/city\/defend'/.test(html),'the map\'s Defend posts /api/world/city/defend');
    ok(/api\('\/api\/world\/scout','POST',\{defId:m\.tId,requestId:m\.scoutRid\}\)/.test(html),'the map\'s Scout report comes from /api/world/scout');
    ok(/if\(r\.shielded\)\{ if\(!hasWarMail\(m\.serverCityId\)\)/.test(html)&&/r\.kind==='shield-blocked'/.test(html)&&/r\.kind==='defend-report'/.test(html),'the client mails the shield and defend outcomes');
  }
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_world_sweep_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.stack||e); process.exitCode=1; } finally { await stop(); } })();
