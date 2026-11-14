'use strict';
/* REAL_ENGINE_NPC_CASTLE + D2 (14 Nov 2026, Phil: "Everything in the game uses every feature ... when that hero ID is put into a fight it is
   that hero"; the coordinator's D2: bots and NPCs as strong as today). Proves, on the real server.js in-process and the page in sim-host:
     1. switch OFF: /api/pvp/attack answers a fixed set of seeded city attacks (NPC castles, a wounded squad, a player castle, a world-map
        bot, a replayed requestId, a march not arrived, an unknown march) exactly as the commit this mode started from (BASE), and the
        accounts (mails, Witch's Hut, gold) end the same;
     2. switch ON: an NPC castle fight is host.autoWatched on the march's frozen snaps (with the Witch's Hut HP they left with) against the
        castle's roster as D2 units (npcRealSpec), seeded as before; the attacker's wounds come from that fight; both war mails carry it;
        the player-castle and world-map-bot fights are unchanged by this switch;
     3. the client plays the war mail's battle back (watchBattle -> the page's watched-fight path) to the server fight's exact end state;
     4. gear, Temper, glyphs, prayers, Academy, skills and learned talents each change the squad's snaps and win more often over 100 seeds
        against an NPC castle;
     5. D2: the mapping is the documented one (NPC_REAL_K) and keeps each tier as strong as on the line model for the reference teams;
     6. determinism: a second server given the same world and requests gives the same fights.
   BASE = server.js at REAL_ENGINE_BASE_NPC (default 7d4347dfb, the commit before this mode). Run: node --test tests/real-engine-npc-castle.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const IP=require('./helpers/server-inproc.cjs'),W=require('./helpers/arena-world.cjs'),CW=require('./helpers/city-world.cjs');
const SH=require(path.join(root,'server','sim-host.js')),SIM=require(path.join(root,'server','sim.js')),T=require(path.join(root,'talents.js')),WITCH=require(path.join(root,'server','witches-hut.js'));
const BASE_SHA=process.env.REAL_ENGINE_BASE_NPC||'7d4347dfb';
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
let BASE_SRC=null; try{ BASE_SRC=cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8'); }catch(e){ console.log('BASE server.js not available - test 1 is skipped'); }
const PAGE=SH.load(path.join(root,'emberweave-heroes.html'));
const J=JSON.stringify, clone=x=>JSON.parse(J(x));
const ENV={SERVER_SECRET:'real-engine-npc-test-secret'};
const L40={level:40,stars:4,skill:[10,10,10,10],asc:3};
const T1=[{key:'grosk',level:14,rank:2},{key:'tick',level:13,rank:2},{key:'fritz',level:15,rank:2},{key:'konwu',level:12,rank:2},{key:'aureth',level:14,rank:2}];
const T3=[{key:'vulmar',level:20,rank:3},{key:'bloatus',level:19,rank:3},{key:'sylthaine',level:20,rank:3},{key:'vireo',level:18,rank:3},{key:'konwu',level:20,rank:3}];
function world(S){ const DB=S.getDB();
  const A1=W.player(S,'CityA1',{vael:L40,sylthaine:L40,vireo:L40}), A2=W.player(S,'CityA2',{vex:L40,gruel:L40,vael:L40}), A3=W.player(S,'CityA3',{vireo:L40,vex:L40});
  const D1=W.player(S,'CityD1',{gruel:L40,sylthaine:L40}); D1.wall=['gruel','sylthaine']; D1.beginnerBroken=true;
  CW.wound(S,A2,'vex',0.55);
  const N1=CW.npc(S,'bot_c1',T1,{rank:4100}), N2=CW.npc(S,'bot_c2',T3,{rank:4200,wall:T3.slice(0,3)});
  const BOT=[{key:'tick',level:30,rank:2},{key:'grosk',level:30,rank:1}];
  const m={ m1:CW.march(S,A1,'m1',N1.id,['vael','sylthaine','vireo']), m2:CW.march(S,A1,'m2',N2.id,['vael','sylthaine','vireo']),
    m3:CW.march(S,A2,'m3',N1.id,['vex','gruel','vael']), m4:CW.march(S,A2,'m4',D1.id,['vex','gruel']),
    m5:CW.march(S,A3,'m5','wb_1',['vireo','vex'],{botTeam:BOT}), m6:CW.march(S,A3,'m6',N2.id,['vireo'],{future:true}) };
  return {A1,A2,A3,D1,N1,N2,m}; }
function requests(w){ return [
  [w.A1,{marchId:'m1',defId:w.N1.id,requestId:'n1'}],
  [w.A1,{marchId:'m1',defId:w.N1.id,requestId:'n1'}],
  [w.A1,{marchId:'m2',defId:w.N2.id,requestId:'n2'}],
  [w.A2,{marchId:'m3',defId:w.N1.id,requestId:'n3'}],
  [w.A2,{marchId:'m4',defId:w.D1.id,requestId:'n4'}],
  [w.A3,{marchId:'m5',defId:'wb_1',requestId:'n5'}],
  [w.A3,{marchId:'m6',defId:w.N2.id,requestId:'n6'}],
  [w.A1,{marchId:'nope',defId:w.N1.id,requestId:'n7'}],
]; }
const TIMEISH=new Set(['t','arriveAt','resolvedAt','id','engine']);
const strip=x=>Array.isArray(x)?x.map(strip):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).filter(k=>!TIMEISH.has(k)).map(k=>[k,strip(x[k])])):x;
async function runAll(S,w){ const out=[]; let i=0; for(const [u,b] of requests(w)) out.push(strip(await S.call('/api/pvp/attack',b,S.token(u.id),4000+i,'10.4.0.'+(i++)))); return out; }
const accounts=(S,w)=>strip(Object.fromEntries(['A1','A2','A3','D1'].map(k=>{ const u=S.getDB().users[w[k].id]; return [k,{mail:u.pvpMail||[],hut:u.witch?u.witch.hp:null,gold:u.led.gold,day:u.pvpDay||null}]; })));
async function server(src,env){ return IP.load(src,Object.assign({},ENV,env||{})); }

test('1. switch off: every city attack answers exactly as the commit this mode started from',{skip:!BASE_SRC},async()=>{
  const B=await server(BASE_SRC), N=await server(SRC), wb=world(B), wn=world(N);
  const rb=await runAll(B,wb), rn=await runAll(N,wn);
  const npcF=[rn[0],rn[3]];   // (rn[2]: the same squad again, all at 0% in the Witch's Hut after rn[0] - the line model fights its LIVE hut HP)
  assert.ok(npcF.every(r=>r.status===200&&r.data.ok&&Array.isArray(r.data.log)&&r.data.log.length&&!r.data.replay),'the NPC castles were fought on the line model: '+J(rn.map(r=>[r.status,r.data.error])));
  assert.ok(rn[4].data.replay&&rn[5].data.replay&&rn[6].status===400&&rn[7].status===400,'a player castle, a bot and two refusals');
  assert.deepEqual(rn,rb,'the replies differ from BASE');
  assert.deepEqual(accounts(N,wn),accounts(B,wb),'the accounts differ from BASE');
});

let ON=null,wOn=null,rOn=null,OFFr=null;
async function onServer(){ if(ON) return; ON=await server(SRC,{REAL_ENGINE_NPC_CASTLE:'true',TALENTS_ENABLED:'true'}); wOn=world(ON); rOn=await runAll(ON,wOn);
  const OFF=await server(SRC,{TALENTS_ENABLED:'true'}), wo=world(OFF); OFFr=await runAll(OFF,wo); }
const npcFoe=team=>PAGE.snapFromSpecs(clone(team.slice(0,5).map(ON.npcRealSpec)));

test('2. switch on: an NPC castle is the real engine on the frozen squad and the D2 castle; nothing else moves',async()=>{
  await onServer();
  const DB=ON.getDB();
  for(const [ri,u,mid,roster] of [[0,wOn.A1,'m1',T1],[2,wOn.A1,'m2',T3.slice(0,3)],[3,wOn.A2,'m3',T1]]){ const r=rOn[ri].data;
    assert.equal(rOn[ri].status,200,J(r).slice(0,200));
    const mrec=DB.users[u.id].worldCityMarches.find(x=>x.id===mid);
    assert.equal(J(r.replay.snaps),J(mrec.snaps),'the squad that fought is the one frozen at the march start');
    assert.equal(J(r.replay.foe),J(npcFoe(roster)),'the castle fought as its D2 units (its wall when it has one)');
    const seed=ON.srvSeed('citypvp',u.id,requests(wOn)[ri][1].requestId); assert.equal(r.replay.seed,seed,'the seed rule is unchanged');
    const f=PAGE.autoWatched(clone(mrec.snaps),clone(r.replay.foe),seed); assert.equal(r.won,f.won,'the verdict is the real engine\'s');
    assert.equal(r.replay.durationSec,JSON.parse(f.digest).t);
    assert.deepEqual(r.log,[]); assert.equal(r.rounds,0);
    const dg=JSON.parse(f.digest); for(const inj of r.injuries.attacker){ const s=mrec.snaps.find(x=>x.key===inj.key), row=dg.u.find(x=>x[0]===inj.key&&x[1]==='ally');
      const hp=row?Math.max(0,Math.min(s.worldEntryHpCap,row[3])):0; assert.equal(inj.after,Math.min(inj.before,Math.round(Math.max(0,Math.min(1,hp/s.maxHp))*WITCH.HP_FULL)),'the wound is the real fight\'s ('+inj.key+')'); }
    const mail=(DB.users[u.id].pvpMail||[]).find(x=>x.marchId===mid&&x.kind==='attack-report'); assert.ok(mail&&mail.battle&&mail.battle.seed===seed,'the attacker\'s war mail carries the fight'); }
  // the wounded squad entered with its hut HP
  const m3=DB.users[wOn.A2.id].worldCityMarches.find(x=>x.id==='m3'), vex=m3.snaps.find(s=>s.key==='vex'); assert.ok(vex.hp<vex.maxHp&&vex.worldEntryHpCap===vex.hp);
  // this switch moves nothing else: the replayed receipt, the player castle, the world-map bot, the refusals
  assert.deepEqual(rOn[1],rOn[0]); for(const i of [5,6,7]) assert.deepEqual(rOn[i],OFFr[i],'request '+(i+1)+' changed with the NPC castle switch');
  // the player castle: the same fight (its squad's Witch's Hut "before" differs only because that squad's NPC castle fight just before was the real one)
  const pc=x=>({won:x.data.won,replay:x.data.replay,def:x.data.injuries.defender}); assert.deepEqual(pc(rOn[4]),pc(OFFr[4]),'the player castle fight changed with the NPC castle switch');
});

test('3. the client plays the war mail\'s battle back to the server fight\'s exact end state',async()=>{
  await onServer();
  for(const ri of [0,2,3]){ const r=rOn[ri].data, u=[wOn.A1,wOn.A1,wOn.A2][[0,2,3].indexOf(ri)];
    const mail=(ON.getDB().users[u.id].pvpMail||[]).find(x=>x.kind==='attack-report'&&x.battle&&x.battle.seed===r.replay.seed);
    const want=PAGE.autoWatched(clone(r.replay.snaps),clone(r.replay.foe),r.replay.seed).digest;
    const C=SH.load(path.join(root,'emberweave-heroes.html')); C.sandbox.__m=clone(mail.battle);
    const out=vm.runInContext(`(function(){ ACC.token='t'; startVersus=(e,a,k)=>_startVersusNow(e,a,k); watchBattle(__m);
      let i=0; for(;i<14400&&!ended;i++) updateBattle(SIM_STEP); return {ended,dg:window._p2lastDigest}; })()`,C.ctx);
    assert.ok(out.ended); const a=JSON.parse(out.dg), b=JSON.parse(want);
    assert.equal(J({t:a.t,won:a.won,u:a.u}),J(b),'the watched war mail fight is another fight than the one paid');
    assert.equal(a.t,r.replay.durationSec,'the watched fight lasts as long as the fight the server paid'); assert.equal(a.won,r.won,'the watched fight has the paid verdict'); }
});

function build(hero,treeIdx,n,level){ let b={r:{}}; const tr=T.trees(hero)[treeIdx];
  for(let g=0;g<400&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }
test('4. gear, Temper, glyphs, prayers, Academy, skills and talents each change the squad and win more often against an NPC castle',async()=>{
  const S=await server(SRC,{REAL_ENGINE_NPC_CASTLE:'true',TALENTS_ENABLED:'true'});
  const pool=require(path.join(root,'server','sim-pool.js')).create(path.join(root,'emberweave-heroes.html'),{size:2,queueMax:10000,timeoutMs:600000,queueWaitMs:600000}); test.after(()=>pool.close());
  for(let i=0;i<300&&!pool.stats.ready;i++) await new Promise(r=>setTimeout(r,100));
  const TEAM=['vael','sylthaine','vireo'], L=60, base={level:L,stars:5,skill:[20,20,20,20],asc:4};
  const squad=u=>PAGE.snapFromSpecs(clone(TEAM.map(k=>S.campaignHeroSpec(u,k))));
  const add={ gear:k=>({gear:W.gearFor(k)}), temper:k=>({gear:W.gearFor(k),temper:12}), glyphs:()=>({glyphAtk:300}), prayers:()=>({temple:4}),
    academy:()=>({acad:40}), skills:()=>({skill:[60,60,60,60]}), talents:k=>({talents:build(k,0,30,60)}) };
  const seeds=Array.from({length:100},(_,i)=>(i+1)*2654435761>>>0);
  const wins=async(sn,foe,n)=>(await Promise.all(seeds.slice(0,n||100).map(s=>pool.run('autoWatched',[sn,foe,s])))).filter(r=>r.won).length;
  // an NPC castle the gear-only squad beats about half the time: the strongest tier, its level found once
  const ref=squad(W.player(S,'NRef',Object.fromEntries(TEAM.map(k=>[k,Object.assign({},base,{gear:W.gearFor(k)})]))));
  let foe=null; for(const lv of [20,25,30,35,40,45,50,55,60,70,80,100,130,160,200]){ const f=PAGE.snapFromSpecs(clone(T3.map(e=>ON_spec(S,Object.assign({},e,{level:lv}))))); const w=await wins(ref,f,40); foe=f; if(w<=28) break; }
  const res={}, cache=new Map();
  for(const f in add){ const lo={}, hi={};
    for(const k of TEAM){ const b0=Object.assign({},base,f==='temper'?{gear:W.gearFor(k)}:(f==='gear'?{}:{gear:W.gearFor(k)})); lo[k]=b0; hi[k]=Object.assign({},b0,add[f](k)); }
    const loS=squad(W.player(S,'NLo-'+f,lo)), hiS=squad(W.player(S,'NHi-'+f,hi)), kl=J(loS);
    if(!cache.has(kl)) cache.set(kl,await wins(loS,foe)); const a=cache.get(kl), b=await wins(hiS,foe); res[f]=[a,b];
    assert.notEqual(J(hiS),J(loS),f+': the squad is the same with one more'); assert.ok(b>a,f+': one more did not win more often ('+a+' -> '+b+')'); }
  console.log('NPC castle wins of 100, without -> with: '+J(res));
});
function ON_spec(S,e){ return S.npcRealSpec(e); }

test('5. D2: the bot mapping is the documented one and keeps a tier as strong as on the line model',async()=>{
  const S=await server(SRC,{REAL_ENGINE_NPC_CASTLE:'true'});
  const D2=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','real-engine-d2.json'),'utf8'));
  assert.deepEqual(Array.from(S.NPC_REAL_K),D2.k,'NPC_REAL_K is the measured table (tests/fixtures/real-engine-d2.json)');
  const e={key:'grosk',level:15,rank:2}, sp=S.npcRealSpec(e);
  assert.deepEqual(sp,{key:'grosk',level:15,rank:2,skillLv:[1,1,1,1],mul:{atk:D2.k[2],hp:D2.k[2],dr:0,regen:0,crit:0,critRes:0,energyReg:0,ctrlRes:0,startEnergy:0,healPow:0}});
  assert.equal(S.npcRealSpec({key:'nobody',level:5,rank:1}),null); assert.equal(S.npcRealSpec({key:'tick',level:999,rank:9}).level,200); assert.equal(S.npcRealSpec({key:'tick',level:999,rank:9}).rank,3);
  // one reference team against one bot of the tier D2 measured hardest to match: the mapped win rate stays within the measured difference + 0.1
  const pool=require(path.join(root,'server','sim-pool.js')).create(path.join(root,'emberweave-heroes.html'),{size:2,queueMax:10000,timeoutMs:600000,queueWaitMs:600000}); test.after(()=>pool.close());
  for(let i=0;i<300&&!pool.stats.ready;i++) await new Promise(r=>setTimeout(r,100));
  const c=D2.check, u=W.player(S,'D2Ref',Object.fromEntries(c.keys.map(k=>[k,Object.assign({level:c.level},c.st,c.gearQ!=null?{gear:W.gearFor(k,c.gearQ)}:{})])));
  S.getDB().users[u.id].led.px=S.D_TROOP_CUM[c.level]; for(const k of c.keys) S.getDB().users[u.id].led.hero[k].xp=S.D_HERO_CUM[c.level];
  const line=c.keys.map(k=>S.snapshotHeroFromServer(u,k)), real=PAGE.snapFromSpecs(clone(c.keys.map(k=>S.campaignHeroSpec(u,k))));
  const N=D2.seeds, seeds=Array.from({length:N},(_,i)=>((i+1)*2654435761)>>>0);
  const lw=seeds.filter(s=>SIM.resolveLineBattle(SIM.makeLine(line),SIM.makeLine(c.bot.map(b=>SIM.heroCombatStats(b.key,{level:b.level,stars:SIM.HERO_BASE[b.key].stars,pips:b.rank}))),s).won).length/N;
  const foe=PAGE.snapFromSpecs(clone(c.bot.map(S.npcRealSpec)));
  const rw=(await Promise.all(seeds.map(s=>pool.run('autoWatched',[real,foe,s])))).filter(r=>r.won).length/N;
  const raw=(await Promise.all(seeds.map(s=>pool.run('autoWatched',[real,clone(c.bot),s])))).filter(r=>r.won).length/N;
  console.log('D2 check '+c.name+': line '+lw+', real raw '+raw+', real mapped '+rw);
  assert.equal(lw,c.line,'the line model gives the measured win rate'); assert.ok(Math.abs(rw-lw)<=Math.abs(c.mapped-c.line)+0.1,'the mapped bot is as strong as on the line model ('+lw+' vs '+rw+')');
});

test('6. determinism: a second server given the same world and requests gives the same fights',async()=>{
  await onServer();
  const S2=await server(SRC,{REAL_ENGINE_NPC_CASTLE:'true',TALENTS_ENABLED:'true'}), w2=world(S2), r2=await runAll(S2,w2);
  assert.deepEqual(r2,rOn); assert.deepEqual(accounts(S2,w2),accounts(ON,wOn));
});
