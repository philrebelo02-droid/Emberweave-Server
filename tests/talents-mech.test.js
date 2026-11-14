'use strict';
/* Talent MECHANICS (talents-fx.js, built from talents-mech/ by tools/build_talent_fx.py): the hook layer in the page's fight code, the generic
   primitives, and Vael's talents as data on them. Everything runs in the page's own battle code through server/sim-host.js.
   Part 1  primitives: scripted talents (TalentFx.define) on a still field - the effect happens, has the right size, at the right time, and stops.
   Part 2  Vael: his real mechanics file, one test per talent group.
   Part 3  whole fights: determinism, snap round-trip, and "nothing learned = nothing runs".
   Run: node --test tests/talents-mech.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),SH=require(path.join(root,'server/sim-host.js')),T=require(path.join(root,'talents.js')),FXN=require(path.join(root,'talents-fx.js'));
const NOW=SH.load(path.join(root,'emberweave-heroes.html')), FX=NOW.sandbox.TalentFx;
/* the lab: helpers that live INSIDE the battle VM (they see the fight's own variables) */
const V=vm.runInContext(`({
  arena(al,fo,seed){ ended=false; state='battle'; CUR={mode:'replay',seed}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true;
    try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0; seedBattle(seed); setupMarchTeams(al,fo,false); return units; },
  step(n){ for(let i=0;i<n&&!ended;i++) updateBattle(SIM_STEP); return battleTime; },
  hit(a,b,amt,o){ o=o||{}; const p=_preCrit; _preCrit=(o.crit==null?false:o.crit); if(o.auto) _autoAtk=1; try{ dealDamage(a,b,amt,'#fff',o.kind); } finally{ _autoAtk=0; _preCrit=p; } },
  rawHit(a,b,amt){ dealDamage(a,b,amt,'#fff'); },
  dmg(u,a){ damage(u,a,'#fff',true); },
  heal(u,a){ healUnit(u,a); },
  cast(u,slot){ const ult=u.abilityOverride||u.t.ability, ab=slot==='ult'?Object.assign({},ULT_DEF[ult]):(slot==='blue'?u.blueAb:u.greenAb); const type=slot==='ult'?ult:ab.type;
    u._castSlot=slot; u._castLv=(u.skillLv&&u.skillLv[slot==='ult'?0:(slot==='green'?1:2)])||1; u._castSM=skillMul(u._castLv); try{ doEffect(u,type,ab); } finally{ u._castSM=1; u._castLv=0; } },
  cc(by,t,field,dur){ return ccApply(by,t,field,dur); },
  wave(){ resetPerWave(); },
  dot(t,per,dur,iv,src){ pushDot(t,per,dur,iv,'#8f8fa8',src,'true'); },
  rndPeek(n){ const out=[]; for(let i=0;i<n;i++) out.push(brnd()); return out; },
  now(){ return battleTime; }, STEP:SIM_STEP, METER:METER, ccNerf:ccDur(1), fearCap:CC_DUR_MAX.fearT, ended(){ return ended; }, bodyR(u){ return bodyR(u)/METER; }
})`,NOW.ctx);
const spec=(key,level,talents,gr)=>{ const s={key,level,stars:3,pips:0,ref:0,glyphRank:gr==null?6:gr,tt:{},ex:{techCrit:0,techCritRes:0,techHeal:0,equip:{}},fAtk:40,fHp:300,fApow:20,techArmor:60,techMr:40,techHeal:0,apMul:1,skillLv:[10,10,10,10],gearSkill:null,templeBonuses:null}; if(talents) s.talents=talents; return s; };
const snaps=specs=>JSON.parse(JSON.stringify(NOW.snapFromSpecs(specs)));
const near=(a,b,msg,eps)=>assert.ok(Math.abs(a-b)<=(eps||1e-6)*Math.max(1,Math.abs(b)),(msg||'')+': '+a+' vs '+b);
const secs=s=>V.step(Math.round(s/V.STEP));
const R=(x,b)=>({r:x,b:b||0});
/* A still field: Vael (with the learned list) and `allies` plain team-mates against `foes` plain enemies. Everyone is held (cannot act), has huge HP
   unless asked otherwise, no evasion / block / crit of their own. Plain = a rank-0 Vael: Tank against Tank (no class edge), no skills, no passive.
   A body is 2.01 m in radius, so units stand at least 4.02 m apart (5.23 m on one team). Places, in metres from Vael:
     foes   F0 (4.5,0)  F1 (10,0)  F2 (15.5,0)  F3 (0,6)  F4 (5.5,6)  F5 (11,6)  F6 (0,12)  F7 (5.5,12)  F8 (11,12);   allies A0 (0,-5.5)  A1 (0,-11)  A2 (0,-16.5)
   body-to-body gaps: Vael-F0 0.48, Vael-F3 1.98, Vael-F1 5.98; F0-F1 1.48, F0-F4 2.06, F0-F3 3.48; F1-F2 1.48, F1-F4 3.48, F1-F5 2.06. */
const FPOS=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6],[0,12],[5.5,12],[11,12]], APOS=[[0,-5.5],[0,-11],[0,-16.5]];
const J=x=>JSON.parse(JSON.stringify(x));
function lab(list,o){ o=o||{}; if('def' in o) FX.define('vael',o.def);
  const al=[spec('vael',100,list)].concat(Array.from({length:o.allies||0},()=>spec('vael',100,null,0)));
  const U=V.arena(snaps(al),snaps(Array.from({length:o.foes==null?2:o.foes},()=>spec('vael',100,null,0))),o.seed||7);
  const v=U[0], A=U.filter(u=>u.team==='ally'&&u!==v), F=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; if(u!==v||o.bigVael){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; const put=(u,dx,dy)=>{ u.x=v.x+dx*V.METER; u.y=v.y+dy*V.METER; };
  F.forEach((f,i)=>put(f,FPOS[i][0],FPOS[i][1])); A.forEach((a,i)=>put(a,APOS[i][0],APOS[i][1]));
  if(!o.cold) V.step(1);                        // one tick: the wave start has run
  return {v,A,F,U,T:v._tal,put}; }
const lost=(t,fn)=>{ const h=t.hp, s=t.shield||0; fn(); return (h-t.hp)+(s-(t.shield||0)); };
const stack=(L,name)=>{ const k=L.T.s.k[name]; return k?k.n:0; };
/* after every test: the scripted definition is removed, and no hook may have thrown (a hook that throws is counted, never let into the fight) */
test.afterEach(()=>{ FX.define('vael',null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });

/* ====================================================== PART 1: THE PRIMITIVES ====================================================== */
test('attach: nothing is set for no list, an empty list, a hero with no mechanics file, or only stat talents; rows come in sorted id order',()=>{
  for(const l of [null,[],[['rh_n1',5]],[['no_such',1]]]){ const u={uid:1}; assert.equal(FX.attach(u,'vael',l),null); assert.ok(!('_tal' in u)); }
  { const u={uid:1}; assert.equal(FX.attach(u,'sylthaine',[['x',1]]),null); assert.ok(!('_tal' in u)); }
  FX.define('vael',{talents:{b_2:[{on:'hit',do:[]}],a_1:[{on:'hit',do:[]},{on:['hit','kill'],do:[]}],c_3:[{param:'p',add:R(2)}]},always:[{on:'hit',do:[]}]});
  const u={uid:1}, t=FX.attach(u,'vael',[['c_3',2],['b_2',1],['a_1',3]]);
  assert.deepEqual(J(t.on.hit.map(r=>r.key)),['#0','a_1#0','a_1#1','b_2#0']); assert.deepEqual(J(t.on.kill.map(r=>r.key)),['a_1#1']); assert.equal(t.P.p,4);
  const L=lab(null); assert.ok(L.U.every(u=>!('_tal' in u)&&!('_talW' in u)&&!('_talM' in u)),'a fight with no talents carries no talent field on any unit');
});

/* a learned list with exactly `total` points in one tree: the `must` talents at full rank, the rest filled rank by rank (talents with no rows first) */
function ptsList(treeIdx,total,must){ const M=FXN.mech('vael'), list=must.map(id=>[id,T.talent('vael',id).ranks]); let n=list.reduce((s,e)=>s+e[1],0);
  const rest=T.trees('vael')[treeIdx].talents.filter(t=>!must.includes(t[0])).sort((a,b)=>(M.talents[a[0]]?1:0)-(M.talents[b[0]]?1:0));
  for(const t of rest){ if(n>=total) break; const r=Math.min(t[4],total-n); list.push([t[0],r]); n+=r; }
  assert.equal(n,total); return list.sort((a,b)=>a[0]<b[0]?-1:1); }
test('values: per rank, by rank, another talent\'s rank, named numbers; links (req / unless) and points per tree (pts)',()=>{
  const u={uid:1}, t=FXN.attach(u,'vael',[['rh_1_1',3],['rh_10_4',2],['rh_1_4',3],['ib_2_1',2],['ib_1_1',5],['rh_n2',1]]);
  near(t.on.out.find(r=>r.id==='rh_1_1').more,0.06,'2% per rank at rank 3');
  near(t.on.kill.find(r=>r.id==='rh_1_4').do[0].dmg.pct,0.60+0.12,'Spill Over 20% x3 + Overflow 6% x2');
  assert.equal(t.on.in.find(r=>r.id==='ib_2_1').do[0].spend,6,'Quench costs 7, 6, 5 by rank');
  assert.ok(t.on.dotTick,'the link row is live: Forge Heat is learned');
  const t2=FXN.attach({uid:2},'vael',[['rh_n2',1]]); assert.ok(!t2.on.dotTick,'the link row is off without Forge Heat'); assert.ok(t2.on.in,'its own half stays');
  assert.deepEqual(t.pts,{red_harvest:9,ironblood:7});
  /* the 91-point line of a signature: on only when 91 points sit in that tree */
  const rows=l=>(FXN.attach({uid:3},'vael',l).on.death||[]).filter(r=>r.id==='rh_13_2').length;
  assert.equal(rows(ptsList(0,90,['rh_13_2'])),0,'90 points in Red Harvest: the 91-point row is off'); assert.equal(rows(ptsList(0,91,['rh_13_2'])),1,'91 points: on');
  assert.equal(rows(ptsList(0,61,['rh_13_2']).concat(ptsList(1,30,[]))),0,'61 + 30 in another tree: off');
  /* a pick-one fork: the rules never let both halves into a build; each half is its own rows, and a row can ask "unless the other is learned" */
  const w=l=>FXN.attach({uid:4},'vael',l).on.tick.filter(r=>r.id==='ib_4_2').length;
  assert.equal(w([['ib_4_2',3]]),1); assert.equal(w([['ib_4_2',3],['ib_5_3',1]]),1,'Share the Wealth swaps Withdrawal\'s row, it does not add one');
  assert.ok(T.invalid('vael',{r:{ib_5_2:1,ib_5_3:1}},100),'the rules refuse both halves of a fork');
});

test('named stack: gain rule, cap, timed expiry, fade, per-wave reset, spend',()=>{
  const L=lab([['t',1]],{def:{states:{a:{max:3},b:{max:5,dur:2},c:{max:10,fade:{after:1,every:0.5,lose:2}},d:{max:4,wave:'reset'},e:{max:9}},
    talents:{t:[{on:'hit',do:[{stack:'a',add:1},{stack:'b',add:1},{stack:'c',add:5},{stack:'d',add:2},{stack:'e',add:2}]},
                {on:'cast',skill:'warcry',do:[{stack:'e',spend:3,then:[{stack:'a',set:0}]},{stack:'a',add:1}]}]}}});
  const {v,F}=L; for(let i=0;i<5;i++) V.hit(v,F[0],10);
  assert.deepEqual(['a','b','c','d','e'].map(k=>stack(L,k)),[3,5,10,4,9],'each stack stops at its cap');
  secs(1.2); assert.equal(stack(L,'c'),10,'no fade inside the first second'); secs(0.4); assert.equal(stack(L,'c'),8,'then 2 every half second'); secs(0.5); assert.equal(stack(L,'c'),6);
  assert.equal(stack(L,'b'),0,'a timed stack is gone 2 s after its last gain'); assert.equal(stack(L,'a'),3,'an untimed one stays');
  V.hit(v,F[0],10); secs(1.9); assert.equal(stack(L,'b'),1,'a new gain restarts the timer'); secs(0.2); assert.equal(stack(L,'b'),0);
  V.wave(); V.step(1); assert.equal(stack(L,'d'),0,'reset at the wave'); assert.equal(stack(L,'a'),3,'not reset: no wave rule'); assert.equal(stack(L,'e'),9);
  V.cast(v,'green'); assert.equal(stack(L,'e'),6,'spend 3'); assert.equal(stack(L,'a'),1,'the then-chain ran, then the next action');
  V.cast(v,'green'); V.cast(v,'green'); assert.equal(stack(L,'e'),0); V.cast(v,'green'); assert.equal(stack(L,'a'),1,'not enough to spend: the chain stops there');
});

test('mark on a target: owner, duration, unique holder, per-mark age',()=>{
  const def={talents:{t:[{on:'hit',do:[{mark:'m',dur:2},{mark:'q',unique:true}]},{on:'out',if:{targetHas:'m'},more:1},
                        {on:'out',if:{targetHas:'q'},more:0.1,per:{markAge:'q',every:1,max:3}}]}};
  const L=lab([['t',1]],{def}), {v,F}=L, T0=L.T; v._tal=undefined; const base=lost(F[1],()=>V.hit(v,F[1],1000)); v._tal=T0;
  V.hit(v,F[0],1000);                                              // marks F0 (the first hit itself is not boosted: the mark comes after it)
  near(lost(F[0],()=>V.hit(v,F[0],1000)),base*2,'a marked target takes the bonus');
  assert.ok(F[0]._talM[v.uid].m); assert.ok(!F[1]._talM,'the other enemy is not marked');
  assert.deepEqual(Object.keys(F[0]._talM),[String(v.uid)],'a mark is kept under its owner\'s id');
  secs(2.1); near(lost(F[0],()=>V.hit(v,F[0],1000)),base*1.2,'after 2 s the timed mark is gone; the untimed one has aged 2 full seconds (2 x 10%)');
  near(lost(F[0],()=>V.hit(v,F[0],1000)),base*2*1.2,'that hit marked it again (and marking again keeps the age)');
  secs(3); near(lost(F[0],()=>V.hit(v,F[0],1000)),base*1.3,'age capped at 3 steps');
  V.hit(v,F[1],1000); assert.ok(!F[0]._talM[v.uid].q,'a unique mark leaves its old holder'); assert.ok(F[1]._talM[v.uid].q); assert.equal(L.T.s.m.q,F[1]);
  near(lost(F[1],()=>V.hit(v,F[1],1000)),base*2,'and starts at age 0 on the new one');
});

test('stats while a condition holds and per stack: exact size, on and off, and the engine\'s own changes to the number are kept',()=>{
  const L=lab([['t',2]],{def:{states:{s:{max:4,dur:1}},talents:{t:[{on:'hit',do:[{stack:'s',add:1}]},
    {stat:{atk:R(0.05),armor:R(0.1),mr:R(0.1),aspd:R(0.1),crit:R(0.01),lifesteal:R(0.02),move:R(0.03)},per:'s'},{stat:{atk:0.5},if:{selfHpBelow:0.5}},{stat:{move:-1},if:{selfHpBelow:0.2}}]}}});
  const {v,F}=L, b={dmg:v.dmg,ar:v.armorRating,mr:v.mrRating,ai:v.atkInterval,cr:v.glyphCrit,ls:v.lifestealStat||0,sp:v.speed};
  V.hit(v,F[0],1); V.hit(v,F[0],1); V.hit(v,F[0],1); V.step(1);
  near(v.dmg,b.dmg*1.3,'attack: 3 stacks x 5% x rank 2'); near(v.armorRating,b.ar*1.6,'armor'); near(v.mrRating,b.mr*1.6,'magic resist'); near(v.atkInterval,b.ai/1.6,'attack speed');
  near(v.glyphCrit,b.cr+0.06,'crit chance'); near(v.lifestealStat,b.ls+0.12,'lifesteal'); near(v.speed,b.sp*1.18,'move speed');
  v.dmg*=2;                                                         // the engine changes the number for its own reasons
  v.hp=v.maxHp*0.4; V.step(1); near(v.dmg,b.dmg*2*1.8,'both rows add: +30% and +50%');
  secs(1.1); near(v.dmg,b.dmg*2*1.5,'stacks expired: only the health row is left'); near(v.armorRating,b.ar,'armor is back'); near(v.atkInterval,b.ai,'attack speed is back'); near(v.glyphCrit,b.cr,'crit is back');
  v.hp=v.maxHp*0.1; V.step(1); assert.equal(v.speed,0,'move x0: rooted'); v.hp=v.maxHp; V.step(1); near(v.speed,b.sp,'and released'); near(v.dmg,b.dmg*2,'all rows off: the engine\'s own doubling is what remains');
});

test('outgoing damage modifiers and their conditions: mark, target HP, own HP, buff window, basic attack, crit, armor ignore',()=>{
  const def={talents:{t:[{on:'cast',skill:'lifestealbuff',do:[{window:'bt',dur:{opt:'dur',d:6}}]},
    {on:'out',if:{targetHpBelow:0.5},more:R(0.10)},{on:'out',if:{selfHpBelow:0.3},more:0.5},{on:'out',if:{window:'bt'},mul:3},{on:'out',if:{auto:true},more:0.25},{on:'out',critMore:R(0.2)},
    {on:'out',if:{targetHas:'soft'},ignoreArmor:0.5},{on:'cast',skill:'warcry',do:[{mark:'soft',on:{team:'enemy',of:'self',n:1}}]}]}};
  const L=lab([['t',2]],{def,bigVael:true}), {v,F}=L, f=F[0], T0=L.T;
  v._tal=undefined; const base=lost(f,()=>V.hit(v,f,1000)), baseCrit=lost(f,()=>V.hit(v,f,1000,{crit:true})); v._tal=T0;
  near(lost(f,()=>V.hit(v,f,1000)),base,'no condition holds: the hit is untouched');
  f.hp=f.maxHp*0.4; near(lost(f,()=>V.hit(v,f,1000)),base*1.2,'target below 50% HP: +10% per rank'); f.hp=f.maxHp;
  v.hp=v.maxHp*0.2; near(lost(f,()=>V.hit(v,f,1000)),base*1.5,'self below 30% HP'); v.hp=v.maxHp;
  near(lost(f,()=>V.hit(v,f,1000,{auto:true})),base*1.25,'a basic attack');
  near(lost(f,()=>V.hit(v,f,1000,{crit:true})),baseCrit*1.4,'a critical hit: 20% more per rank on the whole hit');
  V.cast(v,'blue'); near(lost(f,()=>V.hit(v,f,1000)),base*3,'during the skill\'s buff window'); secs(6.1); near(lost(f,()=>V.hit(v,f,1000)),base,'the window ended with the buff');
  V.cast(v,'green'); const ig=lost(f,()=>V.hit(v,f,1000)); const sv=f.armorRating; f.armorRating=sv*0.5; v._tal=undefined; const half=lost(f,()=>V.hit(v,f,1000)); v._tal=T0; f.armorRating=sv;
  near(ig,half,'ignoring 50% of armor = hitting a target with half the armor'); assert.ok(ig>base*1.05,'and that is more than the plain hit');
  assert.ok(!('_wpnArmIgn' in v)||v._wpnArmIgn===undefined,'the borrowed engine field is put back');
});

test('incoming damage modifiers: per stack, hit-size threshold with a spend, own HP; DoT ticks only through dotIn',()=>{
  const def={states:{g:{max:10}},talents:{t:[{on:'hurt',do:[{stack:'g',add:1}]},{on:'in',less:R(0.01),per:'g'},
    {on:'in',if:{hitMin:{pct:0.5,of:'maxHp'},stackMin:{g:[4,3]}},mul:0.5,do:[{stack:'g',spend:[4,3]}]},{on:'in',if:{selfHpBelow:0.3},less:0.4},{on:'dotIn',less:0.25}]}};
  const L=lab([['t',2]],{def,bigVael:true}), {v,F}=L, f=F[0], T0=L.T, mh=v.maxHp; v.glyphDR=0;
  const tru=(a)=>{ v.hp=mh; return lost(v,()=>V.hit(f,v,a,{kind:'true'})); };
  v._tal=undefined; const base=tru(1000); v._tal=T0; near(base,1000,'a true hit lands whole on the plain unit');
  near(tru(1000),base,'first hit: no stack yet'); near(tru(1000),base*0.98,'1 stack x 1% x rank 2'); near(tru(1000),base*0.96,'2 stacks'); assert.equal(stack(L,'g'),3);
  near(tru(mh*0.6),mh*0.6*0.94*0.5,'a hit over half his max HP is halved (3 stacks reduce it first)'); assert.equal(stack(L,'g'),1,'for 3 stacks (rank 2), +1 for being hit');
  near(tru(mh*0.6),mh*0.6*0.98,'not enough stacks: not halved');
  v.hp=mh*0.2; near(lost(v,()=>V.hit(f,v,1000,{kind:'true'})),1000*0.96*0.6,'below 30% HP: 40% less on top'); v.hp=mh;
  V.dot(v,100,3,1,f); const h=v.hp; secs(1.02); near(h-v.hp,75,'a DoT tick is cut only by the dotIn row (25%), not by the hit rows'); assert.equal(stack(L,'g'),3,'and a DoT tick is not a hit taken');
});

test('triggers and their limiters: internal cooldown, once per wave, once per fight, uses, every n-th, edge, period',()=>{
  const def={states:{icd:{},wave:{},fight:{},uses:{},nth:{},edge:{},per:{}},talents:{t:[
    {on:'hit',icd:2,do:[{stack:'icd',add:1}]},{on:'hit',once:'wave',do:[{stack:'wave',add:1}]},{on:'hit',once:'fight',do:[{stack:'fight',add:1}]},
    {on:'hit',uses:2,do:[{stack:'uses',add:1}]},{on:'hit',every:3,do:[{stack:'nth',add:1}]},
    {on:'tick',edge:true,if:{selfHpBelow:0.5},do:[{stack:'edge',add:1}]},{on:'tick',if:{selfHpBelow:0.5},period:1,rate:2,do:[{stack:'per',add:1}]}]}};
  const L=lab([['t',1]],{def,bigVael:true}), {v,F}=L, g=()=>['icd','wave','fight','uses','nth'].map(k=>stack(L,k));
  for(let i=0;i<7;i++) V.hit(v,F[0],1); assert.deepEqual(g(),[1,1,1,2,2],'7 hits at once');
  secs(1.9); V.hit(v,F[0],1); assert.equal(stack(L,'icd'),1,'still inside the 2 s cooldown'); secs(0.2); V.hit(v,F[0],1); assert.equal(stack(L,'icd'),2,'ready again after it');
  assert.equal(stack(L,'nth'),3,'the 9th hit');
  V.wave(); V.step(1); V.hit(v,F[0],1); V.hit(v,F[0],1); assert.equal(stack(L,'wave'),2,'once more in the next wave, and only once'); assert.equal(stack(L,'fight'),1,'once per fight stays used');
  v.hp=v.maxHp*0.4; secs(0.75); assert.equal(stack(L,'edge'),1,'fires when the condition turns true, not while it stays true'); assert.equal(stack(L,'per'),1,'period 1 s at rate 2: one per half second');
  secs(0.5); assert.equal(stack(L,'per'),2); v.hp=v.maxHp; secs(0.3); v.hp=v.maxHp*0.4; secs(0.4); assert.equal(stack(L,'edge'),2,'fires again on the next crossing'); assert.equal(stack(L,'per'),2,'the period restarted when the condition broke');
});

test('chance: the seeded stream is drawn only inside the learned row, after its conditions; same seed, same outcome',()=>{
  const def={states:{n:{}},talents:{t:[{on:'in',if:{auto:true},chance:R(0.25),less:0.35,do:[{stack:'n',add:1}]}]}};
  const run=(seed,rank)=>{ const L=lab(rank?[['t',rank]]:null,{def,seed,bigVael:true}), {v,F}=L; v.glyphDR=0; const a=[];
    for(let i=0;i<200;i++) a.push(Math.round(lost(v,()=>V.hit(F[0],v,1000,{auto:true})))); for(let i=0;i<50;i++) V.hit(F[0],v,1000);
    return {a,n:rank?stack(L,'n'):0,next:V.rndPeek(3)}; };
  const r1=run(5,2), r2=run(5,2), r3=run(6,2), r0=run(5,0);
  assert.deepEqual(r1,r2,'same seed: the same hits are blocked'); assert.notDeepEqual(r1.a,r3.a,'another seed: other hits');
  assert.ok(r1.n>70&&r1.n<130,'about half of 200 at 25% x rank 2: '+r1.n);
  const full=Math.max(...r1.a), cut=Math.min(...r1.a); near(cut,full*0.65,'a blocked hit deals 35% less',2e-3); assert.equal(r1.a.filter(x=>x===cut).length,r1.n);
  const plain=run(5,0); assert.deepEqual(plain.next,r0.next);
  const noRow=lab(null,{seed:5}); for(let i=0;i<250;i++) V.hit(noRow.F[0],noRow.v,1000,{auto:i<200}); assert.deepEqual(V.rndPeek(3),r0.next,'no learned row: not one draw');
  assert.notDeepEqual(r1.next,r0.next,'200 basic attacks drew 200 numbers (and the 50 other hits none)');
  const L=lab([['t',2]],{def,seed:5,bigVael:true}); for(let i=0;i<200;i++) V.hit(L.F[0],L.v,1000,{auto:true}); const after200=V.rndPeek(3);
  assert.deepEqual(after200,r1.next,'hits that are not basic attacks draw nothing: the condition is checked before the roll');
});

test('DoT with an owner: tick size, duration with a shorter last tick, the owner\'s tick event, refresh, kills by the DoT',()=>{
  const def={states:{ticks:{},kills:{},dkills:{}},talents:{t:[{on:'hit',if:{crit:true},do:[{dot:'bleed',amt:{pct:R(0.1),of:'hit'},dur:{$:'d',b:3},every:1}]},{param:'d',add:0.3},
    {on:'dotTick',if:{tag:'bleed'},every:3,do:[{stack:'ticks',add:1}]},{on:'kill',do:[{stack:'kills',add:1}]},{on:'kill',dots:true,do:[{stack:'dkills',add:1}]},
    {on:'hit',if:{auto:true},do:[{dot:'burn',amt:{pct:0.01,of:'maxHp'},total:true,dur:2,every:0.5,refresh:true,color:'#ff6a3a'}]}]}};
  const L=lab([['t',2]],{def,foes:3}), {v,F}=L, f=F[0];
  const hitAmt=lost(f,()=>V.hit(v,f,5000,{crit:true})); assert.equal(f.dots.length,1); const d=f.dots[0]; assert.equal(d._talO,v.uid); assert.equal(d._talK,'bleed'); assert.equal(d.src,v);
  const seen=[]; let h=f.hp; for(let i=0;i<5;i++){ secs(1); seen.push(h-f.hp); h=f.hp; }
  near(seen[0],hitAmt*0.2,'each second: 10% per rank of the hit as it landed'); near(seen[1],hitAmt*0.2,''); near(seen[2],hitAmt*0.2,''); near(seen[3],hitAmt*0.2*0.3,'3.3 s: the 4th tick is 0.3 of a tick'); assert.equal(seen[4],0,'then it is over'); assert.equal(f.dots.length,0);
  assert.equal(stack(L,'ticks'),1,'every 3rd tick of his bleeds (4 ticks so far)');
  V.hit(v,F[1],5000,{crit:true}); secs(2.05); assert.equal(stack(L,'ticks'),2,'the count runs across all his bleeds');
  V.hit(v,F[1],10,{auto:true}); V.hit(v,F[1],10,{auto:true}); assert.equal(F[1].dots.filter(x=>x._talK==='burn').length,1,'refresh: one burn, not one per hit');
  const b=F[1].dots.find(x=>x._talK==='burn'); near(b.dps*4,v.maxHp*0.01,'total over 2 s in 4 ticks');
  const g=F[2]; g.maxHp=g.hp=50000; V.hit(v,g,1000,{crit:true}); assert.ok(g.alive&&g.dots.length===1); g.hp=10; secs(1.05); assert.ok(!g.alive,'the bleed finished it');
  assert.equal(stack(L,'kills'),0,'a kill by a DoT is not a kill by his hit'); assert.equal(stack(L,'dkills'),1,'unless the row asks for it');
  V.hit(v,F[1],2e9,{kind:'true'}); assert.ok(!F[1].alive); assert.equal(stack(L,'kills'),1); assert.equal(stack(L,'dkills'),2,'a direct kill counts for both');
});

test('shield, heal with overheal, energy, damage dealt by a talent (exact, no cascade), kill with overkill',()=>{
  const def={states:{bank:{max:{pct:0.1,of:'maxHp'}},k:{}},talents:{t:[{on:'heal',if:{overMin:0},do:[{stack:'bank',add:{pct:R(0.25),of:'over'}}]},
    {on:'cast',skill:'warcry',do:[{shield:{pct:0.05,of:'maxHp'},dur:3},{energy:R(7)},{stack:'bank',spend:'all',then:[{heal:{pct:1,of:'spent'}}]}]},
    {on:'hit',do:[{dmg:{pct:0.5,of:'hit'},on:{team:'enemy',of:'target',within:3,n:1,skip:'target'}}]},
    {on:'kill',do:[{stack:'k',add:1},{dmg:{pct:1,of:'overkill'},on:{team:'enemy',of:'target',n:1}}]}]}};
  const L=lab([['t',2]],{def,foes:5}), {v,F}=L;
  v.hp=v.maxHp-100; V.heal(v,500); near(v.hp,v.maxHp,'healed to full'); near(stack(L,'bank'),400*0.5,'25% per rank of the 400 that did not fit');
  V.heal(v,1e6); near(stack(L,'bank'),v.maxHp*0.1,'the pool has a cap');
  v.hp=v.maxHp*0.5; v.energy=10; V.cast(v,'green'); near(v.shield,v.maxHp*0.05,'shield size'); near(v.energy,24,'energy'); near(v.hp,v.maxHp*0.6,'the pool paid out as a heal'); assert.equal(stack(L,'bank'),0,'paying out does not bank its own overheal');
  secs(3.1); assert.equal(v.shield,0,'the shield ends with its timer');
  /* F0-F1 gap 1.48 m (inside 3 m), F0-F4 2.06 m (inside, but further), F0-F3 3.48 m (outside) */
  const h1=F[1].hp, a=lost(F[0],()=>V.hit(v,F[0],1000)); near(h1-F[1].hp,a*0.5,'the talent\'s own damage: exactly half the hit, on the nearest other enemy within 3 m');
  assert.equal(F[4].hp,1e9,'n:1 - only the nearest'); assert.equal(F[2].hp,1e9,'and that damage does not trigger the row again on the next one');
  F[1].hp=1e9; F[4].x=F[0].x+20*V.METER; F[1].x=F[0].x+20*V.METER; F[1].y=F[0].y+8*V.METER; const h3=F[3].hp; V.hit(v,F[0],1000); assert.equal(F[3].hp,h3,'nobody within 3 m of the target, body to body (the nearest is 3.48 m away): nothing');
  F[0].maxHp=F[0].hp=50; const h2=F[3].hp; V.hit(v,F[0],1000,{kind:'true'}); assert.ok(!F[0].alive); const over=-F[0].hp; near(over,950,'');
  assert.equal(stack(L,'k'),1); near(h2-F[3].hp,over,'the overkill carried in full to the enemy nearest the one that died (no distance limit on that row)');
});

test('a row is never re-entered by its own consequences: damage dealt by a kill row that kills again does not chain',()=>{
  const def={states:{k:{}},talents:{t:[{on:'kill',do:[{stack:'k',add:1},{dmg:{flat:1e12},on:{team:'enemy',of:'target',n:1}}]}]}};
  const L=lab([['t',1]],{def,foes:3}), {v,F}=L; V.hit(v,F[0],2e9,{kind:'true'});
  assert.deepEqual(J(F.map(f=>f.alive)),[false,false,true],'the hit killed the first, the damage of the row the second, and it stopped there'); assert.equal(stack(L,'k'),1);
  V.hit(v,F[2],2e9,{kind:'true'}); assert.equal(stack(L,'k'),2,'the row is free again for the next kill');
});

test('cooldowns: the value set after a cast, and changes to a running cooldown',()=>{
  const def={talents:{t:[{on:'cd',skill:'green',less:R(0.1)},{on:'cd',skill:'blue',add:-1},{on:'hit',if:{crit:true},do:[{cd:'green',add:R(-0.5)}]},{on:'kill',do:[{cd:'blue',set:0}]}]}};
  const L=lab([['t',2]],{def}), {v,F}=L;
  near(FX.cd(v,'green',8),8*0.8,'green: 10% per rank shorter'); near(FX.cd(v,'blue',7),6,'blue: 1 s shorter');
  v.greenCd=5; v.blueCd=5; V.hit(v,F[0],10,{crit:true}); near(v.greenCd,4,'a crit takes 0.5 s per rank off'); V.hit(v,F[0],10); near(v.greenCd,4,'only a crit');
  v.greenCd=0.3; V.hit(v,F[0],10,{crit:true}); assert.equal(v.greenCd,0,'never below zero'); V.hit(v,F[0],2e9); assert.equal(v.blueCd,0,'reset on a kill');
  /* in a live fight the hook sits where the cooldown is set after the cast */
  FX.define('vael',{talents:{t:[{on:'cd',skill:'green',mul:0.5}]}});
  const sn=snaps([spec('vael',100,[['t',1]]),spec('vael',100,null)]), U=V.arena([sn[0]],[sn[1]],3); let seen=0,plain=0;
  for(let i=0;i<900&&!V.ended();i++){ const a=U[0].greenCd,b=U[1].greenCd; V.step(1); if(U[0].greenCd>a+1) seen=U[0].greenCd; if(U[1].greenCd>b+1) plain=U[1].greenCd; if(seen&&plain) break; }
  near(plain,8,'the untalented Vael: Warcry\'s own 8 s'); near(seen,4,'the talented one: halved at the moment it is set');
});

test('skill options before the cast (strength, duration, radius, control seconds) and effects after it',()=>{
  const def={states:{s:{max:10}},talents:{t:[{on:'kit',skill:'warcry',opt:{mul:{bonus:R(0.5)},mulPerLv:{mul:R(0.5,1)},dur:{add:2},radius:{mul:2},fear:{add:R(0.1),per:'s',ccRaw:true}}},
    {on:'hit',do:[{stack:'s',add:1}]},{on:'cast',skill:'warcry',do:[{window:'w',dur:{opt:'dur'}}]},{on:'kit',skill:'laststand',opt:{mul:{set:1},mulPerLv:{set:0}}}]}};
  /* Warcry measures centre to centre: F0 at 4.5 m, F1 moved to 8 m, F2 moved to 11 m */
  const place=L=>{ L.put(L.F[1],0,8); L.put(L.F[2],11,0); L.F.forEach(f=>{ f.ctrlRes=0; }); };
  const fear=(L)=>{ for(let i=0;i<40;i++){ L.F.forEach(f=>{ f.fearT=0; }); V.cast(L.v,'green'); if(L.F[0].fearT>0) return; } assert.fail('Warcry never feared'); };
  const P=lab(null,{foes:3}); place(P); fear(P); const b={mul:P.v.dmgBuffMul,t:P.v.dmgBuffT,fear:P.F[0].fearT}; assert.ok(!(P.F[1].fearT>0),'plain Warcry reaches 5 m: 8 m is outside');
  V.cast(P.v,'ult'); assert.ok(P.v.drMul<1,'plain Last Stand reduces damage');
  const L=lab([['t',2]],{def,foes:3}), {v,F}=L; place(L); V.hit(v,F[2],1); V.hit(v,F[2],1); V.hit(v,F[2],1);
  let f1=false; for(let i=0;i<40;i++){ F.forEach(f=>{ f.fearT=0; }); V.cast(v,'green'); f1=f1||F[1].fearT>0; assert.ok(!(F[2].fearT>0),'11 m is outside the doubled radius'); if(F[0].fearT>0&&f1) break; }
  near(v.dmgBuffMul-1,(b.mul-1)*2,'the buff\'s bonus is 50% stronger per rank (rank 2: doubled), skill-level part included'); near(v.dmgBuffT,b.t+2,'2 s longer');
  assert.ok(f1,'radius doubled: 8 m is inside'); near(F[0].fearT,b.fear+3*0.2,'fear: +0.1 s per rank per stack, as seconds the player gets');
  assert.ok(L.T.s.w.w.t>0); near(L.T.s.w.w.t,b.t+2,'the after-cast row saw the changed option');
  V.cast(v,'ult'); assert.equal(v.drMul,1,'Last Stand with its damage reduction set off');
});

test('would die: survive at 1 HP once per fight, held for the stated time, then mortal; a second rule is not spent by the first save',()=>{
  const def={states:{s:{max:9}},talents:{a:[{on:'lethal',once:'fight',if:{stackMin:{s:5}},do:[{stack:'s',spend:'all',then:[{undying:2},{heal:{flat:10,x:'spent'}}]}]}],
    b:[{on:'lethal',once:'fight',do:[{undying:R(0.5)}]}],c:[{on:'hurt',do:[{stack:'s',add:1}]}]}};
  const L=lab([['a',1],['b',2],['c',1]],{def}), {v,F}=L;
  V.dmg(v,v.hp+500); assert.ok(v.alive); assert.equal(v.hp,1,'the first lethal hit leaves him at 1 HP (rule b: rule a needs 5 stacks)');
  V.dmg(v,9999); assert.equal(v.hp,1,'held'); secs(0.9); V.dmg(v,9999); assert.ok(v.alive&&v.hp===1,'still held inside 0.5 s x rank 2'); secs(0.2);
  for(let i=0;i<6;i++) V.hit(F[0],v,0.001); assert.ok(stack(L,'s')>=5);
  V.dmg(v,v.hp+9999); assert.ok(v.alive,'rule a was not used up by the first save'); near(v.hp,1+60,'spent 6 stacks: healed 10 each'); assert.equal(stack(L,'s'),0);
  secs(1.9); V.dmg(v,1e6); assert.ok(v.alive&&v.hp===1); secs(0.2); V.dmg(v,1e6); assert.ok(!v.alive,'both once-per-fight saves are spent: he dies');
});

test('events: kill, death of an ally / an enemy / a marked unit, wave start and wave end; control seconds in and out',()=>{
  const def={states:{ally:{},foe:{},mk:{},ws:{},we:{}},talents:{t:[{on:'death',if:{who:'ally'},do:[{stack:'ally',add:1}]},{on:'death',if:{who:'enemy'},do:[{stack:'foe',add:1}]},
    {on:'death',if:{unitHas:'x'},do:[{stack:'mk',add:1}]},{on:'wave',do:[{stack:'ws',add:1},{mark:'x',on:{team:'ally',others:true,order:'lowHp',n:1},unique:true}]},
    {on:'waveEnd',if:{holderAlive:'x'},do:[{stack:'we',add:1}]},{on:'ccIn',less:R(0.1)},{on:'ccOut',if:{cc:['fearT']},more:0.5}]}};
  const L=lab([['t',2]],{def,allies:2,foes:2}), {v,A,F}=L; assert.equal(stack(L,'ws'),1,'the wave start ran on the first tick');
  A[1].hp=A[1].maxHp=5000; V.wave(); V.step(1); assert.equal(stack(L,'ws'),2); assert.equal(stack(L,'we'),1,'wave end: the marked ally was alive'); assert.equal(L.T.s.m.x,A[1],'the lowest-HP ally is picked');
  V.dmg(F[0],2e9); assert.deepEqual([stack(L,'ally'),stack(L,'foe'),stack(L,'mk')],[0,1,0]);
  V.dmg(A[1],2e9); assert.deepEqual([stack(L,'ally'),stack(L,'foe'),stack(L,'mk')],[1,1,1]);
  V.wave(); assert.equal(stack(L,'we'),1,'wave end: the marked ally is dead, the row does not fire');
  v.stunned=0; F[1].stunned=0; F[1].ctrlRes=0; v.ctrlRes=0; F[1].ctrlHitF=0; v.ctrlHitF=0;
  let ok=false; for(let i=0;i<20&&!ok;i++){ v.stunned=0; ok=V.cc(F[1],v,'stunned',2); } near(v.stunned,2*V.ccNerf*0.8,'a control on him: 10% per rank shorter');
  ok=false; for(let i=0;i<20&&!ok;i++){ F[1].fearT=0; ok=V.cc(v,F[1],'fearT',2); } near(F[1].fearT,2*V.ccNerf*1.5,'a fear he applies: 50% longer');
  ok=false; for(let i=0;i<20&&!ok;i++){ F[1].stunned=0; ok=V.cc(v,F[1],'stunned',1); } near(F[1].stunned,1*V.ccNerf,'his stun: not in the row\'s list');
});

test('team-wide rows: the whole team\'s hits on a marked enemy, and a share of an ally\'s damage taken in their place',()=>{
  const def={states:{led:{}},talents:{t:[{on:'cast',skill:'warcry',do:[{mark:'weak',on:{team:'enemy',of:'self',n:1}},{mark:'ward',on:{team:'ally',others:true,n:1}}]},
    {on:'teamIn',if:{targetTeam:'enemy',targetHas:'weak'},more:R(0.1)},{on:'teamIn',if:{targetHas:'ward',srcTeam:'enemy'},divert:R(0.15)},{on:'diverted',do:[{stack:'led',add:{pct:1,of:'spent'}}]}]}};
  const L=lab([['t',2]],{def,allies:2,foes:2,bigVael:true}), {v,A,F}=L; v.glyphDR=0; A.forEach(a=>a.glyphDR=0);
  assert.ok(L.U.every(u=>u._talW&&u._talW.length===1&&u._talW[0]===v),'every unit of the fight is watched by the talented one');
  const base=lost(F[0],()=>V.hit(A[0],F[0],1000)), baseIn=lost(A[0],()=>V.hit(F[0],A[0],1000));
  V.cast(v,'green'); assert.ok(F[0]._talM[v.uid].weak&&A[0]._talM[v.uid].ward);
  near(lost(F[0],()=>V.hit(A[0],F[0],1000)),base*1.2,'an ally\'s hit on the marked enemy: +10% per rank'); near(lost(F[1],()=>V.hit(A[0],F[1],1000)),base,'not on the unmarked one');
  near(lost(F[0],()=>V.hit(v,F[0],1000)),lost(F[1],()=>V.hit(v,F[1],1000))*1.2,'his own hits count as his team\'s');
  const hv=v.hp, took=lost(A[0],()=>V.hit(F[0],A[0],1000)); near(took,baseIn*0.7,'the warded ally takes 30% less'); near(hv-v.hp,baseIn*0.3,'and he takes that 30%'); near(stack(L,'led'),baseIn*0.3,'the diverted amount is reported');
  const h2=v.hp; near(lost(A[1],()=>V.hit(F[0],A[1],1000)),baseIn,'another ally: nothing diverted'); assert.equal(v.hp,h2);
  v.alive=false; near(lost(A[0],()=>V.hit(F[0],A[0],1000)),baseIn,'with the owner dead the rows stop'); v.alive=true;
});

/* ====================================================== PART 2: VAEL ====================================================== */
const VAEL=FXN.mech('vael');
const full=ids=>ids.map(id=>[id,T.talent('vael',id).ranks]).sort((a,b)=>a[0]<b[0]?-1:1);
test('Vael: every talent is accounted for - a plain stat, mechanic rows, or the rulings list - and the three never overlap',()=>{
  const all=[]; for(const tr of T.trees('vael')) for(const t of tr.talents) all.push(t[0]);
  const st=all.filter(id=>FXN.has('vael',id)), me=all.filter(id=>VAEL.talents[id]), ru=all.filter(id=>VAEL.ruling[id]);
  assert.equal(all.length,124); assert.equal(st.length+me.length+ru.length,124); assert.equal(new Set(st.concat(me,ru)).size,124);
  assert.deepEqual([st.length,me.length,ru.length,Object.keys(VAEL.partial).length],[9,94,21,3]);
  for(const id of Object.keys(VAEL.talents).concat(Object.keys(VAEL.ruling),Object.keys(VAEL.partial))) assert.ok(T.talent('vael',id),id+' is a real talent id');
  for(const id of Object.keys(VAEL.partial)) assert.ok(VAEL.talents[id],id+': a partial talent has rows');
  /* every rank of every talent resolves to finite numbers */
  for(const id of me) for(let r=1;r<=T.talent('vael',id).ranks;r++){ const t=FXN.attach({uid:1},'vael',[[id,r]]); assert.ok(t,id);
    JSON.stringify(t.on,(k,x)=>{ if(typeof x==='number') assert.ok(Number.isFinite(x),id+' rank '+r+' '+k); return x; }); }
});

test('Vael / Quarry: Mark the Quarry, Long Hunt, Hunter\'s Read, Close the Distance, Pick the Next, Trophy, Head on the Wall, No Escape',()=>{
  const L=lab(full(['rh_1_1','rh_8_1','rh_4_1','rh_2_1','rh_3_1','rh_6_1','rh_12_1','rh_10_1']),{foes:3}), {v,F}=L, T0=L.T;
  v._tal=undefined; const base=lost(F[1],()=>V.hit(v,F[1],1000)), crit=lost(F[1],()=>V.hit(v,F[1],1000,{crit:true})); v._tal=T0; const b={cr:v.glyphCrit,sp:v.speed,dmg:v.dmg,ls:v.lifestealStat||0};
  near(lost(F[0],()=>V.hit(v,F[0],1000)),base,'the first hit of the wave marks the Quarry (and is not yet boosted)'); assert.equal(L.T.s.m.quarry,F[0]);
  near(lost(F[0],()=>V.hit(v,F[0],1000)),base*1.10,'+2% x 5 to the Quarry'); near(lost(F[1],()=>V.hit(v,F[1],1000)),base,'not to anyone else'); assert.equal(L.T.s.m.quarry,F[0],'only the first enemy hit each wave');
  v.target=F[0]; V.step(1); v.target=F[0]; V.step(1); near(v.glyphCrit,b.cr+0.10,'Hunter\'s Read: +2% x 5 crit while the Quarry is his target'); near(v.speed,b.sp*1.12,'Close the Distance: +4% x 3');
  v.target=F[1]; V.step(1); assert.equal(v.target,F[1]); near(v.glyphCrit,b.cr,'off against another target'); near(v.speed,b.sp,'');
  secs(6.1); near(lost(F[0],()=>V.hit(v,F[0],1000)),base*1.10*1.10,'Long Hunt: 2 steps of 3 s x 1% x 5'); secs(12); near(lost(F[0],()=>V.hit(v,F[0],1000)),base*1.10*1.25,'capped at 5 steps');
  F[0].hp=F[0].maxHp*0.4; V.step(1); assert.ok(F[0].slow>0); near(F[0].slowMul,0.85,'No Escape: the Quarry below 50% HP is slowed 5% x 3'); assert.ok(!(F[1].slow>0));
  V.hit(v,F[0],2e9,{kind:'true'}); assert.ok(!F[0].alive); assert.equal(stack(L,'trophy'),1,'Trophy: a Quarry he killed'); assert.equal(L.T.s.m.quarry,F[1],'Pick the Next: the nearest enemy is the new Quarry');
  V.step(1); near(v.dmg,b.dmg*1.045,'Trophy: 1.5% x 3 attack'); near(v.lifestealStat,b.ls+0.02,'Head on the Wall: 1% x 2 lifesteal per Trophy');
  near(lost(F[1],()=>V.hit(v,F[1],1000,{crit:false})),crit*1.10,'Pick the Next: his next hit on it is a critical even though the swing rolled none (and the Quarry bonus applies)');
  near(lost(F[1],()=>V.hit(v,F[1],1000,{crit:false})),base*1.10,'only that one hit');
  V.dmg(F[1],2e9); assert.equal(stack(L,'trophy'),1,'a Quarry that died to something else is no Trophy'); assert.equal(L.T.s.m.quarry,F[2]);
  V.hit(v,F[2],2e9,{kind:'true'}); assert.equal(stack(L,'trophy'),2);
});

test('Vael / Bleed: Open Wounds, Deep Cuts, Sunder, Grim Focus, Salt the Wound, Everything Bleeds, Bloodletter, Blood in the Air, Blood Temper, Glass Edge',()=>{
  const ids=['rh_2_2','rh_6_2','rh_3_3','rh_9_3','rh_9_2','rh_11_2','rh_12_2','rh_n2','rh_4_2','ib_1_1'];
  const L=lab(full(ids),{foes:3,allies:1,bigVael:true}), {v,F,A}=L, T0=L.T; v.glyphDR=0;
  v._tal=undefined; const base=lost(F[2],()=>V.hit(v,F[2],1000)), baseC=lost(F[2],()=>V.hit(v,F[2],1000,{crit:true})), baseA=lost(F[2],()=>V.hit(A[0],F[2],1000)), baseIn=lost(v,()=>V.hit(F[2],v,1000,{kind:'true'})); v._tal=T0; v.hp=v.maxHp; const dmg0=v.dmg;
  V.hit(v,F[0],1000); assert.equal(F[0].dots.length,0,'no bleed from a normal hit');
  const c=lost(F[0],()=>V.hit(v,F[0],1000,{crit:true})); near(c,baseC,'the opening crit: the target is not bleeding yet'); assert.equal(F[0].dots.length,1);
  near(F[0].dots[0].dps,c*0.20,'Open Wounds: 4% x 5 of the hit each second'); assert.equal(F[0].dots[0].remaining,5,'Deep Cuts: 3 s + 0.3 x 5 = 4.5 s -> 5 ticks'); near(F[0].dots[0]._talF,0.5,'the last one a half tick');
  const sv=F[0].armorRating; F[0].armorRating=sv*0.85; v._tal=undefined; const sund=lost(F[0],()=>V.hit(v,F[0],1000)); v._tal=T0; F[0].armorRating=sv;
  near(lost(F[0],()=>V.hit(v,F[0],1000)),sund*1.075,'Sunder: ignores 3% x 5 of a bleeding enemy\'s armor (and Everything Bleeds: +1.5% x 5)');
  const c2=lost(F[0],()=>V.hit(v,F[0],1000,{crit:true})); near(c2,sund*(baseC/base)*1.15*1.075,'Grim Focus: crits deal 3% x 5 more to a bleeding enemy');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000)),baseA*1.075,'Everything Bleeds: an ally\'s hit on the bleeding enemy'); near(lost(F[1],()=>V.hit(A[0],F[1],1000)),baseA,'not on one that does not bleed');
  near(lost(v,()=>V.hit(F[2],v,1000,{kind:'true'})),baseIn*0.96*(1-0.005*stack(L,'temper')),'Blood Temper: 4% less damage while an enemy carries his bleed (on top of Forge Heat\'s Temper)');
  V.step(1); near(v.dmg,dmg0*1.10,'Blood in the Air: 2 bleeds on the field x 1% x 5');
  const t0=stack(L,'temper'); secs(3); assert.equal(stack(L,'temper'),t0+2,'Blood Temper + Forge Heat: 1 Temper per 3 bleed ticks (6 ticks in 3 s from 2 bleeds)');
  V.cast(v,'blue'); v.hp=v.maxHp*0.5; const h=v.hp, took=lost(F[0],()=>V.hit(v,F[0],1000)); near(v.hp-h,took*0.10*1.30,'Salt the Wound: Bloodthirst\'s 10% lifesteal is 10% x 3 larger against a bleeding enemy');
  const h2=v.hp, took2=lost(F[2],()=>V.hit(v,F[2],1000)); near(v.hp-h2,took2*0.10,'and plain against one that does not bleed');
  const left=J(F[0].dots.map(d=>d.remaining)), n1=F[1].dots.length; assert.ok(left.length>=1); V.dmg(F[0],2e9); assert.ok(!F[0].alive);
  assert.equal(F[1].dots.length,n1+left.length,'Bloodletter: its bleeds jump to the nearest enemy'); assert.deepEqual(J(F[1].dots.slice(n1).map(d=>d.remaining)),left,'with what was left of them'); assert.ok(F[1].dots.every(d=>d._talO===v.uid));
  for(const f of F) f.dots.length=0; V.step(1); v.hp=v.maxHp; near(lost(v,()=>V.hit(F[2],v,1000,{kind:'true'})),baseIn*(1-0.005*stack(L,'temper')),'no bleed anywhere: Blood Temper\'s 4% is off'); near(v.dmg,dmg0,'and Blood in the Air too');
  /* Glass Edge */
  const G=lab(full(['rh_11_4']),{foes:1,bigVael:true}); near(lost(G.F[0],()=>V.hit(G.v,G.F[0],1000,{crit:true})),baseC*1.20,'Glass Edge: above 80% HP his crits deal 4% x 5 more');
  G.v.hp=G.v.maxHp*0.79; near(lost(G.F[0],()=>V.hit(G.v,G.F[0],1000,{crit:true})),baseC,'not at 79%'); G.v.hp=G.v.maxHp; near(lost(G.F[0],()=>V.hit(G.v,G.F[0],1000)),base,'not on a normal hit');
});

test('Vael / kills: Blood Momentum, Long Hunger, The Work Never Ends, Taste for It, Spill Over + Overflow, Cleaving Blows',()=>{
  const L=lab(full(['rh_3_4','rh_5_4','rh_9_4','rh_11_1','rh_1_4','rh_10_4','rh_7_1']),{foes:9}), {v,F}=L, ai=v.atkInterval;
  const far=f=>{ f.x=900; f.y=120+60*F.indexOf(f); };                         // out of everyone's reach, so nothing spills or cleaves onto a neighbour
  const kill=f=>{ far(f); f.maxHp=f.hp=100; V.hit(v,f,2e5,{kind:'true'}); assert.ok(!f.alive); };
  F[2].x=800; F[2].y=1300;                                                    // the lone enemy the far kills spill onto
  v.hp=v.maxHp*0.5; const h=v.hp; kill(F[8]); near(v.hp-h,v.maxHp*0.05,'Taste for It: 1% x 5 max HP per kill'); assert.equal(stack(L,'momentum'),0,'the first kill only opens the 4 s window');
  secs(3.5); kill(F[7]); assert.equal(stack(L,'momentum'),1); V.step(1); near(v.atkInterval,ai/1.15,'Blood Momentum: 3% x 5 attack speed per stack');
  secs(3.5); v.blueCd=5; kill(F[6]); assert.equal(stack(L,'momentum'),2); assert.equal(v.blueCd,5,'The Work Never Ends: not under 3 stacks');
  secs(3.5); kill(F[5]); assert.equal(stack(L,'momentum'),3,'max 3'); assert.equal(v.blueCd,0,'The Work Never Ends: at 3 stacks a kill resets Bloodthirst');
  secs(4.5); const f6=F[3]; kill(f6); assert.equal(stack(L,'momentum'),3,'a kill after the 4 s window adds nothing, but the stacks (4 + 5 s, Long Hunger) are still up and are refreshed');
  secs(8.9); assert.equal(stack(L,'momentum'),3,'Long Hunger: stacks last 4 + 5 s'); secs(0.2); assert.equal(stack(L,'momentum'),0,'then all drop'); V.step(1); near(v.atkInterval,ai,'attack speed back');
  /* F0 (4.5,0): F1 is 1.48 m from it body to body, F4 2.06 m. Kill F0 with a basic attack. */
  F[0].maxHp=F[0].hp=100; const h1=F[1].hp, h4=F[4].hp; V.hit(v,F[0],2e5,{auto:true,kind:'true'}); const over=-F[0].hp; assert.ok(!F[0].alive); near(over,2e5-100,'');
  near(h1-F[1].hp,over*(0.60+0.30)+2e5*0.40,'Spill Over 20% x 3 + Overflow 6% x 5 of the overkill to the nearest enemy, and Cleaving Blows 8% x 5 of the hit to the enemy beside the target'); assert.equal(F[4].hp,h4,'2.06 m from the target: not "beside" (2 m)');
  /* F1 (10,0): its neighbours are gone or far; F4 is brought beside it (the engine pushes same-team bodies to 5.23 m: a gap of 1.21 m) */
  F[1].hp=1e9; L.put(F[4],10,4.6); V.step(1); const g4=F[4].hp; V.hit(v,F[1],1000); assert.equal(F[4].hp,g4,'Cleaving Blows: only basic attacks'); const y=lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})); near(g4-F[4].hp,y*0.40,'a basic attack: 40% of the hit to the one enemy within 2 m');
});

test('Vael / Warcry and hit talents: Warpath, Execution Hour + Hobble, Butcher\'s Rhythm, Adrenaline, Reckless, Killer\'s Calm, Counterblow, Weight of Iron',()=>{
  const P=lab(null); V.cast(P.v,'green'); const plainMul=P.v.dmgBuffMul;
  const L=lab(full(['rh_5_1','rh_5_3','rh_6_3','rh_10_3','rh_8_3','rh_7_4','rh_12_3','ib_5_4','ib_7_3']),{foes:3,bigVael:true}), {v,F}=L, T0=L.T, ai=v.atkInterval; v.glyphDR=0;
  v._tal=undefined; const base=lost(F[2],()=>V.hit(v,F[2],1000)), baseC=lost(F[2],()=>V.hit(v,F[2],1000,{crit:true})); v._tal=T0;
  near(lost(F[2],()=>V.hit(v,F[2],1000,{crit:true})),baseC*1.10*1.30,'Reckless +2% x 5 dealt; Killer\'s Calm: the first hit of the wave, a critical, +10% x 3');
  near(lost(F[2],()=>V.hit(v,F[2],1000,{crit:true})),baseC*1.10,'only the first hit'); near(lost(v,()=>V.hit(F[2],v,1000,{kind:'true'})),1000*1.05,'Reckless: +1% x 5 taken');   // (hit 1 taken)
  assert.ok(F[2].slow>0); near(F[2].slowMul,0.90,'Weight of Iron: his hits slow 2% x 5'); secs(1.05); assert.ok(!(F[2].slow>0),'for 1 s');
  /* Warcry reaches 5 m centre to centre: F0 (4.5 m) and F1 moved to 4.6 m are inside, F2 (15.5 m) is not */
  L.put(F[1],0,4.6); F[0].hp=F[0].maxHp*0.2; F[2].hp=F[2].maxHp*0.2; V.cast(v,'green'); near(v.dmgBuffMul-1,(plainMul-1)*1.15,'Warpath: the buff is 3% x 5 stronger');
  const ex=f=>!!(f._talM&&f._talM[v.uid]&&f._talM[v.uid].exec);
  assert.ok(ex(F[0]),'Execution Hour: marked (below 30% HP, in range)'); assert.ok(!ex(F[1]),'healthy: not marked'); assert.ok(!ex(F[2]),'out of Warcry\'s range: not marked');
  V.step(1); near(F[0].slowMul,0.70,'Hobble: marked enemies are slowed 10% x 3'); v.dmgBuffT=0;
  near(lost(F[0],()=>V.hit(v,F[0],1000)),base*1.10*1.40,'the next hit on a marked enemy: +40%'); near(lost(F[0],()=>V.hit(v,F[0],1000)),base*1.10,'once'); secs(1.3); assert.ok(!(F[0].slow>0),'and Hobble ends with the mark (Weight of Iron\'s own 1 s slow has run out too)');
  v.greenCd=6; V.hit(v,F[1],10,{crit:true}); near(v.greenCd,5.5,'Butcher\'s Rhythm: a crit takes 0.1 s x 5 off Warcry');
  v.hp=v.maxHp*0.39; V.step(1); near(v.atkInterval,ai/1.15,'Adrenaline: +3% x 5 attack speed below 40% HP'); v.hp=v.maxHp; V.step(1); near(v.atkInterval,ai,'');
  V.hit(F[1],v,1); near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),base*1.10,'Counterblow: not yet (2 hits taken)'); V.hit(F[1],v,1);
  near(lost(F[1],()=>V.hit(v,F[1],1000)),base*1.10,'a hit that is not a basic attack does not use it'); near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),base*1.10*1.50,'after 3 hits taken the next attack deals +10% x 5'); near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),base*1.10,'once');
});

test('Vael / Temper: Forge Heat, Hammered Steel, Tempered Edge, Quench, Slag, Cooling Hiss, Forgeborn, Unyielding',()=>{
  const P=lab(null,{bigVael:true}); const dmg0=P.v.dmg; P.v.hp=P.v.maxHp*0.25; const hp=P.v.hp; V.cast(P.v,'ult'); const lsHeal=P.v.hp-hp;
  const L=lab(full(['ib_1_1','ib_6_1','ib_11_1','ib_2_1','ib_8_1','ib_10_1','ib_12_1','ib_10_3']),{foes:2,bigVael:true}), {v,F}=L, mh=v.maxHp; v.glyphDR=0;
  const tru=a=>lost(v,()=>V.hit(F[1],v,a,{kind:'true'}));
  assert.equal(stack(L,'temper'),10,'Forgeborn: starts the wave with 5 x 2 Temper'); near(v.dmg,dmg0*1.03,'Hammered Steel: 0.1% x 3 attack per Temper'); near(v.glyphCrit,10*0.0025,'Tempered Edge: 0.05% x 5 crit per Temper');
  for(let i=0;i<4;i++) V.hit(v,F[0],1); assert.equal(stack(L,'temper'),14,'Forge Heat: 1 Temper per hit'); V.step(1); near(v.dmg,dmg0*1.042,''); near(v.glyphCrit,14*0.0025,'');
  near(tru(1000),1000*(1-14*0.005),'Forge Heat: 0.1% x 5 less damage per Temper'); assert.equal(F[1].dots.length,0,'Slag: not under 15 Temper');
  for(let i=0;i<30;i++) V.hit(v,F[0],1); assert.equal(stack(L,'temper'),20,'max 20');
  tru(1000); assert.equal(F[1].dots.length,1,'Slag: at 15+ Temper the attacker burns'); near(F[1].dots[0].dps*4,mh*0.025,'0.5% x 5 of his max HP over 2 s'); tru(1000); assert.equal(F[1].dots.length,1,'refreshed, not stacked');
  v.hp=mh; near(tru(mh*0.2),mh*0.2*0.90*0.5,'Quench: a hit over 10% of his max HP is halved'); assert.equal(stack(L,'temper'),15,'for 5 Temper at rank 3');
  near(tru(mh*0.05),mh*0.05*(1-15*0.005),'a smaller hit is not, and costs nothing'); assert.equal(stack(L,'temper'),15);
  v.hp=mh*0.25; near(tru(1000),1000*(1-15*0.005)*0.90,'Unyielding: 2% x 5 less below 30% HP');
  v.hp=mh*0.25; const h=v.hp; V.cast(v,'ult'); assert.equal(stack(L,'temper'),0,'Cooling Hiss: Last Stand spends all Temper'); near((v.hp-h)-lsHeal,mh*15*0.015,'and heals 0.5% x 3 max HP for each (on top of Last Stand\'s own heal)');
  V.wave(); V.step(1); assert.equal(stack(L,'temper'),10,'Forgeborn again at the next wave');
});

test('Vael / Blood Bank: banking overheal, Blood Reserve, Blood Money, Withdrawal, Golden Vein, Share the Wealth, Investment, Sanguine Hide',()=>{
  let L=lab(full(['ib_2_2','ib_6_2','ib_9_2','ib_4_2','ib_12_2','ib_5_2']),{foes:1,allies:1}), {v,F,A}=L; const dmg0=v.dmg, mh=v.maxHp;
  V.cast(v,'blue'); v.hp=mh*0.9; const h=v.hp, took=lost(F[0],()=>V.hit(v,F[0],1000)); near(v.hp-h,took*0.2,'Investment: while the bank is empty Bloodthirst\'s 10% lifesteal is doubled');
  v.hp=mh-50; V.heal(v,1050); near(stack(L,'bank'),1000*0.40,'Blood Bank: 8% x 5 of the overheal'); v.hp=mh*0.9; const took2=lost(F[0],()=>V.hit(v,F[0],1000)); near(v.hp-mh*0.9,took2*0.1,'bank not empty: plain lifesteal');
  v.hp=mh; V.heal(v,1e7); near(stack(L,'bank'),mh*0.25,'cap 15% of max HP + Blood Reserve 2% x 5'); V.step(1); near(v.dmg,dmg0*1.10,'Blood Money: +2% x 5 attack while the bank is full');
  v.stunned=5; v.hp=mh*0.39; V.step(1); near(v.hp,mh*0.39+mh*0.25*(1+0.30+0.20),'Withdrawal: under 40% HP the bank pays out, 10% x 3 larger, + Golden Vein 4% x 5'); assert.equal(stack(L,'bank'),0); assert.equal(v.stunned,0,'Golden Vein: one control effect removed');
  V.step(1); near(v.dmg,dmg0,'Blood Money is off again'); v.stunned=1e6;
  v.hp=mh; V.heal(v,1e7); v.hp=mh*0.5; V.step(1); assert.ok(stack(L,'bank')>0,'no second payout while he stays below 40%... he is at 50%: nothing'); v.hp=mh*0.45; V.step(1); assert.ok(stack(L,'bank')>0); v.hp=mh*0.39; V.step(1); assert.equal(stack(L,'bank'),0,'the next time he drops below 40% it pays again');
  const P=lab(null); V.cast(P.v,'ult'); assert.ok(P.v.drMul<1,'plain Last Stand reduces damage');
  L=lab(full(['ib_2_2','ib_7_2']),{foes:1}); v=L.v; V.heal(v,1e7); const bk=stack(L,'bank'); near(bk,v.maxHp*0.15,'the plain cap'); V.cast(v,'ult'); assert.equal(v.drMul,1,'Sanguine Hide: no damage reduction'); near(v.shield,bk*2,'the bank becomes a shield of twice its size'); assert.equal(stack(L,'bank'),0);
  assert.ok(v.shieldT>=4.9&&v.shieldT<=5.01,'for Last Stand\'s 5 s');
  L=lab(full(['ib_2_2','ib_4_2','ib_5_3']),{foes:1,allies:2}); v=L.v; A=L.A; V.heal(v,1e7); A[1].maxHp=1e6; A[1].hp=1000; A[0].maxHp=1e6; A[0].hp=5000; v.hp=v.maxHp*0.3; const hv=v.hp; V.step(1);
  near(A[1].hp-1000,v.maxHp*0.15*1.3,'Share the Wealth: the payout goes to the lowest-HP ally'); assert.equal(v.hp,hv,'not to Vael'); assert.equal(A[0].hp,5000);
});

test('Vael / Grudge and Retaliation: Grudge, Bad Blood, Old Grudges, Settle the Score, Spiked Mail, Iron Thorns, Debt Paid, Pain into Power',()=>{
  const L=lab(full(['ib_3_4','ib_6_4','ib_11_4','ib_9_4','ib_1_4','ib_10_4','ib_12_4','ib_7_4']),{foes:3,bigVael:true}), {v,F}=L, T0=L.T, mh=v.maxHp; v.glyphDR=0; F.forEach(f=>f.glyphDR=0);
  v._tal=undefined; const base=lost(F[2],()=>V.hit(v,F[2],1000)); v._tal=T0; v.hp=mh*0.5; const dmg0=v.dmg, tru=(f,a)=>lost(v,()=>V.hit(f,v,a,{kind:'true'}));
  F[0].melee=true; F[1].melee=false;
  const h0=F[0].hp, hv=v.hp; tru(F[0],1000); near(h0-F[0].hp,v.armorRating*0.06,'Spiked Mail: a melee attacker takes 2% x 3 of his armor'); near(v.hp-(hv-1000),v.armorRating*0.06*0.15,'Debt Paid: he heals 5% x 3 of that');
  const h1=F[1].hp; tru(F[1],3000); near(h1-F[1].hp,v.armorRating*0.06*0.50,'Iron Thorns: a ranged attacker takes 10% x 5 of the melee amount');
  assert.equal(L.T.s.m.grudge,F[1],'Grudge: the enemy that has dealt him the most damage this wave'); assert.ok(F[0]._talM[v.uid].oldgrudge,'the one that was the Grudge is remembered');
  v._brTaken=0;   /* Blood Rage (his real passive) would add its own share for the damage he has taken: keep it out of the comparison */
  near(lost(F[1],()=>V.hit(v,F[1],1000)),base*1.10,'+2% x 5 to the Grudge'); near(lost(F[0],()=>V.hit(v,F[0],1000)),base*1.10,'Old Grudges: 20% x 5 of the bonus stays on the old Grudge'); near(lost(F[2],()=>V.hit(v,F[2],1000)),base,'nothing on a third enemy');
  const hb=v.hp, t=lost(F[1],()=>V.hit(v,F[1],1000)); near(v.hp-hb,t*0.03,'Bad Blood: hits on the Grudge heal 1% x 3 of the damage');
  secs(3.1); v.hp=mh; tru(F[1],mh*0.25); V.step(1); near(v.dmg,dmg0*1.10,'Pain into Power: 1% x 5 attack for every 10% of max HP lost within 3 s (25% lost: 2 steps)');
  tru(F[1],mh*0.06); V.step(1); near(v.dmg,dmg0*1.15,'31% inside 3 s: 3 steps'); secs(4.1); near(v.dmg,dmg0,'for 4 s after the last loss');
  assert.equal(L.T.s.m.grudge,F[1]); v.hp=mh*0.5; const hs=v.hp; F[1].hp=1000; V.hit(v,F[1],2000,{kind:'true'}); assert.ok(!F[1].alive); near(v.hp-hs,mh*0.10,'Settle the Score: killing the Grudge heals 10% max HP');
  const back=v.armorRating*0.06*0.15;   /* F2 is melee: Spiked Mail answers and Debt Paid heals him a little */
  near(tru(F[2],1000),1000*0.70-back,'and he takes 30% less'); secs(2.1); near(tru(F[2],1000),1000-back,'for 2 s');
  V.wave(); V.step(1); tru(F[2],10); assert.equal(L.T.s.m.grudge,F[2],'a new wave: the count starts again');
});

test('Vael / Scars: First Scar, Deep Scars, Hard Lessons, Callused, Old Wounds Ache, Ten Thousand Cuts, Grim Memory, Reopened Wounds, Scar Tissue, Ash and Iron, War Ledger, Every Scar a Name, Unbroken',()=>{
  const ids=['aw_1_1','aw_3_3','aw_2_1','aw_6_1','aw_10_1','aw_12_1','aw_5_1','aw_3_1','aw_4_1','aw_11_1','aw_8_1','aw_9_1','aw_11_2'];
  const fearOn=(L)=>{ L.F[0].ctrlRes=0; for(let i=0;i<40;i++){ L.F[0].fearT=0; L.F[0].forcedTarget=null; L.F[0].forcedTargetT=0; V.cast(L.v,'green'); if(L.F[0].fearT>0) return L.F[0].fearT; } assert.fail('Warcry never feared'); };
  const P=lab(null); const fear0=fearOn(P); P.v.hp=P.v.maxHp*0.3; const ph=P.v.hp; V.cast(P.v,'ult'); const lsHeal=P.v.hp-ph;
  const L=lab(full(ids),{foes:2,allies:1}), {v,F,A}=L, b={ar:v.armorRating,mr:v.mrRating,dmg:v.dmg,ls:v.lifestealStat||0}, mh=v.maxHp; v.glyphDR=0; assert.equal(mh,P.v.maxHp);
  const take=frac=>{ v.hp=mh; V.hit(F[0],v,mh*frac,{kind:'true'}); };
  take(0.089); assert.equal(stack(L,'scars'),0,'First Scar at rank 5: a hit under 9% of max HP leaves none'); take(0.091); assert.equal(stack(L,'scars'),1,'a hit of 9% or more leaves a Scar');
  L.T.s.k.scars.n=4; fearOn(L); near(F[0].fearT,fear0+4*0.15,'War Ledger: +0.03 s x 5 of fear per Scar'); assert.notEqual(F[0].forcedTarget,v,'Every Scar a Name: not under 10 Scars');
  for(let i=0;i<30;i++) take(0.091); assert.equal(stack(L,'scars'),20,'Deep Scars: 10 + 2 x 5');
  fearOn(L); near(F[0].fearT,V.fearCap,'the engine caps any fear at '+V.fearCap+' s: War Ledger cannot go past it'); assert.equal(F[0].forcedTarget,v,'Every Scar a Name: at 10+ Scars the feared are taunted'); near(F[0].forcedTargetT,1.5,'for 1.5 s');
  v.hp=mh; V.step(1); near(v.armorRating,b.ar*(1+20*0.015),'Hard Lessons: 0.3% x 5 armor per Scar'); near(v.mrRating,b.mr*1.30,'and magic resist'); near(v.dmg,b.dmg*1.20,'Callused: 0.2% x 5 attack per Scar'); near(v.lifestealStat,b.ls,'Old Wounds Ache: off above 50% HP');
  v.hp=mh*0.4; V.step(1); near(v.lifestealStat,b.ls+20*0.015,'Old Wounds Ache: 0.3% x 5 lifesteal per Scar below 50% HP');
  v.hp=mh*0.3; const h=v.hp; V.cast(v,'ult'); assert.equal(stack(L,'scars'),0,'Reopened Wounds: Last Stand spends all Scars');
  near(v.hp-h,lsHeal+20*0.02*mh,'and heals 2% max HP per Scar (on top of Last Stand\'s own heal)'); near(v.shield,20*0.03*mh,'Scar Tissue: a shield of 0.6% x 5 max HP per Scar spent');
  V.step(1); near(v.armorRating,b.ar*(1+20*0.05),'Ash and Iron: 1% x 5 armor per Scar spent'); secs(4.1); near(v.armorRating,b.ar,'for 4 s'); assert.equal(v.shield,0,'the shield lasted 4 s too');
  V.dmg(A[0],2e9); assert.equal(stack(L,'scars'),6,'Grim Memory: 2 x 3 Scars when an ally dies');
  let n0=stack(L,'scars'), k=0; while(stack(L,'scars')===n0&&k<25){ V.hit(F[0],v,1,{kind:'true'}); k++; } assert.equal(stack(L,'scars'),n0+1,'Ten Thousand Cuts: small hits add up to a Scar');
  for(let i=0;i<19;i++) V.hit(F[0],v,1,{kind:'true'}); assert.equal(stack(L,'scars'),n0+1,'19 more small hits: not yet'); V.hit(F[0],v,1,{kind:'true'}); assert.equal(stack(L,'scars'),n0+2,'the 20th gives a Scar (rank 5: every 20th)');
  const n=stack(L,'scars'); v.hp=100; v.shield=0; V.dmg(v,5000); assert.ok(v.alive,'Unbroken: with 5+ Scars a killing hit is survived'); assert.equal(stack(L,'scars'),0,'all Scars spent'); near(v.hp,1+n*0.03*mh,'healed 3% max HP per Scar');
  V.dmg(v,1e7); assert.ok(v.alive&&v.hp===1,'he cannot die for 2 s'); secs(2.1); V.dmg(v,1e7); assert.ok(!v.alive,'once per fight');
  const U=lab(full(['aw_11_2','aw_1_1']),{foes:1}); U.v.hp=100; V.dmg(U.v,5000); assert.ok(!U.v.alive,'Unbroken needs 5 Scars: with none he dies');
});

test('Vael / Footing: Footing, Stubborn Ground, Rooted Stance, Anvil, Mountain Stance, Plant Your Feet, Footfall, Hold the Gate (its Footing and cannot-be-moved)',()=>{
  const walk=(L,on)=>{ const v=L.v; if(on){ L.put(L.F[0],15.5,0); v.stunned=0; v.greenCd=99; v.blueCd=99; v.energy=0; } else { v.stunned=1e6; L.put(L.F[0],0,0); L.F[0].x=v.x+4.5*V.METER; } };
  let L=lab(full(['aw_2_2']),{foes:1,bigVael:true}), {v,F}=L; v.glyphDR=0; const tru=a=>lost(v,()=>V.hit(F[0],v,a,{kind:'true'}));
  secs(0.9); assert.equal(stack(L,'footing'),0); secs(0.2); assert.equal(stack(L,'footing'),1,'one stack per full second standing still'); secs(2); assert.equal(stack(L,'footing'),3);
  near(tru(1000),1000*(1-3*0.02),'each stack: 0.4% x 5 less damage'); secs(5); assert.equal(stack(L,'footing'),5,'max 5');
  const x0=v.x; walk(L,true); V.step(2); assert.ok(v.x!==x0,'he walks toward the far enemy'); assert.equal(stack(L,'footing'),0,'moving clears all of it'); secs(1.2); assert.equal(stack(L,'footing'),0,'and none builds while he walks');
  walk(L,false); secs(1.1); assert.equal(stack(L,'footing'),1,'standing again: it builds from nothing');
  L=lab(full(['aw_2_2','aw_8_3','aw_4_2','aw_9_2','aw_10_3','aw_5_2','aw_6_2','aw_7_2']),{foes:2,bigVael:true}); v=L.v; F=L.F; v.glyphDR=0; const sp=v.speed, mh=v.maxHp; F.forEach(f=>{ f.glyphDR=0; f.ctrlRes=0; });
  secs(2.05); assert.equal(stack(L,'footing'),3,'Stubborn Ground: 10% x 5 faster (3 stacks in 2 s)'); secs(1.4); assert.equal(stack(L,'footing'),5);
  const h=F[0].hp, took=lost(v,()=>V.hit(F[0],v,1000,{kind:'true'})); near(took,900,''); near(h-F[0].hp,took*0.10,'Anvil: at full Footing the attacker takes 2% x 5 of that hit back'); near(F[0].slowMul,0.85,'Rooted Stance: and is slowed 3% x 5'); near(F[0].slow,2*1.2,'for 2 s (Mountain Stance: 4% x 5 longer at full Footing)');
  let ok=false; for(let i=0;i<30&&!ok;i++){ F[1].fearT=0; ok=V.cc(v,F[1],'fearT',2); } near(F[1].fearT,2*V.ccNerf*1.2,'Mountain Stance: his fear lasts 20% longer at full Footing'); F[1].fearT=0;
  /* Plant Your Feet while he is walking: F0 stands 2.4 m from him body to body, so he is still on his way when Warcry fires */
  L.put(F[0],6.4,0); L.put(F[1],0,14); v.stunned=0; v.greenCd=99; v.blueCd=99; v.energy=0; const x1=v.x; V.step(2); assert.ok(v.x!==x1,'walking'); assert.equal(stack(L,'footing'),0);
  const h1=F[0].hp, h3=F[1].hp; V.cast(v,'green'); V.step(1); assert.equal(stack(L,'footing'),5,'Plant Your Feet: Warcry gives full Footing at once, even mid-stride'); assert.equal(v.speed,0,'and roots him: he cannot walk');
  const x2=v.x; secs(1.8); assert.equal(v.x,x2,'rooted for 2 s'); assert.equal(v.speed,0); assert.equal(F[0].hp,h1); secs(0.3); near(v.speed,sp,'then free'); near(h1-F[0].hp,mh*0.06,'Footfall: when the root ends, enemies within 3 m take 3% x 2 of his max HP'); assert.equal(F[1].hp,h3,'far away: untouched');
  v.stunned=1e6; V.step(2); const im=v.immovable; V.cast(v,'ult'); V.step(1); assert.equal(stack(L,'footing'),5,'Hold the Gate: Last Stand gives full Footing'); assert.equal(v.immovable,true,'and he cannot be moved');
  secs(5.1); assert.equal(!!v.immovable,!!im,'until Last Stand ends');
});

test('Vael / Oath: Bound by Oath, Shared Burden, Oath Ledger, Debt Collector, Unpaid Debt, Sworn Shield, Promise Kept, Bitter Ash',()=>{
  const L=lab(full(['aw_4_4','aw_9_4','aw_5_4','aw_11_4','aw_6_4','aw_8_4','aw_12_4','aw_4_3']),{foes:2,allies:3,bigVael:true,cold:true}), {v,F,A}=L, mh=v.maxHp; v.glyphDR=0; A.forEach(a=>a.glyphDR=0); F.forEach(f=>f.glyphDR=0);
  A[0].maxHp=1e7; A[0].hp=9000; A[1].maxHp=1e7; A[1].hp=4000; A[2].maxHp=1e7; A[2].hp=7000; V.step(1);
  assert.equal(L.T.s.m.oath,A[1],'the Oath goes to the lowest-HP ally at the start of the wave'); assert.equal(L.T.s.m.oath2,A[2],'Shared Burden: the next-lowest is covered too');
  A.forEach(a=>{ a.maxHp=a.hp=1e9; }); const tru=(f,t,a)=>lost(t,()=>V.hit(f,t,a,{kind:'true'}));
  near(tru(F[0],A[0],1000),1000,'an ally outside the Oath takes the whole hit');
  let hv=v.hp; near(tru(F[0],A[1],1000),880,'the Oath ally takes 4% x 3 less'); near(hv-v.hp,120,'and Vael takes it'); near(stack(L,'ledger'),120,'Oath Ledger writes it down');
  hv=v.hp; near(tru(F[0],A[2],1000),950,'Shared Burden: 1% x 5'); near(hv-v.hp,50,''); near(stack(L,'ledger'),170,'');
  V.cast(v,'blue'); v.hp=mh*0.5; A[1].hp=1e8; const ha=A[1].hp, t=lost(F[0],()=>V.hit(v,F[0],1000)); near(A[1].hp-ha,t*0.10*0.12,'Sworn Shield: the Oath ally is healed 4% x 3 of Bloodthirst\'s heal');
  V.hit(F[1],v,1,{kind:'true'}); v.hp=mh*0.5; let t2=lost(F[1],()=>V.hit(v,F[1],1000)); near(v.hp-mh*0.5,t2*0.10*1.14,'Bitter Ash: Bloodthirst heals 7% x 2 more against an enemy that hit him in the last 2 s');
  secs(2.1); v.hp=mh*0.5; t2=lost(F[1],()=>V.hit(v,F[1],1000)); near(v.hp-mh*0.5,t2*0.10,'not after 2 s');
  /* Vael-F0 gap 0.48 m, Vael-F1 gap 5.98 m */
  const h0=F[0].hp, h1=F[1].hp; V.cast(v,'ult'); near(h0-F[0].hp,170*0.30,'Oath Ledger: Last Stand bursts 6% x 5 of the written damage around him (5 m)'); assert.equal(F[1].hp,h1,'6 m away: untouched'); assert.equal(stack(L,'ledger'),0,'the ledger clears');
  assert.equal(F[0].forcedTarget,v,'Debt Collector: the burst taunts'); near(F[0].forcedTargetT,1.0,'0.2 s x 5'); assert.notEqual(F[1].forcedTarget,v);
  v.energy=10; V.wave(); near(v.energy,13,'Promise Kept: the Oath ally is alive when the wave ends: +1 x 3 energy'); V.step(1); secs(5.2); v.hp=mh;
  near(tru(F[0],v,1000),1000,''); const oath=L.T.s.m.oath; V.dmg(oath,2e9); assert.ok(!oath.alive); near(tru(F[0],v,1000),700,'Unpaid Debt: the Oath ally died: 6% x 5 less damage');
  const e1=v.energy; V.wave(); assert.equal(v.energy,e1,'Promise Kept: not when the Oath ally is dead'); V.step(1); const o2=L.T.s.m.oath; assert.ok(o2.alive&&o2!==oath,'a new Oath at the next wave'); near(tru(F[0],v,1000),1000,'Unpaid Debt lasted for the rest of that wave only');
});

test('Vael / Block and control: Shield Arm, Turned Aside, Tenacity, Seared Shut, Last Breath',()=>{
  const L=lab(full(['aw_1_3','aw_3_4','ib_n1','rh_12_4']).concat([['aw_2_3',1]]).sort((a,b)=>a[0]<b[0]?-1:1),{foes:1,seed:11}), {v,F}=L; v.glyphDR=0; v.maxHp=1e9; v.hp=1e8;
  const a=[]; for(let i=0;i<400;i++){ const h=v.hp; V.hit(F[0],v,1000,{auto:true,kind:'true'}); a.push(h-v.hp); }
  const blocked=a.filter(x=>x<900); assert.ok(blocked.length>35&&blocked.length<90,'Shield Arm: about 15% of 400 basic attacks blocked: '+blocked.length); assert.ok(a.filter(x=>x>=900).every(x=>Math.abs(x-1000)<1e-4));
  near(blocked[0],1000*0.65-v.maxHp*0.004,'a blocked hit deals 35% less, and Turned Aside (rank 1) heals 0.4% max HP per block'); assert.ok(blocked.every(x=>Math.abs(x-blocked[0])<1e-3));
  for(let i=0;i<100;i++){ const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h-v.hp,1000,'a hit that is not a basic attack is never blocked',1e-6); }
  v.stunned=0; F[0].ctrlHitF=0; v.ctrlRes=0; let ok=false; for(let i=0;i<30&&!ok;i++){ v.stunned=0; ok=V.cc(F[0],v,'stunned',2); } near(v.stunned,2*V.ccNerf*0.8,'Tenacity: control on him lasts 4% x 5 shorter'); v.stunned=1e6;
  V.dot(v,1000,3,1,F[0]); const h2=v.hp; secs(1.02); near(h2-v.hp,850,'Seared Shut: DoTs on him deal 5% x 3 less'); v.dots.length=0;
  v.maxHp=v.hp=1000; V.dmg(v,5000); assert.ok(v.alive&&v.hp===1,'Last Breath: a killing hit leaves him at 1 HP'); secs(1.4); V.dmg(v,5000); assert.ok(v.alive,'for 0.5 s x 3'); secs(0.2); V.dmg(v,5000); assert.ok(!v.alive,'once per fight');
});

test('Vael / signatures: The Last Harvest (and its 91-point line), Heart of Iron (and its 91-point line)',()=>{
  const P=lab(null,{foes:1}); const plainC=lost(P.F[0],()=>V.hit(P.v,P.F[0],1000,{crit:true})), plainN=lost(P.F[0],()=>V.hit(P.v,P.F[0],1000));
  const hw=L=>L.T.s.w.harvest?L.T.s.w.harvest.t:0;
  /* F2 (15.5,0) is the Quarry. F0 (4.5,0): F1 is 1.48 m from it, F4 2.06 m, F3 3.48 m. */
  let L=lab(full(['rh_1_1','rh_2_2','rh_13_2']),{foes:6}), {v,F}=L; assert.ok((L.T.pts.red_harvest||0)<91);
  V.hit(v,F[2],10); assert.equal(L.T.s.m.quarry,F[2]); assert.equal(hw(L),0);
  V.hit(v,F[2],2e9,{kind:'true'}); assert.ok(!F[2].alive); near(hw(L),6,'killing the Quarry starts the Harvest: 6 s (the starting kill adds nothing)');
  const c=lost(F[0],()=>V.hit(v,F[0],1000,{crit:false})); near(c,plainC,'every hit is a critical during the Harvest, whatever the swing rolled');
  assert.equal(F[0].dots.length,1,'the crit opens a wound on its target'); assert.equal(F[1].dots.length,1,'and spreads Open Wounds to enemies within 3 m'); assert.equal(F[4].dots.length,1,''); near(F[1].dots[0].dps,c*0.20,'at Open Wounds\' own rank'); assert.equal(F[3].dots.length,0,'3.48 m away: no');
  secs(1); const before=hw(L); V.hit(v,F[5],2e9,{kind:'true'}); near(hw(L),before+1,'each kill during the Harvest adds 1 s'); secs(before+1+0.1); assert.equal(hw(L),0,'it ends');
  const d0=F[3].dots.length; near(lost(F[3],()=>V.hit(v,F[3],1000,{crit:false})),plainN,'after it: a normal hit again'); assert.equal(F[3].dots.length,d0);
  /* cooldown 25 s */
  V.wave(); V.step(1); V.hit(v,F[1],10); assert.equal(L.T.s.m.quarry,F[1]); V.hit(v,F[1],2e9,{kind:'true'}); assert.equal(hw(L),0,'cooldown 25 s: a second Quarry kill 8 s after the first starts nothing');
  secs(18); V.wave(); V.step(1); V.hit(v,F[0],10); V.hit(v,F[0],2e9,{kind:'true'}); near(hw(L),6,'after the cooldown it starts again');
  /* the 91-point line */
  L=lab(full(['rh_1_1','rh_2_2','rh_13_2']),{foes:3}); v=L.v; F=L.F; V.hit(v,F[0],10); V.dmg(F[0],2e9); assert.equal(hw(L),0,'under 91 points: a Quarry that dies to something else starts nothing');
  L=lab(ptsList(0,91,['rh_1_1','rh_2_2','rh_13_2']),{foes:3}); v=L.v; F=L.F; assert.equal(L.T.pts.red_harvest,91); V.hit(v,F[0],10); assert.equal(L.T.s.m.quarry,F[0]); V.dmg(F[0],2e9);
  near(hw(L),6,'AT 91 POINTS in Red Harvest: the Quarry dying to anything starts the Harvest');
  L=lab(ptsList(0,91,['rh_1_1','rh_2_2','rh_13_2']),{foes:3}); v=L.v; F=L.F; V.hit(v,F[0],10); V.hit(v,F[0],2e9,{kind:'true'}); near(hw(L),6,'and his own kill still starts it for 6 s, not 7');

  /* Heart of Iron. Vael-F0 gap 0.48 m, Vael-F3 1.98 m, Vael-F1 5.98 m */
  L=lab(full(['ib_2_2','ib_1_1','ib_13_2']),{foes:4}); v=L.v; F=L.F; F.forEach(f=>{ f.glyphDR=0; }); V.heal(v,1e7); const bank=stack(L,'bank'); near(bank,v.maxHp*0.15,'');
  v.hp=v.maxHp*0.31; V.step(1); assert.ok(!L.T.s.w.heart,'31% HP: not yet');
  v.hp=v.maxHp*0.29; V.step(1); near(L.T.s.w.heart.t,8,'below 30% HP: Heart of Iron for 8 s',1e-2); near(v.shield,bank,'the banked blood becomes a shield'); assert.equal(stack(L,'bank'),0);
  const h1=F[1].hp,h3=F[3].hp, a=lost(F[0],()=>V.hit(v,F[0],1000,{auto:true})); near(h3-F[3].hp,a,'his attacks hit every enemy within 3 m'); assert.equal(F[1].hp,h1,'6 m away: no');
  const t0=stack(L,'temper'); V.hit(F[0],v,1); V.hit(F[0],v,1); assert.equal(stack(L,'temper'),t0+2,'every hit he takes gives Temper');
  secs(8.1); assert.equal(L.T.s.w.heart.t,0,'8 s'); assert.equal(stack(L,'bank'),0,'under 91 points the shield is not returned');
  const hh=F[3].hp; V.hit(v,F[0],1000,{auto:true}); assert.equal(F[3].hp,hh,'after it his attacks hit one enemy again');
  v.hp=v.maxHp; V.step(1); v.hp=v.maxHp*0.2; V.step(1); assert.equal(L.T.s.w.heart.t,0,'once per fight');
  L=lab(ptsList(1,91,['ib_2_2','ib_1_1','ib_13_2']),{foes:1}); v=L.v; assert.equal(L.T.pts.ironblood,91); V.heal(v,1e7); const bank2=stack(L,'bank'); assert.ok(bank2>0); v.hp=v.maxHp*0.29; V.step(1); assert.ok(L.T.s.w.heart.t>0); v.shield=bank2*0.4; v.shieldT=99;
  secs(8.1); near(stack(L,'bank'),bank2*0.4,'AT 91 POINTS in Ironblood: what is left of the shield flows back into the bank'); assert.equal(v.shield,0);
});

/* ====================================================== PART 3: WHOLE FIGHTS ====================================================== */
const TEAM=['vael','sylthaine','vireo','vex','gruel'];
const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8'));
const campaign=(sn,node,seed)=>{ const r=NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.digest]); };
const everything=()=>{ const l=[]; for(const tr of T.trees('vael')) for(const t of tr.talents) l.push([t[0],t[4]]); return l.sort((a,b)=>a[0]<b[0]?-1:1); };
function build(hero,treeIdx,n,level){ let b={r:{}}; const tr=T.trees(hero)[treeIdx];
  for(let g=0;g<600&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }

test('determinism: the same talented snaps and seed give the identical fight twice, through a snap round-trip, and the snaps are never written to',()=>{
  for(const list of [everything(),T.learned('vael',build('vael',0,91,100)),T.learned('vael',build('vael',1,91,100)),T.learned('vael',build('vael',2,91,100))]){
    const sn=snaps(TEAM.map(k=>spec(k,100,k==='vael'?list:null))), keep=JSON.stringify(sn);
    for(const [node,seed] of [[34,11],[60,90210],[90,424242]]){ const a=campaign(sn,node,seed), b=campaign(sn,node,seed); assert.equal(a,b,'twice: node '+node+' seed '+seed);
      const rt=sn.map(s=>JSON.parse(JSON.stringify(NOW.sandbox.snapUnitResolved(NOW.sandbox.buildUnitFromSnapshot(JSON.parse(JSON.stringify(s)),'ally',0,0)))));
      assert.deepEqual(rt,JSON.parse(keep),'a unit rebuilt from the snap snapshots to the same snap: no fight state rides on it');
      assert.equal(campaign(rt,node,seed),a,'through the round-trip'); }
    assert.equal(JSON.stringify(sn),keep,'the snaps are untouched by the fights');
    const plain=snaps(TEAM.map(k=>spec(k,100)));
    const r1=NOW.auto(JSON.parse(keep),JSON.parse(keep),5), r2=NOW.auto(JSON.parse(keep),JSON.parse(keep),5); assert.equal(JSON.stringify(r1),JSON.stringify(r2),'talents on both sides (a mirror fight)');
    const r3=NOW.auto(JSON.parse(JSON.stringify(plain)),JSON.parse(keep),5), r4=NOW.auto(JSON.parse(JSON.stringify(plain)),JSON.parse(keep),5); assert.equal(JSON.stringify(r3),JSON.stringify(r4),'talents on the enemy side only');
  }
});

test('the mechanics act in a live fight (hooks sit in the real swing / cast / tick path), and only for the hero that learned them',()=>{
  const list=full(['ib_1_1','aw_2_2','rh_1_1','aw_1_1','ib_3_4','aw_4_4']);
  const sn=snaps(TEAM.map(k=>spec(k,100,k==='vael'?list:null)));
  const U=V.arena(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(snaps(TEAM.map(k=>spec(k,100))))),4), v=U[0]; assert.ok(v._tal); assert.ok(U.slice(1).every(u=>!u._tal),'nobody else has talent state');
  let temper=0,foot=0,quarry=false,oath=false,grudge=false;
  for(let i=0;i<1500&&!V.ended()&&v.alive;i++){ V.step(1); const s=v._tal.s; temper=Math.max(temper,s.k.temper?s.k.temper.n:0); foot=Math.max(foot,s.k.footing?s.k.footing.n:0); quarry=quarry||!!s.m.quarry; oath=oath||!!s.m.oath; grudge=grudge||!!s.m.grudge; }
  assert.ok(temper>=5,'Temper from his real basic attacks: '+temper); assert.ok(foot>=1,'Footing while he stands and fights: '+foot); assert.ok(quarry,'a Quarry was marked by his first real hit'); assert.ok(oath,'the Oath was sworn at the start'); assert.ok(grudge,'a Grudge was found from real hits taken');
  assert.ok(sn.every(s=>!('_tal' in s)));
});

test('a hook that throws is counted and answers as if there were no row: the fight goes on',()=>{
  const P=lab(null), base=lost(P.F[0],()=>V.hit(P.v,P.F[0],1000));
  const L=lab([['t',1]],{def:{talents:{t:[{on:'out',if:{fn:'boom'},more:1},{on:'hit',do:[{fn:'boom'}]},{on:'tick',do:[{fn:'boom'}]}]},fn:{boom(){ throw new Error('boom'); }}}}), {v,F}=L;
  FX.errorsReset(); near(lost(F[0],()=>V.hit(v,F[0],1000)),base,'the hit lands as a plain hit'); assert.equal(FX.errors().n,2,'out and hit each threw once'); assert.match(FX.errors().last,/boom/);
  V.step(3); assert.equal(FX.errors().n,5,'the tick hook, three times'); FX.errorsReset();
});

test('nothing learned, nothing runs: a team without talents fights the same fight whether or not the talent code is loaded with scripted rows',()=>{
  const sn=snaps(TEAM.map(k=>spec(k,60))), foe=snaps(TEAM.map(k=>spec(k,58)));
  const a=[campaign(sn,34,7),campaign(sn,60,8),JSON.stringify(NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),9))];
  FX.define('vael',{talents:{t:[{on:'in',chance:1,less:0.9},{on:'out',more:5},{on:'tick',do:[{heal:{pct:1,of:'maxHp'}}]}]}});      // absurd rows nobody has learned
  const b=[campaign(sn,34,7),campaign(sn,60,8),JSON.stringify(NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),9))];
  assert.deepEqual(a,b);
  const st=snaps(TEAM.map(k=>spec(k,60,k==='vael'?[['ib_1_3',5],['rh_n1',5]]:null)));                                            // only plain stat talents
  const U=V.arena(JSON.parse(JSON.stringify(st)),JSON.parse(JSON.stringify(foe)),3); V.step(60); assert.ok(U.every(u=>!('_tal' in u)&&!('_talW' in u)),'a hero with only stat talents runs no hook');
});
