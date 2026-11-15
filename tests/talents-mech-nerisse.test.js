'use strict';
/* Nerisse Bellglass's talents as data on the mechanics layer (talents-mech/nerisse.js), group by group on the still field (tests/talents-lab.js), then whole
   fights, the no-talent identity of the page sites her talents added (the orb's next hop and its flight time, the hop, where the Choir rises, the Choir's silence
   and heal), and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched off for
   one hit (plainHit) or in a plain lab built BEFORE the talented one (lab() replaces the whole field).
   nl(): the lab with Nerisse, two allies and three foes, everyone held. Places (metres from Nerisse, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0); A0 (0,-5.5)
   A1 (0,-11). A0's body is 1.9 m from hers (inside her 4 m), A1's 7.4 m. Her orb's first hop is always herself (the nearest), then A0, then A1.
   The lab's skill level is 10. Her Choir is a channel: tests free her (free()) so it is not ended by the lab's hold.
   Run: node --test tests/talents-mech-nerisse.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='nerisse', S=ids=>full(H,ids);
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
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; u._ax=u.x; u._ay=u.y; };
const nr=L=>L.T.s.nr||(L.T.s.nr={});
const brnd=x=>VMX('var __nbr=(typeof __nbr!=="undefined"&&__nbr)?__nbr:brnd; brnd=function(){ return '+x+'; };');
const brndBack=()=>VMX('if(typeof __nbr!=="undefined"&&__nbr){ brnd=__nbr; __nbr=null; }');
const SL=10, SM=VMX('skillMul')(SL), PM=SM;                    // the lab's skill level and its multiplier (her passive's too)
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; };   // a unit that thinks (its channel holds) but does nothing
const think=x=>{ free(x); x.level=1; };
function nl(list,o){ o=o||{}; const L=lab(H,list,{allies:o.allies==null?2:o.allies,foes:o.foes==null?3:o.foes,big:o.big,seed:o.seed}); for(const x of L.U){ x.energy=0; x.hots=[]; x.target=null; } for(const f of L.F) f.level=1; if(o.pre) o.pre(L); return L; }
const plain=(o,fn)=>fn(nl(null,o));
const tru=o=>Object.assign({kind:'true'},o||{});
const hitOn=(L,src,t,amt,o)=>lost(t,()=>V.hit(src,t,amt||1000,tru(o)));
const ratioIn=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const ratioOut=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const healGot=(t,fn)=>{ const h=t.hp; fn(); return t.hp-h; };
const low=(x,f)=>{ x.hp=x.maxHp*f; };
const castRS=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castOrb=L=>V.cast(L.v,'blue');
const orbs=()=>VMX('groundHazards').filter(h=>h.orb);
const orbRun=()=>{ for(let i=0;i<400&&orbs().length;i++) V.step(1); };
const noHot=L=>{ L.v.blueAb=Object.assign({},L.v.blueAb,{hot:0}); };
const choirs=()=>VMX('groundHazards').filter(h=>h.choir);
const choir=(L,t)=>{ free(L.v); V.cast(L.v,'ult',t||L.F[0]); return choirs()[choirs().length-1]; };
const pelagic=(L,pm)=>{ const v=L.v, a=0.08*(pm||v.passMul||1); v.glyphDR=(v.glyphDR||0)-(v._piAdd||0)+a; v._piAdd=a; v._piT=99; };
const unheard=L=>{ for(const f of L.F) if(f._talM&&f._talM[L.v.uid]) delete f._talM[L.v.uid].nr_hd; };   // the Heard the wave's start gave (everyone at 0 energy: the first foe)
const press=x=>{ think(x); x._pend={t:0.6,spell:true,fire:()=>{}}; };
/* the heals her skills give (healFrom, as offered: after her talents, before healing power): [[uid, amount], ...] in order */
function hfLog(fn){ VMX('var __hfL=[]; var __hf0=healFrom; healFrom=function(s,t,a){ if(s&&s._tal&&s._tal.on&&s._tal.on.healOut&&!s._tal.hb) return __hf0.apply(this,arguments); __hfL.push([t.uid,a]); return __hf0.apply(this,arguments); };');
  try{ fn(); return JSON.parse(JSON.stringify(VMX('__hfL'))); } finally{ VMX('healFrom=__hf0;'); } }

test('Nerisse: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['ds_1_4','ds_7_4','ds_5_2','wh_3_3','wh_8_3','wh_11_4','sb_2_1','sb_5_3','sb_12_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const M=FXN.mech(H); for(const id of ['ds_13_3','wh_13_2','sb_13_2','wh_n1','ds_1_2','wh_1_1','sb_1_3']) assert.ok(M.talents[id],id);
  assert.equal(T.talent(H,'ds_10_3').name,'Drifting Spark'); assert.equal(T.talent(H,'sb_5_1').name,'Slack Water'); assert.equal(T.talent(H,'sb_5_3').name,'Sea Iron');
});

test('Nerisse: her real kit, as the talents read it - Resonant Star 2.1 s, the orb visits her first then the nearest, the Choir a channel, Pelagic Insight at the press',()=>{
  const L=nl(null), {v,A,F}=L; assert.ok(!v._tal,'no talents: no runtime');
  const h=F[0].hp; castRS(L); assert.ok(F[0].hp<h,'Resonant Star strikes'); near(F[0].silencedT,3.0*V.ccNerf,'and silences 2.1 s (the table, not the kit\'s 2.4)',1e-9);
  for(const x of [v,A[0],A[1]]) low(x,0.3); const lg=hfLog(()=>{ castOrb(L); assert.equal(orbs()[0].tgt,v,'the orb\'s first hop is herself'); orbRun(); });
  assert.deepEqual(lg.map(x=>x[0]),[v.uid,A[0].uid,A[1].uid],'then the nearest ally, then the next'); near(lg[0][1],v.apow*0.38*SM,'each 38% of her ability power x skill level',1e-9);
  assert.ok(A[1].hots.some(q=>Math.abs(q.hps-A[1].maxHp*0.022)<1e-6*A[1].maxHp),'and a heal over time of 2.2% of max HP a second');
  const c=choir(L), f1=F[1]; V.step(1); near(F[0].silencedT,1.5*V.ccNerf,'the Choir: every enemy inside silenced 1.05 s each second',0.05); assert.ok(f1.silencedT>0,'(F1, 5.5 m from its centre)'); assert.ok(!(F[2].silencedT>0),'(not F2, 11 m)');
  v.stunned=1; V.step(1); assert.equal(choirs().length,0,'a stun ends the channel'); v.stunned=1e6;
  v.glyphDR=0; v._piT=0; v._piAdd=0; VMX('castKit')(v,v.greenAb); near(v.glyphDR,0.08*PM,'Pelagic Insight: 8% x its level, at the press',1e-9); near(v._piT,5,'for 5 s',1e-9);
});

/* ======================= THE DRIFTING STAR ======================= */
test('Nerisse / Phosphor: Blue Glow (1 a hop, her too; max 4; 8 s + Long Glow 1.5 x 3), its heal each second (0.1% x 5 a stack, Floodlight 3% x 5; at most 1.2%), Trench Born',()=>{
  const L=nl(S(['ds_1_2','ds_2_2','ds_3_1','ds_10_2'])), {v,A}=L; for(const x of [v,A[0],A[1]]){ low(x,0.5); x.shield=0; }
  castOrb(L); let i=0; while(!(ust(L,A[1],'ph')>0)&&i++<300) V.step(1); near(ustLeft(L,A[1],'ph'),12.5,'Phosphor lasts 8 s + 4.5 s',0.004);
  orbRun(); for(const x of [v,A[0],A[1]]) assert.equal(ust(L,x,'ph'),1,'one Phosphor on each hero the orb reached (Nerisse too)');
  near(A[0].shield,0.03*A[0].maxHp,'Trench Born: the first Phosphor shields 0.6% x 5 of max HP',1e-9); near(v.shield,0.03*v.maxHp,'(her too)',1e-9);
  for(const x of [v,A[0],A[1]]) x.shield=0; castOrb(L); orbRun(); assert.equal(ust(L,A[0],'ph'),2,'a second hop: 2'); assert.equal(A[0].shield,0,'Trench Born only for the first one');
  for(let k=0;k<5;k++){ castOrb(L); orbRun(); } assert.equal(ust(L,A[0],'ph'),4,'at most 4');
  for(const x of L.U) x.hots=[]; low(A[1],0.5); setUst(L,A[1],'ph',1,99); nr(L).secA=0.999; near(healGot(A[1],()=>V.step(1)),0.005*1.15*A[1].maxHp,'1 Phosphor: 0.5% of max HP a second, Floodlight 15% more',1e-6);
  low(A[1],0.5); setUst(L,A[1],'ph',4,99); nr(L).secA=0.999; near(healGot(A[1],()=>V.step(1)),0.012*A[1].maxHp,'4 Phosphor: 2.3% asked, held at 1.2% a second',1e-6);
  low(A[1],0.5); nr(L).secA=0; near(healGot(A[1],()=>secs(0.9)),0,'once a second',1e-9);
});

test('Nerisse / the orb\'s heals: Soft Current (3% x 3), Deep Mending (2% x 5), Tidal Mending (below 50%: 2% x 5), Patient Glow (its heal over time 0.2 s longer a rank, a part tick), Drifting Spark',()=>{
  const p=plain({},P=>{ for(const x of [P.v,...P.A]) low(x,0.3); return hfLog(()=>{ castOrb(P); orbRun(); }); });
  let L=nl(S(['ds_2_4','sb_9_1','ds_9_4','ds_10_3'])), {v,A}=L; for(const x of [v,...A]) low(x,0.3); A[1].hp=A[1].maxHp*0.6;
  const lg=hfLog(()=>{ castOrb(L); orbRun(); }); near(lg[0][1],p[0][1]*1.19*1.10,'below 50%: 19% and Tidal Mending 10% more',1e-9); near(lg[2][1],p[2][1]*1.19,'above 50%: 19% more',1e-9);
  for(const x of [v,...A]) near(x.energy,3,'Drifting Spark: 1 x 3 energy a hop (her too)',1e-9);
  L=nl([['ds_3_4',2]]); low(L.A[0],0.3); castOrb(L); for(let i=0;i<300&&!L.A[0].hots.length;i++) V.step(1); const q=L.A[0].hots[0];
  assert.equal(q.remaining,5,'Patient Glow 2/5: 4.4 s of ticks'); near(q._talF,0.4,'its last tick a 0.4 part',1e-9); assert.ok(q._talU===L.v,'(the heal over time is hers)');
});

test('Nerisse / Returning Star (PICK ONE: once more to the lowest HP share) and Homeward (8% x 3); Wandering Star (PICK ONE: a second round, 35% smaller) and Long Drift',()=>{
  const p=plain({},P=>{ for(const x of [P.v,...P.A]) low(x,0.4); return hfLog(()=>{ castOrb(P); orbRun(); }); });
  let L=nl(S(['ds_5_1','ds_6_1'])), {v,A}=L; for(const x of [v,...A]) low(x,0.4); low(A[0],0.2);
  let lg=hfLog(()=>{ castOrb(L); orbRun(); }); assert.equal(lg.length,4,'4 hops'); assert.equal(lg[3][0],A[0].uid,'the last back to the lowest HP share');
  near(lg[3][1],p[1][1]*1.24,'Homeward: the return hop heals 24% more',1e-9); near(lg[1][1],p[1][1],'(the first visit as usual)',1e-9);
  L=nl(S(['ds_5_3','ds_6_3'])); for(const x of [L.v,...L.A]) low(x,0.4); lg=hfLog(()=>{ castOrb(L); orbRun(); });
  assert.equal(lg.length,6,'Wandering Star: every ally twice'); for(const x of lg) near(x[1],p[0][1]*0.65,'each heal 35% smaller',1e-9);
  for(let i=1;i<lg.length;i++) assert.notEqual(lg[i][0],lg[i-1][0],'never straight back onto the ally it has just reached');
  for(const x of [L.v,...L.A]) assert.equal(ust(L,x,'ph'),PHX(L,x),'Long Drift: a second visit 1 + 3 more Phosphor (at most 4)');
});
const PHX=()=>4;

test('Nerisse / Quick Orb (5% x 3 faster), Warning Light (first to the ally the Heard enemy attacks, 30% stronger) and Forewarned Friends (2% x 5), Slow Tide',()=>{
  const p=plain({},P=>{ for(const x of [P.v,...P.A]) low(x,0.4); castOrb(P); return orbs()[0].hopDur; });
  let L=nl(S(['ds_4_1','ds_6_2'])); castOrb(L); near(orbs()[0].hopDur,p/1.15,'Quick Orb: each hop 15% faster',1e-9); orbRun();
  near(VMX('TalentFx').cd(L.v,'blue',9),9-0.75,'Slow Tide: 0.15 s x 5 sooner',1e-9);
  const pl=plain({},P=>{ for(const x of [P.v,...P.A]) low(x,0.4); return hfLog(()=>{ castOrb(P); orbRun(); }); });
  L=nl(S(['wh_7_2','wh_9_2','wh_1_1'])); const {v,A,F}=L; for(const x of [v,...A]) low(x,0.4); setMk(L,F[0],'nr_hd'); nr(L).lastHd=F[0]; F[0].target=A[1];
  const lg=hfLog(()=>{ castOrb(L); assert.equal(orbs()[0].tgt,A[1],'Warning Light: the first hop goes to the ally the Heard enemy attacks'); orbRun(); });
  near(lg[0][1],pl[2][1]*1.40,'its heal 30% + 10% stronger',1e-9); near(lg[1][1],pl[0][1],'(the others as usual)',1e-9);
  L=nl(S(['wh_7_2'])); unheard(L); L.F[0].target=L.A[1]; nr(L).lastHd=L.F[0]; castOrb(L); assert.equal(orbs()[0].tgt,L.v,'not Heard: as usual');
});

test('Nerisse / Wake: In Its Wake (3 s + Long Wake 0.5 x 3; 1% x 5 less), Gentle Hands (her heals 2% x 5 stronger), Heavy Glow (Phosphor: 0.5% x 5 less), Abyssal Calm (1% x 5 a stack, max 3, 3 s)',()=>{
  const p=plain({},P=>{ for(const x of [P.v,...P.A]) low(x,0.3); return hfLog(()=>{ castOrb(P); orbRun(); castOrb(P); orbRun(); }); });
  const L=nl(S(['ds_2_3','ds_4_3','ds_7_1','ds_12_2','ds_11_4','ds_1_2'])), {v,A,F}=L; for(const x of [v,...A]) low(x,0.3);
  const lg=hfLog(()=>{ castOrb(L); let i=0; while(!mk(L,A[0],'nr_wk')&&i++<300) V.step(1); near(left(L,A[0],'nr_wk'),4.5,'the Wake: 3 s + 1.5 s',0.004); orbRun(); castOrb(L); orbRun(); });
  near(lg[0][1],p[0][1],'a first hop: no Wake yet',1e-9); near(lg[4][1],p[4][1]*1.10,'Gentle Hands: a second hop on an ally still in the Wake 10% stronger',1e-9);
  near(ratioIn(L,F[0],A[0]),0.95*0.975,'In Its Wake 5% less, Heavy Glow (it has Phosphor) 2.5% less',1e-9);
  F[1]._talM&&delete F[1]._talM[v.uid]; V.hit(F[1],A[0],10,tru()); assert.equal(ust(L,F[1],'ac'),1,'Abyssal Calm: an enemy that hits an ally in the Wake');
  A[1]._talM&&delete A[1]._talM[v.uid]; near(ratioIn(L,F[1],A[1]),0.95,'deals 5% less to her team (A1: no Wake, no Phosphor)',1e-9);
  for(let i=0;i<5;i++) V.hit(F[1],A[0],10,tru()); assert.equal(ust(L,F[1],'ac'),3,'up to 3'); near(ratioIn(L,F[1],A[1]),0.85,'15% less',1e-9);
  secs(3.05); near(ratioIn(L,F[1],A[1]),1,'for 3 s',1e-9); secs(2); assert.ok(!mk(L,A[0],'nr_wk'),'the Wake is over');
});

test('Nerisse / Pressure: Weight of Water (each second within 4 m, 0.4% x 5 armor and magic resist a stack; max 5 + Crushing Depth 3; all lost 2 s after they leave), Deep Weight, Equal Weight, Held Down',()=>{
  const L=nl(S(['ds_4_4','ds_5_4','ds_12_4','ds_8_4','ds_10_4'])), {v,A,F}=L; const a0=A[0].armorRating, m0=A[0].mrRating, a1=A[1].armorRating;
  secs(2.05); V.step(1); near(A[0].armorRating/a0,1+2*0.024,'2 s near her: 2 Pressure, 2.4% armor each (Deep Weight 0.4 points)',1e-9); near(A[0].mrRating/m0,1+2*0.02,'2% magic resist each',1e-9);
  near(A[1].armorRating,a1,'A1 (7.4 m from her body): none',1e-9);
  secs(9); V.step(1); near(A[0].armorRating/a0,1+8*0.024,'at most 8',1e-9);
  F[0]._castSlot='ult'; near(ratioIn(L,F[0],A[0]),0.92,'Equal Weight: 5 or more Pressure, 4% x 2 less from an enemy ultimate',1e-9); near(ratioIn(L,F[0],A[0],{auto:true}),1,'(not a basic attack)',1e-9); F[0]._castSlot=null;
  near(ratioIn(L,F[0],A[0]),1,'(not a skill that is no ultimate)',1e-9);
  F[1].slow=0; F[1].slowMul=1; V.hit(F[1],A[0],10,tru()); near(F[1].slowMul,0.91,'Held Down: the attacker slowed 3% x 3',1e-9); near(F[1].slow,2,'for 2 s',1e-9);
  F[2].slow=0; F[2].slowMul=1; V.hit(F[2],A[1],10,tru()); assert.equal(F[2].slow,0,'(not for hitting an ally without 5 Pressure)');
  at(L,A[0],0,-20); secs(1.9); V.step(1); near(A[0].armorRating/a0,1+8*0.024,'it stays 2 s after she leaves',1e-9); secs(0.2); V.step(1); near(A[0].armorRating,a0,'then it is all gone',1e-9);
});

test('Nerisse / Bright Bloom (reached at 4: spends them for 6% of max HP), Bright Deep (the spare glow to the fewest, 1 a rank), Lanternfish, Glow Rich, Quiet Trench, Still Water, Cold Calm, Thin Shell',()=>{
  const ph=plain({},P=>{ noHot(P); low(P.A[0],0.3); return healGot(P.A[0],()=>{ castOrb(P); orbRun(); }); });
  let L=nl(S(['ds_3_2','ds_2_2'])), {v,A}=L; noHot(L); setUst(L,A[0],'ph',4); low(A[0],0.3);
  near(healGot(A[0],()=>{ castOrb(L); orbRun(); })-ph,0.06*A[0].maxHp,'Bright Bloom: 6% of its max HP',1e-6); assert.equal(ust(L,A[0],'ph'),0,'its Phosphor is spent');
  L=nl(S(['ds_12_1','ds_3_1','ds_2_2'])); setUst(L,L.A[0],'ph',4); L.A[1].shield=0; castOrb(L); orbRun();
  assert.equal(ust(L,L.A[1],'ph'),2,'Bright Deep: the spare passes to the one with the fewest (A1), then its own hop'); assert.ok(L.A[1].shield>0,'(Trench Born for that first one)'); assert.equal(ust(L,L.A[0],'ph'),4,'A0 stays full');
  L=nl(S(['ds_9_1','ds_8_1','ds_11_1','ds_1_1','ds_8_2','ds_6_4','ds_1_2'])); const x=L.A[0]; nr(L).secA=-99;
  setUst(L,x,'ph',4); low(x,0.5); V.step(1); low(x,0.25); const g=healGot(x,()=>V.step(1)); near(g,0.12*x.maxHp,'Lanternfish: below 30% with 4 Phosphor, 3% a stack (spent first: no Glow Rich on it)',1e-6); assert.equal(ust(L,x,'ph'),0,'spent');
  setUst(L,x,'ph',4); low(x,0.5); V.step(1); low(x,0.25); near(healGot(x,()=>V.step(1)),0,'once every 10 s',1e-9);
  setUst(L,x,'ph',4); low(x,0.5); const pl=plainHit(L,()=>healGot(x,()=>V.heal(x,1000))); low(x,0.5); near(healGot(x,()=>V.heal(x,1000)),pl*1.06,'Glow Rich: 4 Phosphor, 2% x 3 more healing',1e-9);
  setUst(L,L.A[1],'ph',1); near(ratioIn(L,L.F[0],L.v),0.925*1.06,'Quiet Trench: every other ally carries Phosphor (7.5% less); Thin Shell 6% more',1e-9);
  delete L.A[1]._talM[L.v.uid]['#ph']; near(ratioIn(L,L.F[0],L.v),1.06,'(not when one does not)',1e-9);
  near(ratioIn(L,L.F[0],L.v,{kind:'magic'}),0.95*1.06,'Cold Calm: 1% x 5 less magic',1e-6);
  castOrb(L); near(ratioIn(L,L.F[0],L.v),0.94*1.06,'Still Water: 2% x 3 less while the orb flies',1e-9); orbRun(); near(ratioIn(L,L.F[0],L.v),0.925*1.06,'and not after (the orb gave A1 Phosphor again: Quiet Trench)',1e-9);
  for(const y of L.U) y.hots=[]; low(L.A[1],0.5); setUst(L,L.A[1],'ph',1,99); nr(L).secA=0.999; near(healGot(L.A[1],()=>V.step(1)),0.005*1.12*L.A[1].maxHp,'Thin Shell: Phosphor heals 6% x 2 more',1e-6);
});

/* ======================= WHAT THE DEEP HEARS ======================= */
test('Nerisse / Heard: Listening (every 4 s - Sharp Ears 0.4 x 3: the most energy; its next skill 1.5% x 5 less), Breath Before, She Lets Them Say It, Forewarned, Long Listening, Before It Lands, Known Hunter',()=>{
  const L=nl(S(['wh_1_1','wh_2_1','wh_4_1','wh_12_1','wh_6_1','wh_10_1','wh_9_1','wh_8_1'])), {v,A,F}=L; unheard(L); V.step(1); const i0=F[1].atkInterval; F[1].energy=60; F[2].energy=10; nr(L).hdA=0;
  secs(2.75); assert.ok(!mk(L,F[1],'nr_hd'),'not before 2.8 s'); secs(0.1); assert.ok(mk(L,F[1],'nr_hd')&&!mk(L,F[2],'nr_hd'),'then the enemy closest to a full ultimate is Heard');
  near(ratioIn(L,F[1],A[0],{auto:true}),0.95*0.98,'Breath Before 5% less from it; She Lets Them Say It (A0 within 4 m of her) 2%',1e-9); near(ratioIn(L,F[1],A[1],{auto:true}),0.95,'A1 (not near): 5%',1e-9);
  near(ratioIn(L,F[0],A[1],{auto:true}),1,'(not from an enemy that is not Heard)',1e-9); near(ratioOut(L,A[0],F[1]),1.05,'Forewarned: 1% x 5 more from her team',1e-9);
  V.step(1); near(F[1].atkInterval/i0,1/0.94,'Long Listening: it attacks 2% x 3 slower',1e-6);
  press(F[1]); V.step(1); assert.ok(!mk(L,F[1],'nr_hd'),'heard once: its Heard is spent on the skill it began'); near(F[1].atkInterval,i0,'(and its attacks are as before)',1e-6);
  near(ratioIn(L,F[1],A[1]),(1-0.075)*(1-0.15),'that skill: Listening 7.5% less, Before It Lands 15% less',1e-9); near(ratioIn(L,F[1],A[1],{auto:true}),1,'(not its basic attacks)',1e-9);
  secs(2.2); near(ratioIn(L,F[1],A[1]),1,'only that skill (its cast time + 1.5 s)',1e-9); F[1]._pend=null; F[1].stunned=1e6;
  F[2].energy=99; nr(L).hdA=99; V.step(1); F[2].energy=0; F[1].energy=99; nr(L).hdA=99; V.step(1); nr(L).hdA=99; V.step(1); assert.ok(mk(L,F[1],'nr_hd'),'F1 heard again (twice this wave)');
  press(F[1]); V.step(1); near(left(L,F[1],'nr_hd'),3,'Known Hunter: it stays Heard 1 s x 3 after its skill begins',0.02);
});

test('Nerisse / Open Ears (RISK: 3% x 2 more taken, hears 0.5 s x 2 sooner), Tuning Fork, Tuned to Their Voice (Resonant Star flies to a Heard enemy, 1 s longer on it), The Deep Rings Back (LINK)',()=>{
  let L=nl(S(['wh_1_1','wh_6_4','wh_12_3','wh_3_1'])), {v,A,F}=L; unheard(L); F[2].energy=50; nr(L).hdA=0; secs(2.9); assert.ok(!mk(L,F[2],'nr_hd')); secs(0.15); assert.ok(mk(L,F[2],'nr_hd'),'every 3 s');
  near(ratioIn(L,F[0],v,{auto:true}),1.06,'Open Ears: she takes 6% more',1e-9);
  v._castSlot='green'; v._castLv=SL; v._castSM=SM; v.target=F[0]; VMX('doEffect')(v,'silencestrike',Object.assign({},v.greenAb)); v._castSlot=null; v._castSM=1; v._castLv=0; for(let i=0;i<80&&!(F[2].silencedT>0);i++) V.step(1);
  assert.ok(F[2].silencedT>0&&!(F[0].silencedT>0),'Tuned to Their Voice: the shot went to the Heard enemy'); near(F[2].silencedT,2.1+1,'and silenced it 1 s longer',0.012);
  const p=plain({},P=>{ const h=P.F[0].hp; castRS(P); return h-P.F[0].hp; }); L=nl(S(['wh_12_3','wh_n1','sb_1_3'])); setMk(L,L.F[0],'nr_hd'); const h=L.F[0].hp; castRS(L);
  near(h-L.F[0].hp,p*1.09,'Tuning Fork: 3% x 3 more on a Heard enemy',1e-6); assert.ok(mk(L,L.F[0],'nr_drb'),'The Deep Rings Back: its next skill is marked'); assert.equal(stk(L,'tl'),2,'with First Toll: the bell rings twice');
  press(L.F[0]); V.step(1); near(ratioIn(L,L.F[0],L.A[0]),0.96,'its next skill deals 4% less',1e-9); L.F[0]._pend=null;
  L=nl(S(['wh_n1'])); setMk(L,L.F[0],'nr_hd'); castRS(L); assert.equal(stk(L,'tl'),0,'without a Ship\'s Bell Toll talent: no Toll');
});

test('Nerisse / Brace: Bracing (each Green / Blue press, max 4, 6 s + Long Brace 1 x 3; Pelagic Insight 0.5% x 5 stronger a Brace), Brace Again, Low Hum, Hollow Shell, Hunter\'s Breath',()=>{
  const L=nl(S(['wh_2_2','wh_4_2','wh_12_4','wh_3_4','wh_9_3','wh_5_1'])), {v,A,F}=L; const cd=VMX('TalentFx').cd;
  for(let i=0;i<9;i++) cd(v,i%2?'blue':'green',7); assert.equal(stk(L,'br'),7,'each press 1 Brace, at most 4 + 3'); secs(8.9); assert.equal(stk(L,'br'),7,'all of it for 9 s'); secs(0.2); assert.equal(stk(L,'br'),0,'then gone');
  setStack(L,'br',4); pelagic(L); v.hp=v.maxHp; near(ratioIn(L,F[0],v),1-(0.08*PM*0.10+0.02),'Pelagic Insight 10% stronger (4 Brace) and Hollow Shell 2 points (on top of the game\'s own share)',1e-9);
  v._piT=0; v._piAdd=0; v.glyphDR=0; near(ratioIn(L,F[0],v),1,'only while Pelagic Insight is up',1e-9);
  VMX('castKit')(v,v.greenAb); v._pend=null; V.step(1); near(v._piT,6-V.STEP,'Hunter\'s Breath: Pelagic Insight lasts 0.2 s x 5 longer',0.01);
  const p=plain({},P=>{ for(const x of [P.v,...P.A]) low(x,0.4); return hfLog(()=>{ castOrb(P); orbRun(); }); }), M=nl(S(['wh_3_4'])); for(const x of [M.v,...M.A]) low(x,0.4); setStack(M,'br',3);
  near(hfLog(()=>{ castOrb(M); orbRun(); })[0][1],p[0][1]*1.06,'Low Hum: her heals 0.4% x 5 stronger a Brace',1e-9);
});

test('Nerisse / Stand Fast (PICK ONE: 4 Brace, no stun, no knock-back) and Rooted Feet; Slip Away (PICK ONE: the first enemy hit every 5 s misses) and Gone Already; Quiet Mind (15%), Patience Below',()=>{
  let L=nl(S(['wh_5_2','wh_6_2','wh_1_4'])), {v,F}=L; v.stunned=0; v.level=1; V.cc(F[0],v,'fearT',2); near(v.fearT,2*V.ccNerf*0.85,'Quiet Mind: 5% x 3 shorter',1e-9); v.fearT=0;
  V.cc(F[0],v,'stunned',2); near(v.stunned,2*V.ccNerf*0.85,'3 Brace: a stun lands',1e-9); v.stunned=0; setStack(L,'br',4);
  V.cc(F[0],v,'stunned',2); assert.equal(v.stunned,0,'Stand Fast: at 4 Brace no stun'); V.step(1); v.stunned=1.2; V.step(1); assert.ok(!(v.stunned>0.5),'a stun written straight on is taken off too'); assert.ok(v._gearImmovableT>0,'and she cannot be knocked back');
  near(ratioIn(L,F[0],v),0.94,'Rooted Feet: 2% x 3 less at 4 Brace',1e-9); setStack(L,'br',3); near(ratioIn(L,F[0],v),1,'(not at 3)',1e-9); v.stunned=1e6;
  L=nl(S(['wh_5_3','wh_6_3'])); setStack(L,'br',4); L.v.energy=0; L.v.hp=L.v.maxHp; assert.equal(hitOn(L,L.F[0],L.v,500),0,'Slip Away: at 4 Brace the first hit misses'); near(L.v.energy,9,'Gone Already: 3 x 3 energy',1e-9);
  assert.ok(hitOn(L,L.F[0],L.v,500)>0,'the next one lands'); secs(4.4); assert.ok(hitOn(L,L.F[1],L.v,500)>0,'(not again before 5 s)'); secs(0.65); setStack(L,'br',4); assert.equal(hitOn(L,L.F[1],L.v,500),0,'every 5 s'); setStack(L,'br',3); secs(5.05); assert.ok(hitOn(L,L.F[1],L.v,500)>0,'(only at 4 Brace)');
  L=nl([['wh_1_4',2]]); L.v.stunned=0; L.v.level=1; V.cc(L.F[0],L.v,'fearT',2); near(L.v.fearT,2*V.ccNerf*0.90,'Quiet Mind 2/3: 10% shorter',1e-9); L.v.stunned=1e6;
  L=nl(S(['wh_11_1'])); near(VMX('TalentFx').cd(L.v,'green',7),7*0.95,'Patience Below: 1% x 5 sooner',1e-9); near(VMX('TalentFx').cd(L.v,'blue',9),9*0.95,'(both)',1e-9);
});

test('Nerisse / Echo: a silence of hers that cuts a cast short (max 3); Cancelled Note (2% x 3 ability power each), Ringing Back (1% x 5 of max HP), Echo Chamber (0.5% x 5 less), Answering Note',()=>{
  const L=nl(S(['wh_4_4','wh_5_4','wh_7_4','wh_8_4'])), {v,F}=L; const ap=v.apow; v.hp=v.maxHp*0.5; v.greenCd=5;
  castRS(L); assert.equal(stk(L,'ec'),0,'a silence on an enemy that was not casting: no Echo');
  v.target=F[1]; const aff=plainHit(L,()=>healGot(v,()=>V.heal(v,1000)))/1000; v.hp=v.maxHp*0.5;   // (the game's own +20% healing for a Support's team while it attacks a Tank: the lab Vaels are Tanks)
  F[1]._pend={t:1,spell:true,fire:()=>{}}; const h=v.hp; castRS(L,F[1]); assert.equal(stk(L,'ec'),1,'it was casting: an Echo'); near(v.hp-h,0.05*v.maxHp*aff,'Ringing Back: 5% of her max HP',1e-6); near(v.greenCd,4,'Answering Note: Resonant Star 0.5 s x 2 sooner',1e-9);
  F[1]._pend=null; V.step(1); near(v.apow/ap,1.06,'Cancelled Note: 6% ability power an Echo',1e-9);
  for(let i=0;i<4;i++){ F[2]._pend={t:1,spell:true,fire:()=>{}}; castRS(L,F[2]); } F[2]._pend=null; assert.equal(stk(L,'ec'),3,'at most 3'); V.step(1); near(v.apow/ap,1.18,'18%',1e-9);
  v.hp=v.maxHp; near(ratioIn(L,F[0],v),1-0.075,'Echo Chamber: 2.5% less an Echo',1e-9); V.wave(); V.step(2); assert.equal(stk(L,'ec'),0,'kept for the wave');
});

/* ======================= THE SHIP'S BELL ======================= */
test('Nerisse / Resonant Star\'s silence: True Pitch (0.1 x 3), Echoing Steel (0.08 x 5), One Clear Note (1 s), Long Silence (2% x 5 of the real 2.1 s); at most 4 s; its damage, its cooldown',()=>{
  const p=plain({},P=>{ const h=P.F[0].hp; castRS(P); return h-P.F[0].hp; });
  let L=nl(S(['wh_2_3','sb_8_3','sb_1_1','wh_1_3','sb_3_4','wh_7_1','sb_4_4'])), {v,F}=L; const h=F[0].hp; castRS(L);
  near(F[0].silencedT,2.1+0.3+0.4,'2.1 s + 0.7 s',1e-9); near(h-F[0].hp,p*1.15*1.15*1.10*1.10,'Bright Fork 15%, Clean Note 15%, Deep Voice 10%, Deep Pulse 10%',1e-6);
  near(ratioOut(L,v,F[1],{auto:true,kind:'magic'}),1.10*1.10,'her basic attacks are magic: Deep Voice and Deep Pulse raise them too (not Bright Fork or Clean Note)',1e-9); near(ratioOut(L,v,F[1],{auto:true,kind:'phys'}),1,'(a physical hit: none of them)',1e-9); near(VMX('TalentFx').cd(v,'green',7),6.4,'Ringing Fork: 0.2 s x 3 sooner',1e-9);
  L=nl(S(['sb_5_4','sb_11_4','sb_6_4'])); const h2=L.F[0].hp; castRS(L); near(L.F[0].silencedT,2.1*1.10+1,'One Clear Note 1 s, Long Silence 10% of the real 2.1 s',1e-9); near(h2-L.F[0].hp,p*1.15,'Pure Tone: 5% x 3 more',1e-6);
  L=nl(S(['wh_2_3','sb_8_3','sb_5_4','sb_11_4','wh_3_1'])); setMk(L,L.F[0],'nr_hd'); castRS(L); near(L.F[0].silencedT,4,'all of them on a Heard enemy: 2.31 + 0.3 + 0.4 + 1 + 1, held at 4 s',1e-9);
});

test('Nerisse / Full Peal (PICK ONE: the enemy nearest its target, half as long) and Wide Peal (10% x 3); Storm Bell (5 Tolls: every enemy within 2 m of the target too)',()=>{
  let L=nl(S(['sb_5_2','sb_6_2'])), {v,F}=L; castRS(L); near(F[1].silencedT,2.1*0.5*1.3,'Full Peal: the nearest enemy (F1) 1.05 s x 1.3',1e-9); assert.ok(!(F[2].silencedT>0),'(only one)');
  L=nl(S(['sb_3_3','sb_1_3','sb_2_3','sb_11_4'])); setStack(L,'tl',3); castRS(L); assert.equal(stk(L,'tl'),4,'each Resonant Star rings 1 Toll'); assert.ok(!(L.F[1].silencedT>0),'4: no storm');
  castRS(L); assert.equal(stk(L,'tl'),0,'at 5 it spends them all'); near(L.F[1].silencedT,2.1*1.1,'F1 (1.5 m from F0\'s body) silenced as long as F0',1e-9); assert.ok(!(L.F[2].silencedT>0),'(F2, 7 m: not)');
});

test('Nerisse / Toll: First Toll (0.5% x 5 ability power a Toll, max 5, kept for the wave), Heavy Bell, Cracked Bell (RISK), Toll for the Fallen; Insight of the Bell (1% a Toll; the ally nearest her) and Ringing Insight',()=>{
  const L=nl(S(['sb_1_3','sb_2_3','sb_6_1','sb_10_3','sb_7_2','sb_9_2'])), {v,A,F}=L; const ap=v.apow;
  castRS(L); assert.equal(stk(L,'tl'),1,'one Toll a cast'); for(let i=0;i<9;i++) castRS(L); assert.equal(stk(L,'tl'),8,'at most 5 + 3'); V.step(1); near(v.apow/ap,1+8*(0.025+0.006),'2.5% + Cracked Bell 0.6% ability power a Toll',1e-9);
  near(ratioIn(L,F[0],v),1.04,'Cracked Bell (RISK): she takes 2% x 2 more',1e-9);
  pelagic(L); A[0].hp=A[0].maxHp; near(ratioIn(L,F[0],A[0]),1-(0.08*PM*1.08+0.025),'Insight of the Bell: the ally nearest her has her Pelagic Insight (8 Tolls: 8% stronger), Ringing Insight 2.5% more',1e-9);
  near(ratioIn(L,F[0],A[1]),1,'(not the other ally)',1e-9); v._piT=0; v._piAdd=0; v.glyphDR=0; near(ratioIn(L,F[0],A[0]),1,'only while hers is up',1e-9);
  setStack(L,'tl',2); F[1].silencedT=0; F[1].hp=1; V.hit(v,F[1],1e3,tru()); assert.ok(!F[1].alive); assert.equal(stk(L,'tl'),2,'(an enemy that dies unsilenced: nothing)');
  F[2].silencedT=3; F[2].hp=1; V.hit(v,F[2],1e3,tru()); assert.ok(!F[2].alive); assert.equal(stk(L,'tl'),3,'Toll for the Fallen: an enemy dies silenced, 1 Toll');
  V.step(1); near(v.apow/ap,1+3*0.031+0.05,'and 1% x 5 ability power for 5 s',1e-9); secs(5.1); near(v.apow/ap,1+3*0.031,'',1e-9);
  V.wave(); V.step(2); assert.equal(stk(L,'tl'),0,'a new wave: no Toll');
});

test('Nerisse / Drowned: Under the Surface (silenced 3 s in a row: 4 s, 2% x 5 more magic damage), Sinking Fast, Heavy Water, No Air, Hard Water, Drowning Weight, Ringing Ears, Trench Hunter',()=>{
  const L=nl(S(['sb_2_2','sb_8_4','sb_9_4','sb_3_1','sb_12_3','sb_6_3','sb_7_4'])), {v,A,F}=L; F[0].silencedT=9; F[0].energy=10;
  secs(2.95); assert.ok(!mk(L,F[0],'nr_dw'),'not before 3 s'); secs(0.1); assert.ok(mk(L,F[0],'nr_dw'),'Drowned'); near(left(L,F[0],'nr_dw'),5.5,'for 4 s + Heavy Water 1.5 s',0.04);
  near(ratioOut(L,A[0],F[0],{kind:'magic'}),1.10*1.03*1.05,'magic: Under the Surface 10%, Drowning Weight 3%, Ringing Ears (silenced) 5%',1e-6); near(ratioOut(L,A[0],F[0]),1.03*1.05,'true damage: Drowning Weight, Ringing Ears',1e-9);
  near(ratioOut(L,v,F[0],{auto:true}),1.03*1.05*1.15,'Trench Hunter: her basic attacks 3% x 5 more on a silenced enemy',1e-9);
  near(ratioIn(L,F[0],v),1-0.075,'Hard Water: 1.5% x 5 less from a silenced or Drowned enemy',1e-9);
  F[0].energy=40; V.step(1); near(F[0].energy,10,'No Air: a Drowned enemy gains no energy',1e-9);
  F[0].silencedT=0; secs(5.6); assert.ok(!mk(L,F[0],'nr_dw'),'it surfaces'); F[0].energy=40; V.step(1); near(F[0].energy,40,'and gains energy again',1e-9);
  const M=nl(S(['sb_2_2','sb_4_2'])); M.F[1].silencedT=9; secs(2.05); assert.ok(!mk(M,M.F[1],'nr_dw')); secs(0.1); assert.ok(mk(M,M.F[1],'nr_dw'),'Sinking Fast: after 2.1 s');
});

test('Nerisse / the Current: The Current (allies inside her Choir attack 1.5% x 5 faster), Strong Current (1 point x 2), Swift Current, Slack Water (enemies 4% x 3 slower), Undercurrent, Undertone, Pressure Wave',()=>{
  const L=nl(S(['sb_4_1','sb_12_1','sb_8_1','sb_5_1','sb_10_1','sb_11_1','sb_10_2'])), {v,A,F}=L; const i0=A[0].atkInterval, i1=A[1].atkInterval, s0=A[0].speed;
  at(L,F[2],13.3,0); choir(L); V.step(2);
  near(i0/A[0].atkInterval,1.095,'A0 (7.1 m from its centre): 7.5% + 2 points faster',1e-6); near(A[1].atkInterval,i1,'A1 (11.9 m): not',1e-9); near(A[0].speed/s0,1.10,'Swift Current: 10% faster',1e-9);
  near(F[0].slowMul,0.88,'Slack Water: enemies inside 12% slower',1e-9); assert.ok(F[2].slow>0,'Pressure Wave: the Choir reaches 0.9 m farther (F2, 8.8 m from its centre)');
  for(const x of L.U) x.hots=[]; low(A[0],0.5); nr(L).secA=0.999; near(healGot(A[0],()=>V.step(1)),0.009*1.10*A[0].maxHp,'Undercurrent: 0.3% x 3 a second (Undertone 10% more on it)',1e-6);
  low(A[0],0.5); const pl=plainHit(L,()=>healGot(A[0],()=>V.heal(A[0],1000))); low(A[0],0.5); near(healGot(A[0],()=>V.heal(A[0],1000)),pl*1.10,'Undertone: 2% x 5 more healing received in the Current',1e-9);
  secs(5); V.step(2); near(A[0].atkInterval,i0,'the Choir is over: so is the Current',1e-9);
});

test('Nerisse / the Choir: Choir of the Deep and Whole Deep at Once (its heals 3% x 5 stronger each), Choir of Warnings (everyone inside Heard, 1 s longer), Long Silence on it, Spent Echo, Ring the Bell, Sky Full of Stars and Choir Glow',()=>{
  const p=plain({},P=>{ low(P.v,0.3); P.v.hots=[]; choir(P); return healGot(P.v,()=>V.step(1)); }); assert.ok(p>0,'(the plain Choir heals her: the enemies inside are nearest her)');
  let L=nl(S(['wh_12_2','sb_12_2','wh_11_2','sb_11_4','wh_1_1'])), {v,A,F}=L; low(v,0.3); choir(L); const g=healGot(v,()=>V.step(1));
  near(g,p*1.30,'its heals 30% stronger',1e-6); assert.ok(mk(L,F[0],'nr_hd')&&mk(L,F[1],'nr_hd'),'Choir of Warnings: every enemy inside Heard'); assert.ok(!mk(L,F[2],'nr_hd'),'(not outside)');
  near(F[0].silencedT,1.05*1.10+1,'its silence on a Heard enemy: 1.05 s x Long Silence 1.1 + 1 s',0.04);
  L=nl(S(['wh_10_4','wh_4_4','sb_11_2','sb_1_3','sb_2_2'])); setStack(L,'ec',2); setStack(L,'tl',3); const c=choir(L); near(c.life,5+3*0.4+2*0.6,'Spent Echo 0.6 s an Echo, Ring the Bell 0.4 s a Toll',1e-9);
  assert.equal(stk(L,'tl'),0,'Ring the Bell spends every Toll'); assert.ok(mk(L,L.F[0],'nr_dw')&&mk(L,L.F[1],'nr_dw'),'and every enemy inside starts Drowned'); assert.ok(!mk(L,L.F[2],'nr_dw'),'(not outside)');
  L=nl(S(['ds_11_3','ds_12_3','ds_2_3'])); choir(L); V.step(1); assert.ok(ust(L,L.v,'ph')>=1,'Sky Full of Stars: each Choir heal leaves Phosphor'); assert.ok(mk(L,L.v,'nr_wk'),'and Wake'); near(ustLeft(L,L.v,'ph'),8+5,'Choir Glow: 1 s x 5 longer',0.05);
});

test('Nerisse / Every Light in the Trench (SIGNATURE): when the Choir ends, every ally full Phosphor, the Wake 6 s, full Pressure 6 s wherever they stand',()=>{
  const L=nl(S(['ds_13_3','ds_4_4','ds_2_3'])), {v,A}=L; const a1=A[1].armorRating; choir(L); secs(4.5); assert.equal(ust(L,A[1],'ph'),0,'not before it ends');
  secs(0.7); for(const x of [v,A[0],A[1]]){ assert.equal(ust(L,x,'ph'),4,'every hero full Phosphor'); assert.ok(mk(L,x,'nr_wk'),'in the Wake'); } V.step(1);
  near(A[1].armorRating/a1,1.10,'A1 (far from her): full Pressure, 5 x 2%',1e-9); secs(6); V.step(1); near(A[1].armorRating,a1,'for 6 s',1e-9);
  const M=nl(S(['ds_13_3'])); choir(M); V.step(2); M.v.stunned=1; V.step(2); assert.equal(ust(M,M.A[1],'ph'),4,'a Choir broken by a stun has ended too');
});

test('Nerisse / A Breath Before (SIGNATURE): 6 s after the Choir every enemy is Heard, its skills deal 50% less to her and 30% less to her allies (in place of the group), each skill begun an Echo and a Brace',()=>{
  const L=nl(S(['wh_13_2','wh_4_1'])), {v,A,F}=L; choir(L); secs(5.2); assert.ok(win(L,'nr_abb'),'the window opens as the Choir ends'); for(const f of F) assert.ok(mk(L,f,'nr_hd'),'every enemy Heard');
  v.hp=v.maxHp; near(ratioIn(L,F[2],v),0.50,'a skill on her: 50% less',1e-9); near(ratioIn(L,F[2],A[1]),0.70,'on an ally: 30% less',1e-9); near(ratioIn(L,F[2],A[1],{auto:true}),0.95,'(a basic attack: the usual group)',1e-9);
  press(F[2]); V.step(1); assert.equal(stk(L,'ec'),1,'an enemy begins a skill: an Echo'); assert.equal(stk(L,'br'),1,'and a Brace'); F[2]._pend=null; F[2].stunned=1e6;
  secs(6); near(ratioIn(L,F[2],A[1]),1,'after 6 s: over',1e-9);
});

test('Nerisse / When Her Side Breaks (SIGNATURE): an ally below 25% with 5 Tolls - a free Choir on that ally (once every 30 s), every enemy inside Drowned, its Current twice as strong',()=>{
  const L=nl(S(['sb_13_2','sb_4_1','sb_1_3'])), {v,A,F}=L; free(v); const i1=A[1].atkInterval; at(L,F[2],2,-13); setStack(L,'tl',4); low(A[1],0.2); secs(0.6); assert.equal(choirs().length,0,'4 Tolls: nothing');
  A[1].hp=A[1].maxHp; V.step(1); setStack(L,'tl',5); low(A[1],0.2); V.step(1); assert.equal(VMX('groundHazards').filter(h=>h.choir).length,0,'(it forms 0.4 s later)'); secs(0.5);
  const c=choirs()[0]; assert.ok(c,'a free Choir'); near(Math.hypot(c.x-A[1].x,c.y-A[1].y),0,'on the ally in danger',1e-6); near(v.energy,0,'(no energy spent: she had none)',1e-9);
  assert.ok(mk(L,F[2],'nr_dw'),'the enemy inside is Drowned'); V.step(2); near(i1/A[1].atkInterval,1+2*0.075,'its Current twice as strong',1e-6);
  A[1].hp=A[1].maxHp; V.step(1); low(A[1],0.2); V.step(1); secs(0.5); assert.equal(choirs().length,1,'once every 30 s');
});

test('Nerisse / Wake of Insight (her Pelagic Insight also on allies in the Wake) and Insight Shared (0.4 points x 5); Long Reach',()=>{
  const r0=plain({},P=>P.v.range); const L=nl(S(['ds_7_3','ds_9_3','ds_2_3','sb_1_4'])), {v,A,F}=L; pelagic(L); setMk(L,A[1],'nr_wk'); A[1].hp=A[1].maxHp;
  near(ratioIn(L,F[0],A[1]),(1-(0.08*PM+0.02))*0.95,'an ally in the Wake: her Pelagic Insight + 2 points, and In Its Wake',1e-9); near(ratioIn(L,F[0],A[0]),1,'(not one outside it)',1e-9);
  near(v.range/r0,1.09,'Long Reach: 3% x 3 more range',1e-9);
});

test('Nerisse / her two capped groups: on her at most 35% from her talents, on an ally at most 25%',()=>{
  const all=everything(H).filter(([id])=>!['ds_6_4','wh_6_4','sb_6_1','wh_13_2','wh_5_3'].includes(id));
  const L=nl(all), {v,A,F}=L; const f=F[0]; pelagic(L);
  for(const x of [v,A[0]]){ setMk(L,x,'nr_wk'); setUst(L,x,'ph',4); } setUst(L,A[1],'ph',4); setMk(L,f,'nr_hd'); setMk(L,f,'nr_hdc'); setMk(L,f,'nr_drbc'); setMk(L,f,'nr_dw'); setUst(L,f,'ac',3); f.silencedT=5;
  setStack(L,'ec',3); setStack(L,'br',7); setStack(L,'tl',8); nr(L).prF={[A[0].uid]:1e9,[v.uid]:1e9}; nr(L).orbL=[{done:false}]; f._castSlot='ult'; V.step(1);
  near(ratioIn(L,f,A[0],{kind:'magic'}),0.75,'an ally: every reduction at once, held at 25%',1e-9);
  near(ratioIn(L,f,v,{kind:'magic'}),0.65,'Nerisse: held at 35%',1e-9); f._castSlot=null;
});

/* ======================= WHOLE FIGHTS ======================= */
test('Nerisse: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['ds_1_2','ds_2_3','ds_4_4','wh_1_1','wh_2_2','wh_4_4','sb_1_3','sb_2_2','sb_4_1']), TEAM=['vael','sylthaine','vireo','vex','nerisse'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let ph=0,wk=0,hd=0,dw=0,cu=0,pr=0; const mx={};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); const o=T0.nr||{};
    for(const u of VMX('units')){ const m=u._talM&&u._talM[s.uid]; if(m){ if(m['#ph']&&m['#ph'].until>V.now()) ph++; if(m.nr_wk&&m.nr_wk.until>V.now()) wk++; if(m.nr_hd&&m.nr_hd.until>V.now()) hd++; if(m.nr_dw&&m.nr_dw.until>V.now()) dw++; }
      if(o.cur&&o.cur[u.uid]) cu++; if(o.pr&&o.pr[u.uid]&&o.pr[u.uid].n>0) pr++; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', unit-ticks with Phosphor '+ph+', Wake '+wk+', Heard '+hd+', Drowned '+dw+', in the Current '+cu+', with Pressure '+pr);
  assert.ok(ph>0&&wk>0&&hd>0&&(mx.br||0)>=1&&(mx.tl||0)>=1,'Phosphor, Wake, Heard, Brace and Toll in a real fight');
  determinism(H,TEAM);
});

/* The page sites her talents added (the orb's next hop and its flight time, the hop, where the Choir rises, its silence and its heal): with nothing learned, whole seeded
   fights with Nerisse in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters show the fights reached every site. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; if(!process.env.NERISSE_NOBASE) try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Nerisse: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['nerisse','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __neN={hop:0,arrive:0,choir:0,cTick:0,cHeal:0}; var __neO=orbNextHop, __neD=_doEffectCore, __neU=_updateBattleCore;'+
    'orbNextHop=function(h){ if(h&&h.owner&&h.owner.key==="nerisse"){ __neN.hop++; if(h.tgt) __neN.arrive++; } return __neO.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="nerisse"&&type==="deepchoir"&&(!o||!o.deliver||o._arrived)) __neN.choir++; return __neD.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ for(const h of groundHazards){ if(h&&h.choir&&h.owner&&h.owner.key==="nerisse"&&h.acc+dt>=h.interval){ for(const e of units){ if(e.alive&&e.team!==h.team&&Math.hypot(e.x-h.x,e.y-h.y)<=h.r){ __neN.cTick++; if(e.apow>0) __neN.cHeal++; } } } } return __neU.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__neN'); console.log('  identity / sites reached: '+JSON.stringify(c));
    assert.ok(c.hop>50&&c.arrive>30&&c.choir>5&&c.cTick>20&&c.cHeal>10,'the fights ran the orb\'s hops and arrivals, and Choirs that silenced and healed (every new site)'); }
  finally{ VMX('orbNextHop=__neO; _doEffectCore=__neD; _updateBattleCore=__neU;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ ds:['ds_1_1','ds_2_3','ds_8_2','ds_11_1','ds_12_2','ds_8_4','ds_7_4','ds_11_4','ds_1_2','ds_4_4','ds_5_4','ds_12_4','ds_7_3','ds_9_3'],
            wh:['wh_7_4','wh_6_2','wh_10_3','wh_2_2','wh_9_3','wh_1_1','wh_4_1','wh_9_1','wh_n1','wh_12_1','wh_8_3','wh_3_3','wh_4_4','wh_5_2','wh_13_2','wh_12_4'],
            sb:['sb_7_1','sb_3_1','sb_7_2','sb_9_2','sb_5_3','sb_2_1','sb_1_3','sb_2_3','sb_2_2'] };
const TI={ds:0,wh:1,sb:2}, RISK=['ds_6_4','wh_6_4','sb_6_1'];
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)&&!RISK.includes(t[0])).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)&&!RISK.includes(t[0]))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her reduction talents true at once (her orb in flight, in the Wake, full Phosphor on her team, 3 Echo, full Brace and Tolls, Pelagic
   Insight up at its level-100 share (17.5%), the attacker silenced, Drowned, Heard with its next skill under way and marked by The Deep Rings Back, 3 Abyssal Calm; full Pressure
   on her; the hit an enemy ultimate; with A Breath Before's window and without); sustained: Pelagic Insight up, 1 Phosphor, 1 Echo, 2 Brace, a basic attack. Measured through the
   engine (HP and shield it takes). */
function worstHit(list,kind,crit,sustained,autoHit,sig){ const L=nl(list,{allies:2,foes:3}), {v,F}=L; const f=F[0]; v.maxHp=1e5; v.hp=6e4; brnd(0.99); pelagic(L,VMX('skillMul')(100));
  if(L.T){ if(!sustained){ setMk(L,v,'nr_wk'); for(const x of L.U.filter(x=>x.team===v.team)) setUst(L,x,'ph',4); setStack(L,'ec',3); setStack(L,'br',7); setStack(L,'tl',8); f.silencedT=5;
      for(const m of ['nr_dw','nr_hd','nr_hdc','nr_drbc']) setMk(L,f,m); setUst(L,f,'ac',3); nr(L).prF={[v.uid]:1e9}; nr(L).orbL=[{done:false}]; if(!autoHit) f._castSlot='ult'; if(sig) L.T.s.w.nr_abb={t:6,n:1,cdT:0,at:-1,wave:false}; }
    else { setUst(L,v,'ph',1); setStack(L,'ec',1); setStack(L,'br',2); } }
  V.step(1); pelagic(L,VMX('skillMul')(100)); v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6;
  const raw=sustained?5e3:2e4, au=sustained?true:!!autoHit, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:au})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; brndBack(); f._castSlot=null;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Nerisse: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['ds','wh'],[61,30]],[['ds'],[91]],[['wh'],[91]],[['ds','sb'],[61,30]],[['wh','ds'],[61,30]],[['wh','sb'],[61,30]],[['sb','wh'],[61,30]],[['sb','ds'],[61,30]],[['wh','ds','sb'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const sig of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false,false,sig),worstHit(c.list,kind,crit,false,true,sig));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="nerisse"&&src&&src.team!==tgt.team; let h0=0; if(me) h0=tgt.hp+(tgt.shield||0); const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="nerisse"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    if(T&&e&&1-0.65*(1-(u.glyphDR||0))*Math.min(defMul(e,u,"phys"),defMul(e,u,"magic"))>=0.85) __dr.tHi++; } } return __ubc.apply(this,arguments); };');   /* even at her group's 35% cap, with her Pelagic Insight and glyphs */
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','nerisse'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; immune ticks '+d.imm+' of '+d.ticks+'; ticks that could be at 85% or more (her cap, Pelagic, glyphs and armor) '+d.tHi);
    assert.ok(d.n>30&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'at 85% or more for less than half of the fight: '+d.tHi+' of '+d.ticks+' ticks'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
