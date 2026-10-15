// v1142 (Phil 15 Oct 2026): the Gold wish glyph fragments follow the player's own glyph level - "Previous stage unlocked, Current stage
// unlocked fragments not grey and green" / "Reduce the fragements to 2-4 and 1-2". 46 % of the non-hero rolls = 2-4 fragments of the tier
// below the highest glyph tier reached, 26 % = 1-2 fragments of that highest tier; a player still on Grey gets Grey for both.
// Asserts (non-zero exit). CONTROL: AUD_SERVER=<the v1141 server copied into the repo root> must FAIL (fixed Grey 4-8 / Green 2-4).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gold1142-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); console.log('  x '+m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
let ip=0;
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token,'x-forwarded-for':'10.8.'+((ip>>8)&255)+'.'+(ip++&255)},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
let rq=0; const R=()=>'g'+(rq++)+'-'+Date.now();
async function roll(times){ const out=[]; for(let i=0;i<times;i++){ const w=await call('/api/pool/wish',{pool:'gold',n:10,requestId:R()}); if(w.data&&Array.isArray(w.data.results)) out.push(...w.data.results); } return out; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'gold1142-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');

  // ---- 1. a player still on Grey: both glyph results are Grey, 2-4 and 1-2 ----
  await editDB(u=>{ u.led.gold=90000000; });
  const a=(await roll(40)).filter(r=>r.type==='glyphFrag');
  ok(a.length>100,'a Grey player gets glyph-fragment results ('+a.length+')');
  ok(a.every(r=>r.q==='Grey'),'a player still on Grey gets only Grey fragments ('+[...new Set(a.map(r=>r.q))].join(',')+')');
  ok(a.every(r=>r.n>=1&&r.n<=4),'every Grey result is 1-4 fragments ('+Math.min(...a.map(r=>r.n))+'-'+Math.max(...a.map(r=>r.n))+')');

  // ---- 2. a player whose highest glyph tier is Blue (index 3): Green +1 2-4 and Blue 1-2, nothing else ----
  await editDB(u=>{ const gl=u.glyphs; const hk=Object.keys(u.led.unlocked||{}).find(k=>u.led.unlocked[k])||'vael';
    gl.boards=gl.boards||{}; gl.boards[hk]=Object.assign({slots:[null,null,null,null,null,null]},gl.boards[hk]||{},{ascensionIndex:3}); });
  const b=(await roll(60)).filter(r=>r.type==='glyphFrag');
  const prev=b.filter(r=>r.q==='Green +1'), cur=b.filter(r=>r.q==='Blue');
  ok(b.length>150,'a Blue player gets glyph-fragment results ('+b.length+')');
  ok(prev.length+cur.length===b.length,'only the tier below (Green +1) and the highest tier (Blue) appear ('+[...new Set(b.map(r=>r.q))].join(',')+')');
  ok(prev.length>0&&prev.every(r=>r.n>=2&&r.n<=4),'the tier below pays 2-4 ('+(prev.length?Math.min(...prev.map(r=>r.n))+'-'+Math.max(...prev.map(r=>r.n)):'none')+')');
  ok(cur.length>0&&cur.every(r=>r.n>=1&&r.n<=2),'the highest tier pays 1-2 ('+(cur.length?Math.min(...cur.map(r=>r.n))+'-'+Math.max(...cur.map(r=>r.n)):'none')+')');
  const share=prev.length/(prev.length+cur.length);
  ok(share>0.55&&share<0.71,'the tier below is about 46/72 of the glyph results ('+share.toFixed(3)+', target 0.639)');

  if(missed.length){ console.error('FAIL '+missed.length+' checks'); process.exitCode=1; }
  console.log('test_gold_wish_1142.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.stack||e); process.exitCode=1; } finally { await stop(); } })();
