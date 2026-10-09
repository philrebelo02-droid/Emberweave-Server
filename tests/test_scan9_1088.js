// v1088 - scan 9: #2 an arena win never pays less than a loss (rank 7900 used to pay -38 coins);
//  #3 a shared replay chip keeps only the fields a replay reads, and a unit over 2,000 bytes drops the chip (real units measure <= 874).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),vm=require('vm'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-s9-'));
const dbFile=path.join(dir,'db.json'), src=fs.readFileSync(path.join(root,srvFile),'utf8');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
(async()=>{ try{
  // #2 the reward line, evaluated over ranks
  const m=src.match(/const reward=won\?([^;]*):5;/);
  const f=m?vm.runInNewContext('(rank)=>{ const me={rank}; return '+m[1]+'; }'):null;
  ok(f&&f(7900)>=5&&f(6000)>=5&&f(5750)>=5,'#2 a win far down the ladder pays at least the loss reward (rank 7900: '+(f?f(7900):'?')+')');
  ok(f&&f(1)===20+Math.floor(4999/50)&&f(4000)===40,'CONTROL: the top of the ladder pays as before (rank 1: '+(f?f(1):'?')+', rank 4000: '+(f?f(4000):'?')+')');
  // #3 live, guild chat
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'s9-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await delay(400); await stop(); { const db=disk(); db.users[id].led.px=1000; fs.writeFileSync(dbFile,JSON.stringify(db)); } await start();
  const gc=await call('/api/guild/create',{name:'Chip Nine'}); ok(gc.status===200,'fixture: guild founded ('+(gc.data.error||'ok')+')');
  const unit={key:'vael',level:50,rank:3,maxHp:9000,dmg:420,range:6,speed:3,atkInterval:1.1,skillLv:[3,3,2,2],pass:{kind:'aura',v:0.12},gearSkill:null};
  const real={v:2,seed:12345,oppName:'Rival',mineSnap:[unit,{...unit,key:'oakmir'}],foe:[{...unit,key:'gruel'}],won:true};
  await call('/api/guild/chat',{tx:'real chip',battle:real});
  await call('/api/guild/chat',{tx:'padded chip',battle:{...real,pad:'A'.repeat(6500)}});   // under the route's 8,000-byte cap, so it reaches the chip check
  await call('/api/guild/chat',{tx:'fat unit',battle:{...real,mineSnap:[{...unit,junk:'B'.repeat(3000)}]}}); await delay(400);
  const log=(Object.values(disk().guilds||{})[0]||{}).log||[], byTx=t=>log.find(e=>e.tx===t)||{};
  const rc=byTx('real chip').battle;
  ok(rc&&JSON.stringify(rc.mineSnap)===JSON.stringify(real.mineSnap)&&rc.seed===12345&&rc.v===2&&rc.won===true&&rc.oppName==='Rival','CONTROL: a real chip keeps every field a replay reads');
  const pc=byTx('padded chip').battle;
  ok(pc&&!('pad' in pc)&&JSON.stringify(pc).length<2000,'#3 an unknown top-level field is not stored ('+(pc?JSON.stringify(pc).length:0)+' bytes)');
  ok(!byTx('fat unit').battle&&byTx('fat unit').tx==='fat unit','#3 a unit over 2,000 bytes drops the chip (the line is kept)');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_scan9_1088.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
