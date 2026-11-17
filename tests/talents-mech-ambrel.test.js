'use strict';
/* Ambrel's talents as data on the mechanics layer (talents-mech/ambrel.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Ambrel, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11). Bodies about 2.01 m:
   F0 0.48 m from her body to body, F3 1.98 m, F4 4.12 m, F1 5.98 m; A0 1.48 m (5.5 m centre to centre: inside the bells' 6 m).
   Run: node --test tests/talents-mech-ambrel.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='ambrel', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const ring=L=>{ L.v._sbT=4; V.step(1); };                                           // Sacred Bells ring now (the passive's own clock)
const free=x=>{ x.stunned=0; x.speed=0; x.level=1; };                               // a lab unit no longer held, standing still, that her controls always land on
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const noDef=L=>{ for(const f of L.F){ f.mrRating=0; f.armorRating=0; } };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage: no armor in the way)
const pm=L=>L.v.passMul;
/* Incense of Penance now (the allies it should reach put back where the test wants them first: same-team bodies push apart), then everyone held again: its cleanse frees them */
const inc=(L,pl)=>{ if(pl) pl(); V.cast(L.v,'blue'); L.v.stunned=1e6; for(const a of L.A) a.stunned=1e6; };

test('Ambrel: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  const M=FXN.mech(H); for(const id of ['rh_1_1','ip_1_1','gt_1_1','rh_13_2','ip_13_3','gt_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['rh_3_3','rh_12_3','rh_1_3','ip_1_2','ip_8_2','ip_3_2','gt_2_3','gt_12_3','gt_3_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Ambrel: her real kit, as the talents read it - the bells every 4 s into the one damage-reduction slot, Cathedral Gates, Incense of Penance, Divine Mass (no stun)',()=>{
  plain({foes:6,allies:2},P=>{ const {v,A,F}=P, m=v.passMul;
    assert.ok(v.pass.sacredbells,'her passive'); near(v._sbT,V.STEP,'the bells\' clock runs',1e-9); assert.ok(!(A[0].drT>0),'no cut before the first ring');
    secs(4.0); near(A[0].drMul,1-0.10*m,'every 4 s, the allies within 6 m take 10% x her passive level less (the skill slot)'); near(A[0].drT,4.2-(V.now()-4)+0,'for 4.2 s',0.05);
    assert.ok(!(A[1].drT>0),'not an ally 11 m away'); near(v.drMul,1-0.10*m,'herself too');
    const f=F[0]; free(f); const h0=f.hp; V.cast(v,'green',f); assert.ok(f.hp<h0,'Cathedral Gates hits its target'); near(f.stunned,2.0*V.ccNerf,'and stuns it: the area table\'s 2 s x 0.7',1e-9);
    at(P,A[0],0,-4.5); A[0].hp=A[0].maxHp*0.5; A[0].silencedT=3; V.dot(A[0],100,5,1,f); const a0=A[0].hp; inc(P); assert.equal(A[0].silencedT,0,'Incense cleanses'); assert.equal(A[0].dots.length,0,'every DoT');
    near(A[0].hp-a0,v.apow*0.4*VMX('skillMul')(10)*v.healPowMul,'and heals for 40% of her ability power',1e-6); near(f._atkDnPct,0.25,'the enemies: the game\'s attack cut');
    const h1=A[0].hp; free(F[3]); V.cast(v,'ult'); near(A[0].hp-h1,A[0].maxHp*0.35*VMX('skillMul')(10)*v.healPowMul,'Divine Mass heals each ally for 35% of ITS max HP',1e-6); near(F[3].stunned,0,'Divine Mass stuns nobody');
  });
});

/* ============================== RINGING THE HOURS ============================== */
test('Ambrel / Peals: The First Peal, Compline, Early Bell, Quarter Chimes, Vespers, Matins, Evensong, Resonant Stone, Ringing Peals',()=>{
  const L=lab(H,S(['rh_1_1','rh_7_1','rh_6_4','rh_2_1','rh_6_1','rh_4_1','rh_10_1','rh_n1','rh_12_1']),{foes:3,allies:2,big:true}), {v,A}=L;
  const ap0=v.apow, mr0=v.mrRating; assert.equal(stack(L,'ps'),0);
  v.hp=v.maxHp*0.5; A[0].hp=A[0].maxHp*0.5; A[1].hp=A[1].maxHp*0.5; const h0=v.hp, a0=A[0].hp, b0=A[1].hp;
  ring(L); assert.equal(stack(L,'ps'),4,'Early Bell: the first ring of the wave strikes 2 x 2 Peals'); assert.equal(stack(L,'pos'),4);
  near(v.hp-h0,v.maxHp*(0.015*4+0.02),'Matins 0.3% x 5 per Peal (she is within 4 m of herself), Evensong 0.4% x 5 per ring',1e-6);
  near(A[0].hp-a0,A[0].maxHp*0.015*4,'Matins: an ally within 4 m, each Peal',1e-6); near(A[1].hp,b0,'not one farther away');
  near(v._sbT,V.STEP+0.6,'Quarter Chimes: the next ring 0.2 s x 3 sooner',1e-6);
  V.step(1); near(v.apow,ap0*(1+0.015*4),'The First Peal: 0.3% x 5 ability power per Peal struck this wave'); near(v.mrRating,mr0*(1+0.01*4),'Compline: 0.2% x 5 magic resist per Peal');
  ring(L); assert.equal(stack(L,'ps'),5,'the second ring: one Peal');
  const rs=hitOn(L,v,1000); const rp=plainHit(L,()=>hitOn(L,v,1000)); near(rs,rp*(1-0.075),'Resonant Stone: 1.5% x 5 less for 2 s after a ring'); secs(2.05); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'then not');
  setStack(L,'pos',9); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.045),'Vespers: 1.5% x 3 less while the Peal is 9 or later'); setStack(L,'pos',8); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'not at 8');
  for(let i=0;i<10;i++) ring(L); assert.equal(stack(L,'ps'),12,'up to 12 struck this wave'); V.step(1); near(v.apow,ap0*(1+0.015*12),'');
  V.wave(); V.step(1); assert.equal(stack(L,'ps'),6,'Ringing Peals: 2 x 3 Peals kept between waves'); assert.equal(stack(L,'pos'),Math.min(6,stack(L,'pos')));
  ring(L); assert.equal(stack(L,'ps'),10,'and Early Bell again for the new wave\'s first ring');
});

test('Ambrel / Carillon: each ring has a 6% x 5 chance to strike 2 Peals (the fight\'s seeded stream)',()=>{
  const L=lab(H,S(['rh_10_4']),{foes:1}); let two=0, n=60;
  for(let i=0;i<n;i++){ const p=stack(L,'ps'), q=stack(L,'pos'); ring(L); const d=((stack(L,'pos')-q)+12)%12; if(d===2) two++; else assert.equal(d,1); }
  assert.ok(two>=8&&two<=30,'about 30% of 60 rings struck two Peals: '+two);
});

test('Ambrel / Clangour: Clangour, Bell Tower, Heavy Bronze, Rope Pull, Knell Weight',()=>{
  const L=lab(H,S(['rh_1_4','rh_5_4','rh_3_4','rh_7_4','rh_10_2']),{foes:6,big:true}), {v,F}=L, x=0.24*v.apow;
  const l=F.map(f=>f.hp); ring(L); const d=F.map((f,i)=>l[i]-f.hp);
  near(d[0],x,'Clangour: 8% x 3 of her ability power on an enemy within 4 m'); near(d[3],x,''); near(d[4],x,'Bell Tower: 0.2 m x 5 farther (4.12 m body to body)'); assert.equal(d[1],0,'not 5.98 m away');
  assert.ok(F[0].slow>0&&Math.abs(F[0].slowMul-0.80)<1e-9,'Heavy Bronze: slowed 4% x 5 for 1 s'); near(F[0].slow,1,'',0.05);
  for(const f of F) f.level=1; V.cast(v,'green',F[0]); secs(0.1); const g=lost(F[0],()=>ring(L)); near(g,x*1.15,'Rope Pull: 5% x 3 more on an enemy Cathedral Gates stunned');
  secs(1.5); F[0].stunned=0; const g2=lost(F[0],()=>ring(L)); near(g2,x,'its stun is over: no more'); F[0].stunned=1e6;
  F[3].hp=F[3].maxHp*0.2; near(lost(F[3],()=>ring(L)),x*1.20,'Knell Weight: 4% x 5 more on an enemy hearing the Knell');
});

test('Ambrel / Change Ringing (a ring of two Peals: Clangour twice, the second at 25% x 2) and Bells Across the Valley (the slam rings the bells at once; that ring\'s Clangour reaches every enemy it stunned)',()=>{
  const L=lab(H,S(['rh_1_4','rh_6_4','rh_12_4']),{foes:3,big:true}), {v,F}=L, x=0.24*v.apow;
  near(lost(F[0],()=>ring(L)),x*1.5,'the first ring of the wave strikes 2 Peals (Early Bell): Clangour, then again at 50%'); near(lost(F[0],()=>ring(L)),x,'one Peal: once');
  const M=lab(H,S(['rh_1_4','rh_9_4']),{foes:3,big:true}); for(const f of M.F) f.level=1; secs(1); const t0=M.v._sbT;
  const l=M.F.map(f=>f.hp); V.cast(M.v,'green',M.F[1]); assert.ok(M.v._sbT>=4,'the slam sets the bells to ring now'); V.step(1); near(M.v._sbT,V.STEP,'they rang',1e-6);
  const d=M.F.map((f,i)=>l[i]-f.hp), slam=d[1]-0.24*M.v.apow; assert.ok(slam>0);
  near(d[1]-slam,0.24*M.v.apow,'Clangour reached the enemy it stunned, 10 m away'); near(d[0],0.24*M.v.apow,'and the enemy within 4 m, once'); near(d[2],0,'not one the slam did not reach');
  near(lost(M.F[1],()=>ring(M)),0,'the next ring: within 4 m only');
});

test('Ambrel / the Knell: Death Knell, Passing Bell, Tolling On, Dirge',()=>{
  const L=lab(H,S(['rh_2_2','rh_4_2','rh_6_2','rh_8_2']),{foes:3,allies:1}), {v,A,F}=L; noDef(L); v.maxHp=v.hp=1e6;
  const f=F[0]; f.hp=f.maxHp*0.32;
  near(hitOn(L,v,1000,{src:f}),plainHit(L,()=>hitOn(L,v,1000,{src:f}))*0.90,'Death Knell: an enemy hearing the Knell deals 2% x 5 less to her (Passing Bell: 33%)');
  near(hitOn(L,A[0],1000,{src:f}),plainHit(L,()=>hitOn(L,A[0],1000,{src:f}))*0.90,'and to her allies');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'an enemy above it: no');
  near(lost(f,()=>V.hit(A[0],f,1000,{kind:'true'})),plainHit(L,()=>lost(f,()=>V.hit(A[0],f,1000,{kind:'true'})))*1.075,'Tolling On: 1.5% x 5 more from her whole team');
  const sk=lost(f,()=>V.cast(v,'green',f)), skp=plainHit(L,()=>lost(f,()=>V.cast(v,'green',f))); near(sk,skp*1.15*1.075,'Death Knell: her skills deal 3% x 5 more to it (and Tolling On)');
  f.hp=f.maxHp*0.34; near(lost(f,()=>V.cast(v,'green',f)),plainHit(L,()=>lost(f,()=>V.cast(v,'green',f))),'at 34%: not in the Knell');
  v.hp=v.maxHp*0.5; let h=v.hp; f.hp=f.maxHp*0.2; V.hit(A[0],f,10,{kind:'true'}); f.hp=1; V.dmg(f,1e3); assert.ok(!f.alive); near(v.hp-h,v.maxHp*0.05,'Dirge: an enemy that dies hearing the Knell heals her 1% x 5 of her max HP',1e-6);
  h=v.hp; V.hit(A[0],F[1],2e9,{kind:'true'}); assert.ok(!F[1].alive); near(v.hp,h,'killed from above the Knell in one blow: no Dirge',1e-9);
});

test('Ambrel / Toll for Them (PICK ONE, its own lab): enemies hearing the Knell receive 50% less healing',()=>{
  const L=lab(H,S(['rh_5_2']),{foes:2}), {v,F}=L; F[0].hp=F[0].maxHp*0.2; F[1].hp=F[1].maxHp*0.5; V.step(1);
  inc(L); V.cast(v,'green',F[0]); assert.equal(stack(L,'cdl'),0,'(a state no learned talent reads is not kept: no Candles,'); assert.ok(!mark(L,F[0],'atn')&&!mark(L,F[0],'bar'),'no Atonement, no Barred)');
  const a=F[0].hp, b=F[1].hp; V.heal(F[0],1000); V.heal(F[1],1000); near(F[0].hp-a,500,'in the Knell: half'); near(F[1].hp-b,1000,'above it: all');
});

test('Ambrel / Mass at Noon: Divine Mass strikes 3 Peals and stuns 1 s every enemy it hits that hears the Knell',()=>{
  const L=lab(H,S(['rh_11_2']),{foes:6,big:true}), {v,F}=L; at(L,F[3],0,5); for(const f of F) free(f); F[0].hp=F[0].maxHp*0.2; F[1].hp=F[1].maxHp*0.2;
  V.cast(v,'ult'); assert.equal(stack(L,'ps'),3,'3 Peals'); near(F[0].stunned,1,'an enemy it hit in the Knell: 1 s, in full',1e-9); near(F[3].stunned,0,'one above it: none'); near(F[1].stunned,0,'one beyond its 6 m: none');
});

test('Ambrel / the 12th Peal: Noon, Peal of Judgment, The Last Thing Standing (SIGNATURE, once every 30 s)',()=>{
  const L=lab(H,S(['rh_3_1','rh_12_2','rh_13_2','rh_1_4']),{foes:6,allies:2,big:true}), {v,A,F}=L, x=0.24*v.apow, m=pm(L); free(F[0]); free(F[1]); F[0].level=100;
  A[1].silencedT=3; A[1].fearT=2; V.dot(A[1],50,5,1,F[0]);
  setStack(L,'pos',11); const l0=F[0].hp, l1=F[1].hp; ring(L); for(const a of A) a.stunned=1e6; v.stunned=1e6;
  near(A[0].drMul,1-0.20*m,'Noon: the bells\' cut doubled for that ring'); near(v.drMul,1-0.20*m,'');
  near(F[0].stunned,0.5,'every enemy within 4 m stunned 0.5 s, in full (talent stuns land whatever the levels)',0.08); near(F[1].stunned,0,'not 6 m away');
  assert.ok(win(L,'poj'),'Peal of Judgment'); assert.ok(win(L,'lts'),'The Last Thing Standing');
  near(l0-F[0].hp,x*4,'Clangour three times (within 6 m) and the ring\'s own Clangour once'); near(l1-F[1].hp,x*3,'5.98 m away: the three only');
  assert.equal(A[1].silencedT,0,'every ally cleansed, wherever it stands'); assert.equal(A[1].fearT,0); assert.equal(A[1].dots.length,0);
  assert.ok(mark(L,F[1],'knF'),'every enemy within 6 m hears the Knell for 4 s'); assert.equal(stack(L,'pos'),0,'the Peals start again at 1');
  near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000))*0.70,'every ally takes 30% less for 4 s'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.70,'Ambrel too');
  free(F[3]); const g=lost(F[3],()=>V.cast(v,'green',F[3])), gp=plainHit(L,()=>lost(F[3],()=>V.cast(v,'green',F[3]))); near(g,gp*1.15,'Peal of Judgment: her skills 3% x 5 more for 4 s');
  secs(4.1); assert.ok(!win(L,'lts')&&!win(L,'poj'),'4 s');
  setStack(L,'pos',11); ring(L); assert.ok(!win(L,'lts'),'once every 30 s'); assert.ok(win(L,'poj'),'(Peal of Judgment each 12th Peal)'); assert.equal(stack(L,'pos'),12);
  secs(26); setStack(L,'pos',11); ring(L); assert.ok(win(L,'lts'),'30 s later, again');
});

test('Ambrel / Ring for the Living (PICK ONE, its own lab) with Urgent Peal: an ally dropping below 30% rings the bells at once, once every 8 - 3 s',()=>{
  const L=lab(H,S(['rh_5_3','rh_6_3']),{foes:1,allies:1}), {v,A}=L; const a=A[0]; a.maxHp=1e6; secs(1);
  a.hp=4e5; hitOn(L,a,5e4); assert.ok(v._sbT<4,'40% to 35%: no'); hitOn(L,a,1.5e5); assert.ok(v._sbT>=4,'below 30%: the bells ring at once'); V.step(1); assert.ok(v._sbT<1,'they rang');
  a.hp=4e5; hitOn(L,a,2e5); assert.ok(v._sbT<4,'again 0.03 s later: not yet'); secs(4.4); a.hp=4e5; hitOn(L,a,2e5); assert.ok(v._sbT<4,'4.5 s later: not yet'); secs(0.6); a.hp=4e5; hitOn(L,a,2e5); assert.ok(v._sbT>=4,'5 s after the first (Urgent Peal 1 s x 3 off its 8): again');
});

test('Ambrel / the bells\' cut: Prayer Bells, Bell Shelter, Long Peals',()=>{
  const L=lab(H,S(['ip_9_2','gt_10_3','rh_8_1']),{foes:1,allies:2}), {v,A}=L, m=pm(L); ring(L);
  near(A[0].drMul,1-(0.10*m+0.025+0.03),'0.5% x 5 and 1% x 3 stronger'); near(A[0].drT,5.2-V.STEP,'Long Peals: 0.2 s x 5 longer',1e-6); near(v.drMul,1-(0.10*m+0.055),'');
  assert.ok(!(A[1].drT>0),'only within the bells\' 6 m');
});

test('Ambrel / the hits she takes: Weathered Stone, Pew Patience, Stained Glass, Cathedral Patience, Buttress, Lead Roof, Rubble Wall, Foundations, Choir Stall',()=>{
  const L=lab(H,S(['rh_8_3','ip_11_2','gt_11_4','rh_11_3','rh_9_3','gt_8_3','gt_6_2','gt_5_1','ip_12_2']),{foes:2,big:true}), {v,F}=L; const f=F[0];
  near(hitOn(L,v,1000,{crit:true}),plainHit(L,()=>hitOn(L,v,1000,{crit:true}))*0.94*0.90*0.90,'three crit talents: 2% x 3, x 5, x 5 less, multiplied');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'not a normal hit');
  const t0=f.t; f.t=Object.assign({},t0,{row:'Back'}); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.90,'Buttress: 2% x 5 less from an enemy in the back row'); f.t=t0;
  const m0=f.melee; f.melee=false; near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.94,'Lead Roof: 2% x 3 less from a ranged enemy'); f.melee=m0;
  setStack(L,'mas',8); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.95,'Rubble Wall: 1% x 5 less at 8 Masonry'); setStack(L,'mas',7); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'not at 7');
  const tick=on=>{ V.dot(v,1000,1,1,f); const h=v.hp; for(let i=0;i<40&&v.dots.length;i++) V.step(1); return h-v.hp; };
  const dp=plainHit(L,()=>tick()); near(tick(),dp*0.90,'Cathedral Patience: 2% x 5 less from damage over time',1e-3);
  v.stunned=0; v.level=100; f.level=100; V.cc(f,v,'stunned',2); near(v.stunned,2*V.ccNerf*0.80,'Foundations: 4% x 5 shorter (up to 20%)',1e-9);
  v.stunned=0; v.silencedT=0; V.cc(f,v,'silencedT',2); near(v.silencedT,2*V.ccNerf*0.80*0.80,'Choir Stall: silences 10% x 2 shorter as well',1e-9); v.stunned=1e6;
});

test('Ambrel / her skills: Gate Weight, Heavy Doors, Divine Light, Judgment Beams, Bell Metal, Hallowed, Patient Stone, Iron Hinges, Wider Gates, Deadbolt, Thick Smoke, Sweet Smoke',()=>{
  const L=lab(H,S(['rh_2_3','gt_4_1','rh_7_3','gt_7_3','rh_9_1','gt_9_3','rh_11_1','gt_6_1','gt_4_3','gt_12_1','ip_2_2','ip_4_2']),{foes:6,big:true}), {v,F}=L; const f=F[0]; f.armorRating=0; const mr0=f.mrRating; f.mrRating=0;
  near(lost(f,()=>V.cast(v,'green',f)),plainHit(L,()=>lost(f,()=>V.cast(v,'green',f)))*1.12*1.15,'Cathedral Gates: 4% x 3, 3% x 5 more'); f.mrRating=mr0; assert.equal(v.t.damageProfile,'Magic','her hits are magic (her damage profile)');
  const mr=VMX('(s,t)=>{ const a=defMul(s,t,"magic"); const k=t.mrRating; t.mrRating=k*0.9; const b=defMul(s,t,"magic"); t.mrRating=k; return b/a; }')(v,f)**2;   // two rows, each 10% of the resist
  assert.ok(mr>1.001,'(it has magic resist to ignore)'); near(lost(f,()=>V.cast(v,'ult')),plainHit(L,()=>lost(f,()=>V.cast(v,'ult')))*1.15*1.15*mr,'Divine Mass: 3% x 5 twice more, and Bell Metal + Hallowed ignore 2% x 5 of its magic resist each',1e-6);
  near(FX.cd(v,'blue',9),8,'Patient Stone: Incense 0.2 s x 5 shorter'); near(FX.cd(v,'green',10),9.1,'Iron Hinges: Gates 0.3 s x 3 shorter');
  const og=FX.kit(v,'aoeStun',Object.assign({},v.greenAb,{stun:2})); near(og.radius,v.greenAb.radius+0.6*V.METER,'Wider Gates: 0.2 m x 3'); near(og.stun*V.ccNerf,2*V.ccNerf+0.3,'Deadbolt: the stun 0.1 s x 3 longer, in full');
  const oi=FX.kit(v,'incense',Object.assign({},v.blueAb)); near(oi.radius,v.blueAb.radius+0.6*V.METER,'Thick Smoke: 0.2 m x 3'); near(oi.pct,0.28,'Sweet Smoke: the attack cut 1% x 3 stronger');
  FX.cast(v,'incense',oi); free(F[4]); free(F[3]); F[4].level=1; V.cast(v,'green',F[4]); near(F[4].stunned,(2+0.3/V.ccNerf)*V.ccNerf,'a real slam: 1.4 s + 0.3 s',1e-9);
});

/* ============================== INCENSE AND PENANCE ============================== */
test('Ambrel / Candles: Light a Candle, Morning Candle, Lantern, Candlelight, Altar Flame, Votive, Wax and Wick, Seven Candles',()=>{
  const L=lab(H,S(['ip_1_1','ip_6_1','ip_12_1','ip_5_1','ip_7_1','ip_3_1','ip_10_1','ip_9_1']),{foes:3,allies:2,big:true}), {v,A,F}=L; at(L,A[0],0,-4.5); at(L,A[1],0,-11);
  assert.equal(stack(L,'cdl'),4,'Morning Candle: 2 x 2 lit at the wave start'); const mr0=v.mrRating/(1+0.009*4); V.step(1); near(v.mrRating,mr0*(1+0.009*4),'Lantern: 0.3% x 3 magic resist each');
  const base=v.apow*0.4*VMX('skillMul')(10)*v.healPowMul; A[0].hp=A[0].maxHp*0.5; const a0=A[0].hp; inc(L,()=>at(L,A[0],0,-4.5));
  assert.equal(stack(L,'cdl'),6,'Incense lights one for each ally it cleanses (Ambrel and the ally within 5 m; not the one 11 m away)');
  near(A[0].hp-a0,base*(1+0.03*5),'Light a Candle: her heals 1% x 3 stronger per Candle lit (5 when it reached this ally)',1e-6);
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*(1-0.015*6),'Candlelight: 0.3% x 5 per Candle for an ally within 5 m'); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000)),'not 7 m away');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.015*6),'Ambrel too');
  noDef(L); near(lost(F[0],()=>V.cast(v,'green',F[0])),plainHit(L,()=>lost(F[0],()=>V.cast(v,'green',F[0])))*1.10,'Altar Flame: 2% x 5 more at 5 or more Candles');
  A[1].hp=A[1].maxHp*0.2; const b0=A[1].hp; secs(5.8); assert.equal(stack(L,'cdl'),6,'Votive: they burn 0.4 s x 5 slower'); secs(0.4); assert.equal(stack(L,'cdl'),5,'one burnt out at 6 s');
  near(A[1].hp-b0,A[1].maxHp*0.025,'Wax and Wick: it healed the lowest-HP ally 0.5% x 5 of its max HP',1e-6);
  const run=n=>{ setStack(L,'cdl',n); v.stunned=0; v.greenCd=1e9; v.blueCd=5; v.energy=0; V.step(30); const r=v.blueCd; v.stunned=1e6; v.blueCd=1e9; return r; };
  const r6=run(6), r7=run(7); near(5-r7,2*(5-r6),'Seven Candles: at 7 Incense\'s cooldown runs twice as fast',0.02);
});

test('Ambrel / Pilgrims: Pilgrims, Long Road, Rest Stop, Pilgrim\'s Pace, Way Station, Pilgrim Shield, Rising Smoke',()=>{
  const L=lab(H,S(['ip_1_4','ip_2_4','ip_11_4','ip_4_4','ip_6_4','ip_8_4','ip_12_3']),{foes:3,allies:2,big:true}), {v,A}=L; at(L,A[0],0,-4.5); at(L,A[1],0,-11);
  const s0=A[0].speed, i0=A[0].atkInterval, ap0=v.apow; inc(L); V.step(1);
  assert.ok(mark(L,A[0],'pil')&&mark(L,v,'pil'),'the allies Incense heals become Pilgrims (Ambrel too)'); assert.ok(!mark(L,A[1],'pil'),'not one it does not reach');
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.95,'Pilgrims: 1% x 5 less'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.95,''); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000)),'');
  A[0].hp=A[0].maxHp*0.4; near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.95*0.925,'Rest Stop: 1.5% x 5 less below 50% HP');
  near(A[0].speed,s0*1.05,'Pilgrim\'s Pace: 1% x 5 faster'); near(A[0].atkInterval,i0/1.05,'and attacks faster');
  near(A[0].shield,v.maxHp*0.025,'Pilgrim Shield: 0.5% x 5 of Ambrel\'s max HP',1e-3); near(v.apow,ap0*(1+0.025*2),'Rising Smoke: 0.5% x 5 ability power per living Pilgrim');
  const h=A[0].hp; secs(2.0); near(A[0].hp-h,2*A[0].maxHp*0.005*1.09,'they heal 0.1% x 5 of their max HP each second (Way Station: 3% x 3 more)',0.02);
  v.hp=v.maxHp*0.5; const hv=v.hp; V.heal(v,1000); near(v.hp-hv,1090,'Way Station: Ambrel too, as a Pilgrim');
  secs(8.5); assert.ok(mark(L,A[0],'pil'),'Long Road: 8 s + 1 x 3'); secs(0.6); assert.ok(!mark(L,A[0],'pil'),'then not'); V.step(2); near(A[0].speed,s0,'its speed back'); near(v.apow,ap0,'');
});

test('Ambrel / Shrine Road, Holy Water, Blessed Feet, Long Pilgrimage',()=>{
  const L=lab(H,S(['ip_3_4','ip_12_4','ip_7_4','ip_10_4']),{foes:3,allies:2,big:true}), {v,A,F}=L; at(L,A[0],0,-4.5); at(L,A[1],0,-11); const a=A[0]; a.maxHp=1e6; a.hp=1e6;
  inc(L); a.slow=0; a.slowMul=1; V.cc(F[0],a,'slow',2); assert.equal(a.slow||0,0,'Holy Water: an ally just cleansed shrugs off a slow for 0.5 s x 3'); v.slow=0; V.cc(F[0],v,'slow',2); assert.equal(v.slow||0,0,'Ambrel too');
  secs(1.6); a.slowMul=1; V.cc(F[0],a,'slow',2); assert.ok(a.slow>0,'1.6 s later the slow lands'); const m=V.slowMulFor(100); near(a.slowMul,1-(1-m)*0.85,'Blessed Feet: 5% x 3 weaker on a Pilgrim');
  v.slowMul=1; V.cc(F[0],v,'slow',2); V.step(1); near(v.slowMul,1-(1-m)*0.85,'on Ambrel too');
  a.hp=4e5; a.silencedT=3; hitOn(L,a,2e5); const h1=a.hp; assert.ok(h1<3e5); V.step(1); assert.equal(a.silencedT,0,'Shrine Road: a Pilgrim dropping below 30% is cleansed'); near(a.hp-h1,0.4*v.apow,'and healed for 0.4 x her ability power',1e-6); a.stunned=1e6;
  a.hp=4e5; hitOn(L,a,2e5); const h2=a.hp; V.step(1); near(a.hp,h2,'once per Pilgrim',1e-9);
  inc(L,()=>at(L,a,0,-4.5)); a.hp=4e5; hitOn(L,a,2e5); const h3=a.hp; V.step(1); assert.ok(a.hp>h3,'made a Pilgrim again: again');
  V.wave(); V.step(1); near(a.shield,a.maxHp*0.05,'Long Pilgrimage: still a Pilgrim as the wave ended, the next starts with a shield of 1% x 5 of its max HP',1e-6); assert.ok(!(A[1].shield>0),'not one that was not');
});

test('Ambrel / Atonement: Penance, Hair Shirt, Making Amends, Confession, Bitter Smoke',()=>{
  const L=lab(H,S(['ip_2_3','ip_4_3','ip_9_3','ip_6_3','ip_10_3','ip_1_1']),{foes:3,allies:1,big:true}), {v,A,F}=L; at(L,A[0],0,-4.5); noDef(L);
  const i0=F[0].atkInterval; inc(L); assert.ok(mark(L,F[0],'atn'),'Incense: the enemies it reaches make Atonement'); assert.ok(!mark(L,F[1],'atn'),'not one 10 m away'); assert.equal(stack(L,'cdl'),2);
  V.step(1); near(F[0].atkInterval,i0/0.94,'Bitter Smoke: they attack 2% x 3 slower');
  A[0].hp=A[0].maxHp*0.5; const h=A[0].hp; V.hit(F[0],A[0],1000,{kind:'true'}); const d=h-A[0].hp; near(d,750,'(the hit lands first, whole - less the 25% attack cut of Incense - and the heal comes after it)',1e-6); const h1=A[0].hp; V.step(1); near(A[0].hp-h1,d*0.15*1.10,'Penance: 3% x 5 of it heals the ally it hit (Making Amends: 1% x 5 more per Candle)',1e-6);
  v.hp=v.maxHp*0.5; const hv=v.hp; V.hit(F[0],v,1000,{kind:'true'}); V.step(1); assert.ok(v.hp>hv-1000,'Ambrel too');
  const c=lost(F[0],()=>V.cast(v,'green',F[0])), cp=plainHit(L,()=>lost(F[0],()=>V.cast(v,'green',F[0]))); near(c,cp*1.075,'Confession: 1.5% x 5 more from Ambrel');
  secs(7.2); assert.ok(mark(L,F[0],'atn'),'Hair Shirt: 6 s + 0.5 x 3'); secs(0.3); assert.ok(!mark(L,F[0],'atn'),'then not'); V.step(2); near(F[0].atkInterval,i0,'');
});

test('Ambrel / Gentle Penance with Forgiven, and Hard Penance (PICK ONE: each in its own lab)',()=>{
  const L=lab(H,S(['ip_2_3','ip_5_2','ip_6_2']),{foes:3,allies:1,big:true}), {v,A,F}=L; at(L,A[0],0,-4.5);
  inc(L); assert.ok(!(F[0]._atkDnPct>0),'Gentle Penance: Incense no longer cuts the attack of the enemies making Atonement');
  A[0].hp=A[0].maxHp*0.5; V.hit(F[0],A[0],1000,{kind:'true'}); const h=A[0].hp; V.step(1); near(A[0].hp-h,1000*0.15*2*1.15,'twice the healing, Forgiven 5% x 3 more',1e-6);
  const M=lab(H,S(['ip_2_3','ip_5_3']),{foes:3,allies:1,big:true}); at(M,M.A[0],0,-4.5); inc(M); assert.ok(M.F[0]._atkDnPct>0,'Hard Penance keeps the cut');
  const n=hitOn(M,M.A[0],1000), c=hitOn(M,M.A[0],1000,{crit:true}), cp=plainHit(M,()=>hitOn(M,M.A[0],1000,{crit:true})); assert.ok(cp>n*1.2,'(a crit is bigger)'); near(c,n,'Hard Penance: an Atoning enemy\'s critical hit deals a normal hit');
  near(hitOn(M,M.A[0],1000,{crit:true,src:M.F[1]}),plainHit(M,()=>hitOn(M,M.A[0],1000,{crit:true,src:M.F[1]})),'an enemy not Atoning: its crit');
});

test('Ambrel / her heals: Sweet Incense, Radiant Fumes, Alms; Censer Swing (Incense again at half strength 3 s later); High Mass of Penance',()=>{
  const L=lab(H,S(['rh_4_3','ip_7_2','ip_n1','ip_11_3']),{foes:3,allies:2,big:true}), {v,A,F}=L; at(L,A[0],0,-4.5); at(L,A[1],2,-4); const base=v.apow*0.4*VMX('skillMul')(10)*v.healPowMul;
  A[0].hp=A[0].maxHp*0.5; A[1].hp=A[1].maxHp*0.3; const a=A[0].hp, b=A[1].hp; inc(L);
  near(A[0].hp-a,base*1.12*1.15,'4% x 3 and 3% x 5 more',1e-6); near(A[1].hp-b,base*1.12*1.15*1.15,'Alms: 3% x 5 more below 40% HP',1e-6);
  v.hp=v.maxHp*0.5; const a1=v.hp; secs(2.9); near(v.hp,a1,'',1e-9); secs(0.2); v.stunned=1e6; for(const x of A) x.stunned=1e6; near(v.hp-a1,base*0.5*1.12*1.15,'Censer Swing: 3 s later, again at half strength (on Ambrel: always inside it)',1e-6); near(F[0]._atkDnPct,0.25,'');
  const a2=v.hp; secs(3.5); near(v.hp,a2,'the second cast does not swing again',1e-9);
  const M=lab(H,S(['ip_7_3','ip_1_4']),{foes:3,allies:1,big:true}); at(M,M.A[0],0,-4.5); V.cast(M.v,'ult'); assert.ok(mark(M,M.A[0],'pil'),'High Mass of Penance: every ally its light reaches becomes a Pilgrim'); assert.ok(mark(M,M.F[0],'atn'),'every enemy it hits makes Atonement'); assert.ok(!mark(M,M.F[1],'atn'),'not beyond its 6 m');
});

test('Ambrel / Under Its Protection (SIGNATURE): at 7 Candles, 5 s of Pilgrims and triple Atonement; an ally within 6 m who would fall is held at 1 HP for 1 s, once per fight',()=>{
  const L=lab(H,S(['ip_13_3','ip_1_1','ip_2_3']),{foes:3,allies:2,big:true}), {v,A,F}=L; at(L,A[0],0,-4.5); at(L,A[1],0,-11); setStack(L,'cdl',5);
  inc(L); assert.equal(stack(L,'cdl'),7); assert.ok(win(L,'uip'),'7 Candles: the nave opens'); assert.ok(mark(L,A[1],'pil')&&mark(L,F[2],'atn'),'every ally a Pilgrim, every enemy makes Atonement');
  A[1].hp=A[1].maxHp*0.5; V.hit(F[2],A[1],1000,{kind:'true'}); const h=A[1].hp; V.step(1); near(A[1].hp-h,1000*0.15*3,'Atonement at triple strength',1e-6);
  const a=A[0]; a.hp=10; V.dmg(a,1e12); assert.ok(a.alive&&a.hp===1,'an ally within 6 m that would fall is held at 1 HP'); assert.equal(stack(L,'cdl'),6,'and one Candle burns out'); V.dmg(a,1e12); assert.ok(a.alive,'for 1 s');
  secs(1.1); V.dmg(a,1e12); assert.ok(!a.alive,'then it falls (once per fight)');
  A[1].hp=10; V.dmg(A[1],1e12); assert.ok(!A[1].alive,'an ally 11 m away is not held');
  secs(4); assert.ok(!win(L,'uip'),'5 s'); setStack(L,'cdl',5); inc(L,()=>at(L,A[0],0,-4.5)); assert.ok(!win(L,'uip'),'once every 25 s');
});

/* ============================== THE GATES ============================== */
test('Ambrel / Barred: Bar the Door, Iron Bolts, Barricade, Locked Out, The Hour of Closing (with The First Peal), Gatekeeper, Heavy Lintel, No Way Through',()=>{
  const L=lab(H,S(['gt_1_1','gt_2_1','gt_10_1','gt_3_1','gt_n1','rh_1_1','gt_8_1','gt_12_4','gt_11_1']),{foes:6,allies:1,allyKey:'sloe',big:true}), {v,A,F}=L; noDef(L);
  for(const f of F) free(f); at(L,F[1],4.5,2.4); at(L,F[4],6.5,-1); const s0=F[0].speed, i0=F[0].atkInterval;
  const ap1=v.apow, d1=lost(F[0],()=>V.cast(v,'green',F[0])); near(F[0].stunned,1.4,'the slam\'s 1.4 s stun',1e-9);
  assert.ok(mark(L,F[0],'bar')&&mark(L,F[1],'bar')&&mark(L,F[4],'bar'),'Barred'); assert.equal(stack(L,'ps'),2,'The Hour of Closing: each enemy it leaves Barred strikes a Peal, up to 2 a slam');
  V.step(1); near(F[0].speed,s0*0.88,'Bar the Door: 4% x 3 slower'); near(F[0].atkInterval,i0/0.90,'Barricade: they attack 2% x 5 slower');
  const g=lost(F[0],()=>V.hit(v,F[0],1000)), gp=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000))); near(g,gp*1.15,'Gatekeeper: 3% x 5 more to Barred enemies');
  const hh=F[0].hp; V.heal(F[0],1000); near(F[0].hp-hh,900,'Heavy Lintel: 5% x 2 less healing');
  secs(1.5); assert.ok(!(F[0].stunned>0)); F[0].stunned=0; V.hit(F[0],A[0],100,{kind:'true'}); near(F[0].stunned,0.6,'No Way Through: a Barred enemy that attacks an ally in the back row is stunned 0.6 s',1e-9);
  F[0].stunned=0; V.hit(F[0],A[0],100,{kind:'true'}); near(F[0].stunned,0,'once per enemy each wave');
  const ap2=v.apow, d2=lost(F[0],()=>V.cast(v,'green',F[0])); near(d2,d1*(ap2/ap1)*1.05*1.15,'a slam on an enemy already Barred: The Hour of Closing 5% more (and Gatekeeper; and the ability power of the two Peals)'); near(F[0].stunned,1.4+0.5,'Locked Out: stunned 0.5 s longer',1e-9);
  secs(1.9+5.5-0.2); assert.ok(mark(L,F[0],'bar'),'Iron Bolts: Barred until 4 s + 0.5 x 3 after the stun'); secs(0.4); assert.ok(!mark(L,F[0],'bar'),'then not'); V.step(2); near(F[0].speed,s0,'its speed back');
  V.wave(); V.step(1); V.cast(v,'green',F[0]); secs(1.5); F[0].stunned=0; V.hit(F[0],A[0],100,{kind:'true'}); near(F[0].stunned,0.6,'a new wave: No Way Through again',1e-9);
});

test('Ambrel / Open Doors with Threshold, and Sealed (PICK ONE: each in its own lab)',()=>{
  const L=lab(H,S(['gt_1_1','gt_5_3','gt_6_3','gt_3_1']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); const f=F[0];
  V.cast(v,'green',f); near(f.stunned,1.4,'the first slam stuns',1e-9); secs(1.5); const g0=Math.hypot(f.x-v.x,f.y-v.y);
  V.cast(v,'green',f); assert.equal(f.stunned,0,'Open Doors: an enemy already Barred is not stunned (nor Locked Out)'); assert.ok(f.slow>0&&Math.abs(f.slowMul-0.7)<1e-9,'it is slowed 30%'); near(f.slow,2.9,'for 2 s + 0.3 x 3',0.05);
  const p=f.pulledBy; near(Math.hypot(p.x-v.x,p.y-v.y)-g0,2*V.METER,'and pushed 2 m away from Ambrel (the engine\'s drag, to the point 2 m beyond it)',1e-6); near(f.pullSpeed*f.pullT,2*V.METER,'',1e-6); near(f.pullStop,0,'');
  V.step(1); assert.ok(Math.hypot(f.x-v.x,f.y-v.y)>g0+0.1*V.METER,'it moves away');
  const M=lab(H,S(['gt_1_1','gt_5_2']),{foes:3,big:true}); for(const x of M.F) free(x); V.cast(M.v,'green',M.F[0]); secs(1.3); assert.ok(!(M.F[0].silencedT>0),'Sealed: not during the stun');
  secs(0.2); assert.ok(M.F[0].silencedT>0.85,'silenced for the first 1 s after it'); secs(1.0); assert.ok(!(M.F[0].silencedT>0));
});

test('Ambrel / Doors Slam Twice: 1 s later on the same spot for 40% of the damage; the enemies the first slam Barred are stunned again 0.5 s',()=>{
  const L=lab(H,S(['gt_7_1','gt_1_1','rh_2_3']),{foes:3,big:true}), {v,F}=L; noDef(L); for(const f of F) free(f); const f=F[0];
  const raw=v.apow*1.1*VMX('skillMul')(10)*VMX('rageMul'); const d1=lost(f,()=>V.cast(v,'green',f)); near(d1,raw*1.12*VMX('elemMul')(v,f),'the slam (Gate Weight 4% x 3)',1e-6);
  secs(0.95); const h=f.hp; secs(0.1); near(h-f.hp,raw*0.4*1.12,'40% of the slam, again on the spot (Gate Weight too)',1e-6); near(f.stunned,0.5,'stunned again 0.5 s',0.08);
});

test('Ambrel / Masonry: Masonry, Old Stones, Cornerstone, Rebuilt Walls, Bulwark Stones, Built to Last, Mortar',()=>{
  const L=lab(H,S(['gt_1_2','gt_6_4','gt_2_2','gt_4_2','gt_8_2','gt_9_2']),{foes:6,allies:1,big:true}), {v,A,F}=L; V.step(1); const near3=()=>{ at(L,F[0],4.5,0); at(L,F[1],4.5,2.4); at(L,F[4],6.5,-1); };
  assert.equal(stack(L,'mas'),4,'Old Stones: 2 x 2 at the wave start'); const ar=v.armorRating/(1+0.025*4), mh=v.maxHp/(1+0.01*4);
  v.hp=v.maxHp*0.5; const h=v.hp; near3(); V.cast(v,'green',F[0]); assert.equal(stack(L,'mas'),7,'each enemy Cathedral Gates hits lays a stone'); near(v.hp-h,v.maxHp*0.015*3,'Rebuilt Walls: 0.5% x 3 of her max HP per stone laid',1e-3);
  V.step(1); near(v.armorRating,ar*(1+0.025*7),'Masonry: 0.5% x 5 armor per stone'); near(v.maxHp,mh*(1+0.01*7),'Bulwark Stones: 0.2% x 5 max HP per stone');
  near3(); V.cast(v,'green',F[0]); V.cast(v,'green',F[0]); assert.equal(stack(L,'mas'),11,'Cornerstone: up to 8 + 1 x 3'); V.step(1); near(v.armorRating,ar*(1+0.025*11),'');
  A[0].shield=0; at(L,A[0],0,-4.5); V.cast(v,'ult'); near(A[0].shield,v.maxHp*0.05,'Built to Last: at 8 Masonry Divine Mass shields every ally its light reaches for 5% of her max HP');
  setStack(L,'mas',5); near3(); V.cast(v,'ult'); assert.equal(stack(L,'mas'),8,'and lays a stone for each enemy it hits');
  V.wave(); V.step(1); assert.equal(stack(L,'mas'),4,'a new wave: the stones are gone (Old Stones: 4)');
  const M=lab(H,S(['gt_1_2','gt_10_2']),{foes:1,big:true}); setStack(M,'mas',8); V.wave(); V.step(1); assert.equal(stack(M,'mas'),3,'Mortar: 1 x 3 kept between waves');
});

test('Ambrel / Sin: Sins Remembered, Ledger of Sins, Weight of Sin, Confessor, Original Sin, Penitent Stone, Day of Judgment',()=>{
  const L=lab(H,S(['gt_1_4','gt_3_4','gt_5_4','gt_7_4','gt_9_4','gt_11_2','gt_12_2']),{foes:3,allies:1,big:true}), {v,A,F}=L; noDef(L);
  for(let i=0;i<3;i++) V.hit(F[0],A[0],10,{kind:'true'}); assert.equal(ust(L,F[0],'sin'),3,'an enemy that hits one of her allies gains 1 Sin each time');
  setUst(L,F[1],'sin',3); near(hitOn(L,A[0],1000,{src:F[1]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[1]}))*0.94,'Weight of Sin: 3 or more Sin deal 2% x 3 less'); setUst(L,F[1],'sin',3);
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*0.94,'to Ambrel too');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.05,'Confessor: an enemy with Sin takes 1% x 5 more from her team');
  for(let i=0;i<4;i++) V.hit(F[0],A[0],10,{kind:'true'}); assert.equal(ust(L,F[0],'sin'),5,'max 5');
  secs(14.5); assert.equal(ust(L,F[0],'sin'),5,'Ledger of Sins: 10 s + 1 x 5'); secs(0.6); assert.equal(ust(L,F[0],'sin'),0,'then they lapse');
  let n=0; for(let i=0;i<40;i++){ const s0=ust(L,F[2],'sin'); V.hit(F[2],v,1,{kind:'true'}); if(ust(L,F[2],'sin')>s0) n++; setUst(L,F[2],'sin',0); } assert.ok(n>=10&&n<=30,'Original Sin: a hit on Ambrel gives 1 Sin 10% x 5 of the time: '+n+' of 40');
  setUst(L,F[0],'sin',5); setUst(L,F[1],'sin',2); v.hp=v.maxHp*0.1; const mp=plainHit(L,()=>lost(F[0],()=>V.cast(v,'ult'))), hp=v.hp-v.maxHp*0.1; setUst(L,F[0],'sin',5);
  v.hp=v.maxHp*0.1; const hv=v.hp+hp; const m=lost(F[0],()=>V.cast(v,'ult')); near(m,mp*(1+0.15*5)*1.10*1.05,'Divine Mass: 3% x 5 more per Sin on its target, Day of Judgment 2% x 5 more at 5 (and Confessor)');
  assert.equal(ust(L,F[0],'sin'),0,'and clears them'); assert.equal(ust(L,F[1],'sin'),2,'not on an enemy beyond its 6 m'); near(v.hp-hv,v.maxHp*0.05*5,'Penitent Stone: each Sin cleared heals her 1% x 5 of her max HP',1e-6);
});

test('Ambrel / A Building That Would Not Be Left (SIGNATURE): an enemy reaching 5 Sin while Barred is stunned 2 s, takes Divine Mass at half strength, every Sin within 6 m judged; once every 20 s',()=>{
  const L=lab(H,S(['gt_1_1','gt_1_4','gt_13_2']),{foes:3,allies:1,big:true}), {v,A,F}=L; noDef(L); for(const f of F) free(f); at(L,F[1],4.5,4.5);
  V.cast(v,'green',F[0]); secs(1.5); setUst(L,F[0],'sin',4); setUst(L,F[1],'sin',3); setUst(L,F[2],'sin',3);
  const half=v.apow*VMX('skillMul')(10)*1.8*0.5*VMX('rageMul'), h0=F[0].hp, h1=F[1].hp, h2=F[2].hp;
  V.hit(F[0],A[0],10,{kind:'true'}); near(F[0].stunned,2,'the gates close on it: stunned 2 s, in full',1e-9);
  near(h0-F[0].hp,half+0.05*v.apow*5,'Divine Mass\'s damage at half strength, then its own 5 Sin judged for 5% of her ability power each',1e-6);
  near(h1-F[1].hp,0.05*v.apow*3,'an enemy within 6 m: its 3 Sin',1e-6); near(h2-F[2].hp,0,'not one farther away'); assert.equal(ust(L,F[1],'sin'),0,'judged Sins are cleared');
  F[0].stunned=0; setUst(L,F[0],'sin',4); V.hit(F[0],A[0],10,{kind:'true'}); near(F[0].stunned,0,'once every 20 s');
  setUst(L,F[2],'sin',4); V.hit(F[2],A[0],10,{kind:'true'}); near(F[2].stunned,0,'(and only while Barred)');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Ambrel: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['rh_1_1','rh_1_4','rh_n1','ip_1_1','ip_6_1','ip_1_4','ip_2_3','gt_1_1','gt_1_2','gt_1_4','gt_7_1']), TEAM=['vael','sylthaine','vireo','vex','ambrel'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let bar=false, sin=0, atn=false;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.bar&&o.bar.until>V.now()) bar=true; if(o.atn&&o.atn.until>V.now()) atn=true; if(o['#sin']&&o['#sin'].until>V.now()) sin=Math.max(sin,o['#sin'].v); } }
  assert.ok(mx.ps>=3,'real rings struck Peals: '+mx.ps); assert.ok(mx.cdl>=2,'real Incense lit Candles: '+mx.cdl); assert.ok(mx.mas>=1,'real slams laid Masonry: '+mx.mas);
  assert.ok(bar,'real slams Barred'); assert.ok(atn,'real Incense set Atonement'); assert.ok(sin>=1,'real enemy hits on her allies earned Sin: '+sin);
  determinism(H,TEAM);
});

/* The page sites her talents added (the 'pass' hook at Sacred Bells' ring, the 'at' hook in Cathedral Gates' case, the bindMore line): with nothing learned,
   whole seeded fights with Ambrel in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. tests/talents-fight.test.js does the same
   for line-ups without her. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Ambrel: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['ambrel','vael','vireo','sylthaine','gruel'], foeTeam=['bloatus','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __amN={ring:0,gates:0,inc:0,mass:0}; var __amD=_doEffectCore, __amP=firePassiveClip;'+
    'firePassiveClip=function(u){ if(u&&u.key==="ambrel") __amN.ring++; return __amP.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="ambrel"&&(!o||!o.deliver||o._arrived)){ if(type==="aoeStun") __amN.gates++; if(type==="incense") __amN.inc++; if(type==="sunburst") __amN.mass++; } return __amD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__amN'); assert.ok(c.ring>0&&c.gates>0&&c.inc>0&&c.mass>0,'the fights rang her bells ('+c.ring+'), slammed Cathedral Gates ('+c.gates+'), cast Incense ('+c.inc+') and Divine Mass ('+c.mass+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__amD; firePassiveClip=__amP;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ rh:['rh_n1','rh_6_1','rh_8_3','rh_11_3','rh_9_3','rh_2_2','rh_3_3','rh_12_3','rh_1_3','rh_3_1','rh_13_2'],
            ip:['ip_1_4','ip_5_1','ip_11_4','ip_11_2','ip_9_2','ip_1_2','ip_8_2','ip_12_1','ip_1_1','ip_2_4'],
            gt:['gt_6_2','gt_8_3','gt_11_4','gt_5_4','gt_1_2','gt_2_2','gt_8_2','gt_10_3','gt_12_3','gt_3_3','gt_6_4','gt_1_4'] };
function defensive(order){ let b={r:{}}; const want=[].concat(...order.map(k=>DEF[k])), meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, goals=[]; for(const id of want) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
    if(id){ b=T.learn(H,b,id,100).build; continue; }
    const open=goals.find(x=>(b.r[x]|0)<meta(x).ranks), tree=open?meta(open).treeIdx:null;
    const pool=T.trees(H).map((tr,i)=>tr.talents.filter(t=>(tree==null||i===tree)&&!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1]||x[2]-y[2]);
    const any=pool[0]||T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her damage-reduction talents true at once (the attacker is a ranged back-row enemy in the Knell with 5 Sin; the bells
   have just rung, on the 12th Peal (Noon's doubled cut in her skill slot) with the signature's 30% window; Peal 9; 11 Masonry; she is a Pilgrim below half HP with
   7 Candles lit), as a normal hit and as a critical one. Her bells are sized at passive level 100. Measured through the engine: what reaches her HP and shield against the hit */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:3,cold:true}), {v,F}=L; V.step(1); const f=F[0], now=V.now(), pm100=VMX('skillMul')(100);   // the bells at passive level 100 (21.9%), as in the seeded fights
  f.t=Object.assign({},f.t,{row:'Back'}); f.melee=false; f.hp=f.maxHp*0.1;
  if(L.T){ const P=L.T.P, M=x=>(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={}); M(f)['#sin']={v:5,until:1e9}; M(v).pil={t0:now,until:1e9,v:0};
    for(const w of ['rs','lts']) L.T.s.w[w]={t:99,n:1,cdT:0,at:-1,wave:false}; setStack(L,'pos',9); setStack(L,'mas',11); setStack(L,'cdl',7);
    const cut=(0.10*pm100+(P['bell.add']||0))*(L.T.r.rh_3_1?2:1); v.drMul=Math.max(0.05,1-cut); v.drT=99; }
  else { v.drMul=1-0.10*pm100; v.drT=99; }
  V.step(1); v.maxHp=1e5; v.hp=4e4; v.shield=1e12; v.shieldT=999;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Ambrel: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[['rh','gt','ip'],['gt','rh','ip'],['ip','rh','gt'],['rh','ip','gt'],['gt','ip','rh']].map(o=>{ const b=defensive(o); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="ambrel"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="ambrel"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','ambrel'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));   // a line-up that reaches the back row
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.equal(d.imm,0,'and she is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
