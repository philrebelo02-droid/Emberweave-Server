'use strict';
/* Carn's talents as data on the mechanics layer (talents-mech/carn.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the two page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit / one tick (plainHit, tickRatio) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Carn, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12); A0 (0,-5.5).
   Bodies: Carn 1.74 m, the lab's Vaels 2.01 m (F0 0.75 m from him body to body). Lab units are HELD (stunned 1e6), Carn too: still() lets him act on
   nothing (a stun on him would clear his Pace). Run: node --test tests/talents-mech-carn.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='carn', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const noDef=L=>{ for(const f of L.F){ f.mrRating=0; f.armorRating=0; } };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage: no armor in the way)
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));                       // his hit on t
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
/* Carn not held, but doing nothing by himself (no walk, no swing, no cast, no ultimate) */
const still=v=>{ v.stunned=0; v.fearT=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; };
/* Paid Out at n steps (T.s.paid is the HP, the 'steps' stack its steps) */
const setPaid=(L,n)=>{ L.T.s.paid=n*0.1*L.v.maxHp; setStack(L,'steps',Math.min(10,Math.floor(n+1e-9))); };
/* one of his bleeds on t (a skill's DoT made his, as his always rows make Crimson Reap's and Vein Burst's) */
const bleed=(L,t,tag,dps,dur)=>{ V.dot(t,dps||10,dur||8,1,L.v); const d=t.dots[t.dots.length-1]; d._talO=L.v.uid; d._talK=tag||'reap'; return d; };
const mine=(L,t,tag)=>(t.dots||[]).filter(d=>d._talO===L.v.uid&&(tag==null||d._talK===tag));
/* enemies 0..n-1 on a ring of r m around him (5 at 6 m: each 2.25 m from him body to body, 7 m from each other), the others far away */
const ring=(L,n,r)=>{ L.F.forEach((f,i)=>{ if(i<n){ const a=2*Math.PI*i/n; at(L,f,r*Math.cos(a),r*Math.sin(a)); } else at(L,f,6+5*(i-n),14); }); };
function tickLoss(L,t,d){ for(const u of VMX('units')) for(const x of (u.dots||[])) if(x!==d) x.acc=0; const r=Math.max(2,d.remaining); d.remaining=r; d.acc=d.interval; const l=lost(t,()=>V.step(1)); d.remaining=r; return l; }
function tickRatio(L,t,d){ const a=tickLoss(L,t,d), T0=L.v._tal; L.v._tal=undefined; try{ return a/tickLoss(L,t,d); } finally{ L.v._tal=T0; } }
/* a hit of his during one of his skills (casting rows) against the same hit with his talents off */
function skillRatio(L,t,skill){ L.T.s.cur=skill; let a; try{ a=myHit(L,t); } finally{ L.T.s.cur=null; } return a/plainHit(L,()=>myHit(L,t)); }
const clk=(L,key)=>{ const l=L.T.s.lim[key]; if(l) l.acc=0; };
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };
const auto=(L,t,o)=>V.hit(L.v,t||L.F[0],100,Object.assign({kind:'true',auto:true},o||{}));                 // a basic attack of his that lands
const doseCast=L=>FX.cast(L.v,'x',{});                                                                      // an ability cast (only the Dose row reads it)

test('Carn: every talent is accounted for - 11 plain stats, 104 with rows, none waiting',()=>{
  accounting(H,[115,11,104,0,0]);
  const M=FXN.mech(H); for(const id of ['pr_1_1','fc_1_1','bt_1_1','pr_13_2','fc_13_2','bt_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['pr_2_3','pr_7_1','pr_8_1','pr_11_4','fc_2_3','fc_8_3','fc_1_2','bt_3_3','bt_8_1','bt_9_3','bt_8_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Carn: his real kit, as the talents read it - Reckless Blow\'s cost, Vein Burst\'s 2.8 m from centre to centre (nobody), Crimson Reap\'s wedge and bleed',()=>{
  plain({foes:5},P=>{ const {v,F}=P; noDef(P); v.hp=v.maxHp*0.9; const h0=v.hp, f0=F[0].hp;
    V.cast(v,'green',F[0]); assert.ok(F[0].hp<f0,'Reckless Blow strikes its target'); near(h0-v.hp,v.maxHp*0.06,'and costs him 6% of his max HP');
    v.hp=v.maxHp*0.03; V.cast(v,'green',F[0]); near(v.hp,1,'never below 1 HP');
    const g=F.map(f=>f.hp); V.cast(v,'blue',F[0]); assert.deepEqual(F.map(f=>f.hp),g,'Vein Burst: 2.8 m from his centre to the enemy\'s centre reaches nobody (F0 is 4.5 m away)'); assert.equal(F[0].dots.length,0,'');
    at(P,F[3],0,6); const r=F.map(f=>f.hp); V.cast(v,'ult',F[0]); assert.ok(F[0].hp<r[0],'Crimson Reap: F0 in the wedge'); near(r[3]-F[3].hp,0,'not F3 (90 degrees off)'); near(r[1]-F[1].hp,0,'not F1 (10 m: 7.99 m to its body edge, past 6.5 m)');
    const d=F[0].dots.find(x=>x.color==='#c0392b'); assert.ok(d,'its bleed'); assert.equal(d.remaining,4,'for 4 s'); near(d.dps,v.dmg*0.3,'30% of his attack a second'); assert.equal(d._talO,undefined,'(the game\'s: nobody\'s talents)'); });
  const L=lab(H,S(['pr_10_3']),{foes:5}), {v,F}=L;
  const g=F.map(f=>f.hp); V.cast(v,'blue',F[0]); assert.ok(F[0].hp<g[0],'with a Vein Burst talent it reaches to the body edge: F0 (2.49 m)'); near(g[3]-F[3].hp,0,'not F3 (3.99 m)');
  assert.equal(mine(L,F[0],'vein').length,1,'its bleed is his (vein)'); V.cast(v,'ult',F[0]); assert.equal(mine(L,F[0],'reap').length,1,'and Crimson Reap\'s (reap)');
});

/* ============================== THE PRICE ============================== */
test('Carn / Paid Out: Ledger of Blood, Keeps the Count, Price Paid, The Count, Debt Called',()=>{
  const L=lab(H,S(['pr_1_1','pr_2_1','pr_4_1','pr_10_1','pr_12_2']),{foes:3,big:true}), {v,F}=L; noDef(L);
  v.maxHp=1e5; v.hp=9e4; V.cast(v,'green',F[0]); near(L.T.s.paid,6000,'every HP Reckless Blow costs him is written down'); assert.equal(stack(L,'steps'),0,'(less than a step)');
  v.hp=1000; V.cast(v,'green',F[0]); near(L.T.s.paid,6000+999,'only what it really took (he stays at 1 HP)'); assert.equal(stack(L,'steps'),0); v.hp=v.maxHp;
  const c0=v.glyphCrit; setPaid(L,4); V.step(1);
  near(myHit(L,F[1]),plainHit(L,()=>myHit(L,F[1]))*(1+0.02*4),'Ledger of Blood: 0.4% x 5 more damage per step');
  near(skillRatio(L,F[1],'reckless'),(1+0.02*4)*(1+0.03*4),'Keeps the Count: Reckless Blow 1% x 3 more per step');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.015*4),'Price Paid: 0.3% x 5 less per step'); near(v.glyphCrit,c0+0.005*4,'The Count: 0.1% x 5 critical chance per step');
  setPaid(L,10); V.step(1); near(skillRatio(L,F[1],'reckless'),(1+0.2)*(1+0.3)*1.15,'Debt Called: at 10 steps Reckless Blow 3% x 5 more'); near(v.glyphCrit,c0+0.05,'The Count at 10: 5%, the crit-chance cap');
  setPaid(L,12); V.step(1); assert.equal(stack(L,'steps'),10,'up to 10 steps'); v.hp=v.maxHp; V.cast(v,'green',F[0]); near(L.T.s.paid,v.maxHp,'Paid Out holds at most his max HP');
});

test('Carn / Reckless Blow: Means It, Bigger Price, All In, Throw It Anyway, Hard Bargain, Interest Due, Nothing Held Back',()=>{
  const cast=L=>{ const {v,F}=L; v.maxHp=1e5; v.hp=5e4; const h=v.hp, f=F[0].hp; V.cast(v,'green',F[0]); return {self:h-v.hp,hit:f-F[0].hp}; };
  const A=lab(H,S(['pr_4_2','pr_5_2']),{foes:3,big:true}); noDef(A); const a=cast(A); near(a.self,1e5*0.09*2,'Bigger Price 1% x 3 more cost, All In twice: 18% of his max HP');
  near(skillRatio(A,A.F[1],'reckless'),1.18*1.40,'their damage: 6% x 3 and 40%');
  const B=lab(H,S(['pr_4_2','pr_5_2','pr_3_1']),{foes:3,big:true}); noDef(B); const b=cast(B); near(b.hit-a.hit,1e5*0.18,'Throw It Anyway: the cost is dealt to the target too',1e-6);
  const C=lab(H,S(['pr_9_3','pr_2_2']),{foes:3,big:true}); noDef(C); const c=cast(C); near(c.self,1e5*0.06-c.hit*0.20,'Hard Bargain: the Blow heals him 4% x 5 of its damage',1e-6);
  near(skillRatio(C,C.F[1],'reckless'),1.15,'Means It: 3% x 5 more');
  const D=lab(H,S(['pr_6_1','pr_1_1']),{foes:3,big:true}), {v}=D; noDef(D); v.maxHp=1e5; setPaid(D,9.5); v.hp=98000; V.cast(v,'green',D.F[0]);
  assert.equal(stack(D,'steps'),10,'(the Blow took it to 10 steps)'); near(v.hp,1e5,'Interest Due: 3% x 3 of his max HP, after the cost (98000 - 6000 + 9000, up to his max HP)'); setPaid(D,9.5); V.cast(v,'green',D.F[0]); near(v.hp,94000,'once per fight');
  const E=lab(H,S(['pr_6_2','pr_5_2']),{foes:3,big:true}); let n=0, m=0; E.T.s.cur='reckless'; for(let i=0;i<600;i++) if(FX.crit(E.v,E.F[0],false,'phys',false)) n++; E.T.s.cur=null; for(let i=0;i<200;i++) if(FX.crit(E.v,E.F[0],false,'phys',false)) m++;
  assert.ok(n>=12&&n<=50,'Nothing Held Back: under All In, Reckless Blow 1% x 5 more critical chance (seeded): '+n+' of 600'); assert.equal(m,0,'only Reckless Blow');
  const G=lab(H,S(['pr_6_2']),{foes:3}); G.T.s.cur='reckless'; let k=0; for(let i=0;i<300;i++) if(FX.crit(G.v,G.F[0],false,'phys',false)) k++; G.T.s.cur=null; assert.equal(k,0,'and only under All In');
});

test('Carn / Pay in Installments (PICK ONE) and Small Payments: the cost drains over 4 s, never below 1 HP, and he takes 1% x 5 less meanwhile',()=>{
  const L=lab(H,S(['pr_5_3','pr_7_3','pr_1_1']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e5; v.hp=5e4; V.cast(v,'green',F[0]);
  near(v.hp,5e4,'nothing at once'); assert.ok(win(L,'drain'),'it drains'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.95,'Small Payments: 1% x 5 less while it drains');
  const h=v.hp; secs(2); near(h-v.hp,6000*0.5,'half after 2 s',2e-2); secs(2.2); near(h-v.hp,6000,'all of it after 4 s',1e-9); near(L.T.s.paid,6000,'every drop written down as Paid Out',1e-9);
  assert.ok(!win(L,'drain')); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'not after');
  v.hp=1500; V.cast(v,'green',F[0]); secs(4.2); near(v.hp,1,'never below 1 HP'); near(L.T.s.paid,6000+1499,'only what it took');
});

test('Carn / Paid Out across waves: Never Called Victory, Spent Freely; and kills: Arithmetic, Bridge Ends',()=>{
  { const L=lab(H,S(['pr_1_1','pr_12_1']),{foes:3,big:true}); assert.equal(stack(L,'steps'),6,'Spent Freely: each wave starts with 2 x 3 steps'); setPaid(L,8); V.wave(); V.step(1); assert.equal(stack(L,'steps'),6,'Paid Out is the wave\'s: 8 back to 6'); }
  { const L=lab(H,S(['pr_1_1','pr_12_1','pr_11_1']),{foes:3,big:true}); setPaid(L,8); V.wave(); V.step(1); assert.equal(stack(L,'steps'),8,'Never Called Victory: it carries over'); setPaid(L,3); V.wave(); V.step(1); assert.equal(stack(L,'steps'),6,'Spent Freely still lifts it to 6'); }
  const L=lab(H,S(['pr_9_2','pr_12_3','pr_1_1']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e5; v.hp=5e4;
  kill(L,F[0]); near(L.T.s.paid,5000,'Arithmetic: each kill writes 1% x 5 of his max HP'); near(v.hp,5e4+2000,'Bridge Ends: heals 1% x 2 of his max HP');
  const d=bleed(L,F[1],'reap',100,4); F[1].hp=50; F[1].shield=0; for(let i=0;i<40&&F[1].alive;i++) V.step(1); assert.ok(!F[1].alive,'a bleed of his kills'); near(L.T.s.paid,10000,'and that kill counts'); near(v.hp,5e4+4000,'');
});

test('Carn / What It Cost (SIGNATURE): at 10 steps the next Reckless Blow strikes every enemy within 3 m for 50% of Paid Out, heals him half of that, empties it; once every 25 s',()=>{
  const L=lab(H,S(['pr_13_2','pr_1_1']),{foes:3,big:true}), {v,F}=L; noDef(L); v.maxHp=1e5; v.hp=5e4; at(L,F[1],0,6.5); setPaid(L,10);
  const f0=F[0].hp, f1=F[1].hp, f2=F[2].hp; V.cast(v,'green',F[0]); const first=f0-F[0].hp;
  assert.equal(stack(L,'steps'),0,'Paid Out empties'); near(f1-F[1].hp,5e4,'F1 (2.75 m body to body) takes 50% of the 1e5 HP Paid Out held'); near(f2-F[2].hp,0,'not F2 (15.5 m)');
  near(v.hp,5e4-6000+25000,'he heals half of that'); setPaid(L,10); const g0=F[0].hp; V.cast(v,'green',F[0]); near(first-(g0-F[0].hp),5e4,'F0 took the Blow and the payback');
  assert.equal(stack(L,'steps'),10,'once every 25 s (not again at once)'); secs(24.4); V.cast(v,'green',F[0]); assert.equal(stack(L,'steps'),10,'(24.4 s: not yet)'); secs(0.7); V.cast(v,'green',F[0]); assert.equal(stack(L,'steps'),0,'after 25 s again');
});

test('Carn / Hours: Sixth Hour, Watch on the Bridge, Noon Bells, Long Watch, Seventh Hour, Six Hours Held, Past Noon, Crimson Hour',()=>{
  const L=lab(H,S(['pr_1_4','pr_3_4','pr_6_4','pr_5_4','pr_12_4','pr_10_4','pr_9_4','pr_7_4']),{foes:3,big:true}), {v,F}=L; noDef(L);
  near(L.T.st.hour.max,9,'Seventh Hour: up to 6 + 3'); clk(L,'#6'); secs(3.8-0.1); assert.equal(stack(L,'hour'),0,''); secs(0.2); assert.equal(stack(L,'hour'),1,'Long Watch: an Hour every 5 - 0.4 x 3 s');
  const ls=v.lifestealStat||0, a0=v.dmg, i0=v.atkInterval; setStack(L,'hour',5); V.step(1);
  near(v.lifestealStat-ls,0.015*4,'Sixth Hour: 0.5% x 3 lifesteal per Hour (4 more)'); near(v.dmg,a0*(1+0.015*5)/(1+0.015*1),'Watch on the Bridge: 0.3% x 5 attack per Hour'); near(v.atkInterval,i0*(1+0.01*1)/(1+0.01*5),'Noon Bells: 0.5% x 2 attack speed per Hour');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'5 Hours: no Six Hours Held'); near(myHit(L,F[1],{auto:true}),plainHit(L,()=>myHit(L,F[1],{auto:true})),'nor Past Noon');
  setStack(L,'hour',6); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.075),'Six Hours Held: at 6 Hours 1.5% x 5 less'); near(myHit(L,F[1],{auto:true}),plainHit(L,()=>myHit(L,F[1],{auto:true}))*1.10,'Past Noon: his basic attacks 2% x 5 more');
  near(myHit(L,F[1]),plainHit(L,()=>myHit(L,F[1])),'(not a skill hit)');
  setStack(L,'hour',2); V.cast(v,'ult',F[0]); assert.equal(stack(L,'hour'),3,'Crimson Hour: one Hour for each enemy Crimson Reap hits');
  V.wave(); V.step(1); assert.equal(stack(L,'hour'),0,'Hours start again each wave');
});

test('Carn / Marked the Man, Grown Blade, Old Wounds Open, Deep Pockets, Trench Grit',()=>{
  const L=lab(H,S(['pr_n1','pr_1_3','pr_8_3','pr_5_1','pr_4_3']),{foes:3,big:true}), {v,F}=L;
  hitOn(L,v,10,{src:F[1]}); assert.ok(mark(L,F[1],'mtm'),'the last enemy to hit him'); v.hp=v.maxHp; F[1].hp=F[1].maxHp*0.5; F[2].hp=F[2].maxHp*0.5;
  near(myHit(L,F[1]),plainHit(L,()=>myHit(L,F[1]))*1.10,'Marked the Man: takes 2% x 5 more from him'); near(myHit(L,F[2]),plainHit(L,()=>myHit(L,F[2])),'not another enemy (and no more HP left than him: no Grown Blade)');
  hitOn(L,v,10,{src:F[2]}); assert.ok(mark(L,F[2],'mtm')&&!mark(L,F[1],'mtm'),'only the last one');
  v.hp=v.maxHp*0.5; F[0].hp=F[0].maxHp; near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0]))*1.10*(1+0.02*5),'Grown Blade: an enemy with a larger share of HP left: 2% x 5; Old Wounds Open: 50% missing, 5 x 0.4% x 5');
  v.hp=v.maxHp*0.65; near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0]))*1.10*(1+0.02*3),'35% missing: 3 steps'); v.hp=v.maxHp*0.2; near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0]))*1.10*(1+0.02*5),'up to 50%');
  v.hp=v.maxHp; near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*(1-0.075),'Deep Pockets: 1.5% x 5 less from abilities'); near(hitOn(L,v,1000,{src:F[0],auto:true}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0],auto:true})),'not from basic attacks');
  v.hp=v.maxHp*0.6; const g=-lost(v,()=>V.heal(v,1000)); v.hp=v.maxHp*0.4; near(-lost(v,()=>V.heal(v,1000)),g*1.09,'Trench Grit: below 50% HP he receives 3% x 3 more healing');
});

/* ============================== FERROW CROSSING ============================== */
test('Carn / Holding: Hold the Crossing, Narrow Bridge, Mud and Iron, Held for Six Hours, Ferrow Stone, Six Hours Standing, Corpse Count',()=>{
  const L=lab(H,S(['fc_1_1','fc_2_1','fc_3_3','fc_12_1','fc_11_1','fc_4_1','fc_8_1']),{foes:6,big:true}), {v,F}=L; ring(L,2,6); V.step(2);
  const a0=v.armorRating, m0=v.maxHp, i0=v.atkInterval, d0=v.dmg; assert.ok(!L.T.s.hold,'2 enemies within 3 m: not Holding'); assert.ok(!v.immovable,'');
  ring(L,4,6); V.step(2); assert.ok(L.T.s.hold,'4: Holding'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.05*2),'Hold the Crossing: 1% x 5 less for each enemy beyond the second');
  near(v.armorRating,a0*1.15,'Mud and Iron: 3% x 5 armor'); near(v.maxHp,m0*1.06,'Held for Six Hours: 2% x 3 max HP'); near(v.atkInterval,i0/1.06,'Narrow Bridge: 2% x 3 attack speed'); assert.ok(v.immovable,'Ferrow Stone: he cannot be moved');
  ring(L,6,6); V.step(2); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.05*3),'6 enemies: counted up to 5');
  v.hp=v.maxHp*0.5; const h0=v.hp; clk(L,'fc_4_1#0'); secs(1.02); near(v.hp-h0,v.maxHp*0.01,'Six Hours Standing: 0.2% x 5 of his max HP a second',1e-3);
  kill(L,F[5]); V.step(1); near(v.dmg,d0*1.025,'Corpse Count: an enemy died while he was Holding: 0.5% x 5 attack');
  ring(L,0,6); V.step(2); assert.ok(!L.T.s.hold,'nobody near: not Holding'); near(v.armorRating,a0,'given back'); near(v.maxHp,m0,''); assert.ok(!v.immovable,'');
  kill(L,F[4]); V.step(1); near(v.dmg,d0*1.025,'a death while not Holding: nothing'); V.wave(); V.step(1); near(v.dmg,d0,'Corpse Count is the wave\'s');
});

test('Carn / Shoulder to Shoulder (allies within 4 m take 2% x 3 less while he Holds) and One for the Crossing (LINK: each Dose counts as an enemy, with 2 real)',()=>{
  { const L=lab(H,S(['fc_6_1']),{foes:4,allies:1,big:true}), {v,F,A}=L; ring(L,3,6); at(L,A[0],2.75,-4.76); V.step(2);
    near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]}))*0.94,'an ally 1.75 m from him'); ring(L,2,6); V.step(2); near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]})),'not while he is not Holding'); }
  const L=lab(H,S(['fc_1_1','bt_n1','bt_1_1']),{foes:4,big:true}), {v}=L; ring(L,2,6); doseCast(L); V.step(2);
  assert.ok(L.T.s.hold,'2 enemies + 1 Dose: Holding'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.05),'and it counts as the third');
  ring(L,1,6); doseCast(L); V.step(2); assert.ok(!L.T.s.hold,'1 enemy + 2 Doses: not (at least 2 real enemies)');
  const M=lab(H,S(['bt_n1','bt_1_1','fc_2_1']),{foes:4,big:true}); ring(M,2,6); doseCast(M); V.step(2); assert.ok(!M.T.s.hold,'without Hold the Crossing the Doses do not count');
});

test('Carn / Nobody Passes and Red Water: an enemy walking past him while he Holds is slowed 30%; one bleeding and walking away 4% x 3 slower',()=>{
  const L=lab(H,S(['fc_3_1','fc_1_1','fc_1_4']),{foes:5,allies:1,big:true}), {v,F,A}=L; ring(L,3,6); at(L,A[0],0,-30); V.step(2); assert.ok(L.T.s.hold);
  const f=F[0]; f.stunned=0; f.speed=100; f.forcedTarget=A[0]; f.forcedTargetT=99; V.step(3); assert.ok(f.slow>0&&Math.abs(f.slowMul-0.7)<1e-9,'Nobody Passes: walking past him to another target: slowed 30%');
  const g=F[1]; g.stunned=0; g.speed=100; g.forcedTarget=v; g.forcedTargetT=99; V.step(3); assert.ok(!(g.slow>0),'not one coming at him');
  const b=F[2]; at(L,b,0,-10); b.stunned=0; b.speed=100; b.forcedTarget=A[0]; b.forcedTargetT=99; bleed(L,b,'reap',1,9); V.step(3); assert.ok(mark(L,b,'rc'),'his bleed: the Red Current');
  assert.ok(mark(L,b,'rcA'),'walking away from him'); const e=L.T.s.au.find(x=>x.x===b); near(e&&e.ap.move,0.88,'Red Water: 4% x 3 slower');
  b.forcedTarget=v; b.forcedTargetT=99; V.step(3); assert.ok(!mark(L,b,'rcA'),'coming back toward him: not slowed'); V.step(1); const e2=L.T.s.au.find(x=>x.x===b); assert.ok(!e2||!e2.ap.move||e2.ap.move===1,'given back');
});

test('Carn / the Red Current: Drag of the Current, Flood Bank, Current Runs Red, Riverbank, Bled Weak, Dark Water',()=>{
  const L=lab(H,S(['fc_2_4','fc_12_4','fc_6_4','fc_5_4','fc_n1','fc_10_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; const i0=F[0].atkInterval; const d=bleed(L,F[0],'reap',100,30); V.step(2);
  assert.ok(mark(L,F[0],'rc'),'bleeding from him: in the Red Current'); assert.ok(!mark(L,F[1],'rc'),'');
  near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]}))*0.94,'Drag of the Current: it deals 2% x 3 less to his allies'); near(hitOn(L,A[0],1000,{src:F[1]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[1]})),'not another enemy');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.06,'Flood Bank: it takes 2% x 3 more from his allies'); near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0])),'not from him');
  near(F[0].atkInterval,i0/(1-0.06),'Current Runs Red: 3% x 2 slower attacks'); near(tickRatio(L,F[0],d),1.09,'Riverbank: his bleeds tick 3% x 3 harder on it');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*(1-0.075),'Bled Weak: a bleeding enemy deals 1.5% x 5 less to him'); near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'');
  F[0].dots.length=0; secs(2-0.2); assert.ok(mark(L,F[0],'rc'),'Dark Water: still in it 0.4 x 5 s after the bleed'); secs(0.4); assert.ok(!mark(L,F[0],'rc'),'then out'); V.step(2); near(F[0].atkInterval,i0,'given back');
});

test('Carn / his bleeds: Shallows, Hold Fast the Line, Long Bleed, Burst Deep (PICK ONE), Deep Veins',()=>{
  const L=lab(H,S(['fc_11_4','fc_9_3','fc_4_3','fc_5_3','fc_7_3']),{foes:5,big:true}), {v,F}=L; noDef(L);
  const d=bleed(L,F[1],'reap',100,30); v.hp=v.maxHp; near(tickRatio(L,F[1],d),1,'full HP, not Holding: plain'); v.hp=v.maxHp*0.49; near(tickRatio(L,F[1],d),1.10,'Shallows: below 50% HP 2% x 5 harder');
  v.hp=v.maxHp; ring(L,3,6); V.step(2); assert.ok(L.T.s.hold); near(tickRatio(L,F[1],d),1.15,'Hold Fast the Line: while Holding 3% x 5 more');
  ring(L,0,6); V.step(2); F[0].dots.length=0; at(L,F[0],4.5,0); V.cast(v,'ult',F[0]); const r=mine(L,F[0],'reap')[0]; assert.equal(r.remaining,6,'Long Bleed: Crimson Reap\'s bleed 4 + 0.5 x 3 s (6 ticks, the last a half)'); near(r._talF,0.5,'');
  V.cast(v,'blue',F[0]); const b=mine(L,F[0],'vein')[0]; assert.ok(b,'Vein Burst reaches F0 (a Vein Burst talent)'); assert.equal(b.remaining,6,'Burst Deep: its bleed 3 + 3 s'); near(tickRatio(L,F[0],b),2,'and twice as strong');
  v.hp=v.maxHp*0.6; const h0=v.hp, l=tickLoss(L,F[0],b); near(v.hp-h0,l*0.15,'Deep Veins: he heals 3% x 5 of the bleed damage Vein Burst deals',1e-6);
});

test('Carn / Vein Burst: Blood Price, Pulled Under, Spray, Dosed Blade, Seep, Burst Wide (PICK ONE)',()=>{
  const L=lab(H,S(['pr_10_3','fc_4_4','fc_6_2','bt_10_2','fc_10_3']),{foes:3,big:true}), {v,F}=L; noDef(L);
  near(skillRatio(L,F[1],'bloodnova'),1.12*1.15,'Blood Price 4% x 3, Spray 3% x 5'); bleed(L,F[1],'reap',1,30); V.step(2); near(skillRatio(L,F[1],'bloodnova'),1.12*1.15*1.09,'Pulled Under: in the Red Current 3% x 3 more');
  L.T.s.ds=[1e9,1e9]; L.T.s.k.dose={n:2,t:0,idle:0}; near(skillRatio(L,F[2],'bloodnova'),1.12*1.15*(1+0.09*2),'Dosed Blade: 3% x 3 more per Dose');
  V.cast(v,'blue',F[0]); const b=mine(L,F[0],'vein')[0]; assert.equal(stack(L,'dose'),3,'(the cast gave a third Dose)'); V.step(1); near(tickRatio(L,F[0],b),1.12*1.15*(1+0.09*3)*1.09,'the bleed too (3 Doses; F0 is in the Red Current now: Pulled Under)'); near(FX.cd(v,'blue',9),9-0.9,'Seep: 0.3 x 3 s shorter');
  near(myHit(L,F[2]),plainHit(L,()=>myHit(L,F[2])),'(not his other hits)');
  const W=lab(H,S(['fc_5_2']),{foes:5,big:true}); at(W,W.F[3],0,5.8); const g=W.F.map(f=>f.hp); V.cast(W.v,'blue',W.F[0]); assert.ok(W.F[3].hp<g[3],'Burst Wide: 2.8 x 1.4 m reaches F3 3.79 m away'); near(g[4]-W.F[4].hp,0,'not F4 (6.13 m)');
  const N=lab(H,S(['pr_10_3']),{foes:5,big:true}); at(N,N.F[3],0,5.8); const g2=N.F.map(f=>f.hp); V.cast(N.v,'blue',N.F[0]); near(g2[3]-N.F[3].hp,0,'(without it, not)');
});

test('Carn / Crimson Reap: Wide Reap, Fast Reap, The Long Pull, Gathered In',()=>{
  let base=0; plain({foes:3,big:true},P=>{ noDef(P); at(P,P.F[1],6.2,-4.5); const h=P.F.map(f=>f.hp); V.cast(P.v,'ult',P.F[0]); base=(h[0]-P.F[0].hp)+(h[1]-P.F[1].hp); });
  const L=lab(H,S(['fc_3_2','bt_4_3','fc_7_2','fc_9_2']),{foes:3,big:true}), {v,F}=L; noDef(L); at(L,F[1],6.2,-4.5);
  const h=F.map(f=>f.hp); V.cast(v,'ult',F[0]); near((h[0]-F[0].hp)+(h[1]-F[1].hp),base*1.15*1.12*(1+0.03*2),'Wide Reap 3% x 5, Fast Reap 4% x 3, Gathered In 0.6% x 5 for each of the 2 enemies struck',1e-6);
  near(h[2]-F[2].hp,0,'(F2 out of reach)'); assert.ok(F[0].pulledBy&&Math.abs(F[0].pulledBy.x-v.x)<1e-6,'The Long Pull: pulled toward him'); near(F[0].pullSpeed,1.5*V.METER/0.3,'1.5 m over 0.3 s');
  V.step(1); assert.ok(mark(L,F[0],'rc')&&mark(L,F[1],'rc'),'and caught in the Red Current'); near(skillRatio(L,F[0],'cleave'),1.15*1.12,'their hit (Gathered In is added after the cast)');
  const r=mine(L,F[0],'reap')[0]; near(tickRatio(L,F[0],r),1.15*1.12,'and Crimson Reap\'s bleed');
});

test('Carn / Drowned and Scarred Ground',()=>{
  const L=lab(H,S(['fc_9_4','fc_10_1']),{foes:4,big:true}), {v,F}=L; at(L,F[1],4.5,4.5); at(L,F[2],0,10.5); bleed(L,F[0],'reap',1,30); V.step(2);
  F[0].hp=F[0].maxHp*0.5; const g=-lost(F[0],()=>V.heal(F[0],1000)), g0=plainHit(L,()=>-lost(F[0],()=>V.heal(F[0],1000))); near(g,g0*0.90,'Scarred Ground: an enemy within 3 m receives 2% x 5 less healing');
  F[2].hp=F[2].maxHp*0.5; near(-lost(F[2],()=>V.heal(F[2],1000)),plainHit(L,()=>-lost(F[2],()=>V.heal(F[2],1000))),'not one far away');
  kill(L,F[0]); const dr=mine(L,F[1],'drown'); assert.equal(dr.length,1,'Drowned: an enemy in the Red Current died: one within 2 m of it bleeds'); near(dr[0].dps,v.dmg*0.15,'15% of his attack a second'); assert.equal(dr[0].remaining,3,'for 3 s');
  assert.equal(mine(L,F[2]).length,0,'not one far away'); V.step(1); assert.ok(mark(L,F[1],'rc'),'and is caught in the Red Current');
  kill(L,F[3]); assert.equal(mine(L,F[2],'drown').length,0,'an enemy not in the Red Current dies (F2 0.48 m from it): nothing');
});

test('Carn / bleeding enemies: Bleeding Line, Reaping Line; The Crossing Holds (SIGNATURE)',()=>{
  const L=lab(H,S(['fc_11_2','fc_12_2','fc_13_2','fc_1_1']),{foes:6,big:true}), {v,F}=L; noDef(L); ring(L,4,6); const i0=v.atkInterval;
  for(let i=0;i<4;i++) bleed(L,F[i],'vein',1,30); V.step(2); near(v.atkInterval,i0/(1+0.03*4),'Bleeding Line: 0.6% x 5 attack speed for each bleeding enemy within 4 m');
  near(myHit(L,F[5]),plainHit(L,()=>myHit(L,F[5])),'4 bleeding: no Reaping Line'); assert.ok(!win(L,'xh'),'and no signature');
  bleed(L,F[5],'vein',1,30); V.step(2); near(v.atkInterval,i0/(1+0.03*4),'(F5 bleeds, but far away: still 4)'); near(myHit(L,F[4]),plainHit(L,()=>myHit(L,F[4]))*1.10,'Reaping Line: 5 enemies bleeding from him: his hits 2% x 5 more'); assert.ok(!win(L,'xh'),'F5 is far away: not 5 near');
  at(L,F[4],4.24,4.24); const h=F.map(f=>f.hp); bleed(L,F[4],'vein',1,30); V.step(1); assert.ok(win(L,'xh'),'5 bleeding enemies within 6.5 m: he draws the blade across them'); const t0=V.now();
  for(let i=0;i<5;i++){ assert.ok(F[i].hp<h[i],'Crimson Reap strikes all around him: F'+i); assert.ok(F[i].pulledBy,'pulled to him'); assert.ok(mark(L,F[i],'xbl'),'bleeding twice as hard'); assert.ok(mine(L,F[i],'reap').length===1,'its bleed, his'); }
  near(h[5]-F[5].hp,0,'not F5'); const x=mine(L,F[1],'vein')[0]; near(tickRatio(L,F[1],x),2,'his bleeds on them tick twice as hard');
  ring(L,0,6); V.step(2); assert.ok(L.T.s.hold,'he counts as Holding for 5 s however many stand near'); secs(5); assert.ok(!L.T.s.hold,'then not'); assert.ok(!mark(L,F[1],'xbl'),'');
  ring(L,5,6); V.step(2); assert.ok(!win(L,'xh'),'once every 25 s'); secs(t0+24.5-V.now()); assert.ok(!win(L,'xh'),'(24.5 s: not yet)'); secs(0.7); assert.ok(win(L,'xh'),'again');
});

/* ============================== THE BOTTLE ============================== */
test('Carn / Pace: Can\'t Stop, Quick Hands, Blood Up, Trench Run, Gone Before Noon, Never Pause, Quick Feet, Chain of Blows',()=>{
  const L=lab(H,S(['bt_1_4','bt_1_3','bt_4_4','bt_3_4','bt_10_4','bt_5_4','bt_12_4','bt_11_2']),{foes:3,big:true}), {v,F}=L; still(v); v.speed=100; V.step(1);
  const s0=v.speed, i0=v.atkInterval, d0=v.dmg, c0=v.glyphCrit;
  for(let i=0;i<4;i++) auto(L); V.step(1); assert.equal(stack(L,'pace'),4,'each basic attack he lands: 1 Pace');
  near(v.speed,s0*(1+0.015*4),'Can\'t Stop: 0.5% x 3 move speed per Pace'); near(v.atkInterval,i0/(1+0.009*4),'and 0.3% x 3 attack speed'); near(v.dmg,d0*(1+0.006*4),'Blood Up: 0.2% x 3 attack per Pace');
  near(v.glyphCrit,c0+0.05,'Quick Hands: any Pace, 1% x 5 critical chance'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.01*4),'Trench Run: 0.2% x 5 less per Pace');
  auto(L,F[0],{crit:true}); assert.equal(stack(L,'pace'),8,'Quick Feet: a critical one adds 1 + 1 x 3');
  auto(L); auto(L); V.step(1); assert.equal(stack(L,'pace'),10,'max 10'); near(v.glyphCrit,c0+0.05+0.05,'Gone Before Noon: at 10 Pace 1% x 5 more'); near(v.dmg,d0*(1+0.06+0.05),'Chain of Blows: reaching 10, 1% x 5 attack');
  secs(2.5+3-0.2); assert.equal(stack(L,'pace'),10,'Never Pause: it waits 2.5 + 1 x 3 s'); secs(1.3); assert.equal(stack(L,'pace'),8,'then drops 2 a second');
  auto(L); auto(L); assert.equal(stack(L,'pace'),10,''); V.step(1); near(v.dmg,d0*(1+0.06+0.10),'reaching 10 again: twice');
  v.stunned=0.5; V.step(1); assert.equal(stack(L,'pace'),0,'a stun on him clears it'); v.stunned=0; auto(L); assert.equal(stack(L,'pace'),1,''); v.fearT=0.5; V.step(1); assert.equal(stack(L,'pace'),0,'and a fear'); v.fearT=0;
  V.wave(); V.step(1); near(v.dmg,d0,'Chain of Blows is the wave\'s');
});

test('Carn / Keep Moving and Shakes It Off: controls on him shorter, together at most 30%',()=>{
  const L=lab(H,S(['bt_2_4','bt_1_4']),{foes:3,big:true}), {v,F}=L; still(v);
  ccOn(F[0],v,'silencedT',1); near(v.silencedT,V.ccNerf,'below 10 Pace: as before',1e-9); v.silencedT=0; for(let i=0;i<10;i++) auto(L); ccOn(F[0],v,'silencedT',1); near(v.silencedT,V.ccNerf*0.85,'Keep Moving: at 10 Pace 5% x 3 shorter',1e-9); v.silencedT=0;
  const M=lab(H,S(['bt_5_1']),{foes:3,big:true}); still(M.v); ccOn(M.F[0],M.v,'silencedT',1); near(M.v.silencedT,V.ccNerf*0.80,'Shakes It Off: 4% x 5 shorter',1e-9);
  const N=lab(H,S(['bt_5_1','bt_2_4','bt_1_4']),{foes:3,big:true}); still(N.v); for(let i=0;i<10;i++) auto(N); ccOn(N.F[0],N.v,'silencedT',1); near(N.v.silencedT,V.ccNerf*0.70,'both: 0.80 x 0.85 = 32% is cut at 30%',1e-9);
});

test('Carn / Follow Through, No Breath Between, Swing Through',()=>{
  { const L=lab(H,S(['bt_7_4','bt_9_4']),{foes:3,big:true}), {v,F}=L; noDef(L); still(v);
    v.atkCd=5; V.cast(v,'green',F[0]); assert.equal(stack(L,'pace'),3,'Follow Through: the Blow adds 3 Pace'); near(v.atkCd,0,'and his next basic attack comes at once');
    const a=myHit(L,F[2],{auto:true}), b=myHit(L,F[2],{auto:true}); near(a,b*1.25,'No Breath Between: that basic attack 5% x 5 more, the next one not'); }
  const L=lab(H,S(['bt_7_1']),{foes:3,big:true}), {F}=L; noDef(L); at(L,F[1],4.5,4.4);
  const f1=F[1].hp; myHit(L,F[0],{auto:true}); myHit(L,F[0],{auto:true}); myHit(L,F[0]); near(f1-F[1].hp,0,'Swing Through: not the 1st or 2nd basic attack (a skill hit does not count)');
  const h3=myHit(L,F[0],{auto:true}); near(f1-F[1].hp,h3*0.5,'every 3rd also strikes the enemy beside the target (0.38 m from it) for 10% x 5 of it'); near(F[2].maxHp-F[2].hp,0,'not one far away');
});

test('Carn / Doses: Trench Bottle, Strong Brew, Shaking Hands, Iron Stomach, Last Swallow, Stimulant, Running Hot, Bad Bottle',()=>{
  const L=lab(H,S(['bt_1_1','bt_2_1','bt_6_1','bt_4_1','bt_10_1','bt_11_3','bt_9_2','bt_12_3']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e5; v.hp=9e4;
  const i0=v.atkInterval, d0=v.dmg, ls=v.lifestealStat||0; doseCast(L); secs(1); doseCast(L); doseCast(L); doseCast(L); V.step(1); assert.equal(stack(L,'dose'),3,'a Dose for each ability (max 3)');
  near(v.atkInterval,i0/1.30,'Trench Bottle: 2% x 5 attack speed per Dose'); near(v.dmg,d0*1.09,'Strong Brew: 1% x 3 attack per Dose'); near(v.lifestealStat-ls,0.09,'Shaking Hands: 1% x 3 lifesteal per Dose');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.01*3),'Bad Bottle: 0.5% x 2 less per Dose'); near(myHit(L,F[1]),plainHit(L,()=>myHit(L,F[1]))*1.10,'Running Hot: 3 Doses, his hits 2% x 5 more');
  const e=L.T.s.au.find(x=>x.x===v); near(e&&e.ap.cdRate,0.05,'Stimulant: his cooldowns 1% x 5 faster');
  v.hp=9e4; const h=v.hp; secs(1); near(h-v.hp,1e5*(0.003-0.002)*3,'Iron Stomach: each Dose costs 0.3% - 0.04% x 5 of his max HP a second',2e-2);
});

test('Carn / Doses run out on their own clocks; Second Bottle, Drink Deep, Sip Slowly, Slow Burn, Red Morning, Bottle Kept',()=>{
  { const L=lab(H,S(['bt_1_1','bt_10_1']),{foes:3,big:true}), {v}=L; v.maxHp=1e5; v.hp=5e4; doseCast(L); secs(2); doseCast(L); V.step(1); assert.equal(stack(L,'dose'),2,'');
    secs(4-0.1); assert.equal(stack(L,'dose'),2,'the first one lasts 6 s'); const h=v.hp; secs(0.2); assert.equal(stack(L,'dose'),1,'then runs out alone'); near(v.hp-h,1e5*0.05-1e5*0.003*2*0.2,'Last Swallow: 1% x 5 as it runs out',2e-2);
    secs(2); assert.equal(stack(L,'dose'),0,'the second 2 s later');
    for(let i=0;i<4;i++) doseCast(L); V.step(1); assert.equal(stack(L,'dose'),3,'a fourth renews the oldest'); v.hp=10; secs(2); near(v.hp,1,'their cost never takes him below 1 HP'); }
  { const L=lab(H,S(['bt_1_1','bt_3_1','bt_5_2']),{foes:3,big:true}), {v}=L; v.maxHp=1e5; const i0=v.atkInterval; for(let i=0;i<4;i++) doseCast(L); V.step(1); assert.equal(stack(L,'dose'),4,'Second Bottle: up to 4');
    near(v.atkInterval,i0/(1+0.2*4),'Drink Deep: each Dose twice the attack speed'); v.hp=9e4; const h=v.hp; secs(1); near(h-v.hp,1e5*0.006*3,'twice the cost, and the fourth costs none',2e-2); }
  { const L=lab(H,S(['bt_1_1','bt_5_3','bt_7_3']),{foes:3,big:true}), {v}=L; v.maxHp=1e5; v.hp=9e4; doseCast(L); doseCast(L); V.step(1);
    const h=v.hp; secs(1); near(v.hp,h,'Sip Slowly: no cost above 50% HP'); v.hp=4e4; const g=v.hp; secs(1); near(g-v.hp,1e5*0.003*2,'below it, as before',2e-2);
    near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.05*2),'Slow Burn: 1% x 5 less per Dose'); secs(12-2-0.3); assert.equal(stack(L,'dose'),2,'they last 12 s'); secs(0.5); assert.equal(stack(L,'dose'),0,''); }
  { const L=lab(H,S(['bt_1_1','bt_12_1']),{foes:3,big:true}); assert.equal(stack(L,'dose'),3,'Red Morning: each wave starts with 1 x 3 Doses'); secs(3); V.wave(); V.step(1); assert.equal(stack(L,'dose'),3,'a new wave: 3 new ones');
    secs(6.1); assert.equal(stack(L,'dose'),0,''); doseCast(L); V.wave(); V.step(1); assert.equal(stack(L,'dose'),3,'(not kept: a fresh 3)'); }
  { const L=lab(H,S(['bt_1_1','bt_11_1']),{foes:3,big:true}); doseCast(L); secs(2); doseCast(L); V.step(1); V.wave(); V.step(1); assert.equal(stack(L,'dose'),2,'Bottle Kept: kept between waves');
    secs(4-0.2); assert.equal(stack(L,'dose'),2,'with the time they had left'); secs(0.4); assert.equal(stack(L,'dose'),1,''); }
  { const L=lab(H,S(['bt_1_1']),{foes:3,big:true}); doseCast(L); V.wave(); V.step(1); assert.equal(stack(L,'dose'),0,'without it, gone at a new wave'); }
});

test('Carn / Unrelenting Edge, Ground Eater, Blooded Steel, Bottle Rage, Unwilling to Stop',()=>{
  let i0=0, s0=0; plain({foes:3,big:true},P=>{ i0=P.v.atkInterval; s0=P.v.speed; });
  const Q=lab(H,S(['bt_2_2','bt_6_4']),{foes:3,big:true}); near(Q.v.atkInterval,i0/1.05,'Unrelenting Edge: 1% x 5 attack speed'); near(Q.v.speed,s0*1.06,'Ground Eater: 3% x 2 faster');
  const R=lab(H,S(['fc_7_1','bt_6_2','bt_12_2','bt_1_1','bt_1_4']),{foes:3,big:true}); still(R.v); noDef(R);
  near(myHit(R,R.F[1],{auto:true}),plainHit(R,()=>myHit(R,R.F[1],{auto:true}))*1.10*1.10,'Blooded Steel 2% x 5 and Bottle Rage 2% x 5 on his basic attacks'); near(myHit(R,R.F[1]),plainHit(R,()=>myHit(R,R.F[1])),'not his other hits');
  for(let i=0;i<10;i++) auto(R,R.F[0]); near(myHit(R,R.F[1]),plainHit(R,()=>myHit(R,R.F[1])),'10 Pace but no Dose: no Unwilling to Stop'); doseCast(R);
  near(myHit(R,R.F[1]),plainHit(R,()=>myHit(R,R.F[1]))*1.10,'Unwilling to Stop: 10 Pace and a Dose, 2% x 5 more');
});

test('Carn / Fast and Unwilling (SIGNATURE): 10 Pace with 3 Doses: 6 s unstoppable, Unrelenting doubled, Doses refreshed and free; once every 25 s',()=>{
  const L=lab(H,S(['bt_13_2','bt_1_1','bt_1_4']),{foes:3,big:true}), {v,F}=L; still(v); v.maxHp=1e5; v.hp=9e4; for(let i=0;i<3;i++) doseCast(L); V.step(1);
  const i0=v.atkInterval, pm=v.passMul; for(let i=0;i<9;i++) auto(L); assert.ok(!win(L,'fu'),'9 Pace: not yet'); auto(L); assert.ok(win(L,'fu'),'10 Pace with 3 Doses: the bottle takes him'); const t0=V.now();
  V.step(1); const x=0.25*pm/(1+0.25*pm); near(v.atkInterval,i0*1.3/(1.3+0.09+x),'Unrelenting\'s attack speed doubled (3 Doses 30%, 10 Pace 9%, and Unrelenting\'s again)',1e-6);
  assert.ok(v.stunImmune,'the game\'s Unstoppable'); ccOn(F[0],v,'stunned',1); V.step(1); near(v.stunned,0,'a stun does not hold him'); assert.equal(stack(L,'pace'),10,'nor clear his Pace');
  v.fearT=2; V.step(1); near(v.fearT,0,'no fear');
  const h=v.hp; secs(1); near(v.hp,h,'Doses cost no HP'); secs(4.5); auto(L); secs(0.7); assert.ok(!win(L,'fu')&&!v.stunImmune,'6 s, then over');
  assert.equal(stack(L,'dose'),3,'a basic attack refreshed his Doses (without it they would have run out with the window)'); const g=v.hp; secs(1); assert.ok(v.hp<g,'Doses cost HP again');
  secs(t0+24.4-V.now()); for(let i=0;i<3;i++) doseCast(L); setStack(L,'pace',9); auto(L); assert.ok(!win(L,'fu'),'once every 25 s (24.4 s: not yet)'); secs(0.7); setStack(L,'pace',9); auto(L); assert.ok(win(L,'fu'),'25 s: again');
});

test('Carn / One for the Crossing (LINK, its own half): with 3 Doses Pace drops 1 a second instead of 2',()=>{
  const L=lab(H,S(['bt_n1','bt_1_4','bt_1_1']),{foes:3,big:true}), {v}=L; still(v); for(let i=0;i<10;i++) auto(L); for(let i=0;i<3;i++) doseCast(L);
  secs(2.5+1.05); assert.equal(stack(L,'pace'),9,'1 a second'); L.T.s.ds.length=2; L.T.s.k.dose.n=2; secs(1); assert.equal(stack(L,'pace'),7,'with 2 Doses: 2 a second');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Carn: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['pr_1_1','pr_1_4','pr_2_2','pr_9_2','fc_1_1','fc_1_4','fc_4_3','fc_5_2','fc_11_2','bt_1_1','bt_1_4','bt_7_4']), TEAM=['vael','sylthaine','vireo','vex','carn'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let rc=false, hold=false, tags={}, paid=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); if(T0.hold) hold=true; paid=Math.max(paid,T0.paid||0);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; for(const d of (f.dots||[])) if(d._talO===s.uid) tags[d._talK]=1; if(o&&o.rc) rc=true; } }
  assert.ok(paid>0,'real Reckless Blows wrote Paid Out: '+paid.toFixed(0)); assert.ok(mx.hour>=1,'real Hours: '+mx.hour); assert.ok(mx.pace>=3,'real basic attacks gave Pace: '+mx.pace); assert.ok(mx.dose>=1,'real casts gave Doses: '+mx.dose);
  assert.ok(tags.reap,'Crimson Reap\'s bleed his: '+Object.keys(tags)); assert.ok(tags.vein,'Vein Burst (body edge, Burst Wide) bled someone'); assert.ok(rc,'a real Red Current');
  console.log('  live fight: max '+JSON.stringify(mx)+', paid '+paid.toFixed(0)+', Holding '+hold+', tags '+Object.keys(tags).join(','));
  determinism(H,TEAM);
});

/* The page sites his talents added (the 'num' hook at Reckless Blow's cost and at Vein Burst's reach): with nothing learned, whole seeded fights with Carn
   in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Carn: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['carn','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __cnN={reck:0,nova:0,reap:0}; var __cnD=_doEffectCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="carn"&&(!o||!o.deliver||o._arrived)){ if(type==="reckless") __cnN.reck++; if(type==="bloodnova") __cnN.nova++; if(type==="cleave") __cnN.reap++; } return __cnD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__cnN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.reck>0&&c.nova>0&&c.reap>0,'the fights cast Reckless Blow ('+c.reck+'), Vein Burst ('+c.nova+') and Crimson Reap ('+c.reap+'): both new sites were run'); }
  finally{ VMX('_doEffectCore=__cnD;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage-reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ pr:['pr_4_1','pr_5_1','pr_7_3','pr_10_4','pr_1_4','pr_12_4','pr_2_3'],
            fc:['fc_1_1','fc_n1','fc_3_3','fc_12_1','fc_1_2','fc_11_1','fc_6_1','fc_4_1'],
            bt:['bt_3_4','bt_12_3','bt_7_3','bt_5_3','bt_3_1','bt_9_3','bt_3_3','bt_1_4','bt_n1','bt_1_1','bt_5_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={pr:0,fc:1,bt:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (5 enemies within 3 m, the attacker bleeding from him and in the Red Current,
   10 steps of Paid Out, every Hour, the cost draining, 10 Pace, every Dose; the hit an ability, not a basic attack), as a normal hit and as a critical one */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:5,cold:true}), {v,F}=L; V.step(1); ring(L,5,6); const f=F[0];
  if(L.T){ setPaid(L,10); L.T.s.k.hour={n:L.T.st.hour.max,t:0,idle:0}; L.T.s.w.drain={t:99,n:1,cdT:0,at:-1,wave:false}; L.T.s.dr={left:0,rate:0};
    L.T.s.k.pace={n:10,t:0,idle:0}; L.T.s.lastAtk=1e9; L.T.s.ds=[1e9,1e9,1e9,1e9].slice(0,L.T.st.dose.max===Infinity?3:L.T.st.dose.max); L.T.s.k.dose={n:L.T.s.ds.length,t:0,idle:0}; bleed(L,f,'reap',1,99); }
  still(v); V.step(2); v.maxHp=1e5; v.hp=3.5e4; v.shield=1e12; v.shieldT=999; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=v.blueCd=1e9;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Carn: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[[['fc','bt'],[61,30]],[['bt','fc'],[61,30]],[['fc','pr'],[61,30]],[['pr','fc'],[61,30]],[['bt','pr'],[61,30]],[['pr','bt'],[61,30]],[['fc'],[91]],[['bt'],[91]],[['pr'],[91]],[['fc','bt','pr'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="carn"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="carn"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','carn'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
