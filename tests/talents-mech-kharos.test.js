'use strict';
/* Kharos Bloomknife's talents as data on the mechanics layer (talents-mech/kharos.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off for
   one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Kharos, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). His body is 1.61 m, a Vael's 2.01 m, so body to
   body F0 is 0.88 m away (an Onlooker, and its basic attacks Overreach), F3 2.38 m (an Onlooker, no Overreach), F1 6.4 m (neither).
   Lab units are HELD (stunned 1e6): a held Kharos has no camouflage clock and no Bloomstep window end (both are in his think after the stun return); freeK() lets
   him think without acting. Run: node --test tests/talents-mech-kharos.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='kharos', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:dur===null?null:V.now()+(dur||99),v:0}; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:Infinity}; };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const free=x=>{ x.stunned=0; x.silencedT=0; x.speed=0; x.level=1; x.atkCd=1e9; };
const freeK=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));
function skillRatio(L,t,skill,o){ L.T.s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))); } finally{ L.T.s.cur=null; } return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))); }
const outRatio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
const inRatio=(L,o)=>hitOn(L,L.v,1000,o)/plainHit(L,()=>hitOn(L,L.v,1000,o));
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ return V.cc(src,t,field,secs); } finally{ t.level=lv; } };
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const SM=lv=>VMX('skillMul')(lv);
const onl=(L,x)=>!!(L.T.s.onl&&L.T.s.onl[x.uid]);
const A_=L=>L.T.s.api;
/* his Petal Sever bleeds on x (the DoTs his rows made his: tag 'ps') */
const psOf=(L,x)=>(x.dots||[]).filter(d=>d._talO===L.v.uid&&d._talK==='ps'&&d.remaining>0);
const fakePs=(L,x,dps,n)=>{ VMX('pushDot')(x,dps||1,n||99,1,'#8f8fa8',L.v); const d=x.dots[x.dots.length-1]; d.remaining=n||99; d._talO=L.v.uid; d._talK='ps'; return d; };
/* the share his rows give one tick of DoT d on x (his dotOut rows through the dot hook), the tick not dealt */
const dm=(x,d)=>{ const k=FX.dotPre(x,d); const r=d.dps/k[0]; d.dps=k[0]; d._talNow=false; return r; };
const ps=(L,t)=>V.cast(L.v,'green',t);                                  // Petal Sever on t
const bs=L=>V.cast(L.v,'blue',L.v);                                      // Bloomstep
const ult=(L,t)=>V.cast(L.v,'ult',t);                                    // Orchid Execution
const strikeAmt=L=>L.v.dmg*2.1*SM(10);                                   // one Bloomstep strike at the lab's skill level
const plainOn=(L,t,a)=>plainHit(L,()=>lost(t,()=>V.hit(L.v,t,a,{kind:'phys'})));
const ring=(L,F,r)=>F.forEach((f,i)=>at(L,f,r*Math.cos(2*Math.PI*i/F.length),r*Math.sin(2*Math.PI*i/F.length)));   // around him, the enemies 5.2 m or more apart (same-team bodies push apart)
const home=L=>{ L.v.x=300; L.v.y=700; const FP=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6]]; L.F.forEach((f,i)=>at(L,f,FP[i][0],FP[i][1])); };
const noCam=L=>{ L.v.pass=Object.assign({},L.v.pass,{camouflage:false}); };   // no Perfect Camouflage (its dodge would take some of the test's hits)
const noCrit=(L,fn)=>{ const c=L.T.on.crit; L.T.on.crit=undefined; try{ return fn(); } finally{ L.T.on.crit=c; } };   // his crit-chance rows off for one measure (a seeded roll)
const camUp=L=>{ freeK(L); secs(3.1); V.step(2); assert.ok(L.v._camOn,'Perfect Camouflage is up'); };

test('Kharos: every talent is accounted for - 7 plain stats, 118 with rows, none waiting',()=>{
  accounting(H,[125,7,118,0,0]);
  const M=FXN.mech(H); for(const id of ['lu_1_1','wo_1_1','sh_1_1','lu_13_2','wo_13_2','sh_13_2','wo_1_2','sh_11_3']) assert.ok(M.talents[id],id);
  for(const id of ['lu_1_3','lu_4_1','lu_6_4','sh_1_3','sh_4_1','wo_2_3','wo_n2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['wo_1_2','sh_11_3']) assert.ok(!FXN.has(H,id),id+' is a row (the 5% crit cap), not a plain stat');
});

test('Kharos: his real kit, as the talents read it - Petal Sever\'s stacks and bleeds, Bloomstep\'s evade, jump and window end, Perfect Camouflage, Orchid Execution',()=>{
  plain({foes:3},P=>{ const {v,F}=P;
    ps(P,F[1]); assert.equal(F[1]._blStk,1,'a stack'); const b=F[1].dots.filter(d=>d.color==='#8f8fa8'&&d.src===v); assert.equal(b.length,1,'and a bleed'); assert.equal(b[0].kind,'phys','a bleed: physical');
    near(b[0].dps,v.dmg*0.18*SM(10),'18% of his attack a second x skill level'); assert.equal(b[0].remaining,6,'6 s');
    ps(P,F[1]); assert.equal(F[1].dots.filter(d=>d.color==='#8f8fa8').length,2,'a NEW bleed each cast'); const h=F[1].hp; ps(P,F[1]); assert.equal(F[1]._blStk,0,'the third within 6 s ruptures and clears');
    ps(P,F[2]); secs(5.9); assert.equal(F[2]._blStk,1,'stacks hold under 6 s'); secs(0.2); assert.equal(F[2]._blStk,0,'and lapse 6 s after the last: its cooldown is as long');
    bs(P); near(v._evadeT,2.2,'Bloomstep: a 2.2 s window'); assert.equal(v._bloomOn,1); near(v.drMul,0.55-0.001*9,'its slot at its level'); const j0=v._bloomJumpSeq|0, hf=F[0].hp;
    assert.equal(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys'})),0,'the next hit is evaded'); assert.equal(v._bloomJumpSeq,j0+1,'he jumps behind the striker'); assert.ok(F[0].hp<hf,'and strikes it');
    freeK(P); bs(P); const j1=v._bloomJumpSeq; secs(2.3); assert.equal(v._bloomJumpSeq,j1+1,'no hit: at the window\'s end he jumps behind his target and strikes');
    v.atkCd=1e9; for(const f of F) f.stunned=1e6; v.x=300; v.y=700; F.forEach((f,i)=>at(P,f,[4.5,10,15.5][i],0));
    secs(3.1); V.step(1); assert.ok(v._camOn,'Perfect Camouflage after 3 s untouched'); near(v._camEva,0.18*v.passMul,'its dodge'); near(v.dmgBuffMul,1.25,'and +25% damage');
    v.evaStat=1; V.hit(F[0],v,10,{kind:'phys'}); V.step(1); assert.ok(!v._camOn,'a dodged hit ends it too: its dodge only meets the hit that ends it');
    v.stunned=1e6; v.evaStat=0; const u1=lost(F[1],()=>ult(P,F[1])); F[2].hp=F[2].maxHp/2; const u2=lost(F[2],()=>ult(P,F[2])); near(u2/u1,2,'Orchid Execution: x1 at full health, x2 at half',1e-3);
    assert.ok(F[2].alive,'it never kills outright'); });
});

/* ============================== THE LURE ============================== */
test('Kharos / Onlookers: Finest Thing Grown, Close Enough, Long Look, Soft Things Come Close, Lured In, Admiring Glance, Beautiful',()=>{
  const L=lab(H,S(['lu_1_1','lu_8_1','lu_12_1','lu_2_1','lu_10_1','lu_6_1','lu_11_1']),{foes:5,big:true,allies:1}), {v,F,A}=L;
  at(L,F[4],-7,0); V.step(2); assert.ok(onl(L,F[0])&&onl(L,F[3]),'F0 and F3 are Onlookers'); assert.ok(onl(L,F[4]),'F4 3.4 m away: with Close Enough'); assert.ok(!onl(L,F[1]),'F1 6.4 m away is not');
  near(outRatio(L,F[0]),1.10*1.05,'Finest Thing Grown (2% x 5) and Lured In (his own hit too, 1% x 5)'); near(outRatio(L,F[1]),1,'not on F1');
  near(hitOn(L,F[0],1000,{src:A[0]})/plainHit(L,()=>hitOn(L,F[0],1000,{src:A[0]})),1.05,'Lured In: his allies\' hits on it');
  near(F[0].speed/F[1].speed,0.91,'Soft Things Come Close: Onlookers 3% x 3 slower');
  near(hitOn(L,A[0],1000,{src:F[0]})/plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]})),0.91,'Admiring Glance: an Onlooker deals 3% x 3 less to his allies');
  near(inRatio(L,{src:F[0]}),0.91*(1-0.05*3),'and to him (in his group), with Beautiful: 3 Onlookers x 1% x 5');
  near(inRatio(L,{src:F[1]}),0.85,'from F1: Beautiful only');
  F[0].target=v; V.step(1); assert.ok(onl(L,F[0]),'it turns on him: still an Onlooker (Long Look)'); secs(2.8); assert.ok(onl(L,F[0]),'for 3 s'); secs(0.3); assert.ok(!onl(L,F[0]),'then not');
  F[0].target=null; V.step(1); assert.ok(onl(L,F[0]));
  ring(L,F,5); V.step(2); assert.equal(L.T.s.onlN,5); near(inRatio(L,{src:F[1]}),0.91*0.80,'Beautiful counts 4 Onlookers at most');
});

test('Kharos / Bees Did Not Leave, Finches and a Cat, Sure Cut',()=>{
  const L=lab(H,S(['lu_3_1','lu_7_1','lu_8_3']),{foes:4,big:true}), {v,F}=L; const a0=v.dmg; at(L,F[3],-7,0); V.step(2); assert.ok(onl(L,F[0])&&!onl(L,F[3]),'without Close Enough an enemy 3.4 m away is not an Onlooker');
  kill(L,F[0]); V.step(1); assert.ok(onl(L,F[1]),'the nearest other enemy (F1, 6.4 m away) is an Onlooker wherever it stands'); assert.equal(stack(L,'finch'),1,'Finches: 1');
  near(v.dmg/a0,1.05,'1% x 5 attack');
  const c1=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})), pc=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',crit:true})));
  near(c1/pc,1.10,'his next hit on it is a critical, and Sure Cut: crits on Onlookers 2% x 5 more');
  near(outRatio(L,F[1]),1,'only the next hit'); secs(3.1); assert.ok(!onl(L,F[1]),'3 s');
  kill(L,F[2]); assert.equal(stack(L,'finch'),1,'F2 was not an Onlooker: no Finch');
});

test('Kharos / Perfect Camouflage: Unnoticed, Still Bloom, Unscented, Drinking Light, Perfectly Still, No Scent at All',()=>{
  const L=lab(H,S(['lu_3_4','lu_3_3','lu_12_4','lu_4_3','lu_5_4','lu_1_4']),{foes:2,big:true}), {v,F}=L; freeK(L); const e0=0.18*v.passMul;
  secs(2.4); assert.ok(!v._camOn,'not at 2.4 s'); secs(0.2); V.step(2); assert.ok(v._camOn,'Unnoticed: up at 2.5 s (0.1 s x 5 sooner)');
  near(v._camEva,e0*1.04,'Unscented: its dodge 2% x 2 stronger'); near(v.evaStat,Math.min(0.5,e0*1.04),'on his Evasion'); near(v.dmgBuffMul,1+0.25*1.05,'Still Bloom: its damage bonus 1% x 5 stronger');
  v.energy=10; V.step(1); near(v.energy,10*1.09,'Drinking Light: 3% x 3 more energy while it is up');
  v.hp=v.maxHp/2; const h=v.hp; secs(3); const g=(v.hp-h)/(0.012*v.maxHp); assert.ok(g>=2-1e-6&&Math.abs(g-Math.round(g))<1e-6,'Perfectly Still: 0.24% x 5 = 1.2% of his max HP each second ('+g+')');
  near(outRatio(L,F[1]),1.15,'No Scent at All: his first hit out of it 5% x 3 more'); near(outRatio(L,F[1]),1,'only the first');
  hitOn(L,v,10,{src:F[0]}); V.step(1); assert.ok(!v._camOn,'a hit ends it'); near(v.evaStat,0,'its dodge given back'); assert.ok(!(v.dmgBuffT>0),'and its damage');
  v.energy=0; V.step(1); v.energy=10; V.step(1); near(v.energy,10,'no more energy once it is down');
});

test('Kharos / Scentless: No Scent at All, Under Glass, Never Moved Before',()=>{
  const L=lab(H,S(['lu_1_4','lu_7_4','lu_9_4']),{foes:2,big:true,allies:1}), {v,F,A}=L; camUp(L); assert.equal(v._talAgg,1,'Scentless while it is up');
  free(F[0]); V.step(1); assert.equal(F[0].target,A[0],'an enemy picking him picks another hero in its reach (A0 3.1 m from it)'); F[0].stunned=1e6;
  at(L,A[0],0,-25); free(F[0]); V.step(1); assert.equal(F[0].target,v,'none in reach: it keeps him'); F[0].stunned=1e6; at(L,A[0],0,-5.5);
  const c=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})), pc=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',crit:true})));
  near(c/pc,1.15,'Never Moved Before: his first hit on each enemy while Scentless is a critical (and No Scent at All\'s first hit, 5% x 3)'); near(outRatio(L,F[1]),1,'not the second');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'}))/plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',crit:true}))),1,'and a first on another');
  hitOn(L,v,10,{src:F[1]}); V.step(1); assert.ok(!v._camOn); secs(1.3); assert.equal(v._talAgg,1,'Under Glass: Scentless 0.5 s x 3 after it ends'); secs(0.3); assert.equal(v._talAgg,0,'then not');
  free(F[0]); V.step(1); assert.equal(F[0].target,v,'and enemies pick him again'); F[0].stunned=1e6;
});

test('Kharos / Open Petals (PICK ONE) and Second Petal; Closed Bud (PICK ONE) and Tight Bud',()=>{
  { const L=lab(H,S(['lu_5_2','lu_6_2']),{foes:2,big:true}), {v,F}=L; camUp(L);
    hitOn(L,v,10,{src:F[0]}); V.step(1); assert.ok(v._camOn,'Open Petals: the first hit does not end it');
    near(outRatio(L,F[1]),1.20,'Second Petal: his next hit 4% x 5 more'); near(outRatio(L,F[1]),1,'only the next');
    hitOn(L,v,10,{src:F[0]}); V.step(1); assert.ok(!v._camOn,'the second does');
    secs(3.1); V.step(1); assert.ok(v._camOn,'up again'); hitOn(L,v,10,{src:F[0]}); V.step(1); assert.ok(v._camOn,'and the first hit is held again'); }
  { const L=lab(H,S(['lu_5_3','lu_6_3']),{foes:2,big:true}), {v}=L; freeK(L); const e0=0.18*v.passMul, i0=v.atkInterval;
    secs(1.9); assert.ok(!v._camOn,'not at 1.9 s'); secs(0.2); V.step(2); assert.ok(v._camOn,'Closed Bud: up after 2 s');
    near(v._camEva,e0/2,'its dodge halved'); near(v.evaStat,e0/2); near(i0/v.atkInterval,1.09,'Tight Bud: 3% x 3 attack speed while it is up'); }
});

test('Kharos / Glass Patience and Glass Eye: dodges (seeded)',()=>{
  { const L=lab(H,S(['lu_10_2']),{foes:2,big:true}), {v,F}=L; let d=0; for(let i=0;i<3000;i++) if(lost(v,()=>V.hit(F[0],v,10,{kind:'phys'}))===0) d++;
    assert.ok(Math.abs(d/3000-0.075)<0.015,'Glass Patience: 1.5% x 5 while Perfect Camouflage is down ('+d+' of 3000)'); assert.equal(lost(v,()=>V.hit(F[0],v,10,{kind:'true'}))>0,true,'true damage cannot be dodged'); }
  { const L=lab(H,S(['sh_6_4']),{foes:4,big:true}), {v,F}=L; let d=0, e=0; for(let i=0;i<3000;i++){ if(lost(v,()=>V.hit(F[0],v,10,{kind:'phys',auto:true}))===0) d++; if(lost(v,()=>V.hit(F[3],v,10,{kind:'phys',auto:true}))===0) e++; }
    assert.ok(Math.abs(d/3000-0.04)<0.012,'Glass Eye: 2% x 2 against an Overreaching enemy ('+d+' of 3000)'); assert.equal(e,0,'none against F3 (2.4 m: it does not Overreach)'); }
});

test('Kharos / While It Is Admired (SIGNATURE)',()=>{
  const L=lab(H,S(['lu_13_2']),{foes:5,big:true}), {v,F}=L; F[3].dmg=F[0].dmg*3; at(L,F[0],4.5,3.5); camUp(L); V.step(1); assert.ok(onl(L,F[0])&&onl(L,F[3]));
  const j0=v._bloomJumpSeq|0, h0=F[0].hp, h3=F[3].hp, h1=F[1].hp;
  assert.equal(lost(v,()=>V.hit(F[1],v,1000,{kind:'phys'})),0,'the hit that would end the camouflage does not land'); assert.equal(v._bloomJumpSeq,j0+1,'he jumps');
  assert.ok(F[3].hp<h3,'behind the strongest Onlooker (F3) and strikes it'); assert.ok(F[0].hp<h0,'and F0, within 3 m of where he lands'); assert.equal(F[1].hp,h1,'not the striker');
  near((h3-F[3].hp)/plainOn(L,F[3],strikeAmt(L)),1,'Bloomstep\'s strike'); V.step(1); assert.ok(v._camOn,'the camouflage stays up');
  secs(1); v.evaStat=0; v._camEva=0; assert.ok(lost(v,()=>V.hit(F[1],v,1000,{kind:'phys'}))>0,'once every 20 s'); V.step(1); assert.ok(!v._camOn);
  secs(19.5); V.step(1); assert.ok(v._camOn); assert.equal(lost(v,()=>V.hit(F[1],v,1000,{kind:'phys'})),0,'and again after 20 s');
});

/* ============================== DEADHEADING ============================== */
test('Kharos / Overreach: How Far Away Their Hands Are, Too Close, Reaching Hand, Overextended, Reached Too Far, Snip',()=>{
  const L=lab(H,S(['sh_1_1','sh_8_1','sh_2_1','sh_6_1','sh_n1','lu_1_1','sh_9_1']),{foes:4,big:true,allies:1}), {v,F,A}=L;
  V.hit(F[3],v,10,{auto:true}); V.hit(F[0],v,10,{}); assert.ok(!mark(L,F[3],'over'),'F3 2.4 m away does not Overreach'); assert.ok(!mark(L,F[0],'over'),'nor an ability');
  V.hit(F[0],v,10,{auto:true}); assert.ok(mark(L,F[0],'over'),'F0\'s basic attack from 0.9 m: it Overreaches');
  near(outRatio(L,F[0]),1.10*1.10,'his hits on it 2% x 5 more (and Finest Thing Grown: it is an Onlooker)'); near(outRatio(L,F[3]),1.10,'F3: an Onlooker only');
  assert.ok(F[0].slow>3.4&&F[0].slow<=3.5+1e-9,'Reaching Hand: slowed while it Overreaches ('+F[0].slow+')'); near(F[0].slowMul,0.88,'4% x 3');
  near(hitOn(L,A[0],1000,{src:F[0]})/plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]})),0.91,'Overextended: it deals 3% x 3 less to his allies');
  near(inRatio(L,{src:F[0]}),0.91*0.96,'and to him, with Reached Too Far\'s 4%');
  F[0].target=v; V.step(1); assert.ok(onl(L,F[0]),'Reached Too Far with Finest Thing Grown: an Onlooker for 2 s though it attacks him');
  secs(2.0); assert.ok(!onl(L,F[0]),'2 s'); near(inRatio(L,{src:F[0]}),0.91,'its 4% too');
  secs(1.3); assert.ok(mark(L,F[0],'over'),'Too Close: it still Overreaches at 3.4 s'); secs(0.2); assert.ok(!mark(L,F[0],'over'),'2 s + 0.5 s x 3');
  V.hit(F[0],v,10,{auto:true}); v.blueCd=8; kill(L,F[0]); near(v.blueCd,4,'Snip: killing an Overreaching enemy halves Bloomstep\'s cooldown');
  v.blueCd=8; kill(L,F[1]); near(v.blueCd,8,'not another');
});

test('Kharos / Quicker Than Hands and Before the Man Had Finished Reaching (SIGNATURE)',()=>{
  { const L=lab(H,S(['sh_3_1']),{foes:4,big:true}), {v,F}=L; freeK(L); noCam(L); const j0=v._bloomJumpSeq|0, h=F[0].hp;
    assert.equal(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true})),0,'Quicker Than Hands: the Overreaching attack does not land'); assert.equal(v._bloomJumpSeq,j0+1,'he jumps');
    near((h-F[0].hp)/plainOn(L,F[0],strikeAmt(L)),1,'and Bloomstep\'s strike lands on it');
    assert.ok(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true}))>0,'once every 10 s'); secs(9.5); assert.ok(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true}))>0,'not at 9.5 s');
    secs(0.6); const h2=F[0].hp; assert.equal(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true,crit:true})),0,'again after 10 s'); near((h2-F[0].hp)/plainOn(L,F[0],strikeAmt(L)),1,'its strike does not take the enemy hit\'s pre-rolled critical');
    secs(11); home(L); V.step(1); assert.ok(lost(v,()=>V.hit(F[3],v,1000,{kind:'phys',auto:true}))>0,'not an attack that does not Overreach'); v.stunned=1e6; assert.ok(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true}))>0,'not while he is stunned'); }
  { const L=lab(H,S(['sh_13_2']),{foes:4,big:true}), {v,F}=L; freeK(L); noCam(L); const h=F[0].hp;
    assert.equal(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true})),0,'the signature: the attack does not land'); near((h-F[0].hp)/plainOn(L,F[0],2*strikeAmt(L)),1,'Bloomstep\'s strike at double strength');
    assert.ok(mark(L,F[0],'cat'),'it is Catalogued'); near(v.energy,25,'25 energy');
    secs(19); assert.ok(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true}))>0,'once every 20 s'); secs(1.1); assert.equal(lost(v,()=>V.hit(F[0],v,1000,{kind:'phys',auto:true})),0,'again after 20 s'); }
});

test('Kharos / Catalogue: Catalogued, Card in the Catalogue, Quick Learner, Pressed Specimen, Full Record, Read the Swing, Known Habits, Whole Collection, Exhibit',()=>{
  const L=lab(H,S(['sh_1_4','sh_3_4','sh_4_3','sh_5_4','sh_7_4','sh_9_2','sh_9_4','sh_12_2','sh_12_4']),{foes:3,big:true,allies:1}), {v,F,A}=L; const i0=v.atkInterval;
  bs(L); V.hit(F[0],v,10,{}); assert.ok(mark(L,F[0],'cat'),'the enemy Bloomstep strikes is Catalogued'); assert.equal(stack(L,'catN'),1); V.step(1);
  near(i0/v.atkInterval,1.025,'Whole Collection: 0.5% x 5 attack speed for each');
  noCrit(L,()=>{ near(outRatio(L,F[0]),1.05*1.05,'Card in the Catalogue (his own hits too) and Pressed Specimen'); near(outRatio(L,F[1]),1,'not F1'); });
  near(hitOn(L,F[0],1000,{src:A[0]})/plainHit(L,()=>hitOn(L,F[0],1000,{src:A[0]})),1.05,'his allies\' hits');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',crit:true}))/plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',crit:true}))),1.1025*1.09,'Full Record: crits 3% x 3 more');
  near(inRatio(L,{src:F[0]}),0.91,'Read the Swing: 3% x 3 less from it');
  v.energy=0; V.hit(v,F[0],10,{auto:true}); near(v.energy,0.99,'Quick Learner: 3% x 3 of a swing\'s 11 energy'); v.energy=0; V.hit(v,F[1],10,{auto:true}); near(v.energy,0,'not on F1');
  F[0].evaStat=1; F[1].evaStat=1; assert.ok(lost(F[0],()=>V.hit(v,F[0],100,{kind:'phys'}))>0,'Known Habits: a Catalogued enemy cannot dodge him'); assert.equal(lost(F[1],()=>V.hit(v,F[1],100,{kind:'phys'})),0,'F1 can'); F[0].evaStat=F[1].evaStat=0;
  F[0].hp=F[0].maxHp/2; F[0]._healCutUntil=0; const h=F[0].hp; V.heal(F[0],1000); near(F[0].hp-h,880,'Exhibit: 4% x 3 less healing');
  near(L.T.fn.critP(A_(L),L.T,v,{tgt:F[0]}),0.045,'Catalogued: 1.5% x 3 critical chance against it'); near(L.T.fn.critP(A_(L),L.T,v,{tgt:F[1]}),0);
});

test('Kharos / Bloomstep\'s strike: Counter Blade, Ambush Bloom, Bloomcut, Clean Shears, Shears Out, Silver Reach, Bow and Thank, Behind Them, Bloomstep Blade, Bloomstep Rhythm, Shedding Season',()=>{
  const L=lab(H,S(['sh_2_2','lu_7_3','wo_7_3','sh_8_3','sh_12_1','sh_10_1','sh_12_3','sh_4_2','lu_8_2','sh_8_2','wo_7_4']),{foes:3,big:true}), {v,F}=L;
  near(skillRatio(L,F[1],'counter'),1.15*1.15*1.30,'Counter Blade, Ambush Bloom (3% x 5 each) and Shears Out (10% x 3, the first strike this wave)');
  near(skillRatio(L,F[1],'bloomEnd'),1.15*1.15,'the window-end strike is Bloomstep\'s strike too; Shears Out only the first');
  fakePs(L,F[1]); near(skillRatio(L,F[1],'counter'),1.15*1.15*1.20,'Bloomcut: 4% x 5 on an enemy bleeding from his Petal Sever');
  near(skillRatio(L,F[2],'counter',{crit:true}),1.15*1.15*1.20,'Clean Shears: its crits 4% x 5 more'); near(outRatio(L,F[2]),1,'not his other hits');
  FX.wave(v); V.step(2); near(skillRatio(L,F[2],'counter'),1.15*1.15*1.30,'Shears Out again in a new wave');
  secs(3.1); setStack(L,'petal',0); v.hp=v.maxHp/2; const i0=v.atkInterval, h=v.hp, j0=v._bloomJumpSeq|0; bs(L); V.hit(F[0],v,10,{}); assert.equal(v._bloomJumpSeq,j0+1);
  near((v.hp-h)/v.maxHp,0.04,'Bow and Thank: 2% x 2 of his max HP when it lands'); assert.equal(stack(L,'petal'),3,'Shedding Season: 1 Petal x 3');
  V.step(1); near(i0/v.atkInterval,1.10,'Silver Reach: 2% x 5 attack speed'); assert.ok(win(L,'behind'),'Behind Them after the jump'); v.drT=0; near(inRatio(L,{src:F[1]}),0.88,'4% x 3 less');
  secs(2.05); assert.ok(!win(L,'behind'),'for 2 s'); secs(1.0); near(i0/v.atkInterval,1,'Silver Reach for 3 s');
  near(FX.cd(v,'blue',9),8,'Bloomstep Blade and Bloomstep Rhythm: 0.1 s x 5 each off its cooldown'); near(FX.cd(v,'green',6),6,'not Petal Sever\'s');
});

test('Kharos / Second Step (PICK ONE) and Double Back',()=>{
  const L=lab(H,S(['sh_5_2','sh_6_2']),{foes:3,big:true}), {v,F}=L; const a=v.dmg*2.1*SM(10);
  bs(L); let h=F[0].hp; V.hit(F[0],v,10,{}); near((h-F[0].hp)/plainOn(L,F[0],a),0.7,'the first counter at 70%'); V.step(1);
  assert.ok(v._evadeT>0&&v._bloomOn===1,'the window opens once more'); h=F[0].hp; const j=v._bloomJumpSeq;
  assert.equal(lost(v,()=>V.hit(F[0],v,10,{})),0,'a second hit is evaded'); assert.equal(v._bloomJumpSeq,j+1,'a second jump'); near((h-F[0].hp)/plainOn(L,F[0],a),0.7*1.15,'Double Back: the second at 70% and 3% x 5 more');
  V.step(1); assert.ok(lost(v,()=>V.hit(F[0],v,10,{}))>0,'not a third');
  freeK(L); noCam(L); bs(L); V.hit(F[0],v,10,{}); V.step(1); const j2=v._bloomJumpSeq, hs=F.map(f=>f.hp); secs(2.3); assert.equal(v._bloomJumpSeq,j2+1,'no second hit: the window\'s end strikes');
  near(F.reduce((a,f,i)=>a+hs[i]-f.hp,0)/plainOn(L,F[0],a),0.7*1.15,'that strike is Bloomstep\'s (70%, the second of the cast: Double Back)'); near(outRatio(L,F[1]),1,'and his next hit is not');
});

test('Kharos / Stand and Cut (PICK ONE) and Planted',()=>{
  const L=lab(H,S(['sh_5_3','sh_6_3']),{foes:3,big:true}), {v,F}=L; const a=v.dmg*2.1*SM(10);
  bs(L); assert.equal(v._bloomOn,0,'no jump'); assert.ok(win(L,'sac')); const ev=v._evadeT; v._evadeT=0; v.drT=0; near(inRatio(L,{src:F[1]}),0.85,'Planted: 5% x 3 less while its window is open'); v._evadeT=ev;
  const j=v._bloomJumpSeq|0, h=F[0].hp; assert.equal(lost(v,()=>V.hit(F[0],v,10,{})),0,'the hit is evaded'); assert.equal(v._bloomJumpSeq|0,j,'he does not jump');
  near((h-F[0].hp)/plainOn(L,F[0],a),1.25,'the counter lands where he stands, 25% more'); assert.ok(!win(L,'sac'),'the window is spent'); v.drT=0; near(inRatio(L,{src:F[1]}),1,'Planted with it');
  freeK(L); bs(L); const h0=F[0].hp, j1=v._bloomJumpSeq|0; secs(2.3); assert.ok(F[0].hp<h0,'no hit: at the window\'s end he strikes his target, 0.9 m away'); assert.equal(v._bloomJumpSeq|0,j1,'without a jump');
  near((h0-F[0].hp)/plainOn(L,F[0],a),1.25);
  v.atkCd=1e9; home(L); at(L,F[0],0,-9); V.step(1); bs(L); const h1=F[0].hp, h2=F[1].hp; secs(2.3); assert.equal(F[0].hp,h1,'a target beyond 2 m is not struck'); assert.equal(F[1].hp,h2);
});

test('Kharos / The Collector\'s Shears: the window\'s end behind the nearest Onlooker',()=>{
  const L=lab(H,S(['lu_9_1']),{foes:4,big:true}), {v,F}=L; F[0].target=v; freeK(L); V.step(2); assert.ok(!onl(L,F[0])&&onl(L,F[3]),'F0 attacks him: F3 is the nearest Onlooker');
  const h0=F[0].hp, h3=F[3].hp; bs(L); secs(2.3); assert.ok(F[3].hp<h3,'he appears behind F3 and strikes it'); assert.equal(F[0].hp,h0,'not his target F0');
});

/* ============================== THE WOUND THAT DOES NOT CLOSE ============================== */
test('Kharos / Petal Sever: its bleed made his; Crossed Blades, Open Wide, Cross Cut, Deep Sever, Lingering Cut, Sever Rhythm, Bitter Sap, Pink Sunrise',()=>{
  let s0, b0; plain({foes:3},P=>{ s0=lost(P.F[1],()=>ps(P,P.F[1])); b0=P.F[1].dots.filter(d=>d.color==='#8f8fa8')[0].dps; });
  const L=lab(H,S(['lu_4_2','wo_10_2','sh_7_3','wo_2_2','wo_4_2','wo_8_2','wo_n1','wo_3_3']),{foes:3,big:true}), {v,F}=L; const M=1.12*1.15*1.15;
  v.energy=0; const s1=lost(F[1],()=>ps(L,F[1])); near(s1/s0,M,'its hit: 4% x 3, 3% x 5, 3% x 5 more'); near(v.energy,1.1,'Bitter Sap: 2% x 5 of a cast\'s 11 energy');
  const d=psOf(L,F[1]); assert.equal(d.length,1,'its bleed is his'); near(d[0].dps,b0*1.15,'Deep Sever: it bleeds 3% x 5 harder'); near(dm(F[1],d[0]),M,'and its ticks deal more');
  assert.ok(d[0].remaining>=7&&d[0].remaining<=8,'Lingering Cut: the bleed 6 s + 0.4 s x 3 ('+d[0].remaining+')'); near(F[1]._blT,7.2,'and its stacks');
  near(lost(F[1],()=>ps(L,F[1]))/s0,M*1.10,'Pink Sunrise: 2% x 5 on an enemy bleeding from it');
  secs(7.0); assert.equal(F[1]._blStk,2,'the stacks hold at 7 s'); secs(0.4); assert.equal(F[1]._blStk,0,'and lapse after 7.2 s');
  near(FX.cd(v,'green',6),5.5,'Sever Rhythm: 0.1 s x 5 off its cooldown');
});

test('Kharos / Wither: Does Not Close, Dry Rot, Withering Gaze, Brittle Stems, Wilting, Cut Flower, Cruel Bloom, Garden of Wounds',()=>{
  const L=lab(H,S(['wo_1_1','wo_2_1','wo_6_1','wo_8_1','wo_12_1','wo_7_1','wo_8_3','wo_12_2']),{foes:3,big:true,allies:1}), {v,F,A}=L; const ar=F[2].armorRating, sp=F[2].speed;
  ps(L,F[1]); ps(L,F[1]); assert.equal(ust(L,F[1],'wither'),0,'no rupture yet'); ps(L,F[1]); assert.equal(ust(L,F[1],'wither'),1,'a rupture: a Wither'); assert.equal(stack(L,'gw'),1,'Garden of Wounds: 1 enemy this wave');
  for(let i=0;i<3;i++) ps(L,F[1]); assert.equal(ust(L,F[1],'wither'),2); assert.equal(stack(L,'gw'),1,'the same enemy once'); V.step(1); const w=2;
  F[1].hp=F[1].maxHp/2; F[1]._healCutUntil=0; V.heal(F[1],F[1].maxHp); near(F[1].hp/F[1].maxHp,1-0.05*w,'it cannot be healed above its max HP less 1% x 5 per Wither');
  noCrit(L,()=>{ near(outRatio(L,F[1]),(1+0.03*w)*1.05,'Dry Rot: 1% x 3 more per Wither; Garden of Wounds 1% x 5'); near(outRatio(L,F[2]),1.05,'F2: Garden only'); });
  near(lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',crit:true}))/plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',crit:true}))),(1+0.03*w)*1.05*1.10,'Cruel Bloom: crits 2% x 5 more');
  near(hitOn(L,A[0],1000,{src:F[1]})/plainHit(L,()=>hitOn(L,A[0],1000,{src:F[1]})),1-0.03*w,'Withering Gaze: it deals 1% x 3 less per Wither to his allies'); near(inRatio(L,{src:F[1]}),1-0.03*w,'and to him');
  near(F[1].armorRating/ar,1-0.03*w,'Brittle Stems: 1% x 3 armor per Wither'); near(F[1].speed/sp,1-0.03*w,'Wilting: 1% x 3 slower per Wither');
  near(L.T.fn.critP(A_(L),L.T,v,{tgt:F[1]}),0.05,'Cut Flower: 1% x 5 against a Withered enemy'); near(L.T.fn.critP(A_(L),L.T,v,{tgt:F[2]}),0);
  for(let i=0;i<20;i++) ps(L,F[1]); assert.equal(ust(L,F[1],'wither'),5,'max 5');
});

test('Kharos / Root and Stem, Crossed Once, Fallen Bloom',()=>{
  const L=lab(H,S(['wo_1_1','wo_3_1','wo_11_2','wo_9_1']),{foes:5,big:true}), {F}=L;
  ps(L,F[1]); ps(L,F[1]); ps(L,F[1]); assert.equal(ust(L,F[1],'wither'),1); assert.equal(ust(L,F[0],'wither'),1,'Crossed Once: F0 within 2 m of F1 gains one'); assert.equal(ust(L,F[2],'wither'),1,'and F2');
  assert.equal(ust(L,F[3],'wither'),0,'not F3');
  for(let i=0;i<6;i++) ps(L,F[1]); assert.equal(ust(L,F[1],'wither'),3); ps(L,F[1]); assert.equal(F[1]._blStk,0,'Root and Stem: on 3 Withers it ruptures at once'); assert.equal(ust(L,F[1],'wither'),4);
  const w0=ust(L,F[0],'wither'); kill(L,F[1]); assert.equal(ust(L,F[0],'wither'),Math.min(5,w0+4),'Fallen Bloom: its Withers pass to the nearest enemy');
});

test('Kharos / Two Wounds (PICK ONE) and Spreading Rot; Single Cut (PICK ONE) and Clean Line',()=>{
  { const L=lab(H,S(['wo_5_2','wo_6_2']),{foes:3,big:true}), {F}=L;
    ps(L,F[1]); ps(L,F[2]); secs(7); assert.equal(F[1]._blStk,1,'Two Wounds: its stacks on the last 2 enemies do not lapse'); assert.equal(F[2]._blStk,1);
    ps(L,F[0]); secs(6.2); assert.equal(F[1]._blStk,0,'a third enemy: the oldest wound closes'); assert.equal(F[2]._blStk,1,'F2 stays open');
    near(dm(F[2],fakePs(L,F[2])),1.20,'Spreading Rot: its bleeds on the older open wound 4% x 5 harder'); near(dm(F[0],fakePs(L,F[0])),1,'not on the newer');
    ps(L,F[2]); ps(L,F[2]); assert.equal(F[2]._blStk,0,'he comes back: it ruptures'); }
  let r0, s0; plain({foes:3},P=>{ const s=lost(P.F[1],()=>ps(P,P.F[1])); s0=s; ps(P,P.F[1]); r0=lost(P.F[1],()=>ps(P,P.F[1]))-s; });
  { const L=lab(H,S(['wo_5_3','wo_6_3']),{foes:3,big:true}), {F}=L; const s=lost(F[1],()=>ps(L,F[1])); ps(L,F[1]); const r1=lost(F[1],()=>ps(L,F[1]))-s;
    near(s/s0,1,'not its strike'); near(r1/r0,1.25*1.15,'Single Cut: the rupture 25% more; Clean Line 5% x 3'); }
});

test('Kharos / Petals: crits shed them, Full Bloom, Petal Guard, Petal Hoard, Petal Wings, A Petal Each Quarter',()=>{
  const L=lab(H,S(['wo_1_4','wo_3_4','wo_5_4','wo_11_3','wo_6_4','wo_n3']),{foes:2,big:true}), {v,F}=L; const a0=v.dmg, s0=v.speed;
  V.hit(v,F[1],10,{kind:'true'}); assert.equal(stack(L,'petal'),0,'a hit that is not a critical sheds none');
  for(let i=0;i<4;i++) V.hit(v,F[1],10,{kind:'true',crit:true}); assert.equal(stack(L,'petal'),4,'each critical sheds one'); V.step(1); near(v.speed/s0,1,'Petal Wings: not under 5');
  for(let i=0;i<30;i++) V.hit(v,F[1],10,{kind:'true',crit:true}); assert.equal(stack(L,'petal'),20,'up to 10 + 2 x 5 (Full Bloom)'); V.step(1);
  near(inRatio(L,{src:F[0]}),0.80,'Petal Guard: 0.2% x 5 each'); near(v.dmg/a0,1.20,'Petal Hoard: 0.2% x 5 attack each'); near(v.speed/s0,1.06,'Petal Wings: 3% x 2 at 5 or more');
  setStack(L,'petal',0); v.target=F[1]; F[1].hp=0.76*F[1].maxHp; V.step(1); F[1].hp=0.74*F[1].maxHp; V.step(1); assert.equal(stack(L,'petal'),2,'A Petal Each Quarter: his target drops past 75%');
  F[1].hp=0.24*F[1].maxHp; V.step(1); assert.equal(stack(L,'petal'),6,'past 50% and 25% in one step: 2 each');
});

test('Kharos / Orchid Execution: Falling Petals, Petal Storm, Petal Edge, Bridal Bloom, Least Kind, Spinning Pinks',()=>{
  let u0; plain({foes:3},P=>{ u0=lost(P.F[1],()=>ult(P,P.F[1])); });
  { const L=lab(H,S(['wo_1_4','lu_11_3','sh_9_3','wo_9_3']),{foes:3,big:true}), {F}=L; setStack(L,'petal',10);
    near(lost(F[1],()=>ult(L,F[1]))/u0,(1+0.045*10)*1.15*1.15,'Falling Petals 1.5% x 3 per Petal; Petal Edge, Bridal Bloom 3% x 5',1e-4); assert.equal(stack(L,'petal'),0,'it spends them all');
    fakePs(L,F[1]); near(lost(F[1],()=>ult(L,F[1]))/u0,1.15*1.15*1.15,'Least Kind: 3% x 5 on an enemy bleeding from his Petal Sever (no Petals now)',1e-4); }
  { const L=lab(H,S(['wo_9_4']),{foes:3,big:true}), {v,F}=L; setStack(L,'petal',10); const h0=F[0].hp, h2=F[2].hp; ult(L,F[1]); assert.equal(stack(L,'petal'),0,'Petal Storm: it spends them');
    assert.ok(F[0].hp<h0&&F[2].hp<h2,'each Petal cuts an enemy in turn'); const c0=h0-F[0].hp, c2=h2-F[2].hp; near(c2/c0,4/3,'10 cuts over 3 enemies: F2, F0, F1, F2, ... (F2 4, F0 3)',1e-6);
    near(c0/3,0.10*v.dmg*VMX('defMul')(v,F[0],'phys'),'each 10% of his attack (through armor)',1e-4); }
  const C=lab(H,S(['wo_12_4']),{foes:2,big:true}); C.T.s.cur='execute'; near(C.T.fn.critP(A_(C),C.T,C.v,{tgt:C.F[1]}),0.045,'Spinning Pinks: 1.5% x 3 for Orchid Execution'); C.T.s.cur=null; near(C.T.fn.critP(A_(C),C.T,C.v,{tgt:C.F[1]}),0);
});

test('Kharos / Orchid Show and Execution Order: whom Orchid Execution strikes',()=>{
  let u0; plain({foes:4},P=>{ u0=lost(P.F[1],()=>ult(P,P.F[1])); });
  { const L=lab(H,S(['lu_11_2']),{foes:4,big:true}), {F}=L; F[3].hp=F[3].maxHp*0.5; F[0].hp=F[0].maxHp*0.6; V.step(1); const h=F[1].hp, h3=F[3].hp;
    ult(L,F[1]); assert.equal(F[1].hp,h,'not his target'); near((h3-F[3].hp)/u0,2*1.20,'Orchid Show: the lowest-HP Onlooker (F3 at half: x2), 20% more',1e-4); }
  { const L=lab(H,S(['sh_11_2']),{foes:4,big:true}), {F}=L; for(const f of [F[0],F[1],F[3]]) setMk(L,f,'cat',null); F[1].hp=F[1].maxHp*0.3; F[3].hp=F[3].maxHp*0.5; F[0].hp=F[0].maxHp*0.6;
    const h3=F[3].hp, h1=F[1].hp; ult(L,F[2]); assert.ok(F[3].hp<h3,'Execution Order: the lowest-HP Catalogued enemy within 6 m (F3)'); assert.equal(F[1].hp,h1,'F1 (lower, 6.4 m away) is out of reach'); }
});

test('Kharos / The Wound Will Not Close (SIGNATURE)',()=>{
  const L=lab(H,S(['wo_1_1','wo_13_2','wo_1_4']),{foes:3,big:true}), {F}=L;
  for(let i=0;i<12;i++) ps(L,F[1]); assert.equal(ust(L,F[1],'wither'),4); assert.ok(!mark(L,F[1],'nohl'));
  for(let i=0;i<3;i++) ps(L,F[1]); assert.equal(ust(L,F[1],'wither'),5); assert.ok(mark(L,F[1],'nohl'),'5 Withers: it can no longer be healed'); assert.equal(stack(L,'petal'),10,'his Petals full');
  F[1].hp=F[1].maxHp/2; F[1]._healCutUntil=0; const h=F[1].hp; V.heal(F[1],1000); assert.equal(F[1].hp,h,'no healing at all'); near(dm(F[1],psOf(L,F[1])[0]),2,'his Petal Sever bleeds on it twice as hard');
  secs(2); for(let i=0;i<15;i++) ps(L,F[2]); assert.equal(ust(L,F[2],'wither'),5); assert.ok(!mark(L,F[2],'nohl'),'once every 20 s (F2 2 s later)'); secs(18.1); setUst(L,F[0],'wither',4); for(let i=0;i<3;i++) ps(L,F[0]); assert.ok(mark(L,F[0],'nohl'),'again after 20 s');
});

/* ============================== STATS, DEFENCE, CAPS ============================== */
test('Kharos / Light Stem, Quick Stem, Arm-Blades, Wedding Morning, Last Bloom, Arm\'s Length, Sharp Petals, Taken Cutting, Sun-Fed, Wallflower, Shears Closed',()=>{
  { const L=lab(H,S(['lu_2_3','sh_2_3','lu_2_2','lu_9_3','wo_10_1','sh_11_1']),{foes:3,big:true}), {v,F}=L; const s0=VMX('HERO_TYPES').kharos.speed;
    near(v._tal.s.ap.move,1.18,'Light Stem and Quick Stem: 3% x 3 each, added');
    near(outRatio(L,F[1],{auto:true}),1.10,'Arm-Blades: basic attacks 2% x 5 more'); near(outRatio(L,F[1]),1,'not his abilities');
    F[1].hp=F[1].maxHp*0.39; near(outRatio(L,F[1]),1.10,'Wedding Morning: below 40%'); F[1].hp=F[1].maxHp*0.29; near(outRatio(L,F[1]),1.10*1.15,'Last Bloom below 30%');
    near(outRatio(L,F[0]),1.10,'Arm\'s Length: F0 within 2 m'); }
  { const L=lab(H,S(['sh_3_3']),{foes:2,big:true}), {v,F}=L; F[1].armorRating=500; const a=VMX('defMul')(v,F[1],'phys'); const sv=v._wpnArmIgn; v._wpnArmIgn=0.10; const b=VMX('defMul')(v,F[1],'phys'); v._wpnArmIgn=sv;
    const r=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'phys'}))/plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'phys'}))); near(r,b/a,'Sharp Petals: 2% x 5 of its armor ignored'); assert.ok(r>1); }
  { const L=lab(H,S(['sh_10_2','wo_4_3','lu_n3','wo_12_3']),{foes:5,big:true}), {v,F}=L; const a0=v.dmg;
    kill(L,F[0]); V.step(1); near(v.dmg/a0,1.05,'Taken Cutting: 1% x 5 attack an enemy'); kill(L,F[2]); kill(L,F[3]); kill(L,F[4]); V.step(1); near(v.dmg/a0,1.15,'up to 3');
    v.energy=0; V.hit(v,F[1],10,{kind:'true',auto:true,crit:true}); near(v.energy,0.99,'Sun-Fed: a critical basic attack, 3% x 3 of 11 energy'); v.energy=0; V.hit(v,F[1],10,{kind:'true',auto:true}); near(v.energy,0);
    F[1].target=null; v.energy=0; L.T.s.lim['lu_n3#0'].acc=0; secs(3.05); near(v.energy,9,'Wallflower: 1 x 3 energy a second while no enemy attacks him'); F[1].target=v; v.energy=0; secs(2); near(v.energy,0,'not while one does');
    near(lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',crit:true}))/plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',crit:true}))),1,'Shears Closed: F1 was hit already');
    const L2=lab(H,S(['wo_12_3']),{foes:2,big:true}); near(lost(L2.F[1],()=>V.hit(L2.v,L2.F[1],1000,{kind:'true',crit:true}))/plainHit(L2,()=>lost(L2.F[1],()=>V.hit(L2.v,L2.F[1],1000,{kind:'true',crit:true}))),1.10,'his first hit on an enemy: a crit 5% x 2 more');
    near(lost(L2.F[1],()=>V.hit(L2.v,L2.F[1],1000,{kind:'true',crit:true}))/plainHit(L2,()=>lost(L2.F[1],()=>V.hit(L2.v,L2.F[1],1000,{kind:'true',crit:true}))),1,'not the second'); }
});

test('Kharos / Patient Orchid, Measured Distance, Hands Off, Hardy, Hothouse Calm, Unbent, Red on Pink, No Mending',()=>{
  { const L=lab(H,S(['lu_9_2']),{foes:2,big:true}), {F}=L; near(outRatio(L,F[1]),1.15,'Patient Orchid: his first hit after 3 s without attacking 5% x 3 more'); near(outRatio(L,F[1]),1,'not the next');
    secs(2.9); near(outRatio(L,F[1]),1,'not at 2.9 s'); secs(3.05); near(outRatio(L,F[1]),1.15,'at 3 s'); }
  { const L=lab(H,S(['lu_12_3','sh_7_1','wo_4_1']),{foes:3,big:true}), {v,F}=L; v.drT=0;
    near(inRatio(L,{src:F[0]}),0.91,'Measured Distance: 3% x 3 less from a melee enemy'); near(inRatio(L,{src:F[0],auto:true}),0.91*0.95,'Hands Off: 1% x 5 less from its basic attacks');
    F[1].melee=false; near(inRatio(L,{src:F[1],auto:true}),1,'a ranged enemy: neither'); fakePs(L,F[1]); near(inRatio(L,{src:F[1]}),0.925,'Hardy: 1.5% x 5 from an enemy bleeding from him'); F[1].melee=true; }
  { const L=lab(H,S(['lu_n1','sh_5_1']),{foes:2,big:true}), {v,F}=L; v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*0.6,'Hothouse Calm: a slow 8% x 5 weaker');
    let p; plain({foes:2},P=>{ P.v.stunned=0; ccOn(P.F[0],P.v,'stunned',1); p=P.v.stunned; }); const L2=lab(H,S(['sh_5_1']),{foes:2,big:true}); L2.v.stunned=0; ccOn(L2.F[0],L2.v,'stunned',1); near(L2.v.stunned/p,0.8,'Unbent: controls 4% x 5 shorter'); }
  { const L=lab(H,S(['wo_9_2','wo_11_1']),{foes:2,big:true}), {v,F}=L; ps(L,F[1]); const d=psOf(L,F[1])[0]; v.hp=v.maxHp/2; const h=v.hp, f=F[1].hp; secs(1.05);
    near((v.hp-h)/(f-F[1].hp),0.06,'Red on Pink: he heals 2% x 3 of what his Petal Sever bleed dealt',1e-3);
    F[1].hp=F[1].maxHp/2; F[1]._healCutUntil=0; const g=F[1].hp; V.heal(F[1],1000); near(F[1].hp-g,900,'No Mending: 2% x 5 less healing on an enemy bleeding from it'); }
});

test('Kharos: the caps - damage reduction at most 40% (one group), critical chance at most 5% (one group), the regeneration cap',()=>{
  const all=S(['lu_11_1','lu_12_3','lu_6_1','lu_1_1','wo_4_1','wo_6_1','wo_5_4','wo_1_1','sh_n1','sh_4_2','sh_6_1','sh_6_3','sh_7_1','sh_9_2','sh_1_1','sh_1_4','sh_5_3']);
  const L=lab(H,all,{foes:5,big:true}), {v,F}=L; ring(L,F,5); V.step(2); const f=F[0]; assert.ok(L.T.s.onlN>=4,'4 Onlookers or more');
  setStack(L,'petal',10); for(const m of ['rtf','over','cat']) setMk(L,f,m); setUst(L,f,'wither',5); fakePs(L,f); L.T.s.w.behind={t:99,n:1,cdT:0,at:-1,wave:false}; L.T.s.w.sac={t:99,n:1,cdT:0,at:-1,wave:false}; v.drT=0;
  const raw=[0.80,0.91,0.91,0.925,0.95,0.90,0.96,0.88,0.91,0.85,0.95,0.91].reduce((a,b)=>a*b,1); assert.ok(raw<0.5,'the conditions together would take '+(100*(1-raw)).toFixed(0)+'%');
  near(inRatio(L,{src:f,auto:true}),0.60,'together at most 40% off a hit');
  const C=lab(H,S(['wo_1_2','sh_11_3','wo_7_1','sh_1_4','lu_12_2','lu_n2','wo_12_4','lu_1_1']),{foes:2,big:true}); V.step(1);
  assert.equal(C.T.fn.critS(A_(C),C.T),5,'Twin Edges and Counter Edge: 5% in all'); near(C.v.glyphCrit,0.05,'on his critical chance');
  setUst(C,C.F[0],'wither',5); setMk(C,C.F[0],'cat'); setStack(C,'thank',8); C.T.s.cur='execute'; near(C.T.fn.critP(A_(C),C.T,C.v,{tgt:C.F[0]}),0,'no room left for the others'); C.T.s.cur=null;
  const D=lab(H,S(['wo_7_1','sh_1_4','lu_12_2','lu_n2','wo_12_4','lu_1_1']),{foes:2,big:true}); setUst(D,D.F[0],'wither',5); setMk(D,D.F[0],'cat'); setStack(D,'thank',8); D.T.s.cur='execute';
  near(D.T.fn.critP(A_(D),D.T,D.v,{tgt:D.F[0]}),0.05,'the others together at most 5%'); D.T.s.cur=null;
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Kharos: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['lu_1_1','lu_1_4','lu_5_2','wo_1_1','wo_1_4','wo_8_2','wo_4_2','sh_1_1','sh_1_4','sh_13_2','sh_12_2']), TEAM=['vael','sylthaine','vireo','vex','kharos'];
  let on=0, cam=0, psT=0, over=0, cat=0, ups=0, rups=0; const mx={};
  for(const seed of [4,7,11,23]){ const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),seed), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
    let was=false; for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); if(T0.onlN>0) on++; if(s._camOn){ cam++; if(!was) ups++; } was=!!s._camOn;
      for(const f of units().filter(u=>u.team==='enemy')){ if((f.dots||[]).some(d=>d._talO===s.uid&&d._talK==='ps')) psT++; const o=f._talM&&f._talM[s.uid]; if(o&&o.over&&o.over.until>V.now()) over++; if(o&&o.cat) cat++; } }
    rups+=s._tal.s.rups||0; }
  console.log('  live fights: max '+JSON.stringify(mx)+', Onlooker ticks '+on+', camouflage ups '+ups+' ('+cam+' ticks), bleed-ticks his '+psT+', Overreach enemy-ticks '+over+', Catalogued enemy-ticks '+cat+', ruptures '+rups);
  assert.ok(on>0,'real Onlookers'); assert.ok(ups>0,'a real camouflage'); assert.ok(psT>0,'real Petal Sever bleeds made his'); assert.ok(mx.petal>0,'a real critical shed a Petal'); assert.ok(over>0,'a real Overreach'); assert.ok(cat>0,'a real Catalogue');
  determinism(H,TEAM);
});

/* The page sites his talents added (the target pick's aggro hook, Bloomstep's window end: skillTgt / landPre / land, the 'sure' line before the dodge rolls, the
   bound jump and strike): with nothing learned, whole seeded fights with Kharos in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){} return h; }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Kharos: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['kharos','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __khN={bs:0,end:0,ctr:0,hits:0}; var __khD=_doEffectCore, __khJ=bloomstepJump, __khC=_dealDamageCore, __khIn=0;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="kharos"&&type==="evadecounter") __khN.bs++; return __khD.apply(this,arguments); };'+
    'bloomstepJump=function(u,T){ if(u&&u.key==="kharos"){ if(__khIn) __khN.ctr++; else __khN.end++; } return __khJ.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt){ __khIn++; try{ if(src&&src.key==="kharos") __khN.hits++; return __khC.apply(this,arguments); } finally{ __khIn--; } };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__khN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.bs>0&&c.end>0&&c.ctr>0&&c.hits>0,'the fights cast Bloomstep ('+c.bs+'), reached its window end ('+c.end+') and its counter ('+c.ctr+'), and he struck ('+c.hits+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__khD; bloomstepJump=__khJ; _dealDamageCore=__khC;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. His talent reductions are one capped group (40%);
   Bloomstep's own 54.9% is the game's skill slot. Each candidate build is 91 points legal; the most defensive is the one whose worst hit is reduced most. */
const DEF={ lu:['lu_11_1','lu_12_3','lu_6_1','lu_1_1','lu_8_1','lu_12_1','lu_4_1','lu_6_4','lu_10_2','lu_5_2'],
            wo:['wo_4_1','wo_6_1','wo_5_4','wo_3_4','wo_1_1','wo_1_4'],
            sh:['sh_n1','sh_4_2','sh_6_1','sh_6_3','sh_7_1','sh_9_2','sh_4_1','sh_1_4','sh_1_1','sh_5_3','sh_6_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={lu:0,wo:1,sh:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* a still field at skill level 100 (the lab's is 10): Bloomstep's slot is then the game's 54.9% */
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})]),snaps([0,1,2,3,4].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+5*Math.cos(2*Math.PI*i/5)*V.METER; f.y=v.y+5*Math.sin(2*Math.PI*i/5)*V.METER; }); V.step(2); return {v,F,T:v._tal}; }
/* the worst hit on him: every condition of his damage-reduction talents true at once - Bloomstep's slot (54.9%) up, 4 Onlookers near and the attacker one of them
   (Long Look: it attacks him), melee, a basic attack, bleeding from him, at 5 Withers, Overreaching (Reached Too Far), Catalogued, 20 Petals, just after a jump,
   inside Stand and Cut's window. Normal and critical, physical and magic. */
function worstHit(list,kind,crit){ const L=lab100(list), {v,F}=L, f=F[0];
  V.cast(v,'blue',v); v._evadeT=0; v._bloomOn=0; v.maxHp=1e6; v.hp=0.5*v.maxHp; v.shield=0;
  if(L.T){ const s=L.T.s; if(L.T.st.petal) s.k.petal=Object.assign(s.k.petal||{},{n:20,t:99,idle:0}); s.w.behind={t:99,n:1,cdT:0,at:-1,wave:false}; s.w.sac={t:99,n:1,cdT:0,at:-1,wave:false};
    s.onl={}; for(const x of F) s.onl[x.uid]=1; s.onlN=F.length; const m=f._talM||(f._talM={}), o=m[v.uid]||(m[v.uid]={}); for(const k of ['rtf','over','cat']) o[k]={t0:V.now(),until:V.now()+99,v:0}; o['#wither']={v:5,until:Infinity};
    VMX('pushDot')(f,1e-9,99,1,'#8f8fa8',v); const d=f.dots[f.dots.length-1]; d._talO=v.uid; d._talK='ps'; }
  const dg=L.T&&L.T.on.dodge; if(L.T) L.T.on.dodge=undefined;   // a dodge is not damage reduction: his dodge talents are off for this hit
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:true}); if(L.T) L.T.on.dodge=dg; const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Kharos: his most defensive legal 91-point build never takes 95% off a hit, never sits at that ceiling, and is at 85% or more for less than half a fight',()=>{
  const cands=[[['sh','lu'],[61,30]],[['lu','sh'],[61,30]],[['sh','wo'],[61,30]],[['wo','sh'],[61,30]],[['lu','wo'],[61,30]],[['wo','lu'],[61,30]],[['sh'],[91]],[['lu'],[91]],[['wo'],[91]],[['sh','lu','wo'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  /* seeded fights: every hit on him that removed HP or shield, against its size before his defences; and each tick a reference hit (an enemy basic attack from
     whoever attacks him, else the nearest enemy, not a crit): what the skill slot, glyphs, armour / magic resist and his talent group would leave of it */
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="kharos"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="kharos"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys",true):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic",true):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=list=>{ VMX('for(const k in __dr) __dr[k]=0'); const sn=snaps(['vael','sylthaine','vireo','vex','kharos'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>40&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune');
    assert.ok(d.te85<0.5*d.t,'at 85% or more for less than half of his time in the fights ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
