// v1092 - EGP / EDP, the patron ladder (blueprint 25; Open Projects/EGP and EDP - Patron system), phases 1-2:
// paid base diamonds (6 per dollar) raise EGP (ladder 1 ... 30,000 = the reference dollar ladder, Phil 9 Oct); the rebate is paid at the level held before the purchase; daily attack chances
// 15 + 1 per 3 EGP levels; 10 attacks for 400 diamonds; prestige into EDP at EGP 15 (the excess carries).
// Live: real /api/shop/purchase calls with the 'test' provider (SHOP_TEST_PURCHASES=1).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-pat1092-'));
const dbFile=path.join(dir,'db.json'), src=fs.readFileSync(path.join(root,srvFile),'utf8');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,SHOP_TEST_PURCHASES:'1',RL_MUL:'1000'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
let n=0; const buy=offerId=>call('/api/shop/purchase',{offerId,provider:'test',receipt:'t',requestId:'pp'+(n++)});
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'pat1092-'+Date.now()}); token=g.data.token; id=g.data.profile.id;
  let L=await led(); const p0=L.patron||{};
  ok(p0.egp===0&&p0.attacks&&p0.attacks.free===15&&p0.attacks.cap===15,'a new account is EGP 0 with 15 daily attacks ('+JSON.stringify(p0.attacks||null)+')');
  const gems0=L.gems;
  const b1=await buy('d500'); L=await led();   // $4.99 -> 30 base
  ok(b1.status===200&&L.patron.base===30&&L.patron.egp===2,'a $4.99 pack gives 30 base diamonds = EGP 2 (Phil 9 Oct ladder: 6 / 36) (base '+(L.patron&&L.patron.base)+', EGP '+(L.patron&&L.patron.egp)+')');
  ok(L.gems===gems0+500,'no rebate at EGP 0 (gems +'+(L.gems-gems0)+')');
  const gems1=L.gems; await buy('d6000'); L=await led();   // $50 -> 300 base; rebate at EGP 2 = 7 % of 300 = 21
  ok(L.patron.base===330&&L.patron.egp===5,'a $50 pack adds 300 base -> 330 = EGP 5 (EGP '+L.patron.egp+')');
  ok(L.gems===gems1+6000+21,'the rebate is paid at the level held before the buy: 7 % of 300 base = 21 (gems +'+(L.gems-gems1)+')');
  ok(L.patron.attacks.free===16&&L.patron.rebatePct===20,'EGP 5: 16 daily attacks, 20 % rebate');
  const ba=await call('/api/patron/buy-attacks',{requestId:'ba1'}); L=await led();
  ok(ba.data.ok===true&&L.patron.attacks.cap===26&&L.patron.attacks.bought===10,'10 attacks for 400 diamonds raise today\'s cap to 26 ('+L.patron.attacks.cap+')');
  // phase 3 rows: nobody below today's numbers; EGP 3 still at today's
  ok(JSON.stringify(L.patron.rows)===JSON.stringify({meals:6,goldBuys:8,eliteResets:4,arenaResets:3,vaultExtraSweeps:0,marches:3,marchSpeed:0,shadyOff:0,doubleGold:false,attackBuys:2}),'EGP 5 rows = Phil\'s chart (v1093 standard) ('+JSON.stringify(L.patron.rows)+')');
  ok(L.shop&&L.shop.foodMax===6&&L.shop.goldMax===8,'the shop view publishes the daily meal and gold limits (EGP 5: 6 / 8)');
  const pr0=await call('/api/patron/prestige',{requestId:'pr0'});
  ok(pr0.data.ok===false&&/EGP 15/.test(pr0.data.error||''),'prestige is refused below EGP 15');
  // EGP 15 by data, then prestige
  await editDB(u=>{ u.led.patron.base=30100; });
  L=await led(); ok(L.patron.egp===15&&L.patron.attacks.free===20&&L.patron.canPrestige===true,'EGP 15: 20 daily attacks, prestige offered');
  ok(JSON.stringify(L.patron.rows)===JSON.stringify({meals:12,goldBuys:12,eliteResets:8,arenaResets:7,vaultExtraSweeps:5,marches:5,marchSpeed:0,shadyOff:30,doubleGold:true,attackBuys:5}),'EGP 15 rows = Phil\'s chart: 12 / 12 purchases (cap), 8 Elite, 7 Arena resets, +5 Vault, 5 armies, 30 % Shady ('+JSON.stringify(L.patron.rows)+')');
  { await editDB(u=>{ u.led.gems=50000; u.led.shop={day:'',food:0,gold:0}; u.led.stamina={v:0,t:Date.now()}; });
    let okN=0, last=null; for(let i=0;i<12;i++){ const r=await call('/api/shop/buy',{what:'gold',requestId:'gb'+i}); last=r.data; if(r.data.ok) okN++; }
    ok(okN===12,'at EGP 15 a 9th-12th gold buy goes through (today everyone stops at 8): '+okN+' of 12 ('+(last&&last.error||'ok')+')'); }
  const pr=await call('/api/patron/prestige',{requestId:'pr1'}); L=await led();
  ok(pr.data.ok===true&&L.patron.prestiged===true&&L.patron.edpBase===100&&L.patron.egp===15&&L.patron.edp===0,'prestige: EDP 0 with the 100 over EGP 15 carried; EGP 15 kept');
  const gems2=L.gems; await buy('d6000'); L=await led();
  ok(L.patron.edpBase===400&&L.patron.base===30100&&L.gems===gems2+6000+360,'after the prestige a purchase counts toward EDP, rebate 120 % of 300 = 360 (gems +'+(L.gems-gems2)+')');
  const pr2=await call('/api/patron/prestige',{requestId:'pr2'}); ok(pr2.data.ok===false,'prestige once only');
  // the cap sites use the patron number
  ok(/if\(me\.pvpDay\.n>=attackCap\(me\)\)/.test(src)&&/if\(done\+open>=attackCap\(me\)\)/.test(src)&&/attacksLeft:Math\.max\(0,attackCap\(me\)-me\.pvpDay\.n\)/.test(src),'every city-attack limit reads the patron cap (no flat 20 left)');
  ok(!/pvpDay\.n>=20|done\+open>=20|attacksLeft:20-/.test(src),'CONTROL: the old flat 20 is gone');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_patron_1092.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
