'use strict';
/* Tharl Ironcoil's talents as data on the mechanics layer (talents-mech/tharl.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity with him in the line-up, and Phil's 95% damage-reduction ceiling (worst hit, sustained, the share of a fight at 85% or more) and his
   longest stun chain. Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his
   talents switched off for one hit (plainHit) or against the engine's own functions.
   Places (metres from Tharl, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5).
   Lab units are HELD (stunned 1e6), Tharl too; go() keeps him from acting when PLATED frees him. Lab skill level 10 (PLATED 2.09 s).
   None of his skills is on the skill reach audit: Scale Ram strikes his target, Avalanche Coil's landing strikes by centre within 5 m of where he lands.
   Run: node --test tests/talents-mech-tharl.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='tharl', S=ids=>full(H,ids);
const VMX=s=>vm.runInContext(s,NOW.ctx);
const O=L=>L.T.s.th;
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const still=f=>{ f.stunned=0; f.fearT=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.ctrlRes=0; f.level=1; f.slow=0; f.slowMul=null; };
const go=L=>{ const v=L.v; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; v._recentAtk=1e9; };
const hitOn=(L,amt,o)=>{ const x=lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{}))); L.v.energy=0; return x; };
const hitAl=(L,a,amt,o)=>lost(a,()=>V.hit((o&&o.src)||L.F[0],a,amt||1000,Object.assign({kind:'true'},o||{})));
const auto=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true',auto:true},o||{})));
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const ram=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const curl=L=>V.cast(L.v,'blue',L.F[0]);
const plate=L=>{ L.v._layStk=5; L.v._layT=0; V.step(2); };                 // Layered Hide plates him on the next passive pass; his tick sees it (_layT then has 1 step less)
const LT=b=>b-V.STEP;
const unplate=L=>{ L.v._layT=1e-4; V.step(2); };
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const api=L=>L.T.s.api;
const atk=L=>L.v.dmg*((L.v.dmgBuffT>0)?(L.v.dmgBuffMul||1):1)*VMX('rageMul');
const physK=(L,t,ign)=>{ const u=L.v, sv=u._wpnArmIgn; if(ign) u._wpnArmIgn=1-(1-(sv||0))*(1-ign); try{ return VMX('defMul')(u,t,'phys')*VMX('elemMul')(u,t); } finally{ u._wpnArmIgn=sv; } };
const gapM=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/V.METER-V.bodyR(a)-V.bodyR(b);
const curlFor=(L,s)=>{ for(let i=0;i<Math.round(s/V.STEP);i++){ V.step(1); } };
/* his ultimate as the game casts it (ULT_DEF.charge merged with HERO_ULT_ART.tharl: the path hits), then the dash run to its landing */
function ult(L){ const v=L.v; go(L); v.stunned=0; let e0=0; VMX('(function(u){ const k=[u._castSM,u._castLv,u._castSlot]; u._castSlot="ult"; u._castLv=10; u._castSM=skillMul(10); try{ _doEffectCore(u,"charge",Object.assign({},ULT_DEF.charge,HERO_ULT_ART.tharl)); } finally{ u._castSM=k[0]; u._castLv=k[1]; u._castSlot=k[2]; } })')(v); let k=0; for(;k<200&&v._dash;k++) V.step(1); e0=v.energy; v.stunned=1e6; go(L); v.energy=e0; assert.ok(k<200,'he landed'); for(let i=0;i<3;i++) V.step(1); }
const sp=(L,t)=>{ const e=O(L).sp[t.uid]; return e?e.n:0; };

test('Tharl: every talent is accounted for - 10 plain stats, 112 with rows, none waiting; renamed talents and the caps in the tooltips',()=>{
  accounting(H,[122,10,112,0,0]);
  const M=FXN.mech(H); for(const id of ['se_1_1','sb_1_4','rc_1_1','se_13_2','sb_13_3','rc_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['se_3_3','se_12_3','se_1_3','sb_1_2','sb_7_2','sb_8_2','sb_n1','rc_3_3','rc_9_3','rc_2_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const nm={se_6_1:'Weathered Plates',se_9_4:'Ironcoil Moult',sb_1_1:'Cover in Rubble',rc_5_2:'Bury the Line',rc_12_4:'Choking Scree'}; for(const id in nm) assert.equal(T.talent(H,id).name,nm[id]);
  assert.ok(/at most 20%/.test(T.talent(H,'rc_4_1').text),'Tucked Tight names his damage-reduction cap'); assert.ok(/at most 25%/.test(T.talent(H,'se_2_2').text),'Curled Around names the allies\' cap');
  assert.ok(/at most 40%/.test(T.talent(H,'se_5_1').text),'Layered Will names the control cap'); assert.ok(/1% more critical chance/.test(T.talent(H,'sb_3_2').text),'Rock Breaker: 5% at most');
  assert.equal(T.talent(H,'rc_5_3').lock,'rc_5_2','the fork still locks (Bury the Line)');
  const all=require(path.join(root,'talents-data.js')).heroes, names=new Set(); for(const h in all) if(h!==H) for(const tr of all[h].trees) for(const t of tr.talents) names.add(t[3].toLowerCase());
  for(const tr of T.trees(H)) for(const t of tr.talents) assert.ok(!names.has(t[3].toLowerCase()),t[0]+' '+t[3]+' is not another hero\'s talent name');
});

test('Tharl: his real kit, as the talents read it - Scale Ram, Fortress Curl, Layered Hide, Avalanche Coil (every hit physical)',()=>{
  const L=lab(H,null,{foes:3,big:true}), {v,F}=L; go(L); still(F[0]);
  const x0=F[0].x; ram(L,F[0]); assert.ok(F[0].stunned>2,'Scale Ram stuns its target ('+F[0].stunned.toFixed(2)+' s)'); near((F[0].x-x0)/V.METER,1.8,'and pushes it 1.8 m back',1e-6);
  curl(L); near(v.drMul,0.35,'Fortress Curl: 65% off'); near(v.drT,3.5,'for 3.5 s');
  v._layStk=5; V.step(2); assert.ok(Math.abs(v._layT-(VMX('SKLV.layered(10)')-V.STEP))<1.5*V.STEP,'Layered Hide: 5 layers make him PLATED ('+v._layT.toFixed(3)+' s)'); v.stunned=1e6; go(L);
  assert.equal(VMX('KITS.tharl.green.type'),'knockstun'); assert.equal(VMX('HERO_ULT_ART.tharl.pathHit'),0.5,'his ultimate strikes on its path');
  const kinds=[]; const keep=VMX('_dealDamageCore'); VMX('var __thK=[]; var __thD=_dealDamageCore; _dealDamageCore=function(s,t,a,c,k){ if(s&&s.key==="tharl") __thK.push(k||((s.t&&["Magic","Healer"].includes(s.t.damageProfile))?"magic":"phys")); return __thD.apply(this,arguments); };');
  try{ ram(L,F[1]); V.hit(v,F[1],100,{auto:true}); } finally{ VMX('_dealDamageCore=__thD;'); } assert.equal(JSON.stringify(VMX('__thK')),'["phys","phys"]','his skill hit and his basic attack are physical'); void keep; void kinds;
});

/* ============================== EVERY SCALE EARNED ============================== */
test('Tharl / Scar Plates: one for each PLATED of Layered Hide (max 10, Old Scar Plates 2 at the start), armour, magic resist, max HP and attack per plate; Plate Over Plate',()=>{
  const L=lab(H,S(['se_1_1','se_2_1','se_4_1','se_11_1','se_8_1','se_6_4']),{foes:2,big:true}), {v}=L; go(L);
  assert.equal(O(L).pl,2,'Old Scar Plates: 2 plates at the fight start');
  const a=v.armorRating, m=v.mrRating, h=v.maxHp, d=v.dmg; plate(L); assert.equal(O(L).pl,3,'PLATED: one more');
  near(v.armorRating,a*(1+0.02*3)/(1+0.02*2),'Struck Iron: 0.4% x 5 armour per plate'); near(v.mrRating,m*(1+0.009*3)/(1+0.009*2),'Heavier Each Time: 0.3% x 3 magic resist');
  near(v.maxHp,h*(1+0.01*3)/(1+0.01*2),'Iron Growth: 0.2% x 5 max HP'); near(v.dmg,d*(1+0.01*3)/(1+0.01*2),'Iron Memory: 0.2% x 5 attack');
  near(v._layT,LT(VMX('SKLV.layered(10)')+0.5),'Plate Over Plate: 0.1 s x 5 longer',1e-6);
  V.step(2); assert.equal(O(L).pl,3,'(one per PLATED, not per tick)');
  for(let i=0;i<12;i++){ unplate(L); plate(L); } assert.equal(O(L).pl,10,'at most 10'); v.stunned=1e6;
});

test('Tharl / Iron Where It Landed: at 6 Scar Plates the first PLATED of each wave lasts twice as long',()=>{
  const L=lab(H,S(['se_1_1','se_2_1','se_3_1']),{foes:2,big:true}), {v}=L; go(L); O(L).pl=4; const base=VMX('SKLV.layered(10)');
  plate(L); near(v._layT,LT(base),'5 plates: as it was',1e-6); unplate(L); plate(L); near(v._layT,LT(2*base),'6 plates: twice as long',1e-6);
  unplate(L); plate(L); near(v._layT,LT(base),'(the first of the wave only)',1e-6); unplate(L);
  V.wave(); V.step(2); plate(L); near(v._layT,LT(2*base),'a new wave: again',1e-6);
});

test('Tharl / Shed: when PLATED ends the 2 nearest enemies take 15% x 3 of his attack (physical), Sharp Edges, Flying Scale, Sharp Rain; Scale Rain may strike twice',()=>{
  const L=lab(H,S(['se_1_4','se_5_4','se_3_4','se_12_4']),{foes:3,big:true}), {v,F}=L; go(L); for(const f of F) still(f);
  plate(L); const h=F.map(f=>f.hp); const k=[physK(L,F[0],0.2),physK(L,F[1],0.2)], A0=atk(L); unplate(L);
  near(h[0]-F[0].hp,0.45*1.15*A0*k[0],'the nearest: 45% x 1.15 of his attack, 20% of its armour ignored',1e-6); near(h[1]-F[1].hp,0.45*1.15*A0*k[1],'the second nearest',1e-6); assert.equal(F[2].hp,h[2],'(not the third)');
  near(F[0].slowMul,0.75,'Flying Scale: slowed 5% x 5'); assert.ok(F[0].slow>1.9&&F[0].slow<=2,'for 2 s');
  near(h[0]-F[0].hp,0.45*1.15*A0*k[0],'(once)',1e-6);
  const R=lab(H,S(['se_1_4','se_10_4']),{foes:2,big:true}); go(R); let two=0; for(let i=0;i<40;i++){ plate(R); const x=R.F[0].hp; unplate(R); const got=x-R.F[0].hp, one=0.45*atk(R)*physK(R,R.F[0],0); if(Math.abs(got-2*one)<1e-6*one) two++; else near(got,one,'one strike or two'); }
  assert.ok(two>8&&two<32,'Scale Rain: 50% of the Sheds strike twice ('+two+' of 40)');
  const N=lab(H,S(['se_5_4','se_3_4']),{foes:2,big:true}); go(N); plate(N); const n0=N.F[0].hp; unplate(N); assert.equal(N.F[0].hp,n0,'(without Shed Scales its riders do nothing)');
});

test('Tharl / Ironcoil Moult: once a wave below 40% HP every Scar Plate is shed at the 3 nearest enemies (20% each) and heals 2% each; they grow back over 10 s',()=>{
  const L=lab(H,S(['se_1_1','se_9_4','se_6_4']),{foes:4,big:true}), {v,F}=L; go(L); at(L,F[3],20,6); O(L).pl=5; v.hp=0.45*v.maxHp; const h=F.map(f=>f.hp), A0=atk(L), K=F.map(f=>physK(L,f,0)); V.step(2); assert.equal(O(L).pl,5,'(above 40%: nothing)');
  v.hp=0.39*v.maxHp; const hp=v.hp; V.step(1); assert.equal(O(L).pl,0,'below 40%: every plate shed');
  near(h[0]-F[0].hp,2*0.2*A0*K[0],'the nearest takes plates 1 and 4',1e-6); near(h[1]-F[1].hp,2*0.2*A0*K[1],'the second 2 and 5',1e-6); near(h[2]-F[2].hp,0.2*A0*K[2],'the third plate 3',1e-6); assert.equal(F[3].hp,h[3],'');
  near(v.hp,hp+0.10*v.maxHp,'heals 2% x 5 plates',1e-6);
  secs(4.1); assert.equal(O(L).pl,2,'they grow back: 2 after 4 s'); secs(6); assert.equal(O(L).pl,5,'all 5 after 10 s');
  v.hp=0.3*v.maxHp; V.step(2); assert.equal(O(L).pl,5,'(once a wave)'); v.hp=0.5*v.maxHp; V.wave(); V.step(2); v.hp=0.3*v.maxHp; V.step(2); assert.equal(O(L).pl,0,'a new wave: again');
});

test('Tharl / Every Scale He Was Hit For (SIGNATURE): at 6 Scar Plates, once a fight - PLATED 6 s, a scale at every attacker (30%), the nearest ally half damage (the allies\' group caps it at 25%)',()=>{
  const L=lab(H,S(['se_1_1','se_13_2','se_12_4']),{foes:3,allies:2,big:true}), {v,F,A}=L; go(L); O(L).pl=4;
  plate(L); assert.ok(!(O(L).iron>0),'5 plates: not yet'); unplate(L); plate(L); assert.ok(O(L).iron>5.9,'6 plates: iron'); assert.ok(v._layT>5.9,'PLATED for 6 s');
  assert.equal(O(L).ironA,A[0],'the ally nearest him'); const pa=plainHit(L,()=>hitAl(L,A[0],1000)); near(hitAl(L,A[0],1000),pa*0.75,'takes 50% less, capped by the allies\' 25% group'); near(hitAl(L,A[1],1000),plainHit(L,()=>hitAl(L,A[1],1000)),'(not the other)');
  still(F[1]); const h1=F[1].hp, A0=atk(L), k=physK(L,F[1],0.2); hitOn(L,100,{src:F[1]}); near(h1-F[1].hp,0.3*A0*k,'a hit on him: a scale at the attacker for 30% of his attack (Sharp Rain)',1e-6);
  secs(6.1); assert.ok(!(O(L).iron>0),'6 s'); const h2=F[1].hp; hitOn(L,100,{src:F[1]}); assert.equal(F[1].hp,h2,'then no scale'); near(hitAl(L,A[0],1000),pa,'and no cut from it');
  O(L).pl=4; unplate(L); plate(L); unplate(L); plate(L); assert.ok(!(O(L).iron>0),'once a fight');
});

test('Tharl / Curled Around: Fortress Curl shelters the nearest ally within 3 m (Wider Coil 4.5 m, Two Under the Tail two) - 3% x 5 less; Long Wrap; Shelter Bond; Under My Scales',()=>{
  const L=lab(H,S(['se_2_2','se_8_2','se_10_2','se_6_2']),{foes:2,allies:2,big:true}), {v,F,A}=L; go(L); at(L,A[1],0,-14);
  assert.ok(gapM(v,A[0])<3,'(A0 stands within 3 m)'); curl(L); V.step(1); assert.equal(O(L).sh.length,1); assert.ok(O(L).sh[0]===A[0],'the nearest ally within 3 m');
  const p=plainHit(L,()=>hitAl(L,A[0],1000)); near(hitAl(L,A[0],1000),p*0.85,'it takes 15% less'); near(hitAl(L,A[1],1000),plainHit(L,()=>hitAl(L,A[1],1000)),'(the other: not sheltered)');
  near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*0.95,'Shelter Bond: he takes 1% x 5 less while he shelters an ally');
  A[0].maxHp=1e6; A[0].hp=5e5; const h0=A[0].hp; secs(1.0); near(A[0].hp-h0,0.012*1e6,'Under My Scales: 0.24% x 5 of its max HP a second',1e-3);
  secs(2.6); assert.equal(O(L).curl,0,'the curl ended'); near(hitAl(L,A[0],1000),p*0.85,'Long Wrap: still sheltered 0.3 s x 5 after it'); secs(1.6); near(hitAl(L,A[0],1000),p,'then not');
  const W=lab(H,S(['se_2_2','se_4_2','se_5_2']),{foes:2,allies:2,big:true}); go(W); at(W,W.A[1],0,-(4.2+V.bodyR(W.v)+V.bodyR(W.A[1]))); assert.ok(gapM(W.v,W.A[1])>3&&gapM(W.v,W.A[1])<4.5); curl(W); V.step(1); assert.ok(W.T.s.th.sh.length===2&&W.T.s.th.sh[0]===W.A[0]&&W.T.s.th.sh[1]===W.A[1],'Two Under the Tail: the two nearest; Wider Coil: within 4.5 m');
  const N=lab(H,S(['se_2_2']),{foes:2,allies:1,big:true}); go(N); at(N,N.A[0],0,-(3.5+V.bodyR(N.v)+V.bodyR(N.A[0]))); curl(N); V.step(1); assert.equal(N.T.s.th.sh.length,0,'(no ally within 3 m - one 3.5 m away: nobody)');
});

test('Tharl / Spiked Tail (PICK ONE), Barbed Tail, Shared Armor, Curl of Iron',()=>{
  const L=lab(H,S(['se_2_2','se_5_3','se_6_3','se_11_2','se_12_2']),{foes:2,allies:1,big:true}), {v,F,A}=L; go(L); still(F[1]);
  const aA=A[0].armorRating, tA=v.armorRating; curl(L); V.step(2); near(A[0].armorRating,aA+0.1*tA,'Shared Armor: the sheltered ally gains 2% x 5 of his armour',1e-6);
  const h=F[1].hp, A0=atk(L), k=physK(L,F[1],0); hitAl(L,A[0],100,{src:F[1]}); near(h-F[1].hp,0.2*1.3*A0*k,'Spiked Tail: an enemy hitting the sheltered ally takes 20% x 1.3 of his attack (Barbed Tail)',1e-6);
  const l0=v._layStk||0; hitOn(L,10); assert.equal((v._layStk||0)-l0,2,'Curl of Iron: a hit while curled counts twice for Layered Hide');
  plate(L); A[0].stunned=3; A[0].fearT=2; V.step(1); assert.equal(A[0].stunned,0,'and the sheltered ally is PLATED with him'); assert.equal(A[0].fearT,0,'');
  v.stunned=1e6; go(L); secs(4); near(A[0].armorRating,aA,'(the shelter over: its armour back)',1e-6);
  const Q=lab(H,S(['se_2_2','se_11_2']),{foes:1,big:true}); go(Q); const q0=Q.v._layStk||0; hitOn(Q,10); assert.equal((Q.v._layStk||0)-q0,1,'(not curled: once)');
});

test('Tharl / Weathered Plates, Kicked and Grew',()=>{
  const L=lab(H,S(['se_6_1','se_7_1']),{foes:1,big:true}), {v}=L; go(L); v.maxHp=1e6; v.hp=5e5;
  const d=v.dmg; v._layStk=3; V.step(1); near(v.dmg,d*(1+0.015*3),'Kicked and Grew: 0.3% x 5 attack per layer'); plate(L); near(v.dmg,d,'(PLATED: the layers are gone)');
  const h=v.hp; secs(1.0); near(v.hp-h,0.012*v.maxHp,'Weathered Plates: 0.4% x 3 of his max HP a second while PLATED',1e-3); unplate(L); const h2=v.hp; secs(1.2); near(v.hp,h2,'(not PLATED: none)');
});

/* ============================== FORTRESS CURL AND COILSPRING ============================== */
test('Tharl / Fortress Curl: Hard Curl, Long Curl, Thickened, Curled Patience',()=>{
  const L=lab(H,S(['se_2_3','rc_4_3','se_10_1','rc_6_1']),{foes:1,big:true}), {v}=L; go(L); curl(L);
  near(v.drT,3.5+0.6+0.6,'Hard Curl and Long Curl: 0.2 s x 3 longer each'); near(v.drMul,1-0.65*1.05,'Thickened: 65% x (1 + 1% x 5) = 68.25%');
  const c={u:v,slot:'blue',skill:'blue',amt:9}; FX.api().run(L.T,v,'cd',c); near(c.amt,9-0.9,'Curled Patience: 0.3 s x 3 off its cooldown');
});

test('Tharl / Coilspring: 1 each 0.5 s curled (Tight Coil faster), max 7; spent by the next Scale Ram he casts uncurled (Wind Tight 3% x 3 each), Coiled Strength, Coilspring Steel',()=>{
  const L=lab(H,S(['rc_1_1','rc_10_1','rc_12_3']),{foes:2,big:true}), {v,F}=L; go(L); still(F[0]); v.maxHp=1e6; v.hp=5e5;
  curl(L); secs(1.6); assert.equal(O(L).cs,3,'3 after 1.5 s curled'); secs(2.0); assert.equal(O(L).cs,7,'7 by the end'); secs(1); assert.equal(O(L).cs,7,'(never more)');
  const h=v.hp, p=plainHit(L,()=>lost(F[1],()=>ram(L,F[1]))); assert.equal(O(L).cs,7,'(a plain cast spends nothing)'); const got=lost(F[0],()=>ram(L,F[0]));
  near(got,p*(1+0.09*7)*(VMX('defMul')(v,F[0],'phys')/VMX('defMul')(v,F[1],'phys')),'Wind Tight: the Scale Ram after he uncurls deals 3% x 3 more per Coilspring',1e-6); assert.equal(O(L).cs,0,'and spends them all');
  near(v.hp-h,0.015*7*v.maxHp,'Coiled Strength: 0.3% x 5 of his max HP healed per Coilspring spent',1e-6);
  O(L).cs=6; curl(L); secs(1.1); assert.equal(O(L).cs,7,'(at most 7 however he winds)'); for(let i=0;i<200&&O(L).curl>0;i++) V.step(1); ram(L,F[1]); go(L); curl(L); secs(1.1); assert.equal(O(L).cs,2,'(wound again'+' '+JSON.stringify({curl:O(L).curl,cs:O(L).cs,chs:O(L).chs,n:O(L).n,bur:O(L).bur,drT:L.v.drT})); ram(L,F[1]); assert.equal(O(L).cs,2,'(a Scale Ram while curled spends nothing)'+' '+JSON.stringify({curl:O(L).curl,cs:O(L).cs,chs:O(L).chs,n:O(L).n,bur:O(L).bur,drT:L.v.drT}));
  const Q=lab(H,S(['rc_1_1','rc_2_1']),{foes:1,big:true}); go(Q); curl(Q); secs(1.6); assert.equal(O(Q).cs,4,'Tight Coil: 15% x 3 faster (one each 0.345 s: 4 in 1.6 s)');
  const Q0=lab(H,S(['rc_12_3']),{foes:1,big:true}); go(Q0); O(Q0).cs=4; const d0=Q0.v.dmg; V.step(1); near(Q0.v.dmg,d0*(1+0.009*4),'Coilspring Steel: 0.3% x 3 attack per Coilspring held');
});

test('Tharl / Spring Loaded, Uncoil Snap, Full Uncoil, Coiled Overnight, Tucked Tight, Ball of Iron',()=>{
  const PL=lab(H,null,{foes:2,big:true}); go(PL); still(PL.F[0]); const x1=PL.F[0].x; ram(PL,PL.F[0]); const st=PL.F[0].stunned, pu=(PL.F[0].x-x1)/V.METER;
  const L=lab(H,S(['rc_1_1','rc_2_1','rc_3_1','rc_8_1','rc_11_1','rc_4_1','rc_7_1','se_11_3']),{foes:2,big:true}), {v,F}=L; go(L); still(F[0]);
  curl(L); for(let i=0;i<3;i++) hitOn(L,10); assert.equal(O(L).cs,3,'Ball of Iron: each hit while curled winds one');
  { const n=O(L).cs, x=hitOn(L,1000); near(x,plainHit(L,()=>hitOn(L,1000))*(1-0.015*n),'Tucked Tight: 0.3% x 5 damage reduction per Coilspring while curled'); }
  const a=v.atkInterval; for(let i=0;i<200&&O(L).curl>0;i++) V.step(1); assert.equal(O(L).cs,7,'7 when it ended'); near(v.greenCd,0,'Full Uncoil: Scale Ram ready at once'); go(L);
  V.step(1); near(a/v.atkInterval,1.15,'Uncoil Snap: 3% x 5 faster for 4 s',1e-6); secs(4.1); near(v.atkInterval,a,'then not',1e-6);
  const x0=F[0].x; ram(L,F[0]); near((F[0].x-x0)/V.METER,(pu+0.2*5)*2,'Spring Loaded: 7 spent - twice as far (Ram Shove: 0.2 m x 5 more, doubled)',1e-6); near(F[0].stunned,st+0.3,'and 0.3 s longer',1e-6);
  still(F[1]); O(L).cs=6; const x2=F[1].x; ram(L,F[1]); near((F[1].x-x2)/V.METER,pu+1.0,'(6 spent: not doubled)',1e-6); near(F[1].stunned,st,'(nor longer)',1e-6);
  curl(L); V.step(1); O(L).cs=3; O(L).acc=0; O(L).curl=0.02; v.drT=0.02; V.step(2); go(L); V.step(1); near(v.atkInterval,a,'(3 Coilspring when it ended: no Uncoil Snap)',1e-6);
  const W=lab(H,S(['rc_1_1','rc_12_1']),{foes:1,big:true}); go(W); assert.equal(O(W).cs,6,'Coiled Overnight: 2 x 3 at the wave start'); O(W).cs=1; V.wave(); V.step(2); assert.equal(O(W).cs,6,'each wave');
});

/* ============================== STRIKING BLOCKS ============================== */
test('Tharl / Split Stone: each basic attack on an enemy 1 Split for 5 s (Quarry Rhythm 8 s), max 4; the next one breaks it - 6% x 5 more, 10% less armour 4 s; First Swing; Chisel',()=>{
  const L=lab(H,S(['sb_1_4','sb_2_4','sb_6_1','sb_4_4']),{foes:2,big:true}), {v,F}=L; go(L);
  const a0=F[0].armorRating; auto(L,F[0]); assert.equal(sp(L,F[0]),4,'First Swing: the first basic attack of the wave adds 1 + 2 x 2'); V.step(1); near(F[0].armorRating,a0*(1-0.025*4),'Chisel: 0.5% x 5 less armour per Split');
  auto(L,F[1]); assert.equal(sp(L,F[1]),1,'(then 1 a basic attack)'); auto(L,F[1]); auto(L,F[1]); auto(L,F[1]); assert.equal(sp(L,F[1]),4,''); auto(L,F[1]); assert.equal(sp(L,F[1]),0,'(the fifth broke it)');
  const p=plainHit(L,()=>auto(L,F[1])); for(let i=0;i<4;i++) auto(L,F[1]); near(auto(L,F[1]),p*1.30,'the break: 6% x 5 more'); V.step(1); near(F[1].armorRating,a0*0.90,'10% less armour'); secs(4.1); near(F[1].armorRating,a0,'for 4 s');
  near(myHit(L,F[1]),1000,'(not his other hits: they add no Split)'); assert.equal(sp(L,F[1]),0);
  auto(L,F[1]); secs(7.9); assert.equal(sp(L,F[1]),1,'Quarry Rhythm: 5 s + 1 x 3'); secs(0.2); assert.equal(sp(L,F[1]),0,'then gone');
  const R1=lab(H,[['sb_1_4',5],['sb_6_1',1]],{foes:1,big:true}); go(R1); auto(R1,R1.F[0]); assert.equal(sp(R1,R1.F[0]),3,'First Swing at 1/2: 1 + 2');
});

test('Tharl / Split breaks: Stonecutter, Breakthrough, Hard Labour, Falling Chips, Hammered Open (under the stun-lock rule), Rock Breaker',()=>{
  const L=lab(H,S(['sb_1_4','sb_6_4','sb_10_4','sb_11_4','sb_7_4','sb_3_4']),{foes:3,big:true}), {v,F}=L; go(L); v.maxHp=1e6; v.hp=5e5; still(F[0]); still(F[1]); at(L,F[1],4.5,2.5+V.bodyR(F[0])+V.bodyR(F[1]));
  for(let i=0;i<4;i++) auto(L,F[0]); v.greenCd=5; const h=v.hp, h1=F[1].hp, d=v.dmg; const got=auto(L,F[0]);
  near(v.hp-h,0.03*v.maxHp,'Stonecutter: 1% x 3 of his max HP',1e-6); near(v.greenCd,5-1.5,'Breakthrough: 0.3 s x 5 off Scale Ram'); near(h1-F[1].hp,0.45*got,'Falling Chips: the enemy beside it (within 3 m) takes 15% x 3 of the hit',1e-6);
  V.step(1); near(v.dmg,d*(1+0.015),'Hard Labour: 0.3% x 5 attack per break this wave'); assert.ok(!(F[0].stunned>0),'(above 50% HP: no stun)');
  F[0].hp=0.55*F[0].maxHp; for(let i=0;i<5;i++) auto(L,F[0]); assert.ok(!(F[0].stunned>0),'(55%: no stun)'); F[0].hp=F[0].maxHp;
  F[0].hp=0.4*F[0].maxHp; for(let i=0;i<5;i++) auto(L,F[0]); near(F[0].stunned,0.6,'Hammered Open: a break below 50% HP stuns 0.6 s',1e-9);
  V.step(2); const s2=F[0].stunned, nNo=O(L).n.tstunNo||0; for(let i=0;i<5;i++) auto(L,F[0]); near(F[0].stunned,s2,'(not while it is stunned)'); assert.equal((O(L).n.tstunNo||0)-nNo,1,'(refused)'); for(let i=0;i<40&&F[0].stunned>0;i++) V.step(1); V.step(5); for(let i=0;i<5;i++) auto(L,F[0]); assert.ok(!(F[0].stunned>0),'(nor within 0.5 s after his stun on it)');
  for(let i=0;i<20;i++){ for(let j=0;j<5;j++) auto(L,F[2]); } secs(0.1); for(let i=0;i<10;i++) auto(L,F[2]); V.step(1); near(v.dmg,d*(1+0.015*10),'(at most 10 breaks)',1e-6);
  V.wave(); V.step(2); near(v.dmg,d,'(counted again each wave)',1e-6);
  const C=lab(H,S(['sb_1_4','sb_3_2']),{foes:2,big:true}); go(C); let n2=0, n0=0;   // a crit deals more than the 100 of the hit
  for(let i=0;i<600;i++){ const e=O(C).sp[C.F[0].uid]||(O(C).sp[C.F[0].uid]={n:0,t:0}); e.n=2; e.t=9; if(lost(C.F[0],()=>V.hit(C.v,C.F[0],100,{kind:'true'}))>101) n2++; delete O(C).sp[C.F[1].uid]; if(lost(C.F[1],()=>V.hit(C.v,C.F[1],100,{kind:'true'}))>101) n0++; }
  assert.equal(n0,0,'(fewer than 2 Split: no crit)'); assert.ok(n2>12&&n2<52,'Rock Breaker: 1% x 5 critical chance with 2 or more Split ('+n2+' of 600)');
});

test('Tharl / Seam: Scale Ram opens it before it strikes, 5 s (Deep Seam 6.5 s), 2% x 5 more (Open Seam 1 point x 3 more below 50%), 2 Split a basic attack; Seam Strike, Heavy Blocks, Wide Seam',()=>{
  const P0=lab(H,null,{foes:2,big:true}); go(P0); still(P0.F[0]); const pr=lost(P0.F[0],()=>ram(P0,P0.F[0]));
  const L1=lab(H,S(['sb_2_3']),{foes:2,big:true}); go(L1); still(L1.F[0]); near(lost(L1.F[0],()=>ram(L1,L1.F[0])),pr*1.10,'Scale Ram\'s own hit is on a Seamed enemy: 2% x 5 more',1e-6);
  const L=lab(H,S(['sb_1_4','sb_2_3','sb_4_3','sb_10_3','sb_6_3','sb_2_2','sb_9_3']),{foes:3,allies:1,big:true}), {v,F,A}=L; go(L); still(F[0]); still(F[1]);
  ram(L,F[0]); assert.ok(O(L).seam[F[0].uid]>6.4,'Deep Seam: 5 + 0.5 x 3 s');
  const WS=1.075; near(myHit(L,F[0]),1000*1.10*WS,'his hits on it 10% more (and Wide Seam: his own too)'); F[0].hp=0.4*F[0].maxHp; near(myHit(L,F[0]),1000*1.13*WS,'Open Seam: below 50% HP 3 points more'); F[0].hp=F[0].maxHp;
  near(myHit(L,F[0],{crit:true})/plainHit(L,()=>myHit(L,F[0],{crit:true})),1.10*1.10*WS,'Seam Strike: its crits 2% x 5 more',1e-6);
  auto(L,F[0]); assert.equal(sp(L,F[0]),2,'2 Split a basic attack'); near(hitAl(L,F[0],1000,{src:A[0]}),1000*1.075,'Wide Seam: 1.5% x 5 more from his whole team');
  const a=v.atkInterval; v.stunned=0; v.target=F[0]; V.step(1); near(a/v.atkInterval,1/0.91,'Heavy Blocks: his attack interval 3% x 3 shorter against his Seamed target',1e-6); const sv=O(L).seam[F[0].uid]; delete O(L).seam[F[0].uid]; V.step(1); near(v.atkInterval,a,'(not once the target is not Seamed)',1e-6); O(L).seam[F[0].uid]=sv; v.stunned=1e6;
  secs(6.6); near(myHit(L,F[0]),1000,'the Seam closes after 6.5 s');
});

test('Tharl / Break the Seam (PICK ONE), Both Blocks, Coldharrow Strike, Split to the Core',()=>{
  const PB=lab(H,S(['sb_2_3']),{foes:2,big:true}); go(PB); still(PB.F[0]); const one=lost(PB.F[0],()=>ram(PB,PB.F[0]));
  const L=lab(H,S(['sb_1_4','sb_2_3','sb_5_3','sb_7_3','sb_11_3','sb_12_3']),{foes:3,big:true}), {v,F}=L; go(L); still(F[0]);
  const two=lost(F[0],()=>ram(L,F[0])); near(two,one*1.5,'Both Blocks: on a Seamed enemy Scale Ram strikes twice, the second for 50%',1e-6);
  const p=plainHit(L,()=>auto(L,F[0])); auto(L,F[0]); assert.equal(sp(L,F[0]),2,''); const b=auto(L,F[0]); assert.equal(sp(L,F[0]),0,'Break the Seam: the attack that brings it to 3 breaks it at once');
  near(b,p*1.10*(1+0.30+0.15),'Split to the Core: a break on a Seamed enemy 3% x 5 more (and the Seam 10%)',1e-6);
  O(L).sp[F[0].uid]={n:1,t:9}; auto(L,F[0]); assert.equal(sp(L,F[0]),0,'(1 Split and 2 more: 3, it breaks)');
  curl(L); assert.ok(O(L).curl>0,'(curled'+' '+JSON.stringify({curl:O(L).curl,cs:O(L).cs,chs:O(L).chs,n:O(L).n,bur:O(L).bur,drT:L.v.drT})); for(let i=0;i<200&&O(L).curl>0;i++) V.step(1); assert.ok(O(L).chs,'(the curl ended'+' '+JSON.stringify({curl:O(L).curl,cs:O(L).cs,chs:O(L).chs,n:O(L).n,bur:O(L).bur,drT:L.v.drT})); go(L); const q=plainHit(L,()=>auto(L,F[2])); const c=auto(L,F[2]); near(c,q*1.30,'Coldharrow Strike: after the curl his next basic attack is a break');
  assert.ok(O(L).seam[F[2].uid]>4.9,'and opens a Seam'); near(auto(L,F[2]),q*1.10,'(once)',1e-6);
});

test('Tharl / Rubble: each enemy Scale Ram stuns, 4 s (Spoil Heap 6.5 s), 4% x 3 slower; it falls on enemies within 2 m when it dies (20%, Slate Slide, Loose Ground); Gravel, Quarry Dust',()=>{
  const L=lab(H,S(['sb_1_1','sb_7_1','sb_3_1','sb_12_1','sb_5_1','sb_10_1']),{foes:4,allies:1,big:true}), {v,F,A}=L; go(L); for(const f of F) still(f);
  const as=F[0].atkInterval; ram(L,F[0]); near(O(L).rub[F[0].uid],6.5,'covered in Rubble for 4 + 0.5 x 5 s'); near(F[0].slowMul,0.88,'it moves 4% x 3 slower'); V.step(1); near(F[0].atkInterval/as,1/0.95,'Quarry Dust: attacks 1% x 5 slower',1e-6);
  near(hitOn(L,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,1000,{src:F[0]}))*0.925,'Gravel: it deals 1.5% x 5 less to him'); near(hitAl(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitAl(L,A[0],1000,{src:F[0]}))*0.925,'and to his allies');
  at(L,F[1],F[0].x/V.METER-L.v.x/V.METER+4.0,0); at(L,F[2],(F[0].x-L.v.x)/V.METER,4.6); at(L,F[3],(F[0].x-L.v.x)/V.METER+2.5+V.bodyR(F[0])+V.bodyR(F[3]),0); F[2].hp=0.4*F[2].maxHp;
  assert.ok(gapM(F[0],F[1])<2&&gapM(F[0],F[2])<2&&gapM(F[0],F[3])>2.4,'(F1, F2 within 2 m of it, F3 2.5 m away)');
  const h=F.map(f=>f.hp), A0=atk(L); kill(L,F[0]); near(h[1]-F[1].hp,0.2*1.25*A0*physK(L,F[1],0),'it dies: Rubble falls for 20% x 1.25 (Slate Slide)',1e-6); near(h[2]-F[2].hp,0.2*1.25*1.15*A0*physK(L,F[2],0),'Loose Ground: 5% x 3 more below 50% HP',1e-6);
  assert.equal(F[3].hp,h[3],'(not beyond 2 m)'); near(F[1].slowMul,0.88,'Slate Slide: its victims slowed as Rubble does');
  secs(7); V.step(1); near(F[1].atkInterval,F[1].atkInterval,''); const N=lab(H,S(['sb_1_1']),{foes:2,big:true}); go(N); still(N.F[0]); N.F[0].stunned=0; ram(N,N.F[0]); secs(4.1); assert.ok(!(N.T.s.th.rub[N.F[0].uid]>0),'4 s without Spoil Heap');
});

test('Tharl / Bury Them (PICK ONE) and Deep Burial, Loose Stone (LINK), Flint, Fresh Quarry Face',()=>{
  const L=lab(H,S(['sb_1_1','sb_5_2','sb_6_2']),{foes:2,big:true}), {v,F}=L; go(L); still(F[0]);
  ram(L,F[0]); const s1=F[0].stunned; F[0].stunned=0; F[0]._talM=F[0]._talM; L.T.s.th.lk={}; L.T.s.th.hs={}; L.T.s.th.run={}; ram(L,F[0]); near(F[0].stunned,s1+0.5,'Bury Them: on an enemy already covered in Rubble the stun lasts 0.5 s longer',1e-6);
  near(F[0].silencedT,0.6,'Deep Burial: and it is silenced 0.2 s x 3',1e-9);
  const K=lab(H,S(['rc_n2']),{foes:3,big:true}); go(K); still(K.F[0]); K.F[0].stunned=1; near(lost(K.F[0],()=>ram(K,K.F[0]))/plainHit(K,()=>{ K.F[0].stunned=1; return lost(K.F[0],()=>ram(K,K.F[0])); }),1.05,'Loose Stone: Scale Ram 5% more on a stunned enemy',1e-6);
  const Q=lab(H,S(['rc_n2','sb_1_1','rc_1_1']),{foes:3,big:true}); go(Q); for(const f of Q.F) still(f); at(Q,Q.F[1],8.5,0); assert.ok(gapM(Q.F[0],Q.F[1])<2); O(Q).cs=3; ram(Q,Q.F[0]); assert.ok(!(O(Q).rub[Q.F[1].uid]>0),'(3 spent: no)'); Q.F[0].stunned=0; O(Q).lk={}; O(Q).run={}; O(Q).cs=4; ram(Q,Q.F[0]); assert.ok(O(Q).rub[Q.F[1].uid]>0,'with Cover in Rubble: a Scale Ram spending 4 Coilspring covers enemies within 2 m of its target');
  const R=lab(H,S(['rc_n2','rc_1_1','sb_5_1']),{foes:3,big:true}); go(R); for(const f of R.F) still(f); at(R,R.F[1],8.5,0); O(R).cs=4; ram(R,R.F[0]); assert.ok(O(R).rub[R.F[0].uid]>0&&!(O(R).rub[R.F[1].uid]>0),'(without Cover in Rubble - Gravel learned, so Rubble is on its target - none around it)');
  const M=lab(H,S(['sb_11_2','sb_n2']),{foes:2,big:true}); go(M); M.F[0].stunned=1; near(myHit(M,M.F[0]),1000*1.10*1.10,'Flint 2% x 5 on a stunned enemy; Fresh Quarry Face 2% x 5 above 70% HP');
  M.F[0].stunned=0; M.F[0].hp=0.6*M.F[0].maxHp; near(myHit(M,M.F[0]),1000,'(neither)');
});

test('Tharl / The Stone Gives (SIGNATURE): a break on a Seamed enemy, once every 15 s - triple damage, Rubble and a Seam within 3 m, Scale Ram ready',()=>{
  const L=lab(H,S(['sb_1_4','sb_2_3','sb_1_1','sb_13_3']),{foes:3,big:true}), {v,F}=L; go(L); for(const f of F) still(f); at(L,F[1],8.5,0);
  ram(L,F[0]); F[0].stunned=0; const p=plainHit(L,()=>auto(L,F[0])); auto(L,F[0]); auto(L,F[0]); assert.equal(sp(L,F[0]),4,'(2 Split a basic attack on a Seamed enemy)'); v.greenCd=6; const b=auto(L,F[0]); near(b,p*1.10*1.30*3,'the break on a Seamed enemy: triple',1e-6);
  near(v.greenCd,0,'Scale Ram ready again'); assert.ok(O(L).rub[F[1].uid]>0&&O(L).seam[F[1].uid]>0,'an enemy within 3 m covered in Rubble and Seamed'); assert.ok(!(O(L).rub[F[2].uid]>0),'(not one farther)');
  auto(L,F[1]); auto(L,F[1]); const q=plainHit(L,()=>auto(L,F[1])); assert.ok(sp(L,F[1])>=4); v.greenCd=6; near(auto(L,F[1]),q*1.10*1.30,'once every 15 s'); assert.equal(v.greenCd,6);
  secs(15.1); ram(L,F[1]); F[1].stunned=0; auto(L,F[1]); auto(L,F[1]); near(auto(L,F[1])/q,1.10*1.30*3,'then again',1e-6);
});

/* ============================== THE ROLLING COIL ============================== */
test('Tharl / Downhill: 1 for each whole metre he will roll (max 10, Steep Slope 13; Head Start), 0.6% x 5 more each on its landing and path; Avalanche Weight, Quarry Muscle, Avalanche Force, Rolling Start, Mountainside',()=>{
  const P=lab(H,null,{foes:3,big:true}); for(const f of P.F) still(f); at(P,P.F[0],6,0.5); at(P,P.F[2],22,0); const hp0=P.F.map(f=>f.hp); ult(P); const pl=P.F.map((f,i)=>hp0[i]-f.hp);
  assert.ok(pl[2]>0,'(the plain landing strikes the farthest)'); assert.ok(pl[0]>0,'(and the enemy on the path)');
  const L=lab(H,S(['rc_1_2','rc_2_2','se_7_3','sb_9_2','rc_7_3','rc_4_2','rc_6_4']),{foes:3,big:true}), {v,F}=L; for(const f of F) still(f); at(L,F[0],6,0.5); at(L,F[2],22,0); const h=F.map(f=>f.hp); ult(L);
  const dh=O(L).dh; assert.equal(dh,13,'Head Start 6 + 22 metres, at most 10 + 1 x 3'); const up=1.15*1.15*1.15;
  near((h[2]-F[2].hp)/pl[2],up*(1+0.03*13),'the landing: 3% x 5 three times and 0.6% x 5 per Downhill',1e-6); near((h[0]-F[0].hp)/pl[0],up*(1+0.03*13)*1.15,'the path: and Rolling Start 5% x 3',1e-6);
  const M=lab(H,S(['rc_1_2']),{foes:3,big:true}); for(const f of M.F) still(f); at(M,M.F[2],7.4,0); at(M,M.F[0],-30,0); ult(M); assert.equal(O(M).dh,Math.min(10,Math.floor(Math.hypot(M.F[2].x-M.v.x,M.F[2].y-M.v.y)/V.METER)),'whole metres to the farthest enemy');
  const HS=lab(H,[['rc_1_2',5],['rc_6_4',1]],{foes:3,big:true}); for(const f of HS.F) still(f); at(HS,HS.F[2],5.6,0); at(HS,HS.F[0],-1,3.6); at(HS,HS.F[1],-1,-3.6); ult(HS); assert.equal(O(HS).dh,3+Math.floor(5.6+1e-9),'Head Start 1/2: 3 + the 5 whole metres');
  const R=lab(H,S(['rc_12_2']),{foes:2,big:true}); const o=FX.kit(R.v,'charge',Object.assign({},VMX('ULT_DEF.charge'))); near((o.radius-VMX('ULT_DEF.charge.radius'))/V.METER,1.0,'Mountainside: 0.2 m x 5 wider');
});

test('Tharl / Stop Dead (PICK ONE), Crushing Halt, Bury the Line (PICK ONE); Buried 4 s (Under the Scree 6 s) - attack speed and healing received lower, Choking Scree, Weight on Them, Heavy Earth, Packed Earth',()=>{
  const P=lab(H,null,{foes:3,big:true}); for(const f of P.F) still(f); at(P,P.F[0],6,0.5); at(P,P.F[2],22,0); const hp0=P.F.map(f=>f.hp); ult(P); const pl=P.F.map((f,i)=>hp0[i]-f.hp), st=P.F[2].stunned;
  const L=lab(H,S(['rc_5_3','rc_6_3','rc_1_4','rc_3_4','rc_12_4','rc_5_4','rc_7_4','rc_11_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; for(const f of F) still(f); at(L,F[0],6,0.5); at(L,F[2],22,0); const h=F.map(f=>f.hp), as=F[2].atkInterval; ult(L);
  assert.equal(F[0].hp,h[0],'Stop Dead: the path deals nothing'); near((h[2]-F[2].hp)/pl[2],1.15,'Crushing Halt: its landing 5% x 3 more',1e-6); near(F[2].stunned,st+0.6,'and its stun 0.6 s longer',1e-6);
  assert.ok(O(L).bur[F[2].uid]>5.85,'Buried 4 + 0.4 x 5 s'+' '+JSON.stringify({curl:O(L).curl,cs:O(L).cs,chs:O(L).chs,n:O(L).n,bur:O(L).bur,drT:L.v.drT})); assert.ok(!(O(L).bur[F[0].uid]>0),'(the path: not Buried)'); near(F[2].atkInterval/as,1/0.85,'attack speed 3% x 5 lower',1e-6);
  F[2].maxHp=1e6; F[2].hp=5e5; const hb=F[2].hp; V.heal(F[2],1000); near(F[2].hp-hb,1000*0.85*0.90,'healing received 15% lower, Choking Scree 5% x 2 more');
  near(hitOn(L,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,1000,{src:F[2]}))*0.94,'Weight on Them: it deals 2% x 3 less'); near(hitAl(L,F[2],1000,{src:A[0]}),1000*1.075,'Heavy Earth: it takes 1.5% x 5 more from his team');
  F[2].slow=0; F[2].slowMul=null; F[2].stunned=0; secs(6.1); near(F[2].slowMul,0.85,'Packed Earth: when Buried ends, slowed 3% x 5'); assert.ok(F[2].slow>1.8,'for 2 s');
  const B=lab(H,S(['rc_5_2','rc_1_4']),{foes:3,big:true}); for(const f of B.F) still(f); at(B,B.F[0],6,0.5); at(B,B.F[2],22,0); ult(B); assert.ok(O(B).bur[B.F[0].uid]>0,'Bury the Line: the path\'s enemies Buried too');
});

test('Tharl / Cave-In, Momentum of Iron, Gathered Speed, Downhill Weight, Roll Again, Slope Rumble',()=>{
  const L=lab(H,S(['rc_1_2','rc_1_4','rc_9_4','rc_6_2','rc_8_2','rc_10_2','rc_9_2','rc_11_2']),{foes:4,big:true}), {v,F}=L; for(const f of F) still(f); at(L,F[0],6,0.5); at(L,F[2],22,0); at(L,F[3],16,4.4);
  const a=v.armorRating, d=v.dmg; ult(L); const dh=O(L).dh; assert.equal(dh,10);
  near(v.dmg,d*(1+0.025*O(L).rum),'Slope Rumble: 0.5% x 5 attack per enemy it hit',1e-6); assert.ok(O(L).rum>=2,'(it hit '+O(L).rum+')'); near(v.armorRating,a*(1+0.015*10),'Gathered Speed: 0.3% x 5 armour per Downhill for 5 s',1e-6);
  near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*0.925,'Momentum of Iron: 1.5% x 5 less for 3 s');
  still(F[1]); const pr=plainHit(L,()=>lost(F[1],()=>ram(L,F[1]))); F[1].stunned=0; near(lost(F[1],()=>ram(L,F[1])),pr*(1+0.009*10),'Downhill Weight: Scale Ram 0.3% x 3 more per Downhill for 4 s',1e-6);
  at(L,F[3],(F[2].x-L.v.x)/V.METER,(F[2].y-L.v.y)/V.METER+4.2); assert.ok(gapM(F[2],F[3])<2); delete O(L).bur[F[3].uid]; kill(L,F[2]); near(O(L).bur[F[3].uid],2.0,'Cave-In: a Buried enemy dies, those within 2 m are Buried 0.4 s x 5'); 
  secs(3.1); near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000)),'(Momentum of Iron: 3 s)'); assert.ok(O(L).gs>0); secs(2.0); near(v.armorRating,a,'',1e-6);
  const K=lab(H,S(['rc_1_2','rc_9_2']),{foes:3,big:true}); for(const f of K.F) still(f); at(K,K.F[2],7,0); at(K,K.F[0],-1,30); at(K,K.F[1],-1,40); K.F[0].hp=K.F[0].maxHp; const far=K.F.slice().sort((x,y)=>Math.hypot(y.x-K.v.x,y.y-K.v.y)-Math.hypot(x.x-K.v.x,x.y-K.v.y))[0]; far.hp=1; ult(K);
  assert.ok(!far.alive,'(its landing killed)'); near(K.v.energy,20,'Roll Again: 20 energy (4 s at 5 a second)'); for(const f of K.F) if(f.alive){ f.x=K.v.x+4.5*V.METER; f.y=K.v.y+(f===K.F[0]?1:-1)*0.5*V.METER; } ult(K); assert.equal(O(K).dh,10,'and the next roll starts with 10 Downhill (it rolls 4 m)');
});

test('Tharl / The Shelf Came Down (SIGNATURE): a landing with 10 Downhill, once every 30 s - Buried 3 s within 5 m, stunned 1 s longer, 7 Coilspring, Fortress Curl at once',()=>{
  const P=lab(H,null,{foes:3,big:true}); for(const f of P.F) still(f); at(P,P.F[2],22,0); ult(P); const st=P.F[2].stunned;
  const L=lab(H,S(['rc_1_2','rc_1_1','rc_13_2']),{foes:3,big:true}), {v,F}=L; for(const f of F) still(f); at(L,F[2],22,0); at(L,F[1],18,4.5); ult(L);
  near(F[2].stunned,st+1,'stunned 1 s longer',1e-6); assert.ok(O(L).bur[F[2].uid]>2.8&&O(L).bur[F[2].uid]<=3,'Buried 3 s'); assert.ok(gapM(v,F[1])<5&&O(L).bur[F[1].uid]>2.8,'every enemy within 5 m of him');
  assert.ok(v.drT>3,'Fortress Curl at once'); near(v.blueCd,1e9,'(its cooldown not spent)'); assert.equal(O(L).cs,7,'7 Coilspring'); assert.ok(O(L).curl>0,'');
  for(const f of F) still(f); at(L,F[2],22-((v.x-L.v.x)/V.METER),0); v.drT=0; ult(L); assert.ok(!(F[2].stunned>st+0.5),'(once every 30 s)');
  const N=lab(H,S(['rc_1_2','rc_13_2']),{foes:3,big:true}); for(const f of N.F) still(f); at(N,N.F[2],9.5,0); at(N,N.F[0],-0.5,3); at(N,N.F[1],0.5,-3); ult(N); assert.equal(O(N).dh,9); assert.ok(!(N.v.drT>0),'(9 Downhill: nothing)');
});

/* ============================== CONTROLS ON HIM, HIS STUNS, HIS CAPS ============================== */
test('Tharl / his control-shortening talents, ONE group of 40%: Layered Will, Stony Look, Blunt Head, Ball of Iron (stuns while curled); Pebble Shrug',()=>{
  const L=lab(H,S(['se_5_1','se_8_3','sb_12_2','rc_7_1','rc_8_3']),{foes:1,big:true}), {v,F}=L; go(L); v.stunned=0;
  const c=(f,s)=>{ const x={u:v,src:F[0],tgt:v,field:f,amt:s}; FX.api().run(L.T,v,'ccIn',x); return x.amt; };
  near(c('fearT',1),0.80,'Layered Will: 4% x 5'); near(c('silencedT',1),0.60,'a silence: 0.8 x 0.7 x 0.8 = 0.448, but at most 40% shorter'); near(c('stunned',1),0.80,'a stun, not curled');
  curl(L); near(c('stunned',1),0.60,'curled: Ball of Iron 30% more, at most 40% in all');
  v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*0.76,'Pebble Shrug: a slow on him 8% x 3 weaker'); v.stunned=1e6;
});

test('Tharl / his stuns: a talent stun never on a stunned enemy nor within 0.5 s after his stun on it ended; never more than 4.0 s of his stuns in a row on one enemy',()=>{
  const L=lab(H,S(['sb_1_1','sb_5_2','rc_1_1','rc_3_1']),{foes:2,big:true}), {v,F}=L; go(L); still(F[0]);
  ram(L,F[0]); const s1=F[0].stunned; secs(1.5); L.T.s.th.cs=7; ram(L,F[0]); const run=L.T.s.th.run[F[0].uid]||0; near(run+F[0].stunned,4.0,'Bury Them + Spring Loaded on top of 1.5 s of his stun: cut so the run is 4.0 s',1e-6);
  for(let i=0;i<400&&F[0].stunned>0;i++) V.step(1); V.step(1); assert.ok(!(L.T.s.th.run[F[0].uid]>0),'(the run is over when the stun is)'); ram(L,F[0]); near(F[0].stunned,s1+0.5,'then a whole stun again (with Bury Them)',1e-6);
  const L2=lab(H,S(['sb_1_4','sb_3_4']),{foes:2,big:true}); go(L2); still(L2.F[0]); L2.F[0].hp=0.3*L2.F[0].maxHp; L2.F[0].stunned=0.3; for(let i=0;i<5;i++) auto(L2,L2.F[0]); near(L2.F[0].stunned,0.3,'(an enemy someone else stunned: his talent stun is refused)');
  void s1;
});

test('Tharl / damage reduction, one group of 20%: every condition at once never takes more than 20% off a hit; the allies\' group of 50%',()=>{
  const L=lab(H,S(['se_9_1','rc_10_3','se_2_2','se_8_2','se_12_1','rc_1_1','rc_4_1','rc_6_2','rc_n1','sb_5_1','rc_5_4','sb_12_4','se_13_2']),{foes:3,allies:1,big:true}), {v,F,A}=L; go(L);
  at(L,F[2],12,0); near(hitOn(L,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,1000,{src:F[2]}))*0.925,'(from more than 4 m: Low to the Ground)'); near(hitOn(L,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,1000,{src:F[0]})),'(nothing else true)');
  at(L,F[1],3.5+V.bodyR(v)+V.bodyR(F[1]),0); near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]})),'(3.5 m away: not more than 4 m)');
  v.hp=0.35*v.maxHp; near(hitOn(L,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,1000,{src:F[0]})),'(35% HP: Tough Old Lizard waits for 30%)'); v.hp=v.maxHp;
  curl(L); V.step(1); const o=O(L); o.cs=7; o.mom=3; o.rub[F[0].uid]=9; o.bur[F[0].uid]=9; v.hp=0.2*v.maxHp; at(L,F[0],12,0);
  near(hitOn(L,1000,{src:F[0],crit:true})/plainHit(L,()=>hitOn(L,1000,{src:F[0],crit:true})),0.80,'all of them at once: 20% off, never more',1e-6);
  near(L.T.fn.drK(api(L),L.T,v,F[0],'phys',true,false),0.80,'(the pure function the 95% check reads)');
  o.mom=0; delete o.rub[F[0].uid]; delete o.bur[F[0].uid]; v.hp=v.maxHp; o.sh=[]; o.curl=0; at(L,F[0],4.5,0); near(L.T.fn.drK(api(L),L.T,v,F[0],'phys',true,false),0.90*0.94,'(two crit talents: the shares multiply)',1e-9);
  near(L.T.fn.drK(api(L),L.T,v,F[0],'dot',false,true),0.94,'Rock Dust Lungs: 2% x 3 less from a DoT');
  O(L).sh=[A[0]]; O(L).iron=6; O(L).ironA=A[0]; O(L).rub[F[1].uid]=9; O(L).bur[F[1].uid]=9; near(hitAl(L,A[0],1000,{src:F[1]})/plainHit(L,()=>hitAl(L,A[0],1000,{src:F[1]})),0.75,'his allies: 25% at most',1e-6);
  O(L).iron=0; near(L.T.fn.allyK(api(L),L.T,v,A[0],F[1]),Math.max(0.75,0.85*0.925*0.94),'(the shares multiply, floored at the allies\' 25% cap)',1e-9);
  const dotOn=(Q)=>{ const u=Q.v; u.maxHp=1e6; u.hp=5e5; const h=u.hp; V.dot(u,100,1,1,Q.F[0]); V.step(40); return h-u.hp; };
  const P=lab(H,null,{foes:1,big:true}); go(P); const pd=dotOn(P); const Q=lab(H,S(['sb_12_4']),{foes:1,big:true}); go(Q); near(dotOn(Q),pd*0.94,'(on a real DoT tick: 6% less)',1e-6);
});

test('Tharl / a wave change: his countdowns carry on, his marks on the last wave\'s enemies are gone, Old Scar Plates only at the fight\'s start, a curl the wave ended does not shed',()=>{
  const L=lab(H,S(['se_1_1','se_6_4','se_1_4','se_7_4','sb_1_4','sb_13_3','sb_2_3','sb_1_1']),{foes:2,big:true}), {v,F}=L; go(L); still(F[0]);
  O(L).stoneCd=10; ram(L,F[0]); auto(L,F[0]); assert.equal(O(L).pl,2,'');
  curl(L); V.step(2); VMX('battleTime=55'); const h=F[0].hp; VMX('resetPerWave(); beginWaveEnter(); waveXfer=null;'); for(const u of [v].concat(F)){ u.alive=true; } v.stunned=1e6; go(L); still(F[0]); V.step(2);
  assert.ok(Math.abs(O(L).stoneCd-(10-4*V.STEP))<0.05,'The Stone Gives\' 15 s lock keeps exactly the time it had left (a countdown): '+O(L).stoneCd.toFixed(3));
  assert.equal(Object.keys(O(L).sp).length+Object.keys(O(L).rub).length+Object.keys(O(L).seam).length,0,'Split, Rubble and Seams of the last wave are gone');
  assert.equal(O(L).pl,2,'(Scar Plates stay for the fight; Old Scar Plates gives none again)'); assert.equal(F[0].hp,h,'the curl the wave ended: no Shed Season'); assert.equal(O(L).curl,0,'');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Tharl: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['se_1_1','se_1_4','se_2_2','sb_1_4','sb_2_3','sb_1_1','rc_1_1','rc_1_2','rc_1_4','se_13_2','sb_13_3']), TEAM=['tharl','vael','sylthaine','vireo','vex'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++) V.step(1); const n=s._tal.s.th.n;
  console.log('  live fight: '+JSON.stringify(n)+', plates '+s._tal.s.th.pl);
  for(const k of ['plated','shed.pl','curl','ram','spent','split','rubble','ult','buried']) assert.ok(n[k]>0,'real '+k+': '+n[k]);
  determinism(H,TEAM);
});

/* With nothing learned, whole seeded fights with Tharl in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. His talents added no page line;
   the fights reach every hook his rows use (Scale Ram's kit / cast and its stun, Fortress Curl, PLATED, Avalanche Coil's target, path and landing). */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Tharl: no talents - whole fights with him in the line-up are identical to the pre-talent page',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['tharl','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __tiN={ram:0,curl:0,plate:0,ult:0}; var __tiD=_doEffectCore, __tiU=_updateBattleCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="tharl"){ if(type==="knockstun") __tiN.ram++; if(type==="defensive") __tiN.curl++; if(type==="charge") __tiN.ult++; } return __tiD.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ for(const u of units) if(u&&u.key==="tharl"){ if((u._layT||0)>0&&!(u.__tiL>0)) __tiN.plate++; u.__tiL=u._layT||0; } return __tiU.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__tiN'); console.log('  identity: '+JSON.stringify(c)+' in '+n+' fights');
    assert.ok(c.ram>0&&c.curl>0&&c.plate>0&&c.ult>0,'the fights cast Scale Ram, Fortress Curl and Avalanche Coil and plate him'); }
  finally{ VMX('_doEffectCore=__tiD; _updateBattleCore=__tiU;'); }
  assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. His base kit already takes 65% off inside Fortress Curl (3.5 s
   of every 9 s); his talent reductions are one capped group (20%), and his armour talents and Scar Plates raise his armour. Each candidate build is 91 points legal;
   the most defensive is the one whose worst hit is reduced most. */
const DEF={ se:['se_10_1','se_2_3','se_9_1','se_8_2','se_12_1','se_1_1','se_2_1','se_4_1','se_6_4','se_3_3','se_12_3','se_1_3','se_2_2','se_13_2'],
            sb:['sb_5_1','sb_12_4','sb_8_2','sb_1_1'],
            rc:['rc_4_1','rc_10_3','rc_6_2','rc_n1','rc_5_4','rc_8_2','rc_3_3','rc_9_3','rc_4_3','rc_6_1','rc_1_1','rc_1_2','rc_2_2','rc_1_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={se:0,sb:1,rc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[16,0,15.5,4.5][i]*V.METER; f.y=v.y+[0,5,0,12][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,0,0,-5][i]*V.METER; a.y=v.y-[5.5,11,16.5,5][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on him: Fortress Curl up (with his curl talents), every condition of his damage-reduction talents true at once - 7 Coilspring curled, an ally sheltered,
   below 30% HP, just landed, the attacker more than 4 m away, covered in Rubble and Buried, a critical hit - 10 Scar Plates and the most Downhill armour. Physical and
   magic, normal and critical, with his armour and magic resist; and again with glyph damage reduction at its 30% cap. */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F,A}=L, f=F[0];
  v.shield=0; v.glyphDR=glyph||0; const o=v._tal?v._tal.s.th:null; const ab=Object.assign({},VMX('KITS.tharl.blue')), x=v._tal?FX.kit(v,'defensive',ab):ab; v.drMul=x.mul; v.drT=x.dur;
  if(o){ o.curl=x.dur; o.cs=7; o.sh=[A[0]]; o.mom=3; o.gs=5; o.dhL=13; o.rub[f.uid]=9; o.bur[f.uid]=9; o.pl=10; V.step(1); v.drMul=x.mul; v.drT=x.dur; o.curl=x.dur; }
  v.maxHp=Math.max(v.maxHp,1e6); v.hp=0.2*v.maxHp;
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit}); const y=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-y/(raw*cm*VMX('elemMul')(f,v)); }
test('Tharl: his most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, he is at 85% or more for well under half a fight; his longest stun chain',()=>{
  const cands=[[['se','rc'],[61,30]],[['se','sb'],[61,30]],[['rc','se'],[61,30]],[['rc','sb'],[61,30]],[['sb','se'],[61,30]],[['sb','rc'],[61,30]],[['se'],[91]],[['sb'],[91]],[['rc'],[91]],[['rc','se','sb'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.03,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0,st:{},stMax:0,stN:0,sh:{},shMax:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="tharl"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="tharl"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal;'+
    '    for(const e of units){ if(e.team===u.team) continue; const k=e.uid, th=T&&T.s.th, his=!!(th&&th.hs[k]>0); if(e.alive&&(e.stunned||0)>0&&(__dr.st[k]>0||his)){ __dr.st[k]=(__dr.st[k]||0)+dt; if(__dr.st[k]>__dr.stMax) __dr.stMax=__dr.st[k]; if(his){ __dr.sh[k]=(__dr.sh[k]||0)+dt; if(__dr.sh[k]>__dr.shMax) __dr.shMax=__dr.sh[k]; } } else { __dr.st[k]=0; __dr.sh[k]=0; } }'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys",false,false):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic",false,false):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph,mine)=>{ VMX('for(const k in __dr) __dr[k]=(k==="st"||k==="sh")?{}:0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['tharl','vael','sylthaine','vireo','vex'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    if(mine) VMX('__dr.mine=1'); for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>20&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune');
    assert.ok(d.te85<0.25*d.t,'at 85% or more for well under half of his time in the fights ('+pc(d.te85,d.t)+')');
    /* his stuns in real fights (Scale Ram reset by Breakthrough, Full Uncoil and The Stone Gives, every extension, Hammered Open, Shelf Comes Down): the longest one
       enemy stayed stunned in a row while one of his stuns was on it */
    const L2=S(['sb_1_1','sb_1_4','sb_2_4','sb_3_4','sb_5_2','sb_6_2','sb_7_1','sb_9_1','sb_10_4','sb_2_3','sb_4_3','sb_11_3','sb_12_3','sb_13_3','rc_1_1','rc_3_1','rc_11_1','rc_13_2','rc_1_2','rc_5_3']);   // every stun of his and every Scale Ram reset at once (not a legal build: the most stuns)
    const e=seeded(L2); console.log('  stun chain: the longest one enemy stayed stunned in a row once one of his stuns was on it '+e.stMax.toFixed(2)+' s (allies\' stuns included), of it under his own stuns '+e.shMax.toFixed(2)+' s');
    /* Phil, 17 Nov 2026 (00:3x, via the coordinator), on the chains v1391's wider reach brought (Tharl 5.14 s, Rhukk 4.10 s on a24261fd9): ACCEPTED -
     "5 seconds at max talents, level 100" / "but those stuns are 16 second CD". The check now holds the measured chain (a regression guard), not 4.0 s. */
    assert.ok(e.shMax<=5.14+0.06,'his stuns never more than the accepted 5.14 s in a row on one enemy ('+e.shMax.toFixed(2)+' s)'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
