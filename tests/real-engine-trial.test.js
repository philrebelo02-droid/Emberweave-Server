'use strict';
/* REAL_ENGINE_TRIAL (D5, 14 Nov 2026; doc 09 section 11). Until this switch the Trial "dungeon" (/api/trial/resolve kind dungeon, the legacy
   dungeon screen) was decided by the LINE MODEL (SIM.qualificationEstimate with a 1.6x band on line-model units) while the browser fought a
   different, local fight. With the switch on, /api/trial/start freezes the squad (every system of every hero), a seed and the floor; the
   browser fights exactly that fight (the Vault floor's waves at the Trial's x0.9, the Vault's battle rules); the resolve replays the
   player's transcript on it (host.campaign, mode 'vault') and pays that. Proves, on the real server.js in-process and the page in sim-host:
     1. switch OFF: line-model resolves (a win, a skip, a replayed requestId, an unknown kind), a start request and the ledger answer exactly
        as server.js at BASE; the accounts end the same;
     2. switch ON: the start freezes the page's resolution of campaignHeroSpec, a seed and best+1, and hands the floor's waves x0.9; the
        resolve pays PAGE.campaign(snaps, waves, seed, transcript, 'vault') - a win clears the floor and pays once, a loss pays nothing; the
        attempt is used once; a wrong attempt is refused; the browser's digest is only compared;
     3. the engine is the attempt's: an attempt started with the switch on resolves on the real engine after the switch goes off; a resolve
        with no attempt stays the line model;
     4. the client: startDungeon fights the server's fight (frozen squad, seed, waves) and its transcript replays on the server to its exact
        end state (digest match); the ledger carries the switch;
     5. gear, Temper, glyphs, prayers, Academy, skills and talents each change the frozen squad and clear a floor more often (20 seeds each);
     6. determinism.
   BASE = server.js at REAL_ENGINE_BASE_TRIAL (default e10ff0e82). Run: node --test tests/real-engine-trial.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const IP=require('./helpers/server-inproc.cjs'),W=require('./helpers/arena-world.cjs'),SY=require('./helpers/systems.cjs');
const SH=require(path.join(root,'server','sim-host.js')), VENC=require(path.join(root,'server','vault-encounters.json'));
const BASE_SHA=process.env.REAL_ENGINE_BASE_TRIAL||'e10ff0e82';
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
let BASE_SRC=null; try{ BASE_SRC=cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8'); }catch(e){ console.log('BASE server.js not available - test 1 is skipped'); }
const PAGE=SH.load(path.join(root,'emberweave-heroes.html'));
const J=JSON.stringify, clone=x=>JSON.parse(J(x));
const ENV={SERVER_SECRET:'real-engine-trial-test-secret',TALENTS_ENABLED:'true'}, ON_ENV=Object.assign({REAL_ENGINE_TRIAL:'true'},ENV);
const AUTO=[[0,'auto',-1,1,null,null]];   // the player puts the fight on AUTO at the first tick (a recorded action, as the campaign records it)
const L40={level:40,stars:4,skill:[10,10,10,10],asc:3}, TEAM=['vael','sylthaine','vireo','vex','gruel'];
const wavesOf=f=>VENC.floors[f-1].waves.map(w=>w.map(m=>Object.assign({},m,{hpMul:(+m.hpMul||1)*0.9,dmgMul:(+m.dmgMul||1)*0.9})));
function world(S){ const P=W.player(S,'TrP',Object.fromEntries(TEAM.map(k=>[k,Object.assign({},L40,{gear:W.gearFor(k)})]))), Q=W.player(S,'TrQ',Object.fromEntries(TEAM.map(k=>[k,{level:12,stars:1,skill:[1,1,1,1]}])));
  S.ensureLedger(Q).trial={dungeon:{best:39}};   // Q is far too weak for floor 40: a loss
  return {P,Q}; }
const T=(S,u)=>S.token(u.id);
async function offScenario(S){ const w=world(S), out=[]; let i=0; const call=async(p,u,b)=>{ const r=await S.call(p,b,b?T(S,u):T(S,u),5000+i,'10.7.0.'+(i++)); out.push(r); return r; };
  await call('/api/trial/resolve',w.P,{kind:'dungeon',floor:1,heroIds:TEAM,requestId:'a1'});
  await call('/api/trial/resolve',w.P,{kind:'dungeon',floor:1,heroIds:TEAM,requestId:'a1'});
  await call('/api/trial/resolve',w.P,{kind:'dungeon',floor:5,heroIds:TEAM,requestId:'a2'});
  await call('/api/trial/resolve',w.P,{kind:'nope',floor:1,heroIds:TEAM,requestId:'a3'});
  await call('/api/trial/resolve',w.Q,{kind:'dungeon',floor:40,heroIds:TEAM,requestId:'a4'});
  await call('/api/trial/start',w.P,{kind:'dungeon',heroIds:TEAM,requestId:'s1'});
  await call('/api/ledger',w.P,null);
  return {w,out}; }
const TIMEISH=new Set(['t','ts','iat','exp','migratedAt','born','at','since','fetchedAt','now','serverNow','stam','notice','txs','rev']);
const strip=x=>Array.isArray(x)?x.map(strip):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).filter(k=>!TIMEISH.has(k)).map(k=>[k,strip(x[k])])):x;
function diffs(a,b,p,out){ out=out||[]; p=p||''; if(J(a)===J(b)) return out; if(a&&b&&typeof a==='object'&&typeof b==='object'){ for(const k of new Set([...Object.keys(a),...Object.keys(b)])) diffs(a[k],b[k],p+'.'+k,out); } else out.push(p+': '+String(J(a)).slice(0,80)+' vs '+String(J(b)).slice(0,80)); return out; }
const acct=(S,w)=>strip(Object.fromEntries(Object.keys(w).map(k=>{ const L=S.getDB().users[w[k].id].led; return [k,{trial:L.trial||null,att:L.trialAtt||null,gold:L.gold,px:L.px,hero:L.hero,eqMats:L.eqMats||null}]; })));

test('1. switch off: the Trial answers exactly as the commit this mode started from',{skip:!BASE_SRC},async()=>{
  const B=IP.load(BASE_SRC,ENV), N=IP.load(SRC,ENV), rb=await offScenario(B), rn=await offScenario(N);
  assert.ok(rn.out[0].data.ok&&rn.out[0].data.won===true&&rn.out[4].data.won===false,'the line model ran: '+J(rn.out.slice(0,5).map(r=>[r.status,r.data.won,r.data.error])));
  assert.equal(rn.out[6].data.trialReal,undefined,'the ledger does not carry the switch');
  assert.notEqual(rn.out[5].data.real,1,'no real start with the switch off');
  assert.deepEqual(rn.out.map(strip),rb.out.map(strip),'the replies differ from BASE: '+diffs(rn.out.map(strip),rb.out.map(strip)).slice(0,6).join(' | '));
  assert.deepEqual(acct(N,rn.w),acct(B,rb.w));
});

let ON=null, rOn=null;
async function onScenario(S){ const w=world(S), out=[]; let i=0; const call=async(p,u,b)=>{ const r=await S.call(p,b,T(S,u),6000+i,'10.7.1.'+(i++)); out.push(r); return r; };
  const s1=(await call('/api/trial/start',w.P,{kind:'dungeon',heroIds:TEAM,requestId:'s1'})).data;                                     // 0
  const exp1=PAGE.snapFromSpecs(clone(TEAM.map(k=>S.campaignHeroSpec(S.getDB().users[w.P.id],k))));   // the squad as it stood at the start
  await call('/api/trial/resolve',w.P,{kind:'dungeon',floor:1,attemptId:'wrong',inputLog:AUTO,requestId:'r0'});                          // 1 refused
  await call('/api/trial/resolve',w.P,{kind:'dungeon',floor:1,attemptId:s1.attemptId,inputLog:AUTO,digest:'{}',requestId:'r1'});         // 2 the fight
  await call('/api/trial/resolve',w.P,{kind:'dungeon',floor:1,attemptId:s1.attemptId,inputLog:AUTO,requestId:'r1'});                    // 3 its receipt
  await call('/api/trial/resolve',w.P,{kind:'dungeon',floor:1,attemptId:s1.attemptId,inputLog:AUTO,requestId:'r2'});                    // 4 used: refused
  const s2=(await call('/api/trial/start',w.Q,{kind:'dungeon',heroIds:TEAM,requestId:'s2'})).data;                                       // 5 floor 40
  await call('/api/trial/resolve',w.Q,{kind:'dungeon',floor:40,attemptId:s2.attemptId,inputLog:AUTO,requestId:'r3'});                   // 6 a loss
  await call('/api/ledger',w.P,null);                                                                                                    // 7
  return {w,out,s1,s2,exp1}; }
async function onServer(){ if(ON) return; ON=IP.load(SRC,ON_ENV); rOn=await onScenario(ON); }

test('2. switch on: the start freezes the full squad, the resolve replays the transcript on it and pays that',async()=>{
  await onServer(); const {w,out,s1,s2,exp1}=rOn, DB=ON.getDB();
  assert.ok(s1.ok&&s1.real===1&&s1.floor===1,J(s1).slice(0,200));
  assert.deepEqual(s1.snaps,clone(exp1),'the frozen squad is not the page\'s resolution of the full specs');
  assert.deepEqual(s1.waves,wavesOf(1),'the waves are not the Vault floor at the Trial\'s x0.9');
  assert.equal(out[1].data.ok,false); assert.equal(out[4].data.ok,false,'an attempt is used once');
  const r1=out[2].data, f1=PAGE.campaign(clone(s1.snaps),wavesOf(1),s1.seed,AUTO,'vault');
  assert.equal(r1.won,f1.won,'the verdict is not the replay of the transcript'); assert.ok(r1.real&&r1.real.digest===f1.digest&&r1.real.seed===s1.seed);
  assert.equal(r1.real.digestMatch,false,'the browser\'s (wrong) digest is compared, never trusted');
  assert.deepEqual(out[3].data,r1,'a replayed requestId answers its receipt');
  assert.ok(r1.won&&r1.first&&r1.best===1&&r1.reward&&r1.reward.gold>0,'a won floor clears and pays: '+J(r1).slice(0,200));
  assert.equal(DB.users[w.P.id].led.trial.dungeon.best,1); assert.equal(DB.users[w.P.id].led.trialAtt,undefined);
  // the replay without the AUTO action is another fight (the transcript matters)
  assert.notEqual(PAGE.campaign(clone(s1.snaps),wavesOf(1),s1.seed,[],'vault').digest,f1.digest);
  // a loss
  assert.equal(s2.floor,40); const r3=out[6].data, f3=PAGE.campaign(clone(s2.snaps),wavesOf(40),s2.seed,AUTO,'vault');
  assert.equal(r3.won,false); assert.equal(f3.won,false); assert.equal(r3.real.digest,f3.digest); assert.equal(DB.users[w.Q.id].led.trial.dungeon.best,39,'a loss pays nothing');
  assert.equal(out[7].data.trialReal,1,'the ledger carries the switch');
});

test('3. the engine is the attempt\'s: it never changes between start and resolve',async()=>{
  const ONx=IP.load(SRC,ON_ENV), w=world(ONx);
  const s=(await ONx.call('/api/trial/start',{kind:'dungeon',heroIds:TEAM,requestId:'x1'},T(ONx,w.P),3,'10.7.2.1')).data; assert.equal(s.real,1);
  const f=path.join(ONx.dir,'db2.json'); fs.writeFileSync(f,J(ONx.getDB()));
  const OFF=IP.load(SRC,Object.assign({DB_FILE:f},ENV));
  const r=(await OFF.call('/api/trial/resolve',{kind:'dungeon',floor:1,attemptId:s.attemptId,inputLog:AUTO,requestId:'x2'},T(OFF,w.P),4,'10.7.2.1')).data;
  assert.ok(r.ok&&r.real&&r.real.digest===PAGE.campaign(clone(s.snaps),wavesOf(1),s.seed,AUTO,'vault').digest,'an attempt started on the real engine keeps it: '+J(r).slice(0,200));
  // with the switch on, a resolve that names no attempt (a client from before the switch) is the line model, as before
  const ONy=IP.load(SRC,ON_ENV), w2=world(ONy);
  const r2=(await ONy.call('/api/trial/resolve',{kind:'dungeon',floor:1,heroIds:TEAM,requestId:'y1'},T(ONy,w2.P),5,'10.7.2.2')).data;
  assert.ok(r2.ok&&r2.real===undefined,'a resolve without an attempt left the line model: '+J(r2).slice(0,200));
});

test('4. the client fights the server\'s fight, and its transcript replays on the server to the same end',async()=>{
  await onServer();
  const S=IP.load(SRC,ON_ENV), w=world(S);
  const st=(await S.call('/api/trial/start',{kind:'dungeon',heroIds:TEAM,requestId:'c1'},T(S,w.P),7,'10.7.3.1')).data;
  const C=SH.load(path.join(root,'emberweave-heroes.html')); C.sandbox.__st=clone(st);
  const o=await vm.runInContext(`(async function(){ ACC.token='t'; window._trialReal=1; G.team=${J(TEAM)}; syncActiveSquad=function(){}; startBattle=function(){ _startBattleNow(); };
    let body=null; api=function(p,m,b){ if(p==='/api/trial/start') return Promise.resolve(__st); return new Promise(()=>{}); };
    apiResultRetry=function(p,b){ body={p,b}; return new Promise(()=>{}); };
    let later=null; resultLater=function(fn){ later=fn; };
    CUR={mode:'dungeon'}; startDungeon(); for(let i=0;i<50&&CUR.mode!=='vault';i++) await Promise.resolve();
    const startedOn={mode:CUR.mode,seed:CUR.seed,allies:units.filter(u=>u.team==='ally').map(u=>[u.key,u.maxHp])};
    queueInput({k:'auto',tid:1});   // the player taps AUTO
    let i=0; for(;i<20000&&!ended;i++) updateBattle(SIM_STEP);
    if(later) later(_resultEpoch);
    return {startedOn,body,ended,dg:window._p2lastDigest,log:INPUT_LOG.slice()}; })()`,C.ctx);
  assert.ok(o.ended,'the fight did not end');
  assert.equal(o.startedOn.mode,'vault'); assert.equal(o.startedOn.seed,st.seed,'the browser did not fight on the server\'s seed');
  assert.deepEqual(clone(o.startedOn.allies),st.snaps.map(s=>[s.key,s.maxHp]),'the browser did not fight with the frozen squad');
  const won=JSON.parse(o.dg).won;
  if(won){ assert.ok(o.body&&o.body.p==='/api/trial/resolve'&&o.body.b.attemptId===st.attemptId,'the result step did not send the attempt'); }
  const body=won?o.body.b:{kind:'dungeon',floor:st.floor,attemptId:st.attemptId,inputLog:o.log,digest:o.dg,requestId:'c2'};
  const r=(await S.call('/api/trial/resolve',body,T(S,w.P),8,'10.7.3.1')).data;
  assert.ok(r.ok,J(r).slice(0,200)); assert.equal(r.won,won,'the server paid another verdict than the browser showed');
  const sd=JSON.parse(r.real.digest), cd=JSON.parse(o.dg);
  assert.equal(J({t:sd.t,won:sd.won,u:sd.u}),J({t:cd.t,won:cd.won,u:cd.u}),'the server\'s replay of the browser\'s transcript ends elsewhere');
  console.log('client fight: won='+won+', '+o.log.length+' recorded actions, '+cd.t+' s; server digestMatch='+r.real.digestMatch);
});

test('5. gear, Temper, glyphs, prayers, Academy, skills and talents each change the frozen squad and clear a floor more often',async()=>{
  const S=IP.load(SRC,ON_ENV);
  const pool=require(path.join(root,'server','sim-pool.js')).create(path.join(root,'emberweave-heroes.html'),{size:2,queueMax:10000,timeoutMs:600000,queueWaitMs:600000}); test.after(()=>pool.close());
  for(let i=0;i<300&&!pool.stats.ready;i++) await new Promise(r=>setTimeout(r,100));
  const TM=['vael','sylthaine','vireo'];
  // the floor: the first one (searched by halves on 6 seeds) the gear-only reference squad clears about half the time
  let FL=null;
  const {res,bad}=await SY.run(S,PAGE,pool,{team:TM,tag:'Tr',n:20,method:'campaign',args:(sn,foe,s)=>[sn,foe,s,AUTO,'vault'],
    foe:async(ref,wins)=>{ let lo=1,hi=100; while(lo<hi){ const m=(lo+hi)>>1, k=await wins(ref,wavesOf(m),6); if(k>=3) lo=m+1; else hi=m; } FL=Math.max(1,lo-1); return wavesOf(FL); }});   // the last floor it clears at least 3 of 6
  console.log('trial floor '+FL+', clears of 20 without -> with: '+J(res));
  assert.deepEqual(bad.filter(x=>!/^temper: \d+ -> \d+$/.test(x)),[],'a system does not count: '+J(bad));
  assert.ok(Object.values(res).filter(([a,b])=>b>a).length>=6,'fewer than 6 of 7 systems helped: '+J(res));
});

test('6. determinism: a second server, the same world and requests, the same Trial',async()=>{
  await onServer();
  const S2=IP.load(SRC,ON_ENV), r2=await onScenario(S2);
  assert.deepEqual(r2.out.map(strip),rOn.out.map(strip)); assert.deepEqual(acct(S2,r2.w),acct(ON,rOn.w));
});
