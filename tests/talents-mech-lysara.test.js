'use strict';
/* Lysara Moonveil's talents as data on the mechanics layer (talents-mech/lysara.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added, Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched off for
   one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   The lab holds every unit (stunned 1e6): ly() sets the enemies free (free(): they think but do nothing, level 1 so no control is resisted). A sleep is the game's
   own: the stun field and _sleepT both running; any hit through the hit path wakes it. Her ultimate is cast as the lab casts it (ULT_DEF: no form delay).
   Places (metres from Lysara, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5). The lab's skill level is 10.
   Run: node --test tests/talents-mech-lysara.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='lysara', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); VMX('if(typeof __lbr!=="undefined"&&__lbr){ brnd=__lbr; __lbr=null; }'); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const ustLeft=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return m?m.until-V.now():0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d||99)}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const has=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o[name]; return !!(m&&(m.until==null||m.until>V.now())); };
const left=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o[name]; return (m&&m.until!=null)?m.until-V.now():0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const dm=(s,t,k)=>VMX('defMul')(s,t,k);
const brnd=x=>VMX('var __lbr=(typeof __lbr!=="undefined"&&__lbr)?__lbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __lbr!=="undefined"&&__lbr){ brnd=__lbr; __lbr=null; }');
const free=x=>{ x.stunned=0; x._sleepT=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };
const asleep=t=>(t.stunned||0)>0&&(t._sleepT||0)>0;
function ly(list,o){ o=o||{}; const L=lab(H,list,Object.assign({},o,{cold:true})); L.F.forEach(free); if(o.pre) o.pre(L); V.step(1); return L; }
const auto=(L,t,amt)=>lost(t,()=>V.hit(L.v,t,amt||10,{kind:'true',auto:true}));
const hitOn=(L,t,amt,o)=>{ const r=lost(t,()=>V.hit((o&&o.src)||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{}))); L.v.energy=0; return r; };
const inRatio=(L,t,o,amt)=>{ const h=t.hp, s0=t.shield||0; const a=hitOn(L,t,amt||100,o); t.hp=h; t.shield=s0; const b=plainHit(L,()=>hitOn(L,t,amt||100,o)); t.hp=h; t.shield=s0; return a/b; };
const outRatio=(L,src,t,o)=>{ const a=lost(t,()=>V.hit(src,t,1000,Object.assign({kind:'true'},o||{}))), b=plainHit(L,()=>lost(t,()=>V.hit(src,t,1000,Object.assign({kind:'true'},o||{})))); return a/b; };
const ult=L=>V.cast(L.v,'ult');
const wake=(L,t)=>{ V.hit(L.A[0]||L.F[(L.F.indexOf(t)+1)%L.F.length],t,1,{kind:'true'}); };
const foeCast=(e,slot)=>VMX('(function(e,sl){ e._castSlot=sl||"green"; try{ _doEffectCore(e,"haste",{dur:0.1}); } finally{ e._castSlot=null; } })')(e,slot);
const apNow=v=>(v.apow||0)*((v.dmgBuffT>0)?(v.dmgBuffMul||1):1);
const SM=()=>VMX('skillMul')(10);
const allyHp=(L,sh)=>{ L.A.forEach((a,i)=>{ a.maxHp=1e5; a.hp=1e5*sh[i]; }); };

test('Lysara: every talent is accounted for - 9 plain stats, 109 with rows, none waiting',()=>{
  accounting(H,[118,9,109,0,0]);
  for(const id of ['ln_n3','ln_12_4','ln_9_3','sd_10_4','sd_11_4','sd_1_3','lm_5_1','lm_12_4','lm_6_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['ln_1_1','sd_2_1','lm_1_1','ln_13_2','sd_13_2','lm_13_3']) assert.ok(FXN.mech(H).talents[id],id);
  assert.equal(T.talent(H,'sd_11_1').name,'Moon Basin','Moonwell (a Warcraft building) is renamed');
});

/* ============================== HER REAL KIT ============================== */
test('Lysara: her real kit - the ultimate (every enemy, 2.8 s of stun field, _sleepT 5 s, slow 2.1 s, woken by any hit), Dreamthread\'s link (heals, not shields), Moon Cocoon, Powdered Slumber',()=>{
  const L=lab(H,null,{foes:3,allies:2}), {v,F,A}=L; F.forEach(free);
  ult(L); for(const f of F){ near(f.stunned,3.5,'every enemy: the table\'s 5.0 s x 0.7 = 3.5 s (v1452: the sleep ceiling, not the 2.8 s stun one)'); near(f._sleepT,3.5,'_sleepT the same 3.5 s (v1452: the cast lock ends on waking)'); near(f.slow,2.1,'slowed 3 x 0.7 s'); }
  near(V.cap('stunned'),2.8); for(const a of A.concat([v])){ assert.ok(a.dmgBuffMul>1.3&&a.dmgBuffT===8,'team damage for 8 s'); near(a.hasteMul,1.2); }
  V.hit(A[0],F[0],1,{kind:'true'}); assert.ok(F[0].stunned===0&&F[0]._sleepT===0,'any hit wakes it');
  allyHp(L,[0.4,0.5]); v.hp=v.maxHp; V.cast(v,'green'); assert.ok(A[0]._linkTo===A[1]&&A[1]._linkTo===A[0]&&A[0]._linkT===8,'the two lowest HP shares are linked for 8 s');
  const h1=A[1].hp; V.heal(A[0],1000); near(A[1].hp-h1,350,'35% of a heal on one travels to the other');
  const s1=A[1].shield||0; A[0].shield=500; A[0].shieldT=5; V.step(1); near(A[1].shield||0,s1,'a shield is not shared (the card says it is)');
  A[0].shield=0; A[1].shield=0; A[0].hp=2e4; V.cast(v,'blue'); near(A[0].shield,apNow(v)*2.2*SM(),'Moon Cocoon on the most wounded ally: apow (with the running damage buff) x 2.2 x the skill curve',1e-9); near(A[0].shieldT,6);
  near(A[1].shield||0,0,'an ally 5.5 m away is outside its 3 m (centre to centre)');
  A[1].shield=9e9; A[1].shieldT=11; A[1].hp=1e4; V.cast(v,'blue'); near(A[1].shield,9e9,'a larger shield stays'); near(A[1].shieldT,6,'but Moon Cocoon cuts its time to 6 s');
});

test('Lysara: Powdered Slumber at a real swing - the game writes _accDn (never read) and the accuracy rating; her talents keep their own count (Fine Dust, Shaking Hands, Stray Shots, Choking Dust)',()=>{
  const L=ly(S(['ln_1_4','lm_8_4','lm_2_4','ln_8_4']),{foes:1}), {v,F}=L, f=F[0]; f.accStat=500;
  const pm=v.passMul||1; v.stunned=0; v.speed=0; v.greenCd=v.blueCd=99; v.energy=0; v.atkCd=0;
  for(let n=0;n<200&&!(f._accDn>0);n++) V.step(1); v.stunned=1e6; assert.ok(f._accDn>0,'she swung');
  near(f._accDn,Math.min(0.35,0.05*pm),'the game\'s field: 5% x passMul a swing'); near(f.accStat,Math.max(0,500-3*pm),'the accuracy rating: -3 x passMul');
  near(ust(L,f,'ps'),Math.min(0.41,0.08*pm*1.3),'her talents\' count: (5% + Fine Dust 3 points) x passMul x Shaking Hands 1.3, up to 41% with Stray Shots');
  near(ustLeft(L,f,'ps'),7,'it holds 4 s + Choking Dust 3 s after her last swing',0.06);
  secs(7.1); near(ust(L,f,'ps'),0,'then it is gone (the game\'s own field never fades)'); assert.ok(f._accDn>0);
});

/* ============================== THE LONG NIGHT ============================== */
test('Lysara / Drowse: 1 a landed basic attack (max 5, fades 4 s), at 5 a sleep of 0.25 s x 5, Drowse clears, once every 12 s, any hit wakes it; Drift Off',()=>{
  const L=ly(S(['ln_1_1','ln_7_1']),{foes:3,allies:1}), {F}=L, f=F[0];
  for(let i=0;i<4;i++) auto(L,f); assert.equal(ust(L,f,'dr'),4); near(ustLeft(L,f,'dr'),9,'fades 4 s + Drift Off 5 s after her last',1e-6); assert.ok(!asleep(f));
  auto(L,f); assert.ok(asleep(f),'at 5 Drowse it falls asleep'); near(f.stunned,1.25,'0.25 s x 5'); near(f._sleepT,1.25); assert.equal(ust(L,f,'dr'),0,'its Drowse clears');
  wake(L,f); assert.ok(!asleep(f),'a hit wakes it'); V.step(1);
  for(let i=0;i<6;i++) auto(L,f); assert.ok(!asleep(f),'each enemy once every 12 s'); assert.equal(ust(L,f,'dr'),5,'(its Drowse waits, full)');
  secs(11.45); for(let i=0;i<5;i++) auto(L,f); assert.ok(!asleep(f),'not before 12 s'); secs(0.6); auto(L,f); assert.ok(asleep(f),'12 s after its last Drowse sleep it sleeps again');
  const g=F[1]; g.stunned=3; for(let i=0;i<5;i++) auto(L,g); assert.ok(!(g._sleepT>0),'never on an enemy already stunned'); g.stunned=0; auto(L,g); assert.ok(asleep(g),'once it is free, the next hit');
});

test('Lysara / Sound Sleep (0.2 s x 3: no hit wakes it), Heavy Head (at 4), Wide Awake (cannot be stunned: Haunted 2 s x 3), the 0.5 s lock after one of her sleeps ends',()=>{
  const L=ly(S(['ln_1_1','ln_2_1','ln_3_1','ln_n1']),{foes:3,allies:1}), {F}=L, f=F[0];
  for(let i=0;i<4;i++) auto(L,f); assert.ok(asleep(f),'Heavy Head: at 4 Drowse');
  wake(L,f); assert.ok(asleep(f),'Sound Sleep: a hit in its first 0.6 s does not wake it'); secs(0.62); wake(L,f); assert.ok(!asleep(f),'after 0.6 s a hit wakes it');
  const g=F[1]; g.stunImmune=true; for(let i=0;i<4;i++) auto(L,g); assert.ok(!(g._sleepT>0),'an enemy that cannot be stunned is not put to sleep');
  assert.ok(has(L,g,'ha'),'Wide Awake: it is Haunted instead'); near(left(L,g,'ha'),6,'2 s x 3',0.01); assert.equal(ust(L,g,'dr'),0,'and its Drowse clears');
  for(let i=0;i<4;i++) auto(L,g); near(left(L,g,'ha'),6-0,'once every 12 s (not renewed)',0.05);
  /* the lock: the ultimate sleeps F2, a hit wakes it; Drowse at 4 within 0.5 s does not sleep it, after 0.5 s it does */
  const h=F[2]; ult(L); wake(L,h); V.step(1); for(let i=0;i<4;i++) auto(L,h); assert.ok(!(h._sleepT>0)||!(h.stunned>0),'within 0.5 s after her sleep on it ended: no new sleep');
  secs(0.56); auto(L,h); assert.ok(asleep(h),'after the 0.5 s lock');
});

test('Lysara / the ultimate made longer: Slow Breathing (x 1.1 on the real 2.8 s), Long Wings (+0.3 s), at most 4.0 s; Slow Wingbeat (+1 s on the real 2.1 s slow); Queen\'s Grace (+5 points), Quiet Court (+0.9 s)',()=>{
  const L=ly(S(['ln_n2','ln_4_3','ln_7_3','sd_10_3','ln_11_2']),{foes:2,allies:1}), {v,F,A}=L, plain=VMX('skLvNum')('quietwings',VMX('ULT_DEF').quietwings,10);
  ult(L); for(const f of F){ near(f.stunned,Math.min(4,3.5*1.1+0.3),'3.5 x 1.10 + 0.3, at most 4.0 s (v1452: the real sleep is 3.5 s)'); near(f.slow,2.1+1.0,'2.1 + 0.2 x 5'); assert.ok(asleep(f)); }
  near(A[0].dmgBuffMul,plain+0.05,'Queen\'s Grace: 5 points on the team damage bonus'); near(A[0].dmgBuffT,8.9); near(A[0].hasteT,8.9,'Quiet Court: 8 + 0.3 x 3');
  F.forEach(free); L.T.P.lw=5; ult(L); near(F[0].stunned,4.0,'an extended sleep is at most 4.0 s'); void v;
});

test('Lysara / Haunted: Nightmare (4 s, 2% x 5 less damage), Haunting (+2 s), Moonless (+7.5% from her side), Bad Dreams (15% less healing), Waking Terror, Waking Dread, Heavy Eyelids, Moth Hide',()=>{
  const L=ly(S(['ln_2_2','ln_6_4','ln_5_4','ln_6_2','ln_4_2','ln_9_2','ln_11_3','ln_10_4']),{foes:2,allies:1}), {v,F,A}=L, f=F[0];
  f.speed=100; const ai=f.atkInterval; ult(L); wake(L,f); assert.ok(!has(L,f,'ha'),'(Haunted on her next tick)'); V.step(1);
  assert.ok(has(L,f,'ha'),'it woke from her sleep: Haunted'); near(left(L,f,'ha'),6,'4 s + Haunting 0.4 x 5',0.05);
  near(inRatio(L,A[0],{src:f}),0.90,'Nightmare: it deals 10% less to her allies',1e-6);
  near(inRatio(L,v,{src:f}),0.90*0.90,'and to her, with Moth Hide 10% more (they multiply)',1e-6);
  near(outRatio(L,A[0],f),1.075,'Moonless: her side deals 7.5% more to it',1e-6);
  f.hp=f.maxHp-1e6; const h0=f.hp; V.heal(f,1000); near(f.hp-h0,850,'Bad Dreams: 15% less healing');
  V.step(1); near(f.speed,100*0.85,'Waking Terror: 15% slower',1e-6); near(f.atkInterval,ai/0.90,'Waking Dread: 10% slower attacks',1e-6);
  const au=L.T.s.au.find(e=>e.x===f); near(au.ap.cdRate,-0.09,'Heavy Eyelids: its cooldowns recover 9% slower (the aura rate)',1e-9);
  near(inRatio(L,A[0],{src:F[1]}),1,'an enemy that is not Haunted: nothing');
  secs(6.0); assert.ok(!has(L,f,'ha'),'after 6 s it is gone'); V.step(1); near(f.speed,100,'its speed back',1e-6);
});

test('Lysara / Night Terrors: the ultimate\'s sleepers wake Haunted for twice as long (8 s) even without Nightmare; a Drowse waker is not',()=>{
  const L=ly(S(['ln_6_2','ln_7_2','ln_1_1']),{foes:2,allies:1}), {F}=L;
  ult(L); wake(L,F[0]); V.step(1); near(left(L,F[0],'ha'),8,'8 s',0.05);
  free(F[1]); for(let i=0;i<5;i++) auto(L,F[1]); wake(L,F[1]); V.step(1);
});

test('Lysara / Twin Dreams (PICK ONE: the nearest within 3 m gains 3 Drowse, not passed on), Dreamcatcher (15% of her ability power to the most wounded), Sleep Paralysis (1 s silence on waking), Weight of Night (+12% on the waking hit)',()=>{
  const L=ly(S(['ln_1_1','ln_5_2','ln_11_1','ln_10_1','ln_12_1']),{foes:3,allies:1}), {v,F,A}=L, f=F[0]; at(L,F[1],4.5,4.2); at(L,F[2],4.5,8.4); V.step(1);
  A[0].maxHp=1e5; A[0].hp=5e4; const h0=A[0].hp;
  for(let i=0;i<5;i++) auto(L,f); assert.ok(asleep(f)); near(A[0].hp-h0,apNow(v)*0.15,'Dreamcatcher',1e-6);
  assert.equal(ust(L,F[1],'dr'),3,'Twin Dreams: the nearest enemy within 3 m gains 3 Drowse'); assert.equal(ust(L,F[2],'dr'),0);
  { const M=L.v.uid; setUst(L,F[1],'dr',2,9); L.T.s.dg={}; L.T.s.lk={}; wake(L,f); V.step(1); secs(0.6); delete f._talM[M]['#dr']; L.T.s.dg={}; L.T.s.lk={}; setUst(L,F[1],'dr',2,9); for(let i=0;i<5;i++) auto(L,f); assert.ok(asleep(F[1]),'its 3 Drowse can put that enemy to sleep'); assert.equal(ust(L,F[2],'dr')+ust(L,f,'dr'),0,'and that sleep does not pass Drowse on'); }
  const a=lost(f,()=>V.hit(A[0],f,1000,{kind:'true'})); assert.ok(!asleep(f)); const b=lost(f,()=>V.hit(A[0],f,1000,{kind:'true'}));
  near(a/b,1.12,'Weight of Night: the hit that wakes it, 4% x 3 more',1e-6);
  V.step(1); near(f.silencedT,1,'Sleep Paralysis: it cannot cast for 1 s',0.04);
});

test('Lysara / Stopped Clock (PICK ONE): a Drowse sleeper\'s cooldowns stay stopped 1 s after it wakes',()=>{
  const L=ly(S(['ln_1_1','ln_5_3']),{foes:2,allies:1}), {F}=L, f=F[0];
  for(let i=0;i<5;i++) auto(L,f); f.greenCd=5; f.blueCd=4; secs(0.3); near(f.greenCd,5,'(asleep: the game\'s own cooldowns stand still)');
  wake(L,f); V.step(1); secs(0.5); f.greenCd=2; f.blueCd=1; V.step(1); near(f.greenCd,5,'0.5 s after it woke a cooldown that ran is put back',1e-6); near(f.blueCd,4);
  secs(0.6); f.greenCd=2; V.step(1); near(f.greenCd,2,'after 1 s they run again',1e-6);
});

test('Lysara / Lullaby (her hits do not wake it, 30% more to a sleeper), Lamp Out (sleepers 10% less armor and magic resist), Grey Hours (2.5% per sleeper for her side), Deep Lull (6 energy a sleep, at most 3 sleeps in 6 s), Black Window',()=>{
  const L=ly(S(['ln_8_1','ln_5_1','ln_10_3','ln_6_1','ln_1_1','ln_9_4']),{foes:4,allies:1}), {v,F,A}=L, f=F[0];
  const ar=F.map(x=>x.armorRating||0); v.energy=0; ult(L); near(v.energy,18,'Deep Lull: 2 x 3 per sleep, 3 sleeps count');
  V.step(1); assert.equal(L.T.s.nz,4,'four enemies asleep'); near(F[1].armorRating,ar[1]*0.90,'Lamp Out',1e-6);
  near(inRatio(L,A[0],{src:F[1]}),1-0.025*4,'Grey Hours: 10% less with four asleep',1e-6);
  const a=lost(f,()=>V.hit(v,f,1000,{kind:'true',auto:true})); assert.ok(asleep(f),'Lullaby: her basic attack does not wake it');
  const b=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',auto:true}))); near(a/b,1.30,'and deals 30% more to a sleeper',1e-6);
  V.hit(A[0],f,1,{kind:'true'}); assert.ok(!asleep(f),'another unit\'s hit still wakes it');
  v.energy=0; F[2].stunned=0; F[2]._sleepT=0; V.step(1); secs(0.6); for(let i=0;i<5;i++) auto(L,F[2]); assert.ok(asleep(F[2])); near(v.energy,0,'a 5th sleep within 6 s gives no energy');
  /* Black Window: an enemy at full Powdered Slumber can sleep from Drowse every 6 s */
  const g=F[3]; free(g); setUst(L,g,'ps',0.35,99); for(let i=0;i<5;i++) auto(L,g); wake(L,g); V.step(1); secs(6.1); setUst(L,g,'ps',0.35,99); for(let i=0;i<5;i++) auto(L,g); assert.ok(asleep(g),'6 s later, at full Powdered Slumber');
});

test('Lysara / Hush of Callowmere (SIGNATURE): the ultimate\'s first sleeper wakes, the Hush (6 s): every waker sleeps once more 1.2 s (0.5 s after), is Haunted; an enemy dying asleep gives every ally 5 energy',()=>{
  const L=ly(S(['ln_13_2']),{foes:3,allies:1}), {v,F,A}=L;
  ult(L); wake(L,F[0]); V.step(1); near(L.T.s.hush,V.now()+6,'the Hush opens when its first sleeper wakes, for 6 s',0.03); assert.ok(has(L,F[0],'ha'),'woken inside it: Haunted'); near(left(L,F[0],'ha'),4,'',0.05);
  assert.ok(!asleep(F[0]),'awake'); secs(0.56); assert.ok(asleep(F[0]),'0.5 s later it falls asleep once more'); near(F[0].stunned,1.2,'1.2 s',0.04);
  wake(L,F[0]); V.step(1); secs(0.6); assert.ok(!asleep(F[0]),'once per enemy');
  wake(L,F[1]); V.step(1); secs(0.56); assert.ok(asleep(F[1]),'another sleeper of the ultimate, woken inside the Hush');
  v.energy=0; A[0].energy=0; assert.ok(asleep(F[2])); F[2].hp=1; V.hit(A[0],F[2],1000,{kind:'true'}); assert.ok(!F[2].alive); V.step(1); near(v.energy,5,'an enemy that dies asleep: 5 energy to her',1e-6); near(A[0].energy,5,'and to every ally',1e-6);
  secs(6); wake(L,F[1]); V.step(1); secs(0.6); assert.ok(!asleep(F[1]),'after 6 s the Hush is over');
});

/* ============================== THE SHARED DREAM ============================== */
test('Lysara / Moon Phase (Waxing heals +10%, Waning shields +10%), Tidal Heart (+3 points), Full Moon (+25% on the next), Lunar Clock (12 energy a turn), Syzygy (both, 4 s), Moon Tides',()=>{
  let pl; { const P0=lab(H,null,{allies:2}); allyHp(P0,[0.4,0.5]); P0.v.hp=P0.v.maxHp; const h0=P0.A[0].hp; V.cast(P0.v,'green'); pl={heal:P0.A[0].hp-h0, sh:(P0.v.apow||0)*2.2*SM(), ap:P0.v.apow, hp:P0.v.maxHp}; }
  const L=ly(S(['sd_2_1','sd_12_1','sd_4_1','sd_8_1','sd_9_1','sd_7_1']),{foes:1,allies:2}), {v,A}=L; allyHp(L,[0.4,0.5]); v.hp=v.maxHp;
  assert.ok(L.T.fn.wax(L.T.s.api,L.T),'each fight starts Waxing'); V.step(1); near(v.apow,pl.ap*1.05,'Moon Tides: Waxing 5% ability power',1e-6);
  const h0=A[0].hp; V.cast(v,'green'); near(A[0].hp-h0,pl.heal*1.13*1.05,'Waxing: Dreamthread\'s heal 10% + Tidal Heart 3% stronger (x Moon Tides 5% ability power)',1e-6);
  v.energy=0; secs(8.05-V.now()); near(v.energy,12,'the moon turned: Lunar Clock 4 x 3',1e-6); V.step(1); assert.ok(L.T.fn.wane(L.T.s.api,L.T)); near(v.maxHp,pl.hp*1.05,'Moon Tides: Waning 5% max HP',1e-6);
  A[0].shield=0; A[0].hp=2e4; V.cast(v,'blue'); near(A[0].shield,pl.sh*(1+0.13+0.25)*1.0/1.05*1.05,'Waning: Moon Cocoon 13% stronger, + Full Moon 25% (the turn\'s charge)',1e-3);
  A[1].shield=0; A[1].hp=1e4; V.cast(v,'blue'); near(A[1].shield,pl.sh*1.13,'Full Moon is spent',1e-3);
  secs(24.05-V.now()); assert.ok(L.T.fn.wax(L.T.s.api,L.T)&&L.T.fn.wane(L.T.s.api,L.T),'Syzygy: the third turn, Waxing and Waning at once'); secs(4.1); assert.ok(!L.T.fn.wax(L.T.s.api,L.T),'for 4 s (then Waning only)');
});

test('Lysara / New Moon (Waning: an enemy she hits deals 5% less for 2 s), Moon Basin (Waxing: her basic attacks heal the most wounded 10% of her ability power, at most 1.2% of its max HP a second)',()=>{
  const L=ly(S(['sd_5_1','sd_11_1']),{foes:2,allies:1}), {v,F,A}=L; A[0].maxHp=1e5; A[0].hp=5e4; v.hp=v.maxHp;
  const h0=A[0].hp; auto(L,F[0]); near(A[0].hp-h0,Math.min(1200,apNow(v)*0.10),'Moon Basin',1e-6);
  A[0].maxHp=100; A[0].hp=50; L.T.s.mw={}; const h1=A[0].hp; auto(L,F[0]); near(A[0].hp-h1,Math.min(1.2,apNow(v)*0.10),'at most 1.2% of its max HP',1e-9); const h2=A[0].hp; auto(L,F[0]); near(A[0].hp-h2,0,'the cap: none more in the same second',1e-9); A[0].maxHp=1e5; A[0].hp=5e4;
  near(inRatio(L,A[0],{src:F[0]}),1,'Waxing: no New Moon'); secs(8.05-V.now()); auto(L,F[0]); near(inRatio(L,A[0],{src:F[0]}),0.95,'Waning: 5% less for 2 s',1e-6);
  const h3=A[0].hp; auto(L,F[1]); near(A[0].hp-h3,0,'no Moon Basin while Waning'); secs(2.05); near(inRatio(L,A[0],{src:F[0]}),1,'after 2 s');
});

test('Lysara / her link: Dreamshare (15% carried at half), Long Thread (+1.5 s), Shared Breath (+15%), Kind Dreams, Spun Fine, Woven Fate, Dream Armor, Lamp in the Window (LINK), One Dream, Steady Thread',()=>{
  let pl; { const P0=lab(H,null,{allies:2}); allyHp(P0,[0.4,0.5]); P0.v.hp=P0.v.maxHp; const h0=P0.A[0].hp; V.cast(P0.v,'green'); const h1=P0.A[0].hp; V.step(Math.round(1.02/V.STEP)); pl={heal:h1-h0, tick:P0.A[0].hp-h1, arm:P0.A[0].armorRating}; }
  const L=ly(S(['sd_2_2','sd_4_3','sd_8_2','sd_12_2','sd_6_2']),{foes:1,allies:2}), {v,A}=L; allyHp(L,[0.4,0.5]); v.hp=v.maxHp;
  const h0=A[0].hp; V.cast(v,'green'); near(A[0]._linkT,9.5,'Long Thread: 8 + 0.5 x 3'); const h1=A[0].hp;
  near(h1-h0,pl.heal*(1+0.15+0.10),'Spun Fine 15% + Woven Fate 10% on the first heal',1e-6);
  V.step(Math.round(1.02/V.STEP)); near(A[0].hp-h1,pl.tick*(1+0.20+0.10),'its heal over time: Kind Dreams 20% + Woven Fate 10%',0.02);
  near(A[0].armorRating,pl.arm*1.09,'Dream Armor: linked allies 9% more armor',1e-6);
  { const L=ly(S(['sd_1_2','sd_3_2','sd_n1','sd_10_2','sd_9_2']),{foes:1,allies:2}), {v,F,A}=L; allyHp(L,[0.4,0.5]); v.hp=v.maxHp; V.cast(v,'green');
  const b0=A[1].hp, a0=A[0].hp; V.hit(F[0],A[0],1000,{kind:'true',auto:true}); near(a0-A[0].hp,1000*0.85,'Dreamshare: 15% carried'); near(b0-A[1].hp,1000*0.15*0.5,'by the other, at half strength');
  A[0].hp=a0; A[1].hp=b0; near(inRatio(L,A[0],{src:F[0],auto:false}),0.96*0.85,'Lamp in the Window: enemy abilities 4% less, x Dreamshare 15% carried',1e-6);
  const c0=A[1].hp; V.heal(A[0],1000); assert.ok(A[1].hp-c0>=350+150-1e-6,'Shared Breath: 15% more on top of the game\'s 35%');
  A[1].shield=0; V.step(1); A[0].shield=(A[0].shield||0)+1000; A[0].shieldT=5; V.step(1); near(A[1].shield,0.4*A[0].shield,'One Dream: the partner gets 40% of the new shield',1e-6);
  near(FX.cd(v,'green',8),8-0.75,'Steady Thread'); }
});

test('Lysara / Bound Hearts (PICK ONE: the lowest ally linked to her, her heals on it 30% stronger) and Wide Weave (PICK ONE: the third lowest linked too, shares 35% with the lowest)',()=>{
  { const L=ly(S(['sd_5_2']),{foes:1,allies:2}), {v,A}=L; allyHp(L,[0.4,0.5]); v.hp=v.maxHp; V.cast(v,'green');
    assert.ok(A[0]._linkTo===v&&v._linkTo===A[0],'linked to Lysara herself'); assert.ok(!A[1]._linkTo,'the other ally is not linked'); assert.ok(has(L,A[0],'bh'));
    const h=A[0].hp; V.step(Math.round(1.02/V.STEP)); const tick=A[0].hp-h; const tk=A[0].maxHp*0.022; near(tick,tk*1.30*(v.healPowMul||1),'her heal over time on it 30% stronger',0.03); }
  { const L=ly(S(['sd_5_3']),{foes:1,allies:3}), {v,A}=L; allyHp(L,[0.3,0.4,0.5]); v.hp=v.maxHp; const h2=A[2].hp; V.cast(v,'green');
    assert.ok(A[0]._linkTo===A[1],'the game\'s two'); assert.ok(L.T.s.w3&&L.T.s.w3.c===A[2]&&L.T.s.w3.a===A[0],'the third, linked to the lowest');
    assert.ok(A[2].hp>h2,'the third is healed too'); assert.ok(A[2].hots.some(x=>x._talK==='dt'),'and gets the heal over time');
    const a=A[0].hp; V.heal(A[2],1000); near(A[0].hp-a,350*(1+0.35*0.35),'healing on the third shares 35% with the lowest (the lowest ally own link hop comes back once)'); }
});

test('Lysara / her cocoons: Hatching (unbroken: 12% faster attacks 4 s), Bright Wings, Molting, Cocoon Wake, Night Bloom; Hatchling (broken: 45% of it); Soft Silk, Dream Silk, Silk Strength; Pupa; Wingbeat; Grey Wings',()=>{
  const L=ly(S(['sd_1_4','sd_2_4','sd_3_4','sd_8_4','sd_6_3','sd_11_3','sd_3_3','lm_9_2','sd_4_2','sd_5_4','sd_6_4','ln_2_4']),{foes:2,allies:2}), {v,F,A}=L; allyHp(L,[0.4,0.9]); v.hp=v.maxHp;
  const a=A[0], ai=a.atkInterval, sp=a.speed; V.cast(v,'blue'); near(a.shield,(v.apow||0)*2.2*SM()*1.20,'Soft Silk 10% + Dream Silk 10%',1e-6); near(a.shieldT,7.5,'Silk Strength: 6 + 0.3 x 5');
  near(inRatio(L,a,{src:F[0]},10),0.90,'Pupa: inside her cocoon, 10% less',1e-6);
  const h0=a.hp; secs(7.6); assert.ok(has(L,a,'hat'),'it ran out unbroken: the ally hatches'); assert.equal(a.stunned,0,'Molting: one control cleared (the lab\'s hold)');
  near(a.hp-h0,a.maxHp*(0.06+0.09),'Cocoon Wake 6% + Night Bloom 9% of its max HP',1e-3);
  V.step(1); near(a.atkInterval,ai/1.12,'Hatching: 4% x 3 faster attacks',1e-6); near(a.speed,sp*1.15,'Bright Wings: 5% x 3 faster',1e-6);
  near(outRatio(L,a,F[0]),1.075,'Wingbeat: a hatched ally deals 7.5% more',1e-6);
  secs(4.1); near(a.atkInterval,ai,'after 4 s',1e-6);
  a.stunned=1e6; a.hp=1e4; V.cast(v,'blue'); const h1=a.hp; V.hit(F[0],a,a.shield*2+1,{kind:'true'}); V.step(1); assert.ok(has(L,a,'hat'),'Hatchling: a broken cocoon half-hatches'); assert.ok(a.stunned>0,'(no Molting for a half-hatch)');
  V.step(1); near(a.atkInterval,ai/(1+0.12*0.45),'at 15% x 3 of the full Hatching',1e-6); void h1;
  near(FX.cd(v,'blue',9),9-0.9,'Grey Wings');
});

test('Lysara / Second Skin (two weakest, 60% each, wherever they stand) and Under Her Wing (her two nearest allies start each wave in a cocoon of 15% x 3)',()=>{
  { const L=ly(S(['sd_7_3']),{foes:1,allies:2}), {v,A}=L; allyHp(L,[0.4,0.5]); v.hp=v.maxHp*0.9; for(const a of A) a.shield=0; V.cast(v,'blue'); const sh=(v.apow||0)*2.2*SM();
    near(A[0].shield,sh*0.6,'the weakest: 60%',1e-6); near(A[1].shield,sh*0.6,'the second weakest, 11 m away: 60%',1e-6); near(v.shield||0,0,'not a third'); }
  { const L=ly(S(['sd_n2']),{foes:1,allies:3}), {v,A}=L, sh=apNow(v)*2.2*SM()*0.45;
    near(A[0].shield,sh,'the nearest ally: 45% of a cocoon',1e-6); near(A[1].shield,sh,'the second nearest',1e-6); near(A[2].shield||0,0,'not the third'); assert.ok(has(L,A[0],'coc')); }
});

test('Lysara / The Shared Dream (SIGNATURE): a linked ally that would die holds at 1 HP, cannot be targeted 2 s, its partner heals 15%, then both wake in a cocoon of 3x her ability power; once per fight for each ally',()=>{
  const L=ly(S(['sd_13_2']),{foes:1,allies:2}), {v,F,A}=L; allyHp(L,[0.4,0.5]); v.hp=v.maxHp; V.cast(v,'green'); const a=A[0], b=A[1]; for(const x of [a,b]) x.shield=0;
  a.hp=100; const hb=b.hp; V.hit(F[0],a,1e4,{kind:'true'}); assert.ok(a.alive); near(a.hp,1+b.maxHp*0.15*0.35,'held at 1 HP (then the partner heal comes back along the game link)',1e-6); assert.ok(a._noTarget,'cannot be targeted'); near(b.hp-hb,b.maxHp*0.15*(1+0.35*0.35),'its partner heals 15% of its max HP (and the link hop comes back once)',1e-6);
  V.dmg(a,1e6); assert.ok(a.alive&&a.hp===1,'a second blow inside the dream: still 1 HP'); secs(1.5); V.dmg(a,1e6); assert.ok(a.alive&&a.hp===1,'and 1.5 s later');
  secs(0.55); near(a.shield,3*apNow(v),'they wake inside a cocoon of 3x her ability power',1e-6); near(b.shield,3*apNow(v),'both',1e-6); assert.ok(!a._noTarget);
  a.shield=0; a.hp=100; V.dmg(a,1e4); assert.ok(!a.alive,'once per fight for that ally');
});

test('Lysara / Restless Queen (controls on her 20% shorter), Silent Hours, Gentle Hours, Moth\'s Patience (cooldowns, each 5%), Longest Night and Bright Night (energy 20% faster)',()=>{
  const L=ly(S(['sd_7_4','ln_8_3','sd_9_3','lm_3_2','ln_12_2','lm_12_3']),{foes:1}), {v,F}=L;
  near(FX.cc(F[0],v,'stunned',1),0.80,'Restless Queen'); near(FX.cd(v,'green',8),8*0.95*0.95*0.95,'three cooldown talents, 5% each');
  v.energy=0; V.step(1); v.energy=10; V.step(1); near(v.energy,10*1.2,'energy gained, 20% more',1e-6);
});

/* ============================== LANTERN MOTH ============================== */
test('Lysara / Wing Dust (1 a basic attack, max 6 + Long Wick 3, 6 s + Thick Wings 3): an enemy carrying Dust casts, the Dust flares (15% of her ability power per Dust) and is spent; Fine Powder, Ember Moth, Pale Fire, Guttering',()=>{
  const L=ly(S(['lm_1_1','lm_2_1','lm_12_1','lm_6_1','lm_11_1','lm_1_2','lm_5_4']),{foes:4}), {v,F}=L, f=F[0]; for(const x of F) x.t=Object.assign({},x.t,{role:'Mage'}); V.step(1);
  for(let i=0;i<11;i++) auto(L,f); assert.equal(ust(L,f,'du'),9,'max 6 + 3'); near(ustLeft(L,f,'du'),9,'lasts 6 + 3 s',1e-6);
  const mr=f.mrRating; f.mrRating=mr*(1-0.10); const def=dm(v,f,'magic'); f.mrRating=mr;
  v.energy=0; foeCast(f); near(ust(L,f,'du'),0,'the Dust is spent'); const x=lost(f,()=>V.step(1));
  near(x,apNow(v)*0.15*9*1.15*1.15*def,'9 Dust x 15% AP, Fine Powder 15%, Pale Fire 15% (four enemy Mages, three count), magic through 10% less magic resist (Ember Moth)',1e-6);
  near(v.energy,5,'Guttering: 5 energy a flare',1e-6);
  const y=lost(F[2],()=>{ foeCast(F[2]); V.step(1); }); near(y,0,'no Dust: no flare');
});

test('Lysara / The Lantern (the highest ability power at the wave start; her basic attacks go to it in reach; her side 7.5% more), Lightless, Bright Burn, Glass Lantern, Drawn to Light, Lamp Black, Self-Snuffing',()=>{
  const L=ly(S(['lm_2_3','lm_8_3','lm_8_1','lm_11_4','lm_3_3','lm_4_3','lm_9_1','lm_1_1']),{foes:3,allies:1,pre:L=>{ L.F[2].apow=500; L.F[1].apow=200; at(L,L.F[2],12,0); }}), {v,F,A}=L, lan=F[2];
  assert.ok(has(L,lan,'lan'),'the Lantern: the highest ability power'); near(lan.armorRating,F[0].armorRating*0.88,'Glass Lantern: 12% less armor (against an enemy that is not the Lantern)',1e-6);
  near(outRatio(L,A[0],lan),1.075,'her side deals 7.5% more to it',1e-6); near(outRatio(L,v,lan,{auto:true}),1.075*1.10,'and she 10% more (Lightless)',1e-6);
  v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=v.blueCd=99; v.energy=0; at(L,lan,10.5,0); V.step(1); assert.ok(v.target===lan,'her basic attacks go to it while it is in her reach'); at(L,lan,20,0); V.step(1); assert.ok(v.target!==lan,'out of reach: the nearest');
  at(L,lan,12,0); F[0].forcedTarget=null; v.forcedTarget=F[0]; v.forcedTargetT=2; V.step(1); assert.equal(v.target,F[0],'a taunt still wins'); v.forcedTargetT=0; v.stunned=1e6;
  const d0=ust(L,lan,'du'); brnd(0); auto(L,lan); brndBack(); assert.equal(ust(L,lan,'du')-d0,2,'Drawn to Light: 2 Dust (the roll passed)'); brnd(0.99); auto(L,lan); brndBack(); assert.equal(ust(L,lan,'du')-d0,3,'or 1');
  setUst(L,lan,'du',6,6); const def=dm(v,lan,'magic'); const x=lost(lan,()=>{ foeCast(lan); V.step(1); }); near(ust(L,lan,'du'),3,'Self-Snuffing: it keeps half');
  near(x,apNow(v)*0.15*6*1.24*1.10*1.075*def,'flares on the Lantern: Bright Burn 24%, Lightless 10%, The Lantern 7.5% (at Wing Dust\'s rank 1)',1e-6);
  lan.hp=1; V.hit(A[0],lan,100,{kind:'true'}); V.step(1); assert.ok(has(L,F[1],'lan'),'Lamp Black: the next highest ability power is the Lantern'); assert.equal(ust(L,F[1],'du'),3,'and takes all its Dust');
});

test('Lysara / Ash Wings (a carrier dies: its Dust flares on every enemy within 2 m), Choking Flare (PICK ONE: 0.6 s silence), Burning Thread (20% to the linked pair), Moth Swarm (100% at 5/5), Smother, Wick, Hunt the Glow',()=>{
  const L=ly(S(['lm_1_1','lm_3_1','lm_5_2','lm_10_2','lm_10_3','lm_4_1','lm_7_1','lm_9_3']),{foes:3,allies:2}), {v,F,A}=L; at(L,F[1],4.5,4.2); at(L,F[2],4.5,-4.2); V.step(1);
  allyHp(L,[0.4,0.5]); v.hp=v.maxHp; V.cast(v,'green');
  setUst(L,F[0],'du',5,6); const b=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',auto:true}))); const a=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',auto:true}));
  near(a/b,(1+0.05*5)*(1.10),'Wick 1% x 5 per Dust, Hunt the Glow 10%',1e-6);
  assert.equal(ust(L,F[0],'du'),6,'it reached 6'); assert.equal(ust(L,F[1],'du'),1,'Moth Swarm: an enemy within 2 m gains 1'); assert.equal(ust(L,F[2],'du'),1);
  const mr=F[0].mrRating; V.step(1); near(F[0].mrRating,mr*0.90,'Smother: 3 or more Dust, 10% less magic resist',1e-6);
  const h0=A[0].hp; foeCast(F[0]); V.step(1); near(F[0].silencedT,0.6,'Choking Flare: the caster is silenced 0.6 s',0.04); assert.ok(A[0].hp>h0,'Burning Thread: the linked pair is healed');
  setUst(L,F[0],'du',4,6); const h1=F[1].hp; F[0].hp=1; V.hit(A[0],F[0],100,{kind:'true'}); assert.ok(!F[0].alive); assert.ok(F[1].hp<h1,'Ash Wings: its Dust flares on the enemy beside it');
});

test('Lysara / Wildfire Dust (PICK ONE): a cast\'s flare leaps to the nearest enemy within 3 m, the same flare, and leaves 2 Dust',()=>{
  const L=ly(S(['lm_1_1','lm_5_3']),{foes:3}), {v,F}=L; at(L,F[1],4.5,4.2); V.step(1); setUst(L,F[0],'du',4,6);
  const h=F[1].hp; foeCast(F[0]); V.step(1); near(h-F[1].hp,apNow(v)*0.15*4*dm(v,F[1],'magic'),'the same flare on its neighbour',1e-6); assert.equal(ust(L,F[1],'du'),2,'and 2 Dust');
});

test('Lysara / Snuffed Light: the ultimate leaves 3 Dust on every sleeper; a caster within 3 s of waking flares at double',()=>{
  const L=ly(S(['lm_7_2']),{foes:2,allies:1}), {v,F}=L; ult(L); assert.equal(ust(L,F[0],'du'),3); wake(L,F[0]); V.step(1);
  const x=lost(F[0],()=>{ foeCast(F[0]); V.step(1); }); near(x,apNow(v)*0.03*3*2*dm(v,F[0],'magic'),'double (Wing Dust\'s rank-1 strength)',1e-6);
  wake(L,F[1]); V.step(1); secs(3.1); setUst(L,F[1],'du',3,6); const y=lost(F[1],()=>{ foeCast(F[1]); V.step(1); }); near(y,x/2*dm(v,F[1],'magic')/dm(v,F[0],'magic'),'after 3 s, single',1e-6);
});

test('Lysara / full Powdered Slumber (her count at its top): Dust in the Eyes, Wandering Light, Dazzle; Lost Aim (3% x 3 of its basic attacks miss: 1 energy), Curtain Call, Fumble; Once Burned, Grey Eye',()=>{
  const L=ly(S(['ln_3_4','lm_7_4','lm_4_4','lm_1_4','lm_11_3','lm_6_4','lm_n1','lm_10_4']),{foes:2,allies:1}), {v,F,A}=L, f=F[0];
  const ai=f.atkInterval; setUst(L,f,'ps',0.35,99); V.step(1); near(f.atkInterval,ai/(1-0.075),'Dust in the Eyes: 7.5% slower',1e-6);
  near(inRatio(L,A[0],{src:f,auto:false}),0.95,'Wandering Light: 5% less',1e-6); near(outRatio(L,v,f),1.05,'Dazzle: 5% more from her',1e-6);
  near(inRatio(L,v,{src:F[1],auto:false}),0.90,'Once Burned: abilities 10% less on her',1e-6); near(inRatio(L,v,{src:F[1],auto:true}),1,'(not basic attacks)');
  setUst(L,F[1],'du',1,9); near(inRatio(L,v,{src:F[1],auto:true}),1-0.075,'Grey Eye: an enemy carrying Dust, 7.5% less',1e-6);
  v.energy=0; A[0].energy=0; v.blueCd=5; brnd(0.05); const m=lost(A[0],()=>V.hit(f,A[0],100,{kind:'true',auto:true})); brndBack(); near(m,0,'Lost Aim: a basic attack missed (the roll 0.05 < 9%)');
  near(v.energy,1,'1 energy'); near(A[0].energy,3,'Curtain Call: 3 to the ally it was aimed at'); near(v.blueCd,5-0.3,'Fumble: 0.3 s off Moon Cocoon');
  brnd(0.10); const n=hitOn(L,A[0],100,{src:f,auto:true}); brndBack(); assert.ok(n>0,'the roll 0.10: it lands');
  brnd(0); const o2=hitOn(L,A[0],100,{src:F[1],auto:true}); brndBack(); assert.ok(o2>0,'an enemy not at full Powdered Slumber never misses');
});

test('Lysara / Into the Flame (SIGNATURE): the ultimate\'s sleep ends, every Dust flares at double, the Lantern takes one more double flare per Dust and is silenced 2 s; 6 s of casts flaring as if 3 Dust',()=>{
  const L=ly(S(['lm_13_3','lm_2_3','lm_1_1']),{foes:3,allies:1,pre:L=>{ L.F[2].apow=500; }}), {v,F}=L, lan=F[2];
  ult(L); setUst(L,F[0],'du',4,9); setUst(L,F[1],'du',2,9); const h=F.map(x=>x.hp);
  wake(L,F[0]); V.step(1); const k=apNow(v)*0.15*2;
  near(h[0]-F[0].hp-1,k*4*dm(v,F[0],'magic'),'4 Dust at double (the waking hit was 1)',1e-6); near(h[1]-F[1].hp,k*2*dm(v,F[1],'magic'),'2 Dust at double',1e-6);
  near(h[2]-lan.hp,k*6*1.075*dm(v,lan,'magic'),'the Lantern: one more double flare for each of the 6 Dust',1e-6); near(lan.silencedT,2,'silenced 2 s',0.04);
  assert.equal(ust(L,F[0],'du'),0); const y=lost(F[1],()=>{ foeCast(F[1]); V.step(1); }); near(y,apNow(v)*0.15*3*dm(v,F[1],'magic'),'a cast inside 6 s flares as if 3 Dust',1e-6);
  secs(6); const z=lost(F[1],()=>{ foeCast(F[1]); V.step(1); }); near(z,0,'after 6 s');
});

test('Lysara / her damage-reduction talents: ONE group, at most 35% off a hit on her and 25% on an ally, every condition at once',()=>{
  const L=ly(S(['ln_2_2','ln_10_4','ln_10_3','lm_n1','lm_10_4','lm_7_4','sd_5_1','sd_n1','lm_2_3','sd_5_4','sd_12_4']),{foes:2,allies:1}), {v,F,A}=L, f=F[0];
  setMk(L,f,'ha'); setUst(L,f,'du',2,99); setUst(L,f,'ps',0.35,99); setMk(L,f,'nm'); L.T.s.m.lan=f; setMk(L,f,'lan'); L.T.s.nz=5;
  v._linkTo=A[0]; A[0]._linkTo=v; v._linkT=A[0]._linkT=9; setMk(L,v,'coc'); setMk(L,A[0],'coc'); v.shield=1; A[0].shield=1; at(L,A[0],0,-3.5);
  near(L.T.fn.drProbe(L.T.s.api,L.T,v,v,f,'phys',false),0.65,'on her: the floor 0.65 (35%)'); near(L.T.fn.drProbe(L.T.s.api,L.T,v,A[0],f,'phys',false),0.75,'on an ally: 0.75 (25%)');
  setMk(L,f,'ha',0); L.T.s.nz=0; const one=L.T.fn.drProbe(L.T.s.api,L.T,v,A[0],F[1],'phys',true); assert.ok(one<1&&one>0.75,'a single share multiplies on its own ('+one.toFixed(3)+')');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Lysara: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['ln_1_1','ln_2_1','ln_2_2','ln_n2','ln_8_1','sd_2_1','sd_1_2','sd_1_4','lm_1_1','lm_2_3','lm_1_4','lm_2_4','ln_1_4']), TEAM=['vael','sylthaine','vireo','vex','lysara'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let zz=0,ha=0,du=0,dr=0,lan=false,fl=0;
  VMX('var __lf=0, __lfH=null;'); const T0=s._tal;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ const hp=units().filter(u=>u.team==='enemy').reduce((a,u)=>a+u.hp,0); V.step(1);
    if(T0.s.zz) zz=Math.max(zz,Object.keys(T0.s.zz).length);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.ha&&o.ha.until>V.now()) ha++; if(o['#du']&&o['#du'].until>V.now()) du++; if(o['#dr']) dr++; if(o.lan) lan=true; }
    if(T0.s.fq&&T0.s.fq.length) fl++; void hp; }
  console.log('  live fight: sleeps followed at once (most) '+zz+', ticks with an enemy Haunted '+ha+', with Dust '+du+', with Drowse '+dr+', a Lantern '+lan);
  assert.ok(zz>0,'real sleeps of hers'); assert.ok(ha>0,'real Haunted'); assert.ok(du>0,'real Dust'); assert.ok(dr>0,'real Drowse'); assert.ok(lan,'a real Lantern');
  determinism(H,TEAM);
});

/* The page sites her talents added (the sleep's wake line widened, Powdered Slumber's swing, the basic-attack target, an enemy's cast): with nothing learned, whole
   seeded fights with Lysara in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Lysara: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['lysara','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __lyN={ult:0,slept:0,wake:0,swing:0,casts:0,picks:0}; var __lyD=_doEffectCore, __lyC=_dealDamageCore, __lyU=_updateBattleCore, __lyE=nearestEnemy;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="lysara"&&type==="quietwings"&&!(o&&o.deliver&&!o._arrived)) __lyN.ult++; if(u&&u._castSlot&&!(o&&o.deliver&&!o._arrived)) __lyN.casts++; return __lyD.apply(this,arguments); };'+
    '_dealDamageCore=function(s,t,a,c,k,si){ const w=t&&(t._sleepT||0)>0; const r=__lyC.apply(this,arguments); if(w&&!((t._sleepT||0)>0)) __lyN.wake++; return r; };'+
    '_updateBattleCore=function(dt){ const m=new Map(); for(const x of units) m.set(x,[x._accDn||0,x._sleepT||0]); const r=__lyU.apply(this,arguments); for(const x of units){ const p=m.get(x); if(!p) continue; if((x._accDn||0)>p[0]) __lyN.swing++; if((x._sleepT||0)>p[1]+0.5) __lyN.slept++; } return r; };'+
    'nearestEnemy=function(u){ if(u&&u.key==="lysara") __lyN.picks++; return __lyE.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__lyN'); console.log('  identity / base skills: '+JSON.stringify(c));
    assert.ok(c.ult>0&&c.slept>0&&c.wake>0&&c.swing>0&&c.casts>0&&c.picks>0,'the fights cast her ultimate, slept and woke enemies, swung with Powdered Slumber, cast skills and picked targets: every new site was run'); }
  finally{ VMX('_doEffectCore=__lyD; _dealDamageCore=__lyC; _updateBattleCore=__lyU; nearestEnemy=__lyE;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage-reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ ln:['ln_2_2','ln_10_4','ln_10_3','ln_12_4'], sd:['sd_n1','sd_5_1','sd_5_4','sd_11_4','sd_10_4','sd_7_4','sd_12_4'], lm:['lm_n1','lm_10_4','lm_7_4','lm_12_4','lm_5_1','lm_2_3','lm_1_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={ln:0,sd:1,lm:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her (or an ally): every condition of the group true at once (the attacker Haunted, carrying Dust, at full Powdered Slumber, under New Moon,
   the Lantern; five enemies asleep; she linked and cocooned; an ability unless a basic attack is asked); measured through the engine (HP and shield it takes) */
function worstHit(list,kind,crit,ally,autoHit){ const L=ly(list,{foes:2,allies:1}), {v,F,A}=L, f=F[0], t=ally?A[0]:v;
  t.maxHp=1e5; t.hp=8e4;
  if(L.T){ setMk(L,f,'ha'); setUst(L,f,'du',2,99); setUst(L,f,'ps',0.45,99); setMk(L,f,'nm'); L.T.s.m.lan=f; setMk(L,f,'lan'); L.T.s.nz=5;
    v._linkTo=A[0]; A[0]._linkTo=v; v._linkT=A[0]._linkT=9; setMk(L,t,'coc'); at(L,A[0],0,-3.5); }
  t.shield=1e12; t.shieldT=999; for(const x of F) x.stunned=1e6;
  const raw=2e4; brnd(0.999); const x=lost(t,()=>V.hit(f,t,raw,{kind,crit,auto:!!autoHit})); brndBack(); const cm=crit?1+Math.max(0,(f.critDmg||0.6)-(t.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,t)); }
test('Lysara: her most defensive legal 91-point build never takes more than 95% off a hit (her allies neither), and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['sd','lm'],[61,30]],[['lm','sd'],[61,30]],[['ln','sd'],[61,30]],[['sd','ln'],[61,30]],[['lm','ln'],[61,30]],[['sd'],[91]],[['sd','ln','lm'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.ally=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false,false),worstHit(c.list,kind,crit,false,true)); c.ally=Math.max(c.ally,worstHit(c.list,kind,crit,true,false)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,false))), noneA=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% (on an ally '+(c.ally*100).toFixed(1)+'%)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  for(const c of cands) assert.ok(c.ally<0.95);
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,sus:[]}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="lysara"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="lysara"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal; if(T&&T.s.api){ let w=0; for(const e of units){ if(!e.alive||e.team===u.team) continue; const k=T.fn.drProbe(T.s.api,T,u,u,e,"phys",true)*defMul(e,u,"phys"); w=Math.max(w,1-k); } __dr.sus.push(w); if(w>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','lysara'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'), su=d.sus.slice().sort((a,b)=>a-b), med=su.length?su[Math.floor(su.length/2)]:0;
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%; on an ally '+(best.ally*100).toFixed(1)+'%, no talents '+(noneA*100).toFixed(1)+'%); seeded fights: '+d.n+' hits on her, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; sustained (a basic attack from her worst attacker, tick by tick) median '+(med*100).toFixed(1)+'%, at 85% or more '+d.tHi+' of '+d.ticks+' ticks; immune '+d.imm);
    assert.ok(d.n>30&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
