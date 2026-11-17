'use strict';
/* Hobb Kilnmask's talents as data on the mechanics layer (talents-mech/hobb.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity with him in the line-up, and Phil's 95% damage-reduction ceiling (worst hit, sustained, the share of a fight at 85% or more).
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Hobb, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5).
   Lab units are HELD (stunned 1e6), Hobb too; go() lets him think with nothing ready. Lab skill level 10. Run: node --test tests/talents-mech-hobb.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='hobb', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const setWin=(L,name,t)=>{ L.T.s.w[name]={t:t==null?99:t,n:1,cdT:0,at:-1,wave:false}; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const beside=(a,b,gap,dir)=>{ const d=(V.bodyR(a)+V.bodyR(b)+gap)*V.METER; b.x=a.x; b.y=a.y+(dir||1)*d; };   // b set down `gap` metres from a, body to body, along y
const noDef=L=>{ for(const f of L.F){ f.mrRating=0; f.armorRating=0; } };
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on him (true damage unless said)
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));                               // his hit on t
const autoOn=(L,t,n)=>{ for(let i=0;i<(n||1);i++) V.hit(L.v,t,10,{kind:'true',auto:true}); };
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; };
const setMk=(L,t,name,dur)=>{ const m=t._talM||(t._talM={}), o=m[L.v.uid]||(m[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const ustOf=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n)=>{ const m=t._talM||(t._talM={}), o=m[L.v.uid]||(m[L.v.uid]={}); o['#'+name]={v:n,until:Infinity}; };
const auOf=(L,x)=>L.T.s.au.find(e=>e.x===x);
const castGZ=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castSV=L=>V.cast(L.v,'blue',L.v);
const castKS=(L,t)=>V.cast(L.v,'ult',t||L.F[0]);
const free=L=>{ for(const f of L.F){ f.stunned=0; f.fearT=0; f.level=1; } };     // foes that can be stunned now (a skill's control always lands on level 1)
const hold=L=>{ for(const f of L.F){ f.stunned=1e6; f.fearT=0; } };
const gzPlain=(L,t)=>plainHit(L,()=>{ const h=t.hp; castGZ(L,t); return h-t.hp; });
const gzHit=(L,t)=>{ const h=t.hp; castGZ(L,t); return h-t.hp; };
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };
const api=L=>L.T.s.api;
const clk=L=>{ for(const r of (L.T.on.tick||[])) if(r.period&&L.T.s.lim[r.key]) L.T.s.lim[r.key].acc=0; };   // a once-a-second row's clock back to 0
const dotOf=(L,t,tag)=>(t.dots||[]).find(d=>d._talO===L.v.uid&&d._talK===tag&&d.remaining>0);

test('Hobb: every talent is accounted for - 12 plain stats, 105 with rows, none waiting',()=>{
  accounting(H,[117,12,105,0,0]);
  const M=FXN.mech(H); for(const id of ['rf_1_1','ct_1_3','ow_1_4','rf_13_2','ct_13_3','ow_13_3']) assert.ok(M.talents[id],id);
  for(const id of ['rf_8_1','rf_6_2','rf_7_1','rf_1_3','ct_1_1','ct_5_4','ct_9_2','ct_12_2','ow_8_4','ow_12_2','ow_8_3','ow_1_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.equal(T.talent(H,'ct_7_2').name,'Eye on the Shelf','no other game\'s name');
});

test('Hobb: his real kit, as the talents read it - Glazebreaker\'s cut, Sealed Vessel\'s slot, Fired Clay\'s clock, Grand Kiln Shape\'s stun and fear',()=>{
  plain({foes:4,big:true},P=>{ const {v,F}=P; noDef(P);
    const h=F[0].hp; castGZ(P,F[0]); assert.ok(h-F[0].hp>0,'Glazebreaker strikes its target'); near(F[0]._shredT,5,'its armour cut lasts 5 s'); near(F[0]._shredPct,VMX('shredAt(0.30,skillMul(10))'),'30% through the game\'s shred scale');
    castSV(P); near(v.drMul,VMX('skLvNum')('defensive',VMX('KITS.hobb.blue'),10),'Sealed Vessel: his one skill slot, 0.45 - 0.0005 a level'); near(v.drT,5,'for 5 s');
    assert.ok(v.pass&&v.pass.warden,'Fired Clay is the warden passive'); v.wardenStk=0; v.wardenT=0; secs(2.9); assert.equal(v.wardenStk|0,0,'(2.9 s: none)'); secs(0.2); assert.equal(v.wardenStk,1,'a stack every 3 s, hit or not');
    v.wardenStk=5; near(VMX('wardenCut')(v),Math.min(VMX('(u=>SKLV.wardenCap(passLv(u)))')(v),0.04*(v.passMul||1)*5),'each 4% x his passive\'s strength less damage taken, up to its cap');
    at(P,F[1],7.5,0); at(P,F[2],4.5,4.2); at(P,F[3],0,4); free(P); const hs=F.map(f=>f.hp); castKS(P,F[0]);
    assert.ok(hs[0]-F[0].hp>0&&hs[1]-F[1].hp>0,'Grand Kiln Shape strikes every enemy within 4.26 m of his target'); assert.ok(hs[3]===F[3].hp,'not one 6 m from it');
    near(F[0].stunned,1.4,'stunned 1.4 s (the area table 2.0 s x 0.7)',1e-9); near(F[1].stunned,1.4,'',1e-9); near(F[3].stunned,0,'');
    near(F[3].fearT,0,'no fear'); near(F[0]._airT||0,0,'no knock-up'); assert.ok(!F[0].pulledBy||!(F[0].pullT>0),'and no push: the card text knocks the frontline backward, the code does not'); hold(P); });
});

/* ============================== RINGS FALSE ============================== */
test('Hobb / Ring False: Tap and Listen, Quick Ear, Brittle, Weak Seam, Listen Again; Found the Place',()=>{
  const L=lab(H,S(['rf_1_1','rf_2_1','rf_5_4','rf_6_4','rf_9_1']),{foes:3,big:true}), {v,F}=L;
  autoOn(L,F[0],2); assert.ok(!mark(L,F[0],'rf'),'two basic attacks: not yet'); autoOn(L,F[1],1); assert.ok(!mark(L,F[1],'rf'),'(one on another enemy)');
  autoOn(L,F[0],1); const t0=V.now(); assert.ok(mark(L,F[0],'rf'),'his 3rd basic attack on the same enemy: it Rings False');
  near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0]))*1.10,'Tap and Listen: 2% x 5 more to it'); near(myHit(L,F[1]),plainHit(L,()=>myHit(L,F[1])),'not another');
  V.step(2); const e=auOf(L,F[0]); near(e&&e.ap.move,0.90,'Brittle: 2% x 5 slower'); near(e&&e.ap.atk,0.94,'Weak Seam: 3% x 2 less attack'); near(e&&e.ap.apow,0.94,'and ability power');
  secs(7.7-(V.now()-t0)); assert.ok(mark(L,F[0],'rf'),'Quick Ear: 5 + 1 x 3 s'); secs(0.6); assert.ok(!mark(L,F[0],'rf'),'then not'); V.step(2); const e2=auOf(L,F[0]); assert.ok(!e2||!e2.ap.move||e2.ap.move===1,'Brittle ends with it');
  autoOn(L,F[0],3); assert.ok(mark(L,F[0],'rf'),'again'); kill(L,F[0]); assert.ok(mark(L,F[1],'rf'),'Listen Again: the nearest enemy to the fallen one Rings False'); assert.ok(!mark(L,F[2],'rf'),'not another');
  const m=F[1]._talM[v.uid].rf; near(m.until-V.now(),5,'for 1 s x 5',1e-6);
  const Q=lab(H,S(['rf_3_1','rf_2_1']),{foes:2,big:true}); autoOn(Q,Q.F[0],2); assert.ok(mark(Q,Q.F[0],'rf'),'Found the Place: the 2nd basic attack is enough');
  const M=lab(H,S(['rf_1_1']),{foes:2,big:true}); autoOn(M,M.F[0],2); assert.ok(!mark(M,M.F[0],'rf'),'(without it: the 3rd)');
});

test('Hobb / Fracture: Hairline, Deep Fracture, It Gives, Clay Pit Hide, Uneasy Strength\'s count',()=>{
  const L=lab(H,S(['rf_1_4','rf_3_4','rf_9_4','rf_5_1','rf_7_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; noDef(L);
  setMk(L,F[0],'rf'); castGZ(L,F[0]); assert.equal(ustOf(L,F[0],'frac'),1,'Glazebreaker on an enemy that Rings False: 1 Fracture'); castGZ(L,F[1]); assert.equal(ustOf(L,F[1],'frac'),0,'not on one that does not');
  for(const f of F) f.armorRating=500; setUst(L,F[0],'frac',3); V.step(2); near(auOf(L,F[0]).ap.armor,1-0.03*3,'Hairline: each Fracture 1% x 3 less armour'); near(F[0].armorRating,500*0.91,'');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*(1+0.02*3),'Deep Fracture: it takes 0.4% x 5 more from his allies per Fracture');
  near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0])),'(not from him)');
  near(hitOn(L,1000,{src:F[0],kind:'magic'}),plainHit(L,()=>hitOn(L,1000,{src:F[0],kind:'magic'}))*0.90,'Clay Pit Hide: a Fractured enemy\'s magic 2% x 5 less on him');
  near(hitOn(L,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,1000,{src:F[0]})),'(not its true damage)'); near(hitOn(L,1000,{src:F[1],kind:'magic'}),plainHit(L,()=>hitOn(L,1000,{src:F[1],kind:'magic'})),'(not an enemy with none)');
  setUst(L,F[0],'frac',4); setMk(L,F[0],'rf'); castGZ(L,F[0]); assert.equal(ustOf(L,F[0],'frac'),5,''); assert.ok(mark(L,F[0],'gave'),'It Gives: at 5 Fracture it gives way'); V.step(2); near(F[0].armorRating,0,'its armour is zero');
  castGZ(L,F[0]); const g=F[0]._talM[v.uid].gave; secs(2.05-(V.now()-g.t0)); assert.equal(ustOf(L,F[0],'frac'),0,'after 2 s its Fracture empties (a Glazebreaker meanwhile did not make it longer)'); V.step(2); near(F[0].armorRating,500,'and its armour is back');
  free(L); setUst(L,F[1],'frac',0); at(L,F[1],8,0); castKS(L,F[0]); assert.equal(ustOf(L,F[1],'frac'),3,'Fractured Line: every enemy Grand Kiln Shape hits gains 1 x 3 Fracture'); hold(L);
});

test('Hobb / Glazebreaker: Paddle Weight, Pottery Paddle, Glaze Shatter, Glaze Paddle, Breaker\'s Rhythm; Beat Until It Gives / Clean Break (PICK ONE), Shard Spray',()=>{
  let cut0=0; plain({foes:3,big:true},P=>{ castGZ(P,P.F[0]); cut0=P.F[0]._shredPct; });
  const L=lab(H,S(['rf_2_2','ct_4_2','rf_4_2','rf_8_2','ow_7_2']),{foes:3,big:true}), {v,F}=L; noDef(L);
  const pl=gzPlain(L,F[1]); near(gzHit(L,F[1]),pl*1.15*1.15,'Paddle Weight 3% x 5, Pottery Paddle 5% x 3 more');
  castGZ(L,F[2]); near(F[2]._shredPct,cut0*1.06,'Glaze Shatter: the armour cut 2% x 3 stronger (multiplied)'); near(FX.cd(v,'green',6),6-0.5-0.75,'Glaze Paddle 0.1 x 5, Breaker\'s Rhythm 0.15 x 5 shorter');
  { const B=lab(H,S(['rf_5_2']),{foes:3,big:true}); setMk(B,B.F[0],'rf'); castGZ(B,B.F[0]); near(B.F[0]._shredT,6,'Beat Until It Gives: on an enemy that Rings False the cut lasts 1 s longer'); castGZ(B,B.F[1]); near(B.F[1]._shredT,5,'(not on another)'); }
  const C=lab(H,S(['rf_5_3','rf_6_3','rf_1_4']),{foes:3,big:true}); noDef(C); beside(C.F[0],C.F[1],1.0); at(C,C.F[2],30,0); const p0=gzPlain(C,C.F[0]);
  setMk(C,C.F[0],'rf'); const h1=C.F[1].hp, h2=C.F[2].hp, d=gzHit(C,C.F[0]); near(d,p0*1.40,'Clean Break: 40% more to an enemy that Rings False');
  assert.ok(!mark(C,C.F[0],'rf'),'and its Ring False ends'); assert.equal(ustOf(C,C.F[0],'frac'),1,'(after the hit\'s own Fracture)');
  near(h1-C.F[1].hp,d*0.30,'Shard Spray: every enemy within 1.5 m takes 10% x 3 of it',1e-6); near(h2-C.F[2].hp,0,'not one far away');
  const h1b=C.F[1].hp; near(gzHit(C,C.F[0]),p0,'the next one is plain (no Ring False)'); near(h1b-C.F[1].hp,0,'and sprays nothing');
});

test('Hobb / Four Hundred Years on the Floor (SIGNATURE): triple at 5 Fracture, every enemy within 4 m Rings False and gains 3 Fracture, once every 25 s',()=>{
  const L=lab(H,S(['rf_13_2','rf_1_4']),{foes:4,big:true}), {v,F}=L; noDef(L); beside(F[0],F[1],3.5); at(L,F[2],30,0); at(L,F[3],30,10);
  const pl=gzPlain(L,F[0]); setUst(L,F[0],'frac',5); near(gzHit(L,F[0]),pl*3,'triple Glazebreaker damage on an enemy at 5 Fracture');
  assert.ok(mark(L,F[1],'rf'),'every enemy within 4 m Rings False'); assert.equal(ustOf(L,F[1],'frac'),3,'and gains 3 Fracture'); assert.ok(!mark(L,F[2],'rf')&&ustOf(L,F[2],'frac')===0,'not one far away');
  near(gzHit(L,F[0]),pl,'once every 25 s'); secs(24.6); let q=gzPlain(L,F[0]); near(gzHit(L,F[0]),q,'(24.6 s: not yet)'); secs(0.5); setUst(L,F[0],'frac',5); q=gzPlain(L,F[0]); near(gzHit(L,F[0]),q*3,'25 s later again');
  setUst(L,F[3],'frac',4); secs(26); q=gzPlain(L,F[3]); near(gzHit(L,F[3]),q,'(4 Fracture: no)');
});

test('Hobb / basic attacks: Wide Swing, Broad Paddle, Shaped Blow, Rhythm of the Paddle; Through the Glaze, Glazer\'s Eye; All of Them False',()=>{
  const L=lab(H,S(['rf_4_3','ct_8_2','ow_6_3','rf_3_3','ow_3_2']),{foes:3,big:true}), {v,F}=L; noDef(L);
  near(myHit(L,F[0],{auto:true}),plainHit(L,()=>myHit(L,F[0],{auto:true}))*1.09*1.09*1.10,'Wide Swing 3% x 3, Broad Paddle 3% x 3, Shaped Blow 2% x 5'); near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0])),'(not his other hits)');
  F[0].armorRating=500; const T0=v._tal; v._tal=undefined; const a0=VMX('defMul')(v,F[0],'phys'); v._wpnArmIgn=0.10; const a1=VMX('defMul')(v,F[0],'phys'); v._wpnArmIgn=0; v._tal=T0;
  near(myHit(L,F[0],{kind:'phys'}),plainHit(L,()=>myHit(L,F[0],{kind:'phys'}))*(a1/a0)*(a1/a0),'Through the Glaze, Glazer\'s Eye: each ignores 2% x 5 of the armour (they multiply)');
  const R=lab(H,S(['rf_10_1']),{foes:2,big:true}); const hx=()=>lost(R.F[0],()=>V.hit(R.v,R.F[0],1000,{kind:'true',auto:true}));
  const n1=hx(), n2=hx(), n3=hx(), n4=hx(); near(n2,n1,''); near(n3,n1*1.30,'Rhythm of the Paddle: his 3rd basic attack in a row on one enemy 6% x 5 more'); near(n4,n1,'the 4th is plain');
  hx(); V.hit(R.v,R.F[1],10,{kind:'true',auto:true}); near(hx(),n1,'an attack on another enemy in between: the row starts again'); hx(); near(hx(),n1*1.30,'');
  const Q=lab(H,S(['rf_12_2']),{foes:2,big:true}); Q.v.maxHp=1e6; Q.v.hp=5e5; setMk(Q,Q.F[0],'rf'); const h=Q.v.hp; V.hit(Q.v,Q.F[0],1000,{kind:'true'}); near(Q.v.hp-h,1000*0.05,'All of Them False: 1% x 5 lifesteal on an enemy that Rings False',1e-6);
  const g=Q.v.hp; V.hit(Q.v,Q.F[1],1000,{kind:'true'}); near(Q.v.hp-g,0,'not another');
});

test('Hobb / Shard Harvest, Swept Up',()=>{
  const L=lab(H,S(['rf_10_4','rf_12_4']),{foes:3,allies:2,big:true}), {v,F,A}=L; v.maxHp=1e6; v.hp=5e5; A[0].hp=A[0].maxHp*0.9; A[1].hp=A[1].maxHp*0.5;
  setUst(L,F[0],'frac',4); const h=v.hp, a1=A[1].hp, a0=A[0].hp; kill(L,F[0]); near(v.hp-h,1e6*0.004*5*4,'Shard Harvest: 0.4% x 5 of his max HP for each of its 4 Fracture',1e-9);
  near(A[1].hp-a1,1e6*0.004*5*4*0.5*2,'Swept Up: the lowest-health ally 50% x 2 as much',1e-6); near(A[0].hp-a0,0,'not another');
  const g=v.hp; kill(L,F[1]); near(v.hp,g,'an enemy with no Fracture: nothing');
});

/* ============================== CRITICAL CHANCE ============================== */
test('Hobb / critical chance, one group of 5%: Ear for It, Uneasy Strength, Eye on the Shelf, Throwing Hands',()=>{
  const L=lab(H,S(['rf_6_1','rf_9_3','ct_7_2','ow_7_4']),{foes:3,big:true}), {v,F}=L, p=t=>L.T.fn.critP(api(L),L.T,v,{tgt:t});
  near(p(F[0]),0,'nothing'); setMk(L,F[0],'rf'); near(p(F[0]),0.045,'Ear for It: 1.5% x 3 against an enemy that Rings False'); near(p(F[1]),0,'');
  setUst(L,F[1],'frac',3); near(p(F[1]),0.002*5*3,'Uneasy Strength: 0.2% x 5 for each Fracture on his target');
  setWin(L,'sure',4); near(p(F[2]),0.05,'Eye on the Shelf: 1% x 5 for 4 s after a Kin Shard breaks'); L.T.s.w.sure.t=0; setStack(L,'turn',8); near(p(F[2]),0.05,'Throwing Hands: 1% x 5 at 8 Turns');
  setWin(L,'sure',4); setUst(L,F[0],'frac',5); near(p(F[0]),0.05,'all of them together: at most 5%');
  { const Q=lab(H,[['ct_7_2',3]],{foes:2,big:true}); setWin(Q,'sure',4); near(Q.T.fn.critP(api(Q),Q.T,Q.v,{tgt:Q.F[0]}),0.03,'Eye on the Shelf at 3/5: 1% x 3'); }
  noDef(L); v.critDmg=0.6; F[0].critRes=0; let c=0, c0=0; for(let i=0;i<800;i++){ if(myHit(L,F[0])>1100) c++; if(plainHit(L,()=>myHit(L,F[0]))>1100) c0++; } assert.equal(c0,0,'(the lab hits never crit on their own)'); assert.ok(c>18&&c<70,'an extra seeded 5% on his hits: '+c+' of 800 critical');
});

/* ============================== DAMAGE REDUCTION: ONE GROUP ============================== */
test('Hobb / damage reduction, one group of 30%: Steady Wheel, Big Shoulders, Mask of the River, Second Coat, Shelf of Names, River Mask, Hard Fired, Old Clay',()=>{
  const L=lab(H,S(['rf_8_3','ct_8_4','ow_12_4']),{foes:3,big:true}), {v,F}=L;
  near(hitOn(L),plainHit(L,()=>hitOn(L))*0.97*0.95*0.97,'Steady Wheel 1% x 3, Big Shoulders 1% x 5, Mask of the River 1% x 3: each takes its share of what is left');
  const C=lab(H,S(['ct_1_3','ct_10_4','ct_1_4']),{foes:3,big:true}); setStack(C,'coat',4); near(hitOn(C),plainHit(C,()=>hitOn(C))*0.90*(1-0.02*3),'Second Coat: 0.5% x 5 per Coat (4); Shelf of Names: 0.4% x 5 per Kin Shard still whole (3)'); setStack(C,'coat',1); near(hitOn(C),plainHit(C,()=>hitOn(C))*0.975*(1-0.02*3),'(1 Coat)');
  const D=lab(H,S(['ct_11_1','ct_11_3','ct_12_4']),{foes:3,big:true}), f=D.F[0], t0=f.t; near(hitOn(D),plainHit(D,()=>hitOn(D)),'none of their conditions: nothing');
  f.t=Object.assign({},t0,{row:'Back'}); near(hitOn(D),plainHit(D,()=>hitOn(D))*(1-0.075),'River Mask: 1.5% x 5 from an enemy in the back row'); f.t=t0;
  near(hitOn(D,1000,{crit:true}),plainHit(D,()=>hitOn(D,1000,{crit:true}))*0.85,'Hard Fired: a critical hit 3% x 5 less');
  D.v.hp=D.v.maxHp*0.31; near(hitOn(D),plainHit(D,()=>hitOn(D)),'(31% HP: no Old Clay)'); D.v.hp=D.v.maxHp*0.29; near(hitOn(D),plainHit(D,()=>hitOn(D))*0.91,'Old Clay: below 30% HP 3% x 3 less'); D.v.hp=D.v.maxHp;
  const X=lab(H,S(['rf_8_3','ct_8_4','ow_12_4','ct_1_3','ct_12_1','ct_10_4','ct_1_4','ct_2_4','ct_11_3']),{foes:3,big:true}); setStack(X,'coat',6);
  near(hitOn(X,1000,{crit:true}),plainHit(X,()=>hitOn(X,1000,{crit:true}))*0.70,'all of them at once: never more than 30% off a hit');
});

test('Hobb / damage reduction: Tessel Blue, Clay Skin, Centred, For Grandmother; Blue Glaze; White Plates and The Long Hall (Fired Clay); Shaped Hands',()=>{
  const L=lab(H,S(['rf_12_3','ow_5_4','ow_6_4']),{foes:3,big:true}), {v,F}=L;
  setMk(L,F[0],'rf'); near(hitOn(L),plainHit(L,()=>hitOn(L))*(1-0.045),'Tessel Blue: 1.5% x 3 less from an enemy that Rings False'); near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]})),'');
  setMk(L,F[1],'kh'); near(hitOn(L,1000,{src:F[1],kind:'magic'}),plainHit(L,()=>hitOn(L,1000,{src:F[1],kind:'magic'}))*0.90,'Clay Skin: magic from a Kiln-Hot enemy 2% x 5 less'); near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]})),'(not true damage)');
  setStack(L,'turn',8); near(hitOn(L,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,1000,{src:F[2]}))*0.94,'Centred: at 8 Turns 2% x 3 less'); setStack(L,'turn',7); near(hitOn(L,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,1000,{src:F[2]})),'');
  const G=lab(H,S(['ow_2_3','ow_4_3','ow_5_3']),{foes:3,allies:1,big:true}); near(hitOn(G),plainHit(G,()=>hitOn(G))*0.90,'For Grandmother: he holds the Evening Jar, 1% x 5 at double strength');
  const B=lab(H,S(['ct_5_3','ct_6_3']),{foes:3,big:true}); near(hitOn(B),plainHit(B,()=>hitOn(B)),'Blue Glaze: nothing without Sealed Vessel'); castSV(B); const r0=1-B.v.drMul;
  near(hitOn(B),plainHit(B,()=>hitOn(B))*(1-1.15*r0)/(1-r0),'Blue Glaze: while it holds, Sealed Vessel\'s reduction 15% stronger (multiplied)'); B.v.drMul=0.9; near(hitOn(B),plainHit(B,()=>hitOn(B)),'(not once another skill wrote his slot)');
  const W=lab(H,S(['ct_3_1','ct_7_4','ct_1_3','rf_10_2']),{foes:3,big:true}), w=W.v, cap0=VMX('(u=>SKLV.wardenCap(passLv(u)))')(w), pm=w.passMul||1;
  w.wardenStk=2; w.wardenT=0; setStack(W,'coat',2); const c0=VMX('wardenCut')(w), c1=Math.min(cap0+0.05+0.04,0.04*pm*4); assert.ok(c1>c0,'');
  near(hitOn(W),plainHit(W,()=>hitOn(W))*(1-c1)/(1-c0)*(1-0.025*2),'The Long Hall: each Coat counts as a Fired Clay stack; White Plates and The Long Hall raise its cap (points)');
  w.wardenStk=5; setStack(W,'coat',0); const c5=VMX('wardenCut')(w), c6=Math.min(cap0+0.09,0.04*pm*5); near(hitOn(W),plainHit(W,()=>hitOn(W))*(1-c6)/(1-c5),'at 5 stacks: what the raised cap lets through');
  const a0=w.armorRating; V.step(2); const atCap=c6>=cap0+0.09-1e-9; near(w.armorRating,atCap?a0*1.10:a0,'Shaped Hands: 2% x 5 more armour only while Fired Clay is at its (raised) cap');
  { const U=lab100(S(['ct_3_1'])), cA=VMX('wardenCut'), cP=VMX('(u=>SKLV.wardenCap(passLv(u)))'); U.v.wardenStk=5; const b0=cA(U.v), b1=Math.min(cP(U.v)+0.05,0.04*(U.v.passMul||1)*5); assert.ok(b1>b0+0.01,'(at skill level 100 the cap binds)');
    near(hitOn(U),plainHit(U,()=>hitOn(U))*(1-b1)/(1-b0),'White Plates: at the cap, 1 point x 5 more'); }
  const Z=lab(H,S(['rf_10_2']),{foes:2,big:true}); Z.v.wardenStk=5; const z0=Z.v.armorRating; V.step(2); near(Z.v.armorRating,z0*1.10,'Shaped Hands at the passive\'s own cap'); Z.v.wardenStk=1; V.step(2); near(Z.v.armorRating,z0,'not below it');
});

/* ============================== CARRYING THE TOWN ============================== */
test('Hobb / Coats: Second Coat\'s Coats from Sealed Vessel, Painted Mask, Thick Glaze, Glazed Fists, Thrown Each Evening, Heavy Paddle, Vessel Strength',()=>{
  const L=lab(H,S(['ct_1_3','ct_12_1','ct_2_3','ct_9_1','ct_10_2','ct_3_2','ct_6_3']),{foes:3,big:true}), {v,F}=L;
  const hp0=v.maxHp, a0=v.dmg, i0=v.atkInterval; castSV(L); near(v.drT,6,'Vessel Strength: Sealed Vessel 0.2 x 5 s longer'); assert.ok(win(L,'vessel'),''); V.step(1); near(v.dmg,a0*1.15,'Heavy Paddle: 3% x 5 attack while it holds');
  secs(5.9); assert.equal(stack(L,'coat'),0,'(5.9 s)'); secs(0.2); assert.equal(stack(L,'coat'),1,'it ends: 1 Coat'); V.step(1); near(v.dmg,a0*1.02,'Glazed Fists: 0.4% x 5 attack per Coat (Heavy Paddle over)');
  near(v.maxHp,hp0*(1+0.009),'Thick Glaze: 0.3% x 3 max HP per Coat'); near(v.atkInterval,i0/(1+0.015),'Thrown Each Evening: 0.5% x 3 attack speed per Coat');
  for(let i=0;i<8;i++){ castSV(L); secs(6.1); } assert.equal(stack(L,'coat'),6,'Painted Mask: up to 4 + 1 x 2'); V.wave(); V.step(1); assert.equal(stack(L,'coat'),0,'a new wave: none');
  castSV(L); secs(2); V.wave(); V.step(1); secs(5); assert.equal(stack(L,'coat'),0,'a Sealed Vessel cut short by the wave\'s end leaves none');
});

test('Hobb / Kin Shards: Grandmother\'s Shard, More of the Shelf, Fragments, Eye on the Shelf, Shards on the Wheel (LINK), Swept and Refired, Nobody Left Behind',()=>{
  const L=lab(H,S(['ct_1_4','ct_2_4','ct_6_4','ct_7_2','ct_n1','ct_3_4','ct_11_4','ow_1_4']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=1e6;
  assert.equal(stack(L,'shard'),6,'More of the Shelf: 3 + 1 x 3'); setStack(L,'turn',2);
  near(hitOn(L,140000),plainHit(L,()=>hitOn(L,140000)),'a hit of 14% of his max HP: no shard'); assert.equal(stack(L,'shard'),6,''); v.hp=1e6;
  const a0=v.dmg, h=hitOn(L,200000); near(h,plainHit(L,()=>{ v.hp=1e6; return hitOn(L,200000); })*0.70,'more than 15%: a Kin Shard takes 10% x 3 of it'); v.hp=1e6;
  assert.equal(stack(L,'shard'),5,'and breaks'); assert.ok(win(L,'sure'),'Eye on the Shelf'); assert.equal(stack(L,'turn'),6,'Shards on the Wheel: with Lump on the Wheel, 4 Turns'); V.step(1); near(v.dmg,a0*1.03,'Fragments: 1% x 3 attack per broken shard');
  near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*0.95,'Shards on the Wheel: 5% less'); secs(3.05); near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000)),'for 3 s'); assert.ok(win(L,'sure'),''); secs(1); assert.ok(!win(L,'sure'),'Eye on the Shelf for 4 s');
  setStack(L,'turn',7); hitOn(L,200000); v.hp=1e6; assert.equal(stack(L,'turn'),8,'never past 8 Turns'); castSV(L); assert.equal(stack(L,'shard'),5,'Swept and Refired: Sealed Vessel mends 1');
  setStack(L,'shard',1); hitOn(L,200000); v.hp=1e6; assert.equal(stack(L,'shard'),6,'Nobody Left Behind: the last one breaks, all are mended'); setStack(L,'shard',1); hitOn(L,200000); v.hp=1e6; assert.equal(stack(L,'shard'),0,'once per fight');
  const M=lab(H,S(['ct_n1']),{foes:3,big:true}); M.v.maxHp=1e6; M.v.hp=1e6; assert.equal(stack(M,'shard'),3,'Kin Shards exist with any talent that names them'); near(hitOn(M,200000),plainHit(M,()=>{ M.v.hp=1e6; return hitOn(M,200000); }),'(without Grandmother\'s Shard a breaking shard takes nothing)'); assert.equal(stack(M,'shard'),2,'');
});

test('Hobb / Most of the Town (SIGNATURE): a Kin Shard breaks at 4 Coats - 5 s halved, Sealed Vessel again, every shard mended, once every 30 s',()=>{
  const L=lab(H,S(['ct_13_3','ct_1_3','ct_1_4']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=1e6; setStack(L,'coat',4); v.drT=0; const b0=v.blueCd;
  hitOn(L,200000); v.hp=1e6; assert.ok(win(L,'town'),'the whole town holds'); assert.equal(stack(L,'shard'),3,'every broken Kin Shard is mended');
  V.step(1); near(v.drMul,VMX('skLvNum')('defensive',VMX('KITS.hobb.blue'),10),'Sealed Vessel is cast again at once'); assert.ok(v.drT>4.9&&win(L,'vessel'),''); near(v.blueCd,b0,'(no cooldown spent)');
  near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*0.5,'every hit on him halved, in place of his other damage-reduction talents (Second Coat\'s 10%)');
  secs(5.1); near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*(1-0.025*stack(L,'coat')),'for 5 s (then Second Coat again)');
  hitOn(L,200000); v.hp=1e6; assert.ok(!win(L,'town'),'once every 30 s'); assert.equal(stack(L,'shard'),2,''); secs(17); hitOn(L,200000); v.hp=1e6; assert.ok(!win(L,'town'),'(22 s: not yet)'); secs(8); hitOn(L,200000); v.hp=1e6; assert.ok(win(L,'town'),'30 s later again');
  secs(31); setStack(L,'coat',3); hitOn(L,200000); v.hp=1e6; assert.ok(!win(L,'town'),'not with 3 Coats');
});

test('Hobb / Sealed Vessel: Jar Ready, River Glaze (PICK ONE) and Running Water, Set Tight, Sealed Tight',()=>{
  const L=lab(H,S(['ct_4_3','ct_5_2','ct_6_2','ct_8_3','ct_9_3']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=5e5; go(L);
  near(FX.cd(v,'blue',9),9-0.9,'Jar Ready: 0.3 x 3 s shorter'); const h=v.hp; castSV(L); near(v.hp-h,1e6*0.07,'River Glaze: the jar breaks, 4% + Running Water 1% x 3 of his max HP',1e-9);
  clk(L);
  const g=v.hp; secs(1.02); near(v.hp-g,1e6*0.012,'Set Tight: 0.24% x 5 a second while it holds (the regeneration cap)',1e-3);
  ccOn(F[0],v,'stunned',2); near(v.stunned,0,'Sealed Tight: no stun lands'); v.stunned=3; V.step(1); near(v.stunned,0,'nor one written straight on'); assert.ok(v._gearImmovableT>0,'and nothing moves him');
  ccOn(F[0],v,'silencedT',1); assert.ok(v.silencedT>0,'(a silence still does)'); v.silencedT=0; secs(5); const k=v.hp; secs(1.1); near(v.hp,k,'after it: no Set Tight'); ccOn(F[0],v,'stunned',1); assert.ok(v.stunned>0,'and stuns land again'); v.stunned=0;
});

test('Hobb / Fired Clay faster: Long Firing, Fired by Blows, Fired Clay Heart (never sooner than one stack every 1.5 s)',()=>{
  { const L=lab(H,S(['rf_11_3']),{foes:2,big:true}), {v}=L; v.wardenStk=0; v.wardenT=0; secs(1.9); assert.equal(v.wardenStk|0,0,'(1.9 s)'); secs(0.2); assert.equal(v.wardenStk,1,'Long Firing: a stack every 3 - 0.2 x 5 = 2 s'); }
  { const L=lab(H,S(['rf_11_3','ct_7_1','ow_11_2']),{foes:2,big:true}), {v}=L; v.wardenStk=0; v.wardenT=0; secs(1.4); assert.equal(v.wardenStk|0,0,'(1.4 s)'); secs(0.2); assert.equal(v.wardenStk,1,'all three: 3 s off, held at one every 1.5 s'); }
});

test('Hobb / controls on him: Unhurried Hands (20%), slows weaker - Clay Weight, Painted River, Wet Clay (together at most 40%)',()=>{
  { const L=lab(H,S(['ct_4_4']),{foes:2,big:true}), {v,F}=L; v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.80,'Unhurried Hands: 4% x 5 shorter',1e-9); v.stunned=1e6; }
  { const L=lab(H,S(['rf_11_1']),{foes:2,big:true}), {v}=L; v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*0.80,'Clay Weight: a slow 4% x 5 weaker'); }
  { const L=lab(H,S(['rf_11_1','ct_6_1','ow_8_2']),{foes:2,big:true}), {v}=L; v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*0.60,'all three: they multiply, and together at most 40% (0.8 x 0.8 x 0.76 would be 51%)'); V.step(2); near(v.slowMul,0.70,'once per slow'); }
});

test('Hobb / move speed: Potter\'s Gait, Heavy Step, Wheel Gait',()=>{
  let s0=0; plain({foes:2},P=>{ s0=P.v.speed; }); const L=lab(H,S(['rf_2_3','ct_5_1','ow_2_2']),{foes:2}); near(L.v.speed,s0*1.27,'each 3% x 3 faster (one move total: 27%)');
});

test('Hobb / Never Cracked: a critical hit on him tops his shield up to 1% x 5 of his max HP for 3 s (it does not stack)',()=>{
  const L=lab(H,S(['ct_12_3']),{foes:2,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=1e6; v.shield=0;
  V.hit(F[0],v,1000,{kind:'true'}); near(v.shield||0,0,'a normal hit: nothing'); V.hit(F[0],v,1000,{kind:'true',crit:true}); near(v.shield,1e6*0.05,'a critical hit: a shield of 5% of his max HP'); near(v.shieldT,3,'for 3 s',1e-6);
  V.hit(F[0],v,1000,{kind:'true',crit:true}); near(v.shield,1e6*0.05,'a second one tops it up again, no more');
});

/* ============================== ON THE WHEEL ============================== */
test('Hobb / Kiln-Hot: Kiln Heat, Long in the Kiln, Kiln Glow, Hot Glaze, Open the Kiln, Kiln Opens',()=>{
  const L=lab(H,S(['ow_1_1','ow_3_1','ow_5_1','ow_6_1','ow_7_1','ow_9_1']),{foes:4,big:true}), {v,F}=L; noDef(L); at(L,F[1],8,0); beside(F[0],F[2],1.5); at(L,F[3],30,12);
  free(L); F[1].level=1000; const h1=F[1].hp; castKS(L,F[0]); hold(L); assert.ok(mark(L,F[0],'kh'),'Kiln Heat: an enemy Grand Kiln Shape stuns is Kiln-Hot'); assert.ok(!mark(L,F[2],'kh'),'(not one it did not reach)');
  assert.ok(F[1].hp<h1&&!mark(L,F[1],'kh'),'(nor one it struck whose stun was resisted)'); at(L,F[1],30,0);
  near(F[0]._talM[v.uid].kh.until-V.now(),6+2.5,'for 6 + 0.5 x 5 s',1e-6); const d=dotOf(L,F[0],'kh'); assert.ok(d,'it burns'); near(d.dps,0.09*v.dmg*VMX('rageMul'),'3% x 3 of his attack every second (a talent burn)',1e-6);
  near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0]))*1.075,'Kiln Glow: 1.5% x 5 more from him'); V.step(2); const e=auOf(L,F[0]); near(e&&e.ap.move,0.88,'Hot Glaze: 6% x 2 slower'); near(e&&e.ap.mr,0.94,'Open the Kiln: 2% x 3 less magic resist');
  kill(L,F[0]); assert.ok(mark(L,F[2],'kh'),'Kiln Opens: every enemy within 2 m of the fallen one is Kiln-Hot'); near(F[2]._talM[v.uid].kh.until-V.now(),3,'for 3 s',1e-6); assert.ok(dotOf(L,F[2],'kh'),'and burns'); assert.ok(!mark(L,F[3],'kh'),'not one far away');
});

test('Hobb / Fired Again, Warm Kiln (with The Evening Jar), Set Tight - together at most 1.2% of his max HP a second',()=>{
  const L=lab(H,S(['ow_10_1','ow_12_1','ow_2_3','ct_8_3']),{foes:4,allies:1,big:true,cold:true}), {v,F,A}=L; V.step(1); v.maxHp=1e6; v.hp=5e5; A[0].maxHp=1e6; A[0].hp=5e5;
  assert.ok(mark(L,A[0],'jar'),'(the ally holds the Evening Jar)'); setMk(L,F[0],'kh'); setMk(L,F[1],'kh'); clk(L);
  let h=v.hp, a=A[0].hp; secs(1.02); near(v.hp-h,1e6*0.005*2,'Fired Again: 0.1% x 5 of his max HP for each Kiln-Hot enemy (2)',1e-3); near(A[0].hp-a,1e6*0.005*2*1.0,'Warm Kiln: the jar\'s holder half as much x 2',1e-3);
  setMk(L,F[2],'kh'); setMk(L,F[3],'kh'); h=v.hp; a=A[0].hp; secs(1.0); near(v.hp-h,1e6*0.012,'4 enemies (2%): held at 1.2%',1e-3); near(A[0].hp-a,1e6*0.012,'and the holder at 1.2% of its own',1e-3);
  castSV(L); h=v.hp; secs(1.0); near(v.hp-h,1e6*0.012,'Set Tight on top: still 1.2%',1e-3);
});

test('Hobb / Turns: Lump on the Wheel, Fast Wheel, Steady Turning, Spin It Up, Wheel Momentum, Thrown Shape, Throwing Hands\'s count',()=>{
  let base=0; plain({foes:3,big:true},P=>{ noDef(P); free(P); const h=P.F[0].hp; castKS(P,P.F[0]); base=h-P.F[0].hp; hold(P); });
  const L=lab(H,S(['ow_1_4','ow_2_4','ow_11_4','ow_9_4','ow_10_4','ow_3_4']),{foes:3,big:true}), {v,F}=L; noDef(L);
  assert.equal(stack(L,'turn'),5,'Spin It Up: each wave starts with 1 x 5 Turns'); const i0=v.atkInterval, a0=v.armorRating; autoOn(L,F[0],1); assert.equal(stack(L,'turn'),6,'each basic attack: 1 Turn'); V.step(1);
  near(v.atkInterval,i0*(1+0.015*5)/(1+0.015*6),'Fast Wheel: 0.5% x 3 attack speed per Turn'); near(v.armorRating,a0*(1+0.015*6)/(1+0.015*5),'Steady Turning: 0.3% x 5 armour per Turn');
  autoOn(L,F[0],5); assert.equal(stack(L,'turn'),8,'up to 8'); castGZ(L,F[1]); assert.equal(stack(L,'turn'),8,'');
  setStack(L,'turn',3); castGZ(L,F[1]); assert.equal(stack(L,'turn'),5,'Wheel Momentum: 20% x 5 that Glazebreaker adds 2 Turns');
  setStack(L,'turn',4); free(L); let h=F[0].hp; castKS(L,F[0]); near(h-F[0].hp,base*(1+0.10*4),'Lump on the Wheel: Grand Kiln Shape 2% x 5 more for each Turn'); assert.equal(stack(L,'turn'),0,'and spends them all');
  at(L,F[1],4.5+6,0); setStack(L,'turn',8); h=F[1].hp; castKS(L,F[0]); assert.ok(F[1].hp<h,'Thrown Shape: with 8 Turns it reaches 50% farther (an enemy 6 m from the target)'); h=F[1].hp; castKS(L,F[0]); near(h-F[1].hp,0,'(with 0 Turns: not)'); hold(L);
  V.wave(); V.step(1); assert.equal(stack(L,'turn'),5,'a new wave: Spin It Up again');
});

test('Hobb / Grand Kiln Shape: Frontline Breaker, Kiln Patience, Grand Shape, Bigger Mold, Kiln Shape Rings, Hands on the Ground and Shaped for Them',()=>{
  let base=0; plain({foes:3,big:true},P=>{ noDef(P); free(P); const h=P.F[0].hp; castKS(P,P.F[0]); base=h-P.F[0].hp; hold(P); });
  const L=lab(H,S(['rf_7_3','ct_10_3','ow_10_3','ow_4_2','rf_11_2','rf_2_1','ow_11_3','ow_12_3']),{foes:3,allies:2,big:true}), {v,F,A}=L; noDef(L); beside(v,A[0],3.5,-1); at(L,A[1],0,-16);
  free(L); const h=F[0].hp; castKS(L,F[0]); near(h-F[0].hp,base*1.15*1.12*1.15,'Frontline Breaker 3% x 5, Kiln Patience 4% x 3, Grand Shape 3% x 5');
  near(F[0].stunned,1.4+0.3,'Bigger Mold: its stun 0.1 x 3 s longer, added in full after it lands',1e-9); assert.ok(mark(L,F[0],'rf'),'Kiln Shape Rings: every enemy it stuns Rings False'); near(F[0]._talM[v.uid].rf.until-V.now(),5+3,'(for Ring False\'s own time)',1e-6);
  near(A[0].shield,v.maxHp*(0.10+0.10),'Hands on the Ground: every ally within 4 m a shield of 10% + Shaped for Them 2% x 5 of his max HP'); near(A[1].shield||0,0,'not one far away'); near(v.shield||0,0,'not himself'); hold(L);
});

test('Hobb / The Evening Jar: the lowest-HP ally each wave, Jar Lid, Hall of Jars; For Whoever Needs It (PICK ONE), One Jar Each Evening',()=>{
  const L=lab(H,S(['ow_2_3','ow_4_3','ow_9_2']),{foes:3,allies:2,big:true,cold:true}), {v,F,A}=L; A[0].hp=A[0].maxHp*0.9; A[1].hp=A[1].maxHp*0.6; V.step(1);
  assert.ok(mark(L,A[1],'jar')&&!mark(L,A[0],'jar')&&!mark(L,v,'jar'),'at the start of the wave the ally with the lowest HP holds the Evening Jar');
  near(lost(A[1],()=>V.hit(F[0],A[1],1000,{kind:'true'})),plainHit(L,()=>lost(A[1],()=>V.hit(F[0],A[1],1000,{kind:'true'})))*0.95,'it takes 1% x 5 less'); near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),1000,'not another');
  let a=A[1].hp; V.heal(A[1],1000); const plainHeal=plainHit(L,()=>{ const b=A[0].hp; V.heal(A[0],1000); return A[0].hp-b; }); near(A[1].hp-a,plainHeal*1.09,'Jar Lid: it receives 3% x 3 more healing');
  const a0=v.armorRating; A[1].hp=A[1].maxHp*0.4; V.step(2); near(v.armorRating,a0/1.10,'Hall of Jars: 2% x 5 armour only while the holder is above 50% HP'); A[1].hp=A[1].maxHp*0.6; V.step(2); near(v.armorRating,a0,'');
  A[0].hp=A[0].maxHp*0.1; A[1].hp=A[1].maxHp*0.8; V.wave(); V.step(1); assert.ok(mark(L,A[0],'jar')&&!mark(L,A[1],'jar'),'each wave it is set aside again');
  const W=lab(H,S(['ow_5_2','ow_6_2','ow_2_3']),{foes:3,allies:2,big:true,cold:true}); W.A[0].hp=W.A[0].maxHp*0.5; W.A[1].hp=W.A[1].maxHp*0.7; V.step(1); assert.ok(mark(W,W.A[0],'jar'),'');
  W.A[0].hp=W.A[0].maxHp*0.29; V.step(1); near(W.A[0].shield,W.A[0].maxHp*(0.15+0.09),'For Whoever Needs It: the holder below 30% - the jar breaks for a shield of 15% + 3% x 3 of its max HP'); assert.ok(mark(W,W.A[1],'jar')&&!mark(W,W.A[0],'jar'),'and passes to the next lowest-HP ally');
  W.A[1].hp=W.A[1].maxHp*0.2; V.step(1); near(W.A[1].shield||0,0,'once a wave');
});

test('Hobb / He Has Not Decided (SIGNATURE): 8 Turns spent - jars for every ally within 6 m, every enemy hit Kiln-Hot, his two skills ready; once every 30 s',()=>{
  const L=lab(H,S(['ow_13_3','ow_1_4','ow_1_1','ow_2_3']),{foes:3,allies:2,big:true,cold:true}), {v,F,A}=L; L.A[1].hp=L.A[1].maxHp*0.5; V.step(1); L.T=v._tal; assert.ok(mark(L,A[1],'jar'),'(A1 holds the wave jar)'); at(L,F[1],7.5,0); beside(v,A[0],5,-1); at(L,A[1],0,-20);
  F[1].level=200; v.greenCd=5; v.blueCd=5; setStack(L,'turn',8); free(L); F[1].level=200; castKS(L,F[0]); hold(L);
  assert.ok(mark(L,F[0],'kh')&&mark(L,F[1],'kh'),'every enemy it hits is Kiln-Hot (F1 resisted the stun: still)'); assert.ok(mark(L,A[0],'jar6')&&!mark(L,A[1],'jar6'),'every ally within 6 m holds an Evening Jar');
  near(lost(A[0],()=>V.hit(F[2],A[0],1000,{kind:'true'})),1000*0.95,'a full jar: 5% less'); near(v.greenCd,0); near(v.blueCd,0,'Glazebreaker and Sealed Vessel are ready at once');
  secs(6.1); assert.ok(!mark(L,A[0],'jar6'),'for 6 s'); v.greenCd=5; setStack(L,'turn',8); free(L); castKS(L,F[0]); hold(L); near(v.greenCd,5,'once every 30 s');
  secs(18); v.greenCd=5; setStack(L,'turn',8); free(L); castKS(L,F[0]); hold(L); near(v.greenCd,5,'(24 s: not yet)');
  secs(6.5); v.greenCd=5; setStack(L,'turn',7); free(L); castKS(L,F[0]); hold(L); near(v.greenCd,5,'(7 Turns: no)'); setStack(L,'turn',8); free(L); castKS(L,F[0]); hold(L); near(v.greenCd,0,'30 s later, 8 Turns: again');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Hobb: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['rf_1_1','rf_1_4','ct_1_3','ct_1_4','ow_1_4','ow_1_1','ow_2_3']), TEAM=['vael','sylthaine','vireo','vex','hobb'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let rf=false, fr=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of VMX('units').filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(o&&o.rf) rf=true; if(o&&o['#frac']) fr=Math.max(fr,o['#frac'].v); } }
  assert.ok(rf,'a real Ring False'); assert.ok(mx.coat>=1,'a real Coat: '+mx.coat); assert.ok(mx.turn>=3,'real basic attacks gave Turns: '+mx.turn);
  console.log('  live fight: max '+JSON.stringify(mx)+', Ring False '+rf+', Fracture '+fr);
  determinism(H,TEAM);
});

/* The page line his talents added (a bindMore line handing over Fired Clay's own numbers; no hook site in the fight): with nothing learned, whole seeded
   fights with Hobb in the line-up are identical to the pre-talent page (ee8edab8), seed by seed, and reach every skill of his. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Hobb: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every skill of his',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['hobb','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __hbN={gz:0,sv:0,ks:0,clay:0,hitOn:0}; var __hbD=_doEffectCore, __hbDD=_dealDamageCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="hobb"&&(!o||!o.deliver||o._arrived)){ if(type==="shred") __hbN.gz++; if(type==="defensive") __hbN.sv++; if(type==="aoeStun") __hbN.ks++; } return __hbD.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt,amt,color,kind){ if(tgt&&tgt.key==="hobb"&&src&&src.team!==tgt.team){ __hbN.hitOn++; if(tgt.wardenStk) __hbN.clay++; } return __hbDD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__hbN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.gz>0&&c.sv>0&&c.ks>0&&c.clay>0,'the fights cast Glazebreaker ('+c.gz+'), Sealed Vessel ('+c.sv+') and Grand Kiln Shape ('+c.ks+') and hit him with Fired Clay up ('+c.clay+' of '+c.hitOn+')'); }
  finally{ VMX('_doEffectCore=__hbD; _dealDamageCore=__hbDD;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. Hobb is a tank: his talent reductions are one capped
   group (30%; 50% while Most of the Town holds). Each candidate build is 91 points legal; the most defensive is the one whose worst hit is reduced most. */
const DEF={ rf:['rf_5_1','rf_8_3','rf_12_3','rf_10_2','rf_8_1'],
            ct:['ct_5_3','ct_6_3','ct_4_3','ct_1_3','ct_12_1','ct_8_4','ct_10_4','ct_2_4','ct_1_4','ct_11_1','ct_11_3','ct_12_4','ct_n1','ct_3_1','ct_7_4','ct_13_3','ct_1_1','ct_5_4','ct_9_2'],
            ow:['ow_5_3','ow_5_4','ow_6_4','ow_12_4','ow_11_4','ow_9_2','ow_1_4','ow_8_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={rf:0,ct:1,ow:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* a still field at skill level 100 (the lab's is 10): Sealed Vessel's slot is then the game's 59.95% */
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})]),snaps([0,1,2].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5][i]*V.METER; f.y=v.y; }); V.step(1); return {v,F,T:v._tal}; }
/* the worst hit on him: every condition of his damage-reduction talents true at once - Sealed Vessel up (Blue Glaze), Fired Clay full, 6 Coats, 6 whole shards,
   8 Turns, Shards on the Wheel up, below 30% HP, the attacker in the back row, Ringing False, at 5 Fracture and Kiln-Hot, a critical hit; once with Most of the
   Town holding and once without; the hit big enough to break a Kin Shard as well. Normal and critical, physical and magic. */
function worstHit(list,kind,crit,town){ const L=lab100(list), {v,F}=L, f=F[0]; const t0=f.t; f.t=Object.assign({},t0,{row:'Back'});
  v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=v.blueCd=1e9; V.cast(v,'blue',v); v.wardenStk=5; v.maxHp=1e6; v.hp=0.25*v.maxHp; v.shield=0;
  if(L.T){ const s=L.T.s; for(const [k,n] of [['coat',6],['shard',99],['turn',8]]) if(L.T.st[k]) s.k[k]=Object.assign(s.k[k]||{},{n:Math.min(n,L.T.st[k].max||n),t:99,idle:0});
    s.w.sotw={t:99,n:1,cdT:0,at:-1,wave:false}; if(town) s.w.town={t:99,n:1,cdT:0,at:-1,wave:false};
    const m=f._talM||(f._talM={}), o=m[v.uid]||(m[v.uid]={}); o.rf={t0:V.now(),until:V.now()+99,v:0}; o.kh={t0:V.now(),until:V.now()+99,v:0}; o['#frac']={v:5,until:Infinity}; }
  const raw=1e6, h0=v.hp; V.hit(f,v,raw,{kind,crit}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; f.t=t0; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Hobb: his most defensive legal 91-point build never takes 95% off a hit, never sits at that ceiling, and is at 85% or more for less than half a fight',()=>{
  const cands=[[['ct','ow'],[61,30]],[['ct','rf'],[61,30]],[['ow','ct'],[61,30]],[['rf','ct'],[61,30]],[['ow','rf'],[61,30]],[['rf','ow'],[61,30]],[['ct'],[91]],[['ow'],[91]],[['rf'],[91]],[['ct','ow','rf'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const town of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,town)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  /* seeded fights: every hit on him that removed HP or shield, against its size before his defences; and each tick a reference hit (an enemy basic attack from
     whoever attacks him, else the nearest enemy, not a crit): what the skill slot, glyphs, Fired Clay, armour / magic resist and his talent group would leave of it */
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="hobb"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="hobb"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1)*((u.pass&&u.pass.warden&&u.wardenStk)?1-wardenCut(u):1);'+
    '    const kp=k*defMul(s,u,"phys")*(T?T.fn.drK(T.s.api,T,u,s,"phys",false):1), km=k*defMul(s,u,"magic")*(T?T.fn.drK(T.s.api,T,u,s,"magic",false):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=list=>{ VMX('for(const k in __dr) __dr[k]=0'); const sn=snaps(['vael','sylthaine','vireo','vex','hobb'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>40&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune');
    assert.ok(d.te85<0.5*d.t,'at 85% or more for less than half of his time in the fights ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
