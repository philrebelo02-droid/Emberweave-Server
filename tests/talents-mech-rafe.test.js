'use strict';
/* Rafe Marrow's talents as data on the mechanics layer (talents-mech/rafe.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling and his longest stun chain.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one action (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Rafe, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6); A0 (0,-5.5) A1 (0,-11). Every lab unit is held (stunned).
   His hits are made the way the page makes them: a swing's blow inside partPre / part ('rfCut' | 'rfShot'), Pirate's Instinct's shot inside 'rfInst',
   a Barrage bullet inside 'rfBullet', a Dead Man's Fortune shot inside 'rfDmf' (as(...) below), or by his real skills (V.cast, ult()).
   None of his base skills is in today's SKILL REACH AUDIT. His cutlass needs his target's CENTRE within 2.5 m of his (an enemy standing inside him:
   1 of 260 seeded swings): the cutlass tests stand the enemy at 2.0 m (3.8 m with Stand and Fight), which the page's own test measures the same way
   before and after any reach fix. The lab casts at skill level 10 against level-100 foes, so a control from a skill lands 10% of the time: the hook tests
   set the foes' level to 1 (nl()).
   Run: node --test tests/talents-mech-rafe.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab:lab0,lost,stack,mark,full,everything,build,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='rafe', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
/* the lab's plain units are Vaels, Tanks: a Marksman's basic attack on a Tank meets the class shield wall (25% blocked). His lab foes are given another
   class (a copy of their type), so a measured swing always lands */
const lab=(h,l,o)=>{ const L=lab0(h,l,o); for(const f of L.F) f.t=Object.assign({},f.t,{role:'Bruiser'}); return L; };
/* his Smoke misses and Ghost Ship are not damage reduction: the 95% measures take them out */
const noMiss=L=>{ if(!L.T) return; for(const ev of ['in','teamIn']) if(L.T.on[ev]) L.T.on[ev]=L.T.on[ev].filter(r=>!(r.do&&r.do.some(a=>a.miss))); };
const API=()=>FX.api();
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d||99)}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const left=(L,t,name)=>{ const m=t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]; return m?(m.until==null?Infinity:m.until-V.now()):0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const RF=L=>L.T.s.rf;
const nl=L=>{ for(const f of L.F) f.level=1; };
/* a hit of his made as the page makes it: inside partPre / part of that part */
function as(L,cur,t,fn){ if(!L.v._tal) return fn(); FX.partPre(L.v,t,cur); try{ return fn(); } finally{ FX.part(L.v,t,cur); } }
/* the stun a cast leaves on f (a lab unit is held with a huge stun: it is let go for the cast, and held again after) */
const stunOf=(f,fn)=>{ f.stunned=0; f._stunSince=null; fn(); const x=f.stunned; f.stunned=1e6; return x; };   /* v1452: let go, its stun run (the talents' 4.0 s room) starts afresh */
const hitAs=(L,cur,t,amt,o)=>lost(t,()=>as(L,cur,t,()=>V.hit(L.v,t,amt||1000,Object.assign({kind:cur===INST?'true':'phys',auto:cur===CUT||cur===SHOT},o||{}))));
const ratioAs=(L,cur,t,o)=>hitAs(L,cur,t,1000,o)/plainHit(L,()=>hitAs(L,cur,t,1000,o));
const INST='rfInst', CUT='rfCut', SHOT='rfShot', BUL='rfBullet', DMF='rfDmf';
/* a swing of his weapon w ('c' cutlass, 'p' pistol) that lands on t */
const swing=(L,w,t,amt,o)=>hitAs(L,w==='c'?CUT:SHOT,t,amt||1000,o);
/* his ultimate as the page casts it (ULT_DEF merged with HERO_ULT_ART), and the hook delivered for real (deliverLaunch: its skillTgt hook) */
function ult(L){ const v=L.v, o=Object.assign({},VMX('ULT_DEF.multiShot'),VMX('HERO_ULT_ART.rafe')); v._castSlot='ult'; v._castLv=(v.skillLv&&v.skillLv[0])||1; v._castSM=VMX('skillMul')(v._castLv);
  try{ VMX('doEffect')(v,'multiShot',o); } finally{ v._castSM=1; v._castLv=0; v._castSlot=null; } }
function hookShot(L,t){ const v=L.v; v.target=t; v._castSlot='blue'; v._castLv=(v.skillLv&&v.skillLv[2])||1; v._castSM=VMX('skillMul')(v._castLv);
  try{ VMX('doEffect')(v,'grapple',Object.assign({},v.blueAb)); } finally{ v._castSM=1; v._castLv=0; v._castSlot=null; } }
const defK=(s,t,ign)=>VMX('(function(s,t,x){ const a=defMul(s,t,"phys"); const sv=s._wpnArmIgn; s._wpnArmIgn=x; const b=defMul(s,t,"phys"); s._wpnArmIgn=sv; return b/a; })')(s,t,ign);
const plain=(o,fn)=>fn(lab(H,null,o));
const nrm=L=>{ L.v.glyphCrit=0; L.v.critDmg=0.6; };

test('Rafe: every talent is accounted for - 8 plain stats, 118 with rows, none waiting',()=>{
  accounting(H,[126,8,118,0,0]);
  for(const id of ['fs_7_2','fs_10_4','co_1_4','co_7_4','co_12_2','ss_12_3','ss_8_4','ss_4_1']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.ok(!FXN.has(H,'fs_1_2')&&FXN.mech(H).talents.fs_1_2,'Steady Aim is a row now (inside the 5% critical-chance group)');
  for(const id of ['fs_13_4','co_13_1','ss_13_3','fs_1_1','co_1_1','ss_1_1']) assert.ok(FXN.mech(H).talents[id],id);
});

test('Rafe: his real kit, as the talents read it - the cutlass needs an enemy inside him, Pirate\'s Instinct every 4th swing at the press, the Barrage, the hook, Dead Man\'s Fortune',()=>{
  plain({foes:5},P=>{ const {v,F}=P; nl(P);
    assert.ok(v.pass&&v.pass.instinct,'Pirate\'s Instinct at 3 stars');
    near(VMX('instinctDmg')(v),0.5+1.5*9/99,'its share at skill level 10 (the hero file\'s instPct agrees)');
    /* the Barrage: one bullet at each of the 4 nearest, 85% of attack */
    const hp=F.map(f=>f.hp); V.cast(v,'green'); secs(0.3); const got=F.map((f,i)=>hp[i]-f.hp); assert.equal(got.filter(x=>x>0).length,4,'4 bullets, the 4 nearest');
    assert.equal(got[2],0,'F2 (15.5 m) is the fifth nearest: no bullet');
    /* the hook: 125%, a pull of at most 75% of the gap or 5 m, a 2.45 s stun */
    const f=F[1], x0=f.x; near(stunOf(f,()=>V.cast(v,'blue',f)),2.45,'the stun: 3.5 x 0.7',1e-6); assert.ok(f.x<x0,'pulled in'); near((x0-f.x)/V.METER,5,'5 m (75% of the 10 m gap would be 7.5)',1e-6);
    /* Dead Man's Fortune: 5 shots and +50% evasion for 3 s */
    const h2=F.map(x=>x.hp); ult(P); near(v.evaStat,0.5,'evasion'); near(v._miragT,3,'3 s'); secs(0.4); assert.equal(F.filter((x,i)=>x.hp<h2[i]).length,5,'one shot at each of the 5 nearest');
  });
  /* real swings: the pistol, the instinct shot every 4th swing (at the press), the cutlass only when the target's centre is within 2.5 m */
  const def={hero:H,casting:true,always:[{on:'partPre',skill:'rfShot',do:[{fn:'s',k:'shot'}]},{on:'partPre',skill:'rfCut',do:[{fn:'s',k:'cut'}]},{on:'partPre',skill:'rfInst',do:[{fn:'s',k:'inst'}]}],talents:{fs_1_1:[]},fn:{s:(A,T,u,c,a)=>{ seen[a.k]=(seen[a.k]||0)+1; }},ruling:{},partial:{}};
  let seen={}; const L=lab(H,[['fs_1_1',1]],{foes:2,def}), {v,F}=L; v.stunned=0; v.greenCd=v.blueCd=1e9; v.energy=0; v.target=F[0];
  for(let i=0;i<1400&&(seen.shot||0)<8;i++){ V.step(1); v.energy=0; at(L,F[0],4.5,0); }
  assert.ok(seen.shot>=8,'pistol swings: '+JSON.stringify(seen)); assert.equal(seen.cut||0,0,'no cutlass at 4.5 m'); assert.equal(seen.inst,2,'two instinct shots in 8 swings');
  seen={}; for(let i=0;i<900&&(seen.cut||0)<3;i++){ at(L,F[0],2.0,0); V.step(1); v.energy=0; } assert.ok(seen.cut>=3,'the cutlass at 2.0 m (centre to centre): '+JSON.stringify(seen));
});

/* ============================== THE FOURTH SHOT ============================== */
test('Rafe / Honest Cards: an instinct shot deals a Card (max 4); at 4 the next Barrage spends them, its bullets deal 5% x 5 of their hit more as true damage; Cut the Deck, Stacked Deck, Dealer\'s Choice',()=>{
  const L=lab(H,S(['fs_1_1','fs_8_1','fs_6_1','fs_9_1']),{foes:4}), {v,F}=L; nrm(L);
  hitAs(L,INST,F[0],100); assert.equal(stack(L,'rfCard'),1,'one Card a shot'); for(let i=0;i<4;i++) hitAs(L,INST,F[0],100); assert.equal(stack(L,'rfCard'),4,'one a shot, at most 4');
  setStack(L,'rfCard',3); const h0=F[0].hp; V.cast(v,'green'); secs(0.3); assert.equal(stack(L,'rfCard'),3,'3 Cards: the Barrage spends nothing'); const p=h0-F[0].hp;
  setStack(L,'rfCard',4); v.hp=v.maxHp*0.5; const hv=v.hp, a0=v.dmg; const h1=F[0].hp; V.cast(v,'green'); secs(0.3); assert.equal(stack(L,'rfCard'),0,'4 Cards: spent');
  near(h1-F[0].hp,p*1.15*(1+0.25),'Dealer\'s Choice 3% x 5 on its bullets, then 5% x 5 of each bullet\'s hit as true damage',1e-3);
  near(v.hp-hv,v.maxHp*0.01*5*4,'Cut the Deck: 1% x 5 of his max HP for each Card spent'); V.step(1); near(v.dmg/a0,1.15,'Stacked Deck: 3% x 5 attack',1e-6);
  secs(5.5); near(v.dmg/a0,1.15,'(still at 5.5 s)',1e-6); secs(0.6); near(v.dmg/a0,1,'for 6 s',1e-6);
  const h2=F[0].hp; V.cast(v,'green'); secs(0.3); near(h2-F[0].hp,p,'the next Barrage (no Cards): plain',1e-3);
});

test('Rafe / Card Sharp, Steady Aim, Heavy Purse, Rhythm of Steel, Never Same Twice: ONE critical-chance group, at most 5%',()=>{
  let L=lab(H,S(['fs_4_1']),{foes:1}); const cp=()=>L.T.fn.critP(API(),L.T,L.v,{});
  setStack(L,'rfCard',1); near(cp(),0.005*5,'Card Sharp 0.5% x 5 per Card'); setStack(L,'rfCard',2); near(cp(),0.005*5*2); setStack(L,'rfCard',4); near(cp(),0.05,'4 Cards: 10%, held at 5%');
  L=lab(H,[['fs_1_2',2]],{foes:1}); near(cp(),0.02,'Steady Aim 1% a rank (2 ranks)');
  L=lab(H,[['ss_1_1',5],['ss_8_1',1]],{foes:1}); RF(L).sw=true; RF(L).xd=true; L.T.s.cur='rfShot'; near(cp(),0.04,'Never Same Twice 4% a rank on a Crossdraw (1 rank)'); L.T.s.cur=null; RF(L).sw=false;
  L=lab(H,S(['fs_1_2','co_1_3','co_2_3','ss_1_1','ss_6_1','ss_8_1']),{foes:1}); near(cp(),0.05,'Steady Aim 1% x 5 (a plain stat until now) fills the group alone');
  L=lab(H,S(['co_1_3','co_2_3']),{foes:1}); setStack(L,'rfCoin',3); near(cp(),0.003*3*3,'Heavy Purse 0.3% x 3 per Coin');
  L=lab(H,S(['ss_1_1','ss_6_1','ss_8_1']),{foes:1}); setStack(L,'rfRhy',2); near(cp(),0.004*5*2,'Rhythm of Steel 0.4% x 5 per Crossdraw (4 s)');
  RF(L).sw=true; RF(L).xd=true; L.T.s.cur='rfShot'; near(cp(),0.05,'Never Same Twice: a Crossdraw +4% x 3 (held at 5%)'); L.T.s.cur=null; RF(L).sw=false;
  /* one seeded roll a hit: about that share of plain hits crit */
  L=lab(H,S(['fs_1_2']),{foes:1}); nrm(L); let n=0; for(let i=0;i<2000;i++){ L.F[0]._critHit=false; V.hit(L.v,L.F[0],10,{kind:'phys'}); if(L.F[0]._critHit) n++; }
  assert.ok(n>60&&n<150,'5% of 2000 hits crit: '+n);
});

test('Rafe / Every Man Has a Tell: his target drops past 75 / 50 / 25%: 20% x 5 (every time at 5/5) his count moves on by 1, never past the shot',()=>{
  const L=lab(H,S(['fs_n1']),{foes:1}), {v,F}=L, f=F[0]; v.target=f; v._piN=0; V.step(1);
  f.hp=f.maxHp*0.74; V.step(1); assert.equal(v._piN,1,'past 75%'); f.hp=f.maxHp*0.70; V.step(1); assert.equal(v._piN,1,'not again above 50%');
  f.hp=f.maxHp*0.2; V.step(1); assert.equal(v._piN,3,'past 50% and 25% together: 2 more'); f.hp=f.maxHp; V.step(1); delete L.T.s.rf.tl[f.uid]; V.step(1); f.hp=f.maxHp*0.1; V.step(1); assert.equal(v._piN,3,'never past the swing that fires it');
  const L2=lab(H,[['fs_n1',1]],{foes:1}); L2.v.target=L2.F[0]; L2.v._piN=0; V.step(1); let k=0; for(let i=0;i<300;i++){ const g=L2.F[0]; g.hp=g.maxHp; delete L2.T.s.rf.tl[g.uid]; V.step(1); L2.v._piN=0; g.hp=g.maxHp*0.7; V.step(1); k+=L2.v._piN; }
  assert.ok(k>30&&k<95,'rank 1: 20% of 300 drops: '+k);
});

test('Rafe / Holes: Through the Coat (an instinct shot Holes for 5 s, max 3; 3% x 3 armor per Hole), Breastplate Next, Closed Door, Riddled, Wrecked Plate, Bored Through',()=>{
  const L=lab(H,S(['fs_1_4','fs_2_4','fs_4_4','fs_5_4','fs_11_4','fs_7_4']),{foes:2}), {v,F}=L, f=F[0]; nrm(L);
  hitAs(L,INST,f,10); assert.equal(ust(L,f,'rfHole'),1,'one Hole'); hitAs(L,INST,f,10); hitAs(L,INST,f,10); hitAs(L,INST,f,10); assert.equal(ust(L,f,'rfHole'),3,'max 3');
  near(left(L,f,'#rfHole'),8,'5 s + Breastplate Next 1 x 3',0.05);
  setUst(L,f,'rfHole',2); near(ratioAs(L,SHOT,f),defK(v,f,0.18)*defK(v,f,0.10)*1.10,'2 Holes: 9% x 2 of its armor (with Bored Through 10%), Wrecked Plate 1% x 5 per Hole',1e-6);
  setUst(L,f,'rfHole',3); near(ratioAs(L,SHOT,f),defK(v,f,0.27)*defK(v,f,0.10)*1.15*1.15,'3 Holes: Riddled 3% x 5 more',1e-6);
  setUst(L,f,'rfHole',1); near(ratioAs(L,INST,f),1.12*1.05,'Closed Door: 4% x 3 more true damage from the instinct shot (true damage: no armor)',1e-6);
  setUst(L,f,'rfHole',0); near(ratioAs(L,SHOT,F[1]),defK(v,F[1],0.10),'no Holes: Bored Through alone',1e-6);
  const L2=lab(H,S(['fs_1_4']),{foes:1}); hitAs(L2,INST,L2.F[0],10); secs(5.05); assert.equal(ust(L2,L2.F[0],'rfHole'),0,'5 s without Breastplate Next');
});

test('Rafe / Barrage of Holes, Hole Passed On, Rust, Splinters, Powder Burn',()=>{
  const L=lab(H,S(['fs_1_4','fs_7_3','fs_8_4','fs_9_4','fs_6_4','fs_10_3']),{foes:3,allies:1}), {v,A,F}=L; nrm(L);
  setUst(L,F[0],'rfHole',1); V.cast(v,'green'); secs(0.3); assert.equal(ust(L,F[0],'rfHole'),2,'a bullet on a Holed enemy: one more'); assert.equal(ust(L,F[1],'rfHole'),0,'on an enemy with none: none');
  V.step(1); const a0=F[1].dmg; setUst(L,F[1],'rfHole',3); V.step(1); near(F[1].dmg/a0,1-0.025*3,'Rust: 0.5% x 5 less attack per Hole',1e-9); setUst(L,F[1],'rfHole',0); secs(0.1); near(F[1].dmg,a0,'back');
  setUst(L,F[1],'rfHole',2); near(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})),1040,'Splinters: an ally\'s hit on a Holed enemy 2% x 2 more'); setUst(L,F[1],'rfHole',0); near(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})),1000,'not Holed: plain');
  setUst(L,F[1],'rfHole',1); near(hitAs(L,SHOT,F[1],1000,{crit:true})/plainHit(L,()=>hitAs(L,SHOT,F[1],1000,{crit:true})),defK(v,F[1],0.09)*1.10,'Powder Burn: 2% x 5 on a critical hit (at most 10%)',1e-6);
  setUst(L,F[0],'rfHole',3); F[0].hp=1; V.hit(v,F[0],1e5,{kind:'true'}); assert.ok(!F[0].alive); assert.equal(ust(L,F[1],'rfHole'),3,'Hole Passed On: 1 x 3 of its Holes to the enemy nearest it (F1 at 5.5 m)');
});

test('Rafe / Counting Out Loud, Third Is Yours (PICK ONE: every third swing, 75%), Quick Hand, Fourth Is Mine (PICK ONE: always critical), Marked Card, Long Count',()=>{
  let L=lab(H,S(['fs_1_1','fs_2_1']),{foes:4}), {v}=L; v._piN=0; V.cast(v,'green'); assert.equal(v._piN,3,'Counting Out Loud: 1 x 3 swings (the next swing fires it)');
  L=lab(H,S(['fs_5_3','fs_6_3','fs_5_1']),{foes:1}); ({v}=L); v._piN=2; FX.pass(v,L.F[0],'rfPre'); assert.equal(v._piN,3,'Third Is Yours: after 2 swings the third fires it'); v._piN=1; FX.pass(v,L.F[0],'rfPre'); assert.equal(v._piN,1);
  near(ratioAs(L,INST,L.F[0]),(0.75+0.0375*3)*1.15,'75% x 1.05 per rank of Quick Hand (86.25%), Long Count 3% x 5',1e-6);
  near(ratioAs(L,SHOT,L.F[0]),1,'only the instinct shot');
  L=lab(H,S(['fs_5_2','fs_6_2']),{foes:1}); nrm(L); L.F[0]._critHit=false; const d=hitAs(L,INST,L.F[0],1000); assert.ok(L.F[0]._critHit,'Fourth Is Mine: the instinct shot is critical'); near(d,1000*1.6*1.15,'Marked Card: its crit 5% x 3 more (an ability: at most 20%)',1e-6);
  L.F[0]._critHit=false; hitAs(L,SHOT,L.F[0],1000); assert.ok(!L.F[0]._critHit,'a pistol shot is not');
});

test('Rafe / Dealt Clean (half to the enemy behind), Nothing in the Way (15% x 3 past a shield), Four Is Honest (SIGNATURE)',()=>{
  let L=lab(H,S(['fs_3_1']),{foes:3}), {v,F}=L; nrm(L);
  const h1=F[1].hp, d=hitAs(L,INST,F[0],1000); near(h1-F[1].hp,d*0.5,'F1 stands behind F0 on his line: half the shot'); const h2=F[2].hp; assert.equal(F[2].hp,h2);
  at(L,F[1],10,6); const h3=F[1].hp; hitAs(L,INST,F[0],1000); near(F[1].hp,h3,'off the line: nothing');
  L=lab(H,S(['fs_12_4']),{foes:1}); ({v,F}=L); nrm(L); const f=F[0]; f.shield=500; f.shieldT=99; const hp0=f.hp; hitAs(L,INST,f,1000);
  near(hp0-f.hp,500,'45% of the shot goes past the shield to its HP (450), the shield (500) takes 500 of the other 550'); near(f.shield,0); f.shield=5000; f.shieldT=99; const hp1=f.hp; hitAs(L,INST,f,1000); near(hp1-f.hp,450); near(5000-f.shield,550,'a big shield absorbs 55%');
  /* the signature */
  L=lab(H,S(['fs_13_4']),{foes:4}); ({v,F}=L); nrm(L); at(L,F[3],21,0.5);
  hitAs(L,INST,F[0],1000); assert.equal(stack(L,'rfCard'),1,'not Holed: no line (it Holes it and deals a Card)'); assert.equal(ust(L,F[0],'rfHole'),1);
  setUst(L,F[0],'rfHole',3); const b=[F[1].hp,F[2].hp,F[3].hp,F[4]?F[4].hp:0]; const dd=hitAs(L,INST,F[0],1000);
  near(b[0]-F[1].hp,Math.min(dd,2*v.dmg),'3 Holes: every enemy on the line behind takes the shot (at most 200% of his attack)'); near(b[1]-F[2].hp,Math.min(dd,2*v.dmg)); near(b[2]-F[3].hp,Math.min(dd,2*v.dmg),'21 m behind, 0.5 m off the line');
  assert.equal(ust(L,F[1],'rfHole'),3,'and gains as many Holes'); assert.equal(stack(L,'rfCard'),4,'then he draws 4 Cards');
  const c=[F[1].hp]; hitAs(L,INST,F[0],1000); near(F[1].hp,c[0],'once every 18 s'); secs(17.9); setUst(L,F[0],'rfHole',1); hitAs(L,INST,F[0],1000); near(F[1].hp,c[0],'(not at 17.9 s)');
  secs(0.2); setUst(L,F[0],'rfHole',1); const e=F[1].hp, d2=hitAs(L,INST,F[0],100); near(e-F[1].hp,d2*0.5,'1 Hole: half');
});

test('Rafe / Spare Pistol (20% x 3: a fifth bullet), Hot Barrels, Lead Rain, Quick Reload, Cannon Smoke, Smoking Barrel',()=>{
  let L=lab(H,S(['fs_4_3']),{foes:5}), {v,F}=L; nrm(L); let n=0;
  for(let i=0;i<60;i++){ const h=F[2].hp; V.cast(v,'green'); secs(0.25); if(F[2].hp<h) n++; } assert.ok(n>22&&n<50,'60% of 60 Barrages reach F2, the fifth nearest: '+n);
  L=lab(H,S(['fs_4_3']),{foes:2}); ({v,F}=L); nrm(L); n=0; for(let i=0;i<40;i++){ const h=F[0].hp, h1=F[1].hp; V.cast(v,'green'); secs(0.25); const a=h-F[0].hp, b=h1-F[1].hp; if(a>b*1.5) n++; } assert.ok(n>10,'fewer than five enemies: the fifth bullet hits the nearest ('+n+' of 40)');
  L=lab(H,S(['fs_2_3','fs_8_3']),{foes:1}); nrm(L); near(ratioAs(L,BUL,L.F[0]),1.15,'Hot Barrels 3% x 5'); near(hitAs(L,BUL,L.F[0],1000,{crit:true})/plainHit(L,()=>hitAs(L,BUL,L.F[0],1000,{crit:true})),1.15*1.20,'Lead Rain: its crits 4% x 5 more',1e-6);
  near(ratioAs(L,SHOT,L.F[0]),1,'a pistol swing is not a bullet');
  L=lab(H,S(['fs_3_3','ss_11_2']),{foes:1}); near(FX.cd(L.v,'green',6),6-0.75-0.75,'Quick Reload and Cannon Smoke: 0.15 x 5 s each'); near(FX.cd(L.v,'blue',9),9);
  L=lab(H,S(['fs_11_3']),{foes:2}); ({v,F}=L); nrm(L); near(ratioAs(L,SHOT,F[0]),1,'no Barrage yet'); V.cast(v,'green'); secs(0.3); near(ratioAs(L,SHOT,F[0]),1.25,'after it, the next basic attack 5% x 5'); near(ratioAs(L,SHOT,F[0]),1,'only the next');
});

test('Rafe / Full House (at 4 Cards basic attacks 15%), Ace Up the Sleeve (below 30%: 4 Cards, once a wave), Saltwater Luck (0.6% x 5 less per Card, inside the 35% group)',()=>{
  const L=lab(H,S(['fs_7_1','fs_11_1','fs_12_2']),{foes:1}), {v,F}=L; nrm(L);
  setStack(L,'rfCard',3); near(ratioAs(L,SHOT,F[0]),1); setStack(L,'rfCard',4); near(ratioAs(L,SHOT,F[0]),1.15,'4 Cards'); near(ratioAs(L,BUL,F[0]),1,'basic attacks only');
  setStack(L,'rfCard',0); v.maxHp=1e6; v.hp=0.5e6; V.hit(F[0],v,100,{kind:'true'}); assert.equal(stack(L,'rfCard'),0); v.hp=0.29e6; V.hit(F[0],v,100,{kind:'true'}); assert.equal(stack(L,'rfCard'),4,'below 30%');
  setStack(L,'rfCard',0); V.hit(F[0],v,100,{kind:'true'}); assert.equal(stack(L,'rfCard'),0,'once a wave'); V.wave(); V.step(1); V.hit(F[0],v,100,{kind:'true'}); assert.equal(stack(L,'rfCard'),4,'again next wave');
  setStack(L,'rfCard',4); v.hp=0.9e6; near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true'})),1000*(1-0.03*4),'Saltwater Luck: 4 Cards x 0.6% x 5');
});

test('Rafe / Fortune\'s Count (every Dead Man\'s Fortune shot is an instinct shot), Last Shot Owed, Seven Chairs, Long Barrel',()=>{
  let L=lab(H,S(['fs_9_2','fs_10_2','fs_1_1','fs_1_4']),{foes:5}), {v,F}=L; nrm(L);
  const hp=F.map(f=>f.hp); ult(L); secs(0.4); for(const f of F) assert.equal(ust(L,f,'rfHole'),1,'each shot was an instinct shot: a Hole'); assert.equal(stack(L,'rfCard'),4,'and a Card (max 4)');
  void hp;
  L=lab(H,S(['fs_10_2']),{foes:1}); nrm(L); near(ratioAs(L,DMF,L.F[0]),1.15,'Last Shot Owed 3% x 5');
  L=lab(H,S(['fs_12_1']),{foes:4}); ({v,F}=L); const a0=v.dmg; for(const f of F.slice(0,3)){ f.hp=1; V.hit(v,f,100,{kind:'true'}); } V.step(1); near(v.dmg/a0,1.09,'Seven Chairs: 1% x 3 attack per kill',1e-9);
  const r0=plain({foes:1},P=>P.v.range); L=lab(H,S(['fs_12_3']),{foes:1}); near(L.v.range-r0,2*V.METER,'Long Barrel: 1 m x 2');
});

/* ============================== THE COLLECTOR ============================== */
test('Rafe / At the Table: the hook\'s catch (4 s, Stay Seated 0.3 x 5), 2% x 5 more from him, Hear What You Owe (+0.8 s), Tight Knots (+0.06 x 5), Whole Table, Dragged Back',()=>{
  const L=lab(H,S(['co_1_1','co_4_1','co_2_1','co_3_1','co_11_4','co_9_1','co_6_1']),{foes:3}), {v,F}=L; nrm(L); nl(L);
  at(L,F[0],4.5,-6); at(L,F[1],10,0); at(L,F[2],11,4.2); const f=F[1];
  near(stunOf(f,()=>V.cast(v,'blue',f)),2.45+0.3,'Tight Knots',1e-6); assert.ok(mark(L,f,'rfTab'),'caught: At the Table'); near(left(L,f,'rfTab'),5.5,'4 + 1.5 s',0.05);
  assert.ok(mark(L,F[2],'rfTab'),'Whole Table: an enemy within 2 m of it too'); assert.ok(!mark(L,F[0],'rfTab'),'not one farther');
  near(ratioAs(L,SHOT,f),1.10,'Back to the Table 2% x 5');
  near(stunOf(f,()=>V.cast(v,'blue',f)),2.45+0.3+0.8,'already At the Table: 0.8 s longer',1e-6);
  const g=plain({foes:2},P=>{ nl(P); at(P,P.F[1],10,0); const h=P.F[1].hp; V.cast(P.v,'blue',P.F[1]); return h-P.F[1].hp; }); const L2=lab(H,S(['co_6_1']),{foes:2}); nl(L2); at(L2,L2.F[1],10,0); const h=L2.F[1].hp; V.cast(L2.v,'blue',L2.F[1]); near(h-L2.F[1].hp,g*1.15,'Dragged Back 3% x 5',1e-6);
  const L3=lab(H,S(['co_2_1']),{foes:2}); nl(L3); at(L3,L3.F[1],15,0); const x0=L3.F[1].x; V.cast(L3.v,'blue',L3.F[1]); near((x0-L3.F[1].x)/V.METER,8,'Long Rope: the pull 5 + 1 x 3 m',1e-6);
});

test('Rafe / Last Chair Pulled (the farthest enemy in reach, all the way back), Duel Ready (the next two swings are Crossdraws), Hook Through the Haze (LINK)',()=>{
  let L=lab(H,S(['co_6_1','co_7_1']),{foes:3}), {v,F}=L; nl(L); at(L,F[2],20,0);
  const h2=F[2].hp, h0=F[0].hp; hookShot(L,F[0]); secs(1.2); assert.ok(F[2].hp<h2&&F[0].hp===h0,'the hook went to the farthest (F2, 20 m), not to his target'); near(Math.hypot(F[2].x-v.x,F[2].y-v.y)/V.METER,V.bodyR(v)+V.bodyR(F[2])+0.1,'pulled all the way back to him (the bodies touch: the hook\'s own pull finishes the last 0.2 m)',0.04);
  L=lab(H,S(['ss_1_1','ss_9_4']),{foes:2}); ({v,F}=L); nrm(L); nl(L);
  swing(L,'p',F[0]); near(ratioAs(L,SHOT,F[0]),1); V.cast(v,'blue',F[1]); near(ratioAs(L,SHOT,F[0]),1.20,'Duel Ready: a Crossdraw'); near(ratioAs(L,SHOT,F[0]),1.20,'and the next'); near(ratioAs(L,SHOT,F[0]),1,'two only');
  L=lab(H,S(['ss_n1','ss_1_2','co_1_1']),{foes:2}); ({v,F}=L); nl(L); setMk(L,F[1],'rfSmk',9);
  const g=plain({foes:2},P=>{ nl(P); const h=P.F[1].hp; V.cast(P.v,'blue',P.F[1]); return h-P.F[1].hp; }); const h=F[1].hp; V.cast(v,'blue',F[1]); near((h-F[1].hp)/g,1.10,'10% more on a Smoked enemy',1e-6);
  near(left(L,F[1],'rfTab'),5,'with Back to the Table: a Smoked catch stays 1 s longer',0.05);
  L=lab(H,S(['ss_n1','ss_1_2']),{foes:2}); nl(L); setMk(L,L.F[1],'rfSmk',9); V.cast(L.v,'blue',L.F[1]); assert.ok(!mark(L,L.F[1],'rfTab'),'without it nobody is At the Table');
});

test('Rafe / Coins: a death within 4 s of his hit (Collecting 0.4% x 3 attack each), Count It Twice, Heavy Purse, Interest, Pocket Change, Ship\'s Purse, Full Purse',()=>{
  let L=lab(H,S(['co_1_3','co_2_3','co_3_3','co_8_3','co_6_4','co_12_3','co_10_3']),{foes:4}), {v,F}=L; nrm(L);
  assert.equal(stack(L,'rfCoin'),2,'Ship\'s Purse: 1 x 2 at the start'); V.step(1); assert.equal(stack(L,'rfCoin'),2,'once a fight');
  const a0=v.dmg, ls0=v.lifestealStat||0, m0=v.maxHp/(1+0.005*2*2);
  V.hit(v,F[0],10,{kind:'true'}); secs(3.9); V.dmg(F[0],2e9); assert.ok(!F[0].alive); assert.equal(stack(L,'rfCoin'),3,'his hit 3.9 s before: a Coin');
  V.hit(v,F[1],10,{kind:'true'}); secs(4.1); V.dmg(F[1],2e9); assert.equal(stack(L,'rfCoin'),3,'4.1 s: none');
  setMk(L,F[2],'rfTab',9); V.dmg(F[2],2e9); assert.equal(stack(L,'rfCoin'),5,'Count It Twice: At the Table, 2 (with or without his hit)');
  V.step(1); near(v.dmg/a0,(1+0.012*5)/(1+0.012*2),'Collecting 0.4% x 3 attack per Coin',1e-9); near((v.lifestealStat||0)-ls0,0.006*3,'Interest 0.2% x 3 lifesteal per Coin',1e-9); near(v.maxHp/m0,1+0.01*5,'Pocket Change 0.5% x 2 max HP per Coin',1e-9);
  near(L.T.fn.critP(API(),L.T,v,{}),0.009*5*0+Math.min(0.05,0.009*5),'Heavy Purse 0.3% x 3 per Coin: 4.5%');
  setStack(L,'rfCoin',6); near(ratioAs(L,SHOT,F[3]),1); setStack(L,'rfCoin',7); near(ratioAs(L,SHOT,F[3]),1.15,'Full Purse at 7');
  L=lab(H,S(['co_1_3']),{foes:2}); setStack(L,'rfCoin',7); V.hit(L.v,L.F[0],10,{kind:'true'}); L.F[0].hp=1; V.hit(L.v,L.F[0],100,{kind:'true'}); assert.equal(stack(L,'rfCoin'),7,'max 7');
});

test('Rafe / Run Them Down (PICK ONE: a Table death readies the hook), No Door Left, Collector\'s Patience, Settle Up (PICK ONE), Paid in Blood, Bound at the Table, Still Hungry',()=>{
  let L=lab(H,S(['co_5_3','co_6_3','co_11_1']),{foes:3}), {v,F}=L; nrm(L); nl(L);
  v.blueCd=7; v.hp=v.maxHp*0.5; const hv=v.hp; setMk(L,F[0],'rfTab',9); V.dmg(F[0],2e9); near(v.blueCd,0,'a Table death: the hook is ready'); near(v.hp-hv,v.maxHp*0.06,'Collector\'s Patience 2% x 3 of max HP');
  const g=plain({foes:3},P=>{ nl(P); const h=P.F[1].hp; V.cast(P.v,'blue',P.F[1]); return h-P.F[1].hp; }); let h=F[1].hp; V.cast(v,'blue',F[1]); near((h-F[1].hp)/g,1.24,'No Door Left: the next hook 8% x 3',1e-6);
  h=F[2].hp; V.cast(v,'blue',F[2]); near((h-F[2].hp)/g,1,'only that one',1e-6);
  L=lab(H,S(['co_5_2','co_6_2','co_10_1']),{foes:1}); ({v,F}=L); nrm(L); v.hp=v.maxHp*0.5; setMk(L,F[0],'rfTab',9);
  let hv2=v.hp; const d=swing(L,'c',F[0]); near(v.hp-hv2,d*0.19,'Settle Up 10% + Paid in Blood 3% x 3 of the cutlass hit'); hv2=v.hp; swing(L,'p',F[0]); near(v.hp,hv2,'the pistol: no');
  near(ratioAs(L,SHOT,F[0]),1); F[0].hp=F[0].maxHp*0.4; near(ratioAs(L,SHOT,F[0]),1.15,'Still Hungry below 50% At the Table');
  L=lab(H,S(['co_8_1']),{foes:1}); setMk(L,L.F[0],'rfTab',9); L.F[0].hp=L.F[0].maxHp*0.5; let hf=L.F[0].hp; V.heal(L.F[0],1000); near(L.F[0].hp-hf,1000*0.85,'Bound at the Table: 3% x 5 less healing');
});

test('Rafe / Sword Argument, Point Made, Biting Reply, Edge of the Blade, Sharp Practice, Saber for Arguers, Coins Thrown, Thrown After, Coin Spin',()=>{
  let L=lab(H,S(['co_11_2','co_10_2','co_8_2','co_2_2','co_4_2','co_5_4']),{foes:1}), {v,F}=L, f=F[0]; nrm(L);
  setMk(L,f,'rfTab',1); swing(L,'c',f); near(left(L,f,'rfTab'),4,'Sword Argument: its time At the Table starts again',0.05);
  near(f.slowMul,1-0.15,'Point Made: 3% x 5 slower',1e-9); near(f.slow,1,'for 1 s',0.05);
  near(ratioAs(L,CUT,f),1.15,'Saber for Arguers 3% x 5'); near(ratioAs(L,SHOT,f),1,'not the pistol');
  near(hitAs(L,CUT,f,1000,{crit:true})/plainHit(L,()=>hitAs(L,CUT,f,1000,{crit:true})),1.15*1.09*1.10,'Edge of the Blade 3% x 3, Sharp Practice 2% x 5 (At the Table) on its crits',1e-6);
  at(L,f,4.5,0); V.hit(f,v,10,{kind:'true'}); near(ratioAs(L,CUT,f),1.15*1.20,'Biting Reply: an enemy within 2.5 m hit him: the next cutlass hit 4% x 5'); near(ratioAs(L,CUT,f),1.15,'only the next');
  at(L,f,10,0); V.hit(f,v,10,{kind:'true'}); near(ratioAs(L,CUT,f),1.15,'an enemy farther away: no');
  L=lab(H,S(['co_10_3','co_11_3','co_7_3','co_9_3']),{foes:5}); ({v,F}=L); nrm(L); setStack(L,'rfCoin',3);
  near(ratioAs(L,DMF,F[0]),1.15*1.15,'Coin Spin and Thrown After',1e-6); ult(L); secs(0.4); assert.ok(mark(L,F[0],'rfThr'),'Coins Thrown: each enemy its shots hit');
  near(ratioAs(L,SHOT,F[0]),1.12,'4% per Coin for 4 s'); setStack(L,'rfCoin',7); near(ratioAs(L,SHOT,F[0]),1.28*1.15,'up to 28% (Full Purse at 7 too)'); secs(4.1); near(ratioAs(L,SHOT,F[0]),1.15,'4 s');
});

test('Rafe / Fair Warning (his first hit on each enemy At the Table is critical, 3% x 3 more), Sea Legs, Duelist\'s Habit, Salt Lantern (capped at 20%), Hook Speed',()=>{
  let L=lab(H,S(['co_12_1','co_1_1']),{foes:2}), {v,F}=L; nrm(L); nl(L);
  V.cast(v,'blue',F[1]); F[1]._critHit=false; const d=hitAs(L,SHOT,F[1],1000); assert.ok(F[1]._critHit,'the first hit after the catch: critical');
  F[1]._critHit=false; const d2=hitAs(L,SHOT,F[1],1000); assert.ok(!F[1]._critHit,'the second: not'); near(d/d2,1.6*1.09,'and 3% x 3 more',1e-6);
  L=lab(H,S(['co_12_4','co_7_2','co_3_2','co_4_4','co_1_1']),{foes:1}); ({v,F}=L); const mr0=v.mrRating, ai=v.atkInterval;
  setMk(L,F[0],'rfTab',9); V.step(1); near(v.mrRating/mr0,1.09,'Sea Legs: 3% x 3 while an enemy is At the Table',1e-9); near(v.atkInterval,ai,'his target is not in cutlass reach');
  v.target=F[0]; at(L,F[0],2,0); V.step(1); near(ai/v.atkInterval,1.10,'Duelist\'s Habit: 2% x 5 faster swings while his target is in cutlass reach',1e-6);
  near(FX.cc(F[0],v,'stunned',2),2*0.80,'Salt Lantern 4% x 5 shorter'); assert.equal(FXN.mech(H).talents.co_3_2[0].upTo,0.20,'capped at 20%');
  near(FX.cd(v,'blue',9),9-0.9,'Hook Speed 0.3 x 3 s');
});

test('Rafe / The Last Chair (SIGNATURE): once every 25 s the hook\'s stun lasts 2 s longer, every hit of his on it is critical and pays a Coin (up to 2); dead before it ends: 7 Coins',()=>{
  const L=lab(H,S(['co_12_1','co_13_1','co_1_3']),{foes:3}), {v,F}=L; nrm(L); nl(L); const f=F[1];
  near(stunOf(f,()=>V.cast(v,'blue',f)),4.0,'2 s longer: 4.45 s, cut at the stun ceiling of 4.0 s',1e-6); assert.ok(mark(L,f,'rfHeld'),'held'); near(left(L,f,'rfHeld'),4.0,'as long as the stun',0.05);
  for(let i=0;i<3;i++){ f._critHit=false; hitAs(L,SHOT,f,10); assert.ok(f._critHit,'critical '+i); } assert.equal(stack(L,'rfCoin'),2,'a Coin each, up to 2');
  f.hp=1; V.hit(v,f,100,{kind:'true'}); assert.equal(stack(L,'rfCoin'),7,'dead before the stun ended: Coins fill to 7');
  near(stunOf(F[2],()=>V.cast(v,'blue',F[2])),2.45,'once every 25 s',1e-6); secs(24.9); near(stunOf(F[2],()=>V.cast(v,'blue',F[2])),2.45,'(not at 24.9 s)',1e-6);
  secs(0.2); near(stunOf(F[2],()=>V.cast(v,'blue',F[2])),4.0,'25 s later: held again',1e-6);
});

/* ============================== SABER AND SMOKE ============================== */
test('Rafe / Crossdraw (the weapon switched: 4% x 5), Quick Draw, Crossed Blades, Salt in the Wound, Feint and Fire, Ambidextrous, Both Hands',()=>{
  const L=lab(H,S(['ss_1_1','ss_2_1','ss_7_1','ss_11_4','ss_9_1','ss_12_1','ss_3_1']),{foes:2}), {v,F}=L, f=F[0]; nrm(L);
  swing(L,'p',f); near(ratioAs(L,SHOT,f),defK(v,f,0)*1,'pistol after pistol: not a Crossdraw');
  swing(L,'p',f); const c=swing(L,'c',f), p=plainHit(L,()=>swing(L,'c',f)); near(c/p,defK(v,f,0.15)*1.20,'cutlass after pistol: a Crossdraw (Crossed Blades 3% x 5 of armor)',1e-6);
  V.step(1); const ai=v.atkInterval; void ai;
  secs(2.1); const ai0=v.atkInterval; swing(L,'c',f); swing(L,'p',f); assert.ok(win(L,'rfQd'),'Quick Draw: a Crossdraw'); V.step(1); near(ai0/v.atkInterval,1.09,'3% x 3 attack speed',1e-6); secs(2.05); near(v.atkInterval,ai0,'for 2 s',1e-6);
  swing(L,'c',f); v.blueCd=5; v.hp=v.maxHp*0.5; RF(L).bud=v.maxHp; const hv=v.hp; swing(L,'p',f); near(v.blueCd,4.5,'Feint and Fire 0.1 x 5 s off the hook'); near(v.hp-hv,v.maxHp*0.015,'Ambidextrous 0.5% x 3 of max HP',1e-6);
  swing(L,'c',f); const cr=hitAs(L,SHOT,f,1000,{crit:true}); swing(L,'c',f); RF(L).lw='c'; const cp=plainHit(L,()=>hitAs(L,SHOT,f,1000,{crit:true})); near(cr/cp,defK(v,f,0.15)*1.20*1.10,'Salt in the Wound: a critical Crossdraw 2% x 5 more (at most 10%)',1e-3);
  /* Both Hands: a cutlass-to-pistol Crossdraw fires an extra instinct shot, once every 4 s */
  secs(4.1); swing(L,'c',f); const tot=swing(L,'p',f); swing(L,'c',f); const one=swing(L,'p',f); near(tot-one,v.dmg*VMX('rageMul')*VMX('instinctDmg')(v),'Both Hands: the instinct shot (the swing\'s damage x his passive\'s share, true), once every 4 s',1e-6);
});

test('Rafe / Smoke: a Barrage bullet Smokes 3 s (Thick Smoke 0.3 x 5); a Smoked enemy\'s basic attacks miss 3% x 3 (on him and on his allies); Dirty Fighting, Gun Smoke',()=>{
  const L=lab(H,S(['ss_1_2','ss_2_2','ss_5_4','ss_6_4']),{foes:4,allies:1}), {v,A,F}=L; nrm(L);
  V.cast(v,'green'); secs(0.25); for(const f of F) assert.ok(mark(L,f,'rfSmk'),'Smoked'); near(left(L,F[0],'rfSmk'),4.5-0.25,'3 + 1.5 s',0.1);
  near(ratioAs(L,SHOT,F[0]),1.10,'Dirty Fighting 2% x 5');
  let m=0, ma=0, sk=0; for(let i=0;i<800;i++){ v.hp=v.maxHp; if(lost(v,()=>V.hit(F[0],v,10,{kind:'phys',auto:true}))===0) m++; if(lost(A[0],()=>V.hit(F[0],A[0],10,{kind:'phys',auto:true}))===0) ma++; if(lost(v,()=>V.hit(F[0],v,10,{kind:'phys'}))===0) sk++; setMk(L,F[0],'rfSmk',9); }
  assert.ok(m>35&&m<115,'9% of 800 basic attacks on him miss: '+m); assert.ok(ma>35&&ma<115,'and on an ally: '+ma); assert.equal(sk,0,'skills do not miss');
  L.F[1]._talM[v.uid].rfSmk.until=V.now(); let n=0; for(let i=0;i<300;i++){ if(lost(v,()=>V.hit(F[1],v,10,{kind:'phys',auto:true}))===0) n++; } assert.equal(n,0,'not Smoked: never');
  at(L,F[3],10,0); delete F[3]._talM; swing(L,'p',F[3]); near(left(L,F[3],'rfSmk'),2,'Gun Smoke: a pistol swing Smokes 1 s x 2',0.05);
});

test('Rafe / Sea Dog (each evade and each Smoked miss on him heals 0.4% x 5, inside the 1.2%-a-second budget), Choking (0.3 s stun, the stun-lock rule), Lingering Smoke, Smoke Thief',()=>{
  const L=lab(H,S(['ss_1_2','ss_1_4','ss_2_2','ss_3_2','ss_8_2','ss_12_2']),{foes:2}), {v,F}=L, f=F[0]; nrm(L);
  v.maxHp=1e6; v.hp=0.5e6; v.evaStat=1; RF(L).bud=v.maxHp*0.012; let h=v.hp; V.hit(f,v,100,{kind:'phys'}); near(v.hp-h,v.maxHp*0.012,'an evade (the game\'s Evasion): 2% asked, the budget (1.2% of max HP) gives 1.2%');
  h=v.hp; V.hit(f,v,100,{kind:'phys'}); near(v.hp-h,0,'the budget is spent'); secs(1); h=v.hp; V.hit(f,v,100,{kind:'phys'}); near(v.hp-h,v.maxHp*0.012,'a second later it is back',0.02); v.evaStat=0;
  /* Smoked misses: make every attack of f miss through the row (Full of Smoke at a forced 100%) */
  for(const rw of L.T.on.in) if(rw.id==='ss_1_2') rw.chance=1; for(const rw of L.T.on.teamIn||[]) if(rw.id==='ss_1_2') rw.chance=1;
  setMk(L,f,'rfSmk',1); f.stunned=0; v.energy=0; RF(L).bud=v.maxHp; h=v.hp; V.hit(f,v,100,{kind:'phys',auto:true});
  near(v.hp-h,v.maxHp*0.02,'Sea Dog on a Smoked miss'); near(f.stunned,0.3,'Choking: stunned 0.3 s',1e-9); near(v.energy,5,'Smoke Thief: 1 x 5 energy'); near(left(L,f,'rfSmk'),2,'Lingering Smoke: 0.2 x 5 s longer',0.02);
  V.hit(f,v,100,{kind:'phys',auto:true}); near(f.stunned,0.3,'already stunned: no second stun',1e-9);
  secs(0.31); assert.ok(!(f.stunned>0)); V.hit(f,v,100,{kind:'phys',auto:true}); assert.ok(!(f.stunned>0),'within 0.5 s after his stun ended: no');
  secs(0.6); V.hit(f,v,100,{kind:'phys',auto:true}); near(f.stunned,0.3,'later: the second',1e-9); secs(1); V.hit(f,v,100,{kind:'phys',auto:true}); assert.ok(!(f.stunned>0),'at most twice in 10 s'); secs(10); setMk(L,f,'rfSmk',9); V.hit(f,v,100,{kind:'phys',auto:true}); assert.ok(f.stunned>0,'10 s later again');
});

test('Rafe / Dead Man\'s Fortune: Fortune\'s Favour (0.3 x 3 s), Lucky Coat (2 points x 5), Weathered Coat, Slippery Corsair, Vanishing Act, Blaze of Fortune',()=>{
  const L=lab(H,S(['ss_3_3','ss_4_3','ss_12_4','ss_7_3','ss_7_2','ss_9_3','ss_1_2']),{foes:5}), {v,F}=L; nrm(L); const mr0=v.mrRating, a0=v.dmg;
  ult(L); near(v.evaStat,0.60,'50% + 2 x 5 points'); near(v._miragT,3.9,'3 + 0.3 x 3 s'); V.step(1); near(v.mrRating/mr0,1.15,'Weathered Coat 5% x 3',1e-9);
  at(L,F[0],4.5,0); V.step(2); assert.ok(mark(L,F[0],'rfSmk'),'Vanishing Act: an enemy within 3 m is Smoked'); assert.ok(!mark(L,F[2],'rfSmk')||left(L,F[2],'rfSmk')>1,'(one farther only by a bullet)');
  v.evaStat=1; V.hit(F[1],v,10,{kind:'phys'}); V.step(1); near(v.dmg/a0,1.10,'Slippery Corsair: an evade during it, 2% x 5 attack for 4 s',1e-9);
  near(ratioAs(L,DMF,F[1]),1.15,'Blaze of Fortune 3% x 5'); v.evaStat=0.6;
  secs(4.2); near(v.dmg,a0,'Slippery Corsair: 4 s',1e-6); v._miragT=0; V.step(1); near(v.mrRating,mr0,'once his evasion ends (a held lab Rafe\'s clock stands still: ended by hand)',1e-6);
  const L2=lab(H,S(['ss_4_3']),{foes:5}); L2.v.evaStat=0.3; ult(L2); near(L2.v.evaStat,0.75,'the game\'s own 75% ceiling on Evasion holds');
});

test('Rafe / Ghost Ship (once a wave a hit that would drop him below 25% is evaded, then 2 s of Dead Man\'s Fortune\'s evasion), Room Full of Smoke (SIGNATURE)',()=>{
  let L=lab(H,S(['ss_11_3','ss_4_3']),{foes:2}), {v,F}=L; v.maxHp=1e6; v.hp=0.3e6;
  near(lost(v,()=>V.hit(F[0],v,1e4,{kind:'true'})),1e4,'a hit that leaves him above 25%: lands'); const h=v.hp; near(lost(v,()=>V.hit(F[0],v,1e5,{kind:'true'})),0,'one that would drop him below 25%: evaded');
  near(v.evaStat,0.5+0.1,'Dead Man\'s Fortune\'s evasion (Lucky Coat too)'); near(v._miragT,2,'2 s'); near(lost(v,()=>V.hit(F[0],v,1e5,{kind:'true'})),1e5,'once a wave'); void h;
  v.hp=0.3e6; V.wave(); V.step(1); near(lost(v,()=>V.hit(F[0],v,1e5,{kind:'true'})),0,'next wave again');
  L=lab(H,S(['ss_13_3','ss_1_1']),{foes:4}); ({v,F}=L); nrm(L);
  v.evaStat=1; V.hit(F[0],v,10,{kind:'phys'}); assert.ok(!mark(L,F[1],'rfSmk'),'an evade outside Dead Man\'s Fortune: nothing');
  v.evaStat=0; ult(L); v.evaStat=1; V.hit(F[0],v,10,{kind:'phys'}); for(const f of F) assert.ok(mark(L,f,'rfSmk'),'every enemy Smoked'); near(left(L,F[3],'rfSmk'),5,'5 s',0.05); near(v._miragT,5,'his evasion holds 5 s',0.05);
  swing(L,'p',F[0]); near(ratioAs(L,SHOT,F[0]),1.20,'every basic attack a Crossdraw'); near(ratioAs(L,SHOT,F[0]),1.20);
  secs(5.1); swing(L,'p',F[0]); near(ratioAs(L,SHOT,F[0]),1,'5 s'); v.evaStat=0; ult(L); v.evaStat=1; delete F[3]._talM; V.hit(F[0],v,10,{kind:'phys'}); assert.ok(!mark(L,F[3],'rfSmk'),'once every 25 s');
});

test('Rafe / Stand and Fight (PICK ONE: cutlass to 4 m), Keep Your Distance (PICK ONE), Cover Fire, Gun Hand, Cutlass Edge, Pistol Whip, Parting Shot, Footwork',()=>{
  let L=lab(H,S(['ss_5_2']),{foes:1}); near(FX.num(L.v,'rfClose',2.5*V.METER,L.F[0]),4*V.METER,'Stand and Fight: 4 m');
  const def={hero:H,casting:true,always:[{on:'partPre',skill:'rfCut',do:[{fn:'s'}]}],talents:{ss_5_2:[{on:'num',skill:'rfClose',addM:1.5}]},fn:{s:()=>{ cuts++; }},ruling:{},partial:{}};
  let cuts=0; L=lab(H,[['ss_5_2',1]],{foes:1,def}); const {v}=L; v.stunned=0; v.greenCd=v.blueCd=1e9; v.target=L.F[0]; for(let i=0;i<900&&cuts<2;i++){ at(L,L.F[0],3.8,0); V.step(1); v.energy=0; } assert.ok(cuts>=2,'a real swing at 3.8 m is the cutlass');
  FX.define(H,null);
  L=lab(H,S(['ss_5_3','ss_6_3','ss_4_4','ss_3_4','ss_10_1','ss_5_1']),{foes:2}); const {F}=L; nrm(L);
  near(ratioAs(L,SHOT,F[0]),1.09,'Gun Hand 3% x 3 (pistol swings'); near(ratioAs(L,BUL,F[0]),1.09,'and Barrage bullets)'); near(ratioAs(L,CUT,F[0]),1.15*1.10,'Cutlass Edge 3% x 5; Pistol Whip 1% x 5 for each of the 2 pistol shots of the last 4 s (the swing and the bullet measured)',1e-6);
  swing(L,'c',F[0]); const k=ratioAs(L,SHOT,F[0]); near(k,1.09*1.25,'Keep Your Distance: after a cutlass hit the next pistol shot 25% more'); near(F[0].slowMul,1-0.24,'Cover Fire: it slows 8% x 3',1e-9); near(F[0].slow,1.5,'for 1.5 s',0.05);
  near(ratioAs(L,SHOT,F[0]),1.09,'only the next');
  secs(4.1); near(ratioAs(L,CUT,F[0]),1.15,'no pistol shot in the last 4 s: no Pistol Whip'); swing(L,'p',F[0]); swing(L,'p',F[0]); swing(L,'p',F[0]); swing(L,'p',F[0]); near(ratioAs(L,CUT,F[0]),1.15*1.15,'up to 3 shots');
  const L0=lab(H,null,{foes:1}), sp0=L0.v.speed; L=lab(H,S(['ss_5_1']),{foes:1}); near(L.v.speed/sp0,1.15,'Footwork 3% x 5',1e-9);
  L=lab(H,S(['ss_n2']),{foes:2}); nrm(L); const f=L.F[0]; at(L,f,2,0); V.step(1); at(L,f,4.5,0); V.step(1); assert.ok(mark(L,f,'rfPart'),'it left his cutlass reach');
  near(ratioAs(L,SHOT,f),1.24,'Parting Shot: his next pistol shot at it 8% x 3'); near(ratioAs(L,SHOT,f),1,'once'); at(L,f,2,0); V.step(1); at(L,f,4.5,0); V.step(1); assert.ok(!mark(L,f,'rfPart'),'at most once every 3 s');
});

test('Rafe: the caps - his damage reduction ONE group of 35%, his allies\' ONE group of 15%, the regeneration budget, Salt Lantern 20%, critical chance 5%',()=>{
  const L=lab(H,S(['fs_12_2','co_3_4','co_9_4','ss_6_2','ss_10_4','ss_10_2','co_5_1','ss_5_2']),{foes:2,allies:1}), {v,A,F}=L, f=F[0];
  noMiss(L); setStack(L,'rfCard',4); v.maxHp=1e6; v.hp=0.3e6; setMk(L,f,'rfSmk',9); setMk(L,f,'rfTab',9); at(L,f,4.5,0);
  const k=L.T.fn.drMe(API(),L.T,v,f,true); near(k,0.65,'every one of them at once: 46% asked, held at 35%');
  near(lost(v,()=>V.hit(f,v,1000,{kind:'true',auto:true})),650,'on a hit');
  v.hp=0.9e6; setStack(L,'rfCard',0); delete f._talM; at(L,f,15,0); near(lost(v,()=>V.hit(f,v,1000,{kind:'true'})),1000,'none true: nothing');
  setMk(L,f,'rfSmk',9); setMk(L,f,'rfTab',9); near(lost(A[0],()=>V.hit(f,A[0],1000,{kind:'true'})),850,'an ally: Arguing Back 10% and Smoke Lungs 7.5% (16.75%), held at 15%');
  near(L.T.fn.drMe(API(),L.T,v,f,false),(1-0.10)*(1-0.075),'him: the same two');
  /* each one alone */
  const one=(ids,set)=>{ const M=lab(H,S(ids),{foes:2}); M.v.maxHp=1e6; M.v.hp=0.9e6; if(set) set(M); return M.T.fn.drMe(API(),M.T,M.v,M.F[0],true); };
  near(one(['co_3_4']),0.94,'Close Quarters: within 2.5 m, 2% x 3'); near(one(['co_3_4'],M=>at(M,M.F[0],10,0)),1,'(not farther)');
  near(one(['co_9_4']),0.925,'Thick Coat: a basic attack, 1.5% x 5'); near(one(['ss_6_2']),0.94,'Toe to Toe: an enemy within 4 m, 2% x 3'); near(one(['ss_6_2'],M=>{ at(M,M.F[0],10,0); at(M,M.F[1],15,0); }),1,'(nobody that close)');
  near(one(['ss_10_4']),1,'Hardened: above 40% HP nothing'); near(one(['ss_10_4'],M=>{ M.v.hp=0.45e6; }),1,'(not at 45%)'); near(one(['ss_10_4'],M=>{ M.v.hp=0.39e6; }),0.90,'below 40% 2% x 5');
  near(one(['fs_12_2'],M=>setStack(M,'rfCard',3)),1-0.03*3,'Saltwater Luck 0.6% x 5 per Card'); near(one(['ss_10_2'],M=>setMk(M,M.F[0],'rfSmk',9)),0.925,'Smoke Lungs 1.5% x 5'); near(one(['co_5_1'],M=>setMk(M,M.F[0],'rfTab',9)),0.90,'Arguing Back 2% x 5');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Rafe: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['fs_1_1','fs_1_4','fs_2_1','fs_2_4','co_1_1','co_1_3','ss_1_1','ss_1_2','ss_5_2','ss_2_2']), TEAM=['vael','sylthaine','vireo','vex','rafe'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(['grosk','kharos','konwu','carn','vex'].map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let hole=0,tab=false,smk=false;
  for(let i=0;i<3000&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o['#rfHole']&&o['#rfHole'].until>V.now()) hole=Math.max(hole,o['#rfHole'].v); if(o.rfTab&&o.rfTab.until>V.now()) tab=true; if(o.rfSmk&&o.rfSmk.until>V.now()) smk=true; } }
  const o=s._tal.s.rf; console.log('  live fight: max '+JSON.stringify(mx)+', most Holes '+hole+', At the Table '+tab+', Smoke '+smk+', last weapon '+o.lw);
  assert.ok(mx.rfCard>0,'real Cards'); assert.ok(hole>0,'real Holes'); assert.ok(smk,'real Smoke'); assert.ok(tab,'a real catch At the Table');
  determinism(H,TEAM);
});

/* The page sites his talents added: the evaded line (Nox's), the pass line before the instinct count, the instinct shot, the cutlass reach, the swing's blow,
   each Barrage bullet, each Dead Man's Fortune shot. With nothing learned, whole seeded fights with Rafe in the line-up are identical to the pre-talent page
   (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASEH=null; if(!process.env.RAFE_NOBASE) try{ BASEH=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Rafe: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASEH},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['rafe','vael','vireo','sylthaine','gruel'], foeTeam=['grosk','kharos','konwu','carn','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASEH); assert.deepEqual(a,b);
  VMX('var __rfN={swing:0,inst:0,bullet:0,shot:0,miss:0}; var __rfC=_dealDamageCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(src&&src.key==="rafe"&&tgt&&tgt.team!==src.team){ if(_autoAtk) __rfN.swing++; else if(kind==="true"&&color==="#ffe08a") __rfN.inst++; else if(color==="#5ee89b") __rfN.bullet++; }'+
    '  const ft=floatTexts.length; const r=__rfC.apply(this,arguments); if(tgt&&tgt.key==="rafe"){ for(let i=ft;i<floatTexts.length;i++) if(floatTexts[i].txt==="MISS") __rfN.miss++; } return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASEH,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASEH,b,fo(BASEH)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASEH,fo(BASEH),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__rfN'); console.log('  identity / base skills: '+JSON.stringify(c));
    assert.ok(c.swing>0&&c.inst>0&&c.bullet>0&&c.miss>0,'the fights swung, fired the instinct shot, landed Barrage bullets and Dead Man\'s Fortune shots, and made hits miss him: every new site was run'); }
  finally{ VMX('_dealDamageCore=__rfC;'); }
  assert.ok(n>=18);
});

/* Every page site of his is reached by a talented Rafe and carries the right skill (casting) to his rows */
test('Rafe: each page site his talents added runs his rows, with the skill it resolves (a scripted definition)',()=>{
  const seen={};
  const def={hero:H,casting:true,always:[
    {on:'pass',skill:'rfPre',do:[{fn:'s',k:'pre'}]}, {on:'partPre',skill:INST,do:[{fn:'s',k:'instPre'}]}, {on:'out',if:{casting:INST},do:[{fn:'s',k:'instOut'}]}, {on:'part',skill:INST,do:[{fn:'s',k:'instPost'}]},
    {on:'num',skill:'rfClose',do:[{fn:'s',k:'close'}]}, {on:'partPre',skill:SHOT,do:[{fn:'s',k:'shotPre'}]}, {on:'out',if:{casting:SHOT,auto:true},do:[{fn:'s',k:'shotOut'}]}, {on:'part',skill:SHOT,do:[{fn:'s',k:'shotPost'}]},
    {on:'partPre',skill:BUL,do:[{fn:'s',k:'bulPre'}]}, {on:'out',if:{casting:BUL},do:[{fn:'s',k:'bulOut'}]}, {on:'part',skill:BUL,do:[{fn:'s',k:'bulPost'}]},
    {on:'partPre',skill:DMF,do:[{fn:'s',k:'dmfPre'}]}, {on:'out',if:{casting:DMF},do:[{fn:'s',k:'dmfOut'}]}, {on:'part',skill:DMF,do:[{fn:'s',k:'dmfPost'}]},
    {on:'evaded',do:[{fn:'s',k:'evaded'}]}],talents:{fs_1_1:[]},fn:{s:(A,T,u,c,a)=>{ seen[a.k]=(seen[a.k]||0)+1; }},partial:{},ruling:{}};
  const L=lab(H,[['fs_1_1',1]],{foes:5,def}), {v,F}=L;
  V.cast(v,'green'); secs(0.3); ult(L); secs(0.4); v.evaStat=1; V.hit(F[0],v,10,{kind:'phys'}); v.evaStat=0;
  v.stunned=0; v.greenCd=v.blueCd=1e9; v.target=F[0]; for(let i=0;i<1500&&!((seen.instPost||0)>0&&(seen.shotPost||0)>4);i++){ V.step(1); v.energy=0; at(L,F[0],4.5,0); }
  for(const k of ['pre','instPre','instOut','instPost','close','shotPre','shotOut','shotPost','bulPre','bulOut','bulPost','dmfPre','dmfOut','dmfPost','evaded']) assert.ok(seen[k]>0,k+' was reached ('+JSON.stringify(seen)+')');
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage-reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ fs:['fs_12_2','fs_9_4'],
            co:['co_3_4','co_9_4','co_5_1','co_7_4','co_1_4','co_3_2','co_6_4','co_1_3','co_12_4'],
            ss:['ss_6_2','ss_10_4','ss_10_2','ss_8_4','ss_11_3','ss_1_2','ss_4_3','ss_3_3','ss_12_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={fs:0,co:1,ss:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his reduction talents true at once (4 Cards, the attacker within 2.5 m, Smoked and At the Table, below 40% HP,
   a basic attack); sustained: a usual state (2 Cards, an attacker 10 m away, above 40% HP) */
function worstHit(list,kind,crit,sustained){ const L=lab(H,list,{foes:2}), {v,F}=L, f=F[0]; noMiss(L); v.maxHp=1e5; v.hp=sustained?9e4:3.5e4;
  if(L.T){ setStack(L,'rfCard',sustained?2:4); if(!sustained){ setMk(L,f,'rfSmk',9); setMk(L,f,'rfTab',9); setUst(L,f,'rfHole',3); } else { at(L,f,10,0); at(L,F[1],15,0); } }
  v.shield=1e12; v.shieldT=999;
  const raw=2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:true})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Rafe: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['co','ss'],[61,30]],[['ss','co'],[61,30]],[['co'],[91]],[['ss'],[91]],[['co','fs'],[61,30]],[['ss','fs'],[61,30]],[['fs','co'],[61,30]],[['co','ss','fs'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,sum:0,al:0,alMax:0,alHi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.team==="ally"&&src&&src.team!==tgt.team&&!tgt._summon, rf=me&&tgt.key==="rafe"; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; if(rf){ __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } else { __dr.al++; if(d>__dr.alMax) __dr.alMax=d; if(d>=0.85) __dr.alHi++; } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="rafe"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    if(T&&e&&T.fn&&T.fn.drMe){ const k=T.fn.drMe(TalentFx.api(),T,u,e,true); const tot=1-k*defMul(e,u,"phys"); __dr.sum+=tot; if(tot>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','rafe'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['grosk','kharos','konwu','carn','vex'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits on him, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; his allies: '+d.al+' hits, the most reduced '+(d.alMax*100).toFixed(1)+'%, 85% or more '+d.alHi+'; probe each tick: mean '+(100*d.sum/Math.max(1,d.ticks)).toFixed(1)+'%, at 85% or more '+d.tHi+' of '+d.ticks+' ticks; immune '+d.imm);
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* his stuns (the hook's, Choking's, The Last Chair's hold): the longest time one enemy stays stunned in a row while one of his stuns is on it */
test('Rafe: his longest stun chain on one enemy in seeded fights (every talent learned, and the Collector at 91)',()=>{
  const lists=[everything(H),T.learned(H,build(H,1,91,100))]; let best=0, n=0;
  VMX('var __st={}; var __stU=_updateBattleCore; _updateBattleCore=function(dt){ const r=__stU.apply(this,arguments); for(const u of units){ if(!u||u.team!=="enemy") continue; const rf=units.find(x=>x.key==="rafe"&&x._tal); const k=u.uid;'+
    ' const mine=!!(rf&&u._talM&&u._talM[rf.uid]&&u._talM[rf.uid].rfLk&&u._talM[rf.uid].rfLk.until>battleTime); const e=__st[k]||(__st[k]={run:0,mine:false,max:0});'+
    ' if(u.alive&&(u.stunned||0)>0){ e.run+=dt; if(mine) e.mine=true; if(e.mine&&e.run>e.max) e.max=e.run; } else { e.run=0; e.mine=false; } } return r; };');
  try{ for(const list of lists){ const sn=snaps(['vael','sylthaine','vireo','mellan','rafe'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
      for(const [node,seed] of [[34,11],[60,90210],[90,424242]]) campaign(sn,node,seed);
      const foe=snaps(['grosk','kharos','konwu','carn','vex'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
      for(const seed of [3,5,8]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); }
    const st=VMX('__st'); for(const k in st){ if(st[k].max>0) n++; best=Math.max(best,st[k].max); }
    console.log('  stun chain: '+n+' enemies stunned by him; the longest one enemy stayed stunned in a row with one of his stuns on it: '+best.toFixed(2)+' s');
    assert.ok(n>5,'his stuns land'); assert.ok(best<=6.5,'the longest chain '+best.toFixed(2)+' s'); }
  finally{ VMX('_updateBattleCore=__stU;'); }
});
