// v1376 (Phil 12 Nov: "Bulletin is good"; "Players or 'guilds' for skyfall or guild raid"; "The rankings should show top 25, then show a back
// or Beck button on the bottom to open next 25 going until 100 max"). GET /api/rankings?board=<id>: every board answers its top 100, sorted,
// from the server's own records, with the caller's own place; guild boards list guilds; bots / banned / deleting accounts are left out
// (Arena keeps its bot ladder); Emberdraft (no lasting record) answers its reason; a board is built in under a second with thousands of accounts.
// Real server on a free port + temp DB (accounts registered, then their records written into the DB file).
// CONTROL: AUD_SERVER=<decbb933 server.js copied into the repo root> must FAIL (the route is missing).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-bb1376-'));
const dbFile=path.join(dir,'db.json'), delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
let port,base,child,checks=0,fails=0; const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'},stdio:'ignore',windowsHide:true});
  for(const t0=Date.now();Date.now()-t0<90000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100); } throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; }
async function call(route,tok){ const r=await fetch(base+route,{headers:{'x-token':tok||''}}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const sortedDesc=(rows,f)=>rows.every((r,i)=>i===0||f(rows[i-1])>=f(r));
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const tag=Date.now().toString(36).slice(-5), names=['Ash','Birch','Cedar','Dune','Elm','Fern','Gale','Hollow'].map(n=>n+tag), tok={};
  for(const n of names){ const r=await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:n,pass:'password1'})}).then(r=>r.json()); tok[n]=r.token; }
  for(const n of names) await call('/api/ledger',tok[n]);   // builds each ledger
  await delay(600); await stop();
  const db=JSON.parse(fs.readFileSync(dbFile,'utf8')), byName={}; for(const u of Object.values(db.users)) if(names.includes(u.name)) byName[u.name]=u;
  ok(names.every(n=>byName[n]&&byName[n].led&&byName[n].led.migratedAt),'8 accounts registered, each with a ledger');
  const [A,B,C,D,E,F,G,H]=names.map(n=>byName[n]);
  // Campaign: A 45, B 30, C 12, D 0 (unranked); E banned at 99, F pending deletion at 98, an NPC with a ledger at 97
  A.led.camp.cleared=45; B.led.camp.cleared=30; C.led.camp.cleared=12; D.led.camp.cleared=0; E.led.camp.cleared=99; F.led.camp.cleared=98;
  A.led.portals={elite:{cleared:20},veteran:{cleared:10}};
  E.bannedUntil=Date.now()+86400000*30; F.delReq={wipeAt:Date.now()+86400000*5,at:Date.now()};
  const npc=JSON.parse(JSON.stringify(G)); npc.id='bot_bb_npc'; npc.name='BotLedger'+tag; npc.isNpc=true; npc.led.camp.cleared=97; npc.led.tower={floor:999}; db.users[npc.id]=npc;
  // Vault: B 60 (complete=no), A 20, C 100 complete
  db.dungeonProgress=db.dungeonProgress||{}; db.dungeonProgress[B.id]={highestClearedFloor:60,vaultStatus:'active'}; db.dungeonProgress[A.id]={highestClearedFloor:20,vaultStatus:'active'}; db.dungeonProgress[C.id]={highestClearedFloor:100,vaultStatus:'complete'}; db.dungeonProgress[E.id]={highestClearedFloor:100,vaultStatus:'complete'};
  // Spire: C 40, A 15
  C.led.tower={floor:40,trib:'',mig:0,srv:0}; A.led.tower={floor:15,trib:'',mig:0,srv:0};
  // Bonus stages: B 3 distinct, A 1
  B.led.bonus={done:{'1-3':{stars:3,at:1},'2-3':{stars:1,at:1},'3-3':{stars:2,at:1}},ts:0,att:null}; A.led.bonus={done:{'1-3':{stars:1,at:1}},ts:0,att:null};
  // Journal: H level ~ high + five-star heroes; A has Normal 45 -> 4 chapters (1 milestone), Elite 20 -> 2 chapters (0), Vault 20 (1), bonus 1 (1)
  const keys=Object.keys(H.led.unlocked).filter(k=>H.led.unlocked[k]);
  for(const k of keys){ H.led.hero[k].stars=5; H.led.hero[k].xp=5000000; } H.led.px=60000000;
  // Guilds: Iron (A,B; level 3), Oak (C; level 5), Ember (D,G; level 1); raid + Skyfall records
  const now=Date.now(), gmk=(id,name,level,members,raid)=>({id,name,level,exp:0,members:members.map(u=>u.id),leader:members[0].id,officers:[],reqs:[],log:[],created:now,raid});
  db.guilds=db.guilds||{};
  db.guilds.gIron=gmk('gIron','Iron'+tag,3,[A,B],{level:4,max:1,hp:1,kills:3,contrib:{[A.id]:500},used:{},day:''});
  db.guilds.gOak=gmk('gOak','Oak'+tag,5,[C],{level:2,max:1,hp:1,kills:1,contrib:{[C.id]:90000},used:{},day:''});
  db.guilds.gEmb=gmk('gEmb','Ember'+tag,1,[D,G],null);
  db.guilds.gEmpty={id:'gEmpty',name:'Empty'+tag,level:7,members:[],leader:null,reqs:[],log:[]};
  A.guildId='gIron'; B.guildId='gIron'; C.guildId='gOak'; D.guildId='gEmb'; G.guildId='gEmb';
  db.tournaments=db.tournaments||{}; db.tournaments.history=db.tournaments.history||{};
  const who=g=>({guildId:g,name:g,seed:1,banner:null});
  db.tournaments.history['2026-W40']={weekKey:'2026-W40',id:'gw_x',endedAt:now,championGuildId:'gEmb',champion:who('gEmb'),entrants:[],
    rounds:[{name:'SF',matches:[{a:who('gEmb'),b:who('gOak'),winnerGuildId:'gEmb',towers:{a:5,b:2}},{a:who('gIron'),b:who('gGone'),winnerGuildId:'gIron',towers:{a:3,b:1}}]},
            {name:'F',matches:[{a:who('gEmb'),b:who('gIron'),winnerGuildId:'gEmb',towers:{a:4,b:4}}]}]};
  // 3,000 extra players (load + paging to 100): campaign 1..25, ledgers cloned from D
  const N=3000; for(let i=0;i<N;i++){ const u=JSON.parse(JSON.stringify(D)); u.id='bbfake'+i; u.name='Fake'+String(i).padStart(4,'0'); u.guildId=null; delete u.login; delete u.hash; delete u.salt; delete u.email; u.gid=undefined;
    u.led.camp.cleared=1+(i%25); u.led.tower={floor:1+(i%7),trib:'',mig:0,srv:0}; db.users[u.id]=u; }
  fs.writeFileSync(dbFile,JSON.stringify(db)); await start();
  const get=async(board,who)=>(await call('/api/rankings?board='+board,tok[who||names[0]]));
  // --- every board answers
  const boards=['campaign','vault','arena','emberdraft','guildraid','skyfall','spire','bonus','power','guilds','journal'];
  const res={}; for(const b of boards){ res[b]=await get(b); ok(res[b].status===200&&res[b].data.ok&&Array.isArray(res[b].data.rows),b+': answers 200 with rows ('+((res[b].data.rows||[]).length)+')'); }
  ok((await call('/api/rankings?board=campaign','')).status===401,'needs sign-in');
  ok((await get('nonsense')).status===400,'an unknown board is refused');
  // --- campaign: sorted, top order, bots / banned / deleting absent, paging covers 100
  let rows=res.campaign.data.rows||[];
  ok(rows.length===100,'campaign: 100 rows for four pages of 25 (got '+rows.length+')');
  ok(rows[0]&&rows[0].name===A.name&&rows[1].name===B.name,'campaign: '+A.name+' (45) first, '+B.name+' (30) second (got '+(rows[0]&&rows[0].name)+')');
  ok(rows.map(r=>r.rank).join()===rows.map((_,i)=>i+1).join(),'campaign: ranks run 1..100');
  ok(sortedDesc(rows,r=>r.value),'campaign: sorted by stage, highest first');
  ok(!rows.some(r=>r.name===E.name||r.name===F.name||r.name===npc.name),'campaign: banned, deleting and NPC accounts are absent');
  ok(!rows.some(r=>/^bot_|isNpc/.test(r.name))&&!rows.some(r=>r.npc),'campaign: no bot rows');
  ok(res.campaign.data.me&&res.campaign.data.me.rank===1&&res.campaign.data.me.value===45,'campaign: my rank pinned (#1, 45)');
  const meB=(await get('campaign',names[1])).data.me; ok(meB&&meB.value===30&&meB.rank===2,'campaign: B is #2 with 30 (got '+JSON.stringify(meB)+')');
  const meD=(await get('campaign',names[3])).data.me; ok(meD===null,'campaign: a player with no stage cleared is not on the board (me null)');
  const meC=(await get('campaign',names[2])).data.me; ok(meC&&meC.rank>100,'campaign: C (12) ranks outside the top 100 (#'+(meC&&meC.rank)+')');
  // --- vault
  rows=res.vault.data.rows; ok(rows.map(r=>r.name).join()===[C.name,B.name,A.name].join(),'vault: C (100 complete), B (60), A (20); banned E absent');
  ok(res.vault.data.me&&res.vault.data.me.rank===3&&res.vault.data.me.value===20,'vault: my rank #3');
  // --- spire: NPC floor 999 absent
  rows=res.spire.data.rows; ok(rows[0]&&rows[0].name===C.name&&rows[0].value===40,'spire: C first on floor 40 (NPC with floor 999 absent)'); ok(sortedDesc(rows,r=>r.value)&&rows.length===100,'spire: sorted, 100 rows');
  // --- bonus
  rows=res.bonus.data.rows; ok(rows.map(r=>r.name+':'+r.value).join()===[B.name+':3',A.name+':1'].join(),'bonus: B 3 distinct stages, A 1');
  // --- power
  rows=res.power.data.rows; ok(rows.length===100&&sortedDesc(rows,r=>r.value)&&rows[0].value>0,'power: 100 rows sorted by top-5 card power (top '+(rows[0]&&rows[0].value)+')');
  ok(rows[0].name===H.name,'power: H (every hero five-star, high level) is first');
  ok(res.power.data.me&&res.power.data.me.value>0&&res.power.data.me.rank>=2,'power: my rank and value ('+JSON.stringify(res.power.data.me)+')');
  // --- journal
  rows=res.journal.data.rows; ok(rows[0]&&rows[0].name===H.name&&rows[0].value>rows[rows.length-1].value,'journal: H has the most milestones ('+(rows[0]&&rows[0].value)+' of '+res.journal.data.of+')');
  ok(res.journal.data.me&&res.journal.data.me.value===3,'journal: A has 3 milestones (Normal 4 chapters, Vault 20, 1 bonus stage) (got '+JSON.stringify(res.journal.data.me)+')');
  // --- guild boards list guilds
  ok(res.guilds.data.guild&&res.guildraid.data.guild&&res.skyfall.data.guild,'guild boards say they are guild boards');
  rows=res.guilds.data.rows; ok(rows.map(r=>r.name).join()===['Oak'+tag,'Iron'+tag,'Ember'+tag].join(),'guilds: Oak (L5), Iron (L3), Ember (L1); the empty guild absent');
  ok(rows[1].count===2&&rows[1].level===3&&rows[1].cap===40,'guilds: level, members and cap on a row');
  ok(res.guilds.data.me&&res.guilds.data.me.rank===2&&res.guilds.data.me.name==='Iron'+tag,'guilds: my guild rank #2');
  rows=res.guildraid.data.rows; ok(rows.map(r=>r.name).join()===['Iron'+tag,'Oak'+tag].join(),'guild raid: Iron (3 bosses) over Oak (1 boss, more damage); Ember (no raid) absent');
  ok(res.guildraid.data.me&&res.guildraid.data.me.rank===1,'guild raid: my guild #1');
  rows=res.skyfall.data.rows; ok(rows.map(r=>r.name+':'+r.titles+'/'+r.value).join()===['Ember'+tag+':1/2','Iron'+tag+':0/1','Oak'+tag+':0/0'].join()&&rows[2].towers===2,'skyfall: Ember (title, 2 wins), Iron (1 win), Oak (0 wins, 2 citadels felled); a deleted guild absent ('+rows.map(r=>r.name+':'+r.titles+'/'+r.value).join()+')');
  ok(res.skyfall.data.me&&res.skyfall.data.me.rank===2,'skyfall: my guild #2');
  ok((await get('guilds',names[7])).data.me===null,'guilds: a player with no guild has no guild rank');
  // --- arena keeps its bot ladder
  rows=res.arena.data.rows; ok(rows.length===100&&rows.some(r=>r.npc)&&rows[0].rank===1,'arena: the ladder (bots included) from rank 1');
  ok(res.arena.data.me&&res.arena.data.me.rank>5000,'arena: my arena rank (#'+(res.arena.data.me&&res.arena.data.me.rank)+')');
  // --- emberdraft has no source
  ok(res.emberdraft.data.rows.length===0&&res.emberdraft.data.reason==='no-record','emberdraft: empty with reason "'+res.emberdraft.data.reason+'"');
  // --- cache + build time with 3,000+ players
  ok((res.power.data.buildMs|0)<1500&&(res.campaign.data.buildMs|0)<1500,'build time with '+(N+8)+' players: campaign '+res.campaign.data.buildMs+' ms, power '+res.power.data.buildMs+' ms, journal '+res.journal.data.buildMs+' ms');
  const again=await get('campaign'); ok(again.data.builtAt===res.campaign.data.builtAt,'a second read inside a minute is the cached board');
  // --- server Journal thresholds = the client's BB_TRACKS
  const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8'), i0=html.indexOf('const BB_TRACKS=');
  const tracks=i0<0?[]:JSON.parse(html.slice(i0+16,html.indexOf('];',i0)+1)); const srv=fs.readFileSync(path.join(root,srvFile),'utf8');
  const m=srv.match(/const BB_JOURNAL_TRACKS=\[([\s\S]*?)\];/); let st=[]; try{ st=m?JSON.parse('['+m[1].replace(/'/g,'"')+']'):[]; }catch(e){}
  ok(st.length>0&&st.every(([n,th])=>{ const c=tracks.find(t=>t[0]===n); return c&&JSON.stringify(c[1])===JSON.stringify(th); }),'journal: the server tracks use the client BB_TRACKS thresholds ('+st.length+' tracks)');
} catch(e){ console.error('ERROR',e&&e.stack||e); fails++; } finally{ await stop(); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){}
  console.log('test_hunt_bulletin_rankings.js: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed (server '+srvFile+')'); if(fails) process.exitCode=1; } })();
