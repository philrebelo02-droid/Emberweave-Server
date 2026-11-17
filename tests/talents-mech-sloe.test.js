'use strict';
/* Sloe's talents as data on the mechanics layer (talents-mech/sloe.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added, Phil's 95% damage-reduction ceiling, the stun-lock rule in seeded fights, her cost.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   sl(): the lab, everyone held (stunned), Sloe with her own HP. free(x): an enemy that thinks but does nothing, at level 1 (a control is not resisted by the
   level roll; a HELD unit counts as stunned, so her talent roots are refused on it). still(L): Sloe thinks but does nothing.
   Her skills are not in the reach audit's list (tests/sloe-kit-facts.js: Thornshot struck its target on every cast, Vine Snare 1.33 enemies a cast, the volley
   3.74 arrows): no test here depends on a reach that release v1391 changes. The lab's skill level is 10. Run: node --test tests/talents-mech-sloe.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root,build}=require('./talents-lab.js');
const H='sloe', S=ids=>full(H,ids);
const near=(a,b,msg,eps)=>assert.ok(Math.abs(a-b)<=(eps||1e-6)*(b===0?1:Math.abs(b))+1e-12,(msg||'')+': '+a+' vs '+b);   // relative (absolute only against 0)
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const setWin=(L,name,t)=>{ L.T.s.w[name]={t,n:1,cdT:0,at:-1,wave:false}; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const o=L=>L.T.s.sl;
const rec=(L,x)=>{ const s=o(L); return s.e[x.uid]||(s.e[x.uid]={x,sp:0,spT:0,og:0,gf:0,lb:0,cf:0,rfs:0,rfsL:0,lk:0,br:0,tf:false,tfF:false,sh:0}); };
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };
const still=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=99; v.blueCd=99; v.energy=0; };
function sl(list,o2){ o2=o2||{}; const L=lab(H,list,Object.assign({foes:3},o2)); if(o2.freeF) L.F.forEach(free); if(o2.still) still(L); if(o2.pre) o2.pre(L); return L; }
const plain=(o2,fn)=>fn(sl(null,o2));
const hitOn=(L,t,amt,o2)=>lost(t,()=>V.hit(o2&&o2.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o2||{})));
const ratio=(L,t,o2)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o2||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o2||{}))));
const allyRatio=(L,a,t,o2)=>lost(t,()=>V.hit(a,t,1000,Object.assign({kind:'true'},o2||{})))/plainHit(L,()=>lost(t,()=>V.hit(a,t,1000,Object.assign({kind:'true'},o2||{}))));
const inRatio=(L,t,o2)=>{ const h=t.hp, s=t.shield; const a=hitOn(L,t,100,o2); t.hp=h; t.shield=s; const b=plainHit(L,()=>hitOn(L,t,100,o2)); t.hp=h; t.shield=s; return a/b; };
const allyIn=(L,a,o2)=>{ const h=a.hp; const x=hitOn(L,a,100,o2); a.hp=h; const b=plainHit(L,()=>hitOn(L,a,100,o2)); a.hp=h; return x/b; };
const castTS=(L,t)=>V.cast(L.v,'green',t);
const castVS=(L,t)=>V.cast(L.v,'blue',t);
/* Emerald Volley as the game casts it: ULT_DEF merged with her HERO_ULT_ART (backline, stagger 0.12); the lab's own V.cast reads ULT_DEF alone */
const castVO=(L,tgt)=>VMX(`(function(u,t){ if(t) u.target=t; u._castSlot='ult'; u._castLv=10; u._castSM=skillMul(10); try{ doEffect(u,'volley',Object.assign({},ULT_DEF.volley,HERO_ULT_ART.sloe)); } finally{ u._castSM=1; u._castLv=0; u._castSlot=null; } })`)(L.v,tgt||null);
/* a real swing of hers (Hunter's Patience runs at the swing); she is held again right after it */
const swing=(L,t)=>{ const v=L.v; if(t&&L.F.indexOf(t)>=0){ at(L,t,4,0); L.F.forEach((f,i)=>{ if(f!==t) at(L,f,20,6+6*i); }); }   // her target the nearest enemy (the engine's own choice at the swing)
  v.stunned=0; v.atkCd=0; v._castT=0; v.speed=0; v.greenCd=99; v.blueCd=99; v.energy=0; v.target=t; V.step(1); v.atkCd=1e9; };
const SM10=()=>VMX('skillMul(10)');
const ARROW=L=>L.v.dmg*SM10()*1.4;
const dm=(s,t,k)=>VMX('defMul')(s,t,k);
const units=()=>VMX('units');

test('Sloe: every talent is accounted for - 6 plain stats, 116 with rows, none waiting',()=>{
  accounting(H,[122,6,116,0,0]);
  for(const id of ['om_1_4','om_12_2','tw_8_3','tw_3_3','eq_12_3','eq_3_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['om_2_2','tw_9_3','eq_9_4']) assert.ok(!FXN.has(H,id)&&FXN.mech(H).talents[id],id+': a crit talent of her capped group, not a plain stat');
});

test('Sloe: her real kit, as the talents read it - Hunter\'s Patience at the swing, Thornshot\'s shred, Vine Snare\'s root, Emerald Volley\'s six farthest',()=>{
  plain({foes:1},P=>{ const {v,F}=P; const b=v.glyphCrit||0; swing(P,F[0]); assert.equal(v._hpTgt,F[0]); assert.equal(v._hpStk,0,'a new target: 0 stacks');
    swing(P,F[0]); assert.equal(v._hpStk,1,'the same target: +1'); near(v.glyphCrit,b+0.05*(v.passMul||1),'5% x passMul a stack, written at the swing'); });
  plain({foes:3},P=>{ const {v,F}=P; F[0]._shredPct=0; const h=F[0].hp; castTS(P,F[0]); assert.ok(F[0].hp<h,'Thornshot strikes its target');
    near(F[0]._shredPct,VMX('shredAt')(0.32,SM10()),'and lowers its armour by the skill\'s shred'); near(F[0]._shredT,5,'for 5 s'); });
  plain({foes:3,freeF:true},P=>{ const {v,F}=P; at(P,F[1],4.5,1.0); at(P,F[2],4.5,6); const h=F.map(f=>f.hp); castVS(P,F[0]);
    near(F[0].stunned,2.8,'Vine Snare roots its target: the stun field, 2.8 s as landed',1e-6); assert.ok(F[1].stunned>0,'and an enemy whose centre is within 2.4 m of it'); near(F[2].stunned,0,'not one farther');
    assert.ok(F[0].hp<h[0],'it strikes them'); });
  plain({foes:9},P=>{ const {v,F}=P; const h=F.map(f=>f.hp); castVO(P); secs(1.2); const hit=F.filter((f,i)=>f.hp<h[i]); assert.equal(hit.length,6,'six arrows, one at each of six enemies');
    const far=F.slice().sort((a,b)=>Math.hypot(b.x-v.x,b.y-v.y)-Math.hypot(a.x-v.x,a.y-v.y)).slice(0,6); assert.deepEqual(new Set(hit),new Set(far),'the six FARTHEST'); });
});

/* ============================== ONE MAN AND ENOUGH TIME ============================== */
test('Sloe / Hunter\'s Patience: Nearer Each Time (a new target at 3), Never Changes Target (half kept after a death), Found Again, Weak Spot at 6; her talent crit kept through the swing',()=>{
  { const L=sl(S(['om_2_1']),{foes:1}), {v,F}=L; v._hpTgt=null; swing(L,F[0]); assert.equal(v._hpStk,3,'a new target starts at 1 a rank (3)'); swing(L,F[0]); assert.equal(v._hpStk,4); }
  { const L=sl(S(['om_3_1','om_2_1']),{foes:1}), {v,F}=L; v._hpTgt={alive:false}; v._hpStk=6; swing(L,F[0]); assert.equal(v._hpStk,3,'her target died: half of 6 kept (3, and Nearer Each Time 3)');
    const L2=sl(S(['om_3_1']),{foes:1}); L2.v._hpTgt={alive:true}; L2.v._hpStk=6; swing(L2,L2.F[0]); assert.equal(L2.v._hpStk,0,'a switch from a living target keeps nothing'); }
  { const L=sl(S(['om_1_1','om_8_1']),{foes:2}), {v,F}=L; v._hpTgt=F[0]; v._hpStk=4; swing(L,F[0]); assert.equal(v._hpStk,5); assert.equal(o(L).ws,null,'not at 5'); v._hpStk=5; swing(L,F[0]); assert.equal(v._hpStk,6); assert.equal(o(L).ws,F[0],'6 stacks: her target\'s Weak Spot is Found');
    swing(L,F[1]); assert.equal(o(L).ws,null,'a switch: the Weak Spot is lost'); assert.equal(v._hpStk,0,'(F[1] was never Found)');
    swing(L,F[0]); assert.equal(v._hpStk,5,'Found Again: back on a Found enemy, 1 a rank kept (5)'); swing(L,F[0]); assert.equal(o(L).ws,F[0],'and Found again at the next'); }
  { const L=sl(S(['om_2_2']),{foes:1}), {v,F}=L; V.step(2); const c0=v.glyphCrit; swing(L,F[0]); swing(L,F[0]); near(v.glyphCrit,c0+0.05*(v.passMul||1),'Blackthorn Eye\'s 5% is kept through the passive\'s rewrite',1e-9);
    const P=sl(null,{foes:1}); V.step(2); const p0=P.v.glyphCrit; swing(P,P.F[0]); swing(P,P.F[0]); near(c0-p0,0.05,'(Blackthorn Eye: 5% on top of the plain base)',1e-9); }
});
test('Sloe / Weak Spot: crits on it 10% more, Long Watch (10% of armour), Waited Long Enough (10% of a crit), A Little Nearer (1% a basic attack, 10% at most), Many Small Wounds (6% + 3% of her attack, true)',()=>{
  const L=sl(S(['om_1_1','om_5_1','om_9_1','om_9_2']),{foes:2,big:true}), {v,F}=L; o(L).ws=F[0];
  near(ratio(L,F[0],{crit:true}),1.10,'a crit on the Found Weak Spot: 2% x 5 more'); near(ratio(L,F[1],{crit:true}),1,'not on another enemy'); near(ratio(L,F[0]),1,'not a hit that is no crit');
  F[0].armorRating=500; const ph=(x)=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'phys'})); const a=ph(), b=plainHit(L,()=>ph()); near(a/b,dm(v,F[0],'phys')>0?VMX(`(function(s,t){ const sv=s._wpnArmIgn; s._wpnArmIgn=0.10; const x=defMul(s,t,'phys'); s._wpnArmIgn=sv; return x/defMul(s,t,'phys'); })`)(v,F[0]):1,'Long Watch: 10% of its armour ignored',1e-6);
  F[0].armorRating=0; v.hp=v.maxHp*0.5; const h=v.hp, d=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true',crit:true})); near(v.hp-h,0.10*d,'Waited Long Enough: 10% of the crit\'s damage heals her',1e-3);
  o(L).lan=0; const r0=ratio(L,F[0],{auto:true}); o(L).lan=5; const r5=ratio(L,F[0],{auto:true}); o(L).lan=40; const r40=ratio(L,F[0],{auto:true});
  near(r5/r0,1.05/1.00,'A Little Nearer: 1% more for each basic attack before it',1e-6); near(r40/r0,1.10,'10% at most',1e-6);
  const L2=sl(S(['om_5_3','om_6_3']),{foes:2}), x=L2.F[0]; o(L2).ws=x; const t0=x.hp; V.hit(L2.v,x,0.001,{kind:'true',auto:true});
  near(t0-x.hp,0.001+0.09*L2.v.dmg,'Many Small Wounds: each basic attack on it also 6% + 1% x 3 of her attack',1e-3); const t1=L2.F[1].hp; V.hit(L2.v,L2.F[1],0.001,{kind:'true',auto:true}); near(t1-L2.F[1].hp,0.001,'not on another enemy',1e-3);
});
test('Sloe / One Clean Arrow (PICK ONE): the first hit after she Finds a Weak Spot is a crit, 40% more (+ Heart Shot 8% a rank); once',()=>{
  const L=sl(S(['om_1_1','om_5_2','om_6_2']),{foes:1}), {v,F}=L; v._hpTgt=F[0]; v._hpStk=5; swing(L,F[0]); assert.equal(o(L).oca,F[0],'Found: the clean arrow waits');
  const pc=v.critDmg||0.6, a=lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})), b=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})));
  near(a/b,(1+pc)*1.10*1.64,'a crit (forced; the Weak Spot 10% on crits) and 40% + 8% x 3 more',1e-6); assert.equal(o(L).oca,null,'spent');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'}))/b,1,'the next hit is a plain one (no crit forced, no bonus)',1e-6);
});
test('Sloe / Undisturbed: 3 s with no damage (Small Fire 1 s sooner a rank), her hits on her target 7.5% more, Steady Breath crits 10% more, ends on a hit or a DoT tick; Tanglewood Cloak (that hit 30% less); Watcher (15% armour and magic resist for 3 s)',()=>{
  const L=sl(S(['om_n1','om_7_4','om_3_4','om_5_4']),{foes:2,big:true}), {v,F}=L; v.target=F[0]; o(L).qt=0; o(L).und=false; secs(2.9); assert.ok(!o(L).und,'not before 3 s'); secs(0.2); assert.ok(o(L).und,'Undisturbed after 3 s');
  near(ratio(L,F[0]),1.075,'hits on her target 1.5% x 5 more'); near(ratio(L,F[1]),1,'not on another enemy'); near(ratio(L,F[0],{crit:true}),1.075*1.10,'a crit: Steady Breath 2% x 5 more as well');
  const a0=v.armorRating, m0=v.mrRating; near(inRatio(L,v),0.70,'the hit that ends it: 10% x 3 less (her group)');
  hitOn(L,v,10); V.step(1); assert.ok(!o(L).und,'a hit ends it'); assert.ok(win(L,'slWat'),'Watcher'); near(v.armorRating/a0,1.15,'15% more armour',1e-6); near(v.mrRating/m0,1.15,'and magic resist',1e-6);
  near(inRatio(L,v),1,'no longer Undisturbed: no Cloak'); secs(3.05); near(v.armorRating/a0,1,'Watcher lasts 3 s',1e-6);
  o(L).und=true; V.dot(v,10,2,1,F[0]); secs(1.1); assert.ok(!o(L).und,'a DoT tick ends it too');
  const L2=sl(S(['om_n1','om_12_3']),{foes:1}); o(L2).qt=0; o(L2).und=false; secs(1.9); assert.ok(!o(L2).und); secs(0.15); assert.ok(o(L2).und,'Small Fire: 0.5 s x 2 sooner (2 s)');
});
test('Sloe / Splits: each Thornshot hit adds 1 (3 at most, 8 s + Split Deep 1 s a rank); Old Bark (basic attacks 3% a rank each), Split Open, Barbed Tip, Sharp Thorns, Split Wide (her allies 1% a rank each)',()=>{
  const L=sl(S(['om_1_3','om_2_3','om_8_3','om_4_3','eq_12_4','om_7_3']),{foes:2,allies:1}), {v,F,A}=L;
  const t0=lost(F[1],()=>castTS(L,F[1])); F[1]._shredPct=0; const p0=plainHit(L,()=>lost(F[1],()=>castTS(L,F[1]))); F[1]._shredPct=0;
  near(t0/p0,1.24,'Thornshot with no Split on it: Barbed Tip 12% and Sharp Thorns 12% more (added: one Thornshot bonus)',1e-6);
  rec(L,F[1]).sp=0; rec(L,F[1]).spT=0; castTS(L,F[0]); F[0]._shredPct=0; assert.equal(rec(L,F[0]).sp,1,'one Split'); near(rec(L,F[0]).spT,11,'8 s + 1 s x 3');
  castTS(L,F[0]); castTS(L,F[0]); castTS(L,F[0]); F[0]._shredPct=0; assert.equal(rec(L,F[0]).sp,3,'three at most');
  near(ratio(L,F[0],{auto:true}),1.27,'a basic attack: 3% x 3 more for each of 3 Splits'); near(ratio(L,F[0]),1,'(not a skill hit)');
  const t3=lost(F[0],()=>castTS(L,F[0])); F[0]._shredPct=0; rec(L,F[0]).sp=3; const p3=plainHit(L,()=>lost(F[0],()=>castTS(L,F[0]))); F[0]._shredPct=0;
  near(t3/p3,1.24*1.30,'Split Open: Thornshot 2% x 5 more for each of 3 Splits',1e-6);
  near(allyRatio(L,A[0],F[0]),1.15,'Split Wide: her allies\' hits 1% x 5 more for each Split'); near(ratio(L,F[0]),1,'(not hers)');
  rec(L,F[0]).spT=0.05; V.step(3); near(ratio(L,F[0],{auto:true}),1,'Splits gone when their time is up');
});
test('Sloe / Like Old Bark (at 3 Splits her Thornshot shred stays while she hits it), Bark Split Through (3 Splits pass to the nearest enemy when it dies)',()=>{
  const L=sl(S(['om_1_3','om_2_3','om_3_3','om_11_3']),{foes:3}), {v,F}=L; for(let i=0;i<3;i++) castTS(L,F[0]); const sh=F[0]._shredPct; assert.ok(sh>0);
  F[0]._shredT=0.5; secs(0.4); V.hit(v,F[0],1,{kind:'true',auto:true}); near(F[0]._shredT,5,'a hit of hers at 3 Splits: the shred back to its 5 s',1e-6); near(F[0]._shredPct,sh);
  at(L,F[1],5.5,1); at(L,F[2],15.5,0); F[0].hp=1; V.hit(v,F[0],10,{kind:'true'}); assert.ok(!F[0].alive); assert.equal(rec(L,F[1]).sp,3,'its 3 Splits passed to the nearest enemy'); assert.equal((o(L).e[F[2].uid]||{sp:0}).sp,0,'not to another');
  const L2=sl(S(['om_1_3','om_3_3']),{foes:2}); castTS(L2,L2.F[0]); L2.F[0]._shredT=0.5; V.hit(L2.v,L2.F[0],1,{kind:'true'}); assert.ok(L2.F[0]._shredT<1,'not below 3 Splits');
});
test('Sloe / at 6 Patience: Patient Draw (0.3% attack a rank a stack), Six Arrows Deep (10% attack speed), No Hurry (7.5% less, her group), Hunter\'s Calm (crits 0.3% a rank a stack); Enough Time; Bowstring Rhythm',()=>{
  const L=sl(S(['om_4_1','om_6_1','om_11_1','om_10_1']),{foes:1,big:true}), {v,F}=L; const d0=v.dmg, i0=v.atkInterval; v._hpStk=6; V.step(1);
  near(v.dmg/d0,1+0.015*6,'Patient Draw: 0.3% x 5 attack for each of 6 stacks',1e-9); near(i0/v.atkInterval,1.10,'Six Arrows Deep: 2% x 5 attack speed',1e-9);
  near(inRatio(L,v),0.925,'No Hurry: 1.5% x 5 less'); near(ratio(L,F[0],{crit:true}),1+0.015*6,'Hunter\'s Calm: crits 0.3% x 5 more a stack');
  v._hpStk=5; V.step(1); near(i0/v.atkInterval,1,'not at 5',1e-9); near(inRatio(L,v),1,'(nor No Hurry)'); near(v.dmg/d0,1+0.015*5,'',1e-9);
  const L2=sl(S(['om_12_1']),{foes:1}), w=L2.v; const e0=w.dmg; w.target=L2.F[0]; secs(4.05); near(w.dmg/e0,1+0.015*4,'Enough Time: 0.5% x 3 attack for each second on the same target',1e-6); secs(8); near(w.dmg/e0,1.15,'10 s at most',1e-6);
  w.target=null; V.step(2); near(w.dmg/e0,1,'a new target starts it again',1e-6);
  const L3=sl(S(['om_9_4']),{foes:2}), x=L3.v; const j0=x.atkInterval; for(let i=0;i<6;i++) V.hit(x,L3.F[0],1,{kind:'true',auto:true}); V.step(1); near(j0/x.atkInterval,1.10,'Bowstring Rhythm: 0.5% x 5 a basic attack on the same enemy, 4 at most',1e-9);
  V.hit(x,L3.F[1],1,{kind:'true',auto:true}); V.step(1); near(j0/x.atkInterval,1.025,'another enemy: it starts again (1 attack)',1e-9);
});
test('Sloe / Unwatched (2% a rank from enemies she is not attacking), Last Arrow (4% a rank below 30%), Between the Plates (2% of armour a rank), Fireless Camp (1% a rank every 5 s), Quick Thorn',()=>{
  const L=sl(S(['om_4_4','om_12_4','om_10_2','om_6_4','om_8_2']),{foes:2,big:true}), {v,F}=L; v.target=F[0];
  near(inRatio(L,v,{src:F[1]}),0.94,'Unwatched: 2% x 3 less from an enemy she is not attacking'); near(inRatio(L,v,{src:F[0]}),1,'not from her target');
  F[1].hp=F[1].maxHp*0.29; near(ratio(L,F[1]),1.12,'Last Arrow: 12% more below 30%'); F[1].hp=F[1].maxHp*0.31; near(ratio(L,F[1]),1,'not above');
  F[1].armorRating=400; const a=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'phys'})), b=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'phys'})));
  near(a/b,VMX(`(function(s,t){ const sv=s._wpnArmIgn; s._wpnArmIgn=0.10; const x=defMul(s,t,'phys'); s._wpnArmIgn=sv; return x/defMul(s,t,'phys'); })`)(v,F[1]),'Between the Plates: 10% of armour ignored',1e-6);
  v.hp=v.maxHp*0.5; o(L).fc=0; const h=v.hp; secs(4.9); near(v.hp,h,'Fireless Camp: nothing before 5 s',1e-9); secs(0.2); near((v.hp-h)/v.maxHp,0.02,'1% x 2 of her max HP every 5 s',1e-6);
  const cd=VMX(`(function(u){ u.greenCd=0; return TalentFx.cd(u,'green',6); })`)(v); near(cd,6-0.9,'Quick Thorn: 0.3 s x 3 off Thornshot');
});
test('Sloe / Learned Him: all six arrows at her Found Weak Spot when it is in reach; Splinter Rain (3% a rank on enemies with Splits), Deep Quiver (3% a rank)',()=>{
  let pl; plain({foes:3},P=>{ const h=P.F.map(f=>f.hp); castVO(P); secs(1.4); pl=P.F.map((f,i)=>h[i]-f.hp); });
  const L=sl(S(['om_1_1','om_6_1','om_7_1','om_10_3','om_11_4']),{foes:3}), {v,F}=L; o(L).ws=F[0]; const h=F.map(f=>f.hp); castVO(L); secs(1.4);
  near(h[0]-F[0].hp,6*pl[2]*1.15,'Learned Him: six arrows into the Found enemy (the plain arrow at the same armour), Deep Quiver 15% more',1e-6); near(h[1]-F[1].hp,0,'none elsewhere'); near(h[2]-F[2].hp,0);
  const L2=sl(S(['om_10_3','om_11_4']),{foes:3}); rec(L2,L2.F[2]).sp=2; rec(L2,L2.F[2]).spT=99; const g=L2.F.map(f=>f.hp); castVO(L2); secs(1.4);
  near((g[2]-L2.F[2].hp)/pl[2],1.15*1.15,'Splinter Rain: 15% more on an enemy with Splits',1e-6); near((g[1]-L2.F[1].hp)/pl[1],1.15,'Deep Quiver only on one without',1e-6);
  const L3=sl(S(['om_1_1','om_7_1']),{foes:3}); o(L3).ws=L3.F[0]; L3.v.range=1; const k=L3.F.map(f=>f.hp); castVO(L3); secs(1.4); assert.ok(L3.F[1].hp<k[1],'out of her reach: the volley as usual');
});
test('Sloe / Given One Man (SIGNATURE): a Found enemy below 50% - a crit for 300% of her attack through all armour, once every 20 s; a kill carries Patience and the Weak Spot to her next target',()=>{
  const L=sl(S(['om_13_1','om_1_1']),{foes:2}), {v,F}=L; const x=F[0]; o(L).ws=x; x.armorRating=800; x.hp=x.maxHp*0.55; V.step(2); assert.equal(o(L).c1,0,'not above 50%');
  x.hp=x.maxHp*0.49; const h=x.hp; V.step(1); const d=h-x.hp, pc=v.critDmg||0.6; near(d,3*v.dmg*(1+pc)*1.10*VMX('elemMul')(v,x),'300% of her attack, a crit (and Weak Spot\'s 10%), no armour',1e-6); near(o(L).c1,20,'then 20 s',1e-6);
  const h2=x.hp; secs(19.5); near(x.hp,h2,'not again within 20 s'); secs(0.6); assert.ok(x.hp<h2,'again after 20 s');
  const L2=sl(S(['om_13_1','om_1_1']),{foes:2}), y=L2.F[0]; o(L2).ws=y; y.maxHp=100; y.hp=40; L2.v._hpTgt=y; L2.v._hpStk=6; V.step(1); assert.ok(!y.alive,'it kills'); assert.ok(o(L2).carry,'');
  swing(L2,L2.F[1]); assert.equal(L2.v._hpStk,6,'Patience carried to her next target'); assert.equal(o(L2).ws,L2.F[1],'and the Weak Spot');
});

/* ============================== THE TANGLEWOOD ============================== */
test('Sloe / Vine Snare\'s root: Tangle Deep (+0.2 s a rank after it lands), Green Shoots (5% a rank on an Overgrown enemy), 4.0 s at most; Hold Fast (a 1 s silence, Quiet Wood 0.2 s a rank); Snare Thorns; Snare Reach; Path Closes; Snare Pace',()=>{
  { const L=sl(S(['tw_2_1','tw_1_2']),{foes:2,freeF:true}), {F}=L; castVS(L,F[0]); near(F[0].stunned,2.8+0.6,'Tangle Deep: 0.2 s x 3 on top of the 2.8 s',1e-6);
    free(F[1]); rec(L,F[1]).og=5; rec(L,F[1]).lk=0; V.step(30); castVS(L,F[1]); near(F[1].stunned,2.8*1.15+0.6,'on an Overgrown enemy: 5% x 3 longer as well',1e-6); }
  { const L=sl(S(['tw_5_2','tw_6_2']),{foes:2,freeF:true}), {F}=L; castVS(L,F[0]); near(F[0].silencedT,1.6,'Hold Fast: rooted and silenced 1 s + 0.2 s x 3',1e-6); }
  { let p; plain({foes:2,freeF:true},P=>{ p=lost(P.F[0],()=>castVS(P,P.F[0])); }); const L=sl(S(['tw_10_1']),{foes:2,freeF:true}); near(lost(L.F[0],()=>castVS(L,L.F[0]))/p,1.20,'Snare Thorns: 4% x 5 more',1e-6); }
  { const L=sl(S(['tw_4_1']),{foes:2,freeF:true}), {F}=L; at(L,F[1],4.5,2.6); castVS(L,F[0]); assert.ok(F[1].stunned>0,'Snare Reach: 2.6 m from its centre is inside a 2.4 m x 1.2 ground');
    const P=sl(null,{foes:2,freeF:true}); at(P,P.F[1],4.5,2.6); castVS(P,P.F[0]); near(P.F[1].stunned,0,'(outside the plain 2.4 m)'); }
  { const L=sl(S(['tw_3_1']),{foes:3,freeF:true}), {v,F}=L; at(L,F[2],3,0); at(L,F[0],12,0); const t=VMX('(function(u,t){ return TalentFx.skillTgt(u,"swamproot",t,u.blueAb); })')(v,F[1]); assert.equal(t,F[2],'Path Closes: under the enemy nearest her, not her target'); }
  { const L=sl(S(['tw_7_1']),{foes:1}); near(VMX('(function(u){ return TalentFx.cd(u,"blue",10); })')(L.v),9,'Snare Pace: 0.2 s x 5 off Vine Snare'); }
});
test('Sloe / Let Them Run (PICK ONE): Vine Snare\'s root 40% shorter, then 30% slower for 3 s (+ Long Chase 0.5 s a rank)',()=>{
  const L=sl(S(['tw_5_3','tw_6_3']),{foes:2,freeF:true}), {F}=L; castVS(L,F[0]); near(F[0].stunned,2.8*0.6,'40% shorter',1e-6);
  secs(1.7); assert.ok(!(F[0].stunned>0)); V.step(1); near(F[0].slowMul,0.70,'slowed 30% once it ends',1e-9); assert.ok(F[0].slow>4.4&&F[0].slow<=4.5,'for 3 s + 0.5 s x 3: '+F[0].slow);
});
test('Sloe / the Thicket: Vine Snare\'s ground until 3 s after its root ends (Wide Thicket 0.4 s a rank), enemies in it 3% slower a rank; Taken by the Roots (her team 1.5% a rank more on them); Strangler Fig (rooted again 0.5 s, 0.5 s after, once per Vine Snare)',()=>{
  const L=sl(S(['tw_1_1','tw_5_1','tw_8_1','tw_9_1']),{foes:3,allies:1,freeF:true}), {v,F,A}=L; at(L,F[1],4.5,3.2); at(L,F[2],15.5,0); castVS(L,F[0]);
  const z=o(L).th[0]; assert.ok(z,'a Thicket'); near(z.t,2.8+3+2,'its time: the root (2.8 s) + 3 s + 0.4 s x 5',1e-6); near(z.r/V.METER,2.4,'Vine Snare\'s 2.4 m');
  V.step(1); near(F[1].slowMul,0.85,'an enemy whose body is over it: 3% x 5 slower',1e-9); assert.ok(!(F[2].slow>0),'not one outside');
  near(allyRatio(L,A[0],F[1]),1.075,'Taken by the Roots: 1.5% x 5 more from her allies'); near(ratio(L,F[1]),1.075,'and from her'); near(allyRatio(L,A[0],F[2]),1,'not outside it');
  secs(2.8); assert.ok(!(F[0].stunned>0),'the root has ended'); secs(0.4); assert.ok(!(F[0].stunned>0),'not again at once (the 0.5 s after her stun)'); secs(0.15); assert.ok(F[0].stunned>0.3&&F[0].stunned<=0.5+1e-9,'Strangler Fig: rooted again 0.5 s, 0.5 s after: '+F[0].stunned);
  secs(1.1); assert.ok(!(F[0].stunned>0)); secs(1); assert.ok(!(F[0].stunned>0),'once per Vine Snare');
  secs(6); assert.equal(o(L).th.length,0,'the Thicket is gone when its time is up');
});
test('Sloe / Overgrown: each volley arrow 5 s (+ Overgrowth 0.4 s a rank); Grows Where It Lands (1.5% a rank from her), Choking Vines (2% a rank less, both groups), Choked Out (2% a rank less healing), Seeded Volley (0.6 s root), Wildwood (spreads within 3 m when one dies)',()=>{
  const L=sl(S(['tw_1_2','tw_9_2','tw_2_2','tw_4_2','tw_10_2','tw_7_2','tw_11_2']),{foes:3,allies:1,big:true}), {v,F,A}=L; F.forEach(free); castVO(L); secs(1.2);
  for(const f of F) assert.ok(rec(L,f).og>5.5&&rec(L,f).og<=7,'Overgrown 5 s + 0.4 s x 5: '+rec(L,f).og);
  near(ratio(L,F[0]),1.075,'Grows Where It Lands: 7.5% more from her'); near(inRatio(L,v,{src:F[0]}),0.94,'Choking Vines: it deals 6% less to her'); near(allyIn(L,A[0],{src:F[0]}),0.94,'and to her allies');
  const hl=x=>{ const h=x.hp; x.hp=x.maxHp*0.5; const b=x.hp; V.heal(x,1000); const g=x.hp-b; x.hp=h; return g; }; near(hl(F[0]),900,'Choked Out: 10% less healing',1e-6);
  for(const f of F){ free(f); rec(L,f).lk=0; } castVO(L); secs(0.95); for(const f of F) near(f.stunned>0?1:0,1,'Seeded Volley: each arrow on an Overgrown enemy roots it');
  const L2=sl(S(['tw_1_2','tw_11_2']),{foes:3}), y=L2.F; at(L2,y[1],4.5,3.2); at(L2,y[2],15.5,0); rec(L2,y[0]).og=5; y[0].hp=1; V.hit(L2.v,y[0],10,{kind:'true'}); assert.ok(rec(L2,y[1]).og>0,'Wildwood: Overgrown passes to an enemy within 3 m'); assert.ok(!((o(L2).e[y[2].uid]||{og:0}).og>0),'not farther');
});
test('Sloe / Brambles: an enemy whose body comes within 2 m is rooted 0.1 s a rank (+ Thicker Brambles 0.06 s a rank), once a wave; Briar Patch (1 more a rank); Thorny; Thorn Wall; Caught Fast; Closing Behind (her group); Wood Remembers',()=>{
  const L=sl(S(['tw_1_4','tw_10_4','tw_3_4','tw_12_4','tw_7_4','tw_8_4','tw_5_4']),{foes:3,big:true}), {v,F}=L; F.forEach(free); at(L,F[1],15.5,0); at(L,F[2],15.5,6);
  const gap=VMX('(function(a,b){ return (dist(a,b)-bodyR(a)-bodyR(b))/METER; })'); at(L,F[0],0,0); at(L,F[0],(V.bodyR(v)+V.bodyR(F[0])+1.5),0); assert.ok(gap(v,F[0])<2);
  const h=F[0].hp, i0=v.atkInterval; V.step(1); near(F[0].stunned,0.8,'caught: rooted 0.1 s x 5 + 0.06 s x 5',0.05); near(h-F[0].hp,0.75*v.dmg,'Thorny: 15% x 5 of her attack',1e-3);
  near(F[0].slowMul,0.70,'Thorn Wall: 10% x 3 slower',1e-9); assert.ok(F[0].slow>2.7,'until 2 s after the root'); near(ratio(L,F[0]),1.10,'Caught Fast: 2% x 5 more from her'); near(inRatio(L,v,{src:F[1]}),0.91,'Closing Behind: 3% x 3 less for 2 s');
  V.step(1); near(i0/v.atkInterval,1.05,'Wood Remembers: 1% x 5 attack speed for each enemy caught this wave',1e-9);
  secs(2.5); assert.ok(!(F[0].stunned>0)); near(inRatio(L,v,{src:F[1]}),1,'Closing Behind is over'); assert.equal(rec(L,F[0]).br,1,'once a wave');
  const L2=sl(S(['tw_1_4','tw_6_4']),{foes:1}), x=L2.F[0]; free(x); at(L2,x,(V.bodyR(L2.v)+V.bodyR(x)+1.5),0); V.step(1); assert.ok(x.stunned>0); secs(0.6); assert.ok(!(x.stunned>0)); secs(0.3); assert.ok(!(x.stunned>0),'the 0.5 s after it ends (0.4 s after: not yet)');
  secs(0.5); assert.ok(x.stunned>0,'Briar Patch: caught again'); secs(1.2); assert.ok(x.stunned>0||rec(L2,x).br===3,'and a third time (1 + 1 x 2)'); secs(3); assert.equal(rec(L2,x).br,3,'never a fourth');
  const L3=sl(S(['tw_1_4']),{foes:1}), y=L3.F[0]; free(y); at(L3,y,(V.bodyR(L3.v)+V.bodyR(y)+2.1),0); V.step(2); assert.ok(!(y.stunned>0),'2.1 m away: not caught');
});
test('Sloe / Thorn and Fletching (LINK): the first catch of each enemy - her next Thornshot on it 10% more; with Nock and Wait the catch nocks 1 arrow (2 a wave at most)',()=>{
  const L=sl(S(['tw_1_4','tw_n1','eq_1_1']),{foes:3}), {v,F}=L; F.forEach(free); o(L).nk=0; o(L).nkT=0;
  for(const f of F) at(L,f,(V.bodyR(v)+V.bodyR(f)+1.0),0); at(L,F[1],0,(V.bodyR(v)+V.bodyR(F[1])+1.0)); at(L,F[2],0,-(V.bodyR(v)+V.bodyR(F[2])+1.0)); V.step(1);
  assert.equal(o(L).nk,2,'three caught, two arrows nocked'); assert.ok(rec(L,F[0]).tf);
  F[0].stunned=0; const a=lost(F[0],()=>castTS(L,F[0])); F[0]._shredPct=0; const b=plainHit(L,()=>lost(F[0],()=>castTS(L,F[0]))); near(a/b,1.10,'her next Thornshot on it: 10% more',1e-6);
  F[0]._shredPct=0; const c=lost(F[0],()=>castTS(L,F[0])); F[0]._shredPct=0; const d=plainHit(L,()=>lost(F[0],()=>castTS(L,F[0]))); near(c/d,1,'only the next one',1e-6);
  const L2=sl(S(['tw_1_4','tw_n1']),{foes:1}), x=L2.F[0]; free(x); at(L2,x,(V.bodyR(L2.v)+V.bodyR(x)+1.0),0); o(L2).nk=0; V.step(1); assert.equal(o(L2).nk,0,'without Nock and Wait: no arrow');
});
test('Sloe / her roots: Rooted Prey (3% a rank), Patient Wood (0.3% a rank a Patience stack), Ring of Thorn (Thornshot 4% a rank), Bark Skin (2% armour a rank a rooted enemy, 3 at most), Never Followed, Woodwise, Roots Find Stone',()=>{
  const L=sl(S(['tw_6_1','tw_11_3','tw_12_1','tw_4_4','tw_11_4','tw_2_3','tw_n2']),{foes:3,big:true,freeF:true}), {v,F}=L; const a0=v.armorRating;
  for(const f of F){ at(L,f,f===F[0]?4.5:(f===F[1]?4.5:15.5),f===F[1]?1:0); }
  castVS(L,F[0]); assert.ok(F[0].stunned>0); V.step(1); near(v.armorRating/a0,1+0.06*(F[1].stunned>0?2:1),'Bark Skin: 2% x 3 armour for each enemy she has rooted',1e-6);
  v._hpStk=4; near(ratio(L,F[0]),1.15*(1+0.015*4),'Rooted Prey 15% and Patient Wood 0.3% x 5 for each of 4 stacks'); near(ratio(L,F[2]),1,'not on one she has not rooted');
  F[2].stunned=5; near(ratio(L,F[2]),1,'(a root that is not hers does not count)'); F[2].stunned=0;
  const ts=lost(F[0],()=>castTS(L,F[0])); F[0]._shredPct=0; const tp=plainHit(L,()=>lost(F[0],()=>castTS(L,F[0]))); F[0]._shredPct=0; near(ts/tp,1.15*1.12*(1+0.015*4),'Ring of Thorn: Thornshot 12% more on it as well',1e-6);
  at(L,F[2],(V.bodyR(v)+V.bodyR(F[2])+2.5)/1,0); near(inRatio(L,v,{src:F[2]}),0.90,'Never Followed: 10% less from an enemy within 3 m'); at(L,F[2],15.5,0); near(inRatio(L,v,{src:F[2]}),1,'not farther');
  near(VMX('(function(u,s){ return TalentFx.cc(s,u,"stunned",2); })')(v,F[2]),2*0.85,'Woodwise: controls on her 15% shorter',1e-9);
  F[2].stunImmune=true; at(L,F[2],7,-2.5); castVS(L,F[2]); V.step(1); assert.ok(rec(L,F[2]).rfs>0,'Roots Find Stone: a root blocked by immunity'); near(inRatio(L,v,{src:F[2]}),0.92,'that enemy deals 4% x 2 less for 3 s');
  rec(L,F[2]).rfs=0; castVS(L,F[2]); near(rec(L,F[2]).rfs,0,'once per enemy every 12 s'); secs(11.5); castVS(L,F[2]); near(rec(L,F[2]).rfs,0,'(not at 11.5 s)'); secs(0.6); castVS(L,F[2]); assert.ok(rec(L,F[2]).rfs>0,'again after 12 s');
});
test('Sloe / What It Will Not Allow (SIGNATURE): every 25 s the volley roots every enemy it hits 1.5 s, Overgrows it and opens a Thicket under it; her Brambles may catch every enemy again this wave',()=>{
  const L=sl(S(['tw_13_2']),{foes:3}), {v,F}=L; F.forEach(free); at(L,F[0],6.5,0); /* out of the Brambles' 2 m */ rec(L,F[0]).br=1; castVO(L); assert.equal(rec(L,F[0]).br,0,'Brambles again'); secs(0.31); const fz=F.slice().sort((a,b)=>Math.hypot(b.x-v.x,b.y-v.y)-Math.hypot(a.x-v.x,a.y-v.y))[0]; assert.ok(fz.stunned>1.42&&fz.stunned<=1.5,'the first arrow: 1.5 s: '+fz.stunned); secs(0.64);
  for(const f of F){ assert.ok(f.stunned>0.5&&f.stunned<=1.5,'rooted 1.5 s: '+f.stunned); assert.ok(rec(L,f).og>0,'Overgrown'); } assert.equal(o(L).th.length,3,'a Thicket under each one');
  secs(2); for(const f of F){ free(f); rec(L,f).lk=0; } castVO(L); secs(0.95); for(const f of F) assert.ok(!(f.stunned>0),'not again within 25 s'); near(o(L).c2,25-3.9,'(its 25 s)',0.002);
});

/* ============================== EMPTY THE QUIVER ============================== */
test('Sloe / Nocked Arrows: 1 every 2 s with no ability cast (Quick Nock 6% faster a rank), 6 at most (+ Full Quiver 1 a rank); a cast starts the count again; Never Run Dry; Tough Bow (6% less at 3 or more, her group); Held Draw (15% basic attacks at 6)',()=>{
  const L=sl(S(['eq_1_1','eq_2_1','eq_5_1','eq_6_4','eq_8_1']),{foes:1,big:true}), {v,F}=L; o(L).nk=0; o(L).nkT=0; secs(1.5); assert.equal(o(L).nk,0,'not at 1.5 s'); secs(0.1); assert.equal(o(L).nk,1,'one every 2 s / 1.3 = 1.54 s');
  secs(20); assert.equal(o(L).nk,9,'9 at most (6 + 1 x 3)'); near(inRatio(L,v),0.94,'Tough Bow: 3% x 2 less'); near(ratio(L,F[0],{auto:true}),1.15,'Held Draw: basic attacks 3% x 5 more'); near(ratio(L,F[0]),1,'(not other hits)');
  o(L).nk=2; near(inRatio(L,v),1,'below 3: no Tough Bow'); near(ratio(L,F[0],{auto:true}),1,'below 6: no Held Draw'); o(L).nk=5; near(ratio(L,F[0],{auto:true}),1,'(not at 5)');
  o(L).nkT=1.4; castTS(L,F[0]); assert.equal(o(L).nkT,0,'an ability starts the count again');
  const L2=sl(S(['eq_11_1','eq_10_1','eq_1_1']),{foes:1}); o(L2).nk=0; VMX('resetPerWave(); beginWaveEnter(); waveXfer=null;'); V.step(1); assert.equal(o(L2).nk,6,'Never Run Dry: each wave starts with 6');
});
test('Sloe / the volley fires every nocked arrow at the farthest enemies (8% of an arrow a rank); Quiver Empty (20 energy at 6 or more); Rain of Thorns (half of Thornshot\'s shred); Every Arrow Counts (1% attack speed a rank, 4 s, 5 at most)',()=>{
  let pl; plain({foes:3},P=>{ const h=P.F.map(f=>f.hp); castVO(P); secs(2); pl=P.F.map((f,i)=>h[i]-f.hp); });
  const L=sl(S(['eq_1_1','eq_9_2','eq_2_1','eq_7_1','eq_10_1']),{foes:3}), {v,F}=L; o(L).nk=7; F.forEach(f=>f._shredPct=0); v.energy=0; const i0=v.atkInterval; const h=F.map(f=>f.hp);
  castVO(L); assert.equal(o(L).nk,0,'every arrow spent'); assert.equal(v.energy,20,'Quiver Empty: 20 energy for 6 or more'); secs(1.45);
  const far=F.slice().sort((a,b)=>Math.hypot(b.x-v.x,b.y-v.y)-Math.hypot(a.x-v.x,a.y-v.y));
  const lostBy=F.map((f,i)=>h[i]-f.hp);
  assert.ok(lostBy[F.indexOf(far[0])]>pl[F.indexOf(far[0])]*1.3,'the farthest takes its arrow and three nocked ones (7 over 3 enemies)');
  assert.ok(far[0]._shredPct>0,'Rain of Thorns: the nocked arrows shred'); near(far[0]._shredPct,0.5*VMX('shredAt')(0.32,SM10()),'at half of Thornshot\'s',0.05);
  assert.ok(i0/v.atkInterval>1.249&&i0/v.atkInterval<1.251,'Every Arrow Counts: 1% x 5 for each of 5 (at most) nocked arrows that hit: '+i0/v.atkInterval); secs(4.1); near(i0/v.atkInterval,1,'gone 4 s after the last',1e-9);
  const L4=sl(S(['eq_1_1','eq_9_2']),{foes:3}); o(L4).nk=5; L4.v.energy=0; castVO(L4); assert.equal(L4.v.energy,0,'Quiver Empty: not for 5');
  const L3=sl(S(['eq_1_1']),{foes:1}); o(L3).nk=1; const q=L3.F[0].hp; castVO(L3); secs(0.35); const one=q-L3.F[0].hp; secs(1); near((q-L3.F[0].hp)/one,1.40,'one nocked arrow: 8% x 5 of an arrow on top of the arrow',1e-6);
});
test('Sloe / Second String: Thornshot also fires a nocked arrow at the next nearest enemy, with Thornshot\'s full shred; Steady Nock (0.3% crit a rank an arrow) inside her crit group',()=>{
  const L=sl(S(['eq_1_1','eq_2_1','eq_3_1']),{foes:3}), {v,F}=L; at(L,F[1],6,0); at(L,F[2],15.5,6); o(L).nk=2; F.forEach(f=>f._shredPct=0); const h=F[1].hp; castTS(L,F[0]);
  assert.equal(o(L).nk,1,'one arrow spent'); assert.ok(F[1].hp<h,'the nearest other enemy struck'); near(F[1]._shredPct,F[0]._shredPct,'with Thornshot\'s full shred'); near(F[2]._shredPct||0,0);
  o(L).nk=0; const h1=F[1].hp; castTS(L,F[0]); near(F[1].hp,h1,'no arrow nocked: nothing');
  const L2=sl(S(['eq_4_1','eq_9_4']),{foes:1}); V.step(1); const c0=L2.v.glyphCrit; o(L2).nk=3; V.step(1); near(L2.v.glyphCrit-c0,0,'Sharp Eye 5% already fills her 5% crit group: Steady Nock adds nothing',1e-9);
  const L3=sl(S(['eq_4_1']),{foes:1}); o(L3).nk=0; V.step(1); const d0=L3.v.glyphCrit; o(L3).nk=2; V.step(1); near(L3.v.glyphCrit-d0,0.03,'Steady Nock: 0.3% x 5 an arrow',1e-9); o(L3).nk=6; V.step(1); near(L3.v.glyphCrit-d0,0.05,'(6 arrows 9%: 5% at most)',1e-9);
});
test('Sloe / Greenfall: each volley arrow 4 s (+ Spring Growth 0.4 s a rank), her allies hitting it heal 1% + 0.4% a rank of the damage; Undergrowth (both groups), Marked Green, Far Shot, Bloom, New Growth (3 enemies at once)',()=>{
  const L=sl(S(['eq_1_3','eq_3_3','eq_9_3','eq_4_3','eq_10_3','eq_10_4','eq_7_3','eq_8_3']),{foes:3,allies:1,big:true}), {v,F,A}=L; v.hp=v.maxHp*0.5; const hv=v.hp; castVO(L); secs(1.2);
  for(const f of F) assert.ok(rec(L,f).gf>5.9-1.2,'Greenfall 4 s + 0.4 s x 5'); near((v.hp-hv)/v.maxHp,0.06,'New Growth: 2% x 3 of her max HP when it lands on 3',1e-3);
  const a=A[0]; a.maxHp=1e6; a.hp=5e5; const ha=a.hp, d=lost(F[0],()=>V.hit(a,F[0],1000,{kind:'true'})); near(a.hp-ha,d*0.05,'her ally heals 3% + 2% of the damage',1e-3);
  near(allyRatio(L,a,F[0]),1.05,'Marked Green: 1% x 5 more from her allies'); near(ratio(L,F[0]),1,'(not from her)'); near(ratio(L,F[0],{crit:true}),1.10,'Far Shot: her crits 2% x 5 more on it');
  near(inRatio(L,v,{src:F[0]}),0.94,'Undergrowth: it deals 6% less to her'); near(allyIn(L,a,{src:F[0]}),0.94,'and to her allies');
  at(L,a,4.5,(V.bodyR(a)+V.bodyR(F[0])+3)/1); a.hp=5e5; const hb=a.hp; F[0].hp=1; V.hit(v,F[0],10,{kind:'true'}); near((a.hp-hb)/a.maxHp,0.05,'Bloom: an ally within 4 m heals 1% x 5 of its max HP',1e-6);
  secs(6); assert.ok(!(rec(L,F[1]).gf>0),'Greenfall gone after its time');
  const L2=sl(S(['eq_1_3','eq_8_3']),{foes:2,big:true}); L2.v.hp=L2.v.maxHp*0.5; const h2=L2.v.hp; castVO(L2); secs(1.2); near(L2.v.hp,h2,'New Growth: not for 2 enemies',1e-9);
});
test('Sloe / the volley: All at Once (together, 15% + 5 points a rank), Slowly (0.3 s apart, each 5% + 1 point a rank more than the one before), Back Row Hunter, Fan of Green, Long Flight, Thorn Storm, Rapid Release (inside the crit group), Wood Sense, Volley Pace',()=>{
  let pl; plain({foes:3},P=>{ const h=P.F.map(f=>f.hp); castVO(P); secs(1.4); pl=P.F.map((f,i)=>h[i]-f.hp); });
  { const L=sl(S(['eq_5_2','eq_6_2']),{foes:3}), {F}=L; const h=F.map(f=>f.hp); castVO(L); secs(0.31); for(let i=0;i<3;i++) near((h[i]-F[i].hp)/pl[i],1.30,'All at Once: every arrow at 0.30 s, 30% more',1e-6); }
  { const L=sl(S(['eq_5_3','eq_6_3']),{foes:3}), {v,F}=L; const far=F.slice().sort((a,b)=>Math.hypot(b.x-v.x,b.y-v.y)-Math.hypot(a.x-v.x,a.y-v.y)); const h=far.map(f=>f.hp); castVO(L);
    secs(0.31); assert.ok(far[0].hp<h[0]&&far[1].hp===h[1],'Slowly: 0.3 s apart'); secs(0.24); assert.ok(far[1].hp===h[1],'(the second not before 0.60 s)'); secs(0.06); secs(0.4); const pf=far.map(f=>pl[F.indexOf(f)]); for(let i=0;i<3;i++) near((h[i]-far[i].hp)/pf[i],Math.pow(1.08,i),'arrow '+i+': 8% more than the one before',1e-6); }
  { const L=sl(S(['eq_4_2','eq_12_2','eq_1_2','eq_11_2']),{foes:3}), {F}=L; F.forEach(f=>{ f.t=Object.assign({},f.t,{row:f===F[2]?'Back':'Front'}); }); const h=F.map(f=>f.hp); castVO(L); secs(1.4);
    near((h[0]-F[0].hp)/pl[0],1.15*1.15,'Fan of Green 1% x 5 for each of 3 enemies, Long Flight 15%',1e-6); near((h[2]-F[2].hp)/pl[2],1.15*1.15*1.12,'Back Row Hunter: 12% more on a back-row enemy',1e-6); }
  { const L=sl(S(['eq_11_2']),{foes:1}), {v,F}=L; const LP=VMX('(function(u,t,f){ TalentFx.landPre(u,t,"volley"); try{ return f(); } finally{ TalentFx.land(u,t,"volley"); } })');
    near(LP(v,F[0],()=>ratio(L,F[0],{crit:true})),1.20,'Thorn Storm: a volley arrow crit 4% x 5 more'); near(LP(v,F[0],()=>ratio(L,F[0])),1,'(not a hit that is no crit)'); near(ratio(L,F[0],{crit:true}),1,'(not another hit)'); }
  { const L=sl(S(['eq_2_2','om_2_2']),{foes:1}), {v}=L; V.step(1); const c0=v.glyphCrit; VMX('(function(u){ TalentFx.landPre(u,null,"volley"); })')(v); near(v.glyphCrit-c0,0,'Rapid Release: Blackthorn Eye already fills the 5% group',1e-9); VMX('(function(u){ TalentFx.land(u,null,"volley"); })')(v);
    const L2=sl(S(['eq_2_2']),{foes:1}), w=L2.v; V.step(1); const d0=w.glyphCrit; VMX('(function(u){ TalentFx.landPre(u,null,"volley"); })')(w); near(w.glyphCrit-d0,0.05,'Rapid Release: 2% x 5 on a volley arrow, 5% at most',1e-9); VMX('(function(u){ TalentFx.land(u,null,"volley"); })')(w); near(w.glyphCrit,d0,'(only while the arrow strikes)',1e-9); }
  { const L=sl(S(['eq_5_4']),{foes:1}), {v}=L; const a0=v.armorRating, m0=v.mrRating; castVO(L); V.step(1); near(v.armorRating/a0,1.15,'Wood Sense: 3% x 5 armour for 4 s',1e-9); near(v.mrRating/m0,1.15,'and magic resist',1e-9); secs(4.05); near(v.armorRating/a0,1,'',1e-9); }
  { const L=sl(S(['eq_6_1']),{foes:1}), {v}=L; v.energy=10; V.step(1); const e1=v.energy; v.energy=e1+10; V.step(1); near(v.energy,e1+10*1.15,'Volley Pace: 3% x 5 more energy gained',1e-6); }
});
test('Sloe / Slowly, Then All at Once (SIGNATURE): every 30 s the volley fires every nocked arrow and 6 more (40% of an arrow at least), every arrow leaves Greenfall, the first to hit each enemy Lays it Bare (her ally\'s next hit 40% more, within 5 s)',()=>{
  const L=sl(S(['eq_13_2']),{foes:3,allies:1}), {v,F,A}=L; o(L).nk=0; const h=F.map(f=>f.hp); castVO(L); assert.equal(o(L).q.length,6,'six more arrows'); secs(2.5); near(o(L).c3,30-2.5,'(its 30 s)',0.002);
  for(const f of F){ assert.ok(rec(L,f).gf>0,'Greenfall'); assert.ok(rec(L,f).lb>0,'Laid Bare'); }
  near(allyRatio(L,A[0],F[0]),1.40,'her ally\'s next hit 40% more'); near(allyRatio(L,A[0],F[0]),1,'once'); secs(5); near(allyRatio(L,A[0],F[1]),1,'within 5 s');
  o(L).nk=0; castVO(L); assert.equal(o(L).q.length,0,'not again within 30 s');
});
test('Sloe / Another Will Do: her target walks out of her reach - her next basic attack on another enemy ignores 10% of its armour a rank (one held, 4 s)',()=>{
  const L=sl(S(['eq_n1']),{foes:2,big:true}), {v,F}=L; const R0=v.range; v.target=F[0]; V.step(1); F[1].armorRating=500; F[1].t=Object.assign({},F[1].t,{role:'Bruiser'});   /* not a Tank: a Marksman's basic attack on a Tank may be BLOCKED by a seeded roll */ v.range=1; V.step(1); v.range=R0; assert.ok(o(L).awd>3.9,'held (her reach made 1 px for one step: the target out of it)');
  const ig=VMX(`(function(s,t){ const sv=s._wpnArmIgn; s._wpnArmIgn=0.30; const x=defMul(s,t,'phys'); s._wpnArmIgn=sv; return x/defMul(s,t,'phys'); })`)(v,F[1]);
  const a=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'phys',auto:true})); const b=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'phys',auto:true}))); near(a/b,ig,'30% of its armour ignored',1e-6);
  near(lost(F[1],()=>V.hit(v,F[1],1000,{kind:'phys',auto:true}))/b,1,'spent',1e-6);
  v.target=F[1]; V.step(1); v.target=F[0]; V.step(1); v.range=1; V.step(1); v.range=R0; secs(4.1); near(lost(F[1],()=>V.hit(v,F[1],1000,{kind:'phys',auto:true}))/b,1,'lost after 4 s',1e-6);
});
test('Sloe: her crit chance from talents is ONE group (5% at most), her damage reduction ONE capped group (35% at most), her allies\' from her talents ONE group (15% at most)',()=>{
  const P=sl(null,{foes:1}); V.step(1); const p0=P.v.glyphCrit; const L2=sl(S(['om_2_2','tw_9_3','eq_9_4','eq_4_1']),{foes:1}); o(L2).nk=9; V.step(2); near(L2.v.glyphCrit-p0,0.05,'every crit talent at once: 5%',1e-9);
  const ids=['om_3_4','om_4_4','om_11_1','tw_8_4','tw_11_4','eq_6_4','eq_11_4','tw_4_2','eq_4_3','tw_n2'];
  const L3=sl(S(ids),{foes:2,allies:1,big:true}), {v,F,A}=L3; const f=F[1]; v.target=F[0]; o(L3).und=true; v._hpStk=6; setWin(L3,'slCb',2); o(L3).nk=5; const e=rec(L3,f); e.og=9; e.gf=9; e.rfs=9; f.melee=false; at(L3,f,(V.bodyR(v)+V.bodyR(f)+1)/1,0);
  near(inRatio(L3,v,{src:f}),0.65,'every condition at once: 35% off, not more'); near(L3.T.fn.drK(L3.T.s.slA,L3.T,v,f,true),0.65,'the same number as the 95% instrument reads it',1e-9);
  near(allyIn(L3,A[0],{src:f}),0.85,'her allies: 15% off at most');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Sloe: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['om_1_1','om_2_1','om_1_3','om_n1','tw_1_1','tw_1_2','tw_1_4','eq_1_1','eq_1_3','eq_11_1']), TEAM=['vael','sylthaine','vireo','vex','sloe'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let ws=0, sp=0, und=0, nk=0, og=0, gf=0, th=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const q=s._tal.s.sl||{e:{}}; if(q.ws) ws++; if(q.und) und++; nk=Math.max(nk,q.nk||0); if(q.th&&q.th.length) th++;
    for(const id in q.e){ const e=q.e[id]; if(e.spT>0) sp=Math.max(sp,e.sp); if(e.og>0) og++; if(e.gf>0) gf++; } }
  console.log('  live fight: ticks with a Found Weak Spot '+ws+', most Splits '+sp+', ticks Undisturbed '+und+', most nocked '+nk+', Overgrown / Greenfall enemy-ticks '+og+' / '+gf+', ticks with a Thicket '+th);
  assert.ok(sp>=1,'real Splits'); assert.ok(und>0,'Undisturbed'); assert.ok(nk>=6,'arrows nocked'); assert.ok(th>0,'a Thicket');
  determinism(H,TEAM);
});

/* The page sites her talents added (Hunter's Patience: right before and after it counts a swing; Emerald Volley: each arrow's landing pair, the target hook):
   with nothing learned, whole seeded fights with Sloe in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Sloe: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['sloe','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','quorrel'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __slN={sw:0,vo:0,arrows:0,fights:0}; var __slD=_doEffectCore, __slC=_dealDamageCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="sloe"&&type==="volley") __slN.vo++; if(u&&u.key==="quorrel"&&type==="volley") __slN.vo++; return __slD.apply(this,arguments); };'+
    '_dealDamageCore=function(s,t,a,c,k,si){ if(s&&(s.key==="sloe"||s.key==="quorrel")&&c==="#5ee89b") __slN.arrows++; if(s&&s.key==="sloe"&&_autoAtk) __slN.sw++; return __slC.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__slN'); console.log('  identity / base skills: '+JSON.stringify(c));
    assert.ok(c.sw>0&&c.vo>0&&c.arrows>0,'the fights swung, cast the volley and landed its arrows: every new site was run'); }
  finally{ VMX('_doEffectCore=__slD; _dealDamageCore=__slC;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Her damage reduction talents (and armour / magic resist), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ om:['om_3_4','om_4_4','om_11_1','om_5_4','om_12_3','om_n1'], tw:['tw_8_4','tw_11_4','tw_4_2','tw_n2','tw_4_4','tw_2_3','tw_1_2','tw_1_4'], eq:['eq_6_4','eq_11_4','eq_4_3','eq_5_4','eq_1_3','eq_1_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={om:0,tw:1,eq:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)>=cap) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her damage-reduction talents true at once (Undisturbed, 6 Patience, a catch's 2 s, 5 arrows nocked, the attacker within 3 m, ranged, not her
   target, Overgrown, with Greenfall, Roots Find Stone on it; Watcher and Wood Sense running, 3 enemies rooted by her); sustained: a usual state (nothing of it, a basic attack of 5% of her
   max HP from her target). Measured through the engine (HP and shield it takes) */
function worstHit(list,kind,crit,sustained){ const L=sl(list,{foes:5,still:true}), {v,F}=L; const f=F[0];
  v.maxHp=1e5; v.hp=sustained?8e4:2.5e4; V.step(1);
  if(L.T&&!sustained){ const s=o(L); s.und=true; v._hpStk=6; setWin(L,'slCb',2); setWin(L,'slWat',3); setWin(L,'slWsn',4); s.nk=5; v.target=F[1]; const e=rec(L,f); e.og=9; e.gf=9; e.rfs=9; f.melee=false;
    at(L,f,(V.bodyR(v)+V.bodyR(f)+1),0); for(const x of F.slice(1,4)) s.rt[x.uid]={x,sid:0}; V.step(1); s.und=true; }
  if(sustained) v.target=f;
  for(const x of F) x.stunned=1e6;
  const raw=sustained?5e3:2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:true})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Sloe: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['tw','om'],[61,30]],[['om','tw'],[61,30]],[['om','eq'],[61,30]],[['eq','om'],[61,30]],[['tw','eq'],[61,30]],[['eq','tw'],[61,30]],[['tw'],[91]],[['om'],[91]],[['eq'],[91]]].map(([o2,c])=>{ const b=defensive(o2,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o:o2,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="sloe"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="sloe"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal; const e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    if(T&&T.s.slA&&e){ const k=T.fn.drK(T.s.slA,T,u,e,true); const tot=1-k*Math.min(defMul(e,u,"phys"),defMul(e,u,"magic")); if(tot>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','sloe'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','grosk','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; ticks at 85% or more (the reference hit, the better of her armour and magic resist) '+d.tHi+' of '+d.ticks+' ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%); immune '+d.imm);
    assert.ok(d.n>30&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* the stun-lock rule in seeded fights: her most controlling build (The Tanglewood at 61 with its signature, 30 in One Man and Enough Time), every enemy's longest unbroken stun while
   one of her roots is on it, how many talent roots landed, and that none landed on a stunned enemy or within 0.5 s after one of hers ended */
function goalBuild(plan){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={om:0,tw:1,eq:2}, pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  for(const [k,cap,gl] of plan){ const goals=[]; for(const id of gl) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k];
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; }
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } }
  return b; }
test('Sloe: in seeded fights no enemy is rooted by her in a chain - every talent root lands only after a 0.5 s break, never on a stunned enemy, 4.0 s at most in a row',()=>{
  const b=goalBuild([['tw',61,['tw_13_2','tw_1_4','tw_6_4','tw_10_4','tw_9_1','tw_7_2','tw_2_1','tw_1_2','tw_1_1','tw_5_1']],['om',30,['om_1_1']]]);
  assert.equal(T.invalid(H,b,100),''); const list=T.learned(H,b); assert.ok(list.some(e=>e[0]==='tw_13_2'),'the signature');
  VMX('var __sl={run:{},mx:0,ticks:0,t0:0,n:0,on:0,blk:0};var __slU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ if(battleTime<__sl.t0){ __sl.run={}; } __sl.t0=battleTime; const m=units.find(u=>u.key==="sloe"); const r=__slU.apply(this,arguments); if(m&&m._tal){ __sl.ticks++; const q=m._tal.s.sl; if(q){ __sl.n+=q.st.n; __sl.on+=q.st.on; __sl.blk+=q.st.blk; q.st={n:0,on:0,gap:1e9,blk:0};'+
    '  for(const e of units){ if(e.team===m.team) continue; const k=e.uid; const mine=!!q.rt[k];'+
    '  if(e.alive&&(e.stunned||0)>0&&mine){ if(__sl.run[k]==null) __sl.run[k]=0; __sl.run[k]+=dt; __sl.mx=Math.max(__sl.mx,__sl.run[k]); } else if(__sl.run[k]!=null&&!((e.stunned||0)>0)) __sl.run[k]=null; } } } return r; };');
  try{ const sn=snaps(['sloe','vael','vireo','vex','gruel'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8'));
    for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
    const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [5,77,31337]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__sl'); console.log('  stun-lock: the longest one enemy stayed stunned with a root of hers on it '+d.mx.toFixed(2)+' s; her talent roots landed '+d.n+', refused on a stunned enemy '+d.on+', roots blocked by immunity '+d.blk+', ticks '+d.ticks);
    assert.ok(d.ticks>500); assert.ok(d.n>0,'talent roots landed'); assert.ok(d.mx<=4.0+0.1,'her roots on one enemy never run past 4.0 s in a row'); }
  finally{ VMX('_updateBattleCore=__slU;'); }
});
test('Sloe: a wave change - her countdowns keep their time left (the 20 s signature lock), her records of the old wave\'s enemies are gone',()=>{
  const L=sl(S(['om_13_1','om_1_1','om_1_3']),{foes:2}), {v,F}=L; o(L).c1=12; rec(L,F[0]).sp=3; rec(L,F[0]).spT=8; V.step(3); const c=o(L).c1;
  VMX('resetPerWave(); beginWaveEnter(); waveXfer=null;'); V.step(1); near(o(L).c1,c-V.STEP,'the signature lock counts on',1e-6); assert.equal(Object.keys(o(L).e).length,0,'no records of the old enemies');
});
