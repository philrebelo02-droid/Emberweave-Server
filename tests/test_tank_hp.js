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
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);}   /* 11 Nov: a 60 s deadline, not an iteration count */ throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); }   /* 11 Nov: until it has exited (the port is free) */ child=null; }
const call=async(p,b,tok)=>{ const r=await fetch(base+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:b?JSON.stringify(b):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return j; };
const hp=async(k,tok)=>{ const s=await call('/api/admin/snapshot?hero='+k,null,tok); return Math.round(((s.snapshot||s).maxHp)||0); };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start('');
  const d=await call('/api/register',{name:'tankhp',pass:'password1'}); const id=d.profile.id; await delay(400); await stop(); await start(id);
  let tok=(await call('/api/login',{name:'tankhp',pass:'password1'})).token;
  const keys=['grosk','vael','bloatus','ambrel','astra','grimsby','yenna','lumi'];
  await call('/api/admin/led-grant',{heroKeys:keys,unlock:keys,stars:5,maxGlyphs:true,px:99000000,heroXp:99000000},tok);
  // the live situation: a melee tank's Orange board banked under the old (Bastion) path, migration marker absent
  await delay(500); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const g=db.users[id].glyphs;
  g.boards.grosk.ascended.HP={val:120156,pct:false};
  /* v1370 star track (Phil 11 Nov: stars are FLAT, no multiplier): "at max" is now 5 stars + the full star track (step 16, mythical done:
     +6000 HP from stars). At plain 5 stars a melee tank reads ~16.4k, a magic tank ~14k. */
  for(const k of keys) db.users[id].led.hero[k].ref=16; delete g.tankPath1019; fs.writeFileSync(dbFile,JSON.stringify(db)); await start(id);
  tok=(await call('/api/login',{name:'tankhp',pass:'password1'})).token;
  const after=JSON.parse(fs.readFileSync(dbFile,'utf8')).users[id].glyphs.boards.grosk.ascended.HP.val;
  ok(after<20000,'a board banked under the old Bastion path is recomputed at boot (HP banked '+after+')');
  const H={}; for(const k of keys) H[k]=await hp(k,tok);
  ok(H.grosk>=21000&&H.grosk<=23000&&H.vael>=21000&&H.vael<=23000,'melee tanks are about 22k at max (grosk '+H.grosk+', vael '+H.vael+')');
  ok(H.bloatus>=17000&&H.bloatus<=19000&&H.ambrel>=17000&&H.ambrel<=19000,'magic tanks are about 18k at max (bloatus '+H.bloatus+', ambrel '+H.ambrel+')');
  // v1022 balance layer 1 (Phil "Balance looks good") raised the squishies' HP growth on purpose; v1370 (flat star track, full mythical) re-measured
  // the other classes at max: astra 15306, grimsby 16587, yenna 15349, lumi 15314 (were 11517 / 13940 / 11619 / 11552 at 5 stars x1.9). +-5%.
  const near=(v,x)=>v>=x*0.95&&v<=x*1.05;
  ok(near(H.astra,15306)&&near(H.grimsby,16587)&&near(H.yenna,15349)&&near(H.lumi,15314),'other classes hold their v1370 HP at max ('+JSON.stringify({astra:H.astra,grimsby:H.grimsby,yenna:H.yenna,lumi:H.lumi})+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_tank_hp.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
