// 4 Oct 2026 v1022 - balance layer 1 (Phil: base stats + glyphs + skills). The personal glyph paths changed (marksmen,
// assassins and bruisers keep Ravager - Physical Attack - in their onslaught slot; mages lose two Keenmind slots; melee tanks
// gain Ravager from Gold +2). A board banked under the old path is recomputed once at boot (marker glyphs.paths1022).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gp1022-'));
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
  const d=await call('/api/register',{name:'gp1022',pass:'password1'}); const id=d.profile.id; await delay(400); await stop(); await start(id);
  let tok=(await call('/api/login',{name:'gp1022',pass:'password1'})).token;
  const keys=['meridian','astra','grimsby'];
  await call('/api/admin/led-grant',{heroKeys:keys,unlock:keys,stars:5,maxGlyphs:true,px:99000000,heroXp:99000000},tok);
  await delay(500); await stop();
  const db=JSON.parse(fs.readFileSync(dbFile,'utf8')), g=db.users[id].glyphs;
  // the live situation: boards banked under the OLD paths (no Ravager attack past Green +1), migration marker absent
  g.boards.meridian.ascended['Physical Attack']={val:58,pct:false};
  g.boards.grimsby.ascended['Physical Attack']={val:58,pct:false};
  delete g.paths1022; fs.writeFileSync(dbFile,JSON.stringify(db)); await start(id);
  tok=(await call('/api/login',{name:'gp1022',pass:'password1'})).token; await delay(800);   // the boot write lands with the next save
  const after=JSON.parse(fs.readFileSync(dbFile,'utf8')).users[id].glyphs;
  if(process.env.DBG) console.log('DBG', after.paths1022, after.boards.meridian.ascensionIndex, JSON.stringify(after.boards.meridian.ascended).slice(0,400));
  const atk=k=>((after.boards[k].ascended||{})['Physical Attack']||{}).val||0;
  ok(atk('meridian')>600,'a marksman board banked under the old path is recomputed with its Ravager attack (banked '+atk('meridian')+')');
  ok(atk('grimsby')>600,'a bruiser board banked under the old path is recomputed with its Ravager attack (banked '+atk('grimsby')+')');
  ok(after.paths1022===1,'the migration marks the account once');
  const s=await call('/api/admin/snapshot?hero=meridian',null,tok), sn=s.snapshot||s;
  ok((sn.atkP||sn.atk||0)>900,'a max marksman builds a damage dealer\'s attack ('+Math.round(sn.atkP||sn.atk||0)+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_glyph_paths_1022.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
