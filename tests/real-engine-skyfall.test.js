'use strict';
/* REAL_ENGINE_SKYFALL (14 Nov 2026, Phil: "Everything in the game uses every feature ... when that hero ID is put into a fight it is that hero").
   Proves, on the real server.js loaded in-process (tests/helpers/server-inproc.cjs) with its battle workers, and the real page in sim-host:
     1. switch OFF: a seeded war (lock, assaults, a replayed requestId, a capture, a refusal, a stale version) answers exactly as the commit
        this mode started from (BASE), and the stored match is the same;
     2. switch ON: the lock freezes every line's campaignHeroSpec snaps (lineSnaps) and its real-engine HP (hpReal, the Witch's Hut health at
        the lock); each assault is sim-host skyReal on those snaps and the HP carried from the assaults before it, seeded as before; the HP
        each hero leaves with is the next assault's input (three assaults in a row on one line); hpState follows it; the reply carries the
        watchable fight;
     3. the stored format decides, never the switch: a match locked with the switch off fights on the line model on a server with the
        switch on, and a match locked with it on keeps the real engine on a server with it off;
     4. the client plays each assault back (skyWatchReal -> the page's watched-fight path) to the server's exact end digest, carried HP
        included, with ultimate and gear taps sent on every tick;
     5. gear, Temper, glyphs, Temple prayers, Academy, skill levels and learned talents each change the snaps and win more often over
        100 seeds;
     6. determinism: a second server given the same world and requests gives the same fights; the same assault twice, the same digest.
   BASE = server.js at REAL_ENGINE_BASE_SKYFALL (default: fa215c57b, the commit before this mode). Run: node --test tests/real-engine-skyfall.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const IP=require('./helpers/server-inproc.cjs'),W=require('./helpers/arena-world.cjs'),SW=require('./helpers/skyfall-world.cjs');
const SH=require(path.join(root,'server','sim-host.js')),T=require(path.join(root,'talents.js')),WITCH=require(path.join(root,'server','witches-hut.js'));
const BASE_SHA=process.env.REAL_ENGINE_BASE_SKYFALL||'fa215c57bb1f016f3bbe9bfa43bd32981f9d6bd6';
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
let BASE_SRC=null; try{ BASE_SRC=cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8'); }catch(e){ console.log('BASE server.js not available - test 1 is skipped'); }
const PAGE=SH.load(path.join(root,'emberweave-heroes.html'));
const J=JSON.stringify, clone=x=>JSON.parse(J(x));
const pools=[]; test.after(()=>{ for(const p of pools) try{ p.close(); }catch(e){} });
async function server(src,env){ const S=IP.load(src,Object.assign({SIM_WORKERS:'1'},env||{})); const p=S.simPool(); pools.push(p);
  for(let i=0;i<300&&!(p&&p.stats.ready);i++) await new Promise(r=>setTimeout(r,100)); assert.ok(p&&p.stats.ready,'battle workers ready'); return S; }
const strong=k=>({level:100,stars:6,skill:[60,60,60,60],asc:6,gear:W.gearFor(k),temper:4,acad:20,temple:3});
/* lane 0: A0 (strong) and A2 against B0, B1 and B2 (three fights in a row for A0's line, HP carried); lane 1: A1 alone (an undefended
   enemy citadel); lane 2: A3 against B3 */
const LAYOUT={statA:i=>i===0?strong:null, lanesA:[0,1,0,2], lanesB:[0,0,0,2]};
function world(S){ const w=SW.war(S,{n:4,statA:LAYOUT.statA,seed:77});
  const m=w.m; for(const gid of ['gA','gB']) for(const c of m.sides[gid].citadels) c.defenders=[];
  w.A.forEach((u,i)=>m.sides.gA.citadels[LAYOUT.lanesA[i]].defenders.push({memberId:u.id,line:0}));
  w.B.forEach((u,i)=>m.sides.gB.citadels[LAYOUT.lanesB[i]].defenders.push({memberId:u.id,line:0}));
  // a wound carried into the war: B0's first hero stands at 60% in the Witch's Hut
  const b0=S.getDB().users[w.B[0].id]; b0.witch=WITCH.create(100000,Date.now()); b0.witch.level=WITCH.UNLOCK_LEVEL; b0.witch.hp[SW.line(1)[0]]=6000;
  return w; }
function requests(w){ return [
  [w.A[0],{fromLane:0,requestId:'q1'}],
  [w.A[0],{fromLane:0,requestId:'q1'}],          // the same requestId: its receipt
  [w.A[0],{fromLane:0,requestId:'q2'}],
  [w.A[1],{fromLane:1,requestId:'q3'}],          // an undefended citadel: captured, no fight
  [w.A[2],{fromLane:2,requestId:'q4'}],          // no line of A2's there: refused
  [w.A[0],{fromLane:0,requestId:'q5',expectedVersion:1}],   // a stale board: refused
  [w.B[3],{fromLane:2,requestId:'q6'}],          // the other guild marches
  [w.A[0],{fromLane:0,requestId:'q7'}],
  [w.A[2],{fromLane:0,requestId:'q8'}],
  [w.A[3],{fromLane:2,requestId:'q9'}],
]; }
const TIMEISH=new Set(['t','lockedAt','revealAt','planningEndsAt','startsAt','endsAt','resultsUntil','nextPrepOpensAt','engine']);
const strip=x=>Array.isArray(x)?x.map(strip):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).filter(k=>!TIMEISH.has(k)).map(k=>[k,strip(x[k])])):x;
const matchOf=(S,w)=>S.getDB().tournaments.current.matches[w.m.id];
const stored=(S,w)=>{ const m=matchOf(S,w); return strip({state:m.state,realEngine:m.realEngine,version:m.version,assaults:m.assaults,receipts:m.receipts,eventLog:m.eventLog,
  sides:Object.fromEntries(Object.entries(m.sides).map(([g,s])=>[g,s.citadels.map(c=>({destroyed:c.destroyed,d:c.defenders}))]))}); };
async function runAll(S,w,each){ await S.call('/api/guild-war/status',null,S.token(w.A[0].id),3,'10.1.0.1');   // the lock (warAdvance -> warLockMatch)
  const out=[]; let i=0; for(const [u,body] of requests(w)){ const before=clone(matchOf(S,w)); const r=await S.call('/api/guild-war/assault',body,S.token(u.id),2000+i,'10.2.0.'+(i++));
    if(each) each(r,before,u,body); out.push(strip({status:r.status,data:r.data})); }
  return out; }

test('1. switch off: a seeded war answers exactly as the commit this mode started from',{skip:!BASE_SRC},async()=>{
  const B=await server(BASE_SRC,{}), N=await server(SRC,{}), wb=world(B), wn=world(N);
  const rb=await runAll(B,wb), rn=await runAll(N,wn);
  const fights=rn.filter(r=>r.status===200&&r.data.replay);
  assert.ok(fights.length>=3,'at least three fights: '+J(rn.map(r=>[r.status,r.data.error])));
  assert.ok(fights.every(r=>!('v' in r.data.replay)&&Array.isArray(r.data.replay.log)&&r.data.replay.log.length),'the line model fought (its log is in the reply)');
  assert.ok(rn.some(r=>r.status===409)&&rn.some(r=>r.data.captured)&&rn.some(r=>r.data.replayed)&&rn.some(r=>r.status===400),'a refusal, a stale board, a capture and a receipt were exercised');
  assert.equal(matchOf(N,wn).realEngine,undefined,'no real-engine format stamp');
  assert.ok(!J(matchOf(N,wn)).includes('"lineSnaps"')&&!J(matchOf(N,wn)).includes('"hpReal"'),'nothing real-engine is stored');
  assert.deepEqual(rn,rb,'the replies differ from BASE');
  assert.deepEqual(stored(N,wn),stored(B,wb),'the stored match differs from BASE');
});

let ON=null, wOn=null, rOn=null; const onFights=[];
async function onServer(){ if(ON) return; ON=await server(SRC,{REAL_ENGINE_SKYFALL:'true',TALENTS_ENABLED:'true'}); wOn=world(ON);
  rOn=await runAll(ON,wOn,(r,before,u,body)=>{ if(r.status===200&&r.data.replay) onFights.push({r,before,u,lane:body.fromLane}); }); }
const pairOf=(m,u,lane,d)=>{ const gid=u.guildId, foeG=gid==='gA'?'gB':'gA';
  return { a:m.sides[gid].citadels[lane].defenders.find(x=>x.memberId===u.id), dAll:m.sides[foeG].citadels[lane].defenders, d:m.sides[foeG].citadels[lane].defenders.find(x=>x.memberId===d) }; };

test('2. switch on: the lock freezes the full heroes; each assault is the real engine on them, HP carried',async()=>{
  await onServer();
  const m=matchOf(ON,wOn), DB=ON.getDB();
  assert.equal(m.realEngine,1,'the match is stamped with the real-engine format');
  for(const gid of ['gA','gB']) for(const c of m.sides[gid].citadels) for(const d of c.defenders){
    const owner=DB.users[d.memberId], keys=d.lineSnapshot.map(h=>h.key);
    assert.equal(J(d.lineSnaps),J(PAGE.snapFromSpecs(clone(keys.map(k=>ON.campaignHeroSpec(owner,k))))),'lineSnaps are the page\'s own resolution of campaignHeroSpec ('+d.memberId+')'); }
  // the Witch's Hut wound at the lock, in real-engine numbers (B0's first hero at 60%)
  const fb=onFights[0].before, b0=pairOf(fb,wOn.A[0],0,wOn.B[0].id).dAll.find(x=>x.memberId===wOn.B[0].id);
  assert.equal(b0.hpReal[0].hp,WITCH.combatHp({hp:{[b0.lineSnaps[0].key]:6000}},b0.lineSnaps[0].key,b0.lineSnaps[0].maxHp),'the hut wound enters the war');
  assert.ok(b0.hpReal.slice(1).every((h,i)=>h.hp===b0.lineSnaps[i+1].maxHp),'unwounded heroes enter at full health');
  assert.ok(onFights.length>=3,'three fights or more: '+J(rOn.map(r=>[r.status,r.data.error])));
  let chained=0;
  for(const f of onFights){ const rp=f.r.data.replay, after=matchOf(ON,wOn);
    assert.equal(rp.v,2); assert.deepEqual(rp.log,[]);
    const ev=(f.r.data.match.eventLog||[]).filter(e=>e.e==='ASSAULT').pop(), P=pairOf(f.before,f.u,f.lane,ev.d);
    const seed=rp.seed, want=PAGE.skyReal(clone(P.a.lineSnaps),clone(P.a.hpReal),clone(P.d.lineSnaps),clone(P.d.hpReal),seed);
    assert.equal(f.r.data.won,want.won,'the verdict is the real engine\'s'); assert.equal(rp.digest,want.digest,'the digest is the real engine\'s');
    assert.equal(seed,(f.before.id&&require(path.join(root,'server','sim.js')).seedFrom(f.before.id+':'+f.u.id+':'+f.lane+':'+f.before.version))>>>0,'the seed rule is unchanged');
    assert.equal(J(rp.mineSnap),J(SH.skyCarry(P.a.lineSnaps,P.a.hpReal)),'the reply\'s attacker is the frozen snaps with the carried HP');
    assert.equal(J(rp.foe),J(SH.skyCarry(P.d.lineSnaps,P.d.hpReal)),'the reply\'s defender is the frozen snaps with the carried HP');
    if(P.a.hpReal.some((h,i)=>h.hp>0&&h.hp<P.a.lineSnaps[i].maxHp)||P.d.hpReal.some((h,i)=>h.hp>0&&h.hp<P.d.lineSnaps[i].maxHp)) chained++;
    const A2=pairOf(after,f.u,f.lane,ev.d);
    if(f===onFights[onFights.length-1]){   // the last fight's carry is what is stored now
      assert.deepEqual(A2.a.hpReal,want.aState.map(x=>({hp:x.hp,energy:x.energy})),'the attacker leaves with the HP the fight left');
      assert.deepEqual(A2.d.hpReal,want.bState.map(x=>({hp:x.hp,energy:x.energy})),'the defender leaves with the HP the fight left'); }
    assert.equal(A2.a.alive!==false||!f.r.data.won,true);
    const fr=x=>x.lineSnapshot.map((h,i)=>{ const r=x.hpReal[i]; return r.hp>0?Math.max(1,Math.round(r.hp/x.lineSnaps[i].maxHp*h.maxHp)):0; });
    assert.deepEqual(A2.a.hpState.map(h=>h.hp),fr(A2.a),'hpState follows the real HP, as a fraction of each hero'); }
  // the carry, fight to fight: each fight's input HP is exactly what the fight before left
  for(let i=1;i<onFights.length;i++){ const prev=onFights[i-1], cur=onFights[i]; if(prev.u.id!==cur.u.id||prev.lane!==cur.lane) continue;
    const pa=pairOf(matchOf(ON,wOn),prev.u,prev.lane,null).a; void pa;
    const before=pairOf(cur.before,cur.u,cur.lane,null).a, prevBefore=pairOf(prev.before,prev.u,prev.lane,null).a;
    const pe=(prev.r.data.match.eventLog||[]).filter(e=>e.e==='ASSAULT').pop(), pp=pairOf(prev.before,prev.u,prev.lane,pe.d);
    const left=PAGE.skyReal(clone(pp.a.lineSnaps),clone(pp.a.hpReal),clone(pp.d.lineSnaps),clone(pp.d.hpReal),prev.r.data.replay.seed).aState;
    if(prev.r.data.won) assert.deepEqual(before.hpReal,left.map(x=>({hp:x.hp,energy:x.energy})),'fight '+(i+1)+' starts with the HP fight '+i+' left'); void prevBefore; }
  assert.ok(chained>=2,'at least two fights were fought with carried, partial HP ('+chained+')');
  // the Witch's Hut takes the real fight's wounds (fractions of the real maxHp)
  const inj=onFights[0].r.data.injuries; assert.ok(Array.isArray(inj.attacker)&&Array.isArray(inj.defender));
});

test('3. the stored format decides: a match never changes engine mid-war',async()=>{
  // locked with the switch off, then fought on a server with it on
  const OFF=await server(SRC,{}), w=world(OFF); await OFF.call('/api/guild-war/status',null,OFF.token(w.A[0].id),3,'10.3.0.1');
  assert.equal(matchOf(OFF,w).realEngine,undefined);
  const f1=path.join(OFF.dir,'db.json'); fs.writeFileSync(f1,J(OFF.getDB()));
  const ONx=await server(SRC,{REAL_ENGINE_SKYFALL:'true',DB_FILE:f1});
  const r1=await ONx.call('/api/guild-war/assault',{fromLane:0,requestId:'x1'},ONx.token(w.A[0].id),9,'10.3.0.2');
  assert.equal(r1.status,200,J(r1.data).slice(0,200)); assert.ok(!('v' in r1.data.replay)&&r1.data.replay.log.length,'a match locked before the switch keeps the line model');
  // locked with the switch on, then fought on a server with it off
  const ONy=await server(SRC,{REAL_ENGINE_SKYFALL:'true'}), w2=world(ONy); await ONy.call('/api/guild-war/status',null,ONy.token(w2.A[0].id),3,'10.3.0.3');
  assert.equal(matchOf(ONy,w2).realEngine,1);
  const f2=path.join(ONy.dir,'db2.json'); fs.writeFileSync(f2,J(ONy.getDB()));
  const OFFy=await server(SRC,{DB_FILE:f2});
  const r2=await OFFy.call('/api/guild-war/assault',{fromLane:0,requestId:'y1'},OFFy.token(w2.A[0].id),9,'10.3.0.4');
  assert.equal(r2.status,200,J(r2.data).slice(0,200)); assert.equal(r2.data.replay.v,2,'a match locked on the real engine keeps it');
});

test('4. the client plays each assault back to the server\'s exact end state',async()=>{
  await onServer();
  for(const f of onFights){ const C=SH.load(path.join(root,'emberweave-heroes.html'));
    C.sandbox.__r=clone(f.r.data);
    const out=vm.runInContext(`(function(){ const r=__r; ACC.token='t'; state='guild';
      startVersus=(e,a,k)=>_startVersusNow(e,a,k);   // the loader and art preload are browser-only; the fight starts as it does after them
      if(!skyWatchReal(r)) return {started:false};
      let i=0; for(;i<14400&&!ended;i++){
        for(const u of units) if(u.team==='ally'&&u.alive){ queueInput({k:'ult',uid:u.uid,tid:null,wx:null,wy:null}); queueInput({k:'gear',uid:u.uid}); }
        updateBattle(SIM_STEP); }
      return {started:true, ended, dg:window._p2lastDigest, mode:CUR&&CUR.mode}; })()`,C.ctx);
    assert.ok(out.started,'skyWatchReal started the watched fight'); assert.ok(out.ended,'the watched fight ended');
    const a=JSON.parse(out.dg), b=JSON.parse(f.r.data.replay.digest);
    assert.equal(J({t:a.t,won:a.won,u:a.u}),J(b),'the watched fight ended in another state than the server\'s'); }
});

function build(hero,treeIdx,n,level){ let b={r:{}}; const tr=T.trees(hero)[treeIdx];
  for(let g=0;g<400&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }
test('5. gear, Temper, glyphs, prayers, Academy, skills and talents each change the line, and help over 100 seeds',async()=>{
  const S=IP.load(SRC,{REAL_ENGINE_SKYFALL:'true',TALENTS_ENABLED:'true',SIM_WORKERS:'0'});
  const pool=require(path.join(root,'server','sim-pool.js')).create(path.join(root,'emberweave-heroes.html'),{size:2,queueMax:10000,timeoutMs:600000,queueWaitMs:600000}); pools.push(pool);
  for(let i=0;i<300&&!pool.stats.ready;i++) await new Promise(r=>setTimeout(r,100));
  const TEAM=SW.line(0), L60={level:60,stars:5,skill:[20,20,20,20],asc:4};
  const lineOf=(u)=>PAGE.snapFromSpecs(clone(TEAM.map(k=>S.campaignHeroSpec(u,k)))), full=sn=>sn.map(s=>({hp:s.maxHp,energy:0}));
  const mirror={}; for(const k of TEAM) mirror[k]=Object.assign({},L60,{gear:W.gearFor(k)});
  const D=lineOf(W.player(S,'SkyMirror',mirror));
  const add={ gear:k=>({gear:W.gearFor(k)}), temper:k=>({gear:W.gearFor(k),temper:12}), glyphs:()=>({glyphAtk:300}), prayers:()=>({temple:4}),
    academy:()=>({acad:40}), skills:()=>({skill:[60,60,60,60]}), talents:k=>({talents:build(k,0,30,60)}) };
  const seeds=Array.from({length:100},(_,i)=>(i+1)*2654435761>>>0);
  const run=async sn=>{ const rs=await Promise.all(seeds.map(s=>pool.run('skyReal',[sn,full(sn),D,full(D),s]))); return rs.filter(r=>r.won).length; };
  const res={}, cache=new Map();
  for(const f in add){ const lo={}, hi={};
    for(const k of TEAM){ const base=Object.assign({},L60,f==='temper'?{gear:W.gearFor(k)}:(f==='gear'?{}:{gear:W.gearFor(k)})); lo[k]=base; hi[k]=Object.assign({},base,add[f](k)); }
    const loS=lineOf(W.player(S,'SLo-'+f,lo)), hiS=lineOf(W.player(S,'SHi-'+f,hi));
    const kl=J(loS); if(!cache.has(kl)) cache.set(kl,await run(loS)); const a=cache.get(kl), b=await run(hiS);
    res[f]=[a,b];
    assert.notEqual(J(hiS),J(loS),f+': the line is the same with one more');
    assert.ok(b>a,f+': one more did not win more often ('+a+' -> '+b+' of 100)'); }
  console.log('Skyfall wins of 100 against a mirror line, without -> with: '+J(res));
  const tal=lineOf(W.player(S,'STal',Object.fromEntries(TEAM.map(k=>[k,Object.assign({},L60,{talents:build(k,0,30,60)})]))));
  assert.ok(tal.every(s=>Array.isArray(s.tal)&&s.tal.length),'every frozen snap carries its learned talents');
});

test('6. determinism: a second server given the same world gives the same war; the same assault twice, the same digest',async()=>{
  await onServer();
  const S2=await server(SRC,{REAL_ENGINE_SKYFALL:'true',TALENTS_ENABLED:'true'}), w2=world(S2), r2=await runAll(S2,w2);
  assert.deepEqual(r2,rOn); assert.deepEqual(stored(S2,w2),stored(ON,wOn));
  const f=onFights[0], ev=(f.r.data.match.eventLog||[]).filter(e=>e.e==='ASSAULT').pop(), P=pairOf(f.before,f.u,f.lane,ev.d);
  const a=PAGE.skyReal(clone(P.a.lineSnaps),clone(P.a.hpReal),clone(P.d.lineSnaps),clone(P.d.hpReal),f.r.data.replay.seed), b=PAGE.skyReal(clone(P.a.lineSnaps),clone(P.a.hpReal),clone(P.d.lineSnaps),clone(P.d.hpReal),f.r.data.replay.seed);
  assert.equal(a.digest,b.digest);
});
