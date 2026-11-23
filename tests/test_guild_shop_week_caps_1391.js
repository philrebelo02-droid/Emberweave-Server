// v1391 - Guild Shop weekly caps (Soul Eater 15 Nov: "Limit the number of times items can be purchased from the guild shop"; Phil 16 Nov:
// "you do it"). Real server on a free port + temp DB:
//  - each item can be bought GSHOP_WEEK_LIMIT[idx] times a game week; the next buy is refused with the sold-out error and costs nothing;
//  - pieces_guild (slot 5) has its own cap;
//  - the ledger view carries gshopLeft, counting down;
//  - a new game week (gshopWk.wk changed) resets the count.
// Asserts (non-zero exit).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gsw1391-')), dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(const t0=Date.now();Date.now()-t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw new Error('server did not start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
let rid=0; const buy=what=>call('/api/shop/buy',{what,requestId:'gsw-'+(++rid)});
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'gsw1391-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>{ u.led.guildCoins=200000; u.led.gold=0; u.led.gems=0;
    db.guilds=db.guilds||{}; db.guilds.gsw={id:'gsw',name:'Cap Guild',members:[id],level:7,exp:0}; u.guildId='gsw'; });
  const L0=await led();
  ok(L0.gshopLeft&&L0.gshopLeft[1]===7&&L0.gshopLeft[9]===1&&L0.gshopLeft[5]===5&&L0.gshopLeft[0]==null,'the ledger carries gshopLeft ('+JSON.stringify(L0.gshopLeft)+')');
  // slot 1: Gold Cache, 7 a week
  for(let i=0;i<7;i++){ const r=await buy('gshop:1'); ok(r.data.ok===true,'Gold Cache buy '+(i+1)+' of 7 ('+(r.data.error||'ok')+')'); }
  const c0=(await led()).guildCoins; const r8=await buy('gshop:1'); const L1=await led();
  ok(r8.data.ok===false&&/Sold out for this week/.test(r8.data.error||''),'the 8th Gold Cache is refused ('+(r8.data.error||'')+')');
  ok(L1.guildCoins===c0,'the refused buy costs nothing ('+c0+' -> '+L1.guildCoins+')');
  ok(L1.gshopLeft[1]===0&&L1.gshopLeft[2]===3,'gshopLeft shows 0 for slot 1, untouched slot 2 still 3');
  ok(r8.data.errCode==='sold_out_for_this_week','the refusal carries its translation code ('+r8.data.errCode+')');
  // slot 9: Shield Pack, 1 a week
  const s1=await buy('gshop:9'), s2=await buy('gshop:9');
  ok(s1.data.ok===true&&s2.data.ok===false,'Shield Pack: one a week ('+(s1.data.error||'ok')+' / '+(s2.data.error||'ok')+')');
  // slot 5: pieces_guild, 5 a week
  for(let i=0;i<5;i++){ const r=await buy('pieces_guild'); ok(r.data.ok===true,'Equipment Pieces buy '+(i+1)+' of 5 ('+(r.data.error||'ok')+')'); }
  const p6=await buy('pieces_guild'); ok(p6.data.ok===false&&/Sold out for this week/.test(p6.data.error||''),'the 6th Equipment Pieces is refused');
  // Phil 16 Nov: cooldowns on purchase - shield 24 h, wild teleport 24 h, teleport 72 h; attack card once a week
  const sh1=await buy('gshop:0'), sh2=await buy('gshop:0');
  ok(sh1.data.ok===true&&sh2.data.ok===false&&/on cooldown/.test(sh2.data.error||''),'Protection Shield: a second buy is on cooldown ('+(sh1.data.error||'ok')+' / '+(sh2.data.error||'ok')+')');
  ok(sh2.data.errCode==='you_bought_this_recently_it','the cooldown refusal carries its translation code ('+sh2.data.errCode+')');
  const t1=await buy('gshop:12'), t2=await buy('gshop:12'), w1=await buy('gshop:13'), w2=await buy('gshop:13');
  ok(t1.data.ok===true&&t1.data.got&&t1.data.got.teleScrolls===1&&t2.data.ok===false,'Teleport Scroll: one, then cooldown ('+(t1.data.error||'ok')+' / '+(t2.data.error||'ok')+')');
  ok(w1.data.ok===true&&w1.data.got&&w1.data.got.wildScrolls===1&&w2.data.ok===false,'Wild Teleport Scroll: one, then cooldown ('+(w1.data.error||'ok')+' / '+(w2.data.error||'ok')+')');
  const Lc=await led(); ok(Lc.gshopCd&&Lc.gshopCd[0]>23*3600000&&Lc.gshopCd[12]>71*3600000&&Lc.gshopCd[13]>23*3600000,'the ledger shows the cooldowns left ('+JSON.stringify(Lc.gshopCd)+')');
  const u1=disk().users[id]; ok((u1.worldTravel.teleScrolls|0)===1&&(u1.worldTravel.wildScrolls|0)===1,'the scrolls land in the world travel state');
  const a1=await buy('gshop:14'), a2=await buy('gshop:14');
  ok(a1.data.ok===true&&a2.data.ok===false&&/Sold out for this week/.test(a2.data.error||''),'Attack Card: once a week ('+(a1.data.error||'ok')+' / '+(a2.data.error||'ok')+')');
  ok((disk().users[id].led.cards.attack|0)===1,'the attack card lands in led.cards');
  // v1432 (Phil 23 Nov 2026: "Guild stam should be a 3 day cooldown"): the Stamina Refill (slot 3) - once, then 3 days (it was 7 a week)
  await editDB((db,u)=>{ u.led.stam={v:1,ts:Date.now()}; }); const sr1=await buy('gshop:3');
  await editDB((db,u)=>{ u.led.stam={v:1,ts:Date.now()}; }); const sr2=await buy('gshop:3');
  ok(sr1.data.ok===true&&sr2.data.ok===false&&/on cooldown/.test(sr2.data.error||''),'Stamina Refill: one, then on cooldown ('+(sr1.data.error||'ok')+' / '+(sr2.data.error||'ok')+')');
  const Ls=await led(); ok(Ls.gshopCd&&Ls.gshopCd[3]>71*3600000&&Ls.gshopCd[3]<=72*3600000,'the Stamina Refill cooldown is 3 days ('+(Ls.gshopCd&&Ls.gshopCd[3])+' ms left)');
  ok(Ls.gshopLeft[3]===undefined,'no weekly cap on the Stamina Refill any more');
  // the cooldowns end: 72 h + 1 min later the teleport sells again (cooldown stamps moved back)
  await editDB((db,u)=>{ for(const k in u.led.gshopCd) u.led.gshopCd[k]-=72*3600000+60000; });
  const t3=await buy('gshop:12'), sh3=await buy('gshop:0'); ok(t3.data.ok===true&&sh3.data.ok===true,'after the cooldowns the teleport and the shield sell again');
  await editDB((db,u)=>{ u.led.stam={v:1,ts:Date.now()}; }); const sr3=await buy('gshop:3'); ok(sr3.data.ok===true,'after 3 days the Stamina Refill sells again ('+(sr3.data.error||'ok')+')');
  // a new game week resets the counts
  await editDB((db,u)=>{ u.led.gshopWk.wk='2000-01-03'; });
  const L2=await led(); ok(L2.gshopLeft[1]===7&&L2.gshopLeft[9]===1&&L2.gshopLeft[5]===5,'a new week resets every cap ('+JSON.stringify(L2.gshopLeft)+')');
  const r9=await buy('gshop:1'); ok(r9.data.ok===true,'Gold Cache can be bought again in the new week');
  console.log('PASS test_guild_shop_week_caps_1391: '+pass+' checks');
} catch(e){ console.error('FAIL test_guild_shop_week_caps_1391: '+(e&&e.message||e)); process.exitCode=1; }
  finally{ await stop(); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){} } })();
