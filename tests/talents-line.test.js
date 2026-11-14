'use strict';
/* Talents in the LINE MODEL and in the POWER NUMBER (14 Nov 2026).
   The line model (server/sim.js + server/combat-core.js) decides Arena, Skyfall, the Trial and NPC castles, and the server prices the
   power number from a line-model unit. This file proves:
     (a) switch off, or switch on with nothing learned: snapshotHeroFromServer and heroCardPower are identical to the pre-talent server;
     (b) with talents learned, each stat lands on the right line-model field by its percent, and nothing else moves;
     (c) client heroPower == server heroCardPower with talents, exactly as the existing parity tests require without them;
     (d) a line fight: no talents = the pre-talent fight for the same seeds; stat talents win more often than the mirrored control;
     (e) a hero loaned in the Starless Well never carries the lender's talents.
   BASE = server.js at TALENT_BASE (default: the last commit on main before the talents branch). server/ has not changed since, so the
   BASE server.js runs on this checkout's server/ modules. The server is loaded in-process the way tests/test_power_terms_1311.js does it.
   Run: node --test tests/talents-line.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),T=require(path.join(root,'talents.js')),FX=require(path.join(root,'talents-fx.js')),SIM=require(path.join(root,'server/sim.js')),SH=require(path.join(root,'server/sim-host.js'));
const WELL=require(path.join(root,'server/starless-well.js'));
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
const dirs=[]; process.on('exit',()=>{ for(const d of dirs) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });

/* ---- server.js in-process: the real file in a wrapper (no port, no timers, a throwaway world). flag = the TALENTS_ENABLED switch ---- */
function loadServer(src,flag){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-line-')); dirs.push(tmp);
  process.env.DB_FILE=path.join(tmp,'db.json'); process.env.PORT='0'; process.env.DATABASE_URL='';
  if(flag) process.env.TALENTS_ENABLED='true'; else delete process.env.TALENTS_ENABLED;
  const http=require('http'), fakeHttp=Object.assign({},http,{createServer:()=>({listen(){},on(){},prependListener(){},close(){},address(){ return {port:0}; }})});
  const req=Module.createRequire(path.join(root,'server.js')), myReq=n=>n==='http'?fakeHttp:req(n);
  const noop=()=>({unref(){},ref(){}});
  const log=console.log; console.log=()=>{};
  try{
    const wrap=vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){'+src+
      '\n;return {heroCardPower,snapshotHeroFromServer,unitCardPower,campaignHeroSpec,ensureLedger,ledHeroLevel,playerLevelOf:(typeof ledPlayerLevel==="function"?ledPlayerLevel:null),D_HERO_CUM,D_TROOP_CUM,getDB:()=>DB,'+
      'talentListFor:(typeof talentListFor==="function"?talentListFor:null),talentPowerFlat:(typeof talentPowerFlat==="function"?talentPowerFlat:null)};})',{filename:'server.js'});
    const m={exports:{}};
    return wrap(m.exports,myReq,m,path.join(root,'server.js'),root,noop,noop);
  } finally{ console.log=log; delete process.env.TALENTS_ENABLED; }
}
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ON=loadServer(SRC,true), OFF=loadServer(SRC,false);
let BASE=null; try{ BASE=loadServer(cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8'),false); }catch(e){ console.log('BASE server not available ('+String(e.message||e).slice(0,120)+') - identity checks against it are skipped'); }
const PAGE=SH.load(path.join(root,'emberweave-heroes.html'));
const R=code=>vm.runInContext(code,PAGE.ctx);
const J=JSON.stringify;

/* ---- one hero state, set identically on a server account and on the page's save ---- */
let uid=0; const USERS=new Map();
function serverUser(S,key,st,build){
  let m=USERS.get(S); if(!m) USERS.set(S,m=new Map());
  let u=m.get(key);
  if(!u){ u={id:'tline-'+(++uid),name:'TL'+uid,guest:true,created:Date.now(),roster:{}}; S.getDB().users[u.id]=u; S.ensureLedger(u); m.set(key,u); }
  const led=u.led;
  led.px=S.D_TROOP_CUM[100]; led.unlocked=led.unlocked||{}; led.unlocked[key]=true;
  led.hero[key]={xp:S.D_HERO_CUM[st.level],stars:st.stars,pips:0,ref:0};
  led.skill=led.skill||{}; led.skill[key]=st.skill.slice();
  led.acad={lv:{academy:0,atk:0,hp:0,ap:0,heal:st.ac,armor:0,mr:0,crit:0,critres:st.ac},learn:{},res:{iron:0,crystal:0,silver:0,coal:0}};
  u.glyphs={revision:1,fragments:{},subGlyphs:{},finished:{},boards:{[key]:{slots:[null,null,null,null,null,null],ascensionIndex:st.asc,ascended:{},personalPathVersion:1}}};
  if(build) led.talents={[key]:JSON.parse(J(build))}; else delete led.talents;
  return u;
}
function clientSet(key,st,build){ const k=J(key);
  R('G.playerXP=TROOP_CUM[100]; G.heroXP['+k+']=HERO_CUM['+st.level+']; G.starLevel['+k+']='+st.stars+'; G.starPip=G.starPip||{}; G.starPip['+k+']=0; G.starRefine=G.starRefine||{}; G.starRefine['+k+']=0;'+
    'G.skillLevel=G.skillLevel||{}; G.skillLevel['+k+']='+J(st.skill)+'; G.glyphRank=G.glyphRank||{}; G.glyphRank['+k+']='+st.asc+'; G.tech={heal:'+st.ac+',critres:'+st.ac+'}; G.temple=undefined;'+
    (build?'G.talents={['+k+']:'+J(build)+'};':'delete G.talents;')); }
const cPow=(key,st,build)=>{ clientSet(key,st,build); return R('heroPower('+J(key)+')'); };
const sPow=(S,key,st,build)=>S.heroCardPower(serverUser(S,key,st,build),key);
const sUnit=(S,key,st,build,opts)=>S.snapshotHeroFromServer(serverUser(S,key,st,build),key,null,opts);
const CARD={noGlyphStats:true,noTempleEffects:true};
const stars=key=>SIM.HERO_BASE[key].stars||1;
const STATES=key=>[ {level:1,stars:stars(key),skill:[1,1,1,1],asc:0,ac:0}, {level:56,stars:5,skill:[30,20,10,1],asc:6,ac:60}, {level:100,stars:5,skill:[100,100,100,100],asc:15,ac:0} ];
const L100=key=>({level:100,stars:5,skill:[1,1,1,1],asc:6,ac:0});

/* ---- legal builds ---- */
/* `n` points greedily down one tree (then on into `more` = [[treeIdx,n],...]) */
function build(hero,plan,level){ let b={r:{}};
  for(const [ti,n] of plan){ const tr=T.trees(hero)[ti], want=T.spent(hero,b).total+n;
    for(let g=0;g<400&&T.spent(hero,b).total<want;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; } }
  return b; }
/* the smallest legal build that holds talent `id` at max rank; the points needed to open its tier go into talents with NO stat part where
   the tree has them, so the build's stat totals are, as far as the tree allows, this one talent's */
function buildFor(hero,id,level){ let b={r:{}}; const t=T.talent(hero,id), tr=T.trees(hero).find(x=>x.talents.some(y=>y[0]===id));
  const push=tid=>{ const x=T.talent(hero,tid);
    if(x.prereq){ const p=T.talent(hero,x.prereq); while(T.rankOf(b,p.id)<p.ranks) push(p.id); }
    for(let g=0;g<200&&!T.canLearn(hero,b,tid,level);g++){
      const fill=tr.talents.filter(y=>y[1]<x.tier&&y[0]!==id&&T.canLearn(hero,b,y[0],level)).sort((a,c)=>(FX.has(hero,a[0])?1:0)-(FX.has(hero,c[0])?1:0)||a[1]-c[1]||a[2]-c[2])[0];
      if(!fill) throw new Error('cannot reach '+hero+'/'+tid+': '+T.whyNot(hero,b,tid,level));
      b=T.learn(hero,b,fill[0],level).build; }
    b=T.learn(hero,b,tid,level).build; };
  while(T.rankOf(b,id)<t.ranks) push(id);
  assert.equal(T.invalid(hero,b,level),'',hero+'/'+id+' build is legal');
  return b; }
const statIds=hero=>T.trees(hero).flatMap(tr=>tr.talents.map(t=>t[0])).filter(id=>FX.has(hero,id));
const riskId=hero=>statIds(hero).find(id=>Object.values(FX.totals(hero,[[id,1]])).some(v=>v<0));
const mechOnly=(hero,level)=>{ let b={r:{}}; for(const tr of T.trees(hero)) for(const t of tr.talents){ if(t[1]!==1||FX.has(hero,t[0])) continue; while(T.canLearn(hero,b,t[0],level)) b=T.learn(hero,b,t[0],level).build; } return b; };

const ROSTER=['vael','gruel','ambrel','askel','sylthaine','absalie','vireo','mellan','vex','sloe','rafe','aureth','quorrel','fritz','hero61'].filter(k=>SIM.HERO_BASE[k]&&T.has(k));
const strip=u=>JSON.parse(J(u));

test('setup: the fixtures agree and the switch is read',()=>{
  assert.ok(ROSTER.length>=12,'at least 12 heroes'); assert.ok(new Set(ROSTER.map(k=>SIM.HERO_BASE[k].role)).size>=6,'every role');
  const b=build('vael',[[1,20]],100), u=serverUser(ON,'vael',L100('vael'),b);
  assert.equal(ON.ledHeroLevel(u.led,'vael'),100); clientSet('vael',L100('vael'),b); assert.equal(R('heroLevel("vael")'),100);
  assert.deepEqual(ON.talentListFor(u.led,'vael'),T.learned('vael',b),'switch on: the learned list');
  assert.equal(OFF.talentListFor(serverUser(OFF,'vael',L100('vael'),b).led,'vael'),null,'switch off: no list, whatever the ledger holds');
  assert.deepEqual(JSON.parse(R('JSON.stringify(talentListLocal("vael"))')),T.learned('vael',b),'the page reads the same list from its mirror');
});

test('(a) switch off, or on with nothing learned: every line unit and every card is the pre-talent one',{skip:!BASE},()=>{
  let n=0;
  for(const key of ROSTER) for(const st of STATES(key)){
    const full=build(key,[[0,61],[1,30]],st.level), bad={r:{no_such_talent:1}};
    const want=strip(sUnit(BASE,key,st,null)), wantCard=strip(sUnit(BASE,key,st,null,CARD)), wantPow=sPow(BASE,key,st,null);
    const cases=[['switch off, nothing learned',OFF,null],['switch off, a full build in the ledger',OFF,full],['switch on, nothing learned',ON,null],['switch on, an empty build',ON,{r:{}}],['switch on, a build the rules refuse',ON,bad]];
    if(st.level>=10) cases.push(['switch on, a build with more points than the level gives',ON,build(key,[[0,61],[1,30]],100)].concat([st.level>=100]));
    for(const [name,S,b,skip] of cases){ if(skip) continue; const m=key+' L'+st.level+': '+name;
      assert.deepEqual(strip(sUnit(S,key,st,b)),want,m+' (fight unit)'); assert.deepEqual(strip(sUnit(S,key,st,b,CARD)),wantCard,m+' (card unit)');
      assert.equal(sPow(S,key,st,b),wantPow,m+' (power)'); n++; }
    assert.equal(cPow(key,st,null),wantPow,key+' L'+st.level+': the page prices the pre-talent number too');
    if(st.level>=10&&st.level<100) assert.equal(cPow(key,st,build(key,[[0,61],[1,30]],100)),wantPow,key+' L'+st.level+': the page, like the server, gives a build the rules refuse no talents at all');
  }
  assert.ok(n>=ROSTER.length*3*5);
});

test('(b) each stat talent lands on its line-model field by exactly its percent, and nothing else moves',()=>{
  const st=k=>({level:100,stars:5,skill:[40,30,20,10],asc:15,ac:60});
  const alone={}; let checked=0;
  const near=(x,y,m)=>assert.ok(Math.abs(x-y)<=1e-9*Math.max(1,Math.abs(y)),m+': '+x+' vs '+y);
  for(const hero of Object.keys(SIM.HERO_BASE).filter(k=>T.has(k))) for(const id of statIds(hero)){
    const b=buildFor(hero,id,100), list=T.learned(hero,b), tot=FX.totals(hero,list), own=FX.totals(hero,[[id,T.talent(hero,id).ranks]]), m=hero+'/'+id;
    if(J(tot)===J(own)) for(const k in own) alone[k]=(alone[k]||0)+1;
    for(const opts of [undefined,CARD]){
      const p=strip(sUnit(ON,hero,st(hero),null,opts)), q=strip(sUnit(ON,hero,st(hero),b,opts));
      assert.equal(q.maxHp,Math.round(p.maxHp*(1+(tot.hp||0))),m+' max HP (whole points)');
      assert.equal(q.atkP,Math.round(p.atkP*(1+(tot.atk||0))),m+' attack (whole points)');
      assert.equal(q.atkM,Math.round(p.atkM*(1+(tot.apow||0))),m+' ability power (whole points)');
      assert.equal(q.heal,Math.round(p.heal*(1+(tot.apow||0))),m+' the healer\'s heal number follows ability power');
      near(q.armor,p.armor*(1+(tot.armor||0)),m+' armor'); near(q.mr,p.mr*(1+(tot.mr||0)),m+' magic resist');
      near(q.crit,Math.min(0.6,p.crit+(tot.crit||0)),m+' crit chance (a fraction, added, capped at 60%)');
      near(1+q.critDmg,(1+p.critDmg)*(1+(tot.critDmg||0)),m+' crit damage (the whole critical hit)');
      near(q.speed,p.speed*(1+(tot.aspd||0)),m+' attack speed'); near(1+q.healPow,(1+p.healPow)*(1+(tot.heal||0)),m+' healing power');
      near(q.shieldStr,p.shieldStr*(1+(tot.shield||0)),m+' shield strength');
      near(q.atk,Math.max(q.atkP,q.atkM),m+' legacy alias atk'); near(q.dr,(SIM.CORE.defToDR(q.armor,q.level)+SIM.CORE.defToDR(q.mr,q.level))/2,m+' legacy alias dr');
      assert.equal(q.shieldPool,0,m+' no shield at build'); assert.equal(q.haste,p.haste,m+' haste (energy gain) is not attack speed');
      const moved=['maxHp','atkP','atkM','heal','armor','mr','crit','critDmg','speed','healPow','shieldStr','atk','dr'];
      for(const k of Object.keys(p)) if(!moved.includes(k)) assert.deepEqual(q[k],p[k],m+': '+k+' must not change');
      assert.deepEqual(Object.keys(q),Object.keys(p),m+': no field added to the line unit');
      /* and each field that should not move for THIS total did not */
      const F={hp:['maxHp'],atk:['atkP'],apow:['atkM','heal'],armor:['armor'],mr:['mr'],crit:['crit'],critDmg:['critDmg'],aspd:['speed'],heal:['healPow'],shield:['shieldStr']};
      for(const k in F) if(!tot[k]) for(const f of F[k]) assert.equal(q[f],p[f],m+': '+f+' moved without a '+k+' talent');
      const whole=['maxHp','atkP','atkM','heal'];
      for(const k in F) if(tot[k]>0&&k!=='crit') for(const f of F[k]) if(whole.includes(f)?p[f]*tot[k]>=1:(p[f]>0||f==='healPow')) assert.ok(q[f]>p[f],m+': '+f+' did not rise with '+k);
    }
    checked++; }
  assert.ok(checked>=560,'only '+checked+' stat talents checked')   /* 588 on 14 Nov after the reader stopped taking skill and summon sentences for hero stats */;
  for(const k of ['hp','atk','apow','armor','mr','crit','critDmg','aspd','heal','shield']) assert.ok(alone[k]>0,'no build isolates the '+k+' stat (seen alone: '+J(alone)+')');
});

test('(c) ONE POWER with talents: the page\'s heroPower == the server\'s heroCardPower, and stat talents move it',()=>{
  const keys=['vael','gruel','ambrel','sylthaine','vireo','mellan','vex','sloe','rafe','aureth','quorrel','askel'].filter(k=>ROSTER.includes(k));
  let cards=0, moved=0; const bad=[];
  for(const key of keys) for(const st of STATES(key).slice(1).concat([L100(key)])){
    const B=[ ['one deep tree',build(key,[[0,91]],st.level)], ['61 + 30',build(key,[[1,61],[2,30]],st.level)], ['30 + 30 + 31',build(key,[[0,30],[1,30],[2,31]],st.level)] ];
    const rk=riskId(key); if(rk&&st.level===100) B.push(['a RISK talent',buildFor(key,rk,100)]);
    for(const id of statIds(key)){ const o=FX.totals(key,[[id,1]]); if((o.heal||o.critDmg||o.aspd||o.crit)&&st.level===100) B.push([id,buildFor(key,id,100)]); }
    const c0=cPow(key,st,null), s0=sPow(ON,key,st,null); if(c0!==s0) bad.push([key,st.level,'no talents',c0,s0]);
    for(const [name,b] of B){ assert.equal(T.invalid(key,b,st.level),'',key+' '+name+' is legal');
      const c=cPow(key,st,b), s=sPow(ON,key,st,b); cards++; if(c!==s) bad.push([key,st.level,name,c,s]);
      const tot=FX.totals(key,T.learned(key,b)), vals=Object.keys(tot).filter(k=>k!=='shield').map(k=>tot[k]);
      if(vals.length&&vals.every(v=>v>=0)&&vals.some(v=>v>0)&&(tot.hp||tot.atk||tot.armor||tot.mr)){   /* crit damage on a hero with no crit chance (a Tank) rightly moves nothing */ assert.ok(s>s0,key+' L'+st.level+' '+name+': stat talents raise the card ('+s0+' -> '+s+')'); moved++; }
    } }
  assert.deepEqual(bad.slice(0,8),[],bad.length+' of '+cards+' cards differ between page and server');
  assert.ok(cards>=100&&moved>=30,cards+' cards, '+moved+' raised');
});

test('(c) the size of the move is the formula\'s: +10% max HP is x sqrt(1.1) on the base term; mechanic talents add nothing yet',()=>{
  for(const key of ['vael','sylthaine','gruel']){ const st=L100(key);
    const u0=sUnit(ON,key,st,null,CARD), p0=ON.unitCardPower(u0,key,null);
    const b=build(key,[[0,91]],100), tot=FX.totals(key,T.learned(key,b)), u1=sUnit(ON,key,st,b,CARD), p1=ON.unitCardPower(u1,key,null);
    assert.ok(p1!==p0,key+': the card unit carries the talents');
    const hpOnly=Object.assign({},u0,{maxHp:Math.round(u0.maxHp*1.1)}); assert.ok(Math.abs(ON.unitCardPower(hpOnly,key,null)/p0-Math.sqrt(hpOnly.maxHp/u0.maxHp))<1e-12);
    const mo=mechOnly(key,100); assert.ok(T.spent(key,mo).total>0,'a build of talents with no stat part'); assert.deepEqual(FX.totals(key,T.learned(key,mo)),{});
    assert.equal(sPow(ON,key,st,mo),sPow(ON,key,st,null),key+': mechanic talents give the server card nothing yet'); assert.equal(cPow(key,st,mo),cPow(key,st,null),key+': nor the page card');
    assert.equal(ON.talentPowerFlat(key,T.learned(key,mo)),0); assert.equal(R('talentPowerFlat('+J(key)+','+J(T.learned(key,mo))+')'),0); }
});

test('(c) the page number follows a learn and a reset at once (no cache between the mirror and the card)',()=>{
  const key='vael', st=L100(key), b=build(key,[[0,40]],100);
  const p0=cPow(key,st,null); clientSet(key,st,b); const p1=R('heroPower("vael")'); R('delete G.talents'); const p2=R('heroPower("vael")');
  assert.ok(p1>p0); assert.equal(p2,p0);
  /* through the page's own ledger adoption, as talentLearn / talentReset do it */
  if(R('typeof adoptLedger')==='function'){ const viaMirror=x=>{ R('(function(){ const st={talents:'+J(x)+'}; if(st.talents&&typeof st.talents==="object"){ const _tl={}; for(const k in st.talents){ const r=st.talents[k]&&st.talents[k].r; if(r&&Object.keys(r).length) _tl[k]={r:Object.assign({},r)}; } G.talents=_tl; } else delete G.talents; })()'); return R('heroPower("vael")'); };
    assert.equal(viaMirror({vael:b}),p1); assert.equal(viaMirror({}),p0); }
});

/* ---- (d) the line fight, as the Arena route runs it: SIM.resolveLineBattle(SIM.makeLine(mine), SIM.makeLine(theirs), seed) ---- */
const TEAM=['gruel','vael','vex','sylthaine','vireo'];
function teamUnits(S,withTalents,tag){ const st={level:100,stars:5,skill:[60,60,60,60],asc:15,ac:60};
  const u={id:'tline-team-'+tag+'-'+(++uid),name:'TT'+uid,guest:true,created:Date.now(),roster:{}}; S.getDB().users[u.id]=u; S.ensureLedger(u);
  const led=u.led; led.px=S.D_TROOP_CUM[100]; led.unlocked=led.unlocked||{}; led.skill=led.skill||{}; u.glyphs={revision:1,fragments:{},subGlyphs:{},finished:{},boards:{}};
  led.acad={lv:{academy:0,atk:0,hp:0,ap:0,heal:st.ac,armor:0,mr:0,crit:0,critres:st.ac},learn:{},res:{iron:0,crystal:0,silver:0,coal:0}};
  if(withTalents) led.talents={};
  for(const key of TEAM){ led.unlocked[key]=true; led.hero[key]={xp:S.D_HERO_CUM[st.level],stars:5,pips:0,ref:0}; led.skill[key]=st.skill.slice();
    u.glyphs.boards[key]={slots:[null,null,null,null,null,null],ascensionIndex:st.asc,ascended:{},personalPathVersion:1};
    if(withTalents){ /* every stat talent the hero has, as far as 91 points reach */ let b={r:{}};
      for(const id of statIds(key)){ let c; try{ c=buildFor(key,id,100); }catch(e){ continue; } const m={r:Object.assign({},b.r)}; for(const k in c.r) m.r[k]=Math.max(m.r[k]||0,c.r[k]); if(!T.invalid(key,m,100)) b=m; }
      led.talents[key]=b; } }
  return TEAM.map(k=>S.snapshotHeroFromServer(u,k)); }
const fightJ=(a,b,seed)=>{ const r=SIM.resolveLineBattle(SIM.makeLine(a),SIM.makeLine(b),seed); return J([r.won,r.rounds,r.aState,r.bState,r.log]); };
const SEEDS=Array.from({length:200},(_,i)=>(i*2654435761+12345)>>>0);

test('(d) no talents on either side: 200 seeded line fights are the pre-talent fights, log for log',{skip:!BASE},()=>{
  const a=teamUnits(ON,false,'a'), b=teamUnits(ON,false,'b'), a0=teamUnits(BASE,false,'a'), b0=teamUnits(BASE,false,'b'), aOff=teamUnits(OFF,true,'a');
  assert.deepEqual(strip(a),strip(a0)); assert.deepEqual(strip(aOff),strip(a0),'switch off: a ledger full of talents changes nothing');
  for(const seed of SEEDS) assert.equal(fightJ(a,b,seed),fightJ(a0,b0,seed),'seed '+seed);
});

test('(d) stat talents win line fights: the talented side beats its mirror more often than the control, attacking and defending',()=>{
  const plainA=teamUnits(ON,false,'a'), plainB=teamUnits(ON,false,'b'), tal=teamUnits(ON,true,'t');
  assert.ok(tal.every((u,i)=>u.maxHp>=plainA[i].maxHp)&&tal.some((u,i)=>u.maxHp>plainA[i].maxHp),'the talented line is the stronger one');
  const wins=(a,b)=>SEEDS.reduce((n,seed)=>n+(SIM.resolveLineBattle(SIM.makeLine(a),SIM.makeLine(b),seed).won?1:0),0);
  const control=wins(plainA,plainB), attack=wins(tal,plainB), defend=wins(plainA,tal);
  console.log('    attacker wins of 200: control '+control+', talents attacking '+attack+', talents defending '+defend);
  assert.ok(attack>control,'talents on the attacker: '+attack+' wins against the control\'s '+control);
  assert.ok(defend<control,'talents on the defender: the attacker wins '+defend+' against the control\'s '+control);
  assert.equal(fightJ(tal,plainB,SEEDS[0]),fightJ(tal,plainB,SEEDS[0]),'same units, same seed, same fight');
});

/* ---- (e) the Starless Well: a hero the player does not own is loaned as a clone of the player's best hero's spec ---- */
test('(e) a hero loaned in the Starless Well never carries the lender\'s talents; the player\'s own hero does',()=>{
  assert.equal(typeof WELL.loanSpec,'function','server/starless-well.js exports loanSpec for this test');
  const mk=(S,learn)=>{ const u=serverUser(S,'vael',L100('vael'),learn?build('vael',[[1,61],[0,30]],100):null);
    return {me:u,led:u.led,SIM,campaignHeroSpec:S.campaignHeroSpec,playerLevel:()=>100}; };
  const ctx=mk(ON,true), own=ON.campaignHeroSpec(ctx.me,'vael');
  assert.ok(Array.isArray(own.talents)&&own.talents.length>10,'the lender\'s own spec carries the learned list');
  for(const key of ['sylthaine','gruel','vex']){
    const loan=WELL.loanSpec(ctx,key); assert.equal(loan.key,key); assert.ok(!('talents' in loan),key+': the loan has no talents field');
    const plain=WELL.loanSpec(mk(ON,false),key); assert.deepEqual(strip(loan),strip(plain),key+': the loan is the one a lender with no talents gives');
    const snap=strip(PAGE.snapFromSpecs([loan]))[0]; assert.ok(!('tal' in snap),key+': nor does its snap'); assert.deepEqual(snap,strip(PAGE.snapFromSpecs([plain]))[0]); }
  /* what the test guards against: the same clone with the lender's list left on it is a different unit whenever an id is shared */
  assert.deepEqual(strip(PAGE.snapFromSpecs([own]))[0].tal,own.talents,'the owned hero keeps its talents through the same path');
});
