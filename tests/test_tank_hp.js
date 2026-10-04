// 4 Oct 2026 v1019 - Phil: "magic tanks should have about 18k hp, melee tanks about 22k" (glyphs and base stats, at max: level 100,
// 5 stars, Orange). The 8 melee tanks' glyph path banked 25 Bastions (+120,156 HP); it now uses Ironwall, a board banked under the old
// path is recomputed at boot, and a Tank's HP growth per level depends on its damage profile (Attack 70, Magic 54). Other classes are
// unchanged. Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tankhp-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(admin){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,ADMIN_IDS:admin||''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
const call=async(p,b,tok)=>{ const r=await fetch(base+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:b?JSON.stringify(b):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return j; };
const hp=async(k,tok)=>{ const s=await call('/api/admin/snapshot?hero='+k,null,tok); return Math.round(((s.snapshot||s).maxHp)||0); };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start('');
  const d=await call('/api/register',{name:'tankhp',pass:'password1'}); const id=d.profile.id; await delay(400); await stop(); await start(id);
  let tok=(await call('/api/login',{name:'tankhp',pass:'password1'})).token;
  const keys=['grosk','vael','bloatus','cathedral','astra','grimsby','cacklefang','lumi'];
  await call('/api/admin/led-grant',{heroKeys:keys,unlock:keys,stars:5,maxGlyphs:true,px:99000000,heroXp:99000000},tok);
  // the live situation: a melee tank's Orange board banked under the old (Bastion) path, migration marker absent
  await delay(500); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const g=db.users[id].glyphs;
  g.boards.grosk.ascended.HP={val:120156,pct:false}; delete g.tankPath1019; fs.writeFileSync(dbFile,JSON.stringify(db)); await start(id);
  tok=(await call('/api/login',{name:'tankhp',pass:'password1'})).token;
  const after=JSON.parse(fs.readFileSync(dbFile,'utf8')).users[id].glyphs.boards.grosk.ascended.HP.val;
  ok(after<20000,'a board banked under the old Bastion path is recomputed at boot (HP banked '+after+')');
  const H={}; for(const k of keys) H[k]=await hp(k,tok);
  ok(H.grosk>=21000&&H.grosk<=23000&&H.vael>=21000&&H.vael<=23000,'melee tanks are about 22k at max (grosk '+H.grosk+', vael '+H.vael+')');
  ok(H.bloatus>=17000&&H.bloatus<=19000&&H.cathedral>=17000&&H.cathedral<=19000,'magic tanks are about 18k at max (bloatus '+H.bloatus+', cathedral '+H.cathedral+')');
  ok(H.astra<10000&&H.grimsby<12500&&H.cacklefang<10500&&H.lumi<10500,'other classes are unchanged ('+JSON.stringify({astra:H.astra,grimsby:H.grimsby,cacklefang:H.cacklefang,lumi:H.lumi})+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_tank_hp.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
