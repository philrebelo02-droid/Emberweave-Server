'use strict';
/* Sylthaine's talents as data on the mechanics layer (talents-mech/sylthaine.js), group by group on the still field (tests/talents-lab.js),
   then whole fights. Each group: the effect happens, has the right size, at the right time, and stops when it should.
   Run: node --test tests/talents-mech-sylthaine.test.js */
const test=require('node:test'),assert=require('node:assert/strict');
const {FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,accounting,determinism,snaps,spec}=require('./talents-lab.js');
const H='sylthaine', S=ids=>full(H,ids), vm=require('node:vm'), {NOW}=require('./talents-lab.js');
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const sure=L=>{ for(const f of L.F) f.level=1; };                      // her controls always land (no level-gap miss roll)
const free=(L,f)=>{ f.stunned=0; };
const setStack=(L,name,n)=>{ L.T.s.k[name]={n,t:0,idle:0}; };
const chill=(f,n)=>{ f._chillStacks=n; f._chillT=n>0?10:0; };

test('Sylthaine: every talent is accounted for - 8 plain stats, 109 with rows, nothing in part or waiting (the rulings of 14 Nov)',()=>{
  accounting(H,[117,8,109,0,0]);
  const M=FXN.mech(H); for(const id of ['ws_1_1','sp_2_2','sw_1_1','ws_13_2','sp_13_2','sw_13_2']) assert.ok(M.talents[id],id);
});

test('Sylthaine / Frostbite: Deep Chill, Marrow Frost, Numb Limbs, Hoarfrost Grip, Brittle Will, Hushed Ground, Ice in the Veins, Bitter Bite, Lingering Chill, Spreading Bite, Deep Bite',()=>{
  const ids=['ws_1_1','ws_11_1','ws_6_1','ws_7_1','ws_4_1','ws_10_4','ws_8_1','ws_2_1','ws_1_4','ws_10_1'];
  const L=lab(H,S(ids),{foes:3,allies:1,big:true}), {v,F,A}=L, T0=L.T, f=F[0];
  const b={ai:f.atkInterval,sp:f.speed,ar:f.armorRating,mr:f.mrRating};
  v._tal=undefined; const baseOut=lost(F[1],()=>V.hit(v,F[1],1000,{frost:true})), baseA=lost(A[0],()=>V.hit(F[1],A[0],1000)), baseV=lost(v,()=>V.hit(F[1],v,1000)); v._tal=T0;
  chill(f,4); V.step(1); near(f.atkInterval,b.ai,'4 Chill: not Frostbitten');
  chill(f,5); V.step(1); near(f.atkInterval,b.ai/0.85,'Frostbitten: attacks 2% x 5 (Deep Chill) + 1% x 5 (Marrow Frost) slower'); near(f.speed,b.sp*0.88,'Numb Limbs: moves 4% x 3 slower');
  near(f.armorRating,b.ar*0.90,'Hoarfrost Grip: 2% x 5 less armor'); near(f.mrRating,b.mr*0.90,'and magic resist'); near(F[1].atkInterval,b.ai,'an enemy with no Chill is untouched');
  near(lost(A[0],()=>V.hit(f,A[0],1000)),baseA*0.925,'Brittle Will: a Frostbitten enemy deals 1.5% x 5 less to her allies'); near(lost(v,()=>V.hit(f,v,1000)),baseV*0.925*0.90,'and to her, with Hushed Ground 2% x 5 less on top');
  chill(F[1],5); const cs=lost(F[1],()=>V.hit(v,F[1],1000,{frost:true})); v._tal=undefined; const csPlain=lost(F[1],()=>V.hit(v,F[1],1000,{frost:true})); v._tal=T0;
  near(cs,csPlain*1.09,'Ice in the Veins: her frost abilities deal 3% x 3 more to a Frostbitten enemy (Cold Snap counted in both)'); assert.ok(csPlain>baseOut,'Cold Snap itself raises frost damage on a Chilled enemy');
  const h=f.hp; f.hp-=5000; V.heal(f,1000); near(f.hp-(h-5000),1000*(1-0.18),'Bitter Bite: a Frostbitten enemy receives 6% x 3 less healing'); const h1=F[2].hp; F[2].hp-=5000; V.heal(F[2],1000); near(F[2].hp-(h1-5000),1000,'not one without Chill');
  sure(L); chill(F[1],0); chill(F[2],0); V.cast(v,'green',F[0]); near(F[1]._chillT,13,'Lingering Chill: her Chill lasts 10 + 1 x 3 s');
  /* Spreading Bite: F0 (Frostbitten) dies, its 5 Chill go to the enemy nearest it (F1 is 1.48 m away) */
  chill(F[1],0); chill(F[2],0); chill(f,5); V.dmg(f,2e9); assert.ok(!f.alive); assert.equal(F[1]._chillStacks,5,'Spreading Bite: the dead enemy\'s Chill passes to the nearest enemy'); assert.equal(F[2]._chillStacks,0);
  chill(F[1],5); secs(13.1); assert.equal(F[1]._chillStacks,0,'Chill ran out'); V.step(1); near(F[1].atkInterval,b.ai,'Frostbite ends with its Chill'); near(F[1].mrRating,b.mr,'');
  /* Deep Bite: Frostbite at 4 Chill; and without Deep Chill none of the Frostbite talents does anything */
  const D=lab(H,S(['ws_1_1','ws_3_1']),{foes:1}); const a0=D.F[0].atkInterval; chill(D.F[0],4); V.step(1); near(D.F[0].atkInterval,a0/0.90,'Deep Bite: Frostbitten at 4 Chill');
  const N=lab(H,S(['ws_6_1','ws_7_1']),{foes:1}); const s0=N.F[0].speed; chill(N.F[0],5); V.step(1); near(N.F[0].speed,s0,'without Deep Chill there is no Frostbite to improve'); assert.ok(!N.T.auras.length);
});

test('Sylthaine / freeze and Seal: Winter Seal, Hard Frost, Deep Prison, Seal of Ages, Sealed in Frost, Iron Seal, Cold Patience, Thin Ice, Unbroken Seal, Seal Passes, cooldowns',()=>{
  const ids=['ws_2_2','ws_5_1','ws_5_3','ws_11_2','ws_6_2','ws_7_2','ws_10_3','ws_12_4','ws_9_2','ws_4_2','ws_2_3','ws_11_3','ws_9_3'];
  const L=lab(H,S(ids),{foes:3,allies:1}), {v,F,A}=L, f=F[0], T0=L.T; sure(L); free(L,f);
  near(FX.cd(v,'blue',9),9*(1-0.045)-0.9,'Still Mind 1.5% x 3, then Glacial Patience 0.3 s x 3 (rows run in talent-id order)'); near(FX.cd(v,'green',8),8*(1-0.045)-1.0,'Patient Frost 0.2 s x 5');
  v._tal=undefined; const baseA=lost(F[2],()=>V.hit(A[0],F[2],1000)), baseV=lost(F[2],()=>V.hit(v,F[2],1000)); v._tal=T0;
  const cap=V.cap('stunned'); V.cast(v,'blue',f); near(f.stunned,Math.min(cap,2.45*1.10+0.6),'the first prison: Hard Frost 2% x 5, then Deep Prison +0.6 s, cut to the engine stun cap ('+cap+' s)'); assert.equal(L.T.s.m.seal,f,'Winter Seal: the first enemy it freezes this wave');
  assert.equal(f._chillStacks,4,'Sealed in Frost: frozen while Sealed, 1 Chill x 3 (and the prison\'s own Chill)'); near(v.energy,5,'Cold Patience: 1 energy x 5 per freeze');
  near(lost(f,()=>V.hit(A[0],f,1000)),baseA*1.12*1.10,'Thin Ice 4% x 3 (frozen) and Unbroken Seal 2% x 5 (Sealed) for her allies'); near(lost(f,()=>V.hit(v,f,1000)),baseV*1.10,'her own hit: only the Seal\'s share');
  secs(2.75); assert.ok(f.stunned>0&&!(f.silencedT>0)); secs(0.1); assert.ok(!(f.stunned>0)); assert.ok(f.silencedT>0.9&&f.silencedT<=1,'Iron Seal: silenced 1 s after the prison\'s freeze ends: '+f.silencedT);
  free(L,f); V.cast(v,'blue',f); near(f.stunned,V.cap('stunned'),'the Sealed enemy: Deep Prison +0.6 again and Seal of Ages +0.2 x 3, cut to the engine\'s '+V.cap('stunned')+' s cap');
  free(L,F[1]); V.cast(v,'blue',F[1]); assert.equal(L.T.s.m.seal,f,'only the first freeze of the wave Seals'); near(F[1].stunned,cap,'');
  V.wave(); V.step(1); free(L,F[2]); V.cast(v,'blue',F[2]); assert.equal(L.T.s.m.seal,F[2],'a new wave: the next first freeze Seals');
  /* Seal Passes: the Sealed enemy dies, the Seal moves to the enemy nearest it and freezes it 0.3 s x 3 */
  F[1].stunned=0; F.forEach(x=>{ if(x!==F[2]) x.x=F[2].x+200; }); F[1].x=F[2].x+5*V.METER; F[1].y=F[2].y; V.dmg(F[2],2e9); assert.equal(L.T.s.m.seal,F[1],'Seal Passes'); near(F[1].stunned,0.9*1.10,'frozen 0.3 s x 3 (Hard Frost counts: a freeze she causes)');
});

test('Sylthaine / Winter Seal slows the Sealed enemy\'s cooldowns; Twin Prison',()=>{
  const sn=snaps([spec(H,100,S(['ws_2_2'])),spec(H,100)]), en=snaps([spec(H,100),spec(H,100)]);
  const U=V.arena(sn,en,3), v=U[0], f=U[2], g=U[3]; for(const u of U){ u.stunned=1e6; u.maxHp=u.hp=1e9; } V.step(1); f.level=1; f.stunned=0; v.target=f; V.cast(v,'blue',f); assert.equal(v._tal.s.m.seal,f);
  f.stunned=0; g.stunned=0; f.greenCd=g.greenCd=7; f.blueCd=g.blueCd=7; secs(2);
  near(7-f.greenCd,(7-g.greenCd)*0.85,'the Sealed enemy\'s cooldowns recover 3% x 5 slower',2e-2); near(7-f.blueCd,(7-g.blueCd)*0.85,'',2e-2);
  const L=lab(H,S(['ws_5_2']),{foes:5}), {v:w,F}=L; sure(L); free(L,F[0]); F.forEach(x=>x.stunned=0); V.cast(w,'blue',F[0]);
  near(F[1].stunned,2.45*0.5,'Twin Prison: the nearest other enemy within 4 m of the target (F1, 1.48 m) is frozen for half as long'); assert.ok(!(F[4].stunned>0),'only one');
});

test('Sylthaine / Permafrost: Ground Freeze, Black Ice, Frozen Fields, Winter Grip, Rime Footing',()=>{
  const L=lab(H,S(['ws_1_4','ws_3_4','ws_5_4','ws_8_4','ws_9_4','ws_6_4']),{foes:3,allies:1}), {v,F,A}=L, f=F[0], T0=L.T; sure(L); free(L,f);
  v._tal=undefined; const baseA=lost(F[2],()=>V.hit(A[0],F[2],1000)); v._tal=T0;
  V.cast(v,'blue',f); secs(2.4); assert.ok(!L.T.s.zn.perma||!L.T.s.zn.perma.length,'no ground while frozen'); secs(0.1); f.stunned=1e6;
  const z=L.T.s.zn.perma[0]; assert.ok(z,'the freeze ended: frozen ground under it'); near(z.r/V.METER,1+0.45,'Frozen Fields: 2 m wide + 0.3 m x 3'); near(z.until-V.now(),2+1.5,'Black Ice: 2 s + 0.3 s x 5',2e-2);
  V.step(1); near(f.slowMul,0.80,'enemies on it are slowed 4% x 5'); near(lost(f,()=>V.hit(A[0],f,1000)),baseA*1.10,'Rime Footing: they take 2% x 5 more from her team');
  f.x+=12*V.METER; V.step(1); assert.ok(f.slow>0,'Winter Grip: stepping off keeps the slow'); near(lost(f,()=>V.hit(A[0],f,1000)),baseA,'off the ground: no Rime Footing'); secs(1.05); assert.ok(!(f.slow>0),'for 1 s');
  f.x-=12*V.METER; V.step(1); assert.ok(f.slow>0,'back on it'); secs(3.5); assert.ok(!(f.slow>0),'the ground thawed'); assert.ok(!L.T.s.zn.perma.some(q=>q.until>V.now()));
});

test('Sylthaine / Blizzard: Storm Gathering, Snowblind, Endless Winter, Quiet Ward, Shelter of Snow, Snowfall',()=>{
  const N=lab(H,S(['ws_8_3','ws_7_3']),{foes:1}); near(FX.num(N.v,'blizzR',8*V.METER),9*V.METER,'Storm Gathering: Blizzard\'s circle 8 m + 0.2 x 5'); near(FX.num(N.v,'blizzFreeze',0.10),0.15,'Snowblind: 10% + 1% x 5 a tick');
  const L=lab(H,S(['ws_8_3','ws_12_2','sw_7_2','sw_9_2','sw_12_3','sw_1_1']),{foes:4,allies:1,big:true}), {v,F,A}=L;
  /* the circle is centred on F1 (10,0): F0 and F2 are 5.5 m from it; F3 is moved to 8.5 m (inside 9 m, outside 8 m); A0 is moved inside */
  L.put(F[3],10,8.5); L.put(A[0],10,-4.3); A[0].maxHp=1e6; A[0].hp=5e5; F.forEach(x=>x.glyphDR=0); A[0].glyphDR=0;
  const plain=lost(A[0],()=>V.hit(F[0],A[0],1000));
  V.cast(v,'ult',F[1]); assert.ok(v._blizzT>4.4,'Endless Winter: 4 s + 0.1 x 5: '+v._blizzT); v.stunned=0; v.greenCd=v.blueCd=99;
  const hp0=A[0].hp, h3=F[3].hp; secs(0.52); assert.ok(F[3].hp<h3,'the 9 m circle reaches 8.5 m');
  near(A[0].hp-hp0,A[0].maxHp*0.015,'Shelter of Snow: allies inside regain 0.3% x 5 of their max HP each tick',1e-3); assert.equal(stack(L,'snow'),3+4,'Snowfall: 1 Snow per enemy hit, up to 3 a tick (and Snowpack: 1 per Chill)');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000)),plain*0.80,'Quiet Ward: allies inside take 20% less while the snow falls');
  secs(4.2); assert.ok(!(v._blizzT>0)); near(lost(A[0],()=>V.hit(F[0],A[0],1000)),plain,'and not after it');
});

test('Sylthaine / The Long Winter (SIGNATURE)',()=>{
  const L=lab(H,S(['ws_2_2','ws_13_2']),{foes:3,big:true}), {v,F}=L; sure(L); F.forEach(x=>{ x.stunned=0; x.speed=0; });
  V.cast(v,'blue',F[1]); assert.equal(L.T.s.m.seal,F[1]); F[1].stunned=0;
  V.cast(v,'ult',F[1]); v.stunned=0; v.greenCd=v.blueCd=99; secs(1.0); F.forEach(x=>{ x.stunned=0; }); secs(3.2); v.stunned=1e6;
  assert.ok(L.T.s.w.lw&&L.T.s.w.lw.t>7,'when Blizzard ends its circle stays as the Long Winter'); F.forEach(x=>{ x.stunned=0; chill(x,3); });
  V.step(1); near(F[0].slowMul,0.70,'enemies inside are slowed 30%'); assert.ok(F[1].silencedT>0,'the Sealed enemy cannot use its abilities inside');
  secs(1.02); assert.equal(F[0]._chillStacks,4,'1 Chill every second'); secs(1.0); assert.equal(F[0]._chillStacks,5); assert.ok(F[0].stunned>1.0&&F[0].stunned<=1.5,'at 5 Chill inside: frozen 1.5 s (a quarter second ago): '+F[0].stunned);
  F[0].stunned=0; chill(F[0],3); secs(2.1); assert.equal(F[0]._chillStacks,5); assert.ok(!(F[0].stunned>0),'once per enemy each Long Winter');
  secs(4); V.step(2); assert.ok(!(L.T.s.w.lw.t>0)); const c=F[2]._chillStacks; secs(1.1); assert.equal(F[2]._chillStacks,c,'after 8 s: no more Chill'); assert.ok(!(F[0].slow>0)&&!(F[1].silencedT>0),'no slow, no silence');
});

test('Sylthaine / Hailstones: Hailstones, Hail Rhythm, Heavy Hail, Shattering Hail, Sleet, Hail Clock, Hailfall',()=>{
  const L=lab(H,S(['sp_1_1','sp_3_1','sp_2_1','sp_8_1','sp_5_1','sp_7_1','sp_10_1']),{foes:2}), {v,F}=L, f=F[0], ap=v.apow;
  const hail=ap*0.30*1.30;
  const T0=L.T; v._tal=undefined; const plain=lost(F[1],()=>V.hit(v,F[1],10,{auto:true})); v._tal=T0;
  near(lost(f,()=>V.hit(v,f,10,{auto:true})),plain,'1st basic attack: plain'); lost(f,()=>V.hit(v,f,10)); assert.equal(stack(L,'hailc'),1,'a hit that is not a basic attack does not count');
  V.hit(v,f,10,{auto:true}); v.blueCd=5; const x=lost(f,()=>V.hit(v,f,10,{auto:true}))-plain;
  near(x,hail,'Hail Rhythm: the 3rd basic attack is a Hailstone: 6% x 5 of her ability power, Heavy Hail 10% x 3 more (no Chill yet when it lands)',1e-3);
  assert.equal(f._chillStacks,1,'it adds 1 Chill'); near(v.blueCd,5-0.5,'Hail Clock: 0.1 s x 5 off Glacial Prison'); near(f.slowMul,0.85,'Sleet: slowed 3% x 5'); near(f.slow,1.5,'for 1.5 s');
  V.hit(v,f,10,{auto:true}); V.hit(v,f,10,{auto:true}); const y=lost(f,()=>V.hit(v,f,10,{auto:true}))-plain; near(y,hail*1.30,'Shattering Hail: 10% x 3 more on a Chilled enemy',1e-2);
  F[1].maxHp=F[1].hp=hail*0.5; V.hit(v,F[1],0.001,{auto:true}); V.hit(v,F[1],0.001,{auto:true}); assert.equal(stack(L,'hailc'),2); V.hit(v,F[1],0.001,{auto:true}); assert.ok(!F[1].alive,'the Hailstone killed it');
  assert.equal(stack(L,'hailc'),2,'Hailfall: her next basic attack is a Hailstone too'); const z=lost(f,()=>V.hit(v,f,10,{auto:true})); assert.ok(z>hail,'and it is');
});

test('Sylthaine / Icebreaker: Icebreaker, Shrapnel, Cracked Mirror, Fault Lines, Winter Edge, Marked in Ice (and its Seal), Hailbreaker',()=>{
  const ids=['sp_2_2','sp_4_2','sp_12_2','sp_6_2','sp_11_3','sp_n1','ws_2_2','sp_1_1','sp_4_1'];
  const L=lab(H,S(ids),{foes:6}), {v,F}=L, f=F[0], ap=v.apow; sure(L); free(L,f);
  /* F0 is frozen by the prison (no Seal: Glacial Prison's Seal needs a freeze from it; here the Seal comes from Marked in Ice) */
  F.forEach(x=>{ x.stunned=0; }); L.put(F[5],30,30); chill(f,0); V.hit(v,f,1,{frost:true}); f.stunned=0;
  V.cc(v,f,'stunned',2/V.ccNerf); assert.ok(mark(L,f,'frz'),'a freeze she lands is tracked'); assert.equal(f._chillStacks,0);
  const h4=F[4].hp, h3=F[3].hp; V.cast(v,'green',F[2]);
  assert.ok(!(f.stunned>0),'a frost ability on a frozen enemy shatters the freeze'); assert.ok(!mark(L,f,'frz'));
  const sh=(h4-F[4].hp)/0.5; near(sh,ap*0.40*1.15,'Icebreaker: 8% x 5 of her ability power, Winter Edge 3% x 5 more (Fault Lines: no Chill on it yet)',1e-3);
  near(h3-F[3].hp,sh*0.5,'Shrapnel: enemies within 3 + 0.3 x 5 m take 10% x 5 of it (F3 is 3.48 m away)',1e-3);
  assert.equal(L.T.s.m.seal,f,'Marked in Ice with Winter Seal: the first Icebreaker of the wave Seals when nobody is Sealed');
  /* second shatter: 5 Chill and Sealed -> Fault Lines 5% x 3 per Chill, Marked in Ice +5% and +10% */
  chill(f,5); V.cc(v,f,'stunned',2/V.ccNerf); const g4=F[4].hp; V.cast(v,'green',F[2]); near((g4-F[4].hp)/0.5,ap*0.40*1.15*(1+0.15*5)*1.05*1.10,'Fault Lines, Marked in Ice (5 Chill, Sealed)',1e-3);
  /* Hailbreaker: a Hailstone on a frozen enemy shatters it; a basic attack that is not one does not */
  chill(F[1],0); V.cc(v,F[1],'stunned',2/V.ccNerf); V.hit(v,F[1],1,{auto:true}); assert.ok(F[1].stunned>0,'a plain basic attack does not shatter'); L.T.s.k.hailc.n=3;
  V.hit(v,F[1],1,{auto:true}); assert.ok(!(F[1].stunned>0),'Hailbreaker: the Hailstone shatters it');
  /* Blizzard ticks do not shatter (reading) */
  V.cc(v,F[1],'stunned',3/V.ccNerf); V.cast(v,'ult',F[1]); v.stunned=0; secs(0.55); v.stunned=1e6; assert.ok(F[1].stunned>0,'a Blizzard tick is not an Icebreaker');
  const P=lab(H,S(['sp_4_2']),{foes:3}); sure(P); P.F.forEach(x=>x.stunned=0); V.cc(P.v,P.F[0],'stunned',2/V.ccNerf); V.cast(P.v,'green',P.F[2]); assert.ok(P.F[0].stunned>0,'without Icebreaker nothing shatters');
});

test('Sylthaine / Prison Break; Thousand Shards; Glass Winter (SIGNATURE)',()=>{
  const L=lab(H,S(['sp_2_2','sp_6_2','sp_7_2']),{foes:3}), {v,F}=L, f=F[0], ap=v.apow; sure(L); F.forEach(x=>x.stunned=0);
  V.cast(v,'blue',f); const h=f.hp; secs(2.4); assert.equal(f.hp,h); secs(0.15); near(h-f.hp,ap*0.40*(1+0.15*f._chillStacks),'Prison Break: when the prison\'s freeze ends, a full Icebreaker on its target',1e-3);
  free(L,f); V.cast(v,'blue',f); f.stunned=0; const g=f.hp; secs(2.6); assert.equal(f.hp,g,'a prison broken early (the freeze was cut short) does not break again');
  /* Glass Winter: at 5 Chill an enemy is flash-frozen 0.8 s (once per enemy every 12 s); her next frost hit on it is a double Icebreaker that gives 3 Chill within 4 m */
  const G=lab(H,S(['sp_2_2','sp_13_2','sp_1_4','sp_11_2']),{foes:6}); sure(G); G.F.forEach(x=>{ x.stunned=0; chill(x,0); }); G.put(G.F[5],30,30);
  chill(G.F[0],4); V.cast(G.v,'green',G.F[2]); assert.equal(G.F[0]._chillStacks,5); near(G.F[0].stunned,0.8,'flash-frozen at 5 Chill'); assert.equal(G.F[1].stunned||0,0);
  secs(1); assert.ok(!(G.F[0].stunned>0)); const f0=stack(G,'focus');
  const h4=G.F[4].hp, h3=G.F[3].hp; V.cast(G.v,'blue',G.F[0]); const ibd=G.F[0]._talM;
  assert.ok(G.F[4].hp===h4,'F4 is not hit by anything'); assert.equal(G.F[3]._chillStacks,3,'3 Chill to every enemy within 4 m (F3, 3.48 m)'); assert.equal(G.F[4]._chillStacks,3,''); assert.equal(G.F[1]._chillStacks,4,'(F1 had 1 from the orb)');
  assert.equal(stack(G,'focus')-f0,3,'Thousand Shards: 1 Focus x 3 per Icebreaker'); assert.ok(!mark(G,G.F[0],'gw'),'used up');
  chill(G.F[0],4); G.F[0].stunned=0; V.cast(G.v,'green',G.F[2]); assert.ok(!(G.F[0].stunned>0.5),'once per enemy every 12 s');
});

test('Sylthaine / Focus: Cold Focus, Stillness, Deep Calm, Calm Before, Glass Nerves, Clear Air, Spent Focus, Frozen Moment',()=>{
  const L=lab(H,S(['sp_1_4','sp_5_4','sp_8_4','sp_6_4','sp_11_4','sp_3_4','sp_12_4','sp_9_4']),{foes:5,big:true}), {v,F}=L, T0=L.T; sure(L);
  const ap0=v.apow; v._tal=undefined; const bIn=lost(v,()=>V.hit(F[2],v,1000)); const bOut=lost(F[2],()=>V.hit(v,F[2],1000,{frost:true})); v._tal=T0;
  secs(2.05); assert.equal(stack(L,'focus'),3,'Stillness: 10% x 5 faster: a Focus every 2/3 s without damage'); V.step(1); near(v.apow,ap0*(1+3*0.009),'0.3% x 3 ability power per Focus');
  setStack(L,'focus',5); V.step(1); near(lost(v,()=>V.hit(F[2],v,1000)),bIn*0.88,'Glass Nerves: at 5 Focus she takes 4% x 3 less'); assert.equal(stack(L,'focus'),4,'Deep Calm: a hit takes 20% of her Focus (5 -> 4)');
  setStack(L,'focus',6); near(lost(F[2],()=>V.hit(v,F[2],1000,{frost:true})),bOut*1.10,'Calm Before: at 5 Focus her frost hits deal 2% x 5 more');
  V.step(1); setStack(L,'focus',5); V.dot(v,100,1,1,F[2]); secs(1.02); assert.equal(stack(L,'focus'),4,'a DoT tick is damage too');
  /* Clear Air + Spent Focus: at 10 Focus her next ability spends it all and deals 4% x 5 more; Frozen Moment: the next prison freezes every enemy within 3 m of its target */
  F.forEach(x=>x.stunned=0); setStack(L,'focus',10); v.energy=0; V.cast(v,'blue',F[0]);
  assert.equal(stack(L,'focus'),0,'Clear Air spent all Focus'); near(v.energy,3,'Spent Focus: 1 energy x 3'); near(F[1].stunned,2.45,'Frozen Moment: F1 (1.48 m) frozen as long as the prison'); assert.ok(F[4].stunned>0,'F4 (2.06 m)'); assert.ok(!(F[3].stunned>0),'F3 (3.48 m): no');
  F.forEach(x=>x.stunned=0); V.cast(v,'blue',F[0]); assert.ok(!(F[1].stunned>0),'below 10 Focus: the prison freezes one');
});

test('Sylthaine / Frozen Orb: Frost Lattice, Trailing Frost, Frost Veil, Sharp Frost, Cold Precision, Crushing Orb, Splitting Orb',()=>{
  const L=lab(H,S(['ws_4_3','sp_6_3','sw_7_3','sp_2_3','sp_8_3']),{foes:3}), {v,F}=L, T0=L.T; sure(L);
  const m=V.slowMulFor(10); v._tal=undefined; F.forEach(x=>chill(x,0)); const hp=F.map(x=>x.hp); V.cast(v,'green',F[2]); const plain=F.map((x,i)=>hp[i]-x.hp); v._tal=T0;
  F.forEach(x=>{ chill(x,0); x.slow=0; x.slowMul=1; }); const hp2=F.map(x=>x.hp); V.cast(v,'green',F[2]);
  F.forEach((x,i)=>near(hp2[i]-x.hp,plain[i]*1.12*1.10,'Sharp Frost 4% x 3 and Cold Precision 2% x 5 more, enemy '+i,1e-3));
  near(F[1].slowMul,1-(1-m)*(1+0.15+0.12+0.20),'the slow is 15% + 12% + 20% stronger'); near(F[1].slow,2.5*V.ccNerf+0.6,'Trailing Frost: 0.2 s x 3 longer');
  const C=lab(H,S(['sp_5_2']),{foes:3}); sure(C); const ch=C.F.map(x=>x.hp); C.F.forEach(x=>{ x.stunned=0; }); V.cast(C.v,'green',C.F[2]);
  near((ch[0]-C.F[0].hp)/(ch[1]-C.F[1].hp),1.25,'Crushing Orb: 25% more to the first enemy along its line',1e-2); assert.ok(C.F[0].stunned>0.55&&C.F[0].stunned<=0.6,'and frozen 0.6 s'); assert.ok(!(C.F[1].stunned>0));
  const D=lab(H,S(['sp_5_3']),{foes:6}); sure(D); D.put(D.F[5],14,5.5); D.put(D.F[4],30,30); D.put(D.F[3],30,40); const dh=D.F.map(x=>x.hp); V.cast(D.v,'green',D.F[2]);
  const e2=dh[2]-D.F[2].hp, e1=dh[1]-D.F[1].hp, e0=dh[0]-D.F[0].hp; near(e2,e0*1.5,'Splitting Orb: the end of the line (the farthest enemy) bursts: it takes 50% more',1e-2); near(e1,e0*1.5,'and so does F1 (1.48 m from it)',1e-2);
  assert.ok(dh[5]-D.F[5].hp>0,'F5 (off the line, 1.68 m from its end) is inside 3 m');
});

test('Sylthaine / damage and defence: Biting Cold, Brittle Bones, Opening Frost, Deeper Snap, Reckless Cold, Glass Heart, Cold Blood',()=>{
  const L=lab(H,S(['sp_1_3','sp_9_3','sp_10_4','sp_10_3','sp_7_4','sp_4_3','ws_3_3']),{foes:2,cold:true}), {v,F}=L, T0=L.T; const hp0=v.maxHp, ap0=v.apow; V.step(1);
  near(v.maxHp,hp0*0.90,'Glass Heart: 2% x 5 less max HP'); near(v.apow,ap0*1.10,'and 2% x 5 more ability power');
  const f=F[0]; v._tal=undefined; const fresh=lost(f,()=>V.hit(v,f,1000,{frost:true})); f.hp=f.maxHp*0.5; const half=lost(f,()=>V.hit(v,f,1000,{frost:true})); chill(f,3);
  const cold=lost(f,()=>V.hit(v,f,1000,{frost:true})); const sv=f.mrRating; f.mrRating=sv*0.9; const cut=lost(f,()=>V.hit(v,f,1000,{frost:true})); f.mrRating=sv; const auto=lost(f,()=>V.hit(v,f,1000)); v._tal=T0;
  f.hp=f.maxHp; chill(f,0); near(lost(f,()=>V.hit(v,f,1000,{frost:true})),fresh*1.10*1.10,'Opening Frost 2% x 5 above 70% HP; Reckless Cold 2% x 5 on her abilities');
  f.hp=f.maxHp*0.5; near(lost(f,()=>V.hit(v,f,1000,{frost:true})),half*1.10,'not at half HP');
  chill(f,3); near(lost(f,()=>V.hit(v,f,1000,{frost:true})),cut*1.10*1.05*(1+3*0.025),'Biting Cold: 10% of a Chilled enemy\'s magic resist ignored; Brittle Bones 1% x 5; Deeper Snap 0.5% x 5 per Chill');
  near(lost(f,()=>V.hit(v,f,1000)),auto*1.05,'a basic attack on a Chilled enemy: only Brittle Bones'); assert.ok(cold>0);
  const h=v.hp; V.hit(F[1],v,1000); v._tal=undefined; const h2=v.hp; V.hit(F[1],v,1000); const pl=h2-v.hp; v._tal=T0; near(h-h2,pl*1.05,'Reckless Cold: she takes 1% x 5 more');
  v.stunned=0; let ok=false; for(let i=0;i<20&&!ok;i++){ v.stunned=0; ok=V.cc(F[1],v,'stunned',2); } near(v.stunned,2*V.ccNerf*0.80,'Cold Blood: control on her 4% x 5 shorter');
});

test('Sylthaine / Snowpack: Snowpack, Deep Snow, Packed Ice, Glacier Wall, Drift, Snowbound, Winter Mercy, Avalanche, Overflowing Snow, Snowkeeper, Wintermind',()=>{
  const ids=['sw_1_1','sw_2_1','sw_4_1','sw_8_1','sw_3_1','sw_5_1','sw_11_2','sw_6_1','sw_10_1','sw_11_1','sw_6_3'];
  const L=lab(H,S(ids),{foes:3,allies:2,cold:true}), {v,F,A}=L, T0=L.T; sure(L); const ap0=v.apow; V.step(1);
  assert.equal(stack(L,'snow'),15,'Snowkeeper: each wave starts with 5 x 3 Snow'); V.step(1); near(v.apow,ap0*1.075,'Wintermind: 1.5% x 5 ability power at 10+ Snow');
  V.cast(v,'green',F[2]); assert.equal(stack(L,'snow'),18,'each Chill she applies adds 1 Snow'); setStack(L,'snow',100); assert.equal(stack(L,'snow'),100); V.cast(v,'green',F[2]); assert.equal(stack(L,'snow'),45,'Deep Snow: 30 + 5 x 3');
  v._tal=undefined; const base=lost(A[0],()=>V.hit(F[0],A[0],1000)); v._tal=T0; setStack(L,'snow',30);
  L.put(F[1],0,-10.1); F[1].slow=0; F[1].slowMul=1; V.hit(F[1],A[0],10); A[0].hp=A[0].maxHp*0.39; V.step(1);
  near(A[0].shield,A[0].maxHp*0.003*5*1.15*10,'an ally below 40%: 10 Snow become a shield of 0.3% x 5 of their max HP per Snow, Glacier Wall 3% x 5 stronger'); assert.equal(stack(L,'snow'),20);
  near(A[0].shieldT,4+2,'Packed Ice: 4 s + 0.4 x 5',1e-2); near(F[1].slowMul,0.70,'Drift: the enemy that last hit that ally is slowed 30%'); assert.ok(F[1].slow>1.9);
  A[0].shield=0; near(lost(A[0],()=>V.hit(F[0],A[0],1000)),base*0.90*0.91,'Snowbound 2% x 5 while the Snowpack shield is up; Winter Mercy 3% x 3 for 3 s'); A[0].shield=A[0].maxHp*0.01;
  A[0].hp=A[0].maxHp*0.5; V.step(1); A[0].hp=A[0].maxHp*0.39; V.step(1); assert.equal(stack(L,'snow'),20,'once per ally every 8 s');
  /* Avalanche: the shield is used up; enemies within 2 m of that ally take 20% x 3 of her ability power */
  const h1=F[1].hp, h0=F[0].hp; V.dmg(A[0],A[0].shield+1); V.step(1); near(h1-F[1].hp,v.apow*0.60,'Avalanche (F1 stands beside the ally)'); assert.equal(F[0].hp,h0,'F0 is far from the ally');
  secs(8); A[0].shield=0; V.step(1); A[0].hp=A[0].maxHp; V.step(1); A[0].hp=A[0].maxHp*0.3; V.step(1); assert.ok(A[0].shield>0,'after 8 s the same ally can be shielded again');
  /* Overflowing Snow: with the Snowpack full, Glacial Prison spends 10 Snow to shield the ally nearest its target */
  setStack(L,'snow',45); A.forEach(a=>{ a.shield=0; }); V.cast(v,'blue',F[1]); assert.equal(stack(L,'snow'),35); assert.ok(A[1].shield>0||A[0].shield>0); near(Math.max(A[0].shield,A[1].shield),A[0].maxHp*0.003*5*1.15*10,'a Snowpack shield');
  V.cast(v,'blue',F[1]); assert.equal(stack(L,'snow'),36,'not when the Snowpack is not full (only the prison own Chill adds 1)');
});

test('Sylthaine / Thaw: Thaw, Kind Frost, Clear Water, Running Water, Snowmelt, Wellspring, Meltwater',()=>{
  const L=lab(H,S(['sw_1_4','sw_11_4','sw_8_4','sw_5_4','sw_7_4','sw_1_1','sw_9_4']),{foes:2,allies:2}), {v,F,A}=L; sure(L); A.forEach(a=>{ a.maxHp=1e6; a.hp=9e5; }); A[1].hp=8e5;
  const th=v.apow*0.30*1.15*(v.healPowMul||1);
  free(L,F[0]); V.cast(v,'blue',F[0]); const a0=A[0].hp, a1=A[1].hp, s0=stack(L,'snow'); secs(2.5);
  near(A[0].hp-a0,th,'Thaw: the ally nearest the melting ice heals 6% x 5 of her ability power, Kind Frost 3% x 5 more',1e-3); near(A[1].hp-a1,th*0.5,'Running Water: a second ally heals 10% x 5 of it',1e-3);
  assert.equal(stack(L,'snow')-s0,5,'Snowmelt: 1 Snow x 5 per Thaw');
  A[0].hp=4e5; F[0].stunned=0; V.cast(v,'blue',F[0]); const b0=A[0].hp; secs(2.5); near(A[0].hp-b0,th*1.15,'Clear Water: 5% x 3 more on an ally below half',1e-3);
  F[0].stunned=1e6; A[1].hp=1.5e5; V.step(1); const w=A[1].hp; assert.ok(w-1.5e5>=th*3*0.99,'Wellspring: an ally below 20% gets a Thaw at triple healing: '+(w-1.5e5)); A[1].hp=1e5; V.step(1); assert.equal(A[1].hp,1e5,'once per wave');
  const M=lab(H,S(['sw_1_4','sw_2_4']),{foes:1,allies:1}); sure(M); M.A[0].maxHp=1e6; M.A[0].hp=5e5; free(M,M.F[0]); V.cast(M.v,'blue',M.F[0]); secs(2.5); const m0=M.A[0].hp;
  assert.ok(M.A[0].hp-5e5<M.v.apow*0.30*1.45*0.7,'Meltwater: not at once'); secs(3.2); near(M.A[0].hp-5e5,M.v.apow*0.30*1.45,'over 3 s, 15% x 3 more',1e-3); assert.ok(m0>=5e5);
});

test('Sylthaine / Still Cold: Still Cold, Hard Winter, White Silence, Biting Air, Snow Blind, Thick Furs, Cold Shoulder',()=>{
  const L=lab(H,S(['sw_3_2','sw_8_3','sw_12_2','sw_4_2','sw_9_3','sw_n1']),{foes:3,allies:1,big:true,cold:true}), {v,F,A}=L, T0=L.T; const b=F.map(f=>[f.atkInterval,f.speed]); V.step(1);
  v._tal=undefined; const bV=lost(v,()=>V.hit(F[0],v,1000)), bA=lost(A[0],()=>V.hit(F[0],A[0],1000)), bFar=lost(v,()=>V.hit(F[2],v,1000)); v._tal=T0;
  near(F[0].atkInterval,b[0][0]/0.95,'Still Cold: inside the ring enemies attack 1% x 5 slower'); near(F[0].speed,b[0][1]*0.90,'White Silence: and move 2% x 5 slower');
  near(F[1].atkInterval,b[1][0]/0.95,'Hard Winter: 5 m + 0.5 x 3 reaches F1 (5.98 m)'); near(F[2].atkInterval,b[2][0],'F2 (11.5 m): outside');
  near(lost(v,()=>V.hit(F[0],v,1000)),bV*0.95,'Snow Blind: enemies inside deal 1% x 5 less, to her'); near(lost(A[0],()=>V.hit(F[0],A[0],1000)),bA*0.95,'and to her allies'); near(lost(v,()=>V.hit(F[2],v,1000)),bFar*0.90,'Thick Furs: 2% x 5 less from enemies more than 6 m away');
  chill(F[0],0); secs(1.02); assert.equal(F[0]._chillStacks,1,'Biting Air: 1 Chill every 4 - 1 x 3 s inside'); secs(1); assert.equal(F[0]._chillStacks,2); assert.equal(F[2]._chillStacks||0,0);
  F[0].x+=20*V.METER; V.step(1); near(F[0].atkInterval,b[0][0],'leaving the ring'); near(F[0].speed,b[0][1],'');
  const C=lab(H,S(['sw_12_4']),{foes:2}); chill(C.F[0],0); V.hit(C.F[0],C.v,10); assert.equal(C.F[0]._chillStacks,1,'Cold Shoulder: an enemy that hits her gains 1 Chill'); V.hit(C.F[0],C.v,10); assert.equal(C.F[0]._chillStacks,1,'once every 4 - 1 x 3 s');
  V.hit(C.F[1],C.v,10); assert.equal(C.F[1]._chillStacks,1,'each enemy has its own clock'); secs(1.05); V.hit(C.F[0],C.v,10); assert.equal(C.F[0]._chillStacks,2);
});

test('Sylthaine / The Quiet Snow (SIGNATURE)',()=>{
  const L=lab(H,S(['sw_13_2']),{foes:2,allies:2}), {v,F,A}=L; A.forEach(a=>{ a.maxHp=1e5; a.hp=1000; }); setStack(L,'snow',20); F[0].stunned=0; F[0].level=1;
  V.hit(F[0],A[0],5000); assert.ok(A[0].alive,'a hit that would kill an ally within 8 m freezes them in ice instead'); assert.equal(A[0].hp,1); assert.ok(A[0].stunned>=2-1e-9);
  near(F[0].stunned,2,'the attacker is frozen 2 s'); V.hit(F[1],A[0],5000); V.dot(A[0],5000,1,1,F[1]); secs(1.05); assert.ok(A[0].alive&&A[0].hp===1,'for 2 s it cannot be hurt');
  secs(1.0); near(A[0].hp,1+20*1000,'when the ice breaks she spends all her Snow: 1% of their max HP per Snow',1e-3); assert.equal(stack(L,'snow'),0);
  A[0].hp=10; V.hit(F[1],A[0],5000); assert.ok(!A[0].alive,'once per fight for each ally');
  L.put(A[1],0,-30); A[1].hp=10; V.hit(F[1],A[1],5000); assert.ok(!A[1].alive,'an ally further than 8 m is not saved');
});

test('Sylthaine: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['sp_1_1','ws_2_2','sw_1_1','ws_1_1','sp_2_2','sw_1_4']), TEAM=['vael','sylthaine','vireo','vex','gruel'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let hail=0,seal=false,snow=0,frz=false; for(let i=0;i<2400&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; hail=Math.max(hail,T0.k.hailc?T0.k.hailc.n:0); seal=seal||!!T0.m.seal; snow=Math.max(snow,T0.k.snow?T0.k.snow.n:0); frz=frz||T0.tm.some(e=>e.name==='frz'); }
  assert.ok(hail>=1,'her real basic attacks count toward a Hailstone'); assert.ok(seal,'a real Glacial Prison Sealed an enemy'); assert.ok(snow>=3,'real Chill filled the Snowpack: '+snow); assert.ok(frz,'a real freeze was tracked');
  determinism(H,TEAM);
});

test('Sylthaine / Cold Snap refusal: without her passive there is no Chill at all, from her skills or from her talents (and so no Snow)',()=>{
  const L=lab(H,S(['sw_1_1','sw_12_4','sp_1_1']),{foes:2}), {v,F}=L; sure(L); v.pass=null; chill(F[0],0); chill(F[1],0);
  V.cast(v,'green',F[1]); V.hit(F[0],v,10); L.T.s.k.hailc={n:3,t:0,idle:0}; V.hit(v,F[0],10,{auto:true});
  assert.equal(F[0]._chillStacks+F[1]._chillStacks,0,'no Chill'); assert.equal(stack(L,'snow'),0,'no Snow');
});

/* ------------------------------ Sylthaine's rulings (WIRING/10, 14 Nov 2026) ------------------------------ */
test('Sylthaine rulings / Glass Rain (a soft shatter each Blizzard tick, the freeze stays), Storm of Hail (one nearby enemy)',()=>{
  const L=lab(H,S(['sp_2_2','sp_9_2']),{foes:2}), {v,F}=L, ap=v.apow, rIB=T.talent(H,'sp_2_2').ranks, rGR=T.talent(H,'sp_9_2').ranks;
  L.put(F[1],0,3); V.cc(v,F[1],'stunned',3/V.ccNerf); assert.ok(F[1].stunned>0); const h1=F[1].hp, h0=F[0].hp;
  V.cast(v,'ult',F[1]); v.stunned=0; secs(0.55); v.stunned=1e6;
  near((h1-F[1].hp)-(h0-F[0].hp),ap*0.08*rIB*0.08*rGR,'the frozen enemy took 8% x '+rGR+' of an Icebreaker (8% x '+rIB+' of her ability power) more than the one beside it',1e-3);
  assert.ok(F[1].stunned>0,'and stays frozen');
  const G=lab(H,S(['sp_1_1','sp_12_1']),{foes:3}), ap2=G.v.apow, rH=T.talent(H,'sp_1_1').ranks, rS=T.talent(H,'sp_12_1').ranks;
  setStack(G,'hailc',P_HAIL(G)); const n1=G.F[1].hp, n2=G.F[2].hp; V.hit(G.v,G.F[0],10,{auto:true});
  near(n1-G.F[1].hp,ap2*0.06*rH*0.15*rS,'Storm of Hail: the nearest other enemy within 3 m takes 15% x '+rS+' of the Hailstone',1e-3); assert.equal(G.F[2].hp,n2,'only one, and not one 5 m away');
  near(lost(G.F[1],()=>V.hit(G.v,G.F[0],10,{auto:true})),0,'a basic attack that is not a Hailstone: nothing');
});
const P_HAIL=G=>3;   // the 4th basic attack is a Hailstone: three already counted

test('Sylthaine rulings / Ice Tomb (the prison still freezes its enemy, the ally is encased too) and Cold Sleep\'s half',()=>{
  const L=lab(H,S(['sw_5_2','sw_6_2']),{foes:1,allies:1}), {v,F,A}=L; sure(L); const a=A[0], f=F[0], rC=T.talent(H,'sw_6_2').ranks; a.stunned=0; f.stunned=0;
  V.cast(v,'blue',f); assert.ok(!(a.stunned>0)&&!(a.stunned>1e5),'no ally low: nothing'); a.stunned=0; f.stunned=0;
  a.hp=a.maxHp*0.20; V.step(1); a.stunned=0; V.cast(v,'blue',f); assert.ok(f.stunned>2,'Glacial Prison still freezes its enemy');
  assert.ok(a.stunned>=1.5-1e-9,'the ally is encased: it cannot act'); near(lost(a,()=>V.hit(f,a,1000,{kind:'true'})),0,'and cannot be hurt');
  const hp=a.hp; secs(1.55); near(a.hp-hp,a.maxHp*(0.10+0.03*rC)*(v.healPowMul||1),'when it breaks: 10% of its max HP, Cold Sleep 3% x '+rC+' more',1e-6);
  assert.ok(lost(a,()=>V.hit(f,a,1000,{kind:'true'}))>0,'and it can be hurt again');
  a.stunned=0; f.stunned=0; V.cast(v,'blue',f); assert.ok(!(a.stunned>0),'only her NEXT prison after the ally dropped');
});

test('Sylthaine rulings / Warden\'s Prison: Glacial Prison is sent to the enemy attacking her lowest-HP ally before it is launched',()=>{
  const launch=(L,t)=>{ const v=L.v; v.target=t; v._castLv=10; v._castSM=1; v._castSlot='blue'; vm.runInContext('deliverLaunch',NOW.ctx)(v,'freeze',v.blueAb); v._castLv=0; v._castSlot=null; secs(0.6); };
  const L=lab(H,S(['sw_5_3']),{foes:2,allies:2}), {F,A}=L; sure(L); A[1].hp=A[1].maxHp*0.3; F[1].target=A[1]; F[0].target=A[0]; for(const f of F) f.stunned=0;
  launch(L,F[0]); assert.ok(F[1].stunned>0,'the prison goes to the enemy attacking her lowest-HP ally'); assert.ok(!(F[0].stunned>0),'not to her own target');
  for(const f of F){ f.stunned=0; f.target=null; } L.v.blueCd=0; launch(L,F[0]); assert.ok(F[0].stunned>0,'nobody attacks that ally: her own target');
  const P=lab(H,null,{foes:2,allies:2}); sure(P); P.A[1].hp=P.A[1].maxHp*0.3; P.F[1].target=P.A[1]; for(const f of P.F) f.stunned=0;
  launch(P,P.F[0]); assert.ok(P.F[0].stunned>0&&!(P.F[1].stunned>0),'without the talent: her own target, as before');
});

test('Sylthaine rulings / Winter Calm (the name; the talent unchanged)',()=>{ assert.equal(T.talent(H,'ws_3_3').name,'Winter Calm'); });
