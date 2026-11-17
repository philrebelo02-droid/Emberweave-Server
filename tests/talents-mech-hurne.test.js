'use strict';
/* Hurne's talents as data on the mechanics layer (talents-mech/hurne.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling and the stun-lock rule.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit / plainS) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Hurne, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). Bodies: Hurne 1.74 m, a Vael 2.01 m.
   His summons are raised here with the page's own summonUnit (raise()): his summon hook runs as for his skills; they are held (stunned) and set down at a
   stated gap (body to body) from him. Feed Them's rupture measures 3 m from his CENTRE today and reaches nobody in real fights (93 of 93 casts in the
   reach audit); release v1391 measures it to the enemy's body edge. Its talent tests put the enemy 2.5 m from his centre, inside the reach both today
   and after that fix, so they test the burst as it will land.
   Run: node --test tests/talents-mech-hurne.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='hurne', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const plainS=(x,fn)=>{ const o=x._talS; x._talS=undefined; try{ return fn(); } finally{ x._talS=o; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const ust=(L,t,name)=>{ if(L.T&&L.T.s.hApi) return L.T.s.hApi.ustGet(L.T,L.v,t,name); const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&m.until>V.now()-1e-9)?m.v:0; };   // the engine's own read (Smoulder fades a stack at a time)
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const lv1=(...xs)=>{ for(const x of xs) x.level=1; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/V.METER-V.bodyR(a)-V.bodyR(b);
/* set u down g metres (body to body) from b, in direction (dx,dy) */
const atGap=(u,b,g,dx,dy)=>{ const L=Math.hypot(dx,dy)||1, d=(g+V.bodyR(u)+V.bodyR(b))*V.METER; u.x=b.x+dx/L*d; u.y=b.y+dy/L*d; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage)
const kill=t=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const clk=(L,key)=>{ const l=L.T.s.lim[key]; if(l) l.acc=0; };
const WK='boar warrior', SK='boar shaman';
/* one of his summons, made by the page's own summonUnit (his summon hook runs), out of the ground at once, held, set down g m from him in direction (dx,dy) */
function raise(L,key,g,dx,dy,o){ o=o||{}; const x=VMX('summonUnit')(L.v,key,o.dur||15,{a:0,r:1.7*V.METER,share:1}); if(!x) return null; x._riseT=0; x.stunned=1e6; x.atkCd=1e9;
  if(g!=null) atGap(x,L.v,g,dx==null?-1:dx,dy==null?0:dy); return x; }
const mine=L=>VMX('units').filter(x=>x.alive&&x._summonOwner===L.v);
/* a hit of his while a skill of his resolves, against the same hit with his talents off */
function ratio(L,t,cur,o){ o=o||{}; const s=L.T.s, c0=s.cur; s.cur=cur; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o))); } finally{ s.cur=c0; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o)))); }
/* a summon's hit, against the same hit with his rows off for it */
const sRatio=(x,t,o)=>lost(t,()=>V.hit(x,t,1000,Object.assign({kind:'true',auto:true},o||{})))/plainS(x,()=>lost(t,()=>V.hit(x,t,1000,Object.assign({kind:'true',auto:true},o||{}))));
/* an enemy's hit on him, against the same hit with his rows off */
const inRatio=(L,o)=>hitOn(L,L.v,1000,o)/plainHit(L,()=>hitOn(L,L.v,1000,o));
const sInRatio=(L,x,o)=>hitOn(L,x,1000,o)/plainHit(L,()=>{ const W=x._talW; x._talW=null; try{ return hitOn(L,x,1000,o); } finally{ x._talW=W; } });
const pm=L=>0.05*(L.v.passMul||1);
const ULT=()=>VMX('ULT_DEF').devourpack;
function feed(L){ V.cast(L.v,'ult'); }

test('Hurne: every talent is accounted for - 10 plain stats, 106 with rows, none waiting',()=>{
  accounting(H,[116,10,106,0,0]);
  for(const id of ['sw_7_4','sw_9_2','sw_1_2','ft_1_4','ft_6_1','ft_4_3','br_1_3','br_12_1','br_9_3','br_11_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['sw_10_3','ft_7_3','br_7_3']) assert.ok(!FXN.has(H,id),id+': a crit chance talent of the capped group, not a plain stat');
  assert.equal(T.talent(H,'ft_6_2').name,'Supper Table'); assert.equal(T.talent(H,'ft_4_2').name,'Torn Open'); assert.equal(T.talent(H,'br_9_4').name,'Ash Underfoot');
});

test('Hurne: his real kit, as the talents read it - Unchain the Dead, Call the Bone-Chanter, Feed Them, Packmaster',()=>{
  plain({foes:3},P=>{ const {v,F}=P; lv1(...F);
    V.cast(v,'green'); secs(1.5); const W=mine(P).filter(x=>x.key===WK); assert.equal(W.length,3,'Unchain the Dead: 3 boar warriors');
    near(W[0].maxHp,Math.round(v.maxHp*0.55*VMX('skLvNum')('summonwarriors',v.greenAb,10)),'55% of his max HP x the skill level\'s share',1e-9); assert.ok(W[0]._summonT>13&&W[0]._summonT<=15,'for 15 s');
    V.cast(v,'blue'); secs(1.5); assert.equal(mine(P).filter(x=>x.key===SK).length,1,'Call the Bone-Chanter: one boar shaman');
    for(const x of mine(P)){ x._riseT=0; x.stunned=1e6; }
    const n=mine(P).length; v.hp=v.maxHp*0.5; const h0=v.hp, f0=F[0].hp; feed(P);
    near(F[0].hp,f0,'Feed Them\'s rupture: 3 m from his centre, so not an enemy 4.5 m from it (0.75 m body to body: it reaches nobody today)');
    assert.equal(mine(P).length,0,'it takes every summon'); near(v.dmgBuffMul,1+0.10+0.03*n,'+10% damage, +3% for each one taken'); near(v.drMul,1-(0.10+0.03*n),'and the one damage-reduction slot');
    assert.ok(v.hp>h0,'he heals'); assert.ok(v.shield>0,'a shield'); near(v._devourT,ULT().dur,'and carries their strength for 8 s'); });
  plain({foes:3},P=>{ const {v,F}=P; at(P,F[0],2.5,0); const f0=F[0].hp; feed(P); assert.equal(F[0].hp,f0,'with no summon to take, Feed Them only buffs him: no rupture');
    raise(P,WK,3,0,-1); V.step(1); at(P,F[0],2.5,0); feed(P); assert.ok(F[0].hp<f0,'with a pack: an enemy 2.5 m from his centre is hit (inside the reach today and after v1391)'); });
  plain({foes:3},P=>{ const {v,F}=P; const a0=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})); raise(P,WK,3); raise(P,WK,3,0,1); V.step(1);
    near(lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true'})),a0*(1+2*pm(P)),'Packmaster: his hits x(1 + 0.05 x passMul per summon)');
    near(hitOn(P,v,1000),1000/(1+2*pm(P)),'hits on him / (1 + 0.05 x passMul per summon)'); console.log('  kit: Packmaster '+(pm(P)*100).toFixed(2)+'% per summon at skill level 10'); });
});

/* ============================== THE SWINEHERD ============================== */
test('Hurne / Driven: Point the Way, Drive Them, Whistle, Mark for the Herd; his summons turn on it (a taunt on them still comes first)',()=>{
  const L=lab(H,S(['sw_1_1','sw_3_1','sw_5_1','sw_7_1']),{foes:3}), {v,F}=L; const w=raise(L,WK,2), w2=raise(L,WK,2,0,1); V.step(1);
  const mv0=F[1].speed, ar0=F[1].armorRating; V.hit(v,F[1],1,{kind:'true'}); assert.ok(mark(L,F[1],'hDrv'),'the enemy he hit last is Driven'); V.step(2);
  assert.equal(w.forcedTarget,F[1],'his summons turn on it'); near(F[1].speed,mv0*0.85,'Whistle: 3% x 5 slower'); near(F[1].armorRating,ar0*0.94,'Mark for the Herd: 2% x 3 less armor');
  near(sRatio(w,F[1]),1.09,'Point the Way: his summons 3% x 3 more to it'); near(sRatio(w,F[2]),1,'not to another'); near(ratio(L,F[1],null),1.10,'Drive Them: him 2% x 5 more to it');
  w2.forcedTarget=F[2]; w2.forcedTargetT=3; V.step(2); assert.equal(w2.forcedTarget,F[2],'a summon taunted by an enemy goes on hitting that enemy first');
  V.hit(v,F[2],1,{kind:'true'}); assert.ok(mark(L,F[2],'hDrv')&&!mark(L,F[1],'hDrv'),'one Driven at a time: the last one he hit'); V.step(2); near(F[1].speed,mv0,'the old one gets its speed back');
});

test('Hurne / Driven Hard, Whole Valley, Run It Down',()=>{
  const L=lab(H,S(['sw_1_1','sw_10_1','sw_12_1','sw_7_1','sw_9_1']),{foes:3}), {v,F}=L; const w=raise(L,WK,2), w2=raise(L,WK,2,0,1); V.step(1); const ai=v.atkInterval;
  V.hit(v,F[1],1,{kind:'true'}); V.step(2); near(ai/v.atkInterval,1+2*0.025,'Driven Hard: 0.5% x 5 attack speed for each summon attacking the Driven enemy (2)');
  kill(F[1]); V.step(1); assert.ok(mark(L,F[0],'hDrv'),'Whole Valley: the enemy nearest the dead one becomes Driven'); assert.ok(win(L,'hWv'),'and his summons are quicker for 3 s');
  secs(3.1); assert.ok(!win(L,'hWv'),'3 s');
  const L2=lab(H,S(['sw_1_1','sw_7_1','sw_9_1']),{foes:3}); V.hit(L2.v,L2.F[2],1,{kind:'true'}); V.step(1);
  const x=VMX('summonUnit')(L2.v,WK,15,{a:0,r:1.7*V.METER,share:1}); assert.ok(gap(x,L2.F[2])<0.5,'Run It Down: a warrior of Unchain the Dead claws up beside the Driven enemy: '+gap(x,L2.F[2]).toFixed(2));
});

test('Hurne / Whole Valley: his summons attack 5% x 2 faster for 3 s',()=>{
  const L=lab(H,S(['sw_1_1','sw_10_1','sw_12_1']),{foes:3}), {v,F}=L; const w=raise(L,WK,2); V.step(2); const a0=w.atkInterval;
  V.hit(v,F[1],1,{kind:'true'}); kill(F[1]); V.step(2); near(a0/w.atkInterval,1.10,'Whole Valley: 5% x 2 faster'); secs(3.2); near(w.atkInterval,a0,'for 3 s');
});

test('Hurne / Kept Close: Bring Them In, Short Tether, Patient Man, Fed Well',()=>{
  const L=lab(H,S(['sw_1_4','sw_2_4','sw_5_4','sw_6_4']),{foes:3}), {v,F}=L; const w=raise(L,WK,5.4), w2=raise(L,WK,5.8,0,1); V.step(1); const mr0=v.mrRating;
  atGap(w,v,5.4,-1,0); atGap(w2,v,5.8,0,1); near(sRatio(w,F[1]),1.10,'Bring Them In: 2% x 5 more within 4 m + Short Tether 0.5 m x 3 = 5.5 m (body to body): 5.4 m'); near(sRatio(w2,F[1]),1,'not beyond it');
  near(v.mrRating,mr0,'Patient Man: not with one Kept Close'); atGap(w2,v,3,0,1); V.step(2); near(v.mrRating,mr0*1.10,'with 2: 2% x 5 more magic resist');
  w.hp=w.maxHp*0.5; clk(L,'sw_6_4#0'); const h=w.hp; secs(1.05); near(w.hp-h,w.maxHp*0.012,'Fed Well: 0.4% x 3 of its max HP a second (1.2%: the regeneration cap)',1e-6);
  atGap(w,v,8,0,-1); w.hp=w.maxHp*0.5; clk(L,'sw_6_4#0'); const h2=w.hp; secs(1.05); near(w.hp,h2,'not a summon beyond the tether');
});

test('Hurne / Packmaster: Packmaster\'s Weight, Stand Before Them, Stay Together, Nothing Left to Lose (his damage reduction at most 40%)',()=>{
  const L=lab(H,S(['sw_1_4','sw_2_4','sw_3_4','sw_10_4','br_2_2']),{foes:3}), {v,F}=L; raise(L,WK,2); raise(L,WK,2,0,1); raise(L,WK,9,0,-1); V.step(1);
  const b=pm(L), N=3, K=2; near(ratio(L,F[1],null),(1+(N+K)*(b+0.025))/(1+N*b),'his hits: Kept Close summons count twice (Stay Together), 0.5% x 5 more each (Packmaster\'s Weight)');
  near(inRatio(L),(1+N*b)/(1+(N+K)*(b+0.05)),'hits on him: and Stand Before Them\'s 0.5% x 5 more shrugged off',1e-6);
  const L2=lab(H,S(['ft_10_1','ft_11_1','ft_1_1']),{foes:3}); V.step(1); const b2=pm(L2); setStack(L2,'hCost',4); V.step(1); near(ratio(L2,L2.F[1],null),1,'Nothing Left to Lose: not below 5 Cost');
  setStack(L2,'hCost',5); V.step(1); near(ratio(L2,L2.F[1],null),(1+3*b2)/1*1,'at 5 Cost Packmaster counts him as 3 summons',1e-6);
  near(inRatio(L2),1/(1+3*b2),'(and shrugs off for 3)',1e-6);
  const L3=lab(H,S(['sw_8_4','ft_8_1','br_8_1','sw_3_4','sw_10_4','br_2_2']),{foes:3}); for(let i=0;i<6;i++) raise(L3,WK,1,i%2?0:-1,i%2?1:0); raise(L3,SK,1,0,-1); raise(L3,SK,1,-1,-1); V.step(1);
  near(inRatio(L3),0.60,'all together his damage reduction talents take at most 40% off a hit',1e-6);
});

test('Hurne / his warriors: Armoured Herd, Iron Tusks, Three Strong, Old Boars, Called Back and Fed Herd',()=>{
  let hp0, d0; plain({foes:3},P=>{ const x=raise(P,WK,2); hp0=x.maxHp; d0=x.dmg; });
  const L=lab(H,S(['sw_2_3','sw_4_3','sw_5_2','sw_6_2','sw_8_3','br_6_2']),{foes:3}), {v,F}=L; const x=raise(L,WK,2); V.step(1);
  near(x.maxHp,hp0*1.10*1.2,'Armoured Herd 2% x 5 and Three Strong 20% more max HP',1e-6); near(x.dmg,d0*1.2,'Three Strong 20% more attack',1e-6);
  near(sRatio(x,F[1]),1.12,'Iron Tusks: 4% x 3 more damage'); near(sInRatio(L,x),0.91,'Old Boars: Three Strong\'s warriors take 3% x 3 less',1e-6);
  near(FX.kit(v,'summonwarriors',{dur:15,n:3}).dur,20,'Called Back 0.5 s x 5 + Fed Herd 0.5 s x 5',1e-9); L.T.s.cur=null;
  V.cast(v,'green'); secs(1.5); const W=mine(L).filter(w=>w!==x); assert.ok(W.length>=1); assert.ok(W[0]._summonT>15.5&&W[0]._summonT<=20,'Called Back 0.5 s x 5 + Fed Herd 0.5 s x 5: 20 s: '+W[0]._summonT);
});

test('Hurne / Four of Them (PICK ONE): 4 warriors, each 15% weaker; the cap of 6 holds',()=>{
  let hp0; plain({foes:3},P=>{ hp0=raise(P,WK,2).maxHp; });
  const L=lab(H,S(['sw_2_3','sw_4_3','sw_5_3']),{foes:3}), {v}=L; assert.equal(FX.kit(v,'summonwarriors',{dur:15,n:3}).n,4,''); L.T.s.cur=null; V.cast(v,'green'); secs(1.5); const W=mine(L).filter(x=>x.key===WK); assert.equal(W.length,4,'4 warriors');
  near(W[0].maxHp,Math.round(v.maxHp*0.55*VMX('skLvNum')('summonwarriors',v.greenAb,10))*1.10*0.85,'each 15% weaker',1e-3);
  V.cast(v,'green'); secs(1.5); assert.equal(mine(L).filter(x=>x.key===WK).length,6,'the game\'s limit of 6 warriors holds');
});

test('Hurne / cooldowns and lengths: Quick Unchaining, Shallow Grave, Sow\'s Patience, Bone Fire, Bone Song',()=>{
  const L=lab(H,S(['sw_7_2','ft_10_2','sw_8_2','br_4_3','sw_6_3']),{foes:3}), {v}=L;
  near(FX.cd(v,'green',12),12-1-0.9,'Unchain the Dead: 0.2 x 5 + 0.3 x 3 s shorter',1e-9); near(FX.cd(v,'blue',14),14-1.2-1.2,'Call the Bone-Chanter: 0.4 x 3 + 0.4 x 3 s shorter',1e-9);
  near(FX.kit(v,'summonshaman',{dur:18}).dur,20,'Bone Song: the old sow stays 0.4 s x 5 longer',1e-9); L.T.s.cur=null;
  V.cast(v,'blue'); secs(1.5); const s=mine(L).find(x=>x.key===SK); assert.ok(s&&s._summonT>18&&s._summonT<=20,'as she is called: '+(s&&s._summonT));
});

test('Hurne / Herd Instinct (a summon KILLED) and Good at It',()=>{
  const L=lab(H,S(['sw_6_1','sw_12_2']),{foes:3}), {v,F}=L; const w=raise(L,WK,2), w2=raise(L,WK,2,0,1); V.step(2); const a0=w.atkInterval;
  VMX('killSummon')(w2); V.step(2); near(w.atkInterval,a0,'Herd Instinct: not a summon that runs out of time or is taken');
  const w3=raise(L,WK,2,0,-1); V.step(1); kill(w3); V.step(2); near(a0/w.atkInterval,1.10,'a summon killed: the others 5% x 2 faster'); secs(4.1); near(w.atkInterval,a0,'for 4 s');
  v.hp=v.maxHp*0.5; const h=v.hp; F[1].hp=1; F[1].shield=0; V.hit(w,F[1],100,{kind:'true',auto:true}); assert.ok(!F[1].alive); near(v.hp-h,v.maxHp*0.03,'Good at It: a summon\'s kill heals him 1% x 3 of his max HP',1e-6);
});

test('Hurne / the Bone-Chanter\'s heals: Old Sow\'s Care, Old Sow\'s Heat, The Whole Herd (and its warrior)',()=>{
  let r0; plain({foes:3,allies:1},P=>{ const {v,A}=P; const s=raise(P,SK,2,0,-1); V.step(1); A[0].hp=A[0].maxHp*0.5; atGap(A[0],s,0.5,0,-1); A[0].x=s.x; A[0].y=s.y+3*V.METER;
    V.cast(s,'green'); const h=VMX('groundHazards').find(z=>z.chant&&z.src===s); assert.ok(h,'Bone Chant: her circle'); const a=A[0].hp; secs(2.7); r0=(A[0].hp-a)/h.heal; });
  const L=lab(H,S(['sw_4_2','br_6_4','sw_11_3']),{foes:3,allies:1}), {v,A}=L; let W0=mine(L).length; const s=raise(L,SK,2,0,-1); V.step(1);
  assert.equal(mine(L).filter(x=>x.key===WK).length-W0+0,1,'The Whole Herd: one boar warrior comes up with her'); const w=mine(L).find(x=>x.key===WK); w._riseT=0; atGap(w,v,30,1,0); w.stunned=1e6;
  A[0].hp=A[0].maxHp*0.5; A[0].x=s.x; A[0].y=s.y+3*V.METER; w.hp=w.maxHp*0.5;
  V.cast(s,'green'); const h=VMX('groundHazards').find(z=>z.chant&&z.src===s), a=A[0].hp, wh=w.hp; secs(2.7);
  near((A[0].hp-a)/h.heal,r0*(1+0.12+0.10),'Old Sow\'s Care 4% x 3 and Old Sow\'s Heat 5% x 2 more',1e-6); assert.ok(w.hp>wh,'and her healing reaches a summon of his far from her circle');
  near((w.hp-wh)/h.heal,(A[0].hp-a)/h.heal,'the heal it would get inside, made stronger as hers are',1e-6);
});

test('Hurne / his summons\' damage reduction: The Chains, Wall of Herd, She Tends Them, Shoulder to Shoulder, Between Them (at most 50%)',()=>{
  const L=lab(H,S(['br_1_1','br_4_2','sw_12_3','br_8_2']),{foes:3}), {v,F}=L; const w=raise(L,WK,2), far=raise(L,WK,5,0,1); V.step(1);
  near(sInRatio(L,w),0.91*0.90,'Wall of Herd 3% x 3, Shoulder to Shoulder 2% x 5 (within 3 m of him)',1e-6); near(sInRatio(L,far),0.91,'Shoulder to Shoulder: not beyond 3 m',1e-6);
  raise(L,SK,6,0,-1); V.step(1); near(sInRatio(L,far),0.91*0.95,'She Tends Them: warriors 1% x 5 less while a Bone-Chanter stands',1e-6);
  setMk(L,F[0],'hCh'); near(sInRatio(L,far),0.91*0.95*(1-0.075),'The Chains: a Chained enemy deals 1.5% x 5 less to his summons',1e-6);
  const L2=lab(H,S(['br_11_2','br_12_2','br_4_2','br_8_2','br_1_1']),{foes:3}), v2=L2.v; const b=raise(L2,WK,1,-1,0); V.step(1); const b2=pm(L2), N=1;
  near(sInRatio(L2,b),Math.max(0.5,0.91*0.90/(1+N*b2)),'Between Them: a summon within 3 m behind him - Packmaster\'s shrug covers his summons',1e-6);
  near(inRatio(L2),0.95,'The Road Is Closed: him 1% x 5 less while it covers them',1e-6);
  atGap(b,v2,1,1,0); V.step(1); near(inRatio(L2),1,'not with the summon in front of him (toward the enemies)',1e-6);
  for(let i=0;i<6;i++) raise(L2,WK,1,-1,i*0.3); atGap(b,v2,1,-1,0); v2.passMul=2.2; V.step(1); setMk(L2,L2.F[0],'hCh'); near(sInRatio(L2,b),0.5,'together at most 50% less',1e-6);
});

test('Hurne / Nobody Walks Around (SIGNATURE): the herd charges the Driven enemy - one stun (the stun-lock rule), 6 s at 1 HP at least, once every 25 s',()=>{
  const L=lab(H,S(['sw_1_1','sw_13_3']),{foes:3}), {v,F}=L; const W=[0,1,2].map(i=>raise(L,WK,1,-1,i-1)); V.step(1); V.hit(v,F[1],1,{kind:'true'}); F[1].stunned=0; V.step(2); assert.ok(!win(L,'hNwa'),'not with 3 Kept Close (an enemy Driven)'); assert.ok(!(L.T.s.hStL||[]).length,'');
  const x4=raise(L,WK,1,0,1); V.hit(v,F[1],1,{kind:'true'}); lv1(F[1]); F[1].stunned=0; const h=F[1].hp; const g0=W.concat([x4]).map(x=>gap(x,F[1])); V.step(1);
  assert.ok(win(L,'hNwa'),'4 Kept Close and a Driven enemy: the herd charges'); near(h-F[1].hp,W.concat([x4]).reduce((a,x)=>a+x.dmg,0),'each summon lands a hit for 100% of its attack',1e-6);
  W.concat([x4]).forEach((x,i)=>assert.ok(gap(x,F[1])<g0[i]-1,'every summon set down beside it (bodies then push apart): '+gap(x,F[1]).toFixed(2)+' from '+g0[i].toFixed(2))); near(F[1].stunned,0.3,'stunned 0.3 s - once: a stunned enemy is not stunned again',0.05);
  const L0=L.T.s.hStL; assert.equal(L0.length,1,'one stun lands'); near(L.T.s.lim['sw_13_3#0'].t-L0[0][1],25,'once every 25 s (its own clock)',1e-6); const A=L.T.s.hApi, c={u:v,src:v};
  const t0=L0[0][1]+L0[0][2]; F[1].stunned=0; while(V.now()<t0+0.4) V.step(1); L.T.fn.charge(A,L.T,v,c); assert.equal(L0.length,1,'not within 0.5 s after his stun ended');
  F[1].stunned=0; while(V.now()<t0+0.53) V.step(1); L.T.fn.charge(A,L.T,v,c); assert.equal(L0.length,2,'0.5 s after it, a stun again'); F[1].stunned=0;
  const w=W[0]; w.hp=5; w.shield=0; hitOn(L,w,1e6); assert.ok(w.alive&&w.hp>=1,'for 6 s the herd cannot drop below 1 HP'); secs(6.1); w.hp=5; hitOn(L,w,1e6); assert.ok(!w.alive,'then it can');
  mine(L).forEach((x,i)=>{ x.hp=x.maxHp; atGap(x,v,1,-1,i*0.4-1); }); V.hit(v,F[1],1,{kind:'true'}); F[1].stunned=0; secs(10); assert.equal(L.T.s.hStL.length,2,'not again within 25 s');
});

/* ============================== FEED THEM ============================== */
test('Hurne / Cost: What It Costs, Pay Gladly, Cost Taken (at most 5, for the fight); Overfed at 5',()=>{
  const L=lab(H,S(['ft_1_1','ft_2_1','ft_10_1','ft_3_1']),{foes:3}), {v,F}=L; const a0=v.dmg, ls0=v.lifestealStat||0, hp0=v.maxHp;
  feed(L); V.step(1); assert.equal(stack(L,'hCost'),1,'each Feed Them pays 1 Cost'); near(v.dmg,a0*1.06,'What It Costs: 2% x 3 attack per Cost');
  for(let i=0;i<6;i++) feed(L); V.step(1); assert.equal(stack(L,'hCost'),5,'at most 5'); near(v.dmg,a0*1.30,'30%'); near((v.lifestealStat||0)-ls0,0.075,'Pay Gladly: 0.5% x 3 lifesteal per Cost'); near(v.maxHp,hp0*1.075,'Cost Taken: 0.3% x 5 max HP per Cost');
  V.wave(); V.step(1); assert.equal(stack(L,'hCost'),5,'for the fight, not the wave');
  /* talents-fix1: since v1391 the rupture reaches to the enemy's body edge - F0 at 5.6 m (a 3.59 m gap) is outside 3 m and inside 5 m */
  setStack(L,'hCost',4); raise(L,WK,3,0,-1); V.step(1); at(L,F[0],5.6,0); const f=F[0].hp; feed(L); assert.equal(F[0].hp,f,'Overfed: not at 4 Cost (3 m to the body edge)');
  raise(L,WK,3,0,-1); V.step(1); at(L,F[0],5.6,0); feed(L); assert.ok(F[0].hp<f,'at 5 Cost the rupture reaches 5 m (to the body edge, v1391)');
});

test('Hurne / Smoke of the Feast (LINK): 4% more for each Cost; with Her Young, 2 Smoulder on each enemy hit',()=>{
  const L=lab(H,S(['ft_n1']),{foes:3}), {v,F}=L; setStack(L,'hCost',3); near(ratio(L,F[1],'devourpack'),1.12,'4% x 3 Cost'); near(ratio(L,F[1],null),1,'not his basic attacks');
  raise(L,WK,3,0,-1); V.step(1); at(L,F[0],2.5,0); feed(L); near(ust(L,F[0],'hSmo'),0,'no Smoulder without Her Young');
  const L2=lab(H,S(['ft_n1','br_1_4']),{foes:3}); raise(L2,WK,3,0,-1); V.step(1); at(L2,L2.F[0],2.5,0); feed(L2); near(ust(L2,L2.F[0],'hSmo'),2,'with Her Young: 2 Smoulder, no Bone-Chanter needed');
});

test('Hurne / Carried: Carry Their Strength, Heavy With Them, Old Oath, Stored Herd, Take Them All, Nothing Wasted; until the wave ends',()=>{
  const L=lab(H,S(['ft_1_2','ft_2_2','ft_5_1','ft_11_2','ft_5_3','ft_6_3']),{foes:3}), {v,F}=L; const mr0=v.mrRating, ai=v.atkInterval;
  raise(L,WK,3); raise(L,WK,3,0,1); raise(L,SK,3,0,-1); V.step(1); const sh0=v.shield||0; feed(L); V.step(1);
  assert.equal(stack(L,'hCar'),4,'1 Carried for each summon taken, 2 for the Bone-Chanter (Take Them All)'); assert.ok(v.shield>sh0,'');
  near(ratio(L,F[1],null),1+0.03*4,'Carry Their Strength: 0.6% x 5 more damage per Carried'); near(inRatio(L),1/(1+0.03*4),'and shrugged off',1e-6);
  near(ai/v.atkInterval,1.06,'Heavy With Them: 0.5% x 3 attack speed per Carried'); near(v.mrRating,mr0*1.10,'Old Oath: 2% x 5 magic resist while he holds any');
  for(let i=0;i<5;i++){ raise(L,WK,3); raise(L,WK,3,0,1); feed(L); } V.step(1); assert.equal(stack(L,'hCar'),11,'Stored Herd: 1 x 5 more (up to 11)');
  V.wave(); V.step(1); assert.equal(stack(L,'hCar'),0,'until the wave ends');
  const L2=lab(H,S(['ft_1_2','ft_5_3','ft_6_3']),{foes:3}); raise(L2,SK,3,0,-1); V.step(1); L2.v.shield=0; feed(L2); const sh=L2.v.shield;
  const L3=lab(H,S(['ft_1_2','ft_5_3']),{foes:3}); raise(L3,SK,3,0,-1); V.step(1); L3.v.shield=0; feed(L3); near(sh-L3.v.shield,L3.v.maxHp*0.06,'Nothing Wasted: taking the Bone-Chanter, a shield of 2% x 3 of his max HP',1e-6);
});

test('Hurne / Full Belly: at 6 Carried his basic attacks hit every enemy within 1.5 m of the target for 6% x 5',()=>{
  const L=lab(H,S(['ft_1_2','ft_11_2','ft_12_2']),{foes:4}), {v,F}=L; atGap(F[3],F[1],1,0,1); at(L,F[2],10,-12); const fa=F[3].hp; setStack(L,'hCar',5);
  const d=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',auto:true})); near(F[3].hp,fa,'not below 6');
  setStack(L,'hCar',6); const d2=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',auto:true})); near(fa-F[3].hp,d2*0.30,'30% of the hit to an enemy within 1.5 m of it',1e-6); assert.equal(F[2].hp,F[2].maxHp,'not one farther');
  const f4=F[3].hp; V.hit(v,F[1],1000,{kind:'true'}); near(F[3].hp,f4,'not his skills');
});

test('Hurne / the rupture: Torn Open, Swallow the Pack, Last Meal, Bitter Meat, Shared Grave',()=>{
  const L=lab(H,S(['ft_4_2','br_10_2','ft_9_4','ft_6_4','ft_12_4']),{foes:3}), {v,F}=L; near(ratio(L,F[1],'devourpack'),1.15*1.15,'Torn Open 5% x 3, Swallow the Pack 3% x 5');
  F[1].hp=F[1].maxHp*0.4; near(ratio(L,F[1],'devourpack'),1.15*1.15*1.15,'Last Meal: 3% x 5 more below 50% HP'); near(ratio(L,F[1],null),1,'not his basic attacks');
  raise(L,WK,3,0,-1).hp=1; V.step(1); at(L,F[0],2.5,0); at(L,F[2],0,2.5); lv1(F[0]); v.hp=v.maxHp*0.5; const h=v.hp; feed(L);
  assert.ok((F[0].slow||0)>1.9&&(F[0].slow||0)<=2+1e-9,'Bitter Meat: slowed 2 s'); near(F[0].slowMul,0.80,'by 10% x 2'); assert.ok(v.hp-h>=v.maxHp*0.04-1e-6&&v.hp-h<v.maxHp*0.06,'Shared Grave: 1% x 2 of his max HP for each enemy it hits (2): '+((v.hp-h)/v.maxHp).toFixed(4));
});

test('Hurne / Feed Them: Supper Table, Thick Neck, Grave Dirt, Strength in Every Blow, Raw Hands, Swallowed Pain, Call Them Again',()=>{
  let hp0, sh0; plain({foes:3},P=>{ const {v}=P; for(const x of [raise(P,WK,2),raise(P,WK,2,0,1)]) x.hp=v.maxHp*0.05; V.step(1); v.hp=v.maxHp*0.1; v.shield=0; const h=v.hp; feed(P); hp0=v.hp-h; sh0=v.shield; });
  const L=lab(H,S(['ft_6_2','ft_3_4','ft_3_3','ft_7_4','ft_10_3','ft_8_2','ft_7_1']),{foes:3}), {v,F}=L; for(const x of [raise(L,WK,2),raise(L,WK,2,0,1)]) x.hp=v.maxHp*0.05; V.step(1); const ar0=v.armorRating, ai=v.atkInterval;
  v.hp=v.maxHp*0.1; v.shield=0; v.greenCd=9; v.blueCd=9; const h=v.hp; feed(L);
  near((v.hp-h)/hp0,1.15,'Supper Table: it heals 3% x 5 more',1e-6); near(v.shield/sh0,1.15,'Thick Neck: its shield 3% x 5 stronger',1e-6); near(v._devourT,ULT().dur+2,'Strength in Every Blow: 0.4 s x 5 longer');
  assert.equal(v.greenCd,0,'Call Them Again: Unchain the Dead ready'); assert.equal(v.blueCd,0,'and Call the Bone-Chanter'); V.step(1);
  near(v.armorRating,ar0*1.15,'Grave Dirt: 3% x 5 armor while its shield holds'); near(ai/v.atkInterval,1.06,'Raw Hands: 2% x 3 faster while its strength lasts'); v.hp=v.maxHp; near(inRatio(L),0.90,'Swallowed Pain: 2% x 5 less',1e-6);
  v.shield=0; v.hp=v.maxHp; V.step(2); assert.ok(v.alive&&!V.ended(),''); near(v.armorRating,ar0,'Grave Dirt: not once the shield is gone'); secs(10.2); near(v.atkInterval,ai,'the strength is over'); near(inRatio(L),1,'',1e-6);
});

test('Hurne / Unbreakable Oath: no stun or slow lands while the carried strength lasts',()=>{
  const L=lab(H,S(['ft_9_2']),{foes:3}), {v,F}=L; v.stunned=0; v.level=1; v._devourT=3; const lv=v.level; V.cc(F[0],v,'stunned',2); near(v.stunned||0,0,'no stun'); V.cc(F[0],v,'slow',2); near(v.slow||0,0,'no slow');
  V.cc(F[0],v,'silencedT',2); assert.ok(v.silencedT>0,'a silence still lands'); v._devourT=0; V.cc(F[0],v,'stunned',2); assert.ok(v.stunned>0,'without the strength, it lands');
});

test('Hurne / Leave the Old Sow (PICK ONE): she is not taken, and her chant heals him 30% more while he carries the others',()=>{
  let r0; plain({foes:3},P=>{ const {v}=P; const s=raise(P,SK,1,0,-1); V.step(1); v.hp=v.maxHp*0.5; v._devourT=5; V.cast(s,'green'); const h=VMX('groundHazards').find(z=>z.chant&&z.src===s); const a=v.hp; secs(2.7); r0=(v.hp-a)/h.heal; });
  const L=lab(H,S(['ft_5_2']),{foes:3}), {v}=L; const s=raise(L,SK,1,0,-1), w=raise(L,WK,2); V.step(1); feed(L);
  assert.ok(s.alive&&s._summonOwner===v,'Feed Them takes the warrior, not the Bone-Chanter'); assert.ok(!w.alive); V.step(1); assert.ok(s.alive&&s._summonOwner===v,'she is still his');
  v.hp=v.maxHp*0.5; V.cast(s,'green'); const h=VMX('groundHazards').find(z=>z.chant&&z.src===s), a=v.hp; secs(2.7); near((v.hp-a)/h.heal,r0*1.30,'her chant heals him 30% more',1e-6);
  secs(3.5); v._devourT=0; v.hp=v.maxHp*0.5; V.cast(s,'green'); const h2=VMX('groundHazards').filter(z=>z.chant&&z.src===s).pop(), a2=v.hp; secs(2.7); near((v.hp-a2)/h2.heal,r0,'not once the strength it carries is over',1e-6);
});

test('Hurne / He Does It Anyway (SIGNATURE): below 30% HP, Feed Them at once (no energy), 5% shield a summon; with none, heal to 40% and full Carried; once every 30 s',()=>{
  const L=lab(H,S(['ft_13_2','ft_1_2','ft_1_1']),{foes:3,big:false}), {v}=L; raise(L,WK,2); raise(L,WK,2,0,1); V.step(1); v.energy=40; v.shield=0; const c0=stack(L,'hCost');
  v.hp=v.maxHp*0.25; v.greenCd=8; V.step(1); assert.equal(mine(L).length,0,'Feed Them went off and took both'); near(v.energy,40,'at no energy cost'); assert.equal(stack(L,'hCost'),c0+1,'he paid 1 Cost'); assert.equal(v.greenCd,0,'Unchain the Dead ready');
  assert.ok(v.shield>0,''); assert.equal(stack(L,'hCar'),2,'');
  v.hp=v.maxHp*0.8; V.step(2); v.hp=v.maxHp*0.25; v.greenCd=8; V.step(2); near(v.hp/v.maxHp,0.25,'not again within 30 s',1e-3);
  v.hp=v.maxHp*0.8; secs(22); v.hp=v.maxHp*0.25; V.step(2); near(v.hp/v.maxHp,0.25,'not 25 s after',1e-3); v.hp=v.maxHp*0.8; secs(8.5); v.hp=v.maxHp*0.25; V.step(2); assert.ok(v.hp/v.maxHp>0.39,'30 s after: again (no summon: to 40%)');
  const L4=lab(H,S(['ft_13_2']),{foes:3}); V.step(1); L4.v.hp=L4.v.maxHp*0.32; V.step(2); near(L4.v.hp/L4.v.maxHp,0.32,'not above 30% HP',1e-3);
  const L2=lab(H,S(['ft_13_2','ft_1_2','ft_11_2']),{foes:3}), v2=L2.v; V.step(1); v2.hp=v2.maxHp*0.2; V.step(1); near(v2.hp/v2.maxHp,0.40,'with no summon: he heals to 40%',1e-3); assert.equal(stack(L2,'hCar'),11,'and fills Carried');
  const L3=lab(H,S(['ft_13_2','ft_1_2']),{foes:3}), v3=L3.v; raise(L3,WK,2); raise(L3,WK,2,0,1); V.step(1); v3.shield=0; v3.hp=v3.maxHp*0.25; V.step(1); const s3=v3.shield;
  plain({foes:3},P=>{ raise(P,WK,2); raise(P,WK,2,0,1); V.step(1); P.v.shield=0; feed(P); near(s3-P.v.shield,P.v.maxHp*0.10,'a shield of 5% of his max HP for each summon taken',1e-3); });
});

test('Hurne / No Name for It, Grim Patience, Hard to Stop, Thick Skin, Chain Mail (one capped group)',()=>{
  const L=lab(H,S(['ft_11_4','ft_12_3','sw_8_4','ft_8_1','br_8_1']),{foes:3}), {v,F}=L; near(inRatio(L),0.95*0.95*0.95,'Hard to Stop, Thick Skin, Chain Mail: 1% x 5 each, multiplied',1e-6);
  L.T.s.hWt=V.now()-19; near(inRatio(L),0.95*0.95*0.95,'Grim Patience: not before 20 s of the wave',1e-6); L.T.s.hWt=V.now()-20.5; near(inRatio(L),0.95*0.95*0.95*0.94,'after: 2% x 3 less',1e-6);
  v.hp=v.maxHp; near(ratio(L,F[1],null),1,'No Name for It: not above 40% HP'); v.hp=v.maxHp*0.45; near(ratio(L,F[1],null),1,'not at 45%'); v.hp=v.maxHp*0.35; near(ratio(L,F[1],null),1.10,'below: 2% x 5 more');
});

test('Hurne / plain-looking talents with rows: Root and Snout, Chained Arms, Chain Weight, Grave Chains, the move talents, Never Asked, Hard Choices',()=>{
  let mv; plain({foes:3},P=>{ mv=P.v.speed; }); const L=lab(H,S(['sw_9_4','ft_2_3','sw_3_2','ft_9_3','sw_2_2','ft_5_4','br_2_3','sw_11_2','br_12_3']),{foes:3}), {v,F}=L; const mv0=v.speed, ar=v.armorRating, ai=v.atkInterval; V.step(1);
  near(v.speed,mv*1.27,'Herder\'s Walk, Heavy Tread, Road Feet: 3% x 3 each (added)'); near(ratio(L,F[1],null,{auto:true}),1.10*1.10,'Root and Snout 2% x 5, Chained Arms 2% x 5 on basic attacks (multiplied)'); near(ratio(L,F[1],null),1,'not his skills');
  const k=ratio(L,F[1],null,{kind:'phys'}); assert.ok(k>1.0001,'Chain Weight and Grave Chains: physical hits ignore 2% x 5 of the armor each: '+k);
  const w=raise(L,WK,2), w2=raise(L,WK,2,0,1); V.step(2); near(v.armorRating,ar*1.05,'Never Asked: 0.5% x 5 armor per summon alive');
  near(v.atkInterval,ai,'Hard Choices: not while all are above half'); w.hp=w.maxHp*0.4; V.step(2); near(ai/v.atkInterval,1.09,'one below 50%: 3% x 3 faster');
});

test('Hurne / crit chance: Smell of Home + Crushing Grip at most 5% in all; Grave Grip only in the room left, against 3 Smoulder',()=>{
  const L=lab(H,S(['sw_10_3','ft_7_3','br_7_3']),{foes:3}), {v}=L; V.step(1); near(v.glyphCrit,0.05,'5 + 5 ranks: 5% in all');
  assert.equal(L.T.fn.ggP(null,L.T),0,'Grave Grip: no room left');
  const L2=lab(H,[['sw_10_3',2],['br_7_3',5]],{foes:3}); V.step(1); near(L2.v.glyphCrit,0.02,'2%'); near(L2.T.fn.ggP(null,L2.T),0.03,'Grave Grip: the 3% left');
  const F=L2.F[1]; let n=0; for(let i=0;i<4000;i++){ if(FX.crit(L2.v,F,false,'phys',true)) n++; } assert.equal(n,0,'not against an enemy below 3 Smoulder');
  setUst(L2,F,'hSmo',2); n=0; for(let i=0;i<4000;i++){ if(FX.crit(L2.v,F,false,'phys',true)) n++; } assert.equal(n,0,'not at 2 Smoulder');
  setUst(L2,F,'hSmo',3); n=0; for(let i=0;i<4000;i++){ if(FX.crit(L2.v,F,false,'phys',true)) n++; } assert.ok(n>60&&n<190,'about 3% of hits forced to crit: '+n);
});

test('Hurne / slows on him: Steady Man, Gristle, Heavy Stride (at most 40% weaker); Unmoved Man (up to 20% shorter)',()=>{
  const L=lab(H,S(['sw_11_4','ft_8_3','br_8_3','br_4_1']),{foes:3}), {v,F}=L; v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*0.6,'40% weaker in all (not 68%)');
  const L2=lab(H,S(['sw_11_4']),{foes:3}); L2.v.slow=2; L2.v.slowMul=0.5; V.step(1); near(L2.v.slowMul,1-0.5*0.8,'Steady Man alone: 4% x 5');
  v.stunned=0; v.level=1; V.cc(F[0],v,'stunned',2); near(v.stunned,2*V.ccNerf*0.8,'Unmoved Man: 4% x 5 shorter',1e-6);
});

/* ============================== BETWEEN THEM AND THE ROAD ============================== */
test('Hurne / Chained: The Chains, Iron Links, Shorter Chain (the leash), Rattle, Pulling Weight, Weighted Fists, Swineherd\'s Grip',()=>{
  const L=lab(H,S(['br_1_1','br_6_1','br_2_1','br_9_1','br_7_1','br_3_3','br_11_1']),{foes:4}), {v,F}=L; const ar=v.armorRating, a0=v.dmg, mv=F[1].speed;
  V.hit(v,F[1],1,{kind:'true'}); assert.ok(!mark(L,F[1],'hCh'),'not his skills'); V.hit(v,F[1],1,{kind:'true',auto:true}); assert.ok(mark(L,F[1],'hCh'),'each basic attack chains its enemy'); near(F[1]._talM[v.uid].hCh.until-V.now(),4.5,'for 3 s + Iron Links 0.5 s x 3',1e-9);
  V.step(2); near(F[1].speed,mv*0.85,'Rattle: 3% x 5 slower'); near(v.dmg,a0*1.10,'Weighted Fists: 2% x 5 attack while one is Chained'); near(v.armorRating,ar*1.05,'Swineherd\'s Grip: 1% x 5 armor per Chained enemy');
  near(ratio(L,F[1],null,{auto:true}),1.10,'Pulling Weight: 2% x 5 more to it'); for(const f of [F[0],F[2],F[3]]) V.hit(v,f,1,{kind:'true',auto:true}); V.step(2); near(v.armorRating,ar*1.15,'up to 3 enemies');
  F[1].pulledBy=null; F[1].pullT=0; const g0=gap(v,F[1]); assert.ok(g0>1.2,''); V.step(5); assert.ok(F[1].pulledBy&&F[1].pullT>0,'Shorter Chain 1 m x 3: farther than 1 m from him, it is dragged back');
  near(F[1].pullStop/V.METER-V.bodyR(v)-V.bodyR(F[1]),1,'to the end of a 1 m chain (body to body)',1e-6);
  secs(3.0); assert.ok(mark(L,F[1],'hCh'),'Iron Links: 0.5 s x 3 longer'); secs(1.6); assert.ok(!mark(L,F[1],'hCh'),'4.5 s');
});

test('Hurne / Dragged Back: an enemy straining at the end of its chain is dragged to him and stunned 0.5 s (the stun-lock rule; at most once every 5 s)',()=>{
  const L=lab(H,S(['br_1_1','br_2_1','br_3_1']),{foes:3}), {v,F}=L; lv1(F[1]); F[1].stunned=0; F[1].speed=0; V.hit(v,F[1],1,{kind:'true',auto:true}); V.step(3);
  assert.ok(F[1].pulledBy&&F[1].pullStop<(1+V.bodyR(v)+V.bodyR(F[1]))*V.METER,'dragged all the way to him (the drag it writes)'); near(L.T.s.hStL.length,1,'one stun'); near(L.T.s.hStL[0][2],0.5,'0.5 s, at its full written length',1e-9);
  F[1].stunned=0; secs(3); V.hit(v,F[1],1,{kind:'true',auto:true}); F[1].stunned=0; at(L,F[1],10,0); V.step(5); assert.equal(L.T.s.hStL.length,1,'not again within 5 s');
  secs(1.8); V.hit(v,F[1],1,{kind:'true',auto:true}); F[1].stunned=0; at(L,F[1],10,0); V.step(5); assert.equal(L.T.s.hStL.length,2,'again after 5 s');
  const L2=lab(H,S(['br_1_1','br_2_1','br_3_1']),{foes:3}); L2.F[1].speed=0; lv1(L2.F[1]); L2.F[1].stunned=2; V.hit(L2.v,L2.F[1],1,{kind:'true',auto:true}); V.step(3); assert.ok(!L2.T.s.hStL||!L2.T.s.hStL.length,'never on an enemy already stunned');
});

test('Hurne / Hold the Road (PICK ONE), Let Them Through (PICK ONE) and Price of Passing, Short Leash',()=>{
  const L=lab(H,S(['br_1_1','br_5_2','br_10_1']),{foes:3}), {v,F}=L; V.hit(v,F[1],1,{kind:'true',auto:true}); assert.equal(F[1].forcedTarget,v,'Hold the Road: a new chain taunts it onto him');
  near(F[1].forcedTargetT,1,'for 1 s',0.05); F[1].forcedTargetT=0; V.hit(v,F[1],1,{kind:'true',auto:true}); near(F[1].forcedTargetT||0,0,'not a chain renewed');
  v.hp=v.maxHp*0.5; const h=v.hp; hitOn(L,v,0.001,{src:F[1]}); near(v.hp-h,v.maxHp*0.012,'Short Leash: a Chained enemy\'s hit heals him 0.24% x 5',1e-3); const h2=v.hp; hitOn(L,v,0.001,{src:F[1]}); near(v.hp,h2,'at most once a second',1e-6);
  const L2=lab(H,S(['br_1_1','br_5_3','br_6_3']),{foes:3,allies:1}), v2=L2.v; const f=L2.F[1]; V.hit(v2,f,1,{kind:'true',auto:true});
  const fh=f.hp; V.hit(f,L2.A[0],100,{kind:'true'}); near(fh-f.hp,v2.dmg*0.35,'Let Them Through: a Chained enemy hitting anyone but him takes 20% + 5% x 3 of his attack',0.02);
  const fh1=f.hp; V.hit(f,L2.A[0],100,{kind:'true'}); assert.equal(f.hp,fh1,'not again within 0.5 s'); secs(0.55);
  const fh2=f.hp; V.hit(f,v2,100,{kind:'true'}); near(f.hp,fh2,'not for hitting him'); V.hit(f,L2.A[0],100,{kind:'true'}); assert.ok(f.hp<fh2,'after 0.5 s again');
});

test('Hurne / Smoulder: Her Young, Slow Embers, Whole Hillside, Ash in the Air, Hot Bristles, Ash Underfoot, Embers Spread',()=>{
  const L=lab(H,S(['br_1_4','br_3_4','br_5_4','br_7_4','br_10_4','br_12_4']),{foes:3}), {v,F}=L; const w=raise(L,WK,6,0,1); atGap(w,F[1],1,0,1); V.step(1);
  clk(L,'#5'); secs(3.1); near(ust(L,F[1],'hSmo'),0,'no Smoulder without the Bone-Chanter'); raise(L,SK,6,0,-1); V.step(1); const a0=F[1].atkInterval, h0=F[1].hp; secs(5.05);
  const n=ust(L,F[1],'hSmo'); assert.ok(n>=4&&n<=5,'1 a second within 1.5 m of a warrior: '+n); near(ust(L,F[2],'hSmo'),0,'not an enemy far from the warriors');
  secs(3); assert.equal(ust(L,F[1],'hSmo'),7,'Whole Hillside: up to 7'); near(a0/F[1].atkInterval,1/(1+0.025*7)*1,'',0.05); assert.ok(F[1].atkInterval>a0*1.15,'Ash in the Air: 0.5% x 5 slower per Smoulder');
  assert.ok(h0-F[1].hp>0,'Her Young: it burns'); const h=F[1].hp; clk(L,'#5'); secs(1.02); near(h-F[1].hp,v.dmg*VMX('rageMul')*0.06*7,'2% x 3 of his attack per Smoulder a second',0.05);
  near(sRatio(w,F[1]),1.12,'Hot Bristles: at 5 or more, 4% x 3 more from his summons'); setUst(L,F[2],'hSmo',4); near(sRatio(w,F[2]),1,'not at 4'); setUst(L,F[2],'hSmo',0);
  atGap(w,v,20,0,-1); V.step(1); const A=L.T.s.hApi; setUst(L,F[2],'hSmo',0); A.acts(L.T,v,[{ustack:'hSmo',on:'target',add:3}],{u:v,tgt:F[2]}); secs(3.4); assert.equal(ust(L,F[2],'hSmo'),3,'Slow Embers: they hold 1.5 + 0.4 x 5 = 3.5 s after the last gain');
  secs(0.2); assert.equal(ust(L,F[2],'hSmo'),2,'then one fades'); secs(3.4); assert.equal(ust(L,F[2],'hSmo'),2,'every 3.5 s'); secs(0.2); assert.equal(ust(L,F[2],'hSmo'),1,'');
  setUst(L,F[1],'hSmo',3); kill(F[1]); V.step(1); assert.equal(ust(L,F[0],'hSmo'),5,'Embers Spread: the enemy nearest gets 1 x 5');
  const L2=lab(H,S(['br_1_4','br_7_4','br_9_4']),{foes:3}); const s=raise(L2,SK,6,0,1); atGap(s,L2.F[1],1,0,1); V.step(1); secs(2.1); assert.ok(ust(L2,L2.F[1],'hSmo')>=1,'Ash Underfoot: near the old sow herself, no warrior needed');
});

test('Hurne / The Army That Did Not Stop (SIGNATURE): a melee enemy reaches a summon - every enemy within 6 m Chained, dragged 2 m, 5 Smoulder; half damage on his summons 5 s; once every 25 s',()=>{
  const L=lab(H,S(['br_13_2','br_1_4']),{foes:4}), {v,F}=L; const w=raise(L,WK,2); V.step(1); const d0=Math.hypot(F[0].x-v.x,F[0].y-v.y);
  F[0].melee=false; hitOn(L,w,1000,{src:F[0]}); assert.ok(!win(L,'hArmy'),'not a ranged enemy\'s hit'); F[0].melee=true; hitOn(L,w,1000,{src:F[0]}); assert.ok(win(L,'hArmy'),'the chains go out'); assert.ok(mark(L,F[0],'hCh')&&mark(L,F[3],'hCh'),'every enemy within 6 m is Chained'); assert.ok(!mark(L,F[2],'hCh'),'not one 15 m away');
  near(ust(L,F[0],'hSmo'),5,'each gains 5 Smoulder'); assert.equal(F[0].pulledBy&&1,1,'dragged toward him'); near(sInRatio(L,w),0.5,'his summons take half damage',1e-6);
  secs(5.1); near(sInRatio(L,w),1,'for 5 s',1e-6); secs(7); hitOn(L,w,10,{src:F[0]}); assert.ok(!win(L,'hArmy'),'not again within 25 s'); secs(13.5); hitOn(L,w,10,{src:F[0]}); assert.ok(win(L,'hArmy'),'25 s after: again');
});

/* ============================== PAGE SITES ============================== */
test('Hurne: every page site his talents added is reached - the Bone-Chanter\'s circle (her heals, as hers) and his ultimate cast by a talent',()=>{
  const rows=[{on:'partPre',skill:'chant',do:[{fn:'n',k:'pre'}]},{on:'part',skill:'chant',do:[{fn:'n',k:'post'}]},{on:'healMe',if:{casting:'chant'},do:[{fn:'n',k:'heal'}]},{on:'healMe',if:{fn:'notChant'},do:[{fn:'n',k:'other'}]},
    {on:'cast',skill:'devourpack',do:[{fn:'n',k:'ult'}]},{on:'tick',if:{fn:'go'},do:[{fn:'ult'}]}];
  const def={hero:H,casting:true,summons:true,states:{},always:[],talents:{sw_13_3:rows},partial:{},ruling:{},
    fn:{ n(A,T,u,c,a){ const C=T.s.cnt||(T.s.cnt={}); C[a.k]=(C[a.k]||0)+1; }, notChant(A,T){ return T.s.cur!=='chant'; }, go(A,T){ return !!T.s.go; },
      ult(A,T,u){ T.s.go=0; const e=u.energy; A.eng().castUltFree(u); T.s.e1=[e,u.energy]; } }};
  const L=lab(H,[['sw_13_3',1]],{foes:3,def}), {v}=L; const C=()=>L.T.s.cnt||{};
  const s=raise(L,SK,1,0,-1); V.step(1); v.hp=v.maxHp*0.5; V.cast(s,'green'); secs(2.7); assert.ok(C().pre>=1&&C().post===C().pre,'her circle\'s heal pass: '+JSON.stringify(C())); assert.ok(C().heal>=1,'its heal on him, as hers');
  const h0=C().heal; V.heal(v,10); assert.equal(C().heal,h0,'another heal is not hers'); assert.ok(C().other>=1,'');
  v.energy=30; L.T.s.go=1; V.step(1); assert.equal(C().ult,1,'the bound castUltFree casts Feed Them'); assert.deepEqual(L.T.s.e1,[30,30],'at no energy cost');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Hurne: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['sw_1_1','sw_1_4','sw_2_3','ft_1_1','ft_1_2','br_1_1','br_1_4','br_3_4']), TEAM=['vael','sylthaine','vireo','vex','hurne'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const seen={drv:0,ch:0,smo:0,cost:0,car:0,summons:0,turned:0};
  for(let i=0;i<3200&&!V.ended()&&s.alive;i++){ V.step(1); const S0=s._tal.s; seen.cost=Math.max(seen.cost,(S0.k.hCost||{n:0}).n); seen.car=Math.max(seen.car,(S0.k.hCar||{n:0}).n);
    const M=units().filter(x=>x.alive&&x._talS===s); seen.summons=Math.max(seen.summons,M.length); for(const x of M) if(x.forcedTarget&&S0.m.hDrv&&x.forcedTarget===S0.m.hDrv) seen.turned++;
    for(const f of units()){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.hDrv&&(o.hDrv.until==null||o.hDrv.until>V.now())) seen.drv++; if(o.hCh&&o.hCh.until>V.now()) seen.ch++; if(o['#hSmo']&&o['#hSmo'].until>V.now()) seen.smo++; } }
  console.log('  live fight: '+JSON.stringify(seen));
  assert.ok(seen.drv>0,'an enemy Driven'); assert.ok(seen.turned>0,'his summons turned on it'); assert.ok(seen.ch>0,'enemies Chained'); assert.ok(seen.summons>0,'summons of his carried his rows');
  determinism(H,TEAM);
});

/* The page sites his talents added (the Bone-Chanter's circle around its heal pass, the bound castUlt): with nothing learned, whole seeded fights with Hurne in the
   line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){} return h; }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Hurne: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENCS=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['hurne','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','bloatus'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __huN={green:0,blue:0,ult:0,chant:0,risen:0}; var __huD=_doEffectCore, __huS=summonUnit;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="hurne"){ if(type==="summonwarriors") __huN.green++; if(type==="summonshaman") __huN.blue++; if(type==="devourpack") __huN.ult++; }'+
    '  if(u&&u.key==="boar shaman"&&type==="chantzone") __huN.chant++; return __huD.apply(this,arguments); };'+
    'summonUnit=function(o){ const x=__huS.apply(this,arguments); if(x&&o&&o.key==="hurne") __huN.risen++; return x; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENCS.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__huN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.green>0&&c.blue>0&&c.ult>0&&c.chant>0&&c.risen>0,'the fights raised his warriors and the Bone-Chanter (who chanted) and cast Feed Them: '+JSON.stringify(c)); }
  finally{ VMX('_doEffectCore=__huD; summonUnit=__huS;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong. */
const DEF={ sw:['sw_8_4','sw_3_4','sw_10_4','sw_6_2','sw_12_3','sw_7_4','sw_11_2','sw_5_4','sw_5_2'],
            ft:['ft_8_1','ft_8_2','ft_12_3','ft_1_2','ft_11_1','ft_11_2','ft_1_4','ft_10_1','ft_5_1','ft_3_3','ft_3_4'],
            br:['br_8_1','br_2_2','br_12_2','br_11_2','br_1_3','br_12_1','br_11_3','br_11_1','br_4_2','br_8_2'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sw:0,ft:1,br:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const PM100=()=>{ const U=V.arena(snaps([Object.assign(spec(H,100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7); return U[0].passMul||1; };
/* the worst hit on him: 6 warriors and 2 Bone-Chanters standing, all Kept Close and some behind him (Packmaster at skill level 100), Feed Them's slot at its
   largest with that pack (10% + 3% x 8), its carried strength on, 5 Cost, 11 Carried, the wave 30 s old; normal and critical, physical and magic */
function worstHit(list,kind,crit,glyph){ const pmv=PM100(); const L=lab(H,list,{foes:3,allies:1,cold:true}), {v,F}=L; V.step(1); v.passMul=pmv;
  for(let i=0;i<6;i++) raise(L,WK,0.6,-1,i*0.35-0.9); raise(L,SK,0.6,-0.4,1); raise(L,SK,0.6,-0.4,-1); V.step(1);
  if(L.T){ setStack(L,'hCost',5); setStack(L,'hCar',11); L.T.s.hWt=V.now()-30; }
  v._devourT=5; v.drMul=1-(0.10+0.03*8); v.drT=5; v.glyphDR=glyph||0; v.maxHp=1e5; v.hp=5e4; v.shield=0; const f=F[0];
  const raw=1e5, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Hurne: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at (or near) that ceiling in a seeded fight',()=>{
  const cands=[[['sw','br'],[61,30]],[['ft','br'],[61,30]],[['br','ft'],[61,30]],[['br','sw'],[61,30]],[['br'],[91]],[['ft'],[91]],[['sw','ft','br'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), g30=Math.max(...['magic','phys'].map(k=>worstHit(best.list,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | ')+'; with 30% glyph reduction '+(g30*100).toFixed(1)+'%');
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95&&g30<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,pt:0,ph:0,sus:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="hurne"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>raw*1e-6){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!u||u.key!=="hurne"||!u.alive) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const f=units.find(x=>x.alive&&x.team!==u.team); if(f&&u._tal&&u._tal.s.hApi){ let worst=0; for(const k of ["phys","magic"]){ let m=defMul(f,u,k)*(u.drT>0?u.drMul:1)*(1-(u.glyphDR||0))/(1+0.05*(u._packN||0)*(u.passMul||1));'+
    '        m*=u._tal.fn.drK(u._tal.s.hApi,u._tal,u); worst=Math.max(worst,1-m); } __dr.pt++; __dr.sus+=worst; if(worst>=0.85) __dr.ph++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','hurne'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks+'; reference hit each tick: sustained '+(100*d.sus/Math.max(1,d.pt)).toFixed(1)+'%, at 85% or more '+(100*d.ph/Math.max(1,d.pt)).toFixed(1)+'% of the fight');
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.ok(d.imm<d.ticks*0.5,'immune far less than half the fight');
    assert.ok(d.ph<d.pt*0.5,'at 85% or more for less than half of the fight ('+d.ph+' of '+d.pt+' ticks)'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* The stun-lock rule: his talent stuns (Dragged Back, the herd's charge) never land on a stunned enemy or within 0.5 s after one of his ends, and one charge stuns
   each enemy at most twice (here: once). Seeded fights with builds that stun: the longest time one enemy spends stunned by him and his herd in a row. */
test('Hurne: the stun-lock rule in seeded fights - the longest run of his stuns on one enemy, and the break between them',()=>{
  const add=(b,ids)=>{ for(const id of ids){ let g=0; while(g++<10&&(b.r[id]|0)<T.talent(H,id).ranks&&T.canLearn(H,b,id,100)) b=T.learn(H,b,id,100).build; } return b; };
  const lists=[add(defensive(['br','sw'],[61,30]),['br_1_1','br_2_1','br_3_1']),defensive(['sw','br'],[61,30])].map(b=>T.learned(H,b));
  lists.push(everything(H));
  let longest=0, minBreak=Infinity, n=0, fights=0;
  for(const list of lists){ const sn=snaps(['vael','vireo','vex','sylthaine','hurne'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    VMX('var __hst=[]; var __hsu=_updateBattleCore; _updateBattleCore=function(dt){ const r=__hsu.apply(this,arguments); for(const u of units){ if(u&&u.key==="hurne"&&u._tal&&u._tal.s.hStL&&u._tal.s.hStL.length){ for(const e of u._tal.s.hStL) __hst.push([__hst.f+":"+e[0],e[1],e[2]]); u._tal.s.hStL.length=0; } } return r; }; __hst.f=0;');
    try{ for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]){ VMX('__hst.f++'); campaign(sn,node,seed); fights++; }
      const foe=snaps(['grosk','gruel','carn','konwu','bloatus'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
      for(const seed of [3,5]){ VMX('__hst.f++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); fights++; }
      const L=VMX('__hst').slice(); n+=L.length; const by={}; for(const e of L) (by[e[0]]||(by[e[0]]=[])).push(e);
      for(const k in by){ const a=by[k].sort((p,q)=>p[1]-q[1]); let runS=a[0][1], runE=a[0][1]+a[0][2];
        for(let i=1;i<a.length;i++){ const s=a[i][1]; if(s>=a[i-1][1]) minBreak=Math.min(minBreak,s-(a[i-1][1]+a[i-1][2])); if(s<=runE+1e-9) runE=Math.max(runE,s+a[i][2]); else { longest=Math.max(longest,runE-runS); runS=s; runE=s+a[i][2]; } }
        longest=Math.max(longest,runE-runS); } }
    finally{ VMX('_updateBattleCore=__hsu;'); } }
  console.log('  stun-lock: '+n+' talent stuns of his in '+fights+' fights; the longest run on one enemy '+longest.toFixed(2)+' s; the shortest break between two of them on one enemy '+(minBreak===Infinity?'-':minBreak.toFixed(2)+' s'));
  assert.ok(n>0,'his talent stuns landed in the fights'); assert.ok(longest<=0.5+1e-6,'never longer than one of his stuns (0.5 s) in a row');
  assert.ok(minBreak===Infinity||minBreak>=0.5-1e-6,'at least 0.5 s between two of his stuns on one enemy');
});
