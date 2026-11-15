'use strict';
/* Oakmir's talents as data on the mechanics layer (talents-mech/oakmir.js), group by group on the still field (tests/talents-lab.js), then whole fights, the
   no-talent identity of the page site his talents added (a fallen enemy-side body kept while he waits to regrow), and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off
   for one hit (plainHit) or worked out from the skill's own formula.
   ll(): the lab with Oakmir, two allies and three foes, everyone held. Places (metres from Oakmir, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0); A0 (0,-5.5) A1 (0,-11).
   Oakmir's body is 1.56 m in radius, a lab Vael's 2.01 m: A0 stands 1.93 m from him body to body (inside Shade's 3 m), A1 7.4 m.
   His skills pick ALLIES (lowest HP share; every ally; 20 m around the lowest), so the 14 Nov reach audit does not concern him (he is not in it).
   Run: node --test tests/talents-mech-oakmir.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='oakmir', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const brnd=x=>VMX('var __obr=(typeof __obr!=="undefined"&&__obr)?__obr:brnd; brnd=function(){ return '+x+'; };');
const brndBack=()=>VMX('if(typeof __obr!=="undefined"&&__obr){ brnd=__obr; __obr=null; }');
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const O=L=>L.T.s.ok, API=L=>L.T.s.api;
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const SL=10, SM=VMX('skillMul')(SL);
function ll(list,o){ o=o||{}; const L=lab(H,list,{allies:o.allies==null?2:o.allies,foes:o.foes==null?3:o.foes,big:o.big,seed:o.seed}); for(const x of L.U){ x.energy=0; } return L; }
const castMB=L=>V.cast(L.v,'green'), castRR=L=>V.cast(L.v,'blue'), castFS=L=>V.cast(L.v,'ult');
const tru=o=>Object.assign({kind:'true'},o||{});
const hitOn=(L,src,t,amt,o)=>lost(t,()=>V.hit(src,t,amt||1000,tru(o)));
const ratioIn=(L,src,t,o)=>{ const h=t.hp, s=t.shield; const a=hitOn(L,src,t,1000,o); t.hp=h; t.shield=s; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; t.shield=s; return a/b; };
const ratioOut=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const healGot=(t,fn)=>{ const h=t.hp; fn(); return t.hp-h; };
const low=(x,f)=>{ x.hp=x.maxHp*f; };
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };   // a unit that is not held but does nothing
const dm=(L,t)=>VMX('defMul')(L.v,t,'magic');
const ap=L=>L.v.apow*((L.v.dmgBuffT>0)?(L.v.dmgBuffMul||1):1);
const mbHot=(L,x)=>(x.hots||[]).find(h=>h._talU===L.v&&h._talK==='mb');
const sapMax=L=>{ const r=L.T.r; return L.v.maxHp*(0.10+0.01*(r.hw_1_1||0)+0.02*(r.hw_2_1||0)); };
const atGap=(L,u,g)=>{ const d=g+V.bodyR(L.v)+V.bodyR(u); at(L,u,d*Math.SQRT1_2,-d*Math.SQRT1_2); };   // a unit set g metres (body to body) from him, down and to the right
const waveChange=L=>{ V.wave(); VMX('battleTime=0'); V.step(1); };   // a new wave: the game's clock starts again at 0 (beginWaveEnter)

test('Oakmir: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['hw_1_3','hw_6_4','hw_10_3','tw_3_4','tw_7_4','tw_12_1','ty_3_2','ty_7_4','ty_1_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const M=FXN.mech(H); for(const id of ['hw_13_2','tw_13_3','ty_13_3','hw_n1','hw_1_1','tw_2_3','ty_1_4','ty_4_1','ty_2_3']) assert.ok(M.talents[id],id);
});

test('Oakmir: his real kit, as the talents read it - Mending Bloom on the lowest HP share, Rally Roots on everyone, First Spring within 20 m, Deep Roots once per ally',()=>{
  const L=ll(null), {v,A,F}=L; assert.ok(!v._tal,'no talents: no runtime');
  low(A[0],0.5); castMB(L); const h=A[0].hots[A[0].hots.length-1]; near(h.hps,A[0].maxHp*0.06*SM,'Mending Bloom: 6% of the ally\'s max HP x skill level a second',1e-9); assert.equal(h.remaining,6,'for 6 s');
  A[0].hots.length=0; A[0].hp=A[0].maxHp; low(v,0.3); castMB(L); assert.ok(v.hots.length>0,'(the lowest HP SHARE: himself too)'); v.hots.length=0; v.hp=v.maxHp;
  low(A[0],0.5); low(A[1],0.5); const g0=healGot(A[0],()=>castRR(L)); near(g0,A[0].maxHp*0.22*SM*(v.healPowMul||1),'Rally Roots: 22% of max HP x skill level x his healing power',1e-9);
  low(A[0],0.2); low(A[1],0.4); const f0=A[1].hp; castFS(L); near(A[1].hp-f0,A[1].maxHp*0.5*SM*(v.healPowMul||1),'First Spring: half their max HP x skill level (A1 is 5.5 m from the bloom under A0)',1e-9);
  const rg=A[1].hots[A[1].hots.length-1]; near(rg.hps,A[1].maxHp*0.04*SM,'and a regrowth of 4% x skill level a second',1e-9); assert.equal(rg.remaining,5,'for 5 s');
  for(const a of A){ a.hots.length=0; a.hp=a.maxHp; }
  const P=ll(null), x=P.A[0]; low(x,0.25); const h0=x.hp; secs(4.2); assert.ok(x._drUsed&&x._drBy===P.v,'Deep Roots caught it');
  near(x.hp-h0,x.maxHp*0.25*P.v.passMul,'25% of its max HP x his passive\'s strength over 4 s',1e-6); low(x,0.2); const h1=x.hp; secs(1); assert.equal(x.hp,h1,'once per ally per fight');
  const K=ll(S(['tw_1_4'])); let kind=null; FX.define(H,{hero:H,talents:{tw_1_4:[{on:'out',do:[{fn:'k'}]}]},fn:{k(A,T,u,c){ if(c.auto) kind=c.kind; }}}); const K2=ll(S(['tw_1_4'])); V.hit(K2.v,K2.F[0],10,{auto:true}); assert.equal(kind,'magic','his basic attacks are magic (damage profile Healer)'); void K;
});

/* ======================= HEARTWOOD ======================= */
test('Oakmir / Sap: Rising Sap and Deep Sap (10% + 1% x 5 + 2% x 3 of his max HP), Sap Reserve (2% x 3 at each wave start), the pour below 50% (Sweet Sap 3% x 5), Still Wood, Ringed Trunk',()=>{
  const L=ll(S(['hw_1_1','hw_2_1','hw_8_1','hw_4_1','hw_11_1','hw_3_3'])), {v,A,F}=L, o=O(L);
  near(o.sap,0.06*v.maxHp,'Sap Reserve: the wave starts with 6% of his max HP',1e-9);
  near(ratioIn(L,F[0],v),1-0.075,'Still Wood: 1.5% x 5 less while Sap is stored',1e-9);
  for(const x of [v,A[0],A[1]]) x.hp=x.maxHp; castRR(L); near(o.sap,sapMax(L),'overheal fills it, up to 21% of his max HP',1e-9); near(sapMax(L),0.21*v.maxHp,'(10% + 5% + 6%)',1e-9);
  o.sap=200; low(A[1],0.6); V.step(1); low(A[1],0.4); const g=healGot(A[1],()=>V.step(1)); near(g,200*1.15,'A1 dropped below 50%: all of it pours in, 15% more',1e-6); assert.equal(o.sap,0,'Sap spent');
  near(ratioIn(L,F[0],v),0.90,'Ringed Trunk: 2% x 5 less for 4 s after a pour',1e-9); secs(4.1); near(ratioIn(L,F[0],v),1,'then nothing (no Sap stored)',1e-9);
  low(A[1],0.45); const g2=healGot(A[1],()=>V.step(1)); assert.equal(g2,0,'no pour without crossing 50% again');
  const Q=ll(S(['hw_1_1'])); const p=O(Q); near(p.sap,0,'(no Sap Reserve: empty)'); p.sap=50; low(Q.A[0],0.55); V.step(1); low(Q.A[0],0.48); near(healGot(Q.A[0],()=>V.step(1)),50,'(Rising Sap alone: the pour as it is)',1e-9);
});

test('Oakmir / Sap Bloom, First Green (LINK: 4% for 3 s; with Turn of Seasons Spring at once, 2 s longer, once every 12 s - a countdown across a wave change), Sap Spring',()=>{
  const L=ll(S(['hw_1_1','hw_2_1','hw_3_1','hw_n1','hw_10_1','ty_1_4'])), {v,A,F}=L, o=O(L);
  o.sap=300; low(A[0],0.6); const g=healGot(A[0],()=>castMB(L)); near(g,300,'Sap Bloom: Mending Bloom pours all of it into its ally at once',1e-6); assert.equal(o.sap,0);
  near(ratioIn(L,F[0],A[0]),0.96,'First Green: that ally takes 4% less',1e-9); secs(3.1); near(ratioIn(L,F[0],A[0]),1,'for 3 s',1e-9);
  assert.equal(o.sea.i,0,'(the pour turned the year to Spring)'); o.sea.i=1; o.sea.t=5; o.sap=100; A[0].hots.length=0; low(A[0],0.6); castMB(L); assert.equal(o.sea.i,1,'not again inside 12 s');
  A[0].hots.length=0; low(A[0],0.55); low(A[1],0.6); V.step(1); o.sap=100; low(A[1],0.45); const s0=healGot(A[0],()=>V.step(1)); near(s0,0.03*A[0].maxHp,'Sap Spring: every other ally in Shade heals 1% x 3 of its max HP',1e-6);
  const W=ll(S(['hw_1_1','hw_n1','ty_1_4'])), w=O(W); w.sap=50; low(W.A[0],0.6); V.step(1); low(W.A[0],0.4); V.step(1); assert.equal(w.sea.i,0); near(w.sea.t,6+2,'Spring, 2 s longer',0.05);
  secs(6); w.sea.i=1; w.sea.t=9; waveChange(W); secs(6.2); w.sea.i=1; w.sea.t=9; w.sap=50; low(W.A[0],0.6); V.step(1); low(W.A[0],0.4); V.step(1);
  assert.equal(w.sea.i,0,'12 s of fight later, across a wave change (the clock restarted at 0), the lock has run out: Spring again');
});

test('Oakmir / Brimming (Sap full: 15% on the lowest-HP ally) and Ever Green (Sap full: overheal shields the lowest Grafted ally, 2% x 3 of his max HP, 4 s)',()=>{
  const L=ll(S(['hw_8_1','hw_9_1'])), {v,A}=L, o=O(L); low(A[0],0.2); low(A[1],0.6); o.sap=sapMax(L);
  const a=healGot(A[0],()=>{ const b=healGot(A[1],()=>castRR(L)); L.b=b; }); near(a/L.b,1.15,'15% more on the lowest',1e-9);
  o.sap=0; low(v,0.5); low(A[0],0.2); low(A[1],0.6); const c=healGot(A[0],()=>{ L.b=healGot(A[1],()=>castRR(L)); }); near(c/L.b,1,'(not when Sap is not full)',1e-9);
  const E=ll(S(['hw_12_3','hw_4_4'])), e=O(E); e.gr[E.A[1].uid]=E.A[1]; e.sap=sapMax(E); for(const x of [E.v,E.A[0],E.A[1]]) x.hp=x.maxHp; E.A[1].shield=0;
  castRR(E); near(E.A[1].shield,0.06*E.v.maxHp,'the overheal becomes a shield on the Grafted ally, up to 6% of his max HP',1e-9); near(E.A[1].shieldT,4,'for 4 s',1e-9); assert.ok(!(E.A[0].shield>0),'(not on the ungrafted one)');
  castRR(E); near(E.A[1].shield,0.06*E.v.maxHp,'(never above it)',1e-9);
});

test('Oakmir / Shade: Under the Boughs (3 m, 1% x 5), Spreading Crown (0.5 m x 3), Forest Floor (kept 0.4 s x 5), Canopy Song (1% x 5 more healing), Grove Rally and Roots Run Deep',()=>{
  const L=ll(S(['hw_2_2','hw_4_2','hw_7_1','hw_9_3','hw_7_2','hw_9_2'])), {v,A,F}=L, o=O(L);
  assert.ok(o.sh[A[0].uid],'A0 (1.93 m) stands in his Shade'); near(ratioIn(L,F[0],A[0]),0.95,'5% less',1e-9); near(ratioIn(L,F[0],A[1]),1,'not A1',1e-9);
  atGap(L,A[1],4.3); V.step(1); assert.ok(o.sh[A[1].uid],'Spreading Crown: 4.5 m'); atGap(L,A[1],4.7); V.step(1); assert.ok(!o.sh[A[1].uid],'not 4.7 m');
  near(ratioIn(L,F[0],A[1]),0.95,'Forest Floor: it keeps the protection'); secs(2.1); near(ratioIn(L,F[0],A[1]),1,'for 2 s',1e-9); at(L,A[1],0,-11); V.step(1);
  low(A[0],0.5); near(healGot(A[0],()=>V.heal(A[0],1000)),1050,'Canopy Song: 5% more healing received in Shade',1e-6);
  low(A[0],0.5); low(A[1],0.5); const a=healGot(A[0],()=>{ L.b=healGot(A[1],()=>castRR(L)); }); near(a/L.b,1.05*(1+0.10+0.10),'Rally Roots in Shade: Grove Rally 10% + Roots Run Deep 2% x 5 (and Canopy Song)',1e-9);
  const G=ll(S(['hw_1_1','hw_7_2'])), g=O(G); for(const x of [G.v,G.A[1]]) low(x,0.5); G.A[0].maxHp=600; G.A[0].hp=550; g.sap=0; castRR(G);
  assert.ok(g.sap<sapMax(G)); near(g.sap,2*(0.22*SM*600*(G.v.healPowMul||1)*1.10-50),'Grove Rally: Rally Roots\' overheal counts double toward Sap',1e-6);
});

test('Oakmir / Dense Canopy (2 m, doubled), Deep Shadow (3% x 3 from enemy ultimates), Wide Canopy (2 m farther, 0.5% a second, Dappled Light 0.15% x 3)',()=>{
  const L=ll(S(['hw_2_2','hw_5_2','hw_6_2'])), {v,A,F}=L, o=O(L);
  assert.ok(o.sh[A[0].uid],'(A0 at 1.93 m: inside 2 m)'); near(ratioIn(L,F[0],A[0]),0.90,'doubled: 10%',1e-9);
  at(L,A[0],0,-(2.1+1.56+2.01)); V.step(1); assert.ok(!o.sh[A[0].uid],'2 m: 2.1 m is out'); at(L,A[0],0,-5.5); V.step(1);
  F[0]._castSlot='ult'; near(ratioIn(L,F[0],A[0]),0.90*0.91,'Deep Shadow: 9% less from an enemy ultimate',1e-9); near(ratioIn(L,F[0],A[0],{auto:true}),0.90,'(not a basic attack)',1e-9); F[0]._castSlot=null;
  const W=ll(S(['hw_2_2','hw_5_3','hw_6_3'])), w=O(W); atGap(W,W.A[1],5.2); V.step(1); assert.ok(!w.sh[W.A[1].uid],'(5.2 m: out)'); atGap(W,W.A[1],4.8); V.step(1); assert.ok(w.sh[W.A[1].uid],'Wide Canopy: 5 m'); low(W.A[1],0.5); w.h1=0;
  const g=healGot(W.A[1],()=>secs(1.01)); near(g,W.A[1].maxHp*0.0095,'0.5% + 0.45% of its max HP a second',1e-6);
});

test('Oakmir / Graft: Deep Roots grafts its ally (never himself), Grafted Root (4% x 3 of every heal on him), Shared Rings, Kept Close, Heavy Limbs, Bound Bark (once every 5 s), Shared Heartwood',()=>{
  const L=ll(S(['hw_4_4','hw_5_4','hw_7_4','hw_10_4','hw_11_4','hw_12_1'])), {v,A,F}=L, o=O(L);
  low(A[0],0.25); V.step(2); assert.ok(o.gr[A[0].uid],'Deep Roots caught A0: Grafted'); low(v,0.25); V.step(2); assert.ok(!o.gr[v.uid],'(he never grafts himself)'); v.hp=v.maxHp;
  near(A[0].maxHp,1e9*1.05,'Shared Rings: 1% x 5 more max HP',1e-9); near(ratioIn(L,F[0],A[0]),0.95,'Kept Close: 1% x 5 less',1e-9);
  near(ratioIn(L,F[0],v),0.98,'Heavy Limbs: 1% x 2 per Grafted ally',1e-9); o.gr[A[1].uid]=A[1]; near(ratioIn(L,F[0],v),0.96,'(two)',1e-9);
  secs(5); low(A[0],0.5); near(healGot(A[0],()=>V.heal(v,1000)),120,'Grafted Root: 12% of a heal on him reaches each Grafted ally',1e-6);
  low(A[0],0.6); const h=A[0].hp, hit=0.2*A[0].maxHp; V.hit(F[0],A[0],hit,tru()); const lostH=h-A[0].hp; const g=healGot(A[0],()=>V.step(1)); near(g,0.06*A[0].maxHp,'Bound Bark: a hit over 15% of its max HP: healed 2% x 3 of its max HP',1e-6); assert.ok(lostH>0.15*A[0].maxHp);
  V.hit(F[0],A[0],hit,tru()); assert.equal(healGot(A[0],()=>V.step(1)),0,'not again inside 5 s'); secs(5); V.hit(F[0],A[0],hit,tru()); near(healGot(A[0],()=>V.step(1)),0.06*A[0].maxHp,'again after 5 s',1e-6);
  delete o.gr[A[1].uid]; V.step(1); low(A[0],0.4); low(A[1],0.5); const a=healGot(A[0],()=>{ L.b=healGot(A[1],()=>castRR(L)); }); const share=0.12*0.22*SM*v.maxHp*(v.healPowMul||1); near((a-share)/A[0].maxHp/(L.b/A[1].maxHp),1.075,'Shared Heartwood: 1.5% x 5 stronger on a Grafted ally',1e-9);
});

test('Oakmir / Deep Roots: Root Memory (5% x 2), Slow Heart (0.5 s x 3 longer, 4% x 3 more), Grasping Ground (slowed 4% x 5 for 3 s within 3 m), Root Grip (rooted 0.4 s x 3 within 2 m)',()=>{
  const L=ll(S(['hw_8_4','hw_12_4','tw_5_2','tw_10_3'])), {v,A,F}=L, o=O(L); at(L,F[2],4.2,-5.5); F[2].slow=0;
  low(A[0],0.25); const h=A[0].hp; V.step(2); near(A[0]._drLeft,4+1.5-2*V.STEP,'Slow Heart: 1.5 s longer',1e-6);
  assert.ok(F[2].slow>2.9&&Math.abs(F[2].slowMul-0.80)<1e-9,'Grasping Ground: the enemy beside it slowed 20% for 3 s'); assert.ok(!(F[0].slow>0),'(not one 3.1 m away)');
  near(o.rt[F[2].uid],1.2,'Root Grip: rooted 1.2 s',1e-6); V.step(1); assert.equal(F[2].speed,0,'(a root: it cannot move)'); assert.ok(!o.rt[F[0].uid]);
  secs(6); near(A[0].hp-h,A[0].maxHp*0.25*v.passMul*(1+0.10+0.12),'the same heal plus 10% and 12%, over 5.5 s',1e-6);
  assert.ok(F[2].speed>0,'the root is over');
});

test('Oakmir / his skills\' heals: Broad Leaves, Leafing, Slow Mending (0.3 s x 5: a part tick), Green Patience, Leaf Mulch, Steady Boughs, Rough Rally, Spring Rain, Lingering Spring',()=>{
  const L=ll(S(['hw_2_3','ty_3_1','hw_6_1','hw_8_3','hw_5_1','hw_3_4','tw_4_1','ty_2_2','hw_12_2'])), {v,A,F}=L;
  low(A[0],0.35); castMB(L); const hh=mbHot(L,A[0]); assert.equal(hh.remaining,8); near(hh._talF,0.5,'Slow Mending: 1.5 s longer, ending on a half tick',1e-9);
  near(ratioIn(L,F[0],A[0]),0.95,'Leaf Mulch: 1% x 5 less under Mending Bloom',1e-9);
  const g=healGot(A[0],()=>secs(8.2)); near(g,A[0].maxHp*0.06*SM*(1+0.09+0.10)*7.5,'Broad Leaves 3% x 3 + Leafing 2% x 5, 7.5 ticks',1e-6); near(ratioIn(L,F[0],A[0]),1,'(over)',1e-9);
  near(VMX('TalentFx').cd(v,'green',7),6.5,'Green Patience: 0.1 s x 5 sooner',1e-9);
  low(A[0],0.4); near(healGot(A[0],()=>castRR(L)),A[0].maxHp*0.22*SM*(v.healPowMul||1)*1.28,'Rally Roots: 10% + 9% + 9% more',1e-9);
  for(const a of A){ a.hots.length=0; a.hp=a.maxHp; } low(A[0],0.2); low(A[1],0.3); castFS(L); const rg=(A[1].hots||[]).find(h=>h._talU===v&&h._talK==='fs'); assert.ok(rg,'the regrowth is his');
  const b=A[1].hp; V.step(Math.round(1.02/V.STEP)); near(A[1].hp-b,A[1].maxHp*0.04*SM*1.15,'Lingering Spring: 3% x 5 more',1e-6);
});

test('Oakmir / Thick Bark: the first hit each wave 15% x 3 less (no more after it, again the next wave)',()=>{
  const L=ll(S(['hw_1_4'])), {v,F}=L; near(ratioIn(L,F[0],v),0.60,'45% less, inside his 40% group: 40%',1e-9); near(ratioIn(L,F[0],v),1,'the second hit: nothing',1e-9);
  waveChange(L); near(ratioIn(L,F[0],v),0.60,'the next wave: again',1e-9);
  const M=ll(full(H,['hw_1_4']).map(([id])=>[id,1])); near(ratioIn(M,M.F[0],M.v),0.85,'(rank 1: 15%)',1e-9);
});

test('Oakmir / The Grove Stands (SIGNATURE): First Spring with Sap full - 8 s, the whole team in Shade wherever they stand, its cut tripled, every ally Grafted, Deep Roots once more',()=>{
  const L=ll(S(['hw_13_2','hw_2_2','hw_1_1'])), {v,A,F}=L, o=O(L); o.sap=sapMax(L)*0.5; low(A[0],0.2); castFS(L); assert.ok(!(o.grove>0),'not without Sap full');
  for(const a of A){ a.hots.length=0; a.hp=a.maxHp; } o.sap=sapMax(L); low(A[0],0.2); castFS(L); V.step(1); assert.ok(o.grove>7.9,'8 s');
  assert.ok(o.sh[A[1].uid]&&o.sh[v.uid],'A1 (7.4 m away) and Oakmir himself stand in it'); near(ratioIn(L,F[0],A[1]),0.85,'5% tripled: 15%',1e-9); near(ratioIn(L,F[0],v),0.85,'(on him too)',1e-9);
  assert.ok(o.gr[A[0].uid]&&o.gr[A[1].uid]&&!o.gr[v.uid],'every ally Grafted');
  for(const a of A){ a.hots.length=0; a.hp=a.maxHp; } low(A[1],0.25); V.step(2); assert.ok(A[1]._drUsed); secs(4.2); assert.ok(!A[1]._drUsed,'its catch is over: Deep Roots can catch it once more');
  low(A[1],0.25); const h=A[1].hp; V.step(2); assert.ok(A[1]._drUsed&&A[1].hp>h,'caught again'); secs(4.2); assert.ok(A[1]._drUsed,'and not a third time');
  const Q=ll(S(['hw_13_2','hw_2_2','hw_1_1'])), q=O(Q); low(Q.A[0],0.25); V.step(2); secs(4.2); assert.ok(Q.A[0]._drUsed,'(A0 caught before)');
  q.sap=sapMax(Q); low(Q.A[1],0.2); castFS(Q); assert.ok(!Q.A[0]._drUsed,'an ally whose catch was already over can be caught once more at once'); secs(7.85); near(ratioIn(Q,Q.F[0],Q.A[1]),0.85,'(still at 7.85 s)',1e-9); secs(0.3); near(ratioIn(Q,Q.F[0],Q.A[1]),1,'over after 8 s',1e-9);
});

/* ======================= THE THORNED WOOD ======================= */
test('Oakmir / Thorns: Briar Skin (under Mending Bloom: 8% x 5 of his ability power back at each enemy basic attack, magic), Long Thorns (1 s x 3), Sharp Bark (3% x 5), Heartrot from a bite',()=>{
  const L=ll(S(['tw_1_2','tw_2_2','tw_6_2','tw_4_4'])), {v,A,F}=L, o=O(L); low(A[0],0.2); castMB(L);
  const x=lost(F[0],()=>V.hit(F[0],A[0],1000,{kind:'phys',auto:true})); near(x,ap(L)*0.40*1.15*dm(L,F[0]),'a bite: 40% x 1.15 of his ability power, through magic resist',1e-6);
  assert.equal(o.hr[F[0].uid].n,1,'Rotting Grip: 1 Heartrot');
  assert.equal(lost(F[0],()=>V.hit(F[0],A[0],1000,{kind:'phys'})),0,'(not a skill hit)'); assert.equal(lost(F[1],()=>V.hit(F[1],A[1],1000,{kind:'phys',auto:true})),0,'(not on an ally without Thorns)');
  V.step(1); A[0].hots.length=0; V.step(1); assert.ok(lost(F[0],()=>V.hit(F[0],A[0],1000,{kind:'phys',auto:true}))>0,'Long Thorns: kept after Mending Bloom ends'); secs(3.1); assert.equal(lost(F[0],()=>V.hit(F[0],A[0],1000,{kind:'phys',auto:true})),0,'for 3 s');
});

test('Oakmir / Spearwood (Thorns 30% less) vs Bramblewood (each bite plants an Acorn), Barbed Hedge (5% x 3 at 2 Acorns), Bitter Spring, Barkbound (below 40%: 15% x 2 and an Acorn)',()=>{
  const B=ll(S(['tw_1_2','tw_5_3','tw_6_3','tw_12_4','tw_2_3'])), {v,A,F}=B, o=O(B); low(A[0],0.45); castMB(B);
  const b1=lost(F[0],()=>V.hit(F[0],A[0],1000,{kind:'phys',auto:true})); assert.equal(o.ac[F[0].uid].n,1,'Bramblewood: an Acorn per bite'); near(b1,ap(B)*0.40*dm(B,F[0]),'(no Hedge below 2 Acorns)',1e-6);
  const b2=lost(F[0],()=>V.hit(F[0],A[0],1000,{kind:'phys',auto:true})); near(b2,ap(B)*0.40*dm(B,F[0]),'(no Hedge at 1 Acorn)',1e-6); assert.equal(o.ac[F[0].uid].n,2); const b3=lost(F[0],()=>V.hit(F[0],A[0],1000,{kind:'phys',auto:true}));
  near(b3-ap(B)*0.40*1.15*dm(B,F[0]),ap(B)*0.75*dm(B,F[0]),'Barbed Hedge 15% at 2 Acorns, then the third Acorn sprouts (75% of his ability power)',1e-6);
  low(A[0],0.3); const d=lost(F[1],()=>V.hit(F[1],A[0],1000,{kind:'phys',auto:true})); near(d,ap(B)*0.40*1.30*dm(B,F[1]),'Barkbound: 30% more below 40%',1e-6); assert.equal(o.ac[F[1].uid].n,2,'and one more Acorn per bite');
  const S1=ll(S(['tw_1_2','tw_5_1'])); low(S1.A[0],0.5); castMB(S1); near(lost(S1.F[0],()=>V.hit(S1.F[0],S1.A[0],1000,{kind:'phys',auto:true})),ap(S1)*0.40*0.7*dm(S1,S1.F[0]),'Spearwood: Thorns return 30% less',1e-6);
  const BS=ll(S(['tw_1_2','tw_11_3','tw_12_3'])); low(BS.A[0],0.2); castFS(BS); near(lost(BS.F[0],()=>V.hit(BS.F[0],BS.A[1],1000,{kind:'phys',auto:true})),ap(BS)*0.40*1.20*dm(BS,BS.F[0]),'Bitter Spring: First Spring\'s Thorns 4% x 5 more',1e-6);
});

test('Oakmir / Rally the Briars (3 s, Thorned Rally 0.4 s x 5) and Spring of Thorns (5 s; 3 Acorns at once on every enemy within 6 m of the bloom)',()=>{
  const L=ll(S(['tw_1_2','tw_7_3','tw_9_3'])), {v,A,F}=L, o=O(L); low(A[1],0.5); castRR(L); near(o.th[A[1].uid].ra,5,'every ally it heals: Thorns for 5 s',1e-9);
  assert.ok(lost(F[0],()=>V.hit(F[0],A[1],1000,{kind:'phys',auto:true}))>0); secs(5.1); assert.equal(lost(F[0],()=>V.hit(F[0],A[1],1000,{kind:'phys',auto:true})),0,'over');
  const G=ll(S(['tw_1_2','tw_11_3','tw_2_3'])), g=O(G); low(G.A[0],0.2); const f0=G.F[0].hp, f1=G.F[1].hp; castFS(G);
  near(f0-G.F[0].hp,ap(G)*0.75*dm(G,G.F[0]),'F0 (5.1 m from the bloom under A0, body edge): 3 Acorns, they sprout',1e-6); assert.ok(g.rt[G.F[0].uid]>0,'(rooted)'); assert.equal(G.F[1].hp,f1,'F1 (9.4 m): nothing');
  near(g.th[G.A[1].uid].sp,5,'Thorns for 5 s',1e-9);
});

test('Oakmir / Acorns: Acorn Shot (each basic attack, max 3, 6 s; at 3 a 0.5 s root and 15% x 5 of his ability power), Deep Planting, Seed Store, Sprouting Energy, Hollow Trunk (RISK), Scattered Seed',()=>{
  const L=ll(S(['tw_2_3','tw_4_3','tw_8_1','tw_10_4','tw_6_4','tw_9_1'])), {v,A,F}=L, o=O(L); o.ac[F[1].uid]={n:2,t:9};
  const one=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],10,{auto:true}))); V.hit(v,F[0],10,{auto:true}); V.hit(v,F[0],10,{auto:true}); assert.equal(o.ac[F[0].uid].n,2,'2 Acorns');
  const e0=v.energy, x=lost(F[0],()=>V.hit(v,F[0],10,{auto:true})); near(x-one,ap(L)*0.75*1.16*dm(L,F[0]),'the third sprouts: 75% x 1.16 (Hollow Trunk) of his ability power',1e-6);
  assert.ok(!o.ac[F[0].uid],'(spent)'); near(o.rt[F[0].uid],1.1,'Deep Planting: rooted 0.5 + 0.6 s',1e-9); assert.equal(v.energy-e0,3,'Sprouting Energy: 1 x 3');
  assert.equal(o.ac[F[1].uid].n,2,'Scattered Seed: F1 (1.48 m away) is left an Acorn but never sprouts by it'); assert.ok(!o.ac[F[2].uid],'(not F2)');
  near(ratioIn(L,F[0],v),1.06,'Hollow Trunk: he takes 3% x 2 more',1e-9);
  V.hit(v,F[0],10,{auto:true}); secs(8.9); assert.equal(o.ac[F[0].uid].n,1,'Seed Store: 9 s'); secs(0.2); assert.ok(!o.ac[F[0].uid],'then gone');
  const W=ll(S(['tw_2_3','tw_5_1','tw_6_1'])), w=O(W); V.hit(W.v,W.F[0],10,{auto:true}); assert.equal(w.ac[W.F[0].uid].n,2,'Spearwood: 2 Acorns a basic attack');
  w.ac[W.F[0].uid]={n:1,t:9}; const h=W.F[0].hp, aa=lost(W.F[0],()=>V.hit(W.v,W.F[0],1000,tru({auto:true}))); W.F[0].hp=h; const bb=plainHit(W,()=>lost(W.F[0],()=>V.hit(W.v,W.F[0],1000,tru({auto:true})))); W.F[0].hp=h;
  near(aa-ap(W)*0.75*dm(W,W.F[0]),bb*1.12,'Split Shaft: 4% x 3 more on an enemy carrying Acorns',1e-9);
});

test('Oakmir / roots and the rooted: a real root (cannot move, still attacks), Hard Rind, Snarl, Slow Fury, Woodland Ward, Oak Strength, Briar Bloom (0.8 s within 2 m of Mending Bloom\'s ally)',()=>{
  const L=ll(S(['tw_1_1','tw_10_2','tw_11_1','tw_11_4','tw_1_2','tw_3_1','tw_3_2'])), {v,A,F}=L, o=O(L);
  near(ratioIn(L,F[0],v),1,'(nobody rooted)',1e-9); o.rt[F[0].uid]=2; V.step(1); assert.equal(F[0].speed,0,'rooted: it cannot move');
  near(ratioIn(L,F[0],v),0.94,'Hard Rind: 2% x 3 less from a rooted enemy',1e-9); F[1].slow=2; near(ratioIn(L,F[1],v),0.94,'(or a slowed one)',1e-9); F[1].slow=0;
  near(ratioOut(L,A[0],F[0]),1.10,'Snarl: a rooted enemy takes 2% x 5 more from his whole team',1e-9); near(ratioOut(L,v,F[0],{auto:true}),1.10*1.15,'Slow Fury: his basic attacks 3% x 5 more',1e-9);
  low(A[0],0.2); castMB(L); near(ratioIn(L,F[0],A[0],{auto:false}),0.925,'Woodland Ward: an ally with Thorns 1.5% x 5 less from a rooted enemy',1e-9); near(ratioIn(L,F[0],A[1]),1,'(not one without Thorns)',1e-9);
  L.T.fn.root(API(L),L.T,v,F[1],9); near(o.rt[F[1].uid],4,'a root never lasts more than 4 s',1e-9); delete o.rt[F[1].uid];
  near(lost(F[0],()=>V.hit(F[0],A[0],1000,{kind:'phys',auto:true})),ap(L)*0.40*1.10*1.10*dm(L,F[0]),'Oak Strength: a bite on a rooted enemy 2% x 5 more (Snarl too)',1e-6);
  A[0].hots.length=0; o.rt={}; at(L,F[2],4.2,-5.5); V.step(1); low(A[0],0.2); castMB(L); near(o.rt[F[2].uid],0.8,'Briar Bloom: the enemy beside its ally rooted 0.8 s',1e-9); assert.ok(!o.rt[F[0].uid],'(not one 3.1 m away)');
  secs(0.9); assert.ok(F[2].speed>0,'it moves again');
});

test('Oakmir / Heartrot: Rotting Grip (1% x 5 less healing a stack, max 5, 6 s; Rotwood 0.4 s x 5), Choking Rot (at 5: 3% x 2 slower), Rot to the Core (1% x 3 armor a stack), Wooden Heart',()=>{
  const L=ll(S(['tw_4_4','tw_12_2','tw_8_4','tw_5_4','tw_8_2'])), {v,A,F}=L, o=O(L), a=API(L); const arm=F[0].armorRating, ai=F[0].atkInterval;
  L.T.fn.root(a,L.T,v,F[0],0.5); assert.equal(o.hr[F[0].uid].n,1,'rooted by him: 1 Heartrot'); low(F[0],0.5); near(healGot(F[0],()=>V.heal(F[0],1000)),950,'5% less healing',1e-6);
  near(ratioIn(L,F[0],v),0.95,'Wooden Heart: 1% x 5 less from an enemy with Heartrot',1e-9);
  for(let i=0;i<3;i++) L.T.fn.rot(a,L.T,v,F[0],1); assert.equal(o.hr[F[0].uid].n,4); V.step(1); near(F[0].atkInterval,ai,'(Choking Rot: not at 4)',1e-9);
  for(let i=0;i<3;i++) L.T.fn.rot(a,L.T,v,F[0],1); assert.equal(o.hr[F[0].uid].n,5,'max 5'); V.step(1); near(healGot(F[0],()=>V.heal(F[0],1000)),750,'25% less',1e-6);
  near(F[0].atkInterval/ai,1/0.94,'Choking Rot: 6% slower attacks at 5',1e-9); near(F[0].armorRating/arm,0.85,'Rot to the Core: 3% x 5 less armor',1e-9);
  secs(7.9); assert.equal(o.hr[F[0].uid].n,5,'Rotwood: 8 s'); secs(0.2); assert.ok(!o.hr[F[0].uid]); V.step(1); near(F[0].armorRating,arm,'its armor back',1e-9);
});

test('Oakmir / The Wood Remembers (SIGNATURE): 8 s after First Spring an enemy that strikes his side is rooted 0.6 s (once every 3 s), its Acorns sprout, 5 Heartrot',()=>{
  const L=ll(S(['tw_13_3','tw_2_3'])), {v,A,F}=L, o=O(L); V.hit(F[0],A[0],100,tru()); assert.ok(!o.rt[F[0].uid],'not before First Spring');
  low(A[0],0.3); castFS(L); o.ac[F[0].uid]={n:2,t:6}; const x=lost(F[0],()=>V.hit(F[0],A[0],100,tru())); near(x,ap(L)*0.75*dm(L,F[0]),'its 2 Acorns sprout (Acorn Shot 15% x 5)',1e-6);
  assert.ok(o.rt[F[0].uid]>0.5,'rooted'); assert.equal(o.hr[F[0].uid].n,5,'5 Heartrot'); o.rt={}; V.hit(F[0],v,100,tru()); assert.ok(!o.rt[F[0].uid],'not again inside 3 s');
  secs(3.05); V.hit(F[0],v,100,tru()); near(o.rt[F[0].uid],0.6,'again after 3 s (a hit on him counts)',1e-9); secs(5); o.rt={}; V.hit(F[1],A[0],100,tru()); assert.ok(!o.rt[F[1].uid],'over after 8 s');
});

test('Oakmir / his hits: Heavy Spear (4% x 5), Angry Sap (2% x 5 magic, his talent damage too), Woodsman\'s Reach (3% x 3), Unbending, Weathered',()=>{
  const P=ll(null), r0=P.v.range; const L=ll(S(['tw_1_4','tw_7_1','tw_2_4','tw_9_4','ty_11_4'])), {v,F}=L;
  near(ratioOut(L,v,F[0],{auto:true}),1.20,'Heavy Spear',1e-9); near(ratioOut(L,v,F[0],{auto:true,kind:'magic'}),1.20*1.10,'Angry Sap on a magic basic attack',1e-9); near(ratioOut(L,v,F[0],{kind:'magic'}),1.10,'(any magic hit)',1e-9);
  near(v.range/r0,1.09,'Woodsman\'s Reach',1e-9); near(ratioIn(L,F[0],v,{auto:true}),0.95,'Unbending: 1% x 5 less from basic attacks',1e-9); near(ratioIn(L,F[0],v,{kind:'magic'}),0.95,'Weathered: 1% x 5 less magic',1e-9);
});

/* ======================= THE TURNING YEAR ======================= */
test('Oakmir / Turn of Seasons: every 6 s (Long Summer 0.5 s x 3) Spring (his heals 1% x 5), Summer (his team deals 1% x 5), Autumn (enemies take 1% x 5), Winter (his team takes 1% x 5 less); Harvest Swing, Winter Hardiness',()=>{
  const L=ll(S(['ty_1_4','ty_2_4','ty_4_4','ty_5_4'])), {v,A,F}=L, o=O(L); assert.equal(o.sea.i,0,'the fight starts in Spring');
  low(A[0],0.4); near(healGot(A[0],()=>castRR(L)),A[0].maxHp*0.22*SM*(v.healPowMul||1)*1.05,'Spring: his heals 5% stronger',1e-9);
  secs(7.45); assert.equal(o.sea.i,0); secs(0.1); assert.equal(o.sea.i,1,'Summer after 7.5 s'); near(ratioOut(L,A[0],F[0]),1.05,'Summer: his allies deal 5% more',1e-9); near(ratioOut(L,v,F[0]),1.05,'(he too)',1e-9);
  o.sea.i=2; near(ratioOut(L,A[1],F[0]),1.05,'Autumn: enemies take 5% more',1e-9); near(ratioOut(L,v,F[0],{auto:true}),1.05*1.20,'Harvest Swing: his basic attacks 4% x 5 more in Autumn',1e-9);
  o.sea.i=3; near(ratioIn(L,F[0],A[0]),0.95,'Winter: his team takes 5% less',1e-9); near(ratioIn(L,F[0],v),0.95*0.90,'Winter Hardiness: he 2% x 5 more',1e-9);
  o.sea.t=0.01; V.step(1); assert.equal(o.sea.i,0,'Winter turns to Spring'); assert.equal(o.sea.turns,1,'a full turn');
});

test('Oakmir / Deciduous (Autumn and Winter twice as long, 50% more; Falling Leaves) vs Evergreen (no Autumn or Winter; Spring and Summer 50% more; Green All Year), Early Spring, Early Turn',()=>{
  const L=ll(S(['ty_1_4','ty_5_2','ty_6_2','ty_8_4'])), {v,A,F}=L, o=O(L); o.sea.i=1; o.sea.t=0.01; V.step(1); assert.equal(o.sea.i,2); near(o.sea.t,12,'Autumn 12 s',1e-6);
  near(ratioOut(L,A[0],F[0]),1.075,'Autumn 7.5%',1e-9); V.step(1); assert.ok(F[0].slow>0&&Math.abs(F[0].slowMul-0.91)<1e-9,'Falling Leaves: enemies slowed 9% in Autumn');
  o.sea.i=3; near(ratioIn(L,F[0],A[0]),0.925,'Winter 7.5%',1e-9); o.sea.i=0; low(A[0],0.4); near(healGot(A[0],()=>castRR(L)),A[0].maxHp*0.22*SM*(v.healPowMul||1)*(1+0.05*1.03),'Early Spring: Spring\'s 5% is 3% larger',1e-9);
  const E=ll(S(['ty_1_4','ty_5_3','ty_6_3','ty_3_4'])), e=O(E); assert.equal(e.sea.i,0); low(E.A[0],0.35); castMB(E); assert.equal(e.sea.i,1,'Early Turn: Mending Bloom turns the year');
  near(ratioOut(E,E.A[0],E.F[0]),1.075,'Evergreen: Summer 7.5%',1e-9); e.sea.t=0.01; V.step(1); assert.equal(e.sea.i,0,'Summer turns to Spring: no Autumn, no Winter'); assert.equal(e.sea.turns,1,'(a full turn)');
  const hh=mbHot(E,E.A[0]); const h0=E.A[0].hp; hh.acc=0.999; V.step(1); near(E.A[0].hp-h0,E.A[0].maxHp*0.06*SM*(1+0.075+0.12),'Green All Year 4% x 3, Spring 7.5%',1e-6);
});

test('Oakmir / a full turn of the year: Long Year (1% x 3 healing power, up to 5 turns), Old as the Road (1.5% x 3), Ring Count (1 x 2 energy); Equinox (once per wave), Hibernate (the regeneration cap), Deep Heartwood',()=>{
  const L=ll(S(['ty_1_4','ty_10_4','ty_12_2','ty_12_4','ty_9_4','ty_6_4','ty_11_1'])), {v,A,F}=L, o=O(L); const hp0=v.healPowMul||1, arm=A[0].armorRating;
  low(v,0.5); low(A[0],0.5); A[1].hp=A[1].maxHp; for(const x of [v,A[0],A[1]]) x.energy=0; o.sea.i=3; o.sea.t=0.01; const gv=healGot(v,()=>{ L.ga=healGot(A[0],()=>V.step(1)); });
  near(gv,0.045*v.maxHp,'Old as the Road: he heals 4.5%',0.02); near(L.ga,0.045*A[0].maxHp,'and the lowest ally',1e-6); assert.equal(A[1].energy,2,'Ring Count: 2 energy each'); V.step(1); near((v.healPowMul||1)/hp0,1.03,'Long Year: 3% more healing power',1e-9);
  o.sea.turns=9; V.step(1); near((v.healPowMul||1)/hp0,1.15,'(up to 5 turns)',1e-9);
  o.sea.i=3; o.sea.t=5; V.step(1); near(A[0].armorRating/arm,1.05,'Deep Heartwood: in Winter every ally 5% more armor',1e-9);
  low(v,0.5); o.h1=0; near(healGot(v,()=>secs(1.01)),0.012*v.maxHp,'Hibernate: 2% a second, held at 1.2%',1e-6);
  o.sea.i=1; low(A[1],0.4); V.step(1); low(A[1],0.2); V.step(1); assert.equal(o.sea.i,0,'Equinox: an ally below 30%: Spring at once'); near(o.sea.t,6+3,'3 s longer',0.06);
  o.sea.i=1; A[1].hp=A[1].maxHp; V.step(1); low(A[1],0.2); V.step(1); assert.equal(o.sea.i,1,'once per wave');
});

test('Oakmir / Rally of the Year (Spring: 30% more, Spring Showers 3% x 5; Winter: a 4% shield on every ally for 4 s), First Thaw (Spring held, the healed woken), Spring Eternal',()=>{
  const L=ll(S(['ty_7_3','ty_9_3'])), {v,A,F}=L, o=O(L); low(A[0],0.4); near(healGot(A[0],()=>castRR(L)),A[0].maxHp*0.22*SM*(v.healPowMul||1)*(1+0.30*1.15),'Spring: 34.5% more',1e-9);
  o.sea.i=3; A[1].shield=0; castRR(L); near(A[1].shield,0.04*A[1].maxHp,'Winter: 4% of max HP as a shield',1e-9); near(A[1].shieldT,4,'for 4 s',1e-9);
  const F3=ll(S(['ty_11_3'])), f3=O(F3); f3.sea.i=0; f3.sea.t=1; low(F3.A[0],0.2); castFS(F3); assert.ok(f3.sea.t>=5-1e-9,'First Thaw: a Spring about to end is held for the regrowth\'s 5 s');
  const F2=ll(S(['ty_11_3','ty_12_3'])), f=O(F2); f.sea.i=2; f.sea.t=9; low(F2.A[0],0.2); low(F2.A[1],0.3); F2.A[1].stunned=3; F2.A[1].fearT=2; castFS(F2);
  assert.equal(f.sea.i,0,'First Thaw: Spring at once'); assert.ok(f.sea.t>=5-1e-9,'held for its regrowth'); assert.equal(F2.A[1].stunned,0,'woken'); assert.equal(F2.A[1].fearT,0);
  F2.A[1].stunned=1e6; F2.A[1].target=null;   /* held again: an ally attacking a Tank beside a Support receives the game's own +20% healing */

  const b=F2.A[1].hp; V.step(Math.round(1.02/V.STEP)); near(F2.A[1].hp-b,F2.A[1].maxHp*0.04*SM*1.15,'Spring Eternal: the regrowth 3% x 5 more in Spring',1e-6);
});

test('Oakmir / Nests: Songbird Nests (a stun, fear or sleep on an ally cut 10% x 5), Wider Branches (3 + 3), Homing Birds (12 - 4 s), Birdsong (1% x 5), Dawn Chorus (1 x 5)',()=>{
  const L=ll(S(['ty_2_3','ty_4_3','ty_10_2','ty_8_2','ty_9_2'])), {v,A,F}=L, o=O(L); assert.equal(o.ne.length,6,'6 Nests'); brnd(0);
  free(A[0]); low(A[0],0.5); const h=A[0].hp; V.cc(F[0],A[0],'stunned',2); near(A[0].stunned,V.ccNerf*2*0.5,'cut by half',1e-9); near(A[0].hp-h,0.05*A[0].maxHp,'Birdsong',1e-6); assert.equal(A[0].energy,5,'Dawn Chorus');
  assert.equal(o.ne.filter(x=>x===0).length,5,'a Nest used'); A[0].stunned=0; V.cc(F[0],A[0],'fearT',2); near(A[0].fearT,V.ccNerf*2*0.5,'a fear too',1e-9); A[0].fearT=0;
  A[0].stunned=0; V.cc(F[0],A[0],'stunned',2); A[0]._sleepT=5; V.step(1); assert.ok(A[0]._sleepT<=A[0].stunned+1e-9,'a sleep: it wakes when the cut stun ends');
  A[0].stunned=0; A[0]._sleepT=0; free(v); V.cc(F[0],v,'stunned',2); near(v.stunned,V.ccNerf*2,'not on himself',1e-9); v.stunned=1e6;
  for(let i=0;i<4;i++){ A[0].stunned=0; V.cc(F[0],A[0],'stunned',2); } near(A[0].stunned,V.ccNerf*2,'no Nest left: the stun as it is',1e-9); A[0].stunned=0;
  secs(7.6); assert.ok(o.ne.filter(x=>x===0).length<6,'(not all back at 7.6 s)'); secs(0.5); assert.equal(o.ne.filter(x=>x===0).length,6,'refilled after 8 s');

});

test('Oakmir / Second Growth: once per fight he regrows (10 - 1 x 3 - 0.5 x 3 s; 25% + 3% x 5 of his max HP) a step to the left; Rooted Again, Waking Roots, Second Life, Fallen Seed',()=>{
  const L=ll(S(['ty_4_1','ty_12_1','ty_5_1','ty_6_1','ty_10_1','ty_7_1','ty_8_1'])), {v,A,F}=L, o=O(L); const x0=v.x, hp0=v.healPowMul||1;
  low(A[0],0.5); low(A[1],0.6); V.dmg(v,v.hp+v.shield+10); assert.ok(!v.alive,'he fell');
  const ga=healGot(A[0],()=>secs(5.4)); assert.ok(!v.alive,'still waiting at 5.4 s'); near(ga,5*0.012*A[0].maxHp,'Fallen Seed: the lowest ally 2% a second, held at 1.2%',1e-6);
  const g1=healGot(A[1],()=>{ for(let i=0;i<20&&!v.alive;i++) V.step(1); }); assert.ok(v.alive,'regrown after 5.5 s'); near(v.hp,0.40*v.maxHp,'with 40% of his max HP',1e-6); near(x0-v.x,V.METER,'a step to the left',1e-6);
  near(g1,0.10*A[1].maxHp,'Rooted Again: every ally 5% x 2',1e-6); assert.ok(o.rt[F[0].uid]>1,'Waking Roots: F0 within 4 m rooted 1.2 s'); assert.ok(!o.rt[F[1].uid]);
  v.stunned=1e6; V.step(1); near((v.healPowMul||1)/hp0,1.10,'Second Life: 2% x 5 more healing power',1e-9);
  V.dmg(v,v.hp+v.shield+10); secs(8); assert.ok(!v.alive,'once per fight');
});

test('Oakmir / The Spring That Woke (SIGNATURE): 8 s after First Spring all four Seasons at once and the year stops, every Nest refills, and he may regrow once more',()=>{
  const L=ll(S(['ty_13_3','ty_1_4','ty_2_3','ty_4_1'])), {v,A,F}=L, o=O(L); o.ne[0]=5; o.ne[1]=5;
  low(A[0],0.3); castFS(L); assert.equal(o.ne.filter(x=>x===0).length,3,'every Nest back'); near(ratioIn(L,F[0],A[1]),0.95,'Winter',1e-9); near(ratioOut(L,A[1],F[0]),1.05*1.05,'Summer and Autumn',1e-9);
  const i=o.sea.i, t=o.sea.t; secs(7.9); assert.equal(o.sea.i,i); near(o.sea.t,t,'the year does not turn',1e-9); secs(0.2); near(ratioIn(L,F[0],A[1]),i===3?0.95:1,'over after 8 s',1e-9);
  V.dmg(v,v.hp+v.shield+10); secs(7.2); assert.ok(v.alive,'regrew'); castFS(L); V.dmg(v,v.hp+v.shield+10); secs(7.2); assert.ok(v.alive,'after it, First Spring lets him regrow once more'); castFS(L); V.dmg(v,v.hp+v.shield+10); secs(7.2); assert.ok(!v.alive,'once more only');
});

test('Oakmir / Second Growth on the enemy side: his fallen body stays on the field while he waits (the page takes an enemy body off 0.9 s after it falls)',()=>{
  const U=V.arena(snaps([spec('vael',100)]),snaps([spec(H,100,S(['ty_4_1'])),spec('vael',100)]),7), o=U.find(u=>u.key===H); for(const u of U){ u.stunned=1e6; } V.step(1); assert.ok(o._tal);
  V.dmg(o,o.hp+o.shield+10); secs(3); assert.ok(VMX('units').indexOf(o)>=0,'still in the fight 3 s later'); secs(4.5); assert.ok(o.alive,'and regrown after 7 s');
});

test('Oakmir / Frost-Hard: controls on him 5% x 3 shorter (at most 15%)',()=>{
  const L=ll(S(['ty_1_1'])), {v,F}=L; free(v); brnd(0); V.cc(F[0],v,'stunned',2); near(v.stunned,V.ccNerf*2*0.85,'15% shorter',1e-9);
});

test('Oakmir / his two capped groups: on him at most 40% from his talents, on an ally at most 25%',()=>{
  const all=everything(H).filter(([id])=>!['tw_6_4'].includes(id)), L=ll(all), {v,A,F}=L, o=O(L);
  castMB(L); o.grove=8; o.rtW=4; o.sap=sapMax(L); o.gr[A[0].uid]=A[0]; o.gr[A[1].uid]=A[1]; o.fgW[A[1].uid]=3; o.fgW[v.uid]=3; o.rt[F[0].uid]=3; o.hr[F[0].uid]={n:5,t:9}; o.sea.i=3; o.sea.t=9; o.tb=-9; V.step(1); o.rt[F[0].uid]=3; F[0].slow=3;
  F[0]._castSlot='ult'; near(ratioIn(L,F[0],A[1],{kind:'magic'}),0.75,'an ally: every reduction at once, held at 25%',1e-9); F[0]._castSlot=null;
  o.tb=-9; near(ratioIn(L,F[0],v,{kind:'magic',auto:true}),0.60,'Oakmir: held at 40%',1e-9);
  const R=ll(S(['tw_6_4','hw_11_1'])); O(R).sap=10; near(ratioIn(R,R.F[0],R.v),0.925*1.06,'(Hollow Trunk\'s 6% more is outside the group)',1e-9);
});

test('Oakmir: no lock of his is an absolute fight time - a wave change (the clock back at 0) frees Bound Bark\'s 5 s on time, and his marks on units are cleared',()=>{
  const L=ll(S(['hw_10_4','tw_1_2','tw_2_3'])), {v,A,F}=L, o=O(L); o.gr[A[0].uid]=A[0]; VMX('battleTime=40'); low(A[0],0.6);
  V.hit(F[0],A[0],0.2*A[0].maxHp,tru()); assert.ok(healGot(A[0],()=>V.step(1))>0,'Bound Bark at fight time 40'); V.hit(v,F[0],10,{auto:true}); assert.equal(o.ac[F[0].uid].n,1);
  waveChange(L); assert.ok(!o.ac[F[0].uid],'the wave start clears his Acorns'); secs(5); low(A[0],0.6); V.hit(F[0],A[0],0.2*A[0].maxHp,tru());
  assert.ok(healGot(A[0],()=>V.step(1))>0,'5 s into the next wave (fight time about 5, not 45): it heals again');
});

/* ======================= WHOLE FIGHTS ======================= */
test('Oakmir: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['hw_1_1','hw_2_2','hw_4_4','hw_12_3','tw_1_2','tw_2_3','tw_4_4','ty_1_4','ty_2_3','ty_4_1','hw_3_1']), TEAM=['vael','sylthaine','vireo','vex','oakmir'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let sap=0,shade=0,graft=0,ac=0,hr=0,rt=0,turns=0,bites=0; const T0=s._tal;
  for(let i=0;i<2600&&!V.ended();i++){ V.step(1); const o=T0.s.ok; if(!o) continue; if(o.sap>0) sap++; shade+=Object.keys(o.sh).length; graft=Math.max(graft,Object.keys(o.gr).length); ac+=Object.keys(o.ac).length; hr+=Object.keys(o.hr).length; rt+=Object.keys(o.rt).length; turns=Math.max(turns,o.sea?o.sea.turns:0); }
  console.log('  live fight: ticks with Sap '+sap+', ally-ticks in Shade '+shade+', Grafted '+graft+', enemy-ticks with Acorns '+ac+', with Heartrot '+hr+', rooted '+rt+', full turns '+turns);
  assert.ok(sap>0&&ac>0&&turns>0,'Sap, Acorns and the Seasons in a real fight');
  determinism(H,TEAM);
});

/* The page site his talents added (a fallen enemy-side body kept while he waits to regrow): with nothing learned, whole seeded fights with Oakmir in the line-up
   are identical to the pre-talent page (ee8edab8), seed by seed. The counters are also the base-skill measure of the report. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Oakmir: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach the site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['oakmir','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','oakmir','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __okN={mb:0,rr:0,fs:0,gone:0}; var __okD2=_doEffectCore, __okU2=_updateBattleCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="oakmir"&&(!o||!o.deliver||o._arrived)){ if(type==="hot") __okN.mb++; if(type==="heal") __okN.rr++; if(type==="firstspring") __okN.fs++; } return __okD2.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ const n=units.filter(u=>!u.alive&&u.team==="enemy").length; const r=__okU2.apply(this,arguments); __okN.gone+=Math.max(0,n-units.filter(u=>!u.alive&&u.team==="enemy").length); return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__okN'); console.log('  identity / base skills: '+JSON.stringify(c));
    assert.ok(c.gone>20&&c.mb>0&&c.rr>0&&c.fs>0,'the fights took fallen enemy bodies off the field (the new site) and cast his three skills'); }
  finally{ VMX('_doEffectCore=__okD2; _updateBattleCore=__okU2;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ hw:['hw_1_4','hw_3_3','hw_11_1','hw_12_1','hw_2_2','hw_5_2','hw_6_2','hw_5_1','hw_7_4','hw_n1','hw_6_4','hw_13_2','hw_4_4','hw_1_1','hw_8_1'],
            tw:['tw_1_1','tw_8_2','tw_9_4','tw_11_4','tw_3_4','tw_7_4','tw_1_2','tw_2_3'],
            ty:['ty_5_4','ty_11_4','ty_1_4','ty_5_2','ty_3_2','ty_11_1','ty_1_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={hw:0,tw:1,ty:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)&&!['tw_6_4'].includes(t[0])).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)&&!['tw_6_4'].includes(t[0]))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his reduction talents true at once (the first hit of the wave, 4 s after a pour, Sap stored, 4 Grafted allies, the attacker rooted,
   slowed and with Heartrot, Winter, The Grove Stands' Shade on him, Mending Bloom and Thorns on him, First Green); sustained: Sap stored, 2 Grafted allies, nothing else.
   Measured through the engine (HP and shield it takes). */
function worstHit(list,kind,crit,sustained,autoHit){ const L=ll(list,{allies:3,foes:3}), {v,A,F}=L; const f=F[0]; v.maxHp=1e5; v.hp=6e4; brnd(0.99);
  const o=L.T&&O(L); if(o){ o.sap=1; if(!sustained){ o.tb=-9; o.rtW=4; o.grove=8; for(const x of A) o.gr[x.uid]=x; o.rt[f.uid]=3;
 f.slow=3; o.hr[f.uid]={n:5,t:9}; if(o.sea){ o.sea.i=3; } o.fgW[v.uid]=3; low(v,0.2); castMB(L); v.hp=6e4; }
    else { o.gr[A[0].uid]=A[0]; o.gr[A[1].uid]=A[1]; } }
  V.step(1); if(o&&!sustained){ o.tb=-9; o.rt[f.uid]=3; f.slow=3; } v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6;
  const raw=sustained?5e3:2e4, au=sustained?true:!!autoHit, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:au})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; brndBack();
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Oakmir: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['hw','tw'],[61,30]],[['hw'],[91]],[['hw','ty'],[61,30]],[['tw','hw'],[61,30]],[['ty','hw'],[61,30]],[['tw','ty'],[61,30]],[['ty','tw'],[61,30]],[['hw','tw','ty'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false,false),worstHit(c.list,kind,crit,false,true));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,rt:0,rtRun:{}}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="oakmir"&&src&&src.team!==tgt.team; let h0=0; if(me) h0=tgt.hp+(tgt.shield||0); const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="oakmir"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    if(T&&T.s.api&&e){ const k=T.fn.drMe(T.s.api,T,u,{src:e,kind:"phys",auto:true}); if(1-k*Math.min(defMul(e,u,"phys"),defMul(e,u,"magic"))>=0.85) __dr.tHi++; }'+
    '    if(T&&T.s.ok){ for(const x of units){ if(!x.alive) continue; const r0=(T.s.ok.rt[x.uid]||0)>0; const q=__dr.rtRun; if(r0){ q[x.uid]=(q[x.uid]||0)+dt; if(q[x.uid]>__dr.rt) __dr.rt=q[x.uid]; } else q[x.uid]=0; } } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','oakmir'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; immune ticks '+d.imm+' of '+d.ticks+'; ticks at 85% or more (probe) '+d.tHi+'; longest one enemy rooted by him in a row '+d.rt.toFixed(2)+' s');
    assert.ok(d.n>20&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'at 85% or more for less than half of the fight: '+d.tHi+' of '+d.ticks+' ticks'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
