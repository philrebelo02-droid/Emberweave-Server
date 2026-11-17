'use strict';
/* Fritz's talents as data on the mechanics layer (talents-mech/fritz.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Fritz, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12); A0 (0,-5.5) A1 (0,-11).
   Bodies: Fritz 1.56 m, the lab's Vaels 2.01 m (F0 0.93 m from him body to body, A0 1.93 m). Lab units are HELD (stunned 1e6), Fritz too: go() lets him
   think (his storm's pulses) with nothing ready. Run: node --test tests/talents-mech-fritz.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='fritz', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const noDef=L=>{ for(const f of L.F){ f.mrRating=0; f.armorRating=0; } };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage unless said)
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));                       // his hit on t
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; };
const skillRatio=(L,t,skill,o)=>{ L.T.s.cur=skill; let a; try{ a=myHit(L,t,o); } finally{ L.T.s.cur=null; } return a/plainHit(L,()=>myHit(L,t,o)); };
const cond=(L,t)=>L.T.fn.mkCond({},L.T,L.v,{tgt:t})||VMX('0');
const setCond=(L,t)=>{ FXN; const m=t._talM||(t._talM={}), o=m[L.v.uid]||(m[L.v.uid]={}); o.cond={t0:V.now(),until:V.now()+99,v:0}; };
const veilP=(L,auto,base)=>FX.veil(L.v,L.F[0],!!auto,'magic',base==null?true:base,0.449);
const units=()=>VMX('units');
const castSS=L=>{ V.cast(L.v,'green',L.F[0]); };
const castCL=(L,t)=>{ V.cast(L.v,'blue',t||L.F[0]); };
const storm=(L,t)=>{ go(L); V.cast(L.v,'ult',t||L.F[0]); };
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };

test('Fritz: every talent is accounted for - 9 plain stats, 109 with rows, none waiting',()=>{
  accounting(H,[118,9,109,0,0]);
  const M=FXN.mech(H); for(const id of ['lw_1_1','hh_1_1','sc_1_1','lw_13_3','hh_13_3','sc_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['lw_1_2','lw_10_1','lw_n2','hh_n1','hh_12_4','hh_7_4','sc_2_4','sc_10_4','sc_9_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.equal(T.talent(H,'sc_9_1').name,'Tailwind','no other game\'s name');
});

test('Fritz: his real kit, as the talents read it - Storm Surge\'s bolts, Chain Lightning\'s jumps, Static Veil, Thunder Shower\'s pulses',()=>{
  plain({foes:3,big:true},P=>{ const {v,F}=P; noDef(P); const h=F.map(f=>f.hp); castSS(P); assert.deepEqual(F.map(f=>f.hp),h,'Storm Surge: nothing at the cast');
    secs(0.25); assert.deepEqual(F.map(f=>f.hp),h,'(0.25 s: not yet)'); secs(0.6); const d=F.map((f,i)=>h[i]-f.hp); assert.ok(d.every(x=>x>0),'one bolt on each of the 3 enemies (a different one each)'); near(d[0],d[1],'each the same size');
    const g=F.map(f=>f.hp); castCL(P,F[0]); const e=F.map((f,i)=>g[i]-f.hp); near(e[1],e[0]*0.8,'Chain Lightning jumps on, 20% weaker'); near(e[2],e[0]*0.64,'and again');
    const pv=VMX('SKLV.stormdodge')(VMX('passLv')(v)); v._castT=5; let n=0; for(let i=0;i<400;i++){ const a=v.hp; V.hit(F[0],v,10,{kind:'magic'}); if(v.hp===a) n++; } assert.ok(Math.abs(n/400-pv)<0.08,'Static Veil while he casts: '+(pv*100).toFixed(1)+'% at its level ('+n+' of 400 dodged)');
    v._castT=0; let m=0; for(let i=0;i<100;i++){ const a=v.hp; V.hit(F[0],v,10,{kind:'magic'}); if(v.hp===a) m++; } assert.equal(m,0,'not while he does not');
    const s=F.map(f=>f.hp); storm(P,F[0]); assert.ok(v._stormT>0,'Thunder Shower channels'); secs(3.3); const k=F.map((f,i)=>s[i]-f.hp); assert.ok(k[0]>0&&k[1]>0,'F0 and F1 (5.5 m from F0) inside its 6 m'); near(k[2],0,'not F2 (11 m)');
    near(k[0]/(e[0]/1.1*0.6),6,'six pulses of 60% of his ability power',0.2); });
});

/* ============================== LIVEWIRE ============================== */
test('Fritz / Charge: Bottled Storm, Quick Charge, Residue, Storm Battery, Charged Step',()=>{
  const L=lab(H,S(['lw_1_1','lw_3_1','lw_5_1','lw_8_1','lw_6_1']),{foes:5,big:true}), {v,F}=L; noDef(L);
  assert.equal(stack(L,'charge'),10,'Quick Charge: each wave starts with 2 x 5'); castCL(L,F[0]); assert.equal(stack(L,'charge'),10+4,'Chain Lightning: 1 for each enemy it hits (4)');
  castSS(L); secs(1); assert.equal(stack(L,'charge'),19,'Storm Surge: 1 for each bolt that strikes (5)'); assert.equal(L.T.s.cur,null,'(each bolt landing ended: no skill resolving)');
  const s0=v.speed; setStack(L,'charge',9); V.step(1); const s9=v.speed; setStack(L,'charge',10); V.step(1); near(v.speed,s9*1.10,'Charged Step: at 10 Charge 2% x 5 faster'); near(s0,v.speed,'(the wave began at 10)');
  setStack(L,'charge',20); const plainCl=plainHit(L,()=>{ const h=F[1].hp; castCL(L,F[1]); return h-F[1].hp; }); setStack(L,'charge',20);
  const hs=F.map(f=>f.hp); castCL(L,F[1]); near(hs[1]-F[1].hp,plainCl*1.30,'Bottled Storm: at 20 the next Chain Lightning 10% x 3 more');
  const nHit=F.filter((f,i)=>f.hp<hs[i]).length; assert.equal(stack(L,'charge'),5+nHit,'it spends it all, Residue keeps 1 x 5 (then its own hits add theirs)');
  const g=F[1].hp; castCL(L,F[1]); near(g-F[1].hp,plainCl,'the next one is plain again');
  setStack(L,'charge',0); go(L); V.cast(v,'ult',F[0]); secs(1.1); assert.equal(stack(L,'charge'),4,'Storm Battery: each pulse 1 per enemy hit (F0 and F1 inside: two pulses, 4); the storm\'s own strikes give none');
  V.wave(); V.step(1); assert.equal(stack(L,'charge'),10,'a new wave: Charge starts again (Quick Charge)');
});

test('Fritz / Storm Battery counts only up to its rank a pulse',()=>{
  const L=lab(H,S(['lw_8_1']).map(x=>[x[0],1]),{foes:5,big:true}), {v,F}=L; at(L,F[1],7,0); at(L,F[3],4.5,4); go(L); V.cast(v,'ult',F[0]); secs(0.55);
  assert.equal(stack(L,'charge'),1,'one pulse, 3 enemies inside: 1 Charge at rank 1'); secs(0.5); assert.equal(stack(L,'charge'),2,'');
});

test('Fritz / Conductors: struck by both spells within 4 s; Conductor, Live Metal, Rubber Soles, Exposed Wiring, Spark Gap, Ground Fault',()=>{
  const L=lab(H,S(['lw_1_4','lw_2_4','lw_n1','lw_4_4','lw_8_4','lw_7_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; noDef(L);
  castCL(L,F[2]); assert.ok(!mark(L,F[2],'cond'),'Chain Lightning alone: no Conductor'); secs(3.0); castSS(L); secs(1); assert.ok(mark(L,F[2],'cond'),'Storm Surge within 4 s: a Conductor');
  secs(4+3-1.0-0.2); assert.ok(mark(L,F[2],'cond'),'Live Metal: 4 + 1 x 3 s'); secs(0.8); assert.ok(!mark(L,F[2],'cond'),'then not');
  secs(5); castSS(L); secs(4.8); castCL(L,F[2]); assert.ok(!mark(L,F[2],'cond'),'more than 4 s apart: no');
  setCond(L,F[0]); V.step(2); near(skillRatio(L,F[0],'chainlight'),1.10*1.05,'Conductor: his spells 2% x 5 more to it (and Ground Fault)'); near(skillRatio(L,F[0],'thundershower'),1.05,'(not Thunder Shower)'); near(myHit(L,F[0],{auto:true}),plainHit(L,()=>myHit(L,F[0],{auto:true}))*1.05,'(not his basic attacks)');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.90,'Rubber Soles: a Conductor deals him 2% x 5 less'); near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'');
  const e=L.T.s.au.find(x=>x.x===F[0]); near(e&&e.ap.mr,0.90,'Exposed Wiring: 2% x 5 less magic resist'); near(e&&e.ap.move,0.88,'Spark Gap: 4% x 3 slower');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.05,'Ground Fault: it takes 1% x 5 more from his allies');
  near(myHit(L,F[0]),plainHit(L,()=>myHit(L,F[0]))*1.05,'and from him');
});

test('Fritz / Conductors: Grounding Rod, Burnt Wires, Arc Flash, Lightning Rod, Gathering Clouds, Dense Storm',()=>{
  const L=lab(H,S(['lw_1_4','lw_2_4','lw_3_4','lw_11_4','lw_6_4','lw_10_4','lw_11_3','lw_12_3']),{foes:4,big:true}), {v,F}=L; noDef(L);
  V.hit(v,F[1],10,{kind:'true',auto:true}); assert.ok(mark(L,F[1],'cond'),'Grounding Rod: his basic attack makes a Conductor');
  near(myHit(L,F[1],{auto:true}),plainHit(L,()=>myHit(L,F[1],{auto:true}))*1.15,'Burnt Wires: his basic attacks 3% x 5 more to Conductors'); near(myHit(L,F[2],{auto:true}),plainHit(L,()=>myHit(L,F[2],{auto:true})),'');
  near(skillRatio(L,F[1],'thundershower'),1.10,'Dense Storm: Thunder Shower 2% x 5 more to Conductors');
  at(L,F[3],10,4.5); at(L,F[2],30,0); const h3=F[3].hp, h2=F[2].hp; kill(L,F[1]); assert.ok(h3-F[3].hp>0,'Arc Flash: an enemy within 3 m of the dying Conductor is struck'); near(h3-F[3].hp,v.apow*0.45,'15% x 3 of his ability power',1e-6); near(h2-F[2].hp,0,'not one far away');
  setCond(L,F[2]); setCond(L,F[0]); F[2].hp=F[2].maxHp; F[0].hp=F[0].maxHp*0.5; L.T.s.sb=500; const g2=F[2].hp, g0=F[0].hp; L.T.s.lim['lw_10_4#0'].acc=0; secs(6.1);
  near(g2-F[2].hp,500,'Lightning Rod: every 6 s the Conductor with the most HP takes a Storm Surge bolt',1e-6); near(g0-F[0].hp,0,'not the other');
  let n=0; L.T.s.cur='thundershower'; for(let i=0;i<300;i++){ const t=F[3]; FX.hit(v,t,10,10,'magic',false,false,t.hp); if(mark(L,t,'cond')) n++; const o=t._talM&&t._talM[v.uid]; if(o) delete o.cond; } L.T.s.cur=null;
  assert.ok(n>130&&n<230,'Gathering Clouds: each storm strike 20% x 3 to make a Conductor (seeded): '+n+' of 300');
});

test('Fritz / Chain Lightning: Long Arc, Far Reach, Extra Link, Jump Spark, Bright Chain, Live Current, Quick Hands, Clear Line',()=>{
  let base=[]; plain({foes:6,big:true},P=>{ noDef(P); const h=P.F.map(f=>f.hp); castCL(P,P.F[0]); base=P.F.map((f,i)=>h[i]-f.hp); });
  const L=lab(H,S(['lw_2_3','lw_4_2','lw_9_3','sc_6_4','lw_10_2','lw_11_2','sc_4_4']),{foes:6,big:true}), {v,F}=L; noDef(L);
  const h=F.map(f=>f.hp); castCL(L,F[0]); const d=F.map((f,i)=>h[i]-f.hp);
  near(d[0],base[0]*1.15,'Bright Chain: 5% x 3 more (the first hit: no Jump Spark)'); near(d[1],base[0]*1.15*0.9*1.15,'Long Arc: each jump 10% weaker, not 20; Jump Spark 3% x 5 more on jumps');
  assert.equal(d.filter(x=>x>0).length,4,'(4 hits)'); near(v.energy,20,'Live Current: 1 x 5 energy for each enemy hit (4)');
  near(FX.cd(v,'blue',7),7-0.9-1.2,'Quick Hands 0.3 x 3, Clear Line 0.4 x 3 shorter');
  const M=lab(H,S(['lw_4_2']),{foes:3,big:true}); at(M,M.F[1],4.5+16.5,0); at(M,M.F[2],60,0); const g=M.F[1].hp; castCL(M,M.F[0]); assert.ok(M.F[1].hp<g,'Far Reach: a jump of 16.5 m (15 + 1 x 3 reaches)');
  const N=lab(H,S(['lw_2_3']),{foes:3,big:true}); at(N,N.F[1],4.5+16.5,0); at(N,N.F[2],60,0); const g1=N.F[1].hp; castCL(N,N.F[0]); near(g1-N.F[1].hp,0,'(without it, 15 m)');
  const X=lab(H,S(['lw_4_3','lw_2_3']),{foes:8,big:true}); let five=0, n=0; for(let i=0;i<200;i++){ X.v.energy=0; const hs=X.F.map(f=>f.hp); castCL(X,X.F[0]); const k=X.F.filter((f,j)=>f.hp<hs[j]).length; n++; if(k===5) five++; }
  assert.ok(five>60&&five<120,'Extra Link: 15% x 3 a cast one more jump (seeded): '+five+' of '+n);
  const Y=lab(H,S(['lw_10_2','lw_5_3']),{foes:8,big:true}); const hy=Y.F.map(f=>f.hp); castCL(Y,Y.F[0]); assert.equal(Y.F.filter((f,i)=>f.hp<hy[i]).length,7,'(a forked chain: 7 hits)'); near(Y.v.energy,25,'Live Current: up to 5 enemies a cast');
});

test('Fritz / Single Spark and Forked Chain (PICK ONE), Relay',()=>{
  let one=0; plain({foes:3,big:true},P=>{ noDef(P); const h=P.F[0].hp; castCL(P,P.F[0]); one=h-P.F[0].hp; });
  { const L=lab(H,S(['lw_5_2']),{foes:3,big:true}), {F}=L; noDef(L); for(const f of F) f.level=1; const h=F.map(f=>f.hp); F[0].stunned=0; castCL(L,F[0]);
    near(h[0]-F[0].hp,one*2.6,'Single Spark: 2.6 times its damage'); near(h[1]-F[1].hp,0,'no jump'); near(F[0].stunned,0.5,'stunned 0.5 s (the full written time)',1e-9); }
  { const L=lab(H,S(['lw_5_3']),{foes:8,big:true}), {F}=L; noDef(L); const h=F.map(f=>f.hp); castCL(L,F[0]); const hit=F.filter((f,i)=>f.hp<h[i]).length;
    assert.equal(hit,7,'Forked Chain: the first target and two chains of 3 jumps'); const d=F.map((f,i)=>h[i]-f.hp); assert.ok(d.filter(x=>Math.abs(x-one*0.8)<1e-6*one).length>=2,'both chains start at 80%'); }
  { const L=lab(H,S(['sc_7_4','sc_6_4']),{foes:3,allies:2,big:true}), {v,F,A}=L; noDef(L); A[0].hp=A[0].maxHp*0.5; A[1].hp=A[1].maxHp*0.4; const a=A[1].hp, b=A[0].hp; castCL(L,F[0]);
    near(A[1].hp-a,one*Math.pow(0.8,3),'Relay: one more jump to his lowest-HP ally, healing it for that jump\'s damage',1e-6); near(A[0].hp-b,0,'not another'); }
});

test('Fritz / Storm Surge: Ready Surge, Errand Run, Brighter Bolts, Surge on Cue, Between Ticks, Called Bolts, Spare Bolt',()=>{
  const L=lab(H,S(['lw_2_2','sc_8_2','lw_6_3','hh_6_2','lw_7_3']),{foes:6,big:true}), {v,F}=L; noDef(L);
  near(FX.cd(v,'green',8),8-1.2-0.9,'Ready Surge 0.4 x 3, Errand Run 0.3 x 3 shorter');
  near(skillRatio(L,F[0],'stormsurge'),1.12,'Brighter Bolts: 4% x 3 more'); L.T.s.bn=1; near(skillRatio(L,F[0],'stormsurge'),1.12*1.18,'Surge on Cue: its first bolt 6% x 3 more'); L.T.s.bn=2; near(skillRatio(L,F[0],'stormsurge'),1.12,'not the second');
  setCond(L,F[4]); F[2].hp=F[2].maxHp*0.3; F[1].hp=F[1].maxHp*0.5; const h=F.map(f=>f.hp); V.cast(v,'green',F[0]); secs(0.35); const d=F.map((f,i)=>h[i]-f.hp);
  assert.ok(d[4]>0&&d.filter(x=>x>0).length===1,'Called Bolts: the first bolt (0.3 s) to the Conductor'); secs(0.12); assert.ok(h[2]-F[2].hp>0,'then the lowest HP'); secs(0.5); assert.ok(h[1]-F[1].hp>0,'');
  const B=lab(H,S(['hh_7_2','hh_6_2']),{foes:5,big:true}); noDef(B); const g=B.F.map(f=>f.hp); V.cast(B.v,'green',B.F[0]); V.step(1); assert.equal(B.F.filter((f,i)=>f.hp<g[i]).length,5,'Between Ticks: all five land at once');
  assert.ok(win(B,'btv'),'and Static Veil is up'); near(FX.veil(B.v,B.F[0],true,'magic',false,0.449),0.449,'(up although he is not casting)'); secs(1.05); near(FX.veil(B.v,B.F[0],true,'magic',false,0.449),0,'for 1 s');
  const Q=lab(H,S(['lw_12_1']),{foes:3,big:true}); noDef(Q); at(Q,Q.F[2],4.5,5); const sb={}; const q=Q.F.map(f=>f.hp); V.cast(Q.v,'green',Q.F[0]); kill(Q,Q.F[0]); kill(Q,Q.F[1]); secs(1);
  const full=(q[2]-Q.F[2].hp); assert.ok(full>Q.T.s.sb*0.95,'(F2 took its own bolt)'); near(full,Q.T.s.sb*(1+0.9+0.9),'Spare Bolt: the two bolts of the dead strike the nearest enemy at 30% x 3',1e-3);
});

test('Fritz / Storm Surge for his team: Errand Bolts, Return Address, Fair Weather / Bad Weather (PICK ONE), Rush Order',()=>{
  { const L=lab(H,S(['sc_3_2','sc_4_2']),{foes:3,allies:2,big:true}), {v,F,A}=L; at(L,A[1],4.5,-5); castSS(L); secs(1);
    near(A[1].energy,3*5,'Errand Bolts: the ally nearest each struck enemy gets 1 x 5 (A1 stands by them all)'); near(A[0].energy,0,''); near(v.energy,0,'never himself');
    A[0].energy=10; A[1].energy=50; F[0].hp=1; F[0].shield=0; L.T.s.cur='stormsurge'; V.hit(v,F[0],10,{kind:'true'}); L.T.s.cur=null; near(A[0].energy,10+9,'Return Address: a bolt kill gives 3 x 3 to the ally with the least energy'); }
  { let n0=0; plain({foes:5,big:true},P=>{ const h=P.F.map(f=>f.hp); castSS(P); secs(1); n0=P.F.filter((f,i)=>f.hp<h[i]).length; });
    const L=lab(H,S(['sc_5_2']),{foes:5,allies:2,big:true}), {v,F,A}=L; A[0].hp=A[0].maxHp*0.6; A[1].hp=A[1].maxHp*0.5; const a=A[1].hp, h=F.map(f=>f.hp); castSS(L); near(A[1].hp-a,v.apow*0.6,'Fair Weather: his lowest-HP ally healed 60% of his ability power');
    secs(1); assert.equal(F.filter((f,i)=>f.hp<h[i]).length,n0-1,'one bolt fewer on the enemies'); }
  { const L=lab(H,S(['sc_5_1']),{foes:3,big:true}), {F}=L; for(const f of F) f.slow=0; castSS(L); secs(1); assert.ok(F.every(f=>f.slow>0&&Math.abs(f.slowMul-0.75)<1e-9),'Bad Weather: every enemy struck slowed 25%'); assert.ok(F[0].slow<=2&&F[0].slow>1,'for 2 s'); }
  { const L=lab(H,S(['sc_9_2']),{foes:6,allies:1,big:true}), {v,F,A}=L; A[0].maxHp=1e5; A[0].hp=5e4; v.greenCd=6; F[5].target=A[0]; V.step(1); near(v.greenCd,6,'above 35%: nothing',1e-9);
    A[0].hp=3e4; V.step(1); near(v.greenCd,0,'Rush Order: the ally drops below 35%: Storm Surge\'s cooldown is over'); const h=F[5].hp; V.cast(v,'green',F[0]); secs(0.35); assert.ok(F[5].hp<h,'its first bolt goes to the enemy hitting that ally');
    A[0].hp=5e4; V.step(1); A[0].hp=3e4; v.greenCd=6; V.step(1); near(v.greenCd,6,'once a wave',1e-9); }
});

test('Fritz / Thunder Shower: Heavier Rain, Thunder Count, Wider Storm, Rooted Storm, High Voltage',()=>{
  const L=lab(H,S(['lw_7_2','hh_9_3','lw_8_2','hh_8_3','lw_5_4']),{foes:3,big:true}), {v,F}=L;
  near(skillRatio(L,F[0],'thundershower'),1.15*1.15,'Heavier Rain 3% x 5, Thunder Count 3% x 5');
  for(const f of F) f.mrRating=300; const a=skillRatio(L,F[0],'chainlight',{kind:'magic'}), T0=v._tal; v._tal=undefined; const m0=VMX('defMul')(v,F[0],'magic'); F[0].mrRating=300*0.9; const m1=VMX('defMul')(v,F[0],'magic'); F[0].mrRating=300; v._tal=T0;
  near(a,m1/m0,'High Voltage: his skills ignore 2% x 5 of the magic resist'); near(myHit(L,F[0],{kind:'magic',auto:true})/plainHit(L,()=>myHit(L,F[0],{kind:'magic',auto:true})),1,'not his basic attacks');
  at(L,F[1],4.5+6.6,0); const h=F[1].hp; storm(L,F[0]); assert.ok(Math.abs(v._stormR-7*V.METER)<1e-6,'Wider Storm: 6 + 0.2 x 5 m'); secs(0.6); assert.ok(F[1].hp<h,'F1 6.6 m from the centre is inside');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.90,'Rooted Storm: while it channels 2% x 5 less'); secs(3); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'not after');
});

test('Fritz / storm\'s end: Discharge, The Open Square (SIGNATURE)',()=>{
  { const L=lab(H,S(['lw_9_1','lw_1_1']),{foes:4,big:true}), {v,F}=L; at(L,F[3],80,30); storm(L,F[3]); const h=F.map(f=>f.hp); secs(2.9); assert.ok(F[0].hp===h[0],'(F0 outside the storm)'); setStack(L,'charge',20);
    secs(0.5); assert.equal(stack(L,'charge'),1,'Discharge: a free Chain Lightning from the enemy nearest the storm\'s centre (F3), at 20 Charge Bottled Storm\'s (spent; its one hit adds 1)'); }
  { const L=lab(H,S(['lw_1_1']),{foes:4,big:true}); at(L,L.F[3],80,30); storm(L,L.F[3]); secs(2.9); setStack(L,'charge',20); secs(0.5); assert.equal(stack(L,'charge'),20,'(without Discharge: nothing at the storm\'s end)'); }
  const L=lab(H,S(['lw_13_3','lw_1_4']),{foes:6,big:true}), {v,F}=L; noDef(L); at(L,F[1],4.5+3.5,0); at(L,F[2],40,0); setCond(L,F[2]); setCond(L,F[5]); at(L,F[4],40,4.2);
  storm(L,F[0]); const h=F.map(f=>f.hp); secs(0.55); const x=v.apow*0.30;
  near(h[2]-F[2].hp,x,'The Open Square: each pulse every Conductor on the field is struck for 30% of his ability power',1e-6); near(h[4]-F[4].hp,x,'and the bolt jumps on to the nearest other enemy within 5 m (F4, 0.2 m from F2)',1e-6);
  secs(3.2); assert.ok(win(L,'osq'),'after the storm, for 6 s'); secs(6); assert.ok(!win(L,'osq'),'then not');
  const Q=lab(H,S(['lw_13_3']),{foes:9,big:true}); let g=Q.F.map(f=>f.hp); castCL(Q,Q.F[0]); assert.equal(Q.F.filter((f,i)=>f.hp<g[i]).length,4,'(a plain chain: 4 hits)');
  Q.T.s.w.osq={t:6,n:1,cdT:0,at:-1,wave:false}; g=Q.F.map(f=>f.hp); castCL(Q,Q.F[0]); assert.equal(Q.F.filter((f,i)=>f.hp<g[i]).length,7,'in the window every Chain Lightning jumps twice as many times (7 hits)');
});

/* ============================== HALF A HEARTBEAT ============================== */
test('Fritz / Static Veil: Wider Veil, Hard to Pin, Spring Wound, Veil in Motion, Courier\'s Reflex',()=>{
  const L=lab(H,S(['hh_2_2','hh_9_2','hh_8_1','hh_4_2','hh_3_3','hh_1_1']),{foes:3,big:true}), {v,F}=L;
  near(veilP(L,true),0.449+0.05,'Wider Veil: 1% x 5 more'); near(veilP(L,false),0.449+0.05+0.20,'Hard to Pin: ability hits 4% x 5 more'); setStack(L,'sec',30); near(veilP(L,true),0.449+0.05+0.03,'Spring Wound: at 30 Seconds 1% x 3');
  near(veilP(L,true,false),0,'not up when he does not cast'); v._castT=0.1; V.step(1); V.step(5); assert.ok(win(L,'vim'),'Veil in Motion: up after a cast ends'); near(veilP(L,true,false),0.449+0.08,''); secs(1.5-0.3); assert.ok(win(L,'vim'),''); secs(0.4); assert.ok(!win(L,'vim'),'for 0.5 x 3 s');
  const pv=VMX('SKLV.stormdodge')(VMX('passLv')(v))+0.05+0.03+0.20; v._castT=5; L.T.s.k.sec.n=30; let n=0; for(let i=0;i<300;i++){ const a=v.hp; V.hit(F[0],v,10,{kind:'magic'}); if(v.hp===a) n++; } assert.ok(Math.abs(n/300-pv)<0.09,'the page rolls the larger chance (an ability hit: '+(pv*100).toFixed(1)+'%): '+n+' of 300'); assert.equal(stack(L,'sec'),60,'each of those dodges went onto the watch (the page tells his rows: veiled)');
  v._castT=0; setStack(L,'sec',0); let m=0; for(let i=0;i<600;i++){ const a=v.hp; V.hit(F[1],v,10,{kind:'magic'}); if(v.hp===a) m++; } assert.ok(m>12&&m<50,'Courier\'s Reflex: not casting, 1% x 5 dodged (seeded): '+m+' of 600'); assert.equal(stack(L,'sec'),Math.min(60,3*m),'each dodge: 3 Seconds');
});

test('Fritz / dodges: Counter Spark, Slipstream, Shocking Reply / Slip Away (PICK ONE), Turned Collar',()=>{
  const L=lab(H,S(['hh_4_3','hh_5_2','hh_5_3','hh_12_2']),{foes:3,big:true}), {v,F}=L; noDef(L); F[0].melee=true; F[1].melee=false;
  F[0].stunned=0; const h=F[0].hp; FX.veiled(v,F[0],true,'magic'); near(h-F[0].hp,v.apow*0.45,'Counter Spark: the attacker takes 15% x 3 of his ability power',1e-6);
  near(F[0].stunned,0.6,'Shocking Reply: a melee attacker dodged: stunned 0.6 s',1e-9); assert.ok(win(L,'slip'),'Slipstream');
  F[0].stunned=0; FX.veiled(v,F[0],true,'magic'); near(F[0].stunned,0,'once per enemy every 6 s'); F[1].stunned=0; FX.veiled(v,F[1],true,'magic'); near(F[1].stunned,0,'not a ranged one'); F[0].stunned=F[1].stunned=1e6;
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.85,'Slipstream: 3% x 5 less for 2 s'); secs(2.1); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'then not');
  secs(3.3); F[0].stunned=0; FX.veiled(v,F[0],true,'magic'); near(F[0].stunned,0,'(5.4 s: not yet)'); secs(0.7); F[0].stunned=0; FX.veiled(v,F[0],true,'magic'); near(F[0].stunned,0.6,'6 s later again',1e-9); F[0].stunned=1e6;
  let c=0; for(let i=0;i<300;i++){ v.slow=2; v.slowMul=0.5; FX.veiled(v,F[1],true,'magic'); if(!(v.slow>0)) c++; } assert.ok(c>90&&c<180,'Turned Collar: 15% x 3 of dodges clear his slow: '+c+' of 300');
  const M=lab(H,S(['hh_5_4']),{foes:3,big:true}); M.v.greenCd=5; M.v.blueCd=5; FX.veiled(M.v,M.F[0],true,'magic'); near(M.v.greenCd,4); near(M.v.blueCd,4,'Slip Away: his cooldowns recover 1 s');
  assert.ok(M.v.pulledBy&&M.v.pulledBy.x<M.v.x,'and he slips back from the attacker (2 m)'); near(M.v.pullSpeed,2*V.METER/0.2,''); FX.veiled(M.v,M.F[0],true,'magic'); near(M.v.greenCd,4,'at most once a second'); secs(1.05); FX.veiled(M.v,M.F[0],true,'magic'); near(M.v.greenCd,3,'');
});

test('Fritz / Seconds: Seconds, Ticking, Wound Spring, Pocketed, Stolen Time, Overwound',()=>{
  const L=lab(H,S(['hh_1_1','hh_4_1','hh_2_1','hh_10_1','hh_6_1','hh_12_3','hh_10_3']),{foes:3,big:true}), {v,F}=L;
  assert.equal(stack(L,'sec'),15,'Wound Spring: each wave starts with 5 x 3'); const a0=v.apow, i0=v.atkInterval; setStack(L,'sec',39); V.step(1);
  near(v.apow,a0*(1+0.025*3)/(1+0.025*1),'Seconds: each 10 give 0.5% x 5 ability power'); near(v.atkInterval,i0*(1+0.01*1)/(1+0.01*3),'Ticking: 0.2% x 5 attack speed');
  near(skillRatio(L,F[0],'chainlight'),1,'39: no Overwound'); setStack(L,'sec',40); near(skillRatio(L,F[0],'chainlight'),1.10,'Overwound: at 40 his abilities 2% x 5 more'); near(myHit(L,F[0],{auto:true}),plainHit(L,()=>myHit(L,F[0],{auto:true})),'not his basic attacks');
  setStack(L,'sec',0); for(let i=0;i<13;i++) FX.veiled(v,F[0],true,'magic'); assert.equal(stack(L,'sec'),39,''); near(v.energy,6,'Stolen Time: every 20 Seconds gained (39: once), 2 x 3 energy');
  setStack(L,'sec',45); V.wave(); V.step(1); assert.equal(stack(L,'sec'),30+15,'Pocketed: up to 10 x 3 kept, Wound Spring adds');
  const M=lab(H,S(['hh_1_1']),{foes:3,big:true}); setStack(M,'sec',33); V.wave(); V.step(1); assert.equal(stack(M,'sec'),0,'without them a wave starts at 0');
});

test('Fritz / at 60 Seconds: Minute Hand, Stopped Clock, The Watch Ticks (SIGNATURE)',()=>{
  { const L=lab(H,S(['hh_1_1','hh_10_3']),{foes:3,big:true}), {v,F}=L; noDef(L); setStack(L,'sec',60);
    const pl=plainHit(L,()=>{ const h=F[1].hp; castCL(L,F[1]); return h-F[1].hp; }); setStack(L,'sec',60); const h=F[1].hp; castCL(L,F[1]); near(h-F[1].hp,pl*1.30,'Minute Hand: at 60 his next ability 10% x 3 more');
    assert.equal(stack(L,'sec'),30,'it spends 30'); const g=F[1].hp; castCL(L,F[1]); near(g-F[1].hp,pl,'the next is plain'); }
  { const L=lab(H,S(['hh_1_1','hh_10_1','hh_11_1']),{foes:3,big:true}), {v,F}=L; v.greenCd=5; v.blueCd=5; setStack(L,'sec',58); FX.veiled(v,F[0],true,'magic');
    assert.equal(stack(L,'sec'),0,'Stopped Clock: at 60 the Seconds are spent'); near(v.greenCd,0); near(v.blueCd,0,'and his cooldowns finish at once'); v.greenCd=5; setStack(L,'sec',58); FX.veiled(v,F[0],true,'magic'); near(v.greenCd,5,'once a wave'); assert.equal(stack(L,'sec'),60,''); }
  { const W=lab(H,S(['hh_1_1','hh_13_3']),{foes:3,big:true}); setStack(W,'sec',58); FX.veiled(W.v,W.F[0],true,'magic'); assert.equal(stack(W,'sec'),0,''); secs(19.6); setStack(W,'sec',58); FX.veiled(W.v,W.F[0],true,'magic');
    assert.equal(stack(W,'sec'),60,'The Watch Ticks at most every 20 s (19.6 s: it waits, full)'); secs(0.5); FX.veiled(W.v,W.F[0],true,'magic'); assert.equal(stack(W,'sec'),0,'20 s: the next dodge at full makes it tick'); }
  const L=lab(H,S(['hh_1_1','hh_13_3','hh_11_1','hh_10_1']),{foes:5,big:true}), {v,F}=L; at(L,F[1],4.5+7,0); at(L,F[2],30,0); v.greenCd=5;
  for(const f of F) f.stunned=0; setStack(L,'sec',58); FX.veiled(v,F[0],true,'magic'); assert.equal(stack(L,'sec'),0,'The Watch Ticks: at 60 it ticks, the Seconds spent'); near(v.greenCd,5,'(the signature goes first: no Stopped Clock)');
  near(F[0].stunned,1.5,'every enemy within 8 m is stunned 1.5 s',1e-9); near(F[1].stunned,1.5,'F1 7.93 m body to body',1e-9); near(F[2].stunned,0,'not one 30 m away'); for(const f of F) f.stunned=1e6;
  near(FX.veil(v,F[0],true,'magic',false,0.449),0.60,'Static Veil up, 60%'); delete v.pass.stormdodge;
  const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); V.hit(F[1],v,1000,{kind:'true'}); near(v.hp,h,'every hit in the 1.5 s is a Late Blow'); secs(1.1); near(h-v.hp,2000,'(they land 1 s later)',1e-9);
  secs(0.5); const g=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(g-v.hp,1000,'after 1.5 s not'); near(FX.veil(v,F[0],true,'magic',false,0.449),0.60,''); secs(2.5); near(FX.veil(v,F[0],true,'magic',false,0.449),0,'the veil for 4 s');
  for(const f of F) f.stunned=0; setStack(L,'sec',58); FX.veiled(v,F[0],true,'magic'); near(F[0].stunned,0,'at most every 20 s'); assert.equal(stack(L,'sec'),0,'(Stopped Clock took them instead)'); near(v.greenCd,0,'');
});

test('Fritz / Late Blows: Late Blows, Further Ahead, Never There, Behind Schedule, Caught Up, Second Look',()=>{
  const L=lab(H,S(['hh_1_4','hh_2_4','hh_3_4','hh_6_4','hh_8_4','hh_1_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; v.maxHp=1e6; v.hp=5e5;
  const h=v.hp; v._lastHitKind=null; V.hit(F[0],v,1000,{kind:'true'}); near(v.hp,h,'Late Blows: the first hit does nothing now'); assert.equal(v._lastHitKind,null,'the page left it as a miss (nothing of the hit ran now)'); secs(0.9); near(v.hp,h,''); secs(0.2);
  near(h-v.hp,1000*0.70-1e6*0.03,'it lands 1 s later, 6% x 5 smaller; Caught Up: he regains 1% x 3 of his max HP',1e-9); assert.equal(stack(L,'sec'),5,'a Late Blow: 5 Seconds');
  const g=v.hp; V.hit(F[1],v,1000,{kind:'true'}); near(g-v.hp,1000,'the next hit lands as normal');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.90,'Behind Schedule: the late attacker deals 2% x 5 less'); near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})))*0.90,'to his allies too');
  secs(3); near(hitOn(L,v,1000,{src:F[0]}),1000,'for 3 s'); secs(5-4.1-0.2); const k=v.hp; V.hit(F[1],v,1000,{kind:'true'}); near(k-v.hp,1000,'Further Ahead: (4.8 s: not yet)'); secs(0.3); const k2=v.hp; V.hit(F[1],v,1000,{kind:'true'}); near(v.hp,k2,'every 8 - 3 s');
  v._castT=2; secs(1.1); near(v.hp,k2+1e6*0.03,'Never There: a Late Blow that lands while he casts misses (Caught Up still heals: a Late Blow came)'); assert.equal(stack(L,'sec'),10,'(still a Late Blow: 5 Seconds)'); v._castT=0;
  secs(2.6); L.T.s.w.wtl={t:1,n:1,cdT:0,at:-1,wave:false}; const q=v.hp; V.hit(F[1],v,1000,{kind:'true'}); V.hit(F[1],v,1000,{kind:'true'}); secs(1.1); near(q-v.hp,1000*0.70+1000*0.70*0.90-1e6*0.03,'two Late Blows landing together: Caught Up once (at most once every 2.5 s; the second hit already Behind Schedule)',1e-9);
  L.T.s.w.wtl={t:1,n:1,cdT:0,at:-1,wave:false}; const q2=v.hp; V.hit(F[1],v,1000,{kind:'true'}); V.wave(); secs(1.5); near(v.hp,q2,'a Late Blow still on its way when a new wave starts is lost');
  const M=lab(H,S(['hh_9_4']),{foes:3,big:true}), w=M.v; w.maxHp=1e5; w.hp=5000; w.shield=0; V.hit(M.F[0],w,8000,{kind:'true'}); assert.ok(w.alive&&w.hp===5000,'Second Look: a killing hit becomes a Late Blow');
  w.hp=w.maxHp; secs(1.1); near(w.hp,w.maxHp-8000,'it still lands, 1 s later'); w.hp=5000; V.hit(M.F[0],w,8000,{kind:'true'}); assert.ok(!w.alive,'once a wave');
});

test('Fritz / Running Late, Glancing, Insulated Coat, Unhurried, Shaken Off, cooldowns, speed',()=>{
  let s0=0; plain({foes:3},P=>{ s0=P.v.speed; });
  const L=lab(H,S(['hh_7_1','hh_11_2','lw_12_4','hh_11_4','hh_5_1','lw_9_2','hh_3_1','sc_11_1','hh_1_3','sc_1_4','hh_10_2']),{foes:3,big:true}), {v,F}=L; noDef(L);
  near(skillRatio(L,F[0],'stormsurge'),1.10,'Running Late: his abilities 2% x 5 more'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*1.075,'and he takes 1.5% x 5 more from abilities');
  near(hitOn(L,v,1000,{auto:true}),plainHit(L,()=>hitOn(L,v,1000,{auto:true}))*(1-0.075),'Glancing: basic attacks 1.5% x 5 less (not an ability)');
  near(hitOn(L,v,1000,{kind:'magic'}),plainHit(L,()=>hitOn(L,v,1000,{kind:'magic'}))*1.075*0.91,'Insulated Coat: magic 3% x 3 less');
  near(myHit(L,F[0],{auto:true}),plainHit(L,()=>myHit(L,F[0],{auto:true}))*1.15,'Unhurried: his basic attacks 3% x 5 more');
  ccOn(F[0],v,'silencedT',1); near(v.silencedT,V.ccNerf*0.82,'Shaken Off: 6% x 3 shorter (18%)',1e-9); v.silencedT=0;
  near(FX.cd(v,'green',8),8*0.95*0.95*0.97,'Watch Hand, Clockwork 1% x 5, Ready Hands 1% x 3: his cooldowns shorter'); near(FX.cd(v,'blue',7),7*0.95*0.95*0.97,'');
  near(v.speed,s0*1.28,'Quickstep 3% x 3, Courier\'s Pace 3% x 3, Light Feet 2% x 5 (not casting): 28% faster'); v._castT=1; V.step(1); near(v.speed,s0*1.18,'Light Feet: not while casting');
});

/* ============================== THE STORM COURIER ============================== */
test('Fritz / Miles: Miles, Quick Turn, Long Route, Well Travelled, Familiar Roads, Wayfinder',()=>{
  const L=lab(H,S(['sc_1_1','sc_3_1','sc_2_1','sc_8_1','sc_12_1','sc_4_1']),{foes:1,allies:2,big:true}), {v,F,A}=L;
  assert.equal(stack(L,'miles'),10,'Well Travelled: each wave starts with 2 x 5'); assert.equal(L.T.st.miles.max,35,'Long Route: up to 20 + 5 x 3');
  at(L,F[0],60,0); const sp=v.speed; go(L); v.speed=sp; let d=0, px=v.x, py=v.y; for(let i=0;i<150;i++){ V.step(1); d+=Math.hypot(v.x-px,v.y-py)/V.METER; px=v.x; py=v.y; }
  assert.ok(d>6,'(he walked '+d.toFixed(1)+' m)'); assert.equal(stack(L,'miles'),10+Math.floor(d/3+1e-9),'every 3 m he moves: a Mile'); v.stunned=1e6;
  v.x=300; v.y=700; at(L,A[0],0,-5.5); at(L,A[1],0,-11); setStack(L,'miles',20); V.step(2); const e=L.T.s.au.find(x=>x.x===A[0]); assert.ok(e,'an ally within 5 m');
  near(e.ap.aspd,1+0.01*20,'Miles: 0.2% x 5 attack speed per Mile'); near(e.ap.move,1.10,'Wayfinder: 2% x 5 faster');
  assert.ok(!L.T.s.au.find(x=>x.x===A[1]&&(x.ap.aspd||1)>1),'not one 7.4 m away'); assert.ok(!L.T.s.au.find(x=>x.x===v),'nor himself');
  const s1=v.speed; setStack(L,'miles',25); V.step(1); near(v.speed,s1*(1+0.05*5)/(1+0.05*4),'Quick Turn: 1% x 5 faster per 5 Miles');
  V.wave(); V.step(1); assert.equal(stack(L,'miles'),15+10,'Familiar Roads: up to 5 x 3 kept, Well Travelled adds');
  const M=lab(H,S(['sc_1_1']),{foes:1,big:true}); setStack(M,'miles',12); V.wave(); V.step(1); assert.equal(stack(M,'miles'),0,'without them a wave starts at 0');
});

test('Fritz / Miles: Rain Cloak, Road Worn, Moving Target, Tailwind',()=>{
  const L=lab(H,S(['sc_1_1','sc_5_4','sc_6_1','sc_n2','sc_9_1']),{foes:3,allies:2,big:true}), {v,F,A}=L;
  setStack(L,'miles',9); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'9 Miles: no Rain Cloak'); setStack(L,'miles',10); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.925,'Rain Cloak: at 10, 1.5% x 5 less');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})))*0.95,'Road Worn: an ally within 5 m 0.5% x 5 less per 5 Miles (10: 2)');
  near(lost(A[1],()=>V.hit(F[0],A[1],1000,{kind:'true'})),1000,'not one 7.4 m away'); setStack(L,'miles',30); near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),1000*0.90,'up to 10% (30 Miles would be 15%)'); setStack(L,'miles',20);
  L.T.s.moved=true; near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.925*0.90,'Moving Target: while he moves 2% x 5 less'); L.T.s.moved=false;
  A[0].maxHp=1e6; A[0].hp=5e5; v.maxHp=1e6; v.hp=5e5; L.T.s.lim['sc_9_1#0'].acc=0; const a=A[0].hp; secs(1.02); near(A[0].hp-a,1e6*0.01,'Tailwind: at 20 Miles an ally within 5 m regains 0.2% x 5 a second',1e-3); near(v.hp,5e5,'(not himself)');
  setStack(L,'miles',19); const b=A[0].hp; secs(1.1); near(A[0].hp,b,'not below 20 Miles');
});

test('Fritz / Parcels: Parcel, Second Round, Signed For, Charged Parcel (LINK), Prompt Delivery, Coat Pockets',()=>{
  const L=lab(H,S(['sc_1_3','sc_2_3','sc_3_3','sc_n1','sc_5_3','sc_12_4','lw_1_1']),{foes:3,allies:2,big:true}), {v,F,A}=L; v.maxHp=1e6; v.hp=5e5;
  A[0].energy=40; A[1].energy=10; A[1].maxHp=1e6; A[1].hp=5e5; A[1].greenCd=5; A[1].blueCd=5; const ch=stack(L,'charge'); castCL(L,F[0]);
  near(A[1].energy,10+20,'Parcel: the ally with the least energy gets 4 x 5'); near(A[0].energy,40,''); near(A[1].shield,v.apow*0.2,'Signed For: a shield of 20% of his ability power'); near(A[1].hp,5e5+3e4,'Charged Parcel: healed 3% of its max HP');
  near(A[1].greenCd,4); near(A[1].blueCd,4,'Prompt Delivery: 0.2 x 5 s off its cooldowns'); near(v.hp,5e5+1e6*0.025,'Coat Pockets: he regains 0.5% x 5'); assert.equal(stack(L,'charge'),ch+3+1,'with Bottled Storm: 1 Charge per delivery (and 3 hits)');
  for(let i=0;i<3;i++) castCL(L,F[0]); assert.equal(L.T.s.par,0,'Second Round: 1 + 3 Parcels this wave'); const e=A[0].energy+A[1].energy; castCL(L,F[0]); near(A[0].energy+A[1].energy,e,'then none');
  V.wave(); V.step(1); assert.equal(L.T.s.par,4,'a new wave: 4 again');
  const M=lab(H,S(['sc_n1']),{foes:3,allies:1,big:true}); M.A[0].hp=M.A[0].maxHp*0.5; const g=M.A[0].hp; castCL(M,M.F[0]); near(M.A[0].hp,g,'Charged Parcel without Parcel: no Parcel to deliver');
  const N=lab(H,S(['sc_1_3','sc_n1']),{foes:3,allies:1,big:true}); castCL(N,N.F[0]); assert.equal(stack(N,'charge'),3,'without Bottled Storm a delivery adds no Charge (3 hits: 3)');
});

test('Fritz / Parcels: Express, Full Satchel, Priority Mail, Forwarding Address, Extra Postage',()=>{
  const L=lab(H,S(['sc_1_3','sc_6_3','sc_8_3','sc_10_3','sc_n3','sc_11_3']),{foes:3,allies:3,big:true}), {v,F,A}=L; noDef(L);
  A[0].energy=10; A[1].energy=80; A[2].energy=99.5; const s2=A[2].speed, p2=A[2].apow; castCL(L,F[0]);
  near(A[2].energy,100,'Priority Mail: an ally at 70+ whose ultimate is not ready, the closest to full, first (4 x 5 + 1 x 5)'); near(A[1].energy,80,'');
  near(A[0].energy,10+24.5*0.9,'Forwarding Address: the 24.5 that did not fit, 30% x 3 to the ally with the next least energy');
  V.step(2); near(A[2].speed,s2*1.15,'Express: 5% x 3 faster'); near(A[2].apow,p2*1.06,'Extra Postage: 2% x 3 ability power');
  near(lost(F[1],()=>V.hit(A[2],F[1],1000,{kind:'true'})),plainHit(L,()=>lost(F[1],()=>V.hit(A[2],F[1],1000,{kind:'true'})))*1.06,'Full Satchel: it deals 2% x 3 more');
  near(lost(F[1],()=>V.hit(A[1],F[1],1000,{kind:'true'})),1000,'(not another ally)');
  secs(3.1); near(A[2].speed,s2,'Express for 3 s'); secs(1); near(lost(F[1],()=>V.hit(A[2],F[1],1000,{kind:'true'})),1000,'Full Satchel for 4 s'); secs(1); near(A[2].apow,p2,'Extra Postage for 5 s');
  const M=lab(H,S(['sc_1_3']),{foes:3,allies:2,big:true}); M.A[0].energy=10; M.A[1].energy=80; castCL(M,M.F[0]); near(M.A[0].energy,30,'without Priority Mail: the least energy'); near(M.A[1].energy,80,'');
});

test('Fritz / Shared Storm, Shower Shelter, Rain on Them, Handed Over, The Last Delivery (SIGNATURE)',()=>{
  const L=lab(H,S(['sc_7_3','sc_10_1','sc_11_2','sc_12_2','sc_13_2','sc_1_3']),{foes:3,allies:3,big:true}), {v,F,A}=L; noDef(L);
  at(L,A[0],4.5,-3); at(L,A[1],4.5,3); at(L,A[2],0,-14); for(const a of A) a.energy=0; castCL(L,F[0]); for(const a of A) a.energy=0; assert.equal(L.T.s.par,0,'(the wave\'s Parcel delivered)');
  storm(L,F[0]); near(skillRatio(L,F[1],'thundershower'),1.20,'Rain on Them: 2% x 5 for each ally inside (2)');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})))*0.94,'Shower Shelter: an ally inside 2% x 3 less'); near(lost(A[2],()=>V.hit(F[0],A[2],1000,{kind:'true'})),1000,'not one outside');
  for(const a of A) a.energy=0; secs(0.55); near(A[0].energy,5,'Shared Storm: each pulse an ally inside 1 x 5'); near(A[2].energy,0,'not one outside'); at(L,A[1],0,-20); A[1].x+=0; secs(2.2); const e0=A[0].energy; near(A[1].energy,5,'(A1 left after one pulse)');
  secs(1); assert.ok(!(v._stormT>0),'(over)'); near(A[2].energy,50,'The Last Delivery: the ally with the least energy +50 (A2: 10.4 m from him, no 20)'); near(A[1].energy,5+9,'Handed Over: an ally that stood in it +3 x 3');
  near(A[0].energy-e0,(A[0].energy-e0>=29+5-1e-9)?29+5:29,'A0: +9 Handed Over, +20 within 8 m (and the last pulse)'); assert.equal(L.T.s.par,3,'and 3 fresh Parcels');
  V.step(2); const e=L.T.s.au.find(x=>x.x===A[0]); near(e&&e.ap.move,1.20,'and moves 20% faster'); secs(4.1); const e2=L.T.s.au.find(x=>x.x===A[0]); assert.ok(!e2||!e2.ap.move||e2.ap.move===1,'for 4 s');
  for(const a of A) a.energy=0; at(L,A[1],4.5,3); storm(L,F[0]); secs(3.5); near(A[2].energy,0,'once a fight');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Fritz: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['lw_1_1','lw_1_4','lw_2_4','lw_5_3','lw_4_3','lw_2_3','hh_1_1','hh_1_4','hh_3_3','sc_1_1','sc_1_3','sc_2_3']), TEAM=['vael','sylthaine','vireo','vex','fritz'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let cnd=false, late=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); late=Math.max(late,T0.lq.length);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(o&&o.cond) cnd=true; } }
  assert.ok(mx.charge>=5,'real spells gave Charge: '+mx.charge); assert.ok(cnd,'a real Conductor'); assert.ok(mx.miles>=5,'real walking gave Miles: '+mx.miles);
  console.log('  live fight: max '+JSON.stringify(mx)+', Conductor '+cnd+', late blows on the way '+late+', parcels left '+s._tal.s.par);
  determinism(H,TEAM);
});

/* The page sites his talents added (veil / veiled at Static Veil, skillTgt / num / landPre / land at Storm Surge's bolts, chainEnd after Chain Lightning's
   jumps): with nothing learned, whole seeded fights with Fritz in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Fritz: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['fritz','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __fzN={ss:0,cl:0,ts:0,bolts:0,veil:0}; var __fzD=_doEffectCore, __fzDD=_dealDamageCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="fritz"&&(!o||!o.deliver||o._arrived)){ if(type==="stormsurge") __fzN.ss++; if(type==="chainlight") __fzN.cl++; if(type==="thundershower") __fzN.ts++; } return __fzD.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt,amt,color,kind){ if(src&&src.key==="fritz"&&color==="#f2e07a"&&kind==="magic") __fzN.bolts++; if(tgt&&tgt.key==="fritz"&&((tgt._stormT||0)>0||(tgt._castT||0)>0)) __fzN.veil++; return __fzDD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__fzN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.ss>0&&c.cl>0&&c.ts>0&&c.bolts>0&&c.veil>0,'the fights cast Storm Surge ('+c.ss+', '+c.bolts+' bolts struck), Chain Lightning ('+c.cl+'), Thunder Shower ('+c.ts+') and hit him while Static Veil was up ('+c.veil+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__fzD; _dealDamageCore=__fzDD;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage-reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ lw:['lw_n1','lw_12_4','lw_10_1','lw_1_4'],
            hh:['hh_1_4','hh_2_4','hh_5_2','hh_8_3','hh_11_2','hh_6_4','hh_12_4','hh_7_4','hh_3_3'],
            sc:['sc_5_4','sc_n2','sc_2_4','sc_10_4','sc_1_1','sc_10_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={lw:0,hh:1,sc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)&&['hh_7_1','lw_n2'].indexOf(t[0])<0).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (the attacker a Conductor and late, Slipstream up, channelling and moving,
   20 Miles, a basic attack of magic damage, the hit a Late Blow), as a normal hit and a critical one; a Late Blow is measured when it lands */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:3,cold:true}), {v,F}=L; V.step(1); const f=F[0]; delete v.pass.stormdodge;
  v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=v.blueCd=1e9; V.step(2); v.maxHp=1e9; v.hp=5e8; v.shield=0;
  if(L.T){ setCond(L,f); setStack(L,'miles',20); L.T.s.w.slip={t:99,n:1,cdT:0,at:-1,wave:false}; const m=f._talM[v.uid]; m.bsch={t0:V.now(),until:V.now()+99,v:0}; v._stormT=99; v._stormX=f.x; v._stormY=f.y; v._stormR=6*V.METER; L.T.s.moved=true; L.T.s.lateAt=0; }
  const raw=1e6, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:true}); if(L.T) L.T.s.moved=true; secs(1.1); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Fritz: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[[['hh','sc'],[61,30]],[['sc','hh'],[61,30]],[['hh','lw'],[61,30]],[['lw','hh'],[61,30]],[['sc','lw'],[61,30]],[['lw','sc'],[61,30]],[['hh'],[91]],[['sc'],[91]],[['lw'],[91]],[['hh','sc','lw'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  /* seeded fights: every hit on him that removed HP or shield, against its size before his defences; a Late Blow counted when it lands, against the hit it came from */
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0,late:0}, __lr=[]; var __ddc=_dealDamageCore, __ubc=_updateBattleCore, __dmg=damage;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="fritz"&&src&&src.team!==tgt.team; let h0=0, q0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; q0=tgt._tal?tgt._tal.s.lq.length:0; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt); if(tgt._tal&&tgt._tal.s.lq.length>q0) __lr.push(raw); else { const l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } } return r; };'+
    'damage=function(u,a,c,ne,cr){ if(u&&u.key==="fritz"&&c==="#c9a6ff"&&__lr.length){ const raw=__lr.shift(), h0=u.hp+(u.shield||0); const r=__dmg.apply(this,arguments); const l=h0-u.hp-(u.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; __dr.late++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } return r; } return __dmg.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="fritz"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } const r=__ubc.apply(this,arguments); for(const u of units) if(u&&u.key==="fritz"&&u._tal){ while(__lr.length>u._tal.s.lq.length) __lr.shift(); } return r; };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','fritz'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits ('+d.late+' Late Blows), the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>40&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc; damage=__dmg;'); }
});
