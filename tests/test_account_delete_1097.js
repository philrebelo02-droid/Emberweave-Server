// v1097 (9 Oct 2026 full-game sweep #16 #17): a player deletes their own account (App Store requirement), and a signed-in guest
// makes an account in place without losing progress.
// Delete: /api/account/delete needs the session, a requestId, the typed confirmation (DELETE or the account name) and the password;
// it removes the email, password hash, name and recovery code, revokes every session, takes the city off the map and the player
// out of the rankings and the guild, frees the name, and keeps the guild chat other players read as 'Deleted player'.
// Guest upgrade: /api/register with the guest's token keeps the account id and the ledger; a slur in the name is refused, a curse word is not.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-d1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100',ADMIN_IDS:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  // ---------------- delete ----------------
  const A=(await call('/api/register',{name:'delAlice',pass:'password1'})).data, B=(await call('/api/register',{name:'delBruno',pass:'password1'})).data;
  ok(!!(A.token&&B.token),'two accounts registered');
  const aid=A.profile.id, bid=B.profile.id;
  await call('/api/ledger',null,A.token); await call('/api/ledger',null,B.token);
  await editDB(db=>{ for(const id of [aid,bid]) db.users[id].led=Object.assign(db.users[id].led||{},{px:200000});   // level 20+: the Guild Hall (13) and a castle on the map (20)
    db.users[aid].email='alice.private@example.com'; db.users[aid].reset={hash:'abc123',salt:'s',exp:Date.now()+600000,tries:0}; });
  const aHash=disk().users[aid].hash;
  const gc=await call('/api/guild/create',{name:'Keepers Of Ash'},A.token); const gid=gc.data.guild&&gc.data.guild.id;
  ok(!!gid,'A made a guild ('+(gc.data.error||'ok')+')');
  await call('/api/guild/request',{guildId:gid},B.token); await call('/api/guild/approve',{id:bid},A.token);
  await call('/api/guild/chat',{tx:'hello from the founder'},A.token); await call('/api/guild/chat',{tx:'hi boss'},B.token);
  const tok=A.token;
  await call('/api/world/cities',null,A.token);   // places A's castle on the map
  { const c0=(await call('/api/world/cities',null,B.token)).data, l0=(await call('/api/arena/ladder?q=delalice',null,B.token)).data;
    ok(JSON.stringify(c0).includes(aid)&&(l0.entries||[]).some(e=>e.name==='delAlice'),'before: A is on the world map and the arena ladder'); }
  let r=await call('/api/account/delete',{confirm:'DELETE',pass:'password1',requestId:'d1'});
  ok(r.status===401,'no session: refused ('+r.status+')');
  r=await call('/api/account/delete',{pass:'password1',requestId:'d1'},tok);
  ok(r.status===400&&r.data.needConfirm===true,'no confirmation text: refused ('+r.status+' '+(r.data.error||'')+')');
  r=await call('/api/account/delete',{confirm:'delete me',pass:'password1',requestId:'d1'},tok);
  ok(r.status===400&&r.data.needConfirm===true,'wrong confirmation text: refused');
  r=await call('/api/account/delete',{confirm:'DELETE',requestId:'d1'},tok);
  ok(r.status===400&&r.data.needPass===true,'no password: refused');
  r=await call('/api/account/delete',{confirm:'DELETE',pass:'wrongpass1',requestId:'d1'},tok);
  ok(r.status===403&&r.data.needPass===true,'wrong password: refused ('+r.status+')');
  r=await call('/api/account/delete',{confirm:'DELETE',pass:'password1'},tok);
  ok(r.status===400,'no requestId: refused');
  await delay(400);
  ok(!!disk().users[aid]&&(await call('/api/profile',null,tok)).status===200,'every refusal left the account and its session as they were');
  r=await call('/api/account/delete',{confirm:'delalice',pass:'password1',requestId:'d1'},tok);   // the account name (any case) confirms too
  ok(r.status===200&&r.data.ok===true&&r.data.deleted===true,'typed name + password + requestId: deleted ('+r.status+' '+(r.data.error||'')+')');
  r=await call('/api/account/delete',{confirm:'delalice',pass:'password1',requestId:'d1'});
  ok(r.status===200&&r.data.deleted===true,'a retry of the same requestId answers deleted (not 401)');
  ok((await call('/api/profile',null,tok)).status===401,'the session is revoked');
  ok((await call('/api/login',{name:'delAlice',pass:'password1'})).status===401,'the name and password no longer sign in');
  await delay(400); let db=disk(), raw=JSON.stringify(db);
  ok(!db.users[aid],'the account object is gone');
  ok(raw.indexOf('alice.private@example.com')<0,'the email is gone from the world file');
  ok(raw.indexOf(aHash)<0,'the password hash is gone from the world file');
  ok(raw.indexOf('delAlice')<0&&raw.toLowerCase().indexOf('"delalice"')<0,'the name is gone from the world file (index and records)');
  ok(!Object.values(db.tokens||{}).some(v=>(typeof v==='string'?v:v&&v.id)===aid),'no token of the account is left');
  const g=(db.guilds||{})[gid]||{};
  ok(JSON.stringify(g.members)===JSON.stringify([bid])&&g.leader===bid,'the guild passes to the remaining member');
  const gl=(g.log||[]).filter(e=>!e.sys);
  ok(gl.some(e=>e.tx==='hello from the founder'&&e.name==='Deleted player')&&gl.some(e=>e.tx==='hi boss'&&e.name==='delBruno'),'guild chat other players read stays, the deleted player shown as Deleted player');
  const cities=(await call('/api/world/cities',null,B.token)).data; const ladder=(await call('/api/arena/ladder?q=delalice',null,B.token)).data;
  ok(Array.isArray(cities.cities)&&!JSON.stringify(cities).includes(aid)&&Array.isArray(ladder.entries)&&!ladder.entries.length,'the account is off the world map and the arena ladder');
  r=await call('/api/register',{name:'delAlice',pass:'password1'});
  ok(r.status===200&&r.data.profile&&r.data.profile.id!==aid,'the name is free again (a new account)');
  r=await call('/api/register',{name:'Deleted Player',pass:'password1'});
  ok(r.status===400,'nobody can take the name Deleted player');
  // a guest deletes with the typed confirmation only (no password to check)
  const G1=(await call('/api/guest',{deviceId:'d1097-g1-'+Date.now()})).data;
  r=await call('/api/account/delete',{confirm:'DELETE',requestId:'g1'},G1.token);
  ok(r.status===200&&r.data.deleted===true,'a guest deletes with DELETE');
  // ---------------- guest upgrade ----------------
  const dev='d1097-up-'+Date.now(); const GU=(await call('/api/guest',{deviceId:dev})).data; const gid2=GU.profile.id;
  await call('/api/ledger',null,GU.token);
  await editDB(db=>{ Object.assign(db.users[gid2].led,{gold:12345,gems:777,px:500}); });
  const before=(await call('/api/ledger',null,GU.token)).data; const L0=before.ledger||before;
  r=await call('/api/register',{name:'xFaggotx',pass:'password1',deviceId:dev},GU.token);
  ok(r.status===400,'a slur in the name is refused ('+r.status+' '+(r.data.error||'')+')');
  r=await call('/api/register',{name:'F4gg0t99',pass:'password1',deviceId:dev},GU.token);
  ok(r.status===400,'a letter-number swap of a slur is refused too');
  r=await call('/api/register',{name:'FuckingHero',pass:'password1',deviceId:dev},GU.token);   // Phil 9 Oct: 18+, cursing is ok - in names too
  ok(r.status===200&&r.data.profile&&r.data.profile.id===gid2&&r.data.profile.guest===false,'a curse-word name is allowed; the guest becomes an account with the SAME id ('+(r.data.error||'')+')');
  const L1=((await call('/api/ledger',null,r.data.token)).data); const led1=L1.ledger||L1;
  ok(led1.gold===L0.gold&&led1.gems===L0.gems&&led1.px===L0.px&&L0.gold===12345,'the ledger is kept (gold '+led1.gold+', diamonds '+led1.gems+', xp '+led1.px+')');
  const li=await call('/api/login',{name:'FuckingHero',pass:'password1'});
  ok(li.status===200&&li.data.profile.id===gid2,'the new name and password sign in to the same account');
  ok((await call('/api/profile',null,GU.token)).status===401,'the old guest session is replaced');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_account_delete_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
