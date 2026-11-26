'use strict';
/* v1458 (Phil 26 Nov: "fix that" - lockdown guild-06, the 7 "Skyfall war plays no fights" lines).
   A real Skyfall war records every real march on the match (who marched, who met it, the result, the seed and both lines'
   entry health), sends it with the match view in the simulator's log shape, serves Watch from the stored fight, keeps it
   across a restart (it is on the DB), and is bounded (a cap per war; a finished war's fights go when its reports come down).
   The client reads it: the board plays the real fights through the simulator's lane player, the lane report / Records /
   live view read the real log, and Watch fetches the stored fight. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const vm=require('node:vm');
const {spawn}=require('node:child_process');
const root=path.join(__dirname,'..');
let pass=0; const ok=(c,m)=>{ assert.ok(c,m); pass++; console.log('  ok  '+m); };

/* ---- 1. static: the server writes, sends and serves the record; the client reads it ---- */
const S=fs.readFileSync(path.join(root,'server.js'),'utf8');
const H=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
ok(/function warRecordFight\(t,m,rec\)/.test(S),'server: warRecordFight exists');
ok((S.match(/warRecordFight\(t,m,\{/g)||[]).length===3,'server: the assault route records all three outcomes (fight, overrun, capture)');
ok(/log:\(preReveal\|\|m\.state==='planning'\)\?\[\]:warFightLogView\(m,meGid,meId\)/.test(S),'server: warMatchView sends the real log');
ok(/if\(p==='\/api\/guild-war\/fight'\)/.test(S),'server: /api/guild-war/fight serves Watch');
ok(/const aIn=warHpIn\(attacker\.hpState\), dIn=warHpIn\(defender\.hpState\);\s*\/\*[^*]*\*\/\s*\r?\n\s*attacker\.hpState=mapBack/.test(S),'server: entry health is taken BEFORE the fight writes over it');
ok(/log:\(m&&Array\.isArray\(m\.log\)\)\?m\.log\.slice\(\):\[\]/.test(H),'client: renderSkyfall builds the real board with the real log');
ok(/function skyWarData\(\)/.test(H)&&/r=skyWarData\(\); if\(!hub\|\|!r\) return;/.test(H),'client: the lane report reads the real war');
ok(/r\.real \? await api\('\/api\/guild-war\/fight','POST',\{n\}\)/.test(H),'client: Watch fetches the stored real fight');
ok(/skySimReplay\(r, \{real:true, stage, tok\}\)/.test(H),'client: the real war plays through the simulator lane player');
ok(/async function skySimReplay\(r, opts\)/.test(H)&&/if\(REAL && !skyRealUnseen\(e\)\) return;/.test(H),'client: only fights not yet played on this device walk out');

/* ---- 2. unit: the cap and the pruning, run from the server's own source ---- */
{ const pick=name=>{ const i=S.indexOf('function '+name+'('); assert.ok(i>=0,name); let d=0,j=S.indexOf('{',i);
    for(let k=j;k<S.length;k++){ if(S[k]==='{') d++; else if(S[k]==='}'){ d--; if(!d) return S.slice(i,k+1); } } };
  let clock=1000;
  const ctx={ process:{env:{SKY_FIGHTS_MAX:'60'}}, warNow:()=>clock, Math, Object };
  vm.createContext(ctx);
  vm.runInContext('const SKY_FIGHTS_MAX=Math.max(50,+(process.env.SKY_FIGHTS_MAX||900));\n'+pick('warPruneFights')+'\n'+pick('warRecordFight')+'\nthis.R=warRecordFight;this.P=warPruneFights;',ctx);
  const t={ schedule:[{resultsUntil:5000},{resultsUntil:9000}], matches:{} };
  const old={ id:'m0', roundIndex:0, state:'finished', fights:[{n:1}] }, cur={ id:'m1', roundIndex:1, state:'live' };
  t.matches.m0=old; t.matches.m1=cur;
  for(let i=0;i<75;i++) ctx.R(t,cur,{lane:i%5});
  ok(cur.fights.length===60 && cur.fightN===75,'a war keeps at most SKY_FIGHTS_MAX fights (60 of 75 here) and still counts them');
  ok(Array.isArray(old.fights),'a finished war keeps its fights while its reports stand');
  clock=6000; ctx.R(t,cur,{lane:0});
  ok(!('fights' in old),'a finished war drops its fights once its reports come down (resultsUntil)');
  ok(Array.isArray(cur.fights),'the war being fought keeps its own'); }

/* ---- 2b. unit: the client's real-war cursors, run from the page's own source ---- */
{ const pick=name=>{ const i=H.indexOf('function '+name+'('); assert.ok(i>=0,name); let d=0,j=H.indexOf('{',i);
    for(let k=j;k<H.length;k++){ if(H[k]==='{') d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i,k+1); } } };
  const store={};
  const ctx={ JSON, Math, Array, localStorage:{ getItem:k=>store[k]||null, setItem:(k,v)=>{ store[k]=v; } },
    SKYSIM:{ running:false }, SKYFALL_VIEW:null };
  vm.createContext(ctx);
  vm.runInContext("const SKYREAL={ on:false, tok:0, mid:null, seen:null, queues:null, poll:null, live:false };\n"
    +['skySimSandbox','skyRealSeenLoad','skyRealSeenSave','skyRealSeen','skyRealUnseen','skyRealPrime','skyLaneCutoff','skyLineAlive','skyWarData'].map(pick).join('\n')
    +"\nthis.X={SKYREAL,skyRealPrime,skyRealUnseen,skyRealSeen,skyLaneCutoff,skyLineAlive,skyWarData};",ctx);
  const X=ctx.X;
  const log=[]; for(let n=1;n<=12;n++) log.push({n, lane:(n-1)%3, side:'A', a:'x', d:'y'});   /* lanes 0,1,2 hold 4 fights each */
  const r={ real:true, matchId:'gw1', state:'live', log, you:{citadels:[]}, foe:{citadels:[]} };
  ok(X.skyRealPrime(r)===true && X.SKYREAL.on,'a real war with fights is played on the board');
  ok(log.filter(e=>X.skyRealUnseen(e)).map(e=>e.n).join(',')==='7,8,9,10,11,12','first sight: the last two fights of each lane play, the rest are history');
  ok(X.skyLaneCutoff(r,0)===3 && X.skyLaneCutoff(r,4)===-1,'each lane\'s cursor sits on its last played fight; an unplayed lane has seen nothing');
  ctx.SKYFALL_VIEW=r; ok(X.skyWarData()===r,'the panels read the real war when it is on the board');
  ok(X.skyLineAlive({name:'z',alive:false},{})===true,'a line no played fight has killed still stands (the server\'s ending is not shown early)');
  X.skyRealSeen(log[9]); X.skyRealSeen(log[6]);
  ok(!X.skyRealUnseen(log[6]) && !X.skyRealUnseen(log[9]) && X.skyRealUnseen(log[11]),'a played fight does not walk out again');
  X.SKYREAL.seen=null; X.SKYREAL.mid=null; X.skyRealPrime(r);
  ok(!X.skyRealUnseen(log[9]) && X.skyRealUnseen(log[11]),'what was played is remembered on this device (reopening the war)');
  ok(X.skyRealPrime(Object.assign({},r,{log:[]}))===false && X.SKYREAL.on===false,'a war with no fights yet plays nothing'); }

/* ---- 3. live: a real war on a fixture server ---- */
async function port(){ const s=net.createServer(); await new Promise(r=>s.listen(0,'127.0.0.1',r)); const n=s.address().port; await new Promise(r=>s.close(r)); return n; }
async function run(){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ember-sky-real-1458-'));
  const db=path.join(temp,'db.json'), n=await port(), base=`http://127.0.0.1:${n}`;
  let child;
  const req=async(method,route,data,token)=>{ const res=await fetch(base+route,{method,headers:{...(token?{'x-token':token}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}); return res.json(); };
  const start=async adminId=>{
    child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,PORT:String(n),DB_FILE:db,ADMIN_IDS:adminId||'',NODE_ENV:'test',REG_PER_MIN:'200',REG_ACCOUNTS_PER_IP:'200'}});
    for(const t0=Date.now(); Date.now()-t0<60000; ){ if(child.exitCode!==null) throw Error('fixture server exited');
      try{ if((await fetch(base+'/health')).ok) return; }catch(_){} await new Promise(r=>setTimeout(r,100)); }
    throw Error('fixture server not ready'); };
  const stop=async()=>{ if(!child) return; const c=child; child=null; c.kill();
    const gone=()=>c.exitCode!==null||c.signalCode!==null, ex=new Promise(r=>{ if(gone()) r(); else c.once('exit',r); });
    await Promise.race([ex,new Promise(r=>setTimeout(r,2000))]); if(!gone()){ try{ c.kill('SIGKILL'); }catch(_){} await Promise.race([ex,new Promise(r=>setTimeout(r,10000))]); } };
  try{
    await start('');
    const dev=await req('POST','/api/register',{name:'skyAdmin58',pass:'password1'});
    await stop(); await start(dev.profile.id);
    const a=await req('POST','/api/register',{name:'skyAlpha58',pass:'password1'});
    const b=await req('POST','/api/register',{name:'skyBeta58',pass:'password1'});
    const keys=['vael','sylthaine','vireo','vex','gruel'];
    for(const u of [a,b]){
      const grant=await req('POST','/api/admin/led-grant',{userId:u.profile.id,unlock:keys,heroKeys:keys,heroXp:200000,px:900000},dev.token);
      assert.equal(grant.ok,true,JSON.stringify(grant));
      const guild=await req('POST','/api/guild/create',{name:u===a?'Sky Alpha':'Sky Beta'},u.token);
      assert.ok(guild.guild&&guild.guild.id,JSON.stringify(guild)); }
    const status=await req('GET','/api/guild-war/status',null,a.token);
    const t=status.tournament, now=Date.now();
    let opening=t.registrationOpensAt; if(now>=t.registrationLocksAt) opening=t.nextRegistrationOpensAt||opening+14*86400000;
    const warp=async at=>req('POST','/api/guild-war/debug-warp',{offsetMs:at-Date.now()},dev.token);
    assert.equal((await warp(Math.max(now,opening+60000))).state,'registration');
    const active=await req('GET','/api/guild-war/status',null,a.token);
    for(const u of [a,b]){
      assert.equal((await req('POST','/api/guild-war/register',{},u.token)).ok,true);
      assert.equal((await req('POST','/api/guild-war/place',{lane:0},u.token)).ok,true); }
    assert.equal((await warp(active.tournament.registrationLocksAt+60000)).state,'bracket');
    const first=(await req('GET','/api/guild-war/status',null,a.token)).tournament.bracket[0];
    await warp(first.schedule.lockAt+60000);
    const live=await req('GET','/api/guild-war/match',null,a.token);
    assert.equal(live.match&&live.match.state,'live',JSON.stringify(live).slice(0,200));
    ok(Array.isArray(live.match.log)&&live.match.log.length===0,'a live war with no march yet sends an empty log');
    const assault=await req('POST','/api/guild-war/assault',{fromLane:0,requestId:'sky58-a1'},a.token);
    assert.equal(assault.ok,true,JSON.stringify(assault).slice(0,200));
    const mineView=(await req('GET','/api/guild-war/status',null,a.token)).match;
    const foeView=(await req('GET','/api/guild-war/status',null,b.token)).match;
    ok(mineView.log.length===1,'the real march is on the board: 1 fight in the log');
    const e=mineView.log[0], f=foeView.log[0];
    ok(e.real===true && e.n===1 && e.lane===0,'the entry is a real fight, numbered, on its lane');
    ok(e.side==='A' && f.side==='B','side A is the viewer\'s guild - the attacker sees A, the defender B');
    ok(e.won===!!assault.won && f.won===e.won,'the recorded result is the result that was played');
    ok(e.rounds===(assault.result.rounds|0),'the recorded rounds are the fight\'s own');
    ok(Array.isArray(e.aTeam)&&e.aTeam.length===5&&Array.isArray(e.dTeam)&&e.dTeam.length===5&&e.aTeam.every(h=>h.k&&h.l>0),'both line-ups are on the row (key, level, stars) for Records');
    const myLine=mineView.you.citadels[0].defenders.find(d=>d.you), theirLine=mineView.foe.citadels[0].defenders[0];
    ok(e.a===myLine.name && e.d===theirLine.name,'names match the board\'s defender names (the panels tally by them)');
    ok(e.you===true && f.you===true,'both owners see it as their own fight');
    ok(typeof e.aHp==='number'&&typeof e.dHp==='number'&&e.aDown===!e.won&&e.dDown===!!e.won,'health left and who went down are recorded');
    const w=await req('POST','/api/guild-war/fight',{n:1},b.token);
    ok(w.ok===true && w.fight && w.fight.n===1,'Watch: the stored fight is served to a member of either guild');
    ok(w.won===e.won && (w.fight.seed>>>0)===(assault.replay.seed>>>0),'Watch plays the stored seed and the played result');
    ok(Array.isArray(w.fight.a.snaps)&&w.fight.a.snaps.length===5&&Array.isArray(w.fight.d.snaps)&&w.fight.d.snaps.length===5,'Watch gets both lines as they stood');
    ok(w.fight.a.hp.length===5&&w.fight.a.hp.every(x=>typeof x.hp==='number'&&typeof x.energy==='number'),'Watch gets the health each hero walked in with');
    ok(JSON.stringify(w.fight.a.snaps.map(h=>h.key))===JSON.stringify(assault.replay.attacker.map(h=>h.key)),'Watch\'s attacker is the line that marched');
    const miss=await req('POST','/api/guild-war/fight',{n:99},a.token);
    ok(!miss.ok && /not in this war/.test(miss.error||''),'a fight that is not in the war answers 404');
    const again=await req('POST','/api/guild-war/assault',{fromLane:0,requestId:'sky58-a1'},a.token);
    ok(again.replayed===true && again.match.log.length===1,'a replayed receipt does not record the fight twice');
    await new Promise(r=>setTimeout(r,500)); await stop(); await start(dev.profile.id);
    const after=(await req('GET','/api/guild-war/status',null,a.token)).match;
    ok(after.log.length===1 && after.log[0].won===e.won && after.log[0].rounds===e.rounds,'the fight survives a server restart (it is on the DB)');
    const disk=JSON.parse(fs.readFileSync(db,'utf8')).tournaments.current.matches;
    const dm=Object.values(disk).find(m=>Array.isArray(m.fights)&&m.fights.length);
    ok(dm && dm.fights[0].ah && !dm.fights[0].aTeam && JSON.stringify(dm.fights[0]).length<1200,'what is stored is the compact record (no copied line-ups), under 1.2 KB a fight');
  } finally { await stop(); try{ fs.rmSync(temp,{recursive:true,force:true}); }catch(_){} }
}
run().then(()=>{ console.log('test_skyfall_real_fights_1458: '+pass+' checks passed'); })
  .catch(e=>{ console.error('FAIL',e&&e.message||e); process.exitCode=1; });
