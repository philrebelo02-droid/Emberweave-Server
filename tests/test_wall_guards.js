// 4 Oct 2026 City Wall audit #6 (v989): the server refuses a skill upgrade the hero's quality has not unlocked - the green /
// blue / passive skill opens at Green / Blue / Purple quality (glyph ascension on the 16-step table the client uses, G2_TIER16).
// A direct POST {idx:3} used to level a locked passive. Also: the server's table equals the client's.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-wallg-'));
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
  const srv=fs.readFileSync(path.join(root,srvFile),'utf8'), html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  const sT=srv.match(/const SKILL_QUALITY_TIER16=(\[[^\]]*\])/), cT=html.match(/const G2_TIER16=(\[[^\]]*\])/);
  ok(sT&&cT&&sT[1]===cT[1],'server skill-quality table equals the client G2_TIER16 ('+(sT&&sT[1])+' / '+(cT&&cT[1])+')');
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'wallg-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await call('/api/glyphs/state');
  await editDB((db,u)=>{ u.led.px=5000; u.led.gold=10000000; u.led.unlocked.vael=true; u.led.hero.vael={xp:900000,stars:3,pips:0};
    u.glyphs=u.glyphs||{}; u.glyphs.boards=u.glyphs.boards||{}; const b=u.glyphs.boards.vael||(u.glyphs.boards.vael={slots:[null,null,null,null,null,null],ascended:{},personalPathVersion:1}); b.ascensionIndex=0; });
  const s0=await call('/api/skill/upgrade',{key:'vael',idx:0,requestId:'wg-0'});
  ok(s0.data.ok===true,'the basic skill (idx 0) upgrades at any quality ('+(s0.data.error||'ok')+')');
  const s3=await call('/api/skill/upgrade',{key:'vael',idx:3,requestId:'wg-3'});
  ok(s3.data.ok===false&&/Purple quality/.test(s3.data.error||''),'the passive (idx 3) is refused below Purple quality ('+(s3.data.error||'ok')+')');
  const s1=await call('/api/skill/upgrade',{key:'vael',idx:1,requestId:'wg-1'});
  ok(s1.data.ok===false&&/Green quality/.test(s1.data.error||''),'the green skill (idx 1) is refused at ascension 0 ('+(s1.data.error||'ok')+')');
  await editDB((db,u)=>{ u.glyphs.boards.vael.ascensionIndex=1; });
  const g1=await call('/api/skill/upgrade',{key:'vael',idx:1,requestId:'wg-1b'});
  ok(g1.data.ok===true,'at ascension 1 (Green) the green skill upgrades ('+(g1.data.error||'ok')+')');
  const b2=await call('/api/skill/upgrade',{key:'vael',idx:2,requestId:'wg-2'});
  ok(b2.data.ok===false&&/Blue quality/.test(b2.data.error||''),'at ascension 1 the blue skill is still refused ('+(b2.data.error||'ok')+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_wall_guards.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
