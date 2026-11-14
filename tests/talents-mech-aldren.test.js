'use strict';
/* Aldren's talents as data on the mechanics layer (talents-mech/aldren.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured in a plain lab (or with his
   talents switched off for one hit) BEFORE the talented lab is built: lab() replaces the whole field.
   Places (metres from Aldren): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). Bodies: his 1.56 m, theirs 2.01 m
   (F0 to F1: 1.48 m body to body; F0 to F4: 2.06 m).
   Run: node --test tests/talents-mech-aldren.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='aldren', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
/* every hit through the engine, logged while log() runs: who struck, a basic attack or not, its kind, what it took off (HP and shield) */
VMX('var __al=null, __adc=_dealDamageCore; _dealDamageCore=function(src,tgt,amt,color,kind,silent){ const a=_autoAtk; const h0=tgt?tgt.hp+(tgt.shield||0):0; const r=__adc.apply(this,arguments);'+
  ' if(__al&&src) __al.push({src,tgt,auto:!!a,kind:kind||"phys",lost:h0-tgt.hp-(tgt.shield||0),amt}); return r; };');
const log=fn=>{ VMX('__al=[]'); try{ fn(); return VMX('__al'); } finally{ VMX('__al=null'); } };
const pages=hl=>hl.filter(h=>h.src.key===H&&h.kind==='magic'&&!h.auto);                         // his Living Page hits (and his spells: read them in a swing only)
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const units=()=>VMX('units');
const mine=(L,key)=>units().filter(x=>x.alive&&x._summonOwner===L.v&&(!key||x.key===key));
const spirit=L=>{ const n0=mine(L,'ink spirit').length; V.cast(L.v,'green'); const s=mine(L,'ink spirit'); assert.ok(s.length>n0,'an Ink Spirit came'); return s[s.length-1]; };
const horror=L=>{ V.cast(L.v,'ult'); const h=mine(L,'ink horror')[0]; assert.ok(h,'the Elder Ink Horror came'); return h; };
const hold=x=>{ x.stunned=1e6; x.speed=0; };                                                   // a summon held still (the lab holds only the units it made)
const kill=f=>{ f.hp=Math.min(f.hp,10); f.shield=0; V.dmg(f,1e6); assert.ok(!f.alive,'it died'); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const swing=(L,n)=>{ const v=L.v; v.stunned=0; v.greenCd=v.blueCd=1e9; let k=0, was=v.attackAnim||0;   // he really swings (his Living Pages act at the swing)
  for(let i=0;i<4000&&k<n;i++){ v.energy=0; V.step(1); if((v.attackAnim||0)>0.17&&!(was>0.17)) k++; was=v.attackAnim||0; }
  assert.equal(k,n,'he swung'); v.stunned=1e6; };
const swingLog=(L,n)=>{ const hl=log(()=>swing(L,n||1)); return hl; };
const press=(L,slot)=>{ const v=L.v; VMX('castKit')(v,slot==='blue'?v.blueAb:v.greenAb); VMX('castCancel')(v,''); };   // the press of a spell (where Living Pages writes its page), then let it go
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const gapM=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/V.METER-V.bodyR(a)-V.bodyR(b);
const noDef=L=>{ for(const f of L.F){ f.mrRating=0; f.armorRating=0; } };

test('Aldren: every talent is accounted for - 9 plain stats, 107 with rows, none waiting',()=>{
  accounting(H,[116,9,107,0,0]);
  const M=FXN.mech(H); for(const id of ['be_1_1','rw_1_1','lb_1_1','be_13_2','rw_13_2','lb_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['be_5_4','be_6_4','be_9_4','rw_1_3','rw_6_4','rw_9_3','lb_3_3','lb_6_3','lb_8_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['be_9_2','be_1_4','be_7_3','be_12_4']) assert.ok(!FXN.has(H,id)&&M.talents[id],id+': a sentence about his summons (or his energy) is a row, not a plain stat of his');
});

test('Aldren: his real kit, as the talents read it - Ink Spirit, Final Volume, the page written at the press and spent at the swing, the rewrite\'s reversal and its soaked shield burn',()=>{
  plain({foes:3},P=>{ const {v,F}=P;
    const s=spirit(P); near(s.maxHp,Math.round(v.maxHp*0.55*(1+0.005*9)),'a Lesser Ink Spirit: 55% of his max HP x the skill share',0.002); near(s._summonT,16,'for 16 s'); assert.equal(mine(P,'ink spirit').length,1,'one of them');
    const h=horror(P); near(h._summonT,22,'the Elder Ink Horror: 22 s'); near(v.energy,0,'');
    v._pages=0; press(P,'blue'); assert.equal(v._pages,1,'a Blue press writes a page'); press(P,'green'); press(P,'green'); press(P,'green'); assert.equal(v._pages,3,'at most 3');
    v._pages=1; const hl=pages(swingLog(P)); assert.equal(hl.length,1,'the swing spends it: one magic hit, not a basic attack'); assert.equal(v._pages,0);
    near(hl[0].amt,v.dmg*0.6*v.passMul,'60% of the swing x his passive level',1e-6);
    const f=F[1]; f.dmgBuffMul=1.5; f.dmgBuffT=5; f.hasteMul=1.3; f.hasteT=4; f.shield=1000; f.shieldT=5; const h0=f.hp; V.cast(v,'blue',f);
    assert.ok(!(f.dmgBuffT>0)&&!(f.hasteT>0),'Chapter Rewrite ends its buffs'); assert.equal(f.shield,0,'and its shield'); near(f.hp,h0,'its shield burn is soaked by the very shield it burns: no HP lost beyond the skill hit',1e-9);
  });
});

/* ============================== THE BESTIARY ============================== */
test('Aldren / Field Notes: Field Notes, Close Study, Addendum, Index of Beasts, Field Kit, Second Edition, Taxonomy',()=>{
  const pS=plain({foes:6},P=>{ const s=spirit(P); hold(s); return {dmg:s.dmg,ai:s.atkInterval,ap:P.v.apow,hit:lost(P.F[1],()=>V.hit(s,P.F[1],1000,{auto:true}))}; });
  const L=lab(H,S(['be_1_1','be_2_1','be_12_1','be_7_1','be_11_1','be_3_1','be_4_1']),{foes:6,big:true}), {v,F}=L;
  assert.equal(stack(L,'fk'),3,'Field Kit: 1 Field Note per rank at the wave start'); assert.equal(stack(L,'fn'),0);
  V.step(1); near(v.apow,pS.ap*(1+0.01*3),'Index of Beasts: 0.2% x 5 ability power per note (the 3 Field Kit ones)');
  const s=spirit(L); hold(s); V.step(2); const per=0.004*5+0.001*3; near(s.dmg,pS.dmg*(1+per*3),'Field Notes + Addendum: 0.4% x 5 + 0.1% x 3 attack per note to his summons');
  near(s.atkInterval,pS.ai/(1+0.003*3*3),'Close Study: 0.3% x 3 attack speed per note');
  near(lost(F[1],()=>V.hit(s,F[1],1000,{auto:true})),pS.hit,'Taxonomy: no class noted yet');
  kill(F[0]); assert.equal(stack(L,'fn'),0,'an enemy his summons never hit: no Field Note');
  V.hit(s,F[2],10,{auto:true}); kill(F[2]); assert.equal(stack(L,'fn'),1,'one they hit dies: a Field Note'); V.step(2);
  near(s.dmg,pS.dmg*(1+per*4),'4 notes now'); near(v.apow,pS.ap*(1+0.01*4),'');
  near(lost(F[1],()=>V.hit(s,F[1],1000,{auto:true})),pS.hit*1.10,'Taxonomy: 2% x 5 more against a class that has a note');
  const t0=s._summonT; for(const f of [F[1],F[3],F[4]]){ V.hit(s,f,10,{auto:true}); kill(f); } assert.equal(stack(L,'fn'),4); near(s._summonT,t0,'four notes: no Second Edition yet',1e-9);
  V.hit(s,F[5],10,{auto:true}); kill(F[5]); assert.equal(stack(L,'fn'),5); near(s._summonT,t0+2,'Second Edition: the 5th note adds 2 s to every summon',1e-9);
  setStack(L,'fn',10); V.wave(); V.step(1); assert.equal(stack(L,'fk'),3,'Field Kit again each wave (not counted toward the 10)');
});

test('Aldren / Bookmark, Dog-Eared, Marked Page: a spirit whose time runs out standing; the next one shielded, quick for 4 s, beside the enemy it hunted',()=>{
  const pS=plain({foes:3},P=>{ const s=spirit(P); return {hp:s.maxHp,ai:s.atkInterval}; });
  const L=lab(H,S(['be_2_3','be_3_3','be_4_3']),{foes:3,big:true}), {v,F}=L;
  const a=spirit(L); assert.ok(!(a.shield>0),'the first spirit: no Bookmark'); V.hit(a,F[2],1,{auto:true}); a._summonT=V.STEP/2; a.stunned=0; V.step(1); assert.ok(!a.alive,'its time ran out');
  assert.equal(stack(L,'bm'),1,'Bookmark: its page is kept');
  const b=spirit(L); near(b.shield,b.maxHp*0.25,'the next spirit comes with a shield of 5% x 5 of its max HP'); assert.equal(stack(L,'bm'),0,'one page, one spirit');
  near(b.atkInterval/(b.hasteT>0?b.hasteMul:1),pS.ai/1.15,'Dog-Eared: 3% x 5 faster'); near(b.hasteT,4,'for its first 4 s');
  assert.ok(gapM(b,F[2])<0.25,'Marked Page: it comes out beside the enemy its last page was hunting ('+gapM(b,F[2]).toFixed(2)+' m)'); assert.equal(b.target,F[2],'and goes on hunting it');
  const c=spirit(L); assert.ok(!(c.shield>0),'the spirit after that: nothing'); kill(c); assert.equal(stack(L,'bm'),0,'a spirit that is killed keeps no page');
});

test('Aldren / Ink Spirit and the Horror as they are called: Long Chapter, Longest Entry, True Likeness, Hunting Ink, Wide Margins, Heavy Tome, Read Aloud, Single Entry',()=>{
  const pS=plain({foes:3},P=>{ const s=spirit(P), h=horror(P), m=P.v.maxHp; return {hp:s.maxHp/m,dmg:s.dmg,sp:s.speed,hh:h.maxHp/m}; });   // (as shares of his max HP: they are made from it)
  const L=lab(H,S(['be_4_2','be_10_2','be_1_4','be_2_4','be_9_2','be_7_3','be_6_2','be_5_3']),{foes:3}), {v}=L, m=v.maxHp;
  const s=spirit(L); near(s._summonT,19,'Long Chapter: 16 s + 0.6 x 5'); near(s.maxHp/m,pS.hp*1.12*1.075*1.3,'True Likeness 4% x 3, Wide Margins 1.5% x 5, Single Entry 30% more max HP',1e-6);
  near(s.dmg,pS.dmg*1.3,'Single Entry: 30% more attack'); near(s.speed,pS.sp*1.15,'Hunting Ink: 5% x 3 faster');
  const h=horror(L); near(h._summonT,24,'Longest Entry: 22 s + 0.4 x 5'); near(h.maxHp/m,pS.hh*1.10*1.075,'Heavy Tome 2% x 5, Wide Margins');
  near(FX.cd(v,'green',11),10,'Read Aloud: Ink Spirit\'s cooldown 0.2 s x 5 shorter'); near(FX.cd(v,'blue',9),9,'not Chapter Rewrite\'s');
});

test('Aldren / Pack Entry (PICK ONE, its own lab): two Lesser Ink Spirits, each with 60% of the stats',()=>{
  const pS=plain({foes:3},P=>{ const s=spirit(P); return {hp:s.maxHp/P.v.maxHp,dmg:s.dmg}; });
  const L=lab(H,S(['be_5_2']),{foes:3}); V.cast(L.v,'green'); const s=mine(L,'ink spirit'); assert.equal(s.length,2,'two of them');
  for(const x of s){ near(x.maxHp/L.v.maxHp,pS.hp*0.6,'60% of the max HP'); near(x.dmg,pS.dmg*0.6,'and of the attack'); }
});

test('Aldren / his summons\' hits: Steady Pen, Nothing Gentler, Full Bestiary, Sketched Fangs, Ink Spin Weight, Scholar\'s Mind (the spirit half), Callback',()=>{
  const L=lab(H,S(['be_1_2','be_8_1','be_12_2','be_6_1','be_8_3','lb_3_2','be_11_2']),{foes:3,big:true}), {v,F}=L; const s=spirit(L), h=horror(L); hold(s); hold(h); v._pages=1; secs(3.1);
  const f=F[1], base=(x,o)=>plainHit(L,()=>lost(f,()=>V.hit(x,f,1000,o))), got=(x,o)=>lost(f,()=>V.hit(x,f,1000,o));
  near(got(h,{auto:true}),base(h,{auto:true})*1.10*1.15,'above 70% HP: Nothing Gentler 5% x 3, Full Bestiary 2% x 5');
  near(got(h,{auto:false}),base(h,{auto:false})*1.10*1.15*1.15,'Ink Spin (the Horror\'s only hit that is not a basic attack): Ink Spin Weight 3% x 5 more');
  const am=base(s,{auto:true}); v._pages=0; near(got(s,{auto:true})/am,(1.10*1.15*1.15)*VMX('(s,t)=>{ const a=defMul(s,t,"phys"); const k=s._wpnArmIgn; s._wpnArmIgn=0.12; const b=defMul(s,t,"phys"); s._wpnArmIgn=k; return b/a; }')(s,f),'a spirit, while he holds no page: Scholar\'s Mind 3% x 5, Sketched Fangs 4% x 3 of the armor ignored',1e-6);
  v._pages=1; V.cast(v,'blue',F[2]); near(got(h,{auto:true}),base(h,{auto:true})*1.10*1.15*1.15,'Steady Pen: 3% x 5 more for 3 s after he casts'); secs(3.1); near(got(h,{auto:true}),base(h,{auto:true})*1.10*1.15,'then no more');
  f.hp=f.maxHp*0.5; near(got(h,{auto:true}),base(h,{auto:true})*1.10,'below 70% HP: no Nothing Gentler');
  const e0=v.energy; F[0].hp=5; V.hit(h,F[0],100,{auto:true}); assert.ok(!F[0].alive); near(v.energy-e0,6,'Callback: a summon\'s killing blow, 2 x 3 energy');
});

test('Aldren / his summons in danger, and his own guard: Ink Hide, Sturdy Stitching, Close Call, Old Bindings, Footnoted, Back Shelf',()=>{
  const L=lab(H,S(['be_5_1','be_n1','be_10_1','be_11_3','be_7_2','be_10_4']),{foes:3,allies:1,big:true}), {v,A,F}=L; const s=spirit(L); hold(s); V.step(1);
  const tin=plainHit(L,()=>lost(s,()=>V.hit(F[0],s,100))); near(lost(s,()=>V.hit(F[0],s,100)),tin*0.925,'Ink Hide: his summons take 1.5% x 5 less');
  near(lost(A[0],()=>V.hit(F[0],A[0],100)),plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],100))),'not his other allies');
  s.stunned=0; s.level=1; F[0].level=100; V.cc(F[0],s,'stunned',2); near(s.stunned,V.ccNerf*2*0.70,'Sturdy Stitching: a stun on his summon 6% x 5 shorter',1e-9);
  const vin=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,100))); near(lost(v,()=>V.hit(F[0],v,100)),vin*0.925,'Back Shelf: he takes 1.5% x 5 less while a summon of his stands');
  s.stunned=1e6; s.hp=50; V.dmg(s,1e6); assert.ok(s.alive&&s.hp===1,'Close Call: it would die, it stays at 1 HP'); V.dmg(s,1e6); assert.ok(s.alive,'for 1.5 s'); secs(1.6); assert.equal(v.shield||0,0);
  F[0].x=s.x+(V.bodyR(s)+V.bodyR(F[0])+1)*V.METER; F[0].y=s.y; const fH=F[0].hp, f2=F[2].hp;
  V.dmg(s,1e6); assert.ok(!s.alive,'then it dies'); near(v.shield,v.maxHp*0.15,'Old Bindings: he gains a shield of 3% x 5 of his max HP');
  near(fH-F[0].hp,0.4*v.apow,'Footnoted: the spirit bursts for 40% of his ability power on an enemy within 2 m',1e-6); assert.equal(f2-F[2].hp,0,'not one farther away');
  const t=spirit(L); hold(t); V.step(1); const sh=v.shield; t.hp=10; V.dmg(t,1e6); assert.ok(!t.alive,'Close Call: once a wave'); near(v.shield,Math.max(sh,v.maxHp*0.15),'Old Bindings again: the larger shield stays, the two do not add');
  near(lost(v,()=>V.hit(F[0],v,100)),vin,'no summon: no Back Shelf');
  const h=horror(L); hold(h); V.step(1); F[0].x=h.x+(V.bodyR(h)+V.bodyR(F[0])+1)*V.METER; F[0].y=h.y; const fh=F[0].hp; h.hp=10; V.dmg(h,1e6); assert.ok(!h.alive);
  assert.equal(fh-F[0].hp,0,'Footnoted is the Lesser Ink Spirit\'s: the Horror does not burst');
});

test('Aldren / The Whole Book (SIGNATURE) and Abridged: an extra spirit per noted class while the Horror stands, his summons 20% tougher; the Horror at a spirit\'s side, its Field Notes twice',()=>{
  const pS=plain({foes:3},P=>{ const s=spirit(P), h=horror(P); hold(s); hold(h); return {hd:h.dmg,tin:lost(s,()=>V.hit(P.F[0],s,100))}; });
  const L=lab(H,S(['be_1_1','be_13_2','be_9_3','be_5_3']),{foes:3,big:true}), {v,F}=L; const s=spirit(L); hold(s); at(L,s,-4,-8);
  V.hit(s,F[2],10,{auto:true}); kill(F[2]); assert.equal(stack(L,'fn'),1);
  const h=horror(L); hold(h); assert.ok(Math.min(...mine(L,'ink spirit').map(x=>gapM(h,x)))<0.25,'Abridged: the Horror comes out at a spirit\'s side');
  const ex=mine(L,'ink spirit').filter(x=>x._talEx); assert.equal(ex.length,1,'The Whole Book: one class noted, one extra Lesser Ink Spirit');
  const pr=ex[0].forcedTarget; assert.ok(pr&&pr.alive&&pr.team==='enemy'&&pr.t.role===F[2].t.role&&ex[0].forcedTargetT>20,'it hunts an enemy of that class'); near(ex[0]._summonT,h._summonT,'for as long as the Horror has',1e-9);
  near(ex[0].maxHp*1.3,s.maxHp,'a spirit his talent called is not his Ink Spirit: no Single Entry',0.002); V.step(1);
  near(lost(s,()=>V.hit(F[0],s,100)),pS.tin*0.8,'his summons take 20% less while the Horror stands'); V.step(2); near(h.dmg,pS.hd*(1+0.02*2),'Abridged: the Horror takes its Field Notes bonus twice (0.4% x 5 per note)',1e-6);
  h.hp=10; V.dmg(h,1e6); assert.ok(!h.alive); assert.ok(!ex[0].alive,'the Horror falls: its extra spirit goes'); near(lost(s,()=>V.hit(F[0],s,100)),pS.tin,'and no 20% any more');
});

/* ============================== THE REWRITE ============================== */
const mrK=(s,t,k)=>VMX('(s,t,k)=>{ const a=defMul(s,t,"magic"); const m=t.mrRating; t.mrRating=m*(1-k); const b=defMul(s,t,"magic"); t.mrRating=m; return b/a; }')(s,t,k);   // a magic hit on t when that share of its magic resist is ignored
const rwHit=(L,t)=>{ const e0=L.v.energy; const hl=log(()=>V.cast(L.v,'blue',t)); const h=hl.find(x=>x.src===L.v&&x.tgt===t&&x.kind==='magic'); return {hit:h?h.lost:0,e:L.v.energy-e0,hl}; };
const marked=(L,t,name,until)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:until==null?V.now()+99:until,v:0}; };

test('Aldren / Revision: Revision, Redraft, Final Cut, Rough Draft, Long Rewrite, Pressed Ink, Torn Out, Editor\'s Eye, Strict Editor, Retcon',()=>{
  const p=plain({foes:3},P=>{ const f=P.F[0], r=rwHit(P,f); return {hit:r.hit,pct:f._atkDnPct,sh:f._shredPct,dur:f._atkDnT}; });
  const L=lab(H,S(['rw_1_1','rw_2_1','rw_3_1','rw_8_1','rw_4_3','rw_5_4','rw_10_3','rw_2_4','rw_5_1','rw_12_1']),{foes:3,big:true}), {v,F}=L, f=F[0];
  const k=mrK(v,f,0.12); let r=rwHit(L,f);
  near(r.hit,p.hit*1.15*k,'Pressed Ink 3% x 5 more, Torn Out 4% x 3 of its magic resist ignored'); assert.equal(ust(L,f,'rev'),0,'the first rewrite: no Revision');
  near(f._atkDnPct,p.pct,'the plain cut'); near(f._atkDnT,p.dur+1.5,'Long Rewrite: the stat cut 0.5 x 3 s longer'); assert.ok(mark(L,f,'rw'),'it is rewritten');
  r=rwHit(L,f); assert.equal(ust(L,f,'rev'),1,'Revision: rewritten again within 10 s'); near(f._atkDnPct,p.pct*1.10,'its attack cut 2% x 5 deeper per Revision'); near(f._shredPct,p.sh*1.10,'its armor cut too');
  near(r.e,5,'Rough Draft: 1 x 5 energy for the Revision added'); near(f._talM[v.uid]['#rev'].until-V.now(),13,'Redraft: Revisions last 10 s + 1 x 3');
  rwHit(L,f); assert.ok(!(f.silencedT>0),'2 Revisions: no Final Cut'); rwHit(L,f); assert.equal(ust(L,f,'rev'),3,'max 3'); near(f._atkDnPct,p.pct*1.30,''); near(f.silencedT,1,'Final Cut: at 3 Revisions, silenced 1 s',1e-9);
  rwHit(L,f); assert.equal(ust(L,f,'rev'),3,'still 3');
  near(FX.cd(v,'blue',9),(9-0.9)*0.955,'Editor\'s Eye 0.3 x 3 s off, Strict Editor 1.5% x 3 shorter'); near(FX.cd(v,'green',11),11*0.955,'Strict Editor on both');
  const g=F[1]; g._raidBoss=true; rwHit(L,g); near(g._atkDnPct,p.pct*1.15,'Retcon: on a boss the cut is 5% x 3 deeper'); near(g._shredPct,p.sh*1.15,'');
  secs(13.1); assert.equal(ust(L,f,'rev'),0,'Revisions lapse'); assert.ok(!mark(L,f,'rw'),'the rewrite is over');
});

test('Aldren / rewritten enemies: Thin Paper, Cold Ink, Red Margin, Rewrite the Ending, Footnote, Red Lines, Slipcase, Unhappy Ending, Censor, Unbound, Spare Copy',()=>{
  const L=lab(H,S(['rw_n2','rw_7_3','rw_9_1','rw_7_1','rw_7_2','rw_4_1','rw_8_4','rw_6_3','rw_10_1','rw_12_4','rw_9_4','rw_1_1']),{foes:4,allies:1,big:true}), {v,A,F}=L, f=F[0], a=A[0];
  const b={mr:f.mrRating,sp:f.speed,ai:f.atkInterval,mh:f.maxHp}; f.hp=f.maxHp*0.2; V.cast(v,'blue',f); V.step(2);
  near(f.mrRating,b.mr*0.90,'Thin Paper: 2% x 5 less magic resist'); near(f.speed,b.sp*0.90,'Cold Ink: 2% x 5 slower'); near(f.atkInterval,b.ai/0.925,'Red Margin: 1.5% x 5 slower attacks');
  near(f.maxHp,b.mh*0.9,'Rewrite the Ending: below 30% HP, its max HP cut by 10% while the rewrite lasts');
  F[1].hp=F[1].maxHp*0.35; V.cast(v,'blue',F[1]); V.step(1); near(F[1].maxHp,b.mh,'not at 35%');
  const pin=plainHit(L,()=>({fa:lost(f,()=>V.hit(a,f,1000,{kind:'true'})),af:lost(a,()=>V.hit(f,a,1000)),vf:lost(v,()=>V.hit(f,v,1000))}));
  near(lost(f,()=>V.hit(a,f,1000,{kind:'true'})),pin.fa*1.075,'Footnote: rewritten enemies take 1.5% x 5 more from his team');
  near(lost(a,()=>V.hit(f,a,1000)),pin.af*0.95,'Red Lines: they deal 1% x 5 less to his allies'); near(lost(v,()=>V.hit(f,v,1000)),pin.vf*0.925,'Slipcase: and 1.5% x 5 less to him');
  const hp0=f.hp, hpl=plainHit(L,()=>{ V.heal(f,1000); return f.hp-hp0; }); const hp1=f.hp; V.heal(f,1000); near(f.hp-hp1,hpl*0.85,'Unhappy Ending: 5% x 3 less healing');
  f.energy=0; plainHit(L,()=>V.hit(a,f,1,{kind:'true'})); const eP=f.energy; f.energy=0; V.hit(a,f,1,{kind:'true'}); near(f.energy,eP*0.85,'Censor: 5% x 3 less energy from being hit');
  const g=F[2]; V.cast(v,'blue',g); V.cast(v,'blue',g); assert.equal(ust(L,g,'rev'),1); kill(g); assert.equal(ust(L,F[1],'rev'),1,'Unbound: its Revisions pass to the nearest enemy'); assert.equal(ust(L,f,'rev'),0,'(only to it)');
  v.blueCd=8; kill(F[3]); near(v.blueCd,8,'Spare Copy: not for an enemy that is not rewritten'); V.cast(v,'blue',F[1]); v.blueCd=8; kill(F[1]); near(v.blueCd,8*0.4,'Spare Copy: a rewritten enemy dies, 20% x 3 of what is left off the cooldown');
  secs(6.1); near(f.mrRating,b.mr,'the rewrite over: its magic resist back'); near(f.maxHp,b.mh,'and its max HP'); near(f.speed,b.sp,'');
});

test('Aldren / Plot Twist: Plot Twist, Two Versions, Twist Ending, Shared Story, Plot Armor, Hard Cover',()=>{
  const L=lab(H,S(['rw_2_2','rw_8_2','rw_3_2','rw_6_2','rw_11_2','rw_1_4']),{foes:2,allies:2}), {v,A,F}=L, f=F[0]; A[0].hp=A[0].maxHp*0.3; A[1].hp=A[1].maxHp*0.5; V.step(1);
  v.shield=0; V.cast(v,'blue',F[1]); assert.equal(v.shield||0,0,'nothing reversed: no Hard Cover'); assert.ok(!(A[0].dmgBuffT>0),'and nothing written');
  Object.assign(f,{dmgBuffMul:1.5,dmgBuffT:5,hasteMul:1.4,hasteT:4,drMul:0.6,drT:3,_critBuffPct:0.2,_critBuffT:2}); f.hots.push({hps:50,remaining:5,interval:1,acc:0});
  A[1].hasteMul=1.5; A[1].hasteT=1;   // a stronger haste of its own, shorter
  const h0=A.map(a=>a.hp), n0=A.map(a=>a.hots.length); V.cast(v,'blue',f);
  near(A[1].hasteMul,1.5,'a written buff never replaces a stronger one'); near(A[1].hasteT,1,'nor lengthens it'); A[1].hasteMul=1.2; A[1].hasteT=4; assert.ok(!(f.dmgBuffT>0),'the rewrite reversed them');
  for(let i=0;i<2;i++){ const a=A[i];
    near(a.dmgBuffMul,1.25,'Plot Twist: 10% x 5 of the damage buff'); near(a.dmgBuffT,5,'for the time it had left'); near(a.hasteMul,1.2,'the haste'); near(a.hasteT,4,''); near(a.drMul,0.8,'the damage reduction'); near(a.drT,3,'');
    near(a._critBuffPct,0.1,'the crit buff'); assert.equal(a.hots.length,n0[i]+1,'and its heal over time'); near(a.hots[a.hots.length-1].hps,25,'');
    near(a.hp-h0[i],a.maxHp*0.075,'Twist Ending: the ally heals 1.5% x 5 of its max HP',1e-6); }
  assert.ok(A.every(a=>a.dmgBuffT>0),'Two Versions: the two lowest-HP allies'); near(v.shield,v.maxHp*0.06,'Hard Cover: a shield of 2% x 3 of his max HP');
  const ss=plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000))); near(lost(F[1],()=>V.hit(A[0],F[1],1000)),ss*1.075,'Shared Story: the ally deals 1.5% x 5 more for 4 s');
  const pa=plainHit(L,()=>lost(A[0],()=>V.hit(F[1],A[0],1000))); near(lost(A[0],()=>V.hit(F[1],A[0],1000)),pa*0.925,'Plot Armor: while it holds the buff it takes 1.5% x 5 less');
  secs(4.1); near(lost(F[1],()=>V.hit(A[0],F[1],1000)),plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000))),'Shared Story over'); secs(1); near(lost(A[0],()=>V.hit(F[1],A[0],1000)),plainHit(L,()=>lost(A[0],()=>V.hit(F[1],A[0],1000))),'Plot Armor over with the buff');
});

test('Aldren / Stolen Shield and Burnt Shield (PICK ONE: each in its own lab), Burnt Pages',()=>{
  { const L=lab(H,S(['rw_5_2']),{foes:2,allies:1}), {v,A,F}=L, f=F[0]; A[0].hp=A[0].maxHp*0.5; f.shield=1000; f.shieldT=5; const hl=log(()=>V.cast(v,'blue',f));
    assert.equal(f.shield,0,'Stolen Shield: the shield is taken'); assert.ok(!hl.some(h=>h.kind==='true'),'not burnt'); near(A[0].shield,400,'40% of it to his lowest-HP ally'); near(A[0].shieldT,5,'for its time left'); }
  { const L=lab(H,S(['rw_5_3','rw_4_4']),{foes:3}), {v,F}=L, f=F[0]; f.shield=1000; f.shieldT=5; const h0=f.hp, h1=F[1].hp, h2=F[2].hp; const hl=log(()=>V.cast(v,'blue',f));
    const x=hl.find(h=>h.tgt===f&&h.kind==='magic').lost; near(h0-f.hp,0.8*(1000-x),'Burnt Shield 50% + Burnt Pages 10% x 3: the burn deals 80% more than the shield it burns',1e-6);
    near(h1-F[1].hp,0.3*1000*1.8,'the fire spreads to an enemy within 2 m for 30% of it'); near(F[2].hp,h2,'not one farther away'); }
});

test('Aldren / The Last Chapter (SIGNATURE): Final Volume rewrites the three strongest enemies at once, each with 3 Revisions, their buffs written into an ally in full',()=>{
  const p=plain({foes:1},P=>{ V.cast(P.v,'blue',P.F[0]); return P.F[0]._atkDnPct; });
  const L=lab(H,S(['rw_13_2','rw_1_1']),{foes:4,allies:1}), {v,A,F}=L; A[0].hp=A[0].maxHp*0.5; F[0].dmg=1; F[0].apow=0; F[1].dmg=5000; F[2].apow=6000; F[3].dmg=4000;
  Object.assign(F[2],{dmgBuffMul:1.4,dmgBuffT:5});
  V.cast(L.v,'ult'); assert.ok(mine(L,'ink horror').length===1,'');
  for(const f of [F[1],F[2],F[3]]){ assert.ok(mark(L,f,'rw'),'the strongest three are rewritten'); assert.equal(ust(L,f,'rev'),3,'with 3 Revisions'); near(f._atkDnPct,p*1.30,'their cut 3 Revisions deep'); }
  assert.ok(!mark(L,F[0],'rw'),'not the weakest'); near(A[0].dmgBuffMul,1.4,'Plot Twist at full strength (without Plot Twist learned)'); near(A[0].dmgBuffT,5,'');
});

test('Aldren / Ink Mastery (up to 10%) and Filed Under Beasts (LINK: 10% more against a Revised enemy; with Field Notes, a note at 3 Revisions)',()=>{
  const L=lab(H,S(['rw_12_2','rw_n1','rw_1_1','be_1_1']),{foes:3,big:true}), {v,F}=L; noDef(L); const h=horror(L); hold(h); V.step(1); const f=F[0];
  const pin=plainHit(L,()=>lost(v,()=>V.hit(f,v,1000))); V.hit(h,f,1,{auto:true}); near(lost(v,()=>V.hit(f,v,1000)),pin*0.95,'Ink Mastery: each Horror attack cuts its attack 1% x 5');
  V.hit(h,f,1,{auto:true}); V.hit(h,f,1,{auto:true}); near(lost(v,()=>V.hit(f,v,1000)),pin*0.90,'up to 10%'); V.hit(h,f,1); near(lost(v,()=>V.hit(f,v,1000)),pin*0.90,'Ink Spin: not an attack');
  secs(3.1); near(lost(v,()=>V.hit(f,v,1000)),pin,'gone 3 s after the last');
  const g=F[1], d1=rwHit(L,g).hit, d2=rwHit(L,g).hit; near(d2,d1,'the second rewrite: no Revision before it'); near(rwHit(L,g).hit,d1*1.10,'Filed Under Beasts: 10% more on an enemy that already carries a Revision');
  assert.equal(stack(L,'fn'),0); rwHit(L,g); assert.equal(ust(L,g,'rev'),3); assert.equal(stack(L,'fn'),1,'3 Revisions: a Field Note on it at once'); rwHit(L,g); kill(g); assert.equal(stack(L,'fn'),1,'once per enemy, and its death adds none');
});

/* ============================== THE LIVING BOOK ============================== */
const pPage=o=>plain(Object.assign({foes:3},o||{}),P=>{ noDef(P); P.v._pages=1; return pages(swingLog(P))[0].lost; });

test('Aldren / pages written: Written Twice, Thick Volume, Shelf Life, Final Blot, Open Book; Tight Binding (PICK ONE: its own lab)',()=>{
  { const L=lab(H,S(['lb_7_2','lb_2_3','lb_11_4','lb_10_4','lb_11_2','lb_1_4']),{foes:3,big:true}), {v,F}=L; assert.equal(v._pages,3,'Shelf Life: he starts the wave holding 1 x 3 pages');
    v._pages=0; press(L,'blue'); assert.equal(v._pages,2,'Written Twice: a spell writes 2'); press(L,'green'); assert.equal(v._pages,4,'Thick Volume 5/5: he holds 4'); press(L,'green'); assert.equal(v._pages,4,'no more');
    v._pages=1; swing(L,1); assert.equal(v._pages,0); assert.ok(mark(L,F[0],'blot'),''); kill(F[0]); assert.equal(v._pages,1,'Final Blot: a Blotted enemy dies, 20% x 5 chance of a page');
    const h=horror(L); hold(h); v._pages=0; V.hit(h,F[1],1,{auto:true}); assert.equal(v._pages,1,'Open Book: a Horror attack writes a page'); V.hit(h,F[1],1,{auto:true}); assert.equal(v._pages,1,'at most once every 1 s (2.5 s - 0.5 x 3)');
    secs(1.05); V.hit(h,F[1],1,{auto:true}); assert.equal(v._pages,2,''); V.hit(h,F[1],1); }
  { const L=lab(H,S(['lb_5_3','lb_11_4','lb_7_2','lb_2_3']),{foes:3,big:true}), {v}=L; assert.equal(v._pages,2,'Tight Binding: he holds at most 2 (Shelf Life too; Thick Volume 5/5 does not change it)'); v._pages=0; press(L,'blue'); assert.equal(v._pages,2,''); press(L,'blue'); assert.equal(v._pages,2,''); }
});

test('Aldren / Chapter\'s End: every 3rd page; Cliffhanger, Closing Lines, Next Chapter, Long Story, Running Head, Epilogue',()=>{
  const pp=pPage(), L=lab(H,S(['lb_1_1','lb_9_1','lb_12_1','lb_6_1','lb_10_1','lb_4_1','lb_3_1']),{foes:6,big:true}), {v,F}=L; noDef(L); F[1].hp=F[1].maxHp*0.4; v._pages=3;
  const hp=()=>F.map(f=>f.hp); let h0=hp(); const s1=pages(swingLog(L)); near(s1[0].lost,pp,'the first page: no chapter'); assert.deepEqual(hp().slice(1),h0.slice(1),'and no burst');
  swing(L,1); const e2=v.energy; h0=hp(); const s3=pages(swingLog(L)); const e3=v.energy, ce=0.08*5*v.apow;
  near(s3.find(h=>h.tgt===F[0]).lost,pp*1.15,'Cliffhanger: the 3rd page hit, 3% x 5 more on its target');
  near(h0[1]-F[1].hp,ce*1.15,'Chapter\'s End: every other enemy within 2 m struck for 8% x 5 of his ability power; Closing Lines 5% x 3 more below 50% HP',1e-6);
  near(h0[4]-F[4].hp,ce,'Next Chapter: 0.3 x 3 m wider (2.06 m away)',1e-6); assert.equal(h0[3]-F[3].hp,0,'not 3.5 m away'); near(e3-e2,5,'Running Head: 1 x 5 energy'); assert.equal(v._pages,1,'Epilogue: the chapter writes a new page at once');
  v._pages=3; swing(L,2); h0=hp(); swingLog(L); near(h0[4]-F[4].hp,2*ce,'Long Story: the 2nd chapter ends a Volume, its burst hits twice',1e-6);
});

test('Aldren / page hits: Heavy Pages, Thick Volume, Annotated, Wet Ink, Spreading Blot, Ink Bleeds Through, Dark Ink, Old Leather, Speed Reader, Page Storm, Living Draft, Page Cut',()=>{
  const pp=pPage(), pB=plain({foes:3},P=>({ai:P.F[0].atkInterval,ar:P.v.armorRating}));
  const L=lab(H,S(['lb_5_1','lb_2_3','lb_12_3','lb_1_4','lb_2_4','lb_3_4','lb_6_4','lb_8_4','lb_9_2','lb_12_2','rw_10_2','lb_7_1']),{foes:3}), {v,F}=L; noDef(L); v.maxHp=v.hp=1e6; v.hp=5e5;
  v._pages=1; const hp0=v.hp, a=pages(swingLog(L))[0]; near(a.lost,pp*1.15*1.20,'Heavy Pages 5% x 3, Thick Volume 4% x 5'); near(v.hp-hp0,a.lost*0.15,'Annotated: page hits heal him 5% x 3 of their damage',1e-6);
  assert.ok(mark(L,F[0],'blot')&&!mark(L,F[1],'blot'),'Wet Ink: a page hit Blots its target'); near(F[0]._talM[v.uid].blot.until-V.now(),4.5,'Spreading Blot: 3 s + 0.5 x 3',0.05);
  V.step(1); near(F[0].atkInterval,pB.ai/0.94,'it attacks 2% x 3 slower'); near(v.armorRating,pB.ar*1.06,'Old Leather: he has 2% x 3 more armor for 3 s');
  near(FX.cd(v,'green',11),11/1.3,'Speed Reader: his last page spent, the next spell\'s cooldown recovers 30% faster'); near(FX.cd(v,'green',11),11,'that spell only');
  v._pages=2; const b=pages(swingLog(L))[0]; near(b.lost,pp*1.15*1.20*1.09,'Dark Ink: 3% x 3 more on a Blotted enemy'); assert.ok(mark(L,F[1],'blot'),'Ink Bleeds Through: its Blot spreads to the enemies within 2 m'); assert.ok(!mark(L,F[2],'blot'),'');
  near(FX.cd(v,'green',11),11,'a page left: no Speed Reader'); secs(3.1); near(v.armorRating,pB.ar,'Old Leather over');
  const h=horror(L); hold(h); V.cast(v,'blue',F[0]); for(let i=0;i<300&&mark(L,F[0],'blot');i++) V.step(1); assert.ok(!mark(L,F[0],'blot'),'(its Blot has run out)'); v._pages=1; const c=pages(swingLog(L)).find(x=>x.tgt===F[0]); near(c.lost,pp*1.15*1.20*1.15*1.15,'Page Storm 3% x 5 while the Horror stands, Living Draft 3% x 5 on a rewritten enemy');
  const mr=300; F[1].mrRating=mr; F[1].hp=F[1].maxHp; v.target=F[1]; F[0].x+=40*V.METER; const pl=plainHit(L,()=>{ v._pages=1; return pages(swingLog(L))[0].lost; });
  v._pages=1; const d=pages(swingLog(L))[0]; assert.equal(d.tgt,F[1]); near(d.lost/pl,1.15*1.20*1.15*mrK(v,F[1],0.10),'Page Cut: 2% x 5 of its magic resist ignored',1e-6);
});

test('Aldren / with pages in hand: Turning Pages, Desk Work, Rapid Notes, Ink-Stained Hands, Crisp Pages, Ink Ward, Blotted Out, Spine Crack, Scholar\'s Mind, Clean Margins, Quick Hand, Ink Well',()=>{
  const p=plain({foes:2},P=>{ noDef(P); return {ai:P.v.atkInterval,rw:rwHit(P,P.F[0]).hit}; });
  const L=lab(H,S(['lb_2_1','lb_9_3','lb_11_1','lb_1_2','rw_11_4','lb_7_4','lb_5_4','lb_8_2','lb_3_2','lb_4_3','lb_4_2','lb_10_3']),{foes:2,allies:1,big:true}), {v,A,F}=L, f=F[0]; noDef(L);
  v._pages=1; V.step(1); near(v.atkInterval,p.ai/1.06,'Turning Pages: 2% x 3 faster while he holds a page'); v._pages=0; V.step(1); near(v.atkInterval,p.ai,'none: no');
  const vin=plainHit(L,()=>lost(v,()=>V.hit(f,v,1000))); near(lost(v,()=>V.hit(f,v,1000)),vin,'1 page or none: no Desk Work'); v._pages=2; near(lost(v,()=>V.hit(f,v,1000)),vin*0.90,'Desk Work: 2% x 5 less with 2 pages');
  const au=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{auto:true}))); near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),au*1.15*1.10*1.12,'Rapid Notes 1.5% x 5 per page, Ink-Stained Hands 2% x 5, Crisp Pages 4% x 3 on his basic attacks');
  v._pages=0; marked(L,f,'blot'); const ain=plainHit(L,()=>lost(A[0],()=>V.hit(f,A[0],1000))); near(lost(v,()=>V.hit(f,v,1000)),vin*0.925*0.95,'Ink Ward 1.5% x 5, Blotted Out 1% x 5: a Blotted enemy hits him for less');
  near(lost(A[0],()=>V.hit(f,A[0],1000)),ain*0.95,'Blotted Out: and his allies');
  v._pages=2; near(rwHit(L,F[1]).hit,p.rw*1.24,'Spine Crack: Chapter Rewrite 4% x 3 more per page held');
  v._pages=0; press(L,'blue'); assert.equal(v._pages,1); near(rwHit(L,F[1]).hit,p.rw*1.15*1.12,'Scholar\'s Mind: no page held at the press, 3% x 5 more (and Spine Crack for the page it wrote)');
  press(L,'blue'); assert.equal(v._pages,2); near(rwHit(L,F[1]).hit,p.rw*1.24,'a page held at the press: no Scholar\'s Mind');
  v.stunned=0; v.level=1; f.level=100; V.cc(f,v,'stunned',2); near(v.stunned,V.ccNerf*2*0.88,'Clean Margins: control on him 4% x 3 shorter',1e-9); v.stunned=1e6;
  near(FX.cd(v,'blue',10),10*0.955,'Quick Hand: 1.5% x 3 shorter cooldowns');
  v.energy=0; V.step(1); v.energy=20; V.step(1); near(v.energy,20*1.075,'Ink Well: energy fills 1.5% x 5 faster',1e-6);
});

test('Aldren / a page hit is the page hit only: with only Heavy Pages learned, the hits after it are not page hits',()=>{
  const pp=pPage(), L=lab(H,S(['lb_5_1']),{foes:3,big:true}), {v,F}=L; noDef(L); v._pages=1;
  near(pages(swingLog(L))[0].lost,pp*1.15,'Heavy Pages: 5% x 3 more'); assert.equal(L.T.s.cur,null,'nothing is resolving after it');
  near(lost(F[1],()=>V.hit(v,F[1],1000,{auto:true})),plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{auto:true}))),'his basic attack after it: plain');
});

test('Aldren / Loose Binding (PICK ONE, its own lab): two pages at once, the hit deals both; they count as two toward a Chapter',()=>{
  const pp=pPage(), L=lab(H,S(['lb_5_2','lb_1_1']),{foes:3,big:true}), {v,F}=L; noDef(L); v._pages=3;
  const a=pages(swingLog(L)); near(a[0].lost,pp*2,'one hit, both pages'); assert.equal(v._pages,1,'two spent'); assert.equal(stack(L,'pc'),2,'two toward the Chapter');
  const h1=F[1].hp; const b=pages(swingLog(L)); near(b[0].lost,pp,'one page left: one page'); assert.ok(F[1].hp<h1,'the 3rd page ends the Chapter'); assert.equal(stack(L,'pc'),0,'');
});

test('Aldren / Every Page at Once (SIGNATURE): for 8 s after Final Volume every swing lands a page hit spending none, every 3rd is a Chapter\'s End, and all they touch are Blotted',()=>{
  const pp=pPage(), L=lab(H,S(['lb_13_2','lb_1_1']),{foes:3,big:true}), {v,F}=L; noDef(L); v._pages=0;
  assert.equal(pages(swingLog(L)).length,0,'no page: no page hit'); V.cast(v,'ult');
  const a=pages(swingLog(L)); assert.equal(a.length,1,'a page hit with no page'); near(a[0].lost,pp,''); assert.equal(v._pages,0,'and none spent'); assert.ok(mark(L,F[0],'blot'),'its target Blotted (without Wet Ink)');
  swing(L,1); const h1=F[1].hp; swing(L,1); assert.ok(F[1].hp<h1,'the 3rd is a Chapter\'s End'); assert.ok(mark(L,F[1],'blot'),'and the enemies it touches are Blotted');
  secs(8); assert.equal(pages(swingLog(L)).length,0,'8 s later: over');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Aldren: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['be_1_1','be_2_3','be_12_2','rw_1_1','rw_2_2','lb_1_1','lb_1_4','lb_2_3','be_11_3']), TEAM=['vael','sylthaine','vireo','vex','aldren'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let fn=0, rev=0, blot=false, sum=0, ch=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; fn=Math.max(fn,T0.k.fn?T0.k.fn.n:0); sum=Math.max(sum,T0.sm.length); if(T0.lim['lb_1_1#2']) ch=Math.max(ch,T0.lim['lb_1_1#2'].n);
    for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o['#rev']&&o['#rev'].until>V.now()) rev=Math.max(rev,o['#rev'].v); if(o.blot&&o.blot.until>V.now()) blot=true; } }
  assert.ok(sum>=1,'his real summons carried his rows: '+sum); assert.ok(fn>=1,'they wrote Field Notes: '+fn); assert.ok(rev>=1,'real rewrites added Revisions: '+rev); assert.ok(blot,'real page hits Blotted'); assert.ok(ch>=1,'and ended Chapters: '+ch);
  determinism(H,TEAM);
});

/* The page sites his talents added ('summon' in summonUnit, 'sOut' / 'sHit' in _dealDamageCore, 'sCc' in ccApply, 'sGone' at a summon's end of time, 'pagePre' / 'page'
   around the swing's page block, 'pageW0' / 'pageW' around the write at castKit, the bindMore line): with nothing learned, whole seeded fights with Aldren in the
   line-up are identical to the pre-talent page (ee8edab8), seed by seed. tests/talents-fight.test.js does the same for line-ups without him. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Aldren: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['aldren','vael','vireo','sylthaine','gruel'], foeTeam=['bloatus','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __alN={sp:0,ho:0,rw:0,pg:0,gone:0,hit:0}; var __alD=_doEffectCore, __alS=firePassiveFx, __alK=killSummon, __alC=_dealDamageCore;'+
    'firePassiveFx=function(u){ if(u&&u.key==="aldren") __alN.pg++; return __alS.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="aldren"){ if(type==="summonwarriors") __alN.sp++; if(type==="summonshaman") __alN.ho++; if(type==="chapterrewrite") __alN.rw++; } return __alD.apply(this,arguments); };'+
    'killSummon=function(p){ if(p&&p.alive&&p._summonOwner&&p._summonOwner.key==="aldren"&&p._summonOwner.alive&&!(p._summonT>0)) __alN.gone++; return __alK.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt,amt,color,kind){ if(src&&src._summonOwner&&src._summonOwner.key==="aldren") __alN.hit++; return __alC.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__alN'); assert.ok(c.sp>0&&c.ho>0&&c.rw>0&&c.pg>0&&c.hit>0&&c.gone>0,'the fights called his spirits ('+c.sp+'), the Horror ('+c.ho+'), rewrote ('+c.rw+'), spent pages ('+c.pg+'), his summons struck ('+c.hit+') and ran out of time ('+c.gone+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__alD; firePassiveFx=__alS; killSummon=__alK; _dealDamageCore=__alC;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ be:['be_10_4','be_6_4','be_5_4','be_5_1','be_13_2'], rw:['rw_8_4','rw_6_4','rw_12_2','rw_4_1','rw_11_2'], lb:['lb_9_3','lb_7_4','lb_5_4','lb_8_4','lb_3_3','lb_4_3'] };
function defensive(order){ let b={r:{}}; const want=[].concat(...order.map(k=>DEF[k])), meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, goals=[]; for(const id of want) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
    if(id){ b=T.learn(H,b,id,100).build; continue; }
    const open=goals.find(x=>(b.r[x]|0)<meta(x).ranks), tree=open?meta(open).treeIdx:null;
    const pool=T.trees(H).map((tr,i)=>tr.talents.filter(t=>(tree==null||i===tree)&&!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1]||x[2]-y[2]);
    const any=pool[0]||T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage reduction talents true at once (a summon of his stands, the Horror too; the attacker is rewritten, Blotted,
   carries 10 Ink Mastery cuts; he holds 4 pages, Old Leather is up). Measured through the engine: what reaches his HP and shield against the hit */
function worstHit(list,kind,auto){ const L=lab(H,list,{foes:3,cold:true}), {v,F}=L; V.step(1); const f=F[0], now=V.now(); if(L.T){ spirit(L); horror(L); }
  const M=x=>(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={}); Object.assign(M(f),{rw:{t0:now,until:1e9,v:0},blot:{t0:now,until:1e9,v:0},'#im':{v:10,until:1e9}});
  v._pages=4; if(L.T) L.T.s.w.ol={t:99,n:1,cdT:0,at:-1,wave:false}; V.step(1); v.maxHp=1e5; v.hp=1e5; v.shield=1e12; v.shieldT=999;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,auto})); return 1-x/(raw*VMX('elemMul')(f,v)); }
test('Aldren: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[['lb','be','rw'],['be','lb','rw'],['rw','lb','be'],['lb','rw','be']].map(o=>{ const b=defensive(o); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const auto of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,auto)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="aldren"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="aldren"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','aldren'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));   // a line-up that reaches the back row
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
