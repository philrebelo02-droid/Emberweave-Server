// v1024 probe (Phil 4 Oct: "all attack speed in the game should increase attack/crit animation speed" / "which in turn syncs with
// the damage dealt"). Runs real fights in the headless engine and, for every auto-attack, records the swing's attack-speed factor
// (u._atkSpdMul) and when its blow is scheduled to land. Asserts: Zahri's factor climbs with Desert Momentum, Vael's rises under
// Bloodthirst, and every auto's fuse = clip contact time / factor (+ flight). Exit 1 on any failure.
// Usage: node tests/test_atkspd_clip_1024.js (control on the v1023 page fails 4)
const path=require('path'), root=path.join(__dirname,'..');
const host=require(path.join(root,'server','sim-host.js')).load(path.join(root,'emberweave-heroes.html'));
const SB=host.sandbox, vm=require('vm');
vm.runInContext('autoUlt=true; globalThis.__bt=function(){ return battleTime; }; globalThis.__fx=function(){ return {BATTLE_PACE, clipDur}; };',host.ctx);
const LOG={}; let bad=0;
const fs0=SB.fuseStrike;
SB.fuseStrike=function(u,tgt,clip,go,extra,rate){
  const before=(u._fuse||[]).length; const r=fs0.apply(this,arguments);
  if(u&&u.key&&rate!=null){ const {BATTLE_PACE,clipDur}=SB.__fx();
    const want=clipDur(clip)*(clip&&clip.relFrac!=null?clip.relFrac:0.5)*BATTLE_PACE/(rate||1)+(extra||0);
    const F=(u._fuse||[])[before]; const got=F?F.t:0;
    const L=LOG[u.key]||(LOG[u.key]={swings:0,max:1,min:9,fuseMismatch:0,lockOk:0,lockBad:0});
    L.swings++; L.max=Math.max(L.max,rate); L.min=Math.min(L.min,rate);
    if(u.key==='vael'&&(u._critBuffT||0)>0){   /* Bloodthirst's own timer (Last Stand also sets _lifestealT) */ L.btN=(L.btN||0)+1; L.btMin=Math.min(L.btMin==null?9:L.btMin,rate); L.btCrit=Math.max(L.btCrit||0,(u._critBuffT>0?u._critBuffPct:0)); }
    if(want>0.02 && Math.abs(got-want)>1e-9){ L.fuseMismatch++; }
    // the swing's clip hold follows the same factor (capped just under the interval)
    const ai=(u._atkI0||u.atkInterval)/rate, hold=clip?((clip.hold||clipDur(clip))/rate):0.42, wantLock=Math.min(ai*0.95,hold);
    if(Math.abs((u._animLockT||0)-wantLock)<1e-9) L.lockOk++; else L.lockBad++; }
  return r; };
const fs=require('fs'),os=require('os'),net=require('net'),{spawn}=require('child_process'),delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,base;
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(admin,dbFile,port){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,ADMIN_IDS:admin||''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(child){ child.kill(); await delay(600); child=null; } }
const call=async(p,b,tok)=>{ const r=await fetch(base+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:b?JSON.stringify(b):undefined}); return r.json(); };
(async()=>{ const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-asprobe-')), dbFile=path.join(dir,'db.json'), port=await freePort(); base='http://127.0.0.1:'+port;
  const K1=['zahri','vael','grosk','lumi','astra'], K2=['brannus','yenna','sorrel','vulmar','aldren'], SNAP={};
  try{ await start('',dbFile,port);
    const d=await call('/api/register',{name:'asprobe',pass:'password1'}); await delay(400); await stop(); await start(d.profile.id,dbFile,port);
    const tok=(await call('/api/login',{name:'asprobe',pass:'password1'})).token;
    await call('/api/admin/led-grant',{heroKeys:[...K1,...K2],unlock:[...K1,...K2],stars:5,maxGlyphs:true,px:99000000,heroXp:99000000},tok);
    for(const k of [...K1,...K2]){ const r=await call('/api/admin/snapshot?spec=1&hero='+k,null,tok); const s=r.spec&&host.snapFromSpecs([r.spec]); if(!s||!s[0]) throw Error('no snapshot '+k); SNAP[k]=s[0]; }
  } finally { await stop(); }
  const A=K1.map(k=>SNAP[k]), B=K2.map(k=>SNAP[k]), cp=L=>L.map(x=>JSON.parse(JSON.stringify(x)));
  for(let n=0;n<6;n++){ if(n%2) host.auto(cp(B),cp(A),777+n); else host.auto(cp(A),cp(B),777+n); }
const chk=(c,m)=>{ console.log((c?'  ok   ':'  FAIL ')+m); if(!c) bad++; };
for(const k of Object.keys(LOG).sort()){ const L=LOG[k]; console.log(k.padEnd(10)+' swings '+String(L.swings).padStart(4)+'  factor '+L.min.toFixed(3)+'-'+L.max.toFixed(3)+'  fuse mismatches '+L.fuseMismatch+'  lock ok/bad '+L.lockOk+'/'+L.lockBad); }
chk(LOG.zahri&&LOG.zahri.max>1.2,'Zahri: Desert Momentum raises her swing factor above 1.2 ('+(LOG.zahri&&LOG.zahri.max.toFixed(3))+')');
chk(LOG.vael&&LOG.vael.max>1.15,'Vael: Bloodthirst raises his swing factor above 1.15 ('+(LOG.vael&&LOG.vael.max.toFixed(3))+')');
chk(LOG.vael&&LOG.vael.btN>0&&LOG.vael.btMin>=1.2-1e-9,'Vael: every swing under Bloodthirst runs at least 1.2x ('+(LOG.vael&&LOG.vael.btN)+' swings, lowest '+(LOG.vael&&LOG.vael.btMin)+')');
chk(LOG.vael&&LOG.vael.btCrit>=0.05-1e-9,'Vael: Bloodthirst carries its crit buff ('+(LOG.vael&&LOG.vael.btCrit)+')');
chk(Object.values(LOG).every(L=>L.fuseMismatch===0),'every auto lands at clip contact / factor (+ flight)');
chk(Object.values(LOG).every(L=>L.lockBad===0),'every swing hold = clip / factor, capped under the interval');
process.exit(bad?1:0); })().catch(e=>{ console.error(e); process.exit(1); });
