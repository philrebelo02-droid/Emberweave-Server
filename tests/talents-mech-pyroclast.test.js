'use strict';
/* Pyroclast's talents as data on the mechanics layer (talents-mech/pyroclast.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity with her in the line-up, and Phil's 95% damage-reduction ceiling (worst hit, sustained, the share of a fight at 85% or more).
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Pyroclast, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5).
   Lab units are HELD (stunned 1e6), Pyroclast too; go() lets her think with nothing ready. Lab skill level 10.
   Blazing Orbit is centred on her today and on her target from release v1391 (another branch): every Orbit test puts the enemies it should reach within
   2.8 m of BOTH (the target 2.4 m from her), so the tests hold before and after that fix. Run: node --test tests/talents-mech-pyroclast.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='pyroclast', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const setMk=(L,t,name,dur)=>{ const m=t._talM||(t._talM={}), o=m[L.v.uid]||(m[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on her (true damage unless said)
const hitAl=(L,a,amt,o)=>lost(a,()=>V.hit((o&&o.src)||L.F[0],a,amt||1000,Object.assign({kind:'true'},o||{})));
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; v._recentAtk=1e9; };
const still=f=>{ f.stunned=0; f.fearT=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.ctrlRes=0; };
const castL=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castO=(L,t)=>V.cast(L.v,'blue',t||L.F[0]);
const castC=(L,t)=>V.cast(L.v,'ult',t||L.F[0]);                     // ULT_DEF.fireball alone: it resolves at once, centred on its target
const lashHit=(L,t)=>lost(t,()=>castL(L,t));
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };
const api=L=>L.T.s.api;
const sm10=()=>VMX('skillMul(10)');
const lashDps=v=>(v.apow||0)*0.55*sm10();
const dm=(s,t)=>VMX('defMul')(s,t,'magic')*VMX('elemMul')(s,t);   // a talent's magic damage: the target's resist and the element, as her skill's own hit
const dots=(L,t,tag)=>(t.dots||[]).filter(d=>d._talO===L.v.uid&&(tag==null||d._talK===tag)&&d.remaining>0);
const left=d=>(d.remaining-1+(d._talF!=null?d._talF:1))*(d.interval||1);
const db=(L,t)=>{ const e=L.T.s.pyDb&&L.T.s.pyDb[t.uid]; return e?e.n:0; };
const setDb=(L,t,n,k)=>{ const D=L.T.s.pyDb||(L.T.s.pyDb={}); D[t.uid]={n,k:k==null?99:k}; };
const pk=(L,t)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#pyPk']; return m?m.v:0; };
const scorched=(L,t)=>{ const D=t.dots||[]; return D.some(d=>d._talO===L.v.uid&&/^py[LACFREV]$/.test(d._talK||'')&&d.remaining>0); };
/* one tick of the only DoT on t: the HP (and shield) it took */
const tick1=(L,t)=>{ const h=t.hp+(t.shield||0); for(let i=0;i<80;i++){ V.step(1); const d=h-(t.hp+(t.shield||0)); if(d>0) return d; } return 0; };
const orbAt=(L,f)=>at(L,f,2.4,0);                                     // within 2.8 m of her centre, and it is the Orbit's target (v1391: the centre)
const clk=L=>{ for(const r of (L.T.on.tick||[])) if(r.period&&L.T.s.lim[r.key]) L.T.s.lim[r.key].acc=0; };
const gapM=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/V.METER-V.bodyR(a)-V.bodyR(b);
/* she really swings (Rising Heat is worked out at her swing) */
function swing(L,f){ const v=L.v; v.stunned=0; v.greenCd=v.blueCd=1e9; v.energy=0; v.target=f; v.atkCd=0; v.attackAnim=0; v._castT=0; v._recentAtk=0; v.speed=0;
  let k=0; for(;k<90&&!(v.attackAnim>0);k++) V.step(1); v.stunned=1e6; v.atkCd=1e9; assert.ok(k<90,'she swung'); }

test('Pyroclast: every talent is accounted for - 9 plain stats, 107 with rows, none waiting; renamed talents',()=>{
  accounting(H,[116,9,107,0,0]);
  const M=FXN.mech(H); for(const id of ['db_1_1','er_1_1','nh_1_1','db_13_2','er_13_3','nh_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['db_10_3','db_8_4','db_6_2','er_1_2','er_9_4','er_7_3','nh_4_1','nh_8_4','nh_7_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.equal(T.talent(H,'db_1_1').name,'Ember Debt'); assert.equal(T.talent(H,'er_6_2').name,'Scorch Catch'); assert.equal(T.talent(H,'nh_10_1').name,'Cinderburst');
  assert.ok(/at most 40%/.test(T.talent(H,'nh_1_4').text),'Heat Shimmer names her damage-reduction cap');
});

test('Pyroclast: her real kit, as the talents read it - Ember Lash and its Scorch, Blazing Orbit around its centre, Crownfire, Rising Heat at her swing',()=>{
  plain({foes:5,big:true},P=>{ const {v,F}=P;
    const h0=F[0].hp; castL(P,F[0]); const hit=h0-F[0].hp; near(hit,(v.apow||0)*sm10()*dm(v,F[0]),'Ember Lash: one hit of her ability power x skill level (magic)',1e-6);
    const d=F[0].dots[F[0].dots.length-1]; assert.ok(d&&d.src===v,'its Scorch is pushed at once'); near(d.dps,lashDps(v),'55% of her ability power x skill level a second'); assert.equal(d.remaining,4,'4 ticks'); assert.equal(d.kind,'magic','magic');
    castL(P,F[0]); assert.equal(F[0].dots.filter(x=>x.src===v).length,2,'a second Ember Lash is a NEW DoT (with no talent they never overlap: the cooldown is 6 s)');
    orbAt(P,F[1]); at(P,F[2],4.5,3); const x1=F[1].x, h1=F[1].hp, h2=F[2].hp; castO(P,F[1]);
    assert.ok(F[1].hp<h1,'Blazing Orbit strikes an enemy whose centre is within 2.8 m'); near(F[2].hp,h2,'not one farther'); near((F[1].x-x1)/V.METER,1.5,'and pushes it 1.5 m away from the centre',1e-6);
    const b=F[1].dots[F[1].dots.length-1]; near(b.dps,(v.apow||0)*0.3*sm10(),'its burn: 30% x skill level a second'); assert.equal(b.remaining,3,'for 3 s');
    at(P,F[3],0,3.5); at(P,F[4],0,3.7); const g3=F[3].hp, g4=F[4].hp; castC(P,F[3]); assert.ok(F[3].hp<g3,'Crownfire strikes its centre'); at(P,F[4],0,3.5+3.6); const k4=F[4].hp; castC(P,F[3]); near(F[4].hp,k4,'not an enemy 3.6 m from it (3.55 m centre to centre)');
    for(const f of F) f.dots.length=0; V.dot(F[0],1,9,1,v); V.dot(F[1],1,9,1,F[0]); v.apMul=1; swing(P,F[0]);
    near(v.apMul,1+Math.min(VMX('SKLV.risingheatCap')(VMX('passLv')(v)),0.09*(v.passMul||1)*2),'Rising Heat at her swing: 9% x her passive per enemy carrying ANY DoT (anyone\'s)');
    for(const f of F) f.dots.length=0; V.step(30); near(v.apMul>1?1:0,1,'it stays as it was until her next swing (not worked out each tick)'); });
});

/* ============================== THE DEBT ============================== */
test('Pyroclast / Ember Debt: 1 a second while Scorched (Interest faster), at most 10 (Compound Heat 12), cleared when the Scorch ends (Collector: after 4 s), Called In; abilities deal more per debt',()=>{
  const L=lab(H,S(['db_1_1','db_2_1','db_3_1','db_11_1','db_8_1']),{foes:3,big:true}), {v,F}=L;
  castL(L,F[0]); const n=Math.round(1/V.STEP); V.step(n); near(db(L,F[0]),n*V.STEP*1.3,'Interest: 1 x 1.3 a second while Scorched',1e-6); near(db(L,F[1]),0,'(not Scorched: none)');
  setDb(L,F[0],11.9,0); V.step(5); near(db(L,F[0]),12,'Compound Heat: at most 10 + 0.4 x 5');
  for(let i=0;i<300&&scorched(L,F[0]);i++) V.step(1); assert.ok(!scorched(L,F[0]),'the Scorch ended'); secs(3.8); near(db(L,F[0]),12,'Collector: kept 4 s after it ends'); secs(0.3); near(db(L,F[0]),0,'then cleared');
  castL(L,F[1]); setDb(L,F[1],9.99,0); v.energy=0; V.step(3); near(v.energy,9,'Called In: reaching 10 gives 3 x 3 energy'); V.step(3); near(v.energy,9,'(once each time it reaches 10)');
  setDb(L,F[2],10); const p=plainHit(L,()=>lashHit(L,F[2])); near(lashHit(L,F[2]),p*(1+0.006*5*10),'Ember Debt: her abilities 0.6% x 5 more per debt');
  near(myHit(L,F[2],{auto:true}),1000,'(not her basic attacks)');
  const W=lab(H,S(['db_1_1']),{foes:2,big:true}); castL(W,W.F[0]); V.step(30); for(let i=0;i<300&&scorched(W,W.F[0]);i++) V.step(1); V.step(1); near(db(W,W.F[0]),0,'without Collector: cleared as the Scorch ends');
});

test('Pyroclast / Hard Ledger, Glass Mind, Bankrupt',()=>{
  const L=lab(H,S(['db_4_1','db_4_3','db_9_1','db_1_1']),{foes:4,allies:1,big:true}), {v,F,A}=L;
  setDb(L,F[0],5); near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),1000*1.05,'Hard Ledger: 5+ Ember Debt, 1% x 5 more from her allies'); near(myHit(L,F[0]),1000*1.05,'and from her');
  setDb(L,F[1],4.9); near(myHit(L,F[1]),1000,'(4.9: no)');
  near(hitOn(L,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,1000,{src:F[0]}))*0.91,'Glass Mind: she takes 3% x 3 less from an enemy owing 5 or more'); near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]})),'(not from one owing less)');
  setDb(L,F[1],0,0); setDb(L,F[0],10); kill(L,F[0]); near(db(L,F[1]),5,'Bankrupt: an enemy that dies with 10 passes half to the nearest enemy');
  setDb(L,F[1],9); kill(L,F[1]); near(db(L,F[2])+db(L,F[3]),0,'(9: nothing)');
});

test('Pyroclast / Paid in Kind: each hit on her written (Old Debts more), collected by Ember Lash (3% x 5 per hit), cleared; Steady Breath, Paid Twice',()=>{
  const L=lab(H,S(['db_2_2','db_4_2','db_12_3','db_11_2']),{foes:3,big:true}), {v,F}=L;
  for(let i=0;i<10;i++) hitOn(L,10,{src:F[0]}); assert.equal(pk(L,F[0]),8,'Old Debts: up to 5 + 1 x 3 written'); assert.equal(pk(L,F[1]),0,'');
  v.energy=0; const p=plainHit(L,()=>lashHit(L,F[0])); assert.equal(pk(L,F[0]),8,'(a plain cast collects nothing)'); F[0].dots.length=0;
  near(lashHit(L,F[0]),p*(1+0.03*5*8),'Ember Lash collects: 3% x 5 more per hit written'); assert.equal(pk(L,F[0]),0,'and clears them'); near(v.energy,1*3*8,'Steady Breath: 1 x 3 energy per hit collected');
  near(dots(L,F[0],'pyL')[0].dps,lashDps(v)*(1+0.02*3*8),'Paid Twice: its Scorch 2% x 3 stronger per hit collected');
  F[0].dots.length=0; castL(L,F[0]); near(dots(L,F[0],'pyL')[0].dps,lashDps(v),'(the next Lash: nothing to collect)');
  const Q=lab(H,S(['db_2_2','db_5_3']),{foes:2,big:true}); for(let i=0;i<4;i++) hitOn(Q,10,{src:Q.F[0]}); const q=plainHit(Q,()=>lashHit(Q,Q.F[0]));
  near(lashHit(Q,Q.F[0]),q*(1+0.15*2),'Payment Plan: each Lash collects half the hits'); assert.equal(pk(Q,Q.F[0]),4,'and they stay written');
});

test('Pyroclast / Full Payment (PICK ONE): 5 written hits stun 0.8 s when Ember Lash collects, under the stun-lock rule',()=>{
  const L=lab(H,S(['db_2_2','db_5_2']),{foes:2,big:true}), {v,F}=L; still(F[0]); const five=()=>{ for(let i=0;i<5;i++) hitOn(L,10,{src:F[0]}); };
  for(let i=0;i<4;i++) hitOn(L,10,{src:F[0]}); castL(L,F[0]); assert.ok(!(F[0].stunned>0),'(4: no stun)');
  five(); castL(L,F[0]); near(F[0].stunned,0.8,'5 written: stunned 0.8 s (its full length)',1e-9);
  V.step(2); const s1=F[0].stunned; five(); castL(L,F[0]); near(F[0].stunned,s1,'not again while it is stunned');
  for(let i=0;i<80&&F[0].stunned>0;i++) V.step(1); V.step(Math.round(0.3/V.STEP)); five(); castL(L,F[0]); assert.ok(!(F[0].stunned>0),'nor within 0.5 s after it ended');
  V.step(Math.round(0.3/V.STEP)); five(); castL(L,F[0]); near(F[0].stunned,0.8,'then again',1e-9);
  const Q=lab(H,S(['db_2_2','db_5_2']),{foes:2,big:true}); for(let i=0;i<5;i++) hitOn(Q,10,{src:Q.F[0]}); still(Q.F[0]); Q.F[0].stunned=2; castL(Q,Q.F[0]); assert.ok(!Q.T.s.pyStN,'(an enemy another unit has stunned: no stun of hers)'); near(Q.F[0].stunned,2,'');
});

test('Pyroclast / Fuel for the Mountain (LINK): 6% more on an enemy that hit her in the last 4 s; with Magma, 3 Magma per hit collected (at most 15)',()=>{
  const L=lab(H,S(['db_n1']),{foes:3,big:true}), {F}=L; hitOn(L,10,{src:F[0]}); let p=plainHit(L,()=>lashHit(L,F[0])); near(lashHit(L,F[0]),p*1.06,'6% more');
  p=plainHit(L,()=>lashHit(L,F[1])); near(lashHit(L,F[1]),p,'(not on one that did not hit her)'); secs(4.1); p=plainHit(L,()=>lashHit(L,F[0])); near(lashHit(L,F[0]),p,'4 s');
  assert.equal(L.T.P.fuel||0,0,'(no Magma: no Magma line)');
  const M=lab(H,S(['db_n1','er_1_1','db_4_2']),{foes:2,big:true}); for(let i=0;i<3;i++) hitOn(M,10,{src:M.F[0]}); castL(M,M.F[0]); assert.equal(stack(M,'pyMag'),9,'with Magma: 3 per hit collected');
  for(let i=0;i<7;i++) hitOn(M,10,{src:M.F[0]}); setStack(M,'pyMag',0); castL(M,M.F[0]); assert.equal(stack(M,'pyMag'),15,'at most 15 per Lash');
});

test('Pyroclast / her Scorch: Long Scorch, Long Lash, Deep Scorch, Lava Lines, Vent Heat; one Lash Scorch per enemy, Lash of Iron two and Two Scorches',()=>{
  const L=lab(H,S(['db_2_4','er_5_3','db_3_4','er_4_1']),{foes:3,big:true}), {v,F}=L;
  castL(L,F[0]); const d=dots(L,F[0],'pyL')[0]; near(left(d),4+0.9+2,'Long Scorch 0.3 x 3 s, Long Lash 2 s longer (a part tick at the end)'); assert.equal(d.remaining,7,'');
  const a=tick1(L,F[0]), b=plainHit(L,()=>tick1(L,F[0])); near(a,b*1.15*1.10,'Deep Scorch 3% x 5, Lava Lines 2% x 5 more each tick');
  castL(L,F[0]); assert.equal(dots(L,F[0],'pyL').length,1,'a new Lash Scorch replaces the old one');
  F[1].mrRating=800; const V2=lab(H,S(['db_6_4']),{foes:2,big:true}); V2.F[0].mrRating=800; castL(V2,V2.F[0]); const x=tick1(V2,V2.F[0]), y=plainHit(V2,()=>tick1(V2,V2.F[0]));
  const T0=V2.v._tal; V2.v._tal=undefined; const m0=dm(V2.v,V2.F[0]); const sv=V2.F[0].mrRating; V2.F[0].mrRating=sv*0.88; const m1=dm(V2.v,V2.F[0]); V2.F[0].mrRating=sv; V2.v._tal=T0;
  near(x,y*m1/m0,'Vent Heat: her Scorch ignores 4% x 3 of the magic resist');
  const I=lab(H,S(['db_7_2','db_10_2']),{foes:2,big:true}); castL(I,I.F[0]); V.step(3); castL(I,I.F[0]); assert.equal(dots(I,I.F[0],'pyL').length,2,'Lash of Iron: two Lash Scorches run together'); castL(I,I.F[0]); assert.equal(dots(I,I.F[0],'pyL').length,2,'(a third replaces the oldest)');
  const two=I.F[0].dots.filter(q=>q._talK==='pyL'); const T1=I.v._tal; const k=[0,1].map(i=>{ const o=two[i]; const c={u:I.v,src:I.v,tgt:I.F[0],amt:100,dot:o,tag:'pyL'}; api(I).run(T1,I.v,'dotOut',c); return c.amt; });
  near(k[0],112,'Two Scorches: while it carries two, each ticks 4% x 3 more'); near(k[1],112,''); I.F[0].dots.splice(I.F[0].dots.indexOf(two[0]),1); const c={u:I.v,src:I.v,tgt:I.F[0],amt:100,dot:two[1],tag:'pyL'}; api(I).run(T1,I.v,'dotOut',c); near(c.amt,100,'(one: no)');
});

test('Pyroclast / Ember Lash: Hot Blood, Searing Lash, Far Flame, Foreclose, Quick Lash; Stoked, Burning Gaze; her cooldowns (Steady Flame, Brimstone, Ash Step)',()=>{
  const L=lab(H,S(['db_1_3','db_8_3','nh_11_3','db_5_1','db_1_4','db_7_3','er_10_4','nh_8_3','db_n2','db_6_1']),{foes:3,big:true}), {v,F}=L;
  let p=plainHit(L,()=>lashHit(L,F[1])); F[1].dots.length=0; near(lashHit(L,F[1]),p*1.15*1.15,'Searing Lash 3% x 5, Far Flame 3% x 5 (not yet Scorched)');
  p=plainHit(L,()=>lashHit(L,F[1])); near(lashHit(L,F[1]),p*1.15*1.15*1.10,'Hot Blood: an enemy already Scorched 2% x 5 more');
  F[2].hp=F[2].maxHp*0.39; F[2].dots.length=0; p=plainHit(L,()=>lashHit(L,F[2])); F[2].dots.length=0; near(lashHit(L,F[2]),p*1.15*1.15*1.15,'Foreclose: below 40% HP 5% x 3 more');
  near(FX.cd(v,'green',6),(6-0.6)*0.95*0.955*0.95,'Quick Lash 0.2 x 3 s, Steady Flame 1% x 5, Brimstone 1.5% x 3, Ash Step 1% x 5 shorter'); near(FX.cd(v,'blue',8),8*0.95*0.955*0.95,'(the percentages on Blazing Orbit too)');
  F[0].dots.length=0; near(myHit(L,F[0],{auto:true}),1000,'Stoked: not Scorched, plain'); castL(L,F[0]); near(myHit(L,F[0],{auto:true}),1000*1.20,'a Scorched enemy: her basic attacks 4% x 5 more');
  F[0].dots.length=0; castL(L,F[0]); const d=dots(L,F[0],'pyL')[0], l0=left(d); myHit(L,F[0],{auto:true}); near(left(d),l0+1.5,'Burning Gaze: each basic attack on it 0.5 x 3 s longer',1e-6);
  myHit(L,F[0],{auto:true}); near(left(d),l0+3,''); myHit(L,F[0],{auto:true}); near(left(d),l0+3,'at most 3 s more for each Scorch'); myHit(L,F[0]); near(left(d),l0+3,'(not a skill hit)');
});

test('Pyroclast / Crownfire: its main target (struck nearest the centre), Ember Tithe, Crown of Debts, Last Payment',()=>{
  const L=lab(H,S(['db_7_1','db_12_2','db_12_1','db_1_1']),{foes:3,big:true}), {v,F}=L; at(L,F[1],4.5,2);
  setDb(L,F[1],10); let p=plainHit(L,()=>lost(F[0],()=>castC(L,F[0]))); near(lost(F[0],()=>castC(L,F[0])),p,'debt on another enemy it strikes: no Tithe (its main target is the one nearest the centre)');
  setDb(L,F[0],10); p=plainHit(L,()=>lost(F[0],()=>castC(L,F[0]))); const q=plainHit(L,()=>lost(F[1],()=>castC(L,F[0])));
  const a0=F[0].hp, a1=F[1].hp; castC(L,F[0]); near(a0-F[0].hp,p*(1+0.02*5*10)*(1+0.006*5*10),'Ember Tithe: 2% x 5 more per debt on its main target (and Ember Debt on it)'); near(a1-F[1].hp,q*(1+0.02*5*10)*(1+0.006*5*10),'on every enemy it strikes');
  setDb(L,F[0],0,0); setDb(L,F[1],0,0); castL(L,F[0]); F[1].hp=F[1].maxHp*0.4; p=plainHit(L,()=>lost(F[0],()=>castC(L,F[0]))); const r=plainHit(L,()=>lost(F[1],()=>castC(L,F[0])));
  const b0=F[0].hp, b1=F[1].hp; castC(L,F[0]); near(b0-F[0].hp,p*1.15,'Crown of Debts: a Scorched enemy 3% x 5 more'); near(b1-F[1].hp,r*1.15,'Last Payment: below 50% HP 5% x 3 more');
});

test('Pyroclast / Settled in Fire (SIGNATURE): 6% more per Ember Debt and written hit on its main target, settled; a kill passes them on for a second Crownfire at half power, once',()=>{
  const L=lab(H,S(['db_13_2']),{foes:3,big:true}), {v,F}=L; at(L,F[2],0,16); F[2].hp=F[2].maxHp;
  setDb(L,F[0],10,0); for(let i=0;i<3;i++) hitOn(L,10,{src:F[0]}); const p=plainHit(L,()=>lost(F[0],()=>castC(L,F[0])));
  near(lost(F[0],()=>castC(L,F[0])),p*(1+0.06*13),'6% x (10 debt + 3 written) more'); near(db(L,F[0]),0,'its debts are settled'); assert.equal(pk(L,F[0]),0,'');
  near(lost(F[0],()=>castC(L,F[0])),p,'(the next one: nothing owed)');
  const K=lab(H,S(['db_13_2']),{foes:3,big:true}); at(K,K.F[2],0,16); for(const f of K.F) f.hp=f.maxHp*0.9; K.F[2].hp=K.F[2].maxHp;
  const q=plainHit(K,()=>lost(K.F[2],()=>castC(K,K.F[2]))); setDb(K,K.F[0],10,99); for(let i=0;i<3;i++) hitOn(K,10,{src:K.F[0]}); K.F[0].hp=1; K.F[0].shield=0;
  castC(K,K.F[0]); assert.ok(!K.F[0].alive,'it kills its main target'); near(db(K,K.F[2]),10,'its debts pass to the enemy with the highest HP'); assert.equal(pk(K,K.F[2]),3,'and its written hits');
  const h=K.F[2].hp; secs(0.7); near(h-K.F[2].hp,q*0.5*(1+0.06*13),'a second Crownfire falls on it at half power (and settles what it carried)',1e-6);
  assert.equal(K.T.s.pySfN,1,'passed on once'); K.F[2].hp=1; setDb(K,K.F[2],10,99); castC(K,K.F[2]); secs(0.7); assert.equal(K.T.s.pySfN,2,'(a new cast passes on again)');
});

test('Pyroclast / Red Ledger and Ash Robe: the enemy that has hit her most this wave',()=>{
  const L=lab(H,S(['db_9_4','db_11_4']),{foes:3,big:true}), {F}=L; for(let i=0;i<3;i++) hitOn(L,10,{src:F[1]}); hitOn(L,10,{src:F[0]});
  let p=plainHit(L,()=>lashHit(L,F[1])); near(lashHit(L,F[1]),p*1.10,'Red Ledger: her abilities 2% x 5 more on it'); p=plainHit(L,()=>lashHit(L,F[0])); near(lashHit(L,F[0]),p,'(not another)');
  near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]}))*0.91,'Ash Robe: 3% x 3 less from it'); near(hitOn(L,1000,{src:F[2]}),1000,'');
  for(let i=0;i<5;i++) hitOn(L,10,{src:F[0]}); p=plainHit(L,()=>lashHit(L,F[0])); near(lashHit(L,F[0]),p*1.10,'another passes it: that one');
  V.wave(); V.step(1); p=plainHit(L,()=>lashHit(L,F[0])); near(lashHit(L,F[0]),p,'counted again each wave');
});

test('Pyroclast / Rising Heat: Kindled and Stubborn Heat (per enemy), Fanned (its cap), at her swing',()=>{
  const L=lab(H,S(['db_5_4','nh_4_2','er_3_2']),{foes:7,big:true}), {v,F}=L; const pm=v.passMul||1, cap=VMX('SKLV.risingheatCap')(VMX('passLv')(v));
  V.dot(F[0],1,99,1,F[1]); swing(L,F[0]); near(v.apMul,1+(0.09*pm+0.02+0.009),'Kindled 0.4 x 5 and Stubborn Heat 0.3 x 3 points more per enemy',1e-9);
  for(const f of F) V.dot(f,1,99,1,F[1]); const per=0.09*pm+0.029; swing(L,F[1]);
  assert.ok(7*per>cap+0.05,'(the cap binds)'); near(v.apMul,1+Math.min(cap+0.05,7*per),'Fanned: its cap 1 x 5 points higher',1e-9);
  near(FX.num(v,'rhCap',0.45),0.50,'(the cap: +5 points)'); near(FX.num(v,'rhPer',0.09),0.119,'(the share per enemy: +2.9 points)');
});

/* ============================== ERUPTION ============================== */
test('Pyroclast / Magma: each Scorch tick (Hot Rock: the Orbit\'s burn too); at 40 (Bright Vent fewer) Blazing Orbit erupts - 1 m wider, Magma\'s damage, Lava Tube, Fissure; Magma Chamber',()=>{
  const L=lab(H,S(['er_1_1','er_2_1','er_6_1','er_9_1','er_10_1','er_3_1']),{foes:3,big:true}), {v,F}=L;
  castL(L,F[0]); tick1(L,F[0]); assert.equal(stack(L,'pyMag'),1,'each tick of her Scorch: 1 Magma'); F[0].dots.length=0; at(L,F[0],30,0);
  orbAt(L,F[1]); castO(L,F[1]); setStack(L,'pyMag',0); tick1(L,F[1]); assert.equal(stack(L,'pyMag'),3,'Hot Rock: each tick of Blazing Orbit\'s burn 1 x 3'); F[1].dots.length=0;
  setStack(L,'pyMag',30); orbAt(L,F[1]); at(L,F[2],1.2,3.3); let h2=F[2].hp; castO(L,F[1]); near(F[2].hp,h2,'(30: no eruption)'); assert.equal(stack(L,'pyMag'),30,'');
  F[1].dots.length=0; F[2].dots.length=0; setStack(L,'pyMag',31); orbAt(L,F[1]); at(L,F[2],1.2,3.3); h2=F[2].hp; const p=plainHit(L,()=>{ const x=F[1].hp; castO(L,F[1]); return x-F[1].hp; }); F[1].dots.length=0; orbAt(L,F[1]); at(L,F[2],1.2,3.3);
  const h1=F[1].hp; castO(L,F[1]); assert.equal(stack(L,'pyMag'),0,'Bright Vent: at 40 - 3 x 3 = 31 the next Orbit erupts and spends it'); assert.ok(F[2].hp<h2,'1 m wider (an enemy 3.5 m from her and from the target)');
  near(h1-F[1].hp,p+0.06*5*(v.apow||0)*dm(v,F[1]),'Magma: 6% x 5 of her ability power more to each enemy it strikes',1e-6);
  assert.ok(dots(L,F[1],'pyE').length===1&&near(dots(L,F[1],'pyE')[0].dps,lashDps(v),'')===undefined,'Fissure: every enemy an eruption strikes is Scorched (Ember Lash\'s Scorch, 4 s)');
  F[1].hp=F[1].maxHp*0.4; setStack(L,'pyMag',62); orbAt(L,F[1]); const p2=plainHit(L,()=>{ const x=F[1].hp; castO(L,F[1]); return x-F[1].hp; }); orbAt(L,F[1]); const g=F[1].hp; castO(L,F[1]);
  near(g-F[1].hp,p2*1.15+0.30*(v.apow||0)*1.15*dm(v,F[1]),'Lava Tube: below 50% HP an eruption 3% x 5 more, its Magma damage too',1e-6); assert.equal(stack(L,'pyMag'),31,'Magma Chamber: up to two eruptions stored'); near(api(L).stMax(L.T,v,'pyMag'),62,'(62)'); orbAt(L,F[1]); castO(L,F[1]); assert.equal(stack(L,'pyMag'),0,'the second');
});

test('Pyroclast / an eruption\'s riders: Hot Spring, Vented, Crater, Obsidian Plate',()=>{
  const L=lab(H,S(['er_1_1','er_5_1','er_8_1','er_11_1','er_11_4']),{foes:2,big:true}), {v,F}=L; v.energy=0; v.greenCd=10; v.shield=0; setStack(L,'pyMag',40); orbAt(L,F[0]); castO(L,F[0]);
  near(v.energy,10,'Hot Spring: 2 x 5 energy'); near(v.greenCd,7,'Vented: Ember Lash 1 x 3 s sooner'); near(v.shield,0.06*v.maxHp,'Obsidian Plate: a shield of 2% x 3 of her max HP'); near(v.shieldT,4,'for 4 s');
  const z=L.T.s.zn.pyAsh; assert.ok(z&&z.length===1,'Crater: Ashfall at her feet'); near((z[0].until-V.now()),5,'for 2 + 1 x 3 s'); near(z[0].x,v.x,'');
  v.energy=0; castO(L,F[0]); near(v.energy,0,'(no eruption: nothing)');
});

test('Pyroclast / Blazing Orbit: Fierce Ring, Fire Guard, Wide Ring, Heat Wave, Flare Up, Quick Orbit, Ring of Cinders',()=>{
  const L=lab(H,S(['er_2_4','nh_5_1','er_1_4','er_6_4','er_5_4','nh_5_4','er_7_4']),{foes:3,big:true}), {v,F}=L;
  orbAt(L,F[0]); const p=plainHit(L,()=>{ const x=F[0].hp; castO(L,F[0]); return x-F[0].hp; }); F[0].dots.length=0; orbAt(L,F[0]); at(L,F[1],1.2,2.9); const h1=F[1].hp, x0=F[0].x, h0=F[0].hp; castO(L,F[0]);
  near(h0-F[0].hp,p*1.12*1.15,'Fierce Ring 4% x 3, Fire Guard 3% x 5 more'); assert.ok(F[1].hp<h1,'Wide Ring: 0.2 x 3 m wider'); near((F[0].x-x0)/V.METER,2.1,'Heat Wave: pushed 0.2 x 3 m farther',1e-6);
  near(left(dots(L,F[0],'pyR')[0]),5,'Ring of Cinders: Scorched 1 x 5 s'); near(dots(L,F[0],'pyR')[0].dps,lashDps(v),'(Ember Lash\'s Scorch)');
  near(FX.cd(v,'blue',8),8-0.9-0.75,'Flare Up 0.3 x 3 s, Quick Orbit 0.15 x 5 s shorter');
});

test('Pyroclast / Ashfall: where Crownfire lands, 4 s (Thick Ash longer), 3 m (Firestorm wider), its Scorch each second (Choking Smoke), Smothering Ash, Trailing Ash, Ash Cloud, Ash Veil; gone at a new wave',()=>{
  const L=lab(H,S(['er_2_3','er_3_3','er_12_4','er_10_2','er_4_3','er_n1','er_8_3','er_11_3']),{foes:3,allies:1,big:true}), {v,F,A}=L; at(L,F[1],4.5,4.2); at(L,F[2],4.5,9);
  castC(L,F[0]); const z=L.T.s.zn.pyAsh[0]; near(z.until-V.now(),4+1.5,'Thick Ash: 4 + 0.3 x 5 s'); near(z.r/V.METER,3.9,'Firestorm: 3 + 0.3 x 3 m');
  secs(1.05); const d0=dots(L,F[0],'pyA')[0]; assert.ok(d0,'an enemy inside is Scorched'); near(d0.dps,lashDps(v)*1.0*1.2,'20% x 5 of Ember Lash\'s Scorch, Choking Smoke 4% x 5 stronger');
  assert.ok(dots(L,F[1],'pyA').length===1,'(any part of its body inside: 4.2 m off the centre)'); assert.ok(!dots(L,F[2],'pyA').length,'(not one outside)'); near(F[0].slowMul,0.75,'Smothering Ash: slowed 25%');
  near(hitOn(L,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,1000,{src:F[0]}))*0.94*0.925,'Ash Cloud 2% x 3 and Ash Veil 1.5% x 5: an enemy inside deals her less'); near(hitAl(L,A[0],1000,{src:F[0]}),1000*0.94,'Ash Cloud: and her allies');
  near(hitOn(L,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,1000,{src:F[2]})),'(not one outside)');
  const l0=left(d0); at(L,F[0],-30,0); V.step(1); near(left(d0),l0+2,'Trailing Ash: an enemy that walks out stays Scorched 0.4 x 5 s longer',1e-6);
  V.wave(); V.step(1); assert.equal((L.T.s.zn.pyAsh||[]).length,0,'a new wave: no Ashfall left (its end was a fight time)');
});

test('Pyroclast / Rain of Embers: three pillars on Scorched enemies within 6 m, 30% each (Glowing Embers more), Rolling Fire\'s Magma',()=>{
  const L=lab(H,S(['er_7_2','er_8_2','er_12_2','er_1_1']),{foes:4,big:true}), {v,F}=L; at(L,F[1],4.5,5.5); at(L,F[2],4.5,14);
  const p=plainHit(L,()=>lost(F[0],()=>castC(L,F[0]))); castL(L,F[1]); castL(L,F[2]); setStack(L,'pyMag',0);
  const h1=F[1].hp, h2=F[2].hp, h0=F[0].hp; castC(L,F[0]); const pl=0.30*1.10*p;
  near(h1-F[1].hp,3*pl,'the only Scorched enemy within 6 m takes all three pillars (30% x 1.10 of Crownfire each)',1e-6); near(F[2].hp,h2,'(not one farther)'); near(h0-F[0].hp,p,'(the main pillar as before: F0 is not Scorched)');
  assert.equal(stack(L,'pyMag'),27,'Rolling Fire: 3 x 3 Magma per pillar');
  castL(L,F[0]); const g0=F[0].hp, g1=F[1].hp; castC(L,F[0]); near((g0-F[0].hp)+(g1-F[1].hp),p+3*pl,'two Scorched: the pillars shared out (three in all)',1e-6); near(g1-F[1].hp,pl,'(one on F1, two on F0)',1e-6);
});

test('Pyroclast / Split Lash (PICK ONE), Scorch Catch, Fire Weather',()=>{
  const L=lab(H,S(['er_5_2']),{foes:3,big:true}), {v,F}=L; castL(L,F[0]); const f=dots(L,F[1],'pyF')[0]; assert.ok(f,'Split Lash: the nearest second enemy is Scorched'); near(f.dps,lashDps(v)*0.5,'for half'); near(left(f),4,'');
  const C=lab(H,S(['er_6_2']),{foes:3,big:true}); castL(C,C.F[0]); kill(C,C.F[0]); const c=dots(C,C.F[1],'pyL')[0]; assert.ok(c,'Scorch Catch (5/5: 100%): the enemy nearest a Scorched enemy that dies catches the rest of its Scorch'); near(c.dps,lashDps(C.v),'');
  const N=lab(H,S(['er_6_2']),{foes:3,big:true}); kill(N,N.F[0]); assert.ok(!dots(N,N.F[1]).length,'(an enemy that was not Scorched: nothing)');
  const W=lab(H,S(['er_9_3']),{foes:4,big:true}); castL(W,W.F[1]); castL(W,W.F[2]); castL(W,W.F[3]); let p=plainHit(W,()=>lashHit(W,W.F[0])); W.F[0].dots.length=0; near(lashHit(W,W.F[0]),p*1.15,'Fire Weather: 1% x 5 per Scorched enemy on the field (3)');
  castL(W,W.F[0]); p=plainHit(W,()=>lashHit(W,W.F[0])); near(lashHit(W,W.F[0]),p*1.20,'(4)');
});

test('Pyroclast / The Mountain Opens (SIGNATURE): three more eruptions at half power, each Scorching; 5 Magma for each enemy not already burning; the last fills Magma; Ashfall 5 m',()=>{
  const L=lab(H,S(['er_13_3','er_1_1']),{foes:4,big:true}), {v,F}=L; at(L,F[1],4.5,2); at(L,F[2],4.5,6); at(L,F[3],4.5,13); setStack(L,'pyMag',0);
  const p=plainHit(L,()=>lost(F[0],()=>castC(L,F[0]))); castC(L,F[0]); const h=F[0].hp;
  V.step(Math.round(0.85/V.STEP)); near(h-F[0].hp,0.5*p,'the first eruption: 50% of Crownfire',1e-6); assert.ok(dots(L,F[0],'pyV').length===1,'it Scorches what it touches');
  near(dots(L,F[0],'pyV')[0].dps,lashDps(v)*0.5,'(half of Ember Lash\'s Scorch, 3 s)'); assert.equal(stack(L,'pyMag'),10,'5 Magma for each enemy it Scorched that was not burning (2)');
  assert.ok(!dots(L,F[3],'pyV').length,'(not one far away)'); { const z=L.T.s.zn.pyAsh[0]; F[2].x=F[2]._ax=z.x; F[2].y=F[2]._ay=z.y+4.6*V.METER; } secs(0.3); assert.ok(dots(L,F[2],'pyA').length===1,'Ashfall covers the crater: 5 m (F2 '+(Math.hypot(F[2].x-L.T.s.zn.pyAsh[0].x,F[2].y-L.T.s.zn.pyAsh[0].y)/V.METER).toFixed(2)+' m from the centre, body '+V.bodyR(F[2]).toFixed(2)+', zones '+JSON.stringify((L.T.s.zn.pyAsh||[]).map(z=>[(z.r/V.METER).toFixed(2),(z.until-V.now()).toFixed(2),z.min]))+', dots '+JSON.stringify(F[2].dots.map(d=>d._talK))+')'); near(dots(L,F[2],'pyA')[0].dps,lashDps(v)*0.4,'(its Scorch at least 40% without Ashfall)');
  secs(3.3); assert.equal(L.T.s.pyVentN,3,'three eruptions in 4 s'); assert.ok(stack(L,'pyMag')>=40,'the last fills Magma to 40');
});

/* ============================== NOBODY HOLDS HER ============================== */
test('Pyroclast / Cinders: a melee basic attack on her - Hot Coals, Searing Touch, Coal Bed, Scorched Hands, Cinderburst (once every 6 s, across a wave), Ringed',()=>{
  const L=lab(H,S(['nh_1_1','nh_2_1','nh_6_1','nh_9_1','nh_3_1','nh_10_1']),{foes:3,big:true}), {v,F}=L;
  V.hit(F[0],v,10,{kind:'phys'}); assert.ok(!mark(L,F[0],'pyCin'),'(a skill hit: no)'); V.hit(F[2],v,10,{kind:'phys',auto:true}); assert.ok(F[2].melee&&mark(L,F[2],'pyCin'),'');
  F[1].melee=false; V.hit(F[1],v,10,{kind:'phys',auto:true}); assert.ok(!mark(L,F[1],'pyCin'),'(not a ranged enemy)'); F[1].melee=true;
  V.hit(F[0],v,10,{kind:'phys',auto:true}); assert.ok(mark(L,F[0],'pyCin'),'Cinders'); const d=dots(L,F[0],'pyC')[0]; near(d.dps,lashDps(v)*1.0,'Scorched at 20% x 5 of Ember Lash\'s Scorch'); near(left(d),2+1.5,'Hot Coals: 2 + 0.5 x 3 s');
  near(F[0].slowMul,0.85,'Searing Touch: slowed 5% x 3'); near(myHit(L,F[0]),1000*1.10,'Coal Bed: she deals it 2% x 5 more'); near(hitOn(L,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,1000,{src:F[0]}))*0.85,'Scorched Hands: it deals her 15% less');
  F[0].pulledBy=null; V.hit(F[0],v,10,{kind:'phys',auto:true}); assert.ok(F[0].pulledBy&&F[0].pullT>0,'Cinderburst: hit again with Cinders, it is pushed back'); near(Math.hypot(F[0].pulledBy.x-F[0].x,F[0].pulledBy.y-F[0].y)/V.METER,1,'1 m',1e-6);
  F[0].pulledBy=null; V.hit(F[0],v,10,{kind:'phys',auto:true}); assert.ok(!F[0].pulledBy,'once every 6 s'); secs(4); F[0].pulledBy=null; V.hit(F[0],v,10,{kind:'phys',auto:true}); assert.ok(!F[0].pulledBy,'(4 s later, not yet)'); secs(1.5); F[0].pulledBy=null; V.hit(F[0],v,10,{kind:'phys',auto:true}); assert.ok(!F[0].pulledBy,'(5.5 s later, not yet)');
  secs(0.6); F[0].pulledBy=null; V.hit(F[0],v,10,{kind:'phys',auto:true}); assert.ok(F[0].pulledBy,'6 s later again');
  const R=lab(H,S(['nh_1_1','nh_11_1','nh_1_4']),{foes:2,big:true}); let n=0; for(let i=0;i<200;i++){ setStack(R,'pyShim',0); V.hit(R.F[0],R.v,1,{kind:'phys',auto:true}); if(stack(R,'pyShim')>0) n++; }
  assert.ok(n>155&&n<200,'Ringed: a seeded 30% x 3 chance of 1 Shimmer each time Cinders Scorch ('+n+' of 200)');
});

test('Pyroclast / Unheld: a stun landing on her ends early by 15% x 5, enemies within 2 m pushed back 1 m; once every 18 s (Burning Free 15), across a wave; pulls; Molten Will, Clear Ground, Climber',()=>{
  const L=lab(H,S(['nh_2_2','nh_3_2','nh_4_3','nh_9_2','nh_3_3']),{foes:3,big:true}), {v,F}=L; go(L); for(const f of F) still(f); V.step(1); assert.ok(gapM(v,F[0])<2,'(F0 within 2 m)'); assert.ok(gapM(v,F[1])>2,'');
  F[0].pulledBy=null; ccOn(F[1],v,'stunned',1); const s0=v.stunned; near(s0,V.ccNerf*0.8,'Climber: 4% x 5 shorter (20%)',1e-9); V.step(1);
  near(v.stunned,(s0-V.STEP)*0.25,'Unheld: what is left of it 15% x 5 shorter',1e-6); assert.ok(F[0].pulledBy&&F[0].pullT>0,'every enemy within 2 m pushed'); near(F[0].pullSpeed*0.25/V.METER,1,'1 m (over 0.25 s)',1e-6); assert.ok(!F[1].pulledBy,'(not one farther)');
  v.stunned=0; V.step(1); ccOn(F[1],v,'stunned',1); assert.ok(!(v.stunned>0),'Clear Ground: for 1.5 s after the burst no stun lands'); v.stunned=2; V.step(1); near(v.stunned,0,'(nor a stun written straight on)');
  secs(1.6); ccOn(F[1],v,'stunned',1); const s1=v.stunned; V.step(1); near(v.stunned,s1-V.STEP,'then stuns land, and within its cooldown Unheld does not burst',1e-6); assert.equal(L.T.s.pyUhN,1,'');
  v.stunned=0; V.step(1); go(L); const p=plainHit(L,()=>lashHit(L,F[2])); F[2].dots.length=0; L.T.s.pyMWq=1; near(lashHit(L,F[2]),p*1.24,'Molten Will: after a burst her next ability 8% x 3 more'); F[2].dots.length=0; near(lashHit(L,F[2]),p,'only that one');
  L.T.s.pyUhCd=0; v.pullT=0; V.step(1); v.pulledBy={x:v.x-300,y:v.y,alive:true}; v.pullT=1; v.pullStop=0; v.pullSpeed=1; V.step(1); near(v.pullT,0.25-V.STEP,'a pull too',1e-6); near(L.T.s.pyUhCd,15-V.STEP*0,'cooldown 18 - 1 x 3 s',0.05);
  v.pullT=0; v.pulledBy=null; v.stunned=0; V.step(1); V.wave(); V.step(1); go(L); secs(5); ccOn(F[1],v,'stunned',1); const s2=v.stunned; V.step(1); near(v.stunned,s2-V.STEP,'a new wave does not reset the cooldown (the fight clock does; Unheld counts down)',1e-6);
  secs(8.4); v.stunned=0; V.step(1); ccOn(F[1],v,'stunned',1); const s4=v.stunned; V.step(1); near(v.stunned,s4-V.STEP,'(about 13.5 s after: not yet)',1e-6); secs(1.6); v.stunned=0; V.step(1); ccOn(F[1],v,'stunned',1); const s3=v.stunned; V.step(1); near(v.stunned,(s3-V.STEP)*0.25,'15 s after: ready again',1e-6);
});

test('Pyroclast / Heat Shimmer: 1 for each enemy Blazing Orbit pushes (4, Ember Ward 7), 4 s (Shimmering Air longer), 1% x 3 less each; Mirage, Cooling Glass, Lava Blood, Back Draft',()=>{
  const L=lab(H,S(['nh_1_4','nh_2_4','nh_3_4','nh_6_4','nh_10_4','nh_12_4','nh_8_2']),{foes:3,big:true}), {v,F}=L; orbAt(L,F[1]); castO(L,F[1]); assert.equal(stack(L,'pyShim'),1,'a real Orbit push: 1 Shimmer');
  near(F[1].slowMul,0.85,'Back Draft: the enemy pushed slowed 5% x 3'); near(F[1].slow,2,'for 2 s',1e-9);
  v.maxHp=1e6; v.hp=5e5; const h=v.hp; for(let i=0;i<3;i++) FX.pass(v,F[0],'novaPush'); assert.equal(stack(L,'pyShim'),4,'');
  near(v.hp-h,1e6*0.03,'Cooling Glass: reaching 4, she heals 1% x 3 of her max HP',1e-6); const d=lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true})); near(d,0,'Mirage: at 4, the next basic attack aimed at her misses');
  assert.ok(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true}))>0,'only that one'); for(let i=0;i<5;i++) FX.pass(v,F[0],'novaPush'); assert.equal(stack(L,'pyShim'),7,'Ember Ward: up to 4 + 1 x 3');
  near(hitOn(L,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,1000,{src:F[2]}))*(1-0.03*7),'each Shimmer 1% x 3 less (7: 21%)');
  setStack(L,'pyShim',0); V.step(1); const a0=v.apow; setStack(L,'pyShim',7); V.step(1); near(v.apow,a0*(1+0.003*5*7),'Lava Blood: 0.3% x 5 ability power each');
  setStack(L,'pyShim',3); FX.pass(v,F[0],'novaPush'); secs(5.4); assert.ok(stack(L,'pyShim')>0,'Shimmering Air: 4 + 0.5 x 3 s after the last'); secs(0.2); assert.equal(stack(L,'pyShim'),0,'then gone');
});

test('Pyroclast / Breaking Point, Wall of Flame (PICK ONE), Turn and Burn (PICK ONE)',()=>{
  const L=lab(H,S(['nh_7_2']),{foes:3,big:true}), {v,F}=L; const bp=()=>L.T.fn.bp(api(L),L.T,L.v); v.stunned=0; v.blueCd=0; at(L,F[0],12,0); bp(); assert.ok(!L.T.s.pyBpN,'(no enemy within 2 m: no)');
  at(L,F[0],2.4,0); const h=F[0].hp; bp(); assert.equal(L.T.s.pyBpN,1,'an enemy within 2 m and the ring ready: it fires on its own'); assert.ok(F[0].hp<h,'(at that enemy)'); near(v.blueCd,8,'and its cooldown starts'); bp(); assert.equal(L.T.s.pyBpN,1,'(not ready: no)'); v.stunned=1e6;
  const W=lab(H,S(['nh_5_2']),{foes:3,big:true}); orbAt(W,W.F[0]); castO(W,W.F[0]); assert.ok(W.T.s.pyWall,'Wall of Flame: the ring stays burning'); at(W,W.F[1],2,0.5); W.F[1].pulledBy=null; V.step(1);
  assert.ok(W.F[1].pulledBy&&W.T.s.pyWallN===1,'an enemy that crosses it is pushed back'); W.F[1].pulledBy=null; V.step(1); assert.ok(!W.F[1].pulledBy,'(once while it stays inside)'); secs(2); at(W,W.F[2],2,-0.5); W.F[2].pulledBy=null; V.step(1); assert.ok(!W.F[2].pulledBy,'for 2 s');
  const B=lab(H,S(['nh_5_3']),{foes:3,big:true}); near(FX.num(B.v,'dlv:creeprot',0.6),0.6,'(before an Orbit: the shot as it is)'); orbAt(B,B.F[2]); castO(B,B.F[2]); at(B,B.F[2],15.5,0);
  near(FX.num(B.v,'dlv:creeprot',0.6),0.4,'Turn and Burn: after Blazing Orbit her next Ember Lash flies 50% faster'); const p=plainHit(B,()=>lashHit(B,B.F[0])); B.F[0].dots.length=0; near(lashHit(B,B.F[0]),p*1.25,'and deals 25% more');
  B.F[0].dots.length=0; near(lashHit(B,B.F[0]),p,'only that one'); near(FX.num(B.v,'dlv:creeprot',0.6),0.6,'');
});

test('Pyroclast / Distance, Untouched, Sixteen, Black Glass Wall, Glass Skin, Out of Reach, Sparks in Her Hair and her energy talents',()=>{
  const L=lab(H,S(['nh_10_3','nh_12_2','nh_7_1','nh_12_1','nh_9_4','nh_6_2','nh_1_3','db_10_4','er_12_3','nh_11_4']),{foes:4,big:true}), {v,F}=L;
  let p=plainHit(L,()=>lashHit(L,F[2])); F[2].dots.length=0; near(lashHit(L,F[2]),p*1.10,'Distance: more than 6 m away, 2% x 5 more (F0 is near her: no Untouched)');
  at(L,F[0],30,0); at(L,F[3],30,6); V.step(1); p=plainHit(L,()=>lashHit(L,F[2])); F[2].dots.length=0; near(lashHit(L,F[2]),p*1.10*1.10,'Untouched: no enemy within 3 m, 2% x 5 more');
  assert.ok(gapM(v,F[1])>3,''); at(L,F[0],4.5,0); at(L,F[3],0,6); V.step(1);
  near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]}))*0.925*0.91,'Sixteen: a melee enemy 1.5% x 5 less; Black Glass Wall: two enemies within 3 m, 3% x 3 less'); F[1].melee=false;
  near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]}))*0.91,'(a ranged one: no Sixteen)'); F[1].melee=true; at(L,F[3],0,30); V.step(1); near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]}))*0.925,'(one near: no wall)');
  v.maxHp=1e6; v.hp=1e5; let h=v.hp; V.heal(v,1000); near(v.hp-h,1100,'Glass Skin: heals on her 2% x 5 stronger'); v.shield=0; V.step(1); v.shield=1000; V.step(1); near(v.shield,1100,'and shields');
  near(L.T.s.ap.move,1.10,'Out of Reach: 2% x 5 faster');
  v.energy=0; V.step(1); v.energy=10; V.step(1); near(v.energy,10*(1+0.06+0.10+0.06+0.15),'energy fills 2% x 3, 2% x 5, 2% x 3 faster; Sparks in Her Hair 3% x 5 while an enemy is within 3 m',1e-6);
  at(L,F[0],30,0); V.step(1); v.energy=0; V.step(1); v.energy=10; V.step(1); near(v.energy,10*1.22,'(no enemy near: no Sparks)',1e-6);
});

test('Pyroclast / The Vent at Sixteen (SIGNATURE): a crown of fire for 6 s - touching enemies pushed out and given Cinders (each once every 2 s), no stun or pull, full Shimmer, Unheld ready',()=>{
  const L=lab(H,S(['nh_13_2','nh_2_2','nh_1_4']),{foes:3,big:true}), {v,F}=L; L.T.s.pyUhCd=10; at(L,F[1],12,0); castC(L,F[1]);
  assert.ok(win(L,'pyCrown'),'when Crownfire lands'); near(L.T.s.pyUhCd||0,0,'Unheld is ready again'); assert.equal(stack(L,'pyShim'),4,'full Heat Shimmer');
  F[0].pulledBy=null; V.step(1); assert.ok(F[0].pulledBy&&mark(L,F[0],'pyCin'),'an enemy that touches it (within 3 m) is pushed out and catches Cinders'); near(dots(L,F[0],'pyC')[0].dps,lashDps(v)*0.2,'(Cinders at least 20% without the Cinders talent)');
  assert.ok(!F[1].pulledBy,'(not one far away)'); assert.equal(L.T.s.pyCrN,1,''); V.step(1); secs(1.5); assert.equal(L.T.s.pyCrN,1,'each at most once every 2 s (1.5 s: not yet)'); secs(0.6); assert.equal(L.T.s.pyCrN,2,'');
  go(L); ccOn(F[2],v,'stunned',1); assert.ok(!(v.stunned>0),'she cannot be stunned'); v.pullT=1; v.pulledBy={x:0,y:0,alive:true}; V.step(1); near(v.pullT,0,'or pulled');
  secs(2.5); assert.equal(stack(L,'pyShim'),4,'her Shimmer stays full'); secs(1.6); assert.ok(!win(L,'pyCrown'),'6 s'); ccOn(F[2],v,'stunned',1); assert.ok(v.stunned>0,'then stuns land again');
});

/* ============================== DAMAGE REDUCTION: ONE GROUP ============================== */
test('Pyroclast / damage reduction, one group of 40%: every condition at once never takes more than 40% off a hit',()=>{
  const L=lab(H,S(['db_4_3','db_9_2','db_11_4','er_8_3','er_11_3','nh_1_4','nh_12_4','nh_3_1','nh_7_1','nh_12_1']),{foes:4,big:true}), {v,F}=L; const f=F[0]; at(L,F[3],0,5);
  near(hitOn(L,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,1000,{src:F[2]}))*0.91*0.925,'(only the two near her: Black Glass Wall; a melee enemy: Sixteen)');
  setStack(L,'pyShim',7); setDb(L,f,5); castL(L,f); L.T.s.pyTop=f; setMk(L,f,'pyCin'); L.T.s.zn.pyAsh=[{x:f.x,y:f.y,r:3*V.METER,until:V.now()+99,centre:false,min:0}];
  near(hitOn(L,1000,{src:f}),plainHit(L,()=>hitOn(L,1000,{src:f}))*0.60,'all of them at once: 40% off, never more');
  near(L.T.fn.drK(api(L),L.T,v,f,'phys',false),0.60,'(the pure function the 95% check reads)');
  setStack(L,'pyShim',2); L.T.s.zn.pyAsh=[]; L.T.s.pyTop=null; f._talM[v.uid].pyCin.until=0; at(L,F[3],0,30); setDb(L,f,0); V.step(1);
  near(L.T.fn.drK(api(L),L.T,v,f,'phys',false),0.94*0.925*(scorched(L,f)?0.925:1),'(two Shimmer, a melee enemy, Scorched by her: the shares multiply)');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Pyroclast: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['db_1_1','db_2_2','er_1_1','er_2_3','nh_1_1','nh_1_4','nh_2_2','db_9_4']), TEAM=['vael','sylthaine','vireo','vex','pyroclast'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let debt=0, pkw=0, ash=0, sc=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const k in (T0.pyDb||{})) debt=Math.max(debt,T0.pyDb[k].n); if((T0.zn.pyAsh||[]).length) ash++;
    for(const f of VMX('units')){ const o=f._talM&&f._talM[s.uid]; if(o&&o['#pyPk']) pkw=Math.max(pkw,o['#pyPk'].v); if(f.dots&&f.dots.some(d=>d._talO===s.uid&&d._talK==='pyL')) sc++; } }
  assert.ok(sc>0,'real Lash Scorches made hers'); assert.ok(debt>=1,'real Ember Debt: '+debt.toFixed(2)); assert.ok(mx.pyMag>=1,'real Magma: '+mx.pyMag); assert.ok(ash>0,'a real Ashfall');
  console.log('  live fight: max '+JSON.stringify(mx)+', debt '+debt.toFixed(2)+', written hits '+pkw+', Ashfall ticks '+ash+', Scorched enemy-ticks '+sc);
  determinism(H,TEAM);
});

/* The page lines her talents added (the 'at' line in Crownfire's case, the push line in Blazing Orbit's, Rising Heat's two numbers, a delivered skill's flight time):
   each is reached, and does what her rows need */
test('Pyroclast: the page lines her talents added are reached - Crownfire\'s at, the Orbit\'s push, Rising Heat\'s numbers, the shot\'s flight time',()=>{
  const L=lab(H,S(['db_7_1','nh_1_4','db_5_4','nh_5_3']),{foes:3,big:true}), {v,F}=L; let got=null; const T0=L.T, keep=T0.fn.cfAt; T0.fn.cfAt=function(A,T,u,c){ got=c; return keep.apply(this,arguments); };
  try{ castC(L,F[0]); } finally{ T0.fn.cfAt=keep; } assert.ok(got,'Crownfire\'s case runs her at rows'); assert.ok(got.raw>0&&Math.abs(got.pt.x-F[0].x)<1e-9,'with its centre and its damage before resists');
  orbAt(L,F[1]); castO(L,F[1]); assert.equal(stack(L,'pyShim'),1,'the Orbit\'s push line');
  orbAt(L,F[1]); castO(L,F[1]); at(L,F[1],10,0); const o=Object.assign({},VMX('KITS.pyroclast.green')); const n0=VMX('groundHazards.length'); v.target=F[2]; VMX('deliverLaunch')(v,'creeprot',o); const hz=VMX('groundHazards')[n0];
  const plainD=Math.max(0.12,Math.min(0.8,Math.hypot(F[2].x-v.x,F[2].y-v.y)/o.speed)); near(hz.delay,plainD/1.5,'the shot\'s flight time line (Turn and Burn: 50% faster)'); VMX('groundHazards.length='+n0);
  for(const f of F) f.dots.length=0; V.dot(F[0],1,99,1,F[1]); swing(L,F[0]); near(v.apMul,1+(0.09*(v.passMul||1)+0.02),'Rising Heat\'s share per enemy line',1e-9);
});

/* With nothing learned, whole seeded fights with Pyroclast in the line-up are identical to the pre-talent page (ee8edab8), seed by seed, and reach every page site her
   talents added: Crownfire's case, Blazing Orbit's push, Rising Heat at her swing, a delivered skill's launch. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Pyroclast: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every page site her talents added',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['pyroclast','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __pbN={cf:0,ob:0,push:0,swing:0,launch:0}; var __pbD=_doEffectCore, __pbL=deliverLaunch, __pbDD=_dealDamageCore;'+
    '_dealDamageCore=function(s,t){ if(s&&s.key==="pyroclast"&&_autoAtk) __pbN.swing++; return __pbDD.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ const me=u&&u.key==="pyroclast"&&(!o||!o.deliver||o._arrived); let L0=null; if(me){ if(type==="fireball") __pbN.cf++; if(type==="nova"){ __pbN.ob++; L0=enemiesOf(u).filter(e=>e.alive).map(e=>[e,e.x,e.y]); } }'+
    '  const r=__pbD.apply(this,arguments); if(L0) for(const [e,x,y] of L0) if(e.x!==x||e.y!==y) __pbN.push++; return r; };'+
    'deliverLaunch=function(u,type,o){ if(u&&u.key==="pyroclast") __pbN.launch++; return __pbL.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__pbN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.cf>0&&c.ob>0&&c.push>0&&c.launch>0&&c.swing>0,'the fights cast Crownfire ('+c.cf+') and Blazing Orbit ('+c.ob+', '+c.push+' enemies pushed) and launched her delivered skills ('+c.launch+'); her basic attacks ('+c.swing+') - Rising Heat is worked out at each of her swings'); }
  finally{ VMX('_doEffectCore=__pbD; deliverLaunch=__pbL; _dealDamageCore=__pbDD;'); }
  assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. Her base kit has no reduction of its own; her talent
   reductions are one capped group (40%). Each candidate build is 91 points legal; the most defensive is the one whose worst hit is reduced most. */
const DEF={ db:['db_4_3','db_9_2','db_11_4','db_10_3','db_8_4'],
            er:['er_8_3','er_11_3','er_9_4'],
            nh:['nh_1_4','nh_2_4','nh_12_4','nh_3_1','nh_7_1','nh_12_1','nh_4_1','nh_8_4','nh_3_3'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={db:0,er:1,nh:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,0,15.5,4.5][i]*V.METER; f.y=v.y+[0,5,0,12][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,0,0,-5][i]*V.METER; a.y=v.y-[5.5,11,16.5,5][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on her: every condition of her damage-reduction talents true at once - full Heat Shimmer, the attacker owing 5 Ember Debt, Scorched by her, the one that
   hit her most, inside Ashfall, carrying Cinders, a melee hero, two enemies within 3 m. Physical and magic, normal and critical, with her armour and magic resist; and
   again with glyph damage reduction at its 30% cap. */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.5*v.maxHp; v.shield=0; v.glyphDR=glyph||0;
  if(L.T){ const s=L.T.s; if(L.T.st.pyShim) s.k.pyShim=Object.assign(s.k.pyShim||{},{n:L.T.st.pyShim.max,t:99,idle:0});
    (s.pyDb||(s.pyDb={}))[f.uid]={n:5,k:99}; s.pyTop=f; V.dot(f,1,99,1,v); const d=f.dots[f.dots.length-1]; d._talO=v.uid; d._talK='pyL';
    const m=f._talM||(f._talM={}), o=m[v.uid]||(m[v.uid]={}); o.pyCin={t0:V.now(),until:V.now()+99,v:0}; s.zn.pyAsh=[{x:f.x,y:f.y,r:3*V.METER,until:V.now()+99,centre:false,min:0}]; }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Pyroclast: her most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and she is at 85% or more for well under half a fight',()=>{
  const cands=[[['db','er'],[61,30]],[['db','nh'],[61,30]],[['er','db'],[61,30]],[['er','nh'],[61,30]],[['nh','db'],[61,30]],[['nh','er'],[61,30]],[['db'],[91]],[['er'],[91]],[['nh'],[91]],[['nh','db','er'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0,st:{},stMax:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="pyroclast"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="pyroclast"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal;'+
    '    if(T&&T.s.pyLk){ for(const e of units){ if(e.team===u.team) continue; const k=e.uid; if(e.alive&&(e.stunned||0)>0&&(T.s.pyLk[k]>0||__dr.st[k]>0)){ __dr.st[k]=(__dr.st[k]||0)+dt; if(__dr.st[k]>__dr.stMax) __dr.stMax=__dr.st[k]; } else __dr.st[k]=0; } }'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys",false):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic",false):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=(k==="st")?{}:0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','pyroclast'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>20&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.equal(d.imm,0,'and she is never immune');
    assert.ok(d.te85<0.25*d.t,'at 85% or more for well under half of her time in the fights ('+pc(d.te85,d.t)+')');
    /* her one talent stun (Full Payment) in real fights: the longest one enemy stayed stunned in a row while she had stunned it */
    const L2=S(['db_1_1','db_2_2','db_4_2','db_5_2']), e=seeded(L2); console.log('  stun chain (Paid in Kind + Full Payment): the longest one enemy stayed stunned in a row with her stun on it '+e.stMax.toFixed(2)+' s');
    assert.ok(e.stMax<4.0,'never 4 s in a row ('+e.stMax.toFixed(2)+' s)'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
