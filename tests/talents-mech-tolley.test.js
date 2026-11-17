'use strict';
/* Tolley's talents as data on the mechanics layer (talents-mech/tolley.js), group by group on the still field (tests/talents-lab.js), then whole fights, the
   no-talent identity with him in the line-up, the fear-lock rule and his longest fear chain in seeded fights, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Tolley, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12); A0 (0,-5.5) A1 (0,-11).
   Lab units are HELD (stunned 1e6). Lab skill level 10. Forge Strike is a 45 degree wedge from him toward its target, 3 m to the enemy's body edge; Chain
   Quench reaches every enemy whose CENTRE is within 4.5 m of his (none of his skills is on the 14 Nov reach audit's list). Run: node --test tests/talents-mech-tolley.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='tolley', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const o=L=>L.T.s.tl, api=L=>L.T.s.api;
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const edgeAt=(L,u,e,deg)=>{ const d=e+V.bodyR(u), a=(deg||0)*Math.PI/180; at(L,u,d*Math.cos(a),d*Math.sin(a)); };   // u's body edge e m from his CENTRE (Forge Strike's own measure)
const gapAt=(L,u,g,deg)=>{ const d=g+V.bodyR(L.v)+V.bodyR(u), a=(deg||0)*Math.PI/180; at(L,u,d*Math.cos(a),d*Math.sin(a)); };   // u's body g m from his, at that angle
const hitOn=(L,amt,o2)=>lost(L.v,()=>V.hit((o2&&o2.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o2||{})));   // an enemy's hit on him (true damage unless said)
const myHit=(L,t,o2)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o2||{})));
const dmgOf=(t,fn)=>{ const h=t.hp+(t.shield||0); fn(); return h-t.hp-(t.shield||0); };
const castFS=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castCQ=(L,t)=>V.cast(L.v,'blue',t||L.F[0]);
const castLF=(L,t)=>V.cast(L.v,'ult',t||L.F[0]);
const sm10=()=>VMX('skillMul(10)');
const isMol=(L,t)=>L.T.fn.isMolten(api(L),L.T,L.v,{tgt:t});
const burnOn=(L,t,per,dur,tag)=>L.T.fn.burn(api(L),L.T,L.v,t,per,dur,tag||'test');
const myDots=(L,t,tag)=>(t.dots||[]).filter(d=>d._talO===L.v.uid&&(tag==null||d._talK===tag)&&d.remaining>0);
const force=(L,t)=>L.T.fn.force(api(L),L.T,t);
const rnd=(L,x,fn)=>{ const E=api(L).eng(), r0=E.rnd; E.rnd=()=>x; try{ return fn(); } finally{ E.rnd=r0; } };
const free=L=>{ for(const f of L.F){ f.stunned=0; f.fearT=0; f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; } };
const auOf=(L,x)=>L.T.s.au.find(e=>e.x===x);
const kill=(L,by,t)=>{ t.hp=5; t.shield=0; V.hit(by,t,1e6,{kind:'true'}); };
const ccOn=(src,t,field,s)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,s); } finally{ t.level=lv; } };

test('Tolley: every talent is accounted for - 10 plain stats, 108 with rows, none waiting; renamed talents unique; the crit-damage talent at most 10%',()=>{
  accounting(H,[118,10,108,0,0]);
  for(const id of ['mp_3_3','mp_8_1','mp_8_3','mp_1_3','wm_2_3','wm_4_3','wm_1_2','lf_2_2','lf_7_1','lf_1_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  near(FXN.totals(H,[['mp_8_3',5]]).critDmg,0.10,'Hot Metal: 2% x 5 (was 3%: 15%)');
  const D=require(path.join(root,'talents-data.js')), by={}; for(const h in D.heroes) for(const tr of D.heroes[h].trees) for(const t of tr.talents){ const k=t[3].toLowerCase(); (by[k]=by[k]||new Set()).add(h); }
  for(const tr of T.trees(H)) for(const t of tr.talents) assert.equal(by[t[3].toLowerCase()].size,1,t[3]+' is a name of his alone');
  for(const [id,n] of [['mp_2_1','Quick Melt'],['mp_6_1','Seared Through'],['mp_7_1','Drop Weight'],['mp_5_4','Hot Grip'],['wm_5_1','Shop Hearth'],['wm_5_3','Every Hand Tempered'],['wm_6_1','Keen Temper'],['wm_6_2',"Master's Mark"],['wm_7_1','Anvil Rhythm'],['lf_6_3','Grate Thrown Wide'],['lf_10_1','Kiln Breath'],['lf_10_4','Layered Housing']]) assert.equal(T.talent(H,id).name,n);
  assert.equal(T.talent(H,'wm_5_2').lock,'wm_5_3','the fork still locks the renamed half');
  for(const id of ['mp_13_2','wm_13_2','lf_13_2']) assert.ok(FXN.mech(H).talents[id],id);
});

test('Tolley: his real kit, as the talents read it - Forge Strike (a 3 m wedge, 180%), Chain Quench (4.5 m centre, pull, a physical burn 35% a second for 4 s), Living Forge (a 6 m patch on his target, every 0.5 s), Tempered Steel (a stack every 3 s)',()=>{
  plain({foes:4,big:true},P=>{ const {v,F}=P; const rm=VMX('rageMul'), sm=sm10();
    edgeAt(P,F[1],2.8,10); edgeAt(P,F[2],3.3,-5); edgeAt(P,F[3],2.5,40);
    const h=F.map(f=>f.hp); castFS(P,F[0]); const d0=h[0]-F[0].hp;
    assert.ok(d0>0&&F[1].hp<h[1],'Forge Strike: its target, and an enemy whose body edge is 2.8 m from his centre inside the wedge'); assert.equal(F[2].hp,h[2],'not one 3.3 m away'); assert.equal(F[3].hp,h[3],'nor one 40 degrees off');
    const ref=dmgOf(F[0],()=>V.hit(v,F[0],v.dmg*1.8*sm*rm)); near(d0,ref,'180% of his attack x skill level, physical',1e-6);
    at(P,F[0],4.2,0); at(P,F[1],10,0); at(P,F[2],4.8,0.5); F[0].dots=[]; const x0=F[0].x, g2=F[2].hp; castCQ(P,F[0]);
    assert.ok(F[0].x<x0-0.5*V.METER,'Chain Quench pulls it toward him'); assert.equal(F[2].hp,g2,'(not one whose centre is 4.8 m away)');
    const d=F[0].dots[F[0].dots.length-1]; near(d.dps,v.dmg*0.35*sm,'its burn: 35% of his attack x skill level a second'); assert.equal(d.remaining,4,'for 4 s'); assert.equal(d.kind,'phys','physical (armour reduces each tick)');
    at(P,F[0],4.5,0); const n0=VMX('groundHazards.length'); castLF(P,F[0]); const hz=VMX('groundHazards[groundHazards.length-1]');
    assert.equal(VMX('groundHazards.length'),n0+1,'Living Forge: one patch'); near(hz.x,F[0].x,'on his target'); near(hz.r/V.METER,6,'6 m'); near(hz.interval,0.5,'every 0.5 s'); near(hz.dmg,v.dmg*0.8*sm,'80% of his attack x skill level a tick'); near(hz.life,5,'for 5 s');
    assert.ok(v.pass.warden,'Tempered Steel'); v.wardenStk=0; v.wardenT=0; v.stunned=1e6; secs(3.05); assert.equal(v.wardenStk,1,'a stack every 3 s'); });
});

/* ============================== MOLTEN ============================== */
test('Tolley / Molten: after 2 s of his burns (Quick Melt: 1.1 s), until they end; Runs Hot; a forced Molten holds 2 s without a burn',()=>{
  const L=lab(H,S(['mp_1_1','mp_2_1']),{foes:3,big:true}), {v,F}=L; burnOn(L,F[0],10,9);
  secs(1.0); assert.ok(!isMol(L,F[0]),'not after 1.0 s'); secs(0.2); assert.ok(isMol(L,F[0]),'Molten after 2 - 0.3 x 3 = 1.1 s');
  const p=plainHit(L,()=>dmgOf(F[0],()=>castFS(L,F[0]))); near(dmgOf(F[0],()=>castFS(L,F[0])),p*1.10,'Runs Hot: Forge Strike 2% x 5 more on it');
  near(myHit(L,F[0],{auto:true}),1000*1.10,'and his basic attacks'); near(myHit(L,F[1],{auto:true}),1000,'(not on an enemy that is not Molten)');
  F[0].dots=[]; V.step(1); assert.ok(!isMol(L,F[0]),'its burns over: no longer Molten');
  force(L,F[1]); V.step(1); assert.ok(isMol(L,F[1]),'forced Molten'); secs(1.8); assert.ok(isMol(L,F[1]),''); secs(0.3); assert.ok(!isMol(L,F[1]),'2 s without a burn');
  const P0=lab(H,S(['mp_1_1']),{foes:2,big:true}); burnOn(P0,P0.F[0],10,9); secs(1.9); assert.ok(!isMol(P0,P0.F[0]),'(2 s without Quick Melt)'); secs(0.2); assert.ok(isMol(P0,P0.F[0]),'');
  const S5=lab(H,S(['mp_1_1','mp_9_3','wm_9_3','wm_1_4']),{foes:3,big:true}); force(S5,S5.F[0]); V.step(1); const crit=plainHit(S5,()=>myHit(S5,S5.F[0],{crit:true}));
  near(rnd(S5,0.049,()=>myHit(S5,S5.F[0])),crit,'Spark Shower: 1.5% x 5 more critical chance on a Molten enemy - at most 5% (a roll of 0.049 crits)'); near(rnd(S5,0.051,()=>myHit(S5,S5.F[0])),1000,'(0.051 does not)');
  S5.T.s.tl.ex.push({x:S5.F[0].x,y:S5.F[0].y,t:9,k:1}); near(rnd(S5,0.051,()=>myHit(S5,S5.F[0])),1000,'Spark Eye too: still 5% at most, both together'); near(rnd(S5,0.04,()=>myHit(S5,S5.F[2])),1000,'(an enemy neither Molten nor near an Example: none)');
  const S1=lab(H,S(['mp_9_3']),{foes:2,big:true}); force(S1,S1.F[0]); V.step(1); near(rnd(S1,0.049,()=>myHit(S1,S1.F[0])),plainHit(S1,()=>myHit(S1,S1.F[0],{crit:true})),'Spark Shower on its own: a 0.049 roll crits (5% at most)',1e-6);
});

/* ============================== THE CRUCIBLE AND THE POUR ============================== */
test('Tolley / Crucible: each burn tick (Bellows), Hot Grip, Hot Start; the pour (15% a rank), Residual Heat, Ash Mouth, Forge Glow; empty at a wave\'s end unless Never Cold; Overpour',()=>{
  const L=lab(H,S(['mp_1_1','mp_1_4','mp_2_4','mp_5_4','mp_12_4','mp_10_4','mp_6_4','mp_7_4']),{foes:3,big:true}), {v,F}=L;
  near(stack(L,'tCru'),45,'Hot Start: 15 x 3 at the wave start'); burnOn(L,F[0],10,9); const c0=stack(L,'tCru'); secs(1.02); near(stack(L,'tCru'),c0+1+0.45,'each tick of his burns: 1 + Bellows 0.15 x 3');
  force(L,F[1]); V.step(1); const c1=stack(L,'tCru'); V.hit(v,F[1],100,{auto:true,kind:'true'}); near(stack(L,'tCru'),c1+6,'Hot Grip: a basic attack on a Molten enemy, 2 x 3'); V.hit(v,F[2],100,{auto:true,kind:'true'}); near(stack(L,'tCru'),c1+6,'(not on one that is not)');
  setStack(L,'tCru',50); V.step(1); const ai=v.atkInterval; setStack(L,'tCru',51); V.step(1); near(ai/v.atkInterval,1.075,'Forge Glow: above 50, 1.5% x 5 attack speed');
  setStack(L,'tCru',99); const p=plainHit(L,()=>dmgOf(F[2],()=>castFS(L,F[2]))); near(dmgOf(F[2],()=>castFS(L,F[2])),p,'(99: no pour)'); assert.equal(stack(L,'tCru'),99,'(the Crucible holds at 99)');
  setStack(L,'tCru',100); v.hp=0.5*v.maxHp; const h0=v.hp; near(dmgOf(F[2],()=>castFS(L,F[2])),p*1.45,'at 100 the next Forge Strike pours: 15% x 3 more'); near(stack(L,'tCru'),20,'Residual Heat: it keeps 4 x 5');
  near(v.hp-h0,0.04*v.maxHp,'Ash Mouth: each pour heals 2% x 2 of his max HP');
  setStack(L,'tCru',80); V.wave(); V.step(1); near(stack(L,'tCru'),45,'emptied at the wave\'s end, then Hot Start');
  const N=lab(H,S(['mp_1_4','mp_11_1','mp_9_4']),{foes:2,big:true}); setStack(N,'tCru',90); V.wave(); V.step(1); near(stack(N,'tCru'),90,'Never Cold: kept');
  setStack(N,'tCru',200); V.step(1); burnOn(N,N.F[0],1,9); secs(1.02); near(stack(N,'tCru'),150,'Overpour: up to 150');
  const q=plainHit(N,()=>dmgOf(N.F[0],()=>castFS(N,N.F[0]))); setStack(N,'tCru',150); near(dmgOf(N.F[0],()=>castFS(N,N.F[0])),q*1.45*(1+0.003*50),'and the pour 0.3% more for each point over 100');
  near(stack(N,'tCru'),0,'(it empties)');
});

test('Tolley / Pour Wide (and Spill) and Pour Deep (and Single Ingot)',()=>{
  const L=lab(H,S(['mp_1_4','mp_5_2','mp_6_2']),{foes:3,big:true}), {v,F}=L; edgeAt(L,F[1],4.0,5); edgeAt(L,F[2],5.2,-8); const h2w=F[2].hp;
  setStack(L,'tCru',99); const h1=F[1].hp; castFS(L,F[0]); assert.equal(F[1].hp,h1,'no pour: 3 m');
  setStack(L,'tCru',100); const d0=dmgOf(F[0],()=>castFS(L,F[0])); assert.ok(F[1].hp<h1,'Pour Wide: the pour reaches 50% farther (4.5 m: one 4 m away)');
  const b=myDots(L,F[0],'pw')[0]; assert.ok(b,'every enemy it strikes burns'); near(b.dps,0.25*d0*1.15/4,'25% of what it dealt over 4 s, Spill 3% x 5 stronger',1e-3); assert.equal(b.remaining,4); assert.ok(myDots(L,F[1],'pw')[0],'(the far one too)'); assert.equal(F[2].hp,h2w,'(a 5.2 m body edge: out of even the widened pour)');
  const D=lab(H,S(['mp_1_4','mp_5_3','mp_6_3']),{foes:3,big:true}), g=D.F; gapAt(D,g[1],1.0,10);
  const p0=plainHit(D,()=>dmgOf(g[0],()=>castFS(D,g[0]))), p1=plainHit(D,()=>dmgOf(g[1],()=>castFS(D,g[0])));
  setStack(D,'tCru',100); const a1=g[1].hp; const a0=dmgOf(g[0],()=>castFS(D,g[0])); near(a0,p0*1.45*1.40,'Pour Deep: 40% more to its main target'); near(a1-g[1].hp,p1*1.45,'(the other enemy: the pour only)');
  V.step(1); assert.ok(isMolBy(D,g[0]),'and the main target Molten at once'); assert.ok(!isMolBy(D,g[1]),'');
  near(myHit(D,g[0]),1000*1.12,'Single Ingot: it takes 4% x 3 more from his hits'); near(myHit(D,g[1]),1000,''); secs(4.05); near(myHit(D,g[0]),1000,'for 4 s');
});
function isMolBy(L,t){ return L.T.fn.isMolten(api(L),L.T,L.v,{tgt:t}); }

/* ============================== HIS BURNS ============================== */
test('Tolley / burns: Slag Off, Glowing Seams, Longer Burn, Hotter Chains, Ember Hands, Seared Through, Kiln Warmth (1.2% a second at most)',()=>{
  const L=lab(H,S(['mp_1_1','mp_2_1','mp_3_1','mp_3_4']),{foes:4,big:true}), {v,F}=L; const r2=V.bodyR(F[0])+V.bodyR(F[2]); at(L,F[2],4.5,1.5+r2); at(L,F[3],4.5,-(2.5+V.bodyR(F[0])+V.bodyR(F[3])));
  force(L,F[0]); V.step(1); const d=dmgOf(F[0],()=>castFS(L,F[0])); const s=myDots(L,F[2],'so')[0]; assert.ok(s,'Slag Off: Forge Strike on a Molten enemy splashes a burn on an enemy within 2 m of it'); assert.ok(!myDots(L,F[3],'so').length,'(not 2.5 m)');
  near(s.dps,0.30*d/3,'30% of what it dealt, over 3 s'); assert.equal(s.remaining,3+1,'Glowing Seams: his talent burns 0.2 x 5 s longer'); assert.ok(!myDots(L,F[0],'so').length,'(not on the struck enemy itself)');
  F[0].dots=[]; force(L,F[0]); F[0].__m=0; const L2=lab(H,S(['mp_3_1']),{foes:3,big:true}); at(L2,L2.F[2],4.5,1.5+r2); castFS(L2,L2.F[0]); assert.ok(!myDots(L2,L2.F[2],'so').length,'(the enemy struck was not Molten: no splash)');
  const C=lab(H,S(['mp_2_2','mp_4_2','mp_3_4']),{foes:2,big:true}), P0=VMX('skillMul(10)'); at(C,C.F[0],4.2,0); castCQ(C,C.F[0]); const q=C.F[0].dots[C.F[0].dots.length-1];
  near(q.dps,C.v.dmg*0.35*P0*1.15,'Hotter Chains: Chain Quench\'s burn 3% x 5 stronger'); assert.equal(q.remaining,7,'Longer Burn 0.5 x 3 and Glowing Seams 0.2 x 5: 4 + 1.5 + 1 = 6.5 s (7 ticks, the last a half)'); near(q._talF,0.5,'');
  assert.equal(q._talK,'cq','tagged his');
  const E=lab(H,S(['mp_12_3','mp_1_1','mp_6_1','mp_n1']),{foes:2,big:true}); V.hit(E.v,E.F[0],1000,{auto:true,kind:'true'}); const e=myDots(E,E.F[0],'eh')[0]; assert.ok(e,'Ember Hands: his basic attack leaves a burn'); near(e.dps,0.10*1000/2,'5% x 2 of the hit over 2 s'); assert.equal(e.remaining,2);
  V.hit(E.v,E.F[0],1000,{auto:true,kind:'true'}); assert.equal(myDots(E,E.F[0],'eh').length,1,'(each attack refreshes it)');
  const tk=()=>dmgOf(E.F[0],()=>secs(1.0)); E.F[0].dots=[]; burnOn(E,E.F[0],100,9,'x'); const a=tk(); force(E,E.F[0]); V.step(1); const b=tk(); near(b/a,1.09,'Seared Through: his burns 3% x 3 more on a Molten enemy',0.02);
  E.v.maxHp=E.v.hp=1e6; E.v.hp=5e5; E.T.s.tl.bud=0; const h0=E.v.hp; secs(1.0); const g=E.v.hp-h0; assert.ok(g>0&&g<=0.012*1e6+1,'Kiln Warmth: a tick on an enemy within 3 m heals him, at most 1.2% a second ('+g+')');
  E.T.s.tl.bud=1e9; const h1=E.v.hp; secs(1.02); near(E.v.hp-h1,0.005*1e6,'0.1% x 5 of his max HP a tick',1e-3);
  at(E,E.F[0],-7.25,0); E.T.s.tl.bud=1e9; const hm=E.v.hp; secs(1.02); near(E.v.hp-hm,0,'(an enemy 3.5 m body-to-body: none)');
  at(E,E.F[0],-10,0); E.T.s.tl.bud=1e9; const h2=E.v.hp; secs(1.02); near(E.v.hp-h2,0,'(an enemy 6 m away or more: none)');
  at(E,E.F[0],2,0); E.T.s.tl.bud=2000; const hb=E.v.hp; E.T.fn.heal(api(E),E.T,E.v,5000); near(E.v.hp-hb,2000,'the budget: a tick heals at most what is banked');
  E.T.fn.heal(api(E),E.T,E.v,5000); near(E.v.hp-hb,2000,'(the bank is spent: no more)');
});

/* ============================== CHAIN QUENCH ============================== */
test('Tolley / Chain Quench: Quench Again, Chain Anchor, Hung in Chains (its hit and its burn), Chains of Making and Pulled to the Anvil; Smith\'s Patience',()=>{
  const L=lab(H,S(['mp_10_3','lf_10_3','wm_8_1']),{foes:3,big:true}), {v,F}=L; near(FX.cd(v,'blue',10),9.1,'Quench Again: 0.3 x 3 s shorter'); near(FX.cd(v,'green',7),6,'Smith\'s Patience: Forge Strike 0.2 x 5 s');
  at(L,F[0],4.4,0); const x0=F[0].x; castCQ(L,F[0]); near((x0-F[0].x)/V.METER,Math.min(0.6*4.4,2.4*1.3),'Chain Anchor: it pulls 10% x 3 farther (2.64 m: its own 60% of the gap)',1e-6);
  const P=lab(H,null,{foes:3,big:true}); at(P,P.F[0],4.4,0); const y0=P.F[0].x; castCQ(P,P.F[0]); near((y0-P.F[0].x)/V.METER,2.4,'(no talent: 2.4 m)',1e-6);
  const C=lab(H,S(['wm_7_4']),{foes:3,big:true}), f=C.F[0]; at(C,f,4.2,0); const p=plainHit(C,()=>dmgOf(f,()=>castCQ(C,f))); f.dots=[];
  o(C).ex.push({x:f.x+V.METER,y:f.y,t:9,k:1}); at(C,f,4.2,0); near(dmgOf(f,()=>castCQ(C,f)),p*1.15,'Hung in Chains: near an Example, its hit 3% x 5 more');
  const B=lab(H,S(['wm_7_4','mp_1_1']),{foes:2,big:true}), g=B.F[0]; at(B,g,4.2,0); castCQ(B,g); const t1=dmgOf(g,()=>secs(1.0)); o(B).ex.push({x:g.x,y:g.y,t:9,k:1}); const t2=dmgOf(g,()=>secs(1.0)); near(t2/t1,1.15,'and its burn\'s ticks',0.01);
  const W=lab(H,S(['wm_1_1','wm_7_2','wm_9_2']),{foes:3,big:true,allies:1}), w=W.A[0]; assert.equal(o(W).wp,w,'the Workpiece'); at(W,W.F[0],4.2,0); at(W,W.F[1],4.2,1.5); w.hp=0.5*w.maxHp; const hw=w.hp;
  castCQ(W,W.F[0]); assert.equal(o(W).ws,2,'Chains of Making: a step for each enemy it pulls (2)'); near(w.hp-hw,2*0.05*w.maxHp,'Pulled to the Anvil: 1% x 5 of its max HP for each of those steps');
  at(W,W.F[0],4.2,0); W.F[0].immovable=true; at(W,W.F[1],10,0); castCQ(W,W.F[0]); assert.equal(o(W).ws,2,'(one that cannot be moved is not pulled)');
  const N=lab(H,S(['wm_1_1']),{foes:3,big:true,allies:1}); at(N,N.F[0],4.2,0); at(N,N.F[1],4.2,1.5); N.A[0].hp=0.5*N.A[0].maxHp; castCQ(N,N.F[0]); assert.equal(o(N).ws,0,'(without Chains of Making: the pulls give no step)');
});

/* ============================== LIVING FORGE ============================== */
test('Tolley / Living Forge: River of Iron (Molten at once, 5 to the Crucible once a second per enemy), Waves of Metal and Molten Walk, Walking Foundry\'s 5 s',()=>{
  const P=lab(H,null,{foes:2,big:true}); at(P,P.F[1],20,0); castLF(P,P.F[0]); const p=dmgOf(P.F[0],()=>secs(0.52));
  const L=lab(H,S(['mp_7_2','mp_1_4','mp_9_2','lf_9_2','lf_7_2']),{foes:2,big:true}), {F}=L; at(L,F[1],20,0); F[0].immovable=true; castLF(L,F[0]); near(o(L).lfT,5,'Walking Foundry: its 5 s',1e-9); const c0=stack(L,'tCru');
  near(dmgOf(F[0],()=>secs(0.52)),p*1.15*1.15,'Waves of Metal and Molten Walk: its ticks 3% x 5 more each',1e-3); V.step(1); assert.ok(isMol(L,F[0]),'River of Iron: an enemy it reaches is Molten at once'); near(stack(L,'tCru'),c0+5,'and adds 5 to the Crucible');
  secs(0.5); near(stack(L,'tCru'),c0+5,'(not again within the second)'); secs(0.55); near(stack(L,'tCru'),c0+10,'then again'); assert.ok(o(L).lfT>0,'Walking Foundry: its 5 s');
  secs(5); assert.ok(!(o(L).lfT>0),'over after 5 s'); assert.ok(!isMol(L,F[1]),'(an enemy out of it: not Molten)');
});

/* ============================== MOLTEN ENEMIES ============================== */
test('Tolley / on Molten enemies: Liquid Iron, Glowing Iron; Furnace Heart (within 4 m, 5 at most), Melt Point (for the wave), Foundry Pace (3 Molten)',()=>{
  const L=lab(H,S(['mp_4_1','mp_12_1','mp_10_1','mp_11_2','mp_12_2']),{foes:4,big:true}), {v,F}=L; const sp=F[0].speed, dm=F[0].dmg, ap=F[0].apow, a0=v.dmg;
  force(L,F[0]); V.step(2); near(F[0].speed,sp*0.90,'Liquid Iron: 2% x 5 slower'); near(F[0].dmg,dm*0.94,'Glowing Iron: its attack 2% x 3 lower'); near(F[0].apow,ap*0.94,'and its ability power');
  near(v.dmg,a0*1.025,'Furnace Heart: 0.5% x 5 attack for the Molten enemy within 4 m'); force(L,F[1]); V.step(2); near(v.dmg,a0*1.025,'(one 10 m away: not counted)');
  near(myHit(L,F[3]),1000,'(2 Molten: no Foundry Pace)'); force(L,F[2]); V.step(1); near(myHit(L,F[3]),1000*1.10,'Foundry Pace: 3 Molten, his hits 2% x 5 more');
  secs(2.2); V.step(1); near(F[0].speed,sp,'its speed back when it is no longer Molten'); near(F[0].dmg,dm,'');
  const M=lab(H,S(['mp_11_2']),{foes:4,big:true}), b0=M.v.dmg; force(M,M.F[0]); V.step(1); kill(M,M.v,M.F[0]); V.step(2); near(M.v.dmg,b0*1.025,'Melt Point: an enemy that died Molten, 0.5% x 5 attack');
  kill(M,M.v,M.F[1]); V.step(2); near(M.v.dmg,b0*1.025,'(one that was not Molten: nothing)');
  o(M).mp=10; force(M,M.F[2]); V.step(1); kill(M,M.v,M.F[2]); V.step(2); near(M.v.dmg,b0*1.25,'Melt Point: at most 10 counted a wave');
  V.wave(); V.step(2); near(M.v.dmg,b0,'for the wave');
  const H5=lab(H,S(['mp_10_1']),{foes:5,big:true}), hb=H5.v.dmg;
  for(let i=0;i<4;i++){ const a=(90+i*72)*Math.PI/180; at(H5,H5.F[i],4.5*Math.cos(a),4.5*Math.sin(a)); force(H5,H5.F[i]); }
  at(H5,H5.F[4],8.25,0); force(H5,H5.F[4]); V.step(1);
  near(H5.v.dmg, hb*1.10, 'Furnace Heart: four Molten within 4 m (the fifth, 4.5 m body-to-body: not counted)');
  const a4=18*Math.PI/180; at(H5,H5.F[4],4.5*Math.cos(a4),4.5*Math.sin(a4)); V.step(1);
  near(H5.v.dmg, hb*1.125, 'and 5 at most (0.5% x 5 attack each)');
});

test('Tolley / Pour the Mold (SIGNATURE): a pour with 3 Molten strikes every Molten enemy, Molten and a 6 s burn within 6 m; once every 25 s, a countdown that keeps across a wave',()=>{
  const L=lab(H,S(['mp_1_4','mp_13_2']),{foes:4,big:true}), {v,F}=L; for(const f of F.slice(0,3)) force(L,f); at(L,F[3],8,-3); V.step(1);
  const p=plainHit(L,()=>dmgOf(F[1],()=>V.hit(v,F[1],L.T.fn.fsAmt(api(L),L.T,v)))); setStack(L,'tCru',100); const h=F.map(f=>f.hp); castFS(L,F[0]);
  near(h[1]-F[1].hp,p*1.45,'every other Molten enemy takes the full pour (a Forge Strike, 15% x 3 more)',1e-6); assert.ok(F[2].hp<h[2],'(each one)'); assert.equal(F[3].hp,h[3],'(not one that is not Molten)');
  const b=myDots(L,F[3],'pm')[0]; assert.ok(b,'every enemy within 6 m burns'); near(b.dps,L.T.fn.cqBurn(api(L),L.T,v),'as Chain Quench\'s burn'); assert.equal(b.remaining,6,'for 6 s'); V.step(1); assert.ok(isMol(L,F[3]),'and is Molten');
  assert.ok(o(L).s1>24.4,'its 25 s ('+o(L).s1.toFixed(2)+' s left)'); for(const f of F.slice(0,3)) force(L,f); V.step(1); setStack(L,'tCru',100); const g=F[1].hp; castFS(L,F[0]); assert.equal(F[1].hp,g,'not again within 25 s');
  secs(10); V.wave(); V.step(1); assert.ok(o(L).s1>13&&o(L).s1<15.5,'the wave\'s clock starts again at 0: the countdown keeps its time ('+o(L).s1.toFixed(2)+' s left)');
  const N=lab(H,S(['mp_1_4','mp_13_2']),{foes:4,big:true}); force(N,N.F[0]); force(N,N.F[1]); V.step(1); setStack(N,'tCru',100); const k=N.F[1].hp; castFS(N,N.F[0]); assert.equal(N.F[1].hp,k,'(2 Molten: no)');
});

/* ============================== THE WORKPIECE ============================== */
test('Tolley / Workpiece: the ally with the most attack at the wave start; tempered by each Forge Strike that lands (Find the Work, Second Heat, Keen Temper capped at 5%); One Fine Thing, Master\'s Mark; Worth Making, Maker\'s Pride, Finished Edge',()=>{
  const L=lab(H,S(['wm_1_1','wm_2_1','wm_6_1','wm_5_2','wm_6_2','wm_11_2','wm_12_2','wm_10_3']),{foes:5,big:true,allies:2,cold:true}), {v,F,A}=L; A[1].dmg=A[0].dmg*2; const cd0=A[1].critDmg==null?0.6:A[1].critDmg; V.step(1);
  const w=A[1]; assert.equal(o(L).wp,w,'the ally with the most attack'); const d0=w.dmg, ar0=w.armorRating, cr0=w.glyphCrit||0, a0=v.dmg; V.step(1);
  near(w.critDmg,(1+cd0)*1.09-1,'Finished Edge: its critical hits 3% x 3 more');
  castFS(L,F[4]); assert.equal(o(L).ws,0,'a Forge Strike that strikes nobody: no step'); castFS(L,F[0]); assert.equal(o(L).ws,1,'one that lands: a step'); V.step(1);
  near(w.dmg,d0*1.05,'Find the Work: 1% x 5 attack a step'); near(w.armorRating,ar0*1.03,'Second Heat: 1% x 3 armour a step'); near((w.glyphCrit||0)-cr0,0.009,'Keen Temper: 0.3% x 3 critical chance a step');
  for(let i=0;i<9;i++) castFS(L,F[0]); assert.equal(o(L).ws,10,'One Fine Thing: up to 10'); castFS(L,F[0]); assert.equal(o(L).ws,10,''); V.step(1);
  near(w.dmg,d0*(1+0.05*10+0.05*5),'Master\'s Mark: each step above 5, 1% x 5 more'); near((w.glyphCrit||0)-cr0,0.05,'Keen Temper: at most 5%'); near(v.dmg,a0*1.10,'Worth Making: fully tempered, 2% x 5 attack');
  w.hp=0.5*w.maxHp; const h=w.hp; secs(2.02); near(w.hp-h,2*0.012*w.maxHp,'Maker\'s Pride: 0.3% x 5 a second, at most 1.2%',1e-3);
  V.wave(); V.step(1); assert.equal(o(L).ws,0,'the steps start again each wave'); V.step(1); near(w.dmg,d0,'');
  const M=lab(H,S(['wm_1_1','wm_5_3','wm_6_3']),{foes:3,big:true,allies:2,cold:true}); M.A[1].dmg=M.A[0].dmg*2; V.step(1); at(M,M.A[0],8.25,0); for(let i=0;i<4;i++) castFS(M,M.F[0]);
  assert.equal(o(M).ws,3,'Every Hand Tempered: the Workpiece holds 3'); assert.ok(!o(M).mh[M.A[0].uid],'(an ally 4.5 m body-to-body: not tempered)');
  at(M,M.A[0],2,0); castFS(M,M.F[0]); near(o(M).mh[M.A[0].uid],1,'and one within 4 m is (a step a strike)');
  castFS(M,M.F[0]); castFS(M,M.F[0]); near(o(M).mh[M.A[0].uid],3,'a step a strike, 3 at most'); castFS(M,M.F[0]); near(o(M).mh[M.A[0].uid],3,'(a fourth strike: still 3)');
  const R=lab(H,S(['wm_1_1','wm_11_1']),{foes:3,big:true,allies:2,cold:true}); R.A[1].dmg=R.A[0].dmg*2; V.step(1); castFS(R,R.F[0]); castFS(R,R.F[0]); kill(R,R.F[0],R.A[1]); V.step(1);
  assert.equal(o(R).wp,R.A[0],'Remade: the next ally is the Workpiece'); assert.equal(o(R).ws,2,'with its steps');
  const X=lab(H,S(['wm_1_1']),{foes:3,big:true,allies:2,cold:true}); X.A[1].dmg=X.A[0].dmg*2; V.step(1); kill(X,X.F[0],X.A[1]); V.step(1); assert.equal(o(X).wp,null,'(without Remade: none for the rest of the wave)');
});

test('Tolley / Workpiece: Quenched True, Proof Mark, Fire in the Work, Many Hammers',()=>{
  const L=lab(H,S(['wm_1_1','wm_2_1','wm_3_1','wm_10_1','wm_12_1','wm_n1']),{foes:3,big:true,allies:2,cold:true}), {v,F,A}=L; A[1].dmg=A[0].dmg*2; V.step(1); const w=A[1];
  w.stunned=0; ccOn(F[0],w,'stunned',2); const s0=w.stunned; w.stunned=0; for(let i=0;i<5;i++) castFS(L,F[0]); V.step(1); w.stunned=0; ccOn(F[0],w,'stunned',2); near(w.stunned,s0*0.7,'Quenched True: fully tempered, a control on it 30% shorter',1e-6);
  w.stunned=5; V.step(1); ccOn(F[0],w,'stunned',2); assert.ok(w.stunned>4.9,'(a longer one it already had is not cut)');
  V.hit(F[2],w,10,{kind:'true'}); near(myHit(L,F[2]),1000*1.10,'Proof Mark: the enemy that last hit his Workpiece takes 2% x 5 more'); near(myHit(L,F[1]),1000,'');
  F[0].dots=[]; V.hit(w,F[0],1000,{kind:'true'}); const b=myDots(L,F[0],'fw')[0]; assert.ok(b,'Fire in the Work: the Workpiece\'s hit burns its target'); near(b.dps,0.15*1000/2,'5% x 3 of the hit over 2 s'); V.hit(A[0],F[1],1000,{kind:'true'}); assert.ok(!myDots(L,F[1],'fw').length,'(not another ally\'s)');
  V.hit(A[0],F[2],10,{kind:'true'}); near(myHit(L,F[2]),1000*1.10,'(one ally hit it: no Many Hammers - Proof Mark only)'); V.hit(w,F[2],10,{kind:'true'}); near(myHit(L,F[2]),1000*1.10*1.10,'Many Hammers: two of his allies hit it in the last 2 s, 2% x 5 more');
  secs(2.1); near(myHit(L,F[2]),1000*1.10,'for 2 s');
});

test('Tolley / The Finished Piece (SIGNATURE): when the Workpiece is fully tempered, 8 s: 30% less damage taken, 30% more dealt, its kills are Examples, his next 3 Forge Strikes also fall on its target; once per fight',()=>{
  const L=lab(H,S(['wm_1_1','wm_13_2','wm_1_4']),{foes:4,big:true,allies:2,cold:true}), {v,F,A}=L; A[1].dmg=A[0].dmg*2; V.step(1); const w=A[1], d0=w.dmg;
  const p=lost(w,()=>V.hit(F[0],w,1000,{kind:'true'}));
  for(let i=0;i<5;i++) castFS(L,F[0]); near(o(L).fpT,8,'finished: 8 s'); V.step(1); near(w.dmg,d0*(1+0.05*5+0.30),'it deals 30% more (with Find the Work\'s 25%)'); near(lost(w,()=>V.hit(F[0],w,1000,{kind:'true'})),p*0.70,'and takes 30% less');
  w.target=F[2]; const h2=F[2].hp, h3=F[3].hp; castFS(L,F[0]); assert.ok(F[2].hp<h2,'his next Forge Strike also falls on the Workpiece\'s target'); castFS(L,F[0]); castFS(L,F[0]); const k=F[2].hp; castFS(L,F[0]); assert.equal(F[2].hp,k,'3 of them');
  kill(L,w,F[3]); V.step(2); assert.ok(o(L).ex.length>=1,'an enemy it kills is made an Example');
  secs(8); assert.equal(o(L).fpT,0,'8 s'); V.step(1); V.wave(); V.step(1); for(let i=0;i<5;i++) castFS(L,F[0]); assert.equal(o(L).fpT,0,'once per fight');
});

/* ============================== EXAMPLES ============================== */
test('Tolley / Examples: Make an Example, Lesson Learned, Example to All, Warning Shown, Cautionary, Spark Eye (in the 5% crit group), Grim Display, Lesson in Iron (and its link), Make It Count',()=>{
  const L=lab(H,S(['wm_1_4','wm_4_4','wm_12_4','wm_2_4','wm_6_4','wm_9_3','wm_10_4','wm_n2','lf_1_1']),{foes:5,big:true,allies:1}), {v,F,A}=L; const f1=F[1], d1=f1.dmg, s1=f1.speed, ai=f1.atkInterval, a0=v.dmg, f2=F[2], d2=f2.dmg;
  const e0=hitOn(L,1000,{src:F[3]}); kill(L,v,F[0]); V.step(2); assert.equal(o(L).ex.length,1,'an enemy he kills is made an Example'); const z=o(L).ex[0]; near(z.t,4+1.5-V.STEP,'Lesson Learned: 4 + 0.5 x 3 s',1e-6);
  near(f1.dmg,d1*0.91,'Make an Example: an enemy within 4 + 3 m (Example to All) deals 3% x 3 less (its attack)'); near(f1.speed,s1*0.91,'Warning Shown: 3% x 3 slower'); near(f1.atkInterval,ai/0.94,'Cautionary: attacks 3% x 2 slower'); near(f2.dmg,d2,'(an enemy 9 m from it: nothing)');
  near(v.dmg,a0*1.025,'Grim Display: one Example this wave, 0.5% x 5 attack'); o(L).exN=10; V.step(1); near(v.dmg,a0*1.25,'Grim Display: ten Examples a wave at most (0.5% x 5 each)'); o(L).exN=11; V.step(1); near(v.dmg,a0*1.25,'(an eleventh: still ten at most)'); near(hitOn(L,1000,{src:F[3]}),e0*0.98*(1-0.015),'Lesson in Iron: 2% less for 4 s (and the Hardened stack its link gives: 0.3% x 5)'); assert.equal(stack(L,'tHd'),1,'with Past the Temper a Hardened stack');
  const cr=x=>rnd(L,x,()=>myHit(L,f1)), cf=plainHit(L,()=>myHit(L,f1,{crit:true})); near(cr(0.049),cf,'Spark Eye: near an Example, 1.5% x 5 more critical chance - at most 5% (a roll of 0.049 crits)',1e-6); near(cr(0.051),1000,'(0.051 does not)');
  secs(5.5); V.step(1); near(f1.dmg,d1,'gone after 5.5 s'); near(hitOn(L,1000,{src:F[3]}),plainHit(L,()=>hitOn(L,1000,{src:F[3]}))*(1-0.015),'(and the 4 s)');
  for(let i=0;i<8;i++) o(L).ex.push({x:0,y:0,t:9,k:1}); kill(L,v,L.F[4]); V.step(2); assert.equal(o(L).ex.length,8,'at most 8 Examples: the oldest falls off');
  const M=lab(H,S(['wm_1_4','wm_5_4']),{foes:5,big:true,allies:2}); const m1=M.F[1].dmg; kill(M,M.A[0],M.F[0]); V.step(2); near(M.F[1].dmg,m1*(1-0.09*0.9),'Make It Count: an ally within 4 m of him kills: an Example at 30% x 3 of the strength');
  const N=lab(H,S(['wm_1_4']),{foes:5,big:true,allies:1}); kill(N,N.A[0],N.F[0]); V.step(2); assert.equal(o(N).ex.length,0,'(an ally kill without Make It Count: no Example)');
  const Q=lab(H,S(['wm_1_4','wm_5_4']),{foes:5,big:true,allies:2}); at(Q,Q.A[1],-8.25,0); const ex0=o(Q).ex.length; Q.T.fn.decide(api(Q),Q.T,Q.v,{x:Q.F[4],at:{x:Q.F[4].x,y:Q.F[4].y},by:Q.A[1],hz:false}); assert.equal(o(Q).ex.length,ex0,'(Make It Count: an ally 4.5 m body-to-body: no Example)');
});

test('Tolley / Fear of the Forge: his new Example fears the enemy nearest to it for 1 s - never one already feared or stunned, nor within 0.5 s after his fear on it ended',()=>{
  const L=lab(H,S(['wm_1_4','wm_9_4']),{foes:4,big:true}), {v,F}=L; free(L); kill(L,v,F[0]); V.step(2);
  near(F[1].fearT,1-V.STEP,'the nearest enemy to the Example: feared 1 s',1e-6); assert.equal(F[1]._fearFrom,v,'away from him'); assert.ok(!(F[3].fearT>0),'(only the nearest)');
  free(L); F[1].fearT=0; secs(0.35); at(L,F[2],10.5,0.5); kill(L,v,F[2]); V.step(2); assert.ok(!(F[1].fearT>0),'within 0.5 s after his fear on it ended: refused'); assert.ok(o(L).ts.lk>=1,'(counted)');
  secs(0.6); free(L); F[1].stunned=2; at(L,F[3],10.5,-0.5); kill(L,v,F[3]); V.step(2); assert.ok(!(F[1].fearT>0),'a stunned enemy: refused'); assert.ok(o(L).ts.on>=1,'(counted)');
});

/* ============================== DAMAGE REDUCTION: TWO CAPPED GROUPS ============================== */
test('Tolley / damage reduction, one group of 30%: each talent, multiplied, and all together; his allies\' group of 35%',()=>{
  const ab=(L,o2)=>hitOn(L,1000,Object.assign({auto:false},o2||{})), au=(L,o2)=>hitOn(L,1000,Object.assign({auto:true},o2||{}));
  const A=lab(H,S(['mp_11_4','wm_8_3','lf_3_3']),{foes:2,big:true}); near(ab(A),plainHit(A,()=>ab(A))*0.925*0.925*0.925,'Furnace Lining, Temper of Mind, Refractory: abilities 1.5% x 5 less each (multiplied)'); near(au(A),plainHit(A,()=>au(A)),'(not basic attacks)');
  const B=lab(H,S(['lf_11_4']),{foes:2,big:true}); near(au(B),plainHit(B,()=>au(B))*0.925,'Thick Grate: basic attacks 1.5% x 5 less'); near(ab(B),plainHit(B,()=>ab(B)),'');
  const C=lab(H,S(['mp_4_3']),{foes:2,big:true}); near(ab(C),plainHit(C,()=>ab(C)),'Heat Shield: an enemy not burning - nothing'); burnOn(C,C.F[0],1,9); near(ab(C),plainHit(C,()=>ab(C))*0.94,'one carrying his burn: 2% x 3 less');
  const D=lab(H,S(['wm_4_1']),{foes:2,big:true,allies:1}); near(ab(D),plainHit(D,()=>ab(D))*0.95,'Steady Anvil: while his Workpiece lives, 1% x 5'); kill(D,D.F[0],D.A[0]); V.step(1); near(ab(D),plainHit(D,()=>ab(D)),'(it died)');
  const E=lab(H,S(['wm_11_4','lf_9_3']),{foes:2,big:true}); E.v.hp=0.55*E.v.maxHp; near(ab(E),plainHit(E,()=>ab(E)),'Foundry Walls, Ironside: above 50% nothing'); E.v.hp=0.4*E.v.maxHp; near(ab(E),plainHit(E,()=>ab(E))*0.90*0.90,'below 50%: 2% x 5 each');
  const G=lab(H,S(['lf_1_1']),{foes:2,big:true}); setStack(G,'tHd',10); near(ab(G),plainHit(G,()=>ab(G))*0.85,'Past the Temper: 0.3% x 5 a Hardened stack (10: 15%)');
  const X=lab(H,S(['mp_11_4','wm_8_3','lf_3_3','mp_4_3','wm_4_1','wm_11_4','lf_9_3','lf_1_1','wm_5_1']),{foes:2,big:true,allies:1}); burnOn(X,X.F[0],1,9); setStack(X,'tHd',10); X.v.hp=0.4*X.v.maxHp;
  near(ab(X),plainHit(X,()=>ab(X))*0.70,'all at once (0.925^4 x 0.94 x 0.95 x 0.9 x 0.9 x 0.85 = 0.48): never more than 30% off a hit');
  near(X.T.fn.drK(api(X),X.T,X.v,X.F[0],'phys',false),0.70,'(the pure function the 95% check reads)');
  const Y=lab(H,S(['wm_1_1','wm_5_1','wm_5_3','wm_6_3','lf_12_4','wm_13_2']),{foes:2,big:true,allies:2,cold:true}); Y.A[1].dmg=Y.A[0].dmg*2; at(Y,Y.A[1],0,-5.0); at(Y,Y.A[0],0,-7.25); V.step(1); const w=Y.A[1];
  const ally=(x,o2)=>lost(x,()=>V.hit(Y.F[0],x,1000,Object.assign({kind:'true',auto:false},o2||{})));
  near(ally(w),plainHit(Y,()=>ally(w))*0.925*0.955,'Shop Hearth: the Workpiece from abilities 1.5% x 5; Hearth Guard: within 3 m of him 1.5% x 3'); near(ally(w,{auto:true}),plainHit(Y,()=>ally(w,{auto:true}))*0.955,'(its basic attacks: Hearth Guard only, no Shop Hearth)'); at(Y,Y.A[0],0,-7.25); near(ally(Y.A[0]),plainHit(Y,()=>ally(Y.A[0])),'(an ally 3.75 m body-to-body: Hearth Guard is within 3 m, so nothing)');
  castFS(Y,Y.F[0]); near(ally(w),plainHit(Y,()=>ally(w))*0.925*0.955*0.97,'Workshop Floor: tempered under Every Hand Tempered, 1% x 3');
  castFS(Y,Y.F[0]); castFS(Y,Y.F[0]); assert.ok(o(Y).fpT>0,'(finished)'); near(ally(w),plainHit(Y,()=>ally(w))*0.65,'The Finished Piece\'s 30% on top: never more than 35% off a hit on one ally');
});

/* ============================== TEMPERED STEEL AND HARDENED ============================== */
test('Tolley / Hardened: from a full Tempered Steel, every 3 s in combat (Past the Temper); Case Hardened, Kiln Skin, Still Burning, Refused; Quick Temper; Never Cooled, Banked Coals, Slow to Cool',()=>{
  const L=lab(H,S(['lf_1_1','lf_4_1','lf_6_1','lf_12_2','lf_11_1','lf_2_1']),{foes:2}), {v,F}=L; v.wardenStk=0; v.wardenT=0; secs(1.95); assert.equal(v.wardenStk,0,'Quick Temper: not at 1.95 s (3 - 0.3 x 3 = 2.1 a stack)'); secs(0.25); assert.equal(v.wardenStk,1,'a stack every 2.1 s');
  v.wardenStk=4; secs(1); assert.equal(stack(L,'tHd'),0,'not before Tempered Steel is full'); v.wardenStk=5; o(L).ht=0; v.hp=0.5*v.maxHp; const h=v.hp, a0=v.dmg; secs(3.05); assert.equal(stack(L,'tHd'),1,'then a Hardened stack every 3 s');
  near(v.hp-h,0.009*v.maxHp,'Kiln Skin: 0.3% x 3 of his max HP as he gains it',1e-3); V.step(1); near(v.dmg,a0*1.015,'Case Hardened: 0.3% x 5 attack a stack');
  setStack(L,'tHd',9); near(myHit(L,F[0]),1000,''); setStack(L,'tHd',10); near(myHit(L,F[0]),1000*1.10,'Still Burning: at 10, his hits 2% x 5 more');
  v.hp=100; V.hit(F[0],v,1e7,{kind:'true'}); assert.ok(v.alive&&v.hp>=1,'Refused: a killing hit at 10 Hardened - he holds at 1 HP'); assert.equal(stack(L,'tHd'),0,'all spent'); secs(1.9); V.hit(F[0],v,1e7,{kind:'true'}); assert.ok(v.alive,'for 2 s');
  secs(0.2); v.hp=100; setStack(L,'tHd',10); V.hit(F[0],v,1e7,{kind:'true'}); assert.ok(!v.alive,'once per fight');
  const N=lab(H,S(['lf_1_1','lf_3_1','lf_12_1']),{foes:2,big:true}); N.v.wardenStk=5; setStack(N,'tHd',9); V.wave(); V.step(1); assert.equal(N.v.wardenStk,5,'Banked Coals 2 x 3 (6: all 5) is more than Never Cooled\'s half'); assert.equal(stack(N,'tHd'),4,'Never Cooled: half his Hardened (9: 4)');
  const B=lab(H,S(['lf_12_1']),{foes:2,big:true}); B.v.wardenStk=5; V.wave(); V.step(1); assert.equal(B.v.wardenStk,5,'Banked Coals 2 x 3 (6) keeps all 5 on its own');
  const C=lab(H,S(['lf_3_1']),{foes:2,big:true}); C.v.wardenStk=5; V.wave(); V.step(1); assert.equal(C.v.wardenStk,2,'Never Cooled: half his Tempered Steel (5: 2)');
  const K=lab(H,S(['lf_4_2']),{foes:2,big:true}); K.v.wardenStk=5; V.wave(); V.step(1); assert.equal(K.v.wardenStk,5,'Slow to Cool: all of it kept into the next wave'); secs(5.8); assert.equal(K.v.wardenStk,5,'for 2 s x 3');
  secs(0.4); assert.equal(K.v.wardenStk,2,'then what the new wave has built (2 stacks in 6 s)');
});

test('Tolley / Open Grate (no Housing; Tempered Steel 15 points higher, stacking past 5; Hardened only once it is full), Grate Thrown Wide (15% at most), Walking Foundry (doubled in the group)',()=>{
  const L=lab(H,S(['lf_5_3','lf_1_1','lf_6_3','lf_1_4']),{foes:2,big:true}), {v}=L; assert.equal(o(L).hsMax,0,'Open Grate: no Housing');
  v.wardenStk=5; V.step(1); const c=L.T.fn.tsCut(api(L),L.T,v), per=0.04*(v.passMul||1), cap0=VMX('SKLV.wardenCap(passLv(units[0]))'); near(c.cap1,cap0+0.15,'its cap 15 points higher');
  const need=Math.ceil((cap0+0.15)/per-1e-9); assert.ok(need>5,'(stacks needed: '+need+')'); near(c.c1,Math.min(cap0+0.15,per*5),'');
  secs(3.05); assert.equal(o(L).vst,1,'it keeps stacking past 5, every 3 s'); assert.equal(stack(L,'tHd'),0,'no Hardened before it is full');
  const k1=L.T.fn.drK(api(L),L.T,v,null,'phys',true), c1=L.T.fn.tsCut(api(L),L.T,v); near(k1,Math.max(0.70,(1-c1.c1)/(1-c1.c0)),'the part above the game\'s own share is in his 30% group');
  o(L).vst=need-5; V.step(1); assert.ok(L.T.fn.tsFull(api(L),L.T,v),'full at '+need+' stacks'); secs(3.05); assert.equal(stack(L,'tHd'),1,'then Hardened');
  V.step(1); const a=L.T.fn.atkK(api(L),L.T,v); near(a,Math.min(0.15,0.03*Math.floor((cap0+0.15)/0.04+1e-9))+0,'Grate Thrown Wide: 1% x 3 attack for every 4% of it, at most 15%',1e-9);
  const G=lab(H,S(['lf_5_3','lf_1_1','lf_6_3']),{foes:2,big:true}); G.v.wardenStk=4; V.step(1); const cg=G.T.fn.tsCut(api(G),G.T,G.v), a4=G.T.fn.atkK(api(G),G.T,G.v); near(a4,Math.min(0.15,0.03*Math.floor(cg.c1/0.04+1e-9)),'Grate Thrown Wide: 1% x 3 attack for every 4% of it (4 stacks: 12%)',1e-9);
  const W=lab(H,S(['lf_7_2','lf_1_1']),{foes:2,big:true}); W.v.wardenStk=5; setStack(W,'tHd',4); V.step(1); const k0=W.T.fn.drK(api(W),W.T,W.v,null,'phys',true); near(k0,1-0.015*4,'(4 Hardened: 6%)');
  castLF(W,W.F[0]); V.step(1); const kk=W.T.fn.drK(api(W),W.T,W.v,null,'phys',true); near(kk,0.70,'Walking Foundry: while Living Forge burns, Tempered Steel and Hardened count double - inside the 30% cap');
  secs(5.1); near(W.T.fn.drK(api(W),W.T,W.v,null,'phys',true),1-0.015*stack(W,'tHd'),'for its 5 s (single again)');
  const H2=lab(H,S(['lf_7_2','lf_1_1']),{foes:2,big:true}); setStack(H2,'tHd',4); V.step(1); near(H2.T.fn.drK(api(H2),H2.T,H2.v,null,'phys',true),1-0.015*4,'(4 Hardened alone, no Tempered Steel: 6%)');
  castLF(H2,H2.F[0]); V.step(1); near(H2.T.fn.drK(api(H2),H2.T,H2.v,null,'phys',true),1-0.015*8,'Walking Foundry: Hardened counts double while it burns (8 of them: 12%)');
});

/* ============================== HOUSING ============================== */
test('Tolley / Housing: Outer Housing and Sealed Seams, takes hits first, rebuilds after 6 s without damage (Riveted Plates), Rebuilt, Tough Rivets, Banked Fire and Ember Flare, Second Housing, Heat Inside, Layered Housing',()=>{
  const L=lab(H,S(['lf_1_4','lf_5_4','lf_2_4','lf_7_4','lf_6_4','lf_9_4','lf_5_2','lf_6_2','lf_3_4','lf_10_4']),{foes:3}), {v,F}=L; const mx=0.12*v.maxHp;
  near(o(L).hsMax,mx,'3% x 3 + 1% x 3 of his max HP'); near(v.shield,mx,'whole at the wave start'); near(myHit(L,F[1]),1000*1.10,'Heat Inside: while it holds, his hits 2% x 5 more');
  v.wardenStk=0; const h0=v.hp; V.hit(F[0],v,100,{kind:'true',auto:true}); assert.equal(v.hp,h0,'it takes the hit'); near(o(L).hs,mx-100*0.95,'(Layered Housing 1% x 5 first)',1e-6);
  const s0=o(L).hs; V.hit(F[0],v,100,{kind:'true',auto:false}); V.step(1); near(o(L).hs,s0-95/1.2,'Tough Rivets: against an ability it absorbs 10% x 2 more',1e-6); near(v.shield,o(L).hs,'(the shield follows)',1e-6);
  v.hp=0.5*v.maxHp; const hh=v.hp; secs(4.4); assert.ok(o(L).hs<mx-1,'not rebuilt yet'); secs(0.2); near(o(L).hs,mx,'rebuilt after 6 - 0.5 x 3 s without damage'); near(v.hp-hh,0.05*v.maxHp,'Rebuilt: 1% x 5 of his max HP',1e-3);
  F[0].dots=[]; F[1].dots=[]; V.hit(F[0],v,mx*2,{kind:'true',auto:true}); assert.equal(o(L).hs,0,'broken'); const b=myDots(L,F[0],'bf')[0]; assert.ok(b,'Banked Fire: every enemy within 3 m burns'); assert.ok(!myDots(L,F[1],'bf').length,'(not 10 m)');
  near(b.dps,L.T.fn.cqBurn(api(L),L.T,v)*1.15,'as Chain Quench\'s burn, Ember Flare 3% x 5 stronger'); assert.equal(b.remaining,4,'for 4 s');
  V.step(1); near(o(L).hs,mx/2,'Second Housing: the first break each wave, half of it at once'); V.hit(F[0],v,mx,{kind:'true',auto:true}); V.step(1); assert.equal(o(L).hs,0,'(not the second)');
  const S2=lab(H,S(['lf_1_4']),{foes:2,big:true}), m2=0.09*S2.v.maxHp; S2.v.shield+=50; S2.v.shieldT=0.5; secs(0.6); near(S2.v.shield,m2,'another shield running out does not take Housing with it');
  V.hit(S2.F[0],S2.v,10,{kind:'true'}); const hs1=S2.T.s.tl.hs; assert.ok(hs1<m2,''); secs(5.9); near(S2.T.s.tl.hs,hs1,'',1e-9); secs(0.2); near(S2.T.s.tl.hs,m2,'6 s without Riveted Plates');
});

/* ============================== MISCELLANEOUS ============================== */
test('Tolley / Drop Weight, Heavy Hammer, Hammer Weighted (Forge Strike), Anvil Rhythm and Cinder Fists (basic attacks), Struck Hot, Walking Out, Ore-Bound, Kiln Breath, Long Burning, Bolted Shut',()=>{
  const L=lab(H,S(['mp_7_1','wm_3_2','lf_8_3','wm_7_1','lf_8_1','wm_12_3','lf_4_3','lf_5_1','lf_10_1','lf_11_2','lf_12_3']),{foes:3,big:true}), {v,F}=L;
  const p=plainHit(L,()=>dmgOf(F[0],()=>castFS(L,F[0]))); v.hp=0.5*v.maxHp; const h=v.hp; near(dmgOf(F[0],()=>castFS(L,F[0])),p*1.15*1.15*1.15,'Forge Strike 3% x 5 more, three times'); near(v.hp-h,0.02*v.maxHp,'Struck Hot: each Forge Strike heals 1% x 2');
  near(myHit(L,F[0],{auto:true}),1000*1.10*1.10,'basic attacks 2% x 5, twice'); near(myHit(L,F[0]),1000,'(not other hits)');
  const P0=lab(H,null,{foes:2,big:true}), sp=P0.v.speed; const L2=lab(H,S(['lf_4_3','lf_5_1','lf_10_1','lf_11_2','lf_12_3']),{foes:3,big:true}), u=L2.v; near(u.speed,sp*1.09,'Walking Out: 3% x 3 faster');
  u.stunned=0; ccOn(L2.F[0],u,'stunned',2); near(u.stunned,VMX('ccDur(2)')*0.80,'Ore-Bound: 4% x 5 shorter (20%: its own cap)',1e-6);
  L2.F[0].dots=[]; secs(1.02); const k=myDots(L2,L2.F[0],'kb')[0]; assert.ok(k,'Kiln Breath: an enemy within 2 m burns'); near(k.dps,0.05*u.dmg,'1% x 5 of his attack a second',1e-3); assert.ok(!myDots(L2,L2.F[1],'kb').length,'(not 10 m)');
  at(L2,L2.F[2],0,5.9); secs(1.02); assert.ok(!myDots(L2,L2.F[2],'kb').length,'(not 2.15 m body-to-body)');
  const a0=u.dmg; secs(5); V.step(1); near(u.dmg,a0,'(5 s alive: nothing yet)',1e-3); secs(5); V.step(1); near(u.dmg,a0*1.025,'Long Burning: 10 s alive in the wave, 0.5% x 5 attack',1e-3); V.wave(); V.step(1); near(u.dmg,a0,'(each wave)',1e-3);
  u.stunned=1e6; u.pulledBy={x:u.x+10*V.METER,y:u.y,alive:true}; u.pullSpeed=100; u.pullStop=0; u.pullT=1; V.step(1); near(u.pullSpeed,50,'Bolted Shut: a pull on him 25% x 2 slower (50% at most)');
});

test('Tolley / Fire Still In It (SIGNATURE): below 30% HP, once per fight: his Living Forge where he stands, 5 s he cannot drop below 1 HP, each hit he takes a Hardened stack, then 3% of his max HP for each',()=>{
  const L=lab(H,S(['lf_13_2','lf_12_2','lf_1_1']),{foes:2,allies:1}), {v,F,A}=L; const n0=VMX('groundHazards.length'); v.hp=0.31*v.maxHp; V.step(1); assert.equal(VMX('groundHazards.length'),n0,'not above 30%');
  v.hp=0.29*v.maxHp; V.step(1); assert.equal(VMX('groundHazards.length'),n0+1,'below 30%: his Living Forge at once'); const hz=VMX('groundHazards[groundHazards.length-1]'); near(hz.x,v.x,'where he stands',1e-6); near(hz.y,v.y,'',1e-6);
  for(let i=0;i<4;i++) V.hit(F[0],v,1e7,{kind:'true'}); assert.ok(v.alive&&v.hp>=1,'he cannot drop below 1 HP'); assert.equal(stack(L,'tHd'),4,'each hit a Hardened stack');
  v.hp=1000; const h=v.hp; secs(5.05); near(v.hp-h,0.03*4*v.maxHp,'when the 5 s end: 3% of his max HP for each Hardened stack',1e-3);
  V.hit(F[0],v,10,{kind:'true'}); assert.equal(stack(L,'tHd'),4,'(after the 5 s: no new stack)');
  const n1=VMX('groundHazards.length'); v.hp=0.2*v.maxHp; V.step(1); assert.ok(VMX('groundHazards.length')<=n1,'(no second Living Forge)'); V.hit(F[0],v,1e7,{kind:'true'}); assert.ok(!v.alive,'once per fight');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Tolley: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H), TEAM=['vael','sylthaine','vireo','vex','tolley'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={cru:0,hd:0,mol:0,ws:0,ex:0,hs:0};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s, Q=T0.tl; mx.cru=Math.max(mx.cru,(T0.k.tCru||{n:0}).n); mx.hd=Math.max(mx.hd,(T0.k.tHd||{n:0}).n);
    if(Q){ mx.mol=Math.max(mx.mol,Q.mN); mx.ws=Math.max(mx.ws,Q.ws); mx.ex=Math.max(mx.ex,Q.ex.length); mx.hs=Math.max(mx.hs,Q.hs>0?1:0); } }
  assert.ok(mx.cru>=1,'a real Crucible: '+mx.cru); assert.ok(mx.mol>=1,'real Molten enemies'); assert.ok(mx.ws>=1,'a real Workpiece tempered'); assert.ok(mx.hd>=1,'real Hardened');
  console.log('  live fight: max '+JSON.stringify(mx)); determinism(H,TEAM);
});

/* With nothing learned, whole seeded fights with Tolley in the line-up are identical to the pre-talent page (ee8edab8), seed by seed (his talents add no page
   line: they ride on hooks earlier heroes put there - kit / cast / at / num 'hzTick' / absorb / teamCc / moved). */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Tolley: no talents - whole fights with him in the line-up are identical to the pre-talent page',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['tolley','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __tbN={fs:0,cq:0,lf:0}; var __tbD=_doEffectCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="tolley"&&(!o||!o.deliver||o._arrived)){ if(type==="cleave") __tbN.fs++; if(type==="chainquench") __tbN.cq++; if(type==="ashfall") __tbN.lf++; } return __tbD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__tbN'); console.log('  identity: '+JSON.stringify(c)); assert.ok(c.fs>0&&c.cq>0&&c.lf>0,'the fights cast Forge Strike ('+c.fs+'), Chain Quench ('+c.cq+') and Living Forge ('+c.lf+')'); }
  finally{ VMX('_doEffectCore=__tbD;'); }
  assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* builds that go deep on chosen talents (each legal) */
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={mp:0,wm:1,lf:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* his one control, in seeded fights: Fear of the Forge never lands on a feared or stunned enemy, nor within 0.5 s after his fear on it; the longest an enemy
   stays feared by him in a row. (He has no stun: no kit stun, no talent stun.) */
const FEARW={ wm:['wm_9_4','wm_7_4','wm_1_4','wm_4_4','wm_12_4','wm_5_4','wm_10_4'], mp:['mp_1_4','mp_13_2'], lf:['lf_1_1','lf_13_2'] };
test('Tolley: the fear-lock rule holds in seeded fights, and his longest fear chain on one enemy',()=>{
  const builds=[[['wm'],[91]],[['wm','mp'],[61,30]],[['wm','lf'],[61,30]]].map(([o2,c])=>{ const b=deep(o2,c,FEARW); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.ok(b.r.wm_9_4,'with Fear of the Forge'); return {o:o2,list:T.learned(H,b),b}; });
  VMX('var __tf={run:0,fears:0,ref:0,ticks:0}; var __tfU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="tolley"&&u._tal&&u._tal.s.tl)) continue; const Q=u._tal.s.tl; __tf.ticks++; if(Q.runMax>__tf.run) __tf.run=Q.runMax; __tf.fears=Q.ts.n; __tf.ref=Q.ts.on+Q.ts.lk; } return __tfU.apply(this,arguments); };');
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')); const out=[];
  try{ for(const B of builds){ VMX('__tf.run=0; __tf.ticks=0'); let fears=0, ref=0;
      const sn=snaps(['tolley','vael','vireo','sylthaine','gruel'].map(k=>Object.assign(spec(k,100,k===H?B.list:null),{skillLv:[100,100,100,100]})));
      for(const node of [34,60,90,120]) for(const seed of [11,90210]){ VMX('__tf.fears=0; __tf.ref=0'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); fears+=VMX('__tf.fears'); ref+=VMX('__tf.ref'); }
      const c=JSON.parse(JSON.stringify(VMX('__tf'))); out.push(B.o.join('+')+' '+JSON.stringify(T.spent(H,B.b).tree)+': fears tried '+fears+', refused '+ref+', longest fear on one enemy in a row '+c.run.toFixed(2)+' s');
      assert.ok(c.ticks>300,'he fought'); assert.ok(c.run<=1.0+0.05,'no enemy feared by him more than 1 s in a row (seen '+c.run.toFixed(2)+' s)'); } }
  finally{ VMX('_updateBattleCore=__tfU;'); }
  console.log('  fear chains: '+out.join(' | '));
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. Tolley's talent reductions are one capped group (30%)
   on top of the game's own Tempered Steel (29.9% at level 100). Each candidate build is 91 points legal; the most defensive is the one whose worst hit is
   reduced most. */
const DEF={ mp:['mp_11_4','mp_4_3','mp_3_3'], wm:['wm_4_1','wm_n2','wm_5_1','wm_8_3','wm_11_4','wm_1_2'], lf:['lf_1_1','lf_11_4','lf_3_3','lf_10_4','lf_9_3','lf_7_2','lf_1_4','lf_2_2','lf_7_1','lf_1_3','lf_12_4'] };
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,4.5][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,0,0,-5][i]*V.METER; a.y=v.y-[5.5,11,16.5,5][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on him: every condition of his damage-reduction talents true at once - Tempered Steel full, 10 Hardened, Living Forge burning (Walking Foundry),
   the attacker carrying his burn, his Workpiece alive, an Example just made (Lesson in Iron), below 50% HP, Housing up (Layered Housing; the hit is measured
   through it); an ability and a basic attack, normal and critical, physical and magic, with his armour and magic resist; and again with glyph damage reduction
   at its 30% cap */
function worstHit(list,kind,crit,auto,glyph){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.45*v.maxHp; v.glyphDR=glyph||0; v.wardenStk=5;
  if(L.T){ const Q=L.T.s.tl; if(Q){ Q.lfT=5; Q.liT=4; } L.T.s.k.tHd={n:10,t:99,idle:0}; if(Q&&Q.hs>0) Q.hs=1e9; }
  if(L.T&&L.T.s.api) L.T.fn.burn(L.T.s.api,L.T,v,f,1,9,'x');
  v.shield=0; const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Tolley: his most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and he is at 85% or more for well under half a fight',()=>{
  const cands=[[['mp','wm'],[61,30]],[['mp','lf'],[61,30]],[['wm','mp'],[61,30]],[['wm','lf'],[61,30]],[['lf','mp'],[61,30]],[['lf','wm'],[61,30]],[['mp'],[91]],[['wm'],[91]],[['lf'],[91]],[['lf','wm','mp'],null]].map(([o2,c])=>{ const b=deep(o2,c,DEF); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o:o2,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const auto of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,auto,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,auto,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="tolley"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="tolley"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)||(u._tal&&u._tal.s.undy>0)) __dr.imm++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1)*((u.pass&&u.pass.warden&&u.wardenStk)?1-wardenCut(u):1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys",true):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic",true):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','tolley'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>40&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling');
    assert.ok(d.imm<0.10*d.ticks,'immune (held at 1 HP) for a small share only: '+d.imm+' of '+d.ticks);
    assert.ok(d.te85<0.25*d.t,'at 85% or more for well under half of his time in the fights ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
