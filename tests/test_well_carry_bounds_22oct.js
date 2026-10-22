// v1214 - ChatGPT numeric audit 22 Oct 2026 (real server on a free port + temp DB): THE STARLESS WELL carries each hero's HP and
// energy to the next fight. When the server's replay differs from the result the player watched, the carry comes from the player's
// own summary, and its numbers were taken as sent: a non-number HP became NaN and energy had no 0..100 bar. Now HP is a finite
// fraction in 0.01..1 and energy is held to 0..100; a normal summary still carries what it says (control).
// Asserts (non-zero exit). Control: AUD_ROOT=<a 78c55869 checkout> (pre-fix Well) must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=process.env.AUD_ROOT||path.join(__dirname,'..'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-wcb-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[],n=0;
const ok=(c,m)=>{ if(process.env.AUD_ROOT&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms)), rid=()=>'wcb'+(++n)+'-'+Date.now();
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:dbFile,SIM_WORKERS:'0'},stdio:'ignore'});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'wcb-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const heroes=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5);
  await delay(400); await stop(); { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')), u=db.users[id]; u.led.px=113200;
    for(const k of heroes){ u.led.unlocked[k]=true; u.led.hero[k]=u.led.hero[k]||{xp:0,stars:1,pips:0,ref:0}; u.led.hero[k].xp=2000000; } fs.writeFileSync(dbFile,JSON.stringify(db)); } await start();
  const st=(await call('/api/well/state')).data; const g1=st.grid&&st.grid[1]; const row=g1?[0,1,2].find(r=>g1[r]&&g1[r].type==='fight')??[0,1,2].find(r=>g1[r]):null;
  ok(row!=null,'the Well is open with a first-column square ('+(st.error||'row '+row)+')');
  const s=await call('/api/well/start',{requestId:rid(),col:1,row,heroIds:heroes});
  ok(s.status===200&&s.data.attemptId,'the fight starts with five heroes ('+(s.data.error||'ok')+')');
  // a witnessed win the server replay does not reproduce, so the carry comes from this summary:
  // hero 0 sends a non-number HP and energy 9999, hero 1 sends energy -50, heroes 2-4 send a normal 500 HP / 40 energy (control)
  const u=[[heroes[0],'ally',1,'abc',9999],[heroes[1],'ally',1,500,-50]].concat(heroes.slice(2).map(k=>[k,'ally',1,500,40])).concat([['foe','enemy',0,0,0]]);
  const r=await call('/api/well/resolve',{requestId:rid(),attemptId:s.data.attemptId,won:true,stars:3,digest:JSON.stringify({won:true,t:30,u}),inputLog:[]});
  ok(r.status===200&&r.data.won===true&&r.data.serverWon===false,'the witnessed win is accepted and the server replay differs ('+(r.data.error||'ok')+', serverWon '+r.data.serverWon+')');
  const H=(await call('/api/well/state')).data.heroes||{};
  const h0=H[heroes[0]]||{}, h1=H[heroes[1]]||{}, h2=H[heroes[2]]||{};
  ok(typeof h0.hpFrac==='number'&&Number.isFinite(h0.hpFrac)&&h0.hpFrac>=0.01&&h0.hpFrac<=1,'a non-number HP in the summary carries as a finite fraction in 0.01..1 ('+JSON.stringify(h0)+')');
  ok(h0.energy===100,'energy 9999 in the summary is held to the full bar, 100 ('+h0.energy+')');
  ok(h1.energy===0,'energy -50 in the summary is held to 0 ('+h1.energy+')');
  ok(h2.dead===false&&h2.energy===40&&h2.hpFrac>0&&h2.hpFrac<1,'control: a normal summary carries the HP and energy it says ('+JSON.stringify(h2)+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_well_carry_bounds_22oct.js: '+pass+' checks passed, '+missed.length+' failed (root '+root+')');
} catch(e){ console.error('FAIL',e&&e.stack||e); process.exitCode=1; } finally { await stop(); } })();
