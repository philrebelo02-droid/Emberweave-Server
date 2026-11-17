'use strict';
/* Vulmar "The Raised Lotus"'s talents as data on the mechanics layer (talents-mech/vulmar.js), family by family on the still field
   (tests/talents-lab.js), then the caps, the stun-lock rule, whole-fight determinism, the no-talent identity and Phil's 95% ceiling.
   Lab conventions (measured while writing these tests):
   - He stands at (300,700); lab foes are plain rank-0 Vaels (melee, no skills) held in place; free(L) lets them be stunned (level 1:
     no resist roll) and zeroes their magic resist so numbers are clean. He stays held (stunned) himself: his talent tick still runs.
   - Gravity Sling (green, a direct cast): seizes the NEAREST foe F0 (4.5 m) and teleports it beside the nearest foe to it, F1 (10 m):
     F0 moves 5.5 m - 24 px. Its stun 0.6 s x 0.7 = 0.42 s, the anvil's 0.5 x 0.7 = 0.35 s.
   - Grasping Vow (blue): drags the FARTHEST foe to 2 m from his centre over the 1.21 s hand clip (pullT), silenced and rooted for it
     (1.21 x 0.7 = 0.85 s each). His Vow's landing is a countdown of that 1.21 s.
   - Weight of the World (ult) at a target: every foe within 8 m (centre to centre) of it is lifted 2 s, then slammed (the deferred
     200% AP x skill level, and a raw 1 s stun). Lab skill level 10.
   The ccApply resist (CC_MISS_PER_LEVEL) is beaten by level-1 lab foes; a high-level foe resists every control (What Cannot Be Lifted).
   Run: node --test tests/talents-mech-vulmar.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),cp=require('node:child_process');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='vulmar', S=ids=>full(H,ids), R=id=>T.talent(H,id).ranks;
const VMX=s=>vm.runInContext(s,NOW.ctx);
const TEAM=['vael','sylthaine','vireo','vex','vulmar'];
const M=()=>V.METER;
const vu=L=>L.T.s.vu;
const heft=(L,t)=>L.T.s.api.ustGet(L.T,L.v,t,'vuHeft');
const rq=(L,t)=>vu(L).e[t.uid];
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const free=L=>{ for(const f of L.F){ f.stunned=0; f.fearT=0; f.silencedT=0; f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.energyReg=0; f.mrRating=0; f.armorRating=0; } };
const freeA=L=>{ for(const a of L.A){ a.stunned=0; a.level=1; a.speed=0; a.atkCd=1e9; a.greenCd=1e9; a.blueCd=1e9; a.energy=0; a.energyReg=0; } };
const castS=L=>V.cast(L.v,'green');
const castV=L=>V.cast(L.v,'blue');
const castU=(L,t)=>V.cast(L.v,'ult',t||L.F[0]);
const ap=L=>L.v.apow*((L.v.dmgBuffT>0)?(L.v.dmgBuffMul||1):1);
const dmul=(L,t)=>VMX('defMul')(L.v,t,'magic');
const L0=(ids,o)=>{ const L=lab(H,ids?S(ids):null,Object.assign({foes:2,big:true},o||{})); free(L); freeA(L); return L; };
const unstunAll=L=>{ for(const f of L.F){ f.stunned=0; f.silencedT=0; } };

/* ============================== ACCOUNTING ============================== */
test('Vulmar: every talent is accounted for - 117 talents, 9 plain stats, 108 with rows, none waiting; the caps are in the texts',()=>{
  accounting(H,[117,9,108,0,0]);
  for(const id of ['gw_1_3','gw_10_4','gw_11_3','fb_3_4','fb_12_1','fb_7_4','rl_2_1','rl_8_4','rl_11_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const names={}; for(const tr of T.trees(H)) for(const t of tr.talents){ assert.ok(!names[t[3]],'a name used twice: '+t[3]); names[t[3]]=1; }
  for(const id of ['rl_1_2','rl_3_2','rl_4_4','rl_11_2','rl_12_1','gw_12_4','fb_n2','rl_7_2','rl_11_3','gw_3_4','gw_n2','rl_13_3']) assert.ok(/at most 40% off a hit on him/.test(T.talent(H,id).text),id+' states the 40% group cap');
  for(const id of ['rl_7_2','rl_11_3','gw_3_4','gw_n2','rl_13_3','rl_8_3']) assert.ok(/30% off a hit on an ally/.test(T.talent(H,id).text),id+' states the 30% ally cap');
  for(const id of ['rl_1_1','rl_10_2']) assert.ok(/1\.2% of his max HP a second/.test(T.talent(H,id).text),id+' states the regeneration cap');
  for(const id of ['gw_3_1','gw_13_2','rl_9_3']) assert.ok(/0\.5 s after one of Vulmar's stuns/.test(T.talent(H,id).text),id+' states the stun-lock rule');
  assert.ok(/counted up to 6 m/.test(T.talent(H,'fb_1_1').text),'Impact states its 6 m');
  assert.ok(/up to 9%/.test(T.talent(H,'rl_4_3').text)&&/up to 20%/.test(T.talent(H,'rl_5_1').text),'the control-reduction caps are stated');
  assert.ok(/at most 4 s/.test(T.talent(H,'gw_5_1').text),'Leaden states the 4 s ceiling');
  assert.ok(/locks/.test(T.talent(H,'gw_5_2').text)&&/locks/.test(T.talent(H,'fb_5_1').text)&&/locks/.test(T.talent(H,'rl_5_3').text),'the PICK ONE locks are in the texts');
});

/* ============================== HIS REAL KIT ============================== */
test('Vulmar: his real kit, as the talents read it - the sling (nearest, teleported to the next, 0.42 / 0.35 s), the Vow (farthest, 2 m, 0.85 s, no damage), the ult (lift 2 s, slam, raw 1 s) and the page sites',()=>{
  { const P=L0(null,{foes:3}), {v,F}=P; at(P,F[2],20,0); const x0=F[0].x, h=F.map(f=>f.hp); castS(P);
    assert.ok(h[0]-F[0].hp>0&&h[1]-F[1].hp>0,'the sling hits the nearest and the one it is hurled into');
    near(F[0].x,F[1].x-24,'the nearest is teleported beside the next',1e-6); near(F[0].stunned,0.6*V.ccNerf,'stun 0.42 s',0.01); near(F[1].stunned,0.5*V.ccNerf,'anvil 0.35 s',0.01); assert.equal(h[2],F[2].hp,'the third is untouched'); }
  { const P=L0(null), {v,F}=P; const h=F[1].hp; castV(P);
    assert.equal(F[1].hp,h,'the Vow deals no damage'); near(F[1].silencedT,1.21*V.ccNerf,'silenced 0.85 s',0.02); near(F[1].stunned,1.21*V.ccNerf,'rooted 0.85 s',0.02); assert.ok(F[1].pulledBy===v,'dragged to him');
    secs(1.4); const dd=Math.hypot(F[1].x-v.x,F[1].y-v.y)/V.METER; assert.ok(dd<4.5,'it ends beside him ('+dd.toFixed(2)+' m centre to centre: 2 m, then the bodies part)'); }
  { const P=L0(null,{foes:3}), {v,F}=P; at(P,F[2],30,0); const h=F.map(f=>f.hp); castU(P,F[0]);
    assert.ok(F[0]._liftT>0&&F[1]._liftT>0&&!(F[2]._liftT>0),'the circle (8 m of the target) lifts'); assert.equal(F[0].hp,h[0],'no damage at the cast');
    secs(2.1); assert.ok(F[0].hp<h[0],'the slam deals it'); assert.ok(F[0].stunned>0.8&&F[0].stunned<=1.0,'and a raw 1 s stun'); }
  { const P=L0(['gw_7_3'],{foes:3}), {v,F}=P; at(P,F[2],30,0); let pts=0, slams=0;
    const T0=P.T; T0.on.at=(T0.on.at||[]).concat([{key:'probe#a',id:'',on:'at',do:[{fn:'__pA'}]}]); T0.on.part=(T0.on.part||[]).concat([{key:'probe#p',id:'',on:'part',do:[{fn:'__pP'}]}]);
    T0.fn=Object.assign({},T0.fn,{__pA:()=>{ pts++; },__pP:(A,T,u,c)=>{ if(c.skill==='slam') slams++; }});
    castU(P,F[0]); secs(2.2); assert.equal(pts,1,'the at site runs for the ultimate'); assert.equal(slams,2,'the slam site runs for each slammed enemy'); }
});

/* ============================== HEFT ============================== */
test('Vulmar / Heft: an ability hit lays 1 (8 s, Heavier Still longer), slows 1% a rank a Heft (Measured Step more), Leaden Weight at 3+, Millstone, Second Knot, Deep Memory',()=>{
  { const P=L0(['gw_1_1','gw_2_1','gw_11_1','gw_4_1']), {v,F}=P; castS(P); assert.equal(heft(P,F[0]),1,'the sling lays 1 Heft on the hurled'); assert.equal(heft(P,F[1]),1,'and on the anvil');
    V.step(2); near(1-F[0].slowMul,1*(0.01*R('gw_1_1')+0.002*R('gw_11_1')),'the slow: 1%/rank a Heft + Measured Step',1e-6);
    for(let i=0;i<2;i++){ unstunAll(P); castS(P); } V.step(2); assert.ok(heft(P,F[0])>=3,'three casts, three Heft'); assert.ok(F[0].hasteMul<1-0.02*R('gw_4_1')+1e-9,'Leaden Weight: 3+ Heft attack slower');
    secs(8+R('gw_2_1')-0.3); assert.ok(heft(P,F[0])>0,'still there before 8 s + Heavier Still'); secs(0.6); assert.equal(heft(P,F[0]),0,'gone after'); }
  { const P=L0(['gw_1_1','gw_4_2']), {F}=P; castS(P); assert.equal(heft(P,F[0]),1+R('gw_4_2'),'Second Knot: more on the hurled'); assert.equal(heft(P,F[1]),1+R('gw_4_2'),'and on the anvil'); }
  { const P=L0(['gw_1_1','gw_12_1']), {F}=P; castS(P); assert.equal(heft(P,F[0]),1+R('gw_12_1'),'Deep Memory: the first ability of the wave lays more');
    unstunAll(P); castS(P); assert.equal(heft(P,F[0]),2+R('gw_12_1'),'the second cast: no Deep Memory'); }
  { const P=L0(['gw_7_1']), {v,F}=P; P.T.s.api.ustPut(P.T,v,F[0],'vuHeft',5);
    const a=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})); P.T.s.api.ustPut(P.T,v,F[0],'vuHeft',0); const b=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'}));
    near(a/b,1+5*0.004*R('gw_7_1'),'Millstone: 0.4%/rank a Heft from him',1e-6); }
});
test('Vulmar / Pressed Flat: at 6 Heft, a 1 s stun (Ground Remembers longer), Heft clears; it waits out his stuns and their 0.5 s (the stun-lock rule); Settling, Shared Burden',()=>{
  const P=L0(['gw_1_1','gw_2_1','gw_3_1','gw_8_1','gw_10_1','gw_6_1'],{foes:3}), {v,F}=P; at(P,F[1],8,0); at(P,F[2],8,-4.6); const api=P.T.s.api;
  api.ustPut(P.T,v,F[0],'vuHeft',5); castS(P);   // the 6th Heft lands on a hit; the sling's own stun comes right after it
  const r=rq(P,F[0]); assert.ok(r.pend||vu(P).stats.press===1,'six Heft: a press is due');
  if(vu(P).stats.press===0){ assert.ok(F[0].stunned<=0.6,'not yet: the sling stun'); let i=0; for(;i<200&&vu(P).stats.press===0;i++) V.step(1); assert.ok(vu(P).stats.press===1,'it lands');
    assert.ok(i*V.STEP>0.42+0.5-0.06,'only after the sling stun ended plus 0.5 s ('+(i*V.STEP).toFixed(2)+' s)'); }
  near(F[0].stunned,1+0.1*R('gw_8_1'),'Pressed Flat: 1 s + 0.1/rank Ground Remembers, at full length',0.06); assert.equal(heft(P,F[0]),0,'its Heft clears');
  assert.equal(heft(P,F[2]),2,'Settling: 2 Heft on an enemy within 2.5 m');
  const a=lost(F[0],()=>V.hit(P.A[0]||v,F[0],1000,{kind:'true'})); secs(3.1); const b=lost(F[0],()=>V.hit(P.A[0]||v,F[0],1000,{kind:'true'}));
  near(a/b,1+0.05*R('gw_6_1'),'Shared Burden: 3 s of more damage from his team',1e-6);
  const P2=L0(['gw_1_1','gw_3_1']), api2=P2.T.s.api; api2.ustPut(P2.T,P2.v,P2.F[0],'vuHeft',5); P2.F[0].stunned=2; api2.acts(P2.T,P2.v,[{ustack:'vuHeft',on:'target',add:1}],{u:P2.v,tgt:P2.F[0]});
  assert.equal(vu(P2).stats.press,0,'never on an enemy already stunned');
});

/* ============================== TETHER ============================== */
test('Vulmar / Tether: the Vow\'s enemy is held within 3 m of where it landed (Anchor Point shorter), 4 s (Taut Line longer), takes 3%/rank more from him; Drawn Tight, Heavy Line, Two Tethers, Vow of Return',()=>{
  const P=L0(['gw_1_4','gw_5_4','gw_8_4','gw_3_4','gw_6_4','gw_9_4','gw_1_1','gw_7_2','gw_6_2'],{foes:4}), {v,F}=P;
  at(P,F[0],4.5,0); at(P,F[1],14,0); at(P,F[2],14,3.6); at(P,F[3],30,0);   // F3 farthest; F1 near F3? no: Vow of Return reads 2 m of the target
  at(P,F[2],29,3.7); castV(P);
  assert.ok(F[2].pulledBy===v,'Vow of Return: the enemy within 2 m of its target is dragged too'); assert.ok(F[2].silencedT>0,'and silenced'); near(F[2].silencedT,F[3].silencedT/2,'half as long',0.02);
  secs(1.3); const r=rq(P,F[3]); assert.ok(r&&r.teth>0,'the Vow\'s enemy is Tethered on landing'); near(r.tr,Math.max(1.5,3-0.5*R('gw_8_4')),'Anchor Point: the reach',1e-9);
  assert.ok(rq(P,F[2]).teth>0,'Vow of Return\'s enemy too');
  F[3].x+=10*V.METER; V.step(1); { const dd=Math.hypot(F[3].x-r.tx,F[3].y-r.ty)/V.METER; assert.ok(dd<=r.tr+1,'moved 10 m out: clamped back to the rim (then bodies part: '+dd.toFixed(2)+' m)'); }
  const a=lost(F[3],()=>V.hit(v,F[3],1000,{kind:'true'}));
  const dIn=lost(v,()=>V.hit(F[3],v,1000,{kind:'true'}));
  assert.ok(r.teth>4+0.4*R('gw_5_4')-0.4&&r.teth<=4+0.4*R('gw_5_4'),'4 s + 0.4/rank Taut Line, counted down from the landing ('+r.teth.toFixed(2)+' s left)');
  const h=heft(P,F[3]); secs(r.teth+0.1); assert.equal(rq(P,F[3]).teth,0,'it ends'); assert.equal(heft(P,F[3]),Math.min(6,h+R('gw_6_4')),'Heavy Line: Heft when it ends');
  const b=lost(F[3],()=>V.hit(v,F[3],1000,{kind:'true'})); near(a/b,1+0.03*R('gw_1_4'),'Tether: 3%/rank more from him',1e-6);
  const dOut=lost(v,()=>V.hit(F[3],v,1000,{kind:'true'}));
  near(dIn/dOut,1-0.02*R('gw_3_4'),'Drawn Tight: a Tethered enemy deals 2%/rank less',1e-6);
  { const Q=L0(['gw_1_4','gw_9_4','gw_8_4'],{foes:3}); at(Q,Q.F[1],20,0); at(Q,Q.F[2],30,5); castV(Q); const x0=Q.F[0].x; secs(1.3); assert.ok(rq(Q,Q.F[0])&&rq(Q,Q.F[0]).teth>0,'Two Tethers: the enemy nearest it where it lands too'); const r0=rq(Q,Q.F[0]); assert.ok(Math.abs(r0.tx-x0)<2*V.METER,'(anchored where it stands, not dragged)'); V.step(2); assert.ok(Math.hypot(Q.F[0].x-r0.tx,Q.F[0].y-r0.ty)<=(r0.tr+1)*V.METER,'and held within its reach (the clamp runs before bodies are pushed apart: within a step of push)'); assert.ok(!(rq(Q,Q.F[1])&&rq(Q,Q.F[1]).teth>0),'(not one far away)'); }
});

/* ============================== IMPACT ============================== */
test('Vulmar / Impact: 4%/rank of his ability power a metre his kit moved an enemy (counted up to 6 m), when it lands; Bone Meets Bone, Bound to Fall, Driven In, Heavy Bodies, Thrown Hard, Second Bounce, Second Impact',()=>{
  { const P=L0(['fb_1_1']), {v,F}=P; const x0=F[0].x; castS(P); const m=Math.abs(F[0].x-x0)/V.METER; near(vu(P).stats.impact,ap(P)*0.04*R('fb_1_1')*m,'the sling: at the collision, by the metres flown',1e-3); }
  { const P=L0(['fb_1_1']), {v,F}=P; at(P,F[1],20,0); castV(P); assert.equal(vu(P).stats.imp,0,'the Vow: nothing yet'); secs(1.3); near(vu(P).stats.impact,ap(P)*0.04*R('fb_1_1')*6,'at the landing, counted up to 6 m (18 m dragged)',1e-3); }
  { const P=L0(['fb_1_1','fb_2_1','fb_n1','fb_6_1','fb_8_1','fb_11_1']), {v,F}=P; F[0].maxHp=F[0].hp=v.maxHp*10; at(P,F[1],12,0); const x0=F[0].x, h1=F[1].hp; castS(P); const m=Math.abs(F[0].x-x0)/V.METER;
    const k=1.05*(1+0.02*R('fb_6_1'))*(1+0.05*R('fb_8_1'))*(1+0.02*R('fb_11_1')); assert.ok(m>=5);
    near(vu(P).stats.impact,ap(P)*0.2*Math.min(6,m)*k,'Bound to Fall (5 m+), Driven In (stunned), Heavy Bodies (more max HP), Thrown Hard',1e-3);
    const sp=ap(P)*1.0*V.cast.length*0; void sp; assert.ok(h1-F[1].hp>0,'the anvil took its splash and Bone Meets Bone'); }
  { const P=L0(['fb_1_1','fb_n3']), {v,F}=P; at(P,F[1],20,0); F[1].maxHp=1e6; F[1].hp=0.5*1e6+ap(P)*0.2*6*0.5; castV(P); secs(1.3);
    assert.ok(rq(P,F[1]).sb,'Second Bounce: the Vow Impact took it below 50%'); assert.equal(vu(P).stats.imp,2,'and it took Impact again (once)'); near(vu(P).stats.impact,ap(P)*0.2*(6+R('fb_n3')),'1 m/rank more',1e-3); }
  { const P=L0(['fb_1_1','fb_9_1']), {v,F}=P; at(P,F[1],20,0); F[1].maxHp=1e6; F[1].hp=50; v.greenCd=5; castV(P); secs(1.3); assert.ok(!F[1].alive,'an Impact kill'); assert.equal(v.greenCd,0,'Second Impact: the sling is ready'); }
});

/* ============================== DEBRIS ============================== */
test('Vulmar / Debris: the sling\'s collision leaves 2 m of Debris (Rubble Field wider) for 4 s (Settled Dust longer) - 3%/rank AP every 0.5 s, Grinding Debris slows, Sharp Stones, Packed Debris, Avalanche Field',()=>{
  const P=L0(['fb_1_4','fb_2_4','fb_4_4','fb_6_4','fb_8_4','fb_10_4','fb_2_3']), {v,F}=P; castS(P);
  const Z=P.T.s.zn.vuDeb; assert.ok(Z&&Z.length===1,'one Debris zone'); near(Z[0].r/V.METER,(2+0.3*R('fb_6_4'))/2,'Rubble Field: wider',1e-9);
  near(Z[0].until-V.now(),4+0.5*R('fb_2_4'),'Settled Dust: longer',0.05);
  const n0=vu(P).stats.deb; secs(1.05); assert.ok(vu(P).stats.deb>=n0+2,'it ticks every 0.5 s'); assert.ok(F[0].slowMul<=1-0.03*R('fb_4_4')+1e-9,'Grinding Debris slows');
  F[0].stunned=1; rq(P,F[0]).sls=1; const h=F[0].hp; vu(P).debT=V.STEP/2; V.step(1); near(h-F[0].hp,0.03*R('fb_1_4')*ap(P)*(1+0.06*R('fb_8_4'))*dmul(P,F[0]),'a tick: 3%/rank AP, Sharp Stones on a sling-stunned enemy',1e-3);
  const m0=stack(P,'vuMass'); F[1].hp=1; V.hit(v,F[1],100,{kind:'true'}); V.step(1); assert.equal(stack(P,'vuMass'),Math.min(10,m0+R('fb_10_4')),'Packed Debris: a death inside, Mass');
  const Q=L0(['fb_1_4','fb_10_4','fb_11_4'],{foes:3}); at(Q,Q.F[2],30,0); castU(Q,Q.F[0]); secs(2.2); const Z2=Q.T.s.zn.vuDeb; assert.ok(Z2&&Z2.some(z=>Math.abs(z.r-8*V.METER)<1),'Avalanche Field: the whole circle');
});

/* ============================== MASS ============================== */
test('Vulmar / Mass: +1 an enemy hurled or dragged (10, 6 s; Gathering Mass longer), 0.4%/rank AP a Mass, Full Mass, Mass Retained, World\'s Weight, Gravity Keeps, Unstepped Power, Last Knot',()=>{
  const P=L0(['fb_2_3','fb_4_3','fb_5_3','fb_9_3','fb_12_2','fb_10_2','fb_11_3','fb_12_3']), {v,F}=P; const ap0=v.apow;
  castS(P); assert.equal(stack(P,'vuMass'),1,'the sling hurled one'); V.step(2); near(v.apow/ap0,1+0.004*R('fb_2_3'),'0.4%/rank AP a Mass',1e-6);
  secs(6+R('fb_4_3')-0.2); assert.equal(stack(P,'vuMass'),1,'held 6 s + Gathering Mass'); secs(0.4); assert.equal(stack(P,'vuMass'),0,'then lost');
  P.T.s.api.stSet(P.T,v,'vuMass',10); const a=lost(F[0],()=>{ unstunAll(P); castS(P); }); P.T.s.api.stSet(P.T,v,'vuMass',0); vu(P).first=1;
  const b=lost(F[0],()=>{ unstunAll(P); at(P,F[0],4.5,0); castS(P); }); assert.ok(a>b*(1+0.03*R('fb_5_3'))*0.97,'Full Mass at 10');
  P.T.s.api.stSet(P.T,v,'vuMass',5); near(FX.cd(v,'green',7),7*(1-0.002*R('fb_9_3')*5),'Mass Retained: shorter a Mass',1e-6);
  const m=stack(P,'vuMass'); FX.unmoved(v,F[0],'pull'); assert.equal(stack(P,'vuMass'),Math.min(10,m+R('fb_11_3')),'Unstepped Power: a refused pull');
  P.T.s.api.stSet(P.T,v,'vuMass',0); v.greenCd=5; v.hp=0.25*v.maxHp; V.step(2); assert.equal(v.greenCd,0,'Last Knot: below 30% the sling resets'); assert.equal(stack(P,'vuMass'),2*R('fb_12_3'),'and Mass');
  const Q=L0(['fb_2_3','fb_10_2'],{foes:3}); at(Q,Q.F[2],30,0); castU(Q,Q.F[0]); assert.equal(stack(Q,'vuMass'),2*R('fb_10_2'),'Gravity Keeps: 1/rank a lifted enemy');
  const W=L0(['fb_12_2'],{foes:3}); at(W,W.F[2],30,0); W.T.s.api.stSet(W.T,W.v,'vuMass',10); const hA=W.F[0].hp; castU(W,W.F[0]); secs(2.1); const dA=hA-W.F[0].hp;
  const Wp=L0(null,{foes:3}); at(Wp,Wp.F[2],30,0); const hB=Wp.F[0].hp; castU(Wp,Wp.F[0]); secs(2.1); near(dA/(hB-Wp.F[0].hp),1+0.005*R('fb_12_2')*10,'World\'s Weight on the slam',0.01);
});

/* ============================== THE SLING ============================== */
test('Vulmar / the sling: Added Weight, Sling Strength, Splash Weight, Sure Grip, Measured Sling, Leaden, Felled Together, Sling Aside, Cast Far, Great Fall, Spin and Release, Double Sling, Bound Pair',()=>{
  { const P=L0(['gw_6_2','fb_3_2']), {F}=P; const a=lost(F[0],()=>castS(P)); const Q=L0(null); const b=lost(Q.F[0],()=>castS(Q)); near(a/b,(1+0.05*R('gw_6_2'))*(1+0.03*R('fb_3_2')),'Added Weight x Sling Strength',1e-3); }
  { const P=L0(['fb_4_2']), {F}=P; const a=lost(F[1],()=>castS(P)); const Q=L0(null); const b=lost(Q.F[1],()=>castS(Q)); near(a/b,(0.5+0.1*R('fb_4_2'))/0.5,'Splash Weight: half up to 80%',1e-3); }
  { const P=L0(['gw_2_2','rl_6_1','gw_5_1']), {F}=P; castS(P); near(F[0].stunned,0.42*(1+0.02*R('gw_5_1'))+0.1*R('gw_2_2')+0.2*R('rl_6_1'),'(base x Leaden) + Sure Grip + Measured Sling',0.01);
    near(F[1].stunned,0.35*(1+0.02*R('gw_5_1'))+0.1*R('gw_2_2')+0.2*R('rl_6_1'),'the anvil\'s too',0.01); }
  { const P=L0(['gw_9_2']), {v,F}=P; castS(P); secs(1); const a=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})); secs(2.1); const b=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})); near(a/b,1+0.02*R('gw_9_2'),'Felled Together 3 s',1e-6); }
  { const P=L0(['rl_7_1'],{foes:3,allies:1}), {v,F,A}=P; at(P,A[0],20,10); A[0].hp=A[0].maxHp*0.1; at(P,F[2],20,13); const h=F[2].hp; castS(P); assert.ok(F[2].hp<h,'Sling Aside: the enemy nearest his lowest-HP ally'); }
  { const P=L0(['fb_3_1'],{foes:3}), {F}=P; at(P,F[1],8,0); at(P,F[2],10,3); const h1=F[1].hp, h2=F[2].hp; castS(P); near(F[0].x,F[2].x-24,'Cast Far: hurled into the farthest within 6 m (not the next one)',1e-6); assert.ok(F[2].hp<h2&&F[1].hp===h1); }
  { const P=L0(['fb_5_1','fb_1_1']), {F}=P; const h1=F[1].hp, x0=F[0].x; const a=lost(F[0],()=>castS(P)); assert.equal(F[1].hp,h1,'Great Fall: no second enemy'); assert.equal(F[0].x,x0,'(not hurled)');
    near(F[0].stunned,0.42+0.5,'stunned 0.5 s longer',0.01); near(vu(P).stats.impact,ap(P)*0.04*R('fb_1_1')*3,'its drop counts 3 m',1e-3); }
  { const P=L0(['fb_5_2'],{foes:3}), {F}=P; at(P,F[2],13,0.5); const h=F[2].hp; castS(P); assert.ok(F[2].hp<h,'Spin and Release: the enemy on the 6 m line takes the splash'); }
  { const P=L0(['gw_5_2'],{foes:4}), {F}=P; at(P,F[2],-4.5,0); at(P,F[3],-10,0); const x2=F[2].x; castS(P); near(F[2].x,F[3].x+24,'Double Sling: the second nearest into the next',1e-6); assert.ok(F[3].stunned>0.3,'its anvil stunned'); }
  { const P=L0(['gw_5_3']), {v,F}=P; castS(P); const h1=F[1].hp; V.hit(v,F[0],1000,{kind:'true'}); near(h1-F[1].hp,250,'Bound Pair: 25% to the other',1e-3); secs(3.1); const h2=F[1].hp; V.hit(v,F[0],1000,{kind:'true'}); assert.equal(F[1].hp,h2,'3 s'); }
});

/* ============================== THE VOW ============================== */
test('Vulmar / the Vow: Patient Vow and Quiet Hands, Calm Weight and Clear Thought, Deeper Silence and Vow Kept, Long Arm, Gravity Shelter, Cast Down',()=>{
  { const P=L0(['gw_2_3','rl_4_1','gw_9_3','rl_9_1']), {v}=P; near(FX.cd(v,'blue',10),(10-0.5*R('gw_2_3')-0.5*R('rl_4_1'))*(1-0.01*R('gw_9_3')-0.01*R('rl_9_1')),'the blue',1e-6); near(FX.cd(v,'green',7),7*(1-0.01*R('gw_9_3')-0.01*R('rl_9_1')),'the green',1e-6); }
  { const P=L0(['gw_4_3','rl_10_1']), {F}=P; castV(P); near(F[1].silencedT,0.85+0.3*R('gw_4_3')+0.3*R('rl_10_1'),'silence 0.3 s/rank longer each',0.02); near(F[1].stunned,0.85,'(the root is not)',0.02); }
  { const P=L0(['fb_6_3']), {F}=P; castV(P); const h=F[1].hp; secs(1.3); near(h-F[1].hp,0.3*R('fb_6_3')*ap(P)*dmul(P,F[1]),'Long Arm: 30%/rank AP when it lands',0.02); }
  { const P=L0(['rl_5_4'],{foes:3,allies:1}), {v,F,A}=P; at(P,A[0],0,-5.5); A[0].hp=A[0].maxHp*0.1; F[0].target=A[0]; at(P,F[2],30,0); castV(P); assert.ok(F[0].pulledBy===v,'Gravity Shelter: the enemy attacking his lowest-HP ally'); assert.ok(F[2].pulledBy!==v); }
  { const P=L0(['fb_7_3'],{foes:4}), {v,F}=P; at(P,F[0],14,0); at(P,F[1],15,1); at(P,F[2],14,2); at(P,F[3],30,0); castV(P); assert.ok(F[3].pulledBy&&F[3].pulledBy!==v,'Cast Down: hurled to the thickest group');
    for(const f of F.slice(0,3)) f.silencedT=0; secs(1.3); assert.ok(F.slice(0,3).filter(f=>f.silencedT>0.8).length>=2,'every enemy there silenced 1 s'); }
});

/* ============================== THE ULTIMATE ============================== */
test('Vulmar / Weight of the World: Wide Circle, Grave Weight, Crushing Slam, Slow Descent, Lingering Press, Grave Mercy, Held Silence, Falling Sky, Heavy Patience, Settled Mind, Lifted Load, What Cannot Be Lifted',()=>{
  { const P=L0(['gw_8_3'],{foes:3}), {F}=P; at(P,F[1],4.5+8.6,0); at(P,F[2],30,0); castU(P,F[0]); assert.ok(F[1]._liftT>0,'Wide Circle: 8 m + 0.2/rank'); }
  { const Q=L0(null,{foes:3}); at(Q,Q.F[2],30,0); const b=Q.F[0].hp; castU(Q,Q.F[0]); secs(2.1); const dQ=b-Q.F[0].hp;
    const P=L0(['gw_7_3','fb_8_2'],{foes:3}); at(P,P.F[2],30,0); const a=P.F[0].hp; castU(P,P.F[0]); secs(2.1);
    near((a-P.F[0].hp)/dQ,(1+0.03*R('gw_7_3'))*(1+0.03*R('fb_8_2')),'Grave Weight x Crushing Slam on the slam',1e-3); }
  { const P=L0(['gw_1_1','gw_11_2','gw_12_2','rl_11_3','rl_12_3','fb_1_1','fb_9_2','gw_10_3'],{foes:3,allies:1}), {v,F,A}=P; at(P,F[2],30,0); v.energy=0; castU(P,F[0]); secs(2.1);
    assert.ok(heft(P,F[0])>=2*R('gw_11_2'),'Slow Descent'); near(1-F[0].slowMul,Math.max(0.04*R('gw_12_2'),1-F[0].slowMul),'Lingering Press',1e-9); assert.ok(F[0].slow>2.5,'for 3 s');
    near(F[0].silencedT,0.2*R('rl_12_3'),'Held Silence at full length (0.1 s after the slam)',0.15); assert.ok(rq(P,F[0]).gm>3.5,'Grave Mercy 4 s');
    near(vu(P).stats.impact,2*ap(P)*0.04*R('fb_1_1')*R('fb_9_2')*1,'Falling Sky: an Impact of 1 m/rank each',0.05); assert.ok(v.energy>=2*R('gw_10_3'),'Heavy Patience: energy for each slam stun');
    const d1=lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})); secs(4.1); const d2=lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})); near(d1/d2,1-0.02*R('rl_11_3'),'Grave Mercy: less from it',1e-6); }
  { const P=L0(['rl_7_2'],{foes:3,allies:1}), {v,F,A}=P; at(P,F[2],30,0); castU(P,F[0]); const a=lost(A[0],()=>V.hit(F[2],A[0],1000,{kind:'true'})); secs(2.2); const b=lost(A[0],()=>V.hit(F[2],A[0],1000,{kind:'true'})); near(a/b,1-0.03*R('rl_7_2'),'Lifted Load',1e-6); }
  { const P=L0(['gw_n2'],{foes:3,allies:1}), {v,F,A}=P; at(P,F[2],30,0); F[0].level=400; castU(P,F[0]); assert.ok(!(F[0]._liftT>0),'resisted'); assert.ok(rq(P,F[0]).wc>3.5,'What Cannot Be Lifted');
    const a=lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})); secs(4.1); const b=lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})); near(a/b,1-0.05*R('gw_n2'),'it deals 5%/rank less 4 s',1e-6); }
  { const P=lab(H,S(['gw_n1']),{foes:2,cold:true}); P.v.energy=0; V.step(1); assert.equal(P.v.energy,2*R('gw_n1'),'Settled Mind'); }
});

/* ============================== RISE ============================== */
test('Vulmar / Rise: +1 every 6 s (Higher Still sooner, High Lotus more), 0.6%/rank DR a Rise, Soft Air, Lightened, Above Reach, Unreached, Height of Calm and Quiet Breath under the 1.2% a second',()=>{
  { const P=L0(['rl_1_2','rl_2_2','rl_8_2','rl_5_2','rl_6_2']), {v}=P; const per=Math.max(3,6-R('rl_2_2')), ap0=v.apow, sp0=v.speed;
    secs(per+0.05); assert.equal(stack(P,'vuRise'),1,'a Rise after '+per+' s'); secs(per*10); assert.equal(stack(P,'vuRise'),5+R('rl_8_2'),'High Lotus: the cap');
    V.step(2); near(v.apow/ap0,1+0.003*R('rl_5_2')*stack(P,'vuRise'),'Soft Air',1e-6); near(v.speed/sp0,1+0.04*R('rl_6_2'),'Lightened at 3+',1e-6);
    near(P.T.fn.drK(P.T.s.api,P.T,v,null,{}),1-0.006*R('rl_1_2')*stack(P,'vuRise'),'0.6%/rank a Rise',1e-9); }
  { const P=L0(['rl_1_2','rl_3_2','rl_11_2']), {v,F}=P; P.T.s.api.stSet(P.T,v,'vuRise',5); v.maxHp=v.hp=1e7;
    const a=lost(v,()=>V.hit(F[0],v,1000,{kind:'true',auto:true})), b=lost(v,()=>V.hit(F[0],v,1000,{kind:'true',auto:true}));
    near(b,1000*(1-0.03*5)*0.75,'Above Reach on a melee basic at 5 Rise',1e-3); near(a,Math.max(1000*0.6,b*(1-0.15*R('rl_11_2'))),'Unreached: the first hit in 8 s, inside the 40% floor',1e-3); }
  { const P=L0(['rl_1_1','rl_10_2','rl_1_2']), {v}=P; P.T.s.api.stSet(P.T,v,'vuRise',5); v.hp=0.2*v.maxHp; const h=v.hp; secs(10); { const g=(v.hp-h)/v.maxHp; assert.ok(g>=0.105&&g<=0.12+1e-9,'Quiet Breath + Height of Calm: at most 1.2% of max HP a second ('+(g*10).toFixed(4)+' a second over 10 s; 1.3% uncapped)'); } }
});

/* ============================== SACRAMENT ============================== */
test('Vulmar / Sacrament: hits on his allies within 6 m (Counted Names more), spent by the Vow as a shield on his lowest-HP ally (Weighed Deeds, Recompense, Patient Gravity, Bearing It), Old Debt, Kept Count',()=>{
  const P=L0(['rl_1_4','rl_2_4','rl_3_4','rl_9_4','rl_10_4','rl_4_4','rl_6_4','rl_12_4'],{allies:2,big:false}), {v,F,A}=P; at(P,A[1],0,-30);
  V.hit(F[0],A[0],500,{kind:'true'}); V.hit(F[0],A[1],500,{kind:'true'}); near(vu(P).pen,500,'only the ally within 6 m counts',1e-6);
  V.hit(F[0],A[0],1e8,{kind:'true'}); near(vu(P).pen,(0.30+0.10*R('rl_2_4'))*v.maxHp,'Counted Names: the cap',1e-6);
  const pool=vu(P).pen; A[1].hp=1; v.energy=0; const sh0=A[1].shield||0; castV(P);
  near((A[1].shield||0)-sh0,pool*0.08*R('rl_1_4')*(1+0.03*R('rl_3_4'))*(v.shieldStrMul||1),'the shield on the lowest-HP ally: 8%/rank, Weighed Deeds',1e-3); near(A[1].shieldT,4+0.5*R('rl_9_4'),'Recompense',1e-6);
  assert.equal(vu(P).pen,0,'all of it spent'); assert.ok(v.energy>=3*R('rl_10_4'),'Patient Gravity');
  near(P.T.fn.drK(P.T.s.api,P.T,v,null,{}),1-0.02*R('rl_4_4'),'Bearing It while it holds',1e-9);
  A[0].hp=1; V.hit(F[0],A[0],1e3,{kind:'true'}); V.step(1); near(vu(P).pen,Math.min((0.30+0.10*R('rl_2_4'))*v.maxHp,1+0.04*R('rl_6_4')*v.maxHp),'Old Debt',0.02);
  const keep=vu(P).pen; V.wave(); VMX('battleTime=0'); V.step(1); near(vu(P).pen,keep*0.10*R('rl_12_4'),'Kept Count: 10%/rank carries',1e-6);
});

/* ============================== AURAS ============================== */
test('Vulmar / around him: Held in Place, Steady Ground, Unstepped Circle, Quiet Air, Ward of Weight, Floating Guard, Fall Away, Settled Calm',()=>{
  { const Q=L0(null,{allies:2}); const ar=[Q.A[0].armorRating,Q.A[1].armorRating]; const P=L0(['rl_4_3','rl_7_3','rl_5_3'],{allies:2}), {A}=P; V.step(2);
    near(A[0].ctrlRes,0.03*R('rl_4_3'),'Held in Place within 4 m',1e-9); assert.equal(A[1].ctrlRes||0,0,'(not 11 m away)'); near(A[0].armorRating/ar[0],1+0.015*R('rl_7_3'),'Steady Ground',1e-9); assert.ok(A[0].immovable,'Unstepped Circle'); assert.ok(!A[1].immovable); }
  { const P=L0(['rl_3_3'],{allies:1}), {v,F,A}=P; V.step(1); A[0].pulledBy=F[0]; A[0].pullT=1; A[0].pullSpeed=100; V.step(1); near(A[0].pullSpeed,100*(1-0.10*R('rl_3_3')),'Quiet Air: a pull moves it less',1e-6); }
  { const P=L0(['rl_8_3'],{allies:1}), {v,F,A}=P; at(P,F[1],0,-20); const a=lost(A[0],()=>V.hit(F[1],A[0],1000,{kind:'true'})), b=lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'}));
    near(a,1000*(1-0.02*R('rl_8_3')),'Ward of Weight: from more than 6 m',1e-6); near(b,1000,'not from near',1e-6); }
  { const P=L0(['rl_12_1'],{allies:3}), {v,A}=P; at(P,A[1],4,-3); at(P,A[2],-4,-3); V.step(1); near(P.T.fn.drK(P.T.s.api,P.T,v,null,{}),1-0.01*R('rl_12_1')*3,'Floating Guard: 3 allies',1e-9); }
  { const P=L0(['rl_9_3'],{allies:1,foes:2}), {v,F,A}=P; at(P,F[0],0,-9); A[0].maxHp=1e5; A[0].hp=0.35e5; V.hit(F[1],A[0],0.1e5,{kind:'true'});
    assert.ok(F[0].stunned>0.4&&F[0].stunned<=0.51,'Fall Away: stunned 0.5 s'); assert.ok(F[0].pulledBy,'and thrown'); const s=vu(P).stats.fa; A[0].hp=0.35e5; V.hit(F[1],A[0],0.1e5,{kind:'true'}); assert.equal(vu(P).stats.fa,s,'once a wave'); }
  { const P=L0(['rl_5_1']), {v,F}=P; v.stunned=0; v.level=1; V.cc(F[0],v,'stunned',1); near(v.stunned,0.7*(1-0.04*R('rl_5_1')),'Settled Calm',1e-6); }
});

/* ============================== SIGNATURES ============================== */
test('Vulmar / the signatures: The Pressed District, Everything Falls, Coming Down',()=>{
  { const P=L0(['gw_13_2','gw_12_2','gw_11_2','gw_2_1','gw_1_1'],{foes:3}), {v,F}=P; at(P,F[2],30,0); castU(P,F[0]); secs(2.1);
    const Z=P.T.s.zn.vuPD; assert.ok(Z&&Z.length===1,'the ground is pressed'); near(Z[0].until-V.now(),6,'for 6 s',0.1); V.step(2); assert.ok(F[0].slowMul<=0.65+1e-9,'slowed 35%');
    let pressed=0; for(let i=0;i<220;i++){ V.step(1); pressed=vu(P).stats.pd; if(pressed) break; } assert.ok(pressed>=1,'6 Heft inside: a 1.5 s stun'); }
  { const P=L0(['fb_13_2','fb_2_3'],{foes:3}), {v,F}=P; at(P,F[2],30,0); const ap0=ap(P); castU(P,F[0]); assert.ok(F[0]._liftStun>1.4,'Everything Falls: 0.5 s longer'); secs(2.1);
    near(vu(P).stats.impact,2*ap0*0.20*4,'a full 4 m Impact each',0.05); secs(5); assert.equal(stack(P,'vuMass'),10,'10 Mass held'); assert.ok(vu(P).mh>0); secs(3.5); assert.equal(vu(P).mh,0,'for 8 s (then it lapses as Mass does)'); }
  { const P=L0(['rl_13_3','rl_1_2'],{foes:3,allies:1}), {v,F,A}=P; at(P,F[1],4.5+10,0); at(P,F[2],40,0); P.T.s.api.stSet(P.T,v,'vuRise',5); castU(P,F[0]);
    assert.ok(F[1]._liftT>0,'the circle 3 m wider'); near(F[0]._liftStun,2,'stunned 1 s longer',1e-6); assert.equal(stack(P,'vuRise'),0,'Rise starts again'); V.step(2); assert.ok(A[0].immovable,'allies cannot be displaced');
    const a=lost(A[0],()=>V.hit(F[2],A[0],1000,{kind:'true'})); near(a,750,'25% less',1e-6); P.T.s.api.stSet(P.T,v,'vuRise',5); unstunAll(P); for(const f of F) f._liftT=0; castU(P,F[0]); assert.ok(!(F[1]._liftT>0),'once a fight'); }
});

/* ============================== CAPS ============================== */
test('Vulmar: his damage-reduction talents are one product floored at 60% kept (40% off at most); an ally\'s at 70% kept (30%)',()=>{
  const P=L0(['rl_1_2','rl_8_2','rl_3_2','rl_11_2','rl_12_1','rl_4_4','rl_7_2','rl_13_3','gw_12_4','fb_n2','gw_n2','gw_3_4','rl_11_3','rl_8_3'],{allies:3}), {v,F,A}=P;
  P.T.s.api.stSet(P.T,v,'vuRise',8); vu(P).cdw=8; vu(P).e[F[0].uid]={u:F[0],st:0,lk:0,teth:4,tx:F[0].x,ty:F[0].y,tr:30,pend:0,lr:4,gm:4,wc:4,wcl:0,fel:0,shb:0,bond:0,sls:0,run:0}; P.T.s.api.ustPut(P.T,v,F[0],'vuHeft',3); v.maxHp=v.hp=1e7;
  near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true',auto:true})),600,'on him: 40% at most',1e-6);
  near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),700,'on an ally: 30% at most',1e-6);
});

/* ============================== THE WAVE CLOCK ============================== */
test('Vulmar: his timers are countdowns - a Tether, Rise\'s clock and a Vow still landing carry their time left across a wave change',()=>{
  const P=L0(['gw_1_4','rl_1_2','rl_11_2','fb_9_1','fb_1_1']), {v,F}=P; secs(3); castV(P); secs(1.3); assert.ok(rq(P,F[1]).teth>0,'a Tether runs');
  const W=vu(P); W.unr=5; W.si=4; V.step(1); const u0=W.unr, s0=W.si;
  V.wave(); VMX('battleTime=0'); V.step(1);
  near(W.unr,u0-V.STEP,'Unreached\'s 8 s lock carries what it had left (a countdown, not a fight time)',1e-6); near(W.si,s0-V.STEP,'Second Impact\'s 6 s lock too',1e-6);
  assert.ok(!rq(P,F[1]),'his records of the old wave\'s enemies are dropped'); near(W.riseT,6,'Rise\'s clock starts again at the wave',V.STEP*2);
});

/* ============================== WHOLE FIGHTS ============================== */
test('Vulmar: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H);
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal);
  const mx={heft:0,mass:0,rise:0,teth:0,imp:0,deb:0,press:0};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const W=s._tal.s.vu; if(!W) continue; mx.mass=Math.max(mx.mass,(s._tal.s.k.vuMass||{n:0}).n); mx.rise=Math.max(mx.rise,(s._tal.s.k.vuRise||{n:0}).n);
    for(const x of U) if(x.alive&&x.team!==s.team) mx.heft=Math.max(mx.heft,s._tal.s.api.ustGet(s._tal,s,x,'vuHeft')); mx.teth=W.stats.teth; mx.imp=W.stats.imp; mx.deb=W.stats.deb; mx.press=W.stats.press; }
  console.log('  live fight: '+JSON.stringify(mx)); assert.ok(mx.heft>=1&&mx.rise>=1,'real Heft and Rise'); assert.equal(FX.errors().n,0,'no hook errors: '+FX.errors().last);
  determinism(H,TEAM); assert.equal(FX.errors().n,0,'no hook errors: '+FX.errors().last);
});

const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Vulmar: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they pass his changed lines (sling, Vow, ultimate, slam)',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{ const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['vulmar','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
    const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
    VMX('var __vbN={gs:0,tp:0,ww:0,slam:0}; var __vbD=_doEffectCore, __vbT=think;'+
      '_doEffectCore=function(u,type,o){ if(u&&u.key==="vulmar"){ if(type==="gravsling") __vbN.gs++; if(type==="tendrilpull") __vbN.tp++; if(type==="worldweight") __vbN.ww++; } return __vbD.apply(this,arguments); };'+
      'think=function(u,dt){ if(u&&(u._liftT||0)>0&&u._liftT<=dt&&u._liftBy&&u._liftBy.key==="vulmar") __vbN.slam++; return __vbT.apply(this,arguments); };');
    let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
        const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
        assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
      const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
      for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
        assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
      const c=VMX('__vbN'); console.log('  identity: '+JSON.stringify(c)); assert.ok(c.gs>0&&c.tp>0&&c.ww>0&&c.slam>0,'the fights pass every changed line: '+JSON.stringify(c)); }
    finally{ VMX('_doEffectCore=__vbD; think=__vbT;'); }
    assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* ============================== THE STUN-LOCK RULE IN FIGHTS ============================== */
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={gw:0,fb:1,rl:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const STUNW={ gw:['gw_13_2','gw_3_1','gw_8_1','gw_10_1','gw_5_1','gw_2_2','gw_11_2'], fb:['fb_13_2','fb_5_1'], rl:['rl_13_3','rl_6_1','rl_9_3'] };
test('Vulmar: his talent stuns keep the stun-lock rule in seeded fights, and his longest stun chain on one enemy',()=>{
  const builds=[[['gw'],[91]],[['gw','rl'],[61,30]],[['rl','gw'],[61,30]],[['fb','gw'],[61,30]]].map(([o,c])=>{ const b=deep(o,c,STUNW); assert.equal(T.invalid(H,b,100),'','a legal build'); return {o,list:T.learned(H,b),b}; });
  /* every wave's Vulmar is read before the units go: his own stun records count each run (st > 0 while the enemy is stunned) */
  VMX('var __vs={run:0,press:0,pd:0,locked:0,ticks:0}; var __vsU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ const r=__vsU.apply(this,arguments); for(const u of units){ if(!(u&&u.key==="vulmar"&&u._tal&&u._tal.s.vu)) continue; const s=u._tal.s.vu.stats; __vs.ticks++;'+
    '  if(s.runMax>__vs.run) __vs.run=s.runMax; if(s.press>(u.__vsP||0)){ __vs.press+=s.press-(u.__vsP||0); u.__vsP=s.press; } if(s.pd>(u.__vsD||0)){ __vs.pd+=s.pd-(u.__vsD||0); u.__vsD=s.pd; } if(s.locked>(u.__vsL||0)){ __vs.locked+=s.locked-(u.__vsL||0); u.__vsL=s.locked; } } return r; };');
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')); const out=[];
  try{ for(const B of builds){ VMX('for(const k in __vs) __vs[k]=0');
      const sn=snaps(['vulmar','vael','vireo','gruel','vex'].map(k=>Object.assign(spec(k,100,k===H?B.list:null),{skillLv:[100,100,100,100]})));
      for(const node of [34,60,90,120]) for(const seed of [11,90210]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
      const c=JSON.parse(JSON.stringify(VMX('__vs'))), run=c.run, press=c.press, pd=c.pd, locked=c.locked; assert.ok(c.ticks>300,'he fought');
      out.push(B.o.join('+')+' '+JSON.stringify(T.spent(H,B.b).tree)+': longest run of his stuns on one enemy '+run.toFixed(2)+' s; presses '+press+' (District '+pd+'), talent stuns held back by the lock '+locked);
      console.log('  '+out[out.length-1]); assert.ok(run<6,'a run of stuns he began on one enemy stays short ('+run.toFixed(2)+' s)'); } }
  finally{ VMX('_updateBattleCore=__vsU;'); }
});

/* ============================== PHIL'S 95% CHECK ============================== */
const DEF={ gw:['gw_12_4','gw_3_4','gw_n2'], fb:['fb_n2'], rl:['rl_1_2','rl_8_2','rl_3_2','rl_11_2','rl_12_1','rl_4_4','rl_7_2','rl_13_3','rl_11_3','rl_8_3','rl_1_4'] };
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,0][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,2,-2,0][i]*V.METER; a.y=v.y-[5.5,4,4,11][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on him: every condition of his reduction talents true at once - full Rise (High Lotus), a melee basic at 5+ Rise, Unreached ready, three allies close,
   a Sacrament shield held, an enemy lifted, Coming Down's window, the attacker tethered / carrying Heft / reeling / under Grave Mercy and What Cannot Be Lifted; physical
   and magic, normal and critical; and again with glyph damage reduction at its 30% cap. */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F,A}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.6*v.maxHp; v.shield=0; v.glyphDR=glyph||0;
  if(L.T){ const W=L.T.s.vu, api=L.T.s.api; api.stSet(L.T,v,'vuRise',api.stMax(L.T,v,'vuRise')); W.cdw=8; W.unr=0; A[0].shield=100; W.sh={t:A[0],left:9}; F[1]._liftT=1; F[1]._liftBy=v; F[1]._liftL=2;
    const r=W.e[f.uid]||(W.e[f.uid]={u:f,st:0,lk:0,teth:0,tx:f.x,ty:f.y,tr:30,pend:0,lr:0,gm:0,wc:0,wcl:0,fel:0,shb:0,bond:0,sls:0}); r.teth=9; r.tr=30; r.lr=9; r.gm=9; r.wc=9; api.ustPut(L.T,v,f,'vuHeft',3); }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:true}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Vulmar: his most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and he is at 85% or more for well under half a fight',()=>{
  const cands=[[['gw','fb'],[61,30]],[['gw','rl'],[61,30]],[['fb','gw'],[61,30]],[['fb','rl'],[61,30]],[['rl','gw'],[61,30]],[['rl','fb'],[61,30]],[['gw'],[91]],[['fb'],[91]],[['rl'],[91]],[['rl','gw','fb'],null]].map(([o,c])=>{ const b=deep(o,c,DEF); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,t:0,tp:0,tm:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="vulmar"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="vulmar"&&u.alive)) continue; __dr.ticks++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1)*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,{auto:true}):1);'+
    '    const kp=k*defMul(s,u,"phys"), km=k*defMul(s,u,"magic"); __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','vulmar'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+'; sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>20,'hits on him: '+d.n); assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more'); assert.equal(d.at,0);
    assert.ok(d.te85<0.25*Math.max(1,d.t),'at 85% or more for well under half of his time ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
