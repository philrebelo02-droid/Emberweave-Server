'use strict';
/* Meridian's talents as data on the mechanics layer (talents-mech/meridian.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added (the foiled hook at the shield wall, Evasion and the two Block lines; the momCap line), and Phil's
   95% damage-reduction ceiling. Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured
   with his talents switched off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Meridian, centre to centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6); A0 (0,-5.5). His body is 1.56 m, a Vael's 2.01 m,
   so F0 stands 0.9 m from him body to body. The lab's skill level is 10: Well-Read's full ramp there is +52.25%.
   His skills all reach (tests/meridian-kit-facts.js: Golden Quill struck its farthest target in 101 of 101 casts; Plumb Line landed 103 of 103), so no
   place below works around a broken skill.
   Run: node --test tests/talents-mech-meridian.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='meridian', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:dur==null?null:V.now()+dur,v:0}; };
const left=(L,t,name)=>{ const m=t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]; return m&&m.until!=null?m.until-V.now():(m?Infinity:0); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const openWin=(L,name,d)=>{ L.T.s.w[name]={t:d||9,n:1,cdT:0,at:-1,wave:false}; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const md=L=>L.T.s.md||(L.T.s.md={});
const brnd=x=>VMX('var __mbr=(typeof __mbr!=="undefined"&&__mbr)?__mbr:brnd; brnd=function(){ return '+x+'; };');
const brndBack=()=>VMX('if(typeof __mbr!=="undefined"&&__mbr){ brnd=__mbr; __mbr=null; }');
const CAP=()=>VMX('SKLV.momentumCap(10)');
const fullRamp=L=>{ L.v._momStk=CAP(); };
/* the lab with every foe placed again; o.far: every foe more than 4 m from his body (Sightline gains) */
function ml(list,o){ o=o||{}; const L=lab(H,list,Object.assign({},o,{cold:true,big:o.big}));
  const P=o.far?[[12,0],[16,0],[20,0],[12,8],[16,8]]:[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6]]; L.F.forEach((f,i)=>{ if(P[i]) at(L,f,P[i][0],P[i][1]); });
  if(o.pre) o.pre(L); V.step(1); return L; }
const tHit=(L,t,amt,o)=>lost(t,()=>V.hit(L.v,t,amt||1000,Object.assign({kind:'true'},o||{})));
const ratio=(L,t,o)=>tHit(L,t,1000,o)/plainHit(L,()=>tHit(L,t,1000,o));
function skillRatio(L,t,skill,o){ const s=L.T.s, keep=s.cur; s.cur=skill; let a; try{ a=tHit(L,t,1000,o); } finally{ s.cur=keep; } return a/plainHit(L,()=>tHit(L,t,1000,o)); }
const hitOn=(L,amt,o)=>{ const v=L.v, h=v.hp, s=v.shield; const r=lost(v,()=>V.hit((o&&o.src)||L.F[0],v,amt||100,Object.assign({kind:'true'},o||{}))); v.hp=h; v.shield=s; v.energy=0; return r; };
const inRatio=(L,o)=>hitOn(L,100,o)/plainHit(L,()=>hitOn(L,100,o));
const castLost=(L,slot,t)=>lost(t,()=>V.cast(L.v,slot,t));
const castRatio=(L,slot,t)=>{ const a=castLost(L,slot,t); return a/plainHit(L,()=>castLost(L,slot,t)); };
const kill=(L,t,skill)=>{ const s=L.T.s, k=s.cur; s.cur=skill||null; t.hp=1; t.shield=0; try{ V.hit(L.v,t,100,{kind:'true'}); } finally{ s.cur=k; } assert.ok(!t.alive,'it died'); };
/* a Plumb Line from its PRESS: the launch picks its target (skillTgt), the shot lands 0.12 - 0.8 s later */
const launch=(L,t)=>{ VMX('(function(u,t){ u.target=t; u._castSlot="blue"; u._castLv=10; u._castSM=skillMul(10); try{ doEffect(u,"plumbline",u.blueAb); } finally{ u._castSlot=null; u._castSM=1; u._castLv=0; } })')(L.v,t); secs(0.9); };
const myFs=(L,t)=>(t.dots||[]).filter(d=>d._talO===L.v.uid&&d._talK==='fs'&&d.remaining>0);
const atkI=L=>L.v.atkInterval;
const rel=(a,b,msg,tol)=>assert.ok(Math.abs(a/b-1)<=(tol||1e-6),(msg||'')+': '+a+' vs '+b);

test('Meridian: every talent is accounted for - 7 plain stats, 115 with rows, none waiting',()=>{
  accounting(H,[122,7,115,0,0]);
  const M=FXN.mech(H); for(const id of ['ls_1_1','gi_1_1','ty_1_1','ls_13_1','gi_13_2','ty_13_1','ls_1_2','gi_8_3']) assert.ok(M.talents[id],id);
  for(const id of ['ls_7_2','ls_9_2','gi_12_3','gi_1_3','ty_3_2','ty_7_2','ty_1_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['ls_1_2','gi_8_3']) assert.ok(!FXN.has(H,id),id+': a crit talent is a row (the 5% crit group), no longer a plain stat');
});

test('Meridian: his real kit, as the talents read it - Golden Quill\'s line to the farthest, Plumb Line\'s long shot, Final Expedition, Well-Read',()=>{
  let L=ml(null,{foes:3}); const [F0,F1,F2]=L.F; const a=[F0,F1,F2].map(f=>f.hp); V.cast(L.v,'green',F0); assert.ok([F0,F1,F2].every((f,i)=>f.hp<a[i]),'the Quill strikes every enemy on its line to the farthest');
  at(L,F0,4.5,6); const b0=F0.hp, b2=F2.hp; V.cast(L.v,'green',F0); assert.equal(F0.hp,b0,'off the line: not struck'); assert.ok(F2.hp<b2);
  L=ml(null,{foes:2}); const n0=castLost(L,'blue',L.F[0]), n1=castLost(L,'blue',L.F[1]); near(n1/n0,1.9/(1+0.9*4.5/8),'Plumb Line: 1 + 0.9 x distance / 8 m',1e-6);
  L=ml(null,{foes:2}); V.cast(L.v,'ult',L.F[0]); for(const f of L.F){ near(f.mortalT,3,'Mortal Wound 3 s'); assert.ok(f.dots.some(d=>d.src===L.v&&d.remaining===3),'a 3 s bleed of his'); }
  near(L.v._lifestealPct,0.35,'lifesteal 35%'); near(L.v._lifestealT,3,'for 3 s'); assert.ok(L.v.hots.length>0,'a heal over time on him');
  near(CAP(),0.5225,'Well-Read at the lab level: +52.25%'); near(VMX('SKLV.momentumCap(100)'),0.7475,'and +74.75% at 100');
});

test('Meridian / Sightline: Clear Sightline (1 a second, max 5, broken by an enemy within 4 m), Patient Sighting, Held Breath; spent by Plumb Line (3% x 5 each), Long Sightline',()=>{
  let L=ml(S(['ls_1_1']),{foes:2,far:true}); secs(1.05); assert.equal(stack(L,'mdSight'),1); secs(5); assert.equal(stack(L,'mdSight'),5,'max 5'); secs(1.1); assert.equal(stack(L,'mdSight'),5,'(still 5)');
  at(L,L.F[0],7.3,0); V.step(1); assert.equal(stack(L,'mdSight'),0,'3.7 m from his body: broken');
  at(L,L.F[0],5,0); V.step(1); assert.equal(stack(L,'mdSight'),0,'an enemy within 4 m of his body breaks it'); secs(1.1); assert.equal(stack(L,'mdSight'),0,'and it stays broken while it stands there');
  at(L,L.F[0],12,0); setStack(L,'mdSight',5); const r=castRatio(L,'blue',L.F[1]); near(r,1+0.03*5*5,'5 Sightings spent: 75% more'); assert.equal(stack(L,'mdSight'),0,'all spent');
  L=ml(S(['ls_1_1','ls_2_1']),{foes:2,far:true}); secs(2.6); assert.equal(stack(L,'mdSight'),3,'45% faster: 3 in 2.6 s');
  L=ml(S(['ls_1_1','ls_2_1','ls_3_1']),{foes:2,far:true}); at(L,L.F[0],5,0); secs(1.5); assert.ok(stack(L,'mdSight')>=2,'Held Breath: an enemy close by no longer breaks it');
  const s0=stack(L,'mdSight'); hitOn(L,10); secs(0.9); assert.equal(stack(L,'mdSight'),s0,'it pauses while he is being hit'); secs(1.0); assert.ok(stack(L,'mdSight')>s0,'and goes on a second after');
  L=ml(S(['ls_1_1','ls_8_1']),{foes:2,far:true}); L.v.blueCd=6; setStack(L,'mdSight',4); V.cast(L.v,'blue',L.F[1]); near(L.v.blueCd,6-0.75*4,'Long Sightline: 0.75 s a Sighting');
  FX.cd(L.v,'blue',6); L.v.blueCd=6; setStack(L,'mdSight',5); V.cast(L.v,'blue',L.F[1]); near(L.v.blueCd,3,'never below 3 s');
});

test('Meridian / Steady Sighting and Breathless Shot (the crit group), Survey Complete',()=>{
  let L=ml(S(['ls_1_1','ls_6_1']),{foes:2,far:true}); setStack(L,'mdSight',2); V.step(1); near(L.v.glyphCrit,0.004*5*2,'2% a Sighting');
  setStack(L,'mdSight',5); V.step(1); near(L.v.glyphCrit,0.05,'at most 5% (the crit group)');
  L=ml(S(['ls_1_1','ls_7_1']),{foes:2,far:true}); setStack(L,'mdSight',5); const cr=1+Math.max(0,(L.v.critDmg||0.6)-(L.F[1].critRes||0));
  const a=castLost(L,'blue',L.F[1]), b=plainHit(L,()=>castLost(L,'blue',L.F[1])); near(a/b,1.75*cr,'5 Sightings spent: a guaranteed critical hit',1e-3);
  setStack(L,'mdSight',4); const c=castLost(L,'blue',L.F[1]); near(c/plainHit(L,()=>castLost(L,'blue',L.F[1])),1.6,'4: not',1e-3);
  L=ml(S(['ls_1_1','ls_12_2']),{foes:2,far:true}); kill(L,L.F[1],'plumbline'); assert.equal(stack(L,'mdSight'),5,'a Plumb Line kill: 1 a rank');
  L=ml(S(['ls_1_1','ls_12_2']),{foes:2,far:true}); kill(L,L.F[1],null); assert.equal(stack(L,'mdSight'),0,'not another kill');
});

test('Meridian / Triangulation: Golden Quill + Plumb Line within 4 s (4% x 3), Three Points, Fixed Position, Fixed Star, Grid Reference',()=>{
  const L=ml(S(['ls_1_4','ls_4_4','ls_2_4','ls_5_4','ls_9_4']),{foes:2}); const [F0,F1]=L.F, sp=F0.speed, d0=L.v.dmg;
  V.cast(L.v,'green',F1); assert.ok(!mark(L,F1,'mdTri')); V.cast(L.v,'blue',F1); assert.ok(mark(L,F1,'mdTri'),'Triangulated'); assert.ok(!mark(L,F0,'mdTri'));
  near(left(L,F1,'mdTri'),5.5,'4 s + 1.5 s'); near(ratio(L,F1),1.12,'12% more'); near(ratio(L,F0),1,'not on another');
  near(ratio(L,F1,{crit:true}),1.12*1.10,'Fixed Star: its crits 10% more'); V.step(2); near(F1.speed/sp,0.85,'Fixed Position: 15% slower'); near(F0.speed,sp);
  near(L.v.dmg/d0,1.04,'Grid Reference: 0.8% x 5 for one'); secs(5.6); assert.ok(!mark(L,F1,'mdTri'),'it ends'); V.step(2); near(F1.speed,sp,'and so does the slow');
  V.cast(L.v,'green',F1); secs(4.2); V.cast(L.v,'blue',F1); assert.ok(!mark(L,F1,'mdTri'),'4.2 s apart: no');
  V.cast(L.v,'blue',F0); secs(1); V.cast(L.v,'green',F0); assert.ok(mark(L,F0,'mdTri'),'either order');
});

test('Meridian / Two Fixed Points (LINK: 6 s with Triangulate; 8% on the first Plumb Line on each Charted enemy), Gilded Line, Final Bearing, Bearing Kept',()=>{
  let L=ml(S(['ls_1_4','gi_1_1','gi_n1']),{foes:2}); const [F0,F1]=L.F; V.cast(L.v,'green',F1); secs(5); V.cast(L.v,'blue',F1); assert.ok(!mark(L,F1,'mdTri'),'not the 2nd newly Charted (F1 after F0 in the field order): 4 s');
  V.cast(L.v,'green',F1); secs(1); V.cast(L.v,'blue',F1); assert.ok(mark(L,F1,'mdTri'));
  L=ml(S(['ls_1_4','gi_1_1','gi_n1']),{foes:2}); V.cast(L.v,'green',L.F[1]); secs(5); V.cast(L.v,'blue',L.F[0]); assert.ok(mark(L,L.F[0],'mdTri'),'the first newly Charted: 6 s');
  L=ml(S(['gi_1_1','gi_n1']),{foes:2}); V.cast(L.v,'green',L.F[1]); const a=castRatio(L,'blue',L.F[0]); near(a,1.075*1.08,'Gold Ink 7.5% and 8% on the first'); near(castRatio(L,'blue',L.F[0]),1.075,'the second: not');
  L=ml(S(['ls_9_3','ls_4_4']),{foes:2}); V.cast(L.v,'green',L.F[0]); assert.ok(mark(L,L.F[1],'mdTri'),'Gilded Line: the farthest at once'); assert.ok(!mark(L,L.F[0],'mdTri')); near(left(L,L.F[1],'mdTri'),5.5);
  L=ml(S(['ls_7_4']),{foes:2}); V.cast(L.v,'ult',L.F[0]); assert.ok(L.F.every(f=>mark(L,f,'mdTri'))); near(left(L,L.F[0],'mdTri'),3,'Final Bearing: 3 s');
  L=ml(S(['ls_7_4','ls_6_4']),{foes:3}); V.cast(L.v,'ult',L.F[1]); clear3(L); kill(L,L.F[0]); assert.ok(mark(L,L.F[1],'mdTri')); near(left(L,L.F[1],'mdTri'),2,'Bearing Kept: the nearest enemy, 2 s'); assert.ok(!mark(L,L.F[2],'mdTri'));
});
const clear3=L=>{ for(const f of L.F.slice(1)) if(f._talM&&f._talM[L.v.uid]) delete f._talM[L.v.uid].mdTri; };

test('Meridian / Triangulated enemies: True Bearing, Last Point, Plotted Course (his whole team)',()=>{
  const L=ml(S(['ls_11_4','ls_12_4','ls_8_4']),{foes:2,allies:1}); const [F0,F1]=L.F; setMk(L,F0,'mdTri',9); V.step(1);
  near(skillRatio(L,F0,'piercethrow'),1.15*1.05,'Golden Quill 15%, Plotted Course 5%'); near(ratio(L,F0),1.05);
  F0.hp=0.32*F0.maxHp; near(ratio(L,F0),1.05,'32%: not yet'); F0.hp=0.2*F0.maxHp; near(ratio(L,F0),1.05*1.12,'below 30%: 12% more'); near(ratio(L,F1),1,'not Triangulated');
  const A0=L.A[0], x=lost(F0,()=>V.hit(A0,F0,1000,{kind:'true'})), y=plainHit(L,()=>lost(F0,()=>V.hit(A0,F0,1000,{kind:'true'}))); near(x/y,1.05,'an ally\'s hit: 5% more');
});

test('Meridian / Golden Quill: Gold Nib, Gilt Edge, Second Throw, Wide Margin, Gold Leaf, Unbroken Line, Steady Trade, Quill and Line',()=>{
  let L=ml(S(['ls_2_3','gi_6_1','ty_5_4']),{foes:2}); near(castRatio(L,'green',L.F[1]),1.15**3,'15% three times');
  L=ml(S(['ls_3_3']),{foes:2}); const W=L.v.greenAb.width; at(L,L.F[0],5,1.28*W/V.METER); const h=L.F[0].hp; V.cast(L.v,'green',L.F[0]); assert.ok(L.F[0].hp<h,'30% wider: struck'); at(L,L.F[0],5,1.32*W/V.METER); const h1=L.F[0].hp; V.cast(L.v,'green',L.F[0]); assert.equal(L.F[0].hp,h1,'not 32% off');
  L=ml(null,{foes:2}); at(L,L.F[0],5,1.15*W/V.METER); const h2=L.F[0].hp; V.cast(L.v,'green',L.F[0]); assert.equal(L.F[0].hp,h2,'(plain: not)');
  L=ml(S(['ls_7_3']),{foes:3}); near(castRatio(L,'green',L.F[2]),1.2,'two enemies before the farthest: 10% each'); at(L,L.F[1],10,7); near(castRatio(L,'green',L.F[2]),1.1,'one');
  L=ml(S(['ls_12_3','ty_9_4','ty_1_1']),{foes:3}); const i0=atkI(L); V.cast(L.v,'green',L.F[0]); V.step(1); near(i0/atkI(L),1.09,'Unbroken Line: 1.5% x 2 for each of 3'); assert.equal(stack(L,'mdStride'),3,'Steady Trade: 1 Stride each at 5/5');
  secs(3.2); near(i0/atkI(L),1.09,'still at 3.3 s'); secs(0.9); near(atkI(L),i0,'4 s');
  L=ml(S(['ty_7_4']),{foes:3}); L.v.blueCd=5; V.cast(L.v,'green',L.F[0]); near(L.v.blueCd,4,'Quill and Line: 1 s off Plumb Line, once a cast');
});

test('Meridian / cooldowns: Quiet Hands, Quill Rhythm, Sure Line, Measured Line; Nearest Threat\'s refund and Close Call; the floors (3.5 s and 3 s)',()=>{
  let L=ml(S(['ls_8_3','ty_2_4','ls_10_2','ty_6_4']),{foes:2}); near(FX.cd(L.v,'green',7),5.2,'Golden Quill 7 - 1.8'); near(FX.cd(L.v,'blue',6),4.6,'Plumb Line 6 - 1.4');
  L=ml(S(['ls_5_3','ls_6_3','ls_8_3']),{foes:2}); L.v.greenCd=FX.cd(L.v,'green',7); near(L.v.greenCd,6.1); V.cast(L.v,'blue',L.F[0]); near(L.v.greenCd,4.6,'Nearest Threat: 1.5 s a hit');
  V.cast(L.v,'blue',L.F[0]); near(L.v.greenCd,3.5,'never below 3.5 s'); assert.ok(win(L,'mdCc')); near(inRatio(L),0.85,'Close Call: 15% less'); secs(3.1); near(inRatio(L),1,'3 s');
});

test('Meridian / Plumb Line: Surveyor\'s Reach (full at 6.5 m), Long Shot Habit (102%), Charted Distance, Dead Reckoning, Plumb True; Farthest First and Nearest Threat at the launch',()=>{
  let L=ml(S(['ls_4_1']),{foes:2}); at(L,L.F[0],6.6,0); near(castRatio(L,'blue',L.F[0]),1.9/(1+0.9*6.6/8),'full bonus at 6.6 m'); at(L,L.F[0],4.5,0); near(castRatio(L,'blue',L.F[0]),(1+0.9*4.5/6.5)/(1+0.9*4.5/8));
  L=ml(S(['ls_5_1']),{foes:2}); near(castRatio(L,'blue',L.F[1]),2.02/1.9,'90% up to 102%');
  L=ml(S(['ls_12_1','ty_3_4','ty_12_4','ty_1_1']),{foes:2}); setStack(L,'mdStride',12); near(castRatio(L,'blue',L.F[1]),1.09*1.15*1.15,'9%, 15%, 1.5% x 10 Stride (counted up to 10)');
  L=ml(S(['ls_5_2']),{foes:3}); let h=L.F.map(f=>f.hp); launch(L,L.F[0]); assert.ok(L.F[2].hp<h[2]&&L.F[0].hp===h[0],'Farthest First: at the farthest');
  L=ml(S(['ls_5_3']),{foes:3}); h=L.F.map(f=>f.hp); launch(L,L.F[2]); assert.ok(L.F[0].hp<h[0]&&L.F[2].hp===h[2],'Nearest Threat: at the nearest');
  L=ml(null,{foes:3}); h=L.F.map(f=>f.hp); launch(L,L.F[1]); assert.ok(L.F[1].hp<h[1],'(plain: his target)');
});

test('Meridian / The Far Point (SIGNATURE): a 5-Sighting Plumb Line flies on to the next two farthest at 80% and 60%, each Triangulated; once every 15 s',()=>{
  const L=ml(S(['ls_1_1','ls_12_1','ls_13_1']),{foes:3,far:true}); const [F0,F1,F2]=L.F; setStack(L,'mdSight',5); const h=L.F.map(f=>f.hp); V.cast(L.v,'blue',F0);
  const l=L.F.map((f,i)=>h[i]-f.hp); near(l[2]/l[0],0.8,'the next farthest: 80%'); near(l[1]/l[0],0.6,'then 60%'); assert.ok(L.F.every(f=>mark(L,f,'mdTri')),'all three Triangulated');
  setStack(L,'mdSight',5); const h2=[F1.hp,F2.hp]; V.cast(L.v,'blue',F0); assert.equal(F1.hp,h2[0],'the 15 s lock'); assert.equal(F2.hp,h2[1]);
  secs(15.1); setStack(L,'mdSight',4); const h3=F2.hp; V.cast(L.v,'blue',F0); assert.equal(F2.hp,h3,'4 Sightings: no'); setStack(L,'mdSight',5); V.cast(L.v,'blue',F0); assert.ok(F2.hp<h3,'after 15 s, 5: again');
});

test('Meridian / Corrected Shot (Windage): a hit missed to Evasion or halved by Block; his next basic hit on that enemy 12% x 3 more; held 5 s',()=>{
  const L=ml(S(['ls_n1']),{foes:2}); const [F0,F1]=L.F; F0.evaStat=1; V.hit(L.v,F0,100,{}); F0.evaStat=0;
  near(ratio(L,F1,{auto:true}),1,'not on another enemy'); near(ratio(L,F0),1,'not a skill hit'); near(ratio(L,F0,{auto:true}),1.36,'36% on it'); near(ratio(L,F0,{auto:true}),1,'spent');
  F0.blockStat=1; V.hit(L.v,F0,1000,{}); F0.blockStat=0; assert.ok(md(L).wind&&md(L).wind.t===F0,'Block reads it'); md(L).wind=null; F0.blockStat=1; brnd(0.99); V.hit(L.v,F0,1000,{auto:true}); brndBack(); F0.blockStat=0; assert.ok(md(L).wind&&md(L).wind.t===F0,'a Block reads it, and the blocked hit itself does not spend it'); V.step(1);
  near(ratio(L,F0,{auto:true}),1.36,'the next one: 36%'); F0.evaStat=1; V.hit(L.v,F0,100,{}); F0.evaStat=0; secs(5.1); near(ratio(L,F0,{auto:true}),1,'5 s');
});

test('Meridian / Charted: Gold Ink (rest of the fight, 1.5% x 5), Coastline on the Arm, Indelible, Chart Room, Map Legend, Noted Recovery, Ink Runs Deep, Every Mark an X',()=>{
  let L=ml(S(['gi_1_1','gi_2_1','gi_5_1','gi_4_1','gi_n2','gi_8_1']),{foes:3,allies:1}); const [F0,F1,F2]=L.F; at(L,F2,4.5,7); const i0=atkI(L);
  V.cast(L.v,'green',F1); assert.ok(mark(L,F0,'mdCh')&&mark(L,F1,'mdCh')&&!mark(L,F2,'mdCh')); assert.equal(left(L,F0,'mdCh'),Infinity,'for the rest of the fight');
  near(ratio(L,F0),1.075); near(ratio(L,F2),1); V.step(1); near(i0/atkI(L),1.06,'Map Legend: 3% for each of 2');
  const hg=(t,a)=>{ t.hp=t.maxHp*0.5; const h=t.hp; V.heal(t,a); return t.hp-h; };
  L.v.energy=0; hg(F1,10); near(L.v.energy,6,'Noted Recovery: 2 x 3 energy'); hg(F1,10); near(L.v.energy,6,'at most once every 4 s'); hg(F2,10); near(L.v.energy,6,'(not an uncharted one)');
  near(hg(F0,1000)/hg(F2,1000),0.88,'Indelible: 12% less healing');
  const A0=L.A[0], x=lost(F0,()=>V.hit(A0,F0,1000,{kind:'true'})), y=plainHit(L,()=>lost(F0,()=>V.hit(A0,F0,1000,{kind:'true'}))); near(x/y,1.05,'Chart Room: his allies 5%');
  F0.hp=0.4*F0.maxHp; near(ratio(L,F0),1.075*1.09,'Ink Runs Deep: below 50%, 9%');
  L=ml(S(['gi_1_1','gi_2_1','gi_3_1']),{foes:2}); V.cast(L.v,'blue',L.F[0]); assert.ok(mark(L,L.F[0],'mdCh'),'Coastline: Plumb Line Charts');
  L=ml(S(['gi_1_1','gi_7_1']),{foes:2}); near(castRatio(L,'green',L.F[1]),1.3,'Every Mark an X: a second hit for 30% (Charted by this very quill)');
});

test('Meridian / Discovery and Field Notes: First Sighting (30%, a note, 0.5% attack each), Margin Notes, Fieldwork, Scholar\'s Eye, Bound Notebook, Nothing Unknown, Annotated, Field Journal, Margins Full',()=>{
  let L=ml(S(['gi_1_4','gi_2_4','gi_3_4']),{foes:2}); const [F0,F1]=L.F, d0=L.v.dmg;
  near(ratio(L,F0),1.3,'the first hit on it'); near(ratio(L,F0),1,'not the second'); assert.equal(stack(L,'mdNote'),1); V.step(1);
  near(L.v.dmg/d0,1.005); near(L.v.glyphCrit,0.009,'Margin Notes 0.3% x 3'); near(L.v.lifestealStat||0,0.01,'Fieldwork 0.2% x 5');
  L=ml(S(['gi_1_4','gi_11_4','gi_10_4']),{foes:3}); kill(L,L.F[2]); assert.equal(stack(L,'mdNote'),2,'Annotated: a kill writes one (and the killing hit was a Discovery)'); assert.equal(L.T.st.mdNote.max,15,'Field Journal: up to 15');
  L=ml(S(['gi_1_4','gi_6_4']),{foes:3}); V.hit(L.v,L.F[0],10,{kind:'true'}); V.hit(L.v,L.F[1],10,{kind:'true'}); setStack(L,'mdNote',7); V.wave(); V.step(1); assert.equal(stack(L,'mdNote'),4,'Bound Notebook: 4 kept');
  near(ratio(L,L.F[2]),1,'a later wave: no Discovery without Nothing Unknown'); assert.equal(stack(L,'mdNote'),4);
  L=ml(S(['gi_1_4','gi_7_4']),{foes:3}); V.wave(); V.step(1); near(ratio(L,L.F[2]),1.12,'Nothing Unknown: 40% of it later'); assert.equal(stack(L,'mdNote'),1);
  L=ml(S(['gi_12_4']),{foes:2}); setStack(L,'mdNote',10); near(ratio(L,L.F[0],{crit:true}),1.09,'Margins Full at 10'); setStack(L,'mdNote',9); near(ratio(L,L.F[0],{crit:true}),1);
  L=ml(S(['gi_8_4']),{foes:2}); setStack(L,'mdNote',10); const p=lost(L.F[0],()=>V.hit(L.v,L.F[0],1000,{})), q=plainHit(L,()=>lost(L.F[0],()=>V.hit(L.v,L.F[0],1000,{}))); assert.ok(p/q>1.005,'Scholar\'s Eye: armor ignored ('+(p/q)+')');
});

test('Meridian / Cross-Reference: a Discovery hit\'s own crit chance inside the 5% group (this hit\'s roll)',()=>{
  const L=ml(S(['gi_1_4','gi_5_4']),{foes:3}); const r0=1.3*(1+(L.v.critDmg||0.6)); brnd(0.04); near(ratio(L,L.F[0]),r0,'rolled under 5%: a crit'); brnd(0.06); near(ratio(L,L.F[1]),1.3,'over 5%: not'); brndBack();
  const L2=ml(S(['gi_1_4','gi_5_4','ls_1_2']),{foes:2}); brnd(0.001); near(ratio(L2,L2.F[0]),1.3,'Steady Eye has used the whole 5%: no roll left');
});

test('Meridian / Final Expedition: Long Expedition, Deep Survey, Drawn Life, Long Bleed, Full Survey, Set Ink (PICK ONE) and Settled Ink',()=>{
  let L=ml(S(['gi_2_2','ls_10_1','gi_7_2','gi_4_2']),{foes:2}); const F0=L.F[0];
  const pl=plainHit(L,()=>{ const h=F0.hp; V.cast(L.v,'ult',F0); return [h-F0.hp,F0.dots[F0.dots.length-1].dps]; }); F0.dots.length=0; F0.mortalT=0;
  const h=F0.hp; V.cast(L.v,'ult',F0); const tl=h-F0.hp, d=myFs(L,F0)[0]; near(tl/pl[0],1.15,'Deep Survey'); near(d.dps/pl[1],1.2,'Long Expedition'); near(L.v._lifestealPct,0.35*1.15,'Drawn Life');
  near(F0.mortalT,4.2,'Long Bleed: 1.2 s longer'); near(d.remaining-1+(d._talF!=null?d._talF:1),4.2,'its bleed too');
  L=ml(S(['gi_1_1','gi_9_1','gi_5_2','gi_6_2']),{foes:2,allies:1}); setMk(L,L.F[0],'mdCh'); V.step(1); const r=castRatio(L,'ult',L.F[1]); near(r,1,'(the uncharted one)');
  L.F[0].mortalT=0; L.F[0].dots.length=0; L.F[1].mortalT=0; L.F[1].dots.length=0; const h0=L.F[0].hp; V.cast(L.v,'ult',L.F[0]); assert.ok(h0>L.F[0].hp);
  near(L.F[0].mortalT,6,'Set Ink: 3 s longer on a Charted enemy'); near(L.F[1].mortalT,3,'not on another'); assert.ok(mark(L,L.F[0],'mdSet'));
  near(myFs(L,L.F[0])[0].remaining,6,'its bleed 6 s'); near(inRatio(L,{src:L.F[0]}),0.94,'Settled Ink: 6% less from it'); near(inRatio(L,{src:L.F[1]}),1);
  const A0=L.A[0], x=lost(A0,()=>V.hit(L.F[0],A0,1000,{kind:'true'})), y=plainHit(L,()=>lost(A0,()=>V.hit(L.F[0],A0,1000,{kind:'true'}))); near(x/y,0.94,'and on his team');
  L=ml(S(['gi_1_1','gi_9_1']),{foes:2}); setMk(L,L.F[0],'mdCh'); V.step(1); const a=castLost(L,'ult',L.F[0]); L.F[0].mortalT=0; const b=plainHit(L,()=>castLost(L,'ult',L.F[0])); near(a/b,1.075*1.15,'Full Survey: 15% on Charted');
});

test('Meridian / Final Expedition: Running Ink (PICK ONE) and Shared Ration, Thirst of the Ink, Red Margins, Night Copy, Indexed',()=>{
  let L=ml(S(['gi_5_3','gi_6_3']),{foes:2,allies:2,big:true}); const A=L.A; A[0].maxHp=A[0].hp=1e6; A[0].hp=4e5; A[1].maxHp=A[1].hp=1e6; A[1].hp=8e5;
  L.v._lifestealT=3; L.v._lifestealPct=0.35; const h=L.F[0].hp, a0=A[0].hp; V.hit(L.v,L.F[0],1000,{kind:'true'}); const lostF=h-L.F[0].hp;
  near(A[0].hp-a0,lostF*0.35*0.5*1.3,'half of the drain x 1.3 to the lowest ally'); L.v._lifestealT=0; const a1=A[0].hp; V.hit(L.v,L.F[0],1000,{kind:'true'}); near(A[0].hp,a1,'only while it holds');
  L=ml(S(['gi_1_1','gi_9_2','gi_11_1','gi_11_2']),{foes:3}); for(const f of L.F) setMk(L,f,'mdCh'); L.v.energy=0; V.cast(L.v,'ult',L.F[0]); const t0=L.v._lifestealT; L.v.hp=0.5*L.v.maxHp; const hp=L.v.hp;
  kill(L,L.F[2]); near(L.v._lifestealT,t0+1,'Thirst: 1 s more'); const ls=L.v._lifestealT; L.v._lifestealT=0; const hp2=L.v.hp; kill(L,L.F[1]); near(L.v.hp-hp2,0.05*L.v.maxHp,'Indexed: 5% of his max HP',1e-3); L.v._lifestealT=ls;
  L.v.energy=0; secs(3.1); near(L.v.energy,5,'Night Copy: 5 for each Charted enemy alive when it ends');
  L=ml(S(['gi_10_2']),{foes:1}); V.cast(L.v,'ult',L.F[0]); L.v.hp=0.5*L.v.maxHp; L.v.hots.length=0; const d=myFs(L,L.F[0])[0]; assert.ok(d,'its bleeds are his'); const hv=L.v.hp, f0=L.F[0].hp; secs(1.05);
  rel((L.v.hp-hv)/(f0-L.F[0].hp),0.05,'Red Margins: 5% of the bleed',2e-2);
});

test('Meridian / Stays Charted (SIGNATURE): Inked 6 s - no healing, shields half, his bleed twice as fast, half of each tick heals him, 2 notes a death; once every 25 s',()=>{
  const L=ml(S(['gi_1_1','gi_13_2']),{foes:3}); const [F0,F1,F2]=L.F; setMk(L,F0,'mdCh'); setMk(L,F2,'mdCh'); F0.shield=1e4; F1.shield=1e4; V.step(1); V.cast(L.v,'ult',F0);
  assert.ok(mark(L,F0,'mdInk')&&!mark(L,F1,'mdInk')); near(left(L,F0,'mdInk'),6); near(F0.shield/F1.shield,0.5,'its shield halved',2e-2); F0.shield=500; V.step(1);
  F0.hp=F0.maxHp*0.5; const h=F0.hp; V.heal(F0,1000); assert.equal(F0.hp,h,'cannot be healed'); F0.shield+=1000; V.step(1); near(F0.shield,1000,'a new shield absorbs half');
  L.v.hp=0.3*L.v.maxHp; L.v.hots.length=0; const hv=L.v.hp, f0=F0.hp, r0=myFs(L,F0)[0].remaining, r1=myFs(L,F1)[0].remaining; secs(1.05);
  assert.ok(r0-myFs(L,F0)[0].remaining>=2,'twice as fast'); assert.equal(r1-myFs(L,F1)[0].remaining,1); assert.ok(L.v.hp-hv>0.4*(f0-F0.hp),'half of each tick heals him');
  kill(L,F0); assert.equal(stack(L,'mdNote'),2,'2 Field Notes'); setMk(L,F1,'mdCh'); V.cast(L.v,'ult',F1); assert.ok(!mark(L,F1,'mdInk'),'once every 25 s');
});

test('Meridian / Well-Read: Warm Up and Well-Thumbed (40% faster), Early Start (a quarter), Ever Faster and Long Hours (+25 points at the full ramp), Quiet Study',()=>{
  let L=ml(null,{foes:2}); L.v._momStk=0; secs(2); const p=L.v._momStk;
  L=ml(S(['ty_2_1','gi_3_3']),{foes:2}); L.v._momStk=0; secs(2); rel(L.v._momStk-p,0.025*2*0.4,'40% faster: 0.4 x 0.025 a second more',3e-2);
  L=ml(S(['ls_11_2']),{foes:2}); assert.ok(L.v._momStk>=CAP()/4-1e-9,'a quarter at the wave\'s start');
  L=ml(S(['ty_7_1','gi_10_3','gi_9_3']),{foes:2}); const i0=atkI(L); fullRamp(L); V.step(1); near(i0/atkI(L),1+0.25/(1+CAP()),'+25 points on top of the ramp'); near(inRatio(L),0.925,'Quiet Study 7.5%');
  L.v._momStk=0.1; V.step(1); near(atkI(L),i0,'only at the full ramp'); near(inRatio(L),1);
});

test('Meridian / Stride: Into Stride (at the full ramp, 0.3% x 5 attack each), Endless Road, Long March, Pacing, Old Habit, Hand a Blur, Blur of the Hand, Expedition Pace',()=>{
  let L=ml(S(['ty_1_1','ty_10_1','ty_4_1','ty_5_1','ty_8_1','ty_6_1']),{foes:3}); const d0=L.v.dmg; V.hit(L.v,L.F[0],10,{kind:'true',auto:true}); assert.equal(stack(L,'mdStride'),0,'not before the full ramp');
  fullRamp(L); for(let i=0;i<4;i++) V.hit(L.v,L.F[0],10,{kind:'true',auto:true}); V.hit(L.v,L.F[0],10,{kind:'true'}); assert.equal(stack(L,'mdStride'),4,'each basic attack, not a skill hit'); V.step(1);
  near(L.v.dmg/d0,1.06); near(L.v.glyphCrit,0.04,'Pacing 1% each'); near(L.v.lifestealStat,0.04,'Old Habit 1% each'); setStack(L,'mdStride',20); V.step(1); assert.equal(stack(L,'mdStride'),20);
  near(L.v.glyphCrit,0.05,'(the crit group: 5%)'); L.T.s.k.mdStride.n=0; for(let i=0;i<16;i++) V.hit(L.v,L.F[0],10,{kind:'true',auto:true}); assert.equal(stack(L,'mdStride'),15,'Endless Road: 15');
  near(ratio(L,L.F[1],{auto:true}),1.15,'Hand a Blur at 10'); V.wave(); V.step(1); assert.equal(stack(L,'mdStride'),6,'Long March: 6 kept');
  L=ml(S(['ty_1_1','ty_3_1']),{foes:3}); setStack(L,'mdStride',10); const g=[]; for(let i=0;i<3;i++){ const h=L.F[1].hp; V.hit(L.v,L.F[0],1000,{kind:'true',auto:true}); g.push(h-L.F[1].hp); }
  assert.deepEqual(g.map(x=>x>0),[false,false,true],'every third'); near(g[2],400,'40% to the nearest other enemy');
  L=ml(S(['ty_1_1','ty_10_4']),{foes:2}); setStack(L,'mdStride',10); near(castRatio(L,'ult',L.F[0]),1.25,'Expedition Pace: 5% for each 2');
});

test('Meridian / Provisions: Packed Provisions (2 a wave, eaten below 50%), Hard Tack, Spare Rations, Well Provisioned, Foraging, Last Biscuit, Charted Rest',()=>{
  let L=ml(S(['ty_1_3','ty_2_3','ty_4_3','ty_11_3']),{foes:2,allies:1}); const v=L.v, A0=L.A[0]; assert.equal(stack(L,'mdProv'),5,'2 + 3'); A0.maxHp=1e6; A0.hp=1e5;
  v.hp=0.4*v.maxHp; const h=v.hp, a=A0.hp; V.step(1); assert.equal(stack(L,'mdProv'),4); near(v.hp-h,0.13*v.maxHp,'10% x 1.3',1e-2); near(A0.hp-a,0.05*v.maxHp,'the nearest ally 5% of his max HP',1e-2);
  V.step(1); v.hp=0.1*v.maxHp; V.step(1); assert.equal(stack(L,'mdProv'),3); V.step(2); assert.equal(stack(L,'mdProv'),3,'once until he is back above 50%'); v.hp=0.6*v.maxHp; V.step(1); v.hp=0.45*v.maxHp; V.step(1); assert.equal(stack(L,'mdProv'),2);
  setStack(L,'mdProv',1); V.wave(); V.step(1); assert.equal(stack(L,'mdProv'),5,'full again each wave');
  L=ml(S(['ty_1_3','ty_8_3']),{foes:3}); setStack(L,'mdProv',0); brnd(0.49); kill(L,L.F[2]); assert.equal(stack(L,'mdProv'),1,'Foraging: 50%'); brnd(0.51); kill(L,L.F[1]); assert.equal(stack(L,'mdProv'),1);
  L=ml(S(['ty_1_3','ty_8_3','ty_9_3']),{foes:2}); L.v.hp=10; V.hit(L.F[0],L.v,1e6,{kind:'true'}); assert.ok(L.v.alive,'Last Biscuit'); near(L.v.hp,1+0.10*L.v.maxHp,'1 HP, then the Provision heals',1e-2); assert.equal(stack(L,'mdProv'),1);
  L.v.hp=10; V.hit(L.F[0],L.v,1e6,{kind:'true'}); assert.ok(!L.v.alive,'once a fight');
  L=ml(S(['ty_1_3','ty_11_4']),{foes:2}); setStack(L,'mdProv',0); L.v._momStk=0; V.cast(L.v,'ult',L.F[0]); assert.equal(stack(L,'mdProv'),1,'Charted Rest: a Provision'); near(L.v._momStk,CAP(),'and the full ramp');
});

test('Meridian / Sit It Out (PICK ONE) and Camp Discipline; Push On (PICK ONE) and Forced March',()=>{
  let L=ml(S(['ty_1_3','ty_5_2','ty_6_2']),{foes:2}); L.v.hp=0.4*L.v.maxHp; V.step(1); assert.ok(win(L,'mdSit')); near(inRatio(L),0.70,'30% less'); secs(4.4); assert.ok(win(L,'mdSit'),'4.5 s'); secs(0.2); near(inRatio(L),1);
  L=ml(S(['ty_1_3','ty_1_1','ty_5_3','ty_6_3']),{foes:2}); const i0=atkI(L); L.v.hp=0.4*L.v.maxHp; const h=L.v.hp; V.step(1); near(L.v.hp,h,'no heal'); assert.equal(stack(L,'mdStride'),10,'full Stride');
  V.step(1); near(i0/atkI(L),1.24,'15% + 9% attack speed'); secs(5.1); near(atkI(L),i0,'5 s');
});

test('Meridian / The Unhurried Hand (SIGNATURE): at full Stride, 8 s: every basic attack a quill at each of the three nearest, Golden Quill twice as fast, Provisions kept; Push On: up to 3 s more',()=>{
  let L=ml(S(['ty_1_1','ty_1_3','ty_12_1','ty_13_1']),{foes:5}); const v=L.v; fullRamp(L); setStack(L,'mdStride',9); V.hit(v,L.F[0],10,{kind:'true',auto:true}); assert.ok(win(L,'mdBlur'),'full Stride: the blur');
  const h=L.F.map(f=>f.hp); V.hit(v,L.F[0],1000,{kind:'true',auto:true}); const l=L.F.map((f,i)=>h[i]-f.hp);
  near(l[0],1000); near(l[3],1000,'F3 (6 m): a quill for what the attack dealt'); near(l[4],1000,'F4 (7.8 m)'); assert.equal(l[1],0,'F1 (10 m): not among the three nearest'); assert.equal(l[2],0);
  v.hp=0.4*v.maxHp; V.step(2); assert.equal(stack(L,'mdProv'),2,'he keeps his Provisions');
  v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=6; v.blueCd=99; v.energy=0; secs(1); near(v.greenCd,4,'Golden Quill twice as fast',2e-2); v.stunned=1e6;
  secs(7.1); assert.ok(!win(L,'mdBlur'),'8 s'); assert.equal(stack(L,'mdProv'),1,'(then he eats)'); setStack(L,'mdStride',9); V.hit(v,L.F[0],10,{kind:'true',auto:true}); assert.ok(!win(L,'mdBlur'),'once a wave');
  L=ml(S(['ty_1_1','ty_1_3','ty_4_3','ty_12_1','ty_13_1','ty_5_3']),{foes:2}); fullRamp(L); setStack(L,'mdStride',9); V.hit(L.v,L.F[0],10,{kind:'true',auto:true}); secs(8.05);
  assert.ok(win(L,'mdBlur'),'Push On: 1.5 s more'); assert.equal(stack(L,'mdProv'),4); secs(1.5); assert.ok(win(L,'mdBlur')); assert.equal(stack(L,'mdProv'),3); secs(1.5); assert.ok(!win(L,'mdBlur'),'up to 3 s'); assert.equal(stack(L,'mdProv'),3);
});

test('Meridian / Steady Old Hand, Swift Survey, Seasoned, Last Mile, Far Horizon, Thin Air, Sharp Angles, Hand Never Tires',()=>{
  let L=ml(S(['ty_12_1','ty_8_4','ty_12_3','ls_11_1']),{foes:2}); const d0=L.v.dmg; V.wave(); V.step(1); V.wave(); V.step(1); near(L.v.dmg/d0,1.09,'two waves cleared: 4.5% each');
  L.v.energy=0; V.step(1); L.v.energy=10; V.step(1); near(L.v.energy,10.9,'Swift Survey: 9% more of what he gains'); L.v.energy=0; near(ratio(L,L.F[0]),1,'Seasoned: not before 30 s'); VMX('battleTime=25'); near(ratio(L,L.F[0]),1,'not at 25 s'); VMX('battleTime=31'); near(ratio(L,L.F[0]),1.08); near(inRatio(L),0.92);
  L.F[0].hp=0.3*L.F[0].maxHp; near(ratio(L,L.F[0]),1.08*1.15,'Last Mile');
  L=ml(S(['ls_6_2','ls_10_3']),{foes:3}); near(ratio(L,L.F[0],{auto:true}),1,'0.9 m: not'); near(ratio(L,L.F[1],{auto:true}),1.075,'6.4 m: Far Horizon'); near(ratio(L,L.F[1],{crit:true}),1,'6.4 m: no Thin Air'); near(ratio(L,L.F[2],{crit:true}),1.10,'11.9 m: Thin Air');
  L=ml(S(['ty_11_1']),{foes:2}); fullRamp(L); V.step(1); near(ratio(L,L.F[0],{crit:true}),1.10); L.v._momStk=0; near(ratio(L,L.F[0],{crit:true}),1);
  L=ml(S(['ls_3_2']),{foes:2}); const a=lost(L.F[0],()=>V.hit(L.v,L.F[0],1000,{})), b=plainHit(L,()=>lost(L.F[0],()=>V.hit(L.v,L.F[0],1000,{}))); assert.ok(a/b>1.01,'Sharp Angles');
});

test('Meridian / the caps: damage reduction one group (40%), crit chance one group (5%), control shortening one group (20%), healing a second (1.2%)',()=>{
  let L=ml(S(['ls_5_3','ls_6_3','gi_5_2','gi_6_2','gi_9_3','ty_9_2','ty_1_3','ty_5_2','ty_12_3']),{foes:2}); fullRamp(L); setMk(L,L.F[0],'mdSet',99); openWin(L,'mdCc'); openWin(L,'mdSit'); VMX('battleTime=31'); L.v.hp=0.4*L.v.maxHp; V.step(1); openWin(L,'mdCc'); openWin(L,'mdSit');
  near(inRatio(L,{src:L.F[0]}),0.60,'at most 40% (the shares multiply to 56% without the cap)'); L.F[0].dots.length=0;
  L=ml(S(['ls_1_2','gi_8_3','gi_2_4','ls_1_1','ls_6_1','ty_1_1','ty_5_1']),{foes:2}); setStack(L,'mdNote',10); setStack(L,'mdSight',5); setStack(L,'mdStride',10); V.step(1); near(L.v.glyphCrit,0.05,'5% in all');
  L=ml(S(['ty_4_2','ty_1_3','ty_12_2']),{foes:2}); near(FX.cc(L.F[0],L.v,'stunned',2,false),1.6,'20% (35% without the cap)'); setStack(L,'mdProv',0); near(FX.cc(L.F[0],L.v,'stunned',2,false),1.6);
  L=ml(S(['ty_1_3','ty_12_2']),{foes:2}); near(FX.cc(L.F[0],L.v,'stunned',2,false),1.7,'Unhurried Calm 15% with a Provision'); setStack(L,'mdProv',0); near(FX.cc(L.F[0],L.v,'stunned',2,false),2,'none without');
  L=ml(S(['ty_10_2','gi_12_2']),{foes:2}); fullRamp(L); L.v.hp=0.3*L.v.maxHp; V.step(1); let h=L.v.hp; secs(2.02); rel((L.v.hp-h)/L.v.maxHp,2*0.0075,'Grit of Years 0.75% a second',0.1);
  openWin(L,'mdFe',9); h=L.v.hp; secs(2.02); rel((L.v.hp-h)/L.v.maxHp,2*0.012,'with Draining Hand at most 1.2% a second',0.1);
});

test('Meridian: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['ls_1_1','ls_1_4','gi_1_1','gi_1_4','ty_1_1','ty_1_3','ls_12_1','ls_13_1']), TEAM=['vael','sylthaine','vireo','vex','meridian'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let ch=false,tri=false;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of U.filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.mdCh) ch=true; if(o.mdTri&&o.mdTri.until>V.now()) tri=true; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', Charted '+ch+', Triangulated '+tri);
  assert.ok(ch,'a real Chart'); assert.ok(mx.mdSight>=3,'real Sightings'); assert.ok(mx.mdNote>=1,'a real Field Note'); assert.ok(tri,'a real Triangulation');
  determinism(H,TEAM);
});

/* The page sites his talents added (the foiled hook at the shield wall, Evasion and the two Block lines; the momCap line): with nothing learned, whole seeded
   fights with Meridian in the line-up are identical to the pre-talent page (ee8edab8), seed by seed, and a scripted fight in which his hits are walled, missed
   and blocked is identical too (a draw added at any of those lines changes what follows). */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Meridian: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['meridian','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','grosk','dandra','brannus','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  let n=0;
  for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
    const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
    assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
  const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
  for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
    assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
  const RS=`(function(al,fo){ ended=false; state='battle'; CUR={mode:'replay',seed:9}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true; try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0; seedBattle(9); setupMarchTeams(al,fo,false);
      const m=units.find(u=>u.key==='meridian'), f=units.filter(u=>u.team==='enemy'); const c={wall:0,miss:0,block:0}; const F0=floatTexts.length;
      for(let i=0;i<40;i++){ const t=f[i%f.length]; if(!t.alive) continue; t.evaStat=(i%3===0)?0.5:0; t.blockStat=(i%3===1)?0.5:0; _autoAtk=1; try{ dealDamage(m,t,50,'#fff'); } finally{ _autoAtk=0; } t.evaStat=0; t.blockStat=0; }
      for(let i=F0;i<floatTexts.length;i++){ const x=floatTexts[i]; if(!x) continue; if(x.txt==='MISS') c.miss++; else if(x.txt==='BLOCK'&&x.sz===12) c.wall++; else if(x.txt==='BLOCK') c.block++; }
      for(let i=0;i<60;i++) updateBattle(SIM_STEP); return JSON.stringify([c,f.map(x=>Math.round(x.hp)),brnd()]); })`;
  const scr=h=>{ const al=JSON.stringify(h.snapFromSpecs([spec('meridian',100)])), fo2=JSON.stringify(h.snapFromSpecs([spec('grosk',100),spec('vael',100)])); return vm.runInContext(RS+'('+al+','+fo2+')',h.ctx); };
  const ra=scr(NOW); assert.equal(ra,scr(BASE),'a scripted fight with his hits walled, missed and blocked: identical'); const c=JSON.parse(ra)[0];
  console.log('  identity: '+n+' fights; scripted: '+JSON.stringify(c)); assert.ok(c.wall>0&&c.miss>0&&c.block>0,'every foiled site was reached'); n++;
  assert.ok(n>=19);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling for more than half a battle is too strong. His damage reduction
   talents (and armor), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ ls:['ls_5_3','ls_6_3','ls_7_2'], gi:['gi_5_2','gi_6_2','gi_9_3'], ty:['ty_9_2','ty_1_3','ty_5_2','ty_6_2','ty_12_3','ty_7_2','ty_3_2'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={ls:0,gi:1,ty:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (Close Call and Sit It Out running, the attacker under Set Ink, the full ramp,
   below 50% HP, the fight past 30 s); measured through the engine (HP and shield it takes) */
function worstHit(list,kind,crit){ const L=ml(list,{foes:2}), {v,F}=L, f=F[0]; v.maxHp=1e5; v.hp=4e4; fullRamp(L);
  if(L.T){ openWin(L,'mdCc'); openWin(L,'mdSit'); setMk(L,f,'mdSet',99); } VMX('battleTime=31'); V.step(1); if(L.T){ openWin(L,'mdCc'); openWin(L,'mdSit'); setStack(L,'mdProv',0); }
  v.hp=4e4; v.shield=0; const raw=2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Meridian: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['ty','ls'],[61,30]],[['ty'],[91]],[['ty','gi'],[61,30]],[['ls','ty'],[61,30]],[['gi','ty'],[61,30]],[['ty','ls','gi'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,tHi:0,sum:[]}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="meridian"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="meridian"&&u.alive&&u._tal){ __dr.ticks++; const e=units.find(x=>x.team!==u.team&&x.alive); if(e){ const A=u._tal.s.md&&u._tal.s.md.api; if(!A) continue; const k=u._tal.fn.drK(A,u._tal,u,e);'+
    '      const tot=1-k*Math.min(defMul(e,u,"phys"),defMul(e,u,"magic")); __dr.sum.push(tot); if(tot>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','meridian'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'), sus=d.sum.slice().sort((x,y)=>x-y), med=sus.length?sus[sus.length>>1]:0;
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; probe each tick: median '+(med*100).toFixed(1)+'%, at 85% or more '+d.tHi+' of '+d.ticks+' ticks ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%)');
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n+', ticks '+d.ticks);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.25*d.ticks,'above 85% for well under half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
