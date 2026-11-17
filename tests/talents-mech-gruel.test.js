'use strict';
/* Gruel's talents as data on the mechanics layer (talents-mech/gruel.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one action (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Gruel, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) ...; A0 (0,-5.5) A1 (0,-11). Every lab unit is held (stunned).
   COINFLAIL: today it measures its 3 m from his centre and hits nobody in real fights (bodies keep enemies 3.6 m+ away; SKILL REACH AUDIT 14NOV2026); release
   v1391 (another branch) measures to the enemy's body edge. These tests put the enemies it must hit 2.5 m from his centre, right before the cast: inside its
   reach both today and after that fix, so they test his talents on a Coinflail that lands.
   Run: node --test tests/talents-mech-gruel.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='gruel', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));
const mine=(L,t,amt,o)=>lost(t,()=>V.hit(L.v,t,amt||1000,Object.assign({kind:'true'},o||{})));
const debt=(L,x,secs0)=>{ x._debtTo=L.v; x._debtT=secs0||99; x._debtPct=0.35; x._talDb=0.35; };
const pans=(L,l,r)=>{ L.T.s.pan={L:l,R:r,t:0,side:l>r?'L':(r>l?'R':null)}; };
const cfAt=(L,t,dx,dy)=>at(L,t,dx==null?2.5:dx,dy||0);   // where Coinflail reaches (see the header)
const cast=(L,t)=>lost(t,()=>V.cast(L.v,'green',t));
const TDR=VMX('(l)=>tauntDrOf({},l)'), DEF=VMX('(s,t,k)=>defMul(s,t,k)');
const glutRate=v=>v.maxHp*0.04*(v.passMul||1);           // Gluttony a second, as the passive writes it
const gain=(v,s)=>{ const h=v.hp, n=Math.round(s/V.STEP); V.step(n); return (v.hp-h)/(n*V.STEP); };   // HP a second over that time
const atk=v=>v.dmg*((v.dmgBuffT>0)?(v.dmgBuffMul||1):1)*VMX('rageMul');
const noCrit=(v,fn)=>{ const g=v.glyphCrit; v.glyphCrit=0; try{ return fn(); } finally{ v.glyphCrit=g; } };

test('Gruel: every talent is accounted for - 10 plain stats, 111 with rows, none waiting',()=>{
  accounting(H,[121,10,111,0,0]);
  for(const id of ['le_1_1','bs_1_3','ap_1_1','le_13_2','bs_13_3','ap_13_2']) assert.ok(FXN.mech(H).talents[id],id);
  for(const id of ['ap_1_3','ap_3_3','ap_9_3','bs_2_2','bs_3_2','bs_7_2','bs_8_4','le_1_3','le_3_3','le_7_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Gruel: his real kit, as the talents read it - Coinflail, Weigh the Debt (the cut on hits on his allies only), The Reckoning, Gluttony',()=>{
  plain({foes:3,allies:1},P=>{ const {v,A,F}=P, a=A[0];
    assert.ok(v.pass&&v.pass.juggernaut,'his passive Gluttony');
    cfAt(P,F[0]); at(P,F[1],4.5,1); let h1=0; const h0=lost(F[0],()=>{ h1=lost(F[1],()=>V.cast(v,'green',F[0])); }); assert.ok(h0>0,'Coinflail strikes an enemy 2.5 m from his centre');
    console.log('  kit: Coinflail on an enemy 4.5 m from his centre (body edge about '+(4.5-V.bodyR(F[1])).toFixed(2)+' m): '+(h1>0?'struck':'not struck - its 3 m is measured from his centre today (release v1391 measures to the body edge)'));
    F[1].maxHp=2e9; F[1].hp=2e9; V.cast(v,'blue'); assert.equal(F[1]._debtTo,v,'Weigh the Debt marks the enemy with the highest MAX HP'); near(F[1]._debtPct,0.35); assert.ok(F[1]._debtT>5.9);
    v.hp=v.maxHp*0.5; const hv=v.hp; near(hitOn(P,a,1000,{src:F[1]}),650,'its hit on an ally loses the 35% cut'); near(v.hp,hv,'Gruel loses half the cut and heals half the cut: a wash for him',1e-9);
    near(hitOn(P,v,1000,{src:F[1]}),1000,'its hit on Gruel himself is not cut');
    V.cast(v,'ult'); near(v.drMul,1-TDR(10),'The Reckoning: 40% + 0.2 point a level in his skill slot (the card says "half damage")',1e-9); near(v.drT,4,'',1e-9);
    assert.equal(F[0].forcedTarget,v,'every enemy within 6 m taunted'); assert.notEqual(F[2].forcedTarget,v,'not one 15.5 m away');
    v.drT=0; v.hp=v.maxHp*0.3; near(gain(v,1),glutRate(v),'Gluttony: 4% of his max HP x his passive\'s strength a second',2e-2);
  });
});

/* ============================== THE LEDGER ============================== */
test('Gruel / Owed: Ledger Entry, Running Tab, Arrears; Coinflail collects - Itemised, Square Accounts, Collections',()=>{
  const L=lab(H,S(['le_1_1','le_2_1','le_11_1','le_4_1','le_3_1','le_8_1']),{foes:3,big:true}), {v,F}=L, f=F[0];
  for(let i=0;i<10;i++) V.hit(f,v,1,{kind:'true'}); assert.equal(ust(L,f,'owed'),8,'each hit on him: 1 Owed, up to 5 + 1 x 3');
  secs(12.8); assert.equal(ust(L,f,'owed'),8,'Arrears: they lapse 8 + 1 x 5 s after the last'); secs(0.4); assert.equal(ust(L,f,'owed'),0);
  for(let i=0;i<8;i++) V.hit(f,v,1,{kind:'true'}); cfAt(L,f); const p=plainHit(L,()=>cast(L,f));
  v.hp=v.maxHp*0.5; f.stunned=0; v.greenCd=5; const g=cast(L,f);
  near(g,p*(1+0.02*5*8),'Ledger Entry: 2% x 5 more for each Owed it collects'); assert.equal(ust(L,f,'owed'),0,'and clears them');
  near(v.hp,v.maxHp*(0.5+0.005*5*8),'Itemised: 0.5% x 5 of his max HP for each Owed collected',1e-9); near(f.stunned,0.8,'Square Accounts: 5 or more from one enemy: stunned 0.8 s',1e-9);
  near(v.greenCd,4.5,'Collections: an enemy owing 3 or more takes 0.1 s x 5 off its cooldown',1e-9);
  f.stunned=0; for(let i=0;i<4;i++) V.hit(f,v,1,{kind:'true'}); v.greenCd=5; cast(L,f); assert.equal(f.stunned,0,'4 Owed: no stun'); near(v.greenCd,4.5,'(4 owed: still 3 or more)',1e-9);
  for(let i=0;i<2;i++) V.hit(f,v,1,{kind:'true'}); v.greenCd=5; cast(L,f); near(v.greenCd,5,'2 Owed: no cooldown',1e-9);
});

test('Gruel / Coinflail: Heavy Flail, Even-Handed, Flail Grease, Bookkeeper (per enemy hit), Picky Eater; Wide Swing and Heavy Coins change its arc and reach',()=>{
  const L=lab(H,S(['le_2_3','bs_4_4','ap_4_3','le_12_1','ap_9_1']),{foes:3,big:true}), {v,F}=L; F[0].maxHp=2e9; F[0].hp=2e9; cfAt(L,F[0]); at(L,F[1],2,1.2); at(L,F[2],-6,0);
  const p0=plainHit(L,()=>cast(L,F[0])), p1=lost(F[1],()=>{}); assert.ok(p0>0);
  const P1=plainHit(L,()=>lost(F[1],()=>V.cast(v,'green',F[0]))); assert.ok(P1>0,'(the second enemy stands in the cone)');
  let b1=0; const b0=lost(F[0],()=>{ b1=lost(F[1],()=>V.cast(v,'green',F[0])); }); void p1;
  const k=1.12*1.15*1.12*(1+0.02*3*2); near(b0,p0*k*1.10,'4% x 3, 3% x 5, 4% x 3, Bookkeeper 2% x 3 for each of the 2 enemies hit, Picky Eater 2% x 5 on the highest max HP'); near(b1,P1*k,'the other enemy: no Picky Eater');
  const L2=lab(H,S(['le_4_3','bs_4_2']),{}), M=V.METER, o=FX.kit(L2.v,'cleavecone',{radius:3*M,angle:70,_arrived:true});
  near(o.angle,85,'Wide Swing: 5 degrees x 3 wider',1e-9); near(o.radius,3.6*M,'Heavy Coins: 0.2 m x 3 farther',1e-9);
  const L3=lab(H,S(['le_4_3']),{foes:2}), a=40*Math.PI/180; L3.F[0].x=L3.v.x+2.5*M*Math.cos(a); L3.F[0].y=L3.v.y+2.5*M*Math.sin(a); L3.F[1].x=L3.v.x+2.5*M; L3.F[1].y=L3.v.y;
  assert.equal(plainHit(L3,()=>lost(L3.F[0],()=>V.cast(L3.v,'green',L3.F[1]))),0,'an enemy 40 degrees off its line: outside the 70 degree arc');
  assert.ok(lost(L3.F[0],()=>V.cast(L3.v,'green',L3.F[1]))>0,'inside the 85 degree arc');
});

test('Gruel / Fee: Collector\'s Fee, Keep the Change, Fee Schedule, Opening Balance, Rainy Day, Ledger Weight; Profit and Licked Clean',()=>{
  const p=plain({},P=>P.v.dmg), L=lab(H,S(['le_1_4','le_3_4','le_5_4','le_6_4','le_12_4','le_7_4','le_10_4','ap_12_1']),{foes:2,allies:1,big:true}), {v,A,F}=L, a=A[0], d=F[1];
  assert.equal(stack(L,'fee'),6,'Opening Balance: 3 x 2 Fee at the wave\'s start'); d.maxHp=2e9; d.hp=2e9; V.cast(v,'blue'); assert.equal(d._debtTo,v);
  v.hp=v.maxHp*0.5; const h=v.hp; near(hitOn(L,a,1000,{src:d}),650); near(v.hp-h,350*0.5*(1.25*1.15-1),'Profit 5% x 5, Licked Clean 5% x 3: the COLLECTED heal larger (he still loses half the cut)',1e-6);
  const f1=stack(L,'fee'); assert.ok(f1===7||f1===8,'each COLLECTED pays 1 Fee (Fee Schedule: 10% x 5 to pay 2): '+f1);
  for(let i=0;i<5;i++) hitOn(L,a,1000,{src:d}); const f2=stack(L,'fee'); assert.ok(f2>f1+5&&f2<=f1+10,'Fee Schedule doubles some of them (the fight\'s seeded stream): '+f1+' -> '+f2);
  for(let i=0;i<20;i++) hitOn(L,a,1000,{src:d}); assert.equal(stack(L,'fee'),20,'max 20');
  V.step(1); near(v.dmg,p*(1+0.002*3*20),'Collector\'s Fee: 0.2% x 3 attack per Fee');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.20),'Keep the Change: 0.2% x 5 damage reduction per Fee');
  near(mine(L,F[0],1000,{auto:true}),plainHit(L,()=>mine(L,F[0],1000,{auto:true}))*1.15,'Ledger Weight: at 20 Fee his basic attacks 3% x 5 more'); setStack(L,'fee',19);
  near(mine(L,F[0],1000,{auto:true}),plainHit(L,()=>mine(L,F[0],1000,{auto:true})),'not at 19'); setStack(L,'fee',20);
  V.wave(); V.step(1); assert.equal(stack(L,'fee'),12,'Rainy Day: 2 x 3 kept between waves, then Opening Balance adds its 6');
});

test('Gruel / Call It In: at 20 Fee the next Coinflail spends 10 and puts every enemy it hits In Debt for 3 s',()=>{
  const L=lab(H,S(['le_9_4','le_1_4']),{foes:2,big:true}), {v,F}=L; setStack(L,'fee',20); cfAt(L,F[0]); cast(L,F[0]);
  assert.equal(stack(L,'fee'),10,'10 Fee spent'); assert.equal(F[0]._debtTo,v,'In Debt'); near(F[0]._debtT,3,'for 3 s',1e-9); near(F[0]._debtPct,0.35,'at the skill\'s own cut');
  cfAt(L,F[1],2.5,0.5); cast(L,F[1]); assert.notEqual(F[1]._debtTo,v,'at 10 Fee: not again'); assert.equal(stack(L,'fee'),10);
});

test('Gruel / Interest: Interest, Compound, Usury, Tally; the debt\'s end clears it',()=>{
  const L=lab(H,S(['le_2_2','le_4_2','le_9_2','le_10_1','le_1_1']),{foes:2,allies:1,big:true}), {v,A,F}=L, d=F[1]; d.maxHp=2e9; d.hp=2e9; const a0=d.dmg, r0=d.armorRating;
  for(let i=0;i<3;i++) V.hit(d,v,1,{kind:'true'}); V.cast(v,'blue'); assert.equal(d._debtTo,v);
  secs(2.1); assert.equal(ust(L,d,'int'),3,'1 Interest a second, Compound 15% x 3 faster: 2.1 s x 1.45 = 3'); near(d._debtPct,0.35*(1+0.05*3),'Interest: the cut 1% x 5 larger per Interest');
  near(hitOn(L,A[0],1000,{src:d}),1000*(1-0.35*1.15),'(on its hits on his allies)');
  near(d.dmg,a0*(1-0.003*5*3),'Usury: its attack 0.3% x 5 lower per Interest'); near(d.armorRating,r0*(1-0.003*5*3),'Tally: 0.3% x 5 armor per Owed (3)');
  secs(2.2); assert.equal(ust(L,d,'int'),6,'max 6'); secs(2.2); assert.ok(!(d._debtT>0),'the debt has ended'); V.step(2); assert.equal(ust(L,d,'int'),0,'its Interest is gone'); near(d.dmg,a0,'and Usury with it');
});

test('Gruel / What Is Owed (SIGNATURE): at 6 Interest the debt is called in - damage per Owed and Interest, a 1.5 s stun, half healed; once every 20 s',()=>{
  const L=lab(H,S(['le_13_2','le_2_2','le_1_1']),{foes:2,big:true}), {v,F}=L, d=F[1]; for(let i=0;i<4;i++) V.hit(d,v,1,{kind:'true'}); debt(L,d,30); setUst(L,d,'int',5);
  L.T.s.ia={}; L.T.s.ia[d.uid]=0.99; v.hp=v.maxHp*0.5; const hv=v.hp, h=d.hp; d.stunned=0; const x=0.30*(4+6)*atk(v)*DEF(v,d,'phys'); V.step(1);
  near(h-d.hp,x,'each Owed and Interest worth 30% of his attack, through its armor',1e-6); assert.ok(d.stunned>1.4&&d.stunned<=1.5+1e-9,'stunned 1.5 s: '+d.stunned); near(v.hp-hv-glutRate(v)*V.STEP,x*0.5,'he heals half of it (beside one tick of Gluttony)',1e-3);
  assert.ok(!(d._debtT>0)&&d._debtTo!==v,'the debt is cleared'); assert.equal(ust(L,d,'owed'),0); assert.equal(ust(L,d,'int'),0);
  debt(L,d,30); setUst(L,d,'int',5); L.T.s.ia[d.uid]=0.99; const h2=d.hp; V.step(2); near(d.hp,h2,'once every 20 s',1e-9);
});

test('Gruel / Weigh the Debt: Two Ledgers, The Heaviest Pays, Long Debt, Prompt Notice, True Weight',()=>{
  const L=lab(H,S(['le_7_2','bs_7_4','le_10_2','le_n1','bs_6_4']),{foes:3,big:true}), {v,F}=L;
  F[0].maxHp=3e9; F[0].hp=1.5e9; F[1].maxHp=2e9; F[1].hp=1.8e9; const h2=F[2].hp, h1=F[1].hp; V.cast(v,'blue');
  assert.equal(F[2]._debtTo,v,'The Heaviest Pays: the highest HP share (100%), not the highest max HP'); assert.ok(F[2].hp<h2,'struck');
  assert.equal(F[1]._debtTo,v,'Two Ledgers: the next one (90%) In Debt too'); near(F[1].hp,h1,'not struck',1e-12); assert.notEqual(F[0]._debtTo,v);
  near(F[2]._debtPct,0.35*0.75); near(F[1]._debtPct,0.35*0.75,'each at three quarters of the cut'); near(F[2]._debtT,6+1.5,'Long Debt: 0.5 s x 3 longer',1e-9); near(F[1]._debtT,7.5,'',1e-9);
  near(FX.cd(v,'blue',10),8.5,'Prompt Notice: 0.3 s x 5 shorter',1e-9);
  const p=plain({foes:2},P=>{ P.F[1].maxHp=2e9; P.F[1].hp=2e9; return lost(P.F[1],()=>V.cast(P.v,'blue')); }), L2=lab(H,S(['bs_6_4']),{foes:2}); L2.F[1].maxHp=2e9; L2.F[1].hp=2e9;
  near(lost(L2.F[1],()=>V.cast(L2.v,'blue')),p*1.15,'True Weight: 5% x 3 more damage');
});

test('Gruel / the enemy In Debt: Bad Creditor, Exact Change, Hard Bargain, Late Payment, Brass Hide',()=>{
  const r0=plain({},P=>P.v.armorRating), L=lab(H,S(['le_6_2','bs_10_4','le_11_3','le_6_1','le_8_3']),{foes:2,big:true}), {v,F}=L, d=F[1], f=F[0];
  near(v.armorRating,r0,'(no enemy In Debt)'); debt(L,d); V.step(1); near(v.armorRating,r0*1.10,'Brass Hide: 2% x 5 armor while one is');
  v.hp=v.maxHp*0.5; near(mine(L,d),plainHit(L,()=>mine(L,d))*1.075*1.10,'Bad Creditor 1.5% x 5; Exact Change 2% x 5 while its HP share is above his');
  d.hp=d.maxHp*0.4; near(mine(L,d),plainHit(L,()=>mine(L,d))*1.075,'Exact Change: not when it is lower'); near(mine(L,f),plainHit(L,()=>mine(L,f)),'neither on an enemy not In Debt');
  near(hitOn(L,v,1000,{src:d}),plainHit(L,()=>hitOn(L,v,1000,{src:d}))*0.90,'Hard Bargain: 2% x 5 less from the enemy In Debt');
  for(let i=0;i<3;i++) V.hit(f,v,1,{kind:'true'}); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.94,'Late Payment: 2% x 3 less from an enemy that owes 3 (Owed: Late Payment keeps them)');
});

test('Gruel / No Forgiveness, Debt Sold On and New Owner, Eats What He Is Owed (LINK, with Girth)',()=>{
  const L=lab(H,S(['le_5_2']),{foes:2}), d=L.F[1]; debt(L,d); d.hp=d.maxHp*0.6; V.heal(d,d.maxHp*0.3); near(d.hp,d.maxHp*0.70,'No Forgiveness: an enemy In Debt is not healed above 70%');
  const f=L.F[0]; f.hp=f.maxHp*0.6; V.heal(f,f.maxHp*0.3); near(f.hp,f.maxHp*0.9,'another one is');
  const L2=lab(H,S(['le_5_3','le_6_3','le_2_2','le_n2']),{foes:3}), {v,F}=L2; F[1].maxHp=3e9; F[1].hp=3e9; F[2].maxHp=2e9; F[2].hp=2e9; V.cast(v,'blue'); const e=F[1]; assert.equal(e._debtTo,v);
  setUst(L2,e,'int',3); V.step(1); const left=e._debtT, i0=ust(L2,e,'int'); v.hp=v.maxHp*0.5; const hv=v.hp; V.dmg(e,1e13);
  assert.equal(F[2]._debtTo,v,'Debt Sold On: to the living enemy with the highest max HP'); near(F[2]._debtT,left+3,'with the time it had left, New Owner 1 s x 3 longer',1e-9);
  assert.equal(ust(L2,F[2],'int'),i0,'and its Interest'); near(v.hp-hv,v.maxHp*0.03,'Eats What He Is Owed: 3% of his max HP',1e-6); V.step(1); near(F[2]._debtPct,0.35*(1+0.05*i0),'(its cut follows the Interest)',1e-9);
  const L3=lab(H,S(['le_n2','ap_1_4']),{foes:2,allies:1}), w=L3.v, b=L3.F[1]; debt(L3,b); w.hp=w.maxHp*0.2; const a=0.25*w.maxHp/0.175; hitOn(L3,L3.A[0],a,{src:b});
  assert.equal(stack(L3,'girth'),2,'with Girth: what Weigh the Debt heals him (25% of his max HP) counts toward Girth');
});

test('Gruel / The Reckoning\'s Ledger: Day of Reckoning, Settling Up; and The Collector\'s Walk, Never a Copper Forgiven + Weighing Eye',()=>{
  const L=lab(H,S(['le_11_2','le_12_2','le_1_4']),{foes:2,allies:1,big:true}), {v,A,F}=L; debt(L,F[1]); setUst(L,F[1],'int',2); L.T.s.ia={};
  V.cast(v,'ult'); assert.equal(ust(L,F[0],'owed'),3,'Day of Reckoning: every enemy it taunts owes 3 at once'); assert.equal(ust(L,F[1],'owed'),0,'(not one it did not)');
  near(mine(L,F[0]),plainHit(L,()=>mine(L,F[0]))*1.05,'Settling Up: enemies that owe him take 1% x 5 more from him'); near(hitOn(L,F[0],1000,{src:A[0]}),plainHit(L,()=>hitOn(L,F[0],1000,{src:A[0]}))*1.05,'and from his team');
  near(mine(L,F[1]),plainHit(L,()=>mine(L,F[1])),'not one that owes nothing');
  const f0=stack(L,'fee'); secs(3.9); assert.equal(stack(L,'fee'),f0,'(the taunt still runs)'); const i=ust(L,F[1],'int'); secs(0.2); const f1=stack(L,'fee'); assert.ok(i>=4&&(f1===f0+i||f1===f0+i+1),'when the taunt ends the enemy In Debt pays its Interest as Fee: '+i+' -> '+(f1-f0));
  const s0=plain({},P=>P.v.speed), L2=lab(H,S(['le_7_1','le_1_1']),{foes:2}), w=L2.v; w.target=L2.F[0]; for(let k=0;k<3;k++) V.hit(L2.F[0],w,1,{kind:'true'}); V.step(1);
  near(w.speed,s0*1.12,'The Collector\'s Walk: 4% x 3 faster toward an enemy that owes 3'); w.target=L2.F[1]; V.step(1); near(w.speed,s0,'not toward one that does not');
  const L3=lab(H,S(['le_9_3','bs_9_2']),{foes:2}), u=L3.v, t=L3.F[0], ign=x=>{ const s=u._wpnArmIgn; u._wpnArmIgn=x; try{ return DEF(u,t,'phys'); } finally{ u._wpnArmIgn=s; } };
  near(mine(L3,t,1000,{kind:'phys'}),plainHit(L3,()=>mine(L3,t,1000,{kind:'phys'}))*Math.pow(ign(0.10)/ign(0),2),'each ignores 2% x 5 of the armor; the two multiply');
});

/* ============================== THE BRASS SCALES ============================== */
test('Gruel / Pans: Two Pans (left: less damage, right: more attack), Fine Weights, the tips - Counterpoise (once every 2.5 s), Steady Hand',()=>{
  const a0=plain({},P=>P.v.dmg), L=lab(H,S(['bs_1_3','bs_2_3','bs_4_3','bs_11_3']),{foes:2,big:true}), {v,F}=L, f=F[0], p=()=>L.T.s.pan;
  near(hitOn(L,v,1000),1000,'empty pans: no bonus'); near(p().L,1000,'damage he takes fills the left pan');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.95,'left heavier: 1% x 5 less');
  v.hp=v.maxHp*0.5; const h=v.hp; mine(L,f,5000); assert.ok(p().R>p().L,'damage he deals fills the right pan'); assert.equal(stack(L,'tip'),1,'it tipped');
  near(v.hp-h,v.maxHp*0.03,'Counterpoise: 1% x 3 of his max HP',1e-9); V.step(1); near(v.dmg,a0*(1+0.05+0.025),'right heavier: 1% x 5 more attack; Steady Hand 0.5% x 5 per tip (stat rows add)');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.025),'and 0.5% x 5 damage reduction per tip');
  const h2=v.hp; hitOn(L,v,9000); assert.equal(stack(L,'tip'),2,'tipped back'); near(v.hp,h2-9000*(1-0.025),'Counterpoise: not again within 2.5 s',1e-9);
  for(let i=0;i<20;i++){ const q=p(); hitOn(L,v,(q.R-q.L)*1.3+2000); const w=p(); mine(L,f,(w.L-w.R)*1.3+2000); } assert.equal(stack(L,'tip'),10,'Steady Hand: up to 10 tips');
  pans(L,1000,0); L.T.s.pan.t=0; secs(5.4); near(p().L,1000,'Fine Weights: the pans hold 4 + 0.5 x 3 s'); secs(0.2); near(p().L,0,'then both empty'); near(p().R,0,'');
  V.wave(); V.step(1); assert.equal(stack(L,'tip'),0,'Steady Hand: for the wave');
});

test('Gruel / Honest Measure and Level Hand, Thumb on the Scale, Fair Exchange, Full Balance',()=>{
  const a0=plain({},P=>P.v.dmg), L=lab(H,S(['bs_1_3','bs_5_2','bs_6_2','bs_12_3']),{foes:2,big:true}), {v}=L;
  pans(L,1000,1200); V.step(1); near(v.dmg,a0*1.10,'Honest Measure: level within 10% + 3% x 3: both bonuses at double strength (16.7% apart)');
  pans(L,1000,1200); near(hitOn(L,v,1),plainHit(L,()=>hitOn(L,v,1))*0.90,'');
  pans(L,1000,1500); V.step(1); near(v.dmg,a0*1.05,'33% apart: the right pan alone');
  pans(L,1000,1050); v.hp=v.maxHp*0.5; const g1=gain(v,1); pans(L,1000,3000); const g0=gain(v,1); near(g1-g0,v.maxHp*0.01,'Full Balance: within 10%, 0.2% x 5 of his max HP each second',1e-3);
  const L2=lab(H,S(['bs_1_3','bs_5_3']),{foes:2,big:true}); V.step(1); near(L2.v.dmg,a0*1.03,'Thumb on the Scale: both count as heavier, each at 60%'); near(hitOn(L2,L2.v,1000),plainHit(L2,()=>hitOn(L2,L2.v,1000))*0.97,'');
  const L3=lab(H,S(['bs_1_3','bs_9_3']),{foes:2,big:true}); V.cast(L3.v,'ult'); pans(L3,0,0); hitOn(L3,L3.v,1000); assert.ok(L3.T.s.pan.R>0,'Fair Exchange: inside The Reckoning a hit he takes fills the right pan too');
  pans(L3,2000,0); near(hitOn(L3,L3.v,1000),plainHit(L3,()=>hitOn(L3,L3.v,1000))*0.90,'and the pans\' bonuses are doubled'); secs(4.1); pans(L3,2000,0); near(hitOn(L3,L3.v,1000),plainHit(L3,()=>hitOn(L3,L3.v,1000))*0.95,'not after it');
});

test('Gruel / while a pan is heavier: Measured Blows, Balanced Stance, Gluttonous Measure; the crit cap with Forty Towns',()=>{
  const L=lab(H,S(['bs_6_3','bs_8_3','bs_10_3']),{foes:2}), {v}=L;
  pans(L,0,1000); V.step(1); near(v.glyphCrit,0.05,'Measured Blows: right heavier, 1% x 5 critical chance',1e-9); pans(L,1000,0); V.step(1); near(v.glyphCrit,0,'not while the left is',1e-9);
  const big=x=>{ x.shield=1e12; x.shieldT=99; };
  big(v); pans(L,1000,0); near(hitOn(L,v,1000,{crit:true}),plainHit(L,()=>{ big(v); return hitOn(L,v,1000,{crit:true}); })*0.95,'Balanced Stance: left heavier, a critical hit 1% x 5 less'); v.shield=0;
  pans(L,1000,0); L.T.s.pan.t=0; v.hp=v.maxHp*0.4; const g1=gain(v,1); pans(L,0,1000); L.T.s.pan.t=0; v.hp=v.maxHp*0.4; const g0=gain(v,1);
  near(g1/g0,1+Math.min(0.09,0.012/(0.04*(v.passMul||1))),'Gluttonous Measure: left heavier, Gluttony 3% x 3 more (within the 1.2% a second cap)',5e-3);
  const L2=lab(H,S(['bs_6_3','le_7_3']),{foes:2}); pans(L2,0,1000); V.step(1); near(L2.v.glyphCrit,0,'with Forty Towns at 5/5 (5%) Measured Blows adds nothing: his crit talents give at most 5% together',1e-9);
});

test('Gruel / Short Weight: Short Weight, Light Purse, Bare Cupboard, Price of Bread, Scrap Value, Last Weighing; Coinflail turns toward the nearest one',()=>{
  const L=lab(H,S(['bs_1_1','bs_3_1','bs_9_1','bs_5_1','bs_7_1','bs_12_1']),{foes:3,allies:1,big:true}), {v,A,F}=L, f=F[0];
  f.hp=f.maxHp*0.33; V.step(1); v.hp=v.maxHp*0.5; let h=v.hp; const x=mine(L,f,1000); near(x,plainHit(L,()=>mine(L,f,1000))*1.04,'Last Weighing: 2% x 2 more from his team (him too)');
  void h; h=v.hp; mine(L,f,1000); near(v.hp-h,1040*0.05,'Short Weight (below 30% + 1% x 5): his hits heal him 1% x 5 of the damage',1e-6);
  near(hitOn(L,f,1000,{src:A[0]}),plainHit(L,()=>hitOn(L,f,1000,{src:A[0]}))*1.04,'(an ally\'s hit)');
  const g=f.hp; V.heal(f,1000); near(f.hp-g,1000*0.85,'Bare Cupboard: 3% x 5 less healing');
  near(hitOn(L,A[0],1000,{src:f}),plainHit(L,()=>hitOn(L,A[0],1000,{src:f}))*0.91,'Price of Bread: it deals 3% x 3 less'); near(hitOn(L,v,1000,{src:f}),plainHit(L,()=>hitOn(L,v,1000,{src:f}))*0.91,'(to him too)');
  F[1].hp=F[1].maxHp*0.36; near(mine(L,F[1],1000),plainHit(L,()=>mine(L,F[1],1000)),'36% is not Short Weight');
  v.hp=v.maxHp*0.5; h=v.hp; V.dmg(f,1e13); near(v.hp-h,v.maxHp*0.05,'Scrap Value: a Short Weight enemy dies: 1% x 5 of his max HP',1e-6);
  h=v.hp; F[2].hp=F[2].maxHp*0.9; V.step(1); V.dmg(F[2],1e13); near(v.hp-h,glutRate(v)*V.STEP,'not one killed from 90%',1e-3);
  const L2=lab(H,S(['bs_1_1']),{foes:2}), u=L2.v; cfAt(L2,L2.F[1]); cfAt(L2,L2.F[0],-2.5,0); L2.F[0].hp=L2.F[0].maxHp*0.2;
  assert.ok(plainHit(L2,()=>lost(L2.F[1],()=>V.cast(u,'green',L2.F[1])))>0,'(plain: it goes where it was aimed)');
  let b=0; const a=lost(L2.F[0],()=>{ b=lost(L2.F[1],()=>V.cast(u,'green',L2.F[1])); }); assert.ok(a>0&&b===0,'Short Weight: Coinflail turns toward the nearest Short Weight enemy');
});

test('Gruel / Tipped Scales: Mother\'s Scales, Steep Tilt, Weigh Them Down; The Heaviest Pays doubles it on the debtor; Scales of the Mother',()=>{
  const L=lab(H,S(['bs_1_4','bs_2_4','bs_3_4','bs_7_4']),{foes:2,big:true}), {v,F}=L, f=F[0]; v.hp=v.maxHp*0.4;
  near(mine(L,f),plainHit(L,()=>mine(L,f))*1.18,'Mother\'s Scales: 100% against his 40% - 6 whole tens, 1% x 3 each');
  f.slow=0; f.slowMul=1; mine(L,f); near(f.slowMul,0.70,'Weigh Them Down: 50 points or more above him: slowed 30%'); near(f.slow,1.5,'for 1.5 s',1e-9);
  near(hitOn(L,v,1000,{src:f}),plainHit(L,()=>hitOn(L,v,1000,{src:f}))*0.97,'Steep Tilt: a healthier enemy deals 1% x 3 less');
  f.hp=f.maxHp*0.85; f.slow=0; f.slowMul=1; near(mine(L,f),plainHit(L,()=>mine(L,f))*1.12,'85%: 4 tens'); assert.equal(f.slowMul,1,'45 points: no slow');
  f.hp=f.maxHp*0.45; near(mine(L,f),plainHit(L,()=>mine(L,f)),'45%: no whole ten'); f.hp=f.maxHp*0.3; near(hitOn(L,v,1000,{src:f}),plainHit(L,()=>hitOn(L,v,1000,{src:f})),'Steep Tilt: not from a weaker one');
  f.hp=f.maxHp; debt(L,f); near(mine(L,f),plainHit(L,()=>mine(L,f))*1.36,'The Heaviest Pays: twice against the enemy In Debt');
  const L2=lab(H,S(['bs_11_4']),{foes:2,big:true}); L2.v.hp=L2.v.maxHp*0.5; cfAt(L2,L2.F[0]); const p=plainHit(L2,()=>cast(L2,L2.F[0]));
  near(cast(L2,L2.F[0]),p*1.30,'Scales of the Mother: a healthier enemy is struck again for 30% of the hit'); L2.F[0].hp=L2.F[0].maxHp*0.3; near(cast(L2,L2.F[0]),p,'not a weaker one');
});

test('Gruel / Weighed and Found, Last Coin, Coin Rain, Fair Warning, Brass Polish and Long Lunch, Iron Gut and Iron Stomach',()=>{
  const L=lab(H,S(['bs_6_1','bs_11_1','bs_10_2','bs_12_2','ap_2_3']),{foes:2,big:true}), {v,F}=L;
  near(mine(L,F[0]),plainHit(L,()=>mine(L,F[0]))*1.20,'Weighed and Found: his first hit on each enemy 10% x 2 more'); near(mine(L,F[0]),plainHit(L,()=>mine(L,F[0])),'not the second');
  near(mine(L,F[1]),plainHit(L,()=>mine(L,F[1]))*1.20,'the first on another'); v.hp=v.maxHp*0.25; near(mine(L,F[1]),plainHit(L,()=>mine(L,F[1]))*1.15,'Last Coin: below 30% HP, 3% x 5 more');
  near(FX.cd(v,'green',7),6.1,'Coin Rain: 0.3 s x 3 shorter',1e-9);
  const d={dps:1000,src:F[0],remaining:3,interval:1,acc:0}, k=FX.dotPre(v,d); near(d.dps,1000*0.94*0.91,'Iron Gut 2% x 3 and Iron Stomach 3% x 3 less from damage over time (two reductions that multiply)'); FX.dotPost(v,d,k);
  const L2=lab(H,S(['bs_n1','bs_12_4','ap_12_3']),{foes:2,allies:1,big:true}), u=L2.v; V.cast(u,'ult'); near(u.drT,4+0.6+0.6,'Brass Polish and Long Lunch: 0.2 s x 3 longer each',1e-9);
  near(L2.F[0].forcedTargetT,5.2,'(the taunt too)',1e-9);
  near(hitOn(L2,L2.A[0],1000),plainHit(L2,()=>hitOn(L2,L2.A[0],1000))*0.90,'Fair Warning: a taunted enemy deals 2% x 5 less (to his allies)'); near(hitOn(L2,u,1000),plainHit(L2,()=>hitOn(L2,u,1000))*0.90,'(and to him)');
  near(hitOn(L2,L2.A[0],1000,{src:L2.F[1]}),plainHit(L2,()=>hitOn(L2,L2.A[0],1000,{src:L2.F[1]})),'not one it did not taunt');
});

test('Gruel / controls on him: Sure Footing, Fixed Price, Heavy to Shift - together at most 35% shorter',()=>{
  const L=lab(H,S(['bs_8_2','le_12_3','ap_5_1']),{foes:2}), {v,F}=L, c=(field)=>{ v[field]=0; v.level=1; V.cc(F[0],v,field,2); return v[field]/(2*V.ccNerf); };
  near(c('stunned'),0.80*0.85,'a stun: 4% x 5 and 5% x 3 shorter',1e-9); near(c('fearT'),0.80,'a fear: 4% x 5 shorter',1e-9); near(c('silencedT'),0.65,'a silence: 0.80 x 0.80 = 0.64, held at 35% shorter',1e-9); v.stunned=1e6;
});

test('Gruel / The Scales Settle (SIGNATURE): half of what he takes goes to the healthiest enemy within 6 m, up to 20% of its max HP; once every 25 s',()=>{
  const L=lab(H,S(['bs_13_3']),{foes:2,big:true}), {v,F}=L, f=F[0]; f.maxHp=f.hp=1e4; v.hp=v.maxHp*0.5; pans(L,2000,0); V.step(1);
  assert.ok(win(L,'settle'),'one pan holds twice the other: the scales settle'); assert.equal(L.T.s.stl.x,f,'weighed against the healthiest enemy within 6 m (the one 10 m away is too far)');
  const h=f.hp; near(hitOn(L,v,1000),500,'half of the hit is dealt to it instead'); near(h-f.hp,500,'',1e-9);
  for(let i=0;i<4;i++) hitOn(L,v,1000); near(f.hp,f.maxHp*0.8,'no more than 20% of its max HP',1e-9); near(hitOn(L,v,1000),1000,'then the rest lands on him');
  f.hp=f.maxHp*0.3; secs(5); assert.ok(!win(L,'settle'),'5 s'); pans(L,2000,0); V.step(2); assert.ok(!win(L,'settle'),'once every 25 s');
  const L2=lab(H,S(['bs_13_3']),{foes:2,big:true}); L2.F[0]._raidBoss=true; L2.F[0].maxHp=L2.F[0].hp=1e4; L2.v.hp=L2.v.maxHp*0.5; pans(L2,2000,0); V.step(1);
  for(let i=0;i<4;i++) hitOn(L2,L2.v,1000); near(L2.F[0].hp,1e4*0.95,'a boss: no more than 5%',1e-9);
  const L3=lab(H,S(['bs_13_3']),{foes:2,big:true}); pans(L3,2000,0); V.step(1); assert.ok(win(L3,'settle')); near(hitOn(L3,L3.v,1000),1000,'while his HP share is not lower than its: nothing moves');
});

/* ============================== THE APPETITE ============================== */
test('Gruel / Appetite: Never Full, Snacking, Hungry Eyes, Midnight Snack; Gnawing Hunger, Empty Belly, Starving Swing',()=>{
  const P0=plain({},P=>({d:P.v.dmg,i:P.v.atkInterval}));
  const L=lab(H,S(['ap_1_1','ap_4_1','ap_6_1','ap_6_4','ap_7_1','ap_11_1','ap_8_1']),{foes:2,big:true}), {v,F}=L;
  assert.equal(stack(L,'app'),6,'Midnight Snack: 3 x 2 at the wave\'s start'); secs(1.02); assert.equal(stack(L,'app'),8,'at full HP, 1 a second, Snacking 20% x 5 faster'); secs(1.02); assert.equal(stack(L,'app'),10,'max 10');
  V.step(1); near(v.dmg,P0.d*1.20,'Never Full: 0.4% x 5 attack each'); near(P0.i/v.atkInterval,1.10,'Empty Belly: 0.2% x 5 attack speed each'); near(v.glyphCrit,0.05,'Gnawing Hunger: 0.1% x 5 critical chance each',1e-9);
  near(noCrit(v,()=>mine(L,F[0],1000,{crit:true})),plainHit(L,()=>mine(L,F[0],1000,{crit:true}))*1.15,'Starving Swing: at 5 Appetite his critical hits 3% x 5 more');
  setStack(L,'app',0); v.hp=v.maxHp*0.4; L.T.s.apA=0; secs(1.02); assert.equal(stack(L,'app'),1,'Hungry Eyes: below 50% at 20% x 3 of the speed (x 2 Snacking = 1.2 a second)'); secs(0.75); assert.equal(stack(L,'app'),2,'');
  v.hp=v.maxHp*0.7; setStack(L,'app',0); L.T.s.apA=0; secs(1.5); assert.equal(stack(L,'app'),0,'not between 50% and full');
});

test('Gruel / Coinflail eats the Appetite: Rumbling, Clean Plate, Ravenous',()=>{
  const L=lab(H,S(['ap_1_1','ap_2_1','ap_3_1','ap_10_1']),{foes:2,big:true}), {v,F}=L; setStack(L,'app',10); V.step(1); v.hp=v.maxHp*0.5; cfAt(L,F[0]);
  const p=plainHit(L,()=>cast(L,F[0])); const g=cast(L,F[0]); near(g,p*1.30,'Rumbling: 1% x 3 more for each Appetite it eats'); assert.equal(stack(L,'app'),0,'it eats them all');
  near(v.hp,v.maxHp*(0.5+0.08+0.003*5*10),'Clean Plate: eating 10 heals 8%; Ravenous: 0.3% x 5 for each',1e-9);
  setStack(L,'app',9); v.hp=v.maxHp*0.5; cast(L,F[0]); near(v.hp,v.maxHp*(0.5+0.003*5*9),'9: no Clean Plate',1e-9);
});

test('Gruel / Girth: Girth from Gluttony, Waistline, Second Belt, Broad Belt, Weight Behind It, Too Big to Fall, Immovable Feast, The Table Is Laid',()=>{
  const L=lab(H,S(['ap_1_4']),{foes:2}), {v}=L, r=glutRate(v)/v.maxHp; v.hp=v.maxHp*0.1; secs(0.38/r); assert.equal(stack(L,'girth'),3,'every 10% of his max HP Gluttony heals: 1 Girth');
  setStack(L,'girth',12); v.hp=v.maxHp*0.1; secs(0.25/r); assert.equal(stack(L,'girth'),10,'max 10'); near(hitOn(L,v,100,{}),plainHit(L,()=>hitOn(L,v,100))*(1-0.009*10),'0.3% x 3 damage reduction each');
  V.wave(); V.step(1); assert.equal(stack(L,'girth'),0,'Girth is for the wave');
  const L2=lab(H,S(['ap_1_4','ap_7_4','ap_5_4','ap_3_4','ap_7_3','ap_9_4','ap_12_4','ap_12_2']),{foes:2}), u=L2.v, f=L2.F[0], m0=u.maxHp;
  setStack(L2,'girth',13); V.step(1); near(u.maxHp,m0*(1+0.01*13),'Broad Belt: 0.2% x 5 max HP each (Waistline: up to 13)'); assert.ok(u._gearImmovableT>0,'Too Big to Fall: at full Girth he cannot be moved');
  near(mine(L2,f,1000,{auto:true}),plainHit(L2,()=>mine(L2,f,1000,{auto:true}))*(1+0.015*13),'Weight Behind It: basic attacks 0.3% x 5 more each');
  f.slow=0; f.slowMul=1; mine(L2,f); near(f.slowMul,0.90,'Immovable Feast: at full Girth his hits slow 5% x 2'); near(f.slow,1,'for 1 s',1e-9);
  u.hp=u.maxHp*0.4; const g1=gain(u,1)/glutRate(u); near(g1,1+Math.min(0.01*13,0.012/(0.04*(u.passMul||1))),'The Table Is Laid: Gluttony 0.2% x 5 more each (within the 1.2% a second cap)',5e-3);
  setStack(L2,'girth',12); u._gearImmovableT=0; V.step(1); assert.ok(!(u._gearImmovableT>0),'not at 12'); f.slow=0; f.slowMul=1; mine(L2,f); assert.equal(f.slowMul,1);
  setStack(L2,'girth',8); V.wave(); V.step(1); assert.equal(stack(L2,'girth'),5,'Second Belt: 1 x 5 kept between waves');
});

test('Gruel / Feast: Feast, Long Supper, Gorge, Greedy Gut, Rich Sauce, All You Can Eat; Gluttony\'s talent part held at 1.2% a second',()=>{
  const P0=plain({},P=>({d:P.v.dmg,i:P.v.atkInterval}));
  const L=lab(H,S(['ap_2_2','ap_4_2','ap_8_2','ap_5_2','ap_6_2','ap_10_2']),{foes:3}), {v,F}=L; V.hit(v,F[0],1,{kind:'true'}); v.hp=v.maxHp*0.5; const h=v.hp;
  V.dmg(F[0],1e13); assert.ok(win(L,'feast'),'an enemy he hit in the last 3 s dies: a Feast'); near(v.hp-h,v.maxHp*0.05,'Rich Sauce: 1% x 5 at once',1e-6);
  near(L.T.s.w.feast.t,4.5,'Long Supper: 3 + 0.5 x 3 s',1e-9); V.hit(v,F[1],1,{kind:'true'}); V.dmg(F[1],1e13); near(L.T.s.w.feast.t,5.5,'All You Can Eat: a Feast already running gets 1 s more',1e-9);
  V.step(1); near(v.dmg,P0.d*1.05,'and 1% x 5 attack'); near(P0.i/v.atkInterval,1.15,'Greedy Gut: 15% attack speed'); near(hitOn(L,v,100),plainHit(L,()=>hitOn(L,v,100))*0.925,'Gorge: 1.5% x 5 less');
  v.hp=v.maxHp*0.3; near(gain(v,1),glutRate(v)+Math.min(0.30*glutRate(v),0.012*v.maxHp),'Feast: Gluttony 6% x 5 more, its talent part at most 1.2% of his max HP a second',2e-3);
  secs(4.6); assert.ok(!win(L,'feast')); V.step(1); assert.equal(stack(L,'aye'),0,'All You Can Eat ends with the Feast'); V.dmg(F[2],1e13); assert.ok(!win(L,'feast'),'not an enemy he never hit');
  const L2=lab(H,S(['ap_2_2','ap_5_3','ap_6_3']),{foes:2,allies:1}), a=L2.A[0], u=L2.v; a.maxHp=u.maxHp; a.hp=a.maxHp*0.5; let g=gain(a,1); near(g,0,'Pass the Dish: not without a Feast',1e-9);
  V.hit(u,L2.F[0],1,{kind:'true'}); V.dmg(L2.F[0],1e13); a.hp=a.maxHp*0.5; g=gain(a,1); near(g,a.maxHp*0.012,'while he Feasts the lowest-HP ally within 5 m heals half his Gluttony (Generous Helping 5% x 3 more), at most 1.2% of its max HP a second',2e-2);
});

test('Gruel / Slow Digest: healing from others 3% x 3 stronger, not his own (Weigh the Debt\'s COLLECTED)',()=>{
  const L=lab(H,S(['ap_8_3']),{foes:2,allies:1,big:true}), {v,A,F}=L; v.hp=v.maxHp*0.5; let h=v.hp; V.heal(v,1000); near(v.hp-h,1090,'an ally\'s heal 3% x 3 stronger',1e-6);
  debt(L,F[1]); h=v.hp; hitOn(L,A[0],1000,{src:F[1]}); near(v.hp,h,'his COLLECTED heal is not',1e-9); h=v.hp; V.heal(v,1000); near(v.hp-h,1090,'(and the next heal from others is again)',1e-6);
});

test('Gruel / The Reckoning\'s Appetite: Sit Down to Dinner, Heavyweight',()=>{
  const L=lab(H,S(['ap_11_2','ap_2_2','ap_10_4','ap_1_4']),{foes:2}), {v}=L; setStack(L,'girth',4); V.cast(v,'ult');
  assert.ok(win(L,'feast'),'Sit Down to Dinner: he Feasts while it lasts'); near(L.T.s.w.feast.t,4,'',1e-9); assert.equal(stack(L,'girth'),5,'and each enemy taunted onto him gives 1 Girth (one within 6 m)');
  near(v.drMul,1-TDR(10)-0.05,'Heavyweight: at 5 Girth its damage cut is 1 point x 5 stronger',1e-9);
  const L2=lab(H,S(['ap_10_4','ap_1_4']),{foes:2}); setStack(L2,'girth',4); V.cast(L2.v,'ult'); near(L2.v.drMul,1-TDR(10),'at 4: not',1e-9);
});

test('Gruel / Everything Is Eaten (SIGNATURE): once per fight below 25% - Gluttony three times as fast (its extra at most 6% a second), 10 Girth, 10 Appetite, deaths are Feasts',()=>{
  const L=lab(H,S(['ap_13_2']),{foes:2}), {v,F}=L; v.hp=v.maxHp*0.2; V.step(1); assert.ok(win(L,'eie'),'he sits down to eat'); assert.equal(stack(L,'girth'),10); assert.equal(stack(L,'app'),10);
  const r=glutRate(v); v.hp=v.maxHp*0.2; near(gain(v,1),r+Math.min(2*r,0.06*v.maxHp),'Gluttony three times as fast, the extra at most 6% of his max HP a second',2e-3);
  V.dmg(F[0],1e13); assert.ok(win(L,'feast'),'every enemy that dies is a Feast'); near(L.T.s.w.feast.t,4,'that adds 1 s',1e-9);
  secs(4.2); assert.ok(!win(L,'eie'),'5 s'); v.hp=v.maxHp*0.5; V.step(1); v.hp=v.maxHp*0.2; V.step(1); assert.ok(!win(L,'eie'),'once per fight');
});

/* ============================== THE CAPS ============================== */
test('Gruel: his damage-reduction talents are ONE group - with everything true at once they take 30% off a hit, never more',()=>{
  const L=lab(H,everything(H),{foes:2,big:true}), {v,F}=L, f=F[0]; v.drT=0; setStack(L,'fee',20); setStack(L,'tip',10); setStack(L,'girth',13); L.T.s.w.feast={t:9,n:1,cdT:0,at:-1,wave:false};
  pans(L,1e9,0); debt(L,f); setUst(L,f,'owed',8); f.hp=f.maxHp*0.29; v.hp=v.maxHp*0.2; A0(L,f); L.T.s.w.settle={t:0,n:1,cdT:0,at:-1,wave:false};
  near(hitOn(L,v,1000,{crit:true}),plainHit(L,()=>hitOn(L,v,1000,{crit:true}))*0.70,'every condition true: held at 30%');
  const d={dps:1000,src:f,remaining:3,interval:1,acc:0}, k=FX.dotPre(v,d); near(d.dps,700,'a DoT tick too'); FX.dotPost(v,d,k);
  const L2=lab(H,S(['le_3_4']),{foes:2,big:true}); setStack(L2,'fee',20); near(hitOn(L2,L2.v,1000),plainHit(L2,()=>hitOn(L2,L2.v,1000))*0.80,'(one of them alone, below the cap: 20%)');
});
function A0(L,f){ const M=f._talM||(f._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o.tnt={t0:0,until:1e9,v:0}; }

test('Gruel: his critical-chance talents together give at most 5%',()=>{
  const L=lab(H,S(['bs_6_3','ap_7_1','ap_1_1']),{foes:2}); setStack(L,'app',10); pans(L,0,1000); V.step(1); near(L.v.glyphCrit,0.05,'Measured Blows 5% + Gnawing Hunger 5%: held at 5%',1e-9);
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Gruel: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['le_1_1','le_1_4','le_2_2','bs_1_3','bs_1_4','bs_11_3','ap_1_1','ap_1_4','ap_2_2']), TEAM=['vael','sylthaine','vireo','vex','gruel'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]}))),4), g=U.find(u=>u.key===H);
  assert.ok(g._tal); assert.ok(U.filter(u=>u!==g).every(u=>!u._tal));
  const mx={}; let owed=0, debtN=0, intr=0;
  for(let i=0;i<3000&&!V.ended()&&g.alive;i++){ V.step(1); const T0=g._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of units()){ if(f.team!=='enemy') continue; const o=f._talM&&f._talM[g.uid]; if(o&&o['#owed']&&o['#owed'].until>V.now()) owed=Math.max(owed,o['#owed'].v); if(o&&o['#int']) intr=Math.max(intr,o['#int'].v); if(f._debtTo===g&&f._debtT>0) debtN++; } }
  console.log('  live: owed '+owed+', ticks with a debtor '+debtN+', Interest '+intr+', stacks '+JSON.stringify(mx));
  assert.ok(owed>=1,'real hits on him wrote Owed'); assert.ok(debtN>0&&intr>=1,'a real Weigh the Debt put an enemy In Debt and it gained Interest'); assert.ok(mx.tip>=1,'the pans tipped');
  determinism(H,TEAM);
});

/* The page sites his talents added (the skillTgt line in Weigh the Debt's case, the num hook on each COLLECTED heal, the num hook on Gluttony): with nothing
   learned, whole seeded fights with Gruel in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Gruel: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['gruel','vael','vireo','sylthaine','dandra'], foeTeam=['bloatus','fritz','gruel','konwu','mirelle'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __grN={wd:0,col:0,glut:0}; var __grD=_doEffectCore, __grH=_dealDamageCore, __grU=_updateBattleCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="gruel"&&type==="weighdebt") __grN.wd++; return __grD.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt){ if(src&&(src._debtT||0)>0&&src._debtTo&&src._debtTo.alive&&src._debtTo!==tgt&&tgt&&tgt.team===src._debtTo.team&&tgt.alive) __grN.col++; return __grH.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ for(const u of units) if(u&&u.alive&&u.key==="gruel"&&u.pass&&u.pass.juggernaut) __grN.glut++; return __grU.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__grN'); console.log('  identity: Weigh the Debt cast '+c.wd+' times (the skillTgt line), COLLECTED '+c.col+' times (the collect line), Gluttony ticked '+c.glut+' times (the glut line)');
    assert.ok(c.wd>0&&c.col>0&&c.glut>0,'every new site was run'); }
  finally{ VMX('_doEffectCore=__grD; _dealDamageCore=__grH; _updateBattleCore=__grU;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong. Gruel is one of the
   three heroes the rule is aimed at: his talent reductions are ONE group capped at 30%. Reported: the worst hit possible, the sustained level, the share of a fight above 85%. */
const DEFS={ le:['le_1_4','le_3_4','le_6_1','le_11_3','le_8_3','le_1_3','le_1_1'],
             bs:['bs_1_3','bs_1_4','bs_2_4','bs_8_3','bs_12_2','bs_11_3','bs_5_1','bs_n1','bs_7_2','bs_13_3','bs_4_3','bs_5_3'],
             ap:['ap_2_3','ap_1_4','ap_8_2','ap_11_3','ap_3_3','ap_2_2','ap_10_4','ap_7_4','ap_11_2','ap_1_3'] };
function defensive(order){ let b={r:{}}; const want=[].concat(...order.map(k=>DEFS[k])), meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, goals=[]; for(const id of want) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
    if(id){ b=T.learn(H,b,id,100).build; continue; }
    const open=goals.find(x=>(b.r[x]|0)<meta(x).ranks), tree=open?meta(open).treeIdx:null;
    const pool=T.trees(H).map((tr,i)=>tr.talents.filter(t=>(tree==null||i===tree)&&!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1]||x[2]-y[2]);
    const any=pool[0]||T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his reduction talents true at once (20 Fee, 10 tips, full Girth, Feasting, the left pan heavier, the attacker In Debt, owing 8,
   taunted, Short Weight and healthier than him) INSIDE The Reckoning at skill level 100 (59.8%, Heavyweight +5 points), normal and critical, physical and magic, with
   his armor; glyph damage reduction 0 and 30% (its cap). The Scales Settle moves damage (not a reduction): reported apart. */
function worstHit(list,kind,crit,gdr){ const L=lab(H,list,{foes:3,allies:1,cold:true}), {v,F}=L; V.step(1); const f=F[0];
  v.drMul=1-TDR(100)-((list&&list.some(e=>e[0]==='ap_10_4'))?0.05:0); v.drT=99; v.glyphDR=gdr||0;
  if(L.T){ setStack(L,'fee',20); setStack(L,'tip',10); setStack(L,'girth',13); L.T.s.w.feast={t:99,n:1,cdT:0,at:-1,wave:false}; pans(L,1e12,0); debt(L,f); setUst(L,f,'owed',8); A0(L,f); }
  v.maxHp=1e5; v.hp=2e4; f.hp=f.maxHp*0.29; v.shield=1e12; v.shieldT=999;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Gruel: his most defensive legal 91-point build never takes more than 95% off a hit; the sustained level and the share of a fight above 85%',()=>{
  const cands=[['le','bs','ap'],['bs','le','ap'],['bs','ap','le'],['ap','bs','le'],['ap','le','bs'],['le','ap','bs']].map(o=>{ const b=defensive(o); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0)));
  let wg=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) wg=Math.max(wg,worstHit(best.list,kind,crit,0.30)); const ng=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95&&wg<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'% ('+(wg*100).toFixed(1)+'% with 30% glyph reduction): below 95%');
  /* seeded fights: every hit on him as it landed, and each tick a probe of what a plain enemy hit would lose right now (his skill slot, his armor or magic resist
     against each living enemy, his talents' group through the incoming hook; the most favourable enemy and kind counts), with his glyphs as built and at 30% */
  /* talents-fix1 (17 Nov): a heal on him that the hit itself sets off (his 'hurt' rows run inside the hit: Counterpoise's tip heal) is added back - it is
     healing, not reduction. On a24261fd9 one hit of 405 lost 214 to him (47% off, his armour) and Counterpoise healed 197 inside it: read as 95.7% */
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,all:[],pr:[],pg:[],mv:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore, __dhu=healUnit, __dIn=0, __dH=0;'+
    'healUnit=function(u,a){ const h=u&&u.hp; const r=__dhu.apply(this,arguments); if(__dIn&&u&&u.key==="gruel"&&u.team==="ally") __dH+=Math.max(0,u.hp-h); return r; };'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="gruel"&&tgt.team==="ally"&&src&&src.team!==tgt.team; let h0=0,s0=0,H0=__dH; if(me){ h0=tgt.hp+(tgt.shield||0); s0=tgt.shield||0; } let r; __dIn++; try{ r=__ddc.apply(this,arguments); } finally{ __dIn--; }'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0)+(__dH-H0), raw=amt*elemMul(src,tgt); if((tgt.shield||0)<=s0&&raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; __dr.all.push(d); if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="gruel"&&u.alive&&u.team==="ally"){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    let best=0,bestG=0; const sl=(u.drT>0)?u.drMul:1, gd=u.glyphDR||0, T0=u._tal, sw=T0&&T0.s.w.settle, st=sw?sw.t:0; if(sw) sw.t=0;'+
    '    for(const e of units){ if(!e||!e.alive||e.team===u.team) continue; for(const k of ["phys","magic"]){ const tk=T0?TalentFx.inc(u,e,1,k,true,false):1, f=sl*tk*defMul(e,u,k); const r1=1-f*(1-gd), r2=1-f*0.70; if(r1>best) best=r1; if(r2>bestG) bestG=r2; } }'+
    '    if(sw) sw.t=st; __dr.pr.push(best); __dr.pg.push(bestG); } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','gruel'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'), all=d.all.slice().sort((x,y)=>x-y), q=(A,p)=>A.length?A[Math.min(A.length-1,Math.floor(p*A.length))]:0, pr=d.pr.slice().sort((x,y)=>x-y), pg=d.pg.slice().sort((x,y)=>x-y), sh=(A,x)=>A.filter(y=>y>=x).length/Math.max(1,A.length);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), with 30% glyph reduction '+(wg*100).toFixed(1)+'% (no talents '+(ng*100).toFixed(1)+'%);'+
      ' seeded fights: '+d.n+' hits on him, median '+(q(all,0.5)*100).toFixed(1)+'%, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks+
      '; probe each tick (glyphs as built): sustained (median) '+(q(pr,0.5)*100).toFixed(1)+'%, 90th percentile '+(q(pr,0.9)*100).toFixed(1)+'%, highest '+(q(pr,1)*100).toFixed(1)+'%, above 85% '+(sh(pr,0.85)*100).toFixed(1)+'% of the time, at 95% '+(sh(pr,0.95)*100).toFixed(1)+'%'+
      '; with 30% glyph reduction: sustained '+(q(pg,0.5)*100).toFixed(1)+'%, highest '+(q(pg,1)*100).toFixed(1)+'%, above 85% '+(sh(pg,0.85)*100).toFixed(1)+'% of the time, at 95% '+(sh(pg,0.95)*100).toFixed(1)+'%');
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune');
    assert.ok(sh(pg,0.95)===0,'even with 30% glyph reduction the probe never reaches 95%'); assert.ok(sh(pg,0.85)<0.5,'and it is above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc; healUnit=__dhu;'); }
});
