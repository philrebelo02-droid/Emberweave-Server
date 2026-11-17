'use strict';
/* Mirelle Velvetplum's talents as data on the mechanics layer (talents-mech/mirelle.js), group by group on the still field (tests/talents-lab.js), then whole
   fights, the no-talent identity of the page sites her talents added, Phil's 95% damage-reduction ceiling, and the longest sleep chain.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched off
   for one action (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Mirelle, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5). Her body is
   1.56 m, a Vael's 2.01 m: body to body F0 is 0.93 m from her; F0 to F1 1.48 m, F0 to F3 3.48 m.
   Lab units are HELD (stunned 1e6). A held enemy is "stunned": her talent sleeps never land on a stunned enemy (the stun-lock rule), so sleep tests free it
   (free()). Run: node --test tests/talents-mech-mirelle.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='mirelle', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:dur===null?null:V.now()+(dur||99),v:0}; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:Infinity}; };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const free=x=>{ x.stunned=0; x.silencedT=0; x.speed=0; x.level=1; x.atkCd=1e9; x.greenCd=1e9; x.blueCd=1e9; x.energy=0; };
const hold=x=>{ x.stunned=1e6; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const M_=L=>L.T.s.mi;
const A_=L=>L.T.s.api;
const SM=lv=>VMX('skillMul')(lv);
const sc=L=>V.cast(L.v,'green');                                           // Scent of Courage (its ally: the lowest HP share)
const bq=(L,t)=>{ t.level=1; V.cast(L.v,'blue',t); };                     // Soporific Bouquet as it arrives on t (level 1: the control always lands)
const ult=L=>V.cast(L.v,'ult');                                           // Imperial Plumage
const dmgOn=(src,t,amt,o)=>lost(t,()=>V.hit(src,t,amt||1000,Object.assign({kind:'true'},o||{})));
const ratio=(L,src,t,o)=>dmgOn(src,t,1000,o)/plainHit(L,()=>dmgOn(src,t,1000,o));
const inRatio=(L,src,o)=>ratio(L,src,L.v,o);
const gained=(x,fn)=>{ const h=x.hp; fn(); return x.hp-h; };
const sleepOn=(x,d)=>{ x._sleepT=d||5; x.stunned=Math.min(2.8,d||5); };    // a sleep as the game writes one (stunned and _sleepT)
const weak=(x,f)=>{ x.hp=x.maxHp*(f==null?0.5:f); };
const scentOn=(L,x)=>{ weak(x,0.3); sc(L); x.hp=x.maxHp; };               // her Scent on that ally
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ return V.cc(src,t,field,secs); } finally{ t.level=lv; } };

test('Mirelle: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['rw_3_4','rw_11_4','rw_7_1','lp_3_4','lp_7_1','lp_12_1','he_1_2','he_3_1','he_3_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const M=FXN.mech(H); for(const id of ['rw_1_1','lp_1_2','he_1_4','rw_13_2','lp_13_3','he_13_3']) assert.ok(M.talents[id],id);
});

test('Mirelle: her real kit, as the talents read it - Scent of Courage, Trail of Splendor, Soporific Bouquet\'s sleep, Imperial Plumage (no charm)',()=>{
  plain({foes:3,allies:2},P=>{ const {v,F,A}=P;
    const h0=v.hp; weak(A[0],1); weak(A[1],1); v.hp=v.maxHp; const hv=gained(v,()=>sc(P)); near(v.dmgBuffMul,1.28,'a tie at full health: Scent goes to herself, +28% damage'); near(v.dmgBuffT,6,'for 6 s');
    weak(A[1],0.4); const sh=A[1].shield||0, hp=A[1].hp; sc(P); assert.ok(A[1].hp>hp,'the lowest HP share is healed'); near(A[1].dmgBuffMul,1.28); assert.equal(A[1]._buffedT,0.5,'Trail of Splendor is told');
    V.step(1); near((A[1].shield||0)-sh,A[1].maxHp*0.04*v.passMul,'Trail of Splendor: a shield of 4% x passive strength of its max HP'); near(A[1].shieldT,5,'for 5 s',0.01);
    A[1]._buffedT=0.5; V.step(1); near((A[1].shield||0)-sh,2*A[1].maxHp*0.04*v.passMul,'it stacks (any buff: _buffedT)');
    const f=F[0]; free(f); V.cast(v,'blue',f); near(f._sleepT,5,'the sleep flag 5 s'); near(f.stunned,V.cap('stunned'),'held 2.8 s (the stun ceiling)'); assert.ok(f.slow>0,'and slowed');
    free(f); sleepOn(f); V.hit(F[1],f,1,{kind:'true'}); assert.equal(f._sleepT,0,'any hit wakes it'); assert.equal(f.stunned,0); hold(f);
    for(const x of F){ x._shredPct=0; x._atkDnPct=0; } A[0].shield=0; ult(P); for(const x of F){ assert.ok(x._shredPct>=0.3,'Imperial Plumage lowers EVERY enemy\'s guard (no radius)'); near(x._atkDnPct,0.2,'its attack 20%'); near(x._shredT,6); }
    near(A[0].shield,A[0].maxHp*0.10*SM(10),'shields each ally 10% x skill level of its max HP'); assert.ok(!('charmed' in F[0])&&!('_charmT' in F[0]),'nothing is charmed: there is no charm in the game'); });
});

/* ============================== ROSEWATER ============================== */
test('Mirelle / Mettle: Behind the Ears, a wave keeps it, Reputation, Rising Mettle, Brave Front',()=>{
  const L=lab(H,S(['rw_1_1','rw_10_1','rw_4_1','rw_8_1']),{foes:2,big:true,allies:1}), {v,F,A}=L; assert.equal(ust(L,A[0],'mettle'),3,'Reputation: allies start a wave with 1 Mettle x 3');
  scentOn(L,A[0]); assert.equal(ust(L,A[0],'mettle'),4,'each Scent of Courage gives its ally 1 Mettle'); scentOn(L,A[0]); scentOn(L,A[0]); assert.equal(ust(L,A[0],'mettle'),5,'at most 5');
  near(ratio(L,A[0],F[0]),1+0.005*5*5,'Behind the Ears: 0.5% x 5 more damage per Mettle (5 Mettle)'); near(ratio(L,v,F[0]),1+0.025*3,'her own hits: her 3 Mettle');
  const i0=A[0].atkInterval; V.step(2); near(i0/A[0].atkInterval,(1+0.003*5*5)/(1+0.003*5*3),'Rising Mettle: 0.3% x 5 attack speed per Mettle (5 now, 3 before)'); near(A[0].ctrlRes,0.09,'Brave Front: 5 Mettle, 3% x 3 control reduction');
  setUst(L,A[0],'mettle',4); V.step(2); near(A[0].ctrlRes,0,'Brave Front only at 5'); setUst(L,A[0],'mettle',5); V.step(2);
  V.wave(); V.step(2); assert.equal(ust(L,A[0],'mettle'),3,'a new wave: Mettle cleared, then Reputation'); near(A[0].ctrlRes,0,'Brave Front off under 5');
  const B=lab(H,S(['rw_1_1']),{foes:2,big:true,allies:1}); setUst(B,B.A[0],'mettle',4); V.wave(); V.step(2); assert.equal(ust(B,B.A[0],'mettle'),0,'without Reputation a wave starts at 0');
});

test('Mirelle / Steady Mettle, Hushed Confession, Velvet Feathers, Practised Smile: hers in one group, her allies\' in another',()=>{
  const L=lab(H,S(['rw_1_1','rw_2_1','rw_12_1','rw_3_3','rw_11_1']),{foes:2,big:true,allies:3}), {v,F,A}=L;
  setUst(L,A[0],'mettle',5); setUst(L,A[1],'mettle',3); setUst(L,A[2],'mettle',2);
  near(ratio(L,F[0],A[0]),(1-0.03)*(1-0.005*2*5),'Steady Mettle (3+ Mettle: 1% x 3) and Hushed Confession (0.5% x 2 per Mettle)');
  near(ratio(L,F[0],A[2]),1-0.02,'2 Mettle: Hushed only');
  near(inRatio(L,F[0]),(1-0.01*5*2)*(1-0.015*5),'on her: Velvet Feathers (2 allies with 3+ Mettle, 1% x 5 each) and Practised Smile (an ally at 5 Mettle, 1.5% x 5)');
  setUst(L,A[2],'mettle',4); setUst(L,v,'mettle',3); near(inRatio(L,F[0]),(1-0.15)*(1-0.075)*(1-0.03)*(1-0.03),'up to 3 allies; her own Mettle too');
  setUst(L,A[0],'mettle',4); setUst(L,v,'mettle',0); near(inRatio(L,F[0]),1-0.15,'Practised Smile only while an ally has 5');
});

test('Mirelle / Held the Gate: a control on an ally with 5 Mettle is removed, once every 8 s',()=>{
  const L=lab(H,S(['rw_1_1','rw_2_1','rw_3_1']),{foes:2,big:true,allies:1}), {v,F,A}=L; free(A[0]); setUst(L,A[0],'mettle',5);
  ccOn(F[0],A[0],'stunned',2); assert.equal(A[0].stunned,0,'freed at once'); ccOn(F[0],A[0],'stunned',2); assert.ok(A[0].stunned>0,'not twice inside 8 s');
  A[0].stunned=0; secs(7.6); ccOn(F[0],A[0],'fearT',2); assert.ok(A[0].fearT>0,'still locked at 7.6 s'); A[0].fearT=0; secs(0.5); ccOn(F[0],A[0],'fearT',2); assert.equal(A[0].fearT,0,'after 8 s, again');
  setUst(L,A[0],'mettle',4); secs(8.1); ccOn(F[0],A[0],'silencedT',2); assert.ok(A[0].silencedT>0,'only at 5 Mettle');
  free(v); setUst(L,v,'mettle',5); ccOn(F[0],v,'stunned',2); assert.equal(v.stunned,0,'herself too'); ccOn(F[0],v,'stunned',2); assert.ok(v.stunned>0,'once every 8 s');
});

test('Mirelle / Sillage: Lingering Scent, Heavy Base Note, Perfumed Air',()=>{
  const L=lab(H,S(['rw_2_2','rw_4_2','rw_9_3']),{foes:2,big:true,allies:1}), {v,F,A}=L; scentOn(L,A[0]); near(A[0].dmgBuffMul,1.28);
  secs(5.9); near(A[0].dmgBuffMul,1.28,'her bonus runs its 6 s'); secs(0.3); near(A[0].dmgBuffMul,1+0.28*0.5*1.15,'then a Sillage: half its strength, Heavy Base Note 5% x 3 more of it');
  near(A[0].dmgBuffT,5+1.5,'for 1 s x 5, Perfumed Air 0.3 s x 5 longer',0.05); secs(6.6); assert.ok(!(A[0].dmgBuffT>0),'then gone');
  A[0].dmgBuffMul=1.5; A[0].dmgBuffT=20; scentOn(L,A[0]); secs(6.2); near(A[0].dmgBuffMul,1.5,'a stronger buff already in the slot: hers did not land, no Sillage');
});

test('Mirelle / The Patron: Loyal Custom, House Favourite, Patron\'s Gift, Captain\'s Thanks, Repeat Custom',()=>{
  const L=lab(H,S(['rw_4_4','rw_5_4','rw_7_4','rw_10_4','rw_12_4','rw_8_4','rw_1_1']),{foes:2,big:true,allies:2}), {v,F,A}=L;
  weak(v,0.2); sc(L); v.hp=v.maxHp; assert.ok(!L.T.s.m.patron,'her buff on herself names no Patron');
  A[0].energy=0; scentOn(L,A[0]); assert.equal(L.T.s.m.patron,A[0],'the first ally she buffs is the Patron'); near(A[0].dmgBuffMul,1+0.28*1.09,'her buffs on it 3% x 3 stronger'); near(A[0].dmgBuffT,6+1.5,'and 0.5 s x 3 longer');
  near(A[0].energy,3,'Patron\'s Gift: 1 energy x 3 each buff'); A[1].energy=0; scentOn(L,A[1]); assert.equal(L.T.s.m.patron,A[0],'only the first'); near(A[1].dmgBuffMul,1.28); near(A[1].energy,0);
  const m0=A[0].maxHp; V.step(1); near(A[0].maxHp/m0,1.05,'Loyal Custom: 1% x 5 max HP'); setUst(L,A[0],'mettle',0); setUst(L,A[1],'mettle',0);
  near(ratio(L,A[0],F[0]),1.05,'House Favourite: 1% x 5 more damage'); near(ratio(L,A[1],F[0]),1,'not the others');
  A[0].hp=1; A[0].shield=0; V.hit(F[0],A[0],100,{kind:'true'}); assert.ok(!A[0].alive,'the Patron dies'); scentOn(L,A[1]); assert.equal(L.T.s.m.patron,A[1],'Repeat Custom: the next ally she buffs');
  assert.equal(ust(L,A[1],'mettle'),2+1,'with 1 Mettle x 2 (and the Scent\'s own)');
  V.wave(); V.step(1); assert.ok(!L.T.s.m.patron,'a new wave: no Patron');
});

test('Mirelle / Second Spray (PICK ONE) and Shared Courage; Full Bottle (PICK ONE) and Long Wear',()=>{
  const L=lab(H,S(['rw_5_2','rw_6_2','rw_1_1']),{foes:2,big:true,allies:2}), {v,F,A}=L; weak(A[0],0.3); weak(A[1],0.5); v.hp=v.maxHp; const h1=A[1].hp, sv=VMX('healFrom');
  sc(L); near(A[0].dmgBuffMul,1.28,'the weakest gets the Scent'); const k=0.6*1.15; near(A[1].dmgBuffMul,1+0.28*k,'the second-weakest a mist at 60% x 1.15 (Shared Courage 5% x 3)');
  assert.ok(A[1].hp>h1,'and its heal'); assert.equal(ust(L,A[1],'mettle'),1,'and Mettle'); V.step(1); assert.ok((A[1].shield||0)>0,'and Trail of Splendor (it received a buff)');
  const B=lab(H,S(['rw_5_3','rw_6_3']),{foes:2,big:true,allies:1}); B.A[0].hp=B.A[0].maxHp*0.3; sc(B); near(B.A[0].dmgBuffT,9,'Full Bottle: 3 s longer on its one ally');
  B.A[0].target=null; const h=B.A[0].hp; secs(2.0); const g=(B.A[0].hp-h)/(B.A[0].maxHp*0.012); assert.ok(Math.abs(g-2)<0.1,'Long Wear: 0.4% x 3 = 1.2% of its max HP a second while it lasts ('+g+')');
  secs(8.5); const h2=B.A[0].hp; secs(2); near(B.A[0].hp,h2,'not after');
});

test('Mirelle / Trail of Splendor: Lined Coat, Cheap Bottles, Master Perfumer; Sewn Lining and Thick Lining on a break',()=>{
  const L=lab(H,S(['rw_6_1','rw_6_4','rw_12_3','rw_7_2','rw_9_2','rw_1_1']),{foes:2,big:true,allies:1}), {v,F,A}=L; A[0].shield=0;
  scentOn(L,A[0]); V.step(1); near(A[0].shield,A[0].maxHp*0.04*v.passMul*1.15*(1+0.06+0.06),'Lined Coat 3% x 5, her buffs\' strength (Cheap Bottles 3% x 2, Master Perfumer 2% x 3)');
  near(A[0].dmgBuffMul,1+0.28*1.12,'her Scent\'s bonus too'); near(inRatio(L,F[0]),1.06,'Cheap Bottles: she takes 3% x 2 more');
  const m0=ust(L,A[0],'mettle'); A[0].hp=A[0].maxHp*0.5; const h=A[0].hp; V.hit(F[0],A[0],A[0].shield+10,{kind:'true'}); V.step(1);
  assert.equal(ust(L,A[0],'mettle'),m0+1,'Sewn Lining: the shield broke: 1 Mettle'); near(A[0].hp-(h-10),A[0].maxHp*(0.03+0.004*5),'and a heal of 3% + Thick Lining 0.4% x 5 of its max HP',1e-4);
  scentOn(L,A[0]); V.step(1); const m1=ust(L,A[0],'mettle'); secs(5.1); assert.ok(!(A[0].shield>0),'a shield that runs out'); assert.equal(ust(L,A[0],'mettle'),m1,'does not break');
});

test('Mirelle / Scent of Courage: Sweet Courage, Fine Atomizer, Shopkeeper\'s Eye, Quick Mist, Poise of Court, Light Step, Sweet Courage Too, Practised Pose, Courtly Bloom, Sought After',()=>{
  let base, s0; plain({foes:2,allies:1},P=>{ weak(P.A[0],0.3); base=gained(P.A[0],()=>sc(P)); weak(P.A[0],0.6); base=[base,gained(P.A[0],()=>sc(P))]; s0=P.v.speed; });
  const L=lab(H,S(['rw_2_3','rw_1_3','rw_10_3','rw_5_1','rw_1_4','rw_8_3','lp_9_4','he_8_2','he_9_2','he_10_2']),{foes:2,big:true,allies:1}), {v,F,A}=L;
  weak(A[0],0.3); near(gained(A[0],()=>sc(L))/base[0],(1.10)*(1.10)*(1.10)*(1.15),'heals 2% x 5 (three talents) more, and Shopkeeper\'s Eye 3% x 5 below 40% HP',1e-6);
  weak(A[0],0.6); near(gained(A[0],()=>sc(L))/base[1],1.1*1.1*1.1,'not above 40%',1e-6);
  near(A[0].dmgBuffMul,1+0.28*(1+0.06+0.05),'its Attack bonus: Sweet Courage 2% x 3, Courtly Bloom 1% x 5'); near(A[0].dmgBuffT,6.5,'Sought After: 0.1 s x 5 longer');
  near(v.speed/s0,1.10,'Light Step: 2% x 5 faster'); near(FX.cd(v,'green',7),6.5,'Quick Mist: 0.1 s x 5 sooner'); free(v); ccOn(F[0],v,'stunned',2); near(v.stunned,2*V.ccNerf*0.85,'Poise of Court: 5% x 3 shorter');
});

test('Mirelle / More Than a Minute Ago: an ally reaching 5 Mettle has her bonus doubled for 4 s, once a wave',()=>{
  const L=lab(H,S(['rw_9_1','rw_1_1']),{foes:2,big:true,allies:1}), {v,F,A}=L; setUst(L,A[0],'mettle',4);
  scentOn(L,A[0]); assert.equal(ust(L,A[0],'mettle'),5); const b=0.28, r0=ratio(L,A[0],F[0]);
  near(r0,(1+2*b)/(1+b)*(1+0.025*5),'its hits: the bonus doubled (and Behind the Ears)'); secs(3.9); near(ratio(L,A[0],F[0]),(1+2*b)/(1+b)*1.125,'for 4 s'); secs(0.2); near(ratio(L,A[0],F[0]),1.125,'then not');
  setUst(L,A[0],'mettle',4); scentOn(L,A[0]); near(ratio(L,A[0],F[0]),1.125,'once a wave per ally');
});

test('Mirelle / Imperial Plumage: Plumage of Courage, Full Tail of Courage; Rosewater for a Coward (SIGNATURE)',()=>{
  const L=lab(H,S(['rw_11_2','rw_12_2','rw_1_1','rw_4_4','rw_13_2']),{foes:2,big:true,allies:2}), {v,F,A}=L; for(const a of A.concat([v])) a.shield=0;
  ult(L); near(A[0].shield,A[0].maxHp*0.10*SM(10)*1.15,'Full Tail of Courage: its shields 3% x 5 larger'); near(A[0].shieldT,8,'Plumage of Courage: 2 s longer');
  assert.equal(ust(L,A[0],'mettle'),5,'the signature fills every ally to 5 Mettle'); assert.ok(L.T.s.mi.rwc>7.9,'and makes every ally her Patron for 8 s');
  assert.ok(L.T.fn.patSel(A_(L),L.T,v,{tgt:A[1]}),'A1 counts as the Patron'); weak(A[0],0.3); const h1=A[1].hp; sc(L); near(A[1].dmgBuffMul,1+0.28*1.09,'Scent of Courage mists the whole team, at full strength (every ally a Patron: 3% x 3)');
  assert.ok(A[1].hp>=h1); secs(8.1); assert.ok(!L.T.fn.patSel(A_(L),L.T,v,{tgt:A[1]}),'8 s');
  const B=lab(H,S(['rw_11_2','rw_1_1']),{foes:2,big:true,allies:1}); ult(B); assert.equal(ust(B,B.A[0],'mettle'),2,'Plumage of Courage alone: 2 Mettle');
});

/* ============================== LILY AND POPPY ============================== */
test('Mirelle / Languor: Sweet Note (the nap at 5), Slow Poppy, Heady Perfume, Calm Hands, Heavy Head, Breathing It In',()=>{
  const L=lab(H,S(['lp_1_2','lp_2_2','lp_1_4','lp_1_1','lp_12_2','lp_6_4']),{foes:2,big:true}), {v,F}=L, f=F[0]; free(f);
  for(let i=0;i<4;i++) V.hit(v,f,10,{auto:true,kind:'true'}); assert.equal(ust(L,f,'lang'),4,'each basic attack 1 Languor'); assert.equal(f.stunned,0);
  const i0=f.atkInterval; V.step(2); near(f.atkInterval/i0,1/(1-0.005*5*4),'0.5% x 5 slower attacks per stack',1e-6);
  near(ratio(L,v,f,{auto:true}),1.15,'Heady Perfume: her basics 3% x 5 more on an enemy with Languor');
});

test('Mirelle / Languor naps: the threshold, the length, the stun lock, twice in 10 s',()=>{
  const L=lab(H,S(['lp_1_2','lp_2_2','lp_12_2','lp_6_4','lp_1_1']),{foes:2,big:true}), {v,F}=L, f=F[0]; free(f);
  for(let i=0;i<5;i++) V.hit(v,f,10,{auto:true,kind:'true'}); const t0=V.now(), d=(0.6+0.3)*1.08; near(f.stunned,d,'at 5 it naps: 0.6 s + Heavy Head 0.06 s x 5, x Breathing It In 4% x 2'); near(f._sleepT,d,'a sleep (a hit wakes it)');
  assert.equal(ust(L,f,'lang'),0,'its Languor clears'); near(inRatio(L,f),1.04,'Calm Hands: no Languor, no cut (Breathing It In: 2% x 2 more taken)'); V.hit(v,f,10,{kind:'true'}); near(f._sleepT,0,'a hit wakes it');
  near(inRatio(L,f),1.04,'(still none)'); for(let i=0;i<5;i++) V.hit(v,f,10,{auto:true,kind:'true'}); assert.equal(f.stunned,0,'woken 0 s ago: the 0.5 s lock holds the nap'); assert.equal(ust(L,f,'lang'),5,'its Languor waits');
  near(inRatio(L,f),(1-0.02*3)*1.04,'Calm Hands: 2% x 3 less from an enemy with Languor'); secs(0.45); assert.equal(f.stunned,0,'not inside the 0.5 s'); secs(0.1); assert.ok(f.stunned>0,'after the lock the nap lands'); assert.equal(ust(L,f,'lang'),0);
  V.hit(v,f,10,{kind:'true'}); secs(0.6); for(let i=0;i<5;i++) V.hit(v,f,10,{auto:true,kind:'true'}); secs(0.1); assert.equal(f.stunned,0,'a third nap inside 10 s is refused');
  assert.equal(ust(L,f,'lang'),5,'its Languor kept'); let k=0; while(M_(L).nap[f.uid]&&M_(L).nap[f.uid].length>=2&&k++<500) V.step(1);
  const age=V.now()-t0; assert.ok(age>9.8&&age<10.2,'the first nap leaves the count 10 s after it ('+age.toFixed(2)+')'); for(let i=0;i<5;i++) V.hit(v,f,10,{auto:true,kind:'true'}); assert.ok(f.stunned>0,'then a nap lands again'); f.stunned=0; f._sleepT=0;
  const g=F[1]; free(g); g.stunned=0.3; for(let i=0;i<5;i++) V.hit(v,g,10,{auto:true,kind:'true'}); near(g.stunned,0.3,'never on a stunned enemy (not even to lengthen a short stun)'); assert.equal(ust(L,g,'lang'),5,'its Languor waits'); g.stunned=0; secs(0.6); assert.ok(g.stunned>0,'only once it is not (no lock: the stun was not hers)');
});

test('Mirelle / Heavy Eyelids (PICK ONE) and Snore; Restless Sleep (PICK ONE) and Fitful',()=>{
  const L=lab(H,S(['lp_1_2','lp_5_1','lp_6_1']),{foes:2,big:true}), {v,F}=L, f=F[0]; free(f);
  for(let i=0;i<5;i++) V.hit(v,f,10,{auto:true,kind:'true'}); assert.equal(f.stunned,0,'Heavy Eyelids: 6 stacks'); V.hit(v,f,10,{auto:true,kind:'true'}); near(f.stunned,1.0,'naps 0.6 + 0.4 s');
  secs(1.05); near(f.slowMul,1-0.15,'Snore: waking from it, slowed 5% x 3'); near(f.slow,2,'for 2 s',0.05);
  const B=lab(H,S(['lp_1_2','lp_5_3','lp_6_3']),{foes:2,big:true}), g=B.F[0]; free(g); for(let i=0;i<3;i++) V.hit(B.v,g,10,{auto:true,kind:'true'}); assert.equal(g.stunned,0);
  setUst(B,g,'lang',4); g.energy=50; V.step(1); near(g.stunned,0.4,'Restless Sleep: 4 stacks, naps 0.2 s shorter',0.1); near(g.energy,50-6,'Fitful: each nap takes 2 energy x 3');
});

test('Mirelle / Dream Debt: Bad Dreams, Long Night\'s Dream, Dreamer\'s Debt, Waking Scream, Dream Thief, Sleepwalker\'s Bruise',()=>{
  const L=lab(H,S(['lp_2_3','lp_4_3','lp_8_1','lp_9_1','lp_10_3','lp_6_2']),{foes:3,big:true,allies:1}), {v,F,A}=L, f=F[0];
  free(f); sleepOn(f); V.step(1); const a=dmgOn(A[0],f,1000); near(a,1000*1.05,'Sleepwalker\'s Bruise: a hit on a sleeper 1% x 5 more'); assert.equal(f._sleepT,0,'and it wakes');
  const mag=VMX('defMul')(v,f,'magic'), h=f.hp; V.step(1); near(h-f.hp,1050*0.30*1.06*mag,'when it wakes: 6% x 5 of the Debt strikes as magic damage, Dreamer\'s Debt 2% x 3 above 50% HP');
  near(v.energy,6,'Dream Thief: 2 energy x 3');
  at(L,F[1],4.5,5.0); at(L,F[2],4.5,10); free(f); sleepOn(f); V.step(1); dmgOn(A[0],f,1000); const h1=F[1].hp, h2=F[2].hp; V.step(1);
  near(h1-F[1].hp,0.5*1050*0.30*1.06*mag,'Waking Scream: half of it on each enemy within 2 m'); near(h2-F[2].hp,0,'not farther');
  free(f); f.maxHp=f.hp=1e10; sleepOn(f); V.step(1); dmgOn(A[0],f,7e9); const h3=f.hp; V.step(1); near(h3-f.hp,1e10*0.5*1.3*0.30*mag,'it holds at most 50% x 1.3 of the sleeper\'s max HP (Long Night\'s Dream 10% x 3); below 50% HP no Dreamer\'s Debt',1e-6);
  free(f); f.hp=f.maxHp; sleepOn(f); V.step(1); VMX('pushDot')(f,500,3,1,'#8f8fa8',A[0],'true'); secs(1.05); assert.ok(L.T.s.mi.slp[f.uid].debt>0,'a DoT tick of her team on a sleeper is written too (and does not wake it)');
});

test('Mirelle / Courage in a Dream (LINK): an ally with 5 Mettle hits sleepers and charmed enemies harder; with Bad Dreams, more Debt',()=>{
  const L=lab(H,S(['rw_n1','rw_1_1','lp_2_3']),{foes:2,big:true,allies:1}), {v,F,A}=L, f=F[0]; setUst(L,A[0],'mettle',5); free(f);
  sleepOn(f); V.step(1); const a=dmgOn(A[0],f,1000); near(a,1000*1.04*1.125,'4% more on a sleeper (and Behind the Ears 0.5% x 5 x 5)'); near(L.T.s.mi.slp[f.uid].debt,a*1.25,'with Bad Dreams: 25% more into its Debt');
  V.step(1); L.T.s.mi.ch[F[1].uid]=3; near(ratio(L,A[0],F[1]),1.04*1.125,'on a charmed enemy'); setUst(L,A[0],'mettle',4); near(ratio(L,A[0],F[1]),1+0.025*4,'only at 5 Mettle');
  const B=lab(H,S(['rw_n1','rw_1_1']),{foes:2,big:true,allies:1}); setUst(B,B.A[0],'mettle',5); free(B.F[0]); sleepOn(B.F[0]); V.step(1); dmgOn(B.A[0],B.F[0],1000); assert.ok(!(B.T.s.mi.slp[B.F[0].uid]&&B.T.s.mi.slp[B.F[0].uid].debt>0),'without Bad Dreams no Debt');
});

test('Mirelle / Soporific Bouquet: Strong Bouquet, Breathing It In, Night Blossom, Deep Slumber, Second Bouquet, Heavier Bouquet, Lily Scent, Gentle Throw',()=>{
  const L=lab(H,S(['lp_4_1','lp_6_4','lp_5_2','lp_1_2','lp_2_2','lp_3_2','lp_7_3','lp_9_3','lp_3_1','lp_2_4']),{foes:3,big:true}), {v,F}=L, f=F[0];
  free(f); F[1].energy=40; F[2].energy=20; bq(L,f); near(f.stunned,V.cap('stunned')*1.08+0.3,'what it really lasts (2.8 s) x Breathing It In 4% x 2, + Strong Bouquet 0.1 s x 3 (past the 2.8 s ceiling)'); near(f._sleepT,5);
  assert.equal(ust(L,F[1],'lang'),3,'Second Bouquet: the second-highest-energy enemy gains 3 Languor');
  f.stunned=0; f._sleepT=0; V.step(1); assert.equal(ust(L,f,'lang'),5,'Deep Slumber: it wakes with 5 Languor'); assert.equal(f.stunned,0,'(the 0.5 s lock)'); secs(0.55); assert.ok(f.stunned>0,'then it naps');
  secs(8.8); assert.equal(ust(L,F[1],'lang'),3,'Heavier Bouquet: they last 5 s + Slow Poppy 1 s x 3 + 0.4 s x 5'); secs(1.0); assert.equal(ust(L,F[1],'lang'),0);
  near(FX.cd(v,'blue',10),9.25,'Night Blossom: 0.15 s x 5 sooner'); near(ratio(L,v,F[2],{kind:'magic'}),1.10,'Lily Scent: 2% x 5 more magic damage');
  const P0=lab(H,null,{foes:1}).v.range; const L2=lab(H,S(['lp_2_4']),{foes:1}); near(L2.v.range/P0,1.09,'Gentle Throw: 3% x 3 longer range');
  const B=lab(H,S(['lp_4_1']),{foes:2,big:true}); free(B.F[0]); bq(B,B.F[0]); near(B.F[0].stunned,V.cap('stunned')+0.3,'Strong Bouquet alone: + 0.3 s');
});

test('Mirelle / Lull: Heavy Air, Thick Air, Lullaby, Unbothered, Yawn, Dressed for Court, Rest Easy, Sound Sleep, Drowsy Court, Sleep It Off',()=>{
  const L=lab(H,S(['lp_4_4','lp_8_2','lp_11_4','lp_8_4','lp_7_4','lp_11_1','lp_10_2','lp_10_4','lp_1_2','lp_12_4']),{foes:4,big:true,allies:1}), {v,F,A}=L, f=F[0];
  const a0=v.armorRating; sleepOn(f,99); f.stunned=1e6; V.step(2); assert.ok(L.T.s.mi.lul[F[1].uid],'F1 (1.5 m from the sleeper) is Lulled'); assert.ok(!L.T.s.mi.lul[F[3].uid],'F3 (3.5 m) is not'); assert.ok(!L.T.s.mi.lul[f.uid],'not the sleeper');
  near(v.armorRating/a0,1.10,'Dressed for Court: 2% x 5 armor while an enemy sleeps');
  near(ratio(L,F[1],A[0]),1-0.03,'Lullaby: a Lulled enemy deals 0.6% x 5 less to her allies'); near(inRatio(L,F[1]),(1-0.03)*(1-0.075),'and to her, with Unbothered 1.5% x 5');
  secs(2.0); assert.equal(ust(L,F[1],'lang'),2,'Yawn: 1 Languor x 2 every 2 s Lulled'); near(ratio(L,F[1],A[0]),1-0.03,'2 Languor: not Drowsy Court'); setUst(L,F[1],'lang',3); near(ratio(L,F[1],A[0]),(1-0.03)*(1-0.06),'Drowsy Court: 2% x 3 less from an enemy with 3+ Languor');
  v.hp=v.maxHp*0.5; v.target=null; const h=v.hp; secs(3.0); const g=(v.hp-h)/(0.012*v.maxHp); assert.ok(Math.abs(g-3)<0.1,'Rest Easy: 0.24% x 5 = 1.2% of her max HP a second while an enemy sleeps ('+g+')');
  f.hp=f.maxHp*0.5; const hf=f.hp; V.heal(f,1000); near(f.hp-hf,1000*0.90,'Sound Sleep: a sleeping enemy receives 2% x 5 less healing');
  A[0].shield=0; scentOn(L,A[0]); V.step(1); near(A[0].shield,A[0].maxHp*0.04*v.passMul*1.08,'Sleep It Off: Trail of Splendor shields 4% x 2 larger');
  f._sleepT=0; f.stunned=1e6; V.step(2); assert.ok(!L.T.s.mi.lul[F[1].uid],'no sleeper: no Lull'); const C=lab(H,S(['lp_4_4','lp_5_4']),{foes:4,big:true}); sleepOn(C.F[0],99); C.F[0].stunned=1e6; V.step(2); assert.ok(C.T.s.mi.lul[C.F[3].uid],'Thick Air: 0.4 m x 3 farther');
  const i0=C.F[3].atkInterval; C.F[0]._sleepT=0; V.step(2); near(i0/C.F[3].atkInterval,1/(1-0.05),'Heavy Air: Lulled enemies attack 1% x 5 slower',1e-6);
});

test('Mirelle / Plumage of Poppies, Poppy Haze; The Whole Field Sleeps (SIGNATURE)',()=>{
  const L=lab(H,S(['lp_11_3','lp_12_3','lp_13_3','lp_2_3','lp_1_2']),{foes:3,big:true,allies:1}), {v,F,A}=L; F.forEach(free);
  ult(L); for(const f of F){ near(f.stunned,1.5,'every charmed enemy also falls asleep for 1.5 s'); assert.equal(ust(L,f,'lang'),4,'and gains 4 Languor'); }
  assert.ok(L.T.s.mi.slp[F[0].uid].grp,'their Debts are held together'); V.step(1); assert.ok(L.T.s.mi.lul[F[1].uid],'Lull spreads from charmed enemies while the charm lasts (F1 is 1.5 m from F0)');
  const hA=F[0].hp; dmgOn(A[0],F[0],1000); V.step(1); dmgOn(A[0],F[1],2000); V.step(1);
  assert.ok(!(L.T.s.mi.slp[F[0].uid]),'F0 woke'); near(hA-F[0].hp,1000,'its Debt has not struck yet: they strike together');
  const h0=F[0].hp, h1b=F[1].hp; F[2]._sleepT=0; F[2].stunned=0; V.step(1); const mag=VMX('defMul')(v,F[0],'magic');
  near(h0-F[0].hp,1000*0.30*mag,'when the last wakes, every Debt strikes at once (Bad Dreams 6% x 5)'); near(h1b-F[1].hp,2000*0.30*mag);
  secs(7.4); assert.equal(ust(L,F[1],'lang'),4,'Poppy Haze: that Languor lasts 5 s + 0.6 s x 5'); secs(0.8); assert.equal(ust(L,F[1],'lang'),0);
  const B=lab(H,S(['lp_13_3']),{foes:2,big:true}); ult(B); assert.ok(B.F[0].stunned>1e5,'never on a stunned enemy (a held lab enemy)'); assert.ok(B.F[0]._shredPct>0,'the charm itself stays');
});

/* ============================== THE HUNDRED EYES ============================== */
test('Mirelle / Eyes: First Eye, Court Manners, Wide Gaze, Watchful Tail, Unblinking, Eyes Everywhere, Season\'s Display',()=>{
  const L=lab(H,S(['he_1_4','he_1_1','he_2_4','he_4_4','he_8_4','he_10_4','he_11_3']),{foes:2,big:true,allies:1}), {v,F,A}=L;
  V.hit(F[0],v,1,{kind:'true'}); assert.equal(stack(L,'eye'),4,'the first enemy attack this wave: 1 Eye + 1 x 3 (Court Manners)'); V.hit(F[1],v,1,{kind:'phys'}); assert.equal(stack(L,'eye'),5,'each attack after: 1'); v.energy=0; V.step(1); v.energy=10; V.step(1); near(v.energy,10,'Season\'s Display: not before full Eyes');
  const a0=v.apow; near(inRatio(L,F[0]),1-0.015*6,'0.3% x 5 per Eye (its own attack opens the 6th first)'); for(let i=0;i<20;i++) V.hit(F[0],v,1,{kind:'true'}); assert.equal(stack(L,'eye'),16,'at most 10 + 2 x 3 (Wide Gaze)');
  V.step(1); near(v.apow/a0,(1+0.01*16)/(1+0.01*5),'Watchful Tail: 0.2% x 5 ability power per Eye (16 now, 5 before)',1e-6); near(ratio(L,F[0],A[0]),1-0.003*16,'Eyes Everywhere: every ally 0.1% x 3 per Eye');
  v.energy=0; V.step(1); v.energy=10; V.step(1); near(v.energy,10*1.15,'Season\'s Display: 15% more energy at full Eyes (being hit gives her energy too: measured from 0)');
  V.wave(); V.step(1); assert.equal(stack(L,'eye'),3,'a new wave: Unblinking keeps 1 x 3');
});

test('Mirelle / Hundredfold, Full Display, Court Favourite',()=>{
  const L=lab(H,S(['he_1_4','he_8_4','he_9_4','he_3_4','he_2_4','he_12_2']),{foes:2,big:true,allies:1}), {v,F,A}=L; setStack(L,'eye',9);
  V.hit(F[0],v,1,{kind:'true'}); assert.ok(!(F[0].slow>0),'not at 9 of 10 Eyes'); setStack(L,'eye',16); V.hit(F[0],v,1,{kind:'true'}); near(F[0].slowMul,0.9,'Hundredfold: at full Eyes an attacker is slowed 10%'); near(F[0].slow,2,'for 2 s');
  F[0].slow=0; F[0].slowMul=1; V.hit(F[0],v,1,{kind:'true'}); assert.ok(!(F[0].slow>0),'once every 4 s per enemy'); secs(3.5); V.hit(F[0],v,1,{kind:'true'}); assert.ok(!(F[0].slow>0),'still at 3.5 s'); secs(0.55); V.hit(F[0],v,1,{kind:'true'}); assert.ok(F[0].slow>0);
  setStack(L,'eye',4); A[0].shield=0; ult(L); assert.equal(stack(L,'eye'),16,'Full Display: Imperial Plumage opens every Eye'); near(A[0].shield,A[0].maxHp*0.10*SM(10)*(1+0.02*16),'its shields 2% larger per open Eye');
  V.step(1); v.shield=0; v.shieldT=0; v.hp=v.maxHp*0.6; V.step(1); v.hp=v.maxHp*0.45; V.step(1); near(v.shield,v.maxHp*0.004*3*16,'Court Favourite: under half, every open Eye shields her 0.4% x 3 of her max HP'); near(v.shieldT,4,'for 4 s',0.05);
  v.shield=0; v.hp=v.maxHp*0.6; V.step(1); v.hp=v.maxHp*0.45; V.step(1); near(v.shield,0,'once a wave');
});

test('Mirelle / Preen: A Moment to Primp, Primped, Fresh Powder, Heavy Jewels, Little Mirror, Effortless, Fair Copy',()=>{
  let base; plain({foes:2,allies:2},P=>{ weak(P.A[0],0.3); base=gained(P.A[0],()=>sc(P)); });
  const L=lab(H,S(['he_4_1','he_5_1','he_7_1','he_6_1','he_8_1','he_12_1','he_10_1']),{foes:2,big:true,allies:2}), {v,F,A}=L;
  secs(2.4); assert.ok(!L.T.s.mi.pre,'not yet at 2.4 s'); secs(0.15); assert.ok(L.T.s.mi.pre,'Primped: Preened after 4 s - 0.3 s x 5 untouched'); near(v.energy,6,'Little Mirror: 3 energy x 2');
  near(inRatio(L,F[0]),1-0.09,'Effortless: 3% x 3 less while Preened'); assert.ok(!L.T.s.mi.pre,'a hit that lands ends it'); secs(2.6);
  weak(A[0],0.3); weak(A[1],0.5); v.hp=v.maxHp*0.6; const hv=v.hp, k=1.15*1.08; near(gained(A[0],()=>sc(L))/base,k,'her next Scent heals 5% x 3 more, x Heavy Jewels 4% x 2',1e-6);
  near(A[0].dmgBuffMul,1+0.28*k,'and its bonus'); near(v.hp-hv,v.maxHp*0.025,'Fresh Powder: she heals 0.5% x 5 of her max HP'); near(A[1].dmgBuffMul,1+0.28*k*0.6,'Fair Copy: the second-weakest gets a mist at 20% x 3');
  assert.ok(!L.T.s.mi.pre,'spent'); weak(A[0],0.3); weak(A[1],0.5); sc(L); near(A[0].dmgBuffMul,1+0.28*k,'(the slot keeps the stronger)'); assert.ok(!(L.T.s.mi.prS));
  const s0=lab(H,null,{foes:1}).v.speed, B=lab(H,S(['he_6_1']),{foes:1}); near(B.v.speed/s0,0.90,'Heavy Jewels: 5% x 2 slower');
  const C=lab(H,S(['he_4_1']),{foes:2,big:true}), f=C.F[0]; free(f); secs(4.1); bq(C,f); near(f.stunned,V.cap('stunned')*1.15,'a Preened Bouquet: its sleep 15% longer');
});

test('Mirelle / Admirers: Smitten, Lovestruck, Admired, Vain Strength, Center of the Room, Bright Plumes, Showstopper, Season\'s Display',()=>{
  const L=lab(H,S(['he_2_3','he_4_3','he_6_4','he_12_4','he_11_4','he_2_2','he_11_3','he_12_3']),{foes:4,big:true,allies:1}), {v,F,A}=L; const a0=F[0].armorRating, m0=v.maxHp;
  ult(L); for(const f of F) assert.ok(mark(L,f,'adm'),'every enemy it charms is an Admirer'); near(F[0]._shredT,6+0.9+0.5,'Bright Plumes 0.3 s x 3 longer, Showstopper 0.1 s x 5 more on the enemies');
  V.step(1); near(F[0].armorRating/a0,0.94,'Lovestruck: Admirers 2% x 3 less armor'); near(ratio(L,F[0],A[0]),1-(0.05+0.01),'Smitten: 1% x 5 less to her team, Vain Strength + 0.5 points x 2');
  near(inRatio(L,F[0]),(1-0.06)*(1-0.05),'to her too, with Admired 1% x 5'); near(v.maxHp/m0,1+0.05*2,'Center of the Room: 4 Admirers, 2 steps of 1% x 5');
  secs(7.5); assert.ok(mark(L,F[0],'adm'),'Admirers for the rest of the wave'); const t1=F[0]._shredT; ult(L); near(F[0]._shredT,Math.max(t1,6.9)+0.5+2,'Season\'s Display: an Admirer it touches is charmed again, 2 s longer (a held lab enemy\'s own timers stand still)');
  const B=lab(H,S(['he_4_3']),{foes:2,big:true}), b0=B.F[0].armorRating; ult(B); V.step(2); near(B.F[0].armorRating/b0,0.94,'Lovestruck: Admirers 2% x 3 less armor');
  const C=lab(H,S(['he_11_4']),{foes:5,big:true}), c0=C.v.maxHp; ult(C); V.step(2); near(C.v.maxHp/c0,1+0.05*2,'Center of the Room: 1% x 5 max HP for every 2 Admirers (5 Admirers: 2 steps)');
});

test('Mirelle / Grace (PICK ONE) and Swan\'s Bearing; Vanity (PICK ONE) and Mirror Gaze',()=>{
  const L=lab(H,S(['he_5_2','he_6_2','he_2_3']),{foes:3,big:true,allies:1}), {v,F,A}=L; for(const f of F) f._shredPct=0; A[0].shield=0;
  ult(L); hold(A[0]); hold(v); A[0].target=null; near(A[0].shield,A[0].maxHp*0.10*SM(10)*1.2,'Grace: shields 20% larger');
  /* the Plumage's cleanse frees the held lab units: held again (else the ally attacks a Tank and the game's own +20% healing applies) */ assert.ok(!(F[2]._shredPct>0)&&!mark(L,F[2],'adm'),'the enemy farthest from her is not charmed'); assert.ok(F[0]._shredPct>0&&mark(L,F[0],'adm'));
  A[0].hp=A[0].maxHp*0.5; A[0].target=null; const h=A[0].hp; secs(2.0); const g=(A[0].hp-h)/(0.012*A[0].maxHp); assert.ok(Math.abs(g-2)<0.1,'Swan\'s Bearing: 0.4% x 3 = 1.2% a second while that shield holds ('+g+')');
  A[0].shield=0; secs(1.1); const h2=A[0].hp; secs(2); near(A[0].hp,h2,'not once it is gone');
  const B=lab(H,S(['he_5_3','he_6_3','he_2_3']),{foes:3,big:true,allies:1}); B.F[1].dmg*=2; B.A[0].shield=0; ult(B); near(B.A[0].shield,B.A[0].maxHp*0.10*SM(10)*0.8,'Vanity: shields 20% smaller');
  near(B.F[1]._atkDnPct,0.40,'the enemy with the highest Attack is charmed twice over: its Attack cut doubled'); near(B.F[0]._atkDnPct,0.20); const i0=B.F[0].atkInterval; V.step(2); near(i0/B.F[0].atkInterval,1-0.06,'Mirror Gaze: Admirers 2% x 3 slower',1e-6);
  secs(6.2); near(B.F[1]._atkDnPct,0.20,'the doubled cut is given back when the charm ends (the engine keeps its strongest value)');
});

test('Mirelle / Turned Heads and Captivated; Velvet Voice, Unruffled, Fan of Eyes',()=>{
  const L=lab(H,S(['he_7_3','he_9_3','he_7_4','he_11_1','he_5_4']),{foes:3,big:true,allies:1}), {v,F,A}=L;
  V.hit(F[2],v,1,{kind:'true'}); V.hit(F[2],v,1,{kind:'true'}); V.hit(F[1],v,1,{kind:'true'}); assert.equal(FX.skillTgt(v,'sleepbouquet',F[0],{}),F[2],'Turned Heads: the enemy that opened the most Eyes this wave');
  const f=F[2]; free(f); V.cast(v,'blue',f); near(f.stunned,V.cap('stunned')+0.4,'Captivated: its sleep 0.08 s x 5 longer'); assert.ok(mark(L,f,'adm'),'and it becomes an Admirer');
  near(FX.cd(v,'blue',10),9.25,'Velvet Voice: 0.15 s x 5 sooner'); near(inRatio(L,F[0],{kind:'magic'}),1-0.075,'Unruffled: 1.5% x 5 less magic damage'); near(inRatio(L,F[0],{kind:'phys'}),1);
  A[0].shield=0; scentOn(L,A[0]); V.step(1); near(A[0].shield,A[0].maxHp*0.04*v.passMul*1.15,'Fan of Eyes: Trail of Splendor shields 3% x 5 larger');
});

test('Mirelle / Every Eye in Sayle (SIGNATURE): at full Eyes every enemy is an Admirer, cannot pick her for 4 s, and she stays Preened 8 s',()=>{
  const L=lab(H,S(['he_13_3','he_1_4','he_4_1']),{foes:3,big:true,allies:1}), {v,F,A}=L; setStack(L,'eye',9); ult(L); assert.ok(!mark(L,F[0],'eis'),'not without full Eyes');
  setStack(L,'eye',10); ult(L); for(const f of F){ assert.ok(mark(L,f,'adm')&&mark(L,f,'eis'),'every enemy'); }
  free(F[0]); V.step(1); assert.notEqual(F[0].target,v,'its basic attacks cannot pick her'); F[0].stunned=1e6; assert.ok(L.T.s.mi.pre,'Preened');
  V.hit(F[1],v,1,{kind:'true'}); assert.ok(L.T.s.mi.pre,'no matter who hits her'); weak(A[0],0.3); sc(L); weak(A[0],0.3); sc(L); assert.ok(L.T.s.mi.pre,'and each spell in the 8 s is Preened');
  secs(4.05); assert.ok(!mark(L,F[0],'eis'),'4 s'); secs(4); V.hit(F[1],v,1,{kind:'true'}); assert.ok(!L.T.s.mi.pre,'after 8 s a hit ends it');
});

/* ============================== CAPS ============================== */
test('Mirelle: the caps - her damage reduction at most 40% (one group), her allies\' at most 15%, healing a second at most 1.2%',()=>{
  const all=S(['rw_3_3','rw_2_1','rw_12_1','rw_11_1','rw_1_1','lp_1_1','lp_11_4','lp_4_4','lp_8_2','lp_10_4','he_1_4','he_2_4','he_6_4','he_2_3','he_12_4','he_11_1','he_12_1','he_4_1','he_10_4']);
  const L=lab(H,all,{foes:3,big:true,allies:3}), {v,F,A}=L, f=F[0]; for(const a of A.concat([v])) setUst(L,a,'mettle',5); setStack(L,'eye',16); setUst(L,f,'lang',4); setMk(L,f,'adm'); L.T.s.mi.lul[f.uid]=1; L.T.s.mi.pre=true;
  const raw=[0.85,0.97,0.95,0.955,0.94,0.94,0.925,0.97,0.95,0.94,0.76,0.95,0.925,0.91].reduce((a,b)=>a*b,1); assert.ok(raw<0.5,'the conditions together would take '+(100*(1-raw)).toFixed(0)+'%');
  L.T.s.mi.lul[f.uid]=1; near(inRatio(L,f,{kind:'magic'}),0.60,'together at most 40% off a hit on her');
  L.T.s.mi.lul[f.uid]=1; near(ratio(L,f,A[0]),0.85,'her allies: at most 15%');
  const B=lab(H,S(['rw_5_3','rw_6_3','he_5_2','he_6_2','lp_11_1']),{foes:2,big:true,allies:1}); B.v.maxHp=B.A[0].maxHp; B.v.hp=B.v.maxHp*0.3; sleepOn(B.F[0]); B.F[0]._sleepT=99; sc(B); ult(B); for(const x of [B.v,B.A[0]]){ hold(x); x.target=null; } B.F[0].stunned=1e6;
  B.v.hp=B.v.maxHp*0.3; B.v.target=null; const h=B.v.hp; secs(3.0); const g=(B.v.hp-h)/(0.012*B.v.maxHp); assert.ok(Math.abs(g-3)<0.1,'Long Wear + Swan\'s Bearing + Rest Easy on one unit: 1.2% a second together ('+g+')');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Mirelle: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['rw_1_1','rw_2_2','rw_4_4','rw_7_2','lp_1_2','lp_2_3','lp_4_4','he_1_4','he_2_3','he_4_1','lp_3_2','lp_2_2']), TEAM=['vael','sylthaine','vireo','vex','mirelle'];
  let met=0, eye=0, lang=0, naps=0, debt=0, adm=0, pre=0; const MF=FX.mech(H).fn, st0=MF.strike; MF.strike=function(A,T,u,x,d){ if(d>0) debt++; return st0.apply(this,arguments); };
  try{
  for(const seed of [4,7,11,23]){ const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),seed), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
    for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const m=s._tal.s.mi; if(!m) continue; if(m.pre) pre++; eye=Math.max(eye,s._tal.s.k.eye?s._tal.s.k.eye.n:0);
      for(const x of units()){ const o=x._talM&&x._talM[s.uid]; if(!o) continue; if(x.team===s.team&&o['#mettle']) met=Math.max(met,o['#mettle'].v); if(x.team!==s.team){ if(o['#lang']) lang++; if(o.adm) adm++; } }
      for(const k in m.slp){ if(m.slp[k].kind==='nap') naps++; } } } } finally{ MF.strike=st0; }
  console.log('  live fights: max Mettle '+met+', max Eyes '+eye+', Languor enemy-ticks '+lang+', nap sleeper-ticks '+naps+', Dream Debt strikes '+debt+', Admirer enemy-ticks '+adm+', Preened ticks '+pre);
  assert.ok(met>0,'real Mettle'); assert.ok(eye>0,'real Eyes'); assert.ok(lang>0,'real Languor'); assert.ok(adm>0,'real Admirers'); assert.ok(pre>0,'a real Preen'); assert.ok(debt>0,'a real Dream Debt');
  determinism(H,TEAM);
});

/* The page sites her talents added (Trail of Splendor's num line, the stamp line before a hit wakes a sleeper): with nothing learned, whole seeded fights with
   Mirelle in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){} return h; }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Mirelle: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['mirelle','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __miN={spl:0,slpHit:0,sc:0,bq:0,ult:0}; var __miD=_doEffectCore, __miC=_dealDamageCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="mirelle"){ if(type==="healbuff") __miN.sc++; if(type==="sleepbouquet"&&o&&o._arrived) __miN.bq++; if(type==="plumage"&&o&&o._arrived) __miN.ult++; } return __miD.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt){ if(tgt&&(tgt._sleepT||0)>0) __miN.slpHit++; return __miC.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__miN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.sc>0&&c.bq>0&&c.ult>0&&c.slpHit>0,'the fights cast Scent of Courage ('+c.sc+': Trail of Splendor\'s line), slept enemies with the Bouquet ('+c.bq+'), opened Imperial Plumage ('+c.ult+') and hit sleepers ('+c.slpHit+': the stamp line)'); }
  finally{ VMX('_doEffectCore=__miD; _dealDamageCore=__miC;'); }
  assert.ok(n>=18);
});

/* a legal 91-point build in one tree that learns those goals first (and the rows below them), then the lowest rows it can */
function goalBuild(ti,goals){ let b={r:{}}; const meta=id=>T.talent(H,id), pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, G=[];
  for(const id of goals) for(const x of pre(id).concat([id])) if(G.indexOf(x)<0) G.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=G.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100)); if(id){ b=T.learn(H,b,id,100).build; continue; }
    const pool=T.trees(H)[ti].talents.filter(t=>T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; }
  assert.equal(T.invalid(H,b,100),'','a legal build'); return b; }
/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. Her talent reductions are one capped group (40%).
   Each candidate build is 91 points legal; the most defensive is the one whose worst hit is reduced most. The RISK talents (more damage taken) are left out. */
const DEF={ rw:['rw_3_3','rw_2_1','rw_12_1','rw_11_1','rw_11_4','rw_1_1','rw_10_1'],
            lp:['lp_1_1','lp_11_4','lp_10_4','lp_8_2','lp_4_4','lp_7_4','lp_3_4','lp_1_2'],
            he:['he_1_4','he_2_4','he_6_4','he_2_3','he_12_4','he_11_1','he_12_1','he_3_1','he_4_1','he_1_2','he_8_4'] };
const RISK=['rw_6_4','lp_6_4','he_6_1'];
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={rw:0,lp:1,he:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; }
      const pool=T.trees(H)[ti].talents.filter(t=>RISK.indexOf(t[0])<0&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>RISK.indexOf(t[0])<0&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]}),spec('vael',100,null,0),spec('vael',100,null,0),spec('vael',100,null,0)]),snaps([0,1,2,3,4].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+(4.5+5.5*i)*V.METER; f.y=v.y; }); A.forEach((a,i)=>{ a.x=v.x; a.y=v.y-(5.5+5.5*i)*V.METER; }); V.step(2); return {v,F,A,T:v._tal}; }
/* the worst hit on her: every condition of her damage-reduction talents true at once - 3 allies and herself at 5 Mettle, full Eyes, the attacker with 4 Languor,
   Lulled and an Admirer, Preened, a magic hit for Unruffled. Normal and critical, physical and magic. */
function worstHit(list,kind,crit){ const L=lab100(list), {v,F,A}=L, f=F[0]; v.maxHp=1e6; v.hp=0.5*v.maxHp; v.shield=0;
  if(L.T){ const s=L.T.s, m=s.mi; for(const a of A.concat([v])){ const M=a._talM||(a._talM={}), o=M[v.uid]||(M[v.uid]={}); o['#mettle']={v:5,until:Infinity}; }
    if(L.T.st.eye) s.k.eye=Object.assign(s.k.eye||{},{n:16,t:99,idle:0}); const M=f._talM||(f._talM={}), o=M[v.uid]||(M[v.uid]={}); o['#lang']={v:4,until:Infinity}; o.adm={t0:V.now(),until:null,v:0};
    if(m){ m.lul[f.uid]=1; m.pre=true; } }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:true}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Mirelle: her most defensive legal 91-point build never takes 95% off a hit, never sits at that ceiling, and is at 85% or more for less than half a fight',()=>{
  const cands=[[['he','rw'],[61,30]],[['rw','he'],[61,30]],[['he','lp'],[61,30]],[['lp','he'],[61,30]],[['rw','lp'],[61,30]],[['lp','rw'],[61,30]],[['he'],[91]],[['rw'],[91]],[['lp'],[91]],[['he','rw','lp'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="mirelle"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="mirelle"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys"):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic"):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=list=>{ VMX('for(const k in __dr) __dr[k]=0'); const sn=snaps(['vael','sylthaine','vireo','vex','mirelle'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>40&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.equal(d.imm,0,'and she is never immune');
    assert.ok(d.te85<0.5*d.t,'at 85% or more for less than half of her time in the fights ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* The stun-lock rule in real fights: her talent sleeps (Languor naps, The Whole Field Sleeps) never land on a stunned enemy or inside the 0.5 s after a stun or
   sleep of hers ended; the longest time one enemy spent stunned in a row while a stun of hers held it, over 8 seeded fights with every Lily and Poppy talent. */
test('Mirelle: the longest sleep chain on one enemy in seeded fights, and no talent sleep inside the lock',()=>{
  const list=T.learned(H,goalBuild(1,['lp_13_3','lp_1_2','lp_12_2','lp_6_4','lp_5_3','lp_6_3','lp_3_2','lp_7_3','lp_4_1','lp_2_3','lp_11_3']));
  assert.ok(list.some(e=>e[0]==='lp_13_3')&&list.some(e=>e[0]==='lp_1_2'),'the build has Sweet Note and the signature');
  VMX('var __sc={naps:0,sig:0,bad:0,run:{},max:0}; var __scU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ const r=__scU.apply(this,arguments); for(const u of units){ if(u.key!=="mirelle"||!u._tal||!u._tal.s.mi) continue; const m=u._tal.s.mi;'+
    '  for(const e of units){ if(e.team===u.team) continue; const k=e.uid; if(e.alive&&(e.stunned||0)>0&&m.myS[k]){ __sc.run[k]=(__sc.run[k]||0)+dt; if(__sc.run[k]>__sc.max) __sc.max=__sc.run[k]; } else if(!((e.stunned||0)>0)) __sc.run[k]=0; } } return r; };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','mirelle'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const c=VMX('__sc'); console.log('  sleep chain: the longest time one enemy spent stunned in a row while a stun or sleep of hers held it '+c.max.toFixed(2)+' s');
    assert.ok(c.max>0,'her sleeps held enemies'); assert.ok(c.max<=4.0+0.05,'never past 4.0 s in a row ('+c.max.toFixed(2)+' s)'); }
  finally{ VMX('_updateBattleCore=__scU;'); }
});
