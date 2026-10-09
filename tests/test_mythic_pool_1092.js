// v1092 - the Mythical Pool, only mythical heroes (Phil 9 Oct: 1 % hero, 30 % mythical frags, 34 % glyph frags, 15 % full glyph, 10 % attack card, 5 % shield, 5 % teleport; Open Projects/EGP and EDP - Patron system): opens at EGP 11, 400 diamonds a wish, Phil's odds;
// KonWu leaves the Diamond Pool; attack buying opens at EGP 3 with a daily number of buys; the attack card adds 10 attacks.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-myth-'));
const dbFile=path.join(dir,'db.json'), src=fs.readFileSync(path.join(root,srvFile),'utf8');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
let rq=0; const R=()=>'m'+(rq++);
(async()=>{ try{
  // static: KonWu is no longer in the Diamond Pool roll
  const gem=src.slice(src.indexOf('function poolRollGem('),src.indexOf('\n',src.indexOf("acc+=0.15;",src.indexOf('function poolRollGem('))));
  ok(!/konwu/i.test(gem),'KonWu is not in the Diamond Pool roll');
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'myth-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(u=>{ u.led.gems=400000; u.led.px=11986; });
  const w0=await call('/api/pool/wish',{pool:'myth',requestId:R()});
  ok(w0.data.ok===false&&/EGP 11/.test(w0.data.error||''),'the Mythical Pool is closed below EGP 11 ('+(w0.data.error||'')+')');
  const b0=await call('/api/patron/buy-attacks',{requestId:R()});
  ok(b0.data.ok===false&&/EGP 3/.test(b0.data.error||''),'attack buying is closed at EGP 0 ('+(b0.data.error||'')+')');
  await editDB(u=>{ u.led.patron={v:1,base:3000,prestiged:false,edpBase:0}; });   // EGP 11
  let L=await led(); ok(L.patron.egp===11&&L.patron.mythPool===true,'EGP 11 opens the Mythical Pool (EGP '+L.patron.egp+')');
  const gems0=L.gems, types={}, heroKeys=new Set(); let total=0;
  for(let i=0;i<30;i++){ const r=await call('/api/pool/wish',{pool:'myth',n:10,requestId:R()}); if(!r.data.ok){ console.log(r.data); break; } for(const x of r.data.results){ types[x.type]=(types[x.type]||0)+1; if(x.hero&&/^(hero|dupe|frags)$/.test(x.type)) heroKeys.add(x.hero); total++; } }
  L=await led();
  ok(total===300&&gems0-L.gems===30*400*9,'300 wishes in tens cost 400 x 9 each ten ('+(gems0-L.gems)+' diamonds)');
  const known=new Set(['hero','dupe','frags','glyphFrag','glyphFull','attackCard','shield','teleport','prayer']);
  ok(Object.keys(types).every(k=>known.has(k)),'every result is a Mythical Pool prize ('+JSON.stringify(types)+')');
  const gf=(types.glyphFrag||0)+(types.glyphFull||0), fr=types.frags||0;
  ok(gf>=80&&gf<=140&&fr>=80&&fr<=140,'the odds land near the table: glyph prizes ~111 of 300 ('+gf+'), mythical fragments ~108 ('+fr+')');
  ok(/mythHero:0\.01,mythFrag:0\.36,glyphFrag:0\.27,glyphFull:0\.10,attackCard:0\.05,shield:0\.05,kindled:0\.05,stoked:0\.035,blazing:0\.015,inferno:0\.01,teleport:0\.05/.test(src),'the table is the final odds Phil set (sums to 100 %)');
  const MY=new Set(['konwu','vulmar','aureth','hurne','hollow']);
  ok(heroKeys.size>0&&[...heroKeys].every(k=>MY.has(k)),'every hero and fragment prize is a mythical hero ('+[...heroKeys].join(',')+')');
  ok((types.prayer|0)>=17&&(types.prayer|0)<=55,'Temple prayers come out near 11 % ('+(types.prayer|0)+' of 300)');
  ok(((L.patron.attacks.cards|0)+0)===(types.attackCard||0),'attack cards are kept on the ledger ('+L.patron.attacks.cards+')');
  // attack buys at EGP 11: 3 a day
  let okBuys=0; for(let i=0;i<4;i++){ const r=await call('/api/patron/buy-attacks',{requestId:R()}); if(r.data.ok) okBuys++; }
  ok(okBuys===3,'EGP 11 buys attacks 3 times a day, the 4th is refused ('+okBuys+')');
  if((L.patron.attacks.cards|0)>0){ const before=(await led()).patron.attacks.cap; const c=await call('/api/patron/use-attack-card',{requestId:R()}); const after=(await led()).patron.attacks.cap;
    ok(c.data.ok===true&&after===before+10,'an attack card adds 10 attacks today ('+before+' -> '+after+')'); }
  else { await editDB(u=>{ u.led.cards={attack:1}; }); const before=(await led()).patron.attacks.cap; const c=await call('/api/patron/use-attack-card',{requestId:R()}); const after=(await led()).patron.attacks.cap;
    ok(c.data.ok===true&&after===before+10,'an attack card adds 10 attacks today ('+before+' -> '+after+')'); }
  const odds=(await call('/api/pool/odds')).data;
  ok(!odds.odds||odds.odds.konwu==null,'the published Diamond Pool odds no longer list KonWu');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_mythic_pool_1092.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
