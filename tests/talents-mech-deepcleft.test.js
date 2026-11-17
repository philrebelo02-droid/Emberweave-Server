'use strict';
/* Deepcleft's talents as data on the mechanics layer (talents-mech/deepcleft.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   dlab(): the lab with Deepcleft NOT held (he thinks: Burrow Guard's emerge runs) but rooted, not attacking, nothing ready. Enemies stay held (their own
   armor-break clock does not run while they are stunned: the game's own rule).
   Places (metres from Deepcleft, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5). The lab's skill level is 10.
   Run: node --test tests/talents-mech-deepcleft.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='deepcleft', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const ustUntil=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return m?m.until-V.now():0; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const gapM=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/V.METER-V.bodyR(a)-V.bodyR(b);
const dm=(s,t,k)=>VMX('defMul')(s,t,k);
const rage=()=>VMX('rageMul');
const clk=(L,id)=>{ for(const k in L.T.s.lim) if(k.slice(0,id.length+1)===id+'#') delete L.T.s.lim[k]; };   // a row's limiters as new (its clock from now)
/* an enemy unit that thinks but does nothing (no move, no attack, nothing ready), at level 1 so a skill's control is not resisted */
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };
function dlab(list,o){ const L=lab(H,list,Object.assign({},o||{},{cold:true})); const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=99; v.blueCd=99; v.energy=0; V.step(1); return L; }
const plain=(o,fn)=>fn(dlab(null,o));
/* hits: an enemy's hit on t (true damage), his hit on t; ratio = with his talents / with them off for that one hit */
const hitOn=(L,t,amt,o)=>{ const r=lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{}))); L.v.energy=0; return r; };
const ratio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
let inRatio=(L,o,amt)=>{ const v=L.v, h=v.hp; const a=hitOn(L,v,amt||100,o); v.hp=h; const b=plainHit(L,()=>hitOn(L,v,amt||100,o)); v.hp=h; return a/b; };
function skillRatio(L,t,skill,o){ const s=L.T.s, keep={}; o=Object.assign({cur:skill},o||{}); for(const k in o){ keep[k]=s[k]; s[k]=o[k]; } let a;
  try{ a=lost(t,()=>V.hit(L.v,t,1000,{kind:'true'})); } finally{ for(const k in keep) s[k]=keep[k]; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,{kind:'true'}))); }
const auto=(L,t,amt)=>lost(t,()=>V.hit(L.v,t,amt||10,{kind:'true',auto:true}));
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const atkNow=L=>L.v.dmg*((L.v.dmgBuffT>0)?(L.v.dmgBuffMul||1):1)*rage();
const emerge=L=>{ V.cast(L.v,'blue'); secs(1.45); assert.ok(!(L.v._bgT>0),'he has come up'); };

test('Deepcleft: every talent is accounted for - 10 plain stats, 107 with rows, none waiting',()=>{
  accounting(H,[117,10,107,0,0]);
  const M=FXN.mech(H); for(const id of ['sr_1_1','nd_1_1','um_1_1','sr_13_2','nd_13_2','um_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['sr_2_3','sr_6_4','sr_8_3','sr_11_1','nd_2_3','nd_10_1','nd_11_4','um_5_1','um_7_1','um_11_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Deepcleft: his real kit, as the talents read it - Fault Claws\' break, Burrow Guard under and up beneath the nearest enemy, Relentless Digger, Quarry Collapse',()=>{
  plain({foes:4},P=>{ const {v,F}=P, sm=VMX('skillMul')(10);
    V.cast(v,'green',F[0]); near(F[0]._shredPct,VMX('shredAt')(0.3,sm),'Fault Claws: armor 30% lower (a third of the skill curve)',1e-9); near(F[0]._shredT,5,'for 5 s',1e-9);
    secs(1); near(F[0]._shredT,5,'a stunned enemy\'s break does not run down (its own think holds it)',1e-9);
    const f0=F[0].hp; V.cast(v,'blue'); near(v.drMul,0.25,'Burrow Guard: the one damage-reduction slot 0.25',1e-9); near(v.drT,1.4,'',1e-9); near(v._bgT,1.4,'1.4 s under',1e-9); assert.ok(v._noTarget,'untargetable');
    near(lost(v,()=>V.hit(F[1],v,1000,{kind:'true'})),0,'no hit reaches him under'); secs(1.45); assert.ok(!v._noTarget&&!(v._bgT>0),'he came up');
    assert.ok(F[0].hp<f0,'and struck the nearest enemy (F0)'); assert.ok(gapM(v,F[0])<2,'beside it');
    const d0=v._digStk||0; V.hit(F[1],v,10,{kind:'true'}); assert.equal(v._digStk,d0+1,'Relentless Digger: a stack for a hit'); near(v.hasteMul,1+0.035*(v.passMul||1)*v._digStk,'its attack speed',1e-9); near(v.hasteT,4,'4 s',1e-9);
    v.stunned=1; V.hit(F[1],v,10,{kind:'true'}); assert.equal(v._digStk,d0+3,'two while stunned'); v.stunned=0;
    free(F[0]); free(F[1]); F[1].x=F[0].x; F[1].y=F[0].y+3.6*V.METER; const h1=F[1].hp, h2=F[2].hp; V.cast(v,'ult',F[0]); near(F[0].stunned,2*V.ccNerf,'Quarry Collapse: a 1.4 s stun',1e-9);
    assert.ok(F[1].hp<h1&&F[1].stunned>1,'every enemy within 4.26 m of its target (F1, 3.6 m away)'); near(h2-F[2].hp,0,'not F2'); });
});

/* ============================== THE SEAM READER ============================== */
test('Deepcleft / Seams and the Split: Read the Face, One Good Pull, Fine Cracks, Seam Sense, Iron-Shod Claws, Ten Years Digging',()=>{
  const L=dlab(S(['sr_1_1','sr_3_1','sr_2_1','sr_7_1','sr_1_3','sr_9_3']),{foes:4,big:true}), {v,F}=L; const i0=v.atkInterval;
  V.cast(v,'green',F[0]); assert.equal(ust(L,F[0],'seam'),1,'One Good Pull: Fault Claws opens a Seam'); assert.ok(mark(L,F[0],'fc'),'it is under the break');
  auto(L,F[0]); auto(L,F[0]); assert.equal(ust(L,F[0],'seam'),3,'each basic attack on it opens one');
  near(ratio(L,F[0],{auto:true}),1.10*1.15,'Iron-Shod Claws 2% x 5, Seam Sense 1% x 5 per Seam (3)'); assert.equal(ust(L,F[0],'seam'),4);
  near(ratio(L,F[0]),1,'not his skills'); V.step(1); near(v.atkInterval,i0/(1+0.015*4),'Ten Years Digging: 0.3% x 5 attack speed per Seam on his target');
  const b=plainHit(L,()=>auto(L,F[0],10)), a=auto(L,F[0],10); assert.equal(ust(L,F[0],'seam'),0,'the fifth Splits and clears them');
  near(a-b*1.10*1.20,0.8*5*atkNow(L),'the Split: 2% x 5 of its max HP, never more than 80% x 5 of his attack (a billion HP)',1e-6);
  const f=F[1]; f.maxHp=f.hp=1000; V.cast(v,'green',f); setUst(L,f,'seam',4); const h=f.hp; auto(L,f,1); near(h-f.hp,1.32+100,'a small enemy: 10% of its max HP',1e-6);
  const g=F[3]; V.cast(v,'green',g); assert.equal(ust(L,g,'seam'),1); secs(6.9); assert.equal(ust(L,g,'seam'),1,'Fine Cracks: open 4 + 1 x 3 s'); secs(0.2); assert.equal(ust(L,g,'seam'),0,'then closed');
  auto(L,F[2]); assert.equal(ust(L,F[2],'seam'),0,'no Seam on an enemy that is not under the break');
});

test('Deepcleft / Clean Face (PICK ONE) and Fresh Face; First Look',()=>{
  { const L=dlab(S(['sr_5_3','sr_6_3']),{foes:4,big:true}), {v,F}=L;
    V.cast(v,'green',F[0]); assert.ok(F[0]._shredPct<1e-6,'Clean Face: Fault Claws lowers no armor'); assert.ok(!mark(L,F[0],'fc'),'no break'); assert.equal(ust(L,F[0],'seam'),2,'it opens 2 Seams');
    V.hit(v,F[1],10,{kind:'true'}); assert.equal(ust(L,F[1],'seam'),1,'any hit of his opens one'); auto(L,F[1]); assert.equal(ust(L,F[1],'seam'),2,'');
    setUst(L,F[1],'seam',4); v.hp=v.maxHp*0.5; const h0=v.hp; auto(L,F[1]); assert.equal(ust(L,F[1],'seam'),0,'it Splits'); near(v.hp-h0,v.maxHp*0.03,'Fresh Face: 1% x 3 of his max HP',1e-6); }
  const L=dlab(S(['sr_12_1','sr_1_1']),{foes:4,big:true}), {v,F}=L;
  V.hit(v,F[2],10,{kind:'true'}); assert.equal(ust(L,F[2],'seam'),3,'First Look: his first hit on an enemy opens 1 x 3 Seams'); V.hit(v,F[2],10,{kind:'true'}); assert.equal(ust(L,F[2],'seam'),3,'only the first');
});

test('Deepcleft / Lying Wall, Know the Liar, Truth Told, Deep Rake, Long Seam, Wall Comes Down (PICK ONE), Cut the Seam',()=>{
  const L=dlab(S(['sr_1_1','sr_1_4','sr_3_4','sr_10_4','sr_2_2','sr_4_2','sr_5_2','sr_11_2']),{foes:4,big:true}), {v,F}=L; const sm=VMX('skillMul')(10);
  F[2].armorRating=9999; V.wave(); V.step(1); assert.ok(mark(L,F[2],'lw'),'Lying Wall: the enemy with the most armor at the wave\'s start'); assert.ok(!mark(L,F[0],'lw'));
  V.cast(v,'green',F[2]); near(F[2]._shredPct,VMX('shredAt')(0.3,sm)+0.09,'Fault Claws lowers its armor 3% x 3 more',1e-9); near(F[2]._shredT,5+1.5,'Long Seam: 0.5 x 3 s longer',1e-9);
  near(ratio(L,F[2]),1.10,'Know the Liar: 2% x 5 more to it'); near(skillRatio(L,F[2],FCs),1.10*1.15*1.15,'Truth Told 3% x 5 and Deep Rake 3% x 5 for Fault Claws'); near(skillRatio(L,F[0],FCs),1.15,'Deep Rake on any enemy');
  F[2]._shredT=0.5; auto(L,F[2]); near(F[2]._shredT,2,'Wall Comes Down: his hit keeps the break 2 s',1e-9);
  assert.equal(ust(L,F[2],'seam'),1); assert.ok(ustUntil(L,F[2],'seam')>1e8,'Cut the Seam: no closing while the break holds');
  F[2]._shredT=0; V.step(1); assert.ok(!mark(L,F[2],'fc'),'the break is over'); assert.ok(Math.abs(ustUntil(L,F[2],'seam')-4)<0.05,'its Seams close 4 s from then');
});
const FCs='shred', BGs='burrowguard', QCs='aoeStun';

test('Deepcleft / Cut the Seam: Seams not under the break close as usual',()=>{
  const L=dlab(S(['sr_11_2','sr_12_1']),{foes:4,big:true}), {v,F}=L; V.hit(v,F[3],10,{kind:'true'}); assert.equal(ust(L,F[3],'seam'),3); assert.ok(Math.abs(ustUntil(L,F[3],'seam')-4)<0.05,'no break: they close 4 s after');
});

test('Deepcleft / Liar Unmasked and Liar\'s Due: the next most armored enemy becomes the Lying Wall with 4 Seams; 4% x 3 healed',()=>{
  const L=dlab(S(['sr_9_4','sr_12_4','sr_1_4','sr_1_1']),{foes:4,big:true}), {v,F}=L; F[2].armorRating=9999; F[3].armorRating=5000; V.wave(); V.step(1); assert.ok(mark(L,F[2],'lw'));
  v.hp=v.maxHp*0.5; const h0=v.hp; kill(L,F[2]); assert.ok(mark(L,F[3],'lw'),'the next most armor'); assert.equal(ust(L,F[3],'seam'),4,'with 4 Seams'); near(v.hp-h0,v.maxHp*0.12,'Liar\'s Due',1e-6);
  const h1=v.hp; kill(L,F[1]); near(v.hp-h1,0,'not another enemy');
});

test('Deepcleft / the Split\'s riders: Spalling, Rockfall, Brittle Seam, Moss Off, Tremor Hands, Aftercrack, Rubble Skin, Read Every Face',()=>{
  const L=dlab(S(['sr_1_1','sr_4_1','sr_8_1','sr_9_2','sr_5_4','sr_6_1','sr_10_1','sr_10_2','sr_12_2']),{foes:4,allies:1,big:true}), {v,F,A}=L; const a0=v.dmg;
  at(L,F[1],4.5,2*V.bodyR(F[0])+1.0); assert.ok(gapM(F[0],F[1])<2&&gapM(F[0],F[1])>0.5,'(F1 within 2 m of F0)');
  V.cast(v,'green',F[0]); setUst(L,F[0],'seam',4); v.greenCd=6; v.shield=0; const s0=atkNow(L)*0.8*5*1.15*1.20, f1=F[1].hp;
  const b=plainHit(L,()=>auto(L,F[0],10)), a=auto(L,F[0],10); near(a-b,s0,'the Split on a broken enemy: Rockfall 3% x 5, Brittle Seam 4% x 5',1e-6);
  near(f1-F[1].hp,s0*0.75,'Spalling: 15% x 5 of it to an enemy within 2 m',1e-6); near(v.greenCd,6-1.5,'Tremor Hands: 0.5 x 3 s off Fault Claws',1e-9);
  near(v.shield,v.maxHp*0.03,'Rubble Skin: a shield of 1% x 3 of his max HP',1e-6); V.step(1); near(v.dmg,a0*1.025,'Read Every Face: 0.5% x 5 attack');
  near(ratio(L,F[0]),1.09*1.10,'Moss Off 3% x 3 and Aftercrack 2% x 5'); near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.09,'Moss Off: his team');
  secs(2.0); near(ratio(L,F[0]),1.09,'Aftercrack 2 s'); secs(1.0); near(ratio(L,F[0]),1,'Moss Off 3 s');
  setMk(L,F[3],'fc'); F[3]._shredT=0; setUst(L,F[3],'seam',4); const c=plainHit(L,()=>auto(L,F[3],10)); setUst(L,F[3],'seam',4); const d=auto(L,F[3],10);
  near(d-c,atkNow(L)*4*1.15,'(no Brittle Seam on an enemy not broken)',1e-6);
  setMk(L,F[2],'fc'); for(let i=0;i<12;i++){ setUst(L,F[2],'seam',4); auto(L,F[2]); } V.step(1); near(v.dmg,a0*1.25,'Read Every Face: up to 10 Splits');
});

test('Deepcleft / The Whole Cliff (SIGNATURE): a Split splits every enemy within 4 m at once, breaks their armor 6 s, Fault Claws ready; once every 20 s',()=>{
  const L=dlab(S(['sr_13_2','sr_1_1']),{foes:5,big:true}), {v,F}=L; at(L,F[1],4.5,2*V.bodyR(F[0])+3.0); at(L,F[3],-8,0); at(L,F[4],4.5,-(2*V.bodyR(F[0])+4.5)); assert.ok(gapM(F[0],F[4])>4.2);
  V.cast(v,'green',F[0]); setUst(L,F[0],'seam',4); v.greenCd=6; const h=F.map(f=>f.hp); auto(L,F[0]);
  near(h[1]-F[1].hp,atkNow(L)*4,'F1 (3 m away) Splits at once, with no Seam',1e-6); near(F[1]._shredT,6,'its armor broken for 6 s',1e-9); assert.ok(mark(L,F[1],'fc')); near(v.greenCd,0,'Fault Claws ready');
  near(h[3]-F[3].hp,0,'not F3, far away'); near(h[4]-F[4].hp,0,'not F4 (4.5 m away)'); near(h[2]-F[2].hp,0,'');
  secs(19.3); v.greenCd=6; setUst(L,F[0],'seam',4); const g=F[1].hp; auto(L,F[0]); near(g-F[1].hp,0,'(19.3 s: not yet)'); near(v.greenCd,6,'');
  secs(0.8); setUst(L,F[0],'seam',4); const g2=F[1].hp; auto(L,F[0]); assert.ok(F[1].hp<g2,'20 s later again');
});

test('Deepcleft / Untouched Stone, Overburden, Split Rock and Cliff Sense, Iron in the Claw, Nine Feet Down, Bare Rock (up to 5%), Grind, Tooth and Claw',()=>{
  const L=dlab(S(['sr_n1','sr_7_4','sr_3_3','um_3_4','sr_12_3','nd_12_3','sr_6_2','sr_11_3','nd_5_4','sr_1_1']),{foes:4,big:true}), {v,F}=L;
  for(const f of F) f.armorRating=0; near(ratio(L,F[0]),1.10,'Untouched Stone: 2% x 5 above 75% HP'); F[0].hp=F[0].maxHp*0.7; near(ratio(L,F[0]),1,'not below');
  F[1].armorRating=(v.armorRating||0)+1; F[1].hp=F[1].maxHp*0.5; near(ratio(L,F[1]),1.10,'Overburden: more armor than him'); F[1].armorRating=0; near(ratio(L,F[1]),1,'');
  const f=F[2]; f.armorRating=300; f.hp=f.maxHp*0.5; v.armorRating=1e6; const x=v._wpnArmIgn, a=dm(v,f,'phys'); v._wpnArmIgn=0.10; const b1=dm(v,f,'phys'); v._wpnArmIgn=0.075; const b2=dm(v,f,'phys'); v._wpnArmIgn=x;
  near(ratio(L,f,{kind:'phys'}),(b1/a)*(b2/a),'Split Rock 2% x 5 and Cliff Sense 1.5% x 5 of its armor ignored');
  near(FX.cd(v,'green',6),5,'Iron in the Claw: 0.5 x 2 s'); near(FX.cd(v,'blue',10),9,'Nine Feet Down: 0.5 x 2 s');
  const c0=v.glyphCrit||0; V.cast(v,'green',F[0]); V.step(1); assert.equal(v.target,F[0]); near((v.glyphCrit||0)-c0,0.05,'Bare Rock: 1% x 5 critical chance against his broken target',1e-9);
  F[0].hp=0; F[0].alive=false; V.step(1); near((v.glyphCrit||0)-c0,0,'not against another');
  const g=F[1], r0=g.armorRating=400; for(let i=0;i<3;i++) auto(L,g); V.step(1); near(g.armorRating,r0*(1-0.02*3),'Grind: 0.4% x 5 lower armor per basic attack'); for(let i=0;i<12;i++) auto(L,g); V.step(1); near(g.armorRating,r0*0.80,'up to 10');
  secs(5.1); near(g.armorRating,r0,'5 s');
  near(ratio(L,g,{auto:true}),1.10,'Tooth and Claw: his basic attacks 2% x 5');
});

/* ============================== NINE DAYS UNDER ============================== */
test('Deepcleft / Weight: Slab Across the Back, Held Harder, Bear the Slab, Stone Patience, Heavy Hands, Weight in the Walls (LINK, with Groundswell)',()=>{
  const L=dlab(S(['nd_1_1','nd_2_1','nd_5_1','nd_4_1','nd_12_2','nd_n1','um_1_1']),{foes:4,big:true}), {v,F}=L; const a0=v.dmg;
  ccOn(F[0],v,'stunned',2); V.step(1); assert.equal(stack(L,'wt'),3,'Held Harder: 1 x 3 Weight as a control lands'); secs(1.0); assert.equal(stack(L,'wt'),5,'Slab: 1 Weight each 0.5 s stunned');
  v.stunned=0; V.step(1); const w=stack(L,'wt'); secs(1); assert.equal(stack(L,'wt'),w,'it stays');
  setStack(L,'wt',12); near(inRatio(L,{src:F[2]}),(1-0.02*12)*0.98,'0.4% x 5 less per Weight; Weight in the Walls 2% at 6 or more');
  near(L.T.st.wt.max,18,'Bear the Slab: up to 18'); setStack(L,'wt',18); near(inRatio(L,{src:F[2]}),0.75*0.98,'Weight\'s own share at most 25%');
  V.step(1); near(v.dmg,a0*(1+0.015*18),'Stone Patience: 0.3% x 5 attack per Weight'); near(ratio(L,F[0]),1.10,'Heavy Hands: 12 or more, his hits 2% x 5'); setStack(L,'wt',11); near(ratio(L,F[0]),1,'not at 11');
  setStack(L,'wt',12); setStack(L,'trem',0); for(let i=0;i<20;i++){ V.hit(v,F[0],10,{kind:'true'}); setStack(L,'wt',12); }
  const t=stack(L,'trem'); assert.ok(t>=20+6&&t<=20+18,'Weight in the Walls: a 5% chance per Weight (60%) of 1 more Tremor: '+t);
  const L2=dlab(S(['nd_n1']),{foes:4,big:true}); setStack(L2,'wt',6); near(inRatio(L2,{src:L2.F[2]}),0.98,'(Weight in the Walls on its own)'); setStack(L2,'wt',5); near(inRatio(L2,{src:L2.F[2]}),1,'');
});

test('Deepcleft / the emerge spends all Weight and strikes 3% harder for each; Burrow Deeper, Pressure Cracks, Through the Floor, Loose Gravel (up to 10%)',()=>{
  const L=dlab(S(['nd_1_1','nd_3_2','nd_6_1','nd_9_2','nd_11_2']),{foes:4,big:true}), {v,F}=L; at(L,F[1],4.5+2*V.bodyR(F[0])+1.0,0); free(F[0]); free(F[1]);
  setStack(L,'ews',10); near(skillRatio(L,F[2],BGs),(1+0.30)*1.15,'10 Weight: 30% harder; Burrow Deeper 3% x 5'); setStack(L,'ews',0); near(skillRatio(L,F[2],BGs),1.15,'');
  setStack(L,'wt',10); v.hp=v.maxHp*0.5; const h0=v.hp, f1=F[1].hp; emerge(L); assert.equal(stack(L,'wt'),0,'all spent'); assert.equal(stack(L,'ews'),10);
  assert.ok(F[0].stunned>0.75&&F[0].stunned<=0.9+1e-9,'Pressure Cracks: 8 or more spent, its target stunned 0.3 x 3 s: '+F[0].stunned);
  near(f1-F[1].hp,L.T.s.emA*0.30,'Through the Floor: an enemy within 2 m of it takes 6% x 5 of the strike',1e-6); near(v.hp-h0,v.maxHp*0.10,'Loose Gravel: 0.2% x 5 per Weight spent',1e-6);
  F[0].stunned=0; secs(1); setStack(L,'wt',12); const h1=v.hp; emerge(L); near(v.hp-h1,v.maxHp*0.10,'up to 10%',1e-6);
  F[0].stunned=0; secs(1); setStack(L,'wt',7); emerge(L); near(F[0].stunned,0,'7 spent: no stun');
});

test('Deepcleft / Tallies: Count the Days, Scratch Marks, Raw Claws, Under Pressure, Nine Days, The Seam\'s Name',()=>{
  const L=dlab(S(['nd_1_4','nd_2_4','nd_6_4','nd_8_3','nd_4_3','nd_12_1']),{foes:4}), {v,F}=L;
  assert.equal(stack(L,'tally'),3,'The Seam\'s Name: each wave starts with 1 x 3 Tallies'); setStack(L,'tally',0); L.T.s.tl=0; L.T.s.tn=0; L.T.s.hp0=v.hp; V.step(1); const a0=v.dmg, l0=v.lifestealStat||0, r0=v.armorRating;
  V.dmg(v,v.maxHp*0.101); V.step(1); assert.equal(stack(L,'tally'),1,'each 10% of his max HP lost: a Tally'); v.hp=v.maxHp; V.step(1); V.dmg(v,v.maxHp*0.25); V.step(1); assert.equal(stack(L,'tally'),3,'in total this fight (healing does not take one back)');
  near(v.lifestealStat-l0,0.009*3,'Scratch Marks: 0.3% x 3 lifesteal each',1e-9); near(v.dmg,a0*(1+0.01*3),'Raw Claws: 0.5% x 2 attack each'); near(v.armorRating,r0*(1+0.015*3),'Under Pressure: 0.3% x 5 armor each');
  setStack(L,'tally',9); v._digStk=4; v.hasteT=0; V.hit(F[0],v,10,{kind:'true'}); near(v.hasteMul,1+0.035*(v.passMul||1)*5*(1+0.06*9),'Count the Days: Relentless Digger 2% x 3 stronger per Tally',1e-9);
  v.hp=v.maxHp*0.5; clk(L,'nd_4_3'); const h=v.hp; secs(2.95); near(v.hp-h,0,'Nine Days: not before 3 s'); secs(0.1); near(v.hp-h,v.maxHp*0.03,'every 3 s, 1% x 3 at 9 Tallies',1e-6);
  setStack(L,'tally',8); clk(L,'nd_4_3'); const h2=v.hp; secs(3.1); near(v.hp-h2,0,'not at 8');
});

test('Deepcleft / Relentless Digger: Faster in the Dark, River in the Rock, Never Still, Relentless Pace; Ninth Level',()=>{
  const L=dlab(S(['nd_3_1','nd_12_4','nd_10_4','nd_7_4','nd_7_2','nd_1_1']),{foes:4,big:true}), {v,F}=L; const pm=v.passMul||1;
  v._digStk=0; setStack(L,'wt',6); V.hit(F[1],v,10,{kind:'true'}); near(v._digStk,2,'Faster in the Dark: at 6 Weight twice as fast'); near(v.hasteMul,1+0.035*pm*2*1.15,'Never Still: 3% x 5 stronger',1e-9); near(v.hasteT,6,'Relentless Pace: 4 + 0.4 x 5 s',1e-9);
  setStack(L,'wt',5); V.hit(F[1],v,10,{kind:'true'}); near(v._digStk,3,'at 5: once');
  v.hp=v.maxHp*0.25; V.hit(F[1],v,10,{kind:'true'}); near(v._digStk,4.3,'River in the Rock: below 30% HP 10% x 3 faster',1e-9); v.hp=v.maxHp;
  secs(5.9); assert.ok(v.hasteMul>1,'5.9 s: still'); secs(0.2); near(v.hasteMul,1,'then over');
  setStack(L,'wt',0); v._digStk=0; free(F[0]); V.cast(v,'ult',F[0]); assert.ok(F[0].stunned>1); assert.equal(stack(L,'wt'),2,'Ninth Level: each enemy Quarry Collapse stuns, 2 Weight'); near(v._digStk,1,'and a Relentless Digger stack');
});

test('Deepcleft / his damage reduction, one capped group: Badger Hide, Buried Alive, Rock Dust, Hurt Him, Heavy Back, Dense Bones, Grit in the Teeth, Dust Choke, Heavy Footing (at most 40%)',()=>{
  const L=dlab(S(['nd_1_2','nd_9_3','nd_3_3','nd_4_4','nd_7_3','um_1_3','sr_4_3','um_6_1','um_8_3','sr_1_1']),{foes:4,allies:1}), {v,F,A}=L; free(A[0]);
  v.maxHp=v.hp=1e5; v._digStk=10; V.step(1); assert.equal(stack(L,'shored'),1,'(A0 is Shored)'); const base=0.925*0.94; const inR0=inRatio; inRatio=(L,o,amt)=>{ setStack(L,'trem',0); return inR0(L,o,amt); };
  near(inRatio(L,{src:F[2],auto:true}),base,'Heavy Footing 1.5% x 5 (an ally Shored), Hurt Him 0.2% x 3 per Digger stack (10)');
  near(inRatio(L,{src:F[2]}),base*0.925,'Rock Dust: an ability 1.5% x 5');
  ccOn(F[0],v,'stunned',1); V.step(1); assert.ok(mark(L,F[0],'ctl'),'F0 stunned him'); near(inRatio(L,{src:F[2],auto:true}),base*0.90,'Buried Alive: while controlled 2% x 5');
  v.stunned=0; V.step(1); near(inRatio(L,{src:F[0],auto:true}),base*0.925,'Badger Hide: from an enemy that stunned him this fight 1.5% x 5');
  v.hp=v.maxHp*0.45; near(inRatio(L,{src:F[2],auto:true}),base*0.90,'Heavy Back: below 50% HP 2% x 5'); v.hp=v.maxHp;
  near(inRatio(L,{src:F[2],auto:true},v.maxHp*0.11),base*0.85,'Dense Bones: a hit of more than 10% of his max HP 3% x 5'); v.hp=v.maxHp;
  setMk(L,F[1],'fc'); near(inRatio(L,{src:F[1],auto:true}),base*0.94,'Grit in the Teeth: from an enemy whose armor he broke 2% x 3');
  setStack(L,'trem',25); near(inR0(L,{src:F[2],auto:true}),base*0.94,'Dust Choke: 1% x 3 per 10 Tremor'); inRatio=inR0;
  v.hp=v.maxHp*0.45; ccOn(F[0],v,'stunned',1); V.step(1); setMk(L,F[0],'fc'); setStack(L,'trem',30);
  near(inRatio(L,{src:F[0]},v.maxHp*0.11),0.60,'all at once: never more than 40%');
});

test('Deepcleft / control on him: Hard Ground, Load-Bearing, River Not Held (at most 50%); Heaviest Hold, Come Up Swinging (PICK ONE), Up Under Them, Collect the Debt, Nobody Left',()=>{
  const L=dlab(S(['um_3_3','um_12_4','nd_9_4','nd_8_1','nd_5_2','nd_6_2','nd_10_3','nd_11_1','nd_1_1','um_1_4']),{foes:4,allies:3,big:true}), {v,F,A}=L;
  for(const a of A) free(a); at(L,A[0],-4.5,0); at(L,A[1],0,-4.5); at(L,A[2],-3.5,-3.5); V.step(1); assert.equal(stack(L,'shored'),3,'(3 allies Shored)');
  ccOn(F[1],v,'stunned',2); near(v.stunned,2*V.ccNerf*0.80*0.85,'Hard Ground 4% x 5 and Load-Bearing 5% x 3 shorter',1e-9); v.stunned=0; V.step(1); clk(L,'nd_5_2');
  setStack(L,'tally',9); setStack(L,'wt',0); L.T.s.wacc=0; ccOn(F[0],v,'stunned',2); near(v.stunned,2*V.ccNerf*0.5,'River Not Held: at 9 Tallies half; all together at most 50%',1e-9);
  V.step(1); assert.equal(stack(L,'wt'),1,'(the half it cut still counts as Weight)'); assert.ok(mark(L,F[0],'ctl')&&mark(L,F[0],'lc'),'F0 controlled him');
  v.hp=v.maxHp*0.5; const h0=v.hp; secs(0.75); assert.ok(!(v.stunned>0)); near(v.hp-h0,v.maxHp*0.05,'Heaviest Hold: 1% x 5 as it ends',1e-6);
  assert.ok(v._bgT>0&&win(L,'cus'),'Come Up Swinging: Burrow Guard fires at once'); near(skillRatio(L,F[0],BGs),1.20*1.15,'Up Under Them 4% x 5, Collect the Debt 5% x 3 on the last enemy that controlled him');
  near(skillRatio(L,F[1],BGs),1.20,'(F1 did not)'); secs(1.5); assert.ok(!win(L,'cus'),'it came up');
  const tF=L.T.s.w.cus.at; secs(tF+9.5-V.now()); v.stunned=0.1; secs(0.2); assert.ok(!(v._bgT>0),'9.6 s later: not yet (once every 10 s)'); secs(tF+10.05-V.now()); v.stunned=0.05; secs(0.15); assert.ok(v._bgT>0,'10 s later again');
  setStack(L,'wt',0); setStack(L,'tally',0); kill(L,F[0]); assert.equal(stack(L,'wt'),4,'Nobody Left: an enemy that controlled him dies: 4 Weight'); assert.equal(stack(L,'tally'),1,'and a Tally');
  kill(L,F[3]); assert.equal(stack(L,'wt'),4,'not another enemy');
});

test('Deepcleft / Stay Down (PICK ONE): 1 s longer under, 1% of his max HP a second while under; the slot keeps its own 1.4 s',()=>{
  const L=dlab(S(['nd_5_3']),{foes:4,big:true}), {v}=L; v.hp=v.maxHp*0.5; V.cast(v,'blue'); near(v._bgT,2.4,'2.4 s under',1e-9); near(v.drT,1.4,'the slot 1.4 s',1e-9);
  const h=v.hp; secs(2.05); near(v.hp-h,v.maxHp*0.02,'2 s under: 2%',1e-6); secs(0.4); assert.ok(!(v._bgT>0)); const h2=v.hp; secs(1); near(v.hp-h2,0,'not after');
});

test('Deepcleft / Up Through the Floor (SIGNATURE): below 25% HP he goes under with 12 Weight and 9 Tallies, 16% back, 2 s, then up beneath the enemy that hurt him most; once per fight',()=>{
  const L=dlab(S(['nd_13_2','nd_1_1','nd_1_4']),{foes:4}), {v,F}=L; free(F[1]); free(F[2]);
  for(let i=0;i<3;i++){ hitOn(L,v,v.maxHp*0.1,{src:F[2]}); v.hp=v.maxHp; } v.hp=v.maxHp*0.26; hitOn(L,v,v.maxHp*0.02,{src:F[0]}); const h=v.hp; V.step(1);
  assert.ok(v._bgT>1.9&&v._noTarget,'under at once, for 2 s'); assert.equal(stack(L,'wt'),12,'12 Weight'); assert.equal(stack(L,'tally'),9,'9 Tallies'); near(v.hp-h,v.maxHp*0.16,'16% of his max HP',1e-3);
  const f1=F[1].hp; secs(2.1); assert.ok(!(v._bgT>0)); assert.ok(gapM(v,F[2])<2,'up beneath F2, the enemy that hurt him most');
  assert.ok(F[2].stunned>0.5&&F[1].stunned>0.5&&F[2].stunned<=1&&F[1].stunned<=1,'every enemy within 3 m stunned 1 s'); assert.ok(F[1].hp<f1,'and struck'); assert.ok(F[0].stunned>1e5,'(F0 held)');
  v.hp=v.maxHp*0.26; secs(2); hitOn(L,v,v.maxHp*0.02,{src:F[0]}); V.step(1); assert.ok(!(v._bgT>0),'once per fight');
});

/* ============================== THE UNDERMINE ============================== */
test('Deepcleft / Tremor: Groundswell, Rumble, Long Rumble, Restless Earth, Deep Gutters, Faultfinder',()=>{
  const L=dlab(S(['um_1_1','um_2_1','um_10_1','um_4_1','um_12_1','um_3_1']),{foes:4,big:true}), {v,F}=L;
  for(let i=0;i<5;i++) V.hit(v,F[2],10,{kind:'true'}); for(let i=0;i<5;i++) hitOn(L,v,10,{src:F[2]}); assert.equal(stack(L,'trem'),10,'each hit he deals or takes: 1 Tremor');
  for(let i=0;i<40;i++) hitOn(L,v,10,{src:F[2]}); assert.equal(stack(L,'trem'),40,'Long Rumble: up to 30 + 2 x 5');
  free(F[0]); V.cast(v,'green',F[0]); near(F[0].stunned,0.5,'Faultfinder: at 30 Tremor Fault Claws stuns 0.5 s',1e-9); F[0].stunned=0; delete F[0]._talM[v.uid].lk;
  free(F[1]); at(L,F[1],4.5,4.6); const h1=F[1].hp; V.cast(v,'ult',F[0]); assert.equal(stack(L,'qcs'),40,'Quarry Collapse spends all 40'); assert.equal(stack(L,'trem'),2,'(then its own two hits add 2)');
  near(F[0].stunned,2*V.ccNerf+0.1*3*4,'Rumble: 0.1 x 3 s longer for every 10 Tremor, in full',1e-9); assert.ok(F[1].hp<h1,'Deep Gutters: 4% x 3 wider (F1, 4.6 m from its target)');
  setStack(L,'qcs',40); near(skillRatio(L,F[2],QCs),1.40,'Groundswell: 0.2% x 5 more per Tremor spent');
  setStack(L,'trem',25); V.wave(); V.step(1); assert.equal(stack(L,'trem'),10,'Restless Earth: the ground keeps 2 x 5 between waves');
  const L2=dlab(S(['um_1_1']),{foes:4,big:true}); setStack(L2,'trem',25); V.wave(); V.step(1); assert.equal(stack(L2,'trem'),0,'(without it the ground empties)');
  plain({foes:4,big:true},P=>{ free(P.F[0]); free(P.F[1]); at(P,P.F[1],4.5,4.6); const g=P.F[1].hp; V.cast(P.v,'ult',P.F[0]); near(g-P.F[1].hp,0,'(untalented: 4.6 m is out of it)'); });
});

test('Deepcleft / Shoring: Pit Props, Brace Beams, Brace the Roof, Close Quarters, Hold Fast, Pillar, Sett Mother, Timbering',()=>{
  const L=dlab(S(['um_1_4','um_5_4','um_2_4','um_4_3','um_6_4','um_10_4','um_12_3','um_7_4']),{foes:4,allies:3,big:true}), {v,F,A}=L; const a0=v.dmg;
  for(const a of A) free(a); at(L,A[1],-(4.5+V.bodyR(v)+V.bodyR(A[1])),0); const d2=(6.6+V.bodyR(v)+V.bodyR(A[2]))/Math.SQRT2; at(L,A[2],-d2,-d2); V.step(2); assert.ok(gapM(v,A[2])>6.2&&!mark(L,A[2],'sh'),'(A2, 6.5 m away, is not)'); assert.ok(gapM(v,A[1])>3&&gapM(v,A[1])<6); assert.equal(stack(L,'shored'),2,'Brace Beams: allies within 3 + 1 x 3 m are Shored');
  assert.ok(mark(L,A[0],'sh')&&mark(L,A[1],'sh')); near(v.dmg,a0/1.025*1.05,'Pillar: 0.5% x 5 attack per Shored ally (A0 was Shored from the start)');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})))*0.955,'Pit Props: 1.5% x 3 less');
  ccOn(F[0],A[0],'stunned',1); near(A[0].stunned,V.ccNerf*0.91,'Brace the Roof: 3% x 3 shorter',1e-9); A[0].stunned=0;
  at(L,F[3],3.6,-5.5); V.step(1); assert.ok(gapM(F[3],A[0])<2); near(ratio(L,F[3]),1.06,'Close Quarters: an enemy within 2 m of a Shored ally, 2% x 3'); near(ratio(L,F[2]),1,'');
  const M=V.METER; A[0].pulledBy={x:A[0].x+8*M,y:A[0].y,alive:true}; A[0].pullStop=0; A[0].pullSpeed=10*M; A[0].pullT=0.5; V.step(1); near(A[0].pullSpeed,10*M*0.5,'Hold Fast: a pull on a Shored ally 25% x 2 weaker',1e-9);
  A[0].pullT=0; A[0].hp=A[0].maxHp*0.5; clk(L,'um_12_3'); const h=A[0].hp; secs(3.05); near(A[0].hp-h,A[0].maxHp*0.01,'Sett Mother: 0.5% x 2 every 3 s',1e-6);
  setStack(L,'trem',0); A[0].hp=A[0].maxHp; A[0].shield=0; hitOn(L,A[0],A[0].maxHp*0.11,{src:F[0]}); V.step(1); assert.equal(stack(L,'trem'),2,'Timbering: a big hit on a Shored ally: 2 Tremor'); near(A[0].shield,v.maxHp*0.025,'and a shield of 0.5% x 5 of his max HP',1e-6);
  A[0].shield=0; hitOn(L,A[0],A[0].maxHp*0.09,{src:F[0]}); V.step(1); near(A[0].shield,0,'not a hit of 9%');
});

test('Deepcleft / Cave Roof Holds: once a wave, a Shored ally dropping below 20% sends him under and up beneath its attacker',()=>{
  const L=dlab(S(['um_9_4','um_1_4']),{foes:4,allies:1,big:true}), {v,F,A}=L; free(A[0]); V.step(1);
  A[0].hp=A[0].maxHp*0.21; hitOn(L,A[0],A[0].maxHp*0.02,{src:F[2]}); V.step(1); assert.ok(v._bgT>0,'Burrow Guard fires'); secs(1.45); assert.ok(gapM(v,F[2])<2,'up beneath F2, the attacker'); v.x=300; v.y=700; secs(0.5); assert.ok(mark(L,A[0],'sh'),'(back beside A0)');
  A[0].hp=A[0].maxHp*0.21; hitOn(L,A[0],A[0].maxHp*0.02,{src:F[2]}); V.step(1); assert.ok(!(v._bgT>0),'once a wave');
});

test('Deepcleft / Undermined: Undercut, Loose Footing, Sinking Ground, Fault Echo, Swallowed, Undermine Them All, Deep Charges',()=>{
  const L=dlab(S(['um_2_2','um_9_2','um_4_2','um_11_1','um_10_2','um_12_2','um_11_2']),{foes:4,allies:1,big:true}), {v,F,A}=L; F[0].speed=100; const i0=F[0].atkInterval, v0=v.atkInterval;
  emerge(L); const t0=V.now(); assert.ok(mark(L,F[0],'um'),'the enemy the emerge strikes is Undermined'); V.step(1); near(F[0].speed,90,'Undercut: 2% x 5 slower'); near(F[0].atkInterval,i0/0.90,'and attacks');
  near(v.atkInterval,v0/1.05,'Undermine Them All: 1% x 5 attack speed per Undermined enemy');
  near(ratio(L,F[0]),1.09,'Sinking Ground: 3% x 3 more from him'); near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.09,'and his team');
  near(skillRatio(L,F[0],FCs),1.09*1.15,'Fault Echo: Fault Claws 3% x 5');
  F[0].hp=F[0].maxHp*0.5; const g=-lost(F[0],()=>V.heal(F[0],1000)), g0=plainHit(L,()=>-lost(F[0],()=>V.heal(F[0],1000))); near(g,g0*0.85,'Swallowed: 5% x 3 less healing');
  secs(t0+5.4-V.now()); assert.ok(mark(L,F[0],'um'),'Loose Footing: 4 + 0.3 x 5 s'); secs(0.2); assert.ok(!mark(L,F[0],'um'),'then over'); V.step(1); near(F[0].speed,100,'');
  setMk(L,F[2],'um',99); setStack(L,'trem',9); const f2=F[2].hp; emerge(L); near(f2-F[2].hp,L.T.s.emA*0.30,'Deep Charges: 10 Tremor (the strike gave the tenth), every Undermined enemy 30% of it',1e-6);
  setStack(L,'trem',8); const f3=F[2].hp; emerge(L); near(f3-F[2].hp,0,'9 Tremor: no');
});

test('Deepcleft / Bring Down the Wall, Second Shake; Collapse Beneath (PICK ONE) and Open Pit',()=>{
  { const L=dlab(S(['um_7_2','um_8_1']),{foes:4,big:true}), {v,F}=L; free(F[0]); free(F[1]); at(L,F[1],4.5,3.6); setMk(L,F[1],'um',99); delete F[1]._talM[v.uid].um; setMk(L,F[1],'um',99);
    V.cast(v,'ult',F[0]); near(F[0].stunned,1.4,'(F0 was not Undermined)',1e-9); near(F[1].stunned,1.4+0.5,'Bring Down the Wall: 0.5 s longer on an enemy already Undermined',1e-9);
    assert.ok(mark(L,F[0],'um'),'every enemy it hits is Undermined'); const raw=L.T.s.qcRaw; assert.ok(raw>0);
    const h=F[0].hp; secs(1.35); near(h-F[0].hp,0,'Second Shake: not yet'); secs(0.15); near(h-F[0].hp,raw*0.25*dm(v,F[0],'phys'),'when its stun ends: 5% x 5 of its damage',1e-6); }
  const L=dlab(S(['um_5_2','um_6_2','um_1_1']),{foes:4,big:true}), {v,F}=L; free(F[0]); at(L,F[1],4.5+2*V.bodyR(F[0])+1.0,0); setStack(L,'trem',0);
  emerge(L); assert.ok(F[0].stunned>0.45&&F[0].stunned<=0.6+1e-9,'Collapse Beneath: knocked up (stunned) 0.6 s: '+F[0].stunned); assert.equal(stack(L,'trem'),11,'10 Tremor (and the strike\'s own)');
  const h=F.map(f=>f.hp); secs(0.65); const a=atkNow(L)*0.40; near(h[0]-F[0].hp,a,'Open Pit: it lands, every enemy within 2 m takes 8% x 5 of his attack',1e-6); near(h[1]-F[1].hp,a,'F1 too',1e-6); near(h[2]-F[2].hp,0,'not F2');
});

test('Deepcleft / Pop Up Behind (PICK ONE) and Back Row Digger; Granite Hide',()=>{
  const L=dlab(S(['um_5_3','um_6_3','um_9_3']),{foes:4,big:true}), {v,F}=L; F[2].hp=F[2].maxHp*0.5; const r0=v.armorRating;
  emerge(L); assert.ok(gapM(v,F[2])<2,'Pop Up Behind: up beneath the weakest enemy (no enemy in the back row: the lowest HP)'); V.step(1); near(v.armorRating,r0*1.20,'Granite Hide: 4% x 5 armor for 3 s after');
  for(let i=0;i<3;i++) near(ratio(L,F[2]),1.12,'Back Row Digger: his next 3 hits 4% x 3 ('+(i+1)+')'); near(ratio(L,F[2]),1,'the fourth');
  secs(3); near(v.armorRating,r0,'3 s');
  plain({foes:4,big:true},P=>{ P.F[2].hp=P.F[2].maxHp*0.5; V.cast(P.v,'blue'); secs(1.45); assert.ok(gapM(P.v,P.F[0])<2,'(untalented: beneath the nearest)'); });
});

test('Deepcleft / The Floor Gives Way (SIGNATURE): 30 Tremor spent, every enemy Undermined 6 s, stunned again 0.5 s every 2 s (at most twice, never while stunned), Shored allies 20% less; once every 25 s',()=>{
  const L=dlab(S(['um_13_2','um_1_4']),{foes:4,allies:1,big:true}), {v,F,A}=L; free(A[0]); for(const f of F) free(f); F[2].stunned=9; V.step(1);
  const tc=V.now(); setStack(L,'trem',30); V.cast(v,'ult',F[0]); assert.ok(win(L,'fgw')); for(const f of F) assert.ok(mark(L,f,'um'),'the whole formation Undermined');
  near(lost(A[0],()=>V.hit(F[1],A[0],1000,{kind:'true'})),plainHit(L,()=>lost(A[0],()=>V.hit(F[1],A[0],1000,{kind:'true'})))*0.8*0.955,'a Shored ally takes 20% less (and Pit Props)');
  const st=F.map(()=>0), was=F.map(f=>(f.stunned||0)>0); for(let i=0;i<Math.round(7/V.STEP);i++){ V.step(1); F.forEach((f,j)=>{ const on=(f.stunned||0)>0; if(on&&!was[j]) st[j]++; was[j]=on; }); }
  assert.equal(st[3],2,'F3: stunned again twice (2 s and 4 s), not a third time'); assert.equal(st[0],2,'F0: its Quarry stun, then once more (each re-stun waits 0.5 s past a stun of his)');
  F[2].stunned=0; setStack(L,'trem',30); V.cast(v,'ult',F[0]); assert.ok(!win(L,'fgw'),'once every 25 s');
  secs(tc+24.5-V.now()); for(const f of F) free(f); setStack(L,'trem',30); V.cast(v,'ult',F[0]); assert.ok(!win(L,'fgw'),'(24.5 s: not yet)');
  secs(0.7); for(const f of F) free(f); setStack(L,'trem',30); V.cast(v,'ult',F[0]); assert.ok(win(L,'fgw'),'25 s later again');
  L.T.s.w.fgw.t=99; for(const f of F) setMk(L,f,'um',99); const st2=F.map(()=>0), w2=F.map(f=>(f.stunned||0)>0); for(let i=0;i<Math.round(9/V.STEP);i++){ V.step(1); F.forEach((f,j)=>{ const on=(f.stunned||0)>0; if(on&&!w2[j]) st2[j]++; w2[j]=on; }); }
  assert.equal(st2[3],2,'(held open for 9 s: still at most twice)');
});

test('Deepcleft / the break rule: his talent stuns never land on an enemy that is stunned, nor within 0.5 s after a stun of his ends',()=>{
  const L=dlab(S(['um_3_1']),{foes:4,big:true}), {v,F}=L; free(F[0]); setStack(L,'trem',30);
  F[0].stunned=0.3; V.cast(v,'green',F[0]); near(F[0].stunned,0.3,'stunned: no'); secs(0.4); assert.ok(!(F[0].stunned>0));
  V.cast(v,'green',F[0]); near(F[0].stunned,0.5,'free: yes',1e-9); secs(0.6); assert.ok(!(F[0].stunned>0)); V.cast(v,'green',F[0]); assert.ok(!(F[0].stunned>0),'0.1 s after his stun ended: no');
  secs(0.45); V.cast(v,'green',F[0]); near(F[0].stunned,0.5,'0.55 s after: yes',1e-9);
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Deepcleft: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['sr_1_1','sr_3_1','sr_2_1','nd_1_1','nd_1_4','um_1_1','um_1_4','um_2_2','sr_1_4','nd_1_2']), TEAM=['vael','sylthaine','vireo','vex','deepcleft'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let seam=0,um=false,lw=false,sh=0,split=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); sh=Math.max(sh,(T0.sh||[]).length);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o['#seam']&&o['#seam'].until>V.now()) seam=Math.max(seam,o['#seam'].v); if(o.um&&o.um.until>V.now()) um=true; if(o.lw) lw=true; } }
  for(const k in s._tal.s.lim) if(/^#12$/.test(k)) split=s._tal.s.lim[k].n;
  console.log('  live fight: max '+JSON.stringify(mx)+', Seams '+seam+', Splits '+split+', Undermined '+um+', Lying Wall '+lw+', Shored '+sh);
  assert.ok(seam>=2,'real Seams: '+seam); assert.ok(split>=1,'a real Split'); assert.ok(mx.tally>=1||(s._tal.s.tl||0)<0.1*s.maxHp,'real Tallies (lost '+Math.round(s._tal.s.tl||0)+' of '+Math.round(s.maxHp)+')'); assert.ok(mx.trem>=5,'real Tremor'); assert.ok(um,'a real emerge Undermined'); assert.ok(lw,'a real Lying Wall'); assert.ok(sh>=1,'real Shoring');
  determinism(H,TEAM);
});

/* The page sites his talents added (Relentless Digger's pass, the emerge's target and its strike): with nothing learned, whole seeded fights with Deepcleft in
   the line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters are also the base-skill measure of the report. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Deepcleft: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['deepcleft','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __dcN={fc:0,fcHit:0,bg:0,emerge:0,qc:0,qcHit:0,qcStun:0,dig:0,hitOn:0}; var __dcD=_doEffectCore, __dcH=dealDamage, __dcC=ccApply, __dcG=damage, __dcQ=null;'+
    '_doEffectCore=function(u,type,o){ const me=u&&u.key==="deepcleft"&&(!o||!o.deliver||o._arrived); if(me){ if(type==="shred") __dcN.fc++; if(type==="burrowguard") __dcN.bg++; if(type==="aoeStun"){ __dcN.qc++; __dcQ=u; } } try{ return __dcD.apply(this,arguments); } finally{ if(me&&type==="aoeStun") __dcQ=null; } };'+
    'dealDamage=function(s,t,a,c){ if(s&&s.key==="deepcleft"){ if(c==="#c9a227") __dcN.emerge++; if(c==="#e0a83a") __dcN.fcHit++; if(c==="#6ea8ff"&&__dcQ===s) __dcN.qcHit++; } if(t&&t.key==="deepcleft"&&s&&s.team!==t.team) __dcN.hitOn++; return __dcH.apply(this,arguments); };'+
    'ccApply=function(u,t,f,d){ const r=__dcC.apply(this,arguments); if(r&&__dcQ&&u===__dcQ&&f==="stunned") __dcN.qcStun++; return r; };'+
    'damage=function(u,a){ if(u&&u.key==="deepcleft"&&u.pass&&u.pass.digger) __dcN.dig++; return __dcG.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__dcN'); console.log('  identity / base skills: '+JSON.stringify(c)+' (Fault Claws hits per cast '+(c.fcHit/Math.max(1,c.fc)).toFixed(2)+', emerges per Burrow Guard '+(c.emerge/Math.max(1,c.bg)).toFixed(2)+', enemies hit per Quarry Collapse '+(c.qcHit/Math.max(1,c.qc)).toFixed(2)+', stunned '+(c.qcStun/Math.max(1,c.qc)).toFixed(2)+')');
    assert.ok(c.fc>0&&c.fcHit>0&&c.bg>0&&c.emerge>0&&c.qc>0&&c.qcHit>0&&c.dig>0,'the fights cast Fault Claws, Burrow Guard (and came up), Quarry Collapse, and wound up Relentless Digger: every new site was run'); }
  finally{ VMX('_doEffectCore=__dcD; dealDamage=__dcH; ccApply=__dcC; damage=__dcG;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ sr:['sr_4_3','sr_2_3','sr_6_4','sr_10_2'],
            nd:['nd_1_1','nd_n1','nd_1_2','nd_2_3','nd_3_3','nd_4_4','nd_7_3','nd_9_3','nd_8_3','nd_11_4','nd_5_1','nd_2_1','nd_9_4','nd_5_3'],
            um:['um_1_3','um_6_1','um_8_3','um_9_3','um_11_3','um_1_4','um_10_1','um_3_3','um_13_2'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sr:0,nd:1,um:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (Weight full, controlled, the attacker stunned him and is under his break,
   below 50% HP, 10 Digger stacks, 40 Tremor, an ally Shored, Granite Hide's window, a big hit, an ability); worst = sustained=false. sustained: a usual state
   (6 Weight, 10 Digger stacks, 20 Tremor, an ally Shored, above half HP, not controlled, an attacker he has not met, a basic attack of 5% of his max HP).
   Measured through the engine: what reaches his HP and shield against the hit. Burrow Guard: no hit reaches him under (he is untargetable) */
function worstHit(list,kind,crit,sustained){ const L=lab(H,list,{foes:5,allies:1,cold:true}), {v,F,A}=L; v.stunned=0; free(A[0]); V.step(1); const f=F[0];
  v.maxHp=1e5; v.hp=sustained?8e4:3.5e4; v._digStk=10;
  if(L.T){ const s=L.T.s; setStack(L,'wt',L.T.st.wt.max||12); setStack(L,'trem',L.T.st.trem.max||30); setStack(L,'tally',9);
    if(!sustained){ s.ctld=true; v.stunned=0; setMk(L,f,'ctl'); setMk(L,f,'fc'); s.w.gh={t:99,n:1,cdT:0,at:-1,wave:false}; s.cv={stunned:5}; }
    else { setStack(L,'wt',6); setStack(L,'trem',20); } }
  if(!sustained){ v.stunned=5; } V.step(1); if(L.T&&!sustained) L.T.s.ctld=true;
  v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6;
  const raw=sustained?5e3:1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:!!sustained})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Deepcleft: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) for long in a seeded fight',()=>{
  const cands=[[['nd','um'],[61,30]],[['nd'],[91]],[['um','nd'],[61,30]],[['nd','sr'],[61,30]],[['um'],[91]],[['nd','um','sr'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,under:0,imm:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="deepcleft"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="deepcleft"&&u.alive){ __dr.ticks++; if(u._noTarget) __dr.under++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','deepcleft'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+' ('+(100*d.hi/Math.max(1,d.n)).toFixed(1)+'% of hits), at the ceiling '+d.at+', under Burrow Guard (no hit reaches him) '+d.under+' of '+d.ticks+' ticks ('+(100*d.under/Math.max(1,d.ticks)).toFixed(1)+'%), immune '+d.imm);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0);
    assert.ok(d.under<0.5*d.ticks,'under (untargetable) for less than half of the fight'); assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
