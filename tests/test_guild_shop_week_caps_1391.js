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
    db.guilds=db.guilds||{}; db.guilds.gsw={id:'gsw',name:'Cap Guild',members:[id],level:5,exp:0}; u.guildId='gsw'; });
  const L0=await led();
  ok(L0.gshopLeft&&L0.gshopLeft[1]===7&&L0.gshopLeft[9]===1&&L0.gshopLeft[5]===5,'the ledger carries gshopLeft ('+JSON.stringify(L0.gshopLeft)+')');
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
  // a new game week resets the counts
  await editDB((db,u)=>{ u.led.gshopWk.wk='2000-01-03'; });
  const L2=await led(); ok(L2.gshopLeft[1]===7&&L2.gshopLeft[9]===1&&L2.gshopLeft[5]===5,'a new week resets every cap ('+JSON.stringify(L2.gshopLeft)+')');
  const r9=await buy('gshop:1'); ok(r9.data.ok===true,'Gold Cache can be bought again in the new week');
  console.log('PASS test_guild_shop_week_caps_1391: '+pass+' checks');
} catch(e){ console.error('FAIL test_guild_shop_week_caps_1391: '+(e&&e.message||e)); process.exitCode=1; }
  finally{ await stop(); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){} } })();
