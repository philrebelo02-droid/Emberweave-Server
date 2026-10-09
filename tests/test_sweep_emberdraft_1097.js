// v1097 - sweep 9 Oct P0 #4 (Emberdraft): the server paid whatever place the client claimed. The match is played in the browser and
// cannot be replayed, so the place is paid in full only when the server's record of the run (the round reports on the attempt) says the
// same place for the claim's round and nothing contradicts it; otherwise the lowest paying tier (6 stamina) and a review case.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-v1097 server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ed1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[],admin=false;
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:admin?id:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editRaw(fn){ await delay(400); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const editDB=fn=>editRaw(db=>fn(db.users[id]));
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
let rq=0; const R=()=>'ed'+(rq++);
/* one match: start, move the server-side start an hour back (a real match's length), post the round reports live, claim */
async function match(cps,place,rounds,claimCps){
  await editDB(u=>{ if(u.led.edraft){ u.led.edraft.used=0; } u.led.stam={v:0,t:Date.now()}; });
  const st=await call('/api/emberdraft/start',{requestId:R()});
  if(!st.data.attemptId) throw Error('start failed: '+JSON.stringify(st.data));
  const att=st.data.attemptId;
  await editDB(u=>{ u.led.edraft.att.startedAt-=3600000; });
  if(cps&&cps.length) await call('/api/emberdraft/round',{attemptId:att,cps});
  const r=await call('/api/emberdraft/result',{requestId:R(),attemptId:att,place,rounds,cps:claimCps||[]});
  return r.data; }
/* an honest record: 8 players, you lose a little each round; others fall from round 9; you fall at `koRound` in place `pl`, or win */
function record(lastRound,pl){ const out=[]; let alive=8;
  for(let r=1;r<=lastRound;r++){ if(r>=9&&alive>1) alive=Math.max(pl||1,alive-1);
    const fell=pl&&r===lastRound; out.push({r,hp:Math.max(fell?-5:1,100-r*5),alive:fell?pl-1:(pl?Math.max(pl,alive):alive),pl:fell?pl:0,ms:r*60000}); }
  if(!pl) out[out.length-1].alive=1;
  return out; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'ed1097-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await editDB(u=>{ u.led.px=99000000; });
  ok(((await led()).playerLevel|0)>=25,'fixture: Emberdraft is open (level '+(await led()).playerLevel+')');
  /* the exploit: a script claims 1st with no record of the run */
  const a=await match(null,1,16);
  ok(a.ok===true&&a.stamina===6,'a 1st-place claim with no round record pays the lowest tier, 6 ('+a.stamina+')');
  ok(a.capped===true&&/review/i.test(a.note||''),'the reply says it was paid at the lowest tier and sent for review');
  await delay(400);
  ok((disk().feedback||[]).some(f=>/^emberdraft:/.test(f.signal||'')&&f.amount===30),'the case goes to review with 30 stamina at stake');
  /* a forged claim: the record says you fell 5th at round 14, the claim says 1st */
  const d=await match(record(14,5),1,14);
  ok(d.ok===true&&d.stamina===6,'a 1st-place claim the round record contradicts (5th) pays 6 ('+d.stamina+')');
  /* a claim worse than the lowest tier is not raised */
  const e=await match(record(12,7),7,12);
  ok(e.ok===true&&e.stamina===0,'7th still pays nothing ('+e.stamina+')');
  /* controls: an honest record pays the place in full */
  const b=await match(record(18,0),1,18);
  ok(b.ok===true&&b.stamina===36&&!b.capped,'control: 1st with a full round record pays 36 ('+b.stamina+' '+(b.note||'')+')');
  const c=await match(record(15,3).slice(0,10),3,15,record(15,3).slice(10));
  ok(c.ok===true&&c.stamina===24,'control: 3rd, the last reports riding along with the claim, pays 24 ('+c.stamina+' '+(c.note||'')+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_sweep_emberdraft_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
