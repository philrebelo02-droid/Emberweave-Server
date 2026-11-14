'use strict';
/* REAL_ENGINE_SIEGE (D3 + D4, 14 Nov 2026; doc 09 section 10). Until this switch a siege paid the BROWSER's fight (`const won=b.won`) against the
   defenders frozen at the march start (a garrison line's snaps can be days old), the server's replay only a check. With the switch on the
   server fights the siege on arrival: the attacker frozen at the start (D3) against the defenders read NOW (each garrison hero its owner's
   hero at the fight, at the line's carried HP), with the watched clip timing, and pays that fight; the war mail plays it back. Proves, on the
   real server.js in-process and the page in sim-host:
     1. switch OFF: garrison lines, starts, refusals, resolves, a replayed receipt answer exactly as server.js at BASE; the world ends the same;
     2. switch ON: the start records the engine; the result is PAGE.autoWatched(attacker snaps, live defenders, seed) - the live defenders are
        the page's resolution of each owner's campaignHeroSpec at the fight (a gear change after garrisoning counts) at the carried HP; the
        guards are the site's mineGarrison; wounds, the garrison left behind and the receipt follow that fight; the browser's claim is ignored;
     3. the engine is fixed at the start: a march started with the switch off resolves the old way on a server with it on, and the reverse;
     4. the client: a real march is not fought in the browser, and the war mail's replay ends on the paid fight's exact state;
     5. gear, Temper, glyphs, prayers, Academy, skills and talents a garrison owner adds AFTER garrisoning each change the live defenders and
        make the siege harder (20 seeds each - the machine rule caps a measurement at about 200 fights);
     6. determinism: a second server, the same world and requests, the same answers.
   BASE = server.js at REAL_ENGINE_BASE_SIEGE (default fd07fa6d3, the commit this mode started from). Run: node --test tests/real-engine-siege.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const IP=require('./helpers/server-inproc.cjs'),W=require('./helpers/arena-world.cjs'),SW=require('./helpers/siege-world.cjs'),SY=require('./helpers/systems.cjs');
const SH=require(path.join(root,'server','sim-host.js')), SG=require(path.join(root,'assets','ui','world-siege.js'));
const BASE_SHA=process.env.REAL_ENGINE_BASE_SIEGE||'fd07fa6d3';
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
let BASE_SRC=null; try{ BASE_SRC=cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8'); }catch(e){ console.log('BASE server.js not available - test 1 is skipped'); }
const PAGE=SH.load(path.join(root,'emberweave-heroes.html'));
const J=JSON.stringify, clone=x=>JSON.parse(J(x));
const ENV={SERVER_SECRET:'real-engine-siege-test-secret',TALENTS_ENABLED:'true'};
const ON_ENV=Object.assign({REAL_ENGINE_SIEGE:'true'},ENV);
const T=(S,u)=>S.token(u.id);
/* the world and every request, in order. Resolves carry what the browser fought (PAGE.auto on the start reply: the client's simFightResult),
   except where noted. Between the starts and the resolves D1 puts gear on a garrisoned hero (the live read must see it). */
async function scenario(S,o){ o=o||{}; const w=SW.build(S), out=[]; let i=0;
  const call=async(p,u,b)=>{ const r=await S.call(p,b,T(S,u),7000+i,'10.8.0.'+(i++)); out.push(r); return r; };
  await call('/api/world/siege/garrison',w.D1,{siteId:w.X.id,heroIds:['gruel','sylthaine','vex'],requestId:'g1'});
  await call('/api/world/siege/garrison',w.D2,{siteId:w.X.id,heroIds:['vireo','vael'],requestId:'g2'});
  SW.arrive(S,w);
  const s1=(await call('/api/world/siege/start',w.A1,{siteId:w.X.id,heroIds:['vael','sylthaine','vireo'],requestId:'s1'})).data;
  const s2=(await call('/api/world/siege/start',w.A2,{siteId:w.Y.id,heroIds:['vex','gruel','vael'],requestId:'s2'})).data;
  await call('/api/world/siege/start',w.A3,{siteId:w.X.id,heroIds:['vireo'],requestId:'s3'});   // no guild: refused
  await call('/api/world/siege/resolve',w.A2,{marchId:s2.marchId,requestId:'early'});           // not arrived
  if(o.between) o.between(S,w);
  W.setHero(S,S.getDB().users[w.D1.id],'sylthaine',Object.assign({},SW.L40,{gear:W.gearFor('sylthaine')}));   // after garrisoning
  SW.arriveMarch(S,w.A1,s1.marchId); SW.arriveMarch(S,w.A2,s2.marchId);
  const claim=s=>{ const f=PAGE.auto(clone(s.snaps),clone(s.foe),s.seed); return {won:f.won,digest:f.digest}; };
  const c1=claim(s1), c2=claim(s2);
  await call('/api/world/siege/resolve',w.A1,Object.assign({marchId:s1.marchId,requestId:'r1'},o.lie?{won:!c1.won,digest:'{}'}:c1));
  await call('/api/world/siege/resolve',w.A1,Object.assign({marchId:s1.marchId,requestId:'r1'},c1));   // a replayed requestId
  await call('/api/world/siege/resolve',w.A2,Object.assign({marchId:s2.marchId,requestId:'r2'},c2));
  await call('/api/world/siege/resolve',w.A2,{marchId:'no-such-march',requestId:'r3',won:true,digest:'{}'});
  return {w,out,s1,s2}; }
const TIMEISH=new Set(['t','arriveAt','resolvedAt','id','marchId','engine','depart','homeAt','since','protectedUntil','route','tickAt','ledger','returnAt','at','iat','exp','fetchedAt']);
const strip=x=>Array.isArray(x)?x.map(strip):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).filter(k=>!TIMEISH.has(k)).map(k=>[k,strip(x[k])])):x;
const world=(S,w)=>strip({sieges:S.getDB().worldSieges,users:Object.fromEntries(['A1','A2','A3','D1','D2'].map(k=>{ const u=S.getDB().users[w[k].id];
  return [k,{mail:u.pvpMail||[],hut:u.witch?u.witch.hp:null,marches:u.worldCityMarches||[],inc:(u.led.battleIncidents||[]).map(x=>[x.why,x.mode])}]; }))});
function diffs(a,b,p,out){ out=out||[]; p=p||''; if(J(a)===J(b)) return out; if(a&&b&&typeof a==='object'&&typeof b==='object'){ for(const k of new Set([...Object.keys(a),...Object.keys(b)])) diffs(a[k],b[k],p+'.'+k,out); } else out.push(p+': '+String(J(a)).slice(0,80)+' vs '+String(J(b)).slice(0,80)); return out; }
/* the defenders the test expects at the fight, computed here from the DB (not by the route): the same lines and pick as at the start, each hero
   resolved again from its owner's live spec by a fresh page, at the line's carried HP (the same fraction of health; the same HP if unchanged) */
function expectLive(S,w){ const rec=S.getDB().worldSieges.sites[w.X.id], pick=[], seen=new Set();
  for(const l of rec.garrison){ if(!(+l.arriveAt<=Date.now())) continue; for(const s of l.snaps){ if(pick.length>=5) break; if(!(+s.hp>0)||seen.has(s.key)) continue; seen.add(s.key); pick.push({s,uid:l.uid}); } }
  return pick.map(({s,uid})=>{ const n=PAGE.snapFromSpecs(clone([S.campaignHeroSpec(S.getDB().users[uid],s.key)]))[0];
    const hp=n.maxHp===s.maxHp?s.hp:Math.max(1,Math.round(n.maxHp*Math.min(1,s.hp/s.maxHp))); return Object.assign({},n,{hp,worldEntryHpCap:hp}); }); }

test('1. switch off: the siege answers exactly as the commit this mode started from',{skip:!BASE_SRC},async()=>{
  const B=IP.load(BASE_SRC,ENV), N=IP.load(SRC,ENV), rb=await scenario(B), rn=await scenario(N);
  assert.ok(rn.out[2].data.ok&&rn.out[3].data.ok&&rn.out[6].data.ok&&rn.out[8].data.ok,'the scenario ran: '+J(rn.out.map(r=>[r.status,r.data.error])));
  assert.equal(rn.out[2].data.real,undefined); assert.equal(rn.out[6].data.playerTruth,true,'with the switch off the browser\'s fight is paid');
  assert.deepEqual(rn.out.map(strip),rb.out.map(strip),'the replies differ from BASE: '+diffs(rn.out.map(strip),rb.out.map(strip)).slice(0,6).join(' | '));
  assert.deepEqual(world(N,rn.w),world(B,rb.w),'the world differs from BASE: '+diffs(world(N,rn.w),world(B,rb.w)).slice(0,6).join(' | '));
  const m=N.getDB().users[rn.w.A1.id].worldCityMarches.find(x=>x.kind==='siege'); assert.equal(m.realEngine,undefined,'nothing real-engine is stored');
});

let ON=null,rOn=null;
async function onServer(){ if(ON) return; ON=IP.load(SRC,ON_ENV); rOn=await scenario(ON,{lie:true}); }

test('2. switch on: the server fights the siege against the defenders read at the fight, and pays that fight',async()=>{
  await onServer(); const {w,out,s1,s2}=rOn, DB=ON.getDB();
  assert.equal(s1.real,1); assert.equal(s2.real,1); assert.equal(DB.users[w.A1.id].worldCityMarches.find(x=>x.id===s1.marchId).realEngine,1,'the start records the engine');
  const r1=out[6].data, r1b=out[7].data, r2=out[8].data;
  assert.ok(r1.ok&&r2.ok,J([r1,r2]).slice(0,300)); assert.deepEqual(r1b,r1,'a replayed requestId answers its receipt');
  assert.equal(out[5].data.ok,false); assert.equal(out[9].data.ok,false); assert.equal(out[4].data.ok,false);
  // X: the garrison, read live
  assert.equal(r1.real,1); assert.equal(r1.playerTruth,false); assert.equal(r1.defenders,'garrison');
  const live=expectLive(ON,w), frozen=s1.foe;
  assert.deepEqual(r1.replay.foe,live,'the defenders fought are not the owners\' heroes at the fight');
  const sy=live.findIndex(s=>s.key==='sylthaine'), fz=frozen.find(s=>s.key==='sylthaine');
  assert.ok(sy>=0&&live[sy].maxHp!==fz.maxHp,'the gear D1 put on after garrisoning is not in the fight');
  const wounded=live.find(s=>s.key==='gruel'), wz=frozen.find(s=>s.key==='gruel');
  assert.ok(wounded.hp<wounded.maxHp&&Math.abs(wounded.hp/wounded.maxHp-wz.hp/wz.maxHp)<0.001,'the carried HP of the garrison is not kept');
  const f1=PAGE.autoWatched(clone(s1.snaps),clone(live),s1.seed);
  assert.equal(r1.won,f1.won,'the verdict is not the server\'s fight'); assert.equal(r1.replay.digest,f1.digest); assert.equal(r1.replay.durationSec,JSON.parse(f1.digest).t);
  assert.equal(r1.replay.seed,s1.seed,'the seed frozen at the start');
  assert.notEqual(J(PAGE.autoWatched(clone(s1.snaps),clone(frozen),s1.seed).digest),J(f1.digest),'(the frozen defenders would give the same fight - this world proves nothing)');
  // the browser claimed the opposite verdict with an empty digest: ignored, no incident, no flag
  assert.deepEqual((DB.users[w.A1.id].led.battleIncidents||[]).filter(x=>x.mode==='siege'),[],'a real siege files no replay incident');
  // wounds from the server's fight
  const end=JSON.parse(f1.digest);
  for(const x of r1.injuries){ const sn=s1.snaps.find(q=>q.key===x.key), row=end.u.find(q=>q[0]===x.key&&q[1]==='ally'), hp=row&&row[2]?Math.max(0,Math.min(sn.worldEntryHpCap,row[3])):0;
    assert.equal(x.after,Math.min(x.before,Math.round(Math.max(0,Math.min(1,hp/sn.maxHp))*10000)),'the wounds paid are not the server fight\'s ('+x.key+')'); }
  // Y: the guards
  assert.equal(r2.defenders,'guards'); assert.deepEqual(r2.replay.foe,PAGE.mineGarrison(SG.guardNode(w.Y)));
  const f2=PAGE.autoWatched(clone(s2.snaps),clone(r2.replay.foe),s2.seed); assert.equal(r2.won,f2.won); assert.equal(r2.replay.digest,f2.digest);
  if(r2.won){ assert.equal(r2.seized,true); const g=DB.worldSieges.sites[w.Y.id].garrison[0];
    for(const s of g.snaps){ const row=JSON.parse(f2.digest).u.find(q=>q[0]===s.key&&q[1]==='ally'); assert.equal(s.hp,Math.max(0,Math.min(s2.snaps.find(q=>q.key===s.key).worldEntryHpCap,row[3])),'the line left behind is not as the server\'s fight left it'); } }
  console.log('switch on: X (garrison) won='+r1.won+', Y (guards) won='+r2.won+'; X frozen-foe fight would have been won='+PAGE.autoWatched(clone(s1.snaps),clone(frozen),s1.seed).won);
});

test('3. the engine is fixed at the start: a march never changes engine on the way',async()=>{
  // started with the switch off, resolved on a server with it on: the old rule (the browser's fight paid, the server's a check)
  const OFF=IP.load(SRC,ENV), w=SW.build(OFF); SW.arrive(OFF,w);
  const s=(await OFF.call('/api/world/siege/start',{siteId:w.Y.id,heroIds:['vex','gruel','vael'],requestId:'x1'},T(OFF,w.A2),3,'10.8.1.1')).data; assert.ok(s.ok&&s.real===undefined);
  SW.arriveMarch(OFF,w.A2,s.marchId); const f1=path.join(OFF.dir,'db.json'); fs.writeFileSync(f1,J(OFF.getDB()));
  const ONx=IP.load(SRC,Object.assign({DB_FILE:f1},ON_ENV));
  const u=await ONx.call('/api/world/siege/resolve',{marchId:s.marchId,requestId:'x2'},T(ONx,w.A2),4,'10.8.1.1');
  assert.equal(u.data.unverified,true,'a march started before the switch must still be fought by the browser');
  const c=PAGE.auto(clone(s.snaps),clone(s.foe),s.seed), r=await ONx.call('/api/world/siege/resolve',{marchId:s.marchId,requestId:'x3',won:c.won,digest:c.digest},T(ONx,w.A2),5,'10.8.1.1');
  assert.ok(r.data.ok&&r.data.playerTruth===true&&r.data.real===undefined&&r.data.won===c.won,J(r.data).slice(0,200));
  // started with it on, resolved on a server with it off: the real engine
  const ONy=IP.load(SRC,ON_ENV), w2=SW.build(ONy); SW.arrive(ONy,w2);
  const s2=(await ONy.call('/api/world/siege/start',{siteId:w2.Y.id,heroIds:['vex','gruel','vael'],requestId:'y1'},T(ONy,w2.A2),3,'10.8.1.2')).data; assert.equal(s2.real,1);
  SW.arriveMarch(ONy,w2.A2,s2.marchId); const f2=path.join(ONy.dir,'db2.json'); fs.writeFileSync(f2,J(ONy.getDB()));
  const OFFy=IP.load(SRC,Object.assign({DB_FILE:f2},ENV));
  const r2=await OFFy.call('/api/world/siege/resolve',{marchId:s2.marchId,requestId:'y2'},T(OFFy,w2.A2),4,'10.8.1.2');
  assert.ok(r2.data.ok&&r2.data.real===1,'a march started on the real engine keeps it: '+J(r2.data).slice(0,200));
  assert.equal(r2.data.won,PAGE.autoWatched(clone(s2.snaps),clone(r2.data.replay.foe),s2.seed).won);
});

function clientPage(){ return SH.load(path.join(root,'emberweave-heroes.html')); }
test('4. the client: a real siege is not fought in the browser, and the war mail replays the paid fight exactly',async()=>{
  await onServer();
  // resolveMarch on the page: a real march posts without fighting; a march of the old kind fights first (control)
  for(const real of [1,0]){ const C=clientPage(); C.sandbox.__s=clone(Object.assign({},rOn.s2,{real:real||undefined}));
    const r=vm.runInContext(`(function(){ ACC.token='t'; let fought=0, body=null; const sf=simFightResult; simFightResult=function(){ fought++; return sf.apply(this,arguments); };
      api=function(p,m,b){ body=b; return new Promise(()=>{}); };
      const m={ctype:'siege',dir:'out',serverCityId:'m1',tName:'Y',siege:{seed:__s.seed,snaps:__s.snaps,foe:__s.foe,real:__s.real}};
      if(!__s.real) delete m.siege.real; resolveMarch(m); return {fought,body}; })()`,C.ctx);
    if(real){ assert.equal(r.fought,0,'the browser fought a siege the server fights'); assert.ok(r.body&&r.body.marchId==='m1'); }
    else assert.equal(r.fought,1,'(control) a march of the old kind is fought in the browser'); }
  // the war mail the client files ({v:2, seed, mineSnap, foe} from the receipt) plays back to the server's digest
  for(const r of [rOn.out[6].data,rOn.out[8].data]){ const C=clientPage(); C.sandbox.__m={v:2,seed:r.replay.seed,mineSnap:r.replay.snaps,foe:r.replay.foe,won:r.won};
    const o=vm.runInContext(`(function(){ ACC.token='t'; startVersus=(e,a,k)=>_startVersusNow(e,a,k); watchBattle(__m);
      let i=0; for(;i<14400&&!ended;i++) updateBattle(SIM_STEP); return window._p2lastDigest; })()`,C.ctx);
    const a=JSON.parse(o), p=JSON.parse(r.replay.digest);
    assert.equal(J({t:a.t,won:a.won,u:a.u}),J({t:p.t,won:p.won,u:p.u}),'the replay is another fight than the one paid'); }
});

test('5. what a garrison owner adds after garrisoning counts: gear, Temper, glyphs, prayers, Academy, skills, talents',async()=>{
  const S=IP.load(SRC,ON_ENV), host=S.simHost();
  const pool=require(path.join(root,'server','sim-pool.js')).create(path.join(root,'emberweave-heroes.html'),{size:2,queueMax:10000,timeoutMs:600000,queueWaitMs:600000}); test.after(()=>pool.close());
  for(let i=0;i<300&&!pool.stats.ready;i++) await new Promise(r=>setTimeout(r,100));
  const TEAM=['vael','sylthaine','vireo'], base={level:60,stars:5,skill:[20,20,20,20],asc:4}, N=20, seeds=Array.from({length:N},(_,i)=>(i+1)*2654435761>>>0);
  const att=W.player(S,'SgAtt',Object.fromEntries(TEAM.map(k=>[k,Object.assign({},base,{gear:W.gearFor(k)})]))); att.guildId='GA';
  const aSnaps=PAGE.snapFromSpecs(clone(TEAM.map(k=>S.campaignHeroSpec(att,k)))).map(s=>Object.assign({},s,{hp:s.maxHp,worldEntryHpCap:s.maxHp}));
  const add={ gear:k=>({gear:W.gearFor(k)}), temper:k=>({gear:W.gearFor(k),temper:12}), glyphs:()=>({glyphAtk:300}), prayers:()=>({temple:4}),
    academy:()=>({acad:40}), skills:()=>({skill:[60,60,60,60]}), talents:k=>({talents:SY.build(k,0,30,base.level)}) };
  const site=SW.SITES.X, res={}, bad=[], cache=new Map();
  const wins=async foe=>{ const k=J(foe); if(!cache.has(k)) cache.set(k,(await Promise.all(seeds.map(s=>pool.run('autoWatched',[aSnaps,foe,s])))).filter(r=>r.won).length); return cache.get(k); };
  for(const f in add){ const lo={}, hi={};
    for(const k of TEAM){ const b0=Object.assign({},base,f==='gear'?{}:{gear:W.gearFor(k)}); lo[k]=b0; hi[k]=Object.assign({},b0,add[f](k)); }
    const own=W.player(S,'SgOwn-'+f,lo); own.guildId='GD';
    const frozen=PAGE.snapFromSpecs(clone(TEAM.map(k=>S.campaignHeroSpec(own,k)))).map(s=>Object.assign({},s,{hp:s.maxHp,worldEntryHpCap:s.maxHp}));
    const held={type:'guild',id:'GD',garrison:[{marchId:'l-'+f,uid:own.id,heroIds:TEAM,snaps:frozen,arriveAt:1,since:1}]}, march={foe:frozen,defenders:'garrison'};
    const before=S.siegeRealFoe(host,held,site,att,march,Date.now()).foe;
    for(const k of TEAM) W.setHero(S,own,k,hi[k]);   // the owner improves the heroes while they stand in the garrison
    const after=S.siegeRealFoe(host,held,site,att,march,Date.now()).foe;
    const a=await wins(before), b=await wins(after); res[f]=[a,b];
    if(J(after)===J(before)) bad.push(f+': the live defenders did not change'); else if(!(b<=a)) bad.push(f+': attacker wins '+a+' -> '+b); }
  console.log('siege attacker wins of '+N+' against the garrison, before -> after the owner\'s upgrade: '+J(res));
  assert.deepEqual(bad,[]);
  assert.ok(Object.values(res).filter(([a,b])=>b<a).length>=5,'fewer than 5 of 7 upgrades made the garrison measurably harder: '+J(res));
});

test('6. determinism: a second server given the same world and requests gives the same sieges',async()=>{
  await onServer();
  const S2=IP.load(SRC,ON_ENV), r2=await scenario(S2,{lie:true});
  assert.deepEqual(r2.out.map(strip),rOn.out.map(strip)); assert.deepEqual(world(S2,r2.w),world(ON,rOn.w));
});
