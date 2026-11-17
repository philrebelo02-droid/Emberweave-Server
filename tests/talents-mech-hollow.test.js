'use strict';
/* Hollow's talents as data on the mechanics layer (talents-mech/hollow.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   hl(): the lab with Hollow ON the field (his entrance cleared: no waiting above, no fall), held. fl(): the same, but he thinks (his passive's clock runs,
   Vanishing Point lands) while he is rooted, not attacking, nothing ready.
   FAN OF KNIVES: the game's Fan measures its 3 m from his CENTRE and reaches nobody in real fights (0 of 68 casts, tests/hollow-kit-facts.js); a fix for
   v1391 on another branch measures to the enemy's body edge. Every test that casts it puts the enemy 2.9 m from his centre RIGHT BEFORE the cast (bodies are
   pushed apart by the next step), a place the Fan reaches both before and after that fix - so these tests are about his talents, not about the Fan's reach.
   Places (metres from Hollow, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6); A0 (0,-5.5). The lab's skill level is 10.
   Run: node --test tests/talents-mech-hollow.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='hollow', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); VMX('if(typeof __hbr!=="undefined"&&__hbr){ brnd=__hbr; __hbr=null; }'); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const ustLeft=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return m?m.until-V.now():0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d||99)}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const dm=(s,t,k)=>VMX('defMul')(s,t,k);
const rage=()=>VMX('rageMul');
const ho=L=>L.T.s.ho||(L.T.s.ho={});
const brnd=x=>VMX('var __hbr=(typeof __hbr!=="undefined"&&__hbr)?__hbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __hbr!=="undefined"&&__hbr){ brnd=__hbr; __hbr=null; }');
/* an enemy that thinks but does nothing (no move, no attack, nothing ready), at level 1 so a control is not resisted */
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };
const onField=v=>{ v._dropHidden=false; v._dropT=0; v._fallT=0; v._fallH=0; v._noTarget=false; };
function hl(list,o){ o=o||{}; const L=lab(H,list,Object.assign({},o,{cold:true})); onField(L.v); L.v.x=300; L.v.y=700; L.F.forEach((f,i)=>{ const P=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6]][i]; if(P) at(L,f,P[0],P[1]); });
  if(o.keys) o.keys.forEach((k,i)=>{ if(k) L.F[i].key=k; }); if(o.pre) o.pre(L); V.step(1); return L; }
function fl(list,o){ const L=hl(list,Object.assign({},o||{},{pre:L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=99; v.blueCd=99; v.energy=0; if(o&&o.pre) o.pre(L); }})); return L; }
const plain=(o,fn)=>fn(fl(null,o));
const hitOn=(L,t,amt,o)=>{ const r=lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{}))); L.v.energy=0; return r; };
const ratio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
function skillRatio(L,t,skill,o){ const s=L.T.s, keep=s.cur; s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))); } finally{ s.cur=keep; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))); }
const inRatio=(L,o,amt)=>{ const v=L.v, h=v.hp; const a=hitOn(L,v,amt||100,o); v.hp=h; const b=plainHit(L,()=>hitOn(L,v,amt||100,o)); v.hp=h; return a/b; };
const auto=(L,t,amt)=>lost(t,()=>V.hit(L.v,t,amt||10,{kind:'true',auto:true}));
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const atkNow=L=>L.v.dmg*((L.v.dmgBuffT>0)?(L.v.dmgBuffMul||1):1)*rage();
const ready=L=>{ L.v._ntReady=true; L.v._ntCd=0; };
const fanAt=(L,t,dx,dy)=>{ at(L,t,dx==null?2.9:dx,dy||0); V.cast(L.v,'green',t); };   // 2.9 m from his centre: a place the Fan reaches before and after the v1391 fix
const lac=(L,t)=>V.cast(L.v,'blue',t);
const myBl=(L,t)=>(t.dots||[]).filter(d=>d._talO===L.v.uid&&d._talK==='bl'&&d.remaining>0);
const isMissed=(L,fn)=>{ const f0=VMX('floatTexts.length'); fn(); const F=VMX('floatTexts'); for(let i=f0;i<F.length;i++) if(F[i]&&F[i].txt==='NOT THERE') return true; return false; };
const BACKK='sylthaine';
const KO=slot=>VMX('skillScaleOpts')(Object.assign({},VMX('KITS.hollow')[slot]),VMX('skillMul')(10),10);   // his kit row as the lab casts it (skill level 10)
const BLK=()=>KO('blue').bleed, RUPK=()=>KO('blue').ruptMul;   // formation depth 3.4: the game's back row

test('Hollow: every talent is accounted for - 7 plain stats, 119 with rows, none waiting',()=>{
  accounting(H,[126,7,119,0,0]);
  const M=FXN.mech(H); for(const id of ['co_1_1','ec_1_1','sb_1_1','co_13_2','ec_13_2','sb_13_2','co_1_3','sb_8_1']) assert.ok(M.talents[id],id);
  for(const id of ['co_6_4','co_n4','ec_2_3','ec_4_3','ec_1_2','sb_1_3','sb_4_1']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['co_1_3','sb_8_1']) assert.ok(!FXN.has(H,id),id+': a crit talent is a row (the 5% crit group), no longer a plain stat');
});

test('Hollow: his real kit, as the talents read it - the entrance, Fan of Knives, Lacerate\'s stacks and rupture, Vanishing Point, The Space He Isn\'t In',()=>{
  { const U=V.arena(snaps([spec(H,100)]),snaps([spec('vael',100)]),3), h=U[0]; assert.ok(h._dropHidden&&h._dropT===5.5,'the entrance: he waits 5.5 s above, off the field'); }
  plain({foes:4},P=>{ const {v,F}=P, sm=VMX('skillMul')(10);
    assert.ok(v.pass&&v.pass.notthere,'his passive is unlocked in the lab');
    const h0=F[0].hp, d0=F[0].dots.length; fanAt(P,F[0]); assert.ok(F[0].hp<h0,'Fan of Knives strikes an enemy 2.9 m from his centre'); assert.equal(F[0].dots.length,d0+1,'and leaves a bleed stack'); assert.equal(F[0]._blStk,1);
    const h1=F[1].hp; at(P,F[1],3.2,0.2); V.cast(v,'green',F[1]); near(h1-F[1].hp,0,'the game\'s Fan does not reach 3.2 m centre to centre (the body-edge fix is v1391, elsewhere)');
    const g=F[2]; lac(P,g); assert.equal(g._blStk,1); const b0=g.dots.length; lac(P,g); assert.equal(g._blStk,2);
    const h2=g.hp; lac(P,g); assert.equal(g._blStk,0,'the third stack ruptures and clears'); assert.equal(g.dots.length,b0+2,'each stack its own bleed');
    const d=g.dots[g.dots.length-1]; near(d.dps,v.dmg*BLK(),'a bleed: 16% of his attack a tick (x the skill level curve)',1e-9); assert.equal(d.remaining,6,'6 ticks');
    const L8=h2-g.hp, k=VMX('elemMul')(v,g)*(v.dmgBonusMul2||1)*dm(v,g,'phys'), hitL=0.8*v.dmg*sm*rage()*k, rup=RUPK()*v.dmg*k; near(L8,hitL+rup,'the third Lacerate: its hit and the rupture (190% of his attack x the skill curve)',1e-6); });
  plain({foes:3,keys:[null,BACKK]},P=>{ const {v,F}=P;
    ready(P); assert.ok(isMissed(P,()=>near(hitOn(P,v,500),0,'the blow while the miss is ready never lands')),'NOT THERE');
    assert.ok(!v._ntReady); near(v._ntCd,VMX('SKLV.notthere')(VMX('passLv')(v)),'it comes ready again 4 s - 0.01 s a level later',1e-9);
    assert.ok(hitOn(P,v,500)>0,'the next blow lands');
    for(const f of F) f.hp=f.maxHp=1e5; const h=F[1].hp; V.cast(v,'ult',F[0]); assert.ok(v._noTarget&&v._vpT>0,'Vanishing Point: he is off the field'); secs(0.95);
    assert.ok(F[1].hp<h||F[0].hp<1e5,'and comes down striking'); assert.ok(!v._noTarget); });
});

/* ============================== THE COMMISSION ============================== */
test('Hollow / the Contract: Terms of Hire (the deepest enemy at the wave start, 2% x 5), Fine Print, Nothing Personal, Open Terms, Withheld Mercy, Night Shift',()=>{
  const L=hl(S(['co_1_1','co_2_1','co_4_1','co_5_3','co_12_1','co_12_4']),{foes:4,allies:1,keys:[null,BACKK]}), {v,F,A}=L;
  assert.ok(mark(L,F[1],'ct'),'the back-row enemy (F1) is his Contract'); assert.ok(!mark(L,F[0],'ct'));
  near(ratio(L,F[1]),1.10*1.10,'Terms of Hire 2% x 5 and Open Terms 10% on it'); near(ratio(L,F[0]),1,'not on others');
  near(ratio(L,F[1],{crit:true}),1.10*1.10*1.20,'Nothing Personal: his crits on it 4% x 5 more');
  const ph=F[1]; ph.armorRating=400; const a=lost(ph,()=>V.hit(v,ph,1000,{kind:'phys'})), b=plainHit(L,()=>lost(ph,()=>V.hit(v,ph,1000,{kind:'phys'})));
  const sv=v._wpnArmIgn; v._wpnArmIgn=0.09; const want=dm(v,ph,'phys'); v._wpnArmIgn=sv; near(a/b,1.21*want/dm(v,ph,'phys'),'Fine Print: 9% of its armor ignored');
  near(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})),1100*VMX('elemMul')(A[0],F[1])*(A[0].dmgBonusMul2||1),'Open Terms: his allies 10% more on it');
  const h=F[1]; h.hp=h.maxHp*0.5; const hp0=h.hp; V.heal(h,1000); near(h.hp-hp0,700,'Withheld Mercy: 30% less healing on it');
  V.step(1); assert.ok(L.T.nrg,'Night Shift is an energy stat'); v.energy=10; V.step(1); const e1=v.energy; v.energy=e1+50; V.step(1); near(v.energy-e1,55,'10% more energy while it lives (50 gained: 55)',0.4/55);
});

test('Hollow / Short Roster, Sealed (the next deepest at once, a guaranteed critical), Reputation (up to 3), Contract Closed (PICK ONE)',()=>{
  { const L=hl(S(['co_1_1','co_n2']),{foes:4,keys:[null,BACKK],pre:L=>L.F.forEach((f,i)=>{ f.maxHp=f.hp=[9e8,8e8,3e8,7e8][i]; })}), {F}=L;
    assert.ok(mark(L,F[2],'ct'),'Short Roster: one back-row enemy: the lowest max HP enemy instead'); }
  { const L=hl(S(['co_1_1','co_n2']),{foes:4,keys:[BACKK,BACKK,BACKK],pre:L=>L.F.forEach((f,i)=>{ f.maxHp=f.hp=[9e8,8e8,3e8,7e8][i]; })}), {F}=L;
    assert.ok(mark(L,F[0],'ct'),'three in the back row: the deepest, as without it'); }
  const L=hl(S(['co_1_1','co_2_1','co_3_1','co_12_2','co_5_2']),{foes:4,big:true,keys:[null,BACKK,null,'astra']}), {v,F}=L;
  assert.ok(mark(L,F[1],'ct')); v.hp=v.maxHp*0.5; const h=v.hp; kill(L,F[1]); V.step(1);
  near(v.hp-h,0.15*v.maxHp,'Contract Closed: he killed his Contract, 15% of his max HP',1e-6); assert.equal(stack(L,'rep'),1,'Reputation: one completed');
  assert.ok(mark(L,F[3],'ct'),'Sealed: the next deepest (F3) is written in at once');
  const r=ratio(L,F[3]); assert.ok(r>1.5,'Sealed: the next hit on it is a critical ('+r.toFixed(3)+')'); near(ratio(L,F[3]),1.10,'only that one');
  kill(L,F[3]); kill(L,F[0]); kill(L,F[2]); V.step(1); assert.equal(stack(L,'rep'),3,'three Contracts');
  const L2=hl(S(['co_12_2']),{foes:5}); const a0=L2.v.dmg; setStack(L2,'rep',3); V.step(1); near(L2.v.dmg/a0,1.15,'Reputation: 1% x 5 attack a Contract (3: 15%)',1e-9);
});

test('Hollow / Blood Owed: an ally\'s killer becomes the Contract, his first strike on it 20% more',()=>{
  const L=hl(S(['co_n3','co_1_1']),{foes:3,allies:1,keys:[null,BACKK]}), {v,F,A}=L; assert.ok(mark(L,F[1],'ct')); V.step(1);
  A[0].hp=A[0].maxHp=100; V.hit(F[2],A[0],1000,{kind:'true'}); assert.ok(!A[0].alive); V.step(1);
  assert.ok(mark(L,F[2],'ct'),'the killer is his Contract'); assert.ok(!mark(L,F[1],'ct'));
  near(ratio(L,F[2]),1.10*1.20,'his first strike on it 20% more'); near(ratio(L,F[2]),1.10,'then as any Contract');
});

test('Hollow / Dusk: Waiting Above, Darker Sky, Moonless, Settling Dark (up to 10%), Second Descent; Shadow Weight in the crit group',()=>{
  const L=hl(S(['co_1_4','co_3_4','co_8_4','co_5_4','co_9_4']),{foes:3,big:true}), {v,F}=L;
  const ls0=v.lifestealStat||0; v._dropHidden=true; v._dropT=99; secs(2.0); v._dropHidden=false; near(stack(L,'dusk'),5,'1 Dusk each 0.5 s off the field, Moonless 30% faster (2 s: 5)',0.25);
  v._dropHidden=true; v._dropT=99; secs(7); v._dropHidden=false; assert.equal(stack(L,'dusk'),20,'Darker Sky: up to 20');
  near(ratio(L,F[0]),1+0.03*20,'his first strike after he lands: 1% x 3 per Dusk spent'); assert.equal(stack(L,'dusk'),0,'all spent'); near(ratio(L,F[0]),1,'only the first');
  V.step(1); near(v.lifestealStat-ls0,0.10,'Settling Dark: 0.5% x 5 lifesteal per Dusk spent, up to 10%',1e-9); secs(4.1); near(v.lifestealStat-ls0,0,'for 4 s',1e-9);
  v._vpT=0.6; secs(0.5); v._vpT=0; V.step(1); const n=stack(L,'dusk'); assert.ok(n>=1,'Vanishing Point\'s time off counts too');
  F[1].hp=1; F[1].shield=0; V.hit(v,F[1],100,{kind:'true'}); assert.ok(!F[1].alive); assert.equal(stack(L,'dusk'),5,'Second Descent: a kill with the landing strike gathers 5 at once');
  near(ratio(L,F[0]),1,'not spent by an ability hit'); const a=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',auto:true}));
  const b=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',auto:true}))); near(a/b,1.15,'his next basic attack spends them'); assert.equal(stack(L,'dusk'),0);
});

test('Hollow / Clean Work: kills of enemies that never hit him (this wave, up to 5), 0.4% x 5 attack, Spotless, Nobody Saw, Untouched Record',()=>{
  const L=hl(S(['co_2_2','co_6_2','co_11_2','co_10_2']),{foes:8,big:true}), {v,F}=L; const a0=v.dmg, i0=v.atkInterval;
  hitOn(L,v,10,{src:F[0]}); kill(L,F[0]); assert.equal(stack(L,'cw'),0,'an enemy that hit him: none');
  for(let i=1;i<=6;i++) kill(L,F[i]); assert.equal(stack(L,'cw'),5,'up to 5'); V.step(1);
  near(v.dmg/a0,1.10,'2% attack per Clean Work',1e-9); near(i0/v.atkInterval,1.125,'Spotless: 2.5% attack speed per Clean Work',1e-9);
  near(inRatio(L,{src:F[7]}),0.90,'Nobody Saw: 10% less at 3 or more (in his capped group)');
  V.wave(); V.step(1); assert.equal(stack(L,'cw'),0,'a wave hit him: the next starts with none');
  V.wave(); V.step(1); assert.equal(stack(L,'cw'),5,'Untouched Record: a wave nobody hit him, 1 x 5 at the next one\'s start');
});

test('Hollow / Vanishing Point: Long Fall, The Last Line (finishes under 23%), Before the Body Lands, Countersigned, Clause of Silence, Point of No Return',()=>{
  plain({foes:4},P=>{ const {v,F}=P; for(const f of F){ f.maxHp=f.hp=1e5; } V.cast(v,'ult',F[0]); secs(0.95); });
  const L=fl(S(['co_3_3','co_8_1','co_9_1','co_11_1','co_7_2','co_1_1','co_12_3']),{foes:4,keys:[null,null,BACKK]}), {v,F}=L;
  assert.ok(mark(L,F[2],'ct'),'his Contract is F2');
  for(const f of F){ f.maxHp=1e5; f.hp=1e5; }
  // the kit row: the HP line
  const o=VMX('Object.assign({},ULT_DEF.vanishpoint)'); const k=FX.kit(v,'vanishpoint',o); L.T.s.cur=null; near(k.exec,0.20+0.03,'The Last Line: 20% + 0.6% x 5',1e-9);
  brnd(0.999); near(skillRatio(L,F[0],'vanishpoint'),1.15,'Long Fall 3% x 5');
  v._vpStep=1; near(skillRatio(L,F[0],'vanishpoint'),1.15*1.10,'Before the Body Lands: a hop 2% x 5 more'); v._vpStep=0; brndBack();
  const f0=F[0].hp; V.cast(v,'ult',F[0]); secs(0.95); assert.ok(F[2].hp<1e5,'Clause of Silence: the first strike falls on his Contract'); near(F[2].silencedT,1,'and silences it 1 s',0.1);
  near(F[0].hp,f0,'not on the enemy aimed at',1e-9);
  // Countersigned: an execute -> the next hop at full damage
  v._vpStep=0; L.T.s.ho.cs=0; F[1].hp=0.2*F[1].maxHp; F[3].hp=F[3].maxHp; v._vpForced=null;
  const fall=FX.num(v,'vpFall',0.8); near(fall,0.8,'no execute: the hop falls off');
  ho(L).cs=1; near(FX.num(v,'vpFall',0.8),1,'after an execute: full damage'); near(FX.num(v,'vpFall',0.64),0.64,'only the next hop');
});

test('Hollow / Countersigned in a real chain: after an execute the next hop deals full damage',()=>{
  const run=list=>{ const L=fl(list,{foes:3}), {v,F}=L; for(const f of F){ f.maxHp=f.hp=1e5; } F[0].hp=0.05e5; V.cast(v,'ult',F[0]); secs(0.95); assert.ok(!F[0].alive,'the first strike finishes it');
    const h=[F[1].hp,F[2].hp]; secs(0.45); return (h[0]-F[1].hp)+(h[1]-F[2].hp); };
  const p=run(null), t=run(S(['co_11_1'])); assert.ok(p>0,'the chain hops on'); near(t/p,1/0.8,'Countersigned: the hop after an execute at full damage, not 80%',1e-6);
});

test('Hollow / The Contract Is Kept (SIGNATURE): the Contract under 20%: he drops behind it and finishes it (a boss: 15% of its max HP), full Dusk; once every 20 s',()=>{
  const L=fl(S(['co_13_2','co_1_1','co_1_4']),{foes:4,keys:[null,BACKK]}), {v,F}=L; assert.ok(mark(L,F[1],'ct')); for(const f of F){ f.maxHp=f.hp=1e5; }
  F[1].hp=0.21e5; V.step(2); assert.ok(!(v._vpT>0),'not above 20% (21%)');
  F[1].hp=0.19e5; V.step(1); const t0=V.now(); assert.ok(v._vpT>0&&v._noTarget,'he is gone at once'); assert.equal(stack(L,'dusk'),10,'full Dusk');
  secs(1.0); assert.ok(!F[1].alive,'the strike finishes it outright');
  // once every 20 s: a new Contract under 20% within the 20 s does nothing
  secs(0.5); const c=F[0]; assert.ok(c.alive); setMk(L,c,'ct',999); L.T.s.m.ct=c; c.hp=0.1*c.maxHp; V.step(2); assert.ok(!(v._vpT>0),'not again within 20 s');
  secs(t0+19.6-V.now()); assert.ok(!(v._vpT>0),'(not at 19.6 s)'); secs(t0+20.15-V.now()); assert.ok(v._vpT>0,'again once 20 s have passed');
  const B=fl(S(['co_13_2','co_1_1']),{foes:3,keys:[null,BACKK]}); const b=B.F[1]; b.maxHp=1e6; b.hp=0.19e6; b._raidBoss=true; const h=b.hp; V.step(1); secs(1.0);
  assert.ok(b.alive,'a boss is not finished'); near(h-b.hp,0.15e6*1.10,'it takes 15% of its max HP (Terms of Hire 2% x 5 on top)',1e-6);
});

test('Hollow / Deep Rank, Due Date, Sure Feet, Patient Hands, Untraced, Thin Target and Out of Their Reach (in his capped group)',()=>{
  const L=hl(S(['co_7_1','co_10_1','co_2_3','co_4_3','co_9_2','co_n1','co_6_1']),{foes:4,keys:[null,BACKK]}), {v,F}=L; const s0=v.speed;
  near(ratio(L,F[1]),1.10,'Deep Rank 2% x 5 on the back rank'); near(ratio(L,F[0]),1,'');
  F[0].hp=F[0].maxHp*0.39; near(ratio(L,F[0]),1.10,'Due Date 2% x 5 below 40%');
  v.energy=0; V.hit(v,F[0],10,{kind:'true',auto:true}); near(v.energy,0.99,'Patient Hands: 3% x 3 of a basic attack\'s 11 energy',1e-9);
  v.hp=v.maxHp*0.5; const h=v.hp; const l=lost(F[2],()=>V.hit(v,F[2],1000,{kind:'true'})); near(v.hp-h,l*(0.10+0.05),'Untraced: his passive heals 1% x 5 more',1e-6);
  near(inRatio(L,{src:F[1]}),0.91,'Out of Their Reach 3% x 3 from the back rank'); near(inRatio(L,{src:F[0]}),1,'');
  F[0].greenAb={radius:100,type:'nova'}; F[0]._castSlot='green'; near(inRatio(L,{src:F[0]}),0.91,'Thin Target: 3% x 3 from a skill that hits more than one'); near(inRatio(L,{src:F[0],auto:true}),1,'not a basic attack'); F[0]._castSlot=null;
  near(inRatio(L,{src:F[0]}),1,'not a hit outside a skill');
  near(L.T.s.ap.move,1.09,'Sure Feet 3% x 3',1e-9);
});

/* ============================== EVERY CUT STAYS OPEN ============================== */
test('Hollow / Knife Left In: Left in the Wound, Barbed, Barb Tips, Full Quiver, Pincushion, Fan Then Tear, Every Knife Home (up to 4% a pull), Rusted Edge',()=>{
  const L=hl(S(['ec_1_1','ec_2_1','ec_8_1','ec_3_1','ec_9_1','ec_n2','ec_7_1','ec_6_1']),{foes:5,big:true}), {v,F}=L;
  fanAt(L,F[0]); assert.equal(ust(L,F[0],'kn'),2,'Full Quiver: the nearest enemy it hits takes 2 knives');
  at(L,F[1],2.95,0.4); at(L,F[0],2.85,-0.3); V.cast(v,'green',F[0]); assert.equal(ust(L,F[1],'kn'),1,'one knife in each other enemy it hits'); assert.equal(ust(L,F[0],'kn'),4,'the nearest: 2 more');
  near(ratio(L,F[0]),1.12,'Barbed: 1% x 3 more per knife (4)');
  for(let i=0;i<4;i++){ at(L,F[0],2.9,0); V.cast(v,'green',F[0]); } assert.equal(ust(L,F[0],'kn'),6,'Barb Tips: up to 6');
  near(ustLeft(L,F[0],'kn'),6,'a knife lasts 6 s',0.01); myBl(L,F[0])[0].remaining=12; at(L,F[0],2.9,0); V.cast(v,'green',F[0]);
  near(ustLeft(L,F[0],'kn'),12,'Full Quiver: knives in a bleeding target last as long as its bleed',0.01);
  v.hp=v.maxHp*0.5; const hv=v.hp; F[0]._blStk=0; secs(1.2);
  lac(L,F[0]); assert.equal(ust(L,F[0],'kn'),0,'Lacerate pulls them all');
  near(v.hp-hv,0.04*v.maxHp,'Every Knife Home: 0.4% x 5 a knife (6: 12%), at most 4% of his max HP a pull',2e-3);
  assert.equal(F[0]._blStk,2,'Pincushion: 6 pulled count as one more Lacerate stack');
  const f2=F[3], f4=F[4]; const hp4=lost(f4,()=>lac(L,f4)); setUst(L,f2,'kn',4); const hb=f2.hp; lac(L,f2);
  near(hb-f2.hp,hp4*1.12+4*0.30*atkNow(L),'4 knives pulled outside Fan Then Tear: 6% x 5 of his attack each (Barbed 12% on the hit)',1e-6);
  F[4]._blStk=0; setUst(L,F[4],'kn',2); lac(L,F[4]); assert.equal(F[4]._blStk,1,'Pincushion: not with 2 knives');
  f2.hp=f2.maxHp*0.5; setUst(L,f2,'kn',3); const h2=f2.hp; V.heal(f2,1000); near(f2.hp-h2,1000*(1-0.36),'Rusted Edge: 4% x 3 less healing per knife (3 knives at most)',1e-6);
  setUst(L,f2,'kn',6); const h3=f2.hp; V.heal(f2,1000); near(f2.hp-h3,1000*(1-0.36),'never more than 3 knives\' worth');
});

test('Hollow / Fan Then Tear: within 1 s of Fan of Knives each knife pulled deals 10% x 3 more; Crowd Work; Wide Fan; Fanwork and Lacerating Fan; Nimble Wrist, Field of Knives',()=>{
  { const p=fl(null,{foes:4}); at(p,p.F[1],2.2,1.9); at(p,p.F[0],2.9,0); const h1=p.F[1].hp; V.cast(p.v,'green',p.F[0]); near(h1-p.F[1].hp,0,'(without Wide Fan an enemy 41 degrees off is outside the 75-degree cone)'); }
  const L=hl(S(['ec_1_1','ec_n2','ec_7_3','co_6_3','ec_4_1','co_7_3','co_10_3','ec_11_1']),{foes:5,big:true}), {v,F}=L;
  const hp4=lost(F[4],()=>lac(L,F[4]));
  at(L,F[0],2.9,0); at(L,F[1],2.2,1.9); at(L,F[2],2.1,-2.0); V.cast(v,'green',F[0]);
  assert.equal(ust(L,F[1],'kn'),1,'Wide Fan: 5 degrees x 3 wider reaches 41 degrees off'); assert.equal(ust(L,F[2],'kn'),1,'and 44 degrees');
  const d=F[0].dots[F[0].dots.length-1]; near(d.dps,v.dmg*KO('green').bleed*(1+0.05*2),'Crowd Work: its bleed 1% x 5 stronger per enemy beyond the first',1e-9);
  const h=F[0].hp; lac(L,F[0]); near(h-F[0].hp,hp4+0.30*atkNow(L)*1.30,'within 1 s: the knife 10% x 3 more',1e-6);
  at(L,F[3],0,2.9); const plainF=plainHit(L,()=>lost(F[3],()=>V.cast(v,'green',F[3]))); at(L,F[3],0,2.9); const tal=lost(F[3],()=>V.cast(v,'green',F[3]));
  near(tal/plainF,1.15*1.15,'Fanwork 3% x 5 and Lacerating Fan 3% x 5',1e-6);
  near(FX.cd(v,'green',7),6,'Nimble Wrist and Field of Knives: 0.1 s x 5 each',1e-9);
});

test('Hollow / his bleeds made his: Open Seams, Lingering, Quiet Bleeding, Old Wounds, Every One Opens, Takes a Little Back, Closed Over, Sympathy, Nothing Closes, Wet Steel',()=>{
  const L=hl(S(['ec_3_3','ec_6_2','ec_12_1','ec_9_3','ec_12_2','ec_1_4','ec_n1','ec_8_2','ec_10_1','ec_8_3']),{foes:4,big:true}), {v,F}=L; const i0=v.atkInterval;
  lac(L,F[0]); const d=myBl(L,F[0])[0]; assert.ok(d,'Lacerate\'s bleed is his'); assert.equal(d.remaining,7,'Lingering: 0.2 s x 5 = 1 s longer'); assert.ok(d._talF==null,'(a whole tick)');
  near(d.interval,1/1.12,'Quiet Bleeding: its ticks 4% x 3 sooner',1e-9);
  v.hp=v.maxHp*0.5; const hv=v.hp, h=F[0].hp; secs(0.95); const tk=h-F[0].hp; near(tk,d.dps*dm(v,F[0],'phys')*1.15,'Open Seams: 3% x 5 more a tick (armor applies: a game bleed)',1e-6);
  near(v.hp-hv,tk*0.09,'Takes a Little Back: his passive heals 3% x 3 of his bleed damage',1e-6);
  F[0].hp=F[0].maxHp*0.4; const h2=F[0].hp; secs(0.9); near(h2-F[0].hp,d.dps*dm(v,F[0],'phys')*1.15*1.15,'Old Wounds 3% x 5 below 50%',1e-6);
  V.step(1); near(i0/v.atkInterval,1.025,'Sympathy: 0.5% x 5 attack speed per enemy bleeding from him',1e-9);
  F[0].hp=F[0].maxHp*0.4; const h3=F[0].hp; V.heal(F[0],1000); near(F[0].hp-h3,900,'Nothing Closes: 2% x 5 less healing on enemies bleeding from him');
  near(ratio(L,F[0],{crit:true}),1.12,'Wet Steel: his crits on bleeding enemies 4% x 3 more'); near(ratio(L,F[1],{crit:true}),1,'');
  setStack(L,'eo',10); const h4=F[0].hp; secs(0.9); near(h4-F[0].hp,d.dps*dm(v,F[0],'phys')*1.15*1.15*1.25,'Every One Opens: 0.5% x 5 per rupture this wave (10)',1e-6);
  const C=hl(S(['ec_n1']),{foes:2}), vd=C.v.hp; V.dot(C.v,100,3,1,C.F[0]); secs(1.0); near(vd-C.v.hp,100*0.80,'Closed Over: DoTs on him 4% x 5 less',1e-6);
});

test('Hollow / the rupture: Open Season (PICK ONE: at 2 stacks, 30% less), Narrow Cut (PICK ONE: 25% more, All the Others on the 2 nearest) and Flat Blade, Every One Opens\' count',()=>{
  const ref=fl(null,{foes:3,big:true}); lac(ref,ref.F[0]); const hit=lost(ref.F[0],()=>lac(ref,ref.F[0])), rup=lost(ref.F[0],()=>lac(ref,ref.F[0]))-hit;
  assert.ok(rup>hit,'(plain: the third Lacerate ruptures)');
  { const L=hl(S(['ec_5_2','ec_12_2']),{foes:3,big:true}), {v,F}=L; lac(L,F[0]); const h=F[0].hp; lac(L,F[0]); assert.equal(F[0]._blStk,0,'Open Season: it ruptures at 2');
    near(h-F[0].hp,hit+rup*0.70,'30% less rupture',1e-6); assert.equal(stack(L,'eo'),1,'Every One Opens counts it'); setStack(L,'eo',9); for(let i=0;i<4;i++) lac(L,F[0]); assert.equal(stack(L,'eo'),10,'up to 10'); }
  { const L=hl(S(['ec_5_3','ec_6_3','ec_2_2']),{foes:5,big:true}), {v,F}=L; for(const f of [F[1],F[2],F[3]]) lac(L,f);
    lac(L,F[0]); lac(L,F[0]); const h=F[0].hp, hs=[F[1].hp,F[2].hp,F[3].hp]; lac(L,F[0]);
    near(h-F[0].hp,hit+rup*1.25*1.12,'Narrow Cut 25% and Flat Blade 4% x 3',1e-6);
    const tk=v.dmg*BLK()*1.75; near(hs[0]-F[1].hp,tk*dm(v,F[1],'phys'),'All the Others: the nearest other (F1)',1e-6); near(hs[2]-F[3].hp,tk*dm(v,F[3],'phys'),'and the next nearest (F3)',1e-6); near(hs[1]-F[2].hp,0,'not a third (F2)'); }
});

test('Hollow / All the Others: The Third Cut, Opened Together, Chain of Cuts, Red Thread (again 1 s later at half)',()=>{
  const L=hl(S(['ec_2_2','ec_10_2','ec_4_2','ec_11_2']),{foes:4,big:true}), {v,F}=L;
  lac(L,F[1]); lac(L,F[2]); lac(L,F[0]); lac(L,F[0]); const h1=F[1].hp, h2=F[2].hp, h3=F[3].hp; brnd(0.999); lac(L,F[0]); brndBack();
  const k=1+0.75+0.10; near(h1-F[1].hp,v.dmg*BLK()*k*dm(v,F[1],'phys'),'one of its ticks, 15% x 5 and 2% x 5 stronger, armor applies',1e-6); near(h2-F[2].hp,v.dmg*BLK()*k*dm(v,F[2],'phys'),'',1e-6);
  near(h3-F[3].hp,0,'not an enemy that does not bleed from him'); near(F[1]._blStk,1,'Chain of Cuts: no stack when the roll fails',1e-9);
  const L2=hl(S(['ec_2_2','ec_4_2','ec_11_2']),{foes:4,big:true}); const {F:G}=L2; lac(L2,G[1]); lac(L2,G[0]); lac(L2,G[0]); brnd(0.4); const s1=G[1]._blStk; lac(L2,G[0]); brndBack();
  assert.equal(G[1]._blStk,s1+1,'Chain of Cuts: 15% x 3 = 45%: a roll of 0.4 adds a Lacerate stack');
  const b=G[1].hp, bl=myBl(L2,G[1]); for(const d of bl) d.acc=-99; brnd(0.999); secs(1.05); brndBack(); near(b-G[1].hp,Math.max(...bl.map(d=>d.dps))*1.75*0.5*dm(L2.v,G[1],'phys'),'Red Thread: 1 s later, at half',1e-6);
});

test('Hollow / Every Cut at Once (SIGNATURE): a rupture opens every wound - the rest of every bleed at once, every knife pulled, 10% of it back; once every 20 s',()=>{
  const L=hl(S(['ec_13_2','ec_1_1']),{foes:4,big:true}), {v,F}=L; lac(L,F[1]); lac(L,F[2]); setUst(L,F[2],'kn',3); setUst(L,F[3],'kn',2);
  const rest=x=>myBl(L,x).reduce((a,d)=>a+d.dps*(d.remaining-1+(d._talF!=null?d._talF:1)),0)*dm(v,x,'phys');
  lac(L,F[0]); lac(L,F[0]); const r1=rest(F[1]), r2=rest(F[2]), h=[F[1].hp,F[2].hp,F[3].hp]; v.hp=v.maxHp*0.5; const hv=v.hp; lac(L,F[0]);
  near(h[0]-F[1].hp,r1,'the rest of F1\'s bleed in one blow',1e-6); assert.equal(myBl(L,F[1]).length,0,'its bleed is over'); near(h[1]-F[2].hp,r2+3*0.30*atkNow(L),'F2: its bleed and 3 knives',1e-6);
  near(h[2]-F[3].hp,2*0.30*atkNow(L),'F3: 2 knives (no bleed)',1e-6); assert.ok(v.hp-hv>0.10*(r1+r2+5*0.30*atkNow(L))-1e-6,'10% of the total back');
  lac(L,F[1]); lac(L,F[0]); lac(L,F[0]); const g=F[1].hp; lac(L,F[0]); assert.ok(myBl(L,F[1]).length>0,'not again within 20 s');
});

test('Hollow / the shadow shield: Takes a Little Back\'s overheal (8% of his max HP, Dark Stitching), Mender\'s Hand, Patient Mending, Shadow Feeds, Thin Shadow, Borrowed Dark',()=>{
  const L=hl(S(['ec_1_4','ec_3_4','ec_6_4','ec_5_4','ec_11_4','ec_7_4','ec_12_4']),{foes:3}), {v,F}=L; free(F[0]);
  v.hp=v.maxHp; V.heal(v,0.30*v.maxHp); near(v.shield,0.13*v.maxHp,'healing past full: a shield of up to 8% + 1% x 5 of his max HP',1e-6); V.heal(v,0.1*v.maxHp); near(v.shield,0.13*v.maxHp,'never more',1e-6);
  near(ratio(L,F[1]),1.075,'Shadow Feeds: 1.5% x 5 more while he holds it');
  const s=v.shield; V.hit(F[0],v,10,{kind:'true'}); v.energy=0; near(1-F[0].slowMul,0.12,'Thin Shadow: the enemy that strikes it slowed 4% x 3',1e-9); near(F[0].slow,2,'2 s',1e-9);
  near(s-v.shield,10*VMX('elemMul')(F[0],v)*0.95,'Patient Mending: 1% x 5 less (his capped group)',1e-6);
  secs(6.9); assert.ok(v.shield>0,'Mender\'s Hand: 5 + 1 x 2 s'); secs(0.2); near(v.shield,0,'then gone',1e-6);
  V.heal(v,0.05*v.maxHp); hitOn(L,v,0.06*v.maxHp,{src:F[1]}); near(v.shield,0,'broken',1e-6); v.hp=v.maxHp*0.5; near(ratio(L,F[1]),1.18,'Borrowed Dark: his next hit 6% x 3 more'); near(ratio(L,F[1]),1,'once');
});

/* ============================== THE SPACE BETWEEN ============================== */
test('Hollow / Misdirect: Wrong Place, Glass Turned Back, Sent Back Sharp (LINK, with Left in the Wound a knife), Sent Back Twice, Thrown Back (0.5 s, the break rule), No Reflection (once every 5 s), Return to Sender',()=>{
  const L=hl(S(['sb_1_1','sb_6_1','sb_n1','ec_1_1','sb_9_1','sb_2_1','sb_3_1','sb_7_1']),{foes:4,big:true}), {v,F}=L; free(F[0]); at(L,F[1],7,0.5); at(L,F[0],4.5,0);
  const em=VMX('elemMul')(F[0],v), k=0.40+0.04+0.12; ready(L); v.hp=v.maxHp*0.5; const hv=v.hp, h0=F[0].hp, h1=F[1].hp; brnd(0.999); V.hit(F[0],v,1000,{kind:'true'}); brndBack(); v.energy=0;
  near(h0-F[0].hp,1000*em*k,'the blow turned back on its thrower: 8% x 5 + 4% + 4% x 3 of it',1e-6); near(h1-F[1].hp,1000*em*k,'Sent Back Twice: one more enemy within 3 m of it',1e-6);
  assert.equal(ust(L,F[0],'kn'),1,'Sent Back Sharp with Left in the Wound: a knife in the thrower'); near(F[0].stunned,0.5,'Thrown Back: stunned 0.5 s',1e-9);
  near(v.hp-hv,0.05*v.maxHp,'No Reflection: 1% x 5 of his max HP',1e-6);
  F[0].stunned=0; ready(L); const h2=F[0].hp, hv2=v.hp; brnd(0.03); V.hit(F[0],v,1000,{kind:'true'}); brndBack(); v.energy=0;
  near(h2-F[0].hp,1000*em*k*(1+(v.critDmg||0.6)),'Return to Sender: 1.5% x 3 a critical (a roll of 0.03 < 0.045)',1e-6); assert.ok(!(F[0].stunned>0),'the break rule: no stun within 0.5 s after his last one ended');
  near(v.hp-hv2,0,'No Reflection: not again within 5 s',1e-9);
  secs(1.1); F[0].stunned=0; free(F[0]); V.step(1); ready(L); V.hit(F[0],v,1000,{kind:'true'}); v.energy=0; near(F[0].stunned,0.5,'later it stuns again',0.05);
  F[0].stunned=0; ready(L); const h3=F[0].hp; brnd(0.046); V.hit(F[0],v,1000,{kind:'true'}); brndBack(); v.energy=0; near(h3-F[0].hp,1000*em*k,'Return to Sender: a roll of 0.046 is not a critical (4.5%)',1e-6);
  const p=hl(S(['sb_n1']),{foes:3}); ready(p); V.hit(p.F[0],p.v,1000,{kind:'true'}); assert.equal(ust(p,p.F[0],'kn'),0,'Sent Back Sharp without Left in the Wound: no knife');
});

test('Hollow / Forgotten: Nothing to Remember (cannot target him 1.5 s, his hits on it 3% x 3), Long Forgetting, Out of Mind, Cut Unremembered, Faceless Crowd, Lost in the Press, Dim Outline',()=>{
  const L=hl(S(['sb_1_4','sb_3_4','sb_8_3','sb_5_4','sb_7_4','sb_12_3']),{foes:3,allies:1}), {v,F,A}=L; const i0=v.atkInterval; at(L,A[0],0,-4);
  const NE=VMX('nearestEnemy'); assert.equal(NE(F[0]),v,'F0 picks him (the nearest)');
  ready(L); v.greenCd=5; V.hit(F[0],v,1000,{kind:'true'}); v.energy=0; assert.ok(mark(L,F[0],'fg'),'it Forgets him'); assert.notEqual(NE(F[0]),v,'and picks someone else'); assert.ok(NE(F[0]),'');
  F[0]._backHunter=true; assert.notEqual(NE(F[0]),v,'(an enemy that hunts the back line, as an enemy Hollow does, skips him too)'); F[0]._backHunter=false;
  near(v.greenCd,5-0.9,'Lost in the Press: Fan of Knives 0.3 s x 3 sooner',1e-9);
  near(ratio(L,F[0]),1.09,'Nothing to Remember 3% x 3'); near(skillRatio(L,F[0],'bleedstack'),1.09*1.15,'Cut Unremembered: Lacerate 5% x 3 more on it');
  V.step(1); near(i0/v.atkInterval,1.05,'Faceless Crowd: 1% x 5 attack speed per enemy that has Forgotten him',1e-9);
  near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),910*VMX('elemMul')(F[0],A[0]),'Dim Outline: it deals 3% x 3 less (to his allies)');
  near(inRatio(L,{src:F[0]}),0.91,'and to him (his capped group)');
  secs(2.4); assert.ok(mark(L,F[0],'fg'),'Long Forgetting: 1.5 + 0.2 x 5 s'); secs(0.2); assert.ok(!mark(L,F[0],'fg'),'then over'); assert.equal(NE(F[0]),v,'it picks him again');
});

test('Hollow / Intervals: Between Beats (a ready miss unused 4 s is stored, max 2), spent as a miss with the passive\'s clock kept; Held Breath, Nothing Lands (with Between Beats at most 20%), Measured, Never Turning, Waited Until It Was Over, Gone Again',()=>{
  const L=fl(S(['sb_2_2','sb_4_2','sb_10_1','sb_8_2','sb_11_3','sb_12_1','sb_11_2']),{foes:3}), {v,F}=L;
  assert.equal(stack(L,'iv'),3,'Waited Until It Was Over: 1 x 3 at the wave\'s start');
  setStack(L,'iv',0); V.step(2); assert.ok(v._ntReady,'his miss is ready'); secs(3.9); assert.equal(stack(L,'iv'),0,'not before 4 s'); secs(0.2); assert.equal(stack(L,'iv'),1,'stored');
  assert.ok(!v._ntReady,'the ready miss became the Interval'); const cd=v._ntCd; assert.ok(cd>3,'and its clock started');
  const dotOn=()=>{ const h=v.hp; V.dot(v,100,1,1,F[0]); secs(1.02); const x=h-v.hp; v.hp=h; return x; };
  near(dotOn(),100*0.95*0.95,'Between Beats 1% x 5 and Nothing Lands 1% x 5 per stored Interval, on damage over time',1e-6);
  setStack(L,'iv',5); assert.equal(L.T.st.iv.max,5,'Held Breath: up to 5'); near(dotOn(),100*0.80,'together at most 20%',1e-6);
  near(ratio(L,F[0],{crit:true}),1.15,'Never Turning: his crits 3% x 5 more while one is stored');
  near(skillRatio(L,F[0],'vanishpoint'),1+0.06*5,'Gone Again: Vanishing Point 2% x 3 per stored Interval');
  const c0=v._ntCd; assert.ok(isMissed(L,()=>near(hitOn(L,v,500),0,'a blow while the passive is not ready: an Interval spends as a miss')));
  assert.equal(stack(L,'iv'),4); near(v._ntCd,c0,'the passive\'s own clock is kept',1e-9); assert.ok(!v._ntReady); const a0=v.dmg; V.step(1); near(v.dmg/a0,1.10,'Measured: 2% x 5 attack for 3 s',1e-9); secs(3.1); near(v.dmg/a0,1,'',1e-9);
});

test('Hollow / Two Places (PICK ONE: two blows, 50% longer) and Doubled; Sooner (PICK ONE: 25% sooner) and Quick Return; Knife Screen; Polite (up to 10); Room to Spare',()=>{
  { const L=fl(S(['sb_5_2','sb_6_2']),{foes:3}), {v}=L; ready(L); const lv=VMX('SKLV.notthere')(VMX('passLv')(v));
    assert.ok(isMissed(L,()=>hitOn(L,v,100))); assert.ok(v._ntReady,'Two Places: still ready for a second blow'); assert.ok(isMissed(L,()=>hitOn(L,v,100)),'the second misses');
    near(v._ntCd,lv*1.5,'then 50% longer to come ready',1e-9); assert.ok(hitOn(L,v,100)>0,'a third lands'); near(ratio(L,L.F[0]),1.15,'Doubled: his next hit 3% x 5 more'); near(ratio(L,L.F[0]),1,'once'); }
  { const L=fl(S(['sb_5_3','sb_6_3']),{foes:3}), {v}=L; ready(L); const lv=VMX('SKLV.notthere')(VMX('passLv')(v)); v.atkCd=1; v.atkInterval=1.7;
    assert.ok(isMissed(L,()=>hitOn(L,v,100))); near(v._ntCd,lv*0.75,'Sooner: 25% sooner',1e-9); near(v.atkCd,1-0.3*1.7,'Quick Return: his next basic attack 10% x 3 of his swing sooner',1e-9); }
  { const L=hl(S(['sb_10_2','sb_11_1','sb_12_2']),{foes:3,big:true}), {v,F}=L; v.blueCd=10;
    fanAt(L,F[0]); assert.ok(isMissed(L,()=>near(hitOn(L,v,500),0,'Knife Screen: the next blow after Fan of Knives misses as if his passive were ready'))); assert.ok(hitOn(L,v,500)>0,'only one');
    near(v.blueCd,9,'Room to Spare: Lacerate 0.2 s x 5 sooner a miss',1e-9); assert.equal(stack(L,'pol'),1); near(ratio(L,F[0]),1.015,'Polite: 0.3% x 5 per miss this wave');
    for(let i=0;i<15;i++){ ready(L); hitOn(L,v,10); } assert.equal(stack(L,'pol'),10,'up to 10');
    fanAt(L,F[0]); secs(2.1); assert.ok(hitOn(L,v,500)>0,'Knife Screen lasts 2 s'); }
});

test('Hollow / his damage reduction, one capped group (at most 40%): Dark Wraps, Unwritten, Never Recognised, with the others at once',()=>{
  const L=hl(S(['sb_6_4','sb_9_2','sb_9_4','co_n1','co_6_1','co_11_2','ec_5_4','sb_2_2','sb_10_1','sb_12_3']),{foes:4,keys:[null,BACKK]}), {v,F}=L; v.hp=v.maxHp*0.5;
  near(inRatio(L,{src:F[0],auto:true}),0.96*0.94,'Dark Wraps 2% x 2 on basic attacks; Unwritten 2% x 3 from an enemy he has not hit');
  V.hit(v,F[0],1,{kind:'true'}); near(inRatio(L,{src:F[0],auto:true}),0.96,'Unwritten: not once he has hit it');
  setMk(L,F[0],'fg'); setMk(L,F[2],'fg'); near(inRatio(L,{src:F[0]}),0.75*0.91,'Never Recognised: 25% from skills while two enemies have Forgotten him (and Dim Outline on it)');
  near(inRatio(L,{src:F[0],auto:true}),0.96*0.91,'not from basic attacks');
  L.F[2]._talM[v.uid].fg.until=V.now()-1; near(inRatio(L,{src:F[0]}),0.91,'Never Recognised: not with one');
  setStack(L,'cw',5); v.shield=1; ho(L).sh=1; F[1].greenAb={radius:100}; F[1]._castSlot='green'; setMk(L,F[1],'fg');
  near(inRatio(L,{src:F[1]}),0.60,'every condition at once: at most 40% off');
});

test('Hollow / Unmoved (up to 20%), Calm Head (up to 30%), Silent Edge, Close Quarters, Rough Grain, Light Step, Patience of a Tool, Pale Blade',()=>{
  const L=hl(S(['sb_5_1','sb_10_4','sb_3_3','sb_4_3','sb_10_3','sb_2_3','sb_9_3','sb_12_4']),{foes:4,keys:[null,BACKK]}), {v,F}=L; const s0=v.speed;
  free(v); const d=VMX('ccApply'); const lvv=v.level; v.level=1; d(F[0],v,'fearT',2); v.level=lvv; near(v.fearT,2*V.ccNerf*0.80,'Unmoved: 20% shorter',1e-9);
  v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*0.7,'Calm Head: slows 10% x 3 weaker',1e-9); V.step(1); near(v.slowMul,0.65,'once per slow',1e-9);
  near(ratio(L,F[1],{auto:true}),1.10,'Silent Edge 2% x 5 on basic attacks'); near(ratio(L,F[1]),1,'');
  near(ratio(L,F[0]),1.09,'Close Quarters 3% x 3 on the front row (a Vael)'); near(ratio(L,F[1]),1,'not the back row');
  const ph=F[2]; ph.armorRating=400; const a=lost(ph,()=>V.hit(v,ph,1000,{kind:'phys'})), b=plainHit(L,()=>lost(ph,()=>V.hit(v,ph,1000,{kind:'phys'}))); const sv=v._wpnArmIgn; v._wpnArmIgn=0.10; const w=dm(v,ph,'phys'); v._wpnArmIgn=sv;
  near(a/b,1.09*w/dm(v,ph,'phys'),'Rough Grain 2% x 5 of the armor ignored');
  near(L.T.s.ap.move,1.09,'Light Step 3% x 3',1e-9);
  v.hp=v.maxHp*0.5; const h=v.hp; const l=lost(F[3],()=>V.hit(v,F[3],1000,{kind:'true',auto:true})); near(v.hp-h,l*0.15+0.01*v.maxHp,'Patience of a Tool 1% x 5 more of the damage; Pale Blade 0.5% x 2 of his max HP a basic attack',1e-6);
});

test('Hollow / He Was Never There (SIGNATURE): the blow that would drop him below 30% misses, every enemy within 4 m Forgets him 2 s, 2 Intervals, the whole blow thrown back; once every 20 s',()=>{
  const L=hl(S(['sb_13_2','sb_1_1','sb_2_2']),{foes:4,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=0.5e6; v._ntReady=false; v._ntCd=99; at(L,F[1],6.5,2); at(L,F[2],20,0);
  const em=VMX('elemMul')(F[0],v), h=F[0].hp; V.hit(F[0],v,0.3e6,{kind:'true'}); v.energy=0;
  near(v.hp,0.5e6,'it misses',1e-9); near(h-F[0].hp,0.3e6*em,'Misdirect throws the whole blow back',1e-6); assert.ok(mark(L,F[0],'fg')&&mark(L,F[1],'fg'),'every enemy within 4 m Forgets him'); assert.ok(!mark(L,F[2],'fg'),'not one 20 m away');
  assert.equal(stack(L,'iv'),2,'2 Intervals'); setStack(L,'iv',0);
  const h2=v.hp; V.hit(F[0],v,0.3e6,{kind:'true'}); assert.ok(v.hp<h2,'not again within 20 s');
});

test('Hollow / his crit-chance talents, one group (5% in all): Needle Point and Turned Steel as a stat, No Witnesses, Cold Hands, Out of Mind, Shadow Weight, Point of No Return as this hit\'s own roll',()=>{
  const L=hl(S(['co_1_3','sb_8_1','co_4_2','ec_12_3','sb_7_3','co_11_4','co_12_3']),{foes:4,big:true}), {v,F}=L; V.step(1);
  near(v.glyphCrit,0.05,'Needle Point 5% and Turned Steel 5%: 5% in all',1e-9);
  setUst(L,F[0],'kn',1); setMk(L,F[0],'fg'); brnd(0.0); near(ratio(L,F[0]),1,'nothing more on any hit: the group is full'); brndBack();
  const L2=hl([['co_1_3',1],['ec_12_3',2],['sb_7_3',3]],{foes:4,big:true}); V.step(1); const v2=L2.v;
  near(v2.glyphCrit,0.01,'Needle Point at 1/5: 1%',1e-9); setUst(L2,L2.F[0],'kn',1); setMk(L2,L2.F[0],'fg');
  brnd(0.039); assert.ok(ratio(L2,L2.F[0])>1.5,'Cold Hands 4% + Out of Mind 3%, 4% room: a roll of 0.039 crits'); brndBack();
  brnd(0.0405); near(ratio(L2,L2.F[0]),1,'a roll of 0.0405 does not (4% room / (1 - 1%))'); brndBack();
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Hollow: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['co_1_1','co_1_4','co_2_2','sb_1_1','sb_1_4','sb_2_2','ec_1_4','ec_3_3','co_7_1']), TEAM=['vael','sylthaine','vireo','vex','hollow'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let ct=false,fg=false,md=0,bl=0,sp=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.ct) ct=true; if(o.fg&&o.fg.until>V.now()) fg=true; if(myBlU(s,f)) bl++; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', a Contract '+ct+', Forgotten '+fg+', ticks with an enemy bleeding from him '+bl);
  assert.ok(ct,'a real Contract'); assert.ok(mx.dusk>=5,'real Dusk'); assert.ok(fg,'a real Forgotten'); assert.ok(bl>0,'his bleeds made his');
  determinism(H,TEAM);
});
const myBlU=(s,f)=>(f.dots||[]).some(d=>d._talO===s.uid&&d._talK==='bl'&&d.remaining>0);

/* The page sites his talents added (the banked miss, before and after it; nearestEnemy's two tests; Vanishing Point's strike: its target, its fall-off, its HP
   line, landPre / land; the bleed stack, its rupture threshold, partPre / part around the rupture): with nothing learned, whole seeded fights with Hollow in the
   line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters are also the base-skill measure of the report. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Hollow: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['hollow','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __hoN={fan:0,lac:0,vp:0,strike:0,bleed:0,rupt:0,blows:0,miss:0,ne:0}; var __hoD=_doEffectCore, __hoS=hollowStrike, __hoB=addBleedStack, __hoC=_dealDamageCore, __hoE=nearestEnemy;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="hollow"){ if(type==="bladefan") __hoN.fan++; if(type==="bleedstack") __hoN.lac++; if(type==="vanishpoint") __hoN.vp++; } return __hoD.apply(this,arguments); };'+
    'hollowStrike=function(u){ if(u&&u._vpO) __hoN.strike++; return __hoS.apply(this,arguments); };'+
    'addBleedStack=function(s,t,o){ if(s&&s.key==="hollow"&&t&&t.alive){ __hoN.bleed++; if(((t._blStk||0)+1)>=((o&&o.rupture)||3)) __hoN.rupt++; } return __hoB.apply(this,arguments); };'+
    '_dealDamageCore=function(s,t,a,c,k,si){ const f0=floatTexts.length; if(t&&t.key==="hollow"&&s&&s.team!==t.team) __hoN.blows++; const r=__hoC.apply(this,arguments); for(let i=f0;i<floatTexts.length;i++) if(floatTexts[i]&&floatTexts[i].txt==="NOT THERE") __hoN.miss++; return r; };'+
    'nearestEnemy=function(u){ __hoN.ne++; return __hoE.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const RS=`(function(al,fo){ ended=false; state='battle'; CUR={mode:'replay',seed:9}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true; try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0; seedBattle(9); setupMarchTeams(al,fo,false);
      const h=units.find(u=>u.key==='hollow'), f=units.find(u=>u.team==='enemy'); h._dropHidden=false; h._dropT=0; h.x=300; h.y=700; f.x=h.x+120; f.y=h.y; let r=0;
      for(let i=0;i<3;i++){ const s0=f._blStk||0; h.target=f; h._castSlot='blue'; h._castLv=10; h._castSM=skillMul(10); doEffect(h,'bleedstack',h.blueAb); h._castSlot=null; if(s0===2&&!f._blStk) r++; }
      for(let i=0;i<60;i++) updateBattle(SIM_STEP); return JSON.stringify([r,f.hp,f._blStk,brnd()]); })`;
    const rupt=h=>{ const al=JSON.stringify(h.snapFromSpecs([spec('hollow',100)])), fo=JSON.stringify(h.snapFromSpecs([spec('vael',100)])); return vm.runInContext(RS+'('+al+','+fo+')',h.ctx); };
    const ra=rupt(NOW); assert.equal(ra,rupt(BASE),'a scripted Lacerate x 3 that ruptures: identical'); assert.equal(JSON.parse(ra)[0],1,'(it ruptured)'); n++;
    const c=VMX('__hoN'); console.log('  identity / base skills: '+JSON.stringify(c)+' (misses per blow aimed at him '+(c.miss/Math.max(1,c.blows)).toFixed(2)+', strikes per Vanishing Point '+(c.strike/Math.max(1,c.vp)).toFixed(2)+', ruptures '+c.rupt+')');
    assert.ok(c.blows>0&&c.miss>0&&c.vp>0&&c.strike>0&&c.bleed>0&&c.ne>0,'the fights hit him and missed him, cast Vanishing Point and struck, pushed bleed stacks and ruptured, and picked targets: every new site was run'); }
  finally{ VMX('_doEffectCore=__hoD; hollowStrike=__hoS; addBleedStack=__hoB; _dealDamageCore=__hoC; nearestEnemy=__hoE;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ co:['co_n1','co_6_1','co_11_2','co_6_4','co_10_2'],
            ec:['ec_5_4','ec_4_3','ec_n1','ec_1_4','ec_3_4','ec_6_4'],
            sb:['sb_2_2','sb_4_2','sb_10_1','sb_6_4','sb_9_2','sb_9_4','sb_12_3','sb_1_3','sb_4_1','sb_1_4','sb_7_4','sb_13_2','sb_12_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={co:0,ec:1,sb:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (the attacker in the back row, Forgotten him with another enemy, never hit by him,
   an area skill for an ability or a basic attack, 5 stored Intervals, 5 Clean Work, a shadow shield held); sustained: a usual state (1 Interval, 2 Clean Work, no shield,
   the attacker in the front row, he has hit it, nobody has Forgotten him, a basic attack of 5% of his max HP). Measured through the engine (HP and shield it takes) */
function worstHit(list,kind,crit,sustained,autoHit){ const L=hl(list,{foes:5,keys:sustained?[]:[BACKK]}), {v,F}=L; const f=F[0];
  v.maxHp=1e5; v.hp=sustained?8e4:6e4; v._ntReady=false; v._ntCd=99;
  if(L.T){ if(!sustained){ setStack(L,'cw',5); setMk(L,f,'fg'); setMk(L,F[1],'fg'); ho(L).sh=1e12; ho(L).shT=V.now()+99; f.greenAb={radius:100}; f._castSlot=autoHit?null:'green'; }
    else { setStack(L,'cw',2); setMk(L,f,'ht'); } }
  V.step(1); if(L.T&&L.T.st.iv) setStack(L,'iv',0); if(L.T&&!sustained){ ho(L).sh=1e12; ho(L).shT=V.now()+99; L.T.s.lim={}; }
  v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6;
  const raw=sustained?5e3:2e4, au=sustained?true:!!autoHit, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:au})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; f._castSlot=null;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Hollow: his most defensive legal 91-point build never takes more than 95% off a hit, against skills too, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['sb','co'],[61,30]],[['sb'],[91]],[['sb','ec'],[61,30]],[['co','sb'],[61,30]],[['ec','sb'],[61,30]],[['sb','co','ec'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.skill=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ const s=worstHit(c.list,kind,crit,false,false), a=worstHit(c.list,kind,crit,false,true); c.skill=Math.max(c.skill,s); c.worst=Math.max(c.worst,s,a); }
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% (skills '+(c.skill*100).toFixed(1)+'%) sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  assert.ok(best.skill<0.95,'against skills only: '+(best.skill*100).toFixed(1)+'%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,sn:0,smax:0,shi:0,ticks:0,off:0,imm:0,tHi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="hollow"&&src&&src.team!==tgt.team, au=_autoAtk; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; if(!au){ __dr.sn++; if(d>__dr.smax) __dr.smax=d; if(d>=0.85) __dr.shi++; } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="hollow"&&u.alive){ __dr.ticks++; if(u._dropHidden||(u._fallT||0)>0||(u._vpT||0)>0) __dr.off++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const T=u._tal; if(T){ const P=T.P, k=T.s.k, iv=(k.iv&&k.iv.n)||0, cw=(k.cw&&k.cw.n)||0; let m=1; m*=1-(P["dr.tt"]||0); m*=1-(P["dr.back"]||0); if(cw>=3) m*=1-(P["dr.ns"]||0); if(T.s.ho&&T.s.ho.sh>0&&u.shield>0) m*=1-(P["dr.pm"]||0);'+
    '      m*=1-(P["dr.uw"]||0); if(iv<0) m=0; m*=1-(P["dr.do"]||0); m=Math.max(0.60,m); const tot=1-m*defMul(units.find(e=>e.team!==u.team&&e.alive)||u,u,"phys"); if(tot>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','hollow'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (against skills '+(best.skill*100).toFixed(1)+'%; no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+' ('+(100*d.hi/Math.max(1,d.n)).toFixed(1)+'% of hits); against skills '+d.sn+' hits, the most reduced '+(d.smax*100).toFixed(1)+'%, 85% or more '+d.shi+'; at the ceiling '+d.at+'; ticks at 85% or more against the worst attacker '+d.tHi+' of '+d.ticks+' ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%); off the field '+d.off+' ticks, immune '+d.imm);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
