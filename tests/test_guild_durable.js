// 4 Oct 2026 Guild audit #5 (v992): a guild contribution (the player's gold + daily count and the guild's exp) and a raid start
// (the spent attempt and the open fight) are each ONE durable commit. With the disk refusing the save (a preload hook fails the
// DB rename while a flag file exists) both answer 503 with nothing moved; with the disk back they apply once and survive a restart.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-guilddur-'));
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
  const g=await call('/api/guest',{deviceId:'guilddur-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>{ u.led.gold=5000; u.led.unlocked.vael=true; u.led.hero.vael=u.led.hero.vael||{xp:0,stars:1,pips:0};
    db.guilds=db.guilds||{}; db.guilds.gd={id:'gd',name:'Durable Guild',leader:id,members:[id],level:1,exp:0}; u.guildId='gd'; });
  // --- contribute
  const l0=await led(), gm0=(await call('/api/guild/mine')).data.guild;
  fs.writeFileSync(flag,'1');
  const cf=await call('/api/guild/contribute',{requestId:'gc-1'});
  ok(cf.status===503&&cf.data.storageFailed===true,'contribute: a failed save answers 503 (got '+cf.status+' '+JSON.stringify(cf.data).slice(0,80)+')');
  const l1=await led(), gm1=(await call('/api/guild/mine')).data.guild;
  ok(l1.gold===l0.gold&&gm1.exp===gm0.exp,'contribute: gold and guild exp unchanged in memory ('+l0.gold+'->'+l1.gold+', exp '+gm0.exp+'->'+gm1.exp+')');
  fs.unlinkSync(flag);
  const cs=await call('/api/guild/contribute',{requestId:'gc-1'});
  ok(cs.status===200&&cs.data.guild&&cs.data.ledger&&cs.data.ledger.gold===l0.gold-200,'contribute: with the disk back it applies once ('+(cs.data.error||'gold '+(cs.data.ledger&&cs.data.ledger.gold))+')');
  // --- raid start
  fs.writeFileSync(flag,'1');
  const rf=await call('/api/guild/raid/start',{heroIds:['vael'],requestId:'rs-1'});
  ok(rf.status===503&&rf.data.storageFailed===true,'raid start: a failed save answers 503 (got '+rf.status+' '+JSON.stringify(rf.data).slice(0,80)+')');
  const rv=(await call('/api/guild/raid')).data.raid||{};
  ok((rv.attemptsLeft|0)===3,'raid start: no attempt spent ('+rv.attemptsLeft+' left)');
  fs.unlinkSync(flag);
  const rs=await call('/api/guild/raid/start',{heroIds:['vael'],requestId:'rs-1'});
  ok(rs.status===200&&rs.data.ok===true&&rs.data.attemptId,'raid start: with the disk back it opens the fight ('+(rs.data.error||'ok')+')');
  await stop(); const d=disk(); await start();
  ok(d.guilds.gd.exp>=100&&d.users[id].led.gold===l0.gold-200,'the contribution is on disk after a restart');
  ok(d.guilds.gd.raid&&d.guilds.gd.raid.att&&d.guilds.gd.raid.att[id]&&d.guilds.gd.raid.att[id].id===rs.data.attemptId,'the open raid fight is on disk after a restart');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_guild_durable.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
