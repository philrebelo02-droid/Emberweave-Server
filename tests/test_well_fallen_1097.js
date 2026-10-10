// v1097 - sweep 9 Oct #13 (real server on a free port + temp DB): THE STARLESS WELL - a hero who entered the fight but is missing
// from the final battle summary has FALLEN. Before, the summary loop skipped a missing hero, so its death was never recorded and it
// walked into the next fight at its old HP. A hero present in the summary still carries the HP it ended with (control).
// Asserts (non-zero exit). Control: AUD_SERVER=<a server.js copy whose Well module is the pre-fix one, in the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-wf1097-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[],n=0;
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms)), rid=()=>'wf'+(++n)+'-'+Date.now();
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:dbFile,SIM_WORKERS:'0'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'wf1097-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const heroes=Object.keys(require(path.join(root,'server/sim.js')).HERO_BASE).slice(0,5);
  await delay(400); await stop(); { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')), u=db.users[id]; u.led.px=113200;
    for(const k of heroes){ u.led.unlocked[k]=true; u.led.hero[k]=u.led.hero[k]||{xp:0,stars:1,pips:0,ref:0}; u.led.hero[k].xp=2000000; } fs.writeFileSync(dbFile,JSON.stringify(db)); } await start();
  const st=(await call('/api/well/state')).data; const g1=st.grid&&st.grid[1]; const row=g1?[0,1,2].find(r=>g1[r]&&g1[r].type==='fight')??[0,1,2].find(r=>g1[r]):null;
  ok(row!=null,'the Well is open with a first-column square ('+(st.error||'row '+row)+')');
  const s=await call('/api/well/start',{requestId:rid(),col:1,row,heroIds:heroes});
  ok(s.status===200&&s.data.attemptId,'the fight starts with five heroes ('+(s.data.error||'ok')+')');
  // the player watched a win (the witnessed result is the payout truth; the server's input-less replay loses, so the carry comes from the
  // player's summary): it names four of the five heroes (alive, 500 HP) plus an enemy row - the fifth is missing
  const missing=heroes[4], present=heroes.slice(0,4);
  const u=present.map(k=>[k,'ally',1,500,40]).concat([['foe','enemy',0,0,0]]);
  const r=await call('/api/well/resolve',{requestId:rid(),attemptId:s.data.attemptId,won:true,stars:3,digest:JSON.stringify({won:true,t:30,u}),inputLog:[]});
  ok(r.status===200&&r.data.won===true&&r.data.serverWon===false,'the witnessed win is accepted, the server replay differs ('+(r.data.error||'ok')+', serverWon '+r.data.serverWon+')');
  if(r.data.offer&&r.data.offer.length) await call('/api/well/buff',{requestId:rid(),id:r.data.offer[0].id||r.data.offer[0]});
  const H=(await call('/api/well/state')).data.heroes||{};
  ok(H[present[0]]&&H[present[0]].dead===false&&H[present[0]].hpFrac>0&&H[present[0]].hpFrac<1,'control: a hero in the summary keeps the HP it ended with ('+JSON.stringify(H[present[0]])+')');
  ok(H[missing]&&H[missing].dead===true&&H[missing].hpFrac===0,'the hero missing from the summary is marked fallen ('+JSON.stringify(H[missing])+')');
  let s2=null;   // the next guarded square (the map decides which rows of column 2 hold a fight)
  /* v1100: walk the REAL map - the next column does not always hold a guarded square in reach (the test failed about 2 runs in 3).
     Step over chest / other squares (a chest first: it cannot heal) until a guarded square is next to us, then try to fight it. */
  for(let hop=0;hop<6&&!s2;hop++){ const V=(await call('/api/well/state')).data, pos=V.pos, nc=pos.col+1, col=(V.grid||[])[nc]||[];
    const near=[0,1,2].filter(r=>col[r]&&Math.abs(r-pos.row)<=1), fight=near.find(r=>col[r].type==='fight'||col[r].type==='boss');
    if(fight!=null){ s2=await call('/api/well/start',{requestId:rid(),col:nc,row:fight,heroIds:heroes}); break; }
    const step=near.find(r=>col[r].type==='chest')??near.find(r=>col[r].type!=='spring')??near[0];   // a spring heals - last resort if(step==null) break;
    await call('/api/well/move',{requestId:rid(),col:nc,row:step}); }
  s2=s2||{status:0,data:{error:'no guarded square reachable'}};
  ok(s2.status!==200&&/fallen/.test(s2.data.error||''),'the fallen hero cannot walk into the next fight ('+(s2.data.error||s2.status)+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_well_fallen_1097.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.stack||e); process.exitCode=1; } finally { await stop(); } })();
