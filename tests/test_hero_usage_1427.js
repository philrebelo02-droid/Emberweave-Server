// v1427 HERO USAGE (Soul Eater 19 Nov 2026: "Statistics showing which heroes are the most used would also be good ... This would help us
// control who we should nerf or level up, and who we should buff or rework"; Phil 20 Nov: "start building the statistics idea").
// 1) server/hero-usage.js: counting, pruning, the view's maths, the satellite report cleaning.
// 2) every battle route counts its fight (campaign normal/elite/veteran, province, arena + the defence, world map siege, vault).
// 3) a real server on a free port + temp DB: a real Arena fight is counted for the attacker (bots are never counted); the dev view
//    adds a satellite's report (internal link route); a non-admin gets 403; test accounts are left out.
// CONTROL: AUD_SERVER=<6da22a371 server.js copied into the repo root> must FAIL (no route, no hooks).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-hu1427-'));
const dbFile=path.join(dir,'db.json'), delay=ms=>new Promise(r=>setTimeout(r,ms)), SECRET='hu-test-secret';
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
let port,base,child,checks=0,fails=0; const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
async function start(extra){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',ACCOUNT_LINK_SECRET:SECRET,...(extra||{})},stdio:'ignore',windowsHide:true});
  for(const t0=Date.now();Date.now()-t0<90000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100); } throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; }
async function call(route,tok,bodyObj,headers){ const r=await fetch(base+route,{method:bodyObj?'POST':'GET',headers:{'x-token':tok||'','content-type':'application/json',...(headers||{})},body:bodyObj?JSON.stringify(bodyObj):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }

(async()=>{ try{
  // ---- 1) the module ----
  const HU=require(path.join(root,'server','hero-usage.js')), DB={};
  const known=k=>['ash','birch','cedar','dune','elm'].includes(k);
  ok(HU.note(DB,'2026-11-20','arena',['ash','birch','ash','zzz'],true,known)===true,'a fight is counted');
  ok(JSON.stringify(DB.heroUsage.days['2026-11-20'].arena)===JSON.stringify({f:[1,1],h:{ash:[1,1],birch:[1,1]}}),'one count per hero (a repeat and an unknown key are dropped), the win counted');
  HU.note(DB,'2026-11-20','arena',['ash','cedar'],false,known); HU.note(DB,'2026-11-20','normal',['ash'],true,known);
  ok(HU.note(DB,'2026-11-20','nosuchmode',['ash'],true,known)===false && HU.note(DB,'2026-11-20','arena',[],true,known)===false,'unknown modes and empty teams are not counted');
  let v=HU.view([{server:'1',days:DB.heroUsage.days}],'2026-11-20',7,'arena');
  const ash=v.heroes.find(r=>r.key==='ash');
  ok(v.fights===2&&v.wins===1&&ash.picks===2&&ash.wins===1&&ash.pickRate===1&&ash.winRate===0.5,'arena view: 2 fights, ash in both (100% pick rate), 50% win rate');
  ok(v.heroes[0].key==='ash','most used first');
  v=HU.view([{server:'1',days:DB.heroUsage.days}],'2026-11-20',7,'all');
  ok(v.fights===3&&v.heroes.find(r=>r.key==='ash').picks===3,'"all" adds campaign and arena');
  for(let i=0;i<40;i++) HU.note(DB,HU.dayMinus('2026-11-20',-1-i),'arena',['elm'],true,known);
  ok(Object.keys(DB.heroUsage.days).length===HU.HU_KEEP,'only the newest '+HU.HU_KEEP+' days are kept');
  const D2={}; HU.note(D2,'2026-11-01','arena',['dune'],true,known);
  ok(HU.view([{server:'1',days:D2.heroUsage.days}],'2026-11-20',7,'all').fights===0 && HU.view([{server:'1',days:D2.heroUsage.days}],'2026-11-20',30,'all').fights===1,'the day window is respected');
  const dirty={'2026-11-20':{arena:{f:['9',-3],h:{ok:[2,'1'],'bad<script>':[1,1],'__proto__':[5,5]}},evil:{f:[1,1],h:{}}},'not-a-day':{}};
  const c=HU.clean(dirty);
  ok(JSON.stringify(c)===JSON.stringify({'2026-11-20':{arena:{f:[9,0],h:{ok:[2,1]}}}}),'a satellite report is cleaned: numbers only, known modes, plain hero keys, real days ('+JSON.stringify(c)+')');

  // ---- 2) every battle route counts ----
  const srv=fs.readFileSync(path.join(root,srvFile),'utf8');
  for(const [re,what] of [[/heroUsageNote\(me,mode,a\.heroIds,won\)/,'campaign normal / elite / veteran'],[/heroUsageNote\(me,'province',a\.heroIds,won\)/,'province'],
    [/heroUsageNote\(me,'arena',mySnaps\.map\(s=>s\.key\),won\); if\(!opp\.isNpc\) heroUsageNote\(opp,'arenadef',opSnaps\.map\(s=>s\.key\),!won\)/,'arena attack + the defence it met'],
    [/heroUsageNote\(me,'siege',march\.heroIds,won\)/,'world map siege'],[/heroUsageNote\(me,'vault',a\.heroIds,won\)/,'aether vault'],
    [/function heroUsageNote\(u,mode,keys,won\)\{ try\{ if\(!u\|\|u\.isNpc\|\|testerTagged\(u\)\|\|isDev\(u\)\) return;/,'bots, test accounts and admins are never counted']])
    ok(re.test(srv),'counted: '+what);

  // ---- 3) the real server ----
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const tag=Date.now().toString(36).slice(-5), reg=async n=>(await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:n,pass:'password1'})}).then(r=>r.json()));
  const A=await reg('Hu'+tag), Adm=await reg('Ad'+tag), T=await reg('Tt'+tag);
  for(const x of [A,Adm,T]) await call('/api/ledger',x.token);
  await delay(600); await stop();
  let db=JSON.parse(fs.readFileSync(dbFile,'utf8')); const byName=n=>Object.values(db.users).find(u=>u.name===n);
  const ua=byName('Hu'+tag), ut=byName('Tt'+tag), uadm=byName('Ad'+tag);
  for(const u of [ua,ut]){ u.led.px=60000000; }   // level 10+: the Arena is open
  ut.role='tester';
  fs.writeFileSync(dbFile,JSON.stringify(db));
  await start({ADMIN_IDS:uadm.id});
  // a real Arena fight against a bot
  const fight=async tok=>{ const o=await call('/api/arena/opponents',tok); const opp=(o.data.opponents||[]).find(x=>x.isNpc)||(o.data.opponents||[])[0];
    if(!opp) return {status:0,data:{error:'no opponent '+JSON.stringify(o.data).slice(0,200)}};
    const st=await call('/api/arena/start',tok,{requestId:'s'+Math.random().toString(36).slice(2),oppId:opp.id});   /* v1450: the server fixes the fight first */
    if(!(st.data&&st.data.ok)) return st;
    return call('/api/arena/result',tok,{requestId:'r'+Math.random().toString(36).slice(2),oppId:opp.id,fightId:st.data.fightId}); };
  const r1=await fight(A.token); ok(r1.status===200&&r1.data&&r1.data.ok!==false,'a real Arena fight resolves ('+r1.status+' '+JSON.stringify(r1.data).slice(0,160)+')');
  const r2=await fight(T.token); ok(r2.status===200,'the test account fights too ('+r2.status+')');
  // the satellite route (link secret) and the dev view
  const today=Object.keys((await (async()=>{ await delay(300); return {}; })())); void today;
  const noSecret=await call('/api/internal/account/hero-usage','',{server:'2',days:{}});
  ok(noSecret.status===404,'the satellite route needs the link secret ('+noSecret.status+')');
  const dv0=await call('/api/dev/hero-usage?days=7&mode=arena',Adm.token);
  ok(dv0.status===200&&dv0.data.ok&&dv0.data.fights===1,'the dev view counts the one real Arena fight; the test account and the bot are left out (fights '+dv0.data.fights+')');
  ok(dv0.data.heroes&&dv0.data.heroes.length>0&&dv0.data.heroes.every(h=>h.picks===1),'each hero that fought has one pick ('+JSON.stringify(dv0.data.heroes).slice(0,200)+')');
  const day=dv0.data.to, key=dv0.data.heroes[0].key;
  const sat=await call('/api/internal/account/hero-usage','',{server:'2',days:{[day]:{arena:{f:[3,2],h:{[key]:[3,2]}}}}},{'x-link-secret':SECRET});
  ok(sat.status===200,'Server 2 reports its days ('+sat.status+')');
  const dv1=await call('/api/dev/hero-usage?days=7&mode=arena',Adm.token);
  const h1=dv1.data.heroes.find(h=>h.key===key);
  ok(dv1.data.fights===4&&h1.picks===4&&dv1.data.servers.includes('2'),'Server 1 adds Server 2: 4 fights, '+key+' 4 picks (servers '+JSON.stringify(dv1.data.servers)+')');
  const dvNo=await call('/api/dev/hero-usage',A.token); ok(dvNo.status===403,'a player cannot read it ('+dvNo.status+')');
  await stop();
  db=JSON.parse(fs.readFileSync(dbFile,'utf8'));
  ok(db.heroUsage&&db.heroUsage.days&&db.heroUsage.days[day]&&db.heroUsage.days[day].arena.f[0]===1&&db.satHeroUsage&&db.satHeroUsage['2'],'both are saved with the world');
}catch(e){ fails++; console.log('  FAIL '+(e&&e.stack||e)); } finally { await stop(); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){} }
  console.log(fails?'FAIL '+fails+' of '+checks:'PASS '+checks+' checks (hero usage: counted on every battle route, added across servers, admin only)'); process.exit(fails?1:0); })();
