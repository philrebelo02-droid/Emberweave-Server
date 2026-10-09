// v1097 - sweep 9 Oct (real server on a free port + temp DB, plus static client checks):
//  #19 the Market sells only the server's offers of the hour: /api/market/offers lists three (2 gold, 1 diamonds; 550 / 30 per fragment), stable
//      for the hour and across a restart; a hero that is not on offer is refused with nothing spent; an offer sells once;
//  #7  /api/hero/summon-table serves the summon cost and stars /api/hero/summon uses (Brannus: 80 fragments, 3 stars), and the client reads it;
//  #14 (static) the client claims the hourly bonus-stage fragments (/api/bonus/claim) from the result card and the bonus picker;
//  #8  (static) "Wish Again x10" after a Mythical x10 repeats the Mythical pool.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-sh1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'sh1097-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(u=>{ u.led.px=113200; u.led.gold=1000000; u.led.gems=10000; });
  const NOT_SOLD=['konwu','grosk','vulmar','aureth','hurne','hollow'], HB=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE);
  // ---- #19 market offers
  const o1=(await call('/api/market/offers')).data;
  const offers=Array.isArray(o1.offers)?o1.offers:[];
  ok(offers.length===3&&offers.map(o=>o.pay).join()==='gold,gold,gems'&&offers.every(o=>o.qty>=2&&o.qty<=4&&o.price===(o.pay==='gems'?30:550)*o.qty&&HB.includes(o.hero)&&!NOT_SOLD.includes(o.hero)),
    'the server lists this hour\'s three fragment offers at the Market\'s prices ('+JSON.stringify(offers).slice(0,200)+')');
  const o2=(await call('/api/market/offers')).data; await editDB(()=>{}); const o3=(await call('/api/market/offers')).data;
  ok(JSON.stringify(o2.offers)===JSON.stringify(offers)&&JSON.stringify(o3.offers)===JSON.stringify(offers),'the offers stay the same for the hour, across a restart');
  const off=HB.find(k=>!NOT_SOLD.includes(k)&&!offers.some(o=>o.hero===k));
  const l0=await led();
  const bad=await call('/api/market/frag',{heroKey:off,qty:1,pay:'gold',requestId:'sh-off'});
  const l1=await led();
  ok(bad.data.ok===false&&l1.gold===l0.gold&&((l1.frags||{})[off]|0)===((l0.frags||{})[off]|0),'a hero not on offer ('+off+') is refused, nothing spent ('+(bad.data.error||'SOLD')+')');
  const o=offers[0]||{};
  const buy=await call('/api/market/frag',{offer:o.i,heroKey:o.hero,qty:1,pay:'gems',requestId:'sh-buy0'});
  const l2=await led();
  ok(buy.data.ok===true&&buy.data.qty===o.qty&&buy.data.paid&&buy.data.paid.gold===o.price&&l1.gold-l2.gold===o.price,'offer 0 sells at its own quantity and price, whatever the client sends ('+(buy.data.error||JSON.stringify(buy.data.paid))+')');
  const again=await call('/api/market/frag',{offer:o.i,heroKey:o.hero,requestId:'sh-buy0b'});
  ok(again.data.ok===false&&(await led()).gold===l2.gold,'the same offer does not sell twice ('+(again.data.error||'SOLD')+')');
  const o4=(await call('/api/market/offers')).data;
  ok(Array.isArray(o4.offers)&&o4.offers[0].bought===true&&o4.offers[1].bought===false,'the offers view marks offer 0 as sold');
  // ---- #7 summon table
  const st=(await call('/api/hero/summon-table')).data, t=st.table||{};
  ok(t.brannus&&t.brannus.cost===80&&t.brannus.stars===3&&t.tick&&t.tick.cost>0&&Object.keys(t).length===HB.length,'the summon table serves Brannus at 80 fragments and 3 stars, one row per hero ('+JSON.stringify(t.brannus)+')');
  await editDB(u=>{ u.led.frags=u.led.frags||{}; u.led.frags.brannus=30; delete u.led.unlocked.brannus; delete u.led.hero.brannus; });
  const s30=await call('/api/hero/summon',{heroKey:'brannus',requestId:'sh-s30'});
  ok(s30.data.ok===false&&/Need 80/.test(s30.data.error||''),'the summon route charges what the table says (30 is refused: '+(s30.data.error||'summoned')+')');
  await editDB(u=>{ u.led.frags.brannus=80; });
  const s80=await call('/api/hero/summon',{heroKey:'brannus',requestId:'sh-s80'}); const l3=await led();
  ok(s80.data.ok===true&&((l3.hero||{}).brannus||{}).stars===3,'at 80 Brannus is summoned at the table\'s 3 stars ('+(s80.data.error||JSON.stringify((l3.hero||{}).brannus))+')');
  // ---- static: the client
  if(!process.env.AUD_SERVER){
    const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
    ok(/api\('\/api\/hero\/summon-table','GET'\)/.test(html)&&/function summonCost\(key\)\{ const s=SUMMON_SRV&&SUMMON_SRV\[key\]; if\(s&&s\.cost>0\) return s\.cost\|0;/.test(html)&&/summoned at '\+summonStars\(key\)/.test(html),
      'the client reads the summon cost and stars from the server\'s table');
    ok(/marketSync\(\)/.test(html)&&/api\('\/api\/market\/offers','GET'\)/.test(html)&&/api\('\/api\/market\/frag','POST',\{offer:o\.srv,/.test(html),'the client shows the server\'s offers and buys by offer');
    ok(/apiOnce\('bonusclaim','\/api\/bonus\/claim',\{\}\)/.test(html)&&/CLAIM HOURLY FRAGMENTS/.test(html)&&/onclick="bonusHourlyClaim\(\)"/.test(html),'the client claims the hourly bonus fragments (result card + bonus picker)');
    ok(/\(pool==='myth'\?wishMyth10:pool==='gem'\?wishGem10:wishGold10\)\(\)/.test(html)&&!/\(pool==='gem'\?wishGem10:wishGold10\)\(\)/.test(html),'Wish Again x10 repeats the pool that was used, Mythical included');
  }
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_shop_sweep_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.stack||e); process.exitCode=1; } finally { await stop(); } })();
