// 3 Oct 2026 audit (P0): the Tower of Trials is server-owned. Two layers:
//  A. SOURCE PARITY - the server's floor requirement / floor reward / tribute / tribute day are the v948 client's
//     numbers, floor by floor (the authored rewards did not change).
//  B. LIVE HTTP - a throwaway server: forged 'tower'/'gauntlet' earns refused, migration capped and paying nothing,
//     level gate, ascend/tribute pay once per request and once per floor/day, cross-device rule, failed save -> 503
//     with no grant, restart keeps the floor.
// Must-fail controls: the old earn path (expected refused), a forged legacy floor (expected capped), a replayed
// requestId (expected the same reply, no second grant), a save failure (expected 503, gold unchanged).
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const net=require('net');
const vm=require('vm');
const {spawn}=require('child_process');
const root=path.join(__dirname,'..');
const SERVER=fs.readFileSync(path.join(root,'server.js'),'utf8');
const CLIENT=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };

// ---------- A. source parity ---------- (TOWER_HTTP_ONLY=1 skips it: used to run layer B against an unpatched server as the inverse control)
const HTTP_ONLY=!!process.env.TOWER_HTTP_ONLY;
let sctx={},cctx={};
if(!HTTP_ONLY){
function grab(src,re,what){ const m=src.match(re); assert(m,'could not find '+what); return m[0]; }
sctx={Math,Date,Intl};
vm.createContext(sctx);
vm.runInContext([
  grab(SERVER,/const _etFmt=new Intl\.DateTimeFormat\([\s\S]*?\);/,'_etFmt'),
  grab(SERVER,/function etOffsetMs\(t\)\{[\s\S]*?\n[^\n]*\}/,'etOffsetMs'),
  grab(SERVER,/function nyDayKey\(t\)\{[^\n]*\}/,'nyDayKey'),
  grab(SERVER,/const TOWER_POWER_SCALE=[^;]*;/,'TOWER_POWER_SCALE'),
  grab(SERVER,/function towerReqS\(f\)\{[^\n]*\}/,'towerReqS'),
  grab(SERVER,/function towerFloorPay\(f\)\{[^\n]*\n[^\n]*\}/,'towerFloorPay'),
  grab(SERVER,/function towerTribPay\(floor\)\{[^\n]*\}/,'towerTribPay'),
  grab(SERVER,/function towerDayKey\(\)\{[^\n]*\}/,'towerDayKey'),
  grab(SERVER,/function towerMaxForPower\(pow\)\{[^\n]*\}/,'towerMaxForPower'),
].join('\n'),sctx);
cctx={Math,Date,Intl};
vm.createContext(cctx);
vm.runInContext([
  grab(CLIENT,/const POWER_SCALE=[^;]*;/,'client POWER_SCALE'),
  grab(CLIENT,/function towerReq\(floor\)\{[^\n]*\}/,'client towerReq'),
  grab(CLIENT,/function arenaDayKey\(\)\{[^\n]*\n[^\n]*\}/,'client arenaDayKey'),
].join('\n'),cctx);
// v948 (bbbc3a66) client reward arithmetic, verbatim minus the wallet calls - the GOLDEN numbers.
function goldenFloor(floor){ let gold=Math.round(400*floor*Math.pow(1.08,floor)); if(gold>190000)gold=190000; let gg=gold;
  if(floor%2===0){ const bg=200+floor*25; gg+=bg; } if(gg>200000)gg=200000; const gems=floor%10===0?Math.round(floor*1.5):0; return {gold:gg,gems}; }
function goldenTrib(floor){ const bonus=250*(1+Math.floor(floor/4)); let gold=Math.round(500*floor)+bonus; if(gold>200000)gold=200000; return gold; }
for(let f=1;f<=400;f++){
  const s=sctx.towerFloorPay(f), g=goldenFloor(f);
  assert.strictEqual(JSON.stringify(s),JSON.stringify(g),'floor '+f+' reward differs from v948');
  assert.strictEqual(sctx.towerReqS(f),cctx.towerReq(f),'floor '+f+' requirement differs from the client');
  assert.strictEqual(sctx.towerTribPay(f),goldenTrib(f),'tribute at floor '+f+' differs from v948');
}
pass+=3;
ok(goldenFloor(10).gems===15&&goldenFloor(9).gems===0,'tenth-floor diamonds');
ok(goldenFloor(60).gold===191700&&sctx.towerFloorPay(60).gold===191700,'gold 190,000 base cap + even bonus');
ok(goldenFloor(400).gold===200000&&sctx.towerFloorPay(400).gold===200000,'gold 200,000 total cap');
ok(sctx.towerFloorPay(2).gold===goldenFloor(2).gold&&goldenFloor(2).gold>goldenFloor(1).gold,'even-floor bonus case');
// tribute day: the server key must equal the client's arenaDayKey (New York date at 09:00) at every hour of a year
const realNow=Date.now; try{
  for(let t=Date.UTC(2026,0,1);t<Date.UTC(2027,0,1);t+=3600000){ sctx.Date.now=()=>t; cctx.Date.now=()=>t;
    const a=vm.runInContext('towerDayKey()',sctx), b=vm.runInContext('arenaDayKey()',cctx);
    assert.strictEqual(a,b,'tribute day differs at '+new Date(t).toISOString()); }
} finally { sctx.Date.now=realNow; cctx.Date.now=realNow; }
pass++;
// control: the parity check must FAIL on a wrong formula (proves the comparison bites)
let bit=false; try{ assert.deepStrictEqual({gold:goldenFloor(7).gold+1,gems:0},goldenFloor(7)); }catch(e){ bit=true; } ok(bit,'parity control bites');

}
// ---------- B. live HTTP ----------
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tower-'));
const dbFile=path.join(temp,'db.json');
let port,base,child,token='';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DB_FILE:dbFile,DATABASE_URL:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ if(child.exitCode!==null)throw new Error('throwaway server exited'); try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw new Error('server did not start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<40&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,method='GET',data){ const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined}); return {status:r.status,data:await r.json().catch(()=>({}))}; }
const post=(r,d)=>call(r,'POST',d);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const guest=await post('/api/guest',{deviceId:'tower-qa-'+Date.now()}); assert.strictEqual(guest.status,200); token=guest.data.token; const id=guest.data.profile.id;
  // must-fail control: the old client-decided earn is refused for both retired reasons
  for(const [what,reason,amount] of [['gold','tower',200000],['gems','tower',500],['gold','gauntlet',200000],['gems','gauntlet',500]]){
    const r=await post('/api/tx/earn',{what,amount,reason,requestId:'forge-'+what+reason});
    ok(r.data.ok!==true&&/No earn rule/.test(r.data.error||''),'forged '+what+'/'+reason+' earn refused'); }
  ok((await post('/api/tower/ascend',{requestId:'a0'})).data.error==='Open the Tower of Trials first.','ascend refused before state');
  ok((await post('/api/tower/ascend',{})).status===400,'ascend without requestId refused');
  // low level: the gate
  await post('/api/tower/state',{legacyFloor:0});
  ok(/level 40/.test((await post('/api/tower/ascend',{requestId:'lv'})).data.error||''),'level-40 gate');
  await delay(400); await stop();
  let db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const u=db.users[id];
  u.led.px=99000000; const keys=Object.keys(require('../server/sim.js').HERO_BASE).slice(0,5);
  for(const k of keys) u.led.unlocked[k]=true; u.team=keys.map(k=>({key:k})); u.led.tower={floor:0,trib:'',mig:0,srv:0};
  fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  // migration: a forged huge local floor is capped by power and pays nothing
  const gold0=(await call('/api/ledger')).data; const g0=(gold0.ledger||gold0).gold;
  const st=await post('/api/tower/state',{legacyFloor:4999});
  const capF=sctx.towerMaxForPower(st.data.power);
  ok(st.data.floor===capF&&capF<4999,'forged legacy floor capped at the power floor ('+capF+')');
  ok(st.data.nextReq===cctx.towerReq(capF+1),'next requirement = client towerReq');
  const after=(await call('/api/ledger')).data; ok((after.ledger||after).gold===g0,'migration paid nothing');
  // cross-device: a lower report never lowers it
  ok((await post('/api/tower/state',{legacyFloor:0})).data.floor===capF,'lower device report does not lower the floor');
  // at the power wall: refused with the client's requirement
  const wall=await post('/api/tower/ascend',{requestId:'w1'});
  ok(wall.data.wall===true&&wall.data.req===cctx.towerReq(capF+1),'wall refusal carries the client requirement');
  // drop the floor so ascends are affordable, then climb with exact authored pay
  await delay(400); await stop(); db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.users[id].led.tower={floor:0,trib:'',mig:1,srv:0}; fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  const climb=Math.min(capF,12); let gPrev=null;
  for(let f=1;f<=climb;f++){ const r=await post('/api/tower/ascend',{requestId:'tower:floor:'+f});
    ok(r.data.ok===true&&r.data.floor===f,'ascend to floor '+f);
    assert.deepStrictEqual({gold:r.data.gold,gems:r.data.gems},goldenFloor(f),'floor '+f+' pay = v948'); pass++;
    if(f===1){ const again=await post('/api/tower/ascend',{requestId:'tower:floor:1'}); ok(again.data.floor===1&&again.data.ok===true,'replayed requestId returns the same reply');
      const lg=(await call('/api/ledger')).data; gPrev=(lg.ledger||lg).gold; ok(gPrev===g0+goldenFloor(1).gold,'replay paid once'); } }
  // after a server climb, a device report cannot raise the floor
  ok((await post('/api/tower/state',{legacyFloor:4999})).data.floor===climb,'device report ignored after a server climb');
  // tribute: once per day, retry pays once
  const t1=await post('/api/tower/tribute',{requestId:'tower:tribute:x'}); ok(t1.data.ok===true&&t1.data.gold===goldenTrib(climb),'tribute = v948 amount');
  const t1b=await post('/api/tower/tribute',{requestId:'tower:tribute:x'}); ok(t1b.data.gold===t1.data.gold,'tribute replay same reply');
  const t2=await post('/api/tower/tribute',{requestId:'tower:tribute:y'}); ok(t2.data.already===true,'second tribute same day refused');
  // restart keeps everything
  await delay(400); await stop(); await start();
  const s2=await post('/api/tower/state',{}); ok(s2.data.floor===climb&&s2.data.trib===s2.data.today,'restart keeps floor and tribute');
  // failed save -> 503, nothing granted (control)
  // put the floor one below the top so a real (affordable) climb is attempted while the disk refuses the write
  await delay(400); await stop(); db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.users[id].led.tower.floor=climb-1; fs.writeFileSync(dbFile,JSON.stringify(db));
  fs.chmodSync(dbFile,0o444); let fail,gA,lgB,s3;
  try{ await start(); const lgA=(await call('/api/ledger')).data; gA=(lgA.ledger||lgA).gold;
    fail=await post('/api/tower/ascend',{requestId:'fail-leg-'+climb});
    lgB=(await call('/api/ledger')).data; s3=await post('/api/tower/state',{}); } finally { fs.chmodSync(dbFile,0o666); }
  ok(fail.status===503&&fail.data.storageFailed===true,'save failure -> 503 (got '+fail.status+' '+JSON.stringify(fail.data).slice(0,80)+')');
  ok((lgB.ledger||lgB).gold===gA,'no grant after 503');
  ok(s3.data.floor===climb-1,'floor unchanged after a failed save');
  // and the same request succeeds once the disk works again (retry with the same id)
  const retry=await post('/api/tower/ascend',{requestId:'fail-leg-'+climb}); ok(retry.data.ok===true&&retry.data.floor===climb,'retry after the disk recovers pays once');
  console.log('test_tower_server.js: '+pass+' checks passed');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
