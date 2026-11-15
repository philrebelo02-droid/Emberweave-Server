'use strict';
/* Grimsby's talents as data on the mechanics layer (talents-mech/grimsby.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Grimsby, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6); A0 (0,-5.5). His body is 1.74 m, a Vael's 2.01 m.
   Compound Interest (5 m, centre to centre) reaches F0, not F1. Ledger Slam (4 m around him, centre to centre) reaches neither: slam tests move enemies in.
   Lab units are HELD (stunned 1e6). free() lets one go (speed 0, level 1, so his controls land on it).
   Run: node --test tests/talents-mech-grimsby.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='grimsby', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const free=x=>{ x.stunned=0; x.silencedT=0; x.speed=0; x.level=1; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));
function skillRatio(L,t,skill,o){ L.T.s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))); } finally{ L.T.s.cur=null; } return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))); }
const outRatio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
const inRatio=(L,o)=>hitOn(L,L.v,1000,o)/plainHit(L,()=>hitOn(L,L.v,1000,o));
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ return V.cc(src,t,field,secs); } finally{ t.level=lv; } };
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const SM=lv=>VMX('skillMul')(lv);
/* his notices on x (the DoTs his talents made his: tag 'od'), Foreclosure's bleeds ('fc', 'fc2') */
const tagged=(L,x,tag)=>(x.dots||[]).filter(d=>d._talO===L.v.uid&&d._talK===tag&&d.remaining>0);
const odOf=(L,x)=>{ const a=tagged(L,x,'od'); return a[a.length-1]; };
const left=d=>d.remaining-1+(d._talF!=null?d._talF:1);
/* the share his rows give one tick of DoT d on x (his dotOut rows through the dot hook), the tick not dealt */
const dm=(x,d)=>{ const k=FX.dotPre(x,d); const r=d.dps/k[0]; d.dps=k[0]; d._talNow=false; return r; };
const od=(L,t)=>V.cast(L.v,'green',t);                                  // Overdue on t
const ult=L=>V.cast(L.v,'ult');                                          // Foreclosure
const slam=L=>V.cast(L.v,'blue');                                        // Ledger Slam (as it lands)
const rec=(L,x)=>(L.T.s.gr||{})[x.uid]||{};
/* a notice of his, made by hand on x (dps a second, ticks): tagged as his skill's own */
const fake=(L,x,dps,n,tag)=>{ VMX('pushDot')(x,dps,n,1,tag==='fc'?'#ffa657':'#8a7a3a',L.v); const d=x.dots[x.dots.length-1]; d.remaining=n; d._talO=L.v.uid; d._talK=tag||'od'; d._odN=x._debtStk||1; d._odD=0; return d; };
const debtor=(L,x,k)=>{ x._debtStk=k; x._debtOwner=L.v; x._debtDps=100; };

test('Grimsby: every talent is accounted for - 10 plain stats, 107 with rows, none waiting',()=>{
  accounting(H,[117,10,107,0,0]);
  const M=FXN.mech(H); for(const id of ['ci_1_1','ev_1_1','ne_1_1','ci_13_2','ev_13_2','ne_13_2','ci_8_3','ne_8_3']) assert.ok(M.talents[id],id);
  for(const id of ['ci_1_3','ci_3_3','ci_9_3','ev_1_2','ev_4_1','ev_5_1','ev_9_3','ne_1_3','ne_3_3','ne_9_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['ci_8_3','ne_8_3']) assert.ok(!FXN.has(H,id),id+' is a row (the 5% crit cap), not a plain stat');
});

test('Grimsby: his real kit, as the talents read it - Overdue stacks and notices, Compound Interest\'s 5 m, Ledger Slam 4 m around him, Foreclosure on every enemy',()=>{
  plain({foes:3},P=>{ const {v,F}=P; od(P,F[1]); od(P,F[1]); assert.equal(F[1]._debtStk,2,'two casts: 2 stacks'); const N=F[1].dots.filter(d=>d.color==='#8a7a3a');
    assert.equal(N.length,2,'each cast pushes a NEW notice'); near(N[1].dps/N[0].dps,2,'the second ticks for 2 stacks'); assert.equal(N[1].kind,'magic','a curse: magic'); assert.equal(N[0].remaining,6,'6 s at 10 m');
    for(let i=0;i<8;i++) od(P,F[1]); assert.equal(F[1]._debtStk,6,'max 6'); secs(13); assert.equal(F[1]._debtStk,6,'the stacks never fall when the notices run out');
    od(P,F[0]); const d0=F[0].dots[F[0].dots.length-1]; assert.equal(d0.remaining,Math.round(6*(1+VMX('SKLV.debtaura')(VMX('passLv')(v)))),'F0 at 4.5 m: Compound Interest makes it longer');
    at(P,F[0],3.5,0); for(const f of F) free(f); slam(P); assert.equal(F[0].forcedTarget,v,'Ledger Slam taunts F0 at 3.5 m'); near(F[0].silencedT,VMX('ccDur')(2),'silence 2 s x 0.7');
    assert.ok(F[0].pullT>0&&F[0].pulledBy===v,'and drags it'); assert.notEqual(F[1].forcedTarget,v,'not F1 at 10 m');
    const h=F.map(f=>f.hp); ult(P); for(const f of F){ assert.ok(f.hp<h[F.indexOf(f)],'Foreclosure strikes every enemy'); assert.ok(f.dots.some(d=>d.color==='#ffa657'&&d.src===v),'and leaves its bleed'); } });
});

/* ============================== COMPOUND INTEREST ============================== */
test('Grimsby / Arrears: Past Due, Usurer\'s Rate, Never Thrown Away, Penalty Rate, Debtor\'s Weakness, Usury, Arrears Ledger, Interest on Interest',()=>{
  const L=lab(H,S(['ci_1_1','ci_2_1','ci_4_1','ci_6_1','ci_12_2','ci_10_1','ci_11_2']),{foes:3,big:true,allies:1}), {v,F,A}=L;
  debtor(L,F[1],4); od(L,F[1]); odOf(L,F[1]).remaining=1000; V.step(1); assert.ok(!mark(L,F[1],'arr'),'5 Overdue: not yet');
  od(L,F[1]); const d=odOf(L,F[1]); assert.ok(d,'a notice of his'); d.remaining=1000; V.step(1);
  assert.ok(mark(L,F[1],'arr'),'6 Overdue and a running notice: Arrears'); assert.equal(stack(L,'ioi'),1,'Interest on Interest: 1 fallen this wave');
  secs(2); const r=rec(L,F[1]).rise; near(r,0.059*2,'Arrears rises 1% x 5 + 0.3% x 3 a second',0.03); near(dm(F[1],d),1+r,'and Overdue\'s damage on it with it',1e-9);
  secs(10); near(rec(L,F[1]).rise,0.59,'up to 10 s'); V.step(1); const i1=v.atkInterval;
  near(outRatio(L,F[1],{auto:true}),1.10,'Penalty Rate: basic attacks 2% x 5 more on an enemy in Arrears'); near(outRatio(L,F[0],{auto:true}),1,'not on another');
  near(inRatio(L,{src:F[1]}),0.94,'Debtor\'s Weakness: it deals 2% x 3 less to him'); near(hitOn(L,A[0],1000,{src:F[1]})/plainHit(L,()=>hitOn(L,A[0],1000,{src:F[1]})),0.94,'and to his allies');
  F[1].hp=F[1].maxHp/2; const h=F[1].hp; V.heal(F[1],1000); near(F[1].hp-h,1000*0.90,'Usury: it receives 2% x 5 less healing');
  F[1].dots.length=0; V.step(1); assert.ok(!mark(L,F[1],'arr'),'its notice ran out: out of Arrears'); near(rec(L,F[1]).rise,0,'and the rise starts again');
  near(v.atkInterval/i1,1.05,'Arrears Ledger: 1 enemy in Arrears was 1% x 5 attack speed',1e-6);
  debtor(L,F[0],6); od(L,F[0]); V.step(1); assert.equal(stack(L,'ioi'),2,'a second enemy');  od(L,F[1]); V.step(1); assert.equal(stack(L,'ioi'),2,'F1 again: each enemy once a wave');
  const a0=v.dmg; setStack(L,'ioi',0); V.step(1); near(a0/v.dmg,1+0.025*2,'Interest on Interest: 0.5% x 5 attack each');
});

test('Grimsby / Never Thrown Away keeps the rise when the notice runs out',()=>{
  const L=lab(H,S(['ci_1_1','ci_3_1']),{foes:2,big:true}), {F}=L; debtor(L,F[1],6); od(L,F[1]); odOf(L,F[1]).remaining=1000; secs(3); const r=rec(L,F[1]).rise; assert.ok(r>0.1);
  F[1].dots.length=0; V.step(1); assert.ok(!mark(L,F[1],'arr')); near(rec(L,F[1]).rise,r,'kept',1e-9); od(L,F[1]); V.step(1); assert.ok(mark(L,F[1],'arr')); assert.ok(rec(L,F[1]).rise>=r,'and it goes on from there');
});

test('Grimsby / Late Fee: Late Fee, Ink Stains, Final Notice, Garnished, No Grace Period, Collection Agent',()=>{
  const L=lab(H,S(['ci_1_4','ci_6_4','ci_12_4','ci_9_4','ci_10_4','ci_2_4']),{foes:2}), {v,F}=L; F[0].maxHp=F[0].hp=1e9;
  od(L,F[1]); const d=odOf(L,F[1]); const h0=F[1].hp, a0=F[1].armorRating; v.hp=v.maxHp*0.3; const vh=v.hp; secs(6.3);
  assert.ok(!(d.remaining>0)&&!F[1].dots.includes(d),'the notice ran out'); const all=h0-F[1].hp, fee=all-d._odD; near(fee,d._odD*0.3*(1+0.2),'Late Fee: 10% x 3 of what it dealt, Ink Stains 10% x 2 more',1e-6);
  near(v.hp-vh,fee*0.10,'Garnished: he heals 10% of it',1e-6); assert.ok(mark(L,F[1],'ngp'),'No Grace Period'); V.step(1); near(F[1].armorRating/a0,0.90,'armor 2% x 5 lower',1e-6);
  assert.equal(F[0]._debtStk,3,'Collection Agent: the nearest other enemy gains 1 x 3 Overdue'); assert.equal(tagged(L,F[0],'od').length,0,'(stacks, no notice)');
  F[1].hp=F[1].maxHp*0.4; od(L,F[1]); const d2=odOf(L,F[1]); const h1=F[1].hp; secs(6.3); near((h1-F[1].hp)-d2._odD,d2._odD*0.3*(1+0.2+0.3),'Final Notice: below 50% HP 10% x 3 more',1e-6);
  od(L,F[1]); secs(2); F[1].dots.length=0; const h2=F[1].hp; secs(5); assert.equal(F[1].hp,h2,'a notice cut short (cleansed) charges nothing');
});

test('Grimsby / Overdue upgrades: Heavier Notice, Dead Letter, Pinned Notices, Hounding, Two Centuries, Fine Print, Quick Quill, Standing Debt, Overdue Rent, Claim on Property',()=>{
  const L=lab(H,S(['ci_2_2','ne_10_3','ci_7_1','ci_7_4','ci_8_1','ci_4_2','ci_10_3','ci_12_1','ev_7_1','ne_2_4']),{foes:3,big:true}), {v,F}=L;
  near(skillRatio(L,F[1],'debtmark'),1.15*1.09*1.20,'Overdue\'s first hit on F1: Heavier Notice 3% x 5, Dead Letter 3% x 3, Pinned Notices 4% x 5');
  od(L,F[1]); near(skillRatio(L,F[1],'debtmark'),1.15*1.09*1.10,'after it: no Pinned Notices, and F1 carries Overdue: Hounding 2% x 5');
  assert.equal(F[1]._debtStk,1+3,'Standing Debt: his first Overdue on it adds 1 x 3 more'); const d=odOf(L,F[1]); near(d.dps,F[1]._debtDps*4,'its notice ticks for all 4');
  near(left(d),6+1.5,'Fine Print: 0.5 x 3 s longer'); near(dm(F[1],d),1.15*1.09*1.10*1.10,'its ticks: the two upgrades, Hounding, Two Centuries 2% x 5');
  od(L,F[1]); assert.equal(F[1]._debtStk,5,'not on the second'); near(outRatio(L,F[1]),1.10,'Hounding on his basic attacks too'); near(outRatio(L,F[2]),1,'not on an enemy with no notice');
  setMk(L,F[1],'served'); near(dm(F[1],d),1.15*1.09*1.10*1.10*1.15,'Overdue Rent: a Served enemy 3% x 5 more'); setMk(L,F[1],'lien'); near(dm(F[1],d),1.15*1.09*1.10*1.10*1.15*1.06,'Claim on Property: under a Lien 2% x 3');
  near(outRatio(L,F[1]),1.10*1.06,'(Claim on his hits too)'); const t0=FX.cd(v,'green',6); near(t0,6-0.9,'Quick Quill: 0.3 x 3 s off');
});

test('Grimsby / Compounding (PICK ONE), Deeper Debt, and the Arrears mark at 9',()=>{
  const L=lab(H,S(['ci_5_2','ci_6_2','ci_1_1']),{foes:2,big:true}), {F}=L; debtor(L,F[1],8); od(L,F[1]); assert.equal(F[1]._debtStk,9,'up to 9'); od(L,F[1]); assert.equal(F[1]._debtStk,9,'not 10');
  const d=odOf(L,F[1]); d.remaining=1000; near(dm(F[1],d),1+0.15*3/9,'Deeper Debt: each stack above 6 deals 3% x 5 more',1e-9);
  debtor(L,F[0],7); od(L,F[0]); odOf(L,F[0]).remaining=1000; V.step(2); assert.ok(!mark(L,F[0],'arr'),'8 is not Arrears under Compounding'); assert.ok(mark(L,F[1],'arr'),'9 is');
});

test('Grimsby / Settle Now (PICK ONE) and Paid in Full',()=>{
  const L=lab(H,S(['ci_5_3','ci_6_3']),{foes:2,big:true}), {v,F}=L; debtor(L,F[1],5); od(L,F[1]); assert.equal(F[1]._debtStk,6,'6: nothing settled yet'); assert.ok(odOf(L,F[1]));
  const d=odOf(L,F[1]), due=d.dps*left(d)*VMX('defMul')(v,F[1],'magic'); v.hp=v.maxHp*0.5; const vh=v.hp, h=F[1].hp; od(L,F[1]);
  assert.equal(F[1]._debtStk,0,'the next Overdue settles: its stacks clear'); assert.equal(tagged(L,F[1],'od').length,0,'no notice left');
  near(v.hp-vh,(due+d.dps*6*VMX('defMul')(v,F[1],'magic'))*0.09,'Paid in Full: he heals 3% x 3 of the debt (the old notice and the new one, all still to come)',1e-6);
  assert.ok(h-F[1].hp>due,'and it is paid at once');
});

test('Grimsby / Paper Cuts, Quarter Days, Rolled Over',()=>{
  const L=lab(H,S(['ci_3_4','ci_n1','ci_11_1','ci_1_1']),{foes:3,big:true}), {v,F}=L; let n=0;
  for(let i=0;i<200;i++){ const k=F[2]._debtStk||0; V.hit(v,F[2],10,{auto:true}); if((F[2]._debtStk||0)>k) n++; F[2]._debtStk=0; } assert.ok(n>25&&n<75,'Paper Cuts: 5% x 5 of basic attacks add 1 Overdue: '+n+' of 200');
  for(let i=0;i<50;i++) V.hit(v,F[2],10); assert.equal(F[2]._debtStk||0,0,'not a skill hit');
  od(L,F[1]); odOf(L,F[1]).remaining=1000; F[1].hp=F[1].maxHp*0.8; V.step(1); const k=F[1]._debtStk; F[1].hp=F[1].maxHp*0.7; V.step(1); assert.equal(F[1]._debtStk,k+1,'Quarter Days: it crossed 75%: 20% x 5 = always');
  F[1].hp=F[1].maxHp*0.6; V.step(1); assert.equal(F[1]._debtStk,k+1,'not without a crossing'); F[1].hp=F[1].maxHp*0.2; V.step(1); assert.equal(F[1]._debtStk,k+3,'50% and 25% at once: 2');
  F[0].hp=F[0].maxHp*0.8; V.step(1); F[0].hp=F[0].maxHp*0.7; V.step(1); assert.equal(F[0]._debtStk||0,0,'an enemy carrying no notice: nothing');
  debtor(L,F[1],6); V.step(1); assert.ok(mark(L,F[1],'arr')); F[0]._debtStk=0; kill(L,F[1]); assert.equal(F[0]._debtStk,6,'Rolled Over: an enemy in Arrears died: the nearest one takes its 6 stacks');
});

test('Grimsby / Interest Only (Compound Interest\'s share) and Dry Ink (near him = its 5 m)',()=>{
  let base; plain({foes:2},P=>{ od(P,P.F[0]); base=P.F[0].dots[P.F[0].dots.length-1].remaining; });
  const L=lab(H,S(['ci_5_4','ci_12_3']),{foes:2,big:true}), {v,F}=L; const i0=F.map(f=>f.atkInterval); od(L,F[0]); const d=F[0].dots[F[0].dots.length-1];
  const sh=VMX('SKLV.debtaura')(VMX('passLv')(v)); assert.equal(base,Math.round(6*(1+sh))); assert.equal(d.remaining,Math.round(6*(1+sh+0.15)),'Interest Only: 5% x 3 more on its share'); near(FX.num(v,'debtaura',0.2),0.35,'(its share: 0.2 + 0.05 x 3)');
  od(L,F[1]); V.step(2); near(F[0].atkInterval/i0[0],1/0.96,'Dry Ink: an enemy taking his DoT within 5 m attacks 2% x 2 slower',1e-6); near(F[1].atkInterval/i0[1],1,'not at 10 m',1e-9);
});

test('Grimsby / Final Demand and Served in Full',()=>{
  const L=lab(H,S(['ci_7_2','ci_9_2']),{foes:2,big:true}), {F}=L; ult(L); for(const f of F){ assert.equal(f._debtStk,3,'Foreclosure adds 3 Overdue'); assert.ok(odOf(L,f),'and serves a notice for them'); }
  const d=odOf(L,F[1]); near(left(d),6+2.5,'Served in Full: 0.5 x 5 s longer (F1, beyond Compound Interest)'); near(d.dps,F[1]._debtDps*3,'it ticks for 3');
});

test('Grimsby / The Rate He Set (SIGNATURE)',()=>{
  const L=lab(H,S(['ci_13_2','ci_1_1']),{foes:4,big:true}), {v,F}=L; at(L,F[3],0,6); debtor(L,F[0],6); od(L,F[0]); odOf(L,F[0]).remaining=1000; V.step(1);
  assert.ok(mark(L,F[0],'arr')); const r=rec(L,F[0]); r.tot=5e5; r.sec=9.5; const h=F[0].hp; secs(0.3); assert.ok(r.sec<10,'(not yet)'); near(h-F[0].hp>=0?1:0,1,'');
  const h1=F[0].hp; secs(0.3); assert.ok(h1-F[0].hp>=5e5-1,'at 10 s in Arrears: it takes all the Overdue damage it has taken, again');
  assert.equal(F[1]._debtStk,6,'F1 (1.5 m from it) falls into Arrears at 6'); assert.equal(F[3]._debtStk,6,'F3 (3.5 m) too'); assert.ok(!(F[2]._debtStk>0),'not F2 (7 m)');
  V.step(1); assert.ok(mark(L,F[1],'arr')&&mark(L,F[3],'arr')); const r1=rec(L,F[1]).rise; secs(1); near(rec(L,F[1]).rise-r1,0.05*2,'Arrears rises twice as fast on them',0.01);
  r.sec=20; const h2=F[0].hp; secs(21); assert.ok(h2-F[0].hp<5e5,'once every 25 s (not after 21 s)'); secs(4.5); assert.ok(F[0].hp<h2-5e5,'and again after 25 s');
});

/* ============================== EVICTION ============================== */
test('Grimsby / Served: Notice to Quit, Long Lease, Inspection, Ledger Weight, Served Twice, Wider Reach, Heavy Ledger, Witness',()=>{
  const L=lab(H,S(['ev_1_1','ev_2_1','ev_3_4','ci_4_3','ev_12_1','ev_4_2','ev_2_3','ev_10_1']),{foes:3,big:true,allies:1}), {v,F,A}=L; for(const f of F) free(f);
  at(L,F[0],3.5,0); at(L,F[1],0,4.7); const s0=F[1].speed=10, h=F[0].hp; slam(L);
  for(const f of [F[0],F[1]]){ assert.equal(f.forcedTarget,v,'Wider Reach: 4 + 0.3 x 3 m: F1 at 4.7 m is taunted'); assert.ok(mark(L,f,'served'),'Served'); near(f.silencedT,1.4+0.6,'Ledger Weight: its 1.4 s silence 0.2 x 3 s longer'); }
  near(L.v._tal.s.lsL.length,2,''); near(F[0]._talM[v.uid].served.until-V.now(),F[0].forcedTargetT+2+1.5,'Served for the taunt + 2 s + Long Lease 0.5 x 3',1e-9);
  near(h-F[0].hp,0.5*v.dmg*VMX('defMul')(v,F[0],'phys')*VMX('rageMul'),'Heavy Ledger: 10% x 5 of his attack through armor',1e-6); assert.ok(!mark(L,F[2],'served'),'not F2');
  near(hitOn(L,A[0],1000,{src:F[0]})/plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]})),0.90,'Notice to Quit: a Served enemy deals 2% x 5 less to everyone but him');
  near(inRatio(L,{src:F[0]}),0.925,'Inspection: 1.5% x 5 less to him (Notice to Quit not)'); V.step(1); near(F[1].speed/s0,0.90,'Witness: Served enemies move 2% x 5 slower',1e-6);
  for(const f of F) free(f); at(L,F[0],3.5,0); slam(L); near(F[0].silencedT,1.4+0.6+0.9,'Served Twice: caught again while Served: 0.3 x 3 s more');
  secs(F[0]._talM[v.uid].served.until-V.now()+0.1); assert.ok(!mark(L,F[0],'served'),'then it lapses');
});

test('Grimsby / the Served counts: Tenant\'s Burden, Paper Wall, Nobody Leaves the Building, Quill Hand, Tenants\' Rights, Desk Crowders, Drawn In',()=>{
  const L=lab(H,S(['ev_11_2','ev_4_3','ev_12_2','ev_12_3','ev_6_1','ev_6_2','ev_5_2']),{foes:6,big:true,allies:1}), {v,F,A}=L; const i0=v.atkInterval;
  setMk(L,F[0],'served'); V.step(1); assert.equal(stack(L,'srv'),1); near(inRatio(L,{src:F[3]}),0.95,'Tenant\'s Burden: 1% x 5 per Served'); near(i0/v.atkInterval,1.08,'Quill Hand: 4% x 2 faster');
  at(L,A[0],0,-3.6); near(hitOn(L,A[0],1000,{src:F[3]})/plainHit(L,()=>hitOn(L,A[0],1000,{src:F[3]})),0.955,'Tenants\' Rights: an ally within 4 m takes 1.5% x 3 less'); at(L,A[0],0,-11); near(hitOn(L,A[0],1000,{src:F[3]})/plainHit(L,()=>hitOn(L,A[0],1000,{src:F[3]})),1,'not 11 m away');
  setMk(L,F[1],'served'); V.step(1); near(inRatio(L,{src:F[3]}),0.90*0.94,'two Served: Paper Wall 2% x 3'); near(outRatio(L,F[3]),1,'');
  setMk(L,F[2],'served'); setMk(L,F[3],'served'); V.step(1); assert.equal(stack(L,'srv'),4); near(outRatio(L,F[3]),1.10,'three or more Served: his hits 2% x 5 more'); setMk(L,F[4],'served'); setMk(L,F[5],'served'); V.step(1); near(inRatio(L,{src:F[3]}),0.75*0.94,'six Served: Tenant Burden up to 5 (25%)'); near(0.80*0.94,0.80*0.94,'four Served: Tenant Burden 20%');
  near(outRatio(L,F[0],{auto:true}),1.10*1.15,'Desk Crowders: basic attacks 3% x 5 more on a Served enemy');
  for(const f of F) free(f); at(L,F[0],3.8,0); slam(L); near(F[0].forcedTargetT,2+VMX('edgeTauntPlus')(v,F[0])+1,'Drawn In: the taunt 1 s longer'); const sp=F[0].pullSpeed, need=(VMX('dist')(v,F[0])-F[0].r-v.r)/F[0].pullT; near(sp,need,'and the drag reaches him (all the way in its 2 s)',1e-9);
});

test('Grimsby / Kept Out (PICK ONE) and Barred Door',()=>{
  const L=lab(H,S(['ev_5_3','ev_7_3']),{foes:2,big:true}), {v,F}=L; for(const f of F) free(f); at(L,F[0],3.5,0); slam(L);
  assert.equal(F[0].forcedTarget,v,'still taunted'); assert.ok(F[0].pulledBy!==v,'not pulled'); assert.ok(F[0].pulledBy&&F[0].pulledBy.x>F[0].x,'pushed away from him (his nearest ally on his side)');
  near(F[0].pulledBy.x-F[0].x,2*V.METER,'2 m',1e-6); near(F[0].silencedT,1.4+1,'its silence 1 s longer'); near(F[0].slowMul,0.80,'Barred Door: slowed 4% x 5',1e-9); near(F[0].slow,2,'for 2 s');
});

test('Grimsby / the Deposit: Security Deposit, Fees Withheld, Refund Policy, Itemized, Deposit Returned, Escrow, Escrow Account, Cash Reserve',()=>{
  const L=lab(H,S(['ev_1_4','ev_2_4','ev_5_4','ev_6_4','ev_9_4','ev_8_4','ev_10_4','ev_12_4']),{foes:2,allies:1}), {v,F,A}=L; v.hp=v.maxHp;
  near(L.T.s.dep,v.maxHp*0.09,'Cash Reserve: the wave starts with 3% x 3 of his max HP',1e-9); L.T.s.dep=0; setMk(L,F[0],'served');
  near(hitOn(L,v,100,{src:F[0]}),91,'Security Deposit: 3% x 3 of a Served enemy\'s hit is withheld',1e-9); near(L.T.s.dep,9,'and kept'); near(hitOn(L,v,100,{src:F[1]}),100,'not from another');
  L.T.s.dep=v.maxHp*0.35-5; hitOn(L,v,1000,{src:F[0]}); near(L.T.s.dep,v.maxHp*0.35,'up to 20% + Fees Withheld 5% x 3 of his max HP',1e-9);
  const d0=v.dmg; V.step(1); near(v.dmg/d0,1.10,'Escrow: full, 2% x 5 attack',1e-6); v.hp=v.maxHp*0.5; const vh=v.hp; L.T.s.lim[Object.keys(L.T.s.lim).find(k=>k.indexOf('ev_10_4')===0)].acc=0; secs(1.05); near((v.hp-vh)/v.maxHp,0.01,'Escrow Account: 0.2% x 5 a second while it holds anything',1e-6);
  V.hit(F[1],A[0],10,{kind:'true'}); const dep=L.T.s.dep, h1=F[1].hp; A[0].hp=A[0].maxHp*0.35; V.step(1); near(L.T.s.dep,dep,'35%: not yet'); A[0].hp=A[0].maxHp*0.29; const ah=A[0].hp; V.step(1);
  near(A[0].hp-ah,dep*1.15,'an ally drops below 30%: the Deposit is refunded as healing, Refund Policy 5% x 3 more',1e-6); near(L.T.s.dep,0,'and emptied');
  near(h1-F[1].hp,dep*1.15,'Deposit Returned: the same amount on the enemy that last hit that ally',1e-6); assert.equal(A[0].stunned,0,'Itemized: 50% x 2 = always, one control removed (the lab\'s hold)');
  A[0].hp=A[0].maxHp*0.2; V.step(2); near(A[0].hp,A[0].maxHp*0.2,'nothing to refund: nothing',1e-9);
});

test('Grimsby / Doors Locked Behind Him (SIGNATURE)',()=>{
  const L=lab(H,S(['ev_13_2','ev_1_1']),{foes:4,big:true}), {v,F}=L; for(const f of F) free(f); at(L,F[0],3.5,0); at(L,F[1],0,3.6); at(L,F[2],-3.6,12); at(L,F[3],20,0); L.T.s.dep=0;
  slam(L); assert.ok(!win(L,'doors'),'two Served: not yet'); assert.ok(!mark(L,F[3],'served')); for(const f of F) free(f); at(L,F[0],3.5,0); at(L,F[1],0,3.6); at(L,F[2],-3.6,0);
  slam(L); for(const f of F) assert.ok(mark(L,f,'served'),'every enemy Served'); near(F[3].silencedT,2,'and silenced 2 s (F3 far away too)'); assert.ok(win(L,'doors'));
  near(inRatio(L,{src:F[3]}),0.70,'he takes 30% less'); const d=L.T.s.dep; hitOn(L,v,1000,{src:F[3]}); near(L.T.s.dep-d,700,'what they deal him goes into the Deposit (he still takes it), no limit');
  secs(4.05); assert.ok(!win(L,'doors'),'4 s'); for(const f of F) free(f); at(L,F[0],3.5,0); slam(L); near(F[3].silencedT,0,'once every 25 s');
});

test('Grimsby / Eviction Notice, Mass Eviction, Rent Strike, No Forwarding Address',()=>{
  const L=lab(H,S(['ev_7_2','ev_9_2','ev_11_1','ev_3_1']),{foes:3,big:true}), {v,F}=L; ult(L);
  for(const f of F){ assert.equal(f.forcedTarget,v,'Eviction Notice: every enemy Foreclosure serves is taunted onto him'); near(f.forcedTargetT,1.5+0.5,'for 1.5 + 0.1 x 5 s'); assert.ok(mark(L,f,'served')); }
  v.blueCd=8; kill(L,F[2]); near(v.blueCd,4,'Rent Strike: a Served enemy died: Ledger Slam\'s cooldown halved');
  const x0=F[0].x; F[0]._dash={x0:F[0].x,y0:F[0].y,x1:F[0].x+300,y1:F[0].y,t:0,dur:0.5,run(){}}; F[0].stunned=0; V.step(1); near(F[0]._dash?F[0]._dash.x1:F[0].x,x0,'a Served enemy\'s dash goes nowhere',1e-9);
  F[0]._dash=null; F[0].px=F[0].x; F[0].py=F[0].y; F[0].x+=5*V.METER; FX.tick(v,V.STEP); near(F[0].x,F[0].px,'a teleport is undone',1e-9);
  F[1].px=F[1].x; F[1].py=F[1].y; F[1]._talM[v.uid].served.until=0; F[1].x+=5*V.METER; const x1=F[1].x; FX.tick(v,V.STEP); near(F[1].x,x1,'not for an enemy that is not Served',1e-9);
});

test('Grimsby / damage reduction and stats: Old Paper, Paper Armor, Thick Walls, Unpaid, Cannot Die, Notice Paper, Cannot Pay, Ninety-One, Locked Doors, the 5% crit cap',()=>{
  const L=lab(H,S(['ci_11_3','ev_11_4','ev_8_1','ne_11_4','ne_4_3','ne_12_3','ne_8_1','ne_10_1','ev_3_3','ci_8_3','ne_8_3']),{foes:3,big:true}), {v,F}=L;
  near(inRatio(L),0.925*0.925,'Old Paper and Unpaid: abilities 1.5% x 5 less each (they multiply)'); near(inRatio(L,{auto:true}),0.925,'Paper Armor: basic attacks 1.5% x 5 less');
  v.hp=v.maxHp*0.45; near(inRatio(L,{auto:true}),0.925*0.90,'Thick Walls: below 50% 2% x 5'); v.hp=v.maxHp*0.25; near(inRatio(L,{auto:true}),0.925*0.90*0.91,'Cannot Die: below 30% 3% x 3'); v.hp=v.maxHp;
  fake(L,F[0],1,99,'fc'); near(inRatio(L,{auto:true,src:F[0]}),0.925*0.94,'Notice Paper: 3% x 2 less from an enemy carrying Foreclosure\'s bleed');
  fake(L,F[1],1,99,'od'); near(inRatio(L,{auto:true,src:F[1]}),0.925*0.925,'Cannot Pay: 1.5% x 5 less from one carrying Overdue');
  setStack(L,'entry',91); near(inRatio(L,{auto:true,src:F[2]}),0.925*(1-0.015*9),'Ninety-One: every 10 Entries 0.3% x 5');
  const P0=lab(H,S(['ci_8_3']),{foes:1}); const a=P0.v.glyphCrit; const P1=lab(H,null,{foes:1}); const b=P1.v.glyphCrit;
  near(a-b,0.05,'Clerk\'s Eye: 1% x 5'); const P2=lab(H,S(['ci_8_3','ne_8_3']),{foes:1}); near(P2.v.glyphCrit-b,0.05,'with Ink and Ash as well: still 5% in all (the cap)');
  const P3=lab(H,S(['ev_3_3']),{foes:1}); P3.v.stunned=0; ccOn(P3.F[0],P3.v,'stunned',2); const w=P3.v.stunned; const P4=lab(H,null,{foes:1}); P4.v.stunned=0; ccOn(P4.F[0],P4.v,'stunned',2); near(w/P4.v.stunned,0.80,'Locked Doors: controls 4% x 5 shorter');
});

/* ============================== NINETY-ONE ENTRIES ============================== */
test('Grimsby / Entries: In Grimsby, Column for People, The Fever Year, Rent Rolls, Columns Filled, Record Kept',()=>{
  const L=lab(H,S(['ne_1_1','ne_2_1','ne_6_1','ne_11_2','ne_12_1','ne_11_1']),{foes:5,big:true}), {v,F}=L;
  assert.equal(stack(L,'entry'),9,'Columns Filled: the fight starts with 3 x 3 Entries'); fake(L,F[0],1,99,'od'); kill(L,F[0]); assert.equal(stack(L,'entry'),10,'an enemy died carrying a notice: 1 Entry');
  fake(L,F[1],1,99,'fc'); kill(L,F[1]); assert.equal(stack(L,'entry'),11,'carrying Foreclosure\'s bleed'); kill(L,F[2]); assert.equal(stack(L,'entry'),11,'carrying nothing: none');
  setMk(L,F[3],'lien'); kill(L,F[3]); assert.equal(stack(L,'entry'),12,'Record Kept: one that dies under a Lien'); assert.equal(stack(L,'entryW'),3,'3 this wave');
  V.step(1); const a=v.dmg, hp=v.maxHp, ls=v.lifestealStat||0, ai=v.atkInterval; setStack(L,'entry',0); setStack(L,'entryW',0); V.step(1);
  near(a/v.dmg,1+0.0025*12,'In Grimsby: 0.05% x 5 attack an Entry'); near(hp/v.maxHp,1+0.0015*12,'Column for People: 0.05% x 3 max HP'); near(ls-(v.lifestealStat||0),0.0006*12,'The Fever Year: 0.02% x 3 lifesteal'); near(v.atkInterval/ai,1+0.005*3,'Rent Rolls: 0.1% x 5 attack speed per Entry this wave',1e-6);
  setStack(L,'entry',91); fake(L,F[4],1,99,'od'); kill(L,F[4]); assert.equal(stack(L,'entry'),91,'up to 91');
});

test('Grimsby / Ledger of the Dead, Tenants Remembered, Every Name Kept, Compounded Names',()=>{
  const L=lab(H,S(['ne_7_2','ne_9_2','ne_3_1','ne_4_1']),{foes:3,big:true}), {v,F}=L; setStack(L,'entry',25); od(L,F[0]); assert.equal(F[0]._debtStk,3,'Ledger of the Dead: 25 Entries: 1 + 2 stacks');
  const d=odOf(L,F[0]); near(d.dps,F[0]._debtDps*3,''); near(dm(F[0],d),(1+0.15*2/3)*(1+0.001*25),'Tenants Remembered: those 2 of its 3 stacks 3% x 5 more; Compounded Names 0.02% x 5 per Entry');
  assert.equal(F[1]._debtStk,3,'Every Name Kept: at 10 Entries Overdue also serves the enemy nearest its target'); assert.ok(odOf(L,F[1])); assert.ok(!(F[2]._debtStk>0),'only one more');
  setStack(L,'entry',9); const k1=F[1]._debtStk; od(L,F[2]); assert.equal(F[1]._debtStk,k1,'9 Entries: one enemy (F1, nearest F2, untouched)'); setStack(L,'entry',60); F[2]._debtStk=0; od(L,F[2]); assert.equal(F[2]._debtStk,4,'up to 3 more');
});

test('Grimsby / Lien: Lien, Debt Attached, Encumbered, Seized Assets, Bailiff, Lien Holder, Foreclosed, Debt Transfer, No Relief',()=>{
  const L=lab(H,S(['ne_1_4','ne_3_4','ne_n1','ne_5_4','ne_6_4','ne_10_4','ne_4_4','ne_7_4','ne_12_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; const a0=v.armorRating, s0=F.map(f=>f.speed=10), r0=F.map(f=>f.armorRating);
  ult(L); for(const f of F) assert.ok(mark(L,f,'lien')); near(F[0]._talM[v.uid].lien.until-V.now(),10+5,'Lien: 10 s + Debt Attached 1 x 5',1e-9); V.step(1);
  near(v.armorRating/a0,1.09,'Seized Assets: 1% x 3 armor per Liened enemy',1e-6); near(F[0].speed/s0[0],0.94,'Bailiff: 3% x 2 slower',1e-6); near(F[0].armorRating/r0[0],0.925,'Lien Holder: 1.5% x 5 less armor',1e-6);
  F[0].hp=F[0].maxHp/2; const h=F[0].hp; V.heal(F[0],1000); near(F[0].hp-h,880,'4% x 3 less healing'); F[0].shield=1000; V.step(1); near(F[0].shield,880,'shields on it 4% x 3 weaker'); V.step(1); near(F[0].shield,880,'(once)');
  near(hitOn(L,A[0],1000,{src:F[0]})/plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]})),0.925,'Encumbered: it deals 1.5% x 5 less to his allies');
  F[0].lifestealStat=0.5; F[0].hp=F[0].maxHp/2; let g=F[0].hp; V.hit(F[0],A[0],1000,{kind:'true'}); const ls1=F[0].hp-g; g=F[0].hp; plainHit(L,()=>V.hit(F[0],A[0],1000,{kind:'true'})); near(ls1/(F[0].hp-g),0.88*0.91*0.925,'No Relief: 3% x 3 less from lifesteal (and the Lien: 12% less healing)');
  F[2]._talM[v.uid].lien.until=0; at(L,F[2],12,0); v.hp=v.maxHp*0.5; const vh=v.hp; kill(L,F[1]); near((v.hp-vh)/v.maxHp,0.06,'Foreclosed: a Liened enemy died: he heals 2% x 3',1e-6);
  assert.ok(mark(L,F[2],'lien')); near(F[2]._talM[v.uid].lien.until-V.now(),5,'Debt Transfer: the nearest enemy (F2, 2 m from it) gets a Lien for 1 x 5 s',1e-9);
});

test('Grimsby / Foreclosure: Served Everywhere (PICK ONE) and Long Fever, Wider Service, Debt Never Ends, Total Foreclosure',()=>{
  const L=lab(H,S(['ne_5_2','ne_6_2','ne_2_2','ne_12_2','ne_9_4','ne_1_4']),{foes:2,big:true}), {v,F}=L; setStack(L,'entry',10); at(L,F[0],15,8);
  ult(L); const d=tagged(L,F[1],'fc')[0]; assert.equal(d.remaining,8,'Served Everywhere: its bleed 5 + 3 s (F1)'); near(dm(F[1],d),1.10*1.15*1.15,'Long Fever 2% x 5, Wider Service 3% x 5, Debt Never Ends 3% x 5 (10 Entries)');
  near(skillRatio(L,F[1],'aoedot'),1.15*1.15,'its hit too'); setStack(L,'entry',9); near(skillRatio(L,F[1],'aoedot'),1.15,'9 Entries: no Debt Never Ends');
  const r=rec(L,F[1]); secs(7.5); const fcD=r.fcD, h=F[1].hp; secs(0.6); near(h-F[1].hp,(r.fcD-fcD)+0.2*r.fcD,'Total Foreclosure: when it ends, a Liened enemy takes 20% of what the bleed dealt it, again',1e-6);
});

test('Grimsby / Served by Hand (PICK ONE) and Hand Delivered',()=>{
  const L=lab(H,S(['ne_5_3','ne_6_3']),{foes:4,big:true}), {v,F}=L; F[0].hp=F[0].maxHp*0.2; const h=F.map(f=>f.hp); ult(L);
  assert.equal(F[0].hp,h[0],'only the 3 enemies with the most HP are served: not F0'); assert.ok(!F[0].dots.some(d=>d.src===v),'no bleed on it');
  const d=tagged(L,F[1],'fc')[0]; near(d.dps,0.7*3*VMX('skillMul')(10)*v.dmg,'three times as strong',0.05); near(outRatio(L,F[1]),1.09,'Hand Delivered: his hits on them 3% x 3 more'); near(outRatio(L,F[0]),1,'');
});

test('Grimsby / The Ledger Corrected (SIGNATURE)',()=>{
  const L=lab(H,S(['ne_13_2','ne_1_1']),{foes:3,big:true}), {v,F}=L; setStack(L,'entry',20); ult(L);
  for(const f of F){ assert.equal(tagged(L,f,'fc').length,1); assert.equal(tagged(L,f,'fc2').length,1,'every enemy carries two bleeds'); }
  near(dm(F[1],tagged(L,F[1],'fc2')[0]),1.10,'each Entry 0.5% more (20)'); setStack(L,'entry',80); near(dm(F[1],tagged(L,F[1],'fc')[0]),1.30,'up to 30%');
  v.energy=0; setStack(L,'entry',20); kill(L,F[0]); assert.equal(stack(L,'entry'),22,'dying with both: 2 Entries'); near(v.energy,5,'and 5 energy (1 s off an ultimate with no cooldown)');
  for(let i=0;i<8;i++){ fake(L,F[2],1,99,'fc'); fake(L,F[2],1,99,'fc2'); F[2].alive=true; F[2].hp=1; V.dmg(F[2],100); } near(v.energy,25,'at most 25 a cast');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Grimsby: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['ci_1_1','ci_1_4','ci_3_4','ev_1_1','ev_1_4','ne_1_1','ne_1_4','ne_12_1']), TEAM=['vael','sylthaine','vireo','vex','grimsby'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let notes=0, lien=0, fee=0; const mx={}; const L0=s._tal; const run0=L0.on.lateFee; L0.on.lateFee=(run0||[]).concat([{key:'#t',id:'',do:[{fn:'__cnt'}]}]); L0.fn=Object.assign({},L0.fn,{__cnt(){ fee++; }});
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of units().filter(u=>u.team==='enemy')){ if((f.dots||[]).some(d=>d._talO===s.uid&&d._talK==='od')) notes++; const o=f._talM&&f._talM[s.uid]; if(o&&o.lien&&o.lien.until>V.now()) lien++; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', notice-ticks '+notes+', Liened enemy-ticks '+lien+', Late Fees '+fee);
  assert.ok(notes>0,'real notices made his'); assert.ok(fee>0,'a real notice charged its Late Fee'); assert.ok(lien>0,'a real Foreclosure put Liens down'); assert.ok(mx.entry>9,'a real death wrote an Entry');
  determinism(H,TEAM);
});

/* The page sites his talents added (the 'debtaura' num hook in pushDot, the o._only option in Foreclosure's aoedot case):
   with nothing learned, whole seeded fights with Grimsby in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Grimsby: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['grimsby','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __grN={ci:0,ult:0}; var __grD=_doEffectCore, __grP=pushDot;'+
    'pushDot=function(t,dps,dur){ if(t&&units.some(g=>g.alive&&g.pass&&g.pass.debtaura&&g.team!==t.team&&Math.hypot(g.x-t.x,g.y-t.y)<5*METER)) __grN.ci++; return __grP.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="grimsby"&&type==="aoedot") __grN.ult++; return __grD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__grN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.ci>0&&c.ult>0,'the fights pushed DoTs inside Compound Interest ('+c.ci+') and cast Foreclosure ('+c.ult+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__grD; pushDot=__grP;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong. */
const DEF={ ci:['ci_11_3','ci_6_1','ci_3_3','ci_1_1'],
            ev:['ev_11_2','ev_4_3','ev_3_4','ev_1_4','ev_8_1','ev_11_4','ev_13_2','ev_4_1','ev_5_1','ev_1_2','ev_3_3','ev_2_4'],
            ne:['ne_10_1','ne_4_3','ne_12_3','ne_8_1','ne_11_4','ne_5_4','ne_3_3','ne_1_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={ci:0,ev:1,ne:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (5 enemies Served and the attacker Served, in Arrears, under a Lien, carrying a notice and
   Foreclosure's bleed; below 30% HP; 91 Entries; the Deposit with room; inside Doors Locked Behind Him), as a normal hit and as a critical one, a basic attack and an ability */
function worstHit(list,kind,crit,auto){ const L=lab(H,list,{foes:5,cold:true}), {v,F}=L; V.step(1); const f=F[2], now=V.now();
  if(L.T){ for(const x of F){ const M=(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={}); M.served={t0:now,until:1e9,v:0}; M.lien={t0:now,until:1e9,v:0}; }
    const M=f._talM[v.uid]; M.arr={t0:now,until:1e9,v:0}; fake(L,f,1e-9,999,'od'); fake(L,f,1e-9,999,'fc');
    L.T.s.w.doors={t:99,n:1,cdT:0,at:-1,wave:false}; setStack(L,'entry',91); L.T.s.dep=0; }
  V.step(1); v.maxHp=1e5; v.hp=2.5e4; if(L.T) L.T.s.dep=0;
  const raw=1e3, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Grimsby: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[[['ev','ne'],[61,30]],[['ne','ev'],[61,30]],[['ev','ci'],[61,30]],[['ev'],[91]],[['ne'],[91]],[['ci'],[91]],[['ci','ev'],[61,30]],[['ne','ci'],[61,30]],[['ev','ne','ci'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const auto of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,auto)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="grimsby"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="grimsby"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','grimsby'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.ok(d.imm<d.ticks/2,'and he is not immune for half the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
