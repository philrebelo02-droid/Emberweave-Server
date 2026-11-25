'use strict';
/* Ceraline's talents as data on the mechanics layer (talents-mech/ceraline.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Ceraline, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5) A1 (0,-11). Bodies about 2 m.
   Lab units are HELD (stunned 1e6). free() lets one go (and makes her controls land on it: level 1).
   Run: node --test tests/talents-mech-ceraline.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='ceraline', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur,v)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:v==null?0:v}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const free=x=>{ x.stunned=0; x.silencedT=0; x.speed=0; x.level=1; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage)
const coat=(L,t,d)=>{ t._waxCoatT=d==null?6:d; t._waxCoatBy=L.v; };
const waxIt=(t,n)=>{ for(let i=0;i<(n||1);i++) VMX('waxOnCaster')(t); };
const ENC=()=>0.7*VMX('tallowEncase')(10);                                            // Living Tallow's encase at the lab's passive level 10, as it lands (x 0.7)
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const clk=(L,key)=>{ const l=L.T.s.lim[key]; if(l) l.acc=0; };                        // a periodic row's clock starts again now
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };   // a control that lands (no resist)
/* a hit of hers while a skill (or a part of one) of hers resolves, against the same hit with her talents off */
function ratio(L,t,cur,o){ o=o||{}; const s=L.T.s, c0=s.cur; s.cur=cur; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o))); } finally{ s.cur=c0; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o)))); }
const apB=L=>L.v.apow*VMX('skillMul')(10);
const defM=(L,t)=>VMX('defMul')(L.v,t,'magic');
/* the seal of Sealing Wax setting on t now (its own timer runs out on t's next think) */
/* steps up to n ticks; the first drag written on f (where to, its stopping distance), or null */
function pulled(f,n){ f.pulledBy=null; for(let i=0;i<(n||6);i++){ V.step(1); if(f.pulledBy) return {x:f.pulledBy.x,y:f.pulledBy.y,stop:f.pullStop}; } return null; }
function seal(L,t){ free(t); t._sealT=1e-6; t._sealBy=L.v; t._sealStun=3.5; V.step(1); }
/* her ultimate on F[0]; steps through the pour, the statues and the bursts, keeping each enemy's longest stun and slow */
function ult(L,s){ const {v,F}=L; const mx=F.map(()=>({st:0,sl:0,sm:1})); V.cast(v,'ult',F[0]);
  for(let i=0;i<Math.round((s||4)/V.STEP);i++){ V.step(1); F.forEach((f,j)=>{ mx[j].st=Math.max(mx[j].st,f.stunned||0); mx[j].sl=Math.max(mx[j].sl,f.slow||0); mx[j].sm=Math.min(mx[j].sm,f.slowMul==null?1:f.slowMul); }); }
  return mx; }

test('Ceraline: every talent is accounted for - 9 plain stats, 109 with rows, none waiting',()=>{
  accounting(H,[118,9,109,0,0]);
  const M=FXN.mech(H); for(const id of ['gl_1_1','nc_1_1','ho_1_1','gl_13_2','nc_13_3','ho_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['gl_1_3','gl_6_4','gl_8_3','nc_2_3','nc_11_4','nc_5_4','ho_1_2','ho_8_4','ho_7_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Ceraline: her real kit, as the talents read it - Sealing Wax, Living Tallow, Mourning Bell, Court of the Final Candle',()=>{
  plain({foes:3},P=>{ const {v,F}=P; F[1].dmg*=2; free(F[1]);
    V.cast(v,'green'); near(F[1].slow,2.0*V.ccNerf,'Sealing Wax: the enemy with the highest attack, slowed 2 s x 0.7',1e-9); near(F[1]._waxCoatT,6,'coated 6 s'); assert.equal(F[1]._waxCoatBy,v); near(F[1]._sealT,2.0,'the wax sets 2.0 s later');
    near(F[0]._sealT||0,0,'not another enemy');
    for(let i=0;i<200&&F[1]._sealT>0;i++) V.step(1); assert.ok(F[1].stunned>3.5*V.ccNerf-2.5*V.STEP&&F[1].stunned<=3.5*V.ccNerf+1e-9,'then stunned: the control table\'s 3.5 s x 0.7 = 2.45 s: '+F[1].stunned);
    free(F[2]); waxIt(F[2],2); near(F[2]._wax,2,'Living Tallow: a wax for each cast'); near(F[2]._waxT,4,'lapsing 4 s after the last'); assert.ok(!(F[2].stunned>0),'');
    waxIt(F[2]); near(F[2].stunned,ENC(),'the third encases it: 1 s + 0.015 s a level, x 0.7 (the card says 1.0 s at level 1; it lands 0.7 s)',1e-9); near(F[2].silencedT,ENC(),'and silences it as long',1e-9); near(VMX('tallowEncase')(1)*V.ccNerf,0.7,'',1e-9); });
  plain({foes:3},P=>{ const {v,F}=P; at(P,F[1],4.5,2.2); coat(P,F[0]); const h=F.map(f=>f.hp);
    V.cast(v,'blue'); assert.equal(F[0]._waxCoatT,0,'Mourning Bell bursts her coat'); assert.ok(h[1]-F[1].hp>h[2]-F[2].hp,'the burst strikes an enemy within 2.6 m of it (and the ring every enemy)'); });
  plain({foes:3},P=>{ const {F}=P; for(const f of F) free(f); const m=ult(P,4);
    assert.ok(Math.abs(m[0].st-2.0*V.ccNerf)<=V.STEP+1e-9,'Court of the Final Candle: each statue is a stun of 2.0 s x 0.7 = 1.4 s (no root): '+m[0].st); assert.ok(Math.abs(m[0].sl-3.0*V.ccNerf)<=V.STEP+1e-9,'and a slow of 2.1 s: '+m[0].sl);
    near(m[2].st,0,'not an enemy outside its 7 m'); assert.ok(F[0]._waxCoatT>0&&F[0]._waxCoatBy===P.v,'coated again as its effigy bursts'); });
});

/* ============================== THE GUEST LIST ============================== */
test('Ceraline / Guest of Honour, Head of the Table, Guest\'s Burden, Old Silk, Next Guest',()=>{
  const L=lab(H,S(['gl_1_1','gl_2_1','gl_10_1','gl_10_4','gl_11_1']),{foes:3,big:true}), {v,F}=L; F[1].dmg*=2; F[1].speed=100;
  V.cast(v,'green'); assert.ok(mark(L,F[1],'guest'),'the first enemy Sealing Wax pours on this wave is the Guest of Honour'); assert.ok(!mark(L,F[0],'guest'));
  near(lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})),plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})))*1.10,'it takes 2% x 5 more from her');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'}))),'not another enemy');
  V.step(2); near(F[1].speed,100*(1-0.12),'Head of the Table: it moves 4% x 3 slower'); const e=L.T.s.au.find(x=>x.x===F[1]); near(e&&e.ap.cdRate,-0.10,'Guest\'s Burden: its cooldowns recover 2% x 5 slower');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*0.85,'Old Silk: it deals 5% x 3 less to her'); near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]})),'');
  F[0].dmg*=4; V.cast(v,'green'); assert.ok(mark(L,F[1],'guest')&&!mark(L,F[0],'guest'),'one Guest a wave');
  F[2].dmg*=10; kill(L,F[1]); assert.ok(mark(L,F[2],'guest'),'Next Guest: the enemy with the highest attack is the next (F2, not the nearest)');
});

test('Ceraline / The Long Table (on the Guest while it lives, a thinner pour beside it) and Seated Guest',()=>{
  const L=lab(H,S(['gl_1_1','gl_7_1','gl_3_1']),{foes:4}), {v,F}=L; F[2].dmg*=2; V.cast(v,'green'); assert.ok(mark(L,F[2],'guest'));
  for(const f of F){ f._waxCoatT=0; f._sealT=0; } F[0].dmg*=4; V.cast(v,'green');
  assert.ok(F[2]._sealT>1.9,'Sealing Wax pours on the Guest, not the enemy with the highest attack'); near(F[0]._sealT||0,0,'');
  near(F[1]._waxCoatT,3,'a thinner pour coats the enemy beside it (F1, 5.5 m) for half the coat time'); assert.equal(F[1]._waxCoatBy,v); near(F[3]._waxCoatT||0,0,'');
  free(F[2]); waxIt(F[2],3); near(F[2].stunned,ENC()+0.5,'Seated Guest: the Guest stays encased 0.5 s longer',1e-9); free(F[3]); waxIt(F[3],3); near(F[3].stunned,ENC(),'another enemy as before',1e-9);
  kill(L,F[2]); F[1]._waxCoatT=0; F[0]._sealT=0; V.cast(v,'green'); assert.ok(F[0]._sealT>1.9,'the Guest dead: the enemy with the highest attack again');
});

test('Ceraline / Living Tallow: Thick Tallow, Gracious Wax, Dripping Candles, Sealed Lips, Wax Lace, Candle Wick, Statuary, Rigid Manners',()=>{
  const L=lab(H,S(['gl_1_4','ho_10_3','gl_6_3','gl_10_3','gl_5_4','gl_8_4','gl_9_4','gl_8_1']),{foes:4,allies:1,big:true}), {v,F,A}=L; free(F[0]); v.energy=0; v.shield=0;
  waxIt(F[0]); near(F[0]._waxT,4+3,'Dripping Candles: the wax lasts 4 + 1 x 3 s');
  waxIt(F[0],2); near(F[0].stunned,ENC()+0.3+0.2,'Thick Tallow 0.1 x 3 and Gracious Wax 0.04 x 5 s longer, in full',1e-9); near(F[0].silencedT,ENC()+0.5+0.45,'Sealed Lips: silenced 0.15 x 3 s longer than the encase',1e-9);
  near(v.shield,v.maxHp*0.10,'Wax Lace: a shield of 2% x 5 of her max HP',1e-9); near(v.shieldT,4,'for 4 s',1e-9); near(v.energy,6,'Candle Wick: 2 x 3 ultimate energy');
  near(F[1]._wax||0,1,'Statuary: F1 (1.5 m away, body to body) gets 1 wax'); near(F[2]._wax||0,0,'not F2 (7 m)');
  V.step(1); near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.12,'Rigid Manners: an encased enemy takes 4% x 3 more from her allies');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'}))),'not from her');
  secs(ENC()+0.5+0.1); near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))),'and only while it is encased');
});

test('Ceraline / Encased Again: an enemy encased in the last 8 s is encased again at 2 wax (20% x 5 chance), and Nobody Leaves Early\'s 2 wax a cast',()=>{
  const L=lab(H,S(['gl_7_3']),{foes:3}), {F}=L; free(F[0]); free(F[1]); waxIt(F[0],3); assert.ok(mark(L,F[0],'enc8'),'');
  F[0].stunned=0; F[0].silencedT=0; waxIt(F[0],2); near(F[0].stunned,ENC(),'encased again at 2 wax',1e-9);
  waxIt(F[1],2); assert.ok(!(F[1].stunned>0),'an enemy not encased lately: 3 as before'); secs(8.1); F[0].stunned=0; waxIt(F[0],2); assert.ok(!(F[0].stunned>0),'after 8 s: 3 again');
  const L2=lab(H,S(['gl_13_2']),{foes:3}); free(L2.F[0]); setMk(L2,L2.F[0],'nle',8); waxIt(L2.F[0]); near(L2.F[0]._wax,2,'a caught enemy: 2 wax for a cast');
});

test('Ceraline / Sealing Wax: Slow Pour, Long Evening, Thin Wax, Hard Set, Gentle Seal, Second Pour, Polite Wax, Second Helping',()=>{
  const L=lab(H,S(['gl_2_4','gl_4_1','nc_5_1','gl_3_4','ho_9_3','nc_6_2','ho_6_3','gl_5_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; free(F[0]);
  V.cast(v,'green'); const m=VMX('slowMulFor')(10); near(F[0].slowMul,1-(1-m)*1.15,'Slow Pour: its slow 5% x 3 stronger'); near(F[0]._waxCoatT,6+2,'Long Evening: the coat 0.4 x 5 s longer');
  near(ratio(L,F[1],'sealwax'),1.15,'Thin Wax: Sealing Wax 5% x 3 more');
  seal(L,F[1]); assert.ok(F[1].stunned<=2.45+0.3+1e-9&&F[1].stunned>2.45+0.3-2.5*V.STEP,'Hard Set: the seal\'s stun 0.06 x 5 s longer, in full: '+F[1].stunned);
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*0.90,'Gentle Seal: it deals 2% x 5 less'); near(hitOn(L,A[0],1000,{src:F[1]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[1]}))*0.90,'to anyone of hers');
  secs(F[1].stunned+3.2); near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'for 3 s after the stun');
  near(FX.cd(v,'green',7),7*0.95-0.9-1.0,'Second Helping 1% x 5, Polite Wax 0.3 x 3, Second Pour 0.2 x 5');
});

test('Ceraline / Firm Hand (PICK ONE) and Courtesy (PICK ONE)',()=>{
  { const L=lab(H,S(['ho_5_3']),{foes:3,allies:1,big:true}), {F,A}=L; A[0].hp=A[0].maxHp*0.4; F[0].target=A[0]; seal(L,F[0]);
    assert.ok(F[0].stunned<=2.45+0.4+1e-9&&F[0].stunned>V.cap('stunned')-V.STEP+0.01,'Firm Hand: 0.4 s longer on an enemy attacking an ally below 50% (past the 2.8 s ceiling): '+F[0].stunned);
    F[1].target=A[0]; A[0].hp=A[0].maxHp*0.6; seal(L,F[1]); assert.ok(F[1].stunned<=2.45+1e-9,'not above 50%'); }
  const L=lab(H,S(['ho_5_2']),{foes:3,allies:2,big:true}), {v,F,A}=L; A[1].hp=A[1].maxHp*0.3; F[1].dmg*=3; F[2].target=A[1]; F[0].target=A[0];
  V.cast(v,'green'); assert.ok(F[2]._sealT>1.9,'Courtesy: Sealing Wax pours on the enemy attacking her lowest-HP ally'); near(F[1]._sealT||0,0,'not the one with the highest attack');
  F[2]._sealT=0; F[2].target=null; V.cast(v,'green'); assert.ok(F[1]._sealT>1.9,'nobody attacks it: the highest attack again');
});

test('Ceraline / moving away: Nobody Leaves, Clinging Wax; Tight Coat, Waxen Grip, Patient Host',()=>{
  const L=lab(H,S(['gl_2_2','gl_6_2','gl_4_3','gl_9_3','gl_11_4']),{foes:3,allies:1,big:true}), {v,F,A}=L; coat(L,F[0],30); F[0].speed=100; F[1].speed=100; const a0=F[0].dmg, i0=F[0].atkInterval, a1=F[1].dmg;
  for(let i=0;i<9;i++){ F[0].x+=0.05*V.METER; F[1].x+=0.05*V.METER; V.step(1); }
  assert.ok(mark(L,F[0],'nl'),'a waxed enemy moving away from her'); near(F[0].speed,100*0.85,'Nobody Leaves: slowed 3% x 5'); near(F[0].dmg,a0*0.95,'Clinging Wax: 1% x 5 less attack');
  near(F[1].speed,100,'an enemy that is not waxed: not'); near(F[1].dmg,a1,'');
  near(F[0].atkInterval,i0/(1-0.06),'Tight Coat: waxed enemies attack 2% x 3 slower');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.95*0.925,'Waxen Grip 1% x 5 and Patient Host 1.5% x 5 less to her from a waxed enemy');
  near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]}))*0.95,'Waxen Grip to her allies'); near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'not from one not waxed');
  for(let i=0;i<12;i++){ F[0].x-=0.05*V.METER; V.step(1); } near(F[0].speed,100,'coming toward her: not slowed'); near(F[0].dmg,a0,'');
  near(F[1].atkInterval,i0,'(F1 has no wax: Tight Coat not on it)'); F[1]._wax=1; F[1]._waxT=4; V.step(2); near(F[1].atkInterval,i0/(1-0.06),'Living Tallow wax is wax too');
});

test('Ceraline / Held at Table and No Excuses: a dash away from her is dragged back',()=>{
  const dash=(L,f,dx,dy)=>{ f._dash={x0:f.x,y0:f.y,x1:f.x+dx*V.METER,y1:f.y+(dy||0)*V.METER,t:0,dur:0.3,run:function(){}}; V.step(4); f.x+=dx*V.METER; f.y+=(dy||0)*V.METER; f._dash=null; f.pulledBy=null; V.step(4); return f; };
  { const L=lab(H,[['gl_4_2',1]],{foes:3}), {v,F}=L; coat(L,F[1],30); const x0=F[1].x; dash(L,F[1],0,6);
    assert.ok(F[1].pulledBy&&Math.abs(F[1].pulledBy.x-x0)<1e-6,'Held at Table: a waxed enemy\'s dash away from her: dragged back toward where it began'); near(F[1].pullStop,4*V.METER,'a third of the way (6 m: 2 m)',1e-6);
    coat(L,F[2],30); dash(L,F[2],-6); assert.ok(!F[2].pulledBy,'a dash toward her: not'); F[0]._waxCoatT=0; dash(L,F[0],0,6); assert.ok(!F[0].pulledBy,'an enemy not waxed: not'); }
  { const L=lab(H,S(['gl_9_2','gl_6_2']),{foes:3}), {F}=L; coat(L,F[1],30); setMk(L,F[1],'nl',5); const x0=F[1].x; dash(L,F[1],0,6);
    assert.ok(F[1].pulledBy&&Math.abs(F[1].pulledBy.x-x0)<1e-6,'No Excuses: while Nobody Leaves slows it'); near(F[1].pullStop,0,'all the way back',1e-6); }
});

test('Ceraline / Locked Doors (PICK ONE) and Late Arrival (PICK ONE)',()=>{
  { const L=lab(H,S(['gl_5_2']),{foes:3}), {v,F}=L; V.step(4); assert.ok(mark(L,F[0],'ld'),'F0 came within 5 m of her'); assert.ok(!mark(L,F[1],'ld'),'not F1 (5.5 m body to body)');
    at(L,F[0],0,11); const pl=pulled(F[0]); assert.ok(pl&&Math.abs(pl.x-v.x)<1e-6,'it cannot leave that circle: dragged back'); near(pl.stop,(V.bodyR(v)+V.bodyR(F[0])+5)*V.METER,'to its edge',1e-3);
    secs(1.1); assert.ok(!pulled(F[0]),'for 1 s'); at(L,F[0],4.5,0); V.step(4); assert.ok(!mark(L,F[0],'ld'),'once every 10 s per enemy'); secs(7); assert.ok(!mark(L,F[0],'ld'),'(8.6 s: not yet)'); secs(2); assert.ok(mark(L,F[0],'ld'),'then again'); }
  const L=lab(H,S(['gl_5_3']),{foes:3}), {F}=L; free(F[2]); delete L.T.s.seen[F[2].uid]; secs(0.3); near(F[2]._wax||0,1,'Late Arrival: an enemy that comes after the wave started arrives with 1 wax'); near(F[0]._wax||0,0,'not one there at the start');
});

test('Ceraline / Candle Smoke: a melee basic attack on her gives its attacker 1 wax, once every 9 - 1 x 3 s each',()=>{
  const L=lab(H,S(['gl_9_1']),{foes:3,big:true}), {v,F}=L; assert.ok(F[0].melee,'(a Vael is melee)');
  V.hit(F[0],v,10,{kind:'true',auto:true}); near(F[0]._wax||0,1,'1 wax'); V.hit(F[0],v,10,{kind:'true',auto:true}); near(F[0]._wax||0,1,'not again at once');
  V.hit(F[1],v,10,{kind:'true',auto:true}); near(F[1]._wax||0,1,'each enemy its own clock'); V.hit(F[2],v,10,{kind:'true'}); near(F[2]._wax||0,0,'not a skill hit');
  secs(5.8); V.hit(F[0],v,10,{kind:'true',auto:true}); near(F[0]._wax||0,1,'not yet: 6 s (a held unit keeps its wax)'); secs(0.3); V.hit(F[0],v,10,{kind:'true',auto:true}); near(F[0]._wax||0,2,'then again');
  F[1].melee=false; secs(6.1); V.hit(F[1],v,10,{kind:'true',auto:true}); near(F[1]._wax||0,1,'not a ranged attacker');
});

test('Ceraline / her ultimate: Stay a While, Long Pour, Seated Guest, Sealed Lips; Nobody Leaves Early (SIGNATURE)',()=>{
  const L=lab(H,S(['gl_11_2','gl_12_2','gl_3_1','gl_10_3','gl_13_2']),{foes:3}), {v,F}=L; for(const f of F) free(f); setMk(L,F[0],'guest',99); L.T.s.m.guest=F[0];
  const m=ult(L,4.0), sm=VMX('slowMulFor')(100); near(m[0].sm,1-(1-sm)*1.15,'Stay a While: its slow 3% x 5 stronger');
  assert.ok(Math.abs(m[0].st-(1.4+0.3+0.5))<=V.STEP+1e-9,'Long Pour 0.1 x 3 and Seated Guest 0.5 s: the Guest\'s statue 2.2 s: '+m[0].st); assert.ok(Math.abs(m[1].st-(1.4+0.3))<=V.STEP+1e-9,'another: 1.7 s: '+m[1].st);
  assert.ok(F[1].silencedT>0.3,'Sealed Lips: silenced after its statue'); assert.ok(mark(L,F[1],'nle')&&win(L,'nle'),'Nobody Leaves Early: every enemy it caught');
  const mk=F[1]._talM[v.uid].nle; at(L,F[1],(mk.sx-v.x)/V.METER,(mk.sy-v.y)/V.METER+5); const pl=pulled(F[1]); assert.ok(pl&&Math.abs(pl.x-mk.sx)<1e-6,'it cannot move farther than 3 m from where it was encased: '+JSON.stringify(pl));
  near(pl.stop,3*V.METER,'dragged back to 3 m',1e-3); secs(8); assert.ok(!pulled(F[1]),'for 8 s');
  const L2=lab(H,S(['gl_13_2','gl_11_4']),{foes:3,big:true}); for(const f of L2.F) free(f); ult(L2,4.0); L2.F[1]._waxCoatT=0; L2.F[1]._wax=0;
  near(hitOn(L2,L2.v,1000,{src:L2.F[1]}),plainHit(L2,()=>hitOn(L2,L2.v,1000,{src:L2.F[1]}))*0.925,'it counts as waxed (Patient Host)');
});

/* ============================== THE NEXT COURSE ============================== */
test('Ceraline / Courses: Starter, Main, Sweet in turn; Fine Dining, Bitter Starter, Grand Banquet, Seconds, Feast Day, Dessert Spoon, Clean Plates',()=>{
  const L=lab(H,S(['nc_1_1','nc_2_1','nc_4_1','nc_3_1','nc_10_1','nc_12_1','nc_8_1','nc_6_1']),{foes:3,big:true}), {v,F}=L; const seq=[], ap0=v.apow;
  V.cast(v,'blue'); seq.push(L.T.s.crs); near(F[0].slowMul,1-(0.20+0.10),'the Starter slows every enemy it hits 20% (+ Bitter Starter 2% x 5)'); near(F[0].slow,2,'for 2 s',1e-9);
  near(ratio(L,F[1],'nova'),1,'(the Starter: no Main)');
  V.cast(v,'blue'); seq.push(L.T.s.crs); near(ratio(L,F[1],'nova'),1.20*1.06,'the Main: 4% x 5 more, Fine Dining 2% x 3 on top'); near(ratio(L,F[1],'bellBurst'),1.20*1.06,'its coat bursts too');
  v.energy=0; v.hp=v.maxHp*0.5; const h0=v.hp; V.cast(v,'blue'); seq.push(L.T.s.crs); near(v.energy,9,'the Sweet: 3 ultimate energy for each of 3 enemies hit'); near(v.hp-h0,v.maxHp*0.06,'Dessert Spoon: it heals her 2% x 3',1e-6);
  F[2].hp=1; F[2].shield=0; v.blueCd=10; F[0].hp=1; F[0].shield=0; V.cast(v,'blue'); seq.push(L.T.s.crs); near(v.blueCd,7,'Clean Plates: a Course that kills: 1 x 3 s off the Bell, once a Bell'); V.step(1); near(v.apow,ap0*(1+0.025*6),'Feast Day: 4 Bells, the 4th a Banquet (3 Courses): 6 Courses');
  for(let i=0;i<5;i++){ V.cast(v,'blue'); seq.push(L.T.s.crs); } assert.deepEqual(seq,['S','M','W','B','M','W','S','B','M'],'every 4th a Banquet (all three); Seconds: after it the Main');
  V.step(1); near(v.apow,ap0*(1+0.025*6),'Feast Day: 0.5% x 5 ability power per Course this wave, up to 6');
  V.wave(); V.step(2); near(v.apow,ap0,'this wave\'s');
  const L2=lab(H,S(['nc_1_1','nc_3_1']),{foes:3,big:true}); const s2=[]; for(let i=0;i<8;i++){ V.cast(L2.v,'blue'); s2.push(L2.T.s.crs); } assert.deepEqual(s2,['S','M','W','B','S','M','W','B'],'without Seconds the turn goes on');
  const L3=lab(H,S(['nc_1_1']),{foes:3,big:true}); const s3=[]; for(let i=0;i<4;i++){ V.cast(L3.v,'blue'); s3.push(L3.T.s.crs); } assert.deepEqual(s3,['S','M','W','S'],'without Grand Banquet: no Banquet');
});

test('Ceraline / Mourning Bell\'s damage: Sharp Bell, First Sitting, Gilded Bell, Final Toll, Ringing Ears, Crack the Coat, Deep Bell, Wide Bell, Bronze Tongue, Bright Flame',()=>{
  const L=lab(H,S(['nc_1_2','nc_n2','nc_7_3','nc_11_2','nc_4_2','nc_5_3','nc_5_2','nc_3_2','nc_10_3']),{foes:3,big:true}), {v,F}=L;
  F[1].hp=F[1].maxHp*0.5; near(ratio(L,F[1],'nova'),1.10,'Sharp Bell: 2% x 5'); F[1].hp=F[1].maxHp; near(ratio(L,F[1],'nova'),1.10*1.15,'First Sitting: above 75% HP 3% x 5');
  F[1].hp=F[1].maxHp*0.29; near(ratio(L,F[1],'nova'),1.10*1.15,'Final Toll: below 30% HP 5% x 3'); F[1].hp=F[1].maxHp*0.5;
  coat(L,F[1]); near(ratio(L,F[1],'nova'),1.10*1.15,'Gilded Bell: a waxed enemy 3% x 5'); F[1]._waxCoatT=0;
  near(ratio(L,F[1],'bellBurst'),1.10*1.15,'Crack the Coat: its coat burst 3% x 5'); L.T.s.bm=F[1]; near(ratio(L,F[1],'bellBurst'),1.10*1.15*1.30,'Deep Bell: 30% more to the coated enemy itself'); L.T.s.bm=null;
  near(ratio(L,F[1],'sealwax'),1,'not Sealing Wax');
  { const L1=lab(H,S(['nc_9_2']),{foes:3,big:true}); near(ratio(L1,L1.F[1],null),1,''); V.cast(L1.v,'blue'); near(ratio(L1,L1.F[1],null),1.05,'Ringing Ears: hit by the Bell: 1% x 5 more from her for 3 s'); secs(3.1); near(ratio(L1,L1.F[1],null),1,''); }
  { const L0=lab(H,S(['nc_1_2','nc_n2','nc_7_3','nc_11_2','nc_4_2','nc_5_3','nc_5_2','nc_3_2','nc_10_3']),{foes:3,big:true});
  const o=FX.kit(L0.v,'nova',{detonate:0.8}); L0.T.s.cur=null; near(o.detR,3.6*V.METER,'Wide Bell: the coat burst reaches 2.6 + 1 m',1e-9);
  near(FX.cd(L0.v,'blue',9),9*0.95-1.0,'Bronze Tongue 0.2 x 5 s, Bright Flame 1% x 5'); }
  const L2=lab(H,S(['nc_9_1','nc_1_1']),{foes:3,big:true}), f=L2.F[1]; f.mrRating=300; const dm=VMX('defMul'), a=dm(L2.v,f,'magic'); f.mrRating=300*0.9; const c=dm(L2.v,f,'magic'); f.mrRating=300;
  L2.T.s.crs='M'; near(ratio(L2,f,'nova',{kind:'magic'}),1.20*c/a,'Hearty Main: the Main ignores 2% x 5 of magic resist'); L2.T.s.crs='S'; near(ratio(L2,f,'nova',{kind:'magic'}),1,'not another Course');
});

test('Ceraline / Scald: Hot Wax, Boiling Point, Wax Burns, Spilled Wax, Runny Wax, Candle Glow',()=>{
  const L=lab(H,S(['nc_1_4','nc_2_4','nc_8_4','nc_12_4','nc_6_4','nc_7_4']),{foes:3}), {v,F}=L; const ap=v.apow;
  const mr=t=>{ const s=t.mrRating; t.mrRating=s*0.85; const d=defM(L,t); t.mrRating=s; return d; };
  coat(L,F[0],30); coat(L,F[1],30); F[1].hp=F[1].maxHp*0.4; coat(L,F[2],1.5); clk(L,'#4'); const h=F.map(f=>f.hp);
  secs(1.02); near(h[0]-F[0].hp,ap*0.06*mr(F[0]),'Hot Wax: each second, 2% x 3 of her ability power (magic, Wax Burns ignores 5% x 3 of magic resist)',1e-6);
  near(h[1]-F[1].hp,ap*0.06*1.3*mr(F[1]),'Boiling Point: below 50% HP 10% x 3 more',1e-6); near(F[0].slowMul,1-0.09,'Spilled Wax: slowed 3% x 3');
  near(ratio(L,F[0],'sealwax'),1.05,'Candle Glow: a scalding enemy takes 1% x 5 more from her abilities'); near(ratio(L,F[0],null),1,'not from a basic attack');
  const g=F[2].hp; secs(1.0); assert.ok(F[2].hp<g,'Runny Wax: the coat is over (0.5 s ago), Scald goes on'); secs(1.5); const g3=F[2].hp; secs(1.0); near(F[2].hp,g3,'for the coat + 0.5 x 3 s');
  FX.partPre(v,F[1],'bellBurst'); F[1]._waxCoatT=0; F[1]._waxCoatBy=null; FX.part(v,F[1],'bellBurst'); const g4=F[1].hp; secs(1.0); assert.ok(F[1].hp<g4,'a coat the Bell bursts: Runny Wax 1.5 s'); secs(1.0); const g5=F[1].hp; secs(1.0); near(F[1].hp,g5,'then its Scald ends');
});

test('Ceraline / Flash Scald, Boiling Over, Effigy Fire',()=>{
  { const L=lab(H,S(['nc_1_4','nc_3_4']),{foes:3}), {v,F}=L; coat(L,F[0],5); const h=F[0].hp; FX.partPre(v,F[0],'bellBurst'); FX.part(v,F[0],'bellBurst');
    near(h-F[0].hp,v.apow*0.06*5*defM(L,F[0]),'Flash Scald: a scalding coat the Bell bursts deals its Scald for the 5 s left at once',1e-6); }
  { const L=lab(H,S(['nc_1_4','nc_9_4']),{foes:3}), {v,F}=L; coat(L,F[0]); at(L,F[1],4.5,2.2); const h=F[1].hp, h2=F[2].hp; kill(L,F[0]);
    near(h-F[1].hp,apB(L)*0.8*VMX('rageMul')*defM(L,F[1]),'Boiling Over: a scalding enemy that dies bursts its coat like Mourning Bell (80% at her Blue level, 2.6 m)',1e-6); near(F[2].hp,h2,'not far away'); near(F[0]._waxCoatT,0,''); }
  const L=lab(H,S(['nc_12_3']),{foes:3}), {v,F}=L; setMk(L,F[0],'fce',9); clk(L,'#4'); const h=F[0].hp, h1=F[1].hp; secs(1.02);
  near(h-F[0].hp,v.apow*0.02*defM(L,F[0]),'Effigy Fire: a statue scalds, a third x 3 of Scald (Hot Wax at its first rank)',1e-6); near(F[1].hp,h1,'not another enemy');
});

test('Ceraline / Wax Fountain, Lace Mantle, Poised, A Candle for Every Course (LINK)',()=>{
  const L=lab(H,S(['nc_7_2','nc_10_4','nc_3_3','nc_n1','ho_1_1','nc_9_2']),{foes:3,allies:1,big:true}), {v,F,A}=L; coat(L,F[0]); at(L,F[1],4.5,2.2); v.shield=0;
  V.cast(v,'blue'); assert.ok(mark(L,F[1],'re'),'(after the bursts the ring is the Bell again: Ringing Ears)'); near(F[0]._waxCoatT,6,'Wax Fountain: a burst leaves a thin coat on each enemy it hit (as long as Sealing Wax\'s coat)'); near(F[1]._waxCoatT,6,''); assert.equal(F[1]._waxCoatBy,v); near(F[2]._waxCoatT||0,0,'');
  near(v.shield,v.maxHp*0.05,'Lace Mantle: a shield of 1% x 5 of her max HP for the coat it burst',1e-9);
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.90*0.95,'Poised 2% x 5 less for 2 s and A Candle for Every Course 5%'); near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.95,'an ally within 6 m: 5%');
  secs(2.1); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'2 s');
  v.shield=0; V.cast(v,'blue'); near(F[0]._waxCoatT,0,'the next Bell bursts the thin coats'); near(F[1]._waxCoatT,0,'and a thin coat leaves none'); near(v.shield,v.maxHp*0.10,'');
  V.cast(v,'blue'); assert.equal(stack(L,'cand'),1,'with Candlelight: the Sweet (3rd Bell) lights a candle');
});

test('Ceraline / The Last Course (SIGNATURE): each effigy burst is a Banquet centred on that enemy',()=>{
  const L=lab(H,S(['nc_13_3','nc_1_1','nc_2_1','nc_4_2']),{foes:4,big:true}), {v,F}=L; coat(L,F[0]); coat(L,F[1]); at(L,F[1],4.5,2.2); v.energy=0;
  FX.partPre(v,F[0],'fcBurst'); const r=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})); const T0=v._tal; v._tal=undefined; const p=lost(F[3],()=>V.hit(v,F[3],1000,{kind:'true'})); v._tal=T0; near(r/p,1.20*1.06,'the Main: the effigy burst 4% x 5 and Fine Dining 2% x 3 more');
  const h=F[1].hp, h2=F[2].hp; FX.part(v,F[0],'fcBurst');
  near(F[0].slowMul,0.8,'the Starter slows it 20%'); near(v.energy,3,'the Sweet: 3 energy'); near(F[0]._waxCoatT,0,'every coat within 2.6 m bursts'); near(F[1]._waxCoatT,0,'');
  near(h-F[1].hp,2*apB(L)*0.8*VMX('rageMul')*defM(L,F[1])*1.15*1.20*1.06,'(F1 caught by both bursts: Crack the Coat and the Main on each)',1e-6); near(F[2].hp,h2,'not far away');
  const L2=lab(H,S(['nc_13_3']),{foes:3,big:true}); for(const f of L2.F) free(f); L2.v.energy=0; ult(L2,6); assert.ok(L2.v.energy>=6,'in her ultimate: each effigy burst is a Banquet (3 energy each): '+L2.v.energy); assert.ok(L2.F[0].slowMul<=0.8+1e-9,'');
});

/* ============================== THE HOST ============================== */
test('Ceraline / Candlelight: Long Wicks, Fourth Candle, Lamplit Hall, Candle Stub, Steady Flame, Candle Ward, Long Night In, Grace Under Fire, Black Candles',()=>{
  const L=lab(H,S(['ho_1_1','ho_2_1','ho_3_1','ho_3_2','ho_12_1','ho_4_1','ho_6_2','ho_9_1','ho_12_4','ho_10_1']),{foes:3,allies:2,big:true,cold:true}), {v,F,A}=L; const ap0=v.apow, ar0=v.armorRating, aa0=A[0].armorRating; V.step(1);
  assert.equal(stack(L,'cand'),3,'Candle Stub: the wave starts with 1 x 3 candles'); clk(L,'ho_1_1#0'); secs(6.4); assert.equal(stack(L,'cand'),3,''); secs(0.2); assert.equal(stack(L,'cand'),4,'Long Wicks: one every 8 - 0.5 x 3 s; Fourth Candle: 4');
  secs(7); assert.equal(stack(L,'cand'),4,'at most 4'); V.step(1);
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.80*0.98*0.91,'her: 1% x 5 per candle, Long Night In 0.2% x 5 per candle over 2, Grace Under Fire 3% x 3');
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.80*0.98,'an ally within 6 m'); at(L,A[1],0,-11.5); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000))*0.80*0.98,'Lamplit Hall: 6 + 0.4 x 5 m (7.9 m body to body)');
  at(L,A[1],0,-13); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000)),'not 9 m'); V.step(1);
  near(v.apow,ap0*(1+0.025*4),'Steady Flame: 0.5% x 5 ability power per candle'); near(v.armorRating,ar0*(1+0.03*4),'Candle Ward: 0.6% x 5 armor per candle'); near(A[0].armorRating,aa0*(1+0.03*4),'and her allies in Candlelight');
  V.wave(); V.step(1); assert.equal(stack(L,'cand'),4,'Black Candles: kept between waves');
  const L2=lab(H,S(['ho_1_1','ho_12_1']),{foes:3}); setStack(L2,'cand',3); V.wave(); V.step(1); assert.equal(stack(L2,'cand'),3,'without it: out at the wave, Candle Stub\'s 3'); setStack(L2,'cand',1); V.wave(); V.step(1); assert.equal(stack(L2,'cand'),3,'');
  const L3=lab(H,S(['ho_1_1']),{foes:3}); assert.equal(stack(L3,'cand'),0,'no Candle Stub: none at the start'); clk(L3,'ho_1_1#0'); secs(8.05); assert.equal(stack(L3,'cand'),1,'every 8 s'); setStack(L3,'cand',3); clk(L3,'ho_1_1#0'); secs(8.05); assert.equal(stack(L3,'cand'),3,'at most 3');
});

test('Ceraline / Warm Wax: Soft Coat, Tallow Shell, Shield of Lace, Shared Table, Wax Plates',()=>{
  const L=lab(H,S(['ho_1_4','ho_2_4','ho_3_4','ho_11_4','ho_5_4','ho_4_4']),{foes:3,allies:2,big:true}), {v,F,A}=L; free(F[0]); A[0].shield=0; A[1].shield=0;
  waxIt(F[0],3); assert.ok(mark(L,A[0],'ww'),'Living Tallow encases: the spare wax coats her nearest ally'); assert.ok(mark(L,A[1],'ww'),'Shared Table: and a second');
  near(A[0].shield,v.apow*0.5*1.15,'Tallow Shell: a shield of 50% of her ability power, Shield of Lace 5% x 3 stronger',1e-9); near(A[1].shield,v.apow*0.5*0.5*1.15,'at that share',1e-9);
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*(1-0.09),'it takes 3% x 3 less'); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000))*(1-0.045),'the second at 10% x 5 of its strength');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.94,'Wax Plates: while an ally has Warm Wax she takes 2% x 3 less');
  secs(4+1.5-0.2); assert.ok(mark(L,A[0],'ww'),'Soft Coat: 4 + 0.5 x 3 s'); secs(0.4); assert.ok(!mark(L,A[0],'ww'),''); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'');
});

test('Ceraline / shorter controls: Composure, Wax Seat, Warm Hearth (all together at most 50% shorter)',()=>{
  const L=lab(H,S(['gl_3_3','ho_7_1','ho_9_4']),{foes:3,allies:2,big:true}), {v,F,A}=L; V.step(1);
  v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.8*0.9,'Composure 4% x 5 (up to 20%) and Wax Seat 2% x 5 on her',1e-9);
  setMk(L,v,'ww',9,1); v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.5,'Warm Hearth: with Warm Wax a stun half as long: 0.8 x 0.9 x 0.5 is cut at 50%',1e-9);
  v.slow=0; ccOn(F[0],v,'slow',1); near(v.slow,V.ccNerf*0.72,'(not a slow)',1e-9);
  A[0].slow=0; ccOn(F[0],A[0],'slow',1); near(A[0].slow,V.ccNerf*0.9,'Wax Seat: an ally in Candlelight',1e-9);
  setMk(L,A[0],'ww',9,1); A[0].stunned=0; ccOn(F[0],A[0],'stunned',1); near(A[0].stunned,V.ccNerf*0.5,'Warm Hearth on an ally (0.9 x 0.5 at most 50%)',1e-9);
  at(L,A[1],0,-14); A[1].slow=0; ccOn(F[0],A[1],'slow',1); near(A[1].slow,V.ccNerf,'not an ally out of Candlelight',1e-9);
});

test('Ceraline / Guests\' Bell, Second Bell, Waxen Mercy, Good Company, Warm Hands, Mind Your Manners, Courtly Hands',()=>{
  const L=lab(H,S(['ho_7_2','ho_8_2','ho_11_3','ho_4_3','gl_12_4','ho_n1','ho_3_3']),{foes:1,allies:1,big:true}), {v,F,A}=L; V.step(1);
  A[0].hp=A[0].maxHp*0.5; v.hp=v.maxHp*0.5; const a0=A[0].hp, v0=v.hp; V.cast(v,'blue');
  near(A[0].hp-a0,A[0].maxHp*0.06*1.06,'Guests\' Bell: allies within its circle heal 3% + Second Bell 1% x 3 of their max HP; Good Company 2% x 3 more',1e-6);
  near(v.hp-v0,v.maxHp*0.06*1.12*1.06,'her too: Warm Hands 4% x 3 more on her',1e-6);
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*(1-0.075),'Waxen Mercy: those it healed take 1.5% x 5 less for 3 s'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.075),'');
  secs(3.1); near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000)),'3 s');
  F[0].slow=0; V.hit(F[0],A[0],10,{kind:'true',auto:true}); near(F[0].slowMul,0.91,'Mind Your Manners: a basic attack on an ally within 6 m: the attacker slowed 3% x 3'); near(F[0].slow,1.5,'for 1.5 s',1e-9);
  near(ratio(L,F[0],null,{auto:true}),1.12,'Courtly Hands: her basic attacks 4% x 3 more'); near(ratio(L,F[0],'sealwax'),1,'not her skills');
});

test('Ceraline / Blown Out and Snuffer: an ally dropping below 30% in Candlelight: a candle snuffed to heal it',()=>{
  const L=lab(H,S(['ho_5_1','ho_6_1']),{foes:3,allies:1,big:true}), {v,F,A}=L; setStack(L,'cand',2); V.step(1);
  A[0].hp=A[0].maxHp*0.35; A[0].shield=0; V.hit(F[0],A[0],A[0].maxHp*0.1,{kind:'true'}); V.step(1); near(A[0].hp,A[0].maxHp*(0.25+0.12+0.03),'healed 4% x 3 + Snuffer 1% x 3 of its max HP',1e-6); assert.equal(stack(L,'cand'),1,'a candle snuffed');
  v.hp=v.maxHp*0.35; v.shield=0; V.hit(F[0],v,v.maxHp*0.1,{kind:'true'}); V.step(1); near(v.hp,v.maxHp*(0.25+0.15),'her too',1e-6); assert.equal(stack(L,'cand'),0,'');
  A[0].hp=A[0].maxHp*0.35; V.hit(F[0],A[0],A[0].maxHp*0.1,{kind:'true'}); V.step(1); near(A[0].hp,A[0].maxHp*0.25,'no candle: no heal',1e-6);
});

test('Ceraline / Hearth Wax and The Court Sits (SIGNATURE)',()=>{
  const L=lab(H,S(['ho_13_2','ho_12_2','ho_1_4','ho_1_1']),{foes:3,allies:2,big:true}), {v,F,A}=L; at(L,A[0],2,-3); at(L,A[1],0,-16); V.step(1); at(L,A[0],2,-3);
  V.cast(v,'ult',F[0]); assert.equal(stack(L,'cand'),3,'it lights every candle'); assert.ok(mark(L,A[0],'cs')&&mark(L,v,'cs'),'every ally inside the circle is seated'); assert.ok(!mark(L,A[1],'cs'),'not one outside');
  assert.ok(mark(L,A[0],'ww'),'with Warm Wax (Hearth Wax: 20% x 5)'); near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*Math.max(0.75,0.75*0.91*0.85),'25% less, its Warm Wax 3% x 3 and 3 candles (1% x 5 each) - at most 25% off a hit on an ally in all (v1452 cap)');
  A[0].hp=10; V.hit(F[0],A[0],1e12,{kind:'true'}); assert.ok(A[0].alive,'a hit that would kill it snuffs a candle'); near(A[0].hp,1,''); assert.equal(stack(L,'cand'),2,''); assert.ok(A[0]._noTarget,'it cannot be targeted');
  near(hitOn(L,A[0],1e6),0,'or hit for 2 s (the engine untargetable state: no hit reaches it)'); secs(2.1); A[0].hp=10; V.hit(F[0],A[0],1e12,{kind:'true'}); assert.ok(!A[0].alive,'once per ally each fight');
  v.hp=10; V.hit(F[0],v,1e12,{kind:'true'}); assert.ok(v.alive,'her too'); secs(6.2); assert.ok(!mark(L,v,'cs'),'6 s');
  const L2=lab(H,S(['ho_13_2']),{foes:3,allies:1,big:true}); at(L2,L2.A[0],2,-3); V.cast(L2.v,'ult',L2.F[0]); L2.T.s.k.cand.n=0; L2.A[0].hp=10; V.hit(L2.F[0],L2.A[0],1e12,{kind:'true'}); assert.ok(!L2.A[0].alive,'no candle left: nobody is saved');
});

test('Ceraline / ultimate energy and cooldowns: Hostess, Candle Hour, Table Talk; Second Helping, Bright Flame, Candle Watch, Bell Pull, Dinner Bell',()=>{
  const L=lab(H,S(['gl_12_3','nc_11_3','ho_11_2','gl_5_1','nc_10_3','ho_8_3','gl_7_4','ho_10_2']),{foes:3,big:true}), {v}=L; v.energy=0; V.step(1); v.energy=10; V.step(1);
  near(v.energy,10*(1+0.10+0.075+0.06),'energy she gains: 2% x 5 + 1.5% x 5 + 2% x 3 more');
  near(FX.cd(v,'blue',9),((9*0.95-0.75-0.75)*0.95)*0.95,'1% x 5 shorter three times, 0.15 x 5 s twice'); near(FX.cd(v,'green',7),7*0.95*0.95*0.95,'');
});

/* every page site her talents added runs, with the right skill resolving: a scripted definition counts each hook (the controls remove them one at a time) */
test('Ceraline: every page site her talents added is reached - the wax, the encase, the seal, each coat burst, the pour, the statues, the effigies',()=>{
  const n=k=>({fn:'n',k}), parts=['sealset','bellBurst','fcWax','fcEnc','fcBurst'], rows=[{on:'wax',do:[n('wax')]},{on:'encase',do:[n('encase')]},{on:'encased',do:[n('encased')]},
    {on:'skillTgt',skill:'sealwax',do:[n('tgt')]},{on:'at',skill:'finalcandle',do:[n('atFC')]},{on:'at',skill:'nova',do:[n('atMB')]},{on:'hit',if:{casting:'nova'},do:[n('ring')]}];
  for(const p of parts){ rows.push({on:'partPre',skill:p,do:[{fn:'pre',p}]}); rows.push({on:'part',skill:p,do:[n('post:'+p)]}); }
  const def={hero:H,casting:true,points:true,wax:true,states:{},always:[],talents:{nc_13_3:rows},partial:{},ruling:{},
    fn:{ n(A,T,u,c,a){ const C=T.s.cnt||(T.s.cnt={}); C[a.k]=(C[a.k]||0)+1; }, pre(A,T,u,c,a){ const C=T.s.cnt||(T.s.cnt={}); const k='pre:'+a.p+(T.s.cur===a.p?'':':wrong'); C[k]=(C[k]||0)+1; if(a.p==='fcWax'&&c.tgt) (T.s.wx||(T.s.wx={}))[c.tgt.uid]=1; } }};
  const L=lab(H,[['nc_13_3',1]],{foes:3,big:true,def}), {v,F}=L; for(const f of F) free(f); const C=()=>L.T.s.cnt||{};
  waxIt(F[0],3); assert.equal(C().wax,3,'the wax hook: each wax'); assert.equal(C().encase,1,'the encase hook'); assert.equal(C().encased,1,'');
  V.cast(v,'green'); assert.equal(C().tgt,1,'Sealing Wax\'s target'); secs(2.1); assert.equal(C()['pre:sealset'],1,'the seal setting, as Sealing Wax'); assert.equal(C()['post:sealset'],1,'');
  F[0].stunned=0; F[0]._waxCoatT=0; coat(L,F[1]); V.cast(v,'blue'); assert.equal(C()['pre:bellBurst'],1,'each coat the Bell bursts'); assert.equal(C()['post:bellBurst'],1,''); assert.equal(C().atMB,1,'where the Bell rings'); assert.ok(C().ring>=1,'the ring after the bursts is the Bell');
  for(const f of F) free(f); V.cast(v,'ult',F[0]); assert.equal(C().atFC,1,'where the Final Candle is poured'); secs(0.3); at(L,F[2],4.5,2.5); secs(5.0);
  assert.ok(L.T.s.wx[F[0].uid]&&L.T.s.wx[F[1].uid],'the wax reaching each enemy it caught'); assert.ok(L.T.s.wx[F[2].uid],'and one that walked into the pour');
  assert.ok(C()['pre:fcEnc']>=3&&C()['post:fcEnc']>=3,'each statue: '+JSON.stringify(C())); assert.ok(C()['pre:fcBurst']>=3&&C()['post:fcBurst']>=3,'each effigy burst');
  assert.ok(!Object.keys(C()).some(k=>/:wrong$/.test(k)),'while each part resolves, it is the skill being cast: '+JSON.stringify(C()));
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Ceraline: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['gl_1_1','gl_2_2','gl_1_4','gl_5_4','gl_8_4','nc_1_1','nc_1_4','nc_1_2','nc_4_2','ho_1_1','ho_1_4','ho_7_2','ho_12_1']), TEAM=['vael','sylthaine','vireo','vex','ceraline'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let guest=false,ww=false,crs={},cand=0,enc=0,scald=0;
  VMX('var __ceE=0; var __ceTE=tallowEncase; tallowEncase=function(){ __ceE++; return __ceTE.apply(this,arguments); };');
  try{ for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const S0=s._tal.s; if(S0.crs) crs[S0.crs]=1; cand=Math.max(cand,(S0.k.cand||{n:0}).n);
      for(const f of units()){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.guest) guest=true; if(o.ww&&o.ww.until>V.now()) ww=true; } }
    enc=VMX('__ceE'); } finally{ VMX('tallowEncase=__ceTE;'); }
  assert.ok(guest,'a real Guest of Honour'); assert.ok(crs.S&&crs.M,'real Bells rang Courses: '+Object.keys(crs)); assert.ok(cand>=1,'candles lit: '+cand); assert.ok(enc>=1,'Living Tallow encased: '+enc); assert.ok(ww,'a real Warm Wax');
  console.log('  live fight: courses '+Object.keys(crs).join(',')+', candles '+cand+', encases '+enc);
  determinism(H,TEAM);
});

/* The page sites her talents added (Living Tallow's wax and encase, Sealing Wax's target and seal, each coat Mourning Bell bursts, the Final Candle's centre,
   wax, statues and effigy bursts): with nothing learned, whole seeded fights with Ceraline in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Ceraline: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENCS=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['ceraline','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','bloatus'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __ceN={seal:0,bell:0,ult:0,wax:0,encase:0,burst:0,set:0,statue:0,shatter:0}; var __ceD=_doEffectCore, __ceW=waxOnCaster, __ceT=tallowEncase, __ceR=ringBurst, __ceC=ccApply;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="ceraline"&&(!o||!o.deliver||o._arrived)){ if(type==="sealwax") __ceN.seal++; if(type==="nova") __ceN.bell++; if(type==="finalcandle") __ceN.ult++; } return __ceD.apply(this,arguments); };'+
    'waxOnCaster=function(c){ __ceN.wax++; return __ceW.apply(this,arguments); }; tallowEncase=function(){ __ceN.encase++; return __ceT.apply(this,arguments); };'+
    'ringBurst=function(x,y,c,n){ if(c===0xe8d8b0&&n===10) __ceN.shatter++; return __ceR.apply(this,arguments); };'+
    'ccApply=function(u,t,f,d){ if(u&&u.key==="ceraline"&&f==="stunned"){ if(t&&t._sealBy===u&&!(t._sealT>0)) __ceN.set++; else __ceN.statue++; } return __ceC.apply(this,arguments); };'+
    'var __ceB=null; if(typeof waxShatterFx==="function"){ __ceB=waxShatterFx; waxShatterFx=function(){ __ceN.burst++; return __ceB.apply(this,arguments); }; }');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENCS.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__ceN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.seal>0&&c.bell>0&&c.ult>0&&c.wax>0&&c.encase>0&&c.set>0&&c.statue>0&&c.shatter>0,'the fights cast Sealing Wax, Mourning Bell and the Final Candle, waxed and encased enemies, set seals, made statues and burst effigies: '+JSON.stringify(c));
    assert.ok(c.burst>0,'and the Bell burst coats ('+c.burst+')'); }
  finally{ VMX('_doEffectCore=__ceD; waxOnCaster=__ceW; tallowEncase=__ceT; ringBurst=__ceR; ccApply=__ceC; if(__ceB) waxShatterFx=__ceB;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ gl:['gl_9_3','gl_11_4','gl_1_1','gl_10_4','gl_6_4','gl_3_3'],
            nc:['nc_3_3','nc_n1','nc_11_4'],
            ho:['ho_1_1','ho_3_1','ho_9_1','ho_12_4','ho_12_1','ho_10_1','ho_4_4','ho_1_4','ho_11_3','ho_7_2','ho_9_3','ho_13_2','ho_12_2','ho_1_2','ho_8_4','ho_6_2','ho_7_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={gl:0,nc:1,ho:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her damage-reduction talents true at once (the attacker is the Guest of Honour, coated and Gentle-Sealed; she holds
   every candle, in the Court's 25%, with Warm Wax and Waxen Mercy on her, Poised and A Candle for Every Course running, an ally with Warm Wax), normal and critical */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:3,allies:1,cold:true}), {v,F,A}=L; V.step(1); const f=F[0];
  if(L.T){ setMk(L,f,'guest',1e9); L.T.s.m.guest=f; setMk(L,f,'gs',1e9); coat(L,f,1e9); for(const m of ['ww','wm','cs']) setMk(L,v,m,1e9,1); setMk(L,A[0],'ww',1e9,1);
    L.T.s.w.poised={t:99,n:1,cdT:0,at:-1,wave:false}; L.T.s.w.acec={t:99,n:1,cdT:0,at:-1,wave:false}; setStack(L,'cand',L.T.st.cand.max); }
  V.step(1); v.maxHp=1e5; v.hp=5e4; v.shield=1e12; v.shieldT=999; coat(L,f,1e9);
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Ceraline: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[[['ho','gl'],[61,30]],[['ho','nc'],[61,30]],[['ho'],[91]],[['gl','ho'],[61,30]],[['nc','ho'],[61,30]],[['gl'],[91]],[['ho','gl','nc'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="ceraline"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="ceraline"&&u.alive){ __dr.ticks++; const m=u._talM&&u._talM[u.uid]; if(HERO61.immune(u,battleTime)||(m&&m.csI&&m.csI.until>battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','ceraline'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.ok(d.imm<d.ticks*0.5,'and she is immune far less than half the fight ('+d.imm+' of '+d.ticks+' ticks)'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
