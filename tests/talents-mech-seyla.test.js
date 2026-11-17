'use strict';
/* Seyla Silkcoil's talents as data on the mechanics layer (talents-mech/seyla.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added (Venom Rhythm's count at the swing, each pass of Serpent's Last Dance), Phil's 95% ceiling and
   the longest stun chain of Paralytic. Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are
   measured with her talents switched off for one hit (plainHit) or in a plain lab built BEFORE the talented one (lab() replaces the whole field).
   nl(): the lab with Seyla, two allies and three foes, everyone held, every Energy at 0. Her skills are cast as they land (V.cast); the lab's skill level is 10.
   Places (metres from Seyla, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0); A0 (0,-5.5) A1 (0,-11). swing(): she really swings once (her count moves at the swing).
   Run: node --test tests/talents-mech-seyla.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='seyla', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const brnd=x=>VMX('var __sbr=(typeof __sbr!=="undefined"&&__sbr)?__sbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __sbr!=="undefined"&&__sbr){ brnd=__sbr; __sbr=null; }');
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const stk=(L,name)=>{ const k=L.T.s.k[name]; return k?k.n:0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const setWin=(L,name,t)=>{ L.T.s.w[name]={t:t==null?99:t,n:1,cdT:0,at:-1,wave:false}; };
const mk=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o[name]; return !!m&&(m.until==null||m.until>V.now()); };
const left=(L,t,name)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o[name]; return m&&m.until!=null?m.until-V.now():0; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:dur===null?null:V.now()+(dur||99),v:0}; };
const tx=(L,t)=>{ const o=t&&t._talM&&t._talM[L.v.uid], m=o&&o['#syTx']; return (m&&m.until>V.now())?m.v:0; };     // Toxin on t
const setTx=(L,t,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#syTx']={v:n,until:V.now()+(d||99)}; };
const sy=L=>L.T.s.sy||(L.T.s.sy={vs:{},sdc:{},ev:{}});
const tru=o=>Object.assign({kind:'true'},o||{});
const hitOn=(L,src,t,amt,o)=>lost(t,()=>V.hit(src,t,amt||1000,tru(o)));
const ratioIn=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const ratioOut=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const healGot=(t,fn)=>{ const h=t.hp; fn(); return t.hp-h; };
const low=(x,f)=>{ x.hp=x.maxHp*f; };
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };   // a unit that thinks but does nothing
const NERF=V.ccNerf, M=V.METER;
const at=(L,f,gap,dy)=>{ const v=L.v; f.x=v.x+(V.bodyR(v)+V.bodyR(f)+gap)*M; f.y=v.y+(dy||0)*M; f._ax=f.x; f._ay=f.y; };   // f set down `gap` m from her body, along x
const blowSet=(L,f,beat,bite)=>{ sy(L).blow={beat,bite:!!bite,t:f,all:false}; };                                  // the blow her last swing left (One, Two, Three, Four)
const autoOn=(L,f,amt,o)=>lost(f,()=>V.hit(L.v,f,amt||1000,Object.assign({auto:true,kind:'phys'},o||{})));
/* a real swing: she is let go for one swing at f (set down touching her: an Assassin beyond her fighting distance holds behind a living Tank), then held again; Venom Rhythm counts at the swing */
function swing(L,f){ const v=L.v; f=f||L.F[0]; at(L,f,0.02,0); v.stunned=0; v.greenCd=v.blueCd=1e9; v.energy=0; v.target=f; v.atkCd=0; v.attackAnim=0; v._castT=0; v._recentAtk=0; v._ax=v.x; v._ay=v.y; const sp=v.speed; v.speed=0;
  let k=0; for(;k<90&&!(v.attackAnim>0);k++) V.step(1); v.stunned=1e6; v.speed=sp; assert.ok(k<90,'she swung'); return f; }
/* the blow of that swing lands later (its fuse): let her go (doing nothing else) until it has */
function blow(L,f){ const v=L.v; f=f||L.F[0]; const h=f.hp; swing(L,f); v.stunned=0; v.atkCd=1e9; const sp=v.speed; v.speed=0; let k=0; for(;k<120&&!(f.hp<h);k++) V.step(1); v.stunned=1e6; v.speed=sp; assert.ok(f.hp<h,'the blow landed'); return h-f.hp; }
/* she dances: her star circles while she is let go (rooted by the dance), then she is held again. MEASURED: its circle (3 m from her centre plus the enemy's radius)
   misses an enemy her body touches once bodies are pushed apart (22 of 49 seeded casts struck nobody): the lab lets the enemies through the push, a place both today's reach and a body-edge one hold */
const ghost=L=>{ for(const x of L.F) x._pullGhost=true; };              // the enemies are let through the push of bodies for the next step (bodies pushed apart sit 0.05 m outside the star's 3 m + their radius)
function dance(L,f){ const v=L.v, D=[]; V.cast(v,'ult'); v.stunned=0; v.atkCd=1e9; v.greenCd=v.blueCd=1e9; v.energy=0; const sp=v.speed; v.speed=0; let k=0; for(;k<400&&(v._danceT||0)>0;k++){ v.energy=0; ghost(L); const h=f?f.hp:0; V.step(1); if(f&&f.hp<h) D.push(h-f.hp); } v.stunned=1e6; v.speed=sp; assert.ok(!((v._danceT||0)>0),'the dance ended'); return D; }
function nl(list,o){ o=o||{}; const L=lab(H,list,{allies:o.allies==null?2:o.allies,foes:o.foes==null?3:o.foes,big:o.big,seed:o.seed});
  for(const x of L.U){ x.energy=0; } return L; }
const plain=(o,fn)=>fn(nl(null,o));
const budget=L=>{ sy(L).rg=1e12; };
const dmgE=(u,a)=>VMX('damage')(u,a,'#fff',false);                    // a hit that gives Energy as any hit does (V.dmg gives none)
const away=L=>L.A.forEach((a,i)=>{ a.x=L.v.x+(20+6*i)*M; a.y=L.v.y-30*M; a._ax=a.x; a._ay=a.y; });   // her allies out of the way (enemies set down around her)                                    // her heal budget full

test('Seyla: every talent is accounted for - 7 plain stats, 118 with rows, none waiting',()=>{
  accounting(H,[125,7,118,0,0]);
  for(const id of ['ct_10_4','ct_1_3','bl_4_1','bl_n1','tc_4_1','tc_10_2','tc_1_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['ct_11_3','bl_1_2']) assert.ok(!FXN.has(H,id)&&FXN.mech(H).talents[id],id+': crit chance, in the capped group (not a plain stat)');
  const Mx=FXN.mech(H); for(const id of ['ct_13_2','bl_13_2','tc_13_2','ct_n1','ct_1_1','bl_1_1','tc_1_1','ct_1_4','bl_1_4','tc_1_4']) assert.ok(Mx.talents[id],id);
});

test('Seyla: her real kit, as the talents read it - Venom Rhythm at the swing, Ribbon Fang\'s wound, Hooded Feint, Serpent\'s Last Dance',()=>{
  const L=nl(null), {v,F}=L; assert.ok(!v._tal,'no talents: no runtime'); assert.ok(v.pass&&v.pass.venomrhythm,'her passive'); const pm=v.passMul||1;
  v._vrN=0; swing(L,F[0]); assert.equal(v._vrN,1,'One'); assert.ok(!((F[0].mortalT||0)>0),'One does not bite'); swing(L,F[0]); assert.equal(v._vrN,2,'Two'); assert.ok(!((F[0].mortalT||0)>0));
  swing(L,F[0]); secs(1.5); assert.equal(v._vrN,0,'Three'); assert.ok(F[0].mortalT>2.3&&F[0].mortalT<=4,'Venom Rhythm bites on the third swing: Mortal Wound 4 s'); assert.ok(F[0]._nrgSlowT>2.3&&F[0]._nrgSlowT<=4,'and an Energy slow 4 s'); near(F[0]._nrgSlowPct,0.4*pm,'of 40% x its multiplier',1e-9);
  const h=F[0].hp; F[0].hp=h/2; const g=healGot(F[0],()=>V.heal(F[0],1000)); near(g,500,'the venom halves healing',1e-9); F[0].hp=h;
  V.cast(v,'green',F[1]); assert.equal(F[1]._blStk,1,'Ribbon Fang: a wound stack'); near(F[1]._blT,6,'that lapses 6 s after',1e-9); const d=F[1].dots[F[1].dots.length-1]; near(d.dps,v.dmg*0.16*VMX('skillMul')(10),'a bleed of 16% of her attack a second (x the skill multiplier)',1e-6);
  V.cast(v,'green',F[1]); assert.equal(F[1]._blStk,2); V.cast(v,'green',F[1]); assert.equal(F[1]._blStk,0,'at 3 it ruptures (the stacks clear)');
  V.cast(v,'blue'); near(v._evadeT,2.4,'Hooded Feint: a 2.4 s window',1e-9); assert.ok(v.drMul<0.6,'in the one damage-reduction slot'); const fh=F[2].hp;
  assert.equal(lost(v,()=>V.hit(F[2],v,1000,{auto:true,kind:'phys'})),0,'the first enemy hit inside it is evaded'); assert.ok(F[2].hp<fh,'and she counters it'); assert.equal(v._evadeT,0,'the window is spent');
  const D=nl(null), w=D.v, f0=D.F[0]; at(D,f0,0,0); const hp0=f0.hp; dance(D);
  const one=(()=>{ const x=f0.hp; V.hit(w,f0,w._danceHit,{kind:'phys'}); const y=x-f0.hp; f0.hp=x; return y; })();
  near((hp0-f0.hp)/one,4,'Serpent\'s Last Dance: its star passes an enemy beside her 4 times',0.02);
});

/* ======================= COUNTING TO THREE: the beats ======================= */
test('Seyla / One (her One beat ignores 2% x 5 of the armor), Steady Count (One 3% x 3 more), Steady Feet and Swirl (basic attacks 2% x 5 each), the beats as her swings leave them',()=>{
  const L=nl(S(['ct_1_1','ct_6_1','ct_10_1','tc_10_1'])), {v,F}=L; v._vrN=0; swing(L,F[0]); assert.equal(sy(L).blow.beat,1,'the swing after a Three is One'); swing(L,F[0]); assert.equal(sy(L).blow.beat,2); swing(L,F[0]); assert.equal(sy(L).blow.beat,3);
  F[0].armorRating=500; const f=F[0];
  const pa=plainHit(L,()=>{ blowSet(L,f,2); return autoOn(L,f); }); blowSet(L,f,2); near(autoOn(L,f)/pa,1.10*1.10,'Two: only Steady Feet and Swirl (10% each)',1e-9);
  blowSet(L,f,1); const a1=autoOn(L,f); const VMd=VMX('defMul'), d0=VMd(v,f,'phys'); v._wpnArmIgn=0.10; const d1=VMd(v,f,'phys'); v._wpnArmIgn=0;
  near(a1/pa,1.10*1.10*1.09*d1/d0,'One: 10% of the armor ignored and Steady Count 9% more',1e-6);
  near(ratioOut(L,v,f),1,'(not a skill hit)',1e-9);
});

test('Seyla / Two (the wait before her Two 6% x 3 shorter), Partner\'s Count (before her One 4% x 3 shorter while the ally beside her attacks her target), Rocking on His Heels (the first count each wave 10% x 3 faster), Night Market',()=>{
  const L=nl(S(['ct_2_1','ct_n3','ct_4_3'])), {v,A,F}=L; v._vrN=0; sy(L).first=false; swing(L,F[0]); near(v.atkCd,v.atkInterval*(1-0.18),'after her One: the wait before Two is 18% shorter',1e-6);
  swing(L,F[0]); near(v.atkCd,v.atkInterval,'before Three: the full wait',1e-6); A[0].target=null; A[1].target=null; swing(L,F[0]); near(v.atkCd,v.atkInterval,'before One, no partner: the full wait',1e-6);
  v._vrN=2; const U=VMX('units').filter(x=>x.team===v.team&&!x._summon), nb=U[U.indexOf(v)+1]; nb.target=F[0]; swing(L,F[0]); near(v.atkCd,v.atkInterval*(1-0.12),'Partner\'s Count: the ally beside her attacks the same enemy: 12% shorter',1e-6);
  nb.target=F[1]; v._vrN=2; swing(L,F[0]); near(v.atkCd,v.atkInterval,'(another enemy: no)',1e-6);
  v.energy=0; v._vrN=0; const e0=v.energy; swing(L,F[0]); near(v.energy-e0,11+11*0.09,'Night Market: 11 Energy a basic attack, 3% x 3 more',1e-6);
  const R=nl(S(['ct_12_1'])), w=R.v; w._vrN=0; sy(R).first=true; swing(R,R.F[0]); near(w.atkCd,w.atkInterval*0.70,'Rocking on His Heels: the first count 30% faster',1e-6); swing(R,R.F[0]); near(w.atkCd,w.atkInterval*0.70); swing(R,R.F[0]); near(w.atkCd,w.atkInterval,'after the first full count: no more',1e-6);
  assert.equal(sy(R).first,false); R.T.s.fresh=true; V.step(1); assert.equal(sy(R).first,true,'again at the next wave');
});

test('Seyla / Three (her Three beat is a guaranteed critical) and Coil Tight (its critical 2% x 5 more), She Still Counts (each Three 0.4% x 5 more damage, up to 12, this wave), Tune in Threes',()=>{
  const L=nl(S(['ct_3_1','ct_8_2','ct_12_2','ct_11_1'])), {v,F}=L; const f=F[0], cd=v.critDmg||0.6;
  const pa=plainHit(L,()=>{ blowSet(L,f,3,true); return autoOn(L,f); });
  setStack(L,'sySc',0); blowSet(L,f,2); near(autoOn(L,f)/pa,1,'Two: no critical',1e-9);
  blowSet(L,f,3,true); near(autoOn(L,f)/pa,(1+cd)*1.10,'Three: a critical, and Coil Tight 10% more on it',1e-9);
  near(ratioOut(L,v,f),1,'(a skill hit: no)',1e-9);
  v._vrN=2; low(v,0.5); budget(L); const h=v.hp; swing(L,f); assert.equal(stk(L,'sySc'),1,'She Still Counts: a Three beat'); near(v.hp-h,0.025*v.maxHp,'Tune in Threes: it heals 0.5% x 5 of her max HP',1e-6);
  FX.api().stSet(L.T,v,'sySc',20); assert.equal(stk(L,'sySc'),12); V.step(1); blowSet(L,f,2); near(autoOn(L,f)/pa,1+0.02*12,'up to 12: 24% more',1e-9);
  L.T.s.fresh=true; V.step(1); assert.equal(stk(L,'sySc'),0,'this wave only');
});

test('Seyla / Long Count (PICK ONE: she counts to four, Venom Rhythm bites on Four, its healing cut 70% and its Energy slow 40% stronger) and Fourth Beat (5% x 3)',()=>{
  const L=nl(S(['ct_5_3','ct_6_3'])), {v,F}=L; const f=F[0], pm=v.passMul||1; v._vrN=0;
  swing(L,f); swing(L,f); swing(L,f); assert.equal(sy(L).blow.beat,3,'Three'); assert.ok(!((f.mortalT||0)>0),'Three does not bite'); swing(L,f); assert.equal(sy(L).blow.beat,4,'Four'); assert.equal(v._vrN,0); assert.ok(f.mortalT>3.9,'Four bites');
  near(f._nrgSlowPct,Math.min(0.95,0.4*pm*1.4),'its Energy slow 40% stronger',1e-9);
  const h=f.hp; f.hp=h/2; near(healGot(f,()=>V.heal(f,1000)),300,'its healing cut 70%',1e-6); f.hp=h;
  const pa=plainHit(L,()=>{ blowSet(L,f,4,true); return autoOn(L,f); }); blowSet(L,f,4,true); near(autoOn(L,f)/pa,1.15,'Fourth Beat: the Four 15% more',1e-9); blowSet(L,f,3); near(autoOn(L,f)/pa,1,'',1e-9);
});

test('Seyla / Fang on Two (PICK ONE: Venom Rhythm also bites on Two; each bite\'s healing cut 30%) and Double Fang (each biting blow 3% x 5 more)',()=>{
  const L=nl(S(['ct_5_2','ct_6_2'])), {v,F}=L; const f=F[0], pm=v.passMul||1; v._vrN=0;
  swing(L,f); assert.ok(!((f.mortalT||0)>0),'One: no bite'); swing(L,f); assert.ok(f.mortalT>3.9,'Two bites'); near(f._nrgSlowPct,0.4*pm*0.6,'(its own Energy slow at 60%)',1e-9);
  const h=f.hp; f.hp=h/2; near(healGot(f,()=>V.heal(f,1000)),700,'its healing cut 30%',1e-6); f.hp=h; swing(L,f); assert.ok(f.mortalT>3.9,'Three bites');
  f.mortalT=6; f.hp=h/2; near(healGot(f,()=>V.heal(f,1000)),500,'a longer wound from someone else on it: the game\'s half stays',1e-6); f.hp=h;
  const pa=plainHit(L,()=>{ blowSet(L,f,2,true); return autoOn(L,f); }); blowSet(L,f,2,true); near(autoOn(L,f)/pa,1.15,'Double Fang: a biting blow 15% more',1e-9); blowSet(L,f,1); near(autoOn(L,f)/pa,1,'',1e-9);
});

test('Seyla / Sure Bite (the venom 0.2 s x 5 longer), Potent (its healing cut 3% x 3 stronger), Dry Fangs (its Energy slow 5% x 2 stronger), Haemotoxin (PICK ONE: a bleed of 10% of her attack a second) and Bleeding Venom (5% x 3)',()=>{
  const L=nl(S(['ct_10_2','bl_8_1','bl_12_3','bl_5_3','bl_6_3'])), {v,F}=L; const f=F[0], pm=v.passMul||1; v._vrN=2; swing(L,f);
  near(f.mortalT,5,'Sure Bite: 4 + 0.2 x 5 s',0.05); near(f._nrgSlowT,5,'',0.05); near(f._nrgSlowPct,Math.min(0.95,0.4*pm*1.10),'Dry Fangs: 10% stronger',1e-9); assert.ok(mk(L,f,'syV'),'venomed');
  const h=f.hp; f.hp=h/2; near(healGot(f,()=>V.heal(f,1000)),1000*(1-0.5*1.09),'Potent: the cut 9% stronger (54.5%)',1e-6); f.hp=h;
  const d=f.dots.find(x=>x._talO===v.uid&&x._talK==='syHm'); assert.ok(d,'Haemotoxin: a bleed of hers'); near(d.dps,v.dmg*0.10*1.15,'10% of her attack a second, Bleeding Venom 15% stronger',1e-6); assert.equal(d.kind,'true','a talent bleed: its stated amount, no armor');
  near(d.remaining,5,'as long as the venom',1e-9);
});

/* ======================= READ ======================= */
test('Seyla / Where the Weight Is (an enemy that swings at her twice within 4 s is Read: its third swing misses and she counters from its flank for 40% x 3 of her attack), Learned Body, Venomed Answer, Mistake Made',()=>{
  const L=nl(S(['ct_1_4','ct_5_4','ct_n1','bl_1_1','ct_9_4'])), {v,F}=L; v.big=true; v.maxHp=v.hp=1e9; const f=F[0], g=F[1];
  const a=0.40*3*v.dmg, pc=plainHit(L,()=>{ const x=f.hp; V.hit(v,f,a,{kind:'phys'}); const y=x-f.hp; f.hp=x; return y; });
  assert.ok(lost(v,()=>V.hit(f,v,1000,{auto:true,kind:'phys'}))>0,'its first swing lands'); secs(6.2); assert.ok(lost(v,()=>V.hit(f,v,1000,{auto:true,kind:'phys'}))>0); assert.ok(!mk(L,f,'syRd'),'two swings 6.2 s apart: not Read');
  secs(1); assert.ok(lost(v,()=>V.hit(f,v,1000,{auto:true,kind:'phys'}))>0,'Learned Body: within 6 s'); assert.ok(mk(L,f,'syRd'),'Read');
  assert.ok(lost(v,()=>V.hit(f,v,1000,{kind:'phys'}))>0,'a skill hit is no swing: it lands'); V.hit(g,v,10,{kind:'phys'}); V.hit(g,v,10,{kind:'phys'}); assert.ok(!mk(L,g,'syRd')&&!mk(L,g,'syA1'),'two skill hits: not Read'); assert.ok(mk(L,f,'syRd'));
  v.blueCd=5; const fh=f.hp; assert.equal(lost(v,()=>V.hit(f,v,1000,{auto:true,kind:'phys'})),0,'its third swing misses'); near(fh-f.hp,pc*1.08,'she counters: 120% of her attack, Venomed Answer 8% more',1e-6);
  assert.equal(tx(L,f),1,'with Venom Sac the counter adds a Toxin'); near(v.blueCd,3,'Mistake Made: Hooded Feint 2 s sooner',1e-9); assert.ok(!mk(L,f,'syRd'),'Read is spent');
  assert.ok(lost(v,()=>V.hit(f,v,1000,{auto:true,kind:'phys'}))>0,'the next swing lands again');
  secs(7); V.hit(g,v,10,{auto:true,kind:'phys'}); V.hit(f,v,10,{auto:true,kind:'phys'}); assert.ok(!mk(L,g,'syRd')&&!mk(L,f,'syRd'),'two different enemies: nobody Read');
});

test('Seyla / He Always Leaned In (Read enemies deal 3% x 3 less for 3 s, to everyone), Learned Language (3% x 3 less from enemies she has Read), Body Language (the counter\'s crit chance, in the 5% group)',()=>{
  const L=nl(S(['ct_1_4','ct_7_4','ct_12_3','ct_3_4'])), {v,A,F}=L; v.maxHp=v.hp=1e9; const f=F[0];
  V.hit(f,v,10,{auto:true,kind:'phys'}); V.hit(f,v,10,{auto:true,kind:'phys'}); assert.ok(mk(L,f,'syRd'));
  near(ratioIn(L,f,v),0.91*0.91,'on her: Leaned In and Learned Language',1e-9); near(ratioIn(L,f,A[0]),0.91,'on an ally: Leaned In',1e-9); near(ratioIn(L,F[1],v),1,'(another enemy)',1e-9);
  secs(3.1); near(ratioIn(L,f,A[0]),1,'Leaned In: 3 s',1e-9); near(ratioIn(L,f,v),0.91,'Learned Language: while it is Read',1e-9);
  V.hit(f,v,10,{auto:true,kind:'phys'}); near(ratioIn(L,f,v),0.91,'and 3 s after its swing missed',1e-9); secs(3.1); near(ratioIn(L,f,v),1,'',1e-9);
  const o=sy(L), c=L.T.fn.critP(o.api,L.T,v,{tgt:f}); assert.equal(c,0,'Body Language: not on her other hits'); L.T.s.cur='syRead'; near(L.T.fn.critP(o.api,L.T,v,{tgt:f}),0.05,'Read\'s counter: 3% x 5, held at 5%',1e-12); L.T.s.cur=null;
});

test('Seyla / Never Heard a Note (SIGNATURE): on her Three beat, for 6 s every swing is a Three and bites, and the first enemy that attacks her is Read at once; once every 20 s',()=>{
  const L=nl(S(['ct_13_2','ct_3_1','ct_1_4'])), {v,F}=L; v.maxHp=v.hp=1e9; const f=F[0]; v._vrN=1; swing(L,f); assert.ok(!win(L,'syNn'),'Two: not yet');
  swing(L,f); assert.ok(win(L,'syNn'),'her Three: 6 s'); near(L.T.s.w.syNn.t,6,'',0.05); f.mortalT=0; const t1=V.now();
  swing(L,f); assert.equal(sy(L).blow.beat,3,'every swing a Three'); assert.ok(f.mortalT>3.9,'and it bites'); f.mortalT=0; swing(L,f); assert.ok(f.mortalT>3.9);
  V.hit(F[1],v,10,{auto:true,kind:'phys'}); assert.ok(mk(L,F[1],'syRd'),'the first enemy that attacks her: Read at once'); V.hit(F[2],v,10,{auto:true,kind:'phys'}); assert.ok(!mk(L,F[2],'syRd'),'(only the first)');
  assert.equal(lost(v,()=>V.hit(F[1],v,1000,{auto:true,kind:'phys'})),0,'its next swing misses');
  L.T.s.w.syNn.t=0; v._vrN=2; swing(L,f); assert.ok(!win(L,'syNn'),'within 20 s: not again'); secs(19.4-(V.now()-t1)); v._vrN=2; swing(L,f); assert.ok(!win(L,'syNn'),'(at 19.4 s)'); secs(0.8); v._vrN=2; swing(L,f); assert.ok(win(L,'syNn'),'after 20 s');
});

test('Seyla / Rhythm of the Pipe (each full count 2% x 3 attack speed for 3 s), Sway Away (each full count 2% x 3 dodge for 2 s), Sidewinder (from the flank 2% x 5 more)',()=>{
  const L=nl(S(['ct_8_1','ct_9_2','ct_8_3'])), {v,F}=L; const f=F[0], i0=v.atkInterval; v._vrN=1; swing(L,f); V.step(1); assert.ok(!win(L,'syRp'),'Two is no full count');
  swing(L,f); assert.ok(win(L,'syRp')&&win(L,'sySw'),'Three: a full count'); V.step(2); near(i0/v.atkInterval,1.06,'6% attack speed',1e-6); near(v._talDodge,0.06,'6% dodge',1e-9);
  secs(2.1); near(v._talDodge,0,'dodge 2 s',1e-9); near(i0/v.atkInterval,1.06,'',1e-6); secs(1); near(v.atkInterval,i0,'speed 3 s',1e-6);
  f.target=v; near(ratioOut(L,v,f),1,'an enemy facing her: no',1e-9); f.target=F[1]; near(ratioOut(L,v,f),1.10,'Sidewinder: an enemy facing someone else, 10% more',1e-9); f.target=null; near(ratioOut(L,v,f),1.10,'',1e-9);
});

/* ======================= HOODED FEINT ======================= */
test('Seyla / Hood Flare (the counter 3% x 5 more), Coiled Strike (1.5% x 5 more per Toxin), Hood Up (the counter is a Three beat: a critical with Three, it bites), Flank Step and Quick Hood (0.1 s x 5 each)',()=>{
  const O={}, pc=plain(O,P=>{ const w=P.v, f=P.F[0]; V.cast(w,'blue'); return lost(f,()=>V.hit(f,w,1000,{auto:true,kind:'phys'})); });
  const L=nl(S(['ct_3_3','bl_7_3','ct_11_2','ct_3_1','bl_1_1','ct_7_3','tc_8_2'])), {v,F}=L; const f=F[0], cd=v.critDmg||0.6; setTx(L,f,4);
  V.cast(v,'blue'); const c=lost(f,()=>V.hit(f,v,1000,{auto:true,kind:'phys'})); near(c/pc,1.15*(1+0.075*4)*(1+cd)*(1+0.03*4),'the counter: Hood Flare 15%, Coiled Strike 7.5% x 4 Toxin, a Three\'s critical (Venom Sac 3% x 4)',1e-6);
  assert.ok(f.mortalT>3.9,'Hood Up: it bites'); assert.equal(tx(L,f),5,'(a Toxin)');
  v.blueCd=0; VMX('(function(u){ u.blueCd=TalentFx.cd(u,"blue",9); })')(v); near(v.blueCd,8,'Flank Step and Quick Hood: 9 s - 0.5 - 0.5',1e-9);
});

/* ======================= THE BITE THAT LINGERS: Toxin ======================= */
test('Seyla / Venom Sac (each bite 1 Toxin, max 5, for 6 s; her hits 0.6% x 5 more per Toxin), Lingering Bite (max 8), Slow Poison (8 s), Bitter Blood (below 50% 2% x 5)',()=>{
  const L=nl(S(['bl_1_1','bl_12_1','bl_7_1','bl_10_1'])), {v,F}=L; const f=F[0]; v._vrN=2;
  swing(L,f); assert.equal(tx(L,f),2,'a bite: 1 Toxin, and its blow (a basic attack on an enemy under her venom) 1 more'); near(ratioOut(L,v,f),1.06,'3% more for each',1e-9);
  f.mortalT=0; F[0]._talM[v.uid].syV.until=V.now(); v._vrN=0; swing(L,f); assert.equal(tx(L,f),2,'a basic attack on an enemy not under her venom: none');
  for(let i=0;i<12;i++){ v._vrN=2; swing(L,f); } assert.equal(tx(L,f),8,'Lingering Bite: up to 8'); near(ratioOut(L,v,f),1.24,'',1e-9);
  secs(7.5); assert.equal(tx(L,f),8,'Slow Poison: still there after 7.5 s'); secs(0.7); assert.equal(tx(L,f),0,'gone 8 s after the last');
  low(f,0.45); near(ratioOut(L,v,f),1.10,'Bitter Blood: below half',1e-9); f.hp=f.maxHp;
});

test('Seyla / Thick Venom (each Toxin 2% x 3 less Energy gain), Gathered Nothing (at 5 Toxin none), Numb Limbs (each Toxin slows 1% x 3), Skin of the Dancer (3% x 3 magic resist while an enemy holds 5)',()=>{
  const L=nl(S(['bl_1_1','bl_2_1','bl_3_1','bl_6_1','bl_12_4'])), {v,F}=L; const f=F[0], g=F[1], s0=g.speed, mr0=v.mrRating; setTx(L,g,3); V.step(1); V.step(1);
  g.energy=10; sy(L).ev[g.uid]=10; dmgE(g,1); V.step(1); near(g.energy,10+7*(1-0.18),'3 Toxin: Energy from a hit 18% less',1e-6); near(g.speed,s0*(1-0.09),'Numb Limbs: 9% slower',1e-6);
  setTx(L,g,4); V.step(1); g.energy=10; sy(L).ev[g.uid]=10; dmgE(g,1); V.step(1); near(g.energy,10+7*(1-0.24),'4 Toxin: 24% less (Gathered Nothing waits for 5)',1e-6); near(v.mrRating,mr0,'(no enemy at 5)',1e-9); setTx(L,f,5); V.step(1); f.energy=10; sy(L).ev[f.uid]=10; dmgE(f,1); V.step(1); near(f.energy,10,'5 Toxin: no Energy at all',1e-9); V.step(1); near(v.mrRating,mr0*1.09,'Skin of the Dancer: 9% magic resist',1e-6);
  setTx(L,f,0,0); V.step(1); V.step(1); near(v.mrRating,mr0,'',1e-9);
});

test('Seyla / Paralytic (PICK ONE: a bite that brings an enemy to 5 Toxin stuns it 0.8 s + Long Paralysis 0.1 s x 5, and its Toxin resets) and the stun-lock rule',()=>{
  const L=nl(S(['bl_1_1','bl_5_2','bl_6_2'])), {v,F}=L; const f=F[0]; free(f); f.stunned=0; setTx(L,f,4); v._vrN=2; swing(L,f);
  near(f.stunned,1.3,'stunned 1.3 s, written in full',0.03); assert.ok(tx(L,f)<=1,'its Toxin resets (the blow that follows adds 1)'); assert.ok(mk(L,f,'syLk'),'the lock');
  setTx(L,f,4); v._vrN=2; const s1=f.stunned; swing(L,f); assert.ok(f.stunned<=s1,'never on a stunned enemy'); const g=F[1]; at(L,f,0,9); free(g); g.stunned=0.5; setTx(L,g,4); v._vrN=2; swing(L,g); assert.ok(g.stunned<=0.5,'(nor on one stunned by someone else, 0.5 s)'); assert.equal(tx(L,g),5,'(its Toxin waits)'); at(L,g,0,-9); at(L,f,0.02,0); assert.equal(tx(L,f),5,'(its Toxin waits)');
  let k=0; for(;k<200&&f.stunned>0;k++) V.step(1); assert.ok(!(f.stunned>0),'the stun ran out'); secs(0.35); v._vrN=2; swing(L,f); assert.ok(!(f.stunned>0),'nor within 0.5 s after her stun ended (0.4 s)'); secs(0.25); v._vrN=2; swing(L,f); assert.ok(f.stunned>1.2,'after it: again');
});

test('Seyla / Cannot Gather Themselves (SIGNATURE): once every 20 s, a bite on an enemy at full Toxin: it and every enemy within 3 m lose all Energy, receive no healing for 4 s and gain full Toxin',()=>{
  const L=nl(S(['bl_1_1','bl_13_2'])), {v,F}=L; const f=F[0], g=F[1], h=F[2]; at(L,f,0.15,0); g.x=f.x+(V.bodyR(f)+V.bodyR(g)+1.5)*M; g.y=f.y; h.x=f.x; h.y=f.y+(V.bodyR(f)+V.bodyR(h)+3.5)*M; for(const x of F) x.energy=80;
  setTx(L,f,4); v._vrN=2; swing(L,f); assert.ok(f.energy<=7+1e-9,'its Energy gone (then the 7 Energy of the blow that follows)'); assert.equal(g.energy,0,'and its neighbour\'s'); assert.equal(h.energy,80,'(not one 3.5 m away)'); assert.equal(tx(L,g),5,'full Toxin');
  g.hp=g.maxHp/2; assert.equal(healGot(g,()=>V.heal(g,1000)),0,'no healing'); secs(4.1); assert.ok(healGot(g,()=>V.heal(g,1000))>0,'for 4 s'); g.hp=g.maxHp;
  secs(11.5); for(const x of F) x.energy=80; setTx(L,f,4); v._vrN=2; swing(L,f); assert.equal(g.energy,80,'within 20 s (at 16 s): not again'); secs(4.5); setTx(L,f,4); v._vrN=2; swing(L,f); assert.equal(g.energy,0,'after 20 s');
});

test('Seyla / Old Skin (Shed Skin: once a wave below 40% HP every effect on her ends and she heals 4% x 3), New Scales (2% x 5 less for 5 s), Sloughing (2% x 5 attack speed for 5 s), Cast Off, Shed Again',()=>{
  const L=nl(S(['bl_1_4','bl_3_4','bl_5_4','bl_7_4','bl_9_4'])), {v,A,F}=L; const i0=v.atkInterval; at(L,A[0],0.2,0); A[0].x=v.x; A[0].y=v.y-(V.bodyR(v)+V.bodyR(A[0])+0.5)*M;
  V.dot(v,0.001,5,1,F[0]); v.silencedT=3; v._nrgSlowT=3; A[0].silencedT=3; A[0].hp=A[0].maxHp*0.5; V.step(1); low(v,0.45); const h0=v.hp; V.step(1); near(v.hp,h0,'not at 45%',1e-9); assert.ok(v.dots.length>0); low(v,0.35); const h=v.hp, ha=A[0].hp; V.step(1);
  assert.equal(v.dots.length,0,'Shed Skin: her DoTs end'); assert.ok(!(v.silencedT>0)&&!(v._nrgSlowT>0),'her silence and Energy slow'); near(v.hp-h,0.12*v.maxHp,'she heals 4% x 3 of her max HP',1e-6);
  assert.ok(!(A[0].silencedT>0),'Cast Off: her nearest ally is cleansed'); near(A[0].hp-ha,0.06*A[0].maxHp,'and heals 2% x 3 of its max HP',1e-6);
  near(ratioIn(L,F[0],v),0.90,'New Scales: 10% less',1e-9); V.step(1); near(i0/v.atkInterval,1.10,'Sloughing: 10% attack speed',1e-6); secs(5.1); near(ratioIn(L,F[0],v),1,'5 s',1e-9); near(v.atkInterval,i0,'',1e-6);
  v.hp=v.maxHp; V.step(1); low(v,0.35); const h2=v.hp; V.step(1); near(v.hp-h2,0.12*v.maxHp,'Shed Again: a second time this wave',1e-6); v.hp=v.maxHp; V.step(1); low(v,0.35); const h3=v.hp; V.step(1); near(v.hp,h3,'not a third',1e-6);
  v.hp=v.maxHp; L.T.s.fresh=true; V.step(1); low(v,0.35); const h4=v.hp; V.step(1); near(v.hp-h4,0.12*v.maxHp,'again at the next wave',1e-6);
});

test('Seyla / Ribbon Fang: Ribbon Edge and Ribbon Lash (3% x 5 each), Bitter Ribbon (venomed 3% x 5), In Threes (every third 5% x 5), Wider Wound and Rot in the Wound (its wound 12% and 15% more), Fang Rhythm',()=>{
  const O={}, [p1,pb]=plain(O,P=>{ const f=P.F[0]; at(P,f,0.3,0); const a=lost(f,()=>V.cast(P.v,'green',f)); const d=f.dots[f.dots.length-1]; return [a,d.dps]; });
  const L=nl(S(['ct_2_2','tc_7_3','bl_2_2','ct_7_1','ct_4_2','bl_3_3','bl_8_2'])), {v,F}=L; const f=F[0]; at(L,f,0.3,0); sy(L).rfN=0;
  f._blStk=0; near(lost(f,()=>V.cast(v,'green',f))/p1,1.15*1.15,'Ribbon Edge and Ribbon Lash',1e-6); const d=f.dots[f.dots.length-1]; assert.equal(d._talO,v.uid,'its wound is hers');
  const h=f.hp, sh=f.shield||0; f.dots=[d]; d.acc=d.interval; V.step(1); near(h-f.hp,pb*1.12*1.15*VMX('defMul')(v,f,'phys'),'Wider Wound 12%, Rot in the Wound 15% (through armor, as the game\'s bleed)',1e-3);
  f._blStk=0; V.cast(v,'green',f); f._blStk=0; setMk(L,f,'syV',9); near(lost(f,()=>V.cast(v,'green',f))/p1,1.15*1.15*1.15*1.25,'the third: In Threes 25%; venomed: Bitter Ribbon 15%',1e-6); f.dots=[];
  VMX('(function(u){ u.greenCd=TalentFx.cd(u,"green",6); })')(v); near(v.greenCd,5.5,'Fang Rhythm: 0.1 s x 5 shorter',1e-9);
});

test('Seyla / Seeping Cut (its rupture: 30% x 3 chance of a Toxin), Venom Ribbon (its rupture spreads all the Toxin on its target to every enemy within 2 m)',()=>{
  const L=nl(S(['bl_4_2','bl_11_2','bl_1_1'])), {v,F}=L; const f=F[0], g=F[1]; at(L,f,0.3,0); g.x=f.x; g.y=f.y+(V.bodyR(f)+V.bodyR(g)+1.0)*M; F[2].x=f.x; F[2].y=f.y-(V.bodyR(f)+V.bodyR(F[2])+2.5)*M;
  setTx(L,f,3); brnd(0.89); V.cast(v,'green',f); V.cast(v,'green',f); assert.equal(tx(L,f),3,'no rupture yet'); V.cast(v,'green',f); assert.equal(f._blStk,0,'ruptured');
  assert.equal(tx(L,f),4,'Seeping Cut: a Toxin (a roll below 90%)'); assert.equal(tx(L,g),3,'Venom Ribbon: the enemy 1 m away gets all of it (its 3, spread before Seeping Cut adds one)'); assert.equal(tx(L,F[2]),0,'(not one 2.5 m away)');
  brnd(0.91); setTx(L,f,3); setTx(L,g,0,0); V.cast(v,'green',f); V.cast(v,'green',f); V.cast(v,'green',f); assert.equal(tx(L,f),3,'a roll of 91%: no Toxin');
});

test('Seyla / venomed enemies: Cool Blood (2% x 2 less from them), Deadly Grace (crits on them 2% x 5 more), Antivenom (1% x 3 of the damage she deals them heals her), Venom Hunger (3% x 3 more Energy), Viper\'s Speed (1.5% x 5 faster)',()=>{
  const L=nl(S(['bl_6_4','bl_8_3','bl_9_2','bl_4_3','bl_10_2'])), {v,F}=L; const f=F[0], cd=v.critDmg||0.6, i0=v.atkInterval; v.target=f;
  near(ratioIn(L,f,v),1,'(not venomed)',1e-9); setMk(L,f,'syV',9); near(ratioIn(L,f,v),0.96,'Cool Blood',1e-9);
  near(ratioOut(L,v,f,{crit:true}),1.10,'Deadly Grace: its crit 10% more',1e-9); near(ratioOut(L,v,f),1,'',1e-9);
  low(v,0.5); budget(L); const h=v.hp, l=lost(f,()=>V.hit(v,f,1000,{kind:'true'})); near(v.hp-h,0.03*l,'Antivenom: 3% of it',1e-6);
  v.energy=0; V.hit(v,f,1,{auto:true,kind:'true'}); near(v.energy,11*0.09,'Venom Hunger: a basic attack on it, 3% x 3 of 11 more',1e-6);
  V.step(1); near(i0/v.atkInterval,1.075,'Viper\'s Speed: her target venomed',1e-6); v.target=F[1]; V.step(1); near(v.atkInterval,i0,'',1e-6);
});

test('Seyla / Spreading Venom (an enemy at 5 Toxin dies: its Toxin passes to the nearest enemy), Patient Poison (each enemy that dies with Toxin this wave 1% x 5 attack, up to 5), Full Glands (0.2% x 5 lifesteal per Toxin within 3 m, up to 10)',()=>{
  const L=nl(S(['bl_1_1','bl_8_1','bl_9_1','bl_12_2','bl_11_1'])), {v,F}=L; const f=F[0], g=F[1], a0=v.dmg; at(L,f,0.3,0); F[2].x=v.x; F[2].y=v.y+(V.bodyR(v)+V.bodyR(F[2])+3.5)*M; setTx(L,f,5); setTx(L,F[2],2); V.step(1); V.step(1);
  near(v.lifestealStat,0.01*5,'Full Glands: the 5 Toxin within 3 m (not the 2 at 3.5 m), 1% each',1e-9);
  V.dmg(f,2e9); V.step(1); assert.ok(!f.alive); assert.equal(tx(L,g),5,'Spreading Venom: to the nearest enemy'); assert.equal(stk(L,'syPp'),1,'Patient Poison'); V.step(1); near(v.dmg/a0,1.05,'5% attack',1e-6);
  setTx(L,g,0,0); V.dmg(F[2],2e9); V.step(2); assert.equal(stk(L,'syPp'),2,'(with 2 Toxin it counts)'); assert.equal(tx(L,g),0,'(but does not pass)');
  L.T.s.fresh=true; V.step(2); assert.equal(stk(L,'syPp'),0,'this wave only');
});

test('Seyla / Fang Edge, Steel Ribbon, Precise Fangs, Body Language, Steel Edged: ONE crit-chance group, at most 5%; Last Dancer (the last of her side standing: every basic attack bites)',()=>{
  const L=nl(S(['ct_11_3','bl_1_2','bl_11_3','tc_11_3','bl_n2','tc_1_1'])), {v,A,F}=L; const o=sy(L), f=F[0]; V.step(1);
  near(L.T.fn.critP(o.api,L.T,v,{tgt:f}),0.05,'Steel Ribbon and Fang Edge: 5% + 5%, held at 5%',1e-12);
  const R=nl(S(['bl_11_3'])), w=R.v; setTx(R,R.F[0],5); near(R.T.fn.critP(sy(R).api,R.T,w,{tgt:R.F[0]}),0.05,'held at 5%',1e-12); setTx(R,R.F[0],2); near(R.T.fn.critP(sy(R).api,R.T,w,{tgt:R.F[0]}),0.04,'2 Toxin: 4%',1e-12);
  const D=nl(S(['bl_n2'])), x=D.v, g=D.F[0]; x._vrN=0; swing(D,g); assert.ok(!((g.mortalT||0)>0),'allies standing: One does not bite'); for(const a of D.A) a.alive=false; swing(D,g); assert.ok(g.mortalT>3.9,'the last one standing: every basic attack bites'); assert.equal(sy(D).blow.beat,3,'(as a Three)');
});

/* ======================= THE THICK OF THE CROWD ======================= */
test('Seyla / Crowd: Thick Crowd (each enemy within 5 m 0.4% x 5 attack speed, max 5), Packed Tight (max 8), Thick Enough (3 more the first 5 s of each wave), Press of Bodies (1% x 3 less per Crowd), Crowd Energy, Crowd Pleaser',()=>{
  const i0=plain({},P=>P.v.atkInterval); const L=nl(S(['tc_1_1','tc_8_1','tc_12_1','tc_2_1','tc_4_3','tc_11_1']),{foes:3}), {v,F}=L; sy(L).te=0;
  away(L); at(L,F[0],1,0); F[1].x=v.x; F[1].y=v.y+(V.bodyR(v)+V.bodyR(F[1])+4.5)*M; { const r=(V.bodyR(v)+V.bodyR(F[2])+5.5)*M; F[2].x=v.x+r*0.7071; F[2].y=v.y+r*0.7071; } V.step(1); V.step(1);
  assert.equal(sy(L).cr,2,'two enemies within 5 m, body to body'); near(i0/v.atkInterval,1+0.04,'Thick Crowd: 2% per Crowd',1e-6); near(ratioIn(L,F[0],v),1-0.06,'Press of Bodies: 3% per Crowd (one source)',1e-9); near(v.lifestealStat,0.03,'Crowd Pleaser: 1.5% per Crowd',1e-9);
  v.energy=0; V.step(1); dmgE(v,1); V.step(1); near(v.energy,7*1.06,'Crowd Energy: 3% more per Crowd',1e-6);
  L.T.s.fresh=true; V.step(1); assert.equal(sy(L).cr,5,'Thick Enough: 3 more for the first 5 s of a wave'); secs(4.8); assert.equal(sy(L).cr,5,'(at 4.8 s)'); secs(0.4); assert.equal(sy(L).cr,2);
  setTx(L,F[0],0); assert.equal(sy(L).crMax,8,'Packed Tight: up to 8');
});

test('Seyla / Touch Each of Them (at 3 Crowd her basic attacks also strike a second enemy within 2 m for 50%), Elbow Room (at 2 Crowd 3% x 3 less from skills), Never Where It Lands (at 2 Crowd 1% x 5 dodge), Steel Edged, Bite of the Crowd (at most 10%)',()=>{
  const L=nl(S(['tc_3_1','tc_6_1','tc_7_1','tc_11_3','tc_8_3','tc_1_1']),{foes:3}), {v,F}=L; sy(L).te=0; const f=F[0], cd=v.critDmg||0.6;
  away(L); at(L,f,0.5,0); F[1].x=f.x; F[1].y=f.y+(V.bodyR(f)+V.bodyR(F[1])+1)*M; F[2].x=v.x; F[2].y=v.y-(V.bodyR(v)+V.bodyR(F[2])+2)*M; V.step(1); V.step(1); assert.equal(sy(L).cr,3);
  const h=F[1].hp; V.hit(v,f,1,{auto:true,kind:'true'}); const a=0.5*v.dmg*VMX('defMul')(v,F[1],'phys'); near(h-F[1].hp,a,'Touch Each of Them: 50% of her attack on the enemy beside it',1e-6);
  near(ratioIn(L,f,v),0.91,'Elbow Room: a skill hit',1e-9); near(ratioIn(L,f,v,{auto:true}),1,'(not a basic attack)',1e-9); near(v._talDodge,0.05,'Never Where It Lands',1e-9);
  near(L.T.fn.critP(sy(L).api,L.T,v,{tgt:f}),0.045,'Steel Edged: 0.3% x 5 per Crowd',1e-12); near(ratioOut(L,v,f,{crit:true}),1.10,'Bite of the Crowd: 4% x 3 Crowd, held at 10%',1e-9);
  F[2].y=v.y-40*M; V.step(1); assert.equal(sy(L).cr,2); const h2=F[1].hp; V.hit(v,f,1,{auto:true,kind:'true'}); near(F[1].hp,h2,'2 Crowd: no second strike',1e-9); near(ratioIn(L,f,v),0.91,'(Elbow Room still)',1e-9);
  F[1].y=f.y+40*M; V.step(1); near(ratioIn(L,f,v),1,'1 Crowd: no',1e-9); near(v._talDodge,0,'',1e-9);
});

test('Seyla / Tied with Ribbon (Ribbon Fang ties its target for 6 s; her hits on it: the nearest other enemy within 2 m takes 10% x 3), Knotted, Knot Pull, Tangled, Ribbon Bind, Thread Through, Tight Weave, Bound Together',()=>{
  const L=nl(S(['tc_1_4','tc_3_4','tc_7_4','tc_5_4','tc_6_4','tc_9_2','tc_12_3','tc_9_4'])), {v,A,F}=L; const f=F[0], g=F[1], i0=v.atkInterval, s0=f.speed;
  at(L,f,0.3,0); g.x=f.x; g.y=f.y+(V.bodyR(f)+V.bodyR(g)+3.2)*M; F[2].y=f.y-40*M; V.cast(v,'green',f); assert.ok(mk(L,f,'syTd'),'Tied'); near(left(L,f,'syTd'),8,'Knotted: 6 + 0.4 x 5 s',0.05);
  const gd=g.dots.find(d=>d._talK==='syBt'); assert.ok(!gd,'Bound Together: only on Tied enemies');
  const h=g.hp, l=lost(f,()=>V.hit(v,f,1000,{kind:'true'})); near(h-g.hp,0.30*l,'the enemy 3.2 m away (Knot Pull: 3.5 m) takes 30% of the hit',1e-6);
  g.y=f.y+(V.bodyR(f)+V.bodyR(g)+3.7)*M; const h2=g.hp; V.hit(v,f,1000,{kind:'true'}); near(g.hp,h2,'3.7 m: no',1e-9);
  V.step(1); near(f.speed,s0*0.90,'Tangled: 10% slower',1e-6); near(ratioIn(L,f,v),0.96,'Ribbon Bind: it deals 4% less, to her',1e-9); near(ratioIn(L,f,A[0]),0.96,'and to her allies',1e-9);
  v.target=f; V.step(1); near(i0/v.atkInterval,1.09,'Thread Through: her target Tied, 9% faster',1e-6);
  near(ratioOut(L,v,f),1.06,'Tight Weave: 6% more from her',1e-9); const ha=f.hp, hb=lost(f,()=>V.hit(A[0],f,1000,{kind:'true'})); near(hb,1060,'and from her allies',1e-6);
  g.y=f.y+(V.bodyR(f)+V.bodyR(g)+1)*M; setMk(L,g,'syTd',9); F[2].x=f.x; F[2].y=f.y-(V.bodyR(f)+V.bodyR(F[2])+1)*M; V.cast(v,'green',f); assert.ok(g.dots.some(d=>d._talK==='syBt'),'Bound Together: the wound on the Tied enemy within 2 m'); assert.ok(!F[2].dots.some(d=>d._talK==='syBt'),'(not on one that is not Tied)');
  secs(8.1); assert.ok(!mk(L,f,'syTd'),'8 s');
});

test('Seyla / Serpent\'s Last Dance: Wide Swing and Weakest for the Last (3% x 5 each), Venom Dance (1% x 5 per Toxin), The Old Tune (6% per Crowd at the start), Wider Orbit (0.2 m x 3), Fifth Turn (PICK ONE: 5 passes) and Long Dance (the 5th 4% x 5 more)',()=>{
  const O={}, one=plain(O,P=>{ const f=P.F[0]; at(P,f,0,0); const h=f.hp; dance(P); return (h-f.hp)/4; });
  const L=nl(S(['tc_2_2','ct_9_3','bl_9_3','tc_9_1','tc_4_2','tc_5_2','tc_6_2','tc_1_1'])), {v,F}=L; const f=F[0]; sy(L).te=0; at(L,f,0,0); setTx(L,f,3); V.step(1); V.step(1); const cr=sy(L).cr; assert.equal(cr,1);
  const h=f.hp, D=dance(L,f); const per=one*1.15*1.15*1.15*(1+0.06*cr); near((h-f.hp)/per,4+1.20,'Fifth Turn: 5 passes, the 5th 20% more',1e-4); assert.equal(D.length,5,'one pass a step'); near(D[4]/D[0],1.20,'Long Dance: the 5th pass',1e-6); near(D[3]/D[0],1,'(not the 4th)',1e-6);
  const R=nl(S(['tc_4_2'])), w=R.v; V.cast(w,'ult'); near(w._danceR,3*M+0.6*M,'Wider Orbit: 3.6 m',1e-6); w._danceT=0;
});

test('Seyla / Saved for Last (PICK ONE: Serpent\'s Last Dance executes under 15%, a boss only under 10%), Weakest Last (each execution heals 2% x 3), All the Way Round, Ribbon Dance (its star Ties), Last Beat (each enemy\'s third pass bites it), Dance Floor',()=>{
  const L=nl(S(['tc_5_3','tc_6_3','tc_12_2','tc_11_2','ct_9_1','tc_9_3','tc_1_4'])), {v,F}=L; const f=F[0], q=F[1]; at(L,f,0,0); q.x=v.x; q.y=v.y+(V.bodyR(v)+V.bodyR(q))*M; f.maxHp=q.maxHp=1e6; f.hp=0.20e6; q.hp=0.2e6; v._danceHit=0; low(v,0.5); budget(L);
  V.cast(v,'ult'); v._danceHit=1; const hv=v.hp; v.stunned=0; v.atkCd=1e9; v.greenCd=v.blueCd=1e9; v.speed=0; for(let k=0;k<400&&(v._danceT||0)>0;k++){ v.energy=0; if(f.alive&&f.hp>0.149e6) f.hp=0.149e6; if(q.alive) q.hp=0.151e6; ghost(L); V.step(1); } v.stunned=1e6;
  assert.ok(!f.alive,'under 15%: executed'); assert.ok(q.alive,'(15.1%: not)'); near(v.hp-hv,0.06*v.maxHp,'Weakest Last: 2% x 3 of her max HP',1e-3);
  assert.equal(stk(L,'syAr'),2,'All the Way Round: the two enemies it struck'); near(ratioOut(L,v,F[2]),1.03,'0.3% x 5 per enemy, this fight',1e-9);
  const B=nl(S(['tc_5_3'])), b=B.F[0]; at(B,b,0,0); b.t=Object.assign({},b.t,{isboss:true}); b.maxHp=1e6; b.hp=0.149e6; B.v._danceHit=0; V.cast(B.v,'ult'); B.v._danceHit=1; B.v.stunned=0; B.v.atkCd=1e9; B.v.speed=0; for(let k=0;k<400&&(B.v._danceT||0)>0;k++){ ghost(B); V.step(1); } B.v.stunned=1e6;
  assert.ok(b.alive,'a boss under 15% is not executed (only under 10%, as the skill)');
  const D=nl(S(['tc_11_2','ct_9_1','tc_9_3','bl_1_1'])), g=D.F[0]; at(D,g,0,0); dance(D); assert.ok(mk(D,g,'syTd'),'Ribbon Dance: Tied'); assert.ok(g.mortalT>2.0,'Last Beat: bitten'); assert.equal(tx(D,g),1,'once in 4 passes: on its third');
  setTx(D,g,0,0); low(g,0.35); near(ratioOut(D,D.v,g),1.10,'Dance Floor: below 40% 10% more',1e-9);
});

test('Seyla / The Whole Tune Round (SIGNATURE): once every 20 s at 3 or more Crowd, Serpent\'s Last Dance comes ready at once, its star circles twice as fast, every enemy it passes is Tied and bitten',()=>{
  const L=nl(S(['tc_13_2','tc_1_1']),{foes:3}), {v,F}=L; sy(L).te=0; away(L); at(L,F[0],0,0); F[1].x=v.x; F[1].y=v.y+(V.bodyR(v)+V.bodyR(F[1])+1)*M; F[2].x=v.x; F[2].y=v.y-(V.bodyR(v)+V.bodyR(F[2])+8)*M; V.step(1);
  assert.ok(!(v.energy>=100),'2 Crowd: no'); F[2].y=v.y-(V.bodyR(v)+V.bodyR(F[2])+1)*M; V.step(1); const t0=V.now(); assert.equal(v.energy,100,'3 Crowd: her Ultimate ready at once');
  V.cast(v,'ult'); near(v._danceDur,1.2,'twice as fast: 4 passes in 1.2 s',1e-9); v.stunned=0; v.atkCd=1e9; v.greenCd=v.blueCd=1e9; v.speed=0; for(let k=0;k<200&&(v._danceT||0)>0;k++){ v.energy=0; ghost(L); V.step(1); } v.stunned=1e6;
  assert.ok(mk(L,F[0],'syTd')&&F[0].mortalT>2,'Tied and bitten'); v.energy=0; secs(19.2-(V.now()-t0)); assert.ok(v.energy<100,'within 20 s (at 19.2 s): not again'); secs(1.2); assert.equal(v.energy,100,'after 20 s');
});

/* ======================= MOVEMENT, CONTROLS, THE REST ======================= */
test('Seyla / Swaying, Low and Quick, Sway (3% x 3 each), Supple (controls 4% x 5 shorter, at most 20%), Quiet Feet and Loose Coils (slows 16% and 30% weaker, at most 40%), Scales, Nimble Hood, Hooded Eyes, Hidden in the Throng, Through the Gaps',()=>{
  const P=nl(null), s0=P.v.speed;
  const L=nl(S(['ct_2_3','bl_2_3','tc_2_3','bl_5_1','ct_12_4','tc_n1','ct_4_1','ct_n2','ct_6_4','tc_12_4','tc_3_3'])), {v,F}=L; near(v.speed,s0*1.27,'27% faster (the three add)',1e-6);
  v.stunned=0; V.cc(F[0],v,'fearT',2); near(v.fearT,2*NERF*0.8,'Supple: 20% shorter',0.02); v.stunned=1e6;
  v.slow=2; v.slowMul=0.5; V.step(1); near(v.slowMul,1-0.5*(1-0.40),'a 50% slow on her: 40% weaker',1e-9);
  v.target=F[0]; F[0].melee=true; near(ratioIn(L,F[0],v),0.925,'Scales: the enemy she is attacking 7.5% less',1e-9); near(ratioIn(L,F[1],v),0.90,'Nimble Hood: the others 10% less',1e-9);
  near(ratioIn(L,F[0],v,{auto:true}),0.925*0.96,'Hooded Eyes: basic attacks 4% less',1e-9); F[1].melee=false; near(ratioIn(L,F[1],v),0.90*0.96,'Hidden in the Throng: ranged enemies 4% less',1e-9);
  F[0].armorRating=500; const VMd=VMX('defMul'), d0=VMd(v,F[0],'phys'); v._wpnArmIgn=0.10; const d1=VMd(v,F[0],'phys'); v._wpnArmIgn=0; near(ratioOut(L,v,F[0],{kind:'phys'}),d1/d0,'Through the Gaps: 10% of the armor ignored',1e-6);
});

/* ======================= CAPS ======================= */
test('Seyla / her caps: damage reduction ONE group at most 40% (on an ally at most 12.6%), critical chance at most 5%, talent dodge at most 10%, her talent heals within 1.2% of her max HP a second',()=>{
  const all=everything(H), L=nl(all), {v,A,F}=L; brnd(0.99); const f=F[0], o=sy(L);
  V.step(1); setMk(L,f,'syRdA'); setMk(L,f,'syLn'); setMk(L,f,'syV'); setMk(L,f,'syTd'); setWin(L,'syNs'); o.cr=8; o.te=0; v.target=f; f.melee=false;
  near(L.T.fn.drK(o.api,L.T,v,{src:f,auto:false},false),0.60,'every reduction on her at once: held at 40%',1e-9);
  near(L.T.fn.drK(o.api,L.T,v,{src:f,auto:true},false),0.60,'',1e-9);
  near(ratioIn(L,f,A[0]),0.91*0.96,'an ally: He Always Leaned In and Ribbon Bind together, 12.6% at most',1e-9);
  setTx(L,f,8); L.T.s.cur='syRead'; near(L.T.fn.critP(o.api,L.T,v,{tgt:f}),0.05,'every crit chance at once: 5%',1e-12); L.T.s.cur=null;
  setWin(L,'sySw'); o.cr=8; near(L.T.fn.dodgeP(o.api,L.T,v,{}),0.10,'talent dodge: held at 10%',1e-12);
  low(v,0.2); o.rg=0; const h=v.hp; secs(1); const h1=v.hp; for(let i=0;i<5;i++) L.T.fn.heal(o.api,L.T,v,0.05*v.maxHp); near(v.hp-h1,0.012*v.maxHp,'heals in a second: at most 1.2% of her max HP',0.05);
});

/* ======================= WHOLE FIGHTS ======================= */
test('Seyla: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['ct_1_1','ct_1_4','ct_3_1','ct_12_2','bl_1_1','bl_1_4','tc_1_1','tc_1_4','bl_8_2','tc_11_2']), TEAM=['vael','sylthaine','vireo','vex','seyla'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let toxT=0, tied=0, crowd=0, threes=0, reads=0; let lastSc=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s, o=T0.sy||{}; for(const e of U){ if(!e.alive||e.team===s.team) continue; const m=e._talM&&e._talM[s.uid]; if(m&&m['#syTx']&&m['#syTx'].until>V.now()) toxT++; if(m&&m.syTd&&m.syTd.until>V.now()) tied++; }
    if((o.cr||0)>0) crowd++; const sc=(T0.k.sySc&&T0.k.sySc.n)||0; if(sc>lastSc) threes++; lastSc=sc; reads=o.readN||0; }
  console.log('  live fight: enemy-ticks with Toxin '+toxT+', Tied '+tied+', ticks with Crowd '+crowd+', Three beats '+threes+', Reads '+reads+', Read misses '+(s._tal.s.sy.missN||0));
  assert.ok(toxT>0&&tied>0&&crowd>0&&threes>0,'Toxin, Tied, Crowd and Three beats in a real fight');
  determinism(H,TEAM);
});

/* The page sites her talents added (Venom Rhythm's count at the swing, each pass of Serpent's Last Dance): with nothing learned, whole seeded fights with Seyla in
   the line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters show the fights reach every site. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Seyla: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['seyla','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __syN={venom:0,pass:0}; var __syH=_dealDamageCore;'+
    '_dealDamageCore=function(src,tgt,amt,color){ if(src&&src.key==="seyla"&&color==="#5ee89b") __syN.pass++; const f0=floatTexts.length; const r=__syH.apply(this,arguments); return r; };'+
    'var __syU=_updateBattleCore; _updateBattleCore=function(dt){ const f0=floatTexts.length; const r=__syU.apply(this,arguments); for(let i=f0;i<floatTexts.length;i++) if(floatTexts[i].txt==="VENOM") __syN.venom++; return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__syN'); console.log('  identity / sites reached: '+JSON.stringify(c));
    assert.ok(c.venom>10&&c.pass>10,'the fights ran Venom Rhythm\'s count (its bites) and the passes of her star'); }
  finally{ VMX('_dealDamageCore=__syH; _updateBattleCore=__syU;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage reduction talents (and armor / max HP), each candidate 91-point build legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ ct:['ct_4_1','ct_n2','ct_6_4','ct_12_3','ct_7_4','ct_10_4','ct_1_4'], bl:['bl_3_4','bl_6_4','bl_4_1','bl_1_4','bl_5_1','bl_1_1'], tc:['tc_2_1','tc_6_1','tc_12_4','tc_6_4','tc_10_2','tc_4_1','tc_1_1','tc_1_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={ct:0,bl:1,tc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her reduction talents true at once (the attacker just Read - its miss spent, Leaned In, venomed, Tied, ranged; New Scales; 8 Crowd), with Hooded Feint's own
   cut in the game's slot at skill level 100 (x0.501); as her target and not (Scales / Nimble Hood), a skill and a basic attack (Elbow Room / Hooded Eyes), normal and critical,
   physical and magic. Sustained: no Feint, her target hitting her with a basic attack of 5% of her max HP, one Crowd. Measured through the engine (HP and shield it takes). */
function worstHit(list,kind,crit,sustained,asTgt,auto){ const L=nl(list,{allies:2,foes:3}), {v,F}=L; const f=F[0]; v.maxHp=1e5; v.hp=6e4; brnd(0.99);
  V.step(1); if(L.T){ const o=sy(L); if(!sustained){ setMk(L,f,'syRdA'); setMk(L,f,'syLn'); setMk(L,f,'syV'); setMk(L,f,'syTd'); setWin(L,'syNs'); o.cr=8; } else o.cr=1; o.te=0; }
  v.target=(sustained||asTgt)?f:F[1]; f.melee=!!sustained; if(!sustained){ v.drMul=0.501; v.drT=99; } else { v.drMul=1; v.drT=0; } v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6; v.evaStat=0; v._evadeT=0;
  if(L.T){ const o=sy(L); if(!sustained) o.cr=8; }
  const raw=sustained?5e3:2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:!!(sustained||auto)})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; brndBack();
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Seyla: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['ct','tc'],[61,30]],[['ct'],[91]],[['tc','ct'],[61,30]],[['bl','ct'],[61,30]],[['tc','bl'],[61,30]],[['ct','bl'],[61,30]],[['bl','tc'],[61,30]],[['tc'],[91]],[['ct','tc','bl'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const asTgt of [false,true]) for(const auto of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false,asTgt,auto));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,pr:[]}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="seyla"&&src&&src.team!==tgt.team; let h0=0; if(me) h0=tgt.hp+(tgt.shield||0); const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="seyla"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    const A=T&&T.s.sy&&T.s.sy.api; if(A&&e){ const k=T.fn.drK(A,T,u,{src:e,kind:"phys",auto:true,crit:false},false)*((u.drT>0)?(u.drMul||1):1), d=1-k*Math.max(defMul(e,u,"phys"),defMul(e,u,"magic")); __dr.pr.push(d); if(d>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');   /* her group, Hooded Feint's slot and her armor / magic resist, each tick, against the first living enemy */
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','seyla'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','kharos','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13,21,34,55,89]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; immune ticks '+d.imm+' of '+d.ticks+'; ticks at 85% or more (the probe: her group, Feint\'s slot and her armor) '+d.tHi+', the probe median '+(d.pr.length?(d.pr.slice().sort((a,b)=>a-b)[d.pr.length>>1]*100).toFixed(1):'-')+'%, highest '+(d.pr.length?(Math.max(...d.pr)*100).toFixed(1):'-')+'%');
    assert.ok(d.n>20&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'at 85% or more for less than half of the fight: '+d.tHi+' of '+d.ticks+' ticks'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* the stun-lock rule in seeded fights: Paralytic's stuns (a build 61 The Bite That Lingers with Paralytic and Long Paralysis + 30 Counting to Three). The longest time one
   enemy stayed stunned in a row while one of her stuns was on it, and that no talent stun landed on a stunned enemy or within 0.5 s after hers ended */
test('Seyla: Paralytic in seeded fights - never on a stunned enemy, and the longest run one enemy stays stunned by her',()=>{
  let b={r:{}}; const meta=id=>T.talent(H,id), goals=['bl_1_1','bl_2_2','bl_4_2','bl_5_2','bl_6_2'];
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }; const G=[]; for(const id of goals) for(const x of pre(id).concat([id])) if(G.indexOf(x)<0) G.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<61;g++){ const id=G.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100)); if(id){ b=T.learn(H,b,id,100).build; continue; }
    const pool=T.trees(H)[1].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; }
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const nx=T.trees(H)[0].talents.slice().sort((p,q)=>p[1]-q[1]||p[2]-q[2]).find(t=>T.canLearn(H,b,t[0],100)); if(!nx) break; b=T.learn(H,b,nx[0],100).build; }
  assert.equal(T.invalid(H,b,100),''); assert.ok(b.r.bl_5_2&&b.r.bl_6_2,'Paralytic and Long Paralysis'); const list=T.learned(H,b);
  VMX('var __st={n:0,run:0,max:0,bad:0}; var __stU=_updateBattleCore, __stR=new Map();'+
    '_updateBattleCore=function(dt){ const S=units.find(u=>u&&u.key==="seyla"), o=S&&S._tal&&S._tal.s.sy, L0=o&&o.stL?o.stL.length:0, pre=new Map(); for(const e of units) if(e.alive) pre.set(e,e.stunned||0); const r=__stU.apply(this,arguments);'+
    '  if(o&&o.stL&&o.stL.length>L0){ for(let i=L0;i<o.stL.length;i++){ __st.n++; const e=units.find(x=>x.uid===o.stL[i][0]); if(e&&(pre.get(e)||0)>0) __st.bad++; if(e){ const q=__stR.get(e)||{t:0,mine:false}; q.mine=true; __stR.set(e,q); } } }'+
    '  for(const e of units){ if(!e.alive||e.team===(S&&S.team)) continue; const q=__stR.get(e)||{t:0,mine:false}; if((e.stunned||0)>0){ q.t+=dt; if(q.mine&&q.t>__st.max) __st.max=q.t; } else { q.t=0; q.mine=false; } __stR.set(e,q); } return r; };');
  try{ const sn=snaps(['seyla','vael','vireo','sylthaine','gruel'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7],[12,5],[60,77]]) campaign(sn,node,seed);
    const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]){ NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__stR=new Map();'); }
    const d=VMX('__st'); console.log('  Paralytic in seeded fights: '+d.n+' talent stuns, on a stunned enemy '+d.bad+', the longest run one enemy stayed stunned with her stun on it '+d.max.toFixed(2)+' s');
    assert.ok(d.n>0,'Paralytic stunned in real fights'); assert.equal(d.bad,0,'never on a stunned enemy'); assert.ok(d.max<4.0,'the longest run stays below 4 s'); }
  finally{ VMX('_updateBattleCore=__stU;'); }
});
