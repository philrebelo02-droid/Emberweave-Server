// 3 Oct 2026 Guild audit #2 (v978): the guild raid result is one durable commit of the player's reward AND the guild's shared
// state. With the disk refusing the save (a preload hook fails the DB rename while a flag file exists) the resolve must answer
// 503 with the boss, the guild coins and the open attempt exactly as before; with the disk back the SAME requestId books once,
// a repeat answers the same body, and the booking survives a restart.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-raiddur-'));
const dbFile=path.join(dir,'db.json'), flag=path.join(dir,'FAIL'), hook=path.join(dir,'failhook.cjs');
fs.writeFileSync(hook,"const fs=require('node:fs'),rename=fs.renameSync;\nfs.renameSync=function(a,b){ if(b===process.env.DB_FILE&&fs.existsSync(process.env.FAIL_FLAG)) throw Error('injected rename failure'); return rename.apply(this,arguments); };\n");
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['--require',hook,srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,FAIL_FLAG:flag},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'raiddur-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>{ u.led.unlocked.vael=true; u.led.hero.vael=u.led.hero.vael||{xp:0,stars:1,pips:0};
    db.guilds=db.guilds||{}; db.guilds.gdur={id:'gdur',name:'Durable Guild',members:[id],level:1,exp:0}; u.guildId='gdur'; });
  const rs=await call('/api/guild/raid/start',{heroIds:['vael'],requestId:'rd-start'});
  ok(rs.data.ok===true&&rs.data.attemptId,'raid fight starts ('+(rs.data.error||'ok')+')');
  await delay(400);
  const before={raid:(await call('/api/guild/raid')).data.raid, coins:(await led()).guildCoins|0};
  const bytes0=fs.readFileSync(dbFile,'utf8');
  fs.writeFileSync(flag,'1');
  const f=await call('/api/guild/raid/resolve',{attemptId:rs.data.attemptId,inputLog:[],requestId:'rd-1'});
  ok(f.status===503&&f.data.storageFailed===true,'a failed save answers 503 storageFailed (got '+f.status+' '+JSON.stringify(f.data).slice(0,90)+')');
  const mid={raid:(await call('/api/guild/raid')).data.raid, coins:(await led()).guildCoins|0};
  ok(JSON.stringify(mid.raid)===JSON.stringify(before.raid),'the boss and the board did not move in memory');
  ok(mid.coins===before.coins,'no guild coins were paid ('+before.coins+' -> '+mid.coins+')');
  await delay(400); ok(fs.readFileSync(dbFile,'utf8')===bytes0,'nothing reached the disk');
  fs.unlinkSync(flag);
  const s1=await call('/api/guild/raid/resolve',{attemptId:rs.data.attemptId,inputLog:[],requestId:'rd-1'});
  ok(s1.status===200&&s1.data.ok===true,'with the disk back the same requestId books the fight ('+JSON.stringify(s1.data).slice(0,90)+')');
  const s2=await call('/api/guild/raid/resolve',{attemptId:rs.data.attemptId,inputLog:[],requestId:'rd-1'});
  ok(JSON.stringify(s2.data)===JSON.stringify(s1.data),'a repeat answers the same body');
  const after=await led();
  ok((after.guildCoins|0)===before.coins+((s1.data.reward&&s1.data.reward.guildCoins)|0),'guild coins paid once');
  await stop(); const d=disk(); await start();
  const rd=d.guilds.gdur.raid||{};
  ok((rd.contrib&&rd.contrib[id])===s1.data.dmg&&!(rd.att&&rd.att[id]),'the booking is on disk: contribution '+((rd.contrib||{})[id])+' = dmg '+s1.data.dmg+', attempt closed');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_raid_durable.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
