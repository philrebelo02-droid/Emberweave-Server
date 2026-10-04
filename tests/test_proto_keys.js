// 4 Oct 2026 City Wall audit #1 (P0, v986): a request value equal to an Object.prototype name ('__proto__', 'constructor',
// 'toString', ...) passed plain-object lookups (led.unlocked[k], SIM.HERO_BASE[k] are truthy for '__proto__') and could write
// onto Object.prototype for the whole server. Now any such body value/key or query value is refused (400) before a route runs.
// Also #3: /api/daily is retired (410). Normal requests - including words that merely CONTAIN 'constructor' - still work.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-proto-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'proto-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>{ u.led.px=1000; u.led.xpPotions={minor:3}; u.led.unlocked.vael=true; u.led.hero.vael=u.led.hero.vael||{xp:0,stars:1,pips:0}; u.led.gold=100000; });
  const xp=await call('/api/hero/xp-potion',{heroKey:'__proto__',tier:'minor',requestId:'p-xp'});
  ok(xp.status===400&&xp.data.ok!==true,'xp potion on "__proto__" is refused ('+xp.status+' '+JSON.stringify(xp.data).slice(0,80)+')');
  const sk=await call('/api/skill/upgrade',{key:'constructor',idx:0,requestId:'p-sk'});
  ok(sk.status===400&&sk.data.ok!==true,'skill upgrade on "constructor" is refused ('+sk.status+' '+JSON.stringify(sk.data).slice(0,80)+')');
  const sw=await call('/api/campaign/sweep',{mode:'normal',node:1,times:1,heroIds:['vael','__proto__'],requestId:'p-sw'});
  ok(sw.status===400&&/Invalid request/.test(sw.data.error||''),'a "__proto__" inside an array is refused ('+sw.status+' '+(sw.data.error||'')+')');
  /* raw JSON: in a JS object literal '__proto__' sets the prototype instead of making a key */
  const nr=await fetch(base+'/api/watch/report',{method:'POST',headers:{'Content-Type':'application/json','x-token':token},body:'{"attacks":[{"name":"x","eta":1,"ret":false,"__proto__":{"polluted":1}}]}'});
  const nested={status:nr.status};
  ok(nested.status===400,'a "__proto__" KEY in a nested object is refused ('+nested.status+')');
  const q=await call('/api/glyphs/slot-options?heroKey=toString&slot=0');
  ok(q.status===400&&/Invalid request|Unknown hero/.test(q.data.error||''),'a query value "toString" is refused ('+q.status+' '+(q.data.error||'')+')');
  const ac=await call('/api/academy/research',{track:'__proto__',requestId:'p-ac'});
  ok(ac.status===400,'academy research on "__proto__" is refused ('+ac.status+' '+JSON.stringify(ac.data).slice(0,60)+')');
  // normal requests still pass
  const gc=await call('/api/guild/create',{name:'Constructors Of Ash'});
  ok(gc.status===200&&gc.data.guild,'a name that merely contains "constructor" still works ('+gc.status+' '+(gc.data.error||'')+')');
  const good=await call('/api/hero/xp-potion',{heroKey:'vael',tier:'minor',requestId:'p-xp-good'});
  ok(good.status===200&&good.data.ok===true,'an ordinary xp potion still works ('+good.status+' '+(good.data.error||'')+')');
  const dl=await call('/api/daily',{});
  ok(dl.status===410,'/api/daily is retired (410; got '+dl.status+' '+JSON.stringify(dl.data).slice(0,80)+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_proto_keys.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
