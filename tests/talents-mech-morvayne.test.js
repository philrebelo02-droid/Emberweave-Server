'use strict';
/* Morvayne's talents (game key 'hero61') as data on the mechanics layer (talents-mech/hero61.js), family by family on the still field (tests/talents-lab.js),
   then the caps, the wave clock, whole-fight determinism, the no-talent identity and Phil's 95% ceiling.
   Lab conventions (measured while writing these tests):
   - He stands at (300,700), FREE, with speed 0, no attack and his Green / Blue taken away (greenAb / blueAb null), so his schedule starts nothing: every cast
     is started by the test through the game's own hero61Cast and runs on the game's own castTick. autoUlt is off.
   - His allies are the lab's three plain Vaels at 0 / -5.5 / -11 / -16.5 m (body gaps about 2.3, 7.8 and 13.3 m), each given 10,000 max HP; foes are plain
     Vaels held in place, level 1, no armour or magic resist.
   - Heals are compared with the same heal in a plain lab (ratios), so the game's own heal modifiers (a Support beside allies attacking a Tank) cancel out.
   - He is in no reach list of the skill-reach audit: his casts heal whom they pick wherever they stand; v1391 does not change him.
   Run: node --test tests/talents-mech-morvayne.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),cp=require('node:child_process');
const {NOW,FX,FXN,T,V,near,lab,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='hero61', S=ids=>full(H,ids);
const VMX=s=>vm.runInContext(s,NOW.ctx);
const TEAM=['vael','sylthaine','vireo','vex','hero61'];
const mo=L=>L.T&&L.T.s.mo;
const api=()=>FX.api();
const freeF=L=>{ for(const f of L.F){ f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.energyReg=0; f.mrRating=0; f.armorRating=0; } };
const freeA=L=>{ for(const a of L.A){ a.target=null; a.level=1; a.speed=0; a.atkCd=1e9; a.greenCd=1e9; a.blueCd=1e9; a.energy=0; a.energyReg=0; a.maxHp=a.hp=10000; } };
const freeM=L=>{ const v=L.v; v.stunned=0; v.fearT=0; v.speed=0; v.atkCd=1e9; v.greenAb=null; v.blueAb=null; v.energy=0; v.energyReg=0; v.level=1; v.ctrlRes=0; };
const L0=(ids,o)=>{ const L=lab(H,Array.isArray(ids)&&ids.length&&Array.isArray(ids[0])?ids:(ids?S(ids):null),Object.assign({foes:3,allies:3,big:true},o||{})); VMX('autoUlt=false'); freeF(L); freeA(L); freeM(L); V.step(1); return L; };
const M=(ids,o,fn)=>fn(L0(ids,o));                                     // one lab, measured to the end (a new lab replaces the last one's units: never two at once)
const press=(L,slot,t)=>VMX('hero61Cast')(L.v,slot,t||null);
const castM=(L,slot,t)=>{ if(slot==='ult') L.v.energy=100; assert.ok(press(L,slot,t),'the cast started'); const t0=V.now(); for(let i=0;i<400&&L.v._pend;i++) V.step(1); assert.ok(!L.v._pend,'the cast released'); return V.now()-t0; };
const big=(L,a,f)=>V.hit(L.F[0],a,(f||0.2)*a.maxHp,{kind:'true'});
const lv=(L,i)=>Math.max(1,(L.v.skillLv&&L.v.skillLv[i])|0);
const heal=(L,slot,x)=>VMX('HERO61.healAmount')(slot,lv(L,slot==='blue'?2:1),x,L.v)*(L.v.healPowMul||1);
/* one heal on A0 (at 30%, the lowest share) in a lab of these talents, after prep: what it restored, and the plain lab's for the same */
function healGot(ids,slot,prep,share){ const one=list=>M(list,{},L=>{ const a=L.A[0]; if(prep&&list) prep(L); a.hp=(share==null?0.3:share)*a.maxHp; const h0=a.hp; castM(L,slot); return a.hp-h0; });
  return [one(ids),one(null)]; }

/* ============================== ACCOUNTING ============================== */
test('Morvayne: every talent is accounted for - 121 talents, 9 plain stats, 112 with rows, none waiting; the caps and renames are in the data',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['oh_3_3','oh_8_3','oh_10_3','ig_1_4','ig_6_2','ig_11_1','rb_3_2','rb_3_1','rb_1_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const names={}; for(const tr of T.trees(H)) for(const t of tr.talents){ assert.ok(!names[t[3]],'a name used twice: '+t[3]); names[t[3]]=1; }
  const D=require(path.join(root,'talents-data.js')), other={}; for(const h in D.heroes) if(h!==H) for(const tr of D.heroes[h].trees) for(const t of tr.talents) other[t[3].toLowerCase()]=h;
  for(const tr of T.trees(H)) for(const t of tr.talents) assert.ok(!other[t[3].toLowerCase()],t[0]+' '+t[3]+' is another hero\'s name ('+other[t[3].toLowerCase()]+')');
  const ren={oh_4_4:'Even Hands',ig_3_1:'Rooted at the Gate',ig_8_4:'The Late Watch',ig_5_4:'Still at the Gate',ig_6_2:'Keeper of Harrowgate',ig_6_1:'At His Shoulder',rb_2_4:'Far Road',rb_8_2:'Road Patience',ig_8_1:'Iron Bulwark'};
  for(const id in ren) assert.equal(T.talent(H,id).name,ren[id],id+' renamed');
  for(const id of ['oh_5_4','oh_11_1','ig_3_4','ig_4_4','ig_8_2','ig_7_4','ig_12_2','ig_12_3','rb_1_1','rb_4_3','rb_5_2','rb_8_2','rb_11_4']) assert.ok(/at most 40% off a hit on him/.test(T.talent(H,id).text),id+' states the 40% cap');
  for(const id of ['oh_4_1','ig_3_2','ig_8_1','ig_6_1','ig_10_2','rb_2_4']) assert.ok(/at most 20% off a hit on an ally/.test(T.talent(H,id).text),id+' states the 20% ally cap');
  for(const id of ['oh_1_1','oh_3_4','oh_6_1','oh_6_4','oh_7_1','oh_11_4','oh_12_1','ig_9_4','rb_1_4','rb_n1','rb_6_4']) assert.ok(/add at most 100%/.test(T.talent(H,id).text),id+' states the heal cap');
  for(const id of ['oh_1_4','oh_10_4']) assert.ok(/by at most 30%/.test(T.talent(H,id).text),id+' states the 30% control cap');
  for(const id of ['oh_2_2','oh_7_2','oh_12_2','oh_13_2','ig_5_4']) assert.ok(/at most 1.2% of its max HP a second/.test(T.talent(H,id).text),id+' states the regeneration cap');
  for(const id of ['rb_5_4','rb_6_1','rb_12_4']) assert.ok(/at most 25% sooner/.test(T.talent(H,id).text),id+' states the 25% cap');
  for(const id of ['oh_4_4','ig_3_1']) assert.ok(/less than 0.5 s/.test(T.talent(H,id).text),id+' states the cast floor');
  assert.ok(/2 points larger per rank/.test(T.talent(H,'ig_6_3').text),'Wide Doors in points');
  for(const id of ['oh_5_2','oh_5_3','ig_5_1','ig_5_3','rb_5_2','rb_5_3']) assert.ok(T.talent(H,id).lock,id+' is a fork');
  assert.equal(T.talent(H,'ig_9_1').prereq,'ig_8_1','Iron Answer follows Iron Bulwark');
});

/* ============================== HIS REAL KIT AND THE PAGE SITES ============================== */
test('Morvayne: his real kit and the page sites - the heal at the release on the lowest share, Shelter\'s 8 s from the release, 4 s of immunity, An Open Gate\'s flat Armor, a stun pauses his cast, his swing gate',()=>{
  M(null,{},L=>{ const {v,A}=L; A[1].hp=4000; const h0=A[1].hp; const t=castM(L,'green'); near(t,1.5,'King\'s Mercy: 1.5 s',0.05); assert.ok(A[1].hp>h0,'the lowest share is healed at the release');
    A[2].hp=2000; const h2=A[2].hp; near(castM(L,'blue'),2.5,'Shelter: 2.5 s',0.05); assert.ok(A[2].hp>h2); near(v.blueCd,8,'8 s from the release',0.05);
    A[0].hp=5000; castM(L,'ult',A[0]); near((A[0]._openGateImmuneUntil||0)-V.now(),4,'None Shall Fall: 4 s',0.05);
    const g=VMX('HERO61.aura')(A[1],VMX('units')); near(g,20+2*(lv(L,3)-1),'An Open Gate: 20 + 2 a level of flat Armor');
    near(VMX('unitArmorNow')(A[1]),(A[1].armorRating||0)+g,'no talent: the page adds the aura alone (_moAr unset)',1e-9);
    assert.equal(A[1]._moAr,undefined,'the page field is never written untalented');
    assert.ok(press(L,'green'),'a cast'); for(let i=0;i<10;i++) V.step(1); v.stunned=1; for(let i=0;i<40;i++) V.step(1); assert.ok(v._pend,'a stun PAUSES his cast in hand (the game: his think returns before castTick)');
    v.stunned=0; for(let i=0;i<60&&v._pend;i++) V.step(1); assert.ok(!v._pend,'and it is released after the stun'); });
  M(['ig_8_4'],{allies:0,foes:1},L=>{ const {v,F}=L; F[0].stunned=1e6; v.atkCd=0; v.hp=0.3*v.maxHp; const h=F[0].hp; for(let i=0;i<120;i++){ V.step(1); } assert.ok(F[0].hp<h,'The Late Watch: the page swings for him at 30% HP (the _moSwing site)'); });
  M(null,{allies:0,foes:1},L=>{ const {v,F}=L; F[0].stunned=1e6; v.atkCd=0; v.hp=0.3*v.maxHp; const h=F[0].hp; for(let i=0;i<120;i++){ V.step(1); } assert.equal(F[0].hp,h,'untalented: no swing below half'); });
  M(['oh_5_2'],{},L=>{ near(castM(L,'green'),1.2,'Mercy First through the num site: 1.2 s',0.05); castM(L,'blue'); near(L.v.blueCd,10,'Mercy First through the cd site: 10 s',0.05); });
  M(['rb_5_3','rb_1_4'],{},L=>{ const {A}=L; V.step(2); const m=mo(L).met; assert.equal(m,A[2],'Met on the Road: the farthest'); castM(L,'ult',A[0]); near((A[2]._openGateImmuneUntil||0)-V.now(),4.5,'Guard the Cart through the skillTgt and num sites',0.01); assert.ok(!(A[0]._openGateImmuneUntil>V.now())); });
});

/* ============================== KNOCKS ============================== */
test('Morvayne / Knocks: a hit over 10% of max HP (3, Every Voice Reaches 6; 6 s, Heard Through Iron 9), A Small Knock\'s 2%/rank a Knock, Petitioner\'s Due, A King Who Listens, Hall Never Closed, Open Door, Answer the Knock',()=>{
  M(['oh_1_1','oh_8_1','oh_2_1'],{},L=>{ const {A}=L, W=mo(L); V.hit(L.F[0],A[0],0.09*A[0].maxHp,{kind:'true'}); assert.ok(!(W.k[A[0].uid]&&W.k[A[0].uid].n),'9% is not a Knock');
    for(let i=0;i<8;i++) big(L,A[0],0.11); A[0].hp=A[0].maxHp; assert.equal(W.k[A[0].uid].n,6,'Every Voice Reaches: 6'); near(W.k[A[0].uid].t,9,'Heard Through Iron: 9 s',1e-6);
    big(L,L.v,0.2); assert.ok(!W.k[L.v.uid],'Morvayne himself never Knocks'); for(let i=0;i<Math.round(9.1/V.STEP);i++) V.step(1); assert.equal(W.k[A[0].uid].n,0,'they fade 9 s after the last'); });
  { const [a,b]=healGot(['oh_1_1'],'green',L=>{ big(L,L.A[0]); big(L,L.A[0]); }); near(a/b,1+0.10*2,'A Small Knock: 10% a Knock at 5/5',1e-3); }
  M(['oh_1_1','oh_4_1','oh_11_1'],{},L=>{ const {v,A,F}=L; big(L,A[0]); A[0].hp=A[0].maxHp; const l=x=>{ const h=x.hp; V.hit(F[0],x,1000,{kind:'true'}); const d=h-x.hp; x.hp=x.maxHp; return d; };
    near(l(A[0]),950,'Petitioner\'s Due: 5% on an ally with a Knock',1e-6); near(l(A[1]),1000,'not on one without'); near(l(v),925,'A King Who Listens: 7.5% while any ally has a Knock',1e-6); });
  M(['oh_1_1','oh_11_2'],{},L=>{ castM(L,'ult',L.v); assert.ok(!mo(L).k[L.v.uid],'Mercy Under the Gate on himself: he never Knocks'); });
  M(['oh_1_1','oh_10_1'],{},L=>{ const {A}=L; big(L,A[0]); A[0].hp=0.3*A[0].maxHp; A[0].energy=0; castM(L,'green'); near(A[0].energy,3,'Hall Never Closed: 3 energy',1e-6); });
  M(['oh_1_1','oh_3_1'],{},L=>{ const {A}=L; big(L,A[1]); A[1].hp=0.9*A[1].maxHp; A[0].hp=0.3*A[0].maxHp; const h=A[1].hp; castM(L,'green'); assert.ok(A[1].hp>h,'Open Door: the ally with Knocks first, not the weakest'); });
  { const [a,b]=healGot(['oh_3_1','oh_1_1'],'green',L=>{ for(let i=0;i<3;i++) big(L,L.A[0],0.11); }); near(a/b,(1+0.20)*(1+0.10*3),'Open Door: 20% more at 3 Knocks',1e-3); }
  M(['oh_1_1','oh_8_1','oh_9_1'],{},L=>{ const {A}=L; for(let i=0;i<6;i++) big(L,A[0],0.11); A[0].hp=0.3*A[0].maxHp; const h=A[0].hp; assert.ok(press(L,'green')); V.step(1); assert.ok(A[0].hp>h&&!L.v._pend,'Answer the Knock: lands at once');
    near(L.v._h61Rec,0.75,'the next cast after half the usual cast time',0.05); assert.ok(!mo(L).ak[A[0].uid],'once'); A[0].hp=0.3*A[0].maxHp; near(castM(L,'green'),1.5,'the next one casts as usual',0.05); });
});

/* ============================== VIOLET FIRE ============================== */
test('Morvayne / Violet Fire: 1%/rank of the heal a second for 4 s (Slow Burning 7), at most 1.2% of max HP a second; Steward\'s Care, Crowned Young, Fire in the Seams (x3, the nearest ally) + Spreading Fire, Quick Mercy',()=>{
  M(['oh_2_2','oh_4_2'],{},L=>{ const {A}=L, W=mo(L); A[0].hp=0.3*A[0].maxHp; castM(L,'green'); const r=W.vf[A[0].uid]; assert.ok(r); near(r.r,0.05*heal(L,'green',A[0]),'5% of the heal a second',0.06); near(r.t,7,'Slow Burning: 7 s',0.05);
    A[0].hp=0.3*A[0].maxHp; const h=A[0].hp; for(let i=0;i<Math.round(1/V.STEP);i++) V.step(1); near(A[0].hp-h,Math.min(r.r,0.012*A[0].maxHp),'a second of it, under 1.2% of max HP',0.06);
    r.r=1000; r.t=5; const g0=W.st.regen; for(let i=0;i<Math.round(1/V.STEP);i++) V.step(1); near(W.st.regen-g0,0.012*A[0].maxHp,'1,000 a second asked: 1.2% of max HP given',0.03); });
  M(['oh_2_2','oh_7_2','oh_9_2'],{},L=>{ const {A}=L, W=mo(L); A[0].hp=0.3*A[0].maxHp; castM(L,'blue'); const r=W.vf[A[0].uid], n=W.vf[A[1].uid]; assert.ok(r&&n,'Fire in the Seams spreads to the ally nearest its target');
    const r1=M(['oh_2_2'],{},P=>{ P.A[0].hp=0.3*P.A[0].maxHp; castM(P,'blue'); return mo(P).vf[P.A[0].uid].r; }); near(r.r/r1,3,'three times as strong',1e-6); near(n.r/r.r,1.15,'Spreading Fire: 15% more',1e-6); });
  M(['oh_2_2','oh_12_3'],{},L=>{ const {A}=L, W=mo(L); A[0].hp=0.1*A[0].maxHp; A[0].maxHp=1e7; A[0].hp=1e5; castM(L,'green'); const r=W.vf[A[0].uid]; r.t=0.05; V.step(3); assert.ok(W.vf[A[0].uid]&&W.vf[A[0].uid].cy===1&&W.vf[A[0].uid].t>2.5,'Crowned Young: under half, it burns 3 s more'); W.vf[A[0].uid].t=0.05; V.step(3); assert.ok(!W.vf[A[0].uid],'once'); });
  { const [a]=healGot(['oh_2_2','oh_3_4'],'green',L=>{ const W=mo(L); W.vf[L.A[0].uid]={u:L.A[0],r:1e-9,t:3,cy:0}; }); const c=M(['oh_2_2'],{},L=>{ L.A[0].hp=0.3*L.A[0].maxHp; const h=L.A[0].hp; castM(L,'green'); return L.A[0].hp-h; });
    near(a/c,1.10,'Steward\'s Care: 10% on an ally already burning',2e-3); }
  M(['oh_2_2','oh_5_2','oh_6_2'],{},L=>{ const {A}=L; A[0].hp=0.3*A[0].maxHp; castM(L,'green'); near(mo(L).vf[A[0].uid].t,5.5,'Quick Mercy: King\'s Mercy\'s Violet Fire 1.5 s longer',0.05); });
});

/* ============================== UNBROKEN ============================== */
test('Morvayne / Unbroken: +1 a cast finished with no control landing while he holds it (5, Not Rushed 7), lost when one lands; Even Hands 1.5%/rank faster a stack; Grain and Axles, Fair Hearing, Reign of Mercy, Calm Ruler, Unhurried Crown',()=>{
  M(['oh_4_4','oh_8_4','oh_12_4'],{},L=>{ const {v}=L, W=mo(L); assert.equal(W.unb,3,'Unhurried Crown: 3 at the wave start'); castM(L,'green'); assert.equal(W.unb,4); for(let i=0;i<5;i++) castM(L,'green'); assert.equal(W.unb,7,'Not Rushed: 7');
    const ct=castM(L,'green'); near(ct,1.5/(1+0.045*7),'Even Hands: 4.5% faster a stack at 3/3',0.05);
    assert.ok(press(L,'green')); V.step(5); v.stunned=0.3; V.step(1); assert.equal(W.unb,0,'a stun landing while he holds the cast loses them all'); v.stunned=0; for(let i=0;i<80&&v._pend;i++) V.step(1); assert.equal(W.unb,0,'and that cast adds none');
    castM(L,'green'); assert.equal(W.unb,1); assert.ok(press(L,'green')); V.step(5); v.silencedT=0.5; V.step(2); assert.ok(!v._pend,'a silence cancels it (the game)'); assert.equal(W.unb,0); v.silencedT=0; });
  { const [a,b]=healGot(['oh_4_4','oh_5_1','oh_7_1','oh_11_4'],'green',L=>{ mo(L).unb=5; }); const L=L0(null); const base=heal(L,'green',L.A[0]), ap=0.05*5*(L.v.apow||0)*(L.v.healPowMul||1);
    near(a/b,(1+ap/base)*(1+0.02*5+0.015*5),'Grain and Axles (5% of AP a stack), Fair Hearing (2% a stack), Reign of Mercy (1.5% a stack)',2e-3); }
  M(['oh_4_4','oh_5_4'],{},L=>{ const W=mo(L), {v,F}=L; W.unb=5; const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h-v.hp,950,'Calm Ruler at 5 Unbroken',1e-6); W.unb=4; const h2=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h2-v.hp,1000,'not at 4'); });
});

/* ============================== HIS CAST TIMES AND COOLDOWN ============================== */
test('Morvayne / his casts: Mercy First / Shelter First (the fork, the cooldown, 15% less), Watched Road, Measured Breath + Night Patrol, Heavy Plate, the 0.5 s floor',()=>{
  M(['rb_2_2'],{},L=>near(castM(L,'green'),1.41,'Watched Road: 0.09 s',0.015));
  M(['oh_7_4','ig_11_4'],{},L=>near(castM(L,'blue'),2.0,'Measured Breath + Night Patrol: 0.5 s',0.05));
  M(['ig_6_4'],{},L=>{ near(castM(L,'green'),1.5*1.08,'Heavy Plate: 8% slower',0.05); near(castM(L,'ult',L.A[0]),1.2*1.08,'his ultimate too',0.05); });
  M(['oh_5_3'],{},L=>{ castM(L,'blue'); near(L.v.blueCd,6,'Shelter First: 6 s',0.05); });
  { const [a,b]=healGot(['oh_5_3'],'green'); near(a/b,0.85,'Shelter First: King\'s Mercy heals 15% less',1e-3); }
  M(['oh_4_4','oh_8_4','oh_5_2','rb_2_2','ig_3_1','ig_1_2','ig_12_1','rb_3_4','rb_1_4'],{},L=>{ const W=mo(L); W.unb=7; W.iron=13; W.ironT=99; L.A[2].hp=0.2*L.A[2].maxHp; V.step(1); assert.equal(W.met,L.A[2]); near(castM(L,'green'),0.5,'never under 0.5 s ((1.5 - 0.89) / 1.445 = 0.42 asked)',0.05); });
  { const [a,b]=healGot(['oh_2_3','ig_4_1','rb_4_4','oh_5_3','oh_6_3'],'blue'); near(a/b,1+0.09+0.09+0.10+0.12,'Hall Light, Shelter Wall, Cart Upright, Great Shelter (with Shelter First)',1e-3); }
  { const [a,b]=healGot(['oh_1_3','rb_9_2','oh_9_3'],'green'); near(a/b,1+0.10+0.10+0.15,'Merciful Hand, Night Road, Patient Mercy below half',1e-3); }
  { const [a,b]=healGot(['oh_6_1','oh_6_4'],'green'); near(a/b,1+0.10+0.06,'Open Ear below 40%, Sleepless King',1e-3); }
  M(['oh_6_4','rb_6_1'],{},L=>{ const {v,F}=L, h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h-v.hp,1120,'the RISK costs: 6% + 6% more taken',1e-6); });
});

/* ============================== IRON AND AN OPEN GATE ============================== */
test('Morvayne / Iron: a hit on him adds 1 (10, Iron Hands 13; 8 s, Cold Iron 14), Iron Shield on An Open Gate\'s Armor, Shield Rim, Iron Answer, Shield by the Chair, Rooted at the Gate, Hammered Gate, Iron Bulwark, Banner Companies',()=>{
  M(['ig_1_2','ig_12_1','ig_2_2','ig_12_2'],{},L=>{ const {v,A,F}=L, W=mo(L), g=VMX('HERO61.aura')(A[0],VMX('units')); for(let i=0;i<15;i++) V.hit(F[0],v,1,{kind:'true'}); assert.equal(W.iron,13,'13 at most'); near(W.ironT,14,'Cold Iron: 14 s',0.05); V.step(1);
    near(A[0]._moAr,g*0.65,'Iron Shield: 5% an Iron on An Open Gate',1e-6); near(VMX('unitArmorNow')(A[0]),(A[0].armorRating||0)+g*1.65,'read by the page where it adds the aura',1e-6);
    near(VMX('defMul')(F[0],A[0],'phys'),1-VMX('defToDR')(Math.max(0,(A[0].armorRating||0)+g*1.65-(F[0].armorPen||0)),A[0].lvl),'and where a hit reads its Armor',1e-9); const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h-v.hp,1000*(1-0.13),'Shield Rim: 1% an Iron',1e-6);
    for(let i=0;i<Math.round(14.2/V.STEP);i++) V.step(1); assert.equal(W.iron,0,'it fades 14 s after the last'); V.step(1); assert.equal(A[0]._moAr,0); });
  M(['ig_1_2','ig_8_1','ig_9_1'],{},L=>{ const {v,A,F}=L, W=mo(L); A[2].hp=0.2*A[2].maxHp; for(let i=0;i<10;i++) V.hit(F[0],v,1,{kind:'true'}); assert.equal(W.iron,10); const h=A[2].hp; V.hit(F[0],v,1,{kind:'true'}); near(A[2].hp-h,0.10*A[2].maxHp,'Iron Answer: 1% of max HP an Iron to the weakest',1e-6); assert.equal(W.iron,0); });
  M(['ig_1_2','ig_3_2','ig_8_1','ig_10_2'],{},L=>{ const {v,A,F}=L, W=mo(L); for(let i=0;i<10;i++) V.hit(F[0],v,1,{kind:'true'}); const l=(x,auto)=>{ const h=x.hp; V.hit(F[0],x,1000,{kind:'true',auto}); const d=h-x.hp; x.hp=x.maxHp; return d; };
    near(l(A[0],true),1000*0.9*0.94*0.975,'within 4 m at full Iron: Hammered Gate (basic attacks), Iron Bulwark, Banner Companies',1e-6); near(l(A[0],false),1000*0.94*0.975,'an ability: not Hammered Gate',1e-6); near(l(A[1],true),1000,'7.8 m away: nothing'); });
  M(['ig_1_1','ig_1_2'],{},L=>{ assert.equal(mo(L).iron,3,'Shield by the Chair: 3 at the wave start'); });
  M(['ig_3_1','ig_1_2'],{},L=>{ const W=mo(L); W.iron=10; W.ironT=99; near(castM(L,'green'),1.5/(1+0.10),'Rooted at the Gate: 1% faster an Iron at 5/5',0.05); });
});

/* ============================== THE EVENING BELL AND THE GATE\'S FORKS ============================== */
test('Morvayne / the Evening Bell (15 s, Before the Bell 12; 3 s, Long Bell 3.9; 20% more Armor and half of it as magic resist), Bell Iron, Bell of Mercy + Ringing Mercy, Bell Before Dark; Close / Open the Gate, Wide Doors, Plate and Mail, Strong Walls, Heavy Plate, At His Shoulder',()=>{
  M(['ig_2_3','ig_4_3','ig_10_3','ig_12_3','ig_11_3'],{},L=>{ const {v,A,F}=L, W=mo(L), g=VMX('HERO61.aura')(A[0],VMX('units')); let t=0; while(!(W.bellT>0)&&t<20){ V.step(1); t+=V.STEP; } near(t,12,'Before the Bell: it rings at 12 s',0.02); near(W.bellT,3.9,'Long Bell: 3.9 s',0.05);
    V.step(1); near(A[0]._moAr,0.20*g,'20% more Armor while it rings',1e-6); near(A[0]._moMr,0.5*1.2*g,'and half of the Armor as magic resist',1e-6);
    near(VMX('defMul')(F[0],A[0],'magic'),1-VMX('defToDR')(Math.max(0,(A[0].mrRating||0)+0.6*g-(F[0].magicPen||0)),A[0].lvl),'read where a hit reads magic resist',1e-9); const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h-v.hp,950,'Bell Iron',1e-6);
    for(let i=0;i<Math.round(4/V.STEP);i++) V.step(1); assert.equal(A[0]._moAr,0,'the ring ends'); castM(L,'ult',A[0]); assert.ok(W.bellT>3.9,'Bell Before Dark: rings for the protection'); });
  M(['ig_7_3','ig_9_3'],{},L=>{ const {A}=L, W=mo(L); for(const a of A) a.hp=0.5*a.maxHp; A[0].hp=0.2*A[0].maxHp; A[1].x=A[0].x+4*V.METER; A[1].y=A[0].y; W.bellT=5; const h=A[1].hp, h2=A[2].hp, h0=A[0].hp; castM(L,'green');
    near((A[1].hp-h)/(A[0].hp-h0),0.40*1.10,'Bell of Mercy: 44% of the heal to an ally within 3 m of its target',2e-3); assert.equal(A[2].hp,h2,'not farther'); });
  M(['ig_5_1','ig_6_1'],{},L=>{ const {v,A,F}=L, g=VMX('HERO61.aura')(A[0],VMX('units')); near(v._moAr,0.2*g,'Close the Gate: +20% him',1e-6); near(A[0]._moAr,0.2*g,'and his nearest ally',1e-6); near(A[1]._moAr,-0.2*g,'-20% the rest',1e-6);
    const l=x=>{ const h=x.hp; V.hit(F[0],x,1000,{kind:'true'}); const d=h-x.hp; x.hp=x.maxHp; return d; }; near(l(A[0]),940,'At His Shoulder: the nearest ally 6%',1e-6); near(l(A[1]),1000); });
  M(['ig_5_3','ig_6_3','ig_2_4','ig_5_2','ig_6_4'],{},L=>{ const {v,A}=L, g=VMX('HERO61.aura')(A[0],VMX('units')), a=g*(1+0.075+0.06); near(A[0]._moAr,a-g,'Strong Walls + Heavy Plate',1e-6); near(A[0]._moMr,0.11*a,'Open the Gate + Wide Doors: 11% as magic resist',1e-6);
    near(v._moMr,(0.11+0.12)*a,'Plate and Mail: him 12% more',1e-6); });
});

/* ============================== LAST WATCH ============================== */
test('Morvayne / Last Watch: the last hero of his side - 10% less taken, 20% more dealt, Still at the Gate (under the 1.2% cap), Never Again once at its start, Mace in Reach (+Iron), King Alone, The Watch Holds',()=>{
  M(['ig_4_4','ig_5_4','ig_10_4','ig_7_1','ig_1_2','ig_9_4','ig_12_4'],{allies:1,foes:2},L=>{ const {v,A,F}=L, W=mo(L); v.maxHp=v.hp=10000; assert.equal(W.lw,0,'not while an ally stands');
    A[0].hp=1; V.hit(F[0],A[0],100,{kind:'true'}); V.step(1); assert.equal(W.lw,1,'his last ally fell'); near(v.shield,0.15*v.maxHp,'Never Again: 15% of max HP',1e-6); v.shield=0; V.step(5); assert.equal(v.shield,0,'once');
    v.hp=5000; const g0=W.st.regen; V.step(Math.round(1/V.STEP)); near(W.st.regen-g0,0.012*v.maxHp,'Still at the Gate: 1.5% a second asked, 1.2% given',0.02);
    const k=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(k-v.hp,900,'10% less',1e-6); const fh=F[0].hp; V.hit(v,F[0],1000,{kind:'true',auto:true}); const d1=fh-F[0].hp; assert.equal(W.iron,2,'a swing adds an Iron (the hit on him too)');
    W.lw=0; const fh2=F[0].hp; V.hit(v,F[0],1000,{kind:'true',auto:true}); near(d1/(fh2-F[0].hp),1.2*1.2,'20% more and Mace in Reach 20%',1e-6); assert.equal(W.iron,2,'not outside Last Watch');
    V.step(1); v.shield=0; v.energy=0; V.hit(F[0],v,1,{kind:'true'}); V.step(1); const e0=v.energy; V.hit(F[0],v,1,{kind:'true'}); V.step(1); near(v.energy-e0,7*1.2,'The Watch Holds: 20% more energy',1e-3); });
  { const r=M(['ig_9_4','ig_4_4'],{allies:0,foes:1},L=>{ const {v}=L; v.maxHp=1e6; v.hp=1e5; V.step(1); const h=v.hp; castM(L,'green'); return v.hp-h; }); const b=M(null,{allies:0,foes:1},L=>{ const {v}=L; v.maxHp=1e6; v.hp=1e5; V.step(1); const h=v.hp; castM(L,'green'); return v.hp-h; });
    near(r/b,1.15,'King Alone: his heals on himself 15% stronger',2e-3); }
});

/* ============================== MET ON THE ROAD ============================== */
test('Morvayne / Met on the Road: the farthest ally (it stays until above 70%, then 3 s; Lantern 0 s), Out Before the Bell, the LINK, Far Road, Shelter on the Road + Road Shelter, Hands Sent Ahead, Carter\'s Coat, Second Petition, She Will Find Him, Open Road',()=>{
  M(['rb_1_4','rb_n1','oh_1_1','rb_2_4','rb_10_4'],{},L=>{ const {A,F}=L, W=mo(L); assert.equal(W.met,A[2],'the farthest ally'); A[2].hp=0.5*A[2].maxHp; A[1].x=L.v.x+30*V.METER; V.step(2); assert.equal(W.met,A[2],'stays while not above 70%');
    near(VMX('(function(T,u,x){ return T.fn.knN(TalentFx.api(),T,u,x); })')(L.T,L.v,A[2]),1,'the LINK: 1 Knock with A Small Knock'); const h=A[2].hp; V.hit(F[0],A[2],1000,{kind:'true'}); near(h-A[2].hp,970,'Far Road: 3% on the Met ally',1e-6);
    A[2].hp=A[2].maxHp; V.step(1); assert.equal(W.met,A[1],'Lantern on the Road 3/3: it moves at once to the farthest'); });
  { const [a,b]=healGot(['rb_1_4','rb_n1'],'green',L=>{ mo(L).met=L.A[0]; }); near(a/b,1+0.10+0.03,'Out Before the Bell 10% + the LINK\'s 3% below half',1e-3); }
  M(['rb_1_4','rb_7_3','rb_9_3'],{},L=>{ const {A}=L, W=mo(L); A[2].hp=0.45*A[2].maxHp; A[0].hp=0.2*A[0].maxHp; const h=A[2].hp; castM(L,'blue'); assert.ok(A[2].hp>h,'Shelter on the Road: to the Met ally below half, not the weakest'); });
  { const one=(ids)=>M(ids,{},L=>{ const {A}=L; A[0].hp=A[0].maxHp; A[1].hp=A[1].maxHp; A[2].hp=0.45*A[2].maxHp; V.step(1); const h=A[2].hp; castM(L,'blue'); return A[2].hp-h; });
    near(one(['rb_1_4','rb_7_3','rb_9_3'])/one(['rb_1_4']),1.25*1.10,'Shelter on the Road 25% x Road Shelter 10%',2e-3); }
  M(['rb_1_4','rb_3_4','rb_7_4','rb_8_4'],{},L=>{ const {A}=L, W=mo(L); for(const a of A) a.hp=0.9*a.maxHp; A[2].hp=0.3*A[2].maxHp; A[2].stunned=5; A[2].energy=0; A[1].hp=0.5*A[1].maxHp; const h1=A[1].hp, h2=A[2].hp;
    near(castM(L,'green'),1.0,'Hands Sent Ahead: 0.5 s sooner on the Met ally',0.05); assert.equal(A[2].stunned,0,'and frees them from a control'); near(A[2].energy,3,'Second Petition: 3 energy');
    near((A[1].hp-h1)/(A[2].hp-h2),0.15,'Carter\'s Coat: 15% of the heal to the ally nearest them',0.03); });
  M(['rb_1_4','rb_9_4'],{},L=>{ const {A}=L, W=mo(L); A[2].hp=0.2*A[2].maxHp; V.step(2); assert.equal(W.swf,A[2]); A[0].hp=0.5*A[0].maxHp; A[1].hp=0.5*A[1].maxHp; const h=A[2].hp; assert.ok(press(L,'green')); V.step(1); assert.ok(A[2].hp>h&&!L.v._pend,'She Will Find Him: lands at once');
    A[2].hp=0.5*A[2].maxHp; V.step(2); A[2].hp=0.2*A[2].maxHp; V.step(2); assert.equal(W.swf,null,'once every 10 s'); });
  M(['rb_1_4','rb_12_2'],{},L=>{ const {A,F}=L, W=mo(L); A[2].hp=1; A[1].hp=0.5*A[1].maxHp; V.hit(F[0],A[2],100,{kind:'true'}); V.step(1); assert.equal(W.met,A[1],'the next farthest'); near(A[1].hp,0.65*A[1].maxHp,'Open Road: 15% of max HP at once',1e-3); });
});

/* ============================== BORNE, ANSWERED, NONE SHALL FALL\'S RIDERS ============================== */
test('Morvayne / Borne (4, the fight: Borne Inside, Heavy Coat, Coat Clasp, Not Forgiven, First Seal Kept) and Answered (Fire Answers shared out at the end, Loud Answer, Fire Remembers, Violet Answer, Answering Fire, Told the Watch); None Left Outside + Last Cart In; Watch the Gate + Near Gate; Guard the Cart + Far Gate; SOON25',()=>{
  M(['rb_2_3','rb_4_3','rb_11_1','rb_12_4','rb_5_4'],{allies:3},L=>{ const {v,A,F}=L, W=mo(L); const hp0=v.maxHp, hp1=v.healPowMul||1; for(const a of A.slice(0,2)){ a.hp=1; V.hit(F[0],a,100,{kind:'true'}); } V.step(2); assert.equal(W.borne,2); W.borne=4; A[2].hp=1; V.hit(F[0],A[2],100,{kind:'true'}); V.step(1); assert.equal(W.borne,4,'4 at most'); W.borne=2; V.step(1);
    near((v.healPowMul||1)/hp1,1.20,'Borne Inside: 10% healing power each',1e-6); near(v.maxHp/hp0,1.10,'Coat Clasp: 5% max HP each',1e-6); const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h-v.hp,1000*0.94,'Heavy Coat: 3% each',1e-6);
    V.step(1); const e0=v.energy; V.hit(F[0],v,1,{kind:'true'}); V.step(1); near(v.energy-e0,7*(1/(1-0.05-0.08)),'Kept Faith 5% + First Seal Kept 8%: sooner',1e-3); });
  M(['rb_5_4','rb_6_1','rb_12_4','rb_2_3'],{},L=>{ const {v,F}=L, W=mo(L); W.borne=4; V.step(1); const e0=v.energy; V.hit(F[0],v,1,{kind:'true'}); V.step(1); near(v.energy-e0,7/(1-0.25),'SOON25: at most 25% sooner',1e-3); });
  M(['rb_4_1','rb_5_1','rb_10_1','rb_12_1','rb_7_1','rb_8_1','rb_2_3'],{},L=>{ const {v,A,F}=L, W=mo(L); W.borne=2; for(const a of A) a.hp=0.5*a.maxHp; A[2].hp=0.3*A[2].maxHp; A[1].stunned=0; A[1].fearT=10; v.hp=0.5*v.maxHp; castM(L,'ult',A[0]); assert.equal(W.prot.length,1);
    V.hit(F[0],A[0],2000,{kind:'true'}); V.hit(F[0],A[0],3000,{kind:'true'}); near(W.prot[0].bank,5000,'what it stops is banked',1e-6); const h=A.map(a=>a.hp), hv=v.hp; for(let i=0;i<Math.round(4.1/V.STEP);i++) V.step(1);
    const tot=5000*0.12*1.10*(1+0.09*2), each=tot/3; near(A[2].hp-h[2],each*1.12,'Violet Answer: the lowest share 12% more',0.02); near(A[1].hp-h[1],each,'shared out among the rest of the team (him too: three)',0.02);
    near(A[1].shield,0.10*A[1].maxHp,'Answering Fire: 10% of max HP shields',1e-6); assert.equal(A[1].fearT,0,'Told the Watch 2/2: any one control freed (a fear)'); });
  M(['rb_11_3','rb_12_3'],{},L=>{ const {A}=L, W=mo(L); A[1].hp=0.4*A[1].maxHp; castM(L,'ult',A[0]); for(let i=0;i<Math.round(4.05/V.STEP);i++) V.step(1); near((A[1]._openGateImmuneUntil||0)-V.now(),2.0-0.05,'None Left Outside + Last Cart In: the next-weakest 2 s',0.08); });
  M(['rb_5_2','rb_6_2'],{},L=>{ const {v,A,F}=L, W=mo(L); A[2].hp=0.2*A[2].maxHp; castM(L,'ult',A[0]); assert.ok(A[2]._openGateImmuneUntil>V.now()&&!(A[0]._openGateImmuneUntil>V.now()),'Watch the Gate: the weakest'); const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h-v.hp,800,'and 20% less on him',1e-6);
    near(castM(L,'green'),1.5/1.12,'Near Gate: 12% faster while it lasts',0.05); });
  M(['rb_5_3','rb_6_3','rb_1_4'],{},L=>{ const {A}=L; V.step(2); A[2].speed=60; castM(L,'ult',A[0]); V.step(2); assert.ok(A[2]._openGateImmuneUntil>V.now(),'Guard the Cart: the Met ally'); near(A[2].speed,60*1.15,'Far Gate: 15% faster while it lasts',1e-6); });
});

/* ============================== THE SIGNATURES ============================== */
test('Morvayne / the signatures: The Hall Is Open, No Gate Shut Again, This Time',()=>{
  M(['oh_13_2','oh_1_1'],{},L=>{ const {A}=L, W=mo(L); castM(L,'ult',A[0]); assert.equal(W.hio>7.9,true,'8 s'); for(const a of A) assert.equal(W.k[a.uid].n,3,'every ally Knocks fully'); assert.ok(W.vf[L.v.uid]&&W.vf[A[1].uid],'Violet Fire on the whole team');
    A[1].hp=0.3*A[1].maxHp; const h=A[1].hp; assert.ok(press(L,'green')); V.step(1); assert.ok(A[1].hp>h&&!L.v._pend,'his heals land with no cast'); near(L.v._h61Rec,0.75,'half the usual cast time between',0.05); });
  M(['ig_13_3','ig_1_2'],{},L=>{ const {v,A,F}=L, W=mo(L), g=VMX('HERO61.aura')(A[0],VMX('units')); for(let i=0;i<10;i++) V.hit(F[0],v,1,{kind:'true'}); castM(L,'ult',A[2]); V.step(1); assert.ok(W.ngs>7.5&&W.bellT>7.5,'at full Iron: 8 s, the bell rings');
    near(A[0]._moAr,g*(1+0.05*10)*2-g,'An Open Gate doubled',1e-6); const h=A[0].hp, hv=v.hp; V.hit(F[0],A[0],1000,{kind:'phys'}); const k=VMX('defMul')(F[0],A[0],'phys'), kv=VMX('defMul')(F[0],v,'phys'), lost=h-A[0].hp;
    near(hv-v.hp,lost/3*kv/k,'a quarter moved onto him, through his own Armor instead of hers',1e-3); assert.ok(mo(L).st.redirect>=1); });
  M(['ig_13_3','ig_1_2'],{},L=>{ castM(L,'ult',L.A[2]); assert.equal(mo(L).ngs,0,'not below full Iron'); });
  M(['rb_13_3','rb_4_1','rb_2_3'],{},L=>{ const {v,A,F}=L, W=mo(L); const b0=v.healPowMul||1; W.borne=2; A[0].hp=10; V.hit(F[0],A[0],1000,{kind:'true'}); assert.ok(A[0].alive&&A[0].hp>=1,'This Time: held at 1 HP'); assert.ok(A[0]._openGateImmuneUntil>V.now()+3.9,'and protected 4 s');
    V.step(1); near((v.healPowMul||1)/b0,1+0.10*2+0.10*2,'Borne Inside 10% each, and the Borne lend 10% each for 8 s',1e-6); V.hit(F[0],A[0],3000,{kind:'true'}); assert.equal(W.prot[0].x2,true); A[1].hp=0.5*A[1].maxHp; const h=A[1].hp; for(let i=0;i<Math.round(4.1/V.STEP);i++) V.step(1);
    near(A[1].hp-h,3000*0.24*1.0/3,'Answered at double strength',0.03); A[1].hp=10; V.hit(F[0],A[1],1000,{kind:'true'}); assert.ok(!A[1].alive,'once a fight'); });
});

/* ============================== THE CAPS ============================== */
test('Morvayne: his damage reduction is one product floored at 60% kept (40% off); an ally\'s at 80%; his heal-strength talents at most +100%; control shortening at most 30%',()=>{
  M(['oh_5_4','oh_4_4','ig_3_4','ig_4_4','ig_12_2','ig_1_2','ig_12_1','rb_8_2','rb_4_3','rb_2_3'],{allies:0},L=>{ const {v,F}=L, W=mo(L); W.unb=5; W.iron=13; W.ironT=99; W.borne=4; V.step(1); const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(h-v.hp,600,'on him: 40% at most',1e-6); });
  M(['oh_1_1','oh_4_1','ig_1_2','ig_8_1','ig_10_2','ig_3_2','rb_1_4','rb_2_4'],{},L=>{ const {v,A,F}=L, W=mo(L); for(let i=0;i<10;i++) V.hit(F[0],v,1,{kind:'true'}); big(L,A[0]); W.met=A[0]; A[0].hp=A[0].maxHp; const h=A[0].hp; V.hit(F[0],A[0],1000,{kind:'true',auto:true}); near(h-A[0].hp,800,'on an ally: 20% at most',1e-6); });
  { const [a,b]=healGot(['oh_1_1','oh_8_1','oh_3_4','oh_6_1','oh_6_4','oh_7_1','oh_11_4','oh_12_1','oh_2_2','oh_4_4','oh_8_4'],'green',L=>{ const W=mo(L); for(let i=0;i<6;i++) big(L,L.A[0],0.11); W.unb=7; W.vf[L.A[0].uid]={u:L.A[0],r:1e-9,t:3,cy:0}; W.os[L.A[0].uid]=3; L.A[0].hp=0.3*L.A[0].maxHp; },0.3);
    near(a/b,2.0,'HEAL100: twice the heal at most',2e-3); }
  M(['oh_1_4','oh_10_4'],{},L=>{ const {v,F}=L; V.cc(F[0],v,'stunned',1); near(v.stunned,0.7*0.7,'control: 30% at most (0.7 s stun -> 0.49 s)',1e-6); v.stunned=0; V.cc(F[0],v,'fearT',1); near(v.fearT,0.7*0.85,'Black Plate alone on a fear: 15%',1e-6); v.fearT=0; });
});

/* ============================== THE WAVE CLOCK ============================== */
test('Morvayne: his timers are countdowns - Knocks, Iron, the bell, Violet Fire carry their time left across a wave change; his talents\' own immunities and windows end there; Met on the Road is picked again; Borne stays',()=>{
  M(['oh_1_1','ig_1_2','ig_2_3','oh_2_2','rb_11_3','rb_1_4','rb_2_3'],{},L=>{ const {v,A}=L, W=mo(L); big(L,A[0]); for(let i=0;i<3;i++) V.hit(L.F[0],v,1,{kind:'true'}); W.vf[A[0].uid]={u:A[0],r:1,t:3,cy:0}; W.borne=2;
    VMX('(function(T,u,x){ return T.fn.protect(TalentFx.api(),T,u,x,2,"nlo"); })')(L.T,v,A[1]); V.step(1); const k=[W.k[A[0].uid].t,W.ironT,W.vf[A[0].uid].t];
    V.wave(); VMX('battleTime=0'); V.step(1);
    near(W.k[A[0].uid].t,k[0]-V.STEP,'Knocks',1e-6); near(W.ironT,k[1]-V.STEP,'Iron',1e-6); near(W.vf[A[0].uid].t,k[2]-V.STEP,'Violet Fire',1e-6); assert.equal(W.prot.length,0,'his talents\' protections end');
    assert.ok(!(A[1]._openGateImmuneUntil>V.now()),'and their immunity'); near(W.bellCd,15-V.STEP,'the bell\'s clock starts again',1e-6); assert.equal(W.borne,2,'Borne: the fight'); assert.equal(W.met,A[2],'Met on the Road picked again'); });
});

/* ============================== WHOLE FIGHTS ============================== */
test('Morvayne: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H);
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal);
  let st=null; for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const W=s._tal.s.mo; if(W) st=JSON.parse(JSON.stringify(W.st)); }
  console.log('  live fight: '+JSON.stringify(st)); assert.ok(st&&st.unb>=1&&st.vf>=1&&st.inst>=0&&st.ring>=1,'real Unbroken, Violet Fire, bell rings'); assert.equal(FX.errors().n,0,'no hook errors: '+FX.errors().last);
  determinism(H,TEAM); assert.equal(FX.errors().n,0,'no hook errors: '+FX.errors().last);
});

const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Morvayne: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they pass his changed lines (his casts and releases, the armour and magic resist lines, his swing gates)',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{ const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['hero61','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
    const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
    VMX('var __mbN={cast:0,ult:0,blue:0,def:0,arm:0}; var __mbC=hero61Cast, __mbD=_defMulRaw, __mbA=unitArmorNow;'+
      'hero61Cast=function(u,slot){ __mbN.cast++; if(slot==="ult") __mbN.ult++; if(slot==="blue") __mbN.blue++; return __mbC.apply(this,arguments); };'+
      '_defMulRaw=function(){ __mbN.def++; return __mbD.apply(this,arguments); }; unitArmorNow=function(){ __mbN.arm++; return __mbA.apply(this,arguments); };');
    let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
        const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
        assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
      const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
      for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
        assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
      const c=VMX('__mbN'); console.log('  identity: '+JSON.stringify(c)); assert.ok(c.cast>0&&c.ult>0&&c.blue>0&&c.def>0,'the fights pass every changed line: '+JSON.stringify(c)); }
    finally{ VMX('hero61Cast=__mbC; _defMulRaw=__mbD; unitArmorNow=__mbA;'); }
    assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* ============================== PHIL'S 95% CHECK ============================== */
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={oh:0,ig:1,rb:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const DEF={ oh:['oh_5_4','oh_11_1','oh_8_3','oh_4_4','oh_8_4','oh_1_4','oh_3_3'], ig:['ig_3_4','ig_4_4','ig_8_2','ig_7_4','ig_12_2','ig_12_3','ig_1_2','ig_12_1','ig_2_4','ig_2_3','ig_5_2','ig_6_4','ig_5_1','ig_1_4','ig_6_2','ig_13_3'], rb:['rb_1_1','rb_4_3','rb_5_2','rb_8_2','rb_11_4','rb_3_1','rb_2_3'] };
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,0][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,2,-2,0][i]*V.METER; a.y=v.y-[5.5,4,4,11][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal,U}; }
/* the worst hit on him: every condition of his reduction talents true at once - 5+ Unbroken, full Iron (13) with the bell ringing and the signature's doubled
   gate, Last Watch, an ally with a Knock and one below 30%, casting, 4 Borne, Watch the Gate's window; physical and magic, normal and critical; and again with
   glyph reduction at its 30% cap. (Last Watch and "an ally below 30%" cannot both hold; both are set: a bound, not a real moment.) */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F,A}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.9*v.maxHp; v.shield=0; v.glyphDR=glyph||0; v.stunned=0; v.greenAb=null; v.blueAb=null;
  if(L.T&&L.T.s.mo){ const W=L.T.s.mo; W.unb=7; W.iron=13; W.ironT=99; W.ironFull=1; W.bellT=99; W.ngs=99; W.borne=4; W.wtg=99; W.k[A[0].uid]={n:3,t:99}; A[1].hp=0.2*A[1].maxHp; V.step(1); W.lw=1; VMX('hero61Cast')(v,'green',null); }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:true}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Morvayne: his most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and he is at 85% or more for well under half a fight',()=>{
  const cands=[[['oh','ig'],[61,30]],[['oh','rb'],[61,30]],[['ig','oh'],[61,30]],[['ig','rb'],[61,30]],[['rb','oh'],[61,30]],[['rb','ig'],[61,30]],[['oh'],[91]],[['ig'],[91]],[['rb'],[91]]].map(([o,c])=>{ const b=deep(o,c,DEF); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95%');
  /* a hit while he is immune (his own None Shall Fall: Watch the Gate sends it to the weakest, often him) is left out - immunity is not damage reduction
     (a hit of Vex's still took about 9% of itself through it: a page line outside damage(), a base issue). What a hit took is measured as HP and shield lost plus what healed him inside the same hit (Iron Answer heals the weakest - often him - on the hit
     that spends the Iron): a heal is not a reduction */
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,t:0,tp:0,tm:0,te85:0,imm:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore, __dhu=healUnit, __drOn=null, __drH=0;'+
    'healUnit=function(u,a){ const h=u.hp; const r=__dhu.apply(this,arguments); if(u===__drOn&&u.hp>h) __drH+=u.hp-h; return r; };'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="hero61"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); __drOn=tgt; __drH=0; } let r; try{ r=__ddc.apply(this,arguments); } finally{ if(me) __drOn=null; }'+
    '  if(me&&amt>0&&tgt.alive&&HERO61.immune(tgt,battleTime)){ __dr.imm++; return r; }'+
    '  if(me&&amt>0&&tgt.alive){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0)+__drH; if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="hero61"&&u.alive)) continue; __dr.ticks++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1)*(T&&T.s.mo?T.fn.drK(TalentFx.api(),T,u,s,"phys",false):1);'+
    '    const kp=k*defMul(s,u,"phys"), km=k*defMul(s,u,"magic"); __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','hero61'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+'; sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more '+pc(x.te85,x.t)+'; hits while immune (None Shall Fall on himself: not a reduction, left out) '+x.imm;
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>20,'hits on him: '+d.n); assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more'); assert.equal(d.at,0);
    assert.ok(d.te85<0.25*Math.max(1,d.t),'at 85% or more for well under half of his time ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc; healUnit=__dhu;'); }
});
