// 4 Oct 2026 City Wall audit #4 (v990): a glyph build is saved BEFORE the player is told it is "locked into the board". With
// the disk refusing the save (a preload hook fails the DB rename while a flag file exists) /api/glyphs/build-in-slot answers 503
// with the fragments and the board as before; with the disk back the SAME request builds once, a repeat returns the same
// receipt, and the locked glyph is on disk after a restart.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-glyphdur-'));
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
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'glyphdur-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB((db,u)=>{ u.led.unlocked.vael=true; u.led.hero.vael=u.led.hero.vael||{xp:0,stars:1,pips:0}; u.led.hero.vael.xp=50000; u.led.px=3000; });
  const so=await call('/api/glyphs/slot-options?heroKey=vael&slot=0');
  const opt=so.data.options&&so.data.options[0];
  ok(opt&&opt.blueprintId&&Array.isArray(opt.materials)&&opt.materials.length,'slot 0 offers its set glyph ('+JSON.stringify(so.data).slice(0,100)+')');
  /* a current account's glyph state (ensureGlyphs default + the migration markers), not a partial object */
  await editDB((db,u)=>{ u.glyphs=u.glyphs||{revision:1,fragments:{},subGlyphs:{},finished:{},boards:{},audit:[],seq:1,migratedAt:Date.now(),flow2At:Date.now()}; for(const m of opt.materials) u.glyphs.fragments[m.key]=(m.need|0)+5; });
  const st0=(await call('/api/glyphs/state')).data; const rev=st0.revision;
  const before=JSON.stringify(st0);
  const bytes0=fs.readFileSync(dbFile,'utf8');
  fs.writeFileSync(flag,'1');
  const pkt={heroKey:'vael',slot:0,blueprintId:opt.blueprintId,expectedRevision:rev,requestId:'gd-1'};
  const f=await call('/api/glyphs/build-in-slot',pkt);
  ok(f.status===503&&f.data.storageFailed===true,'a failed save answers 503 storageFailed (got '+f.status+' '+JSON.stringify(f.data).slice(0,90)+')');
  const mid=(await call('/api/glyphs/state')).data;
  ok(JSON.stringify(mid)===before,'fragments, board and revision are unchanged in memory');
  await delay(400); ok(fs.readFileSync(dbFile,'utf8')===bytes0,'nothing reached the disk');
  fs.unlinkSync(flag);
  const s1=await call('/api/glyphs/build-in-slot',pkt);
  ok(s1.status===200&&s1.data.ok===true&&s1.data.locked===true,'with the disk back the same request builds the glyph ('+JSON.stringify(s1.data).slice(0,90)+')');
  const s2=await call('/api/glyphs/build-in-slot',pkt);
  ok(JSON.stringify(s2.data)===JSON.stringify(s1.data),'a repeat returns the same receipt');
  await stop(); const d=disk(); await start();
  const bd=d.users[id].glyphs.boards.vael;
  ok(bd&&bd.slots[0],'the locked glyph is on disk after a restart ('+(bd&&bd.slots[0])+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_glyph_durable.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
