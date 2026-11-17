'use strict';
/* Tick's talents as data on the mechanics layer (talents-mech/tick.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity with him in the line-up, his longest stun chain in seeded fights, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Tick, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12).
   Lab units are HELD (stunned 1e6), Tick too; lab skill level 10 (Overclock x1.368, Momentum Gears' cap +52.25%). Flywheel strikes every enemy whose CENTRE
   is within 3 m of his: the tests put enemies 2.9 m from his centre, which the skill reaches today and after the v1391 reach fix (body edge).
   Run: node --test tests/talents-mech-tick.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='tick', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const kk=L=>L.T.s.tk;
const recL=(L,t,o)=>{ const e=kk(L).e; let r=e[t.uid]; if(!r||r.u!==t) r=e[t.uid]={u:t,st:0,ra:0,sn:0,re:0,lk:0,cap:0}; return Object.assign(r,o||{}); };
const rq=(L,t)=>{ const r=kk(L).e[t.uid]; return (r&&r.u===t)?r:null; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on him (true damage unless said)
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const auto=(L,t,o)=>myHit(L,t||L.F[0],Object.assign({auto:true},o||{}));
const dmgOf=(t,fn)=>{ const h=t.hp+(t.shield||0); fn(); return h-t.hp-(t.shield||0); };
const castOC=L=>V.cast(L.v,'green',L.v);
const castMS=(L,t)=>V.cast(L.v,'blue',t||L.F[0]);
const castFW=(L,t)=>V.cast(L.v,'ult',t||L.F[0]);
/* talents-fix1 (17 Nov): since v1391 Flywheel reaches to the enemy's BODY EDGE (its radius from his centre to the enemy's body; Whirring, Wider Wheel and Twelve Bells
   widen that radius). gap(L,f,g,dx,dy): f placed so that the gap between his centre and its body is g metres, along (dx,dy) */
const gap=(L,f,g,dx,dy)=>{ const n=Math.hypot(dx,dy)||1, d=g+V.bodyR(f); at(L,f,dx/n*d,dy/n*d); };
const near3=(L,...F)=>{ const a=[[2.9,0],[0,2.9],[-2.9,0],[0,-2.9]]; F.forEach((f,i)=>at(L,f,a[i][0],a[i][1])); };   // inside Flywheel's 3 m (centre to centre)
const ccOn=(src,t,field,s)=>{ const lv=src.level; src.level=200; try{ V.cc(src,t,field,s); } finally{ src.level=lv; } };
const api=L=>L.T.s.api;
const auOf=(L,x)=>L.T.s.au.find(e=>e.x===x);
const rnd=(L,x,fn)=>{ const E=api(L).eng(), r0=E.rnd; E.rnd=()=>x; try{ return fn(); } finally{ E.rnd=r0; } };
const atkNow=v=>v.dmg*((v.dmgBuffT>0)?(v.dmgBuffMul||1):1)*VMX('rageMul');
const mag=(v,f)=>VMX('defMul')(v,f,'magic');
const free=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; kk(L).pst=0; };
const budget=L=>{ kk(L).bud=1e12; };

test('Tick: every talent is accounted for - 10 plain stats, 108 with rows, none waiting; renamed where another hero had the name; crit damage at most 10% each',()=>{
  accounting(H,[118,10,108,0,0]);
  for(const id of ['sq_1_4','sq_8_1','sq_2_3','sq_7_3','kb_8_3','kb_7_2','kb_1_2','bw_2_2','bw_5_4','bw_9_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  near(FXN.totals(H,[['sq_8_1',5]]).critDmg,0.10,"Clockmaker's Care: 2% x 5 (was 3%: 15%)"); near(FXN.totals(H,[['kb_7_2',5]]).critDmg,0.10,'Hard Stops: 2% x 5');
  assert.ok(!FXN.has(H,'kb_12_2'),'Ticking Heart is in the 5% crit group (rows)');
  const names={}; for(const h of Object.keys(require(path.join(root,'talents-data.js')).heroes)) for(const tr of T.trees(h)) for(const t of tr.talents) (names[t[3].toLowerCase()]=names[t[3].toLowerCase()]||new Set()).add(h);
  for(const tr of T.trees(H)) for(const t of tr.talents) assert.deepEqual([...names[t[3].toLowerCase()]],[H],t[0]+' '+t[3]+': no other hero has this name');
  for(const id of ['sq_13_2','kb_13_3','bw_13_3']) assert.ok(FXN.mech(H).talents[id],id);
});

test('Tick: his real kit, as the talents read it - Overclock (x1.368 for 5 s at the lab\'s level), Mainspring (5 punches at once, physical), Flywheel (3 m to the body edge since v1391), Momentum Gears (0.025 a second, cap +52.25%)',()=>{
  plain({foes:4,big:true},P=>{ const {v,F}=P; const sm=VMX('skillMul(10)');
    castOC(P); near(v.hasteMul,1.368,'Overclock: x1.368 attack speed',1e-9); near(v._ocT,5,'for 5 s',1e-9);
    const h0=F[0].hp; castMS(P,F[0]); near(h0-F[0].hp,5*atkNow(v)*0.36*sm*VMX('defMul')(v,F[0],'phys'),'Mainspring: 5 punches of 36% x skill level, physical (his profile\'s default: armour applies)',1e-6);
    gap(P,F[1],2.9,1,0); gap(P,F[2],3.1,-1,0); at(P,F[0],0,8+V.bodyR(F[0])); const g=F.map(f=>f.hp); castFW(P,F[1]); assert.ok(F[1].hp<g[1],'Flywheel strikes an enemy whose body is 2.9 m from his centre'); assert.equal(F[2].hp,g[2],'not one whose body is 3.1 m away');
    near(VMX('SKLV.momentumCap(passLv(units[0]))'),0.5225,'Momentum Gears\' cap at the lab\'s passive level'); const m0=v._momStk; V.step(30); near(v._momStk-m0,0.025*30*V.STEP,'ramps 0.025 a second',1e-6); });
});

/* ============================== CHIMES ============================== */
test('Tick / Chimes: Quarter Bell (every 4th basic attack 8% x 3 more), Three Bells (every 3rd), Echo in the Tower, Every Quarter (healing budget), Count the Strokes, Ringing Head, Dawn and Dusk',()=>{
  const L=lab(H,S(['sq_1_1','sq_12_1','sq_6_1','sq_10_1','sq_6_4','sq_3_1']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=5e5; budget(L);
  const d=[1,2,3,4,5,6,7,8].map(()=>auto(L)); near(d[0],1000,''); near(d[2],1000,''); near(d[3],1000*1.24,'the 4th basic attack is a Chime: 8% x 3 more'); near(d[7],1000*1.24,'and the 8th');
  near(myHit(L,F[0]),1000,'(not a skill hit)'); assert.equal(kk(L).chN,2,'two Chimes');
  near(v.hp,5e5+2*0.03*1e6,'Every Quarter: each Chime heals 1% x 3 of his max HP',1e-6);
  near(auto(L,F[0],{crit:true}),1000*(1+(F[0].critDmg||0.6)),'(a critical basic attack that is not a Chime)',1e-6);
  for(let i=0;i<2;i++) auto(L); const c=dmgOf(F[0],()=>V.hit(v,F[0],1000,{auto:true,kind:'true',crit:true}));
  near(c,plainHit(L,()=>dmgOf(F[0],()=>V.hit(v,F[0],1000,{auto:true,kind:'true',crit:true})))*1.24*1.09,'Echo in the Tower: a critical Chime 3% x 3 more on top');
  V.step(1); const ai=v.atkInterval; const P0=lab(H,null,{foes:3,big:true}); const ai0=P0.v.atkInterval;
  const R=lab(H,S(['sq_10_1','sq_6_4','sq_3_1']),{foes:3,big:true}); for(let i=0;i<4;i++) auto(R,R.F[1]); V.step(1); near(R.v.atkInterval,ai0/1.05,'Count the Strokes: each Chime 1% x 5 attack speed');
  const e=auOf(R,R.F[1]); near(e&&e.ap.aspd,1-0.08,'Ringing Head: the Chime\'s target attacks 4% x 2 slower'); secs(1.5); near(auOf(R,R.F[1]).ap.aspd,0.92,''); secs(0.6); V.step(1);
  const e2=auOf(R,R.F[1]); assert.ok(!e2||!(e2.ap.aspd<1),'Ringing Head for 2 s'); near(R.v.atkInterval,ai0/1.05,'(Count the Strokes still: 4 s)'); secs(2); near(R.v.atkInterval,ai0,'then gone',1e-9);
  R.v.blueCd=4; kk(R).bE=0.5; for(let i=0;i<4;i++) auto(R,R.F[1]); near(R.v.blueCd,3.5,'Dawn and Dusk: a Chime while Mainspring cools takes 1 s off - never under 4 s from its cast (cast 0.5 s ago)',1e-6);
  R.v.blueCd=3.5; kk(R).bE=3; for(let i=0;i<4;i++) auto(R,R.F[1]); near(R.v.blueCd,2.5,'(cast 3 s ago: the whole second)',1e-6);
  const B=lab(H,S(['sq_11_1','sq_1_1']),{foes:2,big:true}); const b=[1,2,3,4,5,6].map(()=>auto(B)); near(b[2],1240,'Three Bells: every 3rd basic attack is a Chime'); near(b[3],1000,''); near(b[5],1240,'');
  const U=lab(H,S(['sq_1_1','sq_6_1']),{foes:2,big:true}); U.v.maxHp=1e6; U.v.hp=5e5; kk(U).bud=0; V.step(1); for(let i=0;i<4;i++) auto(U); near(U.v.hp,5e5+1e6*0.012*V.STEP,'(Every Quarter is paid from the 1.2% a second budget)',1e-6);
});

test('Tick / Ring True: a Chime\'s critical chance (1.5% x 3) is one seeded roll inside the 5% crit group; Storm Coil and Punch Clock on Mainspring\'s punches; Ticking Heart, Overrun, Dusk Bell as a stat',()=>{
  const P0=lab(H,null,{foes:2,big:true}), c0=P0.v.glyphCrit||0;
  const L=lab(H,S(['sq_2_1','sq_1_1']),{foes:2,big:true}), {v,F}=L; v.glyphCrit=0;
  const ask=(auto,x,cur)=>rnd(L,x,()=>{ const s=L.T.s.cur; L.T.s.cur=cur||null; try{ const c={u:v,src:v,tgt:F[0],auto,force:false}; L.T.fn.crit(api(L),L.T,v,c); return c.force; } finally{ L.T.s.cur=s; } });
  kk(L).auto=0; assert.ok(!ask(true,0),'not a Chime: no extra crit (and no draw)'); kk(L).auto=3; assert.ok(ask(true,0.0449),'a Chime: 1.5% x 3'); kk(L).auto=3; assert.ok(!ask(true,0.0451),'(4.5%)');
  const M=lab(H,S(['sq_8_2','kb_6_3']),{foes:2,big:true}); M.v.glyphCrit=0; const ms=x=>rnd(M,x,()=>{ const s=M.T.s.cur; M.T.s.cur='punchflurry'; try{ const c={u:M.v,src:M.v,tgt:M.F[0],auto:false,force:false}; M.T.fn.crit(api(M),M.T,M.v,c); return c.force; } finally{ M.T.s.cur=s; } });
  assert.ok(ms(0.0499)&&!ms(0.0501),'Storm Coil 1% x 5 and Punch Clock 1% x 5 on a punch: 10% - held at 5%');
  const M1=lab(H,S(['sq_8_2']),{foes:2,big:true}); M1.v.glyphCrit=0; const m1=x=>rnd(M1,x,()=>{ const s=M1.T.s.cur; M1.T.s.cur='punchflurry'; try{ const c={u:M1.v,src:M1.v,tgt:M1.F[0],auto:false,force:false}; M1.T.fn.crit(api(M1),M1.T,M1.v,c); return c.force; } finally{ M1.T.s.cur=s; } });
  assert.ok(m1(0.0499)&&!m1(0.0501),'Storm Coil alone: 1% x 5');
  const G=lab(H,S(['kb_12_2','kb_5_1','bw_12_4','bw_1_4']),{foes:2,big:true}); near((G.v.glyphCrit||0)-c0,0.05,'Ticking Heart 1% x 5'); const G4=lab(H,[['kb_12_2',4]],{foes:2,big:true}); near((G4.v.glyphCrit||0)-c0,0.04,'Ticking Heart 4 of 5: 4%');
  const O=lab(H,S(['kb_5_1','kb_1_1']),{foes:2,big:true}); kk(O).strain=6; kk(O).sT=99; V.step(1); near((O.v.glyphCrit||0)-c0,0.005*6,'Overrun: 0.1% x 5 per Strain');
  kk(O).strain=10; V.step(1); near((O.v.glyphCrit||0)-c0,0.05,'(10 Strain: 5%)'); const D=lab(H,S(['bw_12_4','bw_1_4']),{foes:2,big:true}); kk(D).hours=11; V.step(1); near((D.v.glyphCrit||0)-c0,0,'Dusk Bell: not at 11 Hours'); kk(D).hours=12; V.step(1); near((D.v.glyphCrit||0)-c0,0.045,'at 12 Hours 1.5% x 3');
  kk(G).hours=12; kk(G).strain=10; V.step(1); near((G.v.glyphCrit||0)-c0,0.05,'all of them as a stat: held at 5%');
  const X=lab(H,S(['kb_12_2','sq_2_1','sq_1_1']),{foes:2,big:true}); X.v.glyphCrit=0.05; kk(X).auto=3; const okX=rnd(X,0,()=>{ const c={u:X.v,src:X.v,tgt:X.F[0],auto:true,force:false}; X.T.fn.crit(api(X),X.T,X.v,c); return c.force; }); assert.ok(!okX,'with Ticking Heart\'s 5% already: no more on a Chime');
});

test('Tick / The Hour: every 4th Chime also strikes every other enemy within 2 m of the target for the damage it dealt; Strike the Hour (SIGNATURE, every 2nd Chime): every enemy within 4 m a full discharge, then 2 Static, Mainspring ready',()=>{
  const L=lab(H,S(['sq_7_1','sq_1_1']),{foes:4,big:true}), {v,F}=L; const gap=(a,b)=>(Math.hypot(a.x-b.x,a.y-b.y)/V.METER)-V.bodyR(a)-V.bodyR(b);
  at(L,F[1],4.5,V.bodyR(F[0])+V.bodyR(F[1])+1.9); at(L,F[2],4.5,-(V.bodyR(F[0])+V.bodyR(F[2])+2.1)); at(L,F[3],30,0);
  const h=F.map(f=>f.hp); for(let i=0;i<15;i++) auto(L); assert.equal(JSON.stringify(F.slice(1).map((f,i)=>f.hp===h[i+1])),'[true,true,true]','(3 Chimes: no Hour)');
  const d=dmgOf(F[0],()=>auto(L)); near(h[1]-F[1].hp,d*VMX('defMul')(v,F[1],'phys')/VMX('defMul')(v,F[0],'phys'),'the 4th Chime: an enemy 1.9 m from the target takes what it dealt',1e-6);
  assert.equal(F[2].hp,h[2],'(not one 2.1 m away)'); assert.equal(F[3].hp,h[3],'');
  const S2=lab(H,S(['sq_13_2','sq_1_2','sq_5_3']),{foes:4,big:true}), w=S2.v, G=S2.F; at(S2,G[1],0,V.bodyR(w)+V.bodyR(G[1])+3.9); at(S2,G[2],0,-(V.bodyR(w)+V.bodyR(G[2])+4.2)); at(S2,G[0],V.bodyR(w)+V.bodyR(G[0])+0.5,0);
  recL(S2,G[0],{st:3}); w.blueCd=5; const g=G.map(f=>f.hp); for(let i=0;i<7;i++) V.hit(w,G[3],1,{auto:true,kind:'true'}); const s0=G.map(f=>f.hp);
  assert.equal(JSON.stringify(s0.slice(0,3)),JSON.stringify(g.slice(0,3)),'(1 Chime on another enemy: nothing yet)'); V.hit(w,G[3],1,{auto:true,kind:'true'});
  const x=atkNow(w)*0.30*3; near(s0[0]-G[0].hp,x*mag(w,G[0]),'the 2nd Chime: every enemy within 4 m of Tick takes a full discharge (Static in the Gears 6% x 5, Long Fuse\'s triple)',1e-6);
  near(s0[1]-G[1].hp,x*mag(w,G[1]),'(3.9 m away: too)',1e-6); assert.equal(G[2].hp,s0[2],'(not 4.2 m away)'); assert.equal(rq(S2,G[0]).st,2,'then it holds 2 Static (its 3 were spent)'); near(w.blueCd,0,'and Mainspring is ready at once');
});

/* ============================== STATIC ============================== */
test('Tick / Static: each Mainspring punch adds 1 (max 5); at 5 a discharge (6% x 5 of his attack, magic) - Short Circuit at 3, Long Fuse to 10 (triple), Thunder Flurry\'s critical punches 2',()=>{
  let p=0; plain({foes:3,big:true},P=>{ p=dmgOf(P.F[0],()=>castMS(P,P.F[0])); });
  const L=lab(H,S(['sq_1_2']),{foes:3,big:true}), {v,F}=L; const d=dmgOf(F[0],()=>castMS(L,F[0])); near(d-p,atkNow(v)*0.30*mag(v,F[0]),'5 punches: 5 Static, a discharge for 6% x 5 of his attack as magic damage',1e-6); assert.equal(rq(L,F[0]).st,0,'and its Static empties');
  auto(L,F[1]); assert.ok(!(rq(L,F[1])&&rq(L,F[1]).st>0),'(a basic attack adds no Static)');
  const C=lab(H,S(['sq_1_2','sq_5_2']),{foes:3,big:true}); const dc=dmgOf(C.F[0],()=>castMS(C,C.F[0])); near(dc-p,atkNow(C.v)*0.30*mag(C.v,C.F[0]),'Short Circuit: a discharge at 3',1e-6); assert.equal(rq(C,C.F[0]).st,2,'(the other 2 punches stay)');
  const F2=lab(H,S(['sq_1_2','sq_5_3']),{foes:3,big:true}); near(dmgOf(F2.F[0],()=>castMS(F2,F2.F[0])),p,'Long Fuse: 5 Static is not a discharge'); assert.equal(rq(F2,F2.F[0]).st,5,'');
  near(dmgOf(F2.F[0],()=>castMS(F2,F2.F[0]))-p,atkNow(F2.v)*0.30*3*mag(F2.v,F2.F[0]),'at 10: a triple discharge',1e-6);
  const N=lab(H,S(['sq_5_2']),{foes:3,big:true}); near(dmgOf(N.F[0],()=>castMS(N,N.F[0]))-p,atkNow(N.v)*0.06*mag(N.v,N.F[0]),'(without Static in the Gears a discharge still deals 6%)',1e-6);
  const TF=lab(H,S(['sq_1_2','sq_9_2']),{foes:3,big:true}); TF.v.glyphCrit=1; castMS(TF,TF.F[0]); assert.equal(rq(TF,TF.F[0]).st,4,'Thunder Flurry: every punch critical - 2 Static each: 2, 4, 6 (a discharge), then 2, 4');
  assert.equal(kk(TF).dis,1,'');
});

test('Tick / discharges: Charged Brass (20% x 3 to the nearest other enemy within 4 m), Earth Wire\'s shield, Lightning Gears, Storm in the Tower (attack per discharge, up to 10), Tower Lightning',()=>{
  const L=lab(H,S(['sq_1_2','sq_2_2','sq_10_2','sq_6_2','sq_11_2','sq_12_2']),{foes:3,big:true}), {v,F}=L; v.shield=0; const g=F.map(f=>f.hp);
  for(let i=0;i<4;i++) V.hit(v,F[0],1,{kind:'true'}); recL(L,F[0],{st:4}); L.T.s.cur='punchflurry'; V.hit(v,F[0],1,{kind:'true'}); L.T.s.cur=null; const x=atkNow(v)*0.30*1.15;
  near(g[1]-F[1].hp,x*0.60*mag(v,F[1]),'Charged Brass: the nearest other enemy takes 20% x 3 of the discharge (Lightning Gears: 3% x 5 more)',1e-6); assert.equal(F[2].hp,g[2],'(only one)');
  near(v.shield,0.045*v.maxHp,'Earth Wire: a shield of 1.5% x 3 of his max HP',1e-6); near(v.shieldT,3,'for 3 s',1e-9);
  V.step(1); const a1=v.dmg; kk(L).gs=6; V.step(1); near(v.dmg,a1/(1+0.025)*(1+0.025*6),'Storm in the Tower: 0.5% x 5 attack per discharge in the fight',1e-6); kk(L).gs=10;
  for(let i=0;i<20;i++){ recL(L,F[2],{st:4}); L.T.s.cur='punchflurry'; V.hit(v,F[2],1,{kind:'true'}); L.T.s.cur=null; } assert.equal(kk(L).gs,10,'(up to 10)');
  { kk(L).gs=9; const x9=atkNow(v)*0.30*1.15, h9=F[0].hp; recL(L,F[0],{st:4}); L.T.s.cur='punchflurry'; V.hit(v,F[0],1,{kind:'true'}); L.T.s.cur=null; near(h9-F[0].hp-1,x9*mag(v,F[0]),'(9 discharges: not full)',1e-6); kk(L).gs=10; }
  const x2=atkNow(v)*0.30*1.15, h0=F[0].hp; recL(L,F[0],{st:4}); L.T.s.cur='punchflurry'; V.hit(v,F[0],1,{kind:'true'}); L.T.s.cur=null; near(h0-F[0].hp-1,x2*1.20*mag(v,F[0]),'Tower Lightning: once it is full, 4% x 5 more',1e-6);
  at(L,F[1],40,0); at(L,F[2],60,0); const h1=F[1].hp; recL(L,F[0],{st:4}); L.T.s.cur='punchflurry'; V.hit(v,F[0],1,{kind:'true'}); L.T.s.cur=null; assert.equal(F[1].hp,h1,'(no other enemy within 4 m: no jump)');
});

test('Tick / Static on a target: Charged Casing (0.5% x 3 more damage per Static), Heavy Static (1% x 3 slower per Static), Charged Spin (Flywheel: 20% x 5 chance of 2 Static)',()=>{
  const L=lab(H,S(['sq_4_2','sq_6_3','sq_5_3']),{foes:3,big:true}), {F}=L; recL(L,F[0],{st:4}); near(myHit(L,F[0]),1000*(1+0.015*4),'Charged Casing: 4 Static, 1.5% each');
  near(myHit(L,F[1]),1000,'(none)'); V.step(1); const e=auOf(L,F[0]); near(e&&e.ap.move,1-0.03*4,'Heavy Static: 3% slower per Static'); recL(L,F[0],{st:0}); V.step(1); const e2=auOf(L,F[0]); assert.ok(!e2||!(e2.ap.move<1),'(none: not slowed)');
  const C=lab(H,S(['sq_9_4','sq_5_3']),{foes:3,big:true}); near3(C,C.F[0],C.F[1]); castFW(C,C.F[0]); assert.deepEqual([rq(C,C.F[0]).st,rq(C,C.F[1]).st],[2,2],'Charged Spin at 5: each enemy Flywheel hits gains 2 Static');
  const C2=lab(H,[['sq_9_4',2],['sq_5_3',1]],{foes:3,big:true}); near3(C2,C2.F[0]); rnd(C2,0.39,()=>castFW(C2,C2.F[0])); assert.equal(rq(C2,C2.F[0]).st,2,'at 2 ranks: a 40% chance (a roll of 0.39)'); rnd(C2,0.41,()=>castFW(C2,C2.F[0])); assert.equal(rq(C2,C2.F[0]).st,2,'(0.41: not)');
});

/* ============================== HIS HITS AND STATS ============================== */
test('Tick / his hits: Rapid Quarters, Rapid Gears, Grinding Gears (Mainspring); Fast Fists, Deep Movement (basic attacks); Bell-Metal Fists and Filed Cogs (armour); stats: Quick Escapement, Quick Step, Near the Snap',()=>{
  let p=0; plain({foes:2,big:true},P=>{ p=dmgOf(P.F[0],()=>castMS(P,P.F[0])); });
  const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval, sp0=P0.v.speed;
  const L=lab(H,S(['sq_4_3','kb_4_4','bw_8_2','kb_6_4','bw_7_2','sq_5_4','kb_2_2','kb_12_4']),{foes:2,big:true}), {v,F}=L;
  near(dmgOf(F[0],()=>castMS(L,F[0])),p*1.15*1.15*1.15,'Mainspring: Rapid Quarters 5% x 3, Rapid Gears 3% x 5, Grinding Gears 3% x 5 more (each multiplies)');
  near(auto(L),1000*1.09*1.10,'basic attacks: Fast Fists 3% x 3, Deep Movement 2% x 5 more'); near(myHit(L,F[0]),1000,'(not his other hits)');
  near(v.speed,sp0*(1+0.09+0.09),'Quick Escapement 3% x 3 and Quick Step 3% x 3 faster'); v.hp=v.maxHp*0.32; V.step(1); near(v.atkInterval,ai0,'(32%: no)',1e-9); v.hp=v.maxHp*0.29; V.step(1); near(v.atkInterval,ai0/1.12,'Near the Snap: below 30% HP, 4% x 3 faster'); v.hp=v.maxHp; V.step(1); near(v.atkInterval,ai0,'(not above)',1e-9);
  const A=lab(H,S(['sq_3_3','kb_3_2']),{foes:2,big:true}), f=A.F[0]; f.armorRating=800; const m0=VMX('defMul')(A.v,f,'phys'); A.v._wpnArmIgn=0.10; const m1=VMX('defMul')(A.v,f,'phys'); A.v._wpnArmIgn=0;
  const q=plainHit(A,()=>myHit(A,f,{kind:'phys'})); near(myHit(A,f,{kind:'phys'}),q*(m1/m0)*(m1/m0),'Bell-Metal Fists, Filed Cogs: his hits ignore 2% x 5 of the armour each (their shares multiply)',1e-6);
});

/* ============================== OVERCLOCK ============================== */
test('Tick / Overclock: longer (Overwound Coil, Hot Gears, Wound Once); during it Racing Heart, Bright Runs, Thrum, Runaway; Kick of the Spring on the first basic attack',()=>{
  const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval, sp0=P0.v.speed, ls0=P0.v.lifestealStat||0;
  const L=lab(H,S(['sq_10_3','kb_4_3','bw_6_1','kb_2_3','sq_11_4','kb_10_1','kb_7_1','kb_9_4']),{foes:2,big:true}), {v}=L; castOC(L);
  near(kk(L).oc,5+0.9+0.9+1.0,'Overclock lasts 0.3 x 3 + 0.3 x 3 + 0.5 x 2 s longer'); near(v._ocT,7.8,'(the game\'s own buff too)',1e-9); V.step(1);
  near(v.atkInterval,ai0/(1+0.15+0.10),'during it: Racing Heart 3% x 5, Bright Runs 2% x 5 faster (attack-speed rows add)'); near(v.speed,sp0*1.10,'Thrum: 2% x 5 faster'); near((v.lifestealStat||0)-ls0,0.06,'Runaway: 2% x 3 lifesteal');
  near(auto(L),1000*1.25,'Kick of the Spring: the first basic attack during it 5% x 5 more'); near(auto(L),1000,'(only the first)'); secs(7.8); near(v.atkInterval,ai0,'when it ends: gone',1e-9); near(v.speed,sp0,'',1e-9);
  castOC(L); secs(7.9); near(auto(L),1000,'(the first after it ended: no Kick)');
});

/* ============================== WIND ============================== */
test('Tick / Wind: Turn the Key (5 from each Overclock, max 10, 1 every 1.5 s; 0.4% x 5 more damage each), Extra Turns, Overcharged, Wound Up, Wind Reserve, Let It Run Down, Spent Spring',()=>{
  const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval, sp0=P0.v.speed;
  const L=lab(H,S(['kb_1_4','kb_2_4','kb_10_4','kb_6_2','kb_11_4']),{foes:2,big:true}), {v}=L; v.maxHp=1e6; v.hp=5e5; budget(L); castOC(L); assert.equal(kk(L).wind,8,'Overclock winds 5, Extra Turns 1 x 3');
  near(myHit(L,L.F[0]),1000*(1+0.02*8),'Turn the Key: 0.4% x 5 more damage per Wind'); V.step(1); near(v.atkInterval,ai0/(1+0.015*8),'Overcharged: 0.3% x 5 attack speed per Wind'); near(v.speed,sp0*1.09,'Wound Up: 5 or more Wind, 3% x 3 faster');
  castOC(L); assert.equal(kk(L).wind,10,'(max 10)'); secs(1.45); assert.equal(kk(L).wind,10,''); secs(0.1); assert.equal(kk(L).wind,9,'1 runs down every 1.5 s'); secs(1.5*4); assert.equal(kk(L).wind,5,''); secs(1.5); assert.equal(kk(L).wind,4,''); V.step(1); near(v.speed,sp0,'(4: not faster)',1e-9);
  const h=v.hp; secs(1.5*4+0.1); assert.equal(kk(L).wind,0,''); near(v.hp-h,0.05*1e6,'Spent Spring: when it runs out he heals 1% x 5',1e-6);
  const D=lab(H,S(['kb_1_4','kb_5_2']),{foes:2,big:true}); castOC(D); secs(2.9); assert.equal(kk(D).wind,5,'Let It Run Down: 1 every 3 s'); secs(0.2); assert.equal(kk(D).wind,4,'');
  const W=lab(H,S(['kb_7_4','kb_1_4']),{foes:2,big:true,cold:true}); V.step(1); W.T=W.v._tal; assert.equal(kk(W).wind,10,'Wind Reserve: each wave starts with 2 x 5 Wind'); kk(W).wind=3; V.wave(); V.step(1); assert.equal(kk(W).wind,10,'(each wave)');
  const W3=lab(H,[['kb_7_4',3],['kb_1_4',5]],{foes:2,big:true,cold:true}); V.step(1); W3.T=W3.v._tal; assert.equal(kk(W3).wind,6,'Wind Reserve 3 of 5: 6');
});

test('Tick / Past the Stop (Mainspring spends all Wind: 1 punch more per 2) and Snap the Spring (when Overclock ends, all Wind snaps loose: the next Mainspring 2% more per Wind released)',()=>{
  let p=0; plain({foes:2,big:true},P=>{ p=dmgOf(P.F[0],()=>castMS(P,P.F[0])); });
  const L=lab(H,S(['kb_3_4','kb_1_4']),{foes:2,big:true}); kk(L).wind=7; near(dmgOf(L.F[0],()=>castMS(L,L.F[0])),p*(5+3)/5,'7 Wind: 3 more punches (the Wind is spent at the press: Turn the Key gives them nothing)',1e-6); assert.equal(kk(L).wind,0,'all spent');
  near(dmgOf(L.F[0],()=>castMS(L,L.F[0])),p,'(no Wind: 5 punches)');
  const N=lab(H,S(['kb_5_3','kb_1_4']),{foes:2,big:true}); castOC(N); secs(5.05); assert.equal(kk(N).wind,0,'Snap the Spring: Overclock ends - the Wind (2 left after 3 have run down) snaps loose'); assert.equal(kk(N).snap,2,'');
  near(dmgOf(N.F[0],()=>castMS(N,N.F[0])),p*1.04,'the next Mainspring: 2% more per Wind released'); near(dmgOf(N.F[0],()=>castMS(N,N.F[0])),p,'(only that one)');
});

/* ============================== STRAIN ============================== */
test('Tick / Strain: Something Wrong (basic attacks during Overclock, max 10; 1% x 3 attack speed each, 0.5% more damage taken each; 1 runs down every 2 s after), Hold Together, Let It Run Down, Hot Bearings',()=>{
  const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval;
  const L=lab(H,S(['kb_1_1','kb_6_1']),{foes:2,big:true}), {v}=L; auto(L); assert.equal(kk(L).strain,0,'(not during Overclock: none)');
  castOC(L); for(let i=0;i<6;i++) auto(L); myHit(L,L.F[0]); assert.equal(kk(L).strain,6,'each basic attack during Overclock: 1 Strain'); V.step(1); near(v.atkInterval,ai0/(1+0.03*6),'1% x 3 attack speed each');
  near(hitOn(L),plainHit(L,()=>hitOn(L))*(1+0.005*6),'and 0.5% more damage taken each');
  for(let i=0;i<8;i++) auto(L); assert.equal(kk(L).strain,10,'max 10'); near(auto(L),1000*1.12,'Hot Bearings: at 10 Strain basic attacks 6% x 2 more');
  secs(5); assert.equal(kk(L).strain,10,'(no running down during Overclock)'); secs(1.9); assert.equal(kk(L).strain,10,''); secs(0.2); assert.equal(kk(L).strain,9,'1 every 2 s once it ended'); near(auto(L),1000,'(9: not Hot Bearings)'); secs(1.95); assert.equal(kk(L).strain,8,'(and the next 2 s later)'); near(auto(L),1000,'(8: not Hot Bearings)');
  const D=lab(H,S(['kb_1_1','kb_3_1']),{foes:2,big:true}); kk(D).strain=10; near(hitOn(D),plainHit(D,()=>hitOn(D))*(1+0.001*10),'Hold Together: 0.08% x 5 less per Strain (0.1% each)');
  const R=lab(H,S(['kb_1_1','kb_5_2']),{foes:2,big:true}); kk(R).strain=10; near(hitOn(R),plainHit(R,()=>hitOn(R)),'Let It Run Down: Strain costs nothing');
});

test('Tick / Wheel Overwound (Flywheel spends all Strain: 3% more each, 0.2 s off Overclock each - never under 5 s from its cast) and Spun Down (0.3% x 5 healed per Strain spent)',()=>{
  let p=0; plain({foes:2,big:true},P=>{ near3(P,P.F[0]); p=dmgOf(P.F[0],()=>castFW(P,P.F[0])); });
  const L=lab(H,S(['kb_11_3','kb_12_3','kb_4_2']),{foes:2,big:true}), {v}=L; near3(L,L.F[0]); v.maxHp=1e6; v.hp=5e5; kk(L).strain=6; v.greenCd=5; kk(L).gE=0.5;
  near(dmgOf(L.F[0],()=>castFW(L,L.F[0])),p*1.18,'6 Strain spent: 3% x 6 more'); assert.equal(kk(L).strain,0,''); near(v.greenCd,4.5,'0.2 s x 6 off Overclock\'s cooldown - never under 5 s from its cast (0.5 s ago)',1e-9);
  near(v.hp,5e5+0.015*6*1e6,'Spun Down: 0.3% x 5 per Strain spent',1e-6); near(dmgOf(L.F[0],()=>castFW(L,L.F[0])),p,'(no Strain: plain)');
  kk(L).strain=5; v.greenCd=6; kk(L).gE=3; castFW(L,L.F[0]); near(v.greenCd,5,'(3 s after its cast: the whole 1 s)',1e-9);
});

/* ============================== ONLY THE CLOCKMAKER ============================== */
test('Tick / Only the Clockmaker (SIGNATURE): 10 Wind and 6 Strain - 6 s of full Momentum, Overclock again, Mainspring ready, Strain becomes Wind; then Momentum back and slowed 30% for 2 s; once every 25 s, across a wave',()=>{
  const L=lab(H,S(['kb_13_3','kb_1_1','kb_1_4']),{foes:2,big:true}), {v}=L; const cap=VMX('SKLV.momentumCap(passLv(units[0]))');
  const force=()=>{ const k=kk(L); k.wind=10; k.strain=10; k.wT=99; k.sT=99; };
  v._momStk=0.1; v.blueCd=5; Object.assign(kk(L),{wind:9,strain:8,wT:99}); V.step(1); assert.equal(kk(L).sig2,0,'(9 Wind: not yet)'); kk(L).wind=10; kk(L).strain=5; V.step(1); assert.equal(kk(L).sig2,0,'(5 Strain: not yet)'); kk(L).strain=6; V.step(1);
  near(kk(L).sig2,6,'10 Wind and 6 Strain: 6 s',0.05); V.step(1); near(v._momStk,cap,'Momentum Gears is full'); near(v.blueCd,0,'Mainspring ready'); near(v._ocT,5,'Overclock cast again',0.1); assert.ok(kk(L).oc>4.8,'');
  kk(L).strain=3; kk(L).wind=4; auto(L); assert.deepEqual([kk(L).strain,kk(L).wind],[3,5],'a Strain he would gain becomes Wind');
  secs(6); assert.ok(v._momStk<cap&&Math.abs(v._momStk-Math.min(cap,0.1+0.025*6+0.025*6*V.STEP*3))<0.02,'when it ends Momentum is back where it was (with its ramp): '+v._momStk); near(v.slow,2-V.STEP,'and he is slowed for 2 s',0.05); near(v.slowMul,0.70,'by 30%');
  force(); secs(5); assert.equal(kk(L).sig2,0,'once every 25 s');
  V.wave(); VMX('battleTime=0'); V.step(1); secs(13.7); force(); V.step(1); assert.equal(kk(L).sig2,0,'(24.9 s later, across a wave whose clock restarted at 0: not yet) '+kk(L).s2); force(); secs(0.3); assert.ok(kk(L).sig2>5,'25 s later: again');
  const B=lab(H,S(['kb_13_3','kb_1_1','kb_1_4','kb_12_1','bw_9_3','bw_4_4']),{foes:2,big:true}); B.v._momStk=cap; Object.assign(kk(B),{wind:10,strain:10,wT:99,sT:99}); secs(6.1); near(B.v.slowMul,0.70,'(his talents never weaken nor end that slow)'); assert.ok(B.v.slow>1.5,'');
});

/* ============================== FEELS WRONG, COOLDOWNS ============================== */
test('Tick / Feels Wrong: a stun or slow lands while Overclock is ready - he casts it at once (its cooldown starts) and the stun or slow ends',()=>{
  const L=lab(H,S(['kb_9_1','kb_4_2']),{foes:2,big:true}), {v,F}=L; free(L); V.step(1); ccOn(F[0],v,'stunned',1); assert.ok(v.stunned>0,''); v.greenCd=0; v._castT=0.1; V.step(1);
  near(v.stunned,0,'the stun ends'); near(v._ocT,5,'Overclock is cast',0.05); near(v.greenCd,8-0.9,'and its cooldown starts (Short Rest 0.3 x 3)',0.05);
  ccOn(F[0],v,'stunned',1); V.step(1); assert.ok(v.stunned>0,'(Overclock cooling: the stun stays)'); v.stunned=0; v.greenCd=1e9; V.step(1); v.slow=0; ccOn(F[0],v,'slow',2); v.greenCd=0; v._castT=0.1; V.step(1); near(v.slow,0,'a slow too');
  v.greenCd=1e9; v.silencedT=2; V.step(1); ccOn(F[0],v,'stunned',1); v.greenCd=0; V.step(1); assert.ok(v.stunned>0,'(silenced: no)');
});

test('Tick / cooldowns: Oiled Joints, Ticking Over (Mainspring, 4 s at least), Short Rest (Overclock, 5 s at least)',()=>{
  const L=lab(H,S(['sq_8_3','kb_11_2','kb_4_2','sq_3_1']),{foes:2,big:true}), {v}=L;
  near(FX.cd(v,'blue',7),7-0.9-0.75,'Mainspring 0.3 x 3 and 0.15 x 5 s shorter'); near(FX.cd(v,'blue',5),4,'never under 4 s'); near(FX.cd(v,'green',8),8-0.9,'Overclock 0.3 x 3 s shorter'); near(FX.cd(v,'green',5.5),5,'never under 5 s');
  near(kk(L).bE,0,'(the floors count from the cast)');
});

/* ============================== MOMENTUM GEARS ============================== */
test('Tick / Momentum Gears: Second Hand and Keeping Time (faster), True Running (half full), Heavy Gears (full), Never Told to Stop (a head start), Through Three Cities (2 points more cap per Hour), No One to Stop It',()=>{
  const L=lab(H,S(['kb_8_2','bw_8_4','sq_3_4','bw_3_2']),{foes:2,big:true}), {v,F}=L; const cap=VMX('SKLV.momentumCap(passLv(units[0]))');
  v._momStk=0; V.step(30); near(v._momStk,0.025*30*V.STEP*(1+0.3+0.4),'ramps 10% x 3 + 8% x 5 faster',1e-6);
  v._momStk=0.49*cap; near(myHit(L,F[0]),1000,'(below half full: no True Running)'); v._momStk=0.5*cap; near(myHit(L,F[0]),1000*1.10,'True Running: at least half full, 2% x 5 more');
  V.step(1); const a0=v.dmg; v._momStk=cap; V.step(1); near(v.dmg,a0*1.10,'Heavy Gears: full, 2% x 5 attack');
  v.pass=null; v._momStk=cap; V.step(1); near(v.dmg,a0,'(nothing without his passive)'); near(myHit(L,F[0]),1000,''); v.pass={momentum:true};
  const N=lab(H,S(['bw_3_1']),{foes:2,big:true,cold:true}); N.v._momStk=0; V.step(1); near(N.v._momStk,0.5*cap,'Never Told to Stop: the fight starts 10% x 5 of the way full',0.002); N.v._momStk=0.1; V.wave(); V.step(1); near(N.v._momStk,0.1,'(only the first wave: it keeps its speed between waves anyway)',0.002);
  const C=lab(H,S(['bw_3_4','bw_1_4']),{foes:2,big:true}); const ai0=C.v.atkInterval; kk(C).hours=6; C.v._momStk=cap*0.99; V.step(1); near(C.v.atkInterval,ai0,'(not full: nothing)',1e-9); C.v._momStk=cap;
  secs(2); near(kk(C).mx,0.05,'once full, 2 points a Hour more, at its own rate (0.025 a second)',0.005); secs(4); near(kk(C).mx,0.12,'(6 Hours: 12 points at most)',1e-9); V.step(1); near(C.v.atkInterval,ai0*(1+cap)/(1+cap+0.12),'given as attack speed above the cap',1e-6); kk(C).hours=0; C.v.pass=null; V.step(1); near(C.v.atkInterval,ai0,'(only while Momentum Gears is full)',1e-6); C.v.pass={momentum:true}; kk(C).hours=6;
  const O=lab(H,S(['bw_9_3','bw_8_3']),{foes:2,big:true}), w=O.v; free(O); w._momStk=cap; ccOn(O.F[0],w,'slow',2); near(w.slow||0,0,'No One to Stop It: full - he cannot be slowed'); w.slow=2; w.slowMul=0.5; V.step(1); near(w.slow,0,'(a slow on him ends)');
  w._momStk=0.2; ccOn(O.F[0],w,'slow',2); assert.ok(w.slow>0,'(not full: slowed)'); w.slow=0; w.maxHp=1e6; w.hp=5e5; budget(O); for(const r of O.T.on.tick) if(r.period) O.T.s.lim[r.key].acc=0; kk(O).wcT=0; w._momStk=cap; secs(3.05); near(w.hp,5e5+0.015*1e6*2,'Weights and Chains (0.3% x 5 every 3 s) twice as much',1e-3);
});

/* ============================== STROKES AND HOURS ============================== */
test('Tick / Strokes and Hours: Count Them (every hit he lands and takes; 10 a Hour, max 12; 0.3% x 3 less damage an Hour), Struck Hours, Every Second, Patient Strokes, Count of Hours, Wound by the Hour (LINK), The Hour Mark, Turned by Hand',()=>{
  const L=lab(H,S(['bw_1_4','bw_6_4','bw_2_4','bw_10_4','bw_n1','bw_7_4','bw_11_3']),{foes:2,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=5e5; budget(L);
  for(let i=0;i<5;i++) myHit(L,F[0]); for(let i=0;i<4;i++) hitOn(L,10); assert.equal(kk(L).hours,0,'(9 Strokes)'); v.blueCd=5; const a0=v.dmg, m0=v.maxHp; hitOn(L,10); assert.equal(kk(L).hours,1,'the 10th Stroke marks an Hour');
  near(v.blueCd,0,'The Hour Mark: Mainspring ready at once'); near(v.hp/v.maxHp,(5e5-10*5+1e6*0.02+1e6*0.01)/1e6,'Turned by Hand (every 10 Strokes 0.4% x 5) and Wound by the Hour (1%)',1e-6);
  V.step(1); near(v.dmg,a0*1.009,'Patient Strokes: 0.3% x 3 attack an Hour'); near(v.maxHp,m0*1.01,'Count of Hours: 0.2% x 5 max HP an Hour');
  myHit(L,F[0],{crit:true}); assert.equal(kk(L).strokes,10+1+3,'Struck Hours: a critical hit of his counts 1 x 3 more');
  const C1=lab(H,S(['bw_1_4']),{foes:2,big:true}); kk(C1).hours=1; near(hitOn(C1),plainHit(C1,()=>hitOn(C1))*(1-0.009),'Count Them: 0.3% x 3 less damage an Hour');
  kk(L).hours=11; kk(L).strokes=0; for(let i=0;i<40;i++) hitOn(L,1); assert.equal(kk(L).hours,12,'max 12 Hours');
  const K=lab(H,S(['bw_n1','kb_1_4']),{foes:2,big:true}); kk(K).strain=3; kk(K).wind=2; for(let i=0;i<10;i++) hitOn(K,1); assert.deepEqual([kk(K).wind,kk(K).strain],[3,2],'Wound by the Hour with Turn the Key: each Hour 1 Wind and 1 Strain cleared');
  const E=lab(H,S(['bw_12_3','bw_1_4']),{foes:2,big:true}); const s0=kk(E).strokes; secs(2.95); assert.equal(kk(E).strokes,s0,''); secs(0.1); assert.equal(kk(E).strokes,s0+5,'Every Second: 1 x 5 Strokes every 3 s while an enemy stands');
  for(const f of E.F){ f.alive=false; } secs(3.1); assert.equal(kk(E).strokes,s0+5,'(no enemy: none)');
});

/* ============================== SPIN ============================== */
test('Tick / Spin: Great Wheel (each enemy Flywheel hits, max 10, the wave; 0.3% x 5 armour each), Balance Wheel, Turning Guard, Spun Steel, Ringing Wheel, Keep Turning, Wheel at Rest + Oil and Rest, Ratchet',()=>{
  const P0=lab(H,null,{foes:3,big:true}), ar0=P0.v.armorRating, mr0=P0.v.mrRating, ls0=P0.v.lifestealStat||0; let p=0; near3(P0,P0.F[0],P0.F[1]); p=dmgOf(P0.F[0],()=>castFW(P0,P0.F[0]));
  const L=lab(H,S(['bw_1_3','bw_2_3','bw_7_1','bw_9_1','bw_11_1']),{foes:3,big:true}), {v,F}=L; near3(L,F[0],F[1]); at(L,F[2],0,8);
  near(dmgOf(F[0],()=>castFW(L,F[0])),p,'(no Spin before the first)'); assert.equal(kk(L).spin,2,'two enemies hit: 2 Spin'); V.step(1);
  near(v.armorRating,ar0*(1+0.015*2),'Great Wheel: 0.3% x 5 armour each'); near(v.mrRating,mr0*(1+0.009*2),'Balance Wheel: 0.3% x 3 magic resist each'); near((v.lifestealStat||0)-ls0,0.01*2,'Turning Guard: 0.2% x 5 lifesteal each');
  near3(L,F[0],F[1]); near(dmgOf(F[0],()=>castFW(L,F[0])),p*(1+0.02*2),'Ringing Wheel: Flywheel 0.4% x 5 more per Spin'); kk(L).spin=9; near(myHit(L,F[2]),1000,'(9 Spin: no Spun Steel)'); kk(L).spin=10; near(myHit(L,F[2]),1000*1.10,'Spun Steel: at 10 Spin 2% x 5 more'); near3(L,F[0],F[1]); castFW(L,F[0]); assert.equal(kk(L).spin,10,'(max 10)');
  V.wave(); V.step(1); assert.equal(kk(L).spin,0,'gone at a new wave');
  const K=lab(H,S(['bw_5_3','bw_1_3']),{foes:3,big:true}); kk(K).spin=7; V.wave(); V.step(1); assert.equal(kk(K).spin,7,'Keep Turning: kept');
  const W=lab(H,S(['bw_5_2','bw_6_2','bw_1_3']),{foes:3,big:true}); near3(W,W.F[0],W.F[1]); kk(W).spin=0; W.v.maxHp=1e6; W.v.hp=5e5; castFW(W,W.F[0]); near(W.v.hp,5e5+2*(0.005+0.006)*1e6,'Wheel at Rest: each Spin heals 0.5% as it comes, Oil and Rest 0.2% x 3 more',1e-6);
  const R=lab(H,S(['bw_10_3','bw_1_3']),{foes:2,big:true}); free(R); V.step(1); kk(R).spin=0; ccOn(R.F[0],R.v,'stunned',1); V.step(1); assert.equal(kk(R).spin,3,'Ratchet: each time he is stunned, 1 x 3 Spin');
});

/* ============================== FLYWHEEL ============================== */
test('Tick / Flywheel: Whirring and Wider Wheel (reach), Flywheel Teeth, Gear Teeth, Steady Swing, Final Quarter, Last Turn, Rhythm of Blows',()=>{
  let p=0; plain({foes:3,big:true},P=>{ near3(P,P.F[0]); p=dmgOf(P.F[0],()=>castFW(P,P.F[0])); });
  const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval;
  const L=lab(H,S(['kb_10_3','bw_4_3','sq_7_4','kb_8_4','bw_4_2','sq_12_4','bw_12_1','bw_10_2']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=5e5; near3(L,F[0]); gap(L,F[1],3.9,1,0.6); gap(L,F[2],4.0,-1,0);
  const h=F.map(f=>f.hp); const d=dmgOf(F[0],()=>castFW(L,F[0])); assert.ok(F[1].hp<h[1],'0.1 x 5 + 0.15 x 3 m farther: an enemy whose body is 3.9 m from his centre'); assert.equal(F[2].hp,h[2],'(not 4.0 m)');
  near(d,p*1.15*1.15*1.15,'Flywheel Teeth 3% x 5, Gear Teeth 3% x 5, Steady Swing 5% x 3 more'); near(v.hp,5e5+0.02*2*1e6,'Last Turn: 1% x 2 of his max HP for each enemy it hit (2)',1e-6);
  V.step(1); near(v.atkInterval,ai0/1.09,'Rhythm of Blows: for 4 s after it, 3% x 3 faster'); secs(4); near(v.atkInterval,ai0,'',1e-9);
  near3(L,F[0]); F[0].hp=0.32*F[0].maxHp; near(dmgOf(F[0],()=>castFW(L,F[0])),p*1.15*1.15*1.15,'(32%: no Final Quarter)'); near3(L,F[0]); F[0].hp=0.29*F[0].maxHp; near(dmgOf(F[0],()=>castFW(L,F[0])),p*1.15*1.15*1.15*1.16,'Final Quarter: below 30% HP 8% x 2 more');
});

test('Tick / Twelve Bells: at 12 Hours Flywheel reaches every enemy within 5 m and stuns them 0.8 s - never on one already stunned, nor within 0.5 s after his stun on it ended',()=>{
  const L=lab(H,S(['bw_11_4','bw_1_4']),{foes:4,big:true}), {v,F}=L; for(const f of F){ f.stunned=0; f.level=1; f.ctrlRes=0; } at(L,F[0],2.9,0); gap(L,F[1],4.9,0,1); gap(L,F[2],5.1,0,-1); at(L,F[3],-2.9,0);   // F1 / F2: their bodies 4.9 m / 5.1 m from his centre (v1391: to the body edge)
  kk(L).hours=11; const h=F.map(f=>f.hp); castFW(L,F[0]); assert.ok(F[0].hp<h[0]&&F[1].hp===h[1],'(11 Hours: 3 m)'); near(F[0].stunned,0,'(and no stun)');
  kk(L).hours=12; F[3].stunned=0.3; const g=F.map(f=>f.hp); castFW(L,F[0]); assert.ok(F[1].hp<g[1],'12 Hours: 4.9 m away'); assert.equal(F[2].hp,g[2],'(not 5.1 m)');
  near(F[0].stunned,0.8,'stunned 0.8 s',1e-9); near(F[1].stunned,0.8,'',1e-9); near(F[3].stunned,0.3,'(not one already stunned)',1e-9);
  secs(1.0); assert.ok(!(F[0].stunned>0),''); at(L,F[0],2.9,0); castFW(L,F[0]); assert.ok(!(F[0].stunned>0),'(0.2 s after his stun on it ended: refused)'); secs(0.35); at(L,F[0],2.9,0); castFW(L,F[0]); near(F[0].stunned,0.8,'(0.55 s after: it lands)',1e-9);
  assert.ok(kk(L).ts.onStun>=1&&kk(L).ts.lk>=1,'every refusal counted '+JSON.stringify(kk(L).ts));
});

/* ============================== DAMAGE REDUCTION: ONE GROUP ============================== */
test('Tick / damage reduction, one group of 30%: Riveted Shell, Verdigris Coat (magic), Faithful Frame (15 s into a wave), Count Them (Hours), Slow to Start (first 5 s), Brass Ribs (critical hits), Shock Absorber (Overclock), Weathered Face',()=>{
  const L=lab(H,S(['sq_9_3','bw_12_2']),{foes:2,big:true}); near(hitOn(L),plainHit(L,()=>hitOn(L))*0.95*0.97,'Riveted Shell 1% x 5, Weathered Face 1% x 3 (multiplied)');
  const M=lab(H,S(['sq_5_1']),{foes:2,big:true}); near(hitOn(M,1000,{kind:'magic'}),plainHit(M,()=>hitOn(M,1000,{kind:'magic'}))*0.925,'Verdigris Coat: magic 1.5% x 5 less'); near(hitOn(M),plainHit(M,()=>hitOn(M)),'(not true / physical)');
  const W=lab(H,S(['bw_1_1','bw_5_1']),{foes:2,big:true}); kk(W).wt=4.9; near(hitOn(W),plainHit(W,()=>hitOn(W))*0.91,'Slow to Start: the first 5 s of the wave 3% x 3 less'); kk(W).wt=5.1; near(hitOn(W),plainHit(W,()=>hitOn(W)),'(then not; Faithful Frame not yet)');
  kk(W).wt=14.9; near(hitOn(W),plainHit(W,()=>hitOn(W)),'(14.9 s: not yet)'); kk(W).wt=15.1; near(hitOn(W),plainHit(W,()=>hitOn(W))*0.94,'Faithful Frame: once the wave has lasted 15 s, 1.2% x 5 less'); V.wave(); V.step(1); near(hitOn(W),plainHit(W,()=>hitOn(W))*0.91,'(a new wave: its clock starts again)');
  const C=lab(H,S(['bw_6_3']),{foes:2,big:true}); near(hitOn(C,1000,{crit:true}),plainHit(C,()=>hitOn(C,1000,{crit:true}))*0.85,'Brass Ribs: critical hits 3% x 5 less'); near(hitOn(C),plainHit(C,()=>hitOn(C)),'(not other hits)');
  const O=lab(H,S(['kb_9_2']),{foes:2,big:true}); near(hitOn(O),plainHit(O,()=>hitOn(O)),'(no Overclock)'); castOC(O); near(hitOn(O),plainHit(O,()=>hitOn(O))*0.95,'Shock Absorber: during Overclock 1% x 5 less');
  const X=lab(H,S(['sq_9_3','bw_12_2','sq_5_1','bw_1_1','bw_1_4','bw_6_3','kb_9_2']),{foes:2,big:true}); kk(X).wt=20; kk(X).hours=12; castOC(X);
  near(hitOn(X,1000,{kind:'magic',crit:true}),plainHit(X,()=>hitOn(X,1000,{kind:'magic',crit:true}))*0.70,'all of them at once (0.95 x 0.97 x 0.925 x 0.94 x 0.892 x 0.85 x 0.95 = 0.57): never more than 30% off a hit');
  near(X.T.fn.drK(api(X),X.T,X.v,X.F[0],'magic',true),0.70,'(the pure function the 95% check reads)');
  const D=lab(H,S(['bw_1_4']),{foes:2,big:true}); kk(D).hours=12; near(hitOn(D),plainHit(D,()=>hitOn(D))*(1-0.108),'Count Them: 12 Hours, 10.8%');
});

/* ============================== CONTROLS ON HIM ============================== */
test('Tick / controls on him: Slow Old Movement (4% x 5 shorter, 20% at most), Gone in a Blur (during Overclock slows 15% x 2 weaker, 30% at most), It Does Not Mind (no stun)',()=>{
  const L=lab(H,S(['bw_4_4']),{foes:2,big:true}), {v,F}=L; v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.80,'Slow Old Movement: a stun 20% shorter',1e-9); v.fearT=0; ccOn(F[0],v,'fearT',1); near(v.fearT,V.ccNerf*0.80,'(a fear too)',1e-9); const L3=lab(H,[['bw_4_4',3]],{foes:2,big:true}); L3.v.stunned=0; ccOn(L3.F[0],L3.v,'stunned',1); near(L3.v.stunned,V.ccNerf*0.88,'(3 of 5 ranks: 12%)',1e-9);
  const G=lab(H,S(['kb_12_1']),{foes:2,big:true}), w=G.v; const m=VMX('slowMulFor')(200); w.slow=0; w.slowMul=null; ccOn(G.F[0],w,'slow',2); V.step(1); near(w.slowMul,m,'(no Overclock: as written)',1e-9);
  w.slow=0; w.slowMul=null; castOC(G); ccOn(G.F[0],w,'slow',2); V.step(1); near(w.slowMul,1-(1-m)*0.70,'Gone in a Blur: during Overclock 15% x 2 weaker',1e-9); { const G1=lab(H,[['kb_12_1',1]],{foes:2,big:true}), q=G1.v; q.slow=0; q.slowMul=null; castOC(G1); ccOn(G1.F[0],q,'slow',2); V.step(1); near(q.slowMul,1-(1-m)*0.85,'(1 rank: 15%)',1e-9); } V.step(3); near(w.slowMul,1-(1-m)*0.70,'(once for each new slow)',1e-9);
});

test('Tick / It Does Not Mind (SIGNATURE): he would die - 4 s at 1 HP at least, no stun, 1 Hour a second, Flywheel ready, his hits heal 30%; once per fight',()=>{
  const L=lab(H,S(['bw_13_3','bw_1_4']),{foes:2,big:true}), {v,F}=L; free(L); v.maxHp=1e6; v.hp=100; v.shield=0; hitOn(L,5000);
  near(v.hp,1,'he stays at 1 HP'); near(v.energy,100,'Flywheel ready (full Energy)'); ccOn(F[0],v,'stunned',1); near(v.stunned||0,0,'he cannot be stunned'); hitOn(L,5000); near(v.hp,1,'(still 1 HP)');
  const h0=v.hp, d=myHit(L,F[0]); near(v.hp-h0,0.30*d,'every hit he lands heals him 30% of the damage',1e-6); secs(2.05); assert.equal(kk(L).hours,2,'1 Hour a second');
  v.stunned=0.5; V.step(1); near(v.stunned,0,'(a stun on him ends)'); secs(2); assert.equal(kk(L).hours,4,''); v.hp=100; hitOn(L,5000); assert.ok(!v.alive||v.hp<=0,'once per fight');
});

/* ============================== THE HEALING BUDGET, WAVES ============================== */
test('Tick / the healing budget: Every Quarter, Weights and Chains, Turned by Hand and Spent Spring heal at most 1.2% of his max HP a second (kept 5 s); the bursts are not from it',()=>{
  const L=lab(H,S(['bw_8_3']),{foes:2,big:true}), {v}=L; v.maxHp=1e6; v.hp=5e5; kk(L).bud=0; kk(L).wcT=0;
  secs(2.5); near(v.hp,5e5,'(not before 3 s)'); secs(0.52); near(v.hp-5e5,0.015*1e6,'Weights and Chains: 0.3% x 5 every 3 s (the budget had 3.6% by then)',1e-3);
  const B=lab(H,S(['bw_11_3','bw_1_4']),{foes:2,big:true}), w=B.v; w.maxHp=1e6; w.hp=5e5; kk(B).bud=0; secs(10); near(kk(B).bud,0.06*1e6,'the budget keeps at most 5 s (6%)',1e-6);
  const h=w.hp; for(let i=0;i<10;i++) hitOn(B,1); near(w.hp-h,0.02*1e6-10,'Turned by Hand: 0.4% x 5 at 10 Strokes, from the budget',1e-6); near(kk(B).bud,0.04*1e6,'',1e-6);
  kk(B).bud=0; const h2=w.hp; for(let i=0;i<10;i++) hitOn(B,1); near(w.hp-h2,-10,'with the budget empty, nothing (the hits themselves, an Hour of Count Them less)',1e-2);
});

test('Tick / a wave change: his timers are countdowns (the clock restarts at 0) - Overclock\'s window carries over; the last wave\'s enemies\' Static is dropped',()=>{
  const L=lab(H,S(['kb_2_3','sq_1_2']),{foes:2,big:true}), {v,F}=L; const P0=lab(H,null,{foes:2,big:true}), ai0=P0.v.atkInterval;
  const W=lab(H,S(['kb_2_3','sq_1_2']),{foes:2,big:true}); recL(W,W.F[0],{st:3}); castOC(W); secs(2); VMX('battleTime=40'); V.wave(); VMX('battleTime=0'); V.step(1);
  near(kk(W).oc,3-2*V.STEP,'Overclock\'s window: the 3 s it had left',0.05); near(W.v.atkInterval,ai0/1.15,'(Racing Heart still on)'); assert.ok(!rq(W,W.F[0]),'(the last wave\'s Static records are dropped)');
  assert.ok(!FXN.mech(H).times,'no absolute fight time kept: no times list');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Tick: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H), TEAM=['vael','sylthaine','vireo','vex','tick'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={chN:0,dis:0,wind:0,strain:0,hours:0,strokes:0,spin:0,oc:0,gs:0};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const k=s._tal.s.tk; if(!k) continue; for(const f in mx) mx[f]=Math.max(mx[f],k[f]||0); }
  assert.ok(mx.chN>=1,'real Chimes'); assert.ok(mx.dis>=1,'real discharges'); assert.ok(mx.wind>=1,'real Wind'); assert.ok(mx.strain>=1,'real Strain'); assert.ok(mx.hours>=1,'real Hours'); assert.ok(mx.oc>0,'Overclock windows');
  console.log('  live fight: max '+JSON.stringify(mx)); determinism(H,TEAM);
});

/* No page line was added for his talents. With nothing learned, whole seeded fights with Tick in the line-up (and on the other side) are identical to the
   pre-talent page (ee8edab8), seed by seed, and they cast his three skills. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Tick: no talents - whole fights with him in the line-up are identical to the pre-talent page',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['tick','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __tbN={oc:0,ms:0,fw:0}; var __tbD=_doEffectCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="tick"){ if(type==="haste") __tbN.oc++; if(type==="punchflurry") __tbN.ms++; if(type==="flywheel") __tbN.fw++; } return __tbD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__tbN'); console.log('  identity: '+JSON.stringify(c)); assert.ok(c.oc>0&&c.ms>0&&c.fw>0,'the fights cast Overclock ('+c.oc+'), Mainspring ('+c.ms+') and Flywheel ('+c.fw+')'); }
  finally{ VMX('_doEffectCore=__tbD;'); }
  assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* builds: the talents of `want` first (with their prerequisites), deepest tree first, then the rest of each tree in order; legal 91 points */
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sq:0,kb:1,bw:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }

/* His one talent stun (Twelve Bells, 0.8 s, at 12 Hours) in seeded fights with the most Hour- and Flywheel-heavy legal builds: the longest time one enemy stays
   stunned by him in a row (the in-a-row limit is 4.0 s), and the stun-lock rule (no talent stun on a stunned enemy, none within 0.5 s after his stun ended). */
const STUNW={ bw:['bw_11_4','bw_10_4','bw_1_4','bw_12_3','bw_11_3','bw_6_4','bw_13_3','bw_4_3','bw_4_2'], kb:['kb_10_3','kb_11_3','kb_8_4'], sq:['sq_7_4','sq_9_4'] };
test('Tick: his longest stun chain on one enemy in seeded fights (Twelve Bells), and the stun-lock rule there',()=>{
  const builds=[[['bw'],[91]],[['bw','kb'],[61,30]],[['bw','sq'],[61,30]]].map(([o,c])=>{ const b=deep(o,c,STUNW); assert.equal(T.invalid(H,b,100),'','a legal build'); return {o,list:T.learned(H,b),b}; });
  VMX('var __ts={ticks:0,run:0,runs:[],tw:0}; var __tsU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="tick"&&u._tal&&u._tal.s.tk)) continue; const K=u._tal.s.tk; __ts.ticks++; if(K.hours>=12) __ts.tw++;'+
    '    if(!u.alive) continue; for(const k in K.e){ const r=K.e[k]; if(!r.u.alive) continue; if(r.sn>0&&(r.u.stunned||0)>0){ r.__run=(r.__run||0)+dt; if(r.__run>__ts.run) __ts.run=r.__run; } else if(r.__run){ __ts.runs.push(+r.__run.toFixed(2)); r.__run=0; } } }'+
    '  return __tsU.apply(this,arguments); };');
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')); const out=[];
  try{ for(const B of builds){ VMX('__ts.ticks=0; __ts.run=0; __ts.runs=[]; __ts.tw=0'); const sn=snaps(['tick','vael','vireo','sylthaine','gruel'].map(k=>Object.assign(spec(k,100,k===H?B.list:null),{skillLv:[100,100,100,100]})));
      const ts={n:0,onStun:0,lk:0,cut:0}; const grab=()=>{};
      for(const node of [34,60,90,120]) for(const seed of [11,90210]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
      const foe=snaps(['absalie','astra','vireo','sylthaine','vex'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
      for(const seed of [3,5]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
      const c=JSON.parse(JSON.stringify(VMX('__ts'))); const med=c.runs.length?c.runs.slice().sort((a,b)=>a-b)[Math.floor(c.runs.length/2)]:0;
      out.push(B.o.join('+')+' '+JSON.stringify(T.spent(H,B.b).tree)+': longest run on one enemy '+c.run.toFixed(2)+' s, median '+med+' s, runs '+c.runs.length+', ticks at 12 Hours '+c.tw+' of '+c.ticks);
      console.log('  '+out[out.length-1]); assert.ok(c.ticks>300,'he fought'); assert.ok(c.run<=4.05,'no enemy is stunned by him more than 4.0 s in a row (seen '+c.run.toFixed(2)+' s)'); } }
  finally{ VMX('_updateBattleCore=__tsU;'); }
  console.log('  stun chains: '+out.join(' | '));
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. Tick's talent reductions are one capped group (30%).
   Each candidate build is 91 points legal; the most defensive is the one whose worst hit is reduced most. */
const DEF={ sq:['sq_9_3','sq_5_1','sq_2_3'], kb:['kb_9_2','kb_8_3','kb_5_2'], bw:['bw_1_1','bw_1_4','bw_5_1','bw_6_3','bw_12_2','bw_1_3','bw_2_3','bw_2_2','bw_9_2','bw_10_4','bw_13_3'] };
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,4.5][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); V.step(1); return {v,F,T:v._tal}; }
/* the worst hit on him: every condition of his damage-reduction talents true at once - 20 s into the wave (Faithful Frame) and again in its first 5 s (Slow to
   Start), 12 Hours, Overclock running, 10 Spin (armour, magic resist), a critical magic hit; physical and magic, normal and critical, with his armour and magic
   resist; and again with glyph damage reduction at its 30% cap. Strain is 0 (it only adds damage taken). */
function worstHit(list,kind,crit,glyph,early){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.6*v.maxHp; v.shield=0; v.glyphDR=glyph||0;
  if(L.T){ const k=L.T.s.tk||{}; if(L.T.s.tk){ k.hours=12; k.spin=10; k.oc=9; k.wt=early?1:20; k.strain=0; } V.step(1); if(L.T.s.tk){ L.T.s.tk.oc=9; L.T.s.tk.wt=early?1:20; } }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Tick: his most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and he is at 85% or more for well under half a fight',()=>{
  const cands=[[['sq','kb'],[61,30]],[['sq','bw'],[61,30]],[['kb','sq'],[61,30]],[['kb','bw'],[61,30]],[['bw','sq'],[61,30]],[['bw','kb'],[61,30]],[['sq'],[91]],[['kb'],[91]],[['bw'],[91]]].map(([o,c])=>{ const b=deep(o,c,DEF); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const early of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0,early)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30,early)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="tick"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="tick"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys",false):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic",false):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','tick'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
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
