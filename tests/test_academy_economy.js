// Phil 3 Oct 2026 - Academy level economy + Witches Hut upgrade. Unit: the client's copy of the cost table and income equals
// server/academy-economy.js; an Academy level N earns its next upgrade's cost over 24 + 2(N-1) h and never less than N-1; the
// Academy level costs all four resources, equal, client = server. HTTP (real server, free port, temp DB): Academy income is paid
// in whole units from the saved clock (never back-paid on first touch), Academy research is allowed past 60 and refused at 120;
// /api/witch/upgrade costs half the Academy upgrade of each resource + 75% of the current brew, refuses short resources, the
// player-level cap and a stale panel, and pays once per requestId. Asserts, raw pairs saved. Control: AE_SERVER=<previous server.js>
// in the repo root must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),vm=require('vm'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AE_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-acad-econ-'));
const dbFile=path.join(dir,'db.json'), pairsFile=path.join(dir,'pairs.jsonl'), srvSrc=fs.readFileSync(path.join(root,srvFile),'utf8');
const sha=crypto.createHash('sha256').update(srvSrc).digest('hex');
const E=require(path.join(root,'server/academy-economy.js'));
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const scrub=o=>JSON.parse(JSON.stringify(o||null,(k,v)=>/token|pass/i.test(k)?'[x]':v));
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} fs.appendFileSync(pairsFile,JSON.stringify({route,req:scrub(data),status:r.status,res:scrub(j)})+'\n'); return {status:r.status,data:j}; }
const editDB=async f=>{ await delay(400); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); f(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); };
const readDB=async()=>{ await delay(400); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); await start(); return db; };
const R=['iron','crystal','silver','coal'], each=(o,n)=>R.every(r=>(o[r]|0)===n);
(async()=>{ try{
  // ---- unit: client copy = server module, Phil's income rule ----
  const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  const line=sig=>{ const i=html.indexOf(sig); assert(i>=0,'client has '+sig); return html.slice(i,html.indexOf('\n',i)); };
  const ctx=vm.createContext({}); for(const sig of ['const ACADEMY_MAX=','const ACAD_RATE=','function acadRatePerHour(','function learnResCost(']) vm.runInContext(line(sig),ctx);
  ok(vm.runInContext('ACADEMY_MAX',ctx)===E.MAX_LEVEL&&E.MAX_LEVEL===120,'Academy max level 120 on both sides');
  ok(JSON.stringify(vm.runInContext('ACAD_COST',ctx))===JSON.stringify(E.COST),'client cost table = server cost table');
  for(let n=0;n<=120;n++) ok(Math.abs(vm.runInContext('acadRatePerHour('+n+')',ctx)-E.ratePerHour(n))<1e-9,'income rate L'+n+' client = server');
  for(let n=1;n<=120;n++) ok(E.ratePerHour(n)>=E.ratePerHour(n-1),'income never goes down (L'+n+')');
  ok(Math.abs(E.ratePerHour(1)*24-E.levelCost(2))<1e-6&&Math.abs(E.ratePerHour(2)*26-E.levelCost(3))<1e-6,'Phil: L1 earns the L2 cost in 24 h, L2 the L3 cost in 26 h');
  const sctx=vm.createContext({ACADEMY_ECON:E}); { const i=srvSrc.indexOf('function learnResCostSrv('); assert(i>=0,'server has learnResCostSrv'); vm.runInContext(srvSrc.slice(i,srvSrc.indexOf('\nconst ACADEMY_CUTOFF',i)),sctx); }
  for(const lv of [0,9,59,60,118,119]){ const c=vm.runInContext('learnResCost("academy",'+lv+')',ctx), s=vm.runInContext('learnResCostSrv("academy",'+lv+')',sctx);
    ok(each(c,E.COST[lv])&&JSON.stringify(c)===JSON.stringify(s),'Academy L'+lv+'->'+(lv+1)+' costs '+E.COST[lv]+' of all four, client = server'); }
  ok(E.hutUpgradeCost(21)===Math.ceil(E.levelCost(21)/2),'Hut upgrade = half the Academy upgrade at the same level');
  // ---- HTTP ----
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'acad-econ-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const HOURS=10, lv=10;
  await editDB(db=>{ const u=db.users[id]; u.led.px=20000; u.led.acad={lv:{academy:lv,atk:0,hp:0,ap:0,def:0,armor:0,mr:0,crit:0,critres:0},learn:{},res:{iron:0,crystal:0,silver:0,coal:0},mineDay:null,incAt:Date.now()-HOURS*3600000}; });
  const a1=await call('/api/academy'); const want=Math.floor(E.ratePerHour(lv)*HOURS);
  ok(a1.status===200&&R.every(r=>a1.data.res[r]>=want&&a1.data.res[r]<=want+1),'Academy L'+lv+' pays '+want+' of each for '+HOURS+' h ('+JSON.stringify(a1.data.res)+')');
  ok(Math.abs(a1.data.incomePerHour-E.ratePerHour(lv))<1e-9&&a1.data.academyMax===120,'GET /api/academy reports the income rate and max');
  const a2=await call('/api/academy'); ok(JSON.stringify(a2.data.res)===JSON.stringify(a1.data.res),'a second read straight after pays nothing more');
  await editDB(db=>{ const A=db.users[id].led.acad; delete A.incAt; A.res={iron:0,crystal:0,silver:0,coal:0}; });
  const a3=await call('/api/academy'); ok(each(a3.data.res,0),'first touch with no saved clock starts the clock - no back-pay ('+JSON.stringify(a3.data.res)+')');
  // research past 60, refused at 120
  await editDB(db=>{ const A=db.users[id].led.acad; A.lv.academy=60; A.incAt=Date.now(); A.res={iron:1e7,crystal:1e7,silver:1e7,coal:1e7}; db.users[id].led.gold=1e7; });
  const r60=await call('/api/academy/research',{track:'academy',requestId:'ae-r60'});
  ok(r60.data.ok===true&&each({iron:1e7-r60.data.res.iron,crystal:1e7-r60.data.res.crystal,silver:1e7-r60.data.res.silver,coal:1e7-r60.data.res.coal},E.levelCost(61)),'Academy 60 -> 61 is allowed and takes '+E.levelCost(61)+' of all four ('+JSON.stringify(r60.data.res||r60.data)+')');
  await editDB(db=>{ const A=db.users[id].led.acad; A.lv.academy=120; A.learn={}; });
  const r120=await call('/api/academy/research',{track:'academy',requestId:'ae-r120'}); ok(r120.data.ok===false&&/Fully researched/.test(r120.data.error),'Academy 120 is the top');
  // ---- Witches Hut upgrade ----
  const st=await call('/api/witch/state'); const P=st.data.playerLevel;
  ok(st.data.locked===false&&P>21&&P<100,'fixture player level '+P+' sits between the Hut floor and its top');
  const cost21=E.hutUpgradeCost(21), BREW=1000;
  await editDB(db=>{ const u=db.users[id]; u.led.acad.lv.academy=0; u.led.acad.res={iron:cost21+7,crystal:cost21+7,silver:cost21+7,coal:cost21+7}; u.witch.level=20; u.witch.brew=BREW; u.witch.tickAt=Date.now(); });
  const v=await call('/api/witch/state'); ok(v.data.upgrade&&v.data.upgrade.level===21&&each(v.data.upgrade.cost,cost21)&&v.data.upgrade.affordable===true&&v.data.upgrade.brewFraction===0.75,'the Hut shows Lv 21 for '+cost21+' of each + 75% brew');
  const stale=await call('/api/witch/upgrade',{requestId:'ae-stale',level:22}); ok(stale.status===400&&/changed/.test(stale.data.error),'a stale panel (level 22) buys nothing');
  const u1=await call('/api/witch/upgrade',{requestId:'ae-up1',level:21});
  ok(u1.status===200&&u1.data.ok===true&&u1.data.witch.level===21,'upgrade to Lv 21 succeeds');
  ok(each(u1.data.witch.res,7),'it took '+cost21+' of each resource ('+JSON.stringify(u1.data.witch.res)+')');
  ok(Math.abs(u1.data.result.brewSpent-BREW*0.75)<2&&u1.data.witch.brew<BREW*0.25+50,'it took 75% of the brew ('+Math.round(u1.data.result.brewSpent)+' of '+BREW+')');
  const u1b=await call('/api/witch/upgrade',{requestId:'ae-up1',level:21}); ok(u1b.data.witch&&u1b.data.witch.level===21,'the same requestId replays the answer and pays nothing twice');
  let db=await readDB(); ok(db.users[id].witch.level===21&&each(db.users[id].led.acad.res,7),'saved: Hut Lv 21 and the resources spent once');
  const poor=await call('/api/witch/upgrade',{requestId:'ae-up2',level:22}); ok(poor.status===400&&/Not enough Emberite/.test(poor.data.error),'short of resources: refused with the in-game name');
  await editDB(db=>{ const u=db.users[id]; u.witch.level=P; u.led.acad.res={iron:1e7,crystal:1e7,silver:1e7,coal:1e7}; });
  const cap=await call('/api/witch/upgrade',{requestId:'ae-up3',level:P+1}); ok(cap.status===400&&new RegExp('player level '+(P+1)).test(cap.data.error),'the Hut cannot pass the player level ('+cap.data.error+')');
  console.log('test_academy_economy.js: '+pass+' checks passed (server '+srvFile+' sha256 '+sha.slice(0,16)+', pairs '+pairsFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
