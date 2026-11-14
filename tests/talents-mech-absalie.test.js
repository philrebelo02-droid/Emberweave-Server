'use strict';
/* Absalie's talents as data on the mechanics layer (talents-mech/absalie.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured in a plain lab (or with her
   talents switched off for one hit) BEFORE the talented lab is built: lab() replaces the whole field.
   Places (metres from Absalie): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). Bodies: hers 1.56 m, theirs 2.01 m.
   Run: node --test tests/talents-mech-absalie.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='absalie', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };   // (t: a fresh lapse clock)
const sure=L=>{ for(const f of L.F) f.level=1; };                                   // controls from her skills always land (no level-gap miss roll)
const noMr=L=>{ for(const f of L.F) f.mrRating=0; };                                // her hits land as computed (her damage is magic)
const aim=(L,x,y)=>{ L.v._aimWX=L.v.x+x*V.METER; L.v._aimWY=L.v.y+y*V.METER; };
const cast=(L,slot,x,y)=>{ aim(L,x,y); try{ V.cast(L.v,slot); } finally{ L.v._aimWX=null; L.v._aimWY=null; } };
const collapse=L=>{ for(let i=0;i<200&&L.v._horizon;i++) V.step(1); assert.ok(!L.v._horizon,'Event Horizon collapsed'); };   // step until the singularity has collapsed
const needle=(L,t)=>V.cast(L.v,'green',t);
const losses=(L,fn)=>{ const h=L.F.map(f=>f.hp+(f.shield||0)); fn(); return L.F.map((f,i)=>h[i]-f.hp-(f.shield||0)); };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const still=L=>{ for(const f of L.F){ f.stunned=0; f.speed=0; } };                 // free of the lab's hold, but they do not walk
const thr=(L,t)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#thr']; return (m&&V.now()<m.until)?m.v:0; };
const thrUntil=(L,t)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#thr']; return m?m.until:null; };
const markUntil=(L,t,name)=>{ const m=t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]; return m?m.until:null; };
const metres=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/V.METER;
const casting=(f,spell)=>{ f._pend={t:5,spell:spell!==false,fire(){}}; f._castNow=5; };   // an enemy part-way through a cast (the engine's own pending cast)
const VMX=s=>vm.runInContext(s,NOW.ctx);

test('Absalie: every talent is accounted for - 9 plain stats, 109 with rows, none waiting',()=>{
  accounting(H,[118,9,109,0,0]);
  const M=FXN.mech(H); for(const id of ['ec_1_1','gk_1_1','us_1_1','ec_13_3','gk_13_2','us_13_3']) assert.ok(M.talents[id],id);
  for(const id of ['ec_10_3','gk_11_2','us_6_4']) assert.ok(!FXN.has(H,id)&&M.talents[id],id+': "Absalie\'s ultimate energy fills faster" is a row, not a plain stat');
});

test('Absalie: her real kit, as the talents read it - Event Horizon really drags, its silence is written straight on; the Knot forms on her; Dark Convergence pays at the Knot press',()=>{
  plain({foes:3},P=>{ const {v,F}=P; sure(P); still(P); noMr(P); const x0=F.map(f=>[f.x,f.y]);
    cast(P,'ult',10,0); assert.ok(F.every(f=>f.pullT>0&&f.pullStop===6),'the ultimate sets a drag with a stopping distance on every enemy within 7 m');
    near(v.energy,0,'Dark Convergence gives nothing for the ultimate'); collapse(P);
    assert.ok(metres(F[2],{x:x0[2][0],y:x0[2][1]})>3,'and it really moves them toward its centre (unlike Collapsing Star)');
    assert.ok(F.every(f=>f.silencedT>1.0&&f.silencedT<=1.05+1e-9),'the collapse silences each caught enemy 1.05 s (the control table 1.5 s, cut by 30%)');
    at(P,F[0],3,0); at(P,F[1],0,-2.5); V.cast(v,'blue'); near(metres(F[0],v),3*0.4,'the Knot moves an enemy 3 m from her 60% of the way to her',1e-6);
    assert.ok(F[0].slow>0&&F[1].slow>0&&!(F[2].slow>0),'and slows the enemies within 4 m of HER (centre to centre)');
    const press=VMX('castKit'), cancel=VMX('castCancel'); v.energy=0; press(v,v.blueAb); cancel(v,''); near(v.energy,12*v.passMul,'Dark Convergence: 4 x 3 energy x her passive level at the Knot press, however many it will hit');
    v.energy=0; press(v,v.greenAb); cancel(v,''); near(v.energy,0,'nothing for the Needle (one target)'); });
});

test('Absalie / Threads: Fray, Loose Ends, Unwoven, Unravelling, Last Stitch, Frayed Edge, Coming Apart, Pulled Thread',()=>{
  const O={foes:3}, pN=plain(O,P=>{ noMr(P); return lost(P.F[0],()=>needle(P,P.F[0])); });
  const L=lab(H,S(['ec_1_1','ec_2_1','ec_3_1','ec_12_1','ec_11_2','ec_9_1','ec_n2','ec_4_1']),{foes:3,big:true}), {v,F}=L, f=F[0]; noMr(L); const sp=f.speed;
  near(lost(f,()=>needle(L,f)),pN,'the first Needle: no Thread on it yet'); assert.equal(thr(L,f),1,'Fray: each Needle pulls a Thread'); near(thrUntil(L,f)-V.now(),8+3,'Loose Ends: 8 s + 1 x 3');
  V.step(1); near(f.speed,sp*0.95,'Pulled Thread: 1% x 5 slower per Thread'); assert.equal(F[1].speed,F[1].speed,'');
  needle(L,f); needle(L,f); near(lost(f,()=>needle(L,f)),pN,'three Threads: no Unwoven, no Last Stitch'); assert.equal(thr(L,f),4,'max 4');
  V.step(1); near(f.speed,sp*0.80,'4 Threads: 20% slower');
  const au=plainHit(L,()=>lost(f,()=>V.hit(v,f,1000,{auto:true}))); near(lost(f,()=>V.hit(v,f,1000,{auto:true})),au*1.40,'Frayed Edge: her basic attacks 2% x 5 more per Thread');
  near(lost(f,()=>V.hit(v,f,1000)),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000))),'not her other hits');
  const bIn=plainHit(L,()=>lost(v,()=>V.hit(f,v,1000))); near(lost(v,()=>V.hit(f,v,1000)),bIn*0.925,'Coming Apart: an enemy with a Thread deals 1.5% x 5 less to her'); near(lost(v,()=>V.hit(F[1],v,1000)),bIn,'one without: no');
  const e0=v.energy; near(lost(f,()=>needle(L,f)),pN*1.6*1.24,'Unwoven at 4 Threads: 60% more; Last Stitch: 8% x 3 more'); assert.equal(thr(L,f),0,'and the Threads clear');
  near(v.energy-e0,4*5,'Unravelling: 4 Threads cut, 1 energy each per rank'); V.step(1); near(f.speed,sp,'no Thread: no slow');
  near(lost(f,()=>needle(L,f)),pN,'the next Needle starts again'); secs(10.8); assert.equal(thr(L,f),1); secs(0.3); assert.equal(thr(L,f),0,'the Thread lapses 11 s after the last'); V.step(1); near(f.speed,sp);
  const N=lab(H,S(['ec_1_1']),O); needle(N,N.F[0]); near(thrUntil(N,N.F[0])-V.now(),8,'without Loose Ends: 8 s'); for(let i=0;i<5;i++) needle(N,N.F[0]); assert.equal(thr(N,N.F[0]),4,'without Unwoven: they stay at 4');
});

test('Absalie / Fray and Fine Point read the enemy\'s magic resist: each Thread 1% x 5 of it ignored, the Needle 1% x 5 more',()=>{
  const L=lab(H,S(['ec_1_1','ec_8_3']),{foes:2}), {v,F}=L, f=F[0]; f.mrRating=300;
  const mr=(k,fn)=>{ const sv=f.mrRating; f.mrRating=sv*k; try{ return plainHit(L,fn); } finally{ f.mrRating=sv; } };
  near(lost(f,()=>V.hit(v,f,1000)),mr(1,()=>lost(f,()=>V.hit(v,f,1000))),'no Thread yet: as plain');
  needle(L,f); needle(L,f); assert.equal(thr(L,f),2);
  near(lost(f,()=>V.hit(v,f,1000)),mr(0.90,()=>lost(f,()=>V.hit(v,f,1000))),'2 Threads: her hits ignore 10% of its magic resist (read through the engine\'s own resist)');
  const x1=mr(1,()=>lost(f,()=>needle(L,f))), x9=mr(0.90,()=>lost(f,()=>needle(L,f))), x95=mr(0.95,()=>lost(f,()=>needle(L,f)));   // plain Needles: the cut is already at its full depth
  near(lost(f,()=>needle(L,f)),x9*x95/x1,'the Needle: the Threads\' 10%, then Fine Point\'s 1% x 5 (each read through the engine\'s resist)');
  near(lost(F[1],()=>V.hit(v,F[1],1000)),plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000))),'an enemy with no Thread: as plain');
});

test('Absalie / Hollow: Hollow, Set Place, Gutted Ward, Nothing Left, Cold Plate, Narrow Gap, Pale Loom',()=>{
  const L=lab(H,S(['ec_2_2','ec_8_2','ec_4_2','ec_6_2','ec_8_4','ec_10_2','ec_11_3']),{foes:3,allies:1}), {v,F,A}=L, f=F[0]; noMr(L); sure(L);
  needle(L,f); assert.ok(mark(L,f,'hol'),'a Needle makes it Hollow'); near(markUntil(L,f,'hol')-V.now(),5+1.5,'for 5 s, Set Place 0.5 x 3 longer');
  const bA=plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000)));
  near(lost(f,()=>V.hit(A[0],f,1000)),bA*1.075,'Nothing Left: a Hollow enemy takes 1.5% x 5 more from her whole team');
  f.shield=1e7; f.shieldT=99; near(lost(f,()=>V.hit(A[0],f,1000)),bA*1.20*1.075,'Hollow: while it has a shield, hits on it deal 4% x 5 more');
  f.shield=100; const ap=v.apow; near(lost(f,()=>V.hit(A[0],f,1000)),bA*1.20*1.075,'a hit that breaks the shield');
  near(lost(f,()=>V.step(1)),0.30*ap,'Gutted Ward: then it takes 10% x 3 of her ability power'); near(lost(f,()=>V.step(2)),0,'once');
  const h=f.hp; f.hp-=5000; f._healCutUntil=0; f.mortalT=0; V.heal(f,1000); near(f.hp-(h-5000),900,'Hollow: healing on it 2% x 5 weaker');
  const bIn=plainHit(L,()=>lost(v,()=>V.hit(f,v,1000))); near(lost(v,()=>V.hit(f,v,1000)),bIn*0.91,'Cold Plate: she takes 3% x 3 less from a Hollow enemy'); near(lost(v,()=>V.hit(F[1],v,1000)),bIn);
  at(L,f,0,3); at(L,F[1],3,0); const k=losses(L,()=>V.cast(v,'blue')); assert.ok(k[1]>0); near(k[0],k[1]*1.20*1.075,'Narrow Gap: the Knot deals 4% x 5 more to a Hollow enemy');
  at(L,f,8,1); at(L,F[1],8,-1); const u=losses(L,()=>{ cast(L,'ult',8,0); collapse(L); }); near(u[0],u[1]*1.15*1.075,'Pale Loom: Event Horizon 3% x 5 more to a Hollow enemy');
  secs(6.6-V.now()+markUntil(L,f,'hol')-6.5); V.step(1); assert.ok(!mark(L,f,'hol'),'Hollow lapses'); near(lost(f,()=>V.hit(A[0],f,1000)),bA,'and its effects stop');
});

test('Absalie / the Needle itself: Point of Nothing, Long Shred, Empty Hands, Long Needle, Hollow Crown, No One Home, Quick Needle, Patient Hands',()=>{
  const O={foes:3}, pl=plain(O,P=>{ noMr(P); const d=lost(P.F[1],()=>needle(P,P.F[1])); return {d,sh:P.F[1]._mrShredPct,t:P.F[1]._mrShredT}; });
  const L=lab(H,S(['ec_1_4','ec_3_4','ec_7_4','ec_5_3','ec_12_3','ec_9_3','ec_2_4','ec_5_4']),O), {v,F}=L; noMr(L); F[0].maxHp=2e9;
  near(lost(F[1],()=>needle(L,F[1])),pl.d*1.12,'Point of Nothing: 4% x 3 more'); near(F[1]._mrShredPct,pl.sh+0.03,'Empty Hands: the resist cut 1 point x 3 deeper'); near(F[1]._mrShredT,pl.t+1.5,'Long Shred: 0.3 s x 5 longer');
  at(L,F[2],30,30); needle(L,F[2]); near(F[2]._mrShredPct,pl.sh+0.03+0.08,'Long Needle: 8 points deeper on an enemy with no other enemy within 3 m');
  near(lost(F[0],()=>needle(L,F[0])),pl.d*1.12*1.09,'Hollow Crown: 3% x 3 more to the enemy with the highest max HP');
  F[1].hp=F[1].maxHp*0.3; near(lost(F[1],()=>needle(L,F[1])),pl.d*1.12*1.10,'No One Home: her abilities 2% x 5 more below 40% HP');
  near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{auto:true}))),'not her basic attacks');
  near(FX.cd(v,'green',6),(6-0.6)*0.95,'Quick Needle 0.2 s x 3, then Patient Hands 1% x 5'); near(FX.cd(v,'blue',10),10*0.95);
});

test('Absalie / Second Needle and Needle\'s Eye (each in its own lab: Second Needle is a PICK ONE)',()=>{
  const O={foes:3}, pN=plain(O,P=>{ noMr(P); return lost(P.F[0],()=>needle(P,P.F[0])); });
  const L=lab(H,S(['ec_5_2']),O); noMr(L); const d=losses(L,()=>needle(L,L.F[0])); near(d[0],pN); near(d[1],pN*0.4,'Second Needle: the nearest other enemy (F1) takes 40% of it'); assert.equal(d[2],0);
  const E=lab(H,S(['ec_2_2','ec_7_2']),O); noMr(E); const a=losses(E,()=>needle(E,E.F[0])); assert.equal(a[1],0,'Needle\'s Eye: the first Needle makes F0 Hollow and stops there');
  const b=losses(E,()=>needle(E,E.F[0])); near(b[0],pN); near(b[1],pN*0.5,'the second passes through the Hollow enemy: 50% to the next enemy'); assert.ok(mark(E,E.F[1],'hol'),'and makes it Hollow');
});

test('Absalie / Empty Place: Empty Place, Wider Gap, Hungry Gap, Long Absence, Unmade Bed',()=>{
  const L=lab(H,S(['ec_2_2','ec_5_1','ec_6_1','ec_7_1','ec_12_2','ec_10_1']),{foes:5}), {v,F}=L; noMr(L); const ap=v.apow;
  needle(L,F[0]); const p0={x:F[0].x,y:F[0].y}; V.dmg(F[0],2e9); assert.ok(!F[0].alive); const z=L.T.s.zn.ep[0];
  near(z.r/V.METER,2+0.9,'an Empty Place where it fell: 2 m, Wider Gap 0.3 x 3 farther'); near(z.until-V.now(),6+3,'Long Absence: 6 s + 1 x 3');
  for(const x of F.slice(1)) at(L,x,30,30+F.indexOf(x)*6);
  const put=(x,d,s)=>{ x.x=p0.x+s*d*V.METER; x.y=p0.y; };
  put(F[1],2.01+2.95,1); const h1=F[1].hp; V.step(2); assert.equal(F[1].hp,h1,'an enemy 2.95 m from it (body edge) is outside 2.9 m');
  put(F[1],2.01+2.85,1); const g=lost(F[1],()=>V.step(1)); near(g,0.08*5*ap,'2.85 m: inside - it takes 8% x 5 of her ability power'); secs(0.35);
  assert.ok(metres(F[1],p0)<0.05,'and is pulled into the middle'); assert.ok(mark(L,F[1],'hol')); near(markUntil(L,F[1],'hol')-V.now(),4.5-0.35-1/30,'Unmade Bed: it is Hollow for 1.5 s x 3',0.02);
  at(L,F[1],30,0); put(F[2],2.01+1,-1); near(lost(F[2],()=>V.step(1)),0.4*ap,'Hungry Gap: a second enemy'); at(L,F[2],30,-10);
  put(F[3],2.01+1,1); near(lost(F[3],()=>V.step(2)),0,'then it closes'); assert.ok(!L.T.s.zc,'no trap left to look after');
  const N=lab(H,S(['ec_5_1']),{foes:3}); needle(N,N.F[0]); V.dmg(N.F[0],2e9); assert.ok(!N.T.s.zn.ep,'without Hollow nobody is Hollow: no Empty Place');
  const M=lab(H,S(['ec_2_2','ec_5_1']),{foes:3}); needle(M,M.F[0]); const q={x:M.F[0].x,y:M.F[0].y}; V.dmg(M.F[0],2e9); near(M.T.s.zn.ep[0].r/V.METER,2); near(M.T.s.zn.ep[0].until-V.now(),6);
  M.F[1].x=q.x+(2.01+1)*V.METER; M.F[1].y=q.y; M.F[2].x=q.x-(2.01+1)*V.METER; M.F[2].y=q.y; const two=losses(M,()=>V.step(1)); assert.equal(two.filter(x=>x>0).length,1,'without Hungry Gap: one enemy only');
  secs(6.1); assert.ok(!M.T.s.zc);
});

test('Absalie / Kept Chair and Void Cloak',()=>{
  const L=lab(H,S(['ec_9_4','ec_11_4']),{foes:2,cold:true}), {v,F}=L; V.step(1);
  const r=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,300)))/300, au=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,300,{auto:true}))); v.hp=v.maxHp;
  near(lost(v,()=>V.hit(F[0],v,300,{auto:true})),au*0.91,'Void Cloak: 3% x 3 less from basic attacks'); near(lost(v,()=>V.hit(F[0],v,300)),r*300,'not from abilities');
  const big=0.4*v.maxHp/r; v.hp=v.maxHp; near(lost(v,()=>V.hit(F[0],v,big)),0.2*v.maxHp,'Kept Chair: a hit that would take 40% of her max HP deals half',1e-6);
  v.hp=v.maxHp; near(lost(v,()=>V.hit(F[0],v,big)),0.4*v.maxHp,'once per wave',1e-6); v.hp=v.maxHp; const sm=0.25*v.maxHp/r; near(lost(v,()=>V.hit(F[0],v,sm)),0.25*v.maxHp,'',1e-6);
  V.wave(); V.step(1); v.hp=v.maxHp; near(lost(v,()=>V.hit(F[0],v,sm)),0.25*v.maxHp,'a hit under 30%: untouched',1e-6); v.hp=v.maxHp; near(lost(v,()=>V.hit(F[0],v,big)),0.2*v.maxHp,'the next wave: again',1e-6);
});

test('Absalie / The Empty Chair (SIGNATURE): the caught enemy with the most Threads is set aside, then comes back Hollow with 4 Threads',()=>{
  const O={foes:3,allies:1}, pN=plain(O,P=>{ noMr(P); return lost(P.F[1],()=>needle(P,P.F[1])); });
  const L=lab(H,S(['ec_1_1','ec_13_3']),O), {v,F,A}=L; noMr(L); sure(L); still(L);
  needle(L,F[1]); needle(L,F[1]); needle(L,F[0]); for(const f of F) f.stunned=0;
  cast(L,'ult',10,0); collapse(L); assert.ok(F[1].stunned>1.95&&F[1].stunned<=2,'F1 (2 Threads) is set aside: stunned 2 s'); assert.ok(!(F[0].stunned>0)&&!(F[2].stunned>0),'only one');
  const bA=plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000))); near(lost(F[1],()=>V.hit(A[0],F[1],1000)),bA*1.15,'her team deals 15% more to it');
  const h=F[1].hp; F[1].hp-=5000; F[1]._healCutUntil=0; F[1].mortalT=0; V.heal(F[1],1000); near(F[1].hp,h-5000,'it cannot be healed');
  secs(2.1); assert.ok(mark(L,F[1],'hol'),'it comes back Hollow'); assert.equal(thr(L,F[1]),4,'with 4 Threads'); near(lost(F[1],()=>V.hit(A[0],F[1],1000)),bA,'set aside no longer');
  near(lost(F[1],()=>needle(L,F[1])),pN*1.6,'her next Needle on it: 60% more'); assert.equal(thr(L,F[1]),0,'and cuts them all'); near(lost(F[1],()=>needle(L,F[1])),pN,'only that one');
  F.forEach(f=>{ f.stunned=0; }); F[0]._raidBoss=true; needle(L,F[0]); needle(L,F[0]); needle(L,F[0]); cast(L,'ult',10,0); collapse(L); assert.ok(F[0].stunned>0.95&&F[0].stunned<=1,'a boss: 1 s');
  const U=lab(H,S(['ec_1_1','ec_3_1','ec_13_3']),O); noMr(U); sure(U); still(U); needle(U,U.F[1]); cast(U,'ult',10,0); collapse(U); secs(2.1); assert.equal(thr(U,U.F[1]),4);
  near(lost(U.F[1],()=>needle(U,U.F[1])),pN*1.6,'with Unwoven: Unwoven makes the cut, never twice (not 1.6 x 1.6)');
});


/* ============================== THE GREAT KNOT ============================== */
test('Absalie / Tangle: Tangle, Snarl, Shared Weight, Pulled Tight, Choke Point, Bound Together, Thread Cloak',()=>{
  const L=lab(H,S(['gk_1_1','gk_2_1','gk_6_1','gk_9_1','gk_5_1','gk_11_1','gk_12_4']),{foes:5,allies:1,big:true}), {v,F,A}=L; noMr(L); const ai=F[0].atkInterval;
  at(L,F[0],3,0); at(L,F[1],0,3); at(L,F[2],-3,0); at(L,F[3],2.5,2.5);
  const bA=plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000))), bIn=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000))), bIA=plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000))), bIn4=plainHit(L,()=>lost(v,()=>V.hit(F[4],v,1000)));
  V.cast(v,'blue'); assert.ok([0,1,2,3].every(i=>mark(L,F[i],'tng'))&&!mark(L,F[4],'tng'),'Tangle: every enemy the Knot catches'); near(markUntil(L,F[0],'tng')-V.now(),3+1.5,'for 3 s, Snarl 0.5 x 3 longer');
  const d=losses(L,()=>V.hit(v,F[0],1000,{auto:true})); for(const i of [1,2,3]) near(d[i],d[0]*(0.20+0.06),'4% x 5 of her hit on one goes to each other Tangled enemy; Shared Weight 2% x 3 more with 4 Tangled'); assert.equal(d[4],0);
  near(lost(F[0],()=>V.hit(A[0],F[0],1000)),bA*1.05,'Pulled Tight: 1% x 5 more from her allies');
  V.step(1); near(F[0].atkInterval,ai/(1-0.075),'Choke Point: they attack 1.5% x 5 slower'); near(F[4].atkInterval,ai);
  near(lost(v,()=>V.hit(F[0],v,1000)),bIn*0.95*0.88,'Bound Together: a Tangled enemy deals 1% x 5 less; Thread Cloak: she takes 1% x 3 less per Tangled enemy');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000)),bIA*0.95,'to her allies too (Bound Together)'); near(lost(v,()=>V.hit(F[4],v,1000)),bIn4*0.88,'Thread Cloak counts the Tangled enemies, whoever hits her');
  secs(4.6); assert.ok(!mark(L,F[0],'tng')); const e=losses(L,()=>V.hit(v,F[0],1000,{auto:true})); assert.equal(e[1],0,'Tangle over: nothing shared'); V.step(1); near(F[0].atkInterval,ai); near(lost(v,()=>V.hit(F[4],v,1000)),bIn4);
  const N=lab(H,S(['gk_1_1','gk_6_1']),{foes:3,big:true}); noMr(N); at(N,N.F[0],3,0); at(N,N.F[1],0,3); at(N,N.F[2],-3,0); V.cast(N.v,'blue'); const g=losses(N,()=>V.hit(N.v,N.F[0],1000,{auto:true}));
  near(g[1],g[0]*0.20,'3 Tangled: no Shared Weight'); near(markUntil(N,N.F[0],'tng')-V.now(),3,'without Snarl: 3 s');
  const C=lab(H,S(['gk_12_4']),{foes:9,big:true}); C.F.slice(0,7).forEach(f=>{ f._talM={[C.v.uid]:{tng:{t0:0,until:1e9,v:0}}}; }); const b9=plainHit(C,()=>lost(C.v,()=>V.hit(C.F[8],C.v,1000)));
  near(lost(C.v,()=>V.hit(C.F[8],C.v,1000)),b9*0.85,'Thread Cloak: up to 5 Tangled enemies');
});

test('Absalie / the Knot: Deeper Pull, Long Reach, Tight Knot, Pull of Home, Hard Pull, Quiet Hands, Leaning In, Dense Weave, Gravity Well, Converging Lines',()=>{
  const O={foes:4,big:true}, pl=plain(O,P=>{ noMr(P); at(P,P.F[0],3,0); at(P,P.F[1],4.6,1.0); const d=losses(P,()=>V.cast(P.v,'blue')); return {d,sm:P.F[0].slowMul}; });
  assert.equal(pl.d[1],0,'(plain: 4.71 m from her is outside 4 m)');
  const L=lab(H,S(['gk_2_4','gk_4_4','gk_1_4','gk_12_2','gk_4_2','us_12_4','gk_3_2','gk_8_3','gk_10_4','gk_6_2']),O), {v,F}=L; noMr(L); at(L,F[0],3,0); at(L,F[1],4.6,1.0); at(L,F[2],0,-3); at(L,F[3],-3,0);
  const nd=plainHit(L,()=>lost(F[0],()=>needle(L,F[0]))), au=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{auto:true}))), bIn=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000)));
  v.energy=0; const d=losses(L,()=>V.cast(v,'blue')); near(d[0],pl.d[0]*1.15*1.15*1.10,'Tight Knot 5% x 3 and Pull of Home 3% x 5 more (and Dense Weave: the Knot slows before it strikes)'); assert.ok(d[1]>0,'Long Reach: 0.2 x 5 m farther (5 m)');
  near(metres(F[1],v),Math.hypot(4.6,1.0)-2.8,'Deeper Pull: it pulls 0.2 x 3 m farther (2.8 m)',1e-6); near(metres(F[0],v),3*0.4,'(never more than 60% of the way)',1e-6);
  near(F[0].slowMul,1-(1-pl.sm)*1.15,'Leaning In: the slow 3% x 5 stronger');
  near(v.energy,2*5,'Converging Lines: 1 x 5 energy for each enemy it catches after the second (4 caught)');
  near(lost(F[0],()=>needle(L,F[0])),nd*1.10,'Dense Weave: her abilities 2% x 5 more to a slowed enemy'); near(lost(F[0],()=>V.hit(v,F[0],1000,{auto:true})),au,'not her basic attacks');
  near(lost(v,()=>V.hit(F[0],v,1000)),bIn*0.925,'Gravity Well: she takes 1.5% x 5 less from a slowed enemy');
  near(FX.cd(v,'blue',10),10-1-0.9,'Hard Pull 0.2 s x 5, Quiet Hands 0.3 s x 3'); near(FX.cd(v,'green',6),6);
  F[0].slow=0; near(lost(v,()=>V.hit(F[0],v,1000)),bIn,'not slowed: as plain');
});

test('Absalie / Crowded Room: 1% x 5 more for each enemy within 3 m of the target, up to 5',()=>{
  const L=lab(H,S(['gk_7_1']),{foes:8,big:true}), {v,F}=L; noMr(L); const t=F[7]; at(L,t,10,20);
  const ring=k=>F.slice(0,7).forEach((f,i)=>{ if(i<k){ const a=i*2*Math.PI/7; f.x=t.x+Math.cos(a)*6.5*V.METER; f.y=t.y+Math.sin(a)*6.5*V.METER; } else at(L,f,-30-i*8,-30); });   // 6.5 m apart: 2.48 m between bodies
  for(const k of [0,2,5,7]){ ring(k); const b=plainHit(L,()=>lost(t,()=>needle(L,t))); near(lost(t,()=>needle(L,t)),b*(1+0.05*Math.min(5,k)),k+' enemies within 3 m'); }
  ring(2); F[0].x=t.x+7.5*V.METER; F[0].y=t.y; const b=plainHit(L,()=>lost(t,()=>needle(L,t))); near(lost(t,()=>needle(L,t)),b*1.05,'7.5 m apart (3.48 m between bodies): not within 3 m');
});

test('Absalie / Tension: Tension, Taut, Coiled, Snap, Overwound',()=>{
  const O={foes:3,big:true}, pE=plain(O,P=>{ noMr(P); sure(P); return losses(P,()=>{ cast(P,'ult',10,0); collapse(P); }); });
  const L=lab(H,S(['gk_2_3','gk_3_3','gk_8_2','gk_4_3','gk_9_2']),O), {v,F}=L; noMr(L); sure(L); const ap=v.apow, ai=v.atkInterval;
  at(L,F[0],3,0); at(L,F[1],0,3); V.cast(v,'blue'); assert.equal(stack(L,'tension'),2,'Tension: 1 for each enemy the Knot catches');
  V.step(1); near(v.apow,ap*(1+0.015*2),'0.3% x 5 ability power each'); near(v.atkInterval,ai/(1+0.006*2),'Coiled: 0.2% x 3 attack speed each');
  secs(12.8); assert.equal(stack(L,'tension'),2,'Taut: it lasts 10 s + 1 x 3'); secs(0.3); assert.equal(stack(L,'tension'),0); V.step(1); near(v.apow,ap); near(v.atkInterval,ai);
  still(L); setStack(L,'tension',12); at(L,F[0],3,0); at(L,F[1],0,3); V.cast(v,'blue'); near(F[0].stunned,0.8,'Snap: at 12 Tension the Knot stuns every enemy it catches 0.8 s'); near(F[1].stunned,0.8); assert.equal(stack(L,'tension'),2,'and spends it all (then gains this Knot 2)');
  F.forEach(f=>{ f.stunned=0; }); at(L,F[0],3,0); V.cast(v,'blue'); assert.ok(!(F[0].stunned>0),'below 12: no stun');
  at(L,F[0],4.5,0); at(L,F[1],10,0); at(L,F[2],15.5,0); setStack(L,'tension',18); const u=losses(L,()=>{ cast(L,'ult',10,0); collapse(L); }); for(const i of [0,1,2]) near(u[i],pE[i]*1.03,'Overwound: 18 Tension, 0.5% more Event Horizon damage for each above 12');
  assert.equal(stack(L,'tension'),18,'it can reach 18');
  const N=lab(H,S(['gk_2_3']),O); setStack(N,'tension',11); at(N,N.F[0],3,0); at(N,N.F[1],0,3); V.cast(N.v,'blue'); assert.equal(stack(N,'tension'),12,'without Overwound: at most 12'); near(N.F[0].stunned,1e6,'without Snap: no stun of its own');
});

test('Absalie / Wide Knot and Slipknot; Close Knot (a PICK ONE: its own lab)',()=>{
  const W=lab(H,S(['gk_5_2','gk_7_2','gk_2_4']),{foes:3,big:true}), {v,F}=W; sure(W); still(W);
  V.cast(v,'blue'); const pt=W.T.s.pt.gravknot; assert.ok(pt&&metres(pt,v)>5,'Wide Knot: it forms on the densest group, not around her');
  const c=F.filter(f=>f.slow>0); assert.equal(c.length,2,'the two enemies of that group are caught'); for(const f of c) near(metres(f,pt),2.75*0.4,'each 60% of the way to its centre',1e-6);
  const sl=c[0].slow; let i=0; for(;i<200&&!(c[0].pullT>0&&c[0].pulledBy&&Math.abs(c[0].pulledBy.x-pt.x)<1e-9);i++) V.step(1);
  near(i*V.STEP,sl,'Slipknot: when its slow ends',0.08); near((Math.hypot(c[0].x-pt.x,c[0].y-pt.y)-c[0].pullStop)/V.METER,1.1+0.3,'the knot pulls once more, half as far (half of 2.2 + 0.2 x 3 m)',0.2);
  const m0=plain({foes:3,big:true},P=>{ at(P,P.F[0],3,0); V.cast(P.v,'blue'); return P.F[0].slowMul; });
  const K=lab(H,S(['gk_5_3']),{foes:3,big:true}); at(K,K.F[0],3,0); V.cast(K.v,'blue'); const f=K.F[0];
  assert.ok(f.pullT>0&&Math.abs(f.pulledBy.x-K.v.x)<1e-9&&f.pullStop===0,'Close Knot: pulled all the way in, to her'); near(f.slowMul,1-(1-m0)*1.2,'and slowed 20% harder');
  assert.ok(metres(K.T.s.pt.gravknot,K.v)<1e-9,'(the Knot formed around her)');
});

test('Absalie / Event Horizon: Deep Gravity, Centre of Mass, Mouth of the Void, Collapse, Event Line, Thread of Quiet, The Long Pause, Breath Held',()=>{
  const O={foes:4,big:true}; let pT=0; const pE=plain(O,P=>{ noMr(P); sure(P); at(P,P.F[3],10,7.5); return losses(P,()=>{ cast(P,'ult',10,0); const t0=V.now(); collapse(P); pT=V.now()-t0; }); });
  assert.equal(pE[3],0,'(plain: 7.5 m from its centre is outside 7 m)');
  const L=lab(H,S(['gk_7_4','gk_10_3','us_9_4','gk_6_4','gk_8_4','us_1_4','us_11_3','us_10_3']),O), {v,F}=L; noMr(L); sure(L); still(L); at(L,F[3],10,7.5); casting(F[1]);
  v.energy=0; let tT=0; const u=losses(L,()=>{ cast(L,'ult',10,0); const t0=V.now(); collapse(L); tT=V.now()-t0; });
  near(tT-pT,0.4*0.82,'Deep Gravity: the drag lasts 0.4 s longer (the collapse comes later)',0.03); assert.ok(u[3]>0,'and reaches 1 m farther (8 m)');
  for(const i of [0,2]) near(u[i],pE[i]*1.10*1.10*(1+0.09*4),'Centre of Mass and Mouth of the Void 2% x 5 each; Collapse 3% x 3 for each of the 4 enemies caught');
  near(F[0].silencedT,1.05+0.3+0.3,'Event Line and Thread of Quiet: its silence 0.1 s x 3 longer each',0.03); near(F[1].silencedT,1.65+0.9,'The Long Pause: 0.3 s x 3 more on an enemy that was casting',0.03);
  near(v.energy,4*5,'Breath Held: 1 x 5 energy for each enemy it silences');
  const crowd=P=>P.F.forEach((f,i)=>at(P,f,10+4*Math.cos(i*0.9),4*Math.sin(i*0.9)));   // 7 enemies 4 m from its centre
  const pn=plain({foes:7,big:true},P=>{ noMr(P); sure(P); crowd(P); return losses(P,()=>{ cast(P,'ult',10,0); collapse(P); }); }); assert.ok(pn.every(x=>x>0),'(all 7 caught)');
  const N=lab(H,S(['gk_6_4']),{foes:7,big:true}); noMr(N); sure(N); crowd(N); const w=losses(N,()=>{ cast(N,'ult',10,0); collapse(N); }); near(w[0],pn[0]*1.45,'Collapse: up to 5 enemies (3% x 3 x 5)');
});

test('Absalie / Shared Fall, Knot Breaker, Knotwork, Weighted Robe, Steady Mind',()=>{
  const L=lab(H,S(['gk_1_1','gk_12_1','gk_10_1','gk_3_1','gk_11_4','gk_3_4']),{foes:4,allies:1,big:true}), {v,F,A}=L; still(L);
  at(L,F[0],3,0); at(L,F[1],0,3); at(L,F[2],-3,0); at(L,F[3],30,30); V.cast(v,'blue'); assert.ok([0,1,2].every(i=>mark(L,F[i],'tng')));
  let spread=0,n=0; for(let i=0;i<80;i++){ F.forEach(f=>{ f.stunned=0; }); if(!V.cc(A[0],F[0],'stunned',2)) continue; n++; if(F[1].stunned>0){ spread++; near(F[1].stunned,F[0].stunned,'the same seconds'); near(F[2].stunned,F[0].stunned); } else assert.ok(!(F[2].stunned>0),'all or none'); }
  assert.ok(n>=30,'stuns landed: '+n); assert.ok(spread/n>0.12&&spread/n<0.50,'Shared Fall: an ally stun on one Tangled enemy hits them all 10% x 3 of the time: '+spread+' of '+n);
  F.forEach(f=>{ f.stunned=0; }); let m=0; for(let i=0;i<30;i++){ F[3].stunned=0; if(V.cc(A[0],F[3],'stunned',2)) m++; } assert.ok(m>5&&!(F[0].stunned>0),'a stun on an enemy that is not Tangled: never');
  F.forEach(f=>{ f.stunned=0; }); at(L,F[2],-25,0); at(L,F[1],0,3); aim(L,0,3); V.cast(v,'ult'); v._aimWX=null; v._aimWY=null; const pt=L.T.s.pt.eventhorizon;
  assert.ok(F[2].pullT>0&&Math.abs(F[2].pulledBy.x-pt.x)<1e-9,'Knotwork: the drag on a Tangled enemy it catches pulls the other Tangled enemies too, to its centre'); near(F[2].pullT,1.2);
  v._horizon=null; F.forEach(f=>{ f.pullT=0; f.pulledBy=null; }); at(L,F[1],0,8); at(L,F[2],-8,0); const q={x:F[0].x,y:F[0].y}; V.dmg(F[0],2e9);
  for(const f of [F[1],F[2]]){ assert.ok(f.pullT>0&&Math.abs(f.pulledBy.x-q.x)<1e-9,'Knot Breaker: a Tangled enemy dies: the others are pulled toward where it fell'); near((Math.hypot(f.x-q.x,f.y-q.y)-f.pullStop)/V.METER,1.5,'1.5 m'); }
  v.pulledBy={x:v.x+20*V.METER,y:v.y,alive:true}; v.pullT=2; v.pullStop=0; v.pullSpeed=100; V.step(1); near(v.pullSpeed,100*0.55,'Weighted Robe: a drag on her moves her 15% x 3 less far (its speed)'); V.step(5); near(v.pullSpeed,55,'once per drag');
  v.pullT=0; V.step(1); v.stunned=0; F[3].level=100; let ok=false; for(let i=0;i<40&&!ok;i++){ v.stunned=0; ok=V.cc(F[3],v,'stunned',2); } near(v.stunned,2*V.ccNerf*0.88,'Steady Mind: control on her 4% x 3 shorter');
});

test('Absalie / The Great Knot (SIGNATURE)',()=>{
  const L=lab(H,S(['gk_13_2','gk_2_3']),{foes:4,allies:1,big:true}), {v,F,A}=L; sure(L); at(L,F[3],30,30);
  cast(L,'ult',10,0); collapse(L); assert.ok([0,1,2].every(i=>mark(L,F[i],'gkm')&&mark(L,F[i],'tng'))&&!mark(L,F[3],'gkm'),'every enemy it caught is in the Knot, and Tangled'); near(markUntil(L,F[0],'gkm')-V.now(),6,'for 6 s',0.04);
  assert.equal(stack(L,'tension'),12,'full Tension');
  const d=losses(L,()=>V.hit(A[0],F[1],1000)); near(d[0],d[1]*0.125,'25% of a hit on one, split between the 2 others'); near(d[2],d[1]*0.125); assert.equal(d[3],0,'(and never shared again)');
  secs(6.1); const e=losses(L,()=>V.hit(A[0],F[1],1000)); assert.equal(e[0],0,'after 6 s: over');
  const K=lab(H,S(['gk_13_2']),{foes:2,big:true}); sure(K); at(K,K.F[1],30,30); cast(K,'ult',10,0); collapse(K); const pt=K.T.s.pt.eventhorizon, f=K.F[0];
  f.x=pt.x; f.y=pt.y+6*V.METER; V.step(1); assert.ok(f.pullT>0,'an enemy of the Knot more than 3 m from its centre is dragged back'); secs(1.5); const r=Math.hypot(f.x-pt.x,f.y-pt.y)/V.METER; assert.ok(r<=3.05&&r>2,'to within 3 m: '+r);
  f.y=pt.y+2.5*V.METER; f.pullT=0; V.step(1); assert.ok(!(f.pullT>0),'inside 3 m: free'); secs(6); f.y=pt.y+8*V.METER; V.step(1); assert.ok(!(f.pullT>0),'after 6 s: free');
});

/* ============================== THE UNSAID ============================== */
test('Absalie / Words: Swallowed Word, Long Silence, Swallowed Shout, Gap Feeding, Hoarded Words, Stolen Breath, Speechless, Full Mouth, Spent Words',()=>{
  const L=lab(H,S(['us_1_1','us_2_1','us_6_1','us_7_1','us_10_1','us_4_1','us_11_1','us_3_1','us_12_1']),{foes:4,allies:1}), {v,F,A}=L; sure(L); at(L,F[3],30,30); const ap=v.apow;
  const b0=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,300))), b2=plainHit(L,()=>{ at(L,F[2],30,0); const x=lost(v,()=>V.hit(F[2],v,300)); return x; }), bA=plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],300)));
  at(L,F[2],15.5,0); v.hp=v.maxHp*0.6; F[0].apow=v.apow*10;
  cast(L,'ult',10,0); collapse(L); assert.equal(stack(L,'word'),4,'Swallowed Word: a Word for each enemy her silence takes (3); Swallowed Shout: the one with more ability power than her counts twice');
  near(v.hp,v.maxHp*(0.6+0.05*4),'Gap Feeding: 1% x 5 of her max HP for each Word'); V.step(1); near(v.apow,ap*(1+0.025*4),'0.5% x 5 ability power each');
  at(L,F[0],4.5,0); at(L,F[2],30,0); v.hp=v.maxHp*0.8;
  near(lost(v,()=>V.hit(F[0],v,300)),b0*0.94*0.94,'Stolen Breath 0.3% x 5 less per Word; Speechless: an enemy within 4 m of her 0.3% x 5 less per Word');
  near(lost(v,()=>V.hit(F[2],v,300)),b2*0.94,'an enemy far away: Stolen Breath only'); near(lost(A[0],()=>V.hit(F[0],A[0],300)),bA*0.94,'Speechless: to her allies too');
  v.hp=v.maxHp*0.8; secs(16); assert.equal(stack(L,'word'),4,'Hoarded Words: above half her HP they do not fade');
  v.hp=v.maxHp*0.45; secs(13.8); assert.equal(stack(L,'word'),4); secs(0.3); assert.equal(stack(L,'word'),0,'below it they fade 8 s + 1 x 3 (Long Silence) + 1 x 3 (Swallowed Shout) after the last');
  setStack(L,'word',6); v.energy=0; needle(L,F[0]); assert.equal(stack(L,'word'),0,'Full Mouth: at 6 Words her next ability spends them all'); near(v.energy,15,'for 15 energy');
  setStack(L,'word',5); v.energy=0; needle(L,F[0]); assert.equal(stack(L,'word'),5,'below 6: nothing');
  setStack(L,'word',4); v.hp=v.maxHp*0.35; V.step(1); assert.equal(stack(L,'word'),4); v.hp=v.maxHp*0.25; V.step(1); assert.equal(stack(L,'word'),0,'Spent Words: dropping below 30% she spends them all');
  near(v.hp,v.maxHp*(0.25+0.02*3*4),'to heal 2% x 3 of her max HP for each',1e-3);
  const N=lab(H,S(['us_1_1']),{foes:3,big:true}); sure(N); cast(N,'ult',10,0); collapse(N); assert.equal(stack(N,'word'),3); secs(7.9); assert.equal(stack(N,'word'),3); secs(0.2); assert.equal(stack(N,'word'),0,'without the others: 8 s');
  N.F[0].apow=1e6; cast(N,'ult',10,0); collapse(N); assert.equal(stack(N,'word'),3,'without Swallowed Shout: one Word each');
});

test('Absalie / silenced and Muffled enemies: Afterquiet, Lingering Hush, Dull Edge, Quiet Ward, Muffled Steps, Tongue-Tied, Closed Door, Second Silence, Needle Hush, Wordless, Nothing to Say, Mute Cloak',()=>{
  const L=lab(H,S(['us_2_2','us_7_2','us_3_2','us_8_3','us_6_3','us_8_2','us_7_3','us_9_2','us_4_4','us_9_1','us_12_3','us_11_4']),{foes:4,allies:1,big:true}), {v,F,A}=L; sure(L); noMr(L); at(L,F[3],30,30);
  const ab=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000))), au=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000,{auto:true}))), abA=plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000))), auA=plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000,{auto:true})));
  const nd=plainHit(L,()=>lost(F[1],()=>needle(L,F[1]))), hv=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000)));
  cast(L,'ult',10,0); collapse(L); assert.ok(F[0].silencedT>0);
  near(lost(F[1],()=>V.hit(v,F[1],1000)),hv*1.10,'Wordless: a silenced enemy takes 2% x 5 more from her');
  near(lost(v,()=>V.hit(F[0],v,1000)),ab*0.925*0.94,'Nothing to Say: a silenced enemy deals 1.5% x 5 less; Mute Cloak: she takes 2% x 3 less from abilities');
  near(lost(v,()=>V.hit(F[0],v,1000,{auto:true})),au*0.925,'(Mute Cloak: not from basic attacks)'); near(lost(A[0],()=>V.hit(F[0],A[0],1000)),abA*0.925,'Nothing to Say: to her allies too');
  const sp=F[0].speed; let i=0; for(;i<80&&!mark(L,F[0],'muf');i++) V.step(1); assert.ok(!(F[0].silencedT>0),'when the silence ends'); near(markUntil(L,F[0],'muf')-V.now(),3+2,'Afterquiet: Muffled 3 s, Lingering Hush 0.4 x 5 longer',0.03);
  near(lost(v,()=>V.hit(F[0],v,1000)),ab*0.85*0.94*0.90,'Afterquiet: a Muffled enemy\'s abilities 3% x 5 weaker; Quiet Ward: she takes 2% x 5 less from it');
  near(lost(v,()=>V.hit(F[0],v,1000,{auto:true})),au*0.90*0.90,'Dull Edge: its basic attacks 2% x 5 weaker');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000)),abA*0.85,'to her allies: Afterquiet'); near(lost(A[0],()=>V.hit(F[0],A[0],1000,{auto:true})),auA*0.90,'and Dull Edge');
  V.step(1); near(F[0].speed,sp*0.88,'Muffled Steps: 4% x 3 slower');
  near(lost(F[1],()=>needle(L,F[1])),nd*1.15,'Needle Hush: the Needle 3% x 5 more to a Muffled enemy');
  F[0].energy=0; F[3].energy=0; V.hit(v,F[0],10); V.hit(v,F[3],10); near(F[0].energy,0,'Closed Door: a Muffled enemy gains no energy from a hit'); assert.ok(F[3].energy>0,'one that is not Muffled does');
  const f=F[1]; f.stunned=0; f.greenAb=VMX('KITS.vael.green'); f.greenCd=5; V.step(1); const c0=f.greenCd, n=30; V.step(n); near(c0-f.greenCd,n*V.STEP*0.91,'Tongue-Tied: its cooldowns recover 3% x 3 slower',1e-6); f.stunned=1e6; f.greenAb=null;
  const mu=markUntil(L,F[0],'muf'); secs(mu-V.now()+0.05); assert.ok(F[0].silencedT>0.4&&F[0].silencedT<=0.5,'Second Silence: when Afterquiet ends it is silenced again 0.5 s');
  for(let k=0;k<40&&!(markUntil(L,F[0],'muf')>V.now()+4);k++) V.step(1); assert.ok(mark(L,F[0],'muf'),'(that silence is hers: Muffled again)');
  secs(markUntil(L,F[0],'muf')-V.now()+0.1); assert.ok(!(F[0].silencedT>0),'once every 12 s per enemy'); V.step(1); near(F[0].speed,sp,'Muffled no longer');
  near(lost(v,()=>V.hit(F[0],v,1000)),ab*0.94,'(only Mute Cloak)');
});

test('Absalie / First to Speak, Mute Knot, Deaf Knot (PICK ONE: their own labs)',()=>{
  const L=lab(H,S(['us_n1']),{foes:3,cold:true}); L.F[1].apow=1e5; V.step(1); assert.ok(mark(L,L.F[1],'muf')&&!mark(L,L.F[0],'muf'),'First to Speak: at the wave start the enemy with the most ability power is Muffled');
  near(markUntil(L,L.F[1],'muf')-V.now(),5,'1 s x 5',0.04); V.wave(); L.F[1].apow=0; L.F[2].apow=1e5; V.step(1); assert.ok(mark(L,L.F[2],'muf'),'every wave');
  const M=lab(H,S(['us_5_2']),{foes:3}); at(M,M.F[0],3,0); V.cast(M.v,'blue'); near(M.F[0].silencedT,0.5,'Mute Knot: every enemy it catches is silenced 0.5 s'); assert.ok(!(M.F[1].silencedT>0));
  const D=lab(H,S(['us_5_3']),{foes:3}); at(D,D.F[0],3,0); V.cast(D.v,'blue'); assert.ok(mark(D,D.F[0],'muf')&&!mark(D,D.F[1],'muf'),'Deaf Knot: Muffled'); near(markUntil(D,D.F[0],'muf')-V.now(),3,'for 3 s');
  /* one Muffled state from several sources: a shorter Muffle never cuts a longer one, and what reads Muffled keeps looking while the longest lasts */
  const X=lab(H,S(['us_n1','us_5_3','us_6_3']),{foes:3,cold:true}); X.F[0].apow=1e5; V.step(1); const sp=X.F[0].speed/0.88; near(markUntil(X,X.F[0],'muf')-V.now(),5,'First to Speak: 5 s',0.04);
  at(X,X.F[0],3,0); at(X,X.F[1],0,3); V.cast(X.v,'blue'); near(markUntil(X,X.F[0],'muf')-V.now(),5-1/30,'the 3 s of Deaf Knot does not cut it short',0.04); near(markUntil(X,X.F[1],'muf')-V.now(),3,'',0.04);
  secs(3.5); assert.ok(!mark(X,X.F[1],'muf')&&mark(X,X.F[0],'muf')); V.step(1); near(X.F[0].speed,sp*0.88,'Muffled Steps still holds the 5 s one after the 3 s one ended');
  secs(1.6); V.step(1); near(X.F[0].speed,sp,'then it ends');
});

test('Absalie / Cut Short, Echo Gap, Pulled Word (LINK with Swallowed Word)',()=>{
  const O={foes:3,big:true}, pN=plain(O,P=>{ noMr(P); return lost(P.F[0],()=>needle(P,P.F[0])); });
  const L=lab(H,S(['us_4_2','us_5_1','ec_n1','us_1_1']),O), {v,F}=L; noMr(L);
  casting(F[0]); v.energy=0; near(lost(F[0],()=>needle(L,F[0])),pN,'(not silenced yet)'); near(F[0].silencedT,0.8,'Cut Short: the Needle silences an enemy that is casting, 0.8 s');
  near(v.energy,2*3,'Echo Gap: a spell of hers hits a silenced enemy: 2 x 3 energy'); assert.equal(stack(L,'word'),1,'(her silence: a Word)'); assert.equal(thr(L,F[0]),1,'Pulled Word: the Word taken pulls a Thread from that enemy');
  F[0].stunned=0; V.step(1); assert.equal(F[0]._pend,null,'and the cast is cut short');
  v.energy=0; near(lost(F[0],()=>needle(L,F[0])),pN*1.08*1.025,'Pulled Word: the Needle 8% more to a silenced enemy (her Word: 0.5% x 5 ability power)'); near(v.energy,0,'Echo Gap: once per spell (0.5 s)'); F[0].stunned=1e6; secs(0.5); const e1=v.energy; V.hit(v,F[0],10); near(v.energy-e1,2*3,'later: again');
  needle(L,F[1]); assert.ok(!(F[1].silencedT>0),'an enemy that is not casting: no silence');
  const N=lab(H,S(['ec_n1']),O); casting(N.F[0]); N.F[0].silencedT=1; needle(N,N.F[0]); assert.equal(thr(N,N.F[0]),0,'without Swallowed Word: no Thread');
});

test('Absalie / The Next Word (SIGNATURE): for 6 s after Event Horizon, each enemy\'s first ability fails',()=>{
  const L=lab(H,S(['us_13_3']),{foes:4,big:true}), {v,F}=L; sure(L); at(L,F[3],30,30); cast(L,'ult',10,0); collapse(L); still(L); secs(1.1); v.energy=0;
  assert.ok(F.every(f=>mark(L,f,'nw')),'every enemy on the field');
  casting(F[0]); V.step(1); assert.ok(F[0].silencedT>0,'the ability it starts fails'); assert.equal(stack(L,'word'),1,'the gap takes a Word'); near(v.energy,5,'and 5 energy'); assert.ok(mark(L,F[0],'muf'),'and leaves it Muffled');
  V.step(1); assert.equal(F[0]._pend,null,'(its cast is cancelled: the cooldown spent at the press stays spent)');
  secs(0.3); casting(F[0]); secs(0.3); assert.ok(F[0]._pend,'its second ability is not taken');
  casting(F[1],false); secs(0.3); assert.ok(F[1]._pend,'an ultimate is not taken'); assert.ok(mark(L,F[1],'nw')); F[1]._pend=null; casting(F[1]); V.step(1); assert.ok(F[1].silencedT>0,'its first ability is');
  secs(5); casting(F[2]); secs(0.3); assert.ok(F[2]._pend,'after 6 s: nothing'); assert.equal(stack(L,'word'),2);
});

/* ============================== WHOLE FIGHTS ============================== */
test('Absalie: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['ec_1_1','ec_2_2','gk_1_1','gk_2_3','us_1_1','us_2_2','ec_9_1','us_3_2']), TEAM=['vael','sylthaine','vireo','vex','absalie'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let th=0, hol=false, tng=false, muf=false, word=0, ten=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; word=Math.max(word,T0.k.word?T0.k.word.n:0); ten=Math.max(ten,T0.k.tension?T0.k.tension.n:0);
    for(const f of U.filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; const on=n=>!!(o[n]&&(o[n].until==null||o[n].until>V.now())); th=Math.max(th,o['#thr']&&o['#thr'].until>V.now()?o['#thr'].v:0); hol=hol||on('hol'); tng=tng||on('tng'); muf=muf||on('muf'); } }
  assert.ok(th>=1,'real Needles pulled Threads: '+th); assert.ok(hol,'and made enemies Hollow'); assert.ok(word>=1,'her real silences took Words: '+word); assert.ok(muf,'and left enemies Muffled');
  determinism(H,TEAM);
});

/* The page sites her talents added (the 'at' and 'skillTgt' hooks in the Knot, 'at' in Event Horizon, 'landPre' / 'ccHit' / 'land' around its collapse, 'teamCc' in
   ccApply, 'nrgPre' / 'nrgIn' in damage()): with nothing learned, whole seeded fights with Absalie in the line-up are identical to the pre-talent page (ee8edab8),
   seed by seed. tests/talents-fight.test.js does the same for line-ups without her. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Absalie: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['absalie','vael','vireo','sylthaine','gruel'], foeTeam=['bloatus','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __absN={gk:0,eh:0,col:0}; var __absD=_doEffectCore; _doEffectCore=function(u,type,o){ if(u&&u.key==="absalie"&&!(o&&o.deliver&&!o._arrived)){ if(type==="gravknot") __absN.gk++; if(type==="eventhorizon") __absN.eh++; } return __absD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__absN'); assert.ok(c.gk>0&&c.eh>0,'the fights cast her Knot ('+c.gk+') and Event Horizon ('+c.eh+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__absD;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage reduction talents, each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ us:['us_11_4','us_2_2','us_3_2','us_4_1','us_8_3','us_1_1','us_11_1','us_11_3','us_12_3'], ec:['ec_n2','ec_8_4','ec_9_4','ec_11_4'], gk:['gk_3_4','gk_10_4','gk_12_4','gk_11_1'] };
function defensive(order){ let b={r:{}}; const want=[].concat(...order.map(k=>DEF[k])), meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, goals=[]; for(const id of want) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
    if(id){ b=T.learn(H,b,id,100).build; continue; }
    const open=goals.find(x=>(b.r[x]|0)<meta(x).ranks), tree=open?meta(open).treeIdx:null;   // a tier to open first: the lowest open talent of that tree (never one that locks a fork)
    const pool=T.trees(H).map((tr,i)=>tr.talents.filter(t=>(tree==null||i===tree)&&!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1]||x[2]-y[2]);
    const any=pool[0]||T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her damage reduction talents true at once (an enemy within 4 m with Threads, Hollow, Muffled, silenced,
   Tangled with 4 others, slowed; 6 Words; a hit over 30% of her max HP). Measured through the engine: what reaches her HP and shield against the hit */
function worstHit(list,kind,auto){ const L=lab(H,list,{foes:6,cold:true}), {v,F}=L; V.step(1); const f=F[0], u=v.uid, now=V.now(), M=x=>(x._talM||(x._talM={}))[u]||(x._talM[u]={});
  for(const x of F.slice(0,5)) M(x).tng={t0:now,until:1e9,v:0}; Object.assign(M(f),{hol:{t0:now,until:1e9,v:0},muf:{t0:now,until:1e9,v:0},'#thr':{v:4,until:1e9}});
  f.silencedT=99; f.slow=99; f.slowMul=0.5; if(L.T) L.T.s.k.word={n:6,t:99,idle:0}; v.maxHp=1e5; v.hp=1e5; v.shield=1e12; v.shieldT=999;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,auto})); return 1-x/(raw*VMX('elemMul')(f,v)); }
test('Absalie: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[['us','ec','gk'],['ec','us','gk'],['gk','us','ec'],['us','gk','ec']].map(o=>{ const b=defensive(o); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const auto of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,auto)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  /* seeded fights: every enemy hit on her, through the engine (crits and elements read out), and every tick she is immune */
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="absalie"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="absalie"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','absalie'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));   // a line-up that reaches the back row
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.equal(d.imm,0,'and she is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
