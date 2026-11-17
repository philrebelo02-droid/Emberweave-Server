'use strict';
/* Rhukk's talents as data on the mechanics layer (talents-mech/rhukk.js), group by group on the still field (tests/talents-lab.js), then whole fights, the
   no-talent identity with him in the line-up, Phil's Dig In cap (50%), Phil's 95% damage-reduction ceiling, the stun chain.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   His skills all reach their targets in real fights (tests/rhukk-kit-facts.js: Impale Rush slammed nobody on 3 of 118 landings), so no place here depends on a
   reach fix. IMPALE RUSH lands on its target (held still, let through the bodies' push-apart while he dashes); the other enemies of a rush test stand within
   4.1 m of the landing spot, centre to centre (the slam's 5 m both before and after release v1391's body-edge measure).
   Places (metres from Rhukk, centre; he stands at x 400 so nobody is clamped at the field's edge): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6); allies A0 (-5.3,0) (behind him:
   1.3 m body to body, past the push-apart of same-team bodies), A1 (-1,-9.5), A2 (-5.3,-6). Distances that a test turns on are measured along y, away from the others. Skill level 10.
   Run: node --test tests/talents-mech-rhukk.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,build,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='rhukk', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const winLeft=(L,name)=>{ const w=L.T.s.w[name]; return w?w.t:0; };
const openWin=(L,name,d)=>{ L.T.s.w[name]=Object.assign(L.T.s.w[name]||{n:1,cdT:0,at:-1,wave:false},{t:d||99,n:1}); };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const rk=L=>L.T.s.rk;
const brnd=x=>VMX('var __rbr=(typeof __rbr!=="undefined"&&__rbr)?__rbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __rbr!=="undefined"&&__rbr){ brnd=__rbr; __rbr=null; }');
/* a unit that thinks but does nothing (no move, no attack, nothing ready), at level 1 so a control is not resisted */
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };
function kl(list,o){ o=o||{}; const L=lab(H,list,Object.assign({allies:1},o,{cold:true})); L.v.x=400; L.v.y=700;
  L.F.forEach((f,i)=>{ const p=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6]][i]; if(p) at(L,f,p[0],p[1]); }); L.A.forEach((a,i)=>{ const p=[[-5.3,0],[-1,-9.5],[-5.3,-6]][i]; if(p) at(L,a,p[0],p[1]); });
  if(o.pre) o.pre(L); V.step(1); return L; }
const hitOn=(L,amt,o)=>{ const v=L.v, r=lost(v,()=>V.hit((o&&o.src)||L.F[0],v,amt||100,Object.assign({kind:'true'},o||{}))); v.energy=0; return r; };
const inRatio=(L,o,amt)=>{ const v=L.v, h=v.hp; const a=hitOn(L,amt||100,o); v.hp=h; const b=plainHit(L,()=>hitOn(L,amt||100,o)); v.hp=h; return a/b; };
const allyRatio=(L,a,o)=>{ const s=(o&&o.src)||L.F[0], h=a.hp; const x=lost(a,()=>V.hit(s,a,1000,Object.assign({kind:'true'},o||{}))); a.hp=h; const y=plainHit(L,()=>lost(a,()=>V.hit(s,a,1000,Object.assign({kind:'true'},o||{})))); a.hp=h; return x/y; };
const swing=(L,t,amt)=>lost(t,()=>V.hit(L.v,t,amt||1000,{kind:'true',auto:true}));
const ratio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
function skillRatio(L,t,skill,o){ const s=L.T.s, keep=s.cur; s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))); } finally{ s.cur=keep; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))); }
const critP=(L,t,o)=>{ const keep=L.T.s.cur; if(o&&o.cur) L.T.s.cur=o.cur; try{ return FX.crit(L.v,t,false,'phys',false); } finally{ L.T.s.cur=keep; } };
const lv=x=>Math.max(0,x-1);
const digBase=()=>{ const b=VMX('KITS.rhukk.blue'); return b.ownDr+b.ownDrPerLv*lv(10); };
const caraBase=()=>{ const g=VMX('KITS.rhukk.green'); return 1-(g.mul-g.perLv*lv(10)); };
/* the rush geometry: F0 the farthest (16 m), F1 and F2 within 4.1 m of it, F3 far from the landing (12 m off to the side) */
function rushLab(list,o){ o=o||{}; const L=kl(list,Object.assign({foes:4,big:true},o,{pre:L=>{ const F=L.F; at(L,F[0],16,0); at(L,F[1],14,3.5); at(L,F[2],12.5,-1); at(L,F[3],0,12); for(const f of F) free(f); if(o.pre) o.pre(L); L.pos=L.F.map(f=>[f.x,f.y]); for(const f of F) f._pullGhost=true; }}));
  L.F.forEach((f,i)=>{ f.x=L.pos[i][0]; f.y=L.pos[i][1]; }); return L; }
/* Impale Rush for real: he is let go (doing nothing else), casts it, and the dash runs to its landing (the enemies let through the bodies' push-apart while he dashes) */
function rush(L,o){ o=o||{}; const v=L.v; free(v); v.level=100; if(L.pos&&!o.keep) L.F.forEach((f,i)=>{ if(f.alive){ f.x=L.pos[i][0]; f.y=L.pos[i][1]; } }); V.cast(v,'ult'); const D=v._dash; assert.ok(D,'a dash'); if(o.during) o.during(L,D);
  for(let i=0;i<70&&v._dash;i++){ for(const f of L.F) f._pullGhost=true; V.step(1); } assert.ok(!v._dash,'the dash landed'); return D; }
const dig=L=>{ V.cast(L.v,'blue'); };
const cara=L=>{ V.cast(L.v,'green'); };

test('Rhukk: every talent is accounted for - 10 plain stats, 104 with rows, none waiting',()=>{
  accounting(H,[114,10,104,0,0]);
  for(const id of ['st_1_4','st_6_2','st_2_3','ot_1_2','ot_5_4','ot_2_2','eb_3_3','eb_6_2','eb_10_2','eb_1_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.ok(!FXN.has(H,'st_7_3'),'Long Horn is a row (the 5% crit group), no longer a plain stat');
  const st=FXN.totals(H,S(['st_6_2','eb_6_2'])); near(st.critDmg,0.20,'Gore and Heavy Horn: 10% each, at most');
});

test('Rhukk: his real kit, as the talents read it - Carapace and Dig In share one slot, Dig In taunts every enemy 3 s, Thick Chitin stops at 5 stacks (15%), Impale Rush to the farthest with a 1.4 s stun',()=>{
  const L=kl(null,{foes:3}), {v,F}=L; cara(L); near(1-v.drMul,caraBase(),'Carapace in the slot'); near(v.drT,5,'5 s');
  dig(L); near(1-v.drMul,digBase(),'Dig In replaces it (the last cast wins)'); for(const f of F){ assert.equal(f.forcedTarget,v,'every enemy taunted'); near(f.forcedTargetT,3,'3 s'); }
  v.wardenStk=0; v.wardenT=0; secs(18.1); assert.equal(v.wardenStk,5,'5 stacks at most'); near(VMX('wardenCut')(v),0.15,'15%');
  const R=rushLab(null); const D=rush(R); console.log('  rush: landing '+[(D.x1-R.v.x)/V.METER,(D.y1-R.v.y)/V.METER].map(x=>x.toFixed(2))+' foes '+R.F.map(f=>[((f.x-D.x1)/V.METER).toFixed(2),((f.y-D.y1)/V.METER).toFixed(2),f.stunned.toFixed(2),(1e9-f.hp).toFixed(0)].join('/')).join(' ')); near(D.x1,R.F[0].x,'to the farthest',2); for(const f of [R.F[0],R.F[1],R.F[2]]) near(f.stunned,1.4,'stunned 1.4 s',0.03); assert.equal(R.F[3].stunned,0,'F3 is outside the slam');
});

test('Rhukk / Dig In capped at 50% (Phil): Roar Louder and Dig Deeper multiply its own reduction, and it never passes 50% whatever they add',()=>{
  const L=kl(S(['ot_2_3','ot_4_3','eb_4_3'])), {v}=L; dig(L); near(1-v.drMul,digBase()*1.09*1.12,'20% x 1.09 x 1.12 at skill level 10: under the cap');
  const B=VMX('KITS.rhukk.blue'), keep=[B.ownDr,B.ownDrPerLv];
  try{ B.ownDr=0.45; B.ownDrPerLv=0; const L2=kl(S(['ot_4_3','eb_4_3'])); dig(L2); near(1-L2.v.drMul,0.50,'45% x 1.2208 = 54.9% asked: 50% given');
    B.ownDr=0.49; const L3=kl(S(['ot_4_3'])); dig(L3); near(1-L3.v.drMul,0.50,'49% x 1.09: 50%');
    B.ownDr=0.60; const L4=kl(S(['st_4_3'])); dig(L4); near(1-L4.v.drMul,0.50,'any learned talent: Dig In\'s own 60% would also stop at 50%');
    B.ownDr=0.40; const L5=kl(S(['ot_4_3','eb_4_3'])); dig(L5); near(1-L5.v.drMul,0.40*1.09*1.12,'48.8%: not cut');
    const L6=kl(null); dig(L6); near(1-L6.v.drMul,0.40,'no talents: the game\'s own number, untouched'); }
  finally{ B.ownDr=keep[0]; B.ownDrPerLv=keep[1]; }
  const L7=kl(S(['ot_4_3','eb_4_3'])); cara(L7); near(1-L7.v.drMul,caraBase(),'Carapace is not Dig In: not changed');
});

test('Rhukk / Headlong: Lowered Horn (1 a basic attack on the same enemy, max 5; at 5 the next deals 30% more, shoves 1.5 m and empties), One Idea, Last Push, Rolling Weight, Straight Through It',()=>{
  const L0=kl(null), iv=L0.v.atkInterval;
  const L=kl(S(['st_1_1','st_2_1','st_10_3','st_3_1']),{big:true,foes:3}), {v,F}=L; v.maxHp=1e6; v.hp=5e5;
  for(let i=0;i<3;i++) swing(L,F[0]); assert.equal(stack(L,'rkHl'),3); V.step(1); near(v.atkInterval,iv/1.09,'One Idea: 3% x 3 Headlong');
  swing(L,F[1]); assert.equal(stack(L,'rkHl'),1,'another enemy: starts again at 1');
  for(let i=0;i<4;i++) swing(L,F[1]); assert.equal(stack(L,'rkHl'),5,'max 5');
  at(L,F[2],14.2,0); const b=plainHit(L,()=>swing(L,F[1])); const h0=v.hp; const a=swing(L,F[1]); near(a/b,1.30,'at 5: 30% more'); assert.equal(stack(L,'rkHl'),0,'empties');
  assert.ok((F[1].pullT||0)>0,'shoved'); near(Math.hypot(F[1].pulledBy.x-F[1].x,F[1].pulledBy.y-F[1].y)/V.METER,1.5,'1.5 m',1e-3); near((v.hp-h0)/1e6,0.03,'Rolling Weight 1% x 3',1e-3);
  assert.ok(F[2].hp<1e9,'Straight Through It: the enemy behind takes the hit'); assert.ok((F[2].pullT||0)>0,'and is shoved'); near(1e9-F[2].hp,a,'the same damage',0.02);
  const L2=kl(S(['st_1_1','st_12_4']),{foes:3}); setStack(L2,'rkHl',5); rk(L2).lastT=L2.F[0]; at(L2,L2.F[2],30,30); swing(L2,L2.F[0]); near(Math.hypot(L2.F[0].pulledBy.x-L2.F[0].x,L2.F[0].pulledBy.y-L2.F[0].y)/V.METER,2.5,'Last Push: 2.5 m',1e-3);
  const L3=kl(S(['st_1_1','st_10_3']),{big:true}); setStack(L3,'rkHl',4); rk(L3).lastT=L3.F[0]; L3.v.maxHp=1e6; L3.v.hp=5e5; const h3=L3.v.hp; swing(L3,L3.F[0]); assert.equal(stack(L3,'rkHl'),5); assert.ok(!((L3.F[0].pullT||0)>0)&&L3.v.hp===h3,'reaching 5 is not the shove');
  const L5=kl(S(['st_1_1','st_3_1']),{foes:3}); setStack(L5,'rkHl',5); rk(L5).lastT=L5.F[0]; at(L5,L5.F[1],4.5+4.02+3.2,0); at(L5,L5.F[2],-3,-12); swing(L5,L5.F[0]); assert.equal(L5.F[1].hp,1e9,'Straight Through It: 3.2 m beyond is too far');
  const L4=kl(S(['st_1_1'])); setStack(L4,'rkHl',5); rk(L4).lastT=L4.F[0]; at(L4,L4.F[1],7.9,0); swing(L4,L4.F[0]); assert.equal(L4.F[1].hp,1e9,'without Straight Through It nobody behind is hit');
});

test('Rhukk / Old Habit (3 Headlong at each wave), Through the Line (2 on a Trampled enemy), Beetle Hide (5% less at 3+ Headlong, in the group)',()=>{
  const L=kl(S(['st_12_1','st_9_2','st_9_3','st_1_2','st_2_2','st_8_2','st_13_2','st_12_2','st_11_2'])), {v,F}=L; assert.equal(stack(L,'rkHl'),3,'the wave starts with 3');
  near(inRatio(L),0.95,'Beetle Hide at 3'); setStack(L,'rkHl',2); near(inRatio(L),1,'not at 2');
  setStack(L,'rkHl',0); rk(L).lastT=null; setMk(L,F[0],'rkTr'); swing(L,F[0]); assert.equal(stack(L,'rkHl'),2,'Trampled: 2'); swing(L,F[0]); assert.equal(stack(L,'rkHl'),4);
  swing(L,F[1]); assert.equal(stack(L,'rkHl'),1,'not Trampled: 1'); setStack(L,'rkHl',4); rk(L).lastT=F[0]; swing(L,F[0]); assert.equal(stack(L,'rkHl'),5,'4 + 2: never past 5');
  setStack(L,'rkHl',1); V.wave(); V.step(1); assert.equal(stack(L,'rkHl'),3,'again at the next wave');
});

test('Rhukk / Impale Rush: Trampled (Hoof and Horn 10% armour, Ground Down 6.8 s, Trodden, Trample Ground, Walls Became Rubble), Bowled Over, Momentum Hide, Hard Charge, Scattered, Farthest First, Horn Rush',()=>{
  const P0=rushLab(null), arm=P0.F[1].armorRating, ai=P0.F[1].atkInterval;
  rush(P0); const st0=P0.F[1].stunned;
  const L=rushLab(S(['st_1_2','st_2_2','st_6_4','st_8_3','st_8_2','st_11_2','st_10_1','st_7_4','st_12_2'])), {v,F}=L; const d0=v.dmg; rush(L);
  for(const f of [F[0],F[1],F[2]]){ assert.ok(mark(L,f,'rkTr'),'Trampled'); near(f.stunned-st0,0.3+0.5,'Hard Charge 0.3 + Scattered 0.5 on the plain rush stun',1e-3); } assert.ok(!mark(L,F[3],'rkTr'),'F3 not');
  near(F[0]._talM[v.uid].rkTr.until-V.now(),6.8,'5 s + 0.6 x 3',0.008);
  V.step(1); near(F[1].armorRating,arm*0.90,'2% x 5 armour'); near(F[1].atkInterval,ai/0.91,'Trample Ground 3% x 3');
  near(ratio(L,F[1]),1.10,'Walls Became Rubble'); near(ratio(L,F[3]),1,'not on F3');
  near(v.dmg,d0*1.15,'Bowled Over: 3 stunned x 5%'); assert.ok(win(L,'rkMh')); near(winLeft(L,'rkMh'),3,'3 s',0.05); near(inRatio(L),0.90,'Momentum Hide 10%');
  secs(6.1); near(v.dmg,d0,'Bowled Over lapses after 6 s'); assert.ok(mark(L,F[1],'rkTr'),'Trampled still at 6.1 s'); secs(0.8); assert.ok(!mark(L,F[1],'rkTr'),'Trampled over'); V.step(1); near(F[1].armorRating,arm,'armour back');
  const S0=kl(null), sp=S0.F[0].speed; const TD=kl(S(['st_6_4'])); setMk(TD,TD.F[0],'rkTr'); V.step(1); near(TD.F[0].speed,sp*0.90,'Trodden 5% x 2'); near(TD.F[1].speed,sp,'not on F1');
  const L2=rushLab(S(['st_12_2']),{pre:L=>at(L,L.F[2],-3,-12)}); rush(L2); near(L2.F[0].stunned,1.4,'Scattered: only 2 stunned, no more',0.03);
  const L3=rushLab(S(['st_4_2','eb_8_3'])); near(skillRatio(L3,L3.F[3],'charge'),1.15*1.15,'Farthest First and Horn Rush'); near(skillRatio(L3,L3.F[3],'chargePath'),1.15*1.15,'its path hits too'); near(ratio(L3,L3.F[3]),1,'not a basic attack');
});

test('Rhukk / Shorter Fuse (the nearest, 0.5 s longer) and Close Quarters (9% less for 3 s after); Longer Run (2% a metre, up to 40%)',()=>{
  const L=rushLab(S(['st_5_3','st_6_3']),{pre:L=>at(L,L.F[3],7,0)}), {v,F}=L; const D=rush(L); near(D.x1,F[3].x,'to the nearest',2); near(F[3].stunned,1.9,'1.4 + 0.5',0.03);
  assert.ok(win(L,'rkCq')); near(inRatio(L),0.91,'Close Quarters'); secs(3.1); near(inRatio(L),1,'over after 3 s');
  const P=rushLab(null); rush(P); const base=1e9-P.F[0].hp;
  const L2=rushLab(S(['st_5_2'])); rush(L2); near((1e9-L2.F[0].hp)/base,1.32,'16 m: +32%',0.01);
  const far=L=>{ L.v.y=420; at(L,L.F[0],0,21); at(L,L.F[1],14,3.5); at(L,L.F[2],12.5,-1); at(L,L.F[3],-10,0); };
  const P3=rushLab(null,{pre:far}); rush(P3); const b3=1e9-P3.F[0].hp; const L3=rushLab(S(['st_5_2']),{pre:far}); rush(L3); near((1e9-L3.F[0].hp)/b3,1.40,'21 m: 40% at most',0.01);
});

test('Rhukk / Rubble (the game\'s own path hits: 50% of the slam, knocked aside), Never Stops (a stun no longer pauses the dash)',()=>{
  const P=rushLab(null,{pre:L=>at(L,L.F[3],7,0)}); rush(P); assert.equal(P.F[3].hp,1e9,'untalented the path is not hit'); const slam=1e9-P.F[0].hp;
  const L=rushLab(S(['st_7_1']),{pre:L=>at(L,L.F[3],7,0)}), y0=L.F[3].y; rush(L); near((1e9-L.F[3].hp)/slam,0.5,'50% of the slam',0.02); assert.ok(Math.abs(L.F[3].y-y0)>1*V.METER,'knocked aside');
  const N=rushLab(S(['st_11_1'])), t0=V.now(); rush(N,{during:(L)=>{ L.v.stunned=3; }}); assert.ok(V.now()-t0<1.0,'landed while stunned'); assert.ok(N.v.stunned>1,'still stunned');
  const M=rushLab(S(['st_1_2'])); const v=M.v; free(v); v.level=100; V.cast(v,'ult'); v.stunned=3; for(let i=0;i<40;i++){ for(const f of M.F) f._pullGhost=true; V.step(1); } assert.ok(!!v._dash,'without it the dash waits');
});

test('Rhukk / The Fastest Way (SIGNATURE): the slam strikes 3+ - a second Impale Rush at 60% to the farthest other enemy, all Trampled, full Headlong; the stun-lock rule; once every 25 s',()=>{
  const P0=rushLab(null); rush(P0); const st0=P0.F[1].stunned;
  const L=rushLab(S(['st_13_2','st_11_2','st_12_2'])), {v,F}=L; rush(L); const first=1e9-F[1].hp;
  for(let i=0;i<70&&(rk(L).fw2||v._dash||!(F[3].hp<1e9));i++){ for(const f of F) f._pullGhost=true; V.step(1); }
  assert.ok(F[3].hp<1e9,'the second struck F3'); near((1e9-F[3].hp)/first,0.6,'at 60%',0.02); assert.equal(stack(L,'rkHl'),5,'full Headlong');
  for(const f of F) assert.ok(mark(L,f,'rkTr'),'every enemy either one stunned is Trampled'); near(F[3].stunned,1.4+0.5*0,'F3 stunned by the second',0.1);
  assert.equal(v.energy<100,true); assert.ok(rk(L).fwL>24,'locked 25 s');
  const L2=rushLab(S(['st_13_2']),{foes:5,pre:L=>{ at(L,L.F[3],-4,0); at(L,L.F[4],-2,3.8); free(L.F[4]); L.F[4].stunned=2.0; }}); rush(L2);   /* the second lands in the same rush() (the tick after the first landing): F4 is still stunned from before */
  for(let i=0;i<70&&(rk(L2).fw2||L2.v._dash||!(L2.F[3].hp<1e9));i++){ for(const f of L2.F) f._pullGhost=true; V.step(1); }
  assert.ok(L2.F[3].hp<1e9,'the second landed on F3'); assert.ok(L2.F[4].hp<1e9,'and struck F4 beside it'); near(L2.F[3].stunned,st0,'F3 stunned by it',0.02); assert.ok(L2.F[4].stunned<1.0,'F4 was already stunned: the second stun does not land ('+L2.F[4].stunned+')');
  const L3=rushLab(S(['st_13_2']),{pre:L=>at(L,L.F[2],-3,-12)}); rush(L3); for(let i=0;i<40;i++) V.step(1); assert.equal(L3.F[3].hp,1e9,'2 struck: no second'); assert.equal(L3.F[2].hp,1e9,'(nor on F2)');
  const L4=rushLab(S(['st_13_2'])); rush(L4); for(let i=0;i<70;i++){ for(const f of L4.F) f._pullGhost=true; V.step(1); } rk(L4).fwL=5; const h4=L4.F[3].hp; for(const f of L4.F){ f.stunned=0; f._talM={}; } rush(L4); for(let i=0;i<40;i++) V.step(1);
  assert.equal(L4.F[3].hp,h4,'not again inside 25 s');
});

test('Rhukk / Sheltered: The Young Behind (allies within 3 m behind him, 6% less), Fill the Tunnel (+1.5 m), Little Ones Watch, Sheltering Bulk, Thick Lip, Shell Over Them',()=>{
  const L=kl(S(['ot_1_1','ot_3_1','ot_6_1','ot_5_1','ot_7_1','ot_9_1']),{allies:3}), {v,A,F}=L; at(L,A[1],-1,-8.3); at(L,A[2],2,-3.5); V.step(1);
  near(allyRatio(L,A[0]),0.94,'A0 Sheltered'); near(allyRatio(L,A[1]),0.94,'A1 at 4.4 m: inside 4.5 m'); near(allyRatio(L,A[2]),1,'A2 in front of him: not Sheltered');
  at(L,A[1],-1,-8.6); V.step(1); near(allyRatio(L,A[1]),1,'4.6 m: not');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))/plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))),1.04,'Little Ones Watch');
  A[0].maxHp=1e6; A[0].hp=5e5; const h=A[0].hp; V.heal(A[0],1000); const g=A[0].hp-h; A[0].hp=h; plainHit(L,()=>V.heal(A[0],1000)); near(g/(A[0].hp-h),1.10,'Sheltering Bulk 2% x 5'); A[0].hp=h; A[2].maxHp=1e6; A[2].hp=5e5; const h2=A[2].hp; V.heal(A[2],1000); const g2=A[2].hp-h2; A[2].hp=h2; plainHit(L,()=>V.heal(A[2],1000)); near(g2/(A[2].hp-h2),1,'not on A2'); A[2].hp=h2;
  A[0].shield=0; A[2].shield=0; cara(L); near(A[0].shield,0.06*A[0].maxHp,'Thick Lip: 2% x 3 of its max HP'); assert.equal(A[2].shield||0,0,'not on A2');
  near(allyRatio(L,A[0]),0.5,'Shell Over Them: half (with Sheltered 6%: the ally cap 50%)'); near(allyRatio(L,A[2]),1,'not on A2'); secs(5.1); near(allyRatio(L,A[0]),0.94,'Carapace over');
});

test('Rhukk / Anchor: Plant the Legs (1 a second still, 1.5% x Anchor), Dug Deep (9), Bedded In, Weight of Water, Did Not Move, Like the Roots, Tough Night, Stone Still',()=>{
  const L0=kl(null), d0=L0.v.dmg;
  const L=kl(S(['ot_1_4','ot_2_4','ot_6_4','ot_10_4','ot_3_4','ot_7_4','ot_8_4','ot_9_4']),{big:true}), {v,F}=L; secs(3.05); assert.equal(stack(L,'rkAn'),3,'1 a second');
  secs(8); assert.equal(stack(L,'rkAn'),9,'Dug Deep: 9'); near(inRatio(L),1-0.015*9,'1.5% x 9'); near(inRatio(L,{crit:true}),(1-0.015*9)*0.8,'Stone Still at full Anchor: crits 20% less');
  V.step(1); near(v.dmg,d0*(1+0.009*9),'Bedded In 0.9% x 9'); near(swing(L,F[0])/plainHit(L,()=>swing(L,F[0])),1+0.025*9,'Weight of Water 2.5% x 9');
  assert.ok((v._gearImmovableT||0)>0,'Like the Roots: cannot be moved'); v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*0.75,'25% weaker');
  v.maxHp=1e6; v.hp=5e5; const h=v.hp; secs(3.05); assert.ok(v.hp-h>=0.015e6-1&&v.hp-h<0.03e6,'Tough Night 1.5% every 3 s');
  const walk=()=>{ v.stunned=0; v.atkCd=1e9; v.greenCd=99; v.blueCd=99; v.energy=0; at(L,F[0],12,3); at(L,F[1],14,-3); const x0=v.x; V.step(2); v.stunned=1e6; assert.ok(Math.abs(v.x-x0)>0.1,'he walked'); };
  walk(); assert.equal(stack(L,'rkAn'),0,'moving empties it'); near(inRatio(L),1); near(inRatio(L,{crit:true}),1,'no Stone Still'); V.step(2); assert.ok(!((v._gearImmovableT||0)>0.05),'no Anchor: movable');
  dig(L); assert.equal(stack(L,'rkAn'),9,'Did Not Move: Dig In fills it'); walk(); assert.equal(stack(L,'rkAn'),9,'and it holds while the taunt lasts'); secs(3.1); walk(); assert.equal(stack(L,'rkAn'),0,'then moving empties it');
  const L2=kl(S(['ot_1_4'])); secs(10); assert.equal(stack(L2,'rkAn'),6,'max 6 without Dug Deep');
});

test('Rhukk / Dig In\'s talents: Long Roar (3.5 s), Carved by the Roar (1% a taunted enemy), Come for Me (1.5% each), Taunting Horn (7.5% less from the taunted), Gore Back, Echo Roar and Charge Again',()=>{
  const L=kl(S(['ot_2_3','ot_n1','ot_5_3','ot_9_2','ot_10_3']),{big:true,foes:3}), {v,F}=L; v.maxHp=1e6; v.hp=5e5; v.shield=0; const h=v.hp; dig(L);
  for(const f of F) near(f.forcedTargetT,3.5,'3 s + 0.5'); near(v.shield,0.03e6,'3 enemies: 3%'); near(v.shieldT,3,'for 3 s',0.01); near(v.hp-h,0.045e6,'Come for Me 1.5% x 3',1e-3);
  near(inRatio(L,{src:F[0]}),0.925,'Taunting Horn'); F[1].forcedTargetT=0; near(inRatio(L,{src:F[1]}),1,'not once its taunt is over');
  brnd(0.049); assert.equal(critP(L,F[0]),true,'Gore Back 5% on a taunted enemy'); brnd(0.051); assert.equal(critP(L,F[0]),false,'5% at most'); brnd(0); assert.equal(critP(L,F[1]),false,'not on F1');
  const C=kl(S(['st_10_2','ot_6_3'])); near(FX.cd(C.v,'blue',10),10-1.2-1.0,'Dig In 2.2 s shorter'); near(FX.cd(C.v,'green',10),10,'not Carapace');
  const E=kl(S(['eb_4_2'])); near(FX.cd(E.v,'green',10),9.1,'Plates Lock: Carapace 0.9 s shorter');
  const N=kl(S(['ot_n1','eb_1_1']),{foes:2}); dig(N); assert.equal(stack(N,'rkCv'),1,'with First Lesson: 2 taunted carve 1'); const N2=kl(S(['ot_n1','eb_1_1']),{foes:1}); dig(N2); assert.equal(stack(N2,'rkCv'),0,'1 taunted: no Carving');
});

test('Rhukk / Not Them (PICK ONE: an ally below 30% - Dig In at once, once every 20 s) and Always Listening (14 s)',()=>{
  const L=kl(S(['ot_5_2','ot_6_2']),{allies:2}), {v,A,F}=L; A[0].maxHp=1e6; A[0].hp=0.5e6; free(v); v.atkCd=1e9; V.step(1);
  const cast=()=>F[0].forcedTarget===v&&F[0].forcedTargetT>2.5, clr=()=>{ for(const f of F){ f.forcedTargetT=0; f.forcedTarget=null; } };
  A[0].hp=0.32e6; V.step(2); assert.ok(!cast(),'32%: not yet'); A[0].hp=0.29e6; V.step(2); assert.ok(cast(),'Dig In cast: every enemy taunted');
  clr(); A[0].hp=0.5e6; V.step(1); A[0].hp=0.29e6; V.step(2); assert.ok(!cast(),'locked'); clr();
  secs(Math.max(0,13.5-0)); A[0].hp=0.5e6; V.step(1); A[0].hp=0.29e6; V.step(2); assert.ok(!cast(),'not at 13.6 s'); clr();
  secs(0.6); A[0].hp=0.5e6; V.step(1); A[0].hp=0.29e6; V.step(2); assert.ok(cast(),'at 14.1 s again');
  const L2=kl(S(['ot_5_2']),{allies:1}); free(L2.v); L2.v.hp=0.5*L2.v.maxHp; V.step(1); L2.v.hp=0.29*L2.v.maxHp; V.step(2); assert.ok(!(L2.F[0].forcedTargetT>0),'Rhukk himself is not "an ally"');
});

test('Rhukk / Forgot the Young (a taunted enemy that hits a Sheltered ally within 3 s of its taunt ending: taunted 1 s, once) and Let It Come (5% shield)',()=>{
  const L=kl(S(['ot_11_3','ot_12_3']),{big:true}), {v,A,F}=L; v.shield=0; dig(L); for(const f of F){ f.forcedTargetT=0; f.forcedTarget=null; }
  V.hit(F[1],A[0],100,{kind:'true'}); assert.equal(F[1].forcedTarget,v,'taunted again'); near(F[1].forcedTargetT,1,'1 s',0.01); near(v.shield,0.05*v.maxHp,'Let It Come 1% x 5');
  F[1].forcedTargetT=0; F[1].forcedTarget=null; V.hit(F[1],A[0],100,{kind:'true'}); assert.ok(!(F[1].forcedTargetT>0),'once per enemy per Dig In');
  secs(6.1); V.hit(F[0],A[0],100,{kind:'true'}); assert.ok(!(F[0].forcedTargetT>0),'not more than 3 s after the taunt would have ended (3 s + 3 s)');
  const L2=kl(S(['ot_11_3']),{allies:3}); at(L2,L2.A[2],2,-3.5); V.step(1); dig(L2); for(const f of L2.F){ f.forcedTargetT=0; f.forcedTarget=null; } V.hit(L2.F[0],L2.A[2],100,{kind:'true'}); assert.ok(!(L2.F[0].forcedTargetT>0),'not for an ally that is not Sheltered');
});

test('Rhukk / One Tunnel (SIGNATURE): a hit would take a Sheltered ally below 25% - Dig In at once, taunt 2 s longer (4 s at most), full Anchor, 5 s of hits on the Sheltered landing on him at half; once every 30 s',()=>{
  const L=kl(S(['ot_13_3','ot_1_4','ot_2_3']),{big:true}), {v,A,F}=L; free(v); v.atkCd=1e9; A[0].maxHp=1e6; A[0].hp=0.3e6; A[0].shield=0; v.shield=0;
  const hv=v.hp, ha=A[0].hp; V.hit(F[0],A[0],1e5,{kind:'true'}); assert.equal(A[0].hp,ha,'the ally loses nothing'); const got=hv-v.hp; assert.ok(got>0&&got<=0.5e5+1,'he takes it, at half (his own reductions on top): '+got);
  assert.ok(win(L,'rkOt')); near(winLeft(L,'rkOt'),5,'5 s',0.02); V.step(2); for(const f of F){ assert.equal(f.forcedTarget,v,'Dig In cast'); near(f.forcedTargetT,4.0,'3 + 0.5 + 2 = 5.5 asked: 4 s at most',0.1); } assert.equal(stack(L,'rkAn'),6,'full Anchor');
  const h2=A[0].hp; V.hit(F[1],A[0],1000,{kind:'true'}); assert.equal(A[0].hp,h2,'still moved'); secs(5.1); V.hit(F[1],A[0],1000,{kind:'true'}); assert.ok(A[0].hp<h2,'after 5 s it lands again');
  A[0].hp=0.3e6; const h3=A[0].hp; V.hit(F[0],A[0],1e5,{kind:'true'}); assert.ok(A[0].hp<h3,'locked 30 s');
  const L2=kl(S(['ot_13_3']),{big:true}); L2.A[0].maxHp=1e6; L2.A[0].hp=0.4e6; const h4=L2.A[0].hp; V.hit(L2.F[0],L2.A[0],1.3e5,{kind:'true'}); assert.ok(L2.A[0].hp<h4&&!win(L2,'rkOt'),'40% to 27%: not below 25%');
});

test('Rhukk / By Morning (a wave that ends with no Sheltered ally lost: 10%) and Nobody Lost (every ally 2%)',()=>{
  const L=kl(S(['ot_10_1','ot_12_1']),{big:true,allies:2}), {v,A}=L; v.maxHp=1e6; v.hp=5e5; for(const a of A){ a.maxHp=1e6; a.hp=5e5; }
  V.wave(); near(v.hp,5e5+0.10e6,'10%',1e-3); for(const a of A) near(a.hp,5e5+0.02e6,'2%',1e-3); V.step(1);
  v.hp=5e5; A[0].hp=1; A[0].shield=0; V.hit(L.F[0],A[0],100,{kind:'true'}); assert.ok(!A[0].alive,'a Sheltered ally fell'); V.wave(); near(v.hp,5e5,'no heal'); V.step(1);
  v.hp=5e5; V.wave(); near(v.hp,5e5+0.10e6,'the next wave again',1e-3);
});

test('Rhukk / Carvings: First Lesson (6% of his max HP carves 1, max 6; 2% armour and MR each), Hard Lesson (3%), Carve It (10), Near-Drowning, Scored Plates, Old Scars Hold, Every Hard Thing, Cut Deep',()=>{
  const L0=kl(null), arm=L0.v.armorRating, mr=L0.v.mrRating, d0=L0.v.dmg;
  const L=kl(S(['eb_1_1','eb_6_1','eb_5_4','eb_9_1','eb_10_1']),{big:true}), {v}=L; v.maxHp=1e6; v.hp=8e5; v.shield=0;
  hitOn(L,0.059e6); assert.equal(stack(L,'rkCv'),0,'5.9%: no'); v.hp=8e5; hitOn(L,0.061e6); assert.equal(stack(L,'rkCv'),1,'6.1%: 1'); near(v.hp,8e5-0.061e6+0.05e6,'Every Hard Thing 1% x 5',1e-3);
  for(let i=0;i<8;i++){ v.hp=8e5; hitOn(L,0.07e6); } assert.equal(stack(L,'rkCv'),6,'max 6'); V.step(1);
  near(v.armorRating,arm*(1+0.02*6),'2% armour a Carving'); near(v.mrRating,mr*(1+0.02*6),'and MR'); near(v.dmg,d0*(1+0.015*6),'Scored Plates'); near(v.lifestealStat||0,0.06,'Old Scars Hold 1% x 6');
  const L2=kl(S(['eb_1_1','eb_2_1','eb_2_2','eb_3_1','eb_4_2','eb_5_2']),{big:true}), w=L2.v; w.maxHp=1e6; w.hp=8e5; hitOn(L2,0.031e6); assert.equal(stack(L2,'rkCv'),1,'Hard Lesson: 3%'); w.hp=8e5; hitOn(L2,0.029e6); assert.equal(stack(L2,'rkCv'),1,'not 2.9%');
  for(let i=0;i<12;i++){ w.hp=8e5; hitOn(L2,0.05e6); } assert.equal(stack(L2,'rkCv'),10,'Carve It: 10');
  const L3=kl(S(['eb_1_1','eb_2_1','eb_2_2','eb_3_1'])); cara(L3); assert.equal(stack(L3,'rkCv'),1,'Cut Deep: Carapace carves 1');
  const L4=kl(S(['eb_6_1']),{big:true}); L4.v.maxHp=1e6; L4.v.hp=8e5; const m4=L4.v.maxHp; hitOn(L4,0.07e6); V.step(1); near(L4.v.maxHp,m4*1.009,'Near-Drowning 0.9% max HP (Carvings run for any Carving talent)');
});

test('Rhukk / Keep It Smooth (PICK ONE: no Carvings, 8% less, Thick Chitin twice as fast), Never Needed One, Wall of Shell + Chitin Thickens, Wide Shell, Chitin Grows',()=>{
  const L=kl(S(['eb_5_3','eb_6_3','eb_1_1']),{big:true}), {v,F}=L; v.maxHp=1e6; v.hp=8e5; hitOn(L,0.1e6); assert.equal(stack(L,'rkCv'),0,'never carves'); near(inRatio(L),0.92,'8% less'); near(ratio(L,F[0]),1.09,'Never Needed One 3% x 3');
  v.wardenStk=0; v.wardenT=0; secs(3.05); assert.equal(v.wardenStk,2,'1.5 s a stack'); secs(4.5); assert.equal(v.wardenStk,5);
  const W=kl(S(['st_3_4','eb_8_2'])); W.v.wardenStk=0; W.v.wardenT=0; secs(3.05); assert.equal(W.v.wardenStk,3,'Wall of Shell + Chitin Thickens: 1 s a stack');
  const W1=kl(S(['st_3_4'])); W1.v.wardenStk=0; W1.v.wardenT=0; secs(4.05); assert.equal(W1.v.wardenStk,2,'Wall of Shell alone: 2 s a stack');
  const B0=kl(null), m0=B0.v.maxHp; const G=kl(S(['ot_12_2','ot_8_3'])), g=G.v; g.wardenStk=5; V.step(2); near(g.maxHp,m0*1.045,'Wide Shell 0.9% x 5 stacks'); near(inRatio(G),0.90,'Chitin Grows at 5 stacks'); g.wardenStk=4; V.step(1); near(inRatio(G),1,'not at 4');
  const KC=kl(S(['eb_5_3','eb_3_1','eb_1_1'])); cara(KC); assert.equal(stack(KC,'rkCv'),0,'Cut Deep carves nothing on a smooth shell');
});

test('Rhukk / Lesson: Read the Back (allies within 4 m, 0.9% armour a Carving), The Young Read, Readable, Teach Them (double while Dig In taunts), Lines in the Chitin, Wide Reading, Read Aloud, Thick Loam',()=>{
  const L0=kl(null,{allies:2}), arm=L0.A[0].armorRating, mr=L0.A[0].mrRating;
  const L=kl(S(['eb_1_4','eb_3_4','eb_7_4','eb_9_4','eb_6_4','eb_10_4','eb_12_4','eb_5_1']),{allies:2,big:true}), {v,A,F}=L; at(L,A[1],-1,-9.45); setStack(L,'rkCv',4); V.step(2);
  near(A[0].armorRating,arm*(1+0.009*4),'0.9% x 4'); near(A[0].mrRating,mr*(1+0.015*4),'The Young Read 1.5% x 4'); near(A[1].armorRating,arm*(1+0.009*4),'Readable: 5.48 m inside 5.5 m'); near(v.armorRating,L0.v.armorRating,'not on Rhukk');
  at(L,A[1],-1,-9.6); V.step(2); near(A[1].armorRating,arm,'5.6 m: no');
  dig(L); V.step(1); near(A[0].armorRating,arm*(1+0.018*4),'Teach Them: double'); secs(3.2); near(A[0].armorRating,arm*(1+0.009*4),'over with the taunt');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))/plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))),1.02,'Lines in the Chitin');
  A[0].maxHp=1e6; A[0].hp=5e5; const h=A[0].hp; V.heal(A[0],1000); const g=A[0].hp-h; A[0].hp=h; plainHit(L,()=>V.heal(A[0],1000)); near(g/(A[0].hp-h),1.05,'Wide Reading'); A[0].hp=h;
  const h2=A[0].hp; secs(3.05); assert.ok(A[0].hp-h2>=0.006e6-1&&A[0].hp-h2<0.012e6,'Read Aloud 0.6% every 3 s');
  cara(L); near(inRatio(L,{kind:'magic'}),0.90,'Thick Loam: Rhukk, magic, while Carapace lasts'); near(inRatio(L,{kind:'true'}),1,'not other damage'); near(allyRatio(L,A[0],{kind:'magic'}),0.90,'and his Lesson readers');
});

test('Rhukk / A Straight Line (5% and 0.1 s a Carving), And a Wall (5% shield a Carving for 4 s), Plated Horn (in the crit group)',()=>{
  const P=rushLab(null); rush(P); const base=1e9-P.F[0].hp, st0=P.F[1].stunned;
  const L=rushLab(S(['eb_11_2','eb_12_2','eb_1_1']),{pre:L=>{ L.v.maxHp=1e6; }}), {v,F}=L; setStack(L,'rkCv',4); v.shield=0; rush(L);
  near((1e9-F[0].hp)/base,1.20,'4 Carvings: 20% more',0.01); near(F[1].stunned-st0,0.4,'and 0.4 s longer',1e-3); near(v.shield,0.20*v.maxHp,'And a Wall: 5% x 4',1e-3); near(v.shieldT,4,'4 s',0.05);
  const C=rushLab(S(['eb_11_3'])); brnd(0.049); assert.equal(critP(C,C.F[0],{cur:'charge'}),true,'Plated Horn 5% for Impale Rush'); brnd(0.051); assert.equal(critP(C,C.F[0],{cur:'charge'}),false); brnd(0); assert.equal(critP(C,C.F[0]),false,'not a basic attack');
});

test('Rhukk / The First Mark (SIGNATURE): carved hard at his most Carvings - 6 s of 25% less for allies within 6 m, double Lesson, not below 1 HP; once every 30 s',()=>{
  const L=kl(S(['eb_13_2','eb_12_2','eb_11_2','eb_1_1','eb_1_4']),{big:true,allies:2}), {v,A}=L; at(L,A[1],-1,-12.1); v.maxHp=1e6; v.hp=8e5; setStack(L,'rkCv',6); V.step(1);
  hitOn(L,0.07e6); assert.ok(win(L,'rkFm'),'the first mark'); near(winLeft(L,'rkFm'),6,'6 s',0.02); near(allyRatio(L,A[0]),0.75,'A0: 25% less'); near(allyRatio(L,A[1]),1,'A1 at 8.1 m: no');
  v.hp=1000; v.shield=0; V.hit(L.F[0],v,1e7,{kind:'true'}); assert.ok(v.alive&&v.hp>=1,'cannot drop below 1 HP'); V.step(1); assert.ok(A[0].armorRating>0);
  secs(6.1); near(allyRatio(L,A[0]),1,'over after 6 s'); v.hp=8e5; hitOn(L,0.07e6); assert.ok(!win(L,'rkFm'),'locked 30 s');
  const L2=kl(S(['eb_13_2','eb_12_2','eb_11_2','eb_1_1']),{big:true}); L2.v.maxHp=1e6; L2.v.hp=8e5; setStack(L2,'rkCv',5); hitOn(L2,0.07e6); assert.ok(!win(L2,'rkFm'),'not before his most Carvings'); assert.equal(stack(L2,'rkCv'),6);
});

test('Rhukk / the caps: his damage reduction one group at most 35%, his allies\' at most 50%, crit at most 5%, slows at most 40% weaker, Unafraid 20%, Carapace (Thicker Plates, three duration talents), armour ignored, movement',()=>{
  const all=['st_5_1','st_6_3','st_5_3','st_9_3','st_10_1','st_11_4','ot_1_4','ot_3_2','ot_9_2','ot_8_3','ot_12_4','ot_9_4','eb_5_3','eb_5_1','eb_7_3','eb_11_1'];
  const L=kl(S(all),{big:true}), {v,F}=L; const f=F[0]; f.forcedTarget=v; f.forcedTargetT=99; f.t=Object.assign({},f.t,{row:'Back'}); setStack(L,'rkHl',5); setStack(L,'rkAn',6); openWin(L,'rkCq',9); openWin(L,'rkMh',9); openWin(L,'rkCp',9); v.wardenStk=5; v.hp=0.2*v.maxHp;
  near(inRatio(L,{src:f,kind:'magic',crit:true}),0.65,'all at once: 35% at most'); f.forcedTargetT=0; f.t=Object.assign({},f.t,{row:'Front'}); setStack(L,'rkHl',0); setStack(L,'rkAn',0); L.T.s.w.rkCq.t=0; L.T.s.w.rkMh.t=0; L.T.s.w.rkCp.t=0; v.wardenStk=0; v.hp=v.maxHp;
  near(inRatio(L,{src:f}),0.95*0.95*0.95*0.92,'Hard Head, Under the Lip, Learned the Hard Way, Keep It Smooth multiply');
  VMX('pushDot')(v,100,3,1,'#8f8fa8',F[1],'true'); const d=v.dots[v.dots.length-1]; const keep=FX.dotPre(v,d); const x=d.dps; FX.dotPost(v,d,keep); near(x/100,0.95*0.95*0.95*0.92,'damage over time too');
  const Y=kl(S(['ot_1_1','ot_9_1','eb_5_1','eb_13_2','eb_12_2','eb_11_2','eb_1_1','eb_1_4']),{allies:1}); openWin(Y,'rkCp',9); openWin(Y,'rkFm',9); setStack(Y,'rkCv',1); V.step(1); openWin(Y,'rkCp',9); openWin(Y,'rkFm',9);
  near(allyRatio(Y,Y.A[0],{kind:'magic'}),0.50,'his allies: 50% at most');
  const C=kl(S(['st_7_3','ot_10_3','eb_11_3'])), g=C.F[0]; V.step(1); near(C.v.glyphCrit,0.05,'Long Horn: 5% as a stat'); g.forcedTarget=C.v; g.forcedTargetT=9; brnd(0); assert.equal(critP(C,g,{cur:'charge'}),false,'the stat fills the 5%: nothing more');
  const W=kl(S(['st_6_1','ot_7_4','eb_9_3','ot_1_4'])); secs(1.1); W.v.slow=2; W.v.slowMul=0.5; V.step(1); near(W.v.slowMul,1-0.5*0.6,'69% asked, 40% given');
  const U=kl(S(['ot_4_4'])); free(U.v); V.cc(U.F[0],U.v,'stunned',2); near(U.v.stunned,V.ccNerf*2*0.8,'Unafraid 20%',1e-3);
  const K=kl(S(['ot_11_2','st_9_4','ot_4_2','eb_2_2','eb_2_1','eb_1_1'])); cara(K); near(1-K.v.drMul,caraBase()*1.05,'Thicker Plates 1% x 5'); near(K.v.drT,5+1.0+0.6+1.0,'5 s + 2.6 s');
  const I=kl(S(['st_3_3'])); const a=lost(I.F[0],()=>V.hit(I.v,I.F[0],1000,{kind:'phys'})), b=plainHit(I,()=>lost(I.F[0],()=>V.hit(I.v,I.F[0],1000,{kind:'phys'}))); assert.ok(a>b,'his hits ignore armour');
  const M0=kl(null).v.speed, M=kl(S(['st_5_4','eb_2_3'])); V.step(1); near(M.v.speed,M0*1.18,'9% x 2');
  const O=kl(S(['st_4_3','ot_7_2'])); near(swing(O,O.F[0])/plainHit(O,()=>swing(O,O.F[0])),1.09*1.10,'Horn Hook and Horn Bash'); near(ratio(O,O.F[0]),1,'not a skill hit');
  const HW=kl(S(['st_8_1'])); HW.F[1].t=Object.assign({},HW.F[1].t,{row:'Back'}); near(ratio(HW,HW.F[1]),1.10,'Horn Weight on the back row'); HW.F[0].t=Object.assign({},HW.F[0].t,{row:'Front'}); near(ratio(HW,HW.F[0]),1,'not the front');
});

test('Rhukk: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['st_1_1','st_1_2','st_10_1','ot_1_1','ot_1_4','ot_4_3','eb_1_1','eb_2_1','eb_1_4']), TEAM=['rhukk','vael','sylthaine','vireo','vex'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let tr=false,sh=0,les=0,dg=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); const o=T0.rk; if(o){ sh+=Object.keys(o.sh).length; les+=Object.keys(o.les).length; if(o.digDr) dg=Math.max(dg,o.digDr); }
    for(const f of VMX('units').filter(u=>u.team==='enemy')){ const m=f._talM&&f._talM[s.uid]; if(m&&m.rkTr) tr=true; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', Trampled '+tr+', ally-ticks Sheltered '+sh+', reading his Lesson '+les+', Dig In\'s reduction '+dg.toFixed(3));
  assert.ok(mx.rkAn>=1,'real Anchor'); assert.ok(mx.rkCv>=1,'real Carvings'); assert.ok(dg>0.2&&dg<=0.5,'Dig In stronger, under its cap');
  determinism(H,TEAM);
});

/* No page site was added for Rhukk: with nothing learned, whole seeded fights with him in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ if(!process.env.RHUKK_NOBASE) BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Rhukk: no talents - whole fights with him in the line-up are identical to the pre-talent page',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['rhukk','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __rkN={rush:0,dig:0,cara:0}; var __rkD=_doEffectCore; _doEffectCore=function(u,type,o){ if(u&&u.key==="rhukk"){ if(type==="charge") __rkN.rush++; if(type==="taunt") __rkN.dig++; if(type==="defensive") __rkN.cara++; } return __rkD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__rkN'); console.log('  identity: '+JSON.stringify(c)); assert.ok(c.rush>0&&c.dig>0&&c.cara>0,'he cast all three skills'); }
  finally{ VMX('_doEffectCore=__rkD;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at 85% or more for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive is the one whose worst hit is reduced most. */
const DEF={ st:['st_9_3','st_10_1','st_11_4','st_5_1','st_6_3','st_1_4'],
            ot:['ot_1_4','ot_2_4','ot_3_2','ot_9_2','ot_8_3','ot_12_4','ot_9_4','ot_11_2','ot_4_3','ot_1_2','ot_2_2','ot_5_4','ot_4_2'],
            eb:['eb_7_3','eb_11_1','eb_5_1','eb_5_3','eb_1_1','eb_5_2','eb_10_2','eb_4_3','eb_2_2','eb_1_3'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={st:0,ot:1,eb:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* (the seeded-fight measure adds back what Dig In's own heal or a talent healed inside the same hit, and leaves out hits while The First Mark holds him at 1 HP: counted apart)
   the worst hit on him: at skill level 100, Carapace in his slot (the larger of his two skills, Thicker Plates on it), Thick Chitin at 5, every condition of his talents
   true at once (5 Headlong, full Anchor, Close Quarters, Momentum Hide, Carapace on, below 30% HP, the attacker taunted and in the back row); sustained: Thick Chitin at 5,
   2 Anchor, no skill in the slot, a front-row attacker, above 30%. Measured through the engine */
function worstHit(list,kind,crit,sustained){ const L=kl(list,{foes:3}), {v,F}=L, f=F[0];
  v.maxHp=1e5; v.hp=sustained?8e4:2.5e4; v.skillLv=[100,100,100,100]; v.wardenStk=5;
  if(!sustained){ v._castLv=100; V.cast(v,'green'); v._castLv=0; }
  if(L.T){ if(!sustained){ setStack(L,'rkHl',5); setStack(L,'rkAn',99); openWin(L,'rkCq',9); openWin(L,'rkMh',9); openWin(L,'rkCp',9); f.forcedTarget=v; f.forcedTargetT=99; f.t=Object.assign({},f.t,{row:'Back'}); }
    else setStack(L,'rkAn',2); }
  v.shield=1e12; v.shieldT=999; v.hp=sustained?8e4:2.5e4;
  const raw=sustained?5e3:2e3, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:true})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Rhukk: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['ot','eb'],[61,30]],[['ot'],[91]],[['eb','ot'],[61,30]],[['ot','st'],[61,30]],[['st','ot'],[61,30]],[['eb','st'],[61,30]],[['eb'],[91]],[['st','eb','ot'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,gl:0,hold:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore, __hu=healUnit; healUnit=function(u,a){ const h=u.hp; const r=__hu.apply(this,arguments); if(u===__dr.inH) __dr.hl+=u.hp-h; return r; };'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="rhukk"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; __dr.inH=tgt; __dr.hl=0; } let r; try{ r=__ddc.apply(this,arguments); } finally{ if(me) __dr.inH=null; }'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit&&!(tgt._tal&&tgt._tal.s.undy>0)){ const l=h0-tgt.hp-(tgt.shield||0)+__dr.hl, raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="rhukk"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal; if(T&&T.s.undy>0) __dr.hold++;'+
    '    if(T&&T.s.api){ let w=0; for(const e of units){ if(!e.alive||e.team===u.team) continue; for(const k of ["phys","magic"]){ const q=T.fn.drK(T.s.api,T,u,e,k,false)*defMul(e,u,k)*(u.drT>0?u.drMul:1)*(1-(u.glyphDR||0))*(u.wardenStk?(1-wardenCut(u)):1); if(1-q>w) w=1-q; } } if(w>=0.85) __dr.tHi++; if(w>__dr.gl) __dr.gl=w; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['rhukk','vael','sylthaine','vireo','vex'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; ticks at 85% or more against the strongest-reduced attacker '+d.tHi+' of '+d.ticks+' ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%, the highest '+(d.gl*100).toFixed(1)+'%); immune '+d.imm+', held at 1 HP '+d.hold);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.25*d.ticks,'above 85% for well under half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc; healUnit=__hu;'); }
});

/* Impale Rush's stun in real fights (made longer by Hard Charge, Scattered, A Straight Line; the signature's second): the longest time one enemy stays stunned by him in a row */
test('Rhukk: in seeded fights with his stun build, no enemy stays stunned by him past 4 s in a row',()=>{
  const list=T.learned(H,build(H,0,91,100));
  VMX('var __st={runs:[],cur:{}}; var __sc=ccApply, __su=_updateBattleCore;'+
    'ccApply=function(u,t,f,d){ const r=__sc.apply(this,arguments); if(r&&u&&u.key==="rhukk"&&f==="stunned") t.__rkS=1; return r; };'+
    '_updateBattleCore=function(dt){ const r=__su.apply(this,arguments); for(const e of units){ if(e.team==="ally") continue; const id=e.uid; const on=e.alive&&(e.stunned||0)>0&&e.__rkS;'+
    '  if(on){ __st.cur[id]=(__st.cur[id]||0)+dt; } else { if(__st.cur[id]) __st.runs.push(__st.cur[id]); __st.cur[id]=0; if(!((e.stunned||0)>0)) e.__rkS=0; } } return r; };');
  try{ const sn=snaps(['rhukk','vael','sylthaine','vireo','vex'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const s=VMX('__st'); for(const k in s.cur) if(s.cur[k]) s.runs.push(s.cur[k]); const mx=Math.max(0,...s.runs);
    console.log('  stun chain (91 Straight Through): '+s.runs.length+' runs of an enemy stunned by him, the longest '+mx.toFixed(2)+' s');
    assert.ok(s.runs.length>0,'he stunned someone'); assert.ok(mx<=4.0+0.05,'never past 4 s in a row: '+mx.toFixed(2)); }
  finally{ VMX('ccApply=__sc; _updateBattleCore=__su;'); }
});
