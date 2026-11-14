'use strict';
/* Astra's talents as data on the mechanics layer (talents-mech/astra.js), group by group on the still field (tests/talents-lab.js), then whole fights.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured in a plain lab
   (or with her talents switched off for one hit) BEFORE the talented lab is built: lab() replaces the whole field.
   Places (metres from Astra): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12). Bodies: hers 1.56 m, theirs 2.01 m.
   Her three area skills strike where she aims (aim(): the engine's own aim point, as a player's aim or the densest-group pick writes it).
   Run: node --test tests/talents-mech-astra.test.js */
const test=require('node:test'),assert=require('node:assert/strict');
const {FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,accounting,determinism,snaps,spec}=require('./talents-lab.js');
const H='astra', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{t:0,idle:0},{n}); };
const sure=L=>{ for(const f of L.F) f.level=1; };                                   // her controls always land (no level-gap miss roll)
const aim=(L,x,y)=>{ L.v._aimWX=L.v.x+x*V.METER; L.v._aimWY=L.v.y+y*V.METER; };     // where her next area skill strikes, in metres from her
const cast=(L,slot,x,y)=>{ aim(L,x,y); try{ V.cast(L.v,slot); } finally{ L.v._aimWX=null; L.v._aimWY=null; } };
const losses=(L,fn)=>{ const h=L.F.map(f=>f.hp+(f.shield||0)); fn(); return L.F.map((f,i)=>h[i]-f.hp-(f.shield||0)); };
/* her unit stacks and marks, read as the runtime keeps them */
const heat=(L,t)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#heat']; return (m&&V.now()<m.until)?m.v:0; };
const heatUntil=(L,t)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#heat']; return m?m.until:null; };
const setHeat=(L,t,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#heat']={v:n,until:V.now()+4}; };
const markUntil=(L,t,name)=>{ const m=t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]; return m?m.until:null; };
const mine=(L,t,tag)=>t.dots.filter(d=>d._talO===L.v.uid&&(tag==null||d._talK===tag));
const tickOf=(t,d)=>{ const r=d.remaining; for(let i=0;i<80&&d.remaining===r&&t.dots.indexOf(d)>=0;i++) V.step(1); };   // step until that DoT ticks once
const left=d=>d.remaining-1+(d._talF!=null?d._talF:1);                              // ticks a DoT still has, a part tick counted as its part
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const still=L=>{ for(const f of L.F){ f.stunned=0; f.speed=0; } };                 // free of the lab's hold, but they do not walk
const moved=(L,u,x,y)=>Math.hypot(u.x-(L.v.x+x*V.METER),u.y-(L.v.y+y*V.METER))/V.METER;

test('Astra: every talent is accounted for - 9 plain stats, 108 with rows, 1 waiting for a ruling',()=>{
  accounting(H,[118,9,108,1,0]);
  const M=FXN.mech(H); for(const id of ['sb_1_4','hs_1_4','ss_1_3','sb_13_3','hs_13_3','ss_13_2']) assert.ok(M.talents[id],id);
  assert.ok(!FXN.has(H,'ss_12_1')&&M.talents.ss_12_1,'Night Breeze (move speed) is a row, not a plain stat');
});

test('Astra: her real kit, as the talents read it - Collapsing Star moves nobody, Stardust burns after every hit and stacks',()=>{
  plain({foes:3},P=>{ const {v,F}=P; sure(P); F.forEach(f=>{ f.stunned=0; f.speed=0; }); const x0=F.map(f=>[f.x,f.y]); cast(P,'ult',10,0);
    assert.ok(F.every(f=>f.pullT>0&&f.pulledBy),'the ultimate sets a drag on every enemy in its circle'); near(F[0].stunned,1.4,'its stun is the control table\'s area stun, 1.4 s'); secs(0.6);
    F.forEach((f,i)=>assert.equal(Math.hypot(f.x-x0[i][0],f.y-x0[i][1]),0,'but the drag moves nobody (it has no stopping distance)'));
    F.forEach(f=>{ f.dots.length=0; }); V.hit(v,F[0],10,{auto:true}); V.hit(v,F[0],10); V.hit(v,F[0],10);
    assert.equal(F[0].dots.length,3,'every hit of hers (basic attack or not) leaves its own Stardust burn: they stack'); assert.ok(F[0].dots.every(d=>d.interval===0.5&&d.remaining===4));
  });
});

test('Astra / Heat and Flares: Heat, Ignition Point, Hot Core, Chain Flare, Starwarmed, Flare Feed, Long Flare, Cinders Kept, Warmth Kept',()=>{
  const L=lab(H,S(['sb_1_4','sb_4_4','sb_2_4','sb_3_4','sb_n1','sb_6_4','sb_8_4','sb_n2','sb_5_4']),{foes:3}), {v,F}=L, f=F[0], ap=v.apow;
  V.hit(v,f,1,{auto:true}); const d=mine(L,f,'sd')[0]; assert.ok(d,'the Stardust burn is hers');
  const a=lost(f,()=>tickOf(f,d)); assert.equal(heat(L,f),1,'each tick of her burns: 1 Heat'); near(heatUntil(L,f)-V.now(),4+2,'Warmth Kept: it fades 4 + 0.4 x 5 s after the last one',1e-6);
  setHeat(L,f,9); setHeat(L,F[1],0); v.hp=v.maxHp*0.5; const h0=v.hp; v.energy=0; const f1=F[1].hp;
  const b=lost(f,()=>tickOf(f,d)), fl=ap*0.10*5*1.15;
  near(b-a,fl,'at 10 Heat it Flares: 10% x 5 of her ability power, Ignition Point 3% x 5 more'); assert.equal(heat(L,f),0,'and its Heat resets');
  near(f1-F[1].hp,fl*0.90,'Hot Core: F1 (1.48 m away) takes 30% x 3 of it'); assert.equal(heat(L,F[1]),4,'Chain Flare: caught by another enemy\'s Flare: 4 Heat'); assert.equal(F[2].hp,F[2].maxHp,'F2 (7 m) is not caught');
  near(v.hp-h0,v.maxHp*0.01,'Starwarmed: 0.2% x 5 of her max HP'); near(v.energy,6,'Flare Feed: 2 x 3 energy');
  near(f.slowMul,1-0.18,'Long Flare: 6% x 3 slower'); near(F[1].slowMul,1-0.18,'the enemies it catches too'); assert.ok(f.slow>1.9&&f.slow<=2);
  /* Chain Flare sets off a chain: F1 at 6 is caught (+4) and Flares; its Flare catches F0 (already Flared in this chain: it gains Heat, no second Flare) and F2 */
  setHeat(L,f,9); setHeat(L,F[1],6); setHeat(L,F[2],0); const c1=F[1].hp, c2=F[2].hp; tickOf(f,d);
  assert.equal(heat(L,F[1]),0,'F1 Flared in turn'); near(c1-F[1].hp,fl*0.90+fl,'(caught by F0, then its own Flare)'); near(c2-F[2].hp,fl*0.90,'F2 caught by F1\'s Flare'); assert.equal(heat(L,F[2]),4); assert.equal(heat(L,f),4,'F0 caught back: Heat, not a second Flare');
  /* Cinders Kept: a Flare on an enemy below half health leaves it at 1 Heat x 5 */
  f.hp=f.maxHp*0.4; setHeat(L,f,9); tickOf(f,d); assert.equal(heat(L,f),5,'Cinders Kept');
  /* the burn runs out: no Heat comes, and 6 s after the last gain it is gone */
  for(let i=0;i<40&&f.dots.indexOf(d)>=0;i++) V.step(1); assert.ok(f.dots.indexOf(d)<0); secs(5.8); assert.ok(heat(L,f)>0); secs(0.3); assert.equal(heat(L,f),0,'Heat fades');
  const N=lab(H,S(['sb_1_4']),{foes:2}); V.hit(N.v,N.F[0],1,{auto:true}); const e=mine(N,N.F[0],'sd')[0]; tickOf(N.F[0],e); near(heatUntil(N,N.F[0])-V.now(),4,'without Warmth Kept: 4 s');
  setHeat(N,N.F[0],9); setHeat(N,N.F[1],0); tickOf(N.F[0],e); assert.equal(heat(N,N.F[1]),0,'without Chain Flare (and Hot Core) a Flare catches nobody');
});

test('Astra / Supernova: a Flare that kills Flares again on the spot, twice as wide',()=>{
  const L=lab(H,S(['sb_1_4','sb_8_4','sb_10_4']),{foes:6}), {v,F}=L, f=F[0], ap=v.apow; at(L,F[5],30,30);
  V.hit(v,f,1,{auto:true}); const d=mine(L,f,'sd')[0]; const fl=ap*0.10*5;
  const h=F.map(x=>x.hp); f.hp=fl*0.5; setHeat(L,f,9); tickOf(f,d); assert.ok(!f.alive,'the Flare killed F0');
  near(h[1]-F[1].hp,fl,'F1 (1.48 m): the Flare again'); near(h[3]-F[3].hp,fl,'F3 (3.48 m): inside 4 m'); near(h[4]-F[4].hp,fl,'F4 (2.07 m)'); assert.equal(F[2].hp,h[2],'F2 (7 m): outside'); assert.equal(F[5].hp,h[5]);
  near(F[3].slowMul,1-0.18,'the second Flare slows too (Long Flare)');
});

test('Astra / her burns: Bright Dust, Dust Storm, Long Glow, Catching Fire, Burning Starfire, Kindling Starfire',()=>{
  const O={foes:4}, pT=plain(O,P=>{ V.hit(P.v,P.F[0],1,{auto:true}); const d=P.F[0].dots[0]; return lost(P.F[0],()=>tickOf(P.F[0],d)); });
  const L=lab(H,S(['sb_2_3','sb_4_3','sb_12_1','sb_5_2','sb_7_3','sb_6_3','sb_1_4']),O), {v,F}=L, ap=v.apow;
  V.hit(v,F[0],1,{auto:true}); const d=mine(L,F[0],'sd')[0]; near(left(d),4+1.2+1.8,'Long Glow 0.2 x 3 s and Dust Storm 0.3 x 3 s longer: 2 s = 4 ticks becomes 7');
  const c=mine(L,F[1],'sd')[0]; assert.ok(c,'Catching Fire: the burn of a basic attack also catches the enemy nearest the target (F1)'); near(left(c),7,'a copy of the same burn'); assert.ok(!mine(L,F[3],'sd').length);
  V.hit(v,F[2],1); assert.equal(mine(L,F[1],'sd').length,1,'a skill hit\'s burn is not caught'); assert.equal(mine(L,F[2],'sd').length,1);
  near(lost(F[0],()=>tickOf(F[0],d)),pT*1.20,'Bright Dust: each tick 4% x 5 stronger');
  /* Burning Starfire and Kindling Starfire: every enemy Starfire hits (F0 and F1 inside 2.8 m of the burst) */
  F.forEach(x=>{ x._talM=null; x.dots.length=0; }); cast(L,'green',7.25,0); const bs=mine(L,F[0],'bs')[0]; assert.ok(bs&&mine(L,F[1],'bs').length===1&&!mine(L,F[2],'bs').length);
  near(bs.dps,0.15*ap,'a burn of 0.15 x her ability power every 0.5 s'); near(left(bs),4+1.2,'for 2 s, Long Glow 0.6 s longer'); assert.equal(heat(L,F[0]),3,'Kindling Starfire: 1 Heat x 3 (and Burning Starfire does not change the Stardust it also leaves)');
  F[0].dots.splice(0,F[0].dots.length,bs); near(lost(F[0],()=>tickOf(F[0],bs)),0.15*ap,'each tick as stated (a talent burn: no resist)',1e-6);
  const N=lab(H,S(['sb_4_3']),O); V.hit(N.v,N.F[0],1,{auto:true}); near(left(mine(N,N.F[0],'sd')[0]),4+1.8,'Dust Storm alone: a part tick at the end (5.8 ticks)'); assert.ok(!mine(N,N.F[1],'sd').length,'without Catching Fire no copy');
});

test('Astra / burning enemies: Searing, Bright Ledger, Heat Mirage, Fever, Starlight',()=>{
  const L=lab(H,S(['sb_7_4','sb_9_3','sb_10_2','sb_11_4','sb_1_2','sb_1_4']),{foes:3,allies:1,big:true,cold:true}), {v,F,A}=L, T0=L.T; const ap0=v.apow, ai=F[0].atkInterval; V.step(1);
  const bA=plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000))), bV=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000))), bIn=plainHit(L,()=>lost(v,()=>V.hit(F[1],v,1000)));
  F.forEach(x=>{ x.dots.length=0; });
  near(lost(F[0],()=>V.hit(A[0],F[0],1000)),bA,'not burning: no Bright Ledger'); V.hit(v,F[1],1);
  V.hit(v,F[0],1); assert.ok(mine(L,F[0]).length,'her Stardust: F0 is burning (F1 too)');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000)),bA*1.075,'Bright Ledger: a burning enemy takes 1.5% x 5 more from her team'); near(lost(F[0],()=>V.hit(v,F[0],1000)),bV*1.075,'her own hits too');
  near(lost(v,()=>V.hit(F[1],v,1000)),bIn*0.925,'Heat Mirage: she takes 1.5% x 5 less from a burning enemy'); near(lost(v,()=>V.hit(F[2],v,1000)),bIn,'not from one that is not burning');
  const h=F[0].hp; F[0].hp-=5000; F[0]._healCutUntil=0; V.heal(F[0],1000); near(F[0].hp-(h-5000),1000*(F[0].mortalT>0?0.5:1)*0.85,'Searing: a burning enemy heals 3% x 5 less');
  near(v.apow,ap0,'Starlight: nobody has 5 Heat yet'); setHeat(L,F[0],5); V.step(1); near(v.apow,ap0*1.05,'Starlight: an enemy with 5 Heat: 1% x 5 ability power');
  near(F[0].atkInterval,ai/(1-0.075),'Fever: 5 Heat, 0.3% x 5 slower for each'); near(F[2].atkInterval,ai,'no Heat: untouched');
  F[0]._talM=null; V.step(1); near(F[0].atkInterval,ai,'the Heat gone: back'); near(v.apow,ap0,'');
});

test('Astra / Nebula and the Haze: Haze, Thick Haze, Haze Bite, Carried Heat, Wide Nebula, Lingering Nebula, Settling Haze, Nebula Weight, Thickening',()=>{
  const O={foes:3}, pN=plain(O,P=>{ cast(P,'blue',4.5,0); const d=P.F[0].dots.find(x=>x.interval===1); return {dps:d.dps,rem:d.remaining}; });
  const L=lab(H,S(['sb_1_1','sb_3_1','sb_5_1','sb_n3','sb_1_4','sb_4_2','sb_6_1','sb_8_1','ss_7_2','ss_8_2']),O), {v,F}=L, f=F[0];
  cast(L,'blue',4.5,0); const z=L.T.s.zn.neb[0]; near(z.r/V.METER,3+0.6,'Wide Nebula: its circle 3 m + 0.2 x 3'); near(z.until-V.now(),4+1+0.9,'Lingering Nebula 0.2 x 5 and Thickening 0.3 x 3 s longer');
  const d=mine(L,f,'neb')[0]; assert.ok(d,'Nebula\'s burn is hers'); near(d.dps,pN.dps*1.15*1.15,'Settling Haze 5% x 3 and Nebula Weight 3% x 5 stronger'); near(left(d),4+1.9,'and it lasts as long as the circle');
  V.step(1); assert.ok(mark(L,f,'haze'),'F0 is in the Haze'); assert.ok(!mark(L,F[1],'haze'),'F1 (5.5 m from the centre) is not');
  /* Haze: her burns on it tick 10% x 3 faster: Nebula's 1 s ticks come every 1/1.3 s */
  const r0=d.remaining; secs(2.35); assert.equal(r0-d.remaining,3,'three ticks in 2.35 s (two without the Haze)');
  /* Thick Haze: it stays 0.3 x 5 s after she leaves; Carried Heat: then her Heat cannot fade for 1 x 3 s */
  at(L,f,4.5,20); V.step(2); assert.ok(mark(L,f,'haze'),'Thick Haze: still in the Haze after leaving'); secs(1.45); assert.ok(mark(L,f,'haze')); f.dots.length=0; setHeat(L,f,3); f._talM[L.v.uid]['#heat'].until=V.now()+0.3; secs(0.15); assert.ok(!mark(L,f,'haze'),'1.5 s later: out');
  assert.ok(heatUntil(L,f)-V.now()>2.85,'Carried Heat: as it leaves the Haze its Heat cannot fade for 1 x 3 s (it would have in 0.15 s)'); secs(2.7); assert.equal(heat(L,f),3); secs(0.3); assert.equal(heat(L,f),0,'then it fades');
  const M=lab(H,S(['sb_1_1']),O); cast(M,'blue',4.5,0); V.step(1); assert.ok(mark(M,M.F[0],'haze')); at(M,M.F[0],4.5,20); V.step(3); assert.ok(!mark(M,M.F[0],'haze'),'without Thick Haze the Haze ends as she leaves');
  const N=lab(H,S(['sb_5_1']),O); cast(N,'blue',4.5,0); V.step(1); assert.ok(!mark(N,N.F[0],'haze'),'without Haze there is no Haze to bite');
});

test('Astra / Haze Bite: her burns tick 2% x 5 harder on an enemy in the Haze',()=>{
  const O={foes:3}; const p=plain(O,P=>{ cast(P,'blue',4.5,0); const d=P.F[0].dots.find(x=>x.interval===1); return lost(P.F[0],()=>tickOf(P.F[0],d)); });
  const L=lab(H,S(['sb_1_1','sb_5_1']),O); cast(L,'blue',4.5,0); V.step(1); const d=mine(L,L.F[0],'neb')[0]; near(lost(L.F[0],()=>tickOf(L.F[0],d)),p*1.10,'in the Haze');
  at(L,L.F[0],4.5,30); V.step(3); near(lost(L.F[0],()=>tickOf(L.F[0],d)),p,'out of it');
});

test('Astra / Collapsing Star: Wider Horizon, Heavy Star, Collapsing Light, Heavy Sky, Wide Collapse, Heavier Collapse, Firm Hand, Great Mass, Burning Mass, Crushed Sparks, Deep Collapse',()=>{
  const O={foes:6}, pU=plain(O,P=>{ sure(P); at(P,P.F[3],10,10.5); return losses(P,()=>cast(P,'ult',10,0)); });   // F3 moved to 10.5 m from the centre
  assert.equal(pU[3],0,'(plain: 10.5 m is outside 8 m)');
  const L=lab(H,S(['sb_8_2','sb_7_2','hs_3_3','ss_7_3','hs_5_4','hs_4_3','ss_6_4','hs_9_3','sb_12_3','sb_11_3','sb_1_4','hs_8_3']),O), {v,F}=L; sure(L); still(L); at(L,F[3],10,10.5);
  V.hit(v,F[0],1); V.hit(v,F[1],1); V.hit(v,F[4],1); F[0].hp=F[0].maxHp*0.4;
  const k=1.15*1.15*1.15*0.85, u=losses(L,()=>cast(L,'ult',10,0));
  near(u[2],pU[2]*k*1.10*1.15,'Heavy Star, Collapsing Light, Heavy Sky 3% x 5 each; Wide Collapse 15% less; Great Mass 2% x 5 above half; Burning Mass 1% x 5 for each burning enemy it catches (3)');
  near(u[0],pU[0]*k*1.15,'F0 (below half): no Great Mass'); assert.ok(u[3]>0,'Wider Horizon 0.2 x 5 m and Wide Collapse 2 m: 11 m reaches 10.5 m');
  near(F[2].stunned,1.4+0.45+0.45,'Heavier Collapse and Firm Hand: 0.15 s x 3 longer each'); assert.equal(heat(L,F[2]),9,'Crushed Sparks: 3 Heat x 3 when it stuns');
  const b=plainHit(L,()=>lost(F[2],()=>V.hit(v,F[2],1000))); near(lost(F[2],()=>V.hit(v,F[2],1000)),b*1.10,'Deep Collapse: 2% x 5 more from her for 3 s'); secs(3.05); near(lost(F[2],()=>V.hit(v,F[2],1000)),b,'then not');
});

test('Astra / Haze Collapse, Every Star Burns (SIGNATURE)',()=>{
  const p=plain({foes:4},P=>{ sure(P); return losses(P,()=>cast(P,'ult',10,0)); });
  const L=lab(H,S(['sb_9_1','sb_1_1','sb_1_4','sb_13_3']),{foes:4}), {v,F}=L, ap=v.apow; sure(L); F[2].immovable=true; const h=F.map(x=>x.hp);
  setHeat(L,F[0],2); cast(L,'ult',10,0); const fl=ap*0.10*5, u=F.map((x,i)=>h[i]-x.hp);
  assert.ok(u[0]>p[0]&&u[1]>p[1],'every enemy it drags in Flares at once, whatever its Heat'); assert.equal(heat(L,F[0]),0);
  near(u[2],p[2],'an immovable enemy is not dragged in: no Flare'); near(u[1]-p[1],fl,'the Flare: 10% x 5 of her ability power');
  const z=L.T.s.zn.neb[0]; assert.ok(z,'Haze Collapse: a Nebula at its centre'); near(z.r/V.METER,3); near(z.until-V.now(),4); V.step(1); assert.ok(mark(L,F[1],'haze'),'F1 (at the centre) is in the Haze');
  assert.ok(L.T.s.zn.star[0],'its centre becomes a burning star'); F[1].dots.length=0; F[0].dots.length=0; setHeat(L,F[1],0); setHeat(L,F[0],0); secs(0.52); assert.equal(heat(L,F[1]),2,'2 Heat every 0.5 s within 3 m'); assert.equal(heat(L,F[0]),0,'F0 (3.5 m from the centre) is not on it');
  at(L,F[1],4.5,30); secs(5.2); assert.ok(!(L.T.s.zn.star[0].until>V.now()),'5 s'); at(L,F[1],10,0); setHeat(L,F[1],0); secs(1); assert.equal(heat(L,F[1]),0,'then it is gone');
});

test('Astra / the Held Star: Held Star, Brighter Coin, Coin Turn, Steady Coin, Kept Change, Bright Return, Spent Star, Let It Go, Hoard, Flip',()=>{
  const O={foes:3}, pS=plain(O,P=>losses(P,()=>cast(P,'green',7,0)));
  const L=lab(H,S(['hs_1_4','hs_2_4','hs_8_4','hs_12_4','hs_n3','hs_n2','hs_3_4','hs_10_3','hs_6_4','hs_9_4']),Object.assign({cold:true},O)), {v,F}=L; sure(L); V.step(1);
  near(stack(L,'light'),30,'Hoard: each wave starts with 6 x 5 Light'); setStack(L,'light',0);
  V.hit(v,F[2],1,{auto:true}); near(stack(L,'light'),(4+3)*1.3,'a basic attack: 4 Light, Steady Coin 1 x 3, Coin Turn 10% x 3 faster'); V.hit(v,F[2],1); near(stack(L,'light'),9.1,'a skill hit: no');
  setStack(L,'light',140); V.hit(v,F[2],1,{auto:true}); near(stack(L,'light'),145,'Brighter Coin: the star holds 100 + 15 x 3');
  v.energy=0; const s=losses(L,()=>cast(L,'green',7,0));
  near(s[0],pS[0]*(1+0.005*145),'Starfire spends all 145 Light: 0.1% x 5 more for each'); near(s[1],pS[1]*1.725,'');
  near(stack(L,'light'),145*0.3+13,'Kept Change: 10% x 3 stays; then the cast adds its 10 (x 1.3)'); near(v.energy,3,'Bright Return: 50 or more spent, 1 x 3 energy');
  F.forEach(x=>{ x.stunned=0; }); setStack(L,'light',100); cast(L,'green',7,0); near(F[0].stunned,0.8,'Spent Star: 100 or more spent: everything it hits is stunned 0.8 s'); assert.ok(!(F[2].stunned>0));
  F.forEach(x=>{ x.stunned=0; }); setStack(L,'light',90); v.energy=0; cast(L,'green',7,0); assert.ok(!(F[0].stunned>0),'90: no stun'); near(v.energy,3,'');
  setStack(L,'light',40); v.energy=0; cast(L,'green',7,0); near(v.energy,0,'40 spent: no energy');
  setStack(L,'light',0); cast(L,'ult',10,0); near(stack(L,'light'),(60+10)*1.3,'Let It Go: Collapsing Star adds 20 x 3 (and 10 as an ability)');
  /* Flip: below 40% the star fills at once, once a wave */
  setStack(L,'light',0); v.hp=v.maxHp*0.5; V.step(1); v.hp=v.maxHp*0.39; V.step(1); near(stack(L,'light'),145,'Flip'); setStack(L,'light',0); v.hp=v.maxHp*0.5; V.step(1); v.hp=v.maxHp*0.3; V.step(1); near(stack(L,'light'),0,'once a wave');
  V.wave(); V.step(1); near(stack(L,'light'),30,'(Hoard)'); v.hp=v.maxHp*0.5; V.step(1); v.hp=v.maxHp*0.3; V.step(1); near(stack(L,'light'),145,'a new wave: again');
});

test('Astra / Light held: Patient Coin, Midnight Coat, Weight of Light, Point by Point',()=>{
  const O={foes:3,big:true,cold:true}, pS=plain(O,P=>losses(P,()=>cast(P,'blue',4.5,0)));
  const L=lab(H,S(['hs_1_4','hs_11_4','hs_12_2','hs_12_3','hs_4_1','hs_1_1']),O), {v,F}=L, T0=L.T, ar=v.armorRating; V.step(1);
  const bIn=plainHit(L,()=>lost(v,()=>V.hit(F[1],v,1000,{kind:'true'})));
  setStack(L,'light',49); V.step(1); near(v.armorRating,ar,'49 Light: no Midnight Coat'); near(lost(v,()=>V.hit(F[1],v,1000,{kind:'true'})),bIn*(1-0.04),'Patient Coin: 0.2% x 5 less per 10 Light held (4 tens)');
  setStack(L,'light',50); V.step(1); near(v.armorRating,ar*1.09,'Midnight Coat: 50 Light, 3% x 3 armor');
  setStack(L,'light',100); near(lost(v,()=>V.hit(F[1],v,1000,{kind:'true'})),bIn*0.90,'100 Light: 10% less');
  const n=losses(L,()=>cast(L,'blue',4.5,0)); near(n[0],pS[0]*1.10,'Weight of Light: cast with the star full, the ability deals 2% x 5 more'); setStack(L,'light',99); near(losses(L,()=>cast(L,'blue',4.5,0))[0],pS[0],'not full: no');
  setStack(L,'light',0); cast(L,'green',4.5,0); assert.ok(mark(L,F[0],'pt')); V.dmg(F[0],2e9); near(stack(L,'light'),10+40,'Point by Point: a Point dies: 8 x 5 Light (after the cast\'s 10)');
});

test('Astra / Points: Points, Long Points, Star Chart, Marked Points, Fixed Stars, Pinned Points, Tight Nova, Crowded Sky, Focused Starfire, Open Hand, Wide Orbit',()=>{
  const O={foes:6}, pS=plain(O,P=>{ at(P,P.F[5],30,30); return losses(P,()=>cast(P,'green',7,0)); }), pA=plain(O,P=>lost(P.F[2],()=>V.hit(P.v,P.F[2],1000,{auto:true})));
  const L=lab(H,S(['hs_1_1','hs_2_1','hs_6_1','hs_8_1','hs_n1','hs_10_1','hs_4_2','hs_9_2','hs_2_2','hs_5_2','ss_6_1']),O), {v,F}=L; at(L,F[5],30,30); const sp=F.map(x=>x.speed);
  /* burst at (7,0): F0 and F1 are 2.5 m and 3 m from it (inside 2.8 + 0.5 + 0.5 = 3.8 m; F4, 6.2 m, is not); F0 is the enemy nearest its centre */
  const s=losses(L,()=>cast(L,'green',7,0)), k=1.15*1.10;   // Focused Starfire 3% x 5; Crowded Sky 2% x 5 for the one enemy past the first
  assert.ok(pS[1]===0,'(plain: F1, 3 m from the burst, is outside 2.8 m)'); near(s[0],pS[0]*k*1.18,'Tight Nova: the enemy nearest its centre takes 6% x 3 more'); assert.ok(s[1]>0,'Open Hand and Wide Orbit: 0.1 m x 5 each wider');
  near(s[1],s[0]/1.18,'F1: the same but no Tight Nova'); assert.ok(mark(L,F[0],'pt')&&mark(L,F[1],'pt'),'each enemy Starfire hits becomes a Point'); near(markUntil(L,F[0],'pt')-V.now(),6+3,'Long Points: 6 + 1 x 3 s');
  V.step(1); near(F[0].speed,sp[0]*0.88,'Pinned Points: Points move 4% x 3 slower'); near(F[2].speed,sp[2],'');
  const s2=losses(L,()=>cast(L,'green',7,0)); near(s2[0],s[0]*1.10*1.04*1.12,'a Point: 2% x 5 more from her, Fixed Stars 4% (already a Point), Marked Points 4% x 3 from Starfire');
  const a0=lost(F[2],()=>V.hit(v,F[2],1000,{auto:true})); near(a0,pA,'not a Point: plain');
  cast(L,'green',15.5,0); const a1=lost(F[2],()=>V.hit(v,F[2],1000,{auto:true})); near(a1,pA*1.10*1.24,'Star Chart: her basic attacks deal 8% x 3 more to Points (and 2% x 5)');
  at(L,F[3],7,1); at(L,F[4],7,-1); cast(L,'green',7,0); const pts=F.filter(x=>mark(L,x,'pt')); assert.equal(pts.length,3,'at most 3 Points on the field: '+pts.length); assert.ok(!mark(L,F[2],'pt'),'a new Point pushes out the oldest');
  const P0=plain({foes:6},P=>{ at(P,P.F[3],7,1); at(P,P.F[4],7,-1); at(P,P.F[5],7,2); return losses(P,()=>cast(P,'green',7,0)); }); const N=lab(H,S(['hs_9_2']),{foes:6}); at(N,N.F[3],7,1); at(N,N.F[4],7,-1); at(N,N.F[5],7,2);
  const c=losses(N,()=>cast(N,'green',7,0)); near(c[3],P0[3]*1.30,'Crowded Sky: 5 enemies hit: 2% x 5 for 3 past the first (it stops at 4)'); });

test('Astra / Fixed Stars with Recorded: the first enemy each Starfire newly marks as a Point is Recorded where it stands for 2 s',()=>{
  const L=lab(H,S(['hs_1_1','hs_n1','ss_1_3']),{foes:3}), {v,F}=L; F.forEach(x=>{ x._talM=null; });
  cast(L,'green',7,0); const r=F.filter(x=>mark(L,x,'recX')); assert.equal(r.length,1,'one, once per cast'); near(markUntil(L,r[0],'recX')-V.now(),2); const y0=r[0].y;
  r[0].y-=5*V.METER; const b=plainHit(L,()=>lost(r[0],()=>V.hit(v,r[0],1000))); near(lost(r[0],()=>V.hit(v,r[0],1000)),b*1.15*1.10,'5 m from that place it is Out of Place (Recorded 3% x 5; Points 2% x 5)'); r[0].y=y0;
  cast(L,'green',7,0); assert.equal(F.filter(x=>mark(L,x,'recX')).length,1,'an enemy that was already a Point does not count');
  const N=lab(H,S(['hs_1_1','hs_n1']),{foes:3}); cast(N,'green',7,0); assert.ok(!N.F.some(x=>mark(N,x,'recX')),'without Recorded: no');
});

test('Astra / Twin Starfire and Three Lights',()=>{
  const O={foes:6}, pS=plain(O,P=>{ at(P,P.F[5],30,30); return losses(P,()=>cast(P,'green',7,0)); });
  const L=lab(H,S(['hs_7_2']),O), {v,F}=L; at(L,F[5],30,30); const s=losses(L,()=>cast(L,'green',7,0)); near(s[0],pS[0],'the first burst as always');
  at(L,F[0],4.5,-20); at(L,F[1],7,0.5); const h=F.map(x=>x.hp); secs(0.45); assert.equal(F[1].hp,h[1],'not yet'); secs(0.1);
  near(h[1]-F[1].hp,pS[0]*0.5,'0.5 s later it bursts again on the same spot at half damage (magic resist as for the first): F1, walked into it since, is caught'); assert.ok(h[0]-F[0].hp<pS[0]*0.5,'F0, gone from the spot, is not'); assert.equal(F[2].hp,h[2]);
  const M=lab(H,S(['hs_1_1','hs_10_1','hs_11_1']),O); const G=M.F; at(M,G[5],30,30);
  cast(M,'green',4.5,0); cast(M,'green',15.5,0); at(M,G[3],12,10); at(M,G[4],12,-10); cast(M,'green',12,10); assert.equal(G.filter(x=>mark(M,x,'pt')).length,3,'3 Points');
  const k=losses(M,()=>cast(M,'green',12,-10));
  near(k[0],k[4],'Three Lights: the next Starfire also bursts on each of the 3 Points (F0, F2, F3), far from its own burst (F4): as hard as Starfire itself'); near(k[2],k[4]); near(k[3],k[4]); assert.equal(k[1],0,'F1 is not within 2.8 m of any of them');
  V.dmg(G[3],2e9); const k2=losses(M,()=>cast(M,'green',30,-30)); assert.ok(k2.every(x=>x===0),'2 Points left at the cast: no bursts');
});

test('Astra / Imploding Star, Wide Collapse, Letting Go (SIGNATURE)',()=>{
  const O={foes:4}, pU=plain(O,P=>{ sure(P); return losses(P,()=>cast(P,'ult',10,0)); });
  const L=lab(H,S(['hs_1_4','hs_5_3','hs_n3','hs_1_1','hs_13_3']),O), {v,F}=L, ap=v.apow; sure(L);
  setStack(L,'light',60); const u=losses(L,()=>cast(L,'ult',10,0)); near(u[1],pU[1]*1.18,'Imploding Star: it spends all 60 Light: 0.3% more for each'); near(stack(L,'light'),60*0.3+10,'Kept Change keeps 10% x 3; then 10 as an ability');
  secs(1); F.forEach(x=>{ x.stunned=0; x.speed=0; }); setStack(L,'light',100); const h=F.map(x=>x.hp); cast(L,'ult',10,0); const st=F.map(x=>x.stunned); const h2=F.map(x=>x.hp), t0=V.now();
  near(h[1]-h2[1],pU[1]*1.30,'cast with 100 Light: Letting Go (Imploding Star still counts the 100)'); secs(0.25); assert.ok(F[1].hp===h2[1],'the star has not fallen yet');
  secs(0.1); near(h2[1]-F[1].hp,2.5*ap,'after the drag it falls on the centre: 2.5 x her ability power to every enemy within 4 m'); near(h2[0]-F[0].hp,2.5*ap,'F0 (its body 3.49 m from the centre)'); near(h2[2]-F[2].hp,2.5*ap,'F2 too'); assert.equal(F[3].hp,h2[3],'F3 (outside the ultimate)');
  near(F[1].stunned,st[1]-(V.now()-t0)+1,'stunning them 1 s longer',1e-6); assert.ok(mark(L,F[1],'pt')&&mark(L,F[0],'pt'),'every enemy it hits becomes a Point');
  near(stack(L,'light'),30+10,'the Light is spent (Kept Change: 10% x 3 stays)');
});

test('Astra / damage, defence and cooldowns: Sharp Light, Glass Sky, Distant Observer, Star Calm, Night Breeze, Quick Spark, Quick Starfire, Clear Night, Night Patience, Steady Count, Patient Ledger',()=>{
  const L=lab(H,S(['hs_1_3','hs_7_1','ss_10_1','ss_5_4','ss_12_1','sb_2_2','hs_6_2','sb_9_2','hs_10_2','ss_9_4','ss_4_4']),{foes:9,big:true,cold:true}), {v,F}=L, T0=L.T, sp=v.speed; V.step(1);
  near(v.speed,sp*1.09,'Night Breeze: 3% x 3 faster');
  const g=1-0.05, c=(x,slot)=>{ let y=x*g; if(slot==='green'){ y-=0.9; y-=0.9; } y*=g; if(slot==='blue') y-=1.5; y*=g; return y; };
  near(FX.cd(v,'green',7),c(7,'green'),'Starfire: Night Patience 1% x 5, Quick Starfire and Quick Spark 0.3 s x 3 each, Clear Night and Steady Count 1% x 5 each (talent-id order)'); near(FX.cd(v,'blue',9),c(9,'blue'),'Nebula: 5% three times and Patient Ledger 0.5 s x 3');
  const f=F[0]; const sv=f.mrRating; v._tal=undefined; const sk=lost(f,()=>V.hit(v,f,1000)); f.mrRating=sv*0.91; const cut=lost(f,()=>V.hit(v,f,1000)); f.mrRating=sv; const au=lost(f,()=>V.hit(v,f,1000,{auto:true}));
  const melee=lost(v,()=>V.hit(F[0],v,1000)); F[1].melee=false; const ranged=lost(v,()=>V.hit(F[1],v,1000)); const far=lost(v,()=>V.hit(F[8],v,1000)); v._tal=T0;
  near(lost(f,()=>V.hit(v,f,1000)),cut*1.125,'Sharp Light: her abilities ignore 3% x 3 of the magic resist; Glass Sky 2.5% x 5 more'); near(lost(f,()=>V.hit(v,f,1000,{auto:true})),au,'basic attacks: neither'); assert.ok(sk<cut);
  near(lost(v,()=>V.hit(F[1],v,1000)),ranged*1.10,'Glass Sky: 2% x 5 more from ranged enemies'); near(lost(v,()=>V.hit(F[0],v,1000)),melee,'not from melee');
  near(lost(v,()=>V.hit(F[8],v,1000)),far*0.91,'Distant Observer: 3% x 3 less from enemies more than 8 m away (F8: 14.4 m between bodies)');
  v.stunned=0; let ok=false; for(let i=0;i<30&&!ok;i++){ v.stunned=0; ok=V.cc(F[1],v,'stunned',2); } near(v.stunned,2*V.ccNerf*0.80,'Star Calm: control on her 4% x 5 shorter');
});

test('Astra / Orbit: Orbit, Tight Orbit, Orbit Weight, Bound to Orbit, Captured, Star Gravity',()=>{
  const O={foes:3,allies:1,big:true};
  const L=lab(H,S(['ss_1_1','ss_2_1','ss_3_1','ss_4_1','ss_9_1','ss_11_2']),O), {v,F,A}=L, T0=L.T;
  const bA=plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000))), bOut=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000))), bAl=plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000)));
  at(L,F[1],10,20); cast(L,'green',6.5,0); assert.ok(mark(L,F[0],'orbit'),'every enemy Starfire hits is in its Orbit'); near(markUntil(L,F[0],'orbit')-V.now(),3+1.5,'Tight Orbit: 3 + 0.5 x 3 s');
  secs(1.0); near(moved(L,F[0],4.5,0),1.0,'drifting 0.2 m x 5 each second toward where it burst',0.05); assert.ok(F[0].x>L.v.x+4.5*V.METER,'toward the burst');
  near(F[0].slowMul,0.85,'Captured: slowed 3% x 5'); near(lost(F[0],()=>V.hit(A[0],F[0],1000)),bA*1.10,'Bound to Orbit: 2% x 5 more from her team'); near(lost(v,()=>V.hit(F[0],v,1000)),bOut*0.925,'Orbit Weight: it deals 1.5% x 5 less, to her');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000)),bAl*0.925,'and to her allies'); secs(1.2); near(moved(L,F[0],4.5,0),2.0,'it stops at the spot (2 m)',0.05);
  secs(2.5); assert.ok(!mark(L,F[0],'orbit')); V.step(2); near(lost(F[0],()=>V.hit(A[0],F[0],1000)),bA,'Orbit over'); assert.ok(!(F[0].slow>0.05));
  /* Star Gravity: enemies Collapsing Star drags in stay in Orbit around its centre for 0.4 x 5 s (drifting at Orbit's speed); an immovable one is not dragged */
  sure(L); F[2].immovable=true; F.forEach(x=>{ x._talM=null; }); at(L,F[0],4.5,0); at(L,F[1],7,7); at(L,F[2],7,-6); cast(L,'ult',7,0); near(markUntil(L,F[1],'orbit')-V.now(),2,'Star Gravity: 0.4 s x 5'); assert.ok(!mark(L,F[2],'orbit'),'an immovable enemy is not dragged in');
  secs(1.0); near(moved(L,F[1],7,7),1.0,"F1 drifts toward the centre at Orbit's speed",0.05); assert.ok(F[1].y<L.v.y+7*V.METER); near(moved(L,F[2],7,-6),0,'',1e-9);
});

test('Astra / Recorded: Recorded, Second Entry, Mark Kept, Four Degrees, Moved Star, Out of Turn, Old Sky, Many Wrong, Ink and Starlight',()=>{
  const O={foes:9,allies:1,big:true};
  const L=lab(H,S(['ss_1_3','ss_5_3','ss_8_3','ss_2_3','ss_3_3','ss_6_3','ss_10_3','ss_12_4','ss_10_4']),O), {v,F,A}=L, T0=L.T;
  const rec=F.filter(x=>mark(L,x,'rec')); assert.equal(rec.length,3+5,'at the wave\'s start she records the 3 nearest, Second Entry 1 x 5 more'); assert.ok(!mark(L,F[8],'rec'),'the farthest is not recorded');
  const bOut=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000))), bAl=plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000))), bIn=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000))), bIA=plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000)));
  F[0].y-=2.4*V.METER; V.step(1); near(lost(F[0],()=>V.hit(v,F[0],1000)),bOut,'2.4 m from its mark: not yet Out of Place');
  F[0].y-=0.2*V.METER; V.step(1); near(lost(F[0],()=>V.hit(v,F[0],1000)),bOut*1.15,'Four Degrees: 2.6 m is more than 4 - 0.5 x 3 m: Out of Place, she deals 3% x 5 more');
  near(F[0].slowMul,0.80,'Moved Star: slowed 20%'); near(lost(F[0],()=>V.hit(A[0],F[0],1000)),bAl*1.09,'Out of Turn: 3% x 3 more from her allies');
  near(lost(v,()=>V.hit(F[0],v,1000)),bIn*0.925*0.95,'Old Sky: it deals 1.5% x 5 less; Many Wrong: she takes 1% x 5 less per Out of Place enemy'); near(lost(A[0],()=>V.hit(F[0],A[0],1000)),bIA*0.925,'Old Sky: to her allies too');
  F[1].y-=3*V.METER; F[2].y-=3*V.METER; F[6].y+=3*V.METER; V.step(1); near(lost(v,()=>V.hit(F[0],v,1000)),bIn*0.925*0.85,'Many Wrong: 4 Out of Place: only 3 count');
  v.hp=v.maxHp*0.5; const h=v.hp; V.dmg(F[2],2e9); near(v.hp-h,v.maxHp*0.03,'Ink and Starlight: an Out of Place enemy dies: 1% x 3 of her max HP'); V.dmg(F[5],2e9); near(v.hp-h,v.maxHp*0.03,'one in place: no');
  secs(9-0.1); assert.ok(F[0].slowMul<0.9,'Mark Kept: the marks hold 6 + 1 x 3 s'); secs(0.2); V.step(1); near(lost(F[0],()=>V.hit(v,F[0],1000)),bOut,'she records again where they stand now: back in place');
});

test('Astra / Back Where It Was: an enemy that becomes Out of Place is pulled 0.5 m x 3 back toward its mark',()=>{
  const L=lab(H,S(['ss_1_3','ss_11_3']),{foes:3}), {v,F}=L; assert.ok(mark(L,F[0],'rec')); const y0=F[0].y, off=()=>(y0-F[0].y)/V.METER;
  F[0].y-=6*V.METER; V.step(1); secs(0.4); near(off(),6-1.5,'pulled 1.5 m back',1e-3); secs(1); near(off(),4.5,'once (it is still Out of Place: no second pull)',1e-3);
  F[0].y=y0; V.step(1); F[0].y-=6*V.METER; V.step(1); secs(0.4); near(off(),4.5,'becoming Out of Place again: again',1e-3);
  F[0].immovable=true; F[0].y=y0; V.step(1); F[0].y-=6*V.METER; V.step(1); secs(0.4); near(off(),6,'an immovable enemy is not moved',1e-3);
});

test('Astra / inside Nebula: Clinging Nebula, Dense Nebula, Dark Nebula, Bright Nebula, Star Nursery',()=>{
  const L=lab(H,S(['ss_3_2','ss_4_2','ss_5_2','ss_9_2']),{foes:3}), {v,F}=L; sure(L); const sp=F.map(x=>x.speed), ai=F[0].atkInterval;
  cast(L,'blue',5.5,0); V.step(1); near(F[0].speed,0,'Dark Nebula: enemies inside cannot walk for its first 1.5 s'); near(F[0].atkInterval,ai/0.91,'Dense Nebula: they attack 3% x 3 slower'); near(F[1].speed,sp[1],'F1 (4.5 m from the centre) is outside');
  secs(1.5); near(F[0].speed,sp[0]*0.90,'then they can: Clinging Nebula: 2% x 5 slower'); F[0].stunned=0; at(L,F[0],7.5,0);
  secs(2.5); assert.ok(F[0].stunned>0.4&&F[0].stunned<=0.5,'Star Nursery: when Nebula ends, every enemy still inside is stunned 0.5 s'); secs(0.35); near(moved(L,F[0],5.5,0),0,'and dragged to its centre',0.05);
  near(F[0].speed,sp[0],'and the slow is over'); near(F[0].atkInterval,ai);
  const B=lab(H,S(['ss_5_1','ss_3_2']),{foes:3}), sp0=B.F[0].speed; cast(B,'blue',4.5,0); const z=B.T.s.zn.neb[0]; assert.ok(z.f===B.F[0],'Bright Nebula: it follows the enemy at its centre'); at(B,B.F[0],4.5,20); V.step(1);
  near(B.F[0].speed,sp0*0.90,'still inside as it walks (Clinging Nebula)'); near(z.y,B.F[0].y,'');
});

test('Astra / Rewritten Sky, Hushed Sky, Watcher\'s Calm',()=>{
  const L=lab(H,S(['ss_1_3','ss_7_4','ss_12_2','ss_11_1']),{foes:4}), {v,F}=L; sure(L); still(L); F[2].immovable=true; F.forEach(x=>{ x._talM=null; }); const T0=L.T;
  cast(L,'ult',10,0); assert.ok(mark(L,F[0],'recX')&&mark(L,F[1],'recX'),'Rewritten Sky: every enemy it drags in is Recorded at its centre');
  const b=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000))), b0=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000)));
  near(lost(F[0],()=>V.hit(v,F[0],1000)),b0*1.15,'F0 is 5.5 m from that centre: Out of Place (3% x 5)'); near(lost(F[1],()=>V.hit(v,F[1],1000)),b,'F1 stands on it');
  near(F[0].silencedT,0.9,'Hushed Sky: the drag silences 0.3 x 3 s'); assert.ok(!(F[2].silencedT>0),'not an enemy it cannot drag');
  assert.ok(mark(L,F[2],'recX'),'Watcher\'s Calm: the immovable enemy is Recorded instead'); near(markUntil(L,F[2],'recX')-V.now(),6); const b2=plainHit(L,()=>lost(F[2],()=>V.hit(v,F[2],1000))); near(lost(F[2],()=>V.hit(v,F[2],1000)),b2*1.15,'and counts as Out of Place, standing where it stands');
  secs(6.1); near(lost(F[2],()=>V.hit(v,F[2],1000)),b2,'for 2 x 3 s'); F[2]._talM=null; cast(L,'ult',10,0); assert.ok(!mark(L,F[2],'recX'),'once per enemy every 12 s'); secs(6); cast(L,'ult',10,0); assert.ok(mark(L,F[2],'recX'),'12 s later again');
});

test('Astra / The Second Sky (SIGNATURE)',()=>{
  const L=lab(H,S(['ss_13_2']),{foes:3}), {v,F}=L; sure(L); cast(L,'ult',10,0); still(L); const p=F.map(x=>[x.x,x.y]);
  assert.ok(F.every(x=>mark(L,x,'sky')),'every enemy on the field is Recorded where it stands'); near(markUntil(L,F[0],'sky')-V.now(),8);
  F[0].y-=1.9*V.METER; V.step(1); assert.ok(!(F[0].stunned>0),'1.9 m: nothing'); F[0].y-=0.2*V.METER; V.step(1); near(F[0].stunned,0.6,'more than 2 m: stunned 0.6 s');
  secs(0.4); near(Math.hypot(F[0].x-p[0][0],F[0].y-p[0][1])/V.METER,0,'and dragged back to its mark',1e-3);
  F[0].stunned=0; F[0].y-=3*V.METER; V.step(1); near(F[0].stunned,0.6,'a second time'); secs(0.4); F[0].stunned=0; F[0].y-=3*V.METER; V.step(1); assert.ok(!(F[0].stunned>0),'up to 2 times');
  F[1].immovable=true; F[1].y-=3*V.METER; V.step(1); near(F[1].stunned,0.6,'an immovable enemy is stunned'); secs(0.4); near(moved(L,F[1],10,-3),0,'but stays',1e-9); secs(8); F[2].y-=3*V.METER; V.step(1); assert.ok(!(F[2].stunned>0),'after 8 s: no more');
});

test('Astra: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['sb_1_4','sb_1_1','hs_1_1','hs_1_4','ss_1_1','ss_1_3','sb_6_3']), TEAM=['vael','sylthaine','vireo','vex','astra'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let ht=0, light=0, pt=false, orbit=false, rec=false, haze=false, neb=false;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s, foes=U.filter(u=>u.team==='enemy'); light=Math.max(light,T0.k.light?T0.k.light.n:0); neb=neb||!!(T0.zn.neb&&T0.zn.neb.length);
    for(const f of foes){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; const on=n=>!!(o[n]&&(o[n].until==null||o[n].until>V.now())); ht=Math.max(ht,o['#heat']&&o['#heat'].until>V.now()?o['#heat'].v:0); pt=pt||on('pt'); orbit=orbit||on('orbit'); rec=rec||on('rec'); haze=haze||on('haze'); } }
  assert.ok(ht>=2,'her real burns built Heat: '+ht); assert.ok(light>=10,'the Held Star filled: '+light); assert.ok(pt,'a real Starfire made Points'); assert.ok(orbit,'and caught enemies in Orbit');
  assert.ok(rec,'she Recorded enemies'); assert.ok(neb,'a real Nebula went down'); assert.ok(haze,'and held enemies in the Haze');
  determinism(H,TEAM);
});
