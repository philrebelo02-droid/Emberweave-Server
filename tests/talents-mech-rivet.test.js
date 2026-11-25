'use strict';
/* Rivet's talents as data on the mechanics layer (talents-mech/rivet.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling, the stun chain.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   His weapons are fired for real (swing: the page's own rivetPick + rivetFire, then the field is stepped until every blow has landed), or one blow is
   struck with a weapon record of his (recHit: the record a swing would carry, so his rows see the same thing).
   SCATTERGUN measures 3.2 m from his CENTRE today and struck somebody on 4 of 130 casts in real fights (tests/rivet-kit-facts.js); release v1391 on another
   branch centres it on his target (same radius). Every Scattergun test puts its target 3.0 m in front of his centre: a place the cone reaches both before
   that fix (3.0 m < 3.2 m, inside 60 degrees) and after it (the target is the centre) - so these tests are about his talents, not the cone's reach.
   Places (metres from Rivet, centre): F0 (4.5,0) = 0.93 m of ground: MELEE; F1 (10,0) = 6.43 m: ranged, farther than 6 m; F2 (15.5,0); F3 (0,6); F4 (5.5,6); A0 (0,-5.5).
   The lab's skill level is 10. Run: node --test tests/talents-mech-rivet.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,build,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='rivet', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const RNG=['gatling','revolver','saw','bolt','cannon'], MEL=['blade','hammer','uspike','lspike'];
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; if(!m) return 0; return V.now()<m.until?m.v:0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d==null?99:d)}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const mkLeft=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o[name]; return m&&m.until!=null?m.until-V.now():0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; u.px=u.x; u.py=u.y; };
const dm=(s,t,k)=>VMX('defMul')(s,t,k);
const gap=(a,b)=>(VMX('dist')(a,b)-VMX('bodyR')(a)-VMX('bodyR')(b))/V.METER;
const rv=L=>L.T.s.rv;
const brnd=x=>VMX('var __rbr=(typeof __rbr!=="undefined"&&__rbr)?__rbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __rbr!=="undefined"&&__rbr){ brnd=__rbr; __rbr=null; }');
/* a unit that thinks but does nothing (no move, no attack, nothing ready), at level 1 so a skill's control is not resisted */
const free=x=>{ x.stunned=0; x.silencedT=0; x.slow=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; x._dash=null; };
const FP=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6]];
function rl(list,o){ o=Object.assign({foes:5},o||{}); const L=lab(H,list,Object.assign({},o,{cold:true})); L.v.x=300; L.v.y=700; L.F.forEach((f,i)=>{ const p=(o.pos&&o.pos[i])||FP[i]; if(p) at(L,f,p[0],p[1]); });
  L.v.target=L.F[1]; if(o.pre) o.pre(L); V.step(1); return L; }
/* one swing for real: the page picks the weapon (rivetPick, his talents' 'rvPick'), fires it (rivetFire, the record 'rvFire'); then every blow lands */
const SW=VMX(`(function(u,t){ u.target=t; u._rvWpn=rivetPick(u,t); u._atkClip='w_'+u._rvWpn; const c=u.anim&&u.anim[(u._atkClip&&u.anim[u._atkClip])?u._atkClip:'attack'];
  rivetFire(u,t,u.dmg*(u.dmgBuffT>0?u.dmgBuffMul:1)*rageMul,c,null); return u._rvWpn; })`);
const land=L=>{ for(let i=0;i<240&&L.v._fuse&&L.v._fuse.length;i++) V.step(1); };
const shoot=(L,t)=>{ const w=SW(L.v,t); land(L); return w; };
const hookIt=(L,t)=>{ VMX('rivetHook')(L.v,t); land(L); };
/* one blow struck with a weapon record of his (what a swing of that weapon carries); a 1000 true-damage basic attack unless o says otherwise */
function recHit(L,t,rec,o){ const s=L.T.s, R=rv(L); R.sn++; R.rec[R.sn]=rec; const keep=s.cur; s.cur='rv:'+R.sn; try{ return lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true',auto:true},o||{}))); } finally{ s.cur=keep; } }
const plainOf=(L,t,o)=>plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true',auto:true},o||{}))));
const recRatio=(L,t,rec,o)=>{ const b=plainOf(L,t,o); return recHit(L,t,Object.assign({},rec),o)/b; };
const ratio=(L,t,o)=>{ const b=plainOf(L,t,o); return lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true',auto:true},o||{})))/b; };
function skillRatio(L,t,skill,o){ const s=L.T.s, keep=s.cur, b=plainOf(L,t,Object.assign({auto:false},o)); s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))); } finally{ s.cur=keep; } return a/b; }
const hitOn=(L,amt,o)=>{ const v=L.v, r=lost(v,()=>V.hit((o&&o.src)||L.F[0],v,amt||100,Object.assign({kind:'true'},o||{}))); v.energy=0; return r; };
const inRatio=(L,o,amt)=>{ const v=L.v, h=v.hp; const a=hitOn(L,amt||100,o); v.hp=h; const b=plainHit(L,()=>hitOn(L,amt||100,o)); v.hp=h; return a/b; };
const allyRatio=(L,a,src,o)=>{ const h=a.hp; const x=lost(a,()=>V.hit(src,a,100,Object.assign({kind:'true'},o||{}))); a.hp=h; const y=plainHit(L,()=>lost(a,()=>V.hit(src,a,100,Object.assign({kind:'true'},o||{})))); a.hp=h; return x/y; };
const critRec=(L,t,rec)=>{ const s=L.T.s, R=rv(L), keep=s.cur; if(rec){ R.sn++; R.rec[R.sn]=rec; s.cur='rv:'+R.sn; } try{ return FX.crit(L.v,t,false,'phys',true); } finally{ s.cur=keep; } };
const crackBy=(L,t)=>{ for(let i=0;i<3;i++) V.cc(L.v,t,'slow',2); };   // three slows of his (through the game's ccApply): Cracked
const atkOf=L=>L.v.dmg*(L.v.dmgBuffT>0?L.v.dmgBuffMul:1)*VMX('rageMul');

test('Rivet: every talent is accounted for - 11 plain stats, 104 with rows, none waiting',()=>{
  accounting(H,[115,11,104,0,0]);
  for(const id of ['lw_3_3','lw_8_1','lw_9_3','lw_1_3','cw_2_3','cw_8_3','cw_9_3','cw_1_2','nc_4_3','nc_5_1','nc_1_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const st=FXN.totals(H,S(['lw_9_3','cw_9_3'])); near(st.critDmg,0.20,'Sure Hands and Brawler\'s Oil: 10% critical damage each, at most');
  for(const [id,nm] of [['lw_6_2','Muzzle Close'],['nc_1_4','Parts Bin'],['nc_5_2','Spreading Smoke'],['nc_9_2','Stress Point'],['nc_10_1','Split Grain']]) assert.equal(T.talent(H,id).name,nm,'renamed '+id);
  assert.equal(T.talent(H,'nc_5_3').lock,'nc_5_2','the fork still locks the renamed half'); assert.equal(T.talent(H,'nc_10_2').prereq,'nc_9_2');
});

test('Rivet: his real kit, as the talents read it - the ranged five and the melee four in order, the hammer 2 s, the spike 3 s, the hook, Scattergun, Smoke Bomb 1.4 s, Full Arsenal',()=>{
  const L=rl(null,{big:true}), {v,F}=L; free(F[0]); free(F[1]);
  assert.ok(!v._tal,'no talents: no rows');
  assert.deepEqual([0,1,2,3,4].map(()=>shoot(L,F[1])),RNG,'6.4 m of ground: the ranged five in order');
  assert.equal(shoot(L,F[0]),'blade','0.9 m of ground: melee'); assert.equal(shoot(L,F[0]),'hammer'); near(F[0].stunned,2.0,'the hammer: 2.0 s',0.04);
  F[0].stunned=0; assert.equal(shoot(L,F[0]),'uspike'); near(F[0].silencedT,3.0,'the upper spike: 3.0 s',0.03); assert.equal(shoot(L,F[0]),'lspike'); near(F[0]._shredPct,0.20,'the lower spike: 20% armor cut');
  free(F[2]); at(L,F[0],-8,9); at(L,F[1],-8,14); hookIt(L,F[2]); near(gap(v,F[2]),0.5,'the hook pulls to 0.5 m of ground',0.05); near(F[2].stunned,3.0,'and stuns 3.0 s',0.03);
  const L2=rl(null,{big:true}); at(L2,L2.F[0],3.0,0); const a=lost(L2.F[0],()=>V.cast(L2.v,'green',L2.F[0])); at(L2,L2.F[0],3.0,0); const b=lost(L2.F[1],()=>V.cast(L2.v,'green',L2.F[0]));
  assert.ok(a>0,'Scattergun strikes its target 3.0 m in front of him (reached before and after v1391)'); assert.equal(b,0,'not F1 at 10 m');
  const L3=rl(null,{big:true}); free(L3.F[1]); V.cast(L3.v,'blue',L3.F[1]); near(L3.F[1].slow,1.4,'Smoke Bomb: 1.4 s (the card\'s 2 s x 0.7)'); near(L3.F[1].slowMul,V.slowMulFor(10),'its strength: the skill level\'s');
  const L4=rl(null,{big:true,foes:5}); for(const f of L4.F) free(f); const h0=L4.F.map(f=>f.hp); V.cast(L4.v,'ult',L4.F[0]);
  assert.ok(L4.F.every((f,i)=>f.hp<h0[i]),'Full Arsenal strikes the five nearest'); near(L4.F[0].stunned,0.4*L4.v.passMul*0.7,'its primary stunned 0.4 s x the passive x 0.7',1e-3);
});

test('Rivet / the Rack: Load the Rack (five ranged in a row: his next ranged attack 4% x 5), a melee attack empties it, Quick Change, Spare Ammunition, Eighty Years, Re-Rack, a new wave',()=>{
  const L0=rl(null,{big:true}); const g0=lost(L0.F[1],()=>shoot(L0,L0.F[1])), i0=L0.v.atkInterval;
  const L=rl(S(['lw_1_1','lw_2_1','lw_4_1','lw_11_2','lw_10_1']),{big:true}), {v,F}=L; v.greenCd=10;
  const g1=lost(F[1],()=>shoot(L,F[1])); near(g1/g0,1,'the first gatling: no bonus'); assert.equal(rv(L).rack,1); V.step(1); near(v.atkInterval,i0/1.06,'Quick Change: 2% x 3 while it fills');
  for(let i=0;i<3;i++) shoot(L,F[1]); v.greenCd=10; SW(v,F[1]); near(v.greenCd,10-1.5,'Re-Rack 0.3 s x 5 off Scattergun at the Full Rack',1e-6); land(L);
  assert.equal(rv(L).rack,0,'five: a Full Rack, the rack starts again'); assert.equal(rv(L).full,true);
  assert.equal(stack(L,'rvSa'),1,'Spare Ammunition'); assert.equal(stack(L,'rvEy'),1,'Eighty Years');
  V.step(1); near(v.atkInterval,i0/(1+0.025),'Spare Ammunition 0.5% x 5; not filling: no Quick Change');
  F[1].dots.length=0; const g6=lost(F[1],()=>shoot(L,F[1])); near(g6/g0,1.20*1.02,'the attack after a Full Rack: 4% x 5 (every round of it), with Eighty Years\' 2% attack for that Full Rack'); assert.equal(rv(L).full,false); assert.equal(rv(L).rack,1);
  shoot(L,F[1]); assert.equal(rv(L).rack,2); shoot(L,F[0]); assert.equal(rv(L).rack,0,'a melee attack empties it');
  for(let i=0;i<3;i++) shoot(L,F[1]); assert.equal(rv(L).rack,3); V.wave(); V.step(2); assert.equal(rv(L).rack,0,'a new wave: empty'); assert.equal(stack(L,'rvSa'),0,'Spare Ammunition: this wave'); assert.equal(stack(L,'rvEy'),1,'Eighty Years: this fight');
  setStack(L,'rvEy',10); const L1=rl(S(['lw_11_2']),{big:true}); setStack(L1,'rvEy',10); V.step(1); near(L1.v.dmg/rl(null,{big:true}).v.dmg,1.20,'Eighty Years: 0.4% x 5 for each of 10');
});

test('Rivet / Next Barrel Up (the chest cannon next whatever the order, 60 degrees) and Rack Master (a further 2% x 5)',()=>{
  const L0=rl(null,{big:true}); for(let i=0;i<4;i++) shoot(L0,L0.F[1]); L0.F[1].dots.length=0; const c0=lost(L0.F[1],()=>shoot(L0,L0.F[1]));
  const L=rl(S(['lw_1_1','lw_3_1','lw_12_2']),{big:true,foes:4,pos:[null,null,null,[10,5]]}), {v,F}=L;
  for(let i=0;i<4;i++) shoot(L,F[1]); F[1].dots.length=0; const s3=F[3].hp, c5=lost(F[1],()=>shoot(L,F[1])); assert.equal(F[3].hp,s3,'the cannon\'s own 45 degrees: F3 (26.6 degrees off) is not in it');
  near(c5/c0,1,'the fifth (a cannon): no bonus yet'); assert.equal(rv(L).full,true);
  F[1].dots.length=0; const s3b=F[3].hp, c6=lost(F[1],()=>{ assert.equal(shoot(L,F[1]),'cannon','after a Full Rack: the chest cannon, not the gatling'); });
  near(c6/c0,1.20*1.10,'Load the Rack and Rack Master multiply'); assert.ok(F[3].hp<s3b,'60 degrees: F3 is in it'); near(FX.num(v,'rvCone',45),60,'the cone 15 degrees wider');
  assert.equal(shoot(L,F[1]),'gatling','the order goes on where it was'); near(FX.num(v,'rvCone',45),45,'a normal attack: 45');
});

test('Rivet / Keep Them Out (PICK ONE: never melee, point-blank 15%), Muzzle Close (3% x 5), Any Distance (PICK ONE) and Hybrid Belt',()=>{
  const L=rl(S(['lw_5_2','lw_6_2']),{big:true}), {v,F}=L; const mi=v._rvMi|0;
  const a=lost(F[0],()=>{ assert.equal(shoot(L,F[0]),'gatling','an enemy within 3 m: the next ranged weapon'); }); assert.equal(v._rvMi|0,mi,'his melee cycle does not move');
  for(let i=0;i<4;i++) shoot(L,F[2]); const b=lost(F[1],()=>{ assert.equal(shoot(L,F[1]),'gatling'); }); near(a/b,1.15*1.15,'point-blank: 15%, Muzzle Close a further 15%');
  const L2=rl(S(['lw_5_3','lw_7_3','lw_1_1']),{big:true}), w=L2.v;
  for(let i=0;i<3;i++) shoot(L2,L2.F[1]); shoot(L2,L2.F[0]); assert.equal(rv(L2).rack,4,'Any Distance: melee does not empty it, and counts'); shoot(L2,L2.F[0]); assert.equal(rv(L2).full,true,'a Full Rack');
  shoot(L2,L2.F[0]); near(rv(L2).rec[rv(L2).sn].boost,0.20,'its bonus to his next attack of either group'); assert.equal(rv(L2).full,false);
  near(recRatio(L2,L2.F[0],{w:'blade',basic:true}),1.15,'Hybrid Belt: melee 3% x 5'); near(recRatio(L2,L2.F[1],{w:'gatling',basic:true}),1,'not ranged');
  const L3=rl(S(['lw_7_3']),{big:true}); near(recRatio(L3,L3.F[0],{w:'blade',basic:true}),1,'Hybrid Belt without Any Distance: nothing');
});

test('Rivet / Sighted: Glass Eye (each different weapon a step, max 5, 1% x 3 a step), Steady Eye (8 s), Watchful, Seen Coming (in the group), Read the Order, Five of Five, Marked Glass',()=>{
  const L0=rl(null,{big:true}); const s0=L0.F[1].speed;
  const L=rl(S(['lw_1_4','lw_2_4','lw_5_4','lw_n1','lw_4_4','lw_9_4','lw_10_4']),{big:true,allies:1}), {v,F,A}=L;
  shoot(L,F[1]); assert.equal(ust(L,F[1],'rvSi'),1,'the gatling: 1 (its nine rounds once)'); shoot(L,F[1]); assert.equal(ust(L,F[1],'rvSi'),2,'the revolver: 2');
  recHit(L,F[1],{w:'revolver',basic:true}); assert.equal(ust(L,F[1],'rvSi'),2,'the same weapon again: no step');
  near(recRatio(L,F[2],{w:'saw',basic:true}),1,'none on F2'); setUst(L,F[2],'rvSi',4); near(recRatio(L,F[2],{w:'bolt',basic:true}),1.12,'Glass Eye: 4 steps x 3%'); assert.equal(ust(L,F[2],'rvSi'),5,'max 5');
  recHit(L,F[1],{w:'bolt',basic:true});
  near(F[1]._talM[v.uid]['#rvSi'].until-V.now(),8,'Steady Eye: it clears 8 s after his last hit',0.01);
  V.step(2); near(F[1].speed/s0,0.94,'Watchful: 2% x 3 slower'); near(F[3].speed/s0,1,'not an enemy with no step');
  setUst(L,F[0],'rvSi',3); near(inRatio(L,{src:F[0]}),0.90,'Seen Coming: 10% less from an enemy at 3 steps'); setUst(L,F[0],'rvSi',2); near(inRatio(L,{src:F[0]}),1,'not at 2');
  setUst(L,F[3],'rvSi',5); brnd(0.044); assert.equal(critRec(L,F[3],{w:'gatling'}),true,'Read the Order: 4.5% at 5 steps'); brnd(0.046); assert.equal(critRec(L,F[3],{w:'gatling'}),false); setUst(L,F[3],'rvSi',4); brnd(0); assert.equal(critRec(L,F[3],{w:'gatling'}),false,'not at 4 steps');
  setUst(L,F[4],'rvSi',4); recHit(L,F[4],{w:'saw',basic:true}); assert.ok(mkLeft(L,F[4],'rvFf')>0,'5 steps: Five of Five ready'); brnd(0.99); assert.equal(critRec(L,F[4],null),true,'his next hit on it is a critical');
  assert.equal(critRec(L,F[4],null),false,'once');
  setUst(L,F[1],'rvSi',3); near(allyRatio(L,F[1],A[0]),1.075,'Marked Glass: his ally deals 0.5% x 5 a step more'); delete F[2]._talM[v.uid].rvFf; near(ratio(L,F[2],{}),1+0.03*5,'not Rivet\'s own hits (Glass Eye only, on any hit of his)');
});

test('Rivet / his weapons: Oiled Gatling (points), Shells in the Chest, Curved Edge, Short Leash, Ninepin Count, Gear Grind, Walnut Steady, Range Finder (farther than 6 m), Bolt Pressure',()=>{
  const L=rl(S(['lw_2_2','lw_8_4','cw_3_2','cw_4_4','lw_7_1','cw_7_1']),{big:true}), {v,F}=L;
  near(recRatio(L,F[1],{w:'gatling',basic:true}),(0.20/0.15)*1.10,'gatling: 15% -> 20% of his attack a round, and Ninepin 10%');
  near(recRatio(L,F[1],{w:'cannon',basic:true}),1.15*1.10,'Shells in the Chest 15%');
  near(recRatio(L,F[0],{w:'blade',basic:true}),1.20*1.10*1.10,'Curved Edge 20%, Gear Grind 10%');
  near(recRatio(L,F[0],{w:'hook',auto:true}),1.60*1.10,'Short Leash 60% (and Gear Grind); the automatic hook is no basic attack');
  near(recRatio(L,F[1],{w:'revolver'}),1,'a record that is no basic attack: nothing');
  const H0=rl(null,{big:true}); at(H0,H0.F[0],-8,9); at(H0,H0.F[1],-8,14); const k0=lost(H0.F[2],()=>hookIt(H0,H0.F[2]));
  const H1=rl(S(['cw_4_4']),{big:true}); at(H1,H1.F[0],-8,9); at(H1,H1.F[1],-8,14); const k1=lost(H1.F[2],()=>hookIt(H1,H1.F[2])); near(k1/k0,1.60,'a real hook\'s blow: Short Leash 20% x 3');
  const W=rl(S(['lw_12_3','lw_4_3']),{big:true}); shoot(W,W.F[1]); assert.equal(rv(W).rec[rv(W).sn].ws,true,'Walnut Steady: his first ranged attack this wave');
  shoot(W,W.F[1]); assert.ok(!rv(W).rec[rv(W).sn].ws,'not the second'); near(recRatio(W,W.F[2],{w:'gatling',basic:true,ws:true}),1.20*1.06,'20%, and Range Finder at 12 m');
  near(ratio(W,W.F[1]),1.06,'Range Finder: 2% x 3 farther than 6 m (6.4 m of ground)'); near(ratio(W,W.F[0]),1,'not at 0.9 m');
  const B=rl(S(['lw_6_4']),{big:true}), f=B.F[1]; f.armorRating=2000; const R0=B.T.s.rv; R0.sn++; R0.rec[R0.sn]={w:'bolt',basic:true};
  const hitB=()=>{ const k=B.T.s.cur; B.T.s.cur='rv:'+R0.sn; B.v._wpnArmIgn=0.5; try{ return lost(f,()=>V.hit(B.v,f,1000,{kind:'phys',auto:true})); } finally{ B.T.s.cur=k; B.v._wpnArmIgn=0; } };
  const plainB=()=>plainHit(B,()=>{ B.v._wpnArmIgn=0.5; try{ return lost(f,()=>V.hit(B.v,f,1000,{kind:'phys',auto:true})); } finally{ B.v._wpnArmIgn=0; } });
  const want=()=>{ B.v._wpnArmIgn=0.55; const x=dm(B.v,f,'phys'); B.v._wpnArmIgn=0.5; const y=dm(B.v,f,'phys'); B.v._wpnArmIgn=0; return x/y; };
  const outB=()=>{ const k=B.T.s.cur; B.T.s.cur='rv:'+R0.sn; B.v._wpnArmIgn=0.5; try{ return FX.out(B.v,f,1000,'phys',true,false); } finally{ B.T.s.cur=k; B.v._wpnArmIgn=0; } };
  near(outB()/1000,want(),'Bolt Pressure: 50% of armor ignored -> 55%');
});

test('Rivet / Saw Teeth (the saw\'s bleed 24% stronger) and Lower Spike Bite (the cut 20% -> 22%)',()=>{
  const L=rl(S(['lw_6_1','cw_6_4']),{big:true}), {v,F}=L; free(F[0]);
  shoot(L,F[1]); shoot(L,F[1]); assert.equal(shoot(L,F[1]),'saw'); const d=F[1].dots[F[1].dots.length-1]; assert.ok(d&&d.src===v,'the saw\'s bleed');
  near(d.dps,atkOf(L)*0.5/4*1.24,'50% of his attack over 4 s, 8% x 3 stronger');
  for(let i=0;i<3;i++) shoot(L,F[0]); F[0]._shredPct=0; assert.equal(shoot(L,F[0]),'lspike'); near(F[0]._shredPct,0.22,'Lower Spike Bite: 5% x 2 of 20%');
});

test('Rivet / Long Arsenal (each shot its weapon\'s effect), Every Barrel Counts (a step and 2% x 5 a shot), Workshop Repair (a Part a shot on a Cracked enemy)',()=>{
  brnd(0.99);
  const P0=rl(null,{big:true,foes:5}); for(const f of P0.F) free(f); const h0=P0.F.map(f=>f.hp); V.cast(P0.v,'ult',P0.F[0]); const d0=P0.F.map((f,i)=>h0[i]-f.hp);
  const L=rl(S(['lw_7_2','lw_6_1','nc_7_4']),{big:true,foes:5}), {v,F}=L; for(const f of F) free(f); setMk(L,F[3],'rvCk'); const h1=F.map(f=>f.hp); const a=atkOf(L);
  V.cast(v,'ult',F[0]); const d1=F.map((f,i)=>h1[i]-f.hp);
  /* the nearest first: F0 (4.5 m) the gatling, F3 (6 m) the revolver, F4 (8.1 m) the saw, F1 (10 m) the bolt, F2 (15.5 m) the cannon, whose cone (22.5 degrees each side) holds F0 and F1 */
  near(d1[0]-d0[0],(9*0.15+0.75)*a*dm(v,F[0],'phys'),'F0: the gatling\'s nine rounds and the cannon\'s cone',1e-4);
  near(d1[3]-d0[3],0,'F3: the revolver shot (no critical with the stream at 0.99)',1e-6);
  const sw=F[4].dots.find(d=>d.src===v&&Math.abs(d.dps-a*0.5/4*1.24)<1e-6*a); assert.ok(sw,'F4: the saw\'s bleed, Saw Teeth too');
  assert.ok(d1[1]-d0[1]>0.75*a*dm(v,F[1],'phys'),'F1: the bolt (armor ignored) and the cannon\'s cone'); near(d1[2]-d0[2],0,'F2: the cannon shot itself, no more',1e-6);
  assert.equal(stack(L,'rvPt'),1,'Workshop Repair: the shot on Cracked F3');
  const E=rl(S(['lw_7_2','lw_9_2']),{big:true,foes:5}); for(const f of E.F) free(f); const he=E.F.map(f=>f.hp); V.cast(E.v,'ult',E.F[0]);
  assert.ok(E.F.every(f=>ust(E,f,'rvSi')===1),'Every Barrel Counts: each enemy a shot hit Sighted one step');
  const de=E.F.map((f,i)=>he[i]-f.hp); near((de[3])/(d0[3]),1.10,'a shot 2% x 5 more (the revolver: no rider)',1e-4);
});

test('Rivet / The Whole Workshop (SIGNATURE): a Full Rack - the five ranged weapons together at the most Sighted enemy with the bonus, all they hit Sighted to 5; once every 20 s',()=>{
  const L=rl(S(['lw_13_2','lw_1_1','lw_1_4']),{big:true}), {v,F}=L; setUst(L,F[2],'rvSi',3);
  setUst(L,F[2],'rvSi',5); for(let i=0;i<4;i++) shoot(L,F[1]); const n0=rv(L).sn; SW(v,F[1]); const recs=[]; for(let i=n0+1;i<=n0+5;i++) recs.push(rv(L).rec[i]); assert.equal(rv(L).sn,n0+6,'and the swing\'s own');
  assert.deepEqual(recs.map(r=>r.w),RNG,'five more records: the five ranged weapons'); assert.ok(recs.every(r=>r.vol&&Math.abs(r.boost-0.20)<1e-9),'each with the Full Rack\'s bonus');
  assert.equal(rv(L).full,false,'the rack emptied into them'); near(rv(L).sigW,20,'once every 20 s',0.01); land(L);
  assert.equal(ust(L,F[2],'rvSi'),5,'the most Sighted enemy: to 5'); assert.ok(ust(L,F[1],'rvSi')>=1);
  for(let i=0;i<5;i++) shoot(L,F[1]); assert.equal(rv(L).full,true,'the next Full Rack within 20 s: no volley, the bonus waits');
});

test('Rivet / Torque: Wound Spring (1 a second in melee, 2 a second away, 0.4% x 5 attack speed each), Tight Spring (16), Torque Wrench (45% faster), Spring Steel (in the group), Spin Down under the budget',()=>{
  const L0=rl(null,{big:true}), i0=L0.v.atkInterval;
  const L=rl(S(['cw_1_1','cw_2_1','cw_12_1','cw_4_1','cw_6_1']),{big:true}), {v,F}=L; v.target=F[0];
  secs(1); assert.equal(stack(L,'rvTq'),1,'1.45 a second: 1 after a second'); secs(9); assert.equal(stack(L,'rvTq'),14,'14 after 10 s');
  secs(2); assert.equal(stack(L,'rvTq'),16,'Tight Spring: 16 at most'); V.step(1); near(v.atkInterval,i0/(1+0.02*16),'2% a Torque');
  near(inRatio(L,{src:F[0]}),1-0.01*16,'Spring Steel: 0.2% x 5 a Torque');
  v.hp=0.5*v.maxHp; rv(L).hb=0; const h=v.hp; v.target=F[1]; secs(2); const lostT=16-stack(L,'rvTq'); assert.ok(lostT>=3&&lostT<=4,'2 a second away: '+lostT);
  const got=(v.hp-h)/v.maxHp; assert.ok(got>0&&got<=0.012*2+1e-6,'Spin Down: 0.6% a Torque lost, never more than 1.2% a second ('+got+')'); near(got,0.006*lostT,'all of it paid (inside the budget)',2e-4);
  setStack(L,'rvTq',16); v.hp=0.5*v.maxHp; rv(L).hb=0.06*v.maxHp; const h2=v.hp; secs(1); const l2=16-stack(L,'rvTq'); assert.ok(l2>=1); near((v.hp-h2)/v.maxHp,0.006*l2,'with 5 s of budget kept: 0.6% for each Torque lost, no more',2e-4);
  const W=rl(S(['cw_1_1']),{big:true}); W.v.target=W.F[0]; secs(12); assert.equal(stack(W,'rvTq'),10,'without Tight Spring: 10'); W.v.target=null; secs(1); assert.equal(stack(W,'rvTq'),10,'no target: it holds');
});

test('Rivet / Pre-Tensioned (full at a wave\'s start), Torque Release (the blade spends it all, 2% x 5 a Torque), Overwound (the hammer 0.5 s longer at full Torque)',()=>{
  const L=rl(S(['cw_1_1','cw_11_1','cw_8_1','cw_3_1']),{big:true}), {v,F}=L; V.wave(); V.step(2); assert.equal(stack(L,'rvTq'),10,'Pre-Tensioned');
  near(recRatio(L,F[0],{w:'blade',basic:true}),1+0.10*10,'10 Torque spent: 100% more'); assert.equal(stack(L,'rvTq'),0,'all of it');
  near(recRatio(L,F[0],{w:'blade',basic:true}),1,'not at 0');
  setStack(L,'rvTq',10); free(F[0]); shoot(L,F[0]); setStack(L,'rvTq',10); assert.equal(shoot(L,F[0]),'hammer'); near(F[0].stunned,2.5,'Overwound: 2.5 s',0.03);
  free(F[0]); rv(L).st={}; shoot(L,F[0]); shoot(L,F[0]); shoot(L,F[0]); free(F[0]); rv(L).st={}; setStack(L,'rvTq',5); assert.equal(shoot(L,F[0]),'hammer'); near(F[0].stunned,2.0,'not at 5 Torque',0.03);
});

test('Rivet / Pinned: an enemy the hook brings back (4 s, Pin Down 5.5 s), Clamp Hand (6% from his melee), Gate Kept (1 s silence), Nobody Leaves, Dragged Back, no dash or teleport, Held Fast (him and his allies)',()=>{
  const L=rl(S(['cw_1_4','cw_5_4','cw_7_4','cw_9_4','cw_12_4','cw_10_4']),{big:true,allies:1}), {v,F,A}=L; free(F[1]); v.hp=0.5*v.maxHp; const h=v.hp;
  at(L,F[0],-8,9); hookIt(L,F[1]); near(mkLeft(L,F[1],'rvPin'),5.5,'Pinned 4 s + Pin Down 1.5 s',0.05); near(F[1].silencedT,1,'Gate Kept: 1 s',0.06); near((v.hp-h)/v.maxHp,0.05,'Nobody Leaves: 1% x 5');
  near(recRatio(L,F[1],{w:'blade',basic:true}),1.06,'Clamp Hand: 2% x 3 from his melee weapons'); near(recRatio(L,F[1],{w:'gatling',basic:true}),1,'not his ranged ones'); near(recRatio(L,F[0],{w:'blade',basic:true}),1,'not an enemy that is not Pinned');
  near(inRatio(L,{src:F[1]}),0.90,'Held Fast: 2% x 5 less from a Pinned enemy'); near(allyRatio(L,A[0],F[1]),0.90,'on an ally too'); near(allyRatio(L,A[0],F[0]),1,'not from one that is not Pinned');
  const f=F[1]; f.stunned=0; f.silencedT=0; at(L,f,1.56+2.01+2+0.0,0); f.x=v.x+(V.bodyR(v)+V.bodyR(f)+2)*V.METER; f.px=f.x; recHit(L,f,{w:'blade',basic:true}); near(gap(v,f),2-0.9,'Dragged Back: 0.3 m x 3 closer',1e-3);
  recHit(L,f,{w:'gatling',basic:true}); near(gap(v,f),1.1,'not by a ranged weapon',1e-3);
  at(L,F[2],-8,14); V.step(1); const x0=f.x, y0=f.y; f._dash={x0:f.x,y0:f.y,x1:f.x+6*V.METER,y1:f.y,t:0,dur:0.3,run:function(){ f.__landed=1; }}; secs(0.6); assert.ok(Math.hypot(f.x-x0,f.y-y0)<0.3*V.METER,'a dash goes nowhere'); assert.equal(f.__landed,1,'it lands where it stood');
  f.px=f.x; f.py=f.y; const xb=f.x; f.x+=4*V.METER; FX.tick(v,V.STEP); near(f.x,xb,'a jump of 4 m (during the tick, as a blink) is put back');
  const C=rl(S(['cw_2_4']),{big:true}); near(FX.num(C.v,'rvHookR',3*V.METER)/V.METER,6,'Long Chain: 3 m + 1 m x 3');
  const jump=(L,g1,g2)=>{ const v=L.v, f=L.F[1]; free(v); v.atkCd=1e9; free(f); at(L,L.F[0],-8,9); V.step(2); land(L); v._rvHookT=0; f.x=v.x+(V.bodyR(v)+V.bodyR(f)+g1)*V.METER; f.y=v.y; V.step(2); f.x=v.x+(V.bodyR(v)+V.bodyR(f)+g2)*V.METER; V.step(1); return (v._rvHookT||0)>0; };
  assert.equal(jump(C,5,9),true,'an enemy 5 m away that jumps to 9 m is hooked (the game\'s own hook, its reach 6 m)'); assert.equal(jump(rl(null,{big:true}),5,9),false,'without Long Chain: not (3 m)');
});

test('Rivet / Hook in the Cycle (PICK ONE: the hook after the lower spike, its stun under the stun-lock rule) and Reel In',()=>{
  const L=rl(S(['cw_5_2','cw_6_2']),{big:true}), {v,F}=L; free(F[0]);
  const ws=[]; for(let i=0;i<4;i++){ ws.push(shoot(L,F[0])); free(F[0]); } rv(L).st={}; free(F[0]);
  const w5=shoot(L,F[0]); ws.push(w5); assert.deepEqual(ws,['blade','hammer','uspike','lspike','hook'],'the cycle of five'); near(F[0].stunned,3.0,'its 3 s stun',0.03);
  assert.equal(shoot(L,F[0]),'blade','and round again');
  near(recRatio(L,F[0],{w:'hook',cyc:true,basic:true}),1.20,'Reel In: the cycle\'s hook 4% x 5'); near(recRatio(L,F[0],{w:'hook',auto:true}),1,'not the automatic hook');
  for(let i=0;i<3;i++) shoot(L,F[0]); free(F[0]); const st=rv(L).st[F[0].uid]; if(st){ st.after=5; st.mine=0; } else rv(L).st[F[0].uid]={t:F[0],mine:0,after:5,run:0,free:0,n:0};
  assert.equal(shoot(L,F[0]),'hook'); assert.ok(!(F[0].stunned>0.01),'within 0.5 s after his stun ended: the cycle\'s hook does not stun');
  free(F[0]); F[0].stunned=1.0; for(let i=0;i<4;i++){ shoot(L,F[0]); F[0].stunned=1.0; } F[0].stunned=1.0; rv(L).st={};
  assert.equal(shoot(L,F[0]),'hook'); assert.ok(F[0].stunned<1.01,'on a stunned enemy: no stun of its own');
});

test('Rivet / Hammer Hand (PICK ONE: the hammer twice, 1 s), Ringing Blow, Hard Questions (15%), Spike Rhythm (3.9 s), the second hammer under the stun-lock rule',()=>{
  const L=rl(S(['cw_5_3','cw_7_3','nc_7_1','cw_10_3']),{big:true}), {v,F}=L; free(F[0]);
  const ws=[]; for(let i=0;i<5;i++){ rv(L).st={}; free(F[0]); const w=shoot(L,F[0]); ws.push(w);
    if(i===1) near(F[0].stunned,1.15,'the hammer: 1 s x Hard Questions',0.03); if(i===2) near(F[0].silencedT,3.9,'Spike Rhythm: 3 s + 0.3 s x 3',0.02); if(i===4) near(F[0].stunned,1.15,'the second hammer',0.03); }
  assert.deepEqual(ws,['blade','hammer','uspike','lspike','hammer']);
  near(recRatio(L,F[0],{w:'hammer',basic:true}),1.15,'Ringing Blow 3% x 5');
  free(F[0]); F[0].stunned=0.5; for(let i=0;i<4;i++){ shoot(L,F[0]); F[0].stunned=0.5; } rv(L).st={}; F[0].stunned=0.5; assert.equal(shoot(L,F[0]),'hammer'); assert.ok(F[0].stunned<0.51,'the second hammer never on a stunned enemy');
  const Q=rl(S(['nc_7_1']),{big:true}); free(Q.F[0]); shoot(Q,Q.F[0]); assert.equal(shoot(Q,Q.F[0]),'hammer'); near(Q.F[0].stunned,2.3,'Hard Questions: the hammer 2 s x 1.15',0.03);
  free(Q.F[2]); Q.st={}; rv(Q).st={}; hookIt(Q,Q.F[2]); near(Q.F[2].stunned,3.45,'the hook 3 s x 1.15 (past the game\'s 2.8 s cap, in full)',0.02);
});

test('Rivet / Machine Patience (a full melee cycle, 0.5% x 5 attack, up to 10, this wave) and Clockwork Fury (at 10, melee 5% crit)',()=>{
  const L0=rl(null,{big:true}), a0=L0.v.dmg;
  const L=rl(S(['cw_11_2','cw_12_2']),{big:true}), {v,F}=L;
  for(let i=0;i<3;i++) shoot(L,F[0]); shoot(L,F[1]); shoot(L,F[0]); assert.equal(stack(L,'rvMp'),0,'a shot between: no cycle'); for(let i=0;i<4;i++) shoot(L,F[0]); assert.equal(stack(L,'rvMp'),1,'four melee in a row');
  setStack(L,'rvMp',10); V.step(1); near(v.dmg/a0,1.25,'10 cycles: 25% attack');
  brnd(0.049); assert.equal(critRec(L,F[0],{w:'blade'}),true,'Clockwork Fury: 5%'); brnd(0.051); assert.equal(critRec(L,F[0],{w:'blade'}),false); brnd(0); assert.equal(critRec(L,F[1],{w:'gatling'}),false,'not a ranged weapon');
  setStack(L,'rvMp',9); brnd(0); assert.equal(critRec(L,F[0],{w:'blade'}),false,'not at 9');
  V.wave(); V.step(2); assert.equal(stack(L,'rvMp'),0,'a new wave');
});

test('Rivet / Arms for the Gap (SIGNATURE): an enemy Pinned at full Torque - four melee attacks in order at double speed, everything within 3 m hooked in and Pinned; once every 20 s',()=>{
  const L=rl(S(['cw_13_2','cw_1_1']),{big:true,foes:4,pos:[null,null,null,[1,5]]}), {v,F}=L; const i0=v.atkInterval; v.target=F[1];
  setStack(L,'rvTq',10); setMk(L,F[1],'rvPin'); const g3=gap(v,F[3]); V.step(1); assert.equal(rv(L).agN,4,'four melee attacks'); near(rv(L).sigA,20,'once every 20 s',0.05);
  assert.ok(g3<3,'F3 within 3 m ('+g3.toFixed(2)+')'); near(gap(v,F[3]),0.5,'hooked in to 0.5 m',0.02); assert.ok(mkLeft(L,F[3],'rvPin')>3.9,'and Pinned'); near(gap(v,F[0]),0.5,'F0 too',0.02);
  V.step(1); near(v.atkInterval,i0/(2+0.02*stack(L,'rvTq')),'double attack speed (with the Torque\'s own)',1e-3);
  v._rvMi=2; assert.deepEqual([0,1,2,3].map(()=>shoot(L,F[0])),MEL,'the whole cycle in order, whatever the counter'); assert.equal(rv(L).agN,0); V.step(1); near(v.atkInterval,i0/(1+0.02*stack(L,'rvTq')),'then his own speed',1e-3);
  setStack(L,'rvTq',10); V.step(2); assert.equal(rv(L).agN,0,'not again within 20 s');
});

test('Rivet / Cracks: each stun, silence or slow a Crack, 3 = Cracked (3 s, Fine Fracture 4.5 s; armor 30% lower), Walnut Grip (the hammer 2), Stress Point, Split Grain, Nothing Cancelled',()=>{
  const L0=rl(null,{big:true}), ar=L0.F[0].armorRating, sp=L0.F[0].speed, ai=L0.F[0].atkInterval;
  const L=rl(S(['nc_1_1','nc_2_1','nc_3_1','nc_9_2','nc_10_1','nc_11_2']),{big:true}), {v,F}=L; free(F[0]); F[0].speed=sp;
  shoot(L,F[0]); assert.equal(ust(L,F[0],'rvCr'),0,'the blade: no control'); shoot(L,F[0]); assert.equal(ust(L,F[0],'rvCr'),2,'the hammer\'s stun: 2 (Walnut Grip)'); V.step(1); near(F[0].atkInterval,ai/0.9,'Stress Point: 5% a Crack');
  F[0].stunned=0; shoot(L,F[0]); assert.equal(ust(L,F[0],'rvCr'),0,'the spike\'s silence: 3 - Cracked, and they clear'); near(mkLeft(L,F[0],'rvCk'),4.5,'Cracked 3 s + 1.5 s',0.05); assert.equal(stack(L,'rvNc'),1,'Nothing Cancelled');
  V.step(1); near(F[0].armorRating/ar,0.70,'its armor 6% x 5 lower'); near(F[0].speed/sp,0.85,'Split Grain: 3% x 5 slower');
  V.cc(v,F[1],'slow',2); assert.equal(ust(L,F[1],'rvCr'),1,'a slow of his: 1');
  secs(4.6); V.step(1); near(F[0].armorRating/ar,1,'its armor back when Cracked ends');
  setStack(L,'rvNc',10); V.step(1); near(v.dmg/L0.v.dmg,1.20,'10 Crackings: 20% attack');
});

test('Rivet / on Cracked enemies: Shell Splinters, Nutcracker\'s Jaw, One Function, Fracture Lines, Deep Fracture, Cracked Open (once every 10 s), Fits the Rack (6%, LINK: a step of the Rack)',()=>{
  const L=rl(S(['nc_4_1','nc_8_1','nc_12_2','nc_6_1','nc_12_1','nc_10_2','nc_n2','lw_1_1']),{big:true,allies:1}), {v,F,A}=L; for(const f of F) free(f);
  setMk(L,F[2],'rvCk'); near(ratio(L,F[2]),1.10,'Shell Splinters 2% x 5'); near(recRatio(L,F[2],{w:'hammer',basic:true}),1.10*1.15,'Nutcracker\'s Jaw 3% x 5'); near(recRatio(L,F[2],{w:'blade',basic:true}),1.10,'not the blade');
  near(ratio(L,F[2],{crit:true}),1.10*1.10,'One Function: its criticals 2% x 5 more'); near(allyRatio(L,F[2],A[0]),1.06,'Fracture Lines: from his allies 2% x 3');
  const hl=()=>{ F[2].hp=5e8; V.heal(F[2],1000); return F[2].hp-5e8; }; near(hl()/plainHit(L,hl),0.85,'Deep Fracture: 15% less healing');
  v.greenCd=7; crackBy(L,F[0]); assert.ok(mkLeft(L,F[0],'rvCk')>0,'three slows: Cracked'); assert.equal(v.greenCd,0,'Cracked Open: Scattergun ready'); v.greenCd=7; crackBy(L,F[1]); assert.equal(v.greenCd,7,'not again within 10 s');
  assert.ok(mkLeft(L,F[0],'rvFr')>0,'Fits the Rack'); const r0=rv(L).rack; near(recRatio(L,F[0],{w:'gatling',basic:true}),1.06*1.10,'his next attack on it 6% (and Shell Splinters)'); assert.equal(rv(L).rack,r0+1,'and a step of the Rack');
  near(recRatio(L,F[0],{w:'revolver',basic:true}),1.10,'once'); near(recRatio(L,F[1],{w:'gatling',basic:true}),1.06*1.10); assert.equal(rv(L).rack,r0+1,'at most once per rack');
});

test('Rivet / Spare Parts: a Part a Cracking (8, Spare Bolts 14), fitted below 50% (3% x a Part, Patch Kit 1% more), Quick Fit (in the group), Salvage, Spare Arm, Self-Made under the budget, a new wave, Hold the Walnut',()=>{
  const L0=rl(null,{big:true}), i0=L0.v.atkInterval;
  const L=rl(S(['nc_1_4','nc_2_4','nc_6_4','nc_3_4','nc_5_4','nc_9_4','nc_10_4']),{big:true,foes:4}), {v,F}=L; for(const f of F) free(f); v.hp=0.6*v.maxHp;
  crackBy(L,F[0]); crackBy(L,F[1]); assert.equal(stack(L,'rvPt'),2,'a Part each'); setStack(L,'rvPt',13); crackBy(L,F[3]); crackBy(L,F[2]); assert.equal(stack(L,'rvPt'),14,'14 at most with Spare Bolts');
  setStack(L,'rvPt',8); V.step(1); near(v.atkInterval,i0/1.10,'Spare Arm: 8 Parts, 2% x 5');
  setStack(L,'rvPt',10); v.hp=0.45*v.maxHp; V.step(1); near(v.hp/v.maxHp,0.45+10*0.04,'below 50%: all 10 fitted, 4% each'); assert.equal(stack(L,'rvPt'),0); assert.ok(win(L,'rvQf'),'Quick Fit');
  near(inRatio(L,{src:F[3]}),1-0.025*10,'Quick Fit: 0.5% x 5 a Part, for 3 s'); secs(3.1); near(inRatio(L,{src:F[3]}),1,'over');
  setMk(L,F[2],'rvCk'); F[2].hp=1; V.hit(v,F[2],100,{kind:'true'}); assert.ok(!F[2].alive); assert.equal(stack(L,'rvPt'),3,'Salvage: 1 x 3 from a Cracked enemy\'s death');
  setStack(L,'rvPt',10); v.hp=0.6*v.maxHp; rv(L).hb=0; rv(L).smT=5; const h=v.hp; secs(5.1); near((v.hp-h)/v.maxHp,0.05,'Self-Made: 0.5% x 10 Parts at the 5 s mark (5 s of budget kept)',2e-3);
  setStack(L,'rvPt',14); rv(L).hb=0; rv(L).smT=5; const h1=v.hp; secs(5.05); near((v.hp-h1)/v.maxHp,0.06,'14 Parts (7%): only the 5 s of budget, 1.2% a second',2e-3);
  setStack(L,'rvPt',14); rv(L).hb=0; rv(L).smT=0.01; const h2=v.hp; V.step(2); assert.ok((v.hp-h2)/v.maxHp<0.0012,'with an empty budget it pays only what came in');
  V.wave(); V.step(2); assert.equal(stack(L,'rvPt'),0,'a new wave: the Parts are lost');
  const W=rl(S(['nc_1_4','nc_11_1']),{big:true}); setStack(W,'rvPt',5); V.wave(); V.step(2); assert.equal(stack(W,'rvPt'),5,'Hold the Walnut: kept');
  const M=rl(S(['nc_1_4']),{big:true}); for(const f of M.F) free(f); setStack(M,'rvPt',8); crackBy(M,M.F[0]); assert.equal(stack(M,'rvPt'),8,'8 at most without Spare Bolts');
});

test('Rivet / Last Spare: once a fight, a killing blow while he carries Parts - fitted, and held at 1 HP for 1.5 s',()=>{
  const L=rl(S(['nc_12_4','nc_1_4']),{pre:L=>{ L.v.maxHp=1e5; L.v.hp=1e5; }}), {v,F}=L; v.hp=0.6e5; setStack(L,'rvPt',4); V.step(1);
  v.hp=10; V.hit(F[0],v,5000,{kind:'true'}); assert.ok(v.alive,'held'); assert.ok(v.hp>0.10e5&&v.hp<0.13e5,'fitted: 4 x 3% after the hold at 1 HP ('+v.hp+')'); assert.equal(stack(L,'rvPt'),0);
  V.hit(F[0],v,1e6,{kind:'true'}); assert.ok(v.alive&&v.hp>=1,'held at 1 HP for 1.5 s'); secs(1.6); setStack(L,'rvPt',4); v.hp=10; V.hit(F[0],v,5000,{kind:'true'}); assert.ok(!v.alive,'once a fight');
});

test('Rivet / Smoke Bomb: Thick Smoke (15% stronger), Lingering Smoke (2.3 s), Spreading Smoke (PICK ONE: within 2 m of its target, a Crack), Smoke Screen (in the groups), Hinge Oil, Smoke and Sight, Second Look',()=>{
  const L=rl(S(['nc_2_2','nc_4_2','nc_5_2','nc_6_2','nc_12_3','lw_12_1','lw_12_4']),{big:true,allies:1,pos:[[3,-6],null,[10,4.5]]}), {v,F,A}=L; for(const f of F) free(f);
  const m=V.slowMulFor(10); V.cast(v,'blue',F[1]); near(F[1].slow,1.4+0.9,'Lingering Smoke: 1.4 s + 0.3 s x 3'); near(F[1].slowMul,1-(1-m)*1.15,'Thick Smoke: 3% x 5 stronger');
  assert.ok(gap(F[1],F[2])<2,'F2 within 2 m of it'); near(F[2].slow,2.3,'Spreading Smoke: F2 slowed as long'); near(F[2].slowMul,F[1].slowMul,'and as hard'); assert.equal(ust(L,F[2],'rvCr'),1,'and gains a Crack'); assert.ok(!(F[0].slow>0),'not F0, farther away');
  assert.equal(ust(L,F[1],'rvSi'),3,'Smoke and Sight: its target Sighted 3');
  near(inRatio(L,{src:F[1]}),0.90,'Smoke Screen: 2% x 5 less from an enemy it slowed'); near(allyRatio(L,A[0],F[2]),0.90,'on an ally too'); secs(2.4); near(inRatio(L,{src:F[1]}),1,'while the slow lasts');
  near(FX.cd(v,'blue',9),8,'Hinge Oil: 0.5 s x 2');
  setUst(L,F[3],'rvSi',1); near(skillRatio(L,F[3],'spread'),1.06,'Second Look: Scattergun 2% x 3 on a Sighted enemy'); near(skillRatio(L,F[3],'slow'),1.06,'and Smoke Bomb'); near(skillRatio(L,F[4],'slow'),1,'not unSighted');
  const N=rl(S(['nc_6_2','nc_2_2']),{big:true}); free(N.F[1]); V.cast(N.v,'blue',N.F[1]); near(inRatio(N,{src:N.F[1]}),1,'Smoke Screen without Spreading Smoke: nothing');
});

test('Rivet / Oil in the Eyes (PICK ONE: 1 s silence, 2 Cracks), Black Oil, Smoke in Their Face',()=>{
  const L=rl(S(['nc_5_3','nc_7_3','nc_1_1','cw_9_2']),{big:true}), {v,F}=L; for(const f of F) free(f);
  V.cast(v,'blue',F[1]); near(F[1].silencedT,1,'silenced 1 s'); assert.ok(mkLeft(L,F[1],'rvCk')>0,'its slow (1) and the silence (2): Cracked');
  near(skillRatio(L,F[1],'slow'),1.20,'Black Oil: 4% x 5'); near(skillRatio(L,F[0],'slow'),1.20*1.20,'Smoke in Their Face: 4% x 5 more within 3 m'); near(skillRatio(L,F[0],'spread'),1,'not Scattergun');
});

test('Rivet / Scattergun: Scrap Load (12%) and Close Enough (15% within 3 m), on a target where it reaches before and after v1391',()=>{
  const P0=rl(null,{big:true}); at(P0,P0.F[0],3.0,0); const a0=lost(P0.F[0],()=>V.cast(P0.v,'green',P0.F[0]));
  const L=rl(S(['lw_10_2','cw_10_1']),{big:true}); at(L,L.F[0],3.0,0); const a1=lost(L.F[0],()=>V.cast(L.v,'green',L.F[0]));
  assert.ok(a0>0); near(a1/a0,1.12*1.15,'Scrap Load 4% x 3, Close Enough 3% x 5'); near(skillRatio(L,L.F[1],'spread'),1.12,'at 6.4 m: Scrap Load only');
});

test('Rivet / The Third Winter (SIGNATURE): a Cracking runs through the line - every other enemy within 4 m Cracked, stunned 1 s (the lock), a Part each; once every 25 s',()=>{
  const L=rl(S(['nc_13_2','nc_1_1','nc_7_1']),{big:true,foes:5}), {v,F}=L; for(const f of F) free(f); F[3].stunned=0.5;
  crackBy(L,F[0]); for(const i of [1,3,4]) assert.ok(mkLeft(L,F[i],'rvCk')>0,'F'+i+' within 4 m: Cracked'); assert.ok(!(mkLeft(L,F[2],'rvCk')>0),'not F2 (7 m of ground)');
  near(F[1].stunned,1.15,'stunned 1 s x Hard Questions',1e-3); near(F[4].stunned,1.15,'',1e-3); near(F[3].stunned,0.5,'not an enemy already stunned',1e-3); assert.ok(!(F[2].stunned>0));
  assert.equal(stack(L,'rvPt'),3,'a Part each (three)'); near(rv(L).sigT,25,'once every 25 s',0.01);
  for(const f of F) free(f); crackBy(L,F[2]); assert.ok(!(F[1].stunned>0),'not again within 25 s');
});

test('Rivet / the caps: damage reduction one group at most 35% (an ally 20%), crit one group at most 5%, Patched Joints, Seized Gears, Grounded Frame 20%, his stuns at most 4 s in a row',()=>{
  const all=['lw_11_3','lw_n1','cw_11_4','cw_4_1','cw_4_3','cw_10_4','nc_11_3','nc_n1','nc_3_4','nc_9_3','nc_6_2','nc_5_2','cw_1_1','cw_2_1'];
  const L=rl(S(all),{big:true,allies:1}), {v,F,A}=L; const f=F[0]; setUst(L,f,'rvSi',5); setMk(L,f,'rvPin'); setMk(L,f,'rvSz'); setMk(L,f,'rvSm'); setStack(L,'rvTq',16); v.hp=0.4*v.maxHp; L.T.s.w.rvQf={t:3,n:14,cdT:0,at:-1,wave:false};
  near(inRatio(L,{src:f}),0.65,'every one at once: 35% at most'); near(allyRatio(L,A[0],f),0.90*0.90,'an ally: Held Fast and Smoke Screen multiply (the group\'s 20% holds above them)');
  L.T.s.w.rvQf.t=0; setStack(L,'rvTq',0); v.hp=v.maxHp; for(const k of ['rvPin','rvSz','rvSm']) delete f._talM[v.uid][k]; setUst(L,f,'rvSi',0,0);
  near(inRatio(L,{src:f}),0.925*0.925*0.94,'an ability within 3 m: Bolted Seams 7.5%, Rust-Proof 7.5%, Iron Apron 6%'); near(inRatio(L,{src:f,auto:true}),0.94,'a basic attack: Iron Apron only');
  near(inRatio(L,{src:F[1]}),0.925*0.925*0.925,'farther than 6 m: Reinforced Plating 7.5% instead');
  VMX('pushDot')(v,100,3,1,'#8f8fa8',F[1],'true'); const d=v.dots[v.dots.length-1]; const keep=FX.dotPre(v,d); const x=d.dps; FX.dotPost(v,d,keep); near(x/100,0.925*0.925*0.925,'damage over time too (an ability)');
  const C=rl(S(['lw_3_2','lw_4_4','cw_5_1','cw_12_2','nc_8_3']),{big:true}), g=C.F[0]; setUst(C,g,'rvSi',5); setStack(C,'rvMp',10); g.slow=3; brnd(0.0499); assert.equal(critRec(C,g,{w:'blade'}),true,'all of them on one hit: 5%');
  brnd(0.0501); assert.equal(critRec(C,g,{w:'blade'}),false,'5% at most'); g.slow=0; setUst(C,g,'rvSi',0,0); brnd(0.0499); assert.equal(critRec(C,C.F[1],{w:'revolver'}),true,'Revolver Rounds alone: 5%'); brnd(0.0501); assert.equal(critRec(C,C.F[1],{w:'revolver'}),false);
  const J=rl(S(['cw_12_3','nc_n1']),{big:true}), w=J.v; free(J.F[0]); w.hp=0.5*w.maxHp; const h=w.hp; shoot(J,J.F[0]); shoot(J,J.F[0]); near((w.hp-h)/w.maxHp,0.02,'Patched Joints: the hammer\'s stun heals 1% x 2'); assert.ok(mkLeft(J,J.F[0],'rvSz')>2.5,'Seized Gears: marked 3 s');
  near(inRatio(J,{src:J.F[0]}),0.90,'Seized Gears 2% x 5'); secs(3.1); near(inRatio(J,{src:J.F[0]}),1,'3 s');
  const U=rl(S(['cw_3_3']),{big:true}); free(U.v); U.v.level=1; V.cc(U.F[0],U.v,'stunned',2); near(U.v.stunned,V.ccNerf*2*0.8,'Grounded Frame 20%',1e-3);
  const Q=rl(S(['nc_7_1']),{big:true}), g0=Q.F[0]; free(g0); const st=rv(Q).st; g0.stunned=1; st[g0.uid]={t:g0,mine:1,after:0,run:3.6,free:0,n:1};
  near(FX.cc(Q.v,g0,'stunned',2.0),0.4,'3.6 s in a row already: at most 0.4 s more (not 2 x 1.15)'); g0.stunned=0.2; st[g0.uid].mine=0.2; st[g0.uid].run=3.9; secs(0.4);
  assert.ok(st[g0.uid].free>0,'the run reached 4 s: then 0.5 s free'); assert.equal(FX.cc(Q.v,g0,'stunned',2.0),0,'no stun of his in it'); secs(0.6); near(FX.cc(Q.v,g0,'stunned',2.0),2.3,'after it: in full again');
});

test('Rivet: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['lw_1_1','lw_1_4','lw_4_1','cw_1_1','cw_1_4','nc_1_1','nc_1_4','lw_11_2']), TEAM=['vael','sylthaine','vireo','vex','rivet'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(['vael','sylthaine','vireo','vex','konwu'].map(k=>spec(k,100))),7), s=U.find(u=>u.key===H);   /* v1452: seed 7 - the v1452 control rules changed this seeded fight; seed 4 no longer has a Full Rack in it (seed 7 has). Checked (Claude 25 Nov): not a lost mechanic - on v1451 seed 4's first Full Rack came at 54.7 s; with v1452's control rules that fight ends at 44.8 s, before it */
  assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let full=0, si=0, tq=0, ck=0, pin=0, fr0=false;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const o=s._tal.s.rv; if(!o) continue; if(o.full&&!fr0) full++; fr0=o.full; tq=Math.max(tq,(s._tal.s.k.rvTq||{}).n||0);
    for(const f of VMX('units').filter(u=>u.team==='enemy')){ const m=f._talM&&f._talM[s.uid]; if(!m) continue; if(m['#rvSi']&&m['#rvSi'].until>V.now()) si=Math.max(si,m['#rvSi'].v); if(m.rvCk) ck++; if(m.rvPin) pin++; } }
  console.log('  live fight: Full Racks '+full+', Sighted at most '+si+', Torque at most '+tq+', ticks with a Cracked enemy '+ck+', with a Pinned enemy '+pin+', Eighty Years '+((s._tal.s.k.rvEy||{}).n||0));
  assert.ok(full>0||((s._tal.s.k.rvEy||{}).n||0)>0,'a real Full Rack'); assert.ok(si>=2,'real Sighted steps'); assert.ok(tq>=1,'real Torque');
  determinism(H,TEAM);
});

/* The page sites his talents added (the weapon pick, the attack record and the blows around it, the hook's record and blows, a weapon control's length, the cannon's
   cone, the hook's reach, and the bound rvFire): with nothing learned, whole seeded fights with Rivet in the line-up are identical to the pre-talent page (ee8edab8),
   seed by seed. The counters are also the base-skill measure of the report. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Rivet: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['rivet','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __rvN={pick:0,fire:0,hook:0,cc:0,cannon:0,tick:0}; var __rvP=rivetPick, __rvF=rivetFire, __rvH=rivetHook, __rvC=rivetCC, __rvU=_updateBattleCore;'+
    'rivetPick=function(u,t){ __rvN.pick++; return __rvP.apply(this,arguments); }; rivetFire=function(u){ __rvN.fire++; if(u._rvWpn==="cannon") __rvN.cannon++; return __rvF.apply(this,arguments); };'+
    'rivetHook=function(){ __rvN.hook++; return __rvH.apply(this,arguments); }; rivetCC=function(){ __rvN.cc++; return __rvC.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ for(const u of units) if(u&&u.key==="rivet"&&u.alive) __rvN.tick++; return __rvU.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    /* a scripted chain hook on an enemy that jumps out of his 3 m (the automatic hook fires a few times a fight: its site is run here for certain) */
    const RS=`(function(al,fo){ ended=false; state='battle'; CUR={mode:'replay',seed:9}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true; try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0; seedBattle(9); setupMarchTeams(al,fo,false);
      const k=units.find(u=>u.key==='rivet'), f=units.find(u=>u.team==='enemy'); k.x=300; k.y=700; f.x=k.x+4.2*METER; f.y=k.y; let hs=[];
      for(let i=0;i<120;i++){ if(i===20){ f.x=k.x+12*METER; } updateBattle(SIM_STEP); hs.push([Math.round(f.hp),Math.round(f.x),+(f.stunned||0).toFixed(3)]); } return JSON.stringify([hs,brnd()]); })`;
    const sc=h=>{ const al=JSON.stringify(h.snapFromSpecs([spec('rivet',100)])), fo=JSON.stringify(h.snapFromSpecs([spec('vael',100)])); return vm.runInContext(RS+'('+al+','+fo+')',h.ctx); };
    assert.equal(sc(NOW),sc(BASE),'a scripted hook on an enemy that jumps out of 3 m: identical'); n++;
    const c=VMX('__rvN'); console.log('  identity / base skills: '+JSON.stringify(c));
    assert.ok(c.tick>0&&c.pick>0&&c.fire>0&&c.hook>0&&c.cc>0&&c.cannon>0,'the fights picked and fired his weapons, hooked, held a weapon control and fired the cannon: every new site was run'); }
  finally{ VMX('rivetPick=__rvP; rivetFire=__rvF; rivetHook=__rvH; rivetCC=__rvC; _updateBattleCore=__rvU;'); }
  assert.ok(n>=19);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at 85% or more for more than half a battle is too strong.
   His damage reduction talents (and armor / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ lw:['lw_11_3','lw_n1','lw_3_3','lw_1_4'],
            cw:['cw_11_4','cw_4_1','cw_4_3','cw_10_4','cw_8_3','cw_1_2','cw_3_3','cw_1_1','cw_2_1','cw_1_4'],
            nc:['nc_11_3','nc_n1','nc_3_4','nc_9_3','nc_6_2','nc_5_2','nc_4_3','nc_1_3','nc_1_4','nc_2_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={lw:0,cw:1,nc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (an ability from an enemy within 3 m, or one farther than 6 m: Sighted 5, Pinned, Seized,
   slowed by his Smoke Bomb, full Torque, below half HP, Quick Fit after 14 Parts); sustained: a usual state (a basic attack from within 3 m, 5 Torque, nothing else) */
function worstHit(list,kind,crit,sustained,far){ const L=rl(list,{foes:3}), {v,F}=L, f=far?F[1]:F[0];
  v.maxHp=1e5; v.hp=sustained?8e4:4e4;
  const put=()=>{ if(!L.T) return; if(!sustained){ setUst(L,f,'rvSi',5); setMk(L,f,'rvPin'); setMk(L,f,'rvSz'); setMk(L,f,'rvSm'); setStack(L,'rvTq',16); L.T.s.w.rvQf={t:3,n:14,cdT:0,at:-1,wave:false}; } else setStack(L,'rvTq',5); };
  put(); V.step(1); put(); v.hp=sustained?8e4:4e4;
  v.shield=1e12; v.shieldT=999;
  const raw=sustained?5e3:2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:!!sustained})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Rivet: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['nc','cw'],[61,30]],[['cw','nc'],[61,30]],[['nc'],[91]],[['cw'],[91]],[['nc','lw'],[61,30]],[['lw','nc'],[61,30]],[['cw','lw'],[61,30]],[['nc','cw','lw'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) for(const far of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false,far));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,gl:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="rivet"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="rivet"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const T=u._tal; if(T&&T.s.api){ let w=0; for(const e of units){ if(!e.alive||e.team===u.team) continue; const k=T.fn.drK(T.s.api,T,u,e,{auto:false})*Math.max(defMul(e,u,"phys"),defMul(e,u,"magic"))*(u.drMul||1)*(1-(u.glyphDR||0)); if(1-k>w) w=1-k; } if(w>=0.85) __dr.tHi++; if(w>__dr.gl) __dr.gl=w; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','rivet'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; ticks at 85% or more against the strongest-reduced attacker '+d.tHi+' of '+d.ticks+' ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%, the highest '+(d.gl*100).toFixed(1)+'%); immune '+d.imm);
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* The stun-lock rule and the 4 s run in real fights: his stun builds (91 Close Work with Hook in the Cycle; 91 The Nutcracker with The Third Winter and Hard Questions;
   61 Close Work with Hammer Hand + 30 The Nutcracker): the longest time one enemy stays stunned by him in a row */
function hammerBuild(){ let b={r:{}}; const meta=id=>T.talent(H,id), tr=T.trees(H)[1];
  for(let g=0;g<800&&(T.spent(H,b).tree.close_work||0)<61;g++){ if(!b.r.cw_5_3&&T.canLearn(H,b,'cw_5_3',100)){ b=T.learn(H,b,'cw_5_3',100).build; continue; } const pool=tr.talents.filter(t=>t[0]!=='cw_5_2'&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; }
  const t2=T.trees(H)[2]; for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const pool=t2.talents.filter(t=>T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; }
  return b; }
test('Rivet: in seeded fights with his stun builds, no enemy stays stunned by him more than 4 s in a row',()=>{
  const lists=[T.learned(H,build(H,1,91,100)),T.learned(H,build(H,2,91,100)),T.learned(H,hammerBuild())];
  assert.ok(lists[0].some(e=>e[0]==='cw_5_2'),'91 Close Work takes Hook in the Cycle'); assert.ok(lists[2].some(e=>e[0]==='cw_5_3'),'the third build takes Hammer Hand');
  /* his stun on an enemy: from the moment one of his lands (the game's ccApply, then his weapon's own length in rivetCC) until it would end; a run is HIS stun time inside
     one stretch the enemy stays stunned (an ally's stun in between does not end the stretch, and is not counted) */
  VMX('var __st={runs:[],cur:{}}; var __sc=ccApply, __sr=rivetCC, __su=_updateBattleCore;'+
    'var __mk=t=>{ t.__rvEnd=Math.max(t.__rvEnd||0,battleTime+(t.stunned||0)); };'+
    'ccApply=function(u,t,f,d){ const s0=(t&&t.stunned)||0, r=__sc.apply(this,arguments); if(r&&u&&u.key==="rivet"&&f==="stunned"&&(t.stunned||0)>s0+1e-9) __mk(t); return r; };'+
    'rivetCC=function(u,t,f,v){ const s0=(t&&t[f])||0, r=__sr.apply(this,arguments); if(r&&f==="stunned"&&(t.stunned||0)>s0+1e-9) __mk(t); return r; };'+
    '_updateBattleCore=function(dt){ const r=__su.apply(this,arguments); for(const e of units){ if(e.team==="ally") continue; const id=e.uid;'+
    '  if(e.alive&&(e.stunned||0)>0){ if((e.__rvEnd||0)>battleTime-dt+1e-9) __st.cur[id]=(__st.cur[id]||0)+dt; } else { if(__st.cur[id]) __st.runs.push(__st.cur[id]); __st.cur[id]=0; e.__rvEnd=0; } } return r; };');
  const out=[];
  try{ for(const list of lists){ VMX('__st.runs=[]; __st.cur={};');
      const sn=snaps(['vael','sylthaine','vireo','vex','rivet'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
      for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
      const foe=snaps(['vex','nox','rafe','sloe','konwu'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
      for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
      const s=VMX('__st'); for(const k in s.cur) if(s.cur[k]) s.runs.push(s.cur[k]); out.push([s.runs.length,Math.max(0,...s.runs)]); } }
  finally{ VMX('ccApply=__sc; rivetCC=__sr; _updateBattleCore=__su;'); }
  console.log('  stun chain (91 Close Work / 91 The Nutcracker / 61 Close Work with Hammer Hand + 30): '+out.map(o=>o[0]+' runs, the longest '+o[1].toFixed(2)+' s').join(' | '));
  for(const o of out){ assert.ok(o[0]>0,'he stunned someone'); assert.ok(o[1]<=4.0+0.1,'never past 4 s in a row: '+o[1].toFixed(2)); }
});
