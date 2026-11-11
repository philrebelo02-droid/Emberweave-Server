// v1356 (Phil 10 Nov 2026, on "equip another item in the same slot and the first item is free to go on a different hero": "block it").
// Real server on a free port + temp DB. An item equipped once stays bound to that hero, also after another item took its slot.
// Also: Guild shop Arena Coins refuses at the cap before taking guild coins; collect/blessing/sign-in/quest fixes are static checks.
// Control: AUD_SERVER=<the v1355 server.js copied into the repo root> must FAIL the bound-gear check.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),cp=require('child_process'),{spawn}=cp;
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-bg-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);}   /* 11 Nov: a 60 s deadline, not an iteration count */ throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); }   /* 11 Nov: until it has exited (the port is free) */ child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
async function editDB(fn){ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'bg-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const cat=JSON.parse(fs.readFileSync(path.join(root,'server','gear-catalog.json'),'utf8')).items;
  const A=cat.filter(d=>d.quality==='Grey')[0]; let h1,h2; const now=Date.now();
  await editDB(u=>{ const un=Object.keys(u.led.unlocked||{}).filter(k=>u.led.unlocked[k]); h1=un[0]; h2=un[1];
    u.gear={revision:1,heroGearV:1,fragments:{},subs:{},seq:10,active:{},
      items:{ x:{d:A.id,temper:0,prog:0,dustSpent:0,createdAt:now}, y:{d:A.id,temper:0,prog:0,dustSpent:0,createdAt:now}, old:{d:A.id,temper:0,prog:0,dustSpent:0,bound:true,createdAt:now} },
      equipped:{} }; });
  ok(h1&&h2&&h1!==h2,'fixture: two owned heroes ('+h1+', '+h2+'), two fresh copies of '+A.name);
  const eq=async(hero,itemId)=>{ const st=(await call('/api/gear/state')).data; return call('/api/gear/equip',{heroKey:hero,itemId,expectedRevision:st.revision,requestId:'r'+Math.random().toString(36).slice(2)}); };
  let r=await eq(h1,'x'); ok(r.data.ok===true,'X equips on the first hero ('+(r.data.error||'ok')+')');
  r=await eq(h1,'y'); ok(r.data.ok===true,'Y takes the same slot on the first hero - X is displaced ('+(r.data.error||'ok')+')');
  r=await eq(h2,'x'); ok(r.data.ok!==true&&/bound to/i.test(String(r.data.error||'')),'the displaced X can NOT be equipped on the second hero (got '+JSON.stringify(r.data).slice(0,90)+')');
  r=await eq(h1,'x'); ok(r.data.ok===true,'CONTROL: X can go back on its own hero ('+(r.data.error||'ok')+')');
  r=await eq(h2,'old'); ok(r.data.ok===true,'an item bound before v1356 with no recorded hero takes the first hero it is equipped on ('+(r.data.error||'ok')+')');
  r=await eq(h2,'y'); ok(r.data.ok!==true,'Y (bound to the first hero, displaced again) is refused on the second hero');
  await stop();
  const srv=fs.readFileSync(path.join(root,'server.js'),'utf8'), html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  const os_=cp.execSync('git show 6d121f5e:server.js',{cwd:root,maxBuffer:64<<20}).toString(), oh=cp.execSync('git show 6d121f5e:emberweave-heroes.html',{cwd:root,maxBuffer:64<<20}).toString();
  const both=(n,re,a,b)=>{ ok(re.test(a),n); ok(!re.test(b),'CONTROL v1355: '+n+' was missing'); };
  both('Guild shop Arena Coins refuses at the cap before the guild coins are taken',/else if\(it\.arenaCoins\)\{ if\(\(me\.coins\|0\)\+it\.arenaCoins>ECON_CAP\.arenaCoins\) return \{ok:false/,srv,os_);
  both('Temple blessing dots are checked on a discarded Multi pray too',/else\{TEMPLE\.discardSession\(state\);cancelled\+\+;for\(const x of TEMPLE\.earnBlessings\(state,key,info\)\)unlocked\.push\(x\);\}/,srv,os_);
  both('Temple /discard checks blessing dots',/TEMPLE\.discardSession\(state\);\r?\n\s*try\{ TEMPLE\.earnBlessings\(state,pending\.heroId,templeHeroInfo\(led,pending\.heroId\)\); \}catch/,srv,os_);
  both('Academy collect is applied inside its own durable commit',/if\(A&&p!=='\/api\/academy\/collect'\)acadCollect\(A\);/,srv,os_);
  both('Sign-in popup uses the day the server paid',/sd!==day\|\|sm!==d\.getMonth\(\)\)\) _shown=signinDayReward\(sy,sm,sd\);/,html,oh);
  both('Quests: a failed first load offers Retry',/id="questRetry"/,html,oh);
  console.log('test_bound_gear_1356.js: '+pass+' checks passed (server '+srvFile+')'); process.exit(0);
} catch(e){ console.log('FAIL '+(e&&e.message)); try{ await stop(); }catch(_){} process.exit(1); } })();
