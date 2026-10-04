// 3 Oct 2026 Market audit #1 (v972): the GUILD SHOP's gold / diamond / stamina items are server purchases (/api/shop/buy gshop:N),
// real server on a free port + temp DB. Guild coins and the reward move in one commit; the slot must be unlocked by the player's guild;
// a refill at full stamina moves nothing; a non-member cannot buy; tx/earn 'guildshop' is gone; GUILD_SHOP_SRV == the client catalogue.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gshop-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
async function editDB(fn){ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  const srv=fs.readFileSync(path.join(root,srvFile),'utf8'), html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  if(!process.env.AUD_SERVER){
    const m=srv.match(/const GUILD_SHOP_SRV=(\{[^\n]*\});/); ok(m,'server defines GUILD_SHOP_SRV'); const S=Function('return '+m[1])();
    const block=html.slice(html.indexOf('const GUILD_SHOP=['),html.indexOf('];',html.indexOf('const GUILD_SHOP=[')));
    const items=[...block.matchAll(/\{name:'([^']*)',desc:'([^']*)',cost:(\d+)(?:,server:'([^']*)')?/g)].map(x=>({name:x[1],desc:x[2],cost:+x[3],server:x[4]||''}));
    const gs=items.map((it,i)=>({i,...it})).filter(it=>/^gshop:/.test(it.server));
    ok(gs.length===7&&gs.every(it=>it.server==='gshop:'+it.i&&S[it.i]&&S[it.i].cost===it.cost),'every client gshop item sits at its own slot with the server price ('+gs.map(g=>g.i+':'+g.cost).join(',')+')');
    ok(gs.every(it=>{ const r=S[it.i]; const n=+(it.desc.match(/[\d,]+/)||['0'])[0].replace(/,/g,''); return r.refill?/Refill stamina/.test(it.desc):r.res?(r.res===n&&/map resource/.test(it.desc)):(r.gold?r.gold===n&&/gold/.test(it.desc):r.gems===n&&/diamond/.test(it.desc)); }),'server rewards equal the client descriptions'); }
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'gshop-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  // not in a guild
  await editDB((db,u)=>{ u.led.guildCoins=10000; });
  const n0=await call('/api/shop/buy',{what:'gshop:1',requestId:'gs-noguild'});
  ok(n0.data.ok===false&&/Join a guild/.test(n0.data.error||''),'a player without a guild cannot buy ('+(n0.data.error||JSON.stringify(n0.data).slice(0,80))+')');
  // a level-1 guild
  await editDB((db,u)=>{ db.guilds=db.guilds||{}; db.guilds.gtest={id:'gtest',name:'Test Guild',members:[id],level:1,exp:0}; u.guildId='gtest'; u.led.guildCoins=10000; u.led.gold=0; });
  const a0=await led(); const b1=await call('/api/shop/buy',{what:'gshop:1',requestId:'gs-1'}); const a1=await led();
  ok(b1.data.ok===true&&a1.gold===a0.gold+5000&&a1.guildCoins===a0.guildCoins-300,'Gold Cache: -300 coins, +5,000 gold ('+(b1.data.error||'gold '+a1.gold+' coins '+a1.guildCoins)+')');
  const b1b=await call('/api/shop/buy',{what:'gshop:1',requestId:'gs-1'}); const a1b=await led();
  ok(a1b.gold===a1.gold&&a1b.guildCoins===a1.guildCoins,'the same requestId does not buy twice');
  const b6=await call('/api/shop/buy',{what:'gshop:6',requestId:'gs-6-lv1'}); const a6=await led();
  ok(b6.data.ok===false&&/not unlocked/.test(b6.data.error||'')&&a6.guildCoins===a1.guildCoins,'slot 6 at guild level 1 (4 slots) is refused, no coins taken ('+(b6.data.error||'')+')');
  // refill at full stamina
  await editDB((db,u)=>{ u.led.stam={v:999,t:Date.now()}; });
  const s0=await led(); const r3=await call('/api/shop/buy',{what:'gshop:3',requestId:'gs-3-full'}); const s1=await led();
  ok(r3.data.ok===false&&/already full/.test(r3.data.error||'')&&s1.guildCoins===s0.guildCoins,'a refill at full stamina is refused, no coins taken ('+(r3.data.error||'')+')');
  // a level-3 guild unlocks slot 6
  await editDB((db,u)=>{ db.guilds.gtest.level=3; });
  const c0=await led(); const b6b=await call('/api/shop/buy',{what:'gshop:6',requestId:'gs-6-lv3'}); const c1=await led();
  ok(b6b.data.ok===true&&c1.gold===c0.gold+15000&&c1.guildCoins===c0.guildCoins-700,'slot 6 at guild level 3: -700 coins, +15,000 gold ('+(b6b.data.error||'ok')+')');
  /* v1008 (re-audit Guild #1): the Resource Crate is a server purchase - +100 of each map resource in the Academy store, once per requestId */
  const r0=await led(); const res0=Object.assign({},((disk().users[id].led||{}).acad||{}).res||{});
  const b7=await call('/api/shop/buy',{what:'gshop:7',requestId:'gs-7'}); await call('/api/shop/buy',{what:'gshop:7',requestId:'gs-7'}); const r1=await led(); await delay(300);
  const res1=((disk().users[id].led||{}).acad||{}).res||{};
  ok(b7.data.ok===true&&r1.guildCoins===r0.guildCoins-350&&['iron','crystal','silver','coal'].every(k=>(res1[k]|0)===(res0[k]|0)+100),'Resource Crate: -350 coins once, +100 of each map resource on the server ('+(b7.data.error||JSON.stringify(res1))+')');
  const ea=await call('/api/tx/earn',{what:'gold',amount:50000,reason:'guildshop',requestId:'ea-gs'});
  ok(ea.data.ok===false&&/No earn rule/.test(ea.data.error||''),'tx/earn gold/guildshop is refused ('+(ea.data.error||'')+')');
  console.log('test_guild_shop.js: '+pass+' checks passed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
