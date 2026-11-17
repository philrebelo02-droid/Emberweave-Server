'use strict';
/* Askel Greatbrow's talents as data on the mechanics layer (talents-mech/askel.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Askel, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) ...; A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5). Every lab unit is held (stunned):
   a held ALLY is one Unshaken Herd covers once a second (pulse() makes that second now). Bodies are about 2 m: A0 is about 1.5 m from him body to body.
   Run: node --test tests/talents-mech-askel.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='askel', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const pulse=L=>{ L.v._uhT=1; V.step(1); };                                         // Unshaken Herd's once-a-second check now (the passive's own clock)
const free=x=>{ x.stunned=0; x.speed=0; x.level=1; };                               // a lab unit no longer held, standing still, that his controls always land on
const loose=x=>{ x.stunned=0; x.speed=0; };                                         // an ally no longer held (Unshaken Herd stops covering it)
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage: no armor in the way)
const gapC=(L,a,g)=>g+V.bodyR(L.v)+V.bodyR(a);                                      // the centre distance that leaves g metres between his body and a's
/* allies on a circle round him, g metres body to body (same-team bodies push apart to about 5.2 m centre to centre, so they sit 60 degrees apart) */
const ringAllies=(L,list,g,deg)=>list.forEach((a,i)=>{ const c=gapC(L,a,g), t=(deg[i])*Math.PI/180; at(L,a,c*Math.cos(t),c*Math.sin(t)); });
/* March of the Greatbrow as the game casts it (ULT_DEF.charge with HERO_ULT_ART.askel merged in, at his ultimate's skill level). His dash is taken off him and
   run by hand: first the knocks on the path (the game's hazards, as they come before the arrival), then the slam on arrival */
const MARCH=VMX(`(function(u){ const ab=Object.assign({},ULT_DEF[u.t.ability],HERO_ULT_ART[u.key]||{}); u._castSlot='ult'; u._castLv=(u.skillLv&&u.skillLv[0])||1; u._castSM=skillMul(u._castLv);
  try{ doEffect(u,u.t.ability,ab); } finally{ u._castSM=1; u._castLv=0; } const d=u._dash; u._dash=null; return d; })`);
const march=(L,now)=>{ const d=MARCH(L.v); if(!now) secs(1); if(d) d.run(); return d; };    // now: the slam at once (enemies placed close together have no time to push apart)
const onAngle=(L,a,g,deg)=>{ const c=gapC(L,a,g), t=deg*Math.PI/180; at(L,a,c*Math.cos(t),c*Math.sin(t)); };
const ATK=VMX('(s,t)=>s.dmg*((s.dmgBuffT>0)?(s.dmgBuffMul||1):1)*rageMul*defMul(s,t,"phys")');   // a hit of 100% of his attack on t, after t's armor
const BAN=lv=>VMX('skLvNum')('banner',VMX('KITS').askel.blue,lv);                  // Rallying Ground's damage-taken multiplier at a skill level

test('Askel: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  const M=FXN.mech(H); for(const id of ['fd_1_1','st_1_1','ch_1_1','fd_13_2','st_13_3','ch_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['fd_1_3','fd_3_3','fd_6_1','st_2_2','st_10_2','st_3_2','ch_1_3','ch_2_3','ch_3_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.equal(T.talent(H,'ch_3_3').ranks,5,'Tine Edge, the plain crit talent: 1% x 5 = 5% at most');
});

test('Askel: his real kit, as the talents read it - Standard Crash, Rallying Ground (one pulse), Unshaken Herd (once a second), March of the Greatbrow',()=>{
  plain({foes:3,allies:2},P=>{ const {v,A,F}=P, m=v.passMul;
    assert.ok(v.pass.unshaken,'his passive');
    at(P,F[0],3,0); free(F[0]); const h0=F[0].hp, h1=F[1].hp; V.cast(v,'green',F[0]);
    assert.ok(F[0].hp<h0,'Standard Crash hits an enemy within 3.2 m'); near(F[0].silencedT,1.5*V.ccNerf,'and silences it: the area table\'s 1.5 s x 0.7',1e-9); assert.equal(F[1].hp,h1,'not one 10 m away');
    V.cast(v,'blue'); near(A[0].drMul,BAN(10),'Rallying Ground: the one skill slot, 18% + 0.1 pt a level'); near(A[0].drT,6,'for 6 s',1e-6); near(A[0].hasteMul,1.22,'attack speed x1.22'); near(A[0].ctrlRes,0.25,'25% control resist');
    near(v.drMul,BAN(10),'himself too'); assert.ok(!(A[1].drT>0),'only within 6 m: one pulse at the cast, no zone');
    const e0=v.energy; pulse(P); near(A[0].drMul,0.75,'Unshaken Herd: a held ally takes 25% less (the same slot, the stronger value stays)'); near(A[1].drMul,0.75,'any held ally, any distance');
    assert.ok(v.energy-e0>=2*4*m-1e-9,'and he gains 4 x passive level energy for each: '+(v.energy-e0));
    at(P,F[0],4.5,0); free(F[2]); const a0=A[0].maxHp, y0=F[0].y, y1=F[1].y, f2=F[2].hp, f0=F[0].hp;
    march(P); near(A[0].shield,a0*0.12,'March: every ally a shield of 12% of its max HP'); near(v.shield,v.maxHp*0.12,'himself too');
    assert.ok(F[2].hp<f2,'the slam on the farthest enemy'); near(F[2].stunned,2*V.ccNerf,'stunned: the area table\'s 2 s x 0.7',1e-9);
    assert.ok(Math.abs(F[0].y-y0)>1.5*V.METER&&Math.abs(F[1].y-y1)>1.5*V.METER,'the enemies on the path are knocked 2 m aside'); assert.equal(F[0].hp,f0,'and take no damage (no path hit)');
  });
});

/* ============================== THE FORD ============================== */
test('Askel / the Herd: Stand in the Deep, Shoulder to Shoulder, Elder Bull, Calves Behind, Something to Lean On, Old Bull, Close the Ranks, Herd Warmth',()=>{
  const L=lab(H,S(['fd_1_1','fd_4_1','fd_12_1','fd_3_1','fd_12_2','fd_10_1','fd_2_1','fd_8_1']),{foes:2,allies:3,big:true,cold:true}), {v,A,F}=L;
  F[1].team='ally'; const Hd=A.concat([F[1]]); at(L,F[0],0,14);
  ringAllies(L,Hd,2,[180,240,300,120]); V.step(1);
  assert.equal(stack(L,'herd'),4,'four allies within 4 m: four Herd'); for(const a of Hd) assert.ok(mark(L,a,'hd'));
  V.step(1); const d4=v.dmg, h4=v.maxHp, pos=Hd.map(a=>[a.x,a.y]); for(const a of Hd) a.x+=25*V.METER; V.step(2); assert.equal(stack(L,'herd'),0); const dz=v.dmg; near(d4,dz*(1+0.015*4),'Shoulder to Shoulder: 0.3% x 5 attack per Herd'); near(h4,v.maxHp*(1+0.03*4),'Elder Bull: 1% x 3 max HP per Herd');
  Hd.forEach((a,i)=>{ a.x=pos[i][0]; a.y=pos[i][1]; }); V.step(2); assert.equal(stack(L,'herd'),4);
  near(A[0].ctrlRes,0.15,'Calves Behind: at 4 Herd, the Herd 15% control resist'); near(v.ctrlRes||0,0,'(not him)');
  const a=A[0]; near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*(1-0.025*4)*0.95,'Stand in the Deep: the Herd 0.5% x 5 per Herd; Something to Lean On 1% x 5 (he is above 50% HP)');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.05*4),'Stand in the Deep: him 1% x 5 per Herd');
  v.hp=v.maxHp*0.45; near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.05*4)*(1-0.05*4),'Old Bull below 50%: 1% x 5 per Herd more');
  near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*(1-0.025*4),'Something to Lean On only above 50%');
  v.hp=v.maxHp;
  a.hp=a.maxHp*0.5; let h=a.hp, n=0; while(a.hp===h&&n++<40) V.step(1); h=a.hp; secs(1.0); near(a.hp-h,a.maxHp*0.01,'Herd Warmth: 0.2% x 5 of its max HP each second',1e-6);
  onAngle(L,A[2],5.4,300); V.step(1); assert.ok(mark(L,A[2],'hd'),'Close the Ranks: 0.5 m x 3 farther (5.4 m away)'); assert.equal(stack(L,'herd'),4);
  onAngle(L,A[2],5.7,300); V.step(2); assert.ok(!mark(L,A[2],'hd'),'not 5.7 m away'); assert.equal(stack(L,'herd'),3);
  V.step(1); near(A[0].ctrlRes,0,'Calves Behind needs 4 Herd'); near(v.dmg,dz*(1+0.015*3),'');
});

test('Askel / his stacking damage reduction is one group: Stand in the Deep, Old Bull, Muster and Never Forgotten together at most 40%; Muster and Never Forgotten each at most 20%',()=>{
  const L=lab(H,S(['fd_1_1','fd_10_1','st_1_3','st_3_1']),{foes:1,big:true}), {v}=L;
  const k=(he,mu,re,low)=>{ v.hp=v.maxHp*(low?0.4:1); setStack(L,'herd',he); setStack(L,'mus',mu); setStack(L,'rem',re); return hitOn(L,v,1000)/plainHit(L,()=>hitOn(L,v,1000)); };
  near(k(2,0,0),0.9,'2 Herd: 10%'); near(k(0,5,0),0.9,'5 Muster: 0.4% x 5 each'); near(k(0,0,1),0.95,'1 Remembrance: 1% x 5');
  near(k(0,16,0),0.8,'Muster: up to 20% (16 Muster would be 32%)'); near(k(0,0,6),0.8,'Never Forgotten: up to 20%');
  near(k(2,5,0),0.9*0.9,'two of them multiply'); near(k(4,10,4),0.6,'all of them: at most 40% together (0.8 x 0.8 x 0.8 = 0.512)'); near(k(4,10,4,true),0.6,'below 50% HP too');
});

test('Askel / Steadfast: Hold Steady, Unshaken Resolve, Stand Your Ground, Unbowed, Bellow; Herd Instinct',()=>{
  const L=lab(H,S(['fd_1_4','fd_3_4','fd_10_4','fd_7_4','fd_5_4']),{foes:1,allies:1,big:true}), {v,A}=L; const a=A[0];
  assert.equal(stack(L,'sf'),0); const d0=v.dmg; v.hp=v.maxHp*0.5; let h=v.hp;
  pulse(L); assert.equal(stack(L,'sf'),1,'Unshaken Herd covered the held ally: 1 Steadfast'); near(v.hp-h,v.maxHp*0.025,'Stand Your Ground: 0.5% x 5 of his max HP each Steadfast gained',1e-6);
  near(a.drMul,0.70,'Bellow: the passive\'s cut 1% x 5 stronger (in its own slot)'); V.step(1); near(v.dmg,d0*1.03,'Hold Steady: 1% x 3 attack per Steadfast');
  for(let i=0;i<4;i++) pulse(L); assert.equal(stack(L,'sf'),5,'max 5'); h=v.hp; pulse(L); near(v.hp,h,'no heal when none is gained'); V.step(1); near(v.dmg,d0*1.15,'');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.075),'Unbowed: at 5 Steadfast, 1.5% x 5 less');
  loose(a); secs(12.8); assert.equal(stack(L,'sf'),5,'Unshaken Resolve: they last 8 + 1 x 5 s after the last'); secs(0.3); assert.equal(stack(L,'sf'),0,'then all lapse');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'Unbowed: not below 5');
  const L2=lab(H,S(['fd_6_4']),{foes:1}); assert.equal(stack(L2,'sf'),4,'Herd Instinct: 2 x 2 Steadfast at the start of the wave');
  setStack(L2,'sf',0); V.wave(); V.step(1); assert.equal(stack(L2,'sf'),4,'each wave');
});

test('Askel / The Nineteen: at 5 Steadfast the held ally is freed at once, once every 8 s; Colours at the Ford (LINK, its own half): 5% less for 3 s',()=>{
  const L=lab(H,S(['fd_9_4','fd_n1']),{foes:1,allies:1}), {v,A}=L; const a=A[0];
  setStack(L,'sf',4); a.fearT=3; pulse(L); assert.equal(stack(L,'sf'),5); assert.equal(a.stunned,0,'freed of the stun'); assert.equal(a.fearT,0,'and the fear');
  a.stunned=1e6; secs(1); pulse(L); assert.ok(a.stunned>1,'once every 8 s'); secs(7.2); pulse(L); assert.equal(a.stunned,0,'8 s later, again');
  a.stunned=1e6; pulse(L); near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*0.95,'Colours at the Ford: the ally Unshaken Herd covered takes 5% less');
  loose(a); secs(2.9); near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*0.95,'for 3 s'); secs(0.2); near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000)),'then not');
  assert.ok(!mark(L,a,'col'),'no Colours without Carry the Colours');
});

test('Askel / Breakwater, Riverbed, Breaking Wave; Colours at the Ford with Carry the Colours',()=>{
  const L=lab(H,S(['fd_2_2','fd_4_2','fd_6_2','fd_n1','st_1_4']),{foes:3,allies:2,big:true}), {v,A,F}=L; const a=A[0], b=A[1];
  at(L,F[1],V.bodyR(a)+V.bodyR(F[1])+1,-5.5); at(L,F[0],12,0); at(L,F[2],12,8); V.step(2); F[1].armorRating=0; F[0].armorRating=0;   // F1 1 m from A0's body
  const knock=x=>{ x.x+=2*V.METER; x._ax=x.x; x._airT=Math.max(x._airT||0,0.25); };
  let bx=b.x; knock(b); V.step(1); assert.ok(b.x>bx+V.METER,'an ally 7 m away is not stopped'); b._airT=0;
  const ax=a.x, ay=a.y, s0=v.shield||0, f1=F[1].hp, f0=F[0].hp, w=ATK(v,F[1])*0.5; knock(a); V.step(1);
  near(a.x,ax,'Breakwater: a knock on an ally within 4 m is undone',1e-6); near(a.y,ay,'',1e-6); near(a._airT,0,'no knock-up left');
  near((v.shield||0)-s0,v.maxHp*0.05,'he gains a shield of 1% x 5 of his max HP'); near(f1-F[1].hp,w,'Breaking Wave: enemies within 3 m of that ally take 10% x 5 of his attack (after armor)',1e-6); near(f0-F[0].hp,0,'not one farther away');
  assert.ok(mark(L,a,'col'),'Colours at the Ford with Carry the Colours: every ally Breakwater protects carries the Colours');
  secs(1); bx=a.x; knock(a); V.step(1); assert.ok(a.x>bx+V.METER,'Riverbed: once every 10 - 3 s'); a._airT=0; at(L,a,0,-5.5); secs(5.4);
  bx=a.x; knock(a); V.step(1); assert.ok(a.x>bx+V.METER,'not 6.5 s later'); a._airT=0; at(L,a,0,-5.5); secs(0.6);
  const px=a.x; a.pulledBy={x:a.x+300,y:a.y,alive:true}; a.pullT=0.5; a.pullStop=0; a.pullSpeed=300; V.step(1); near(a.pullT,0,'7 s later a pull is stopped too'); near(a.x,px,'',1e-6);
  const vx=v.x; knock(v); V.step(1); assert.ok(v.x>vx+V.METER,'(not himself)');
  pulse(L); assert.ok(mark(L,b,'col'),'Colours at the Ford: an ally Unshaken Herd covers carries the Colours (with Carry the Colours)');
});

test('Askel / The Deepest Water: nobody inside Rallying Ground can be moved, and Breakwater is ready again when it is cast',()=>{
  const L=lab(H,S(['fd_7_2','fd_2_2']),{foes:1,allies:2}), {v,A}=L;
  L.T.s.w.bwcd={t:5,n:1,cdT:0,at:-1,wave:false}; V.cast(v,'blue'); assert.ok(!win(L,'bwcd'),'Breakwater ready again'); V.step(1);
  assert.ok(A[0]._gearImmovableT>0.05,'an ally inside cannot be pushed, pulled or knocked up (the game\'s own immovable timer)'); assert.ok(!(A[1]._gearImmovableT>0),'not one outside');
  secs(6.3); assert.ok(!(A[0]._gearImmovableT>0),'only while it stands');
});

test('Askel / held allies: Wade Across, Swift Ford, Leaning Weight (up to 3), Herd Anger',()=>{
  const L=lab(H,S(['fd_5_3','fd_6_3','fd_7_1','ch_12_3']),{foes:2,allies:3,big:true}), {v,A,F}=L; at(L,F[0],4.5,0); F[1].team='ally';
  ringAllies(L,A,2,[180,240,300]); at(L,F[1],-14,0); const s0=v.speed; V.step(1);
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'no ally held yet'); pulse(L); V.step(1);
  near(v.speed,s0*1.15,'Wade Across: 15% faster while an ally is held'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.94*0.91,'Swift Ford 2% x 3; Leaning Weight 1% x 3 for each held ally within 6 m (3)');
  ringAllies(L,[F[1]],2,[120]); pulse(L); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.94*0.91,'up to 3 allies');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})))*1.09,'Herd Anger: 3% x 3 more while Unshaken Herd holds an ally');
  for(const a of A.concat([F[1]])) loose(a); secs(1.6); near(v.speed,s0,'the cover is over: 1.5 s'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'');
});

test('Askel / Stand in the Water (PICK ONE, its own lab): he cannot be moved while 2 or more Herd are near',()=>{
  const L=lab(H,S(['fd_5_2']),{foes:1,allies:3}), {v,A}=L; ringAllies(L,A,2,[180,240,300]); V.step(2);
  assert.ok(v._gearImmovableT>0.05,'3 Herd: the game\'s own immovable timer');
  at(L,A[1],-20,-20); at(L,A[2],20,-20); secs(0.2); assert.ok(!(v._gearImmovableT>0),'1 Herd: no');
});

test('Askel / his controls: Current-Proof, Deaf to Fear, Wet Fur (each capped); Calm the Herd; and all five together at most 40% shorter',()=>{
  const L=lab(H,S(['fd_5_1','fd_12_3','fd_12_4','fd_9_2']),{foes:1,allies:2,big:true}), {v,A,F}=L; const f=F[0];
  v.fearT=0; V.cc(f,v,'fearT',2); near(v.fearT,2*V.ccNerf*0.8*0.8,'fears: Current-Proof 4% x 5 and Deaf to Fear 10% x 2, multiplied',1e-9);
  v.stunned=0; V.cc(f,v,'stunned',2); near(v.stunned,2*V.ccNerf*0.8,'a stun: Current-Proof (up to 20%)',1e-9); v.stunned=1e6;
  v.slow=0; v.slowMul=1; V.cc(f,v,'slow',2); const m=v.slowMul; V.step(1); near(v.slowMul,1-(1-m)*(1-0.24),'Wet Fur: slows 8% x 3 weaker');
  A[0].fearT=0; A[1].fearT=0; V.cc(f,A[0],'fearT',2); V.cc(f,A[1],'fearT',2); near(A[0].fearT,2*V.ccNerf*0.9,'Calm the Herd: 2% x 5 shorter on an ally within 4 m',1e-9); near(A[1].fearT,2*V.ccNerf,'not 7 m away',1e-9);
  const L2=lab(H,S(['fd_5_1','fd_12_3','st_12_2','st_8_2','ch_8_3']),{foes:1,big:true}), w=L2.v, g=L2.F[0];
  w.fearT=0; V.cc(g,w,'fearT',2); near(w.fearT,2*V.ccNerf*0.6,'fears: 0.8 x 0.8 x 0.7 = 0.448, held at 40% shorter',1e-9);
  w.silencedT=0; V.cc(g,w,'silencedT',2); near(w.silencedT,2*V.ccNerf*0.6,'silences: 0.8 x 0.7 x 0.7, held at 40% shorter',1e-9);
  const L3=lab(H,S(['st_8_2']),{foes:1,big:true}); L3.v.silencedT=0; V.cc(L3.F[0],L3.v,'silencedT',2); near(L3.v.silencedT,2*V.ccNerf*0.7,'Steady Grip alone: 10% x 3',1e-9);
});

test('Askel / Standard Crash: Banner Pole, Crash Down, Crash Weight, Wide Crash, Wide Antlers, Big Brow, Bellowing Crash, Stubborn Head',()=>{
  const L=lab(H,S(['fd_2_3','st_7_2','ch_4_3','fd_4_3','ch_12_2','fd_11_1','ch_7_1','fd_11_3']),{foes:3,big:true}), {v,F}=L; const f=F[0];
  at(L,f,3,0); near(lost(f,()=>V.cast(v,'green',f)),plainHit(L,()=>lost(f,()=>V.cast(v,'green',f)))*1.12*1.15*1.12,'4% x 3, 3% x 5, 4% x 3 more');
  const o=FX.kit(v,'interruptslam',Object.assign({},v.greenAb)); near(o.radius,v.greenAb.radius+(0.6+1.0)*V.METER,'0.2 m x 3 and x 5 wider'); near(o.silence*V.ccNerf,v.greenAb.silence*V.ccNerf+1.0,'the silence 0.1 s x 5 and x 5 longer, in full'); FX.cast(v,'interruptslam',o);
  free(f); f.silencedT=0; at(L,F[1],0,4.6); free(F[1]); const h1=F[1].hp; V.cast(v,'green',f); near(f.silencedT,1.5*V.ccNerf+1.0,'a real slam: 1.05 s + 1.0 s',1e-9); assert.ok(F[1].hp<h1,'4.6 m away: hit (3.2 + 1.6 m)');
  near(lost(v,()=>V.hit(f,v,1000,{kind:'true'})),plainHit(L,()=>lost(v,()=>V.hit(f,v,1000,{kind:'true'})))*0.90,'Stubborn Head: 2% x 5 less from an enemy he silenced');
  secs(3.05); near(lost(v,()=>V.hit(f,v,1000,{kind:'true'})),plainHit(L,()=>lost(v,()=>V.hit(f,v,1000,{kind:'true'}))),'for 3 s');
});

/* ============================== THE STANDARD ============================== */
test('Askel / Rallying Ground: Muster, Call the Company, Drill, Company Voice, Mustered Strength, Full Company, Rally Spread, Drummer\'s Beat, Lean on the Banner, Parade Rest, Shade of the Standard',()=>{
  const L=lab(H,S(['st_1_3','st_2_3','st_6_3','st_11_3','st_8_3','st_12_3','st_4_2','st_4_3','fd_10_2','st_10_3','st_n1']),{foes:1,allies:3,big:true}), {v,A,F}=L; at(L,F[0],14,0);
  for(const a of A) loose(a); const d0=v.dmg, a0=A[0].dmg; const put=()=>{ for(const [a,t] of [[A[0],180],[A[1],240],[A[2],300]]){ const c=5.5; at(L,a,c*Math.cos(t*Math.PI/180),c*Math.sin(t*Math.PI/180)); } };
  put(); V.cast(v,'blue'); assert.equal(stack(L,'mus'),3,'Muster: 1 for each ally it rallies'); near(A[0].hasteMul,1.28,'Drummer\'s Beat: the attack speed 2% x 3 higher'); near(A[0].drT,6.9,'Lean on the Banner: 0.3 s x 3 longer',1e-6);
  V.step(1); near(v.dmg,d0*(1+0.01*3),'Drill: 0.2% x 5 attack per Muster'); near(A[0].dmg,a0*(1+0.01*3),'Company Voice: allies within 6 m 0.2% x 5 per Muster');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.02*3)*0.90,'Muster 0.4% x 5 each (in his group), Shade of the Standard 2% x 5 while it stands');
  put(); V.cast(v,'blue'); put(); V.cast(v,'blue'); assert.equal(stack(L,'mus'),9); for(const a of A){ a.drMul=1; a.drT=0; }
  put(); V.cast(v,'blue'); assert.equal(stack(L,'mus'),12,'Call the Company: up to 10 + 2 x 3'); near(A[0].drMul,BAN(10),'(Mustered Strength looks at the Muster as it is cast: 9)');
  for(const a of A){ a.drMul=1; a.drT=0; } put(); V.cast(v,'blue'); near(A[0].drMul,BAN(10)-0.05,'Mustered Strength: at 10 Muster, its reduction 1% x 5 stronger (the skill\'s own slot)');
  for(let i=0;i<3;i++){ put(); V.cast(v,'blue'); } assert.equal(stack(L,'mus'),16,'16 at most');
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.95,'Full Company: at 10 Muster, allies within 6 m 1% x 5 less');
  const o=FX.kit(v,'banner',Object.assign({},v.blueAb)); near(o.radius,v.blueAb.radius+0.9*V.METER,'Rally Spread: 0.3 m x 3 farther'); FX.cast(v,'banner',o);
  near(FX.cd(v,'blue',10),9.1,'Parade Rest: 0.3 s x 3 shorter');
  secs(7.0); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.80,'Shade: only while it stands (Muster at its 20%)');
  V.wave(); V.step(1); assert.equal(stack(L,'mus'),0,'Muster lasts the wave');
});

test('Askel / Plant the Standard (PICK ONE): 2 s longer where it was planted, allies inside take 5% less; Fall In: one control cleansed at the plant and every 2 s',()=>{
  const L=lab(H,S(['st_5_3','st_9_3']),{foes:1,allies:2}), {v,A}=L; const a=A[0]; loose(a); a.silencedT=3;
  V.cast(v,'blue'); near(a.drT,8,'the skill lasts 6 + 2 s',1e-6); assert.equal(a.silencedT,0,'Fall In: cleansed at the plant');
  near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*0.95,'5% less inside'); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000)),'not outside');
  a.fearT=5; secs(2.05); assert.equal(a.fearT,0,'and again 2 s later');
  at(L,a,0,-20); a.fearT=5; secs(2.05); assert.ok(a.fearT>0,'only inside'); secs(5); near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000)),'');
});

test('Askel / Carry It Forward (PICK ONE): the ground moves with him and rallies an ally it reaches; Forward March',()=>{
  const L=lab(H,S(['st_5_2','st_6_2','st_1_3']),{foes:1,allies:2}), {v,A,F}=L; for(const a of A) loose(a); at(L,F[0],14,8); const s0=v.speed;
  V.cast(v,'blue'); assert.equal(stack(L,'mus'),1); V.step(1); near(v.speed,s0*1.09,'Forward March: 3% x 3 faster while it moves');
  assert.ok(!(A[1].drT>0),'an ally 11 m away is not rallied at the cast'); const x0=v.x; v.x-=8*V.METER; V.step(1); const z=L.T.s.zn.rg[L.T.s.zn.rg.length-1];
  near(z.x,v.x,'the ground moves with him',1e-6); A[1].x=v.x; A[1].y=v.y-5*V.METER; V.step(2);
  near(A[1].drMul,BAN(10),'an ally it reaches is rallied'); assert.ok(A[1].drT>4.5&&A[1].drT<6,'for the time it has left: '+A[1].drT); assert.equal(stack(L,'mus'),2,'and gives Muster');
  V.step(5); assert.equal(stack(L,'mus'),2,'once per ground'); v.x=x0; secs(6.1); near(v.speed,s0,'Forward March: only while it stands');
});

test('Askel / the Colours: Carry the Colours, Bright Colours, Colour Guard, Wet Blue Cloth, Colours Flying, Hold the Colours, Pass the Pole, Colours Never Fall',()=>{
  const L=lab(H,S(['st_1_4','st_2_4','st_4_4','st_6_4','st_8_4','st_10_4','st_3_4','st_11_4']),{foes:1,allies:2,big:true}), {v,A}=L; const a=A[0], d0=a.dmg, i0=a.atkInterval;
  V.cast(v,'blue'); secs(5.9); assert.ok(!mark(L,a,'col'),'not while it stands'); secs(0.2); assert.ok(mark(L,a,'col'),'when it ends, every ally it rallied carries the Colours'); assert.ok(!mark(L,A[1],'col'),'not one it did not rally'); assert.ok(!mark(L,v,'col'),'(not himself)');
  V.step(1); near(a.dmg,d0*1.06,'2% x 3 more attack'); near(a.atkInterval,i0/1.10,'Colours Flying: 2% x 5 faster',1e-6);
  near(hitOn(L,a,1000),plainHit(L,()=>hitOn(L,a,1000))*0.95,'Colour Guard: 1% x 5 less');
  a.hp=a.maxHp*0.5; const h1=a.hp; V.heal(a,1e6); const got=a.hp-h1; a.hp=a.maxHp*0.5; plainHit(L,()=>V.heal(a,1e6)); const pg=a.hp-a.maxHp*0.5; near(got,pg*1.09,'Wet Blue Cloth: 3% x 3 more healing',1e-6);
  a.shield=0; pulse(L); near(a.shield,v.maxHp*0.05,'Pass the Pole: held, a shield of 5% of HIS max HP'); a.shield=0; pulse(L); near(a.shield,0,'once every 4 s');
  a.hp=a.maxHp*0.5; let h=a.hp, n=0; while(a.hp===h&&n++<40) V.step(1); h=a.hp; secs(1.0); near(a.hp-h,a.maxHp*0.015*1.09,'Hold the Colours: 0.3% x 5 of its max HP each second (Wet Blue Cloth makes it 9% more)',1e-6);
  a._talM[v.uid].col.until=V.now()+99; a.hp=10; V.dmg(a,1e12); assert.ok(a.alive,'Colours Never Fall: it stays at 1 HP'); secs(1.5); V.dmg(a,1e12); assert.ok(a.alive,'for 2 s');
  secs(0.6); V.dmg(a,1e12); assert.ok(!a.alive,'then not, and once a wave');
  const L2=lab(H,S(['st_1_4','st_2_4']),{foes:1,allies:2}), b=L2.A[0]; V.cast(L2.v,'blue'); secs(6.1); assert.ok(mark(L2,b,'col')); secs(5.4); assert.ok(mark(L2,b,'col'),'Bright Colours: 4 + 0.5 x 3 s'); secs(0.2); assert.ok(!mark(L2,b,'col'),'then gone');
});

test('Askel / Long Colours: March\'s shield also gives the Colours, 1 s per rank',()=>{
  const L=lab(H,S(['st_12_4']),{foes:3,allies:2}), {v,A}=L; MARCH(v); assert.ok(mark(L,A[0],'col')&&mark(L,A[1],'col'),'every ally it shields'); assert.ok(!mark(L,v,'col'),'(not himself)');
  secs(2.9); assert.ok(mark(L,A[1],'col'),'for 1 s x 3'); secs(0.2); assert.ok(!mark(L,A[1],'col'),'then gone');
});

test('Askel / Remembrance: Remember Them, Never Forgotten, The Last Post, Old Company, For the Fallen, Nineteen Men, Pole Strike (up to 5%), Bitter Memory, The Fourth Company',()=>{
  const L=lab(H,S(['st_1_1','st_3_1','st_5_1','st_6_1','st_7_1','st_9_1','st_9_2','st_11_1','st_12_1']),{foes:2,allies:3,big:true,cold:true}), {v,A,F}=L; const d0=v.dmg, a0=A[2].dmg, ls0=v.lifestealStat||0;
  V.step(2); assert.equal(stack(L,'rem'),2,'Old Company: 1 x 2 at the start of the fight'); near(v.dmg,d0*1.10,'Remember Them: 1% x 5 attack each'); near(A[2].dmg,a0*1.10,'and his allies');
  near(v.glyphCrit,0.05,'Pole Strike: 0.5% x 5 crit each, up to 5%'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.90,'Never Forgotten: 1% x 5 less each');
  near(hitOn(L,A[2],1000),plainHit(L,()=>hitOn(L,A[2],1000))*0.95,'Nineteen Men: his allies 0.5% x 5 less each');
  v.hp=v.maxHp*0.5; const h=v.hp; V.dmg(A[0],1e13); assert.ok(!A[0].alive); assert.equal(stack(L,'rem'),3,'an ally falls: 1 more'); near(v.hp-h,v.maxHp*0.09,'The Last Post: 3% x 3 of his max HP',1e-6);
  V.dmg(A[1],1e13); assert.equal(stack(L,'rem'),4); V.step(2); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.80,'Never Forgotten: up to 20%'); near(hitOn(L,A[2],1000),plainHit(L,()=>hitOn(L,A[2],1000))*0.90,'');
  near(v.glyphCrit,0.05,'Pole Strike stays at 5%'); assert.equal(L.T.st.rem.max,6,'The Fourth Company: up to 4 + 1 x 2');
  at(L,F[0],3,0); const gc=v.glyphCrit; v.glyphCrit=0; near(lost(F[0],()=>V.cast(v,'green',F[0])),plainHit(L,()=>lost(F[0],()=>V.cast(v,'green',F[0])))*1.20,'For the Fallen: his skills 1% x 5 more each'); v.glyphCrit=gc;
  v.hp=v.maxHp*0.35; V.step(1); near((v.lifestealStat||0)-ls0,0.10,'Bitter Memory: below 40% HP, 0.5% x 5 lifesteal each'); v.hp=v.maxHp; V.step(1); near((v.lifestealStat||0)-ls0,0,'');
  V.wave(); V.step(1); assert.equal(stack(L,'rem'),4,'Remembrance lasts the fight');
});

test('Askel / Raise the Standard: Standard Crash rallies the allies within 6 m for 2 s, and each enemy it interrupts gives Muster',()=>{
  const L=lab(H,S(['st_7_4','st_1_3']),{foes:2,allies:2}), {v,A,F}=L; for(const a of A) loose(a); const f=F[0]; at(L,f,3,0); free(f); f._pend={t:1,spell:true,fire(){}};
  at(L,F[1],0,3.2); free(F[1]); V.cast(v,'green',f); near(A[0].drMul,BAN(10),'rallied: the banner\'s slot'); near(A[0].drT,2,'for 2 s',1e-6); near(A[0].hasteMul,1.22,''); assert.ok(!(A[1].drT>0),'not 7 m away');
  assert.equal(stack(L,'mus'),1,'one enemy had a cast under way: 1 Muster (the other was only hit)');
});

test('Askel / The Banner Had His Face (SIGNATURE): at 10 Muster the standard goes up for the rest of the wave; half-strength rally and the Colours near it; a shield on every ally; it stays if he falls',()=>{
  const L=lab(H,S(['st_13_3','st_1_3','st_1_4']),{foes:1,allies:2,big:true}), {v,A,F}=L; at(L,F[0],14,0); for(const a of A) loose(a); const b=A[1];
  setStack(L,'mus',8); V.cast(v,'blue'); assert.ok(!L.T.s.std,'9: not yet'); setStack(L,'mus',9); V.cast(v,'blue'); assert.ok(L.T.s.std,'10: the standard goes up');
  near(b.shield,v.maxHp*0.10,'every ally on the field a shield of 10% of his max HP'); const sx=v.x, sy=v.y; at(L,b,-7,0); V.step(2);
  near(b.drMul,1-(1-BAN(10))/2,'an ally within 6 m of it (not rallied by the ground itself): Rallying Ground at half strength'); near(b.hasteMul,1.11,''); assert.ok(mark(L,b,'col'),'and the Colours');
  v.x+=12*V.METER; V.step(2); near(b.drMul,1-(1-BAN(10))/2,'it does not move with him'); v.x=sx;
  b.x=sx; b.y=sy-25*V.METER; V.step(1); const left=(()=>{ const m=b._talM[v.uid].col; return m.until-V.now(); })(); near(left,4,'the Colours 4 s after it leaves',0.05);
  b.x=sx-7*V.METER; b.y=sy; V.dmg(v,1e15); assert.ok(!v.alive,'he falls'); b.drT=0; b.drMul=1; b.hasteT=0; b.hasteMul=1; secs(2); near(b.drMul,1-(1-BAN(10))/2,'the standard keeps rallying'); assert.ok(b.drT>0,'');
  V.wave(); V.step(2); b.drT=0; b.drMul=1; secs(1); near(b.drMul,1,'until the wave ends');
});

/* ============================== THE CHARGE ============================== */
test('Askel / Rut: Rut, Season of Rut, Snort, Rutting Strength, Bull\'s Patience, Spent Rut',()=>{
  const L=lab(H,S(['ch_1_1','ch_2_1','ch_4_1','ch_8_1','ch_3_1','ch_10_1']),{foes:3,big:true}), {v,F}=L; const d0=v.dmg;
  at(L,F[0],3,0); at(L,F[1],0,3.1); V.cast(v,'green',F[0]); assert.equal(stack(L,'rut'),2,'each enemy Standard Crash hits: 1 Rut'); V.step(1); near(v.dmg,d0*1.03,'Snort: 0.3% x 5 attack each');
  near(lost(F[2],()=>V.hit(v,F[2],1000,{kind:'true',auto:true})),plainHit(L,()=>lost(F[2],()=>V.hit(v,F[2],1000,{kind:'true',auto:true}))),'Rutting Strength: not below 3');
  setStack(L,'rut',3); near(lost(F[2],()=>V.hit(v,F[2],1000,{kind:'true',auto:true})),plainHit(L,()=>lost(F[2],()=>V.hit(v,F[2],1000,{kind:'true',auto:true})))*1.15,'at 3 Rut his basic attacks 3% x 5 more');
  near(FX.cd(v,'green',8),8,'Bull\'s Patience: not below 6'); setStack(L,'rut',6); near(FX.cd(v,'green',8),6,'at 6 Rut, Standard Crash 2 s shorter');
  setStack(L,'rut',0); at(L,F[0],3,0); at(L,F[1],0,3.1); V.cast(v,'green',F[0]); secs(18.8); assert.equal(stack(L,'rut'),2,'Season of Rut: they last 10 + 3 x 3 s after the last'); secs(0.3); assert.equal(stack(L,'rut'),0);
  setStack(L,'rut',4); v.hp=v.maxHp*0.5; const h=v.hp; const d=MARCH(v); assert.equal(stack(L,'rut'),0,'March spends them all'); near(v.hp-h,v.maxHp*0.025*4,'Spent Rut: 0.5% x 5 of his max HP for each',1e-6);
  const d2=plainHit(L,()=>MARCH(v)); const base=plainHit(L,()=>lost(F[2],()=>d2.run())), got=lost(F[2],()=>d.run()); near(got,base*(1+0.15*4),'Rut: his March 3% x 5 more for each Rut spent',1e-6);
});

test('Askel / March of the Greatbrow: Moose Charge, Charge Weight, First Charge, Second Charge (up to 4), Rut Season, Charge Hide; Rut up to 90%',()=>{
  const place=P=>{ at(P,P.F[2],16,0); at(P,P.F[3],12.5,3); at(P,P.F[4],12.5,-3); at(P,P.F[5],14,4.5); at(P,P.F[1],12.5,0); free(P.F[2]); };
  let base=0; plain({foes:6,big:true},P=>{ place(P); base=lost(P.F[2],()=>march(P,true)); });
  const L=lab(H,S(['fd_7_3','ch_7_3','ch_6_4','ch_11_1','ch_12_1','ch_9_3','ch_1_1']),{foes:6,big:true}), {v,F}=L; place(L); v.energy=0;
  const g1=lost(F[2],()=>march(L,true)); near(g1,base*1.15*1.15*1.20,'Moose Charge 3% x 5, Charge Weight 3% x 5, First Charge 10% x 2 on his first March',1e-6);
  near(v.energy,20,'Second Charge: 1 x 5 energy for each enemy it hits, up to 4 (5 hit)',1e-9); near(F[2].stunned,2*V.ccNerf+0.3,'Rut Season: the stun 0.1 s x 3 longer, in full',1e-9);
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.075),'Charge Hide: 1.5% x 5 less for 3 s after it lands'); secs(3.05); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'');
  place(L); const g2=lost(F[2],()=>march(L,true)); near(g2,base*1.15*1.15,'First Charge: only the first',1e-6);
  setStack(L,'rut',6); place(L); const g3=lost(F[2],()=>march(L,true)); near(g3,base*1.15*1.15*1.90,'6 Rut: 90%',1e-6);
});

test('Askel / Flattened: Flatten, Trampled, Broad Path, Dust of the Charge, Hunt the Fallen, Crushed Underfoot; Stampede',()=>{
  const L=lab(H,S(['ch_1_4','ch_3_4','ch_5_4','ch_7_4','ch_10_4','ch_12_4']),{foes:3,allies:1,big:true}), {v,A,F}=L; const f=F[0], s0=f.speed, i0=f.atkInterval;
  march(L); assert.ok(mark(L,f,'flat')&&mark(L,F[1],'flat'),'the enemies March knocks aside are Flattened'); assert.ok(!mark(L,F[2],'flat'),'not the one it lands on');
  V.step(1); near(f.speed,s0*0.85,'5% x 3 slower'); near(f.atkInterval,i0/0.91,'Dust of the Charge: attacks 3% x 3 slower',1e-6);
  near(lost(f,()=>V.hit(A[0],f,1000,{kind:'true'})),plainHit(L,()=>lost(f,()=>V.hit(A[0],f,1000,{kind:'true'})))*1.06,'his allies deal 2% x 3 more to it');
  near(lost(f,()=>V.hit(v,f,1000,{kind:'true'})),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000,{kind:'true'})))*1.10,'Hunt the Fallen: he deals 2% x 5 more');
  near(hitOn(L,A[0],1000,{src:f}),plainHit(L,()=>hitOn(L,A[0],1000,{src:f}))*0.925,'Broad Path: it deals 1.5% x 5 less'); near(hitOn(L,v,1000,{src:f}),plainHit(L,()=>hitOn(L,v,1000,{src:f}))*0.925,'to him too');
  const m=f._talM[v.uid].flat; near(m.until-m.t0,6.5,'Trampled: 4 + 0.5 x 5 s',1e-6);
  free(f); f.hp=f.maxHp*0.2; free(F[1]); secs(m.until-V.now()-0.1); assert.ok(mark(L,f,'flat')&&!(f.stunned>0)); secs(0.15); assert.ok(!mark(L,f,'flat'),'then it ends');
  near(f.stunned,0.6,'Crushed Underfoot: below 30% HP when it ends, stunned 0.3 s x 2 (in full)',0.08); const m1=F[1]._talM[v.uid].flat; secs(Math.max(0,m1.until-V.now())+0.1); assert.ok(!mark(L,F[1],'flat')); assert.ok(!(F[1].stunned>0),'(one above 30% when its own ends: no)');
  const L2=lab(H,S(['ch_9_4','ch_1_4']),{foes:3}); free(L2.F[2]); march(L2); assert.ok(mark(L2,L2.F[2],'flat'),'Stampede: the one it lands on is Flattened too'); assert.equal(ust(L2,L2.F[2],'gore'),2,'and Gored twice');
});

test('Askel / Gored: Gore, Deep Gore, Gorer, Antler Wounds, Splintered Armor, Pin to the Ground with Hold Them Down',()=>{
  const L=lab(H,S(['ch_2_2','ch_4_2','ch_8_2','ch_6_2','ch_10_2','ch_5_3','ch_6_3']),{foes:3,big:true}), {v,F}=L; const f=F[0], a0=f.armorRating, m0=f.mrRating, s0=f.speed;
  near(lost(f,()=>V.hit(v,f,1000,{kind:'true'})),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000,{kind:'true'}))),'not Gored yet');
  V.hit(v,f,10,{kind:'true',crit:true}); assert.equal(ust(L,f,'gore'),1,'a critical hit Gores'); V.step(1); near(f.armorRating,a0*0.90,'2% x 5 less armor'); near(f.mrRating,m0*0.95,'Splintered Armor: 1% x 5 less magic resist');
  V.hit(v,f,10,{kind:'true',crit:true}); V.step(1); assert.equal(ust(L,f,'gore'),2,'twice'); near(f.armorRating,a0*0.80,'stacks twice'); near(f.speed,s0,'Pin to the Ground: not on the gore that makes two');
  near(lost(f,()=>V.hit(v,f,1000,{kind:'true'})),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000,{kind:'true'})))*1.075,'Antler Wounds: 1.5% x 5 more');
  near(lost(f,()=>V.hit(v,f,1000,{kind:'true',crit:true})),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000,{kind:'true',crit:true})))*1.075*1.15,'Gorer: his crits on it 3% x 5 more');
  V.step(1); near(f.speed,0,'Pin to the Ground: Gored twice and Gored again: rooted'); secs(1.5); near(f.speed,0,'1 + 0.2 x 3 s'); secs(0.15); near(f.speed,s0,'then free');
  secs(4.6); assert.equal(ust(L,f,'gore'),2,'Deep Gore: 5 + 0.5 x 3 s after the last'); secs(0.3); assert.equal(ust(L,f,'gore'),0); V.step(1); near(f.armorRating,a0,'its armor back');
  at(L,F[1],3,0); at(L,F[2],0,3.1); V.cast(v,'green',F[1]); assert.equal(ust(L,F[1],'gore'),1,'Standard Crash Gores its target'); assert.equal(ust(L,F[2],'gore'),0,'not the others');
});

test('Askel / Crash of Antlers: every enemy it hits is Gored, one it interrupts twice; Lift and Toss (PICK ONE): knocked up (stunned) 0.6 s',()=>{
  const L=lab(H,S(['ch_11_2']),{foes:2}), {v,F}=L; at(L,F[0],3,0); at(L,F[1],0,3.1); free(F[1]); F[1]._pend={t:1,spell:true,fire(){}};
  V.cast(v,'green',F[0]); assert.equal(ust(L,F[0],'gore'),1,'every enemy it hits'); assert.equal(ust(L,F[1],'gore'),2,'an enemy it interrupts: twice');
  const L2=lab(H,S(['ch_5_2','ch_2_2']),{foes:2}); at(L2,L2.F[0],3,0); at(L2,L2.F[1],0,3.1); for(const f of L2.F) free(f); setUst(L2,L2.F[0],'gore',2); setUst(L2,L2.F[1],'gore',1);
  V.cast(L2.v,'green',L2.F[0]); near(L2.F[0].stunned,0.6,'Gored twice: stunned 0.6 s by the next Standard Crash, in full',1e-9); near(L2.F[1].stunned,0,'Gored once: no');
});

test('Askel / Greatbrow Comes Down the River (SIGNATURE): an interrupt at 6 Rut readies March at once; that charge counts double Rut (90% at most), Gores twice, Flattens; once every 25 s',()=>{
  let base=0; plain({foes:3,big:true},P=>{ free(P.F[2]); base=lost(P.F[2],()=>march(P)); });
  const L2=lab(H,S(['ch_13_2','ch_1_1']),{foes:3,big:true}), w=L2.v, F2=L2.F; at(L2,F2[0],3,0); free(F2[0]); F2[0]._pend={t:1,spell:true,fire(){}}; free(F2[2]);
  setStack(L2,'rut',4); w.energy=0; V.cast(w,'green',F2[0]); near(w.energy,0,'not below 6 Rut (4, and 5 with this slam\'s own)'); assert.equal(stack(L2,'rut'),5);
  F2[0]._pend={t:1,spell:true,fire(){}}; F2[0].silencedT=0; V.cast(w,'green',F2[0]); near(w.energy,100,'6 with this slam\'s own Rut: March is ready again at once'); assert.ok(win(L2,'gbr'));
  at(L2,F2[0],4.5,0); setStack(L2,'rut',2); const g=lost(F2[2],()=>march(L2)); near(g,base*(1+0.15*4),'2 Rut counted double',1e-6);
  assert.equal(ust(L2,F2[2],'gore'),2,'every enemy it touches Gored twice'); assert.equal(ust(L2,F2[0],'gore'),2,'(the knocked aside too)'); assert.ok(mark(L2,F2[2],'flat'),'and Flattened');
  assert.ok(!win(L2,'gbr'),'one charge'); setStack(L2,'rut',6); F2[0]._pend={t:1,spell:true,fire(){}}; F2[0].silencedT=0; at(L2,F2[0],3,0); w.energy=0; V.cast(w,'green',F2[0]); near(w.energy,0,'once every 25 s');
  const L3=lab(H,S(['ch_13_2','ch_1_1']),{foes:3,big:true}); free(L3.F[2]); L3.T.s.w.gbr={t:30,n:1,cdT:0,at:-1,wave:false}; setStack(L3,'rut',6); const g6=lost(L3.F[2],()=>march(L3)); near(g6,base*1.90,'6 Rut doubled: still 90%',1e-6);
});

test('Askel / Hard Hooves, Antler Tip, Bull Strength, Lowered Antlers, Bull\'s Fury, Restless',()=>{
  const L=lab(H,S(['fd_8_3','fd_9_3','ch_9_1','ch_n1','ch_11_3','ch_6_1']),{foes:2,big:true}), {v,F}=L; const f=F[0];
  assert.equal(stack(L,'rut'),6,'Restless: 2 x 3 Rut at the start of the wave');
  near(hitOn(L,v,1000,{crit:true}),plainHit(L,()=>hitOn(L,v,1000,{crit:true}))*0.90,'Hard Hooves: 2% x 5 less from critical hits'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'not a normal hit');
  const ar=VMX('(s,t)=>{ const a=defMul(s,t,"phys"); const k=s._wpnArmIgn; s._wpnArmIgn=1-(1-(k||0))*(1-0.10); const b=defMul(s,t,"phys"); s._wpnArmIgn=k; return b/a; }')(v,f)**2;
  assert.ok(ar>1.001,'(it has armor to ignore)');
  near(lost(f,()=>V.hit(v,f,1000)),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000)))*ar*1.10,'Antler Tip and Bull Strength: 2% x 5 of its armor each; Lowered Antlers: 2% x 5 more above 75% HP',1e-6);
  f.hp=f.maxHp*0.7; near(lost(f,()=>V.hit(v,f,1000)),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000)))*ar,'not at 70%',1e-6);
  v.hp=v.maxHp*0.45; near(lost(f,()=>V.hit(v,f,1000)),plainHit(L,()=>lost(f,()=>V.hit(v,f,1000)))*ar*1.15,'Bull\'s Fury: below 50% HP, 3% x 5 more',1e-6);
});

/* ============================== THE FORD: signature, March Through the Ford ============================== */
test('Askel / The Ford at Hask (SIGNATURE): a Herd ally dropping below 25%: 4 s of 50% less, cannot be moved or held, its holds land on him at half length, 5 Steadfast; once every 25 s',()=>{
  const L=lab(H,S(['fd_13_2','fd_10_4']),{foes:1,allies:2,big:true}), {v,A,F}=L; const a=A[0]; a.maxHp=1e6; a.hp=3e5; V.step(2); assert.ok(mark(L,a,'hd'));
  const slot=a.drT>0?a.drMul:1; v.hp=v.maxHp*0.5; const h=v.hp; const l=lost(a,()=>V.hit(F[0],a,1e5,{kind:'true'})); near(l,1e5*slot*0.5,'the hit that would take it below 25%: 50% less');
  assert.ok(win(L,'hask')); assert.equal(stack(L,'sf'),5,'5 Steadfast'); near(v.hp-h,v.maxHp*0.025*5,'(Stand Your Ground for each)',1e-6);
  V.step(1); assert.equal(a.stunned,0,'cannot be held'); assert.ok(a._gearImmovableT>0.05,'cannot be moved');
  v.fearT=0; V.cc(F[0],a,'fearT',2); near(a.fearT,0,'a fear meant for it'); near(v.fearT,2*V.ccNerf*0.5,'lands on him at half length',1e-9);
  near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000)),'not an ally outside the Herd');
  secs(4.1); assert.ok(!win(L,'hask')); a.hp=3e5; const l2=lost(a,()=>V.hit(F[0],a,1e5,{kind:'true'})); assert.ok(l2>1e5*0.6*(a.drT>0?a.drMul:1),'once every 25 s');
});

test('Askel / March Through the Ford: allies within 4 m when he charges count as Herd for 6 s wherever they are, and its shield is 50% larger on them',()=>{
  const L=lab(H,S(['fd_11_2','fd_1_1']),{foes:3,allies:2}), {v,A}=L; march(L);
  near(A[0].shield,A[0].maxHp*0.18,'its shield 50% larger on the ally within 4 m'); near(A[1].shield,A[1].maxHp*0.12,'not on one 7 m away');
  at(L,A[0],0,-30); V.step(1); assert.ok(mark(L,A[0],'hd'),'Herd wherever it is'); assert.equal(stack(L,'herd'),1);
  secs(5.0); assert.ok(!mark(L,A[0],'hd'),'for 6 s');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Askel: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['fd_1_1','fd_1_4','fd_2_2','fd_4_3','st_1_3','st_1_4','st_1_1','ch_1_1','ch_2_2','ch_1_4']), TEAM=['vael','sylthaine','vireo','vex','askel'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]}))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let gore=0, flat=false, col=false;
  for(let i=0;i<3000&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of units()){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(f.team==='enemy'){ if(o.flat&&o.flat.until>V.now()) flat=true; if(o['#gore']&&o['#gore'].until>V.now()) gore=Math.max(gore,o['#gore'].v); } else if(o.col&&o.col.until>V.now()) col=true; } }
  assert.ok(mx.herd>=1,'real allies made a Herd: '+mx.herd); assert.ok(mx.mus>=1,'real Rallying Grounds mustered: '+mx.mus); assert.ok(mx.rut>=1,'real Crashes gave Rut: '+mx.rut);
  assert.ok(gore>=1,'real crits and Crashes Gored: '+gore); assert.ok(col,'real grounds gave the Colours'); assert.ok(flat||mx.sf>=1,'a real March Flattened, or a real control on an ally gave Steadfast');
  determinism(H,TEAM);
});

/* The page sites his talents added (the 'pass' hook at Unshaken Herd's cover and at the charge's knock-aside, landPre / land around the charge's slam, the 'fallen'
   line after the tick hook, one bindMore line): with nothing learned, whole seeded fights with Askel in the line-up are identical to the pre-talent page (ee8edab8),
   seed by seed. tests/talents-fight.test.js does the same for line-ups without him. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Askel: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['askel','vael','vireo','sylthaine','gruel'], foeTeam=['bloatus','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __akN={cover:0,charge:0,knock:0,dead:0}; var __akD=_doEffectCore, __akP=firePassiveFx;'+
    'firePassiveFx=function(u){ if(u&&u.key==="askel") __akN.cover++; return __akP.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ const me=u&&u.key==="askel"&&type==="charge", g0=me?groundHazards.length:0; const r=__akD.apply(this,arguments); if(me){ __akN.charge++; if(groundHazards.length>g0) __akN.knock++; } return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      const g0=f(NOW,a); if(VMX('units').some(u=>u.key==='askel'&&!u.alive)) VMX('__akN').dead++; assert.equal(g0,f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__akN'); console.log('  identity: Unshaken Herd covered '+c.cover+' times, March '+c.charge+' times (with knocks on the path '+c.knock+'), Askel fell in '+c.dead+' fights');
    assert.ok(c.cover>0&&c.charge>0&&c.knock>0,'the fights covered held allies ('+c.cover+') and charged ('+c.charge+', knocking enemies aside '+c.knock+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__akD; firePassiveFx=__akP;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ fd:['fd_1_1','fd_10_1','fd_7_4','fd_7_1','fd_8_3','fd_11_3','fd_5_3','fd_6_3','fd_1_3','fd_3_3','fd_6_1','fd_12_1','fd_1_4','fd_12_2'],
            st:['st_1_3','st_3_1','st_n1','st_2_3','st_8_3','st_6_1','st_12_1','st_10_2','st_3_2','st_1_1'],
            ch:['ch_9_3','ch_5_4','ch_1_4'] };
function defensive(order){ let b={r:{}}; const want=[].concat(...order.map(k=>DEF[k])), meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, goals=[]; for(const id of want) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
    if(id){ b=T.learn(H,b,id,100).build; continue; }
    const open=goals.find(x=>(b.r[x]|0)<meta(x).ranks), tree=open?meta(open).treeIdx:null;
    const pool=T.trees(H).map((tr,i)=>tr.talents.filter(t=>(tree==null||i===tree)&&!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1]||x[2]-y[2]);
    const any=pool[0]||T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (4 Herd, 16 Muster, 6 Remembrance, 5 Steadfast, 3 held allies within 6 m, Wade
   Across speeding him, below 50% HP, a Rallying Ground of his standing with its slot at level 100 and Mustered Strength, Charge Hide's window; the attacker is one he
   silenced and Flattened), as a normal hit and as a critical one. Measured through the engine: what reaches his HP and shield against the hit.
   sustained: what holds most of a fight for this build (2 Herd, 10 Muster, Old Company's Remembrance, his ground standing 60% of the time is left out: no banner) */
function worstHit(list,kind,crit,sus){ const L=lab(H,list,{foes:3,allies:3,cold:true}), {v,A,F}=L; V.step(1); const f=F[0], now=V.now();
  ringAllies(L,A,2,[180,240,300]); V.step(1);
  if(L.T){ const M=x=>(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={});
    if(sus){ setStack(L,'herd',2); setStack(L,'mus',10); setStack(L,'rem',L.T.r.st_6_1||0); }
    else { setStack(L,'herd',4); setStack(L,'mus',16); setStack(L,'rem',6); setStack(L,'sf',5); for(const a of A) M(a).held={t0:now,until:1e9,v:0}; M(f).shs={t0:now,until:1e9,v:0}; M(f).flat={t0:now,until:1e9,v:0};
      L.T.s.w.chd={t:99,n:1,cdT:0,at:-1,wave:false}; (L.T.s.zn.rg=[]).push({x:v.x,y:v.y,r:6*V.METER,until:1e9,centre:true}); } }
  if(!sus){ const o=Object.assign({},VMX('KITS').askel.blue); if(L.T&&L.T.r.st_8_3) o.dr-=0.01*L.T.r.st_8_3; v.drMul=VMX('skLvNum')('banner',o,100); v.drT=99; }
  v.maxHp=1e5; v.hp=sus?9e4:4e4; v.shield=1e12; v.shieldT=999;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Askel: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[['fd','st','ch'],['st','fd','ch'],['fd','ch','st'],['ch','fd','st'],['st','ch','fd']].map(o=>{ const b=defensive(o); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), sus=Math.max(...['magic','phys'].map(k=>worstHit(best.list,k,false,true))), sus0=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0,all:[],top:[],shUp:0,sh0:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="askel"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); __dr.sh0=tgt.shield||0; __dr.hp0=tgt.hp; tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if((tgt.shield||0)>__dr.sh0){ __dr.shUp++; } else if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; __dr.all.push(d); if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85){ __dr.hi++; if(__dr.top.length<6) __dr.top.push({src:src.key,amt:Math.round(amt),raw:+raw.toFixed(1),lost:+l.toFixed(2),h0:Math.round(h0),sh0:Math.round(__dr.sh0),sh:Math.round(tgt.shield||0),hpB:Math.round(__dr.hp0),crit:!!_preCrit,ev:tgt.evaStat||0,blk:tgt.blockStat||0,hp:Math.round(tgt.hp),max:Math.round(tgt.maxHp),kind:kind||null,dr:tgt.drT>0?+tgt.drMul.toFixed(3):1,d:+d.toFixed(3)}); } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="askel"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','askel'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'), all=d.all.slice().sort((x,y)=>x-y), q=p=>all.length?all[Math.min(all.length-1,Math.floor(p*all.length))]:0;
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%);'+
      ' sustained (2 Herd, 10 Muster, Old Company, above half, no banner) '+(sus*100).toFixed(1)+'% (no talents '+(sus0*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, median '+(q(0.5)*100).toFixed(1)+'%, 90th percentile '+(q(0.9)*100).toFixed(1)+'%, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks+' (hits during which a shield was put on him, not counted: '+d.shUp+'); the most reduced: '+JSON.stringify(d.top));
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
