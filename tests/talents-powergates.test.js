'use strict';
/* POWER-ONLY DECISIONS (14 Nov 2026, WIRING/41d - POWER-ONLY DECISIONS - what uses which number.md).
   The manager's rule: until every mode runs the real fight engine, a place that decides an OUTCOME, a REWARD, a COST, a cut, a seed or a gate
   from the power number alone uses the card WITHOUT its talent term (server heroGatePower / page heroGatePower), so switching talents on
   changes nothing there. The card and the power leaderboard keep the full number.
   Servers: NEW = this checkout's server.js, BASE = origin/talents c2764f5afb36435929b221c67068b34b21987267 (talent power on the card, every
   decision on the full number), each loaded with the switch ON and OFF. Every place below is run as the player reaches it (the route itself,
   through the server's own request handler) or, for the Skyfall bracket, through the functions the Monday lock and the 18:00 lock call.
   For each place:
     (a) identity - NEW with the switch OFF (a full build in the ledger) gives exactly what BASE gave, and NEW with the switch ON and nothing
         learned gives exactly what BASE gave;
     (b) the decision - NEW with the switch ON and talents learned gives exactly what the same player with NO talents gives;
     (c) the risk was real - on BASE with the switch ON, the same player with talents gets a DIFFERENT result (so (b) can fail).
   Controls: tests/talents-powergates-controls.js removes each change once in a throwaway copy and expects the named test here to fail.
   Run: node --test tests/talents-powergates.test.js (cluster) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process'),Module=require('node:module'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),T=require(path.join(root,'talents.js')),TP=require(path.join(root,'talents-power.js'));
const SIM=require(path.join(root,'server/sim.js')),SH=require(path.join(root,'server/sim-host.js')),B=require('./talents-power-builds.js');
const BASE_SHA='c2764f5afb36435929b221c67068b34b21987267';
const dirs=[]; process.on('exit',()=>{ for(const d of dirs) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const EXPORTS=['heroCardPower','heroGatePower','cardPower','ensureLedger','D_HERO_CUM','D_TROOP_CUM','api','buildRegisteredLines','warQualifyGuild','warAdvance','warTiebreak',
  'warLockMatch','warPickPower','warAttackerLine','warDefenderPick','getDungeonProgress','witchState','towerReqS','vaultRecommendedCardPower','worldPlanningDB','WORLD_MINES'];
function loadServer(src,flag){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-powergates-')); dirs.push(tmp);
  process.env.DB_FILE=path.join(tmp,'db.json'); process.env.PORT='0'; process.env.DATABASE_URL=''; process.env.SIM_WORKERS='0';
  if(flag) process.env.TALENTS_ENABLED='true'; else delete process.env.TALENTS_ENABLED;
  const http=require('http'), fakeHttp=Object.assign({},http,{createServer:()=>({listen(){},on(){},prependListener(){},close(){},address(){ return {port:0}; }})});
  const req=Module.createRequire(path.join(root,'server.js')), myReq=n=>n==='http'?fakeHttp:req(n), noop=()=>({unref(){},ref(){}});
  const log=console.log; console.log=()=>{};
  try{ const wrap=vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){'+src+
      '\n;return {'+EXPORTS.map(n=>JSON.stringify(n)+':(typeof '+n+'!=="undefined"?'+n+':null)').join(',')+
      ',getDB:()=>DB,poisonSim:()=>{ _SIMHOST=null; _SIMHOST_ERR=new Error("powergates test: no battle engine"); }};})',{filename:'server.js'});
    const m={exports:{}}; return wrap(m.exports,myReq,m,path.join(root,'server.js'),root,noop,noop); }
  finally{ console.log=log; delete process.env.TALENTS_ENABLED; } }
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
const NEW_ON=loadServer(SRC,true), NEW_OFF=loadServer(SRC,false);
const BASE_SRC=cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8');
const BASE_ON=loadServer(BASE_SRC,true), BASE_OFF=loadServer(BASE_SRC,false);
for(const S of [NEW_ON,NEW_OFF,BASE_ON,BASE_OFF]) S.poisonSim();   /* the mine route stops at its battle with "Mine battle engine unavailable." once the gate passes */
const J=JSON.stringify, clone=x=>JSON.parse(J(x)), sha=t=>crypto.createHash('sha256').update(String(t)).digest('hex');
const HEROES=Object.keys(require(path.join(root,'talents-data.js')).heroes).filter(k=>SIM.HERO_BASE[k]);
const WIRED=HEROES.filter(k=>TP.wired(k)).sort(), UNWIRED=HEROES.filter(k=>!TP.wired(k)).sort();
function build(key,level,pts){ const b=pts==null?B.builds(key,level)[0][1]:B.partial(key,0,pts,level); const why=T.invalid(key,b,level); if(why) throw new Error(key+' L'+level+': '+why); return b; }

/* ---- a player on one server. heroes: [{key,level,skill,build}]. talents:false = the same player with nothing learned. ---- */
let UID=0; const TOK=new Map();
function mkUser(S,heroes,o){ o=o||{}; const id='pg-'+(++UID), u={id,name:'PG'+UID,guest:true,created:Date.now()-5000,rank:9000,coins:0,roster:{}};
  const DB=S.getDB(); DB.users[id]=u; S.ensureLedger(u); const led=u.led; led.px=S.D_TROOP_CUM[100];
  led.unlocked={}; led.hero={}; led.skill={}; led.talents={};
  led.acad={lv:{academy:0,atk:0,hp:0,ap:0,heal:0,armor:0,mr:0,crit:0,critres:0},learn:{},res:{iron:0,crystal:0,silver:0,coal:0}};
  u.glyphs={revision:1,fragments:{},subGlyphs:{},finished:{},boards:{}};
  for(const h of heroes){ const k=h.key; led.unlocked[k]=true; led.hero[k]={xp:S.D_HERO_CUM[h.level],stars:SIM.HERO_BASE[k].stars||1,pips:0,ref:0};
    if(h.skill) led.skill[k]=[h.skill,h.skill,h.skill,h.skill];
    u.glyphs.boards[k]={slots:[null,null,null,null,null,null],ascensionIndex:0,ascended:{},personalPathVersion:1};
    if(h.build&&o.talents!==false) led.talents[k]=clone(h.build); }
  if(!Object.keys(led.talents).length) delete led.talents;
  u.team=heroes.slice(0,5).map(h=>({key:h.key})); u.wall=u.team.slice();
  const tok='pg-token-'+id; DB.tokens=DB.tokens||{}; DB.tokens[sha(tok)]={id,iat:Date.now(),exp:Date.now()+30*86400000}; TOK.set(id,tok);
  return u; }
const cards=(S,u,keys)=>keys.reduce((s,k)=>s+S.heroCardPower(u,k),0);
/* one request through the server's own handler (no network); no request context, so every save is the plain synchronous one */
function call(S,u,route,packet){ return new Promise(resolve=>{ const L={};
  const req={method:packet?'POST':'GET',url:route,headers:{'x-token':TOK.get(u.id),'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},
    pause(){},destroy(){},on(ev,fn){ L[ev]=fn; if(ev==='end') setImmediate(()=>{ if(packet&&L.data) L.data(Buffer.from(J(packet))); L.end(); }); return req; }};
  const res={statusCode:200,headersSent:false,setHeader(){},getHeader(){},writeHead(c){ this.statusCode=c; this.headersSent=true; },
    end(b){ let body=null; try{ body=b?JSON.parse(String(b)):null; }catch(e){ body=String(b); } resolve({status:this.statusCode,body}); }};
  Promise.resolve().then(()=>S.api(req,res,new URL(route,'http://x'))).catch(e=>resolve({status:500,body:{error:String(e&&e.stack||e)}})); }); }
/* the four runs of one scenario: identity (a), decision (b), risk (c) */
async function fourWay(name,run){
  const r={ newOffT:await run(NEW_OFF,true), baseOffT:await run(BASE_OFF,true), newOnN:await run(NEW_ON,false), baseOnN:await run(BASE_ON,false),
    newOnT:await run(NEW_ON,true), baseOnT:await run(BASE_ON,true) };
  assert.deepEqual(r.newOffT,r.baseOffT,name+' (a): switch off, talents in the ledger - NEW must equal BASE');
  assert.deepEqual(r.newOnN,r.baseOnN,name+' (a): switch on, nothing learned - NEW must equal BASE');
  assert.deepEqual(r.newOffT,r.newOnN,name+' (a): switch off = nothing learned');
  assert.deepEqual(r.newOnT,r.newOnN,name+' (b): switch on, talents learned - the decision must equal the same player with no talents');
  assert.notDeepEqual(r.baseOnT,r.baseOnN,name+' (c): on BASE the talents DID change this decision (else the scenario proves nothing)');
  return r; }

/* five wired heroes at level 100 with a full legal build each */
const FIVE=WIRED.slice(0,5).map(k=>({key:k,level:100,build:build(k,100)}));
const FIVE_KEYS=FIVE.map(h=>h.key);
const GATE5=cards(NEW_ON,mkUser(NEW_ON,FIVE,{talents:false}),FIVE_KEYS), FULL5=cards(NEW_ON,mkUser(NEW_ON,FIVE),FIVE_KEYS);

test('setup: both servers load, the helper exists only in NEW, talents raise the card',()=>{
  assert.ok(WIRED.length>=12,'wired heroes: '+WIRED.length);
  assert.equal(typeof NEW_ON.heroGatePower,'function'); assert.equal(BASE_ON.heroGatePower,null);
  assert.ok(FULL5>GATE5+50000,'five full builds raise the five cards by more than 50,000 ('+GATE5+' -> '+FULL5+')');
});

test('identity: every card is the card BASE gave; the gate number is the card with nothing learned',()=>{
  let n=0;
  for(const k of WIRED.slice(0,10).concat(UNWIRED.slice(0,3))) for(const level of [30,70,100]){
    const h=[{key:k,level,skill:level>50?40:1,build:build(k,level)}], m=k+' L'+level;
    const nOn=mkUser(NEW_ON,h,{talents:false}), tOn=mkUser(NEW_ON,h), tOff=mkUser(NEW_OFF,h), bN=mkUser(BASE_ON,h,{talents:false}), bT=mkUser(BASE_ON,h), bOff=mkUser(BASE_OFF,h);
    const want=BASE_ON.heroCardPower(bN,k);
    assert.equal(NEW_ON.heroCardPower(nOn,k),want,m+': switch on, nothing learned');
    assert.equal(NEW_OFF.heroCardPower(tOff,k),BASE_OFF.heroCardPower(bOff,k),m+': switch off, a build in the ledger');
    assert.equal(NEW_OFF.heroCardPower(tOff,k),want,m+': switch off = nothing learned');
    assert.equal(NEW_ON.heroCardPower(tOn,k),BASE_ON.heroCardPower(bT,k),m+': switch on, talents learned - the CARD keeps the full number');
    assert.equal(NEW_ON.heroGatePower(nOn,k),want,m+': gate, nothing learned = the card');
    assert.equal(NEW_OFF.heroGatePower(tOff,k),want,m+': gate, switch off = the card');
    assert.equal(NEW_ON.heroGatePower(tOn,k),want,m+': gate, talents learned = the card with nothing learned');
    if(TP.wired(k)){ assert.ok(NEW_ON.heroCardPower(tOn,k)>want,m+': the build does raise the card');
      /* the 15-second cache keeps the two numbers apart, whichever is asked first */
      const c1=mkUser(NEW_ON,h), c2=mkUser(NEW_ON,h), full=NEW_ON.heroCardPower(tOn,k);
      assert.equal(NEW_ON.cardPower(c1,k),full); assert.equal(NEW_ON.cardPower(c1,k,false,{noTalents:true}),want,m+': cache, card first then gate');
      assert.equal(NEW_ON.cardPower(c2,k,false,{noTalents:true}),want); assert.equal(NEW_ON.cardPower(c2,k),full,m+': cache, gate first then card'); }
    n++; }
  assert.ok(n>=39);
});

test('tower: the Tower of Trials climb and its migration cap read the talent-less squad',async()=>{
  let fLow=0; while(NEW_ON.towerReqS(fLow+1)<=GATE5) fLow++;
  const fMid=fLow+1; assert.ok(fLow>=1,'the squad stands on floor 1 at least'); assert.ok(NEW_ON.towerReqS(fMid)<=FULL5,'a floor lies between the two numbers');
  let fHigh=fMid; while(NEW_ON.towerReqS(fHigh)<=FULL5) fHigh++;
  const floors=[fLow,fMid,Math.min(fHigh-1,fMid+3),fHigh];
  let rid=0;
  await fourWay('tower ascend',async(S,tal)=>{ const out=[];
    for(const f of floors){ const u=mkUser(S,FIVE,{talents:tal?undefined:false}); u.led.tower={floor:f-1,trib:'',mig:1,srv:1};
      const r=await call(S,u,'/api/tower/ascend',{requestId:'tw'+(++rid)}), b=r.body||{};
      out.push({f,status:r.status,ok:!!b.ok,wall:!!b.wall,req:b.req||null,power:b.power||null,floor:b.floor||null,gold:b.gold||0,gems:b.gems||0,error:b.error||null}); }
    return out; });
  await fourWay('tower migration cap',async(S,tal)=>{ const u=mkUser(S,FIVE,{talents:tal?undefined:false});
    const r=await call(S,u,'/api/tower/state',{legacyFloor:5000}), b=r.body||{}; return {status:r.status,floor:b.floor,power:b.power,nextReq:b.nextReq}; });
});

test('witch: the Witches Hut heal cost, heal and heal-all are priced on the talent-less card',async()=>{
  const H=WIRED.slice(5,8).map((k,i)=>({key:k,level:100,build:i===2?build(k,100):build(k,100,20+20*i)}));
  const prep=(S,tal)=>{ const u=mkUser(S,H,{talents:tal?undefined:false}), w=S.witchState(u,Date.now()); w.state.brew=w.capacity; for(const h of H) w.state.hp[h.key]=9000; return u; };
  const shown={};
  await fourWay('witch view cost',async(S,tal)=>{ const u=prep(S,tal), r=await call(S,u,'/api/witch/state');
    assert.equal(r.status,200,J(r.body).slice(0,300)); const hs=(r.body.heroes||[]).slice().sort((a,b)=>a.key.localeCompare(b.key));
    shown[(S===NEW_ON?'new':S===BASE_ON?'base':'off')+(tal?'T':'N')]=hs.map(h=>h.power);
    return hs.map(h=>({key:h.key,hp:h.hp,healCost:h.healCost})); });
  assert.notDeepEqual(shown.newT,shown.newN,'the Hut still SHOWS the card with talents (display keeps the full number)');
  assert.deepEqual(shown.newT,shown.baseT,'the shown card is the card BASE showed');
  await fourWay('witch heal',async(S,tal)=>{ const out=[]; for(const h of H){ const u=prep(S,tal), r=await call(S,u,'/api/witch/heal',{hero:h.key,requestId:'wh'+h.key});
      const x=(r.body&&r.body.result)||{}; out.push({key:h.key,ok:!!(r.body&&r.body.ok),before:x.before,after:x.after,spent:x.spent}); } return out; });
  await fourWay('witch heal-all',async(S,tal)=>{ const u=prep(S,tal), r=await call(S,u,'/api/witch/heal-all',{requestId:'wha'});
    return ((r.body&&r.body.results)||[]).map(x=>({key:x.key,before:x.before,after:x.after,spent:x.spent})); });
});

test('mine: the world mine march gate reads the talent-less squad',async()=>{
  const need=L=>Math.round(300*Math.pow(1.75,L-1)*1.4276), now=Date.now(), field=NEW_ON.WORLD_MINES.field(NEW_ON.WORLD_MINES.epochAt(now));
  /* the smallest squad (first n of FIVE) with a mine level whose need lies between its two numbers, and a level it clears either way */
  let plan=null;
  for(let n=1;n<=5&&!plan;n++){ const hs=FIVE.slice(0,n), ks=hs.map(h=>h.key);
    const g=cards(NEW_ON,mkUser(NEW_ON,hs,{talents:false}),ks), f=cards(NEW_ON,mkUser(NEW_ON,hs),ks);
    const mid=field.find(x=>need(x.level)>g&&need(x.level)<=f), low=field.find(x=>need(x.level)<=g);
    if(mid&&low) plan={hs,ks,mid:mid.id,low:low.id}; }
  assert.ok(plan,'a mine level lies between the talent-less and the full squad');
  let rid=0;
  const r=await fourWay('mine gate',async(S,tal)=>{ const out=[];
    for(const id of [plan.low,plan.mid]){ const u=mkUser(S,plan.hs,{talents:tal?undefined:false});
      const x=await call(S,u,'/api/world/mine/start',{mineId:id,heroIds:plan.ks,requestId:'mn'+(++rid)}); out.push({id,ok:!!(x.body&&x.body.ok),error:(x.body&&x.body.error)||null}); }
    return out; });
  assert.match(r.newOnT[1].error||'',/card power/,'the mid mine is refused at the gate: '+J(r.newOnT[1]));
  assert.match(r.baseOnT[1].error||'',/engine unavailable/,'on BASE the talents carried the squad past the gate');
});

test('vault: the Aether Vault underpower review compares the talent-less squad with the recommendation',async()=>{
  /* a floor whose review line (0.80 x recommended) lies between the two numbers, for some hero level */
  let plan=null;
  for(const level of [100,80,60,45,30]){ const hs=WIRED.slice(0,5).map(k=>({key:k,level,build:build(k,level)})), ks=hs.map(h=>h.key);
    const g=cards(NEW_ON,mkUser(NEW_ON,hs,{talents:false}),ks), f=cards(NEW_ON,mkUser(NEW_ON,hs),ks);
    for(let F=1;F<=100&&!plan;F++){ const line=0.80*NEW_ON.vaultRecommendedCardPower(F); if(line>g&&line<=f) plan={hs,ks,F}; }
    if(plan) break; }
  assert.ok(plan,'a Vault floor whose review line lies between the two numbers');
  let rid=0;
  await fourWay('vault review',async(S,tal)=>{ const u=mkUser(S,plan.hs,{talents:tal?undefined:false}), prog=S.getDungeonProgress(u.id);
    prog.currentFloor=plan.F; prog.highestClearedFloor=plan.F-1;
    const s=await call(S,u,'/api/dungeon/start-battle',{heroIds:plan.ks,requestId:'vs'+(++rid)}); assert.ok(s.body&&s.body.ok,'start: '+J(s.body).slice(0,300));
    const r=await call(S,u,'/api/dungeon/resolve-battle',{attemptId:s.body.attemptId,won:true,requestId:'vr'+(++rid)}); assert.ok(r.body&&r.body.ok,'resolve: '+J(r.body).slice(0,300));
    const fb=[].concat((S.worldPlanningDB&&S.worldPlanningDB().feedback)||[],S.getDB().feedback||[]);
    const hit=fb.find(x=>x&&x.signal==='vault-underpower:'+s.body.attemptId);
    return {flagged:!!hit,won:!!(r.body.result&&r.body.result.won)}; });
});

/* ---- Skyfall ---- */
const SKY=WIRED.slice(0,12);
function skyHeroes(S,keys){ /* talents only on the five heroes with the WEAKEST base card, so the full order differs from the talent-less one */
  const plain=keys.map(k=>({key:k,level:100})), u=mkUser(S,plain), base=keys.map(k=>[k,S.heroCardPower(u,k)]).sort((a,b)=>a[1]-b[1]);
  const weak=new Set(base.slice(0,5).map(x=>x[0])); return keys.map(k=>({key:k,level:100,build:weak.has(k)?build(k,100):null})); }
const SKY_H=skyHeroes(NEW_ON,SKY), MARCH_H=skyHeroes(NEW_ON,SKY.slice(0,10));

test('skyfall deal: the automatic deal of heroes into lines does not move when talents switch on',async()=>{
  await fourWay('skyfall deal',async(S,tal)=>{ const u=mkUser(S,SKY_H,{talents:tal?undefined:false});
    return S.buildRegisteredLines(u).map(L=>L.heroes.map(h=>h.key)); });
  /* and the line carries both numbers: the shown card sum and the talent-less one */
  const t=mkUser(NEW_ON,SKY_H), n=mkUser(NEW_ON,SKY_H,{talents:false}), lt=NEW_ON.buildRegisteredLines(t), ln=NEW_ON.buildRegisteredLines(n);
  for(let i=0;i<lt.length;i++){ assert.equal(lt[i].gatePower,ln[i].power,'line '+i+': gatePower = the no-talent sum'); assert.equal(ln[i].gatePower,ln[i].power); }
  assert.ok(lt.some((L,i)=>L.power>ln[i].power),'the shown line power keeps the talents');
});

let GID=0;
function mkGuild(S,members){ const id='pgg-'+(++GID); S.getDB().guilds=S.getDB().guilds||{}; S.getDB().guilds[id]={id,name:'G'+GID,members:members.map(u=>u.id),level:1,banner:null};
  for(const u of members) u.guildId=id; return id; }
const FAR=Date.now()+30*86400000;
test('skyfall seed: the Monday cut to 16 and the seeding read the talent-less pool',async()=>{
  /* 17 guilds of one member each, the same five heroes: base rises with the guild index (skill levels), talents fall with it */
  const five=WIRED.slice(0,5);
  await fourWay('skyfall seed',async(S,tal)=>{ const gids=[];
    for(let i=0;i<17;i++){ const hs=five.map(k=>({key:k,level:100,skill:1+6*i,build:build(k,100,Math.max(1,91-5*i))}));
      gids.push(mkGuild(S,[mkUser(S,hs,{talents:tal?undefined:false})])); }
    const t={id:'pgt'+(++GID),state:'registration',registrationLocksAt:0,entrants:gids.map(g=>({guildId:g,registeredAt:1})),
      schedule:[0,1,2,3,4].map(i=>({planningOpensAt:FAR+i*10,lockAt:FAR+i*10+1,endsAt:FAR+i*10+2})),matches:{},rounds:[],version:0};
    S.warAdvance(t);
    return { seeds:t.entrants.map(e=>gids.indexOf(e.guildId)), cut:gids.map((g,i)=>i).filter(i=>!t.entrants.some(e=>e.guildId===gids[i])),
      pairs:(t.rounds[0]?t.rounds[0].matchIds:[]).map(id=>[gids.indexOf(t.matches[id].aGuildId),gids.indexOf(t.matches[id].bGuildId)]) }; });
});

test('skyfall tiebreak: a tied war goes to the higher talent-less pool',async()=>{
  const five=WIRED.slice(0,5);
  await fourWay('skyfall tiebreak',async(S,tal)=>{
    const a=mkGuild(S,[mkUser(S,five.map(k=>({key:k,level:100,skill:1,build:build(k,100)})),{talents:tal?undefined:false})]);
    const b=mkGuild(S,[mkUser(S,five.map(k=>({key:k,level:100,skill:100})))]);
    const t={entrants:[S.warQualifyGuild(S.getDB().guilds[a]),S.warQualifyGuild(S.getDB().guilds[b])]}; t.entrants[0].seed=1; t.entrants[1].seed=2;
    const cit=()=>[0,1,2,3,4].map(i=>({lane:i,destroyed:false,defenders:[]}));
    const m={sides:{[a]:{citadels:cit()},[b]:{citadels:cit()}},eventLog:[],version:0};
    S.warTiebreak(t,m); return {winner:m.winnerGuildId===a?'a':'b',why:m.eventLog[m.eventLog.length-1].why}; });
});

test('skyfall march: which line marches and which defender meets it read the talent-less line number',async()=>{
  /* one member, two lines dealt by the talent-less card (line 0 the strongest base, no talents; line 1 the five weakest, talented) */
  const S=NEW_ON;
  const one=(tal)=>{ const u=mkUser(S,MARCH_H,{talents:tal?undefined:false}); const g=mkGuild(S,[u]);
    const cit=()=>[0,1,2,3,4].map(i=>({lane:i,key:'l'+i,destroyed:false,defenders:i===0?[{memberId:u.id,line:null}]:[]}));
    const t={entrants:[]}, m={id:'pgm'+(++GID),sides:{[g]:{citadels:cit(),unplaced:[]}},eventLog:[],version:0};
    S.warLockMatch(t,m); const c=m.sides[g].citadels[0];
    return {u,c,att:S.warAttackerLine(c,u.id),def:S.warDefenderPick(c,d=>d.alive!==false)}; };
  const T1=one(true), N1=one(false);
  assert.equal(T1.c.defenders.length,2,'two lines hydrated');
  assert.equal(T1.att.line,N1.att.line,'the marching line is the one the player with no talents would send');
  assert.equal(T1.def.line,N1.def.line,'the defender that answers is the one with no talents');
  for(const d of T1.c.defenders){ const n=N1.c.defenders.find(x=>x.line===d.line); assert.equal(S.warPickPower(d),n.power,'line '+d.line+': the pick number is the no-talent line power'); }
  /* the risk is real: by the shown (full) power the other line would have marched */
  const byShown=T1.c.defenders.slice().sort((x,y)=>(x.power-y.power)||(x.line-y.line))[0];
  assert.notEqual(byShown.line,T1.att.line,'by the full number a different line would march (the scenario discriminates)');
  /* identity: switch off, the defenders carry gatePower = power */
  const off=mkUser(NEW_OFF,MARCH_H); const g2=mkGuild(NEW_OFF,[off]); const m2={id:'pgm'+(++GID),sides:{[g2]:{citadels:[0,1,2,3,4].map(i=>({lane:i,key:'l'+i,destroyed:false,defenders:i===0?[{memberId:off.id,line:null}]:[]})),unplaced:[]}},eventLog:[],version:0};
  NEW_OFF.warLockMatch({entrants:[]},m2); for(const d of m2.sides[g2].citadels[0].defenders) assert.equal(NEW_OFF.warPickPower(d),d.power,'switch off: the pick number is the shown power');
  /* the assault route calls these two functions (the route itself needs a live match and the battle workers) */
  const route=SRC.slice(SRC.indexOf("if(p==='/api/guild-war/assault')"),SRC.indexOf("if(p==='/api/guild-war/assault')")+6000);
  assert.match(route,/const attacker=warAttackerLine\(mine,me\.id\);/); assert.match(route,/const warPick=warDefenderPick;/);
  assert.doesNotMatch(route,/\.power\|0\)-\(y\.power\|0\)/,'no order by the shown power left in the route');
});

/* ---- the page ---- */
function loadPage(htmlText){ const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-powergates-page-')); dirs.push(dir);
  const p=path.join(dir,'emberweave-heroes.html'); fs.writeFileSync(p,htmlText);
  for(const raw of [...htmlText.matchAll(/<script\s+src=["']\/([^"']+)["'][^>]*><\/script>/g)].map(m=>m[1].split('?')[0])){ const s=path.join(root,raw);
    if(!raw.startsWith('assets/')&&fs.existsSync(s)){ fs.mkdirSync(path.dirname(path.join(dir,raw)),{recursive:true}); fs.copyFileSync(s,path.join(dir,raw)); } }
  const P=SH.load(p); return c=>vm.runInContext(c,P.ctx); }
const HTML=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
function clientSet(R,key,level,b){ const k=J(key);
  R('G.playerXP=TROOP_CUM[100]; G.heroXP['+k+']=HERO_CUM['+level+']; G.starLevel['+k+']='+(SIM.HERO_BASE[key].stars||1)+'; G.starPip=G.starPip||{}; G.starPip['+k+']=0; G.starRefine=G.starRefine||{}; G.starRefine['+k+']=0;'+
    'G.skillLevel=G.skillLevel||{}; G.skillLevel['+k+']=[1,1,1,1]; G.glyphRank=G.glyphRank||{}; G.glyphRank['+k+']=0; G.tech={}; G.temple=undefined;'+(b?'G.talents={['+k+']:'+J(b)+'};':'delete G.talents;')); }
test('page: the page gate number is the card with nothing learned (= the server gate); the card is unchanged; the mine panel gates on it',()=>{
  const R=loadPage(HTML), RB=loadPage(cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}).toString('utf8'));
  assert.equal(R('typeof heroGatePower'),'function');
  for(const k of WIRED.slice(0,6)){ const b=build(k,100);
    clientSet(R,k,100,null); const p0=R('heroPower('+J(k)+')'), g0=R('heroGatePower('+J(k)+')');
    clientSet(R,k,100,b); const p1=R('heroPower('+J(k)+')'), g1=R('heroGatePower('+J(k)+')'), p1again=R('heroPower('+J(k)+')');
    clientSet(RB,k,100,null); const b0=RB('heroPower('+J(k)+')'); clientSet(RB,k,100,b); const b1=RB('heroPower('+J(k)+')');
    assert.equal(p0,b0,k+': the page card, nothing learned, is the card BASE showed'); assert.equal(p1,b1,k+': the page card with talents is the card BASE showed');
    assert.equal(g0,p0,k+': nothing learned, gate = card'); assert.equal(g1,p0,k+': talents learned, gate = the card with nothing learned');
    assert.ok(p1>p0,k+': the build raises the card'); assert.equal(p1again,p1,k+': the gate call leaves the card as it was');
    const su=mkUser(NEW_ON,[{key:k,level:100,build:b}]); assert.equal(NEW_ON.heroGatePower(su,k),g1,k+': page gate = server gate (one power)'); }
  const fnSrc=HTML.slice(HTML.indexOf('function openMineSelect('),HTML.indexOf('function openMineSelect(')+3000);
  assert.match(fnSrc,/const pow=marchGatePower\(\[\.\.\.sel\]\)\|\|0, okP=pow>=reqP/,'the mine panel compares the talent-less squad with the mine');
});
