'use strict';
/* Grosk's talents as data on the mechanics layer (talents-mech/grosk.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Grosk, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11). Bodies about 2 m.
   Lab units are HELD (stunned 1e6); his controls land on a unit at level 1 (lv1). Croc Drop's leap is run by hand (land()).
   Run: node --test tests/talents-mech-grosk.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='grosk', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur,v)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:v==null?0:v}; };
const ust=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&m.until>V.now())?m.v:0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const lv1=(...xs)=>{ for(const x of xs) x.level=1; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage)
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const clk=(L,key)=>{ const l=L.T.s.lim[key]; if(l) l.acc=0; };                        // a periodic row's clock starts again now
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };   // a control that lands (no resist)
/* a hit of his while a skill (or a punch) of his resolves, against the same hit with his talents off */
function ratio(L,t,cur,o){ o=o||{}; const s=L.T.s, c0=s.cur; s.cur=cur; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o))); } finally{ s.cur=c0; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o)))); }
/* Croc Drop's leap, landed now: he stands where it lands and its slam runs (the engine runs it at the end of the 1.345 s dash) */
function land(v){ const d=v._dash; assert.ok(d&&d.air,'a Croc Drop leap is under way'); v.x=d.x1; v.y=d.y1; v._dash=null; d.run(); }
const MW=lv=>VMX('SKLV').mirewall(lv);
const WALL=lv=>VMX('skLvNum')('hipposlam',VMX('ULT_DEF').hipposlam,lv);
const ev=(L,name)=>{ const q=L.T.s.roll.ut; if(!q) return 0; let n=0; for(const e of q.e) if(e[0]>V.now()-q.span) n+=e[1]; return n; };   // Undertow now (before its cap)

test('Grosk: every talent is accounted for - 10 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[122,10,112,0,0]);
  const M=FXN.mech(H); for(const id of ['sh_1_1','oj_1_1','mw_1_1','sh_13_2','oj_13_3','mw_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['sh_1_3','sh_3_3','sh_n1','oj_2_2','oj_7_2','oj_3_2','oj_1_2','mw_2_3','mw_3_3','mw_12_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  near(FXN.totals(H,[['oj_3_2',5]]).crit,0.03,'Bruiser\'s Edge: 0.6% x 5 (with Death Roll\'s 2%, his crit chance talents are 5% in all)');
});

test('Grosk: his real kit, as the talents read it - Gravemaw Pull, Hammer Fists, Croc Drop, The Mirewall',()=>{
  plain({foes:3,allies:1},P=>{ const {v,F}=P; lv1(...F);
    V.cast(v,'green'); near(F[0].silencedT,2*V.ccNerf,'Gravemaw Pull silences every enemy within 5 m of him 2 s x 0.7 = 1.4 s',1e-9); assert.equal(F[0].forcedTarget,v,'taunts it');
    assert.ok(F[0].forcedTargetT>=2-1e-9&&F[0].forcedTargetT<=3+1e-9,'for 2 s (not cut): '+F[0].forcedTargetT); assert.equal(F[0].pulledBy,v,'and drags it in'); near(F[1].silencedT||0,0,'not an enemy 10 m away'); });
  plain({foes:3},P=>{ const {v,F}=P; lv1(...F); let n=0, mx=0, tm=0, last=F[1].hp;
    V.cast(v,'blue',F[1]); for(let i=0;i<70;i++){ V.step(1); if(F[1].hp<last-1e-9){ n++; last=F[1].hp; } mx=Math.max(mx,F[1].silencedT||0); tm=Math.max(tm,F[1].forcedTargetT||0); }
    assert.equal(n,3,'Hammer Fists: three punches at its target'); assert.ok(mx>3.5-3*V.STEP&&mx<=3.5+1e-9,'each silences it: the control table\'s single taunt (5 s) x 0.7 = 3.5 s (not 1.4 s): '+mx);
    assert.ok(tm>5-3*V.STEP&&tm<=6+1e-9,'and taunts it 5 s: '+tm); console.log('  kit: Hammer Fists silence '+mx.toFixed(3)+' s, taunt '+tm.toFixed(3)+' s'); });
  plain({foes:3,allies:1},P=>{ const {v,F,A}=P; lv1(...F); const h=F.map(f=>f.hp);
    V.cast(v,'ult'); const d=v._dash; near(Math.hypot(d.x1-F[0].x,d.y1-F[0].y),0,'Croc Drop, unaimed: onto the densest group within 6 m',1e-6); F[0].stunned=0; land(v);
    assert.ok(F[0].hp<h[0],'its slam'); near(F[1].hp,h[1],'not 5.5 m from where it lands'); near(F[0].stunned,2.0*V.ccNerf,'a stun of the control table\'s area 2.0 s x 0.7 = 1.4 s (ULT_DEF says 0.6)',1e-9);
    for(const a of [v,A[0]]){ near(a._mwDrT,3,'the Wall on every ally (him too) for 3 s'); near(a._mwDrPct,WALL(10),'20% + 0.15/99 a level'); }
    console.log('  kit: Croc Drop stun '+F[0].stunned.toFixed(3)+' s, Wall '+(WALL(100)*100).toFixed(1)+'% at level 100'); });
  plain({foes:3,allies:2},P=>{ const {v,F,A}=P; A[1].hp=A[1].maxHp*0.5; V.step(1); assert.equal(v._mwWard,A[1],'The Mirewall: his ward is the ally with the least HP'); assert.equal(A[1]._mwBy,v);
    v.hp=v.maxHp*0.5; const hv=v.hp, m=MW(10); near(hitOn(P,A[1],1000),1000*(1-m),'the ward takes 20% + 0.15/99 a level less'); near(hv-v.hp,1000*m*0.35*0.5,'he takes 35% of the cut and heals back half of it',1e-6);
    near(hitOn(P,A[0],1000),1000,'not another ally'); });
});

/* ============================== THE SUNKFEN HOLD ============================== */
test('Grosk / Depth: Set Feet, Bedrock, Grounded Blows, Settled; moving costs it',()=>{
  const L=lab(H,S(['sh_1_1','sh_4_1','sh_11_1','sh_8_1']),{foes:3,cold:true}), {v}=L; const mr0=v.mrRating, a0=v.dmg; V.step(1);
  secs(3.05); assert.equal(stack(L,'depth'),3,'1 Depth for each second he stands still'); secs(8); assert.equal(stack(L,'depth'),10,'at most 10'); V.step(1);
  near(hitOn(L,v,100),plainHit(L,()=>hitOn(L,v,100))*(1-0.015*10),'Set Feet: 0.3% x 5 damage reduction per Depth');
  near(v.mrRating,mr0*1.10,'Bedrock: 0.2% x 5 magic resist per Depth'); near(v.dmg,a0*1.10,'Grounded Blows: 0.2% x 5 attack per Depth');
  v._airT=99; L.T.s.dl=0; secs(2.05); assert.equal(stack(L,'depth'),8,'moving (here knocked up): Settled 10% x 5 slower, 1 a second'); v._airT=0;
  const L2=lab(H,S(['sh_1_1']),{foes:3}); setStack(L2,'depth',10); L2.v._airT=99; L2.T.s.dl=0; secs(1.02); assert.equal(stack(L2,'depth'),8,'2 a second without Settled'); L2.v._airT=0;
  L2.v.pullT=5; L2.v.pulledBy={x:L2.v.x+1e4,y:L2.v.y,alive:true}; L2.T.s.dl=0; secs(0.52); assert.equal(stack(L2,'depth'),7,'being dragged is moving too');
});

test('Grosk / Depth: Deep Mud, Waterline, Sunk to the Knees, Moss Grown, Patient Stone',()=>{
  const L=lab(H,S(['sh_1_1','sh_2_1','sh_12_1','sh_6_1','sh_7_1','sh_10_1']),{foes:3}), {v,F}=L;
  assert.equal(stack(L,'depth'),6,'Waterline: the wave starts with 2 x 3 Depth'); setStack(L,'depth',0); L.T.s.da=0; secs(4.05); assert.equal(stack(L,'depth'),7,'Deep Mud: 25% x 3 faster (1.75 a second)');
  setStack(L,'depth',4); near(ratio(L,F[1],null,{auto:true}),1,'Sunk to the Knees: not below 5 Depth'); setStack(L,'depth',5); near(ratio(L,F[1],null,{auto:true}),1.12,'at 5: basic attacks 4% x 3 more'); near(ratio(L,F[1],null),1,'not his skills');
  setStack(L,'depth',10); v.hp=v.maxHp*0.5; v.greenCd=10; clk(L,'sh_7_1#0'); clk(L,'sh_10_1#0'); const h=v.hp; secs(1.05);
  near(v.hp-h,v.maxHp*0.012,'Moss Grown: at 10 Depth 0.24% x 5 of his max HP a second (1.2%: the regeneration cap)',1e-6); near(v.greenCd,10-0.5,'Patient Stone: 0.1 x 5 s off Gravemaw Pull each second at 10 Depth',1e-9);
  setStack(L,'depth',9); L.T.s.da=0; const h2=v.hp; clk(L,'sh_7_1#0'); secs(0.5); near(v.hp,h2,'not below 10');
});

test('Grosk / Bog Body: at 10 Depth, allies within 4 m of him take 1% x 5 less',()=>{
  const L=lab(H,S(['sh_12_2']),{foes:3,allies:2,big:true}), {A}=L; setStack(L,'depth',10);
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.95,'an ally 5.5 m away (about 1.5 m body to body)'); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000)),'not one 11 m away');
  setStack(L,'depth',9); L.T.s.da=0; near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000)),'not below 10 Depth');
});

test('Grosk / Depth and Croc Drop: the leap empties it, Plant Again keeps some, The Fen Holds gives 10 and Mires the stunned',()=>{
  { const L=lab(H,S(['sh_1_1']),{foes:3}), {v}=L; setStack(L,'depth',10); V.cast(v,'ult'); assert.equal(stack(L,'depth'),0,'the leap lifts him out of all of it'); }
  const L=lab(H,S(['sh_1_1','sh_9_1','sh_11_2','sh_2_2']),{foes:3}), {v,F}=L; lv1(...F); setStack(L,'depth',10);
  V.cast(v,'ult'); assert.equal(stack(L,'depth'),5,'Plant Again: 10% x 5 of it kept (at most half)'); V.step(5); assert.equal(stack(L,'depth'),5,'held while he is in the air');
  F[0].stunned=0; land(v); assert.equal(stack(L,'depth'),10,'The Fen Holds: 10 Depth on landing'); assert.ok(mark(L,F[0],'mired'),'every enemy the landing stunned is Mired'); assert.ok(!mark(L,F[1],'mired'),'');
});

test('Grosk / Rooted Like a Cypress and the controls on him: Unmired, Thick Neck, Thick Skull (all together at most 50% shorter)',()=>{
  const L=lab(H,S(['sh_1_1','sh_3_1','sh_5_1','sh_12_3','oj_12_2']),{foes:3}), {v,F}=L; setStack(L,'depth',10); V.step(1);
  assert.ok(v._gearImmovableT>0,'at 10 Depth he cannot be knocked up, pushed or pulled');
  v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.5,'a stun at 10 Depth: half as long; with Unmired 0.8 x 0.5 is cut at 50%',1e-9); V.step(1); assert.equal(stack(L,'depth'),5,'once it has landed it costs 5 Depth');
  v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.8,'at 5 Depth: Unmired 4% x 5 only',1e-9);
  v.silencedT=0; ccOn(F[0],v,'silencedT',1); near(v.silencedT,V.ccNerf*0.5,'a silence: 0.8 x 0.7 x 0.8 is cut at 50%',1e-9);
  v.slow=0; ccOn(F[0],v,'slow',1); near(v.slow,V.ccNerf*0.8,'a slow: Unmired',1e-9); v.stunned=1e6;
  const L2=lab(H,S(['sh_1_1','sh_3_1']),{foes:3}); setStack(L2,'depth',9); L2.T.s.da=0; L2.v.stunned=0; ccOn(L2.F[0],L2.v,'stunned',1); near(L2.v.stunned,V.ccNerf,'below 10 Depth: not',1e-9); L2.v.stunned=1e6;
});

test('Grosk / Refusal: Will Not Go Down, Stubborn Count, Spite of the Small, Hard to Swallow, Still Here',()=>{
  const L=lab(H,S(['sh_1_4','sh_3_4','sh_10_4','sh_12_4','sh_7_4']),{foes:3}), {v,F}=L; const a0=v.dmg, mh=v.maxHp;
  V.hit(F[0],v,mh*0.07,{kind:'true'}); assert.equal(stack(L,'ref'),0,'a hit of 7% of his max HP: no Refusal');
  const h=v.hp; V.hit(F[0],v,mh*0.09,{kind:'true'}); assert.equal(stack(L,'ref'),1,'he survived a hit of more than 8%: a Refusal'); near(v.hp,h-mh*0.09+mh*0.05,'Spite of the Small: he heals 1% x 5 of his max HP',1e-6);
  V.step(1); near(v.dmg,a0*1.03,'Will Not Go Down: 1% x 3 attack per Refusal'); near(hitOn(L,v,10),plainHit(L,()=>hitOn(L,v,10))*0.98,'Stubborn Count: 0.4% x 5 damage reduction per Refusal');
  for(let i=0;i<3;i++) V.hit(F[0],v,mh*0.09,{kind:'true'}); assert.equal(stack(L,'ref'),4,''); v.silencedT=5;
  V.hit(F[0],v,mh*0.09,{kind:'true'}); assert.equal(stack(L,'ref'),5,'at most 5'); assert.equal(v.stunned,0,'Hard to Swallow: at 5 every control on him is cleansed'); assert.equal(v.silencedT,0,''); v.stunned=1e6;
  v.hp=mh; setStack(L,'ref',4); v.silencedT=5; V.hit(F[0],v,mh*0.09,{kind:'true'}); assert.equal(v.silencedT,0,'twice a wave at 2 ranks'); v.stunned=1e6;
  v.hp=mh; setStack(L,'ref',4); v.silencedT=5; V.hit(F[0],v,mh*0.09,{kind:'true'}); assert.equal(v.silencedT,5,'not a third time'); assert.equal(v.stunned,1e6,'');
  V.wave(); V.step(1); assert.equal(stack(L,'ref'),3,'Still Here: a new wave keeps 1 x 3 of them'); v.hp=mh; setStack(L,'ref',4); v.silencedT=5; V.hit(F[0],v,mh*0.09,{kind:'true'}); assert.equal(v.silencedT,0,'and Hard to Swallow is back'); v.stunned=1e6;
  const L2=lab(H,S(['sh_1_4']),{foes:3}); V.wave(); V.step(1); setStack(L2,'ref',4); V.wave(); V.step(1); assert.equal(stack(L2,'ref'),0,'without Still Here: none');
});

test('Grosk / Last One Standing and Not This Morning',()=>{
  { const L=lab(H,S(['sh_1_4','sh_5_4']),{foes:3}), {v,F}=L; V.hit(F[0],v,v.maxHp*0.035,{kind:'true'}); assert.equal(stack(L,'ref'),1,'Last One Standing: a hit of more than 8 - 1 x 5 = 3% is enough'); }
  const L=lab(H,S(['sh_9_4','sh_1_4']),{foes:3}), {v,F}=L; const mh=v.maxHp; v.hp=mh*0.25;
  near(lost(v,()=>V.hit(F[0],v,mh*0.10,{kind:'true'})),mh*0.05,'Not This Morning: a hit that would drop him below 20% is halved',1e-6); assert.equal(stack(L,'ref'),3,'and gives him 3 Refusal at once');
  v.hp=mh*0.25; near(lost(v,()=>V.hit(F[0],v,mh*0.10,{kind:'true'})),mh*0.10,'once per wave',1e-6);
  V.wave(); V.step(1); v.hp=mh*0.25; near(lost(v,()=>V.hit(F[0],v,mh*0.10,{kind:'true'})),mh*0.05,'again the next wave',1e-6);
});

test('Grosk / Mired: Mire Them, Sucking Mud, Clinging Mud, Dragged Under, Grip of the Fen (Gravemaw Pull and Hammer Fists taunt it)',()=>{
  const L=lab(H,S(['sh_2_2','sh_4_2','sh_6_2','sh_10_2']),{foes:3,allies:1,big:true}), {v,F,A}=L; lv1(...F); for(const f of F) f.speed=100;
  V.cast(v,'green'); assert.ok(mark(L,F[0],'mired'),'every enemy Gravemaw Pull caught (and taunted) is Mired'); assert.ok(!mark(L,F[1],'mired'),'not one out of its reach');
  V.step(1); near(F[0].speed,85,'Mire Them: it moves 3% x 5 slower'); near(F[1].speed,100,'');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.95,'its attacks on him deal 1% x 5 less');
  near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]}))*(1-0.075),'Clinging Mud: and 1.5% x 5 less on his allies');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.05,'Dragged Under: it takes 1% x 5 more from his team');
  near(ratio(L,F[0],null),1.05,'him too'); near(ratio(L,F[1],null),1,'');
  secs(4.4); assert.ok(mark(L,F[0],'mired'),'Sucking Mud: 3 + 0.5 x 3 s'); secs(0.2); assert.ok(!mark(L,F[0],'mired'),'');
  const L2=lab(H,S(['sh_2_2','sh_8_2']),{foes:3,big:true}); lv1(...L2.F); V.cast(L2.v,'blue',L2.F[1]); secs(0.3); assert.ok(mark(L2,L2.F[1],'mired'),'each enemy a Hammer Fists punch taunts is Mired');
  near(ratio(L2,L2.F[1],'punch'),1.15,'Grip of the Fen: punches on a Mired enemy 3% x 5 more'); near(ratio(L2,L2.F[0],'punch'),1,'not on one that is not'); near(ratio(L2,L2.F[1],null),1,'only punches');
});

test('Grosk / Swallowed Whole, Spit Out, Far Spit',()=>{
  const dash=(f,dx,dy)=>{ f._dash={x0:f.x,y0:f.y,x1:f.x+dx*V.METER,y1:f.y+(dy||0)*V.METER,t:0,dur:0.3,run:function(){}}; V.step(4); f.x+=dx*V.METER; f.y+=(dy||0)*V.METER; f._dash=null; f.pulledBy=null; V.step(4); return f; };
  { const L=lab(H,S(['sh_5_2']),{foes:3}), {F}=L; setMk(L,F[1],'mired',30); const x0=F[1].x, y0=F[1].y; dash(F[1],0,6);
    assert.ok(F[1].pulledBy&&Math.abs(F[1].pulledBy.x-x0)<1e-6&&Math.abs(F[1].pulledBy.y-y0)<1e-6,'Swallowed Whole: a Mired enemy\'s dash ends dragged back to where it began'); near(F[1].pullStop,0,'all the way',1e-9);
    dash(F[2],0,6); assert.ok(!F[2].pulledBy,'not an enemy that is not Mired'); }
  const L=lab(H,S(['sh_5_3','sh_6_3']),{foes:4}), {F}=L; setMk(L,F[0],'mired',30); kill(L,F[0]);
  assert.ok(mark(L,F[3],'mired'),'Spit Out: its Mire passes to the enemy nearest Grosk (F3, 6 m)'); assert.ok(!mark(L,F[1],'mired'),''); near(F[3]._talM[L.v.uid].mired.until-V.now(),3+3,'Far Spit: with 3 + 1 x 3 s on it',1e-6);
});

test('Grosk / Gravemaw Pull: Long Silence, Gravemaw Hunger',()=>{
  const L=lab(H,S(['sh_4_3','oj_5_1']),{foes:4}), {v,F}=L; lv1(...F); at(L,F[3],0,5.8);
  V.cast(v,'green'); near(F[0].silencedT,1.4+0.6,'Long Silence: 0.2 x 3 s longer, in full',1e-9); assert.ok(F[3].silencedT>1,'Gravemaw Hunger: it reaches 0.2 x 5 m farther (an enemy 5.8 m away)'); near(F[1].silencedT||0,0,'');
  const P=lab(H,null,{foes:4}); lv1(...P.F); at(P,P.F[3],0,5.8); V.cast(P.v,'green'); near(P.F[3].silencedT||0,0,'(5.8 m is out of its plain reach)');
});

test('Grosk / Croc Drop: Hard Landing, Bad Morning, Rolling Weight, The Jaws Close, Wall of Teeth, Wet Season',()=>{
  const L=lab(H,S(['sh_7_3','sh_6_4','oj_10_3','oj_11_3','mw_7_3','mw_11_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; lv1(...F);
  const clr=t=>{ if(t._talM) delete t._talM[v.uid]; };   // a hit while Croc Drop resolves gives 3 Bite Marks (The Jaws Close): the next measure starts clean
  near(ratio(L,F[1],'hipposlam'),1.15,'Hard Landing: 3% x 5 (before any Croc Drop: Bad Morning not yet)'); clr(F[1]);
  V.cast(v,'ult'); near(ratio(L,F[1],'hipposlam'),1.15*1.20,'Bad Morning: the first Croc Drop of the fight 10% x 2 more'); clr(F[1]);
  land(v); assert.equal(ust(L,F[0],'bite'),3,'The Jaws Close: every enemy it hits gets 3 Bite Marks'); assert.equal(ust(L,F[1],'bite'),0,''); assert.ok(mark(L,F[0],'roll'),'and the enemy nearest the landing is caught in a Death Roll');
  near(ratio(L,F[0],'hipposlam'),1.15*1.20*1.12,'Rolling Weight: 4% x 3 more on a rolled enemy (or one with 3 Bite Marks)');
  for(const a of [v,A[0]]){ near(a._mwDrT,3+1,'Wall of Teeth: the Wall 0.2 x 5 s longer'); near(a._mwDrPct,WALL(10)*1.05,'Wet Season: 1% x 5 stronger'); }
  clr(F[1]); V.cast(v,'ult'); near(ratio(L,F[1],'hipposlam'),1.15,'Bad Morning: only the first');
});

test('Grosk / Down Beside Them: unaimed, beside a ward below 50%, and a further 10% less there under the Wall',()=>{
  { const L=lab(H,S(['mw_7_1']),{foes:3,allies:1,big:true}), {v,A,F}=L; A[0].hp=A[0].maxHp*0.4; V.step(1); assert.equal(v._mwWard,A[0]);
    V.cast(v,'ult'); const d=v._dash; near(Math.hypot(d.x1-A[0].x,d.y1-A[0].y),0,'it lands beside the ward',1e-6); land(v); assert.ok(mark(L,A[0],'dbt'),'');
    near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.90,'while the Wall is on the ward it takes 10% less'); secs(3.1); near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000)),'as long as the Wall'); }
  const L=lab(H,S(['mw_7_1']),{foes:3,allies:1,big:true}), {v,A,F}=L; A[0].hp=A[0].maxHp*0.6; V.step(1); V.cast(L.v,'ult'); near(Math.hypot(v._dash.x1-F[0].x,v._dash.y1-F[0].y),0,'the ward above 50%: as before',1e-6);
});

test('Grosk / The Morning He Would Not Go Down (SIGNATURE)',()=>{
  const L=lab(H,S(['sh_13_2','sh_1_1','sh_1_4']),{foes:3}), {v,F}=L; const mh=v.maxHp;
  v.hp=10; V.hit(F[0],v,1e9,{kind:'true'}); assert.ok(v.alive,'when he would fall he refuses'); near(v.hp,1,'at 1 HP'); assert.equal(stack(L,'depth'),10,'with 10 Depth'); assert.equal(stack(L,'ref'),5,'and 5 Refusal');
  assert.equal(F[0].forcedTarget,v,'every enemy within 5 m is taunted onto him'); assert.ok(mark(L,F[0],'mired'),'and Mired'); assert.ok(F[1].forcedTarget!==v&&!mark(L,F[1],'mired'),'not one farther');
  const h=v.hp; V.hit(F[0],v,1000,{kind:'true'}); near(v.hp,h+500,'every hit in those 3 s heals him for half of it instead',1e-6);
  secs(3.1); near(v.hp,0.3*mh,'when the 3 s end he is healed to 30%',1e-6);
  V.hit(F[0],v,1e9,{kind:'true'}); assert.ok(!v.alive,'once per fight');
});

/* ============================== THE OLD JAWS ============================== */
test('Grosk / Gulp: Gulp, Big Swallow, Digestion, Second Helping, Full Belly, Open Mouth',()=>{
  const L=lab(H,S(['oj_1_1','oj_3_1','oj_10_1','oj_12_1','oj_7_1','oj_6_1']),{foes:4}), {v,F}=L; at(L,F[1],3,3.5);
  assert.equal(stack(L,'gulp'),2,'Open Mouth: the wave starts with 1 x 2 Gulp'); setStack(L,'gulp',0);
  V.cast(v,'green'); assert.equal(stack(L,'gulp'),2,'each enemy Gravemaw Pull catches gives 1 Gulp');
  near(hitOn(L,v,10),plainHit(L,()=>hitOn(L,v,10)),'Full Belly: not below 3'); setStack(L,'gulp',3); near(hitOn(L,v,10),plainHit(L,()=>hitOn(L,v,10))*0.95,'Full Belly: with 3 or more Gulp 1% x 5 less');
  setStack(L,'gulp',5); v.hp=v.maxHp*0.5; v.blueCd=6; const h=v.hp; V.cast(v,'blue',F[2]);
  near(v.hp-h,v.maxHp*0.003*5*5,'Big Swallow: it spends every Gulp and heals 0.3% x 5 per Gulp',1e-6); near(v.blueCd,6-0.5*5,'Digestion: 0.1 x 5 s off its cooldown per Gulp',1e-9);
  assert.equal(stack(L,'gulp'),3,'Second Helping: after 5 Gulp spent, 1 x 3 at once'); near(ratio(L,F[2],'punch'),1+0.09*5,'its punches 3% x 3 more per Gulp spent'); near(ratio(L,F[2],null),1,'not his other hits');
  setStack(L,'gulp',2); V.cast(v,'blue',F[2]); assert.equal(stack(L,'gulp'),0,'not after 2'); near(ratio(L,F[2],'punch'),1.18,'');
});

test('Grosk / Swallow the Voice: a Gulp for each enemy Gravemaw Pull silences; 5 Gulp spent silences 1 s longer',()=>{
  const L=lab(H,S(['oj_9_1']),{foes:3}), {v,F}=L; lv1(...F); V.cast(v,'green'); assert.equal(stack(L,'gulp'),2,'F0 caught and silenced: 2 Gulp');
  setStack(L,'gulp',5); V.cast(v,'blue',F[1]); secs(0.2); assert.ok(F[1].silencedT>4-5*V.STEP&&F[1].silencedT<=4+1e-9,'a Hammer Fists spent with 5 Gulp: its silence 1 s longer, at most 4 s: '+F[1].silencedT);
  setStack(L,'gulp',4); F[2].silencedT=0; V.cast(v,'blue',F[2]); secs(0.2); assert.ok(F[2].silencedT<=3.5+1e-9,'with 4: not');
});

test('Grosk / Bite Marks: Bite Marks, Teeth Sink In, Many Teeth, Old Scars, Bone Breaker',()=>{
  const L=lab(H,S(['oj_1_4','oj_2_4','oj_10_4','oj_6_4','oj_11_2']),{foes:3,big:true}), {v,F}=L; const i0=F[1].atkInterval, ar=F[1].armorRating;
  V.cast(v,'blue',F[1]); secs(1.4); assert.equal(ust(L,F[1],'bite'),3,'each Hammer Fists punch leaves a Bite Mark'); near(ratio(L,F[1],null),1+0.025*3,'Bite Marks: his hits 0.5% x 5 more per mark'); near(ratio(L,F[0],null),1,'');
  V.step(1); near(F[1].atkInterval,i0/(1-0.015*3),'Many Teeth: each mark 0.3% x 5 slower attacks');
  F[1].hp=F[1].maxHp*0.5; const g=F[1].hp; V.heal(F[1],1000); near(F[1].hp-g,1000*(1-0.12),'Old Scars: with 3 marks it receives 4% x 3 less healing',1e-6);
  V.hit(v,F[1],10,{kind:'true',crit:true}); assert.equal(ust(L,F[1],'bite'),4,'each critical hit leaves one too'); assert.ok(mark(L,F[1],'bb'),'Bone Breaker'); V.step(1); near(F[1].armorRating,ar*0.95,'its armor 1% x 5 lower');
  secs(3.1); near(F[1].armorRating,ar,'for 3 s'); secs(10.2); assert.equal(ust(L,F[1],'bite'),4,'Teeth Sink In: the marks last 8 + 2 x 3 s'); secs(0.8); assert.equal(ust(L,F[1],'bite'),0,'');
});

test('Grosk / Locked Jaw, Fresh Wounds, Gnaw, Feeding Frenzy',()=>{
  { const L=lab(H,S(['oj_1_4','oj_3_4']),{foes:3,big:true}), {v,F}=L; F[1].speed=100; for(let i=0;i<5;i++) V.hit(v,F[1],10,{kind:'true',crit:true}); assert.equal(ust(L,F[1],'bite'),5,'');
    V.hit(v,F[1],10,{kind:'true',crit:true}); assert.equal(ust(L,F[1],'bite'),3,'Locked Jaw: at 6 marks they drop to 3'); assert.ok(mark(L,F[1],'lj'),'and it is rooted'); V.step(1); near(F[1].speed,0,'it cannot move'); secs(1.0); near(F[1].speed,100,'for 1 s'); }
  { const L=lab(H,S(['oj_4_4']),{foes:3,big:true}), {v,F}=L; let n=0; for(let i=0;i<60;i++){ const a=ust(L,F[1],'bite'); V.hit(v,F[1],1,{kind:'true',auto:true}); if(ust(L,F[1],'bite')>a) n++; L.F[1]._talM[v.uid]['#bite']={v:0,until:0}; }
    assert.ok(n>=6&&n<=30,'Fresh Wounds: a 6% x 5 chance on a basic attack ('+n+' of 60)'); const b=ust(L,F[1],'bite'); V.hit(v,F[1],1,{kind:'true'}); assert.equal(ust(L,F[1],'bite'),b,'not a skill'); }
  { const L=lab(H,S(['oj_1_4','oj_7_4']),{foes:3}), {v,F}=L; v.hp=v.maxHp*0.5; const h=v.hp; V.hit(v,F[1],1,{kind:'true',auto:true}); near(v.hp,h,'Gnaw: not on a target with no mark',1e-9);
    V.hit(v,F[1],1,{kind:'true',crit:true}); const h2=v.hp; V.hit(v,F[1],1,{kind:'true',auto:true}); near(v.hp-h2,v.maxHp*0.012,'Gnaw: a basic attack on a marked target heals 0.4% x 3',1e-6);
    V.hit(v,F[1],1,{kind:'true',auto:true}); near(v.hp-h2,v.maxHp*0.012,'at most once a second',1e-6); secs(1.05); V.hit(v,F[1],1,{kind:'true',auto:true}); near(v.hp-h2,v.maxHp*0.024,'',1e-6); }
  const L=lab(H,S(['oj_1_4','oj_11_4']),{foes:3,big:true}), {v,F}=L; for(let i=0;i<4;i++) V.hit(v,F[1],1,{kind:'true',crit:true}); kill(L,F[1]);
  assert.equal(ust(L,F[0],'bite'),4,'Feeding Frenzy: when it dies 1 x 5 of its marks (4) jump to the nearest enemy'); assert.equal(ust(L,F[2],'bite'),0,'');
});

test('Grosk / Death Roll: Death Roll, Long Roll, Twist the Body, Down to the Mud, Fed Well',()=>{
  const L=lab(H,S(['oj_2_3','oj_4_3','oj_6_3','oj_12_3','oj_12_4']),{foes:3,allies:1}), {v,F,A}=L; F[1].maxHp=F[1].hp=1e9; const ar=F[1].armorRating;
  V.cast(v,'blue',F[1]); secs(0.9); assert.ok(!mark(L,F[1],'roll'),'not after two punches'); secs(0.5); assert.ok(mark(L,F[1],'roll'),'all three punches landed on it: a Death Roll');
  V.step(1); near(F[1].armorRating,ar*0.85,'its armor 3% x 5 lower'); near(ratio(L,F[1],null),1.10*1.075,'Twist the Body 2% x 5 from him; Down to the Mud 1.5% x 5 from his whole team');
  near(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})),plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})))*1.075,'an ally\'s hit');
  secs(4.2); assert.ok(mark(L,F[1],'roll'),'Long Roll: 3 + 0.5 x 3 s'); secs(0.4); assert.ok(!mark(L,F[1],'roll'),'');
  V.cast(v,'blue',F[2]); secs(1.4); v.hp=v.maxHp*0.5; const h=v.hp; kill(L,F[2]); near(v.hp-h,v.maxHp*0.06,'Fed Well: an enemy in a Death Roll dies: he heals 2% x 3',1e-6);
});

test('Grosk / Death Roll\'s crit chance: 0.4% x 5 more against it (a seeded roll of its own), with Bruiser\'s Edge 5% in all',()=>{
  const L=lab(H,S(['oj_2_3']),{foes:3,big:true}), {v,F}=L; setMk(L,F[1],'roll',1e9); let n=0; const b=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],100,{kind:'true'})));
  for(let i=0;i<2500;i++) if(lost(F[1],()=>V.hit(v,F[1],100,{kind:'true'}))>b*1.3) n++;
  assert.ok(n>=20&&n<=85,'about 2% of hits on a rolled enemy are critical ('+n+' of 2500)'); let m=0; for(let i=0;i<300;i++) if(lost(F[0],()=>V.hit(v,F[0],100,{kind:'true'}))>b*1.3) m++; assert.equal(m,0,'not on one that is not rolled');
});

test('Grosk / Spin Them Loose and Thrown Clear; Drag to the Deep',()=>{
  { const L=lab(H,S(['oj_2_3','oj_5_2','oj_6_2']),{foes:3,big:true}), {v,F}=L; F[1].speed=0; V.cast(v,'blue',F[1]); secs(1.4); assert.ok(mark(L,F[1],'roll'),''); F[1].stunned=0;
    let st=-1, pb=null; for(let i=0;i<200&&st<0;i++){ V.step(1); if(!mark(L,F[1],'roll')){ st=F[1].stunned; pb=F[1].pulledBy; } }
    assert.ok(st>0.95-2*V.STEP&&st<=0.95+1e-9,'when the Death Roll ends it is stunned 0.5 + 0.15 x 3 s, in full: '+st); assert.ok(pb&&pb.x>F[1].x-1e-6,'and thrown away from him'); }
  const L=lab(H,S(['oj_2_3','oj_4_3','oj_5_3']),{foes:3,big:true}), {v,F}=L; V.cast(v,'blue',F[1]); for(let i=0;i<80&&!mark(L,F[1],'roll');i++) V.step(1);
  assert.ok(F[1].silencedT>4-2*V.STEP&&F[1].silencedT<=4+1e-9,'Drag to the Deep: silenced for the whole Roll, at most 4 s: '+F[1].silencedT);
});

test('Grosk / Three Bites: a punch whose target fell goes to the nearest enemy within 2 m, and the third punch always starts a Death Roll',()=>{
  const L=lab(H,S(['oj_2_3','oj_7_3']),{foes:4,big:true}), {v,F}=L; at(L,F[3],4.5,4.2); const h=F[3].hp;
  V.cast(v,'blue',F[0]); secs(0.3); kill(L,F[0]); secs(1.2); assert.ok(F[3].hp<h,'the next punches go to F3 (beside it)'); assert.ok(mark(L,F[3],'roll'),'the third punch starts a Death Roll on it');
  const P=lab(H,S(['oj_2_3']),{foes:4,big:true}); at(P,P.F[3],4.5,4.2); const h2=P.F[3].hp; V.cast(P.v,'blue',P.F[0]); secs(0.3); kill(P,P.F[0]); secs(1.2); near(P.F[3].hp,h2,'without it the flurry stops');
});

test('Grosk / Hammer Fists: Heavy Hands, Hammer Weight, Fen Fury, Ground and Pound; Easy Meat, Blood in the Water',()=>{
  const L=lab(H,S(['sh_2_3','oj_4_2','oj_8_2','oj_9_3','oj_n1','oj_8_4']),{foes:3,big:true}), {v,F}=L; const i0=v.atkInterval;
  near(ratio(L,F[1],'punch'),1.12*1.15,'Heavy Hands 4% x 3 and Hammer Weight 5% x 3: its punches'); near(ratio(L,F[1],'hipposlam'),1,'not Croc Drop');
  L.T.s.k.fury={n:0,t:0,idle:0}; V.step(1); V.cast(v,'blue',F[1]); secs(0.2); assert.ok(F[1].forcedTargetT>5+1-3*V.STEP,'Ground and Pound: its taunt 0.2 x 5 s longer: '+F[1].forcedTargetT); assert.equal(stack(L,'fury'),1,'Fen Fury: 1 a punch'); secs(1.2); assert.equal(stack(L,'fury'),3,'Fen Fury: each punch, up to 3');
  V.step(1); near(v.atkInterval,i0/1.15,'1% x 5 attack speed each'); secs(4.1); near(v.atkInterval,i0,'for 4 s');
  near(ratio(L,F[1],null,{auto:true}),1.15,'Easy Meat: basic attacks on a stunned enemy 3% x 5 more'); F[2].stunned=0; F[2].speed=0; near(ratio(L,F[2],null,{auto:true}),1,'not on a free one'); F[2].silencedT=3; near(ratio(L,F[2],null,{auto:true}),1.15,'a silenced one'); F[2].stunned=1e6;
  F[0].hp=F[0].maxHp*0.4; near(ratio(L,F[0],null,{auto:true}),1.15*1.15,'Blood in the Water: below 50% HP 3% x 5 more');
});

test('Grosk / Where the Old Crocs Sleep (SIGNATURE)',()=>{
  const L=lab(H,S(['oj_2_3','oj_13_3']),{foes:3,big:true}), {v,F}=L; F[0].armorRating=0; F[2].armorRating=0; V.cast(v,'blue',F[1]); secs(1.4); assert.ok(mark(L,F[1],'roll'));
  v.blueCd=5; F[1].hp=1; F[1].shield=0; V.hit(v,F[1],100,{kind:'true'}); assert.ok(!F[1].alive); near(v.blueCd,0,'killing an enemy in a Death Roll: Hammer Fists is ready again');
  assert.equal(ust(L,F[0],'bite'),6,'every enemy within 3 m of him gets 6 Bite Marks'); assert.equal(ust(L,F[2],'bite'),0,'');
  const per=[]; let last=F[2].hp; V.cast(v,'blue',F[2]); for(let i=0;i<60;i++){ V.step(1); if(F[2].hp<last-1e-9){ per.push(last-F[2].hp); last=F[2].hp; } }
  V.step(10); const per2=[]; last=F[0].hp; V.cast(v,'blue',F[0]); for(let i=0;i<60;i++){ V.step(1); if(F[0].hp<last-1e-9){ per2.push(last-F[0].hp); last=F[0].hp; } }
  assert.equal(per.length,3,''); for(let i=0;i<3;i++) assert.ok(per[i]>per2[i]*1.4,'all three punches of that Hammer Fists are critical hits ('+per[i]+' vs '+per2[i]+')');
  setMk(L,F[2],'roll',99); v.blueCd=5; F[2].hp=1; F[2].shield=0; V.hit(v,F[2],100,{kind:'true'}); assert.ok(!F[2].alive); near(v.blueCd,5,'once every 15 s');
});

/* ============================== THE MIREWALL ============================== */
test('Grosk / Wardbound: Ward Bond, Close Company, Not on My Watch, Keeper, Deep Bond, Spare a Hand, Ancient Patience, Mud Poultice',()=>{
  const L=lab(H,S(['mw_1_1','mw_2_1','mw_3_1','mw_8_1','mw_10_1','mw_10_2','mw_12_1']),{foes:3,allies:2,big:true}), {v,F,A}=L; A[0].hp=A[0].maxHp*0.5; A[0].speed=0; const a0=A[0].dmg; V.step(1);
  assert.equal(v._mwWard,A[0],''); secs(1.9); assert.equal(ust(L,A[0],'wb'),3,'Close Company: 1 Wardbound every 1 / (1 + 20% x 3) s'); assert.ok(A[0].stunned>0,'(still held)');
  secs(1.3); assert.equal(ust(L,A[0],'wb'),5,'at most 5'); assert.equal(A[0].stunned,0,'Not on My Watch: at 5 one control on the ward is cleansed'); A[0].stunned=1e6;
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.85,'Ward Bond: 1% x 3 less per Wardbound'); V.step(1); near(A[0].dmg,a0*1.10,'Deep Bond: 0.4% x 5 attack per Wardbound');
  const g2=A[0].hp; V.heal(A[0],1000); near(A[0].hp-g2,1090,'Spare a Hand: it receives 3% x 3 more healing',1e-6);
  V.dot(A[0],100,5,1,F[0]); V.step(1); near(A[0].dots[A[0].dots.length-1].dps,100*0.94,'Ancient Patience: an enemy DoT on the ward ticks 2% x 3 weaker');
  secs(5); assert.ok(A[0].stunned>1e5,'once per ward each wave');
  A[1].hp=A[0].hp*0.5; const g3=A[0].hp; V.step(2); assert.equal(v._mwWard,A[1],'the ward changes'); near(A[0].hp-g3,A[0].maxHp*0.002*5*5,'Mud Poultice: the old ward heals 0.2% x 5 of its max HP per Wardbound it had',1e-6);
  assert.equal(ust(L,A[0],'wb'),0,'and loses them'); near(A[0].dots.length?A[0].dots[A[0].dots.length-1].dps:100,100,'its DoT back to full');
  A[1].hp=A[1].maxHp; V.step(2); assert.equal(v._mwWard,A[0],'his ward again'); secs(3.4); assert.equal(ust(L,A[0],'wb'),5,''); assert.ok(A[0].stunned>1e5,'Not on My Watch: once per ward each wave, even when it is his ward again');
  const K=lab(H,S(['mw_4_1','mw_10_2']),{foes:3,allies:1,big:true}); K.A[0].hp=K.A[0].maxHp*0.5; V.step(1); const g=K.A[0].hp; clk(K,'mw_4_1#0'); secs(1.05);
  near(K.A[0].hp-g,K.A[0].maxHp*0.01*1.09,'Keeper: the ward heals 0.2% x 5 of its max HP a second (Spare a Hand: 3% x 3 more)',1e-6);
});

test('Grosk / Called Out: Who Hit Them, Answer for It, Fen Justice, No One Else, Long Memory, Score to Settle, Big Voice; Hammer Fists goes to it',()=>{
  const L=lab(H,S(['mw_1_2','mw_2_2','mw_4_2','mw_6_2','mw_8_2','mw_11_2','mw_12_2','oj_9_3']),{foes:3,allies:1,big:true}), {v,F,A}=L; const a0=v.dmg; V.step(1);
  V.hit(F[1],A[0],100,{kind:'true'}); assert.ok(mark(L,F[1],'co'),'an enemy that hits his ward is Called Out'); assert.ok(!mark(L,F[0],'co'),'');
  v.target=F[0]; V.cast(v,'blue'); const h1=F[1].hp, h0=F[0].hp; secs(0.15); assert.ok(F[1].hp<h1&&F[0].hp===h0,'Hammer Fists goes to the nearest Called Out enemy'); assert.ok(F[1].forcedTargetT>5+1+0.6-4*V.STEP,'Big Voice: its taunt 0.2 x 3 s longer on a Called Out enemy (and Ground and Pound): '+F[1].forcedTargetT);
  secs(1.2);
  near(ratio(L,F[1],null),1.10*1.05,'Who Hit Them 2% x 5 more from him; Fen Justice 1% x 5 from his whole team'); near(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})),plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})))*1.05,'');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*(1-0.075),'No One Else: it deals him 1.5% x 5 less');
  V.step(1); near(v.dmg,a0*1.025,'Long Memory: 0.5% x 5 attack per enemy Called Out this wave'); V.hit(F[0],A[0],100,{kind:'true'}); V.hit(F[2],A[0],100,{kind:'true'}); V.step(1); near(v.dmg,a0*1.075,'three enemies');
  A[0].hp=A[0].maxHp*0.5; const g=A[0].hp, d=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})); near(A[0].hp-g,d*0.10,'Score to Settle: his hits on it heal his ward 2% x 5 of the damage',1e-6);
  secs(6.9); assert.ok(mark(L,F[0],'co'),'Answer for It: 4 + 1 x 3 s'); secs(0.3); assert.ok(!mark(L,F[0],'co'),'');
  V.wave(); V.step(2); near(v.dmg,a0,'a new wave: nobody Called Out yet');
});

test('Grosk / Face Me (PICK ONE) and Gravemaw Verdict',()=>{
  { const L=lab(H,S(['mw_1_2','mw_5_2']),{foes:3,allies:1,big:true}), {F,A}=L; V.step(1); V.hit(F[1],A[0],100,{kind:'true'}); assert.equal(F[1].forcedTarget,L.v,'Face Me: a Called Out enemy is taunted onto Grosk'); near(F[1].forcedTargetT,4,'until the mark ends',1e-9); }
  const L=lab(H,S(['mw_8_2','mw_9_2']),{foes:4,allies:1,big:true}), {v,F}=L; lv1(...F); at(L,F[3],0,4.6); setMk(L,F[0],'co',30);
  V.cast(v,'green'); near(F[0].silencedT,1.4+0.5,'Gravemaw Verdict: 0.5 s longer on an enemy already Called Out',1e-9); near(F[3].silencedT,1.4,'not on one that was not',1e-9); assert.ok(mark(L,F[3],'co'),'every enemy it catches is Called Out');
});

test('Grosk / Undertow: Undertow, Swell, Deep Current, Flood Tide, Brimming, Rising Water; Old Habit',()=>{
  const L=lab(H,S(['mw_1_4','mw_3_4','mw_5_4','mw_7_4','mw_9_4','mw_12_4']),{foes:3,allies:1}), {v,F,A}=L; A[0].maxHp=A[0].hp=1e9; v.maxHp*=1000; v.hp=v.maxHp*0.5; const a0=v.dmg; V.step(1);
  for(let i=0;i<9;i++) V.hit(F[0],A[0],100,{kind:'true'}); near(ev(L),9,'each time The Mirewall moves damage onto him, 1 Undertow');
  near(ratio(L,F[1],null,{auto:true}),1,'Swell: not below 10'); const h=v.hp; V.hit(F[0],A[0],100,{kind:'true'}); assert.ok(v.hp-h>v.maxHp*0.05-100,'Flood Tide: at 10 he heals 1% x 5 of his max HP: '+(v.hp-h)/v.maxHp);
  const h3=v.hp; V.hit(F[0],A[0],100,{kind:'true'}); assert.ok(Math.abs(v.hp-h3)<v.maxHp*0.001,'Flood Tide: only when he reaches 10, not at each gain above it');
  near(ratio(L,F[1],null,{auto:true}),1.15,'Swell: at 10 his basic attacks 5% x 3 more'); for(let i=0;i<5;i++) V.hit(F[0],A[0],100,{kind:'true'}); V.step(1); 
  near(v.dmg,a0*(1+0.02*14),'Undertow: 0.4% x 5 attack each, Brimming: up to 14'); near(hitOn(L,v,10),plainHit(L,()=>hitOn(L,v,10))*(1-0.005*14),'Deep Current: 0.1% x 5 damage reduction each');
  secs(7.6); V.step(1); near(v.dmg,a0*(1+0.02*14),'Rising Water: each lasts 6 + 0.4 x 5 s'); secs(1.0); V.step(1); near(v.dmg,a0,'');
  const L2=lab(H,S(['mw_1_4','mw_6_4']),{foes:3}); near(ev(L2),6,'Old Habit: the wave starts with 3 x 2 Undertow');
});

test('Grosk / The Mirewall changed: Two Wards, Wide Shelter, Steady Arm, Heavier Share, Dug In Beside Them',()=>{
  const L=lab(H,S(['mw_5_3','mw_6_3','mw_6_1','mw_4_3','mw_n2']),{foes:3,allies:2,big:true}), {v,F,A}=L; A[0].hp=A[0].maxHp*0.5; A[1].hp=A[1].maxHp*0.7; V.step(2);
  assert.equal(v._mwWard,A[0],''); assert.equal(A[1]._mwBy,v,'Two Wards: the next ally closest to dying is his ward too'); const c=(MW(10)+0.03)*2/3;
  for(const a of [A[0],A[1]]){ v.hp=v.maxHp*0.5; const hv=v.hp; near(hitOn(L,a,1000),1000*(1-c)*0.94,'each at two thirds of its strength (Steady Arm 1 point x 3 first); Wide Shelter 2% x 3 less');
    near(hv-v.hp,1000*c*0.35*0.96*(1-0.65),'Dug In Beside Them: he takes 4% less of what is moved onto him; Heavier Share: he heals back 50% + 5% x 3 of it',1e-6); }
  A[0].hp=A[0].maxHp*0.9; V.step(2); assert.equal(v._mwWard,A[1],''); assert.equal(A[0]._mwBy,v,'the two closest to dying, picked again');
});

test('Grosk / walking toward his ward: Stand Guard, and Dug In Beside Them with Set Feet costs no Depth',()=>{
  const go=(L,ax,ay)=>{ const {v,F,A}=L; at(L,F[0],0,14); at(L,F[1],5.5,14); at(L,A[0],ax,ay); v.stunned=0; v.greenCd=v.blueCd=99; v.energy=0; v.forcedTarget=F[2]; v.forcedTargetT=99; v.target=F[2]; };
  { const L=lab(H,S(['mw_8_3','mw_n2','sh_1_1']),{foes:3,allies:1,big:true}), {v}=L; const sp=v.speed; setStack(L,'depth',6); go(L,14,3.5); V.step(40);
    assert.equal(stack(L,'tw'),1,'he walks toward his ward'); near(v.speed,sp*1.09,'Stand Guard: 3% x 3 faster'); assert.equal(stack(L,'depth'),6,'Dug In Beside Them (with Set Feet): no Depth lost'); v.stunned=1e6; }
  const L=lab(H,S(['mw_8_3','mw_n2','sh_1_1']),{foes:3,allies:1,big:true}), {v}=L; const sp=v.speed; setStack(L,'depth',6); go(L,-6,0); V.step(25);
  assert.equal(stack(L,'tw'),0,'walking away from his ward'); near(v.speed,sp,''); assert.ok(stack(L,'depth')<6,'costs Depth'); v.stunned=1e6;
});

test('Grosk / Never Left Behind',()=>{
  const L=lab(H,S(['mw_10_1','mw_11_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; V.step(1); const m=MW(10);
  A[0].hp=100; A[0].shield=0; const hv=v.hp; V.hit(F[0],A[0],1e5,{kind:'true'}); assert.ok(A[0].alive,'the ward would die: it drops to 1 HP instead'); near(A[0].hp,1,'');
  near(hv-v.hp,1e5*(1-m)+1e5*m*0.35*0.5,'and Grosk takes the killing hit (with his Mirewall share)',1e-6);
  A[0].hp=100; V.hit(F[0],A[0],1e5,{kind:'true'}); assert.ok(!A[0].alive,'once per wave');
  const L2=lab(H,S(['mw_11_1']),{foes:3,allies:1,big:true}); at(L2,L2.A[0],0,-12); V.step(1); L2.A[0].hp=100; V.hit(L2.F[0],L2.A[0],1e5,{kind:'true'}); assert.ok(!L2.A[0].alive,'not when he stands more than 6 m away');
});

test('Grosk / Seen It Coming, Grim Stance, Knotted Hide and Heavy Hide, Iron in the Mud and Knuckle Through, Shield Hand',()=>{
  { const L=lab(H,S(['mw_n1']),{foes:3,big:true}), {v,F}=L; const p=plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}));
    near(hitOn(L,v,1000,{src:F[0]}),p*0.70,'Seen It Coming: the first hit each enemy lands on him in a wave 6% x 5 less'); near(hitOn(L,v,1000,{src:F[0]}),p,'only the first');
    near(hitOn(L,v,1000,{src:F[1]}),p*0.70,'each enemy'); V.wave(); V.step(1); near(hitOn(L,v,1000,{src:F[0]}),p*0.70,'each wave'); }
  { const L=lab(H,S(['sh_8_3','sh_11_3','mw_10_3']),{foes:3,big:true}), {v,F}=L; F[2].t=Object.assign({},F[2].t,{row:'Back'});
    near(hitOn(L,v,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[2]}))*0.94,'Grim Stance: 2% x 3 less from the back row'); near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]})),'not the front');
    near(hitOn(L,v,1000,{src:F[0],crit:true}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0],crit:true}))*0.90*0.94,'Knotted Hide 2% x 5 and Heavy Hide 2% x 3 less from critical hits'); }
  const L=lab(H,S(['sh_9_3','oj_9_2','mw_9_3']),{foes:3,big:true}), {v,F}=L; F[1].armorRating=400; const dm=VMX('defMul'), a=dm(v,F[1],'phys'); const sv=v._wpnArmIgn; v._wpnArmIgn=0.1; const b=dm(v,F[1],'phys'); v._wpnArmIgn=sv;
  near(ratio(L,F[1],null,{kind:'phys'}),(b/a)*(b/a),'Iron in the Mud and Knuckle Through: each ignores 2% x 5 of the armor; they multiply'); near(ratio(L,F[1],null,{auto:true}),1.15,'Shield Hand: basic attacks 3% x 5 more');
});

test('Grosk / Nothing Takes Them Down (SIGNATURE)',()=>{
  const L=lab(H,S(['mw_13_2','mw_1_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; V.step(1); const m=MW(10), M=A[0].maxHp;
  A[0].hp=M*0.25; const raw=M*0.10/(1-m), hv=v.hp; const la=lost(A[0],()=>V.hit(F[0],A[0],raw,{kind:'true'})); assert.ok(win(L,'close'),'a hit that would take his ward below 20%: The Mirewall closes');
  near(la,0,'the ward takes nothing of it',1e-9); near(hv-v.hp,raw*m*0.35*0.5+raw*(1-m)*0.5,'Grosk takes it at half strength (and the passive\'s own share)',1e-3);
  assert.ok(mark(L,F[0],'co')&&F[0].forcedTarget===v,'it is Called Out and taunted onto him'); near(ev(L),11,'he gains 10 Undertow (and 1 for the move)');
  const h2=v.hp; near(hitOn(L,A[0],1000,{src:F[1]}),0,'for 4 s the ward takes no damage from hits',1e-9); near(h2-v.hp,500,'Grosk takes all of it at half strength and heals none of it back',1e-6);
  assert.ok(mark(L,F[1],'co')&&F[1].forcedTarget===v,'every enemy that hits it is Called Out and taunted onto him');
  secs(4.1); assert.ok(!win(L,'close'),''); near(hitOn(L,A[0],1000,{src:F[1]}),1000*(1-m),'4 s');
  A[0].hp=M*0.25; V.hit(F[0],A[0],raw,{kind:'true'}); assert.ok(!win(L,'close'),'once every 25 s'); secs(17); A[0].hp=M*0.25; V.hit(F[0],A[0],raw,{kind:'true'}); assert.ok(!win(L,'close'),'(21 s: not yet)');
  secs(4.2); A[0].hp=M*0.25; V.hit(F[0],A[0],raw,{kind:'true'}); assert.ok(win(L,'close'),'then again');
});

/* every page site his talents added runs, with the right skill resolving: a scripted definition counts each hook (the controls remove them one at a time) */
test('Grosk: every page site his talents added is reached - Hammer Fists\' target, each punch, its fallen target, Croc Drop\'s landing spot and slam, The Mirewall\'s numbers, the killing hit',()=>{
  const n=k=>({fn:'n',k}), rows=[{on:'skillTgt',skill:'punchflurry',do:[n('hfTgt')]},{on:'skillTgt',skill:'punch',do:[n('pDead')]},{on:'partPre',skill:'punch',do:[{fn:'pre'}]},{on:'part',skill:'punch',do:[n('post')]},
    {on:'hit',if:{casting:'punch'},do:[n('punch')]},{on:'skillTgt',skill:'hipposlam',do:[n('cdTgt')]},{on:'landPre',skill:'hipposlam',do:[n('cdPre')]},{on:'hit',if:{casting:'hipposlam'},do:[n('slam')]},{on:'land',skill:'hipposlam',do:[n('cdLand')]},
    {on:'num',skill:'mwCut',do:[{fn:'mw',k:'cut'}]},{on:'num',skill:'mwTake',do:[{fn:'mw',k:'take'}]},{on:'num',skill:'mwHeal',do:[{fn:'mw',k:'heal'}]},{on:'teamLethal',do:[{fn:'tl'}]}];
  const def={hero:H,casting:true,states:{},always:[],talents:{mw_13_2:rows},partial:{},ruling:{},
    fn:{ n(A,T,u,c,a){ const C=T.s.cnt||(T.s.cnt={}); C[a.k]=(C[a.k]||0)+1; }, pre(A,T){ const C=T.s.cnt||(T.s.cnt={}); const k='pre'+(T.s.cur==='punch'?'':':wrong'); C[k]=(C[k]||0)+1; },
      mw(A,T,u,c,a){ const C=T.s.cnt||(T.s.cnt={}); const k=a.k+((c.unit&&c.unit._mwBy===u&&c.src&&c.src.team!==u.team)?'':':wrong'); C[k]=(C[k]||0)+1; },
      tl(A,T,u,c){ if(!c.unit||c.unit.team!==u.team) return; const C=T.s.cnt||(T.s.cnt={}); C.tl=(C.tl||0)+1; T.s.tla=c.amt; } }};
  const L=lab(H,[['mw_13_2',1]],{foes:3,allies:1,big:true,def}), {v,F,A}=L; const C=()=>L.T.s.cnt||{};
  V.cast(v,'blue',F[1]); assert.equal(C().hfTgt,1,'Hammer Fists\' target'); secs(0.2); assert.equal(C().pre,1,'each punch, as the punch'); assert.equal(C().post,1,''); assert.equal(C().punch,1,'');
  kill(L,F[1]); secs(1.3); assert.equal(C().pDead,2,'a punch whose target has fallen'); assert.equal(C().pre,1,'');
  V.cast(v,'ult'); assert.equal(C().cdTgt,1,'where an unaimed Croc Drop lands'); land(v); assert.equal(C().cdPre,1,'its landing'); assert.ok(C().slam>=1,'its slam as the skill'); assert.equal(C().cdLand,1,'');
  V.step(1); V.hit(F[0],A[0],100,{kind:'true'}); assert.ok(C().cut===1&&C().take===1&&C().heal===1,'The Mirewall\'s three numbers, with the ward and the attacker: '+JSON.stringify(C()));
  A[0].hp=5; A[0].shield=0; V.hit(F[0],A[0],1000,{kind:'true'}); assert.equal(C().tl,1,'the killing hit'); assert.ok(L.T.s.tla>5,'with its size: '+L.T.s.tla);
  assert.ok(!Object.keys(C()).some(k=>/:wrong$/.test(k)),JSON.stringify(C()));
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Grosk: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['sh_1_1','sh_1_4','sh_2_2','oj_1_1','oj_1_4','oj_2_3','mw_1_1','mw_1_2','mw_1_4']), TEAM=['vael','sylthaine','vireo','vex','grosk'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const seen={depth:0,ref:0,gulp:0,mired:0,bite:0,roll:0,wb:0,co:0,ut:0};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const S0=s._tal.s; for(const k of ['depth','ref','gulp']) seen[k]=Math.max(seen[k],(S0.k[k]||{n:0}).n);
    const q=S0.roll.ut; if(q) seen.ut=Math.max(seen.ut,q.e.length);
    for(const f of units()){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; for(const k of ['mired','roll','co']) if(o[k]&&o[k].until>V.now()) seen[k]++; if(o['#bite']&&o['#bite'].until>V.now()) seen.bite++; if(o['#wb']) seen.wb++; } }
  console.log('  live fight: '+JSON.stringify(seen));
  assert.ok(seen.depth>=1,'Depth built'); assert.ok(seen.mired>0,'enemies Mired'); assert.ok(seen.bite>0,'Bite Marks'); assert.ok(seen.wb>0,'a real ward with Wardbound'); assert.ok(seen.co>0,'enemies Called Out'); assert.ok(seen.ut>0,'Undertow');
  determinism(H,TEAM);
});

/* The page sites his talents added (Hammer Fists' target and each punch, a fallen punch target, Croc Drop's unaimed landing and its slam, The Mirewall's three numbers,
   the killing hit passed to teamLethal): with nothing learned, whole seeded fights with Grosk in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Grosk: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENCS=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['grosk','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','bloatus'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __grN={pull:0,fists:0,ult:0,punch:0,slam:0,moves:0}; var __grD=_doEffectCore, __grR=ringBurst, __grB=burstAt, __grM=SKLV.mirewall;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="grosk"&&(!o||!o.deliver||o._arrived)){ if(type==="pullsilence") __grN.pull++; if(type==="punchflurry") __grN.fists++; if(type==="hipposlam") __grN.ult++; } return __grD.apply(this,arguments); };'+
    'ringBurst=function(x,y,c,n){ if(c===0x8a6a3a&&n===26) __grN.slam++; return __grR.apply(this,arguments); }; burstAt=function(x,y,c,n){ if(c===0xe0b070&&n===10) __grN.punch++; return __grB.apply(this,arguments); };'+
    'SKLV.mirewall=function(){ __grN.moves++; return __grM.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENCS.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__grN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.pull>0&&c.fists>0&&c.ult>0&&c.punch>0&&c.slam>0&&c.moves>0,'the fights cast Gravemaw Pull, Hammer Fists (its punches) and Croc Drop (its slam), and The Mirewall moved damage: '+JSON.stringify(c)); }
  finally{ VMX('_doEffectCore=__grD; ringBurst=__grR; burstAt=__grB; SKLV.mirewall=__grM;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ sh:['sh_1_1','sh_3_4','sh_2_2','sh_8_3','sh_11_3','sh_3_3','sh_1_3','sh_n1','sh_4_1','sh_1_4','sh_13_2'],
            oj:['oj_7_1','oj_1_1'],
            mw:['mw_n1','mw_7_4','mw_8_2','mw_10_3','mw_3_3','mw_2_3','mw_12_3','mw_1_4','mw_12_4','mw_1_2'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sh:0,oj:1,mw:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (10 Depth, 5 Refusal, 5 Gulp, 14 Undertow; the attacker in the back row, Mired and
   Called Out, its first hit this wave; Croc Drop's Wall at its level-100 35% on him), normal and critical, physical and magic */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:3,allies:1,cold:true}), {v,F}=L; V.step(1); const f=F[0]; f.t=Object.assign({},f.t,{row:'Back'});
  if(L.T){ setStack(L,'depth',10); setStack(L,'ref',5); setStack(L,'gulp',5); L.T.s.roll.ut={span:99,e:[[V.now(),14]]}; setMk(L,f,'mired',1e9); setMk(L,f,'co',1e9); }
  v._mwDrT=99; v._mwDrPct=0.35; v._mwDrSrc=v; v.maxHp=1e5; v.hp=5e4; v.shield=1e12; v.shieldT=999;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Grosk: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[[['sh','mw'],[61,30]],[['sh','oj'],[61,30]],[['sh'],[91]],[['mw','sh'],[61,30]],[['mw'],[91]],[['oj','sh'],[61,30]],[['sh','mw','oj'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="grosk"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>raw*1e-6){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="grosk"&&u.alive){ __dr.ticks++; const w=u._tal&&u._tal.s.w.morn; if(HERO61.immune(u,battleTime)||(w&&w.t>0)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','grosk'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.ok(d.imm<d.ticks*0.5,'and he is immune far less than half the fight ('+d.imm+' of '+d.ticks+' ticks)'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
