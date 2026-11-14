// v1391 CHT-0017 (Grok): three legal Market meals in a minute (3 x SHOP_FOOD_STAMINA = 360) always tripped the 300-per-60 s stamina spike alarm.
// A paid 'shop:food' gain no longer counts toward that window; every other stamina gain still does.
// Real server on a free port + temp DB. CONTROL (in the same run): three Ember Roasts (+120 'item:stamina' each, 360 in a minute) still file the case,
// and its total is 360 (the meals are not in it). Pre-fix control: the meal half fails on the v1390 server.js.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-cht17-')), dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(const t0=Date.now();Date.now()-t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const readDB=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(300); await stop(); const db=readDB(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const stamCases=db=>(db.feedback||[]).filter(f=>f&&f.userId===id&&f.kind==='cheat'&&f.resource==='stamina'&&f.scope==='window');
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'cht17-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  /* a big patron (12 meals a day), plenty of diamonds, low stamina, three Ember Roasts for the control */
  await editDB(u=>{ u.led.gems=50000; u.led.stam={v:50,t:Date.now()}; u.led.patron={v:1,base:1e12,prestiged:false,edpBase:0}; u.led.stamItems=3; if(u.led.shop) u.led.shop.food=0; u.gainLog=[]; });
  const t0=Date.now();
  for(let i=0;i<3;i++){ const r=await call('/api/shop/buy',{what:'food',requestId:'meal-'+i}); ok(r.data.ok===true,'Market meal '+(i+1)+' sells ('+(r.data.error||'stamina '+r.data.stamina)+')'); }
  await delay(300); await stop(); let db=readDB(); await start();
  const meals=(db.users[id].gainLog||[]).filter(x=>x.res==='stamina'&&x.r==='shop:food');
  ok(meals.length===3&&meals.reduce((a,x)=>a+x.n,0)===360, 'the three meals are logged as 360 stamina from shop:food ('+meals.map(x=>x.n)+')');
  ok(stamCases(db).length===0, 'three meals in a minute (360 > 300) raise NO stamina cheat case ('+stamCases(db).map(f=>f.text)+')');
  for(let i=0;i<3;i++){ const r=await call('/api/stamina/use-item',{requestId:'roast-'+i}); ok(r.data.ok===true,'Ember Roast '+(i+1)+' is eaten ('+(r.data.error||'+'+r.data.gained)+')'); }
  ok(Date.now()-t0<55000, 'all six gains landed inside one minute ('+(Date.now()-t0)+' ms)');
  await delay(300); await stop(); db=readDB();
  const c=stamCases(db);
  ok(c.length===1, 'CONTROL: the same 360 stamina from another source (item:stamina) still files the case ('+c.length+')');
  ok(c[0]&&c[0].amount===360&&/item:stamina/.test(c[0].text), 'CONTROL: the case counts only the 360 from the roasts, not the meals ('+(c[0]&&c[0].text)+')');
  console.log('PASS: '+pass+' checks');
}catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){} } })();
