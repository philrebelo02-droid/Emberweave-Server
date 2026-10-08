// v1054 (Phil 7 Oct 2026: "well temper should be item wide / not hero speciifc" / "vex and carn have the same item but different
// temper" / "this isnt right"): Temper belongs to the ITEM TYPE, account-wide. Real server on a free port + temp DB.
//  - a save from before v1054 (two copies of one item at Temper 5 and 4, on two heroes) shows BOTH at 5 (the highest - nothing lost);
//  - tempering one copy moves every copy of that type (same Temper, same bar), and the dust is paid once;
//  - Forge Resonance counts the type once, not once per copy;
//  - a newly crafted copy arrives at its type's Temper; a different item type is untouched (control).
// Asserts (non-zero exit). Control: AUD_SERVER=<the v1053 server.js copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tt-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
async function editDB(fn){ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'tt-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const cat=JSON.parse(fs.readFileSync(path.join(root,'server','gear-catalog.json'),'utf8')).items;
  const grey=cat.filter(d=>d.quality==='Grey'); const A=grey[0], B=grey.find(d=>d.slot!==A.slot)||grey[1];
  let h1,h2; const now=Date.now();
  await editDB(u=>{ const un=Object.keys(u.led.unlocked||{}).filter(k=>u.led.unlocked[k]); h1=un[0]; h2=un[1];
    u.dust=100000;
    u.gear={revision:1,fragments:{},subs:{},seq:10,active:{},
      items:{ q1:{d:A.id,temper:5,prog:2,dustSpent:400,bound:true,createdAt:now}, q2:{d:A.id,temper:4,prog:7,dustSpent:300,bound:true,createdAt:now},
              q3:{d:B.id,temper:2,prog:0,dustSpent:50,bound:true,createdAt:now} },
      equipped:{ [h1]:{[A.slot]:'q1',[B.slot]:'q3'}, [h2]:{[A.slot]:'q2'} } }; });
  ok(h1&&h2&&h1!==h2,'fixture: two owned heroes ('+h1+', '+h2+') wear the same item '+A.name);
  let st=(await call('/api/gear/state')).data;
  ok(st.items.q1.temper===5&&st.items.q2.temper===5,'an old save shows both copies at the type\'s highest Temper (got '+st.items.q1.temper+' / '+st.items.q2.temper+')');
  ok(st.items.q1.prog===st.items.q2.prog,'both copies share one temper bar ('+st.items.q1.prog+' / '+st.items.q2.prog+')');
  ok(st.items.q3.temper===2,'CONTROL: another item type keeps its own Temper ('+st.items.q3.temper+')');
  ok(st.resonance.total===7,'Resonance counts each equipped TYPE once: 5 + 2 = 7 (got '+st.resonance.total+')');
  const dust0=st.dust;
  const t=await call('/api/gear/temper',{itemId:'q2',uses:60,expectedRevision:st.revision});
  ok(t.data.ok===true&&t.data.levelsGained>=1,'tempering the second copy works ('+(t.data.error||'+'+t.data.levelsGained+' levels')+')');
  st=(await call('/api/gear/state')).data;
  ok(st.items.q1.temper===st.items.q2.temper&&st.items.q1.temper===t.data.temper,'tempering one copy moved EVERY copy ('+st.items.q1.temper+' / '+st.items.q2.temper+')');
  ok(dust0-st.dust===t.data.dustSpent,'the dust was paid once ('+t.data.dustSpent+')');
  ok(st.items.q3.temper===2,'CONTROL: the other type did not move');
  ok(st.temperByType&&st.temperByType[A.id]&&st.temperByType[A.id].temper===t.data.temper,'the state carries the type record');
  await editDB(u=>{ u.gear.fragments[A.frag]=10; });
  st=(await call('/api/gear/state')).data;
  const c=await call('/api/gear/craft',{gearId:A.id,expectedRevision:st.revision});
  ok(c.data.ok===true,'a third copy is crafted ('+(c.data.error||c.data.crafted)+')');
  st=(await call('/api/gear/state')).data;
  ok(st.items[c.data.crafted].temper===st.items.q1.temper,'a new copy arrives at its type\'s Temper ('+st.items[c.data.crafted].temper+')');
  console.log('test_temper_type_1054.js: '+pass+' checks passed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
