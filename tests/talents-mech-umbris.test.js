'use strict';
/* Umbris's talents as data on the mechanics layer (talents-mech/umbris.js), group by group on the still field (tests/talents-lab.js), then whole fights, the
   no-talent identity with him in the line-up, and Phil's 95% damage-reduction ceiling (worst hit, sustained, the share of a fight at 85% or more).
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off for
   one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Umbris, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5).
   Lab units are HELD (stunned 1e6), Umbris too; free() lets him think with nothing ready (his ultimate's orb lands in his own think). Lab skill level 10.
   Lingering Dark spreads only to an enemy whose centre is within 2.6 m of the dying one's (the skill reach audit; not repaired here): the spread tests put the
   enemies that close, and say so. Run: node --test tests/talents-mech-umbris.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='umbris', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const um=L=>L.T.s.um;
const rec=(L,t)=>{ const e=L.T.s.um.e; return e[t.uid]||(e[t.uid]={th:0,keep:0,zT:0,dimL:0,dim:false,rot:false,cr:false,inF:false,inZ:false,sh:t.shield||0,en:t.energy||0,lt:0,lw:0,rg:null,cs:0}); };
const rot=(L,t,secs,tag)=>{ V.dot(t,1,secs||99,1,L.v); const d=t.dots[t.dots.length-1]; d._talO=L.v.uid; d._talK=tag||'creeprot'; return d; };   // a rot of his (tagged as his skill's)
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const abHit=(L,t,skill,o)=>{ const s=L.T.s, k=s.cur; s.cur=skill; try{ return myHit(L,t,o); } finally{ s.cur=k; } };   // a hit of his while that skill resolves
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));
const hitAl=(L,a,amt,o)=>lost(a,()=>V.hit((o&&o.src)||L.F[0],a,amt||1000,Object.assign({kind:'true'},o||{})));
const kill=(L,t,by)=>{ t.hp=1; t.shield=0; V.hit(by||L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; v._recentAtk=1e9; };
const hold=L=>{ L.v.stunned=1e6; };
const still=f=>{ f.stunned=0; f.fearT=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.ctrlRes=0; };
const castS=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castR=(L,t)=>{ V.cast(L.v,'blue',t||L.F[0]); };
const land=L=>{ secs(0.6); };                                                       // his rots are queued 0.5 s (plagueDot)
/* his ultimate: cast at t, then let him think until the orb has landed (its zone stands after) */
function ult(L,t){ V.cast(L.v,'ult',t||L.F[0]); go(L); let k=0; for(;k<200&&(L.v._voidCast||L.v._voidT>0||L.v._voidLandT>0);k++) V.step(1); hold(L); assert.ok(k<200,'the orb landed'); }
const zones=L=>VMX('voidZones').filter(z=>z.owner===L.v&&z.life>0);
const dots=(L,t,tag)=>(t.dots||[]).filter(d=>d._talO===L.v.uid&&(tag==null||d._talK===tag)&&d.remaining>0);
const left=d=>(d.remaining-1+(d._talF!=null?d._talF:1))*(d.interval||1);
const tick1=(L,t)=>{ const h=t.hp+(t.shield||0); for(let i=0;i<80;i++){ V.step(1); const d=h-(t.hp+(t.shield||0)); if(d>0) return d; } return 0; };
const sm10=()=>VMX('skillMul(10)');
const field=(L,x,y,R,t)=>{ um(L).f.push({x:L.v.x+x*V.METER,y:L.v.y+y*V.METER,R:(R||3)*V.METER,t:t||99,dps:1}); };
const setStare=(L,n)=>{ const k=L.T.s.k.umStare||(L.T.s.k.umStare={n:0,t:0,idle:0}); k.n=n; };
const gapM=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/V.METER-V.bodyR(a)-V.bodyR(b);
const freeFoe=f=>{ f.stunned=0; f.ctrlRes=0; f.level=1; };

test('Umbris: every talent is accounted for - 9 plain stats, 108 with rows, none waiting; the renamed talents',()=>{
  accounting(H,[117,9,108,0,0]);
  for(const id of ['sd_10_4','sd_12_1','sd_11_3','wl_7_4','wl_11_2','wl_10_2','oc_2_1','oc_8_4','oc_9_1']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['sd_1_1','wl_1_1','oc_1_2','sd_13_2','wl_13_3','oc_13_3']) assert.ok(FXN.mech(H).talents[id],id);
  const names={sd_2_2:'Rot Worked In',sd_3_1:'Nothing Left to Mend',sd_6_1:'Gnawing Dark',sd_11_2:'Seeping Hole',sd_12_2:'Swallowed by the Gap',wl_7_4:'Unsunned Skin',wl_3_1:'Long Patience',
    wl_8_4:'Shortened Sight',wl_9_4:'Dimmed Hand',wl_10_2:'Withheld Thought',wl_8_3:'No Stars Overhead',oc_3_2:'Lidless',oc_4_3:'Patient Eyepiece',oc_8_2:'Small Hours',oc_8_3:'Measured Rot',oc_12_4:'Wick Smoke'};
  for(const id in names) assert.equal(T.talent(H,id).name,names[id],id);
  const mine=new Set(); for(const tr of T.trees(H)) for(const t of tr.talents) mine.add(t[3].toLowerCase());
  for(const k of VMX('Object.keys(HERO_TYPES)')) if(k!==H&&T.trees(k)) for(const tr of T.trees(k)) for(const t of tr.talents) assert.ok(!mine.has(t[3].toLowerCase()),'"'+t[3]+'" is also a talent of '+k);
  assert.ok(/at most 35%/.test(T.talent(H,'wl_11_4').text)&&/at most 15%/.test(T.talent(H,'sd_7_1').text)&&/at most 40%/.test(T.talent(H,'wl_3_3').text)&&/1\.2%/.test(T.talent(H,'sd_6_1').text),'the caps are in the tooltips');
  for(const id of ['sd_1_4','sd_3_4','sd_6_4','sd_7_2','sd_8_4','sd_9_4','sd_12_2','sd_12_4']) assert.ok(/2\.6 m/.test(T.talent(H,id).text),id+' says what Lingering Dark needs');
});

test('Umbris: his real kit, as the talents read it - Shadeburst (a rot, no hit, centre 7 m), Creeping Rot (hit + rot), the ultimate (first hit, zone ticks), Lingering Dark (2.6 m centre)',()=>{
  plain({foes:5,big:true},P=>{ const {v,F}=P; assert.equal(VMX('heroScaleMode')(v),'ap'); assert.equal(v.t.damageProfile,'Magic');
    const h0=F[0].hp; castS(P,F[0]); assert.equal(F[0].hp,h0,'Shadeburst has no hit'); land(P); const sb=F[0].dots.filter(d=>d.src===v); assert.equal(sb.length,1,'its rot (queued 0.5 s)'); assert.equal(sb[0].kind,'magic');
    for(const f of F) f.dots.length=0;
    const h1=F[2].hp; castR(P,F[2]); assert.ok(F[2].hp<h1,'Creeping Rot hits'); assert.equal(F[2].dots.filter(d=>d.src===v).length,0,'its rot is queued'); land(P); assert.equal(F[2].dots.filter(d=>d.src===v).length,1);
    for(const f of F) f.dots.length=0; at(P,F[1],8,1); at(P,F[2],30,0);
    const a=F.map(f=>f.hp); ult(P,F[0]); const hitN=F.filter((f,i)=>f.hp<a[i]).length; assert.ok(hitN>=2&&F[2].hp===a[2],'its first hit strikes those within 6.8 m (centre) of the aim: '+hitN);
    assert.equal(VMX('voidZones').filter(z=>z.owner===v).length,1,'and a zone stands'); const z=VMX('voidZones').find(z=>z.owner===v); near(z.r/V.METER,6.8,'6.8 m',1e-6);
    /* Lingering Dark: a rotting enemy dies; another enemy 2.5 m away (centre) gets the rot, one 3.0 m away does not */
    for(const f of F) f.dots.length=0; at(P,F[0],4.5,0); castR(P,F[0]); land(P); at(P,F[0],4.5,0); at(P,F[3],4.5,2.5); at(P,F[4],7.5,0); kill(P,F[0]); secs(0.6);
    assert.ok(F[3].dots.some(d=>d.src===v),'2.5 m: spread'); assert.ok(!F[4].dots.some(d=>d.src===v),'3.0 m: not');
  });
});

test('Umbris: each page site his talents added runs his rows - Shadeburst\'s at, the orb\'s landPre / land, the zone\'s part, the shade line, his bound functions',()=>{
  const L=lab(H,S(['sd_1_1','wl_1_4','wl_7_2']),{foes:4,allies:1,big:true}), {v,F,A}=L; const T0=L.T, fn=T0.fn, keep={}; const seen={at:0,lp:0,ld:0,zn:0,cur:[],shade:0};
  for(const k of ['fieldAt','ucLand','ucLanded','znHit','shade']) keep[k]=fn[k];
  fn.fieldAt=function(A,T,u,c){ seen.at++; seen.pt=c.pt; return keep.fieldAt.apply(this,arguments); };
  fn.ucLand=function(A,T,u){ seen.lp++; seen.cur.push(T.s.cur); return keep.ucLand.apply(this,arguments); };
  fn.ucLanded=function(A,T,u){ seen.ld++; seen.zoneBefore=zones(L).length; return keep.ucLanded.apply(this,arguments); };
  fn.znHit=function(A,T,u,c){ seen.zn++; seen.znCur=c.skill; return keep.znHit.apply(this,arguments); };
  fn.shade=function(A,T,u,c){ seen.shade++; return keep.shade.apply(this,arguments); };
  try{ castS(L,F[0]); assert.equal(seen.at,1,'Shadeburst\'s case runs his at rows'); assert.ok(um(L).f.length===1&&um(L).f[0].t>5,'his field: the circle, for its rot\'s time');
    ult(L,F[0]); assert.equal(seen.lp,1); assert.equal(seen.cur[0],'umbralcata','the first hit resolves as Umbral Cataclysm'); assert.equal(seen.ld,1); assert.equal(seen.zoneBefore,0,'land runs before the zone opens');
    secs(1.2); assert.ok(seen.zn>=1,'the zone\'s ticks run his part rows'); assert.equal(seen.znCur,'umZone');
    for(const k of ['umZones','umPlague','umCgDur']) assert.equal(typeof VMX('TalentFx.api().eng().'+k),'function',k+' is bound');
    near(VMX('TalentFx.api().eng().umCgDur("enemy")'),VMX('SKLV.contagionDur(contagionLv("enemy"))'),'Lingering Dark\'s length');
    /* the shade line: an enemy outside his field that picks an ally inside it */
    for(const f of F){ f.dots.length=0; } um(L).f.length=0; at(L,A[0],8,10); at(L,F[3],15,10); field(L,8,10,3,99); V.step(1); assert.equal(A[0]._talShd,v,'the ally inside his field is in his shade');
    freeFoe(F[3]); still(F[3]); F[3].level=1; V.step(1); if(F[3].target===A[0]) console.log('  DEBUG shade: '+JSON.stringify({f:um(L).f.map(q=>[q.x-v.x,q.y-v.y,q.R,q.t]),F3:[F[3].x-v.x,F[3].y-v.y],A0:[A[0].x-v.x,A[0].y-v.y,!!A[0]._talShd],vNo:!!v._noTarget,vDrop:!!v._dropHidden,n:um(L).shadeN})); assert.ok(seen.shade>=1,'the page asks his shade rows'); assert.notEqual(F[3].target,A[0],'and the enemy picks another'); }
  finally{ for(const k in keep) fn[k]=keep[k]; }
});

test('Umbris / Thinning: 1 a second while it rots (max 10), lost when the rot ends (Eaten Through keeps it 1 s x 3), Marrow Rot 10% x 3 faster; 0.3% x 5 more damage from him per Thinning',()=>{
  const L=lab(H,S(['sd_1_1']),{foes:2,big:true}), {F}=L; const d=rot(L,F[0],4); secs(2.0); near(rec(L,F[0]).th,2.0,'2 s rotting: 2',0.05);
  secs(5); assert.equal(rec(L,F[0]).th,0,'the rot ended: Thinning gone'); void d;
  rot(L,F[0],99); secs(14); assert.equal(rec(L,F[0]).th,10,'max 10');
  const plainD=plainHit(L,()=>myHit(L,F[0])), d10=myHit(L,F[0]); near(d10/plainD,1+0.003*5*10,'10 Thinning: 15% more');
  /* a DoT tick of his too */
  F[0].dots.length=0; const x=rot(L,F[0],99,'creeprot'); x.dps=1000; const tk=tick1(L,F[0]); near(tk,1000*1.15,'his rot ticks harder',1e-3);
  const L2=lab(H,S(['sd_1_1','sd_2_1','sd_8_1']),{foes:2,big:true}); rot(L2,L2.F[0],2); secs(2.05); near(rec(L2,L2.F[0]).th,2.6,'Marrow Rot: 30% faster',0.08); secs(2.5); assert.ok(rec(L2,L2.F[0]).th>2,'Eaten Through: kept 3 s after'); secs(1.0); assert.equal(rec(L2,L2.F[0]).th,0,'then lost');
});

test('Umbris / Nothing Left to Mend (10 Thinning: no heal, a shield taken off), Hollow Bones (0.2% x 5 armor and MR per Thinning), Ash Grey (5+ Thinning: 3% x 5 slower), Past Mending, Withheld Warmth, Turning It Down',()=>{
  const L=lab(H,S(['sd_1_1','sd_3_1','sd_4_1','sd_5_1','sd_n2']),{foes:2,big:true}), {F}=L; const f=F[0], a0=f.armorRating, m0=f.mrRating, s0=f.speed; rot(L,f,99); secs(10.2);
  assert.equal(Math.floor(rec(L,f).th),10); near(f.armorRating/a0,1-0.01*10,'armor 10% lower',1e-6); near(f.mrRating/m0,1-0.01*10,'MR 10% lower',1e-6); near(f.speed/s0,1-0.15,'15% slower',1e-6);
  f.hp=f.maxHp*0.5; const h=f.hp; V.heal(f,1000); assert.equal(f.hp,h,'no heal at 10 Thinning'); f.shield=500; V.step(1); assert.equal(f.shield,0,'a shield taken off');
  const g=F[1]; rot(L,g,99); V.step(1); g.hp=g.maxHp*0.4; const h2=g.hp; V.heal(g,1000); near(g.hp-h2,1000*(1-0.30),'Past Mending: rotting below 50%: 30% less');
  g.hp=g.maxHp*0.6; const h3=g.hp; V.heal(g,1000); near(g.hp-h3,1000,'above 50%: full');
  const L2=lab(H,S(['wl_2_2','wl_10_3']),{foes:2,big:true}), q=L2.F[0]; field(L2,4.5,0,3,99); V.step(1); q.hp=q.maxHp*0.5; const h4=q.hp; V.heal(q,1000); near(q.hp-h4,1000*0.9,'Withheld Warmth: 10% less in the field');
  q.shield=0; V.step(1); q.shield=1000; V.step(1); near(q.shield,900,'a shield 10% weaker in the field',1e-6);
});

test('Umbris / Borrowed Light (2% x 5 abilities on a fresh enemy), Tended Rot (4% x 5 basic attacks on a rotting one), Deep Thinning (team, 10 Thinning), Withering Energy, Hollow Burst',()=>{
  const L=lab(H,S(['sd_1_3','sd_n1','sd_1_1','sd_11_1','sd_10_3','sd_10_1']),{foes:4,allies:1,big:true}), {v,F,A}=L;
  const p=plainHit(L,()=>myHit(L,F[0])); near(abHit(L,F[0],'creeprot')/p,1.10,'an ability on a fresh enemy: 10% more'); near(myHit(L,F[0],{auto:true})/p,1,'a basic attack on a fresh one: no bonus');
  rot(L,F[0],99); V.step(1); near(abHit(L,F[0],'creeprot')/p,1+0.003*5*Math.floor(rec(L,F[0]).th),'rotting: no Borrowed Light',1e-6); near(myHit(L,F[0],{auto:true})/p,(1+0.20)*(1+0.003*5*Math.floor(rec(L,F[0]).th)),'Tended Rot',1e-6);
  rec(L,F[0]).th=10; const pa=plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))), da=lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})); near(da/pa,1.10,'Deep Thinning: his ally\'s hit 10% more');
  at(L,F[1],4.5,4.2); at(L,F[2],20,0); v.energy=0; kill(L,F[0]); near(v.energy,5,'Withering Energy: 5');
  assert.equal(Math.floor(rec(L,F[1]).th),5,'Hollow Burst: 5 Thinning within 3 m'); assert.equal(Math.floor(rec(L,F[2]).th),0,'not far away');
});

test('Umbris / Lingering Dark talents: Hungry Dark (0.4 m x 5 farther), Generations (4% x 3, one older each spread), Quiet Spread, Fast Breeding, Strong Line, Old Bloodline, Endless Line, Swallowed by the Gap',()=>{
  const L=lab(H,S(['sd_5_4','sd_1_4','sd_12_4','sd_3_4','sd_1_1','sd_8_4','sd_6_4']),{foes:5,big:true}), {v,F}=L;
  /* 4.4 m centre to centre: Lingering Dark alone (2.6 m) would not reach; with Hungry Dark (4.6 m) it does */
  at(L,F[0],4.5,0); at(L,F[2],20,0); castR(L,F[0]); land(L); const d0=dots(L,F[0],'creeprot')[0]; at(L,F[0],4.5,0); at(L,F[1],4.5,4.4); at(L,F[3],30,0); at(L,F[4],30,10); kill(L,F[0]); secs(0.6);
  const s=dots(L,F[1],'spread'); assert.equal(s.length,1,'Hungry Dark: spread to 4.4 m'); assert.equal(s[0]._umG,1,'Generation 1');
  near(s[0].dps,F[0]._plagueDps*(1+0.12)*(1+0.12),'Generations 12% a Generation, Quiet Spread 12%',1e-9);
  const plainLen=VMX('SKLV.contagionDur(contagionLv("enemy"))'); void plainLen; const sLeft=left(s[0]), sDps=s[0].dps;
  assert.equal(Math.floor(rec(L,F[1]).th),3,'Strong Line: 3 Thinning'); void d0;
  /* from Generation 1 to Generation 2 */
  at(L,F[1],4.5,4.4); at(L,F[3],4.5,8.8); kill(L,F[1]); secs(0.6); const s2=dots(L,F[3],'spread'); assert.equal(s2.length,1); assert.equal(s2[0]._umG,2);
  /* the Generation multiplier at its top (5; Endless Line 8); Old Bloodline past the third */
  const fn=L.T.fn, A=L.T.s.api; near(fn.genMul(A,L.T,4),Math.pow(1.12,4)*1.10,'Old Bloodline: past the third, 10% more'); assert.equal(fn.gmax(A,L.T),5);
  const L3=lab(H,S(['sd_1_4','sd_8_4','sd_9_4']),{foes:2,big:true}); assert.equal(L3.T.fn.gmax(L3.T.s.api,L3.T),8,'Endless Line: 8');
  /* Swallowed by the Gap: a death inside his zone spreads 0.5 m x 5 farther */
  const L4=lab(H,S(['sd_12_2']),{foes:4,big:true}), G=L4.F; at(L4,G[1],4.5,4.9); at(L4,G[2],30,0); at(L4,G[3],30,10); ult(L4,G[0]); for(const f of G) f.dots.length=0; at(L4,G[1],4.5,4.9);
  castR(L4,G[0]); land(L4); at(L4,G[0],4.5,0); at(L4,G[1],4.5,4.9); kill(L4,G[0]); secs(0.6); assert.equal(dots(L4,G[1]).length,1,'inside the zone: reach 2.6 + 2.5 m');
  const L0=lab(H,S(['sd_5_4']),{foes:5,big:true}), Q=L0.F; at(L0,Q[2],20,0); castR(L0,Q[0]); land(L0); at(L0,Q[0],4.5,0); at(L0,Q[1],4.5,4.4); at(L0,Q[3],20,-12); at(L0,Q[4],20,10); kill(L0,Q[0]); secs(0.6);
  const s0=dots(L0,Q[1],'spread')[0]; assert.ok(s0,'the plain spread'); near(sLeft-left(s0),0.9,'Fast Breeding: 0.9 s longer',1e-6); near(sDps/s0.dps,1.12*1.12,'Generations and Quiet Spread on the same spread',1e-9);
});

test('Umbris / Creeping Rot: Twin Rot (PICK ONE: the nearest gets the rot), Spreading Foot (1 m x 3, half), Patient Rot (PICK ONE: 3 s, 2 Thinning), Mark Lingers, Rot Worked In, Rot Scholar, Hushed, Eyepiece, Measured Rot',()=>{
  let base=null; plain({foes:4,big:true},P=>{ castR(P,P.F[0]); land(P); const d=P.F[0].dots.find(x=>x.src===P.v); base={dps:d.dps,left:left(d)}; });
  const L=lab(H,S(['sd_5_2','sd_4_2','sd_9_2','sd_2_2','oc_7_3','wl_4_3']),{foes:4,big:true}), {F}=L; at(L,F[1],4.5,4.6); at(L,F[3],10.5,0); at(L,F[2],30,0);
  const h=F[0].hp; castR(L,F[0]); assert.ok(F[0].silencedT>=0.9-1e-9&&F[0].silencedT<1.0,'Hushed: silenced 0.9 s'); land(L);
  const m=dots(L,F[0],'creeprot')[0]; near(m.dps,base.dps*1.15*1.15,'Rot Worked In and Rot Scholar: 15% each',1e-9); near(left(m),base.left+2.0,'Mark Lingers: 2 s longer',0.05);
  assert.equal(dots(L,F[1],'umTwin').length,1,'Twin Rot: the nearest enemy has the rot'); assert.ok(dots(L,F[3],'umFoot').length===1&&Math.abs(dots(L,F[3],'umFoot')[0].dps-m.dps*0.5)<1e-9,'Spreading Foot: within 3 m at half');
  assert.equal(dots(L,F[2]).length,0,'not far away'); void h;
  const L2=lab(H,S(['sd_5_3','sd_1_1','oc_3_3','oc_8_3']),{foes:2,big:true}); castR(L2,L2.F[0]); assert.equal(Math.floor(rec(L2,L2.F[0]).th),2,'Patient Rot: 2 Thinning at once'); land(L2); near(left(dots(L2,L2.F[0],'creeprot')[0]),base.left+3,'and 3 s longer',0.05);
  const p=plainHit(L2,()=>myHit(L2,L2.F[1])); near(abHit(L2,L2.F[1],'creeprot')/p,1.30,'Eyepiece: its hit 30% more'); L2.F[1].hp=L2.F[1].maxHp*0.4; near(abHit(L2,L2.F[1],'creeprot')/p,1.30*1.12,'Measured Rot: 12% more below 50%');
});

test('Umbris / Patient Eyepiece (1% x 3 a second it has run), Fixed Gaze (PICK ONE: the most HP, 2 s longer), Wandering Eye (PICK ONE: the rot moves on), Last Reading, Short Candle, Cold Lens, cooldowns',()=>{
  const L=lab(H,S(['oc_4_3']),{foes:2,big:true}), {F}=L; const d=rot(L,F[0],99,'creeprot'); d.dps=1000; d._umN0=d.remaining; const t1=tick1(L,F[0]); const t2=tick1(L,F[0]); const t3=tick1(L,F[0]);
  assert.ok(t2>t1&&t3>t2,'it grows'); near(t3/t1,(1+0.03*2)/(1+0.03*0),'3% a second it has run',0.02);
  const L2=lab(H,S(['oc_5_3']),{foes:3,big:true}); L2.F[2].hp=L2.F[2].maxHp; L2.F[0].hp=L2.F[0].maxHp*0.5; L2.F[1].hp=L2.F[1].maxHp*0.6; castR(L2,L2.F[0]); land(L2);
  assert.equal(dots(L2,L2.F[2],'creeprot').length,1,'Fixed Gaze: the enemy with the most HP'); assert.equal(dots(L2,L2.F[0]).length,0);
  const L3=lab(H,S(['oc_5_4']),{foes:3,big:true}); castR(L3,L3.F[0]); land(L3); const dl=left(dots(L3,L3.F[0],'creeprot')[0]); kill(L3,L3.F[0]);
  const mv=dots(L3,L3.F[1],'creeprot'); assert.equal(mv.length,1,'Wandering Eye: to the nearest'); near(left(mv[0]),dl,'with its time left',0.05);
  const L4=lab(H,S(['oc_9_3']),{foes:2,big:true}); castR(L4,L4.F[0]); land(L4); L4.v.blueCd=5; L4.F[0].hp=L4.F[0].maxHp*0.21; V.hit(L4.v,L4.F[0],L4.F[0].maxHp*0.02,{kind:'true'}); assert.equal(L4.v.blueCd,0,'Last Reading: reset below 20%');
  L4.v.blueCd=5; V.hit(L4.v,L4.F[0],100,{kind:'true'}); assert.equal(L4.v.blueCd,5,'once per enemy');
  const L5=lab(H,S(['sd_2_3','oc_4_1','sd_9_3','wl_3_1','oc_10_1','wl_n2']),{foes:1,big:true}), c=L5.T.fn, Tt=L5.T; void c;
  const cd=(slot,v)=>VMX('TalentFx.cd')(L5.v,slot,v); near(cd('blue',6),(6*(1-0.03)-0.9-0.9)*(1-0.05)*(1-0.05),'Creeping Rot: 1.8 s off, and 13% shorter (rows in id order)',1e-6); near(cd('green',7),7*(1-0.03)*(1-0.05)*(1-0.05)-0.9,'Shadeburst',1e-6); void Tt;
});

test('Umbris / Shadeburst: Thick Shade, Heavy Burst (5% x 3 each), Grey Air (0.2 m x 5), Long Field (0.3 s x 3), Focused Burst (on Creeping Rot\'s target, half as wide, twice as strong), Star Map',()=>{
  let base=null; plain({foes:3,big:true},P=>{ castS(P,P.F[0]); land(P); const d=P.F[0].dots.find(x=>x.src===P.v); base={dps:d.dps,left:left(d)}; });
  const L=lab(H,S(['sd_4_3','oc_6_1','wl_5_2','wl_6_2']),{foes:3,big:true}), {F}=L; castS(L,F[0]); const f=um(L).f[0]; near(f.R/V.METER,7+1,'Grey Air: 1 m wider',1e-6); near(f.t,6+0.9,'Long Field: its field 0.9 s longer',1e-6); land(L);
  const d=dots(L,F[0],'shadeburst')[0]; near(d.dps,base.dps*1.15*1.15,'15% and 15%',1e-9); near(left(d),base.left+0.9,'its rot 0.9 s longer',0.05);
  const L2=lab(H,S(['oc_7_1']),{foes:4,big:true}), G=L2.F; at(L2,G[3],30,0); castR(L2,G[3]); land(L2); for(const x of G) if(x!==G[3]) x.dots.length=0; castS(L2,G[0]); land(L2);
  const z=um(L2).f[um(L2).f.length-1]; near(Math.hypot(z.x-G[3].x,z.y-G[3].y),0,'Focused Burst: on Creeping Rot\'s target',1e-6); near(z.R/V.METER,3.5,'half as wide',1e-6);
  near(dots(L2,G[3],'shadeburst')[0].dps,base.dps*2,'twice as strong',1e-9); assert.equal(dots(L2,G[0],'shadeburst').length,0,'the cluster gets nothing');
});

test('Umbris / the field: Seeping Field (33% x 3 a second: a second Thinning), No Warmth (2% x 5 slower), Field of Rot (a death inside it spreads, no rot needed)',()=>{
  const L=lab(H,S(['sd_1_1','sd_6_2','wl_9_2']),{foes:2,big:true}), {F}=L; const s0=F[0].speed; field(L,4.5,0,3,99); rot(L,F[0],99); secs(3.05);
  near(rec(L,F[0]).th,3+3,'1 a second rotting and (99%) one more a second in the field',1.05); near(F[0].speed/s0,0.90,'10% slower in the field',1e-6);
  const L2=lab(H,S(['sd_7_2','sd_5_4']),{foes:3,big:true}), G=L2.F; at(L2,G[1],4.5,4.4); at(L2,G[2],30,0); field(L2,4.5,0,3,99); V.step(1); G[0]._plagueDps=50; at(L2,G[0],4.5,0); at(L2,G[1],4.5,4.4); kill(L2,G[0]); secs(0.6);
  assert.equal(dots(L2,G[1],'spread').length,1,'Field of Rot: it carried no rot of his, it spread (reach 2.6 m + Hungry Dark 2 m)'); assert.equal(dots(L2,G[2]).length,0);
});

test('Umbris / the zone: Vast Hole, Weighed Light, The Gap Opens (3% x 5 each), Wide Gap (0.2 m x 5), Seeping Hole (1 Thinning x 3 a tick), Gnawing Dark (2% x 3, inside 1.2% a second)',()=>{
  let base=null; plain({foes:2,big:true},P=>{ const h=P.F[0].hp; ult(P,P.F[0]); const z=zones(P)[0]; base={hit:h-P.F[0].hp,pd:z.pd,r:z.r}; });
  const L=lab(H,S(['sd_7_3','wl_9_3','oc_7_2','sd_8_3','sd_11_2','sd_1_1','sd_6_1']),{foes:2}), {v,F}=L; const h=F[0].hp; ult(L,F[0]); const z=zones(L)[0];
  near((h-F[0].hp)/base.hit,Math.pow(1.15,3)*(1+0.003*5*Math.floor(rec(L,F[0]).th)),'its first hit',1e-6); near(z.pd/base.pd,Math.pow(1.15,3),'its zone',1e-9); near((z.r-base.r)/V.METER,1.0,'1 m wider',1e-6);
  const t0=rec(L,F[0]).th; secs(1.05); const t1=rec(L,F[0]).th; assert.ok(t1>=t0+3&&t1<t0+3.3,'Seeping Hole: 3 at its first tick: '+t0+' -> '+t1);
  rec(L,F[0]).th=10; v.hp=v.maxHp*0.5; um(L).rb=1e9; const hv=v.hp, hp0=F[0].hp; secs(1.0); const got=hv-hp0; void got; assert.ok(v.hp>hv,'Gnawing Dark heals him');
  um(L).rb=0; const hv2=v.hp; V.step(1); near(v.hp,hv2+0.012*v.maxHp*V.STEP*0,'with an empty budget nothing more this tick',1e-3);
});

test('Umbris / Nothing Between the Stars (SIGNATURE): each death inside the zone widens it 1 m and 1 s (up to 6), full Thinning inside, and the rot spreads to every enemy in it',()=>{
  const L=lab(H,S(['sd_13_2','sd_1_1']),{foes:5,big:true}), {F}=L; at(L,F[1],7,3); at(L,F[2],2,3.5); at(L,F[3],30,0); at(L,F[4],30,12); ult(L,F[0]); V.step(1);
  assert.equal(Math.floor(rec(L,F[1]).th),10,'inside: full Thinning'); assert.equal(Math.floor(rec(L,F[3]).th),0,'outside: none');
  const z=zones(L)[0], r0=z.r; castR(L,F[0]); land(L); const l0=z.life; at(L,F[1],7,3); at(L,F[2],2,3.5); kill(L,F[0]); near((z.r-r0)/V.METER,1,'1 m wider',1e-9); near(z.life-l0,1,'1 s longer',0.05); secs(0.6);
  assert.ok(dots(L,F[1]).length>=1&&dots(L,F[2]).length>=1,'the rot spread to every enemy in the zone (5 m and more away)'); assert.equal(dots(L,F[3]).length,0,'not outside');
  for(let i=0;i<8;i++){ const x=F[1]; x.hp=x.maxHp; } z._umN=6; const r1=z.r; F[2].hp=1; V.hit(L.v,F[2],100,{kind:'true'}); near(z.r,r1,'never more than 6 m more',1e-9);
});

test('Umbris / Dimmed: misses (Dimming 2% x 5 + Faint Glow 1 point x 3, on him and on an ally), Lamps Out (no critical), Night Eyes, Shortened Sight, Turned Down, No Cover Left, Darker Still',()=>{
  const L=lab(H,S(['wl_1_4','wl_12_2','wl_3_4','wl_8_4','wl_4_2','wl_n3','wl_2_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; field(L,4.5,0,3,99); V.step(1); assert.ok(rec(L,F[0]).dim,'inside the field: Dimmed'); assert.ok(!rec(L,F[1]).dim);
  let miss=0, N=600; for(let i=0;i<N;i++){ if(hitOn(L,100,{auto:true})===0) miss++; } const p=miss/N; assert.ok(p>0.13-0.045&&p<0.13+0.045,'about 13% of his basic attacks miss him: '+p);
  let m2=0; for(let i=0;i<N;i++){ if(hitAl(L,A[0],100,{auto:true})===0) m2++; } assert.ok(m2/N>0.13-0.045&&m2/N<0.13+0.045,'and his ally: '+m2/N);
  let m3=0; for(let i=0;i<200;i++){ if(hitOn(L,100,{auto:true,src:F[1]})===0) m3++; } assert.equal(m3,0,'a plain enemy never misses');
  let m4=0; for(let i=0;i<200;i++){ if(hitOn(L,100,{auto:false})===0) m4++; } assert.equal(m4,0,'skills never miss');
  const pc=plainHit(L,()=>hitOn(L,1000,{src:F[1],crit:true})), dc=(()=>{ let x=0; for(let i=0;i<40&&!x;i++) x=hitOn(L,1000,{crit:true,auto:false}); return x; })(); near(dc,pc/(1+(F[1].critDmg||0.6)),'Lamps Out: a critical hit lands as a plain one',1e-6);
  const r0=VMX('units').find(x=>x===F[0]).range; void r0; const L0=lab(H,null,{foes:1}); const plainR=L0.F[0].range;
  const L2=lab(H,S(['wl_8_4','wl_4_2','wl_n3','wl_2_4','wl_6_4']),{foes:2,big:true}), G=L2.F; field(L2,4.5,0,3,99); V.step(1); near(G[0].range/plainR,0.88,'Shortened Sight: 12% shorter',1e-9);
  G[0].dmgBuffT=10; G[0].shield=1000; secs(1.0); near(G[0].dmgBuffT,10-1.3*1.0,'Turned Down: buffs run out 30% faster',0.06); assert.ok(G[0].shield<1000*Math.pow(1-0.20*V.STEP,30)*1.01&&G[0].shield<850,'No Cover Left: 20% a second: '+G[0].shield);
  const pn=plainHit(L2,()=>hitOn(L2,1000)), dn=hitOn(L2,1000); near(dn/pn,0.95,'Night Eyes: 5% less');
  um(L2).f.length=0; secs(2.0); assert.ok(rec(L2,G[0]).dim,'Darker Still: still Dimmed 2 s after the field'); secs(1.3); assert.ok(!rec(L2,G[0]).dim,'then not'); near(G[0].range,plainR,'its reach back',1e-9);
});

test('Umbris / Dimmed Hand (once every 15 s a Dimmed enemy\'s next ability: half), Withdrawn (1.5% x 5), Unlit (PICK ONE), Withholding (PICK ONE), No Stars Overhead, The Dim Hour',()=>{
  const L=lab(H,S(['wl_9_4','wl_11_4','wl_1_4']),{foes:2,big:true}), {v,F}=L; rot(L,F[0],99,'creeprot'); V.step(1); assert.ok(rec(L,F[0]).dim,'Creeping Rot\'s mark Dims');
  const p=plainHit(L,()=>hitOn(L,1000)); near(hitOn(L,1000)/p,1-0.075,'Withdrawn: 7.5% less from a Dimmed enemy');
  VMX('TalentFx.teamCast')(F[0],'stun',{}); near(hitOn(L,1000)/p,0.5*(1-0.075),'Dimmed Hand: its ability at half'); secs(2.1); near(hitOn(L,1000)/p,1-0.075,'2 s later: whole');
  VMX('TalentFx.teamCast')(F[0],'stun',{}); near(hitOn(L,1000)/p,1-0.075,'once every 15 s');
  const L2=lab(H,S(['wl_5_4']),{foes:2,big:true}), G=L2.F; G[0].greenAb={cd:5}; G[0].greenCd=2; rot(L2,G[0],1.0,'creeprot'); secs(1.5); assert.ok(rec(L2,G[0]).dim,'Unlit: Dimmed after the mark ended');
  assert.ok(G[0].greenCd>=2+1.5-0.01,'its cooldown set back 1.5 s'); secs(3.1); assert.ok(!rec(L2,G[0]).dim,'for 3 s');
  const L3=lab(H,S(['wl_5_3']),{foes:2,big:true}), Q=L3.F; rot(L3,Q[0],99,'creeprot'); V.step(1); Q[0].energy=10; V.step(1); assert.equal(Q[0].energy,(rec(L3,Q[0]).en),'Withholding: no energy'); Q[1].energy=10; V.step(1); assert.equal(Q[1].energy,10,'a plain enemy keeps it');
  const L4=lab(H,S(['wl_8_3','wl_12_3']),{foes:2,allies:1,big:true}), Z=L4.F; ult(L4,Z[0]); V.step(1); assert.ok(rec(L4,Z[0]).dim&&rec(L4,Z[0]).inZ,'No Stars Overhead: Dimmed in the zone');
  const pz=plainHit(L4,()=>myHit(L4,Z[0])); near(myHit(L4,Z[0])/pz,1.10,'and 10% more damage from him'); const pa=plainHit(L4,()=>hitAl(L4,L4.A[0],1000)); near(hitAl(L4,L4.A[0],1000)/pa,0.90,'The Dim Hour: 10% less to an ally');
});

test('Umbris / Correction: every 8 s the brightest enemy (2% x 5 attack and ability power, 8 s), Second Correction, Scrutiny, Strict Reader, Brightness Taxed, Correcting Hand, Marked Down, Every Light Checked, Bright Ones Fall',()=>{
  const L=lab(H,S(['wl_1_1','wl_6_1','wl_10_1','wl_2_1','wl_4_1','wl_7_1','wl_n1','sd_1_1','wl_11_1','wl_8_1']),{foes:3,big:true}), {v,F}=L;
  const a0=F.map(f=>f.dmg), p0=F.map(f=>f.apow), i0=F.map(f=>f.atkInterval); near(um(L).cor.cd,5,'Every Light Checked: every 5 s',0.05);
  hitOn(L,3000,{src:F[1]}); hitOn(L,1000,{src:F[0]}); um(L).cor.cd=0.001; rot(L,F[1],99); V.step(2); const C=um(L).cor;
  assert.equal(C.m,F[1],'the brightest'); assert.equal(C.s,F[0],'the second'); near(C.t,8+3,'Strict Reader: 11 s',0.1);
  near(F[1].dmg/a0[1],0.90,'10% attack',1e-9); near(F[1].apow/p0[1],0.90,'10% ability power',1e-9); near(F[0].dmg/a0[0],1-0.10*0.75,'the second: 75% of it',1e-9);
  near(i0[1]/F[1].atkInterval,1-0.09,'Scrutiny: 9% slower attacks',1e-9); assert.equal(F[2].dmg,a0[2],'the third untouched');
  assert.ok(rec(L,F[1]).dimL>3.9,'Marked Down: Dimmed 4 s'); assert.ok(rec(L,F[1]).th>=1,'and 1 Thinning (it rots)');
  const p=plainHit(L,()=>myHit(L,F[1])); near(myHit(L,F[1])/p,1.10*(1+0.003*5*Math.floor(rec(L,F[1]).th)),'Brightness Taxed 10%',1e-6); near(abHit(L,F[1],'creeprot')/p,1.10*1.10*(1+0.003*5*Math.floor(rec(L,F[1]).th)),'Correcting Hand 10% more for abilities',1e-6);
  hitOn(L,500,{src:F[2]}); v.energy=0; kill(L,F[1]); assert.equal(um(L).cor.m,F[2],'Every Light Checked: it moves at once'); near(v.energy,15,'Bright Ones Fall: 15 energy');
  V.step(1); near(F[2].dmg/a0[2],0.90,'and the new one loses 10%',1e-9);
  const L2=lab(H,S(['wl_1_1']),{foes:2,big:true}); um(L2).cor.cd=0.001; V.step(2); assert.equal(um(L2).cor.m,null,'no damage dealt: nobody is the brightest'); assert.equal(um(L2).cor.cd>7,true);
});

test('Umbris / Shroud of Shade: an enemy outside the field that picks his ally inside it picks one outside instead; not over a taunt',()=>{
  const L=lab(H,S(['wl_7_2']),{foes:2,allies:2,big:true}), {v,F,A}=L; at(L,A[0],8,10); at(L,A[1],-6,-8); at(L,F[0],15,10); at(L,F[1],18,-14); field(L,8,10,3,99); V.step(1); assert.equal(A[0]._talShd,v);
  freeFoe(F[0]); still(F[0]); V.step(1); assert.notEqual(F[0].target,A[0],'not the ally in the shade'); assert.ok(F[0].target===v||F[0].target===A[1]);
  F[0].forcedTarget=A[0]; F[0].forcedTargetT=5; V.step(1); assert.equal(F[0].target,A[0],'a taunt wins');
  F[0].forcedTargetT=0; at(L,F[0],9,13.5); V.step(1); assert.equal(F[0].target,A[0],'an enemy inside the field picks as before');
});

test('Umbris / Candle and Stare: 20 s, then 1 a second (max 15, Night Vigil 20), 0.3% x 5 ability power each; a stun halves it (Lidless: no); Short Wick, Burned Down, Small Hours, Wick Smoke, Reader\'s Calm',()=>{
  const L=lab(H,S(['oc_1_2','oc_2_2','oc_6_2','oc_8_2','oc_12_4','oc_12_1']),{foes:2,big:true}), {v,F}=L; near(um(L).cdl,20-6,'Short Wick: 14 s',0.05);
  const ap0=v.apow; at(L,F[0],5,0); at(L,F[1],20,0); um(L).cdl=0.01; V.step(1); assert.equal(stack(L,'umStare'),9,'Burned Down: 9 at once'); assert.ok(rec(L,F[0]).cs>1.9&&!(rec(L,F[1]).cs>0),'Wick Smoke: within 6 m');
  const s0=F[1].speed; near(F[0].speed/(s0),0.70,'30% slower',1e-6); secs(1.0); assert.equal(stack(L,'umStare'),10); near(v.apow/ap0,(1+0.015*10)/(1+0.015*0),'1.5% ability power per Stare',1e-6);
  secs(6); assert.equal(stack(L,'umStare'),15,'max 15'); const p=plainHit(L,()=>myHit(L,F[0],{auto:true})); near(myHit(L,F[0],{auto:true})/p,1.30,'Small Hours: 30% at 15');
  const ph=plainHit(L,()=>hitOn(L,1000)); near(hitOn(L,1000)/ph,1-0.05*3,'Reader\'s Calm: 5% for every 5 Stare');
  v.stunned=0; V.step(1); v.stunned=2; V.step(1); assert.equal(stack(L,'umStare'),7,'a stun halves it (15 -> 7)'); hold(L);
  const L2=lab(H,S(['oc_1_2','oc_3_2','oc_10_2']),{foes:1,big:true}); setStare(L2,20); assert.equal(L2.T.fn.stTick.length>0,true); L2.v.stunned=0; V.step(1); L2.v.stunned=2; V.step(1); assert.equal(stack(L2,'umStare'),20,'Lidless: no halving; Night Vigil: 20');
  const L3=lab(H,S(['oc_1_2']),{foes:1,big:true}); um(L3).cdl=0.01; V.step(1); secs(3.0); const n=stack(L3,'umStare'); VMX('resetPerWave(); beginWaveEnter(); waveXfer=null;'); V.step(2); assert.equal(stack(L3,'umStare'),0,'a new wave: the Candle is lit again'); assert.ok(n>=3); near(um(L3).cdl,20,'20 s',0.1);
});

test('Umbris / Deep Stare (0.1% x 5 magic resist a Stare), Burned Eyes (at full Stare 4% x 3), Gap Reading (3% x 3): his abilities ignore that share of magic resist',()=>{
  const L=lab(H,S(['wl_1_3','oc_5_2','oc_11_2','oc_10_2']),{foes:1,big:true}), {F}=L; const t=F[0]; t.mrRating=400; setStare(L,20);
  const x=0.09+0.005*20+0.12, a=VMX('defMul')(L.v,t,'magic'); const sv=t.mrRating; t.mrRating=sv*(1-x); const b=VMX('defMul')(L.v,t,'magic'); t.mrRating=sv;
  const p=plainHit(L,()=>myHit(L,t,{kind:'magic'})); near(abHit(L,t,'creeprot',{kind:'magic'})/p,b/a,'31% of its magic resist ignored',1e-6); near(myHit(L,t,{kind:'magic'})/p,1,'not by his basic attacks');
});

test('Umbris / Two Stars: Creeping Rot\'s target and its nearest for 6 s (Distant Light 0.4 s x 5), 6% x 5 echo (Drifting Apart 3% x 3 a 2 m), Bound Orbits, Star Map, Pulled Apart, Night Ink, Paired Again',()=>{
  const L=lab(H,S(['oc_1_4','oc_3_4','oc_2_4','oc_4_4','oc_9_4','oc_1_1']),{foes:3,big:true}), {v,F}=L; at(L,F[1],14.5,0); at(L,F[2],40,0); const s1=F[1].speed;
  castR(L,F[0]); const pr=um(L).pr[0]; assert.ok(pr&&pr.a===F[0]&&pr.b===F[1],'paired with the nearest'); near(pr.t,6+2,'8 s',0.05);
  const gap=gapM(F[0],F[1]), st=Math.min(4,Math.floor(gap/2)); const h=F[1].hp; const got=myHit(L,F[0]); near(h-F[1].hp,got*0.30*(1+0.09*st),'the echo: 30% (and '+st+' steps of 9%)',1e-6);
  V.step(1); near(F[1].speed/s1,0.90,'Bound Orbits: 10% slower',1e-9);
  F[0].hp=F[0].maxHp; F[1].hp=F[1].maxHp*0.5; const p=plainHit(L,()=>myHit(L,F[2])); F[2].hp=F[2].maxHp*0.99; near(abHit(L,F[0],'creeprot')/p,1.06,'Night Ink: the most HP');
  const h2=F[1].hp; kill(L,F[0]); near(h2-F[1].hp,0.75*v.apow*VMX('defMul')(v,F[1],'magic')*VMX('elemMul')(v,F[1]),'Pulled Apart: 75% of his ability power',1e-6); assert.equal(um(L).pr.filter(q=>q.t>0).length,0,'the pair is over');
  const L2=lab(H,S(['oc_6_4','oc_1_4']),{foes:2,big:true}); castR(L2,L2.F[0]); const d=rot(L2,L2.F[1],99,'shadeburst'); d.dps=1000; const tk=tick1(L2,L2.F[1]); near(tk,1000*1.15,'Star Map: 15% more Shadeburst rot on a star',0.01);
  const L3=lab(H,S(['oc_12_3']),{foes:4,big:true}); at(L3,L3.F[1],6,1); at(L3,L3.F[2],30,0); at(L3,L3.F[3],30,6); ult(L3,L3.F[0]); assert.ok(um(L3).pr.length>=2,'Paired Again: 99% each enemy the first hit struck');
});

test('Umbris / The Second Candle (SIGNATURE): full Stare arms his next ultimate; it strikes only the enemy with the most HP in its circle for 4 times, its zone opens there; Stare full 6 s; no second candle',()=>{
  let base=0; plain({foes:3,big:true},P=>{ const h=P.F[0].hp; ult(P,P.F[0]); base=h-P.F[0].hp; });
  const L=lab(H,S(['oc_1_2','oc_13_3']),{foes:3,big:true}), {v,F}=L; at(L,F[1],7,2); at(L,F[2],30,0); um(L).cdl=0.01; V.step(1); setStare(L,15); V.step(1); assert.ok(um(L).armed,'armed at full Stare');
  setStare(L,3); V.step(1); assert.ok(um(L).armed,'still armed when it drops'); F[1].hp=F[1].maxHp; F[0].hp=F[0].maxHp*0.5;
  const h0=F[0].hp, h1=F[1].hp; VMX('var __udbg=[]; var __udd=_dealDamageCore; _dealDamageCore=function(s,t,a){ if(t&&t.uid==='+F[0].uid+') __udbg.push([s&&s.key,Math.round(a),s&&s._tal&&s._tal.s.cur,+battleTime.toFixed(2)]); return __udd.apply(this,arguments); };'); try{ ult(L,F[0]); } finally{ VMX('_dealDamageCore=__udd;'); } if(F[0].hp!==h0) console.log('  DEBUG hits on F0: '+JSON.stringify(VMX('__udbg'))); assert.equal(F[0].hp,h0,'the others take no first hit'); near((h1-F[1].hp)/base,4*(1+0.015*3),'4 times its first hit on the one with the most HP (his ability power with 3 Stare at the cast)',1e-6);
  const z=zones(L)[0]; near(Math.hypot(z.x-F[1].x,z.y-F[1].y),0,'its zone opens there',1e-6); near(z.r/V.METER,6.8,'its full zone',1e-6); assert.ok(!um(L).armed);
  assert.equal(stack(L,'umStare'),15,'full'); v.stunned=0; V.step(1); v.stunned=2; V.step(1); assert.equal(stack(L,'umStare'),15,'kept full for 6 s'); hold(L);
  VMX('resetPerWave(); beginWaveEnter(); waveXfer=null;'); V.step(2); assert.equal(um(L).cdl,0,'no second candle'); assert.ok(stack(L,'umStare')>0,'the Stare kept');
});

test('Umbris / The Lamp Turned Down (SIGNATURE): 6 s after his ultimate lands, every enemy Dimmed, the brightest Corrected at triple strength and stripped of its buffs',()=>{
  const L=lab(H,S(['wl_1_1','wl_1_4','wl_13_3']),{foes:3,big:true}), {F}=L; const a0=F[2].dmg; at(L,F[2],40,0); hitOn(L,2000,{src:F[2]}); F[2].dmgBuffT=5; F[2].dmgBuffMul=1.5; F[2].hasteT=4; ult(L,F[0]); V.step(1);
  assert.ok(F.every(f=>rec(L,f).dim),'every enemy Dimmed, wherever it stands'); assert.equal(um(L).cor.m,F[2]); near(F[2].dmg/a0,1-0.30,'triple strength: 30%',1e-9); assert.equal(F[2].dmgBuffT,0,'its buffs stripped'); assert.equal(F[2].hasteT,0);
  secs(6.1); assert.ok(!rec(L,F[1]).dim,'after 6 s not'); near(F[2].dmg/a0,0.90,'back to Correction\'s own',1e-9);
});

test('Umbris: the caps - his damage reduction ONE group of 35%, his allies\' ONE group of 15%, his slows 40%, Unwavering 20%, the 1.2% regeneration budget',()=>{
  const ALL=S(['sd_7_1','wl_6_4','wl_12_3','wl_11_4','wl_12_4','oc_10_4','oc_12_1','oc_11_4','oc_1_2','oc_10_2','wl_3_3','sd_5_1','wl_9_2','oc_4_4','oc_12_4','oc_5_1','sd_1_1']);
  const L=lab(H,ALL,{foes:2,allies:1,big:true}), {v,F,A}=L; const f=F[0], A0=L.T.s.api, Tt=L.T, fn=Tt.fn; rot(L,f,99,'creeprot'); V.step(1); const r=rec(L,f); r.dim=true; r.inZ=true; r.rot=true; setStare(L,20); at(L,f,14,0); f.key='sylthaine';
  try{ const k=fn.drK(A0,Tt,v,f,'phys',0.2*v.maxHp,false); near(k,0.65,'all at once: held at 35%',1e-9);
    const each={'dr.fade':0.05,'dr.ne':0.05,'dr.dh':0.10,'dr.wd':0.075,'dr.ur':0.09,'dr.ph':0.09}; let prod=1; for(const k2 in each){ near(Tt.P[k2],each[k2],k2,1e-9); prod*=1-each[k2]; }
    prod*=1-0.20; prod*=1-0.30; assert.ok(prod<0.65,'they would ask '+((1-prod)*100).toFixed(1)+'%');
    near(fn.alK(A0,Tt,v,f),0.85,'his allies: held at 15% (they ask '+((1-0.95*0.95*0.90)*100).toFixed(1)+'%)',1e-9);
    r.cr=true; r.th=10; r.inF=true; r.cs=2; um(L).pr.push({a:f,b:F[1],t:99}); near(fn.slowK(A0,Tt,v,{tgt:f}),0.40,'slows: 40%',1e-9);
    near(VMX('TalentFx.cc')(F[1],v,'stunned',2,false),2*0.80,'Unwavering: 20%',1e-9); } finally{ f.key='vael'; }
  const L2=lab(H,S(['sd_6_1','sd_1_1']),{foes:1}), q=L2.F[0], w=L2.v; rec(L2,q).th=10; w.hp=w.maxHp*0.2; um(L2).rb=0.012*w.maxHp; const h=w.hp;
  L2.T.fn.gnaw(L2.T.s.api,L2.T,w,q,1e9); near(w.hp-h,0.012*w.maxHp,'at most one second of the budget at once',1e-6); const h2=w.hp; L2.T.fn.gnaw(L2.T.s.api,L2.T,w,q,1e9); near(w.hp,h2,'then nothing',1e-9);
});

test('Umbris: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H).filter(([id])=>!['sd_5_2','wl_5_4','oc_5_4'].includes(id)), TEAM=['vael','sylthaine','vireo','vex','umbris'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let th=0, cor=0, dim=0, st=0, fld=0, pr=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const m=s._tal.s.um; if(!m) continue; for(const k in m.e){ th=Math.max(th,m.e[k].th); if(m.e[k].dim) dim++; } if(m.cor.m) cor++; st=Math.max(st,stack({T:s._tal},'umStare')); if(m.f.length) fld++; if(m.pr.length) pr++; }
  assert.ok(th>=3,'real Thinning: '+th.toFixed(1)); assert.ok(cor>0,'a real Correction'); assert.ok(dim>0,'real Dimmed enemies'); assert.ok(fld>0,'a real field');
  console.log('  live fight: Thinning max '+th.toFixed(1)+', Corrected ticks '+cor+', Dimmed enemy-ticks '+dim+', Stare max '+st+', field ticks '+fld+', star ticks '+pr);
  determinism(H,TEAM);
});

/* With nothing learned, whole seeded fights with Umbris in the line-up are identical to the pre-talent page (ee8edab8), seed by seed, and reach every page site his
   talents added: Shadeburst's case, the orb's landing, the zone's ticks, enemies picking targets (the shade line). */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Umbris: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every page site his talents added',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['umbris','vael','vireo','sylthaine','gruel'], foeTeam=['grosk','kharos','konwu','carn','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __ubN={sb:0,land:0,zone:0,picks:0}; var __ubD=_doEffectCore, __ubV=updateVoidZones, __ubTh=think;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="umbris"&&type==="shadeburst"&&(!o||!o.deliver||o._arrived)) __ubN.sb++; return __ubD.apply(this,arguments); };'+
    'updateVoidZones=function(dt){ for(const z of voidZones) if(z.acc+dt>=z.interval) __ubN.zone++; return __ubV.apply(this,arguments); };'+
    'think=function(u,dt){ if(u&&u.key==="umbris"&&u._voidLandT>0&&u._voidLandT<=dt+1e-9) __ubN.land++; if(u&&!u.stunned) __ubN.picks++; return __ubTh.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__ubN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.sb>0&&c.land>0&&c.zone>0&&c.picks>0,'the fights cast Shadeburst ('+c.sb+'), landed the orb ('+c.land+'), ticked the zone ('+c.zone+') and picked targets ('+c.picks+')'); }
  finally{ VMX('_doEffectCore=__ubD; updateVoidZones=__ubV; think=__ubTh;'); }
  assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. His base kit has no reduction of its own; his talent
   reductions are one capped group (35%). Each candidate build is 91 points legal; the most defensive is the one whose worst hit is reduced most. Misses
   (Dimmed) are not reductions and are left out; Dimmed Hand (an ability at half) and Lamps Out (a critical hit made plain) are counted. */
const DEF={ sd:['sd_7_1'],
            wl:['wl_6_4','wl_12_3','wl_11_4','wl_12_4','wl_9_4','wl_3_4','wl_1_4','wl_11_2'],
            oc:['oc_10_4','oc_12_1','oc_11_4','oc_1_2','oc_10_2','oc_8_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sd:0,wl:1,oc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[14,0,15.5,4.5][i]*V.METER; f.y=v.y+[0,5,0,12][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,0,0,-5][i]*V.METER; a.y=v.y-[5.5,11,16.5,5][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on him: every condition of his reduction talents true at once - the attacker rotting, Dimmed, inside his zone, more than 8 m away, a back-row hero,
   his Stare full, the hit above 15% of his max HP (Cloth Over Nothing ready); a skill hit (Dimmed Hand's half) or a critical one (Lamps Out). Physical and magic,
   with his armour and magic resist; and again with glyph damage reduction at its 30% cap. */
function worstHit(list,kind,crit,glyph,auto){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=4e5; v.hp=0.9*v.maxHp; v.shield=0; v.glyphDR=glyph||0; const key=f.key; f.key='sylthaine';
  try{ if(L.T&&L.T.s.um){ const um=L.T.s.um, r=um.e[f.uid]||(um.e[f.uid]={th:0,keep:0,zT:0,dimL:0,dim:false,rot:false,cr:false,inF:false,inZ:false,sh:0,en:0,lt:0,lw:0,rg:null,cs:0});
      V.dot(f,1,99,1,v); const d=f.dots[f.dots.length-1]; d._talO=v.uid; d._talK='creeprot'; Object.assign(r,{dim:true,rot:true,inZ:true,lw:auto?0:2,cr:true}); um.con=0;
      if(L.T.st.umStare){ const k=L.T.s.k.umStare||(L.T.s.k.umStare={n:0,t:0,idle:0}); k.n=VMX('TalentFx.api()').stMax(L.T,v,'umStare'); } }
    const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:!!auto}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return x>0?1-x/(raw*cm*VMX('elemMul')(f,v)):-1; }
  finally{ f.key=key; } }
test('Umbris: his most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and he is at 85% or more for well under half a fight',()=>{
  const cands=[[['wl','oc'],[61,30]],[['oc','wl'],[61,30]],[['wl','sd'],[61,30]],[['oc','sd'],[61,30]],[['sd','wl'],[61,30]],[['sd','oc'],[61,30]],[['wl'],[91]],[['oc'],[91]],[['sd'],[91]],[['oc','wl','sd'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  const worstOf=(list,glyph)=>{ let w=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const auto of [false,true]){ let x=-1; for(let i=0;i<30&&x<0;i++) x=worstHit(list,kind,crit,glyph,auto); w=Math.max(w,x); } return w; };
  for(const c of cands){ c.worst=worstOf(c.list,0); c.worstG=worstOf(c.list,0.30); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=worstOf(null,0), noneG=worstOf(null,0.30);
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="umbris"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="umbris"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1), q=(T&&T.s.api&&T.s.um)?T.fn.drK(T.s.api,T,u,s,"phys",0,false):1;'+
    '    const kp=k*defMul(s,u,"phys")*q, km=k*defMul(s,u,"magic")*q;'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','umbris'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>20&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune');
    assert.ok(d.te85<0.25*d.t,'at 85% or more for well under half of his time in the fights ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* He has no stun at all (base kit or talents: Hushed is a silence). Seeded fights with every talent learned: no stun of his lands on anyone */
test('Umbris: no stun of his ever lands (his only talent control is Hushed\'s silence, 0.9 s at its written length)',()=>{
  VMX('var __us={st:0,sil:0,silMax:0}; var __usC=ccApply; ccApply=function(u,t,f,d){ const r=__usC.apply(this,arguments); if(u&&u.key==="umbris"&&f==="stunned") __us.st++; return r; };'+
      'var __usT=TalentFx.ccHit; ');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','umbris'].map(k=>Object.assign(spec(k,100,k===H?everything(H):null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242]]) campaign(sn,node,seed);
    const c=VMX('__us'); assert.equal(c.st,0,'no stun'); }
  finally{ VMX('ccApply=__usC;'); }
});
