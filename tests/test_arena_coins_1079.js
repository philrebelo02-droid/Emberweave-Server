// v1079 - exploit scan 9 Oct #2 (real server on a free port + temp DB): arena coins are the SERVER's.
//  - /api/tx/earn no longer pays 'arenashop' gold/gems/stamina or 'arena' Grosk fragments (it paid them for nothing - the coins lived in the client save);
//  - /api/arena/shop spends the server's arena coins and grants the goods in one write; refuses without coins; daily item limits;
//  - the Shady Market pack (600 diamonds -> 3,000 coins) and the Guild Shop packs (slots 4 and 10) credit the server's coins;
//  - the ledger view carries arenaCoins so the client shows the server's number.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ac1079-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'ac1079-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>{ u.coins=0; u.led.gems=5000; u.led.guildCoins=5000; u.led.px=900000;
    db.guilds=db.guilds||{}; db.guilds.gac={id:'gac',name:'AC Guild',members:[id],level:5,exp:0}; u.guildId='gac'; });
  const L0=await led();
  // the free earn doors are shut
  const e1=await call('/api/tx/earn',{what:'gems',reason:'arenashop',amount:40,requestId:'ac-e1'});
  const e2=await call('/api/tx/earn',{what:'frag',reason:'arena',heroKey:'grosk',amount:10,requestId:'ac-e2'});
  const e3=await call('/api/tx/earn',{what:'gold',reason:'arenashop',amount:5000,requestId:'ac-e3'});
  const L1=await led();
  ok(e1.data.ok===false&&e2.data.ok===false&&e3.data.ok===false&&L1.gems===L0.gems&&L1.gold===L0.gold,'/api/tx/earn pays nothing for arenashop/arena ('+[e1.data.error,e2.data.error,e3.data.error].join(' | ')+')');
  ok(L1.arenaCoins===0,'the ledger view carries the server arena coins ('+L1.arenaCoins+')');
  // the arena shop needs real coins
  const s0=await call('/api/arena/shop',{item:'gems1',requestId:'ac-s0'});
  ok(s0.data.ok===false&&/Not enough arena coins/.test(s0.data.error||''),'the arena shop refuses without coins ('+(s0.data.error||JSON.stringify(s0.data).slice(0,80))+')');
  // the Shady pack credits the server: 600 diamonds -> 3,000 coins
  const sh=await call('/api/shop/buy',{what:'arenacoins',requestId:'ac-sh'});
  const L2=await led();
  ok(sh.data.ok===true&&L2.arenaCoins===3000&&L2.gems===L1.gems-600,'the Shady arena pack takes 600 diamonds and credits 3,000 server coins ('+(sh.data.error||L2.arenaCoins)+')');
  // the Guild Shop packs credit the server: slot 4 (500 guild coins -> 2,000)
  const gs=await call('/api/shop/buy',{what:'gshop:4',requestId:'ac-gs'});
  const L3=await led();
  ok(gs.data.ok===true&&L3.arenaCoins===5000&&L3.guildCoins===L2.guildCoins-500,'the Guild Shop arena pack credits the server coins ('+(gs.data.error||L3.arenaCoins)+')');
  // a purchase spends them
  const s1=await call('/api/arena/shop',{item:'gems1',requestId:'ac-s1'});
  const L4=await led();
  ok(s1.data.ok===true&&L4.gems===L3.gems+40&&L4.arenaCoins===4700,'Diamond Pouch: +40 diamonds, -300 arena coins ('+(s1.data.error||L4.arenaCoins)+')');
  const again=await call('/api/arena/shop',{item:'gems1',requestId:'ac-s1'});
  const L5=await led();
  ok(again.data.ok===true&&L5.gems===L4.gems&&L5.arenaCoins===4700,'the same requestId does not buy twice');
  const s2=await call('/api/arena/shop',{item:'groskfrag',requestId:'ac-s2'});
  const L6=await led();
  ok(s2.data.ok===true&&((L6.frags||{}).grosk|0)===((L5.frags||{}).grosk|0)+5&&L6.arenaCoins===4200,'Grosk Fragments x5 for 500 coins ('+(s2.data.error||'')+')');
  const bad=await call('/api/arena/shop',{item:'__proto__',requestId:'ac-bad'});
  ok(bad.data.ok===false||bad.status>=400,'an unknown item is refused');
  // daily limit
  await editDB((db,u)=>{ u.coins=100000; u.arenaShopDay=Object.assign({},u.arenaShopDay||{},{gems1:20}); });
  const lim=await call('/api/arena/shop',{item:'gems1',requestId:'ac-lim'});
  ok(lim.data.ok===false&&/sold out/.test(lim.data.error||''),'the daily item limit holds ('+(lim.data.error||'')+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_arena_coins_1079.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
