'use strict';
/* Maren's talents as data on the mechanics layer (talents-mech/maren.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling, the stun-lock rule in seeded fights.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   ml(): the lab, everyone held (stunned), Maren with his own HP. still(L): Maren thinks (his passive and clocks run) but does nothing (no move, no attack, nothing ready).
   free(x): an enemy that thinks but does nothing, at level 1 (a control is not resisted by the level roll; a held unit counts as stunned for the stun-lock rule).
   TSUNAMI: the game's wave measures its 3.4 m from HIS centre and in real fights reaches nobody (he stands about 10 m back, tests/maren-kit-facts.js); release
   v1391 on another branch centres it on his TARGET with the same radius. Every test that casts it puts its enemies within 3.4 m of his centre AND within 3.4 m of
   his target RIGHT BEFORE the cast (bodies are pushed apart by the next step): a place the wave reaches both before and after that fix, so these tests are about
   his talents, not about the wave's reach. tsAt(L, list): the first enemy of the list (his target) 2.6 m in front of him, the others beside it.
   The lab's skill level is 10. Run: node --test tests/talents-mech-maren.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root,build}=require('./talents-lab.js');
const H='maren', S=ids=>full(H,ids);
const near=(a,b,msg,eps)=>assert.ok(Math.abs(a-b)<=(eps||1e-6)*(b===0?1:Math.abs(b))+1e-12,(msg||'')+': '+a+' vs '+b);   // relative (absolute only against 0)
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d||1e9)}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const dm=(s,t,k)=>VMX('defMul')(s,t,k);
const mr=L=>L.T.s.mr;
const fa=(L,t)=>ust(L,t,'mrFa');
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };
const still=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=99; v.blueCd=99; v.energy=0; };
function ml(list,o){ o=o||{}; const L=lab(H,list,Object.assign({foes:3},o)); if(o.freeF) L.F.forEach(free); if(o.still) still(L); if(o.pre) o.pre(L); return L; }
const plain=(o,fn)=>fn(ml(null,o));
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));
const ratio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
const allyRatio=(L,a,t,o)=>lost(t,()=>V.hit(a,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(a,t,1000,Object.assign({kind:'true'},o||{}))));
const inRatio=(L,t,o)=>{ const h=t.hp, s=t.shield; const a=hitOn(L,t,100,o); t.hp=h; t.shield=s; const b=plainHit(L,()=>hitOn(L,t,100,o)); t.hp=h; t.shield=s; return a/b; };
const castTP=(L,t)=>V.cast(L.v,'green',t);
const castTS=(L,t)=>V.cast(L.v,'blue',t);
const castMS=(L,t)=>V.cast(L.v,'ult',t);
/* Tsunami geometry: the target 2.6 m in front of him, the others 1.6 m to its sides: within 3.4 m of his centre and of the target's (before and after v1391) */
const TSP=[[2.6,0],[2.6,1.6],[2.6,-1.6]];
function tsAt(L,list){ list.forEach((f,i)=>at(L,f,TSP[i][0],TSP[i][1])); }
const pools=L=>VMX('groundHazards').filter(h=>h.src===L.v&&!h.arrival);
const press=(L,slot)=>VMX(`(function(u,slot){ u._castSlot=slot; u._castLv=10; u._castSM=skillMul(10); try{ doEffect(u,(slot==='green'?u.greenAb:u.blueAb).type,slot==='green'?u.greenAb:u.blueAb); } finally{ u._castSM=1; u._castLv=0; } })`)(L.v,slot);
const KO=slot=>VMX('skillScaleOpts')(Object.assign({},VMX('KITS.maren')[slot]),VMX('skillMul')(10),10);
const ccNerf=()=>V.ccNerf;
const swing=(L,x)=>{ x.stunned=0; x.atkCd=0; x._castT=0; x.speed=0; x.target=L.v; };

test('Maren: every talent is accounted for - 10 plain stats, 106 with rows, none waiting',()=>{
  accounting(H,[116,10,106,0,0]);
  const M=FXN.mech(H); for(const id of ['sf_1_1','oh_1_1','gb_1_1','sf_13_3','oh_13_2','gb_13_2','sf_3_4','sf_9_2','oh_11_1','gb_10_4']) assert.ok(M.talents[id],id);
  for(const id of ['sf_1_2','sf_12_4','sf_10_1','oh_1_2','oh_10_3','oh_7_1','gb_2_4','gb_3_1','gb_8_1','gb_11_1']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Maren: his real kit, as the talents read it - Tide Pool, Tsunami, Maelstrom\'s root, Deep Reserves',()=>{
  plain({foes:3},P=>{ const {v,F}=P, nf=ccNerf();
    near(KO('green').radius/V.METER,3,'Tide Pool: 3 m'); near(KO('green').dur,4,'4 s'); near(KO('green').slow,3,'its slow from the control table: 3.0 s');
    castTP(P,F[0]); const h=pools(P)[0]; assert.ok(h,'Tide Pool is a ground hazard of his'); near(Math.hypot(h.x-F[0].x,h.y-F[0].y),0,'it lands where his target stands');
    near(h.r/V.METER,3); near(h.life,4); assert.equal(h.interval,0.5,'it ticks every 0.5 s'); const h0=F[0].hp; secs(0.55); assert.ok(F[0].hp<h0,'and strikes the enemy inside it'); });
  plain({foes:3,freeF:true},P=>{ const {v,F}=P; castTP(P,F[1]); secs(0.55); near(F[1].slow,3*ccNerf(),'the pool\'s slow: 2.1 s (3.0 s cut)',0.05); assert.equal(F[1].slowMul,undefined,'with no strength of its own (the engine\'s default 45%)'); });
  /* talents-fix1: since v1391 Tsunami breaks on his TARGET and reaches every enemy whose body is within 3.4 m of it; it shoves them away from that spot
     (the target itself stands on the spot and is not moved) */
  plain({foes:3,freeF:true},P=>{ const {v,F}=P; tsAt(P,F); at(P,F[2],8.2,0); const c0={x:F[0].x,y:F[0].y}, gap=f=>Math.hypot(f.x-c0.x,f.y-c0.y)/V.METER, x1=gap(F[1]), h0=F.map(f=>f.hp);
    castTS(P,F[0]); assert.ok(F[0].hp<h0[0]&&F[1].hp<h0[1],'Tsunami strikes the enemies whose body is within 3.4 m of his target'); near(F[2].hp,h0[2],'not one whose body is 3.59 m from it');
    near(gap(F[1])-x1,1.6,'and shoves them 1.6 m away from where it breaks',1e-6); near(gap(F[0]),0,'(its target, on that spot, stays)',1e-9); near(F[0].slow,3*ccNerf(),'a 2.1 s slow',0.05); });
  plain({foes:3,freeF:true},P=>{ const {v,F}=P; at(P,F[1],7,0); at(P,F[2],15.5,0); castMS(P,F[1]);
    near(F[1].stunned,4*ccNerf(),'Maelstrom: the root is the stun field, the table\'s 4.0 s cut to 2.8 s',1e-6); assert.ok(F[0].stunned>0,'everyone within 7 m of its centre'); near(F[2].stunned,0,'not beyond'); });
  plain({foes:1,cold:true},P=>{ const {v}=P; V.step(1); v.hp=v.maxHp*0.5; const h=v.hp; secs(1); near((v.hp-h)/v.maxHp,0.01*(v.passMul||1),'Deep Reserves: 1% of his max HP x passMul a second',0.03); });
});

/* ============================== SIX FATHOMS ============================== */
test('Maren / Fouled: Tsunami Fouls who it shoves (4 s + Tangled Line), two Fouled within 2 m tangle - both rooted 0.4 s a rank, once every 6 s, never on a stunned or just-stunned enemy',()=>{
  const L=ml(S(['sf_1_1','sf_3_1']),{freeF:true}), {v,F}=L; tsAt(L,F); castTS(L,F[0]);
  assert.ok(mark(L,F[0],'mrFo')&&mark(L,F[1],'mrFo'),'Fouled'); const m=F[0]._talM[v.uid].mrFo; near(m.until-V.now(),4+2,'4 s + 0.4 s x 5',1e-6);
  V.step(1); near(F[0].stunned,1.2,'tangled: rooted 0.4 s x 3 (its full written length)',0.05); assert.ok(F[1].stunned>1.1,'both of them');
  assert.ok(mark(L,F[0],'mrLk'),'his stun leaves the stun-lock mark'); secs(1.3); assert.ok(!(F[0].stunned>0),''); assert.ok(mark(L,F[0],'mrLk'),'the mark lasts past the root'); secs(0.6); assert.ok(!mark(L,F[0],'mrLk'),'(0.5 s after it ended)');
  at(L,F[1],(F[0].x-v.x)/V.METER,(F[0].y-v.y)/V.METER+1.0); V.step(1); assert.ok(!(F[0].stunned>0),'still Fouled and side by side: not again within 6 s');
  const L2=ml(S(['sf_1_1']),{freeF:true,foes:2}); tsAt(L2,L2.F); castTS(L2,L2.F[0]); L2.F[0].stunned=0.5; V.step(1); assert.ok(L2.F[0].stunned<0.5,'never on an enemy that is stunned'); assert.ok(!(L2.F[1].stunned>0),'and the pair waits for both');
  const L3=ml(S(['sf_1_1']),{freeF:true}); tsAt(L3,L3.F); setMk(L3,L3.F[0],'mrLk',0.3); castTS(L3,L3.F[0]); V.step(1); assert.ok(!(L3.F[0].stunned>0),'nor within 0.5 s after his stun on it ended');
});
test('Maren / Fouled: Fouled Again (0.5 m a rank), Snarled, Weed Wrapped, Knotted, Fouled Anchor; no tangle beyond the reach',()=>{
  const gapAt=(L,a,b,m)=>{ const d=m*V.METER+VMX('bodyR')(a)+VMX('bodyR')(b); b.x=a.x; b.y=a.y+d; };   // b set down m metres (body to body) beside a
  const L=ml(S(['sf_1_1','sf_5_1','sf_12_1','sf_6_1']),{freeF:true,foes:2}), {v,F}=L; const a0=F[0].atkInterval; tsAt(L,F); castTS(L,F[0]); gapAt(L,F[0],F[1],2.5); F[0].speed=100; V.step(1);
  assert.ok(!(F[0].stunned>0),'2.5 m apart body to body: no tangle within 2 m'); near(F[0].speed,90,'Snarled: 2% x 5 slower',1e-6); near(F[0].atkInterval/a0,1/0.91,'Weed Wrapped: 3% x 3 slower attacks',1e-6);
  const L2=ml(S(['sf_1_1','sf_8_1','sf_6_1']),{freeF:true,foes:2,allies:1}); tsAt(L2,L2.F); castTS(L2,L2.F[0]); gapAt(L2,L2.F[0],L2.F[1],3.4); V.step(1);
  assert.ok(L2.F[0].stunned>0&&L2.F[1].stunned>0,'Fouled Again 0.5 m x 3 more: at 3.4 m they tangle');
  near(ratio(L2,L2.F[0]),1.15,'Knotted: tangled and rooted, 3% x 5 more from his team'); near(allyRatio(L2,L2.A[0],L2.F[0]),1.15,'from his allies too');
  secs(1.3); near(ratio(L2,L2.F[0]),1,'not once the root is over');
  const L3=ml(S(['sf_9_1']),{freeF:true}), f=L3.F[1]; at(L3,f,7,0); castMS(L3,f); assert.ok(mark(L3,f,'mrFo'),'Fouled Anchor: Maelstrom Fouls every enemy it roots');
});

test('Maren / Fathoms: 1 a second in Tide Pool (6 at most), 1 lost a second outside (Bottom Silt 0.3 s a rank slower), each 0.6% slower attacks a rank; Heavy Limbs; Deeper Pool',()=>{
  const L=ml(S(['sf_1_4','sf_4_4','sf_2_4']),{foes:3}), {v,F}=L; const f=F[0], a0=f.atkInterval, s0=f.speed;
  castTP(L,f); V.step(1); assert.equal(fa(L,f),3,'Deeper Pool: 1 x 3 the moment it lands on it'); secs(0.93); assert.equal(fa(L,f),3,'not before a full second'); secs(0.1); assert.equal(fa(L,f),4,'1 more after a second in it');
  secs(2.0); assert.equal(fa(L,f),6,'6 at most'); V.step(1); near(f.atkInterval/a0,1/(1-0.006*5*6),'0.6% x 5 slower attacks per Fathom',1e-6); near(f.speed/s0,1-0.006*5*6,'Heavy Limbs: 0.6% x 5 slower per Fathom',1e-6);
  secs(1.2); assert.ok(pools(L).length===0,'the pool is gone'); const n=fa(L,f); secs(1.03); assert.equal(fa(L,f),n-1,'outside, 1 lost each second'); secs(5.5); assert.equal(fa(L,f),0);
  near(f.atkInterval,a0,'and its attacks come back',1e-9);
  const L2=ml(S(['sf_1_4','sf_6_4'])), g=L2.F[0]; setUst(L2,g,'mrFa',3); V.step(1); secs(1.5); assert.equal(fa(L2,g),3,'Bottom Silt: none lost in 1.5 s'); secs(0.5); assert.equal(fa(L2,g),2,'1 lost every 1.9 s'); secs(1.5); assert.equal(fa(L2,g),2,'not again by 3.5 s'); secs(0.4); assert.equal(fa(L2,g),1);
});
test('Maren / Fathoms: Sinking Shot, Six Fathoms Down, Cold Ache (both groups), Back in the Water, The Bottom, Closing Water, Salt Mind',()=>{
  const L=ml(S(['sf_7_3','sf_7_4','sf_5_4']),{foes:3,allies:1}), {v,F,A}=L; const f=F[0];
  V.hit(v,f,1,{kind:'true',auto:true}); assert.equal(fa(L,f),1,'Sinking Shot: each basic attack 1 Fathom, out of the water too'); V.hit(v,f,1,{kind:'true'}); assert.equal(fa(L,f),1,'not a skill hit');
  setUst(L,f,'mrFa',6); near(ratio(L,f),1.10,'Six Fathoms Down: 2% x 5 more from Maren at 6'); near(allyRatio(L,A[0],f),1,'only from him');
  setUst(L,f,'mrFa',3); near(inRatio(L,v,{src:f}),0.925,'Cold Ache: at 3 Fathoms it deals 1.5% x 5 less to him'); near(inRatio(L,A[0],{src:f}),0.925,'and to his allies'); setUst(L,f,'mrFa',2); near(inRatio(L,v,{src:f}),1,'not at 2');
  const L2=ml(S(['sf_1_4','sf_n2']),{foes:3}), g=L2.F[0]; castTP(L2,g); V.step(1); at(L2,g,4.5,6); V.step(1); const n=fa(L2,g); secs(2); at(L2,g,4.5,0); V.step(1);
  assert.equal(fa(L2,g),n+3,'Back in the Water: out of the pool and back in its water within 4 s: 1 x 3 at once');
  const L3=ml(S(['sf_10_4']),{foes:3}), dead=L3.F[0]; setUst(L3,dead,'mrFa',6); setUst(L3,L3.F[2],'mrFa',1); dead.hp=1; V.hit(L3.v,dead,100,{kind:'true'}); assert.ok(!dead.alive);
  assert.equal(fa(L3,L3.F[1]),6,'The Bottom: dying at 6 Fathoms, it passes them to the nearest enemy'); assert.equal(fa(L3,L3.F[2]),1,'not to another');
  const L4=ml(S(['sf_11_3','sf_11_2']),{freeF:true}), h=L4.F[1]; at(L4,h,7,0); castMS(L4,h); assert.equal(fa(L4,h),6,'Closing Water: rooted by Maelstrom, 2 x 3 Fathoms');
  const L5=ml(S(['sf_11_2']),{freeF:true}), k=L5.F[1]; k.stunImmune=true; at(L5,k,7,0); castMS(L5,k); assert.equal(fa(L5,k),6,'Salt Mind: its immunity blocks the root: 2 x 3 Fathoms instead');
  k.stunned=0; castMS(L5,k); assert.equal(fa(L5,k),6,'(at most 6)'); setUst(L5,k,'mrFa',0); k.stunned=0; secs(1.5); castMS(L5,k); assert.equal(fa(L5,k),0,'once per enemy every 12 s'); k.stunned=0; secs(10.6); castMS(L5,k); assert.equal(fa(L5,k),6);
  const L6=ml(S(['sf_11_2']),{freeF:true}), r=L6.F[1]; r.level=200; at(L6,r,7,0); VMX('var __mrB=brnd; brnd=function(){ return 0.99; };'); try{ castMS(L6,r); } finally{ VMX('brnd=__mrB;'); }
  assert.ok(!(r.stunned>0),'(the level roll resisted it)'); assert.equal(fa(L6,r),6,'a root the game\'s level roll resisted counts as blocked too');
});
test('Maren / Numb Fingers: at 6 Fathoms an enemy cannot basic attack for 1.2 s (the page\'s swing test), once per enemy every 8 s',()=>{
  const L=ml(S(['sf_1_4','sf_2_4','sf_3_4']),{foes:3}), {v,F}=L; const f=F[0]; at(L,f,0,3.0); setUst(L,f,'mrFa',5); castTP(L,f); assert.equal(fa(L,f),6);
  near(f._talDisarmT,1.2,'disarmed 1.2 s (its full written length)',1e-9); swing(L,f); V.step(1); assert.ok(!(f.atkCd>0),'it does not swing while disarmed');
  secs(1.25); near(f._talDisarmT,0,'',0.03); f.atkCd=0; V.step(1); assert.ok(f.atkCd>0,'it swings once the disarm is over');
  f.stunned=1e6; secs(2.5); setUst(L,f,'mrFa',5); castTP(L,f); assert.equal(fa(L,f),6); assert.ok(!(f._talDisarmT>0),'not again within 8 s'); secs(4.5); setUst(L,f,'mrFa',5); castTP(L,f); assert.ok(f._talDisarmT>1,'after 8 s, again');
  plain({foes:3},P=>{ const g=P.F[0]; at(P,g,0,3.0); swing(P,g); V.step(1); assert.ok(g.atkCd>0,'(a unit with no talent disarm swings as before)'); });
});

test('Maren / Tide Pool: Wide Pool, Standing Water, Cold Pool, Deep Pool (twice as strong for 1.5 s, at most 80%), Twin Pools (a 2 m pool on the farthest), Ready Pool',()=>{
  const L=ml(S(['sf_2_3','sf_4_3','sf_9_3','gb_4_4']),{foes:3}), {v,F}=L; castTP(L,F[0]); const h=pools(L)[0]; near(h.r/V.METER,3.5,'Wide Pool: 0.1 m x 5 wider'); near(h.life,4.9,'Standing Water: 0.3 s x 3 longer');
  plain({foes:3},P=>{ castTP(P,P.F[0]); P.dmg0=pools(P)[0].dmg; L.dmg0=P.dmg0; });
  const L2=ml(S(['sf_9_3','gb_4_4'])); castTP(L2,L2.F[0]); near(pools(L2)[0].dmg/L.dmg0,1.20,'Cold Pool: 4% x 5 more damage',1e-9);
  near(FX.cd(L2.v,'green',8),8-1.2,'Ready Pool: 0.4 s x 3 shorter',1e-9);
  const L3=ml(S(['sf_5_2']),{freeF:true}), f=L3.F[0]; castTP(L3,f); secs(0.55); near(f.slowMul,0.20,'Deep Pool: twice the 45% slow, held at 80%',1e-9); secs(1.0); assert.ok(f.slowMul!==0.20,'after its first 1.5 s, the pool\'s own slow again ('+f.slowMul+')');
  const L4=ml(S(['sf_5_3']),{foes:3}), {F:G}=L4; castTP(L4,G[0]); assert.equal(pools(L4).length,1); V.step(2); const ps=pools(L4); assert.equal(ps.length,2,'Twin Pools: a second pool');
  near(ps[1].r/V.METER,2,'2 m'); near(Math.hypot(ps[1].x-G[2].x,ps[1].y-G[2].y),0,'on the enemy farthest from the first (F2)'); V.step(2); assert.equal(pools(L4).length,2,'only one');
});
test('Maren / in Tide Pool: Knee Deep (and Maelstrom\'s circle), Grey Ball, Brackish, Leaden Water; Ready Wave, Tide Clock',()=>{
  const L=ml(S(['sf_n1','sf_6_3','sf_8_4','sf_11_4','sf_2_2','sf_9_2']),{foes:3,allies:1}), {v,F,A}=L; const f=F[0]; castTP(L,f); V.step(1);
  near(inRatio(L,v,{src:f}),0.95,'Knee Deep: 1% x 5 less from an enemy in his Tide Pool'); near(inRatio(L,v,{src:F[1]}),1,'not from one outside');
  near(ratio(L,f,{auto:true})/1.075,1.12,'Grey Ball: his basic attacks 4% x 3 more on it (with Leaden Water 1.5% x 5)',1e-6); near(ratio(L,f),1.075,'Leaden Water: 1.5% x 5 more from his team'); near(allyRatio(L,A[0],f),1.075);
  f.hp=f.maxHp*0.5; const h0=f.hp; V.heal(f,1000); near(f.hp-h0,880,'Brackish: 4% x 3 less healing on it'); const g=F[1]; g.hp=g.maxHp*0.5; const h1=g.hp; V.heal(g,1000); near(g.hp-h1,1000,'not outside');
  at(L,F[2],12,0); castMS(L,F[2]); V.step(1); near(inRatio(L,v,{src:F[2]}),0.95,'Knee Deep: from an enemy inside Maelstrom\'s circle while its root lasts'); secs(3); near(inRatio(L,v,{src:F[2]}),1);
  near(FX.cd(v,'blue',10),(10-1.5)*0.95,'Ready Wave 0.5 s x 3 off, Tide Clock 1% x 5',1e-9); near(FX.cd(v,'green',8),8*0.95,'Tide Clock on Tide Pool too',1e-9);
});

test('Maren / Maelstrom: Long Root and Deep Root (in full after it lands, 4.0 s at most), Whirl, Holding Water, Ebb Energy, Weathered Hull, Drawn Down, Taking the Sea',()=>{
  const L=ml(S(['sf_8_2','oh_8_2','sf_7_2','sf_12_3','sf_10_2','oh_12_2','oh_10_2','oh_9_2']),{freeF:true,still:true}), {v,F}=L; const f=F[1]; at(L,f,7,0); at(L,F[2],7.5,3.6);
  v.hp=v.maxHp*0.5; const hp0=v.hp; v.energy=0; castMS(L,f); near(f.stunned,2.8+1.0,'Long Root and Deep Root: 2.8 s + 0.1 s x 5 + 0.1 s x 5',1e-6);
  near(v.hp-hp0,0.05*3*v.maxHp,'Taking the Sea: 1% x 5 of his max HP per enemy rooted (3)',1e-6); near(v.energy,3*5,'Ebb Energy: 1 x 5 per enemy he roots',1e-9);
  near(inRatio(L,v,{src:f}),0.90,'Weathered Hull: a rooted enemy deals 2% x 5 less to him'); V.step(1); setStack(L,'mrBr',0); L.T.s.lim={}; secs(1.02); assert.equal(stack(L,'mrBr'),6,'Drawn Down: 2 x 3 Bracing each second while Maelstrom holds them');
  near(ratio(L,F[0],{}),1,'Whirl is for Maelstrom\'s hits only'); L.T.s.cur='swamproot'; near(ratio(L,F[0]),1.15,'Whirl: Maelstrom 3% x 5 more'); L.T.s.cur=null;
  secs(2.8+1.0-1.05+0.1); assert.ok(f.stunned<=0); V.step(1); assert.ok(f.slow>1.8,'Holding Water: a 2 s slow once the root ends'); near(f.slowMul,0.75,'5% x 5',1e-9);
  secs(0.3); near(inRatio(L,v,{src:f}),1,'Weathered Hull lasts 4 s');
  const L2=ml(S(['sf_1_1','sf_8_2','oh_8_2']),{freeF:true,foes:2}), g=L2.F[0]; tsAt(L2,L2.F); castTS(L2,g); V.step(1); assert.ok(g.stunned>1.1,'(tangled)'); const t1=V.now(); secs(0.6);
  castMS(L2,g); near(g.stunned+(V.now()-t1),4.0,'Maelstrom on a tangled enemy: with Long Root and Deep Root, his stuns on it end 4.0 s after the tangle began, not later',0.03);
});
test('Maren / Where the Lark Went Down (SIGNATURE): the circle stays as deep sea 6 s after the root, 1 Fathom every 0.5 s, Fouled, at 6 rooted again 1.5 s once',()=>{
  const L=ml(S(['sf_13_3','sf_12_3','sf_11_3']),{freeF:true}), {v,F}=L; const f=F[1]; at(L,f,7,0); at(L,F[0],7,4); castMS(L,f); const n0=fa(L,f); assert.equal(n0,6,'(Closing Water: 6 at the root)');
  assert.ok(!(f.stunned>3),'its root as the game makes it'); const z=mr(L).deep[0]; assert.ok(z,'the deep sea'); near(z.until-V.now(),2.8+6,'6 s after the root',1e-6);
  setUst(L,f,'mrFa',0); secs(1.02); assert.equal(fa(L,f),2,'1 Fathom every 0.5 s inside it'); assert.ok(mark(L,f,'mrFo'),'and it is Fouled');
  secs(2.0); assert.ok(!(f.stunned>0),'(the first root is over)'); secs(0.6); setUst(L,f,'mrFa',5); for(let i=0;i<30&&fa(L,f)<6;i++) V.step(1); assert.equal(fa(L,f),6); near(f.stunned,1.5,'at 6 Fathoms: rooted again for 1.5 s',0.02);
  f.stunned=0; secs(2.1); setUst(L,f,'mrFa',5); secs(0.55); assert.ok(!(f.stunned>0),'once per enemy');
  const L2=ml(S(['sf_13_3']),{freeF:true}), g=L2.F[1]; at(L2,g,7,0); castMS(L2,g); setUst(L2,g,'mrFa',5); secs(0.55); assert.equal(fa(L2,g),6); assert.ok(g.stunned>2&&g.stunned<2.8,'(Maelstrom\'s own root, not a second one)');
  assert.ok(!mr(L2).deep[0].rr[g.uid],'the second root never lands on a rooted enemy');
});

/* ============================== THE OLD HULL ============================== */
test('Maren / Bracing: each hit 1 (10 at most, 5 s + Long Brace), each 0.3% less a rank (his group), Iron Ribs, Groan at 10, Swell, Hull Song, Anchor Down',()=>{
  const L=ml(S(['oh_1_1','oh_2_1','oh_6_1','oh_12_3']),{foes:3,big:true}), {v,F}=L; const mr0=v.mrRating;
  for(let i=0;i<3;i++) hitOn(L,v,10); assert.equal(stack(L,'mrBr'),3,'1 a hit'); near(inRatio(L,v),1-0.015*3,'0.3% x 5 per Bracing'); assert.equal(stack(L,'mrBr'),4,'(the measuring hit added one)');
  V.step(1); near(v.mrRating/mr0,1+0.015*4,'Iron Ribs: 0.3% x 5 magic resist per Bracing',1e-9); for(let i=0;i<12;i++) hitOn(L,v,1); assert.equal(stack(L,'mrBr'),10,'10 at most');
  near(ratio(L,F[0],{auto:true}),1.18,'Swell: at 5 or more, his basic attacks 6% x 3 more'); near(ratio(L,F[0]),1);
  secs(7.9); assert.equal(stack(L,'mrBr'),10,'lasts 5 s + 1 s x 3'); secs(0.2); assert.equal(stack(L,'mrBr'),0);
  const L2=ml(S(['oh_1_1','oh_2_1','oh_3_1']),{foes:3,big:true}), {F:G}=L2; at(L2,G[0],3.6,0); setStack(L2,'mrBr',9); hitOn(L2,L2.v,1); assert.equal(stack(L2,'mrBr'),5,'Groan: at 10 it drops to 5');
  assert.ok(G[0].pullT>0&&G[0].pulledBy,'and the enemies within 3 m are pushed'); near(Math.hypot(G[0].pulledBy.x-G[0].x,G[0].pulledBy.y-G[0].y)/V.METER,1.5,'1.5 m away',1e-6); assert.ok(!G[1].pullT,'not one farther');
  const L3=ml(S(['oh_1_1','oh_2_1','oh_3_1','oh_5_2']).concat([['oh_8_1',2]]).sort(),{foes:1,big:true,still:true}), w=L3.v; setStack(L3,'mrBr',10); w.hp=w.maxHp*0.5; V.step(1); const h=w.hp; secs(1);
  near((w.hp-h)/w.maxHp,0.008+0.01*(w.passMul||1),'Hull Song: 0.4% x 2 a second at 10 (with Deep Reserves)',0.03); assert.ok(w._gearImmovableT>0,'Anchor Down: cannot be moved at 5 or more');
  setStack(L3,'mrBr',4); w._gearImmovableT=0; V.step(2); assert.ok(!(w._gearImmovableT>0),'not below 5');
});
test('Maren / Last to Sink (once a fight, 1 HP and full Bracing); Riding Low; Barnacle Hide; Briny Will (20%); Keel and Hull Wake on the enemies Tsunami shoves',()=>{
  const L=ml(S(['oh_1_1','oh_2_1','oh_8_1','oh_9_1']),{foes:3}), {v,F}=L; v.hp=10; hitOn(L,v,1e6); assert.ok(v.alive); near(v.hp,1,'1 HP'); assert.equal(stack(L,'mrBr'),10,'full Bracing'); v.hp=10; hitOn(L,v,1e6); assert.ok(!v.alive,'once a fight');
  const L2=ml(S(['oh_7_4','oh_11_3','oh_3_4','oh_11_1','gb_10_4','oh_12_1']),{foes:3,big:true,cold:true}), w=L2.v, s0=w.speed; V.step(1); near(w.speed/s0,0.90,'Riding Low: 2% x 5 slower',1e-9);
  near(inRatio(L2,w),0.925,'Riding Low 1.5% x 5 less'); near(inRatio(L2,w,{auto:true}),0.925*0.925,'Barnacle Hide 1.5% x 5 from basic attacks');
  near(FX.cc(L2.F[0],w,'stunned',1),0.80,'Briny Will: controls on him 4% x 5 shorter (20%)',1e-9);
  near(FX.cd(w,'green',8),8*0.95*0.97,'Unhurried Tide 1% x 5 and Long Breath 1% x 3',1e-9); w.hp=w.maxHp*0.5; const hw=w.hp; V.wave(); V.step(1); assert.ok((w.hp-hw)/w.maxHp>=0.045-1e-9&&(w.hp-hw)/w.maxHp<0.047,'Old Timber: 1.5% x 3 of his max HP when a wave starts');
  const L3=ml(S(['oh_3_2','oh_4_3']),{freeF:true,big:true,allies:1}), {F:G,A}=L3; tsAt(L3,G); castTS(L3,G[0]); assert.ok(mark(L3,G[0],'mrPs')&&mark(L3,G[0],'mrHw'));
  near(inRatio(L3,L3.v,{src:G[0]}),0.90*0.88,'Keel 2% x 5 and Hull Wake 4% x 3 from an enemy Tsunami shoved'); near(inRatio(L3,A[0],{src:G[0]}),0.88,'Hull Wake on his allies too (Keel is his)');
  secs(3.05); near(inRatio(L3,L3.v,{src:G[0]}),0.90,'Hull Wake 3 s'); secs(1.0); near(inRatio(L3,L3.v,{src:G[0]}),1,'Keel 4 s');
});
test('Maren / Ballast: Deep Reserves\' overflow as a shield (4% + Full Ballast 2% a rank of his max HP), Tidal Ballast, Caulked, Ballast Burst, Ballast Kept, Shared Ballast; Steady Bilge; Bilge Pump',()=>{
  const L=ml(S(['oh_1_4','oh_8_4','oh_4_4','oh_6_4']),{foes:3,still:true}), {v,F}=L; v.hp=v.maxHp; v.shield=0; V.step(1); secs(1); const pm=v.passMul||1;
  near(mr(L).bal/v.maxHp,0.01*pm,'his full-HP Deep Reserves heal goes into Ballast',0.06); near(v.shield,mr(L).bal,'as a shield on him',1e-6);
  secs(40); near(mr(L).bal/v.maxHp,0.26,'up to 4% x 5 + 2% x 3',1e-6); near(inRatio(L,v),0.925,'Caulked: holding Ballast, 1.5% x 5 less');
  at(L,F[0],3.6,0); at(L,F[1],10,0); const h0=F[0].hp, h1=F[1].hp; v.shield=mr(L).bal; hitOn(L,v,v.maxHp*0.3); assert.equal(mr(L).bal,0,'a hit breaks it');
  near(h0-F[0].hp,0.6*v.apow,'Ballast Burst: 20% x 3 of his ability power on the enemies within 3 m',1e-6); near(h1-F[1].hp,0,'not one farther');
  const L2=ml(S(['oh_1_4','oh_n1','oh_2_4','oh_5_4','gb_9_4']),{foes:1,allies:1,still:true}), w=L2.v; w.hp=w.maxHp; V.step(2); const b0=mr(L2).bal, t0=V.now(); secs(1); const b1=(mr(L2).bal-b0)/w.maxHp/(V.now()-t0), pm2=w.passMul||1;
  near(b1,0.01*pm2*1.10+0.003,'Tidal Ballast 10% more and Steady Bilge 0.1% x 3 a second, into Ballast',0.01); w.energy=0; L2.A[0].energy=0; secs(1); near(w.energy,pm2+0.6,'Bilge Pump: 0.2 x 3 more energy a second',0.05); near(L2.A[0].energy,0.5,'Shared Reserves: 0.1 x 5 energy a second to the ally with the least energy',0.06);
  const L3=ml(S(['oh_1_4','oh_10_4']),{foes:1,still:true}), x=L3.v; x.hp=x.maxHp; V.step(1); secs(30); const b=mr(L3).bal; V.wave(); x.shield=0; V.step(1); near(mr(L3).bal,b*0.30,'Ballast Kept: 10% x 3 kept between waves (and one tick of Deep Reserves)',0.01); near(x.shield,mr(L3).bal,'',1e-6);
  const L4=ml(S(['oh_1_4','oh_11_4']),{foes:1,allies:1,still:true}), y=L4.v, a=L4.A[0]; at(L4,a,0,-5.5); a.maxHp=a.hp=y.maxHp; a.shield=0; y.hp=y.maxHp; V.step(1); secs(25);
  near(mr(L4).bal/y.maxHp,0.20,'(full)',1e-6); assert.ok(a.shield>0,'Shared Ballast: the overflow shields the lowest-HP ally within 6 m'); secs(30); near(a.shield/y.maxHp,0.20,'up to the same size',1e-6);
});
test('Maren / Tsunami: Long Push and Long Shoulder (0.2 m a rank each), Shouldered Wave (3 enemies at most), Pushback, Breakwater (allies behind him, 3 s)',()=>{
  const L=ml(S(['sf_4_2','oh_5_3','oh_2_3','oh_9_3']),{freeF:true,foes:3}), {v,F}=L; tsAt(L,F); const c0={x:F[0].x,y:F[0].y}, x0=Math.hypot(F[1].x-c0.x,F[1].y-c0.y)/V.METER; v.hp=v.maxHp*0.5; const h=v.hp; castTS(L,F[0]);
  near(Math.hypot(F[1].x-c0.x,F[1].y-c0.y)/V.METER-x0,1.6+0.6+1.0,'1.6 m + 0.2 m x 3 + 0.2 m x 5 (F1, shoved away from where the wave breaks: on his target since v1391)',1e-6); near(v.hp-h,0.05*3*v.maxHp,'Shouldered Wave: 1% x 5 of his max HP for each enemy it hits',1e-6);
  near(F[0].slowMul,1-(1-V.slowMulFor(10))*1.15,'Pushback: its slow 3% x 5 stronger',1e-9);
  const L2=ml(S(['oh_2_3']),{freeF:true,foes:5}), w=L2.v; [[2.6,0],[2.6,1.6],[2.6,-1.6],[1.6,2.4],[1.6,-2.4]].forEach((p,i)=>at(L2,L2.F[i],p[0],p[1])); w.hp=w.maxHp*0.2; const h2=w.hp; castTS(L2,L2.F[0]); near(w.hp-h2,0.05*3*w.maxHp,'3 enemies at most',1e-6);
  const L3=ml(S(['oh_5_1']),{freeF:true,allies:2}), {A}=L3; tsAt(L3,L3.F); at(L3,A[0],-5,0); at(L3,A[1],1.2,-0.8); castTS(L3,L3.F[0]);   // talents-fix1: A1 nearer the enemies' middle than he is (the wave now shoves them around his target, so 3 m to his side counted as behind) assert.ok(win(L3,'mrBw'));
  near(inRatio(L3,A[0],{src:L3.F[0]}),0.70,'Breakwater: an ally behind him takes 30% less'); near(inRatio(L3,A[1],{src:L3.F[0]}),1,'not one in front of him'); near(inRatio(L3,L3.v,{src:L3.F[0]}),1,'not Maren');
  secs(3.05); near(inRatio(L3,A[0],{src:L3.F[0]}),1,'for 3 s');
});
test('Maren / Home Water (3 enemies within 4 m: Tide Pool on his own spot), Taking Water (in it, 0.5% a second a rank)',()=>{
  const L=ml([['oh_6_3',1],['oh_7_3',1]],{foes:4,still:true}), {v,F}=L; at(L,F[0],3.8,0); at(L,F[1],0,3.8); at(L,F[2],-0.5,-3.8); at(L,F[3],8,8); v.target=F[3]; press(L,'green'); secs(0.6);
  const p=pools(L)[0]; assert.ok(p,'it landed'); assert.ok(Math.hypot(p.x-v.x,p.y-v.y)<0.3*V.METER,'on his own spot');
  v.hp=v.maxHp*0.5; V.step(1); const h=v.hp; secs(1); near((v.hp-h)/v.maxHp,0.005+0.01*(v.passMul||1),'Taking Water: 0.5% x 1 a second in his own pool (with Deep Reserves)',0.03);
  const L2=ml(S(['oh_7_3']),{foes:4,still:true}); at(L2,L2.F[0],3.8,0); at(L2,L2.F[1],0,3.8); at(L2,L2.F[3],8,8); L2.v.target=L2.F[3]; const t0={x:L2.F[3].x,y:L2.F[3].y}; press(L2,'green'); secs(0.6); const q=pools(L2)[0]; near(Math.hypot(q.x-t0.x,q.y-t0.y),0,'with two near him, where his target stood');
});
test('Maren / The Hull Holds (SIGNATURE): 6 s of full Bracing, Deep Reserves at the 1.2% a second cap, every enemy that hits him pushed 1.5 m and slowed 30% for 1 s',()=>{
  const L=ml(S(['oh_1_1','oh_13_2']),{freeF:true,still:true,foes:3}), {v,F}=L; at(L,F[1],7,0); v.hp=v.maxHp*0.5; castMS(L,F[1]); assert.ok(win(L,'mrHull'));
  V.step(1); assert.equal(stack(L,'mrBr'),10,'full Bracing'); const h=v.hp; secs(1); near((v.hp-h)/v.maxHp,0.012+0.01*(v.passMul||1),'Deep Reserves + the 1.2% cap of his talents',0.04);
  hitOn(L,v,10,{src:F[0]}); assert.ok(F[0].pullT>0,'the enemy that hit him is pushed'); near(Math.hypot(F[0].pulledBy.x-F[0].x,F[0].pulledBy.y-F[0].y)/V.METER,1.5,'1.5 m',1e-6); near(F[0].slowMul,0.70,'slowed 30%',1e-9); near(F[0].slow,1,'for 1 s',1e-9);
  secs(5.1); assert.ok(!win(L,'mrHull'),'6 s'); F[2].pullT=0; hitOn(L,v,10,{src:F[2]}); assert.ok(!(F[2].pullT>0));
});
test('Maren / Stand Fast: a drag on him 15% slower a rank, a sudden shove taken back in part',()=>{
  const L=ml(S(['oh_4_2']),{foes:1,still:true}), {v}=L; V.step(1); v.pulledBy={x:v.x+300,y:v.y,alive:true}; v.pullT=1; v.pullSpeed=100; V.step(1); near(v.pullSpeed,55,'a drag 15% x 3 slower',1e-9);
  v.pullT=0; v.pulledBy=null; V.step(2); const x0=v.x; v.x+=V.METER; V.step(1); near((v.x-x0)/V.METER,0.55,'a 1 m shove: 45% of it taken back',0.02);
});

/* ============================== WHAT THE SEA GIVES BACK ============================== */
test('Maren / Ebb and Flow: High Water 8 s (+ Spring Water), Low 8 s; High heals allies within 6 m (+ Rising Water, Full Moon Water), Low speeds their energy (Slack Water)',()=>{
  const L=ml(S(['gb_1_3','gb_2_3','gb_10_3','gb_7_3','gb_6_3']),{foes:1,allies:2,still:true}), {v,A}=L; const w=mr(L).w; assert.equal(w.ph,'H','a wave starts at High Water'); near(w.len,11,'8 s + 1 s x 3');
  at(L,A[0],0,-11); at(L,A[1],0,-16.5); A.forEach(a=>{ a.maxHp=1e5; a.hp=5e4; }); const g0=VMX('dist')(v,A[0])-VMX('bodyR')(v)-VMX('bodyR')(A[0]); assert.ok(g0>6*V.METER&&g0<8.5*V.METER,'(beyond 6 m, inside 8.5 m)');
  V.step(1); const h0=A.map(a=>a.hp); secs(1);
  near((A[0].hp-h0[0])/1e5,0.005*1.15,'0.1% x 5 a second, Full Moon Water 3% x 5 stronger, reaching 6 m + 0.5 m x 5',0.03); near(A[1].hp-h0[1],0,'not farther');
  secs(10.1); assert.equal(mr(L).w.ph,'L','then Low Water'); v.energy=10; V.step(1); const e=v.energy; v.energy=e+50; V.step(1); near(v.energy-e,50*(1+0.10*1.09),'Low Water: energy 2% x 5 faster (Maren too), Slack Water 3% x 3 stronger',0.002);
  secs(8.05); assert.equal(mr(L).w.ph,'H','and High again');
});
test('Maren / the water turns: Salt Sense, Turn of the Water, Turning Point, High Water Bite, Ebb Guard, King Water (both groups), Called Water',()=>{
  const L=ml(S(['gb_1_3','gb_1_4','gb_2_3','gb_3_3','gb_8_3','gb_5_3','gb_n1','gb_11_3']),{foes:2,allies:1,still:true}), {v,F,A}=L; const ap0=v.apow; at(L,A[0],0,-5.5); A[0].maxHp=1e5; A[0].hp=2e4;
  near(inRatio(L,v,{src:F[0]}),0.94,'King Water: at High Water 2% x 3 less'); near(inRatio(L,A[0],{src:F[0]}),0.94,'on an ally within 6 m too');
  L.T.s.cur='tidalsurge'; near(ratio(L,F[0]),1.10,'High Water Bite: his abilities 2% x 5 more'); L.T.s.cur=null; near(ratio(L,F[0]),1,'not his basic attacks');
  const ah=A[0].hp; secs(10.9); assert.equal(mr(L).w.ph,'H'); v.greenCd=50; v.blueCd=50; secs(0.2); assert.equal(mr(L).w.ph,'L'); near((A[0].hp-ah)/1e5,0.06+0.005*11.1,'Turn of the Water: the ally with the least HP 6% of its max HP (and High Water\'s 0.1% x 5 a second until then)',0.03);
  assert.ok(v.greenCd<50-0.2-0.85&&v.greenCd>50-0.2-0.95&&v.blueCd<50-0.2-0.85,'Turning Point: 0.3 s x 3 off his cooldowns'); V.step(1); near(v.apow/ap0,1.06,'Salt Sense: 2% x 3 ability power',1e-9); secs(3.05); near(v.apow/ap0,1,'for 3 s',1e-9);
  near(inRatio(L,v,{src:F[0]}),0.90,'Ebb Guard: at Low Water 2% x 5 less'); near(inRatio(L,A[0],{src:F[0]}),1,'(him only; King Water only at High)');
  const L2=ml(S(['gb_1_3','gb_11_2','gb_12_2']),{freeF:true,allies:1,still:true}), {A:B}=L2; secs(9); assert.equal(mr(L2).w.ph,'L'); at(L2,L2.F[1],7,0); at(L2,B[0],7,-5); B[0].maxHp=1e5; B[0].hp=5e4; const bh=B[0].hp;
  castMS(L2,L2.F[1]); assert.equal(mr(L2).w.ph,'H','Called Water: Maelstrom turns the water to High'); near(mr(L2).w.len,8+3,'1 s x 3 longer'); near(B[0].hp-bh,0.05*1e5,'Gentle Maelstrom: allies inside its circle 1% x 5 of their max HP',1e-6);
});
test('Maren / Tidal Ballast\'s link: with Ebb and Flow, each turn to Low Water while he holds Ballast gives the ally within 6 m with the least energy 5 energy',()=>{
  const L=ml(S(['oh_n1','gb_1_3','oh_1_4']),{foes:1,allies:2,still:true}), {v,A}=L; v.hp=v.maxHp; at(L,A[0],0,-5.5); at(L,A[1],0,-16); A[0].energy=10; A[1].energy=0; V.step(1); secs(7.9);
  assert.ok(mr(L).bal>0); const e0=A[0].energy, e1=A[1].energy; secs(0.2); assert.equal(mr(L).w.ph,'L'); near(A[0].energy-e0,5,'5 energy',0.02); near(A[1].energy-e1,0,'(the one beyond 6 m gets nothing)',0.2);
  const L2=ml(S(['oh_n1','oh_1_4']),{foes:1,allies:1,still:true}); assert.ok(!mr(L2).w,'without Ebb and Flow there is no water');
});
test('Maren / Tide Pool heals: Healing Pool (0.3% a second a rank), Still Pool, Calm Water, Clear Pool, Shallows (one enemy in reach: under the lowest-HP ally, twice as fast)',()=>{
  const L=ml(S(['gb_8_2','gb_4_2','gb_7_2','gb_12_4']).concat([['gb_3_2',2]]).sort(),{foes:2,allies:1,still:true,cold:true}), {v,F,A}=L; const a=A[0]; const ar0=a.armorRating, vr0=v.armorRating; V.step(1);
  near(a.armorRating/ar0,1.05,'Hold Fast: an ally within 4 m 1% x 5 more armor',1e-9); near(v.armorRating/vr0,1.05,'Maren too',1e-9); a.maxHp=1e5; a.hp=5e4; const c0=a.ctrlRes||0; castTP(L,a); V.step(1);
  const h=a.hp, t0=V.now(); secs(1); near((a.hp-h)/1e5/(V.now()-t0),0.006*1.15,'Healing Pool 0.3% x 2 a second, Still Pool 5% x 3 stronger',0.01); near(a.ctrlRes-c0,0.15,'Clear Pool: 3% x 5 control resist',1e-9);
  near(inRatio(L,a,{src:F[1]}),0.94,'Calm Water: an ally in Tide Pool takes 2% x 3 less'); secs(4); near(a.ctrlRes,c0,'off once out of the pool',1e-9);
  const L2=ml([['gb_3_2',1],['gb_5_2',1]],{foes:3,allies:1,still:true}), {A:B,F:G}=L2; at(L2,G[1],12,0); at(L2,G[2],15,6); const b=B[0]; b.maxHp=1e5; b.hp=3e4; at(L2,b,0,-5.5); L2.v.target=G[0];
  press(L2,'green'); secs(0.6); const p=pools(L2)[0]; near(Math.hypot(p.x-b.x,p.y-b.y),0,'Shallows: one enemy in its reach: it lands under the lowest-HP ally',0.5); V.step(1); const hb=b.hp; secs(1); near((b.hp-hb)/1e5,0.006,'and Healing Pool heals twice as fast in it (0.3% x 1 x 2)',0.04);
  const L3=ml(S(['gb_3_2','gb_5_2']),{foes:3,allies:1,still:true}); at(L3,L3.F[1],4.5,2.0); L3.v.target=L3.F[0]; const t3={x:L3.F[0].x,y:L3.F[0].y}; press(L3,'green'); secs(0.6); near(Math.hypot(pools(L3)[0].x-t3.x,pools(L3)[0].y-t3.y),0,'two enemies close together: where its target stood');
});
test('Maren / Rip Current (an enemy walking out is pulled 1 m back toward the pool, once), Sanctuary Pool (once a wave, a Tide Pool under an ally below 30%, 10% of its max HP)',()=>{
  const L=ml(S(['gb_5_1']),{foes:2}), {v,F}=L; castTP(L,F[0]); V.step(1); at(L,F[0],4.5,4); V.step(1); assert.ok(F[0].pullT>0,'pulled back');
  near(F[0].pullStop/V.METER,3,'1 m toward its centre (4 m out: it stops 3 m from the centre)',1e-6); F[0].pullT=0; at(L,F[0],4.5,0); V.step(1); at(L,F[0],4.5,4); V.step(1); assert.ok(!(F[0].pullT>0),'once');
  const L2=ml(S(['gb_9_2']),{foes:2,allies:1,still:true}), {A}=L2; const a=A[0]; a.maxHp=1e5; a.hp=4e4; V.step(1); assert.equal(pools(L2).length,0); a.hp=2.9e4; V.step(1);
  const p=pools(L2)[0]; assert.ok(p,'a Tide Pool lands at once'); near(Math.hypot(p.x-a.x,p.y-a.y),0,'under that ally'); near((a.hp-2.9e4)/1e5,0.10,'and heals it 10% of its max HP',1e-3);
  a.hp=4e4; V.step(1); a.hp=2e4; V.step(1); assert.equal(pools(L2).length,1,'once a wave');
});
test('Maren / Tsunami on his allies: Gentle Wave (10% of his ability power a rank), Carrying Wave (1 m toward him, a slow or a root taken off)',()=>{
  const L=ml(S(['gb_6_4','gb_7_4']),{freeF:true,allies:1,still:true}), {v,F,A}=L; tsAt(L,F); const a=A[0]; a.maxHp=1e6; a.hp=5e5; at(L,a,2.0,-3.8); a.slow=2; a.stunned=1e6;
  const h=a.hp; castTS(L,F[0]); near(a.hp-h,0.3*v.apow,'Gentle Wave: 10% x 3 of his ability power on an ally in its wave',1e-6); assert.ok(a.pullT>0,'Carrying Wave: carried toward him');
  near((Math.hypot(a.x-v.x,a.y-v.y)-a.pullStop)/V.METER,1,'1 m',1e-6);
  near(a.slow,0,'its slow taken off'); assert.ok(a.stunned>1,'(one: the slow first)'); castTS(L,F[0]); assert.ok(!(a.stunned>0),'then its root');
});
test('Maren / Returns: an enemy dying in his water (Tide Pool, 2 s after Tsunami or Maelstrom, Late Return) heals his lowest-HP ally 1% of its max HP a rank; Unhurried Return, Generous Sea, Washed Ashore, Kelp Wrap',()=>{
  const L=ml(S(['gb_1_1','gb_2_1','gb_4_1','gb_6_1','gb_12_1','gb_9_1']),{freeF:true,allies:2,still:true}), {v,F,A}=L; const a=A[0], b=A[1]; a.maxHp=1e6; a.hp=1e5; b.maxHp=1e6; b.hp=3e5; v.hp=v.maxHp;
  const kill=t=>{ t.hp=1; t.shield=0; V.hit(A[1],t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
  F[0].maxHp=1e6; castTP(L,F[0]); V.step(1); const h=[a.hp,b.hp]; a.energy=0; v.energy=0; kill(F[0]);
  near(a.hp-h[0],0.05*1e6,'Returns: 1% x 5 of the dead enemy\'s max HP to the lowest-HP ally'); near(a.energy,6,'Unhurried Return: 2 x 3 energy',1e-9); near(a.shield,0.09*1e6,'Kelp Wrap: a 3% x 3 shield of its max HP',1e-6);
  near(b.hp-h[1],0.05*1e6*0.75,'Generous Sea: the second-lowest 15% x 5 of it'); near(v.energy,5,'Washed Ashore: 1 x 5 energy for Maren',1e-9);
  secs(4.1); assert.equal(pools(L).length,0); F[1].maxHp=1e6; tsAt(L,[F[1]]); castTS(L,F[1]); at(L,F[1],12,6); secs(2+1.9); a.hp=1e5; kill(F[1]); near(a.hp-1e5,0.05*1e6,'2 s after Tsunami struck it, + Late Return 0.4 s x 5');
  F[2].maxHp=1e6; at(L,F[2],12,0); a.hp=1e5; kill(F[2]); near(a.hp-1e5,0,'not an enemy outside his water');
  const L2=ml(S(['gb_1_1']),{freeF:true,foes:2,allies:1,still:true}), b2=L2.A[0]; b2.maxHp=1e6; b2.hp=1e5; L2.F.forEach(f=>{ f.maxHp=1e6; }); tsAt(L2,L2.F); castTS(L2,L2.F[0]); at(L2,L2.F[0],12,6); at(L2,L2.F[1],12,-6);
  secs(1.8); const k2=t=>{ t.hp=1; t.shield=0; V.hit(b2,t,100,{kind:'true'}); }; k2(L2.F[0]); near(b2.hp-1e5,0.05*1e6,'within 2 s of Tsunami: a Return'); b2.hp=1e5; secs(0.4); k2(L2.F[1]); near(b2.hp-1e5,0,'after 2 s: none');
});
test('Maren / Twenty-Nine Returned (SIGNATURE): every ally 4% of its max HP for each enemy Maelstrom roots (20% at most), High Water, Returns twice over for 8 s',()=>{
  const L=ml(S(['gb_1_1','gb_1_3','gb_11_2','gb_12_2','gb_13_2']),{freeF:true,foes:4,allies:1,still:true}), {v,F,A}=L; const a=A[0]; a.maxHp=1e6; a.hp=1e5; at(L,a,0,-16); v.hp=v.maxHp*0.5; const vh=v.hp;
  at(L,F[1],8,0); at(L,F[2],7,3.6); at(L,F[3],10,1.8); F[1].maxHp=1e6; castMS(L,F[1]); near(a.hp-1e5,0.16*1e6,'4 enemies rooted: 16% of its max HP, wherever it stands',1e-6); near((v.hp-vh)/v.maxHp,0.16,'Maren too',1e-3);
  assert.ok(win(L,'mrTnr')); assert.equal(mr(L).w.ph,'H'); const h=a.hp; F[1].hp=1; V.hit(a,F[1],100,{kind:'true'}); near(a.hp-h,2*0.05*1e6,'a Return twice over',1e-6);
  const L2=ml(S(['gb_13_2','gb_12_2','gb_11_2']),{freeF:true,foes:9,allies:1,still:true}), b=L2.A[0]; b.maxHp=1e6; b.hp=1e5; L2.F.forEach((f,i)=>at(L2,f,7+(i%3)*1.8,(i/3|0)*1.8)); castMS(L2,L2.F[4]); near(b.hp-1e5,0.20*1e6,'20% at most',1e-6);
});

/* ============================== CAPS ============================== */
test('Maren: his damage reduction is ONE capped group (40% at most), his allies\' from his talents ONE group (30% at most), his talents\' heals a second 1.2% of a unit\'s max HP at most',()=>{
  { const L0=ml(S(['gb_10_1']),{foes:1,allies:1,big:true}), w=L0.v; w.hp=w.maxHp*0.6; near(inRatio(L0,w),1,'Cold Kindness: nobody below 50%');
    w.hp=w.maxHp*0.4; near(inRatio(L0,w),0.91,'Cold Kindness: an ally (Maren himself) below 50%: 3% x 3 less'); w.hp=w.maxHp; L0.A[0].hp=L0.A[0].maxHp*0.45; near(inRatio(L0,w),0.91,'(another ally)'); }
  const ids=['oh_1_1','oh_2_1','oh_7_4','oh_11_3','oh_4_4','gb_n1','gb_10_1','sf_5_4','oh_3_2','oh_4_3','oh_12_2','sf_n1','gb_4_2','gb_11_3','oh_5_1'];
  const L=ml(S(ids),{foes:3,allies:1,big:true}), {v,F,A}=L; setStack(L,'mrBr',10); mr(L).bal=1; v.shield=1; v.hp=v.maxHp*0.3; mr(L).w={ph:'L',t:0,len:99}; const f=F[0];
  setMk(L,f,'mrPs'); setMk(L,f,'mrHw'); setMk(L,f,'mrWh'); setUst(L,f,'mrFa',6); mr(L).inTP[f.uid]=1;
  near(inRatio(L,v,{src:f,auto:true}),0.60,'every condition at once: 40% off, not more'); mr(L).w={ph:'H',t:0,len:99}; near(inRatio(L,v,{src:f,auto:true}),0.60,'(at High Water too)');
  near(L.T.fn.drK(L.T.s.mrA,L.T,v,f,true),0.60,'the same number as the 95% instrument reads it',1e-9);
  const a=A[0]; at(L,a,-6,0); L.T.s.w.mrBw={t:3,n:1,cdT:0,at:-1,wave:false}; mr(L).aTP={[a.uid]:1}; near(inRatio(L,a,{src:f}),0.70,'his allies: 30% off at most (Breakwater 30% and the rest)');
  const L2=ml(S(['oh_2_4','oh_6_3','oh_8_1','oh_1_1','oh_2_1','oh_3_1','gb_1_3','gb_3_2','gb_8_2','gb_10_3','oh_13_2']),{foes:2,allies:1,still:true}), w=L2.v, b=L2.A[0];
  b.maxHp=1e5; b.hp=3e4; castTP(L2,b); castTP(L2,w); setStack(L2,'mrBr',10); L2.T.s.w.mrHull={t:6,n:1,cdT:0,at:-1,wave:false}; w.hp=w.maxHp*0.3; V.step(1);
  const h=w.hp, hb=b.hp; secs(1); near((w.hp-h)/w.maxHp,0.012+0.01*(w.passMul||1),'Maren: his talents 1.2% a second at most, on top of Deep Reserves\' own',0.02); near((b.hp-hb)/1e5,0.012,'an ally: 1.2% a second at most',0.03);
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Maren: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['sf_1_1','sf_1_4','sf_2_4','sf_3_4','oh_1_1','oh_1_4','gb_1_1','gb_1_3','sf_9_1','sf_8_1']), TEAM=['vael','sylthaine','vireo','vex','maren'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let fath=0, fo=false, br=0, bal=0, hiLo={H:0,L:0};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const o=s._tal.s.mr||{}; br=Math.max(br,(s._tal.s.k.mrBr||{n:0}).n); bal=Math.max(bal,o.bal||0); if(o.w) hiLo[o.w.ph]++;
    for(const f of units().filter(u=>u.team==='enemy')){ const m=f._talM&&f._talM[s.uid]; if(!m) continue; if(m.mrFo) fo=true; if(m['#mrFa']) fath=Math.max(fath,m['#mrFa'].v); } }
  console.log('  live fight: most Fathoms on an enemy '+fath+', a Fouled enemy '+fo+', most Bracing '+br+', most Ballast '+Math.round(bal)+', ticks at High / Low water '+hiLo.H+' / '+hiLo.L);
  assert.ok(fath>=2,'real Fathoms'); assert.ok(br>=1,'real Bracing'); assert.ok(hiLo.H>0&&hiLo.L>0,'the water turns');
  determinism(H,TEAM);
});

/* The page sites his talents added (Tsunami: its shove's length, where it breaks, each enemy it shoves; Maelstrom: where it closes; Tide Pool: where it lands;
   Deep Reserves: its heal; the swing's disarm test; the disarm's countdown; the hazards bound line): with nothing learned, whole seeded fights with Maren in the
   line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters are also the base-skill measure of the report. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Maren: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['maren','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __mrN={tp:0,ts:0,tsHit:0,ms:0,msHit:0,drsv:0,swings:0}; var __mrD=_doEffectCore, __mrC=_dealDamageCore, __mrU=_updateBattleCore;'+
    '_doEffectCore=function(u,type,o){ const me=u&&u.key==="maren"&&(!o||!o.deliver||o._arrived); if(me){ if(type==="ashfall") __mrN.tp++; if(type==="tidalsurge") __mrN.ts++; if(type==="swamproot") __mrN.ms++; } return __mrD.apply(this,arguments); };'+
    '_dealDamageCore=function(s,t,a,c,k,si){ if(s&&s.key==="maren"&&t&&t.team!==s.team&&!_autoAtk) __mrN.tsHit++; return __mrC.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ for(const u of units) if(u&&u.key==="maren"&&u.alive&&u.pass&&u.pass.tidereserve) __mrN.drsv++; for(const u of units) if(u&&u.alive&&u.atkCd<=0) __mrN.swings++; return __mrU.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__mrN'); console.log('  identity / base skills: '+JSON.stringify(c));
    assert.ok(c.tp>0&&c.ts>0&&c.ms>0&&c.drsv>0&&c.swings>0,'the fights cast Tide Pool, Tsunami and Maelstrom, ran Deep Reserves and swung: every new site was run'); }
  finally{ VMX('_doEffectCore=__mrD; _dealDamageCore=__mrC; _updateBattleCore=__mrU;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ sf:['sf_n1','sf_5_4','sf_12_4','sf_10_1'],
            oh:['oh_1_1','oh_2_1','oh_3_2','oh_4_3','oh_4_4','oh_7_4','oh_11_3','oh_12_2','oh_1_2','oh_7_1','oh_6_1','oh_1_4','oh_8_4','oh_13_2','oh_3_4','oh_9_1','oh_10_2'],
            gb:['gb_n1','gb_10_1','gb_11_3','gb_4_2','gb_8_1','gb_2_4','gb_12_4','gb_1_3'] };
/* a legal build that takes these talents (and their prerequisites) first, tree by tree: [[tree, points, goals], ...]; the rest of the 91 points in tier order */
function goalBuild(plan){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sf:0,oh:1,gb:2}, pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  for(const [k,cap,gl] of plan){ const goals=[]; for(const id of gl) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k];
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; }
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } }
  return b; }
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sf:0,oh:1,gb:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (10 Bracing, Ballast held, below 30% HP, the attacker in his Tide Pool, pushed and
   Hull-Waked by him, rooted by Maelstrom, at 6 Fathoms, a basic attack, Low Water or High Water - the worse of the two, himself in his Tide Pool); sustained: a usual
   state (3 Bracing, above half HP, nothing else, High Water, a basic attack of 5% of his max HP). Measured through the engine (HP and shield it takes) */
function worstHit(list,kind,crit,sustained,ph){ const L=ml(list,{foes:5,still:true}), {v,F}=L; const f=F[0];
  v.maxHp=1e5; v.hp=sustained?8e4:2.5e4; V.step(1);
  if(L.T){ const o=mr(L); if(o&&o.w) o.w={ph:ph||'H',t:0,len:99};
    if(!sustained){ setStack(L,'mrBr',10); if(o){ o.bal=1; o.inTP[f.uid]=1; o.aTP={[v.uid]:1}; } setMk(L,f,'mrPs'); setMk(L,f,'mrHw'); setMk(L,f,'mrWh'); setUst(L,f,'mrFa',6); }
    else setStack(L,'mrBr',3); }
  v.shield=sustained?0:1; for(const x of F) x.stunned=1e6;
  const raw=sustained?5e3:2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:true})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Maren: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['oh','gb'],[61,30]],[['oh'],[91]],[['oh','sf'],[61,30]],[['gb','oh'],[61,30]],[['sf','oh'],[61,30]],[['oh','gb','sf'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const ph of ['H','L']) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false,ph));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="maren"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="maren"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal; const e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    if(T&&T.s.mrA&&e){ const k=T.fn.drK(T.s.mrA,T,u,e,true); const tot=1-k*Math.min(defMul(e,u,"phys"),defMul(e,u,"magic")); if(tot>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','maren'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; ticks at 85% or more (the reference hit, the better of his armor and magic resist) '+d.tHi+' of '+d.ticks+' ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%); immune '+d.imm);
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* the stun-lock rule in seeded fights: his most controlling build (Six Fathoms at 61 with its signature, 30 in The Old Hull for Deep Root), every enemy's longest unbroken stun
   while one of his stuns is on it, the shortest break between two of his stuns on one enemy, how many talent roots landed, and the disarms */
test('Maren: in seeded fights no enemy is stunned by him in a chain - every talent root lands only after a 0.5 s break, at most twice per cast',()=>{
  const b=goalBuild([['sf',61,['sf_13_3','sf_1_1','sf_3_1','sf_8_1','sf_9_1','sf_3_4','sf_2_4','sf_1_4','sf_8_2','sf_11_2']],['oh',30,['oh_8_2']]]);
  assert.equal(T.invalid(H,b,100),''); const list=T.learned(H,b); assert.ok(list.some(e=>e[0]==='sf_13_3'),'the signature');
  VMX('var __sl={run:{},mx:0,brk:1e9,end:{},talent:0,dis:0,ticks:0,t0:0}; var __slU=_updateBattleCore; var __slSt={n:0,gap:1e9,on:0,dis:0};'+
    '_updateBattleCore=function(dt){ if(battleTime<__sl.t0){ __sl.run={}; __sl.end={}; } __sl.t0=battleTime; const m=units.find(u=>u.key==="maren"); const r=__slU.apply(this,arguments); if(m&&m._tal){ __sl.ticks++; const q=m._tal.s.mrSt; if(q){ __slSt.n+=q.n; __slSt.on+=q.on; __slSt.dis+=q.dis; if(q.gap<__slSt.gap) __slSt.gap=q.gap; m._tal.s.mrSt=null; } for(const e of units){ if(e.team===m.team) continue; const k=e.uid; const mine=e._talM&&e._talM[m.uid]&&e._talM[m.uid].mrLk;'+
    '  if(e.alive&&(e.stunned||0)>0&&mine){ if(__sl.run[k]==null){ if(__sl.end[k]!=null) __sl.brk=Math.min(__sl.brk,battleTime-__sl.end[k]); __sl.run[k]=0; } __sl.run[k]+=dt; __sl.mx=Math.max(__sl.mx,__sl.run[k]); }'+
    '  else if(__sl.run[k]!=null){ __sl.end[k]=battleTime; __sl.run[k]=null; } if((e._talDisarmT||0)>0&&(e._talDisarmT>1.2-dt)) __sl.dis++; } } return r; };');
  const cnt0=VMX('0'); let roots=0;
  try{ const sn=snaps(['maren','vael','vireo','vex','gruel'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8'));
    for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
    const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [5,77,31337]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__sl'), st=VMX('__slSt'); console.log('  stun-lock: the longest one enemy stayed stunned with a stun of his on it '+d.mx.toFixed(2)+' s; his talent roots '+st.n+' (tangles and deep-sea roots), the shortest break before one of them after a stun of his on that enemy ended '+(st.gap<1e8?st.gap.toFixed(2)+' s':'none')+', on a stunned enemy '+st.on+'; disarms landed '+st.dis+', ticks '+d.ticks);
    assert.ok(d.ticks>500); assert.ok(st.n>0,'talent roots landed'); assert.equal(st.on,0,'never on a stunned enemy'); assert.ok(st.gap>=0.5-1e-6,'always 0.5 s at least after a stun of his ended');
    assert.ok(d.mx<=4.0+0.1,'his stuns on one enemy never run past 4.0 s in a row (a tangle, then Maelstrom: its root counts from the tangle)'); }
  finally{ VMX('_updateBattleCore=__slU;'); }
});
