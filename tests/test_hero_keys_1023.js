// 4 Oct 2026 v1023 - Phil: real names for every hero, "then fix all keys everywhere". 20 hero keys follow the new names
// (librarian -> aldren, cathedral -> ambrel, cacklefang -> yenna ...). A save written before v1023 names those heroes by their old
// keys in object keys AND values; the server renames them once at boot (DB.heroKeys1023).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-hk1023-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(admin){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,ADMIN_IDS:admin||''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const call=async(p,b,tok)=>{ const r=await fetch(base+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:b?JSON.stringify(b):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return j; };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start('');
  const d=await call('/api/register',{name:'hk1023',pass:'password1'}); const id=d.profile.id; await delay(400); await stop(); await start(id);
  let tok=(await call('/api/login',{name:'hk1023',pass:'password1'})).token;
  await call('/api/admin/led-grant',{heroKeys:['grosk'],unlock:['grosk'],stars:5,px:99000000,heroXp:99000000},tok);
  await delay(500); await stop();
  // the live situation: an account saved before v1023 - old keys as object keys and as values, inside the save string too
  const db=JSON.parse(fs.readFileSync(dbFile,'utf8')), u=db.users[id];
  u.led.unlocked.librarian=true; u.led.unlocked.cacklefang=true;
  u.led.hero.librarian={xp:5000,stars:3,pips:1,ref:0};
  u.led.skill=u.led.skill||{}; u.led.skill.cacklefang=[7,3,2,1];
  u.arenaTeam=['librarian','cacklefang','grosk'];
  u.roster=u.roster||{}; u.roster.__save=JSON.stringify({team:['cathedral','grosk'],heroes:{cathedral:{lvl:9}}});
  delete db.heroKeys1023; fs.writeFileSync(dbFile,JSON.stringify(db)); await start(id);
  tok=(await call('/api/login',{name:'hk1023',pass:'password1'})).token; await delay(800);
  const after=JSON.parse(fs.readFileSync(dbFile,'utf8')), a=after.users[id];
  if(process.env.DBG) console.log('DBG', JSON.stringify(a.led.hero.aldren), JSON.stringify(a.led.hero.librarian), JSON.stringify(Object.keys(a.led.hero)));
  ok(a.led.unlocked.aldren===true&&a.led.unlocked.yenna===true&&!('librarian' in a.led.unlocked),'unlocked heroes keep their unlock under the new key');
  ok(a.led.hero.aldren&&a.led.hero.aldren.xp===5000&&a.led.hero.aldren.pips===1&&!a.led.hero.librarian,'a hero\'s progress moves to the new key intact');
  ok(JSON.stringify(a.led.skill.yenna)==='[7,3,2,1]','skill levels move to the new key');
  ok(JSON.stringify(a.arenaTeam)==='["aldren","yenna","grosk"]','a saved team lists the new keys');
  const sv=JSON.parse(a.roster.__save);
  ok(JSON.stringify(sv.team)==='["ambrel","grosk"]'&&sv.heroes.ambrel&&sv.heroes.ambrel.lvl===9,'the stored save string is renamed too');
  ok(after.heroKeys1023===1,'the migration runs once (marker set)');
  const s=await call('/api/admin/snapshot?hero=aldren',null,tok), sn=s.snapshot||s;
  ok((sn.maxHp||0)>0,'the renamed hero builds a battle snapshot under its new key');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_hero_keys_1023.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
