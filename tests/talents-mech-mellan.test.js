'use strict';
/* Mellan's talents as data on the mechanics layer (talents-mech/mellan.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one action (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Mellan, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0); A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5). Every lab unit is held (stunned).
   His worker bees are real (the passive's own entries in _bees): a pulse every 0.5 s on every hero of his side, himself too. Tests that measure an exact heal
   stop them first (noBees) and make one pulse due when they want one (pulse).
   None of his base skills is in today's SKILL REACH AUDIT (Hornet Cloud measures centre to centre around its own centre, the densest enemy group: it stung
   1 or 2 enemies in 127 of 150 seeded casts), so no test needs a place "before and after v1391". The lab aims the cloud with the skill's own _aim.
   Run: node --test tests/talents-mech-mellan.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='mellan', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d||99)}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const left=(L,t,name)=>{ const m=t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]; return m?(m.until==null?Infinity:m.until-V.now()):0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const ME=L=>L.T.s.me;
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));
const ratioIn=(L,t,o)=>hitOn(L,t,1000,o)/plainHit(L,()=>hitOn(L,t,1000,o));
/* his worker bees: the page's own entries in _bees */
const bees=L=>VMX('_bees').filter(b=>b.ph===8&&b.u===L.v);
const beeOf=(L,x)=>bees(L).find(b=>b.t===x);
const noBees=L=>{ for(const b of bees(L)) b.acc=-1e9; };
const BASE=(L,x)=>(x.maxHp*0.004+(L.v.apow||0)*0.08*(L.v.passMul||1))*0.5;
function pulse(L,x,f){ if(f!=null) x.hp=x.maxHp*f; const b=beeOf(L,x); assert.ok(b,'a worker on that unit'); noBees(L); b.acc=0.5-V.STEP*0.5; const h=x.hp; V.step(1); b.acc=-1e9; return x.hp-h; }
const cells=(L,x)=>{ const c=ME(L).cb[x.uid]; return c?c.n:0; };
const setCells=(L,x,n,h)=>{ const C=ME(L).cb, c=C[x.uid]||(C[x.uid]={n:0,h:0,br:-9}); c.n=n; c.h=h||0; c.br=-9; };
/* Royal Nectar on x (x made the most wounded); the glob lands 0.45 s later */
function nectar(L,x,f){ for(const u of [L.v].concat(L.A)) if(u!==x) u.hp=u.maxHp; x.hp=x.maxHp*(f==null?0.5:f); if(x.hots) x.hots.length=0; V.cast(L.v,'blue'); secs(0.5); }
const myHots=(L,x)=>(x.hots||[]).filter(h=>h._talU===L.v&&h._talK==='nectar');
/* Hornet Cloud aimed at t (the skill's own _aim); its controller; one sting tick made due now */
function cloud(L,t){ const v=L.v, ab=Object.assign({},v.greenAb,{_aim:{x:t.x,y:t.y}}); v._castSlot='green'; v._castLv=(v.skillLv&&v.skillLv[1])||1; v._castSM=VMX('skillMul')(v._castLv);
  try{ VMX('doEffect')(v,'hornetswarm',ab); } finally{ v._castSM=1; v._castLv=0; v._castSlot=null; } return clouds(L).slice(-1)[0]; }
const clouds=L=>VMX('_bees').filter(b=>b.ph===5&&b.u===L.v);
function sting(L,b,t){ const h=t.hp, s=t.shield||0; b.acc=b.tick-V.STEP*0.5; V.step(1); return (h-t.hp)+(s-(t.shield||0)); }
const stingR=(L,b,t)=>sting(L,b,t)/plainHit(L,()=>sting(L,b,t));
const noHive=L=>{ const B=VMX('_bees'); for(let i=B.length-1;i>=0;i--) if(B[i].u===L.v&&(B[i].ph===0||B[i].ph===1)) B.splice(i,1); };
const kill=(L,t,src)=>{ t.hp=1; t.shield=0; V.hit(src||L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
const plain=(o,fn)=>fn(lab(H,null,o));

test('Mellan: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['gr_2_4','gr_7_4','gr_12_1','ls_3_3','ls_8_3','ls_12_3','rm_2_1','rm_3_4','rm_12_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['gr_13_3','ls_13_2','rm_13_2','gr_1_1','ls_6_1','rm_1_4']) assert.ok(FXN.mech(H).talents[id],id);
});

test('Mellan: his real kit, as the talents read it - Royal Nectar (himself too, no attack speed), Hornet Cloud (centre measure, 0.5 s stings), Hive Mind, his workers',()=>{
  plain({foes:3,allies:2},P=>{ const {v,A,F}=P, a=A[0];
    assert.ok(v.pass&&v.pass.beeward,'Worker Swarm at 3 stars');
    for(const x of [v].concat(A)) assert.ok(beeOf(P,x),'a worker on every hero of his side, himself too');
    const g=pulse(P,a,0.5); near(g,BASE(P,a),'a pulse: (0.4% of its max HP + 8% of his ability power x passMul) x 0.5');
    near(pulse(P,a,1),0,'at full HP a pulse heals nothing');
    const ai=a.atkInterval; a.maxHp=1e6; noBees(P); nectar(P,a,0.3);
    const sm=VMX('skillMul')(10), apB=v.apow*sm, o=VMX('skillScaleOpts')(Object.assign({},VMX('KITS.mellan').blue),sm,10);
    const hot=a.hots[a.hots.length-1]; near(hot.hps,a.maxHp*o.hot+apB*0.4,'Royal Nectar on the most wounded ally: then 4.5% of its max HP + 0.4 x ability power a second'); assert.equal(hot.remaining,5);
    near(a.hp-a.maxHp*0.3,(a.maxHp*o.heal+apB*2)*(v.healPowMul||1),'its heal: 15% of its max HP + 2 x ability power',1e-3);
    assert.equal(a.atkInterval,ai,'no attack speed (the card says it raises attack speed)');
    a.hp=a.maxHp; v.hp=v.maxHp*0.2; A[1].hp=A[1].maxHp; const hv=v.hp; V.cast(v,'blue'); secs(0.5); assert.ok(v.hp>hv,'himself, when he is the most wounded');
    const f=F[0], b=cloud(P,f); assert.ok(b,'Hornet Cloud: a controller'); near(b.tick,0.5,''); near(b.life,4,'4 s'); near(b.R,2.8*V.METER,'2.8 m, centre to centre');
    near(b.dps,apB*0.42,'42% of ability power a second'); const d=sting(P,b,f); assert.ok(d>0,'each 0.5 s it stings, magic');
    at(P,f,4.5,2.85); near(sting(P,b,f),0,'an enemy whose centre is just outside: nothing');
    for(const x of [v].concat(A)) x.hp=x.maxHp*0.5; const ha=a.hp; V.cast(v,'ult'); secs(3); assert.ok(a.hp>ha,'Hive Mind: shares of honey heal his allies');
  });
});

/* ============================== THE GENTLE RULE ============================== */
test('Mellan / Comb: Wax Cells (3 cells, 1% x 5), Deep Comb, Honeyed Wax, Sealed Comb, one cell per 0.5 s, Well Kept Hives, a new Nectar replaces the Comb',()=>{
  const L=lab(H,S(['gr_1_2','gr_2_2','gr_3_2','gr_8_1','gr_6_2']),{allies:2,foes:3}), {v,A}=L, a=A[0]; a.maxHp=1e6; noBees(L);
  nectar(L,a,0.5); assert.equal(cells(L,a),6,'3 cells + Deep Comb 1 x 3'); a.hots.length=0;
  a.hp=a.maxHp*0.5; const h=a.hp, l=hitOn(L,a,1000); V.step(1); near(a.hp-(h-l),a.maxHp*(0.05+0.009),'a hit breaks one: 1% x 5 + Honeyed Wax 0.3% x 3 of its max HP',1e-6);
  assert.equal(cells(L,a),5); near(l,1000*(1-0.075),'Well Kept Hives: the hit that broke it 1.5% x 5 less');
  near(hitOn(L,a,1000),1000,'a hit right after breaks none (at most one every 0.5 s) and is not reduced'); assert.equal(cells(L,a),5);
  secs(0.5); setCells(L,a,2); nectar(L,a,0.5); assert.equal(cells(L,a),6,'a new Nectar: a new Comb (it replaces the old)'); a.hots.length=0;
  for(let i=0;i<6;i++){ secs(0.55); a.hp=a.maxHp*0.5; hitOn(L,a,10); } assert.equal(cells(L,a),0); V.step(1); near(a.shield,a.maxHp*0.06,'Sealed Comb: the last one breaks: a shield of 6% of its max HP'); near(a.shieldT,3,'for 3 s',0.02);
  void v;
});

test('Mellan / Summer Flowers and Comb Builder',()=>{
  const L=lab(H,S(['gr_1_2','gr_5_2','gr_9_1']),{allies:2,foes:3}), {v,A}=L, a=A[0]; a.maxHp=1e6; noBees(L);
  setCells(L,a,0); nectar(L,a,0.3); const g0=a.hp-a.maxHp*0.3;
  setCells(L,a,3); nectar(L,a,0.3); const g=a.hp-a.maxHp*0.3; near(g-g0,a.maxHp*0.004*5*3,'Summer Flowers: each of the 3 cells left heals 0.4% x 5 before the new Comb sets',1e-3);
  setCells(L,a,0); a.hp=a.maxHp*0.9; hitOn(L,a,a.maxHp*0.10); assert.equal(cells(L,a),0,'a hit of 10% does not'); hitOn(L,a,a.maxHp*0.16); assert.equal(cells(L,a),1,'Comb Builder: a hit of more than 15% with no Comb left: a fresh cell');
  secs(0.6); a.hp=a.maxHp*0.9; hitOn(L,a,10); assert.equal(cells(L,a),0); hitOn(L,a,a.maxHp*0.16); assert.equal(cells(L,a),0,'once every 6 s per ally'); secs(4.9); a.hp=a.maxHp*0.9; hitOn(L,a,a.maxHp*0.16); assert.equal(cells(L,a),0,'(not at 5.5 s)'); secs(0.6); a.hp=a.maxHp*0.9; hitOn(L,a,a.maxHp*0.16); assert.equal(cells(L,a),1);
  void v;
});

test('Mellan / Patient Keeper and Royal Jelly (an ally who still has a Comb cell)',()=>{
  const L=lab(H,S(['gr_1_2','gr_3_1','gr_7_1']),{allies:2,foes:3}), {v,A}=L, a=A[0]; a.maxHp=1e6;
  setCells(L,a,2); near(pulse(L,a,0.5)/BASE(L,a),1+0.15+0.10,'Patient Keeper 3% x 5 and Royal Jelly 2% x 5 on a worker heal'); setCells(L,a,0); near(pulse(L,a,0.5),BASE(L,a),'without a cell: the plain pulse');
  noBees(L); setCells(L,a,0); nectar(L,a,0.3); const p=a.hp-a.maxHp*0.3; setCells(L,a,1); nectar(L,a,0.3); near((a.hp-a.maxHp*0.3)/p,1.10,'Royal Jelly on Royal Nectar too',1e-3); void v;
});

test('Mellan / Tell the Bees (LINK): the breaker deals 3% less to that ally for 2 s; with He Points the breaker of the last cell is Pointed 4 s, once every 8 s',()=>{
  let L=lab(H,S(['gr_1_2','gr_n1']),{allies:2,foes:3}), {A,F}=L, a=A[0]; setCells(L,a,2);
  hitOn(L,a,10,{src:F[0]}); assert.equal(cells(L,a),1); near(hitOn(L,a,1000,{src:F[0]}),970,'that enemy: 3% less to that ally'); near(hitOn(L,a,1000,{src:F[1]}),1000,'another enemy: not');
  near(hitOn(L,A[1],1000,{src:F[0]}),1000,'nor on another ally'); setCells(L,a,0); secs(2.05); near(hitOn(L,a,1000,{src:F[0]}),1000,'2 s');
  setCells(L,a,1); hitOn(L,a,10,{src:F[0]}); assert.equal(cells(L,a),0); assert.ok(!mark(L,F[0],'pt'),'without He Points nobody is Pointed');
  L=lab(H,S(['gr_1_2','gr_n1','ls_1_1']),{allies:2,foes:3}); ({A,F}=L); a=A[0]; setCells(L,a,1);
  hitOn(L,a,10,{src:F[1]}); assert.ok(mark(L,F[1],'pt'),'the breaker of the last cell is Pointed'); near(left(L,F[1],'pt'),4,'4 s',0.05);
  setCells(L,a,1); secs(0.6); hitOn(L,a,10,{src:F[2]}); assert.ok(!mark(L,F[2],'pt'),'once every 8 s'); secs(8); setCells(L,a,1); hitOn(L,a,10,{src:F[2]}); assert.ok(mark(L,F[2],'pt'));
});

test('Mellan / the Hive store: Foraging (0.5% x 5 a second from an ally at full HP), Full Baskets (up to 40% of his max HP), spent by Royal Nectar, Golden Store, Queen\'s Gift',()=>{
  const L=lab(H,S(['gr_2_3','gr_4_3','gr_10_2','gr_10_4']),{allies:2,foes:3}), {v,A}=L, a=A[0], b=A[1]; a.maxHp=b.maxHp=1e4; v.maxHp=1e5; for(const x of [v,a,b]) x.hp=x.maxHp;
  setStack(L,'store',0); pulse(L,a,1); near(stack(L,'store'),1e4*0.025*0.5,'a pulse at full HP: 0.5% x 5 of its max HP a second, for 0.5 s');
  setStack(L,'store',0); pulse(L,a,0.5); near(stack(L,'store'),0,'not while its ally is hurt');
  for(let i=0;i<4000&&stack(L,'store')<v.maxHp*0.4-1e-6;i++) pulse(L,a,1); near(stack(L,'store'),v.maxHp*0.40,'up to 25% + Full Baskets 5% x 3 of HIS max HP'); pulse(L,a,1); near(stack(L,'store'),v.maxHp*0.40,'and no more');
  for(const x of [v,a,b]) x.energy=0; L.T.s.me.qg=0; secs(2.8); for(const x of [v,a,b]) assert.ok(x.energy<1,'(not before 3 s)'); secs(0.25); for(const x of [v,a,b]) assert.ok(x.energy>=3&&x.energy<3.5,'Queen\'s Gift: the store full, every ally (him too) 1 x 3 energy every 3 s: '+x.energy);
  a.maxHp=1e6; const st=stack(L,'store'); nectar(L,a,0.2); const g=a.hp-a.maxHp*0.2; near(stack(L,'store'),0,'Royal Nectar spends the store');
  for(const x of [v,a,b]) x.energy=0; secs(3.05); assert.ok(a.energy<1,'(Queen\'s Gift stops: not full)');
  const p=plainHit(L,()=>{ nectar(L,a,0.2); return a.hp-a.maxHp*0.2; });
  near(g,p*(1+0.05*8)+st*(v.healPowMul||1),'Golden Store: 1% x 5 per 5% of his max HP in the store (8 steps), and the store as extra healing',1e-3);
});

test('Mellan / Royal Nectar: Clover Honey, Rough Honey, Shared Nectar (its heal and each tick); Quick Honey, Busy Morning, King\'s Patience; Gold Weather (the Colony)',()=>{
  const L=lab(H,S(['gr_1_4','ls_11_4','rm_12_3','gr_4_1','rm_5_3','rm_11_1','rm_1_1','rm_1_3']),{allies:2,foes:3}), {v,A}=L, a=A[0]; a.maxHp=1e6; noBees(L);
  const p=plainHit(L,()=>{ nectar(L,a,0.2); return a.hp-a.maxHp*0.2; }); nectar(L,a,0.2); const g=a.hp-a.maxHp*0.2; near(g,p*1.30,'2% x 5 three times: 30% more');
  const h=myHots(L,a)[0]; assert.ok(h,'its heal over time is his'); const t0=a.hp; secs(1.02); near(a.hp-t0,h.hps*1.30,'each tick 30% more too',1e-3);
  near(FX.cd(v,'blue',8),(8-0.6)*0.95-0.75,'Quick Honey 0.2 x 3 s, King\'s Patience 1% x 5 faster, Busy Morning 0.15 x 5 s off (in talent-id order)');
  near(FX.cd(v,'green',7),7*0.95,'King\'s Patience on Hornet Cloud');
  setStack(L,'col',50); V.cast(v,'blue'); near(stack(L,'col'),60,'Gold Weather: each Royal Nectar cast refills 2 x 5 Colony');
});

test('Mellan / Thick Honey (PICK ONE: 3 s longer, halves Thick Nectar), Slow Drip; Thick Nectar (attack speed while its heal over time runs); Runny Honey (PICK ONE), Shared Jar',()=>{
  const base=lab(H,null,{allies:2,foes:3}).A[0].atkInterval;
  let L=lab(H,S(['gr_5_1','gr_6_1','rm_4_4']),{allies:2,foes:3}), {v,A}=L, a=A[0]; a.maxHp=1e6; noBees(L);
  nectar(L,a,0.2); const h=myHots(L,a)[0]; assert.equal(h.remaining,8,'Thick Honey: 5 + 3 ticks'); const t0=a.hp; secs(1.02); near(a.hp-t0,h.hps*1.12,'Slow Drip: 4% x 3 each tick',1e-3);
  V.step(1); near(a.atkInterval,base/(1+0.03),'Thick Nectar 2% x 3, halved by Thick Honey: 3% faster');
  L=lab(H,S(['rm_4_4']),{allies:2,foes:3}); ({v,A}=L); a=A[0]; noBees(L); nectar(L,a,0.2); V.step(2); near(a.atkInterval,base/(1+0.06),'Thick Nectar: 6%'); secs(5.2); near(a.atkInterval,base,'for its heal over time (5 s)');
  L=lab(H,S(['gr_5_3','gr_6_3']),{allies:2,foes:3}); ({v,A}=L); a=A[0]; const b=A[1]; for(const x of [a,b]) x.maxHp=1e6; noBees(L);
  b.hots.length=0; v.hp=v.maxHp; b.hp=b.maxHp*0.5; a.hp=a.maxHp*0.2; a.hots.length=0; const hb=b.hp, ha=a.hp; V.cast(v,'blue'); secs(0.5);
  const ga=a.hp-ha, k=0.40*(1+0.05*3), ah=a.hots[a.hots.length-1], bh=b.hots[b.hots.length-1]; assert.ok(bh,'Runny Honey: its neighbour gets a drip');
  near(bh.hps,ah.hps*k,'its heal over time at 40% (Shared Jar 5% x 3 more)'); near(b.hp-hb,ga*k,'and its heal at 40% x 1.15',1e-3); assert.equal(ah.remaining,5,'(no Thick Honey: 5 s)');
});

test('Mellan / his workers: Kind Rule, Steady Colony, Loose Grip (RISK), Spent Colony (RISK), Forty Thousand above 50 Colony, Every Hive Within a Day (two above 75), New Hatch',()=>{
  const L=lab(H,S(['gr_3_4','gr_10_3','ls_6_4','rm_6_1','rm_1_3','rm_2_3','rm_3_3']),{allies:2,foes:3}), {v,A}=L, a=A[0];
  setStack(L,'col',60); near(pulse(L,a,0.6)/BASE(L,a),1+0.15-0.10+0.08+0.05,'above 50: Kind Rule 15%, Loose Grip -10%, Spent Colony 8%, Forty Thousand 5%'); near(stack(L,'col'),59+4.2*V.STEP,'one Colony spent (and New Hatch over the step)',1e-6);
  setStack(L,'col',40); near(pulse(L,a,0.4)/BASE(L,a),1+0.15-0.10+0.08+0.12,'Steady Colony 4% x 3 below 50% HP; Forty Thousand not at 40 Colony');
  setStack(L,'col',90); near(pulse(L,a,0.6)/BASE(L,a),2*(1+0.15-0.10+0.08+0.05),'Every Hive Within a Day: above 75, two workers'); near(stack(L,'col'),88+4.2*V.STEP,'(two Colony)',1e-6);
  setStack(L,'col',0); near(pulse(L,a,0.6)/BASE(L,a),1+0.15-0.10+0.08,'an empty Colony: the worker still heals');
  noBees(L); setStack(L,'col',10); secs(1); near(stack(L,'col'),10+6*0.7,'New Hatch 2 x 3 a second, 30% slower with Spent Colony',0.01); void v;
});

test('Mellan / his per-second talent healing stays inside the regeneration cap (1.2% of max HP a second on one unit)',()=>{
  const L=lab(H,S(['gr_3_4','gr_10_3','rm_1_3','rm_2_3','rm_3_3','gr_1_2','gr_3_1']),{allies:2,foes:3}), {A}=L, a=A[0]; a.maxHp=a.hp=2000;
  setCells(L,a,3); let sum=0, n=0; const t0=V.now(), b=BASE(L,a); for(let i=0;i<10;i++){ setStack(L,'col',100); a.hp=a.maxHp*0.3; sum+=pulse(L,a); n++; secs(0.47); }
  const dt=V.now()-t0, extra=sum-n*b, cap=a.maxHp*0.012;
  assert.ok(extra<=cap*(dt+1)+1e-6,'what talents add is at most 1.2% of its max HP a second (and one second banked): '+extra.toFixed(1)+' of '+(cap*(dt+1)).toFixed(1));
  assert.ok(extra>cap*dt*0.8,'(and the cap is what binds here: '+extra.toFixed(1)+')');
});

test('Mellan / Guarding Workers: an ally below 40% calls the nearest other worker until it climbs back; Many Workers',()=>{
  const L=lab(H,S(['gr_7_3','gr_9_3']),{allies:2,foes:3}), {v,A}=L, a=A[0], b=A[1]; for(const x of [a,b]) x.maxHp=1e6; v.x+=12*V.METER;
  a.hp=a.maxHp*0.3; b.hp=b.maxHp*0.8; v.hp=v.maxHp*0.9;
  near(pulse(L,a),BASE(L,a),'its own worker heals it as usual');
  const h=a.hp, hb=b.hp; pulse(L,b); near(a.hp-h,BASE(L,a)*1.15,'the nearest other worker heals it instead (Many Workers 3% x 5)'); near(b.hp,hb,'and not its own ally');
  const h1=a.hp; pulse(L,v); near(a.hp,h1,'Mellan (farther) is not called');
  a.hp=a.maxHp*0.45; const h3=a.hp, hb3=b.hp; pulse(L,b); near(a.hp,h3,'back above 40%: the worker goes home'); near(b.hp-hb3,BASE(L,b),'');
});

test('Mellan / Brood: The Brood (an ally falls: its worker comes home, max 4), Raised Again, Busy Season, Second Brood, Nursery (inside the cap), Stung Hands',()=>{
  const L=lab(H,S(['gr_4_4','gr_5_4','gr_9_4','gr_12_4','gr_8_4','gr_6_4']),{allies:3,foes:3,big:true}), {v,A,F}=L;
  setStack(L,'brood',0); kill(L,A[0],F[1]); V.step(1); assert.equal(stack(L,'brood'),1,'an ally falls: 1 Brood');
  near(pulse(L,A[1],0.5)/BASE(L,A[1]),1.05,'each Brood: every other worker 1% x 5 more');
  assert.ok(mark(L,F[1],'stH'),'Stung Hands: the enemy that struck it down'); near(hitOn(L,A[1],1000,{src:F[1]}),1000*(1-0.16),'deals 8% x 2 less for 6 s'); secs(6.05); near(hitOn(L,A[1],1000,{src:F[1]}),1000,'6 s');
  setStack(L,'brood',0); near(ratioIn(L,v),1,'no Brood: Raised Again nothing');
  setStack(L,'brood',6); near(ratioIn(L,v),1-0.03*6,'Raised Again: 1% x 3 per Brood (6 with Second Brood)');
  near(FX.cd(v,'blue',8),8-0.5*6,'Busy Season: each Brood 0.1 x 5 s sooner');
  assert.equal(FXN.mech(H).states.brood.max.b,4,'Brood at most 4'); assert.equal(L.T.st.brood.max,6,'+1 a rank of Second Brood');
  v.maxHp=1e4; v.hp=v.maxHp*0.4; noBees(L); L.T.s.me.ns=0; const h=v.hp; secs(2.02); near(v.hp-h,2*v.maxHp*0.012,'Nursery: 0.5% x 2 per Brood a second (6%), cut to the 1.2% cap',1e-3);
});

test('Mellan / his damage reduction on hits on him: one group capped at 35% (Raised Again, Calm King, River Country, Unflinching, A Man with a Grudge, Steady Hive, The New Ones, Low Gold Weather)',()=>{
  const L=lab(H,S(['gr_4_4','gr_5_4','gr_12_4','gr_11_1','gr_11_4','ls_1_1','ls_1_4','ls_11_1','rm_9_1','rm_11_4','rm_1_3','gr_8_2']),{allies:2,foes:3,big:true}), {v,F}=L; noBees(L);
  setStack(L,'brood',0); setStack(L,'col',40);
  const r1=ratioIn(L,v); near(r1,(1-0.075)*(1-0.05)*(1-0.025),'Calm King 7.5% (every ally has a worker), Steady Hive 5%, Low Gold Weather 2.5% (he has a worker)');
  near(ratioIn(L,v,{kind:'magic'}),r1*(1-0.05),'River Country: magic 1% x 5 less');
  setStack(L,'col',60); near(ratioIn(L,v),r1*(1-0.075),'The New Ones: Colony above 50');
  setMk(L,F[0],'pt'); setUst(L,F[0],'welt',1); setStack(L,'brood',6); near(ratioIn(L,v),0.65,'everything at once: capped at 35%');
  setStack(L,'brood',0); setStack(L,'col',40); F[0]._talM={}; near(ratioIn(L,v),r1,'');
  setMk(L,F[0],'pt'); near(ratioIn(L,v),r1*(1-0.09),'Unflinching: 3% x 3 from the Pointed enemy');
  F[0]._talM={}; setUst(L,F[0],'welt',2); near(ratioIn(L,v),r1*(1-0.075),'A Man with a Grudge: from an enemy with Welts'); F[0]._talM={};
  const d0=v.hp; VMX('(t,s)=>pushDot(t,100,1,1,"#fff",s,"true")')(v,F[2]); secs(1.1); near(d0-v.hp,100*r1,'his group on damage over time too',1e-3);
});

test('Mellan / hits on his allies: Low Gold Weather, Grudge Kept, Settle on Him (Swarmed), Heavy Swarm, Honey Hands; capped at 25%',()=>{
  const L=lab(H,S(['gr_8_2','ls_1_1','ls_4_1','rm_2_2','rm_4_2','rm_7_4','gr_1_2','gr_6_2','gr_6_4']),{allies:2,foes:3}), {A,F}=L, a=A[0]; a.maxHp=1e6;
  near(hitOn(L,a,1000)/1000,1-0.025,'Low Gold Weather: an ally with a worker 0.5% x 5 less');
  setMk(L,F[0],'pt'); F[0].target=a; near(hitOn(L,a,1000)/1000,(1-0.025)*(1-0.05),'Grudge Kept: the Pointed enemy, on the ally it attacks, 1% x 5 less'); F[0].target=A[1]; near(hitOn(L,a,1000)/1000,1-0.025,'not on another'); F[0]._talM={};
  a.hp=a.maxHp*0.36; V.step(1); assert.ok(!mark(L,a,'sw'),'not at 36%'); a.hp=a.maxHp*0.34; V.step(1); assert.ok(mark(L,a,'sw'),'Settle on Him: below 35%: Swarmed'); near(left(L,a,'sw'),3+1.5,'3 s + Heavy Swarm 0.5 x 3',0.02);
  near(hitOn(L,a,1000)/1000,(1-0.025)*(1-0.10),'2% x 5 less while Swarmed');
  near(pulse(L,a,0.34)/BASE(L,a),1.10,'Honey Hands: his heals 2% x 5 stronger on it');
  const u0=a._talM[L.v.uid].sw.until; a.hp=a.maxHp*0.5; V.step(1); a.hp=a.maxHp*0.3; V.step(1); near(a._talM[L.v.uid].sw.until,u0,'once every 12 s per ally');
  setCells(L,a,3); setMk(L,F[0],'pt'); setMk(L,F[0],'stH'); F[0].target=a; near(hitOn(L,a,1000)/1000,0.75,'everything at once: capped at 25%');
  F[0]._talM={}; secs(4.6); assert.ok(!mark(L,a,'sw')); assert.ok(mark(L,a,'swh'),'Honey Hands: 3 s after the swarm lifts'); secs(3.05); assert.ok(!mark(L,a,'swh'));
});

test('Mellan / Close Swarm (inside the cap) and They Die for Him (once a wave, 30 Colony)',()=>{
  const L=lab(H,S(['rm_2_2','rm_8_4','rm_9_4','rm_1_3']),{allies:2,foes:3}), {F,A}=L, a=A[0]; a.maxHp=a.hp=1e4;
  a.hp=a.maxHp*0.36; V.step(1); a.hp=a.maxHp*0.34; V.step(1); assert.ok(mark(L,a,'sw')); noBees(L); L.T.s.me.ns=0; const h=a.hp; secs(1.02); near(a.hp-h,a.maxHp*0.012,'Close Swarm: 1% x 3 a second, cut to the 1.2% cap',1e-3);
  setStack(L,'col',50); a.hp=5; a.shield=0; V.hit(F[0],a,1000,{kind:'true'}); assert.ok(a.alive&&a.hp>=1,'They Die for Him: a Swarmed ally that would die stays at 1 HP'); near(stack(L,'col'),20,'the Colony loses 30');
  setStack(L,'col',50); a.hp=5; V.hit(F[0],a,1000,{kind:'true'}); assert.ok(!a.alive,'once a wave');
});

/* ============================== THE LEASH ============================== */
test('Mellan / Pointed: He Points (the enemy at the cloud\'s centre, 6 s, 2% x 5), Long Leash, Angry Hornets, Leashed Fury, Hornet Season, No Mercy, Marked Again',()=>{
  const L=lab(H,S(['ls_1_1','ls_2_1','ls_1_3','ls_10_1','ls_9_3','ls_9_1','ls_8_1']),{allies:2,foes:3}), {v,F}=L; for(const f of F) f.maxHp=f.hp=1e9;
  const b=cloud(L,F[0]); assert.ok(mark(L,F[0],'pt'),'He Points'); near(left(L,F[0],'pt'),9,'6 s + Long Leash 1 x 3',0.01); assert.ok(!mark(L,F[1],'pt'));
  near(stingR(L,b,F[0]),1+0.10+0.10+0.09,'Angry Hornets 10%, He Points 10%, Leashed Fury 9% on the Pointed one');
  F[0].hp=F[0].maxHp*0.55; near(stingR(L,b,F[0]),1+0.10+0.10+0.09,'not at 55%'); F[0].hp=F[0].maxHp*0.4; near(stingR(L,b,F[0]),1+0.10+0.10+0.09+0.15,'Hornet Season: below 50% 3% x 5');
  F[0].hp=F[0].maxHp*0.25; near(stingR(L,b,F[0]),(1+0.10+0.10+0.09+0.15)*2,'No Mercy: Pointed and below 30%, double');
  F[0].hp=1; F[0].shield=0; V.hit(v,F[0],100,{kind:'true'}); V.step(1); assert.ok(mark(L,F[1],'pt'),'Marked Again: the nearest enemy is Pointed'); near(left(L,F[1],'pt'),3,'1 x 3 s',0.02); assert.ok(!mark(L,F[2],'pt'));
});

test('Mellan / the cloud: Wide Cloud, One Target (half the area, 40%), Long Poison, Stinger Swarm, Sharp Sting (its first sting), Bad War; Free Rein (30% wider, drifting)',()=>{
  const d0=lab(H,null,{allies:2,foes:3}); const p0=cloud(d0,d0.F[0]).dps;
  let L=lab(H,S(['ls_2_3','ls_5_2','ls_5_1','ls_10_3','ls_3_4','ls_6_1']),{allies:2,foes:3}), {F}=L;
  let b=cloud(L,F[0]); near(b.R,2.8*V.METER*1.09*Math.SQRT1_2,'Wide Cloud 3% x 3, One Target: half the area (radius x 0.71)'); near(b.life,4+1,'Long Poison 0.2 x 5 s');
  near(b.dps/p0,1+5/8,'Stinger Swarm: 5 more stings of its 8 (its damage x 13/8)');
  const s1=stingR(L,b,F[0]), s2=stingR(L,b,F[0]); near(s1/s2,(1+0.40+0.20)/(1+0.40),'Sharp Sting: its first sting on each enemy 4% x 5 more'); near(s2,1.40*1.10,'One Target 40%, Bad War 2% x 5 (magic)');
  L=lab(H,S(['ls_5_3']),{allies:2,foes:3}); ({F}=L); b=cloud(L,F[0]); near(b.R,2.8*V.METER*1.30,'Free Rein: 30% wider');
  at(L,F[0],30,30); const cx=b.cx; sting(L,b,F[1]); near((b.cx-cx)/V.METER,0.5,'and it drifts 1 m a second toward the nearest enemy',1e-6);
});

test('Mellan / Swarm Cloud (20 Colony: a 20% slow), Thick Cloud; Running Wild with Free Rein',()=>{
  let L=lab(H,S(['rm_7_2','rm_9_2','rm_1_3']),{allies:2,foes:3}), {F}=L; const f=F[0];
  setStack(L,'col',50); const b=cloud(L,f); near(stack(L,'col'),30,'it spends 20 Colony'); sting(L,b,f); near(f.slowMul,0.8,'every enemy inside slowed 20%'); near(f.slow,0.6+1.0,'Thick Cloud: 0.2 x 5 s longer',0.03);
  b.life=0; V.step(2); f.slow=0; f.slowMul=null; setStack(L,'col',10); const b2=cloud(L,f); near(stack(L,'col'),10,'without 20 Colony: no bees'); sting(L,b2,f); assert.ok(!(f.slow>0),'and no slow');
  L=lab(H,S(['ls_5_3','ls_6_3']),{allies:2,foes:3}); ({F}=L); sting(L,cloud(L,F[0]),F[0]); near(F[0].slowMul,1-0.12,'Running Wild: 4% x 3');
});

test('Mellan / Welts: Rising Welts (1 a second in the cloud, max 5, 0.5% x 5 slower each), Swelling, Tight Knot',()=>{
  const base=lab(H,null,{allies:2,foes:3}).F[0].atkInterval;
  const L=lab(H,S(['ls_2_2','ls_4_2','ls_5_2','ls_6_2']),{allies:2,foes:3}), g=L.F[0];
  const b=cloud(L,g); sting(L,b,g); assert.equal(ust(L,g,'welt'),1); sting(L,b,g); assert.equal(ust(L,g,'welt'),1,'one a second'); secs(1.0); assert.equal(ust(L,g,'welt'),2,'the next second');
  V.step(1); near(g.atkInterval,base/(1-0.025*2),'each Welt: 0.5% x 5 slower');
  delete g._talM[L.v.uid].weltL; sting(L,b,g); near(g._talM[L.v.uid]['#welt'].until-V.now(),5+3,'they last 5 s + Swelling 1 x 3 after the last gain',0.01);
  setUst(L,g,'welt',4); delete g._talM[L.v.uid].weltL; const d4=sting(L,b,g); assert.equal(ust(L,g,'welt'),5); const d5=sting(L,b,g); near(d5/d4,(1+0.40+0.09)/(1+0.40),'Tight Knot: at 5 Welts 3% x 3 more (with One Target)');
  delete g._talM[L.v.uid].weltL; sting(L,b,g); assert.equal(ust(L,g,'welt'),5,'max 5');
});

test('Mellan / Hard Bargain (a seeded 6% x 5 of basic attacks raise a Welt) and Hornet Nectar (enemies that hit its ally gain 2 Welts), Sticky Smell',()=>{
  let L=lab(H,S(['ls_7_1','ls_2_2']),{allies:2,foes:3}), {v,A,F}=L; let n=0; for(let i=0;i<400;i++){ F[1]._talM={}; V.hit(v,F[1],1,{kind:'true',auto:true}); if(ust(L,F[1],'welt')>0) n++; }
  console.log('  Hard Bargain: '+n+' of 400 basic attacks raised a Welt'); assert.ok(n>95&&n<130,'about 30% of 400 basic attacks: '+n); F[1]._talM={}; for(let i=0;i<50;i++) V.hit(v,F[1],1,{kind:'true'}); assert.equal(ust(L,F[1],'welt'),0,'not a skill hit');
  L=lab(H,S(['ls_7_2','ls_9_2','ls_2_2']),{allies:2,foes:3}); ({v,A,F}=L); const a=A[0]; nectar(L,a,0.3); assert.ok(mark(L,a,'smell'),'its smell while the heal over time runs');
  hitOn(L,a,10,{src:F[2]}); assert.equal(ust(L,F[2],'welt'),2,'an enemy that hits it gains 2 Welts'); near(F[2]._talM[v.uid]['#welt'].until-V.now(),5+1.5,'Sticky Smell: 0.3 x 5 s longer',0.01);
  secs(5.1); hitOn(L,a,10,{src:F[1]}); assert.equal(ust(L,F[1],'welt'),0,'the smell is gone with the heal over time');
});

test('Mellan / Fed: Eat Well (each enemy the cloud kills, 2% x 3 each), Full Bellies, Bold Hornets, Never Refused, Hunting Hornets, Glutton',()=>{
  const L=lab(H,S(['ls_4_4','ls_8_4','ls_5_4','ls_7_4','ls_10_4','ls_12_4']),{allies:2,foes:3,big:true}), {v,F}=L; noBees(L);
  setStack(L,'fed',0); const b=cloud(L,F[0]); const s0=stingR(L,b,F[0]); near(s0,1,'no Fed: the plain sting');
  F[0].hp=1; F[0].shield=0; v.energy=0; v.hp=v.maxHp*0.5; const h=v.hp; sting(L,b,F[0]); assert.ok(!F[0].alive); assert.equal(stack(L,'fed'),1,'a cloud kill Feeds the hornets');
  near(v.hp-h,v.maxHp*0.025,'Never Refused: 0.5% x 5 of his max HP',1e-6); near(v.energy,6,'Hunting Hornets: 2 x 3 energy');
  at(L,F[1],4.5,0); near(stingR(L,b,F[1]),1.06,'each Fed: 2% x 3 more');
  setStack(L,'fed',2); near(FX.cd(v,'green',7),7,'Bold Hornets: not under 3 Fed'); setStack(L,'fed',3); near(FX.cd(v,'green',7),7-0.5,'at 3 or more: 0.1 x 5 s sooner');
  V.step(1); const a0=v.atkInterval; setStack(L,'fed',7); V.step(1); near(a0/v.atkInterval,(1+0.009*7)/(1+0.009*3),'Glutton: 0.3% x 3 attack speed per Fed');
  assert.equal(FXN.mech(H).states.fed.max.b,5,'Fed at most 5'); assert.equal(L.T.st.fed.max,7,'Full Bellies 1 x 2 more');
});

test('Mellan / Never Asked (an enemy dies inside it: 1 x 2 s longer, once a cloud), Let Them Go (2 s more on the Pointed enemy), Loose Grip on the cloud',()=>{
  const L=lab(H,S(['ls_12_1','ls_1_1','ls_2_1','ls_3_1','ls_6_4']),{allies:2,foes:3,big:true}), {v,F}=L;
  const b=cloud(L,F[0]), life=b.life; sting(L,b,F[0]); kill(L,F[0]); near(b.life,life+2,'Never Asked: an enemy died inside it');
  at(L,F[2],4.5,0.5); kill(L,F[2]); near(b.life,life+2,'once a cloud');
  at(L,F[1],4.5,0); near(stingR(L,b,F[1]),1+0.10,'Loose Grip: the cloud 5% x 2 more (F1 is not Pointed)');
  setMk(L,F[1],'pt',30); b._talR.pt=F[1]; at(L,F[1],20,20); b.tt=b.life+1; const h=F[1].hp; V.step(2); secs(0.55); assert.ok(F[1].hp<h,'Let Them Go: the hornets chase the Pointed enemy wherever it goes');
  const hc=F[1].hp; secs(1.6); const h2=F[1].hp; assert.ok(h2<hc); secs(1); assert.equal(F[1].hp,h2,'for 2 s'); void v;
});

/* ============================== HIVE MIND ============================== */
test('Mellan / Hive Mind: Hornets in the Hive (each share of stings Points and 5 Welts), Hive Mind Honey (2 cells a share, the store into the team), Golden Comb',()=>{
  const L=lab(H,S(['ls_11_2','ls_2_2','gr_11_3','gr_12_3','gr_2_3','gr_1_2']),{allies:2,foes:9,big:true}), {v,A,F}=L;
  setStack(L,'store',v.maxHp*0.2); for(const x of [v].concat(A)) x.hp=x.maxHp*0.5; const h0=A[0].hp; V.cast(v,'ult'); near(stack(L,'store'),0,'Hive Mind Honey: the store emptied into the team');
  near(A[0].hp-h0,v.maxHp*0.2/3,'(shared evenly by the 3 of his side)',1e-6); secs(3.5);
  for(const f of F){ assert.ok(mark(L,f,'pt'),'each enemy stung is Pointed'); assert.equal(ust(L,f,'welt'),5,'with 5 Welts'); }
  for(const x of [v].concat(A)) assert.equal(cells(L,x),6,'2 Comb cells a share of honey (12 units: 3 shares each for his side)');
  const a=A[0]; a.maxHp=1e6; a.hp=a.maxHp*0.5; noBees(L); setCells(L,a,1,1); const h=a.hp; hitOn(L,a,10); V.step(1); near(a.hp-(h-10),a.maxHp*(0.05+0.01),'its cells heal as Wax Cells\' (1% x 5) + Golden Comb 0.2% x 5',1e-6);
});

test('Mellan / Gold Rain on Hive Mind real shares (each share of honey as it lands)',()=>{
  const L=lab(H,S(['rm_6_3']),{allies:2,foes:3,big:true}), {v,A}=L, a=A[0]; noBees(L);
  const one=()=>{ for(const x of [v].concat(A)) x.hp=x.maxHp*0.5; const h=a.hp; V.cast(v,'ult'); secs(3.5); return a.hp-h; };
  const p=plainHit(L,one), g=one(); assert.ok(p>0); near(g/p,1.10,'Gold Rain: 2% x 5 on every share of honey that lands');
});
test('Mellan / Hive Mind\'s shares: Every Sting, Gold Rain, Fair Rule; Royal Share (PICK ONE) and Crown\'s Due; Fair Shares (PICK ONE) and Even Hand; Count the Fallen',()=>{
  const healOn=(L,x)=>{ x.hp=x.maxHp*0.5; const h=x.hp; L.T.s.cur='hive'; try{ VMX('healUnit')(x,1000); } finally{ L.T.s.cur=null; } return x.hp-h; };
  const stingOn=(L,t)=>{ const h=t.hp; L.T.s.cur='hive'; try{ V.hit(L.v,t,1000,{kind:'true'}); } finally{ L.T.s.cur=null; } return h-t.hp; };
  let L=lab(H,S(['ls_12_2','rm_6_3','gr_12_2','rm_5_2','rm_6_2','rm_10_2']),{allies:2,foes:3}), {v,A,F}=L;
  for(const x of [v].concat(A)) x.hp=x.maxHp*0.9; A[1].hp=A[1].maxHp*0.2; F[2].dmg=1e6; V.cast(v,'ult'); noHive(L);
  near(healOn(L,A[0]),1000*(1+0.10+0.15),'Gold Rain 2% x 5, Fair Rule 3% x 5 (no Comb cells)'); near(healOn(L,A[1]),1000*(1+0.10+0.15)*2,'Royal Share: the weakest ally at the cast, double');
  near(stingOn(L,F[0]),1000*1.10,'Every Sting 2% x 5'); near(stingOn(L,F[2]),1000*1.10*2*1.15,'Royal Share: the strongest enemy double, Crown\'s Due 5% x 3 more');
  L.T.s.me.lost=7; near(stingOn(L,F[0]),1000*(1.10+0.06*5),'Count the Fallen: 2% x 3 per worker lost, up to 5');
  L=lab(H,S(['rm_5_4','rm_6_4']),{allies:2,foes:3}); ({v,A,F}=L); near(healOn(L,A[0]),1000*1.24,'Fair Shares 15%, Even Hand 3% x 3'); near(stingOn(L,F[0]),1000*1.15,'every share 15% larger');
  L=lab(H,S(['rm_10_2']),{allies:3,foes:3,big:true}); ({v,A,F}=L); kill(L,A[0],F[0]); kill(L,A[1],F[0]); V.step(1); assert.equal(L.T.s.me.lost,2,'Count the Fallen counts workers lost (allies that fell)');
});

/* ============================== REPLACED BY MORNING ============================== */
test('Mellan / the Colony: a full 100 each wave, Kept by Morning (110, carried), Patient Swarm (a seeded free heal), Hive Song',()=>{
  const L=lab(H,S(['rm_1_3','rm_2_3','rm_8_3','rm_3_1','rm_10_3']),{allies:2,foes:3,big:true}), {v,A,F}=L;
  near(stack(L,'col'),100,'a full Colony at the wave start (and New Hatch since)',0.01); near(hitOn(L,F[0],1000,{src:A[0]}),1000,'Hive Song: not while it is not full (max 110)');
  setStack(L,'col',110); near(hitOn(L,F[0],1000,{src:A[0]}),1050,'Hive Song: full: allies deal 1% x 5 more'); near(hitOn(L,F[0],1000,{src:v}),1050,'Mellan too');
  setStack(L,'col',107); V.wave(); V.step(1); near(stack(L,'col'),107,'Kept by Morning: the next wave starts with what was above 100',0.01);
  let free=0; for(let i=0;i<300;i++){ setStack(L,'col',50); pulse(L,A[0],0.5); if(stack(L,'col')>=49.6) free++; } assert.ok(free>35&&free<85,'Patient Swarm: a seeded 4% x 5 of worker heals cost nothing: '+free+' of 300');
});

test('Mellan / Hive of Morning and Dawn Hatch; Whether They Know (SIGNATURE): every Hive Mind refills the Colony and Swarms every ally 3 s',()=>{
  let L=lab(H,S(['rm_11_2','rm_12_2','rm_1_3']),{allies:2,foes:3}), {v,A}=L; setStack(L,'col',5); for(const x of [v].concat(A)) x.hp=x.maxHp*0.5; V.cast(v,'ult'); near(stack(L,'col'),100,'Hive of Morning: the whole Colony');
  const a=A[0]; let best=0; for(let i=0;i<120;i++){ V.step(1); best=Math.max(best,left(L,a,'sw')); } assert.ok(best>3.2&&best<=3.5+1e-6,'each share of honey Swarms its ally 2 s + Dawn Hatch 0.3 x 5: '+best.toFixed(2));
  L=lab(H,S(['rm_13_2','rm_1_3']),{allies:2,foes:3,big:true}); ({v,A}=L); setStack(L,'col',10); V.cast(v,'ult'); near(stack(L,'col'),100,'Whether They Know: the whole Colony');
  for(const x of [v].concat(A)){ assert.ok(mark(L,x,'sw'),'every ally Swarmed'); near(left(L,x,'sw'),3,'3 s',0.01); }
});

test('Mellan / Whether They Know: 10 s after an ally falls worker heals cost no Colony and every enemy it fought is Barbed',()=>{
  const L=lab(H,S(['rm_13_2','rm_1_3']),{allies:3,foes:3,big:true}), {A,F}=L; F[1].target=A[0]; A[0].target=F[2];
  kill(L,A[0],F[0]); V.step(1); for(const f of F) assert.ok(mark(L,f,'barb'),'Barbed: its killer, the enemy fighting it, the enemy it fought');
  setStack(L,'col',50); pulse(L,A[1],0.5); near(stack(L,'col'),50,'worker heals cost no Colony'); secs(10.05); pulse(L,A[1],0.5); near(stack(L,'col'),49,'for 10 s');
});

test('Mellan / Barbed: Last Sting (the killer, 2% x 5 more taken), Sting and Die, Deep Barb, Wild Barbs, Broken Stinger, Barb Spread',()=>{
  let L=lab(H,S(['rm_4_1','rm_12_1','rm_5_1','rm_7_1','rm_8_1','rm_10_1']),{allies:3,foes:3,big:true}), {v,A,F}=L;
  kill(L,A[0],F[0]); V.step(1); assert.ok(mark(L,F[0],'barb'),'Last Sting: the enemy that struck the killing blow is Barbed'); assert.ok(!mark(L,F[1],'barb'));
  near(hitOn(L,F[0],1000,{src:A[1]}),1000*(1+0.10+0.02),'it takes 2% x 5 + Sting and Die 1% x 2 more, from anyone of his side'); near(hitOn(L,F[1],1000,{src:A[1]}),1000);
  F[0].hp=F[0].maxHp*0.5; const h=F[0].hp; VMX('healUnit')(F[0],1000); near(F[0].hp-h,1000*(1-0.09),'Deep Barb: 3% x 3 less healing');
  const b=cloud(L,F[0]); near(stingR(L,b,F[0]),1.12*1.12,'Wild Barbs: the cloud 4% x 3 more (and Barbed itself 12%)');
  v.maxHp=1e4; v.hp=v.maxHp*0.5; noBees(L); const hv=v.hp; kill(L,F[0],A[1]); V.step(1); near(v.hp-hv,v.maxHp*0.10,'Broken Stinger: a Barbed enemy dies: 2% x 5 of his max HP',1e-3);
  assert.ok(mark(L,F[1],'barb'),'Barb Spread: the nearest enemy'); assert.equal(left(L,F[1],'barb'),Infinity,'(rank 2: for the rest of the wave)');
  L=lab(H,[['rm_4_1',5],['rm_8_1',1]],{allies:3,foes:3,big:true}); ({v,A,F}=L); kill(L,A[0],F[0]); V.step(1); kill(L,F[0],A[1]); V.step(1);
  assert.ok(mark(L,F[1],'barb')); near(left(L,F[1],'barb'),5,'rank 1: 5 s',0.01);
});

/* ============================== SIGNATURES and smaller ones ============================== */
test('Mellan / A Crown of Small Subjects (SIGNATURE): 8 s after Hive Mind workers heal three times, every hit breaks a cell rebuilt at once (once a second), the Brood guard',()=>{
  const L=lab(H,S(['gr_13_3','gr_1_2','gr_4_4']),{allies:2,foes:3}), {v,A}=L, a=A[0]; a.maxHp=1e6;
  V.cast(v,'ult'); noHive(L); assert.ok(win(L,'crown')); near(pulse(L,a,0.5)/BASE(L,a),3,'worker heals tripled');
  setCells(L,a,0); a.hp=a.maxHp*0.5; const h=a.hp; hitOn(L,a,10); V.step(1); near(a.hp-(h-10),a.maxHp*0.05,'a hit breaks a cell though none is set (1% x 5)',1e-6); assert.equal(cells(L,a),0,'rebuilt at once');
  const h2=a.hp; secs(0.5); hitOn(L,a,10); V.step(1); near(a.hp-(h2-10),0,'at most once a second',1e-6); secs(0.5); const h3=a.hp; hitOn(L,a,10); V.step(1); assert.ok(a.hp>h3);
  setStack(L,'brood',2); noBees(L); a.hp=a.maxHp*0.2; v.hp=v.maxHp; A[1].hp=A[1].maxHp; L.T.s.me.bg=0; const h4=a.hp; secs(0.52); near(a.hp-h4,BASE(L,a)*2,'each Brood heals the most wounded ally as a worker does',1e-3);
  secs(8); near(pulse(L,a,0.5)/BASE(L,a),1+0.05*2,'8 s (then The Brood 1% x 5 per Brood)');
});

test('Mellan / Off the Leash (SIGNATURE): 8 s after Hive Mind every enemy is Pointed; a hornet\'s sting finishes an enemy under 10% (Feeding); a boss takes 8% of its max HP instead, once a Hive Mind',()=>{
  const L=lab(H,S(['ls_13_2','ls_1_1','ls_4_4']),{allies:2,foes:3}), {v,F}=L; for(const f of F) f.maxHp=f.hp=1e7;
  V.cast(v,'ult'); noHive(L); assert.ok(win(L,'otl')); setStack(L,'fed',0);
  const b=cloud(L,F[1]); near(stingR(L,b,F[1]),1.10,'every enemy Pointed (He Points 2% x 5)');
  F[1].hp=F[1].maxHp*0.11; sting(L,b,F[1]); assert.ok(F[1].alive,'at 11%: not'); F[1].hp=F[1].maxHp*0.09; sting(L,b,F[1]); assert.ok(!F[1].alive,'under 10%: finished'); assert.equal(stack(L,'fed'),1,'Feeding the hornets');
  const boss=F[2]; boss.t=Object.assign({},boss.t,{isboss:true}); at(L,boss,10.5,0); boss.hp=boss.maxHp*0.09; const hb=boss.hp; sting(L,b,boss); assert.ok(boss.alive,'a boss is not finished');
  const p=plainHit(L,()=>sting(L,b,boss)), h2=boss.hp, s2=sting(L,b,boss); near(s2/p,1.10+0.06,'once a Hive Mind: then plain stings (Pointed, 1 Fed)',1e-3);
  near(hb-h2-p,boss.maxHp*0.08+s2,'it took 8% of its max HP (with the sting)',1e-3);
  secs(8.1); assert.ok(!win(L,'otl'));
});

test('Mellan / Soft Hands (5% x 3, capped at 20%) and Low Hum (3% x 3 reach)',()=>{
  const r0=lab(H,null,{allies:0,foes:1}).v.range;
  const L=lab(H,S(['gr_1_1','rm_1_4']),{allies:0,foes:1}), {v,F}=L; near(v.range,r0*1.09,'Low Hum');
  near(FX.cc(F[0],v,'stunned',2),2*0.85,'Soft Hands: 15% shorter'); assert.equal(FXN.mech(H).talents.gr_1_1[0].upTo,0.20,'capped at 20%');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Mellan: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['gr_1_2','gr_2_2','gr_2_3','ls_1_1','ls_2_2','ls_4_4','rm_1_3','rm_2_2','rm_4_1']), TEAM=['vael','sylthaine','vireo','vex','mellan'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let pt=false,wl=0,cb=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.pt&&o.pt.until>V.now()) pt=true; if(o['#welt']&&o['#welt'].until>V.now()) wl++; }
    const M=T0.me; if(M) for(const k in M.cb) cb=Math.max(cb,M.cb[k].n); }
  console.log('  live fight: max '+JSON.stringify(mx)+', Pointed '+pt+', ticks with an enemy carrying Welts '+wl+', most Comb cells '+cb);
  assert.ok(pt,'a real Pointed'); assert.ok(wl>0,'real Welts'); assert.ok(cb>=6,'a real Comb'); assert.ok(mx.store>0,'a real Hive store'); assert.ok(mx.col>0,'a real Colony');
  determinism(H,TEAM);
});

/* The page sites his talents added (Hornet Cloud's centre; each sting tick of the cloud; Royal Nectar's landing; each share of Hive Mind; each worker pulse): with
   nothing learned, whole seeded fights with Mellan in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASEH=null; try{ BASEH=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Mellan: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASEH},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['mellan','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASEH); assert.deepEqual(a,b);
  VMX('var __mlN={cloud:0,tick:0,nectar:0,share:0,pulse:0}; var __mlD=_doEffectCore, __mlB=beeLand, __mlG=spawnHoneyGlob, __mlU=updateBees;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="mellan"&&type==="hornetswarm") __mlN.cloud++; return __mlD.apply(this,arguments); };'+
    'beeLand=function(u,t,c){ if(u&&u.key==="mellan") __mlN.share++; return __mlB.apply(this,arguments); };'+
    'spawnHoneyGlob=function(u,t,f){ if(u&&u.key==="mellan") __mlN.nectar++; return __mlG.apply(this,arguments); };'+
    'updateBees=function(dt){ for(const b of _bees){ if(b.u&&b.u.key==="mellan"){ if(b.ph===5&&b.acc+dt>=b.tick) __mlN.tick++; if(b.ph===8&&b.acc+dt>=0.5) __mlN.pulse++; } } return __mlU.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASEH,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASEH,b,fo(BASEH)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASEH,fo(BASEH),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__mlN'); console.log('  identity / base skills: '+JSON.stringify(c));
    assert.ok(c.cloud>0&&c.tick>0&&c.nectar>0&&c.share>0&&c.pulse>0,'the fights cast Hornet Cloud and stung, landed Royal Nectar, landed Hive Mind shares and pulsed his workers: every new site was run'); }
  finally{ VMX('_doEffectCore=__mlD; beeLand=__mlB; spawnHoneyGlob=__mlG; updateBees=__mlU;'); }
  assert.ok(n>=18);
});

/* Every page site of his is reached by a talented Mellan and carries the right skill (casting) to his rows */
test('Mellan: each page site his talents added runs his rows, with the skill it resolves (a scripted definition)',()=>{
  const seen={};
  const def={hero:H,casting:true,points:true,always:[
    {on:'at',skill:'hornetswarm',do:[{fn:'s',k:'at'}]}, {on:'partPre',skill:'hornet',do:[{fn:'s',k:'hcPre'}]}, {on:'part',skill:'hornet',do:[{fn:'s',k:'hcPost'}]},
    {on:'out',if:{casting:'hornet'},do:[{fn:'s',k:'hcOut'}]}, {on:'partPre',skill:'nectar',do:[{fn:'s',k:'ncPre'}]}, {on:'healOut',skill:'nectar',do:[{fn:'s',k:'ncHeal'}]}, {on:'part',skill:'nectar',do:[{fn:'s',k:'ncPost'}]},
    {on:'partPre',skill:'hive',do:[{fn:'s',k:'hvPre'}]}, {on:'out',if:{casting:'hive'},do:[{fn:'s',k:'hvOut'}]}, {on:['teamHeal','healMe'],if:{casting:'hive'},do:[{fn:'s',k:'hvHeal'}]}, {on:'part',skill:'hive',do:[{fn:'s',k:'hvPost'}]},
    {on:'num',skill:'bee',do:[{fn:'s',k:'bee'}]}],talents:{gr_1_2:[]},fn:{s:(A,T,u,c,a)=>{ seen[a.k]=(seen[a.k]||0)+1; }},partial:{},ruling:{}};
  const L=lab(H,[['gr_1_2',1]],{allies:2,foes:3,def}), {v,A,F}=L;
  V.cast(v,'green',F[0]); secs(1.1); for(const x of [v].concat(A)) x.hp=x.maxHp*0.5; V.cast(v,'blue'); secs(0.6); V.cast(v,'ult'); secs(3.5); A[0].hp=A[0].maxHp*0.5; secs(0.6);
  for(const k of ['at','hcPre','hcPost','hcOut','ncPre','ncHeal','ncPost','hvPre','hvOut','hvHeal','hvPost','bee']) assert.ok(seen[k]>0,k+' was reached ('+JSON.stringify(seen)+')');
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage-reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ gr:['gr_8_2','gr_5_4','gr_11_1','gr_11_4','gr_7_4','gr_2_4','gr_4_4','gr_12_4','gr_6_2','gr_1_2','gr_n1','gr_6_4'],
            ls:['ls_1_4','ls_11_1','ls_8_3','ls_3_3','ls_4_1','ls_1_1','ls_2_2'],
            rm:['rm_9_1','rm_11_4','rm_2_2','rm_2_1','rm_1_3','rm_9_4','rm_8_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={gr:0,ls:1,rm:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his reduction talents true at once (6 Brood, Colony above 50, every ally with a worker, the attacker Pointed, with Welts,
   attacking him, Stung Hands on it, a Comb cell breaking, Swarmed, Tell the Bees on it); sustained: a usual state (no Brood, Colony 60, a plain attacker) */
function worstHit(list,kind,crit,sustained){ const L=lab(H,list,{allies:2,foes:3}), {v,F}=L, f=F[0]; v.maxHp=1e5; v.hp=6e4; noBees(L);
  if(L.T){ setStack(L,'col',60); setStack(L,'brood',0); if(!sustained){ setStack(L,'brood',6); setMk(L,f,'pt'); setMk(L,f,'stH'); setUst(L,f,'welt',5); f.target=v; setCells(L,v,3); setMk(L,v,'sw'); ME(L).tb[f.uid+':'+v.uid]=V.now()+99; } }
  v.shield=1e12; v.shieldT=999;
  const raw=2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Mellan: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['gr','ls'],[61,30]],[['gr'],[91]],[['gr','rm'],[61,30]],[['rm','gr'],[61,30]],[['ls','gr'],[61,30]],[['rm','ls'],[61,30]],[['gr','rm','ls'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  /* in seeded fights: every hit on him and on his allies; and each tick the most a hit on him could lose right now (his group as it stands, a dry run with
     nothing spent, times the nearest enemy's physical hit through his armor) */
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,sum:0,al:0,alMax:0,alHi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.team==="ally"&&src&&src.team!==tgt.team&&!tgt._summon, mel=me&&tgt.key==="mellan"; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; if(mel){ __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } else { __dr.al++; if(d>__dr.alMax) __dr.alMax=d; if(d>=0.85) __dr.alHi++; } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="mellan"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    if(T&&e&&T.s.me){ T.s.me.probe=true; let k=1; try{ k=TalentFx.inc(u,e,1,"phys",true,false); } finally{ T.s.me.probe=false; } const tot=1-k*defMul(e,u,"phys"); __dr.sum+=tot; if(tot>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','mellan'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits on him, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; his allies: '+d.al+' hits, the most reduced '+(d.alMax*100).toFixed(1)+'%, 85% or more '+d.alHi+'; probe each tick: mean '+(100*d.sum/Math.max(1,d.ticks)).toFixed(1)+'%, at 85% or more '+d.tHi+' of '+d.ticks+' ticks; immune '+d.imm);
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
