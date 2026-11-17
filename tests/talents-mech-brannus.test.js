'use strict';
/* Brannus's talents as data on the mechanics layer (talents-mech/brannus.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Brannus, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). Bodies about 2 m: F0 is 0.5 m from him body to body.
   Lab units are HELD (stunned 1e6). free() lets one go (speed 0, level 1, so his controls land on it).
   Run: node --test tests/talents-mech-brannus.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='brannus', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
VMX('var __rbThrow=function(u){ u._castSlot="green"; u._castLv=(u.skillLv&&u.skillLv[1])||1; u._castSM=skillMul(u._castLv); try{ doEffect(u,"knockstun",Object.assign({},u.greenAb)); } finally{ u._castSM=1; u._castLv=0; u._castSlot=null; } };'+
    'var __rbOne=function(u,t,pierced){ u._castSlot="green"; u._castLv=(u.skillLv&&u.skillLv[1])||1; u._castSM=skillMul(u._castLv); try{ doEffect(u,"knockstun",Object.assign({},u.greenAb,{_arrived:true,_tgtU:t,_pierced:!!pierced})); } finally{ u._castSM=1; u._castLv=0; u._castSlot=null; } };'+
    'var __lwUlt=function(u){ u._castSlot="ult"; u._castLv=(u.skillLv&&u.skillLv[0])||1; u._castSM=skillMul(u._castLv); try{ doEffect(u,"charge",Object.assign({},ULT_DEF.charge,HERO_ULT_ART.brannus)); } finally{ u._castSM=1; u._castLv=0; u._castSlot=null; } };');
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const free=x=>{ x.stunned=0; x.silencedT=0; x.speed=0; x.level=1; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage: no armor in the way)
const press=L=>FX.cd(L.v,'green',8);                                               // the Rim Breaker press (the cd hook): a new throw
const throwRim=(L,noPress)=>{ if(!noPress) press(L); VMX('__rbThrow')(L.v); secs(1.0); };   // the real throw: the shot, every enemy on its line, the far one last
const one=(L,t,pierced)=>VMX('__rbOne')(L.v,t,pierced);                            // one strike of it, as it lands
/* a hit of his during one of his skills (casting rows) against the same hit with his talents off */
function skillRatio(L,t,skill,o){ L.T.s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))); } finally{ L.T.s.cur=null; } return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))); }
const outRatio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
const inRatio=(L,o)=>hitOn(L,L.v,1000,o)/plainHit(L,()=>hitOn(L,L.v,1000,o));
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ return V.cc(src,t,field,secs); } finally{ t.level=lv; } };   // a control that lands (no resist)
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const shieldUp=(L,x)=>{ L.v.shield=x; L.v.shieldT=99; };
const SM=lv=>VMX('skillMul')(lv);
const PMV=L=>1+0.22*(L.v.passMul||1);

test('Brannus: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  const M=FXN.mech(H); for(const id of ['cc_1_1','bw_1_1','lp_1_1','cc_13_2','bw_13_3','lp_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['cc_2_3','cc_7_3','cc_3_3','bw_9_2','bw_3_2','bw_1_2','lp_1_3','lp_8_3','lp_7_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Brannus: his real kit, as the talents read it - Rim Breaker strikes each enemy on its line then the far one, Arena Lock taunts every enemy, Pride\'s Momentum, the Rampage\'s path and slam',()=>{
  plain({foes:3},P=>{ const {v,F}=P; for(const f of F) free(f); at(P,F[1],9.5,0); const x1=F[1].x, h=F.map(f=>f.hp);
    VMX('__rbThrow')(v); secs(1.0); assert.ok(F[0].hp<h[0]&&F[1].hp<h[1],'the wheel strikes F0 on its line and F1, the farthest within 10 m'); assert.equal(F[2].hp,h[2],'not F2 at 15.5 m');
    assert.ok(F[0].stunned>1&&F[1].stunned>1,'and stuns both'); near(F[1].x-x1,1.6*V.METER,'the far one pushed 1.6 m (bodies of one side then keep their gap)',0.05);
    for(const f of F) free(f); one(P,F[2],false); near(F[2].stunned,VMX('ccDur')(3.5),'its stun: the table\'s 3.5 s cut by 30% = 2.45 s',1e-9);
    V.cast(v,'blue'); for(const f of F){ assert.equal(f.forcedTarget,v,'Arena Lock taunts every enemy on the field (no radius: F2 at 15.5 m too)'); near(f.forcedTargetT,3.5,'for 3.5 s (taunts are not cut)'); }
    near(v.drMul,1-VMX('SKLV.tauntDr')(10),'and puts the taunt damage reduction in his skill slot'); near(v.drT,3.5,'');
    assert.ok(v.pass&&v.pass.pridemomentum,'his passive is unlocked'); v.drT=0; v.drMul=1; v.dmgBuffT=0; v.dmgBuffMul=1; hitOn(P,v,10); near(v.dmgBuffMul,1,'Pride\'s Momentum: nothing without a shield');
    shieldUp(P,1e6); hitOn(P,v,10); near(v.dmgBuffMul,PMV(P),'hit while shielded: 22% x his passive\'s strength more damage'); near(v.dmgBuffT,4,'for 4 s'); });
  plain({foes:3},P=>{ const {v,F}=P; at(P,F[1],10,0); at(P,F[2],17,0); v.stunned=0; v.greenCd=v.blueCd=99; v.energy=0; const h=F.map(f=>f.hp);
    VMX('__lwUlt')(v); for(let i=0;i<60&&v._dash;i++) V.step(1); assert.ok(!v._dash,'he dashed'); const l=F.map((f,i)=>h[i]-f.hp);
    assert.ok(l[0]>0&&l[1]>0,'Lionwheel Rampage strikes the enemies on his way'); near(l[0]/l[2],0.5,'for half the slam (F0: struck on his way; his dash shoves F1 on into the slam)',1e-6); });
});

/* ============================== CHAMPION OF CASSADANE ============================== */
test('Brannus / Cheers: Play to the Crowd, Showman, Opening Bout, Crowd Belongs to Him',()=>{
  const L=lab(H,S(['cc_1_1','cc_2_1','cc_6_4','cc_12_1']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f);
  assert.equal(stack(L,'cheer'),4,'Opening Bout: the wave starts with 2 x 2 Cheers');
  V.hit(v,F[0],100,{crit:true}); assert.equal(stack(L,'cheer'),5,'a critical hit: 1 Cheer'); V.hit(v,F[0],100); assert.equal(stack(L,'cheer'),5,'not a plain hit');
  F[1].hp=1; V.hit(v,F[1],1000); assert.ok(!F[1].alive); assert.equal(stack(L,'cheer'),6,'a kill: 1 Cheer');
  V.cast(v,'green',F[2]); assert.equal(stack(L,'cheer'),7,'an enemy Rim Breaker stuns: 1 Cheer');
  V.step(1); const d1=v.dmg; setStack(L,'cheer',0); V.step(1); near(d1/v.dmg,1+0.012*7,'each Cheer 0.4% x 3 attack');
  setStack(L,'cheer',9); V.hit(v,F[0],100,{crit:true}); V.hit(v,F[0],100,{crit:true}); assert.equal(stack(L,'cheer'),10,'max 10');
  secs(10.9); assert.equal(stack(L,'cheer'),10,'Showman: they last 8 + 3 s after the last one'); secs(0.2); assert.equal(stack(L,'cheer'),0,'then fade');
  setStack(L,'cheer',7); V.wave(); assert.equal(stack(L,'cheer'),3,'between waves: Crowd Belongs to Him keeps 1 x 3'); V.step(1); assert.equal(stack(L,'cheer'),7,'and the next wave adds Opening Bout');
});

test('Brannus / Wins: Forty-One, Long Record, Pit Veteran, Record Book, Hall of Wins, Kill for the Crowd, Undefeated',()=>{
  const L=lab(H,S(['cc_1_2','cc_2_2','cc_4_2','cc_12_2','cc_8_2','cc_5_2','cc_11_2']),{foes:6,big:true,allies:1}), {v,F,A}=L; for(const f of F) free(f);
  const hp0=v.maxHp, d0=v.dmg; at(L,F[4],5.5,6); kill(L,F[4]); assert.equal(stack(L,'win'),1,'an enemy dies 4.1 m away body to body: Long Record 4 + 0.5 x 3 m reaches it');
  assert.equal(stack(L,'cheer'),2,'Kill for the Crowd: each Win adds 2 Cheers'); near(v.energy,1.25,'Undefeated: 0.25 x 5 ultimate energy');
  kill(L,F[1]); assert.equal(stack(L,'win'),1,'not one 6 m away'); A[0].hp=1; V.dmg(A[0],100); assert.equal(stack(L,'win'),1,'not an ally');
  V.step(1); near(v.maxHp/hp0,1.005,'each Win 0.1% x 5 max HP'); near(v.dmg/d0,1.005,'and attack');
  near(inRatio(L),1-0.0015,'Pit Veteran: 0.05% x 3 less damage per Win (1 Win)',1e-6);
  setStack(L,'win',19); near(inRatio(L),(1-0.0015*19),'19 Wins: no Record Book');
  setStack(L,'win',20); near(inRatio(L),(1-0.0015*20)*(1-0.05),'Record Book: at 20 Wins 1% x 5 less');
  near(outRatio(L,F[0]),1+0.05*2,'Hall of Wins: every 10 Wins 1% x 5 more damage');
  setStack(L,'win',41); at(L,F[3],0,6); kill(L,F[3]); assert.equal(stack(L,'win'),41,'max 41');
});

test('Brannus / Bated Breath: Quiet Terrace, Second Quiet, Steeled, Their Silence, Last Man Standing, Lion\'s Mane',()=>{
  const L=lab(H,S(['cc_1_4','cc_3_4','cc_12_4','cc_9_4','cc_5_4','cc_7_4','cc_12_3','cc_1_1']),{foes:2,big:true}), {v,F}=L; const m0=v.mrRating;
  setStack(L,'cheer',10); v.hp=v.maxHp*0.5; V.step(1); assert.ok(!win(L,'bb'),'not above 40%');
  v.hp=v.maxHp*0.39; V.step(1); assert.ok(win(L,'bb'),'he drops below 40% HP: Bated Breath'); near(v.hp/v.maxHp,0.39+0.10,'Steeled: he heals 2% x 5 as it begins',1e-6);
  V.step(1); near(v.mrRating/m0,1.12,'Lion\'s Mane: 4% x 3 magic resist'); near(inRatio(L),1-0.02*10,'each Cheer 0.4% x 5 less damage');
  near(L.T.s.w.bb.t,7-V.STEP,'Quiet Terrace: 5 + 0.4 x 5 s',0.01); L.T.s.k.cheer.t=0.3; secs(1.0); assert.equal(stack(L,'cheer'),10,'his Cheers stop fading');
  near(outRatio(L,F[0]),1.15,'Last Man Standing: 3% x 5 more damage');
  v.hp=v.maxHp*0.45; const h=v.hp, l=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})); near(v.hp-h,l*0.03,'Their Silence: his hits heal 1% x 3 of the damage',1e-6);
  L.T.s.w.bb.t=0.1; secs(0.2); assert.ok(!win(L,'bb'),'then it ends'); near(v.mrRating,m0,'Lion\'s Mane ends with it',1e-6);
  let n=1; for(let i=0;i<4;i++){ v.hp=v.maxHp*0.6; V.step(1); v.hp=v.maxHp*0.39; V.step(1); if(win(L,'bb')){ n++; L.T.s.w.bb.t=0; } }
  assert.equal(n,3,'Second Quiet: 1 + 2 times in a wave'); V.wave(); V.step(2); v.hp=v.maxHp*0.6; V.step(1); v.hp=v.maxHp*0.39; V.step(1); assert.ok(win(L,'bb'),'and again next wave');
});

test('Brannus / Champion stats on the hit: Crowd Favourite, Bronze Throw, Showmanship (the 5% crit cap), Bloodied Sand, Old Scars, Roar of the Terrace, Pit Fighter, Crowd Hunger, Proud Stance, Arena Champion',()=>{
  const L=lab(H,S(['cc_3_1','cc_4_3','cc_4_1','cc_6_2','cc_10_3','cc_8_1','cc_9_3','cc_10_1','cc_11_4','cc_10_2','cc_1_1']),{foes:2,big:true}), {v,F}=L;
  const c0=v.glyphCrit, l0=v.lifestealStat||0, a0=v.armorRating, i0=v.atkInterval;
  setStack(L,'cheer',10); V.step(1); near(v.glyphCrit-c0,0.05,'Showmanship: 0.1% x 5 per Cheer = 5% at 10'); near((v.lifestealStat||0)-l0,0.10,'Crowd Hunger: 0.2% x 5 lifesteal per Cheer');
  near(v.armorRating/a0,1.10,'Proud Stance: at 5+ Cheers 2% x 5 armor'); near(i0/v.atkInterval,1.10,'Roar of the Terrace: at 5+ Cheers 2% x 5 faster');
  near(outRatio(L,F[0],{crit:true}),1.20,'Crowd Favourite: at 10 Cheers critical hits 20% more'); setStack(L,'cheer',9); near(outRatio(L,F[0],{crit:true}),1,'not at 9');
  setStack(L,'cheer',4); V.step(1); near(v.armorRating,a0,'below 5 Cheers: no Proud Stance',1e-6); near(v.atkInterval,i0,'',1e-6);
  near(skillRatio(L,F[0],'knockstun'),1.12,'Bronze Throw: Rim Breaker 4% x 3'); near(skillRatio(L,F[0],'charge'),1.12,'Arena Champion: Lionwheel Rampage 4% x 3 (its slam)'); near(skillRatio(L,F[0],'chargePath'),1.12,'(and its path)');
  F[1].hp=F[1].maxHp*0.49; near(outRatio(L,F[1]),1.10,'Bloodied Sand: below 50% HP 2% x 5 more'); F[1].hp=F[1].maxHp*0.51; near(outRatio(L,F[1]),1,'');
  near(inRatio(L,{crit:true}),0.94,'Old Scars: 2% x 3 less from critical hits'); near(inRatio(L),1,'not from a normal hit');
  const ph=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'phys'}))/plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'phys'})));
  const dm=VMX('defMul'), base=dm(v,F[0],'phys'), sv=v._wpnArmIgn; v._wpnArmIgn=0.10; const ig=dm(v,F[0],'phys'); v._wpnArmIgn=sv; near(ph,ig/base,'Pit Fighter: his hits ignore 2% x 5 of the armor');
});

test('Brannus / Arena Lock: Spare Them (PICK ONE), Thumbs Up, Thunderous, Long Lock, Eyes on Me',()=>{
  const L=lab(H,S(['cc_5_3','cc_6_3','cc_6_1','lp_4_3','lp_n1']),{foes:3}), {v,F}=L; for(const f of F){ free(f); f.dmg=0; }
  V.cast(v,'blue'); near(v.drT,3.5+0.6,'Long Lock: the whole skill 0.2 x 3 s longer (its damage reduction too)');
  for(const f of F){ assert.equal(f.forcedTarget,v); near(f.forcedTargetT,3.5+0.6+0.6,'Thunderous: the taunt 0.2 x 3 s longer again'); assert.ok(mark(L,f,'locked')); }
  near(inRatio(L),0.90,'Eyes on Me: a taunted enemy deals 2% x 5 less'); v.hp=v.maxHp*0.4; const h=v.hp;
  secs(4.6); for(const f of F) assert.ok(!(f.stunned>0),'(not yet)'); secs(0.2);
  for(const f of F) assert.ok(f.stunned>0.35&&f.stunned<=0.5+1e-9,'Spare Them: when the taunt ends every enemy it taunted is stunned 0.5 s: '+f.stunned);
  near((v.hp-h)/v.maxHp,(0.02+0.03)*3,'and he heals 2% + Thumbs Up 1% x 3 for each',1e-6);
  near(inRatio(L),1,'the taunt is over: no Eyes on Me');
});

test('Brannus / Lionwheel Rampage: Victory Lap, Lionwheel Throw, Path of the Wheel, Spiked Wheel, Arena Champion',()=>{
  const ALL=['cc_7_1','bw_11_3','bw_8_3','bw_7_2','cc_10_2','cc_1_1','cc_1_2','bw_1_4'];
  { const L=lab(H,S(ALL),{foes:3}), {F}=L; free(F[2]); near(skillRatio(L,F[2],'chargePath'),1.20*1.15*1.12,'a hit on its path: Path of the Wheel 4% x 5, Spiked Wheel 3% x 5, Arena Champion 4% x 3');
    near(F[2].stunned,0.5,'Lionwheel Throw: every enemy it strikes is stunned 0.5 s (in full)',1e-9); assert.ok(mark(L,F[2],'rim'),'and Rimmed'); assert.equal(stack(L,'whirl'),1,'and gives 1 Whirl');
    near(skillRatio(L,F[2],'charge'),1.15*1.12,'its slam: Spiked Wheel and Arena Champion'); }
  const go=ids=>{ const L=lab(H,S(ids),{foes:3}), {v,F}=L; at(L,F[1],10,0); at(L,F[2],17,0); free(F[1]); v.stunned=0; v.greenCd=v.blueCd=99; v.energy=0; F[0].hp=1;
    const h1=F[1].hp; VMX('__lwUlt')(v); for(let i=0;i<60&&v._dash;i++) V.step(1); assert.ok(!v._dash,'(he dashed)'); assert.ok(F[1].hp<h1,'(F1 struck on his way)'); return L; };
  const e2=go(ALL.filter(x=>x!=='cc_7_1')).v.energy, L=go(ALL), {v,F}=L;
  assert.equal(L.T.s.cur,null,'(the Rampage is over: no skill of his resolving)'); assert.ok(!F[0].alive,'(its path killed F0)'); assert.equal(stack(L,'win'),1,'Victory Lap: a kill of the Rampage is a Win'); near(v.energy-e2,15,'and gives 15 ultimate energy',1e-6);
  { const c=stack(L,'cheer'); assert.ok(c>=3&&(c-1)%2===0,'each enemy its landing hits: 2 Cheers (and the kill 1): '+c); }
  for(const f of [F[1],F[2]]) assert.ok(mark(L,f,'rim'),'Lionwheel Throw: every enemy it strikes is Rimmed'); assert.ok(F[1].stunned>0.3,'and stunned: '+F[1].stunned);
  assert.equal(stack(L,'whirl'),3,'and 1 Whirl for each');
});

test('Brannus / Standing Ovation and The Forty-Second',()=>{
  let one0; plain({foes:3},P=>{ const {F}=P; free(F[1]); at(P,F[1],9.5,0); const h=F[0].hp; VMX('__rbThrow')(P.v); secs(1); one0=h-F[0].hp; });
  { const L=lab(H,S(['cc_11_1']),{foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[1],9.5,0); setStack(L,'cheer',10);
    press(L); assert.equal(stack(L,'cheer'),5,'Standing Ovation: at 10 Cheers the press spends 5'); const h=F[0].hp; VMX('__rbThrow')(v); secs(1);
    near((h-F[0].hp)/one0,2,'every enemy it strikes is struck a second time for the same damage',1e-6); assert.ok(F[1].stunned>VMX('ccDur')(3.5),'its stun 0.5 s longer (past the old 2.8 s ceiling): '+F[1].stunned);
    assert.equal(stack(L,'cheer'),7,'(its two stuns earn 2 Cheers)'); const h2=F[0].hp; throwRim(L); near((h2-F[0].hp)/one0,1,'the next throw (5 Cheers): once',1e-6); }
  const L=lab(H,S(['cc_9_2']),{foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[1],13,0); at(L,F[2],15.6,0);
  const h1=F[1].hp, h2=F[2].hp; F[0].hp=1; throwRim(L); assert.ok(!F[0].alive,'Rim Breaker killed F0');
  assert.ok(F[1].hp<h1,'The Forty-Second: the wheel flies on to the enemy within 6 m of the fallen one, farthest from him'); assert.equal(F[2].hp,h2,'not one beyond 6 m');
  near((h1-F[1].hp)/one0,1,'for the killing strike\'s damage',1e-6);
});

test('Brannus / He Stood Up Inside the Wheel (SIGNATURE): once per fight, 4 s at 1 HP, enemies within 5 m taunted, Cheers full, his hits heal 30%',()=>{
  const L=lab(H,S(['cc_13_2']),{foes:3}), {v,F}=L; for(const f of F) free(f);
  V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(v.alive,'he stands up'); near(v.hp,1,''); assert.equal(stack(L,'cheer'),10,'his Cheers fill to 10');
  assert.equal(F[0].forcedTarget,v,'an enemy within 5 m is taunted onto him'); assert.notEqual(F[2].forcedTarget,v,'not one 13 m away');
  const h=v.hp, l=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})); near(v.hp-h,l*0.30,'every hit he lands heals him 30% of the damage',1e-6);
  V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(v.alive,'he cannot drop below 1 HP');
  secs(4.1); V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(!v.alive,'after 4 s, and once per fight');
});

test('Brannus / controls on him: Unchained (up to 20%), Hard Sand, Arena Grit, Stiff Neck (the 50% silence cap), Iron Lungs',()=>{
  { const L=lab(H,S(['cc_5_1','cc_8_3']),{foes:2}), {v,F}=L; v.stunned=0; ccOn(F[0],v,'stunned',2); near(v.stunned,VMX('ccDur')(2)*0.8,'Unchained: every control 4% x 5 shorter');
    ccOn(F[0],v,'silencedT',2); near(v.silencedT,VMX('ccDur')(2)*0.8*0.7,'Hard Sand: silences 10% x 3 shorter as well'); }
  { const L=lab(H,S(['cc_5_1','cc_8_3','bw_8_2','lp_12_3']),{foes:2}), {v,F}=L; v.stunned=0; ccOn(F[0],v,'silencedT',2); near(v.silencedT,VMX('ccDur')(2)*0.5,'all of them: a silence at most 50% shorter (0.8 x 0.7 x 0.7 x 0.8 = 0.31 before the cap)'); }
  { const L=lab(H,S(['bw_12_2']),{foes:2}), {v}=L; v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*(1-0.24),'Iron Lungs: a slow on him 8% x 3 weaker'); V.step(1); near(v.slowMul,1-0.5*(1-0.24),'once, not every tick'); }
});

/* ============================== THE BRONZE WHEEL ============================== */
test('Brannus / Whirl: Whirl the Rim, Faster Spokes, Momentum Wheel, Spinning Guard, Ever Turning, Warm-Up Throw, Wheel Rhythm, Bronze Patience',()=>{
  const L=lab(H,S(['bw_1_4','bw_2_4','bw_4_4','bw_6_4','bw_10_4','bw_6_1','bw_8_4','bw_11_2']),{foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[1],9.5,0);
  const i0=v.atkInterval, d0=v.dmg; v.hp=v.maxHp*0.5; const h=v.hp;
  near(press(L),8-1.0,'Bronze Patience: 0.2 x 5 s off its cooldown (Warm-Up\'s 4 Whirl come after Wheel Rhythm looks)'); assert.equal(stack(L,'whirl'),4,'Warm-Up Throw: the first press of the wave adds 2 x 2 Whirl');
  VMX('__rbThrow')(v); secs(1); assert.equal(stack(L,'whirl'),6,'each enemy it passes through: 1 Whirl (max 6)'); near((v.hp-h)/v.maxHp,0.015*6,'Ever Turning: each Whirl gained heals 0.3% x 5',1e-6);
  near(i0/v.atkInterval,1.30,'Whirl the Rim: 1% x 5 attack speed each'); near(v.dmg/d0,1+0.015*6,'Momentum Wheel: 0.3% x 5 attack each'); near(inRatio(L),1-0.009*6,'Spinning Guard: 0.3% x 3 less damage each');
  near(press(L),8-1.0-1.0,'Wheel Rhythm: at 6 Whirl 0.2 x 5 s more off'); assert.equal(stack(L,'whirl'),6,'Warm-Up: once a wave');
  secs(12.0); assert.equal(stack(L,'whirl'),6,'Faster Spokes: 10 + 1 x 3 s after the last'); secs(1.1); assert.equal(stack(L,'whirl'),0,'then gone'); near(v.atkInterval,i0,'',1e-6); press(L); assert.equal(stack(L,'whirl'),0,'Warm-Up: once a wave');
});

test('Brannus / Rimmed: Rim Mark, Bronze Bite, Old Wheel Scars, Ringing Bronze, Wheelhand',()=>{
  const L=lab(H,S(['bw_1_1','bw_3_1','bw_5_1','bw_12_4','bw_7_1','bw_9_4']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); at(L,F[1],9.5,0); const i0=F[0].atkInterval;
  throwRim(L); assert.ok(mark(L,F[0],'rim')&&mark(L,F[1],'rim'),'every enemy Rim Breaker strikes is Rimmed'); assert.ok(!mark(L,F[2],'rim'));
  near(outRatio(L,F[0],{auto:true}),1.12,'Rimmed: his basic attacks on it 4% x 3 more'); near(outRatio(L,F[0]),1,'not a skill\'s hit');
  near(outRatio(L,F[0],{crit:true}),1.15,'Bronze Bite: critical hits on it 3% x 5 more'); near(outRatio(L,F[2],{crit:true}),1,'not on another');
  near(inRatio(L,{src:F[0]}),0.94,'Old Wheel Scars: a Rimmed enemy deals 2% x 3 less'); near(inRatio(L,{src:F[2]}),1,'');
  near(F[0].atkInterval,i0/(1-0.09),'Ringing Bronze: a Rimmed enemy attacks 3% x 3 slower');
  let n=0, m=0; for(let i=0;i<3000;i++){ F[0]._critHit=false; F[2]._critHit=false; V.hit(v,F[0],10,{kind:'true',crit:null}); V.hit(v,F[2],10,{kind:'true',crit:null}); if(F[0]._critHit) n++; if(F[2]._critHit) m++; }
  assert.ok(n>90&&n<210,'Wheelhand: 1% x 5 more critical chance on a Rimmed enemy ('+n+' of 3000)'); assert.equal(m,0,'none on another');
  secs(4+2.5-1.0-0.2); assert.ok(mark(L,F[0],'rim'),'Rim Mark: Rimmed lasts 4 + 0.5 x 5 s'); secs(0.6); assert.ok(!mark(L,F[0],'rim'),'then ends'); V.step(2); near(F[0].atkInterval,i0,'',1e-6);
});

test('Brannus / the throw: Long Throw, Through Them All (PICK ONE), Line of Spikes, Far Target, Throwing Arm, Turning Wheel, Heavier Rim, Bronze Reach, Dizzy Whirl',()=>{
  let hitPl=null; plain({foes:4},P=>{ const {v,F}=P; for(const f of F) free(f); at(P,F[1],9.5,0); at(P,F[2],12,0); const r=VMX('(x)=>x.r')(F[3])/V.METER; at(P,F[3],5,r+0.8); const h=F.map(f=>f.hp);
    VMX('__rbThrow')(v); secs(1); hitPl=Array.from(F,(f,i)=>h[i]-f.hp>0); });
  assert.deepEqual(hitPl,[true,true,false,false],'(plain: F0 on the line and F1 within 10 m; not F2 at 12 m, not F3 0.8 m beside the line)');
  const L=lab(H,S(['bw_2_3','bw_5_3','bw_6_3','bw_10_3','bw_2_2','bw_12_3','bw_4_2','bw_4_3','bw_11_4','bw_1_4']),{foes:4}), {v,F}=L; for(const f of F) free(f); at(L,F[1],9.5,0); at(L,F[2],12,0);
  const r=VMX('(x)=>x.r')(F[3])/V.METER; at(L,F[3],5,r+0.8); const h=F.map(f=>f.hp); throwRim(L);
  assert.ok(F[2].hp<h[2],'Long Throw: 10 + 0.5 x 5 m reaches F2 at 12 m (now the far target)'); assert.ok(F[3].hp<h[3],'Through Them All: an enemy within 1 m of its line'); { const x2=F[2].x; one(L,F[2],false); near(F[2].x-x2,(1.6+0.6)*V.METER,'Heavier Rim: pushed 1.6 + 0.2 x 3 m',1e-6); }
  for(const f of F) free(f); one(L,F[1],true); near(F[1].stunned,VMX('ccDur')(3.5),'a strike on the way: the stun as it is',1e-9); for(const f of F) free(f); one(L,F[1],false); near(F[1].stunned,VMX('ccDur')(3.5)+0.3,'Bronze Reach: on the far target 0.1 x 3 s longer',1e-9);
  L.T.s.thN=1; L.T.s.rbFar=false; setStack(L,'whirl',0); near(skillRatio(L,F[0],'knockstun'),1.12,'Throwing Arm 4% x 3 (the first enemy struck)');
  L.T.s.thN=2; setStack(L,'whirl',0); near(skillRatio(L,F[0],'knockstun'),1.12*1.15,'Line of Spikes: each enemy after the first 3% x 5 more'); L.T.s.rbFar=true; setStack(L,'whirl',0); near(skillRatio(L,F[0],'knockstun'),1.12*1.15*1.15,'Far Target: the far target 3% x 5 more');
  setStack(L,'whirl',4); near(skillRatio(L,F[0],'knockstun'),1.12*1.15*1.15*1.20,'Turning Wheel: 1% x 5 per Whirl'); L.T.s.thN=0; L.T.s.rbFar=false; setStack(L,'whirl',0);
  for(const f of F) free(f); one(L,F[0],true); secs(VMX('ccDur')(3.5)+0.15); assert.ok(F[0].slow>1.5,'Dizzy Whirl: when its stun ends, slowed for 2 s'); near(F[0].slowMul,0.80,'4% x 5');
});

test('Brannus / Pin the Last (PICK ONE) and Nailed: the far target is not pushed, then rooted 1 + 0.2 x 3 s',()=>{
  const L=lab(H,S(['bw_5_2','bw_6_2']),{foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[1],9.5,0); at(L,F[0],-6,0); const x1=F[1].x;
  throwRim(L); near(F[1].x,x1,'the far target is not pushed',1e-6); assert.ok(F[1].stunned>1,'(stunned)'); F[1].speed=100; F[0].speed=100;
  for(let i=0;i<200&&F[1].stunned>0;i++) V.step(1); assert.ok(!(F[1].stunned>0)); V.step(2); assert.ok(mark(L,F[1],'pinned'),'rooted as the stun ends'); near(F[1].speed,0,'it cannot move'); assert.ok(!mark(L,F[0],'pinned'),'(F0 was not struck)');
  secs(1.6-0.2); assert.ok(mark(L,F[1],'pinned'),'1 + 0.6 s'); secs(0.4); assert.ok(!mark(L,F[1],'pinned')); V.step(1); near(F[1].speed,100,'then it walks again');
  free(F[2]); one(L,F[2],true); for(let i=0;i<200&&F[2].stunned>0;i++) V.step(1); V.step(2); assert.ok(!mark(L,F[2],'pinned'),'a strike on the way: no root');
});

test('Brannus / Ring of Bronze, Rim Shock, Shock Whirl, Full Whirl',()=>{
  const L=lab(H,S(['bw_9_1','bw_10_1','bw_12_1','bw_3_4','bw_1_4']),{foes:3,allies:1,big:true}), {v,F,A}=L;
  setMk(L,F[0],'rim',99); V.cast(v,'blue'); near(F[0].silencedT,1,'Ring of Bronze: a Rimmed enemy it taunts is silenced 1 s',1e-9); assert.ok(!(F[1].silencedT>0),'not one that was not Rimmed');
  assert.ok(mark(L,F[1],'rim')&&mark(L,F[2],'rim'),'and every enemy it taunts is Rimmed'); V.step(1);
  v.hp=v.maxHp*0.5; const h=v.hp; ccOn(A[0],F[1],'stunned',1); near((v.hp-h)/v.maxHp,0.05,'Rim Shock: an ally stuns a Rimmed enemy: he heals 1% x 5',1e-6); assert.equal(stack(L,'whirl'),2,'Shock Whirl: 1 x 2 Whirl');
  ccOn(A[0],F[2],'stunned',1); near((v.hp-h)/v.maxHp,0.05,'at most once every 5 s',1e-6); secs(5.1); setMk(L,F[2],'rim',99); ccOn(A[0],F[2],'stunned',1); near((v.hp-h)/v.maxHp,0.10,'(again after 5 s)',1e-6);
  setStack(L,'whirl',6); F[1].x=F[0].x; F[1].y=F[0].y+4.6*V.METER; const l1=F[1].hp, l0=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',auto:true})); near(l1-F[1].hp,0.4*l0,'Full Whirl: at 6 Whirl a basic attack also strikes the nearest enemy within 3 m of the target for 40%',1e-6);
  setStack(L,'whirl',5); const l2=F[1].hp; V.hit(v,F[0],1000,{kind:'true',auto:true}); assert.equal(F[1].hp,l2,'not at 5');
});

test('Brannus / The Wheel Did Not Stop (SIGNATURE): at 6 Whirl Rim Breaker is ready at once; its next throw strikes twice, Rims, stuns 1.5 s longer; once every 20 s',()=>{
  const L=lab(H,S(['bw_13_3','bw_1_4']),{foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[1],9.5,0);
  setStack(L,'whirl',5); press(L); v.greenCd=8; const h=F[0].hp; VMX('__rbThrow')(v); secs(1); const one0=h-F[0].hp; near(v.greenCd,0,'6 Whirl: Rim Breaker is ready at once',1e-9);
  for(const f of F) free(f); const h2=F[0].hp; throwRim(L); near((h2-F[0].hp)/one0,2,'its next throw strikes every enemy twice',1e-6); assert.ok(mark(L,F[0],'rim')&&mark(L,F[1],'rim'),'and Rims them');
  assert.ok(F[0].stunned>VMX('ccDur')(3.5)+1.5-1.1,'its stun 1.5 s longer: '+F[0].stunned);
  setStack(L,'whirl',5); press(L); v.greenCd=8; throwRim(L,true); near(v.greenCd,8,'once every 20 s',1e-9);
  const h3=F[0].hp; for(const f of F) free(f); throwRim(L); near((h3-F[0].hp)/one0,1,'(the next throw strikes once)',1e-6);
});

/* ============================== LION'S PRIDE ============================== */
test('Brannus / Bronze Guard: Raised Rim, Burnished, Bronze Wall (up to 4 + 3), Shield of the Pit',()=>{
  { const L=lab(H,S(['lp_1_1','lp_2_1','lp_12_1','lp_3_1']),{foes:3}), {v,F}=L; for(const f of F){ free(f); f.dmg=0; }
    V.cast(v,'blue'); near(v.shield/v.maxHp,0.075*3*1.09,'Bronze Guard: 1.5% x 5 of his max HP for each enemy taunted (3), Burnished 3% x 3 stronger',1e-6); near(v.shieldT,4+3,'Raised Rim: 4 + 1 x 3 s');
    v.drT=0; hitOn(L,v,v.shield*2); assert.ok(!(v.shield>0)); for(const f of F) near(f.stunned,0.5,'Shield of the Pit: its break stuns every enemy it taunted 0.5 s',1e-9); }
  { const L=lab(H,S(['lp_1_1']),{foes:6}), {v}=L; V.cast(v,'blue'); near(v.shield/v.maxHp,0.075*4,'up to 4 enemies',1e-6); }
  { const L=lab(H,S(['lp_1_1','lp_10_2']),{foes:6}), {v}=L; V.cast(v,'blue'); near(v.shield/v.maxHp,0.075*6,'Bronze Wall: 4 + 1 x 3 (all six here)',1e-6); }
});

test('Brannus / Load: Loaded Swing, Heavier Load, Full Load, Heavy Load, Guarded Strike, Weight of the Rim',()=>{
  const L=lab(H,S(['lp_2_2','lp_4_2','lp_6_2','lp_12_2','lp_10_1','lp_9_2']),{foes:2,big:true}), {v,F}=L; v.drT=0;
  shieldUp(L,1e9); hitOn(L,v,100); near(stack(L,'load'),100,'a shield takes 100: Load 100'); L.T.s.k.load.n=0; shieldUp(L,30); hitOn(L,v,20); hitOn(L,v,100); near(stack(L,'load'),30+0.5*90,'only what the shield held (and Weight of the Rim on the rest)',1e-6); L.T.s.k.load.n=100; shieldUp(L,1e9); hitOn(L,v,1e7); near(stack(L,'load'),v.dmg*1.6,'Heavier Load: at most 100% + 20% x 3 of his attack',1e-6);
  assert.ok(L.T.st.load,''); v.shield=0; const n=stack(L,'load'); const l=lost(F[0],()=>V.hit(v,F[0],100,{kind:'true',auto:true}));
  near(l,(100+n*0.5)*1.10,'Loaded Swing: his next basic attack adds 10% x 5 of the Load; Full Load: 2% x 5 more while it was full',1e-6); near(stack(L,'load'),0,'and empties it');
  near(lost(F[0],()=>V.hit(v,F[0],100,{kind:'true',auto:true})),100,'the next one: nothing more',1e-6);
  v.hp=v.maxHp*0.5; const hl=lost(v,()=>V.hit(F[0],v,200,{kind:'true'})); near(stack(L,'load'),hl*0.5,'Weight of the Rim: unshielded, 10% x 5 of the damage he takes fills Load',1e-6);
  const n2=stack(L,'load'), h=v.hp; V.hit(v,F[0],100,{kind:'true',auto:true}); near(v.hp-h,n2*0.5*0.25,'Guarded Strike: the Load attack heals 5% x 5 of its extra damage',1e-6);
  L.T.s.k.load.n=1e-9; const ph=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'phys',auto:true}))/plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'phys',auto:true})));
  const dm=VMX('defMul'), b=dm(v,F[0],'phys'), sv=v._wpnArmIgn; v._wpnArmIgn=0.10; const ig=dm(v,F[0],'phys'); v._wpnArmIgn=sv; near(ph,ig/b,'Heavy Load: a Load attack ignores 2% x 5 of the armor',1e-6);
});

test('Brannus / Store It All (PICK ONE), Spread the Weight (PICK ONE), Broad Swing, Lock and Load',()=>{
  { const L=lab(H,S(['lp_2_2','lp_5_2']),{foes:2,big:true}), {v,F}=L; free(F[0]); L.T.s.k.load={n:300,t:0,idle:0}; V.hit(v,F[0],100,{kind:'true',auto:true}); near(stack(L,'load'),300,'Store It All: a basic attack does not spend Load');
    const l=lost(F[0],()=>V.cast(v,'green',F[0])); free(F[0]); L.T.s.k.load={n:0,t:0,idle:0}; const p=lost(F[0],()=>V.cast(v,'green',F[0]));
    near(l-p,300*0.5*2*VMX('defMul')(v,F[0],'phys'),'Rim Breaker spends it at double value',1e-6); press(L); L.T.s.k.load={n:300,t:0,idle:0}; free(F[0]); V.cast(v,'green',F[0]); near(stack(L,'load'),0,'a new throw spends it');
    L.T.s.k.load={n:300,t:0,idle:0}; free(F[0]); V.cast(v,'green',F[0]); near(stack(L,'load'),300,'once a throw (the first enemy it strikes)'); }
  { const L=lab(H,S(['lp_2_2','lp_5_3','lp_6_3']),{foes:4,big:true}), {v,F}=L; at(L,F[1],4.5,6.5); at(L,F[3],4.5,-7.5); L.T.s.k.load={n:400,t:0,idle:0};
    const h1=F[1].hp, h3=F[3].hp; V.hit(v,F[0],100,{kind:'true',auto:true}); near(h1-F[1].hp,400*0.5,'Spread the Weight: its extra damage on an enemy within 2 + 0.3 x 3 m of the target',1e-6); assert.equal(F[3].hp,h3,'not farther'); }
  { const L=lab(H,S(['lp_2_2','lp_11_2']),{foes:3,big:true}), {v,F}=L; V.cast(v,'blue'); v.drT=0; v.drMul=1; shieldUp(L,1e9);
    hitOn(L,v,50); near(stack(L,'load'),100,'Lock and Load: a taunted enemy\'s hit fills Load at double'); secs(3.6); v.shield=0; L.T.s.k.load.n=100;
    const h2=F[2].hp; V.hit(v,F[0],100,{kind:'true',auto:true}); near(h2-F[2].hp,100*0.5,'when the taunt ends, his next Load attack also strikes every enemy it taunted',1e-6);
    L.T.s.k.load.n=100; const h3=F[2].hp; V.hit(v,F[0],100,{kind:'true',auto:true}); assert.equal(F[2].hp,h3,'once'); }
});

test('Brannus / Wounded Pride: Prideful Start, Proud Anger (the 5% crit cap), Hurt Pride, Stubborn Pride, Never Humbled',()=>{
  const L=lab(H,S(['lp_1_4','lp_6_4','lp_3_4','lp_10_4','lp_7_4','lp_9_4']),{foes:2,big:true}), {v,F}=L; v.drT=0; const d0=v.dmg, c0=v.glyphCrit;
  assert.equal(stack(L,'wp'),2,'Prideful Start: 1 x 2 at the wave\'s start'); shieldUp(L,10); hitOn(L,v,100); assert.equal(stack(L,'wp'),3,'a shield on him breaks: 1 Wounded Pride');
  shieldUp(L,1e6); hitOn(L,v,100); assert.equal(stack(L,'wp'),3,'a hit it holds is not a break'); v.shieldT=0.01; V.step(2); assert.ok(!(v.shield>0)); assert.equal(stack(L,'wp'),3,'nor a shield running out of time');
  setStack(L,'wp',5); shieldUp(L,10); hitOn(L,v,100); assert.equal(stack(L,'wp'),5,'max 5'); V.step(1);
  near(v.dmg/d0,1.15/(1+0.03*2),'1% x 3 attack each'); near(v.glyphCrit-c0,0.03,'Proud Anger: 0.2% x 5 critical chance each (5% at 5, 2% at 2)'); near(inRatio(L),1-0.025*5,'Hurt Pride: 0.5% x 5 less damage each');
  v.hp=v.maxHp*0.6; const h=v.hp; v.shield=0; V.step(1); v.shield=1000; v.shieldT=9; V.step(1); near((v.hp-h)/v.maxHp,0.05,'Stubborn Pride: at 5 he heals 1% x 5 each time he is shielded',1e-6);
  v.shield+=1000; V.step(1); near((v.hp-h)/v.maxHp,0.05,'at most once every 5 s',1e-6); secs(5.1); v.shield+=1000; V.step(1); near((v.hp-h)/v.maxHp,0.10,'',1e-6);
  v.shield=0; V.step(1); v.hp=v.maxHp*0.29; V.step(1); near(v.shield/v.maxHp,0.20,'Never Humbled: below 30% with 5 Wounded Pride, a shield of 20% of his max HP',1e-6); near(v.shieldT,6,'for 6 s',0.05);
  v.shield=0; v.hp=v.maxHp*0.6; V.step(1); v.hp=v.maxHp*0.29; V.step(1); near(v.shield,0,'once a wave'); V.wave(); V.step(1); assert.equal(stack(L,'wp'),2,'Wounded Pride is this wave\'s');
});

test('Brannus / his shield: Heavy Paw, Mane of Bronze, Guarded Blows, Gladiator Armor, Roar for the Shield (LINK), Spiked Shield, Bronze Plate, King of the Sand, Given Strength',()=>{
  const L=lab(H,S(['lp_2_3','lp_6_1','lp_8_1','lp_3_3','lp_n2','lp_7_1','lp_4_1','lp_12_4','lp_11_1','cc_1_1']),{foes:2,big:true}), {v,F}=L; v.drT=0; const i0=v.atkInterval, a0=v.armorRating;
  v.shield=1000; v.shieldT=99; V.step(1); near(v.shield,1000*1.10,'Bronze Plate: a new shield on him 2% x 5 stronger',1e-6); near(i0/v.atkInterval,1.14,'Heavy Paw: shielded, 3% x 3 faster; Given Strength: a shield not from his own talents, 1% x 5 for 4 s');
  near(inRatio(L),0.97,'Mane of Bronze: shielded, 1% x 3 less damage'); v.shield=1e6; near(outRatio(L,F[0],{auto:true}),1.15,'Guarded Blows: shielded, basic attacks 3% x 5 more'); near(outRatio(L,F[0]),1,'');
  v.hp=v.maxHp*0.4; v.shield=1000; V.step(1); v.shield=1000; V.step(1); near(v.shield,1000+1000*0.10*0+0,'(an unchanged shield is not a new one)',1e-6); v.shield=2000; V.step(1); near(v.shield,2000+1000*(0.10+0.09),'King of the Sand: below 50% HP, 3% x 3 stronger again',1e-6);
  secs(4.1); near(i0/v.atkInterval,1.09,'Given Strength (1% x 5) ends after 4 s'); L.T.s.ownW=true; v.shield+=1000; V.step(1); assert.ok(!win(L,'gs'),'not for a shield of his own talents'); v.hp=v.maxHp*0.8;
  { shieldUp(L,1e6); const f=F[0].hp; hitOn(L,v,100); assert.equal(F[0].hp,f,'Spiked Shield: a hit the shield holds: nothing'); v.shield=1000; v.shieldT=99; V.step(1); }
  const sh=v.shield, f0=F[0].hp, c0=stack(L,'cheer'); hitOn(L,v,sh+100); near(f0-F[0].hp,0.60*v.dmg*((v.dmgBuffT>0)?v.dmgBuffMul:1)*VMX('rageMul'),'Spiked Shield: the enemy that breaks it takes 20% x 3 of his attack',1e-6);
  assert.equal(stack(L,'cheer')-c0,2,'Roar for the Shield, with Play to the Crowd: a break earns 2 Cheers'); V.step(1); near(v.armorRating/a0,1.20,'Gladiator Armor: 4% x 5 armor for 4 s after it breaks');
  near(inRatio(L),0.95,'Roar for the Shield: 5% less damage for 2 s'); secs(2.1); near(inRatio(L),1,''); secs(2.0); near(v.armorRating,a0,'',1e-6);
  near(outRatio(L,F[0],{auto:true}),1,'unshielded: no Guarded Blows');
  v.shield=0; V.step(1); v.hp=v.maxHp*0.8; v.shield=1000; v.shieldT=99; hitOn(L,v,400); const ab=1000-v.shield; V.step(1); near(v.shield,1000-ab+1000*0.10,'a shield given and worn down in one tick: the whole new shield is made stronger',1e-6);
});

test('Brannus / Pride\'s Momentum: Pride Goes First, Proud Lion; the Load attack link (Roar for the Shield)',()=>{
  const L=lab(H,S(['lp_5_4','lp_7_2','lp_2_2','lp_n2','cc_1_1']),{foes:2,big:true}), {v,F}=L; v.drT=0; v.dmgBuffT=0; v.dmgBuffMul=1;
  shieldUp(L,1e9); hitOn(L,v,10); near(v.dmgBuffMul,PMV(L)+0.05,'Pride Goes First: its bonus 1% x 5 larger'); near(v.dmgBuffT,7,'Proud Lion: 4 + 3 s');
  secs(5); v.shield=0; const c0=stack(L,'cheer'); V.hit(v,F[0],100,{kind:'true',auto:true}); near(v.dmgBuffT,7,'a Load attack refreshes it',0.05); assert.equal(stack(L,'cheer'),c0+1,'and earns 1 Cheer (the link)');
  secs(7.1); assert.ok(!(v.dmgBuffT>0)); L.T.s.k.load={n:50,t:0,idle:0}; V.hit(v,F[0],100,{kind:'true',auto:true}); assert.ok(!(v.dmgBuffT>0),'it refreshes a running bonus, it does not start one');
});

test('Brannus / The Crowd Was His (SIGNATURE): a full Load strikes every enemy within 3 m for the whole Load, stuns 1 s, a shield of twice the Load; once every 15 s',()=>{
  const L=lab(H,S(['lp_13_2','lp_2_2']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); at(L,F[1],0,4.4); const n=v.dmg; L.T.s.k.load={n,t:0,idle:0}; v.drT=0;
  const h1=F[1].hp, h2=F[2].hp; V.hit(v,F[0],100,{kind:'true',auto:true}); near(h1-F[1].hp,n*VMX('defMul')(v,F[1],'phys'),'an enemy within 3 m takes the whole Load',1e-6); assert.equal(F[2].hp,h2,'not one far away');
  near(F[1].stunned,1,'stunned 1 s',1e-9); near(F[0].stunned,1,'',1e-9); near(v.shield,2*n,'a shield worth twice the Load',1e-6);
  free(F[1]); L.T.s.k.load={n:v.dmg,t:0,idle:0}; V.hit(v,F[0],100,{kind:'true',auto:true}); near(F[1].stunned,0,'once every 15 s'); secs(15.1); for(const f of F) free(f); L.T.s.k.load={n:v.dmg,t:0,idle:0}; V.hit(v,F[0],100,{kind:'true',auto:true}); near(F[1].stunned,1,'',1e-9);
  free(F[1]); L.T.s.k.load={n:v.dmg*0.9,t:0,idle:0}; secs(15.1); V.hit(v,F[0],100,{kind:'true',auto:true}); near(F[1].stunned,0,'not a Load that was not full');
});

test('Brannus / Behind the Rim: 1.5% x 5 less from enemies more than 4 m away',()=>{
  const L=lab(H,S(['bw_n1']),{foes:3}), {v,F}=L; near(inRatio(L,{src:F[2]}),1-0.075,'13.5 m away'); near(inRatio(L,{src:F[0]}),1,'0.5 m away');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Brannus: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['cc_1_1','cc_1_2','cc_1_4','bw_1_1','bw_1_4','lp_1_1','lp_2_2','lp_1_4','bw_11_3']), TEAM=['vael','sylthaine','vireo','vex','brannus'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let rim=false, lockN=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); if(T0.lockL) lockN=Math.max(lockN,T0.lockL.length);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(o&&o.rim&&o.rim.until>V.now()) rim=true; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', Rimmed '+rim+', taunted by Arena Lock '+lockN);
  assert.ok(mx.cheer>=1,'real crits / kills / stuns gave Cheers'); assert.ok(mx.whirl>=1,'a real throw gave Whirl'); assert.ok(rim,'a real Rimmed enemy'); assert.ok(lockN>=2,'Arena Lock taunted real enemies: '+lockN);
  assert.ok(mx.load>0,'Bronze Guard\'s shield took real hits: Load'); assert.ok(mx.wp>=1,'a real shield broke: Wounded Pride');
  determinism(H,TEAM);
});

/* The page sites his talents added (the absorb hook in damage(), the charge's slam and path hits, Rim Breaker's reach and the slack beside its line):
   with nothing learned, whole seeded fights with Brannus in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Brannus: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['brannus','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __brN={throws:0,path:0,slam:0,absorb:0,brk:0}; var __brD=_doEffectCore, __brG=damage, __brH=dealDamage;'+
    'damage=function(u,a){ if(u&&u.key==="brannus"&&(u.shield||0)>0&&a>0){ __brN.absorb++; if(a>=u.shield) __brN.brk++; } return __brG.apply(this,arguments); };'+
    'dealDamage=function(s,t,a,c){ if(s&&s.key==="brannus"&&c==="#ffcf40"){ if(s._dash) __brN.path++; else __brN.slam++; } return __brH.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="brannus"&&type==="knockstun"&&o&&o.pierce&&!o._arrived) __brN.throws++; return __brD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__brN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.throws>0&&c.path+c.slam>0&&c.absorb>0,'the fights threw Rim Breaker ('+c.throws+'), ran the Rampage ('+c.path+' path / '+c.slam+' slam hits) and hit him while he held a shield ('+c.absorb+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__brD; damage=__brG; dealDamage=__brH;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ cc:['cc_1_4','cc_4_2','cc_12_2','cc_10_3','cc_3_3','cc_11_4','cc_12_3','cc_1_1','cc_1_2','cc_13_2','cc_5_1'],
            bw:['bw_n1','bw_6_4','bw_12_4','bw_9_2','bw_1_4','bw_1_1'],
            lp:['lp_n2','lp_n1','lp_6_1','lp_10_4','lp_11_3','lp_1_3','lp_8_3','lp_1_4','lp_1_1','lp_4_3','lp_3_3','lp_6_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={cc:0,bw:1,lp:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (Arena Lock's own reduction at skill level 100 in his skill slot; the attacker
   Rimmed, taunted by Arena Lock and more than 4 m away; Bated Breath with 10 Cheers; 41 Wins; 6 Whirl; 5 Wounded Pride; shielded, 2 s after a break),
   as a normal hit and as a critical one. Measured through the engine: what reaches his HP and shield against the hit */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:3,cold:true}), {v,F}=L; V.step(1); const f=F[2], now=V.now();
  if(L.T){ const M=x=>(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={}); M(f).rim={t0:now,until:1e9,v:0}; M(f).locked={t0:now,until:1e9,v:0};
    L.T.s.w.bb={t:99,n:1,cdT:0,at:-1,wave:false}; L.T.s.w.roar={t:99,n:1,cdT:0,at:-1,wave:false}; L.T.s.w.gla={t:99,n:1,cdT:0,at:-1,wave:false};
    setStack(L,'cheer',10); setStack(L,'win',41); setStack(L,'whirl',6); setStack(L,'wp',5); }
  v.shield=1e12; v.shieldT=999; V.step(1); v.maxHp=1e5; v.hp=3.5e4; v.shield=1e12; v.shieldT=999; v.drMul=1-VMX('SKLV.tauntDr')(100); v.drT=99;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Brannus: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[[['lp','cc'],[61,30]],[['cc','lp'],[61,30]],[['lp'],[91]],[['cc'],[91]],[['bw'],[91]],[['lp','bw'],[61,30]],[['cc','bw'],[61,30]],[['bw','lp'],[61,30]],[['bw','cc'],[61,30]],[['lp','cc','bw'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="brannus"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="brannus"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','brannus'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.ok(d.imm<d.ticks/2,'and he is not immune for half the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
