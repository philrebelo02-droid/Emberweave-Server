'use strict';
/* Orryn's talents as data on the mechanics layer (talents-mech/orryn.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling and the stun-lock rule.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit or one tick (plainHit / plainTick) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Orryn, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). Bodies: Orryn 1.56 m, a Vael 2.01 m.
   His water is a ground hazard (Spiral Current's whirlpool, Ocean Without Shore's flood): it strikes an enemy whose CENTRE is inside its radius every 0.5 s.
   Tests cast the real skill (its kit and cast hooks run, its hazard is made by the page) and then park the hazard where the test needs it (park()).
   None of his base skills is in the reach audit's list (Pressure Sphere reached its target in 158 of 161 casts, Spiral Current an enemy in 88 of 109,
   the flood in 82 of 83), so no placement waits for release v1391.
   Run: node --test tests/talents-mech-orryn.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='orryn', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const ust=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&m.until>V.now()+1e-9)?m.v:0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); if(!n){ delete o['#'+name]; return; } o['#'+name]={v:n,until:V.now()+(d||99)}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; u._ax=u.x; u._ay=u.y; };
const gapM=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/V.METER-V.bodyR(a)-V.bodyR(b);
const rel=(a,b,msg,eps)=>assert.ok(Math.abs(a-b)<=(eps||1e-6)*Math.max(1e-12,Math.abs(b)),(msg||'')+': '+a+' vs '+b);
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage)
const inRatio=(L,o)=>hitOn(L,L.v,1000,o)/plainHit(L,()=>hitOn(L,L.v,1000,o));
const kill=t=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const HZ=()=>VMX('groundHazards');
const mineHz=L=>HZ().filter(h=>h._talZ===L.v);
/* his Green / Blue / ultimate as the lab casts them (kit, the case, cast; no press): the hazard it made, parked at (x, y) metres from him, still, life left */
function cast(L,slot,tgt){ V.cast(L.v,slot,tgt||L.F[0]); }
function park(h,L,x,y,life){ h.vx=0; h.vy=0; h.travelLeft=0; h.x=L.v.x+x*V.METER; h.y=L.v.y+y*V.METER; h.life=life==null?99:life; h.acc=0; return h; }
function castHz(L,slot,x,y,tgt){ HZ().length=0; cast(L,slot,tgt); const h=HZ().find(z=>z.src===L.v&&!z.arrival); assert.ok(h,'his skill made its hazard'); return park(h,L,x,y); }
/* one tick of hazard h on enemy t (the step in which it ticks), and the same tick with his rows off */
const tickNow=h=>{ h.acc=h.interval-1e-9; V.step(1); };
const tickOn=(h,t)=>lost(t,()=>tickNow(h));
const plainTick=(h,t)=>{ const z=h._talZ; h._talZ=null; try{ return tickOn(h,t); } finally{ h._talZ=z; } };
/* a real press of a Green / Blue (castKit, then the cd hook as the page calls it) and its release (the pending cast fires) */
function press(L,slot){ const v=L.v, ab=slot==='blue'?v.blueAb:v.greenAb, lv=(v.skillLv&&v.skillLv[slot==='blue'?2:1])||1; v._castSM=VMX('skillMul')(lv); v._castLv=lv;
  VMX('castKit')(v,ab); v._castSM=1; v._castLv=0; v.greenCd=99; v.blueCd=99; if(v._tal&&v._tal.on.cd) FX.cd(v,slot,ab.cd); const p=v._pend; v._pend=null; return p; }
function release(L,p){ const v=L.v; const k=[v._castSM,v._castLv,v._aimWX,v._aimWY]; v._castSM=p.sm; v._castLv=p.lv; v._aimWX=p.ax; v._aimWY=p.ay; try{ p.fire(); } finally{ v._castSM=k[0]; v._castLv=k[1]; v._aimWX=k[2]; v._aimWY=k[3]; v._castSlot=null; } }
const passPass=L=>{ const v=L.v; if(v.pass.abyssres&&(v._prS||0)>=3&&!v._prReady){ v._prReady=1; v._prS=0; } };   // the passive pass's own lines (the lab holds him, so we run them)
/* a Pressure Sphere's hit on t while the Sphere resolves (casting 'strike'), against the same hit with his talents off */
function sphRatio(L,t){ const s=L.T.s, c0=s.cur, h0=L.T.on.hit; s.cur='strike'; L.T.on.hit=null; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,{kind:'magic'})); } finally{ s.cur=c0; L.T.on.hit=h0; } return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,{kind:'magic'}))); }   // its hit's riders (Crushed, Sea Weight, bursts) are not run for the measure
const hitRatio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'magic'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'magic'},o||{}))));
const mrShare=(L,t,x)=>{ const a=VMX('defMul')(L.v,t,'magic'); const sv=t.mrRating; t.mrRating=sv*(1-x); const b=VMX('defMul')(L.v,t,'magic'); t.mrRating=sv; return b/a; };
const lv1=(...xs)=>{ for(const x of xs) x.level=1; };
const healRatio=(L,t,a)=>{ const g=()=>{ t.hp=t.maxHp*0.5; const h=t.hp; V.heal(t,a); return t.hp-h; }; return g()/plainHit(L,g); };
const free=(...xs)=>{ for(const x of xs){ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=1e9; x.blueCd=1e9; } };

test('Orryn: every talent is accounted for - 9 plain stats, 109 with rows, none waiting',()=>{
  accounting(H,[118,9,109,0,0]);
  for(const id of ['fc_1_2','fc_7_4','fc_11_2','sp_1_3','sp_12_4','sp_7_4','os_1_4','os_8_1','os_11_1']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.equal(T.talent(H,'sp_5_3').name,'Sweeping Current');
});

test('Orryn: his real kit, as the talents read it - Pressure Sphere, Spiral Current, Abyssal Reserve, Ocean Without Shore',()=>{
  plain({foes:3},P=>{ const {v,F}=P; const d=lost(F[0],()=>V.cast(v,'green',F[0])); rel(d,v.apow*1.75*VMX('skillMul')(10)*VMX('rageMul')*VMX('defMul')(v,F[0],'magic')*VMX('elemMul')(v,F[0]),'Pressure Sphere: 175% of his ability power x the skill level on its target, magic',1e-6);
    assert.equal(v.greenAb.deliver,'form'); near(v.greenAb.form,0.4,'delivered 0.4 s after the release');
    HZ().length=0; V.cast(v,'blue',F[1]); const h=HZ().find(z=>z.src===v); assert.ok(h&&(h.vx||h.vy),'Spiral Current: a hazard that travels'); near(Math.hypot(h.vx,h.vy)/V.METER,6,'6 m/s');
    near(h.r/V.METER,3.4,'3.4 m (centre to centre)'); near(h.nrgSlow,0.4,'energy slow 40%'); near(h.interval,0.5,'a tick every 0.5 s'); rel(h.dmg,v.apow*0.5*VMX('skillMul')(10),'50% of his ability power a tick');
    park(h,P,4.5,0); F[0].energy=0; const e=lost(F[0],()=>tickNow(h)); rel(e,h.dmg*VMX('defMul')(v,F[0],'magic'),'its tick, through magic resist'); near(F[0]._nrgSlowPct,0.4,'and the energy slow written on'); assert.ok(F[0].slow>0&&F[0].slowMul==null,'a slow (the timer only: the game\'s base strength)');
    HZ().length=0; V.cast(v,'ult',F[0]); const u=HZ().find(z=>z.src===v); assert.ok(u&&!u.vx&&!u.vy,'Ocean Without Shore: a still hazard'); near(u.r/V.METER,6,'6 m'); near(u.life,5,'5 s'); assert.ok(!u.slow&&!u.nrgSlow,'no slow, no root');
    rel(u.dmg,v.apow*0.8*VMX('skillMul')(10),'80% of his ability power a tick (ULT_DEF mul 1.4 is read by nothing)'); });
  plain({foes:3},P=>{ const {v}=P; let emp=[]; for(let i=0;i<7;i++){ const p=press(P,i%2?'blue':'green'); emp.push(p.sm>VMX('skillMul')(10)*1.0001?1:0); passPass(P); }
    assert.deepEqual(emp,[0,0,0,1,0,0,1],'Abyssal Reserve: the press after every third empowers its spell (+45% + 0.2 point a level)'); });
});

/* ============================== THE FORTIETH CHAMBER ============================== */
test('Orryn / Crushed: Pressure Sphere leaves it (3 stacks, 5 s + Lasting Crush), damage from Orryn per stack; Deep Crush, Pale Eyes, Pearl Skin',()=>{
  const L=lab(H,S(['fc_1_1','fc_3_1','fc_5_1','fc_10_1','fc_12_4']),{foes:3,big:true}), {v,F}=L; const mv=F[1].speed;
  V.cast(v,'green',F[1]); assert.equal(ust(L,F[1],'oCr'),1,'the Sphere leaves 1 Crushed'); V.cast(v,'green',F[1]); V.cast(v,'green',F[1]); V.cast(v,'green',F[1]); assert.equal(ust(L,F[1],'oCr'),3,'stacks up to 3');
  V.step(2); near(F[1].speed,mv*(1-0.10*3),'Deep Crush: 2% x 5 slower per stack');
  rel(hitRatio(L,F[1]),1+0.06*3,'Crushed: 2% x 3 more damage from Orryn per stack'); rel(hitRatio(L,F[1],{auto:true}),(1+0.06*3)*1.10,'Pale Eyes: his basic attacks 2% x 5 more to a Crushed enemy');
  rel(inRatio(L,{src:F[1]}),0.91,'Pearl Skin: a Crushed enemy deals 3% x 3 less to him'); rel(inRatio(L,{src:F[2]}),1,'not one that is not Crushed');
  secs(6.5); assert.equal(ust(L,F[1],'oCr'),3,'Lasting Crush: 5 s + 0.4 s x 5'); secs(0.7); assert.equal(ust(L,F[1],'oCr'),0,'then it is gone (7 s)'); V.step(2); near(F[1].speed,mv,'and its slow');
});

test('Orryn / Crushing Depth (stun 1 s at 3, the stacks clear; the stun-lock rule) and Third Crush',()=>{
  const L=lab(H,S(['fc_8_1','fc_9_1','fc_6_1']),{foes:3}), {v,F}=L; free(F[1]);
  V.cast(v,'green',F[1]); rel(sphRatio(L,F[1]),1,'Third Crush: not at 1 stack'); V.cast(v,'green',F[1]); assert.equal(ust(L,F[1],'oCr'),2); rel(sphRatio(L,F[1]),1.15,'Third Crush: 3% x 5 more to an enemy at 2 or more (the hit that takes it to 3)');
  V.cast(v,'green',F[1]); near(F[1].stunned,1,'3 stacks: stunned 1 s',1e-6); assert.equal(ust(L,F[1],'oCr'),0,'its stacks clear');
  for(let i=0;i<3;i++) V.cast(v,'green',F[1]); assert.equal(ust(L,F[1],'oCr'),3,'a stunned enemy is not stunned again: the stacks stay'); const s0=L.T.s.oStL.length;
  while(F[1].stunned>0) V.step(1); V.step(Math.round(0.3/V.STEP)); V.cast(v,'green',F[1]); assert.equal(L.T.s.oStL.length,s0,'nor within 0.5 s after his stun ended');
  V.step(Math.round(0.3/V.STEP)); V.cast(v,'green',F[1]); assert.equal(L.T.s.oStL.length,s0+1,'after it: stunned again'); assert.equal(ust(L,F[1],'oCr'),0);
  while(F[1].stunned>0) V.step(1); secs(0.7); V.cast(v,'green',F[1]); V.cast(v,'green',F[1]); F[1].stunned=2; delete F[1]._talM[v.uid].oLk; V.cast(v,'green',F[1]);
  assert.equal(L.T.s.oStL.length,s0+1,'nor one stunned by something else (no lock of his on it)'); assert.equal(ust(L,F[1],'oCr'),3);
});

test('Orryn / Pressure Sphere: Tight Sphere, Heavy Hand, Second Current, Deep Sphere, Imploding Sphere',()=>{
  const L=lab(H,S(['fc_4_2','fc_6_3','sp_6_2','os_6_4','fc_7_3']),{foes:4}), {v,F}=L;
  F[1].hp=F[1].maxHp*0.6; rel(sphRatio(L,F[1]),1.15,'Tight Sphere: 5% x 3 more (not Heavy Hand at 60% HP)'); F[1].hp=F[1].maxHp; rel(sphRatio(L,F[1]),1.15*1.24,'Heavy Hand: 8% x 3 more above 70% HP'); rel(hitRatio(L,F[1]),1,'not his other hits');
  at(L,F[3],10,4.4); at(L,F[2],17.5,0); const d3=F[3].hp, d2=F[2].hp, d1=F[1].hp; V.cast(v,'green',F[1]); const hitT=d1-F[1].hp;
  assert.ok(F[1].slow>0&&Math.abs(F[1].slowMul-(1-0.18))<1e-9,'Second Current: its target 6% x 3 slower'); near(F[1].slow,2,'for 2 s',0.05); assert.equal(ust(L,F[1],'oSw'),3,'Deep Sphere: 1 Sea Weight per rank');
  rel(d3-F[3].hp,hitT*0.4*VMX('defMul')(v,F[3],'magic')/VMX('defMul')(v,F[1],'magic'),'Imploding Sphere: an enemy within 2.5 m of its target takes 40% of its damage',1e-6); assert.equal(F[2].hp,d2,'not one 3.5 m away');
});

test('Orryn / Sphere in the Current and Drowning Sphere',()=>{
  const L=lab(H,S(['sp_6_2','sp_7_2','os_6_4','os_7_4','os_1_1']),{foes:4}), {v,F}=L; const h=castHz(L,'blue',10,0,F[1]); V.step(1); at(L,F[1],10,-2.6); at(L,F[3],10,2.6); at(L,F[2],20,0);   /* set right before the cast: bodies push apart on a step */
  const d3=F[3].hp, d2=F[2].hp, d1=F[1].hp; V.cast(v,'green',F[1]); const hitT=d1-F[1].hp; rel(d3-F[3].hp,hitT*0.4*VMX('defMul')(v,F[3],'magic')/VMX('defMul')(v,F[1],'magic'),'it rides the current: every other enemy under it takes 40%',1e-6);
  assert.equal(F[2].hp,d2,'not an enemy out of the current'); h.life=0; V.step(2);
  assert.ok(L.T.s.zn.oDs&&L.T.s.zn.oDs.length,'Drowning Sphere: its pressure stays as his water'); const zs=L.T.s.zn.oDs.slice(); at(L,F[1],10,0); V.step(Math.round(1.05/V.STEP)); assert.ok(ust(L,F[1],'oSw')>=4,'Sea Weight builds in it (3 from Deep Sphere + 1 a second)');
  secs(2.2); at(L,F[1],10,0); const n=ust(L,F[1],'oSw'); secs(1.2); assert.ok(ust(L,F[1],'oSw')===0||ust(L,F[1],'oSw')<=n,'after 3 s it is no water: '+ust(L,F[1],'oSw'));
  L.T.s.zn.oDs.push(...zs.map(z=>Object.assign({},z,{until:V.now()+99}))); HZ().length=0; V.wave(); V.step(1); assert.equal(L.T.s.zn.oDs.length,0,'a new wave: his circles are cleared (their clock was the old wave\'s)');
});

test('Orryn / Chambers: one per spell, ability power per Chamber; Old Rooms, First Door, Gathered Weight, Nacre; kept for the fight',()=>{
  let ap0; plain({foes:3},P=>{ ap0=P.v.apow; }); const L=lab(H,S(['fc_1_4','fc_2_4','fc_n2','fc_11_3','fc_6_4']),{foes:3}), {v,F}=L; const hp0=v.maxHp;
  assert.equal(stack(L,'oCh'),6,'Old Rooms: the fight starts with 2 x 3 sealed'); near(v.apow,ap0*(1+0.0025*6),'0.05% x 5 ability power per Chamber',1e-9);
  V.cast(v,'green',F[0]); assert.equal(stack(L,'oCh'),6+1+3,'a Pressure Sphere seals 1, the first one each wave 3 more (First Door)'); V.cast(v,'green',F[0]); assert.equal(stack(L,'oCh'),11,'the next one 1');
  V.cast(v,'blue',F[0]); assert.equal(stack(L,'oCh'),12,'Spiral Current seals 1'); V.cast(v,'ult',F[0]); assert.equal(stack(L,'oCh'),18,'Ocean Without Shore seals 2 x 3 (Gathered Weight)');
  V.step(2); near(v.maxHp,hp0*1.03,'Nacre: every 10 Chambers 1% x 3 more max HP',1e-9);
  V.wave(); V.step(2); assert.equal(stack(L,'oCh'),18,'kept for the fight'); V.cast(v,'green',F[0]); assert.equal(stack(L,'oCh'),22,'a new wave: First Door again');
  setStack(L,'oCh',40); V.cast(v,'green',F[0]); assert.equal(stack(L,'oCh'),40,'at most 40');
});

test('Orryn / every 10 Chambers: Sealed Rooms, Snowfall Weight, Shell Wall; at 40 Fortieth Door; Rooms Full of Sea',()=>{
  const L=lab(H,S(['fc_1_4','fc_4_4','fc_11_4','fc_5_4','fc_10_4','fc_12_3']),{foes:3,big:true}), {v,F}=L; setStack(L,'oCh',39); V.step(1);
  rel(sphRatio(L,F[1]),1.075*mrShare(L,F[1],0.15),'3 x 10 Chambers: his spells 0.5% x 5 more each (Snowfall Weight) and ignore 1% x 5 of magic resist each (Sealed Rooms)',1e-6);
  rel(hitRatio(L,F[1]),1,'not his basic hits'); rel(inRatio(L),1-0.09,'Shell Wall: 0.6% x 5 damage reduction per 10 Chambers',1e-9);
  const h=castHz(L,'ult',10,0,F[1]); rel(tickOn(h,F[1])/plainTick(h,F[1]),1+0.005*39,'Rooms Full of Sea: the flood\'s impacts 0.1% x 5 more per Chamber',1e-6);
  v.energy=10; V.step(1); const e0=v.energy; V.hit(F[1],v,1,{kind:'true'}); V.step(1); near(v.energy-e0,7,'below 40: the energy as it comes',1e-6);
  setStack(L,'oCh',40); V.step(1); const e1=v.energy; V.hit(F[1],v,1,{kind:'true'}); V.step(1); near(v.energy-e1,7*4/3,'Fortieth Door: at 40 Chambers a third more (25% less needed)',1e-6);
});

test('Orryn / Abyssal Reserve: Stored Pressure, Diver\'s Breath, Breath Held Long, Keeper\'s Ledger, Deep Energy, Deeper Rooms',()=>{
  const L=lab(H,S(['fc_1_4','fc_2_3','fc_4_3','fc_9_3','fc_8_4','fc_10_2','fc_2_4','fc_3_4','fc_1_1']),{foes:3}), {v,F}=L;
  const Fp=p=>p.sm/VMX('skillMul')(p.lv)-1; let p, ch;
  for(let i=0;i<3;i++){ p=press(L,'green'); release(L,p); secs(0.45); passPass(L); } assert.ok(v._prReady,'three presses: the next one is empowered');
  p=press(L,'green'); const f=Fp(p); assert.ok(f>0.44,'it is empowered by '+f.toFixed(3)); const e=L.T.s.oPr.green; assert.ok(e&&e.dv===3,'three plain spells before it');
  setUst(L,F[0],'oCr',1); v.target=F[0]; v.energy=0; ch=stack(L,'oCh');
  const s0=L.T.s;
  /* the empowered Sphere's hit, measured inside its own resolution: kit (detects it), the hit, against the same resolution with the pressure not kept */
  v._castSlot='green'; v._castSM=p.sm; v._castLv=p.lv; FX.kit(v,'strike',Object.assign({},v.greenAb));
  assert.ok(s0.oCurE,'the release is the empowered one'); assert.equal(stack(L,'oCh'),ch+1+3,'Keeper\'s Ledger: an Abyssal Reserve spell seals 1 x 3 more'); near(v.energy,5,'Deep Energy: 1 x 5 energy');
  const r=sphRatio(L,F[0]); const exp=(1+f+0.15)/(1+f)*(1+0.06*3)*1.10*1.06; rel(r,exp,'Stored Pressure 3 points x 5, Diver\'s Breath 2% x 3 per plain spell (3), Breath Held Long 2% x 5 on a Crushed enemy (and Crushed itself)',1e-6);
  FX.cast(v,'strike',{}); v._castSlot=null; v._castSM=1; v._castLv=0; assert.ok(!s0.oCurE,'the next resolution is not');
  /* Deeper Rooms: at 20 Chambers every second cast */
  v._prReady=0; v._prS=0; setStack(L,'oCh',19); press(L,'green'); press(L,'green'); assert.ok(!v._prReady,'below 20 Chambers: not after two presses');
  v._prReady=0; v._prS=0; setStack(L,'oCh',20); press(L,'green'); assert.ok(!v._prReady); press(L,'green'); assert.ok(v._prReady,'at 20: ready after two presses'); p=press(L,'blue'); assert.ok(Fp(p)>0.44,'the next one empowered');
  v._prReady=0; v._prS=0; L.T.s.oDv=3; press(L,'green'); assert.equal(L.T.s.oDv,3,'Diver\'s Breath counts at most 3 plain spells');
});

test('Orryn / Saved Breath (PICK ONE): the pressure waits for Pressure Sphere and adds 20%',()=>{
  const L=lab(H,S(['fc_4_3','fc_5_3']),{foes:3}), {v,F}=L; const Fp=p=>p.sm/VMX('skillMul')(p.lv)-1;
  v._prReady=1; v._prS=0; let p=press(L,'blue'); near(Fp(p),0,'a Spiral Current pressed with the pressure full is not empowered',1e-9); assert.ok(v._prReady,'the pressure waits');
  p=press(L,'green'); assert.ok(Fp(p)>0.44,'the next Pressure Sphere takes it'); const e=L.T.s.oPr.green; assert.equal(e.sv,1);
  v._castSlot='green'; v._castSM=p.sm; v._castLv=p.lv; FX.kit(v,'strike',Object.assign({},v.greenAb)); rel(sphRatio(L,F[0]),1.20*(1+0.06*1),'20% more (and Diver\'s Breath for the Spiral Current before it)',1e-6); FX.cast(v,'strike',{}); v._castSlot=null; v._castSM=1;
  const L2=lab(H,S(['fc_4_3']),{foes:3}); L2.v._prReady=1; const p2=press(L2,'blue'); assert.ok(Fp(p2)>0.44,'without it a Spiral Current takes it');
});

test('Orryn / Spent Breath (PICK ONE): the empowered spell stuns 0.5 s - the Sphere\'s target, each enemy the whirlpool first strikes',()=>{
  const L=lab(H,S(['fc_5_2']),{foes:3}), {v,F}=L; free(F[0],F[1]);
  v._prReady=1; let p=press(L,'green'); v.target=F[0]; release(L,p); secs(0.5); const LG=()=>L.T.s.oStL||[]; assert.equal(LG().length,1,'the empowered Sphere stuns its target'); assert.equal(LG()[0][0],F[0].uid); near(LG()[0][2],0.5,'0.5 s',1e-9);
  F[0].stunned=0; secs(0.6); p=press(L,'green'); release(L,p); secs(0.5); assert.equal(LG().length,1,'a plain one does not');
  v._prReady=1; p=press(L,'blue'); release(L,p); const h=mineHz(L)[0]; park(h,L,10,0); F[1].stunned=0; tickNow(h); near(F[1].stunned,0.5,'the empowered whirlpool: each enemy the first time it strikes it',0.05);
  F[1].stunned=0; L.T.s.oSk={}; const m=F[1]._talM[v.uid]; delete m.oLk; tickNow(h); assert.ok(!(F[1].stunned>0),'not again from the same cast');
});

test('Orryn / No Far Wall (SIGNATURE): every 10th Chamber - triple damage, the line behind, 3 Crushed each; the 20 s opening; at the cap',()=>{
  const L=lab(H,S(['fc_1_4','fc_13_3','fc_1_1']),{foes:4}), {v,F}=L; at(L,F[2],15.5,0.5); at(L,F[3],7,8);
  setStack(L,'oCh',8); L.T.s.oSeal=8; V.cast(v,'green',F[0]); assert.ok(!L.T.s.oNfwArm,'9 sealed: not yet'); V.cast(v,'green',F[0]); assert.ok(L.T.s.oNfwArm,'the 10th opens it');
  const d1=F[1].hp, d2=F[2].hp, d3=F[3].hp, d0=F[0].hp; V.cast(v,'green',F[0]); const t0=d0-F[0].hp;
  const t1=d1-F[1].hp, t2=d2-F[2].hp; rel(t1,t0/3*VMX('defMul')(v,F[1],'magic')/VMX('defMul')(v,F[0],'magic'),'every enemy on the line behind it takes its full damage (a third of the tripled hit)',1e-6); rel(t2,t1*VMX('defMul')(v,F[2],'magic')/VMX('defMul')(v,F[1],'magic'),'',1e-6);
  assert.equal(F[3].hp,d3,'not one off the line'); assert.equal(ust(L,F[1],'oCr'),3,'each one gains 3 Crushed'); assert.equal(ust(L,F[2],'oCr'),3);
  let plainD; plain({foes:4},P=>{ plainD=lost(P.F[0],()=>V.cast(P.v,'green',P.F[0])); }); const L2=lab(H,S(['fc_1_4','fc_13_3']),{foes:4});
  setStack(L2,'oCh',9); L2.T.s.oSeal=9; V.cast(L2.v,'green',L2.F[0]); rel(lost(L2.F[0],()=>V.cast(L2.v,'green',L2.F[0])),plainD*3,'triple damage (against a plain Sphere: no tick in between, so Chambers\' ability power has not moved)',1e-6);
  const L3=lab(H,S(['fc_13_3']),{foes:3}); assert.ok(!L3.T.s.oNfwArm); secs(19.8); assert.ok(!L3.T.s.oNfwArm,'not before 20 s'); secs(0.4); assert.ok(L3.T.s.oNfwArm,'20 s of the fight before his 10th Chamber: the first one opens');
  const L4=lab(H,S(['fc_1_4','fc_13_3']),{foes:3}); setStack(L4,'oCh',40); L4.T.s.oSeal=49; L4.T.s.oNfwAny=1; V.cast(L4.v,'green',L4.F[0]); assert.ok(L4.T.s.oNfwArm,'at 40 Chambers the count keeps turning');
});

/* ============================== THE SPIRAL ============================== */
test('Orryn / Whorls: 1 a tick under Spiral Current (max 6, 4 s + Tighter Spiral), each slows attacks; Dizzied, Turned Inside, Calm Eye',()=>{
  const L=lab(H,S(['sp_1_4','sp_2_4','sp_6_4','sp_11_4','sp_12_2']),{foes:3,big:true}), {v,F}=L; const h=castHz(L,'blue',10,0,F[1]); const ai=F[1].atkInterval, mv=F[1].speed;
  tickNow(h); assert.equal(ust(L,F[1],'oWh'),1,'1 Whorl a tick'); assert.equal(ust(L,F[0],'oWh'),0,'not an enemy outside it'); V.step(1); near(ai/F[1].atkInterval,1-0.03,'0.6% x 5 slower attacks per Whorl',1e-9);
  tickNow(h); assert.equal(ust(L,F[1],'oWh'),2); V.step(1); rel(inRatio(L,{src:F[1]}),1,'Calm Eye: not below 3'); near(F[1].speed,mv,'Dizzied: not below 3'); tickNow(h); assert.equal(ust(L,F[1],'oWh'),3); V.step(1); near(F[1].speed,mv*0.9,'Dizzied: 3 or more, 2% x 5 slower');
  rel(inRatio(L,{src:F[1]}),0.91,'Calm Eye: 3% x 3 less from it'); rel(hitRatio(L,F[1]),1+0.02*3,'Turned Inside: 0.4% x 5 more from Orryn per Whorl');
  for(let i=0;i<5;i++) tickNow(h); assert.equal(ust(L,F[1],'oWh'),6,'at most 6'); h.life=0; V.step(2); secs(6.5); assert.equal(ust(L,F[1],'oWh'),6,'Tighter Spiral: 4 s + 1 s x 3'); secs(0.6); assert.equal(ust(L,F[1],'oWh'),0,'then gone');
});

test('Orryn / Spun Round (stun 1 s at 6, cleared), Eye of the Spiral, Abyss Mind, Quick Whorls; Too Deep to Turn',()=>{
  const L=lab(H,S(['sp_1_4','sp_3_4','sp_9_4','sp_11_2','sp_8_4','sp_n1']),{foes:4}), {v,F}=L; free(F[1]); at(L,F[3],10,4.6); const h=castHz(L,'blue',10,0,F[1]); const ap=v.apow;
  setUst(L,F[1],'oWh',5); VMX('var __brnd=brnd; brnd=function(){ return 0.99; }'); try{ tickNow(h); } finally{ VMX('brnd=__brnd'); }
  near(F[1].stunned,1,'6 Whorls: spun round, stunned 1 s',1e-6); assert.equal(ust(L,F[1],'oWh'),0,'its Whorls clear'); assert.ok(F[3].pulledBy&&F[3].pullT>0,'Eye of the Spiral: an enemy within 2 m of it is pulled toward it'); h.interval=1e9;
  V.step(1); near(v.apow,ap*1.05,'Abyss Mind: 1% x 5 ability power',1e-9); secs(6.1); near(v.apow,ap,'for 6 s',1e-9);
  F[1].stunned=0; setUst(L,F[1],'oWh',5); tickNow(h); near(F[1].stunned,1,'the same cast spins it a second time',1e-6); while(F[1].stunned>0) V.step(1); secs(0.6);
  setUst(L,F[1],'oWh',5); tickNow(h); assert.ok(!(F[1].stunned>0),'never a third time from one cast'); assert.equal(ust(L,F[1],'oWh'),6,'(its Whorls stay)');
  free(F[2]); F[2].stunImmune=true; setUst(L,F[2],'oWh',5); park(h,L,15.5,0); tickNow(h); assert.ok(mark(L,F[2],'oTd'),'Too Deep to Turn: an enemy that cannot be stunned'); assert.equal(ust(L,F[2],'oWh'),0,'its Whorls clear');
  F[2].energy=0; V.step(1); V.hit(v,F[2],1,{kind:'true'}); V.step(1); near(F[2].energy,7*(1-0.4)*(1-0.30),'gains 10% x 3 less energy (on top of the whirlpool\'s own slow)',1e-6);
  const L3=lab(H,S(['sp_1_4','sp_n1']),{foes:3}); free(L3.F[1]); const h3=castHz(L3,'blue',10,0,L3.F[1]); setUst(L3,L3.F[1],'oWh',5); tickNow(h3); assert.ok(!mark(L3,L3.F[1],'oTd'),'Too Deep to Turn: not an enemy that can be stunned'); assert.equal(ust(L3,L3.F[1],'oWh'),6);
  const L2=lab(H,S(['sp_1_4','sp_8_4']),{foes:3}); const h2=castHz(L2,'blue',10,0,L2.F[1]); VMX('var __brnd=brnd; brnd=function(){ return 0.59; }'); try{ tickNow(h2); } finally{ VMX('brnd=__brnd'); }
  assert.equal(ust(L2,L2.F[1],'oWh'),2,'Quick Whorls: a 20% x 3 chance of 1 more'); VMX('var __brnd=brnd; brnd=function(){ return 0.61; }'); try{ tickNow(h2); } finally{ VMX('brnd=__brnd'); } assert.equal(ust(L2,L2.F[1],'oWh'),3,'(a roll above 60%: no more)');
});

test('Orryn / Spiral Current: Strong Current, Wide Whorl, Current Bite, Under Pressure, Drained, Weakened Draw, Dry Well, cooldowns',()=>{
  const L=lab(H,S(['sp_2_2','sp_9_2','sp_5_2','os_7_2','sp_6_1','sp_4_1','sp_7_1','sp_5_1','fc_9_2','sp_10_2','os_9_4','fc_2_2']),{foes:3,big:true,allies:1}), {v,F,A}=L; const h=castHz(L,'blue',10,0,F[1]);
  near(h.nrgSlow,0.5,'Strong Current: 40% + 2 points x 5'); near(h.r/V.METER,3.4+0.5,'Wide Whorl: 0.1 m x 5 wider',1e-9);
  rel(tickOn(h,F[1])/plainTick(h,F[1]),1.20*1.15,'Current Bite 4% x 5, Under Pressure 3% x 5',1e-6); assert.ok(mark(L,F[1],'oDr'),'Drained');
  rel(hitRatio(L,F[1]),1.06,'Drained: 2% x 3 more from Orryn for 3 s'); rel(inRatio(L,{src:F[1]}),1-0.075,'Weakened Draw: an enemy under it deals 1.5% x 5 less (to him)',1e-9); rel(hitOn(L,A[0],1000,{src:F[1]})/1000,1-0.075,'(and to his allies)',1e-9);
  rel(healRatio(L,F[1],1000),0.85,'Dry Well: 3% x 5 less healing under it',1e-9);
  near(FX.cd(v,'green',6),(6-0.9)*0.95*0.95*0.95,'Pressure Sphere: Quick Sphere 0.3 s x 3, then 1% x 5 three times',1e-9); near(FX.cd(v,'blue',9),9*0.95*0.95*0.95-1.5,'Spiral Current: 1% x 5 three times, then Patient Current 0.5 s x 3 (talent-id order)',1e-9);
  h.life=0; V.step(2); rel(inRatio(L,{src:F[1]}),1,'Weakened Draw: not once out of it'); secs(3.1); rel(hitRatio(L,F[1]),1,'Drained: 3 s');
});

test('Orryn / Long Spiral, Standing Whirl (PICK ONE), Drag Along, Sweeping Current (PICK ONE), Slow Water',()=>{
  let base; plain({foes:3},P=>{ HZ().length=0; V.cast(P.v,'blue',P.F[1]); const h=HZ().find(z=>z.src===P.v); base={t:h.travelLeft,l:h.life,r:h.r,spd:Math.hypot(h.vx,h.vy)}; });
  const L=lab(H,S(['sp_2_2','sp_4_2']),{foes:3}); HZ().length=0; V.cast(L.v,'blue',L.F[1]); let h=mineHz(L)[0]; near(h.travelLeft-base.t,3*V.METER/base.spd,'Long Spiral: 1 m x 3 farther',1e-9); near(h.life-base.l,3*V.METER/base.spd,'',1e-9);
  const L2=lab(H,S(['sp_5_4']),{foes:3}); HZ().length=0; V.cast(L2.v,'blue',L2.F[1]); h=mineHz(L2)[0]; near(h.r,base.r*1.3,'Standing Whirl: 30% wider',1e-9); near(h.travelLeft,base.t-4*V.METER/base.spd,'it runs to its target',1e-9); near(h.life,h.travelLeft+4,'and spins there 4 s',1e-9);
  const tx=L2.v.x+V.METER+(h.vx/Math.hypot(h.vx,h.vy))*h.travelLeft*Math.hypot(h.vx,h.vy); near((tx-L2.v.x)/V.METER,10,'it stops on the target (10 m)',0.02);
  const L3=lab(H,S(['sp_3_3','sp_4_3']),{foes:3}), v3=L3.v; HZ().length=0; V.cast(v3,'blue',L3.F[1]); h=mineHz(L3)[0]; h.x=L3.F[1].x-2*V.METER; h.y=L3.F[1].y; h.acc=h.interval-1e-9; V.step(1);
  assert.ok(L3.F[1].pulledBy&&L3.F[1].pullT>0,'Drag Along: the enemy it first passes is dragged'); near((L3.F[1].pulledBy.x-L3.F[1].x)/V.METER,0.9*h.vx/Math.hypot(h.vx,h.vy),'0.3 m x 3 along its run',0.05);
  near(L3.F[1].slowMul,1-0.45*1.15,'Slow Water: the whirlpool\'s 45% slow 3% x 5 stronger',1e-9); L3.F[1].pullT=0; L3.F[1].pulledBy=null; h.acc=h.interval-1e-9; V.step(1); assert.ok(!(L3.F[1].pullT>0),'once per cast');
  const L4=lab(H,S(['sp_4_3','sp_5_3']),{foes:3}); HZ().length=0; V.cast(L4.v,'blue',L4.F[1]); h=mineHz(L4)[0]; h.x=L4.F[1].x-2*V.METER; h.y=L4.F[1].y; const left=h.travelLeft; h.acc=h.interval-1e-9; V.step(1);
  const f=L4.F[1]; void left; assert.ok(f.pulledBy&&f.pullT>0,'Sweeping Current: carried'); near(f.pullSpeed,Math.hypot(h.vx,h.vy),'at the current\'s own speed',1e-6); near(Math.hypot(f.pulledBy.x-f.x,f.pulledBy.y-f.y),Math.hypot(h.vx,h.vy)*h.travelLeft,'to the end of its run',1e-6);
});

test('Orryn / Drawn Strength: what his energy slow keeps from enemies, to the ally with the least energy; Spare Strength, Strength Kept, Shared Strength, Given Strength',()=>{
  const L=lab(H,S(['sp_1_1','sp_2_1','sp_8_1','sp_10_1']),{foes:3,allies:2}), {v,F,A}=L; const h=castHz(L,'blue',10,0,F[1]); tickNow(h); assert.ok(mark(L,F[1],'oNs'));
  A[0].energy=50; A[1].energy=10; v.energy=0; V.step(1); V.hit(v,F[1],1,{kind:'true'}); const g=7*0.6, kept=g*0.4/0.6; V.step(1);
  near(A[1].energy,10+kept*0.5*1.09,'Drawn Strength 10% x 5 (Strength Kept 3% x 3 stronger) to the ally with the least energy',1e-6); near(A[0].energy,50,'not the other');
  near(v.energy,kept*0.09*1.09,'Spare Strength: 3% x 3 to Orryn',1e-6); assert.ok(mark(L,A[1],'oSs'),'Shared Strength: the ally who received it');
  F[2]._nrgSlowT=4; F[2]._nrgSlowPct=0.4; F[2].energy=0; const a1=A[1].energy; V.step(1); V.hit(v,F[2],1,{kind:'true'}); V.step(1); near(A[1].energy,a1,'an energy slow that is not his Spiral Current\'s draws nothing',1e-9);
  const L0=lab(H,S(['sp_1_1','sp_10_1']),{foes:3,allies:1}); const h0=castHz(L0,'blue',10,0,L0.F[1]); tickNow(h0); L0.A[0].energy=0; V.step(1); const a0=L0.A[0].atkInterval; V.hit(L0.v,L0.F[1],1,{kind:'true'}); V.step(2);
  near(a0/L0.A[0].atkInterval,1.06,'Shared Strength: 2% x 3 attack speed',1e-9); secs(3.2); near(L0.A[0].atkInterval,a0,'for 3 s',1e-9);
  const L2=lab(H,S(['sp_1_1','sp_10_1','sp_11_1']),{foes:3,allies:2}); const h2=castHz(L2,'blue',10,0,L2.F[1]); tickNow(h2); L2.A[0].energy=50; L2.A[1].energy=0; at(L2,L2.A[0],0,-4); at(L2,L2.A[1],0,-30); V.step(1);
  V.hit(L2.v,L2.F[1],1,{kind:'true'}); V.step(1); near(L2.A[0].energy,50+kept*0.5,'Given Strength: every ally within 6 m of him, in full',1e-6); near(L2.A[1].energy,0,'not one farther (even with the least)',1e-9);
  h2.life=0; V.step(2); secs(4.2); L2.A[1].energy=0; V.hit(L2.v,L2.F[1],1,{kind:'true'}); V.step(1); near(L2.A[1].energy,0,'nothing once the whirlpool\'s energy slow is over',1e-9);
});

test('Orryn / Keeper\'s Calm: controls on him 4% x 5 shorter (up to 20%)',()=>{
  const L=lab(H,S(['sp_3_1']),{foes:3}), {v,F}=L; v.stunned=0; v.level=1; F[0].level=100; const d=FX.cc(F[0],v,'stunned',2); near(d,1.6,'20% shorter',1e-9);
});

/* ============================== OCEAN WITHOUT SHORE ============================== */
test('Orryn / Drowning: 1 Sea Weight a second in his water (max 5, lapsing 1 s after it leaves; Heavy Sea, Gathering Deep), less damage, Drowning ticks harder',()=>{
  const L=lab(H,S(['os_1_1','os_2_1','os_12_1']),{foes:3,big:true,allies:1}), {v,F,A}=L; at(L,F[0],4.5,30); const h=castHz(L,'ult',10,0,F[1]);
  V.step(1); const t0=V.now(); while(ust(L,F[1],'oSw')<1&&V.now()<t0+2) V.step(1); near(V.now()-t0,1/1.3,'Gathering Deep: 10% x 3 faster (one every 0.77 s)',0.06); assert.equal(ust(L,F[0],'oSw'),0,'not an enemy out of the water');
  rel(inRatio(L,{src:F[1]}),1-0.02,'each Sea Weight: 0.4% x 5 less damage'); rel(hitOn(L,A[0],1000,{src:F[1]})/1000,1-0.02,'also on his allies',1e-9);
  setUst(L,F[1],'oSw',4); L.T.s.oW[F[1].uid].acc=0; rel(tickOn(h,F[1])/plainTick(h,F[1]),1,'not Drowning at 4',1e-6);
  secs(4); assert.equal(ust(L,F[1],'oSw'),5,'at most 5: Drowning'); rel(tickOn(h,F[1])/plainTick(h,F[1]),1.10,'every tick of his water lands 2% x 5 harder on it',1e-6);
  at(L,F[1],30,0); h.x=L.v.x+10*V.METER; secs(3.8); assert.equal(ust(L,F[1],'oSw'),5,'Heavy Sea: it stays 1 s + 1 s x 3 after leaving'); secs(0.4); assert.equal(ust(L,F[1],'oSw'),0,'then it is gone');
});

test('Orryn / Drowning enemies: Silt, Undersea Quiet, Pale Calm, Last Air, Pressed Lungs, Saltwater Blood, The Weight Comes Up',()=>{
  const L=lab(H,S(['os_1_1','os_3_1','os_9_1','os_10_1','os_6_1','os_4_1','os_10_4','os_11_2']),{foes:3,big:true,allies:1}), {v,F,A}=L; const mv=F[1].speed, ai=F[1].atkInterval;
  const h=castHz(L,'ult',10,0,F[1]); setUst(L,F[1],'oSw',5); V.step(2); near(F[1].speed,mv*0.85,'Silt: 3% x 5 slower'); near(ai/F[1].atkInterval,0.90,'Undersea Quiet: 2% x 5 slower attacks',1e-9);
  rel(inRatio(L,{src:F[1]}),0.91*(1-0.10),'Pale Calm 3% x 3 and the 5 Sea Weight (0.4% x 5 each)',1e-9);
  rel(healRatio(L,F[1],1000),0.85,'Last Air: 3% x 5 less healing',1e-9);
  rel(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'}))/plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'}))),1.10,'Pressed Lungs: 2% x 5 more from his team\'s hits',1e-9); rel(tickOn(h,F[1])/plainTick(h,F[1]),1.10*1.10,'and his water (with Drowning\'s own)',1e-6);
  v.hp=v.maxHp*0.5; const vh=v.hp; F[1].hp=1; F[1].shield=0; V.hit(A[0],F[1],100,{kind:'true'}); assert.ok(!F[1].alive); near(v.hp-vh,v.maxHp*0.03,'Saltwater Blood: 1% x 3 when it dies Drowning',1e-6);
  const L2=lab(H,S(['os_11_2']),{foes:3}); const h2=castHz(L2,'ult',10,0,L2.F[1]); VMX('var __brnd=brnd; brnd=function(){ return 0.99; }'); try{ tickNow(h2); } finally{ VMX('brnd=__brnd'); } assert.equal(ust(L2,L2.F[1],'oSw'),1,'The Weight Comes Up: a 20% x 5 chance each tick of 1 more');
});

test('Orryn / Where the Currents Meet (LINK): 5% more from Spiral Current at 3 Sea Weight; with Whorls, the first Drowning each wave gives 1 Whorl',()=>{
  const L=lab(H,S(['os_n1','os_1_1']),{foes:3}), {v,F}=L; const h=castHz(L,'blue',10,0,F[1]); setUst(L,F[1],'oSw',2); rel(tickOn(h,F[1])/plainTick(h,F[1]),1,'not at 2');
  setUst(L,F[1],'oSw',3); rel(tickOn(h,F[1])/plainTick(h,F[1]),1.05,'5% at 3'); const L2=lab(H,S(['os_n1','os_1_1','sp_1_4']),{foes:3}); const h2=castHz(L2,'ult',10,0,L2.F[1]);
  setUst(L2,L2.F[1],'oSw',5); V.step(1); assert.equal(ust(L2,L2.F[1],'oWh'),1,'with Whorls: 1 Whorl as it becomes Drowning'); setUst(L2,L2.F[1],'oSw',5); V.step(2); assert.equal(ust(L2,L2.F[1],'oWh'),1,'never again in the wave');
  const L3=lab(H,S(['os_n1','os_1_1']),{foes:3}); castHz(L3,'ult',10,0,L3.F[1]); setUst(L3,L3.F[1],'oSw',5); V.step(1); assert.equal(ust(L3,L3.F[1],'oWh'),0,'without Whorls none');
});

test('Orryn / Flood: one level every 8 s of a wave (High Water Mark sooner), Flood Gate, Flood Wall, Sea Level, Tide Rising, Rising Fast; reset each wave',()=>{
  const L=lab(H,S(['os_1_3','os_2_3','os_6_3','os_5_3','os_10_3','os_12_2','os_8_3']),{foes:3,big:true}), {v,F}=L; assert.equal(stack(L,'oFl'),3,'Flood Gate: each wave starts at 1 x 3');
  secs(4.9); assert.equal(stack(L,'oFl'),3); secs(0.2); assert.equal(stack(L,'oFl'),4,'High Water Mark: 8 s - 1 s x 3 = 5 s');
  rel(inRatio(L),1-0.12,'Flood Wall: 0.6% x 5 per level',1e-9); rel(sphRatio(L,F[1]),mrShare(L,F[1],0.10),'Sea Level: at Flood 3 or more his spells ignore 2% x 5 of magic resist',1e-6);
  const h=castHz(L,'blue',10,0,F[1]); rel(tickOn(h,F[1])/plainTick(h,F[1]),(1+0.03*4)*mrShare(L,F[1],0.10),'Flood: 0.6% x 5 more per level on Spiral Current',1e-6);
  setStack(L,'oFl',1); V.cast(v,'ult',F[1]); assert.equal(stack(L,'oFl'),4,'Tide Rising: the flood raises it 1 x 3 when it lands'); V.cast(v,'ult',F[1]); assert.equal(stack(L,'oFl'),5,'(at most 5)'); V.wave(); V.step(1); assert.equal(stack(L,'oFl'),3,'a new wave: back to Flood Gate\'s level');
  const L2=lab(H,S(['os_1_3','os_8_3']),{foes:3}); assert.equal(stack(L2,'oFl'),0); castHz(L2,'ult',10,0,L2.F[1]); VMX('var __brnd=brnd; brnd=function(){ return 0.59; }'); try{ kill(L2.F[1]); V.step(1); } finally{ VMX('brnd=__brnd'); } assert.equal(stack(L2,'oFl'),1,'Rising Fast: an enemy that dies in his water, a 20% x 3 chance to raise it');
  const f2=L2.F[2]; at(L2,f2,40,0); f2.hp=1; f2.shield=0; VMX('var __brnd=brnd; brnd=function(){ return 0.59; }'); try{ V.dmg(f2,100); V.step(1); } finally{ VMX('brnd=__brnd'); } assert.equal(stack(L2,'oFl'),1,'not one that dies out of it');
  setStack(L2,'oFl',4); V.wave(); V.step(1); assert.equal(stack(L2,'oFl'),0,'without Flood Gate a wave starts at 0');
});

test('Orryn / Rising Sea, Above the Line, Far Water, Wide Flood, Endless Tide; the flood\'s damage: Shoreless, Tidal Weight, Tidal Hammer, Long Flood',()=>{
  const L=lab(H,S(['os_1_3','os_3_3','os_11_3','fc_8_2','os_7_3','os_3_2','fc_7_2','sp_9_3','os_4_2','os_8_2']),{foes:4}), {v,F}=L;
  let h=castHz(L,'ult',10,0,F[1]); near(h.r/V.METER,6+1+1,'Far Water 0.2 m x 5 and Wide Flood 0.2 m x 5',1e-9); near(h.life,99); setStack(L,'oFl',5); HZ().length=0; V.cast(v,'ult',F[1]); h=mineHz(L)[0]; near(h.r/V.METER,10,'Rising Sea: at Flood 5, 2 m more',1e-9); near(h.life,5.5,'Endless Tide: 0.1 s x 5 longer',1e-9);
  park(h,L,10,0); setStack(L,'oFl',0); rel(tickOn(h,F[1])/plainTick(h,F[1]),1.15*1.15*1.15*1.12,'Shoreless 3% x 5, Tidal Weight 3% x 5, Tidal Hammer 5% x 3, Long Flood 4% x 3',1e-6);
  setStack(L,'oFl',5); at(L,F[3],10,4.5); const d=F[3].hp, f1=F[1].hp; V.hit(v,F[1],1000,{kind:'true',auto:true}); rel(d-F[3].hp,(f1-F[1].hp)*0.30,'Above the Line: at Flood 5 his basic attacks splash 10% x 3 within 1.5 m',1e-9);
  setStack(L,'oFl',4); const d2=F[3].hp; V.hit(v,F[1],1000,{kind:'true',auto:true}); assert.equal(F[3].hp,d2,'not below Flood 5');
});

test('Orryn / the flood changed: Pounding Tide, Drowned Ground (PICK ONE), Second Ocean; Pounding Ocean, Grinding Weight, Spinning Deep, Still Ocean',()=>{
  const L=lab(H,S(['os_5_2']),{foes:3}); let h=castHz(L,'ult',10,0,L.F[1]); near(h.interval,0.5/1.3,'Pounding Tide: 30% more often',1e-12); rel(tickOn(h,L.F[1])/plainTick(h,L.F[1]),0.8,'each 20% weaker',1e-6);
  const L2=lab(H,S(['os_5_1']),{foes:3}); HZ().length=0; V.cast(L2.v,'ult',L2.F[1]); h=mineHz(L2)[0]; near(h.life,5+3,'Drowned Ground: 3 s more'); h.life=3.5; rel(tickOn(h,L2.F[1])/plainTick(h,L2.F[1]),1,'at full strength for its 5 s'); h.life=2.9; rel(tickOn(h,L2.F[1])/plainTick(h,L2.F[1]),0.5,'then half strength',1e-6);
  const L3=lab(H,S(['os_8_2','os_9_2']),{foes:4}); h=castHz(L3,'ult',10,0,L3.F[1]); L3.F[1].hp=L3.F[1].maxHp*0.9; L3.F[0].hp=L3.F[0].maxHp*0.5; L3.F[2].hp=L3.F[2].maxHp*0.5; at(L3,L3.F[3],11,2); tickNow(h); h.life=0; V.step(2);
  const s2=mineHz(L3).find(z=>z._oSub); assert.ok(s2,'Second Ocean: a smaller flood rises'); near(s2.r/V.METER,3,'3 m'); near(s2.life,2,'for 2 s',0.1); near((s2.x-L3.F[3].x),0,'on the enemy with the most HP that was inside',1e-6);
  s2.acc=s2.interval-1e-9; V.step(1); s2.life=0; V.step(2); assert.ok(!mineHz(L3).some(z=>z._oSub&&z!==s2&&z.life>0),'the smaller flood raises no other');
  h=castHz(L3,'ult',10,0,L3.F[1]); tickNow(h); HZ().length=0; V.wave(); V.step(2); assert.equal(mineHz(L3).length,0,'a flood swept away by a new wave raises nothing in it');
  const L4=lab(H,S(['sp_8_3','fc_8_1','sp_1_4','sp_10_3','sp_12_3']),{foes:3}); h=castHz(L4,'ult',10,0,L4.F[1]); VMX('var __brnd=brnd; brnd=function(){ return 0.40; }'); try{ tickNow(h); } finally{ VMX('brnd=__brnd'); }
  const f=L4.F[1]; assert.ok(f.slow>0&&Math.abs(f.slowMul-0.85)<1e-9,'Pounding Ocean: its impacts slow 3% x 5'); near(f.slow,1,'for 1 s',0.05); assert.equal(ust(L4,f,'oCr'),1,'Grinding Weight: a 15% x 3 chance of a Crushed stack'); assert.equal(ust(L4,f,'oWh'),3,'Spinning Deep: 1 Whorl x 3 a tick');
  f.energy=0; V.step(1); V.hit(L4.v,f,1,{kind:'true'}); V.step(1); near(f.energy,7*0.75,'Still Ocean: 5% x 5 less energy inside',1e-6);
});

test('Orryn / Cold Shock and The Water Remembers',()=>{
  const L=lab(H,S(['os_n2','os_n3']),{foes:3}), {v,F}=L; const h=castHz(L,'ult',30,0,F[1]); h.interval=1e9; V.step(1); h.x=F[1].x; V.step(1);
  assert.ok(F[1].slow>0&&Math.abs(F[1].slowMul-0.85)<1e-9,'Cold Shock: entering his water, slowed 5% x 3'); near(F[1].slow,1,'for its first 1 s',0.06);
  h.x=L.v.x+40*V.METER; V.step(2); const d=F[1].hp; secs(2); h.x=F[1].x; V.step(1); rel(d-F[1].hp,h.dmg*VMX('defMul')(v,F[1],'magic'),'The Water Remembers: back within 4 s, one tick at 20% x 5 at once',1e-6);
  h.x=L.v.x+40*V.METER; V.step(2); const d2=F[1].hp; h.x=F[1].x; V.step(1); assert.equal(F[1].hp,d2,'once per enemy for each flood');
  const L2=lab(H,S(['os_n3']),{foes:3}); const g=castHz(L2,'ult',10,0,L2.F[1]); g.interval=1e9; V.step(1); g.x=L2.v.x+40*V.METER; V.step(2); secs(4.2); const d3=L2.F[1].hp; g.x=L2.F[1].x; V.step(1); assert.equal(L2.F[1].hp,d3,'not after 4 s');
});

test('Orryn / Still Mind, Finished Work; Deep Lungs; Patient Shell',()=>{
  const L=lab(H,S(['os_5_4','fc_12_1']),{foes:3}), {v,F}=L; at(L,F[0],30,0); V.step(1); rel(sphRatio(L,F[1]),1.075,'Still Mind: no enemy within 4 m, his spells 1.5% x 5 more');
  at(L,F[0],4.5,0); V.step(1); rel(sphRatio(L,F[1]),1,'not with one at 0.9 m'); F[1].hp=F[1].maxHp*0.29; rel(sphRatio(L,F[1]),1.12,'Finished Work: 4% x 3 more below 30% HP');
  const L2=lab(H,S(['os_2_4']),{foes:3,big:true}); L2.v.hp=L2.v.maxHp*0.5; L2.T.s.lim['os_2_4#0'].acc=0; const h=L2.v.hp; secs(1.02); near(L2.v.hp-h,L2.v.maxHp*0.01,'Deep Lungs: 0.2% x 5 of his max HP a second (under the 1.2% cap)',1e-3);
  const L3=lab(H,S(['os_12_4']),{foes:3,big:true}), v3=L3.v; secs(3.8); assert.ok(!(v3.shield>0),'not before 4 s'); secs(0.3); near(v3.shield,v3.maxHp*0.075,'Patient Shell: after 4 s without damage, 1.5% x 5 of his max HP',1e-9);
  hitOn(L3,v3,v3.maxHp*0.2); assert.ok(!(v3.shield>0),'it breaks'); V.step(1); secs(3.8); assert.ok(!(v3.shield>0)); secs(0.3); assert.ok(v3.shield>0,'it returns 4 s after it breaks');
  hitOn(L3,v3,v3.maxHp*0.01); secs(1); hitOn(L3,v3,v3.maxHp*0.2); V.step(1); /* broken again; a wave starts late in the clock (the game's own change: resetPerWave, beginWaveEnter puts the clock back to 0) */ secs(1); VMX('battleTime=70; resetPerWave(); beginWaveEnter(); waveXfer=null;'); for(const u of VMX('units')) u.stunned=1e6; assert.ok(VMX('battleTime')<0.01,'the clock is back at 0'); V.step(1);
  secs(3.8); assert.ok(!(v3.shield>0),'a new wave: the clock restarts (4 s without damage again)'); secs(0.3); assert.ok(v3.shield>0,'and it comes 4 s into the new wave, whatever the clock was in the old one');
});

test('Orryn / The Spiral Deep (SIGNATURE): 2 Whorls a tick, drawn 0.5 m a second to the centre, no energy, 6 Whorls inside: stunned 1.5 s',()=>{
  const L=lab(H,S(['sp_13_3']),{foes:3}), {v,F}=L; const f=F[1]; free(f); const h=castHz(L,'ult',10,0,f); at(L,f,13,0); V.step(1);
  tickNow(h); assert.equal(ust(L,f,'oWh'),2,'2 Whorls a tick (Whorls owned by The Spiral Deep, no Whorls talent needed)'); assert.ok(f.pulledBy&&Math.abs(f.pulledBy.x-h.x)<1e-6,'drawn toward the centre'); near(f.pullSpeed/V.METER,0.5,'0.5 m a second',1e-6);
  f.energy=0; V.step(1); V.hit(v,f,1,{kind:'true'}); V.step(1); near(f.energy,0,'gains no energy at all');
  tickNow(h); tickNow(h); near(f.stunned,1.5,'6 Whorls inside: stunned 1.5 s',0.04); assert.equal(ust(L,f,'oWh'),0);
  const L2=lab(H,S(['sp_13_3','sp_1_4']),{foes:3}); const g=L2.F[1]; free(g); castHz(L2,'blue',10,0,g); setUst(L2,g,'oWh',5); tickNow(mineHz(L2)[0]); assert.ok(!(g.stunned>0),'not outside the flood (Spun Round not learned)');
});

test('Orryn / No Shore At All (SIGNATURE): at Flood 5 the whole field at 60%; when it ends a last impact of 40% per Sea Weight (200% Drowning); the Flood held at 5',()=>{
  const L=lab(H,S(['os_13_2','os_1_1']),{foes:3}), {v,F}=L; setStack(L,'oFl',4); HZ().length=0; V.cast(v,'ult',F[1]); let h=mineHz(L)[0]; near(h.r/V.METER,6,'below Flood 5: the usual flood');
  setStack(L,'oFl',5); HZ().length=0; V.cast(v,'ult',F[1]); h=mineHz(L)[0]; assert.ok(h.r>200*V.METER,'at Flood 5: the whole field'); at(L,F[2],60,20);
  rel(tickOn(h,F[2])/plainTick(h,F[2]),0.6,'every enemy is in it, at 60% strength',1e-6);
  setUst(L,F[1],'oSw',2); setUst(L,F[2],'oSw',5); const d1=F[1].hp, d2=F[2].hp, d0=F[0].hp; setUst(L,F[0],'oSw',0); h.life=0; V.step(1);
  rel(d1-F[1].hp,h.dmg*0.8*VMX('defMul')(v,F[1],'magic'),'a last impact: 40% x 2 Sea Weight',1e-6); rel(d2-F[2].hp,h.dmg*2*1.10*VMX('defMul')(v,F[2],'magic'),'200% on a Drowning enemy (Drowning\'s own 2% x 5 too)',1e-6); assert.equal(F[0].hp,d0,'nothing on one with none');
  assert.equal(stack(L,'oFl'),5,'the Flood stays at 5');
});

test('Orryn: his damage reduction talents together take at most 40% off a hit',()=>{
  const L=lab(H,S(['fc_1_4','fc_5_4','fc_n1','os_1_3','os_5_3','fc_12_4','sp_12_2','os_10_1','os_1_1','sp_4_1']),{foes:3,big:true}), {v,F}=L; setStack(L,'oCh',40); setStack(L,'oFl',5);
  setUst(L,F[1],'oCr',1); setUst(L,F[1],'oWh',3); setUst(L,F[1],'oSw',5); castHz(L,'blue',10,0,F[1]); V.cast(v,'green',F[2]); assert.ok(win(L,'oBr'),'Braced for Depth: 3 s after the Sphere lands');
  const raw=0.88*0.90*0.85*0.91*0.91*0.91*0.90*0.925; assert.ok(raw<0.6); rel(inRatio(L,{src:F[1]}),0.60,'together at most 40% less (they would give '+((1-raw)*100).toFixed(1)+'%)',1e-9);
  secs(3.1); assert.ok(!win(L,'oBr'),'Braced for Depth: 3 s');
});

/* ============================== PAGE SITES ============================== */
test('Orryn: every page site his talents added is reached - the hazard tick (its number on each enemy, the part around it) and the bound hazards',()=>{
  const rows=[{on:'partPre',skill:'hz',do:[{fn:'n',k:'pre'}]},{on:'part',skill:'hz',do:[{fn:'n',k:'post'}]},{on:'num',skill:'hzTick',do:[{fn:'n',k:'num'}],mul:2},{on:'cast',do:[{fn:'tag'}]}];
  const def={hero:H,casting:true,states:{},always:[],talents:{fc_9_1:rows},partial:{},ruling:{},
    fn:{ n(A,T,u,c,a){ const C=T.s.cnt||(T.s.cnt={}); C[a.k]=(C[a.k]||0)+1; if(a.k==='pre') C.cur=T.s.cur; if(a.k==='num') C.numCur=T.s.cur; },
      tag(A,T,u){ const E=A.eng(), H=E.hazards(); T.s.got=H.length; for(const h of H) if(h.src===u) h._talZ=u; } }};
  const L=lab(H,[['fc_9_1',1]],{foes:3,def}), {v,F}=L; HZ().length=0; V.cast(v,'blue',F[1]); assert.ok(L.T.s.got>=1,'the bound hazards list: his whirlpool is there');
  const h=park(HZ().find(z=>z.src===v),L,10,0); const plainD=(()=>{ const z=h._talZ; h._talZ=null; try{ return tickOn(h,F[1]); } finally{ h._talZ=z; } })(); const C=()=>L.T.s.cnt||{};
  const d=tickOn(h,F[1]); assert.equal(C().pre,1); assert.equal(C().post,1,'partPre / part once a tick'); assert.equal(C().cur,'hz'); assert.ok(C().num>=1,'the number on each enemy'); assert.equal(C().numCur,'hz','while the tick resolves'); rel(d,plainD*2,'and it changes the tick',1e-9);
  assert.equal(L.T.s.cur,null,'the part ends with the tick');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Orryn: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['fc_1_1','fc_1_4','fc_9_1','sp_1_4','sp_1_1','os_1_1','os_1_3','os_6_4']), TEAM=['vael','sylthaine','vireo','vex','orryn'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const seen={cr:0,wh:0,sw:0,ch:0,fl:0,hz:0,drawn:0};
  for(let i=0;i<3200&&!V.ended()&&s.alive;i++){ V.step(1); const S0=s._tal.s; seen.ch=Math.max(seen.ch,(S0.k.oCh||{n:0}).n); seen.fl=Math.max(seen.fl,(S0.k.oFl||{n:0}).n); seen.hz=Math.max(seen.hz,(S0.oHid||0)); seen.drawn=S0.oDrawn||0;
    for(const f of units()){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o['#oCr']&&o['#oCr'].until>V.now()) seen.cr++; if(o['#oWh']&&o['#oWh'].until>V.now()) seen.wh++; if(o['#oSw']&&o['#oSw'].until>V.now()) seen.sw++; } }
  console.log('  live fight: '+JSON.stringify(seen));
  assert.ok(seen.cr>0,'enemies Crushed'); assert.ok(seen.wh>0,'Whorls'); assert.ok(seen.sw>0,'Sea Weight'); assert.ok(seen.ch>3,'Chambers sealed'); assert.ok(seen.fl>0,'the Flood rose'); assert.ok(seen.hz>0,'his hazards tagged'); assert.ok(seen.drawn>0,'energy drawn');
  determinism(H,TEAM);
});

/* The page sites his talents added (the hazard tick's partPre / num / part, the bound hazards): with nothing learned, whole seeded fights with Orryn in the
   line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){} return h; }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Orryn: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENCS=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['orryn','vael','vireo','sylthaine','maren'], foeTeam=['ambrel','fritz','dandra','konwu','bloatus'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __orN={green:0,blue:0,ult:0,ticks:0}; var __orD=_doEffectCore, __orU=_updateBattleCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="orryn"&&(!o||!o.deliver||o.deliver==="travel"||o._arrived)){ if(type==="strike") __orN.green++; if(type==="ashfall"){ if(u._castSlot==="ult") __orN.ult++; else __orN.blue++; } } return __orD.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ for(const h of groundHazards) if(h&&h.src&&h.src.key==="orryn"&&!h.arrival&&h.acc+dt>=h.interval) __orN.ticks++; return __orU.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENCS.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__orN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.green>0&&c.blue>0&&c.ult>0&&c.ticks>0,'the fights cast his three skills and his water ticked: '+JSON.stringify(c)); }
  finally{ VMX('_doEffectCore=__orD; _updateBattleCore=__orU;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong. */
const DEF={ fc:['fc_5_4','fc_n1','fc_12_4','fc_1_4','fc_1_1','fc_6_4','fc_7_4'],
            sp:['sp_12_2','sp_4_1','sp_1_4','sp_12_4','sp_7_4','sp_3_1'],
            os:['os_5_3','os_10_1','os_1_1','os_1_3','os_1_4','os_8_1','os_12_4','os_2_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={fc:0,sp:1,os:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his reduction talents true at once - 40 Chambers, Flood 5, Braced for Depth on, the attacker Crushed, with 3 Whorls,
   5 Sea Weight and under his Spiral Current; normal and critical, physical and magic */
function worstHit(list,kind,crit,glyph){ const L=lab(H,list,{foes:3,allies:1,cold:true}), {v,F}=L; V.step(1); const f=F[0];
  if(L.T){ setStack(L,'oCh',40); setStack(L,'oFl',5); setUst(L,f,'oCr',3); setUst(L,f,'oWh',3); setUst(L,f,'oSw',5); L.T.s.w.oBr={t:3,n:1,cdT:0,at:-1,wave:false};
    HZ().length=0; V.cast(v,'blue',f); const h=HZ().find(z=>z.src===v); if(h) park(h,L,4.5,0); }
  v.glyphDR=glyph||0; v.maxHp=1e5; v.hp=5e4; v.shield=0;
  const raw=1e5, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Orryn: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at (or near) that ceiling in a seeded fight',()=>{
  const cands=[[['fc','os'],[61,30]],[['os','fc'],[61,30]],[['sp','os'],[61,30]],[['os','sp'],[61,30]],[['fc'],[91]],[['os'],[91]],[['fc','sp','os'],[40,25,26]]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), g30=Math.max(...['magic','phys'].map(k=>worstHit(best.list,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | ')+'; with 30% glyph reduction '+(g30*100).toFixed(1)+'%');
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90&&g30<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,pt:0,ph:0,sus:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="orryn"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>raw*1e-6){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!u||u.key!=="orryn"||!u.alive) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const f=units.find(x=>x.alive&&x.team!==u.team); if(f&&u._tal&&u._tal.s.oApi){ let worst=0; for(const k of ["phys","magic"]){ let m=defMul(f,u,k)*(u.drT>0?u.drMul:1)*(1-(u.glyphDR||0));'+
    '        m*=u._tal.fn.drK(u._tal.s.oApi,u._tal,u,f); worst=Math.max(worst,1-m); } __dr.pt++; __dr.sus+=worst; if(worst>=0.85) __dr.ph++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','orryn'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks+'; reference hit each tick: sustained '+(100*d.sus/Math.max(1,d.pt)).toFixed(1)+'%, at 85% or more '+(100*d.ph/Math.max(1,d.pt)).toFixed(1)+'% of the fight');
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.ok(d.imm<d.ticks*0.5,'immune far less than half the fight');
    assert.ok(d.ph<d.pt*0.5,'at 85% or more for less than half of the fight ('+d.ph+' of '+d.pt+' ticks)'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* The stun-lock rule: his talent stuns (Spent Breath, Crushing Depth, Spun Round, The Spiral Deep) never land on a stunned enemy or within 0.5 s after one of his
   ends, and one cast stuns each enemy at most twice. Seeded fights with builds that stun: the longest time one enemy spends stunned by him in a row. */
test('Orryn: the stun-lock rule in seeded fights - the longest run of his stuns on one enemy, and the break between them',()=>{
  const lists=[S(['fc_1_1','fc_8_1','fc_9_1','fc_5_2','sp_1_4','sp_2_4','sp_3_4','sp_8_4','sp_10_3','sp_13_3']),everything(H)];
  let longest=0, minBreak=Infinity, n=0, fights=0;
  for(const list of lists){ const sn=snaps(['vael','vireo','vex','sylthaine','orryn'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    VMX('var __ost=[]; var __osu=_updateBattleCore; _updateBattleCore=function(dt){ const r=__osu.apply(this,arguments); for(const u of units){ if(u&&u.key==="orryn"&&u._tal&&u._tal.s.oStL&&u._tal.s.oStL.length){ for(const e of u._tal.s.oStL) __ost.push([__ost.f+":"+e[0],e[1],e[2]]); u._tal.s.oStL.length=0; } } return r; }; __ost.f=0;');
    try{ for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]){ VMX('__ost.f++'); campaign(sn,node,seed); fights++; }
      const foe=snaps(['grosk','gruel','carn','konwu','bloatus'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
      for(const seed of [3,5]){ VMX('__ost.f++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); fights++; }
      const L=VMX('__ost').slice(); n+=L.length; const by={}; for(const e of L) (by[e[0]]||(by[e[0]]=[])).push(e);
      for(const k in by){ const a=by[k].sort((p,q)=>p[1]-q[1]); let runS=a[0][1], runE=a[0][1]+a[0][2];
        for(let i=1;i<a.length;i++){ const s=a[i][1]; if(s>=a[i-1][1]) minBreak=Math.min(minBreak,s-(a[i-1][1]+a[i-1][2])); if(s<=runE+1e-9) runE=Math.max(runE,s+a[i][2]); else { longest=Math.max(longest,runE-runS); runS=s; runE=s+a[i][2]; } }
        longest=Math.max(longest,runE-runS); } }
    finally{ VMX('_updateBattleCore=__osu;'); } }
  console.log('  stun-lock: '+n+' talent stuns of his in '+fights+' fights; the longest run on one enemy '+longest.toFixed(2)+' s; the shortest break between two of them on one enemy '+(minBreak===Infinity?'-':minBreak.toFixed(2)+' s'));
  assert.ok(n>0,'his talent stuns landed in the fights'); assert.ok(longest<=1.5+1e-6,'never longer than one of his stuns (at most 1.5 s) in a row');
  assert.ok(minBreak===Infinity||minBreak>=0.5-1e-6,'at least 0.5 s between two of his stuns on one enemy');
});
