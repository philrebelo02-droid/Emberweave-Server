'use strict';
/* REAL_ENGINE_HIT_TIMING (D1, 14 Nov 2026: "the fight the player saw is the result"). City PvP against a player castle, the world-map bot and
   the mines are fought by the server on the real engine and replayed to the player from their war mail / report. Until this switch the
   server fought them with no clip timing (host.auto: every blow at the swing) while the replay lands each blow on its clip's contact cell,
   so the replay was another fight. Proves, on the real server.js in-process and the page in sim-host:
     1. switch OFF: the seeded fights answer exactly as the commit this mode started from (BASE), the accounts end the same - and the
        replay the player watches does NOT end where the paid fight ended (the bug, measured);
     2. switch ON: each fight is host.autoWatched on the same snaps and seed (the outcome the route pays, wounds, loot rules unchanged);
     3. the client's replay (watchBattle on the war mail / report) ends on the paid fight's exact state, for every fight;
     4. gear, Temper, glyphs, prayers, Academy, skills and learned talents each change the squad and win more often (100 seeds) in a city
        fight with the watched timing;
     5. determinism: a second server, the same world and requests, the same fights.
   BASE = server.js at REAL_ENGINE_BASE_HIT (default 6335368f4, the NPC castle commit). Run: node --test tests/real-engine-hit-timing.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const IP=require('./helpers/server-inproc.cjs'),W=require('./helpers/arena-world.cjs'),CW=require('./helpers/city-world.cjs'),SY=require('./helpers/systems.cjs');
const SH=require(path.join(root,'server','sim-host.js')),MINES=require(path.join(root,'server','world-mines.js'));
const BASE_SHA=process.env.REAL_ENGINE_BASE_HIT||'6335368f4';
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
let BASE_SRC=null; try{ BASE_SRC=cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8'); }catch(e){ console.log('BASE server.js not available - test 1 is skipped'); }
const PAGE=SH.load(path.join(root,'emberweave-heroes.html'));
const J=JSON.stringify, clone=x=>JSON.parse(J(x));
const ENV={SERVER_SECRET:'real-engine-hit-test-secret'};
const L40={level:40,stars:4,skill:[10,10,10,10],asc:3};
function world(S){ IP.pin(99); try{ return world0(S); } finally{ IP.unpin(); } }   // the world is built on a pinned random stream (the mine field draws)
function world0(S){
  const A1=W.player(S,'HitA1',{vael:L40,sylthaine:L40,vireo:L40}), A2=W.player(S,'HitA2',{vex:L40,gruel:L40,vael:L40}), A3=W.player(S,'HitA3',{vireo:L40,vex:L40,sylthaine:L40});
  const D1=W.player(S,'HitD1',{gruel:L40,sylthaine:L40,vex:L40}); D1.wall=['gruel','sylthaine','vex']; D1.beginnerBroken=true;
  const D2=W.player(S,'HitD2',{vireo:L40,vael:L40}); D2.wall=['vireo','vael']; D2.beginnerBroken=true;
  CW.wound(S,A2,'vex',0.6); CW.wound(S,D1,'gruel',0.7);
  CW.march(S,A1,'h1',D1.id,['vael','sylthaine','vireo']); CW.march(S,A2,'h2',D2.id,['vex','gruel','vael']);
  CW.march(S,A3,'h3','wb_9',['vireo','vex','sylthaine'],{botTeam:[{key:'tick',level:38,rank:2},{key:'grosk',level:40,rank:3},{key:'fritz',level:36,rank:2}]});
  // a mine march, built as /api/world/mine/start builds one (the node from this cycle's field)
  const FIELD=MINES.field(MINES.epochAt(Date.now())), node=FIELD.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))).find(n=>n.level===4)||FIELD[0], host=S.simHost(), now=Date.now();
  const snaps=host.snapFromSpecs(clone(['vael','sylthaine','vireo'].map(k=>S.campaignHeroSpec(A3,k)))).map(s=>Object.assign({},s,{hp:s.maxHp,worldEntryHpCap:s.maxHp}));
  A3.worldMineMarches=[{id:'h4',node:clone(node),heroIds:['vael','sylthaine','vireo'],snaps,depart:now-120000,arriveAt:now-1000,homeAt:now+3600000,resolved:false,route:null}];
  return {A1,A2,A3,D1,D2}; }
function requests(w){ return [
  ['/api/pvp/attack',w.A1,{marchId:'h1',defId:w.D1.id,requestId:'k1'}],
  ['/api/pvp/attack',w.A2,{marchId:'h2',defId:w.D2.id,requestId:'k2'}],
  ['/api/pvp/attack',w.A2,{marchId:'h2',defId:w.D2.id,requestId:'k2'}],
  ['/api/pvp/attack',w.A3,{marchId:'h3',defId:'wb_9',requestId:'k3'}],
  ['/api/world/mine/resolve',w.A3,{marchId:'h4',requestId:'k4'}],
]; }
const TIMEISH=new Set(['t','arriveAt','resolvedAt','id','engine','newLoc','res','returnAt','born','homeAt','tickAt','ledger']);
const strip=x=>Array.isArray(x)?x.map(strip):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).filter(k=>!TIMEISH.has(k)).map(k=>[k,strip(x[k])])):x;
async function runAll(S,w){ const out=[]; let i=0; for(const [p,u,b] of requests(w)) out.push(await S.call(p,b,S.token(u.id),6000+i,'10.6.0.'+(i++))); return out; }
const accounts=(S,w)=>strip(Object.fromEntries(Object.keys(w).map(k=>{ const u=S.getDB().users[w[k].id]; return [k,{mail:u.pvpMail||[],hut:u.witch?u.witch.hp:null,gold:u.led.gold,wall:u.wallDur||null}]; })));
function diffs(a,b,p,out){ out=out||[]; p=p||''; if(J(a)===J(b)) return out; if(a&&b&&typeof a==='object'&&typeof b==='object'){ for(const k of new Set([...Object.keys(a),...Object.keys(b)])) diffs(a[k],b[k],p+'.'+k,out); } else out.push(p+': '+String(J(a)).slice(0,80)+' vs '+String(J(b)).slice(0,80)); return out; }
const fights=rs=>[0,1,3,4].map(i=>rs[i].data);   // the four fights (2 is a replayed receipt)
function watched(meta){ const C=SH.load(path.join(root,'emberweave-heroes.html')); C.sandbox.__m=clone(meta);
  const out=vm.runInContext(`(function(){ ACC.token='t'; startVersus=(e,a,k)=>_startVersusNow(e,a,k); watchBattle(__m);
    let i=0; for(;i<14400&&!ended;i++) updateBattle(SIM_STEP); return {ended,dg:window._p2lastDigest}; })()`,C.ctx);
  const a=JSON.parse(out.dg); return J({t:a.t,won:a.won,u:a.u}); }
const meta=r=>({v:2,seed:r.replay.seed,mineSnap:r.replay.snaps,foe:r.replay.foe,won:r.won});   // what the war mail / report stores and plays

test('1. switch off: the fights answer exactly as before - and the replay the player watches is another fight',{skip:!BASE_SRC},async()=>{
  const B=IP.load(BASE_SRC,ENV), N=IP.load(SRC,ENV), wb=world(B), wn=world(N);
  const rb=await runAll(B,wb), rn=await runAll(N,wn);
  assert.ok(fights(rn).every(r=>r.ok&&r.replay),'four fights: '+J(rn.map(r=>[r.status,r.data.error])));
  assert.deepEqual(rn.map(r=>strip(r)),rb.map(r=>strip(r)),'the replies differ from BASE: '+diffs(rn.map(r=>strip(r)),rb.map(r=>strip(r))).slice(0,6).join(' | '));
  assert.deepEqual(accounts(N,wn),accounts(B,wb),'the accounts differ from BASE');
  let differ=0; for(const r of fights(rn)){ const paid=PAGE.auto(clone(r.replay.snaps),clone(r.replay.foe),r.replay.seed).digest; if(watched(meta(r))!==paid) differ++; }
  console.log('switch off: '+differ+' of 4 replays end in another state than the paid fight');
  assert.ok(differ>=1,'the bug this switch fixes was not seen (no replay differed)');
});

let ON=null,wOn=null,rOn=null;
async function onServer(){ if(ON) return; ON=IP.load(SRC,Object.assign({REAL_ENGINE_HIT_TIMING:'true',TALENTS_ENABLED:'true'},ENV)); wOn=world(ON); rOn=await runAll(ON,wOn); }

test('2. switch on: each fight is the watched-timing fight on the same snaps and seed',async()=>{
  await onServer();
  assert.ok(fights(rOn).every(r=>r.ok&&r.replay),J(rOn.map(r=>[r.status,r.data.error])));
  assert.deepEqual(rOn[2].data,rOn[1].data,'a replayed requestId answers its receipt');
  const seeds=[ON.srvSeed('citypvp',wOn.A1.id,'k1'),ON.srvSeed('citypvp',wOn.A2.id,'k2'),ON.srvSeed('worldbot',wOn.A3.id,'h3'),ON.srvSeed('world-mine',wOn.A3.id,'h4')];
  fights(rOn).forEach((r,i)=>{ assert.equal(r.replay.seed,seeds[i],'the seed rule is unchanged ('+i+')');
    const f=PAGE.autoWatched(clone(r.replay.snaps),clone(r.replay.foe),r.replay.seed); assert.equal(r.won,f.won,'the verdict is the watched-timing fight ('+i+')');
    assert.equal(r.durationSec!=null?r.durationSec:r.replay.durationSec,JSON.parse(f.digest).t,'the fight that ended is that one ('+i+')'); });
  // the war mails carry the same fight
  const mail=(ON.getDB().users[wOn.D1.id].pvpMail||[]).find(m=>m.battle); assert.ok(mail&&mail.battle.seed===seeds[0]);
});

test('3. the client\'s replay ends on the paid fight\'s exact state, every fight',async()=>{
  await onServer();
  for(const r of fights(rOn)){ const w=watched(meta(r)), a=JSON.parse(w);
    assert.equal(w,PAGE.autoWatched(clone(r.replay.snaps),clone(r.replay.foe),r.replay.seed).digest,'the replay is another fight than the watched-timing fight');
    assert.equal(a.t,r.durationSec!=null?r.durationSec:r.replay.durationSec,'the replay lasts another time than the fight the server paid'); assert.equal(a.won,r.won,'the replay has another verdict than the one paid');
    const inj=Array.isArray(r.injuries)?r.injuries:r.injuries.attacker;   // the wounds the server paid come from ITS fight's end state: they must be the replay's
    for(const x of inj){ const sn=r.replay.snaps.find(q=>q.key===x.key), row=a.u.find(q=>q[0]===x.key&&q[1]==='ally'), hp=row?Math.max(0,Math.min(sn.worldEntryHpCap,row[3])):0;
      assert.equal(x.after,Math.min(x.before,Math.round(Math.max(0,Math.min(1,hp/sn.maxHp))*10000)),'the wounds paid are not those of the replay ('+x.key+')'); } }
});

test('4. gear, Temper, glyphs, prayers, Academy, skills and talents each change the squad and win more often in a city fight',async()=>{
  const S=IP.load(SRC,Object.assign({REAL_ENGINE_HIT_TIMING:'true',TALENTS_ENABLED:'true'},ENV));
  const pool=require(path.join(root,'server','sim-pool.js')).create(path.join(root,'emberweave-heroes.html'),{size:2,queueMax:10000,timeoutMs:600000,queueWaitMs:600000}); test.after(()=>pool.close());
  for(let i=0;i<300&&!pool.stats.ready;i++) await new Promise(r=>setTimeout(r,100));
  const TEAM=['vael','sylthaine','vireo'];
  const mirror=W.player(S,'HitMirror',Object.fromEntries(TEAM.map(k=>[k,{level:60,stars:5,skill:[20,20,20,20],asc:4,gear:W.gearFor(k)}])));
  const castle=PAGE.snapFromSpecs(clone(TEAM.map(k=>S.campaignHeroSpec(mirror,k)))).map(s=>Object.assign({},s,{hp:s.maxHp,worldEntryHpCap:s.maxHp}));
  const {res,bad}=await SY.run(S,PAGE,pool,{team:TEAM,tag:'Hit',foe:async()=>castle});
  console.log('city fight (watched timing) wins of 100, without -> with: '+J(res));
  assert.deepEqual(bad,[]);
});

test('5. determinism: a second server given the same world and requests gives the same fights',async()=>{
  await onServer();
  const S2=IP.load(SRC,Object.assign({REAL_ENGINE_HIT_TIMING:'true',TALENTS_ENABLED:'true'},ENV)), w2=world(S2), r2=await runAll(S2,w2);
  assert.deepEqual(r2.map(r=>strip(r)),rOn.map(r=>strip(r))); assert.deepEqual(accounts(S2,w2),accounts(ON,wOn));
});
