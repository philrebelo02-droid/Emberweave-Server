'use strict';
/* Tessit's talents as data on the mechanics layer (talents-mech/tessit.js), group by group on the still field (tests/talents-lab.js), then whole fights, the
   no-talent identity of the page lines her talents added, Phil's 95% damage-reduction ceiling and the stun-lock rule.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Tessit, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6); A0 (0,-5.5) A1 (0,-11). Bodies: Tessit 1.56 m, a Vael 2.01 m.
   The lab casts a skill as it lands (Sleight of Hours on the target given; Hourglass centred on its target, 4.26 m centre to centre). Sleight of Hours gives to
   "the fastest ally" by the case's own measure (the highest haste multiplier, ties to the first in the units order: Tessit herself in the lab); a test that
   needs an ally to receive raises that ally's hasteMul a little first. None of her skills is in the reach audit's list, so no placement waits for v1391.
   Unwind is the page's own passive: tests free the allies (a held unit is stunned, so it would be cleansed) and run it with unwindNow().
   Run: node --test tests/talents-mech-tessit.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='tessit', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&m.until>V.now()+1e-9)?m.v:0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); if(!n){ delete o['#'+name]; return; } o['#'+name]={v:n,until:V.now()+(d||99)}; };
const left=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o[name]; return m&&m.until!=null?m.until-V.now():0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const rel=(a,b,msg,eps)=>assert.ok(Math.abs(a-b)<=(eps||1e-6)*Math.max(1e-12,Math.abs(b)),(msg||'')+': '+a+' vs '+b);
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage unless said)
const inRatio=(L,o)=>hitOn(L,L.v,1000,o)/plainHit(L,()=>hitOn(L,L.v,1000,o));
const allyRatio=(L,a,o)=>hitOn(L,a,1000,o)/plainHit(L,()=>hitOn(L,a,1000,o));
const teamRatio=(L,src,t)=>lost(t,()=>V.hit(src,t,1000,{kind:'true'}))/plainHit(L,()=>lost(t,()=>V.hit(src,t,1000,{kind:'true'})));
const hitRatio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'magic'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'magic'},o||{}))));
const healRatio=(L,t,a)=>{ const g=()=>{ t.hp=t.maxHp*0.5; const h=t.hp; V.heal(t,a); return t.hp-h; }; return g()/plainHit(L,g); };
const kill=t=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const free=(...xs)=>{ for(const x of xs){ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=1e9; x.blueCd=1e9; } };
const lv1=(...xs)=>{ for(const x of xs) x.level=1; };
const skLv=(type,ab,lv)=>VMX('skLvNum')(type,ab,lv);
const SS=L=>skLv('spdsteal',L.v.blueAb,10), ACC=L=>skLv('dmgbuff',L.v.greenAb,10);
const apOf=L=>L.v.apow, mag=(L,t)=>VMX('defMul')(L.v,t,'magic');
const auto=(L,t,amt)=>V.hit(L.v,t,amt==null?1:amt,{auto:true,kind:'magic'});   // one basic attack of hers
/* Unwind (the page's passive): free every unit of her side (a held unit is stunned, so it is cleansed first), then run it once in the next step */
const freeSide=L=>free(L.v,...L.A);
const uwBase=L=>VMX('SKLV.unwind')(VMX('passLv')(L.v));
function unwindNow(L){ L.v._uwT=uwBase(L)-(L.v._talUwOff||0)-V.STEP/2; V.step(1); }
const budget=L=>{ L.T.s.tsHb=1e18; };
const hk=(L,t)=>plainHit(L,()=>{ const h0=t.hp; t.hp=t.maxHp*0.5; const a=t.hp; V.heal(t,1000); const g=t.hp-a; t.hp=h0; return g/1000; });   // what a heal of 1 gives that unit (the game's own healing received: a Support beside it)                     // her self-heal budget out of the way for a measure of a heal's size

test('Tessit: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['lg_2_4','lg_7_4','lg_12_1','uw_1_3','uw_10_3','uw_12_3','bg_2_1','bg_7_1','bg_12_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Tessit: her real kit, as the talents read it - Sleight of Hours, Accelerate, Hourglass, Unwind, her magic hits',()=>{
  plain({foes:3,allies:1},P=>{ const {v,F,A}=P; const p=SS(P); near(p,0.35+0.001*9,'Sleight of Hours at skill level 10: 35% + 0.1 point a level above 1');
    V.cast(v,'blue',F[0]); near(F[0].hasteMul,1-p,'the shot\'s target is robbed'); near(F[0].hasteT,5,'for 5 s'); near(v.hasteMul,1+p,'"the fastest ally": all at x1, the first in line - herself'); near(A[0].hasteMul||1,1,'not the other ally');
    F[0].hasteMul=1; v.hasteMul=1; A[0].hasteMul=1.01; V.cast(v,'blue',F[0]); near(A[0].hasteMul,1+p,'an ally with a higher haste multiplier is "the fastest"');
    V.cast(v,'green',F[0]); const m=ACC(P); for(const x of [v,A[0]]){ near(x.dmgBuffMul,m,'Accelerate: every ally, her included'); near(x.dmgBuffT,6,'6 s'); }
    free(F[0]); lv1(F[0]); const d=lost(F[0],()=>V.cast(v,'ult',F[0])); assert.ok(d>0,'Hourglass strikes its target'); near(F[0].stunned,1.4,'and stuns it 1.4 s (2 s written, 30% cut)',1e-9);
    assert.equal(v.t.damageProfile,'Magic','her damage profile: her basic attacks and Hourglass\'s hit are magic'); near(VMX('ULT_DEF.aoeStun.radius')/V.METER,4.26,'Hourglass reaches 4.26 m (centre to centre)',1e-2); });
  plain({foes:3,allies:1},P=>{ freeSide(P); P.A[0].slow=2; unwindNow(P); assert.ok(!(P.A[0].slow>0),'Unwind: the one hurt ally loses its slow');
    P.A[0].slow=2; P.A[0].silencedT=2; V.dot(P.A[0],5,4,1,P.F[0]); unwindNow(P); assert.equal(P.A[0].dots.length,0,'the DoT first'); assert.ok(P.A[0].silencedT>0&&P.A[0].slow>0,'one effect a time');
    P.v._uwT=uwBase(P)-0.1; V.step(1); assert.ok(P.A[0].silencedT>0,'not before its interval'); });
});

/* ============================== THE LEDGER ============================== */
test('Tessit / Sand: Sleight pours 1 (max 6 + Deep Glass), Spare Change each wave, team attack speed and her ability power per Sand; Hundred and Forty Years, Calm Thief',()=>{
  let ap0, ai0; plain({foes:3,allies:1,big:true},P=>{ ap0=P.v.apow; ai0=P.A[0].atkInterval; });
  const L=lab(H,S(['lg_1_2','lg_2_2','lg_12_4','lg_10_2','lg_11_1','lg_1_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; V.step(1);
  assert.equal(stack(L,'tsSand'),2,'Spare Change: each wave starts with 1 x 2'); near(v.apow,ap0*(1+0.015*2),'Running Total: 0.3% x 5 ability power per Sand',1e-9); near(ai0/A[0].atkInterval,1+0.02*2,'Upper Chamber: her team 0.4% x 5 attack speed per Sand',1e-9);
  rel(inRatio(L),1,'below 3 Sand and no theft: no reduction'); V.cast(v,'blue',F[0]); assert.equal(stack(L,'tsSand'),3,'a Sleight pours 1');
  rel(inRatio(L),0.925*0.91,'Hundred and Forty Years 1.5% x 5 at 3 Sand; Calm Thief 3% x 3 while the theft runs',1e-9); secs(5.1); rel(inRatio(L),0.925,'Calm Thief: the theft\'s 5 s',1e-9);
  setStack(L,'tsSand',9); V.cast(v,'blue',F[0]); assert.equal(stack(L,'tsSand'),9,'at most 6 + 1 x 3'); V.wave(); V.step(1); assert.equal(stack(L,'tsSand'),2,'a new wave: back to Spare Change');
  const L2=lab(H,S(['lg_1_2']),{foes:3}); setStack(L2,'tsSand',3); V.wave(); V.step(1); assert.equal(stack(L2,'tsSand'),0,'kept for the wave only');
});

test('Tessit / the steal: Light Touch, Living on Credit (RISK), Grand Theft and Petty Theft (PICK ONE)',()=>{
  const L=lab(H,S(['lg_3_1','lg_6_4']),{foes:3,big:true}), {v,F}=L; const p=SS(L); V.cast(v,'blue',F[0]); near(F[0].hasteMul,1-p*1.13,'1% x 5 and 4% x 2 more stolen (they multiply its share)',1e-9); near(v.hasteMul,1+p*1.13,'',1e-9);
  rel(inRatio(L),1.06,'Living on Credit: 3% x 2 more damage taken',1e-9);
  const G=lab(H,S(['lg_5_1']),{foes:3}); V.cast(G.v,'blue',G.F[0]); near(G.F[0].hasteMul,1-p*1.15,'Grand Theft: 15% more',1e-9); near(FX.cd(G.v,'blue',10),12,'2 s slower',1e-9);
  const Q=lab(H,S(['lg_5_3']),{foes:3}); V.cast(Q.v,'blue',Q.F[0]); near(Q.F[0].hasteMul,1-p*0.9,'Petty Theft: 10% less',1e-9); near(FX.cd(Q.v,'blue',10),7,'3 s sooner',1e-9);
});

test('Tessit / Full Glass: at full Sand the two fastest enemies to the two fastest allies',()=>{
  const L=lab(H,S(['lg_1_2','lg_2_2','lg_3_2']),{foes:3,allies:2}), {v,F,A}=L; const p=SS(L);
  setStack(L,'tsSand',8); A[0].hasteMul=1.02; A[1].hasteMul=1.01; V.cast(v,'blue',F[0]); near(F[0].hasteMul,1-p); assert.ok(!(F[1].hasteMul<1),'below full: one enemy'); near(A[1].hasteMul,1.01,'and one ally');
  F[0].hasteMul=1; A[0].hasteMul=1.02; setStack(L,'tsSand',9); V.cast(v,'blue',F[0]); near(F[0].hasteMul,1-p,'full: the target'); near(F[1].hasteMul,1-p,'and the next fastest enemy'); near(F[1].hasteT,5); assert.ok(!(F[2].hasteMul<1),'not a third');
  near(A[0].hasteMul,1+p,'the fastest ally'); near(A[1].hasteMul,1+p,'and the next'); near(A[1]._ocT,5); assert.ok(mark(L,A[1],'tsGot'),'both carry stolen speed');
});

test('Tessit / Debt: when the theft ends (Written Down, Time Owed, Interest), Compound, Called In',()=>{
  const L=lab(H,S(['lg_2_3','lg_4_3','lg_12_2','lg_8_1','lg_9_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; const ai=F[0].atkInterval;
  V.cast(v,'blue',F[0]); assert.ok(mark(L,F[0],'tsRob'),'robbed'); secs(4.9); assert.ok(!mark(L,F[0],'tsDebt'),'not while the theft runs'); const t0=V.now(); while(!mark(L,F[0],'tsDebt')&&V.now()<t0+1) V.step(1); assert.ok(mark(L,F[0],'tsDebt'),'in Debt as it ends'); near(left(L,F[0],'tsDebt'),4.5,'Interest: 3 s + 0.5 s x 3',0.01);
  V.step(1); near(ai/F[0].atkInterval,1-0.10-0.02,'2% x 5 + 0.4% x 5 slower attacks',1e-9); rel(teamRatio(L,A[0],F[0]),1.03,'Compound: 1% x 3 more from her team',1e-9); rel(teamRatio(L,v,F[0]),1.03,'(her own hits too)',1e-9);
  secs(4.6); assert.ok(!mark(L,F[0],'tsDebt')); V.step(1); near(F[0].atkInterval,ai,'its slow ends with it',1e-9);
  V.cast(v,'blue',F[1]); secs(5.1); assert.ok(mark(L,F[1],'tsDebt')); const s0=stack(L,'tsSand'); A[0].energy=10; v.energy=20; kill(F[1]); V.step(1);
  near(A[0].energy,15,'Called In: every ally 5 energy'); near(v.energy,25,'her too'); assert.equal(stack(L,'tsSand'),s0+1,'and Tessit 1 Sand');
  const e0=A[0].energy; kill(F[2]); V.step(1); near(A[0].energy,e0,'not an enemy that was not in Debt');
});

test('Tessit / Pocketed: A Minute Off (3 stacks, 8 s + Deep Pockets), Pickpocket, Pocket Watch',()=>{
  const L=lab(H,S(['lg_4_4','lg_5_4','lg_10_4','lg_8_4']),{foes:3,big:true}), {v,F}=L; const ai0=v.atkInterval; budget(L); v.hp=v.maxHp*0.5;
  let h=v.hp; V.cast(v,'blue',F[0]); assert.equal(stack(L,'tsPk'),1); near(v.hp-h,0.03*v.maxHp*hk(L,v),'Pickpocket: 1% x 3 of her max HP as it stacks',1e-9);
  V.cast(v,'blue',F[0]); V.cast(v,'blue',F[0]); h=v.hp; V.cast(v,'blue',F[0]); assert.equal(stack(L,'tsPk'),3,'up to 3'); near(v.hp,h,'no heal when it cannot stack',1e-9);
  V.step(1); near(ai0/v.atkInterval,1.15,'1% x 5 faster per stack',1e-9);
  L.T.s.tsHb=0.012*v.maxHp; setStack(L,'tsPk',1); h=v.hp; V.cast(v,'blue',F[0]); near(v.hp-h,0.012*v.maxHp*hk(L,v),'her self-heals share one budget: 1.2% of her max HP a second',1e-6);
  free(v); v.greenCd=50; setStack(L,'tsPk',2); V.step(3); let g=v.greenCd; secs(1); const d2=g-v.greenCd; setStack(L,'tsPk',3); V.step(3); g=v.greenCd; secs(1);
  near((g-v.greenCd)/d2,1.06,'Pocket Watch: at 3 Pocketed her skills come back 3% x 2 faster (than at 2)',1e-6); v.stunned=1e6;
  setStack(L,'tsPk',3); V.cast(v,'blue',F[0]); secs(10.8); assert.equal(stack(L,'tsPk'),3,'Deep Pockets: 8 s + 1 s x 3'); secs(0.4); assert.equal(stack(L,'tsPk'),0,'then gone');
});

test('Tessit / Accelerate: Sharp Accelerate, Patient Sand, Measured Pace, Wide Accelerate',()=>{
  const L=lab(H,S(['lg_4_1','uw_9_3','lg_6_2','uw_3_4']),{foes:3,allies:1}), {v,F,A}=L; const m=ACC(L);
  V.cast(v,'green',F[0]); for(const x of [v,A[0]]){ near(x.dmgBuffMul,1+(m-1)*(1+0.045+0.05),'its bonus 1.5% x 3 and 1% x 5 larger',1e-9); near(x.dmgBuffT,6+1+1,'0.2 s x 5 longer, twice',1e-9); }
});

test('Tessit / Accelerate the Theft, Stolen Edge, Lent Hours, Swift Ally',()=>{
  const L=lab(H,S(['lg_7_3','lg_9_3','lg_8_2','lg_5_2']),{foes:3,allies:2,big:true}), {v,F,A}=L; const p=SS(L); A[1].hasteMul=1.01; const mv=A[1].speed;
  V.cast(v,'green',F[0]); assert.equal(stack(L,'tsSand'),1,'Accelerate adds 1 Sand'); near(A[1].hasteMul,1+p/3*1.05,'the fastest ally gains a third of the steal, 1% x 5 larger',1e-9); near(A[1].hasteT,6,'for Accelerate\'s 6 s');
  near(A[0].hasteMul||1,1,'not the other'); assert.ok(mark(L,A[1],'tsGot')); rel(teamRatio(L,A[1],F[0]),1.05,'Lent Hours: an ally with stolen speed deals 1% x 5 more',1e-9); rel(teamRatio(L,A[0],F[0]),1,'not one without');
  V.step(1); near(A[1].speed,mv*1.10,'Swift Ally: it moves 2% x 5 faster',1e-9); secs(6.1); assert.ok(!mark(L,A[1],'tsGot'),'for its 6 s'); V.step(1); near(A[1].speed,mv,'',1e-9);
});

test('Tessit / Quick Fingers, Sand in the Gears, Bold Hand (with Grand Theft); Many Small Hours (with Petty Theft)',()=>{
  const L=lab(H,S(['lg_1_4','lg_9_4','lg_5_1','lg_6_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; const mv=F[0].speed;
  const d=lost(F[0],()=>V.cast(v,'blue',F[0])); rel(d,0.30*apOf(L)*mag(L,F[0]),'Quick Fingers: 6% x 5 of her ability power, magic',1e-6); assert.equal(F[1].hp,F[1].maxHp,'only the robbed enemy');
  V.step(1); near(F[0].speed,mv*0.90,'Sand in the Gears: 2% x 5 slower while robbed',1e-9); rel(inRatio(L,{src:F[0]}),0.94,'Bold Hand: the robbed enemy deals 2% x 3 less (to her)',1e-9); rel(allyRatio(L,A[0],{src:F[0]}),0.94,'(and to her allies)',1e-9);
  rel(inRatio(L,{src:F[1]}),1,'not an enemy she did not rob'); secs(5.1); rel(inRatio(L,{src:F[0]}),1,'only while robbed'); V.step(1); near(F[0].speed,mv,'',1e-9);
  const M=lab(H,S(['lg_5_3','lg_6_3']),{foes:3,allies:1}); M.A[0].hasteMul=1.01; M.F[0].energy=50; M.A[0].energy=10; V.cast(M.v,'blue',M.F[0]); near(M.F[0].energy,44,'Many Small Hours: 2 x 3 energy from the robbed enemy'); near(M.A[0].energy,16,'to the fastest ally');
  M.F[0].energy=3; M.A[0].energy=0; V.cast(M.v,'blue',M.F[0]); near(M.F[0].energy,0); near(M.A[0].energy,3,'never more than it has');
});

test('Tessit / Borrowed Calm (LINK): each Sand gained, the ally with the most negative effects takes 4% less for 3 s; with Wiped Clean also Clear 1 s',()=>{
  const L=lab(H,S(['lg_1_2','lg_n1']),{foes:3,allies:2,big:true}), {v,F,A}=L; A[1].slow=99; V.cast(v,'blue',F[0]);
  assert.ok(mark(L,A[1],'tsCalm'),'the ally with a negative effect'); assert.ok(!mark(L,A[0],'tsCalm')); rel(allyRatio(L,A[1]),0.96,'4% less',1e-9); rel(allyRatio(L,A[0]),1,'',1e-9); assert.ok(!mark(L,A[1],'tsClr'),'no Clear without Wiped Clean');
  secs(3.1); rel(allyRatio(L,A[1]),1,'for 3 s'); const L2=lab(H,S(['lg_1_2','lg_n1','uw_2_2']),{foes:3,allies:2}); L2.A[1].slow=99; V.cast(L2.v,'blue',L2.F[0]); assert.ok(mark(L2,L2.A[1],'tsClr'),'with Wiped Clean: Clear'); near(left(L2,L2.A[1],'tsClr'),1,'for 1 s',1e-9);
});

test('Tessit / Borrowed Hourglass, Glassful, Shard Spray: every enemy Hourglass stuns robbed 21% for 5 s, to the ally nearest it; 1% x 5 more from her team for 4 s',()=>{
  const L=lab(H,S(['lg_11_3','lg_12_3','bg_6_3']),{foes:3,allies:1,big:true}), {v,F,A}=L; free(F[0]); lv1(F[0]);
  V.cast(v,'ult',F[0]); near(F[0].stunned,1.4,'stunned'); near(F[0].hasteMul,1-0.21,'robbed of 20% (1% x 5 more)',1e-9); near(F[0].hasteT,5); near(v.hasteMul,1.21,'given to the ally nearest it (her: 4.5 m; the other 7.1 m)',1e-9); near(A[0].hasteMul||1,1);
  assert.ok(mark(L,F[0],'tsRob'),'it counts as robbed'); rel(teamRatio(L,A[0],F[0]),1.05,'Shard Spray: a stunned enemy takes 1% x 5 more from her team',1e-9); rel(teamRatio(L,A[0],F[1]),1,'not one it did not stun');
  secs(4.1); rel(teamRatio(L,A[0],F[0]),1,'for 4 s');
});

test('Tessit / Whose Afternoon (SIGNATURE): at full Sand Hourglass empties the glass - every enemy inside robbed 40% for 6 s, every ally gains it, Debt twice as long',()=>{
  const L=lab(H,S(['lg_1_2','lg_13_3','lg_2_3']),{foes:3,allies:1}), {v,F,A}=L; free(F[0]); lv1(F[0]);
  setStack(L,'tsSand',5); V.cast(v,'ult',F[0]); assert.ok(!(F[0].hasteMul<1),'not below full Sand'); assert.equal(stack(L,'tsSand'),5);
  F[0].stunned=0; setStack(L,'tsSand',6); V.cast(v,'ult',F[0]); assert.equal(stack(L,'tsSand'),0,'the glass empties'); near(F[0].hasteMul,0.6,'40% robbed'); near(F[0].hasteT,6,'6 s'); assert.ok(!(F[1].hasteMul<1),'not an enemy outside the circle');
  near(v.hasteMul,1.4,'every ally gains it'); near(A[0].hasteMul,1.4); near(A[0].hasteT,6); secs(5.9); assert.ok(!mark(L,F[0],'tsDebt')); secs(0.2); assert.ok(mark(L,F[0],'tsDebt'),'then Debt'); near(left(L,F[0],'tsDebt'),6,'twice as long (3 s x 2)',0.05);
});

/* ============================== UNWINDING ============================== */
test('Tessit / Burden: each effect Unwind lifts (max 5 + Heavier Glass), Lift It Off, Shouldered, Weight of Years, Grief Kept, Put It in the Glass, Load Bearer, Long Carry',()=>{
  let ar0, hp0; plain({foes:3,allies:1,big:true},P=>{ ar0=P.v.armorRating; hp0=P.v.healPowMul||1; });
  const L=lab(H,S(['uw_1_1','uw_2_1','uw_4_1','uw_11_1','uw_5_1','uw_8_1','uw_10_1','uw_9_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; freeSide(L); budget(L); v.hp=v.maxHp*0.5;
  A[0].slow=2; const h=v.hp, sh=A[0].shield||0; unwindNow(L); assert.ok(!(A[0].slow>0)); assert.equal(stack(L,'tsBur'),1,'1 Burden'); near(v.hp-h,0.025*v.maxHp*hk(L,v),'Grief Kept: 0.5% x 5 of her max HP',1e-9); near((A[0].shield||0)-sh,0.04*A[0].maxHp,'Put It in the Glass: the ally it came from shielded 4% of its max HP',1e-9);
  rel(inRatio(L),0.97,'Lift It Off: 0.6% x 5 per Burden',1e-9); V.step(1); near(v.armorRating,ar0*1.025,'Shouldered: 0.5% x 5 armor per Burden',1e-9); near(v.healPowMul,hp0*1.015,'Weight of Years: 0.3% x 5 healing power per Burden',1e-9);
  setStack(L,'tsBur',7); A[0].slow=2; unwindNow(L); assert.equal(stack(L,'tsBur'),8,'up to 5 + 1 x 3'); A[0].slow=2; unwindNow(L); assert.equal(stack(L,'tsBur'),8);
  rel(inRatio(L),(1-0.24)*0.91,'Load Bearer: at full Burden 3% x 3 less (with 8 x 3%)',1e-9); setStack(L,'tsBur',7); rel(inRatio(L),1-0.21,'not below full',1e-9);
  V.wave(); V.step(1); assert.equal(stack(L,'tsBur'),3,'Long Carry: 1 x 3 kept between waves');
  const L2=lab(H,S(['uw_1_1']),{foes:3,allies:1}); freeSide(L2); L2.A[0].slow=2; unwindNow(L2); setStack(L2,'tsBur',4); V.wave(); V.step(1); assert.equal(stack(L2,'tsBur'),0,'without it a wave starts empty');
});

test('Tessit / Clear (Wiped Clean): new negative effects last half as long; Clear Air, Ledger of Griefs, Mending Sand',()=>{
  const L=lab(H,S(['uw_2_2','uw_4_2','uw_12_4','uw_7_1','uw_1_1','uw_9_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; freeSide(L);
  A[0].slow=2; unwindNow(L); assert.equal(stack(L,'tsBur'),1); near(left(L,A[0],'tsClr'),5+0.3,'Clear 1 s x 5, Ledger of Griefs 0.1 s x 3 per Burden',0.05);
  rel(allyRatio(L,A[0]),0.94,'Clear Air: 2% x 3 less',1e-9); V.step(1);
  A[0].slow=2; V.step(1); near(A[0].slow,1,'a new slow lasts half as long',0.05); V.dot(A[0],10,4,1,F[0]); V.step(1); assert.equal(A[0].dots[A[0].dots.length-1].remaining,2,'a new DoT half as long');
  const sh=A[0].shield||0; A[0].slow=2; unwindNow(L); near((A[0].shield||0)-sh,0.04*1.15*A[0].maxHp,'Mending Sand: her shields 3% x 5 stronger on a Clear ally',1e-9);
  A[0].dots.length=0; A[0].slow=0; secs(6); assert.ok(!mark(L,A[0],'tsClr')); A[0].slow=0; V.step(1); A[0].slow=2; V.step(1); near(A[0].slow,2,'once Clear is over: as long as written',0.05);
});

test('Tessit / Kind Hands and Carry It: the cleansed ally healed 8% x 5 of her ability power; a lifted DoT goes on her at half strength',()=>{
  const L=lab(H,S(['uw_3_3','uw_3_1','uw_1_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; freeSide(L); A[0].hp=A[0].maxHp*0.5;
  V.dot(A[0],100,6,1,F[0]); const h=A[0].hp; unwindNow(L); assert.equal(A[0].dots.length,0,'the DoT lifted'); near(A[0].hp-h,0.40*apOf(L)*(v.healPowMul||1)*hk(L,A[0]),'Kind Hands',1e-6);
  const d=v.dots[v.dots.length-1]; assert.ok(d,'Carry It: it goes on her'); near(d.dps,50,'at half strength'); assert.ok(d.remaining>=5,'for the time it had left');
  const L2=lab(H,S(['uw_3_3']),{foes:3,allies:1}); freeSide(L2); V.dot(L2.A[0],100,6,1,L2.F[0]); unwindNow(L2); assert.equal(L2.v.dots.length,0,'without Carry It: gone');
});

test('Tessit / Careful Hand (PICK ONE): the ally with the most negative effects, 2 of them; Double Lift',()=>{
  const L=lab(H,S(['uw_5_2','uw_6_2','uw_1_1']),{foes:3,allies:2,big:true}), {v,F,A}=L; freeSide(L); A[0].slow=9; A[1].slow=9; A[1].silencedT=9; V.dot(A[1],5,6,1,F[0]); A[1].hp=A[1].maxHp*0.5;
  const h=A[1].hp; unwindNow(L); assert.equal(A[1].dots.length,0); assert.ok(!(A[1].silencedT>0),'two lifted: the DoT and the silence'); assert.ok(A[1].slow>0,'not a third'); assert.ok(A[0].slow>0,'not the ally with fewer');
  assert.equal(stack(L,'tsBur'),2,'2 Burden'); near(A[1].hp-h,0.06*A[1].maxHp*(v.healPowMul||1)*hk(L,A[1]),'Double Lift: 2% x 3 of its max HP',1e-9);
});

test('Tessit / Wide Hand (PICK ONE): every second Unwind lifts one effect from 2 allies; Many Hands',()=>{
  const L=lab(H,S(['uw_5_3','uw_6_3','uw_2_2','uw_1_1']),{foes:3,allies:2}), {v,F,A}=L; freeSide(L); A[0].slow=9; A[1].slow=9;
  unwindNow(L); assert.equal(stack(L,'tsBur'),1,'the first: one'); const one=A[0].slow>0?A[1]:A[0]; near(left(L,one,'tsClr'),5,'Clear 1 s x 5',0.05);
  A[0].slow=9; A[1].slow=9; unwindNow(L); assert.equal(stack(L,'tsBur'),3,'the second: both'); assert.ok(!(A[0].slow>0)&&!(A[1].slow>0));
  for(const a of A) near(left(L,a,'tsClr'),5+0.9,'Many Hands: both Clear 0.3 s x 3 longer',0.05);
});

test('Tessit / Tip the Glass: at full Burden the nearest enemy is Poured, the glass empties when it ends; Heavy Pour, Spilled, Steady Pour, Back to Them, Pour Again',()=>{
  const L=lab(H,S(['uw_1_1','uw_4_4','uw_5_4','uw_7_4','uw_12_1','uw_8_4','uw_10_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; freeSide(L); const ai=F[0].atkInterval;
  setStack(L,'tsBur',4); A[0].slow=2; unwindNow(L); assert.equal(stack(L,'tsBur'),5); assert.ok(mark(L,F[0],'tsPour'),'the enemy nearest her'); assert.ok(!mark(L,F[1],'tsPour'));
  rel(inRatio(L,{src:F[0]}),0.85*0.91,'it deals 3% x 3 less (with 5 Burden x 3%)',1e-9); rel(allyRatio(L,A[0],{src:F[0]}),0.91,'(also to her allies)',1e-9);
  V.step(1); near(ai/F[0].atkInterval,0.95,'Heavy Pour: 1% x 5 slower attacks',1e-9); rel(healRatio(L,F[0],1000),0.90,'Spilled: 2% x 5 less healing',1e-9); rel(teamRatio(L,A[0],F[0]),1.02,'Steady Pour: 1% x 2 more from her team',1e-9);
  near(left(L,F[0],'tsPour'),6,'Back to Them: 4 s + 1 s x 2',0.05); secs(5.8); assert.equal(stack(L,'tsBur'),5,'full while it is Poured'); secs(0.3); assert.ok(!mark(L,F[0],'tsPour')); assert.equal(stack(L,'tsBur'),3,'then it empties; Pour Again refills 1 x 3');
});

test('Tessit / Unwind sooner: Quick Unwind, Clean Books, Clear Sight, Glass Heart (RISK) - at most 1.5 s in all',()=>{
  const L=lab(H,S(['uw_2_3']),{foes:3,allies:1}), {v,A}=L; near(v._talUwOff,0.9,'0.3 s x 3',1e-12); freeSide(L); const I=uwBase(L)-0.9;
  A[0].slow=9; v._uwT=I-0.05; V.step(1); assert.ok(A[0].slow>0,'not before'); v._uwT=I-V.STEP/2; V.step(1); assert.ok(!(A[0].slow>0),'0.9 s sooner');
  const L2=lab(H,S(['uw_2_3','lg_10_3','bg_11_1','uw_6_4']),{foes:3,big:true}); near(L2.v._talUwOff,1.5,'together at most 1.5 s',1e-12); rel(inRatio(L2),1.06,'Glass Heart: 3% x 2 more damage taken',1e-9);
  const L3=lab(H,S(['uw_6_4']),{foes:3}); near(L3.v._talUwOff,0.8,'Glass Heart: 0.4 s x 2',1e-12);
});

test('Tessit / Grains of Calm: controls on her 5% x 3 shorter (up to 15%)',()=>{
  const L=lab(H,S(['uw_1_4']),{foes:3}), {v,F}=L; v.stunned=0; near(FX.cc(F[0],v,'stunned',2),1.7,'15% shorter',1e-9);
});

test('Tessit / Clean Theft: the ally Sleight speeds is Unwound and Clear 2 s; Clear Run',()=>{
  const L=lab(H,S(['uw_7_2','uw_9_2','uw_1_1']),{foes:3,allies:1}), {v,F,A}=L; const mv=A[0].speed; free(A[0]); A[0].speed=mv; A[0].hasteMul=1.01; A[0].slow=9;
  V.cast(v,'blue',F[0]); assert.ok(!(A[0].slow>0),'Unwound at once'); assert.equal(stack(L,'tsBur'),1,'(a Burden)'); near(left(L,A[0],'tsClr'),2,'Clear 2 s',1e-9);
  V.step(1); near(A[0].speed,mv*1.10,'Clear Run: 2% x 5 faster while Clear',1e-9); secs(2.1); V.step(1); near(A[0].speed,mv,'',1e-9);
});

test('Tessit / Hourglass of Grief and Sorrow Glass: every Burden poured into the enemies it stuns, one effect off every ally; its stun 0.06 s x 5 longer',()=>{
  const L=lab(H,S(['uw_11_2','uw_12_2','uw_1_1']),{foes:3,allies:1}), {v,F,A}=L; free(F[0],A[0]); lv1(F[0]); setStack(L,'tsBur',3); A[0].slow=9;
  V.cast(v,'ult',F[0]); near(F[0].stunned,1.4+0.3,'1.4 s + 0.3 s',1e-9); assert.ok(mark(L,F[0],'tsPour'),'Poured'); assert.ok(!mark(L,F[1],'tsPour'),'not one it did not stun'); assert.equal(stack(L,'tsBur'),0,'every Burden poured');
  assert.ok(!(A[0].slow>0),'one effect lifted from every ally'); assert.equal(stack(L,'tsBur'),0,'(those give no Burden)');
});

test('Tessit / Quiet Sand: allies near her (5 m) take 0.5% x 5 less',()=>{
  const L=lab(H,S(['uw_11_4']),{foes:3,allies:2}), {A}=L; rel(allyRatio(L,A[0]),0.975,'an ally 1.9 m from her',1e-9); rel(allyRatio(L,A[1]),1,'not one 7.4 m away',1e-9);
});

test('Tessit / Nothing Left to Lift (SIGNATURE): once a wave, full Burden and an ally under 30% - every ally cleansed, Clear 5 s, shielded 2% per Burden; every enemy Poured',()=>{
  const L=lab(H,S(['uw_1_1','uw_13_2']),{foes:3,allies:2,big:true}), {v,F,A}=L; freeSide(L); setStack(L,'tsBur',4); A[0].slow=9; A[0].hp=A[0].maxHp*0.25; V.step(2); assert.ok(A[0].slow>0||stack(L,'tsBur')>=5,'not below full Burden');
  setStack(L,'tsBur',5); A[0].slow=9; V.dot(A[1],5,6,1,F[0]); const sh=A[1].shield||0; V.step(1);
  assert.ok(!(A[0].slow>0)&&A[1].dots.length===0,'every ally cleansed'); for(const a of [v,A[0],A[1]]) near(left(L,a,'tsClr'),5,'Clear 5 s',0.05); near((A[1].shield||0)-sh,0.10*A[1].maxHp,'2% x 5 Burden of its max HP',1e-9);
  for(const e of F) assert.ok(mark(L,e,'tsPour'),'every enemy Poured'); assert.equal(stack(L,'tsBur'),5,'her glass stays full');
  A[0].slow=9; V.step(2); assert.ok(A[0].slow>0,'once a wave'); V.wave(); V.step(1); setStack(L,'tsBur',5); A[0].slow=9; V.step(1); assert.ok(!(A[0].slow>0),'a new wave: again');
});

test('Tessit / Settled Sand, Well Kept, Steady Grip, Unshaken Glass',()=>{
  const L=lab(H,S(['uw_6_1','bg_9_1','lg_11_4','bg_3_1']),{foes:3,big:true}), {F}=L;
  rel(inRatio(L,{kind:'magic'}),0.95*0.95,'1% x 5 less magic damage, twice',1e-9); rel(inRatio(L),1,'not other damage'); rel(inRatio(L,{auto:true}),0.95,'Steady Grip: 1% x 5 less from basic attacks',1e-9);
  setUst(L,F[0],'tsGr',1); rel(inRatio(L),0.925,'Unshaken Glass: 1.5% x 5 less from an enemy carrying her Grains',1e-9); rel(inRatio(L,{src:F[1]}),1);
});

/* ============================== THE BROKEN GLASS ============================== */
test('Tessit / Grains: her basic attacks (6, 6 s + Heavy Grains); a lost moment - stun 0.3 s + Long Fall, 12% x 5 of her ability power; Sharp Mind, Grain by Grain, Brisk Hands',()=>{
  const L=lab(H,S(['bg_1_3','bg_2_3','bg_1_1','bg_12_3','bg_8_4','bg_7_4']),{foes:3,big:true}), {v,F}=L; free(F[0],F[1]); lv1(F[0]); const ai0=v.atkInterval; setUst(L,F[1],'tsGr',1);
  for(let i=0;i<5;i++) auto(L,F[0]); assert.equal(ust(L,F[0],'tsGr'),5,'1 a basic attack'); rel(hitRatio(L,F[0]),1+0.009*5,'Grain by Grain: 0.3% x 3 more from her per Grain',1e-9);
  v.target=F[0]; V.step(1); near(ai0/v.atkInterval,1.15,'Brisk Hands: 3% x 5 faster against an enemy carrying Grains',1e-9);
  auto(L,F[0]); const d=L.T.s.tsMoD; rel(d,0.60*apOf(L)*(1+0.15*1)*mag(L,F[0]),'the 6th: a lost moment, 12% x 5 of her ability power (Sharp Mind 3% x 5 for the other enemy carrying Grains)',1e-6);
  near(F[0].stunned,0.3+0.15,'stunned 0.3 s + 0.03 s x 5',1e-9); assert.equal(ust(L,F[0],'tsGr'),0,'the Grains are spent');
  auto(L,F[2]); secs(8.9); assert.equal(ust(L,F[2],'tsGr'),1,'Heavy Grains: 6 s + 1 s x 3'); secs(0.2); assert.equal(ust(L,F[2],'tsGr'),0);
});

test('Tessit / Slow Sand and Heavy Moment, Quick Sand and Rapid Grains (PICK ONE); the stun-lock rule',()=>{
  const L=lab(H,S(['bg_1_3','bg_5_2','bg_6_2']),{foes:3}), {v,F}=L; free(F[0]); lv1(F[0]); F[0].energy=50;
  for(let i=0;i<7;i++) auto(L,F[0]); assert.ok(!(F[0].stunned>0),'Slow Sand: not at 7'); F[0].energy=50; auto(L,F[0]); near(F[0].stunned,0.6,'at 8: 0.3 s longer',1e-9); near(F[0].energy,50+7-12,'Heavy Moment: 4 x 3 energy (after the 7 its hit gave)');
  const Q=lab(H,S(['bg_1_3','bg_5_4','bg_6_4']),{foes:3}); free(Q.F[0]); lv1(Q.F[0]); for(let i=0;i<4;i++) auto(Q,Q.F[0]); near(Q.F[0].stunned,0.2,'Quick Sand: at 4, 0.1 s shorter',1e-9);
  near(Q.F[0].slowMul,0.85,'Rapid Grains: 5% x 3 slower',1e-9); near(Q.F[0].slow,2,'for 2 s',1e-9);
  const f=Q.F[0]; while(f.stunned>0) V.step(1); V.step(Math.round(0.3/V.STEP)); for(let i=0;i<4;i++) auto(Q,f); assert.ok(!(f.stunned>0),'never within 0.5 s after her stun on it ended'); assert.equal(Q.T.s.tsStL.length,1);
  V.step(Math.round(0.3/V.STEP)); for(let i=0;i<4;i++) auto(Q,f); assert.equal(Q.T.s.tsStL.length,2,'after it: stunned again'); while(f.stunned>0) V.step(1); V.step(Math.round(0.6/V.STEP));
  for(let i=0;i<4;i++) auto(Q,f); assert.equal(Q.T.s.tsStL.length,2,'never a third time in 10 s'); f.stunned=1; delete f._talM[Q.v.uid].tsSc; for(let i=0;i<4;i++) auto(Q,f); assert.equal(Q.T.s.tsStL.length,2,'never on an enemy that is stunned');
});

test('Tessit / Sand Storm: a lost moment scatters 2 Grains into every enemy within 2 m',()=>{
  const L=lab(H,S(['bg_1_3','bg_8_4','bg_9_4']),{foes:4}), {v,F}=L; free(F[0]); lv1(F[0]); at(L,F[1],16,0); at(L,F[2],11,0); at(L,F[3],4.5,4.4);
  for(let i=0;i<6;i++) auto(L,F[0]); assert.equal(ust(L,F[3],'tsGr'),2,'an enemy 0.4 m from it'); assert.equal(ust(L,F[1],'tsGr'),0,'not one farther'); assert.equal(ust(L,F[2],'tsGr'),0,'(nor one 2.5 m away)');
});

test('Tessit / Lost Moments: Sleight of Hours fills the robbed enemy to 6 Grains',()=>{
  const L=lab(H,S(['bg_1_3','bg_2_3','bg_3_3']),{foes:3}), {v,F}=L; free(F[0]); lv1(F[0]); V.cast(v,'blue',F[0]); near(F[0].stunned,0.3,'it loses a moment',1e-9); assert.equal(L.T.s.tsMoN,1);
});

test('Tessit / Running Out: below 30% for 5 s - Faster Fall, the strike (Last Grains), Cracked Heart (RISK), Old Debt Paid, No Time Left, Sand\'s Edge',()=>{
  const L=lab(H,S(['bg_2_2','bg_4_2','bg_6_1','bg_11_4','bg_10_3','bg_10_2']),{foes:3,big:true}), {v,F}=L; budget(L);
  F[0].hp=F[0].maxHp*0.25; F[1].hp=F[1].maxHp*0.32; V.step(1); assert.ok(mark(L,F[0],'tsRun'),'Running Out'); assert.ok(!mark(L,F[1],'tsRun'),'not one above 30% (32%)');
  rel(inRatio(L,{src:F[0]}),0.95*1.04,'No Time Left: 1% x 5 less from it (Cracked Heart: 2% x 2 more taken)',1e-9);
  const s0=L.T.s; s0.cur='aoeStun'; const on=L.T.on.hit; L.T.on.hit=null; let r; try{ r=hitRatio(L,F[0]); } finally{ s0.cur=null; L.T.on.hit=on; } rel(r,1.12,'Sand\'s Edge: Hourglass 4% x 3 more on it',1e-9); rel(hitRatio(L,F[0]),1,'not her other hits',1e-9);
  v.hp=v.maxHp*0.5; const h=v.hp; let hp=F[0].hp; secs(3.4); assert.equal(L.T.s.tsRoN||0,0,'Faster Fall: 5 s - 0.5 s x 3'); secs(0.15); assert.equal(L.T.s.tsRoN,1,'then it strikes');
  rel(L.T.s.tsRoD,1.0*1.12*apOf(L)*mag(L,F[0]),'20% x 5 of her ability power, 6% x 2 harder, magic',1e-6); near(v.hp-h,0.05*v.maxHp*hk(L,v),'Old Debt Paid: 1% x 5 of her max HP',1e-9);
  secs(4); assert.equal(L.T.s.tsRoN,1,'once per drop below 30%'); F[0].hp=F[0].maxHp*0.5; V.step(1); F[0].hp=F[0].maxHp*0.25; V.step(1); assert.ok(mark(L,F[0],'tsRun'),'again after it came back above');
});

test('Tessit / Accelerated End and Hastened End: Accelerate starts Running Out on every enemy below 30%; its strikes 30% harder while Accelerate lasts',()=>{
  const L=lab(H,S(['bg_2_2','bg_7_2','bg_9_2']),{foes:3,big:true}), {v,F}=L; F[0].hp=F[0].maxHp*0.25; V.step(1); let hp=F[0].hp; secs(5.05); assert.equal(L.T.s.tsRoN,1); const base=L.T.s.tsRoD;
  rel(base,1.0*apOf(L)*mag(L,F[0]),'a plain strike',1e-6); secs(1); assert.ok(!mark(L,F[0],'tsRun'),'still below 30%: not again');
  V.cast(v,'green',F[0]); assert.ok(mark(L,F[0],'tsRun'),'Accelerate: at once'); hp=F[0].hp; secs(5.05); assert.equal(L.T.s.tsRoN,2); near(L.T.s.tsRoK,1.30*1.15,'its size',1e-9); rel(L.T.s.tsRoD,base*1.30*1.15,'30% harder while Accelerate lasts, Hastened End 3% x 5',1e-6);
});

test('Tessit / Every Grain Falls and Last Grain: Hourglass fills every enemy it hits to full Grains, below 50% it starts Running Out',()=>{
  const L=lab(H,S(['bg_1_3','bg_11_2','bg_12_2','bg_2_2']),{foes:3,big:true}), {v,F}=L; free(F[0]); lv1(F[0]); F[0].hp=F[0].maxHp*0.4;
  V.cast(v,'ult',F[0]); assert.equal(L.T.s.tsMoN,1,'a lost moment'); assert.ok(!(L.T.s.tsStL&&L.T.s.tsStL.length),'(its stun refused: Hourglass stunned it)'); assert.ok(mark(L,F[0],'tsRun'),'Running Out below 50%');
  const hp=F[0].hp; secs(5.05); rel(hp-F[0].hp,1.0*1.15*apOf(L)*mag(L,F[0]),'its strike 3% x 5 harder',1e-6);
});

test('Tessit / Turnover: every 10 s - Quick Turn, 3 s + Spin the Glass of 4% x 5 faster skills; Turned Twice, Upturned',()=>{
  const L=lab(H,S(['bg_4_1','bg_5_1','bg_12_1','bg_8_1','bg_10_1']),{foes:3,big:true}), {v,F}=L; free(v); v.greenCd=50; v.energy=0;
  secs(8.4); assert.ok(!win(L,'tsTurn'),'not before 10 s - 0.5 s x 3'); secs(0.2); assert.ok(win(L,'tsTurn'),'she turns her glass'); near(v.energy,4,'Turned Twice: 2 x 2 energy',1e-9);
  rel(hitRatio(L,F[0]),1.06,'Upturned: 2% x 3 more damage',1e-9); V.step(3); const g=v.greenCd; secs(1); const dOn=g-v.greenCd;
  secs(2.9); assert.ok(!win(L,'tsTurn'),'3 s + 0.5 s x 2'); rel(hitRatio(L,F[0]),1); V.step(3); const g2=v.greenCd; secs(1); near(dOn/(g2-v.greenCd),1.20,'her skills come back 4% x 5 faster during it',1e-6);
});

test('Tessit / The Sand Runs Out (SIGNATURE): Hourglass stuns 1 s longer, every enemy Running Out strikes at once, she turns her glass three times',()=>{
  const L=lab(H,S(['bg_2_2','bg_13_2','bg_8_3','bg_4_1']),{foes:3,big:true}), {v,F}=L; free(F[0]); lv1(F[0]); F[1].hp=F[1].maxHp*0.2; V.step(1); assert.ok(mark(L,F[1],'tsRun'));
  const hp=F[1].hp; V.cast(v,'ult',F[0]); near(F[0].stunned,1.4+0.25+1,'1.4 s + 0.05 s x 5 + 1 s',1e-9); assert.equal(L.T.s.tsRoN,1,'the Running Out strikes at once'); assert.ok(hp>F[1].hp); assert.ok(!mark(L,F[1],'tsRun'));
  assert.ok(win(L,'tsTurn')); near(L.T.s.w.tsTurn.t,9,'three Turnovers in a row',1e-9); secs(8.9); assert.ok(win(L,'tsTurn')); secs(0.2); assert.ok(!win(L,'tsTurn'));
  F[0].stunned=0; F[0].level=1; F[0].stunned=3.9; V.cast(v,'ult',F[0]); assert.ok(F[0].stunned<=4.0+1e-9,'never past 4.0 s');
});

test('Tessit / Hourglass: Bigger Shatter, Shatter Point, Second Shatter',()=>{
  let pd; plain({foes:4},P=>{ free(P.F[0],P.F[3]); lv1(P.F[0],P.F[3]); at(P,P.F[3],4.5,4.5); const h3=P.F[3].hp; pd=lost(P.F[0],()=>V.cast(P.v,'ult',P.F[0])); assert.equal(P.F[3].hp,h3,'a plain Hourglass does not reach 4.5 m'); });
  const L=lab(H,S(['bg_4_4','bg_5_3','bg_8_3']),{foes:4}), {v,F}=L; free(F[0],F[3]); lv1(F[0],F[3]); at(L,F[3],4.5,4.5); const h3=F[3].hp;
  rel(lost(F[0],()=>V.cast(v,'ult',F[0])),pd*1.15,'Shatter Point: 3% x 5 more',1e-6); assert.ok(F[3].hp<h3,'Bigger Shatter: 3% x 3 wider (4.64 m)'); near(F[0].stunned,1.4+0.25,'Second Shatter: 0.05 s x 5 longer',1e-9);
});

test('Tessit / Fine Sand, Keen Eye, Shard Edge; Patient Ledger and Gentle Turn',()=>{
  let r0; plain({foes:3},P=>{ r0=P.v.range; });
  const L=lab(H,S(['bg_1_4','lg_7_1','bg_3_4']),{foes:3}), {v,F}=L; near(v.range,r0*1.09,'Fine Sand: 3% x 3 longer reach',1e-9); V.wave(); V.step(1); near(v.range,r0*1.09,'(once)',1e-9);
  rel(hitRatio(L,F[0]),1.20,'2% x 5 more magic damage, twice',1e-9); rel(hitRatio(L,F[0],{kind:'true'}),1,'not other damage');
  const C=lab(H,S(['lg_3_4','uw_8_3']),{foes:3}); near(FX.cd(C.v,'green',8),8*0.95*0.95,'1% x 5 faster, twice',1e-9); near(FX.cd(C.v,'blue',10),10*0.95*0.95,'',1e-9);
});

test('Tessit / the caps: her damage reduction at most 40% in all, what her allies get at most 25%',()=>{
  const L=lab(H,S(['lg_1_1','lg_11_1','lg_11_4','lg_5_1','lg_6_1','uw_1_1','uw_2_1','uw_8_1','uw_6_1','uw_4_2','uw_4_4','bg_3_1','bg_9_1','bg_10_3','bg_2_2','uw_2_2']),{foes:3,allies:1,big:true}), {v,F,A}=L;
  setStack(L,'tsBur',8); setStack(L,'tsSand',3); L.T.s.w.tsThief={t:3,n:1,cdT:0,at:-1,wave:false}; setUst(L,F[0],'tsGr',1); const M=F[0]._talM[v.uid]; for(const k of ['tsRob','tsPour','tsRun']) M[k]={t0:V.now(),until:V.now()+99,v:0};
  (v._talM||(v._talM={}))[v.uid]=Object.assign((v._talM||{})[v.uid]||{},{tsClr:{t0:V.now(),until:V.now()+99,v:0}});
  const raw=0.91*0.925*0.95*0.76*0.91*0.95*0.95*0.94*0.925*0.94*0.91*0.95; assert.ok(raw<0.6); rel(inRatio(L,{kind:'magic',auto:true}),0.60,'at most 40% less (they would give '+((1-raw)*100).toFixed(1)+'%)',1e-9);
  const Q=lab(H,S(['lg_n1','lg_5_1','lg_6_1','uw_4_2','uw_4_4','uw_11_4','bg_10_3','bg_2_2','uw_2_2']),{foes:3,allies:1,big:true}); const f=Q.F[0], a=Q.A[0], MQ=f._talM||(f._talM={}), o=MQ[Q.v.uid]||(MQ[Q.v.uid]={});
  for(const k of ['tsRob','tsPour','tsRun']) o[k]={t0:V.now(),until:V.now()+99,v:0}; const ao=(a._talM||(a._talM={}))[Q.v.uid]=(a._talM[Q.v.uid]||{}); ao.tsClr={t0:V.now(),until:V.now()+99,v:0}; ao.tsCalm={t0:V.now(),until:V.now()+99,v:0};
  const r2=0.94*0.91*0.95*0.96*0.94*0.975; assert.ok(r2<0.75); rel(allyRatio(Q,a,{src:f}),0.75,'her allies at most 25% less from her talents (they would give '+((1-r2)*100).toFixed(1)+'%)',1e-9);
});

/* ============================== PAGE LINES ============================== */
test('Tessit: every page line her talents added is reached - Unwind\'s pick (skillTgt), what it lifted (pass), its interval (u._talUwOff)',()=>{
  const rows=[{on:'skillTgt',skill:'unwind',do:[{fn:'pick'}]},{on:'pass',skill:'unwind',do:[{fn:'n'}]}];
  const def={hero:H,states:{},always:[],talents:{uw_2_3:rows},partial:{},ruling:{},
    fn:{ pick(A,T,u,c){ T.s.cnt=(T.s.cnt||0); T.s.hurtN=c.o&&c.o.hurt?c.o.hurt.length:-1; const b=(c.o.hurt||[]).find(x=>x!==c.tgt); if(b) c.tgt=b; T.s.pk=c.tgt; },
      n(A,T,u,c){ T.s.cnt=(T.s.cnt||0)+1; T.s.got=c.tgt; } }};
  const L=lab(H,[['uw_2_3',1]],{foes:3,allies:2,def}), {v,A}=L; freeSide(L); A[0].slow=9; A[1].slow=9;
  unwindNow(L); assert.equal(L.T.s.hurtN,2,'the hurt allies reach the row'); assert.equal(L.T.s.cnt,1,'pass once'); assert.equal(L.T.s.got,L.T.s.pk,'the pass sees the ally the row picked'); assert.ok(!(L.T.s.pk.slow>0),'and the page cleansed that one');
  v._talUwOff=1; A[0].slow=9; A[1].slow=9; v._uwT=uwBase(L)-1-V.STEP/2; V.step(1); assert.equal(L.T.s.cnt,2,'the interval reads u._talUwOff');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Tessit: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['lg_1_2','lg_2_3','lg_4_4','uw_1_1','uw_2_2','bg_1_3','bg_2_2','bg_4_1']), TEAM=['vael','sylthaine','vireo','vex','tessit'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const seen={sand:0,debt:0,pk:0,bur:0,clr:0,gr:0,mo:0,ro:0,turn:0};
  for(let i=0;i<3200&&!V.ended()&&s.alive;i++){ V.step(1); const S0=s._tal.s; seen.sand=Math.max(seen.sand,(S0.k.tsSand||{n:0}).n); seen.pk=Math.max(seen.pk,(S0.k.tsPk||{n:0}).n); seen.bur=Math.max(seen.bur,(S0.k.tsBur||{n:0}).n); seen.mo=S0.tsMoN||0; seen.ro=S0.tsRoN||0; seen.turn=S0.tsTnN||0;
    for(const f of units()){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.tsDebt&&o.tsDebt.until>V.now()) seen.debt++; if(o.tsClr&&o.tsClr.until>V.now()) seen.clr++; if(o['#tsGr']&&o['#tsGr'].until>V.now()) seen.gr++; } }
  console.log('  live fight: '+JSON.stringify(seen));
  assert.ok(seen.sand>0,'Sand'); assert.ok(seen.debt>0,'Debt'); assert.ok(seen.pk>0,'Pocketed'); assert.ok(seen.gr>0,'Grains'); assert.ok(seen.turn>0,'Turnover');
  determinism(H,TEAM);
});

/* The page lines her talents added (Unwind's pick, what it lifted, its interval): with nothing learned, whole seeded fights with Tessit in the line-up are
   identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){} return h; }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Tessit: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every line her talents added',{skip:!BASE},()=>{
  const ENCS=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['tessit','vael','vireo','sylthaine','maren'], foeTeam=['ambrel','fritz','dandra','konwu','bloatus'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __tsN={uw:0,ss:0,ult:0}; var __tsD=_doEffectCore, __tsSeen=new Set(), __tsU=_updateBattleCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="tessit"&&(!o||!o.deliver||o._arrived)){ if(type==="spdsteal") __tsN.ss++; if(type==="aoeStun") __tsN.ult++; } return __tsD.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ const r=__tsU.apply(this,arguments); for(const f of floatTexts){ if(__tsSeen.has(f)) continue; __tsSeen.add(f); if(f.txt==="UNWIND") __tsN.uw++; } if(floatTexts.length>4000) __tsSeen.clear(); return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENCS.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__tsN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.uw>0&&c.ss>0&&c.ult>0,'the fights ran Unwind and cast her skills: '+JSON.stringify(c)); }
  finally{ VMX('_doEffectCore=__tsD; _updateBattleCore=__tsU;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong. */
const DEF={ lg:['lg_1_1','lg_11_1','lg_11_4','lg_5_1','lg_6_1','lg_7_4','lg_2_4','lg_1_2','lg_2_2'],
            uw:['uw_1_1','uw_2_1','uw_8_1','uw_6_1','uw_4_2','uw_4_4','uw_4_1','uw_1_3','uw_10_3','uw_2_2'],
            bg:['bg_3_1','bg_9_1','bg_10_3','bg_7_1','bg_2_1','bg_2_2','bg_1_3'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={lg:0,uw:1,bg:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her reduction talents true at once - full Burden, 3+ Sand, a theft running, she is Clear, the attacker carries her
   Grains, is robbed, Poured and Running Out; a basic attack; normal and critical, physical and magic */
function worstHit(list,kind,crit,glyph){ const L=lab(H,list,{foes:3,allies:1,cold:true}), {v,F}=L; V.step(1); const f=F[0];
  if(L.T){ const A=FX.api(); setStack(L,'tsBur',A.stMax(L.T,v,'tsBur')); setStack(L,'tsSand',A.stMax(L.T,v,'tsSand')); L.T.s.w.tsThief={t:3,n:1,cdT:0,at:-1,wave:false}; setUst(L,f,'tsGr',1);
    const M=f._talM||(f._talM={}), o=M[v.uid]||(M[v.uid]={}); for(const k of ['tsRob','tsPour','tsRun']) o[k]={t0:V.now(),until:V.now()+99,v:0};
    const so=(v._talM||(v._talM={}))[v.uid]||(v._talM[v.uid]={}); so.tsClr={t0:V.now(),until:V.now()+99,v:0}; }
  v.glyphDR=glyph||0; v.maxHp=1e5; v.hp=5e4; v.shield=0;
  const raw=1e5, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:true})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Tessit: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits at (or near) that ceiling in a seeded fight',()=>{
  const cands=[[['uw','lg'],[61,30]],[['lg','uw'],[61,30]],[['uw','bg'],[61,30]],[['bg','uw'],[61,30]],[['lg','bg'],[61,30]],[['uw'],[91]],[['lg'],[91]],[['bg'],[91]]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), g30=Math.max(...['magic','phys'].map(k=>worstHit(best.list,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | ')+'; with 30% glyph reduction '+(g30*100).toFixed(1)+'%');
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90&&g30<0.95,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,pt:0,ph:0,sus:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="tessit"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>raw*1e-6){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!u||u.key!=="tessit"||!u.alive) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const f=units.find(x=>x.alive&&x.team!==u.team); if(f&&u._tal&&u._tal.s.tsApi){ let worst=0; for(const k of ["phys","magic"]){ let m=defMul(f,u,k)*(u.drT>0?u.drMul:1)*(1-(u.glyphDR||0));'+
    '        m*=u._tal.fn.drK(u._tal.s.tsApi,u._tal,u,f,k,true); worst=Math.max(worst,1-m); } __dr.pt++; __dr.sus+=worst; if(worst>=0.85) __dr.ph++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','tessit'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks+'; reference hit each tick: sustained '+(100*d.sus/Math.max(1,d.pt)).toFixed(1)+'%, at 85% or more '+(100*d.ph/Math.max(1,d.pt)).toFixed(1)+'% of the fight');
    assert.ok(d.n>30&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.ok(d.imm<d.ticks*0.5,'immune far less than half the fight');
    assert.ok(d.ph<d.pt*0.5,'at 85% or more for less than half of the fight ('+d.ph+' of '+d.pt+' ticks)'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* The stun-lock rule: her talent stuns (the lost moments) never land on a stunned enemy or within 0.5 s after one of her stuns ends, and at most twice on one
   enemy in 10 s. Seeded fights with builds that stun: the longest time one enemy spends stunned by her in a row (Hourglass included). */
test('Tessit: the stun-lock rule in seeded fights - the longest run of her stuns on one enemy, and the break between her talent stuns',()=>{
  const lists=[S(['bg_1_3','bg_2_3','bg_3_3','bg_5_4','bg_6_4','bg_8_4','bg_9_4','bg_11_2','bg_12_3','bg_8_3','bg_13_2','bg_2_2','bg_12_2']),everything(H)];
  let longest=0, minBreak=Infinity, n=0, fights=0;
  for(const list of lists){ const sn=snaps(['vael','vireo','vex','sylthaine','tessit'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    VMX('var __tst=[]; var __tsc=ccApply, __tsu=_updateBattleCore; ccApply=function(u,t,field,dur){ const r=__tsc.apply(this,arguments); if(r&&u&&u.key==="tessit"&&field==="stunned") __tst.push([__tst.f+":"+t.uid,battleTime,t.stunned,0]); return r; };'+
      '_updateBattleCore=function(dt){ const r=__tsu.apply(this,arguments); for(const u of units){ if(u&&u.key==="tessit"&&u._tal&&u._tal.s.tsStL&&u._tal.s.tsStL.length){ for(const e of u._tal.s.tsStL) __tst.push([__tst.f+":"+e[0],e[1],e[2],1]); u._tal.s.tsStL.length=0; } } return r; }; __tst.f=0;');
    try{ for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]){ VMX('__tst.f++'); campaign(sn,node,seed); fights++; }
      const foe=snaps(['grosk','gruel','carn','konwu','bloatus'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
      for(const seed of [3,5]){ VMX('__tst.f++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); fights++; }
      const L=VMX('__tst').slice(); n+=L.filter(e=>e[3]).length; const by={}; for(const e of L) (by[e[0]]||(by[e[0]]=[])).push(e);
      for(const k in by){ const a=by[k].sort((p,q)=>p[1]-q[1]); let runS=a[0][1], runE=a[0][1]+a[0][2]; let lastTal=null;
        for(let i=0;i<a.length;i++){ const s=a[i][1]; if(i>0){ if(s<=runE+1e-9) runE=Math.max(runE,s+a[i][2]); else { longest=Math.max(longest,runE-runS); runS=s; runE=s+a[i][2]; } }
          if(a[i][3]){ if(lastTal) minBreak=Math.min(minBreak,s-(lastTal[1]+lastTal[2])); lastTal=a[i]; } }
        longest=Math.max(longest,runE-runS); } }
    finally{ VMX('ccApply=__tsc; _updateBattleCore=__tsu;'); } }
  console.log('  stun-lock: '+n+' talent stuns of hers in '+fights+' fights; the longest run on one enemy (Hourglass included) '+longest.toFixed(2)+' s; the shortest break between two of her talent stuns on one enemy '+(minBreak===Infinity?'-':minBreak.toFixed(2)+' s'));
  assert.ok(n>0,'her talent stuns landed in the fights'); assert.ok(longest<=4.0+1e-6,'never longer than 4.0 s in a row');
  assert.ok(minBreak===Infinity||minBreak>=0.5-1e-6,'at least 0.5 s between two of her talent stuns on one enemy');
});
