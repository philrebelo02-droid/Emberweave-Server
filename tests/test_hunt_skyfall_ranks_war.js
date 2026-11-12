// Grok bug hunt 12 Nov - Skyfall x guild ranks (v1372), Claude 04:29: an officer demoted mid-war, a member leaving during prep, two officers
// moving the same lane at once. Server over HTTP on a temp DB (same fixture as test_guild_ranks_1372: a planning match g1 vs g2).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),http=require('http'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-skyrank-')), dbFile=path.join(dir,'db.json');
let port,base,child,fails=0,checks=0;
const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100'},stdio:'ignore',windowsHide:true});
  for(const t0=Date.now();Date.now()-t0<60000&&child.exitCode===null;){ try{ if((await fetch(base+'/health')).ok) return; }catch(_){} await delay(100); } throw Error('no start'); }
async function stop(){ if(!child) return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); }
  if(child.exitCode===null&&child.signalCode===null) throw Error('server pid '+child.pid+' did not exit - no DB edit or restart'); child=null; await delay(300); }
let ipN=0;
async function call(route,data,tok,war){ const h={'Content-Type':'application/json',...(tok?{'x-token':tok}:{})}; if(war) h['x-forwarded-for']='10.8.'+((++ipN)>>8&255)+'.'+(ipN&255);
  const r=await fetch(base+route,{method:data?'POST':'GET',headers:h,body:data?JSON.stringify(data):undefined}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
/* a war POST whose body arrives in two halves, so something can happen between the route's first read and its write */
function slowWar(route,data,tok,between){ return new Promise((res,rej)=>{ const s=JSON.stringify(data), half=Math.floor(s.length/2);
  const req=http.request(base+route,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(s),'x-token':tok,'x-forwarded-for':'10.7.0.'+(++ipN&255)}},r=>{ let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ let j={}; try{ j=JSON.parse(b); }catch(_){} res({status:r.statusCode,data:j}); }); });
  req.on('error',rej); req.write(s.slice(0,half)); setTimeout(async()=>{ try{ await between(); }catch(e){} req.end(s.slice(half)); },400); }); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const names=['skLead','skOffA','skOffB','skMem','skNed','skZed','skQuin'];
  const U={}; for(const n of names){ U[n]=(await call('/api/register',{name:n+Date.now().toString(36).slice(-4),pass:'password1'})).data; }
  const id=n=>U[n].profile.id;
  for(const n of names) await call('/api/ledger',null,U[n].token);
  await call('/api/guild-war/status',null,U.skLead.token,true);
  await delay(500); await stop();
  const now=Date.now();
  { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.guilds=db.guilds||{};
    const g1m=['skLead','skOffA','skOffB','skMem','skNed'].map(id);
    db.guilds.g1={id:'g1',name:'Sky Hall',leader:id('skLead'),members:g1m,officers:[id('skOffA'),id('skOffB')],reqs:[],level:3,exp:0,motd:'',log:[],createdAt:now-86400000};
    db.guilds.g2={id:'g2',name:'Far Order',leader:id('skZed'),members:[id('skZed'),id('skQuin')],reqs:[],level:3,exp:0,motd:'',log:[],createdAt:now-86400000};
    for(const n of ['skLead','skOffA','skOffB','skMem','skNed']) db.users[id(n)].guildId='g1';
    for(const n of ['skZed','skQuin']) db.users[id(n)].guildId='g2';
    for(const n of names) if(db.users[id(n)].led) db.users[id(n)].led.px=1000;
    const t=db.tournaments.current, lanes=[0,1,2,3,4];
    const L=n=>({memberId:id(n),line:0,power:100,name:n});
    const side=(gid,nm,defs)=>({guildId:gid,name:nm,citadels:lanes.map(i=>({lane:i,key:'l'+i,destroyed:false,defenders:i===0?defs:[]})),unplaced:[]});
    t.state='bracket'; t.roundIndex=0; t.roundBase=3;
    t.entrants=[{guildId:'g1',name:'Sky Hall',banner:null,seed:1,powerPool:500,lines:['skLead','skOffA','skOffB','skMem','skNed'].map(L)},
                {guildId:'g2',name:'Far Order',banner:null,seed:2,powerPool:200,lines:['skZed','skQuin'].map(L)}];
    t.rounds=[{name:'F',matchIds:['gwm_sk']}];
    t.matches={gwm_sk:{id:'gwm_sk',tournamentId:t.id,roundIndex:0,state:'planning',aGuildId:'g1',bGuildId:'g2',revealAt:0,
      planningEndsAt:now+6*3600000,startsAt:now+6*3600000,endsAt:now+8*3600000,winnerGuildId:null,
      sides:{g1:side('g1','Sky Hall',['skLead','skOffA','skOffB','skMem','skNed'].map(L)),g2:side('g2','Far Order',['skZed','skQuin'].map(L))},assaults:{},eventLog:[],version:0}};
    fs.writeFileSync(dbFile,JSON.stringify(db)); }
  await start();
  const T={}; for(const n of names) T[n]=(await call('/api/login',{name:U[n].profile.name,pass:'password1'})).data.token;
  const st=async n=>(await call('/api/guild-war/status',null,T[n],true)).data;
  const board=async n=>{ const s=await st(n); const y=s.match&&s.match.you; return { total:y?y.citadels.reduce((a,c)=>a+(c.total|0),0):-1, lanes:y?y.citadels.map(c=>c.total|0):[], roster:(y&&y.roster)||[] }; };
  const who=(b,n)=>b.roster.find(r=>String(r.memberId)===String(id(n)));
  let b0=await board('skLead'); ok(b0.total===5&&b0.lanes[0]===5,'fixture: g1 holds 5 lines in Iron Gate ('+b0.lanes+')');
  let s=await st('skOffA'); ok(s.canArrange===true,'fixture: skOffA is an Officer (canArrange)');

  // ---- A. an officer demoted mid-war ----
  let r=await call('/api/guild-war/move-lane',{from:0,to:1},T.skOffA,true); ok(r.status===200&&r.data.moved===5,'A officer moves Iron Gate -> lane 1 ('+r.status+')');
  r=await call('/api/guild/rank/assign',{id:id('skOffA'),rankId:'member'},T.skLead); ok(r.status===200,'A leader demotes skOffA to Member mid-war');
  s=await st('skOffA'); ok(s.canArrange===false,'A the demoted officer\'s status says canArrange false');
  r=await call('/api/guild-war/move-lane',{from:1,to:0},T.skOffA,true); ok(r.status===403,'A demoted: move-lane refused ('+r.status+' '+(r.data.error||'')+')');
  r=await call('/api/guild-war/assign',{memberId:id('skNed'),lane:2},T.skOffA,true); ok(r.status===403,'A demoted: assign refused ('+r.status+')');
  r=await slowWar('/api/guild-war/move-lane',{from:1,to:3},T.skOffB,()=>call('/api/guild/rank/assign',{id:id('skOffB'),rankId:'member'},T.skLead));
  ok(r.status===403,'A demoted WHILE the move request was arriving: refused ('+r.status+' '+(r.data.error||'')+')');
  b0=await board('skLead'); ok(b0.lanes[1]===5&&b0.total===5,'A nothing moved by a demoted officer (lanes '+b0.lanes+')');
  r=await call('/api/guild-war/place',{lane:4},T.skOffA,true); ok(r.status===200,'A a demoted officer can still place their OWN lines ('+r.status+')');
  for(const n of ['skOffA','skOffB']) await call('/api/guild/rank/assign',{id:id(n),rankId:'officer'},T.skLead);

  // ---- C. two officers moving the same lane at once ----
  b0=await board('skLead'); const from=b0.lanes.findIndex(x=>x>=3);
  const [ra,rb]=await Promise.all([call('/api/guild-war/move-lane',{from,to:2},T.skOffA,true),call('/api/guild-war/move-lane',{from,to:3},T.skOffB,true)]);
  let b1=await board('skLead');
  ok([ra.status,rb.status].filter(x=>x===200).length===1,'C same lane at once: exactly one move wins ('+ra.status+'/'+rb.status+' '+(ra.data.error||rb.data.error||'')+')');
  ok(b1.total===5&&b1.lanes[from]===0,'C no line lost or doubled (total '+b1.total+', lanes '+b1.lanes+')');
  const [rc,rd]=await Promise.all([call('/api/guild-war/move-lane',{from:b1.lanes.findIndex(x=>x>=3),to:0},T.skOffA,true),call('/api/guild-war/assign',{memberId:id('skNed'),lane:4},T.skOffB,true)]);
  let b2=await board('skLead'); ok(rc.status===200&&rd.status===200&&b2.total===5&&who(b2,'skNed').lane===4,'C lane move + single assign at once: both land, Ned in lane 4, total '+b2.total+' (lanes '+b2.lanes+')');
  ok(b2.roster.length===5 && new Set(b2.roster.map(x=>x.memberId)).size===5,'C roster still lists 5 different members');

  // ---- B. a member leaving during prep ----
  r=await call('/api/guild/leave',{},T.skMem); ok(r.status===200,'B skMem leaves g1 during prep');
  b2=await board('skLead');
  ok(!who(b2,'skMem'),'B the departed member is gone from the officer roster ('+JSON.stringify(who(b2,'skMem')||null)+')');
  ok(b2.total===4,'B their line is gone from the towers (total '+b2.total+', lanes '+b2.lanes+')');
  r=await call('/api/guild-war/assign',{memberId:id('skMem'),lane:1},T.skOffA,true); ok(r.status===400,'B an officer cannot place a player who left ('+r.status+' '+(r.data.error||'')+')');
  const sm=await st('skMem'); ok(!sm.match,'B the leaver no longer sees g1\'s board');
  r=await call('/api/guild/request',{guildId:'g2'},T.skMem); r=await call('/api/guild/approve',{id:id('skMem')},T.skZed);
  r=await call('/api/guild-war/place',{lane:2},T.skMem,true);
  const bz=await board('skZed'), bl=await board('skLead');
  ok(!who(bl,'skMem') && bl.total===4,'B after joining the opponent, the leaver is not on g1\'s board (g1 total '+bl.total+')');
  ok(bz.total===2,'B ... and not added to g2\'s board mid-round either (g2 total '+bz.total+')');
  // ---- B2. a member removed (kick) during prep ----
  r=await call('/api/guild/kick',{id:id('skNed')},T.skLead); ok(r.status===200,'B2 the leader removes skNed during prep ('+r.status+')');
  const bk=await board('skOffA'); ok(!who(bk,'skNed')&&bk.total===3,'B2 the removed member is off the roster and the towers (total '+bk.total+', lanes '+bk.lanes+')');}catch(e){ console.error(e); fails++; } finally { console.log('skyfall ranks mid-war: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; try{ await stop(); }catch(e){ console.error(String(e)); process.exitCode=1; } try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){} } })();