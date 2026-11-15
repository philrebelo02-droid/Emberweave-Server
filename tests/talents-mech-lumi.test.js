'use strict';
/* Lumi's talents as data on the mechanics layer (talents-mech/lumi.js), group by group on the still field (tests/talents-lab.js), then whole fights, the
   no-talent identity of the page sites her talents added (Hush), and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one (lab() replaces the whole field).
   ll(): the lab with Lumi, two allies and three foes, everyone held; her Hush clock is parked (hushOff) so it fires only when a test asks (hush()).
   RADIANT NOVA: the game measures its 6 m from HER CENTRE and she stands about 15 m back, so its enemy part reaches an enemy on few casts in real fights
   (tests/lumi-kit-facts.js). That is not changed here; these tests put the enemy 4.5 m from her centre (inside the 6 m), so they are about her talents.
   Places (metres from Lumi, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0); A0 (0,-5.5) A1 (0,-11). The lab's skill level is 10.
   Run: node --test tests/talents-mech-lumi.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='lumi', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const stk=(L,name)=>{ const k=L.T.s.k[name]; return k?k.n:0; };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const ustLeft=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return m?m.until-V.now():0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d||99)}; };
const mk=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o[name]; return !!m&&(m.until==null||m.until>V.now()); };
const left=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o[name]; return m&&m.until!=null?m.until-V.now():0; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const lu=L=>L.T.s.lu||(L.T.s.lu={});
const brnd=x=>VMX('var __lbr=(typeof __lbr!=="undefined"&&__lbr)?__lbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __lbr!=="undefined"&&__lbr){ brnd=__lbr; __lbr=null; }');
const SL=10, SM=VMX('skillMul')(SL);                         // the lab's skill level and its multiplier
const hushOff=L=>{ L.v._hushT=-1e9; };
const hush=L=>{ L.v._hushT=1e3; V.step(1); hushOff(L); };   // Hush fires on this step (once: one test per step)
function ll(list,o){ o=o||{}; const L=lab(H,list,{allies:o.allies==null?2:o.allies,foes:o.foes==null?3:o.foes,big:o.big,seed:o.seed}); hushOff(L);
  for(const x of L.U){ x.energy=0; } if(o.pre) o.pre(L); return L; }
const plain=(o,fn)=>fn(ll(null,o));
const castDW=L=>V.cast(L.v,'green'), castQK=L=>V.cast(L.v,'blue'), nova=L=>V.cast(L.v,'ult');
const tru=o=>Object.assign({kind:'true'},o||{});
const hitOn=(L,src,t,amt,o)=>lost(t,()=>V.hit(src,t,amt||1000,tru(o)));
const dealt=(L,src,t,amt,o)=>lost(t,()=>V.hit(src,t,amt||1000,tru(o)));
const ratioIn=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const ratioOut=(L,src,t,o)=>{ const h=t.hp, a=dealt(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>dealt(L,src,t,1000,o)); t.hp=h; return a/b; };
const healGot=(t,fn)=>{ const h=t.hp; fn(); return t.hp-h; };
const low=(x,f)=>{ x.hp=x.maxHp*f; };
const think=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };   // a unit that thinks (its cooldowns and casts run) but does nothing
const wardOn=(L,x)=>{ for(const y of L.U.filter(a=>a.team==='ally')) if(y!==x) y.hp=y.maxHp; low(x,0.3); castDW(L); };

test('Lumi: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['fm_2_4','fm_9_4','fm_1_4','qh_3_3','qh_11_4','qh_12_3','fl_1_1','fl_7_1','fl_12_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const M=FXN.mech(H); for(const id of ['fm_13_3','qh_13_2','fl_13_2','fl_n1','fm_1_2','qh_1_1','fl_1_3']) assert.ok(M.talents[id],id);
});

test('Lumi: her real kit, as the talents read it - Dawnward on the lowest HP share, Quickening on everyone, Radiant Nova from her centre, Hush every 5 s',()=>{
  const L=ll(null), {v,A,F}=L; assert.ok(!v._tal,'no talents: no runtime');
  low(A[0],0.3); castDW(L); near(A[0]._wardT,3+0.01*(SL-1),'Dawnward holds the lowest HP share ally 3 s + 0.01 s a level',1e-9); assert.ok(!(v._wardT>0)&&!(A[1]._wardT>0),'(only that one)');
  castQK(L); for(const x of [v,A[0],A[1]]){ near(x.hasteMul,1.3+0.001*(SL-1),'Quickening: x1.3 + 0.001 a level, on every ally (Lumi included)',1e-9); near(x.hasteT,5,'for 5 s',1e-9); }
  for(const a of A) low(a,0.2); const f0=F[0].hp, f1=F[1].hp, a0=A[0].hp, a1=A[1].hp; nova(L);
  assert.ok(F[0].hp<f0,'Radiant Nova strikes the enemy 4.5 m from her centre'); assert.equal(F[1].hp,f1,'not the one 10 m away (its 6 m from her centre)');
  near(A[0].hp-a0,A[0].maxHp*0.35*SM,'it heals the ally 5.5 m away 35% of its max HP x skill level',1e-6); assert.equal(A[1].hp,a1,'not the ally 11 m away');
  const L2=ll(null,{foes:1}); L2.v._hushT=4.99; V.step(1); near(L2.F[0].silencedT,0.7*L2.v.passMul,'Hush: every 5 s one enemy, 0.7 s x its level',0.05); assert.ok(L2.v._hushT<1,'its clock went round');
});

/* ======================= THE FOURTH MORNING ======================= */
test('Lumi / Willing: Willing Heart (her Dawnward\'s ally, 8 s, 1.5% x 5 less damage taken and 1.5% x 5 more dealt), Stubborn Hope, Willing Hearts (points), Morning Gold',()=>{
  const L=ll(S(['fm_1_2','fm_2_2','fm_12_3','fm_12_1'])), {v,A,F}=L;
  wardOn(L,A[0]); assert.ok(mk(L,A[0],'wl'),'the ally Dawnward wards is Willing'); near(left(L,A[0],'wl'),8+3,'8 s + Stubborn Hope 1 x 3',1e-6);
  near(ratioIn(L,F[0],A[0]),1-0.075,'it takes 7.5% less',1e-9);
  near(ratioOut(L,A[0],F[0]),1+0.075+0.025,'it deals 7.5% + Willing Hearts 0.5 points x 5 more',1e-9);
  assert.ok(!mk(L,A[1],'wl'),'(only the warded one)');
  secs(11.1); assert.ok(!mk(L,A[0],'wl'),'over after 11 s'); assert.ok(mk(L,A[0],'wh'),'Morning Gold: half of it stays');
  near(ratioIn(L,F[0],A[0]),1-0.0375,'half the reduction',1e-9); near(ratioOut(L,A[0],F[0]),1+0.05,'half the bonus',1e-9);
  secs(3.1); assert.ok(!mk(L,A[0],'wh'),'for 1 s x 3'); near(ratioIn(L,F[0],A[0]),1,'then nothing',1e-9);
  const W=ll(S(['fm_1_2'])); wardOn(W,W.v); assert.ok(mk(W,W.v,'wl'),'Lumi herself, when the ward is hers'); W.v.hp=W.v.maxHp; near(ratioIn(W,W.F[0],W.v),0.925,'(her own rows: 7.5% too)',1e-9);
});

test('Lumi / Not Yet (the ward ends on a Willing ally: 15% of its max HP), Clear Sky (her heals 2% x 5 more while any ally is Willing), They Decide (below 20%: controls off, Willing again; once a wave)',()=>{
  const L=ll(S(['fm_1_2','fm_3_2','fm_7_1','fm_9_1'])), {v,A,F}=L;
  wardOn(L,A[0]); low(A[0],0.3); const h=A[0].hp; secs(3.3); assert.ok(!(A[0]._wardT>0),'the ward ended');
  near(A[0].hp-h,0.15*A[0].maxHp*1.10,'Not Yet: 15% of its max HP, Clear Sky 10% more (it is Willing)',1e-6);
  A[0].stunned=1e6; A[0].silencedT=3; A[0].slow=2; low(A[0],0.25); V.step(1); low(A[0],0.19); V.step(1);
  assert.equal(A[0].stunned,0,'They Decide: the stun is off'); assert.equal(A[0].silencedT,0,'and the silence'); assert.equal(A[0].slow,0,'and the slow');
  near(left(L,A[0],'wl'),8,'its Willing starts again (8 s)',0.1);
  A[0].stunned=1e6; low(A[0],0.5); V.step(1); low(A[0],0.1); V.step(1); assert.ok(A[0].stunned>1e5,'once per wave');
  L.T.s.fresh=true; V.step(1); low(A[0],0.5); V.step(1); low(A[0],0.1); V.step(1); assert.equal(A[0].stunned,0,'again in the next wave');
  const N=ll(S(['fm_3_2'])); wardOn(N,N.A[0]); low(N.A[0],0.3); const h2=N.A[0].hp; secs(3.3); near(N.A[0].hp,h2,'Not Yet without Willing Heart: nobody is Willing, no heal',1e-9);
});

test('Lumi / the Watch: Keep Watch (the lowest HP share, every 3 s; 1% x 5 less), Watchtower (0.4 points x 5), Watchful (0.3 s x 5 sooner), Last Watchfire, First Gold, Close Watch',()=>{
  const L=ll(S(['fm_2_3','fm_12_2','fm_8_2','fm_3_1','fm_4_3'])), {v,A,F}=L;
  assert.ok(mk(L,v,'wt'),'at the wave start the lowest share is watched (all full: Lumi, first)'); low(A[1],0.4); secs(2.8); assert.ok(!mk(L,A[1],'wt'),'not before 3 s');
  secs(0.3); assert.ok(mk(L,A[1],'wt')&&!mk(L,v,'wt'),'after 3 s the watch moves to the lowest');
  near(ratioIn(L,F[0],A[1]),1-0.05-0.02,'the Watched ally takes 5% + 2 points less',1e-9); near(ratioIn(L,F[0],A[0]),1,'(no other ally)',1e-9);
  near(ratioOut(L,A[1],F[0]),1.05,'Last Watchfire: it deals 1% x 5 more',1e-9);
  low(A[1],0.3); const pl=plainHit(L,()=>healGot(A[1],()=>V.heal(A[1],1000))); low(A[1],0.3); near(healGot(A[1],()=>V.heal(A[1],1000)),pl*1.09,'Close Watch: it receives 3% x 3 more healing (any source)',1e-9);
  const W=ll(S(['fm_2_3','fm_10_2'])); low(W.A[1],0.4); secs(1.6); assert.ok(mk(W,W.A[1],'wt'),'Watchful: every 1.5 s');
  const pn=plain({},P=>{ low(P.A[0],0.2); return healGot(P.A[0],()=>nova(P)); });
  const G=ll(S(['fm_2_3','fm_3_1','fm_4_3'])); low(G.A[0],0.2); setMk(G,G.A[0],'wt'); near(healGot(G.A[0],()=>nova(G)),pn*1.10*1.09,'First Gold: her heals on the Watched ally 2% x 5 more (and Close Watch)',1e-6);
});

test('Lumi / The Long Night: a stack each second below 50% (max 5, Longer Nights 3 more, Night Long 0.2 s x 2 sooner); back above 50% it heals 0.5% x 5 (+ Daylong 0.2 points x 2) of max HP a stack, Sunward energy',()=>{
  const L=ll(S(['fm_4_4','fm_12_4','fm_10_4'])), {v,A}=L;
  low(A[0],0.45); secs(3.02); low(A[0],0.6); const h=A[0].hp; V.step(1); near(A[0].hp-h,3*(0.025+0.004)*A[0].maxHp,'3 s below half: 3 stacks, each 2.9% of its max HP',1e-6); near(A[0].energy,6,'Sunward: 2 x 3 energy',1e-9);
  const h2=A[0].hp; V.step(1); near(A[0].hp,h2,'paid once',1e-9);
  low(A[0],0.45); secs(9); low(A[0],0.6); const h3=A[0].hp; V.step(1); near(A[0].hp-h3,5*0.029*A[0].maxHp,'at most 5',1e-6);
  const M=ll(S(['fm_4_4','fm_5_4','fm_8_4'])); low(M.A[0],0.45); secs(1.75); low(M.A[0],0.6); let g=healGot(M.A[0],()=>V.step(1)); near(g,2*0.025*M.A[0].maxHp,'Night Long: a stack each 0.6 s (2 in 1.75 s)',1e-6);
  low(M.A[0],0.45); secs(9); low(M.A[0],0.6); g=healGot(M.A[0],()=>V.step(1)); near(g,8*0.025*M.A[0].maxHp,'Longer Nights: up to 8',1e-6);
});

test('Lumi / Dawnward: Long Ward, Frostless, Light the Road (PICK ONE), Hold the Wall (PICK ONE: the second lowest too, 1 s shorter), Shoulder to Shoulder, Dawn Chill, cooldowns',()=>{
  const base=3+0.01*(SL-1);
  let L=ll(S(['fm_3_4','qh_10_1','fm_5_3'])); low(L.A[0],0.3); castDW(L); near(L.A[0]._wardT,base+0.5+0.6+1.5,'Long Ward 0.1 x 5, Frostless 0.2 x 3, Light the Road 1.5 s',1e-9);
  L=ll(S(['fm_5_1','fm_6_1','fm_5_2'])); low(L.A[0],0.3); low(L.A[1],0.5); L.v.hp=L.v.maxHp; castDW(L);
  near(L.A[0]._wardT,base-1,'Hold the Wall: 1 s shorter',1e-9); near(L.A[1]._wardT,base-1,'and the second lowest ally too',1e-9); assert.ok(!(L.v._wardT>0),'(not a third)');
  near(ratioIn(L,L.F[0],L.A[1]),0.90,'Dawn Chill: a warded ally takes 2% x 5 less',1e-9); near(ratioIn(L,L.F[0],L.v),1,'(she is not warded)',1e-9);
  const h0=L.A[0].hp, h1=L.A[1].hp; secs(base-1+0.2); near(L.A[0].hp-h0,0.06*L.A[0].maxHp,'Shoulder to Shoulder: both heal 2% x 3 when it ends',1e-6); near(L.A[1].hp-h1,0.06*L.A[1].maxHp,'(both)',1e-6);
  near(ratioIn(L,L.F[0],L.A[1]),1,'Dawn Chill ends with the ward',1e-9);
  L=ll(S(['fm_11_1','fm_6_4','fm_5_3','fm_6_3'])); const cd=VMX('TalentFx').cd(L.v,'green',11); near(cd,11-1-1-1.2,'Patient Light 0.2 x 5, Sleepless 0.5 x 2, Long Road 0.4 x 3 sooner',1e-9);
  near(ratioIn(L,L.F[0],L.v),1.06,'Sleepless (RISK): she takes 3% x 2 more',1e-9);
});

test('Lumi / Quiet Ward: while her ward holds an ally, an enemy that strikes it is silenced 0.5 s (Hush of Dawn 0.1 x 5), once per enemy per ward',()=>{
  const L=ll(S(['qh_11_2','qh_12_2'])), {A,F}=L; wardOn(L,A[0]);
  V.hit(F[0],A[0],100,tru()); near(F[0].silencedT,1.0,'silenced 0.5 s + 0.5 s',1e-9); F[0].silencedT=0; V.hit(F[0],A[0],100,tru()); assert.equal(F[0].silencedT,0,'once per enemy per ward');
  V.hit(F[1],A[0],100,tru()); near(F[1].silencedT,1.0,'another enemy: yes'); V.hit(F[2],A[1],100,tru()); assert.ok(!(F[2].silencedT>0),'not on an ally she has not warded');
  wardOn(L,A[0]); V.hit(F[0],A[0],100,tru()); near(F[0].silencedT,1.0,'a new ward: again',1e-9);
});

test('Lumi / Grey Composure and Siege Nerves: controls on her 5% x 3 shorter (with Siege Nerves while she is Willing: at most 25%), on a Willing ally 5% x 3 shorter',()=>{
  const L=ll(S(['fm_1_1','fm_8_1','fm_1_2'])), {v,A,F}=L; v.level=1; A[0].level=1;
  v.stunned=0; V.cc(F[0],v,'stunned',2); near(v.stunned,2*V.ccNerf*0.85,'15% shorter',1e-9); v.stunned=0;
  setMk(L,v,'wl',99); V.cc(F[0],v,'stunned',2); near(v.stunned,2*V.ccNerf*0.75,'with Siege Nerves while Willing: 0.85 x 0.85, held at 25%',1e-9);
  A[0].stunned=0; V.cc(F[0],A[0],'stunned',2); near(A[0].stunned,2*V.ccNerf,'an ally that is not Willing: full',1e-9);
  A[0].stunned=0; setMk(L,A[0],'wl',99); V.cc(F[0],A[0],'stunned',2); near(A[0].stunned,2*V.ccNerf*0.85,'a Willing ally: 15% shorter',1e-9);
  A[0].stunned=5; V.cc(F[0],A[0],'stunned',1); near(A[0].stunned,5,'a longer control already there is not shortened',1e-9);
});

test('Lumi / Radiant Nova\'s heal: Steady Dawn (2% x 5), Soft Light (0.5% x 5 per Voice), Fourth Morning Nova (Willing; the Watched ally 30% more), Morning Chorus',()=>{
  const p=plain({},L=>{ low(L.A[0],0.1); return healGot(L.A[0],()=>nova(L)); });
  const L=ll(S(['fm_6_2','qh_1_3','fm_7_3','fm_9_3','qh_2_2'])), {v,A}=L; setStack(L,'vo',4); A[1].hp=A[1].maxHp; low(A[0],0.1); hushOff(L);
  near(healGot(A[0],()=>nova(L)),p*1.10*1.10,'Steady Dawn 10%, Soft Light 2.5% x 4 Voices',1e-6);
  assert.ok(mk(L,A[0],'wl')&&mk(L,v,'wl'),'every ally it heals is Willing (herself too)'); near(left(L,A[0],'wl'),8+3,'8 s + Morning Chorus 0.6 x 5',1e-6); assert.ok(!mk(L,A[1],'wl'),'not the ally out of its reach');
  setMk(L,A[0],'wt'); setStack(L,'vo',0); low(A[0],0.1); near(healGot(A[0],()=>nova(L)),p*1.10*1.30,'Fourth Morning Nova: the Watched ally 30% more',1e-6);
});

test('Lumi / Nova Reach and Lightfall (its circle 0.4 m x 3 and 0.3 m x 5 wider, from her centre), Brighter Nova, Bright Morning, Dawn Edge (silenced or Muffled)',()=>{
  const p=plain({},L=>{ const h=L.F[0].hp; nova(L); return h-L.F[0].hp; });
  let L=ll(S(['fm_10_3','qh_8_3'])); at(L,L.F[1],8.6,0); let h=L.F[1].hp; nova(L); assert.ok(L.F[1].hp<h,'an enemy 8.6 m from her centre is struck (6 + 1.2 + 1.5 = 8.7 m)');
  at(L,L.F[1],8.8,0); h=L.F[1].hp; nova(L); assert.equal(L.F[1].hp,h,'not at 8.8 m');
  L=ll(S(['qh_3_4','fl_9_1','qh_9_3'])); h=L.F[0].hp; nova(L); near(h-L.F[0].hp,p*1.10*1.10,'Brighter Nova 10%, Bright Morning 10%',1e-6);
  L.F[0].silencedT=5; h=L.F[0].hp; nova(L); near(h-L.F[0].hp,p*1.21*1.15,'Dawn Edge: 3% x 5 more on a silenced enemy',1e-6);
  L.F[0].silencedT=0; setMk(L,L.F[0],'mf'); h=L.F[0].hp; nova(L); near(h-L.F[0].hp,p*1.21*1.15,'or a Muffled one',1e-6);
});

test('Lumi / Three Hundred Willing (SIGNATURE): each Radiant Nova: the whole team Willing 10 s and bound - 40% of a hit is shared by the others, Lumi\'s share halved, never shared again',()=>{
  const L=ll(S(['fm_13_3'])), {v,A,F}=L; nova(L); for(const x of [v,A[0],A[1]]) assert.ok(mk(L,x,'wl'),'the whole team is Willing'); near(left(L,A[1],'wl'),10,'for 10 s',1e-6);
  const h0=A[0].hp, h1=A[1].hp, hv=v.hp; V.hit(F[0],A[0],1000,tru());
  near(h0-A[0].hp,600,'the struck ally takes 60%',1e-6); near(h1-A[1].hp,200,'the other ally half of the 40%',1e-6); near(hv-v.hp,100,'Lumi half of her half',1e-6);
  const hv2=v.hp, ha=A[0].hp, hb=A[1].hp; V.hit(F[0],v,1000,tru()); near(hv2-v.hp,600,'a hit on her: she keeps 60%',1e-6); near(ha-A[0].hp,200,'',1e-6); near(hb-A[1].hp,200,'the others share the rest',1e-6);
  secs(10.1); const h2=A[0].hp; V.hit(F[0],A[0],1000,tru()); near(h2-A[0].hp,1000,'after 10 s: no more',1e-6);
});

/* ======================= THE QUIET HOUR ======================= */
test('Lumi / Hush: Early Hours (0.2 s x 3 sooner), Early Quiet (0.1 s x 3), Lingering Hush (3% x 3, hers and her team\'s silences), Stolen Breath, Still Air, Swallowed Word',()=>{
  const L=ll(S(['qh_4_4','qh_2_3','qh_8_1','qh_10_4','qh_5_4','qh_3_1']),{foes:1}), {v,A,F}=L; F[0].energy=50;
  v._hushT=0; secs(4.38); assert.ok(!(F[0].silencedT>0),'not before 4.4 s'); for(let i=0;i<4&&!(F[0].silencedT>0);i++) V.step(1); assert.ok(F[0].silencedT>0,'Hush every 4.4 s'); hushOff(L);
  near(F[0].silencedT,0.7*v.passMul*1.09+0.3,'its silence: x1.09 (Lingering Hush) + 0.3 s',0.03); near(F[0].energy,41,'Stolen Breath: 3 x 3 energy',1e-9);
  const i0=F[0].atkInterval; V.step(1); near(F[0].atkInterval/i0,1/0.90,'Still Air: it attacks 2% x 5 slower while silenced',1e-6); secs(2); near(F[0].atkInterval,i0,'and not after',1e-6);
  hushOff(L); F[0].silencedT=0; think(F[0]); F[0].greenAb={cd:8}; F[0].blueAb={cd:9}; F[0]._pend={t:0.4,spell:true,fire:()=>{}}; F[0].greenCd=7.8; F[0].blueCd=1; hush(L);
  near(F[0].greenCd,8,'Swallowed Word: the cast Hush breaks starts its cooldown over',1e-6); F[0]._pend=null; F[0].stunned=1e6;
  F[0].silencedT=0; A[0].silencedT=0; F[0].level=1; V.cc(A[0],F[0],'silencedT',1); near(F[0].silencedT,1*V.ccNerf*1.09,'Lingering Hush: an ally\'s silence 9% longer',1e-9);
});

test('Lumi / One Voice (PICK ONE: the most ability power, 0.5 s longer) and Named Voice (4% x 3 from her team for 2 s); Many Voices (PICK ONE: every third Hush, two) and Hush of Many',()=>{
  let L=ll(S(['qh_5_2','qh_6_2'])), {v,A,F}=L; F[2].apow=1e6; brnd(0.01); hush(L); brndBack();
  assert.ok(F[2].silencedT>0&&!(F[0].silencedT>0),'One Voice: the enemy with the most ability power'); near(F[2].silencedT,0.7*v.passMul+0.5,'0.5 s longer',0.04);
  near(ratioOut(L,A[0],F[2]),1.12,'Named Voice: her team deals it 4% x 3 more',1e-9); near(ratioOut(L,v,F[2]),1.12,'(Lumi too)',1e-9); secs(2.05); near(ratioOut(L,A[0],F[2]),1,'for 2 s',1e-9);
  L=ll(S(['qh_5_3','qh_6_3'])); const n=()=>L.F.filter(f=>f.silencedT>0).length, clr=()=>{ for(const f of L.F) f.silencedT=0; };
  hush(L); assert.equal(n(),1,'first'); clr(); hush(L); assert.equal(n(),1,'second'); clr(); hush(L); assert.equal(n(),2,'every third Hush: two enemies');
  for(const f of L.F) if(f.silencedT>0) near(f.silencedT,0.7*L.v.passMul+0.45,'Hush of Many: 0.15 s x 3 longer, both',0.04);
  clr(); hush(L); assert.equal(n(),1,'then one again');
});

test('Lumi / Voices: Taken Voices (one for each enemy Hush silences, 0.6% x 5 ability power each, max 5), Hoard of Voices, Kept Voices (2 into the next wave), Daylit Calm (3 or more: 1.5% x 5 less)',()=>{
  const L=ll(S(['qh_2_2','qh_4_2','qh_12_1','qh_11_1'])), {v,F}=L; const ap=v.apow;
  for(let i=0;i<10;i++) hush(L); assert.equal(stk(L,'vo'),8,'at most 5 + Hoard 3'); V.step(1); near(v.apow/ap,1+0.03*8,'3% ability power a Voice',1e-9);
  setStack(L,'vo',2); V.step(1); near(ratioIn(L,F[0],v),1,'2 Voices: no Daylit Calm',1e-9); setStack(L,'vo',3); near(ratioIn(L,F[0],v),1-0.075,'3 Voices: 7.5% less',1e-9);
  setStack(L,'vo',6); V.wave(); V.step(2); assert.equal(stk(L,'vo'),2,'a new wave: Kept Voices carries 1 x 2');
});

test('Lumi / Nova of Voices (spends every Voice when it strikes: 10% more each, Every Voice 1% x 5 more; the enemy it hits hardest silenced 0.3 s a Voice), The Street at Dawn (SIGNATURE)',()=>{
  const p=plain({},L=>{ const h=L.F[0].hp; nova(L); return h-L.F[0].hp; });
  let L=ll(S(['qh_7_2','qh_9_2','qh_2_2'])); setStack(L,'vo',4); let h=L.F[0].hp; nova(L); near(h-L.F[0].hp,p*(1+0.15*4),'4 Voices: 15% each',1e-6);
  near(L.F[0].silencedT,1.2,'the enemy it hit hardest: 0.3 s x 4',1e-9); assert.equal(stk(L,'vo'),0,'they are spent');
  setStack(L,'vo',3); at(L,L.F[0],20,3); at(L,L.F[1],22,0); at(L,L.F[2],24,0); nova(L); assert.equal(stk(L,'vo'),3,'a Nova that strikes nobody spends none');
  L=ll(S(['qh_13_2','qh_2_2','qh_1_1'])); setStack(L,'vo',4); nova(L); assert.ok(!(L.F[2].silencedT>0),'The Street at Dawn: not with 4 of 5 Voices');
  setStack(L,'vo',5); nova(L); for(const f of L.F){ near(f.silencedT,2,'a full set: every enemy silenced 2 s',1e-9); assert.ok(mk(L,f,'mf'),'and Muffled'); } assert.equal(stk(L,'vo'),0,'the set is spent');
  for(const f of L.F) f.silencedT=0; let c=0; for(let i=0;i<Math.round(5.1/V.STEP);i++){ const s0=L.F.map(f=>f.silencedT||0); V.step(1); if(L.F.some((f,j)=>(f.silencedT||0)>s0[j]+1e-6)) c++; }
  assert.equal(c,5,'Hush fires every second for 5 s'); assert.equal(stk(L,'vo'),5,'(and each silence leaves a Voice)');
  c=0; for(let i=0;i<Math.round(4.5/V.STEP);i++){ const s0=L.F.map(f=>f.silencedT||0); V.step(1); if(L.F.some((f,j)=>(f.silencedT||0)>s0[j]+1e-6)) c++; } assert.ok(c<=1,'then every 5 s again');
});

test('Lumi / Muffled: Soft Hands (when Hush ends; its next skill 4% x 5 less), Thick Muffle (that skill 0.3 s x 3 slower), Dull Blows, Hollow Echo, Sealed Lips; it ends at its next skill',()=>{
  const L=ll(S(['qh_1_1','qh_2_1','qh_4_1','qh_6_1','qh_12_4']),{foes:1}), {v,A,F}=L; const f=F[0];
  hush(L); assert.ok(f.silencedT>0&&!mk(L,f,'mf'),'silenced, not yet Muffled'); secs(1.0); assert.ok(!(f.silencedT>0)&&mk(L,f,'mf'),'Muffled when Hush ends');
  near(ratioIn(L,f,A[0],{auto:true}),0.95,'Dull Blows: its basic attacks 1% x 5 less',1e-9); near(ratioOut(L,A[0],f,{kind:'magic'}),1.05,'Hollow Echo: it takes 1% x 5 more magic damage',1e-6);
  low(f,0.5); const pl=plainHit(L,()=>healGot(f,()=>V.heal(f,1000))); low(f,0.5); near(healGot(f,()=>V.heal(f,1000)),pl*0.91,'Sealed Lips: it receives 3% x 3 less healing',1e-9);
  think(f); f.greenAb={cd:8}; f.blueAb={cd:9}; f.blueCd=5; f.greenCd=8; f._pend={t:0.5,spell:true,fire:()=>{}}; V.step(1); near(f.greenCd,8+0.9,'Thick Muffle: the skill it began comes back 0.9 s slower',0.01);
  assert.ok(!mk(L,f,'mf'),'that was its next skill: no longer Muffled'); f._pend=null;
  near(ratioIn(L,f,A[0]),0.80,'Soft Hands: that skill deals 4% x 5 less',1e-9); near(ratioIn(L,f,v),0.80,'(on her too)',1e-9);
  near(ratioOut(L,A[0],f,{kind:'magic'}),1,'Hollow Echo ends with it',1e-6); secs(1.6); near(ratioIn(L,f,A[0]),1,'and the cut with the cast',1e-9);
});

test('Lumi / The Quietest Part (any enemy silenced: her team 8% less magic damage), Unheard (3% x 2 less from silenced enemies), Unhurried (the first skill each wave 10% x 3 less), Quiet Mind',()=>{
  const L=ll(S(['qh_9_1','qh_8_1','qh_8_4','qh_1_4','qh_5_1'])), {v,A,F}=L;
  near(ratioIn(L,F[0],A[0],{kind:'magic',auto:true}),1,'nobody silenced',1e-9); F[2].silencedT=5; V.step(1);
  near(ratioIn(L,F[0],A[0],{kind:'magic',auto:true}),0.92,'an enemy silenced: 8% less magic',1e-9); near(ratioIn(L,F[0],A[0],{auto:true}),1,'(not true damage)',1e-9);
  near(ratioIn(L,F[2],v,{auto:true}),0.94,'Unheard: from the silenced enemy 3% x 2 less',1e-9);
  const h=v.hp, a=hitOn(L,F[0],v,1000); v.hp=h; near(a,700,'Unhurried: the first skill that hits her this wave 30% less',1e-6); const b=hitOn(L,F[0],v,1000); v.hp=h; near(b,1000,'only the first',1e-6);
  L.T.s.fresh=true; V.step(1); near(hitOn(L,F[0],v,1000),700,'a new wave: again',1e-6); v.hp=h;
  near(VMX('TalentFx').cd(v,'green',10),9.5,'Quiet Mind: her skills 1% x 5 sooner',1e-9);
});

test('Lumi / her damage: Pale Edge, Gold Edge, Thin Walls (RISK), Early Bird, Dim Morning (silenced)',()=>{
  const L=ll(S(['qh_7_1','fl_7_4','qh_6_4','fl_3_4','qh_7_4'])), {v,F}=L;
  near(ratioOut(L,v,F[0],{kind:'magic'}),1.10*1.10*1.08,'magic: Pale Edge 10%, Gold Edge 10%, Thin Walls 8%',1e-6);
  near(ratioOut(L,v,F[0],{auto:true}),1.15,'Early Bird: her basic attacks 3% x 5 more',1e-9); F[0].silencedT=5; near(ratioOut(L,v,F[0],{auto:true}),1.15*1.15,'Dim Morning: 3% x 5 more on a silenced enemy',1e-9);
  near(ratioIn(L,F[0],v),1.04,'Thin Walls (RISK): she takes 2% x 2 more',1e-9);
});

/* ======================= FIRST LIGHT RUNNING ======================= */
test('Lumi / Sunblind: Low Sun (her basic attacks and Radiant Nova; 0.6% x 5 a stack to miss), Blinding (4 + 3 s), Sunburnt (RISK, 7), Blinding Nova, the miss (one seeded draw)',()=>{
  const L=ll(S(['fl_1_3','fl_2_3','fl_6_1','fl_10_2'])), {v,A,F}=L;
  V.hit(v,F[1],10,tru({auto:true})); assert.equal(ust(L,F[1],'sb'),1,'a basic attack: 1 Sunblind'); near(ustLeft(L,F[1],'sb'),7,'for 4 s + 1 x 3',1e-6);
  V.hit(v,F[1],10,tru()); assert.equal(ust(L,F[1],'sb'),1,'(not a skill hit)');
  nova(L); assert.equal(ust(L,F[0],'sb'),4,'Radiant Nova: 1 + Blinding Nova 1 x 3'); for(let i=0;i<9;i++) V.hit(v,F[0],10,tru({auto:true})); assert.equal(ust(L,F[0],'sb'),7,'at most 5 + Sunburnt 1 x 2');
  brnd(0.209); assert.equal(hitOn(L,F[0],A[0],1000,{auto:true}),0,'7 stacks x 3%: a 21% chance to miss (the roll 0.209 misses)');
  brnd(0.211); assert.ok(hitOn(L,F[0],A[0],1000,{auto:true})>0,'(0.211 does not)'); brnd(0); assert.ok(hitOn(L,F[0],A[0],1000)>0,'only basic attacks'); brndBack();
  near(ratioIn(L,F[1],v),1.06,'Sunburnt (RISK): she takes 3% x 2 more',1e-9);
});

test('Lumi / Squint (LINK: a Sunblind miss, 3% more from her team for 2 s; with Soft Hands also Muffled, once every 6 s), Sun-Warmed, White Heat, Dazzle, Whiteout, Hot Noon',()=>{
  let L=ll(S(['fl_1_3','fl_n1','qh_1_1','fl_11_4','fl_6_3','fl_8_4','fl_9_4'])), {v,A,F}=L;
  setUst(L,F[0],'sb',2); brnd(0); hitOn(L,F[0],A[0],1000,{auto:true}); brndBack(); assert.ok(mk(L,F[0],'sq'),'it missed: Squint'); assert.ok(mk(L,F[0],'mf'),'and (Soft Hands) Muffled');
  near(ratioOut(L,A[0],F[0]),1.03,'3% more from her team',1e-9); secs(2.05); near(ratioOut(L,A[0],F[0]),1,'for 2 s',1e-9);
  delete F[0]._talM[v.uid].mf; brnd(0); hitOn(L,F[0],A[0],1000,{auto:true}); brndBack(); assert.ok(!mk(L,F[0],'mf'),'Muffled at most once every 6 s');
  brnd(0.99); near(ratioIn(L,F[0],v),1-0.075,'Sun-Warmed: she takes 1.5% x 5 less from an enemy with Sunblind',1e-9); brndBack();
  setUst(L,F[1],'sb',5); near(ratioOut(L,A[0],F[1]),1.05,'White Heat: 5 Sunblind, 1% x 5 more from her team',1e-9); setUst(L,F[1],'sb',4); near(ratioOut(L,A[0],F[1]),1,'(not 4)',1e-9);
  const i0=F[2].atkInterval; setUst(L,F[2],'sb',4); V.step(2); near(i0/F[2].atkInterval,1-0.015*4,'Dazzle: 0.5% x 3 slower a stack',1e-6);
  setUst(L,F[1],'sb',4); V.hit(v,F[1],10,tru({auto:true})); assert.ok(mk(L,F[1],'wo'),'Whiteout: at 5 it is dazzled'); brnd(0.99); assert.equal(hitOn(L,F[1],A[0],1000,{auto:true}),0,'it misses every basic attack'); brndBack();
  secs(1.05); brnd(0.99); assert.ok(hitOn(L,F[1],A[0],1000,{auto:true})>0,'for 1 s'); brndBack(); setUst(L,F[1],'sb',4); V.hit(v,F[1],10,tru({auto:true})); assert.ok(!mk(L,F[1],'wo'),'once every 6 s');
  L=ll(S(['fl_1_3','fl_8_1','fl_4_1'])); lu(L).sunUp=true; V.hit(L.v,L.F[1],10,tru({auto:true})); near(ustLeft(L,L.F[1],'sb'),6,'Hot Noon: after Sunrise 1 s x 2 longer',1e-6);
});

test('Lumi / Sun in the Eyes (Hush on the most Sunblind; it misses every basic attack while silenced), Spread Light (allies under Quickening), Glinting Blades',()=>{
  let L=ll(S(['fl_3_3','fl_1_3'])), {v,A,F}=L; setUst(L,F[1],'sb',3); setUst(L,F[2],'sb',1); brnd(0.01); hush(L); brndBack();
  assert.ok(F[1].silencedT>0&&!(F[0].silencedT>0),'Hush picks the enemy with the most Sunblind'); brnd(0.99); assert.equal(hitOn(L,F[1],A[0],1000,{auto:true}),0,'it misses every basic attack'); brndBack();
  L=ll(S(['fl_7_2','fl_9_2'])); castQK(L); V.hit(L.A[0],L.F[0],10,tru()); assert.equal(ust(L,L.F[0],'sb'),1,'Spread Light: an ally under Quickening puts 1 on each enemy it hits');
  V.hit(L.v,L.F[1],10,tru()); assert.equal(ust(L,L.F[1],'sb'),1,'(Lumi too)'); near(ratioOut(L,L.A[0],L.F[0]),1.05,'Glinting Blades: 1% x 5 more on an enemy with Sunblind',1e-9);
  secs(5.1); V.hit(L.A[0],L.F[2],10,tru()); assert.equal(ust(L,L.F[2],'sb'),0,'only while Quickening lasts');
});

test('Lumi / Kindled: Kindling (each basic attack 0.3% x 5 of max HP, within 1.2% a second), Bright Kindling, Sunlit Ranks, Kindling Heat',()=>{
  const L=ll(S(['fl_2_2','fl_4_2','fl_10_3','fl_12_3'])), {v,A,F}=L; castQK(L); low(A[0],0.5);
  near(healGot(A[0],()=>V.hit(A[0],F[0],10,tru({auto:true}))),0.012*1.10*A[0].maxHp,'Kindled: the first basic attack heals 1.2% (1.8% asked, the cap), Kindling Heat 10% more',1e-6);
  near(healGot(A[0],()=>V.hit(A[0],F[0],10,tru({auto:true}))),0,'at once again: nothing left this second',1e-9);
  secs(0.5); near(healGot(A[0],()=>V.hit(A[0],F[0],10,tru({auto:true}))),0.012*0.5*1.10*A[0].maxHp,'half a second later: 0.6%',0.03);
  near(ratioOut(L,A[0],F[0]),1.05,'Sunlit Ranks: Kindled allies deal 1% x 5 more',1e-9);
  secs(5.2); assert.equal(healGot(A[0],()=>V.hit(A[0],F[0],10,tru({auto:true}))),0,'Quickening over: no longer Kindled'); near(ratioOut(L,A[0],F[0]),1,'',1e-9);
  const K=ll([['fl_2_2',2]]); castQK(K); low(K.A[0],0.5); assert.equal(healGot(K.A[0],()=>V.hit(K.A[0],K.F[0],10,tru())),0,'only basic attacks');
  near(healGot(K.A[0],()=>V.hit(K.A[0],K.F[0],10,tru({auto:true}))),0.006*K.A[0].maxHp,'Kindling 2/5 (under the cap): 0.3% x 2 a basic attack',1e-6);
});

test('Lumi / Quickening: Bright Haste and Brisk (0.3 s x 3 each), Slow Dawn and Racing Dawn (PICK ONE: points), Morning Rush, Long Morning, Daybreak Dash, Lightfoot, Bright Footing, Whispered Haste',()=>{
  const hm=1.3+0.001*(SL-1);
  let L=ll(S(['fm_4_1','fl_4_4','fl_5_2','fl_6_2','fl_3_1','fl_11_1','qh_10_3'])); castQK(L); near(L.A[0].hasteT,5+1.8+3,'Bright Haste, Brisk, Slow Dawn 3 s',1e-9); near(L.A[0].hasteMul,hm-0.1,'Slow Dawn: 10 points less',1e-9);
  near(ratioIn(L,L.F[0],L.A[0]),0.94,'Long Morning: allies under it 2% x 3 less',1e-9);
  near(ratioIn(L,L.F[0],L.v),0.94*0.90*0.95,'Lumi: Long Morning, Lightfoot 2% x 5 for 3 s, Bright Footing 1% x 5',1e-9);
  secs(3.05); near(ratioIn(L,L.F[0],L.v),0.94*0.95,'Lightfoot is over after 3 s',1e-9);
  const v=L.v; think(v); v.blueCd=99; v.greenCd=5; V.step(1); const g=v.greenCd; V.step(2); near(g-v.greenCd,2*V.STEP*1.05,'Whispered Haste: the cooldowns of her team 1% x 5 faster while under it',1e-6);
  L=ll(S(['fl_5_4','fl_6_4','fl_5_3'])); const sp=L.A[0].speed; castQK(L); near(L.A[0].hasteMul,hm+0.1,'Racing Dawn: 10 points more',1e-9); near(L.A[0].hasteT,4,'1 s shorter',1e-9);
  V.step(2); near(L.A[0].speed/sp,1.12,'Daybreak Dash: 4% x 3 faster while under it',1e-9); near(VMX('TalentFx').cd(L.v,'blue',9),8,'Morning Rush: 0.2 s x 5 sooner',1e-9);
});

test('Lumi / Sunrise: Count to Sunrise (20 s into the wave; her team 1% x 5 faster), Early Sunrise, Long Day (points), Daybreak Energy, Midmorning',()=>{
  const L=ll(S(['fl_4_1','fl_5_1','fl_12_1','fl_10_1','fl_8_3'])), {v,A}=L; const i0=A[0].atkInterval, iv=v.atkInterval; for(const x of L.U) x.energy=0;
  secs(15.4); assert.ok(!win(L,'sun'),'not before 20 - 1.5 x 3 s'); secs(0.2); assert.ok(win(L,'sun'),'at 15.5 s the sun is up');
  V.step(2); near(i0/A[0].atkInterval,1.07,'her team attacks 5% + 2 points faster',1e-6); near(iv/v.atkInterval,1.07,'(Lumi too)',1e-6);
  near(A[0].energy,15,'Daybreak Energy: 5 x 3 to every ally',1e-9); near(VMX('TalentFx').cd(v,'green',10),9.5,'Midmorning: her skills 1% x 5 sooner',1e-9);
  V.wave(); V.step(2); assert.ok(!win(L,'sun'),'a new wave counts down again'); near(A[0].atkInterval,i0,'and the bonus is gone until then',1e-6);
});

test('Lumi / The Sun Clears the Wall (SIGNATURE): Radiant Nova brings the Sunrise, doubles it for 8 s, 5 Sunblind on the enemies it strikes, every ally Kindled 8 s; Dawn Burst and Second Morning',()=>{
  const L=ll(S(['fl_13_2','fl_4_1','fl_2_2','fl_11_2','fl_12_2'])), {v,A,F}=L; const i0=A[0].atkInterval; low(A[0],0.5);
  nova(L); assert.ok(win(L,'sun'),'the sun is up at once'); V.step(2); near(i0/A[0].atkInterval,1.10,'doubled: 10%',1e-6);
  assert.equal(ust(L,F[0],'sb'),5,'the enemy it struck: 5 Sunblind'); assert.equal(ust(L,F[1],'sb'),0,'(not one out of its reach)');
  assert.ok(mk(L,A[1],'kd')&&mk(L,v,'kd'),'every ally Kindled, wherever it stands');
  near(A[0].hasteMul,1+(1.3+0.001*(SL-1)-1)/2,'Dawn Burst: an ally it heals gets a Quickening at half strength',1e-9); near(A[0].hasteT,5+2-2*V.STEP,'for 5 s + Second Morning 0.4 x 5',1e-6);
  assert.ok(!(A[1].hasteT>0),'(not the ally out of its heal)');
  secs(8.1); V.step(2); near(i0/A[0].atkInterval,1.05,'after 8 s: single again',1e-6); assert.ok(!mk(L,A[1],'kd'),'and not Kindled');
});

test('Lumi / Daybright (her basic attacks heal the lowest ally 4% x 3 of her ability power), Bright Eyes (her range 3% x 3), Thin Frost, Morning Guard',()=>{
  const r0=plain({},P=>P.v.range); const L=ll(S(['fl_2_1','fl_1_4','fm_7_4','fm_11_4'])), {v,A,F}=L; low(A[1],0.2);
  near(healGot(A[1],()=>V.hit(v,F[0],10,tru({auto:true}))),0.12*v.apow,'Daybright: 12% of her ability power to the lowest',1e-6);
  near(v.range/r0,1.09,'Bright Eyes: 9% more range',1e-9);
  near(ratioIn(L,F[0],v,{kind:'magic'}),0.95,'Thin Frost: 1% x 5 less magic',1e-6);
  near(ratioIn(L,F[0],v,{auto:true}),0.95,'Morning Guard: 1% x 5 less from basic attacks',1e-9);
});

test('Lumi / her two capped groups: on her at most 40% from her talents, on an ally at most 25%',()=>{
  const all=everything(H).filter(([id])=>!['fm_6_4','qh_6_4','fl_6_1','fm_13_3'].includes(id));
  const L=ll(all), {v,A,F}=L; brnd(0.99); const f=F[0];
  for(const x of [v,A[0]]){ setMk(L,x,'wt'); setMk(L,x,'wl'); setMk(L,x,'dw'); setMk(L,x,'qk'); } F[2].silencedT=5; f.silencedT=5; setMk(L,f,'mfc'); setUst(L,f,'sb',1); setStack(L,'vo',5); L.T.s.w.lf={t:3,n:1,cdT:0,at:-1,wave:false}; V.step(1);
  near(ratioIn(L,f,A[0],{kind:'magic'}),0.75,'an ally: every reduction at once, held at 25%',1e-9);
  near(ratioIn(L,f,v,{kind:'magic'}),0.60,'Lumi: held at 40%',1e-9);
});

/* ======================= WHOLE FIGHTS ======================= */
test('Lumi: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['fm_1_2','fm_2_3','fm_4_4','qh_1_1','qh_2_2','fl_1_3','fl_2_2','fl_4_1','fm_7_3']), TEAM=['vael','sylthaine','vireo','vex','lumi'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let wl=0,wt=0,mf=0,sb=0,kd=0; const mx={};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const u of VMX('units')){ const o=u._talM&&u._talM[s.uid]; if(!o) continue; if(o.wl&&o.wl.until>V.now()) wl++; if(o.wt) wt++; if(o.mf) mf++; if(o['#sb']&&o['#sb'].until>V.now()) sb++; if(o.qk&&o.qk.until>V.now()) kd++; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', unit-ticks Willing '+wl+', Watched '+wt+', Muffled '+mf+', with Sunblind '+sb+', Kindled '+kd);
  assert.ok(wl>0&&wt>0&&mf>0&&sb>0&&kd>0&&mx.vo>=1,'Willing, the Watch, Muffled, Sunblind, Kindled and Voices in a real fight');
  determinism(H,TEAM);
});

/* The page sites her talents added (Hush's period, its target, its silence, the pass after it): with nothing learned, whole seeded fights with Lumi in the line-up
   are identical to the pre-talent page (ee8edab8), seed by seed. The counters are also the base-skill measure of the report. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Lumi: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['lumi','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __luN={dw:0,qk:0,nova:0,hush:0}; var __luD=_doEffectCore, __luU=_updateBattleCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="lumi"&&(!o||!o.deliver||o._arrived)){ if(type==="dawnward") __luN.dw++; if(type==="haste") __luN.qk++; if(type==="sunburst") __luN.nova++; } return __luD.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ const L=units.filter(u=>u&&u.key==="lumi"&&u.alive), h=L.map(u=>u._hushT||0); const r=__luU.apply(this,arguments); L.forEach((u,i)=>{ if((u._hushT||0)<h[i]-1e-9) __luN.hush++; }); return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__luN'); console.log('  identity / base skills: '+JSON.stringify(c));
    assert.ok(c.hush>20&&c.dw>0&&c.qk>0&&c.nova>0,'the fights ran Hush (every new site) and cast her three skills'); }
  finally{ VMX('_doEffectCore=__luD; _updateBattleCore=__luU;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ fm:['fm_2_3','fm_12_2','fm_1_2','fm_5_2','fm_7_4','fm_11_4','fm_2_4','fm_9_4','fm_1_1','fm_8_1'],
            qh:['qh_1_4','qh_8_4','qh_9_1','qh_11_1','qh_3_3','qh_11_4','qh_4_2','qh_2_2','qh_4_1','qh_1_1'],
            fl:['fl_3_1','fl_11_1','fl_11_4','fl_6_2','fl_7_1','fl_1_3','fl_2_2'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={fm:0,qh:1,fl:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)&&!['fm_6_4','qh_6_4','fl_6_1'].includes(t[0])).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)&&!['fm_6_4','qh_6_4','fl_6_1'].includes(t[0]))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her reduction talents true at once (Watched, Willing, warded, under her Quickening with Long Morning, Lightfoot's window, an
   enemy silenced, the attacker Muffled mid-cast or Muffled (a basic attack), with Sunblind but not missing, 5 Voices, the first skill of the wave); sustained: Watched,
   nobody silenced, no Quickening, 1 Voice, a basic attack of 5% of her max HP. Measured through the engine (HP and shield it takes). The bind (the signature) moves
   damage to her allies: moved, not reduced, so it is left out here (its 40% is shown in its own test). */
function worstHit(list,kind,crit,sustained,autoHit){ const L=ll(list,{allies:2,foes:3}), {v,F}=L; const f=F[0]; v.maxHp=1e5; v.hp=6e4; brnd(0.99);
  if(L.T){ if(!sustained){ for(const nm of ['wt','wl','dw','qk']) setMk(L,v,nm); f.silencedT=5; setMk(L,f,autoHit?'mf':'mfc'); setUst(L,f,'sb',1); setStack(L,'vo',5); L.T.s.w.lf={t:3,n:1,cdT:0,at:-1,wave:false}; lu(L).uhW=-1; }
    else { setMk(L,v,'wt'); setStack(L,'vo',1); } }
  V.step(1); if(L.T&&!sustained) lu(L).uhW=-1; v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6;
  const raw=sustained?5e3:2e4, au=sustained?true:!!autoHit, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:au})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; brndBack();
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Lumi: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['fm','qh'],[61,30]],[['fm'],[91]],[['fm','fl'],[61,30]],[['qh','fm'],[61,30]],[['fl','fm'],[61,30]],[['qh','fl'],[61,30]],[['fl','qh'],[61,30]],[['fm','qh','fl'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false,false),worstHit(c.list,kind,crit,false,true));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="lumi"&&src&&src.team!==tgt.team; let h0=0; if(me) h0=tgt.hp+(tgt.shield||0); const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="lumi"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    if(T&&e&&1-0.60*Math.min(defMul(e,u,"phys"),defMul(e,u,"magic"))>=0.85) __dr.tHi++; } } return __ubc.apply(this,arguments); };');   /* even at her group's 40% cap */
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','lumi'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; immune ticks '+d.imm+' of '+d.ticks+'; ticks that could be at 85% or more (her cap and her armor) '+d.tHi);
    assert.ok(d.n>30&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'at 85% or more (her cap and her armor) for less than half of the fight: '+d.tHi+' of '+d.ticks+' ticks'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
