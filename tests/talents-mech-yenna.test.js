'use strict';
/* Yenna Cacklefang's talents as data on the mechanics layer (talents-mech/yenna.js), family by family on the still field (tests/talents-lab.js), then the caps,
   the wave clock, whole-fight determinism, the no-talent identity, her longest fear chain and Phil's 95% ceiling.
   Lab conventions (measured while writing these tests):
   - She stands at (300,700), FREE (not held: her return pass is counted in her own status pass, which a stun or fear stops), with speed 0 and no attack or skill
     of her own; lab foes are plain rank-0 Vaels held in place (stunned: "held" for Pack Opportunist and Taken by the Throat), level 1 (no resist roll), no armour
     or magic resist. autoUlt is off so the hits she takes cannot fire her ultimate.
   - Rending Return (green, a direct cast) strikes the FIRST THREE living enemies in the line-up's order - F0, F1, F2 here - wherever they stand (the skill has no
     reach test; v1391's reach fix does not touch it), and its return comes 0.45 s later in reverse order for 1.6 x. Both before and after v1391 the lab's three
     first foes are the ones struck.
   - Laughing Mark (blue) marks the lowest HP share: F0 is given a lower share. Crescent Stampede is cast with the game's own merge of ULT_DEF.multiShot and
     HERO_ULT_ART.yenna (ricochet), as think casts it.
   Run: node --test tests/talents-mech-yenna.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),cp=require('node:child_process');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='yenna', S=ids=>full(H,ids), R=id=>T.talent(H,id).ranks;
const VMX=s=>vm.runInContext(s,NOW.ctx);
const TEAM=['vael','sylthaine','vireo','vex','yenna'];
const ye=L=>L.T.s.ye;
const rq=(L,t)=>ye(L).e[t.uid];
const api=L=>L.T.s.api||FX.api();
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const free=L=>{ for(const f of L.F){ f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.energyReg=0; f.mrRating=0; f.armorRating=0; } };
const freeA=L=>{ for(const a of L.A){ a.stunned=0; a.level=1; a.speed=0; a.atkCd=1e9; a.greenCd=1e9; a.blueCd=1e9; a.energy=0; a.energyReg=0; } };
const freeY=L=>{ const v=L.v; v.stunned=0; v.fearT=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; v.level=1; };
const L0=(ids,o)=>{ const L=lab(H,ids?S(ids):null,Object.assign({foes:3,big:true},o||{})); VMX('autoUlt=false'); free(L); freeA(L); freeY(L); return L; };
const castR=L=>V.cast(L.v,'green');
const castB=L=>V.cast(L.v,'blue');
const castU=(L,t)=>{ if(t) L.v.target=t; VMX('(function(u){ u._castSlot="ult"; u._castLv=(u.skillLv&&u.skillLv[0])||1; u._castSM=skillMul(u._castLv); try{ doEffect(u,"multiShot",Object.assign({},ULT_DEF.multiShot,HERO_ULT_ART.yenna)); } finally{ u._castSM=1; u._castLv=0; } })')(L.v); };
const back=(L,t)=>lost(t,()=>secs(0.6));                                  // the return lands within 0.6 s
const asSk=(L,sk,fn)=>{ const s=L.T?L.T.s:null, pv=s?s.cur:null; if(s) s.cur=sk; try{ return fn(); } finally{ if(s) s.cur=pv; } };   // a hit read as that skill's
const hitBy=(a,b,amt,o)=>lost(b,()=>V.hit(a,b,amt,Object.assign({kind:'true'},o||{})));
const nerve=L=>stack(L,'yeNerve');
const setN=(L,n)=>api(L).stSet(L.T,L.v,'yeNerve',n);
const far=L=>{ L.F.forEach((f,i)=>at(L,f,30+6*i,0)); V.step(1); for(const k in ye(L).e) ye(L).e[k].near=0; setN(L,0); V.step(1); };   // every foe beyond 3 m of her
const mkLow=(L,i)=>{ L.F[i||0].hp=0.5*L.F[i||0].maxHp; };
const M=(ids,o,fn)=>fn(L0(ids,o));                                     // one lab, measured to the end (a new lab replaces the last one's units: never two at once)

/* ============================== ACCOUNTING ============================== */
test('Yenna: every talent is accounted for - 122 talents, 7 plain stats, 115 with rows, none waiting; the caps and renames are in the data',()=>{
  accounting(H,[122,7,115,0,0]);
  for(const id of ['wb_9_3','wb_12_3','pl_9_3','pl_3_3','af_2_4','af_12_3','af_1_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['wb_1_2','pl_2_3']) assert.ok(!FXN.has(H,id),id+' joined the CRIT5 pool (not a plain stat)');
  const names={}; for(const tr of T.trees(H)) for(const t of tr.talents){ assert.ok(!names[t[3]],'a name used twice: '+t[3]); names[t[3]]=1; }
  const D=require(path.join(root,'talents-data.js')), other={}; for(const h in D.heroes) if(h!==H) for(const tr of D.heroes[h].trees) for(const t of tr.talents) other[t[3].toLowerCase()]=h;
  for(const id of ['wb_2_1','wb_5_1','wb_6_2','wb_11_3','wb_11_4','wb_12_4','pl_2_2','pl_5_3','pl_7_2','pl_8_3','pl_10_2','af_4_1','af_4_4','af_6_3','af_7_1','af_8_4','af_10_1','af_10_4']) assert.ok(!other[T.talent(H,id).name.toLowerCase()],id+' '+T.talent(H,id).name+' is no longer another hero\'s name');
  for(const id of ['wb_3_2','af_9_4','af_4_1','af_5_4','af_11_4']) assert.ok(/at most 40% off a hit on her/.test(T.talent(H,id).text),id+' states the 40% group cap');
  for(const id of ['pl_5_4','af_8_4']) assert.ok(/20% off a hit on an ally/.test(T.talent(H,id).text),id+' states the 20% ally cap');
  for(const id of ['wb_1_2','pl_2_3','wb_9_4','af_8_1','wb_8_1']) assert.ok(/at most 5% in all/.test(T.talent(H,id).text),id+' states the 5% crit pool');
  assert.ok(/once every 4 s/.test(T.talent(H,'af_2_2').text),'the cackle states its lock');
  assert.ok(/4 points per rank/.test(T.talent(H,'pl_6_2').text)&&/5 points per rank/.test(T.talent(H,'wb_6_2').text),'points where points are meant');
  assert.ok(/20% of her attack each second for 3 s/.test(T.talent(H,'af_13_2').text),'the signature bleed has its number');
  assert.ok(/up to 20%/.test(T.talent(H,'af_4_4').text),'the control-reduction cap is stated');
  for(const id of ['wb_5_2','pl_5_2','af_5_2']) assert.ok(/locks/.test(T.talent(H,id).text),id+' states its lock');
});

/* ============================== HER REAL KIT ============================== */
test('Yenna: her real kit, as the talents read it - the throw (first three in the line-up, 0.45 s return at 1.6x, waits while she is held), the mark (lowest share, 8 s), the ult (ring of the marked), and the page sites',()=>{
  { const P=L0(null,{foes:4}), {v,F}=P; at(P,F[3],2,0); const h=F.map(f=>f.hp); castR(P); const out=F.map((f,i)=>h[i]-f.hp);
    assert.ok(out[0]>0&&out[1]>0&&out[2]>0,'the first three in the line-up'); assert.equal(out[3],0,'not the nearest one if it comes later in the line-up');
    const b=F.map(f=>f.hp); secs(0.4); assert.equal(F[0].hp,b[0],'no return yet'); secs(0.2); near((b[0]-F[0].hp)/out[0],1.6,'the return: 1.6 x',1e-6);
    const Q=L0(null), x=Q.F[0].hp; castR(Q); Q.v.stunned=2; secs(1); const y=Q.F[0].hp; Q.v.stunned=0; secs(0.6); assert.ok(Q.F[0].hp<y,'a held Yenna\'s bone waits: the return comes once she is free ('+(x-y).toFixed(0)+' out only while held)'); }
  { const P=L0(null), {v,F}=P; mkLow(P,1); castB(P); assert.ok(F[1]._markT===8&&F[1]._markBy===v,'Laughing Mark: the lowest share, 8 s');
    const a=hitBy(F[2],F[1],1000), b=hitBy(F[2],F[0],1000); near(a/b,F[1]._markMul,'the marked takes x'+F[1]._markMul.toFixed(3),1e-6); }
  { const P=L0(['pl_7_1'],{foes:4}), {v,F}=P; let hops=0, backs=0; const T0=P.T;
    T0.on.part=(T0.on.part||[]).concat([{key:'probe#p',id:'',on:'part',do:[{fn:'__pP'}]}]); T0.fn=Object.assign({},T0.fn,{__pP:(A,T,u,c)=>{ if(c.skill==='yeHop') hops++; if(c.skill==='yeBack') backs++; }});
    castR(P); secs(0.6); assert.equal(backs,3,'the return site runs for each enemy it hits');
    mkLow(P,2); castB(P); const h=F.map(f=>f.hp); castU(P,F[2]); secs(2.2); assert.equal(hops,4,'the hop site runs for each hop (one marked: 4 hops)'); assert.ok(F[2].hp<h[2]&&F[0].hp===h[0],'the ring is the marked enemy');
  }
});

/* ============================== ARC ============================== */
test('Yenna / Arc: 1 an enemy struck on the way out (3, Far Arc up to 6, Arc Remembered keeps some), Whole Arc on the return, Harder Coming Home at 4+, Heavy Arc inside the pool, Full Swing at full Arc',()=>{
  { const a=M(['wb_1_1'],{},L=>{ castR(L); assert.equal(ye(L).arc,3,'three struck: 3 Arc'); return back(L,L.F[0]); }), b=M(null,{},L=>{ castR(L); return back(L,L.F[0]); }); near(a/b,1+0.02*R('wb_1_1')*3,'Whole Arc: 2%/rank an Arc on the return',1e-6); }
  { const P=L0(['wb_1_1','wb_2_1','wb_6_1','wb_3_1'],{foes:4}), {F}=P; at(P,F[3],15.5,8); castR(P); secs(0.6); assert.equal(ye(P).arc,3); assert.equal(ye(P).keep,Math.min(3,R('wb_6_1')),'Arc Remembered keeps 1/rank');
    const h3=F[3].hp; castR(P); assert.equal(ye(P).arc,Math.min(3+R('wb_2_1'),3+R('wb_6_1')),'the kept Arc and 3 new, up to 3 + Far Arc'); secs(0.6); assert.ok(F[3].hp<h3,'Harder Coming Home: at 4+ Arc the return also cuts the next enemy behind'); assert.ok(ye(P).stats.hch===1); }
  { const P=L0(['wb_8_1']), {v}=P; castR(P); near(P.T.fn.haCh(api(P),P.T,v),Math.min(0.05,0.01*R('wb_8_1')*3),'Heavy Arc: 1%/rank an Arc, within the 5% pool',1e-9);
    const Q=L0(['wb_8_1','wb_1_2']); castR(Q); near(Q.T.fn.haCh(api(Q),Q.T,Q.v),0,'with Bone Sight already at 5% nothing is left for Heavy Arc',1e-9); }
  { const P=L0(['wb_10_1']), {v,F}=P; castR(P); const a=asSk(P,'yeBack',()=>hitBy(v,F[0],1000,{crit:true})), b=hitBy(v,F[0],1000,{crit:true}); near(a/b,1+0.04*R('wb_10_1'),'Full Swing at full Arc on a return crit',1e-6);
    const Q=L0(['wb_10_1','wb_2_1']); castR(Q); const c=asSk(Q,'yeBack',()=>hitBy(Q.v,Q.F[0],1000,{crit:true})), d=hitBy(Q.v,Q.F[0],1000,{crit:true}); near(c/d,1,'(3 of 6 is not full)',1e-6); }
});

/* ============================== THE THROW ============================== */
test('Yenna / the throw: Thighbone, Hard Throw, Sharp Turn, Comes Back Harder, Long Way Back (+Waiting Hands), Short Way Back (+Snapback), Bone Through Hide, Two Bones, Chalk Flats Hide',()=>{
  { const f=L=>{ const o=lost(L.F[0],()=>castR(L)); return [o,back(L,L.F[0])]; }, a=M(['wb_2_3','wb_11_3'],{},f), b=M(null,{},f);
    near(a[0]/b[0],(1+0.03*R('wb_2_3'))*(1+0.04*R('wb_11_3')),'out: Thighbone x Hard Throw',1e-6); near(a[1]/b[1],1+0.03*R('wb_2_3'),'back: Thighbone only',1e-6); }
  { const f=L=>{ castR(L); const x=back(L,L.F[0]); castR(L); return [x,back(L,L.F[0])]; }, a=M(['wb_12_2','wb_12_1'],{},f), b=M(null,{},f);
    near(a[0]/b[0],(1+0.02*R('wb_12_2'))*(1+0.01*R('wb_12_1')*1),'Sharp Turn x Comes Back Harder (first throw of the wave)',1e-6); near(a[1]/b[1],(1+0.02*R('wb_12_2'))*(1+0.01*R('wb_12_1')*2),'the second throw',1e-6); }
  { const a=M(['wb_5_2','wb_6_2'],{},L=>{ castR(L); const h=L.F[0].hp; secs(0.6); assert.equal(L.F[0].hp,h,'Long Way Back: not yet at 0.6 s'); secs(0.25); return h-L.F[0].hp; }), b=M(null,{},L=>{ castR(L); return back(L,L.F[0]); });
    near(a/b,1.25+0.05*R('wb_6_2'),'0.3 s later, 25% + 5 points/rank Waiting Hands',1e-6); }
  { const P=L0(['wb_5_3','wb_6_3']), {v,F}=P; v.blueCd=5; const i0=v.atkInterval; castR(P); const h=F[0].hp; V.step(2); assert.ok(F[0].hp<h,'Short Way Back: the return at once'); V.step(1);
    assert.ok(v.blueCd<=5-1+1e-9,'and 1 s off Laughing Mark'); V.step(2); near(i0/v.atkInterval,1+0.04*R('wb_6_3'),'Snapback: attack speed',1e-6); secs(3.2); near(v.atkInterval,i0,'for 3 s',1e-9); }
  { const P=L0(['wb_5_1']), {v,F}=P; F[0].armorRating=400; const dm=VMX('defMul'); const base=dm(v,F[0],'phys'); const a=asSk(P,'boomerang',()=>hitBy(v,F[0],1000,{kind:'phys'})), b=hitBy(v,F[0],1000,{kind:'phys'});
    assert.ok(a>b,'Bone Through Hide: armour ignored on Rending Return ('+a.toFixed(1)+' vs '+b.toFixed(1)+', defMul '+base.toFixed(3)+')'); }
  { const P=L0(['wb_7_3'],{foes:6}), {F}=P; const h=F.map(f=>f.hp); castR(P); secs(0.6); castR(P); secs(0.6); assert.ok(F[3].hp===h[3],'two throws: nothing yet');
    const o0=F[0].hp; const g=F[3].hp; castR(P); const out0=o0-F[0].hp; near((g-F[3].hp)/out0,0.5,'Two Bones: the third throw sends a second bone through the next three for 50%',1e-6); assert.ok(F[4].hp<h[4]&&F[5].hp<h[5]); }
  { const P=L0(['wb_3_2']), {v,F}=P; const a=hitBy(F[0],v,1000); castR(P); const b=hitBy(F[0],v,1000); secs(0.6); V.step(1); const c=hitBy(F[0],v,1000);
    near(b/a,1-0.02*R('wb_3_2'),'Chalk Flats Hide: while the bone is in the air',1e-6); near(c,a,'not after it lands',1e-6); }
});

/* ============================== NOTCHES ============================== */
test('Yenna / Notches: a Rending Return kill carves one (5, the fight), Carved Notch, Deep Notch, Bone Charm, Old Bone, Notched Grip, Fifth Notch, Singing Bone, Notch by Notch, Sure Catch, Twice Back',()=>{
  const P=L0(['wb_1_4','wb_2_4','wb_6_4','wb_10_4','wb_7_4','wb_12_4','wb_3_3'],{foes:8}), {v,F}=P; const i0=v.atkInterval, hp0=v.maxHp, ls0=v.lifestealStat||0;
  F[0].hp=1; castR(P); assert.equal(stack(P,'yeNotch'),1,'an outward kill: 1 Notch'); secs(0.6);
  F[1].hp=1; F[2].hp=1; castR(P); secs(0.6); assert.equal(stack(P,'yeNotch'),3);
  for(let i=0;i<4;i++){ const L=P.F.filter(f=>f.alive); L[0].hp=1; castR(P); secs(0.6); } assert.equal(stack(P,'yeNotch'),5,'5 at most');
  V.step(2); near(i0/v.atkInterval,1+0.004*R('wb_2_4')*5,'Deep Notch',1e-6); near(v.maxHp/hp0,1+0.005*R('wb_6_4')*5,'Bone Charm',1e-6); near((v.lifestealStat||0)-ls0,0.003*R('wb_10_4')*5,'Old Bone',1e-9);
  near(FX.cd(v,'green',7),7-0.15*R('wb_3_3')-0.2*R('wb_7_4'),'Quick Catch, Fifth Notch at 5',1e-9);
  const x=P.F.filter(f=>f.alive)[0]; const a=hitBy(v,x,1000,{crit:true}); api(P).stSet(P.T,v,'yeNotch',4); const b=hitBy(v,x,1000,{crit:true}); near(a/b,1+0.03*R('wb_12_4'),'Singing Bone at 5',1e-6);
  const c=asSk(P,'boomerang',()=>hitBy(v,x,1000)), d=hitBy(v,x,1000); near(c/d,1+0.015*R('wb_1_4')*4,'Carved Notch: 1.5%/rank a Notch on Rending Return',1e-6);
  { const Q=L0(['wb_4_4'],{foes:9}); let n=0; for(let i=0;i<8;i++){ const y=Q.F.filter(f=>f.alive)[0]; y.hp=1; V.hit(Q.v,y,10,{kind:'true',auto:true}); }
    n=stack(Q,'yeNotch'); assert.ok(n>=1&&n<=5,'Notch by Notch: some of 8 basic-attack kills carve ('+n+')'); }
  { const Q=L0(['wb_8_3','wb_1_4'],{foes:4}), {v:y,F:G}=Q; castR(Q); y.greenCd=6; G[0].hp=1; const c0=y.greenCd; secs(0.6); assert.ok(y.greenCd<=c0-0.45-0.5*R('wb_8_3')+0.1,'Sure Catch: a return kill takes time off ('+y.greenCd.toFixed(2)+')'); }
  { const Q=L0(['wb_11_1'],{foes:4}), {F:G}=Q; castR(Q); G[0].hp=1; const h3=G[3].hp; secs(0.6); V.step(1); assert.ok(G[3].hp<h3,'Twice Back: out again through the next three');
    castR(Q); G[1].hp=1; secs(0.6); V.step(1); assert.equal(ye(Q).stats.twice,1,'once every 12 s'); }
});

/* ============================== THE RETURN'S RIDERS ============================== */
test('Yenna / the return: Lined Up (All in a Row), Catch and Throw, Return Cut, Bone Tally, Taken by the Throat, Drifted, Nervous Laughter, Stampede Bone and the ult riders',()=>{
  { const P=L0(['wb_n1'],{foes:4}), {v,F}=P; castR(P); const a=hitBy(v,F[0],1000,{auto:true}), b=hitBy(v,F[3],1000,{auto:true}); near(a/b,1+0.04*R('wb_n1'),'Lined Up: her basics',1e-6);
    secs(4.1); near(hitBy(v,F[0],1000,{auto:true})/b,1,'for 4 s',1e-6); }
  { const P=L0(['wb_4_1']), {v,F}=P; castR(P); secs(0.6); V.step(1); const a=hitBy(v,F[0],1000,{auto:true}), b=hitBy(v,F[0],1000,{auto:true}); near(a/b,1+0.04*R('wb_4_1'),'Catch and Throw: the next basic only',1e-6); }
  { const P=L0(['wb_7_1','wb_11_4']), {v,F}=P; castR(P); secs(0.6); const a=hitBy(v,F[0],1000); secs(3.1); const b=hitBy(v,F[0],1000); near(a/b,1+0.02*R('wb_7_1'),'Return Cut: 3 s',1e-6);
    castR(P); secs(0.6); v.hp=0.5*v.maxHp; const h=v.hp; F[1].hp=1; V.hit(P.A[0]||F[2],F[1],10,{kind:'true'}); V.hit(v,F[1],10,{kind:'true'}); V.step(1); near((v.hp-h)/v.maxHp,0.01*R('wb_11_4'),'Bone Tally: a death within 2 s of the return',1e-6); }
  { const f=L=>{ castR(L); return back(L,L.F[0]); }, g=L=>{ for(const x of L.F) x.stunned=0; castR(L); return back(L,L.F[0]); };
    near(M(['af_7_3'],{},f)/M(null,{},f),1.4,'Taken by the Throat: +40% on a held (stunned) enemy',1e-6); near(M(['af_7_3'],{},g)/M(null,{},g),1,'nothing on a free one',1e-6); }
  { const P=L0(['af_3_3'],{foes:3}), {v,F}=P; at(P,F[2],2.5,1.5); const a=asSk(P,'boomerang',()=>hitBy(v,F[0],1000)), b=hitBy(v,F[0],1000), c=asSk(P,'boomerang',()=>hitBy(v,F[1],1000)), d=hitBy(v,F[1],1000);
    near(c/d,1+0.03*R('af_3_3'),'Drifted: an isolated enemy',1e-6); near(a/b,1,'not one with a neighbour within 3.5 m',1e-6); }
  { const f=nl=>L=>{ mkLow(L); castB(L); setN(L,0); for(let i=0;i<4;i++) V.hit(L.v,L.F[0],1,{kind:'true',auto:true}); assert.ok(rq(L,L.F[0]).called>0,'Called');
      if(nl) assert.equal(nerve(L),1,'Nervous Laughter with Raw Nerves: a Nerve'); const o=lost(L.F[0],()=>castR(L)), k=back(L,L.F[0]); castR(L); return [o,k,back(L,L.F[0])]; };
    const a=M(['pl_1_4','pl_n1','af_1_1'],{},f(true)), b=M(['pl_1_4','af_1_1'],{},f(false)); near(a[0]/b[0],1.08,'and her next Rending Return deals 8% more to it',1e-6); near(a[1]/b[1],1.08,'out and back',1e-6); near(a[2]/b[2],1,'only that throw',1e-6); }
  { const P=L0(['wb_9_2'],{foes:5}), {v,F}=P; castR(P); secs(0.6); const h=F.map(f=>f.hp); castU(P,F[0]); secs(2.2);
    assert.ok(F[2].hp<h[2]&&F[3].hp===h[3]&&F[4].hp===h[4],'Stampede Bone: the three it struck in the last 4 s are the ring (not the nearest three)'); assert.ok(!F[0]._yeRic,'the flag is cleared at the cast');
    const Q=L0(null,{foes:5}); const q=Q.F.map(f=>f.hp); castU(Q,Q.F[0]); secs(2.2); assert.ok(Q.F[2].hp===q[2]&&Q.F[3].hp<q[3],'(no talents: the nearest three)'); }
  { const f=L=>{ mkLow(L); castB(L); return lost(L.F[0],()=>{ castU(L,L.F[0]); secs(2.2); }); }, a=M(['wb_10_2','pl_12_2','af_10_3'],{},f), b=M(null,{},f);
    near(a/b,Math.pow(1.15,3),'Ricochet Count x Big Laugh x Open Jaws',1e-6); }
});

/* ============================== HER MARKS ============================== */
test('Yenna / Laughing Mark: Pointing Paw, Long Laugh, Pick the Limping, Echo Laugh, Hold It Down + Pinned, Chase It Down + Down the Line, Lowest First, Clean Finish, Thin Herd, Second Scent, Lean Year, Litter Mates, Hunt Song, Laughing Stampede',()=>{
  { const r=L=>hitBy(L.A[0],L.F[0],1000)/hitBy(L.A[0],L.F[1],1000);
    const a=M(['pl_1_1','pl_2_1','pl_4_1'],{allies:1},L=>{ mkLow(L); castB(L); near(L.F[0]._markT,8+0.5*R('pl_2_1'),'Long Laugh',1e-9); near(FX.cd(L.v,'blue',9),9-0.2*R('pl_4_1'),'Pick the Limping',1e-9); return r(L); }), b=M(null,{allies:1},L=>{ mkLow(L); castB(L); return r(L); });
    near(a/b,1+0.01*R('pl_1_1'),'Pointing Paw: from anyone of her team',1e-6); }
  { const P=L0(['pl_5_2','pl_6_2']), {F}=P; mkLow(P); castB(P); V.step(1); near(F[0].slowMul,1-0.25-0.04*R('pl_6_2'),'Hold It Down + Pinned (points)',1e-9); }
  { const P=L0(['pl_5_3','pl_6_3','pl_5_1','pl_11_3'],{foes:4}), {v,F}=P; mkLow(P); F[2].hp=0.7*F[2].maxHp; castB(P); secs(1); const left=F[0]._markT; v.blueCd=6; const i0=v.atkInterval, a0=v.dmg;
    F[0].hp=1; V.hit(v,F[0],10,{kind:'true'}); V.step(2); assert.ok(Math.abs(F[2]._markT-left)<0.1&&rq(P,F[2]).mkOn,'Chase It Down: the mark moves to the next lowest for the time left');
    assert.ok(v.blueCd<=6-0.4*R('pl_5_1')+1e-9,'Echo Laugh'); near(i0/v.atkInterval,1+0.04*R('pl_6_3'),'Down the Line',1e-6); near(v.dmg/a0,1+0.01*R('pl_11_3'),'Hunt Song',1e-6); }
  { const r=(L,o)=>hitBy(L.v,L.F[0],1000,o)/hitBy(L.v,L.F[1],1000,o), f=L=>{ mkLow(L); castB(L); const x=[r(L),r(L,{crit:true})]; for(const a of L.A) V.hit(a,L.F[0],1,{kind:'true'}); x.push(r(L)); return x; };
    const a=M(['pl_8_1','pl_8_3','pl_11_1'],{allies:2},f), b=M(null,{allies:2},f);
    near(a[0]/b[0],1+0.02*R('pl_8_1'),'Lowest First',1e-6); near(a[1]/b[1],(1+0.02*R('pl_8_1'))*(1+0.02*R('pl_8_3')),'Clean Finish on a crit',1e-6); near(a[2]/b[2],(1+0.02*R('pl_8_1'))*(1+0.01*R('pl_11_1')*2),'Thin Herd: two allies hit it in the last 3 s',1e-6); }
  { const P=L0(['pl_10_1','pl_9_1'],{allies:1,foes:3}), {v,F,A}=P; mkLow(P); castB(P); V.step(1); assert.equal(ye(P).scent,F[1],'the enemy nearest the marked one');
    near(hitBy(A[0],F[1],1000)/hitBy(A[0],F[2],1000),1+0.01*R('pl_10_1'),'Second Scent: from her team',1e-6);
    const a1=hitBy(A[0],F[2],1000), y1=hitBy(v,F[2],1000); F[2].hp=0.3*F[2].maxHp; near(hitBy(A[0],F[2],1000)/a1,1+0.01*R('pl_9_1'),'Lean Year: her allies on an enemy below 35%',1e-6); near(hitBy(v,F[2],1000)/y1,1,'(not Yenna)',1e-6); }
  { const P=L0(['pl_n2'],{allies:3}), {v,F,A}=P; mkLow(P); castB(P); V.step(1); const L=ye(P).lane; assert.ok(L&&L.length>=1,'her formation neighbours (by laneX)');
    const nb=L[0], other=A.find(a=>L.indexOf(a)<0); const a=hitBy(nb,F[0],1000)/hitBy(nb,F[1],1000); const b=other?hitBy(other,F[0],1000)/hitBy(other,F[1],1000):a/(1+0.02*R('pl_n2'));
    near(a/b,1+0.02*R('pl_n2'),'Litter Mates: a neighbour on the marked enemy',1e-6); }
  { const P=L0(['pl_7_1']), {v,F}=P; castU(P,F[0]); secs(2.2); for(const f of F){ assert.ok(rq(P,f)&&rq(P,f).mkOn&&f._markT>0,'Laughing Stampede: every enemy it hit is under her mark'); }
    const full=P.T.fn.fullMul(api(P),P.T,v); near(F[1]._markMul,1+(full-1)/2,'at half strength',1e-9); }
});

/* ============================== BREATH ============================== */
test('Yenna / Breath: a crit on the enemy under her mark (Clean Bite, Clan Breath, Full Chest, Pack Pace, Full Lungs, Every Clean Bite), 6 s, Breath for the Next, Passed Breath, Rally Howl, Pack Memory',()=>{
  const P=L0(['pl_1_2','pl_2_2','pl_7_2','pl_4_2','pl_9_2','pl_6_1','pl_3_2','pl_12_1','pl_10_2'],{allies:2}), {v,F,A}=P; mkLow(P); castB(P);
  const a=A[0]; a.stunned=1e6; a.speed=50; const i0=a.atkInterval, ls0=a.lifestealStat||0, d0=a.dmg, s0=a.speed, c0=a.glyphCrit||0;
  a.energy=0; V.hit(a,F[0],10,{kind:'true',crit:true}); assert.equal(a.energy,2*R('pl_6_1'),'Every Clean Bite: 2 energy/rank'); V.hit(a,F[1],10,{kind:'true',crit:true}); V.hit(a,F[0],10,{kind:'true'});
  V.step(2); const b=ye(P).br[a.uid]; assert.equal(b.n,1,'one Breath (crits on the marked only)'); near(i0/a.atkInterval,1+0.01*R('pl_1_2'),'Clean Bite',1e-6); near((a.lifestealStat||0)-ls0,0.003*R('pl_2_2'),'Clan Breath',1e-9); near(a.dmg/d0,1+0.004*R('pl_7_2'),'Full Chest',1e-6);
  for(let i=0;i<2;i++) V.hit(a,F[0],10,{kind:'true',crit:true}); V.step(2); near(a.speed/s0,1+0.04*R('pl_4_2'),'Pack Pace at 3',1e-6);
  for(let i=0;i<2;i++) V.hit(a,F[0],10,{kind:'true',crit:true}); V.step(2); near((a.glyphCrit||0)-c0,0.05,'Full Lungs at 5: 5%',1e-9); assert.ok([v,A[1]].some(x=>ye(P).br[x.uid]&&ye(P).br[x.uid].n>=1),'Passed Breath: the nearest other ally');
  secs(6.2); assert.equal(b.n,0,'it lapses 6 s after the last gain');
  V.hit(a,F[0],10,{kind:'true',crit:true}); const t0=b.t; F[0].hp=1; V.hit(a,F[0],10,{kind:'true'}); V.step(1); assert.equal(b.n,2,'Breath for the Next: +1 to those who hit it'); assert.ok(b.t>t0+5,'and 6 s longer');
  V.wave(); VMX('battleTime=0'); V.step(1); assert.equal(b.n,Math.min(2,R('pl_12_1')),'Pack Memory: some carry into the next wave');
  { const Q=L0(['pl_8_4','pl_1_4'],{allies:2}), {v:y,F:G,A:B}=Q; at(Q,B[1],0,-30); mkLow(Q); castB(Q); for(let i=0;i<4;i++) V.hit(y,G[0],1,{kind:'true',auto:true});
    assert.equal(ye(Q).br[B[0].uid].n,R('pl_8_4'),'Rally Howl: an ally within 6 m'); assert.equal(ye(Q).br[y.uid].n,R('pl_8_4'),'and Yenna'); assert.ok(!ye(Q).br[B[1].uid],'not one 30 m away'); }
});

/* ============================== CALLS ============================== */
test('Yenna / Call: 4 of her basics on the marked enemy make it Called 4 s (Loud Call longer), Call the Clan, Clan Signal, Pack Feast, Loud Clan, Answering Call, Fed Clan, Close the Circle, Two Calls',()=>{
  const P=L0(['pl_1_4','pl_3_4','pl_7_4','pl_5_4','pl_12_4','pl_6_4','pl_12_3'],{allies:1}), {v,F,A}=P; mkLow(P); castB(P); v.hp=0.5*v.maxHp; const h=v.hp;
  for(let i=0;i<3;i++) V.hit(v,F[0],1,{kind:'true',auto:true}); assert.equal(rq(P,F[0]).call,3); assert.equal(rq(P,F[0]).called,0);
  V.hit(v,F[0],1,{kind:'true',auto:true}); const r=rq(P,F[0]); near(r.called,4+0.4*R('pl_3_4'),'Called: 4 s + Loud Call',1e-9); near((v.hp-h)/v.maxHp,0.02*R('pl_6_4'),'Answering Call',1e-6);
  const q=(u,o)=>hitBy(u,F[0],1000,o)/hitBy(u,F[1],1000,o); const mk=F[0]._markMul;
  near(q(A[0],{auto:true})/mk,1+0.02*R('pl_1_4'),'Call the Clan: an ally\'s basics',1e-6); near(q(A[0])/mk,1,'(not its other hits)',1e-6); near(q(v,{auto:true})/mk,(1+0.02*R('pl_1_4'))*(1+0.03*R('pl_7_4')),'Clan Signal: hers more',1e-6);
  near(hitBy(F[0],v,1000)/hitBy(F[1],v,1000),1-0.02*R('pl_5_4'),'Pack Feast: a Called enemy deals less to her',1e-6); near(hitBy(F[0],A[0],1000)/hitBy(F[1],A[0],1000),1-0.02*R('pl_5_4'),'and to her allies',1e-6);
  V.step(1); near(F[0].slowMul,1-0.05*R('pl_12_4'),'Loud Clan',1e-9);
  A[0].hp=0.5*A[0].maxHp; const ha=A[0].hp; F[0].hp=1; V.hit(A[0],F[0],10,{kind:'true'}); V.step(1); near((A[0].hp-ha)/A[0].maxHp,0.03*R('pl_12_3'),'Fed Clan: the ally that killed it',1e-6);
  { const Q=L0(['pl_1_4','pl_10_4','pl_8_4']), {v:y,F:G}=Q; mkLow(Q); castB(Q); V.hit(y,G[0],1,{kind:'true',auto:true}); let n=0; for(let i=0;i<40;i++){ const r=rq(Q,G[0]); r.call=0; r.called=0; V.hit(y,G[0],1,{kind:'true',auto:true}); n+=r.call; }
    assert.ok(n>45&&n<75,'Close the Circle: a second Call on about '+(10*R('pl_10_4'))+'% of her basics ('+(n-40)+' of 40)'); }
  { const Q=L0(['pl_1_4','pl_11_4','pl_10_4','pl_8_4']); castR(Q); secs(0.6); for(const f of Q.F) assert.equal(rq(Q,f).call,1,'Two Calls: the return adds a Call to every enemy it hits');
    for(let i=0;i<3;i++){ castR(Q); secs(0.6); } assert.ok(rq(Q,Q.F[0]).called>0,'4 Calls from the return: Called, marked or not'); }
});

/* ============================== NERVES ============================== */
test('Yenna / Nerves: a hit on her or an enemy coming within 3 m (10, fade a second after 3 s, Jittery longer), Raw Nerves, Cold Pups, Feverish, Nerve Ends, Back to the Wall, Fraying, Brave Face',()=>{
  const P=L0(['af_1_1','af_2_1','af_3_1','af_7_1','af_6_1','af_5_1'],{foes:3}), {v,F}=P; far(P); const i0=v.atkInterval, ls0=v.lifestealStat||0;
  V.hit(F[0],v,1,{kind:'true'}); assert.equal(nerve(P),1,'a hit on her: 1 Nerve'); at(P,F[1],4.5,0); V.step(1); assert.equal(nerve(P),2,'an enemy comes within 3 m: 1'); V.step(3); assert.equal(nerve(P),2,'(once, as it comes)');
  v.hp=0.4*v.maxHp; V.hit(F[0],v,1,{kind:'true'}); assert.equal(nerve(P),4,'Cold Pups: 2 below half'); const tg=V.now(); V.step(2);
  near(i0/v.atkInterval,(1+0.005*R('af_1_1')*4+0.02*R('af_6_1')*1)/1,'Raw Nerves 0.5%/rank a Nerve + Back to the Wall 2%/rank an enemy within 3 m',1e-6); near((v.lifestealStat||0)-ls0,0.002*R('af_7_1')*4,'Feverish',1e-9);
  const wait=3+0.5*R('af_2_1'); secs(wait+1-0.1-(V.now()-tg)); assert.equal(nerve(P),4,'held '+wait+' s (Jittery), then a second for the first to go'); secs(0.2); assert.equal(nerve(P),3,'then one fades');
  setN(P,5); const a=hitBy(v,F[2],1000,{auto:true}); setN(P,4); const b=hitBy(v,F[2],1000,{auto:true}); near(a/b,1+0.03*R('af_5_1'),'Fraying at 5+',1e-6);
  { const Q=L0(['af_8_1','af_12_1']), {v:y}=Q; far(Q); const c0=y.glyphCrit||0; V.wave(); VMX('battleTime=0'); V.step(1); assert.equal(nerve(Q),Math.min(10,3*R('af_12_1')),'Brave Face: Nerves at the wave start');
    V.step(1); near((y.glyphCrit||0)-c0,Math.min(0.05,0.002*R('af_8_1')*nerve(Q)),'Nerve Ends: 0.2%/rank a Nerve, inside the pool',1e-9); }
  { const Q=L0(['af_4_1','af_1_1']); far(Q); setN(Q,10); near(Q.T.fn.drK(api(Q),Q.T,Q.v,null),1-0.002*R('af_4_1')*10,'Taut Nerves: 0.2%/rank a Nerve',1e-9); }
});

/* ============================== THE CACKLE ============================== */
test('Yenna / the Cackle: at 10 Nerves (Shaking Laugh fewer) every Nerve is spent and enemies within 3 m are feared 0.3 s/rank (Long Fright longer), once every 4 s; Shrill, Laugh It Off + Breathe Out, Shrill Ringing, Fear Feeds, Keep Laughing, Breathing Room, Rattled, Scattered Pack, Hunted Hunter, Echoing Cackle',()=>{
  const P=L0(['af_1_1','af_2_2','af_3_2','af_5_2','af_6_2','af_7_4','af_8_4','af_9_3','af_12_2','af_11_4','af_12_4','af_10_4','af_11_3'],{foes:3,allies:1}), {v,F,A}=P; for(const f of F) f.stunned=0;
  setN(P,0); V.step(1); const a0=v.dmg, i0=v.atkInterval; setN(P,9); v.hp=0.5*v.maxHp; const h=v.hp, f1=F[1].hp, f0=F[0].hp; V.hit(F[2],v,1,{kind:'true'});
  assert.equal(nerve(P),0,'every Nerve spent'); near(F[0].fearT,0.3*R('af_2_2')+0.1*R('af_7_4'),'feared 0.3 s/rank + Long Fright',1e-9); assert.equal(F[1].fearT||0,0,'only within 3 m'); assert.ok(F[0]._fearFrom===v);
  near(f0-F[0].hp,0.20*R('af_3_2')*v.dmg*VMX('rageMul')*VMX('defMul')(v,F[0],'phys'),'Shrill: 20%/rank of her attack, armour applies',1e-3); assert.equal(F[1].hp,f1);
  near((v.hp-h)/v.maxHp,0.08+0.02*R('af_6_2'),'Laugh It Off + Breathe Out',1e-3);
  near(hitBy(F[0],A[0],1000)/hitBy(F[1],A[0],1000),1-0.04*R('af_8_4'),'Shrill Ringing: a feared enemy deals less (to an ally)',1e-6);
  near(hitBy(v,F[0],1000)/hitBy(v,F[1],1000),1+0.02*R('af_10_4'),'Scattered Pack: feared ones take more from her',1e-6);
  const d=hitBy(F[1],v,1000); V.step(2); near(v.dmg/a0,1+0.01*R('af_9_3')*1,'Fear Feeds: one feared',1e-6); near(i0/v.atkInterval,1+0.01*R('af_12_2')+0.005*R('af_1_1')*nerve(P),'Keep Laughing',1e-6);
  near(d,1000*(1-0.02*R('af_11_4')),'Breathing Room 3 s',1e-6); secs(3.1); near(hitBy(F[1],v,1000),1000,'then over',1e-6);
  rq(P,F[0]).fearMine=1; F[0].fearT=0; F[0].slow=0; F[0].slowMul=1; V.step(1); near(F[0].slowMul,1-0.05*R('af_12_4'),'Rattled: slowed after the fear',1e-9); assert.ok(F[0].slow>1.8,'for 2 s');
  setN(P,9); V.hit(F[2],v,1,{kind:'true'}); assert.ok(nerve(P)>=9,'once every 4 s ('+nerve(P)+')'); secs(4.1); V.hit(F[2],v,1,{kind:'true'}); assert.equal(nerve(P),0,'then again');
  v.hp=0.5*v.maxHp; const hh=v.hp; F[0].fearT=1; F[0].hp=1; V.hit(A[0],F[0],10,{kind:'true'}); V.step(1); near((v.hp-hh)/v.maxHp,0.01*R('af_11_3'),'Hunted Hunter: a feared enemy dies',1e-6);
  { const Q=L0(['af_2_2','af_7_2','af_9_2','af_1_1']), {v:y,F:G}=Q; setN(Q,10-R('af_7_2')-1); V.hit(G[1],y,1,{kind:'true'}); assert.equal(nerve(Q),5,'Shaking Laugh: 10 - 1/rank; Echoing Cackle keeps 5'); assert.ok(G[0].fearT>0); }
  { const Q=L0(['af_2_2','af_5_3','af_6_3'],{allies:1}), {v:y,F:G,A:B}=Q; setN(Q,9); V.hit(G[2],y,1,{kind:'true'});
    assert.ok(rq(Q,G[0]).mkOn&&G[0]._markT>=3-1e-9,'Laugh at Them: under her mark 3 s'); const m=G[0]._markMul; near(hitBy(B[0],G[0],1000)/hitBy(B[0],G[1],1000)/m,1+0.03*R('af_6_3'),'Point Them Out',1e-6); }
});

/* ============================== PACK OPPORTUNIST AND HER OWN SIDE ============================== */
test('Yenna / Pack Opportunist and her guard: Opportunist\'s Eye, Something Has Hold, Limping One, Sharpened Edge, Seize It, Wary, Last Ditch, Slippery Hide, Hackles, Quick Paws',()=>{
  const pm=L=>0.28*(L.v.passMul||1);
  { let b=0; const f=L=>{ b=pm(L); return [hitBy(L.v,L.F[0],1000),hitBy(L.v,L.F[0],1000,{crit:true})]; }, x=M(['wb_8_2','af_1_3','wb_5_4','af_8_3'],{},f), y=M(null,{},f), k=(1+b+0.01*R('wb_8_2')+0.02*R('af_1_3'))/(1+b);
    near(x[0]/y[0],k,'Eye + Something Has Hold on a held enemy',1e-6); near(x[1]/y[1],k*(1+0.02*R('wb_5_4'))*(1+0.02*R('af_8_3')),'Sharpened Edge x Seize It on a crit',1e-6); }
  { let b=0; const f=L=>{ b=pm(L); const g=L.F[0]; g.stunned=0; at(L,L.F[1],4.5+3,0); g.hp=0.40*g.maxHp; return hitBy(L.v,g,1000); };
    near(M(['af_4_3'],{},f)/M(null,{},f),1+b,'Limping One: 40% HP, not isolated, not held - the passive applies',1e-6); }
  { const P=L0(['af_9_4','af_5_4','af_4_4','af_6_4','af_10_1'],{foes:3}), {v,F}=P; v.maxHp=v.hp=1e7; near(hitBy(F[0],v,1000)/hitBy(F[2],v,1000),1-0.02*R('af_9_4'),'Wary: within 3 m',1e-6);
    v.hp=0.25*v.maxHp; near(hitBy(F[2],v,1000),1000*(1-0.02*R('af_5_4')),'Last Ditch below 30%',1e-6);
    V.cc(F[0],v,'stunned',1); near(v.stunned,0.7*(1-0.04*R('af_4_4')),'Slippery Hide',1e-6); v.stunned=0;
    F[0].slowMul=1; F[0].slow=0; V.hit(F[0],v,1,{kind:'true'}); near(F[0].slowMul,1-0.10*R('af_6_4'),'Hackles: a melee enemy that hits her',1e-9);
    near(FX.cd(v,'green',7),7-0.2*R('af_10_1'),'Quick Paws',1e-9); }
});

/* ============================== SIGNATURES ============================== */
test('Yenna / the signatures: Whatever You Throw, Where the Clan Goes, Afraid at Somebody Else',()=>{
  { const P=L0(['wb_13_1','wb_1_4'],{foes:4}), {v,F}=P; castR(P); const r=back(P,F[1]); const h=F[1].hp; secs(0.5); near((h-F[1].hp)/r,1.25,'the first extra pass: 25% harder',1e-6);
    F[0].hp=1; const h2=F[1].hp; secs(0.5); near((h2-F[1].hp)/r,1.25*1.25,'the second: 25% harder again',1e-6); assert.ok(!F[0].alive&&stack(P,'yeNotch')>=1,'a pass kill carves a Notch');
    castR(P); secs(0.6); const h3=F[1].hp; secs(1); assert.equal(F[1].hp,h3,'once every 20 s'); assert.equal(ye(P).stats.sig1,1); }
  { const P=L0(['pl_13_2','pl_1_4'],{allies:2,foes:4}), {v,F,A}=P; mkLow(P); F[2].hp=0.6*F[2].maxHp; castB(P); F[0].hp=1; V.hit(A[0],F[0],10,{kind:'true'}); V.step(1);
    for(const a of [v].concat(A)) assert.equal(ye(P).br[a.uid].n,5,'every ally\'s Breath full'); assert.ok(rq(P,F[2]).mkOn&&rq(P,F[2]).called>0,'the next lowest: marked and Called');
    A[0].energy=0; V.hit(A[0],F[2],10,{kind:'true',crit:true}); assert.equal(A[0].energy,6,'a crit on it: 6 energy'); secs(6.1); A[0].energy=0; V.hit(A[0],F[2],10,{kind:'true',crit:true}); assert.equal(A[0].energy,0,'for 6 s');
    F[2].hp=1; V.hit(A[0],F[2],10,{kind:'true'}); V.step(1); assert.equal(ye(P).stats.sig2,1,'once every 20 s'); }
  { const P=L0(['af_13_2','af_1_1'],{foes:3}), {v,F}=P; for(const f of F) f.stunned=0; v.maxHp=1e6; v.hp=0.41e6; v.greenCd=5; const h=F.map(f=>f.hp); V.hit(F[0],v,0.02e6,{kind:'true'});
    assert.ok(F[0].fearT>=1.5-1e-9&&!(F[1].fearT>0)&&!(F[2].fearT>0),'every enemy within 5 m feared 1.5 s (F0; F1 is 6.8 m away)'); assert.equal(v.greenCd,0,'Rending Return ready'); v.greenCd=1e9; assert.equal(nerve(P),10,'Nerves full');
    assert.ok(F[0].dots.some(d=>d._talK==='yeBleed'),'and bleeding'); secs(3.1); near(h[0]-F[0].hp,3*0.20*v.dmg*VMX('rageMul'),'20% of her attack a second, 3 s',0.02);
    secs(2.4); assert.equal(nerve(P),10,'they do not fade for 6 s'); F[0].fearT=1; near(asSk(P,'yeBack',()=>hitBy(v,F[0],1000))/asSk(P,'yeBack',()=>hitBy(v,F[2],1000)),2,'the return double on feared enemies',1e-6);
    secs(5); assert.ok(nerve(P)<10,'then they fade'); v.hp=0.41e6; V.hit(F[0],v,0.02e6,{kind:'true'}); assert.equal(ye(P).stats.sig3,1,'once every 25 s'); }
});

/* ============================== CAPS ============================== */
test('Yenna: her damage-reduction talents are one product floored at 60% kept (40% off at most); an ally\'s at 80% kept (20%); her critical-chance talents at most 5% in all',()=>{
  const P=L0(['wb_3_2','af_9_4','af_4_1','af_5_4','af_11_4','pl_5_4','af_8_4','pl_1_4'],{allies:1}), {v,F,A}=P; v.maxHp=1e7; v.hp=0.2e7; ye(P).air=1; setN(P,10); api(P).acts(P.T,v,[{window:'yeBrR',dur:3}],{u:v});
  const W=ye(P); W.e[F[0].uid]=W.e[F[0].uid]||{u:F[0],hb:{}}; Object.assign(W.e[F[0].uid],{called:4,ring:3});
  near(hitBy(F[0],v,1000),600,'on her: 40% at most',1e-6); near(hitBy(F[0],A[0],1000),800,'on an ally: 20% at most',1e-6);
  const Q=L0(['wb_1_2','pl_2_3','wb_9_4','af_8_1']); api(Q).stSet(Q.T,Q.v,'yeNotch',5); setN(Q,10); V.step(2); near(Q.T.fn.critPool(api(Q),Q.T,Q.v),500,'CRIT5: 27% asked',1e-9); near(Q.T.s.ap.crit,0.05,'5% given',1e-9);
});

/* ============================== THE WAVE CLOCK ============================== */
test('Yenna: her timers are countdowns - Twice Back\'s 12 s, the signatures\' locks and the cackle\'s carry their time left across a wave change; her records of the old wave\'s enemies drop',()=>{
  const P=L0(['wb_11_1','af_2_2','pl_1_4']), {v,F}=P; mkLow(P); castB(P); V.hit(v,F[0],1,{kind:'true',auto:true}); assert.ok(rq(P,F[0]));
  const W=ye(P); W.tbT=7; W.wyT=9; W.ckT=2; W.afT=11; V.step(1); const k=[W.tbT,W.wyT,W.ckT,W.afT];
  V.wave(); VMX('battleTime=0'); V.step(1);
  near(W.tbT,k[0]-V.STEP,'Twice Back',1e-6); near(W.wyT,k[1]-V.STEP,'Whatever You Throw',1e-6); near(W.ckT,k[2]-V.STEP,'the cackle',1e-6); near(W.afT,k[3]-V.STEP,'Afraid at Somebody Else',1e-6);
  { const r=rq(P,F[0]); assert.ok(!r||(!r.mkOn&&!(r.call>0)),'her records of the old wave\'s enemies are dropped (a new one starts)'); }
});

/* ============================== WHOLE FIGHTS ============================== */
test('Yenna: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H);
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal);
  const mx={arc:0,notch:0,nerve:0,throws:0,land:0,ck:0,called:0,br:0,marks:0};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const W=s._tal.s.ye; if(!W) continue; mx.arc=Math.max(mx.arc,W.arc); mx.notch=Math.max(mx.notch,(s._tal.s.k.yeNotch||{n:0}).n); mx.nerve=Math.max(mx.nerve,(s._tal.s.k.yeNerve||{n:0}).n);
    for(const k of ['throws','land','ck','called','br','marks']) mx[k]=W.stats[k]; }
  console.log('  live fight: '+JSON.stringify(mx)); assert.ok(mx.throws>=1&&mx.land>=1&&mx.arc>=1,'real throws, landings and Arc'); assert.equal(FX.errors().n,0,'no hook errors: '+FX.errors().last);
  determinism(H,TEAM); assert.equal(FX.errors().n,0,'no hook errors: '+FX.errors().last);
});

const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Yenna: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they pass her changed lines (the return, the ring, the hops)',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{ const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['yenna','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
    const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
    VMX('var __ybN={rr:0,back:0,ult:0,hop:0}, __ybIn=0; var __ybD=_doEffectCore, __ybDl=dealDamage;'+
      '_doEffectCore=function(u,type,o){ if(u&&u.key==="yenna"){ if(type==="boomerang") __ybN.rr++; if(type==="multiShot") __ybN.ult++; } __ybIn++; try{ return __ybD.apply(this,arguments); } finally{ __ybIn--; } };'+
      'dealDamage=function(s,t,amt,color){ if(!__ybIn&&s&&s.key==="yenna"&&color==="#e8dcc0"&&!_autoAtk){ if((s._boomT||0)<=0&&s._boomFoes) __ybN.back++; else __ybN.hop++; } return __ybDl.apply(this,arguments); };');
    let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
        const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
        assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
      const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
      for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
        assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
      const c=VMX('__ybN'); console.log('  identity: '+JSON.stringify(c)); assert.ok(c.rr>0&&c.back>0&&c.ult>0&&c.hop>0,'the fights pass every changed line: '+JSON.stringify(c)); }
    finally{ VMX('_doEffectCore=__ybD; dealDamage=__ybDl;'); }
    assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* ============================== HER FEARS IN FIGHTS ============================== */
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={wb:0,pl:1,af:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const FEARW={ af:['af_13_2','af_2_2','af_7_2','af_9_2','af_7_4','af_11_1','af_12_4'], wb:['wb_13_1'], pl:['pl_13_2'] };
test('Yenna: her fears in seeded fights - the longest run of fears she began on one enemy, and the cackles',()=>{
  const builds=[[['af'],[91]],[['af','wb'],[61,30]],[['af','pl'],[61,30]],[['wb','af'],[61,30]]].map(([o,c])=>{ const b=deep(o,c,FEARW); assert.equal(T.invalid(H,b,100),'','a legal build'); return {o,list:T.learned(H,b),b}; });
  VMX('var __yf={run:0,ck:0,fear:0,ticks:0}; var __yfU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ const r=__yfU.apply(this,arguments); for(const u of units){ if(!(u&&u.key==="yenna"&&u._tal&&u._tal.s.ye)) continue; const s=u._tal.s.ye.stats; __yf.ticks++;'+
    '  if(s.fearRun>__yf.run) __yf.run=s.fearRun; if(s.ck>(u.__yfC||0)){ __yf.ck+=s.ck-(u.__yfC||0); u.__yfC=s.ck; } if(s.fear>(u.__yfF||0)){ __yf.fear+=s.fear-(u.__yfF||0); u.__yfF=s.fear; } } return r; };');
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8'));
  try{ for(const B of builds){ VMX('for(const k in __yf) __yf[k]=0');
      const sn=snaps(['yenna','vael','vireo','gruel','vex'].map(k=>Object.assign(spec(k,100,k===H?B.list:null),{skillLv:[100,100,100,100]})));
      for(const node of [34,60,90,120]) for(const seed of [11,90210]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
      const c=JSON.parse(JSON.stringify(VMX('__yf'))); assert.ok(c.ticks>300,'she fought');
      console.log('  '+B.o.join('+')+' '+JSON.stringify(T.spent(H,B.b).tree)+': longest run of her fears on one enemy '+c.run.toFixed(2)+' s; cackles '+c.ck+', fears '+c.fear); assert.ok(c.run<6,'a run of fears she began stays short'); } }
  finally{ VMX('_updateBattleCore=__yfU;'); }
});

/* ============================== PHIL'S 95% CHECK ============================== */
const DEF={ wb:['wb_3_2'], pl:['pl_5_4','pl_1_4','pl_9_3'], af:['af_9_4','af_4_1','af_5_4','af_11_4','af_8_4','af_2_2','af_1_1','af_2_4','af_12_3','af_1_4','af_4_4'] };
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,0][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,2,-2,0][i]*V.METER; a.y=v.y-[5.5,4,4,11][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on her: every condition of her reduction talents true at once - the bone in the air, 10 Nerves, below 30% HP, a cackle just now, the attacker within
   3 m, Called and ringing from her cackle; physical and magic, normal and critical; and again with glyph damage reduction at its 30% cap. */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.25*v.maxHp; v.shield=0; v.glyphDR=glyph||0;
  if(L.T){ const W=null, api0=FX.api(); const Y=L.T.s.ye; if(Y){ Y.air=1; Y.afT=99; const e=Y.e[f.uid]||(Y.e[f.uid]={u:f,mkOn:0,call:0,called:0,nervPend:0,nervOn:-1,cut:0,lined:0,tally:0,sb:0,ring:0,lat:0,sigE:0,fearMine:0,near:0,calledW:0,hb:{},run:0}); e.called=9; e.ring=9; }
    api0.stSet(L.T,v,'yeNerve',10); api0.acts(L.T,v,[{window:'yeBrR',dur:9}],{u:v}); void W; }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:true}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Yenna: her most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and she is at 85% or more for well under half a fight',()=>{
  const cands=[[['af','wb'],[61,30]],[['af','pl'],[61,30]],[['wb','af'],[61,30]],[['pl','af'],[61,30]],[['af'],[91]],[['pl','wb'],[61,30]],[['af','pl','wb'],null]].map(([o,c])=>{ const b=deep(o,c,DEF); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,t:0,tp:0,tm:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="yenna"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="yenna"&&u.alive)) continue; __dr.ticks++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1)*(T&&T.s.api&&T.s.ye?T.fn.drK(T.s.api,T,u,s):1);'+
    '    const kp=k*defMul(s,u,"phys"), km=k*defMul(s,u,"magic"); __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','yenna'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+'; sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>20,'hits on her: '+d.n); assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more'); assert.equal(d.at,0);
    assert.ok(d.te85<0.25*Math.max(1,d.t),'at 85% or more for well under half of her time ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
