'use strict';
/* Dandra's talents as data on the mechanics layer (talents-mech/dandra.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched
   off for one action (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Dandra, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) ...; A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5). Every lab unit is held (stunned).
   Bodies are about 2 m: A0 is about 1.5 m from her body to body, F0 and F1 about 1.5 m from each other.
   Run: node --test tests/talents-mech-dandra.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='dandra', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const free=x=>{ x.stunned=0; x.speed=0; x.level=1; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));
const gapC=(L,a,g)=>g+V.bodyR(L.v)+V.bodyR(a);
const HA=VMX('(u,t,lo,hi,lv)=>dandraHealAmt(u,t,lvRange(lo,hi,lv))');
const seedAmt=(v,a)=>HA(v,a,0.10,0.30,(v.skillLv&&v.skillLv[1])||1), callAmt=(v,a)=>HA(v,a,0.05,0.15,(v.skillLv&&v.skillLv[0])||1);
const healed=(a,f,fn)=>{ a.hp=a.maxHp*f; const h=a.hp; fn(); return a.hp-h; };
const seed=(L,a,f)=>healed(a,f,()=>V.cast(L.v,'green'));
const MAG=(s,t)=>VMX('(s,t)=>defMul(s,t,"magic")')(s,t), AP=s=>(s.apow||0)*((s.dmgBuffT>0)?(s.dmgBuffMul||1):1);
const noDots=x=>{ if(x.dots) x.dots.length=0; };
const bees=L=>(L.T.s.bz||[]);
const lampOn=(L,x)=>mark(L,x,'lamp');

test('Dandra: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['pb_1_1','tb_1_2','gl_1_4','pb_13_2','tb_13_3','gl_13_3']) assert.ok(FXN.mech(H).talents[id],id);
  for(const id of ['pb_3_4','pb_11_4','pb_3_3','tb_3_4','tb_7_4','tb_12_1','gl_3_2','gl_6_4','gl_1_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Dandra: her real kit, as the talents read it - Seedlight, Drowsy Sting (stung, then a sleep a hit breaks), The Swarm Moves On, Queen\'s Call',()=>{
  plain({foes:3,allies:2},P=>{ const {v,A,F}=P, a=A[0];
    assert.ok(v.pass&&v.pass.contagion,'her passive');
    const g=seed(P,a,0.5); near(g,seedAmt(v,a),'Seedlight heals the most wounded ally: its max HP x (10% .. 30% by level) + 30% AP + 50% healing-power rating');
    const h=a.hots[a.hots.length-1]; near(h.hps*h.remaining,g*0.5,'then half that again over 6 s'); assert.equal(h.remaining,6);
    const f=F[0]; free(f); V.cast(v,'blue',f); near(f._stungT,6,'Drowsy Sting stings for 6 s'); const d=f.dots.find(x=>x.color==='#f2d84a'); assert.ok(d,'and poisons'); assert.equal(d.remaining,4,'for 4 s');
    assert.ok(f._contagion,'with her passive\'s flags');
    V.cast(v,'blue',f); near(f.stunned,V.cap('stunned'),'stung again: asleep, at the stun ceiling (the sleep table\'s 5 s x 0.7 = 3.5 s, cut to 2.8 s)'); near(V.cap('stunned'),2.8,'',1e-9); near(f._sleepT,5,'(_sleepT keeps the uncut 5 s)');
    V.hit(v,f,1,{kind:'true'}); assert.equal(f.stunned,0,'any hit wakes it, hers too');
    const b=A[1]; b.hp=b.maxHp*0.5; a.hp=a.maxHp*0.5; const hb=b.hp, ha=a.hp; V.cast(v,'ult'); near(b.hp-hb,callAmt(v,b),'Queen\'s Call heals every ally'); near(a.hp-ha,callAmt(v,a),''); assert.ok(b.energy>=20,'and gives energy');
  });
});

/* ============================== PETAL BY PETAL ============================== */
test('Dandra / Petals: Fold a Petal, Thick Petals, Quick Regrowth, Petal Store, Dandelion Down, Little Sacrifice, Still Standing',()=>{
  const L=lab(H,S(['pb_1_1','pb_2_1','pb_4_1','pb_6_1','pb_7_1','pb_8_1','pb_11_1']),{allies:2,big:true}), {v,A}=L, a=A[0]; const m0=v.maxHp, hp0=v.healPowMul||1;
  assert.equal(stack(L,'petal'),6,'6 Petals'); seed(L,a,0.5); near(a.shield,a.maxHp*0.015*5*1.05,'a Petal over its ally: 1.5% x 5 of its max HP (Petal Store 1% x 5 larger)'); near(a.shieldT,6+3,'for 6 + 1 x 3 s',1e-9);
  assert.equal(stack(L,'petal'),5); V.step(1); near(v.maxHp,m0*0.99,'each missing Petal: 1% of her max HP'); near(v.healPowMul,hp0*1.03,'Little Sacrifice: 1% x 3 healing power each');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'Still Standing: not with 5 Petals');
  setStack(L,'petal',3); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.075),'with 3 or fewer: 1.5% x 5 less'); setStack(L,'petal',5);
  v.hp=v.maxHp*0.5; const h=v.hp; secs(5.8); assert.equal(stack(L,'petal'),5,'not back yet'); secs(0.3); assert.equal(stack(L,'petal'),6,'Quick Regrowth and Petal Store: it regrows 10 - 3 - 1 = 6 s after');
  void h; near(v.hp/v.maxHp,0.55,'Dandelion Down: 1% x 5 of her max HP as it regrows (and her max HP is back: the HP she has keeps its share)',1e-9);
  a.shield=0; a.shieldT=0; seed(L,a,0.5); a.shield=a.shield*0.5; const sh=a.shield; seed(L,a,0.5); near(a.shield,sh*2,'one Petal shield per ally: a new one tops it back up (not added)');
});

test('Dandra / Her Own Dress, Last One Open, Not a Close Call',()=>{
  const L=lab(H,S(['pb_1_1','pb_2_1','pb_3_1','pb_12_3','pb_9_1']),{allies:2,big:true}), {v,A}=L, a=A[0], b=A[1], size=x=>x.maxHp*0.075;
  setStack(L,'petal',2); b.hp=b.maxHp*0.9; seed(L,a,0.5); near(a.shield,size(a)); a.shield*=0.4;
  const pb=plainHit(L,()=>healed(b,0.4,()=>V.cast(v,'green'))); b.shield=0; b.shieldT=0;
  setStack(L,'petal',1); const gb=seed(L,b,0.4); assert.equal(stack(L,'petal'),0,'the last Petal');
  near(a.shield,size(a),'Last One Open: every Petal shield still holding is full again'); assert.ok(win(L,'loo'));
  near(gb,pb,'(this heal itself: before)'); b.shield=0; b.shieldT=0; const hv=v.hp; const g2=seed(L,b,0.4); near(g2,pb*1.15,'then her heals 5% x 3 stronger for 5 s');
  near(hv-v.hp,v.maxHp*0.05,'Her Own Dress: no Petal left, it costs her 5% of her max HP',1e-6); near(b.shield,size(b)*2,'and that shield is twice as large');
  secs(5.1); near(seed(L,b,0.4),pb,'Last One Open: 5 s');
  b.hots.length=0; b.hp=b.maxHp*0.25; const h=b.hp; V.hit(L.F[0],b,b.shield+10,{kind:'true'}); V.step(2); near(b.hp-(h-10),b.maxHp*0.10,'Not a Close Call: its Petal broke below 30%: it heals 10% of its max HP',1e-6);
  b.shield=0; b.shieldT=0; seed(L,b,0.4); b.hots.length=0; b.hp=b.maxHp*0.25; const h2=b.hp; secs(9.5); assert.ok(!mark(L,b,'petal')); near(b.hp,h2,'not when its Petal simply ran out of time');
});

test('Dandra / Petal in the Light (LINK) and Petal Ward',()=>{
  const L=lab(H,S(['pb_1_1','pb_n1','pb_10_1']),{allies:2,big:true}), {v,A,F}=L, a=A[0], b=A[1];
  seed(L,a,0.5); near(a.shield,a.maxHp*0.075,'without Lift the Lantern: the plain size');
  near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*0.97,'an ally under a Petal takes 3% less'); near(hitOn(L,b,1000),plainHit(L,()=>hitOn(L,b,1000)),'not without');
  a.fearT=0; V.cc(F[0],a,'fearT',2); near(a.fearT,2*V.ccNerf*0.88,'Petal Ward: a control on it 4% x 3 shorter while the Petal holds',1e-9); b.fearT=0; V.cc(F[0],b,'fearT',2); near(b.fearT,2*V.ccNerf,'',1e-9);
  const L2=lab(H,S(['pb_1_1','pb_n1','gl_1_4']),{allies:2,big:true}), c=L2.A[0]; c.hp=c.maxHp*0.3; V.step(1); assert.ok(lampOn(L2,c),'in Lamplight');
  V.cast(L2.v,'green'); near(c.shield,c.maxHp*0.075*1.3,'with Lift the Lantern: a Petal on an ally in Lamplight is 30% larger'); c.hots.length=0; c.hp=c.maxHp*0.3; secs(8); assert.ok(c.shield>0&&mark(L2,c,'petal'),'and does not run out while Lamplight stays');
  c.hp=c.maxHp*0.9; secs(0.5); assert.ok(!mark(L2,c,'petal'),'then it does');
});

test('Dandra / Seedlight: Bright Bell, Bell Glow, Kept Alive, One at a Time, Goes to the Worst, Seedlight Bloom; Brave Anyway and Angry Hive',()=>{
  const L=lab(H,S(['pb_1_3','gl_2_2','tb_9_4','pb_5_2','pb_6_2','pb_9_3','pb_6_4','tb_6_4']),{allies:1,big:true}), {v,A}=L, a=A[0];
  const k=f=>seed(L,a,f)/plainHit(L,()=>seed(L,a,f));
  near(k(0.6),1+0.10+0.09+0.10+0.25+0.08-0.08,'2% x 5, 3% x 3, 2% x 5, One at a Time 25%, Brave Anyway 4% x 2, Angry Hive -4% x 2');
  near(k(0.45),1.54+0.15,'Seedlight Bloom: below 50%, 3% x 5 more'); near(k(0.25),1.69+0.12,'Goes to the Worst: below 30%, 4% x 3 more');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*1.06,'Brave Anyway: she takes 3% x 2 more');
  a.hots.length=0; seed(L,a,0.6); const h=a.hots[a.hots.length-1], p=a.hp; secs(1.05); near(a.hp-p,h.hps*1.54,'its heal over time too (each tick)',1e-6);
});

test('Dandra / cooldowns: Gentle Light, Patient Light, Small Sting, Busy Bees; Lighter Load and Hollow Stem on both skills',()=>{
  const L=lab(H,S(['pb_5_1','gl_5_4','pb_8_3','tb_5_2']),{}); near(FX.cd(L.v,'green',8),7,'Seedlight 0.1 s x 5 and x 5 sooner'); near(FX.cd(L.v,'blue',6),5,'Drowsy Sting 0.1 s x 5 and x 5 sooner');
  const L2=lab(H,S(['pb_10_3','gl_11_1']),{}); near(FX.cd(L2.v,'green',8),8*0.95*0.95,'1% x 5 faster each'); near(FX.cd(L2.v,'blue',6),6*0.95*0.95,'');
});

test('Dandra / Seedlight\'s heal over time: Gold Light (a part tick), Everyone a Little with Share the Light, Slower Dying',()=>{
  const L=lab(H,S(['pb_2_3','pb_5_3','pb_6_3']),{allies:2,big:true}), {A}=L, a=A[0], b=A[1]; at(L,b,V.bodyR(a)+V.bodyR(b)+0.5,-5.5);
  b.hp=b.maxHp*0.7; seed(L,a,0.5); const h=a.hots[a.hots.length-1]; assert.equal(h.remaining,8,'Gold Light: 6 + 0.4 x 3 s: 8 ticks, the last a part one'); near(h._talF,0.2,'',1e-9);
  const g=b.hots[b.hots.length-1]; assert.ok(g,'Everyone a Little: an ally within 3 m of its target gets it too'); near(g.hps,h.hps*0.345,'at 30% strength, Share the Light 5% x 3 stronger');
  const pa=a.hp, pb=b.hp; secs(9); near(a.hp-pa,h.hps*7.2,'7 whole ticks and 0.2 of one',1e-6); near(b.hp-pb,g.hps*7.2,'',1e-6);
  const L2=lab(H,S(['gl_3_4']),{allies:1,big:true}), c=L2.A[0]; c.hp=c.maxHp*0.3; V.step(1); assert.ok(lampOn(L2,c)); V.cast(L2.v,'green'); c.hp=c.maxHp*0.3; const q=c.hots[c.hots.length-1], p=c.hp; secs(3.02);
  near(c.hp-p,q.hps*6,'Slower Dying: on an ally in Lamplight it ticks twice as fast',1e-6);
});

test('Dandra / Cold Morning: Remember the Frost, Long Memory of Cold, Never Close Again, Call of the Cold, Frost Remembered',()=>{
  const L=lab(H,S(['pb_2_2','pb_4_2','pb_12_1','pb_7_2','pb_9_2']),{allies:2,big:true}), {v,A}=L, a=A[0], b=A[1];
  const drop=()=>{ a.hp=a.maxHp*0.35; V.step(1); a.hp=a.maxHp*0.25; V.step(1); };
  drop(); assert.equal(stack(L,'cm'),1,'an ally drops below 30%: 1 Cold Morning'); V.step(3); assert.equal(stack(L,'cm'),1,'(once per drop)'); drop(); assert.equal(stack(L,'cm'),2); a.hp=a.maxHp*0.35; V.step(1); a.hp=a.maxHp*0.305; V.step(1); assert.equal(stack(L,'cm'),2,'(30.5% is not below 30%)');
  setStack(L,'cm',7); drop(); drop(); assert.equal(stack(L,'cm'),8,'Long Memory of Cold: up to 5 + 1 x 3');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.16),'Never Close Again: 1% x 2 less per stack (16% at 8)');
  const pa=plainHit(L,()=>seed(L,a,0.5)); near(seed(L,a,0.5),pa*1.40,'Remember the Frost: her heals 1% x 5 stronger per stack');
  setStack(L,'cm',4); const pq=plainHit(L,()=>healed(a,0.5,()=>V.cast(v,'ult'))); setStack(L,'cm',4);
  near(healed(a,0.5,()=>V.cast(v,'ult')),pq*1.20+a.maxHp*4*(0.02+0.015),'Call of the Cold: Queen\'s Call spends them, 2% + 0.3% x 5 of max HP more each (and the Frost\'s 20%)',1e-6); assert.equal(stack(L,'cm'),0,'all spent');
  setStack(L,'cm',3); V.wave(); V.step(1); assert.equal(stack(L,'cm'),0,'kept for the wave');
});

test('Dandra / Warmth: Kept Warm, Close Together, Warm Field, Snug, Hearth; Warm Hands',()=>{
  const L=lab(H,S(['pb_4_4','pb_5_4','pb_12_4','pb_7_4','pb_10_4','pb_8_4']),{allies:3,foes:1,big:true,cold:true}), {v,A}=L, a=A[0]; at(L,L.F[0],0,25);
  const ang=(x,g,deg)=>{ const c=gapC(L,x,g), t=deg*Math.PI/180; at(L,x,c*Math.cos(t),c*Math.sin(t)); };
  ang(A[1],4.3,0); ang(A[2],4.8,90); V.step(1); a.energy=0;
  secs(0.45); assert.equal(ust(L,a,'warm'),0); secs(0.1); assert.equal(ust(L,a,'warm'),1,'Close Together: 1 Warmth every 0.5 s (20% x 5 faster)');
  secs(2.1); assert.equal(ust(L,a,'warm'),5,'max 5'); assert.ok(ust(L,A[1],'warm')>=4,'Warm Field: 3 + 0.5 x 3 m (4.3 m away)'); assert.equal(ust(L,A[2],'warm'),0,'not 4.8 m away');
  near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*(1-0.012*5),'Kept Warm: 0.4% x 3 less per Warmth');
  a.hp=a.maxHp*0.5; const p0=a.hp; V.heal(a,1e7); const g=a.hp-p0; a.hp=a.maxHp*0.5; plainHit(L,()=>V.heal(a,1e7)); near(g,(a.hp-a.maxHp*0.5)*1.05,'Snug: at 5 Warmth, 1% x 5 more healing',1e-6);
  a.hp=a.maxHp*0.5; let h=a.hp, n=0; while(a.hp===h&&n++<40) V.step(1); h=a.hp; secs(1.0); near(a.hp-h,a.maxHp*0.006*1.05,'Warm Hands: 0.3% x 2 of its max HP each second (Snug makes it 5% more)',1e-6);
  const e=a.energy; secs(3.0); assert.ok(a.energy-e>=2.99&&a.energy-e<=6.01,'Hearth: 1 x 3 energy every 3 s: '+(a.energy-e));
  at(L,a,0,-30); secs(2.9); assert.ok(ust(L,a,'warm')>0,'lost 3 s after it leaves'); secs(0.2); assert.equal(ust(L,a,'warm'),0);
});

test('Dandra / her per-second heals stay under the game\'s regeneration cap (1.2% of max HP a second): Warm Hands with Two Lights; Tucked In',()=>{
  const L=lab(H,S(['pb_4_4','pb_8_4','gl_5_2','gl_6_2','gl_1_4']),{allies:1,big:true}), a=L.A[0]; a.hp=a.maxHp*0.3; setUst(L,a,'warm',5); V.step(2); assert.ok(mark(L,a,'lampR'));
  let h=a.hp, n=0; while(a.hp===h&&n++<40){ setUst(L,a,'warm',5); V.step(1); } h=a.hp; secs(1.0); near(a.hp-h,a.maxHp*0.012,'0.6% + 0.9% a second: held at 1.2%',1e-6);
  const L2=lab(H,S(['gl_1_1']),{allies:1,big:true}), v=L2.v; v.hp=v.maxHp*0.5; let g=v.hp; n=0; while(v.hp===g&&n++<40) V.step(1); g=v.hp; secs(1.0); near(v.hp-g,v.maxHp*0.009,'Tucked In: 0.3% x 3 a second while nobody is in Lamplight',1e-6);
  L2.A[0].hp=L2.A[0].maxHp*0.3; secs(1.1); g=v.hp; secs(1.0); near(v.hp,g,'not while an ally is in it');
});

test('Dandra / Three Bees Alive (SIGNATURE): every Petal over the ally dropping under 25% at double size, every ally to 5 Warmth, 5 Cold Morning for 8 s; once per wave',()=>{
  const L=lab(H,S(['pb_13_2','pb_1_1','pb_4_4','pb_2_2']),{allies:2,big:true}), {v,A}=L, a=A[0];
  setStack(L,'petal',4); a.hp=a.maxHp*0.28; V.step(1); a.hp=a.maxHp*0.20; V.step(1);
  near(a.shield,a.maxHp*0.075*2*4,'4 Petals at double size'); assert.equal(stack(L,'petal'),0,'all of them'); assert.equal(ust(L,A[1],'warm'),5,'every ally 5 Warmth'); assert.ok(win(L,'tba'));
  const pa=plainHit(L,()=>seed(L,a,0.5)); near(seed(L,a,0.5),pa*1.25,'5 Cold Morning held (1% x 5 each)');
  secs(8.1); near(seed(L,a,0.5),pa*(1+0.05*stack(L,'cm')),'for 8 s');
  setStack(L,'petal',3); a.shield=0; a.hp=a.maxHp*0.28; V.step(1); a.hp=a.maxHp*0.20; V.step(1); near(a.shield,0,'once per wave');
});

test('Dandra / Queen\'s Petals and Full Bloom: a free Petal over every ally (3% x 5 larger) and every Petal back',()=>{
  const L=lab(H,S(['pb_11_2','pb_12_2','pb_1_1']),{allies:2,big:true}), {v,A}=L; setStack(L,'petal',2); V.cast(v,'ult');
  for(const x of [v].concat(A)) near(x.shield,x.maxHp*0.075*1.15,'every ally (her too)'); assert.equal(stack(L,'petal'),6,'every Petal regrows at once');
  secs(11); assert.equal(stack(L,'petal'),6,'(none comes back later as extra)');
});

/* ============================== THE THREE BEES ============================== */
test('Dandra / Bees: Three Bees, Quick Wings, Little Wings, Bee Dance, Small and Fierce, Honest Work',()=>{
  const L=lab(H,S(['tb_1_2','tb_2_2','tb_1_1','tb_7_1','tb_11_1','tb_8_2']),{foes:2,big:true}), {v,F}=L, f=F[0], i0=v.atkInterval;
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'all Bees home: no Little Wings');
  V.cast(v,'blue',f); noDots(f); assert.equal(stack(L,'bee'),2,'Drowsy Sting sends a Bee'); assert.ok(mark(L,f,'bee'),'to its enemy'); v.energy=0;
  V.step(1); near(v.atkInterval,i0/1.05,'Bee Dance: 1% x 5 faster per Bee out');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.94*0.925,'Little Wings 2% x 3 while a Bee is away; Small and Fierce 1.5% x 5 from the enemy with a Bee');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*0.94,'(another enemy: Little Wings only)');
  const l=lost(f,()=>secs(1.0)); near(l,AP(v)*0.30*MAG(v,f),'it stings 6% x 5 of her ability power each second (magic)',1e-6);
  secs(4.0); assert.equal(bees(L).length,1); v.energy=0; secs(1.1); assert.equal(bees(L).length,0,'6 stings, then it flies home'); assert.equal(stack(L,'bee'),3,'Quick Wings: 3 - 1 x 3 s: home at once');
  near(v.energy,5,'Honest Work: 1 x 5 energy',1e-9); V.step(1); near(v.atkInterval,i0,''); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'');
});

test('Dandra / Pollen: Gold Dust, Rich Pollen, Bee Bread, Golden Dust, Pollen Cloud',()=>{
  const L=lab(H,S(['tb_1_2','tb_4_4','tb_5_4','tb_12_4','tb_8_4','tb_10_4']),{foes:2,allies:2,big:true}), {v,A,F}=L, a=A[0], b=A[1];
  V.cast(v,'blue',F[0]); secs(8.9); assert.equal(stack(L,'pol'),0,'not yet: 6 s of stings, then 3 s home'); secs(0.2); assert.equal(stack(L,'pol'),1,'each Bee home brings 1 Pollen'); assert.equal(stack(L,'bee'),3);
  setStack(L,'pol',9); assert.equal(L.T.st.pol.max,6,'Rich Pollen: up to 3 + 1 x 3'); setStack(L,'pol',6);
  at(L,b,V.bodyR(a)+V.bodyR(b)+0.5,-5.5); b.hp=b.maxHp*0.8; a.shield=0;
  const p=plainHit(L,()=>seed(L,a,0.5)); a.shield=0; b.hp=b.maxHp*0.8; const pb=b.hp; setStack(L,'pol',6);
  near(seed(L,a,0.5),p*(1+6*(0.15+0.02)),'Seedlight spends all Pollen: 3% x 5 + Bee Bread 1% x 2 more each'); assert.equal(stack(L,'pol'),0);
  near(a.shield,a.maxHp*0.04*6,'Golden Dust: 2% x 2 of its max HP per Pollen as a shield'); near(b.hp-pb,b.maxHp*0.06,'Pollen Cloud: 3 or more spent, allies within 3 m of its target heal 2% x 3',1e-6);
  setStack(L,'pol',2); b.hp=b.maxHp*0.8; const q=b.hp; seed(L,a,0.5); near(b.hp,q,'not with 2');
});

test('Dandra / All Three; Stay Close with Guard Bees; Spread Out with Wide Meadow; Meadow Strength',()=>{
  const L=lab(H,S(['tb_1_2','tb_2_2','tb_3_2']),{foes:3,big:true}), {v,F}=L; V.cast(v,'blue',F[0]); assert.equal(stack(L,'bee'),0,'All Three: all 3 to the same enemy'); assert.equal(bees(L).filter(b=>b.t===F[0]).length,3);
  V.cast(v,'blue',F[1]); assert.equal(bees(L).length,3,'(none home: none sent)');
  const L1=lab(H,S(['tb_1_2','tb_2_2','tb_3_2']),{foes:3,big:true}); setStack(L1,'bee',2); V.cast(L1.v,'blue',L1.F[0]); assert.equal(stack(L1,'bee'),1,'only when all 3 are home');
  const L2=lab(H,S(['tb_1_2','tb_5_1','tb_6_1']),{foes:3,allies:2,big:true}), w=L2.v, a=L2.A[1]; a.hp=a.maxHp*0.2; at(L2,L2.F[2],2,-12);
  V.cast(w,'blue',L2.F[0]); assert.equal(L2.T.s.bz[0].t,L2.F[2],'Stay Close: to the enemy nearest the most hurt ally');
  near(hitOn(L2,a,1000,{src:L2.F[2]}),plainHit(L2,()=>hitOn(L2,a,1000,{src:L2.F[2]}))*0.94,'Guard Bees: that enemy deals 2% x 3 less to the most hurt ally'); near(hitOn(L2,L2.A[0],1000,{src:L2.F[2]}),plainHit(L2,()=>hitOn(L2,L2.A[0],1000,{src:L2.F[2]})),'not to another');
  noDots(L2.F[2]); const s1=lost(L2.F[2],()=>secs(1.0)); near(s1,AP(w)*0.30*1.15*MAG(w,L2.F[2]),'and stings 15% harder',1e-6);
  const L3=lab(H,S(['tb_1_2','tb_5_3','tb_6_3','tb_3_1']),{foes:3,big:true}), z=L3.v, F3=L3.F, i0=F3[0].atkInterval; V.cast(z,'blue',F3[0]); V.cast(z,'blue',F3[0]);
  assert.equal(L3.T.s.bz[1].t,F3[1],'Spread Out: never to an enemy that already has a Bee (the nearest one without)'); V.step(1); near(F3[0].atkInterval,i0/0.91,'Wide Meadow: an enemy with a Bee attacks 3% x 3 slower',1e-6);
  for(const f of F3) noDots(f); const p=lost(F3[1],()=>secs(1.0)); near(p,AP(z)*0.30*MAG(z,F3[1]),'',1e-6);
  F3[1].slow=5; const q=lost(F3[1],()=>secs(1.0)); near(q,AP(z)*0.30*1.10*MAG(z,F3[1]),'Meadow Strength: 2% x 5 harder on a slowed enemy',1e-6); F3[1].slow=0;
  secs(4.05); const r=lost(F3[1],()=>secs(1.0)); near(r,AP(z)*0.30*0.5*MAG(z,F3[1]),'Spread Out: 0.5 s longer (a half sting)',1e-6); assert.ok(!L3.T.s.bz.some(b=>b.t===F3[1]));
});

test('Dandra / Swollen: Stung Again, Puffed Up, Swelling, Swollen Shut; Burst',()=>{
  const L=lab(H,S(['tb_1_2','tb_2_3','tb_4_3','tb_12_2','tb_8_1']),{foes:2,allies:1,big:true}), {v,A,F}=L, f=F[0], i0=f.atkInterval;
  V.cast(v,'blue',f); assert.equal(ust(L,f,'sw'),1,'Drowsy Sting\'s hit is a sting: 1 Swollen'); secs(1.05); assert.equal(ust(L,f,'sw'),2,'each Bee sting 1 more');
  near(lost(f,()=>V.hit(A[0],f,1000,{kind:'true'})),plainHit(L,()=>lost(f,()=>V.hit(A[0],f,1000,{kind:'true'})))*(1+2*0.035),'it takes 0.6% x 5 + Swelling 0.1% x 5 more per stack from her team');
  near(lost(f,()=>V.hit(v,f,1000,{kind:'true'})),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000,{kind:'true'})))*(1+2*0.035),'from her too');
  secs(3.0); assert.equal(ust(L,f,'sw'),5,'max 5'); V.step(1); near(f.atkInterval,i0/0.94,'Swollen Shut: at 5, attacks 2% x 3 slower',1e-6);
  const L2=lab(H,S(['tb_2_3','tb_4_3']),{foes:2}); V.cast(L2.v,'blue',L2.F[0]); secs(7.9); assert.equal(ust(L2,L2.F[0],'sw'),1,'Puffed Up: 5 + 1 x 3 s'); secs(0.2); assert.equal(ust(L2,L2.F[0],'sw'),0);
  const L3=lab(H,S(['tb_2_3','tb_9_1','tb_8_1']),{foes:3,big:true}), w=L3.v, G=L3.F; setUst(L3,G[0],'sw',4); const m=x=>AP(w)*0.40*MAG(w,x);
 const h1=G[1].hp, h2=G[2].hp; V.cast(w,'blue',G[0]); near(h1-G[1].hp,m(G[1]),'Burst: at 5 it bursts, every enemy within 2 m takes 40% of her ability power (magic)',1e-6); near(ust(L3,G[0],'sw'),0,'the stacks clear');
  assert.equal(G[2].hp,h2,'not one farther away');
});

test('Dandra / Drowsy Sting: Sharp Stinger, Venom, Angry Hive',()=>{
  const L=lab(H,S(['tb_1_4','tb_6_2','tb_6_4']),{foes:2,big:true}), {v,F}=L, f=F[0];
  const hit=plainHit(L,()=>lost(f,()=>V.cast(v,'blue',f))); noDots(f); f._stungT=0; const pd=plainHit(L,()=>{ V.cast(v,'blue',f); return lost(f,()=>secs(1.02)); }); noDots(f); f._stungT=0;
  near(lost(f,()=>V.cast(v,'blue',f)),hit*1.15*1.12,'its hit: 3% x 5 and Angry Hive\'s 6% x 2'); near(lost(f,()=>secs(1.02)),pd*1.15*1.15*1.12,'its poison: 3% x 5, Venom 3% x 5, Angry Hive',1e-6);
});

test('Dandra / sleep: Heavy Sleep, Buzzing Ears, Sting of Mercy and Deep Sleep',()=>{
  const L=lab(H,S(['tb_1_2','tb_4_1','tb_10_3','gl_7_3','gl_9_3']),{foes:2,big:true}), {v,F}=L, f=F[0]; free(f);
  V.cast(v,'blue',f); const d=f.dots.find(x=>x.color==='#f2d84a'); assert.equal(d.remaining,6,'Sting of Mercy: its poison lasts the whole 6 s it is stung');
  V.cast(v,'blue',f); near(f.stunned,2.8*1.09+0.3+0.3,'asleep: the real 2.8 s, Buzzing Ears 3% x 3 of it (the enemy has a Bee), Heavy Sleep 0.1 s x 3, Deep Sleep 0.06 s x 5, in full',1e-9);
  V.hit(v,f,1,{kind:'true'}); assert.ok(f.stunned>2,'Sting of Mercy: her own hit does not wake it'); V.hit(F[1],f,1,{kind:'true'}); assert.equal(f.stunned,0,'another unit\'s does');
  const L2=lab(H,S(['tb_4_1']),{foes:2}), g=L2.F[0]; free(g); V.cast(L2.v,'blue',g); V.cast(L2.v,'blue',g); near(g.stunned,2.8+0.3,'Heavy Sleep alone (no Bee, no Buzzing Ears)',1e-9);
  V.hit(L2.v,g,1,{kind:'true'}); assert.equal(g.stunned,0,'without Sting of Mercy her hit wakes it');
  const L3=lab(H,S(['tb_10_3']),{foes:2}), k=L3.F[0]; free(k); V.cast(L3.v,'blue',k); L3.T.s.bz=[]; V.cast(L3.v,'blue',k); near(k.stunned,2.8,'Buzzing Ears: only on an enemy with a Bee',1e-9); assert.equal(g.dots.find(x=>x.color==='#f2d84a').remaining,4,'and the poison is 4 s');
});

test('Dandra / Drowsy Lantern (PICK ONE): the sting goes to the enemy attacking the ally in Lamplight, its sleep 0.6 s longer; Sleep Now',()=>{
  const L=lab(H,S(['gl_5_3','gl_6_3','gl_1_4']),{foes:3,allies:1}), {v,A,F}=L, a=A[0]; a.hp=a.maxHp*0.3; V.step(1); assert.ok(lampOn(L,a)); F[0].target=v; F[1].target=v; F[2].target=a;
  const t=FX.skillTgt(v,'drowsy',F[0],Object.assign({},v.blueAb)); assert.equal(t,F[2],'to the enemy whose target is the ally in Lamplight');
  const g=F[2]; free(g); g.energy=50; V.cast(v,'blue',g); const e1=g.energy; V.cast(v,'blue',g); near(g.stunned,2.8+0.6,'its sleep 0.6 s longer, in full',1e-9); near(g.energy,e1+(e1-50)-9,'Sleep Now: it loses 3 x 3 energy (beside what the hit gives it)',1e-9);
  for(const f of F){ f._stungT=0; f.stunned=0; } V.step(1); v.target=F[0]; F[0].target=v; F[1].target=v; F[2].target=a; const gh=VMX('groundHazards'); assert.ok(VMX('deliverLaunch')(v,'drowsy',Object.assign({},v.blueAb)),'(the game launches the shot)'); gh[gh.length-1].run();
  assert.ok(F[2]._stungT>0&&!(F[0]._stungT>0),'the own launch of the game sends the shot there (the skillTgt line)'); F[2].stunned=1e6; F[0].stunned=1e6;
  a.hp=a.maxHp; V.step(2); assert.equal(FX.skillTgt(v,'drowsy',F[0],Object.assign({},v.blueAb)),F[0],'nobody in Lamplight: her own target');
});

test('Dandra / Queen\'s Stingers with Royal Swarm; The Hive Remembers (SIGNATURE)',()=>{
  const L=lab(H,S(['tb_1_2','tb_11_3','tb_12_3']),{foes:3,big:true}), {v,F}=L; setUst(L,F[1],'sw',3); V.cast(v,'blue',F[0]);
  V.cast(v,'ult'); assert.equal(bees(L).filter(b=>b.t===F[1]&&b.kind==='royal').length,3,'every Bee to the enemy with the most Swollen'); assert.equal(stack(L,'bee'),0); assert.ok(!bees(L).some(b=>b.t===F[0]),'(the one away flies there too)');
  for(const f of F) noDots(f); near(lost(F[1],()=>secs(1.0)),3*AP(v)*0.30*1.15*MAG(v,F[1]),'Royal Swarm: they sting 3% x 5 harder',1e-6);
  secs(5.1); assert.equal(stack(L,'bee'),0); secs(3.0); assert.equal(stack(L,'bee'),3,'all 3 home again when they return');
  const L2=lab(H,S(['tb_13_3','tb_2_3','tb_9_1','tb_1_2']),{foes:3,big:true}), w=L2.v, G=L2.F; for(const f of G) free(f);
  V.cast(w,'blue',G[0]); assert.equal(bees(L2).length,1,'no extra bees before Queen\'s Call');
  V.cast(w,'ult'); assert.ok(win(L2,'hive')); V.cast(w,'blue',G[0]); assert.equal(bees(L2).filter(b=>b.kind==='extra').length,3,'for 8 s every Drowsy Sting sends 3 extra bees');
  near(G[1].stunned,1,'every enemy it hits fills to 5 Swollen: it Bursts, and each Burst puts the enemies it hits to sleep 1 s',1e-9); assert.ok((G[1]._sleepT||0)>0,'(a sleep: a hit breaks it)');
  secs(8.1); assert.ok(!win(L2,'hive')); V.cast(w,'blue',G[2]); assert.equal(bees(L2).filter(b=>b.kind==='extra'&&b.t===G[2]).length,0,'8 s');
});

test('Dandra / Moving On Faster with Swarm Hunger: The Swarm Moves On measured body to body, 1 more enemy, its bees count for Swollen and Pollen',()=>{
  let base=null; plain({foes:4},P=>{ V.cast(P.v,'blue',P.F[0]); V.dmg(P.F[0],1e13); secs(0.6); base=P.F[1].dots.filter(d=>d.color==='#f2d84a').length; });
  assert.equal(base,0,'untalented: her passive reaches nobody standing beside the dead enemy (2.6 m centre to centre)');
  const L=lab(H,S(['tb_7_3','tb_9_3','tb_2_3','tb_4_4']),{foes:4,big:true}), {v,F}=L; V.cast(v,'blue',F[0]); const ps=F[0]._plagueDps; V.dmg(F[0],1e13); assert.ok(!F[0].alive);
  const x=F.filter(f=>f!==F[1]&&f.alive&&f.dots.some(d=>d.color==='#f2d84a')); assert.equal(x.length,1,'1 more enemy, at once'); secs(0.6);
  const d=F[1].dots.find(q=>q.color==='#f2d84a'); assert.ok(d&&d._talK==='spread','the bees move on to the enemy beside it (body to body)');
  const l=lost(F[1],()=>secs(1.0)); near(l,VMX('dotTickAmt')(v,F[1],ps*1.15,'magic'),'Swarm Hunger: they sting 3% x 5 harder',1e-6); assert.ok(ust(L,F[1],'sw')>=1,'each sting adds Swollen');
  secs(4.5); assert.ok(stack(L,'pol')>=1,'and they fly home with Pollen');
});

test('Dandra / Bright Eye, Hidden in the Grass, Bellflower Calm, Small but Here (up to 15%; with Petal Ward on her at most 25%)',()=>{
  let r0=0; plain({},P=>{ r0=P.v.range; });
  const L=lab(H,S(['tb_2_4','tb_11_4','gl_8_2','pb_1_4']),{foes:1,big:true}), {v,F}=L; near(v.range,r0*1.09,'Bright Eye: 3% x 3 longer reach');
  near(hitOn(L,v,1000,{kind:'magic'}),plainHit(L,()=>hitOn(L,v,1000,{kind:'magic'}))*0.95*0.95,'1% x 5 less magic damage each (multiplied)'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'not true / physical');
  v.stunned=0; V.cc(F[0],v,'stunned',2); near(v.stunned,2*V.ccNerf*0.85,'Small but Here: 5% x 3 shorter',1e-9);
  const L2=lab(H,S(['pb_1_4','pb_10_1','pb_1_1']),{foes:1,big:true}), w=L2.v; w.hp=w.maxHp*0.5; V.cast(w,'green'); assert.ok(mark(L2,w,'petal'),'a Petal over her');
  w.fearT=0; V.cc(L2.F[0],w,'fearT',2); near(w.fearT,2*V.ccNerf*0.75,'0.85 x 0.88 = 0.748: held at 25% shorter',1e-9);
});

/* ============================== THE GOLD LANTERN ============================== */
test('Dandra / Lamplight: Lift the Lantern, Wide Glow, Lamp Oil, Held Light, Dew, Light Burns Low, Afraid but Here, Little Hope',()=>{
  const L=lab(H,S(['gl_1_4','gl_2_4','gl_10_4','gl_4_4','gl_3_1','gl_6_1','gl_11_4','gl_8_4']),{foes:1,allies:2,big:true}), {v,A,F}=L, a=A[0], b=A[1];
  a.hp=a.maxHp*0.52; b.hp=b.maxHp*0.56; V.step(2); assert.ok(lampOn(L,a),'Wide Glow: below 55%, the most wounded'); assert.ok(!lampOn(L,b),'one ally');
  near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*0.95,'Held Light: 1% x 5 less'); near(hitOn(L,a,a.maxHp*0.2),plainHit(L,()=>hitOn(L,a,a.maxHp*0.2))*0.95*0.90,'a hit over 10% of its max HP: 2% x 5 more cut');
  a.hp=a.maxHp*0.52; V.dot(a,1000,3,1,F[0]); const l=lost(a,()=>secs(1.02)); near(l,1000*(1-0.15-0.03),'damage over time on it 3% x 5 weaker (Lamp Oil 1% x 3 more)',1e-6); a.dots.length=0;
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.925*1.06,'Afraid but Here 1.5% x 5 less while an ally is in Lamplight; Light Burns Low 3% x 2 more');
  a.hp=a.maxHp*0.52; const p=plainHit(L,()=>healed(a,0.52,()=>V.cast(v,'green'))); near(seed(L,a,0.52),p*(1+0.125)*1.10,'Dew: her heals 2.5% x 5 stronger on it; Light Burns Low: it receives 5% x 2 more');
  a.hots.length=0; a.hp=a.maxHp*0.52; V.step(2); assert.ok(lampOn(L,a)); a.hp=a.maxHp*0.6; const h=a.hp; V.step(2); assert.ok(!lampOn(L,a)); near(a.hp-h,a.maxHp*0.06,'Little Hope: it left above 40%: 2% x 3 of its max HP',1e-6);
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*1.06,'');
});

test('Dandra / Do Not Close; Bright Lantern (PICK ONE) and Two Lights',()=>{
  const L=lab(H,S(['gl_9_4','gl_8_4','gl_5_2','gl_6_2','gl_1_4']),{foes:1,allies:3,big:true}), {A,F}=L; A[0].hp=A[0].maxHp*0.3; A[1].hp=A[1].maxHp*0.35; A[2].hp=A[2].maxHp*0.38; for(const a of A) a.target=null; V.step(2);
  assert.ok(lampOn(L,A[0])&&lampOn(L,A[1])&&!lampOn(L,A[2]),'Bright Lantern: the two most wounded');
  assert.equal(A[0].stunned,0,'Do Not Close: an ally in Lamplight cannot be stunned'); V.cc(F[0],A[0],'stunned',2); assert.equal(A[0].stunned,0,''); A[0]._sleepT=3; V.step(1); assert.equal(A[0]._sleepT,0,'or put to sleep');
  assert.ok(A[2].stunned>1,'(not one outside)');
  const L3=lab(H,S(['gl_1_4']),{allies:1,big:true}), c=L3.A[0]; c.hp=c.maxHp*0.405; V.step(2); assert.ok(!lampOn(L3,c),'Lamplight: below 40%'); c.hp=c.maxHp*0.395; V.step(2); assert.ok(lampOn(L3,c));
  const L2=lab(H,S(['gl_5_2','gl_6_2']),{allies:2,big:true}), B=L2.A; B[0].hp=B[0].maxHp*0.3; B[1].hp=B[1].maxHp*0.35; V.step(2); assert.ok(lampOn(L2,B[0])&&lampOn(L2,B[1]));
 let h=B[1].hp, n=0; while(B[1].hp===h&&n++<40) V.step(1); h=B[1].hp; secs(1.0); near(B[1].hp-h,B[1].maxHp*0.009,'Two Lights: both heal 0.3% x 3 a second',1e-6);
});

test('Dandra / Seeds: One Opening, Seed Pouch, Seed Wind, Night Petal, Last Seed; Lucky Seed',()=>{
  const L=lab(H,S(['gl_2_3','gl_4_3','gl_9_2','gl_7_4','gl_12_4']),{allies:1,big:true}), a=L.A[0]; assert.equal(L.T.s.seeds,8,'5 + 1 x 3 Seeds');
  const drop=()=>{ a.hp=a.maxHp*0.25; V.step(1); a.hp=a.maxHp*0.15; V.step(1); };
  drop(); assert.equal(L.T.s.seeds,7,'an ally drops below 20%: a Seed lands'); near(a.shield,a.maxHp*0.05,'Night Petal: a shield of 1% x 5 of its max HP'); near(a.shieldT,3,'for 3 s',0.05);
  const h=a.hp; secs(3.1); near(a.hp-h,a.maxHp*0.10*1.15*3,'2% x 5 of its max HP each second for 3 s, Seed Wind 3% x 5 more',1e-6);
  L.T.s.seeds=1; drop(); const g=a.hp; secs(3.1); near(a.hp-g,a.maxHp*0.10*1.15*2*3,'Last Seed: the last one heals twice as much',1e-6); assert.equal(L.T.s.seeds,0); drop(); const z=a.hp; secs(3.1); near(a.hp,z,'none left: spent Seeds do not come back');
  V.wave(); V.step(1); assert.equal(L.T.s.seeds,0,'(this fight)');
  const L2=lab(H,S(['gl_2_3','gl_10_2']),{allies:1,big:true}), b=L2.A[0]; near(L2.T.P['seed.luck'],0.20,'Lucky Seed: 4% x 5');
  const d2=()=>{ b.hp=b.maxHp*0.25; V.step(1); b.hp=b.maxHp*0.15; V.step(1); }; L2.T.P['seed.luck']=1; d2(); d2(); assert.equal(L2.T.s.seeds,5,'a Seed that wins the roll is not spent');
  L2.T.P['seed.luck']=0; d2(); assert.equal(L2.T.s.seeds,4,'(one that loses it is)');
});

test('Dandra / Late Bloom: Saved for Later, Warm Store, Rich Bloom, Late Summer, Spring Store, Overflowing; Gold Lantern',()=>{
  const L=lab(H,S(['gl_4_1','gl_7_1','gl_5_1','gl_12_1','gl_10_1','gl_8_1']),{allies:2}), {v,A}=L, a=A[0]; for(const x of A){ x.maxHp=x.hp=v.maxHp*2; x.target=null; }
  const g=seed(L,a,0.5); near(stack(L,'bloom'),g*0.15,'5% x 3 of the healing she does is saved'); L.T.s.k.bloom.n=0; const cap=v.maxHp*0.40;
  for(let i=0;i<30;i++) seed(L,a,0.1); near(stack(L,'bloom'),cap,'Warm Store: up to 30% + 2% x 5 of her max HP');
  const p=plainHit(L,()=>seed(L,a,0.5)); near(seed(L,a,0.5),p*1.08,'Overflowing: while it is full, Seedlight 4% x 2 more');
  for(const x of [v].concat(A)){ x.hp=x.maxHp*0.5; x.energy=0; } const b0=stack(L,'bloom'), h0=A[1].hp, pq=plainHit(L,()=>healed(A[1],0.5,()=>V.cast(v,'ult'))); for(const x of [v].concat(A)){ x.hp=x.maxHp*0.5; x.energy=0; }
  setStack(L,'bloom',b0); V.cast(v,'ult'); void h0;
  near(A[1].hp-A[1].maxHp*0.5,pq+b0*1.19/3,'Queen\'s Call spends it, shared among the team, Rich Bloom 2% x 5 and Late Summer 3% x 3 more',1e-4); assert.equal(stack(L,'bloom'),0,'spent');
  const L2=lab(H,S(['gl_12_2','gl_1_4']),{allies:2,big:true}), c=L2.A[0]; c.hp=c.maxHp*0.3; V.step(2); assert.ok(lampOn(L2,c)); V.heal(c,1e8); c.hp=c.maxHp*0.6; V.step(2);
  near(stack(L2,'bloom'),1e8*0.30,'Gold Lantern: an ally that leaves Lamplight alive adds 10% x 3 of the healing it received in it',1e-6);
});

test('Dandra / Spring Store: Late Bloom also gives every ally energy when spent',()=>{
  const L=lab(H,S(['gl_4_1','gl_10_1']),{allies:2}), {v,A}=L; setStack(L,'bloom',100); for(const x of [v].concat(A)) x.energy=0; V.cast(L.v,'ult');
  const qe=VMX('(u)=>Math.round(lvRange(20,35,(u.skillLv&&u.skillLv[0])||1))')(v); near(A[0].energy,qe+3,'1 x 3 energy each, on top of Queen\'s Call\'s own',1e-9);
});

test('Dandra / Queen\'s Lantern and Long Night Light; The Dandelion Opens (SIGNATURE)',()=>{
  const L=lab(H,S(['gl_11_3','gl_12_3']),{allies:2,big:true}), {v,A}=L; V.cast(v,'ult'); V.step(1); assert.ok(lampOn(L,A[0])&&lampOn(L,A[1]),'every ally it heals stands in Lamplight, whatever its HP');
  secs(7.8); assert.ok(lampOn(L,A[1]),'6 + 0.4 x 5 s'); secs(0.3); assert.ok(!lampOn(L,A[1]));
  const L2=lab(H,S(['gl_13_3','gl_4_1','gl_2_3']),{allies:2}), w=L2.v, B=L2.A; B[0].hp=B[0].maxHp*0.9; setStack(L2,'bloom',1e12); V.step(1); const s0=L2.T.s.seeds;
  V.cast(w,'ult'); assert.equal(L2.T.s.seeds,s0-2,'Late Bloom full: every Seed she has left flies, one to each ally'); V.step(1); assert.ok(lampOn(L2,B[0])&&lampOn(L2,B[1]),'the whole team in Lamplight');
  V.dmg(B[0],1e13); assert.ok(B[0].alive&&B[0].hp>=1,'no ally drops below 1 HP'); V.dmg(w,1e13); assert.ok(w.alive,'(nor her)'); secs(3.1); V.dmg(B[0],1e13); assert.ok(!B[0].alive,'for the first 3 s');
  secs(4.6); assert.ok(lampOn(L2,B[1]),'8 s'); secs(0.5); assert.ok(!lampOn(L2,B[1]));
  setStack(L2,'bloom',1e12); const s1=L2.T.s.seeds; V.cast(w,'ult'); assert.equal(L2.T.s.seeds,s1,'once per fight');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Dandra: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['pb_1_1','pb_2_2','pb_4_4','tb_1_2','tb_2_3','tb_4_4','gl_1_4','gl_2_3','gl_4_1']), TEAM=['vael','sylthaine','vireo','vex','dandra'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]}))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let sw=0, warm=0, lamp=false, petal=false, bee=false;
  for(let i=0;i<3000&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); if((T0.bz||[]).length) bee=true;
    for(const f of units()){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(f.team==='enemy'){ if(o['#sw']&&o['#sw'].until>V.now()) sw=Math.max(sw,o['#sw'].v); } else { if(o['#warm']&&o['#warm'].until>V.now()) warm=Math.max(warm,o['#warm'].v); if(o.lamp) lamp=true; if(o.petal) petal=true; } } }
  assert.ok(petal,'real Seedlights folded Petals'); assert.ok(bee,'real Drowsy Stings sent Bees'); assert.ok(sw>=1,'real stings gave Swollen: '+sw); assert.ok(warm>=1,'real allies near her were kept Warm: '+warm);
  assert.ok(mx.bloom>0,'real heals saved Late Bloom'); assert.ok(lamp||mx.cm>=1,'a real ally went into Lamplight or dropped below 30%');
  determinism(H,TEAM);
});

/* The page sites her talents added or widened (the skillTgt line at a delivered skill's launch, the dot tick's guard (_talDw), the sleep's wake line (Sting of
   Mercy)): with nothing learned, whole seeded fights with Dandra in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Dandra: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['dandra','vael','vireo','sylthaine','gruel'], foeTeam=['bloatus','fritz','dandra','konwu','mirelle'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __dnN={shot:0,sleep:0,wake:0,dot:0}; var __dnD=_doEffectCore, __dnH=_dealDamageCore, __dnP=pushDot;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="dandra"&&type==="drowsy"&&o&&!o._arrived) __dnN.shot++; const t=o&&o._tgtU; const r=__dnD.apply(this,arguments); if(u&&u.key==="dandra"&&type==="drowsy"&&t&&(t._sleepT||0)>0) __dnN.sleep++; return r; };'+
    '_dealDamageCore=function(src,tgt){ const w=tgt&&(tgt._sleepT||0)>0; const r=__dnH.apply(this,arguments); if(w&&!((tgt._sleepT||0)>0)) __dnN.wake++; return r; };'+
    'pushDot=function(t,dps,dur,iv,col){ if(col==="#f2d84a") __dnN.dot++; return __dnP.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__dnN'); console.log('  identity: Drowsy Sting launched '+c.shot+' times (the skillTgt line), slept '+c.sleep+' times, '+c.wake+' sleeps woken by a hit (the wake line), her poison pushed '+c.dot+' times (the dot tick line)');
    assert.ok(c.shot>0&&c.sleep>0&&c.wake>0&&c.dot>0,'every new site was run'); }
  finally{ VMX('_doEffectCore=__dnD; _dealDamageCore=__dnH; pushDot=__dnP;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong. */
const DEF={ pb:['pb_12_1','pb_4_2','pb_2_2','pb_11_1','pb_n1','pb_1_1','pb_3_4','pb_11_4','pb_4_4','pb_10_1','pb_1_4'],
            tb:['tb_1_1','tb_11_1','tb_11_4','tb_3_4','tb_7_4','tb_1_2'],
            gl:['gl_11_4','gl_8_2','gl_6_4','gl_3_2','gl_1_4','gl_4_4','gl_13_3'] };
function defensive(order){ let b={r:{}}; const want=[].concat(...order.map(k=>DEF[k])), meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, goals=[]; for(const id of want) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
    if(id){ b=T.learn(H,b,id,100).build; continue; }
    const open=goals.find(x=>(b.r[x]|0)<meta(x).ranks), tree=open?meta(open).treeIdx:null;
    const pool=T.trees(H).map((tr,i)=>tr.talents.filter(t=>(tree==null||i===tree)&&!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1]||x[2]-y[2]);
    const any=pool[0]||T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her damage-reduction talents true at once (Cold Morning at its most, 3 or fewer Petals and a Petal over her, a Bee away
   and on the attacker, an ally in Lamplight), as a normal and a critical hit, physical and magic. Measured through the engine: what reaches her HP and shield */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:3,allies:3,cold:true}), {v,A,F}=L; V.step(1); const f=F[0];
  if(L.T){ setStack(L,'cm',L.T.st.cm.max); setStack(L,'petal',0); setStack(L,'bee',0); const M=x=>(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={}); M(f).bee={t0:0,until:1e9,v:0}; M(v).petal={t0:0,until:1e9,v:0};
    A[0].hp=A[0].maxHp*0.2; L.T.s.lamp=[A[0]]; }
  v.maxHp=1e5; v.hp=4e4; v.shield=1e12; v.shieldT=999;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Dandra: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[['pb','tb','gl'],['pb','gl','tb'],['tb','pb','gl'],['gl','pb','tb'],['tb','gl','pb']].map(o=>{ const b=defensive(o); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0,all:[],shUp:0,sh0:0,ally:0,allyMax:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.team==="ally"&&!tgt._summon&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); __dr.sh0=tgt.shield||0; tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if((tgt.shield||0)>__dr.sh0){ __dr.shUp++; } else if(raw>0&&l>1e-6*raw){ const d=1-l/raw; if(tgt.key==="dandra"){ __dr.n++; __dr.all.push(d); if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } else { __dr.ally++; if(d>__dr.allyMax) __dr.allyMax=d; } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="dandra"&&u.alive&&u.team==="ally"){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','dandra'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'), all=d.all.slice().sort((x,y)=>x-y), q=p=>all.length?all[Math.min(all.length-1,Math.floor(p*all.length))]:0;
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%);'+
      ' seeded fights: '+d.n+' hits on her, median '+(q(0.5)*100).toFixed(1)+'%, 90th percentile '+(q(0.9)*100).toFixed(1)+'%, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks+
      '; hits on her allies '+d.ally+', the most reduced '+(d.allyMax*100).toFixed(1)+'% (their own kits and talents included)');
    assert.ok(d.n>30&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.equal(d.imm,0,'and she is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
