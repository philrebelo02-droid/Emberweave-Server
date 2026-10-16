// v1176 (Phil 16 Oct 2026, Developer Panel > Accounts > a player: "can you make it so that I can see their info? their level, diamonds,
// gold, top campaign/vault level etc etc"). GET /api/admin/player?id=<id>: dev only (isDev, the gate of Ban / +-diamonds), read-only,
// a whitelist from the SERVER's ledger. Asserts (non-zero exit):
//   - no token -> 403; a non-dev token -> 403 (server-side, not a hidden button); a POST from the dev -> 405 (read-only)
//   - the dev gets identity / progress / currencies / roster / account / reports / integrity, with the fixture's numbers
//   - the response holds NO secret: no hash / salt / iters / token / email / ip / device / save keys anywhere, and neither the
//     fixture's email address nor its password hash appear in the body
//   - the read changes nothing on disk
// Control: AUD_SERVER=<pre-v1176 server.js copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-pi1176-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[],admin='';
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100',SIM_WORKERS:'0',ADMIN_IDS:admin},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok,method){ const r=await fetch(base+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  const txt=await r.text(); let j={}; try{ j=JSON.parse(txt); }catch(_){} return {status:r.status,data:j,txt}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
const keysDeep=(o,out=[])=>{ if(o&&typeof o==='object') for(const k of Object.keys(o)){ out.push(k); keysDeep(o[k],out); } return out; };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const dev=(await call('/api/register',{name:'piDev',pass:'password1'})).data; admin=dev.profile.id;
  const P=(await call('/api/register',{name:'piPlayer',pass:'password1'})).data, pid=P.profile.id;
  await call('/api/ledger',null,P.token);   // the player opens the game once: their ledger exists
  await delay(500); await stop();
  { const db=disk(), u=db.users[pid];
    u.email='secret.player@example.com'; u.rank=37; u.bestRank=12; u.coins=4321; u.dust=777;
    Object.assign(u.led,{gems:12345,gold:678901,px:250000,stamItems:3,guildCoins:55});
    u.led.camp.cleared=63; u.led.portals={elite:{cleared:14,stars:{},att:null,runs:{}}};
    u.led.purchases=[{t:Date.now()-1000,id:'d1200',usd:9.99,ref:'prebeta-free',free:true},{t:Date.now(),id:'cluster',usd:4.99,ref:'prebeta-free',free:true}];
    delete u.led.patron;   // rebuilt from the purchases on first sight (patronState)
    u.led.battleIncidents=[{t:Date.now(),stage:'2-5',mode:'normal',why:'digest-mismatch'}];
    u.flag={reason:'test flag',t:Date.now(),gems:0,gold:0};
    db.dungeonProgress=db.dungeonProgress||{}; db.dungeonProgress[pid]={accountId:pid,currentFloor:9,highestClearedFloor:8,vaultStatus:'active',claimedFloors:{},sweep:{},activeAttempt:null,lastTeamHeroIds:[],version:1};
    db.feedback=(db.feedback||[]).concat([{id:'FB-a',userId:pid,name:'piPlayer',kind:'bug',text:'a bug',t:Date.now()-5000,received:false,device:'UA-SECRET-DEVICE'},
      {id:'FB-b',userId:pid,name:'piPlayer',kind:'suggestion',text:'an idea',t:Date.now()-2000,received:false},
      {id:'FB-c',userId:pid,name:'piPlayer',kind:'cheat',signal:'gems',text:'cheat signal',t:Date.now(),received:false}]);
    fs.writeFileSync(dbFile,JSON.stringify(db)); }
  await start();
  const D=(await call('/api/login',{name:'piDev',pass:'password1'})).data.token, T=(await call('/api/login',{name:'piPlayer',pass:'password1'})).data.token;
  const before=fs.readFileSync(dbFile,'utf8');
  // ---- the gate is the server's ----
  let r=await call('/api/admin/player?id='+pid,null,null);
  ok(r.status===403,'no token -> 403 ('+r.status+')');
  r=await call('/api/admin/player?id='+pid,null,T);
  ok(r.status===403&&!r.data.player,'a non-dev token -> 403 and no player data ('+r.status+')');
  r=await call('/api/admin/player?id='+admin,null,T);
  ok(r.status===403,'a non-dev cannot read the dev account either');
  r=await call('/api/admin/player?id='+pid,{},D,'POST');
  ok(r.status===405,'read-only: a POST is refused ('+r.status+')');
  r=await call('/api/admin/player?id=nope',null,D);
  ok(r.status===404,'an unknown id -> 404');
  // ---- the dev gets the fields ----
  r=await call('/api/admin/player?id='+pid,null,D);
  const p=r.data.player||{}, I=p.identity||{}, G=p.progress||{}, C=p.currencies||{}, R=p.roster||{}, A=p.account||{}, X=p.integrity||{};
  ok(r.status===200&&r.data.ok&&p.ledger===true,'a dev token -> 200 with the player ('+r.status+')');
  ok(I.id===pid&&I.name==='piPlayer'&&I.signedIn===true&&I.guest===false&&I.hasEmail===true&&I.dev===false&&I.created>0,'identity: id, name, signed in, has email (yes/no only), dev flag');
  ok(G.level>1&&G.xp===250000,'progress: player level '+G.level+' and XP');
  ok(G.campaign&&G.campaign.normal.cleared===63&&G.campaign.normal.stage==='7-3'&&G.campaign.elite.cleared===14&&G.campaign.elite.stage==='2-4'&&G.campaign.veteran.cleared===0,'progress: top Normal 7-3 / Elite 2-4 / Veteran none');
  ok(G.vaultFloor===8&&G.arenaRank===37&&G.bestArenaRank===12,'progress: Aether Vault floor 8, arena rank #37 (best #12)');
  ok(G.patron&&G.patron.egp>=1&&typeof G.templeLevel==='number','progress: Patron level (EGP '+(G.patron&&G.patron.egp)+') and Temple level');
  ok(C.gems===12345&&C.gold===678901&&C.emberRoasts===3&&C.forgeDust===777&&C.arenaCoins===4321&&C.guildCoins===55&&C.stamina>0,'currencies: diamonds, gold, stamina, Ember Roasts, Forge Dust, arena / guild coins');
  ok(R.heroes>=1&&Array.isArray(R.top)&&R.top.length>=1&&R.top.length<=5&&R.top.every(h=>h.level>=1&&h.stars>=1&&h.power>0)&&R.teamPower>0,'roster: hero count '+R.heroes+', team power '+R.teamPower+', top heroes with level / stars / power');
  ok(A.packs===2&&A.freePacks===2&&A.plans===1&&A.diamondsBought===1200,'account: packs 2, free packs 2, plans 1, diamonds bought 1,200');
  ok(p.reports&&p.reports.sent===2&&p.reports.lastAt>0,'reports: 2 sent (the cheat signal is not one), latest time');
  ok(X.flag&&X.flag.reason==='test flag'&&X.cheatSignals===1&&X.battleIncidents===1,'integrity: flag, cheat signals, battle incidents');
  // ---- no secrets ----
  const ks=keysDeep(r.data), bad=ks.filter(k=>/^(hash|salt|iters|token|tokens|email|pass|password|ip|ips|device|deviceId|devices|save|saveBlob|emailChange|gid)$/i.test(k));
  ok(bad.length===0,'no secret keys in the response ('+(bad.join(',')||'none')+')');
  const hash=disk().users[pid].hash||'';
  ok(!r.txt.includes('secret.player@example.com')&&!(hash&&r.txt.includes(hash))&&!r.txt.includes('UA-SECRET-DEVICE')&&!r.txt.includes(T),'the email, password hash, device string and session token never appear in the body');
  await delay(600);
  ok(fs.readFileSync(dbFile,'utf8')===before,'the read wrote nothing to disk');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_admin_player_info_1176.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
