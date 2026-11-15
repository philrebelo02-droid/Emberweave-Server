'use strict';
/* KonWu's talents as data on the mechanics layer (talents-mech/konwu.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   kl(): the lab with KonWu held. go(): he thinks (his passive's clock runs, Phantom Step's channel, blink, kick and chase run) while he is rooted, not
   attacking, nothing ready. kick(): his real Phantom Step on one enemy (it is made the lowest-HP one): the 1 s channel, the blink, the kick 0.667 s later.
   CLEAVING ARC: the game's arc measures its 5 m from his CENTRE to the enemy's centre and lands on 67% of casts (tests/konwu-kit-facts.js); a fix for v1391 on
   another branch measures to the enemy's body edge. Every test that casts it puts the enemies 4.5 m or nearer from his centre, inside the cone, RIGHT BEFORE the
   cast, a place the arc reaches both before and after that fix. Its reach changes are checked on the skill's options, not on a place at its edge.
   Places (metres from KonWu, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). The lab's skill level is 10.
   Run: node --test tests/talents-mech-konwu.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='konwu', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); VMX('if(typeof __kbr!=="undefined"&&__kbr){ brnd=__kbr; __kbr=null; }'); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const mkLeft=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o[name]; return m&&m.until!=null?m.until-V.now():(m?Infinity:0); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const dm=(s,t,k)=>VMX('defMul')(s,t,k);
const rage=()=>VMX('rageMul');
const kw=L=>L.T.s.kw||(L.T.s.kw={});
const brnd=x=>VMX('var __kbr=(typeof __kbr!=="undefined"&&__kbr)?__kbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __kbr!=="undefined"&&__kbr){ brnd=__kbr; __kbr=null; }');
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };   // an enemy that thinks but does nothing, at level 1 (a control is not resisted)
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=99; v.blueCd=99; v.energy=0; };
const kl=(list,o)=>lab(H,list,o||{});
const plain=(o,fn)=>fn(kl(null,o));
const hitOn=(L,t,amt,o)=>{ const r=lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||100,Object.assign({kind:'true'},o||{}))); L.v.energy=0; return r; };
const ratio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
function skillRatio(L,t,skill,o){ const s=L.T.s, keep=s.cur; s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))); } finally{ s.cur=keep; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))); }
const inRatio=(L,o,amt)=>{ const v=L.v, h=v.hp, s=v.shield||0; const a=hitOn(L,v,amt||100,o); v.hp=h; v.shield=s; const b=plainHit(L,()=>hitOn(L,v,amt||100,o)); v.hp=h; v.shield=s; return a/b; };
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const atkNow=L=>L.v.dmg*((L.v.dmgBuffT>0)?(L.v.dmgBuffMul||1):1)*rage();
/* his real Phantom Step on t: t is made the lowest-HP enemy, he channels 1 s, lands behind it, kicks 0.667 s later. Returns {p: where t stood, d: the kick's
   damage, e: where t landed, m: metres it flew}. pre(): run right after the blink (he stands behind t, the kick still to come) */
function kick(L,t,pre,cd){ const v=L.v; go(L); if(cd!=null) v.blueCd=cd; for(const f of L.F) if(f!==t&&f.alive&&f.hp<=t.hp) f.hp=t.hp+1; v.target=t; V.cast(v,'blue',t);
  let n=0; while(!v._kickTg&&n<200){ V.step(1); n++; } assert.ok(v._kickTg,'he blinked'); if(pre) pre(v._kickTg);
  const tg=v._kickTg; let p={x:tg.x,y:tg.y}, d=0; while(v._kickTg&&n<400){ const h=tg.hp; p={x:tg.x,y:tg.y}; V.step(1); n++; if(!v._kickTg) d=h-tg.hp; }
  return {t:tg,p,d,e:{x:tg.x,y:tg.y},m:Math.hypot(tg.x-p.x,tg.y-p.y)/V.METER}; }
const KO=slot=>VMX('skillScaleOpts')(Object.assign({},slot==='ult'?VMX('ULT_DEF.monkSlam'):VMX('KITS.konwu')[slot]),VMX('skillMul')(10),10);   // his kit row as the lab casts it (skill level 10)
const arcAt=(L,t,dx,dy)=>{ at(L,t,dx==null?4.5:dx,dy||0); V.cast(L.v,'green',t); };   // 4.5 m from his centre, straight ahead: a place the arc reaches before and after the v1391 fix
const slam=L=>V.cast(L.v,'ult');
const kicks=()=>VMX('__kwK'); VMX('var __kwK=0; var __kwKK=konwuKickExec; konwuKickExec=function(u){ if(u&&u.key==="konwu") __kwK++; return __kwKK.apply(this,arguments); };');

test('KonWu: every talent is accounted for - 9 plain stats, 109 with rows, none waiting',()=>{
  accounting(H,[118,9,109,0,0]);
  const M=FXN.mech(H); for(const id of ['nf_1_1','gp_1_4','ru_1_4','nf_13_2','gp_13_3','ru_13_3','nf_9_3']) assert.ok(M.talents[id],id);
  for(const id of ['nf_8_3','nf_1_3','gp_3_2','gp_5_4','gp_2_2','ru_8_2','ru_12_4','ru_9_2','ru_1_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.ok(!FXN.has(H,'nf_9_3'),'Unimpressed is a row (the 5% crit group), no longer a plain stat');
  for(const [id,nm] of [['nf_2_2','Close Behind'],['nf_10_2','Falling Weight'],['gp_8_4','Cold Grey']]) assert.equal(T.talent(H,id).name,nm,'renamed: '+id);
});

test('KonWu: his real kit, as the talents read it - Cleaving Arc, Phantom Step (blink, kick, knock-back, stun, chase), Heaven-Splitting Slam, Adamant Discipline',()=>{
  plain({foes:4},P=>{ const {v,F}=P, sm=VMX('skillMul')(10);
    assert.ok(v.pass&&v.pass.warden,'his passive is Adamant Discipline (warden)');
    const h0=F[0].hp; arcAt(P,F[0]); const k=VMX('elemMul')(v,F[0])*(v.dmgBonusMul2||1)*dm(v,F[0],'phys'); near(h0-F[0].hp,1.5*v.dmg*sm*rage()*k,'Cleaving Arc: 150% of his attack x the skill level, 4.5 m ahead',1e-6);
    const h3=F[3].hp; at(P,F[3],0,6); arcAt(P,F[0]); near(h3-F[3].hp,0,'not an enemy 90 degrees off the cone');
    near(KO('green').radius,5*V.METER,'its reach: 5 m (the skill\'s own option)',1e-9); assert.equal(KO('green').angle,45);
    free(F[0]); F[0].level=100;
    const r=kick(P,F[0]); assert.ok(r.d>0,'the kick lands'); near(r.m,8,'and knocks the mark 8 m straight away from him',0.02);
    near(F[0].stunned,2.45,'its stun: the table\'s single stun 3.5 s x 0.7',0.03); near(v._chaseT,3,'the chase: 3 s',0.03); near(v._chaseMul,1.5,'at 1.5x',1e-9); assert.equal(v._chaseTg,F[0]);
    near(r.d,2.0*v.dmg*sm*1.2*rage()*VMX('elemMul')(v,F[0])*(v.dmgBonusMul2||1)*dm(v,F[0],'phys'),'the kick: 200% x 1.2 of his attack x the skill level',1e-6); });
  plain({foes:3},P=>{ const {v,F}=P; for(const f of F) free(f); at(P,F[2],7,-4); const h=F.map(f=>f.hp); slam(P);
    F.forEach((f,i)=>{ assert.ok(f.hp<h[i],'the slam strikes every enemy within 15 m'); near(f.stunned,1.4,'and stuns it 1.4 s (the area table 2.0 s x 0.7), not the card\'s 2 s',1e-6); }); });
  plain({foes:2},P=>{ const {v}=P; v.wardenStk=0; v.wardenT=0; secs(15.1); assert.equal(v.wardenStk,5,'Adamant Discipline: a stack every 3 s, 5 in 15 s'); near(VMX('wardenCut')(v),Math.min(VMX('SKLV.wardenCap')(10),0.04*v.passMul*5),'damage reduction (not armour and magic resist), up to its cap',1e-9); });
});

/* ============================== NINE DAYS FALLING ============================== */
test('KonWu / Insult: Insolence (every enemy he stuns, 6 s; 3% x 3), Lingering Slight, Spite of Heaven (in his capped group), Wide Grin (first hit, 10%), Earned Disdain (up to 3), Old Slight',()=>{
  const L=kl(S(['nf_1_4','nf_3_4','nf_5_4','nf_6_4','nf_11_1','nf_12_1']),{foes:5}), {v,F}=L; for(const f of F) free(f); at(L,F[2],7,-4); const a0=v.dmg;
  slam(L); for(const f of F) assert.ok(mark(L,f,'kwIns'),'every enemy the slam stunned is Insulted'); near(mkLeft(L,F[0],'kwIns'),6+3,'Lingering Slight: 6 + 0.6 x 5 s',1e-6);
  near(ratio(L,F[1],{crit:true}),1.09*1.06*1.10,'Insolence 3% x 3; a critical: Wide Grin 5% x 2 on the first hit, Old Slight 2% x 3');
  near(ratio(L,F[1],{crit:true}),1.09*1.06,'Wide Grin only once per Insult'); near(ratio(L,F[2]),1.09,'not a critical: the first hit spends Wide Grin all the same'); near(ratio(L,F[2],{crit:true}),1.09*1.06,'');
  V.step(1); near(v.dmg/a0,1.15,'Earned Disdain: 1% x 5 attack per Insulted enemy, up to 3 (5 Insulted)',1e-9);
  near(inRatio(L,{src:F[0]}),1-0.075,'Spite of Heaven: Insulted enemies deal 1.5% x 5 less to him'); const x=F[4]; x._talM[v.uid].kwIns.until=V.now(); near(inRatio(L,{src:x}),1,'not one whose Insult ended');
  secs(9.1); assert.ok(!mark(L,F[0],'kwIns'),'over after 9 s'); near(ratio(L,F[0]),1,'');
  const p=kl(S(['nf_5_4']),{foes:2}); for(const f of p.F) free(f); slam(p); assert.ok(mark(p,p.F[0],'kwIns'),'any Insult talent: his stuns Insult');
});

test('KonWu / Hard Landing: Long Way Down (1% x 5 of his attack a metre, when the mark comes down), Further Down, Down Hard, Broken Ground; Stone in Flight\'s link',()=>{
  const L=kl(S(['nf_1_1','nf_2_1','nf_10_1','nf_8_1','gp_n1','nf_1_4']),{foes:3}), {v,F}=L; for(const f of F) free(f); F[0].level=100;
  setStack(L,'kwGrey',3); const r=kick(L,F[0]); near(r.m,9.5,'Further Down: 8 + 0.5 x 3 m',0.02); assert.ok(mark(L,F[0],'kwIns'),'(the kick\'s stun Insults it)');
  const h=F[0].hp; secs(0.3); near(h-F[0].hp,0,'not before it comes down (0.35 s)'); secs(0.1);
  near(h-F[0].hp,0.05*atkNow(L)*r.m*1.20*(1+0.06*3),'1% x 5 a metre, Down Hard 4% x 5 on an Insulted mark, Stone in Flight 6% a Greystone held at the kick',1e-6);
  near(1-F[0].slowMul,0.20,'Broken Ground: slowed 4% x 5',1e-9); near(F[0].slow,2,'for 2 s (its clock stands while it is stunned)',0.05);
  const p=kl(S(['gp_n1']),{foes:2}); setStack(p,'kwGrey',3); for(const f of p.F) free(f); const q=kick(p,p.F[0]); const h2=p.F[0].hp; secs(0.45); near(h2-p.F[0].hp,0,'without Long Way Down the link adds nothing');
});

test('KonWu / Into the Crowd: an enemy the flying mark passes within 1 m of is stunned 0.5 s and takes Hard Landing\'s damage (the break rule)',()=>{
  const L=kl(S(['nf_1_1','nf_2_1','nf_3_1']),{foes:4}), {v,F}=L; for(const f of F) free(f); F[0].level=100; const by=F[1], far=F[2];
  const r=kick(L,F[0],tg=>{ const ux=(tg.x-v.x), uy=(tg.y-v.y), l=Math.hypot(ux,uy), K=9.5*V.METER; by.x=tg.x+ux/l*K*0.5; by.y=tg.y+uy/l*K*0.5; far.x=tg.x+ux/l*K*0.5-uy/l*6*V.METER; far.y=tg.y+uy/l*K*0.5+ux/l*6*V.METER; });
  const hb=by.hp, hf=far.hp, hm=F[0].hp; secs(0.45);
  const d=0.05*atkNow(L)*r.m; near(hm-F[0].hp,d,'the mark: Hard Landing',2e-2); near(hb-by.hp,hm-F[0].hp,'the enemy on its path takes the same',1e-9); near(by.stunned,0.5,'and is stunned 0.5 s',0.2);
  near(hf-far.hp,0,'not one 6 m off the path'); assert.ok(!(far.stunned>0));
  const L2=kl(S(['nf_1_1','nf_3_1','nf_2_1']),{foes:3}), b2=L2.F[1]; for(const f of L2.F) free(f);
  const h2=b2.hp; kick(L2,L2.F[0],tg=>{ const v2=L2.v, ux=tg.x-v2.x, uy=tg.y-v2.y, l=Math.hypot(ux,uy); for(const f of L2.F) if(f!==tg) f.level=1; slam(L2); for(const f of L2.F){ f.stunned=f===b2?0.2:0; } b2.x=tg.x+ux/l*4.5*V.METER; b2.y=tg.y+uy/l*4.5*V.METER; });
  secs(0.45); assert.ok(!(b2.stunned>0),'the break rule: a stun of his on it ended less than 0.5 s ago (the slam stun, cut short): no stun'); assert.ok(h2-b2.hp>0,'(it still takes the damage)');
});

test('KonWu / the kick: Dropkick Form, Kick Off the Rock, Behind the Weak; Back on His Feet, Nothing Hurt; Second Step; Monkey\'s Reach; Deep Breath',()=>{
  const L=kl(S(['nf_6_2','gp_6_3','ru_7_2','nf_10_4','nf_12_4','nf_9_4','nf_4_1','nf_11_3']),{foes:4}), {v,F}=L;
  near(skillRatio(L,F[0],'blink'),1.15*1.15*1.15,'the kick 3% x 5 three times'); near(skillRatio(L,F[0],'cleavecone'),1,'not other skills');
  near(FX.cd(v,'blue',10),9,'Deep Breath: 0.2 s x 5 off Phantom Step',1e-9);
  v.hp=v.maxHp*0.5; v.shield=0; const hv=v.hp; v.silencedT=99; const r=kick(L,F[0],null,50); near(v.hp-hv,0.05*v.maxHp,'Back on His Feet: 1% x 5 of his max HP when the kick lands',1e-6);
  near(v.shield,0.04*v.maxHp,'Nothing Hurt: a shield of 2% x 2 of his max HP',1e-6); assert.ok(v.shieldT<=3+1e-9&&v.shieldT>2.9,'for 3 s');
  const c0=v.blueCd; secs(1.0); kill(L,F[0]); V.step(1); near(v.blueCd,c0-3,'Second Step: the mark died within 3 s of the kick: 3 s off',1e-9);
  F[1].hp=1e3; F[1].shield=0; kick(L,F[1],null,50); const c1=v.blueCd; secs(3.1); kill(L,F[1]); V.step(1); near(v.blueCd,c1,'not after 3 s',1e-9);
  const k2=F[2]; k2.hp=1; k2.shield=0; kick(L,k2,null,50); assert.ok(!k2.alive); near(v.blueCd,47,'the kick itself killed it: 3 s off',1e-9);
  const M=kl(S(['nf_4_1']),{foes:3}); at(M,M.F[2],18,0); M.F[2].hp=5e8; go(M); V.cast(M.v,'blue',M.F[0]); secs(1.05); assert.equal(M.v._kickTg,M.F[2],'Monkey\'s Reach: 1 m x 5 farther (the lowest-HP enemy 18 m away)');
  const N=kl(null,{foes:3}); at(N,N.F[2],18,0); N.F[2].hp=5e8; go(N); V.cast(N.v,'blue',N.F[0]); secs(1.05); assert.notEqual(N.v._kickTg,N.F[2],'(without it: out of reach)');
});

test('KonWu / the chase: Close Behind (Head Start each 0.5 s, spent by his first basic attack), Full Stride, Overtake, Long Pursuit, Cloud Stride',()=>{
  const P0=kl(S(['nf_2_2','nf_4_2']),{foes:3}); kick(P0,P0.F[0]); near(P0.v._chaseT,3.9,'Long Pursuit: 3 + 0.3 x 3 s',0.03); secs(4.5); assert.equal(stack(P0,'kwHs'),6,'without Full Stride: at most 6');
  const L=kl(S(['nf_2_2','nf_4_2','nf_12_3','nf_9_1','nf_6_1']),{foes:3}), {v,F}=L; const ls0=v.lifestealStat||0;
  kick(L,F[0]); V.step(1); near(L.T.s.ap.move,1.12,'Cloud Stride: 4% x 3 faster while chasing',1e-9);
  secs(2.0); assert.equal(stack(L,'kwHs'),4,'1 Head Start each 0.5 s of the chase (2 s: 4)'); near(v.lifestealStat-ls0,4*0.02,'Overtake: 0.4% x 5 lifesteal per Head Start',1e-9);
  v.stunned=1.0; secs(0.9); assert.equal(stack(L,'kwHs'),4,'none while he is stunned'); v.stunned=0;
  const a=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',auto:true})), b=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',auto:true})));
  near(a/b,1+0.05*4,'his first basic attack spends them: 1% x 5 per Head Start'); assert.equal(stack(L,'kwHs'),0); secs(1.0); assert.equal(stack(L,'kwHs'),0,'that chase gathers no more');
  V.step(1); near(v.lifestealStat-ls0,0,'',1e-9); secs(2.5); near(L.T.s.ap.move,1,'the chase over: no Cloud Stride',1e-9);
  assert.equal(L.T.st.kwHs.max,9,'Full Stride: up to 9'); const M=kl(S(['nf_2_2','nf_4_2','nf_12_3']),{foes:3}); kick(M,M.F[0]); secs(4.5); assert.equal(stack(M,'kwHs'),8,'the whole chase: 3.9 s, and the 0.25 s he holds the kick before he runs (8)');
});

test('KonWu / Never Let Go (PICK ONE: no slow, no fear while chasing) and Pass Him By (PICK ONE: the chase jumps on) with Hungry Eyes',()=>{
  const L=kl(S(['nf_2_2','nf_4_2','nf_5_2']),{foes:3}), {v,F}=L; kick(L,F[0]);
  V.cc(F[1],v,'slow',2); assert.ok(!(v.slow>0),'no slow lands while he chases'); V.cc(F[1],v,'fearT',2); assert.ok(!(v.fearT>0),'no fear');
  v.slow=2; v.slowMul=0.5; V.step(1); assert.ok(!(v.slow>0),'a slow written straight on ends at once'); secs(4.5); V.cc(F[1],v,'slow',2); assert.ok(v.slow>0,'after the chase they land');
  const M=kl(S(['nf_5_3','nf_6_3']),{foes:4}), w=M.v, G=M.F; const i0=w.atkInterval; G[0].hp=1e8; G[1].hp=7e8; G[2].hp=8e8; kick(M,G[0]); secs(0.5);
  kill(M,G[0]); V.step(1); assert.equal(w._chaseTg,G[1],'the mark died: the chase jumps to the lowest-health enemy within 8 m'); assert.ok(w._chaseT>1.5,'for the rest of its time');
  V.step(1); near(i0/w.atkInterval,1.15,'Hungry Eyes: 5% x 3 attack speed',1e-9); secs(4.0); near(i0/w.atkInterval,1,'for 4 s',1e-9);
  const N=kl(null,{foes:3}); N.F[1].hp=7e8; kick(N,N.F[0]); secs(0.5); kill(N,N.F[0]); V.step(1); assert.ok(!(N.v._chaseT>0),'(without it the chase ends with the mark)');
});

test('KonWu / Ringing Ears (every stun of his 0.3 s longer: skills and talents), Echo of the Fall (the slam), the 4 s ceiling',()=>{
  const L=kl(S(['nf_8_2','gp_10_3','nf_1_1','nf_3_1']),{foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[2],7,-4);
  slam(L); for(const f of F) near(f.stunned,1.4+0.3+0.3,'the slam: 1.4 + Ringing Ears 0.06 x 5 + Echo of the Fall 0.1 x 3 s',1e-6);
  for(const f of F) f.stunned=0; secs(1.0); for(const f of F){ f.stunned=0; if(f._talM) delete f._talM[v.uid]; } const by=F[1]; F[0].level=100;
  kick(L,F[0],tg=>{ const ux=tg.x-v.x, uy=tg.y-v.y, l=Math.hypot(ux,uy); by.x=tg.x+ux/l*4*V.METER; by.y=tg.y+uy/l*4*V.METER; by.stunned=0; }); near(F[0].stunned,2.45+0.3,'the kick: 2.45 + 0.3 s',0.03);
  let n=0; while(!(by.stunned>0)&&n<30){ V.step(1); n++; } near(by.stunned,0.5+0.3,'a talent stun (Into the Crowd): 0.5 + 0.3 s',0.03);
  F[0].stunned=3.9; VMX('ccApply')(v,F[0],'stunned',1); assert.ok(F[0].stunned<=4.0+1e-9,'never past 4 s in all');
});

test('KonWu / Landslide and the kick\'s stun',()=>{
  const ref=kl(null,{foes:3}); for(const f of ref.F) free(f); ref.F[0].level=100; const pr=kick(ref,ref.F[0]);
  const L=kl(S(['nf_8_2','gp_7_4','gp_1_4']),{foes:3}), {v,F}=L; for(const f of F) free(f); F[0].level=100; setStack(L,'kwGrey',5);
  const r=kick(L,F[0]); near(r.d/pr.d,1+0.04*5,'Landslide: the kick 4% more per Greystone spent (5)',1e-6); assert.equal(stack(L,'kwGrey'),0,'every Greystone spent');
  near(F[0].stunned-ref.F[0].stunned,0.3+0.5,'its stun: 2.45 + Ringing Ears 0.3 + 0.1 a Greystone (against a plain kick, measured the same way)',0.01);
  const M=kl(S(['nf_8_2']),{foes:3}); for(const f of M.F) free(f); M.F[0].level=100; M.F[0].stunned=0; kick(M,M.F[0]); near(M.F[0].stunned,2.75,'Ringing Ears alone on the kick',0.03);
});

test('KonWu / Shake the Heavens (the slam Insults, the lowest-health one knocked 4 m, Hard Landing), Heaven\'s Mistake, Falling Weight, Grey Patience, Grand Slam',()=>{
  const L=kl(S(['nf_11_2','nf_12_2','nf_1_1','nf_10_2','gp_8_2','ru_10_3']),{foes:4}), {v,F}=L; for(const f of F) free(f); F[2].hp=5e8; at(L,F[2],7,-4);
  near(skillRatio(L,F[0],'monkSlam'),1.15*1.12*1.15,'Falling Weight 3% x 5, Grey Patience 4% x 3, Grand Slam 3% x 5');
  v.blueCd=10; const p={x:F[2].x,y:F[2].y}; slam(L); near(v.blueCd,10-1.0*4,'Heaven\'s Mistake: 0.2 s x 5 off Phantom Step per enemy stunned (4)',1e-9);
  for(const f of F) assert.ok(mark(L,f,'kwIns'),'every enemy it stunned is Insulted');
  const h=F[2].hp; secs(0.45); const m=Math.hypot(F[2].x-p.x,F[2].y-p.y)/V.METER; assert.ok(m>3.5&&m<4.3,'the lowest-health one is knocked 4 m away ('+m.toFixed(2)+' m)');
  near(h-F[2].hp,0.05*atkNow(L)*m,'Hard Landing on it when it comes down',2e-2);
});

test('KonWu / Thrown Down Again (SIGNATURE): on an Insulted mark, Phantom Step again at once - no second stun on it, Hard Landing triple, every enemy within 3 m stunned 1 s and Insulted; once every 20 s',()=>{
  const L=kl(S(['nf_13_2','nf_1_1','nf_1_4']),{foes:4}), {v,F}=L; for(const f of F) free(f); F[0].level=100; setMk(L,F[0],'kwIns',99);
  const k0=kicks(); const r=kick(L,F[0]); assert.equal(kicks()-k0,1); const st1=F[0].stunned; assert.ok(st1>2,'the first kick stuns it'); near(kw(L).tdaCd,20,'once every 20 s (a countdown of fight time)',3e-3);
  secs(0.1); assert.ok(v._kickTg===F[0],'at once: he is behind the same mark again, no 1 s channel'); const p2={x:F[0].x,y:F[0].y};
  let n=0; while(v._kickTg&&n<60){ V.step(1); n++; } assert.equal(kicks()-k0,2,'the second kick'); const m2=Math.hypot(F[0].x-p2.x,F[0].y-p2.y)/V.METER;
  assert.ok(F[0].stunned<st1,'no second stun on the stunned mark ('+F[0].stunned.toFixed(2)+' < '+st1.toFixed(2)+')');
  const by=F[1]; by.x=F[0].x+6.5*V.METER; by.y=F[0].y; by.stunned=0; delete (by._talM||{})[v.uid]; const fa=F[2]; fa.x=F[0].x; fa.y=F[0].y+9*V.METER; fa.stunned=0;
  const h=F[0].hp; secs(0.4); near(h-F[0].hp,3*0.05*atkNow(L)*m2,'its Hard Landing: triple',2e-2);
  near(by.stunned,1,'an enemy within 3 m of where it came down: stunned 1 s',0.1); assert.ok(mark(L,by,'kwIns'),'and Insulted'); assert.ok(!(fa.stunned>0),'not one 9 m off');
  secs(3); F[0].stunned=0; setMk(L,F[0],'kwIns',99); const k1=kicks(); kick(L,F[0]); secs(2.0); assert.equal(kicks()-k1,1,'not again within 20 s');
  const M=kl(S(['nf_13_2']),{foes:3}); for(const f of M.F) free(f); const k2=kicks(); kick(M,M.F[0]); secs(2.0); assert.equal(kicks()-k2,1,'a mark that was not Insulted before the kick: once');
});

test('KonWu / his crit-chance talents, one group (5% in all): Unimpressed as a stat, Behind You (2 s behind the mark) and Clean Sweep (Cleaving Arc) as this hit\'s own roll',()=>{
  const L=kl(S(['nf_9_3','nf_7_4','ru_7_1']),{foes:3}), {v,F}=L; V.step(1); near(v.glyphCrit,0.05,'Unimpressed 1% x 5: 5%',1e-9);
  setMk(L,F[0],'kwBy',2); brnd(0.0); near(ratio(L,F[0]),1,'the group is full: nothing more'); near(skillRatio(L,F[0],'cleavecone'),1,''); brndBack();
  const M=kl(S(['nf_7_4','ru_7_1']),{foes:3}), w=M.v, G=M.F; V.step(1); near(w.glyphCrit||0,0,'',1e-9);
  go(M); V.cast(w,'blue',G[0]); let n=0; while(!w._kickTg&&n<100){ V.step(1); n++; } assert.ok(mark(M,G[0],'kwBy'),'Behind You: he landed behind it'); near(mkLeft(M,G[0],'kwBy'),2,'for 2 s',0.05);
  brnd(0.044); assert.ok(ratio(M,G[0])>1.4,'1.5% x 3: a roll of 0.044 crits'); brndBack(); brnd(0.046); near(ratio(M,G[0]),1,'0.046 does not (4.5%)'); brndBack();
  brnd(0.044); near(ratio(M,G[1]),1,'not on another enemy'); assert.ok(skillRatio(M,G[1],'cleavecone')>1.4,'Clean Sweep: 1.5% x 3 on Cleaving Arc'); brndBack();
  brnd(0.046); near(skillRatio(M,G[1],'cleavecone'),1,''); brndBack();
});

/* ============================== GREY OF THE PEAK ============================== */
test('KonWu / Greystone: Grey Skin (1 each 3 s once Discipline is full; 0.4% x 3 less per Greystone), Layered Stone, Cold Grey, Mountain Rising, Settled, Stone Remembers, Stone Hands, Stone in Flight',()=>{
  const L=kl(S(['gp_1_4','gp_6_4','gp_8_4','gp_12_3','gp_11_1','gp_11_3','gp_7_2','gp_n1']),{foes:3}), {v,F}=L; v.wardenT=-1e6; v.wardenStk=0; V.step(1); const a0=v.dmg, ls0=v.lifestealStat||0;
  v.wardenStk=4; secs(3.2); assert.equal(stack(L,'kwGrey'),0,'nothing before Discipline is full'); v.wardenStk=5; V.step(1); const a1=v.dmg; near(a1/a0,1.10,'Stone Hands: 2% x 5 attack while it is full',1e-9);
  secs(2.9); assert.equal(stack(L,'kwGrey'),0,'not before 3 s'); secs(0.2); assert.equal(stack(L,'kwGrey'),1,'1 Greystone after 3 s');
  setStack(L,'kwGrey',3); V.step(1); near(v.dmg/a0,1.10+0.02*3,'Cold Grey: 0.4% x 5 attack per Greystone (with Stone Hands: one attack stat)',1e-9); near(v.lifestealStat-ls0,0.015*3,'Mountain Rising: 0.3% x 5 lifesteal per Greystone',1e-9);
  near(inRatio(L,{src:F[0]}),(1-0.012*3)*(1-0.03),'Grey Skin 1.2% per Greystone, Stone in Flight 3% at 3 or more (in his group)');
  setStack(L,'kwGrey',2); near(inRatio(L,{src:F[0]}),1-0.024,'Stone in Flight: not below 3');
  assert.equal(L.T.st.kwGrey.max,8,'Layered Stone: up to 8'); near(ratio(L,F[0]),1,'');
  setStack(L,'kwGrey',7); L.T.s.kw.ga=0; secs(3.1); assert.equal(stack(L,'kwGrey'),8); assert.equal(stack(L,'kwSr'),1,'Stone Remembers: he reached full Greystone once'); V.step(1);
  near(ratio(L,F[0]),1.10,'Settled: 2% x 5 more at full Greystone'); near(v.dmg/a0,1.10+0.02*8+0.05,'Stone Hands + Cold Grey (8) + Stone Remembers 1% x 5 a time (one attack stat)',1e-9);
  setStack(L,'kwGrey',7); L.T.s.kw.ga=0; secs(3.1); assert.equal(stack(L,'kwSr'),2,'again'); setStack(L,'kwSr',5); setStack(L,'kwGrey',7); L.T.s.kw.ga=0; secs(3.1); assert.equal(stack(L,'kwSr'),5,'up to 5 times');
  v.wardenStk=4; V.step(1); near(v.dmg/a0,1+0.02*8+0.25,'Stone Hands only while Discipline is full',1e-9);
});

test('KonWu / Old Rock (Discipline\'s stacks 0.3 s x 3 sooner) and Mountain Patience (its stacks and half the Greystone kept between waves)',()=>{
  const p=kl(null,{foes:2}); p.v.wardenStk=0; p.v.wardenT=0; secs(6.4); const n0=p.v.wardenStk;
  const L=kl(S(['gp_2_4','gp_3_4','gp_1_4']),{foes:2}), {v}=L; v.wardenStk=0; v.wardenT=0; secs(6.4); assert.equal(n0,2,'(plain: a stack every 3 s)'); assert.equal(v.wardenStk,3,'Old Rock: every 2.1 s');
  v.wardenStk=5; setStack(L,'kwGrey',5); V.step(1); V.wave(); v.wardenStk=0; v.wardenT=0; V.step(1); assert.equal(v.wardenStk,5,'Mountain Patience: Discipline keeps its 5 stacks'); assert.equal(stack(L,'kwGrey'),2,'and half his Greystone (rounded down)');
  const M=kl(S(['gp_1_4']),{foes:2}); M.v.wardenStk=5; setStack(M,'kwGrey',5); V.step(1); V.wave(); M.v.wardenStk=0; V.step(1); assert.equal(stack(M,'kwGrey'),0,'without it a wave starts with none');
});

test('KonWu / Skid: Blades Skid (1% x 5: a third of the hit), Sliding Off (points), Grit in the Edge, Shale (PICK ONE), Gold Underneath; Granite (PICK ONE: 12%, Harder Cap) and the 70% cap',()=>{
  const L=kl(S(['gp_1_3','gp_4_3','gp_2_3','gp_5_3','gp_12_1']),{foes:3,big:true}), {v,F}=L;
  brnd(0.064); near(inRatio(L,{src:F[0]}),1/3,'a roll of 0.064 < 6.5%: it Skids (a third)'); brndBack(); brnd(0.066); near(inRatio(L,{src:F[0]}),1,'0.066 does not'); brndBack();
  v.hp=v.maxHp*0.5; const h=v.hp; brnd(0.0); hitOn(L,v,100,{src:F[0]}); brndBack(); near(v.hp-h,0.02*v.maxHp,'Gold Underneath: 1% x 2 of his max HP a Skid',1e-5);
  const a=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',auto:true})), b=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',auto:true}))); near(a/b,1.18,'Grit in the Edge: his next basic attack 6% x 3 more');
  near(ratio(L,F[1],{auto:true}),1,'once'); assert.equal(stack(L,'kwShd'),2,'Shale: a shard each Skid (2)');
  setStack(L,'kwShd',5); const pa=plainHit(L,()=>{ at(L,F[0],4.5,0); return lost(F[0],()=>V.cast(v,'green',F[0])); }); at(L,F[0],4.5,0); const ta=lost(F[0],()=>V.cast(v,'green',F[0]));
  near(ta/pa,1.20,'his next Cleaving Arc 4% per shard (5)',1e-6); assert.equal(stack(L,'kwShd'),0); at(L,F[0],4.5,0); near(lost(F[0],()=>V.cast(v,'green',F[0]))/pa,1,'spent',1e-6);
  const G=kl(S(['gp_5_2','gp_6_2','gp_1_3']),{foes:3,big:true}), w=G.v; brnd(0.0); near(inRatio(G,{src:G.F[0]},0.05*w.maxHp),1,'Granite: no Skid (a roll of 0), a hit under the cap whole'); brndBack();
  const em=VMX('elemMul')(G.F[0],w); near(inRatio(G,{src:G.F[0]},0.20*w.maxHp),0.09/(0.20*em),'no hit takes more than 12% - 1% x 3 of his max HP',1e-6); near(inRatio(G,{src:G.F[0]},0.60*w.maxHp),0.30,'never more than 70% off (his group\'s cap)',1e-6);
});

test('KonWu / Fault: The Fault Beneath (the slam\'s stun, 8 s; his team 2% x 5), Wide Fault, Crack Spreads, Fault Seeker, Along the Fault, Four Hundred Times, Shifting Ground, Under the City',()=>{
  const L=kl(S(['gp_1_1','gp_3_1','gp_6_1','gp_7_1','gp_9_1','gp_12_4']),{foes:4,allies:1}), {v,F,A}=L; for(const f of F) free(f); at(L,F[2],7,-4);
  const s0=F[1].speed=100; slam(L); for(const f of F.slice(0,4)) assert.ok(mark(L,f,'kwFlt'),'every enemy the slam stunned is Faulted'); near(mkLeft(L,F[0],'kwFlt'),8+3,'Wide Fault: 8 + 0.6 x 5 s',1e-6);
  near(ratio(L,F[0]),1.10*1.10,'The Fault Beneath 2% x 5 and Fault Seeker 2% x 5'); near(skillRatio(L,F[0],'cleavecone'),1.10*1.10*1.15,'Along the Fault: Cleaving Arc 3% x 5 more');
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),1100*VMX('elemMul')(A[0],F[0])*(A[0].dmgBonusMul2||1),'his allies 2% x 5 more on it',1e-6);
  V.step(1); near(F[1].speed/s0,0.90,'Crack Spreads: 5% x 2 slower',1e-9);
  near(lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'})),940*VMX('elemMul')(F[0],A[0]),'Under the City: Faulted enemies deal 2% x 3 less to his allies',1e-6); near(inRatio(L,{src:F[0]}),0.94,'and to him (in his group)');
  const Q=kl(S(['gp_10_2','gp_1_1']),{foes:3}); for(const f of Q.F) free(f); slam(Q); const nx=Q.F[2]; assert.ok(!mark(Q,nx,'kwFlt'),'(15.5 m away: the slam did not reach it)');
  at(Q,nx,10,3); kill(Q,Q.F[1]); V.step(1); assert.ok(mark(Q,nx,'kwFlt'),'Shifting Ground: the enemy nearest the dead Faulted one'); near(mkLeft(Q,nx,'kwFlt'),3,'for 1 s x 3',0.05);
  const R=kl(S(['gp_11_4']),{foes:3}); arcAt(R,R.F[0]); assert.ok(mark(R,R.F[0],'kwFlt'),'Four Hundred Times: Cleaving Arc Faults what it hits'); near(mkLeft(R,R.F[0],'kwFlt'),2,'2 s',1e-6);
});

test('KonWu / Weathered (2 within 3 m), Thick-Skinned (3 within 5 m), Rooted Feet (24%), Stubborn Stone (20%), Never Moved, Sky-Warden Drill',()=>{
  const L=kl(S(['gp_10_4','ru_10_1','gp_5_1','gp_4_4','gp_9_3','gp_8_3']),{foes:5}), {v,F}=L; v.wardenT=-1e6;
  at(L,F[1],20,0); at(L,F[3],0,6); at(L,F[4],20,6); near(inRatio(L,{src:F[0]}),1-0.075,'Weathered: 1.5% x 5 with 2 enemies within 3 m (F0, F3)');
  at(L,F[4],5.5,6); near(inRatio(L,{src:F[0]}),(1-0.075)*(1-0.05),'Thick-Skinned: 1% x 5 with 3 within 5 m'); at(L,F[3],0,9); at(L,F[4],20,6); near(inRatio(L,{src:F[0]}),1,'one near: neither');
  go(L); v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*0.76,'Rooted Feet: slows 8% x 3 weaker',1e-9);
  v.slow=0; v.wardenStk=4; V.cc(F[0],v,'fearT',2); near(v.fearT,1.4*0.80,'Stubborn Stone: 4% x 5 shorter',0.03); v.fearT=0;
  V.cc(F[0],v,'stunned',3); near(v.stunned,2.1*0.80,'a stun 20% shorter too (Discipline not full: no Never Moved)',0.03); v.stunned=0;
  v.wardenStk=5; V.step(1); assert.ok(v._gearImmovableT>0,'Never Moved: while Discipline is full he cannot be moved (the game\'s own "cannot be displaced" timer)');
  V.cc(F[0],v,'stunned',3); near(v.stunned,1,'and no stun on him lasts more than 1 s',0.03); v.stunned=2.5; V.step(1); assert.ok(v.stunned<=1+1e-9,'one written straight on is cut too');
  v.stunned=0; v.hp=v.maxHp*0.5; const h=v.hp; L.T.s.lim={}; secs(3.05); near(v.hp-h,0.015*v.maxHp,'Sky-Warden Drill: 0.3% x 5 of his max HP every 3 s while it is full',1e-6);
  v.wardenStk=4; const h2=v.hp; secs(3.1); near(v.hp-h2,0,'not while it is not',1e-9);
});

test('KonWu / The Mountain Comes Up (SIGNATURE): below 40% holding Greystone, 4 s no hit above 6% of his max HP; then every Greystone spent to Fault and stun within 5 m; not again until 30 s after it ends',()=>{
  const L=kl(S(['gp_13_3']),{foes:4,big:true}), {v,F}=L; for(const f of F) free(f); at(L,F[2],20,0); setStack(L,'kwGrey',4); v.wardenT=-1e6;
  v.hp=0.45*v.maxHp; V.step(2); assert.ok(!win(L,'kwMtn'),'not above 40% ('+JSON.stringify(L.T.s.kw)+' '+JSON.stringify(L.T.s.w.kwMtn)+' hp '+v.hp/v.maxHp+')'); near(inRatio(L,{src:F[0]},0.10*v.maxHp),1,'');
  v.hp=0.39*v.maxHp; V.step(1); assert.ok(win(L,'kwMtn'),'it comes up'); near(inRatio(L,{src:F[0]},0.10*v.maxHp),0.6,'a hit of 10% of his max HP takes 6%',1e-6); near(inRatio(L,{src:F[0]},0.03*v.maxHp),1,'a smaller one whole');
  near(inRatio(L,{src:F[0]},0.35*v.maxHp),0.30,'inside his 70% cap',1e-6);
  secs(3.9); assert.ok(win(L,'kwMtn'),'4 s'); secs(0.2); assert.ok(!win(L,'kwMtn')); assert.equal(stack(L,'kwGrey'),0,'every Greystone spent');
  assert.ok(mark(L,F[0],'kwFlt')&&mark(L,F[3],'kwFlt'),'every enemy within 5 m Faulted'); assert.ok(!mark(L,F[1],'kwFlt'),'(10 m: no)'); assert.ok(F[0].stunned>0.6&&F[0].stunned<0.85,'and stunned 0.2 s a Greystone (4): '+F[0].stunned); assert.ok(!mark(L,F[2],'kwFlt'),'not one 20 m away');
  setStack(L,'kwGrey',3); v.hp=0.6*v.maxHp; V.step(1); v.hp=0.3*v.maxHp; V.step(1); assert.ok(!win(L,'kwMtn'),'not again soon after');
  v.hp=0.6*v.maxHp; secs(29.5); v.hp=0.3*v.maxHp; V.step(1); assert.ok(!win(L,'kwMtn'),'(not 29.5 s after it ended)'); v.hp=0.6*v.maxHp; V.step(1); secs(0.6); v.hp=0.3*v.maxHp; V.step(1); assert.ok(win(L,'kwMtn'),'again once 30 s have passed');
  const N=kl(S(['gp_13_3']),{foes:2,big:true}); N.v.hp=0.6*N.v.maxHp; V.step(1); N.v.hp=0.3*N.v.maxHp; V.step(1); assert.ok(!win(N,'kwMtn'),'no Greystone: nothing');
});

/* ============================== RUYI AT HIS WORD ============================== */
test('KonWu / Swept: Clear the Path (2% x 3 slower attacks), Swept Aside, Dust in the Eyes, Swept Away, Swept Clean',()=>{
  const L=kl(S(['ru_1_1','ru_3_1','ru_6_1','ru_5_1','ru_12_2']),{foes:3}), {v,F}=L; const i0=F[0].atkInterval, c0=F[0].glyphCrit||0;
  arcAt(L,F[0]); assert.ok(mark(L,F[0],'kwSw'),'the enemy Cleaving Arc hits is Swept'); near(mkLeft(L,F[0],'kwSw'),3+2,'Swept Aside: 3 + 0.4 x 5 s',1e-6); V.step(1);
  near(F[0].atkInterval/i0,1/0.94,'it attacks 2% x 3 slower',1e-9); near((F[0].glyphCrit||0)-c0,-0.08,'Dust in the Eyes: 4% x 2 less critical chance',1e-9);
  near(ratio(L,F[0]),1.075,'Swept Away: 1.5% x 5 more from him'); v.hp=v.maxHp*0.5; const h=v.hp; kill(L,F[0]); V.step(1); near(v.hp-h,0.03*v.maxHp,'Swept Clean: 1% x 3 of his max HP when it dies',1e-6);
  secs(5.1); assert.ok(!mark(L,F[1],'kwSw'));
});

test('KonWu / Laughter: Belly Laugh (each kill of Cleaving Arc, 0.1 s x 5 off it each), Can\'t Stop Laughing, Heaven Laughs Back',()=>{
  const L=kl(S(['ru_2_3','ru_4_3','ru_8_3']),{foes:4}), {v,F}=L; const i0=v.atkInterval;
  F[0].hp=1; F[0].shield=0; arcAt(L,F[0]); assert.ok(!F[0].alive); assert.equal(stack(L,'kwLg'),1,'an arc kill: 1 Laughter'); near(FX.cd(v,'green',6),5.5,'0.1 s x 5 off Cleaving Arc each',1e-9);
  kill(L,F[1]); assert.equal(stack(L,'kwLg'),1,'not another kill'); V.step(1); near(i0/v.atkInterval,1.05,'Heaven Laughs Back: 1% x 5 attack speed each',1e-9);
  setStack(L,'kwLg',9); assert.equal(L.T.st.kwLg.max,6,'Can\'t Stop Laughing: up to 6'); V.wave(); V.step(1); assert.equal(stack(L,'kwLg'),0,'until the wave ends');
});

test('KonWu / Length: Grow (2 or more struck: 1 Length; 0.2 m and 1% x 5 each), Long Ruyi, At His Word, Wide World, Ruyi Shrinks, Ruyi Remembers, Ruyi Swells, Grown Strong, Full Length',()=>{
  const L=kl(S(['ru_1_4','ru_2_4','ru_3_4','ru_7_4','ru_6_4','ru_10_4','ru_11_3','ru_12_3','ru_8_4']),{foes:4,big:true}), {v,F}=L;
  assert.equal(stack(L,'kwLen'),5,'Ruyi Remembers: 1 x 5 Length at the wave\'s start'); setStack(L,'kwLen',0); V.step(1); const a0=v.dmg, i0=v.atkInterval;
  arcAt(L,F[0]); assert.equal(stack(L,'kwLen'),0,'one enemy struck: no Length'); at(L,F[3],4.0,1.2); arcAt(L,F[0]); assert.equal(stack(L,'kwLen'),1,'two struck: 1 Length');
  setStack(L,'kwLen',4); V.step(1); near(v.dmg/a0,1+0.02*4,'Wide World: 0.4% x 5 attack per Length',1e-9); near(v.atkInterval/i0,1.09,'Ruyi Shrinks: 3% x 3 faster only below 3 Length',1e-9);
  near(skillRatio(L,F[0],'cleavecone'),1.20,'Grow: Cleaving Arc 1% x 5 per Length (4)');
  const o=FX.kit(v,'cleavecone',Object.assign({},KO('green'))); L.T.s.cur=null; near(o.radius,KO('green').radius+4*0.2*V.METER,'0.2 m farther per Length',1e-9); assert.equal(o.angle,45,'At His Word: not below 5');
  setStack(L,'kwLen',5); const o2=FX.kit(v,'cleavecone',Object.assign({},KO('green'))); L.T.s.cur=null; assert.equal(o2.angle,70,'At His Word: 70 degrees at 5');
  assert.equal(L.T.st.kwLen.max,8,'Long Ruyi: up to 8'); setStack(L,'kwLen',8); near(skillRatio(L,F[0],'cleavecone'),1.40*1.10,'Ruyi Swells: 2% x 5 more at full Length');
  v.hp=v.maxHp*0.5; const h=v.hp; at(L,F[3],4.0,1.2); arcAt(L,F[0]); near(v.hp-h,0.02*2*v.maxHp,'Grown Strong: 0.4% x 5 of his max HP per enemy struck at full Length',1e-6);
  setStack(L,'kwLen',2); v.greenCd=5; slam(L); assert.equal(stack(L,'kwLen'),8,'Full Length: the slam grows Ruyi to full'); assert.equal(v.greenCd,0,'and Cleaving Arc is ready at once');
});

test('KonWu / Cleaving Arc: Staff Weight, Weight of Ruyi, Arc Heavy, Sweep Low (more than 3 m), Crowded Arc, Shrine Breaker (PICK ONE), Pebble in the Eye (PICK ONE) and Look at Me, Clean Through, Quick Arc',()=>{
  const L=kl(S(['nf_4_3','gp_4_2','ru_4_4','ru_4_2','ru_11_4','ru_5_3','ru_9_4','ru_9_1']),{foes:4,big:true}), {v,F}=L;
  near(FX.cd(v,'green',6),5.25,'Quick Arc: 0.15 s x 5',1e-9);
  F[0].hp=5e8; F[3].hp=9e8; at(L,F[0],4.5,0); at(L,F[3],2.8,0.8); const p0=plainHit(L,()=>lost(F[0],()=>V.cast(v,'green',F[0]))); at(L,F[0],4.5,0); at(L,F[3],2.8,0.8); const p3=plainHit(L,()=>lost(F[3],()=>V.cast(v,'green',F[0])));
  at(L,F[0],4.5,0); at(L,F[3],2.8,0.8); const h0=F[0].hp, h3=F[3].hp; V.cast(v,'green',F[0]); const t0=h0-F[0].hp, t3=h3-F[3].hp;
  const base=1.15*1.15*1.15*1.10; near(t0/p0,base*1.12,'4.5 m from his centre: Staff Weight 5% x 3, Weight of Ruyi 5% x 3, Arc Heavy 3% x 5, Crowded Arc 1% x 5 per enemy struck (2), Sweep Low 4% x 3',1e-6);
  near(t3/p3,base*1.25,'2.9 m: no Sweep Low; the most HP of those it strikes: Shrine Breaker 25%',1e-6);
  v.glyphCrit=0.5; brnd(0); at(L,F[0],4.5,0); at(L,F[3],-5,0); V.cast(v,'green',F[0]); brndBack(); v.glyphCrit=0; assert.ok(F[0].pullT>0&&F[0].pullSpeed>0,'Clean Through: its critical hits knock the enemy away'); near(Math.hypot(F[0].pulledBy.x-F[0].x,F[0].pulledBy.y-F[0].y)/V.METER,2,'2 m',1e-6);
  const M=kl(S(['ru_5_2','ru_6_2']),{foes:3}); arcAt(M,M.F[0]); assert.equal(M.F[0].forcedTarget,M.v,'Pebble in the Eye: it is taunted onto him'); near(M.F[0].forcedTargetT,1.6,'1 + 0.2 x 3 s',1e-9);
});

test('KonWu / Ruyi Touches the Sky (SIGNATURE): a full-Length arc reaches 10 m at 90 degrees, double damage, Sweeps 6 s, a Laughter per enemy; once every 20 s',()=>{
  const L=kl(S(['ru_13_3','ru_1_4','ru_2_3','ru_1_1']),{foes:4,big:true}), {v,F}=L; setStack(L,'kwLen',5); at(L,F[1],8.5,1.5); at(L,F[2],6,-3);
  const h0=F[0].hp, h1=F[1].hp; at(L,F[0],4.5,0); V.cast(v,'green',F[0]); const k=VMX('elemMul')(v,F[0])*(v.dmgBonusMul2||1)*dm(v,F[0],'phys'), base=1.5*v.dmg*VMX('skillMul')(10)*rage()*k;
  near(h0-F[0].hp,base*2*1.25,'double damage (Grow 1% x 5 a Length on top: 5 Length)',1e-6); assert.ok(F[1].hp<h1,'an enemy 8.6 m away is reached'); assert.ok(F[2].hp<F[2].maxHp,'and one 26 degrees off, inside 90');
  near(mkLeft(L,F[1],'kwSw'),6,'Swept 6 s',1e-6); assert.equal(stack(L,'kwLg'),3,'a Laughter for each enemy it hits (3)'); near(kw(L).skyCd,20,'once every 20 s',3e-3);
  const h2=F[1].hp; at(L,F[0],4.5,0); V.cast(v,'green',F[0]); near(h2-F[1].hp,0,'not again within 20 s: the usual reach');
});

test('KonWu / small talents: Quick Feet, Light Gold, Heaven-Forged Gold, Crack in Everything, Iron Core, Weakest First, Ruyi Swing, Spinning Staff, Discipline in Motion, Stand in the Middle',()=>{
  const L=kl(S(['nf_2_3','ru_2_2','nf_3_3','gp_9_2','ru_3_2','nf_7_1','nf_7_3','ru_6_3','ru_11_2','ru_12_1']),{foes:5}), {v,F}=L; v.wardenT=-1e6; v.wardenStk=0; at(L,F[4],15,6); V.step(1);
  near(L.T.s.ap.move,1.18,'Quick Feet 3% x 3 and Light Gold 3% x 3',1e-9);
  const ph=F[1]; ph.armorRating=600; const a=lost(ph,()=>V.hit(v,ph,1000,{kind:'phys'})), b=plainHit(L,()=>lost(ph,()=>V.hit(v,ph,1000,{kind:'phys'})));
  const d0=dm(v,ph,'phys'), dx=x=>{ const sv=v._wpnArmIgn; v._wpnArmIgn=x; const r=dm(v,ph,'phys'); v._wpnArmIgn=sv; return r/d0; }; near(a/b,dx(0.10)**3,'three 2% x 5 armour-ignore talents, each on its own',1e-6);
  F[0].hp=F[0].maxHp*0.49; near(ratio(L,F[0]),1.10,'Weakest First 2% x 5 below 50%'); near(ratio(L,F[1],{auto:true}),1.10*1.10,'Ruyi Swing 2% x 5 and Spinning Staff 2% x 5 on basic attacks');
  const a0=v.dmg; v.wardenStk=4; V.step(1); near(v.dmg/a0,1+0.015*4,'Discipline in Motion: 0.3% x 5 attack per Adamant Discipline stack',1e-9);
  const i0=v.atkInterval; at(L,F[3],0,6); at(L,F[4],5.5,6); V.step(1); near(i0/v.atkInterval,1.08,'Stand in the Middle: 4% x 2 faster with 3 enemies within 5 m',1e-9); at(L,F[4],15,6); V.step(1); near(i0/v.atkInterval,1,'',1e-9);
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('KonWu: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['nf_1_1','nf_1_4','nf_2_2','gp_1_4','gp_1_1','gp_3_4','ru_1_1','ru_1_4','ru_2_3']), TEAM=['vael','sylthaine','vireo','vex','konwu'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let ins=false,flt=false,sw=false,hl=0;
  for(let i=0;i<3000&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.kwIns) ins=true; if(o.kwFlt) flt=true; if(o.kwSw) sw=true; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', Insulted '+ins+', Faulted '+flt+', Swept '+sw);
  assert.ok(ins,'a real Insult'); assert.ok(mx.kwGrey>=1,'real Greystone'); assert.ok(flt,'a real Fault'); assert.ok(sw,'a real Sweep'); assert.ok(mx.kwHs>=1,'real Head Start');
  determinism(H,TEAM);
});

/* The page sites his talents added (konwuBlinkExec: whom he lands behind; konwuKickExec: landPre / land around the kick's hit, pass at its end): with nothing
   learned, whole seeded fights with KonWu in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('KonWu: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['konwu','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','hollow','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __kwN={blink:0,kick:0,end:0}; var __kwB=konwuBlinkExec, __kwK2=konwuKickExec;'+
    'konwuBlinkExec=function(u){ if(u&&u.key==="konwu"&&u._blinkO) __kwN.blink++; return __kwB.apply(this,arguments); };'+
    'konwuKickExec=function(u){ const tg=u._kickTg; if(u&&u.key==="konwu"){ __kwN.kick++; } const r=__kwK2.apply(this,arguments); if(u&&u.key==="konwu"&&(u._chaseT||0)>0&&u._chaseTg===tg) __kwN.end++; return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__kwN'); console.log('  identity / sites reached: '+JSON.stringify(c));
    assert.ok(c.blink>0&&c.kick>0&&c.end>0,'the fights blinked him behind a mark (skillTgt), kicked (landPre / land) and finished kicks (pass): every new site was run'); }
  finally{ VMX('konwuBlinkExec=__kwB; konwuKickExec=__kwK2;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction; his most defensive legal build: the worst possible hit under 90%, and well under half a fight at 85%
   or more. His damage-reduction talents (and armour / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is
   reduced most. */
const DEF={ gp:['gp_1_4','gp_n1','gp_6_4','gp_10_4','gp_12_4','gp_13_3','gp_3_2','gp_5_4','gp_2_2','gp_1_3','gp_4_3','gp_5_2','gp_6_2'],
            gq:['gp_1_4','gp_n1','gp_6_4','gp_10_4','gp_12_4','gp_13_3','gp_3_2','gp_5_4','gp_2_2','gp_1_3','gp_4_3','gp_5_3'],
            nf:['nf_5_4','nf_8_3','nf_1_4'], ru:['ru_10_1','ru_8_2'] };
const TI={gp:1,gq:1,nf:0,ru:2};
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks&&!(meta(x).lock&&(b.r[meta(x).lock]|0)>0))) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (full Greystone, Discipline full at passive level 100, the attacker Insulted
   and Faulted, 3 enemies within 3 m, the signature's 4 s, a Skid when he can Skid, a hit far above Granite's cap); sustained: a usual state (5 Greystone,
   Discipline full, one enemy near, nothing on the attacker, no Skid, no signature, a basic attack of 5% of his max HP). Measured through the engine */
function worstHit(list,kind,crit,sustained){ const L=kl(list,{foes:5}), {v,F}=L; const f=F[0];
  v.skillLv=[100,100,100,100]; v.passMul=VMX('skillMul')(100); v.maxHp=1e5; v.hp=sustained?8e4:3e4; v.wardenStk=5; v.shield=0;
  if(L.T){ setStack(L,'kwGrey',sustained?Math.min(5,L.T.st.kwGrey.max):L.T.st.kwGrey.max);
    if(!sustained){ setMk(L,f,'kwIns'); setMk(L,f,'kwFlt'); if(L.T.P.mtn) L.T.s.w.kwMtn={t:3,n:1,cdT:0,at:-1,wave:false}; } }
  if(!sustained){ at(L,F[3],0,5.5); at(L,F[1],-4,2); } else { at(L,F[1],-8,12); at(L,F[3],-4,18); at(L,F[4],6,20); }
  for(const x of F) x.stunned=1e6; brnd(sustained?0.999:0); const raw=sustained?5e3:6e4, au=!!sustained;   // the worst: a Skid when he can Skid; sustained: none
  let x; try{ x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:au})); } finally{ brndBack(); }
  const cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('KonWu: his most defensive legal 91-point build never takes 90% off a hit, and never sits near the ceiling in seeded fights',()=>{
  const cands=[[['gp','nf'],[61,30]],[['gp'],[91]],[['gq','nf'],[61,30]],[['gp','ru'],[61,30]],[['gq'],[91]],[['nf','gp'],[61,30]],[['ru','gp'],[61,30]]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="konwu"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="konwu"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const T=u._tal; if(T&&T.fn.drK&&T.s.api){ const e=units.find(x=>x.team!==u.team&&x.alive); if(e){ const k=T.fn.drK(T.s.api,T,u,e,0.1*u.maxHp,false), w=(u.pass&&u.pass.warden&&u.wardenStk)?wardenCut(u):0; const tot=1-k*(1-w)*Math.min(defMul(e,u,"phys"),defMul(e,u,"magic")); if(tot>=0.85) __dr.tHi++; } } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','konwu'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+' ('+(100*d.hi/Math.max(1,d.n)).toFixed(1)+'% of hits); at the ceiling '+d.at+'; ticks at 85% or more against a 10% hit '+d.tHi+' of '+d.ticks+' ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%); immune '+d.imm);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.25*d.n,'85% or more on well under half of the hits'); assert.ok(d.tHi<0.25*d.ticks,'85% or more for well under half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
