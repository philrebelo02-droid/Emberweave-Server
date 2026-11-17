'use strict';
/* Nox Quillfinger's talents as data on the mechanics layer (talents-mech/nox.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added (the Evasion miss, Forbidden Key's receiver, the Ultimate hold), and Phil's 95% ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one (lab() replaces the whole field).
   nl(): the lab with Nox, two allies and three foes, everyone held, every Energy at 0. His skills are cast as they land (V.cast); the lab's skill level is 10.
   Places (metres from Nox, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0); A0 (0,-5.5) A1 (0,-11).
   Run: node --test tests/talents-mech-nox.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='nox', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const brnd=x=>VMX('var __nbr=(typeof __nbr!=="undefined"&&__nbr)?__nbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __nbr!=="undefined"&&__nbr){ brnd=__nbr; __nbr=null; }');
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const stk=(L,name)=>{ const k=L.T.s.k[name]; return k?k.n:0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const setWin=(L,name,t)=>{ L.T.s.w[name]={t:t==null?99:t,n:1,cdT:0,at:-1,wave:false}; };
const mk=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o[name]; return !!m&&(m.until==null||m.until>V.now()); };
const left=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o[name]; return m&&m.until!=null?m.until-V.now():0; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:dur===null?null:V.now()+(dur||99),v:0}; };
const nx=L=>L.T.s.nx||(L.T.s.nx={});
const tru=o=>Object.assign({kind:'true'},o||{});
const hitOn=(L,src,t,amt,o)=>lost(t,()=>V.hit(src,t,amt||1000,tru(o)));
const ratioIn=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const ratioOut=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const healGot=(t,fn)=>{ const h=t.hp; fn(); return t.hp-h; };
const low=(x,f)=>{ x.hp=x.maxHp*f; };
const think=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };   // a unit that thinks (its casts run) but does nothing
const SL=10, SM=VMX('skillMul')(SL), LVS=VMX('lvStep')(SL), NERF=V.ccNerf;
const GIVE=keys=>25+0.1*LVS+6*keys;                                    // Forbidden Key's Energy at the lab's skill level
const lp=(L,t)=>V.cast(L.v,'green',t||L.F[0]), fk=L=>V.cast(L.v,'blue'), oed=L=>V.cast(L.v,'ult');
const ultPress=x=>{ think(x); x._pend={t:1,sm:1,lv:1,fire:()=>{}}; };   // an Ultimate pressed (castAbility's pending cast: no `spell`)
const missOn=(L,src)=>{ const v=L.v, e=v.evaStat; v.evaStat=1; try{ return lost(v,()=>V.hit(src||L.F[0],v,1000,{kind:'phys'})); } finally{ v.evaStat=e; } };   // the game's Evasion makes this hit miss him
function nl(list,o){ o=o||{}; const L=lab(H,list,{allies:o.allies==null?2:o.allies,foes:o.foes==null?3:o.foes,big:o.big,seed:o.seed});
  for(const x of L.U){ x.energy=0; } if(L.T){ const s=nx(L); s.ev={}; } return L; }
const plain=(o,fn)=>fn(nl(null,o));
const budget=L=>{ const o=nx(L); o.rgAt=V.now(); o.rgV=1e9; };        // his heal budget full (10 s of 1.2%: 12% of his max HP)

test('Nox: every talent is accounted for - 7 plain stats, 119 with rows, none waiting',()=>{
  accounting(H,[126,7,119,0,0]);
  for(const id of ['fe_1_3','fe_10_4','fe_4_1','jb_6_4','jb_n4','lf_10_4','lf_1_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['jb_1_3','lf_11_3']) assert.ok(!FXN.has(H,id)&&FXN.mech(H).talents[id],id+': crit chance, in the capped group (not a plain stat)');
  const M=FXN.mech(H); for(const id of ['fe_13_2','jb_13_2','lf_13_2','jb_n2','fe_1_1','jb_1_4','lf_1_1']) assert.ok(M.talents[id],id);
});

test('Nox: his real kit, as the talents read it - Lockpick Soul, Forbidden Key, Open Every Door, Skeleton Keys and Fortune',()=>{
  const L=nl(null), {v,A,F}=L; assert.ok(!v._tal,'no talents: no runtime'); assert.ok(v.pass&&v.pass.skeletonkey,'his passive');
  for(const f of F) f.level=1; F[1].energy=50; F[2].energy=20; v._keys=0;
  lp(L,F[1]); near(F[1].energy,50+7-30,'Lockpick Soul: the hooked enemy gains the 7 any hit gives, then loses 30',1e-9); near(v.energy,30,'he gains what it took',1e-9); assert.equal(v._keys,1,'a Skeleton Key');
  F[0].energy=60; F[1].energy=40; F[2].energy=20; v._keys=5; v.energy=0; lp(L,F[0]); assert.equal(v._keys,0,'5 keys: Master-Unlocked, all spent, no new one');
  for(const f of F){ assert.ok(f.silencedT>0,'it strikes three and silences them'); near(f.silencedT,3.0*NERF,'the table\'s single silence x0.7 (2.1 s)',1e-9); }
  for(const f of F){ f.silencedT=0; f.energy=0; } A[0].energy=10; A[1].energy=30; v._keys=2; fk(L); near(A[1].energy,30+GIVE(2),'Forbidden Key: the ally with the most Energy, 25 + 0.1 a level + 6 a key',1e-9); near(A[1].dmgBuffMul,1.25,'and x1.25',1e-9); assert.equal(A[0].energy,10,'(not the other)'); assert.equal(v._keys,3,'a key');
  v._keys=5; fk(L); near(A[1].energy,100,'Master-Unlocked: filled',1e-9); near(A[1].dmgBuffMul,1.5,'x1.5',1e-9);
  for(const x of A) x.energy=0; for(const f of F){ think(f); f.energy=50; f.ctrlRes=0; } v._keys=0; oed(L); for(const f of F){ near(f.stunned,1.6*NERF,'Open Every Door: every enemy locked 1.6 s x 0.7 (1.12 s)',1e-9); near(f.silencedT,1.6*NERF,'and silenced',1e-9); }
  for(const f of F) near(f.energy,50-35+7,'Open Every Door: 35 taken from each (then 7 back from its hit)',1e-9);
  near(A[0].energy,3*35*0.25,'every ally gains 25% of all it took',1e-9); assert.equal(v._keys,3,'3 keys');
  const P=nl(null), w=P.v; w._keys=5; const c0=w.critDmg||0.6, e0=w.evaStat||0; V.step(2); near(w.critDmg,c0+0.05*w.passMul,'at 5 keys the passive adds Fortune: crit damage +5% x its multiplier',1e-9); near(w.evaStat,e0+0.03*w.passMul,'and dodge +3% x it',1e-9);
  assert.equal(missOn(P),0,'the game\'s Evasion: the hit misses him');
});

/* ======================= THE FENCE ======================= */
test('Nox / A Friend on the Inside (the Accomplice: the ally with the highest attack or ability power, each wave; Forbidden Key always goes to it, +2 points x 5), Trusted Hand, Inside Job, Old Debts, Deft',()=>{
  const L=nl(S(['fe_1_1','fe_2_1','fe_6_1','fe_12_1','fe_12_3'])), {v,A,F}=L; A[1].dmg=A[0].dmg*3; L.T.s.fresh=true; for(const x of L.U) x.energy=0; V.step(1);
  assert.equal(nx(L).acc,A[1],'the ally with the highest attack is the Accomplice'); near(A[1].energy,15,'Old Debts: it starts the wave with 5 x 3 Energy',1e-9);
  A[0].energy=80; A[1].energy=0; fk(L); near(A[1].energy,GIVE(0),'Forbidden Key goes to the Accomplice, not to the ally with the most Energy',1e-9); assert.equal(A[0].energy,80);
  near(A[1].dmgBuffMul,1.25+0.10,'its buff 25% + 2 points x 5',1e-9);
  near(ratioIn(L,F[0],A[1]),0.94,'Trusted Hand: it takes 2% x 3 less',1e-9); near(ratioIn(L,F[0],A[0]),1,'(not the other ally)',1e-9);
  near(ratioOut(L,A[1],F[0]),1.06,'Inside Job: it deals 2% x 3 more',1e-9); near(ratioOut(L,A[0],F[0]),1,'',1e-9);
  const i0=v.atkInterval; V.step(1); near(i0/v.atkInterval,1,'(Deft already on)',1e-9); A[1].alive=false; V.step(2); near(v.atkInterval/i0,1.06,'Deft: his basic attacks 3% x 2 faster while it lives',1e-6); A[1].alive=true;
});

test('Nox / Partners (a key), Lookout (1% x 5 of his max HP, the regeneration budget), Sooner and Larger (each allied Ultimate this wave: 0.5% x 5 attack, up to 10), Old Partners (it gains 3% x 3 more Energy)',()=>{
  const L=nl(S(['fe_1_1','fe_2_1','fe_3_1','fe_7_1','fe_12_2','fe_8_1'])), {v,A,F}=L; A[1].dmg=A[0].dmg*3; L.T.s.fresh=true; V.step(1); assert.equal(nx(L).acc,A[1]);
  v._keys=1; low(v,0.5); nx(L).rgV=1; nx(L).rgAt=V.now(); secs(5); const h=v.hp, a0=v.dmg; ultPress(A[1]); V.step(1);
  assert.equal(v._keys,2,'Partners: its Ultimate gives him a Skeleton Key'); near(v.hp-h,0.05*v.maxHp,'Lookout: 5% of his max HP',0.02);
  V.step(1); near(v.dmg/a0,1.025,'Sooner and Larger: 0.5% x 5 attack for that Ultimate',1e-6);
  ultPress(A[0]); V.step(2); near(v.dmg/a0,1.05,'any allied Ultimate counts (not only the Accomplice\'s)',1e-6); assert.equal(v._keys,2,'(Partners: only the Accomplice\'s)');
  for(let i=0;i<12;i++){ A[0]._pend=null; V.step(1); ultPress(A[0]); V.step(1); } near(v.dmg/a0,1.25,'up to 10',1e-6);
  L.T.s.fresh=true; V.step(2); near(v.dmg/a0,1,'a new wave starts again',1e-6);
  A[1]._pend=null; think(A[1]); A[1].energy=10; V.step(1); const e=A[1].energy; A[1].energy+=20; V.step(1); near(A[1].energy,e+20*1.09,'Old Partners: what it gains, 9% more',1e-6);
});

test('Nox / Hot Goods: Still Warm (stolen Energy is Hot 3 s + Quick Turnaround 0.2 s x 5; Forbidden Key gives 5% x 3 more), Straight to Them (within 1 s: double), Hand-Off, Light Load, Fair Price',()=>{
  const L=nl(S(['fe_1_4','fe_3_4','fe_9_4','fe_5_4','fe_6_4','fe_8_3'])), {v,A,F}=L; F[0].energy=50; lp(L,F[0]);
  assert.ok(win(L,'hot'),'he stole: Hot'); near(L.T.s.w.hot.t,4,'for 3 s + 1 s',1e-9);
  A[1].energy=10; low(A[1],0.5); const h=A[1].hp; fk(L); near(A[1].energy,10+GIVE(1)*1.30,'within 1 s of the steal: 15% doubled',1e-6); near(A[1].hp-h,0.05*A[1].maxHp,'Hand-Off: it heals 1% x 5 of its max HP',1e-6);
  near(ratioIn(L,F[0],v),0.96,'Light Load: he takes 2% x 2 less while Hot',1e-9);
  const P=plainHit(L,()=>hitOn(L,v,F[1],1000,{crit:true})), q=hitOn(L,v,F[1],1000,{crit:true}); near(q/P,1.10,'Fair Price: his critical hits 2% x 5 more while Hot (at most 10%)',1e-9);
  secs(1.2); A[1].energy=10; fk(L); near(A[1].energy,10+GIVE(2)*1.15,'later: 15%',1e-6);
  secs(3); assert.ok(!win(L,'hot'),'no longer Hot'); A[1].energy=10; fk(L); near(A[1].energy,10+GIVE(3),'then nothing more',1e-6); near(ratioIn(L,F[0],v),1,'',1e-9);
});

test('Nox / Spread It Around (PICK ONE: two allies nearest their Ultimates, 20% more in all) and Fair Shares (3% x 3 less for 3 s); One Buyer (PICK ONE: 40% more) and Sole Buyer (2% x 5 attack speed for 4 s)',()=>{
  let L=nl(S(['fe_5_3','fe_6_3'])), {v,A,F}=L; A[0].energy=10; A[1].energy=20; fk(L);
  near(A[1].energy,20+GIVE(0)*0.6,'the ally with the most Energy: 60%',1e-6); near(A[0].energy,10+GIVE(0)*0.6,'and the next one: 60%',1e-6);
  near(ratioIn(L,F[0],A[0]),0.91,'Fair Shares: each one it reached takes 3% x 3 less',1e-9); near(ratioIn(L,F[0],A[1]),0.91,'',1e-9); secs(3.05); near(ratioIn(L,F[0],A[0]),1,'for 3 s',1e-9);
  L=nl(S(['fe_5_2','fe_6_2'])); L.A[1].energy=10; fk(L); near(L.A[1].energy,10+GIVE(0)*1.4,'One Buyer: 40% more, to one ally',1e-6); assert.equal(L.A[0].energy,0,'(only one)');
  const i0=L.A[1].atkInterval; V.step(2); near(i0/L.A[1].atkInterval,1.10,'Sole Buyer: it attacks 2% x 5 faster',1e-6); secs(4.1); near(L.A[1].atkInterval,i0,'for 4 s',1e-6);
});

test('Nox / Fast Fence (+1 x 5 Energy), Generous (points), Fence\'s Cut (he keeps 1 x 5), Courier (each Forbidden Key 1% x 5 less for the wave, up to 5), Forbidden Edge and Quick Key',()=>{
  const L=nl(S(['fe_2_2','fe_4_2','fe_10_2','fe_8_2','fe_7_3','lf_8_2'])), {v,A,F}=L; v._keys=0; A[1].energy=10; fk(L);
  near(A[1].energy,10+GIVE(0)+5,'Fast Fence: 5 more',1e-6); near(A[1].dmgBuffMul,1.25+0.06,'Generous: 2 points x 3',1e-9); near(v.energy,5,'Fence\'s Cut: he keeps 5',1e-9);
  near(ratioIn(L,F[0],v),0.95,'Courier: one cast, 5% less',1e-9); for(let i=0;i<6;i++) fk(L); near(ratioIn(L,F[0],v),0.75,'up to 5 casts (25%)',1e-9);
  L.T.s.fresh=true; V.step(1); near(ratioIn(L,F[0],v),1,'for the rest of the wave',1e-9);
  near(VMX('TalentFx').cd(v,'blue',9),9-0.5-0.5,'Forbidden Edge and Quick Key: 0.1 s x 5 each',1e-9);
});

test('Nox / Lookout\'s Eye (the first hit each enemy lands on him in a wave: 3% x 5 less), Never Trusted (enemies he stole from: 2% x 5 less), Clever Hands (2% x 5 crit chance, in the 5% group)',()=>{
  const L=nl(S(['fe_n1','fe_11_1','fe_11_3'])), {v,F}=L; const h=v.hp;
  near(hitOn(L,F[0],v,1000),850,'the first hit from F0: 15% less',1e-6); v.hp=h; near(hitOn(L,F[0],v,1000),1000,'its second: full',1e-6); v.hp=h; near(hitOn(L,F[1],v,1000),850,'another enemy\'s first',1e-6); v.hp=h;
  L.T.s.fresh=true; V.step(1); near(hitOn(L,F[0],v,1000),850,'a new wave: again',1e-6); v.hp=h;
  F[2].energy=40; lp(L,F[2]); assert.ok(mk(L,F[2],'rb'),'he stole from it'); hitOn(L,F[2],v,1000); v.hp=h; near(hitOn(L,F[2],v,1000),900,'Never Trusted: 10% less from it',1e-6); v.hp=h;
  brnd(0.049); assert.ok(lost(F[2],()=>V.hit(v,F[2],1000,{kind:'true'}))>1000,'Clever Hands: a seeded 5% (10% asked, held at 5%) to crit it'); brnd(0.051); near(lost(F[2],()=>V.hit(v,F[2],1000,{kind:'true'})),1000,'(0.051 does not)',1e-6);
  brnd(0); near(lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})),1000,'not an enemy he has not stolen from',1e-6);
});

test('Nox / Covering Hand (was Partners in Crime: the Accomplice below 30% HP - Forbidden Key at once on it, once a wave), Moment of Glory (Open Every Door\'s share in full to it)',()=>{
  const L=nl(S(['fe_1_1','fe_8_1','fe_9_1','fe_11_2'])), {v,A,F}=L; A[1].dmg=A[0].dmg*3; L.T.s.fresh=true; V.step(1); for(const x of L.U) x.energy=0;
  low(A[1],0.32); V.step(2); near(A[1].energy,0,'(not at 32% HP)',1e-9); A[1].hp=A[1].maxHp; V.step(1);
  low(A[1],0.25); V.step(1); near(A[1].energy,GIVE(0),'Forbidden Key fired on it at once',1e-6); near(A[1].dmgBuffMul,1.35,'its buff (and A Friend on the Inside\'s 10 points)',1e-9); V.step(1); near(A[1].energy,GIVE(0)*1.09,'(Old Partners: 9% more of it, the next tick)',1e-6);
  A[1].hp=A[1].maxHp; V.step(1); A[1].energy=0; low(A[1],0.2); V.step(1); assert.equal(A[1].energy,0,'once a wave');
  for(const x of L.U) x.energy=0; for(const f of F) f.energy=40; oed(L); near(A[0].energy,0,'Moment of Glory: the other ally gets nothing',1e-9); near(A[1].energy,2*3*35*0.25,'the Accomplice gets both shares',1e-6);
});

test('Nox / Everyone\'s Great Moment (SIGNATURE): the Accomplice\'s Ultimate is Master-Unlocked as by Forbidden Key (x1.5 + points, controls end, 60% control resist), every other ally 20 Energy; once every 20 s',()=>{
  const L=nl(S(['fe_1_1','fe_13_2'])), {v,A,F}=L; A[1].dmg=A[0].dmg*3; L.T.s.fresh=true; V.step(1); for(const x of L.U) x.energy=0;
  ultPress(A[1]); V.step(1); near(A[1].dmgBuffMul,1.5+0.10,'x1.5 + A Friend on the Inside\'s 10 points',1e-9); near(A[1].dmgBuffT,6,'for 6 s',0.1); assert.ok(A[1].ctrlRes>=0.59,'60% control resist');
  near(A[0].energy,20,'every other ally: 20 Energy',1e-9); assert.equal(v.energy,0,'(not Nox)');
  A[1]._pend=null; A[1].dmgBuffMul=1; A[1].dmgBuffT=0; secs(10); ultPress(A[1]); V.step(1); assert.ok(!(A[1].dmgBuffMul>1),'not within 20 s');
  A[1]._pend=null; secs(7); ultPress(A[1]); V.step(1); assert.ok(!(A[1].dmgBuffMul>1),'not at 17 s either');
  A[1]._pend=null; secs(3.3); ultPress(A[1]); V.step(1); near(A[1].dmgBuffMul,1.6,'after 20 s: again',1e-9);
});

/* ======================= JUST BEFORE THEY USE IT ======================= */
test('Nox / Lockpick Soul: Fresh Haul (+1 x 3), Empty Them (PICK ONE: 40% more; no key off an enemy that is not Ripe), Breath Before the Swing (+2 x 3 from a Ripe one), Prime Pickings (5% x 3 more for him), Easy Mark, Pick and Pocket',()=>{
  let L=nl(S(['fe_7_4','jb_5_2','jb_2_1','fe_12_4','fe_9_2','jb_10_2'])), {v,A,F}=L; v._keys=0; F[0].energy=93; lp(L,F[0]);
  const take=(30+3)*1.4; near(F[0].energy,100-take-6,'Ripe: (30 + 3) x 1.4 taken, then Breath Before the Swing 6 more',1e-6); near(v.energy,Math.min(100,take+6+take*0.15),'he gains it all + Prime Pickings 15% of the skill\'s take',1e-6);
  assert.equal(v._keys,1,'a key (it was Ripe)'); F[1].energy=10; v.energy=0; lp(L,F[1]); assert.equal(v._keys,1,'Empty Them: no key off an enemy that was not Ripe');
  near(ratioOut(L,A[0],F[1]),1.09,'Easy Mark: its target takes 3% x 3 more from his team for 3 s',1e-9); near(ratioOut(L,v,F[1],{kind:'magic'}),1.09,'(his own hits too)',1e-9); secs(3.05); near(ratioOut(L,A[0],F[1]),1,'',1e-9);
  low(v,0.5); budget(L); const h=v.hp; F[1].energy=10; lp(L,F[1]); near(v.hp-h,0.05*v.maxHp,'Pick and Pocket: 1% x 5 of his max HP',1e-6);
  L=nl(S(['jb_5_3','jb_6_3'])); L.F[0].energy=60; lp(L,L.F[0]); near(L.F[0].energy,67-24,'Leave a Little: 20% less taken',1e-9); near(left(L,L.F[0],'ll'),4+3,'the robbed enemy gains Energy 25% slower for 4 s + Slow Refill 1 x 3',1e-6);
  V.step(1); const e=L.F[0].energy; L.F[0].energy+=20; V.step(1); near(L.F[0].energy,e+15,'25% slower',1e-6); secs(7.1); const e2=L.F[0].energy; L.F[0].energy+=20; V.step(1); near(L.F[0].energy,e2+20,'and then not',1e-6);
});

test('Nox / Bare Shelves (Empty Them leaves it below 20: 2% x 5 less from it for 3 s), Nerve Gone and Cheap Coat (Ripe enemies), Spoiled (Ripe enemies 4% x 3 less healing)',()=>{
  const L=nl(S(['jb_5_2','jb_6_2','jb_7_1','jb_4_1','jb_12_4'])), {v,A,F}=L; F[0].energy=30; lp(L,F[0]); assert.ok(F[0].energy<20&&mk(L,F[0],'bs'),'left below 20: Bare Shelves');
  F[2].energy=57; lp(L,F[2]); near(F[2].energy,22,'(64 - 42)',1e-9); assert.ok(!mk(L,F[2],'bs'),'left at 22: no Bare Shelves');
  near(ratioIn(L,F[0],A[0]),0.90,'it deals 10% less to his team',1e-9); near(ratioIn(L,F[0],v),0.90,'(and to him)',1e-9); secs(3.05); near(ratioIn(L,F[0],A[0]),1,'for 3 s',1e-9);
  F[1].energy=80; near(ratioIn(L,F[1],A[0]),0.95,'Nerve Gone: a Ripe enemy deals 1% x 5 less to his team',1e-9); near(ratioIn(L,F[1],v),0.95*0.925,'and Cheap Coat on him: 1.5% x 5',1e-9);
  F[1].energy=60; near(ratioIn(L,F[1],v),1,'not Ripe',1e-9);
  F[1].energy=80; low(F[1],0.5); const pl=plainHit(L,()=>healGot(F[1],()=>V.heal(F[1],1000))); low(F[1],0.5); near(healGot(F[1],()=>V.heal(F[1],1000)),pl*0.88,'Spoiled: a Ripe enemy receives 12% less healing',1e-9);
});

test('Nox / Ripe: Saving It Up (2% x 5), Just Before (critical hits on it 3% x 3 more), Waited Long Enough (at 100: 2% x 5), Turning the Key and Last Lock (below 40% HP), Ripe Fruit (1% x 5 attack each, up to 4), Casing the Job',()=>{
  const L=nl(S(['jb_1_1','jb_6_1','jb_11_1','jb_9_3','lf_9_3','jb_10_1','jb_n1']),{foes:5}), {v,F}=L;
  F[0].energy=75; near(ratioOut(L,v,F[0]),1.10,'Saving It Up: 10% more on a Ripe enemy',1e-9); F[0].energy=69; near(ratioOut(L,v,F[0]),1,'(69: not Ripe)',1e-9);
  F[0].energy=75; near(ratioOut(L,v,F[0],{crit:true}),1.10*1.09,'Just Before: its critical hits 9% more',1e-9);
  F[0].energy=100; near(ratioOut(L,v,F[0]),1.10*1.10,'Waited Long Enough: at full Energy 10% more',1e-9);
  F[0].energy=0; low(F[0],0.42); near(ratioOut(L,v,F[0]),1,'(42% HP: not yet)',1e-9); low(F[0],0.39); near(ratioOut(L,v,F[0]),1.10*1.10,'below 40% HP: 10% + 10%',1e-9); F[0].hp=F[0].maxHp;
  const a0=v.dmg; for(let i=0;i<5;i++) F[i].energy=80; v.energy=0; V.step(2); near(v.dmg/a0,1.20,'Ripe Fruit: 5% a Ripe enemy, up to 4',1e-6);
  near(v.energy,5*6,'Casing the Job: 6 Energy the first time each one is Ripe this wave',1e-9); for(const f of F) f.energy=0; V.step(1); for(const f of F) f.energy=80; V.step(1); near(v.energy,30,'once a wave each',1e-9);
  for(const f of F) f.energy=0; V.step(2); near(v.dmg/a0,1,'',1e-6);
});

test('Nox / Tumblers: Feeling the Pins (each basic attack on the same enemy sets one; at 5 it clicks: 4 x 3 Energy lost; a switch drops them), Light Touch, Clicked, Tumbler Song, Practised Ear, Patient Ear',()=>{
  const L=nl(S(['jb_1_4','jb_3_4','jb_5_4','jb_10_4','jb_7_4','jb_12_3'])), {v,F}=L; const au=(t)=>V.hit(v,t,10,tru({auto:true}));
  F[0].energy=50; const m0=F[0].mrRating; for(let i=0;i<4;i++) au(F[0]); assert.equal(nx(L).tb.n,4,'4 Tumblers'); const i0=v.atkInterval; V.step(1); near(i0/v.atkInterval,1.12,'Practised Ear: 1% x 3 attack speed each',1e-6);
  near(F[0].mrRating/m0,0.96,'Patient Ear: that enemy 0.5% x 2 less magic resist each',1e-9); near(F[1].mrRating,F[0].mrRating/0.96,'(not another enemy)',1e-6);
  const e=F[0].energy, h=F[0].hp; au(F[0]); near(F[0].energy,e+7-12,'the fifth: the lock clicks (12 Energy lost)',1e-9); assert.equal(nx(L).tb.n,0,'and they reset');
  const want=0.5*v.dmg*VMX('rageMul')*VMX('(s,t)=>defMul(s,t,"magic")')(v,F[0]); near(h-F[0].hp-10,want,'Clicked: 10% x 5 of his attack (magic)',1e-6);
  near(ratioOut(L,v,F[1]),1.025,'Tumbler Song: 0.5% x 5 damage for each click this wave',1e-9);
  for(let i=0;i<3;i++) au(F[0]); au(F[1]); assert.equal(nx(L).tb.n,1,'a switch: the new enemy starts at 1'); au(F[0]); assert.equal(nx(L).tb.n,4,'Light Touch: back within 2 s, the old 3 are still set');
  for(let i=0;i<3;i++) au(F[1]); assert.equal(nx(L).tb.n,4,'(F1 kept its 1 too)'); secs(2.1); au(F[0]); assert.equal(nx(L).tb.n,1,'after 0.4 s x 5 they fall');
  L.T.s.fresh=true; V.step(1); near(ratioOut(L,v,F[1]),1,'Tumbler Song: per wave',1e-9);
});

test('Nox / Gap in the Guard (crits on 3+ Tumblers 2% x 5 more), Sharp Ears (1.5% x 5 crit chance on that enemy, in the 5% group), Spring the Lock (LINK), Click and Click',()=>{
  let L=nl(S(['jb_1_4','jb_8_3','jb_11_3'])), {v,F}=L; const au=(t)=>V.hit(v,t,10,tru({auto:true}));
  for(let i=0;i<2;i++) au(F[0]); near(ratioOut(L,v,F[0],{crit:true}),1,'Gap in the Guard: not at 2',1e-9); au(F[0]); near(ratioOut(L,v,F[0],{crit:true}),1.10,'Gap in the Guard: 10% on a crit',1e-9); near(ratioOut(L,v,F[1],{crit:true}),1,'(not another enemy)',1e-9);
  brnd(0.001); near(lost(F[1],()=>V.hit(v,F[1],1000,tru())),1000,'Sharp Ears: not on an enemy without Tumblers',1e-6); brnd(0.049); assert.ok(lost(F[0],()=>V.hit(v,F[0],1000,tru()))>1000,'Sharp Ears: 7.5% asked, held at 5%'); brnd(0.051); near(lost(F[0],()=>V.hit(v,F[0],1000,tru())),1000,'',1e-6); brndBack();
  L=nl(S(['jb_1_4','jb_n2','lf_1_4','jb_9_4'])); const w=L.v, G=L.F; const au2=(t)=>V.hit(w,t,10,tru({auto:true})); w._keys=1; G[0].energy=80;
  for(let i=0;i<5;i++) au2(G[0]); near(G[0].energy,100-12-2,'Spring the Lock: the first click on a Ripe enemy each wave, 2 more',1e-9); assert.equal(w._keys,2,'with Odd Key Out: a Spare Key'); assert.ok(nx(L).spare);
  G[0].energy=80; for(let i=0;i<5;i++) au2(G[0]); near(G[0].energy,100-12,'only the first each wave',1e-9); assert.equal(w._keys,2,'(he holds only one)');
  L.T.s.fresh=true; V.step(1); G[0].energy=80; for(let i=0;i<5;i++) au2(G[0]); near(G[0].energy,100-14,'a new wave: again 2 more',1e-9); assert.equal(w._keys,2,'but no second Spare Key while he holds one');
  w._keys=0; lp(L,G[1]); assert.equal(w._keys,2,'Click and Click: the next Lockpick Soul gives 2 keys'); lp(L,G[1]); assert.equal(w._keys,3,'then 1 again');
});

test('Nox / Second Breath (1 x 3 from a Ripe enemy each basic attack), Stolen Moment (dropped below 70: no Energy for 2 s), Nothing Left (0.5% x 5 attack each, this wave), Spare Breath and Pocket Change, Lucky Break',()=>{
  const L=nl(S(['jb_8_1','jb_9_1','jb_12_2','jb_4_3','fe_4_3','lf_4_3'])), {v,F}=L; const au=(t,c)=>V.hit(v,t,10,tru({auto:true,crit:!!c}));
  F[0].energy=80; au(F[0]); near(F[0].energy,80+7-3,'Second Breath: 3 Energy taken',1e-9); near(v.energy,3+11*0.18,'he gains them, and 9% + 9% of a swing\'s 11',1e-9);
  v.energy=0; au(F[0],true); near(v.energy,3+11*0.18+11*0.09,'Lucky Break: a critical one 9% more',1e-9);
  v.energy=0; V.hit(v,F[2],10,tru()); near(v.energy,0,'(not a hit that is not a basic attack)',1e-9);
  F[1].energy=72; v.energy=0; lp(L,F[1]); assert.ok(F[1].energy<70&&mk(L,F[1],'smo'),'dropped below 70: Stolen Moment'); const a0=v.dmg; V.step(1); near(v.dmg/a0,1.025,'Nothing Left: 0.5% x 5 attack',1e-6);
  const e=F[1].energy; F[1].energy+=20; V.step(1); near(F[1].energy,e,'it gains no Energy',1e-9); secs(2.05); F[1].energy+=20; V.step(1); near(F[1].energy,e+20,'for 2 s',1e-9);
});

test('Nox / Lockpick Soul: Hooked Soul, Sharper Pick and Bright Hook (3% x 5 each), Quick Pick, Deep Pocket (Master-Unlocked silence 0.2 s x 3 longer, in full), Just in Time (no Ultimate until the hook lands)',()=>{
  const p=plain({},P=>{ const h=P.F[0].hp; lp(P,P.F[0]); return h-P.F[0].hp; });
  let L=nl(S(['jb_2_2','fe_3_3','lf_3_3','jb_8_2','jb_4_2','jb_3_1'])), {v,F}=L; let h=F[0].hp; lp(L,F[0]); near(h-F[0].hp,p*1.15*1.15*1.15,'three times 15%',1e-6);
  near(VMX('TalentFx').cd(v,'green',7),6.5,'Quick Pick: 0.1 s x 5 sooner',1e-9);
  for(const f of F){ f.level=1; f.silencedT=0; } v._keys=5; lp(L,F[0]); for(const f of F) near(f.silencedT,2.1+0.6,'Deep Pocket: 2.1 s + 0.6 s',1e-9);
  for(const f of F) f.silencedT=0; v._keys=0; lp(L,F[0]); assert.equal(F[0].silencedT,0,'(not when it is not Master-Unlocked)');
  think(F[1]); F[1].energy=100; VMX('TalentFx').skillTgt(v,'energysteal',F[1],{}); V.step(1); assert.ok(!F[1]._pend,'Just in Time: the hooked enemy holds its Ultimate while the hook flies');
  lp(L,F[1]); F[1].energy=100; V.step(1); assert.ok(F[1]._pend&&!F[1]._pend.spell,'once it lands, it may');
});

test('Nox / Open Every Door: Long Lock (0.05 s x 5), Double Lock (Ripe: 0.2 s x 3), in full; Every Door and Wide Open (3% x 5 each); Locked Out (no Energy for 3 s)',()=>{
  const p=plain({},P=>{ for(const f of P.F){ f.level=1; f.ctrlRes=0; } const h=P.F[0].hp; oed(P); return h-P.F[0].hp; });
  const L=nl(S(['jb_3_3','jb_9_2','jb_7_3','lf_7_3','jb_11_2'])), {v,F}=L; for(const f of F){ think(f); f.ctrlRes=0; } F[0].energy=80;
  oed(L); near(F[0].stunned,1.12+0.25+0.6,'a Ripe enemy: the lock 1.12 s + 0.25 + 0.6',1e-9); near(F[0].silencedT,1.97,'its silence too',1e-9); near(F[1].stunned,1.12+0.25,'not Ripe: + 0.25',1e-9);
  const e=F[1].energy; F[1].energy+=30; V.step(1); near(F[1].energy,e,'Locked Out: no Energy',1e-9); secs(3.05); F[1].energy+=30; V.step(1); near(F[1].energy,e+30,'for 3 s',1e-9);
  const Q=nl(S(['jb_7_3','lf_7_3'])); for(const f of Q.F){ f.level=1; f.ctrlRes=0; } const g=Q.F[0].hp; oed(Q); near(g-Q.F[0].hp,p*1.15*1.15,'Every Door and Wide Open: 15% each',1e-6);
});

test('Nox / Before They Use It (10 x 3 Energy at each wave\'s start), Long Quill (3% x 5 reach), Quiet Steps, Tallow Row Feet, Quick Feet (3% x 3 each), Silver Tongue, Good Fortune, Not Today (at most 20%)',()=>{
  const r0=plain({},P=>P.v.range), s0=plain({},P=>P.v.speed);
  const L=nl(S(['jb_12_1','jb_n3','jb_2_3','fe_2_3','lf_2_3','fe_9_3','lf_10_1','lf_5_1'])), {v,F}=L; v.energy=0; L.T.s.fresh=true; V.step(1); near(v.energy,30,'Before They Use It: 30 at the wave\'s start',1e-9);
  V.step(1); near(v.range/r0,1.15,'Long Quill: 15% farther',1e-9); near(v.speed/s0,1.27,'three move talents: 9% each, added',1e-6);
  const D=VMX('(s,t,k)=>defMul(s,t,k)'); F[0].mrRating=200; const d1=D(v,F[0],'magic'); F[0].mrRating=180; const d2=D(v,F[0],'magic'); F[0].mrRating=200;
  near(ratioOut(L,v,F[0],{kind:'magic'}),d2/d1,'Silver Tongue: his hits ignore 2% x 5 of magic resist',1e-9);
  F[0].mrRating=0; near(ratioOut(L,v,F[0],{auto:true}),1.10,'Good Fortune: basic attacks 2% x 5 more',1e-9);
  v.stunned=0; v.level=1; F[0].level=100; VMX('(a,b)=>ccApply(a,b,"stunned",2)')(F[0],v); near(v.stunned,2*NERF*0.8,'Not Today: 4% x 5 shorter, up to 20%',1e-9);
});

test('Nox / Taken Just Before (SIGNATURE): an enemy\'s Ultimate press - Lockpick Soul at once at it (never Master-Unlocked), the Ultimate held 2 s, its hits 30% weaker, his team shares 30 Energy; once every 20 s',()=>{
  const L=nl(S(['jb_13_2'])), {v,A,F}=L; v._keys=5; for(const x of L.U) x.energy=0; const h=F[1].hp; ultPress(F[1]); const p=F[1]._pend; V.step(1);
  assert.ok(F[1]._pend===p,'still pending'); near(p.t,1+2-V.STEP,'held 2 s',1e-6); assert.ok(F[1].hp<h,'Lockpick Soul struck it at once'); assert.ok(!(F[1].silencedT>0),'never Master-Unlocked: no silence (it would cancel the Ultimate)');
  assert.equal(v._keys,5,'his 5 keys wait'); for(const x of [A[0],A[1]]) near(x.energy,10,'30 Energy shared by his team (10 each)',1e-9); near(v.energy,10+7,'(Nox: his 10, and the 7 his hook took)',1e-9);
  near(ratioIn(L,F[1],A[0]),0.70,'its hits on his team 30% weaker',1e-9); near(ratioIn(L,F[1],v),0.70,'(on him too)',1e-9); near(ratioIn(L,F[1],A[0],{auto:true}),1,'not its basic attacks',1e-9);
  F[1]._pend=null; V.step(1); near(left(L,F[1],'tjb'),1.5,'1.5 s more after it comes out',0.05); secs(1.6); near(ratioIn(L,F[1],A[0]),1,'then not',1e-9);
  ultPress(F[2]); const q=F[2]._pend; V.step(1); near(q.t,1-V.STEP,'not within 20 s',1e-6);
});

/* ======================= LUCK FOLLOWS HIM ======================= */
test('Nox / Whiskers: By a Whisker (each Fortune dodge 1, max 3; his next magic hit spends them, 3% x 5 each), Long Whiskers (6 s + 1 x 3), Close Shave, Fox Coat, Fox\'s Luck',()=>{
  const L=nl(S(['lf_1_1','lf_8_1','lf_2_1','lf_4_1','lf_7_1'])), {v,F}=L; const s0=v.speed;
  missOn(L); assert.equal(stk(L,'wk'),1,'a Fortune dodge: a Whisker'); V.step(2); near(v.speed/s0,1.06,'Close Shave: 2% x 3 speed for it',1e-6); secs(2.1); near(v.speed/s0,1,'for 2 s',1e-6);
  missOn(L); missOn(L); missOn(L); missOn(L); assert.equal(stk(L,'wk'),3,'at most 3');
  near(ratioIn(L,F[0],v),0.925,'Fox Coat: 1.5% x 5 less while he holds one',1e-9);
  low(v,0.5); budget(L); const h=v.hp; V.hit(v,F[0],1000,{kind:'magic'}); const got=v.hp-h;
  assert.equal(stk(L,'wk'),0,'spent'); near(got,3*0.025*v.maxHp,'Fox\'s Luck: 0.5% x 5 of his max HP each',1e-6);
  near(ratioOut(L,v,F[1],{kind:'magic'}),1,'(nothing left for the next hit)',1e-9);
  missOn(L); missOn(L); const P=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'magic'}))); const Q=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'magic'})); near(Q/P,1.30,'2 Whiskers: 15% each',1e-9);
  missOn(L); secs(8.9); assert.equal(stk(L,'wk'),1,'still there at 8.9 s'); secs(0.2); assert.equal(stk(L,'wk'),0,'gone after 6 + 3 s');
});

test('Nox / Missed Again (at 3 Whiskers his next magic hit is a guaranteed critical), Glint (2% x 2 crit chance for 3 s after a dodge), Narrow Escape, Twice Lucky (0.5% x 5 dodge each spent, 3 s), Luck Holds (20 s in: 2 Whiskers, 2% x 5 damage)',()=>{
  const L=nl(S(['lf_1_1','lf_2_1','lf_3_1','lf_6_4','lf_12_3','lf_11_1','lf_n1'])), {v,F}=L; brnd(0.99);
  low(v,0.5); budget(L); const h=v.hp; missOn(L); near(v.hp-h,0.02*v.maxHp,'Narrow Escape: 1% x 2 of his max HP',1e-6); assert.ok(win(L,'gl'),'Glint');
  brnd(0.039); assert.ok(lost(F[1],()=>V.hit(v,F[1],1000,tru()))>1000,'Glint: 4% crit chance'); brnd(0.99); secs(3.05); assert.ok(!win(L,'gl'),'for 3 s');
  missOn(L); assert.equal(stk(L,'wk'),2); { const P2=plainHit(L,()=>lost(F[2],()=>V.hit(v,F[2],1000,{kind:'magic'}))), Q2=lost(F[2],()=>V.hit(v,F[2],1000,{kind:'magic'})); near(Q2/P2,1.30,'2 Whiskers: no critical yet',1e-6); }
  missOn(L); missOn(L); missOn(L); assert.equal(stk(L,'wk'),3); secs(3.05); const e0=v.evaStat; const P=plainHit(L,()=>lost(F[2],()=>V.hit(v,F[2],1000,{kind:'magic'}))); const Q=lost(F[2],()=>V.hit(v,F[2],1000,{kind:'magic'}));
  near(Q/P,(1+(v.critDmg||0.6))*1.45,'Missed Again: a critical (and 3 Whiskers x 15%)',1e-6);
  V.step(1); near(v.evaStat-e0,0.075,'Twice Lucky: 0.5% x 5 dodge each Whisker spent',1e-9); secs(3.05); near(v.evaStat,e0,'for 3 s',1e-9);
  nx(L).w0=V.now()-16; missOn(L); assert.equal(stk(L,'wk'),1,'(16 s in: 1)'); setStack(L,'wk',0); nx(L).w0=V.now()-20.1; missOn(L); assert.equal(stk(L,'wk'),2,'Luck Holds: from 20 s into the wave a dodge gives 2'); near(ratioOut(L,v,F[0],{kind:'true'}),1.10,'and 10% more damage',1e-9);
});

test('Nox / Charmed Life (once a wave the first hit that would drop him below 20% misses, as a Fortune dodge, and gives 3 Whiskers), Not Today\'s twin Hair\'s Breadth (crits on him 3% x 3 less)',()=>{
  const L=nl(S(['lf_1_1','lf_8_1','lf_9_1','lf_6_1'])), {v,F}=L; v.hp=0.30*v.maxHp; assert.ok(hitOn(L,F[0],v,0.07*v.maxHp)>0,'(a hit that leaves him at 23% lands)'); v.hp=0.25*v.maxHp; const a=0.1*v.maxHp;
  assert.equal(hitOn(L,F[0],v,a),0,'it would drop him below 20%: it misses'); assert.equal(stk(L,'wk'),3,'3 Whiskers'); assert.ok(hitOn(L,F[0],v,a)>0,'once a wave');
  L.T.s.fresh=true; V.step(1); v.hp=0.25*v.maxHp; assert.equal(hitOn(L,F[0],v,a),0,'a new wave: again'); v.hp=0.9*v.maxHp; assert.ok(hitOn(L,F[0],v,a)>0,'(not when it would leave him above 20%)');
  v.hp=v.maxHp; near(ratioIn(L,F[0],v,{crit:true}),0.91,'Hair\'s Breadth: a critical hit on him 9% less',1e-9); near(ratioIn(L,F[0],v),1,'',1e-9);
});

test('Nox / the Spare Key: Odd Key Out (after a Master-Unlock one key stays; 3% x 3 crit damage while he holds it), Doubled Spare (twice), Worn Key (1% x 5 dodge), Spare Change (5 x 3 Energy when it is used)',()=>{
  let L=nl(S(['lf_1_4','lf_3_4','lf_7_4','lf_9_4'])), {v,F}=L; v._keys=5; F[0].energy=40; lp(L,F[0]); assert.equal(v._keys,2,'Doubled Spare: the Spare Key counts twice'); assert.ok(nx(L).spare,'he holds it');
  near(ratioOut(L,v,F[1],{crit:true}),1.09,'Odd Key Out: crit damage 9%',1e-9); const e0=v.evaStat; V.step(1); near(v.evaStat-e0,0.05,'Worn Key: 5% dodge',1e-9);
  v._keys=5; v.energy=0; for(const f of F) f.energy=0; lp(L,F[0]); near(v.energy,15+3*7,'Spare Change: a Master-Unlock that used it gives 15 (and the hook took the 7 each of the three gained)',1e-9); assert.equal(v._keys,2,'and a new one stays');
  L=nl(S(['lf_1_4'])); L.v._keys=5; lp(L,L.F[0]); assert.equal(L.v._keys,1,'Odd Key Out alone: one key');
  L=nl(S(['lf_7_4'])); L.v._keys=5; lp(L,L.F[0]); assert.equal(L.v._keys,0,'(without Odd Key Out, no Spare Key)'); assert.ok(!nx(L).spare);
});

test('Nox / Beginner\'s Luck (PICK ONE: 2 keys at each wave\'s start) and Fast Start (2% x 5 faster until they are spent); Loaded Ring (PICK ONE: Master-Unlocked abilities 20% more) and Heavy Ring (points); Finds the Gap; Fortune\'s Fool',()=>{
  let L=nl(S(['lf_5_2','lf_6_2'])); L.v._keys=0; L.T.s.fresh=true; V.step(1); assert.equal(L.v._keys,2,'2 keys'); const i0=L.v.atkInterval; V.step(1); near(L.T.s.nx.bl?1:0,1,'');
  const i1=L.v.atkInterval; L.v._keys=5; lp(L,L.F[0]); V.step(2); near(L.v.atkInterval/i1,1.10,'Fast Start ends with the Master-Unlock that spends them',1e-6); void i0;
  const p=plain({},P=>{ P.v._keys=5; const h=P.F[0].hp; lp(P,P.F[0]); return h-P.F[0].hp; }), p0=plain({},P=>{ const h=P.F[0].hp; lp(P,P.F[0]); return h-P.F[0].hp; });
  L=nl(S(['lf_5_3','lf_6_3','lf_8_3','lf_12_2'])); const {v,F}=L; v._keys=5; let h=F[0].hp; lp(L,F[0]); near(h-F[0].hp,p*1.32,'Loaded Ring + Heavy Ring: 32% on a Master-Unlocked one',1e-6);
  h=F[0].hp; lp(L,F[0]); near(h-F[0].hp,p0*1.025,'not Master-Unlocked: only Fortune\'s Fool (one Master-Unlock: 0.5% x 5)',1e-6);
  v._keys=5; brnd(0.99); const a=lost(F[1],()=>{ v._keys=5; lp(L,F[1]); }); void a; assert.equal(stk(L,'ffl'),2,'Fortune\'s Fool: each Master-Unlock this fight');
  for(let i=0;i<12;i++) nx(L).api.acts(L.T,v,[{stack:'ffl',add:1}],{u:v}); near(ratioOut(L,v,F[2]),1.25,'up to 10 (25%)',1e-9);
  L.T.s.nx.mu=true; L.T.s.cur='energysteal'; near(ratioOut(L,v,F[2],{crit:true}),1.25*1.32*1.20,'Finds the Gap: a Master-Unlocked ability\'s crits 4% x 5 more',1e-9); L.T.s.nx.mu=false; L.T.s.cur=null;
});

test('Nox / Ring Jingle (0.4% x 5 attack a key), Ring of Five (at 5 keys 3% x 3 less), Every Lock Opens (a Master-Unlocked Lockpick Soul gives 3 Whiskers), Fortune\'s Favour (Fortune 4% x 5 larger), Charmed (1 point x 3 once he has Fortune)',()=>{
  const L=nl(S(['lf_5_4','lf_12_4','lf_11_2','lf_1_1','lf_2_2','lf_4_2'])), {v,F}=L; v._keys=0; V.step(1); const a0=v.dmg; v._keys=3; V.step(1); near(v.dmg/a0,1.06,'Ring Jingle: 2% a key',1e-6);
  near(ratioIn(L,F[0],v),1,'',1e-9); v._keys=4; near(ratioIn(L,F[0],v),1,'(not at 4)',1e-9); const c0=v.critDmg, e0=v.evaStat; v._keys=5; near(ratioIn(L,F[0],v),0.91,'Ring of Five: 9% less at 5',1e-9);
  V.step(2); near(v.critDmg-c0,0.05*v.passMul*1.20,'Fortune\'s Favour: the Fortune it adds 20% larger',1e-9); near(v.evaStat-e0,0.03*v.passMul*1.20+0.03,'and its dodge, + Charmed\'s 3 points',1e-9);
  lp(L,F[0]); assert.equal(stk(L,'wk'),3,'Every Lock Opens: 3 Whiskers');
});

test('Nox / The Seventh Lock (SIGNATURE): every 7th ability is Master-Unlocked without spending his keys, gives 3 Whiskers and leaves a Spare Key',()=>{
  const L=nl(S(['lf_13_2','lf_1_1'])), {v,F}=L; v._keys=0; for(const f of F) f.level=1;
  for(let i=0;i<6;i++){ v._keys=0; lp(L,F[0]); } v._keys=2; for(const f of F) f.silencedT=0;
  lp(L,F[0]); for(const f of F) assert.ok(f.silencedT>0,'the 7th: Master-Unlocked (three silenced)'); assert.equal(v._keys,3,'his 2 keys kept, + the Spare Key'); assert.equal(stk(L,'wk'),3,'3 Whiskers'); assert.ok(nx(L).spare);
  for(const f of F) f.silencedT=0; lp(L,F[0]); assert.equal(F[1].silencedT,0,'the 8th is not');
});

/* ======================= CAPS ======================= */
test('Nox / his caps: damage reduction ONE group at most 40% (allies 25%), critical chance at most 5%, talent dodge at most 10%, his burst heals within 1.2% of his max HP a second',()=>{
  const all=everything(H), L=nl(all), {v,A,F}=L; brnd(0.99); const f=F[0];
  setStack(L,'cou',5); setWin(L,'hot'); setStack(L,'wk',2); v._keys=5; setMk(L,f,'rb',null); f.energy=90; setMk(L,f,'bs'); nx(L).le={}; V.step(1); f.energy=90; v._keys=5; nx(L).le={};
  near(ratioIn(L,f,v),0.60,'every reduction on him at once: held at 40%',1e-9);
  setMk(L,A[1],'fs'); nx(L).acc=A[1]; near(ratioIn(L,f,A[1]),0.75,'an ally: held at 25%',1e-9);
  nx(L).tb={t:f,n:4}; setMk(L,f,'rb',null); setWin(L,'gl'); const c=L.T.fn.critP(nx(L).api,L.T,v,{tgt:f,auto:true}); near(c,0.05,'every crit chance at once: 5%',1e-12);
  v._keys=0; v._masterT=1; V.step(1); nx(L).fortN=1; nx(L).spare=true; nx(L).tl=[[V.now()+3,0.075]]; const e0=v.evaStat-(nx(L).evA||0); V.step(1); near(v.evaStat-e0,0.10,'talent dodge: held at 10%',1e-9);
  low(v,0.2); const o=nx(L); o.rgV=0; o.rgAt=V.now(); secs(1); const h=v.hp; for(let i=0;i<5;i++) L.T.fn.heal(o.api,L.T,v,0.05*v.maxHp); near(v.hp-h,0.012*v.maxHp,'heals in a second: at most 1.2% of his max HP',0.05);
});

/* ======================= WHOLE FIGHTS ======================= */
test('Nox: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['fe_1_1','fe_1_4','fe_8_2','jb_1_4','jb_5_4','lf_1_1','lf_1_4','lf_12_2','fe_11_1']), TEAM=['vael','sylthaine','vireo','vex','nox'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let hot=0, cou=0, acc=0, wk=0, tb=0, spare=0, mu=0; let lastK=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s, o=T0.nx||{}; if(T0.w.hot&&T0.w.hot.t>0) hot++; if(T0.k.cou&&T0.k.cou.n>0) cou++; if(o.acc&&o.acc.alive) acc++; if(T0.k.wk&&T0.k.wk.n>0) wk++; if(o.tb&&o.tb.n>0) tb++; if(o.spare) spare++; if((T0.k.ffl&&T0.k.ffl.n||0)>lastK){ mu++; lastK=T0.k.ffl.n; } }
  console.log('  live fight: ticks Hot '+hot+', with Courier '+cou+', with an Accomplice '+acc+', with Whiskers '+wk+', with Tumblers '+tb+', holding the Spare Key '+spare+', Master-Unlocks '+mu);
  assert.ok(hot>0&&cou>0&&acc>0&&tb>0&&spare>0&&mu>0,'Hot Goods, Courier, the Accomplice, Tumblers, the Spare Key and Master-Unlocks in a real fight');
  determinism(H,TEAM);
});

/* The page sites his talents added (the game's Evasion miss, Forbidden Key's receiver, the Ultimate hold): with nothing learned, whole seeded fights with Nox in
   the line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters show the fights reach every site. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Nox: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['nox','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __nxN={fk:0,ult:0,miss:0}; var __nxD=_doEffectCore, __nxC=castAbility, __nxH=_dealDamageCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="nox"&&type==="energygift") __nxN.fk++; return __nxD.apply(this,arguments); };'+
    'castAbility=function(u){ __nxN.ult++; return __nxC.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt){ const f0=floatTexts.length; const r=__nxH.apply(this,arguments); for(let i=f0;i<floatTexts.length;i++) if(floatTexts[i].txt==="MISS") __nxN.miss++; return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__nxN'); console.log('  identity / sites reached: '+JSON.stringify(c));
    assert.ok(c.fk>10&&c.ult>10&&c.miss>5,'the fights cast Forbidden Key, Ultimates, and the game\'s Evasion made hits miss'); }
  finally{ VMX('_doEffectCore=__nxD; castAbility=__nxC; _dealDamageCore=__nxH;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / max HP), each candidate 91-point build legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ fe:['fe_n1','fe_6_4','fe_8_2','fe_11_1','fe_10_4','fe_4_1','fe_1_4','fe_2_1'], jb:['jb_4_1','jb_7_1','jb_6_2','jb_5_2','jb_13_2'], lf:['lf_4_1','lf_6_1','lf_12_4','lf_10_4','lf_1_1','lf_9_1','lf_5_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={fe:0,jb:1,lf:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his reduction talents true at once (Hot, 5 Courier, 2 Whiskers, 5 keys, the attacker Ripe, robbed, Bare Shelves, its first hit
   this wave; the signature's held Ultimate on top when he has it; normal and critical, physical and magic); sustained: Hot, 3 Courier, nothing on the attacker, a basic
   attack of 5% of his max HP. Measured through the engine (HP and shield it takes). */
function worstHit(list,kind,crit,sustained,tj){ const L=nl(list,{allies:2,foes:3}), {v,F}=L; const f=F[0]; v.maxHp=1e5; v.hp=6e4; brnd(0.99);
  if(L.T){ if(!sustained){ setStack(L,'cou',5); setWin(L,'hot'); setStack(L,'wk',2); setMk(L,f,'rb',null); setMk(L,f,'bs'); if(tj) setMk(L,f,'tjb'); }
    else { setStack(L,'cou',3); setWin(L,'hot'); } }
  V.step(1); if(L.T){ nx(L).le={}; if(!sustained){ v._keys=5; f.energy=90; } else { v._keys=2; f.energy=30; } } v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6; v.evaStat=0;
  const raw=sustained?5e3:2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:!!sustained})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; brndBack();
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Nox: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['fe','lf'],[61,30]],[['fe'],[91]],[['fe','jb'],[61,30]],[['lf','fe'],[61,30]],[['jb','fe'],[61,30]],[['lf','jb'],[61,30]],[['jb','lf'],[61,30]],[['fe','lf','jb'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false,false),worstHit(c.list,kind,crit,false,true));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,pr:[]}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="nox"&&src&&src.team!==tgt.team; let h0=0; if(me) h0=tgt.hp+(tgt.shield||0); const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="nox"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    const A=T&&T.s.nx&&T.s.nx.api; if(A&&e){ const k=T.fn.drK(A,T,u,{src:e,kind:"phys",auto:true,crit:false,probe:true},false), d=1-k*Math.max(defMul(e,u,"phys"),defMul(e,u,"magic")); __dr.pr.push(d); if(d>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');   /* his group, the signature's weakened Ultimate and his armor / magic resist, each tick, against the first living enemy */
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','nox'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','kharos','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13,21,34,55,89]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; immune ticks '+d.imm+' of '+d.ticks+'; ticks at 85% or more (the probe: his group and his armor) '+d.tHi+', the probe median '+(d.pr.length?(d.pr.slice().sort((a,b)=>a-b)[d.pr.length>>1]*100).toFixed(1):'-')+'%, highest '+(d.pr.length?(Math.max(...d.pr)*100).toFixed(1):'-')+'%');
    assert.ok(d.n>20&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'at 85% or more for less than half of the fight: '+d.tHi+' of '+d.ticks+' ticks'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
