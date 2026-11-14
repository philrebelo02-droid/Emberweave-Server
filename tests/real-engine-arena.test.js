'use strict';
/* REAL_ENGINE_ARENA (14 Nov 2026, Phil: "Everything in the game uses every feature ... when that hero ID is put into a fight it is that hero").
   Proves, on the real server.js loaded in-process (tests/helpers/server-inproc.cjs) and the real page loaded in sim-host:
     1. switch OFF: /api/arena/result answers a fixed set of seeded requests exactly as the commit this work started from (BASE);
     2. switch ON: the result, the rating change and the defence report are the fight host.autoWatched gives for the same specs and seed,
        and the specs are campaignHeroSpec's (the builder city PvP and the campaign use); a bot fights as {key, level, rank};
     3. determinism: the same request twice gives the same answer, and a second server given the same world gives the same fights;
     4. gear, Temper, glyphs, Temple prayers, Academy, skill levels and learned talents each change the snaps, and over 100 seeds each
        one moves the win count the right way;
     5. the client plays the server's fight back to the same end digest (the page's own watched-fight path, _startVersusNow + the
        frame tick, with CUR.arenaReal - the state arenaRealStart builds from the reply).
   BASE = server.js at REAL_ENGINE_BASE (default: the talents-real-engine branch point). Run: node --test tests/real-engine-arena.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const IP=require('./helpers/server-inproc.cjs'),W=require('./helpers/arena-world.cjs'),SH=require(path.join(root,'server','sim-host.js')),T=require(path.join(root,'talents.js'));
const BASE_SHA=process.env.REAL_ENGINE_BASE||'d7fb4dfe53e67bc664a48e0578b0b0054cd16761';
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
let BASE_SRC=null; try{ BASE_SRC=cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8'); }catch(e){ console.log('BASE server.js not available - test 1 is skipped'); }
const PAGE=SH.load(path.join(root,'emberweave-heroes.html'));   // "the client": a fresh copy of the page, no server state
const J=JSON.stringify, clone=x=>JSON.parse(J(x));
const TEAM=['vael','sylthaine','vireo'];
const L60={level:60,stars:5,skill:[20,20,20,20],asc:4};
function build(hero,treeIdx,n,level){ let b={r:{}}; const tr=T.trees(hero)[treeIdx];
  for(let g=0;g<400&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }

/* ---- one world, built the same way on every server: three attackers, two player defenders (one with a saved defence line-up), two bots ---- */
function world(S){
  const st=k=>Object.assign({},L60,{gear:W.gearFor(k),temper:2,glyphAtk:120,acad:10,temple:2});
  const A1=W.player(S,'Atk1',{vael:st('vael'),sylthaine:L60,vireo:L60,vex:L60},{rank:5010});
  const A2=W.player(S,'Atk2',{vex:st('vex'),gruel:L60,vael:L60},{rank:5011});
  const A3=W.player(S,'Atk3',{vireo:L60,sylthaine:st('sylthaine')},{rank:5012});
  const D1=W.player(S,'Def1',{vex:L60,gruel:st('gruel'),vael:L60,sylthaine:L60},{rank:5001,arenaDef:['vex','gruel','vael']});
  const D2=W.player(S,'Def2',{vireo:L60,vael:L60},{rank:5002});
  const B1=W.bot(S,4000,[{key:'grosk',level:45,rank:2},{key:'tick',level:45,rank:2},{key:'fritz',level:45,rank:1}]);
  const B2=W.bot(S,3000,[{key:'konwu',level:70,rank:3},{key:'aureth',level:70,rank:3}]);
  for(const a of [A1,A2,A3]) W.offer(a,[D1.id,D2.id,B1.id,B2.id]);
  return {A1,A2,A3,D1,D2,B1,B2};
}
/* the requests: explicit squads, the saved team, a bot, a replayed requestId, a refused opponent, yourself, a client-written report */
function requests(w){ return [
  [w.A1,{oppId:w.D1.id,team:['vael','sylthaine','vireo'],requestId:'q1'}],
  [w.A1,{oppId:w.B1.id,team:['vael','vex'],requestId:'q2'}],
  [w.A1,{oppId:w.D1.id,team:['vael','sylthaine','vireo'],requestId:'q1'}],
  [w.A2,{oppId:w.D2.id,requestId:'q3'}],
  [w.A2,{oppId:w.B2.id,team:['vex','gruel','vael'],requestId:'q4'}],
  [w.A3,{oppId:'p-nobody',team:['vireo'],requestId:'q5'}],
  [w.A3,{oppId:w.A3.id,team:['vireo'],requestId:'q6'}],
  [w.A3,{oppId:w.D1.id,team:['vireo','sylthaine'],requestId:'q7',won:true,def:{seed:99,mineSnap:[{key:'vireo'},{key:'sylthaine'}],foe:[{key:'vex'},{key:'gruel'}]}}],
  [w.A2,{oppId:w.D1.id,team:['vex','gruel'],requestId:'q8'}],
]; }
const PROJ=['won','seed','sim','rank','delta','reward','coins','goldReward','milestoneGems','bestRank','glyphFrags','error','ok','real'];
const project=r=>{ const o={status:r.status}; for(const k of PROJ) if(r.data&&k in r.data) o[k]=r.data[k]; return o; };
async function runAll(S,w){ const out=[]; let i=0; for(const [u,body] of requests(w)) out.push(project(await S.call('/api/arena/result',body,S.token(u.id),1000+(i++)))); return out; }
const users=(S,w)=>Object.fromEntries(Object.entries(w).map(([k,u])=>{ const x=S.getDB().users[u.id]; return [k,x?{rank:x.rank,coins:x.coins,def:(x.arenaDefenses||[]).map(d=>({seed:d.seed,won:d.won,mine:(d.mineSnap||[]).map(s=>s.key),foe:(d.foe||[]).map(s=>s.key)}))}:null]; }));

test('1. switch off: every request answers exactly as the commit this work started from',{skip:!BASE_SRC},async()=>{
  const B=IP.load(BASE_SRC,{}), N=IP.load(SRC,{}), wb=world(B), wn=world(N);
  const rb=await runAll(B,wb), rn=await runAll(N,wn);
  assert.equal(rn.filter(r=>r.status===200&&typeof r.won==='boolean').length,7,'seven fights answered (one a replayed receipt): '+J(rn.map(r=>r.status)));
  assert.ok(rn.every(r=>!('real' in r)),'no real-engine reply with the switch off');
  assert.ok(rn.some(r=>r.sim&&Array.isArray(r.sim.log)&&r.sim.log.length),'the line model fought (its event log is in the reply)');
  assert.deepEqual(rn,rb,'the replies differ from BASE');
  assert.deepEqual(users(N,wn),users(B,wb),'ranks, coins or defence reports differ from BASE');
});

/* the switch on: one server for tests 2-3 */
let ON=null, wOn=null, rOn=null;
async function onServer(){ if(ON) return; ON=IP.load(SRC,{REAL_ENGINE_ARENA:'true',TALENTS_ENABLED:'true'}); wOn=world(ON); rOn=await runAll(ON,wOn); }

test('2. switch on: the result, the rating and the defence report are the real engine fight on the full specs',async()=>{
  await onServer();
  const fights=rOn.filter(r=>r.status===200&&typeof r.won==='boolean');
  assert.equal(fights.length,7,'seven fights answered (one a replayed receipt): '+J(rOn.map(r=>[r.status,r.error])));
  assert.ok(fights.every(r=>r.real&&r.sim===null),'every fight carries the real fight and no line-model log');
  assert.deepEqual(rOn[2],rOn[0],'a replayed requestId answers its receipt');
  assert.equal(rOn[5].status,400); assert.equal(rOn[6].status,400);   // the refusals are unchanged
  const D1=ON.getDB().users[wOn.D1.id];
  const check=(r,attacker,keys,foeOf)=>{
    const specs=keys.map(k=>ON.campaignHeroSpec(attacker,k));
    const mine=PAGE.snapFromSpecs(clone(specs));   // the page resolves the server's specs - the client's own unit builder
    assert.equal(J(r.real.mineSnap),J(mine),'the attacker fought with its campaignHeroSpec snaps');
    assert.equal(J(r.real.foe),J(foeOf),'the defender fought as expected');
    const f=PAGE.autoWatched(clone(r.real.mineSnap),clone(r.real.foe),r.real.seed);
    assert.equal(f.won,r.won,'the verdict is the real fight\'s'); assert.equal(f.digest,r.real.digest,'the digest is the real fight\'s');
    assert.equal(r.seed,r.real.seed); };
  // q1: Atk1 v Def1 - Def1's saved defence line-up, read live
  check(rOn[0],ON.getDB().users[wOn.A1.id],['vael','sylthaine','vireo'],PAGE.snapFromSpecs(clone(['vex','gruel','vael'].map(k=>ON.campaignHeroSpec(D1,k)))));
  // q2: a bot fights as {key, level, rank}
  check(rOn[1],ON.getDB().users[wOn.A1.id],['vael','vex'],[{key:'grosk',level:45,rank:2},{key:'tick',level:45,rank:2},{key:'fritz',level:45,rank:1}]);
  // q3: no squad sent = the saved team (owned heroes); Def2 has no defence line-up = its team
  check(rOn[3],ON.getDB().users[wOn.A2.id],['vex','gruel','vael'],PAGE.snapFromSpecs(clone(['vireo','vael'].map(k=>ON.campaignHeroSpec(ON.getDB().users[wOn.D2.id],k)))));
  // the rating follows the real verdict (applyResult: a win against a better rank takes it)
  const q1=rOn[0]; if(q1.won){ assert.equal(q1.rank,5001); assert.equal(q1.delta,9); } else { assert.equal(q1.rank,5010); assert.equal(q1.delta,0); }
  assert.equal(q1.reward,q1.won?Math.max(5,20+Math.floor((5000-q1.rank)/50)):5,'the coin rule is unchanged');
  // the defence report on Def1 is the server's own fight: never the report the request wrote (q7 sent seed 99 and key-only squads)
  const reps=(ON.getDB().users[wOn.D1.id]||{}).arenaDefenses||[];
  const byseed=s=>reps.find(d=>d.seed===s);
  for(const r of [rOn[0],rOn[7],rOn[8]]){ const d=byseed(r.real.seed); assert.ok(d,'a defence report for seed '+r.real.seed);
    assert.equal(J(d.mineSnap),J(r.real.mineSnap)); assert.equal(J(d.foe),J(r.real.foe)); assert.equal(d.won,r.won); }
  assert.ok(!reps.some(d=>d.seed===99),'the request\'s own report was not stored');
});

test('3. determinism: the same world and requests on a second server give the same fights',async()=>{
  await onServer();
  const S2=IP.load(SRC,{REAL_ENGINE_ARENA:'true',TALENTS_ENABLED:'true'}), w2=world(S2), r2=await runAll(S2,w2);
  assert.deepEqual(r2,rOn);
  const r=rOn[0], a=PAGE.autoWatched(clone(r.real.mineSnap),clone(r.real.foe),r.real.seed), b=PAGE.autoWatched(clone(r.real.mineSnap),clone(r.real.foe),r.real.seed);
  assert.equal(a.digest,b.digest,'the same fight twice');
});

test('4. gear, Temper, glyphs, prayers, Academy, skills and talents each change the fight, and help over 100 seeds',async()=>{
  const S=IP.load(SRC,{REAL_ENGINE_ARENA:'true',TALENTS_ENABLED:'true'});
  const mirror={}; for(const k of TEAM) mirror[k]=Object.assign({},L60,{gear:W.gearFor(k)});
  const D=W.player(S,'Mirror',mirror,{rank:5001});
  const add={ gear:k=>({gear:W.gearFor(k)}), temper:k=>({gear:W.gearFor(k),temper:12}), glyphs:()=>({glyphAtk:300}), prayers:()=>({temple:4}),
    academy:()=>({acad:40}), skills:()=>({skill:[60,60,60,60]}), talents:k=>({talents:build(k,0,30,60)}) };
  const without={ gear:{}, temper:k=>({gear:W.gearFor(k)}) };   // Temper is measured against the same item at Temper 0
  const seeds=Array.from({length:100},(_,i)=>(i+1)*2654435761>>>0);
  const run=(A)=>{ let w=0, sn=null; for(const s of seeds){ const r=S.arenaRealFight(A,D,{team:TEAM},s); assert.ok(!r.error,r.error); w+=r.won?1:0; sn=r.snaps; } return {w,sn}; };
  const res={}, cache=new Map();
  const runLo=(name,lo)=>{ const k=J(lo); if(!cache.has(k)) cache.set(k,run(W.player(S,'Lo-'+name,lo))); return cache.get(k); };
  for(const f in add){
    const lo={}, hi={}; for(const k of TEAM){ const base=Object.assign({},L60,f==='temper'?without.temper(k):(f==='gear'?{}:{gear:W.gearFor(k)})); lo[k]=base; hi[k]=Object.assign({},base,add[f](k)); }
    const a=runLo(f,lo), b=run(W.player(S,'Hi-'+f,hi));
    res[f]=[a.w,b.w];
    assert.notEqual(J(b.sn),J(a.sn),f+': the snaps are the same with one more');
    assert.ok(b.w>a.w,f+': one more did not win more often ('+a.w+' -> '+b.w+' of 100)'); }
  console.log('wins of 100, without -> with: '+J(res));
  // learned talents ride on the snap itself (the page re-attaches them from it)
  const A=W.player(S,'Tal',Object.fromEntries(TEAM.map(k=>[k,Object.assign({},L60,{talents:build(k,0,30,60)})])));
  assert.ok(S.arenaRealFight(A,D,{team:TEAM},5).snaps.every(s=>Array.isArray(s.tal)&&s.tal.length),'every snap carries its learned talents');
});

test('5. the client plays the server\'s fight back to the same end digest',async()=>{
  await onServer();
  for(const r of rOn.filter(x=>x.real).slice(0,3)){
    const C=SH.load(path.join(root,'emberweave-heroes.html'));   // a fresh page, as a player's browser has
    C.sandbox.__d=clone(r);
    const out=vm.runInContext(`(function(){ const d=__d; ACC.token='t';
      CUR={mode:'arena',local:true,oppName:'Def',oppRank:5001,oppId:'x',seed:d.real.seed>>>0,replayAlly:d.real.mineSnap,replayFoe:d.real.foe,arenaReal:d};
      CUR.arenaSnap=d.real.mineSnap; CUR.arenaFoe=d.real.foe; state='battle';
      _startVersusNow(trimTeam(d.real.foe),true,d.real.mineSnap.map(s=>s.key));   // what arenaRealStart starts (startVersus without its loader)
      let i=0; for(;i<14400&&!ended;i++){                                            // the frame loop's fixed step
        for(const u of units) if(u.team==='ally'&&u.alive){ queueInput({k:'ult',uid:u.uid,tid:null,wx:null,wy:null}); queueInput({k:'gear',uid:u.uid}); }   // taps during the watched fight change nothing
        updateBattle(SIM_STEP); }
      return {ended, dg:window._p2lastDigest}; })()`,C.ctx);
    assert.ok(out.ended,'the watched fight ended');
    const a=JSON.parse(out.dg), b=JSON.parse(r.real.digest);
    assert.equal(J({t:a.t,won:a.won,u:a.u}),J(b),'the watched fight ended in another state than the server\'s');
  }
});
