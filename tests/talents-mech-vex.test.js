'use strict';
/* Vex's talents as data on the mechanics layer (talents-mech/vex.js), group by group on the still field (tests/talents-lab.js), then whole fights.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured in a plain lab
   (or with her talents switched off for one hit) BEFORE the talented lab is built: lab() replaces the whole field.
   Run: node --test tests/talents-mech-vex.test.js */
const test=require('node:test'),assert=require('node:assert/strict');
const {FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,accounting,determinism,snaps,spec}=require('./talents-lab.js');
const H='vex', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{t:0,idle:0},{n}); };
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const markUntil=(L,t,name)=>{ const m=t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]; return m?m.until:null; };
/* Deep Wounds on an enemy, read as the runtime keeps them (they lapse with the wound) */
const dw=(L,t)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#dw']; return (m&&V.now()<m.until)?m.v:0; };
const setDw=(L,t,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#dw']={v:n,until:V.now()+3}; };
const heal=(t,a)=>{ t._healCutUntil=0; return -lost(t,()=>V.heal(t,a)); };   // (a class-edge heal cut left by an earlier hit of hers is cleared: only the talents' cuts are measured)
const dodged=(L,fn)=>{ const v=L.v, d0=v._talDodge; v._talDodge=1; try{ return fn(); } finally{ v._talDodge=d0; } };   // her dodge chance is 1 for this hit (the stat rows keep their own total)
/* Hookline: the skill's own dash, landed now (the engine runs the same function when the dash ends) */
const land=L=>{ const v=L.v, D=v._dash; assert.ok(D,'Hookline is on its way'); v._dash=null; v.x=D.x1; v.y=D.y1; D.run(); };
const strike=(L,t)=>lost(t,()=>{ V.cast(L.v,'green'); land(L); });
const home=L=>{ L.v.x=300; L.v.y=700; L.v._noTarget=false; L.v._noTargetT=0; };
/* real basic attacks: she walks to the nearest enemy and swings (Killer Instinct acts at the swing); the last blow lands while she is held again */
const swing=(L,n)=>{ const v=L.v; v.stunned=0; v.greenCd=v.blueCd=1e9; let k=0, was=v.attackAnim||0;
  for(let i=0;i<3000&&k<n;i++){ v.energy=0; V.step(1); if((v.attackAnim||0)>0.17&&!(was>0.17)) k++; was=v.attackAnim||0; }
  assert.equal(k,n,'she swung'); v.stunned=1e6; secs(1); };
const tick=(L,t)=>{ const d=t.dots.find(x=>x._talO===L.v.uid||x.src===L.v); return d; };

test('Vex: every talent is accounted for - 9 plain stats, 113 with rows, 3 waiting for a ruling',()=>{
  accounting(H,[125,9,113,3,0]);
  const M=FXN.mech(H); for(const id of ['rw_1_1','sc_1_1','sl_1_1','rw_13_2','sc_13_2','sl_13_2']) assert.ok(M.talents[id],id);
  assert.ok(!FXN.has(H,'sl_6_2'),'Make Them Miss is about the counter-cut, not a plain stat: its rows win over the stat sentence');
});

test('Vex / Coils: Coiled Rope, Rope-Works Hands, Dead Weight, Coil Snap, Hand over Hand, Slack Line, Rope Memory',()=>{
  const O={foes:2}, [pS,pA]=plain(O,P=>[strike(P,P.F[0]),lost(P.F[1],()=>V.hit(P.v,P.F[1],1000,{auto:true}))]);
  const L=lab(H,S(['rw_1_1','rw_8_1','rw_9_1','rw_3_1','rw_6_1','rw_12_1']),O), {v,F}=L; assert.equal(stack(L,'coil'),3,'Slack Line: the fight starts with 1 x 3 Coils'); setStack(L,'coil',0); V.step(1); const ai=v.atkInterval;
  for(let i=0;i<4;i++) V.hit(v,F[1],10,{auto:true}); assert.equal(stack(L,'coil'),4,'Coiled Rope: a Coil for each basic attack that lands'); V.hit(v,F[1],10); assert.equal(stack(L,'coil'),4,'not for a skill hit');
  V.step(1); near(v.atkInterval,ai/(1+0.015*4),'Dead Weight: 0.3% x 5 attack speed per Coil');
  near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),pA,'Coil Snap: not below 6 Coils'); V.hit(v,F[1],10,{auto:true}); assert.equal(stack(L,'coil'),6);
  near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),pA*1.15,'Coil Snap: at 6 Coils her basic attacks deal 3% x 5 more'); assert.equal(stack(L,'coil'),6,'at most 6');
  home(L); near(strike(L,F[0]),pS*1.30,'Hookline spends all 6 Coils: its strike 1% x 5 more for each'); assert.equal(stack(L,'coil'),0);
  near(FX.cd(v,'green',8),6,'Hand over Hand: 6 Coils spent, its cooldown 2 s shorter'); home(L); V.hit(v,F[1],10,{auto:true}); V.cast(v,'green'); land(L); near(FX.cd(v,'green',8),8,'1 Coil: no');
  setStack(L,'coil',5); V.wave(); V.step(1); assert.equal(stack(L,'coil'),5,'Rope Memory: she keeps 2 x 3 Coils at the end of a wave (5 here)');
  setStack(L,'coil',1); V.wave(); V.step(1); assert.equal(stack(L,'coil'),3,'Slack Line: each wave starts with at least 1 x 3');
  const M=lab(H,S(['rw_1_1']),O); setStack(M,'coil',5); V.wave(); V.step(1); assert.equal(stack(M,'coil'),0,'without them the Coils are lost between waves');
  const rw=seed=>{ const Q=lab(H,S(['rw_1_1','rw_4_1']),{foes:1,seed}); let two=0; for(let i=0;i<40;i++){ setStack(Q,'coil',0); V.hit(Q.v,Q.F[0],10,{auto:true}); if(stack(Q,'coil')===2) two++; } return two; };
  const a=rw(5); assert.ok(a>8&&a<32,'Rope-Works Hands: 10% x 5 of basic attacks add a second Coil: '+a+' of 40'); assert.equal(rw(5),a,'the same seed, the same rolls');
});

test('Vex / Hookline: Long Throw, Hook Edge, Fifteen Feet, Ghost Line, Quick Exit, Over the Shoulder, Rope Burn',()=>{
  /* the mark is F1 (10 m): F0 has more max HP. F0 (4.5 m) stands on the rope's line, F3 (0, 6 m) does not */
  const O={foes:4}, prep=X=>{ X.F[0].maxHp=X.F[0].hp=2e9; };
  const [pS,pE,pC]=plain(O,P=>{ prep(P); const s=strike(P,P.F[1]); const e=P.v._noTargetT; home(P); return [s,e,plainCrit(P)]; });
  const far=plain({foes:1},P=>{ P.put(P.F[0],30,0); V.cast(P.v,'green'); return !!P.v._dash; }); assert.equal(far,false,'(plain: 30 m is out of reach)');
  const L=lab(H,S(['rw_2_1','rw_4_3','rw_11_1','rw_7_4','rw_11_3','rw_6_4','rw_10_1']),O), {v,F}=L; prep(L); const f0=F[0].hp, f3=F[3].hp;
  near(strike(L,F[1]),pS*1.15*1.10,'Hook Edge 5% x 3; Fifteen Feet: 10 m between centres is about 6.5 m between bodies, two whole 3 m: 1% x 5 each');
  near(f0-F[0].hp,0.25*v.dmg,'Rope Burn: the rope cuts F0 (on the line) for 5% x 5 of her attack'); assert.equal(F[3].hp,f3,'not F3, off the line');
  near(v._noTargetT,pE+0.3,'Ghost Line: Hookline\'s evade 0.1 s x 3 longer');
  const bV=plainHit(L,()=>{ v._noTarget=false; return lost(v,()=>V.hit(F[2],v,1000)); }); v._noTarget=true;
  secs(0.85); assert.ok(!v._noTarget); near(lost(v,()=>V.hit(F[2],v,1000)),bV*0.90,'Quick Exit: 2% x 5 less damage for 2 s after she lands'); secs(1.2); near(lost(v,()=>V.hit(F[2],v,1000)),bV,'then no more');
  near(critOn(L,F[2]),pC*1.16,'Over the Shoulder: her first hit after the landing deals 8% x 2 more critical damage'); near(critOn(L,F[2]),pC,'only the first');
  const Q=lab(H,S(['rw_2_1']),{foes:1}); Q.put(Q.F[0],30,0); V.cast(Q.v,'green'); assert.ok(Q.v._dash,'Long Throw: 28 + 1 x 3 m reaches 30 m');
});
/* a crit of 1000 from her on F2 (the same hit, the same target, in both labs) */
function plainCrit(P){ return lost(P.F[2],()=>V.hit(P.v,P.F[2],1000,{crit:true})); }
function critOn(L,t){ return lost(t,()=>V.hit(L.v,t,1000,{crit:true})); }

test('Vex / Blindside: Blindside, Shadow Step, Knife in the Dark, Through the Gap, Unseen, Closing the Distance, Last Look, Second Shadow',()=>{
  const O={foes:3};
  const [pS,pI]=plain(O,P=>{ P.v._wpnArmIgn=0.15; const s=strike(P,P.F[0]); P.v._wpnArmIgn=0; return [s,0]; });
  const L=lab(H,S(['rw_1_4','rw_5_4','rw_3_4','rw_3_3','rw_10_4','rw_12_4','rw_12_3','rw_9_4']),O), {v,F}=L;
  const base=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000))), ign=plainHit(L,()=>{ v._wpnArmIgn=0.15; try{ return lost(F[0],()=>V.hit(v,F[0],1000)); } finally{ v._wpnArmIgn=0; } });
  const crit=plainHit(L,()=>{ v._wpnArmIgn=0.15; try{ return lost(F[0],()=>V.hit(v,F[0],1000,{crit:true})); } finally{ v._wpnArmIgn=0; } });
  near(strike(L,F[0]),pS,'Through the Gap: Hookline\'s strike ignores 3% x 5 of its armor (the strike lands before the Blindside)');
  assert.ok(mark(L,F[0],'blind')); near(markUntil(L,F[0],'blind')-V.now(),3+1.5,'Blindside: 3 s + Shadow Step 0.3 s x 5');
  near(lost(F[0],()=>V.hit(v,F[0],1000)),ign*1.12,'a Blindside hit: 4% x 3 more, and Through the Gap\'s armor ignore'); assert.ok(base<ign);
  near(lost(F[0],()=>V.hit(v,F[0],1000,{crit:true})),crit*1.12*1.06,'Last Look: a Blindside crit 2% x 3 more critical damage');
  v.hp=v.maxHp*0.5; const h=v.hp, l=lost(F[0],()=>V.hit(v,F[0],1000)); near(v.hp-h,l*0.10,'Unseen: 2% x 5 lifesteal on Blindside hits');
  v.greenCd=5; V.hit(v,F[0],10); near(v.greenCd,5-0.4,'Closing the Distance: 0.2 s x 2 off Hookline for each Blindside hit');
  v.target=F[0]; V.step(1); near(v.glyphCrit,0.15,'Knife in the Dark: 3% x 5 crit chance while her target is Blindsided'); v.target=F[1]; V.step(1); near(v.glyphCrit,0,'');
  secs(4.6); assert.ok(!mark(L,F[0],'blind'),'it ends'); near(lost(F[0],()=>V.hit(v,F[0],1000)),base,'');
  home(L); F[2].hp=10; V.hit(v,F[2],1000); assert.ok(!F[2].alive); assert.ok(mark(L,F[0],'blind'),'Second Shadow: a kill gives her Blindside on the nearest enemy (F0, 4.5 m)'); assert.ok(!mark(L,F[1],'blind'));
});

test('Vex / Snag: Snag, Tight Line, Noose, Strangle Knot, Gallows Knot, Ruthless, Held Snag, Hangman\'s Count',()=>{
  const O={foes:2,allies:1};
  const L=lab(H,S(['rw_2_2','rw_4_2','rw_10_2','rw_8_2','rw_6_2','rw_8_3','rw_5_2','rw_12_2']),O), {v,A,F}=L; const sp=F[0].speed, atk=v.dmg;
  const bV=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000))), bC=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{crit:true}))), bA=plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000)));
  const iA=plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000))), iV=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000)));
  V.cast(v,'green'); land(L); home(L); assert.ok(mark(L,F[0],'snag')); near(markUntil(L,F[0],'snag')-V.now(),2+0.9,'Snag: 2 s + Tight Line 0.3 s x 3');
  V.step(1); assert.equal(F[0].speed,0,'it cannot move'); near(F[0].silencedT,2.9-V.STEP,'Held Snag: it cannot use its skills until the Snag ends',0.02);
  near(lost(F[0],()=>V.hit(v,F[0],1000)),bV*1.10*1.075,'2% x 5 more from her, Gallows Knot 1.5% x 5 from her team'); near(lost(F[0],()=>V.hit(A[0],F[0],1000)),bA*1.075,'an ally: Gallows Knot');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{crit:true})),bC*1.10*1.075*1.12,'Ruthless: her crits on it 4% x 3 more');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000)),iA*0.90,'Strangle Knot: it deals 2% x 5 less'); near(lost(v,()=>V.hit(F[0],v,1000)),iV*0.90,'to her too');
  near(v.dmg,atk*1.05,'Hangman\'s Count: 1% x 5 attack for the Snag she landed');
  secs(3); assert.ok(!mark(L,F[0],'snag')); near(F[0].speed,sp,'the Snag ends: it moves again'); near(lost(F[0],()=>V.hit(v,F[0],1000)),bV,'');
  F[0].hp=F[0].maxHp*0.4; V.cast(v,'green'); land(L); home(L); near(markUntil(L,F[0],'snag')-V.now(),2.9+1.0,'Noose: 0.2 s x 5 longer below 50% HP');
  for(let i=0;i<6;i++){ V.cast(v,'green'); land(L); home(L); } V.step(1); near(v.dmg,atk*1.25,'at most 5 Snags');
});

test('Vex / Snag deaths: Cut Loose, Free Run, Hanging Weight',()=>{
  const L=lab(H,S(['rw_2_2','rw_5_3','rw_6_3','rw_11_2']),{foes:3}), {v,F}=L; const ai=v.atkInterval;
  V.cast(v,'green'); land(L); home(L); secs(1); v.greenCd=6; const left=markUntil(L,F[0],'snag')-V.now(); V.dmg(F[0],3e9); assert.ok(!F[0].alive);
  near(v.greenCd,3,'Cut Loose: a Snagged enemy dies: Hookline\'s remaining cooldown is halved'); V.step(1); near(v.atkInterval,ai/1.15,'Free Run: 5% x 3 attack speed');
  assert.ok(mark(L,F[1],'snag'),'Hanging Weight: the Snag jumps to the nearest enemy (F1)'); near(markUntil(L,F[1],'snag')-V.now(),left-V.STEP,'for the rest of its time',0.01); assert.ok(!mark(L,F[2],'snag'));
  secs(4.05); near(v.atkInterval,ai,'Free Run lasts 4 s');
});

test('Vex / Nobody Picks the Distance (SIGNATURE): the chain, its 20% a hook, 3 hooks then 20 s',()=>{
  const O={foes:6}, pS=plain(O,P=>{ V.dmg(P.F[0],3e9); return strike(P,P.F[1]); });
  const L=lab(H,S(['rw_13_2']),O), {v,F}=L; v.greenCd=7;
  V.cast(v,'green'); land(L); home(L); secs(1); V.dmg(F[0],3e9); near(v.greenCd,0,'its mark dies within 4 s: Hookline is ready again at once');
  near(strike(L,F[1]),pS*1.20,'and the chained hook (the next most fragile: F1) deals 20% more'); home(L);
  for(const i of [1,2]){ V.dmg(F[i],3e9); assert.equal(v.greenCd,0,'chain '+(i+1)); v.greenCd=7; V.cast(v,'green'); land(L); home(L); }
  v.greenCd=7; V.dmg(F[3],3e9); near(v.greenCd,7,'after 3 chained hooks: 20 s before it can chain again');
  secs(20.1); V.cast(v,'green'); land(L); home(L); v.greenCd=7; V.dmg(F[4],3e9); near(v.greenCd,0,'20 s later it chains again');
  V.cast(v,'green'); land(L); home(L); v.greenCd=7; secs(4.1); V.dmg(F[5],3e9); near(v.greenCd,7,'a mark that lives past 4 s does not chain');
});

test('Vex / Killer Instinct and Deep Wounds: Worrying the Cut, Ragged Edges, Bone Deep, Open Again, Weeping, Nowhere to Mend',()=>{
  const O={foes:1};
  const L=lab(H,S(['sc_1_1','sc_3_1','sc_12_1','sc_4_1','sc_6_1','sc_8_1']),O), {v,F}=L; const fd=F[0].dmg, pm=v.passMul||1;
  const base=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000)));
  setDw(L,F[0],1); swing(L,1); assert.ok(mark(L,F[0],'ki'),'Killer Instinct\'s wound is on it'); assert.equal(dw(L,F[0]),1,'the first swing opens the wound: no Deep Wound for that one');
  near(F[0].mortalT,5*pm-1,'Ragged Edges: the wound lasts 5 s (x her passive\'s level) instead of 3 s',0.05);
  secs(2.5); assert.equal(dw(L,F[0]),1,'Deep Wounds are refreshed with the wound (that one was set to lapse 3 s after it was put on)');
  swing(L,2); assert.equal(dw(L,F[0]),3,'Worrying the Cut: each basic attack on an enemy already wounded adds a Deep Wound');
  near(lost(F[0],()=>V.hit(v,F[0],1000)),base*(1+0.02*3),'0.4% x 5 more damage from her per Deep Wound');
  v.target=F[0]; V.step(1); near(v.glyphCrit,0.01*3,'Open Again: 0.2% x 5 crit chance per Deep Wound on her target'); near(F[0].dmg,fd*(1-0.009*3),'Weeping: 0.3% x 3 less attack per Deep Wound');
  F[0].hp=F[0].maxHp*0.5; near(heal(F[0],1000),1000*0.5*(1-0.05*3),'Nowhere to Mend: 1% x 5 less healing per Deep Wound (on top of the wound\'s half)');
  setDw(L,F[0],7); swing(L,3); assert.equal(dw(L,F[0]),8,'Bone Deep: up to 5 + 1 x 3');
  secs(5*pm+0.1); assert.equal(dw(L,F[0]),0,'Deep Wounds lapse with the wound'); assert.ok(!mark(L,F[0],'ki')); V.step(1); near(F[0].dmg,fd,'and Weeping ends');
  F[0]._talM[v.uid]['#dw']={v:3,until:V.now()+30}; swing(L,1); secs(5*pm+0.5); assert.equal(dw(L,F[0]),3,'a wound that lapses sooner never shortens Deep Wounds that last longer');
});

test('Vex / Hooked Wound, Tempest of Wounds, Clean Cut, Bare Bone',()=>{
  const L=lab(H,S(['sc_1_1','sc_7_1','sc_7_2']),{foes:2}), {v,F}=L; const pm=v.passMul||1;
  V.cast(v,'green'); land(L); home(L); assert.ok(mark(L,F[0],'ki'),'Hooked Wound: the strike applies Killer Instinct'); near(F[0].mortalT,3*pm,'(the wound itself)',0.01); assert.equal(dw(L,F[0]),3,'and 1 x 3 Deep Wounds');
  v.target=F[1]; L.put(F[1],0,5); V.cast(v,'ult'); assert.equal(dw(L,F[1]),3,'Tempest of Wounds: each of its three cuts adds a Deep Wound'); assert.ok(mark(L,F[1],'ki')&&F[1].mortalT>0,'and applies Killer Instinct');
  const C=lab(H,S(['sc_5_3','sc_6_3']),{foes:1}); const b=plainHit(C,()=>lost(C.F[0],()=>V.hit(C.v,C.F[0],1000)));
  swing(C,1); assert.ok(mark(C,C.F[0],'ki')); near(C.F[0].mortalT||0,0,'Clean Cut: Killer Instinct no longer cuts healing'); C.F[0].hp=C.F[0].maxHp*0.5; near(heal(C.F[0],1000),1000,'a full heal');
  near(lost(C.F[0],()=>V.hit(C.v,C.F[0],1000)),b*(1.12+0.09),'it takes 12% + Bare Bone 3% x 3 more from her');
});

test('Vex / Denied: Denied, Festering, Spite, Bitter Draught, Spiteful, Hoarded Spite, Bad Debt, Dry to the Bone',()=>{
  const O={foes:1}, pBleed=plain(O,P=>{ P.v.target=P.F[0]; V.cast(P.v,'blue'); const d=tick(P,P.F[0]); return d.dps*d.remaining; });
  const L=lab(H,S(['sc_1_1','sc_2_1','sc_2_2','sc_4_2','sc_6_2','sc_10_2','sc_9_2']),O), {v,F}=L;
  swing(L,1); F[0].hp=F[0].maxHp*0.5; near(heal(F[0],1000),500,'the wound halves its healing');
  near(stack(L,'den'),500*0.5,'Denied: 10% x 5 of the healing the wound stopped');
  setDw(L,F[0],5); near(heal(F[0],1000),1000*(0.5-0.15),'Festering: at 5 Deep Wounds it cuts 5% x 3 more');
  near(stack(L,'den'),250+0.5*650,'and Denied counts that too (the wound stopped 650)');
  const max=L.T.st.den.max.pct*v.dmg; near(max,3*1.6*v.dmg,'Spite: full at 3 x her attack, 20% x 3 more');
  const spent=stack(L,'den'); v.hp=v.maxHp*0.5; const h=v.hp; v.target=F[0]; V.cast(v,'blue'); const d=tick(L,F[0]);
  near(d.dps*d.remaining,pBleed+spent,'her next Bleed Them Dry adds all of it to its bleed'); near(stack(L,'den'),0,'and Denied empties');
  near(v.hp-h,spent*0.20,'Bitter Draught: she heals 4% x 5 of what was spent');
  near(heal(F[0],1000),0,'Spiteful: no healing at all for 0.5 s x 3'); secs(1.55); assert.ok(heal(F[0],1000)>0,'then healing again');
  setStack(L,'den',0); const hp0=F[0].hp+(F[0].shield||0); secs(1.02); const dealt=hp0-F[0].hp-(F[0].shield||0); assert.ok(dealt>0); near(stack(L,'den'),dealt*0.15,'Hoarded Spite: 3% x 5 of the bleed damage she deals',1e-6);
  V.wave(); V.step(1); near(stack(L,'den'),0,'Denied empties between waves');
  const B=lab(H,S(['sc_2_2','sc_11_2']),O); setStack(B,'den',100); V.wave(); V.step(1); near(stack(B,'den'),100,'Bad Debt: not any more');
  const D=lab(H,S(['sc_2_2','sc_12_2']),O), a0=D.v.dmg, mx=D.T.st.den.max.pct*a0; setStack(D,'den',mx*0.45); V.step(1); near(D.v.dmg,a0*(1+0.01*4),'Dry to the Bone: 0.2% x 5 attack for each whole tenth of Denied stored (4)');
});

test('Vex / Drip and her bleeds: Drip, Slow Pour, Pooling, Red Hands, Steady Drain, Exsanguinate, Leech the Cut, Quick Cuts, Bled Out, Thin Blood',()=>{
  const O={foes:2}, pT=plain(O,P=>{ P.v.target=P.F[0]; V.cast(P.v,'blue'); const h=P.F[0].hp; secs(1.02); return h-P.F[0].hp; });
  const L=lab(H,S(['sc_1_4','sc_3_4','sc_5_4','sc_6_4','sc_12_3','sc_8_3','sc_11_1','sc_11_3','sc_10_1','sc_4_3']),O), {v,F}=L; const ai=v.atkInterval, atk=v.dmg, sp=F[0].speed;
  v.target=F[0]; V.cast(v,'blue'); v.hp=v.maxHp*0.5; v.greenCd=5; const h=F[0].hp, hv=v.hp; secs(1.02);
  near(h-F[0].hp,pT*1.06,'Steady Drain: her bleeds tick 3% x 2 harder'); assert.equal(stack(L,'drip'),1,'Drip: 1 for the second a bleed of hers ticked');
  near(v.hp-hv,(h-F[0].hp)*0.05,'Leech the Cut: she heals 1% x 5 of it'); near(v.greenCd,5-0.25,'Quick Cuts: each tick takes 0.05 s x 5 off Hookline');
  near(F[0].speed,sp*0.91,'Thin Blood: an enemy bleeding from her moves 3% x 3 slower');
  V.step(1); near(v.atkInterval,ai/(1+0.003),'0.1% x 3 attack speed per Drip'); near(v.dmg,atk*(1+0.003),'Red Hands: 0.15% x 2 attack per Drip');
  setStack(L,'drip',10); const h2=F[0].hp; secs(1.0); near(h2-F[0].hp,pT*1.06*1.15,'Pooling: at 10 Drip 3% x 5 harder');
  F[0].hp=F[0].maxHp*0.4; const h3=F[0].hp; secs(1.0); near(h3-F[0].hp,pT*1.06*1.15*1.15,'Exsanguinate: below 50% HP 3% x 5 more');
  for(let i=0;i<400&&F[0].dots.length;i++) V.step(1); assert.ok(!F[0].dots.length,'the bleed is over');
  const n=stack(L,'drip'); secs(2.9); assert.equal(stack(L,'drip'),n,'Slow Pour: with no bleed of hers Drip waits 1 s + 0.4 s x 5'); secs(0.2); assert.equal(stack(L,'drip'),n-1,'then fades 1 a second');
  V.step(1); near(F[0].speed,sp,'Thin Blood ends with the bleed');
  setStack(L,'drip',0); v.target=F[1]; V.cast(v,'blue'); V.dmg(F[1],3e9); assert.ok(!F[1].alive); assert.equal(stack(L,'drip'),5,'Bled Out: an enemy that dies bleeding from her gives 1 x 5 Drip');
});

test('Vex / Bleed Them Dry and Razor Tempest: Serrated, Long Bleed, Steady Hands, Fast Hands, Patient Knife, Flood, Overflowing, Red Rain, Wide Arc, Wide Cuts',()=>{
  const O={foes:2}, [pH,pD,pR]=plain(O,P=>{ P.v.target=P.F[0]; const h=lost(P.F[0],()=>V.cast(P.v,'blue')), dps=tick(P,P.F[0]).dps;
    P.v.target=P.F[1]; P.put(P.F[1],0,5); return [h,dps,lost(P.F[1],()=>V.cast(P.v,'ult'))]; });
  const L=lab(H,S(['sc_3_3','sc_2_3','sl_10_3','rw_7_3','sc_7_3']),O), {v,F}=L;
  v.target=F[0]; const up=lost(F[0],()=>V.cast(v,'blue')), d=tick(L,F[0]); near(d.dps,pD*1.15,'Serrated: its bleed 3% x 5 harder'); near(up,pH*1.15,'and its first cut');
  near(FX.cd(v,'blue',9),9-0.9-0.9,'Steady Hands and Fast Hands: 0.3 s x 3 each off its cooldown');
  v.target=F[1]; L.put(F[1],0,5); near(lost(F[1],()=>V.cast(v,'ult')),pR*1.15*1.15,'Wide Arc and Wide Cuts: Razor Tempest 3% x 5 more each');
  const B=lab(H,[['sc_5_1',3]],O); B.v.target=B.F[0]; V.cast(B.v,'blue'); const e=tick(B,B.F[0]); assert.equal(e.remaining,8); near(e._talF,0.2,'Long Bleed: 6 + 0.4 x 3 = 7.2 s, the last tick a fifth');
  const P2=lab(H,S(['sc_1_4','sc_7_4']),O); setStack(P2,'drip',20); P2.v.target=P2.F[0]; V.cast(P2.v,'blue'); const k=tick(P2,P2.F[0]);
  near(k.dps,pD*1.25,'Patient Knife: at 20 Drip it spends 10 and its bleed is 5% x 5 stronger'); assert.equal(stack(P2,'drip'),10);
  const R=lab(H,S(['sc_1_4','sc_9_4','sc_10_4']),O); setStack(R,'drip',20); R.v.target=R.F[0]; V.cast(R.v,'blue'); const fl=R.F[1].dots.find(x=>x._talK==='flood');
  assert.ok(fl,'Flood: at 20 Drip her bleed also lands on the nearest second enemy'); near(fl.dps,pD*0.5*1.30,'at half strength, Overflowing 6% x 5 stronger'); assert.equal(fl.remaining,tick(R,R.F[0]).remaining);
  const R2=lab(H,S(['sc_1_4','sc_9_4']),O); setStack(R2,'drip',19); R2.v.target=R2.F[0]; V.cast(R2.v,'blue'); assert.ok(!R2.F[1].dots.length,'below 20 Drip: no Flood');
  const W=lab(H,S(['sc_1_4','sc_12_4']),O); W.v.target=W.F[1]; W.put(W.F[1],0,5); setStack(W,'drip',20); const cutLoss=lost(W.F[1],()=>V.cast(W.v,'ult'));
  const rain=W.F[1].dots.filter(x=>x._talK==='rain'); assert.equal(rain.length,3,'Red Rain: at 20 Drip each cut leaves a 3 s bleed'); near(rain.reduce((s,x)=>s+x.dps*x.remaining,0),cutLoss*0.30,'worth 10% x 3 of the cut',1e-6);
  const X=lab(H,S(['sc_1_4','sc_12_4','sc_9_4']),O); X.v.target=X.F[1]; X.put(X.F[1],0,5); setStack(X,'drip',20); V.cast(X.v,'ult'); assert.equal(X.F[0].dots.filter(x=>x._talK==='flood').length,4,'and with Flood each of those bleeds (and the Tempest own one) also lands on the nearest second enemy');
});

test('Vex / Every Last Drop (SIGNATURE): a full Denied bursts the wound',()=>{
  const O={foes:3}, prep=X=>{ X.put(X.F[2],30,30); };
  const pB=plain(O,P=>{ prep(P); P.v.target=P.F[0]; V.cast(P.v,'blue'); const d=tick(P,P.F[0]); return d.dps*d.remaining; });
  const L=lab(H,S(['sc_1_1','sc_2_2','sc_13_2']),O), {v,F}=L; prep(L); const max=L.T.st.den.max.pct*v.dmg; setStack(L,'den',max);
  const h=F.map(f=>f.hp); v.target=F[0]; V.cast(v,'blue');
  assert.ok(!F[0].dots.some(x=>x._talK==='btd'),'the wound bursts: the bleed is over'); const rest=pB+max;
  near(h[1]-F[1].hp,rest,'every enemy within 3 m takes the rest of the bleed at once (F1, 5.5 m between centres)'); assert.equal(F[2].hp,h[2],'not one far away');
  assert.ok((h[0]-F[0].hp)>rest,'the target too (on top of the cut)'); assert.equal(dw(L,F[0]),5); assert.equal(dw(L,F[1]),5,'full Deep Wounds');
  F[1].hp-=1e6; near(heal(F[1],1000),0,'no healing for 4 s'); secs(4.05); assert.ok(heal(F[1],1000)>0);
  setStack(L,'den',max); const h1=F[1].hp; V.cast(v,'blue'); near(F[1].hp,h1,'once every 20 s'); secs(20.1); setStack(L,'den',max); V.cast(v,'blue'); assert.ok(F[1].hp<h1,'then again');
});

test('Vex / Lockpick: Picked Lock, Keys to the Gaol, Light Fingers, Rain Check, Spring the Trap, Jailbreak, Nobody\'s Hand, Escape Artist, Staying for the Rain; Rolls With It',()=>{
  const ids=['sl_1_1','sl_11_1','sl_2_1','sl_3_1','sl_4_1','sl_7_1','sl_8_1','sl_1_2','sl_10_1','sl_12_1'];
  const L=lab(H,S(ids),{foes:2,cold:true}), {v,F}=L; const sp=v.speed, ai=v.atkInterval; V.step(1); secs(5.05); const cr=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{crit:true}))), nc=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000)));
  const cc=(field,dur)=>{ v.stunned=0; v.fearT=0; V.cc(F[0],v,field,dur); const got=v[field]; v.stunned=1e6; v.fearT=0; return got; };   // a control on her as it lands (then she is held again)
  v.hp=v.maxHp*0.7; const hp=v.hp; assert.equal(cc('stunned',2),0,'Picked Lock: the first stun on her breaks at once'); assert.equal(stack(L,'lp'),0);
  near(v.hp-hp,v.maxHp*0.10,'Nobody\'s Hand: she heals 2% x 5 of her max HP'); assert.ok(v._noTarget); near(v._noTargetT,0.5,'Spring the Trap: she cannot be targeted for 0.1 s x 5');
  assert.ok(mark(L,F[0],'sl')); near(markUntil(L,F[0],'sl')-V.now(),12,'Jailbreak: the one whose stun it broke is on her Short List for 12 s'); near(F[0].slowMul,0.70,'and slowed 30%'); near(F[0].slow,2);
  near(lost(F[1],()=>V.hit(v,F[1],1000)),cr,'Rain Check: her next hit is a critical'); near(lost(F[1],()=>V.hit(v,F[1],1000)),nc,'only the next');
  V.step(1); near(v.speed,sp*1.15,'Light Fingers: 5% x 3 faster for 3 s'); near(v._talDodge,0.10+0.15,'Escape Artist: 3% x 5 more dodge for 3 s (Slip Aside 2% x 5)');
  secs(3.05); near(v.speed,sp); near(v._talDodge,0.10);
  let landed=0; for(let i=0;i<20&&!landed;i++) landed=cc('fearT',2); assert.ok(landed>0,'while it recharges, a fear lands');
  secs(17-3.1-0.3); assert.equal(stack(L,'lp'),0); secs(0.5); assert.equal(stack(L,'lp'),1,'ready again 20 - 1 x 3 s after it fired');
  assert.equal(cc('fearT',2),0,'a fear breaks too'); v.hp=v.maxHp*0.4; secs(8.4); assert.equal(stack(L,'lp'),0); secs(0.2); assert.equal(stack(L,'lp'),1,'Keys to the Gaol: below 50% HP its clock runs twice as fast (8.5 s)');
  cc('stunned',2); assert.equal(stack(L,'lp'),0); V.wave(); V.step(1); assert.equal(stack(L,'lp'),1,'Staying for the Rain: each wave starts with Lockpick ready'); near(v.atkInterval,ai/1.06,'and 2% x 3 attack speed'); secs(5.05); near(v.atkInterval,ai,'for 5 s');
  let s=0; for(let i=0;i<20&&!s;i++){ v.silencedT=0; s=cc('silencedT',2); } assert.ok(s>0,'a silence is not broken'); assert.equal(stack(L,'lp'),1);
  const C=lab(H,S(['rw_5_1']),{foes:1}); let st=0; for(let i=0;i<20&&!st;i++){ C.v.stunned=0; V.cc(C.F[0],C.v,'stunned',2); st=C.v.stunned; } near(st,2*V.ccNerf*0.80,'Rolls With It: control on her 4% x 5 shorter');
});

test('Vex / dodges: Slip Aside, Sidestep, Last Reflex, Read Them Coming, Quick Study, Counter-Cut, Make Them Miss, Patter, Always Laughing, Last Laugh, Bolt Hole; Rolling with It, Loose Shoulders',()=>{
  const rate=seed=>{ const Q=lab(H,S(['sl_1_2']),{foes:1,seed,big:true}); let d=0; for(let i=0;i<500;i++){ if(lost(Q.v,()=>V.hit(Q.F[0],Q.v,1000))===0) d++; } return d; };
  const a=rate(3); assert.ok(a>25&&a<75,'Slip Aside: she dodges 2% x 5 of the attacks aimed at her: '+a+' of 500'); assert.equal(rate(3),a,'the same seed, the same dodges');
  const ids=['sl_1_2','sl_4_2','sl_7_3','sl_8_2','sl_2_2','sl_5_2','sl_6_2','sl_11_2','sl_12_2','sl_12_3','sl_9_2'];
  const L=lab(H,S(ids),{foes:2,big:true}), {v,F}=L; const ai=v.atkInterval; V.step(1);
  const bA=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{auto:true}))), bC=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{crit:true}))), bS=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000)));
  near(v._talDodge,0.13,'Sidestep: 1% x 3 more'); v.hp=v.maxHp*0.35; V.step(1); near(v._talDodge,0.18,'Last Reflex: below 40% HP 1% x 5 more'); v.hp=v.maxHp; V.step(1);
  v.greenCd=5; near(dodged(L,()=>lost(v,()=>V.hit(F[0],v,1000))),0,'a dodged attack deals no damage'); near(v.greenCd,5,'Bolt Hole: not above 30% HP');
  V.step(1); near(v.atkInterval,ai/1.09,'Quick Study: 3% x 3 attack speed for 3 s'); near(v._talDodge,0.13+0.10+0.01,'Read Them Coming 2% x 5 for 2 s; Always Laughing 0.2% x 5 per Patter');
  near(v.glyphCrit,0.20,'Make Them Miss: the counter-cut has 4% x 5 more crit chance');
  near(lost(F[1],()=>V.hit(v,F[1],1000,{crit:true})),bC*1.025*1.15,'Last Laugh: her first hit after a dodge 5% x 3 more critical damage (Patter: 0.5% x 5 for the 1 dodge)');
  near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),bA*1.30*1.025,'Counter-Cut: her next basic attack after a dodge 30% more'); near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),bA*1.025,'only the next');
  secs(2.05); near(v._talDodge,0.14); secs(1.05); near(v.atkInterval,ai);
  for(let i=0;i<12;i++) dodged(L,()=>V.hit(F[0],v,10)); assert.equal(stack(L,'patter'),10,'Patter: up to 10 dodges'); near(lost(F[1],()=>V.hit(v,F[1],1000)),bS*1.25,'0.5% x 5 more damage each');
  V.wave(); V.step(1); assert.equal(stack(L,'patter'),0,'for the rest of the wave');
  v.hp=v.maxHp*0.25; v.greenCd=5; dodged(L,()=>V.hit(F[0],v,10)); near(v.greenCd,3,'Bolt Hole: a dodge below 30% HP cuts Hookline\'s cooldown by 2 s');
  const R=lab(H,S(['sl_1_2','sl_4_2','sl_5_3','sl_6_3']),{foes:1,big:true}); V.step(1); const b=plainHit(R,()=>lost(R.v,()=>V.hit(R.F[0],R.v,1000)));
  let all=true; for(let i=0;i<200;i++) if(!(lost(R.v,()=>V.hit(R.F[0],R.v,1000))>0)) all=false; assert.ok(all,'Rolling with It: Slip Aside no longer dodges');
  near(lost(R.v,()=>V.hit(R.F[0],R.v,1000)),b*(1-2*0.13)*0.97,'every hit reduced by twice her dodge chance; Loose Shoulders 1% x 3 more');
});

test('Vex / Short List: Short List, Four Names, Struck Through (LINK), Keep Up, Steel Nerve, Long Way Round, Struck Off, Crossed Off',()=>{
  const ids=['sl_1_4','sl_6_4','sl_n3','sl_5_4','sl_9_3','sl_9_4','sl_11_4','sl_12_4','sc_1_1'];
  const L=lab(H,S(ids),{foes:6,big:true}), {v,F}=L; const sp=v.speed, atk=v.dmg;
  const bS=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000))), bC=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{crit:true})));
  V.hit(F[0],v,10); assert.ok(mark(L,F[0],'sl'),'an enemy that attacks her goes on her Short List'); near(markUntil(L,F[0],'sl')-V.now(),6,'for 6 s');
  v._talDodge=0; near(lost(F[0],()=>V.hit(v,F[0],1000)),bS*1.10*1.10,'Struck Through: her first hit on a new name 10% more; 2% x 5 more on the list'); near(lost(F[0],()=>V.hit(v,F[0],1000)),bS*1.10*(1+0.004*5*1),'then the list (and the Deep Wound that hit added)');
  assert.equal(dw(L,F[0]),2,'Struck Through with Worrying the Cut: every hit on a listed enemy adds a Deep Wound'); for(let i=0;i<6;i++) V.hit(v,F[0],10); assert.equal(dw(L,F[0]),5,'up to 5');
  for(const i of [1,2,3]) V.hit(F[i],v,10); assert.ok([0,1,2,3].every(i=>mark(L,F[i],'sl')),'Four Names: the list holds 2 + 1 x 2');
  V.hit(F[0],v,10); V.hit(F[4],v,10); assert.ok(!mark(L,F[1],'sl'),'a new name replaces the oldest (F0 renewed, so F1)'); assert.ok(mark(L,F[0],'sl')&&mark(L,F[4],'sl'));
  near(lost(F[0],()=>V.hit(v,F[0],1000,{crit:true})),bC*1.10*1.15*(1+0.02*5),'Steel Nerve: her crits on a listed enemy 3% x 5 more',1e-6);
  v.hp=v.maxHp*0.5; const h=v.hp, l=lost(F[4],()=>V.hit(v,F[4],1000)); near(v.hp-h,l*0.09,'Long Way Round: she heals 3% x 3 of the damage she deals to it');
  v.target=F[4]; V.step(1); near(v.speed,sp*1.15,'Keep Up: 5% x 3 faster while her target is on the list'); v.target=F[5]; V.step(1); near(v.speed,sp);
  v.hp=v.maxHp*0.5; const h2=v.hp; F[4].hp=10; const kl=lost(F[4],()=>V.hit(v,F[4],1000)); assert.ok(!F[4].alive); near(v.hp-h2,v.maxHp*0.06+kl*0.09,'Crossed Off: she kills a listed enemy: 3% x 2 of her max HP (and Long Way Round on that blow)');
  V.step(1); near(v.dmg,atk*1.05,'Struck Off: a listed enemy died: 1% x 5 attack for the rest of the wave'); V.dmg(F[2],3e9); V.dmg(F[3],3e9); V.dmg(F[0],3e9); V.step(1); near(v.dmg,atk*1.15,'up to 3 names');
  V.wave(); V.step(1); near(v.dmg,atk,'a new wave: gone'); secs(6.1); assert.ok(!F.some(f=>f.alive&&mark(L,f,'sl')),'names drop off after 6 s');
});

test('Vex / Watching Brief, No Distance Too Far',()=>{
  /* F0 is the most fragile (Hookline's own pick); F1 is on her Short List */
  const O={foes:2}, prep=X=>{ X.F[1].maxHp=X.F[1].hp=2e9; };
  const pS=plain(O,P=>{ prep(P); P.F[0].maxHp=P.F[0].hp=3e9; return strike(P,P.F[1]); });
  const L=lab(H,S(['sl_1_4','sl_3_4']),O), {v,F}=L; prep(L); V.hit(F[1],v,10); const f0=F[0].hp;
  near(strike(L,F[1]),pS*1.10*1.15,'Watching Brief: Hookline goes to the listed enemy in reach, 3% x 5 more (and 2% x 5 for the list)'); assert.equal(F[0].hp,f0);
  const N=lab(H,S(['sl_1_4','sl_7_4']),{foes:1}); N.put(N.F[0],32,0); V.hit(N.F[0],N.v,10); V.cast(N.v,'green'); assert.ok(N.v._dash,'No Distance Too Far: a listed enemy 28 + 1 x 5 m away is in reach');
  const M=lab(H,S(['sl_1_4','sl_7_4']),{foes:1}); M.put(M.F[0],32,0); V.cast(M.v,'green'); assert.ok(!M.v._dash,'not one off the list');
});

test('Vex / Already Gone (SIGNATURE)',()=>{
  const O={foes:2,big:true}, prep=X=>{ X.F[1].maxHp=X.F[1].hp=2e9; };
  const L=lab(H,S(['sl_13_2']),O), {v,F}=L; prep(L); v.maxHp=1e6; v.hp=6e5;
  const nc=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000))), cr=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{crit:true}))), small=plainHit(L,()=>lost(v,()=>V.hit(F[1],v,1000))), big=4e5*1000/small;
  v.hp=6e5; near(lost(v,()=>V.hit(F[1],v,1000)),small,'a hit that leaves her above 30% lands'); v.hp=6e5; v.greenCd=6;
  near(lost(v,()=>V.hit(F[1],v,big)),0,'a hit that would drop her below 30%: the attack misses'); assert.ok(v._noTarget); near(v._noTargetT,1.5,'she gets Hookline\'s evade for 1.5 s'); near(v.greenCd,0,'and Hookline at once');
  const f1=F[1].hp, f0=F[0].hp; V.cast(v,'green'); land(L); home(L); assert.ok(F[1].hp<f1,'Hookline goes to the attacker (F1) ...'); assert.equal(F[0].hp,f0,'... not to the most fragile (F0)');
  for(let i=0;i<2;i++) near(lost(F[1],()=>V.hit(v,F[1],1000)),cr,'her next 3 hits are criticals (Hookline\'s strike was the first; '+(i+2)+')'); near(lost(F[1],()=>V.hit(v,F[1],1000)),nc,'then not');
  v.hp=6e5; near(lost(v,()=>V.hit(F[1],v,big)),4e5,'once every 20 s',1e-3); v.hp=6e5; secs(20); assert.equal(lost(v,()=>V.hit(F[1],v,big)),0,'20 s later again');
});

test('Vex / Fragile Things, Open Throat, Slippery, Gallows Humour, Bad Joke, Light Feet',()=>{
  const L=lab(H,S(['rw_7_1','rw_9_3','sl_6_1','sl_4_3','sl_8_3','rw_2_3']),{foes:2,big:true,cold:true}), {v,F}=L; const sp=v.speed; V.step(1);
  const b=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000))), bA=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{auto:true})));
  near(v.speed,sp*1.09,'Light Feet: 3% x 3 faster');
  F[1].t=Object.assign({},F[1].t,{row:'Back'}); near(lost(F[1],()=>V.hit(v,F[1],1000)),b*1.10,'Fragile Things: 2% x 5 more on a back-row hero'); near(lost(F[0],()=>V.hit(v,F[0],1000)),b,'not on the front');
  F[0].hp=F[0].maxHp*0.29; near(lost(F[0],()=>V.hit(v,F[0],1000)),b*1.15,'Open Throat: 3% x 5 more below 30% HP'); F[0].hp=F[0].maxHp;
  v.maxHp=1e6; v.hp=5e5; const h=v.hp; V.hit(v,F[0],1000,{crit:true}); near(v.hp-h,1e6*0.015,'Gallows Humour: each critical hit heals her 0.5% x 3 of her max HP'); V.hit(v,F[0],1000); near(v.hp-h,1e6*0.015,'(not a plain hit)');
  v.hp=1e6; V.hit(F[0],v,5e5); assert.ok(v.hp<0.9e6); near(lost(F[0],()=>V.hit(v,F[0],1000,{auto:true})),bA*1.24,'Bad Joke: a hit worth more than 10% of her max HP: her next attack 8% x 3 more'); near(lost(F[0],()=>V.hit(v,F[0],1000,{auto:true})),bA,'only the next');
  let ok=false; for(let i=0;i<20&&!ok;i++){ v.slow=0; v.slowMul=null; ok=V.cc(F[0],v,'slow',2); } assert.ok(ok); const m=V.slowMulFor(F[0].level); near(v.slowMul,m,'(the slow as the game writes it)'); V.step(1);
  near(v.slowMul,1-(1-m)*(1-0.24),'Slippery: a slow on her is 8% x 3 weaker'); V.step(1); near(v.slowMul,1-(1-m)*(1-0.24),'(once, not every tick)');
});

test('Vex: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['rw_1_1','rw_2_2','rw_1_4','sc_1_1','sc_1_4','sl_1_2','sl_1_4','sl_1_1']), TEAM=['vael','sylthaine','vireo','vex','gruel'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let coil=0, snag=false, blind=false, dws=0, drip=0, sl=false, hk=false; for(let i=0;i<2400&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s, foes=U.filter(u=>u.team==='enemy');
    coil=Math.max(coil,T0.k.coil?T0.k.coil.n:0); drip=Math.max(drip,T0.k.drip?T0.k.drip.n:0); hk=hk||!!s._dash;
    for(const f of foes){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; snag=snag||!!(o.snag&&o.snag.until>V.now()); blind=blind||!!(o.blind&&o.blind.until>V.now()); sl=sl||!!(o.sl&&o.sl.until>V.now()); dws=Math.max(dws,o['#dw']&&o['#dw'].until>V.now()?o['#dw'].v:0); } }
  assert.ok(coil>=1,'basic attacks coiled her rope'); assert.ok(hk,'she threw Hookline'); assert.ok(snag,'a real Hookline Snagged its mark'); assert.ok(blind,'and she Blindsided it');
  assert.ok(dws>=1,'real swings opened Deep Wounds: '+dws); assert.ok(drip>=1,'her bleeds filled Drip'); assert.ok(sl,'an enemy that attacked her went on her Short List');
  determinism(H,TEAM);
});
