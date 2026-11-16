'use strict';
/* Veyr "The Manta-Born"'s talents as data on the mechanics layer (talents-mech/veyr.js), family by family on the still field
   (tests/talents-lab.js), then the caps, whole-fight determinism, the no-talent identity, and Phil's 95% ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured
   with his talents switched off for one hit (plainHit) or on a plain lab (plain).
   Lab conventions (measured while writing these tests):
   - The lab steps 0.0273 s a step: Drift takes +1 per 0.5 s MOVING (18-19 steps with him shifted a pixel a step, move1());
     standing, it fades 2 a second. The moved flag reads u.x!==u.px.
   - His green (Gravity Crescent) is a direct cast: it cuts and drags the NEAREST foe (F0 at 4.5 m), rooting it for the hand
     clip (3.33 s x 0.7 = 2.33 s). The blue (Abyssal Mantle) opens a 2.4 s evade window: a hit inside it is EVADED, pays
     Weightless (haste +0.08 x passMul 5 s capped 1.6, crit +0.05 x passMul capped 0.6) and is ANSWERED by the counter
     (AP x 2.0 x sm, magic). The ult (Abyssal Undertow) forms at its target: caught enemies drag in 1.2 x BATTLE_PACE s,
     then the collapse damages them (AP x 1.9) and slows them 2 s x 0.7.
   - The tide (Other Half) breathes OUT 4 s then IN 4 s from the wave start, forever; Two Hearts' blue flips it IN and its
     counter flips it OUT. Rising Breath / Dead Calm arm on every turn.
   - Stat rows (Spring Tide, Drunk on Air, Reckless Joy, the per-stack Giddy/Drift riders) rebuild on the talent tick:
     V.step(2) after the event before the reading.
   Lab foes are plain rank-0 Vaels (no abilities) - a test of the enemies' casts fabricates a press. Lab skill level 10.
   Run: node --test tests/talents-mech-veyr.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='veyr', S=ids=>full(H,ids), R=id=>T.talent(H,id).ranks, SM=VMX=>VMX('skillMul')(10);
const TEAM=['vael','sylthaine','vireo','vex','veyr'];
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const till=fn=>{ let i=0; for(;i<700;i++){ if(fn()) return i; V.step(1); } return i; };   // step one lab step at a time until fn() holds; returns the steps taken
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const dw=(L,t)=>L.T.s.api.ustGet(L.T,L.v,t,'vyDw');   // Deepwater is an enemy-side ustack
const st=L=>L.T.s.vy;
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; v.target=null; };
const free=L=>{ for(const f of L.F){ f.stunned=0; f.fearT=0; f.silencedT=0; f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.energyReg=0; } };
const freeA=L=>{ for(const a of L.A){ a.stunned=0; a.fearT=0; a.silencedT=0; a.level=1; a.ctrlRes=0; a.speed=0; a.atkCd=1e9; a.greenCd=1e9; a.blueCd=1e9; a.energy=0; a.energyReg=0; } };
const castGC=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castMantle=L=>V.cast(L.v,'blue');
const castUT=(L,t)=>V.cast(L.v,'ult',t||L.F[0]);
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on him (true damage unless said)
const foeHit=(L,t,amt,o)=>lost(t,()=>V.hit((o&&o.src)||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));
const allyHit=(L,a,t,amt,o)=>lost(t,()=>V.hit(a,t,amt||1000,Object.assign({kind:'true'},o||{})));
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const press=(L,t)=>{ t.__fired=0; t._pend={t:0.5,sm:1,lv:100,hero61Slot:'green',spell:true,fire:()=>{ t.__fired=1; }}; };   // an enemy presses a Green (level 100: its events land)
const move1=L=>{ const v=L.v; v.px=v.x; v.py=v.y; v.x+=2; FX.tick(v,V.STEP); };   // one lab step's talent tick with the moved flag true (2 px of travel; updateBattle would reset px)
const swingAt=(L,t)=>{ L.v.target=t; L.v.atkCd=0; L.v.stunned=0; const h=t.hp; till(()=>t.hp<h-1e-9||!t.alive); L.v.atkCd=1e9; };   // one basic attack (his mind free)
const dodgeOnce=L=>{ castMantle(L); V.hit(L.F[0],L.v,100,{kind:'true'}); };   // an evaded attack: a dodge for Weightless / Giddy

test('Veyr: every talent is accounted for - 124 talents, 7 plain stats, 117 with rows, none waiting; the cap sentences are in the texts',()=>{
  accounting(H,[124,7,117,0,0]);
  for(const id of ['tr_1_3','tr_6_4','oh_1_2','oh_4_1','oh_n2','tl_10_1','tl_n2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const names={}; for(const tr of T.trees(H)) for(const t of tr.talents){ assert.ok(!names[t[3]],'a name used twice: '+t[3]); names[t[3]]=1; }
  for(const id of ['tr_10_4','oh_11_1','oh_12_1','tr_n1','tl_n1']) assert.ok(/at most 70% off a hit/.test(T.talent(H,id).text),id+' states the 70% group cap');
  for(const id of ['tr_12_3','tl_1_3']) assert.ok(/at most 5% in total/.test(T.talent(H,id).text),id+' states the CRIT5 pool');
  assert.ok(/1\.2% per-second regeneration cap/.test(T.talent(H,'oh_5_4').text),'Tidal Pulse states the regen cap');
  for(const id of ['tr_11_3','tl_8_3']) assert.ok(/2% more damage per rank/.test(T.talent(H,id).text),id+' carries the corrected 2%/rank crit damage');
  assert.ok(/locks/.test(T.talent(H,'tr_5_2').text)&&/locks/.test(T.talent(H,'oh_5_2').text),'the PICK ONE locks are in the texts');
  assert.ok(FXN.mech(H).talents['tr_13_2']&&FXN.mech(H).talents['oh_13_2']&&FXN.mech(H).talents['tl_13_2'],'the three signatures have rows');
});

test('Veyr: his real kit, as the talents read it - the crescent (nearest, the drag, the root), the mantle (window, counter, Weightless pay), the Undertow (caught, collapse, slow)',()=>{
  plain({foes:3},P=>{ const {v,F}=P; go(P); free(P);
    const h=F.map(f=>f.hp); castGC(P); const d=F.map((f,i)=>h[i]-f.hp);
    assert.ok(d[0]>0,'the crescent cuts the nearest enemy'); assert.equal(d[1],0,'(not one 6 m behind it)');
    near(F[0].stunned,3.33*V.ccNerf,'and roots it for the hand clip (3.33 s x 0.7)',0.05); });
  plain({foes:2},P=>{ const {v,F}=P; go(P); free(P);
    castMantle(P); const h0=F[0].hp; V.hit(F[0],v,100,{kind:'true'});
    assert.ok(h0>F[0].hp,'the window spends on the hit: the counter answers (AP x 2.0 x sm, magic)');
    assert.ok((v.hasteT||0)>0&&(v.glyphCrit||0)>0,'and Weightless pays: haste + crit');
    near(v.hasteMul-1,0.08*(v.passMul||1),'the haste pay is +0.08 x passMul',0.005);
    const c0=v.glyphCrit; V.hit(F[0],v,100,{kind:'true'});
    near(v.glyphCrit,c0,'the window is spent: a second hit is taken normally (no second pay)',0.005); });
  plain({foes:3},P=>{ const {v,F}=P; go(P); free(P);
    const h=F.map(f=>f.hp); castUT(P,F[1]);
    assert.ok(v._horizon&&v._horizon.caught.length===3,'the Undertow catches every enemy in 7 m of its centre');
    till(()=>!v._horizon); const d=F.map((f,i)=>h[i]-f.hp);
    for(let i=0;i<3;i++) assert.ok(d[i]>0,'the collapse damages every caught enemy (AP x 1.9, magic)');
    near(F[0].slow,2,'and slows them 2 s',0.1); });
});

test('Veyr / Deepwater: a stack a drag (8 s + 0.6 a rank Kept Down), +1% a stack from him, at 5 the crush bursts and resets (Implosion spreads it, Deepwater Drunk feeds on it), Squeeze slows a stack',()=>{
  const L=lab(H,S(['tr_1_1','tr_11_1']),{foes:3}); go(L); free(L);
  castGC(L); assert.equal(dw(L,L.F[0]),1,'the crescent drags 1 Deepwater');
  const p0=plainHit(L,()=>myHit(L,L.F[0]));
  near(myHit(L,L.F[0]),p0*(1+0.01*R('tr_1_1')),'Down Where It Weighs: +1% x rank a stack',1e-9);
  secs(8.0); assert.equal(dw(L,L.F[0]),1,'Kept Down: it holds past the plain 8 s');
  secs(0.6*R('tr_11_1')+0.6); assert.equal(dw(L,L.F[0]),0,'and dies by 8 + 0.6 x rank');
  const M=lab(H,S(['tr_1_1','tr_3_1','tr_8_1','tr_9_1','tr_12_1']),{foes:3}); go(M); free(M);
  at(M,M.F[1],5.5,0);   // F1 1 m behind F0: inside Implosion's 2 m
  for(let i=0;i<4;i++) castGC(M); assert.equal(dw(M,M.F[0]),4,'4 stacks from 4 casts');
  const k=M.F[0].hp; castGC(M);   // the 5th: the crush
  const burst=(M.v.dmg||0)*0.15*R('tr_3_1')*(1+0.10*R('tr_8_1'));
  near(k-M.F[0].hp,burst,'The Crush: 15% x rank of his Attack, + Crush Depth 10% x rank',0.02*burst+1);
  assert.equal(dw(M,M.F[0]),0,'the crush resets the stacks');
  assert.equal(dw(M,M.F[1]),2,'Implosion: +2 Deepwater on the enemy within 2 m');
  assert.equal(stack(M,'vyDrunk'),1,'Deepwater Drunk: a crush is a stack');
  const B=lab(H,S(['tr_1_1','tr_2_1']),{foes:2}); go(B); free(B);
  castGC(B); secs(0.3); const f=B.F[0];
  near(f.slow,0.6,'Squeeze: the slow lasts its 0.6 s',0.1);
  near(f.slowMul,1-Math.min(0.9,0.02*R('tr_2_1')*1),'Squeeze: a slow of 2% x rank a stack',0.02);
});

test('Veyr / the Trench riders: The Bends, Heavy Enough, Undersea Calm, Abyssal Pull, Anchor Line, Soundings, the crescent upgrades (Long Crescent, Crescent Arc, Fin Blades, Hooked Cut, Barbed Crescent, Nowhere to Swim), Quick Fold',()=>{
  const L=lab(H,S(['tr_1_1','tr_6_1','tr_12_2','tr_11_3']),{foes:3}); go(L); free(L);
  for(let i=0;i<3;i++) castGC(L);   // F0 at 3 Deepwater
  const p0=plainHit(L,()=>myHit(L,L.F[0]));
  near(myHit(L,L.F[0]),p0*(1+0.03*R('tr_1_1'))*(1+0.02*R('tr_12_2')),'3 stacks: +3% (stacks) x +2% x rank (Heavy Enough at 3+)',0.02);
  V.step(2); const qF0=L.F[0].dmg, qF1=L.F[1].dmg;   // F0 at 3 Deepwater, F1 plain
  near(qF0,qF1*(1-0.02*R('tr_6_1')),'The Bends: its Attack is 2% x rank less at 3+ Deepwater',0.01);
  const U=lab(H,S(['tr_1_1','tr_11_3']),{foes:3}); go(U); free(U);
  for(let i=0;i<3;i++) castGC(U);   // F0 at 3 Deepwater
  const r0=plainHit(U,()=>{ const h=U.F[0].hp; V.hit(U.v,U.F[0],1000,{kind:'magic',crit:true}); return h-U.F[0].hp; });
  const r1=(()=>{ const h=U.F[0].hp; V.hit(U.v,U.F[0],1000,{kind:'magic',crit:true}); return h-U.F[0].hp; })();
  near(r1/r0,(1+0.01*R('tr_1_1')*3)*(1+0.02*R('tr_11_3')),'Undersea Calm: a crit vs Deepwater carries +2% x rank crit damage',0.02);
  /* Abyssal Pull ignores 2%/rank of the magic resist */
  const A=lab(H,S(['tr_9_3']),{foes:2}); go(A); free(A); const f=A.F[0]; f.mrRating=400;
  const a1=VMX('defMul')(A.v,f,'magic'); f.mrRating=400*(1-0.02*R('tr_9_3')); const a2=VMX('defMul')(A.v,f,'magic'); f.mrRating=400;
  const h0=f.hp; castGC(A); const d1=h0-f.hp;
  near(d1,1.5*A.v.apow*VMX('skillMul')(10)*a2,'Abyssal Pull: the crescent lands at the lighter resist',0.03*d1+1);
  /* Anchor Line / Soundings ride the rooted and the slowed */
  const N=lab(H,S(['tr_6_2','tr_7_1']),{foes:2}); go(N); free(N); const g=N.F[0];
  const n0=plainHit(N,()=>{ const h=g.hp; castGC(N); return h-g.hp; });
  const h1=g.hp; castGC(N); const nR=h1-g.hp;   // g is rooted (the drag)
  near(nR,n0*(1+0.02*R('tr_6_2')),'Anchor Line: +2% x rank on a rooted enemy',0.03);
  const h2=g.hp; g.slow=2; castGC(N); const nS=h2-g.hp;
  near(nS,n0*(1+0.02*R('tr_6_2'))*(1+0.02*R('tr_7_1')),'Soundings: +2% x rank more on a slowed one',0.04);
  /* the flat crescent upgrades stack on the cut */
  const C=lab(H,S(['tr_2_2','tl_8_2','oh_3_3']),{foes:2}); go(C); free(C);
  const c0=plainHit(C,()=>{ const h=C.F[0].hp; castGC(C); return h-C.F[0].hp; });
  const h3=C.F[0].hp; castGC(C); const c1=h3-C.F[0].hp;
  near(c1,c0*(1+0.03*R('tr_2_2'))*(1+0.03*R('tl_8_2')),'Long Crescent and Crescent Arc: +3% x rank each',0.03);
  const s0=plainHit(C,()=>{ const h=C.F[0].hp; swingAt(C,C.F[0]); return h-C.F[0].hp; });
  const s1=(()=>{ const h=C.F[0].hp; swingAt(C,C.F[0]); return h-C.F[0].hp; })();
  near(s1,s0*(1+0.02*R('oh_3_3')),'Fin Blades: his basic attacks hit 2% x rank harder',0.02);
  const K=lab(H,S(['tl_2_2']),{foes:2,big:true}); go(K); free(K);
  let base=1e18; for(let i=0;i<3;i++){ const h=K.F[0].hp; K.v.greenCd=0; plainHit(K,()=>castGC(K)); base=Math.min(base,h-K.F[0].hp); }
  let crits=0; for(let i=0;i<100;i++){ K.v.greenCd=0; const h=K.F[0].hp; castGC(K); const d=h-K.F[0].hp; if(d>1.45*base) crits++; }
  assert.ok(crits>=5&&crits<=40,'Hooked Cut: +3% x rank crit chance ('+crits+' crits of 100, plain base '+base.toFixed(1)+')');
  const D1=lab(H,S(['tl_2_2']),{foes:2,big:true}); go(D1); free(D1);
  const dCrit1=(()=>{ const h=D1.F[0].hp; D1.v.greenCd=0; castGC(D1); return h-D1.F[0].hp; })();
  const D2=lab(H,S(['tl_2_2','tl_4_2']),{foes:2,big:true}); go(D2); free(D2);
  const dCrit2=(()=>{ const h=D2.F[0].hp; D2.v.greenCd=0; castGC(D2); return h-D2.F[0].hp; })();
  near(dCrit2/dCrit1,1+0.05*R('tl_4_2'),'Barbed Crescent: the crescent\'s crits carry +5% x rank crit damage',0.02);
  const Q=lab(H,S(['tr_8_3']),{foes:2}); go(Q);
  assert.equal(FX.cd(Q.v,'green',7),7-0.1*R('tr_8_3'),'Quick Fold: the green 0.1 x rank shorter');
  const W=lab(H,S(['tr_10_2']),{foes:4}); go(W); free(W);
  at(W,W.F[0],2,0); at(W,W.F[1],2.5,0); at(W,W.F[2],50,0); at(W,W.F[3],60,0);   // 2 within 3 m of him, 2 far
  const w0=plainHit(W,()=>{ const h=W.F[0].hp; castGC(W); return h-W.F[0].hp; });
  const h5=W.F[0].hp; castGC(W); const w1=h5-W.F[0].hp;
  near(w1,w0*(1+0.01*R('tr_10_2')*2),'Nowhere to Swim: +1% x rank for each enemy within 3 m (2 here)',0.03);
});


test('Veyr / the tide: it breathes OUT 4 s then IN 4 s forever - Breathing Mantle, Slow Gills, Spring Tide, Rising Breath, Dead Calm, Ebb, Riptide Breath, Tidal Pulse, the blue cooldowns, Two Hearts',()=>{
  /* Breathing Mantle: damage reduction while IN, damage while OUT; Slow Gills rides the same breath (the tide turns on its own clock) */
  const L=lab(H,S(['oh_1_4','oh_8_3']),{foes:2}); go(L); free(L);
  near(hitOn(L,1000),1000,'OUT first: no Breathing Mantle DR',0.02);
  secs(4.05);
  assert.equal(st(L).tide,'in','the tide turned IN on its own clock');
  near(hitOn(L,1000),1000*(1-0.03*R('oh_1_4')-0.005*R('oh_8_3')),'IN: Breathing Mantle + Slow Gills take their share',0.02);
  const m0=plainHit(L,()=>myHit(L,L.F[0]));
  near(myHit(L,L.F[0]),m0,'IN: no OUT damage bonus',0.02);
  secs(4.2);
  assert.equal(st(L).tide,'out','and back OUT');
  near(myHit(L,L.F[0]),m0*(1+0.03*R('oh_1_4')),'OUT damage: he hits harder while breathing out',0.02);
  /* Spring Tide: +1%/rank Attack while OUT (stat: tick before the read) */
  const Q=lab(H,S(['oh_11_4','oh_11_2']),{foes:2}); go(Q); free(Q);
  castMantle(Q); V.step(2); const dIn=Q.v.dmg;
  dodgeOnce(Q); V.step(2);   // the counter turns it back OUT
  assert.equal(st(Q).tide,'out','the counter breathes it back OUT');
  near(Q.v.dmg,dIn*(1+0.01*R('oh_11_4')),'Spring Tide: +1% x rank Attack while OUT',0.01);
  /* Rising Breath: the first hit after the turn to OUT carries +5%/rank */
  const B=lab(H,S(['oh_7_4','oh_11_2']),{foes:2}); go(B); free(B);
  castMantle(B); dodgeOnce(B);   // IN, then OUT again with rb armed
  const p0=plainHit(B,()=>myHit(B,B.F[0]));
  near(myHit(B,B.F[0]),p0*(1+0.05*R('oh_7_4')),'Rising Breath: the first hit after the turn',0.02);
  near(myHit(B,B.F[0]),p0,'and the second is plain again',0.02);
  /* Dead Calm: the first hit after a turn heals him 1%/rank of max HP */
  const C=lab(H,S(['oh_12_4','oh_11_2']),{foes:2}); go(C); free(C);
  hitOn(C,1000); const hp0=C.v.hp;
  castMantle(C); dodgeOnce(C);   // the turn
  myHit(C,C.F[0]);
  near(C.v.hp-hp0,0.01*R('oh_12_4')*C.v.maxHp,'Dead Calm: the first hit after the turn heals',0.1);
  /* Ebb: the crescent crits more while OUT, not at all while IN */
  const E=lab(H,S(['oh_6_4','oh_11_2']),{foes:2,big:true}); go(E); free(E);
  let e0=1e18; for(let i=0;i<3;i++){ const h=E.F[0].hp; E.v.greenCd=0; plainHit(E,()=>castGC(E)); e0=Math.min(e0,h-E.F[0].hp); }   // the smallest plain hit: a plain roll, never a crit
  let outC=0; const outDs=[]; for(let i=0;i<200;i++){ E.v.greenCd=0; const h=E.F[0].hp; castGC(E); const d=h-E.F[0].hp; outDs.push(d.toFixed(0)); if(d>1.45*e0) outC++; }
  castMantle(E);   // IN
  let inC=0; for(let i=0;i<200;i++){ E.v.greenCd=0; const h=E.F[0].hp; castGC(E); if(h-E.F[0].hp>1.45*e0) inC++; }
  if(outC<5) console.log('EBB DEBUG e0='+e0.toFixed(1)+' tide='+st(E).tide+' ds:', outDs.slice(0,60).join(','));
  assert.ok(outC>=5,'Ebb: the crescent crits while OUT ('+outC+' of 200)');
  assert.ok(inC<=2,'Ebb: none of that while IN ('+inC+' of 200)');
  /* Riptide Breath: his hits while OUT give him energy */
  const I=lab(H,S(['oh_9_4']),{foes:2}); go(I); free(I);
  myHit(I,I.F[0]);
  near(I.v.energy,0.5*R('oh_9_4'),'Riptide Breath: +0.5 x rank energy a hit while OUT',0.01);
  /* Diving Breath: the breath is 4 + 0.2 x rank a side */
  const VV=lab(H,S(['oh_3_4']),{foes:2}); go(VV);
  near(st(VV).tideT,4+0.2*R('oh_3_4'),'Diving Breath: 4 + 0.2 x rank a side',0.01);
  /* Tidal Pulse: a regen-capped heal while IN (1.2% of max HP a second at most) */
  const TP=lab(H,S(['oh_5_4']),{foes:2}); go(TP); free(TP);
  hitOn(TP,2000);   // wounded, so the heal has room
  secs(4.2);   // the turn to IN
  assert.equal(st(TP).tide,'in','the tide turned IN on its own clock');
  till(()=>st(TP).tpT<0.03);   // a fresh one-second bucket just started
  const thp2=TP.v.hp;
  V.step(36); const healed=TP.v.hp-thp2;
  near(healed,Math.min(0.003*R('oh_5_4'),0.012)*TP.v.maxHp,'Tidal Pulse: the heal, capped at 1.2% a second',0.15);
  /* his blue cooldowns: 0.1 s/rank + Lets Him Hunt 2 s, floored at 5 */
  const CD=lab(H,S(['oh_8_2','tl_7_3','oh_5_3']),{foes:2}); go(CD);
  assert.equal(FX.cd(CD.v,'blue',9),Math.max(5,9-0.1*R('oh_8_2')-0.1*R('tl_7_3')-2*R('oh_5_3')),'Second Nature + Light as Water + Lets Him Hunt off the blue, 5 s floor');
});


test('Veyr / the mantle and its counter: Never Lets Go (the held window, the falling counter, the pick-one lock), Hungry Mantle, the counter riders, Folded Strike, the counter damage riders',()=>{
  /* Never Lets Go: the window holds, every attack in it is counted, the counter falls on all of them at the end */
  const counterBase=()=>{ const P0=lab(H,null,{foes:2,big:true}); const p=P0.v; p.stunned=0;p.speed=0;p.atkCd=1e9;p.greenCd=1e9;p.blueCd=1e9;p.energy=0;p.energyReg=0;p.target=null; P0.F[0].mrRating=0;
    V.cast(P0.v,'blue'); const h=P0.F[0].hp; V.hit(P0.F[0],P0.v,100,{kind:'true'}); return h-P0.F[0].hp; };
  const base=counterBase();   // before the L lab: a second lab steals the active arena
  const L=lab(H,S(['oh_5_2','oh_6_2']),{foes:3,big:true}); go(L); free(L);
  for(const f of L.F) f.mrRating=0;
  const h0=L.F.map(f=>f.hp);
  castMantle(L);
  for(let i=0;i<3;i++) V.hit(L.F[i],L.v,100,{kind:'true'});   // three attacks in the window, all evaded
  assert.deepEqual(L.F.map(f=>f.hp),h0,'no in-block counter: the window holds them all');
  till(()=>st(L).nlgFired);
  for(let i=0;i<3;i++){ const d=h0[i]-L.F[i].hp;
    assert.ok(d>=base*(1+0.05*3)*0.98&&d<=base*(1+0.05*3)*1.65,'Never Lets Go: the end-counter falls on attacker '+(i+1)+' at +5% an attack counted (a crit rides on top: '+d.toFixed(0)+' vs base '+base.toFixed(0)+')');
    near(L.F[i].slowMul,1-0.04*R('oh_6_2'),'Smothering: each collector is slowed',0.05); }
  const lockB={r:{}}; for(const t of T.trees(H)[1].talents) if(t[1]<=4) lockB.r[t[0]]=t[4]; lockB.r['oh_5_2']=1;
  assert.ok(T.whyNot(H,lockB,'oh_5_3',100).indexOf('Locked')>=0,'the PICK ONE lock: Never Lets Go locks Lets Him Hunt');
  /* Hungry Mantle: the window holds, every evade pays Weightless */
  const Hm=lab(H,S(['tl_11_2']),{foes:2}); go(Hm); free(Hm);
  castMantle(Hm); V.hit(Hm.F[0],Hm.v,100,{kind:'true'}); V.hit(Hm.F[0],Hm.v,100,{kind:'true'});
  near(Hm.v.glyphCrit,2*0.05*(Hm.v.passMul||1),'Hungry Mantle: both evades pay Weightless',0.01);
  /* Other Half: a stack a counter landed, the next counter rides it */
  const O=lab(H,S(['oh_12_2']),{foes:2}); go(O); free(O); O.F[0].mrRating=0;
  dodgeOnce(O);
  secs(2.6);   // the page's in-block counter guard clears once the window ends
  const d2=(()=>{ const h=O.F[0].hp; castMantle(O); V.hit(O.F[0],O.v,100,{kind:'true'}); return h-O.F[0].hp; })();
  const dBase=counterBase();
  assert.equal(stack(O,'vyCtr'),2,'Other Half: two counters landed, two stacks');
  near(d2,dBase*(1+0.005*R('oh_12_2')*1),'Other Half: the second counter rides the first stack',0.04);
  /* Clinging: 2 s of damage reduction after a counter */
  const Cg=lab(H,S(['oh_4_2']),{foes:2}); go(Cg); free(Cg);
  dodgeOnce(Cg);
  hitOn(Cg,600,{src:Cg.F[0]});   // burn The Fold's ready charge (it folds any hit above 8% maxHp) - not the talent under test
  const q0=plainHit(Cg,()=>hitOn(Cg,1000,{src:Cg.F[0]}));
  near(hitOn(Cg,1000,{src:Cg.F[0]}),q0*(1-0.10*R('oh_4_2')),'Clinging: 2 s of damage reduction after a counter',0.03);
  /* Sharp Return: haste after a counter (on top of the Weightless pay the same dodge owes) */
  const Sh=lab(H,S(['oh_6_3']),{foes:2}); go(Sh); free(Sh);
  const Hw=lab(H,null,{foes:2}); go(Hw); free(Hw);
  dodgeOnce(Hw); const w0=Hw.v.hasteMul-1;   // the Weightless pay alone
  dodgeOnce(Sh);
  near(Sh.v.hasteMul-1-w0,0.05*R('oh_6_3'),'Sharp Return: haste after a counter',0.02);
  assert.ok((Sh.v.hasteT||0)>0,'Sharp Return: it lasts');
  /* Mantle Hunger: a counter heals him 3%/rank of what it dealt */
  const Mh=lab(H,S(['oh_9_2']),{foes:2}); go(Mh); free(Mh); Mh.F[0].mrRating=0;
  hitOn(Mh,2000); const mhp=Mh.v.hp;
  const fmh0=Mh.F[0].hp;
  dodgeOnce(Mh);
  near(Mh.v.hp-mhp,0.03*R('oh_9_2')*(fmh0-Mh.F[0].hp),'Mantle Hunger: the counter heals him 3% x rank of what it dealt',0.1);
  /* Folded Strike: after a fold, the next basic also strikes as the counter at half */
  const Fs=lab(H,S(['oh_1_1','oh_3_1']),{foes:2}); go(Fs); free(Fs); Fs.F[0].mrRating=0;
  at(Fs,Fs.F[0],1.5,0);   // he is melee: the foe must be in reach of his basics
  hitOn(Fs,300);   // above the 8% line: the fold takes it
  assert.ok(st(Fs).folds>=1,'the fold happened');
  const s0=plainHit(Fs,()=>{ const h=Fs.F[0].hp; swingAt(Fs,Fs.F[0]); return h-Fs.F[0].hp; });
  const s1=(()=>{ const h=Fs.F[0].hp; swingAt(Fs,Fs.F[0]); return h-Fs.F[0].hp; })();
  near(s1-s0,Fs.v.apow*2*0.5,'Folded Strike: the extra counter strike at half strength',0.15);
  /* counter damage riders multiply (all while OUT) */
  const Tt=lab(H,S(['oh_2_3','tr_3_3','oh_10_4']),{foes:2}); go(Tt); free(Tt); Tt.F[0].mrRating=0;
  const t0=plainHit(Tt,()=>{ const h=Tt.F[0].hp; castMantle(Tt); V.hit(Tt.F[0],Tt.v,100,{kind:'true'}); return h-Tt.F[0].hp; });
  const t1=(()=>{ const h=Tt.F[0].hp; castMantle(Tt); V.hit(Tt.F[0],Tt.v,100,{kind:'true'}); return h-Tt.F[0].hp; })();
  near(t1,t0*(1+0.04*R('oh_2_3'))*(1+0.03*R('tr_3_3'))*(1+0.02*R('oh_10_4')),'Countercut x Mantle Edge x Turning Tide on the counter',0.05);
});


test('Veyr / Giddy: a dodge winds it (cap 8, Stay Steady 5, Let Go 12), Drunk on Air, Clear Skies, Cold Eye, Reckless Joy, Bored Now, Head in the Clouds, Sky Fall, Unburdened, Flick of the Tail, Glass Calm, Untethered',()=>{
  const Pl=lab(H,null,{foes:2});
  const G=lab(H,S(['tl_1_4']),{foes:2}); go(G); free(G);
  for(let i=0;i<9;i++) dodgeOnce(G);
  assert.equal(stack(G,'vyGiddy'),8,'Giddy caps at 8 by default (9 dodges)');
  const Ss=lab(H,S(['tl_5_2','tl_1_4','tl_6_2']),{foes:2}); go(Ss); free(Ss);
  for(let i=0;i<7;i++) dodgeOnce(Ss);
  assert.equal(stack(Ss,'vyGiddy'),5,'Stay Steady caps it at 5');
  V.step(2);
  near(Ss.v.glyphCrit,7*0.05*(Ss.v.passMul||1)+0.005*R('tl_6_2')*5,'Clear Skies: +0.5% x rank a stack (7 pays, 5 stacks)',0.02);
  assert.equal(Ss.v.armorRating,Pl.v.armorRating,'Stay Steady: no armor lost');
  const Lg=lab(H,S(['tl_5_3','tl_1_4']),{foes:2}); go(Lg); free(Lg);
  for(let i=0;i<13;i++) dodgeOnce(Lg);
  assert.equal(stack(Lg,'vyGiddy'),12,'Let Go raises the cap to 12');
  V.step(2);
  near(Lg.v.atkInterval,Pl.v.atkInterval/(1+0.005*R('tl_5_3')*12),'Let Go: +attack speed a stack',0.02);
  /* Drunk on Air: crit damage and the armor slip per stack */
  const D=lab(H,S(['tl_1_4']),{foes:2}); go(D); free(D);
  for(let i=0;i<4;i++) dodgeOnce(D);
  V.step(2);
  near(D.v.critDmg,0.6+0.02*R('tl_1_4')*4,'Drunk on Air: +2% x rank crit damage a stack',0.01);
  near(D.v.armorRating,Pl.v.armorRating*(1-0.005*R('tl_1_4')*4),'Drunk on Air: the armor slips',0.01);
  /* Cold Eye: +crit damage at 5+ */
  const Ce=lab(H,S(['tl_1_4','tl_8_3']),{foes:2}); go(Ce); free(Ce);
  for(let i=0;i<5;i++) dodgeOnce(Ce);
  V.step(2);
  near(Ce.v.critDmg,0.6+0.02*R('tl_1_4')*5+0.02*R('tl_8_3'),'Cold Eye: +2% x rank crit damage at 5+ Giddy',0.01);
  /* Reckless Joy: +attack a stack */
  const Rj=lab(H,S(['tl_1_4','tl_3_4']),{foes:2}); go(Rj); free(Rj);
  for(let i=0;i<4;i++) dodgeOnce(Rj);
  V.step(2);
  near(Rj.v.dmg,Pl.v.dmg*(1+0.002*R('tl_3_4')*4),'Reckless Joy: +0.2% x rank Attack a stack',0.01);
  /* Bored Now: +damage per 2 Giddy */
  const Bn=lab(H,S(['tl_1_4','tl_11_3']),{foes:2}); go(Bn); free(Bn);
  for(let i=0;i<4;i++) dodgeOnce(Bn);
  const b0=plainHit(Bn,()=>myHit(Bn,Bn.F[0]));
  near(myHit(Bn,Bn.F[0]),b0*(1+0.01*R('tl_11_3')*2),'Bored Now: +1% x rank per 2 Giddy (4 stacks)',0.02);
  /* Head in the Clouds: at full Giddy the next attack misses, once/8 s */
  const Hc=lab(H,S(['tl_1_4','tl_9_4']),{foes:2}); go(Hc); free(Hc);
  for(let i=0;i<8;i++) dodgeOnce(Hc);
  const h0=Hc.v.hp; hitOn(Hc,1000);
  assert.equal(Hc.v.hp,h0,'Head in the Clouds: the first attack at full Giddy misses');
  const took=hitOn(Hc,1000);
  assert.ok(took>0,'the 8 s lock spent, the second attack lands');
  /* Sky Fall: a dodge heals */
  const Sf=lab(H,S(['tl_12_4']),{foes:2}); go(Sf); free(Sf);
  hitOn(Sf,1000); const sf0=Sf.v.hp;
  dodgeOnce(Sf);
  near(Sf.v.hp-sf0,0.01*R('tl_12_4')*Sf.v.maxHp,'Sky Fall: a dodge heals 1% x rank of max HP',0.1);
  /* Unburdened: +attack a dodge this wave */
  const U=lab(H,S(['tl_1_4','tl_12_2']),{foes:2}); go(U); free(U);
  for(let i=0;i<3;i++) dodgeOnce(U);
  V.step(2);
  near(U.v.dmg,Pl.v.dmg*(1+0.003*R('tl_12_2')*3),'Unburdened: +0.3% x rank Attack a dodge',0.01);
  /* Flick of the Tail: the first strike after a dodge rides it - the evade's own counter is that strike */
  const fb=(()=>{ const P0=lab(H,null,{foes:2}); const p=P0.v; p.stunned=0;p.speed=0;p.atkCd=1e9;p.greenCd=1e9;p.blueCd=1e9;p.energy=0;p.energyReg=0;p.target=null; P0.F[0].mrRating=0;
    V.cast(P0.v,'blue'); const h=P0.F[0].hp; V.hit(P0.F[0],P0.v,100,{kind:'true'}); return h-P0.F[0].hp; })();
  const Fk=lab(H,S(['tl_1_4','tl_9_2']),{foes:2}); go(Fk); free(Fk); Fk.F[0].mrRating=0;
  const fd=(()=>{ const h=Fk.F[0].hp; dodgeOnce(Fk); return h-Fk.F[0].hp; })();
  near(fd,fb*(1+0.04*R('tl_9_2')),'Flick of the Tail: the counter right after the dodge rides it',0.05);
  assert.equal(st(Fk).flick,0,'the flick is spent by that strike');
  secs(2.6);   // the window (and the page's in-block counter guard) clears on the tick
  const fd2=(()=>{ const h=Fk.F[0].hp; dodgeOnce(Fk); return h-Fk.F[0].hp; })();
  near(fd2,fb*(1+0.04*R('tl_9_2')),'and the next dodge arms it again',0.05);
  /* Glass Calm: his first crit a wave carries +10% x rank */
  const Gl=lab(H,S(['tl_1_4','tl_12_3']),{foes:2}); go(Gl); free(Gl);
  const g0=plainHit(Gl,()=>{ const h=Gl.F[0].hp; V.hit(Gl.v,Gl.F[0],1000,{kind:'true',crit:true}); return h-Gl.F[0].hp; });
  const g1=(()=>{ const h=Gl.F[0].hp; V.hit(Gl.v,Gl.F[0],1000,{kind:'true',crit:true}); return h-Gl.F[0].hp; })();
  const g2=(()=>{ const h=Gl.F[0].hp; V.hit(Gl.v,Gl.F[0],1000,{kind:'true',crit:true}); return h-Gl.F[0].hp; })();
  near(g1/g0,1+0.10*R('tl_12_3'),'Glass Calm: the first crit of the wave',0.02);
  near(g2/g0,1,'the second crit is plain');
  /* Untethered: lifesteal a stack (needs Let Go) */
  const Ut=lab(H,S(['tl_5_3','tl_6_3','tl_1_4']),{foes:2}); go(Ut); free(Ut);
  for(let i=0;i<4;i++) dodgeOnce(Ut);
  V.step(2);
  near(Ut.v.lifestealStat,0.002*R('tl_6_3')*4,'Untethered: +0.2% x rank lifesteal a stack',0.01);
});


test('Veyr / Drift: +1 a 0.5 s moving, fades 2 a second standing (Current Memory slower), Long Glide caps it, Carried Along (a full-Drift basic crits and spends 5), Surface Run (3 m walked), Dragged in the Wake (10 Drift spends), Updraft (less while moving), Nothing Weighs',()=>{
  /* the meter: +1 per 0.5 s of moving (a move1 step is one lab step with the moved flag), standing it bleeds 2 a second */
  const D=lab(H,S(['tl_11_1']),{foes:2}); go(D); free(D);
  for(let i=0;i<37;i++) move1(D);
  near(stack(D,'vyDrift'),2,'37 moving steps (~1 s): 2 Drift',0.05);
  V.step(37);
  near(stack(D,'vyDrift'),0,'standing ~1 s: it bled away at 2 a second',0.05);
  /* Long Glide: the cap is 10 + 2 a rank (the build walks him ~2 px a step away: the foe is re-placed after) */
  const cap=A=>{ let m=0; while(stack(A,'vyDrift')<10+2*R('tl_11_1')&&m++<700) move1(A); at(A,A.F[0],1.5,0); };
  cap(D);
  const d0=stack(D,'vyDrift'); move1(D);
  assert.equal(stack(D,'vyDrift'),d0,'Long Glide: it holds the cap at 10 + 2 x rank ('+d0+')');
  /* Carried Along: a full-Drift basic is a guaranteed crit and spends 5 */
  const CA=lab(H,S(['tl_3_1','tl_11_1']),{foes:2}); go(CA); free(CA); CA.F[0].mrRating=0;
  cap(CA);
  const cBefore=stack(CA,'vyDrift');
  let c0=1e18; for(let i=0;i<3;i++){ c0=Math.min(c0,plainHit(CA,()=>{ const h=CA.F[0].hp; swingAt(CA,CA.F[0]); return h-CA.F[0].hp; })); }
  const c1=(()=>{ const h=CA.F[0].hp; swingAt(CA,CA.F[0]); return h-CA.F[0].hp; })();
  near(c1/c0,1.6,'Carried Along: the full-Drift basic crits (x 1.6 on the plain swing)',0.04);
  assert.ok(stack(CA,'vyDrift')<=cBefore-4&&stack(CA,'vyDrift')>=cBefore-8,'and it spends 5 (the swing bled some standing): '+stack(CA,'vyDrift')+' from '+cBefore);
  /* Surface Run: 3 m walked (2 px a step) arms the next basic +4% x rank */
  const SR=lab(H,S(['tl_7_1']),{foes:2}); go(SR); free(SR); SR.F[0].mrRating=0;
  for(let i=0;i<50;i++) move1(SR);
  at(SR,SR.F[0],1.5,0);   // he walked ~3 m: the foe goes back to his side
  assert.ok(st(SR).srD>=3,'50 moving steps walked the 3 m ('+st(SR).srD.toFixed(2)+')');
  const s0=plainHit(SR,()=>{ const h=SR.F[0].hp; swingAt(SR,SR.F[0]); return h-SR.F[0].hp; });
  const s1=(()=>{ const h=SR.F[0].hp; swingAt(SR,SR.F[0]); return h-SR.F[0].hp; })();
  near(s1,s0*(1+0.04*R('tl_7_1')),'Surface Run: the first hit after the walk rides it',0.05);
  const s2=(()=>{ const h=SR.F[0].hp; swingAt(SR,SR.F[0]); return h-SR.F[0].hp; })();
  near(s2,s0,'and the next is plain again (it spent)',0.06);
  /* Dragged in the Wake: at 10 Drift the crescent spends it all */
  const DW=lab(H,S(['tl_9_1']),{foes:2}); go(DW); free(DW);
  let m=0; while(stack(DW,'vyDrift')<10&&m++<500) move1(DW);
  assert.equal(stack(DW,'vyDrift'),10,'10 Drift built');
  at(DW,DW.F[0],4.5,0);
  castGC(DW);
  assert.equal(stack(DW,'vyDrift'),0,'Dragged in the Wake: the crescent spends the whole Drift');
  /* Updraft: less damage taken while he moves */
  const UP=lab(H,S(['tl_n1']),{foes:2}); go(UP); free(UP);
  move1(UP); const u1=hitOn(UP,1000);
  move1(UP); const u0=plainHit(UP,()=>hitOn(UP,1000));
  near(u1/u0,1-0.02*R('tl_n1'),'Updraft: 2% x rank off a hit while moving',0.03);
  /* Nothing Weighs: a slow on him is 6% x rank weaker (30% at most) - each lab read before the next steals the arena */
  const NWb=lab(H,S(['tl_10_4']),{foes:2}); go(NWb); free(NWb);
  NWb.v.slow=2; NWb.v.slowMul=0.5; V.step(2);
  const nb=1-NWb.v.slowMul;
  const NW0=lab(H,null,{foes:2}); go(NW0); free(NW0);
  NW0.v.slow=2; NW0.v.slowMul=0.5; V.step(2);
  const n0=1-NW0.v.slowMul;
  const weak=Math.min(0.30,0.06*R('tl_10_4'));
  near(nb,n0*(1-weak),'Nothing Weighs: the slow is '+Math.round(weak*100)+'% weaker',0.02);
});


test('Veyr / The Fold: a hit above 8% maxHp folds (one charge ready, 12 s a recharge, It Moves First faster, Twice Folded two), Fold Over lowers the line (5% floor), Wrapped Tight takes more, Quick to Wrap heals, Folded Under arms the crescent and sinks the attacker',()=>{
  /* the fold takes any hit above the line at half, spending the ready charge */
  const Fd=lab(H,S(['oh_2_1']),{foes:2}); go(Fd); free(Fd);
  const d1=hitOn(Fd,1000);
  near(d1,500,'a 1000 hit folds: half of it, the mantle keeps the rest',0.03);
  assert.equal(st(Fd).folds,1,'the fold is counted');
  const d2=hitOn(Fd,1000);
  near(d2,1000,'the charge is spent: the next hit lands whole',0.02);
  /* Fold Over: the line is 8% - 1% a rank, floored at 5% */
  const FO=lab(H,S(['oh_6_1']),{foes:2}); go(FO); free(FO);
  const line=Math.max(0.05,0.08-0.01*R('oh_6_1'))*FO.v.maxHp;
  const fLo=hitOn(FO,Math.round(line*0.9));
  near(fLo,Math.round(line*0.9),'below the line: no fold',0.02);
  const fHi=hitOn(FO,Math.round(line*1.1));
  near(fHi,Math.round(line*1.1)*0.5,'above the line: folded ('+(100*Math.max(0.05,0.08-0.01*R('oh_6_1'))).toFixed(1)+'% of max HP here)',0.03);
  /* Wrapped Tight: the fold takes 5% x rank more off */
  const WT=lab(H,S(['oh_8_1']),{foes:2}); go(WT); free(WT);
  const w1=hitOn(WT,1000);
  near(w1,1000*(1-0.5-0.05*R('oh_8_1')),'Wrapped Tight: the fold takes '+(50+5*R('oh_8_1'))+'% of the hit',0.03);
  /* Quick to Wrap: the fold heals him 1% x rank of max HP */
  const QW=lab(H,S(['oh_2_1']),{foes:2}); go(QW); free(QW);
  hitOn(QW,100); const qh=QW.v.hp;   // a small wound (below the line)
  hitOn(QW,1000);   // the fold
  near(QW.v.hp-qh,-500+0.01*R('oh_2_1')*QW.v.maxHp,'Quick to Wrap: the fold heals 1% x rank of max HP (net of the 500 it absorbed)',0.1);
  /* Folded Under (LINK): the fold arms the next crescent +6% x rank and sinks its attacker 2 Deepwater */
  const FU=lab(H,S(['oh_n1','tr_1_1']),{foes:2}); go(FU); free(FU); FU.F[0].mrRating=0;
  at(FU,FU.F[0],4.5,0);
  const g0=plainHit(FU,()=>{ const h=FU.F[0].hp; castGC(FU); return h-FU.F[0].hp; });   // the plain crescent, no Deepwater yet
  hitOn(FU,600);
  assert.equal(st(FU).folds,1,'the fold happened');
  assert.equal(dw(FU,FU.F[0]),2,'Folded Under: its attacker sinks 2 Deepwater (the Trench LINK)');
  const g1=(()=>{ const h=FU.F[0].hp; castGC(FU); return h-FU.F[0].hp; })();
  near(g1,g0*(1+0.06*R('oh_n1'))*(1+0.01*R('tr_1_1')*2),'Folded Under: the armed crescent rides +6% x rank (on top of the 2 stacks it owes the sink)',0.04);
  const g2=(()=>{ const h=FU.F[0].hp; castGC(FU); return h-FU.F[0].hp; })();
  near(g2,g0*(1+0.01*R('tr_1_1')*3),'and the arm is spent: the next crescent is the plain kit at 3 stacks',0.05);
  /* Twice Folded: two charges */
  const TF=lab(H,S(['oh_9_1']),{foes:2}); go(TF); free(TF);
  const t1=hitOn(TF,1000), t2=hitOn(TF,1000), t3=hitOn(TF,1000);
  near(t1,500,'first charge folds',0.03); near(t2,500,'Twice Folded: the second charge folds too',0.03); near(t3,1000,'then they are spent',0.02);
  /* the recharge: 12 s, It Moves First shaves 0.4 s a rank (Fold Over, not Quick to Wrap: the fold's heal would pollute the read) */
  const IM=lab(H,S(['oh_6_1','oh_1_1']),{foes:2}); go(IM); free(IM);
  hitOn(IM,1000);   // spend the charge
  const rc=Math.max(2,12-0.4*R('oh_1_1'));
  const steps=till(()=>st(IM).foldC>=1);
  near(steps*V.STEP,rc,'the charge is back in 12 - 0.4 x rank ('+rc.toFixed(1)+' s, It Moves First)',0.12);
  const d4=hitOn(IM,1000);
  near(d4,500,'and it folds again',0.03);
});


test('Veyr / Hush: the Undertow collapse hushes (Deep Silence 4 + 0.4 a rank), Unspoken (less from a hushed attacker), Hush Falls (his team hits hushed harder), No Sound (the hushed caster\'s next skill hits softer), Mute Water (no energy from hits), Sealing Water (heals on them weaker), Muffled (their attack speed)',()=>{
  const hush=(L,t,d)=>{ t._talM=t._talM||{}; const o=t._talM[L.v.uid]=t._talM[L.v.uid]||{}; o['vyHush']={v:1,until:V.now()+(d||9)}; };
  /* the collapse hushes the caught: Deep Silence stretches the mark */
  const DS=lab(H,S(['tr_1_4','tr_5_4']),{foes:2}); go(DS); free(DS);
  castUT(DS); till(()=>!DS.v._horizon);
  const mk=DS.F[0]._talM&&DS.F[0]._talM[DS.v.uid]&&DS.F[0]._talM[DS.v.uid]['vyHush'];
  assert.ok(mk,'the caught enemy carries Hush after the collapse');
  near(mk.until-V.now(),4+0.4*R('tr_5_4'),'Deep Silence: the mark holds 4 + 0.4 x rank',0.1);
  /* Unspoken: 2% x rank less from a hushed attacker */
  const UN=lab(H,S(['tr_10_4']),{foes:2}); go(UN); free(UN);
  const u0=hitOn(UN,1000);
  hush(UN,UN.F[0]);
  const u1=hitOn(UN,1000,{src:UN.F[0]});
  near(u1/u0,1-0.02*R('tr_10_4'),'Unspoken: a hushed attacker hits 2% x rank softer',0.03);
  /* Hush Falls: his whole team\'s hits on hushed enemies +3% x rank */
  const HF=lab(H,S(['tr_7_4']),{foes:2,allies:1}); go(HF); free(HF);
  const a=HF.A[0];
  const h0=foeHit(HF,HF.F[1],1000);
  hush(HF,HF.F[1]);
  const h1=foeHit(HF,HF.F[1],1000,{src:a});
  near(h1/h0,1+0.03*R('tr_7_4'),'Hush Falls: an ally\'s hit on a hushed enemy rides +3% x rank',0.03);
  /* No Sound: the next skill a hushed enemy casts carries the mark - its hits 6% x rank softer, the hush spent */
  const NS=lab(H,S(['tr_1_4']),{foes:2,allies:1}); go(NS); free(NS);
  const na=NS.A[0];
  const n0=foeHit(NS,na,1000,{src:NS.F[0]});
  hush(NS,NS.F[0]);
  VMX('TalentFx.teamCast')(NS.F[0],'green',{});
  assert.ok(!mark(NS,NS.F[0],'vyHush')||NS.F[0]._talM[NS.v.uid]['vyHush'].until<=V.now(),'No Sound: the hush is spent by the cast');
  assert.ok(mark(NS,NS.F[0],'vyNs'),'and the cast carries the No Sound mark');
  const n1=foeHit(NS,na,1000,{src:NS.F[0]});
  near(n1/n0,1-0.06*R('tr_1_4'),'No Sound: its hits deal 6% x rank less while the mark lives',0.03);
  /* Mute Water: a hushed enemy gains no energy from taking hits */
  const MW=lab(H,S(['tr_9_4']),{foes:2}); go(MW); free(MW);
  hush(MW,MW.F[0]);
  const me0=MW.F[0].energy;
  V.hit(MW.v,MW.F[0],500,{kind:'true'});
  near(MW.F[0].energy-me0,0,'Mute Water: the hushed one gains nothing from the hit',0.01);
  const MW0=lab(H,null,{foes:2}); go(MW0); free(MW0);
  const me1=MW0.F[0].energy;
  V.hit(MW0.v,MW0.F[0],500,{kind:'true'});
  assert.ok(MW0.F[0].energy-me1>0,'(untalented: the hit does pay energy)');
  /* Sealing Water: heals on a hushed unit are 5% x rank weaker */
  const SW=lab(H,S(['tr_12_4']),{foes:2}); go(SW); free(SW);
  V.hit(SW.v,SW.F[0],5000,{kind:'true'});   // wound it so the heal has room
  hush(SW,SW.F[0]);
  const w0=SW.F[0].hp; V.heal(SW.F[0],1000);
  near(SW.F[0].hp-w0,1000*(1-0.05*R('tr_12_4')),'Sealing Water: a heal on the hushed lands 5% x rank short',0.03);
  /* Muffled: a hushed enemy's attack speed 1% x rank down (a haste penalty in the tick) */
  const MF=lab(H,S(['tr_3_4']),{foes:2}); go(MF); free(MF);
  hush(MF,MF.F[0]); V.step(2);
  near(MF.F[0].hasteMul,Math.max(0.05,1-0.01*R('tr_3_4')),'Muffled: the hushed attack slower',0.02);
  assert.ok((MF.F[0].hasteT||0)>0,'and the penalty keeps its time');
});


test('Veyr / his damage-reduction group: ONE capped product (70% off a hit at most, kept share floored at 0.30) - Breathing Mantle + Slow Gills + Clinging + Tough Love + Pressure Wise + Unspoken + Swaddled + Updraft + Mother\'s Patience multiply; the Fold halves inside the floor',()=>{
  const hush=(L,t,d)=>{ t._talM=t._talM||{}; const o=t._talM[L.v.uid]=t._talM[L.v.uid]||{}; o['vyHush']={v:1,until:V.now()+(d||9)}; };
  const D=lab(H,S(['oh_1_4','oh_8_3','oh_4_2','oh_7_1','tr_n1','tr_10_4','oh_12_1','tl_n1','oh_11_1']),{foes:2,big:true}); go(D); free(D);
  at(D,D.F[0],1.5,0);
  /* every condition true at once: breathing in, a fresh counter's cling, the attacker near / slowed / hushed, the wave's first
     4 s, him moving, 6 folds counted - and no fold charge, so the product stands alone */
  const s=st(D);
  s.tide='in'; s.cling=2; s.swad=4; s.folds=6; s.foldC=0;
  D.F[0].slow=2;
  hush(D,D.F[0]);
  const k=(1-0.03*R('oh_1_4')-0.005*R('oh_8_3'))*(1-0.10*R('oh_4_2'))*(1-0.01*R('oh_7_1'))
         *(1-0.02*R('tr_n1'))*(1-0.02*R('tr_10_4'))*(1-0.03*R('oh_12_1'))*(1-0.02*R('tl_n1'))
         *(1-Math.min(0.06,0.005*R('oh_11_1')*6));
  move1(D);   // Updraft: he is moving
  const d1=hitOn(D,1000);
  assert.ok(k>0.30,'(the stacked product alone stays above the floor: '+(k*100).toFixed(1)+'%)');
  near(d1/1000,k,'the whole group multiplies on one hit: '+(k*100).toFixed(1)+'% kept',0.03);
  /* the Fold rides INSIDE the product: halving it would break the floor, so the kept share stops at 0.30 */
  assert.ok(k*0.5<0.30,'(with the fold halving it the product would sink below the floor)');
  s.foldC=1;
  const d2=hitOn(D,1e8);
  near(d2/1e8,0.30,'a hit the fold takes: still exactly the 0.30 floor, not less',0.02);
  /* Salt Scar: a critical hit against him is 2% x rank softer */
  const SS=lab(H,S(['oh_12_3']),{foes:2}); go(SS); free(SS);
  const c0=plainHit(SS,()=>hitOn(SS,1000,{crit:true}));
  const c1=hitOn(SS,1000,{crit:true});
  near(c1/c0,1-0.02*R('oh_12_3'),'Salt Scar: 2% x rank off a crit',0.03);
  /* High Air: a ranged attacker (beyond a melee reach) is 2% x rank softer */
  const HA=lab(H,S(['tl_6_4']),{foes:2}); go(HA); free(HA);
  HA.F[0].range=230;
  const h1=hitOn(HA,1000);
  HA.F[0].range=60;
  const h0=plainHit(HA,()=>hitOn(HA,1000));
  near(h1/h0,1-0.02*R('tl_6_4'),'High Air: 2% x rank off a ranged attacker',0.03);
});


test('Veyr / the signatures: The Trench Comes Up (the collapse arms 4 s of +15%, locked 20 s), It Never Let Go (below 30% HP: the blow and 2 s of attacks miss, the tide breathes out, a counter falls on every swinger), Nothing Up Here Weighs Anything (full Drift: 4 s un-targetable while he moves, aimed attacks forced-dodged and answered, locked 20 s)',()=>{
  /* sig 1: the collapse arms the window; his hits ride +15%; the lock keeps it once a wave-fight long */
  const S1=lab(H,S(['tr_1_1','tr_1_4','tr_13_2']),{foes:2,big:true}); go(S1); free(S1); S1.F[0].mrRating=0;
  castUT(S1); till(()=>!S1.v._horizon);
  assert.ok(st(S1).s1>3,'The Trench Comes Up: the collapse arms the window ('+st(S1).s1.toFixed(1)+' s)');
  assert.ok(mark(S1,S1.F[0],'vyHush'),'and the caught are hushed again');
  const p0=plainHit(S1,()=>myHit(S1,S1.F[0]));
  const p1=myHit(S1,S1.F[0]);
  near(p1,p0*1.15,'his hits ride +15% while it holds',0.03);
  secs(4.3);
  assert.ok(st(S1).s1<=0,'the window ends');
  castUT(S1); till(()=>!S1.v._horizon);
  assert.ok(st(S1).s1<=0,'the 20 s lock: a second collapse does not re-arm it');
  /* sig 2: the fold-away below 30% HP */
  const S2=lab(H,S(['oh_13_2']),{foes:2}); go(S2); free(S2); S2.F[0].mrRating=0;
  hitOn(S2,1900);   // 1185 left: one small blow from the line
  const b0=S2.v.hp; hitOn(S2,300);
  assert.equal(S2.v.hp,b0,'It Never Let Go: the blow that would drop him below 30% misses entirely');
  assert.equal(st(S2).tide,'out','and the tide is breathed out');
  const m0=S2.v.hp; hitOn(S2,500);
  assert.equal(S2.v.hp,m0,'the 2 s of forced misses hold the next ones too');
  const f0=S2.F[0].hp;
  secs(2.2);   // the window ends: the counter falls on everyone that swung
  assert.ok(S2.F[0].hp<f0,'at its end the counter answers every collector ('+(f0-S2.F[0].hp).toFixed(0)+')');
  const l0=S2.v.hp; hitOn(S2,400);   // 885 - 400: below 30%, but the lock is spent
  near(l0-S2.v.hp,400,'the 20 s lock spent: a later low blow lands normally',0.02);
  /* sig 3: full Drift - he weighs nothing */
  const S3=lab(H,S(['tl_13_2','tl_11_1']),{foes:2}); go(S3); free(S3); S3.F[0].mrRating=0;
  let m=0; while(stack(S3,'vyDrift')<10+2*R('tl_11_1')&&m++<700) move1(S3);   // full Drift: the cap itself (Long Glide)
  assert.ok(st(S3).s3>3,'Nothing Up Here Weighs Anything: full Drift opens the window ('+st(S3).s3.toFixed(1)+' s)');
  at(S3,S3.F[0],1.5,0);   // the build walked him far: the crescent answers the NEAREST enemy
  move1(S3);
  assert.ok(mark(S3,S3.F[0],'vyG'),'while he moves his enemies cannot pick him (the hideFrom mark)');
  const g0=S3.F[0].hp; const taken=hitOn(S3,1000,{kind:'magic'});   // a true hit never rolls dodge: this needs a real kind
  assert.equal(taken,0,'an attack aimed at him is a forced dodge');
  assert.ok(S3.F[0].hp<g0,'and it is answered by the signature crescent ('+(g0-S3.F[0].hp).toFixed(0)+')');
  secs(5);   // he stands five seconds: the window ends (4 s), the marks drop, the dodges stop (V.step(5) would be just 5 ticks)
  assert.ok(!mark(S3,S3.F[0],'vyG'),'standing: the mark is gone');
  const mg0=plainHit(S3,()=>hitOn(S3,1000,{kind:'magic'}));
  near(hitOn(S3,1000,{kind:'magic'}),mg0,'and aimed attacks land again',0.02);
  let m2=0; while(stack(S3,'vyDrift')<10+2*R('tl_11_1')&&m2++<700) move1(S3);
  assert.ok(st(S3).s3<=0,'the 20 s lock: a second full Drift does not reopen it');
});

test('Veyr: whole fights are deterministic with any build, and with no talents he plays exactly his plain kit',()=>{
  determinism(H,TEAM);
  const B=lab(H,S(['tr_2_2','tl_8_2','oh_3_3']),{foes:2,big:true}); go(B); free(B);
  B.F[0].mrRating=0;
  const h0=B.F[0].hp;
  const dP=plainHit(B,()=>{ const a=B.F[0].hp; castGC(B); return a-B.F[0].hp; });   // the same field, his talents off
  const h1=B.F[0].hp;
  castGC(B);   // the talented pass
  const dT=h1-B.F[0].hp;
  near(dT,dP*(1+0.03*R('tr_2_2'))*(1+0.03*R('tl_8_2')),'with the damage talents on, the crescent rides the two Gravity Crescent rows alone (Fin Blades does not touch it)',0.02);
  const aP=plainHit(B,()=>{ const a=B.F[0].hp; swingAt(B,B.F[0]); return a-B.F[0].hp; });
  const h2=B.F[0].hp;
  swingAt(B,B.F[0]);
  near(h2-B.F[0].hp,aP*(1+0.02*R('oh_3_3')),'and the basic attack rides Fin Blades alone',0.03);
  plain({foes:2},P=>{ const {v,F}=P; go(P); free(P);
    castGC(P); castGC(P); V.hit(F[0],v,100,{kind:'magic'});
    assert.equal(P.T?dw(P,F[0]):0,0,'untalented, no Deepwater stacks');
    assert.equal(P.T?stack(P,'vyDrift'):0,0,'untalented, no Drift');
    assert.ok(!P.T||st(P).folds===0,'untalented, no folds counted'); });
});

/* Phil, 15 Nov: nobody ever above 95% damage reduction. Veyr's reductions are ONE capped group on him (70% off a hit at
   most, the kept share floored at 0.30, the Fold halving inside the floor). The most defensive legal build is checked at
   its worst possible moment - every DR talent's condition true at once, the fold charge spent - physical and magic, with
   and without the 30% glyph damage reduction. */
const DEF={ tr:['tr_10_4','tr_n1'], oh:['oh_1_4','oh_8_3','oh_4_2','oh_7_1','oh_11_1','oh_12_1','oh_12_3','oh_1_1','oh_8_1'], tl:['tl_n1','tl_6_4'] };
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={tr:0,oh:1,tl:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
function lab100(list){ const al=[Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)));
  const U=V.arena(snaps(al),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.ctrlHitF=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,0][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; });
  V.step(1); return {v,F,T:v._tal}; }
test('Veyr: his most defensive legal 91-point build never keeps him under the 0.30 floor (70% off a hit at most), even with glyphs, and the talents plainly reduce',()=>{
  const cands=[[['tr','oh'],[61,30]],[['tr','tl'],[61,30]],[['oh','tr'],[61,30]],[['oh','tl'],[61,30]],[['tl','tr'],[61,30]],[['tl','oh'],[61,30]],[['tr'],[91]],[['oh'],[91]],[['tl'],[91]],[['tr','oh','tl'],null]]
    .map(([o,c])=>{ const b=deep(o,c,DEF); const bad=T.invalid(H,b,100); assert.equal(bad,'','a legal build: '+bad); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=Math.max(worstHit(c.list,0,'magic'),worstHit(c.list,0,'phys')); c.worstG=Math.max(worstHit(c.list,0.30,'magic'),worstHit(c.list,0.30,'phys')); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(worstHit(null,0,'magic'),worstHit(null,0,'phys')), noneG=Math.max(worstHit(null,0.30,'magic'),worstHit(null,0.30,'phys'));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with glyphs)').join(' | '));
  assert.ok(best.worst>none+0.03,'(the talents do reduce it: '+(best.worst*100).toFixed(1)+'% against '+(none*100).toFixed(1)+'% with none)');
  near(best.worst,0.70,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') stops at the floor: exactly 70% off, never more',0.03);
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% off (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
});
/* the worst hit on him: every condition of his damage-reduction talents true at once - the tide is in, a fresh counter's
   cling rides, Swaddled's folds are counted, the wave's first 4 s hold, he is moving, the attacker is near / slowed /
   hushed / ranged - and the fold charge is spent, so the product halves INSIDE the 0.30 floor. No crit: a crit's damage
   bonus would dwarf Salt Scar's 4% cut and only hurt him more (Salt Scar itself is measured in the DRG test above);
   physical and magic; and again with glyph damage reduction at its 30% cap. */
function worstHit(list,glyph,kind){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=v.maxHp; v.shield=0; v.glyphDR=glyph||0; v.mrRating=0; v.armorRating=0; f.mrRating=0; f.armorRating=0;
  f.x=v.x+1.5*V.METER; f.y=v.y;   // Tough Love: a near enemy
  if(L.T){ const W=st(L);
    W.tide='in'; W.cling=2; W.swad=4; W.folds=6; W.foldC=1;
    f.slow=2; f.range=230;
    f._talM=f._talM||{}; const o=f._talM[v.uid]=f._talM[v.uid]||{}; o['vyHush']={v:1,until:V.now()+9};
    v.px=v.x-2;   // he is moving (Updraft rides)
    FX.tick(v,V.STEP);   // the tide's own countdown runs: make sure it stays 'in' on the hit
  }
  const raw=2.5e6, h0=v.hp; V.hit(f,v,raw,{kind:kind==='phys'?'phys':'magic'}); const x=h0-v.hp;
  return 1-x/(raw*VMX('elemMul')(f,v)); }
