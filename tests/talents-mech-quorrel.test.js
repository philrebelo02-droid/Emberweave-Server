'use strict';
/* Quorrel's talents as data on the mechanics layer (talents-mech/quorrel.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity with him in the line-up, the stun-lock rule and his longest stun chain in seeded fights, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Quorrel, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12).
   Lab units are HELD (stunned 1e6), Quorrel too: to his talents a held enemy is stunned. free() frees the enemies (level 1, standing, not swinging) so a stun of
   his lands and counts as his. Lab skill level 10. Gag Order reaches every enemy whose centre is within 2.6 m of its target's centre (before and after the
   v1391 reach fix: the tests put enemies inside that measure). Run: node --test tests/talents-mech-quorrel.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='quorrel', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const q=L=>L.T.s.q;
const recL=(L,t,o)=>{ const e=q(L).e; let r=e[t.uid]; if(!r||r.u!==t) r=e[t.uid]={u:t,st:0,re:0,lk:0,bp:0,gv:0,sn:0,ts:0,tt:0,ow:0,hc:0,arm:0}; return Object.assign(r,o||{}); };
const rq=(L,t)=>{ const r=q(L).e[t.uid]; return (r&&r.u===t)?r:null; };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on him (true damage unless said)
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; };
const free=L=>{ for(const f of L.F){ f.stunned=0; f.fearT=0; f.silencedT=0; f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; } };
const hold=L=>{ for(const f of L.F){ f.stunned=1e6; } };
const castGO=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castCT=(L,t)=>V.cast(L.v,'blue',t||L.F[0]);
const castCS=(L,t)=>{ V.cast(L.v,'ult',t||L.F[0]); secs(0.4); };     // Contempt Storm, then its writs land (0.30 s)
const dmgOf=(t,fn)=>{ const h=t.hp+(t.shield||0); fn(); return h-t.hp-(t.shield||0); };
const ccOn=(src,t,field,s)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,s); } finally{ t.level=lv; } };
const api=L=>L.T.s.api;
const auOf=(L,x)=>L.T.s.au.find(e=>e.x===x);
const role=(f,r)=>{ f.t=Object.assign({},f.t,{role:r}); };
const rowOf=(f,r)=>{ f.t=Object.assign({},f.t,{row:r}); };
const sm10=()=>VMX('skillMul(10)');
const rnd=(L,x,fn)=>{ const E=api(L).eng(), r0=E.rnd; E.rnd=()=>x; try{ return fn(); } finally{ E.rnd=r0; } };

test('Quorrel: every talent is accounted for - 11 plain stats, 106 with rows, none waiting; no other game\'s names; the crit-damage talents at most 10% each',()=>{
  accounting(H,[117,11,106,0,0]);
  for(const id of ['oc_2_2','oc_12_4','oc_1_1','oc_6_1','sg_8_1','sg_6_2','sg_1_3','ed_2_3','ed_6_4','ed_9_4','ed_10_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  near(FXN.totals(H,[['sg_6_2',5]]).critDmg,0.10,'Paperwork: 2% x 5 (was 3%: 15%)'); near(FXN.totals(H,[['oc_6_1',2]]).critDmg,0.10,'Strict Reading'); near(FXN.totals(H,[['ed_6_4',2]]).critDmg,0.08,'Sharp Mind');
  assert.ok(/2% more damage per rank/.test(T.talent(H,'oc_8_4').text),'Procedure 2% a rank (10%)'); assert.ok(!FXN.has(H,'sg_5_4'),'Hammered is in the 5% crit group (rows)');
  for(const id of ['oc_13_3','sg_13_2','ed_13_2']) assert.ok(FXN.mech(H).talents[id],id);
});

test('Quorrel: his real kit, as the talents read it - Gag Order (stun 1.4 s, silence 1.05 s, centre-measured 2.6 m on its target), Contempt (2.45 s), Contempt Storm (6 writs together 0.30 s later), Tireless',()=>{
  plain({foes:4,big:true},P=>{ const {v,F}=P; free(P); at(P,F[1],4.5,2.4); at(P,F[2],4.5,-2.8);
    const h=F.map(f=>f.hp); castGO(P,F[0]); assert.ok(F[0].hp<h[0]&&F[1].hp<h[1],'Gag Order strikes its target and an enemy 2.4 m from its centre'); assert.equal(F[2].hp,h[2],'not one 2.8 m from it');
    near(F[0].stunned,1.4,'stunned 1.4 s (the area table 2.0 x 0.7)',1e-9); near(F[0].silencedT,1.05,'silenced 1.05 s (1.5 x 0.7)',1e-9);
    free(P); castCT(P,F[3]); near(F[3].stunned,2.45,'Contempt: its target stunned 2.45 s (3.5 x 0.7)',1e-9);
    hold(P); at(P,F[1],10,0); at(P,F[2],15.5,0); const g=F.map(f=>f.hp); V.cast(v,'ult',F[0]); assert.deepEqual(F.map(f=>f.hp),g,'Contempt Storm: nothing at the cast'); secs(0.4);
    assert.ok(F.every((f,i)=>f.hp<g[i]),'every enemy (4 of the 6 writs) is struck 0.30 s later, all together');
    assert.ok(v.passMul>0,'Tireless (rank 3+): passMul '+v.passMul); });
});

/* ============================== STUNS: PRECEDENT AND HOW LONG ============================== */
test('Quorrel / Precedent: from Gag Order\'s stuns; Long Record, Case Law, Bound by Precedent; his stuns longer (Precedent, Standing Order, Know the Docket, Silence in Court) to 4.0 s, never past 4.0 s in a row',()=>{
  const L=lab(H,S(['oc_1_3','oc_11_3','oc_2_3','oc_12_3','oc_8_3','oc_4_3','oc_5_3']),{foes:4,big:true}), {v,F}=L; free(L); at(L,F[1],4.5,2.4);
  castGO(L,F[0]); assert.equal(stack(L,'qPre'),2,'each enemy Gag Order stuns: 1 Precedent');
  near(F[0].stunned,1.4+0.2+0.4,'its stun: Standing Order 0.04 x 5 + Silence in Court 0.4 (no Precedent yet)',1e-9); near(F[1].stunned,1.4+0.1*1+0.2+0.4,'the next one: and 0.02 x 5 for 1 Precedent',1e-9);
  free(L); castCT(L,F[2]); near(F[2].stunned,2.45+0.1*2+0.2,'Contempt: 0.02 x 5 per Precedent, Standing Order (not Silence in Court)',1e-9); assert.equal(stack(L,'qPre'),2,'(Contempt sets none)');
  setStack(L,'qPre',0); V.step(1); const a0=v.dmg; setStack(L,'qPre',10); V.step(1); near(v.dmg,a0*(1+0.005*3*10),'Case Law: 0.5% x 3 attack each');
  setStack(L,'qPre',9); free(L); castGO(L,F[3]); assert.equal(stack(L,'qPre'),10,'Long Record: up to 5 + 1 x 5'); free(L); castGO(L,F[3]); assert.equal(stack(L,'qPre'),10,'(no more)');
  hold(L); setStack(L,'qPre',10); const p=plainHit(L,()=>dmgOf(F[0],()=>castGO(L,F[0]))); near(dmgOf(F[0],()=>castGO(L,F[0])),p*1.20,'Bound by Precedent: at full, Gag Order 4% x 5 more');
  setStack(L,'qPre',9); near(dmgOf(F[0],()=>castGO(L,F[0])),p,'(9 of 10: no)');
  const D=lab(H,S(['oc_n1','oc_1_3','oc_8_3','oc_11_3']),{foes:5,big:true}); role(D.F[1],'Mage'); role(D.F[2],'Support'); role(D.F[3],'Mage'); role(D.F[4],'Support'); V.wave(); V.step(1); free(D);
  castCT(D,D.F[0]); near(D.F[0].stunned,2.45+0.15*3+0.2,'Know the Docket: 0.05 x 3 for each Mage and Support in the line-up (4 there: up to 3)',1e-9);
  setStack(D,'qPre',10); free(D); castCT(D,D.F[1]); near(D.F[1].stunned,4.0,'all of it (2.45 + 0.45 + 0.2 + 1.0): 4.0 s at most',1e-9);
  free(D); V.step(1); setStack(D,'qPre',0); castCT(D,D.F[3]); near(D.F[3].stunned,2.45+0.45+0.2,'',1e-9); secs(2); castCT(D,D.F[3]); near(D.F[3].stunned,2.0,'a stun of his landing when he has held it 2 s already: cut to end at 4.0 s in a row',0.04);
  free(D); V.step(1); setStack(D,'qPre',10); castCT(D,D.F[2]); near(D.F[2].stunned,4.0,'',1e-9); secs(3); castCT(D,D.F[2]); near(D.F[2].stunned,1.0,'his stuns on one enemy never past 4.0 s in a row: a Contempt landing after 3 s is cut to end at 4.0 s',0.04);
  secs(1.05); castCT(D,D.F[2]); near(D.F[2].stunned,0,'and after a run that long, one inside the next 0.5 s is taken back',1e-9); secs(0.6); castCT(D,D.F[2]); near(D.F[2].stunned,4.0,'then they land again',1e-9);
});

/* ============================== CUT SHORT ============================== */
test('Quorrel / Cut Short: Let Me Stop You pushes the enemy\'s cooldowns, Mid-Sentence its next swing, Overruled its attack for 4 s',()=>{
  const L=lab(H,S(['oc_1_4','oc_2_4','oc_10_4']),{foes:3,big:true}), {F}=L; free(L); const f=F[0]; f.greenAb={cd:7}; f.blueAb={cd:9}; f.greenCd=3; f.blueCd=4; f.atkCd=1;
  castCT(L,f); near(f.greenCd,3+0.9,'its Green cooldown 0.3 x 3 s later'); near(f.blueCd,4+0.9,'its Blue too'); near(f.atkCd,1+0.45,'Mid-Sentence: its next basic attack 0.15 x 3 s later');
  const g=F[1]; g.greenCd=2; castCT(L,g); near(g.greenCd,2,'(an enemy with no Green skill: nothing to push)');
  V.step(2); const e=auOf(L,f); near(e&&e.ap.atk,1-0.05,'Overruled: its attack 1% x 5 lower'); secs(4.1); V.step(1); const e2=auOf(L,f); assert.ok(!e2||!e2.ap.atk||Math.abs(e2.ap.atk-1)<1e-12,'for 4 s');
});

/* ============================== DAMAGE REDUCTION: ONE GROUP ============================== */
test('Quorrel / damage reduction, one group of 25%: Bench Posture, Chamber Calm, Ink-Stained, No Sleep, Old Robes, Legal Tradition - each, multiplied, and all together',()=>{
  const L=lab(H,S(['oc_3_1']),{foes:3,big:true}), {F}=L; near(hitOn(L),plainHit(L,()=>hitOn(L)),'Bench Posture: an enemy he has not stunned - nothing');
  free(L); castCT(L,F[0]); near(hitOn(L),plainHit(L,()=>hitOn(L))*0.90,'an enemy he stunned: 2% x 5 less'); near(rq(L,F[0]).bp,2.45+3,'until 3 s after the stun ends',1e-9);
  F[0].stunned=0; secs(5.6); near(hitOn(L),plainHit(L,()=>hitOn(L)),'then not');
  const C=lab(H,S(['oc_10_2','sg_8_3','ed_6_1']),{foes:2,big:true}); near(hitOn(C),plainHit(C,()=>hitOn(C))*0.97*0.97*0.955,'Chamber Calm 1% x 3, Ink-Stained 1% x 3, No Sleep 1.5% x 3 (multiplied)');
  const M=lab(H,S(['ed_5_1','ed_11_4']),{foes:2,big:true}); recL(M,M.F[0],{ts:2,tt:5});
  near(hitOn(M,1000,{kind:'magic'}),plainHit(M,()=>hitOn(M,1000,{kind:'magic'}))*0.925,'Old Robes: magic damage from an enemy with Testimony 1.5% x 5 less'); near(hitOn(M,1000,{kind:'phys'}),plainHit(M,()=>hitOn(M,1000,{kind:'phys'})),'(not physical)');
  near(hitOn(M,1000,{kind:'magic',src:M.F[1]}),plainHit(M,()=>hitOn(M,1000,{kind:'magic',src:M.F[1]})),'(not from an enemy without Testimony)');
  const t0=M.F[1].t; rowOf(M.F[1],'Back'); near(hitOn(M,1000,{src:M.F[1]}),plainHit(M,()=>hitOn(M,1000,{src:M.F[1]}))*0.925,'Legal Tradition: from the back row 1.5% x 5 less'); M.F[1].t=Object.assign({},t0,{row:'Front'}); near(hitOn(M,1000,{src:M.F[1]}),plainHit(M,()=>hitOn(M,1000,{src:M.F[1]})),'(not the front row)');
  const X=lab(H,S(['oc_3_1','oc_10_2','sg_8_3','ed_6_1','ed_5_1','ed_11_4']),{foes:2,big:true}); rowOf(X.F[0],'Back'); recL(X,X.F[0],{bp:5,ts:3,tt:5});
  near(hitOn(X,1000,{kind:'magic'}),plainHit(X,()=>hitOn(X,1000,{kind:'magic'}))*0.75,'all of them at once (0.90 x 0.97 x 0.97 x 0.955 x 0.925 x 0.925 = 0.69): never more than 25% off a hit');
  near(X.T.fn.drK(api(X),X.T,X.v,X.F[0],'magic'),0.75,'(the pure function the 95% check reads)');
});

/* ============================== HIS SKILLS ============================== */
test('Quorrel / Gag Order: Wider Seal, Firm Hand, Minor Offence, Gavel Rain; Clear the Gallery and Removed',()=>{
  const L=lab(H,S(['oc_4_3','oc_4_2','sg_6_4','sg_11_2','sg_12_2','sg_1_1']),{foes:4,big:true}), {F}=L; at(L,F[1],4.5,3.0); at(L,F[2],4.5,-3.3);
  const h1=F[1].hp, h2=F[2].hp; castGO(L,F[0]); assert.ok(F[1].hp<h1,'Wider Seal: 2.6 + 0.2 x 3 m reaches an enemy 3.0 m from its centre'); assert.equal(F[2].hp,h2,'(not 3.3 m)');
  for(const k in q(L).e) q(L).e[k].gv=0; const p=plainHit(L,()=>dmgOf(F[0],()=>castGO(L,F[0])));
  for(const k in q(L).e) q(L).e[k].gv=0; near(dmgOf(F[0],()=>castGO(L,F[0])),p*1.15*1.10,'Firm Hand 5% x 3, Minor Offence 5% x 2 (each multiplies)');
  for(const k in q(L).e) q(L).e[k].gv=0; recL(L,F[3],{gv:5}); recL(L,F[2],{gv:5}); near(dmgOf(F[0],()=>castGO(L,F[0])),p*1.15*1.10*(1+0.05*2),'Gavel Rain: 1% x 5 more for each Gavel on the field (2)');
  const G=lab(H,S(['oc_5_2','oc_6_2']),{foes:3,big:true}); free(G); G.F[0].level=1; castGO(G,G.F[0]); const f=G.F[0];
  assert.ok(f.pulledBy&&f.pullT>0,'Clear the Gallery: the enemy it hits is pushed'); near(Math.hypot(f.pulledBy.x-G.v.x,f.pulledBy.y-G.v.y)/V.METER,4.5+2,'2 m away from Quorrel',1e-6);
  near(f.slow,2,'Removed: and slowed for 2 s'); near(f.slowMul,1-0.18,'by 6% x 3');
  const I=lab(H,S(['oc_5_2','oc_6_2']),{foes:3,big:true}); free(I); I.F[0].immovable=true; castGO(I,I.F[0]); assert.ok(!I.F[0].pulledBy,'(one that cannot be moved is not pushed)'); assert.ok(!(I.F[0].slow>0),'(nor slowed)');
});

test('Quorrel / Contempt: Not Finished, Held in Contempt, Gavel Down, Contempt Twice (the stun-lock rule), Contempt of Court',()=>{
  const L=lab(H,S(['oc_3_4','oc_9_3','oc_10_3']),{foes:3,big:true}), {F}=L; free(L); const f=F[0]; f.greenAb={cd:7}; f.blueAb={cd:9}; f.greenCd=6.6; f.blueCd=2; f._pend={t:0.2,spell:true};
  castCT(L,f); near(f.greenCd,7,'Not Finished: the enemy was casting (its Green pressed 0.4 s ago): that cooldown starts over'); near(f.blueCd,2,'(the other one untouched)'); f._pend=null;
  const g=F[1]; g.greenAb={cd:7}; g.greenCd=6.6; castCT(L,g); near(g.greenCd,6.6,'(not casting: nothing)');
  free(L); castCT(L,f); secs(2.5); near(f.slow,2-(2.5-2.45),'Held in Contempt: when its stun ends, slowed for 2 s',0.05); near(f.slowMul,0.70,'by 30%');
  hold(L); const p=plainHit(L,()=>dmgOf(F[2],()=>castCT(L,F[2]))); near(dmgOf(F[2],()=>castCT(L,F[2])),p*1.15,'Gavel Down: 5% x 3 more');
  const C=lab(H,S(['oc_7_4']),{foes:4,big:true}); free(C); at(C,C.F[1],4.5,4.5); const d0=dmgOf(C.F[0],()=>{}); const h1=C.F[1].hp, h2=C.F[2].hp;
  const d=dmgOf(C.F[0],()=>castCT(C,C.F[0])); near(h1-C.F[1].hp,0.5*d,'Contempt Twice: the nearest other enemy within 3 m takes half of its damage',1e-6); near(C.F[1].stunned,2.45,'and is stunned as long as Contempt\'s own stun',1e-9);
  assert.equal(C.F[2].hp,h2,'(not one farther)'); free(C); C.F[1].stunned=0.3; castCT(C,C.F[0]); near(C.F[1].stunned,0.3,'(the stun-lock rule: not on an enemy already stunned)',1e-9);
  free(C); recL(C,C.F[1],{lk:0.3}); castCT(C,C.F[0]); near(C.F[1].stunned,0,'(nor within 0.5 s after his stun on it ended)',1e-9);
  C.F[1].hp=0; C.F[1].alive=false; free(C); at(C,C.F[3],4.5,-(3.6+V.bodyR(C.F[0])+V.bodyR(C.F[3]))); const h3=C.F[3].hp; castCT(C,C.F[0]); assert.equal(C.F[3].hp,h3,'(the next nearest is 3.6 m away: no second strike)');
  const K=lab(H,S(['ed_7_1','ed_1_2']),{foes:3,big:true}), k=K.F; recL(K,k[1],{ts:3,tt:9}); const c1=k[1].hp, c0=k[0].hp; K.v.target=k[0];
  castCT(K,k[0]); assert.ok(k[1].hp<c1&&k[0].hp===c0,'Contempt of Court: it strikes the enemy with the most Testimony'); assert.equal(K.v.target,k[0],'and his own target is put back');
  recL(K,k[2],{ts:3,tt:9}); const e2=k[2].hp, e1=k[1].hp; castCT(K,k[2]); assert.ok(k[2].hp<e2&&k[1].hp===e1,'(a tie: his own target)'); recL(K,k[2],{ts:0,tt:0});
  const pc=plainHit(K,()=>dmgOf(k[2],()=>castCT(K,k[2]))); recL(K,k[2],{ts:4,tt:9}); recL(K,k[1],{ts:0,tt:0}); near(dmgOf(k[2],()=>castCT(K,k[2])),pc*(1+0.08*4)*(1+0.006*5*4),'8% more for each Testimony on it (with At Extraordinary Length\'s 0.6% x 5 each)');
});

test('Quorrel / his hits: Writs, Rap of the Gavel, Rapid Rulings; Strike From the Record, Verdict, Procedure (stunned enemies); Court Seal and Through the Shell; Long Session',()=>{
  const L=lab(H,S(['oc_7_2','sg_11_1','ed_4_3','oc_9_1','sg_9_3','oc_8_4','sg_10_2']),{foes:3,big:true}), {F}=L;
  near(myHit(L,F[0],{auto:true}),1000*1.10*1.10*1.09*1.10*1.10,'basic attacks: 2% x 5, 2% x 5, 3% x 3 more (and a held enemy is stunned: Strike From the Record and Verdict 2% x 5 each)');
  free(L); near(myHit(L,F[0]),1000,'(an enemy that is not stunned, not a basic attack: plain)'); hold(L);
  near(myHit(L,F[0],{crit:true}),plainHit(L,()=>myHit(L,F[0],{crit:true}))*1.10*1.10*1.10,'Procedure: his critical hits on a stunned enemy 2% x 5 more');
  q(L).wt=14.9; near(myHit(L,F[0]),1000*1.21,'Long Session: not before the wave has lasted 15 s'); q(L).wt=15.1; near(myHit(L,F[0]),1000*1.21*1.075,'then 1.5% x 5 more'); V.wave(); V.step(1); near(myHit(L,F[0]),1000*1.21,'(a new wave starts again)');
  const A=lab(H,S(['oc_3_2','sg_3_3']),{foes:2,big:true}), f=A.F[0]; f.armorRating=800; const m0=VMX('defMul')(A.v,f,'phys'); A.v._wpnArmIgn=0.10; const m1=VMX('defMul')(A.v,f,'phys'); A.v._wpnArmIgn=0;
  const p=plainHit(A,()=>myHit(A,f,{kind:'phys'})); near(myHit(A,f,{kind:'phys'}),p*(m1/m0)*(m1/m0),'Court Seal, Through the Shell: his hits ignore 2% x 5 of the armour each (their shares multiply)',1e-6);
});

test('Quorrel / stats on conditions: Chitin Robes (an enemy held by his stun), Court Chitin (3 Gavels), Chitin Plates (above 50% HP), Insomnia, Tireless Hands, Brisk Step / Bustling / Quick March',()=>{
  const P0=lab(H,null,{foes:4,big:true}), mr0=P0.v.mrRating, ar0=P0.v.armorRating, ai0=P0.v.atkInterval, ls0=P0.v.lifestealStat||0, sp0=P0.v.speed;
  const L=lab(H,S(['oc_5_4','sg_5_1','sg_1_1','ed_3_3','ed_12_1','ed_8_2','oc_5_1','sg_2_3','ed_5_4']),{foes:4,big:true}), {v,F}=L; v.hp=v.maxHp*0.45; V.step(1);
  near(v.mrRating,mr0,'Chitin Robes: no enemy held by him - nothing'); near(v.armorRating,ar0,'(below 50% HP, no Gavels: no armour)'); near(v.atkInterval,ai0,'(45% HP: no Insomnia)');
  near(v.lifestealStat-ls0,0.05,'Tireless Hands: 1% x 5 lifesteal'); near(v.speed,sp0*(1+0.09+0.09+0.09),'Brisk Step, Bustling, Quick March: 3% x 3 faster each');
  free(L); castCT(L,F[0]); V.step(1); near(v.mrRating,mr0*1.10,'an enemy held by his stun: 2% x 5 magic resist'); F[0].stunned=0; V.step(2); near(v.mrRating,mr0,'(his stun over: gone)'); rq(L,F[0]).gv=0; recL(L,F[1],{gv:5}); recL(L,F[2],{gv:5}); V.step(1); assert.ok(Math.abs(v.armorRating-ar0)<1e-6,'(1 + 2 Gavels: no)');
  recL(L,F[3],{gv:5}); V.step(1); near(v.armorRating,ar0*1.10,'Court Chitin: 3 Gavels on the field, 2% x 5 armour'); v.hp=v.maxHp*0.6; V.step(1); near(v.armorRating,ar0*1.20,'Chitin Plates: above 50% HP, 2% x 5 armour (stat rows add: 20%)');
  v.hp=v.maxHp*0.39; V.step(1); near(v.atkInterval,ai0/1.12,'Insomnia: below 40% HP, 4% x 3 faster'); v.hp=v.maxHp; V.step(1); near(v.atkInterval,ai0,'(not above)');
});

/* ============================== TIRELESS AND DAYS ============================== */
test('Quorrel / Tireless: Six Hands, Tireless Arms, Not Slept (1 point each a rank), Still in Session (11 Days: 40% of its strength)',()=>{
  const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval, pm=P0.v.passMul, F=0.25*pm;
  const L=lab(H,S(['oc_9_2','sg_7_3','ed_3_4']),{foes:2,big:true}); near(L.v.atkInterval,ai0*(1+F)/(1+F+0.15),'three of them at 5: Tireless 15 points more');
  const W=lab(H,S(['ed_3_1','ed_1_1']),{foes:2,big:true}); setStack(W,'qDay',10); V.step(1); const a10=W.v.atkInterval; setStack(W,'qDay',11); V.step(1);
  near(W.v.atkInterval,a10*(1+0.012*10)/(0.012*11+(1+0.40*pm)/(1+F)),'Still in Session: at 11 Days Tireless is 40% x its strength (60% stronger; the attack-speed rows add)',1e-6);
  const N=lab(H,S(['oc_9_2']),{foes:2,big:true}); near(N.v.atkInterval,ai0*(1+F)/(1+F+0.05),'Six Hands alone'); N.v.passMul=undefined; V.step(1); near(N.v.atkInterval,ai0,'(nothing without the passive)',1e-6);
});

test('Quorrel / Days: one each wave and each 10 s he fights (max 11, for the fight); Unadjourned; Eleven Days, The Twelfth Day, Day Follows Day',()=>{
  const L=lab(H,S(['ed_1_1','ed_2_1','ed_10_1','ed_7_4']),{foes:2,big:true,cold:true}), {v}=L; V.step(1); L.T=v._tal; assert.equal(stack(L,'qDay'),1+5,'the first wave: 1 Day, and Unadjourned\'s 1 x 5');
  V.wave(); V.step(1); assert.equal(stack(L,'qDay'),7,'each wave 1 more (Unadjourned only once)'); secs(9.8); assert.equal(stack(L,'qDay'),7,''); secs(0.4); assert.equal(stack(L,'qDay'),8,'and each 10 s he fights');
  setStack(L,'qDay',0); V.step(1); const ai=v.atkInterval, hp=v.maxHp, atk=v.dmg; setStack(L,'qDay',11); V.step(1);
  near(v.atkInterval,ai/(1+0.012*11),'Eleven Days: 0.4% x 3 attack speed a Day'); near(v.maxHp,hp*(1+0.009*11),'The Twelfth Day: 0.3% x 3 max HP'); near(v.dmg,atk*(1+0.015*11),'Day Follows Day: 0.3% x 5 attack');
  for(let i=0;i<3;i++){ V.wave(); V.step(1); } assert.equal(stack(L,'qDay'),11,'max 11');
});

/* ============================== CRIT, SLOWS, CONTROLS, COOLDOWNS ============================== */
test('Quorrel / the crit group (5% at most): Hammered, Restless as a stat; Long Hearing, Heavy Docket, Cross-Examine as one seeded roll on the hit',()=>{
  const P0=lab(H,null,{foes:2,big:true}), c0=P0.v.glyphCrit||0;
  const L=lab(H,S(['sg_5_4','ed_7_3','ed_1_1']),{foes:2,big:true}); setStack(L,'qDay',2); V.step(1); near((L.v.glyphCrit||0)-c0,0.05,'Hammered 1% x 5 and Restless 0.2% x 5 per Day (2): 7% - held at 5%');
  setStack(L,'qDay',0); V.step(1); near((L.v.glyphCrit||0)-c0,0.05,'Hammered alone: 5%');
  const L3=lab(H,[['sg_5_4',3]],{foes:2,big:true}); near((L3.v.glyphCrit||0)-c0,0.03,'Hammered 3 of 5: 3%');
  const R=lab(H,S(['ed_7_3','ed_1_1']),{foes:2,big:true}); setStack(R,'qDay',3); V.step(1); near((R.v.glyphCrit||0)-c0,0.003*0+0.001*5*3*2,'Restless: 0.2% x 5 per Day (3: 3%)');
  const C=lab(H,S(['oc_6_4','sg_9_1','sg_1_1','ed_4_2','ed_1_2']),{foes:3,big:true}), f=C.F[0], g=C.F[1]; free(C); C.v.glyphCrit=0;
  const ask=(t,auto,x)=>rnd(C,x,()=>{ const c={u:C.v,src:C.v,tgt:t,auto,force:false}; C.T.fn.crit(api(C),C.T,C.v,c); return c.force; });
  assert.ok(!ask(f,true,0),'none of their conditions: no extra crit (and no draw)'); f.stunned=1; assert.ok(ask(f,false,0.049)&&!ask(f,false,0.051),'Long Hearing: a stunned enemy, 3% x 3 = 9% - held at 5%');
  f.stunned=0; recL(C,g,{gv:5}); assert.ok(ask(g,true,0.049)&&!ask(g,true,0.051),'Heavy Docket: a basic attack on a Gavel holder 2% x 5 - held at 5%'); assert.ok(!ask(g,false,0),'(not a skill)');
  recL(C,f,{ts:5,tt:5}); assert.ok(ask(f,true,0.049)&&!ask(f,true,0.051),'Cross-Examine: at 5 Testimony 4% x 3 - held at 5%'); recL(C,f,{ts:4}); assert.ok(!ask(f,true,0),'(4: no)');
  const D=lab(H,S(['sg_5_4','oc_6_4']),{foes:2,big:true}); D.F[0].stunned=1; const ok=x=>rnd(D,x,()=>{ const c={u:D.v,src:D.v,tgt:D.F[0],auto:false,force:false}; D.T.fn.crit(api(D),D.T,D.v,c); return c.force; });
  D.v.glyphCrit=0.05; assert.ok(!ok(0),'with Hammered\'s 5% already: no more on the hit');
});

test('Quorrel / slows and controls on him: Unhurried Voice, Rules of Court, Never Slows (40% at most); Steady Bench and Nobody Said It (50% at most)',()=>{
  const L=lab(H,S(['oc_11_1','sg_12_1','ed_1_4']),{foes:2,big:true}), {v,F}=L; v.slow=0; v.slowMul=null; ccOn(F[0],v,'slow',2); const m=VMX('slowMulFor')(F[0].level); near(v.slowMul,m,'(the slow as the game writes it)');
  V.step(1); near(v.slowMul,1-(1-m)*0.60,'0.8 x 0.76 x 0.8 = 0.49 weaker would be - held at 40% weaker',1e-9); V.step(3); near(v.slowMul,1-(1-m)*0.60,'(once for each new slow)',1e-9);
  const U=lab(H,S(['oc_11_1']),{foes:2,big:true}); U.v.slow=0; U.v.slowMul=null; ccOn(U.F[0],U.v,'slow',2); V.step(1); near(U.v.slowMul,1-(1-m)*0.80,'Unhurried Voice alone: 4% x 5 weaker',1e-9);
  const C=lab(H,S(['ed_4_1','ed_9_2']),{foes:2,big:true}), w=C.v; w.stunned=0; ccOn(C.F[0],w,'stunned',1); near(w.stunned,V.ccNerf*0.50,'a stun above 50% HP: Steady Bench 20% x Nobody Said It 50% = 60% - held at 50%',1e-9);
  w.hp=w.maxHp*0.4; w.stunned=0; ccOn(C.F[0],w,'stunned',1); near(w.stunned,V.ccNerf*0.80,'below 50% HP: Steady Bench 4% x 5 only',1e-9); w.hp=w.maxHp; w.fearT=0; ccOn(C.F[0],w,'fearT',1); near(w.fearT,V.ccNerf*0.80,'(a fear: Steady Bench)',1e-9);
});

test('Quorrel / cooldowns: Quick Seal, Quick Rulings, Recess Denied (Gag Order, 5 s at least); Swift Ruling, Ruling Hand, Eleven Is Enough (Contempt, 4 s at least); Sustained',()=>{
  const L=lab(H,S(['oc_6_3','sg_11_3','ed_8_3','oc_7_1','sg_4_3']),{foes:2,big:true}), {v}=L;
  near(FX.cd(v,'green',10),10-1-1-1.2,'Gag Order 0.2 x 5, 0.2 x 5, 0.4 x 3 s shorter'); near(FX.cd(v,'green',7),5,'never under 5 s'); near(FX.cd(v,'blue',8),8-0.75-0.9,'Contempt 0.15 x 5, 0.3 x 3 s shorter');
  const E=lab(H,S(['ed_11_1','ed_1_1','oc_7_1']),{foes:2,big:true}); setStack(E,'qDay',10); near(FX.cd(E.v,'blue',8),8-0.75,'Eleven Is Enough: not at 10 Days'); setStack(E,'qDay',11); near(FX.cd(E.v,'blue',8),4,'at 11 Days halved (3.6 s) - never under 4 s');
  const U=lab(H,S(['oc_11_4']),{foes:3,big:true}); free(U); at(U,U.F[1],4.5,2.4); FX.cd(U.v,'blue',8); q(U).bcE=6; U.v.blueCd=2.5; castGO(U,U.F[0]); near(U.v.blueCd,0.5,'Sustained: each enemy Gag Order stuns (2): 1 s off Contempt\'s cooldown');
  free(U); q(U).bcE=1; U.v.blueCd=4; castGO(U,U.F[0]); near(U.v.blueCd,3,'never under 4 s counted from Contempt\'s cast (cast 1 s ago: 3 s left)'); free(U); q(U).bcE=1; U.v.blueCd=2; castGO(U,U.F[0]); near(U.v.blueCd,2,'(and never longer)');
});

/* ============================== THE COURT IS IN SESSION ============================== */
test('Quorrel / The Court Is in Session (SIGNATURE): Gag Order stuns 2+ - every enemy within 6 m stunned 1 s (the stun-lock rule) and Cut Short, Contempt ready, 5 s of Precedent from every stun; once every 25 s, counted down across a wave',()=>{
  const L=lab(H,S(['oc_13_3','oc_1_4','oc_1_3']),{foes:5,big:true}), {v,F}=L; free(L); at(L,F[1],4.5,2.4); at(L,F[2],0,6); at(L,F[3],0,10.4); at(L,F[4],0,-6); F[4].stunned=0.2; for(const f of F){ f.greenAb={cd:7}; f.greenCd=1; }
  v.blueCd=5; castGO(L,F[2]); assert.equal(stack(L,'qPre'),1,'(Gag Order stunned 1: no court)'); near(v.blueCd,5,''); free(L); F[4].stunned=0.2; for(const f of F) f.greenCd=1;
  castGO(L,F[0]); near(F[0].stunned,1.4+0.1,'Gag Order\'s own stun stays (1 Precedent: 0.1 s longer; the court\'s 1 s does not land on an enemy already stunned)',1e-9); near(F[2].stunned,1+0.3,'an enemy within 6 m that was not stunned: 1 s (and 3 Precedents by then)',1e-9);
  near(F[3].stunned,0,'(not one 7 m away)'); near(F[4].stunned,0.2,'(nor one already stunned)'); near(F[2].greenCd,1+0.9,'Cut Short on every enemy within 6 m (by its stun)'); near(F[4].greenCd,1+0.9,'(or by the court where the stun did not land)'); near(F[3].greenCd,1,''); near(F[0].greenCd,1+0.9+0.9,'(Gag Order\'s own stun, then the court)');
  near(v.blueCd,0,'Contempt is ready at once'); setStack(L,'qPre',0); const p0=0; free(L); castCT(L,F[3]); assert.equal(stack(L,'qPre'),p0+1,'for 5 s every stun of his sets a Precedent');
  secs(5.1); free(L); castCT(L,F[3]); assert.equal(stack(L,'qPre'),p0+1,'(then not)');
  free(L); at(L,F[1],4.5,2.4); v.blueCd=5; castGO(L,F[0]); near(v.blueCd,5,'once every 25 s');
  const W=lab(H,S(['oc_13_3']),{foes:4,big:true}); free(W); at(W,W.F[1],4.5,2.4); W.v.blueCd=5; castGO(W,W.F[0]); near(W.v.blueCd,0,''); secs(10);
  V.wave(); VMX('battleTime=0'); V.step(1); secs(14.6); free(W); at(W,W.F[0],4.5,0); at(W,W.F[1],4.5,2.4); W.v.blueCd=5; castGO(W,W.F[0]); near(W.v.blueCd,5,'the 25 s count down across a wave whose clock restarts at 0 (24.7 s: not yet)');
  secs(0.5); free(W); at(W,W.F[0],4.5,0); at(W,W.F[1],4.5,2.4); W.v.blueCd=5; castGO(W,W.F[0]); near(W.v.blueCd,0,'25.2 s later: again (an absolute time would wait for the new wave\'s clock) '+JSON.stringify({s1:q(W).s1,goN:q(W).goN,st:W.F.map(f=>+(f.stunned||0).toFixed(2)),ended:V.ended(),now:V.now()}));
});

/* ============================== GAVELS ============================== */
test('Quorrel / Gavels: All Six (from every stun, 6 on the field at most), Laid Down, Gavel to the Head, Weighty Gavel, Down Comes the Gavel, Order Restored, Unused Gavel (the healing budget)',()=>{
  const L=lab(H,S(['sg_1_1','sg_2_1','sg_7_1','sg_6_1','sg_3_1','sg_10_1']),{foes:9,big:true}), {v,F}=L; free(L);
  castCT(L,F[0]); near(rq(L,F[0]).gv,8+3,'each stun of his leaves a Gavel: 8 s, Laid Down 1 x 3 longer'); near(myHit(L,F[0],{auto:true}),1000*1.15,'All Six: his basic attacks on it 3% x 5 more'); near(myHit(L,F[1],{auto:true}),1000,'(not another)');
  for(let i=1;i<6;i++) recL(L,F[i],{gv:5+i}); recL(L,F[0],{gv:3}); V.step(1); assert.equal(L.T.fn.gvN(api(L),L.T),6,'6 on the field');
  const a0=v.dmg; free(L); castCT(L,F[6]); assert.equal(L.T.fn.gvN(api(L),L.T),6,'a 7th stun: still 6'); assert.ok(!(rq(L,F[0]).gv>0),'the one with the least time left is pushed out'); assert.ok(rq(L,F[6]).gv>10,'');
  V.step(1); near(v.dmg,a0,'Gavel to the Head: (6 before and after: the same)'); for(const k in q(L).e) q(L).e[k].gv=0; V.step(1); const a1=v.dmg; recL(L,F[1],{gv:5}); recL(L,F[2],{gv:5}); V.step(1); near(v.dmg,a1*(1+0.004*5*2),'0.4% x 5 attack per Gavel on the field');
  const e=auOf(L,F[1]); near(e&&e.ap.move,1-0.12,'Weighty Gavel: an enemy with a Gavel moves 4% x 3 slower');
  hold(L); const p=plainHit(L,()=>dmgOf(F[3],()=>castCT(L,F[3]))); recL(L,F[4],{gv:5}); F[4].level=1e4; near(dmgOf(F[4],()=>castCT(L,F[4])),p*1.40,'Down Comes the Gavel: Contempt on a Gavel holder 40% more');
  assert.ok(!(rq(L,F[4]).gv>0),'and the Gavel is spent (its stun resisted here, so no new one)'); F[4].level=100;
  const O=lab(H,S(['sg_11_2','sg_1_1']),{foes:4,big:true}); free(O); at(O,O.F[1],4.5,2.4); O.F[1].level=1e4; castGO(O,O.F[0]); assert.ok(!(O.F[1].stunned>0),'(its stun resisted)'); assert.ok(rq(O,O.F[1]).gv>0,'Order Restored: every enemy in Gag Order\'s reach gets a Gavel, stunned or not');
  const U=lab(H,S(['sg_1_1','sg_10_1']),{foes:3,big:true}); U.v.maxHp=1e6; U.v.hp=5e5; q(U).bud=1e9; recL(U,U.F[0],{gv:0.02}); V.step(1); near(U.v.hp,5e5+1e6*0.05,'Unused Gavel: one runs out unspent, he heals 1% x 5 of his max HP',1e-6);
  recL(U,U.F[1],{gv:0.02}); U.v.hp=5e5; q(U).bud=0; V.step(1); near(U.v.hp,5e5+1e6*0.012*V.STEP,'(out of the second\'s healing budget: only what filled in that tick)',1e-6);
  U.v.hp=5e5; secs(6); recL(U,U.F[1],{gv:0.02}); recL(U,U.F[2],{gv:0.02}); const h=U.v.hp; V.step(1); near(U.v.hp-h,1e6*0.06,'(two at once after a long wait: the budget keeps 5 s - 6%)',1e-3);
  recL(U,U.F[0],{gv:5}); U.v.hp=5e5; q(U).bud=1e9; for(const k in q(U).e) q(U).e[k].gv=0; V.step(1); near(U.v.hp,5e5,'(a Gavel spent or pushed out: no heal)');
});

/* ============================== SENTENCED AND CONTEMPT STORM ============================== */
test('Quorrel / Sentenced: Sentence Passed (every enemy Contempt Storm hits), Full Sentence, Sentence Carried Out, Thorough, Record Kept, Executed',()=>{
  const L=lab(H,S(['sg_1_4','sg_3_4','sg_7_4','sg_10_4','sg_12_4']),{foes:3,big:true}), {v,F}=L; castCS(L,F[0]);
  for(const f of F) assert.ok(rq(L,f)&&rq(L,f).sn>5.5,'every enemy a writ hits is Sentenced'); near(rq(L,F[0]).sn,6+3-0.1,'6 s, Full Sentence 0.6 x 5 longer',0.04);
  near(myHit(L,F[0],{auto:true}),1000*1.09,'Sentence Passed: his basic attacks on it 3% x 3 more'); near(myHit(L,F[0]),1000,'(not his other hits)');
  F[0].maxHp=1e9; F[0].hp=2.9e8; near(myHit(L,F[0]),1000*1.15,'Sentence Carried Out: below 30% HP 5% x 3 more'); F[0].hp=3.5e8; near(myHit(L,F[0]),1000,'(35%: no)'); F[0].hp=1e9;
  V.step(1); const e=auOf(L,F[1]); near(e&&e.ap.atk,0.95,'Thorough: 1% x 5 less attack'); near(e&&e.ap.apow,0.95,'and ability power');
  v.maxHp=1e6; v.hp=5e5; F[2].hp=1; F[2].shield=0; V.dmg(F[2],100); V.step(1); near(v.hp,5e5+1e6*0.04,'Record Kept: a Sentenced enemy dies, he heals 2% x 2 of his max HP',1e-6);
  secs(9.2); const e2=auOf(L,F[1]); assert.ok(!e2||!(e2.ap.atk<1),'Sentenced runs out');
  const X=lab(H,S(['sg_9_4','sg_1_1','sg_1_4']),{foes:4,big:true}); at(X,X.F[1],4.5,4.5); at(X,X.F[3],30,0); X.F[0].hp=1; X.F[0].shield=0; recL(X,X.F[0],{sn:5});
  castCS(X,X.F[0]); assert.ok(!X.F[0].alive,'a writ kills a Sentenced enemy'); assert.ok(rq(X,X.F[1])&&rq(X,X.F[1]).gv>0,'Executed: every enemy within 3 m of it gets a Gavel'); assert.ok(!(rq(X,X.F[3])&&rq(X,X.F[3]).gv>0),'(not one far away)');
});

test('Quorrel / Contempt Storm: Storm of Paper, Ruling Pace, More Paper, Final Word, Writ Weight, Final Session; All at Once and One by One (PICK ONE) with No Exceptions',()=>{
  let p=0; plain({foes:9,big:true},P=>{ p=dmgOf(P.F[0],()=>castCS(P,P.F[0])); });
  const L=lab(H,S(['sg_2_2','ed_9_3','sg_4_2','oc_12_1','sg_8_2','ed_12_4']),{foes:9,big:true}), {v,F}=L; const h=F.map(f=>f.hp); const ai=v.atkInterval;
  const d=dmgOf(F[0],()=>castCS(L,F[0])); near(d,p*1.15*1.15,'Storm of Paper 3% x 5, Ruling Pace 3% x 5 more'); assert.equal(F.filter((f,i)=>f.hp<h[i]).length,9,'More Paper: 6 + 1 x 3 enemies');
  near(F[3].slow,2-0.1,'Final Word: its writs slow 2 s',0.04); near(F[3].slowMul,0.80,'by 10% x 2'); V.step(1); near(v.atkInterval,ai/(1+0.05*9),'Writ Weight: 1% x 5 attack speed for each enemy hit (9)',1e-6);
  secs(5.1); near(v.atkInterval,ai,'for 5 s',1e-6); recL(L,F[1],{ts:2,tt:9}); const g=dmgOf(F[1],()=>castCS(L,F[0])); near(g,p*1.15*1.15*1.16,'Final Session: on an enemy with Testimony 8% x 2 more');
  const A=lab(H,S(['sg_5_2']),{foes:3,big:true}); free(A); A.F[2].stunned=1.0; castCS(A,A.F[0]); near(A.F[0].stunned,0.4-0.1,'All at Once: every enemy a writ hits stunned 0.4 s',0.04); near(A.F[2].stunned,0.6,'(not one already stunned)',0.04);
  const O=lab(H,S(['sg_5_3','sg_6_3']),{foes:3,big:true}), f=O.F; f[2].maxHp=1e9; f[2].hp=1e8; const hs=f.map(x=>x.hp); castCS(O,f[0]); const w=hs[0]-f[0].hp;
  near(hs[2]-f[2].hp,w+w*3*1.15,'One by One: 6 writs, 3 enemies - the 3 that found no target fall on the lowest-HP enemy, each what the first writ dealt, No Exceptions 5% x 3 more',1e-6);
  near(hs[1]-f[1].hp,w,'(the others: their own writ)');
});

test('Quorrel / Sentence Is Passed (SIGNATURE): 6 Gavels on the field - a full Contempt hit and 0.5 s stun on each holder, every Gavel spent, each Sentenced; once every 25 s',()=>{
  let p=0; plain({foes:7,big:true},P=>{ p=dmgOf(P.F[1],()=>castCT(P,P.F[1])); });
  const L=lab(H,S(['sg_13_2','sg_1_1']),{foes:7,big:true}), {F}=L; free(L); for(let i=0;i<5;i++) recL(L,F[i],{gv:6}); F[2].stunned=0.3; recL(L,F[3],{lk:0.2});
  const h=F.map(f=>f.hp); castCT(L,F[5]); assert.ok(rq(L,F[5]).gv>0,'the 6th Gavel (Contempt\'s stun)'); V.step(1);
  for(const i of [0,1,2,3]) near(h[i]-F[i].hp,p,'every enemy with a Gavel takes a full Contempt hit (F'+i+')',1e-6); near(h[6]-F[6].hp,0,'(not one without)');
  near(F[0].stunned,0.5-V.STEP,'and is stunned 0.5 s',0.04); near(F[2].stunned,0.3-V.STEP,'(not one already stunned)',0.04); near(F[3].stunned,0,'(nor one within 0.5 s after his stun on it)',1e-9);
  assert.equal(L.T.fn.gvN(api(L),L.T),0,'all Gavels spent'); for(const i of [0,1,2,3,5]) assert.ok(rq(L,F[i]).sn>5.5,'each of them Sentenced');
  free(L); for(let i=0;i<6;i++) recL(L,F[i],{gv:6}); const g=F.map(f=>f.hp); castCT(L,F[6]); V.step(1); assert.ok(L.T.fn.gvN(api(L),L.T)>=6,'once every 25 s'); assert.equal(F[0].hp,g[0],'');
});

/* ============================== TESTIMONY ============================== */
test('Quorrel / Testimony: At Extraordinary Length, Hear Them Out, Hear Every Word, Let Them Speak (10), Restless Hands, Long Testimony, Closing Arguments, On the Record',()=>{
  const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval;
  const L=lab(H,S(['ed_1_2','ed_2_2','ed_10_2','ed_6_2','ed_12_2','ed_11_2','ed_12_1']),{foes:3,big:true}), {v,F}=L; v.target=F[0];
  hitOn(L,10,{src:F[1],crit:true}); assert.equal(rq(L,F[1]).ts,4,'Hear Every Word: a critical hit adds 1 + 1 x 3'); hitOn(L,10); hitOn(L,10); assert.equal(rq(L,F[0]).ts,2,'each hit of an enemy on him: 1 Testimony on that enemy'); hitOn(L,10,{crit:true}); assert.equal(rq(L,F[0]).ts,5,'Hear Every Word: a critical hit 1 + 1 x 3 (max 5)');
  near(myHit(L,F[0]),1000*(1+0.006*5*5)*1.15,'At Extraordinary Length: 0.6% x 5 more per Testimony; Closing Arguments: at full 3% x 5 more');
  rq(L,F[1]).ts=0; rq(L,F[1]).tt=0; near(myHit(L,F[1]),1000,'(an enemy without)');
  secs(0.1); const r=rq(L,F[0]); near(r.tt,6+3-0.1,'Hear Them Out: they last 6 + 1 x 3 s after the last',0.04); secs(9); assert.ok(!(rq(L,F[0])&&rq(L,F[0]).tt>0),'then they are gone');
  const R=lab(H,S(['ed_6_2','ed_1_2']),{foes:3,big:true}); R.v.target=R.F[0]; recL(R,R.F[0],{ts:5,tt:9}); V.step(1); near(R.v.atkInterval,ai0/(1+0.02*5),'Restless Hands: 0.4% x 5 faster per Testimony on his target');
  R.v.target=R.F[1]; V.step(1); near(R.v.atkInterval,ai0,'(his target without)');
  const T10=lab(H,S(['ed_5_3','ed_6_3','ed_1_2']),{foes:3,big:true}); for(let i=0;i<12;i++) hitOn(T10,10); assert.equal(rq(T10,T10.F[0]).ts,10,'Let Them Speak: up to 10'); V.step(1);
  const e=auOf(T10,T10.F[0]); near(e&&e.ap.move,1-0.03*5,'Long Testimony: each past 5 slows it 1% x 3');
  const O=lab(H,S(['ed_11_2','ed_1_2']),{foes:3,big:true}); recL(O,O.F[0],{ts:2,tt:5}); V.step(1); const a0=O.v.atkInterval; O.F[0].hp=1; O.F[0].shield=0; V.dmg(O.F[0],100); V.step(2);
  near(O.v.atkInterval,a0/1.05,'On the Record: an enemy with Testimony dies - 1% x 5 attack speed for the rest of the wave'); O.F[1].hp=1; O.F[1].shield=0; V.dmg(O.F[1],100); V.step(2); near(O.v.atkInterval,a0/1.05,'(one without: nothing)');
  V.wave(); V.step(2); near(O.v.atkInterval,a0,'(a new wave: gone)');
});

test('Quorrel / Struck Into the Record (LINK), Interrupt (PICK ONE), Cross-Examine\'s 5',()=>{
  const L=lab(H,S(['ed_n1','ed_1_2']),{foes:2,big:true}), {F}=L; for(let i=0;i<4;i++) hitOn(L,10); near(myHit(L,F[0]),1000*(1+0.006*5*4),'(4 Testimony: not armed)');
  hitOn(L,10); near(myHit(L,F[0]),1000*(1+0.006*5*5)*1.10,'it reaches 5: his next hit on it 10% more'); near(myHit(L,F[0]),1000*(1+0.006*5*5),'only that one'); assert.ok(!(rq(L,F[0]).gv>0),'(without All Six: no Gavel)');
  const G=lab(H,S(['ed_n1','sg_1_1']),{foes:2,big:true}); for(let i=0;i<5;i++) hitOn(G,10); G.F[0].level=1e4; myHit(G,G.F[0]); assert.ok(rq(G,G.F[0]).gv>0,'with All Six (Six Gavels): that hit also leaves a Gavel');
  const I=lab(H,S(['ed_5_2','ed_1_2']),{foes:2,big:true}); free(I); for(let i=0;i<5;i++) hitOn(I,10); assert.equal(rq(I,I.F[0]).ts,5,'');
  myHit(I,I.F[0]); near(I.F[0].stunned,0,'(not a basic attack: nothing)'); myHit(I,I.F[0],{auto:true}); near(I.F[0].stunned,0.6,'Interrupt: at 5 Testimony his next basic attack stuns it 0.6 s',1e-9); assert.equal(rq(I,I.F[0]).ts,0,'and empties its Testimony');
  for(let i=0;i<5;i++) hitOn(I,10); myHit(I,I.F[0],{auto:true}); assert.equal(rq(I,I.F[0]).ts,5,'(still stunned: the stun-lock rule refuses it and the Testimony stays)');
});

test('Quorrel / Waiting to Hear It (SIGNATURE): full Testimony - 6 s with no stun and no slow on him, Tireless doubled, every enemy he hits gains full Testimony; once every 25 s',()=>{
  const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval, pm=P0.v.passMul, F=0.25*pm;
  const L=lab(H,S(['ed_13_2','ed_1_2']),{foes:3,big:true}), {v}=L; v.stunned=2; v.slow=1; for(let i=0;i<5;i++) hitOn(L,10); v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energyReg=0; v.energy=0;
  near(v.stunned,0,'an enemy reaches full Testimony: a stun on him ends'); near(v.slow,0,'and a slow'); ccOn(L.F[0],v,'stunned',1); near(v.stunned,0,'he cannot be stunned'); ccOn(L.F[0],v,'slow',1); near(v.slow,0,'nor slowed');
  V.step(1); near(v.atkInterval,ai0*(1+F)/(1+2*F),'Tireless doubled'); myHit(L,L.F[1]); assert.equal(rq(L,L.F[1]).ts,5,'every enemy he hits gains full Testimony');
  secs(6); ccOn(L.F[0],v,'stunned',1); near(v.stunned,V.ccNerf,'for 6 s',1e-6); v.stunned=0; V.step(1); near(v.atkInterval,ai0,'',1e-9);
  for(let i=0;i<5;i++) hitOn(L,10,{src:L.F[2]}); ccOn(L.F[0],v,'stunned',1); assert.ok(v.stunned>0,'once every 25 s');
});

test('Quorrel / Waiting for the Word: 0.3% x 5 of his max HP every 3 s while an enemy stands, inside the 1.2% a second budget',()=>{
  const L=lab(H,S(['ed_8_1']),{foes:2,big:true}), {v}=L; v.maxHp=1e6; v.hp=5e5; for(const r of L.T.on.tick) if(r.period) L.T.s.lim[r.key].acc=0; q(L).bud=1e9;
  const h=v.hp; secs(4.1); near(v.hp-h,1e6*0.015,'1.5% every 3 s (one in 4 s)',1e-6); for(const f of L.F){ f.alive=false; } secs(3.05); near(v.hp-h,1e6*0.015,'(no enemy standing: none)',1e-6);
});

/* ============================== WHOLE FIGHTS ============================== */
test('Quorrel: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H), TEAM=['vael','sylthaine','vireo','vex','quorrel'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={qPre:0,qDay:0,gv:0,sn:0,ts:0,s1:0,s2:0,s3:0};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s, Q0=T0.q; for(const k of ['qPre','qDay']) mx[k]=Math.max(mx[k],(T0.k[k]||{n:0}).n);
    if(Q0){ let g=0,n=0,t=0; for(const k in Q0.e){ const r=Q0.e[k]; if(r.gv>0&&r.u.alive) g++; if(r.sn>0) n++; if(r.tt>0) t=Math.max(t,r.ts); } mx.gv=Math.max(mx.gv,g); mx.sn=Math.max(mx.sn,n); mx.ts=Math.max(mx.ts,t); for(const k of ['s1','s2','s3']) if(Q0[k]>0) mx[k]=1; } }
  assert.ok(mx.qPre>=1,'real Precedent: '+mx.qPre); assert.ok(mx.qDay>=1,'real Days'); assert.ok(mx.gv>=1,'real Gavels'); assert.ok(mx.sn>=1,'real Sentenced enemies'); assert.ok(mx.ts>=1,'real Testimony');
  console.log('  live fight: max '+JSON.stringify(mx)); determinism(H,TEAM);
});

/* The page line his talents added (the guarded landPre / land pair around each Contempt Storm writ's hit in the volley case): with nothing learned, whole seeded
   fights with Quorrel in the line-up are identical to the pre-talent page (ee8edab8), seed by seed, and reach that line. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Quorrel: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach the page line his talents added',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['quorrel','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __qbN={go:0,ct:0,cs:0,writ:0}; var __qbD=_doEffectCore, __qbDD=_dealDamageCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="quorrel"&&(!o||!o.deliver||o._arrived)){ if(type==="aoeStun") __qbN.go++; if(type==="stun") __qbN.ct++; if(type==="volley") __qbN.cs++; } return __qbD.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt,amt,color){ if(src&&src.key==="quorrel"&&color==="#5ee89b") __qbN.writ++; return __qbDD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__qbN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.go>0&&c.ct>0&&c.cs>0&&c.writ>0,'the fights cast Gag Order ('+c.go+'), Contempt ('+c.ct+') and Contempt Storm ('+c.cs+'), whose writs pass the new line ('+c.writ+')'); }
  finally{ VMX('_doEffectCore=__qbD; _dealDamageCore=__qbDD;'); }
  assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* The stun-lock rule and his stun chains in seeded fights: the most stun-heavy legal builds (91 points deep in Order in the Court, and 61 Order in the Court +
   30 Six Gavels with every stun talent of both). No talent stun on an enemy already stunned or within 0.5 s after his stun on it ended; the longest time one
   enemy stays stunned by him in a row. */
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={oc:0,sg:1,ed:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const STUNW={ oc:['oc_13_3','oc_1_3','oc_11_3','oc_8_3','oc_n1','oc_5_3','oc_7_4','oc_11_4','oc_6_3','oc_7_1','oc_4_3','oc_1_4'], sg:['sg_5_2','sg_4_3','sg_11_3','sg_1_1'], ed:['ed_5_2','ed_11_1','ed_8_3','ed_7_4','ed_10_1'] };
test('Quorrel: the stun-lock rule holds in seeded fights, and his longest stun chain on one enemy',()=>{
  const builds=[[['oc'],[91]],[['oc','sg'],[61,30]],[['oc','ed'],[61,30]],[['ed','oc'],[61,30]]].map(([o,c])=>{ const b=deep(o,c,STUNW); assert.equal(T.invalid(H,b,100),'','a legal build'); return {o,list:T.learned(H,b),b}; });
  VMX('var __qs={ticks:0,run:0,talent:0,onStun:0,inLock:0,runs:[]}; var __qsU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="quorrel"&&u._tal&&u._tal.s.q)) continue; const Q=u._tal.s.q; __qs.ticks++;'+
    '    if(!u.alive) continue; for(const k in Q.e){ const r=Q.e[k]; if(!r.u.alive) continue; if(r.st>0&&(r.u.stunned||0)>0){ r.__run=(r.__run||0)+dt; if(r.__run>__qs.run) __qs.run=r.__run; } else if(r.__run){ __qs.runs.push(+r.__run.toFixed(2)); r.__run=0; } } }'+
    '  return __qsU.apply(this,arguments); };');
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')); const out=[];
  try{ for(const B of builds){ VMX('__qs.ticks=0; __qs.run=0; __qs.runs=[]'); let tn=0, ts=0, tl=0, rm=0;
      const sn=snaps(['quorrel','vael','vireo','sylthaine','gruel'].map(k=>Object.assign(spec(k,100,k===H?B.list:null),{skillLv:[100,100,100,100]})));
      for(const node of [34,60,90,120]) for(const seed of [11,90210]){ NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
      const foe=snaps(['absalie','astra','vireo','sylthaine','vex'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
      for(const seed of [3,5]){ NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); }
      const c=JSON.parse(JSON.stringify(VMX('__qs'))); const med=c.runs.length?c.runs.slice().sort((a,b)=>a-b)[Math.floor(c.runs.length/2)]:0;
      out.push(B.o.join('+')+' '+JSON.stringify(T.spent(H,B.b).tree)+': longest run on one enemy '+c.run.toFixed(2)+' s, median '+med+' s, runs '+c.runs.length);
      console.log('  '+out[out.length-1]); assert.ok(c.ticks>300,'he fought'); assert.ok(c.run<=RUNMAX,'no enemy is stunned by him more than 4.0 s in a row from his talents\' extensions (seen '+c.run.toFixed(2)+' s)'); B.run=c.run; } }
  finally{ VMX('_updateBattleCore=__qsU;'); }
  console.log('  stun chains: '+out.join(' | '));
});
/* the talent stuns themselves, on the still field: never on a stunned enemy, never within 0.5 s after one of his stuns on it ended (each refusal counted) */
test('Quorrel / the stun-lock rule for his talent stuns, on the still field',()=>{
  const L=lab(H,S(['oc_13_3','sg_5_2','ed_5_2','oc_7_4']),{foes:3,big:true}); free(L); L.F[1].stunned=0.5; recL(L,L.F[2],{lk:0.4});
  for(const f of L.F) L.T.fn.tstun(api(L),L.T,L.v,f,1,'test'); near(L.F[0].stunned,1,'a free enemy: stunned',1e-9); near(L.F[1].stunned,0.5,'(already stunned: refused)'); near(L.F[2].stunned,0,'(inside the lock: refused)');
  assert.deepEqual([q(L).ts.n,q(L).ts.onStun,q(L).ts.lkOk],[3,1,1],'every refusal counted');
  free(L); V.step(1); const g=L.F[1]; L.T.fn.tstun(api(L),L.T,L.v,g,0.3,'test'); near(g.stunned,0.3,'',1e-9); secs(0.45); assert.ok(!(g.stunned>0),'(its stun is over)');
  L.T.fn.tstun(api(L),L.T,L.v,g,1,'test'); assert.ok(!(g.stunned>0),'0.15 s after his stun on it ended: refused'); secs(0.45); L.T.fn.tstun(api(L),L.T,L.v,g,1,'test'); near(g.stunned,1,'0.6 s after: it lands',1e-9);
});
const RUNMAX=4.0+0.05;

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. Quorrel's talent reductions are one capped group (25%).
   Each candidate build is 91 points legal; the most defensive is the one whose worst hit is reduced most. */
const DEF={ oc:['oc_3_1','oc_10_2','oc_5_4','oc_12_4','oc_1_1'], sg:['sg_8_3','sg_5_1','sg_8_1','sg_1_1'], ed:['ed_6_1','ed_5_1','ed_11_4','ed_3_3','ed_9_4','ed_1_2'] };
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,4.5][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,0,0,-5][i]*V.METER; a.y=v.y-[5.5,11,16.5,5][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on him: every condition of his damage-reduction talents true at once - the attacker stunned by him moments ago, with Testimony, in the back row,
   a magic hit; Chitin Robes (an enemy held by his stun), Court Chitin (3 Gavels), Chitin Plates (above 50% HP) on. Physical and magic, normal and critical,
   with his armour and magic resist; and again with glyph damage reduction at its 30% cap. */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.6*v.maxHp; v.shield=0; v.glyphDR=glyph||0; f.t=Object.assign({},f.t,{row:'Back'});
  if(L.T){ const Q0=L.T.s.q; for(const x of F){ const e=Q0.e[x.uid]={u:x,st:0,re:0,lk:0,bp:9,gv:9,sn:0,ts:5,tt:9,ow:0,hc:0,arm:0}; } Q0.e[F[1].uid].st=9; F[1].stunned=9; V.step(1); }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Quorrel: his most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and he is at 85% or more for well under half a fight',()=>{
  const cands=[[['oc','sg'],[61,30]],[['oc','ed'],[61,30]],[['sg','oc'],[61,30]],[['sg','ed'],[61,30]],[['ed','oc'],[61,30]],[['ed','sg'],[61,30]],[['oc'],[91]],[['sg'],[91]],[['ed'],[91]],[['oc','sg','ed'],null]].map(([o,c])=>{ const b=deep(o,c,DEF); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="quorrel"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="quorrel"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys"):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic"):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','quorrel'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>40&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune');
    assert.ok(d.te85<0.25*d.t,'at 85% or more for well under half of his time in the fights ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
