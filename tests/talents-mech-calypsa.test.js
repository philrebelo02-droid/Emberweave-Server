'use strict';
/* Calypsa's talents as data on the mechanics layer (talents-mech/calypsa.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Calypsa, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). Bodies 2.01 m: F0 0.48 m from her body to body.
   Tidal Ribbon runs toward the farthest enemy: F2, through F0 and F1 (F3.. are off its line). The lab's skill level is 10.
   Run: node --test tests/talents-mech-calypsa.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='calypsa', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const free=x=>{ x.stunned=0; x.silencedT=0; x.speed=0; x.level=1; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const noDef=L=>{ for(const f of L.F){ f.mrRating=0; f.armorRating=0; } };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage: no armor in the way)
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };
/* a hit of hers during one of her skills (casting rows) against the same hit with her talents off; o: extra fields of her state for that hit */
function skillRatio(L,t,skill,kind,o){ const s=L.T.s, keep={}; o=Object.assign({cur:skill},o||{}); for(const k in o){ keep[k]=s[k]; s[k]=o[k]; } let a;
  try{ a=lost(t,()=>V.hit(L.v,t,1000,{kind:kind||'true'})); } finally{ for(const k in keep) s[k]=keep[k]; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,{kind:kind||'true'}))); }
/* the lab holds everyone (stunned): a held unit's timers and channels do not run. go() lets her act (rooted in place, nothing ready); hold() holds her again */
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.greenCd=99; v.blueCd=99; v.energy=0; };
const hold=L=>{ L.v.stunned=1e6; };
const unsoak=(L,t)=>{ const o=t._talM&&t._talM[L.v.uid]; if(o) delete o.soak; };
const ratio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
const ribbon=(L,s)=>{ V.cast(L.v,'green'); secs(s==null?1.0:s); };
const stance=L=>V.cast(L.v,'blue');
const losses=(L,fn)=>{ const h=L.F.map(f=>f.hp+(f.shield||0)); fn(); return L.F.map((f,i)=>h[i]-f.hp-(f.shield||0)); };
const dm=(s,t,k)=>VMX('defMul')(s,t,k);

test('Calypsa: every talent is accounted for - 9 plain stats, 111 with rows, none waiting',()=>{
  accounting(H,[120,9,111,0,0]);
  const M=FXN.mech(H); for(const id of ['nb_1_1','sl_1_1','pp_1_1','nb_13_2','sl_13_3','pp_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['nb_1_3','nb_3_3','nb_9_3','pp_11_4','pp_4_4','pp_6_4','sl_1_2','sl_2_4','sl_8_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Calypsa: her real kit, as the talents read it - the Ribbon to the farthest enemy, Fighting Current\'s evade, counter and blade, the storm\'s pulses',()=>{
  plain({foes:4},P=>{ const {v,F}=P; assert.ok(v.pass&&v.pass.prismscales,'Prismatic Scales is unlocked at the lab\'s level');
    const h0=F.map(f=>f.hp); V.cast(v,'green'); secs(0.15); near(h0[0]-F[0].hp,0,'the sabers travel (F0 not yet at 0.15 s)'); secs(0.15); assert.ok(F[0].hp<h0[0],'F0 at 0.225 s');
    secs(0.7); assert.ok(F[1].hp<h0[1]&&F[2].hp<h0[2],'F1 and F2: the line toward the farthest enemy'); near(h0[3]-F[3].hp,0,'not F3, off the line');
    V.cast(v,'blue'); near(v._evadeT,2.6,'Fighting Current: 2.6 s',1e-9); near(v.drMul,0.6-0.001*9,'the slot\'s damage-taken multiplier at skill level 10',1e-9); near(v.drT,2.6,'',1e-9);
    const f0=F[0].hp; near(hitOn(P,v,1000),0,'the first enemy hit is evaded'); assert.ok(F[0].hp<f0,'countered (and a blade)'); near(v._evadeT,0,'the window closes');
    near(hitOn(P,v,1000,{src:F[1]}),1000*v.drMul,'the next hit lands, reduced by the slot',1e-6);
    V.cast(v,'ult',F[1]); near(v._stormT,3,'the storm: 3 s',1e-9); near(v._stormR,6*V.METER,'6 m',1e-9); go(P); const g=F.map(f=>f.hp); secs(0.45); near(g[1]-F[1].hp,0,'no pulse before 0.5 s'); secs(0.1); assert.ok(F[1].hp<g[1]&&F[0].hp<g[0],'a pulse on every enemy within 6 m of its centre'); near(g[3]-F[3].hp,0,'not F3 (11.7 m)'); });
  const L=lab(H,S(['sl_1_1']),{foes:3}), {v,F}=L; V.cast(v,'green'); secs(1); assert.ok(mark(L,F[0],'soak')&&mark(L,F[2],'soak'),'(the Ribbon\'s hits are hers: Soaked)'); assert.ok(L.T.s.ln&&L.T.s.ln.L.length===3,'the line hook saw 3 enemies, in order'); assert.ok(L.T.s.ln.L.every((x,i)=>x===F[i]),'F0, F1, F2');
  stance(L); hitOn(L,v,10,{src:F[2]}); assert.ok(mark(L,F[2],'soak'),'the blade is her water');
  stance(L); FX.landPre(v,null,'thundershower'); hitOn(L,v,10,{src:F[1]}); assert.equal(L.T.s.cur,'thundershower','a counter fired inside one of her storm\'s pulses gives the pulse back its skill'); FX.land(v,null,'thundershower'); assert.equal(L.T.s.cur,null);
});

test('Calypsa / Ribbon Reply, Clear Through, Two Sabers, Water Blade, Wet Stone',()=>{
  const L=lab(H,S(['nb_7_1','sl_8_3','sl_4_2','pp_8_4','sl_11_4']),{foes:3,big:true}), {v,F}=L; const f=F[1]; f.armorRating=300; const x=v._wpnArmIgn, a=dm(v,f,'phys'); v._wpnArmIgn=0.10; const b=dm(v,f,'phys'); v._wpnArmIgn=x;
  near(skillRatio(L,F[0],'piercethrow'),1.15,'Ribbon Reply: 3% x 5'); L.T.s.cur='piercethrow'; const c=_crit(L,F[0]); L.T.s.cur=null; near(c,1.15*1.20,'Clear Through: its crits 4% x 5 more');
  near(ratio(L,F[0],{auto:true}),1.09*1.09,'Two Sabers and Water Blade: her basic attacks 3% x 3 each'); near(ratio(L,F[0]),1,'not her other hits');
  near(ratio(L,f,{kind:'phys'}),b/a,'Wet Stone: her hits ignore 2% x 5 of armor'); near(ratio(L,f,{kind:'magic'}),1,'(armor only)');
});

/* ============================== NEVER BIT FIRST ============================== */
test('Calypsa / Answers: Answer Every Miss, Open Reply, Patient Answer, Full Reply, Swift Answer (up to 3 s), Kept Score',()=>{
  const L=lab(H,S(['nb_1_1','nb_2_1','nb_6_1','nb_12_1','nb_9_1','nb_8_1']),{foes:3,big:true}), {v,F}=L;
  stance(L); hitOn(L,v,10,{src:F[0]}); assert.equal(stack(L,'ans'),2,'the evade: the counter and the blade store 1 Answer each'); near(L.T.st.ans.max,8,'Open Reply: up to 8');
  for(let i=0;i<6;i++){ stance(L); hitOn(L,v,10,{src:F[0]}); } assert.equal(stack(L,'ans'),8,'max 8');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*(1-0.015*8),'Patient Answer: 0.3% x 5 less per Answer held');
  near(ratio(L,F[1],{auto:true}),1.09,'Full Reply: at 5+ Answers basic attacks 3% x 3 more'); setStack(L,'ans',4); near(ratio(L,F[1],{auto:true}),1,'not at 4');
  setStack(L,'ans',6); v.blueCd=20; V.cast(v,'green'); assert.equal(stack(L,'ans'),0,'the Ribbon spends them all'); near(v.blueCd,17,'Swift Answer: 0.2 x 5 s per Answer, up to 3 s');
  near(skillRatio(L,F[1],'piercethrow','true',{rs:6}),1+0.15*6,'Answer Every Miss: 3% x 5 for each Answer spent'); near(ratio(L,F[1]),1,'not another hit');
  setStack(L,'ans',2); v.blueCd=20; V.cast(v,'green'); near(v.blueCd,18,'2 Answers: 2 s');
  setStack(L,'ans',6); V.wave(); V.step(1); assert.equal(stack(L,'ans'),3,'Kept Score: 1 x 3 kept between waves');
  const L2=lab(H,S(['nb_6_1']),{foes:3,big:true}); setStack(L2,'ans',4); V.wave(); V.step(1); assert.equal(stack(L2,'ans'),0,'without it they start the wave at 0');
});

test('Calypsa / The Fish Who Waited: each wave with Fighting Current ready and 3 Answers',()=>{
  const L=lab(H,S(['nb_11_2']),{foes:3,big:true}), {v}=L; assert.equal(stack(L,'ans'),3,'3 Answers at the wave\'s start'); near(v.blueCd,0,'ready');
  v.blueCd=5; setStack(L,'ans',1); V.wave(); V.step(1); near(v.blueCd,0,'again next wave'); assert.equal(stack(L,'ans'),3,'');
});

test('Calypsa / Answered in Full: a Ribbon that spends 5 or more Answers sweeps back along the line for 40%',()=>{
  const L=lab(H,S(['nb_3_1']),{foes:3,big:true}), {v,F}=L; noDef(L); setStack(L,'ans',4); const a=losses(L,()=>ribbon(L,2.5)); const raw=L.T.s.ln.raw;
  setStack(L,'ans',5); const b=losses(L,()=>ribbon(L,2.5));
  for(let i=0;i<3;i++) near(b[i]-a[i],raw*0.40*dm(v,F[i],'phys'),'the sweep back: 40% of the Ribbon\'s hit, F'+i,1e-6);
  near(losses(L,()=>secs(2))[0],0,'once');
});

test('Calypsa / Fighting Current: Hand\'s Width, Unbitten, Dancer\'s Skirt, Hand\'s Breadth, Ready Stance, Spinning Fins, Swift Swim',()=>{
  const L=lab(H,S(['nb_2_2','nb_11_3','nb_3_2','pp_12_4','nb_8_2','nb_10_2','pp_9_4']),{foes:3,big:true}), {v,F}=L; const base=0.6-0.001*9;
  stance(L); near(v._evadeT,2.6+0.5+0.45,'Dancer\'s Skirt 0.1 x 5 and Hand\'s Breadth 0.15 x 3 s longer',1e-9); near(v.drT,3.55,'',1e-9); assert.ok(win(L,'fc'));
  near(v.drMul,base-0.05,'Hand\'s Width: 1 point x 5 more damage reduction',1e-9);
  v.hp=v.maxHp*0.4; V.step(1); near(v.drMul,base-0.10,'Unbitten: below 50% HP, 1 point x 5 more',1e-9);
  secs(3.55); assert.ok(!win(L,'fc')); assert.ok(win(L,'ready'),'Ready Stance: 2 s after it ends'); v.drT=0; v.drMul=1; v._evadeT=0;   /* (a held unit's evade window does not run down) */
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*(1-0.075),'1.5% x 5 less'); secs(2.05); near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'2 s');
  near(FX.cd(v,'blue',9),9-0.75-0.75,'Spinning Fins and Swift Swim: 0.15 x 5 s each');
  plain({foes:3,big:true},P=>{ V.cast(P.v,'blue'); near(P.v.drMul,base,'(without them: the skill\'s own value)',1e-9); near(P.v._evadeT,2.6,'',1e-9); });
});

test('Calypsa / Sharp Reply, Still Water (PICK ONE) and Deep Stillness: every attack in the stance countered at 50%',()=>{
  const L=lab(H,S(['nb_5_2','nb_6_2','nb_4_2']),{foes:3,big:true}), {v,F}=L; noDef(L);
  near(skillRatio(L,F[1],'counter'),0.5*1.24*1.20,'the counter: 50% (Still Water), Sharp Reply 4% x 5, Deep Stillness 8% x 3');
  stance(L); near(hitOn(L,v,1000,{src:F[0]}),0,'the first attack is evaded');
  const f1=F[1].hp, took=hitOn(L,v,1000,{src:F[1]}); assert.ok(took>0,'the next one lands');
  near(f1-F[1].hp,v.dmg*v._evadeMul*0.5*1.24*1.20*dm(v,F[1],'phys'),'and is countered at 50% (physical)',1e-6);
  const f2=F[2].hp; hitOn(L,v,1000,{src:F[2]}); assert.ok(F[2].hp<f2,'every attack in its time'); secs(2.7); const f3=F[2].hp; hitOn(L,v,1000,{src:F[2]}); near(f3-F[2].hp,0,'not after it');
  const L2=lab(H,S(['nb_4_2']),{foes:3,big:true}); stance(L2); hitOn(L2,L2.v,10,{src:L2.F[0]}); const g=L2.F[1].hp; hitOn(L2,L2.v,10,{src:L2.F[1]}); near(g-L2.F[1].hp,0,'(without Still Water: one counter)');
  near(skillRatio(L2,L2.F[1],'counter'),1.20,'Sharp Reply alone');
  let c0; plain({foes:3,big:true},P=>{ noDef(P); V.cast(P.v,'blue'); c0=lost(P.F[0],()=>V.hit(P.F[0],P.v,10,{kind:'true'})); });
  const L3=lab(H,S(['nb_4_2']),{foes:3,big:true}); noDef(L3); V.cast(L3.v,'blue'); const c1=lost(L3.F[0],()=>V.hit(L3.F[0],L3.v,10,{kind:'true'})), w=L3.v;
  near(c1-c0,0.20*w.dmg*w._evadeMul*VMX('elemMul')(w,L3.F[0])*dm(w,L3.F[0],'phys'),'the real counter is 20% larger (its blade is not)',1e-6);
});

test('Calypsa / Bright Water (PICK ONE) and Quick Water: a counter takes 3 s off Fighting Current, then 4% x 3 attack speed for 3 s',()=>{
  const L=lab(H,S(['nb_5_3','nb_6_3']),{foes:3,big:true}), {v,F}=L; const i0=v.atkInterval;
  stance(L); v.blueCd=9; hitOn(L,v,10,{src:F[0]}); near(v.blueCd,6,'3 s shorter'); V.step(1); near(v.atkInterval,i0/1.12,'Quick Water');
  secs(3.1); near(v.atkInterval,i0,'3 s');
});

test('Calypsa / Weariness: Wear Them Out, Tired Fins, Gasping, Worn Thin, Party Trick, Answer in Kind, Slow Ruin, Spent Rival, Ring Wise',()=>{
  const L=lab(H,S(['nb_1_4','nb_2_4','nb_6_4','nb_5_4','nb_7_3','nb_11_1','nb_10_4','nb_4_4','nb_12_3']),{foes:4,allies:1,big:true}), {v,F,A}=L;
  stance(L); hitOn(L,v,10,{src:F[0]}); assert.equal(ust(L,F[0],'wear'),1,'the enemy she dodges and counters: 1 Weariness');
  secs(7.8); assert.equal(ust(L,F[0],'wear'),1,'Tired Fins: it lasts 5 + 1 x 3 s'); secs(0.4); assert.equal(ust(L,F[0],'wear'),0,'then lapses');
  F[0].speed=100; const i0=F[0].atkInterval; setUst(L,F[0],'wear',4); V.step(2); near(F[0].atkInterval,i0/(1-0.06*4),'Wear Them Out: each Weariness 2% x 3 slower attacks'); near(F[0].speed,90,'Gasping: 5% x 2 slower');
  near(ratio(L,F[0]),1.20*1.05,'Worn Thin 1% x 5 per Weariness, Slow Ruin 1% x 5 (her team, herself included)'); near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.05,'Slow Ruin: an ally\'s hit');
  near(ratio(L,F[0],{crit:true}),1.20*1.05*1.15,'Party Trick: her crits 3% x 5 more'); near(skillRatio(L,F[0],'blade'),1.20*1.05*1.20,'Answer in Kind: her blades 1% x 5 per Weariness');
  near(ratio(L,F[1]),1,'not on an enemy without Weariness');
  setUst(L,F[1],'wear',5); near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*0.91,'Spent Rival: an enemy at 5 deals 3% x 3 less'); near(hitOn(L,A[0],1000,{src:F[1]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[1]}))*0.91,'to anyone');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]})),'not at 4');
  const a0=v.armorRating, m0=v.mrRating; setUst(L,F[3],'wear',5); setUst(L,F[2],'wear',5); V.step(1); near(v.armorRating,a0*(1+0.06*3),'Ring Wise: 3% x 2 armor per enemy at 5, up to 3'); near(v.mrRating,m0*1.18,'');
  setUst(L,F[0],'wear',5); V.step(1); near(v.armorRating,a0*1.18,'(still 3)');
});

test('Calypsa / Exhausted, Wearing Down, Outlasted, Last Fish Standing',()=>{
  const L=lab(H,S(['nb_7_4','nb_8_4','nb_9_4','nb_12_4','nb_1_4']),{foes:4,big:true}), {v,F}=L; free(F[2]); at(L,F[2],25,0);
  setUst(L,F[2],'wear',3); stance(L); hitOn(L,v,10,{src:F[2]}); assert.equal(ust(L,F[2],'wear'),5,'Wearing Down: the blade adds a second Weariness (20% x 5)'); near(F[2].stunned,0.8,'Exhausted: it reached 5: stunned 0.8 s',1e-9);
  F[2].stunned=0; setUst(L,F[2],'wear',4); stance(L); hitOn(L,v,10,{src:F[2]}); near(F[2].stunned,0,'once per enemy per wave');
  V.wave(); V.step(1); free(F[2]); setUst(L,F[2],'wear',4); stance(L); hitOn(L,v,10,{src:F[2]}); assert.ok(F[2].stunned>0.7,'a new wave');
  setUst(L,F[1],'wear',3); setUst(L,F[0],'wear',1); v.hp=v.maxHp*0.5; const h0=v.hp; kill(L,F[1]); assert.equal(ust(L,F[0],'wear'),4,'Outlasted: its 3 Weariness pass to the nearest enemy');
  near(v.hp-h0,v.maxHp*0.03,'Last Fish Standing: 1% x 3 of her max HP',1e-6); const h1=v.hp; kill(L,F[3]); near(h1-v.hp,0,'not an enemy without Weariness');
});

test('Calypsa / Never Bit First (SIGNATURE): the attack misses, Fighting Current starts, its counters give full Weariness and fire a blade at each enemy within 4 m',()=>{
  const L=lab(H,S(['nb_13_2','nb_1_4']),{foes:4,big:true}), {v,F}=L; at(L,F[3],0,4.3);
  near(hitOn(L,v,1000,{src:F[1],kind:'phys'}),0,'Fighting Current down: the attack misses (true damage cannot miss)'); assert.ok(v._evadeT>2.5,'Fighting Current starts at once'); assert.ok(win(L,'nbf')&&win(L,'fc'));
  assert.equal(ust(L,F[1],'wear'),1,'(the dodge: 1 Weariness)'); const h=F.map(f=>f.hp);
  hitOn(L,v,1000,{src:F[2]}); assert.equal(ust(L,F[2],'wear'),5,'its counter: full Weariness'); assert.ok(F[0].hp<h[0],'a blade at F0 (0.48 m)'); assert.ok(F[3].hp<h[3],'and F3 (2.3 m)'); near(h[1]-F[1].hp,0,'not F1 (more than 4 m away)');
  near(h[0]-F[0].hp,(v.apow||v.dmg)*0.55*v.passMul*dm(v,F[0],'magic'),'the blade\'s own size (magic)',1e-6);
  secs(4); assert.ok(hitOn(L,v,1000,{src:F[1],kind:'phys'})>0,'once every 20 s: the next attack lands'); secs(15.3); assert.ok(hitOn(L,v,1000,{src:F[1],kind:'phys'})>0,'(19.3 s: still)'); secs(0.9); near(hitOn(L,v,1000,{src:F[1],kind:'phys'}),0,'20 s later again');
});

test('Calypsa / the blade: Prism Edge, Straight Answer, Answering Spray, Rainbow Spray; Never Cornered',()=>{
  const L=lab(H,S(['nb_5_1','sl_7_4','pp_7_4','nb_10_3','nb_4_3']),{foes:3,big:true}), {v,F}=L;
  near(skillRatio(L,F[1],'blade'),1.20*1.20*1.20,'three talents, 4% x 5 each'); near(ratio(L,F[1]),1,'not another hit');
  v.hp=v.maxHp*0.5; const h0=v.hp; L.T.s.cur='blade'; const d=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})); L.T.s.cur=null; near(v.hp-h0,d*0.15,'Rainbow Spray: 3% x 5 of the blade\'s damage',1e-6);
  v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.85,'Never Cornered: 5% x 3 shorter',1e-9);
});

test('Calypsa / Hold the Flare: each counter this wave 0.5% x 5 attack, up to 10',()=>{
  const L=lab(H,S(['nb_12_2']),{foes:3,big:true}), {v,F}=L; const a0=v.dmg;
  for(let i=0;i<3;i++){ stance(L); hitOn(L,v,10,{src:F[0]}); } V.step(1); near(v.dmg,a0*(1+0.025*3),'3 counters');
  for(let i=0;i<12;i++){ stance(L); hitOn(L,v,10,{src:F[0]}); } V.step(1); near(v.dmg,a0*1.25,'up to 10'); V.wave(); V.step(2); assert.equal(stack(L,'flare'),0,'this wave');
});

/* ============================== STRAIGHT LINES ============================== */
test('Calypsa / Soaked: Wet Through, Soak Deep, Waterlogged, Drenched, Cold Water, Heavy Water, Sodden, Riptide, Pooling Water, Flood Line, Saturated',()=>{
  const L=lab(H,S(['sl_1_1','sl_2_1','sl_3_1','sl_4_1','sl_5_1','sl_6_1','sl_8_1','sl_9_1','sl_10_1','sl_11_1','sl_12_1']),{foes:4,allies:1,big:true}), {v,F,A}=L;
  const ap0=v.apow; F[0].speed=100; ribbon(L,0.9); for(const i of [0,1,2]) assert.ok(mark(L,F[i],'soak'),'every enemy her water hits is Soaked: F'+i); assert.ok(!mark(L,F[3],'soak'));
  near(skillRatio(L,F[1],'piercethrow'),1.075*1.05,'Wet Through: her water 1.5% x 5 more on a Soaked enemy (Pooling Water 1% x 5 her team)'); near(ratio(L,F[1],{auto:true}),1.10*1.05,'Heavy Water: her basic attacks 2% x 5');
  near(skillRatio(L,F[3],'piercethrow'),1,'not on an enemy that is not Soaked');
  near(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})),plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})))*1.05,'Pooling Water: an ally\'s hit');
  F[1].hp=F[1].maxHp*0.49; near(ratio(L,F[1]),1.05*1.15,'Riptide: below 50% HP 3% x 5'); F[1].hp=F[1].maxHp;
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*0.925,'Cold Water: a Soaked enemy deals 1.5% x 5 less'); near(hitOn(L,A[0],1000,{src:F[1]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[1]}))*0.925,'to anyone');
  F[1].hp=F[1].maxHp*0.5; const g=-lost(F[1],()=>V.heal(F[1],1000)), g0=plainHit(L,()=>-lost(F[1],()=>V.heal(F[1],1000))); near(g,g0*0.90,'Sodden: 2% x 5 less healing');
  V.step(1); near(v.apow,ap0*(1+0.03*2),'Flood Line: F0 and F1 within 6 m, 0.6% x 5 each');
  V.step(2); near(F[0].speed,88,'Waterlogged: 4% x 3 slower');
  const f=F[2]; f.armorRating=300; f.mrRating=300; const x=v._wpnArmIgn, d0=dm(v,f,'phys'), m0=dm(v,f,'magic');
  assert.ok(!mark(L,f,'drench')); v._wpnArmIgn=0.09; const d9=dm(v,f,'phys'); v._wpnArmIgn=x; const keep=f.mrRating; f.mrRating=300*0.91; const m9=dm(v,f,'magic'); f.mrRating=keep;
  near(ratio(L,f,{kind:'phys'}),d9/d0*1.05,'Saturated: 3% x 3 of its armor ignored (Pooling Water on top)'); near(ratio(L,f,{kind:'magic'}),m9/m0*1.05,'and of its magic resist');
  V.hit(v,f,10,{kind:'true'}); assert.ok(mark(L,f,'drench'),'Drenched: she hits it while it is Soaked');
  v._wpnArmIgn=1-(1-0.15); const d15=dm(v,f,'phys'); v._wpnArmIgn=x; near(ratio(L,f,{kind:'phys'}),(d15/d0)*(d9/d0)*1.05,'its armor counts 15% lower against her (and Saturated on top)');
  secs(3.1); assert.ok(!mark(L,f,'drench'),'Drenched 3 s'); secs(6.0-V.now()); assert.ok(mark(L,F[0],'soak'),'Soak Deep: Soaked 4 + 0.4 x 5 s (F0 from 0.225 s)'); secs(0.45); assert.ok(!mark(L,F[0],'soak'),'then over'); V.step(2); near(F[0].speed,100,'');
});

test('Calypsa / the line: Into the Next, Long Blades, Through the Glass (PICK ONE), First Crack, Rainbow Edge, Curved No More, Undertow, Rippling, Both Edges',()=>{
  let p; plain({foes:3,big:true},P=>{ noDef(P); p=losses(P,()=>ribbon(P,1.0)); });
  const L=lab(H,S(['sl_1_3','sl_10_3','sl_5_2','sl_6_2','sl_5_4','sl_3_4','sl_12_4','sl_9_4','sl_6_4','sl_12_2']),{foes:3,big:true}), {v,F}=L; noDef(L); free(F[0]); const i0=v.atkInterval, a0=v.dmg, ap0=v.apow;
  const far=f=>Math.hypot(f.x-v.x,f.y-v.y)/V.METER-V.bodyR(v)-V.bodyR(f)>6, cn=f=>far(f)?1.09:1;
  const q=losses(L,()=>{ V.cast(v,'green'); secs(0.3); assert.ok(F[0].stunned>0.6-0.1-1e-9&&F[0].stunned<=0.6+1e-9,'First Crack: the first enemy stunned 0.2 x 3 s (full, fixed): '+F[0].stunned); secs(0.7); }), per=0.09+0.05;
  near(q[0]/p[0],1.15*1.30,'F0, the first: Rainbow Edge 3% x 5, Through the Glass 30%'); near(q[1]/p[1],1.15*(1+per)*cn(F[1]),'F1: Into the Next 3% x 3 + Long Blades 1% x 5 for 1 enemy before it (Curved No More if it is more than 6 m away)');
  near(q[2]/p[2],1.15*(1+per*2)*1.09,'F2: for 2, and Curved No More (more than 6 m away) 3% x 3'); assert.ok(far(F[2])&&!far(F[0]));
  assert.ok(F[1].slowMul<0.8+1e-9&&F[1].slowMul>0.8-1e-9&&F[1].slow>1.0,'Undertow: slowed 4% x 5 for 2 s');
  V.step(1); near(v.atkInterval,i0/(1+0.03*3),'Rippling: 1.5% x 2 attack speed per enemy cut'); near(v.dmg,a0*(1+0.025*3),'Both Edges: 0.5% x 5 attack per enemy'); near(v.apow,ap0*1.075,'and ability power');
  secs(5.2); near(v.dmg,a0,'Both Edges 5 s'); near(v.atkInterval,i0,'Rippling 4 s');
});

test('Calypsa / Line Breaker: Into the Next sharpens on 5 + 1 per rank enemies',()=>{
  { const L=lab(H,S(['sl_1_3']),{foes:8,big:true}), {v,F}=L; L.T.s.ln={L:F.slice(),P:F.map(f=>f.x-v.x),n:0,i:7,raw:1,spd:1,W:1,end:1e9,skill:'piercethrow'}; near(skillRatio(L,F[7],'piercethrow'),1+0.09*5,'without it: 5 at most'); L.T.s.ln=null; }
  const L=lab(H,S(['sl_1_3','sl_7_3']),{foes:8,big:true}), {v,F}=L; F.forEach((f,i)=>at(L,f,4.5+4.6*i,0)); V.step(1);
  L.T.s.ln={L:F.slice(),P:F.map(f=>f.x-v.x),n:0,i:0,raw:1,spd:1,W:1,end:1e9,skill:'piercethrow'};
  for(const [i,k] of [[5,5],[7,7]]){ L.T.s.ln.i=i; near(skillRatio(L,F[i],'piercethrow'),1+0.09*k,'the '+(i+1)+'th enemy: '+k+' before it count'); }
  L.T.s.ln=null;
});

test('Calypsa / Through the Table (PICK ONE) and Dinner Table: the last enemy on the line 30% + 6% x 3 more',()=>{
  let p; plain({foes:3,big:true},P=>{ noDef(P); p=losses(P,()=>ribbon(P,1.0)); });
  const L=lab(H,S(['sl_5_3','sl_6_3']),{foes:3,big:true}); noDef(L); const q=losses(L,()=>ribbon(L,1.0));
  near(q[2]/p[2],1.48,'the last'); near(q[0]/p[0],1,'not the first'); near(q[1]/p[1],1,'');
});

test('Calypsa / Flow, Fast Current, Clean Exit, Ribbon Speed, Clean Edges',()=>{
  { const L=lab(H,S(['sl_9_2']),{foes:4,big:true}), {v,F}=L; at(L,F[3],21,0); V.step(1); v.blueCd=9; ribbon(L,1.0); near(v.blueCd,0,'Flow: 4 enemies cut, Fighting Current ready');
    at(L,F[3],0,6); V.step(1); v.blueCd=9; ribbon(L,1.0); near(v.blueCd,9,'3: not'); }
  { const L=lab(H,S(['sl_4_4','sl_12_3']),{foes:3,big:true}), {v,F}=L; near(FX.cd(v,'green',6),6-0.9,'Fast Current: 0.3 x 3 s shorter');
    v.greenCd=6; F[0].maxHp=1e5; F[0].hp=1; V.cast(v,'green'); secs(0.4); assert.ok(!F[0].alive); near(v.greenCd,4,'Clean Exit: a kill by the Ribbon, 1 x 2 s off it'); }
  plain({foes:3,big:true},P=>{ const h=P.F[2].hp; V.cast(P.v,'green'); secs(0.68); near(h-P.F[2].hp,0,'(without Ribbon Speed: F2 not reached at 0.68 s)'); });
  { const L=lab(H,S(['sl_10_4']),{foes:3,big:true}), {v,F}=L; const h=F[2].hp; V.cast(v,'green'); secs(0.68); assert.ok(F[2].hp<h,'Ribbon Speed: the sabers 6% x 5 faster'); }
  const L=lab(H,S(['sl_3_4']),{foes:3,big:true}), {v,F}=L; const f=F[1]; f.armorRating=300; const x=v._wpnArmIgn, a=dm(v,f,'phys'); v._wpnArmIgn=0.09; const b=dm(v,f,'phys'); v._wpnArmIgn=x;
  near(skillRatio(L,f,'piercethrow','phys'),b/a,'Clean Edges: the Ribbon ignores 3% x 3 of armor'); near(ratio(L,f,{kind:'phys'}),1,'not her basic attack');
});

test('Calypsa / Straight Line and Long Cut: the line runs through the most enemies; 30% and 4% x 5 wider',()=>{
  const place=P=>{ at(P,P.F[2],0,18); at(P,P.F[3],15,0); V.step(1); };
  plain({foes:4,big:true},P=>{ place(P); const q=losses(P,()=>ribbon(P,1.2)); assert.ok(q[2]>0&&q[0]===0&&q[3]===0,'(untalented: toward the farthest, F2, alone)'); });
  { const L=lab(H,S(['sl_3_3']),{foes:4,big:true}); place(L); const q=losses(L,()=>ribbon(L,1.2));
    assert.ok(q[0]>0&&q[1]>0&&q[3]>0,'Straight Line: toward F3, through F0 and F1'); near(q[2],0,'not F2'); near(L.T.s.ln.W,36*1.15*1.3,'30% wider',1e-9); }
  plain({foes:3,big:true},P=>{ at(P,P.F[1],10,1.4); V.step(1); const q=losses(P,()=>ribbon(P,1.2)); near(q[1],0,'(an enemy 1.4 m off the line is not cut: 1.28 m each side)'); });
  const L=lab(H,S(['sl_2_3']),{foes:3,big:true}); at(L,L.F[1],10,1.4); V.step(1); const q=losses(L,()=>ribbon(L,1.2)); assert.ok(q[1]>0,'Long Cut: 1.28 x 1.2 m each side: it is'); near(L.T.s.ln.W,36*1.15*1.2,'',1e-9);
});

test('Calypsa / Twin Ribbon and The First Escape (SIGNATURE)',()=>{
  { const L=lab(H,S(['sl_11_3']),{foes:3,big:true}), {v,F}=L; noDef(L); losses(L,()=>{ V.cast(v,'green'); secs(0.6); }); const raw=L.T.s.ln.raw;
    const b=losses(L,()=>secs(0.35)); near(b[1],raw*0.35*dm(v,F[1],'phys'),'Twin Ribbon: F1 again 0.3 s after the line, for 35%',1e-6);
    const c=losses(L,()=>secs(0.3)); near(c[1],0,'once'); near(c[2],raw*0.35*dm(v,F[2],'phys'),'F2 0.3 s after its own cut',1e-6); }
  let p; plain({foes:3,big:true},P=>{ noDef(P); p=losses(P,()=>ribbon(P,2.0)); });
  const L=lab(H,S(['sl_13_3']),{foes:3,big:true}), {v,F}=L; noDef(L); for(const f of F) setMk(L,f,'soak',99);
  const q=losses(L,()=>{ V.cast(v,'green'); near(L.T.s.ln.end,1e9,'3 Soaked enemies on the line: it runs on to the edge of the field'); secs(0.3); for(const f of F) assert.ok(mark(L,f,'drench'),'every enemy on it Drenched'); secs(1.7); });
  const raw=L.T.s.ln.raw; for(let i=0;i<3;i++) near(q[i]-p[i],raw*dm(v,F[i],'phys'),'the sabers sweep back for full damage: F'+i,1e-6);
  V.cast(v,'green'); assert.ok(L.T.s.ln.end<1e8,'once every 15 s'); secs(14.3-V.now()); for(const f of F) setMk(L,f,'soak',99); V.cast(v,'green'); assert.ok(L.T.s.ln.end<1e8,'(14.3 s: not yet)'); secs(0.9); for(const f of F) setMk(L,f,'soak',99); V.cast(v,'green'); near(L.T.s.ln.end,1e9,'15 s later');
  secs(15.1); for(const f of [F[0],F[1]]) setMk(L,f,'soak',99); unsoak(L,F[2]); V.cast(v,'green'); assert.ok(L.T.s.ln.end<1e8,'2 Soaked: no');
});

/* ============================== THE PARTY PIECE ============================== */
test('Calypsa / Carried Water: Both Hands Full, Deep Bowl, Bucket Brigade, Spilled Over, Carried Weight, Never Empty, Pour, No Walls',()=>{
  const L=lab(H,S(['pp_1_1','pp_2_1','pp_8_1','pp_3_1','pp_4_1','pp_10_1','pp_5_1','pp_12_1']),{foes:3,big:true}), {v,F}=L; const ap0=v.apow, i0=v.atkInterval;
  V.hit(v,F[0],10,{kind:'true',auto:true}); assert.equal(stack(L,'water'),16,'a basic attack: 10 + Deep Bowl 2 x 3'); stance(L); hitOn(L,v,10,{src:F[1]}); assert.equal(stack(L,'water'),46,'a dodge: 10 + Bucket Brigade 4 x 5');
  V.step(1); near(v.apow,ap0,'below 50: no Carried Weight'); setStack(L,'water',50); V.step(1); near(v.apow,ap0*1.10,'Carried Weight: at 50 or more, 2% x 5 ability power');
  setStack(L,'water',95); v.shield=0; V.hit(v,F[0],10,{kind:'true',auto:true}); assert.equal(stack(L,'water'),100,'max 100'); near(v.shield,v.maxHp*0.01,'Spilled Over: 10 of the 11 over: a 1% shield',1e-9);
  near(skillRatio(L,F[1],'piercethrow','true',{rb:true}),1.20,'Both Hands Full: a Brimming ability 4% x 5 more'); near(skillRatio(L,F[1],'piercethrow','true',{rb:false}),1,'not when it is not');
  setStack(L,'water',99); V.cast(v,'green'); assert.ok(!L.T.s.rb,'99 Water: not Brimming'); assert.equal(stack(L,'water'),99,'nothing spent'); setStack(L,'water',100);
  v.hp=v.maxHp*0.5; const h0=v.hp; V.cast(v,'green'); assert.ok(L.T.s.rb,'at 100 Water the Ribbon is Brimming'); assert.equal(stack(L,'water'),20,'it spends all; Never Empty leaves 4 x 5');
  near(v.hp-h0,v.maxHp*0.10,'Pour: 2% x 5 of her max HP',1e-6); V.step(1); near(v.atkInterval,i0/(1+0.03*4),'No Walls: 80 Water spent, 1% x 3 per 20');
  secs(4.1); near(v.atkInterval,i0,'4 s'); V.cast(v,'green'); assert.ok(!L.T.s.rb,'20 Water: not Brimming');
});

test('Calypsa / Brimming: Brimful, Crowd Pleaser, Two-Handed, Spill Down the Line (LINK, with Wet Through), Ribbon of Water, Applause',()=>{
  const L=lab(H,S(['pp_6_1','pp_5_4','pp_11_1','pp_n1','sl_1_1','pp_9_3','pp_1_3']),{foes:4,big:true}), {v,F}=L; const f=F[1]; f.armorRating=300; f.mrRating=300;
  const x=v._wpnArmIgn, a=dm(v,f,'phys'); v._wpnArmIgn=0.10; const b=dm(v,f,'phys'); v._wpnArmIgn=x;
  near(skillRatio(L,f,'piercethrow','phys',{rb:true}),(b/a)*1.15,'Brimful 2% x 5 of armor ignored, Two-Handed 3% x 5'); unsoak(L,f); near(skillRatio(L,f,'thundershower','phys',{sb:true}),b/a,'a Brimming storm: Brimful'); unsoak(L,f);
  near(skillRatio(L,F[3],'piercethrow','true',{rb:true,ln:{i:0,n:0,L:[F[3]],P:[1]}})/1.15,1.08,'Spill Down the Line: the first enemy cut 8% more');
  L.T.s.cur='piercethrow'; L.T.s.rb=true; const p=_crit(L,F[2]); L.T.s.cur=null; L.T.s.rb=false; near(p,1.15*1.20,'Crowd Pleaser: its crits 4% x 5 more');
  setStack(L,'water',100); V.cast(v,'green'); secs(0.3); const m=F[0]._talM[v.uid].soak; near(m.until-V.now(),5-0.3+0.225,'(with Wet Through) the first enemy Soaked 1 s longer',0.05);
  setMk(L,F[3],'dazz',9); const w=stack(L,'water'); kill(L,F[3]); assert.equal(stack(L,'water'),w+50,'Applause: a Dazzled enemy dies: 10 x 5 Water');
  const L2=lab(H,S(['pp_7_1']),{foes:4,big:true}); noDef(L2); setStack(L2,'water',100); const h=L2.F[3].hp; V.cast(L2.v,'green'); const raw=L2.T.s.ln.raw; secs(0.4); near(h-L2.F[3].hp,raw*dm(L2.v,L2.F[3],'phys'),'Ribbon of Water: a second line toward the farthest enemy the first missed (F3)',1e-6);
  const L3=lab(H,S(['pp_7_1']),{foes:4,big:true}); const g=L3.F[3].hp; V.cast(L3.v,'green'); secs(0.4); near(g-L3.F[3].hp,0,'not when it is not Brimming');
});
function _crit(L,t){ const a=lost(t,()=>V.hit(L.v,t,1000,{kind:'true',crit:true})), s=L.T.s, k=[s.cur,s.rb]; const b=plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,{kind:'true',crit:true}))); return a/b; }

test('Calypsa / the storm: Gathering Storm, Wider Storm, Five Clear Blades, Tempest Soak, Stinging Spray; Dazzled: Trailing Rainbows, Dazzling, Showstopper, Gasp, Liked It, Prism Burst',()=>{
  const L=lab(H,S(['pp_1_2','pp_2_2','pp_12_2','sl_7_1','pp_3_2','pp_1_3','pp_3_3','pp_4_3','pp_7_3','pp_12_3','pp_10_3']),{foes:4,allies:1,big:true}), {v,F,A}=L; at(L,F[3],10,6.8); V.step(1);
  const ap0=v.apow, c0=v.glyphCrit||0;
  near(skillRatio(L,F[2],'thundershower','true',{tz:{}}),1.15*1.20,'Gathering Storm 3% x 5; Five Clear Blades: the first strike on each enemy 4% x 5'); unsoak(L,F[2]);
  near(skillRatio(L,F[2],'thundershower','true',{tz:{[F[2].uid]:1}}),1.15,'not the second'); unsoak(L,F[2]);
  setMk(L,F[2],'soak',9); near(skillRatio(L,F[2],'thundershower','true',{tz:{[F[2].uid]:1}}),1.15*1.25,'Tempest Soak: on a Soaked enemy 25% more'); unsoak(L,F[2]);
  V.cast(v,'ult',F[1]); go(L); V.step(1); near(v._stormR,6*V.METER*1.2,'Wider Storm: 4% x 5',1e-9); near((v.glyphCrit||0)-c0,0.10,'Stinging Spray: 2% x 5 critical chance while it lasts',1e-9);
  secs(1.05); for(const i of [0,1,2,3]) assert.ok(!mark(L,F[i],'dazz'),'2 strikes: not yet'); secs(0.5); for(const i of [0,1,2,3]) assert.ok(mark(L,F[i],'dazz'),'3 strikes of one storm: Dazzled, F'+i); assert.ok(mark(L,F[0],'soak'),'(its strikes Soak: her water)');
  V.step(1); near(v.apow,ap0*(1+0.04*3+0.05*4),'Liked It (2% x 2, up to 3) and Gasp (1% x 5 each Dazzled)');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.91,'Trailing Rainbows: a Dazzled enemy deals 3% x 3 less'); near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]}))*0.91,'to anyone');
  near(ratio(L,F[0]),1.09,'Showstopper: 3% x 3 more from her'); near(ratio(L,F[0],{crit:true}),1.09*1.10,'Prism Burst: 2% x 5 more critical damage');
  secs(4); hold(L); near((v.glyphCrit||0)-c0,0,'the storm is over'); const t=F[0]._talM[v.uid].dazz; near(t.until-t.t0,4.5,'Dazzling: 3 + 0.3 x 5 s',1e-6);
  plain({foes:4},P=>{ at(P,P.F[3],10,6.8); V.step(1); const h=P.F[3].hp; V.cast(P.v,'ult',P.F[1]); go(P); secs(0.6); near(h-P.F[3].hp,0,'(without Wider Storm: 6.8 m out of it)'); });
});

test('Calypsa / Bright Show: a Dazzled enemy\'s basic attacks miss 25% of the time (the fight\'s seeded stream)',()=>{
  const L=lab(H,S(['pp_11_3']),{foes:3,allies:1,big:true}), {v,F,A}=L; setMk(L,F[0],'dazz',99); let m=0, n=0, ma=0;
  for(let i=0;i<80;i++){ if(hitOn(L,v,100,{auto:true})===0) m++; if(hitOn(L,A[0],100,{auto:true})===0) ma++; if(hitOn(L,v,100,{src:F[1],auto:true})===0) n++; }
  assert.ok(m>8&&m<35,'on her: '+m+' of 80'); assert.ok(ma>8&&ma<35,'on an ally: '+ma+' of 80'); assert.equal(n,0,'not an enemy that is not Dazzled');
  let s=0; for(let i=0;i<20;i++) if(hitOn(L,v,100)===0) s++; assert.equal(s,0,'not a skill');
});

test('Calypsa / Hold the Wave (PICK ONE) and Long Storm; Break the Wave (PICK ONE) and Crashing Wave: one strike at once for 2.5 times, 3 strikes for Dazzled',()=>{
  { const L=lab(H,S(['pp_5_2','pp_6_2']),{foes:3,big:true}), {v,F}=L; V.cast(v,'ult',F[1]); near(v._stormT,4.5,'1.5 s longer',1e-9); near(v._stormMul,0.6*0.8,'strikes 20% weaker',1e-9);
    near(skillRatio(L,F[2],'thundershower'),1.15,'Long Storm: 5% x 3'); }
  let p; plain({foes:3,big:true},P=>{ V.cast(P.v,'ult',P.F[1]); go(P); p=losses(P,()=>secs(0.53)); });
  const L=lab(H,S(['pp_5_3','pp_6_3','pp_1_3']),{foes:3,big:true}), {v,F}=L; V.cast(v,'ult',F[1]); go(L); const q=losses(L,()=>V.step(1));
  near(q[1]/p[1],2.5*1.18,'Break the Wave: at once, 2.5 times a strike, Crashing Wave 6% x 3'); assert.ok(mark(L,F[1],'dazz'),'counts as 3 strikes: Dazzled'); const r=losses(L,()=>secs(2)); near(r[1],0,'and that is all');
});

test('Calypsa / Thousand Fins, Rainbow Rain, Storm Eye',()=>{
  const L=lab(H,S(['pp_10_2','pp_9_2','pp_8_2']),{foes:3,allies:1,big:true}), {v,F,A}=L; v.hp=v.maxHp*0.5; A[0].hp=A[0].maxHp*0.5;
  V.cast(v,'ult',F[0]); go(L); const a0=v._stormAcc; V.step(10); near(v._stormAcc-a0,10*V.STEP*1.15,'Thousand Fins: the pulses come 3% x 5 sooner',1e-6);
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*0.90,'Storm Eye: she stands inside her storm (F0 its centre, 4.5 m), 2% x 5 less');
  const h=v.hp, ha=A[0].hp; secs((0.5-v._stormAcc)/1.15+V.STEP); near(v.hp-h,v.maxHp*0.005,'Rainbow Rain: each strike heals the allies inside it 0.5% of their max HP',1e-6); near(ha-A[0].hp,0,'not an ally outside (A0, 7.1 m from its centre)');
  secs(3); near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'the storm is over');
});

test('Calypsa / Never Seen the Sea (SIGNATURE): a Brimming storm covers the whole field, Dazzles, refills 5 Water each strike; once every 30 s',()=>{
  const L=lab(H,S(['pp_13_2','pp_1_1']),{foes:6,big:true}), {v,F}=L; setStack(L,'water',100); V.cast(v,'ult',F[1]); go(L);
  assert.ok(v._stormR>1e5,'no walls'); secs(1.55); for(const f of F) assert.ok(mark(L,f,'dazz'),'every enemy struck 3 times is Dazzled'); assert.equal(stack(L,'water'),15,'5 Water each strike');
  secs(2); hold(L); setStack(L,'water',100); V.cast(v,'ult',F[1]); near(v._stormR,6*V.METER,'once every 30 s',1e-9); v._stormT=0; secs(29.4-V.now()); setStack(L,'water',100); V.cast(v,'ult',F[1]); near(v._stormR,6*V.METER,'(29.4 s: not yet)',1e-9); v._stormT=0; secs(1.0); setStack(L,'water',100); V.cast(v,'ult',F[1]); assert.ok(v._stormR>1e5,'30 s later');
  const L2=lab(H,S(['pp_13_2','pp_1_1']),{foes:6,big:true}); V.cast(L2.v,'ult',L2.F[1]); go(L2); near(L2.v._stormR,6*V.METER,'not Brimming: not',1e-9); secs(1.6); assert.ok(!mark(L2,L2.F[1],'dazz'),'and no Dazzled');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Calypsa: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['nb_1_1','nb_1_4','nb_2_2','sl_1_1','sl_1_3','sl_9_2','pp_1_1','pp_1_3','pp_2_1','nb_12_2']), TEAM=['vael','sylthaine','vireo','vex','calypsa'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let wear=0,soak=false,dazz=false,cut=0,brim=false;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); if(T0.ln) cut=Math.max(cut,T0.ln.n); if(T0.rb||T0.sb) brim=true;
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.soak&&o.soak.until>V.now()) soak=true; if(o.dazz&&o.dazz.until>V.now()) dazz=true; if(o['#wear']&&o['#wear'].until>V.now()) wear=Math.max(wear,o['#wear'].v); } }
  console.log('  live fight: max '+JSON.stringify(mx)+', Weariness '+wear+', cut '+cut+', Soaked '+soak+', Dazzled '+dazz+', Brimming '+brim);
  assert.ok(mx.ans>=1,'real evades stored Answers: '+mx.ans); assert.ok(wear>=1,'real Weariness'); assert.ok(soak,'real Soaked'); assert.ok(cut>=2,'a real Ribbon cut '+cut); assert.ok(mx.water>=30,'real Water: '+mx.water); assert.ok(dazz,'a real storm Dazzled');
  determinism(H,TEAM);
});

/* The page sites her talents added (the Ribbon's aim, its line and each hit of it; the evade, the counter and the blade; the storm's pulses): with nothing learned,
   whole seeded fights with Calypsa in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Calypsa: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['calypsa','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __caN={ribbon:0,cut:0,fc:0,evade:0,counter:0,blade:0,storm:0,pulse:0}; var __caD=_doEffectCore, __caH=dealDamage, __caR=ringBurst;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="calypsa"&&(!o||!o.deliver||o.deliver==="line"||o._arrived)){ if(type==="piercethrow") __caN.ribbon++; if(type==="evadecounter") __caN.fc++; if(type==="thundershower") __caN.storm++; } return __caD.apply(this,arguments); };'+
    'dealDamage=function(s,t,a,c){ if(s&&s.key==="calypsa"){ if(c==="#5ed0e8") __caN.cut++; if(c==="#bfe8ff") __caN.counter++; if(c==="#3aa0d8") __caN.blade++; if(c==="#f2e07a") __caN.pulse++; } return __caH.apply(this,arguments); };'+
    'ringBurst=function(x,y,c,n){ if(c===0x9fd8ff&&n===10) __caN.evade++; return __caR.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__caN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.ribbon>0&&c.cut>0&&c.fc>0&&c.evade>0&&c.counter>0&&c.blade>0&&c.storm>0&&c.pulse>0,'the fights cast Tidal Ribbon ('+c.ribbon+', '+c.cut+' cuts), Fighting Current ('+c.fc+', '+c.evade+' evades, '+c.counter+' counters, '+c.blade+' blades) and the storm ('+c.storm+', '+c.pulse+' strikes): every new site was run'); }
  finally{ VMX('_doEffectCore=__caD; dealDamage=__caH; ringBurst=__caR;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ nb:['nb_2_2','nb_11_3','nb_6_1','nb_2_1','nb_8_2','nb_4_4','nb_12_3','nb_3_3','nb_3_2','nb_8_1','nb_1_4','nb_11_2','nb_9_1','nb_10_2'],
            sl:['sl_4_1','sl_1_1','sl_6_1','sl_2_4','sl_11_1'],
            pp:['pp_8_2','pp_1_3','pp_3_3','pp_6_4','pp_3_1','pp_12_4','pp_9_4','pp_11_3'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={nb:0,sl:1,pp:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her damage-reduction talents true at once - Fighting Current's stance (its first evade spent) with all its points (below 50% HP),
   Ready Stance's window too, Answers full, inside her own storm; the attacker at 5 Weariness, Soaked and Dazzled; 3 enemies at 5 Weariness. Normal and critical,
   physical and magic. Measured through the engine: what reaches her HP and shield against the hit */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:9,cold:true}), {v,F}=L; V.step(1); const f=F[0];
  V.cast(v,'blue'); V.hit(F[8],v,1,{kind:'true'}); v.maxHp=1e5; v.hp=3.5e4; V.step(1);
  if(L.T){ const M=x=>(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={}); for(const x of [F[0],F[1],F[2]]) M(x)['#wear']={v:5,until:1e9}; M(f).soak={t0:0,until:1e9,v:0}; M(f).dazz={t0:0,until:1e9,v:0};
    L.T.s.w.ready={t:99,n:1,cdT:0,at:-1,wave:false}; setStack(L,'ans',L.T.st.ans.max); }
  v._stormT=99; v._stormX=v.x; v._stormY=v.y; v._stormR=6*V.METER; V.step(1); v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; v._stormT=0; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Calypsa: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[[['nb','pp'],[61,30]],[['nb','sl'],[61,30]],[['nb'],[91]],[['pp','nb'],[61,30]],[['sl','nb'],[61,30]],[['pp'],[91]],[['nb','pp','sl'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="calypsa"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="calypsa"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','calypsa'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.equal(d.imm,0,'and she is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
