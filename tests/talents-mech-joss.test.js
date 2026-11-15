'use strict';
/* Joss Gatley's talents as data on the mechanics layer (talents-mech/joss.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity with him in the line-up, and Phil's 95% damage-reduction ceiling (worst hit, sustained, the share of a fight at 85% or more).
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Joss, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5).
   Lab units are HELD (stunned 1e6), Joss too; go() lets him think with nothing ready. Lab skill level 10. Run: node --test tests/talents-mech-joss.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='joss', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
VMX('var __jossDJ=function(u){ u._castSlot="ult"; u._castLv=(u.skillLv&&u.skillLv[0])||1; u._castSM=skillMul(u._castLv); try{ doEffect(u,"sunburst",Object.assign({},ULT_DEF.sunburst,HERO_ULT_ART.joss,{_arrived:true,_tgtU:u.target})); } finally{ u._castSM=1; u._castLv=0; } }');
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const setMk=(L,t,name,dur)=>{ const m=t._talM||(t._talM={}), o=m[L.v.uid]||(m[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const promise=(L,a)=>{ setMk(L,a,'jPro',1e9); L.T.s.m.jPro=a; };
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on him (true damage unless said)
const hitAl=(L,a,amt,o)=>lost(a,()=>V.hit((o&&o.src)||L.F[0],a,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on an ally
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const autoOn=(L,t,n,o)=>{ for(let i=0;i<(n||1);i++) V.hit(L.v,t,10,Object.assign({kind:'true',auto:true},o||{})); };
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; };
const free=L=>{ for(const f of L.F){ f.stunned=0; f.fearT=0; f.level=1; f.ctrlRes=0; } };
const hold=L=>{ for(const f of L.F){ f.stunned=1e6; f.fearT=0; } };
const top=(L,f)=>{ for(const x of L.F) x.dmg=10; f.dmg=1000; };                                    // Radiant Hammer goes to the enemy with the highest attack
const castRH=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castSG=L=>V.cast(L.v,'blue',L.v);
const castDJ=L=>VMX('__jossDJ')(L.v);
const rh=(L,t)=>{ const h=t.hp; castRH(L,t); return h-t.hp; };
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };
const api=L=>L.T.s.api;
const clk=L=>{ for(const r of (L.T.on.tick||[])) if(r.period&&L.T.s.lim[r.key]) L.T.s.lim[r.key].acc=0; };
const sm10=()=>VMX('skillMul(10)');
const auOf=(L,x)=>L.T.s.au.find(e=>e.x===x);

test('Joss: every talent is accounted for - 10 plain stats, 111 with rows, none waiting; no other game\'s names',()=>{
  accounting(H,[121,10,111,0,0]);
  const M=FXN.mech(H); for(const id of ['hm_1_1','pr_1_1','ra_1_1','hm_13_2','pr_13_3','ra_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['hm_3_3','hm_8_3','hm_1_3','pr_2_2','pr_8_2','pr_3_2','ra_2_3','ra_3_3','ra_1_3','ra_11_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.equal(T.talent(H,'ra_10_1').name,'Early Swing'); assert.equal(T.talent(H,'ra_5_2').name,'The Last Ruling'); assert.equal(T.talent(H,'ra_11_2').name,'Morning of Judgment');
  assert.ok(/0\.5% critical chance/.test(T.talent(H,'ra_3_3').text),'Holy Edge 0.5% a rank (with Light in the Hand at most 5%)');
});

test('Joss: his real kit, as the talents read it - Radiant Hammer\'s victim, crush and hidden stun, Sanctuary Guard\'s choice and hold, Unbroken Dawn, Daybreak Judgment',()=>{
  plain({foes:4,allies:2,big:true},P=>{ const {v,F,A}=P; free(P); top(P,F[1]);
    const h0=F[0].hp, h1=F[1].hp; castRH(P,F[0]); assert.equal(F[0].hp,h0,'Radiant Hammer does not strike his target'); assert.ok(F[1].hp<h1,'it strikes the enemy with the highest attack');
    near(F[1]._atkDnPct,0.35,'its attack is crushed 35%'); near(F[1]._atkDnT,5,'for 5 s'); near(F[1].stunned,2.45,'and it is stunned 2.45 s (the single-target table 3.5 s x 0.7), though the card names no stun',1e-9);
    A[1].hp=A[1].maxHp*0.5; castSG(P); const sh=(v.apow||0)*1.9*sm10(); near(A[1].shield,sh,'Sanctuary Guard: the ally with the lowest HP share, a shield of his ability power x 1.9 x skill level'); near(A[1]._wardT,5,'and the 1 HP hold, 5 s');
    const jh=v.hp, js=v.shield||0; V.hit(F[0],A[1],1000,{kind:'true'}); assert.equal(v.hp,jh,'it intercepts nothing: a hit on that ally does not reach Joss'); assert.equal(v.shield||0,js,'');
    A[1].hp=A[1].maxHp; v.maxHp=1e6; v.hp=2e5; castSG(P); near(v._wardT,5,'his own HP share the lowest: he shields himself');
    v.hp=2.9e5; v.shield=0; go(P); V.step(1); near(v.shield,1e6*0.30*(v.passMul||1),'Unbroken Dawn below 30% HP: a shield of 30% of his max HP x his passive\'s strength',1e-6); near(v.ctrlRes,0.40,'and 40% control resist');
    v.hp=1e5; v.shield=0; V.step(2); near(v.shield||0,0,'once per battle');
    v.stunned=1e6; free(P); at(P,F[2],0,5.9); at(P,F[3],0,6.2); const hs=F.map(f=>f.hp); A[0].hp=A[0].maxHp*0.5; const ah=A[0].hp; castDJ(P);
    assert.ok(F[0].hp<hs[0]&&F[2].hp<hs[2],'Daybreak Judgment strikes every enemy whose centre is within 6 m of his'); assert.equal(F[3].hp,hs[3],'not one 6.2 m away');
    near(F[0].stunned,1.4,'and stuns it 1.4 s (HERO_ULT_ART\'s 1.2 is replaced by the area table 2.0 s x 0.7)',1e-9); assert.ok(A[0].hp>ah,'it heals the allies within 6 m'); hold(P); });
});

/* ============================== HOLD UNTIL MORNING ============================== */
test('Joss / Dawnlight: Light Before Dawn, Brightening, Early Light, Grey Light, Pale Sky, Dawn Hammer',()=>{
  const L=lab(H,S(['hm_1_1','hm_2_1','hm_6_4','hm_4_1','hm_8_1','hm_10_1']),{foes:3,big:true,cold:true}), {v,F}=L; V.step(1); L.T=v._tal;
  assert.equal(stack(L,'jDawn'),8,'Early Light: each fight starts with 4 x 2 Dawnlight'); v.maxHp=1e6; v.hp=1e6;
  ccOn(v,F[0],'stunned',1); assert.equal(stack(L,'jDawn'),12,'each enemy he stuns: 1 + Brightening 1 x 3'); hitOn(L,10); assert.equal(stack(L,'jDawn'),12,'a hit above 50% HP: nothing');
  v.hp=4e5; const h=v.hp; hitOn(L,10); assert.equal(stack(L,'jDawn'),13,'a hit he survives below 50% HP: 1'); near(v.hp-(h-10*(1-0.001*5*12)),1e6*0.002*5,'Pale Sky: each gain heals 0.2% x 5 of his max HP',1e-6);
  setStack(L,'jDawn',19); ccOn(v,F[1],'stunned',1); assert.equal(stack(L,'jDawn'),20,'max 20'); const g=v.hp; hitOn(L,10); near(v.hp,g-10*(1-0.10),'(full: no gain, no heal)');
  near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*(1-0.001*5*20),'Light Before Dawn: each Dawnlight 0.1% x 5 less (20: 10%)');
  setStack(L,'jDawn',0); V.step(1); const a0=v.apow; setStack(L,'jDawn',20); V.step(1); near(v.apow,a0*(1+0.001*5*20),'Grey Light: 0.1% x 5 ability power each');
  top(L,F[0]); const p=plainHit(L,()=>rh(L,F[0])); near(rh(L,F[0]),p*(1+0.002*5*20),'Dawn Hammer: Radiant Hammer 0.2% x 5 more for each');
  setStack(L,'jDawn',10); V.wave(); V.step(1); assert.equal(stack(L,'jDawn'),10,'Dawnlight stays for the fight (Early Light only once)');
});

test('Joss / Grit: Grit, Set Jaw, Hard Night, Scarred Gate, Long Siege, Bloodied Not Bowed; Until Morning',()=>{
  const L=lab(H,S(['hm_1_4','hm_3_4','hm_7_4','hm_10_4','hm_12_1','hm_5_4','hm_9_4']),{foes:3,big:true,cold:true}), {v,F}=L; V.step(1); L.T=v._tal;
  assert.equal(stack(L,'jGrit'),6,'Long Siege: each wave starts with 2 x 3 Grit'); v.maxHp=1e6; v.hp=5e5; hitOn(L,10); assert.equal(stack(L,'jGrit'),6,'a hit above 30% HP: nothing');
  setStack(L,'jGrit',0); V.step(1); const a0=v.apow, m0=v.maxHp, c0=v.ctrlRes||0; setStack(L,'jGrit',10); V.step(1);
  near(v.apow,a0*(1+0.005*3*10),'Grit: 0.5% x 3 ability power each'); near(v.maxHp,m0*(1+0.002*5*10),'Scarred Gate: 0.2% x 5 max HP each'); near((v.ctrlRes||0)-c0,0.002*5*10,'Hard Night: 0.2% x 5 control resist each (10 points at 10 Grit)');
  near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*(1-0.003*5*10),'Set Jaw: each Grit 0.3% x 5 less (10: 15%)');
  v.maxHp=1e6; v.hp=2e5; clk(L); let h=v.hp; secs(1.02); near(v.hp-h,1e6*0.012,'Bloodied Not Bowed: at 5+ Grit 0.24% x 5 of his max HP a second (the regeneration cap)',1e-3);
  setStack(L,'jGrit',3); V.step(2); clk(L); h=v.hp; secs(1.02); near(v.hp,h,'(3 Grit: none)',1e-9);
  const U=lab(H,S(['hm_9_4']),{foes:3,big:true}); { const L=U, v=U.v, F=U.F; v.maxHp=1e6;
  setStack(L,'jGrit',8); v.hp=2e5; hitOn(L,10); assert.equal(stack(L,'jGrit'),9,'a hit below 30%: 1 Grit'); assert.ok(!win(L,'jUM'),'');
  hitOn(L,10); assert.equal(stack(L,'jGrit'),10,'max 10'); assert.ok(win(L,'jUM'),'Until Morning: at 10 Grit'); v.shield=0; V.hit(F[0],v,1e7,{kind:'true'}); assert.ok(v.alive&&v.hp>=1&&v.hp<2,'he cannot drop below 1 HP');
  top(L,F[0]); v.hp=1000; const d=lost(F[0],()=>castRH(L,F[0])); assert.ok(d>0,''); near(v.hp-1000,d,'his next Radiant Hammer heals him for the damage it deals');
  v.hp=1000; castRH(L,F[0]); near(v.hp,1000,'only that one'); secs(2.1); v.hp=2e5; setStack(L,'jGrit',10); hitOn(L,10); assert.ok(!win(L,'jUM'),'once per wave'); }
  const W=lab(H,S(['hm_1_4','hm_12_1']),{foes:2,big:true}); setStack(W,'jGrit',9); V.wave(); V.step(1); assert.equal(stack(W,'jGrit'),6,'Grit is per wave (Long Siege again)');
});

test('Joss / Unbroken Dawn\'s event: Sally Forth and Sally\'s Wake, Morning Comes, First Light, Dawn Mercy',()=>{
  const L=lab(H,S(['hm_5_3','hm_6_3','hm_6_1','hm_11_1','pr_11_1','pr_1_4']),{foes:3,allies:2,big:true}), {v,F,A}=L; for(const a of A){ a.maxHp=1e6; a.hp=5e5; } promise(L,A[1]);
  go(L); v.maxHp=1e6; v.hp=2.9e5; v.shield=0; v.greenCd=5; v.blueCd=5; V.step(2); v.greenCd=1e9; v.blueCd=1e9;
  near(v.shield,1e6*0.30*(v.passMul||1)*1.09,'Morning Comes: Unbroken Dawn\'s shield 3% x 3 larger',1e-6); assert.ok(win(L,'jSally'),'Sally Forth: Radiant Hammer and Sanctuary Guard were made ready (the window of Sally\'s Wake)');
  near(A[0].hp,5e5+1e6*0.10,'First Light: every other ally within 6 m heals 2% x 5 of its max HP'); near(A[1].hp,5e5,'(not one farther)');
  near(A[1].shield,1e6*0.10,'Dawn Mercy: the Promised ally a shield of 2% x 5 of its max HP'); near(A[1].shieldT,6,'for 6 s',0.01);
  v.stunned=1e6; top(L,F[0]); const p=plainHit(L,()=>rh(L,F[0])); near(rh(L,F[0]),p*1.15,'Sally\'s Wake: his skills 5% x 3 more for 4 s'); secs(4.1); const q=plainHit(L,()=>rh(L,F[0])); near(rh(L,F[0]),q,'then not');
  const C=lab(H,S(['hm_5_3']),{foes:2,big:true}); go(C); C.v.maxHp=1e6; C.v.hp=2.9e5; C.v.greenCd=5; C.v.blueCd=5; V.step(2); near(C.v.greenCd,0,'Sally Forth: Radiant Hammer ready'); near(C.v.blueCd,0,'and Sanctuary Guard');
});

test('Joss / The Gate Still Stands (SIGNATURE): cleanse and half the shield for allies, a 1 s stun under the stun-lock rule and the dazzle; Second Morning brings it twice',()=>{
  const L=lab(H,S(['hm_13_2','hm_3_1','hm_1_1']),{foes:5,allies:2,big:true}), {v,F,A}=L; at(L,F[1],25,0); at(L,F[2],25,10); free(L); F[3].stunned=1e6; F[4].stunned=0;
  const se=L.T.s.joSE||(L.T.s.joSE={}); se[F[4].uid]=V.now()-0.2; A[0].stunned=3; A[0].shield=0; A[1].stunned=3;
  go(L); v.maxHp=1e6; v.hp=2.9e5; V.step(2); const half=1e6*0.30*(v.passMul||1)*0.5;
  near(A[0].stunned,0,'every other ally within 6 m is cleansed'); near(A[0].shield,half,'and gets the same shield at half strength',1e-6); near(A[0].shieldT,8,'for 8 s',0.05); assert.ok(A[1].stunned>0&&!(A[1].shield>0),'not one farther away');
  near(F[0].stunned,1-V.STEP,'every enemy within 6 m is stunned 1 s',0.06); assert.ok(F[3].stunned>1e5,'(one already stunned: no new stun)'); near(F[4].stunned,0,'(nor one within 0.5 s after his last stun on it ended)');
  assert.ok(!(F[1].stunned>0),'not one far away'); assert.ok(mark(L,F[0],'jDaz')&&mark(L,F[3],'jDaz'),'they are dazzled');
  v.stunned=1e6; v.hp=6e5; const lb=()=>1-0.001*5*stack(L,'jDawn'); near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*0.75*lb(),'a dazzled enemy deals 25% less to him (and Light Before Dawn)'); near(hitAl(L,A[0],1000),plainHit(L,()=>hitAl(L,A[0],1000))*0.75,'and to his allies');
  near(hitOn(L,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,1000,{src:F[1]}))*lb(),'(not one that is not)'); hold(L); secs(4.1); near(hitOn(L,1000),plainHit(L,()=>hitOn(L,1000))*lb(),'for 4 s');
  setStack(L,'jDawn',20); free(L); A[0].shield=0; go(L); v.hp=2.9e5; V.step(2); assert.ok(stack(L,'jDawn')<=5,'Second Morning: at 20 Dawnlight Unbroken Dawn triggers once more, spending all Dawnlight (what is left came from its own stuns: '+stack(L,'jDawn')+')');
  near(A[0].shield,half,'the second dawn does all of this again',1e-6); assert.ok(F[0].stunned>0.5,'');
  setStack(L,'jDawn',20); free(L); A[0].shield=0; go(L); v.hp=2.9e5; V.step(2); near(A[0].shield||0,0,'never a third time'); v.stunned=1e6;
});

test('Joss / Hammer at the Gate (LINK): Radiant Hammer below 50% HP; with Hammerlight, a 25% chance per gain of Dawnlight and a full hammer at the dawn',()=>{
  const L=lab(H,S(['hm_n1','hm_1_1']),{foes:2,big:true}), {v,F}=L; top(L,F[0]); v.maxHp=1e6; v.hp=1e6; let p=plainHit(L,()=>rh(L,F[0])); near(rh(L,F[0]),p,'above 50%: plain');
  v.hp=4e5; p=plainHit(L,()=>rh(L,F[0])); near(rh(L,F[0]),p*1.05,'below 50% HP: 5% more'); autoOn(L,F[0],2); assert.equal(stack(L,'jHL'),0,'(no Hammerlight without the Radiant Hammer tree\'s Hammerlight)');
  const Q=lab(H,S(['hm_n1','hm_1_1','ra_1_1']),{foes:2,big:true}); Q.v.maxHp=1e6; Q.v.hp=4e5; let n=0, c=0;
  for(let i=0;i<400;i++){ setStack(Q,'jDawn',0); setStack(Q,'jHL',0); hitOn(Q,1); n++; if(stack(Q,'jHL')>0) c++; Q.v.hp=4e5; }
  assert.ok(c>60&&c<140,'each gain of Dawnlight: a seeded 25% chance of 1 Hammerlight ('+c+' of '+n+')');
  go(Q); Q.v.hp=2.9e5; setStack(Q,'jHL',0); V.step(2); assert.equal(stack(Q,'jHL'),5,'Unbroken Dawn: his hammer charged to 5 at once');
});

/* ============================== DAMAGE REDUCTION: ONE GROUP ============================== */
test('Joss / damage reduction, one group of 40%: each of his reduction talents, multiplied, and all together',()=>{
  const L=lab(H,S(['hm_2_2','hm_4_2','pr_10_2','hm_6_2']),{foes:3,big:true}), {v,F}=L, t0=F[0].t; F[0].t=Object.assign({},t0,{row:'Front'});
  near(hitOn(L),plainHit(L,()=>hitOn(L))*0.95,'Gate Bar: 1% x 5 less from a front-row hero');
  F[0].t=Object.assign({},t0,{row:'Back'}); near(hitOn(L),plainHit(L,()=>hitOn(L)),'(not from the back row)');
  near(hitOn(L,1000,{crit:true}),plainHit(L,()=>hitOn(L,1000,{crit:true}))*0.94*0.94,'Thick Timber, Firm Grip: a critical hit 2% x 3 and 2% x 3 less (multiplied)'); F[0].t=Object.assign({},t0,{row:'Front'});
  v.hp=v.maxHp*0.4; near(hitOn(L),plainHit(L,()=>hitOn(L))*0.95,'(40% HP: no Stand Fast)'); v.hp=v.maxHp*0.29; near(hitOn(L),plainHit(L,()=>hitOn(L))*0.95*0.925,'Stand Fast at Night: below 30% HP 1.5% x 5 less'); v.hp=v.maxHp;
  const C=lab(H,S(['ra_10_2','ra_10_4','ra_1_4','ra_8_2']),{foes:5,big:true}); near(hitOn(C),plainHit(C,()=>hitOn(C)),'none of their conditions: nothing');
  setMk(C,C.F[1],'jJud'); setMk(C,C.F[2],'jJud'); near(hitOn(C),plainHit(C,()=>hitOn(C))*(1-0.025*2),'Court of Morning: 0.5% x 5 per Judged enemy');
  for(const f of C.F) setMk(C,f,'jJud'); near(hitOn(C,1000,{src:C.F[1]}),plainHit(C,()=>hitOn(C,1000,{src:C.F[1]}))*(1-0.10)*0.95,'(up to 4 enemies: 10%); Witness Stand: a Judged enemy deals 1% x 5 less');
  setMk(C,C.F[3],'jHum'); near(hitOn(C,1000,{src:C.F[3]}),plainHit(C,()=>hitOn(C,1000,{src:C.F[3]}))*0.90*0.95*0.925*0.94,'Shamed: an enemy Humbled 1.5% x 5; Humbled: it deals 2% x 3 less');
  const G=lab(H,S(['pr_1_1','pr_6_2','pr_n1']),{foes:2,allies:3,big:true}); for(const a of G.A) setMk(G,a,'jGra'); near(hitOn(G),plainHit(G,()=>hitOn(G))*(1-0.025*3),'Thanks of the Town: 0.5% x 5 per Grateful ally');
  promise(G,G.A[0]); near(hitOn(G),plainHit(G,()=>hitOn(G))*(1-0.025*3)*0.94,'Devotion: the Promised ally within 4 m, 2% x 3'); at(G,G.A[0],0,-9); near(hitOn(G),plainHit(G,()=>hitOn(G))*(1-0.025*3),'(not farther)');
  setMk(G,G.v,'jSg',5); near(hitOn(G),plainHit(G,()=>hitOn(G))*(1-0.025*3)*0.85,'Broad Shield: his own Sanctuary Guard holds on him, 3% x 5');
  const X=lab(H,S(['hm_1_1','hm_2_2','hm_4_2','hm_3_4','hm_6_2','pr_1_1','pr_6_2','pr_10_2','ra_10_2','ra_10_4','pr_n1','hm_13_2','ra_1_4','ra_8_2']),{foes:5,allies:3,big:true});
  setStack(X,'jDawn',20); setStack(X,'jGrit',10); for(const a of X.A) setMk(X,a,'jGra'); for(const f of X.F){ setMk(X,f,'jJud'); setMk(X,f,'jHum'); setMk(X,f,'jDaz'); } setMk(X,X.v,'jSg',5); X.v.hp=X.v.maxHp*0.29;
  near(hitOn(X,1000,{crit:true}),plainHit(X,()=>hitOn(X,1000,{crit:true}))*0.60,'all of them at once: never more than 40% off a hit');
  near(X.T.fn.drK(api(X),X.T,X.v,X.F[0],'phys',true),0.60,'(the pure function the 95% check reads)');
});

test('Joss / his allies: Given Word, Broad Shield, Grateful Town, Brighter Each Morning, the dazzle and Humbled on hits on them (one group of 25%); Judged and Townsfolk on their hits',()=>{
  const L=lab(H,S(['pr_1_4','pr_n1','pr_11_3','hm_12_2','ra_1_4']),{foes:3,allies:2,big:true}), {v,F,A}=L;
  near(hitAl(L,A[0]),1000,'none of their conditions: nothing'); promise(L,A[0]); near(hitAl(L,A[0]),1000*0.97,'Given Word: the Promised ally 1% x 3 less');
  setMk(L,A[0],'jSg',5); near(hitAl(L,A[0]),1000*0.97*0.85,'Broad Shield: while Sanctuary Guard holds on it, 3% x 5'); setMk(L,A[0],'jGra'); near(hitAl(L,A[0]),1000*0.97*0.85*0.95,'Grateful Town: a Grateful ally 1% x 5');
  setStack(L,'jDawn',20); near(hitAl(L,A[1],1000),1000,'Brighter Each Morning: not one 11 m away'); at(L,A[1],0,-8); near(hitAl(L,A[1],1000),1000*(1-0.0005*5*20),'within 6 m: 0.05% x 5 per Dawnlight');
  setMk(L,F[0],'jHum'); near(hitAl(L,A[0]),1000*0.75,'all together, a Humbled enemy too: never more than 25% off a hit on an ally');
  const J=lab(H,S(['ra_2_2','pr_9_1']),{foes:2,allies:2,big:true}); setMk(J,J.F[0],'jJud');
  near(lost(J.F[0],()=>V.hit(J.A[0],J.F[0],1000,{kind:'true'})),1000*1.10,'Judged: an ally\'s hit on a Judged enemy 2% x 5 more'); near(myHit(J,J.F[0]),1000*1.10,'Joss\'s too (his whole team)');
  near(lost(J.F[1],()=>V.hit(J.A[0],J.F[1],1000,{kind:'true'})),1000,'(not on another enemy)'); setMk(J,J.A[1],'jGra');
  near(lost(J.F[1],()=>V.hit(J.A[1],J.F[1],1000,{kind:'true'})),1000*1.05,'Townsfolk: a Grateful ally\'s hits 1% x 5 more');
});

test('Joss / controls on him: Unbroken Will, Clear Head, Hard Head, Wakeful (they multiply; together at most 35% shorter)',()=>{
  const L=lab(H,S(['hm_5_1','hm_12_3','ra_8_3','pr_12_2']),{foes:2,big:true}), {v,F}=L;
  v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.80,'a stun: Unbroken Will 4% x 5 shorter',1e-9);
  v.silencedT=0; ccOn(F[0],v,'silencedT',1); near(v.silencedT,V.ccNerf*0.65,'a silence: 0.8 x 0.8 x 0.7 would be 55% shorter - held at 35%',1e-9);
  v.fearT=0; ccOn(F[0],v,'fearT',1); near(v.fearT,V.ccNerf*0.65,'a fear: 0.8 x 0.7 would be 44% - held at 35%',1e-9);
  const Q=lab(H,S(['pr_12_2']),{foes:2,big:true}); Q.v.fearT=0; ccOn(Q.F[0],Q.v,'fearT',1); near(Q.v.fearT,V.ccNerf*0.70,'Wakeful alone: 10% x 3',1e-9); Q.v.stunned=0; ccOn(Q.F[0],Q.v,'stunned',1); near(Q.v.stunned,V.ccNerf,'(not a stun)',1e-9);
});

test('Joss / healing each second: Bloodied Not Bowed, Warm Thanks, Keep Them Close - each, and together at most 1.2% of his max HP a second',()=>{
  const L=lab(H,S(['pr_5_1']),{foes:2,allies:3,big:true}), {v,A}=L; v.maxHp=1e6; v.hp=5e5; setMk(L,A[0],'jGra'); setMk(L,A[1],'jGra'); clk(L);
  let h=v.hp; secs(1.02); near(v.hp-h,1e6*0.003*2,'Warm Thanks: 0.1% x 3 of his max HP a second per Grateful ally (2)',1e-3);
  const K=lab(H,S(['pr_10_4']),{foes:2,allies:2,big:true}); K.v.maxHp=1e6; K.v.hp=5e5; promise(K,K.A[0]); clk(K); h=K.v.hp; secs(1.02); near(K.v.hp-h,1e6*0.012,'Keep Them Close: the Promised ally within 3 m, 0.24% x 5',1e-3);
  at(K,K.A[0],0,-9); clk(K); h=K.v.hp; secs(1.02); near(K.v.hp,h,'(not farther)',1e-9);
  const X=lab(H,S(['hm_5_4','pr_5_1','pr_10_4']),{foes:2,allies:3,big:true}); X.v.maxHp=1e6; X.v.hp=5e5; setStack(X,'jGrit',6); for(const a of X.A) setMk(X,a,'jGra'); promise(X,X.A[0]); clk(X);
  h=X.v.hp; secs(1.02); near(X.v.hp-h,1e6*0.012,'all three together (1.2% + 0.9% + 1.2%): held at 1.2% of his max HP a second',1e-3);
});

/* ============================== SANCTUARY GUARD ============================== */
test('Joss / Sanctuary Guard: Long Guard, Long Sanctuary, Bulwark, Iron Oath, Morning Ward, Word Given Twice; Unmoved Guard (PICK ONE)',()=>{
  const L=lab(H,S(['hm_4_3','pr_4_2','hm_10_2','pr_4_3','ra_12_3','pr_8_3','hm_5_2']),{foes:2,allies:2,big:true}), {v,A}=L; A[1].hp=A[1].maxHp*0.5;
  castSG(L); near(A[1]._wardT,5+0.6+0.6,'Long Guard and Long Sanctuary: 0.2 x 3 s longer each'); near(A[1].shieldT,6.2,'');
  near(A[1].shield,(v.apow||0)*1.9*sm10()*1.09*1.12*1.09,'Bulwark 3% x 3, Iron Oath 4% x 3, Morning Ward 3% x 3 stronger (each multiplies)'); near(FX.cd(v,'blue',10),10-1.0,'Word Given Twice: 0.2 x 5 s shorter');
  V.step(1); assert.ok(v._gearImmovableT>0,'Unmoved Guard: he cannot be pushed, pulled or knocked up while it holds'); secs(6.3); v._gearImmovableT=0; V.step(2); assert.ok(!(v._gearImmovableT>0),'for its time');
});

test('Joss / Sanctuary Guard\'s choice: Only You and Two Promises (PICK ONE), Not Yet; Never Broken',()=>{
  const L=lab(H,S(['pr_5_2','pr_1_4']),{foes:2,allies:2,big:true}), {v,A}=L; A[1].hp=A[1].maxHp*0.5; castSG(L); assert.ok(mark(L,A[1],'jPro'),'the ally Sanctuary Guard shields is Promised');
  A[1].hp=A[1].maxHp; A[0].hp=A[0].maxHp*0.3; A[1].shield=0; A[0].shield=0; castSG(L); assert.ok(A[1].shield>0&&!(A[0].shield>0),'Only You: it always picks the Promised ally while they live');
  near(A[1].shield,(v.apow||0)*1.9*sm10()*1.25,'and its shield is 25% stronger');
  const W=lab(H,S(['pr_5_3']),{foes:2,allies:2,big:true}); W.A[1].hp=W.A[1].maxHp*0.3; W.A[0].hp=W.A[0].maxHp*0.6; castSG(W); const s1=(W.v.apow||0)*1.9*sm10();
  near(W.A[1].shield,s1,'Two Promises: the weakest ally the full shield'); near(W.A[0].shield,s1*0.5,'the second weakest half of it'); assert.ok(!(W.A[0]._wardT>0),'(the shield only, not the hold)'); near(W.v.shield||0,0,'');
  const N=lab(H,S(['hm_7_2']),{foes:2,allies:2,big:true}); N.A[1].hp=N.A[1].maxHp*0.1; N.v.maxHp=1e6; N.v.hp=4e5; N.v.shield=0; castSG(N); near(N.v.shield||0,0,'Not Yet: above 30% HP nothing for him');
  N.v.hp=2.5e5; castSG(N); near(N.v.shield,(N.v.apow||0)*1.9*sm10(),'below 30% HP he gets its shield too'); near(N.v._wardT,5,'and its hold');
  const B=lab(H,S(['pr_9_3']),{foes:2,allies:2,big:true}); B.A[1].hp=B.A[1].maxHp*0.5; castSG(B); V.step(1); B.A[1].stunned=3; let w0=B.A[1]._wardT;
  V.hit(B.F[0],B.A[1],B.A[1].shield*0.5,{kind:'true'}); V.step(1); assert.ok(B.A[1]._wardT<=w0+1e-9,'(a hit that leaves some shield: nothing)'); assert.ok(B.A[1].stunned>2,''); w0=B.A[1]._wardT;
  V.hit(B.F[0],B.A[1],B.A[1].shield+10,{kind:'true'}); V.step(1); assert.ok(B.A[1]._wardT>w0+0.9&&B.A[1]._wardT<w0+1.05,'Never Broken: the hit that breaks its shield, the hold lasts 1 s more'); near(B.A[1].stunned,0,'and the ally is cleansed');
  w0=B.A[1]._wardT; B.A[1].shield=50; V.step(1); B.A[1].shield=0; V.step(1); assert.ok(B.A[1]._wardT<=w0+1e-9,'once per cast');
});

test('Joss / Kept Word: a save by Sanctuary Guard\'s hold; Promise Fulfilled, Word of Honour, Town\'s Gift, Promise Weight',()=>{
  const L=lab(H,S(['pr_1_3','pr_2_3','pr_6_3','pr_6_1','pr_10_3']),{foes:2,allies:2,big:true,cold:true}), {v,A,F}=L; V.step(1); L.T=v._tal;
  assert.equal(stack(L,'jKW'),2,'Town\'s Gift: each fight starts with 1 x 2 Kept Word'); const a1=A[1]; a1.maxHp=1e6; a1.hp=3e5; castSG(L); a1.shield=0;
  V.hit(F[0],a1,1e6,{kind:'true'}); assert.ok(a1.alive,'(held at 1 HP)'); assert.equal(stack(L,'jKW'),3,'Sanctuary Guard kept an ally from falling: 1 Kept Word'); near(a1.hp,1+1e6*0.15,'Promise Fulfilled: that ally heals 3% x 5 of its max HP',1e-6);
  A[0].maxHp=1e6; A[0].hp=1000; A[0]._wardT=5; V.hit(F[0],A[0],1e6,{kind:'true'}); assert.equal(stack(L,'jKW'),3,'(a hold that is not his Sanctuary Guard\'s: nothing)');
  setStack(L,'jKW',0); V.step(1); const a0=v.apow, m0=v.maxHp; setStack(L,'jKW',4); V.step(1); near(v.apow,a0*(1+0.01*5*4),'Kept Word: 1% x 5 ability power each'); near(v.maxHp,m0*(1+0.005*3*4),'Word of Honour: 0.5% x 3 max HP each');
  for(let i=0;i<6;i++){ castSG(L); a1.shield=0; a1.hp=1000; V.hit(F[0],a1,1e6,{kind:'true'}); } assert.equal(stack(L,'jKW'),8,'Promise Weight: up to 5 + 1 x 3'); V.wave(); V.step(1); assert.equal(stack(L,'jKW'),8,'for the fight');
  A[0].hp=A[0].maxHp; a1.hp=a1.maxHp; v.maxHp=1e6; v.hp=1000; castSG(L); assert.ok(v._wardT>0,'(his own Sanctuary Guard on him)'); v.shield=0; V.hit(F[0],v,1e6,{kind:'true'}); assert.equal(stack(L,'jKW'),8,'(a save of himself is not one)');
});

/* ============================== THE PROMISE ============================== */
test('Joss / the Promise: Given Word (moves to the next ally, never to him; faster toward them), Close Promise, Shoulder Guard, Always Return, Back to Back, Mind the Gate, Steady Promise',()=>{
  const L=lab(H,S(['pr_1_4','pr_2_4','pr_4_4','pr_3_4','pr_12_4','pr_6_4','pr_8_4']),{foes:2,allies:2,big:true}), {v,A,F}=L;
  A[1].hp=A[1].maxHp*0.5; castSG(L); assert.ok(mark(L,A[1],'jPro'),'Promised'); v.maxHp=1e6; v.hp=1e5; A[1].hp=A[1].maxHp; castSG(L); assert.ok(mark(L,A[1],'jPro'),'a Sanctuary Guard on himself keeps it'); v.hp=1e6;
  A[0].hp=A[0].maxHp*0.5; castSG(L); assert.ok(mark(L,A[0],'jPro')&&!mark(L,A[1],'jPro'),'cast on another ally, the Promise moves'); A[0].hp=A[0].maxHp; A[0].maxHp=1e6; A[0].hp=5e5;
  clk(L); let h=A[0].hp; secs(1.02); near(A[0].hp-h,1e6*0.006,'Close Promise: 0.2% x 3 of its max HP a second',1e-3);
  const B=lab(H,null,{foes:2,allies:2,big:true}); const ar0=B.A[0].armorRating, jar=B.v.armorRating;
  const L2=lab(H,S(['pr_4_4','pr_12_4','pr_3_4','pr_6_4','pr_8_4']),{foes:2,allies:2,big:true}); promise(L2,L2.A[0]); V.step(2); near(L2.A[0].armorRating,ar0+0.05*jar,'Shoulder Guard: armor equal to 1% x 5 of Joss\'s',1e-6);
  promise(L2,L2.A[1]); L2.T.s.m.jPro=L2.A[1]; delete L2.A[0]._talM[L2.v.uid].jPro; V.step(2); near(L2.A[0].armorRating,ar0,'given back when the Promise moves',1e-6); near(L2.A[1].armorRating,ar0+0.05*jar,'',1e-6);
  L2.A[1].hp=L2.A[1].maxHp*0.4; V.step(2); const j0=L2.v.atkInterval, k0=L2.A[1].atkInterval; L2.A[1].hp=L2.A[1].maxHp; V.step(2); near(L2.v.atkInterval,j0/1.03,'Back to Back: both above 50% HP, Joss 1% x 3 faster'); near(L2.A[1].atkInterval,k0/1.03,'and the Promised ally');
  L2.v.blueCd=8; L2.A[1].hp=L2.A[1].maxHp*0.29; V.step(1); near(L2.v.blueCd,8-3,'Always Return: the Promised ally drops below 30%, Sanctuary Guard 3 s sooner',0.1);
  L2.A[1].hp=L2.A[1].maxHp; V.step(1); L2.A[1].hp=L2.A[1].maxHp*0.29; L2.v.blueCd=8; V.step(1); near(L2.v.blueCd,8,'(once every 10 s)',0.1); secs(6); L2.A[1].hp=L2.A[1].maxHp; V.step(1); L2.v.blueCd=8; L2.A[1].hp=L2.A[1].maxHp*0.29; V.step(1); near(L2.v.blueCd,8,'(6 s later: not yet)',0.1); secs(4.5); L2.A[1].hp=L2.A[1].maxHp; V.step(1); L2.v.blueCd=8; L2.A[1].hp=L2.A[1].maxHp*0.29; V.step(1); near(L2.v.blueCd,5,'',0.1);
  L2.A[1].hp=L2.A[1].maxHp; V.hit(L2.F[1],L2.A[1],10,{kind:'true'}); assert.ok(mark(L2,L2.F[1],'jMind'),'Mind the Gate: an enemy that hits the Promised ally');
  near(myHit(L2,L2.F[1]),1000*1.03,'takes 1% x 3 more from Joss'); near(myHit(L2,L2.F[0]),1000,'(not another)'); secs(5.1); near(myHit(L2,L2.F[1]),1000,'for 5 s');
  L2.A[1].stunned=0; ccOn(L2.F[0],L2.A[1],'stunned',1); near(L2.A[1].stunned,V.ccNerf*(1-0.03*5),'Steady Promise: a control on the Promised ally 3% x 5 shorter',1e-9);
  L2.A[0].stunned=0; ccOn(L2.F[0],L2.A[0],'stunned',1); near(L2.A[0].stunned,V.ccNerf,'(not on another ally)',1e-9);
  const M=lab(H,S(['pr_1_4']),{foes:2,allies:2,big:true}), tw=()=>M.T.fn.toward(api(M),M.T,M.v); promise(M,M.A[1]); M.v.px=M.v.x; M.v.py=M.v.y; assert.ok(!tw(),'standing: no');
  M.v.py=M.v.y+1; assert.ok(tw(),'Given Word: he walks toward the Promised ally'); M.v.py=M.v.y-1; assert.ok(!tw(),'(away: no)');
  assert.ok(M.T.stats.some(r=>r.id==='pr_1_4'&&Math.abs(r.stat.move-0.09)<1e-12),'(then 3% x 3 faster)');
});

test('Joss / Hammer Between Them, I Will Hold, Carried Like a Promise (SIGNATURE)',()=>{
  const L=lab(H,S(['pr_7_4']),{foes:3,allies:2,big:true}), {v,A,F}=L; free(L); top(L,F[0]); promise(L,A[1]); V.hit(F[2],A[1],10,{kind:'true'});
  const h0=F[0].hp, h2=F[2].hp; castRH(L,F[0]); assert.ok(F[2].hp<h2&&F[0].hp===h0,'Hammer Between Them: Radiant Hammer goes to the enemy that last hit the Promised ally'); near(F[2].stunned,2.45+0.3,'and stuns it 0.3 s longer',1e-9);
  kill(L,F[2]); free(L); const g0=F[0].hp; castRH(L,F[0]); assert.ok(F[0].hp<g0,'(that enemy gone: the enemy with the highest attack again)'); near(F[0].stunned,2.45,'',1e-9);
  const W=lab(H,S(['pr_11_4']),{foes:2,allies:2,big:true}); const a=W.A[1]; a.maxHp=1e6; a.hp=1000; promise(W,a); W.v.maxHp=1e6; W.v.hp=1e6; W.v.shield=0;
  V.hit(W.F[0],a,5000,{kind:'true'}); near(a.hp,1000,'I Will Hold: the Promised ally keeps its HP'); near(W.v.shield,1e6*0.15-5000,'Joss gains a shield of 15% of his max HP and takes the killing hit',1e-6);
  a.hp=1000; V.hit(W.F[0],a,5000,{kind:'true'}); assert.ok(!a.alive,'once per wave');
  const C=lab(H,S(['pr_13_3','pr_1_3']),{foes:2,allies:2,big:true}); const b=C.A[1]; b.maxHp=1e6; b.hp=1000; promise(C,b); C.v.energy=0;
  V.hit(C.F[0],b,5000,{kind:'true'}); assert.ok(b.alive&&b.hp>=1&&b.hp<2,'Carried Like a Promise: the Promised ally cannot drop below 1 HP'); assert.equal(stack(C,'jKW'),1,'Joss gains 1 Kept Word'); near(C.v.energy,25,'Daybreak Judgment 25 energy (5 s, no cooldown)');
  secs(1); V.hit(C.F[0],b,5000,{kind:'true'}); assert.ok(b.alive&&b.hp<2,'for 3 s'); secs(2.1); near(b.hp,1+1e6*0.25,'healed 25% of its max HP when it ends',1e-3);
  secs(18); b.hp=1000; V.hit(C.F[0],b,5000,{kind:'true'}); assert.ok(!b.alive,'once every 25 s (21 s later: not yet)');
});

/* ============================== GRATITUDE ============================== */
test('Joss / Gratitude: from his heals and shields (up to 4 allies), Thankful, Many Thanks, Last Thanks, Shared Morning, Morning Prayer',()=>{
  const L=lab(H,S(['pr_1_1','pr_3_1','pr_7_1','pr_12_1']),{foes:2,allies:3,big:true}), {v,A,F}=L; A[1].hp=A[1].maxHp*0.5; castSG(L); assert.ok(mark(L,A[1],'jGra'),'the ally Sanctuary Guard shields is Grateful');
  near(A[1]._talM[v.uid].jGra.until-V.now(),8+5,'Thankful: 8 + 1 x 5 s',1e-6); assert.ok(!mark(L,A[0],'jGra'),''); castDJ(L); assert.ok(mark(L,A[0],'jGra'),'the allies Daybreak Judgment heals'); assert.ok(!mark(L,v,'jGra'),'(never Joss)');
  V.step(1); const a0=v.apow; setMk(L,A[2],'jGra'); V.step(1); near(v.apow,a0*(1+0.004*5*3)/(1+0.004*5*2),'Many Thanks: 0.4% x 5 ability power per Grateful ally');
  v.maxHp=1e6; v.hp=5e5; const h=v.hp; A[2].hp=1; A[2].shield=0; V.dmg(A[2],100); assert.ok(!A[2].alive,''); near(v.hp-h,1e6*0.06,'Last Thanks: a Grateful ally dies, he heals 3% x 2 of his max HP',1e-6);
  const C=lab(H,S(['pr_1_1']),{foes:3,allies:3,big:true}), X=[C.A[0],C.A[1],C.A[2],C.F[0],C.F[1]]; C.F[0].team=C.v.team; C.F[1].team=C.v.team;
  try{ for(const x of X) api(C).run(C.T,C.v,'jGrat',{u:C.v,tgt:x}); } finally{ C.F[0].team='enemy'; C.F[1].team='enemy'; }
  assert.deepEqual(X.map(x=>mark(C,x,'jGra')),[false,true,true,true,true],'up to 4 allies: a fifth pushes out the one marked longest ago');
  const D=lab(H,S(['pr_12_3','pr_9_2']),{foes:2,allies:2,big:true}); for(const a of D.A){ a.maxHp=1e6; a.hp=1; } at(D,D.A[1],3,-4); setMk(D,D.A[1],'jGra');
  const pl=plainHit(D,()=>{ const x=D.A[0].hp; castDJ(D); return D.A[0].hp-x; }); for(const a of D.A) a.hp=1; castDJ(D); near(D.A[0].hp-1,pl*1.10,'Morning Prayer: Daybreak Judgment heals 2% x 5 more',1e-6); near(D.A[1].hp-1,pl*1.10*1.10,'Shared Morning: a Grateful ally 2% x 5 more on top',1e-6);
});

/* ============================== RADIANT HAMMER ============================== */
test('Joss / Hammerlight: charged by basic attacks, spent by Radiant Hammer; Bright Swing, Full Charge, Gathering Light, Light in the Hand, Overflowing Light, First Strike of Day',()=>{
  const L=lab(H,S(['ra_1_1','ra_2_1','ra_3_1','ra_4_1','ra_11_1','ra_8_1','ra_6_4']),{foes:3,big:true}), {v,F}=L; top(L,F[0]); at(L,F[1],4.5,4.2); for(const f of F) f.mrRating=0; v.maxHp=1e6; v.hp=5e5;
  autoOn(L,F[0],2); assert.equal(stack(L,'jHL'),2,'each basic attack: 1 Hammerlight'); autoOn(L,F[0],1,{crit:true}); assert.equal(stack(L,'jHL'),4,'Bright Swing: a critical one 1 more (33% x 3)'); autoOn(L,F[0],3); assert.equal(stack(L,'jHL'),5,'max 5');
  setStack(L,'jHL',0); V.step(1); const a0=v.dmg, c0=v.glyphCrit; setStack(L,'jHL',5); V.step(1); near(v.dmg,a0*(1+0.004*5*5),'Gathering Light: 0.4% x 5 attack each'); near(v.glyphCrit-c0,0.001*5*5,'Light in the Hand: 0.1% x 5 critical chance each (2.5%)');
  const p=plainHit(L,()=>rh(L,F[0])), h=v.hp, h1=F[1].hp; const d=rh(L,F[0]); near(d,p*(1+0.04*5*5)*1.20,'Radiant Hammer spends all 5: 4% x 5 more for each; First Strike of Day 10% x 2 (the first each wave)');
  assert.equal(stack(L,'jHL'),0,'spent'); near(h1-F[1].hp,d*0.5,'Full Charge: at 5, every enemy within 2 m of its target takes half',1e-6); near(v.hp-h,1e6*0.003*5*5,'Overflowing Light: 0.3% x 5 of his max HP per Hammerlight spent',1e-6);
  const q=plainHit(L,()=>rh(L,F[0])), h2=F[1].hp; near(rh(L,F[0]),q,'the next one (none): plain, and no First Strike'); near(F[1].hp,h2,'no splash');
  const G=lab(H,S(['ra_6_1','ra_12_1','ra_1_1']),{foes:2,big:true}); assert.equal(stack(G,'jHL'),5,'Morning Glint: each wave starts with 2 x 3 (up to 5)');
  const K=lab(H,S(['ra_12_1','ra_1_1']),{foes:2,big:true}); setStack(K,'jHL',5); V.wave(); V.step(1); assert.equal(stack(K,'jHL'),3,'Long Light: 1 x 3 kept between waves');
  const Z=lab(H,S(['ra_1_1']),{foes:2,big:true}); setStack(Z,'jHL',5); V.wave(); V.step(1); assert.equal(stack(Z,'jHL'),0,'(lost between waves without it)');
  near(FXN.totals(H,[['ra_3_3',5]]).crit,0.025,'Holy Edge: 0.5% x 5 critical chance (a plain stat)'); near(0.025+0.001*5*5,0.05,'with Light in the Hand at 5 Hammerlight: 5% in all, never more');
});

test('Joss / Humbled: Radiant Hammer\'s victim; Brought Low, Joss\'s basic attacks on it, Lowly, Pride Brought Down, Fallen Pride; On Your Knees',()=>{
  const L=lab(H,S(['ra_1_4','ra_3_4','ra_5_4','ra_7_4','ra_12_4']),{foes:3,big:true}), {v,F}=L; top(L,F[0]); castRH(L,F[0]); assert.ok(mark(L,F[0],'jHum'),'the enemy Radiant Hammer crushes is Humbled'); assert.ok(!mark(L,F[1],'jHum'),'');
  near(F[0]._talM[v.uid].jHum.until-V.now(),6+2.5,'Brought Low: 6 + 0.5 x 5 s',1e-6); near(myHit(L,F[0],{auto:true}),1000*1.12,'Joss\'s basic attacks on it: 4% x 3 more'); near(myHit(L,F[0]),1000,'(not his other hits)');
  V.step(2); const e=auOf(L,F[0]); near(e&&e.ap.aspd,1-0.10,'Lowly: it attacks 2% x 5 slower');
  for(const f of [F[0],F[1]]){ f.maxHp=1e6; f.hp=5e5; } V.heal(F[1],1000); const g1=F[1].hp-5e5; V.heal(F[0],1000); near(F[0].hp-5e5,g1*0.88,'Pride Brought Down: it receives 4% x 3 less healing',1e-6);
  v.maxHp=1e6; v.hp=5e5; const h=v.hp; kill(L,F[0]); near(v.hp-h,1e6*0.06,'Fallen Pride: it dies, he heals 3% x 2 of his max HP',1e-6);
  const K=lab(H,S(['ra_9_4','ra_1_4']),{foes:2,big:true}); K.v.maxHp=1e9; K.v.hp=1e9; free(K); top(K,K.F[0]); castRH(K,K.F[0]); near(K.F[0].stunned,2.45,'On Your Knees: the first strike plain',1e-9); near(K.F[0]._atkDnPct,0.35,'');
  K.F[0].stunned=0; castRH(K,K.F[0]); near(K.F[0].stunned,2.45+0.5,'a Humbled enemy struck again: stunned 0.5 s longer',1e-9); near(K.F[0]._atkDnPct,0.50,'and its attack crushed 50% instead of 35%');
  hold(K); K.F[0].stunned=0; K.F[0].speed=0; K.F[0].atkCd=1e9; secs(5.2); assert.ok(!(K.F[0]._atkDnT>0),'(the crush is over)'); near(K.F[0]._atkDnPct,0.35,'given back when the crush ends');
});

test('Joss / Judged: from his skills\' stuns; Weight of Judgment, Sentence Read, The Last Ruling, Gate Plate, Verdict, Morning of Judgment; Mercy and Healing Mercy',()=>{
  const L=lab(H,S(['ra_2_2','ra_4_2','ra_6_2','ra_5_2','ra_9_3','ra_12_2']),{foes:3,big:true}), {v,F}=L; free(L); top(L,F[0]); castRH(L,F[0]); assert.ok(mark(L,F[0],'jJud'),'Radiant Hammer\'s stun: Judged');
  near(F[0]._talM[v.uid].jJud.until-V.now(),5+1.5,'Weight of Judgment: 5 + 0.5 x 3 s',1e-6); const a0=v.armorRating; V.step(2); near(v.armorRating,a0*1.10,'Gate Plate: 2% x 5 armor while an enemy is Judged');
  near(myHit(L,F[0],{crit:true}),plainHit(L,()=>myHit(L,F[0],{crit:true}))*1.10*1.15,'Sentence Read: his critical hits on it 3% x 5 more (with Judged\'s 10%)');
  F[0].maxHp=1e9; F[0].hp=2e8; near(myHit(L,F[0]),1000*1.10*1.30,'The Last Ruling: below 25% HP, 30% more'); F[0].hp=1e9;
  free(L); at(L,F[2],0,5); setMk(L,F[2],'jJud'); const pl=plainHit(L,()=>{ const x=F[2].hp; castDJ(L); return x-F[2].hp; }); free(L); const y=F[2].hp; castDJ(L); near(y-F[2].hp,pl*1.10*1.10,'Verdict: Daybreak Judgment 2% x 5 more on a Judged enemy (and Judged\'s 10%)');
  assert.ok(mark(L,F[2],'jJud'),'Daybreak Judgment\'s stun: Judged');
  const D=lab(H,S(['ra_11_2']),{foes:2,big:true}); D.F[0].level=1e4; castDJ(D); assert.ok(mark(D,D.F[0],'jJud')&&mark(D,D.F[0],'jHum'),'Morning of Judgment: every enemy it hits is Judged and Humbled');
  near(D.F[0]._talM[D.v.uid].jHum.until-V.now(),4,'Humbled for 4 s',1e-6);
  const M=lab(H,S(['ra_5_3','ra_6_3']),{foes:2,allies:2,big:true}); for(const a of M.A){ a.maxHp=1e6; a.hp=5e5; } M.A[0].hp=4e5; setMk(M,M.F[0],'jJud'); const h0=M.A[0].hp, h1=M.A[1].hp;
  const d=myHit(M,M.F[0]); near(M.A[0].hp-h0,d*(0.15+0.09),'Mercy: the lowest-HP ally within 6 m heals 15% of it; Healing Mercy 3 points x 3 more',1e-6); near(M.A[1].hp,h1,'not another');
  const g=M.A[0].hp; myHit(M,M.F[1]); near(M.A[0].hp,g,'(a hit on an enemy that is not Judged: nothing)');
});

test('Joss / stuns made longer: Ringing Blow, Gate Held, and the 4.0 s ceiling',()=>{
  const L=lab(H,S(['ra_n1','hm_9_2']),{foes:3,big:true}), {v,F}=L; free(L); top(L,F[0]); castRH(L,F[0]); near(F[0].stunned,2.45+0.5,'Ringing Blow: Radiant Hammer\'s stun 0.1 x 5 s longer',1e-9);
  free(L); castDJ(L); near(F[0].stunned,1.4+0.5+0.5,'Daybreak Judgment\'s: Ringing Blow and Gate Held 0.1 x 5 each',1e-9);
  const X=lab(H,S(['ra_n1','ra_9_4','ra_1_4','pr_7_4','ra_13_2','ra_2_2']),{foes:3,allies:1,big:true}); free(X); top(X,X.F[0]); setMk(X,X.F[0],'jHum'); setMk(X,X.F[0],'jJud'); promise(X,X.A[0]); X.A[0]._talBy=X.F[0]; setStack(X,'jHL',5);
  castRH(X,X.F[0]); near(X.F[0].stunned,4.0,'all of them (2.45 + 0.5 + 0.5 + 0.3 + 1.5): never past 4.0 s',1e-9);
});

test('Joss / Sentence at Sunrise (SIGNATURE): 5 Hammerlight on a Judged enemy - a guaranteed critical, Humbled, 1.5 s longer stun, half to every other Judged enemy within 6 m; once every 15 s',()=>{
  const L=lab(H,S(['ra_13_2']),{foes:4,big:true}), {v,F}=L; free(L); top(L,F[0]); at(L,F[1],4.5,4.5); at(L,F[2],4.5,-4.5); at(L,F[3],30,0); setMk(L,F[1],'jJud'); setMk(L,F[3],'jJud');
  setStack(L,'jHL',5); const p=plainHit(L,()=>rh(L,F[0])); free(L); setStack(L,'jHL',5); const h1=F[1].hp, h2=F[2].hp; const d=rh(L,F[0]); near(d,p,'(not Judged: plain)'); near(F[1].hp,h1,'');
  setMk(L,F[0],'jJud'); free(L); setStack(L,'jHL',5); const q=plainHit(L,()=>rh(L,F[0])); free(L); setStack(L,'jHL',5); const g1=F[1].hp, g2=F[2].hp, g3=F[3].hp; const e=rh(L,F[0]);
  assert.ok(e>q*1.3,'a guaranteed critical ('+e.toFixed(0)+' against '+q.toFixed(0)+')'); assert.ok(mark(L,F[0],'jHum'),'the enemy is Humbled'); near(F[0].stunned,2.45+1.5,'its stun 1.5 s longer',1e-9);
  near(g1-F[1].hp,e*0.5,'every other Judged enemy within 6 m takes 50% of the hit',1e-6); near(F[2].hp,g2,'(not one that is not Judged)'); near(F[3].hp,g3,'(nor one far away)');
  free(L); setStack(L,'jHL',5); const r=plainHit(L,()=>rh(L,F[0])); free(L); setStack(L,'jHL',5); near(rh(L,F[0]),r,'once every 15 s'); hold(L); secs(14.4); setMk(L,F[0],'jJud'); free(L); setStack(L,'jHL',5); const r2=plainHit(L,()=>rh(L,F[0])); free(L); setStack(L,'jHL',5); near(rh(L,F[0]),r2,'(14.4 s: not yet)'); hold(L); secs(0.7); free(L); setMk(L,F[0],'jJud'); setStack(L,'jHL',5); const s=plainHit(L,()=>rh(L,F[0])); free(L); setStack(L,'jHL',5); assert.ok(rh(L,F[0])>s*1.3,'15 s later again'); hold(L);
  setStack(L,'jHL',4); secs(15.1); free(L); setMk(L,F[0],'jJud'); const t=plainHit(L,()=>rh(L,F[0])); free(L); setStack(L,'jHL',4); near(rh(L,F[0]),t,'(4 Hammerlight: no)');
});

test('Joss / his skills: Promise Hammer, Radiant Weight, Crushing Head, Judgment Weight, Daybreak Force, Holy Iron and Holy Weight, Hammer Rhythm, Gatekeeper\'s Patience, Early Swing',()=>{
  const L=lab(H,S(['hm_2_3','pr_7_2','ra_4_3','hm_9_3','ra_7_3','hm_11_3','ra_9_1','ra_7_1','hm_7_1','ra_10_1']),{foes:3,big:true}), {v,F}=L; top(L,F[0]); for(const f of F) f.mrRating=0;
  const p=plainHit(L,()=>rh(L,F[0])); near(rh(L,F[0]),p*1.12*1.15*1.12,'Radiant Hammer: 4% x 3, 3% x 5, 4% x 3 more (each multiplies)');
  const q=plainHit(L,()=>{ const h=F[0].hp; castDJ(L); return h-F[0].hp; }); const h=F[0].hp; castDJ(L); near(h-F[0].hp,q*1.15*1.15,'Daybreak Judgment: 3% x 5 and 3% x 5 more');
  near(myHit(L,F[0],{auto:true}),1000*1.10,'Hammer Rhythm: basic attacks 2% x 5 more'); near(FX.cd(v,'green',8),8-0.9-1.0,'Gatekeeper\'s Patience 0.3 x 3, Early Swing 0.2 x 5 s shorter');
  F[1].mrRating=800; const T0=v._tal; v._tal=undefined; const m0=VMX('defMul')(v,F[1],'magic'); const sv=F[1].mrRating; F[1].mrRating=sv*0.9; const m1=VMX('defMul')(v,F[1],'magic'); F[1].mrRating=sv; v._tal=T0; top(L,F[1]);
  const r=plainHit(L,()=>{ const x=F[1].hp; castRH(L,F[1]); return x-F[1].hp; }); const y=F[1].hp; castRH(L,F[1]); near((y-F[1].hp)/(1.12*1.15*1.12),r*(m1/m0)*(m1/m0),'Holy Iron, Holy Weight: his skills ignore 2% x 5 of the magic resist each (their shares multiply)',1e-6);
});

test('Joss / Daybreak at the Gate (all Dawnlight spent: dealing, healing, a shield) and Gate Splinters',()=>{
  const L=lab(H,S(['hm_11_2']),{foes:2,allies:1,big:true}), {v,F,A}=L; A[0].maxHp=1e6; A[0].hp=1; v.maxHp=1e6; v.hp=1e6; v.shield=0;
  const q=plainHit(L,()=>{ const h=F[0].hp; castDJ(L); return h-F[0].hp; }), qh=plainHit(L,()=>{ A[0].hp=1; castDJ(L); return A[0].hp-1; }); A[0].hp=1; v.shield=0;
  setStack(L,'jDawn',10); const h=F[0].hp; castDJ(L); near(h-F[0].hp,q*1.10,'1% more damage for each of 10 Dawnlight'); near(A[0].hp-1,qh*1.10,'and healing',1e-6); near(v.shield,1e6*0.05,'a shield of 0.5% of his max HP for each'); near(v.shieldT,6,'for 6 s',1e-6);
  assert.equal(stack(L,'jDawn'),0,'all Dawnlight spent'); const g=F[0].hp; castDJ(L); near(g-F[0].hp,q,'(none left: plain)');
  const G=lab(H,S(['hm_12_4']),{foes:2,big:true}); G.v.maxHp=1e6; G.v.hp=5e5; let f=G.F[0].hp; hitOn(G,10); near(G.F[0].hp,f,'Gate Splinters: above 30% nothing');
  G.v.hp=2e5; f=G.F[0].hp; hitOn(G,10); near(f-G.F[0].hp,0.30*G.v.apow,'below 30% HP an enemy that hits him takes 10% x 3 of his ability power',1e-6);
});

/* ============================== WHOLE FIGHTS ============================== */
test('Joss: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['hm_1_1','hm_1_4','pr_1_1','pr_1_3','pr_1_4','ra_1_1','ra_1_4','ra_2_2']), TEAM=['vael','sylthaine','vireo','vex','joss'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let hum=false, jud=false, gra=false, pro=false;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of VMX('units')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.jHum) hum=true; if(o.jJud) jud=true; if(o.jGra) gra=true; if(o.jPro) pro=true; } }
  assert.ok(mx.jHL>=1,'real Hammerlight: '+mx.jHL); assert.ok(mx.jDawn>=1,'real Dawnlight: '+mx.jDawn); assert.ok(hum&&jud,'real Humbled and Judged enemies'); assert.ok(gra&&pro,'a real Grateful and Promised ally');
  console.log('  live fight: max '+JSON.stringify(mx)+', Humbled '+hum+', Judged '+jud+', Grateful '+gra+', Promised '+pro);
  determinism(H,TEAM);
});

/* The page lines his talents added (skillTgt in Radiant Hammer's and Sanctuary Guard's cases, the two held lines in damage()): with nothing learned, whole
   seeded fights with Joss in the line-up are identical to the pre-talent page (ee8edab8), seed by seed, and reach every one of those sites. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Joss: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every page site his talents added',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['joss','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __jbN={rh:0,sg:0,dj:0,dmg:0,held:0}; var __jbD=_doEffectCore, __jbDm=damage;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="joss"&&(!o||!o.deliver||o._arrived)){ if(type==="atkcrush") __jbN.rh++; if(type==="lastbreath") __jbN.sg++; if(type==="sunburst") __jbN.dj++; } return __jbD.apply(this,arguments); };'+
    'damage=function(u,a,c,ne,cr){ __jbN.dmg++; const w=u&&u.alive&&(u._wardT||0)>0, h0=u?u.hp:0; const r=__jbDm.apply(this,arguments); if(w&&u.alive&&h0>1&&u.hp===1) __jbN.held++; return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__jbN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.rh>0&&c.sg>0&&c.dj>0&&c.dmg>0,'the fights cast Radiant Hammer ('+c.rh+'), Sanctuary Guard ('+c.sg+') and Daybreak Judgment ('+c.dj+'), and every hit passes damage()\'s held lines ('+c.dmg+'; holds '+c.held+')'); }
  finally{ VMX('_doEffectCore=__jbD; damage=__jbDm;'); }
  assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. Joss is a tank whose base kit has no reduction of its
   own: his talent reductions are one capped group (40%). Each candidate build is 91 points legal; the most defensive is the one whose worst hit is reduced most. */
const DEF={ hm:['hm_1_1','hm_2_2','hm_4_2','hm_3_4','hm_6_2','hm_13_2','hm_5_1','hm_1_3','hm_3_3','hm_8_3','hm_2_1','hm_6_4'],
            pr:['pr_1_1','pr_n1','pr_10_2','pr_6_2','pr_3_2','pr_8_2','pr_11_3','pr_1_4'],
            ra:['ra_10_2','ra_10_4','ra_1_4','ra_8_2','ra_9_3','ra_2_2'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={hm:0,pr:1,ra:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* a still field at skill level 100 (the lab's is 10), 4 enemies and 4 allies */
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,4.5][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,0,0,-5][i]*V.METER; a.y=v.y-[5.5,11,16.5,5][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on him: every condition of his damage-reduction talents true at once - 20 Dawnlight, 10 Grit, below 30% HP, 4 Grateful allies, the Promised ally
   beside him, his own Sanctuary Guard on him, 4 Judged and Humbled enemies, the attacker a dazzled front-row hero, a critical hit. Physical and magic, with his
   armour and magic resist; and again with glyph damage reduction at its 30% cap. */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F,A}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.25*v.maxHp; v.shield=0; v.glyphDR=glyph||0; v._wardT=0;
  if(L.T){ const s=L.T.s; for(const [k,n] of [['jDawn',20],['jGrit',10]]) if(L.T.st[k]) s.k[k]=Object.assign(s.k[k]||{},{n,t:99,idle:0});
    const mk=(t,name)=>{ const m=t._talM||(t._talM={}), o=m[v.uid]||(m[v.uid]={}); o[name]={t0:V.now(),until:V.now()+99,v:0}; };
    for(const a of A) mk(a,'jGra'); for(const x of F){ mk(x,'jJud'); mk(x,'jHum'); mk(x,'jDaz'); } mk(v,'jSg'); mk(A[0],'jPro'); s.m.jPro=A[0]; A[0].x=v.x; A[0].y=v.y-4.2*V.METER; }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Joss: his most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and he is at 85% or more for well under half a fight',()=>{
  const cands=[[['hm','pr'],[61,30]],[['hm','ra'],[61,30]],[['pr','hm'],[61,30]],[['pr','ra'],[61,30]],[['ra','hm'],[61,30]],[['ra','pr'],[61,30]],[['hm'],[91]],[['pr'],[91]],[['ra'],[91]],[['hm','pr','ra'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="joss"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="joss"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys",false):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic",false):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>{ const x=Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}); return x; };
    const sn=snaps(['vael','sylthaine','vireo','vex','joss'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>40&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune');
    assert.ok(d.te85<0.25*d.t,'at 85% or more for well under half of his time in the fights ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
