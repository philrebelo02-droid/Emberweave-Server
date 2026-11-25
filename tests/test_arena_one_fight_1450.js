// v1450 ONE ARENA FIGHT (Phil 25 Nov: "The player should see the exact recording everyone sees").
// Before: the page played its own squads on its own seed, /api/arena/result decided `won` with ANOTHER engine (combat-core) on a fresh seed,
// and the replay was a seed search for "a fight with the same outcome". Now /api/arena/start fixes the fight (server snapshots of both squads +
// a server seed), the page plays exactly that, the result route replays it on the game's own engine, and every report stores it.
// Real server on a free port + temp DB; the "client" side is the shipped page run headless (server/sim-host.js), as the browser runs it.
//  (a) the server's verdict for an open fight == simFightResult on the same snaps + seed (won AND end-state digest), several seeds and team
//      mixes, a player defender and ladder bots, a declared won:true never trusted
//  (b) a result with no open fight (an old page) is refused and spends no attempt; a fightId from another fight is refused
//  (c) the defender's stored report and the Top-pick record carry the same snaps + seed and replay to the same result and digest
//  (d) the same requestId answers the same receipt and spends nothing more
//  (e) the same opponent + squad resumes the same fight (no reroll); starting another fight forfeits the open one (attempt spent, no rank)
// Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-a1450-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,SIM_WORKERS:'0'},stdio:'ignore',windowsHide:true});
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(700); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const host=require(path.join(root,'server','sim-host.js')).load(path.join(root,'emberweave-heroes.html'));   // the page's own engine, headless
const clientFight=(mine,foe,seed)=>{ const r=host.auto(mine,foe,seed>>>0); return {won:r.won,digest:r.digest}; };   // = simFightResult(mine, foe, seed)
const usedOf=r=>((r&&r.data&&r.data.arena)||{}).used;   // every start / result / refusal answers the attempt count
let rq=0; const rid=t=>'a1450-'+t+'-'+(++rq);
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'a1450-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const g2=await call('/api/guest',{deviceId:'a1450b-'+Date.now()}); const defId=g2.data.profile.id, defTok=g2.data.token; await call('/api/ledger',null,defTok);
  const STRONG=['vael','sylthaine','vireo'], WEAK=['vex','gruel'];
  await editDB((db,u)=>{ u.led.px=900000;
    for(const k of STRONG){ u.led.unlocked[k]=true; u.led.hero[k]={xp:9000000,stars:5,pips:0}; }
    for(const k of WEAK){ u.led.unlocked[k]=true; u.led.hero[k]={xp:0,stars:1,pips:0}; }
    u.team=STRONG.slice(); u._arenaOffer=[{id:defId,t:Date.now()}];
    const o=db.users[defId]; o.led.px=900000; for(const k of ['grosk','vael','vex']){ o.led.unlocked[k]=true; o.led.hero[k]={xp:400000,stars:3,pips:0}; } o.arenaDef=['grosk','vael','vex']; });
  // the source: the page fights a fixed arena fight from its snapshots on its seed, and no seed search is left
  { const page=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8'), srv=fs.readFileSync(path.join(root,srvFile),'utf8');
    ok(/seedBattle\(CUR&&\(CUR\.mode==='replay'\|\|\(CUR\.mode==='arena'&&CUR\.oneFight\)\)&&CUR\.seed!=null\?CUR\.seed:null\)/.test(page),'the live arena fight plays on the fixed seed');
    ok(/CUR\.replayAlly=r\.mySnaps; CUR\.replayFoe=r\.foeSnaps\.slice\(\);/.test(page),'the live arena fight spawns the server\'s two squads (setupMarchTeams, like simFightResult)');
    ok(!/simFightResult\(snap,foe,sd\)===!!won/.test(page),'the report seed search is gone');
    const route=srv.slice(srv.indexOf("if(p==='/api/arena/result'"),srv.indexOf("if(p==='/api/arena/top'"));
    ok(route.length>0&&!/resolveLineBattle/.test(route)&&/host\.auto\(mySnaps,opSnaps,seed\)/.test(route),'the result route decides with the game\'s own engine, not combat-core');
    ok(!/b\.def\b/.test(route),'the result route never stores a client-written report'); }

  // (b) an old page: a result with no open fight is refused and spends nothing
  const noFight=await call('/api/arena/result',{oppId:defId,won:true,requestId:rid('nofight')});
  ok(noFight.status===400&&noFight.data.ok===false&&typeof noFight.data.won!=='boolean','(b) a result with no open fight is refused ('+JSON.stringify(noFight.data).slice(0,120)+')');
  // give the attacker attempts for the whole run (today's record, as the server keys it)
  { const s1=await call('/api/arena/start',{oppId:defId,team:STRONG,requestId:rid('probe')}); ok(s1.status===200&&s1.data.ok,'a fight starts ('+(s1.data.error||'ok')+')');
    ok(typeof usedOf(noFight)==='number'&&usedOf(s1)===usedOf(noFight),'(b) ... and spends no attempt ('+usedOf(noFight)+' -> '+usedOf(s1)+')'); }
  await editDB((db,u)=>{ const k=u.led.arenaAtt&&u.led.arenaAtt.k; u.led.arenaAtt={k,used:0,bought:40,buys:0}; delete u._arenaPend; u._arenaOffer=[{id:defId,t:Date.now()}]; });

  // (e) resume: the same opponent and squad answer the same fight; the start spends nothing
  { const a=await call('/api/arena/start',{oppId:defId,team:STRONG,requestId:rid('r1')}), b=await call('/api/arena/start',{oppId:defId,team:STRONG,requestId:rid('r2')});
    ok(a.data.ok&&b.data.ok&&a.data.fightId===b.data.fightId&&a.data.seed===b.data.seed,'(e) the same opponent + squad resumes the same fight (no reroll)');
    ok(usedOf(a)===0&&usedOf(b)===0,'(e) starting a fight spends no attempt');
    const wrong=await call('/api/arena/result',{oppId:defId,fightId:'not-this-fight',won:true,requestId:rid('wrongid')});
    ok(wrong.status===400&&wrong.data.ok===false&&usedOf(wrong)===0,'(b) a result naming another fight is refused and spends no attempt'); }

  // (a) several fights, team mixes and seeds; a player defender and ladder bots
  const bots=((await call('/api/arena/opponents')).data.opponents||[]).filter(o=>o.isNpc);
  ok(bots.length>=2,'the ladder offers bots to fight ('+bots.length+')');
  const plan=[[STRONG,defId],[WEAK,defId],[STRONG.concat(WEAK),defId],[WEAK,bots[0].id],[STRONG,bots[1].id],[['vex'],bots[0].id],[STRONG,defId]];
  const seen={seeds:new Set(),won:0,lost:0}; let lastPlayerFight=null;
  for(const [team,opp] of plan){
    const st=await call('/api/arena/start',{oppId:opp,team,requestId:rid('st')});
    ok(st.status===200&&st.data.ok&&Array.isArray(st.data.mySnaps)&&st.data.mySnaps.length===team.length&&st.data.foeSnaps.length>0,'start '+team.join('+')+' vs '+(opp===defId?'player':'bot')+' ('+(st.data.error||'ok')+')');
    ok(st.data.mySnaps.map(s=>s.key).join()===team.join(),'the squad that fights is the squad picked');
    const mine=clientFight(st.data.mySnaps,st.data.foeSnaps,st.data.seed);   // what the page plays, headless
    const before=usedOf(st);
    const resId=rid('res'), rs=await call('/api/arena/result',{oppId:opp,fightId:st.data.fightId,won:true,requestId:resId});   // the page claims a win every time
    ok(rs.status===200&&rs.data.won===mine.won,'(a) the verdict is the fight the page played: '+mine.won+' (server '+rs.data.won+', '+(rs.data.error||'')+')');
    ok(rs.data.digest===mine.digest,'(a) ... to the same end state (digest)');
    ok(rs.data.seed===st.data.seed&&rs.data.fightId===st.data.fightId,'(a) ... on the seed it started with');
    ok(usedOf(rs)===before+1,'one attempt spent by the result ('+before+' -> '+usedOf(rs)+')');
    seen.seeds.add(st.data.seed); if(mine.won) seen.won++; else seen.lost++;
    if(opp===defId) lastPlayerFight={st:st.data,rs:rs.data,mine};
    // (d) the same requestId is the same receipt
    if(opp===defId&&!seen.retried){ seen.retried=true; const re=await call('/api/arena/result',{oppId:opp,fightId:st.data.fightId,won:!mine.won,requestId:resId});
      ok(re.status===200&&re.data.won===rs.data.won&&re.data.rank===rs.data.rank&&re.data.goldReward===rs.data.goldReward&&re.data.digest===rs.data.digest,'(d) the same requestId answers the same receipt');
      seen.checkUsed=usedOf(rs); }
    const after=await call('/api/arena/result',{oppId:opp,fightId:st.data.fightId,won:true,requestId:rid('twice')});
    ok(after.status===400,'a resolved fight cannot be resolved again under a new requestId');
    if(seen.checkUsed!=null&&seen.checkUsed!==usedOf(rs)){ ok(usedOf(st)===seen.checkUsed,'(d) ... and the retry spent nothing more'); seen.checkUsed=null; }
  }
  ok(seen.seeds.size===plan.length,'every fight had its own seed ('+seen.seeds.size+')');
  ok(seen.won>0&&seen.lost>0,'the mix holds wins and losses ('+seen.won+' won, '+seen.lost+' lost) - a declared win is never trusted');

  // (c) the defender's report and the Top-pick record are the same fight
  { const L=lastPlayerFight; const rep=((await call('/api/arena/reports',null,defTok)).data.defenses||[])[0]||{};
    ok(rep.seed===L.st.seed&&JSON.stringify(rep.mineSnap)===JSON.stringify(L.st.mySnaps)&&JSON.stringify(rep.foe)===JSON.stringify(L.st.foeSnaps),'(c) the defender\'s report stores the fight\'s seed and both server squads');
    const rr=clientFight(rep.mineSnap,rep.foe,rep.seed);
    ok(rr.won===rep.won&&rr.won===L.rs.won&&rr.digest===L.mine.digest,'(c) the defender\'s replay is the same fight (result + digest)');
    const top=((await call('/api/arena/top')).data.battles||[]).find(x=>x.seed===L.st.seed);
    ok(!!top&&JSON.stringify(top.mineSnap)===JSON.stringify(L.st.mySnaps)&&JSON.stringify(top.foe)===JSON.stringify(L.st.foeSnaps),'(c) the Top-pick record stores the same fight');
    const tr=top?clientFight(top.mineSnap,top.foe,top.seed):{};
    ok(!!top&&tr.won===top.won&&tr.digest===L.mine.digest,'(c) the Top-pick replay is the same fight (result + digest)');
    const atk=clientFight(L.st.mySnaps,L.st.foeSnaps,L.st.seed);   // the attacker's Record: the page stores the start reply's snaps + seed
    ok(atk.digest===L.mine.digest&&atk.won===L.rs.won,'(c) the attacker\'s Watch replay is the same fight'); }

  // (e) walking away: another start forfeits the open fight - an attempt, no rank, no reward
  { const meBefore=(await call('/api/arena/opponents')).data; const u1=meBefore.arena.used, rk=meBefore.rank;
    const a=await call('/api/arena/start',{oppId:defId,team:WEAK,requestId:rid('walk')});
    const b=await call('/api/arena/start',{oppId:bots[0].id,team:WEAK,requestId:rid('walk2')});
    ok(a.data.ok&&b.data.ok&&a.data.fightId!==b.data.fightId,'(e) a different fight starts');
    const meAfter=(await call('/api/arena/opponents')).data;
    ok(meAfter.arena.used===u1+1&&meAfter.rank===rk,'(e) the walked-away fight is forfeited: one attempt, the rank unchanged');
    const old=await call('/api/arena/result',{oppId:defId,fightId:a.data.fightId,won:true,requestId:rid('old')});
    ok(old.status===400,'(e) the forfeited fight can no longer be resolved'); }

  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_arena_one_fight_1450.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
